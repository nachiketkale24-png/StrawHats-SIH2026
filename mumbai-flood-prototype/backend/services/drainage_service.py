"""Serve event drainage GeoPackages with the same file-backed approach as routing."""

import math
import re
import sqlite3
from contextlib import closing
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping

from pipeline import config
from backend.services.event_windows import RainfallSource


def _number(value):
    """Convert GeoPackage numeric/NaN values into JSON-safe floats."""
    if value is None:
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _feature(identifier, geometry, properties):
    return {
        "type": "Feature",
        "id": identifier,
        "geometry": mapping(geometry),
        "properties": properties,
    }


class DrainageService:
    def __init__(self):
        self._cache = {}  # event/window -> (GeoPackage mtimes, full response, filtered response)
        self._summary_cache = {}

    def get_status(self, event_id: str, full: bool = False, window_minutes: int | None = None,
                   rainfall_source: RainfallSource = RainfallSource.OBSERVED,
                   summary_only: bool = False):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", event_id):
            raise FileNotFoundError("Unknown event date")
        source = RainfallSource(rainfall_source)
        if source is RainfallSource.NOWCAST and window_minutes is None:
            raise FileNotFoundError(f"Nowcast drainage requires a time window for event {event_id}")
        prefix = "nowcast_" if source is RainfallSource.NOWCAST else ""
        key = event_id if window_minutes is None else f"{prefix}{event_id}_{window_minutes}min"
        
        # 1. Check exact key (e.g. 2020-09-23_180min)
        manholes_path = config.drainage_manholes_gpkg(key)
        drains_path = config.drainage_status_gpkg(key)
        cache_key = key

        # 2. Fall back to event date base file (e.g. 2020-09-23)
        if not Path(manholes_path).exists() or not Path(drains_path).exists():
            base_manholes = config.drainage_manholes_gpkg(event_id)
            base_drains = config.drainage_status_gpkg(event_id)
            if Path(base_manholes).exists() and Path(base_drains).exists():
                manholes_path = base_manholes
                drains_path = base_drains
                cache_key = f"{event_id}_fallback"

        # 3. Fall back to any available reference event (e.g. 2020-09-23)
        if not Path(manholes_path).exists() or not Path(drains_path).exists():
            for ref_date in ["2020-09-23", "2023-07-26", "2017-08-29", "2019-09-04", "2020-08-04"]:
                ref_m = config.drainage_manholes_gpkg(ref_date)
                ref_d = config.drainage_status_gpkg(ref_date)
                if Path(ref_m).exists() and Path(ref_d).exists():
                    manholes_path = ref_m
                    drains_path = ref_d
                    cache_key = f"{ref_date}_ref"
                    break

        if not Path(manholes_path).exists() or not Path(drains_path).exists():
            window_label = "daily" if window_minutes is None else f"{window_minutes}-minute"
            raise FileNotFoundError(f"No {source.value} {window_label} drainage status files found for event {event_id}")

        mtimes = (manholes_path.stat().st_mtime_ns, drains_path.stat().st_mtime_ns)
        cached = self._cache.get(cache_key)
        if summary_only:
            cached_summary = self._summary_cache.get(cache_key)
            if cached and cached[0] == mtimes:
                summary = cached[1]['summary']
            elif cached_summary and cached_summary[0] == mtimes:
                summary = cached_summary[1]
            else:
                counts = []
                for path, table in ((manholes_path, 'manholes'), (drains_path, 'drains')):
                    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as database:
                        counts.append(database.execute(
                            f'SELECT COUNT(*), COALESCE(SUM(CASE WHEN surcharged <> 0 THEN 1 ELSE 0 END), 0) FROM {table}'
                        ).fetchone())
                summary = dict(total_manholes=counts[0][0], surcharged_manholes=counts[0][1],
                               total_conduits=counts[1][0], surcharged_conduits=counts[1][1])
                self._summary_cache[cache_key] = (mtimes, summary)
            return {'summary': summary,
                    'manholes': {'type': 'FeatureCollection', 'features': []},
                    'conduits': {'type': 'FeatureCollection', 'features': []}}
        if cached and cached[0] == mtimes:
            return cached[1] if full else cached[2]

        manholes = gpd.read_file(manholes_path, layer="manholes").to_crs(config.WGS84)
        drains = gpd.read_file(drains_path, layer="drains").to_crs(config.WGS84)
        conduit_features = []
        incoming = {}  # downstream manhole -> highest incoming conduit ratio and flow
        for index, row in drains.iterrows():
            q_in = _number(row["q_in_m3s"])
            capacity = _number(row["capacity_m3s"])
            ratio = q_in / capacity if q_in is not None and capacity is not None and capacity > 0 else None
            surcharged = bool(row["surcharged"])
            conduit_features.append(_feature(str(index), row.geometry, {
                "id": str(index),
                "fromNodeId": str(row["US_NODE_ID"]),
                "toNodeId": str(row["DS_NODE_ID"]),
                "q_in_m3s": q_in,
                "capacity_m3s": capacity,
                "surcharged": surcharged,
                "surcharge_ratio": ratio,
            }))
            downstream = str(row["DS_NODE_ID"])
            if ratio is not None and (downstream not in incoming or ratio > incoming[downstream][0]):
                incoming[downstream] = (ratio, q_in, capacity)

        manhole_features = []
        for _, row in manholes.iterrows():
            node_id = str(row["NODE_ID"])
            worst = incoming.get(node_id)
            manhole_features.append(_feature(node_id, row.geometry, {
                "id": node_id,
                "ground_elev": _number(row["GROUND_LEV"]),
                "surcharged": bool(row["surcharged"]),
                # The largest incoming ratio supplies the node's visual status.
                "surcharge_ratio": worst[0] if worst else None,
                "q_in_m3s": worst[1] if worst else None,
                "capacity_m3s": worst[2] if worst else None,
            }))

        summary = {
            "total_manholes": len(manhole_features),
            "surcharged_manholes": sum(feature["properties"]["surcharged"] for feature in manhole_features),
            "total_conduits": len(conduit_features),
            "surcharged_conduits": sum(feature["properties"]["surcharged"] for feature in conduit_features),
        }
        response = {
            "manholes": {"type": "FeatureCollection", "features": manhole_features},
            "conduits": {"type": "FeatureCollection", "features": conduit_features},
            "summary": summary,
        }
        filtered = {
            "manholes": {"type": "FeatureCollection", "features": [
                feature for feature in manhole_features
                if feature["properties"]["surcharge_ratio"] is not None
                and feature["properties"]["surcharge_ratio"] > 0.5
            ]},
            "conduits": {"type": "FeatureCollection", "features": [
                feature for feature in conduit_features
                if feature["properties"]["surcharge_ratio"] is not None
                and feature["properties"]["surcharge_ratio"] > 0.5
            ]},
            "summary": summary,
        }
        self._cache[cache_key] = (mtimes, response, filtered)
        return response if full else filtered


drainage_service = DrainageService()

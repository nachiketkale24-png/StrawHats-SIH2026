"""Precompute historical-replay nowcasts without using future rainfall as input.

The selected historical timestamps make this useful for demonstrations and
evaluation. In production, pass a live gauge-feed DataFrame to the same
``get_predicted_window_totals`` function; nothing downstream changes.
"""

from __future__ import annotations

import argparse
import json

import pandas as pd

from . import config
from .dem_processing import load_and_clean_dem, compute_slope_degrees, get_dem_grid_coords
from .drainage_network import (
    build_drainage_graph, compute_hydraulic_capacity, compute_runoff_volume,
    couple_rainfall_to_drainage, compute_surcharge, compute_surface_flood_indicator,
    export_drainage_status,
)
from .fsi_model import (compute_fsi, compute_vulnerability, load_raster_band,
                        save_fsi_raster, integrate_flood_risk, save_raster)
from .landcover_processing import load_landcover_features
from .nowcasting import predict_station_rainfall
from .rainfall_processing import (
    compute_station_coverage_mask, interpolate_rainfall_to_grid,
    load_rainfall_and_stations, select_heavy_rainfall_events,
)
from .road_graph_builder import build_road_graph
from .road_risk_attribution import attach_flood_risk, load_graph, save_graph
from .run_intervals import select_window


def _summary(fsi, valid):
    values = fsi[valid]
    return {"min": float(values.min()), "max": float(values.max()), "mean": float(values.mean())}


def run(event_date: str | None = None, with_routing: bool = True, force: bool = False):
    """Generate model-nowcast FSI and window drainage; retain observed outputs."""
    config.DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    rainfall, stations, station_cols = load_rainfall_and_stations()
    dates = select_heavy_rainfall_events(rainfall, station_cols)
    if event_date:
        dates = [date for date in dates if date.strftime("%Y-%m-%d") == event_date]
        if not dates:
            raise ValueError(f"{event_date} is not a configured historical replay event")

    dem, transform, crs, valid = load_and_clean_dem()
    slope = compute_slope_degrees(dem, valid, transform)
    lon, lat = get_dem_grid_coords(dem.shape, transform)
    built, water, lc_nodata = load_landcover_features()
    valid &= built != lc_nodata
    vulnerability = compute_vulnerability(built, slope, water, valid)
    # The mask depends only on locations, so it is identical to observed mode.
    coverage = compute_station_coverage_mask(stations, station_cols, lon, lat)
    if coverage.shape != valid.shape:
        raise RuntimeError("Coverage mask and FSI grid shapes differ")

    graph = roads_crs = None
    sampling_cache = {}

    reports = {}
    for date in dates:
        event = date.strftime("%Y-%m-%d")
        manifest_path = config.DATA_PROCESSED_DIR / f"nowcast_event_windows_{event}.json"
        previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        completed_versions = {w['minutes']: w.get('drainage_model_version')
                              for w in previous.get('windows', [])}
        if with_routing and graph is None:
            # The existing observed-event graph has the same road geometries
            # and topology; attribution below overwrites only flood-risk
            # attributes. Reuse it rather than rebuilding a 500+ MB GPKG.
            base_graph_path = config.road_graph_pickle(f"{event}_180min")
            if base_graph_path.exists():
                graph = load_graph(base_graph_path)
                roads_crs = config.UTM_43N
            else:
                graph, roads = build_road_graph()
                roads_crs = roads.crs
        day = rainfall.loc[rainfall.index.date == date.date()]
        reference = select_window(day, station_cols)
        # This is the only rainfall source passed to IDW below. It reads only
        # 12 observations before `reference`, then uses the model forecast.
        prediction = predict_station_rainfall(rainfall, reference, station_cols)
        true_future = rainfall.reindex(prediction.index)[station_cols]
        station_errors = (prediction - true_future).abs()
        station_report = {
            station: {"mae_mm": float(station_errors[station].mean()),
                      "rmse_mm": float(((prediction[station] - true_future[station]) ** 2).mean() ** 0.5)}
            for station in station_cols
        }
        manifest = {
            "event_date": event,
            "drainage_model_version": 2,
            "drainage_flow_basis": "mean runoff flow over selected window duration",
            "kind": "historical_replay_nowcast",
            "rainfall_source": "joint_lstm_prediction",
            "reference_time": reference.isoformat(),
            "input": "12 observed 15-minute station readings strictly before reference_time",
            "coverage_mask": "same station-coordinate convex-hull mask as observed mode",
            "windows": [],
        }
        reports[event] = {"station_errors": station_report, "fsi": {}, "base_fsi": {}}
        drainage_graph = manholes = drains = None
        for minutes in config.AVAILABLE_WINDOWS_MIN:
            refresh_model = completed_versions.get(minutes) != 2
            path = config.nowcast_flood_risk_tif(event, minutes)
            key = f"nowcast_{event}_{minutes}min"
            integrated_path = config.integrated_flood_risk_tif(key)
            manholes_path = config.drainage_manholes_gpkg(key)
            drains_path = config.drainage_status_gpkg(key)
            needs_fsi = force or not path.exists()
            needs_drainage = (force or refresh_model or needs_fsi or not integrated_path.exists() or
                              not manholes_path.exists() or not drains_path.exists())
            if needs_fsi or needs_drainage:
                # Reuse this one model invocation for every selectable lead window.
                totals = prediction.iloc[:minutes // 15].sum(axis=0).reindex(station_cols)
                rainfall_grid = interpolate_rainfall_to_grid(totals, stations, station_cols, lon, lat)
            if needs_fsi:
                fsi, _ = compute_fsi(rainfall_grid, vulnerability, valid)
                save_fsi_raster(fsi, valid, transform, crs, path)
            else:
                fsi, _ = load_raster_band(path)
            if needs_drainage:
                if drainage_graph is None:
                    drainage_graph, manholes, drains = build_drainage_graph()
                    compute_hydraulic_capacity(drainage_graph, drains)
                window_drainage = drainage_graph.copy()
                runoff_volume, m_per_deg_lat = compute_runoff_volume(rainfall_grid, built, valid, transform)
                couple_rainfall_to_drainage(
                    window_drainage, rainfall_grid, runoff_volume, lon, lat, valid,
                    duration_minutes=minutes,
                )
                compute_surcharge(window_drainage)
                export_drainage_status(window_drainage, manholes, drains, key)
                surface_indicator = compute_surface_flood_indicator(
                    window_drainage, dem.shape, lon, lat, valid, m_per_deg_lat
                )
                integrated_risk = integrate_flood_risk(fsi, surface_indicator)
                save_raster(integrated_risk, valid, transform, crs, integrated_path,
                            'integrated_flood_risk_fsi_plus_drainage')
                print(f'{event} nowcast {minutes} min integrated risk: '
                      f'{_summary(integrated_risk, valid)}', flush=True)
            if graph is not None:
                graph_path = config.nowcast_road_graph_pickle(event, minutes)
                if (force or not graph_path.exists() or
                        graph_path.stat().st_mtime < integrated_path.stat().st_mtime):
                    weighted, _ = attach_flood_risk(graph.copy(), roads_crs, integrated_path,
                                                  raster_in_memory=True,
                                                  sampling_cache=sampling_cache)
                    save_graph(weighted, graph_path)
            manifest["windows"].append({
                "minutes": minutes, "start_time": reference.isoformat(),
                "drainage_model_version": 2,
                "end_time": (reference + pd.Timedelta(minutes=minutes)).isoformat(),
            })
            reports[event]["base_fsi"][str(minutes)] = _summary(fsi, valid)
            integrated_risk, _ = load_raster_band(integrated_path)
            reports[event]["fsi"][str(minutes)] = _summary(integrated_risk, valid)
        manifest_path = config.DATA_PROCESSED_DIR / f"nowcast_event_windows_{event}.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        report_path = config.DATA_PROCESSED_DIR / f"nowcast_validation_{event}.json"
        report_path.write_text(json.dumps(reports[event], indent=2), encoding="utf-8")
        print(f"Saved leakage-safe nowcast outputs for {event} from {reference.isoformat()}")
    return reports


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event-date")
    parser.add_argument("--without-routing", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    run(args.event_date, with_routing=not args.without_routing, force=args.force)

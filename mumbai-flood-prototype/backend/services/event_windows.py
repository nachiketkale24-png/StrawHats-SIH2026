"""Resolve precomputed historical intervals without doing live FSI computation."""
import json
import re
from enum import Enum, IntEnum
from pipeline import config

class WindowMinutes(IntEnum):
    FIFTEEN = 15
    THIRTY = 30
    SIXTY = 60
    NINETY = 90
    ONE_TWENTY = 120
    ONE_EIGHTY = 180


class RainfallSource(str, Enum):
    """Observed future replay is comparison-only; nowcast is model-driven."""
    OBSERVED = "observed"
    NOWCAST = "nowcast"


def get_windows(event_date, rainfall_source: RainfallSource = RainfallSource.OBSERVED):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", event_date):
        raise FileNotFoundError("Unknown event date")
    source = RainfallSource(rainfall_source)
    prefix = "nowcast_event_windows" if source is RainfallSource.NOWCAST else "event_windows"
    path = config.DATA_PROCESSED_DIR / f"{prefix}_{event_date}.json"
    if not path.exists():
        return {"event_date": event_date, "rainfall_source": source.value, "windows": []}
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["rainfall_source"] = source.value
    # Observed comparison windows retain their historic route-ready contract.
    # A model nowcast FSI map remains useful before its optional forecast road
    # graph finishes deriving, so it is selectable as soon as the raster exists.
    key_prefix = "nowcast_" if source is RainfallSource.NOWCAST else ""
    manifest["windows"] = [window for window in manifest["windows"]
        if (
            config.flood_risk_tif(f"{key_prefix}{event_date}_{window['minutes']}min").exists()
            and (source is RainfallSource.NOWCAST or
                 config.road_graph_pickle(f"{key_prefix}{event_date}_{window['minutes']}min").exists())
        )]
    return manifest


def event_key(event_date, window_minutes=None, rainfall_source: RainfallSource = RainfallSource.OBSERVED):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", event_date):
        raise FileNotFoundError("Unknown event date")
    source = RainfallSource(rainfall_source)
    if window_minutes is None:
        if source is RainfallSource.NOWCAST:
            raise FileNotFoundError("Nowcast outputs require a 15–180 minute window")
        return event_date
    key = f"{'nowcast_' if source is RainfallSource.NOWCAST else ''}{event_date}_{window_minutes}min"
    # FSI maps can be inspected before optional road attribution completes.
    # Route requests separately require their graph and will correctly return 404
    # until it is generated.
    if not config.flood_risk_tif(key).exists():
        raise FileNotFoundError(f"No precomputed {source.value} {window_minutes}-minute output for {event_date}")
    return key

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.services.flood_service import flood_service
from backend.schemas import EventInfo
from backend.services.event_windows import RainfallSource, WindowMinutes, event_key, get_windows

router = APIRouter(prefix="/flood", tags=["flood"])


@router.get("/events", response_model=list[str])
def list_events(rainfall_source: RainfallSource = RainfallSource.OBSERVED):
    """List dates for explicitly selected observed or model-nowcast outputs."""
    return flood_service.list_available_events(rainfall_source)


@router.get("/summary/{event_date}", response_model=EventInfo)
def get_summary(event_date: str, window_minutes: WindowMinutes | None = None,
                rainfall_source: RainfallSource = RainfallSource.OBSERVED):
    try:
        summary = flood_service.get_summary(event_key(event_date, window_minutes, rainfall_source))
        summary['event_date'] = event_date
        return EventInfo(**summary)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/raster/{event_date}")
def get_raster(event_date: str, window_minutes: WindowMinutes | None = None,
               rainfall_source: RainfallSource = RainfallSource.OBSERVED):
    """Serves the raw FSI GeoTIFF — point a tile server (e.g. titiler) at this for the map layer."""
    try:
        path = flood_service.get_raster_path(event_key(event_date, window_minutes, rainfall_source))
        return FileResponse(path, media_type="image/tiff")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/coverage-mask")
def get_coverage_mask():
    """Station-network coverage: 1 = interpolated (inside hull), 0 = extrapolated."""
    try:
        path = flood_service.get_coverage_path()
        return FileResponse(path, media_type="image/tiff")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/point/{event_date}")
def get_point_value(event_date: str, lon: float, lat: float, window_minutes: WindowMinutes | None = None,
                    rainfall_source: RainfallSource = RainfallSource.OBSERVED):
    """Returns the FSI value at a specific map-click coordinate."""
    try:
        value = flood_service.sample_at_point(event_key(event_date, window_minutes, rainfall_source), lon, lat)
        in_network = flood_service.sample_coverage(lon, lat)
        payload = {"event_date": event_date, "lon": lon, "lat": lat, "fsi": value}
        if in_network is not None:
            payload["in_station_network"] = in_network
        return payload
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get('/windows/{event_date}')
def list_windows(event_date: str, rainfall_source: RainfallSource = RainfallSource.OBSERVED):
    """Return completed observed-comparison or model-nowcast intervals."""
    try:
        return get_windows(event_date, rainfall_source)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

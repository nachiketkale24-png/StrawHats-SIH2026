from fastapi import APIRouter, HTTPException

from backend.services.drainage_service import drainage_service
from backend.services.event_windows import RainfallSource, WindowMinutes


router = APIRouter(prefix="/drainage", tags=["drainage"])


@router.get("/{event_id}")
def get_drainage(event_id: str, full: bool = False,
                 window_minutes: WindowMinutes | None = None,
                 rainfall_source: RainfallSource = RainfallSource.OBSERVED):
    try:
        return drainage_service.get_status(event_id, full=full,
                                           window_minutes=window_minutes,
                                           rainfall_source=rainfall_source)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

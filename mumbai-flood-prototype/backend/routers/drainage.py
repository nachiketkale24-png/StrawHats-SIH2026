from fastapi import APIRouter, HTTPException

from backend.services.drainage_service import drainage_service


router = APIRouter(prefix="/drainage", tags=["drainage"])


@router.get("/{event_id}")
def get_drainage(event_id: str, full: bool = False):
    try:
        return drainage_service.get_status(event_id, full=full)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

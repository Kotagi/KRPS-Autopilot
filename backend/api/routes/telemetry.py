from fastapi import APIRouter, HTTPException

from backend.models.navball import NavballSourceStatus, NavballSourceUpdate
from backend.services.telemetry_service import telemetry_service

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.get("/navball-source", response_model=NavballSourceStatus)
def get_navball_source() -> NavballSourceStatus:
    return telemetry_service.get_navball_source_status()


@router.put("/navball-source", response_model=NavballSourceStatus)
async def set_navball_source(update: NavballSourceUpdate) -> NavballSourceStatus:
    if update.source not in ("krpc", "krps"):
        raise HTTPException(status_code=400, detail="source must be 'krpc' or 'krps'")
    return await telemetry_service.set_navball_source(update.source)


@router.get("/krps-debug")
def get_krps_debug() -> dict:
    return telemetry_service.get_krps_debug_report()

from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import require_flight
from backend.core.exceptions import VesselControlError
from backend.models.vessel import ToggleRequest, VesselControlsState, VesselPointRequest
from backend.services.telemetry_service import telemetry_service
from backend.services.vessel_service import VesselService

router = APIRouter(prefix="/api/vessel", tags=["vessel"])
vessel_service = VesselService()


def _handle_vessel_error(exc: Exception) -> HTTPException:
    message = str(exc)
    if "staging" in message.lower() or "locked" in message.lower():
        return HTTPException(status_code=409, detail=message)
    return HTTPException(status_code=500, detail=message)


@router.get("/controls", response_model=VesselControlsState)
def get_controls(_: None = Depends(require_flight)) -> VesselControlsState:
    return vessel_service.get_controls()


@router.post("/stage", response_model=VesselControlsState)
async def stage(_: None = Depends(require_flight)) -> VesselControlsState:
    try:
        controls = vessel_service.stage()
        await telemetry_service.broadcast("vessel_controls", controls.model_dump())
        return controls
    except VesselControlError as exc:
        raise _handle_vessel_error(exc) from exc


@router.post("/sas", response_model=VesselControlsState)
async def set_sas(
    body: ToggleRequest, _: None = Depends(require_flight)
) -> VesselControlsState:
    controls = vessel_service.set_sas(body.enabled)
    await telemetry_service.broadcast("vessel_controls", controls.model_dump())
    return controls


@router.post("/rcs", response_model=VesselControlsState)
async def set_rcs(
    body: ToggleRequest, _: None = Depends(require_flight)
) -> VesselControlsState:
    controls = vessel_service.set_rcs(body.enabled)
    await telemetry_service.broadcast("vessel_controls", controls.model_dump())
    return controls


@router.post("/lights", response_model=VesselControlsState)
async def set_lights(
    body: ToggleRequest, _: None = Depends(require_flight)
) -> VesselControlsState:
    controls = vessel_service.set_lights(body.enabled)
    await telemetry_service.broadcast("vessel_controls", controls.model_dump())
    return controls


@router.post("/point", response_model=VesselControlsState)
async def point_to(
    body: VesselPointRequest,
    _: None = Depends(require_flight),
) -> VesselControlsState:
    try:
        controls = vessel_service.point_to(body.mode)
        await telemetry_service.broadcast("vessel_controls", controls.model_dump())
        return controls
    except VesselControlError as exc:
        raise _handle_vessel_error(exc) from exc

import asyncio

from fastapi import APIRouter, Body, Depends, HTTPException

from backend.api.deps import require_flight
from backend.core.exceptions import PhaseConflictError
from backend.core.exceptions import MechJebNotReadyError
from backend.models.ascent import AscentConfig, AscentStatus, LaunchToTargetPlaneRequest
from backend.phases.instances import ascent_phase
from backend.services.telemetry_service import telemetry_service

router = APIRouter(prefix="/api/ascent", tags=["ascent"])


@router.post("/configure", response_model=AscentStatus)
async def configure(
    config: AscentConfig, _: None = Depends(require_flight)
) -> AscentStatus:
    try:
        ascent_phase.configure(config)
        status = ascent_phase.get_status()
        await telemetry_service.broadcast_ascent(status)
        return status
    except Exception as exc:
        await telemetry_service.broadcast_error(str(exc), "ascent")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/start", response_model=AscentStatus)
async def start(
    config: AscentConfig | None = Body(default=None),
    _: None = Depends(require_flight),
) -> AscentStatus:
    try:
        status = await ascent_phase.start(config)
        await telemetry_service.broadcast_ascent(status)
        return status
    except PhaseConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        await telemetry_service.broadcast_error(str(exc), "ascent")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/launch-to-target-plane", response_model=AscentStatus)
async def launch_to_target_plane(
    body: LaunchToTargetPlaneRequest | None = Body(default=None),
    _: None = Depends(require_flight),
) -> AscentStatus:
    try:
        request = body or LaunchToTargetPlaneRequest()
        status = await ascent_phase.launch_to_target_plane(
            request.config,
            request.launch_lan_difference_deg,
        )
        await telemetry_service.broadcast_ascent(status)
        return status
    except PhaseConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except MechJebNotReadyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        await telemetry_service.broadcast_error(str(exc), "ascent")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/abort", response_model=AscentStatus)
async def abort(_: None = Depends(require_flight)) -> AscentStatus:
    ascent_phase.abort()
    status = ascent_phase.get_status()
    await telemetry_service.broadcast_ascent(status)
    return status


@router.get("/status", response_model=AscentStatus)
def status() -> AscentStatus:
    return ascent_phase.get_status()


@router.get("/live", response_model=AscentConfig)
def live(_: None = Depends(require_flight)) -> AscentConfig:
    try:
        return ascent_phase.read_live_config()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

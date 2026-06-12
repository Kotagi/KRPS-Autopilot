from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import require_flight
from backend.models.target import SelectTargetRequest, TargetStatus, TargetTree
from backend.services.target_service import target_service
from backend.services.telemetry_service import telemetry_service

router = APIRouter(prefix="/api/targets", tags=["targets"])


@router.get("/tree", response_model=TargetTree)
def get_tree(_: None = Depends(require_flight)) -> TargetTree:
    try:
        return target_service.get_tree()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/current", response_model=TargetStatus)
def get_current(_: None = Depends(require_flight)) -> TargetStatus:
    try:
        return target_service.get_status()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/select", response_model=TargetStatus)
async def select_target(
    body: SelectTargetRequest, _: None = Depends(require_flight)
) -> TargetStatus:
    try:
        status = target_service.select_target(body.id)
        await telemetry_service.broadcast_target(status)
        return status
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        await telemetry_service.broadcast_error(str(exc), "target")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/clear", response_model=TargetStatus)
async def clear_target(_: None = Depends(require_flight)) -> TargetStatus:
    try:
        status = target_service.clear_target()
        await telemetry_service.broadcast_target(status)
        return status
    except Exception as exc:
        await telemetry_service.broadcast_error(str(exc), "target")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

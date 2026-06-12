import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import require_flight
from backend.core.connection import game_connection
from backend.core.exceptions import MechJebNotReadyError, PhaseConflictError
from backend.models.maneuver import (
    ManeuverExecuteRequest,
    ManeuverFineTunePreview,
    ManeuverFineTuneRequest,
    ManeuverFineTuneResult,
    ManeuverNodeSummary,
    ManeuverNodeToleranceRequest,
    ManeuverOperationSpec,
    ManeuverPlanRequest,
    ManeuverPlanResult,
    ManeuverStatus,
)
from backend.phases.instances import maneuver_phase
from backend.services.maneuver_service import maneuver_service
from backend.services.telemetry_service import telemetry_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/maneuver", tags=["maneuver"])





@router.get("/operations", response_model=list[ManeuverOperationSpec])

def operations() -> list[ManeuverOperationSpec]:

    return maneuver_service.list_operations()





@router.get("/nodes")

def nodes(_: None = Depends(require_flight)) -> list[dict]:

    return [node.model_dump() for node in maneuver_service.list_nodes()]


@router.patch("/nodes/{node_index}/tolerance", response_model=ManeuverNodeSummary)
async def set_node_tolerance(
    node_index: int,
    request: ManeuverNodeToleranceRequest,
    _: None = Depends(require_flight),
) -> ManeuverNodeSummary:
    try:
        return await asyncio.to_thread(
            game_connection.run_sync,
            maneuver_service.set_node_tolerance,
            node_index,
            request.tolerance_ms,
        )
    except MechJebNotReadyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/nodes/default-tolerance")
async def set_default_tolerance(
    request: ManeuverNodeToleranceRequest,
    _: None = Depends(require_flight),
) -> dict[str, float]:
    try:
        tolerance = await asyncio.to_thread(
            game_connection.run_sync,
            maneuver_service.set_default_tolerance,
            request.tolerance_ms,
        )
        return {"default_tolerance_ms": tolerance}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc





@router.get("/fine-tune/preview", response_model=ManeuverFineTunePreview)
async def fine_tune_preview(
    node_index: int = 0,
    _: None = Depends(require_flight),
) -> ManeuverFineTunePreview:
    try:
        return await asyncio.to_thread(
            game_connection.run_sync,
            maneuver_service.preview_fine_tune,
            node_index,
        )
    except MechJebNotReadyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/fine-tune", response_model=ManeuverFineTuneResult)
async def fine_tune(
    request: ManeuverFineTuneRequest,
    _: None = Depends(require_flight),
) -> ManeuverFineTuneResult:
    try:
        result = await asyncio.to_thread(
            game_connection.run_sync,
            maneuver_phase.fine_tune,
            request,
        )
        await telemetry_service.broadcast_maneuver(maneuver_phase.get_status())
        return result
    except PhaseConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except MechJebNotReadyError as exc:
        logger.warning("Fine-tune rejected: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        logger.warning("Fine-tune rejected: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Fine-tune failed")
        await telemetry_service.broadcast_error(str(exc), "maneuver")
        raise HTTPException(status_code=500, detail=str(exc)) from exc





@router.post("/plan", response_model=ManeuverPlanResult)

async def plan(

    request: ManeuverPlanRequest,

    _: None = Depends(require_flight),

) -> ManeuverPlanResult:

    try:

        result = await asyncio.to_thread(maneuver_phase.plan, request)

        await telemetry_service.broadcast_maneuver(maneuver_phase.get_status())

        return result

    except PhaseConflictError as exc:

        raise HTTPException(status_code=409, detail=str(exc)) from exc

    except MechJebNotReadyError as exc:

        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:

        await telemetry_service.broadcast_error(str(exc), "maneuver")

        raise HTTPException(status_code=500, detail=str(exc)) from exc





@router.delete("/nodes")

async def clear_nodes(_: None = Depends(require_flight)) -> dict[str, int]:

    try:

        removed = await asyncio.to_thread(maneuver_phase.clear_nodes)

        await telemetry_service.broadcast_maneuver(maneuver_phase.get_status())

        return {"removed": removed}

    except PhaseConflictError as exc:

        raise HTTPException(status_code=409, detail=str(exc)) from exc

    except Exception as exc:

        raise HTTPException(status_code=500, detail=str(exc)) from exc





@router.post("/execute", response_model=ManeuverStatus)

async def execute(

    request: ManeuverExecuteRequest | None = None,

    _: None = Depends(require_flight),

) -> ManeuverStatus:

    try:

        status = await maneuver_phase.start(request)

        await telemetry_service.broadcast_maneuver(status)

        return status

    except PhaseConflictError as exc:

        raise HTTPException(status_code=409, detail=str(exc)) from exc

    except MechJebNotReadyError as exc:

        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:

        await telemetry_service.broadcast_error(str(exc), "maneuver")

        raise HTTPException(status_code=500, detail=str(exc)) from exc





@router.post("/abort", response_model=ManeuverStatus)

async def abort(_: None = Depends(require_flight)) -> ManeuverStatus:

    maneuver_phase.abort()

    status = maneuver_phase.get_status()

    await telemetry_service.broadcast_maneuver(status)

    return status





@router.get("/status", response_model=ManeuverStatus)

def status() -> ManeuverStatus:

    return maneuver_phase.get_status()



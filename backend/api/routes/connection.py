from fastapi import APIRouter, HTTPException

from backend.core.exceptions import KspConnectionError
from backend.models.connection import ConnectionStatus
from backend.services.game_service import GameService

router = APIRouter(prefix="/api/connection", tags=["connection"])
game_service = GameService()


@router.post("/connect", response_model=ConnectionStatus)
def connect() -> ConnectionStatus:
    try:
        return game_service.connect()
    except KspConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/disconnect", response_model=ConnectionStatus)
def disconnect() -> ConnectionStatus:
    return game_service.disconnect()


@router.get("/status", response_model=ConnectionStatus)
def status() -> ConnectionStatus:
    return game_service.get_status()

from fastapi import HTTPException

from backend.core.connection import game_connection
from backend.core.exceptions import MechJebNotReadyError, NotConnectedError


def require_connected() -> None:
    if not game_connection.is_connected():
        raise HTTPException(status_code=503, detail="Not connected to kRPC")


def require_flight() -> None:
    try:
        game_connection.require_flight()
    except NotConnectedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except MechJebNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def require_ready() -> None:
    try:
        game_connection.require_ready()
    except NotConnectedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except MechJebNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

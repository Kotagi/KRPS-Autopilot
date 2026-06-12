from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.telemetry_service import telemetry_service

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await telemetry_service.connect_client(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        telemetry_service.disconnect_client(websocket)

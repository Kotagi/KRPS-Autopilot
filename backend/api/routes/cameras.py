import asyncio
import logging

from fastapi import APIRouter, Request
from fastapi.responses import Response, StreamingResponse

from backend.config import JRTI_STREAM_CHUNK_SIZE
from backend.models.camera import CameraDebugResponse, CameraListResponse, CameraStreamDebugEntry
from backend.services.camera_stream_registry import camera_stream_registry
from backend.services.jrti_service import jrti_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


@router.get("", response_model=CameraListResponse)
def list_cameras() -> CameraListResponse:
    return jrti_service.list_cameras()


@router.get("/debug", response_model=CameraDebugResponse)
def camera_debug() -> CameraDebugResponse:
    camera_list = jrti_service.list_cameras()
    proxy_streams = camera_stream_registry.snapshot()
    return CameraDebugResponse(
        active_proxy_streams=camera_stream_registry.active_count(),
        proxy_streams=[CameraStreamDebugEntry(**entry) for entry in proxy_streams],
        jrti_total_viewers=sum(camera.viewer_count for camera in camera_list.cameras),
        cameras=camera_list.cameras,
    )


@router.get("/{camera_id}/stream")
async def stream_camera(camera_id: int, request: Request) -> StreamingResponse:
    stream_id = camera_stream_registry.start(camera_id)
    handle = jrti_service.open_camera_stream(camera_id)

    async def generate():
        client_disconnected = False
        try:
            while True:
                if await request.is_disconnected():
                    client_disconnected = True
                    break
                try:
                    chunk = await asyncio.to_thread(handle.read, JRTI_STREAM_CHUNK_SIZE)
                except Exception as exc:
                    logger.warning(
                        "camera proxy stream read error camera_id=%s: %s",
                        camera_id,
                        exc,
                    )
                    break
                if not chunk:
                    break
                yield chunk
        finally:
            handle.close()
            reason = "client_disconnect" if client_disconnected else "upstream_closed"
            camera_stream_registry.end(stream_id, reason=reason)

    return StreamingResponse(generate(), media_type=handle.content_type)


@router.get("/{camera_id}/snapshot")
def snapshot_camera(camera_id: int) -> Response:
    payload, content_type = jrti_service.get_camera_snapshot(camera_id)
    return Response(content=payload, media_type=content_type)

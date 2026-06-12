from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse

from backend.models.camera import CameraListResponse
from backend.services.jrti_service import jrti_service

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


@router.get("", response_model=CameraListResponse)
def list_cameras() -> CameraListResponse:
    return jrti_service.list_cameras()


@router.get("/{camera_id}/stream")
def stream_camera(camera_id: int) -> StreamingResponse:
    stream, content_type = jrti_service.iter_camera_stream(camera_id)
    return StreamingResponse(stream, media_type=content_type)


@router.get("/{camera_id}/snapshot")
def snapshot_camera(camera_id: int) -> Response:
    payload, content_type = jrti_service.get_camera_snapshot(camera_id)
    return Response(content=payload, media_type=content_type)

import json
import logging
import urllib.error
import urllib.request
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse

from backend.config import JRTI_BASE_URL, JRTI_CAMERAS_PATH
from backend.models.camera import CameraListResponse, CameraSummary

logger = logging.getLogger(__name__)

_JRTI_TIMEOUT_S = 2.0
_JRTI_STREAM_TIMEOUT_S = 10.0
_JRTI_STREAM_CHUNK_SIZE = 8192


class JrtiService:
    def list_cameras(self) -> CameraListResponse:
        url = f"{JRTI_BASE_URL}{JRTI_CAMERAS_PATH}"
        try:
            request = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(request, timeout=_JRTI_TIMEOUT_S) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            logger.debug("JRTI camera list unavailable: %s", exc)
            return CameraListResponse(
                available=False,
                cameras=[],
                error=(
                    "Just Read The Instructions stream server is not reachable. "
                    "Load a craft into flight with Hullcam cameras and ensure JRTI is installed."
                ),
            )
        except (json.JSONDecodeError, OSError, TimeoutError, ValueError) as exc:
            logger.debug("JRTI camera list parse failed: %s", exc)
            return CameraListResponse(
                available=False,
                cameras=[],
                error="Received an invalid response from the JRTI camera service.",
            )

        if not isinstance(payload, list):
            return CameraListResponse(
                available=True,
                cameras=[],
                error="JRTI returned an unexpected camera list format.",
            )

        cameras: list[CameraSummary] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            camera_id = item.get("id")
            if camera_id is None:
                continue
            try:
                camera_id_int = int(camera_id)
            except (TypeError, ValueError):
                continue

            name = str(item.get("name") or f"Camera {camera_id_int}")
            cameras.append(
                CameraSummary(
                    id=camera_id_int,
                    name=name,
                    streaming=bool(item.get("streaming")),
                    viewer_count=int(item.get("viewerCount") or 0),
                    snapshot_url=f"/api/cameras/{camera_id_int}/snapshot",
                    stream_url=f"/api/cameras/{camera_id_int}/stream",
                )
            )

        cameras.sort(key=lambda camera: (camera.name.lower(), camera.id))
        return CameraListResponse(available=True, cameras=cameras)

    def iter_camera_stream(self, camera_id: int) -> tuple[Iterator[bytes], str]:
        url = f"{JRTI_BASE_URL}/camera/{camera_id}/stream"
        try:
            request = urllib.request.Request(url, method="GET")
            response = urllib.request.urlopen(request, timeout=_JRTI_STREAM_TIMEOUT_S)
        except urllib.error.HTTPError as exc:
            raise HTTPException(
                status_code=exc.code,
                detail=f"Camera {camera_id} stream is unavailable.",
            ) from exc
        except urllib.error.URLError as exc:
            raise HTTPException(
                status_code=503,
                detail="Just Read The Instructions stream server is not reachable.",
            ) from exc

        content_type = response.headers.get(
            "Content-Type",
            "multipart/x-mixed-replace; boundary=jrtiboundary",
        )

        def generate() -> Iterator[bytes]:
            try:
                while True:
                    chunk = response.read(_JRTI_STREAM_CHUNK_SIZE)
                    if not chunk:
                        break
                    yield chunk
            finally:
                response.close()

        return generate(), content_type

    def get_camera_snapshot(self, camera_id: int) -> tuple[bytes, str]:
        url = f"{JRTI_BASE_URL}/camera/{camera_id}/snapshot"
        try:
            request = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(request, timeout=_JRTI_TIMEOUT_S) as response:
                payload = response.read()
                content_type = response.headers.get("Content-Type", "image/jpeg")
        except urllib.error.HTTPError as exc:
            raise HTTPException(
                status_code=exc.code,
                detail=f"Camera {camera_id} snapshot is unavailable.",
            ) from exc
        except urllib.error.URLError as exc:
            raise HTTPException(
                status_code=503,
                detail="Just Read The Instructions stream server is not reachable.",
            ) from exc

        return payload, content_type


jrti_service = JrtiService()

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ActiveCameraStream:
    stream_id: str
    camera_id: int
    started_monotonic: float = field(default_factory=time.monotonic)


class CameraStreamRegistry:
    """Tracks in-flight MJPEG proxy streams for diagnostics and leak detection."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._streams: dict[str, ActiveCameraStream] = {}

    def start(self, camera_id: int) -> str:
        stream_id = uuid.uuid4().hex[:12]
        entry = ActiveCameraStream(stream_id=stream_id, camera_id=camera_id)
        with self._lock:
            self._streams[stream_id] = entry
            active = len(self._streams)
        logger.info(
            "camera proxy stream opened camera_id=%s stream_id=%s active=%s",
            camera_id,
            stream_id,
            active,
        )
        if active > 2:
            logger.warning(
                "multiple concurrent camera proxy streams active=%s (possible leak)",
                active,
            )
        return stream_id

    def end(self, stream_id: str, *, reason: str) -> None:
        with self._lock:
            entry = self._streams.pop(stream_id, None)
            active = len(self._streams)
        if entry is None:
            return
        elapsed_s = time.monotonic() - entry.started_monotonic
        logger.info(
            "camera proxy stream closed camera_id=%s stream_id=%s reason=%s "
            "duration_s=%.1f active=%s",
            entry.camera_id,
            stream_id,
            reason,
            elapsed_s,
            active,
        )

    def snapshot(self) -> list[dict[str, object]]:
        now = time.monotonic()
        with self._lock:
            entries = list(self._streams.values())
        return [
            {
                "stream_id": entry.stream_id,
                "camera_id": entry.camera_id,
                "age_s": round(now - entry.started_monotonic, 1),
            }
            for entry in entries
        ]

    def active_count(self) -> int:
        with self._lock:
            return len(self._streams)


camera_stream_registry = CameraStreamRegistry()

from pydantic import BaseModel, Field


class CameraSummary(BaseModel):
    id: int
    name: str
    streaming: bool = False
    viewer_count: int = 0
    snapshot_url: str | None = None
    stream_url: str | None = None


class CameraListResponse(BaseModel):
    available: bool = False
    source: str = "jrti"
    cameras: list[CameraSummary] = Field(default_factory=list)
    error: str | None = None


class CameraStreamDebugEntry(BaseModel):
    stream_id: str
    camera_id: int
    age_s: float


class CameraDebugResponse(BaseModel):
    active_proxy_streams: int
    proxy_streams: list[CameraStreamDebugEntry]
    jrti_total_viewers: int
    cameras: list[CameraSummary]

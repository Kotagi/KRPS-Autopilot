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

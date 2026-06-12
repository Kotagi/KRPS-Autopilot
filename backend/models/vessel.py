from pydantic import BaseModel, Field

from backend.models.flight_deck import VesselDeltaV, VesselTelemetry

__all__ = [
    "ToggleRequest",
    "VesselControlsState",
    "VesselDeltaV",
    "VesselTelemetry",
]


class VesselControlsState(BaseModel):
    sas: bool
    rcs: bool
    lights: bool
    throttle: float = Field(ge=0.0, le=1.0)
    current_stage: int


class ToggleRequest(BaseModel):
    enabled: bool

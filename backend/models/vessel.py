from enum import Enum

from pydantic import BaseModel, Field

from backend.models.flight_deck import VesselDeltaV, VesselTelemetry

__all__ = [
    "ToggleRequest",
    "VesselControlsState",
    "VesselDeltaV",
    "VesselPointMode",
    "VesselPointRequest",
    "VesselTelemetry",
]


class VesselPointMode(str, Enum):
    prograde = "prograde"
    retrograde = "retrograde"
    normal = "normal"
    anti_normal = "anti_normal"
    radial = "radial"
    anti_radial = "anti_radial"
    maneuver = "maneuver"
    target = "target"
    anti_target = "anti_target"
    stability_assist = "stability_assist"


class VesselControlsState(BaseModel):
    sas: bool
    rcs: bool
    lights: bool
    throttle: float = Field(ge=0.0, le=1.0)
    current_stage: int
    sas_mode: VesselPointMode | None = None


class ToggleRequest(BaseModel):
    enabled: bool


class VesselPointRequest(BaseModel):
    mode: VesselPointMode

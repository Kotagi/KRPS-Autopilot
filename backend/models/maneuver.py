from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.models.ascent import PhaseState


class ManeuverOperationId(str, Enum):
    circularize = "circularize"
    apoapsis = "apoapsis"
    periapsis = "periapsis"
    ellipticize = "ellipticize"
    semi_major = "semi_major"
    inclination = "inclination"
    longitude = "longitude"
    lan = "lan"
    plane = "plane"
    transfer = "transfer"
    interplanetary_transfer = "interplanetary_transfer"
    kill_rel_vel = "kill_rel_vel"
    lambert = "lambert"
    course_correction = "course_correction"
    moon_return = "moon_return"
    resonant_orbit = "resonant_orbit"


class TimeReferenceId(str, Enum):
    computed = "computed"
    x_from_now = "x_from_now"
    apoapsis = "apoapsis"
    periapsis = "periapsis"
    altitude = "altitude"
    eq_ascending = "eq_ascending"
    eq_descending = "eq_descending"
    rel_ascending = "rel_ascending"
    rel_descending = "rel_descending"
    closest_approach = "closest_approach"
    eq_highest_ad = "eq_highest_ad"
    eq_nearest_ad = "eq_nearest_ad"
    rel_highest_ad = "rel_highest_ad"
    rel_nearest_ad = "rel_nearest_ad"


ExecuteMode = Literal["one", "all"]


class ManeuverParamSpec(BaseModel):
    name: str
    label: str
    kind: Literal["altitude_km", "degrees", "seconds", "meters", "bool", "int", "float"]
    default: float | int | bool | None = None
    min: float | None = None
    max: float | None = None


class ManeuverOperationSpec(BaseModel):
    id: ManeuverOperationId
    label: str
    description: str
    timed: bool
    needs_target: bool
    params: list[ManeuverParamSpec] = Field(default_factory=list)


class ManeuverPlanRequest(BaseModel):
    operation: ManeuverOperationId
    clear_existing: bool = True
    time_reference: TimeReferenceId = TimeReferenceId.computed
    lead_time_s: float | None = None
    circularize_altitude_km: float | None = None
    params: dict[str, Any] = Field(default_factory=dict)


class ManeuverNodeSummary(BaseModel):
    ut: float
    delta_v_ms: float
    remaining_delta_v_ms: float
    time_to_s: float
    tolerance_ms: float = 0.5


class ManeuverNodeToleranceRequest(BaseModel):
    tolerance_ms: float = 0.5


class ManeuverPlanResult(BaseModel):
    operation: ManeuverOperationId
    nodes_created: int
    warning: str | None = None
    nodes: list[ManeuverNodeSummary]


class ManeuverExecuteRequest(BaseModel):
    mode: ExecuteMode = "all"
    tolerance: float | None = None
    autowarp: bool = True
    lead_time_s: float = 3.0


class ManeuverStatus(BaseModel):
    state: PhaseState = PhaseState.idle
    executor_enabled: bool = False
    node_count: int = 0
    next_node_ut: float | None = None
    next_node_time_to_s: float | None = None
    last_operation: ManeuverOperationId | None = None
    last_error: str | None = None
    last_warning: str | None = None


class ManeuverEncounterSummary(BaseModel):
    body_name: str
    pe_km: float
    pe_m: float


TuneMode = Literal["intercept_pe", "closest_approach"]


class ManeuverFineTunePreview(BaseModel):
    node_index: int
    node_count: int
    orbit_body: str | None = None
    time_to_soi_s: float | None = None
    next_soi_body: str | None = None
    resolved_target: str | None = None
    encounters: list[ManeuverEncounterSummary] = Field(default_factory=list)
    orbit_description: str | None = None
    tune_mode: TuneMode | None = None
    approach_altitude_km: float | None = None
    approach_altitude_m: float | None = None
    miss_distance_km: float | None = None
    can_tune: bool = False


class ManeuverFineTuneRequest(BaseModel):
    desired_pe_km: float = 100.0
    node_index: int = 0
    target_body_name: str | None = None
    tolerance_km: float = 1.0
    max_iterations: int = 250
    max_prograde_delta_ms: float = 2000.0


class ManeuverFineTuneResult(BaseModel):
    success: bool
    target_body_name: str | None = None
    initial_pe_km: float | None = None
    final_pe_km: float | None = None
    initial_pe_m: float | None = None
    final_pe_m: float | None = None
    desired_pe_km: float
    iterations: int = 0
    initial_prograde_ms: float | None = None
    final_prograde_ms: float | None = None
    delta_prograde_ms: float | None = None
    initial_normal_ms: float | None = None
    final_normal_ms: float | None = None
    delta_normal_ms: float | None = None
    initial_radial_ms: float | None = None
    final_radial_ms: float | None = None
    delta_radial_ms: float | None = None
    axes_adjusted: list[str] = Field(default_factory=list)
    tune_mode: TuneMode | None = None
    message: str | None = None
    nodes: list[ManeuverNodeSummary] = Field(default_factory=list)

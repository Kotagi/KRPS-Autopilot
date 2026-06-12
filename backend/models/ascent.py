from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class PhaseState(str, Enum):
    idle = "idle"
    configuring = "configuring"
    running = "running"
    completed = "completed"
    aborted = "aborted"
    error = "error"


AscentPath = Literal["classic", "gt", "pvg"]
ASCENT_PATH_INDEX: dict[AscentPath, int] = {"classic": 0, "gt": 1, "pvg": 2}
INDEX_TO_ASCENT_PATH: dict[int, AscentPath] = {0: "classic", 1: "gt", 2: "pvg"}


class ClassicPathConfig(BaseModel):
    turn_start_altitude_km: float = 0.5
    turn_start_velocity_ms: float = 100.0
    turn_end_altitude_km: float = 60.0
    turn_end_angle_deg: float = 0.0
    turn_shape_exponent: float = 40.0
    auto_path: bool = True
    auto_turn_percent: float = 0.05
    auto_turn_speed_factor: float = 18.5


class GTPathConfig(BaseModel):
    turn_start_altitude_km: float = 0.5
    turn_start_velocity_ms: float = 50.0
    turn_start_pitch_deg: float = 25.0
    intermediate_altitude_km: float = 45.0
    hold_ap_time_s: float = 1.0


class PVGPathConfig(BaseModel):
    target_periapsis_km: float = 250.0
    target_apoapsis_km: float = 250.0
    attach_altitude_km: float = 0.0
    attach_alt_enabled: bool = False
    pitch_start_velocity_ms: float = 50.0
    pitch_rate_deg_per_s: float = 0.5
    q_trigger_kpa: float = 10.0
    pvg_after_stage: int = 1
    pvg_after_stage_enabled: bool = False
    fixed_coast: bool = False
    fixed_coast_length_s: float = 0.0


class AscentConfig(BaseModel):
    desired_orbit_altitude_km: float = 100.0
    desired_inclination_deg: float = 0.0
    launch_lan_difference_deg: float = 0.0
    ascent_path: AscentPath = "pvg"
    autostage: bool = True
    force_roll: bool = True
    vertical_roll: float = 90.0
    turn_roll: float = 90.0
    classic: ClassicPathConfig = Field(default_factory=ClassicPathConfig)
    gt: GTPathConfig = Field(default_factory=GTPathConfig)
    pvg: PVGPathConfig = Field(default_factory=PVGPathConfig)


class LaunchToTargetPlaneRequest(BaseModel):
    config: AscentConfig | None = None
    launch_lan_difference_deg: float | None = None


class AscentStatus(BaseModel):
    state: PhaseState = PhaseState.idle
    enabled: bool = False
    mj_status: str = ""
    launch_mode: str = "normal"
    configured: bool = False
    last_error: str | None = None
    ascent_path: AscentPath | None = None
    desired_orbit_altitude_km: float | None = None
    desired_inclination_deg: float | None = None


class AscentStartResponse(BaseModel):
    task_id: str = "ascent"

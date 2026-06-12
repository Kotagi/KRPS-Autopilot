from pydantic import BaseModel, Field


class VesselDeltaV(BaseModel):
    current_stage: int = 0
    stage_vac_ms: float = 0.0
    total_vac_ms: float = 0.0
    surface_twr: float = 0.0


class VesselTelemetry(BaseModel):
    vessel_name: str
    situation: str
    orbit_body: str | None = None

    altitude_m: float
    surface_altitude_m: float = 0.0
    apoapsis_m: float
    periapsis_m: float
    inclination_deg: float = 0.0
    eccentricity: float = 0.0
    orbital_speed_ms: float = 0.0
    surface_speed_ms: float = 0.0
    vertical_speed_ms: float = 0.0

    pitch_deg: float = 0.0
    heading_deg: float = 0.0
    roll_deg: float = 0.0
    surface_rotation: tuple[float, float, float, float] = Field(
        default=(0.0, 0.0, 0.0, 1.0)
    )
    angle_of_attack_deg: float = 0.0
    sideslip_angle_deg: float = 0.0

    dynamic_pressure_pa: float = 0.0
    mach: float = 0.0
    g_force: float = 0.0

    time_to_apoapsis_s: float | None = None
    time_to_periapsis_s: float | None = None
    time_to_soi_s: float | None = None

    prograde: tuple[float, float, float] = Field(default=(0.0, 0.0, 1.0))
    maneuver_node_count: int = 0
    next_node_time_to_s: float | None = None

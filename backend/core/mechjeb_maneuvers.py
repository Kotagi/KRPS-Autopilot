"""MechJeb Maneuver Planner operation catalog and kRPC bindings."""

from typing import Any

from backend.core.mechjeb_units import altitude_km_to_m
from backend.models.maneuver import (
    ManeuverOperationId,
    ManeuverOperationSpec,
    ManeuverParamSpec,
    ManeuverPlanRequest,
    TimeReferenceId,
)
from backend.models.target import TargetType

TARGET_OPERATIONS = {
    ManeuverOperationId.plane,
    ManeuverOperationId.transfer,
    ManeuverOperationId.interplanetary_transfer,
    ManeuverOperationId.kill_rel_vel,
    ManeuverOperationId.lambert,
    ManeuverOperationId.course_correction,
}

PLANNER_TIMED_OPERATIONS = {
    ManeuverOperationId.circularize,
    ManeuverOperationId.apoapsis,
    ManeuverOperationId.periapsis,
    ManeuverOperationId.ellipticize,
    ManeuverOperationId.semi_major,
    ManeuverOperationId.inclination,
    ManeuverOperationId.longitude,
    ManeuverOperationId.lan,
    ManeuverOperationId.plane,
    ManeuverOperationId.transfer,
    ManeuverOperationId.kill_rel_vel,
    ManeuverOperationId.lambert,
    ManeuverOperationId.resonant_orbit,
    ManeuverOperationId.course_correction,
    ManeuverOperationId.interplanetary_transfer,
    ManeuverOperationId.moon_return,
}

# Backwards-compatible alias used by specs and tests.
TIMED_OPERATIONS = PLANNER_TIMED_OPERATIONS

OPERATION_SPECS: list[ManeuverOperationSpec] = [
    ManeuverOperationSpec(
        id=ManeuverOperationId.circularize,
        label="Circularize",
        description="Circularize at the selected orbit point.",
        timed=True,
        needs_target=False,
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.apoapsis,
        label="Change apoapsis",
        description="Set a new apoapsis altitude.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="new_apoapsis_km",
                label="New apoapsis (km)",
                kind="altitude_km",
                default=100.0,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.periapsis,
        label="Change periapsis",
        description="Set a new periapsis altitude.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="new_periapsis_km",
                label="New periapsis (km)",
                kind="altitude_km",
                default=100.0,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.ellipticize,
        label="Ellipticize",
        description="Set both apoapsis and periapsis.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="new_apoapsis_km",
                label="New apoapsis (km)",
                kind="altitude_km",
                default=250.0,
            ),
            ManeuverParamSpec(
                name="new_periapsis_km",
                label="New periapsis (km)",
                kind="altitude_km",
                default=150.0,
            ),
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.semi_major,
        label="Semi-major axis",
        description="Change the orbit semi-major axis.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="new_semi_major_axis_km",
                label="New SMA (km)",
                kind="altitude_km",
                default=500.0,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.inclination,
        label="Inclination",
        description="Change orbital inclination.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="new_inclination_deg",
                label="New inclination (deg)",
                kind="degrees",
                default=0.0,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.longitude,
        label="Surface longitude",
        description="Change surface longitude of an apsis.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="new_surface_longitude_deg",
                label="Longitude (deg)",
                kind="degrees",
                default=0.0,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.lan,
        label="LAN",
        description="Change longitude of ascending node.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="new_lan_deg",
                label="LAN (deg)",
                kind="degrees",
                default=0.0,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.plane,
        label="Match target plane",
        description="Match orbital plane with the locked target.",
        timed=True,
        needs_target=True,
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.transfer,
        label="Transfer",
        description="Bi-impulsive transfer to the locked target.",
        timed=True,
        needs_target=True,
        params=[
            ManeuverParamSpec(
                name="simple_transfer",
                label="Simple Hohmann",
                kind="bool",
                default=False,
            ),
            ManeuverParamSpec(
                name="intercept_only",
                label="Intercept only",
                kind="bool",
                default=False,
            ),
            ManeuverParamSpec(
                name="period_offset",
                label="Period offset",
                kind="float",
                default=0.0,
            ),
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.interplanetary_transfer,
        label="Interplanetary transfer",
        description="Transfer to a locked planet or body.",
        timed=True,
        needs_target=True,
        params=[
            ManeuverParamSpec(
                name="wait_for_phase_angle",
                label="Wait for phase angle",
                kind="bool",
                default=True,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.kill_rel_vel,
        label="Kill relative velocity",
        description="Match velocities with the locked target.",
        timed=True,
        needs_target=True,
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.lambert,
        label="Lambert intercept",
        description="Intercept the target at a chosen time.",
        timed=True,
        needs_target=True,
        params=[
            ManeuverParamSpec(
                name="intercept_interval_s",
                label="Intercept interval (s)",
                kind="seconds",
                default=3600.0,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.course_correction,
        label="Course correction",
        description=(
            "Fine-tune closest approach to the target. "
            "Body targets use final Pe/A; vessel targets use closest approach distance."
        ),
        timed=True,
        needs_target=True,
        params=[
            ManeuverParamSpec(
                name="intercept_distance_m",
                label="Closest approach distance (m)",
                kind="meters",
                default=50.0,
                for_target_type="vessel",
            ),
            ManeuverParamSpec(
                name="course_correct_final_pe_a_km",
                label="Final Pe/A (km)",
                kind="altitude_km",
                default=200.0,
                for_target_type="body",
            ),
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.moon_return,
        label="Moon return",
        description="Return from a moon SOI to the parent body.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="moon_return_altitude_km",
                label="Return altitude (km)",
                kind="altitude_km",
                default=100.0,
            )
        ],
    ),
    ManeuverOperationSpec(
        id=ManeuverOperationId.resonant_orbit,
        label="Resonant orbit",
        description="Set up a resonant orbit ratio.",
        timed=True,
        needs_target=False,
        params=[
            ManeuverParamSpec(
                name="resonance_numerator",
                label="Resonance numerator",
                kind="int",
                default=2,
            ),
            ManeuverParamSpec(
                name="resonance_denominator",
                label="Resonance denominator",
                kind="int",
                default=1,
            ),
        ],
    ),
]

OPERATION_SPEC_BY_ID = {spec.id: spec for spec in OPERATION_SPECS}


def get_operation_spec(operation_id: ManeuverOperationId) -> ManeuverOperationSpec:
    return OPERATION_SPEC_BY_ID[operation_id]


def get_planner_operation(planner: Any, operation_id: ManeuverOperationId) -> Any:
    return getattr(planner, f"operation_{operation_id.value}")


def _apply_time_selector(
    time_selector: Any,
    mechjeb: Any,
    request: ManeuverPlanRequest,
) -> None:
    time_ref = getattr(mechjeb.TimeReference, request.time_reference.value)
    time_selector.time_reference = time_ref

    if request.time_reference == TimeReferenceId.x_from_now:
        lead = request.lead_time_s if request.lead_time_s is not None else 60.0
        time_selector.lead_time = float(lead)
    elif request.lead_time_s is not None:
        time_selector.lead_time = float(request.lead_time_s)

    if request.circularize_altitude_km is not None:
        time_selector.circularize_altitude = altitude_km_to_m(
            request.circularize_altitude_km
        )


def _set_param(operation: Any, attr: str, value: Any) -> None:
    setattr(operation, attr, value)


def apply_operation_params(
    operation: Any,
    operation_id: ManeuverOperationId,
    request: ManeuverPlanRequest,
    target_type: TargetType = "none",
) -> None:
    params = request.params

    if operation_id == ManeuverOperationId.apoapsis:
        _set_param(
            operation,
            "new_apoapsis",
            altitude_km_to_m(float(params.get("new_apoapsis_km", 100.0))),
        )
    elif operation_id == ManeuverOperationId.periapsis:
        _set_param(
            operation,
            "new_periapsis",
            altitude_km_to_m(float(params.get("new_periapsis_km", 100.0))),
        )
    elif operation_id == ManeuverOperationId.ellipticize:
        _set_param(
            operation,
            "new_apoapsis",
            altitude_km_to_m(float(params.get("new_apoapsis_km", 250.0))),
        )
        _set_param(
            operation,
            "new_periapsis",
            altitude_km_to_m(float(params.get("new_periapsis_km", 150.0))),
        )
    elif operation_id == ManeuverOperationId.semi_major:
        _set_param(
            operation,
            "new_semi_major_axis",
            altitude_km_to_m(float(params.get("new_semi_major_axis_km", 500.0))),
        )
    elif operation_id == ManeuverOperationId.inclination:
        _set_param(
            operation,
            "new_inclination",
            float(params.get("new_inclination_deg", 0.0)),
        )
    elif operation_id == ManeuverOperationId.longitude:
        _set_param(
            operation,
            "new_surface_longitude",
            float(params.get("new_surface_longitude_deg", 0.0)),
        )
    elif operation_id == ManeuverOperationId.lan:
        _set_param(operation, "new_lan", float(params.get("new_lan_deg", 0.0)))
    elif operation_id == ManeuverOperationId.transfer:
        _set_param(
            operation,
            "simple_transfer",
            bool(params.get("simple_transfer", False)),
        )
        _set_param(
            operation,
            "intercept_only",
            bool(params.get("intercept_only", False)),
        )
        _set_param(
            operation,
            "period_offset",
            float(params.get("period_offset", 0.0)),
        )
    elif operation_id == ManeuverOperationId.interplanetary_transfer:
        _set_param(
            operation,
            "wait_for_phase_angle",
            bool(params.get("wait_for_phase_angle", True)),
        )
    elif operation_id == ManeuverOperationId.lambert:
        _set_param(
            operation,
            "intercept_interval",
            float(params.get("intercept_interval_s", 3600.0)),
        )
    elif operation_id == ManeuverOperationId.course_correction:
        if target_type == "body":
            _set_param(
                operation,
                "course_correct_final_pe_a",
                altitude_km_to_m(float(params.get("course_correct_final_pe_a_km", 200.0))),
            )
        else:
            _set_param(
                operation,
                "intercept_distance",
                float(params.get("intercept_distance_m", 50.0)),
            )
    elif operation_id == ManeuverOperationId.moon_return:
        _set_param(
            operation,
            "moon_return_altitude",
            altitude_km_to_m(float(params.get("moon_return_altitude_km", 100.0))),
        )
    elif operation_id == ManeuverOperationId.resonant_orbit:
        _set_param(
            operation,
            "resonance_numerator",
            int(params.get("resonance_numerator", 2)),
        )
        _set_param(
            operation,
            "resonance_denominator",
            int(params.get("resonance_denominator", 1)),
        )


def configure_operation(
    planner: Any,
    mechjeb: Any,
    request: ManeuverPlanRequest,
    target_type: TargetType = "none",
) -> Any:
    operation = get_planner_operation(planner, request.operation)
    apply_operation_params(operation, request.operation, request, target_type)
    time_selector = getattr(operation, "time_selector", None)
    if time_selector is not None:
        _apply_time_selector(time_selector, mechjeb, request)
    return operation

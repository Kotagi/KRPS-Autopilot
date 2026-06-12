"""Run API smoke checks. Full acceptance requires KSP + kRPC + MechJeb running."""

import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"


def call(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        f"{BASE}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            payload = response.read().decode("utf-8")
            return response.status, json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(payload)
        except json.JSONDecodeError:
            return exc.code, payload


def main() -> int:
    print("KPRS Autopilot acceptance check")
    print("=" * 40)

    status, health = call("GET", "/api/health")
    print(f"[{'OK' if status == 200 else 'FAIL'}] health: {health}")
    if status != 200:
        return 1

    status, conn_status = call("GET", "/api/connection/status")
    print(f"[{'OK' if status == 200 else 'FAIL'}] connection status: {conn_status}")

    status, connect_result = call("POST", "/api/connection/connect")
    live = status == 200
    print(
        f"[{'OK' if live else 'SKIP'}] connect: {connect_result} "
        "(requires KSP + kRPC + KRPC.MechJeb)"
    )
    if not live:
        print("\nStart KSP with kRPC server and KRPC.MechJeb, then rerun.")
        return 0

    for path, label in [
        ("/api/vessel/controls", "vessel controls"),
        ("/api/ascent/status", "ascent status"),
    ]:
        status, result = call("GET", path)
        print(f"[{'OK' if status == 200 else 'FAIL'}] {label}: {result}")

    status, live = call("GET", "/api/ascent/live")
    print(f"[{'OK' if status == 200 else 'FAIL'}] ascent live read: {live}")

    status, ascent = call(
        "POST",
        "/api/ascent/configure",
        {
            "desired_orbit_altitude_km": 100,
            "desired_inclination_deg": 6,
            "ascent_path": "pvg",
            "autostage": True,
            "force_roll": True,
            "vertical_roll": 90,
            "turn_roll": 90,
            "classic": {
                "turn_start_altitude_km": 0.5,
                "turn_start_velocity_ms": 100,
                "turn_end_altitude_km": 60,
                "turn_end_angle_deg": 0,
                "turn_shape_exponent": 40.0,
                "auto_path": True,
                "auto_turn_percent": 0.05,
                "auto_turn_speed_factor": 18.5,
            },
            "gt": {
                "turn_start_altitude_km": 0.5,
                "turn_start_velocity_ms": 50,
                "turn_start_pitch_deg": 25,
                "intermediate_altitude_km": 45,
                "hold_ap_time_s": 1,
            },
            "pvg": {
                "target_periapsis_km": 250,
                "target_apoapsis_km": 250,
                "attach_altitude_km": 0,
                "attach_alt_enabled": False,
                "pitch_start_velocity_ms": 50,
                "pitch_rate_deg_per_s": 0.5,
                "q_trigger_kpa": 10,
                "pvg_after_stage": 1,
                "pvg_after_stage_enabled": False,
                "fixed_coast": False,
                "fixed_coast_length_s": 0,
            },
        },
    )
    print(f"[{'OK' if status == 200 else 'FAIL'}] configure ascent: {ascent}")

    print("\nManual steps remaining:")
    print("1. Start Ascent in UI")
    print("2. Stage to launch")
    print("3. Verify orbit completion and abort on second flight")
    return 0


if __name__ == "__main__":
    sys.exit(main())

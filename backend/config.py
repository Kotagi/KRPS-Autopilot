from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

# Canonical KSP install for KPRS Autopilot testing (RSS 1.12.4).
KSP_ROOT = Path.home() / "OneDrive" / "Desktop" / "Kerbal" / "Kerbal Space Program Sol RSS 1.12.4"

HOST = "127.0.0.1"
PORT = 8000

KRPC_ADDRESS = "127.0.0.1"
KRPC_RPC_PORT = 50000
KRPC_STREAM_PORT = 50001
KRPC_CLIENT_NAME = "KPRS Autopilot"

API_READY_TIMEOUT_S = 30.0
# kRPC stream update rate for navball attitude fields (Hz).
NAVBALL_STREAM_RATE = 60
# Target WebSocket broadcast rate for navball telemetry (Hz).
TELEMETRY_FAST_INTERVAL_S = 1.0 / NAVBALL_STREAM_RATE
# Poll SAS/RCS/throttle every N fast ticks (controls change rarely).
CONTROLS_POLL_EVERY_N_FAST_TICKS = 6
# Emit aggregated telemetry timing stats to autopilot-server.log (seconds).
TELEMETRY_DEBUG_LOG_INTERVAL_S = 5.0
# Log any single telemetry phase slower than this threshold (milliseconds).
TELEMETRY_DEBUG_SLOW_PHASE_MS = 50.0
# Slow loop: orbit resources, phases, connection status.
TELEMETRY_SLOW_INTERVAL_S = 1.0

# KRPS in-game plugin telemetry (TCP newline-delimited JSON).
KRPS_ADDRESS = "127.0.0.1"
KRPS_PORT = 50002
KRPS_RECONNECT_INTERVAL_S = 1.0

# Just Read The Instructions Hullcam stream server (in-game HTTP).
JRTI_HOST = "127.0.0.1"
JRTI_PORT = 8080
JRTI_BASE_URL = f"http://{JRTI_HOST}:{JRTI_PORT}"
JRTI_CAMERAS_PATH = "/cameras"

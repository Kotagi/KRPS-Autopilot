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
# Fast loop: attitude + controls for navball (20 Hz).
TELEMETRY_FAST_INTERVAL_S = 0.05
# Slow loop: orbit resources, phases, connection status.
TELEMETRY_SLOW_INTERVAL_S = 1.0

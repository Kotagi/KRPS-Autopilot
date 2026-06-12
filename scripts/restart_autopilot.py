"""Stop, rebuild if needed, and restart the KPRS Autopilot server."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.autopilot_server import restart  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Restart KPRS Autopilot")
    parser.add_argument(
        "--build",
        action="store_true",
        help="Force a frontend rebuild even when dist looks up to date",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Restart the server without opening a browser tab",
    )
    args = parser.parse_args()

    restart(force_build=args.build, open_browser=not args.no_browser)


if __name__ == "__main__":
    main()

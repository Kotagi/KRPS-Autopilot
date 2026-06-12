"""Start the autopilot server and optionally open the browser."""

import argparse
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from backend.config import HOST, PORT


def open_browser() -> None:
    time.sleep(1.5)
    webbrowser.open(f"http://{HOST}:{PORT}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run KPRS Autopilot server")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open a browser tab on startup",
    )
    args = parser.parse_args()

    if not args.no_browser:
        threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=False)

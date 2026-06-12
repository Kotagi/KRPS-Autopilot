"""Shared helpers to stop, build, and start the KPRS Autopilot server."""

from __future__ import annotations

import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
DIST_INDEX = FRONTEND / "dist" / "index.html"
VENV_PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"

sys.path.insert(0, str(ROOT))
from backend.config import HOST, PORT  # noqa: E402


def kill_server(port: int = PORT) -> None:
    """Stop any process listening on the autopilot port."""
    if sys.platform == "win32":
        try:
            result = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    (
                        f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue "
                        "| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force "
                        "-ErrorAction SilentlyContinue }"
                    ),
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                return
        except Exception:
            pass

        subprocess.run(
            [
                "cmd",
                "/c",
                f'for /f "tokens=5" %a in (\'netstat -ano ^| findstr /R /C:":{port} .*LISTENING"\') '
                f"do taskkill /PID %a /F >nul 2>&1",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        return

    subprocess.run(
        ["sh", "-c", f"lsof -ti :{port} | xargs -r kill -9"],
        check=False,
        capture_output=True,
        text=True,
    )


def frontend_needs_build() -> bool:
    """True when dist is missing or any frontend source file is newer."""
    if not DIST_INDEX.exists():
        return True

    dist_mtime = DIST_INDEX.stat().st_mtime
    src_root = FRONTEND / "src"
    if not src_root.exists():
        return False

    for path in src_root.rglob("*"):
        if path.is_file() and path.stat().st_mtime > dist_mtime:
            return True
    return False


def build_frontend() -> None:
    """Run the production frontend build."""
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    node_modules = FRONTEND / "node_modules"
    if not node_modules.exists():
        subprocess.run([npm, "install"], cwd=FRONTEND, check=True, shell=False)
    subprocess.run([npm, "run", "build"], cwd=FRONTEND, check=True, shell=False)


def python_executable() -> Path:
    if VENV_PYTHON.exists():
        return VENV_PYTHON
    return Path(sys.executable)


def start_server(*, open_browser: bool = True, wait_ready: bool = True) -> subprocess.Popen:
    """Launch uvicorn in a detached process and optionally open the UI."""
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)

    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

    log_path = ROOT / "autopilot-server.log"
    log_file = open(log_path, "a", encoding="utf-8")

    proc = subprocess.Popen(
        [str(python_executable()), str(ROOT / "scripts" / "dev.py"), "--no-browser"],
        cwd=ROOT,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        creationflags=creationflags,
        close_fds=True,
    )

    if wait_ready:
        _wait_for_server()

    if open_browser:
        webbrowser.open(f"http://{HOST}:{PORT}")

    return proc


def _wait_for_server(timeout_s: float = 20.0) -> None:
    import urllib.error
    import urllib.request

    url = f"http://{HOST}:{PORT}/api/health"
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.25)
    raise TimeoutError(f"Autopilot did not become ready on port {PORT} within {timeout_s}s")


def restart(*, force_build: bool = False, open_browser: bool = True) -> None:
    """Stop the current server, rebuild frontend if needed, and start again."""
    kill_server()
    time.sleep(0.5)

    if force_build or frontend_needs_build():
        print("Building frontend...")
        build_frontend()

    print(f"Starting autopilot on http://{HOST}:{PORT} ...")
    start_server(open_browser=open_browser)
    print("Autopilot restarted.")

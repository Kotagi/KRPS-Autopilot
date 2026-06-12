@echo off
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    python -m venv .venv
    call .venv\Scripts\pip install -r requirements.txt
)

.venv\Scripts\python scripts\restart_autopilot.py
if errorlevel 1 exit /b 1

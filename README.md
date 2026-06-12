# KPRS Autopilot

Local mission control for Kerbal Space Program via kRPC and MechJeb.

**Test KSP install:** `Kerbal Space Program Sol RSS 1.12.4`  
(`C:\Users\brand\OneDrive\Desktop\Kerbal\Kerbal Space Program Sol RSS 1.12.4`)

Use this install for kRPC, MechJeb, and `KPRS.AutopilotBridge.dll` — not the stock 1.12.3 folder.

## Prerequisites

| Component | Version |
|-----------|---------|
| KSP | 1.12 |
| kRPC | 0.5.4 |
| MechJeb 2 | 2.14.3.0 |
| kRPC.MechJeb | 0.7.0 |
| Python | 3.11+ |
| Node.js | 20 LTS |

Install kRPC.MechJeb by copying `KRPC.MechJeb.dll` to `GameData/kRPC/`.

Also install the KPRS bridge (fixes Sync from MechJeb for MechJeb 2.14 target Pe/Ap):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_ksp_bridge.ps1
```

Installs to `GameData/kRPC/KPRS.AutopilotBridge.dll` in the RSS install above. Restart KSP so kRPC loads it.

### Troubleshooting: connect fails / MechJeb not found

If connect fails and the error mentions `mechjeb`, first confirm KRPC.MechJeb is loaded in KSP (you should see `MechJeb` in the kRPC service list when the game starts).

If the DLL is already in `GameData/kRPC/`:

1. **Restart KSP completely** after adding the DLL.
2. Start the kRPC server in-game.
3. Be in **flight** with an active vessel (MechJeb `api_ready` is false in the space center / VAB).

If `MechJeb` does not appear in kRPC at all:

1. Install [MechJeb 2](https://www.curseforge.com/kerbal/ksp-mods/mechjeb).
2. Download [KRPC.MechJeb 0.7.0](https://github.com/Genhis/KRPC.MechJeb/releases).
3. Copy `KRPC.MechJeb.dll` to `Kerbal Space Program/GameData/kRPC/`.

Version compatibility for 0.7.0: KSP 1.12, kRPC 0.5.4, MechJeb 2.14.3.0.

## Quick Start

1. Start KSP, load a save, place a vessel on the launch pad with MechJeb installed.
2. Start the kRPC server in-game (green icon).
3. Double-click `Start_Autopilot.bat`.
4. Click **Connect** in the browser UI.

## Development

### Backend only

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend dev server (with API proxy)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — API and WebSocket requests proxy to port 8000.

### Production build

```powershell
cd frontend
npm run build
.venv\Scripts\python scripts\dev.py
```

## V1 Features

- Connect/disconnect to kRPC
- Vessel controls: stage, SAS, RCS, lights
- MechJeb Ascent Guidance: configure, start, abort, live status
- Live telemetry via WebSocket

## Operator Workflow

1. Connect to kRPC.
2. Configure ascent (altitude, inclination, path).
3. Click **Start Ascent** to enable MechJeb.
4. Click **Stage** to launch.
5. MechJeb flies the ascent; status updates live until complete.

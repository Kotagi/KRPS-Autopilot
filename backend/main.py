import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.api.routes import ascent, cameras, connection, maneuver, map, target, telemetry, vessel, ws
from backend.config import FRONTEND_DIST
from backend.core.async_utils import set_main_loop
from backend.core.connection import game_connection
from backend.core.krps_client import krps_client
from backend.phases.instances import ascent_phase, maneuver_phase
from backend.phases.registry import PhaseRegistry
from backend.services.telemetry_service import telemetry_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

phase_registry = PhaseRegistry()


@asynccontextmanager
async def lifespan(_: FastAPI):
    set_main_loop(asyncio.get_running_loop())
    phase_registry.register(ascent_phase)
    phase_registry.register(maneuver_phase)
    yield
    await krps_client.stop()
    game_connection.disconnect()


app = FastAPI(title="KPRS Autopilot", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cameras.router)
app.include_router(connection.router)
app.include_router(telemetry.router)
app.include_router(vessel.router)
app.include_router(target.router)
app.include_router(ascent.router)
app.include_router(maneuver.router)
app.include_router(map.router)
app.include_router(ws.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")

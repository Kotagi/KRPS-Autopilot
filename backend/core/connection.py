import threading
import time
from collections.abc import Callable
from typing import Any, TypeVar

import krpc

from backend.config import (
    API_READY_TIMEOUT_S,
    KRPC_ADDRESS,
    KRPC_CLIENT_NAME,
    KRPC_RPC_PORT,
    KRPC_STREAM_PORT,
)
from backend.core.exceptions import KspConnectionError, MechJebNotReadyError, NotConnectedError


T = TypeVar("T")


class GameConnection:
    """Single owner of the kRPC client session."""

    def __init__(self) -> None:
        self._conn: Any | None = None
        self._space_center: Any | None = None
        self._mechjeb: Any | None = None
        self._krpc_lock = threading.Lock()

    def run_sync(self, fn: Callable[..., T], /, *args: Any, **kwargs: Any) -> T:
        """Run a kRPC-touching callable on the single client lock."""
        with self._krpc_lock:
            return fn(*args, **kwargs)

    @property
    def conn(self) -> Any:
        if self._conn is None:
            raise NotConnectedError("Not connected to kRPC")
        return self._conn

    @property
    def space_center(self) -> Any:
        self.require_connected()
        return self._space_center

    @property
    def mechjeb(self) -> Any:
        self.require_connected()
        return self._mechjeb

    def is_connected(self) -> bool:
        return self._conn is not None

    def is_api_ready(self) -> bool:
        if not self.is_connected():
            return False
        try:
            return bool(self._mechjeb.api_ready)
        except Exception:
            return False

    def connect(self, name: str = KRPC_CLIENT_NAME) -> None:
        # Always tear down any existing session so kRPC does not accumulate clients.
        if self.is_connected():
            self.disconnect()
        try:
            self._conn = krpc.connect(
                name=name,
                address=KRPC_ADDRESS,
                rpc_port=KRPC_RPC_PORT,
                stream_port=KRPC_STREAM_PORT,
            )
            self._space_center = self._conn.space_center
            self._mechjeb = self._resolve_mechjeb_service(self._conn)
        except KspConnectionError:
            self._reset()
            raise
        except Exception as exc:
            self._reset()
            raise KspConnectionError(f"Failed to connect to kRPC: {exc}") from exc

    def disconnect(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
        self._reset()

    def _reset(self) -> None:
        self._conn = None
        self._space_center = None
        self._mechjeb = None

    @staticmethod
    def _resolve_mechjeb_service(conn: Any) -> Any:
        services = conn.krpc.get_services().services
        names = [service.name for service in services]
        if "MechJeb" not in names:
            raise KspConnectionError(
                "kRPC.MechJeb is not installed in KSP. "
                "Download release 0.7.0 from https://github.com/Genhis/KRPC.MechJeb/releases "
                "and copy KRPC.MechJeb.dll into GameData/kRPC/. "
                "Also ensure MechJeb 2 is installed. "
                f"Available kRPC services: {', '.join(names)}"
            )
        # Python kRPC client exposes the MechJeb service as conn.mech_jeb
        # (snake_case of "MechJeb"). Docs show mj.ascent_autopilot on that object.
        mech_jeb = getattr(conn, "mech_jeb", None)
        if mech_jeb is None:
            raise KspConnectionError(
                "MechJeb service is registered in kRPC but unavailable to the Python client. "
                "Restart KSP after installing KRPC.MechJeb."
            )
        return mech_jeb

    def wait_api_ready(self, timeout: float = API_READY_TIMEOUT_S) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.is_api_ready():
                return True
            time.sleep(0.25)
        return False

    def require_connected(self) -> None:
        if not self.is_connected():
            raise NotConnectedError("Not connected to kRPC")

    def require_flight(self) -> None:
        """Require kRPC link and an active vessel (launch pad counts as flight)."""
        self.require_connected()
        try:
            self._space_center.active_vessel
        except Exception as exc:
            raise MechJebNotReadyError(
                "No active vessel. Load a craft to the launch pad or into flight."
            ) from exc

    def require_ready(self) -> None:
        self.require_flight()
        if not self.is_api_ready():
            raise MechJebNotReadyError(
                "MechJeb api_ready is false. This is normal on the launch pad; "
                "ascent and vessel controls should still work."
            )

    def active_vessel(self) -> Any:
        self.require_connected()
        return self._space_center.active_vessel

    def get_scene(self) -> str:
        if not self.is_connected():
            return "unknown"
        try:
            return str(self._conn.krpc.get_status().game_scene)
        except Exception:
            return "unknown"


game_connection = GameConnection()

"""MechJeb controls that kRPC.MechJeb does not expose correctly on MechJeb 2.14+."""

from typing import Any

from backend.core.connection import GameConnection
from backend.core.exceptions import MechJebNotReadyError

ASCENT_AP_TOGGLE_ACTION = "Ascent AP toggle"


def get_mechjeb_core_module(game: GameConnection) -> Any:
    """Return a MechJebCore part module on the active vessel."""
    vessel = game.active_vessel()
    for part in vessel.parts.all:
        for module in part.modules:
            if module.name == "MechJebCore":
                return module
    raise MechJebNotReadyError("No MechJebCore module found on the active vessel")


def trigger_ascent_ap_toggle(game: GameConnection) -> None:
    """Toggle MechJeb ascent guidance (same as the in-game Engage/Disengage button)."""
    core = get_mechjeb_core_module(game)
    if not core.has_action(ASCENT_AP_TOGGLE_ACTION):
        raise MechJebNotReadyError(
            f"MechJeb action {ASCENT_AP_TOGGLE_ACTION!r} is not available on this vessel"
        )
    core.set_action(ASCENT_AP_TOGGLE_ACTION, True)


def set_ascent_autopilot_engaged(game: GameConnection, engaged: bool, currently_engaged: bool) -> bool:
    """Idempotently engage or disengage ascent guidance. Returns the new engaged state."""
    if currently_engaged == engaged:
        return engaged
    trigger_ascent_ap_toggle(game)
    return engaged

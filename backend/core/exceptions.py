class AutopilotError(Exception):
    """Base exception for autopilot errors."""


class KspConnectionError(AutopilotError):
    """Failed to connect to kRPC server."""


class MechJebNotReadyError(AutopilotError):
    """MechJeb API is not ready (wrong scene or vessel switch)."""


class NotConnectedError(AutopilotError):
    """No active kRPC connection."""


class PhaseConflictError(AutopilotError):
    """Phase is already running or in an invalid state."""


class VesselControlError(AutopilotError):
    """Vessel control operation failed."""

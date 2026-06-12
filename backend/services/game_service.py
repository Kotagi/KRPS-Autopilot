from backend.core.connection import GameConnection, game_connection
from backend.core.exceptions import KspConnectionError
from backend.models.connection import ConnectionStatus


class GameService:
    def __init__(self, game: GameConnection = game_connection) -> None:
        self._game = game

    def connect(self) -> ConnectionStatus:
        from backend.services.telemetry_service import telemetry_service

        telemetry_service.reset_telemetry_state()
        try:
            self._game.connect()
        except KspConnectionError:
            raise
        # Link to kRPC immediately; MechJeb may become ready once in flight.
        self._game.wait_api_ready(timeout=2.0)
        return self.get_status()

    def disconnect(self) -> ConnectionStatus:
        from backend.services.telemetry_service import telemetry_service

        telemetry_service.reset_telemetry_state()
        self._game.disconnect()
        return self.get_status()

    def get_status(self) -> ConnectionStatus:
        connected = self._game.is_connected()
        api_ready = self._game.is_api_ready() if connected else False
        vessel_name = None
        situation = None
        if connected:
            try:
                vessel = self._game.active_vessel()
                vessel_name = vessel.name
                sit = vessel.situation
                situation = sit.name if hasattr(sit, "name") else str(sit)
            except Exception:
                pass
        return ConnectionStatus(
            connected=connected,
            api_ready=api_ready,
            vessel_name=vessel_name,
            situation=situation,
            scene=self._game.get_scene(),
        )

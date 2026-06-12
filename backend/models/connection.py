from pydantic import BaseModel


class ConnectionStatus(BaseModel):
    connected: bool
    api_ready: bool
    vessel_name: str | None = None
    situation: str | None = None
    scene: str = "unknown"

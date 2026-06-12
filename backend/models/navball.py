from typing import Literal

from pydantic import BaseModel

NavballSource = Literal["krpc", "krps"]


class NavballSourceStatus(BaseModel):
    source: NavballSource
    krps_connected: bool
    krpc_connected: bool


class NavballSourceUpdate(BaseModel):
    source: NavballSource

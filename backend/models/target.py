from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class TargetKind(str, Enum):
    star = "star"
    planet = "planet"
    moon = "moon"
    asteroid = "asteroid"
    vessel = "vessel"


TargetType = Literal["none", "body", "vessel"]


class TargetNode(BaseModel):
    id: str
    name: str
    kind: TargetKind
    parent_id: str | None = None
    selectable: bool = True
    orbit_body: str | None = None
    children: list["TargetNode"] = Field(default_factory=list)


class TargetTree(BaseModel):
    roots: list[TargetNode] = Field(default_factory=list)
    active_vessel_name: str | None = None


class TargetStatus(BaseModel):
    target_type: TargetType = "none"
    id: str | None = None
    name: str | None = None
    kind: TargetKind | None = None
    orbit_body: str | None = None
    distance_m: float | None = None
    mechjeb_locked: bool = False


class SelectTargetRequest(BaseModel):
    id: str


class TargetFilterCounts(BaseModel):
    star: int = 0
    planet: int = 0
    moon: int = 0
    asteroid: int = 0
    vessel: int = 0

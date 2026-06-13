from pydantic import BaseModel, Field


class StageFuel(BaseModel):
    """Fuel remaining for one propulsion stack."""

    group_id: str
    stage_number: int
    label: str
    percent: float = Field(ge=0.0, le=100.0)
    fuel_remaining: float = Field(ge=0.0)
    fuel_capacity: float = Field(ge=0.0)
    is_active: bool = False
    has_engine: bool = False


class StageFuelSnapshot(BaseModel):
    vessel_name: str
    current_stage: int
    stages: list[StageFuel]

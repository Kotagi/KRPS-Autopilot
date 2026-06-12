from collections import defaultdict
from typing import Any

from backend.core.connection import GameConnection, game_connection
from backend.models.resources import StageFuel, StageFuelSnapshot

FUEL_RESOURCES = ("LiquidFuel", "Oxidizer", "SolidFuel")


def _stack_decouple_stage(part: Any) -> int:
    current = part
    while current is not None:
        decoupler = getattr(current, "decoupler", None)
        if decoupler is not None:
            stage = int(current.decouple_stage)
            if stage >= 0:
                return stage
        current = current.parent
    return -1


def _part_fuel(part: Any) -> tuple[float, float]:
    amount = 0.0
    capacity = 0.0
    try:
        resources = part.resources
    except Exception:
        return amount, capacity

    for name in FUEL_RESOURCES:
        if name not in resources.names:
            continue
        max_amount = float(resources.max(name))
        if max_amount <= 0:
            continue
        amount += float(resources.amount(name))
        capacity += max_amount
    return amount, capacity


class ResourceService:
    def __init__(self, game: GameConnection = game_connection) -> None:
        self._game = game

    def get_stage_fuels(self) -> StageFuelSnapshot:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        parts = vessel.parts
        current_stage = int(vessel.control.current_stage)

        fuel_by_stack: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0])
        engines_by_stack: dict[int, list[Any]] = defaultdict(list)

        for part in parts.all:
            amount, capacity = _part_fuel(part)
            if capacity <= 0:
                continue
            stack_id = _stack_decouple_stage(part)
            fuel_by_stack[stack_id][0] += amount
            fuel_by_stack[stack_id][1] += capacity

        for engine in parts.engines:
            stack_id = _stack_decouple_stage(engine.part)
            engines_by_stack[stack_id].append(engine)

        stages: list[StageFuel] = []
        for stack_id, totals in fuel_by_stack.items():
            amount, capacity = totals
            if capacity <= 0:
                continue

            stack_engines = engines_by_stack.get(stack_id, [])
            stage_numbers = [int(engine.part.stage) for engine in stack_engines]
            stage_number = max(stage_numbers) if stage_numbers else stack_id
            is_active = any(bool(engine.active) for engine in stack_engines)
            percent = max(0.0, min(100.0, (amount / capacity) * 100.0))

            if stack_id < 0:
                label = "AUX" if not stage_numbers else f"S{max(stage_numbers)}"
            else:
                label = f"S{stage_number}" if stage_number >= 0 else f"D{stack_id}"

            stages.append(
                StageFuel(
                    stage_number=stage_number,
                    label=label,
                    percent=percent,
                    fuel_remaining=amount,
                    fuel_capacity=capacity,
                    is_active=is_active,
                    has_engine=bool(stack_engines),
                )
            )

        stages.sort(key=lambda item: item.stage_number, reverse=True)

        return StageFuelSnapshot(
            vessel_name=str(vessel.name),
            current_stage=current_stage,
            stages=stages,
        )


resource_service = ResourceService()

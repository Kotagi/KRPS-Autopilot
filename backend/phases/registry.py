from backend.phases.base import Phase


class PhaseRegistry:
    def __init__(self) -> None:
        self._phases: dict[str, Phase] = {}

    def register(self, phase: Phase) -> None:
        self._phases[phase.name] = phase

    def get(self, name: str) -> Phase:
        if name not in self._phases:
            raise KeyError(f"Unknown phase: {name}")
        return self._phases[name]

    def all_phases(self) -> dict[str, Phase]:
        return dict(self._phases)

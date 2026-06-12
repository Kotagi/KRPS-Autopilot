from abc import ABC, abstractmethod

from pydantic import BaseModel

from backend.models.ascent import PhaseState


class Phase(ABC):
    name: str

    @abstractmethod
    def configure(self, config: BaseModel) -> None:
        ...

    @abstractmethod
    async def start(self) -> None:
        ...

    @abstractmethod
    def abort(self) -> None:
        ...

    @abstractmethod
    def get_status(self) -> BaseModel:
        ...

    @property
    @abstractmethod
    def state(self) -> PhaseState:
        ...

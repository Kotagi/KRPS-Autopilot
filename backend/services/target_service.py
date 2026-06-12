from typing import Any

from backend.core.connection import GameConnection, game_connection
from backend.core.exceptions import NotConnectedError
from backend.models.target import TargetKind, TargetNode, TargetStatus, TargetTree

KIND_ORDER = {
    TargetKind.planet: 0,
    TargetKind.moon: 1,
    TargetKind.asteroid: 2,
    TargetKind.vessel: 3,
    TargetKind.star: 4,
}

ASTEROID_RADIUS_M = 1_000_000
PROXY_SUFFIX = "Light"


def _is_proxy_body(name: str, body: Any) -> bool:
    if name.endswith(PROXY_SUFFIX):
        return True
    if body.is_star and body.orbit is not None:
        return True
    return False


def _classify_body(body: Any, parent: Any | None) -> TargetKind:
    if body.is_star and parent is None:
        return TargetKind.star
    if parent is not None and parent.is_star:
        if len(body.satellites) > 0:
            return TargetKind.planet
        if float(body.equatorial_radius) < ASTEROID_RADIUS_M:
            return TargetKind.asteroid
        return TargetKind.planet
    return TargetKind.moon


def _sort_nodes(nodes: list[TargetNode]) -> list[TargetNode]:
    return sorted(
        nodes,
        key=lambda node: (KIND_ORDER.get(node.kind, 99), node.name.lower()),
    )


def _parse_target_id(target_id: str) -> tuple[str, str]:
    if ":" not in target_id:
        raise ValueError(f"Invalid target id: {target_id!r}")
    kind, name = target_id.split(":", 1)
    if kind not in {"star", "body", "vessel"} or not name:
        raise ValueError(f"Invalid target id: {target_id!r}")
    return kind, name


class TargetService:
    def __init__(self, game: GameConnection = game_connection) -> None:
        self._game = game

    def get_tree(self) -> TargetTree:
        self._game.require_flight()
        space_center = self._game.space_center
        bodies = space_center.bodies
        active_vessel = space_center.active_vessel
        active_name = str(active_vessel.name)

        vessels_by_body: dict[str, list[Any]] = {}
        for vessel in space_center.vessels:
            if str(vessel.name) == active_name:
                continue
            orbit_body = vessel.orbit.body.name
            vessels_by_body.setdefault(orbit_body, []).append(vessel)

        for body_name in vessels_by_body:
            vessels_by_body[body_name].sort(key=lambda vessel: str(vessel.name).lower())

        def build_body_node(body: Any, parent_id: str, parent_body: Any | None) -> TargetNode:
            kind = _classify_body(body, parent_body)
            node_id = f"body:{body.name}"
            children: list[TargetNode] = []

            for satellite in body.satellites:
                sat_name = str(satellite.name)
                if _is_proxy_body(sat_name, satellite):
                    continue
                children.append(build_body_node(satellite, node_id, body))

            for vessel in vessels_by_body.get(body.name, []):
                children.append(
                    TargetNode(
                        id=f"vessel:{vessel.name}",
                        name=str(vessel.name),
                        kind=TargetKind.vessel,
                        parent_id=node_id,
                        orbit_body=body.name,
                        selectable=True,
                    )
                )

            return TargetNode(
                id=node_id,
                name=body.name,
                kind=kind,
                parent_id=parent_id,
                orbit_body=parent_body.name if parent_body is not None else None,
                selectable=True,
                children=_sort_nodes(children),
            )

        roots: list[TargetNode] = []
        for body in bodies.values():
            if not body.is_star or body.orbit is not None:
                continue
            star_id = f"star:{body.name}"
            children: list[TargetNode] = []
            for satellite in body.satellites:
                sat_name = str(satellite.name)
                if _is_proxy_body(sat_name, satellite):
                    continue
                children.append(build_body_node(satellite, star_id, body))

            for vessel in vessels_by_body.get(body.name, []):
                children.append(
                    TargetNode(
                        id=f"vessel:{vessel.name}",
                        name=str(vessel.name),
                        kind=TargetKind.vessel,
                        parent_id=star_id,
                        orbit_body=body.name,
                        selectable=True,
                    )
                )

            roots.append(
                TargetNode(
                    id=star_id,
                    name=body.name,
                    kind=TargetKind.star,
                    parent_id=None,
                    selectable=False,
                    children=_sort_nodes(children),
                )
            )

        return TargetTree(roots=_sort_nodes(roots), active_vessel_name=active_name)

    def get_status(self) -> TargetStatus:
        if not self._game.is_connected():
            return TargetStatus()

        self._game.require_flight()
        space_center = self._game.space_center

        target_vessel = space_center.target_vessel
        target_body = space_center.target_body

        mechjeb_locked = False
        distance_m: float | None = None
        try:
            controller = self._game.mechjeb.target_controller
            mechjeb_locked = bool(controller.normal_target_exists)
            if mechjeb_locked:
                distance_m = float(controller.distance)
        except Exception:
            pass

        if target_vessel is not None:
            name = str(target_vessel.name)
            orbit_body = target_vessel.orbit.body.name
            return TargetStatus(
                target_type="vessel",
                id=f"vessel:{name}",
                name=name,
                kind=TargetKind.vessel,
                orbit_body=orbit_body,
                distance_m=distance_m,
                mechjeb_locked=mechjeb_locked,
            )

        if target_body is not None:
            name = str(target_body.name)
            parent_name = target_body.orbit.body.name if target_body.orbit else None
            kind = TargetKind.star if target_body.is_star else TargetKind.planet
            if parent_name and not target_body.is_star:
                parent = space_center.bodies.get(parent_name)
                if parent is not None:
                    kind = _classify_body(target_body, parent)
            return TargetStatus(
                target_type="body",
                id=f"body:{name}",
                name=name,
                kind=kind,
                orbit_body=parent_name,
                distance_m=distance_m,
                mechjeb_locked=mechjeb_locked,
            )

        return TargetStatus(mechjeb_locked=mechjeb_locked)

    def select_target(self, target_id: str) -> TargetStatus:
        self._game.require_flight()
        kind, name = _parse_target_id(target_id)

        if kind == "star":
            raise ValueError("Stars are navigation anchors only and cannot be targeted")

        space_center = self._game.space_center
        space_center.clear_target()

        if kind == "body":
            bodies = space_center.bodies
            if name not in bodies:
                raise ValueError(f"Unknown celestial body: {name}")
            space_center.target_body = bodies[name]
        elif kind == "vessel":
            vessel = self._find_vessel(name)
            if vessel is None:
                raise ValueError(f"Unknown vessel: {name}")
            space_center.target_vessel = vessel

        return self.get_status()

    def clear_target(self) -> TargetStatus:
        if not self._game.is_connected():
            raise NotConnectedError("Not connected to kRPC")
        self._game.require_flight()
        self._game.space_center.clear_target()
        return self.get_status()

    def _find_vessel(self, name: str) -> Any | None:
        for vessel in self._game.space_center.vessels:
            if str(vessel.name) == name:
                return vessel
        return None

    def mechjeb_target_ready(self) -> bool:
        try:
            return bool(self._game.mechjeb.target_controller.normal_target_exists)
        except Exception:
            return False


target_service = TargetService()

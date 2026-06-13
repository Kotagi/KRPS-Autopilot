# Map V3 element modules

One subdirectory per `MapElementKind` containing pure segment builders (no React Three).

| Module | Status |
|--------|--------|
| `starMarker/` | **Implemented** — `resolveSystemAnchors`, `buildStarMarkerSegments` |
| `planetOrbit/` | **Implemented** — `filterHeliocentricPlanetOrbit`, `densifyPlanetOrbitTrail`, `buildPlanetOrbitSegments` (v3-native) |

See `docs/MAP_V3_MODULES.md`, `docs/MAP_V3_DECOUPLE_PLAN.md`. New elements: do not import `map-v2/TrajectoryPlanner`.

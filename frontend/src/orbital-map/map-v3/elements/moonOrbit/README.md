# moonOrbit element module

Moon orbit polylines around parent planets for Map V3.

**Normative spec:** [`docs/MAP_V3_MOON_ORBIT_SPEC.md`](../../../../docs/MAP_V3_MOON_ORBIT_SPEC.md) — read § **Standard procedure** and § **Forbidden patterns** before changing this module.

**Frame rules:** [`docs/HELIOCENTRIC_ORBIT_FRAME.md`](../../../../docs/HELIOCENTRIC_ORBIT_FRAME.md) § Moon trail rings.

| File | Role |
|------|------|
| `filterMoonOrbit.ts` | Inclusion: moons only, parent ≠ root, not hidden |
| `resolveMoonOrbitSource.ts` | **Samples-first**; analytic Kepler fallback only |
| `moonOrbitGeometry.ts` | Parent-relative DLL samples (`moon − parent` @ same UT) |
| `moonOrbitPlacement.ts` | `parent(now) + offset` — single solar anchor (**no** orientation) |
| `moonOrbitScene.ts` | Solar root → `toScenePoint`; `resolveMoonOrbitAnchorIndex` |
| `moonOrbitStyle.ts` | Line width / `trailVertices` (512) |
| `buildMoonOrbitSegments.ts` | `TrajectorySegment[]` with `kind: moonOrbit` |

**Visibility:** `MoonOrbitLayer` gates on `usePlanetsInMeshMode()` — not `MoonVisibilityContext`.

**Presentation:** `scene/v3/layers/MoonOrbitLayer.tsx` → `moonOrbitPointsToScene` → `OrbitTrailV3`

**Do not add:** `bodyOrientationRootRelative`, `rotationParentReferenceToSolar`, or analytic-primary when samples exist.

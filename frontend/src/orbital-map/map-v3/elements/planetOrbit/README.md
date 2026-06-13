# planetOrbit element module

Heliocentric planet orbit polylines for Map V3.

| File | Role |
|------|------|
| `planetOrbitStyle.ts` | Line width, color resolver, `trailVertices` (**512** web densify target) |
| `densifyPlanetOrbitTrail.ts` | **Samples-first** geometry, analytic fallback, densify + UT helpers |
| `buildPlanetOrbitSegments.ts` | `TrajectorySegment[]` with `kind: planetOrbit` |

**Orbit trail manual (read first):** [`docs/ORBIT_TRAIL_DRAWING_GUIDE.md`](../../../../docs/ORBIT_TRAIL_DRAWING_GUIDE.md) — motion tail §2, sample/vertex counts §12, Sun-child frame §13.

**Inclination / plane (DLL):** [`docs/HELIOCENTRIC_ORBIT_FRAME.md`](../../../../docs/HELIOCENTRIC_ORBIT_FRAME.md) — `getRelativePositionAtUT` for all Sun-child samples.

**Element spec:** [`docs/MAP_V3_PLANET_ORBIT_SPEC.md`](../../../../docs/MAP_V3_PLANET_ORBIT_SPEC.md)

**Presentation:** `scene/v3/layers/PlanetOrbitLayer.tsx` → `OrbitTrailV3` → `scene/GradientDirectionalOrbitTrail.tsx`

**DLL capture:** 128 samples per period (`BodyOrbitPathSampleCount` in `TelemetrySnapshotService.cs`).

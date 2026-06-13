# `planetBody` element (Map V3)

| Layer | Builder | Policy |
|-------|---------|--------|
| `PlanetBodyLayer` | `buildPlanetBodySegments` | `planetBodyLod.ts` |

**Phase:** 3.1 bodies · 3.3 textures · 3.4 orientation (complete). **Next:** moons copy this pattern in Phase 5.

## Data flow

```text
telemetry.bodies[] → MapContext.bodyByName
  → buildPlanetBodySegments (one point per planet)
  → PlanetBodyLayer (visibility filter)
  → PlanetBodyMesh (LOD)
       → icon: PlanetBodyDot
       → mesh: PlanetBodyOrientedGroup → PlanetBodyMeshPoleFrame → TexturedPlanetBody | FlatPlanetBody
```

## Modules (`map-v3/elements/planetBody/`)

| File | Role |
|------|------|
| `buildPlanetBodySegments.ts` | Segment planner — position only |
| `planetBodyLod.ts` | Mesh vs fixed-screen dot crossover |
| `planetBodyTextureFields.ts` | Telemetry texture URL/status helpers |
| `planetBodyOrientationFields.ts` | Read orientation + UT extrapolation |

## Presentation (`scene/v3/layers/`)

| File | Role |
|------|------|
| `PlanetBodyLayer.tsx` | Visibility + segment loop |
| `PlanetBodyMesh.tsx` | LOD router + oriented mesh |
| `PlanetBodyOrientedGroup.tsx` | Attitude quaternion at game UT |
| `PlanetBodyMeshPoleFrame.tsx` | Sphere pole ↔ KSP north |
| `PlanetBodySpinAxisLine.tsx` | Dev spin/tilt axis (mesh LOD) |
| `PlanetBodyDot.tsx` | Icon LOD |
| `TexturedPlanetBody.tsx` | Mesh LOD + exported JPEG |
| `FlatPlanetBody.tsx` | Mesh LOD color fallback |
| `usePlanetBodyDrawMode.ts` | Per-frame LOD from camera |

## Shared

| File | Role |
|------|------|
| `assets/planetBodyTextures.ts` | Loader + cache (`flipY = true`) |
| `coords/kspBodyOrientation.ts` | KSP ↔ Three + frame mapping |

## Docs

| Doc | Purpose |
|-----|---------|
| [`docs/MAP_V3_PHASE3_GUIDE.md`](../../../../docs/MAP_V3_PHASE3_GUIDE.md) | **Start here** — operator + developer + lessons learned |
| [`docs/MAP_V3_PLANET_BODY_SPEC.md`](../../../../docs/MAP_V3_PLANET_BODY_SPEC.md) | Formal body spec (LOD, position) |
| [`docs/MAP_V3_PLANET_BODY_TEXTURE_SPEC.md`](../../../../docs/MAP_V3_PLANET_BODY_TEXTURE_SPEC.md) | Texture export spec |
| [`docs/MAP_V3_PLANET_BODY_ORIENTATION_SPEC.md`](../../../../docs/MAP_V3_PLANET_BODY_ORIENTATION_SPEC.md) | Tilt/spin spec |
| [`web/dev/README.md`](../../../../dev/README.md) | Planet texture lab |

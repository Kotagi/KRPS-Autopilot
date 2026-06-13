/** Which v2 layers are active — enable per gated phase during rollout. */
export interface MapV2LayerFlags {
  star: boolean;
  planetOrbits: boolean;
  planetBodies: boolean;
  moonOrbits: boolean;
  moonBodies: boolean;
  vesselMarker: boolean;
  bodyLod: boolean;
  vesselOrbit: boolean;
  futureRoute: boolean;
  bodyLabels: boolean;
  soi: boolean;
  selection: boolean;
}

/** Full stack enabled after plan phases 0–15. */
export const MAP_V2_LAYERS_ALL: MapV2LayerFlags = {
  star: true,
  planetOrbits: true,
  planetBodies: true,
  moonOrbits: true,
  moonBodies: true,
  vesselMarker: true,
  bodyLod: true,
  vesselOrbit: true,
  futureRoute: true,
  bodyLabels: true,
  soi: true,
  selection: true,
};

export const MAP_V2_PHASE_LABEL = "v2 full stack";

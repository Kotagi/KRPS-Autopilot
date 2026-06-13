/** Dev/debug globals used by the KspWebMap orbital map module. */
declare global {
  interface Window {
    KspSolarMapUiVersion?: string;
    KspSolarMapMoonOrbitDebug?: unknown;
    KspSolarMapPlanetOrbitDebug?: unknown;
  }
}

export {};

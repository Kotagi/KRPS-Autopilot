export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlacementSample {
  sampleRole?: string;
  targetBody?: string;
  sampleUniversalTimeSeconds?: number;
  positionRootRelativeMeters?: Vector3;
  sampleSource?: string;
  sampleWarning?: string;
}

export interface EphemerisSample {
  targetBody?: string;
  sampleRole?: string;
  sampleUniversalTimeSeconds?: number;
  positionRootRelativeMeters?: Vector3;
  velocityRootRelativeMetersPerSecond?: Vector3;
  sampleSource?: string;
  sampleWarning?: string;
}

export interface OrbitElements {
  classification?: string;
  referenceBody?: string;
  referenceFrame?: string;
  semiMajorAxisMeters?: number;
  semiLatusRectumMeters?: number;
  eccentricity?: number;
  inclinationDegrees?: number;
  longitudeOfAscendingNodeDegrees?: number;
  argumentOfPeriapsisDegrees?: number;
  trueAnomalyDegrees?: number;
  trueAnomalyDegreesAtCapture?: number;
  meanAnomalyRadiansAtCapture?: number;
  epochUniversalTimeSeconds?: number;
  periodSeconds?: number;
  referenceBodyRadiusMeters?: number;
  apoapsisRadiusMeters?: number;
  periapsisRadiusMeters?: number;
  sphereOfInfluenceMeters?: number;
  patchStartUniversalTimeSeconds?: number;
  patchEndUniversalTimeSeconds?: number;
}

export interface OrbitPatch extends OrbitElements {
  patchIndex?: number;
  isActivePatch?: boolean;
  patchStartTransition?: string;
  patchEndTransition?: string;
  previousPatchReferenceBody?: string;
  nextPatchReferenceBody?: string;
  encounterBody?: string;
  encounterLevel?: string;
  closestEncounterUniversalTimeSeconds?: number;
  closestApproachMeters?: number;
  captureWarning?: string;
  referenceBodyPositionRootRelativeMeters?: Vector3;
  referenceBodyPositionSampleUniversalTimeSeconds?: number;
  patchPlacementMode?: string;
  patchPlacementWarning?: string;
  placementSamples?: PlacementSample[];
}

export interface CelestialBody {
  name?: string;
  parentBody?: string;
  radiusMeters?: number;
  sphereOfInfluenceMeters?: number;
  gravParameter?: number;
  hasAtmosphere?: boolean;
  atmosphereDepthMeters?: number;
  orbitReferenceBody?: string;
  positionReferenceFrame?: string;
  positionSampleUniversalTimeSeconds?: number;
  positionRootRelativeMeters?: Vector3;
  positionLiveRootRelativeMeters?: Vector3;
  positionTrueRootRelativeMeters?: Vector3;
  liveVsTrueDeltaMeters?: number;
  eclipticLongitudeDegrees?: number;
  velocityReferenceFrame?: string;
  velocityRootRelativeMetersPerSecond?: Vector3;
  bodyTextureUrl?: string;
  bodyTextureRevision?: string;
  bodyTextureStatus?: string;
  bodyOrientationReferenceFrame?: string;
  bodyOrientationSampleUniversalTimeSeconds?: number;
  bodyOrientationRootRelative?: { x: number; y: number; z: number; w: number };
  spinAxisRootRelative?: Vector3;
  angularVelocityRootRelativeRadPerSec?: Vector3;
  rotationPeriodSeconds?: number;
  rotationAngleRadians?: number;
  rotates?: boolean;
  inverseRotation?: boolean;
  tidallyLocked?: boolean;
}

export interface VesselRootPathSample {
  sampleUniversalTimeSeconds?: number;
  positionRootRelativeMeters?: Vector3;
}

export interface ActiveVessel {
  id?: string;
  name?: string;
  type?: string;
  situation?: string;
  mainBody?: string;
  positionRootRelativeMeters?: Vector3;
  velocityRootRelativeMetersPerSecond?: Vector3;
  rootPathSamples?: VesselRootPathSample[];
}

export interface BodyOrbitPathSample {
  sampleUniversalTimeSeconds?: number;
  positionRootRelativeMeters?: Vector3;
  parentPositionRootRelativeMeters?: Vector3;
}

/** Keplerian elements for analytic body-orbit trails (schema v7). */
export interface BodyOrbitElements {
  referenceBody?: string;
  classification?: string;
  referenceBodyRadiusMeters?: number;
  sphereOfInfluenceMeters?: number;
  semiMajorAxisMeters?: number;
  semiLatusRectumMeters?: number;
  eccentricity?: number;
  inclinationDegrees?: number;
  longitudeOfAscendingNodeDegrees?: number;
  argumentOfPeriapsisDegrees?: number;
  epochUniversalTimeSeconds?: number;
  periodSeconds?: number;
  trueAnomalyDegreesAtCapture?: number;
  meanAnomalyRadiansAtCapture?: number;
}

export interface BodyOrbitPathValidation {
  liveToSample0Meters?: number;
  liveToAnalyticMeters?: number;
  maxSampleToRecomputedMeters?: number;
  maxSampleToTrailFrameMeters?: number;
  /** @deprecated use maxSampleToTrailFrameMeters */
  maxSampleToTrueMeters?: number;
  periodClosureMeters?: number;
  planeNormalRootRelative?: Vector3;
  planeAngleToAnalyticDegrees?: number;
  trailRenderMode?: "samples" | "analytic" | "hidden" | string;
  trailWarning?: string | null;
}

export interface BodyOrbitPath {
  bodyName?: string;
  referenceBody?: string;
  classification?: string;
  captureWarning?: string;
  samples?: BodyOrbitPathSample[];
  orbitElements?: BodyOrbitElements;
  validation?: BodyOrbitPathValidation;
}

export interface PositionValidation {
  worstBodyName?: string | null;
  worstCheck?: string | null;
  worstResidualMeters?: number;
}

export interface FrameDiagnostics {
  resolverVersion?: string;
  orbitOffsetMode?: string;
  vesselOffsetMode?: string;
  pluginBuildUtc?: string;
  captureDurationMs?: number;
  bodiesCaptured?: number;
  bodyPathsCaptured?: number;
}

export interface TelemetrySnapshot {
  schemaVersion?: number;
  valid?: boolean;
  status?: string;
  gameUniversalTimeSeconds?: number;
  rootFrameName?: string;
  rootBody?: string;
  rootFrameOriginBody?: string;
  rootFrameCapturedAtUniversalTimeSeconds?: number;
  rootFrameWarning?: string;
  patchChainStatus?: string;
  ephemerisCaptureStatus?: string;
  ephemerisValidationResidualMeters?: number;
  ephemerisLivePropagationResidualMeters?: number;
  iconTrailSample0ResidualMeters?: number;
  bodyOrbitPropagationResidualMeters?: number;
  bodyOrbitFlipPropagationResidualMeters?: number;
  bodyOrbitSampleResidualMeters?: number;
  positionValidation?: PositionValidation;
  bodyOrbitAnalyticResidualMeters?: number;
  bodyOrbitPeriodClosureResidualMeters?: number;
  frameDiagnostics?: FrameDiagnostics;
  bodies?: CelestialBody[];
  activeVessel?: ActiveVessel;
  orbit?: OrbitElements;
  orbitPatches?: OrbitPatch[];
  ephemerisSamples?: EphemerisSample[];
  bodyOrbitPaths?: BodyOrbitPath[];
  bodyOrbitCaptureStatus?: string;
}

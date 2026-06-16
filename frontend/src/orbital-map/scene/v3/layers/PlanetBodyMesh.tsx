import { useEffect, useMemo, type ReactNode } from "react";
import { usePlanetBodyMeshLodRegistry } from "../../../map-v3/PlanetBodyMeshLodContext";
import type { Vector3 } from "../../../telemetry/schema-v6";
import { useMapV3 } from "../../../map-v3/MapV3Context";
import { toScenePoint } from "../../../map-v3/SceneFrame";
import { isPlanetBodyTextureReady } from "../../../map-v3/elements/planetBody/planetBodyTextureFields";
import {
  resolvePlanetBodyOrientationAtUt,
  type CelestialBodyWithOrientation,
} from "../../../map-v3/elements/planetBody/planetBodyOrientationFields";
import { KSP_ROOT_IDENTITY_QUATERNION } from "../../../coords/kspBodyOrientation";
import { bodyMeshRadius } from "../../bodyVisualScale";
import { useKspBodyMapColor } from "../../bodyMapColors";
import { FlatPlanetBody } from "./FlatPlanetBody";
import { PlanetBodyDot } from "./PlanetBodyDot";
import { PlanetBodyOrientedGroup } from "./PlanetBodyOrientedGroup";
import { PlanetBodyMeshPoleFrame } from "./PlanetBodyMeshPoleFrame";
import { PlanetBodySpinAxisLine } from "./PlanetBodySpinAxisLine";
import { PlanetBodySpinDirectionMarker } from "./PlanetBodySpinDirectionMarker";
import { TexturedPlanetBody } from "./TexturedPlanetBody";
import { usePlanetBodyDrawMode } from "./usePlanetBodyDrawMode";
import { useViewStore } from "../../../store/viewStore";
import {
  buildPlanetBodySpinDiagnosticReport,
  logPlanetBodySpinDiagnosticReport,
} from "../../../map-v3/elements/planetBody/planetBodyOrientationDiagnostics";
import { recordKerbinChiralitySample } from "../../../map-v3/elements/planetBody/planetBodySpinChiralityDiagnostic";

const MESH_ORIGIN: [number, number, number] = [0, 0, 0];

function PlanetBodyMeshOriented({
  bodyName,
  scenePosition,
  meshR,
  color,
  body,
  gameUniversalTimeSeconds,
  showSpinAxis,
  showSpinDirection,
  bodyTextureUrl,
  bodyTextureRevision,
  bodyTextureStatus,
}: {
  bodyName: string;
  scenePosition: [number, number, number];
  meshR: number;
  color: string;
  body: CelestialBodyWithOrientation | undefined;
  gameUniversalTimeSeconds: number;
  showSpinAxis: boolean;
  showSpinDirection: boolean;
  bodyTextureUrl?: string;
  bodyTextureRevision?: string;
  bodyTextureStatus?: string;
}) {
  const orientationKsp = useMemo(
    () =>
      resolvePlanetBodyOrientationAtUt(body, gameUniversalTimeSeconds) ??
      KSP_ROOT_IDENTITY_QUATERNION,
    [
      body,
      gameUniversalTimeSeconds,
      body?.bodyOrientationSampleUniversalTimeSeconds,
      body?.bodyOrientationRootRelative?.x,
      body?.bodyOrientationRootRelative?.y,
      body?.bodyOrientationRootRelative?.z,
      body?.bodyOrientationRootRelative?.w,
      body?.angularVelocityRootRelativeRadPerSec?.x,
      body?.angularVelocityRootRelativeRadPerSec?.y,
      body?.angularVelocityRootRelativeRadPerSec?.z,
    ],
  );

  let meshChild: ReactNode;
  if (
    isPlanetBodyTextureReady({
      bodyTextureUrl,
      bodyTextureRevision,
      bodyTextureStatus,
    })
  ) {
    meshChild = (
      <TexturedPlanetBody
        radius={meshR}
        position={MESH_ORIGIN}
        renderOrder={1}
        fallbackColor={color}
        bodyName={bodyName}
        textureUrl={bodyTextureUrl}
        textureRevision={bodyTextureRevision}
      />
    );
  } else {
    meshChild = (
      <FlatPlanetBody
        radius={meshR}
        position={MESH_ORIGIN}
        color={color}
        renderOrder={1}
      />
    );
  }

  return (
    <group position={scenePosition}>
      <PlanetBodyOrientedGroup orientationKsp={orientationKsp}>
        {showSpinAxis ? <PlanetBodySpinAxisLine radius={meshR} /> : null}
        <PlanetBodyMeshPoleFrame>
          {meshChild}
          {showSpinDirection ? (
            <PlanetBodySpinDirectionMarker radius={meshR} body={body} />
          ) : null}
        </PlanetBodyMeshPoleFrame>
      </PlanetBodyOrientedGroup>
    </group>
  );
}

export function PlanetBodyMesh({
  bodyName,
  radiusMeters,
  rootPosition,
  bodyTextureUrl,
  bodyTextureRevision,
  bodyTextureStatus,
  registerMeshLod = true,
}: {
  bodyName: string;
  radiusMeters: number;
  rootPosition: Vector3;
  bodyTextureUrl?: string;
  bodyTextureRevision?: string;
  bodyTextureStatus?: string;
  /** Planets register mesh/icon mode for moon orbit gating; moons must not. */
  registerMeshLod?: boolean;
}) {
  const { mapContext, sceneFrame, hostPlanetOpen } = useMapV3();
  const devPlanetBodyLodOverride = useViewStore((s) => s.devPlanetBodyLodOverride);
  const devPlanetBodySpinAxisVisible = useViewStore(
    (s) => s.devPlanetBodySpinAxisVisible,
  );
  const devPlanetBodySpinDirectionVisible = useViewStore(
    (s) => s.devPlanetBodySpinDirectionVisible,
  );
  const devPlanetBodySpinDiagnostics = useViewStore(
    (s) => s.devPlanetBodySpinDiagnostics,
  );
  const devPlanetBodySpinChiralityCollect = useViewStore(
    (s) => s.devPlanetBodySpinChiralityCollect,
  );
  const gameUniversalTimeSeconds = useViewStore(
    (s) => s.telemetry?.gameUniversalTimeSeconds ?? 0,
  );
  const color = useKspBodyMapColor(bodyName);

  if (!mapContext) {
    return null;
  }

  const bodyEntry = mapContext.bodyByName.get(bodyName);
  const body = bodyEntry?.body as CelestialBodyWithOrientation | undefined;

  const meshR = bodyMeshRadius({
    bodyName,
    radiusMeters,
    displayScale: sceneFrame.displayScale,
    hierarchy: mapContext.hierarchy,
    hostPlanetOpen,
  });

  const scenePosition = toScenePoint(rootPosition, sceneFrame);
  const drawMode = usePlanetBodyDrawMode(
    meshR,
    scenePosition,
    devPlanetBodyLodOverride,
  );

  const meshLodRegistry = usePlanetBodyMeshLodRegistry();
  useEffect(() => {
    if (!registerMeshLod || !meshLodRegistry) {
      return;
    }
    meshLodRegistry.registerPlanetDrawMode(bodyName, drawMode);
    return () => {
      meshLodRegistry.unregisterPlanet(bodyName);
    };
  }, [registerMeshLod, meshLodRegistry, bodyName, drawMode]);

  useEffect(() => {
    if (bodyName !== "Kerbin" || drawMode !== "mesh" || !body) {
      return;
    }
    if (devPlanetBodySpinChiralityCollect) {
      recordKerbinChiralitySample(body, gameUniversalTimeSeconds);
    }
    if (!devPlanetBodySpinDiagnostics) {
      return;
    }
    const report = buildPlanetBodySpinDiagnosticReport(
      bodyName,
      body,
      gameUniversalTimeSeconds,
    );
    if (report) {
      logPlanetBodySpinDiagnosticReport(report);
    }
  }, [
    devPlanetBodySpinDiagnostics,
    devPlanetBodySpinChiralityCollect,
    bodyName,
    drawMode,
    body,
    gameUniversalTimeSeconds,
    body?.bodyOrientationSampleUniversalTimeSeconds,
    body?.rotationAngleRadians,
    body?.angularVelocityRootRelativeRadPerSec?.z,
  ]);

  if (drawMode === "icon") {
    return <PlanetBodyDot position={scenePosition} color={color} />;
  }

  return (
    <PlanetBodyMeshOriented
      bodyName={bodyName}
      scenePosition={scenePosition}
      meshR={meshR}
      color={color}
      body={body}
      gameUniversalTimeSeconds={gameUniversalTimeSeconds}
      showSpinAxis={devPlanetBodySpinAxisVisible}
      showSpinDirection={devPlanetBodySpinDirectionVisible}
      bodyTextureUrl={bodyTextureUrl}
      bodyTextureRevision={bodyTextureRevision}
      bodyTextureStatus={bodyTextureStatus}
    />
  );
}

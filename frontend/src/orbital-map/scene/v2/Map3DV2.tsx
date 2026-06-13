import { Canvas } from "@react-three/fiber";
import { MapV2Provider } from "../../map-v2/MapV2Context";
import { MoonVisibilityProvider } from "../MoonVisibilityContext";
import { CameraRig } from "../CameraRig";
import { SelectionController } from "../SelectionController";
import { MapV2SceneEffects } from "./MapV2SceneEffects";
import { StarLayer } from "./layers/StarLayer";
import { PlanetOrbitLayer } from "./layers/PlanetOrbitLayer";
import { MoonOrbitLayer } from "./layers/MoonOrbitLayer";
import { PlanetBodyLayer } from "./layers/PlanetBodyLayer";
import { MoonBodyLayer } from "./layers/MoonBodyLayer";
import { VesselMarkerLayer } from "./layers/VesselMarkerLayer";
import { VesselOrbitLayer } from "./layers/VesselOrbitLayer";
import { FutureRouteLayer } from "./layers/FutureRouteLayer";
import { SoiLayerV2 } from "./layers/SoiLayerV2";
import { BodyLabelsLayer } from "./layers/BodyLabelsLayer";
import { SelectionLayerV2 } from "./layers/SelectionLayerV2";
import { MapV2SceneErrorBoundary } from "./MapV2SceneErrorBoundary";

export function Map3DV2() {
  return (
    <Canvas
      gl={{ logarithmicDepthBuffer: true, antialias: true }}
      camera={{ position: [25, 18, 25], fov: 50, near: 0.01, far: 100000 }}
      style={{ width: "100%", height: "100%", background: "#071019" }}
    >
      <MoonVisibilityProvider>
        <MapV2Provider>
          <MapV2SceneErrorBoundary>
            <color attach="background" args={["#071019"]} />
            <ambientLight intensity={0.35} />
            <directionalLight position={[10, 20, 10]} intensity={1.1} />
            <MapV2SceneEffects />
            <StarLayer />
            <PlanetOrbitLayer />
            <MoonOrbitLayer />
            <PlanetBodyLayer />
            <MoonBodyLayer />
            <VesselOrbitLayer />
            <FutureRouteLayer />
            <VesselMarkerLayer />
            <SoiLayerV2 />
            <BodyLabelsLayer />
            <SelectionLayerV2 />
            <SelectionController />
            <CameraRig />
          </MapV2SceneErrorBoundary>
        </MapV2Provider>
      </MoonVisibilityProvider>
    </Canvas>
  );
}

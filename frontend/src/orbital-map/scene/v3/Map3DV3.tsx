import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { MapV3Provider } from "../../map-v3/MapV3Context";
import { MAP_V3_LAYERS_PHASE4 } from "../../map-v3/layerFlags";
import { PlanetBodyMeshLodProvider } from "../../map-v3/PlanetBodyMeshLodContext";
import { MoonVisibilityProvider } from "../MoonVisibilityContext";
import { CameraRig } from "../CameraRig";
import { SelectionController } from "../SelectionController";
import { MapV3SceneEffects } from "./MapV3SceneEffects";
import { MapV3SceneErrorBoundary } from "./MapV3SceneErrorBoundary";
import { MapV3LayerStack } from "./MapV3LayerStack";

export function Map3DV3() {
  return (
    <Canvas
      gl={{
        logarithmicDepthBuffer: true,
        antialias: true,
        toneMapping: THREE.NoToneMapping,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      camera={{ position: [25, 18, 25], fov: 50, near: 0.01, far: 100000 }}
      style={{ width: "100%", height: "100%", background: "#071019" }}
    >
      <MoonVisibilityProvider>
        <PlanetBodyMeshLodProvider>
          <MapV3Provider layerFlags={MAP_V3_LAYERS_PHASE4}>
            <MapV3SceneErrorBoundary>
              <color attach="background" args={["#071019"]} />
              <ambientLight intensity={0.35} />
              <directionalLight position={[10, 20, 10]} intensity={1.1} />
              <MapV3SceneEffects />
              <MapV3LayerStack />
            </MapV3SceneErrorBoundary>
            <SelectionController />
            <CameraRig />
          </MapV3Provider>
        </PlanetBodyMeshLodProvider>
      </MoonVisibilityProvider>
    </Canvas>
  );
}

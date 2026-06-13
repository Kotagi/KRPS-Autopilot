import { useEffect, useState } from "react";

import { TelemetryDebugPanel } from "../components/debug/TelemetryDebugPanel";
import { FlightDeckAutopilotModule } from "../components/flightdeck/FlightDeckAutopilotModule";
import { FlightDeckCameraModule } from "../components/flightdeck/FlightDeckCameraModule";
import { FlightDeckFuelModule } from "../components/flightdeck/FlightDeckFuelModule";
import { FlightDeckStatusBar } from "../components/flightdeck/FlightDeckStatusBar";
import { KrpsDebugPanel } from "../components/flightdeck/KrpsDebugPanel";
import { NavBall } from "../components/flightdeck/NavBall";
import { NavballSourceSelector } from "../components/flightdeck/NavballSourceSelector";
import { OrbitReadout } from "../components/flightdeck/OrbitReadout";
import { ScreenFrame } from "../components/layout/ScreenFrame";
import { VesselControls } from "../components/vessel/VesselControls";
import { appDebug } from "../debug/appDebug";
import { useAppStore } from "../store/appStore";

export function FlightDeckScreen() {
  const telemetry = useAppStore((s) => s.telemetry);
  const stageResources = useAppStore((s) => s.stageResources);
  const deltaV = useAppStore((s) => s.deltaV);
  const connection = useAppStore((s) => s.connection);
  const [debugEnabled, setDebugEnabled] = useState(() => appDebug.isEnabled());

  useEffect(() => {
    return appDebug.subscribe(() => {
      setDebugEnabled(appDebug.isEnabled());
    });
  }, []);

  return (
    <ScreenFrame
      title="Flight Deck"
      tagline="Cockpit — attitude, optics, guidance, and propellant"
    >
      <div className="screen-frame-body screen-frame-body--cockpit">
        <div className="cockpit-layout">
          <FlightDeckStatusBar
            connection={connection}
            telemetry={telemetry}
            deltaV={deltaV}
          />

          <div className="cockpit-main-deck">
            <section className="cockpit-module cockpit-module--controls panel">
              <header className="cockpit-module-header">
                <span className="cockpit-module-label">Vessel controls</span>
              </header>
              <VesselControls variant="cockpit" />
            </section>

            <FlightDeckCameraModule />

            <section className="cockpit-module cockpit-module--guidance panel">
              <header className="cockpit-module-header">
                <span className="cockpit-module-label">Guidance</span>
              </header>
              <OrbitReadout
                telemetry={telemetry}
                connected={connection.connected}
                compact
              />
              <FlightDeckAutopilotModule />
            </section>
          </div>

          <div className="cockpit-instruments-row">
            <section className="panel cockpit-attitude-block">
              <NavballSourceSelector />
              <NavBall telemetry={telemetry} connected={connection.connected} />
              {debugEnabled && <KrpsDebugPanel />}
              {debugEnabled && <TelemetryDebugPanel />}
            </section>

            <FlightDeckFuelModule
              stageResources={stageResources}
              deltaV={deltaV}
            />
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

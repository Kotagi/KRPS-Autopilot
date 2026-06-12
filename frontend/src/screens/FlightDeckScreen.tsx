import { NavBall } from "../components/flightdeck/NavBall";
import { OrbitReadout } from "../components/flightdeck/OrbitReadout";
import { FlightResourcesColumn } from "../components/flightdeck/FlightResourcesColumn";
import { ScreenFrame } from "../components/layout/ScreenFrame";
import { VesselControls } from "../components/vessel/VesselControls";
import { useAppStore } from "../store/appStore";

export function FlightDeckScreen() {
  const telemetry = useAppStore((s) => s.telemetry);
  const stageResources = useAppStore((s) => s.stageResources);
  const deltaV = useAppStore((s) => s.deltaV);
  const connection = useAppStore((s) => s.connection);
  const controls = useAppStore((s) => s.controls);

  return (
    <ScreenFrame
      title="Flight Deck"
      tagline="Live cockpit — attitude, orbit, resources, and vessel controls"
    >
      <div className="flight-deck-grid">
        <section className="panel flight-deck-module flight-deck-module--attitude">
          <h3>Attitude</h3>
          <NavBall telemetry={telemetry} connected={connection.connected} />
        </section>

        <section className="panel flight-deck-module flight-deck-module--primary">
          <h3>Orbit &amp; environment</h3>
          <OrbitReadout telemetry={telemetry} connected={connection.connected} />
        </section>

        <section className="panel flight-deck-module flight-deck-module--resources">
          <h3>Resources</h3>
          <FlightResourcesColumn
            stageResources={stageResources}
            deltaV={deltaV}
          />
        </section>

        <section className="panel flight-deck-module flight-deck-module--strip">
          <div className="flight-deck-strip">
            <span>
              {connection.vessel_name ?? telemetry?.vessel_name ?? "No vessel"} ·{" "}
              {telemetry?.situation ?? connection.situation ?? "—"}
            </span>
            <span>
              Pitch {(telemetry?.pitch_deg ?? 0).toFixed(1)}° · Roll{" "}
              {(telemetry?.roll_deg ?? 0).toFixed(1)}° · AoA{" "}
              {(telemetry?.angle_of_attack_deg ?? 0).toFixed(1)}°
            </span>
            <span>
              Δv {Math.round(deltaV?.total_vac_ms ?? 0)} m/s · TWR{" "}
              {(deltaV?.surface_twr ?? 0).toFixed(2)}
            </span>
          </div>
          <VesselControls compact />
          {!connection.connected && (
            <div className="meta flight-deck-strip-hint">
              Connect kRPC from the status bar to drive the vessel from here.
            </div>
          )}
          {connection.connected && controls && (
            <div className="meta flight-deck-strip-hint">
              Stage, SAS, RCS, and lights are live — same API as Autopilot screen.
            </div>
          )}
        </section>
      </div>
    </ScreenFrame>
  );
}

import { useEffect, useState } from "react";
import { SolarMapPanel } from "../../orbital-map/components/SolarMapPanel";
import "../../orbital-map/components/solar-map.css";
import { useViewStore } from "../../orbital-map/store/viewStore";
import { useMapTelemetry } from "../../hooks/useMapTelemetry";
import { useAppStore } from "../../store/appStore";

export function OrbitalMapView() {
  const connected = useAppStore((s) => s.connection?.connected ?? false);
  const [mapAvailable, setMapAvailable] = useState<boolean | null>(null);

  useMapTelemetry(connected);

  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      try {
        const response = await fetch("/api/map/health");
        if (!cancelled) {
          setMapAvailable(response.ok);
        }
      } catch {
        if (!cancelled) {
          setMapAvailable(false);
        }
      }
    };

    void checkHealth();
    const timer = window.setInterval(checkHealth, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const telemetry = useViewStore((s) => s.telemetry);

  if (!connected) {
    return (
      <div className="orbital-map-status">
        <p>Connect to KSP to load the orbital map.</p>
      </div>
    );
  }

  if (mapAvailable === false) {
    return (
      <div className="orbital-map-status orbital-map-status--warn">
        <p>
          KspWebMap mod is not running. Install the mod from MyMods and enter flight so telemetry
          is available on port 8750.
        </p>
      </div>
    );
  }

  if (mapAvailable === null || (mapAvailable && !telemetry)) {
    return (
      <div className="orbital-map-status">
        <p>Loading orbital map telemetry…</p>
      </div>
    );
  }

  return <SolarMapPanel />;
}

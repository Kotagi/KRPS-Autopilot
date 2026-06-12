import { Navigate, Route, Routes } from "react-router-dom";

import { AppNav } from "./AppNav";
import { ErrorBanner } from "./ErrorBanner";
import { MissionStatusBar } from "./MissionStatusBar";
import { DEFAULT_ROUTE } from "../../navigation/routes";
import { AutopilotScreen } from "../../screens/AutopilotScreen";
import { FlightDeckScreen } from "../../screens/FlightDeckScreen";
import { MapScreen } from "../../screens/MapScreen";
import { MissionScreen } from "../../screens/MissionScreen";
import { VehicleScreen } from "../../screens/VehicleScreen";

export function AppShell() {
  return (
    <div className="mission-app">
      <MissionStatusBar />
      <ErrorBanner />
      <div className="mission-app-body">
        <AppNav />
        <main className="mission-app-main">
          <Routes>
            <Route path="/" element={<Navigate to={DEFAULT_ROUTE.path} replace />} />
            <Route path="/flight" element={<FlightDeckScreen />} />
            <Route path="/autopilot" element={<AutopilotScreen />} />
            <Route path="/map" element={<MapScreen />} />
            <Route path="/mission" element={<MissionScreen />} />
            <Route path="/vehicle" element={<VehicleScreen />} />
            <Route path="*" element={<Navigate to={DEFAULT_ROUTE.path} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

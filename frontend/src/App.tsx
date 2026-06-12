import { BrowserRouter } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { useWebSocket } from "./hooks/useWebSocket";

function AppContent() {
  useWebSocket();
  return <AppShell />;
}

export function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

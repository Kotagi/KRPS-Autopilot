import { useState } from "react";

import { api } from "../../api/client";
import { useAppStore } from "../../store/appStore";

export function ConnectionBar() {
  const connection = useAppStore((s) => s.connection);
  const wsConnected = useAppStore((s) => s.wsConnected);
  const setConnection = useAppStore((s) => s.setConnection);
  const setLastError = useAppStore((s) => s.setLastError);
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const status = await api.connect();
      setConnection(status);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const status = await api.disconnect();
      setConnection(status);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  const onPad =
    connection.situation === "pre_launch" ||
    connection.situation === "VesselSituation.pre_launch";
  const dotClass = connection.connected ? (onPad ? "warn" : "ok") : "off";

  return (
    <section className="panel">
      <h2>Connection</h2>
      <div className="row">
        <span className={`status-dot ${dotClass}`} />
        <button onClick={handleConnect} disabled={busy || connection.connected}>
          Connect
        </button>
        <button
          className="secondary"
          onClick={handleDisconnect}
          disabled={busy || !connection.connected}
        >
          Disconnect
        </button>
        <span className="meta">
          kRPC: {connection.connected ? "connected" : "disconnected"} | WS:{" "}
          {wsConnected ? "live" : "reconnecting"}
        </span>
      </div>
      <div className="meta" style={{ marginTop: "0.75rem" }}>
        Vessel: {connection.vessel_name ?? "—"} | Situation:{" "}
        {connection.situation ?? "—"}
        {onPad && connection.connected && (
          <span> — on launch pad (ready to configure ascent and stage)</span>
        )}
      </div>
    </section>
  );
}

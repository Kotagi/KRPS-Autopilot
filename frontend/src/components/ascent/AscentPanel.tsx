import { useEffect, useState } from "react";

import { api } from "../../api/client";
import type { AscentConfig, AscentPath } from "../../api/types";
import { defaultAscentConfig } from "../../api/types";
import { useAppStore } from "../../store/appStore";
import { AscentStatus } from "./AscentStatus";
import { ClassicModeFields } from "./ClassicModeFields";
import { GTModeFields } from "./GTModeFields";
import { PVGModeFields } from "./PVGModeFields";
import { SharedAscentFields } from "./SharedAscentFields";
import { TargetPlaneLaunch } from "./TargetPlaneLaunch";

export function AscentPanel() {
  const connection = useAppStore((s) => s.connection);
  const ascent = useAppStore((s) => s.ascent);
  const setAscent = useAppStore((s) => s.setAscent);
  const setLastError = useAppStore((s) => s.setLastError);
  const [config, setConfig] = useState<AscentConfig>(() => defaultAscentConfig());
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const ready = connection.connected;
  const running = ascent?.state === "running";
  const formDisabled = !ready || running || syncing;

  useEffect(() => {
    if (!connection.connected) {
      return;
    }

    let cancelled = false;
    setSyncing(true);
    api
      .ascentLive()
      .then((live) => {
        if (!cancelled) {
          setConfig(live);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLastError(
            err instanceof Error ? err.message : "Failed to read MechJeb settings"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSyncing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connection.connected, setLastError]);

  const handleConfigure = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const status = await api.configureAscent(config);
      setAscent(status);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Configure failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const live = await api.ascentLive();
      setConfig(live);
    } catch (err) {
      setLastError(
        err instanceof Error ? err.message : "Failed to read MechJeb settings"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const status = await api.startAscent(config);
      setAscent(status);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAbort = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const status = await api.abortAscent();
      setAscent(status);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Abort failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2>Ascent Guidance</h2>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <div className="field">
          <label>Ascent path</label>
          <select
            value={config.ascent_path}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ascent_path: e.target.value as AscentPath,
              }))
            }
            disabled={formDisabled}
          >
            <option value="classic">Classic</option>
            <option value="gt">Gravity Turn</option>
            <option value="pvg">PVG (RSS/RO)</option>
          </select>
        </div>
        {syncing && <div className="meta">Syncing from MechJeb…</div>}
      </div>

      <SharedAscentFields
        config={config}
        disabled={formDisabled}
        onChange={setConfig}
      />

      {config.ascent_path === "classic" && (
        <ClassicModeFields
          config={config}
          disabled={formDisabled}
          onChange={setConfig}
        />
      )}
      {config.ascent_path === "gt" && (
        <GTModeFields
          config={config}
          disabled={formDisabled}
          onChange={setConfig}
        />
      )}
      {config.ascent_path === "pvg" && (
        <PVGModeFields
          config={config}
          disabled={formDisabled}
          onChange={setConfig}
        />
      )}

      <TargetPlaneLaunch
        config={config}
        disabled={formDisabled}
        busy={busy}
        onBusyChange={setBusy}
        onConfigChange={setConfig}
      />

      <div className="row" style={{ marginTop: "1rem" }}>
        <button
          className="secondary"
          onClick={handleSync}
          disabled={!ready || busy || running}
        >
          Sync from MechJeb
        </button>
        <button
          className="secondary"
          onClick={handleConfigure}
          disabled={!ready || busy || running}
        >
          Configure
        </button>
        <button onClick={handleStart} disabled={!ready || busy || running}>
          Start Ascent
        </button>
        <button
          className="danger"
          onClick={handleAbort}
          disabled={!ready || busy || !running}
        >
          Abort
        </button>
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <AscentStatus />
      </div>
      <div className="meta" style={{ marginTop: "0.5rem" }}>
        Editing fields only updates this page until you click Configure or Start
        Ascent. After Start Ascent, click Stage to launch.
      </div>
    </section>
  );
}

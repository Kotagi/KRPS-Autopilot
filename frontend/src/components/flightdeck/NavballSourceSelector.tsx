import { useEffect, useState } from "react";

import { api } from "../../api/client";
import type { NavballSource, NavballSourceStatus } from "../../api/types";
import { useAppStore } from "../../store/appStore";

function statusLabel(status: NavballSourceStatus): string {
  const source = status.source.toUpperCase();
  if (status.source === "krps") {
    return status.krps_connected ? `${source} live` : `${source} waiting`;
  }
  return status.krpc_connected ? `${source} live` : `${source} offline`;
}

export function NavballSourceSelector() {
  const navballSource = useAppStore((s) => s.navballSource);
  const setNavballSource = useAppStore((s) => s.setNavballSource);
  const [pending, setPending] = useState<NavballSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .navballSourceStatus()
      .then(setNavballSource)
      .catch(() => {
        /* WS will populate when connected */
      });
  }, [setNavballSource]);

  async function selectSource(source: NavballSource) {
    if (source === navballSource.source || pending !== null) {
      return;
    }
    setPending(source);
    setError(null);
    try {
      const status = await api.setNavballSource(source);
      setNavballSource(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch source");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="navball-source-selector">
      <span className="navball-source-label">Navball source</span>
      <div className="navball-source-options" role="group" aria-label="Navball telemetry source">
        <button
          type="button"
          className={
            navballSource.source === "krpc"
              ? "navball-source-btn navball-source-btn--active"
              : "navball-source-btn"
          }
          disabled={pending !== null}
          onClick={() => selectSource("krpc")}
        >
          kRPC
        </button>
        <button
          type="button"
          className={
            navballSource.source === "krps"
              ? "navball-source-btn navball-source-btn--active"
              : "navball-source-btn"
          }
          disabled={pending !== null}
          onClick={() => selectSource("krps")}
        >
          KRPS
        </button>
      </div>
      <span className="navball-source-status">{statusLabel(navballSource)}</span>
      {error && <span className="navball-source-error">{error}</span>}
    </div>
  );
}

import { useEffect, useState } from "react";

import { ScreenFrame } from "../components/layout/ScreenFrame";
import { appDebug } from "../debug/appDebug";

export function SettingsScreen() {
  const [debugEnabled, setDebugEnabled] = useState(() => appDebug.isEnabled());

  useEffect(() => {
    return appDebug.subscribe(() => {
      setDebugEnabled(appDebug.isEnabled());
    });
  }, []);

  return (
    <ScreenFrame
      title="Settings"
      tagline="App preferences and diagnostics"
    >
      <section className="panel settings-section">
        <h3>Diagnostics</h3>
        <div className="settings-row">
          <div className="settings-copy">
            <div className="settings-label">Debug mode</div>
            <p className="settings-description">
              Shows KRPS comparison and client telemetry debug panels on the Flight Deck.
            </p>
          </div>
          <button
            type="button"
            className={`settings-toggle${debugEnabled ? " settings-toggle--on" : ""}`}
            aria-pressed={debugEnabled}
            onClick={() => appDebug.toggle()}
          >
            {debugEnabled ? "On" : "Off"}
          </button>
        </div>
        <p className="settings-hint">
          Debug mode is off by default. When enabled, panels appear under Attitude on Flight Deck.
        </p>
      </section>
    </ScreenFrame>
  );
}

import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { CameraDebugResponse } from "../api/types";
import { CameraStreamViewer } from "../components/optics/CameraStreamViewer";
import { ScreenFrame } from "../components/layout/ScreenFrame";
import { useCameraList } from "../hooks/useCameraList";
import { useAppStore } from "../store/appStore";

const DEBUG_POLL_INTERVAL_MS = 5000;

export function OpticsScreen() {
  const connection = useAppStore((s) => s.connection);
  const {
    cameraList,
    loading,
    selectedCameraId,
    selectedCamera,
    selectCamera,
  } = useCameraList();
  const [streamDebug, setStreamDebug] = useState<CameraDebugResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refreshDebug = async () => {
      try {
        const debug = await api.camerasDebug();
        if (!cancelled) {
          setStreamDebug(debug);
        }
      } catch {
        if (!cancelled) {
          setStreamDebug(null);
        }
      }
    };

    void refreshDebug();
    const timer = window.setInterval(() => {
      void refreshDebug();
    }, DEBUG_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const vesselLabel =
    connection.vessel_name ?? (connection.connected ? "Active vessel" : null);

  const leakedViewers =
    streamDebug !== null &&
    streamDebug.jrti_total_viewers > (selectedCamera ? 1 : 0);

  const leakedProxies =
    streamDebug !== null && streamDebug.active_proxy_streams > 1;

  return (
    <ScreenFrame
      title="Onboard Optics"
      tagline="External camera feeds from the active vessel"
    >
      <div className="optics-layout">
        <section className="panel optics-list-panel">
          <div className="optics-list-header">
            <h3>Cameras</h3>
            <span className="optics-list-count">
              {cameraList.cameras.length}{" "}
              {cameraList.cameras.length === 1 ? "feed" : "feeds"}
            </span>
          </div>

          {loading && (
            <p className="meta optics-list-message">Scanning for camera feeds…</p>
          )}

          {!loading && !cameraList.available && (
            <p className="meta optics-list-message optics-list-message--warn">
              {cameraList.error ??
                "JRTI stream server is offline. Load a craft into flight with Hullcam cameras."}
            </p>
          )}

          {!loading && cameraList.available && cameraList.cameras.length === 0 && (
            <p className="meta optics-list-message">
              No cameras detected on the active vessel. Add Hullcam parts in the
              VAB or SPH, then launch into flight.
            </p>
          )}

          {!loading && cameraList.cameras.length > 0 && (
            <ul className="optics-camera-list">
              {cameraList.cameras.map((camera) => {
                const isSelected = camera.id === selectedCameraId;
                return (
                  <li key={camera.id}>
                    <button
                      type="button"
                      className={`optics-camera-item ${
                        isSelected ? "optics-camera-item--selected" : ""
                      }`}
                      onClick={() => selectCamera(camera)}
                      aria-pressed={isSelected}
                    >
                      <div className="optics-camera-item-main">
                        <span className="optics-camera-name">{camera.name}</span>
                        <span className="optics-camera-id">ID {camera.id}</span>
                      </div>
                      <div className="optics-camera-item-meta">
                        <span
                          className={`optics-camera-status ${
                            camera.streaming ? "optics-camera-status--live" : ""
                          }`}
                        >
                          {camera.streaming ? "Live" : "Standby"}
                        </span>
                        {camera.viewer_count > 0 && (
                          <span className="optics-camera-viewers">
                            {camera.viewer_count} viewer
                            {camera.viewer_count === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel optics-viewer-panel">
          <div className="optics-viewer-header">
            <h3>Feed</h3>
            {selectedCamera && (
              <span className="optics-viewer-label">
                {selectedCamera.name} · ID {selectedCamera.id}
              </span>
            )}
          </div>

          {selectedCamera?.stream_url ? (
            <CameraStreamViewer
              cameraId={selectedCamera.id}
              streamUrl={selectedCamera.stream_url}
              cameraName={selectedCamera.name}
            />
          ) : (
            <div className="optics-viewer-placeholder">
              <span>Select a camera to view its feed.</span>
              {vesselLabel && (
                <span className="meta optics-viewer-vessel">{vesselLabel}</span>
              )}
            </div>
          )}

          {streamDebug && (
            <div
              className={`optics-stream-debug ${
                leakedViewers || leakedProxies ? "optics-stream-debug--warn" : ""
              }`}
            >
              <span>
                Proxy streams: {streamDebug.active_proxy_streams} · JRTI viewers:{" "}
                {streamDebug.jrti_total_viewers}
              </span>
              {(leakedViewers || leakedProxies) && (
                <span className="meta">
                  Stale stream connections detected — wait a moment after switching
                  cameras, or use JRTI&apos;s &quot;Close All&quot; if feeds stay black.
                </span>
              )}
            </div>
          )}
        </section>
      </div>
    </ScreenFrame>
  );
}

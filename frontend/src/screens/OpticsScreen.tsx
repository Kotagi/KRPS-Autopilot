import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { CameraListResponse, CameraSummary } from "../api/types";
import { ScreenFrame } from "../components/layout/ScreenFrame";
import { useAppStore } from "../store/appStore";

const POLL_INTERVAL_MS = 4000;

const EMPTY_CAMERA_LIST: CameraListResponse = {
  available: false,
  source: "jrti",
  cameras: [],
  error: null,
};

export function OpticsScreen() {
  const connection = useAppStore((s) => s.connection);
  const [cameraList, setCameraList] = useState<CameraListResponse>(EMPTY_CAMERA_LIST);
  const [loading, setLoading] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(null);
  const [streamKey, setStreamKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await api.cameras();
        if (!cancelled) {
          setCameraList(response);
          setSelectedCameraId((current) => {
            if (current === null) {
              return current;
            }
            const stillPresent = response.cameras.some((camera) => camera.id === current);
            return stillPresent ? current : null;
          });
        }
      } catch {
        if (!cancelled) {
          setCameraList({
            ...EMPTY_CAMERA_LIST,
            error: "Failed to load cameras from mission control.",
          });
          setSelectedCameraId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const selectedCamera = useMemo(
    () => cameraList.cameras.find((camera) => camera.id === selectedCameraId) ?? null,
    [cameraList.cameras, selectedCameraId]
  );

  const vesselLabel =
    connection.vessel_name ?? (connection.connected ? "Active vessel" : null);

  const handleSelectCamera = (camera: CameraSummary) => {
    setSelectedCameraId(camera.id);
    setStreamKey((key) => key + 1);
  };

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
                      onClick={() => handleSelectCamera(camera)}
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
            <div className="optics-viewer-feed">
              <img
                key={`${selectedCamera.id}-${streamKey}`}
                src={`${selectedCamera.stream_url}?v=${streamKey}`}
                alt={`${selectedCamera.name} live feed`}
              />
            </div>
          ) : (
            <div className="optics-viewer-placeholder">
              <span>Select a camera to view its feed.</span>
              {vesselLabel && (
                <span className="meta optics-viewer-vessel">{vesselLabel}</span>
              )}
            </div>
          )}
        </section>
      </div>
    </ScreenFrame>
  );
}

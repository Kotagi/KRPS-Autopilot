import { CameraStreamViewer } from "../optics/CameraStreamViewer";
import { useCameraList } from "../../hooks/useCameraList";
import { useAppStore } from "../../store/appStore";

export function FlightDeckCameraModule() {
  const connection = useAppStore((s) => s.connection);
  const { cameraList, loading, selectedCamera, selectCamera } = useCameraList();

  const vesselLabel =
    connection.vessel_name ?? (connection.connected ? "Active vessel" : null);

  return (
    <section className="cockpit-module cockpit-module--viewport panel">
      <header className="cockpit-module-header">
        <div className="cockpit-module-heading">
          <span className="cockpit-module-label">External optics</span>
          <span className="cockpit-module-sub">
            {selectedCamera
              ? `${selectedCamera.name} · CH ${selectedCamera.id}`
              : "No channel selected"}
          </span>
        </div>
        {selectedCamera?.streaming && (
          <span className="cockpit-live-badge" aria-label="Live feed">
            LIVE
          </span>
        )}
      </header>

      <div className="cockpit-viewport-bezel">
        {selectedCamera?.stream_url ? (
          <CameraStreamViewer
            cameraId={selectedCamera.id}
            streamUrl={selectedCamera.stream_url}
            cameraName={selectedCamera.name}
          />
        ) : (
          <div className="cockpit-viewport-placeholder">
            <span className="cockpit-viewport-placeholder-title">No signal</span>
            <span className="meta">
              {loading
                ? "Scanning for hull cameras…"
                : !cameraList.available
                  ? (cameraList.error ??
                    "JRTI offline — load flight with Hullcam cameras.")
                  : cameraList.cameras.length === 0
                    ? "No cameras on this vessel."
                    : "Select a camera channel below."}
            </span>
            {vesselLabel && <span className="meta cockpit-viewport-vessel">{vesselLabel}</span>}
          </div>
        )}
      </div>

      <div className="cockpit-camera-channels" role="toolbar" aria-label="Camera channels">
        {loading && (
          <span className="meta cockpit-camera-channels-empty">Loading channels…</span>
        )}
        {!loading && cameraList.cameras.length === 0 && (
          <span className="meta cockpit-camera-channels-empty">No camera channels</span>
        )}
        {cameraList.cameras.map((camera) => {
          const isSelected = selectedCamera?.id === camera.id;
          return (
            <button
              key={camera.id}
              type="button"
              className={`cockpit-camera-channel${isSelected ? " cockpit-camera-channel--active" : ""}`}
              onClick={() => selectCamera(camera)}
              aria-pressed={isSelected}
              title={camera.name}
            >
              <span className="cockpit-camera-channel-name">{camera.name}</span>
              <span className="cockpit-camera-channel-id">CH{camera.id}</span>
              {camera.streaming && (
                <span className="cockpit-camera-channel-live" aria-hidden>
                  ●
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

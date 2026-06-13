import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Map3D } from "../scene/Map3D";
import { Map3DV2 } from "../scene/v2/Map3DV2";
import { Map3DV3 } from "../scene/v3/Map3DV3";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { MapHud } from "./MapHud";
import { useViewStore } from "../store/viewStore";
import { syncDashboardSolarView } from "../shell/syncDashboardView";
import "./solar-map.css";

export function SolarMapPanel() {
  const solarRenderMode = useViewStore((s) => s.solarRenderMode);
  const solarFullscreen = useViewStore((s) => s.solarFullscreen);
  const setSolarFullscreen = useViewStore((s) => s.setSolarFullscreen);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    syncDashboardSolarView(solarRenderMode);
  }, [solarRenderMode]);

  useEffect(() => {
    document.body.dataset.solarFullscreen = solarFullscreen ? "1" : "0";
    document.body.style.overflow = solarFullscreen ? "hidden" : "";
    return () => {
      document.body.dataset.solarFullscreen = "0";
      document.body.style.overflow = "";
    };
  }, [solarFullscreen]);

  useEffect(() => {
    if (!solarFullscreen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSolarFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [solarFullscreen, setSolarFullscreen]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !solarFullscreen) {
      return;
    }
    const requestNative = async () => {
      try {
        if (!document.fullscreenElement) {
          await panel.requestFullscreen();
        }
      } catch {
        /* overlay fullscreen still works */
      }
    };
    void requestNative();
  }, [solarFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && useViewStore.getState().solarFullscreen) {
        setSolarFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [setSolarFullscreen]);

  const panel = (
    <div
      ref={panelRef}
      className={
        solarFullscreen ? "ksp-solar-panel ksp-solar-panel--fullscreen" : "ksp-solar-panel"
      }
      role="region"
      aria-label="Solar system map"
    >
      <MapHud />
      <div className="ksp-solar-viewport">
        {solarRenderMode === "3d-v3" ? (
          <MapErrorBoundary>
            <Map3DV3 />
          </MapErrorBoundary>
        ) : solarRenderMode === "3d-v2" ? (
          <MapErrorBoundary>
            <Map3DV2 />
          </MapErrorBoundary>
        ) : solarRenderMode === "3d" ? (
          <MapErrorBoundary>
            <Map3D />
          </MapErrorBoundary>
        ) : (
          <div className="ksp-solar-2d-placeholder">
            Fullscreen is available for 3D WebGL. Switch View → 3D, or use the legacy 2D canvas in
            the dashboard card below.
          </div>
        )}
      </div>
    </div>
  );

  if (solarFullscreen) {
    return createPortal(panel, document.body);
  }

  return panel;
}

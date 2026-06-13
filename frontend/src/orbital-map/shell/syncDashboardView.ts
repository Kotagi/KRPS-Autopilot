import type { SolarRenderMode } from "../store/viewStore";

export function isWebGlSolarMode(mode: string): boolean {
  return mode === "3d" || mode === "3d-v2" || mode === "3d-v3";
}

/** Keep legacy index.html shell in sync with React render mode. */
export function syncDashboardSolarView(mode: SolarRenderMode): void {
  document.body.dataset.solarView = mode;
  const root = document.getElementById("solar3dRoot");
  const canvas = document.getElementById("solarCanvas");
  const webgl = isWebGlSolarMode(mode);
  if (root) {
    root.style.display = webgl ? "block" : "none";
  }
  if (canvas) {
    canvas.classList.toggle("solar-2d-visible", mode === "2d");
  }
}

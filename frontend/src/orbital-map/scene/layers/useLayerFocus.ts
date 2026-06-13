import { useMoonVisibilityContext } from "../MoonVisibilityContext";

/** World-shift focus from moon visibility context (host planet when SOI is open). */
export function useLayerFocus() {
  return useMoonVisibilityContext().displayFocus;
}

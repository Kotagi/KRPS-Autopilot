export type AppRouteId =
  | "flight"
  | "optics"
  | "autopilot"
  | "map"
  | "mission"
  | "vehicle"
  | "settings";

export interface AppRoute {
  id: AppRouteId;
  path: string;
  label: string;
  tagline: string;
}

export const APP_ROUTES: AppRoute[] = [
  {
    id: "flight",
    path: "/flight",
    label: "Flight Deck",
    tagline: "Live cockpit and vehicle state",
  },
  {
    id: "optics",
    path: "/optics",
    label: "Onboard Optics",
    tagline: "External camera feeds from the active vessel",
  },
  {
    id: "autopilot",
    path: "/autopilot",
    label: "Autopilot",
    tagline: "Ascent, maneuvers, and targets",
  },
  {
    id: "map",
    path: "/map",
    label: "Trajectory",
    tagline: "Orbit map and patched conics",
  },
  {
    id: "mission",
    path: "/mission",
    label: "Mission",
    tagline: "Visual mission planner",
  },
  {
    id: "vehicle",
    path: "/vehicle",
    label: "Vehicle",
    tagline: "Stages, resources, and inspection",
  },
  {
    id: "settings",
    path: "/settings",
    label: "Settings",
    tagline: "Preferences and diagnostics",
  },
];

export const DEFAULT_ROUTE = APP_ROUTES[0];

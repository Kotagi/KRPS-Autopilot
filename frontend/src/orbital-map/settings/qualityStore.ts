export type QualityPreset = "low" | "medium" | "high";

export interface QualitySettings {
  preset: QualityPreset;
  maxOrbitPointsPerPatch: number;
  starCount: number;
  bloomEnabled: boolean;
  labelsEnabled: boolean;
}

const PRESETS: Record<QualityPreset, Omit<QualitySettings, "preset">> = {
  low: {
    maxOrbitPointsPerPatch: 64,
    starCount: 800,
    bloomEnabled: false,
    labelsEnabled: true,
  },
  medium: {
    maxOrbitPointsPerPatch: 128,
    starCount: 2000,
    bloomEnabled: true,
    labelsEnabled: true,
  },
  high: {
    maxOrbitPointsPerPatch: 256,
    starCount: 3000,
    bloomEnabled: true,
    labelsEnabled: true,
  },
};

export function getQualitySettings(preset: QualityPreset): QualitySettings {
  return { preset, ...PRESETS[preset] };
}

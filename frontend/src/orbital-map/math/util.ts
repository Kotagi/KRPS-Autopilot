export function finiteOr(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function valueOrNA(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }
  return String(value);
}

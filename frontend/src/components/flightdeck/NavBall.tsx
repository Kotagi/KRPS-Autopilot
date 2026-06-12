import { useEffect, useRef } from "react";

import type { VesselTelemetry } from "../../api/types";
import { telemetryClientDebug } from "../../debug/telemetryClientDebug";
import { surfaceRotationKey } from "../../debug/telemetryCompare";

import {
  HEADING_MERIDIAN_STEP,
  buildHeadingMeridians,
  buildIntercardinalHeadingLabels,
  buildPitchRingLabels,
  meridianSvgPath,
  paintNavballCanvas,
  projectPrograde,
  quatConjugate,
  type Quat,
} from "./navballMath";

interface NavBallProps {
  telemetry: VesselTelemetry | null;
  connected: boolean;
}

const RADIUS = 100;

function placeholderMessage(connected: boolean): string {
  if (!connected) return "Click Connect in the status bar";
  return "Waiting for telemetry…";
}

function formatHeading(deg: number): string {
  if (!Number.isFinite(deg)) return "---";
  const h = ((deg % 360) + 360) % 360;
  return h.toFixed(0).padStart(3, "0");
}

function formatSpeed(ms: number): string {
  return `${ms.toFixed(1)}m/s`;
}

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  const px = RADIUS * 2;
  const bitmap = Math.round(px * dpr);
  if (canvas.width !== bitmap || canvas.height !== bitmap) {
    canvas.width = bitmap;
    canvas.height = bitmap;
    canvas.style.width = `${px}px`;
    canvas.style.height = `${px}px`;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function rotatedLabelTransform(x: number, y: number, rotationDeg: number): string {
  return `rotate(${rotationDeg.toFixed(2)} ${x} ${y})`;
}

export function NavBall({ telemetry, connected }: NavBallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderStartRef = useRef<number | null>(null);

  const pitch = telemetry?.pitch_deg ?? 0;
  const roll = telemetry?.roll_deg ?? 0;
  const heading = telemetry?.heading_deg ?? 0;
  const speed = telemetry?.surface_speed_ms ?? telemetry?.orbital_speed_ms ?? 0;
  const prograde = telemetry?.prograde ?? [0, 0, 1];
  const showPrograde = speed > 0.5;
  const surfaceRotation = telemetry?.surface_rotation as Quat | undefined;
  const surfaceRotationKeyValue = surfaceRotationKey(surfaceRotation);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !surfaceRotation) return;

    const paintStart = performance.now();
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    const px = RADIUS * 2;
    ctx.clearRect(0, 0, px, px);
    paintNavballCanvas(ctx, RADIUS, surfaceRotation, RADIUS, RADIUS);
    telemetryClientDebug.recordPhase("canvas-paint", performance.now() - paintStart);
  }, [surfaceRotation, surfaceRotationKeyValue]);

  if (!telemetry) {
    return (
      <div className="flight-deck-placeholder navball-placeholder">
        Navball
        <span className="meta">{placeholderMessage(connected)}</span>
      </div>
    );
  }

  renderStartRef.current = performance.now();

  const invQ = surfaceRotation ? quatConjugate(surfaceRotation) : quatConjugate([0, 0, 0, 1]);
  const svgStart = performance.now();
  const headingMeridians = buildHeadingMeridians(invQ, RADIUS, pitch);
  const pitchRingLabels = buildPitchRingLabels(invQ, RADIUS, pitch);
  const intercardinalHeadingLabels = buildIntercardinalHeadingLabels(invQ, RADIUS, pitch);
  const progradePoint = showPrograde ? projectPrograde(prograde, invQ, RADIUS) : null;
  telemetryClientDebug.recordPhase("svg-build", performance.now() - svgStart);

  if (renderStartRef.current !== null) {
    telemetryClientDebug.recordPhase(
      "navball-render",
      performance.now() - renderStartRef.current
    );
  }

  return (
    <div className="navball-wrap navball-wrap--ksp">
      <div className="navball-bezel">
        <div className="navball-speed-readout">
          <span className="navball-speed-label">Surface</span>
          <strong>{formatSpeed(speed)}</strong>
        </div>

        <div className="navball-face">
          <canvas ref={canvasRef} className="navball-canvas" aria-hidden="true" />

          <svg
            className="navball-overlay"
            viewBox={`${-RADIUS} ${-RADIUS} ${RADIUS * 2} ${RADIUS * 2}`}
            role="img"
            aria-label="Attitude indicator"
          >
            <clipPath id="navball-face-clip">
              <circle cx={0} cy={0} r={RADIUS} />
            </clipPath>

            <g clipPath="url(#navball-face-clip)">
              {Array.from({ length: 360 / HEADING_MERIDIAN_STEP }, (_, i) => i * HEADING_MERIDIAN_STEP).map(
                (deg) => {
                  const d = meridianSvgPath(invQ, deg, RADIUS);
                  if (!d) return null;
                  return (
                    <path
                      key={`meridian-${deg}`}
                      d={d}
                      className={deg === 0 ? "navball-meridian navball-meridian--north" : "navball-meridian"}
                      fill="none"
                    />
                  );
                }
              )}

              {pitchRingLabels.map((label) => (
                <text
                  key={`pitch-${label.mark}-${label.meridianDeg}-${label.side}${label.isZenith ? "-zenith" : ""}`}
                  x={label.x}
                  y={label.y}
                  transform={rotatedLabelTransform(label.x, label.y, label.rotationDeg)}
                  className={
                    label.isZenith
                      ? "navball-pitch-label navball-pitch-label--zenith"
                      : label.isGround
                        ? "navball-pitch-label navball-pitch-label--ground"
                        : "navball-pitch-label"
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {label.text}
                </text>
              ))}

              {intercardinalHeadingLabels.map((label) => (
                <text
                  key={`hdg-${label.deg}`}
                  x={label.x}
                  y={label.y}
                  transform={rotatedLabelTransform(label.x, label.y, label.rotationDeg)}
                  className={
                    label.isGround
                      ? "navball-heading-label navball-heading-label--ground"
                      : "navball-heading-label navball-heading-label--meridian"
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {label.text}
                </text>
              ))}

              {pitch < 75 &&
                headingMeridians.flatMap((meridian) =>
                  meridian.labelSlots.map((slot) => (
                    <text
                      key={`label-${meridian.deg}-${slot.side}`}
                      x={slot.x}
                      y={slot.y}
                      transform={rotatedLabelTransform(slot.x, slot.y, slot.rotationDeg)}
                      className="navball-heading-label navball-heading-label--major"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {meridian.label}
                    </text>
                  ))
                )}

              {progradePoint && (
                <g className="navball-prograde-marker">
                  <circle cx={progradePoint[0]} cy={progradePoint[1]} r={6} className="navball-prograde" />
                  <circle
                    cx={progradePoint[0]}
                    cy={progradePoint[1]}
                    r={2}
                    className="navball-prograde-core"
                  />
                </g>
              )}
            </g>

            <g className="navball-reticle-ksp" aria-hidden="true">
              <g className="navball-crosshair">
                <line x1={0} y1={-18} x2={0} y2={18} />
                <line x1={-18} y1={0} x2={18} y2={0} />
              </g>
              <g className="navball-level-indicator">
                <g className="navball-level-outline">
                  <line x1={-14} y1={0} x2={-4.5} y2={0} />
                  <line x1={4.5} y1={0} x2={14} y2={0} />
                  <line x1={-4.5} y1={0} x2={0} y2={9.5} />
                  <line x1={4.5} y1={0} x2={0} y2={9.5} />
                  <polygon points="0,-2.6 2.6,0 0,2.6 -2.6,0" />
                </g>
                <g className="navball-level-fill">
                  <line x1={-14} y1={0} x2={-4.5} y2={0} />
                  <line x1={4.5} y1={0} x2={14} y2={0} />
                  <line x1={-4.5} y1={0} x2={0} y2={9.5} />
                  <line x1={4.5} y1={0} x2={0} y2={9.5} />
                  <polygon points="0,-2.2 2.2,0 0,2.2 -2.2,0" />
                </g>
              </g>
            </g>
          </svg>
        </div>

        <div className="navball-heading-readout">
          <span>HDG</span>
          <strong>{formatHeading(heading)}°</strong>
        </div>
      </div>

      <div className="navball-readout">
        <span>P {pitch.toFixed(1)}°</span>
        <span>H {formatHeading(heading)}°</span>
        <span>R {roll.toFixed(1)}°</span>
      </div>
    </div>
  );
}

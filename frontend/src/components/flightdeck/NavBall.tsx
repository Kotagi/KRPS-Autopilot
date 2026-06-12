import { useEffect, useRef } from "react";

import type { VesselTelemetry } from "../../api/types";

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

  const pitch = telemetry?.pitch_deg ?? 0;
  const roll = telemetry?.roll_deg ?? 0;
  const heading = telemetry?.heading_deg ?? 0;
  const speed = telemetry?.surface_speed_ms ?? telemetry?.orbital_speed_ms ?? 0;
  const prograde = telemetry?.prograde ?? [0, 0, 1];
  const showPrograde = speed > 0.5;
  const surfaceRotation = telemetry?.surface_rotation as Quat | undefined;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !surfaceRotation) return;

    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    const px = RADIUS * 2;
    ctx.clearRect(0, 0, px, px);
    paintNavballCanvas(ctx, RADIUS, surfaceRotation, RADIUS, RADIUS);
  }, [surfaceRotation]);

  if (!telemetry) {
    return (
      <div className="flight-deck-placeholder navball-placeholder">
        Navball
        <span className="meta">{placeholderMessage(connected)}</span>
      </div>
    );
  }

  const invQ = surfaceRotation ? quatConjugate(surfaceRotation) : quatConjugate([0, 0, 0, 1]);
  const headingMeridians = buildHeadingMeridians(invQ, RADIUS, pitch);
  const pitchRingLabels = buildPitchRingLabels(invQ, RADIUS, pitch);
  const intercardinalHeadingLabels = buildIntercardinalHeadingLabels(invQ, RADIUS, pitch);
  const progradePoint = showPrograde ? projectPrograde(prograde, invQ, RADIUS) : null;

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

            <g className="navball-reticle-ksp">
              <path d="M 0 -18 L -14 8 L -4 4 L 0 10 L 4 4 L 14 8 Z" className="navball-reticle-v" />
              <circle cx={0} cy={0} r={2.5} className="navball-reticle-dot" />
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

import type { VesselTelemetry } from "../api/types";
import { navballTelemetryUnchanged } from "./telemetryCompare";

const LOG_INTERVAL_MS = 5000;
const SLOW_PHASE_MS = 8;

export interface TelemetryClientStats {
  wsTelemetryHz: number;
  wsTelemetryCount: number;
  wsGapAvgMs: number;
  wsGapMaxMs: number;
  serverLatencyAvgMs: number | null;
  serverLatencyMaxMs: number | null;
  unchangedAttitude: number;
  duplicatePct: number;
  skippedStoreUpdates: number;
  serverSeqGaps: number;
  navballRenderAvgMs: number;
  navballRenderMaxMs: number;
  canvasPaintAvgMs: number;
  canvasPaintMaxMs: number;
  svgBuildAvgMs: number;
  svgBuildMaxMs: number;
  slowPhases: number;
  lastPitch: number | null;
  lastHeading: number | null;
  lastRoll: number | null;
}

type Listener = () => void;

class TelemetryClientProfiler {
  private enabled = false;
  private listeners = new Set<Listener>();
  private lastLogAt = performance.now();
  private windowStart = performance.now();

  private wsCount = 0;
  private gapTotalMs = 0;
  private gapMaxMs = 0;
  private gapCount = 0;
  private lastWsAt: number | null = null;

  private latencyTotalMs = 0;
  private latencyMaxMs = 0;
  private latencyCount = 0;

  private unchangedAttitude = 0;
  private skippedStoreUpdates = 0;
  private lastServerSeq: number | null = null;
  private serverSeqGaps = 0;
  private lastAttitude: VesselTelemetry | null = null;

  private navballRenderTotalMs = 0;
  private navballRenderMaxMs = 0;
  private navballRenderCount = 0;

  private canvasPaintTotalMs = 0;
  private canvasPaintMaxMs = 0;
  private canvasPaintCount = 0;

  private svgBuildTotalMs = 0;
  private svgBuildMaxMs = 0;
  private svgBuildCount = 0;

  private slowPhases = 0;

  private snapshot: TelemetryClientStats = {
    wsTelemetryHz: 0,
    wsTelemetryCount: 0,
    wsGapAvgMs: 0,
    wsGapMaxMs: 0,
    serverLatencyAvgMs: null,
    serverLatencyMaxMs: null,
    unchangedAttitude: 0,
    duplicatePct: 0,
    skippedStoreUpdates: 0,
    serverSeqGaps: 0,
    navballRenderAvgMs: 0,
    navballRenderMaxMs: 0,
    canvasPaintAvgMs: 0,
    canvasPaintMaxMs: 0,
    svgBuildAvgMs: 0,
    svgBuildMaxMs: 0,
    slowPhases: 0,
    lastPitch: null,
    lastHeading: null,
    lastRoll: null,
  };

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.setEnabled(true);
  }

  disable(): void {
    this.setEnabled(false);
  }

  setEnabled(value: boolean): void {
    if (this.enabled === value) return;
    this.enabled = value;
    if (value) {
      console.info(
        "[telemetry-client] debug enabled — open DevTools console or use the on-screen panel."
      );
      this.resetWindow();
    }
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getStats(): TelemetryClientStats {
    return this.snapshot;
  }

  recordTelemetryMessage(
    telemetry: VesselTelemetry,
    options?: { storeSkipped?: boolean }
  ): void {
    if (!this.enabled) return;

    const now = performance.now();
    if (this.lastWsAt !== null) {
      const gap = now - this.lastWsAt;
      this.gapTotalMs += gap;
      this.gapCount += 1;
      if (gap > this.gapMaxMs) this.gapMaxMs = gap;
    }
    this.lastWsAt = now;
    this.wsCount += 1;

    const serverTsMs =
      typeof telemetry.server_ts_ms === "number"
        ? telemetry.server_ts_ms
        : typeof telemetry.server_ts === "number"
          ? Math.round(telemetry.server_ts * 1000)
          : null;
    if (serverTsMs !== null) {
      const latencyMs = Date.now() - serverTsMs;
      if (latencyMs >= -250 && latencyMs < 2000) {
        this.latencyTotalMs += latencyMs;
        this.latencyCount += 1;
        if (latencyMs > this.latencyMaxMs) this.latencyMaxMs = latencyMs;
      }
    }

    if (typeof telemetry.server_seq === "number") {
      if (this.lastServerSeq !== null && telemetry.server_seq > this.lastServerSeq + 1) {
        this.serverSeqGaps += telemetry.server_seq - this.lastServerSeq - 1;
      }
      this.lastServerSeq = telemetry.server_seq;
    }

    if (navballTelemetryUnchanged(this.lastAttitude, telemetry)) {
      this.unchangedAttitude += 1;
    }
    if (options?.storeSkipped) {
      this.skippedStoreUpdates += 1;
    }
    this.lastAttitude = telemetry;

    this.snapshot.lastPitch = telemetry.pitch_deg ?? null;
    this.snapshot.lastHeading = telemetry.heading_deg ?? null;
    this.snapshot.lastRoll = telemetry.roll_deg ?? null;

    this.maybeLogSummary();
  }

  recordPhase(
    phase: "navball-render" | "canvas-paint" | "svg-build",
    durationMs: number
  ): void {
    if (!this.enabled) return;

    if (durationMs >= SLOW_PHASE_MS) {
      this.slowPhases += 1;
      console.warn(`[telemetry-client] slow ${phase}: ${durationMs.toFixed(1)} ms`);
    }

    if (phase === "navball-render") {
      this.navballRenderTotalMs += durationMs;
      this.navballRenderCount += 1;
      if (durationMs > this.navballRenderMaxMs) this.navballRenderMaxMs = durationMs;
    } else if (phase === "canvas-paint") {
      this.canvasPaintTotalMs += durationMs;
      this.canvasPaintCount += 1;
      if (durationMs > this.canvasPaintMaxMs) this.canvasPaintMaxMs = durationMs;
    } else {
      this.svgBuildTotalMs += durationMs;
      this.svgBuildCount += 1;
      if (durationMs > this.svgBuildMaxMs) this.svgBuildMaxMs = durationMs;
    }

    this.maybeLogSummary();
  }

  private maybeLogSummary(): void {
    const now = performance.now();
    if (now - this.lastLogAt < LOG_INTERVAL_MS) return;
    this.flushSummary(now);
  }

  private flushSummary(now: number): void {
    const windowMs = now - this.windowStart;
    const windowS = windowMs / 1000;

    this.snapshot = {
      wsTelemetryHz: windowS > 0 ? this.wsCount / windowS : 0,
      wsTelemetryCount: this.wsCount,
      wsGapAvgMs: this.gapCount > 0 ? this.gapTotalMs / this.gapCount : 0,
      wsGapMaxMs: this.gapMaxMs,
      serverLatencyAvgMs:
        this.latencyCount > 0 ? this.latencyTotalMs / this.latencyCount : null,
      serverLatencyMaxMs: this.latencyCount > 0 ? this.latencyMaxMs : null,
      unchangedAttitude: this.unchangedAttitude,
      duplicatePct: this.wsCount > 0 ? (this.unchangedAttitude / this.wsCount) * 100 : 0,
      skippedStoreUpdates: this.skippedStoreUpdates,
      serverSeqGaps: this.serverSeqGaps,
      navballRenderAvgMs:
        this.navballRenderCount > 0
          ? this.navballRenderTotalMs / this.navballRenderCount
          : 0,
      navballRenderMaxMs: this.navballRenderMaxMs,
      canvasPaintAvgMs:
        this.canvasPaintCount > 0 ? this.canvasPaintTotalMs / this.canvasPaintCount : 0,
      canvasPaintMaxMs: this.canvasPaintMaxMs,
      svgBuildAvgMs:
        this.svgBuildCount > 0 ? this.svgBuildTotalMs / this.svgBuildCount : 0,
      svgBuildMaxMs: this.svgBuildMaxMs,
      slowPhases: this.slowPhases,
      lastPitch: this.snapshot.lastPitch,
      lastHeading: this.snapshot.lastHeading,
      lastRoll: this.snapshot.lastRoll,
    };

    console.info(
      `[telemetry-client] ${windowS.toFixed(1)}s | ws=${this.snapshot.wsTelemetryHz.toFixed(1)} Hz (${this.wsCount}) | ` +
        `gap avg=${this.snapshot.wsGapAvgMs.toFixed(1)}ms max=${this.snapshot.wsGapMaxMs.toFixed(1)}ms | ` +
        `server latency avg=${this.snapshot.serverLatencyAvgMs?.toFixed(1) ?? "n/a"}ms max=${this.snapshot.serverLatencyMaxMs?.toFixed(1) ?? "n/a"}ms | ` +
        `unchanged=${this.unchangedAttitude} (${this.snapshot.duplicatePct.toFixed(0)}%) | ` +
        `store-skipped=${this.skippedStoreUpdates} | seq-gaps=${this.serverSeqGaps} | ` +
        `navball avg=${this.snapshot.navballRenderAvgMs.toFixed(1)}ms max=${this.snapshot.navballRenderMaxMs.toFixed(1)}ms | ` +
        `canvas avg=${this.snapshot.canvasPaintAvgMs.toFixed(1)}ms max=${this.snapshot.canvasPaintMaxMs.toFixed(1)}ms | ` +
        `svg avg=${this.snapshot.svgBuildAvgMs.toFixed(1)}ms max=${this.snapshot.svgBuildMaxMs.toFixed(1)}ms | ` +
        `slow=${this.slowPhases}`
    );

    this.resetWindow(now);
    this.notify();
  }

  private resetWindow(now = performance.now()): void {
    this.windowStart = now;
    this.lastLogAt = now;
    this.wsCount = 0;
    this.gapTotalMs = 0;
    this.gapMaxMs = 0;
    this.gapCount = 0;
    this.latencyTotalMs = 0;
    this.latencyMaxMs = 0;
    this.latencyCount = 0;
    this.unchangedAttitude = 0;
    this.skippedStoreUpdates = 0;
    this.serverSeqGaps = 0;
    this.navballRenderTotalMs = 0;
    this.navballRenderMaxMs = 0;
    this.navballRenderCount = 0;
    this.canvasPaintTotalMs = 0;
    this.canvasPaintMaxMs = 0;
    this.canvasPaintCount = 0;
    this.svgBuildTotalMs = 0;
    this.svgBuildMaxMs = 0;
    this.svgBuildCount = 0;
    this.slowPhases = 0;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const telemetryClientDebug = new TelemetryClientProfiler();

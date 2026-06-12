import { telemetryClientDebug } from "./telemetryClientDebug";

const STORAGE_KEY = "kprs.debug.enabled";

type Listener = () => void;

class AppDebug {
  private enabled = false;
  private listeners = new Set<Listener>();

  constructor() {
    this.enabled = localStorage.getItem(STORAGE_KEY) === "1";
    this.applyUrlOverride();
    telemetryClientDebug.setEnabled(this.enabled);
  }

  private applyUrlOverride(): void {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("debug") && !params.has("telemetryDebug")) {
      return;
    }

    const value = params.get("debug") ?? params.get("telemetryDebug");
    if (value === "0" || value === "false") {
      this.setEnabled(false);
      return;
    }
    if (value === "1" || value === "true") {
      this.setEnabled(true);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.setEnabled(true);
  }

  disable(): void {
    this.setEnabled(false);
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  private setEnabled(value: boolean): void {
    if (this.enabled === value) return;
    this.enabled = value;
    if (value) {
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    telemetryClientDebug.setEnabled(value);
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const appDebug = new AppDebug();

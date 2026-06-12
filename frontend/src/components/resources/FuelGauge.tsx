import type { StageFuel } from "../../api/types";

export function FuelGauge({ stage }: { stage: StageFuel }) {
  const ticks = [100, 75, 50, 25, 0];

  return (
    <div
      className={`fuel-gauge${stage.is_active ? " fuel-gauge--active" : ""}`}
      title={`${stage.label}: ${stage.percent.toFixed(1)}%`}
    >
      <div className="fuel-gauge-bezel">
        <div className="fuel-gauge-face">
          <div className="fuel-gauge-unit">F</div>
          <div className="fuel-gauge-scale">
            {ticks.map((tick) => (
              <div key={tick} className="fuel-gauge-tick-row">
                <span className="fuel-gauge-tick-line" />
                <span className="fuel-gauge-tick-label">{tick}</span>
              </div>
            ))}
          </div>
          <div
            className="fuel-gauge-indicator"
            style={{ top: `${100 - stage.percent}%` }}
          />
        </div>
      </div>
      <div className="fuel-gauge-label">{stage.label}</div>
      <div className="fuel-gauge-percent">{stage.percent.toFixed(0)}%</div>
    </div>
  );
}

export function FuelGaugeRow({ stages }: { stages: StageFuel[] }) {
  if (stages.length === 0) {
    return <div className="meta">Waiting for fuel telemetry...</div>;
  }

  return (
    <div className="fuel-gauge-row">
      {stages.map((stage) => (
        <FuelGauge key={`${stage.label}-${stage.stage_number}`} stage={stage} />
      ))}
    </div>
  );
}

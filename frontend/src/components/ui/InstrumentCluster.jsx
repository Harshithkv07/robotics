import { RadialGauge } from './RadialGauge';

const RAD2DEG = 180 / Math.PI;
const DELTA_MAX_DEG = 45;
const PSI_CRIT_DEG = 45;
const V_MAX = 5.0;

export function InstrumentCluster({ controls, states }) {
  if (!controls) return null;

  const v = controls.v ?? 0;
  const hasSteer = controls.delta !== undefined;
  const hasOmega = controls.omega !== undefined;
  const psi1Deg = states?.psi_1 !== undefined ? states.psi_1 * RAD2DEG : null;
  const psi2Deg = states?.psi_2 !== undefined ? states.psi_2 * RAD2DEG : null;

  const hitchZones = [
    { from: -PSI_CRIT_DEG, to: -PSI_CRIT_DEG * (40 / 45), color: '#fb7185' },
    { from: -PSI_CRIT_DEG * (40 / 45), to: -PSI_CRIT_DEG * (30 / 45), color: '#f59e0b' },
    { from: -PSI_CRIT_DEG * (30 / 45), to: PSI_CRIT_DEG * (30 / 45), color: '#34d399' },
    { from: PSI_CRIT_DEG * (30 / 45), to: PSI_CRIT_DEG * (40 / 45), color: '#f59e0b' },
    { from: PSI_CRIT_DEG * (40 / 45), to: PSI_CRIT_DEG, color: '#fb7185' }
  ];

  return (
    <div className="panel-cockpit rounded-3xl px-6 py-4 pointer-events-auto flex items-end gap-4">
      <RadialGauge
        label="Velocity"
        value={Math.abs(v)}
        min={0}
        max={V_MAX}
        precision={2}
        unit={v < -0.02 ? 'm/s REV' : 'm/s'}
        size={140}
        zones={[
          { from: 0, to: V_MAX * 0.7, color: '#34d399' },
          { from: V_MAX * 0.7, to: V_MAX * 0.9, color: '#f59e0b' },
          { from: V_MAX * 0.9, to: V_MAX, color: '#fb7185' }
        ]}
      />

      {psi1Deg !== null && (
        <RadialGauge
          label="Hitch Angle ψ₁"
          value={psi1Deg}
          min={-PSI_CRIT_DEG}
          max={PSI_CRIT_DEG}
          precision={1}
          unit="deg"
          size={176}
          zones={hitchZones}
          isDanger={Math.abs(psi1Deg) > 40}
          dangerLabel="JACKKNIFE RISK"
        />
      )}

      {hasSteer && (
        <RadialGauge
          label="Steering δ"
          value={controls.delta * RAD2DEG}
          min={-DELTA_MAX_DEG}
          max={DELTA_MAX_DEG}
          precision={1}
          unit="deg"
          size={140}
          zones={[
            { from: -DELTA_MAX_DEG, to: -DELTA_MAX_DEG * 0.85, color: '#f59e0b' },
            { from: -DELTA_MAX_DEG * 0.85, to: DELTA_MAX_DEG * 0.85, color: '#22d3ee' },
            { from: DELTA_MAX_DEG * 0.85, to: DELTA_MAX_DEG, color: '#f59e0b' }
          ]}
        />
      )}

      {hasOmega && (
        <RadialGauge
          label="Angular Rate ω"
          value={controls.omega * RAD2DEG}
          min={-180}
          max={180}
          precision={0}
          unit="deg/s"
          size={140}
          zones={[{ from: -180, to: 180, color: '#22d3ee' }]}
        />
      )}

      {psi2Deg !== null && (
        <RadialGauge
          label="Hitch Angle ψ₂"
          value={psi2Deg}
          min={-PSI_CRIT_DEG}
          max={PSI_CRIT_DEG}
          precision={1}
          unit="deg"
          size={140}
          zones={hitchZones}
          isDanger={Math.abs(psi2Deg) > 40}
          dangerLabel="JACKKNIFE RISK"
        />
      )}
    </div>
  );
}

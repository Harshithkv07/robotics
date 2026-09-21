import { cn } from '../../utils';
import { AlertTriangle } from 'lucide-react';

// Generic 180 deg instrument-cluster dial. Angle convention: 0deg = straight up,
// -90deg = min (needle full left), +90deg = max (needle full right) — clockwise positive.
function angleForValue(value, min, max) {
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return -90 + t * 180;
}

function pointOnArc(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arcPath(cx, cy, r, fromAngle, toAngle) {
  const [x1, y1] = pointOnArc(cx, cy, r, fromAngle);
  const [x2, y2] = pointOnArc(cx, cy, r, toAngle);
  const largeArc = Math.abs(toAngle - fromAngle) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/**
 * value/min/max define the sweep. `zones` are colored value-space bands drawn on
 * the arc, e.g. [{from:-45,to:-30,color:'#fb7185'}, ...] — later entries paint
 * over earlier ones where they overlap, so list widest-to-narrowest.
 */
export function RadialGauge({
  value,
  min,
  max,
  zones = [],
  label,
  unit,
  precision = 1,
  size = 168,
  dangerLabel,
  isDanger = false
}) {
  const cx = size / 2;
  const cy = size * 0.62;
  const r = size * 0.42;
  const needleAngle = angleForValue(value, min, max);
  const [needleX, needleY] = pointOnArc(cx, cy, r, needleAngle);

  return (
    <div className={cn(
      "panel-cockpit rounded-2xl p-4 flex flex-col items-center pointer-events-auto transition-colors",
      isDanger && "border-rose-500/50"
    )}>
      {label && (
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</h3>
      )}
      <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
        <path d={arcPath(cx, cy, r, -90, 90)} fill="none" stroke="#1f2a37" strokeWidth={size * 0.05} strokeLinecap="round" />
        {zones.map((z, i) => (
          <path
            key={i}
            d={arcPath(cx, cy, r, angleForValue(z.from, min, max), angleForValue(z.to, min, max))}
            fill="none"
            stroke={z.color}
            strokeWidth={size * 0.05}
            strokeLinecap="round"
          />
        ))}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="white" strokeWidth={size * 0.018} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={size * 0.035} fill="white" />
      </svg>
      <div className="flex flex-col items-center -mt-1">
        <span className={cn("text-telemetry text-2xl font-semibold", isDanger ? "text-rose-400" : "text-cyan-300")}>
          {value.toFixed(precision)}
          <span className="text-xs text-slate-500 ml-1 font-sans">{unit}</span>
        </span>
        {isDanger && dangerLabel && (
          <div className="flex items-center gap-1 mt-1.5 text-rose-400 font-bold text-[10px] uppercase tracking-widest bg-rose-500/15 px-2.5 py-1 rounded-md border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>{dangerLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

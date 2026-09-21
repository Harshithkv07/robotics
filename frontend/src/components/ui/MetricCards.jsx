import { cn } from '../../utils';
import { Activity, Clock, Target, AlertTriangle, CheckCircle2, Radio } from 'lucide-react';

function MetricChip({ title, value, unit, icon: Icon, valueClass }) {
  return (
    <div className="panel-cockpit rounded-xl px-3.5 py-2 flex items-center gap-2.5">
      <Icon className="w-4 h-4 text-slate-500 shrink-0" />
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em]">{title}</span>
        <span className={cn("text-telemetry text-sm font-semibold", valueClass)}>
          {value}<span className="text-[10px] text-slate-500 ml-0.5 font-sans">{unit}</span>
        </span>
      </div>
    </div>
  );
}

export function MetricCards({ metrics, connected, hasHitch }) {
  return (
    <div className="flex flex-wrap gap-2.5 pointer-events-auto items-center">
      <div className="panel-cockpit rounded-xl px-4 py-2 flex items-center gap-3">
        <Radio className={cn("w-4 h-4", connected ? "text-emerald-400 animate-pulse" : "text-rose-500")} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-display tracking-wide">NMPC Digital Twin</span>
          <span className="text-[9px] text-slate-500 uppercase tracking-[0.15em]">
            {connected ? "Live Telemetry" : "Disconnected"}
          </span>
        </div>
      </div>

      {metrics && (
        <>
          <MetricChip
            title="Solver"
            value={metrics.solve_time_ms.toFixed(1)}
            unit="ms"
            icon={Clock}
            valueClass={metrics.solve_time_ms < 20 ? "text-emerald-400" : "text-amber-400"}
          />
          <MetricChip title="Cross-Track" value={metrics.e_y.toFixed(3)} unit="m" icon={Target} valueClass="text-cyan-300" />
          <MetricChip title="Heading Err" value={metrics.e_theta.toFixed(3)} unit="rad" icon={Activity} valueClass="text-cyan-300" />

          {hasHitch && metrics.jackknife_margin !== undefined && (
            <MetricChip
              title="Hitch Margin"
              value={metrics.jackknife_margin.toFixed(2)}
              unit="rad"
              icon={AlertTriangle}
              valueClass={metrics.jackknife_margin < 0.2 ? "text-rose-400 animate-pulse" : "text-emerald-400"}
            />
          )}

          {metrics.distance_to_bay !== undefined && (
            <MetricChip
              title={metrics.docked > 0.5 ? "Docked" : "Dist. to Bay"}
              value={metrics.distance_to_bay.toFixed(2)}
              unit="m"
              icon={CheckCircle2}
              valueClass={metrics.docked > 0.5 ? "text-emerald-400" : "text-slate-200"}
            />
          )}
        </>
      )}
    </div>
  );
}

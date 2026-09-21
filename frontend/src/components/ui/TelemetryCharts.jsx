import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function TelemetryCharts({ telemetry }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!telemetry || !telemetry.metrics || !telemetry.controls) return;

    setData(prev => {
      const point = {
        time: telemetry.timestamp,
        ey: telemetry.metrics.e_y,
        etheta: telemetry.metrics.e_theta,
        solveTime: telemetry.metrics.solve_time_ms,
        steer: telemetry.controls.delta !== undefined ? telemetry.controls.delta : 0,
        speed: telemetry.controls.v !== undefined ? telemetry.controls.v : 0
      };

      const newData = [...prev, point];
      if (newData.length > 300) {
        return newData.slice(newData.length - 300);
      }
      return newData;
    });
  }, [telemetry]);

  if (data.length === 0) return null;

  return (
    <div className="panel-cockpit rounded-2xl p-4 pointer-events-auto w-full min-w-[320px] flex flex-col gap-5">

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em]">Tracking Error</h3>
          <div className="flex gap-3 text-[10px] text-telemetry text-slate-500 uppercase tracking-wider">
            <span className="text-cyan-400">e_y (m)</span>
            <span className="text-violet-400">e_theta (rad)</span>
          </div>
        </div>
        <div className="h-24 w-full bg-black/30 rounded-lg overflow-hidden p-1 border border-white/5">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="time" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #1f2a37', borderRadius: '0.5rem', fontSize: '12px' }}
                itemStyle={{ color: '#e4e4e7', padding: 0 }}
                labelStyle={{ display: 'none' }}
              />
              <Line type="monotone" dataKey="ey" name="e_y" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="etheta" name="e_theta" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em]">Actuator Effort</h3>
          <div className="flex gap-3 text-[10px] text-telemetry text-slate-500 uppercase tracking-wider">
            <span className="text-pink-400">Steer (rad)</span>
            <span className="text-emerald-400">Vel (m/s)</span>
          </div>
        </div>
        <div className="h-24 w-full bg-black/30 rounded-lg overflow-hidden p-1 border border-white/5">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="time" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #1f2a37', borderRadius: '0.5rem', fontSize: '12px' }}
                itemStyle={{ color: '#e4e4e7', padding: 0 }}
                labelStyle={{ display: 'none' }}
              />
              <Line type="stepAfter" dataKey="steer" name="delta" stroke="#f472b6" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="speed" name="v" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

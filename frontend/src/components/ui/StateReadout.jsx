const LABELS = {
  x: 'x',
  y: 'y',
  theta: 'θ',
  theta_0: 'θ₀',
  psi_1: 'ψ₁',
  psi_2: 'ψ₂'
};

export function StateReadout({ states, bare = false }) {
  if (!states) return null;

  const entries = Object.entries(states).filter(([key]) => LABELS[key]);
  if (entries.length === 0) return null;

  const content = (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-telemetry text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between gap-2">
          <span className="text-slate-500">{LABELS[key]}</span>
          <span className="text-cyan-200">{value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );

  if (bare) return content;

  return (
    <div className="panel-cockpit rounded-2xl p-4 pointer-events-auto min-w-[220px]">
      <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em] mb-3">State Vector</h3>
      {content}
    </div>
  );
}

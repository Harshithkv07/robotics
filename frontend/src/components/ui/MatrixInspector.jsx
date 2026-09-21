import { useState } from 'react';
import { cn } from '../../utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function MatrixInspector({ matrix, title="T_base^world", bare=false }) {
  const [open, setOpen] = useState(true);

  if (!matrix || matrix.length !== 16) return null;

  // matrix is 16 elements column-major
  // m00 m01 m02 m03
  // m10 m11 m12 m13
  // m20 m21 m22 m23
  // m30 m31 m32 m33

  const rows = [
    [matrix[0], matrix[4], matrix[8], matrix[12]],
    [matrix[1], matrix[5], matrix[9], matrix[13]],
    [matrix[2], matrix[6], matrix[10], matrix[14]],
    [matrix[3], matrix[7], matrix[11], matrix[15]]
  ];

  return (
    <div className={cn(!bare && "panel-cockpit rounded-2xl p-4 min-w-[300px]", "pointer-events-auto")}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <h2 className="text-sm font-bold text-display text-slate-200 flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-cyan-400" />}
          {title}
        </h2>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-4 gap-1 text-center text-telemetry text-xs">
          {rows.map((row, rIdx) => (
            row.map((val, cIdx) => {
              const isRot = rIdx < 3 && cIdx < 3;
              const isTrans = rIdx < 3 && cIdx === 3;
              const isPersp = rIdx === 3;

              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className={cn(
                    "p-1.5 rounded-lg border border-transparent",
                    isRot && "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
                    isTrans && "text-emerald-300 bg-emerald-500/10 border-emerald-500/20 font-semibold",
                    isPersp && "text-slate-600 bg-white/[0.03]"
                  )}
                >
                  {val.toFixed(3)}
                </div>
              );
            })
          ))}
        </div>
      )}
    </div>
  );
}

import { cn } from '../../utils';
import { Camera, Target, Video, Grid3x3, ListTree } from 'lucide-react';
import { MatrixInspector } from './MatrixInspector';
import { StateReadout } from './StateReadout';

const TABS = [
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'matrix', label: 'Matrices', icon: Grid3x3 },
  { id: 'state', label: 'State', icon: ListTree }
];

export function InspectorPanel({
  cameraMode, setCameraMode,
  showAxes, setShowAxes,
  showRibbon, setShowRibbon,
  transforms, states,
  tab, setTab
}) {
  const matrixCount = ['base', 'link1', 'link2'].filter(k => transforms?.[k]).length;

  return (
    <div className="panel-cockpit rounded-2xl pointer-events-auto w-72 flex flex-col max-h-[min(72vh,640px)]">
      {/* Tab strip */}
      <div className="flex border-b border-white/5 shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2",
              tab === id ? "border-cyan-400 text-cyan-300" : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {id === 'matrix' && matrixCount > 0 && (
              <span className="absolute mt-[-14px] ml-6 text-[8px] bg-cyan-500/20 text-cyan-300 rounded-full px-1">{matrixCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — independently scrollable so it can never get clipped by the viewport */}
      <div className="p-4 overflow-y-auto">
        {tab === 'camera' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {['Orbit', 'Top-Down', 'Chase', 'Hitch Cam'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setCameraMode(mode)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border",
                    cameraMode === mode
                      ? "bg-cyan-500/90 text-black border-cyan-300 shadow-lg shadow-cyan-500/20"
                      : "bg-black/30 hover:bg-black/50 text-slate-300 border-white/5"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAxes(!showAxes)}
                className={cn("flex-1 p-2 flex justify-center rounded-xl transition-colors border border-white/5", showAxes ? "bg-cyan-500/90 text-black" : "bg-black/30 hover:bg-black/50 text-slate-400")}
                title="Toggle Axes"
              >
                <Target className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowRibbon(!showRibbon)}
                className={cn("flex-1 p-2 flex justify-center rounded-xl transition-colors border border-white/5", showRibbon ? "bg-cyan-500/90 text-black" : "bg-black/30 hover:bg-black/50 text-slate-400")}
                title="Toggle Prediction Ribbon"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {tab === 'matrix' && (
          <div className="flex flex-col gap-3">
            {transforms?.base && <MatrixInspector matrix={transforms.base} title="T_base^world" bare />}
            {transforms?.link1 && <MatrixInspector matrix={transforms.link1} title="T_trailer1^world" bare />}
            {transforms?.link2 && <MatrixInspector matrix={transforms.link2} title="T_trailer2^world" bare />}
            {matrixCount === 0 && <p className="text-xs text-slate-500 text-center py-6">No telemetry yet.</p>}
          </div>
        )}

        {tab === 'state' && (
          <StateReadout states={states} bare />
        )}
      </div>
    </div>
  );
}

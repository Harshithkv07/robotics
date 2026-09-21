import { Zap, Pause, RefreshCw } from 'lucide-react';
import { cn } from '../../utils';

export function ControlPanel({ telemetry, sendSetProfile, sendSetTrajectory, sendInjectDisturbance, sendPauseResume, sendReset }) {
  const activeProfile = telemetry?.active_profile;
  const activeTrajectory = telemetry?.active_trajectory;

  return (
    <div className="panel-cockpit rounded-2xl p-4 pointer-events-auto w-full max-w-4xl flex gap-4">
      {/* Profile Selector */}
      <div className="flex-1">
        <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em] mb-2">Vehicle Profile</h2>
        <div className="flex gap-2">
          {['DifferentialDrive', 'AckermannCar', 'SingleTrailer', 'MultiTrailer'].map(profile => (
            <button
              key={profile}
              onClick={() => sendSetProfile(profile)}
              className={cn(
                "flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 border",
                activeProfile === profile
                  ? "bg-emerald-500/90 text-black border-emerald-400 shadow-lg shadow-emerald-500/20"
                  : "bg-black/30 hover:bg-black/50 text-slate-300 border-white/5"
              )}
            >
              {profile.replace(/([A-Z])/g, ' $1').trim()}
            </button>
          ))}
        </div>
      </div>

      {/* Trajectory Selector */}
      <div className="flex-1 max-w-xs">
        <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em] mb-2">Trajectory</h2>
        <div className="flex gap-2">
          {['Straight', 'Curvilinear', 'Docking'].map(traj => (
            <button
              key={traj}
              onClick={() => sendSetTrajectory(traj)}
              className={cn(
                "flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 border",
                activeTrajectory === traj
                  ? "bg-cyan-500/90 text-black border-cyan-300 shadow-lg shadow-cyan-500/20"
                  : "bg-black/30 hover:bg-black/50 text-slate-300 border-white/5"
              )}
            >
              {traj}
            </button>
          ))}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-end gap-2">
        <button
          onClick={sendPauseResume}
          className="p-3 bg-black/30 hover:bg-black/50 border border-white/5 rounded-xl transition-colors text-slate-300 hover:text-white"
          title="Pause/Resume"
        >
          <Pause className="w-5 h-5" />
        </button>
        <button
          onClick={sendReset}
          className="p-3 bg-black/30 hover:bg-black/50 border border-white/5 rounded-xl transition-colors text-slate-300 hover:text-white"
          title="Reset"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
        <div className="w-px h-10 bg-white/10 mx-1 mb-1" />
        <button
          onClick={() => sendInjectDisturbance(3, 0.261)}
          className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 transition-colors flex items-center gap-2 h-[44px]"
          title="Inject Hitch Disturbance (+15 deg)"
        >
          <Zap className="w-4 h-4" />
          <span className="font-bold text-xs">INJECT DISTURBANCE</span>
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Play, XCircle } from 'lucide-react';

export function ShowstopperDemo({ 
  actions 
}) {
  const [isActive, setIsActive] = useState(false);
  const [step, setStep] = useState(0);

  const startTour = () => {
    setIsActive(true);
    setStep(1);
  };

  const cancelTour = useCallback(() => {
    if (isActive) {
      setIsActive(false);
      setStep(0);
    }
  }, [isActive]);

  // Expose cancel mechanism for global clicks and escapes
  useEffect(() => {
    const handleGlobalCancel = () => {
      cancelTour();
    };
    
    if (isActive) {
      window.addEventListener('click', handleGlobalCancel);
    }
    
    return () => {
      window.removeEventListener('click', handleGlobalCancel);
    };
  }, [isActive, cancelTour]);

  // Register in actions if needed by parent
  useEffect(() => {
    if (actions.registerTourController) {
      actions.registerTourController({
        triggerTour: startTour,
        cancelTour: cancelTour
      });
    }
  }, [actions, cancelTour]);

  // Tour logic
  useEffect(() => {
    if (!isActive) return;

    let timeout;
    
    switch (step) {
      case 1: // 0s - 10s: AGV, Top-Down, Matrix On
        actions.sendSetProfile('DifferentialDrive');
        actions.sendSetTrajectory('Straight');
        actions.setCameraMode('Top-Down');
        actions.setMatrixInspector(true);
        timeout = setTimeout(() => setStep(2), 10000);
        break;
      case 2: // 10s - 20s: Ackermann, Orbit
        actions.sendSetProfile('AckermannCar');
        actions.sendSetTrajectory('Straight');
        actions.setCameraMode('Orbit');
        actions.setMatrixInspector(false);
        timeout = setTimeout(() => setStep(3), 10000);
        break;
      case 3: // 20s - 40s: Single-Trailer, Docking, Orbit
        actions.sendSetProfile('SingleTrailer');
        actions.sendSetTrajectory('Docking');
        actions.setCameraMode('Orbit');
        timeout = setTimeout(() => setStep(4), 20000);
        break;
      case 4: // 40s - 50s: Disturbance, Chase/Hitch Cam
        actions.injectDisturbance();
        actions.setCameraMode('Hitch Cam');
        timeout = setTimeout(() => setStep(5), 10000);
        break;
      case 5: // 50s - 60s: Multi-Trailer, Curvilinear
        actions.sendSetProfile('MultiTrailer');
        actions.sendSetTrajectory('Curvilinear');
        actions.setCameraMode('Chase');
        timeout = setTimeout(() => {
          setIsActive(false);
          setStep(0);
        }, 10000);
        break;
      default:
        break;
    }

    return () => clearTimeout(timeout);
  }, [isActive, step, actions]);

  if (isActive) {
    return (
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 panel-cockpit text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.35)] border-cyan-400/50 flex items-center gap-4 animate-pulse pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); cancelTour(); }}>
        <span className="font-bold tracking-widest text-sm uppercase text-display">Showstopper Tour Active</span>
        <XCircle className="w-5 h-5 text-cyan-300" />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); startTour(); }}
      className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-105 pointer-events-auto border border-white/10"
    >
      <Play className="w-4 h-4 fill-current" />
      <span className="text-xs tracking-widest uppercase">Run Showstopper Tour</span>
    </button>
  );
}

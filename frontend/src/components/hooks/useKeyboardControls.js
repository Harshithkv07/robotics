import { useEffect } from 'react';

export function useKeyboardControls(actions) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case '1':
          if (actions.setCameraMode) actions.setCameraMode('Orbit');
          break;
        case '2':
          if (actions.setCameraMode) actions.setCameraMode('Top-Down');
          break;
        case '3':
          if (actions.setCameraMode) actions.setCameraMode('Chase');
          break;
        case '4':
          if (actions.setCameraMode) actions.setCameraMode('Hitch Cam');
          break;
        case 'd':
          if (actions.injectDisturbance) actions.injectDisturbance();
          break;
        case 'p':
          if (actions.triggerTour) actions.triggerTour();
          break;
        case 'm':
          if (actions.toggleMatrixInspector) actions.toggleMatrixInspector();
          break;
        case ' ':
          e.preventDefault(); 
          if (actions.togglePause) actions.togglePause();
          break;
        case 'escape':
          if (actions.cancelTour) actions.cancelTour();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}

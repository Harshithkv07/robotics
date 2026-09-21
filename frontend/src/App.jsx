import React, { useState } from 'react';
import { useWebSocket } from './components/hooks/useWebSocket';
import { Scene } from './components/3d/Scene';
import { WifiOff } from 'lucide-react';

import { ControlPanel } from './components/ui/ControlPanel';
import { MetricCards } from './components/ui/MetricCards';
import { InspectorPanel } from './components/ui/InspectorPanel';
import { InstrumentCluster } from './components/ui/InstrumentCluster';
import { TelemetryCharts } from './components/ui/TelemetryCharts';
import { ShowstopperDemo } from './components/ui/ShowstopperDemo';
import { useKeyboardControls } from './components/hooks/useKeyboardControls';

export default function App() {
  const {
    connected,
    telemetry,
    sendSetProfile,
    sendInjectDisturbance,
    sendSetTrajectory,
    sendPauseResume,
    sendReset
  } = useWebSocket('ws://localhost:8765');

  const [cameraMode, setCameraMode] = useState('Orbit');
  const [showAxes, setShowAxes] = useState(true);
  const [showRibbon, setShowRibbon] = useState(true);
  const [inspectorTab, setInspectorTab] = useState('camera');

  const tourRef = React.useRef({});
  const registerTourController = React.useCallback((controllers) => {
    tourRef.current = controllers;
  }, []);

  const injectDist = React.useCallback(() => {
    sendInjectDisturbance(3, 0.261); // 15 degrees
  }, [sendInjectDisturbance]);

  const keyboardActions = React.useMemo(() => ({
    setCameraMode,
    injectDisturbance: injectDist,
    triggerTour: () => { if (tourRef.current.triggerTour) tourRef.current.triggerTour(); },
    cancelTour: () => { if (tourRef.current.cancelTour) tourRef.current.cancelTour(); },
    toggleMatrixInspector: () => setInspectorTab(prev => prev === 'matrix' ? 'camera' : 'matrix'),
    togglePause: sendPauseResume
  }), [injectDist, sendPauseResume]);

  useKeyboardControls(keyboardActions);

  const demoActions = React.useMemo(() => ({
    sendSetProfile,
    sendSetTrajectory,
    setCameraMode,
    setMatrixInspector: (show) => setInspectorTab(show ? 'matrix' : 'camera'),
    injectDisturbance: injectDist,
    registerTourController
  }), [sendSetProfile, sendSetTrajectory, injectDist, registerTourController]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070a] text-white font-sans selection:bg-cyan-500/30">

      {/* 3D Viewport Layer (Z-0) */}
      <div className="absolute inset-0 z-0">
        <Scene
          telemetry={telemetry}
          cameraMode={cameraMode}
          showAxes={showAxes}
          showRibbon={showRibbon}
        />
      </div>

      {/* Connection Lost Overlay (Z-20) */}
      {!connected && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#05070a]/70 backdrop-blur-sm pointer-events-none">
          <div className="panel-cockpit flex items-center gap-3 px-6 py-4 rounded-2xl">
            <WifiOff className="w-5 h-5 text-rose-400 animate-pulse" />
            <div>
              <p className="font-bold text-rose-400 text-sm uppercase tracking-widest text-display">Backend Disconnected</p>
              <p className="text-xs text-slate-400 mt-0.5">Attempting to reconnect to ws://localhost:8765...</p>
            </div>
          </div>
        </div>
      )}

      {/* UI Overlay Layer (Z-10) */}
      <div className="absolute inset-0 z-10 pointer-events-none p-6 flex flex-col justify-between">

        {/* Top Region */}
        <div className="flex justify-between items-start w-full">
          <MetricCards metrics={telemetry?.metrics} connected={connected} hasHitch={telemetry?.states?.psi_1 !== undefined} />
        </div>

        {/* Middle Region: Left/Right panels. Both are height-bounded with their own
            internal scroll so stacked content can never get clipped by the viewport
            the way an unbounded `items-end` flex column would silently overflow. */}
        <div className="flex justify-between items-start flex-1 my-6 pointer-events-none min-h-0">
          <div className="pointer-events-auto self-start">
            <InspectorPanel
              cameraMode={cameraMode} setCameraMode={setCameraMode}
              showAxes={showAxes} setShowAxes={setShowAxes}
              showRibbon={showRibbon} setShowRibbon={setShowRibbon}
              transforms={telemetry?.transforms}
              states={telemetry?.states}
              tab={inspectorTab}
              setTab={setInspectorTab}
            />
          </div>

          <div className="pointer-events-auto self-center">
            <TelemetryCharts telemetry={telemetry} />
          </div>
        </div>

        {/* Bottom Region: Instrument Cluster + Console */}
        <div className="flex flex-col items-center w-full gap-4">
          {telemetry?.controls && (
            <InstrumentCluster controls={telemetry.controls} states={telemetry.states} />
          )}
          <div className="flex justify-center w-full items-end gap-4">
            <ShowstopperDemo actions={demoActions} />
            <ControlPanel
              telemetry={telemetry}
              sendSetProfile={sendSetProfile}
              sendSetTrajectory={sendSetTrajectory}
              sendInjectDisturbance={injectDist}
              sendPauseResume={sendPauseResume}
              sendReset={sendReset}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

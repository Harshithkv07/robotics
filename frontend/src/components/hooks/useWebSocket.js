import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url = 'ws://localhost:8765') {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let active = true;
    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      
      ws.onopen = () => {
        if (active) setConnected(true);
      };
      
      ws.onclose = () => {
        if (active) {
          setConnected(false);
          setTimeout(connect, 1000); // Reconnect
        }
      };
      
      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') {
            setTelemetry(data);
          }
        } catch (err) {
          console.error("Failed to parse telemetry", err);
        }
      };
    };
    
    connect();
    
    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, [url]);

  const sendCommand = useCallback((command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(command));
    }
  }, []);

  const sendSetProfile = useCallback((profile) => {
    sendCommand({ type: 'set_profile', profile });
  }, [sendCommand]);

  const sendInjectDisturbance = useCallback((index, value) => {
    sendCommand({ type: 'inject_disturbance', index, value });
  }, [sendCommand]);

  const sendSetTrajectory = useCallback((name) => {
    sendCommand({ type: 'set_trajectory', name });
  }, [sendCommand]);

  const sendPauseResume = useCallback(() => {
    sendCommand({ type: 'pause_resume' });
  }, [sendCommand]);

  const sendReset = useCallback(() => {
    sendCommand({ type: 'reset' });
  }, [sendCommand]);

  return {
    connected,
    telemetry,
    sendSetProfile,
    sendInjectDisturbance,
    sendSetTrajectory,
    sendPauseResume,
    sendReset
  };
}

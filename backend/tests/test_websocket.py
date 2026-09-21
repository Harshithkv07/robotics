import pytest
import asyncio
import time
import json
import numpy as np
import websockets
from api.protocol import encode_telemetry, decode_command
from api.websocket_server import SimulationServer

def test_protocol_serialization():
    states = np.array([1.0, 2.0, 0.5])
    controls = np.array([1.0, 0.1])
    transforms = {"link1": np.eye(4)}
    predicted_horizon = np.array([[1.0, 2.0, 0.5], [1.1, 2.1, 0.5]])
    metrics = {"e_y": 0.1, "solve_time_ms": 1.5}
    
    start_time = time.time()
    payload = encode_telemetry(
        timestamp=10.0,
        active_profile="AckermannCar",
        states=states,
        controls=controls,
        transforms=transforms,
        predicted_horizon=predicted_horizon,
        metrics=metrics
    )
    end_time = time.time()
    
    # Soft assert as exact time is env dependent, but typical serialization takes ~0.1ms
    assert end_time - start_time < 0.005, "Serialization overhead too high"
    
    data = json.loads(payload)
    assert data["type"] == "telemetry"
    assert data["timestamp"] == 10.0
    assert data["active_profile"] == "AckermannCar"
    assert "x" in data["states"]
    assert "v" in data["controls"]
    assert "link1" in data["transforms"]
    assert len(data["transforms"]["link1"]) == 16
    assert len(data["predicted_horizon"]) == 2

def test_command_decoding():
    msg = json.dumps({"type": "set_profile", "profile": "MultiTrailer"})
    cmd = decode_command(msg)
    assert cmd["type"] == "set_profile"
    assert cmd["profile"] == "MultiTrailer"

    with pytest.raises(ValueError):
        decode_command('{"invalid": "json"')

    with pytest.raises(ValueError):
        decode_command('{"notype": "here"}')

    with pytest.raises(ValueError):
        decode_command('{"type": "hack_server"}')

def test_command_handling_disturbance():
    server = SimulationServer()
    server._setup_profile("SingleTrailer")
    server.X = np.array([0.0, 0.0, 0.0, 0.0])
    
    cmd_msg = json.dumps({
        "type": "inject_disturbance",
        "index": 3,
        "value": 0.261 # ~15 degrees
    })
    
    server.process_command(cmd_msg)
    
    assert np.isclose(server.X[3], 0.261), "Disturbance not injected correctly"

    # Run one step of NMPC to verify it counter-steers
    X_ref = server.trajectory.get_reference(0.0, server.solver.Np, server.dt)
    u_opt, _, _, _ = server.solver.solve(server.X, X_ref, server.u_prev)
    
    # Counter-steer should occur.
    assert abs(u_opt[1]) > 0.0, "NMPC did not respond to disturbance"

def test_rate_stability():
    server = SimulationServer()
    server.running = True
    server._setup_profile("AckermannCar")
    
    # Mock the solver so hardware limits don't block the 50Hz loop
    server.solver.solve = lambda X, X_ref, u_prev: (np.zeros(2), np.zeros((31, 3)), 0.0, np.zeros((30, 2)))
    
    times = []
    
    async def mock_loop():
        for _ in range(15):
            start_time = time.time()
            X_ref = server.trajectory.get_reference(server.t, server.solver.Np, server.dt)
            u_opt, X_pred, _, server.u_prev = server.solver.solve(server.X, X_ref, server.u_prev)
            server.X = server.model.step(server.X, u_opt, server.dt)
            server.t += server.dt
            
            elapsed = time.time() - start_time
            sleep_time = max(0, server.dt - elapsed)
            await asyncio.sleep(sleep_time)
            times.append(time.time())

    asyncio.run(mock_loop())
    
    intervals = np.diff(times)
    # Exclude first couple of times as warmup might interfere with stability
    avg_interval = np.mean(intervals[2:])
    hz = 1.0 / avg_interval
    
    print(f"Average loop Hz: {hz:.2f}")
    assert 25.0 <= hz <= 60.0, f"Rate stability failed, Hz: {hz:.2f}"

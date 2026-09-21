import json
import numpy as np

# The backend's TransformTree keys are descriptive (world_to_trailer1, ...) so they stay
# self-documenting for tests and console tools. The frontend's Vehicle/Camera components
# only care about the short link roles, so remap at the wire boundary.
TRANSFORM_KEY_MAP = {
    "world_to_base": "base",
    "world_to_hitch1": "hitch1",
    "world_to_trailer1": "link1",
    "world_to_hitch2": "hitch2",
    "world_to_trailer2": "link2",
}

def encode_telemetry(
    timestamp: float,
    active_profile: str,
    states: np.ndarray,
    controls: np.ndarray,
    transforms: dict,
    predicted_horizon: np.ndarray,
    metrics: dict,
    active_trajectory: str = "",
    reference_horizon: np.ndarray = None
) -> str:
    state_dict = {}
    if active_profile in ["DifferentialDrive", "AckermannCar"]:
        state_dict = {"x": float(states[0]), "y": float(states[1]), "theta": float(states[2])}
    elif active_profile == "SingleTrailer":
        state_dict = {"x": float(states[0]), "y": float(states[1]), "theta_0": float(states[2]), "psi_1": float(states[3])}
    elif active_profile == "MultiTrailer":
        state_dict = {"x": float(states[0]), "y": float(states[1]), "theta_0": float(states[2]), "psi_1": float(states[3]), "psi_2": float(states[4])}

    control_dict = {}
    if active_profile == "DifferentialDrive":
        control_dict = {"v": float(controls[0]), "omega": float(controls[1])}
    else:
        control_dict = {"v": float(controls[0]), "delta": float(controls[1])}

    transforms_flat = {}
    for key, matrix in transforms.items():
        out_key = TRANSFORM_KEY_MAP.get(key, key)
        if isinstance(matrix, np.ndarray):
            transforms_flat[out_key] = [float(x) for x in matrix.flatten()]
        elif isinstance(matrix, list):
            # If it's already a nested list, flatten it manually
            arr = np.array(matrix)
            transforms_flat[out_key] = [float(x) for x in arr.flatten()]
        else:
            transforms_flat[out_key] = matrix

    def _encode_horizon(horizon):
        points = []
        if horizon is not None:
            for pt in horizon:
                points.append([float(pt[0]), float(pt[1]), float(pt[2])])
        return points

    horizon_list = _encode_horizon(predicted_horizon)
    reference_list = _encode_horizon(reference_horizon)

    # Ensure metrics are float
    metrics_float = {k: float(v) if isinstance(v, (int, float, np.number)) else v for k, v in metrics.items()}

    payload = {
        "type": "telemetry",
        "timestamp": float(timestamp),
        "active_profile": active_profile,
        "active_trajectory": active_trajectory,
        "states": state_dict,
        "controls": control_dict,
        "transforms": transforms_flat,
        "predicted_horizon": horizon_list,
        "reference_horizon": reference_list,
        "metrics": metrics_float
    }

    return json.dumps(payload)

def decode_command(message: str) -> dict:
    try:
        data = json.loads(message)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON")

    if "type" not in data:
        raise ValueError("Command missing 'type' field")
        
    valid_types = ["set_profile", "inject_disturbance", "set_trajectory", "pause_resume", "reset"]
    if data["type"] not in valid_types:
        raise ValueError(f"Unknown command type: {data['type']}")
        
    return data

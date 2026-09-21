import numpy as np
from typing import Dict, Any

def create_transform_matrix(x: float, y: float, theta: float) -> np.ndarray:
    """
    Creates a 4x4 Homogeneous Transformation Matrix for a 2D pose (x, y, theta).
    Represents T in SE(2) embedded in SE(3).
    """
    c = np.cos(theta)
    s = np.sin(theta)
    
    return np.array([
        [c, -s, 0.0, x],
        [s,  c, 0.0, y],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0]
    ])

class TransformTree:
    """
    Dynamically computes the 4x4 transformation matrices for link coordinate frames.
    """

    @staticmethod
    def differential_drive_transforms(X: np.ndarray) -> Dict[str, np.ndarray]:
        """
        X = [x, y, theta]
        """
        x, y, theta = X
        return {"world_to_base": create_transform_matrix(x, y, theta)}

    @staticmethod
    def ackermann_car_transforms(X: np.ndarray, L1: float) -> Dict[str, np.ndarray]:
        """
        X = [x, y, theta]
        """
        x, y, theta = X
        return {"world_to_base": create_transform_matrix(x, y, theta)}

    @staticmethod
    def single_trailer_transforms(X: np.ndarray, d1: float, L2: float) -> Dict[str, np.ndarray]:
        """
        Computes dynamic joint-to-link chain matrices for SingleTrailer.
        X = [x, y, theta_0, psi_1]
        """
        x, y, theta_0, psi_1 = X
        
        # World to Base (Tractor rear axle)
        T_world_base = create_transform_matrix(x, y, theta_0)
        
        # Base to Hitch 1 (translation by -d1 along base's X-axis)
        T_base_hitch1 = create_transform_matrix(-d1, 0.0, 0.0)
        
        # Hitch 1 to Trailer 1: Rotate by -psi_1, then translate by -L2 along the new X-axis
        T_rot1 = create_transform_matrix(0.0, 0.0, -psi_1)
        T_trans1 = create_transform_matrix(-L2, 0.0, 0.0)
        T_hitch1_trailer1 = T_rot1 @ T_trans1
        
        T_world_hitch1 = T_world_base @ T_base_hitch1
        T_world_trailer1 = T_world_hitch1 @ T_hitch1_trailer1
        
        return {
            "world_to_base": T_world_base,
            "base_to_hitch1": T_base_hitch1,
            "hitch1_to_trailer1": T_hitch1_trailer1,
            "world_to_hitch1": T_world_hitch1,
            "world_to_trailer1": T_world_trailer1
        }
        
    @staticmethod
    def multi_trailer_transforms(X: np.ndarray, d1: float, L2: float, d2: float, L3: float) -> Dict[str, np.ndarray]:
        """
        Computes dynamic joint-to-link chain matrices for MultiTrailer.
        X = [x, y, theta_0, psi_1, psi_2]
        """
        x, y, theta_0, psi_1, psi_2 = X
        
        # World to Base
        T_world_base = create_transform_matrix(x, y, theta_0)
        
        # Base to Hitch 1
        T_base_hitch1 = create_transform_matrix(-d1, 0.0, 0.0)
        T_world_hitch1 = T_world_base @ T_base_hitch1
        
        # Hitch 1 to Trailer 1
        T_rot1 = create_transform_matrix(0.0, 0.0, -psi_1)
        T_trans1 = create_transform_matrix(-L2, 0.0, 0.0)
        T_hitch1_trailer1 = T_rot1 @ T_trans1
        T_world_trailer1 = T_world_hitch1 @ T_hitch1_trailer1
        
        # Trailer 1 to Hitch 2
        T_trailer1_hitch2 = create_transform_matrix(-d2, 0.0, 0.0)
        T_world_hitch2 = T_world_trailer1 @ T_trailer1_hitch2
        
        # Hitch 2 to Trailer 2
        T_rot2 = create_transform_matrix(0.0, 0.0, -psi_2)
        T_trans2 = create_transform_matrix(-L3, 0.0, 0.0)
        T_hitch2_trailer2 = T_rot2 @ T_trans2
        T_world_trailer2 = T_world_hitch2 @ T_hitch2_trailer2
        
        return {
            "world_to_base": T_world_base,
            "base_to_hitch1": T_base_hitch1,
            "hitch1_to_trailer1": T_hitch1_trailer1,
            "trailer1_to_hitch2": T_trailer1_hitch2,
            "hitch2_to_trailer2": T_hitch2_trailer2,
            "world_to_hitch1": T_world_hitch1,
            "world_to_trailer1": T_world_trailer1,
            "world_to_hitch2": T_world_hitch2,
            "world_to_trailer2": T_world_trailer2
        }

    @staticmethod
    def get_json_serializable_tree(transforms_dict: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """
        Utility returning a full JSON-serializable dictionary of all active coordinate frames.
        """
        return {k: v.tolist() for k, v in transforms_dict.items()}

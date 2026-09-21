from dataclasses import dataclass
from typing import Tuple

@dataclass
class DifferentialDriveProfile:
    r: float # Wheel radius
    w: float # Track width
    # State bounds (min, max): [x, y, theta]
    X_bounds: Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float]]
    # Input bounds (min, max): [v, omega]
    U_bounds: Tuple[Tuple[float, float], Tuple[float, float]]

@dataclass
class AckermannCarProfile:
    L1: float # Wheelbase
    w: float # Track width
    r: float # Wheel radius
    # State bounds (min, max): [x, y, theta]
    X_bounds: Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float]]
    # Input bounds (min, max): [v, delta]
    U_bounds: Tuple[Tuple[float, float], Tuple[float, float]]

@dataclass
class SingleTrailerProfile:
    L1: float # Tractor wheelbase
    L2: float # Trailer wheelbase
    d1: float # Hitch offset from rear axle
    w: float # Track width
    r: float # Wheel radius
    # State bounds: [x, y, theta_0, psi_1]
    X_bounds: Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float], Tuple[float, float]]
    # Input bounds: [v, delta]
    U_bounds: Tuple[Tuple[float, float], Tuple[float, float]]

@dataclass
class MultiTrailerProfile:
    L1: float # Tractor wheelbase
    L2: float # Trailer 1 wheelbase
    L3: float # Trailer 2 wheelbase
    d1: float # Hitch 1 offset from rear axle of tractor
    d2: float # Hitch 2 offset from rear axle of trailer 1
    w: float # Track width
    r: float # Wheel radius
    # State bounds: [x, y, theta_0, psi_1, psi_2]
    X_bounds: Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float], Tuple[float, float], Tuple[float, float]]
    # Input bounds: [v, delta]
    U_bounds: Tuple[Tuple[float, float], Tuple[float, float]]

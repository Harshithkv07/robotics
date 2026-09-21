import numpy as np
from core.profiles import (
    DifferentialDriveProfile,
    AckermannCarProfile,
    SingleTrailerProfile,
    MultiTrailerProfile
)

class KinematicsModel:
    def step(self, X: np.ndarray, U: np.ndarray, dt: float) -> np.ndarray:
        """
        4th-Order Runge-Kutta (RK4) integration step.
        """
        k1 = self.compute_derivatives(X, U)
        k2 = self.compute_derivatives(X + 0.5 * dt * k1, U)
        k3 = self.compute_derivatives(X + 0.5 * dt * k2, U)
        k4 = self.compute_derivatives(X + dt * k3, U)
        
        X_next = X + (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4)
        return self._clip_state(X_next)
        
    def compute_derivatives(self, X: np.ndarray, U: np.ndarray) -> np.ndarray:
        raise NotImplementedError

    def _clip_state(self, X: np.ndarray) -> np.ndarray:
        return X

class DifferentialDrive(KinematicsModel):
    def __init__(self, profile: DifferentialDriveProfile):
        self.profile = profile
        
    def compute_derivatives(self, X: np.ndarray, U: np.ndarray) -> np.ndarray:
        x, y, theta = X
        v, omega = U
        
        x_dot = v * np.cos(theta)
        y_dot = v * np.sin(theta)
        theta_dot = omega
        
        return np.array([x_dot, y_dot, theta_dot])
        
    def _clip_state(self, X: np.ndarray) -> np.ndarray:
        X = np.copy(X)
        X[2] = (X[2] + np.pi) % (2 * np.pi) - np.pi
        return X

class AckermannCar(KinematicsModel):
    def __init__(self, profile: AckermannCarProfile):
        self.profile = profile
        
    def compute_derivatives(self, X: np.ndarray, U: np.ndarray) -> np.ndarray:
        x, y, theta = X
        v, delta = U
        
        x_dot = v * np.cos(theta)
        y_dot = v * np.sin(theta)
        theta_dot = (v / self.profile.L1) * np.tan(delta)
        
        return np.array([x_dot, y_dot, theta_dot])
        
    def _clip_state(self, X: np.ndarray) -> np.ndarray:
        X = np.copy(X)
        X[2] = (X[2] + np.pi) % (2 * np.pi) - np.pi
        return X

class SingleTrailer(KinematicsModel):
    def __init__(self, profile: SingleTrailerProfile):
        self.profile = profile
        
    def compute_derivatives(self, X: np.ndarray, U: np.ndarray) -> np.ndarray:
        x, y, theta_0, psi_1 = X
        v, delta = U
        L1 = self.profile.L1
        L2 = self.profile.L2
        d1 = self.profile.d1
        
        x_dot = v * np.cos(theta_0)
        y_dot = v * np.sin(theta_0)
        theta_0_dot = (v / L1) * np.tan(delta)
        
        psi_1_dot = (v / L2) * np.sin(psi_1) + theta_0_dot * (1 - (d1 / L2) * np.cos(psi_1))
        
        return np.array([x_dot, y_dot, theta_0_dot, psi_1_dot])
        
    def _clip_state(self, X: np.ndarray) -> np.ndarray:
        X = np.copy(X)
        X[2] = (X[2] + np.pi) % (2 * np.pi) - np.pi
        X[3] = (X[3] + np.pi) % (2 * np.pi) - np.pi
        return X

class MultiTrailer(KinematicsModel):
    def __init__(self, profile: MultiTrailerProfile):
        self.profile = profile
        
    def compute_derivatives(self, X: np.ndarray, U: np.ndarray) -> np.ndarray:
        x, y, theta_0, psi_1, psi_2 = X
        v, delta = U
        L1 = self.profile.L1
        L2 = self.profile.L2
        L3 = self.profile.L3
        d1 = self.profile.d1
        d2 = self.profile.d2
        
        x_dot = v * np.cos(theta_0)
        y_dot = v * np.sin(theta_0)
        theta_0_dot = (v / L1) * np.tan(delta)
        
        psi_1_dot = (v / L2) * np.sin(psi_1) + theta_0_dot * (1 - (d1 / L2) * np.cos(psi_1))
        
        theta_1_dot = theta_0_dot - psi_1_dot
        v1 = v * np.cos(psi_1) + d1 * theta_0_dot * np.sin(psi_1)
        
        psi_2_dot = (v1 / L3) * np.sin(psi_2) + theta_1_dot * (1 - (d2 / L3) * np.cos(psi_2))
        
        return np.array([x_dot, y_dot, theta_0_dot, psi_1_dot, psi_2_dot])

    def _clip_state(self, X: np.ndarray) -> np.ndarray:
        X = np.copy(X)
        X[2] = (X[2] + np.pi) % (2 * np.pi) - np.pi
        X[3] = (X[3] + np.pi) % (2 * np.pi) - np.pi
        X[4] = (X[4] + np.pi) % (2 * np.pi) - np.pi
        return X

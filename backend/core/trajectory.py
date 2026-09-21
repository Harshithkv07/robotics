import numpy as np

class ReferenceTrajectory:
    def __init__(self, state_dim: int = 3):
        self.state_dim = state_dim

    def get_state_at_time(self, t: float) -> np.ndarray:
        raise NotImplementedError

    def get_reference(self, t_start: float, Np: int, dt: float) -> np.ndarray:
        """
        Returns Np states starting from t_start, with interval dt.
        Shape: (Np, state_dim)
        """
        ref = np.zeros((Np, self.state_dim))
        for i in range(Np):
            t = t_start + i * dt
            ref[i, :] = self.get_state_at_time(t)
        return ref

class StraightTrajectory(ReferenceTrajectory):
    def __init__(self, v: float, x0: float = 0, y0: float = 0, theta: float = 0, state_dim: int = 3):
        super().__init__(state_dim)
        self.v = v
        self.x0 = x0
        self.y0 = y0
        self.theta = theta

    def get_state_at_time(self, t: float) -> np.ndarray:
        x = self.x0 + self.v * t * np.cos(self.theta)
        y = self.y0 + self.v * t * np.sin(self.theta)
        
        state = np.zeros(self.state_dim)
        state[0] = x
        state[1] = y
        state[2] = self.theta
        return state

class CurvilinearTrajectory(ReferenceTrajectory):
    def __init__(self, v: float, amplitude: float = 2.0, frequency: float = 0.5, state_dim: int = 3):
        super().__init__(state_dim)
        self.v = v
        self.amplitude = amplitude
        self.frequency = frequency

    def get_state_at_time(self, t: float) -> np.ndarray:
        x = self.v * t
        y = self.amplitude * np.sin(self.frequency * x)
        
        dy_dx = self.amplitude * self.frequency * np.cos(self.frequency * x)
        theta = np.arctan(dy_dx)
        
        state = np.zeros(self.state_dim)
        state[0] = x
        state[1] = y
        state[2] = theta
        return state

class DockingTrajectory(ReferenceTrajectory):
    """
    Reverse S-curve into a narrow bay.
    """
    def __init__(self, v: float = -1.0, start_x: float = 10.0, start_y: float = 5.0, bay_x: float = 0.0, bay_y: float = 0.0, state_dim: int = 4):
        super().__init__(state_dim)
        self.v = v  # usually negative for reverse
        self.start_x = start_x
        self.start_y = start_y
        self.bay_x = bay_x
        self.bay_y = bay_y

    def get_state_at_time(self, t: float) -> np.ndarray:
        dist_x = self.start_x - self.bay_x
        total_time = abs(dist_x / self.v) if self.v != 0 else 10.0
        
        # Clamp t to total_time so it stops at the bay
        t_clamped = min(t, total_time)
        
        # Progress 0 to 1
        progress = t_clamped / total_time if total_time > 0 else 1.0
        
        # x goes from start_x to bay_x linearly
        x = self.start_x + self.v * t_clamped
        
        # y goes from start_y to bay_y using a smooth curve, like cosine
        y = self.bay_y + (self.start_y - self.bay_y) * (0.5 + 0.5 * np.cos(np.pi * progress))
        
        if total_time > 0 and self.v != 0:
            dy_dt = (self.start_y - self.bay_y) * (-0.5 * np.pi * np.sin(np.pi * progress)) / total_time
            dx_dt = self.v
            theta = np.arctan2(dy_dt, dx_dt)
        else:
            theta = 0.0
            
        state = np.zeros(self.state_dim)
        state[0] = x
        state[1] = y
        
        # When moving backwards, we might want theta to represent the orientation
        # Since dx_dt < 0, arctan2 will give angles near pi or -pi.
        # But wait, arctan2(dy, dx) is the direction of velocity. 
        # For reverse driving, the front of the vehicle points in the opposite direction.
        if self.v < 0:
            theta = theta - np.pi
            # Normalize to [-pi, pi]
            theta = (theta + np.pi) % (2 * np.pi) - np.pi

        state[2] = theta
        return state

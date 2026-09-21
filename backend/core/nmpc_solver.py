import casadi as ca
import numpy as np
from typing import Tuple
from core.profiles import (
    DifferentialDriveProfile,
    AckermannCarProfile,
    SingleTrailerProfile,
    MultiTrailerProfile
)
import time

class AdaptiveNMPCSolver:
    def __init__(self, profile, Np: int = 30, dt: float = 0.05):
        self.profile = profile
        self.Np = Np
        self.dt = dt
        
        # Determine sizes and weights
        if isinstance(profile, DifferentialDriveProfile):
            self.nx = 3
            self.nu = 2
            self.Q = np.diag([10.0, 10.0, 1.0])
            self.R = np.diag([0.1, 0.1])
            self.S = np.diag([1.0, 1.0])
        elif isinstance(profile, AckermannCarProfile):
            self.nx = 3
            self.nu = 2
            self.Q = np.diag([10.0, 10.0, 1.0])
            self.R = np.diag([0.1, 0.1])
            self.S = np.diag([1.0, 1.0])
        elif isinstance(profile, SingleTrailerProfile):
            self.nx = 4
            self.nu = 2
            self.Q = np.diag([10.0, 10.0, 1.0, 0.5])
            self.R = np.diag([0.1, 0.1])
            self.S = np.diag([1.0, 1.0])
        elif isinstance(profile, MultiTrailerProfile):
            self.nx = 5
            self.nu = 2
            self.Q = np.diag([10.0, 10.0, 1.0, 0.5, 0.5])
            self.R = np.diag([0.1, 0.1])
            self.S = np.diag([1.0, 1.0])
        else:
            raise ValueError("Unknown profile")
            
        self._setup_solver()

    def _compute_derivatives(self, X, U):
        if isinstance(self.profile, DifferentialDriveProfile):
            x, y, theta = X[0], X[1], X[2]
            v, omega = U[0], U[1]
            return ca.vertcat(v * ca.cos(theta), v * ca.sin(theta), omega)
            
        elif isinstance(self.profile, AckermannCarProfile):
            x, y, theta = X[0], X[1], X[2]
            v, delta = U[0], U[1]
            L1 = self.profile.L1
            return ca.vertcat(v * ca.cos(theta), v * ca.sin(theta), (v / L1) * ca.tan(delta))
            
        elif isinstance(self.profile, SingleTrailerProfile):
            x, y, theta_0, psi_1 = X[0], X[1], X[2], X[3]
            v, delta = U[0], U[1]
            L1 = self.profile.L1
            L2 = self.profile.L2
            d1 = self.profile.d1
            
            theta_0_dot = (v / L1) * ca.tan(delta)
            psi_1_dot = (v / L2) * ca.sin(psi_1) + theta_0_dot * (1 - (d1 / L2) * ca.cos(psi_1))
            
            return ca.vertcat(v * ca.cos(theta_0), v * ca.sin(theta_0), theta_0_dot, psi_1_dot)
            
        elif isinstance(self.profile, MultiTrailerProfile):
            x, y, theta_0, psi_1, psi_2 = X[0], X[1], X[2], X[3], X[4]
            v, delta = U[0], U[1]
            L1 = self.profile.L1
            L2 = self.profile.L2
            L3 = self.profile.L3
            d1 = self.profile.d1
            d2 = self.profile.d2
            
            theta_0_dot = (v / L1) * ca.tan(delta)
            psi_1_dot = (v / L2) * ca.sin(psi_1) + theta_0_dot * (1 - (d1 / L2) * ca.cos(psi_1))
            theta_1_dot = theta_0_dot - psi_1_dot
            v1 = v * ca.cos(psi_1) + d1 * theta_0_dot * ca.sin(psi_1)
            psi_2_dot = (v1 / L3) * ca.sin(psi_2) + theta_1_dot * (1 - (d2 / L3) * ca.cos(psi_2))
            
            return ca.vertcat(v * ca.cos(theta_0), v * ca.sin(theta_0), theta_0_dot, psi_1_dot, psi_2_dot)

    def _setup_solver(self):
        # Multiple shooting formulation
        self.X_sym = ca.SX.sym('X', self.nx, self.Np + 1)
        self.U_sym = ca.SX.sym('U', self.nu, self.Np)
        self.X_ref_sym = ca.SX.sym('X_ref', self.nx, self.Np)
        self.X0_sym = ca.SX.sym('X0', self.nx)
        
        cost = 0
        constraints = []
        
        # Initial condition constraint
        constraints.append(self.X_sym[:, 0] - self.X0_sym)
        
        # RK4 and cost
        for k in range(self.Np):
            Xk = self.X_sym[:, k]
            Uk = self.U_sym[:, k]
            Xref_k = self.X_ref_sym[:, k]
            
            # Tracking cost
            # Note: We need to handle angular differences specially if we want them to wrap,
            # but for NMPC locally it's often sufficient to just use quadratic error
            # as long as reference angles are continuous.
            err = Xk - Xref_k
            cost += ca.mtimes([err.T, self.Q, err])
            
            # Control cost
            cost += ca.mtimes([Uk.T, self.R, Uk])
            
            # Control rate cost
            if k > 0:
                dU = Uk - self.U_sym[:, k-1]
                cost += ca.mtimes([dU.T, self.S, dU])
            
            # Dynamics (RK4)
            k1 = self._compute_derivatives(Xk, Uk)
            k2 = self._compute_derivatives(Xk + 0.5 * self.dt * k1, Uk)
            k3 = self._compute_derivatives(Xk + 0.5 * self.dt * k2, Uk)
            k4 = self._compute_derivatives(Xk + self.dt * k3, Uk)
            X_next = Xk + (self.dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4)
            
            constraints.append(self.X_sym[:, k+1] - X_next)
            
        # Variables and parameters
        OPT_variables = ca.vertcat(ca.reshape(self.X_sym, -1, 1), ca.reshape(self.U_sym, -1, 1))
        OPT_parameters = ca.vertcat(self.X0_sym, ca.reshape(self.X_ref_sym, -1, 1))
        
        # Constraints formulation
        g = ca.vertcat(*constraints)
        
        nlp = {
            'x': OPT_variables,
            'f': cost,
            'g': g,
            'p': OPT_parameters
        }
        
        opts = {
            'ipopt.print_level': 0,
            'print_time': 0,
            'ipopt.tol': 1e-3,
            'ipopt.acceptable_tol': 1e-3,
            'ipopt.max_iter': 100,
            'ipopt.warm_start_init_point': 'yes'
        }
        
        self.solver = ca.nlpsol('solver', 'ipopt', nlp, opts)
        
        # Bounds setup
        self._setup_bounds()
        
    def _setup_bounds(self):
        # Equality constraints for multiple shooting dynamics -> bounds are 0
        self.lbg = [0] * (self.nx * (self.Np + 1))
        self.ubg = [0] * (self.nx * (self.Np + 1))
        
        self.lbx = []
        self.ubx = []
        
        # Jackknife bounds: |psi_i| <= 45 degrees
        psi_crit = np.pi / 4.0
        
        X_min = [float(b[0]) for b in self.profile.X_bounds]
        X_max = [float(b[1]) for b in self.profile.X_bounds]
        
        # Apply jackknife bounds explicitly
        if self.nx >= 4:
            X_min[3] = max(X_min[3], -psi_crit)
            X_max[3] = min(X_max[3], psi_crit)
        if self.nx >= 5:
            X_min[4] = max(X_min[4], -psi_crit)
            X_max[4] = min(X_max[4], psi_crit)
            
        for k in range(self.Np + 1):
            self.lbx.extend(X_min)
            self.ubx.extend(X_max)
            
        # Control bounds
        U_min = [float(b[0]) for b in self.profile.U_bounds]
        U_max = [float(b[1]) for b in self.profile.U_bounds]
        
        for k in range(self.Np):
            self.lbx.extend(U_min)
            self.ubx.extend(U_max)

    def set_input_bounds(self, v_bounds: Tuple[float, float] = None, delta_bounds: Tuple[float, float] = None):
        """
        Overrides the velocity/steering bounds in-place (e.g. reverse-only driving
        during a docking maneuver) without rebuilding the state (jackknife) bounds.
        Passing None for either restores that input's bound from the profile.
        """
        v_bounds = v_bounds if v_bounds is not None else self.profile.U_bounds[0]
        delta_bounds = delta_bounds if delta_bounds is not None else self.profile.U_bounds[1]

        U_min = [float(v_bounds[0]), float(delta_bounds[0])]
        U_max = [float(v_bounds[1]), float(delta_bounds[1])]

        state_vars = self.nx * (self.Np + 1)
        for k in range(self.Np):
            offset = state_vars + k * self.nu
            self.lbx[offset:offset + self.nu] = U_min
            self.ubx[offset:offset + self.nu] = U_max

    def solve(self, X0: np.ndarray, X_ref: np.ndarray, U_guess_prev: np.ndarray = None) -> Tuple[np.ndarray, np.ndarray, float, np.ndarray]:
        """
        Solves the NMPC problem.
        X_ref: shape (Np, nx)
        Returns:
            U_opt: First optimal control (nu,)
            X_pred: Predicted trajectory (Np+1, nx)
            solve_time: time taken by ipopt
            U_guess: Guess for next iteration (warmstart)
        """
        if U_guess_prev is None:
            U_guess_prev = np.zeros((self.Np, self.nu))
            
        P = np.concatenate([X0, X_ref.flatten()])
        
        # We can create an X_guess using U_guess_prev (or just flat)
        X_guess = np.tile(X0, self.Np + 1)
        U_guess_flat = U_guess_prev.flatten()
        X0_opt = np.concatenate([X_guess, U_guess_flat])
        
        t_start = time.time()
        
        res = self.solver(
            x0=X0_opt,
            p=P,
            lbx=self.lbx,
            ubx=self.ubx,
            lbg=self.lbg,
            ubg=self.ubg
        )
        
        t_end = time.time()
        
        opt_x = res['x'].full().flatten()
        
        X_pred = opt_x[:self.nx * (self.Np + 1)].reshape((self.Np + 1, self.nx))
        U_pred = opt_x[self.nx * (self.Np + 1):].reshape((self.Np, self.nu))
        
        # Shift controls for next warmstart
        U_guess_next = np.vstack([U_pred[1:], U_pred[-1:]])
        
        return U_pred[0], X_pred, t_end - t_start, U_guess_next

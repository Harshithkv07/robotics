import pytest
import numpy as np
import time

from core.profiles import (
    DifferentialDriveProfile,
    AckermannCarProfile,
    SingleTrailerProfile,
    MultiTrailerProfile
)
from core.nmpc_solver import AdaptiveNMPCSolver
from core.trajectory import StraightTrajectory, DockingTrajectory

def test_nmpc_differential_drive():
    profile = DifferentialDriveProfile(
        r=0.1, w=0.5,
        X_bounds=((-10, 10), (-10, 10), (-np.pi, np.pi)),
        U_bounds=((-1.0, 1.0), (-np.pi, np.pi))
    )
    solver = AdaptiveNMPCSolver(profile, Np=10, dt=0.05)
    
    # Straight line along X axis
    traj = StraightTrajectory(v=0.5, x0=0.0, y0=0.0, theta=0.0, state_dim=3)
    
    X0 = np.array([0.0, 0.1, 0.0]) # Slightly off y
    X_ref = traj.get_reference(0.0, 10, 0.05)
    
    u_opt, X_pred, solve_time, _ = solver.solve(X0, X_ref)
    
    assert u_opt.shape == (2,)
    assert X_pred.shape == (11, 3)

def test_nmpc_execution_time_benchmark():
    profile = AckermannCarProfile(
        L1=2.0, w=1.5, r=0.3,
        X_bounds=((-100, 100), (-100, 100), (-np.pi, np.pi)),
        U_bounds=((-5.0, 5.0), (-np.pi/4, np.pi/4))
    )
    solver = AdaptiveNMPCSolver(profile, Np=20, dt=0.05)
    traj = StraightTrajectory(v=2.0, x0=0.0, y0=0.0, theta=0.0, state_dim=3)
    
    # Warmup
    X0 = np.array([0.0, 0.0, 0.0])
    X_ref = traj.get_reference(0.0, 20, 0.05)
    u_prev = None
    u_opt, X_pred, t_solve, u_prev = solver.solve(X0, X_ref, u_prev)
    
    # Benchmark
    times = []
    for step in range(10):
        t = step * 0.05
        X_ref = traj.get_reference(t, 20, 0.05)
        u_opt, X_pred, t_solve, u_prev = solver.solve(X0, X_ref, u_prev)
        times.append(t_solve)
        X0 = X_pred[1]
        
    avg_time = np.mean(times)
    print(f"Average solve time: {avg_time*1000:.2f} ms")
    assert avg_time < 0.1

def test_nmpc_single_trailer_jackknife_prevention():
    profile = SingleTrailerProfile(
        L1=2.5, L2=4.0, d1=1.0, w=2.0, r=0.4,
        X_bounds=((-100, 100), (-100, 100), (-np.pi, np.pi), (-np.pi, np.pi)),
        U_bounds=((-5.0, 5.0), (-np.pi/4, np.pi/4))
    )
    solver = AdaptiveNMPCSolver(profile, Np=30, dt=0.1)
    
    traj = DockingTrajectory(v=-1.0, start_x=10.0, start_y=5.0, bay_x=0.0, bay_y=0.0, state_dim=4)
    
    # Start with a critical heading error in articulation angle to provoke jackknife
    X0 = np.array([10.0, 5.0, 0.0, np.pi/4 - 0.1])
    
    u_prev = None
    for step in range(5):
        t = step * 0.1
        X_ref = traj.get_reference(t, 30, 0.1)
        u_opt, X_pred, _, u_prev = solver.solve(X0, X_ref, u_prev)
        
        psi_1_pred = X_pred[:, 3]
        max_psi = np.max(np.abs(psi_1_pred))
        
        assert max_psi <= np.pi/4 + 1e-3, f"Jackknife constraint violated: {max_psi} > {np.pi/4}"
        X0 = X_pred[1]

def test_nmpc_multi_trailer_initialization():
    profile = MultiTrailerProfile(
        L1=2.5, L2=4.0, L3=4.0, d1=1.0, d2=1.0, w=2.0, r=0.4,
        X_bounds=((-100, 100), (-100, 100), (-np.pi, np.pi), (-np.pi, np.pi), (-np.pi, np.pi)),
        U_bounds=((-5.0, 5.0), (-np.pi/4, np.pi/4))
    )
    solver = AdaptiveNMPCSolver(profile, Np=10, dt=0.05)
    
    traj = StraightTrajectory(v=1.0, state_dim=5)
    X0 = np.zeros(5)
    X_ref = traj.get_reference(0.0, 10, 0.05)
    
    u_opt, X_pred, _, _ = solver.solve(X0, X_ref)
    assert u_opt.shape == (2,)
    assert X_pred.shape == (11, 5)

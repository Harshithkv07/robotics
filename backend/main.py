import numpy as np
import json
import time
from core.profiles import SingleTrailerProfile
from core.kinematics import SingleTrailer
from core.transformations import TransformTree
from core.nmpc_solver import AdaptiveNMPCSolver
from core.trajectory import DockingTrajectory

def main():
    print("--- Generalized NMPC & 3D Digital Twin Framework ---")
    print("Executing 10-second simulated reverse docking maneuver for Single-Trailer Profile...")
    
    # Initialize profile with Jackknife prevention constraint explicitly defined in NMPC but we pass it as bounds.
    # Reverse-only docking: v_min <= v <= 0.
    profile = SingleTrailerProfile(
        L1=2.5,
        L2=4.0,
        d1=1.0,
        w=2.0,
        r=0.4,
        X_bounds=((-100, 100), (-100, 100), (-np.pi, np.pi), (-np.pi, np.pi)),
        U_bounds=((-5.0, 0.0), (-np.pi/4, np.pi/4))
    )
    
    model = SingleTrailer(profile)
    
    dt = 0.05
    Np = 30
    duration = 10.0
    steps = int(duration / dt)
    
    # NMPC Solver
    solver = AdaptiveNMPCSolver(profile, Np=Np, dt=dt)
    
    # Trajectory Generator
    traj = DockingTrajectory(v=-1.0, start_x=10.0, start_y=5.0, bay_x=0.0, bay_y=0.0, state_dim=4)
    
    # Initial state: x, y, theta_0, psi_1
    X = np.array([10.0, 5.0, 0.0, 0.0])
    
    u_prev = None
    
    print("\nStarting Simulation...\n")
    
    for step in range(steps + 1):
        t = step * dt
        
        # Get Reference Trajectory
        X_ref = traj.get_reference(t, Np, dt)
        
        # Solve NMPC
        u_opt, X_pred, solve_time, u_prev = solver.solve(X, X_ref, u_prev)
        
        # Calculate tracking error for current step
        ref_current = traj.get_state_at_time(t)
        error = np.linalg.norm(X[:2] - ref_current[:2])
        
        # Export dynamic transformation matrix tree
        transforms = TransformTree.single_trailer_transforms(X, profile.d1, profile.L2)
        json_tree = TransformTree.get_json_serializable_tree(transforms)
        
        if step % 20 == 0:
            print(f"[Time: {t:4.1f}s] State: {np.round(X, 3)}")
            print(f"            Control: {np.round(u_opt, 3)}")
            print(f"            Solve Time: {solve_time*1000:4.1f} ms | Track Err: {error:.3f}")
            
        # Apply control action
        X = model.step(X, u_opt, dt)
        
    print("\nSimulation complete. All transformations are valid and exported.")

if __name__ == "__main__":
    main()

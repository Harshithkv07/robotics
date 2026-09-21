import asyncio
import websockets
import time
import numpy as np

from api.protocol import encode_telemetry, decode_command

from core.profiles import (
    DifferentialDriveProfile,
    AckermannCarProfile,
    SingleTrailerProfile,
    MultiTrailerProfile
)
from core.kinematics import (
    DifferentialDrive,
    AckermannCar,
    SingleTrailer,
    MultiTrailer
)
from core.transformations import TransformTree
from core.nmpc_solver import AdaptiveNMPCSolver
from core.trajectory import StraightTrajectory, CurvilinearTrajectory, DockingTrajectory

class SimulationServer:
    def __init__(self):
        self.clients = set()
        
        self.hz = 50.0
        self.dt = 1.0 / self.hz
        self.running = True
        self.t = 0.0
        
        # Setup Initial Profile
        self._setup_profile("SingleTrailer")
        self.trajectory = DockingTrajectory(v=-1.0, start_x=10.0, start_y=5.0, bay_x=0.0, bay_y=0.0, state_dim=self.solver.nx)
        self._apply_trajectory_bounds()

    def _apply_trajectory_bounds(self):
        """
        Docking is a reverse-only maneuver (hard constraint: v_min <= v <= 0).
        Straight/Curvilinear showcase forward driving, so they get the profile's
        full symmetric velocity range back.
        """
        if isinstance(self.trajectory, DockingTrajectory):
            v_min = self.profile.U_bounds[0][0]
            self.solver.set_input_bounds(v_bounds=(v_min, 0.0))
        else:
            self.solver.set_input_bounds()

    def _setup_profile(self, profile_name: str):
        self.active_profile_name = profile_name
        # Trajectories are parameterized in absolute time (e.g. x = v*t), so a stale
        # clock from a previous profile would desync the reference the instant a new
        # profile takes over.
        self.t = 0.0

        if profile_name == "DifferentialDrive":
            self.profile = DifferentialDriveProfile(r=0.1, w=0.5, X_bounds=((-100, 100), (-100, 100), (-np.pi, np.pi)), U_bounds=((-5.0, 5.0), (-np.pi, np.pi)))
            self.model = DifferentialDrive(self.profile)
            self.X = np.zeros(3)
        elif profile_name == "AckermannCar":
            self.profile = AckermannCarProfile(L1=2.0, w=1.5, r=0.3, X_bounds=((-100, 100), (-100, 100), (-np.pi, np.pi)), U_bounds=((-5.0, 5.0), (-np.pi/4, np.pi/4)))
            self.model = AckermannCar(self.profile)
            self.X = np.zeros(3)
        elif profile_name == "SingleTrailer":
            self.profile = SingleTrailerProfile(L1=2.5, L2=4.0, d1=1.0, w=2.0, r=0.4, X_bounds=((-100, 100), (-100, 100), (-np.pi, np.pi), (-np.pi, np.pi)), U_bounds=((-5.0, 5.0), (-np.pi/4, np.pi/4)))
            self.model = SingleTrailer(self.profile)
            self.X = np.array([10.0, 5.0, 0.0, 0.0]) # starting position for docking
        elif profile_name == "MultiTrailer":
            self.profile = MultiTrailerProfile(L1=2.5, L2=4.0, L3=4.0, d1=1.0, d2=1.0, w=2.0, r=0.4, X_bounds=((-100, 100), (-100, 100), (-np.pi, np.pi), (-np.pi, np.pi), (-np.pi, np.pi)), U_bounds=((-5.0, 5.0), (-np.pi/4, np.pi/4)))
            self.model = MultiTrailer(self.profile)
            self.X = np.zeros(5)
            
        self.solver = AdaptiveNMPCSolver(self.profile, Np=30, dt=self.dt)
        if hasattr(self, 'trajectory') and self.trajectory is not None:
            self.trajectory.state_dim = self.solver.nx
        self.u_prev = None
        
    async def handler(self, websocket):
        self.clients.add(websocket)
        try:
            async for message in websocket:
                self.process_command(message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.remove(websocket)
            
    def process_command(self, message: str):
        try:
            cmd = decode_command(message)
        except ValueError as e:
            print(f"Error decoding command: {e}")
            return
            
        cmd_type = cmd.get("type")
        
        if cmd_type == "set_profile":
            name = cmd.get("profile")
            if name in ["DifferentialDrive", "AckermannCar", "SingleTrailer", "MultiTrailer"]:
                self._setup_profile(name)
                # Adjust trajectory state dim
                self.trajectory.state_dim = self.solver.nx
                self._apply_trajectory_bounds()

        elif cmd_type == "inject_disturbance":
            idx = cmd.get("index", 0)
            val = cmd.get("value", 0.0)
            if idx < len(self.X):
                self.X[idx] += val

        elif cmd_type == "set_trajectory":
            name = cmd.get("name")
            if name == "Straight":
                self.trajectory = StraightTrajectory(v=2.0, state_dim=self.solver.nx)
            elif name == "Curvilinear":
                # amplitude*frequency sets the path's peak heading-rate demand (~1.0 rad
                # at the old 2.0/0.5 values); that saturated the Multi-Trailer's psi_2
                # against the +/-45 deg jackknife bound and stalled instead of tracking.
                self.trajectory = CurvilinearTrajectory(v=2.0, amplitude=1.2, frequency=0.3, state_dim=self.solver.nx)
            elif name == "Docking":
                self.trajectory = DockingTrajectory(v=-1.0, start_x=10.0, start_y=5.0, bay_x=0.0, bay_y=0.0, state_dim=self.solver.nx)
            # Same absolute-time desync risk as a profile switch: restart the clock
            # and warm-start guess so the new reference begins at its own t=0.
            self.t = 0.0
            self.u_prev = None
            self._apply_trajectory_bounds()

        elif cmd_type == "pause_resume":
            self.running = not self.running
            
        elif cmd_type == "reset":
            self.t = 0.0
            self.X = np.zeros(self.solver.nx)
            if self.active_profile_name == "SingleTrailer":
                self.X = np.array([10.0, 5.0, 0.0, 0.0])

    async def simulation_loop(self):
        while True:
            start_time = time.time()
            
            if self.running:
                # 1. NMPC Step
                X_ref = self.trajectory.get_reference(self.t, self.solver.Np, self.dt)
                u_opt, X_pred, solve_time, self.u_prev = self.solver.solve(self.X, X_ref, self.u_prev)
                
                # 2. Step Simulation
                self.X = self.model.step(self.X, u_opt, self.dt)
                self.t += self.dt
                
                # 3. Transform Tree
                transforms = {}
                if self.active_profile_name == "DifferentialDrive":
                    transforms = TransformTree.differential_drive_transforms(self.X)
                elif self.active_profile_name == "AckermannCar":
                    transforms = TransformTree.ackermann_car_transforms(self.X, self.profile.L1)
                elif self.active_profile_name == "SingleTrailer":
                    transforms = TransformTree.single_trailer_transforms(self.X, self.profile.d1, self.profile.L2)
                elif self.active_profile_name == "MultiTrailer":
                    transforms = TransformTree.multi_trailer_transforms(self.X, self.profile.d1, self.profile.L2, self.profile.d2, self.profile.L3)
                
                # 4. Metrics
                ref_current = self.trajectory.get_state_at_time(self.t)
                dx = self.X[0] - ref_current[0]
                dy = self.X[1] - ref_current[1]
                e_y = np.sqrt(dx**2 + dy**2)
                
                theta_ref = ref_current[2]
                theta_curr = self.X[2]
                e_theta = np.abs((theta_curr - theta_ref + np.pi) % (2 * np.pi) - np.pi)
                
                jackknife_margin = 0.0
                if self.solver.nx >= 4:
                    jackknife_margin = np.pi/4 - np.abs(self.X[3])

                metrics = {
                    "e_y": e_y,
                    "e_theta": e_theta,
                    "solve_time_ms": solve_time * 1000.0,
                    "jackknife_margin": jackknife_margin
                }

                if isinstance(self.trajectory, DockingTrajectory):
                    dist_to_bay = np.sqrt(
                        (self.X[0] - self.trajectory.bay_x) ** 2 +
                        (self.X[1] - self.trajectory.bay_y) ** 2
                    )
                    metrics["distance_to_bay"] = dist_to_bay
                    metrics["docked"] = 1.0 if dist_to_bay < 0.5 else 0.0

                active_trajectory = type(self.trajectory).__name__.replace("Trajectory", "")

                # 5. Broadcast Telemetry
                if self.clients:
                    payload = encode_telemetry(
                        self.t,
                        self.active_profile_name,
                        self.X,
                        u_opt,
                        transforms,
                        X_pred,
                        metrics,
                        active_trajectory=active_trajectory,
                        reference_horizon=X_ref
                    )
                    websockets.broadcast(self.clients, payload)
            
            # 50 Hz timing
            elapsed = time.time() - start_time
            sleep_time = max(0, self.dt - elapsed)
            await asyncio.sleep(sleep_time)

import numpy as np
import pytest
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

def test_differential_drive_straight():
    profile = DifferentialDriveProfile(r=0.1, w=0.5, X_bounds=((-10, 10), (-10, 10), (-np.pi, np.pi)), U_bounds=((-1, 1), (-1, 1)))
    model = DifferentialDrive(profile)
    X = np.array([0.0, 0.0, 0.0])
    U = np.array([1.0, 0.0]) # v=1, omega=0
    dt = 0.1
    X_next = model.step(X, U, dt)
    assert np.allclose(X_next, [0.1, 0.0, 0.0])
    
def test_differential_drive_rotate():
    profile = DifferentialDriveProfile(r=0.1, w=0.5, X_bounds=((-10, 10), (-10, 10), (-np.pi, np.pi)), U_bounds=((-1, 1), (-1, 1)))
    model = DifferentialDrive(profile)
    X = np.array([0.0, 0.0, 0.0])
    U = np.array([0.0, 1.0]) # v=0, omega=1
    dt = 0.1
    X_next = model.step(X, U, dt)
    assert np.allclose(X_next, [0.0, 0.0, 0.1])
    
def test_ackermann_car_turn():
    profile = AckermannCarProfile(L1=1.0, w=0.5, r=0.1, X_bounds=((-10, 10), (-10, 10), (-np.pi, np.pi)), U_bounds=((-1, 1), (-np.pi/4, np.pi/4)))
    model = AckermannCar(profile)
    X = np.array([0.0, 0.0, 0.0])
    U = np.array([1.0, np.pi/4]) # v=1, delta=45 deg -> tan(45)=1
    dt = 0.1
    X_next = model.step(X, U, dt)
    # v=1, L1=1 -> theta_dot = 1
    # theta will be around 0.1, x around 0.1, y slightly positive
    assert X_next[0] > 0.0
    assert X_next[1] > 0.0
    assert np.isclose(X_next[2], 0.1)
    
def test_single_trailer_straight():
    profile = SingleTrailerProfile(L1=1.0, L2=2.0, d1=0.5, w=0.5, r=0.1, X_bounds=((0,0),(0,0),(0,0),(0,0)), U_bounds=((0,0),(0,0)))
    model = SingleTrailer(profile)
    X = np.array([0.0, 0.0, 0.0, 0.0]) # straight alignment
    U = np.array([1.0, 0.0]) # straight driving
    dt = 0.1
    X_next = model.step(X, U, dt)
    assert np.allclose(X_next, [0.1, 0.0, 0.0, 0.0])

def test_multi_trailer_straight():
    profile = MultiTrailerProfile(L1=1.0, L2=2.0, L3=2.0, d1=0.5, d2=0.5, w=0.5, r=0.1, X_bounds=((0,0),(0,0),(0,0),(0,0),(0,0)), U_bounds=((0,0),(0,0)))
    model = MultiTrailer(profile)
    X = np.array([0.0, 0.0, 0.0, 0.0, 0.0])
    U = np.array([1.0, 0.0])
    dt = 0.1
    X_next = model.step(X, U, dt)
    assert np.allclose(X_next, [0.1, 0.0, 0.0, 0.0, 0.0])

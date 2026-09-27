"""Tractor-trailer kinematics (PPT slide 9 / Word doc).

State  X = [x1, y1, th0, psi]   x1,y1: tractor rear-axle centre, th0: tractor heading,
                                psi = th0 - th1: hitch angle (tractor minus trailer heading)
Input  U = [v, delta]           v: rear-axle speed (negative = reverse), delta: front steer angle

    x1'  = v cos th0
    y1'  = v sin th0
    th0' = v/L1 tan(delta)
    psi' = v [ tan(delta)/L1 - sin(psi)/L2 - d/(L1 L2) tan(delta) cos(psi) ]

d is the distance the hitch (fifth wheel) sits AHEAD of the tractor rear axle.
Scalar math (not numpy) is used in the hot path: the NMPC calls this thousands of times.
"""
from dataclasses import dataclass
from math import cos, sin, tan, radians, pi

import numpy as np


@dataclass(frozen=True)
class Vehicle:
    L1: float = 4.0            # tractor wheelbase
    L2: float = 8.0            # hitch -> trailer axle
    d: float = 0.5             # hitch ahead of tractor rear axle
    width: float = 2.5
    tractor_front: float = 1.0  # front bumper ahead of front axle
    tractor_rear: float = 1.0   # tractor tail behind rear axle
    trailer_front: float = 0.3  # trailer nose ahead of hitch
    trailer_rear: float = 2.0   # trailer tail behind trailer axle
    delta_max: float = radians(35.0)   # steering lock
    psi_crit: float = radians(60.0)    # hard safety limit enforced by NMPC
    psi_jack: float = radians(75.0)    # physical jackknife (tractor/trailer contact)
    v_max: float = 2.0                 # m/s (~7 km/h) yard speed


VEH = Vehicle()


def deriv(s, v, delta, veh=VEH):
    x, y, th, psi = s
    t = tan(delta)
    return (v * cos(th),
            v * sin(th),
            v / veh.L1 * t,
            v * (t / veh.L1 - sin(psi) / veh.L2 - veh.d / (veh.L1 * veh.L2) * t * cos(psi)))


def step(s, v, delta, dt, veh=VEH):
    """One RK4 step with (v, delta) held constant over dt."""
    k1 = deriv(s, v, delta, veh)
    s2 = tuple(s[i] + 0.5 * dt * k1[i] for i in range(4))
    k2 = deriv(s2, v, delta, veh)
    s3 = tuple(s[i] + 0.5 * dt * k2[i] for i in range(4))
    k3 = deriv(s3, v, delta, veh)
    s4 = tuple(s[i] + dt * k3[i] for i in range(4))
    k4 = deriv(s4, v, delta, veh)
    return tuple(s[i] + dt / 6.0 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(4))


def rollout(s0, vs, deltas, dt, veh=VEH):
    """States for a control sequence; returns array (N+1, 4)."""
    out = [tuple(s0)]
    s = tuple(s0)
    for v, d in zip(vs, deltas):
        s = step(s, v, d, dt, veh)
        out.append(s)
    return np.array(out)


def trailer_pose(s, veh=VEH):
    """Trailer axle centre and heading (th1 = th0 - psi)."""
    x, y, th, psi = s
    hx = x + veh.d * cos(th)
    hy = y + veh.d * sin(th)
    th1 = th - psi
    return hx - veh.L2 * cos(th1), hy - veh.L2 * sin(th1), th1


def _rect(cx, cy, th, back, front, width):
    """Corners of a rectangle whose long axis runs along heading th from `back` to `front`
    (measured from reference point cx,cy)."""
    c, s = cos(th), sin(th)
    hw = width / 2.0
    pts = [(-back, -hw), (front, -hw), (front, hw), (-back, hw)]
    return [(cx + px * c - py * s, cy + px * s + py * c) for px, py in pts]


def footprints(s, veh=VEH):
    """(tractor_polygon, trailer_polygon), each a list of 4 (x,y) corners."""
    x, y, th, psi = s
    tx, ty, th1 = trailer_pose(s, veh)
    tractor = _rect(x, y, th, veh.tractor_rear, veh.L1 + veh.tractor_front, veh.width)
    trailer = _rect(tx, ty, th1, veh.trailer_rear, veh.L2 + veh.trailer_front, veh.width)
    return tractor, trailer


def wrap(a):
    return (a + pi) % (2 * pi) - pi

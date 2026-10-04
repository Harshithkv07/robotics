"""Hybrid A* for the tractor-trailer.

Search space is the rig state (x, y, theta, psi) on a lattice; every primitive is integrated with
the real kinematics and pruned at |psi| <= PSI_PLAN and against the collision map.

KEY IDEA - stabilised primitives. Reversing is open-loop unstable (PPT slide 3): a fixed steering
angle per step lets psi run away, so a plain lattice search cannot even hold a straight reverse.
Each primitive therefore runs a hitch-angle regulator obtained by inverting the psi-dot equation:

    tan(delta) = L1 [ sin(psi)/L2 - sign(v) k (psi - psi_des) ] / (1 - d/L2 cos(psi))
    =>  psi_dot = -|v| k (psi - psi_des)          (stable in BOTH gears)

and the search chooses psi_des in {-45,-25,0,25,45} deg. This turns the search into an ordinary
car-style Hybrid A* with cusps (gear switches).

The search targets the bay's PRE-GOAL pose (rig straight on the bay axis); the last leg into the
bay is a straight line appended afterwards.
"""
import heapq
from math import atan, cos, hypot, radians, sin

import numpy as np

from .dubins import dubins_length
from .shot import try_shot
from .model import VEH, step, trailer_pose, wrap

DS = 2.0                       # primitive arc length, m
SUB = 4                        # integration sub-steps per primitive
PSI_DES = [radians(a) for a in (-45, -25, 0, 25, 45)]   # hitch-angle set-points
PLAN_STEER_FRAC = 0.85          # plans use at most this fraction of the steering lock: the rest is feedback margin for the tracker
K_PSI = 0.5                   # regulator gain, 1/m  (psi error decays e-fold per 2 m)
POS_RES, ANG_RES, PSI_RES = 0.5, radians(5.0), radians(12.0)
PSI_PLAN = radians(52.0)       # planner keeps clear of psi_crit (60 deg)
CLEAR = 0.35                   # required clearance, m

REVERSE_PEN, SWITCH_PEN, STEER_PEN, STEER_CHG_PEN, PSI_PEN = 1.4, 6.0, 0.25, 0.6, 0.6
H_WEIGHT, H_PSI_W = 3.0, 3.0
RHO_TRAILER = 10.0              # trailer-axle turning radius (Dubins heuristic and shots)
SHOT_POS, SHOT_ANG = 1.0, radians(6.0)   # shot de-duplication cell: fine enough that a well-aligned node is not skipped
SHOT_RANGE = 45.0              # only attempt a shot when the Dubins distance is below this, m
LAT_TOL, LON_MIN, LON_MAX = 1.2, -1.5, 30.0  # goal REGION: anywhere on the bay axis up to LON_MAX out, aligned, hitch straight
ANG_TOL, PSI_TOL = radians(10.0), radians(10.0)
STRAIGHT_STEP = 0.5


def _key(s):
    return (int(round(s[0] / POS_RES)), int(round(s[1] / POS_RES)),
            int(round(wrap(s[2]) / ANG_RES)), int(round(s[3] / PSI_RES)))


def holonomic_field(cm, goal_xy, clearance=1.6, res=0.5):
    """Distance-to-goal (m) over free space, ignoring vehicle heading. Dijkstra, 8-connected."""
    b = cm.bounds
    nx = int((b["xmax"] - b["xmin"]) / res) + 1
    ny = int((b["ymax"] - b["ymin"]) / res) + 1
    xs = b["xmin"] + np.arange(nx) * res
    ys = b["ymin"] + np.arange(ny) * res
    X, Y = np.meshgrid(xs, ys)
    free = cm.sdf_at(X, Y) > clearance
    INF = 1e9
    dist = np.full((ny, nx), INF)
    gi = min(max(int(round((goal_xy[0] - b["xmin"]) / res)), 0), nx - 1)
    gj = min(max(int(round((goal_xy[1] - b["ymin"]) / res)), 0), ny - 1)
    dist[gj, gi] = 0.0
    pq = [(0.0, gi, gj)]
    nbr = [(1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0),
           (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)]
    while pq:
        d, i, j = heapq.heappop(pq)
        if d > dist[j, i]:
            continue
        for di, dj, w in nbr:
            a, c = i + di, j + dj
            if 0 <= a < nx and 0 <= c < ny and (free[c, a] or d < 4.0):
                nd = d + w * res
                if nd < dist[c, a]:
                    dist[c, a] = nd
                    heapq.heappush(pq, (nd, a, c))

    def lookup(x, y):
        i = int(round((x - b["xmin"]) / res))
        j = int(round((y - b["ymin"]) / res))
        if 0 <= i < nx and 0 <= j < ny:
            return dist[j, i]
        return INF
    return lookup


def hitch_regulator(psi, v, psi_des, veh=VEH, frac=1.0):
    """Steering that makes psi_dot = -|v| k (psi - psi_des) in either gear (clipped to frac x the lock)."""
    sgn = 1.0 if v > 0 else -1.0
    num = sin(psi) / veh.L2 - sgn * K_PSI * (psi - psi_des)
    tand = veh.L1 * num / (1.0 - veh.d / veh.L2 * cos(psi))
    lim = frac * veh.delta_max
    return max(-lim, min(lim, atan(tand)))


def plan_regulator(psi, v, psi_des, veh=VEH):
    return hitch_regulator(psi, v, psi_des, veh, frac=PLAN_STEER_FRAC)


def _expand(s, direction, psi_des, cm, veh):
    """Drive one stabilised primitive; returns [(state, delta)] or None if it breaks a limit."""
    dt = DS / SUB
    out, cur = [], s
    for _ in range(SUB):
        delta = plan_regulator(cur[3], direction, psi_des, veh)
        cur = step(cur, float(direction), delta, dt, veh)
        if abs(cur[3]) > PSI_PLAN:
            return None
        out.append((cur, delta))
    if cm.clearance_many([o[0] for o in out]).min() < CLEAR:
        return None
    return out


def search(cm, start, goal, veh=VEH, max_expansions=40000, debug=None, final_reverse=True,
           lead=10.0, gears=(1, -1)):
    """Hybrid A* from `start` (x,y,th,psi) to the parked pose `goal` = (x,y,th), psi = 0.

    The search never has to hit the goal on the lattice: it only has to reach a pose from which a
    simulated shot (Dubins path of the trailer axle + cascaded controller on the REAL model) runs
    straight into the bay. So every returned path is dynamically consistent end to end.

    Returns (list of (state, delta, direction), expansions) or (None, expansions)."""
    gx, gy, gth = goal
    h_xy = holonomic_field(cm, (gx, gy))

    # The trailer axle is a flat output: its path curvature alone fixes psi (psi = atan(L2 kappa)),
    # so a Dubins path of the trailer axle is a heading-aware, turning-limit-aware estimate.
    gtx, gty, gth1 = trailer_pose((gx, gy, gth, 0.0), veh)

    def heur(s):
        # only the ARRIVAL direction counts: backing in is the reverse traversal of a forward path
        # from the goal, so a short forward path into the slot must not look like progress
        ax, ay, ath = trailer_pose(s, veh)
        if final_reverse:
            dub = dubins_length(gtx, gty, gth1, ax, ay, ath, RHO_TRAILER)
        else:
            dub = dubins_length(ax, ay, ath, gtx, gty, gth1, RHO_TRAILER)
        return H_WEIGHT * (max(dub, h_xy(s[0], s[1])) + H_PSI_W * abs(s[3]))

    ct, st = cos(gth), sin(gth)
    shot_dir = -1 if final_reverse else 1
    lon_lo, lon_hi = (0.0, lead + LON_MAX) if final_reverse else (-(lead + LON_MAX), 0.0)

    def in_region(s):
        """Loosely on the bay axis, aligned, hitch nearly straight: worth a shot without de-duplication."""
        if abs(wrap(s[2] - gth)) > ANG_TOL or abs(s[3]) > PSI_TOL:
            return False
        dx, dy = s[0] - gx, s[1] - gy
        lon, lat = dx * ct + dy * st, -dx * st + dy * ct
        return abs(lat) <= LAT_TOL and lon_lo <= lon <= lon_hi

    def shoot(s):
        return try_shot(cm, s, goal, RHO_TRAILER, shot_dir, plan_regulator, PSI_PLAN, CLEAR, veh=veh,
                        lead=lead, lon_lim=(-1.0, 1.0), lat_tol=0.35, ang_tol=radians(4.0), psi_tol=radians(5.0))

    shot_seen = set()
    start = tuple(start)
    parents = [(None, [(start, 0.0)], 0)]   # index -> (parent, [(state, delta)], direction)
    open_ = [(heur(start), 0, 0.0, 0, start, 0, 0.0)]   # f, tie, g, idx, state, gear, last_steer
    closed, best_g, counter, expansions = set(), {}, 0, 0
    while open_ and expansions < max_expansions:
        f, _, g, idx, s, gear, last_steer = heapq.heappop(open_)
        k = _key(s) + (gear,)
        if k in closed:
            continue
        closed.add(k)
        expansions += 1
        if debug is not None:
            e = hypot(s[0] - gx, s[1] - gy) + 6 * abs(wrap(s[2] - gth)) + 6 * abs(s[3])
            if e < debug.get("best_e", 1e9):
                debug.update(best_e=e, best=s, dist=hypot(s[0] - gx, s[1] - gy),
                             ang=abs(wrap(s[2] - gth)), at=expansions)
        # analytic expansion: try a direct, simulated connection to the goal
        ax, ay, ath = trailer_pose(s, veh)
        d_dub = (dubins_length(gtx, gty, gth1, ax, ay, ath, RHO_TRAILER) if shot_dir < 0
                 else dubins_length(ax, ay, ath, gtx, gty, gth1, RHO_TRAILER))
        skey = (int(s[0] / SHOT_POS), int(s[1] / SHOT_POS), int(wrap(s[2]) / SHOT_ANG), int(s[3] / SHOT_ANG))
        if in_region(s) or (d_dub < SHOT_RANGE and skey not in shot_seen):
            shot_seen.add(skey)
            sh = shoot(s)
            if sh is not None:
                return _reconstruct(parents, idx) + [(x, dl, shot_dir) for x, dl in sh], expansions
        for direction in gears:
            for steer in PSI_DES:
                sts = _expand(s, direction, steer, cm, veh)
                if sts is None:
                    continue
                ns = sts[-1][0]
                nk = _key(ns) + (direction,)
                if nk in closed:
                    continue
                cost = DS * (1.0 if direction > 0 else REVERSE_PEN)
                cost += STEER_PEN * abs(steer) * DS + STEER_CHG_PEN * abs(steer - last_steer)
                cost += PSI_PEN * abs(ns[3]) / PSI_PLAN * DS
                if gear != 0 and direction != gear:
                    cost += SWITCH_PEN
                ng = g + cost
                if ng >= best_g.get(nk, 1e18):
                    continue
                best_g[nk] = ng
                counter += 1
                parents.append((idx, sts, direction))
                heapq.heappush(open_, (ng + heur(ns), counter, ng, len(parents) - 1, ns, direction, steer))
    return None, expansions


def _reconstruct(parents, idx):
    chain = []
    while idx is not None:
        p, sts, d = parents[idx]
        chain.append((sts, d))
        idx = p
    chain.reverse()
    return [(s, delta, d) for sts, d in chain for s, delta in sts]


def shorten(cm, res, goal, shot_dir, lead, veh=VEH):
    """Path shortening: try a shot from ever-later points of the found path and keep the EARLIEST one
    that connects. The greedy search finds a path; this removes the detours it takes on the way."""
    for i in range(0, len(res), SUB):
        sh = try_shot(cm, res[i][0], goal, RHO_TRAILER, shot_dir, plan_regulator, PSI_PLAN, CLEAR, veh=veh,
                      lead=lead, lon_lim=(-1.0, 1.0), lat_tol=0.35, ang_tol=radians(4.0), psi_tol=radians(5.0))
        if sh is not None:
            return res[:i + 1] + [(x, dl, shot_dir) for x, dl in sh]
    return res


def plan_bay(layout, cm, bay, veh=VEH, max_expansions=40000, debug=None, smooth=True):
    """Full reference path (gate -> parked) for one bay.

    Waypoints are dicts x, y, th, psi, delta, gear (+1 forward / -1 reverse), in travel order;
    gear is the direction of the motion arriving at that waypoint. Every waypoint comes from the
    real kinematics, so the reference is dynamically consistent from gate to parked pose.
    Returns (waypoints | None, expansions)."""
    goal = tuple(bay["goal"])
    s0 = layout["start"]
    reverse = bay["approach"] == "reverse"
    lead = bay.get("lead", 10.0)
    res, n = search(cm, s0, goal, veh, max_expansions, debug, final_reverse=reverse, lead=lead)
    if res is None:
        return None, n
    if smooth:
        res = shorten(cm, res, goal, -1 if reverse else 1, lead, veh)
    wp = [dict(x=s0[0], y=s0[1], th=s0[2], psi=s0[3], delta=0.0, gear=res[0][2])]
    wp += [dict(x=s[0], y=s[1], th=s[2], psi=s[3], delta=dl, gear=d) for s, dl, d in res]
    return wp, n

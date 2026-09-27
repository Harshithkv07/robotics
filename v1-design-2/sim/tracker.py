"""Closed-loop execution of a planned path: NMPC guidance vs. a naive tractor-only controller.

NMPC (the project's core). At every control update it solves, over a receding horizon,

    min   sum_k  |X_k - Xref_k|^2_Q  +  |delta_k|^2_R  +  |d delta_k|^2_S           (Word doc J)
    s.t.  X_{k+1} = f(X_k, v_k, delta_k)                 kinematics (PPT slide 9)
          |psi_k|     <= psi_crit                        HARD jackknife constraint
          |delta_k|   <= delta_max                       steering lock
          clearance_k >= margin                          obstacles / walls

Decision variables are steering CORRECTIONS (piecewise constant over blocks) added to the planned
feedforward steering, so zero correction = follow the plan. The speed schedule v_k
comes from the trapezoidal profile of the planned segment: the advisor reports it, the NMPC
decides how to steer. Solver: scipy SLSQP, warm-started from the previous solution.

Baseline ("guidance OFF"): a driver-like controller that steers the TRACTOR onto the path with
proportional feedback and has no model of the hitch, no lookahead and no constraint.
"""
from math import cos, sin, hypot, atan, tan, radians, pi
import time

import numpy as np
from scipy.optimize import minimize

from .model import VEH, step, trailer_pose, wrap
from .planner import hitch_regulator, plan_regulator, PSI_PLAN, CLEAR, RHO_TRAILER
from .shot import try_shot

DT_H = 0.4            # NMPC prediction step, s
N_P = 24              # prediction horizon steps (9.6 s)
N_B = 8               # steering blocks
BLK = N_P // N_B
DT_C = 0.25           # control update period, s
DT_SIM = 0.05
STEER_RATE = radians(45.0)      # actuator rate limit, rad/s
V_FWD, V_REV, ACC = 2.2, 1.2, 0.7
V_CREEP = 0.35
REPLAN_EVERY = 8.0    # metres of progress between re-plans of the final approach
DWELL = 1.2           # stop at a cusp, s

# Cost weights. The TRAILER axle pose is the primary tracking target: when reversing, the tractor's
# rear axle is the non-minimum-phase output (the PPT's dilemma) while the trailer axle is flat.
Q_TL_POS, Q_TL_TH, Q_PSI, Q_TR_POS, Q_TR_TH = 0.6, 1.5, 15.0, 0.15, 0.3
R_DELTA, S_DELTA = 0.02, 3.0
TERM_TL_POS, TERM_TL_TH, TERM_PSI, TERM_TR_POS = 8.0, 60.0, 60.0, 1.0   # terminal cost: the horizon must END on the plan
CLEAR_MARGIN = 0.25
END_BOOST, END_SCALE = 0.0, 6.0   # position/heading weights x(1 + 8 exp(-remaining/6 m)) near a segment end


# ---------------------------------------------------------------------------- reference
class Segment:
    def __init__(self, wps, gear, v_start=0.3):
        self.gear = gear
        self.v_start = v_start
        x = np.array([w["x"] for w in wps]); y = np.array([w["y"] for w in wps])
        self.x, self.y = x, y
        self.th = np.unwrap([w["th"] for w in wps])
        self.psi = np.array([w["psi"] for w in wps])
        self.delta = np.array([w["delta"] for w in wps])
        self.s = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(x), np.diff(y)))])
        self.length = float(self.s[-1])
        self.vmax = V_FWD if gear > 0 else V_REV
        self._build_profile()

    def _build_profile(self):
        """Speed profile along the segment: slow for hard steering (looking ~3 m ahead and behind),
        then respect accel/decel limits with a forward and a backward pass. Ends at creep speed."""
        n = len(self.s)
        dmax = VEH.delta_max
        dabs = np.abs(self.delta)
        vlim = np.empty(n)
        for i in range(n):
            m = dabs[(self.s >= self.s[i] - 3.0) & (self.s <= self.s[i] + 3.0)].max()
            vlim[i] = max(1.5 * V_CREEP, self.vmax * (1.0 - 0.65 * m / dmax))
        v = vlim.copy()
        v[0] = min(v[0], max(self.v_start, V_CREEP))
        v[-1] = V_CREEP
        ds = np.diff(self.s)
        for i in range(1, n):
            v[i] = min(v[i], (v[i - 1] ** 2 + 2 * ACC * ds[i - 1]) ** 0.5)
        for i in range(n - 2, -1, -1):
            v[i] = min(v[i], (v[i + 1] ** 2 + 2 * ACC * ds[i]) ** 0.5)
        self.vprof = np.maximum(v, V_CREEP)

    def speed(self, s):
        return float(np.interp(min(max(s, 0.0), self.length), self.s, self.vprof))

    def ff_at(self, s):
        """Planned steering angle at path distance s (the plan is kinematically consistent)."""
        s = min(max(s, 0.0), self.length)
        return float(np.interp(s, self.s, self.delta))

    def ref_at(self, s):
        s = min(max(s, 0.0), self.length)
        return (float(np.interp(s, self.s, self.x)), float(np.interp(s, self.s, self.y)),
                float(np.interp(s, self.s, self.th)), float(np.interp(s, self.s, self.psi)))


def split_segments(wp):
    """Cut the waypoint list at gear changes (cusps). A cusp waypoint belongs to both segments."""
    segs, cur, g = [], [wp[0]], wp[1]["gear"] if len(wp) > 1 else 1
    for w in wp[1:]:
        if w["gear"] != g:
            if len(cur) >= 2:
                segs.append(Segment(cur, g))
            cur, g = [cur[-1]], w["gear"]
        cur.append(w)
    if len(cur) >= 2:
        segs.append(Segment(cur, g))
    return [s for s in segs if s.length > 0.3]


def reshoot(cm, state, bay, veh, v_now=0.3):
    """Re-plan the final approach from the rig's ACTUAL state: a fresh simulated shot to the goal.
    Returns a Segment or None (caller keeps its current reference)."""
    gear = -1 if bay["approach"] == "reverse" else 1
    sh = try_shot(cm, state, tuple(bay["goal"]), RHO_TRAILER, gear, plan_regulator, PSI_PLAN, CLEAR, veh=veh,
                  lead=bay.get("lead", 10.0), lon_lim=(-1.0, 1.0), lat_tol=0.35, ang_tol=radians(4.0),
                  psi_tol=radians(5.0), max_len=80.0)
    if sh is None:
        return None
    wps = [dict(x=state[0], y=state[1], th=state[2], psi=state[3], delta=0.0, gear=gear)]
    wps += [dict(x=s[0], y=s[1], th=s[2], psi=s[3], delta=dl, gear=gear) for s, dl in sh]
    return Segment(wps, gear, v_start=v_now)


# ---------------------------------------------------------------------------- NMPC
def trailer_axle(st, veh=VEH):
    """Vectorised trailer axle pose for an (N,4) array of rig states -> (tx, ty, th1)."""
    th1 = st[:, 2] - st[:, 3]
    hx = st[:, 0] + veh.d * np.cos(st[:, 2]); hy = st[:, 1] + veh.d * np.sin(st[:, 2])
    return hx - veh.L2 * np.cos(th1), hy - veh.L2 * np.sin(th1), th1


class NMPC:
    def __init__(self, cm, veh=VEH, psi_limit=None):
        self.cm, self.veh = cm, veh
        self.psi_lim = psi_limit if psi_limit is not None else veh.psi_crit
        self.u = np.zeros(N_B)
        self.last_delta = 0.0
        self.stats = {"solves": 0, "fail": 0, "ms": 0.0}

    def _rollout(self, s0, vs, u, ff):
        states, s, dm = [], tuple(s0), self.veh.delta_max
        for k in range(N_P):
            d = ff[k] + float(u[k // BLK])
            s = step(s, vs[k], max(-dm, min(dm, d)), DT_H, self.veh)
            states.append(s)
        return states

    def solve(self, s0, vs, refs, ff, boost=1.0):
        """vs: signed speeds per horizon step; refs: (N_P, 4) reference states; ff: planned steering."""
        t0 = time.perf_counter()
        refs = np.asarray(refs)
        dmax = self.veh.delta_max
        moving = np.abs(np.asarray(vs)) > 1e-3

        ref_tx, ref_ty, ref_th1 = trailer_axle(refs, self.veh)

        def cost(u):
            st = np.asarray(self._rollout(s0, vs, u, ff))
            tx, ty, th1 = trailer_axle(st, self.veh)
            etx, ety = tx - ref_tx, ty - ref_ty
            eth1 = (th1 - ref_th1 + pi) % (2 * pi) - pi
            ex = st[:, 0] - refs[:, 0]; ey = st[:, 1] - refs[:, 1]
            eth = (st[:, 2] - refs[:, 2] + pi) % (2 * pi) - pi
            epsi = st[:, 3] - refs[:, 3]
            J = float(np.sum(boost * (Q_TL_POS * (etx ** 2 + ety ** 2) + Q_TL_TH * eth1 ** 2
                                      + Q_TR_POS * (ex ** 2 + ey ** 2) + Q_TR_TH * eth ** 2) + Q_PSI * epsi ** 2))
            J += (boost * (TERM_TL_POS * (etx[-1] ** 2 + ety[-1] ** 2) + TERM_TL_TH * eth1[-1] ** 2
                           + TERM_TR_POS * (ex[-1] ** 2 + ey[-1] ** 2)) + TERM_PSI * epsi[-1] ** 2)
            J += R_DELTA * float(np.sum(u ** 2))
            du = np.diff(np.concatenate([[self.last_delta], u]))
            return J + S_DELTA * float(np.sum(du ** 2))

        def g_psi(u):                          # >= 0  <=>  |psi| <= limit at every step
            psi = np.array([s[3] for s in self._rollout(s0, vs, u, ff)])
            return np.concatenate([self.psi_lim - psi, self.psi_lim + psi])

        def g_clear(u):
            st = self._rollout(s0, vs, u, ff)
            return self.cm.clearance_smooth(st) - CLEAR_MARGIN

        psi_con = {"type": "ineq", "fun": g_psi}
        clr_con = {"type": "ineq", "fun": g_clear}
        x0 = np.clip(self.u, -dmax, dmax)     # blocks span 1.2 s but we re-solve every 0.25 s: no shift
        best, mode = None, "full"
        # attempt 1: hitch limit AND obstacle clearance hard. attempt 2: hitch limit hard only
        # (a rig that cannot both dodge and stay unfolded must stay unfolded).
        for cons, label in (([psi_con, clr_con], "full"), ([psi_con], "psi-only")):
            for start in (x0, np.zeros(N_B)):
                r = minimize(cost, start, method="SLSQP", bounds=[(-dmax, dmax)] * N_B, constraints=cons,
                             options={"maxiter": 40, "ftol": 1e-4})
                ok = r.success or (np.min(g_psi(r.x)) > -1e-2 and
                                   (label == "psi-only" or np.min(g_clear(r.x)) > -0.05))
                if ok and (best is None or r.fun < best.fun):
                    best, mode = r, label
                if r.success:
                    break
            if best is not None:
                break
        self.stats["solves"] += 1
        self.stats["ms"] += 1000 * (time.perf_counter() - t0)
        if mode == "psi-only":
            self.stats["relaxed"] = self.stats.get("relaxed", 0) + 1
        if best is None:
            # both attempts infeasible: fall back to the hitch-angle regulator (stable in both gears)
            self.stats["fail"] += 1
            d_fb = hitch_regulator(s0[3], vs[0] if abs(vs[0]) > 1e-6 else 1.0, float(refs[0, 3]), self.veh)
            u = np.zeros(N_B)
            u[0] = d_fb - ff[0]
            u[1:] = u[0] * 0.5
        else:
            u = best.x
        self.u = u
        self.last_delta = float(u[0])   # correction rate is penalised, not the absolute angle
        return float(np.clip(ff[0] + u[0], -dmax, dmax)), self._rollout(s0, vs, u, ff)


# ---------------------------------------------------------------------------- baseline
class Naive:
    """Driver-like: steer the tractor towards the path point ahead. No hitch model, no constraint."""
    K_Y, K_TH = 0.35, 1.0

    def __init__(self, veh=VEH):
        self.veh = veh

    def command(self, s, seg, prog_s, v):
        rx, ry, rth, _ = seg.ref_at(prog_s + 0.5)
        ey = -(s[0] - rx) * sin(rth) + (s[1] - ry) * cos(rth)
        eth = wrap(s[2] - rth)
        sign = 1.0 if v >= 0 else -1.0
        kappa_ff = float(np.interp(prog_s, seg.s, np.gradient(seg.th, seg.s)))
        kappa = kappa_ff - sign * (self.K_TH * self.K_Y * ey * 0.2 + 0.25 * eth) * 1.0
        return max(-self.veh.delta_max, min(self.veh.delta_max, atan(self.veh.L1 * kappa)))


# ---------------------------------------------------------------------------- execution
def run(layout, cm, wp, mode="nmpc", disturbance=None, veh=VEH, max_time=600.0, log_every=0.1, bay=None,
        replan=True):
    """Execute the planned path in closed loop. Returns dict with frames and metrics.

    disturbance: {"t": seconds, "psi_kick": radians} adds an instantaneous hitch-angle jolt."""
    segs = split_segments(wp)
    s0 = wp[0]
    state = (s0["x"], s0["y"], s0["th"], s0["psi"])
    ctrl = NMPC(cm, veh) if mode == "nmpc" else Naive(veh)
    t, delta, frames, phases = 0.0, 0.0, [], []
    min_clear, max_psi, jackknife, violated = 1e9, 0.0, False, False
    next_log, kicked = 0.0, False

    def log(v, hor=None):
        nonlocal next_log
        if t + 1e-9 >= next_log:
            fr = {"t": round(t, 2), "x": round(state[0], 3), "y": round(state[1], 3),
                  "th": round(state[2], 4), "psi": round(state[3], 4), "v": round(v, 3),
                  "delta": round(delta, 4)}
            if hor is not None:
                fr["hor"] = [[round(h[0], 2), round(h[1], 2), round(h[2], 3), round(h[3], 3)] for h in hor[::2]]
            frames.append(fr)
            next_log += log_every

    for si, seg in enumerate(segs):
        prog = 0.0
        last_seg = si == len(segs) - 1
        since = 0.0
        replans = 0
        if last_seg and bay is not None and replan and mode == "nmpc":
            ns = reshoot(cm, state, bay, veh)
            if ns is not None:
                seg, replans = ns, replans + 1
        phases.append({"seg": si, "gear": seg.gear, "t0": round(t, 2), "length": round(seg.length, 2)})
        while True:
            # progress = nearest waypoint ahead of the last one
            lo = int(np.searchsorted(seg.s, prog))
            hi = min(len(seg.s), lo + 60)
            d2 = (seg.x[lo:hi] - state[0]) ** 2 + (seg.y[lo:hi] - state[1]) ** 2
            prog = max(prog, float(seg.s[lo + int(np.argmin(d2))]))
            remaining = seg.length - prog
            if remaining < 0.12:
                break
            if last_seg and bay is not None and replan and mode == "nmpc" and prog - since > REPLAN_EVERY and remaining > 14.0:
                ns = reshoot(cm, state, bay, veh, v_now=seg.speed(prog))
                since = prog
                if ns is not None:
                    seg, prog, since, replans = ns, 0.0, 0.0, replans + 1
                    remaining = seg.length
            if t > max_time:
                break
            v_mag = seg.speed(prog)
            vs, refs, ffs, sp = [], [], [], prog
            for k in range(N_P):
                vk = seg.speed(sp)
                vs.append(seg.gear * vk)
                ffs.append(seg.ff_at(sp))
                sp = min(seg.length, sp + vk * DT_H)
                refs.append(seg.ref_at(sp))
            hor = None
            if mode == "nmpc":
                boost = 1.0 + END_BOOST * float(np.exp(-remaining / END_SCALE))   # tighten up as a segment ends
                cmd, hor = ctrl.solve(state, vs, refs, ffs, boost)
            else:
                cmd = ctrl.command(state, seg, prog, seg.gear * v_mag)
            # apply for one control period with steering rate limit
            for _ in range(int(round(DT_C / DT_SIM))):
                dd = max(-STEER_RATE * DT_SIM, min(STEER_RATE * DT_SIM, cmd - delta))
                delta += dd
                v = seg.gear * seg.speed(prog)
                state = step(state, v, delta, DT_SIM, veh)
                t += DT_SIM
                if disturbance and not kicked and t >= disturbance["t"]:
                    state = (state[0], state[1], state[2], state[3] + disturbance["psi_kick"])
                    kicked = True
                c = cm.clearance(state)
                min_clear = min(min_clear, c)
                max_psi = max(max_psi, abs(state[3]))
                if abs(state[3]) > veh.psi_crit + 1e-3:
                    violated = True
                if abs(state[3]) >= veh.psi_jack:
                    jackknife = True
                log(v, hor)
                hor = None
                if jackknife:
                    break
            if jackknife:
                break
        if jackknife or t > max_time:
            break
        if si < len(segs) - 1:                       # cusp: stop, then change gear
            for _ in range(int(DWELL / DT_SIM)):
                t += DT_SIM
                log(0.0)
    log(0.0)

    goal = layout.get("_goal")
    final = {"x": state[0], "y": state[1], "th": state[2], "psi": state[3]}
    return {"frames": frames, "phases": phases, "duration": round(t, 2), "jackknife": jackknife,
            "psi_limit_violated": violated, "min_clearance": round(min_clear, 3),
            "max_psi": round(max_psi, 4), "final": final, "solver": getattr(ctrl, "stats", None),
            "mode": mode}

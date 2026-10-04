"""Batch-generate the demo library:  python -m sim.export [n_seeds]

For every (layout, fill seed, free bay): plan -> NMPC closed-loop run -> naive baseline run ->
certify -> JSON for the viewer. A bay is only offered ("ok") if the NMPC run is certified:
no jackknife, |psi| never over psi_crit, never within 0.10 m of an obstacle, and parked within
0.8 m / 10 deg / 12 deg (hitch) of the goal. Anything else is shipped as "infeasible", never as a
guidance the professor could watch fail.
"""
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from math import cos, sin, degrees

from .advisor import advise
from .collision import CollisionMap
from .lot import build_layout, LAYOUT_NAMES
from .model import VEH, wrap
from .planner import plan_bay
from .tracker import run

OUT = os.path.join(os.path.dirname(__file__), "..", "viewer", "public", "data")
TOL_POS, TOL_HDG, TOL_PSI, MIN_CLR = 0.8, 10.0, 12.0, 0.10
FRAME_DT = 0.2


def _frames(frames, with_hor=False):
    out, hor, next_t, next_h = [], [], -1.0, -1.0
    for f in frames:
        if f["t"] + 1e-9 >= next_t:
            out.append([f["t"], f["x"], f["y"], round(f["th"], 3), round(f["psi"], 3), f["v"], round(f["delta"], 3)])
            next_t = f["t"] + FRAME_DT
        if with_hor and "hor" in f and f["t"] + 1e-9 >= next_h:
            hor.append([f["t"], [[round(a, 2), round(b, 2), round(c, 3), round(d, 3)] for a, b, c, d in f["hor"]]])
            next_h = f["t"] + 0.5
    return (out, hor) if with_hor else out


def certify(bay, r):
    g, f = bay["goal"], r["final"]
    dx, dy = f["x"] - g[0], f["y"] - g[1]
    ct, st = cos(g[2]), sin(g[2])
    lon, lat = dx * ct + dy * st, -dx * st + dy * ct
    hdg, psi = degrees(wrap(f["th"] - g[2])), degrees(f["psi"])
    ok = (not r["jackknife"] and not r["psi_limit_violated"] and r["min_clearance"] > MIN_CLR
          and abs(lon) < TOL_POS and abs(lat) < TOL_POS and abs(hdg) < TOL_HDG and abs(psi) < TOL_PSI)
    return ok, {"lon": round(lon, 2), "lat": round(lat, 2), "hdg": round(hdg, 1), "psi": round(psi, 1)}


def job(args):
    name, seed, bid = args
    lay = build_layout(name, seed)
    cm = CollisionMap(lay)
    bay = lay["bays"][bid]
    t0 = time.time()
    wp, _ = plan_bay(lay, cm, bay)
    if wp is None:
        return dict(job=args, ok=False, reason="no collision-free plan")
    nm = run(lay, cm, wp, mode="nmpc", bay=bay)
    ok, final = certify(bay, nm)
    if not ok:
        why = ("jackknife" if nm["jackknife"] else "hitch limit" if nm["psi_limit_violated"]
               else "clearance" if nm["min_clearance"] <= MIN_CLR else "parking accuracy")
        return dict(job=args, ok=False, reason=f"guidance not certified ({why})")
    nv = run(lay, cm, wp, mode="naive", bay=bay)
    frames, hor = _frames(nm["frames"], with_hor=True)
    steps = advise(nm["frames"])
    for s in steps:
        for k in ("t0", "t1", "dist", "s0", "speed_kmh", "peak_psi"):
            s[k] = round(s[k], 2)
    t_jack = None
    if nv["jackknife"]:
        t_jack = nv["frames"][-1]["t"]
    plan = {
        "duration": nm["duration"], "steps": steps, "frames": frames, "hor": hor,
        "path": [[round(w["x"], 2), round(w["y"], 2)] for w in wp[::3]],
        "metrics": {"max_psi_deg": round(degrees(nm["max_psi"]), 1), "min_clearance": nm["min_clearance"],
                    "final": final, "solves": nm["solver"]["solves"],
                    "solve_ms": round(nm["solver"]["ms"] / max(1, nm["solver"]["solves"]), 1),
                    "dist_m": round(sum(s["dist"] for s in steps), 1)},
        "baseline": {"frames": _frames(nv["frames"]), "jackknife": nv["jackknife"], "t_jack": t_jack,
                     "max_psi_deg": round(degrees(nv["max_psi"]), 1), "duration": nv["duration"]},
    }
    return dict(job=args, ok=True, plan=plan, wall=time.time() - t0)


def layout_json(name, seed, results):
    lay = build_layout(name, seed)
    status = {}
    for r in results:
        status[r["job"][2]] = r
    bays = []
    for b in lay["bays"]:
        entry = {"id": b["id"], "cx": round(b["cx"], 2), "cy": round(b["cy"], 2), "theta": round(b["theta"], 4),
                 "w": b["w"], "l": b["l"], "approach": b["approach"],
                 "goal": [round(v, 3) for v in b["goal"]], "occupied": b["occupied"],
                 "parked": None if not b["occupied"] else {k: round(b["parked"][k], 3) for k in ("cx", "cy", "theta", "l", "w")}}
        if b["occupied"]:
            entry["status"] = "occupied"
        else:
            r = status.get(b["id"])
            entry["status"] = "ok" if r and r["ok"] else "infeasible"
            if entry["status"] == "infeasible":
                entry["reason"] = r["reason"] if r else "not evaluated"
        bays.append(entry)
    return {
        "version": 1,
        "layout": {"name": name, "label": lay["label"], "seed": seed, "aisle": lay["aisle"],
                   "bounds": {k: round(v, 2) for k, v in lay["bounds"].items()},
                   "start": [round(v, 3) for v in lay["start"]], "bays": bays},
        "vehicle": {"L1": VEH.L1, "L2": VEH.L2, "d": VEH.d, "width": VEH.width,
                    "tractor_front": VEH.tractor_front, "tractor_rear": VEH.tractor_rear,
                    "trailer_front": VEH.trailer_front, "trailer_rear": VEH.trailer_rear,
                    "delta_max": round(VEH.delta_max, 4), "psi_crit": round(VEH.psi_crit, 4),
                    "psi_jack": round(VEH.psi_jack, 4)},
        "plans": {str(r["job"][2]): r["plan"] for r in results if r["ok"]},
    }


if __name__ == "__main__":
    n_seeds = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    only = os.environ.get("ONLY")
    jobs = []
    for name in LAYOUT_NAMES:
        if only and name not in only.split(","):
            continue
        for s in range(n_seeds):
            for b in build_layout(name, s)["bays"]:
                if not b["occupied"]:
                    jobs.append((name, s, b["id"]))
    print(f"{len(jobs)} scenarios", flush=True)
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=20) as ex:
        res = list(ex.map(job, jobs))
    manifest = {"layouts": []}
    for name in LAYOUT_NAMES:
        if only and name not in only.split(","):
            continue
        entry = {"name": name, "label": build_layout(name, 0)["label"], "seeds": []}
        for s in range(n_seeds):
            rs = [r for r in res if r["job"][0] == name and r["job"][1] == s]
            data = layout_json(name, s, rs)
            fn = f"{name}_{s}.json"
            with open(os.path.join(OUT, fn), "w") as f:
                json.dump(data, f, separators=(",", ":"))
            ok = sum(1 for r in rs if r["ok"])
            entry["seeds"].append({"seed": s, "file": fn, "free": len(rs), "ok": ok,
                                   "kb": round(os.path.getsize(os.path.join(OUT, fn)) / 1024)})
        manifest["layouts"].append(entry)
        tot = sum(x["free"] for x in entry["seeds"]); ok = sum(x["ok"] for x in entry["seeds"])
        print(f"{name:9s} certified {ok}/{tot}")
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    bad = [r for r in res if not r["ok"]]
    print(f"\ndone in {time.time() - t0:.0f}s; not certified ({len(bad)}):")
    for r in bad:
        print("  ", r["job"], r["reason"])

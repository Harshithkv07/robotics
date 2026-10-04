"""Version 2 server: serves the viewer and solves parking lots live.   python server.py [--port 4175] [--open]

One process, standard library only (plus the simulation's numpy/scipy). Static files come from viewer/dist;
the solver runs in a persistent pool of worker processes, one bay per task, so every free bay of a lot is
planned, driven by the NMPC, compared with the unaided driver and certified in parallel.

  GET  /api/health                      {"version": 2, "workers": n, "vehicle": {"limits", "jack_gap"}}
                                        limits: {param: [lo, hi]} for every editable vehicle parameter
  POST /api/lots {layout, seed?, occupied?, vehicle?}
                                        {"lot_id", "lot"}: lot has the same schema as a library file
                                        (sim/export.py:layout_json) with every free bay "pending" and no plans
  POST /api/layout {layout, seed, occupied?, vehicle?}
                                        {"lot"}: the same lot, unsolved: only its geometry, for previewing a rig

  GET  /api/lots/<id>                   {"lot_id", "bays": [{id, status, reason?, s?}], "done", "elapsed"}
                                        status: pending | solving | deepening | ok | infeasible (with the reason)
                                        A bay that does not certify at its first attempt is "deepening" while a second job
                                        tries it again the way a driver would (sim/export.py LADDER: another route, or
                                        pulling forward and parking again); only if that fails too is it "infeasible".
  GET  /api/lots/<id>/plans/<bay>       the certified plan (same schema as lot.plans[bay] in a library file)

`vehicle` is {L1, L2, d, delta_max, psi_crit, psi_jack} with lengths in metres and angles in DEGREES; any key may
be left out (default rig). The lot is sized for that rig and every truck in it is the same model.

It is a single-user demo server: creating a lot abandons the previous one and stops its solver processes.
"""
import argparse
import json
import os
import random
import sys
import threading
import time
import webbrowser
from concurrent.futures import Future, ProcessPoolExecutor
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from sim.export import layout_json, low_priority, ping, solve_bay  # noqa: E402
from sim.lot import LAYOUT_NAMES  # noqa: E402
from sim.model import EDITABLE, JACK_GAP, vehicle_from  # noqa: E402

DIST = os.path.join(HERE, "viewer", "dist")
PORT = 4175
MAX_BAYS = 10          # every layout has ten bays, so more workers than this would sit idle
KEEP = 3               # lots kept in memory (the current one and a couple of recent ones)


def default_workers():
    return max(1, min(MAX_BAYS, (os.cpu_count() or 4) - 2))


def process_pool(n):
    pool = ProcessPoolExecutor(max_workers=n, initializer=low_priority)
    for _ in range(n):              # start and warm every worker now, not when the first lot is requested
        pool.submit(ping)
    return pool


def preview(name, seed, occupied=None, vehicle=None):
    """A lot's geometry for a rig, unsolved (cheap: no planning)."""
    if name not in LAYOUT_NAMES:
        raise ValueError(f"unknown layout {name!r}; choose one of {', '.join(LAYOUT_NAMES)}")
    occ = None if occupied is None else tuple(sorted({int(i) for i in occupied}))
    return layout_json(name, int(seed), [], occ, vehicle_from(vehicle))


class Lots:
    """The lots being solved. `make_pool()` returns an executor; `solver(name, seed, occupied, bay, veh, deep)` returns
    what sim.export.solve_bay returns. Both are injectable so the HTTP layer can be tested with a stub. With `deepen`,
    a bay whose first attempt does not certify gets a second job (deep=True) before it is called infeasible."""

    def __init__(self, make_pool, solver=solve_bay, workers=None, deepen=True):
        self.make_pool, self.solver, self.deepen = make_pool, solver, deepen
        self.workers = workers or default_workers()
        self.pool = make_pool(self.workers)
        self.lock = threading.Lock()
        self.lots, self.order, self.count = {}, [], 0

    def create(self, name, seed=None, occupied=None, vehicle=None):
        if name not in LAYOUT_NAMES:
            raise ValueError(f"unknown layout {name!r}; choose one of {', '.join(LAYOUT_NAMES)}")
        seed = random.randrange(1000, 2 ** 31) if seed is None else int(seed)
        occ = None if occupied is None else tuple(sorted({int(i) for i in occupied}))
        veh = vehicle_from(vehicle)                        # raises ValueError for a parameter out of range
        lot = layout_json(name, seed, [], occ, veh)        # raises ValueError for bay ids out of range
        free = [b["id"] for b in lot["layout"]["bays"] if not b["occupied"]]
        for b in lot["layout"]["bays"]:
            if not b["occupied"]:
                b["status"] = "pending"
                b.pop("reason", None)
        lot["layout"]["live"] = True
        lot["layout"]["custom"] = occ is not None
        with self.lock:
            busy = any(not self._settled(rec) for rec in self.lots.values())
            if busy:                                       # abandon the previous lot: stop its solver processes
                for rec in self.lots.values():
                    rec["abandoned"] = True
                old = self.pool
                if hasattr(old, "terminate_workers"):
                    old.terminate_workers()
                else:
                    old.shutdown(wait=False, cancel_futures=True)
                self.pool = self.make_pool(self.workers)
            self.count += 1
            lot_id = f"{self.count}-{name}-{seed}"
            futures = {bid: self.pool.submit(self.solver, name, seed, occ, bid, veh) for bid in free}
            self.lots[lot_id] = {"lot": lot, "futures": futures, "deep": {}, "t0": time.time(), "t_done": None,
                                 "pool": self.pool, "args": (name, seed, occ), "veh": veh, "abandoned": False}
            self.order.append(lot_id)
            while len(self.order) > KEEP:
                self.lots.pop(self.order.pop(0), None)
            if self.deepen:
                for bid, f in futures.items():
                    f.add_done_callback(lambda fut, lot_id=lot_id, bid=bid: threading.Thread(
                        target=self._deepen, args=(lot_id, bid, fut), daemon=True).start())
        return lot_id, lot

    @staticmethod
    def _failed(f):
        """The first attempt of a bay finished without a certified plan (and did not crash)."""
        return f.done() and not f.cancelled() and f.exception() is None and not f.result()["ok"]

    def _settled(self, rec):
        """Every bay of the lot has its final verdict (a failed first attempt is not final until its deep job is)."""
        for bid, f in rec["futures"].items():
            if not f.done():
                return False
            if self.deepen and not rec["abandoned"] and self._failed(f):
                g = rec["deep"].get(bid)
                if g is None or not g.done():
                    return False
        return True

    def _deepen(self, lot_id, bid, fut):
        """Second job for a bay whose first attempt failed (runs in its own thread: submitting from the executor's
        callback thread is avoided). Only for the newest lot, in the pool that lot was submitted to."""
        if not self._failed(fut):
            return
        with self.lock:
            rec = self.lots.get(lot_id)
            if rec is None or rec["abandoned"] or self.order[-1] != lot_id:
                return
            name, seed, occ = rec["args"]
            try:
                rec["deep"][bid] = rec["pool"].submit(self.solver, name, seed, occ, bid, rec["veh"], True)
            except RuntimeError:                           # the pool was shut down under us
                g = Future()
                g.set_result({"ok": False, "reason": fut.result()["reason"]})
                rec["deep"][bid] = g

    def status(self, lot_id):
        rec = self.lots.get(lot_id)
        if rec is None:
            return None
        bays, done = [], True
        for bid, f in rec["futures"].items():
            entry = {"id": bid}
            if not f.done():
                done = False
                entry["status"] = "solving" if f.running() else "pending"
            elif f.cancelled():
                entry.update(status="infeasible", reason="cancelled")
            elif f.exception() is not None:
                entry.update(status="infeasible", reason=f"solver error: {f.exception()}")
            else:
                r = f.result()
                g = rec["deep"].get(bid)
                if not r["ok"] and self.deepen and not rec["abandoned"] and (g is None or not g.done()):
                    done = False                           # the second attempt is queued or running
                    entry["status"] = "deepening"
                    bays.append(entry)
                    continue
                if not r["ok"] and g is not None and g.done():
                    if g.cancelled() or g.exception() is not None:
                        r = dict(r, reason="cancelled" if g.cancelled() else f"solver error: {g.exception()}")
                    else:
                        r = g.result()
                entry["status"] = "ok" if r["ok"] else "infeasible"
                if not r["ok"]:
                    entry["reason"] = r["reason"]
                if "wall" in r:
                    entry["s"] = round(r["wall"], 1)
            bays.append(entry)
        if done and rec["t_done"] is None:
            rec["t_done"] = time.time()
        elapsed = (rec["t_done"] or time.time()) - rec["t0"]
        return {"lot_id": lot_id, "bays": bays, "done": done, "elapsed": round(elapsed, 1)}

    def plan(self, lot_id, bid):
        rec = self.lots.get(lot_id)
        f = rec and rec["futures"].get(bid)
        if not f or not f.done() or f.cancelled() or f.exception() is not None:
            return None
        r = f.result()
        if not r["ok"]:                                    # certified only by the second attempt?
            g = rec["deep"].get(bid)
            if g is None or not g.done() or g.cancelled() or g.exception() is not None:
                return None
            r = g.result()
        return r["plan"] if r["ok"] else None

    def close(self):
        self.pool.shutdown(wait=False, cancel_futures=True)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if not self.path.startswith("/api/lots/"):          # polling would flood the console
            sys.stderr.write("  %s  %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, separators=(",", ":")).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return super().do_GET()
        lots = self.server.lots
        parts = path.strip("/").split("/")                    # api, lots, <id>, plans, <bay>
        if parts == ["api", "health"]:
            return self._json(200, {"version": 2, "workers": lots.workers,
                                    "vehicle": {"limits": EDITABLE, "jack_gap": JACK_GAP}})
        if len(parts) == 3 and parts[1] == "lots":
            st = lots.status(parts[2])
            return self._json(200, st) if st else self._json(404, {"error": "unknown lot"})
        if len(parts) == 5 and parts[1] == "lots" and parts[3] == "plans" and parts[4].isdigit():
            plan = lots.plan(parts[2], int(parts[4]))
            return self._json(200, plan) if plan else self._json(404, {"error": "no certified plan for that bay"})
        return self._json(404, {"error": "unknown endpoint"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in ("/api/lots", "/api/layout"):
            return self._json(404, {"error": "unknown endpoint"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            spec = json.loads(self.rfile.read(n) or b"{}")
            args = (spec.get("layout"), spec.get("seed"), spec.get("occupied"), spec.get("vehicle"))
            if path == "/api/layout":
                return self._json(200, {"lot": preview(*args)})
            lot_id, lot = self.server.lots.create(*args)
        except (ValueError, TypeError, AttributeError) as e:
            return self._json(400, {"error": str(e)})
        return self._json(200, {"lot_id": lot_id, "lot": lot})


def make_server(lots, port=PORT, host="127.0.0.1", dist=DIST):
    srv = ThreadingHTTPServer((host, port), partial(Handler, directory=dist))
    srv.daemon_threads = True
    srv.lots = lots
    return srv


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--workers", type=int, default=None)
    ap.add_argument("--open", action="store_true", help="open the viewer in the default browser")
    a = ap.parse_args()
    if not os.path.exists(os.path.join(DIST, "index.html")):
        print("viewer/dist not found. Build it first:  cd viewer && npm install && npm run build")
        sys.exit(1)
    lots = Lots(process_pool, workers=a.workers)
    srv = make_server(lots, a.port)
    url = f"http://localhost:{a.port}"
    print(f"Parking guidance v2: {url}  ({lots.workers} solver processes; Ctrl+C to stop)", flush=True)
    if a.open:
        threading.Timer(0.5, webbrowser.open, (url,)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
        lots.close()


if __name__ == "__main__":
    main()

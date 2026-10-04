# Trailer Parking Guidance: NMPC + Hybrid A*

**Model Predictive Control for automated reverse docking and driver guidance of an articulated tractor-trailer.**
Group B9 - Harshith KV, G Venugopalan, Rithvik Arulprakash, Vipin Sudhakar.

Pick a yard layout, click a free bay, and the system guides the tractor-trailer into it, telling the driver
the gear, speed, steering-wheel turns and distance for each phase while a hard constraint keeps the hitch
angle away from a jackknife. Switch **Guidance OFF** on the same bay to watch an unaided driver fold the rig.

## Run the demo

Everything the demo needs is pre-computed (`viewer/public/data`) and bundled into `viewer/dist`, so once built it runs offline
with nothing but Python. `dist` is a build product and is not committed; build it once per machine:

```
cd viewer && npm install && npm run build      # once
run_demo.bat                                    # every time
```

(or `python -m http.server 4173 --directory viewer/dist` and open http://localhost:4173).
Opening `index.html` directly from disk will not work; browsers block `fetch` on `file://`.

**Flow:** choose a layout (cross, angled, parallel, tandem) -> click a green bay -> follow the guide.
"New lot" re-fills the yard with a different random set of parked trucks.

**Studying it slowly.** Playback starts at real time (1x). Use 1/4x or 1/2x to watch the steering and speed changes,
switch on **Pause at each step** to stop at the start of every instruction, and use the previous/next-step buttons or
the timeline to jump around. Keyboard: `Space` play/pause, `Left`/`Right` previous/next step, `Shift`+arrows +-5 s,
`[` and `]` slower/faster.

**What is on screen** (everything visible at once on a 1366x768 laptop, no scrolling):

| Area | Shows |
|---|---|
| Guidance bar (above the yard) | current instruction; live steer, speed and hold-distance meters against the *advised* value; the next instruction |
| Yard | the rig, the planned path, the NMPC look-ahead (tractor and trailer), the path driven so far |
| Instruments (right) | steering wheel, speedometer and hitch-angle gauge, each with an advised-value marker |
| Live maths (right) | state X and input U, the four kinematic derivatives evaluated with the current numbers, the three terms of psi-dot (steering, hitch, offset) and whether the hitch term is restoring or destabilising, constraint status, the NMPC look-ahead |
| Step table / Run summary (bottom strip) | a table of every instruction (click a row to jump to it); the certification checks and headline numbers |
| Transport (bottom) | play, step, restart, scrub bar with step ticks, speed, pause-at-each-step, camera, Guided/Unaided |

## Results (from the shipped library)

Six random fills per layout, every free bay planned, run in closed loop and **certified** before it is offered.

| Layout | Free bays | Certified | Unaided driver jackknifes | NMPC peak hitch angle | Median parked error |
|---|---|---|---|---|---|
| Cross (90 deg) | 24 | 20 | **20 / 20** | 53.3 deg | 0.58 m, 2.0 deg |
| Angled (60 deg) | 24 | 23 | **23 / 23** | 50.0 deg | 0.17 m, 4.2 deg |
| Parallel | 24 | 17 | **17 / 17** | 51.7 deg | 0.72 m, 6.4 deg |
| Tandem (forward pull-in) | 38 | 38 | 0 / 38 | 34.7 deg | 0.10 m, 3.2 deg |
| **Total** | **110** | **98** | **60 / 60 reversing** | limit is 60 deg, never exceeded | |

* Reversing is unstable, forward driving is not. That is why the unaided driver parks every *forward* (tandem)
  bay and folds on every *reverse* one, and it is the honest shape of the result, not a rigged comparison.
* Certified means: no jackknife, |psi| never above the 60 deg limit, at least 0.10 m from every obstacle, and parked
  within 0.8 m / 10 deg / 12 deg (hitch) of the goal. Bays that fail are shown grey ("too tight to certify") rather than
  shipped as guidance that could fail live. 12 of 110 fell into that group.
* The unaided baseline is a tractor-only path follower with no hitch model, no look-ahead and no constraint.

## How it works

```
Lot (4 layouts, seeded fill)  ->  Hybrid A* + analytic shots  ->  reference path
                                                                        |
                       driver instructions  <-  NMPC (hard |psi| limit) <-+
```

* **Model** (`sim/model.py`): `X = [x1, y1, theta0, psi]`, `U = [v, delta]`, with `psi' = v[tan(delta)/L1 - sin(psi)/L2 - d/(L1 L2) tan(delta) cos(psi)]`.
* **Planner** (`sim/planner.py`, `sim/shot.py`, `sim/dubins.py`): Hybrid A* whose motion primitives are *stabilised*: each
  holds a hitch-angle set-point through the feedback law `tan(delta) = L1[sin(psi)/L2 - sign(v) k (psi - psi_des)]/(1 - d/L2 cos(psi))`,
  which inverts the psi equation so that reversing becomes as well-behaved as driving forward. The heuristic and the final
  approach use the fact that the trailer axle is a flat output (`psi = atan(L2 kappa)`): a Dubins path of the trailer axle,
  simulated on the real model with a cascaded controller.
* **Tracker** (`sim/tracker.py`): receding-horizon NMPC over steering corrections around the plan, cost `J = |X-Xref|_Q + |U|_R + |dU|_S`
  (the trailer axle pose is the primary target because the tractor axle is the non-minimum-phase output when reversing),
  subject to `|psi| <= 60 deg`, the steering lock and obstacle clearance. Solver: SLSQP (SciPy).
* **Advisor** (`sim/advisor.py`): segments the run into 6-16 human-followable instructions; steering is reported in wheel turns
  (20:1 ratio), speed in km/h, plus the hitch-angle margin.
* **Viewer** (`viewer/`): React + react-three-fiber, static build, no backend. The simulation clock is a pure function
  (`viewer/src/clock.js`) so speed and auto-pause are unit-tested; numbers refresh about 5 times a second of wall-clock so they stay
  readable in slow motion.

Dependencies are `numpy` and `scipy` only: no CasADi or Ipopt.

## Regenerate / develop

```
pip install numpy scipy pytest matplotlib
python -m pytest                     # fast tests (planner, kinematics, advisor)
python -m pytest -m slow             # closed-loop NMPC vs unaided driver (~1 min)
python -m sim.export 6               # rebuild the library, ~17 min on 20 cores -> viewer/public/data
cd viewer && npm install && npm run dev      # develop
cd viewer && npm test                         # clock, auto-pause and maths-evaluator unit tests (Node built-in runner)
cd viewer && npm run build                    # rebuild viewer/dist
```

Useful tools: `python -m sim.survey` (planner coverage), `python -m sim.validate 2` (planner + NMPC + baseline, end to end),
`python -m sim.debug_plot <layout> <seed> <bay> out.png` (plan picture).

## Honest limitations

* **Precomputed, not live.** The NMPC runs offline and the viewer replays it, so a demo cannot stall. A solve takes roughly
  75-150 ms on an idle core against the 250 ms control period; the figures inside the shipped data were measured while 20 processes
  competed and read higher. A live version needs an HTTP endpoint around the same code (planned "version 2").
* **The fills are curated.** "New lot" cycles six pre-solved fills per layout; it is not an arbitrary random lot.
* **Kinematic model only.** No tyre slip, load transfer or actuator dynamics beyond a steering rate limit; results are for a
  low-speed yard manoeuvre, which is the stated scope.
* **Aisles are generous** (34 m cross, 40 m angled, 32 m parallel). Tighter yards need gentler manoeuvres than the planner can
  currently certify.
* **Base paper.** The 2026 arXiv paper named in the literature review (Hybrid A* + NMPC parking assistance) has not been read in full;
  only its title and one-line summary from the slides were used. Check the novelty claim against the paper itself.

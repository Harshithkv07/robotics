# Trailer Parking Guidance: NMPC + Hybrid A* (version 1, design 2)

**Model Predictive Control for automated reverse docking and driver guidance of an articulated tractor-trailer.**
Group B9 - Harshith KV, G Venugopalan, Rithvik Arulprakash, Vipin Sudhakar.

Pick a yard layout, click a free bay, and the system guides the tractor-trailer into it, telling the driver
the gear, speed, steering-wheel turns and distance for each phase while a hard constraint keeps the hitch
angle away from a jackknife. Switch to **Unaided** on the same bay to watch an unaided driver fold the rig.

This folder is design 2: the same planner, NMPC, demo library and playback mechanics as
[`../v1-design-1`](../v1-design-1), with the viewer UI rebuilt. See [Design 2](#design-2-what-changed-and-why) below.

## Run the demo

Everything the demo needs is pre-computed (`viewer/public/data`) and bundled into `viewer/dist`, so once built it runs offline
with nothing but Python. `dist` is a build product and is not committed; build it once per machine:

```
cd viewer && npm install && npm run build      # once
run_demo.bat                                    # every time
```

(or `python -m http.server 4174 --directory viewer/dist` and open http://localhost:4174; design 1 uses port 4173, so both
can run side by side).
Opening `index.html` directly from disk will not work; browsers block `fetch` on `file://`.

**Flow:** choose a layout (cross, angled, parallel, tandem) -> click a bay outlined in green (on the plan or in the bay list)
-> follow the guide. **Fill** (top right) steps through the six pre-solved sets of parked trucks for that layout.

**Studying it slowly.** Playback starts at real time (1x). Use 1/4x or 1/2x to watch the steering and speed changes,
switch on **Pause at each step** to stop at the start of every instruction, and use the previous/next-step buttons or
the timeline to jump around. Keyboard: `Space` play/pause, `Left`/`Right` previous/next step, `Shift`+arrows +-5 s,
`[` and `]` slower/faster.

**What is on screen** (verified to fit with no clipped panels at 1280x720, 1366x768 and 1920x1080):

| Area | Choosing a bay | Guiding |
|---|---|---|
| Top bar | layout tabs, fill stepper | same |
| Left rail | every bay with its status (certified / not certified and why / occupied), lot facts, what "certified" means | **Procedure**: every step with gear, steering, speed, distance and hitch peak; click to jump. **Run report**: guided vs unaided, certification checks, parked error, solver figures |
| Instruction band (above the plan) | how many bays are certified, plan legend | gear, the current instruction, the advised steering / speed / distance / hitch peak, the next step, **Guided / Unaided** switch |
| Plan | the lot drawn to scale (scale bar, axes), Plan / 3-D view | the rig, planned path, NMPC look-ahead (tractor and trailer), path driven so far, Follow rig |
| Right column | the problem, the method, the vehicle model and its parameters | **Hitch angle**: dial with limits and the NMPC predicted peak, plus psi over the last 10 s and the next 9.6 s against the limit. **Driver inputs**: steering wheel and speed, live against advised. **Live model**: X, X-dot and U as column vectors and the three terms of psi-dot as bars, marked restoring or destabilising |
| Bottom bar | library totals | play, previous / next step, restart, a timeline split into the steps and coloured by gear, clock, speed, pause at each step |

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
* **Viewer** (`viewer/`): React + react-three-fiber, static build, no backend. Fonts (IBM Plex) are bundled, so it renders the same offline. The simulation clock is a pure function
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

## Design 2: what changed and why

Design 1 used a dark navy theme with glowing cyan accents, rounded cards, pills and uppercase labels everywhere: it looked
generated rather than engineered, and dark themes wash out on a projector. Design 2 keeps every mechanic (layouts, fills,
bay picking, guided and unaided runs, playback speeds, pause at each step, keyboard, Plan/3-D and follow camera, the
live maths) and changes the presentation:

* **Light technical-drawing look.** Paper background, hairline rules instead of floating cards, the plan drawn like a CAD
  sheet with outlined vehicles, a survey grid, a true scale bar and axes. Reads well on a projector.
* **One meaning per colour.** Ink = measured / live; blue = what the controller commands (NMPC look-ahead, advised values,
  the current step); orange = the rig being parked (like a yard tractor); green / amber / red = status only.
* **Typography.** IBM Plex Sans with tabular figures for every number; symbols typeset in a math face
  (x&#x0307;<sub>1</sub>, &theta;<sub>0</sub>, &psi;), so the live model reads like the equations on the slides.
* **Layout by task.** Procedure on the left (what to do), plan in the centre with the current instruction above it
  (where you are), instruments on the right (how it is going). Camera controls moved onto the plan, Guided / Unaided
  next to the instruction it changes.
* **More information, less chrome.** New: psi history + NMPC prediction chart against the limit, the predicted peak on
  the hitch dial, psi-dot terms as signed bars, X / X-dot / U as aligned column vectors, a timeline that shows the reverse
  stretches, why each uncertified bay failed, and library totals.

## Honest limitations

* **Precomputed, not live.** The NMPC runs offline and the viewer replays it, so a demo cannot stall. A solve takes roughly
  75-150 ms on an idle core against the 250 ms control period; the figures inside the shipped data were measured while 20 processes
  competed and read higher. A live version needs an HTTP endpoint around the same code (planned "version 2").
* **The fills are curated.** "New lot" cycles six pre-solved fills per layout; it is not an arbitrary random lot.
* **Kinematic model only.** No tyre slip, load transfer or actuator dynamics beyond a steering rate limit; results are for a
  low-speed yard manoeuvre, which is the stated scope.
* **Aisles are generous** (34 m cross, 40 m angled, 32 m parallel). Tighter yards need gentler manoeuvres than the planner can
  currently certify.
* **Base paper.** G. Alenchery et al., "Parking Assistance for Trailer-Truck Transport Vehicles Using Sensor Fusion and Motion
  Planning", arXiv:2605.02716 (2026). It proposes sensor fusion -> Hybrid A* -> NMPC -> LQR but implements only A* with B-spline
  smoothing; the NMPC was never built and jackknifing was observed. This project builds and measures that NMPC layer.

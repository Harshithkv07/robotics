# Trailer Parking Guidance: NMPC + Hybrid A*

Group B9 - Harshith KV, G Venugopalan, Rithvik Arulprakash, Vipin Sudhakar.

Pick a yard layout, click a free bay, and the system guides a tractor-trailer into it (gear, speed, steering-wheel
turns, distance) while an NMPC controller holds a hard hitch-angle limit so the rig cannot jackknife.

| Folder | What it is | Run |
|---|---|---|
| [`v2/`](v2/) | **Version 2 (current).** Version 1 design 2 plus a live solver: new random lots and edited fills are planned, driven and certified on the laptop in seconds. Same maths, about 6x faster engine. | `v2/run_demo.bat` (port 4175) |
| [`v1/v1-design-2/`](v1/v1-design-2/) | Version 1, design 2. Precomputed library, professional viewer UI: light technical-drawing look, procedure / plan / instruments layout, live model and NMPC look-ahead chart. | `v1/v1-design-2/run_demo.bat` (port 4174) |
| [`v1/v1-design-1/`](v1/v1-design-1/) | Version 1, design 1: the first viewer UI (dark theme), plus the presentation deck's build scripts. | `v1/v1-design-1/run_demo.bat` (port 4173) |
| `doc/` | The final presentation deck, plus the first-review deck and formulation document (the last two are kept out of git). | |

Each version folder is self-contained: open its README for how to build and run it. "Version 1" replays a precomputed
library; "version 2" also solves new lots live. The pre-reset project (CasADi backend and the old frontend) is kept in the
git history at commit `968c2d1`.

# Trailer Parking Guidance: NMPC + Hybrid A*

Group B9 - Harshith KV, G Venugopalan, Rithvik Arulprakash, Vipin Sudhakar.

Pick a yard layout, click a free bay, and the system guides a tractor-trailer into it (gear, speed, steering-wheel
turns, distance) while an NMPC controller holds a hard hitch-angle limit so the rig cannot jackknife.

| Folder | What it is | Run |
|---|---|---|
| [`v1-design-2/`](v1-design-2/) | **Version 1, design 2 (current).** Same planner, NMPC, demo library and mechanics, with a rebuilt professional viewer UI: light technical-drawing look, procedure / plan / instruments layout, live model and NMPC look-ahead chart. | `v1-design-2/run_demo.bat` (port 4174) |
| [`v1-design-1/`](v1-design-1/) | Version 1, design 1: the first viewer UI (dark theme), plus the final presentation deck and its build scripts. | `v1-design-1/run_demo.bat` (port 4173) |

Each folder is self-contained: open its README for how to build and run it. "Version 1" is the precomputed build
(the NMPC runs offline and the viewer replays certified runs); a live solver is the planned version 2.
The pre-reset project (CasADi backend and the old frontend) is kept in the git history at commit `968c2d1`.

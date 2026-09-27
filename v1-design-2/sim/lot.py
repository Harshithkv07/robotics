"""Parking lots as data. A layout is a bounds rectangle plus a list of bays.

World frame: x east, y north, metres, angles in radians.
Every bay stores the GOAL pose of the tractor rear axle (rig fully inside the bay, psi = 0) and a
PRE-GOAL pose on the bay axis from which a straight final approach reaches the goal.

`theta` of a bay is the direction the tractor faces once parked; `u = (cos theta, sin theta)`.
  approach == "reverse": truck backs in along -u, pre-goal sits ahead of the goal (goal + s*u)
  approach == "forward": truck pulls in along +u, pre-goal sits behind the goal (goal - s*u)
"""
from math import cos, sin, radians, pi, degrees
import random

from .model import VEH

RIG_BACK = 9.5      # trailer tail behind tractor rear axle when straight
RIG_FRONT = 5.0     # tractor nose ahead of rear axle
RIG_LEN = RIG_BACK + RIG_FRONT
RIG_MID = (RIG_FRONT - RIG_BACK) / 2.0   # -2.25 : rig centre relative to rear axle

BAY_W = 4.2
BAY_L = 18.0
LEAD_EXTRA = 12.0   # straight, settled run into the bay = pre_dist + this (errors decay ~e-fold per 4 m)
PRE_DIST = 8.0      # length of the straight final approach

LAYOUT_NAMES = {
    "cross": "Cross (90 deg)",
    "angled": "Angled (60 deg)",
    "parallel": "Parallel",
    "tandem": "Tandem (in-line)",
}


def _bay(idx, mouth, theta, approach, width=BAY_W, length=BAY_L, pre_dist=PRE_DIST, lead=None, lead_extra=None):
    """mouth = centre of the open end of the bay; interior extends along -u for `length`."""
    ux, uy = cos(theta), sin(theta)
    cx, cy = mouth[0] - ux * length / 2, mouth[1] - uy * length / 2
    # tractor rear axle for a rig centred in the bay
    gx, gy = cx - RIG_MID * ux, cy - RIG_MID * uy
    s = pre_dist
    lead = pre_dist + (LEAD_EXTRA if lead_extra is None else lead_extra) if lead is None else lead
    sign = 1 if approach == "reverse" else -1
    return {
        "id": idx, "cx": cx, "cy": cy, "theta": theta, "w": width, "l": length,
        "approach": approach, "lead": lead,
        "goal": [gx, gy, theta],
        "pre": [gx + sign * s * ux, gy + sign * s * uy, theta],
        "occupied": False, "parked": None,
    }


def _rect_poly(cx, cy, th, length, width, mid=0.0):
    c, s = cos(th), sin(th)
    hl, hw = length / 2, width / 2
    pts = [(-hl, -hw), (hl, -hw), (hl, hw), (-hl, hw)]
    return [[cx + (px + mid) * c - py * s, cy + (px + mid) * s + py * c] for px, py in pts]


def _layout_cross(n_per_row=5, angle=90.0):
    a = radians(angle)
    aisle = 34.0 if angle >= 89.0 else 40.0     # roomy yard apron: gentle, low-hitch-angle manoeuvres fit
    pitch = BAY_W / sin(a)
    bays, i = [], 0
    for row in (+1, -1):
        for k in range(n_per_row):
            x = 4.0 + k * pitch
            edge_y = row * aisle / 2
            th = -row * a          # top row faces down (-y), bottom row faces up
            bays.append(_bay(i, (x, edge_y), th, "reverse", lead_extra=12.0 if angle >= 89.0 else 6.0))
            i += 1
    return aisle, bays


def _layout_parallel(n_per_row=5):
    L = 36.0                                   # an articulated rig needs ~2.5x its length to parallel-park
    aisle, pitch, bays, i = 32.0, L + 1.0, [], 0
    for row in (+1, -1):
        for k in range(n_per_row):
            x0 = 2.0 + k * pitch
            # long axis along x; mouth is the +x end so the truck reverses in westwards
            bays.append(_bay(i, (x0 + L, row * (aisle / 2 + BAY_W / 2)), 0.0, "reverse",
                             length=L, pre_dist=3.0, lead_extra=4.0))
            i += 1
    return aisle, bays


def _layout_tandem(n_per_lane=5):
    aisle, pitch, bays, i = 14.0, BAY_L + 1.5, [], 0
    for row in (+1, -1):
        for k in range(n_per_lane):
            x0 = 2.0 + k * pitch
            # slots end to end; truck pulls in forward along +x, mouth is the -x end
            bays.append(_bay(i, (x0, row * aisle / 2), 0.0, "forward", lead_extra=4.0))
            # _bay puts the interior along -u, so flip: place by explicit centre
            b = bays[-1]
            cx, cy = x0 + BAY_L / 2, row * aisle / 2
            gx, gy = cx - RIG_MID, cy
            b.update(cx=cx, cy=cy, goal=[gx, gy, 0.0], pre=[gx - PRE_DIST, gy, 0.0])
            i += 1
    return aisle, bays


_BUILDERS = {
    "cross": lambda: _layout_cross(5, 90.0),
    "angled": lambda: _layout_cross(5, 60.0),
    "parallel": _layout_parallel,
    "tandem": _layout_tandem,
}


def build_layout(name, seed=0, fill=0.55):
    aisle, bays = _BUILDERS[name]()

    # bounds: everything (bays + entry road) with a small margin
    xs, ys = [-34.0], []
    for b in bays:
        for px, py in _rect_poly(b["cx"], b["cy"], b["theta"], b["l"], b["w"]):
            xs.append(px); ys.append(py)
    ys += [-aisle / 2, aisle / 2]
    bounds = {"xmin": min(xs), "xmax": max(xs) + 14.0,
              "ymin": min(ys) - 4.0, "ymax": max(ys) + 4.0}

    # seeded random fill (at least 3 bays left free)
    rng = random.Random(seed)
    if name == "tandem":
        # trucks queue: each lane fills from its far end, so free slots stay reachable
        per = len(bays) // 2
        free = set()
        for lane in range(2):
            n_occ = rng.randint(1, 3)
            free |= {lane * per + k for k in range(per - n_occ)}
    else:
        free_target = max(3, round(len(bays) * (1 - fill)))
        order = list(range(len(bays)))
        rng.shuffle(order)
        free = set(order[:free_target])
    for b in bays:
        if b["id"] in free:
            continue
        b["occupied"] = True
        th = b["theta"] + radians(rng.uniform(-1.5, 1.5))
        u = (cos(b["theta"]), sin(b["theta"]))
        n = (-u[1], u[0])
        lat, lon = rng.uniform(-0.35, 0.35), rng.uniform(-0.8, 0.8)
        cx = b["cx"] + n[0] * lat + u[0] * lon
        cy = b["cy"] + n[1] * lat + u[1] * lon
        b["parked"] = {"cx": cx, "cy": cy, "theta": th, "l": RIG_LEN, "w": VEH.width,
                       "poly": _rect_poly(cx, cy, th, RIG_LEN, VEH.width)}

    return {
        "name": name, "label": LAYOUT_NAMES[name], "seed": seed,
        "aisle": aisle, "bounds": bounds, "bays": bays,
        "start": [-16.0, 0.0, 0.0, 0.0],   # gate pose: x1, y1, th0, psi
        "obstacles": [b["parked"]["poly"] for b in bays if b["occupied"]],
    }

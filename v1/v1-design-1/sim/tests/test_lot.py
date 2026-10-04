from math import radians

import pytest

from sim.lot import build_layout, LAYOUT_NAMES
from sim.collision import CollisionMap


@pytest.mark.parametrize("name", list(LAYOUT_NAMES))
def test_layouts_have_ten_bays_and_some_free(name):
    lay = build_layout(name, seed=1)
    assert len(lay["bays"]) == 10
    free = [b for b in lay["bays"] if not b["occupied"]]
    assert 3 <= len(free) <= 6


def test_fill_is_reproducible_from_seed():
    a = [b["occupied"] for b in build_layout("cross", seed=7)["bays"]]
    b = [b["occupied"] for b in build_layout("cross", seed=7)["bays"]]
    c = [b["occupied"] for b in build_layout("cross", seed=8)["bays"]]
    assert a == b and a != c


@pytest.mark.parametrize("name", list(LAYOUT_NAMES))
@pytest.mark.parametrize("seed", [0, 1, 2, 3])
def test_every_free_bay_goal_pose_is_collision_free(name, seed):
    lay = build_layout(name, seed)
    cm = CollisionMap(lay)
    for b in lay["bays"]:
        if b["occupied"]:
            continue
        g = b["goal"]
        assert cm.clearance((g[0], g[1], g[2], 0.0)) > 0.3, (name, seed, b["id"])


def test_start_pose_is_clear():
    for name in LAYOUT_NAMES:
        lay = build_layout(name, 0)
        assert CollisionMap(lay).clearance(tuple(lay["start"])) > 0.5


def test_collision_detected_against_parked_rig_and_wall():
    lay = build_layout("cross", 0)
    cm = CollisionMap(lay)
    occ = next(b for b in lay["bays"] if b["occupied"])
    g = occ["goal"]
    assert cm.collides((g[0], g[1], g[2], 0.0))               # on top of a parked rig
    b = lay["bounds"]
    assert cm.collides((b["xmax"] + 2, 0.0, 0.0, 0.0))        # outside the lot

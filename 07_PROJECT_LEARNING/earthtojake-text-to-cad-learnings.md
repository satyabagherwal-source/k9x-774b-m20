# Forensic Learning Record (Deep Inspection): earthtojake/text-to-cad

> **Canonical Artifact**: `07_PROJECT_LEARNING/earthtojake-text-to-cad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:23:46.587Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `earthtojake/text-to-cad`
- **Description**: Give your agent CAD superpowers.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17459 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `models/assemblies/src/cutaway_turbofan_engine/cutaway_turbofan_engine.py`
```
from __future__ import annotations
from cadgen import step

from math import atan2, cos, degrees, hypot, radians, sin

from cadgen import build123d as bd


DISPLAY_NAME = "Cutaway miniature turbofan jet engine"

# Units: millimeters.
# Origin: front intake center at X=0 on the engine axis.
# Engine axis: +X, centered through Y=0, Z=0.

MODEL_LABEL = "cutaway_miniature_turbofan_engine"

CUTAWAY_START_DEG = -5.0
CUTAWAY_END_DEG = 95.0
VISIBLE_SECTOR_START_DEG = CUTAWAY_END_DEG
VISIBLE_SECTOR_END_DEG = 360.0 + CUTAWAY_START_DEG

NACELLE_LENGTH = 180.0
NACELLE_OUTER_RADIUS = 55.0
NACELLE_INNER_RADIUS = 48.0

BLADE_ROOT_OVERLAP = 1.5
STATOR_TIP_OVERLAP = 1.0
STRUT_OVERLAP = 0.8

BASE_CENTER_X = 90.0
BASE_LENGTH = 140.0
BASE_WIDTH = 70.0
BASE_THICKNESS = 8.0
BASE_TOP_Z = -110.0
BASE_BOTTOM_Z = BASE_TOP_Z - BASE_THICKNESS


def _polar_yz(radius: float, angle_rad: float) -> tuple[float, float]:
    return (radius * cos(angle_rad), radius * sin(angle_rad))


def _point_yz(x_pos: float, radius: float, angle_rad: float) -> tuple[float, float, float]:
    y_pos, z_pos = _polar_yz(radius, angle_rad)
    return (x_pos, y_pos, z_pos)


def _annular_sector_points(
    *,
    outer_radius: float,
    inner_radius: float,
    start_deg: float = VISIBLE_SECTOR_START_DEG,
    end_deg: float = VISIBLE_SECTOR_END_DEG,
    segments: int = 96,
) -> list[tuple[float, float]]:
    outer_points = []
    inner_points = []
    for index in range(segments + 1):
        angle = radians(start_deg + (end_deg - start_deg) * index / segments)
        outer_points.append(_polar_yz(outer_radius, angle))
        inner_points.append(_polar_yz(inner_radius, angle))
    return outer_points + list(reversed(inner_points))


def _annular_sector_face(
    *,
    x_pos: float,
    outer_radius: float,
    inner_radius: float,
    start_deg: float = VISIBLE_SECTOR_START_DEG,
    end_deg: float = VISIBLE_SECTOR_END_DEG,
    segments: int = 72,
) -> bd.Face:
    points = []
    for index in range(segments + 1):
        angle = radians(start_deg + (end_deg - start_deg) * index / segments)
        points.append(_point_yz(x_pos, outer_radius, angle))
    for index in range(segments, -1, -1):
        angle = radians(start_deg + (end_deg - start_deg) * index / segments)
        points.append(_point_yz(x_pos, inner_radius, angle))
    return bd.Face.make_surface(bd.Wire.make_polygon(points, close=True))


def _yz_angle_degrees(y_pos: float, z_pos: float) -> float:
    return degrees(atan2(z_pos, y_pos)) % 360.0


def _angle_delta_deg(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def _in_cutaway(angle_deg: float) -> bool:
    angle = angle_deg % 360.0
    start = CUTAWAY_START_DEG % 360.0
    end = CUTAWAY_END_DEG % 360.0
    if start > end:
        return angle >= start or angle <= end
    return start <= angle <= end


def _safe_fillet(part, edges, radius: float):
    if not edges:
        return part
    try:
        return bd.fillet(edges, radius=radius)
    except Exception:
        return part


def _label(part, label: str, color: bd.Color | None = None):
    part.label = label
    if color is not None:
        part.color = color
    return part


def _make_compound(label: str, parts: list, color: bd.Color | None = None) -> bd.Compound:
    compound = bd.Compound(obj=parts, children=parts, label=label)
    if color is not None:
        compound.color = color
    return compound


def _make_cylinder_x(
    *,
    label: str,
    x_start: float,
    x_end: float,
    radius: float,
    color: bd.Color,
) -> object:
    with bd.BuildPart() as cylinder_part:
        with bd.Locations(bd.Location(((x_start + x_end) / 2.0, 0.0, 0.0))):
            bd.Cylinder(
                radius=radius,
                height=x_end - x_start,
                rotation=(0.0, 90.0, 0.0),
                align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.CENTER),
            )
    return _label(cylinder_part.part, label, color)


def _make_annular_sector(
    *,
    label: str,
    x_start: float,
    x_end: float,
    outer_radius: float,
    inner_radius: float,
    color: bd.Color,
    fillet_cut_edges: float | None = None,
) -> object:
    with bd.BuildPart() as sector:
        with bd.BuildSketch(bd.Plane.YZ):
            bd.Polygon(
                _annular_sector_points(
                    outer_radius=outer_radius,
                    inner_radius=inner_radius,
                ),
                align=None,
            )
        bd.extrude(amount=x_end - x_start)

    part = sector.part.moved(bd.Location((x_start, 0.0, 0.0)))

    if fillet_cut_edges is not None:
        cut_edges = []
        for edge in part.edges():
            bbox = edge.bounding_box()
            center = bbox.center()
            if bbox.size.X < (x_end - x_start) * 0.85:
                continue
            angle = _yz_angle_degrees(center.Y, center.Z)
            radius = hypot(center.Y, center.Z)
            if (
                min(inner_radius, outer_radius) - 1.0
                <= radius
                <= max(inner_radius, outer_radius) + 1.0
                and (
                    _angle_delta_deg(angle, CUTAWAY_START_DEG) < 1.0
                    or _angle_delta_deg(angle, CUTAWAY_END_DEG) < 1.0
                )
            ):
                cut_edges.append(edge)
        part = _safe_fillet(part, cut_edges, fillet_cut_edges)

    return _label(part, label, color)


def _make_tapered_annular_sector(
    *,
    label: str,
    x_start: float,
    x_end: float,
    outer_start_radius: float,
    inner_start_radius: float,
    outer_end_radius: float,
    inner_end_radius: float,
    color: bd.Color,
) -> object:
    part = bd.loft(
        [
            _annular_sector_face(
                x_pos=x_start,
                outer_radius=outer_start_radius,
                inner_radius=inner_start_radius,
            ),
            _annular_sector_face(
                x_pos=x_end,
                outer_radius=outer_end_radius,
                inner_radius=inner_end_radius,
            ),
        ]
    )
    return _label(part, label, color)


def _make_intake_lip() -> object:
    with bd.BuildPart() as lip:
        with bd.Locations(bd.Location((5.0, 0.0, 0.0))):
            bd.Torus(
                major_radius=50.0,
                minor_radius=5.0,
                major_angle=260.0,
                rotation=(0.0, 90.0, 0.0),
            )
    part = lip.part.rotate(bd.Axis.X, -175.0)
    return _label(part, "rounded_intake_lip_5mm_radius", bd.Color(0.74, 0.77, 0.78, 1.0))


def _make_nacelle_shell() -> bd.Compound:
    parts = [
        _make_annular_sector(
            label="nacelle_hollow_duct_100deg_cutaway",
            x_start=0.0,
            x_end=NACELLE_LENGTH,
            outer_radius=NACELLE_OUTER_RADIUS,
            inner_radius=NACELLE_INNER_RADIUS,
            color=bd.Color(0.73, 0.76, 0.78, 1.0),
            fillet_cut_edges=2.0,
        ),
        _make_intake_lip(),
        _make_tapered_annular_sector(
            label="rear_exhaust_ring_od92_id74",
            x_start=160.0,
            x_end=180.0,
            outer_start_radius=48.0,
            inner_start_radius=39.0,
            outer_end_radius=46.0,
            inner_end_radius=37.0,
            color=bd.Color(0.62, 0.65, 0.67, 1.0),
        ),
    ]
    return _make_compound("nacelle_shell", parts)


def _normalized(vector: tuple[float, float, float]) -> tuple[float, float, float]:
    length = hypot(hypot(vector[0], vector[1]), vector[2])
    return (vector[0] / length, vector[1] / length, vector[2] / length)


def _scale(vector: tuple[float, float, float], amount: float) -> tuple[float, float, float]:
    return (vector[0] * amount, vector[1] * amount, vector[2] * amount)


def _add_vec(
    a: tuple[float, float, float],
    b: tuple[float, float, float],
) -> tuple[float, float, float]:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _section_face(
    *,
    center: tuple[float, float, float],
    chord_direction: tuple[float, float, float],
    thickness_direction: tuple[float, float, float],
    chord: float,
    thickness: float,
) -> bd.Face:
    chord_half = _scale(chord_direction, chord / 2.0)
    thickness_half = _scale(thickness_direction, thickness / 2.0)
    points = [
        _add_vec(_add_vec(center, chord_half), thickness_half),
        _add_vec(_add_vec(center, _scale(chord_half, -1.0)), thickness_half),
        _add_vec(_add_vec(center, _scale(chord_half, -1.0)), _scale(thickness_half, -1.0)),
        _add_vec(_add_vec(center, chord_half), _scale(thickness_half, -1.0)),
    ]
    return bd.Face.make_surface(bd.Wire.make_polygon(points, close=True))


def _make_radial_blade(
    *,
    label: str,
    x_center: float,
    base_angle: float,
    root_radius: float,
    tip_radius: float,
    chord: float,
    thickness: float,
    sweep_deg: float,
    twist_root_deg: float,
    twist_tip_deg: float,
    color: bd.Color,
    attachment_radius: float | None = None,
    axial_sweep: float = 0.0,
) -> object:
    span = tip_radius - root_radius
    stations = []
    if attachment_radius is not None and attachment_radius < root_radius:
        stations.append((attachment_radius, 0.0, 0.52, 1.08))
    stations.extend(
        [
            (root_radius, 0.0, 1.00, 1.00),
            (root_radius + span * 0.38, 0.38, 1.04, 0.92),
            (root_radius + span * 0.72, 0.72, 0.96, 0.84),
            (tip_radius, 1.0, 0.78, 0.68),
        ]
    )

    faces = []
    for radius, t, chord_scale, thickness_scale in stations:
        angle = base_angle + radians(sweep_deg) * (t**1.25)
        twist = radians(twist_root_deg + (twist_tip_deg - twist_root_deg) * t)
        tangent = (0.0, -sin(angle), cos(angle))
        x_axis = (1.0, 0.0, 0.0)
        chord_direction = _normalized(
            (
                cos(twist) * x_axis[0] + sin(twist) * tangent[0],
                cos(twist) * x_axis[1] + sin(twist) * tangent[1],
                cos(twist) * x_ax
```

### Core Architecture Module: `models/examples/src/radial_engine_cylinder.py`
```
from __future__ import annotations
from cadgen import step
from math import cos, radians, sin, tau

from cadgen import build123d as bd

from lib.part_common import circular_edges, polar_point, safe_fillet


BARREL_DIAMETER = 36.0
BARREL_HEIGHT = 70.0

FIN_COUNT = 12
FIN_DIAMETER = 62.0
FIN_THICKNESS = 2.0
FIN_Z_VALUES = tuple(10.0 + 5.0 * index for index in range(FIN_COUNT))

BASE_FLANGE_DIAMETER = 70.0
BASE_FLANGE_THICKNESS = 8.0
MOUNT_HOLE_COUNT = 6
MOUNT_HOLE_DIAMETER = 5.0
MOUNT_BOLT_CIRCLE_DIAMETER = 56.0

TOP_CAP_DIAMETER = 44.0
TOP_CAP_BOTTOM_Z = 70.0
TOP_CAP_HEIGHT = 8.0

BOSS_DIAMETER = 12.0
BOSS_LENGTH = 24.0
BOSS_ANGLE_DEGREES = 35.0
BOSS_BORE_DIAMETER = 5.0

EDGE_FILLET = 0.95


def _boss_center() -> tuple[float, float, float]:
    angle = radians(BOSS_ANGLE_DEGREES)
    start = (TOP_CAP_DIAMETER / 2.0 - 1.0, 0.0, TOP_CAP_BOTTOM_Z + TOP_CAP_HEIGHT / 2.0)
    direction = (cos(angle), 0.0, sin(angle))
    return (
        start[0] + direction[0] * BOSS_LENGTH / 2.0,
        0.0,
        start[2] + direction[2] * BOSS_LENGTH / 2.0,
    )


def _edge_fillets(part):
    edges = []
    for z_pos in FIN_Z_VALUES:
        edges.extend(circular_edges(part, radius=FIN_DIAMETER / 2.0, axis="z", coordinate=z_pos))
        edges.extend(circular_edges(part, radius=FIN_DIAMETER / 2.0, axis="z", coordinate=z_pos + FIN_THICKNESS))
    edges.extend(circular_edges(part, radius=BASE_FLANGE_DIAMETER / 2.0, axis="z", coordinate=0.0))
    edges.extend(circular_edges(part, radius=BASE_FLANGE_DIAMETER / 2.0, axis="z", coordinate=BASE_FLANGE_THICKNESS))
    return edges


@step(out="../STEP/radial_engine_cylinder.step")
def radial_engine_cylinder():
    """Return the radial-engine-style cylinder model in millimeters."""
    boss_rotation_y = 90.0 - BOSS_ANGLE_DEGREES
    boss_center = _boss_center()

    with bd.BuildPart() as cylinder:
        bd.Cylinder(
            radius=BARREL_DIAMETER / 2.0,
            height=BARREL_HEIGHT,
            align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN),
        )

        bd.Cylinder(
            radius=BASE_FLANGE_DIAMETER / 2.0,
            height=BASE_FLANGE_THICKNESS,
            align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN),
            mode=bd.Mode.ADD,
        )

        for z_pos in FIN_Z_VALUES:
            with bd.Locations(bd.Location((0.0, 0.0, z_pos))):
                bd.Cylinder(
                    radius=FIN_DIAMETER / 2.0,
                    height=FIN_THICKNESS,
                    align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN),
                    mode=bd.Mode.ADD,
                )

        with bd.Locations(bd.Location((0.0, 0.0, TOP_CAP_BOTTOM_Z))):
            bd.Cylinder(
                radius=TOP_CAP_DIAMETER / 2.0,
                height=TOP_CAP_HEIGHT,
                align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN),
                mode=bd.Mode.ADD,
            )

        with bd.Locations(bd.Location(boss_center)):
            bd.Cylinder(
                radius=BOSS_DIAMETER / 2.0,
                height=BOSS_LENGTH,
                rotation=(0.0, boss_rotation_y, 0.0),
                align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.CENTER),
                mode=bd.Mode.ADD,
            )

        for index in range(MOUNT_HOLE_COUNT):
            x_pos, y_pos = polar_point(MOUNT_BOLT_CIRCLE_DIAMETER / 2.0, tau * index / MOUNT_HOLE_COUNT)
            with bd.Locations(bd.Location((x_pos, y_pos, -1.0))):
                bd.Cylinder(
                    radius=MOUNT_HOLE_DIAMETER / 2.0,
                    height=BASE_FLANGE_THICKNESS + 2.0,
                    align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN),
                    mode=bd.Mode.SUBTRACT,
                )

        with bd.Locations(bd.Location(boss_center)):
            bd.Cylinder(
                radius=BOSS_BORE_DIAMETER / 2.0,
                height=BOSS_LENGTH + 6.0,
                rotation=(0.0, boss_rotation_y, 0.0),
                align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.CENTER),
                mode=bd.Mode.SUBTRACT,
            )

    part = cylinder.part
    part = safe_fillet(part, _edge_fillets(part), radius=EDGE_FILLET)
    part.label = "radial_engine_cylinder_cooling_fins"
    return part


if __name__ == "__main__":
    radial_engine_cylinder()

```

### Core Architecture Module: `models/f1/src/engine_cover.py`
```
"""F1 part model: engine cover.

The parts `lib/engine_cover.py` builds around the cover shell (aerial fin, exit
duct liner, aperture and cover flanges, Dzus fasteners, louvres), in car
coordinates, plus the shell itself as a child model: the shell is nine tenths of
the cover's build time, so an edit to anything else never rebuilds it. `f1.py`
links the engine cover as occurrence `#o1.8`; rebuild `f1.py` to pick up a
change here.
"""

from __future__ import annotations

from cadgen import step

from cover_panel import cover_panel
from lib import engine_cover as engine_cover_lib
from lib import surfaces


@step(out="../STEP/engine_cover.step")
def engine_cover():
    return surfaces.group("engine_cover", [
        cover_panel(),
        *engine_cover_lib.build_engine_cover_parts(),
    ])


if __name__ == "__main__":
    engine_cover()

```

### Core Architecture Module: `models/f1/src/lib/engine_cover.py`
```
"""Engine cover panel, airbox intake, cooling louvres, aerial fin.

Two REMOVABLE PANELS. Both are genuine shells — an outer loft minus an inner
loft — so every free edge shows carbon thickness and the strip-down animation
can lift them off an engine that is really there underneath.

THE SECTION LAW (engine cover)
------------------------------
Every station is one closed outline built from four named features, written as
a front-view sketch in (y, z) from the centreline bottom, out, and over the
top:

    SILL    (y_cr - uc, z_cr - drop)  the panel's free lower edge, TUCKED IN
    CREASE  (y_cr, z_cr)              THE feature line: widest point, KNUCKLE
    RIDGE   (0,    spine_z + h_r)     centreline crest — a V, not a dome

    RIDGE --deck + spine--> CREASE --skirt--> SILL --(false bottom, cut away)

Both named lines are genuine CORNERS, not highlights, and they are built the
only way a lofted spline section can hold a corner: points 2.4-2.6 mm apart
straddling the vertex, with the tangent on each side taken from the analytic
law of the surface that meets there. The spline is then forced to turn through
the whole included angle inside 5 mm, which at render resolution is an edge.

  * at the CREASE the deck arrives falling at 57-67 deg and the skirt leaves
    at 105-121 deg — the outline turns a hard 52-69 deg corner, and because
    the skirt tucks INBOARD (`_undercut`) the crease is unambiguously the
    widest point of the section with daylight under it;
  * at the RIDGE two tensioned deck surfaces meet on the centreline at about
    110 deg. The spine is zero where the airbox owns the centreline, rises as
    the aperture closes, and the aerial fin then grows straight out of its
    crest — so it starts and ends on another feature, never fading out.

Everything between the two corners is ONE function (`surf_z`): a deck of
`1 - (1 - u)^2` — flat under the spine, turning down hard only in the last
third before the crease — with the spine's `h (1 - v)^2` added on top of it.
Adding rather than butting the two laws together is what keeps the valley at
the foot of the spine tangent-continuous; see `_ridge_z`.

THE COKE-BOTTLE WAIST
---------------------
`crease()` is the plan-view story. Ahead of x = -2860 the sidepod panel owns
`spec.SHOULDER_LINE` (its crease sits at y = 500 at the crest, far outboard of
this panel), so the cover carries its own crease just inboard of the sidepod's
inner wall — a second line, parallel, one panel break away. At x = -2860 the
sidepod is gone and the two lines merge: from there aft the cover's crease IS
`spec.shoulder_at(x)` exactly, pinching 319 -> 176 -> 155 mm and terminating
into the rear-wing pylon root run at (-3800, 62, 386). Half width falls by 58%
between the cockpit and the tail; that is the waist.

THE SPINE
---------
One analytic fall, 852 at the roll hoop to 434 over the gearbox, with the rate
growing rearward (0.45t + 0.55t^3). No table, no keyframes, so there is no
bump and no flat spot anywhere along 1750 mm. It clears the plenum crown
(z = 699 at x = -2235..-2570) by 30 mm and the gearbox casing by 23 mm.

WHAT IS CUT INTO IT
-------------------
* the airbox aperture — the airbox's own outer loft, grown by `spec.PANEL_GAP`,
  subtracted from the cover, so the two panels meet at a real joint, and a
  3.2 mm proud exposed-weave flange (`_aperture_flange`) rings the hole so the
  break is a STEP with a lit edge rather than a smooth continuation;
* six gill louvres per flank, chord and pitch on `spec.CHORD_RATIO` /
  `spec.GAP_RATIO`, each with a slot cut through into the cavity behind it;
* the hot-air exit at the gearbox: the cavity runs out of the back, and a
  rolled bead (radius `spec.TIP_ROLL_R`) wraps the aperture edge.
"""

from __future__ import annotations

import math
from functools import lru_cache

from cadgen import build123d as bd

from . import spec, surfaces

# ==========================================================================
# shared section machinery
# ==========================================================================


def _blend(table, x):
    """Smoothstep-blend a keyframe table (x descending) at station x."""
    if x >= table[0][0]:
        return table[0][1:]
    if x <= table[-1][0]:
        return table[-1][1:]
    for i in range(len(table) - 1):
        a, b = table[i], table[i + 1]
        if b[0] <= x <= a[0]:
            t = spec.smoothstep((a[0] - x) / (a[0] - b[0]))
            return tuple(spec.lerp(a[j], b[j], t) for j in range(1, len(a)))
    return table[-1][1:]


def _super_arc(hw, hh, n, a0, a1, count, cz=0.0):
    """Superellipse arc from a0 to a1 degrees, centred on (0, cz).

    a = 0 is the widest point (y = hw, z = cz); a = 90 is the crown.
    Every station samples the SAME angles, which is what keeps the lofted
    sections parameter-compatible and the skin glassy.
    """
    out = []
    for i in range(count):
        a = math.radians(spec.lerp(a0, a1, i / (count - 1)))
        ca, sa = math.cos(a), math.sin(a)
        out.append(
            (
                hw * math.copysign(abs(ca) ** (2.0 / n), ca),
                cz + hh * math.copysign(abs(sa) ** (2.0 / n), sa),
            )
        )
    return out


def _area(pts) -> float:
    n = len(pts)
    return 0.5 * sum(
        pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1]
        for i in range(n)
    )


def _shrink(pts, t):
    """Similarity shrink about the centroid — can never self-intersect."""
    cy = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    r = sum(math.hypot(p[0] - cy, p[1] - cz) for p in pts) / len(pts)
    k = max(0.05, 1.0 - t / max(r, 1e-6))
    return [(cy + (p[0] - cy) * k, cz + (p[1] - cz) * k) for p in pts]


def _offset(pts, t):
    """Offset a closed outline inward by t along its own normal.

    Negative t grows it outward. Falls back to a centroid shrink if the normal
    offset collapses the outline, so a thin section never ships a folded wall.
    """
    n = len(pts)
    w = 1.0 if _area(pts) > 0 else -1.0
    out = []
    for i in range(n):
        y, z = pts[i]
        ya, za = pts[(i - 1) % n]
        yb, zb = pts[(i + 1) % n]
        ty, tz = yb - ya, zb - za
        L = math.hypot(ty, tz) or 1.0
        out.append((y - tz / L * w * t, z + ty / L * w * t))
    a0, a1 = _area(pts), _area(out)
    if a1 * a0 <= 0.0 or abs(a1) < 0.12 * abs(a0):
        return _shrink(pts, t)
    return out


def _bounded(solid, outlines, xs, tol, what):
    """Assert a loft stayed inside the envelope of its own sections.

    A smooth loft can bulge far outside the stations it was built from and the
    result is still a "valid" solid — it just is not the shape that was drawn.
    """
    lo, hi = surfaces.bbox(solid)
    ys = [p[0] for o in outlines for p in o]
    zs = [p[1] for o in outlines for p in o]
    want = (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))
    for i in range(3):
        if lo[i] < want[0][i] - tol or hi[i] > want[1][i] + tol:
            raise ValueError(
                f"{what} loft escaped its sections on {'xyz'[i]}: "
                f"[{lo[i]:.0f},{hi[i]:.0f}] want "
                f"[{want[0][i]:.0f},{want[1][i]:.0f}]"
            )
    return solid


def _fuse(base, extras):
    out = base
    for e in extras:
        if e is None:
            continue
        try:
            cand = out + e
            if cand is not None and cand.is_valid and cand.volume > 0:
                out = cand
        except Exception:
            continue
    return out


def _disc_face(center, normal, r, samples=20):
    """A circular face centred on `center`, normal to `normal`."""
    plane = surfaces.plate_plane(center, normal)
    pts = [
        (r * math.cos(2 * math.pi * i / samples), r * math.sin(2 * math.pi * i / samples))
        for i in range(samples)
    ]
    return plane * bd.make_face(bd.Spline(*pts, periodic=True))


def _dzus(center, normal, r=10.5, sink=1.6, proud=3.0):
    """One Dzus quarter-turn fastener head, sunk into the flange it holds."""
    n = bd.Vector(normal).normalized()
    c = bd.Vector(center)
    return surfaces.loft_solid(
        [
            _disc_face(c - n * sink, n, r),
            _disc_face(c + n * proud, n, r * 0.88),
        ],
        ruled=True,
    )


# ==========================================================================
# 1. ENGINE COVER — the longest surface on the car
# ==========================================================================

COVER_X0 = -1700.0  # panel break against the cockpit / roll-hoop shoulder
COVER_X1 = -3450.0  # hot-air exit aperture over the gearbox
_SPINE_Z0 = 852.0
_SPINE_Z1 = 434.0

_N_STATIONS = 26  # outer skin stations (>= 14 required; 26 keeps it glassy)
_Q = 2.0  # deck fall exponent: flat under the spine, steep at the crease
_N_BOT = 2.35
_ND, _NS, _NB, _NR = 10, 4, 9, 4  # samples: deck, skirt, false bottom, ridge
_BOTTOM_DEPTH = 78.0
_VERTEX_E = 2.6  # how far a corner's tangent-control points sit from it
_APEX_E = 2.4

_JOIN_X = -2860.0  # aft of here the crease IS spec.SHOULDER_LINE


def spine_z(x: float) -> float:
    """Deck crown height at the foot of the ridge — one accelerating fall."""
    t = min(max((COVER_X0 - x) / (COVER_X0 - COVER_X1), 0.0), 1.0)
    return _SPINE_Z0 - (_SPINE_Z0 - _SPINE_Z1) * (0.45 * t + 0.55 * t**3)


#             x       y_cr    z_cr
_CREASE = (
    (-1700.0, 372.0, 620.0),  # sits on the tub deck, outboard of its knuckle
    (-1780.0, 379.0, 601.0),
    (-1860.0, 384.0, 578.0),
    (-1940.0, 387.0, 552.0),
    (-2020.0, 387.0, 520.0),  # tub ends: the line falls away behind it
    (-2100.0, 384.0, 480.0),
    (-2180.0, 379.0, 442.0),
    (-2260.0, 373.0, 419.0),
    (-2400.0, 356.0, 412.0),  # from here it runs just inboard of the sidepod
    (-2560.0, 334.0, 410.0),
    (-2740.0, 320.0, 411.0),  # sidepod trailing edge
    (_JOIN_X,) + tuple(spec.shoulder_at(_JOIN_X)),
)


def crease(x: float):
    """(y, z) of the pane
```

### Core Architecture Module: `models/f14d/render/ab.py`
```
#!/usr/bin/env python3
"""Compose a BLIND A/B sheet: our render against a reference photograph.

    python render/ab.py ours.png reference.jpg out.png [--seed N]

Writes ``out.png`` with the two images side by side, unlabeled except for A and
B, in RANDOM order, and writes ``out.key.json`` recording which is which.  The
critic is shown only the sheet; the key is for the caller.

Both images are converted to greyscale and matched in height.  Greyscale is not
cosmetic: a grey aircraft on a dark render stage against a colour photograph in
daylight is separable on colour and background alone, which would make the test
measure the backdrop instead of the aeroplane.  Removing colour and matching
scale pushes the judgement back toward silhouette, proportion, surface and
detail -- which is what is actually being judged.
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

H = 900
PAD = 28
BG = (26, 26, 28)


def prep(path):
    im = Image.open(path).convert("RGB")
    im = ImageOps.grayscale(im).convert("RGB")
    im = ImageOps.autocontrast(im, cutoff=1)
    w = max(1, int(im.width * H / im.height))
    return im.resize((w, H), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ours")
    ap.add_argument("reference")
    ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    a_is_ours = rng.random() < 0.5
    left, right = ((args.ours, args.reference) if a_is_ours
                   else (args.reference, args.ours))
    li, ri = prep(left), prep(right)

    sheet = Image.new("RGB", (li.width + ri.width + 3 * PAD, H + 2 * PAD + 34), BG)
    sheet.paste(li, (PAD, PAD))
    sheet.paste(ri, (2 * PAD + li.width, PAD))
    d = ImageDraw.Draw(sheet)
    d.text((PAD + li.width // 2 - 6, H + PAD + 8), "A", fill=(235, 235, 235))
    d.text((2 * PAD + li.width + ri.width // 2 - 6, H + PAD + 8), "B",
           fill=(235, 235, 235))
    out = Path(args.out)
    sheet.save(out)
    key = {"A": "ours" if a_is_ours else "reference",
           "B": "reference" if a_is_ours else "ours",
           "ours": args.ours, "reference": args.reference}
    out.with_suffix(".key.json").write_text(json.dumps(key, indent=2))
    print(out)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `models/f14d/render/gauntlet.py`
```
#!/usr/bin/env python3
"""Run the whole-aircraft gauntlet: render four views, compose four blind A/B sheets.

    python render/gauntlet.py <stem> --refs <dir-of-reference-photos> [--seed N]

Renders top / head / side / fq of the full assembly with the presentation theme,
pairs each against the matching reference photograph, and writes the sheets plus
their keys. The keys are for the caller only -- the critic sees the sheet.

The reference photographs are NOT in the repo (they are copyrighted press and
walkaround shots), so `--refs` is required and names a directory holding the
four `C_REF_*.jpg` crops. It used to be a hardcoded worktree scratchpad path,
which stopped existing the moment that worktree was removed.

Build the aircraft first: `python src/f14d.py`.
"""

from __future__ import annotations

import argparse
import glob
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
PY = sys.executable
TARGET = PROJECT / "STEP" / "f14d.step"

# The C_ crops are the reference photographs cut down to the AIRCRAFT.  Judging
# against the uncropped frames would compare a render stage to a flight deck and
# a boneyard, so the verdict would turn on the backdrop rather than the
# aeroplane.  All four show gear down and wings spread -- the model's own
# configuration -- so the comparison is like for like.
PAIRS = [("top", "C_REF_top.jpg"), ("head", "C_REF_head.jpg"),
         ("side", "C_REF_side.jpg"), ("fq", "C_REF_fq.jpg")]


def newest(pattern):
    hits = sorted(glob.glob(pattern))
    return hits[-1] if hits else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stem")
    ap.add_argument("--refs", required=True,
                    help="directory holding the C_REF_*.jpg reference crops")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    refs = Path(args.refs).expanduser().resolve()
    if not refs.is_dir():
        raise SystemExit(f"no reference directory at {refs}")
    if not TARGET.is_file():
        raise SystemExit(f"no {TARGET}; run `python src/f14d.py` first")

    out = PROJECT / "tmp" / "gauntlet"
    out.mkdir(parents=True, exist_ok=True)

    rc = subprocess.run(
        [PY, str(HERE / "shot.py"), str(TARGET), args.stem,
         "--views", ",".join(v for v, _ in PAIRS),
         "--size", "assembly-large", "--outdir", str(out)],
        cwd=str(PROJECT)).returncode
    if rc != 0:
        return rc

    for i, (view, ref) in enumerate(PAIRS):
        ours = newest(str(out / f"{args.stem}_{view}_*.png"))
        if not ours:
            print(f"MISSING render for {view}")
            continue
        sheet = out / f"AB_{args.stem}_{view}.png"
        subprocess.run([PY, str(HERE / "ab.py"), ours, str(refs / ref),
                        str(sheet), "--seed", str(args.seed + i)],
                       cwd=str(PROJECT))
    print("\nsheets:")
    for view, _ in PAIRS:
        print("  ", out / f"AB_{args.stem}_{view}.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `models/f14d/render/part.py`
```
#!/usr/bin/env python3
"""Build and render ONE part module, in the context of the airframe.

    python render/part.py nozzles --views rq,tail,side
    python render/part.py nozzles --solo            # the part on its own
    python render/part.py wings,empennage --views top

Writes a throwaway `@step` model under `tmp/review/<name>/` that composes only
the system MODELS asked for (`src/<name>.py`), so a builder can iterate without
waiting for the whole aeroplane: a current system loads from the store, only
the one being worked on rebuilds.  The
airframe skin is included by default because a part judged out of context is
judged wrong -- a perfect nozzle at the wrong scale relative to the nacelle
still fails.

The generated entry lives OUTSIDE `src/` on purpose: every `.py` directly under
`src/` is a real model of this project, and a scratch composition is not one.
That is also why it carries the one `sys.path.insert` in the project -- it has
to reach `src/` from `tmp/`, which the real models never have to do.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
SRC = PROJECT / "src"
PY = sys.executable

TEMPLATE = '''"""Auto-generated review entry -- do not edit; see render/part.py."""
import sys

sys.path.insert(0, {src!r})

from cadgen import build123d as bd, step

{imports}


@step(out="{name}.step", kind="assembly")
def {name}():
    # Each system is a sibling model of the project: current ones load from
    # the store, stale ones build -- a review composition costs only what
    # actually changed.
    return bd.Compound(children=[{calls}], label="review")


if __name__ == "__main__":
    {name}()
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mods", help="comma-separated part module names")
    ap.add_argument("--views", default="fq,top,side,rq")
    ap.add_argument("--size", default="assembly-large")
    ap.add_argument("--mode", default="solid")
    ap.add_argument("--solo", action="store_true",
                    help="omit the airframe skin context")
    ap.add_argument("--stem", default=None)
    args = ap.parse_args()

    mods = [m.strip() for m in args.mods.split(",") if m.strip()]
    name = "_".join(mods)
    full = mods if args.solo else (["airframe"] + [m for m in mods if m != "airframe"])

    d = PROJECT / "tmp" / "review" / name
    d.mkdir(parents=True, exist_ok=True)
    entry = d / f"{name}.py"
    imports = "\n".join(f"from {m} import {m}" for m in full)
    calls = ", ".join(f"{m}()" for m in full)
    entry.write_text(TEMPLATE.format(src=str(SRC), imports=imports, calls=calls, name=name))

    r = subprocess.run([PY, str(entry)],  # its __main__ builds the model
                       cwd=str(d), capture_output=True, text=True)
    sys.stderr.write(r.stderr)
    if r.returncode != 0:
        print(r.stdout)
        return r.returncode

    stem = args.stem or name
    # shot.py takes the BUILT DOCUMENT, never the script.
    return subprocess.run(
        [PY, str(HERE / "shot.py"), str(d / f"{name}.step"), stem,
         "--views", args.views, "--size", args.size, "--mode", args.mode,
         "--outdir", str(d)], cwd=str(PROJECT)).returncode


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `models/f14d/render/shot.py`
```
#!/usr/bin/env python3
"""Write and run a JSON render job for the F-14D.

Always JSON jobs, never shortcut flags -- the shortcut flags cannot express the
theme file plus display mode plus size profile combination the critic
comparisons need, and they silently ignore unknown keys.

    python render/shot.py STEP/f14d.step <stem> --views fq,top,side,head --size assembly-large

The target is a BUILT DOCUMENT (`STEP/f14d.step`), not a model script -- the
snapshot door refuses a `.py`.  Build first: `python src/f14d.py`.

Views are named for the four gauntlet angles plus a few build-time helpers.
Camera directions are given as explicit vectors so a view means the same thing
every time, whatever the model's bounding box does.

Output lands in `tmp/` (gitignored scratch), never beside the code.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
PY = sys.executable
THEME = HERE / "presentation_theme.json"
DISPLAY = HERE / "presentation_display.json"

# +X aft, +Y port, +Z up.  A camera "direction" points FROM the model TOWARD
# the camera.
# Framing is by BOUNDING SPHERE, and `render.padding` is clamped to a 0.1
# minimum, so a long thin fuselage is framed by its diagonal and ends up small
# in frame however tight the padding.  Per-view `zoom` is the only lever that
# actually crops in; the values below fill the frame for a 19.5 m span aircraft.
#
# STALE, MEASURED 2026-08-31, LEFT AS IS.  These values no longer fill the
# frame: at `side`/1.45 the aircraft covers about half the image width, and a
# re-probe put the fill point near 2.70 (3.0 clips nose and tail).  The drift is
# in the snapshot engine's bounding-sphere fit, not in the model.  Do NOT
# "correct" this by scaling the table uniformly -- that was tried and it
# overshoots: at the side-derived 1.86x factor `top` (which runs the 19.2 m
# length down the SHORT axis of a 4:3 frame) clips nose and tail.  Every view
# has to be re-probed against the built jet on its own, one snapshot each.
VIEWS = {
    # --- the four whole-aircraft gauntlet views -------------------------
    "top":   {"direction": [0, 0, 1], "up": [-1, 0, 0], "zoom": 1.30},
    "head":  {"direction": [-1, 0, 0.07], "up": [0, 0, 1], "zoom": 1.55},
    "side":  {"direction": [0, -1, 0], "up": [0, 0, 1], "zoom": 1.45},
    "fq":    {"direction": [-1, -0.62, 0.20], "up": [0, 0, 1], "zoom": 1.35},
    # --- build helpers --------------------------------------------------
    "rq":    {"direction": [0.95, -0.60, 0.30], "up": [0, 0, 1], "zoom": 1.35},
    "belly": {"direction": [0, 0, -1], "up": [1, 0, 0], "zoom": 1.30},
    "tail":  {"direction": [1, 0, 0.10], "up": [0, 0, 1], "zoom": 1.55},
    "hi34":  {"direction": [-0.85, -0.55, 0.62], "up": [0, 0, 1], "zoom": 1.30},
    "topfwd": {"direction": [-0.35, 0, 0.94], "up": [-1, 0, 0], "zoom": 1.30},
}

# Framing a TEARDOWN is not the same problem as framing the built jet, and the
# CLI cannot drive one -- the staged separation lives in `ANIMATION_JS` in `src/f14d.py` and
# plays in the CAD Viewer's Animation tab (clips: `teardown`, `explodedHold`).
# Kept here because the camera knowledge outlived the retired render/explode.py
# that carried it: the separation is mostly on Z (skin up, gear and inlets
# down) with the nozzles drawing aft, so a camera well above the waterline and
# off the bow sees the vertical stack without the wings hiding what drops out
# from under them, while a level side view collapses the explode into one line.
# The teardown roughly doubles the bounding sphere (skin +5.2 m up, gear -2.3 m
# down, nozzles +4.4 m aft), and framing is by bounding sphere, so the built-jet
# zooms above throw the skin out of frame before it stops travelling. Use
# hi34 / fq / side pulled WIDER: the retired script's teardown zooms sat at
# roughly 0.8x of what filled the frame with the assembled aircraft under the
# same padding.  That is a RATIO, not a value -- see the staleness note above.


def build_job(target, outdir, stem, views, size, mode, focus=None, hide=None,
              theme=None, stamp=True):
    outs = []
    for v in views:
        cam = VIEWS.get(v)
        if cam is None:
            raise SystemExit(f"unknown view {v!r}; known: {', '.join(VIEWS)}")
        outs.append({"path": str(Path(outdir) / f"{stem}_{v}.png"), "camera": dict(cam)})
    # Edge styling lives in DISPLAY, not in the theme.  Passing an "edges" key
    # inside a theme JSON is rejected outright -- and the repo's own example
    # presentation theme (models/hypercar/render/presentation_theme.json)
    # still carries one, so copying it as a starting point fails.
    display = json.loads(DISPLAY.read_text())
    display.pop("_comment", None)
    display["mode"] = mode
    job = {
        "input": str(target),
        "mode": "view",
        "outputs": outs,
        "theme": str(theme or THEME),
        "display": display,
        "render": {"sizeProfile": size, "padding": 0.06, "viewLabels": False},
    }
    if focus or hide:
        selection = {}
        if focus:
            selection["focus"] = focus
        if hide:
            selection["hide"] = hide
        job["selection"] = selection
    return job


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("stem")
    ap.add_argument("--views", default="fq,top,side,head")
    ap.add_argument("--size", default="assembly-large")
    ap.add_argument("--mode", default="solid")
    ap.add_argument("--outdir", default=None)
    ap.add_argument("--focus", default=None)
    ap.add_argument("--hide", default=None)
    ap.add_argument("--theme", default=None)
    args = ap.parse_args()

    outdir = Path(args.outdir) if args.outdir else (PROJECT / "tmp")
    outdir.mkdir(parents=True, exist_ok=True)
    job = build_job(args.target, outdir, args.stem, args.views.split(","),
                    args.size, args.mode,
                    focus=args.focus.split(",") if args.focus else None,
                    hide=args.hide.split(",") if args.hide else None,
                    theme=args.theme)
    jobfile = outdir / f"{args.stem}_job.json"
    jobfile.write_text(json.dumps(job, indent=2))
    r = subprocess.run([PY, "-m", "cadgen.cli", "step", "snapshot",
                        "--job", str(jobfile)],
                       cwd=str(PROJECT), capture_output=True, text=True)
    sys.stderr.write(r.stderr)
    print(r.stdout.strip())
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `models/f14d/render/subrefs.py`
```
#!/usr/bin/env python3
"""Emit the act-2 SUBS ref lists for ``ANIMATION_JS`` in ``src/f14d.py``.

The second act of the teardown separates parts INSIDE the wings and the aft
section, and those are addressed by leaf occurrence id -- the animation handle
takes a label or an occurrence list ("o1.3.1.21,o1.3.1.22,..."), and there is
no name pattern that says "every slat track on both wings". Hand-maintaining
~100 ids is not viable, so they are generated from assembly.json by name
pattern and pasted into the SUBS table.

REGENERATE AFTER ANY REBUILD THAT CHANGES LEAF COUNTS:

    python render/subrefs.py > tmp/subrefs.txt   # then update SUBS in src/f14d.py

Anything mirrored port/stbd is split into two groups, because one ref moves
every occurrence it matches by the SAME vector -- a single "wingtips" group
would push the port tip outboard and the starboard tip straight through the
wing.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
STEP = PROJECT / "STEP" / "f14d.step"


def _assembly_json() -> Path:
    """The built package's descriptor.

    Render packages are content-keyed under the user cache now, so the path is
    asked for rather than guessed at (it used to be hardcoded at a
    ``__cadgen__/`` directory beside the model, which no longer exists).
    """
    from cadgen.catalog import render_package_dir

    return Path(render_package_dir(STEP)) / "assembly.json"

# group name -> (parent occurrence prefix, name patterns, side filter or None)
GROUPS = [
    ("slats", "o1.3", (r"wing_slat", r"slat_track", r"slat_actuator_fairing"), None),
    ("flaps", "o1.3", (r"wing_flap", r"flap_track_fairing"), None),
    ("spoilers", "o1.3", (r"wing_spoiler",), None),
    ("tip_port", "o1.3", (r"wingtip_",), "port"),
    ("tip_stbd", "o1.3", (r"wingtip_",), "stbd"),
    ("sb_dorsal", "o1.7", (r"speedbrake_dorsal",), None),
    ("sb_ventral_port", "o1.7", (r"speedbrake_ventral_port",), None),
    ("sb_ventral_stbd", "o1.7", (r"speedbrake_ventral_stbd",), None),
    ("beavertail", "o1.7", (r"beavertail",), None),
    ("tailhook", "o1.7", (r"tailhook",), None),
]


def main() -> int:
    assembly = _assembly_json()
    if not assembly.is_file():
        raise SystemExit(f"no built package for {STEP.name}; run `python src/f14d.py` first")
    occurrences = json.loads(assembly.read_text())["occurrences"]
    print("// ref values for the SUBS table in src/f14d.py")
    for name, prefix, patterns, side in GROUPS:
        ids = [
            o["id"]
            for o in occurrences
            if o["id"].startswith(prefix + ".")
            and any(re.match(p, o["name"]) for p in patterns)
            and (side is None or f":{side}" in o["name"])
        ]
        if not ids:
            raise SystemExit(f"no occurrences matched {name}")
        print(f'{name}: ref: "{",".join(ids)}"   // {len(ids)} occurrences')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `models/motorbike/src/engine.py`
```
"""Engine entry: unit powertrain (swingarm engine + CVT + covers), bike frame."""

from __future__ import annotations

from cadgen import build123d as bd
from cadgen import step

from lib import drivetrain as B


@step(out="../STEP/engine.step")
def engine():
    built = B.build_engine()
    if isinstance(built, list):
        return bd.Compound(children=built, label="engine")
    return built


if __name__ == "__main__":
    engine()

```

### Core Architecture Module: `models/radial/tools/engine.py`
```
#!/usr/bin/env python3
"""Serialised engine builds and renders (many builders share one assembly).

  tools/engine.py build            rebuild STEP/radial.step (forces when the set of ready systems changed)
  tools/engine.py system NAME      build one system model (its own lock only: systems build in parallel)
  tools/engine.py render JOB.json  snapshot job(s) against STEP/radial.step, under the same lock
  tools/engine.py build-render JOB.json   both, holding the lock throughout

build / build-render first bring every ready system current OUTSIDE the shared lock, one at
a time (a current system returns in ~1 s; a per-system lock stops two builders rebuilding
the same one), and stop at the first system that fails, naming it. The shared lock is then
held only for the assembly (~1-2 min) and the render, not for a 25 min heads rebuild.

Run from anywhere; paths in JOB files are relative to models/radial.
The lock is tmp/engine.lock (fcntl). Waits are printed so a builder knows why it paused.
"""

from __future__ import annotations

import fcntl
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable                                  # run with the project interpreter
CADGEN = shutil.which("cadgen") or str(Path(sys.executable).with_name("cadgen"))
LOCK = ROOT / "tmp" / "engine.lock"
READY_STAMP = ROOT / "tmp" / "ready_systems.json"


class Lock:
    def __enter__(self):
        LOCK.parent.mkdir(exist_ok=True)
        self.f = open(LOCK, "w")
        t0 = time.time()
        try:
            fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("[engine] waiting for another builder's assembly build/render ...", flush=True)
            fcntl.flock(self.f, fcntl.LOCK_EX)
            print(f"[engine] lock acquired after {time.time() - t0:.0f}s", flush=True)
        return self

    def __exit__(self, *exc):
        fcntl.flock(self.f, fcntl.LOCK_UN)
        self.f.close()


def _run(cmd):
    print("[engine] $", " ".join(cmd), flush=True)
    t0 = time.time()
    r = subprocess.run(cmd, cwd=ROOT)
    print(f"[engine] exit {r.returncode} in {time.time() - t0:.0f}s", flush=True)
    return r.returncode


def _ready():
    sys.path.insert(0, str(ROOT / "src"))
    from lib.systems import ready
    return ready()


def build_system(name, extra=()):
    """One system build under its own lock (never two builds of one system at once)."""
    locks = ROOT / "tmp" / "locks"
    locks.mkdir(parents=True, exist_ok=True)
    with open(locks / f"{name}.lock", "w") as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(f"[engine] waiting for another builder's {name} build ...", flush=True)
            fcntl.flock(f, fcntl.LOCK_EX)
        return _run([PY, f"src/{name}.py", *extra])


def prebuild():
    """Bring every ready system current before the assembly takes the shared lock."""
    for name in _ready():
        rc = build_system(name)
        if rc:
            print(f"[engine] system {name} FAILED to build: fix src/lib/{name}.py (or wait for "
                  f"its builder) before the assembly can build", flush=True)
            return rc
    return 0


def build():
    sys.path.insert(0, str(ROOT / "src"))
    from lib.systems import ready
    now = ready()
    before = json.loads(READY_STAMP.read_text()) if READY_STAMP.exists() else None
    cmd = [PY, "src/radial.py"] + (["--force"] if now != before else [])
    rc = _run(cmd)
    if rc == 0:
        READY_STAMP.write_text(json.dumps(now))
    return rc


def render(job):
    """A job whose "render" is the string "presentation" gets render/presentation.json
    (the presentation theme) substituted, so every critic render uses one envelope."""
    path = Path(job).resolve()
    data = json.loads(path.read_text())
    envelope = json.loads((ROOT / "render" / "presentation.json").read_text())
    jobs = data["jobs"] if isinstance(data, dict) and "jobs" in data else (data if isinstance(data, list) else [data])
    for j in jobs:
        if j.get("render") == "presentation":
            j["render"] = envelope
        j.setdefault("input", "STEP/radial.step")
    resolved = ROOT / "tmp" / "jobs" / path.name
    resolved.parent.mkdir(parents=True, exist_ok=True)
    resolved.write_text(json.dumps({"jobs": jobs}, indent=1))
    return _run([CADGEN, "step", "snapshot", "--job", str(resolved)])


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    cmd = argv[0]
    if cmd == "system":
        return build_system(argv[1], argv[2:])
    if cmd in ("build", "build-render"):
        rc = prebuild()
        if rc:
            return rc
    with Lock():
        if cmd == "build":
            return build()
        if cmd == "render":
            return render(argv[1])
        if cmd == "build-render":
            rc = build()
            return rc if rc else render(argv[1])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

```

### Core Architecture Module: `models/tendon_hand/validation/check_repaired_core_interference.py`
```
"""Recheck the complete repaired rigid core while final palm/housing additions build."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from check_full_route_bodies import integration_hardware
from check_assembly_interference import audit
from lib.palm_frame import make_palm_frame_bodies
root=Path(__file__).parent
bodies,evidence=integration_hardware()
exclude={p.label for p in make_palm_frame_bodies()}|{'fifth_metacarpal_cupping_truss'}
core=[b for b in bodies if b.name not in exclude]
print('CURRENT RIGID CORE',len(core),'deferredpalm',len(exclude),flush=True)
out=root/'repaired_core_interference.json';result=audit(core,out);result['deferred_palm_labels']=sorted(exclude);result['input_sha256']=evidence;result['scope']='Every current rigid body except the explicitly deferred main and cupping palm frames; not final assembly acceptance.';out.write_text(json.dumps(result,indent=2)+'\n')
if not result['pass']:raise SystemExit(1)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #405** (2026-09-17): **Metadata capture never certifies a read a coarse write clock cannot date**
  *Symptoms*: `test_missing_or_corrupt_unrequested_geometry_is_rejected_every_time` failed its SAME-SIZE corruption subtest on Windows CI ([run 35131269027](https://github.com/earthtojake/text-to-cad/actions/runs/35131269027)) and passes on Linux and macOS. It is a real read-path gap in the store, not a test artefact.  ## The gap  `capture_tree(hash, retain_payloads=False)` is the one closure gate behind `request_view`, `surfaces.derive`, the surface manager's `resolve` and `pinned_surface_object`: it reads and verifies every tree and every `.brep` in the closure, including components the request does not touch. To keep a viewer poll from re-hashing the whole document, it caches the flattened descriptor and revalidates it by fingerprinting each required object as `(digest, st_dev, st_ino, st_size, st_mtime_ns, st_ctime_ns)` on both sides of its verified read.  That fingerprint only reports damage when a later write could not reproduce it. On Windows it can:  - `st_ctime` is the file's **creation** time, so it does not move for a rewrite   at all. On Linux and macOS it is the inode-change time and always moves, which   is the only reason the test passes there. - the last-write time is stamped from the ~15.6 ms system timer, so a rewrite in   the tick the verified read observed keeps `st_mtime_ns`.  An in-place, same-size rewrite therefore leaves dev, inode, size, mtime and ctime identical, the cache hits, and all five entry points return a descriptor for a closure whose bytes no longer hash

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `81ea1361` (2026-10-05)
**Commit Message**: Fix STEP imports that Windows refuses to read (#529) (#531)

For #529. Opening a STEP on Windows failed with `[Errno 13] Permission
denied`, and the error stayed until the CAD app restarted.

When the CAD app or the Viewer opens a STEP that cadgen did not build,
it imports it as a compile job. Windows' `open()` refuses a read with
`[Errno 13]` while another program holds the file or is replacing it: a
build saving it, a sync client, an antivirus scan.

## What was wrong

- **No retry.** The import read the document with plain reads: the hash
in `submit_compile`, and the scene loads in `step_scene_package.py`.
Every other cadgen STEP read on Windows goes through the bounded retry
for a held file (`read_bytes_with_ladder`); these did not.
- **The failure stuck.** The Viewer remembers a failed compile against
the document's mtime and size, so it does not recompile a broken file in
a loop, and the client treats `failed` as final. A refused read was
remembered the same way, so the card stayed until the file changed or
the app restarted. Reproduced on `main`: after the file became readable
again, the status stayed `failed`.
- **Wrong advice.** The card said "Correct or rebuild the source

**File**: `packages/cadgen/src/cadgen/_internal/step_scene_package.py` (modified, +7/-4)
```diff
@@ -24,6 +24,7 @@
 from pathlib import Path
 from typing import Any
 
+from cadgen._internal.atomic_replace import read_bytes_with_ladder
 from cadgen._internal.step_scene_loader import (
     _location_from_transform_matrix,
     _shape_hash,
@@ -156,7 +157,7 @@ def _lookup_document_readback(step_path: Path, *, step_hash: str, lazy: bool = F
         # A valid eager-only component promises display, not a native codec.
         # Saved-document readers still have its exact bytes and may parse them.
         # This is neither a corrupt closure nor permission to use a source tree.
-        payload = step_path.read_bytes()
+        payload = read_bytes_with_ladder(step_path)
         if hashlib.sha256(payload).hexdigest() != step_hash:
             return None, False
         readback = _DocumentReadback(_scene_from_selected_bytes(step_path, payload))
@@ -328,7 +329,9 @@ def load_step_scene_exact(step_path: Path) -> LoadedStepScene:
     resolved_step_path = step_path.expanduser().resolve()
     if not resolved_step_path.is_file():
         raise FileNotFoundError(f"STEP file does not exist: {resolved_step_path}")
-    payload = resolved_step_path.read_bytes()
+    # On Windows a program saving, replacing or scanning the document refuses this read for a
+    # moment (`[Errno 13]`): the ladder waits that out, as it does for every STEP cadgen reopens.
+    payload = read_bytes_with_ladder(resolved_step_path)
     return _scene_from_selected_bytes(resolved_step_path, payload)
 
 
@@ -374,7 +377,7 @@ def load_step_scene_cached(step_path: Path, *, lazy: bool = False) -> LoadedStep
     # these reads, its tree has a different digest and this loop selects again.
     attempts_by_hash: dict[str, int] = {}
     while True:
-        payload = resolved_step_path.read_bytes()
+        payload = read_bytes_with_ladder(resolved_step_path)
         step_hash = hashlib.sha256(payload).hexdigest()
         from_package, damaged_document = lookup_document_scene(resolved_step_path, step_hash=step_hash, lazy=lazy)
         if from_package is not None:
@@ -408,7 +411,7 @@ def load_step_scene_cached(step_path: Path, *, lazy: bool = False) -> LoadedStep
         # A replacement raced the submit: the worker correctly published the
         # bytes it snapshotted. A concurrent deletion of derived geometry can
         # also race publication; retry boundedly while these bytes stay current.
-        current_hash = hashlib.sha256(resolved_step_path.read_bytes()).hexdigest()
+        current_hash = hashlib.sha256(read_bytes_with_ladder(resolved_step_path)).hexdigest()
         attempts_by_hash[step_hash] = attempts_by_hash.get(step_hash, 0) + 1
         if current_hash == step_hash and attempts_by_hash[step_hash] >= 3:
             raise RuntimeError(
```

**File**: `packages/cadgen/src/cadgen/daemon/executors.py` (modified, +4/-1)
```diff
@@ -319,11 +319,14 @@ def submit_compile(
     transient subprocess, never in the caller."""
     import hashlib
 
+    from cadgen._internal.atomic_replace import read_bytes_with_ladder
     from cadgen.store.paths import store_root as default_store_root
 
     document = Path(document).resolve()
     root = Path(store_root) if store_root is not None else default_store_root()
-    closure = hashlib.sha256(document.read_bytes()).hexdigest()
+    # Through the ladder: on Windows, a program saving, replacing or scanning the document
+    # refuses the read for a moment, and that is not a failure of its bytes.
+    closure = hashlib.sha256(read_bytes_with_ladder(document)).hexdigest()
     job = Job(document)
     emit_event(model_event(document, "submitted", parent=str(parent) if parent else None))
     tool_argv = [str(document)] + (["--force"] if force else [])
```

**File**: `packages/cadgen/src/cadgen/viewer/compiles.py` (modified, +39/-10)
```diff
@@ -19,18 +19,29 @@
 relays requests through a few shared slots would lose one for that long). The
 client follows the job through the status route, as it follows a peer's, and a
 compile that failed is remembered against the document's bytes so the status
-route can say so rather than offer the same compile again.
+route can say so rather than offer the same compile again. A document that
+refused to be READ (an ``OSError``: on Windows, another program holding or
+replacing it) is remembered only long enough for that report
+(:data:`READ_REFUSAL_REPORT_SECONDS`): nothing about its bytes is known, and the
+next open or reload compiles it again.
 """
 
 from __future__ import annotations
 
+import builtins
 import os
 import threading
+import time
 from pathlib import Path
 
 from .store_paths import build_scope
 
-__all__ = ["DocumentCompiler"]
+__all__ = ["DocumentCompiler", "READ_REFUSAL_REPORT_SECONDS"]
+
+# How long the status route reports a compile that failed because the document could not be
+# read: past any status read the requests following the compile make (the client gives one
+# 10 s), short of a person's next reload.
+READ_REFUSAL_REPORT_SECONDS = 10.0
 
 class _Compile:
     """One in-flight compile that other requests may attach to."""
@@ -59,6 +70,14 @@ def _failure(output: str, document: str) -> dict:
     return answer
 
 
+def _read_refusal(result: dict) -> bool:
+    """Whether a failed compile is the document refusing to be read -- an ``OSError``
+    (``PermissionError`` on Windows for a held or replaced file) -- rather than its
+    bytes failing to compile."""
+    error_class = getattr(builtins, str(result.get("errorType") or ""), None)
+    return isinstance(error_class, type) and issubclass(error_class, OSError)
+
+
 def _signature(candidate: str) -> tuple[int, int] | None:
     try:
         stat = os.stat(candidate)
@@ -76,14 +95,16 @@ def _submit(document: Path, *, force: bool):
 class DocumentCompiler:
     """Compile documents through the pool; one job per document at a time."""
 
-    def __init__(self, *, submit=None) -> None:
+    def __init__(self, *, submit=None, clock=time.monotonic) -> None:
         # `submit(document, force=) -> Job` (wait() -> exit code, output() -> text).
-        # Injected by tests; the real one is the pool's submit_compile.
+        # Injected by tests; the real one is the pool's submit_compile. So is the clock.
         self._submit = submit or _submit
+        self._clock = clock
         self._lock = threading.Lock()
         self._in_flight: dict[str, _Compile] = {}
-        # The last failed compile of a document, with the bytes it failed on (mtime, size).
-        self._failed: dict[str, tuple[tuple[int, int] | None, dict]] = {}
+        # The last failed compile of a document: the bytes it failed on (mtime, size), the
+        # answer, and when it failed.
+        self._failed: dict[str, tuple[tuple[int, int] | None, dict, float]] = {}
 
     def compile(self, candidate: str, *, force: bool = False) -> dict:
         """Compile one document, attaching to an in-flight compile for the same one.
@@ -153,17 +174,25 @@ def _finish(self, candidate: str, force: bool, build_key: str, entry: _Compile,
                 if result is not None and result.get("ok"):
                     self._failed.pop(build_key, None)
                 elif result is not None:
-                    self._failed[build_key] = (signature, result)
+                    self._failed[build_key] = (signature, result, self._clock())
             entry.result = result
             entry.done.set()
 
     def failure(self, candidate: str) -> dict | None:
-        """The last compile's failure, while the document still has the bytes it failed on."""
+        """The last compile's failure, while the document still has the bytes it failed on;
+        a refusal to read it, only for :data:`READ_REFUSAL_REPORT_SECONDS`."""
+        build_key = build_scope(candidate)
         with self._lock:
-            recorded = self._failed.get(build_scope(candidate))
+            recorded = self._failed.get(build_key)
         if recorded is None or recorded[0] != _signature(candidate):
             return None
-        return recorded[1]
+        _, result, failed_at = recorded
+        if _read_refusal(result) and self._clock() - failed_at > READ_REFUSAL_REPORT_SECONDS:
+            with self._lock:
+                if self._failed.get(build_key) is recorded:
+                    del self._failed[build_key]
+            return None
+        return result
 
     def in_flight(self, build_key: str) -> bool:
         with self._lock:
```

**File**: `packages/ui/src/renderers/kit/status/loadAlerts.js` (modified, +9/-0)
```diff
@@ -47,6 +47,15 @@ export function failureAlert(fileRef, error, failure, compile = false) {
     recovery: "Reload to try again. If this continues, check the viewer’s terminal output for the request shown in Details.",
     reload: true
   };
+  // The file refused to be read, so nothing is known about its contents: on Windows,
+  // another program holding it, or saving or replacing it, arrives as a PermissionError.
+  if (failure?.errorType === "PermissionError") return {
+    ...common, summary: "File unreadable", title: "Couldn’t read the model",
+    message: `“${fileRef}” could not be read.`,
+    reason: detail,
+    recovery: "Another program may have it open, or be saving, syncing or scanning it. Close it there or let that finish, then retry. If this continues, check that the folder can be read.",
+    reload: true
+  };
   return {
     ...common, summary: compile || kind === "compile" ? "Compile failed" : "Mesh load failed",
     title: compile || kind === "compile" ? "Couldn’t prepare the model" : "Couldn’t load the model",
```

**File**: `packages/ui/src/renderers/step/components/workbench/hooks/useArtifact.js` (modified, +6/-1)
```diff
@@ -250,7 +250,12 @@ export function useArtifact(fileRef, { enabled = true, freshnessKey = "", shown
         if (action === ARTIFACT_ACTION_ERROR) {
           finished = true;
           stopPolling();
-          settle({ status: "failed", error: serverErrorMessage(status) });
+          // The exception class rides along (`errorType`): a file that refused to be read
+          // gets different advice from one whose contents failed to compile.
+          settle({
+            status: "failed", error: serverErrorMessage(status),
+            ...(status?.errorType ? { failure: { kind: "compile", errorType: String(status.errorType) } } : {})
+          });
           return;
         }
         if (action === ARTIFACT_ACTION_ATTACH) {
```

**File**: `packages/ui/src/renderers/step/components/workbench/hooks/useArtifact.test.tsx` (modified, +16/-2)
```diff
@@ -12,7 +12,7 @@ afterEach(() => { cleanup(); vi.useRealTimers(); });
 // A viewer server for one STEP: its catalog (the file and whatever is beside it) and its
 // artifact status, which a build somebody else started holds at `compiling`.
 function workspace({ tree = 'tree-1' } = {}) {
-  const server = { tree, siblings: [] as string[], state: 'compiling', artifactReads: 0, catalogReads: 0, compiles: 0,
+  const server = { tree, siblings: [] as string[], state: 'compiling', error: '', errorType: '', artifactReads: 0, catalogReads: 0, compiles: 0,
     gate: null as { after: number, held: Promise<void> } | null,
     // Hold every catalog read after the first `after` of them until the answer is released.
     holdCatalog(after: number) {
@@ -38,7 +38,8 @@ function workspace({ tree = 'tree-1' } = {}) {
       body = { ok: true, state: 'compiling', runId: 'own-run' };
     } else if (pathname === '/__cad/artifact') {
       server.artifactReads += 1;
-      body = { ok: true, state: server.state, runId: 'peer-run' };
+      body = { ok: true, state: server.state, runId: 'peer-run',
+        ...(server.error ? { error: server.error, errorType: server.errorType } : {}) };
     } else throw new Error(`unexpected ${pathname}`);
     return { ok: true, status: 200, headers: new Headers(), json: async () => body };
   };
@@ -158,3 +159,16 @@ it('reports a build\'s end as compiled only once the catalog lists the tree it w
   expect(entryHasMesh(result.current.entry)).toBe(true);
   client.dispose();
 });
+
+it('hands on why a compile failed, so a file that refused to be read is told apart (#529)', async () => {
+  const { server, client } = workspace({ tree: '' });
+  server.state = 'failed';
+  server.error = "[Errno 13] Permission denied: 'car.step'";
+  server.errorType = 'PermissionError';
+  const { result } = renderHook(() => useStepArtifact(client));
+  await elapse(10);
+  expect(result.current.status).toBe('failed');
+  expect(result.current.error).toBe(server.error);
+  expect(result.current.failure).toEqual({ kind: 'compile', errorType: 'PermissionError' });
+  client.dispose();
+});
```

**File**: `packages/ui/src/renderers/step/workbench/viewerAlerts.test.js` (modified, +13/-0)
```diff
@@ -50,6 +50,19 @@ test("compile failure preserves the full diagnostic, context and useful recovery
   assert.match(alert.recovery, /rebuild/);
 });
 
+test("a file another program holds is said to be unreadable, not broken (#529)", () => {
+  const reason = "[Errno 13] Permission denied: 'C:\\Users\\ada\\STEP\\moonwatch.step'";
+  const alert = buildViewerMeshAlert(step, false, "", {
+    status: "failed", error: reason, failure: { kind: "compile", errorType: "PermissionError" }
+  });
+  assert.equal(alert.title, "Couldn’t read the model");
+  assert.match(alert.message, /moonwatch\.step.*could not be read/);
+  assert.equal(alert.reason, reason);
+  assert.match(alert.recovery, /Another program may have it open/);
+  assert.doesNotMatch(alert.recovery, /rebuild/);
+  assert.equal(alert.reload, true);
+});
+
 test("missing compiler diagnostic is stated honestly", () => {
   const alert = buildViewerMeshAlert(step, false, "", { status: "failed", error: "" });
   assert.match(alert.reason, /No diagnostic was returned/);
```

**File**: `tests/python/packages/cadgen/test_atomic_replace.py` (modified, +20/-5)
```diff
@@ -435,14 +435,29 @@ def test_every_step_writer_reopen_goes_through_the_ladder(self) -> None:
         """The rule the atomic_replace docstring states: harden one and the
         failure moves to the next. Pins that no reopen of the written STEP was
         left on a bare open()."""
-        import re as _re
-
         for relative in ("cadgen/step_export.py", "cadgen/_internal/step_hash.py"):
-            source = (REPO_ROOT / "packages" / "cadgen" / "src" / relative).read_text(encoding="utf-8")
-            body = source.split('"""', 2)[-1] if source.count('"""') >= 2 else source
-            bare = _re.findall(r"^(?!.*ladder).*\b(?:read_bytes\(\)|write_bytes\(|\.open\(\s*[\"']r)", body, _re.M)
+            bare = _bare_reads(relative)
             self.assertEqual([], bare, f"{relative} reopens its output without the ladder: {bare}")
 
+    def test_every_read_of_an_imported_document_goes_through_the_ladder(self) -> None:
+        """#529: importing a STEP on Windows failed with "[Errno 13] Permission
+        denied" while another program held or replaced it -- the refusal the
+        ladder waits out for cadgen's own STEPs. Pins that the import's reads of
+        the document (the closure hash before the job, the scene loads in it)
+        are not left on a bare read."""
+        for relative in ("cadgen/_internal/step_scene_package.py", "cadgen/daemon/executors.py"):
+            bare = _bare_reads(relative)
+            self.assertEqual([], bare, f"{relative} reads a document without the ladder: {bare}")
+
+
+def _bare_reads(relative: str) -> list[str]:
+    """Reads and reopens in a cadgen module that are not on a ladder line."""
+    import re as _re
+
+    source = (REPO_ROOT / "packages" / "cadgen" / "src" / relative).read_text(encoding="utf-8")
+    body = source.split('"""', 2)[-1] if source.count('"""') >= 2 else source
+    return _re.findall(r"^(?!.*ladder).*\b(?:read_bytes\(\)|write_bytes\(|\.open\(\s*[\"']r)", body, _re.M)
+
 
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 2: `ccce06e3` (2026-10-05)
**Commit Message**: Fixes from #499's end-to-end: worker starts under load, -P on every cadgen process, failed-import status, endless loading, animation exports (#528)

The bugs #499's final end-to-end run found on `main`, and what investigating them turned up, in five commits on 0.7.12. Each commit has a test that fails on `main`, checked against `main`'s sources.

**Rebased onto 0.7.12 (#521).** The symlinked-folder fix this PR first carried is dropped. #521's views by absolute path removed the root check that refused those models: recents now take an absolute path. Its catalog warm-up already matches the ledger's real path to the watched file, as that fix did. The other five still apply on 0.7.12.

## Workers that never started on a busy machine (3153fcc2c, dfd6cc69f)

**Symptom.** Two cold builds at once (w16 and f1), or one cold f1 on a loaded machine, failed with `worker did not announce itself within 120s`.

**Cause.** Workers start as `python -m cadgen.daemon.worker` in the system temp folder, and `python -m` puts that folder first on the import path.
- Every import that missed it, and every package-metadata lookup, listed the folder again whenever it had changed.
- On the test machine that fo

**File**: `packages/cadgen/STORE.md` (modified, +19/-5)
```diff
@@ -1094,10 +1094,11 @@ are not cancelled merely because a newer editing request exists.
   moved into place, the record cross-validates the outputs by sha (gate
   clause 5), and the publish rule decides same-model outcomes. Progress is
   not on disk at all: the daemon keeps a ledger of every job it runs (state,
-  phase n/total, the job's declared output paths) and serves it with `daemon
-  status`; the CAD Viewer matches jobs to the documents it shows by output
-  path — a CLI build, a parent's child build and its own compile read alike —
-  and nothing reads any of it to decide freshness. With `CADGEN_DAEMON=0`
+  phase n/total, the job's declared output paths — for a script that no longer
+  imports, what it declared the last time this daemon could read it) and
+  serves it with `daemon status`; the CAD Viewer matches jobs to the
+  documents it shows by output path — a CLI build, a parent's child build and
+  its own compile read alike — and nothing reads any of it to decide freshness. With `CADGEN_DAEMON=0`
   there is no ledger, and concurrent builds are unbrokered
   — safe by the two invariants above, wasteful, and a debugging mode.
 
@@ -1261,6 +1262,14 @@ Every build goes through one interface, `cadgen.daemon.executors.submit(model)
   binds a spare and a replacement starts in the background; no spare means a
   spawn. Spares load build123d/OCP as well as the lazy tool parsers before
   announcing readiness; importing the supervisor never loads the kernel.
+  A worker starts in the system temp folder but keeps it off its import path
+  (`python -P`, as every process cadgen starts does: the daemon, the store's
+  gc, a transient build, the Viewer), so a build imports exactly what
+  `python script.py` would (law 7), nothing another program or user left in
+  that folder stands in for cadgen, and no import lists it. Other programs fill it and keep
+  changing it; on the path, it was listed again by every import that missed it
+  once it had changed, tens of thousands of entries a time, by every worker of
+  a burst at once.
   Spares: `CADGEN_DAEMON_SPARES` (default 2). Requests that name no
   model (a document compile or artifact derivation) borrow a spare without binding
   it. Borrowed workers count toward spare capacity while busy, so a stream of
@@ -1308,7 +1317,12 @@ process, or a deadlock that holds the GIL, sends nothing and accrues no CPU. A
 hang that releases the GIL (a network read with no timeout, a Python-level
 deadlock) keeps beating and is not killed. A body's length is therefore
 unbounded; the heartbeat stops before the job's exit frame, so none
-reaches the next job.
+reaches the next job. A starting worker is judged the same way: it is silent
+until it has imported the kernel, a few CPU seconds that a busy machine, or a
+burst of starts, spreads over minutes, so it is waited for while its CPU clock
+moves and killed only after 120 s with neither its announcement nor CPU
+progress. Meanwhile the job it is for is listed `queued`, detail `Starting a
+geometry kernel`: nothing the job runs can say so before its worker exists.
 
 **One daemon per address, by lock.** The daemon takes an exclusive lock keyed
 by its socket address (`cadgen.daemon.transport.SingletonLock`: `flock` on
```

**File**: `packages/cadgen/src/cadgen/_internal/animation_source.py` (modified, +348/-3)
```diff
@@ -1,12 +1,14 @@
 """Inspect animation source embedded in a document-bound STEP sidecar.
 
-Python only reads the source and preflights literal clip names; the shared
-JavaScript runtime compiles and evaluates the module. No adjacent JS file is
-searched or loaded. Dynamic clip definitions are validated by that runtime.
+Python only reads the source: it preflights literal clip names, and checks the
+module's exports when a model declares it; the shared JavaScript runtime
+compiles and evaluates the module. No adjacent JS file is searched or loaded.
+Dynamic clip definitions are validated by that runtime.
 """
 
 from __future__ import annotations
 
+import functools
 import re
 from pathlib import Path
 
@@ -164,3 +166,346 @@ def declared_clip_ids(module_text: str) -> list[str] | None:
             ids.append(key)
     except ValueError:
         return None
+
+
+# --- The module's exports ------------------------------------------------------
+#
+# compileAnimationModule (core's renderModule.js) refuses a module that exports
+# any name but `clips` -- a helper, a constant -- or a default, and drops every
+# clip with it. A model declares its module at build time, so the build refuses
+# what the renderer would, in the renderer's words. The exports are read from
+# the text without running it; a form this reader cannot follow is left to the
+# renderer, which stays the judge.
+
+# The renderer's closed export vocabulary, ANIMATION_MODULE_EXPORTS in
+# renderModule.js. renderModule.parity.json beside it pins this tuple and the
+# refusals' wording to the renderer's own: both test suites read it.
+ANIMATION_MODULE_EXPORTS = ("clips",)
+
+
+def check_animation_exports(module_text: str, *, name: str) -> None:
+    """Raise what ``compileAnimationModule`` throws for this module's exports.
+
+    ``name`` leads the message as it leads the renderer's: ``<model> animation``."""
+    exported = module_exports(module_text)
+    if exported is None:
+        return
+    understood = ", ".join(ANIMATION_MODULE_EXPORTS)
+    unknown = [key for key in exported if key != "default" and key not in ANIMATION_MODULE_EXPORTS]
+    if unknown:
+        raise ValueError(
+            f"{name}: unknown export{'' if len(unknown) == 1 else 's'} {', '.join(unknown)} — "
+            f"the renderer understands: {understood}"
+        )
+    if "default" in exported:
+        raise ValueError(
+            f"{name}: a default export is not an animation-module export — use named exports ({understood})"
+        )
+
+
+@functools.lru_cache(maxsize=8)
+def module_exports(module_text: str) -> tuple[str, ...] | None:
+    """The names an ES module exports, ordered as its namespace lists them (by
+    UTF-16 code unit, as ``Object.keys`` does) -- or ``None`` where only a
+    JavaScript engine can say: a destructured or re-exported name, a duplicate
+    (a SyntaxError), or text this reader cannot follow. Every import of a model
+    declares its module again, so a process reads each text once."""
+    try:
+        names = _top_level_exports(str(module_text or ""))
+    except (_Unreadable, RecursionError):
+        return None
+    if len(set(names)) != len(names):
+        return None
+    return tuple(sorted(names, key=lambda key: key.encode("utf-16-be", "surrogatepass")))
+
+
+class _Unreadable(ValueError):
+    """Module text the export reader cannot follow."""
+
+
+# One JavaScript token reader, enough to find a module's top-level `export`
+# declarations: it steps over strings, templates, comments, regular expressions
+# and bracket groups, and tells a regular expression from a division by the
+# token before the `/`, as JavaScript's grammar does.
+_EOL = r"\r\n\N{LINE SEPARATOR}\N{PARAGRAPH SEPARATOR}"  # JavaScript's line terminators
+_STRING = (
+    r'"[^"\\\r\n]*+(?:\\(?:\r\n|[\s\S])[^"\\\r\n]*+)*+"'
+    r"|'[^'\\\r\n]*+(?:\\(?:\r\n|[\s\S])[^'\\\r\n]*+)*+'"
+)
+_NUMBER = r"\d[\w$.]*+"
+_WORD = r"(?:[^\W\d]|\$)[\w$]*+"
+_ATOMS = rf"{_STRING}|{_NUMBER}|{_WORD}"
+_PLAIN = r"[^\w$\"'`/()\[\]{}]"
+# A `[...]` or `{...}` holding only plain text, strings, numbers and words (a row
+# of generated data) is stepped over whole.
+_FLAT = rf"(?:{_PLAIN}|{_ATOMS})*+"
+_FLAT_GROUP = r"\[" + _FLAT + r"\]|\{" + _FLAT + r"\}"
+# What a scan steps over without deciding anything. It stops at any other
+# bracket, a slash, a backquote and, at the top level, the words `export` and
+# `import`; in an initializer, at `,`, `;` and spaces too.
+_TOP_PLAIN = re.compile(
+    rf"(?:{_PLAIN}|{_STRING}|{_NUMBER}|(?!(?:export|import)(?![\w$])){_WORD}|{_FLAT_GROUP})++"
+)
+_GROUP_PLAIN = re.compile(rf"(?:{_PLAIN}|{_ATOMS}|{_FLAT_GROUP})++")
+_EXPRESSION_PLAIN = re.compile(r"(?:[^\w$\"'`/()\[\]{},;\s]|" + _ATOMS + r")++")
+_SPACE = re.compile(rf"(?:\s++|//[^{_EOL}]*+|/\*[\s\S]*?\*/)*+")
+_LINE_REST = re.compile(rf"[^{_EOL}]*+")
+_LINE_BREAK = re.compile(rf"[{_EOL}]")
+_REGEX_LITERAL = re.compile(rf"/(?:[^/\\\[{_EOL}]|\\[^{_EOL}]|\[(?:[^\]\\{_EOL}]|\\[^{_EOL}
```

**File**: `packages/cadgen/src/cadgen/_internal/annotation_refresh.py` (modified, +6/-0)
```diff
@@ -237,6 +237,12 @@ def refresh_annotations(spec, *, verdict=None) -> str | None:
     raw_animation = parts[1]['animation']
     animation = (copy.deepcopy(record.get('animation')) if raw_animation is _COMPUTED
                  else normalize_animation(raw_animation, where='animation='))
+    if animation is not None:
+        # The decorator checked the module it imported; this is the text read now.
+        from cadgen._internal.animation_source import check_animation_exports
+        from cadgen.render import relative_to_cwd
+
+        check_animation_exports(animation['source'], name=f'{relative_to_cwd(script)}::{entry_name} animation')
     raw_kinematics = parts[1]['kinematics']
     kinematics_is_document = raw_kinematics is _COMPUTED
     try:
```

**File**: `packages/cadgen/src/cadgen/_internal/step_reemit.py` (modified, +8/-3)
```diff
@@ -97,9 +97,12 @@ def load_materials_config(raw: object, *, where: str) -> dict | None:
     return normalize_materials(raw, where=f"{where} --materials")
 
 
-def load_animation_source(raw: object, *, where: str) -> dict | None:
-    """Embed a JS input file or inline module source, never its source path."""
+def load_animation_source(raw: object, *, where: str, document: Path) -> dict | None:
+    """Embed a JS input file or inline module source, never its source path,
+    refusing what the renderer would refuse for ``document``'s animation."""
+    from cadgen._internal.animation_source import check_animation_exports
     from cadgen._internal.source_sidecar import normalize_animation
+    from cadgen.render import relative_to_cwd
 
     if raw is None:
         return None
@@ -108,7 +111,9 @@ def load_animation_source(raw: object, *, where: str) -> dict | None:
     text = raw.strip()
     if "\n" not in text and not text.startswith(("export ", "//", "/*", "const ", "let ", "var ", "class ", "async ", "function ")):
         text = Path(text).expanduser().read_text(encoding="utf-8")
-    return normalize_animation(text, where=f"{where} --animation")
+    animation = normalize_animation(text, where=f"{where} --animation")
+    check_animation_exports(animation["source"], name=f"{relative_to_cwd(Path(document))} animation")
+    return animation
 
 
 def annotation_digest(kinematics_def: Any | None, appearance: object = None, materials: object = None, animation: object = None) -> str:
```

**File**: `packages/cadgen/src/cadgen/authoring.py` (modified, +9/-0)
```diff
@@ -528,6 +528,15 @@ def _apply(func: Callable[..., Any]) -> Callable[..., Any]:
             func = prior.func
         _validate_signature(func, fmt=fmt)
         script_path = _script_path_of(func)
+        if animation_def is not None:
+            # The renderer refuses a module exporting anything but `clips`, and
+            # every clip with it: say so here, in its words, not when it opens.
+            from cadgen._internal.animation_source import check_animation_exports
+            from cadgen.render import relative_to_cwd
+
+            check_animation_exports(
+                animation_def["source"], name=f"{relative_to_cwd(script_path)}::{func.__name__} animation"
+            )
         defn = ModelDef(
             func=func,
             fmt=fmt,
```

**File**: `packages/cadgen/src/cadgen/daemon/artifacts.py` (modified, +1/-1)
```diff
@@ -294,7 +294,7 @@ def watch_owner():
                           "CADGEN_DAEMON": "0", "CADGEN_CACHE_DIR": root})
         if orphaned.is_set():
             raise ArtifactDetached("artifact producer lost its last subscriber")
-        process = subprocess.Popen([sys.executable, "-m", "cadgen.daemon.artifacts"],
+        process = subprocess.Popen([sys.executable, "-P", "-m", "cadgen.daemon.artifacts"],
                                    env=child_env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="backslashreplace")
         if orphaned.is_set():
```

**File**: `packages/cadgen/src/cadgen/daemon/client.py` (modified, +2/-1)
```diff
@@ -484,7 +484,8 @@ def _spawn_daemon(address: str) -> subprocess.Popen | None:
         log_file_path.parent.mkdir(parents=True, exist_ok=True)
         with open(log_file_path, "ab") as log_file:
             return subprocess.Popen(
-                [sys.executable, "-m", "cadgen.daemon"],
+                # -P: cadgen's own modules, never the working folder's (STORE.md §9).
+                [sys.executable, "-P", "-m", "cadgen.daemon"],
                 stdin=subprocess.DEVNULL,
                 stdout=log_file,
                 stderr=subprocess.STDOUT,
```

**File**: `packages/cadgen/src/cadgen/daemon/executors.py` (modified, +3/-3)
```diff
@@ -335,7 +335,7 @@ def submit_compile(
     else:
         _submit_transient(
             job, root, force=force, root_id=root_id, closure=closure,
-            command=[sys.executable, "-m", "cadgen.cli.step_compile", *tool_argv],
+            command=[sys.executable, "-P", "-m", "cadgen.cli.step_compile", *tool_argv],
         )
     emit_event(model_event(document, "building", phase="compile"))
 
@@ -374,7 +374,7 @@ def follow() -> None:
     env["CADGEN_EVENTS"] = "1"  # the child writes events as JSON lines on stderr
     if root_id:
         env["CADGEN_ROOT_ID"] = root_id
-    argv = list(command) if command else [sys.executable, "-m", "cadgen.cli._run_model", *job.target_argv()]
+    argv = list(command) if command else [sys.executable, "-P", "-m", "cadgen.cli._run_model", *job.target_argv()]
     if force and not command:
         argv.append("--force")
     try:
@@ -470,7 +470,7 @@ def _submit_daemon(
             argv.append("--force")
     fallback = None
     if tool != "run":
-        fallback = [sys.executable, "-m", f"cadgen.cli.{tool.replace('-', '_')}", *argv]
+        fallback = [sys.executable, "-P", "-m", f"cadgen.cli.{tool.replace('-', '_')}", *argv]
 
     def run() -> None:
         def observe(event: dict) -> None:
```

---

### Incident Patch 3: `8d795f56` (2026-10-04)
**Commit Message**: Fix STEP loading for wire-only imported components (#526)

Follow-up to #524. An imported STEP product that holds only wires (a
sketch or a reference curve: no faces, some edges) still failed the
whole model with `TESS v4 requires valid complete rendering metadata`,
in the CAD Viewer, snapshots and GLB export. #524 fixed only the product
with no faces and no edges.

- **Tessellation.** `tessellateComponent` measured a component's scale
on face loops alone (Infinity when it has none) and its bounds on
triangles alone. A component with no loops is now measured by its edge
curves. One with no triangles is bounded by its edge polylines, or by a
point at its origin when it has no edges either. This one path replaces
#524's early return and gives the empty entry identical output.
- **Framing.** `buildComposedPackageMeshData` now gives bounds only to
parts the renderer draws. `resolvePartsToRender` skips any part without
triangles, CAD edges included. #524's rule kept the bounds of a part
with CAD edges, so once wires stopped crashing, an undrawn wire would
have set the viewer's camera fit.
- **Cache.** `TESSELLATION_VERSION` is unchanged. Only inputs that
failed before produce new output

**File**: `packages/core/docs/resource-ownership.md` (modified, +7/-5)
```diff
@@ -222,8 +222,10 @@ Snapshot jobs flush and dispose their own cache after their complete source is
 loaded. Decoded component meshes retain their existing page-wide
 content-addressed LRU; a cache view does not retain an additional geometry copy.
 
-Empty imported STEP product entries keep their occurrence identity. A SURF
-with no faces or edges tessellates to empty arrays, a zero-size box at the
-origin and a positive minimum scale, so the same v4 validation applies. That
-box is only cache metadata: composition gives an empty occurrence no bounds,
-so it cannot change the assembly's framing or hide the real parts.
+Imported STEP products without faces keep their occurrence identity. A SURF
+that holds only wires has no loops to measure, so its scale and box come from
+its edge curves. A SURF with no faces or edges tessellates to empty arrays, a
+zero-size box at the origin and a positive minimum scale. Either way the same
+v4 validation applies. That box is only cache metadata: only triangles are
+drawn, so composition gives an occurrence without them no bounds, and it
+cannot change the assembly's framing or hide the real parts.
```

**File**: `packages/core/src/lib/assembly/meshData.js` (modified, +5/-5)
```diff
@@ -575,11 +575,11 @@ export function buildComposedPackageMeshData(descriptor, componentMeshDataByCid,
       triangleCount: meshPartNumericValue(sourcePart, "triangleCount")
     }));
 
-    // An empty component's finite cache box is a placeholder, not geometry.
-    // Retain its occurrence without extending the assembly's camera bounds.
-    const bounds = sourceVertices.length || componentMeshData?.cadEdgePositions?.length
-      ? boundsForTransformedBox(componentMeshData?.bounds, matrix)
-      : null;
+    // Only triangles are drawn (resolvePartsToRender skips a part without them,
+    // edges and all), so a component with none, an empty product entry or wires
+    // only, keeps its occurrence but extends no camera bounds.
+    const drawn = sourceVertices.length >= 3 && (componentMeshData?.indices?.length || 0) >= 3;
+    const bounds = drawn ? boundsForTransformedBox(componentMeshData?.bounds, matrix) : null;
     // An XCAF label entry (`=>[0:1:1:2]`) is no name: the occurrence then goes by its id.
     const displayName = String(stepProductName(occurrence?.name) || occurrenceId || cid || meshPartId(sourceParts[0])).trim();
     const part = {
```

**File**: `packages/core/src/lib/surf/tessellate.js` (modified, +36/-17)
```diff
@@ -1843,22 +1843,6 @@ export function polylineEdge(curve, floats, scale, options = {}) {
 // per-vertex face ordinal channel (picking / selection tint) and per-class
 // edge segment lists.
 export function tessellateComponent(index, floats, options = {}) {
-  // Imported STEP assemblies can retain empty product entries. They have no
-  // samples from which to measure a box, but still need a valid cache payload.
-  if (index.faces.length === 0 && index.edges.length === 0) {
-    return {
-      positions: new Float32Array(0),
-      normals: new Float32Array(0),
-      faceOrds: new Float32Array(0),
-      indices: new Uint32Array(0),
-      sideOrds: new Uint32Array(0),
-      faceRanges: [],
-      edges: [],
-      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
-      scale: 1e-6,
-      ...(options.collectBoundaryDebug ? { boundaryDebug: [], sharedEdges: new Map() } : {}),
-    };
-  }
   // Component scale: bbox diagonal from a cheap pass over loop samples.
   let min = [Infinity, Infinity, Infinity];
   let max = [-Infinity, -Infinity, -Infinity];
@@ -1881,7 +1865,24 @@ export function tessellateComponent(index, floats, options = {}) {
       }
     }
   }
-  const scale = Math.max(length3(sub(max, min)), 1e-6);
+  // A component with no faces has no loops: an imported STEP product that holds
+  // only wires is measured by its edge curves instead.
+  if (!(min[0] <= max[0])) {
+    for (const edge of index.edges) {
+      if (!edge.curve) continue;
+      const [t0, t1] = edge.curve.range;
+      for (const t of [t0, (t0 + t1) / 2, t1]) {
+        const p = evaluateCurve3(edge.curve, floats, t);
+        for (let d = 0; d < 3; d += 1) {
+          if (p[d] < min[d]) min[d] = p[d];
+          if (p[d] > max[d]) max[d] = p[d];
+        }
+      }
+    }
+  }
+  // Nothing to measure (an empty product entry) leaves the box empty: the floor.
+  const extent = length3(sub(max, min));
+  const scale = Number.isFinite(extent) ? Math.max(extent, 1e-6) : 1e-6;
 
   // ONE polyline per model edge, sampled from its exact 3D curve. Every
   // adjacent face's boundary conforms to it (and the display overlay reuses
@@ -2016,6 +2017,24 @@ export function tessellateComponent(index, floats, options = {}) {
       polyline,
     });
   }
+  // No triangles (wires only, or no face that meshed): its edges are the bounds.
+  // With no edges either (an empty product entry), a point at its own origin
+  // keeps the box finite for the cache header and every reader.
+  if (!positions.length) {
+    for (const { polyline } of edges) {
+      for (let i = 0; i < polyline.length; i += 3) {
+        for (let d = 0; d < 3; d += 1) {
+          const value = polyline[i + d];
+          if (value < min[d]) min[d] = value;
+          if (value > max[d]) max[d] = value;
+        }
+      }
+    }
+    if (!(min[0] <= max[0])) {
+      min = [0, 0, 0];
+      max = [0, 0, 0];
+    }
+  }
 
   return {
     positions,
```

**File**: `packages/core/src/lib/surf/tessellationCache.test.js` (modified, +45/-0)
```diff
@@ -8,6 +8,7 @@ import {
   createHttpTessellationCacheProvider,
   decodeComponentTessellation,
   decodeTessellationCacheBatch,
+  edgeClassesFromSurfIndex,
   encodeComponentTessellation,
   encodeTessellationCacheBatch,
   float64Hex,
@@ -223,6 +224,50 @@ test("empty imported components round-trip through the cache without changing as
   }
 });
 
+test("a wire-only imported component is measured by its edges and frames nothing", () => {
+  // A STEP product holding only wires (a sketch, a reference curve) has no
+  // faces, so no loops measure it: its edge curves do.
+  const index = { shapes: [{ ord: 1, kind: "shape", volume: null }], faces: [], edges: [
+    { ord: 1, class: "feature", curve: { kind: "line", origin: [0, 0, 0], dir: [0, 0, 1], range: [0, 50] } },
+    { ord: 2, class: "feature", curve: {
+      kind: "circle", radius: 10, origin: [0, 0, 50], xdir: [1, 0, 0], ydir: [0, 1, 0], zdir: [0, 0, 1],
+      range: [0, 2 * Math.PI],
+    } },
+  ] };
+  const near = (actual, expected) => actual.every((value, d) => Math.abs(value - expected[d]) < 1e-4);
+  const component = tessellateComponent(index, new Float32Array(0));
+  assert.equal(component.indices.length, 0);
+  assert.deepEqual(component.edges.map((edge) => edge.ord), [1, 2]);
+  assert.ok(Math.abs(component.scale - Math.hypot(20, 50)) < 1e-6, "the wires' size, not the floor");
+  assert.ok(near(component.bounds.min, [-10, -10, 0]) && near(component.bounds.max, [10, 10, 50]),
+    "the drawn edges are the bounds");
+  const decoded = decodeComponentTessellation(encodeComponentTessellation(component, {
+    surfaceInput: D,
+    surfaceObject: O,
+    edgeClasses: edgeClassesFromSurfIndex(index),
+  }));
+  assert.ok(decoded, "a wire-only product is a valid complete cache payload");
+  assert.deepEqual(decoded.component, component);
+
+  const wireMesh = buildMeshDataFromSurf(index, null, { component });
+  assert.ok(wireMesh.cadEdgePositions.length > 0, "its edges reach the mesh data");
+  const solidMesh = buildMeshDataFromSurf({ faces: [], edges: [] }, null, {
+    component: componentFixture(),
+  });
+  const assembly = buildComposedPackageMeshData({ assembly: { root: {
+    id: "root", nodeType: "assembly", children: [
+      { id: "wire", nodeType: "part", children: [] },
+      { id: "solid", nodeType: "part", children: [] },
+    ],
+  } }, occurrences: [
+    { id: "wire", component: "wire", transform: [1, 0, 0, 1000, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
+    { id: "solid", component: "solid" },
+  ] }, new Map([["wire", wireMesh], ["solid", solidMesh]]));
+  assert.deepEqual(assembly.parts.map((part) => part.occurrenceId), ["wire", "solid"]);
+  assert.equal(assembly.parts[0].bounds, null, "nothing draws a part without triangles");
+  assert.deepEqual(assembly.bounds, solidMesh.bounds, "so it cannot move the camera");
+});
+
 test("decode rejects expected and embedded identity mismatches as cache misses", () => {
   const bytes = encodedEntry();
   const L = tessellationCacheKey(D, Q);
```

---

### Incident Patch 4: `47854ca8` (2026-10-04)
**Commit Message**: cadgen and viewer: faster agent edits and opens (web and CAD app), host-safe CAD-app messages, Render studio, viewer UI, and fixes (#499)

Faster agent edits, faster opens and updates in the web viewer and the CAD app, a CAD-app transport no host can choke on, a new Render studio, viewer UI cleanups, and fixes. Supersedes #492, #493 and #497.

- **Builds.** An all-link parent composes its tree and splices its STEP from its children's saved files; a STEP whose bytes would not change is kept; a job verifies each stored object once, and its claims keep that; kinematics resolve from the tree's occurrences, not every component's surfaces.
- **Opens and updates.** A package opens with batched reads (hypercar's warm open: 1,575 requests to 96, settled 3.00 → 2.06 s; a cold open 160 → 96 s); the viewer verifies a tree's component map once; a saved file's catalog row is ready as its build ends; large JSON crosses the CAD app's channel gzipped.
- **CAD app safety.** No `cad_http` reply carries more than 4 MiB of body (a message under 5.6 MB), so no host's per-message cap can close the connection; a longer body comes in byte ranges, joined and verified as before.
- **Viewer state.** An update

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -210,7 +210,7 @@ when touching shared surfaces or before handoff:
 - Focused runners: `scripts/test/test-js.sh`, `scripts/test/test-docs.sh`,
   `scripts/test/test-python.sh`, `scripts/test/test-global.sh`.
   `test-python.sh` takes `--select cadgen|viewer|skills|all` and
-  `--print-weights`; `test-js.sh` takes `--select core|ui|web|codex|all`. See
+  `--print-weights`; `test-js.sh` takes `--select core|ui|web|mcp|all`. See
   `scripts/README.md`.
 - In GitHub Actions, `test.yml` runs one conditional job per concern. The graph,
   stable required check names and workspace install recipes are in
```

**File**: `CONTRIBUTING.md` (modified, +14/-0)
```diff
@@ -305,6 +305,20 @@ Review media such as snapshot PNGs are not model artifacts:
 render them under `/tmp` and attach them to the pull request instead. `.gitignore`
 keeps them out of `models/`.
 
+### Performance changes
+
+A change to cadgen's caching, the store, the rebuild gate, or kernel or publish
+performance opens its PR description with a before/after timing table for `main`
+and the branch. The table comes from the edit benchmarks in
+`scripts/bench/cadgen-performance/` (`agent_edits.py` times these edits end to
+end) on representative models, and covers at least a leaf edit, a parent-only
+edit, a revert and a no-op. The table names any slowdown as a regression, and a regression merges
+only with the repository owner's explicit approval. A change that removes a cache
+or a performance mechanism first lists what it made faster. #478 removed the
+kernel-op memo for correctness and slowed re-runs (f1's `power_unit` forced
+rebuild went from 24 s to 102 s); that cost sat deep in a long PR body instead of
+being approved as a trade-off.
+
 ## Source Boundaries
 
 A skill must not import another skill or a repository-root module at runtime, and
```

**File**: `apps/mcp/README.md` (modified, +27/-6)
```diff
@@ -73,7 +73,10 @@ reference host `basic-host` does.
   shared `ConsentCard` from `@text-to-cad/ui/consent`, the viewer's `notice`: top-right
   once a model is on screen, Quick Edit under it, never on the home; the browser
   viewer asks the same way, and one answer counts for both), and nothing is sent before a yes; Settings' Analytics
-  section (`appSettings`) changes the answer later. A plugin directory's install
+  section (`appSettings`) changes the answer later. Settings' Features (Quick edit, on until
+  the person turns it off) is read and changed the same way, through `cad_features`, and kept
+  beside the analytics answer (`cadgen/features.py`): one choice for the sidebar, every
+  thread's tab, every inline card and the browser viewer. A plugin directory's install
   (`cadgen mcp --install store`, stamped by `scripts/release/plugin_zip.py`) is
   only reported as such. The agent's `cad_analytics` reports the setting and
   turns it off, never on.
@@ -109,6 +112,20 @@ reference host `basic-host` does.
   that sends each request as a `cad_http` tool call against the placeholder
   origin `http://cad.invalid`; the server hands it to the viewer's own router.
   The fetch is a distinct function, so workers are handed bytes rather than URLs.
+- **No reply a host cannot read.** A reply is one JSON-RPC message, its body
+  base64 (4/3 of its size), and a host that caps one message closes the
+  connection past the cap, ending the server and every view on it: the MCP
+  TypeScript SDK's stdio reader caps it at 10 MiB unless a host sets more
+  (Claude Code 16 MiB, Claude Desktop 32 MiB). So no `cad_http` reply carries
+  more than 4 MiB of body (`TUNNEL_REPLY_MAX_BYTES`), a message under 5.6 MB,
+  for any model: the client asks for batched reads of at most that (the web
+  client asks for 32 MiB), every GET asks for its first 4 MiB as a byte range,
+  and a longer body comes back a range at a time, which the tunnel puts together
+  for the client. A part of a body that changed meanwhile (its `etag`) fails the
+  read, and the cache verifies a tessellation's digest of the whole as of any
+  body. The server refuses any reply still longer (502), and an agent's
+  screenshot longer than that, rather than send it. 4 MiB loads as fast as 8 MiB
+  did.
 - **One file.** The build inlines scripts, styles, workers (as blobs) and the
   drawing editor's fonts (as data URIs) into `dist/index.html`, and fails if
   anything would be left outside it: the host serves one resource and nothing
@@ -140,7 +157,7 @@ reference host `basic-host` does.
 | --- | --- |
 | `bridge.ts` | JSON-RPC 2.0 over `postMessage`: requests, the opening tool's result, host context, teardown |
 | `server.ts` | typed calls to the server's tools, `cad_reveal` among them: the file menu's Reveal, in the desktop's file manager (the server is on the person's machine) |
-| `tunnel.ts` | the `fetch` over `cad_http` |
+| `tunnel.ts` | the `fetch` over `cad_http`, a long body a range at a time |
 | `files.ts` | a filesystem's read-only `FileSource`: the file on screen, never listed, whose copied references name files by absolute path (a project's is `@text-to-cad/ui/catalog`'s, as the web Viewer's is) |
 | `prompt.ts` | Quick Edit's chat: `chatReach`, what the host's chat takes, and the prompt port over it — Queue through `ui/update-model-context` (a text block titled `Quick edit · <file>` and the sketch's image block, kept until the host clears its model context), Send through `ui/message` — with references as absolute paths (Copy Prompt spells them as copied references are) |
 | `live.ts`, `sync.ts` | the mounted view's live controller (`@text-to-cad/ui/host`'s registry), and its sync (`cad_sync`), every second: its state for the agent, the agent's requests (`show`, `capture`), the catalog's revision and its build feeds |
@@ -150,12 +167,16 @@ reference host `basic-host` does.
 the one the web Viewer shows) over one launch's root, with this host's ports — its
 tunnel (which also carries a copied prompt's sketch to the server: `attachments`), its
 chat, its file menu (copy path, copy relative path under a project,
-Reveal through `cad_reveal`), the navbar's links (Feedback's and an alert's Report Issue's
-new issue among them), followed through `ui/open-link`,
+Reveal through `cad_reveal`), the navbar's and Settings' links (Settings' Feedback and an
+alert's Report Issue open a new issue), followed through `ui/open-link`,
 and, on the sidebar, its library, with Open: the desktop's file chooser, where any file can be chosen.
 With no model there it is the home, and a model opened from it has the navbar's back
-arrow to it. `App.tsx` frames it (full page, or an inline card with its
-full-size button). In a tab, preview's playbar sits on the line of Codex's
+arrow to it. A view keeps its tab record in memory (`App.tsx`): the model on screen keeps
+its view — camera, Display settings, pose — through updates of it, and leaving it for
+another model, for 
```

**File**: `apps/mcp/src/App.test.tsx` (modified, +26/-1)
```diff
@@ -37,7 +37,10 @@ function host(initial: HostContext, hostCapabilities: Record<string, unknown> =
     launch: vi.fn(async (model: string) => ({ ...home, page: 'viewer', model })), pickModel: vi.fn(async () => ({ cancelled: true })),
     reveal: vi.fn(async () => {}),
     consent: vi.fn(async (share?: boolean) => ({ ask: share === undefined && ask, sharing: Boolean(share), policy: 'https://www.texttocad.dev/privacy-policy' })),
+    // The person's features as the server keeps them (`cad_features`).
+    features: vi.fn(async (change?: object) => { kept = { ...kept, ...change }; return kept; }),
   };
+  let kept = { quickEdit: true };
   return { bridge, server };
 }
 const session: Session = { protocol: 3, build: 'b', version: 'test', platform: 'darwin', workspace: [] };
@@ -153,7 +156,8 @@ it('a hand-made install is asked once about analytics: nothing is shared before
     const { bridge, server } = host({ displayMode: 'fullscreen' }, {}, true);
     const { findByRole, getByText } = render(<App bridge={bridge as any} server={server as any} launch={home} session={session} />);
     await findByRole('dialog', { name: 'Allow Analytics' });
-    expect(viewer.props!.appSettings).toEqual([expect.objectContaining({ id: 'analytics', checked: false })]);
+    expect(viewer.props!.appSettings).toEqual([expect.objectContaining({ id: 'analytics', checked: false }),
+      expect.objectContaining({ id: 'quickEdit', section: 'Features', checked: true })]);
     await act(async () => getByText('Allow').click());
     expect(viewer.props!.appSettings![0].checked).toBe(true);
     await act(async () => viewer.props!.appSettings![0].onCheckedChange(false));
@@ -190,3 +194,24 @@ it('an answer is never undone by a read sent just before it, and a choice the en
   await act(async () => {});
   expect(viewer.props!.appSettings![0]).toEqual(expect.objectContaining({ disabled: true, label: 'Share anonymous usage data (set by your environment)' }));
 });
+
+it("Settings' Features: Quick edit is read from the server, turned off there for every view, and handed to the viewer", async () => {
+  const { bridge, server } = host({ displayMode: 'fullscreen' });
+  render(<App bridge={bridge as any} server={server as any} launch={home} session={session} />);
+  await act(async () => {});
+  expect(server.features.mock.calls).toEqual([[undefined]]);
+  expect(viewer.props!.features).toEqual({ quickEdit: true });
+  // Settings: Analytics, then Features.
+  expect(viewer.props!.appSettings!.map(setting => [setting.section, setting.label, setting.checked]))
+    .toEqual([['Analytics', 'Share anonymous usage data', false], ['Features', 'Quick edit', true]]);
+  await act(async () => viewer.props!.appSettings!.find(setting => setting.id === 'quickEdit')!.onCheckedChange(false));
+  expect(server.features).toHaveBeenLastCalledWith({ quickEdit: false });
+  expect(viewer.props!.features).toEqual({ quickEdit: false });
+  cleanup();
+  // Another view of the person's opens with it off: the server kept it.
+  const again = host({ displayMode: 'fullscreen' });
+  again.server.features.mockImplementation(async () => ({ quickEdit: false }));
+  render(<App bridge={again.bridge as any} server={again.server as any} launch={home} session={session} />);
+  await act(async () => {});
+  expect(viewer.props!.features).toEqual({ quickEdit: false });
+});
```

**File**: `apps/mcp/src/App.tsx` (modified, +9/-3)
```diff
@@ -2,11 +2,13 @@ import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSPro
 import { Maximize2 } from 'lucide-react';
 import type { ResourceRef } from '@text-to-cad/core/prompt';
 import { ConsentCard, useAnalyticsConsent } from '@text-to-cad/ui/consent';
+import { useFeatures } from '@text-to-cad/ui/features';
 import { viewerLinks } from '@text-to-cad/ui/links';
 import { Button } from '@text-to-cad/ui/primitives/button';
 import { createTabStore, memoryTabRecord } from '@text-to-cad/ui/tab-store';
 import { version } from '../package.json';
 import type { Bridge, HostContext } from './host/bridge';
+import { fitCapture } from './host/capture';
 import { createLiveRegistry, describeView } from './host/live';
 import { watchSupersession, type Presentation } from './host/presentation';
 import { chatReach } from './host/prompt';
@@ -122,7 +124,7 @@ export default function App({ bridge, server, launch: initial, presentation = 't
     capture: async () => {
       const controller = live.current();
       if (!controller) throw new Error('No model is showing in this CAD view.');
-      return controller.capture();
+      return fitCapture(await controller.capture());
     },
     state: () => describeView(live.current(), shown.current.model, shown.current.resolvePath),
     connection: connected => setLost(!connected),
@@ -167,7 +169,11 @@ export default function App({ bridge, server, launch: initial, presentation = 't
 
   // Asked once, of everyone, unless their environment answered or no answer could be kept
   // (`cadgen/analytics.py`): the card, and Settings' Analytics section after it.
-  const { consent, answer, appSettings } = useAnalyticsConsent(server.consent);
+  const { consent, answer, appSettings: analyticsSettings } = useAnalyticsConsent(server.consent);
+  // Settings' Features (Quick edit), on until the person turns one off: kept by the server beside
+  // the analytics answer, one choice for the sidebar, every thread's tab and the browser viewer.
+  const { features, appSettings: featureSettings } = useFeatures(server.features);
+  const appSettings = useMemo(() => [...analyticsSettings ?? [], ...featureSettings ?? []], [analyticsSettings, featureSettings]);
   const openLink = (url: string) => void bridge.request('ui/open-link', { url }).catch(() => {});
   // The navbar's links: the same as every app's (X, Discord, GitHub and a new issue), followed through the
   // host (a frame cannot open one itself). No update button: the host updates CAD (a plugin directory
@@ -186,7 +192,7 @@ export default function App({ bridge, server, launch: initial, presentation = 't
   return <Frame bridge={bridge} context={context} insets={insets} inline={inline} bottomCenter={bottomCenter}
     overlay={lost ? <Banner message={LOST[presentation]} /> : null}>
     <ModelView key={rootKey(launch.root)} launch={launch} root={launch.root} sequence={showing.sequence} bridge={bridge} server={server}
-      tabStore={tabStore} live={live} links={links} appSettings={appSettings}
+      tabStore={tabStore} live={live} links={links} appSettings={appSettings} features={features}
       notice={consent?.ask ? <ConsentCard policy={consent.policy} onAnswer={answer} onPolicy={openLink} /> : null}
       colorScheme={colorScheme} platform={initial.platform || 'darwin'} reporter={reporter} sync={sync} compact={inline} chat={chat}
       onLaunch={show} onHome={goHome} />
```

**File**: `apps/mcp/src/ModelView.tsx` (modified, +12/-10)
```diff
@@ -1,8 +1,8 @@
 import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
-import { createCadClient, createHttpAttachmentStore } from '@text-to-cad/core/client';
+import { createHttpAttachmentStore, type CadClient } from '@text-to-cad/core/client';
 import { unavailablePromptContext, type ResourceRef } from '@text-to-cad/core/prompt';
 import { CadViewer, createCadFileActions, createCatalogFileSource, normalizeCatalogPath, pathUnderRoot, referencePath, rootPath } from '@text-to-cad/ui/cad-viewer';
-import type { AppSetting } from '@text-to-cad/ui/file-viewer';
+import type { AppSetting, ViewerFeatures } from '@text-to-cad/ui/file-viewer';
 import type { ViewerHost, ViewerLinks } from '@text-to-cad/ui/host';
 import type { ModelLibrarySource } from '@text-to-cad/ui/library';
 import type { TabStore } from '@text-to-cad/ui/tab-store';
@@ -13,7 +13,7 @@ import type { LiveRegistry } from './host/live';
 import { createChatPromptContext, type ChatReach } from './host/prompt';
 import type { Launch, Root, Server } from './host/server';
 import type { ViewSync } from './host/sync';
-import { createTunnelFetch, encodeBase64, TUNNEL_ORIGIN } from './host/tunnel';
+import { createTunnelClient, createTunnelFetch, encodeBase64, TUNNEL_ORIGIN } from './host/tunnel';
 
 export interface ViewReporter {
   /** This view now shows `model` (absolute), or nothing; `resolvePath` turns its references into paths. */
@@ -26,7 +26,7 @@ export interface ViewReporter {
  * data — the root it browses, whether it browses at all, what a Quick Edit can do in the chat —
  * never by where the view is.
  */
-export default function ModelView({ launch, root: launchedRoot, sequence, bridge, server, tabStore, live, links, colorScheme, platform, reporter, sync, onLaunch, onHome, compact = false, chat, appSettings, notice }: {
+export default function ModelView({ launch, root: launchedRoot, sequence, bridge, server, tabStore, live, links, colorScheme, platform, reporter, sync, onLaunch, onHome, compact = false, chat, appSettings, features, notice }: {
   launch: Launch; root: Root; sequence: number; bridge: Bridge; server: Server; tabStore: TabStore; live: LiveRegistry; links: ViewerLinks;
   colorScheme: 'light' | 'dark'; platform: string; reporter: ViewReporter;
   /** The view's one call each second: it carries what this root's client would otherwise poll for. */
@@ -39,8 +39,10 @@ export default function ModelView({ launch, root: launchedRoot, sequence, bridge
   compact?: boolean;
   /** What the chat takes from a Quick Edit: context for the next message, a message now, or neither (Copy Prompt alone). */
   chat: ChatReach;
-  /** This app's on/off settings, in Settings' Analytics section. */
+  /** This app's on/off settings: Settings' Analytics and Features sections. */
   appSettings?: readonly AppSetting[];
+  /** The features the person left on (Settings' Features): Quick edit. */
+  features?: ViewerFeatures;
   /** The analytics question, which the viewer asks once a model is on screen. */
   notice?: ReactNode;
 }) {
@@ -49,8 +51,8 @@ export default function ModelView({ launch, root: launchedRoot, sequence, bridge
   const tunnel = useMemo(() => createTunnelFetch(server, root), [server, root]);
   // The client polls nothing: the view's sync says when the catalog moved, and carries the build
   // feed of a STEP on screen (a call the view makes each second anyway).
-  const client = useMemo(() => createCadClient({
-    origin: TUNNEL_ORIGIN, fetch: tunnel, pollIntervalMs: 0, editingPreviewFeed: sync.observePreview,
+  const client = useMemo(() => createTunnelClient(tunnel, {
+    pollIntervalMs: 0, editingPreviewFeed: sync.observePreview,
   }), [tunnel, sync]);
   useEffect(() => () => client.dispose(), [client]);
   const sourceId = `local-fs:${root.path}`;
@@ -91,7 +93,7 @@ export default function ModelView({ launch, root: launchedRoot, sequence, bridge
   opened.current = onLaunch;
   // A card without a picture has its model drawn from its whole filesystem, whose lazy root reads
   // only that file, since the library spans every root: one client per filesystem, polling nothing.
-  const pictureClients = useRef(new Map<string, ReturnType<typeof createCadClient>>());
+  const pictureClients = useRef(new Map<string, CadClient>());
   useEffect(() => () => {
     for (const pictureClient of pictureClients.current.values()) pictureClient.dispose();
     pictureClients.current.clear();
@@ -118,7 +120,7 @@ export default function ModelView({ launch, root: launchedRoot, sequence, bridge
       if (!anchor || !file) return null;
       let pictureClient = pictureClients.current.get(anchor);
       if (!pictureClient) {
-        pictureClient = createCadClient({ origin: TUNNEL_ORIGIN, fetch: createTunnelFetch(server, { kind: 'global', path: anchor }), pollIntervalMs: 0, shouldPoll: () => false });
+        pictureClient = createTunnelClient(createTunnelFetch(server, { kind: 'global', path: anchor }), 
```

**File**: `apps/mcp/src/host/capture.test.ts` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { fitCapture } from './capture';
+import { TUNNEL_REPLY_MAX_BYTES } from './tunnel';
+
+describe("a view's picture for the agent", () => {
+  afterEach(() => { vi.unstubAllGlobals(); });
+
+  it('goes as it is when it fits in one reply, and is drawn again smaller until it does', async () => {
+    const small = new Blob([new Uint8Array(1000)], { type: 'image/png' });
+    expect(await fitCapture(small)).toBe(small);
+    const drawn: number[][] = [];
+    vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 3000, close() {} }));
+    vi.stubGlobal('OffscreenCanvas', class {
+      constructor(public width: number, public height: number) { drawn.push([width, height]); }
+      getContext() { return { drawImage() {} }; }
+      // A picture's PNG grows with its pixels: here, a byte a pixel.
+      async convertToBlob() { return new Blob([new Uint8Array(this.width * this.height)], { type: 'image/png' }); }
+    });
+    const fitted = await fitCapture(new Blob([new Uint8Array(4000 * 3000)], { type: 'image/png' }));
+    expect(fitted.size).toBeLessThanOrEqual(TUNNEL_REPLY_MAX_BYTES);
+    expect(drawn).toHaveLength(1);
+  });
+});
```

**File**: `apps/mcp/src/host/capture.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { TUNNEL_REPLY_MAX_BYTES } from './tunnel';
+
+/**
+ * A view's picture for the agent (`cad_screenshot`), in one message: the server refuses one longer
+ * than a reply carries (`TUNNEL_REPLY_MAX_BYTES`), since a host could close the connection on it.
+ * A longer PNG is drawn again smaller, by about as much as it is over, until it fits.
+ */
+export async function fitCapture(png: Blob): Promise<Blob> {
+  let fitted = png;
+  let scale = 1;
+  while (fitted.size > TUNNEL_REPLY_MAX_BYTES && scale > 1 / 64) {
+    scale *= 0.9 * Math.sqrt(TUNNEL_REPLY_MAX_BYTES / fitted.size);
+    const image = await createImageBitmap(png);
+    const canvas = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
+    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
+    image.close();
+    fitted = await canvas.convertToBlob({ type: 'image/png' });
+  }
+  return fitted;
+}
```

---

### Incident Patch 5: `d480647e` (2026-10-03)
**Commit Message**: Fix STEP loading for empty imported components (#524)

Imported STEP assemblies containing empty product entries fail to load
with `TESS v4 requires valid complete rendering metadata`: their surface
has no faces or edges, so tessellation computes infinite scale and
bounds. Return an empty payload with finite metadata, preserve the
occurrences, and exclude their placeholder boxes from assembly framing.
Existing nonempty tessellations and cache validation remain unchanged.

The regression covers fresh tessellation, cache encoding/decoding, and
composition with an empty occurrence placed far from the real geometry.
A cold-cache snapshot of the reported six-occurrence assembly now
renders successfully, including both nonempty parts.

Validation:

- Core: 1,235 passed, one existing skip.
- UI: 748 Node tests, 322 React tests, and 59 browser tests passed.
- Web: 69 passed; MCP host: 27 passed; Python store/version contracts:
19 passed.
- Full production bundle, bundle completeness check, dependency
boundaries, and canonical version/pin checks passed.
- Browser checks used installed Chrome. The GLB animation browser test
fails because preview changes capture height from 500 to 464; the
id

**File**: `packages/core/docs/resource-ownership.md` (modified, +6/-0)
```diff
@@ -193,3 +193,9 @@ writes. Viewer write-backs drain after a quiet interval with bounded concurrency
 while snapshot jobs flush and dispose their own cache after their complete
 source is loaded. Decoded component meshes retain their existing page-wide
 content-addressed LRU; a cache view does not retain an additional geometry copy.
+
+Empty imported STEP product entries keep their occurrence identity. A SURF
+with no faces or edges tessellates to empty arrays, a zero-size box at the
+origin and a positive minimum scale, so the same v4 validation applies. That
+box is only cache metadata: composition gives an empty occurrence no bounds,
+so it cannot change the assembly's framing or hide the real parts.
```

**File**: `packages/core/src/lib/assembly/meshData.js` (modified, +5/-1)
```diff
@@ -556,7 +556,11 @@ export function buildComposedPackageMeshData(descriptor, componentMeshDataByCid,
       triangleCount: meshPartNumericValue(sourcePart, "triangleCount")
     }));
 
-    const bounds = boundsForTransformedBox(componentMeshData?.bounds, matrix);
+    // An empty component's finite cache box is a placeholder, not geometry.
+    // Retain its occurrence without extending the assembly's camera bounds.
+    const bounds = sourceVertices.length || componentMeshData?.cadEdgePositions?.length
+      ? boundsForTransformedBox(componentMeshData?.bounds, matrix)
+      : null;
     // An XCAF label entry (`=>[0:1:1:2]`) is no name: the occurrence then goes by its id.
     const displayName = String(stepProductName(occurrence?.name) || occurrenceId || cid || meshPartId(sourceParts[0])).trim();
     const part = {
```

**File**: `packages/core/src/lib/surf/tessellate.js` (modified, +16/-0)
```diff
@@ -1813,6 +1813,22 @@ export function polylineEdge(curve, floats, scale, options = {}) {
 // per-vertex face ordinal channel (picking / selection tint) and per-class
 // edge segment lists.
 export function tessellateComponent(index, floats, options = {}) {
+  // Imported STEP assemblies can retain empty product entries. They have no
+  // samples from which to measure a box, but still need a valid cache payload.
+  if (index.faces.length === 0 && index.edges.length === 0) {
+    return {
+      positions: new Float32Array(0),
+      normals: new Float32Array(0),
+      faceOrds: new Float32Array(0),
+      indices: new Uint32Array(0),
+      sideOrds: new Uint32Array(0),
+      faceRanges: [],
+      edges: [],
+      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
+      scale: 1e-6,
+      ...(options.collectBoundaryDebug ? { boundaryDebug: [], sharedEdges: new Map() } : {}),
+    };
+  }
   // Component scale: bbox diagonal from a cheap pass over loop samples.
   let min = [Infinity, Infinity, Infinity];
   let max = [-Infinity, -Infinity, -Infinity];
```

**File**: `packages/core/src/lib/surf/tessellationCache.test.js` (modified, +47/-1)
```diff
@@ -20,7 +20,9 @@ import {
   tessellationPayloadFacts,
   validateTessellationProbeRow,
 } from "./tessellationCache.js";
-import { DEFAULT_OPTIONS, TESSELLATION_VERSION } from "./tessellate.js";
+import { DEFAULT_OPTIONS, TESSELLATION_VERSION, tessellateComponent } from "./tessellate.js";
+import { buildMeshDataFromSurf } from "./surfMeshData.js";
+import { buildComposedPackageMeshData } from "../assembly/meshData.js";
 
 let tessellationCache = createTessellationCache();
 function setTessellationCacheProvider(provider) {
@@ -175,6 +177,50 @@ test("v4 round-trips the full typed payload and exposes exact D/O/L/Q/R", () =>
   assert.notEqual(copied.component.positions.buffer, unalignedStorage.buffer, "unaligned input safely copies");
 });
 
+test("empty imported components round-trip through the cache without changing assembly bounds", () => {
+  const index = { shapes: [{ ord: 1, kind: "shape", volume: null }], faces: [], edges: [] };
+  const component = tessellateComponent(index, new Float32Array(0));
+  const decoded = decodeComponentTessellation(encodeComponentTessellation(component, {
+    surfaceInput: D,
+    surfaceObject: O,
+    edgeClasses: [],
+  }));
+  assert.ok(decoded, "an empty product entry is a valid complete cache payload");
+  assert.deepEqual(decoded.component, component);
+  const freshMesh = buildMeshDataFromSurf(index, null, { component });
+  const cachedMesh = buildMeshDataFromSurf(surfIndexFromCacheEntry(decoded), null, {
+    component: decoded.component,
+  });
+  assert.deepEqual(cachedMesh, freshMesh);
+
+  const solidMesh = buildMeshDataFromSurf({ faces: [], edges: [] }, null, {
+    component: componentFixture(),
+  });
+  const descriptor = { assembly: { root: {
+    id: "root", nodeType: "assembly", children: [
+      { id: "empty", nodeType: "part", children: [] },
+      { id: "solid", nodeType: "part", children: [] },
+    ],
+  } }, occurrences: [
+    { id: "empty", component: "empty", transform: [
+      1, 0, 0, -1000, 0, 1, 0, -1000, 0, 0, 1, -1000, 0, 0, 0, 1,
+    ] },
+    { id: "solid", component: "solid" },
+  ] };
+  for (const emptyMesh of [freshMesh, cachedMesh]) {
+    const assembly = buildComposedPackageMeshData(descriptor, new Map([
+      ["empty", emptyMesh], ["solid", solidMesh],
+    ]));
+    assert.deepEqual(assembly.parts.map((part) => part.occurrenceId), ["empty", "solid"]);
+    assert.deepEqual(assembly.missingComponentIds, []);
+    assert.equal(assembly.parts[0].bounds, null);
+    assert.equal(assembly.parts[0].triangleCount, 0);
+    assert.equal(assembly.parts[1].triangleCount, 1);
+    assert.deepEqual(assembly.bounds, solidMesh.bounds, "only real geometry frames the view");
+    assert.deepEqual(assembly.assemblyRoot.bounds, solidMesh.bounds);
+  }
+});
+
 test("decode rejects expected and embedded identity mismatches as cache misses", () => {
   const bytes = encodedEntry();
   const L = tessellationCacheKey(D, Q);
```

---

### Incident Patch 6: `4a414aff` (2026-10-01)
**Commit Message**: cadgen: reach-based rebuilds, and caches only around a model run (#478)

Rebuilds follow what a model's code reaches, and every file a build opens is an
input, seen by an in-process native file tracer (one C file, built by zig for
macOS arm64/x86_64, Linux x86_64/aarch64 and Windows x86_64, in one wheel).
Nothing is declared: cadgen.declare_input is gone.

cadgen caches only around a model run: the kernel-op cache, @memo,
CADGEN_OP_MEMO, CADGEN_OP_MEMO_DISK and CADGEN_MEMO_CACHE are removed (laws 5
and 18). The rebuild gate closes 14 staleness gaps, and records move to schema
8, so every model rebuilds once.

Also: cadgen.geometry.is_sound, per-prototype assembly cost, a CPU-aware daemon
heartbeat, cadgen viewer --detach, no 35 s reverse-DNS stall on bind, Test job
timeouts and a 15-minute per-file hang guard, and two flaky tests made
deterministic. Folds in #479 and #486.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/actions/setup-deps/action.yml` (modified, +14/-0)
```diff
@@ -40,6 +40,20 @@ runs:
         python -m pip install --upgrade pip
         python -m pip install -r requirements-dev.txt
 
+    # zig compiles each target's C runtime once and keeps it in its global cache; the
+    # Windows one is most of a cold tracer build. Keyed on the pinned zig version.
+    - name: Cache zig's compiled C runtimes
+      if: inputs.python == 'true'
+      uses: actions/cache@v6
+      with:
+        path: ${{ runner.temp }}/zig-cache
+        key: zig-${{ runner.os }}-${{ hashFiles('requirements-dev.txt') }}
+
+    - name: Point zig at the cache
+      if: inputs.python == 'true'
+      shell: bash
+      run: echo "ZIG_GLOBAL_CACHE_DIR=${{ runner.temp }}/zig-cache" >> "$GITHUB_ENV"
+
     - name: Install the snapshot browser
       if: inputs.python == 'true' && inputs.playwright == 'true'
       shell: bash
```

**File**: `.github/dependabot.yml` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ updates:
     # build123d widens too.
     #
     # build123d is capped for the reason pyproject.toml gives at length -- cadgen
-    # replaces its op memo, its topology entry points and `Compound.__init__`,
+    # patches its set de-duplication, `Vertex.__hash__` and `Compound.__init__`,
     # and a release that moves those stops applying the patch rather than
     # failing. 0.11 -> 0.12 is a semver MINOR, so without this it would arrive
     # inside the grouped minor/patch PR above.
```

**File**: `.github/workflows/release-publish.yml` (modified, +8/-3)
```diff
@@ -106,8 +106,8 @@ jobs:
         uses: ./.github/actions/setup-deps
 
       # The bundle feeds the WHEEL, and it is the only thing that does: cadgen's Node
-      # builders, the snapshot browser bundle and the CAD Viewer client are all
-      # gitignored, so the release commit carries none of them. Nothing here writes to
+      # builders, the snapshot browser bundle, the CAD Viewer client and the file
+      # tracers are all gitignored, so the release commit carries none of them. Nothing here writes to
       # git -- the wheel is the release asset.
       - name: Bundle production outputs
         if: steps.gate.outputs.should_publish == 'true'
@@ -184,7 +184,12 @@ jobs:
             cadgen/_runtime/browser/snapshot-render.js \
             cadgen/_runtime/browser/render.html \
             cadgen/_runtime/node/mesh-export.mjs \
-            cadgen/_runtime/viewer/index.html; do
+            cadgen/_runtime/viewer/index.html \
+            cadgen/_runtime/native/filetrace-macos-aarch64.dylib \
+            cadgen/_runtime/native/filetrace-macos-x86_64.dylib \
+            cadgen/_runtime/native/filetrace-linux-x86_64.so \
+            cadgen/_runtime/native/filetrace-linux-aarch64.so \
+            cadgen/_runtime/native/filetrace-windows-x86_64.dll; do
             if ! printf '%s\n' "$listing" | grep -qF " $required"; then
               echo "$(basename "$wheel") does not contain $required" >&2
               echo "scripts/bundle/bundle.sh produces it; [tool.setuptools.package-data] ships it." >&2
```

**File**: `.github/workflows/test.yml` (modified, +14/-0)
```diff
@@ -26,10 +26,16 @@ concurrency:
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 
 jobs:
+  # Each job's timeout is about twice its slowest recent run. A job that runs Python
+  # test files also leaves room for unittest_files.py's per-file hang guard (15 min)
+  # to fire first and name the file. A hang fails in minutes, not at GitHub's
+  # six-hour default.
+  #
   # What changed, as the classes above. Every other job's `if:` reads these.
   changes:
     name: Changed paths
     runs-on: ubuntu-latest
+    timeout-minutes: 10
     outputs:
       cadgen: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.cadgen == 'true' }}
       core: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.core == 'true' }}
@@ -78,6 +84,7 @@ jobs:
   version:
     name: Version Check
     runs-on: ubuntu-latest
+    timeout-minutes: 10
 
     steps:
       - name: Check out repository
@@ -114,6 +121,7 @@ jobs:
     needs: changes
     if: needs.changes.outputs.cadgen == 'true' || needs.changes.outputs.core == 'true' || needs.changes.outputs.infra == 'true'
     runs-on: ubuntu-latest
+    timeout-minutes: 40
     env:
       # Test files at a time: each is a kernel-loading interpreter (~450 MB).
       CADGEN_TEST_JOBS: "4"
@@ -139,6 +147,7 @@ jobs:
     needs: changes
     if: needs.changes.outputs.cadgen == 'true' || needs.changes.outputs.core == 'true' || needs.changes.outputs.infra == 'true'
     runs-on: windows-latest
+    timeout-minutes: 45
     env:
       # Four, the core count. Six was measured: every file slowed by ~40% and the
       # run failed on timeouts -- the spawn-bound tail is not idle CPU to fill.
@@ -164,6 +173,7 @@ jobs:
     needs: changes
     if: needs.changes.outputs.core == 'true' || needs.changes.outputs.infra == 'true'
     runs-on: ubuntu-latest
+    timeout-minutes: 10
 
     steps:
       - name: Check out repository
@@ -188,6 +198,7 @@ jobs:
     needs: changes
     if: needs.changes.outputs.web == 'true' || needs.changes.outputs.ui == 'true' || needs.changes.outputs.core == 'true' || needs.changes.outputs.cadgen == 'true' || needs.changes.outputs.infra == 'true'
     runs-on: ubuntu-latest
+    timeout-minutes: 30
 
     steps:
       - name: Check out repository
@@ -238,6 +249,7 @@ jobs:
     needs: changes
     if: needs.changes.outputs.skills == 'true' || needs.changes.outputs.cadgen == 'true' || needs.changes.outputs.core == 'true' || needs.changes.outputs.infra == 'true' || needs.changes.outputs.ui == 'true' || needs.changes.outputs.web == 'true'
     runs-on: ubuntu-latest
+    timeout-minutes: 30
     env:
       CADGEN_TEST_JOBS: "4"
 
@@ -264,6 +276,7 @@ jobs:
     needs: changes
     if: needs.changes.outputs.docs == 'true' || needs.changes.outputs.skills == 'true' || needs.changes.outputs.core == 'true' || needs.changes.outputs.cadgen == 'true' || needs.changes.outputs.infra == 'true'
     runs-on: ubuntu-latest
+    timeout-minutes: 10
 
     steps:
       - name: Check out repository
@@ -287,6 +300,7 @@ jobs:
     needs: changes
     if: needs.changes.outputs.cadgen == 'true' || needs.changes.outputs.core == 'true' || needs.changes.outputs.web == 'true' || needs.changes.outputs.ui == 'true' || needs.changes.outputs.infra == 'true'
     runs-on: ubuntu-latest
+    timeout-minutes: 20
 
     steps:
       - name: Check out repository
```

**File**: `AGENTS.md` (modified, +3/-3)
```diff
@@ -78,8 +78,7 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
   away, and the README names the link. Read the README, then follow the one
   link — not the tree. What exists:
   - `packages/cadgen/`: `STORE.md` (the store contract — sectioned, with a
-    table of contents), `MEMO.md` (`@memo`, and the process-wide geometric
-    `Shape` identity it installs), `SNAPSHOTS.md` (snapshot `--debug` timings).
+    table of contents), `SNAPSHOTS.md` (snapshot `--debug` timings).
   - `packages/core/docs/`: `render-pipeline.md`, `resource-ownership.md`,
     `tube-deformation.md`.
   - `packages/ui/docs/`: `settings-ui.md` (BINDING for any settings control),
@@ -137,7 +136,8 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
 - Reserve `scripts/` for durable repo commands. Do not write temporary,
   one-off, or local-only helper scripts there; use `tmp/` or `/tmp` instead.
 - cadgen's packaged runtime (`_runtime/node`, `_runtime/browser`,
-  `_runtime/viewer`) is BUILT, never committed: the whole directory is
+  `_runtime/viewer`, and the file tracer every build loads, `_runtime/native`)
+  is BUILT, never committed: the whole directory is
   gitignored and ships only inside the wheel. Build it with the one bundle
   entry point, `scripts/bundle/bundle.sh`; `bundle.sh --check` builds it and
   asserts every required output. Call `scripts/bundle/cadgen-runtime.sh`
```

**File**: `CONTRIBUTING.md` (modified, +19/-10)
```diff
@@ -109,12 +109,13 @@ on its own would fetch the previous RELEASE from PyPI over your working copy.
 
 `packages/cadgen/src/cadgen/_runtime/` is BUILT, not committed — the whole
 directory is gitignored, and the wheel is the only place those files ship. A
-fresh clone therefore has no Node builders, no snapshot browser bundle and no
-Viewer client until `scripts/bundle/bundle.sh` runs, and cadgen says so by name
-the first time it reaches for one. `scripts/test/test-python.sh` and
-`scripts/test/test-global.sh` build the two stages they read if they are
-missing, so this step is about having the whole thing, including the Viewer
-client the wheel carries.
+fresh clone therefore has no Node builders, no snapshot browser bundle, no
+Viewer client and no file tracer -- so it builds no model -- until
+`scripts/bundle/bundle.sh` runs, and cadgen says so by name the first time it
+reaches for one. `scripts/test/test-python.sh` and `scripts/test/test-global.sh`
+build the stages they read if they are missing (the tracer for this machine
+only), so this step is about having the whole thing, including the Viewer client
+and every platform's tracer the wheel carries.
 
 For CAD Viewer development:
 
@@ -250,6 +251,10 @@ and package Markdown is test input and follows its owning component.
 A skipped job satisfies its required check. Renaming a job renames its required
 check, so it lands together with a matching branch-protection update.
 
+Every job has a timeout of about twice its slowest recent run, so a hang fails
+in minutes. Within a Python suite, a test file still running after 15 minutes
+prints every thread's stack and fails by name.
+
 A web-only edit does not run the Python engine. A UI edit exercises the web
 host. Core changes reach every consumer. Policy checks for a host edit do not
 also run every skill CLI suite. Windows runs the Python package suite because
@@ -262,8 +267,9 @@ optional review screenshots produced by `--out`. Capture timing stays in the
 job log, so a stalled screenshot still leaves useful state diagnostics.
 
 **The packaged runtime is built per job**, not built once and passed between
-them: `ensure_packaged_runtime` takes ~13 s, and an artifact would serialise
-every test job behind a bundle job for longer than that.
+them: `ensure_packaged_runtime` takes ~13 s plus the host's file tracer (seconds
+with zig's cache warm; setup-deps caches it per zig version), and an artifact would
+serialise every test job behind a bundle job for longer than that.
 
 **Flakes are fixed by mechanism or deleted — never skipped, retried, or tuned.**
 Classify first: a real bug, a retired behaviour, or a platform problem. Then fix
@@ -501,7 +507,10 @@ they are wrong.
 
 `main` is source. Everything cadgen executes that is not Python — the Node
 builders and the snapshot browser bundle under `cadgen/_runtime/node` and
-`_runtime/browser`, and the CAD Viewer client under `_runtime/viewer` — is
+`_runtime/browser`, the CAD Viewer client under `_runtime/viewer`, and the file
+tracer every build loads under `_runtime/native` (one C file,
+`packages/cadgen/native/filetrace.c`, cross-compiled by zig for every platform
+into the one wheel; `ziglang` comes with `requirements-dev.txt`) — is
 gitignored and produced by `scripts/bundle/bundle.sh`. Nothing built is ever
 committed: a rebundle used to add a megabyte of history per commit, and a
 committed bundle can drift from the source that claims to produce it.
@@ -552,7 +561,7 @@ is involved) and deletes the branch. The merged commit is THE release commit.
    the release commit carries none of it — then `check-builds.sh`, the docs and
    code tests, the wheel-contents check, `python -m build`, and an `unzip -l`
    assertion that the wheel about to ship really holds `_runtime/node`,
-   `_runtime/browser` and `_runtime/viewer`.
+   `_runtime/browser`, `_runtime/viewer` and every `_runtime/native` tracer.
 3. Install test: the built wheel into a fresh venv — `cadgen --help`, `cadgen
    viewer --help`, `cadgen doctor skills/cad` — then
    `scripts/test/test-installed.sh --wheel <built-wheel>`; the distribution is uploaded as a workflow
```

**File**: `apps/web/README.md` (modified, +32/-3)
```diff
@@ -109,8 +109,26 @@ already serving that realpath with the same code on disk is REUSED
 `--new` forces a fresh instance of the same code; an explicit `--port` is
 strict; `--dist DIR` (or `CADGEN_VIEWER_DIST`) names another built client. The
 URL line (and the `--json` line) is written only after the socket is bound and
-listening with the app attached, so the first request after reading it answers
-— no poll, no retry, no grace period. `cadgen viewer list` shows every running
+listening with the app attached and the instance registered, so the first
+request after reading it answers and `list`/`stop`/reuse already see it — no
+poll, no retry, no grace period. Nothing about the served tree stands in front
+of that line: the catalog walk happens after it, in the background.
+
+A launch that STARTS a server is that server: it stays in the foreground until
+it is stopped (Ctrl-C, `stop`), which is what a terminal and `npm run dev`
+want. A launch that REUSES one prints and exits. `--detach` makes both return:
+the server runs as a background process in its own session, its output goes
+to a log beside its registry entry
+(`<tmp>/cadgen-viewer-info/viewer-<launch-time>-<random>.log`, named by the
+launcher's message and by `list`), and the launcher exits 0 once the server
+has announced itself — or relays the server's refusal and exits non-zero. The
+log outlives the server so a crash can be read afterwards: a clean `stop`
+removes it; an instance that crashed or was killed keeps it for a day, the
+newest ten at most. Agents and scripts use `--detach`; never pipe a foreground
+launch into `tail` or `head`, which wait for an EOF a running server never
+sends.
+`--detach` refuses `--no-registry`, since `list`/`stop` are the only way to
+find a detached server again. `cadgen viewer list` shows every running
 instance; `cadgen viewer stop --port <n>` ends one. Do not stop instances you
 did not start. Dev lives on Vite's port (5173, strict) and never enters the
 instance registry.
@@ -127,7 +145,18 @@ the build — detection only; it keeps serving.
 
 - **The catalog scan skips dot-directories.** A buildable entry under
   `.review/` (or any dotted path) never appears, even when the server is
-  launched from inside it.
+  launched from inside it. It also skips `__cadgen__`, `__pycache__`, `build`,
+  `coverage`, `dist`, `node_modules` and `viewer` (exact case). Everything
+  else is walked — a project's `tmp/` included.
+- **Every catalog request is fresh, and a warm one is cheap.** A new model
+  appears on the next request and a deleted one is gone from it. The server
+  remembers each directory's listing against that directory's own stamps, for
+  at most 10 s, so a root with a few hundred thousand scratch files costs one
+  stat per directory on most requests, not one entry per file; the first walk
+  after launch (done in the background) and one poll in five pay for every
+  file. Where a directory's stamps can be put back (an extract that restores
+  times onto FAT, exFAT or a Windows disk) a change can take those 10 s to show.
+  [docs/backend.md](docs/backend.md) has the rule.
 - **Verify a link by loading the page**, never by curling `/__cad/asset` —
   that route serves raw files; generated entries render through a
   different route, so probing it 404s whether or not anything is wrong.
```

**File**: `apps/web/docs/backend.md` (modified, +41/-4)
```diff
@@ -47,9 +47,12 @@ code; an explicit `--port` is strict and fails if occupied. Always use the
 printed URL, including its port. The JSON response reports `url`, `port`, and
 `action` only after the socket is bound and the app is attached.
 
-`cadgen viewer list` reports running instances and their roots.
+`cadgen viewer list` reports running instances, their roots and, for a
+`--detach` launch, the log its output goes to.
 `cadgen viewer stop --port <port>` stops an instance after verifying its identity.
-Do not stop an instance you did not start.
+Do not stop an instance you did not start. A detached instance's log outlives
+it: a clean `stop` removes it, and one that crashed or was killed keeps it for
+a day (the newest ten), so the reason can still be read.
 
 ## Development
 
@@ -86,8 +89,42 @@ registry, and its API-only mode does not serve a SPA. See the
 
 Each instance serves one fixed filesystem root. `LocalAssetBackend` resolves
 and checks it at construction. Catalog entries include an absolute `file` and
-a `rootRelativeFile` for navigation. The scan skips dot-directories and writes
-no `catalog.json` or hidden catalog cache.
+a `rootRelativeFile` for navigation. The scan skips dot-directories and
+`__cadgen__`, `__pycache__`, `build`, `coverage`, `dist`, `node_modules` and
+`viewer` (`VIEWER_SKIPPED_DIRECTORIES`), and writes no `catalog.json` or hidden
+catalog cache.
+
+**The catalog is fresh on every request.** `GET /__cad/catalog` describes the
+served tree as it is when the request arrives: a model file created before the
+request is in it, one deleted before the request is not. The walk under that
+promise remembers each directory's relevant rows (subdirectories, links, CAD
+files) against the directory's own identity — device, inode, mtime, ctime —
+and re-lists a directory when that identity changes, which adding, removing or
+renaming an entry does. Link targets are re-stated on every request. Three
+rules cover the stamps that fail to move:
+
+- **Same tick.** A listing is served again only if the newer of its
+  directory's mtime and ctime was already 2 s old when it was read, so a change
+  landing in the same timestamp tick (1 s HFS+, 2 s FAT) cannot hide; a
+  directory being written right now is re-listed every time.
+- **Not a time.** A directory whose mtime or ctime is 0 or before 1980 — a
+  macOS exFAT volume root reports 0 and never moves it — is re-listed every
+  time.
+- **Put back.** No listing is served for more than 10 s. tar, unzip, `rsync -a`
+  and `cp -p` restore a directory's mtime after filling it; APFS, HFS+ and ext4
+  still move its ctime, but FAT and exFAT have no ctime of their own and Windows
+  reports creation time in its place, so there the identity can repeat exactly
+  and the change shows within 10 s. The client polls every 2 s, so four polls in
+  five stay warm.
+
+The memo holds at most 65,536 directories, least recently walked dropped first,
+and forgets a directory — with everything under it — once it is gone. A file's
+content is not a listing fact: catalog rows fingerprint their own files.
+Reading a file to hash it never holds up its deletion: the catalog opens models
+with delete sharing on Windows, and a model that vanishes mid-read gets an empty
+hash on that request and is gone on the next. A filesystem whose directory
+listings are themselves cached, such as an NFS mount with attribute caching, is
+only as fresh as that cache.
 
 Both `/__cad/server` and `/__cad/catalog` expose `rootId`, a stable identity for
 the normalized filesystem root. The host uses it for source and session-state
```

---

### Incident Patch 7: `9ab99c73` (2026-09-29)
**Commit Message**: Fix renderer playback and orbit updates; add radial engine sample (#470)

Preview playback can briefly return to its starting pose after a
renderer update, and orbit-driven LOD samples unnecessarily rerender the
STEP surface. This fixes both behaviors, accelerates tube projection for
animated springs, and adds the radial engine sample used to exercise
them.

Split from #449 and based directly on current `main` (`94e6170f6`). This
PR contains no cadgen performance changes and can merge independently of
#449.

## Changes

- STEP pose updates and GLB mixer recreation read the active playback
clock, preserving the current frame during display changes and geometry
updates.
- LOD snapshots update React state only when fields used by the visible
status change, avoiding a surface rerender on every orbit frame.
- Tube deformation uses a bounded Newton projection with the existing
bracketing search as fallback, reducing spring preparation work while
retaining the projection contract.
- Add `models/radial`: the complete source for the 18-system,
nine-cylinder engine, its embedded animation and manual validation
tools, hand-off notes, and model-catalog entry. Generated STEP files and
caches re

**File**: `models/README.md` (modified, +7/-1)
```diff
@@ -17,7 +17,7 @@ models/
 ├── assemblies/       demo ASSEMBLIES, one src/<assembly>/ group each
 ├── drawings/         2D `@dxf` drawings, one script each
 ├── thang010146/      imported, annotated mechanism assemblies
-├── f1/ f14d/ hypercar/ moonwatch/ motorbike/ qdd_actuator/ w16/
+├── f1/ f14d/ hypercar/ moonwatch/ motorbike/ qdd_actuator/ radial/ w16/
 ├── tendon_hand/      tendon-driven research hand (source-only)
 ├── falcon_heavy/     SpaceX public-source reconstruction
 ├── juno/ lyra/       authored robot description packages (URDF/SRDF)
@@ -113,6 +113,12 @@ Models that need a **folder of their own** rather than a single loose script.
   one virtual `drive` DOF gears the rotor, carrier, both ball cages and the
   three planets through the 4.5:1 planetary reduction, with the exploded
   teardown embedded in `qdd_actuator.py`.
+- [radial/](radial/src/README.md): nine-cylinder supercharged radial aircraft engine, as a
+  museum restoration. Eighteen system models are linked by `src/radial.py`, with a
+  master/articulating rod train, a 1/8-speed cam ring, a 3:2 planetary reduction and a
+  10:1 blower. It has a sectioned cylinder, a crankcase window, and `running` and
+  `explode` clips. Its hand-off notes (`REPORT.md`, `GAUNTLET.md`, `BUILDING.md`,
+  `BUGS.md`) sit beside the source.
 - [w16/](w16/src/README.md): quad-turbo 8.0 L W16, sectioned museum cutaway —
   thirteen system models linked by `src/w16.py`, with `crank` and `explode`
   clips from its embedded `ANIMATION_JS`. Its hand-off notes (`REPORT.md`,
```

**File**: `models/radial/.gitignore` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+/STEP/*
+!/STEP/imported/
+/DXF/*
+!/DXF/imported/
+/STL/*
+!/STL/imported/
+/GLB/*
+!/GLB/imported/
+/3MF/*
+!/3MF/imported/
+/tmp/
+__pycache__/
```

**File**: `models/radial/BUGS.md` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+# Repo defects found while building the radial
+
+Each entry: symptom, minimal trigger, workaround applied in this model. Only
+defects of the repo's tooling (cadgen / skills), not of the model itself.
+
+1. **STEP export can turn a valid solid into an invalid or garbage one.**
+   - `heads:seat_1I`: correct and valid in Python, but read back from the saved
+     STEP as a 2.85-litre "spike" (bbox 988 mm) — found by the kinematic gate.
+     Trigger: a seat ring made by a boolean with the chamber sphere, then cut by
+     the section cutter. Workaround: rebuilt the ring without the sphere boolean;
+     the heads build now round-trips every cut leaf through STEP and aborts on
+     growth.
+   - `heads:head_2`: passes BRepCheck at every build stage in memory; written to
+     STEP and read back, one small planar face at y = 109 in the intake-port
+     throat fails with `BadOrientationOfSubshape`. Trigger: a swept port bore
+     (circle along a spline, R24) meeting a straight cylindrical flange bore of
+     the same R24 → near-coincident surfaces leave a sliver face. Workaround: a
+     deliberate 0.4 mm step (R24.4 from y 104).
+   - `propshaft:thrust_inner`: balls fused into the inner race failed BRepCheck
+     only after the STEP round trip. Workaround: balls/cage as a separate body.
+   Expected: the canonical STEP writer should either preserve validity or fail
+   the build; today it silently writes an invalid/garbage solid.
+2. **`gate --static`-style exact distance on big finned castings is extremely
+   slow** (BRepExtrema: seconds to >10 min per pair on heads/crankcase); the
+   model's gate uses mesh screens + OCC booleans instead.
```

**File**: `models/radial/BUILDING.md` (added, +308/-0)
```diff
@@ -0,0 +1,308 @@
+# Building the radial — rules for every part builder
+
+Read this whole file before touching a module. Then read `src/lib/spec.py` (the
+frame and every shared number), `src/lib/kin.py` (where every moving part is),
+`src/lib/geo.py` (placement + the museum-section cutters) and skim
+`src/lib/palette.py`, `src/lib/castings.py`, `src/lib/fasteners.py`.
+
+The brief: a nine-cylinder, single-row, supercharged air-cooled radial,
+1930s–40s golden-age archetype (P&W R-1340 Wasp proportions: 146 × 146 mm,
+~1314 mm diameter), museum-restoration quality, UNBRANDED (no names, logos,
+cast-in badging, data-plate text). **Aesthetics are the primary objective; kinematics are
+non-negotiable.** Where beauty and function conflict on anything that does not
+move, choose beauty. Beauty decides what a part looks like; kinematics decide
+where it is.
+
+## Environment
+
+- Python: the repo's `.venv/bin/python` (cadgen is installed there, from
+  `requirements-dev.txt`). CLI: `.venv/bin/cadgen`.
+- Project root: `models/radial`. Run everything from there. Scratch work goes in
+  `tmp/` (gitignored).
+- Skill docs: `skills/cad/SKILL.md`
+  and `references/build123d-modeling.md` (read the pitfalls: `align=None`,
+  `.located()` vs `.moved()`, multi-tool booleans, tangent booleans, fillets
+  last; colour is linear unless via `srgb()`).
+- Your system: `src/<name>.py` is a thin wrapper (do not edit it); you write
+  `src/lib/<name>.py`, which must define
+  - `MATERIALS`: a tuple of the palette material ids your leaves use (exactly
+    those — the build fails on a mismatch), and
+  - `build() -> list[Shape]`: flat list of labelled, coloured leaf solids,
+    authored DIRECTLY in the engine frame at crank angle θ = 0.
+- Build your system alone: `python tools/engine.py system <name>` (writes
+  `STEP/<name>.step`; unchanged sources are no-ops).
+- Build the whole engine + render it: `python tools/engine.py build-render <job.json>`.
+  Assembly builds and renders are serialised across all builders by a lock; if it
+  says it is waiting, another builder is rendering — just wait.
+- Never edit `spec.py`, `kin.py`, `geo.py`, `palette.py`, `systems.py`,
+  `radial.py`, `tools/`, or another builder's module. If you need a shared number
+  changed, STOP and report it (say exactly what and why). Add helpers inside
+  your own module. You may import `castings`, `fasteners`, `geo`, `kin`, `spec`,
+  `palette` freely.
+- Never `git commit`. Never touch files outside `models/radial`.
+
+## The frame (memorise it)
+
+- **Y = crank axis, +Y = REAR** (blower/accessory section), **−Y = FRONT**
+  (propeller). **Z up. Cylinder 1 points straight up.** Seen from the front
+  (camera on −Y looking +Y), +X is to the right.
+- Crank turns clockwise seen from the rear = right-handed about `ROT_AXIS = (0,-1,0)`.
+  Cylinders are numbered in that sense: cylinder k sits at in-plane angle
+  `ALPHA(k) = 40(k−1)`; the unit vector at in-plane angle b is `(−sin b, 0, cos b)`
+  (so cylinder 2 is 40° toward −X; seen from the FRONT the numbering runs
+  counter-clockwise).
+- **Cylinder-local frame** (author per-cylinder parts once, for cylinder 1):
+  `h` along the cylinder axis from the crank centre (cyl 1: +Z), `y` along the
+  crank axis (+Y), `t` tangential (cyl 1: +X; points toward cylinder k−1).
+  `geo.on_cylinder(shape, k)` places a cylinder-1-authored copy on cylinder k
+  and shares geometry. `spec.cyl_point(k, h, y, t)` gives engine points.
+- **The model is authored at θ = 0**: crankpin on cylinder 1's axis, cylinder 1
+  at FIRING TDC. Everything that moves is placed by `kin` (below).
+
+## Architecture (settled — see `spec.SOURCES`)
+
+Firing order 1-3-5-7-9-2-4-6-8. Cam ring: 4 lobes per track, two tracks
+(intake + exhaust), 1/8 crank speed, turning AGAINST the crank, driven inside the
+ring by crank gear 32T → fixed compound idler 48T/15T → ring internal gear 80T.
+Reduction: 3:2 planetary — crank-driven internal bell gear 72T, FIXED sun 36T,
+six 18T planets on a carrier that IS the propeller shaft (prop turns with the
+crank at 2/3 speed). Supercharger: 10:1, crank gear 60T → three compound
+intermediates 20T/40T → impeller pinion 12T, coaxial with the crank.
+
+Master rod on cylinder 1; knuckle pins on a circle of radius 62 about the
+crankpin at 40(k−1)° from the master-rod axis; articulating rods 203 c-c, master
+265. Strokes differ slightly per cylinder (146.0–147.0 mm) — that asymmetry is
+real and wanted.
+
+Valves lie in the CYLINDER-ROW plane (the h-t plane): intake on +t, exhaust on −t,
+72° included, hemispherical chamber. Two rocker boxes side by side at the head
+top, rocker shafts running fore-aft (along Y). Both pushrods rise in FRONT of the
+cylinder in a V from the nose-case tappets to the front ends of the rockers. Intake
+port on the +t side facing rearward (pipe from the blower); exhaust port on the
+−t side facing forward (stack to a front collector ring). Spark plugs front and
+rear of the head on it
```

**File**: `models/radial/GAUNTLET.md` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+# Gauntlet log
+
+Protocol: per part, a fresh-context critic sees only two images — our in-context
+render (presentation envelope, presentation-large) and a museum/restoration
+photograph — as `a.png`/`b.png` in random order (`tools/critic_pack.py`; keys in
+`tmp/critic/keys/`, never shown to critics). Question: "which is more beautiful?"
+On a loss the critic names ONE largest gap, which goes back to the owner.
+
+## Part rounds
+
+| round | part | reference | ours | verdict | gap named (for the loser) | routed to |
+|---|---|---|---|---|---|---|
+| rods_r1 | rods | P_rods_01 | a | LOST (high) | "articulating rods look like stubby brass cup bushings on clevis stubs; no shanks reach the pistons" — the cups are the tappet guides in FRONT of the window: the rods are not visible in context | layout (window / nose cutaway / camera) |
+| crankshaft_r1 | crankshaft | P_crank_01 | b | LOST (medium) | "bronze sleeves float in the foreground and dwarf everything; the throw, counterweight and master-rod hub are hidden" — again the tappet guides, floating because the nose case is not built yet | cam (guides' look) + layout; part rounds paused until the core statics exist |
+| heads_r2 | heads | P_head_04 | b | LOST (high) | "rocker boxes are oversized flat-lidded rectangular blocks that dwarf the heads; should be small rounded cast housings blending into the head, beside tall thin tightly pitched fins" | heads |
+| barrels_r2 | barrels | P_barrel_02 | b | LOST (high) | "barrel fins read as a flat black block of shallow grooves; should be thin, deep, evenly spaced discs with light between them" | barrels |
+| pushrods_r2 | pushrods | B_02 | a | LOST (high) | "tubes read too thick (~1/3 cylinder width), crossing in a chaotic V, bulky gold sleeves pile up at the case; should be slim, one size, evenly spaced" | pushrods (+ cam: bronze guide flanges) |
+| pistons_r2 | pistons | P_piston_02 | a | LOST (medium) | "black speckled z-fighting on the wrist-pin boss; skirt ends in a flat faceted diagonal chop like a truncated cone; show the hollow interior, ribbed bosses, clean pin bore" | pistons |
+| valvetrain_r2 | valvetrain | P_head_03 | b | LOST (high) | "the two pushrods rise vertically through the middle of the cutaway, across valves, springs and chamber" | layout: section moved to cylinder 1's REAR half (no pushrods in front of it); front star now complete |
+| crankcase_r2 | crankcase | B_03 | b | LOST (high) | "front is a cut-open jumble of gear rings behind the prop hub, no readable nose case or harness ring" — nose case and harness not built yet at render time | nose / ignition (in progress); re-run |
+| valvetrain_r3 | valvetrain (rear section view) | P_head_03 | a | LOST (medium) | "section faces are the same grey as everything else, so walls, ports and chamber don't read; cut plane should be one distinct flat colour, solid wall around a carved chamber" | layout: museum-red section skins on every cut face (geo.cut_with_skin, palette.SECTION_RED) → heads, barrels, pistons, intake, exhaust, ignition, crankcase, nose |
+
+### Layout decisions forced by round 3 (whole-engine renders)
+- The FRONT exhaust collector hid the head-on star in every front view → exhaust moved to the REAR (rear-facing ports on the -t side, collector behind the cylinders). Heat tint re-based to warm stainless grey.
+- The nose cutaway's retained collar blocked every line of sight to the crankcase window → cutaway reworked so the rods show from the front-right three-quarter.
+- The mount ring's top arc crossed the rear section view → mount keeps the top clear.
+
+### User direction (2026-09-23)
+Part-level rounds stop after the in-flight iterations (heads rear exhaust port + red section, blower radial outlets → intake re-route, nose sightline, accessory). The user judged the parts good enough; no part has a recorded blind-A/B win. Work proceeds to the layout fixes, then the whole-engine gauntlet (four views), validation and animations.
+
+## Whole-engine gauntlet, round 1 (after the layout pass; rear view held back for its declutter)
+
+| view | reference | verdict | gap named for ours |
+|---|---|---|---|
+| dead front | A_01 | LOST (high) | propeller blades cut across a third of the star, breaking the nine-fold rhythm |
+| dead front | A_06 | LOST (medium) | cylinders nearly vanish: heads read as small knuckles, fins as flat fanned blades; want nine bold finned masses, not eighteen spokes |
+| front three-quarter | B_01 | LOST (high) | red nose cutaway reads as a flat sticker; blades hide half the engine |
+| front three-quarter | B_03 | LOST (medium) | barrels short dark stubs, shallow head fins, mushy grey; want bright finely layered stacks |
+| section (rear) | C_03 | LOST (high) | head cut face one flat dark-maroon block; want bright red thin walls branching into a cut fin comb |
+| section (rear) | C_04 | LOST (high) | piston reads as an uncut black dome; want the crown, grooves, rings and pin bore cut in red |
+
+Actio
```

**File**: `models/radial/REPORT.md` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+# Nine-cylinder radial: final report (2026-09-25)
+
+Final assembly `models/radial/STEP/radial.step` (geometry 2026-09-25 03:23; re-saved 04:36 only to embed the explode clip, with no system STEP changed), 18 system STEPs in
+`models/radial/STEP/`, sources in `models/radial/src/`. Unbranded: no names, logos or plate text.
+Paths under `tmp/` below (renders, videos, gate logs) are generated and not committed. Rebuild with
+`python src/radial.py`, then run the tools in `src/README.md`.
+
+**Bearing STEP round trips:** the three bearing fixes from the original model worktree are
+included. An isolated check on 2026-09-29 with unmodified main cadgen confirmed valid source and
+saved solids with a maximum relative volume difference of 1.01e-7. No full engine rebuild was
+repeated for the renderer/model split; the original worktree records a successful full build
+with PR #449 on 2026-09-27.
+
+## Figures and sources
+
+| figure | model | public source |
+|---|---|---|
+| bore × stroke | 146 × 146 mm | R-1340 Wasp: 5.75 × 5.75 in (Wikipedia "Pratt & Whitney R-1340 Wasp"; FAA TCDS) |
+| overall diameter | ~1,270 mm across the heads (vertex measure of the rocker covers) | R-1340: 51.75 in = 1,314 mm (same sources) |
+| cylinders | 9, single row, 40° pitch | — |
+| firing order | 1-3-5-7-9-2-4-6-8 | FAA-H-8083-32 Powerplant Handbook |
+| cam ring | 4 lobes per track, 2 tracks, 1/8 crank speed, turning opposite the crank; 32T crank gear → 48/15T idler → 80T internal ring | (n−1)/2 rule, FAA-H-8083-32; enginehistory.org R-1340 |
+| reduction | 3:2 planetary: crank-driven 72T bell, fixed 36T sun, 6 × 18T planets, carrier = prop shaft (prop/crank = 72/108 = 2/3) | enginehistory.org R-1340 / R-1535 |
+| supercharger | gear-driven centrifugal, 10:1 (60/20 × 40/12), coaxial | Wikipedia R-1340; enginehistory.org |
+| rotation | clockwise viewed from the rear | US right-hand convention |
+| rings | 3 compression, 2 oil control, 1 scraper | enginehistory.org R-1340 |
+| master rod | L 265, knuckle circle ρ 62, 8 knuckle pins, 8 articulating rods (L 203) | design, within the real envelope |
+
+Design numbers not taken from a source are marked "(design)" in `src/lib/spec.py`.
+
+## Consistency
+
+`spec.check_spec()` and `kin.check_timing()` pass. They assert:
+- the firing order;
+- 1/|cam ratio| = 2 × lobes;
+- the cam and blower gear trains;
+- the planetary assembly and tooth-count conditions;
+- valve timing phased to the firing order.
+
+The animation's JS runtime matches kin.py to 3.5e-12 across all moving labels (animcheck PASS).
+
+## Validation (final geometry)
+
+- **Builds:** every build exited 0. The final assembly build took 68 s: 18 system checks, then the assembly in 32 s. After the fuel-line fix it took 25 s.
+- **Solids:**
+  - validity (BRepCheck, closed shells, positive volume): 0 bad across all 18 systems;
+  - self-intersection, topology and boundary edges: 0 issues across all 18 systems.
+
+  Logs: `tmp/final/checks.log`.
+
+  **Correction (2026-09-26):** three components are damaged in the saved STEP even though they pass
+  BRepCheck. Found by the STEP read-back verification developed afterwards on branch
+  `claude/cadgen-perf-readback-validity`, which compares written volume against read-back volume.
+  OCCT's STEP writer changed their geometry, and `main` stored the result at exit 0.
+
+  | part | volume written | volume read back |
+  |---|---|---|
+  | `propshaft:thrust_balls` | 49,564 mm³ | 38,550 mm³ (−22%) |
+  | `impeller:bearing_front` | | −19% |
+  | `impeller:bearing_rear` | | −7.5% |
+
+  **Fixed:** preserve the dimensions and labels, but orient the sphere seams and poles clear of
+  their boolean trimming loops. Thrust balls use radial poles and a +Y seam; impeller balls
+  use bearing-axis poles and outward radial seams. These are the original model's 2026-09-27
+  fixes, carried into the sample sources. Isolated STEP round trips on 2026-09-29 produced:
+
+  | part | volume written | volume read back |
+  |---|---|---|
+  | `propshaft:thrust_balls` | 49,564.131808 mm³ | 49,564.136788 mm³ |
+  | `impeller:bearing_front` | 5,963.905259 mm³ | 5,963.905259 mm³ |
+  | `impeller:bearing_rear` | 3,587.927839 mm³ | 3,587.927839 mm³ |
+
+  All three source and saved shapes pass validity checks. This check builds only the three
+  bearing shapes; it does not rebuild the engine or certify its teardown choreography.
+- **Static interference:** every leaf pair at rest, 11,538 pairs, **0 clashes**
+  (`tmp/final/gate_static5.log`). The first final run found one clash: the new accessory fuel line
+  through cylinder 6's intake elbow (164.7 mm³). It was re-routed with ≥ 14.9 mm clearance and
+  re-gated.
+- **Kinematic gate:** 720° in 10° steps (73 angles), every moving leaf against every other motion
+  group, clash = common volume > 0.5 mm³. **0 clashes in every category** (piston-valve, rod-rod,
+  rod-crankcase, pushrod-fin, piston-piston, piston-barrel, other). No part was shrunk t
```

**File**: `models/radial/render/presentation.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "studio": "dark",
+  "quality": "final",
+  "exposure": 0.55,
+  "lighting": { "rotation": 70, "size": 3, "fill": 1 },
+  "backdrop": { "color": "#18191c", "ground": true, "groundPlacement": "lowest" }
+}
```

**File**: `models/radial/src/README.md` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+# radial models
+
+A nine-cylinder, single-row, supercharged, air-cooled radial aircraft engine,
+modelled as a museum restoration of the 1930s–40s archetype. It is unbranded:
+no names, logos or plate text. It has working kinematics, a sectioned cylinder
+and a front crankcase window.
+
+| Script | Artifact | Description |
+|---|---|---|
+| radial.py | STEP/radial.step | Full engine assembly: the eighteen system models below, in occurrence order. It embeds `ANIMATION_JS` (from `lib/anim_js.py`) with a `running` clip (720°, seamless), an `explode` teardown, and `exploded-running` (the running cycle, partly exploded; see below). |
+| crankcase.py | STEP/crankcase.step | split power-section crankcase, cylinder pads, studs, main-bearing housings |
+| crankshaft.py | STEP/crankshaft.step | two-piece single-throw crankshaft, counterweights, main bearings, drive gears |
+| rods.py | STEP/rods.step | master rod + flange, 8 knuckle pins + retainers, crankpin bearing, 8 articulating rods |
+| pistons.py | STEP/pistons.step | 9 pistons, 54 rings, 9 wrist pins + plugs |
+| barrels.py | STEP/barrels.step | 9 finned steel cylinder barrels + hold-down nuts |
+| heads.py | STEP/heads.step | 9 aluminium heads: deep fins, rocker boxes, covers, guides, seats, 18 spark plugs |
+| valvetrain.py | STEP/valvetrain.step | 18 valves, springs, retainers, keepers, 18 rockers + shafts |
+| cam.py | STEP/cam.step | cam ring, cam idler, 18 tappets + rollers |
+| pushrods.py | STEP/pushrods.step | 18 pushrods, 18 pushrod tubes, packing nuts, connectors |
+| nose.py | STEP/nose.step | nose case, tappet guides, thrust-bearing housing, governor pad |
+| reduction.py | STEP/reduction.step | planetary reduction: bell gear, fixed sun, 6 planets, carrier, propeller shaft, thrust bearing |
+| propeller.py | STEP/propeller.step | hub, three blades, spinner, retention hardware |
+| blower.py | STEP/blower.step | blower section, diffuser, impeller, impeller drive gears |
+| intake.py | STEP/intake.step | 9 intake pipes, couplings, carburettor |
+| accessory.py | STEP/accessory.step | accessory case, 2 magnetos, starter, generator, fuel + oil pumps, oil sump |
+| ignition.py | STEP/ignition.step | harness ring, 18 leads, plug elbows, magneto feeds |
+| exhaust.py | STEP/exhaust.step | 9 stacks, collector ring, outlet, clamps |
+| mount.py | STEP/mount.step | engine mount ring, bosses, bushings, bolts |
+
+**Building.**
+- `python src/radial.py` builds the root and every stale system beneath it.
+- `python src/<system>.py` builds one system alone. The engine doesn't pick it
+  up until `radial.py` is rerun.
+- `tools/engine.py build | render JOB.json | build-render JOB.json` serialises
+  builds and renders when several people or agents share the assembly.
+- A cold build of everything takes about 70 min; heads and valvetrain take about
+  25 min each.
+- There are no imported sources.
+
+**Shared helpers.**
+- `lib/spec.py` is the source of truth for the frame and every shared number.
+  Its SOURCES table cites each figure.
+- `lib/kin.py` holds all the motion: crank train, valvetrain, gears and springs.
+- `lib/geo.py`, `lib/castings.py`, `lib/fasteners.py` and `lib/palette.py` hold
+  shared geometry, castings, fasteners and materials.
+- The museum section and window live in `lib/geo.py`.
+- `lib/explodedrun.py` is the layout of the `exploded-running` clip; `lib/animgen.py`
+  bakes it (`python -m lib.animgen`, then `tools/engine.py build`).
+
+## The `exploded-running` clip
+
+The same seamless 720° cycle as `running` (8 s, all motion from `kin.py`), with
+one constant offset per group composed on top, so everything keeps running while
+the engine hangs partly exploded:
+
+- **Stays assembled at the centre:** crankshaft, master rod, knuckle pins,
+  articulating rods and pistons, plus the crank's cam drive gear.
+- **Cylinders:** barrel, head, valves, springs, rockers and pushrods move 205 mm
+  out along each bore, so every piston slides in free air below its cylinder.
+  The rocker covers lift a further 60 mm.
+- **Pushrods:** they stay seated in their rockers and keep their full motion. Their
+  lower ends float clear of the tappets, which keep lifting in the cam section.
+- **Crankcase and nose:** the crankcase front half moves 190 mm forward. The cam
+  section (ring at 1/8, idler and tappets) moves 310 mm forward, and the nose case
+  with the planetary gearing (the bell gear rides along at crank speed) 430 mm.
+  The propeller hub moves 540 mm forward and turns at 2/3.
+- **Rear:** the crankcase rear half moves 170 mm back. The blower moves 300 mm back
+  with its whole 10:1 train, crank blower gear included. The accessory case moves
+  430 mm back.
+- **Hidden:** propeller blades, ignition, exhaust, intake, mount, pushrod tubes,
+  crankcase through-bolts and the fuel line.
+
+`lib/explodedrun.py` states the reasons.
+
+## Architecture (sources in `lib/spec.py`)
+
+- **Cylinders and size:** 146 × 146 mm bore and strok
```

---

### Incident Patch 8: `9ec30773` (2026-09-27)
**Commit Message**: Web viewer: apps/packages layout, per-format renderers, fast selection on large models, tab-scoped state, lean CI (#450)

The web half of `claude/desktop-app` (#369): the new `apps/` +
`packages/` layout, the CAD viewer rebuilt on it, and the web app that
hosts it. The desktop app (`apps/desktop`) is left out and follows in
#369, rebased onto this.

## Layout
- `apps/viewer` becomes `apps/web` (the web viewer). Its client code
moves into two shared packages:
- `packages/core` (`@text-to-cad/core`): rendering, scenes and runtime.
It replaces `packages/cadgen-js`.
- `packages/ui` (`@text-to-cad/ui`): the FileViewer, the renderers, and
a kit that never names a file format.
- `cadgen.viewer` stays the backend.
- The snapshot CLI builds its scenes with the same builders as the
viewer.

## Viewer
- **Renderers by format.** The one `cad` renderer is split into `step`,
`mesh` (STL, 3MF), `glb`, `robot` (URDF, SRDF, SDF) and `dxf`, all on
one shell. The web app registers exactly these five; renderers load on
demand.
- **Tools.** A tool strip with each tool's panels stacked under it;
Display settings as a popover; Preview replaces fullscreen and the
Animate tool; display presets Solid, Rende

**File**: `.gitattributes` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@ assets/**/*.md !filter !diff !merge text
 *.stl filter=lfs diff=lfs merge=lfs -text
 *.3mf filter=lfs diff=lfs merge=lfs -text
 *.dxf filter=lfs diff=lfs merge=lfs -text
+# Test fixtures are read by CI, which checks out without LFS: they stay plain files.
+packages/**/__fixtures__/*.dxf -filter -diff -merge text
 *.glb filter=lfs diff=lfs merge=lfs -text
 *.gltf filter=lfs diff=lfs merge=lfs -text
 *.obj filter=lfs diff=lfs merge=lfs -text
```

**File**: `.github/actions/setup-deps/action.yml` (modified, +33/-29)
```diff
@@ -1,28 +1,19 @@
 name: Set up dependencies
-description: >-
-  Set up Python and Node.js with dependency caching, then install as much of the
-  repo's Python and Node dependencies as the calling job actually uses.
+description: Install the selected root npm workspaces and optional Python/browser dependencies.
 
-# Every input defaults to the full install, so a job that asks for nothing gets
-# what this action always did. Jobs that need less say so: the test matrix runs
-# six ways, and three minutes of `npm ci` for an app a job never touches is three
-# minutes on the critical path of every one of them.
 inputs:
   python:
-    description: Install the Python dependencies (requirements-dev.txt).
+    description: Install requirements-dev.txt.
     default: "true"
   playwright:
-    description: >-
-      Install Playwright's Chromium. Only the snapshot suites render in it; skip
-      it in jobs that run no snapshot.
+    description: Install Python Playwright's snapshot browser (requires python).
     default: "true"
+  ui-browser:
+    description: Install the npm Playwright Chromium used by the shared UI, web and desktop browser tests.
+    default: "false"
   npm:
-    description: >-
-      Space-separated npm project prefixes to `npm ci`, or "none". Building
-      cadgen's packaged runtime needs `packages/cadgen-js`; the Viewer's client
-      build and its own suite need `apps/viewer`; only the docs check needs
-      `apps/docs`.
-    default: "packages/cadgen-js apps/viewer apps/docs"
+    description: Space-separated root workspace paths, or "none". Include shared dependencies used by the job.
+    default: "packages/core packages/ui apps/web apps/docs"
 
 runs:
   using: composite
@@ -40,10 +31,7 @@ runs:
       with:
         node-version: "22"
         cache: npm
-        cache-dependency-path: |
-          packages/cadgen-js/package-lock.json
-          apps/viewer/package-lock.json
-          apps/docs/package-lock.json
+        cache-dependency-path: package-lock.json
 
     - name: Install Python dependencies
       if: inputs.python == 'true'
@@ -52,11 +40,8 @@ runs:
         python -m pip install --upgrade pip
         python -m pip install -r requirements-dev.txt
 
-    # `cadgen snapshot` renders in Playwright's own Chromium build. The Linux image
-    # happens to carry one; Windows does not, and a missing browser fails the
-    # snapshot suites with "Executable doesn't exist". Install it on every OS.
     - name: Install the snapshot browser
-      if: inputs.playwright == 'true'
+      if: inputs.python == 'true' && inputs.playwright == 'true'
       shell: bash
       run: |
         if [ "$RUNNER_OS" = "Linux" ]; then
@@ -65,12 +50,31 @@ runs:
           python -m playwright install chromium
         fi
 
-    - name: Install Node dependencies
+    - name: Install selected root workspaces
       if: inputs.npm != 'none'
       shell: bash
       env:
-        NPM_PREFIXES: ${{ inputs.npm }}
+        NPM_WORKSPACES: ${{ inputs.npm }}
       run: |
-        for prefix in $NPM_PREFIXES; do
-          npm ci --prefix "$prefix"
+        args=()
+        for workspace in $NPM_WORKSPACES; do
+          args+=(--workspace "$workspace")
         done
+        npm ci "${args[@]}"
+        case " $NPM_WORKSPACES " in
+          *" packages/core "*) npm run build --workspace @text-to-cad/core ;;
+        esac
+        case " $NPM_WORKSPACES " in
+          *" packages/ui "*) npm run build --workspace @text-to-cad/ui ;;
+        esac
+
+    # npm and Python Playwright can require different Chromium revisions.
+    - name: Install shared UI and web test browser
+      if: inputs.ui-browser == 'true'
+      shell: bash
+      run: |
+        if [ "$RUNNER_OS" = "Linux" ]; then
+          npx --no-install playwright install --with-deps chromium
+        else
+          npx --no-install playwright install chromium
+        fi
```

**File**: `.github/dependabot.yml` (modified, +5/-36)
```diff
@@ -3,7 +3,7 @@
 # `dependencies` label, which .github/release.yml files under Maintenance.
 #
 # packages/cadgen's pins are the Python floor a released wheel is built against, so
-# they are reviewed like any other change; cadgen-js/viewer/docs are the three npm
+# they are reviewed like any other change; @text-to-cad/core/viewer/docs are the three npm
 # trees CI installs (.github/actions/setup-deps).
 version: 2
 updates:
@@ -47,46 +47,15 @@ updates:
           - patch
 
   - package-ecosystem: npm
-    directory: /apps/viewer
-    schedule:
-      interval: weekly
-    labels:
-      - dependencies
-    groups:
-      viewer-minor-patch:
-        patterns:
-          - "*"
-        update-types:
-          - minor
-          - patch
-
-  - package-ecosystem: npm
-    directory: /packages/cadgen-js
-    schedule:
-      interval: weekly
-    labels:
-      - dependencies
-    groups:
-      cadgen-js-minor-patch:
-        patterns:
-          - "*"
-        update-types:
-          - minor
-          - patch
-
-  - package-ecosystem: npm
-    directory: /apps/docs
+    directory: /
     schedule:
       interval: weekly
     labels:
       - dependencies
     groups:
-      docs-minor-patch:
-        patterns:
-          - "*"
-        update-types:
-          - minor
-          - patch
+      npm-minor-patch:
+        patterns: ["*"]
+        update-types: [minor, patch]
 
   - package-ecosystem: pip
     directory: /packages/cadgen
```

**File**: `.github/workflows/deploy-docs.yml` (modified, +3/-3)
```diff
@@ -3,8 +3,8 @@ name: Deploy Docs
 # Deploys the docs site from a ref of this repository -- main by default.
 #
 # The docs app is a website, not something anyone installs. It builds against
-# repo-root packages/ (apps/docs/tsconfig.json maps cadgen-js/* to
-# ../../packages/cadgen-js/src/*), so it needs the source tree, which every ref
+# compiled @text-to-cad/core exports, built through the root npm workspace. It
+# needs the shared source tree and root lockfile, which every ref
 # of main is. Releases pass the release commit itself, which carries the bumped
 # VERSION and the stamped apps/docs/package.json the site header reads. To
 # redeploy a past release, pass its tag (`v0.5.0`; bare `0.4.28` before 0.5.0).
@@ -50,7 +50,7 @@ jobs:
         run: |
           missing=""
           [ -d apps/docs ] || missing="$missing apps/docs/"
-          [ -d packages/cadgen-js/src ] || missing="$missing packages/cadgen-js/src"
+          [ -d packages/core/src ] || missing="$missing packages/core/src"
           if [ -n "$missing" ]; then
             echo "This ref cannot build the docs site; missing:$missing" >&2
             echo "This looks like a publish commit from before main carried apps/ and packages/." >&2
```

**File**: `.github/workflows/release-publish.yml` (modified, +1/-2)
```diff
@@ -161,7 +161,7 @@ jobs:
           (cd "$RUNNER_TEMP" && "$RUNNER_TEMP/install-test/bin/cadgen" --help >/dev/null)
           (cd "$RUNNER_TEMP" && "$RUNNER_TEMP/install-test/bin/cadgen" viewer --help >/dev/null)
           "$RUNNER_TEMP/install-test/bin/cadgen" doctor skills/cad-viewer
-          scripts/test/test-installed.sh
+          scripts/test/test-installed.sh --wheel "$wheel"
 
       # The distribution is kept whether or not it ships: a rehearsal's artifact is
       # what you inspect instead of a PyPI upload, and a main run's is the record of
@@ -181,7 +181,6 @@ jobs:
             cadgen/_runtime/browser/snapshot-render.js \
             cadgen/_runtime/browser/render.html \
             cadgen/_runtime/node/mesh-export.mjs \
-            cadgen/_runtime/node/dxf-mesh.mjs \
             cadgen/_runtime/viewer/index.html; do
             if ! printf '%s\n' "$listing" | grep -qF " $required"; then
               echo "$(basename "$wheel") does not contain $required" >&2
```

**File**: `.github/workflows/test.yml` (modified, +83/-94)
```diff
@@ -1,45 +1,13 @@
-# The repo's test workflow: one job per thing that has to work, each conditional on
-# the changes that can break it. No gates, no shards. A job skipped by its own
-# condition satisfies its required check, so a prose-only pull request runs Version
-# Check and nothing else.
-#
-# WHAT CAN BREAK WHAT (the dependency graph the conditions encode)
-#   packages/cadgen     the Python engine, CLI doors, daemon and the CAD Viewer BACKEND.
-#                       Everything downstream runs it: the skills (thin entrypoints over
-#                       its CLIs), the viewer (served by cadgen.viewer), the docs site
-#                       (documents its commands), the wheel.
-#   packages/cadgen-js  bundled into the runtime cadgen executes (mesh exports,
-#                       snapshots), imported by the viewer client, and by the docs hero.
-#   apps/viewer         the client. Platform-agnostic JS; served by the backend.
-#   skills/             SKILL.md + scripts. Their suites run the cadgen CLIs; the docs
-#                       site mirrors their frontmatter.
-#   apps/docs           the docs site.
-#   scripts/, .github/, version metadata ("infra"): can break any job.
-#   Root *.md, notes/, models/, LICENSE ("prose"): read by no test. Markdown under
-#   skills/ and packages/cadgen/ is NOT prose -- test_documented_commands,
-#   test_skill_requirements and test_package_boundaries read it.
-#
-# WHAT RUNS WHERE
-#   Version Check     ubuntu   always: VERSION, derived metadata, skill pins
-#   cadgen (Linux)    ubuntu   the cadgen package suite, viewer backend included
-#   cadgen (Windows)  windows  the SAME suite. This is the one thing that must be
-#                              proven on Windows: paths, locks, subprocesses, file
-#                              URLs, the daemon, the viewer backend. Nothing else
-#                              runs there -- bundling, packaging, policy and the JS
-#                              suites are properties of the tree or of a browser,
-#                              not of an operating system.
-#   cadgen-js         ubuntu   cadgen-js unit tests (+ the viewer-memory bench helpers)
-#   viewer            ubuntu   the client's unit tests, then the bundled client
-#                              launched through the real backend
-#   skills            ubuntu   the policy gates (tests/python/global) + every skill suite
-#   docs              ubuntu   the docs site check
-#   packaging         ubuntu   bundle from clean, published-tree contract, wheel
-#                              package data, the CLIs pip-installed outside the repo
-#
-# Each job parallelises internally (unittest_files.py --jobs, node --test concurrency).
-# The packaged runtime is gitignored and built by whichever job needs it
-# (scripts/test/common.sh ensure_packaged_runtime, ~13 s).
+# One job per concern, selected by the dependency graph. Shared core feeds
+# cadgen's runtime, UI, web and docs; UI feeds web. Apps never feed another
+# app. Policy checks run for changed shared contracts without also running
+# every skill suite. Runtime outputs are built only where needed.
 #
+# Check names are the jobs' concerns: `core-js` tests packages/core, `web` tests
+# packages/ui and apps/web and drives the bundled viewer. main's required checks
+# name all eight jobs.
+# Prose-only root changes run Version Check only; skill/package Markdown remains
+# test input.
 name: Test
 
 on:
@@ -63,12 +31,13 @@ jobs:
     name: Changed paths
     runs-on: ubuntu-latest
     outputs:
-      cadgen: ${{ steps.filter.outputs.cadgen }}
-      cadgenjs: ${{ steps.filter.outputs.cadgenjs }}
-      viewer: ${{ steps.filter.outputs.viewer }}
-      skills: ${{ steps.filter.outputs.skills }}
-      docs: ${{ steps.filter.outputs.docs }}
-      infra: ${{ steps.filter.outputs.infra }}
+      cadgen: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.cadgen == 'true' }}
+      core: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.core == 'true' }}
+      ui: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.ui == 'true' }}
+      web: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.web == 'true' }}
+      skills: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.skills == 'true' }}
+      docs: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.docs == 'true' }}
+      infra: ${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.infra == 'true' }}
     steps:
       - name: Check out repository
         uses: actions/checkout@v7
@@ -82,10 +51,12 @@ jobs:
               - 'tests/python/packages/**'
               - 'tests/python/support/**'
               - 'requirements*.txt'
-            cadgenjs:
-              - 'packages/cadgen-js/**'
-            viewer:
-              - 'apps/viewer/**'
+            core:
+              - 'packages/core/**'
+            ui:
+            
```

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -25,6 +25,8 @@ node_modules
 dist
 coverage
 
+# Playwright's per-run output.
+test-results/
 
 # Temporary files and scratch notes
 *.tmp
```

**File**: `AGENTS.md` (modified, +41/-50)
```diff
@@ -57,8 +57,9 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
 - `.claude-plugin/`, `.codex-plugin/`: agent plugin manifests. The repository
   root is the plugin package; its skills are `skills/` directly.
 - `models/`: sample and durable CAD/robot-description fixtures.
-- `apps/viewer/`: the CAD Viewer's React client (its backend is `cadgen.viewer`).
-- `packages/cadgen-js`: shared JS CAD/render/runtime code, UI-framework agnostic.
+- `apps/web/`: the CAD Viewer's React client (its backend is `cadgen.viewer`).
+- `packages/core`: `@text-to-cad/core`, shared CAD/runtime/client code without React.
+- `packages/ui`: `@text-to-cad/ui`, the shared FileViewer, renderers, controls and styles.
 - `packages/cadgen`: the published distribution — STEP/GLB/topology generation,
   the skill CLI parsers, the CAD Viewer backend + client, and the Node/browser
   runtimes it executes.
@@ -70,18 +71,18 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
 ## Repo Rules
 
 - Boundaries and design laws live in each package's README: read
-  `packages/cadgen/README.md` (the laws), `packages/cadgen-js/README.md`,
-  `apps/viewer/README.md`, and `apps/docs/README.md` before changing
+  `packages/cadgen/README.md` (the laws), `packages/core/README.md`, `packages/ui/README.md`,
+  `apps/web/README.md`, and `apps/docs/README.md` before changing
   generation, rendering, storage, layout, or public interfaces.
 - A README holds the laws; the mechanism each law constrains lives one link
   away, and the README names the link. Read the README, then follow the one
   link — not the tree. What exists:
   - `packages/cadgen/`: `STORE.md` (the store contract — sectioned, with a
     table of contents), `MEMO.md` (`@memo`, and the process-wide geometric
     `Shape` identity it installs), `SNAPSHOTS.md` (snapshot `--debug` timings).
-  - `packages/cadgen-js/docs/`: `render-pipeline.md`, `resource-ownership.md`,
+  - `packages/core/docs/`: `render-pipeline.md`, `resource-ownership.md`,
     `tube-deformation.md`.
-  - `apps/viewer/docs/`: `settings-ui.md` (BINDING for any settings control),
+  - `packages/ui/docs/`: `settings-ui.md` (BINDING for any settings control),
     `render-types.md`, `render-mode.md`, `lod.md`, `storage.md`, `backend.md`.
 - Ships-alone law: `packages/cadgen` (the built PyPI wheel) works in isolation
   outside this repo, so its markdown must not refer to anything outside the
@@ -114,9 +115,18 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
   generate small fixtures in fresh temporary directories or use tiny test-owned
   fixtures, with their own cache stores and cleanup. Repo `tmp/` is fine.
   Enforced by `tests/python/global/test_tests_are_self_contained.py`.
-- Every test file is reached by a runner under `scripts/test/`, and a collector
-  that finds nothing fails the run rather than reporting a group that never
-  ran — so a renamed or emptied test directory stops CI instead of going quiet.
+- Every test runs in CI. Each test file is reached by a runner under
+  `scripts/test/`, every runner is called by a `test.yml` job on the changes that
+  can break it, and a collector that finds nothing fails the run rather than
+  reporting a group that never ran. A test no CI job runs is dead: wire it in or
+  delete it. There are no manual-only test gates. Enforced by
+  `tests/python/global/test_ci_workspace_selection.py`.
+- Tests and CI are short and succinct. Test a contract, a user flow or a fixed bug,
+  once, at the cheapest level that exercises the real path: a unit or jsdom test
+  first, a real browser (WebGL) only for what needs one. Await the condition, never
+  a fixed sleep or a wall-clock bound; a flaky test is fixed or deleted, never
+  retried. CI time is a budget: the `web` job stays within 7 minutes, and a
+  change that lengthens any job says what it costs and why in its PR.
 - Benchmarks under `scripts/bench/` are manual and their output is never
   committed: reports, logs, profiles and screenshots go to an ignored `tmp/`.
   Only their pure helper units run in a test runner.
@@ -138,16 +148,21 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
   a skill with missing files. `scripts/github-workflows/check-builds.sh` enforces
   this; do not relax it.
 - The CAD Viewer is `cadgen viewer`: the server is `cadgen.viewer` (Python, in
-  `packages/cadgen`), the React client's source is `apps/viewer/` and its build
+  `packages/cadgen`), the React client's source is `apps/web/` and its build
   ships in the wheel at `cadgen/_runtime/viewer` (built, never committed; a
-  checkout serves `apps/viewer/dist`). The cad-viewer skill is instructions over that verb.
+  checkout serves `apps/web/dist`). The cad-viewer skill is instructions over that verb.
   Nothing in `cadgen.viewer` imports the CAD kernel at module scope — the one
   kernel action, importing a foreign STEP, is a com
```

---

### Incident Patch 9: `366937e3` (2026-09-17)
**Commit Message**: Stop MTEXT paragraph properties leaking into engraved text (#411)

`stripMtextFormatting` replaced the paragraph break `\P` case-insensitively, so lowercase `\p` (paragraph properties, which carry a payload up to a semicolon: `\pxqc;`, `\pxi-2,l2,t2;`) matched too, consuming two characters and leaving the payload in the engraved text. AutoCAD writes paragraph properties for centred or indented MTEXT, so centred labels engraved their alignment code.

Drop the `i` flag so `\P` only matches the break, and add `p` to the inline property-run class so `\p...;` is removed whole the way `\f...;` and `\H...;` already are.

Refiled from #385 on top of the runtime-bundle removal: same source and tests, without the two committed bundles that PR also patched and that no longer exist in the tree.

Closes #332. Supersedes #385.

Co-authored-by: NgoQuocViet2001 <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01PZLP5p8ta3SJ3kqnntEuF7

**File**: `packages/cadgen-js/src/lib/dxf/parseDxf.js` (modified, +5/-2)
```diff
@@ -678,9 +678,12 @@ const NON_GEOMETRIC_ENTITY_TYPES = new Set([
 export function stripMtextFormatting(raw) {
   let text = String(raw ?? "");
   // \P is a paragraph break, \~ a hard space; \\ and \{ \} escape literals.
-  text = text.replace(/\\P/gi, "\n").replace(/\\~/g, " ");
+  // Case-sensitive: lowercase \p is paragraph PROPERTIES (\pxqc;), a different
+  // command carrying a payload up to a semicolon. Matching it here consumed
+  // only the two characters and left the rest in the text.
+  text = text.replace(/\\P/g, "\n").replace(/\\~/g, " ");
   // Inline property runs: \f...; \H...; \C...; \T...; \Q...; \W...; \A...; — command up to ;
-  text = text.replace(/\\[fFhHcCtTqQwWaA][^;]*;/g, "");
+  text = text.replace(/\\[fFhHcCtTqQwWaAp][^;]*;/g, "");
   // Stacking \S...^...; renders as the plain parts.
   text = text.replace(/\\S([^^;]*)\^([^;]*);/g, "$1/$2");
   // Grouping braces are structure, not content.
```

**File**: `packages/cadgen-js/src/lib/dxf/parseDxf.test.js` (modified, +21/-1)
```diff
@@ -1,7 +1,7 @@
 import assert from "node:assert/strict";
 import test from "node:test";
 
-import { parseDxf } from "./parseDxf.js";
+import { parseDxf, stripMtextFormatting } from "./parseDxf.js";
 
 function dxfText(lines) {
   return `${lines.join("\n")}\n`;
@@ -297,3 +297,23 @@ test("a HATCH's seed point is not read as another boundary vertex", () => {
     }
   }
 });
+
+const BS = String.fromCharCode(92);
+
+// \p is paragraph PROPERTIES; \P is a paragraph BREAK. Matching the break
+// case-insensitively consumed only the two characters of \p and left its
+// payload in the engraved text.
+test("MTEXT paragraph properties are removed whole", () => {
+  assert.equal(stripMtextFormatting(`${BS}pxqc;PART A`), "PART A");
+  assert.equal(stripMtextFormatting(`${BS}pxi-2,l2,t2;Item`), "Item");
+});
+
+test("an MTEXT paragraph break is still a newline", () => {
+  assert.equal(stripMtextFormatting(`Line1${BS}PLine2`), `Line1${String.fromCharCode(10)}Line2`);
+});
+
+test("other MTEXT inline property runs are unaffected", () => {
+  assert.equal(stripMtextFormatting(`${BS}H2.5x;BIG`), "BIG");
+  assert.equal(stripMtextFormatting(`${BS}C1;RED`), "RED");
+  assert.equal(stripMtextFormatting("plain"), "plain");
+});
```

---

### Incident Patch 10: `13931455` (2026-09-16)
**Commit Message**: build(viewer): vite 8, @vitejs/plugin-react 6 and react 19 (#401)

The two viewer major bumps dependabot could not land on its own (#381, #383).

Vite 8.3.0 + @vitejs/plugin-react 6.1.1: Oxc replaces esbuild and picks its parser from the file extension, and the native build transform ignores the blanket oxc.lang, so a small enforce:"pre" plugin runs transformWithOxc with lang:"jsx" over the client's own .js sources that contain JSX (the long-term alternative is renaming them to .jsx). optimizeDeps.esbuildOptions.loader -> optimizeDeps.rolldownOptions.moduleTypes; build.rollupOptions manualChunks -> build.rolldownOptions codeSplitting.groups with the same four vendor chunks; the node --test JSX hook moves from transformWithEsbuild to transformWithOxc. Build time 14.3 s -> 2.2 s.

React 19.3.0: the client already used createRoot + StrictMode; the one break was scripts/reactHarness.mjs, whose hook-dispatcher swap reads React 19's renamed internals (__CLIENT_INTERNALS….H). Same swap-and-restore contract.

Verified: viewer tests (688 + 13), build, bundle check, viewer launch and browser gates (identical gate numbers), viewer backend suite (380), dev page under Playwright with zero React

**File**: `apps/viewer/package-lock.json` (modified, +598/-1633)
```diff
@@ -14,20 +14,20 @@
         "lucide-react": "^1.45.0",
         "meshoptimizer": "^1.2.0",
         "radix-ui": "^1.6.7",
-        "react": "18.3.1",
-        "react-dom": "18.3.1",
+        "react": "19.3.0",
+        "react-dom": "19.3.0",
         "tailwind-merge": "^3.7.0",
         "three": "0.186.0"
       },
       "devDependencies": {
         "@babel/parser": "^8.0.5",
         "@babel/traverse": "^8.0.5",
         "@tailwindcss/postcss": "^4.3.3",
-        "@vitejs/plugin-react": "^4.7.0",
+        "@vitejs/plugin-react": "^6.1.1",
         "pngjs": "^7.0.0",
         "tailwindcss": "^4.2.2",
         "tw-animate-css": "^1.4.0",
-        "vite": "^7.3.2"
+        "vite": "^8.3.0"
       }
     },
     "../../packages/cadgen-js": {
@@ -54,157 +54,6 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
-    "node_modules/@babel/code-frame": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
-      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@babel/helper-validator-identifier": "^7.29.7",
-        "js-tokens": "^4.0.0",
-        "picocolors": "^1.1.1"
-      },
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/compat-data": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.0.tgz",
-      "integrity": "sha512-T1NCJqT/j9+cn8fvkt7jtwbLBfLC/1y1c7NtCeXFRgzGTsafi68MRv8yzkYSapBnFA6L3U2VSc02ciDzoAJhJg==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/core": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.0.tgz",
-      "integrity": "sha512-CGOfOJqWjg2qW/Mb6zNsDm+u5vFQ8DxXfbM09z69p5Z6+mE1ikP2jUXw+j42Pf1XTYED2Rni5f95npYeuwMDQA==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@babel/code-frame": "^7.29.0",
-        "@babel/generator": "^7.29.0",
-        "@babel/helper-compilation-targets": "^7.28.6",
-        "@babel/helper-module-transforms": "^7.28.6",
-        "@babel/helpers": "^7.28.6",
-        "@babel/parser": "^7.29.0",
-        "@babel/template": "^7.28.6",
-        "@babel/traverse": "^7.29.0",
-        "@babel/types": "^7.29.0",
-        "@jridgewell/remapping": "^2.3.5",
-        "convert-source-map": "^2.0.0",
-        "debug": "^4.1.0",
-        "gensync": "^1.0.0-beta.2",
-        "json5": "^2.2.3",
-        "semver": "^6.3.1"
-      },
-      "engines": {
-        "node": ">=6.9.0"
-      },
-      "funding": {
-        "type": "opencollective",
-        "url": "https://opencollective.com/babel"
-      }
-    },
-    "node_modules/@babel/core/node_modules/@babel/helper-globals": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.29.7.tgz",
-      "integrity": "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/core/node_modules/@babel/parser": {
-      "version": "7.29.8",
-      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.29.8.tgz",
-      "integrity": "sha512-E8lTAYNB1KW+FH+VGJuZM1ioAx2E6oVlvQFRrf5P8ZZmsiJXYAD9vTFV7yyEURNzgh1dFqMZuO6tUwcARbqFCA==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@babel/types": "^7.29.8"
-      },
-      "bin": {
-        "parser": "bin/babel-parser.js"
-      },
-      "engines": {
-        "node": ">=6.0.0"
-      }
-    },
-    "node_modules/@babel/core/node_modules/@babel/traverse": {
-      "version": "7.29.8",
-      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-7.29.8.tgz",
-      "integrity": "sha512-I5z7H3bf/41ktsNVLtpN0wAa336HkqIHQ5BuPLEhTkt1jVSyZpeNKIzTgEWmlxjdg81R0IgUCcaE+Ok3NvrfZg==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@babel/code-frame": "^7.29.7",
-        "@babel/generator": "^7.29.8",
-        "@babel/helper-globals": "^7.29.7",
-        "@babel/parser": "^7.29.8",
-        "@babel/template": "^7.29.7",
-        "@babel/types": "^7.29.8",
-        "debug": "^4.3.1"
-      },
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/generator": {
-      "version": "7.29.8",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.8.tgz",
-      "integrity": "sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@babel/parser": "^7.29.8",
-        "@babel/types": "^7.29.8",
-        "@jridgew
```

**File**: `apps/viewer/package.json` (modified, +4/-4)
```diff
@@ -15,19 +15,19 @@
     "lucide-react": "^1.45.0",
     "meshoptimizer": "^1.2.0",
     "radix-ui": "^1.6.7",
-    "react": "18.3.1",
-    "react-dom": "18.3.1",
+    "react": "19.3.0",
+    "react-dom": "19.3.0",
     "tailwind-merge": "^3.7.0",
     "three": "0.186.0"
   },
   "devDependencies": {
     "@babel/parser": "^8.0.5",
     "@babel/traverse": "^8.0.5",
     "@tailwindcss/postcss": "^4.3.3",
-    "@vitejs/plugin-react": "^4.7.0",
+    "@vitejs/plugin-react": "^6.1.1",
     "pngjs": "^7.0.0",
     "tailwindcss": "^4.2.2",
     "tw-animate-css": "^1.4.0",
-    "vite": "^7.3.2"
+    "vite": "^8.3.0"
   }
 }
```

**File**: `apps/viewer/scripts/jsxLoaderHooks.mjs` (modified, +9/-3)
```diff
@@ -2,7 +2,7 @@
 // The client is authored the way Vite builds it: JSX inside `.js`, the `@/`
 // alias, and extensionless relative imports. Node resolves none of those, so
 // component and hook tests need the same two translations Vite performs — an
-// alias/extension resolver and the esbuild JSX transform (Vite's own, so tests
+// alias/extension resolver and the Oxc JSX transform (Vite's own, so tests
 // and the build never disagree about the transform).
 import fs from "node:fs";
 import path from "node:path";
@@ -18,9 +18,15 @@ const JSX_MARKER = /<\/|\/>/u;
 
 let transform = null;
 
+// Vite 8 transforms with Oxc: `transformWithEsbuild` is deprecated and now
+// needs esbuild installed separately, which the app no longer depends on.
+// `lang` replaces esbuild's `loader`, and the JSX runtime is an object.
 async function transformJsx(source, file) {
-  if (!transform) ({ transformWithEsbuild: transform } = await import("vite"));
-  const transformed = await transform(source, file, { loader: "jsx", jsx: "automatic" });
+  if (!transform) ({ transformWithOxc: transform } = await import("vite"));
+  const transformed = await transform(source, file, {
+    lang: "jsx",
+    jsx: { runtime: "automatic" },
+  });
   return transformed.code;
 }
 
```

**File**: `apps/viewer/scripts/reactHarness.mjs` (modified, +10/-4)
```diff
@@ -13,7 +13,13 @@
 // in a Playwright check instead.
 import React from "react";
 
-const dispatcherRef = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
+// React 19 renamed the shared internals object and flattened it: the hook
+// dispatcher that was `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
+// .ReactCurrentDispatcher.current` is now the `H` field of
+// `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`. Same
+// contract — read it, swap in this file's dispatcher for one call, put the
+// previous one back — so everything below is unchanged.
+const reactInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
 
 function sameDeps(previous, next) {
   if (!previous || !next || previous.length !== next.length) return false;
@@ -113,12 +119,12 @@ export function render(type, initialProps = {}) {
       do {
         dirty = false;
         cursor = 0;
-        const previous = dispatcherRef.current;
-        dispatcherRef.current = dispatcher;
+        const previous = reactInternals.H;
+        reactInternals.H = dispatcher;
         try {
           tree = type(props);
         } finally {
-          dispatcherRef.current = previous;
+          reactInternals.H = previous;
         }
         flush();
         if (++guard > 50) throw new Error("render did not settle after 50 passes");
```

**File**: `apps/viewer/vite.config.mjs` (modified, +65/-26)
```diff
@@ -2,7 +2,7 @@ import { spawn } from "node:child_process";
 import fs from "node:fs";
 import path from "node:path";
 import { fileURLToPath } from "node:url";
-import { defineConfig } from "vite";
+import { defineConfig, transformWithOxc } from "vite";
 import react from "@vitejs/plugin-react";
 
 import { resolveDirectoryRoot as resolveViewerDirectoryRoot } from "./scripts/directoryRoot.mjs";
@@ -183,6 +183,49 @@ function readFirstJsonLine(stream) {
   });
 }
 
+// Vite 8 transforms with Oxc instead of esbuild, and Oxc picks its parser from
+// the file EXTENSION: a `.js` file is read as plain JavaScript, so the client's
+// JSX-inside-`.js` is a syntax error. Vite 7 said this in one line —
+// `esbuild: { loader: "jsx" }` — but Oxc has no per-extension loader map, and
+// the blanket `oxc.lang` the migration guide offers is honoured only by the
+// JavaScript transform path (dev), not by the native one `vite build` runs. So
+// the client's own `.js` sources are transformed here instead, ahead of Vite's
+// transform (`enforce: "pre"`), which then sees ordinary JavaScript. The
+// already-emitted `react/jsx-runtime` import is what keeps Fast Refresh on for
+// these files — @vitejs/plugin-react looks for exactly that.
+//
+// Only the client's own sources: nothing else in the graph writes JSX into a
+// `.js` file. scripts/jsxLoaderHooks.mjs is the same translation for
+// `node --test`.
+const JSX_IN_JS = /<\/|\/>/u;
+
+function jsxInJsPlugin() {
+  const clientRoot = normalizeSlashes(viewerClientRoot);
+  let isProduction = true;
+  return {
+    name: "cad-viewer-jsx-in-js",
+    enforce: "pre",
+    configResolved(config) {
+      isProduction = config.isProduction;
+    },
+    async transform(code, id) {
+      const [file] = normalizeSlashes(id).split("?");
+      if (!file.startsWith(clientRoot) || !file.endsWith(".js") || !JSX_IN_JS.test(code)) {
+        return null;
+      }
+      const transformed = await transformWithOxc(code, id, {
+        lang: "jsx",
+        jsx: { runtime: "automatic", development: !isProduction },
+      });
+      return { code: transformed.code, map: transformed.map };
+    },
+  };
+}
+
+function normalizeSlashes(value) {
+  return value.replace(/\\/gu, "/");
+}
+
 function serverLifetimePlugin() {
   return {
     name: "cad-viewer-server-lifetime",
@@ -216,6 +259,7 @@ export default defineConfig(async ({ command }) => ({
   root: viewerAppRoot,
   envPrefix: "VIEWER_",
   plugins: [
+    jsxInJsPlugin(),
     react(),
     serverLifetimePlugin(),
   ],
@@ -230,39 +274,34 @@ export default defineConfig(async ({ command }) => ({
       "three/examples": path.join(viewerNodeModulesRoot, "three", "examples"),
     },
   },
-  esbuild: {
-    loader: "jsx",
-    include: /.*\.[jt]sx?$/,
-    exclude: [],
-  },
   optimizeDeps: {
-    esbuildOptions: {
-      loader: {
+    // The dependency optimizer is Rolldown now; module types replace esbuild's
+    // loaders (`optimizeDeps.esbuildOptions.loader`).
+    rolldownOptions: {
+      moduleTypes: {
         ".js": "jsx",
       },
     },
   },
   build: {
     chunkSizeWarningLimit: 800,
-    rollupOptions: {
+    // `build.rollupOptions` is Rolldown's `build.rolldownOptions` in Vite 8.
+    rolldownOptions: {
       output: {
-        manualChunks(id) {
-          if (!id.includes("node_modules")) {
-            return undefined;
-          }
-          if (id.includes("/three/")) {
-            return "vendor-three";
-          }
-          if (id.includes("/react/") || id.includes("/react-dom/")) {
-            return "vendor-react";
-          }
-          if (id.includes("/radix-ui/") || id.includes("/@radix-ui/")) {
-            return "vendor-ui";
-          }
-          if (id.includes("/lucide-react/")) {
-            return "vendor-icons";
-          }
-          return undefined;
+        // Rolldown removed the object form of `output.manualChunks` and
+        // deprecated the function form; `codeSplitting.groups` is the
+        // replacement. Same four vendor chunks, matched against the module id
+        // in declaration order ([\\/] rather than / so a Windows build groups
+        // them too). A group also captures what its modules import, so the
+        // packages these depend on (react's scheduler, three's addons) travel
+        // with them instead of landing in the entry chunk.
+        codeSplitting: {
+          groups: [
+            { name: "vendor-three", test: /[\\/]node_modules[\\/]three[\\/]/ },
+            { name: "vendor-react", test: /[\\/]node_modules[\\/]react(?:-dom)?[\\/]/ },
+            { name: "vendor-ui", test: /[\\/]node_modules[\\/]@?radix-ui[\\/]/ },
+            { name: "vendor-icons", test: /[\\/]node_modules[\\/]lucide-react[\\/]/ },
+          ],
         },
       },
     },
```

---

### Incident Patch 11: `e1e5e6cb` (2026-09-16)
**Commit Message**: build(deps): land this week's green dependabot bumps in one PR (#396)

Combines the three open minor/patch dependabot groups (#393, #394, #395), following #367:

- packages/cadgen-js: three 0.185.1 -> 0.186.0, three-mesh-bvh 0.9.14 -> 0.9.15, playwright ^1.52 -> ^1.63.
- apps/viewer: lucide-react ^1.39 -> ^1.45, tailwind-merge ^3.6 -> ^3.7, @babel/parser and @babel/traverse ^8.0.4 -> ^8.0.5.
- apps/docs: 11-package minor/patch group (next 16.3.5, react 19.3.0, eslint-config-next, three ^0.186.0, @types/three, lucide-react, tailwind-merge, shadcn and others).

apps/viewer pins three at exactly 0.186.0 to match cadgen-js and docs (one copy of each shared primitive); every tree resolves a single three and three-mesh-bvh. apps/docs/next-env.d.ts gained the root-params.d.ts import Next 16.3.5 writes.

Not included: #381 and #383 (vite 8 / react 19 migrations, see #401) and #382 (ESLint 10, blocked upstream).

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01PZLP5p8ta3SJ3kqnntEuF7

**File**: `apps/docs/next-env.d.ts` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 /// <reference types="next" />
 /// <reference types="next/image-types/global" />
 import "./.next/types/routes.d.ts";
+import "./.next/types/root-params.d.ts";
 
 // NOTE: This file should not be edited
 // see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

**File**: `apps/docs/package-lock.json` (modified, +102/-90)
```diff
@@ -12,25 +12,25 @@
         "@vercel/analytics": "^2.0.1",
         "class-variance-authority": "^0.7.1",
         "clsx": "^2.1.1",
-        "lucide-react": "^1.39.0",
+        "lucide-react": "^1.45.0",
         "meshoptimizer": "^1.2.0",
-        "next": "16.3.4",
+        "next": "16.3.5",
         "radix-ui": "^1.6.7",
-        "react": "19.2.8",
-        "react-dom": "19.2.8",
-        "shadcn": "^4.19.1",
-        "tailwind-merge": "^3.6.0",
-        "three": "^0.185.1",
+        "react": "19.3.0",
+        "react-dom": "19.3.0",
+        "shadcn": "^4.21.0",
+        "tailwind-merge": "^3.7.0",
+        "three": "^0.186.0",
         "tw-animate-css": "^1.4.0"
       },
       "devDependencies": {
         "@tailwindcss/postcss": "^4",
         "@types/node": "^20",
         "@types/react": "^19",
         "@types/react-dom": "^19",
-        "@types/three": "^0.185.4",
+        "@types/three": "^0.186.0",
         "eslint": "^9",
-        "eslint-config-next": "16.3.4",
+        "eslint-config-next": "16.3.5",
         "tailwindcss": "^4",
         "typescript": "^5"
       }
@@ -1621,15 +1621,15 @@
       }
     },
     "node_modules/@next/env": {
-      "version": "16.3.4",
-      "resolved": "https://registry.npmjs.org/@next/env/-/env-16.3.4.tgz",
-      "integrity": "sha512-cjWZnUUa6jZq2kFaNe/ZyJdZonOZ/QoN0Zka2nz/FLOrfx14pQuM9c5RaSVkWMqgdt4ksgPAMWPyHSs/CyV48Q==",
+      "version": "16.3.5",
+      "resolved": "https://registry.npmjs.org/@next/env/-/env-16.3.5.tgz",
+      "integrity": "sha512-NWEXVDMqoEo0ktmU6u0sE2Vg0LOcsD7NnOTJNo3/fEaTfsg+F1bMIxuDmQbda4e3yTIQwVdUREF2yIuMOusKtg==",
       "license": "MIT"
     },
     "node_modules/@next/eslint-plugin-next": {
-      "version": "16.3.4",
-      "resolved": "https://registry.npmjs.org/@next/eslint-plugin-next/-/eslint-plugin-next-16.3.4.tgz",
-      "integrity": "sha512-szW9y2Aumu4z88YXfTzcFsgUAg2k64uzbtcO5L9f1AKS4w/GUKJcbFllRflROVyNPgJtGOnvNxiyp3v6b+prIA==",
+      "version": "16.3.5",
+      "resolved": "https://registry.npmjs.org/@next/eslint-plugin-next/-/eslint-plugin-next-16.3.5.tgz",
+      "integrity": "sha512-PGfSeItHJ12DH8t+6sEbuMe59NE5rAhCfgk06QKTH2ne9VUL1JlaXdYXY3B8RaiF2SO50rDYvd39TulP6A6xZQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -1638,9 +1638,9 @@
       }
     },
     "node_modules/@next/swc-darwin-arm64": {
-      "version": "16.3.4",
-      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.3.4.tgz",
-      "integrity": "sha512-iBr3I5LZNk5/bgl5//iTgD2tcym14MX0Xo7fD//u9dYAEgGzza1y9oywluPtf74YnOswVdH1908aK9xVz7zQTw==",
+      "version": "16.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.3.5.tgz",
+      "integrity": "sha512-pMmGgETfKvElucLHtVaeiMRbp2zUbvKx7b1yGko0liBz3cw1mKSggWN/Rp/wPz8z+E1O82u3r4L1Co+ZS5hokQ==",
       "cpu": [
         "arm64"
       ],
@@ -1654,9 +1654,9 @@
       }
     },
     "node_modules/@next/swc-darwin-x64": {
-      "version": "16.3.4",
-      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.3.4.tgz",
-      "integrity": "sha512-2dpiSyl2Jw/NrBPaU2MAKGSa+2MR82pJIn4Sm5Rjr+gxAeuh0z158Su3Z2O8zn7UNNq+ej4bToed6RcRN/Lydg==",
+      "version": "16.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.3.5.tgz",
+      "integrity": "sha512-76VaGYvf6HPa5/w12yLkE3dXTn9AfdEviI79oEL3aZoAmRLc9rWitjWqyjViVysK/ht/y9YKzFkBrUdi/wGkow==",
       "cpu": [
         "x64"
       ],
@@ -1670,9 +1670,9 @@
       }
     },
     "node_modules/@next/swc-linux-arm64-gnu": {
-      "version": "16.3.4",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.3.4.tgz",
-      "integrity": "sha512-+t+U8HZT+fApePCS5h89CSH3datz29MkzyfCn+6fpsZBG/oiEOhINcb9rtkv6sdpToLGFn2e6146NzaKCXkqrA==",
+      "version": "16.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.3.5.tgz",
+      "integrity": "sha512-zKDELJ5jSQMHeO/hmXUQsAzagX4bQD4OiMi3pQ5FbUj+yK506oLVHnKA2YXMlbg1EHHqJYtyePOgByIDXD1lqw==",
       "cpu": [
         "arm64"
       ],
@@ -1689,9 +1689,9 @@
       }
     },
     "node_modules/@next/swc-linux-arm64-musl": {
-      "version": "16.3.4",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.3.4.tgz",
-      "integrity": "sha512-mx03GNs1ocQA5JQ4FxDMmIsNkdrZh8cuezKCrId28e5/gIPU/l7Kcy2+vmCCzdjnnmXJy+iOAu+7K0QppO6Urg==",
+      "version": "16.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.3.5.tgz",
+      "integrity": "sha512-7Vql0pgzCoHagv6+FNOZoqmJqA52c6zeVbhtS/47qFozO1MSx4ms7x7GHiciY8R5CDsSMKMQjJEryoJLcsBIbA==",
       "cpu": [
         "arm64"
       ],
@@ -1708,9 +1708,9 @@
       }
     },
     "node_modules/@next/swc-linux-x64-gnu": {
-      "version": "16.3.4",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux
```

**File**: `apps/docs/package.json` (modified, +9/-9)
```diff
@@ -18,15 +18,15 @@
     "@vercel/analytics": "^2.0.1",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
-    "lucide-react": "^1.39.0",
+    "lucide-react": "^1.45.0",
     "meshoptimizer": "^1.2.0",
-    "next": "16.3.4",
+    "next": "16.3.5",
     "radix-ui": "^1.6.7",
-    "react": "19.2.8",
-    "react-dom": "19.2.8",
-    "shadcn": "^4.19.1",
-    "tailwind-merge": "^3.6.0",
-    "three": "^0.185.1",
+    "react": "19.3.0",
+    "react-dom": "19.3.0",
+    "shadcn": "^4.21.0",
+    "tailwind-merge": "^3.7.0",
+    "three": "^0.186.0",
     "tw-animate-css": "^1.4.0"
   },
   "overrides": {
@@ -37,9 +37,9 @@
     "@types/node": "^20",
     "@types/react": "^19",
     "@types/react-dom": "^19",
-    "@types/three": "^0.185.4",
+    "@types/three": "^0.186.0",
     "eslint": "^9",
-    "eslint-config-next": "16.3.4",
+    "eslint-config-next": "16.3.5",
     "tailwindcss": "^4",
     "typescript": "^5"
   }
```

**File**: `apps/viewer/package-lock.json` (modified, +54/-55)
```diff
@@ -11,17 +11,17 @@
         "cadgen-js": "file:../../packages/cadgen-js",
         "class-variance-authority": "^0.7.1",
         "clsx": "^2.1.1",
-        "lucide-react": "^1.39.0",
+        "lucide-react": "^1.45.0",
         "meshoptimizer": "^1.2.0",
         "radix-ui": "^1.6.7",
         "react": "18.3.1",
         "react-dom": "18.3.1",
-        "tailwind-merge": "^3.6.0",
-        "three": "0.185.1"
+        "tailwind-merge": "^3.7.0",
+        "three": "0.186.0"
       },
       "devDependencies": {
-        "@babel/parser": "^8.0.4",
-        "@babel/traverse": "^8.0.4",
+        "@babel/parser": "^8.0.5",
+        "@babel/traverse": "^8.0.5",
         "@tailwindcss/postcss": "^4.3.3",
         "@vitejs/plugin-react": "^4.7.0",
         "pngjs": "^7.0.0",
@@ -34,11 +34,11 @@
       "version": "0.6.1",
       "dependencies": {
         "meshoptimizer": "^1.2.0",
-        "three": "0.185.1",
-        "three-mesh-bvh": "0.9.14"
+        "three": "0.186.0",
+        "three-mesh-bvh": "0.9.15"
       },
       "devDependencies": {
-        "playwright": "^1.52.0"
+        "playwright": "^1.63.0"
       }
     },
     "node_modules/@alloc/quick-lru": {
@@ -392,13 +392,13 @@
       }
     },
     "node_modules/@babel/parser": {
-      "version": "8.0.4",
-      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-8.0.4.tgz",
-      "integrity": "sha512-srpptsAkEbbNIC/q8nT7o+m6CQe8CJUTV/t7MYc9NnWlgYVtHOb7JH6SorxMhN0kuRJjVqXbKClG6xSbPtzz+g==",
+      "version": "8.0.5",
+      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-8.0.5.tgz",
+      "integrity": "sha512-51RXvQNFakaS0bTpYiGkxNbUVwkPO4kONv6EVLorZABxsx+KZ6Z7uSYvi/wmKS/+X+rfj9RvOw0/ZNh+cmI0Rw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@babel/types": "^8.0.4"
+        "@babel/types": "^8.0.5"
       },
       "bin": {
         "parser": "bin/babel-parser.js"
@@ -428,9 +428,9 @@
       }
     },
     "node_modules/@babel/parser/node_modules/@babel/types": {
-      "version": "8.0.4",
-      "resolved": "https://registry.npmjs.org/@babel/types/-/types-8.0.4.tgz",
-      "integrity": "sha512-eY+Yn3dCqTGmyiq2QRU66lA5FL8lqqqvecHt0fF3uHONIa7ToYsaCiWV8lOKqAs0Rb2SjixiKFROngnulPtt2g==",
+      "version": "8.0.5",
+      "resolved": "https://registry.npmjs.org/@babel/types/-/types-8.0.5.tgz",
+      "integrity": "sha512-eVdMqi3ej5aHhyQ2Si6yD2cAWeV8FJK9UrhK5aL0Sd8hu5GhT+YswhVNbVheOGVYMg8kuGuMaUpkB3stjj4z8A==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -505,18 +505,18 @@
       }
     },
     "node_modules/@babel/traverse": {
-      "version": "8.0.4",
-      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-8.0.4.tgz",
-      "integrity": "sha512-bZnmqzGG8UZneG1lLxBoWIH0G6Gr1D846Yu4/3XnY6FhCndMR49u26nTY08u/dAxWmLWF9vGQOuC+84FfIUoeg==",
+      "version": "8.0.5",
+      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-8.0.5.tgz",
+      "integrity": "sha512-XFfnuvapSc/vJOcUO7kwORSvpBIvraofKEZ2dhT0PjiF21BRCD7YbAFC8UEeDJNeLoQz82/gVqzgX5hCzkCbdg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@babel/code-frame": "^8.0.0",
-        "@babel/generator": "^8.0.0",
+        "@babel/generator": "^8.0.5",
         "@babel/helper-globals": "^8.0.0",
-        "@babel/parser": "^8.0.4",
+        "@babel/parser": "^8.0.5",
         "@babel/template": "^8.0.0",
-        "@babel/types": "^8.0.4",
+        "@babel/types": "^8.0.5",
         "obug": "^2.1.1"
       },
       "engines": {
@@ -538,16 +538,16 @@
       }
     },
     "node_modules/@babel/traverse/node_modules/@babel/generator": {
-      "version": "8.0.0",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-8.0.0.tgz",
-      "integrity": "sha512-NT9NrVwJsbSV6Y2FSstWa71EETOnzrjkL5/wX3D2mYHtKM+qvqB1DvR4D0Setb/gDBsHzRICifwEWMO8CnTF6g==",
+      "version": "8.0.5",
+      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-8.0.5.tgz",
+      "integrity": "sha512-f/TuhuMAxJqhwxEGNsJrswuG9VHmh0oNFoQoo6TbpgtFAz9wYZXcTAcWZMHfp7ljesr0RG04bp3Aos9GI59L7w==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@babel/parser": "^8.0.0",
-        "@babel/types": "^8.0.0",
-        "@jridgewell/gen-mapping": "^0.3.12",
-        "@jridgewell/trace-mapping": "^0.3.28",
+        "@babel/parser": "^8.0.5",
+        "@babel/types": "^8.0.5",
+        "@jridgewell/gen-mapping": "0.4.0-beta.0",
+        "@jridgewell/trace-mapping": "^0.3.31",
         "@types/jsesc": "^2.5.0",
         "jsesc": "^3.0.2"
       },
@@ -591,9 +591,9 @@
       }
     },
     "node_modules/@babel/traverse/node_modules/@babel/types": {
-      "version": "8.0.4",
-      "resolved": "https://registry.npmjs.org/@babel/types/-/types-8.0.4.tgz",
-      "integrity": "sha512-eY+Yn3dCqTGmyiq2QRU66lA5FL8lqqqvecHt0fF3uHONIa7ToYsaCiWV8lOKqAs0Rb2SjixiKFROngnulPtt2g==",
+      "version": "8.0.5",
+      "resolved": "https://registry.npmjs
```

**File**: `apps/viewer/package.json` (modified, +5/-5)
```diff
@@ -12,17 +12,17 @@
     "cadgen-js": "file:../../packages/cadgen-js",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
-    "lucide-react": "^1.39.0",
+    "lucide-react": "^1.45.0",
     "meshoptimizer": "^1.2.0",
     "radix-ui": "^1.6.7",
     "react": "18.3.1",
     "react-dom": "18.3.1",
-    "tailwind-merge": "^3.6.0",
-    "three": "0.185.1"
+    "tailwind-merge": "^3.7.0",
+    "three": "0.186.0"
   },
   "devDependencies": {
-    "@babel/parser": "^8.0.4",
-    "@babel/traverse": "^8.0.4",
+    "@babel/parser": "^8.0.5",
+    "@babel/traverse": "^8.0.5",
     "@tailwindcss/postcss": "^4.3.3",
     "@vitejs/plugin-react": "^4.7.0",
     "pngjs": "^7.0.0",
```

**File**: `packages/cadgen-js/package-lock.json` (modified, +16/-34)
```diff
@@ -9,26 +9,11 @@
       "version": "0.6.1",
       "dependencies": {
         "meshoptimizer": "^1.2.0",
-        "three": "0.185.1",
-        "three-mesh-bvh": "0.9.14"
+        "three": "0.186.0",
+        "three-mesh-bvh": "0.9.15"
       },
       "devDependencies": {
-        "playwright": "^1.52.0"
-      }
-    },
-    "node_modules/fsevents": {
-      "version": "2.3.2",
-      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.2.tgz",
-      "integrity": "sha512-xiqMQR4xAeHTuB9uWm+fFRcIOgKBMiOBP+eXiyT7jsgVCq1bkVygt00oASowB7EdtpOHaaPgKt812P9ab+DDKA==",
-      "dev": true,
-      "hasInstallScript": true,
-      "license": "MIT",
-      "optional": true,
-      "os": [
-        "darwin"
-      ],
-      "engines": {
-        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
+        "playwright": "^1.63.0"
       }
     },
     "node_modules/meshoptimizer": {
@@ -38,28 +23,25 @@
       "license": "MIT"
     },
     "node_modules/playwright": {
-      "version": "1.62.1",
-      "resolved": "https://registry.npmjs.org/playwright/-/playwright-1.62.1.tgz",
-      "integrity": "sha512-0M+L3LAD8/nm554LOla9Ayx0j0tmFZ0FBcoQ7F1VuVHpM/XpiC8RcDzBQB8W5+hA8L22THxELzeF+2WcUzvcLg==",
+      "version": "1.63.0",
+      "resolved": "https://registry.npmjs.org/playwright/-/playwright-1.63.0.tgz",
+      "integrity": "sha512-+7ziBLidS4NaNCdt57SUDT+wYmmd5fmiQejUic/kb+YsYSCPyOOE9sebzMjNmQrsnNpDJqd4WHvV/8lfKfUDUg==",
       "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
-        "playwright-core": "1.62.1"
+        "playwright-core": "1.63.0"
       },
       "bin": {
         "playwright": "cli.js"
       },
       "engines": {
         "node": ">=20"
-      },
-      "optionalDependencies": {
-        "fsevents": "2.3.2"
       }
     },
     "node_modules/playwright-core": {
-      "version": "1.62.1",
-      "resolved": "https://registry.npmjs.org/playwright-core/-/playwright-core-1.62.1.tgz",
-      "integrity": "sha512-wPYSwEBJY9GHraISXqyqtx0na0LpO3XEX7jNDhntbex7tzUS7kLnZsOlFruFJB4Hi/rhDMjXGqHewDZ68nYZVw==",
+      "version": "1.63.0",
+      "resolved": "https://registry.npmjs.org/playwright-core/-/playwright-core-1.63.0.tgz",
+      "integrity": "sha512-rYCsBF/M5HjUch52bbtVONEFjv6Xu8sm8h72dNlR5bzIE1fvC/bxgspzkjSfU+MweEMmPM8KJebG6nnyxo5mCg==",
       "dev": true,
       "license": "Apache-2.0",
       "bin": {
@@ -70,15 +52,15 @@
       }
     },
     "node_modules/three": {
-      "version": "0.185.1",
-      "resolved": "https://registry.npmjs.org/three/-/three-0.185.1.tgz",
-      "integrity": "sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg==",
+      "version": "0.186.0",
+      "resolved": "https://registry.npmjs.org/three/-/three-0.186.0.tgz",
+      "integrity": "sha512-cr/fIM2ddMSVbYVgkfD4jLJv7Fh/8ZTjvo+7gQeSVGUZHxpx9FDwoL5iC7hUz/LiRA8wMbqfnb90xKfm1/HHkQ==",
       "license": "MIT"
     },
     "node_modules/three-mesh-bvh": {
-      "version": "0.9.14",
-      "resolved": "https://registry.npmjs.org/three-mesh-bvh/-/three-mesh-bvh-0.9.14.tgz",
-      "integrity": "sha512-xJzfUXnLYjgw5tRKGxjfJW3Pcx0IbwNskvpdwRryhK07SYrKrYB4W8zAaPxu784gK7G4lCBgG+vfG3YeYn95kg==",
+      "version": "0.9.15",
+      "resolved": "https://registry.npmjs.org/three-mesh-bvh/-/three-mesh-bvh-0.9.15.tgz",
+      "integrity": "sha512-9xdEDkCzFoT8VPFH9DznwFSdbaIEjMvM106Iqq7TJurrIheUKDcdW4prfJTCxryih4XS/UxWs0H3K4MLMRFyOQ==",
       "license": "MIT",
       "peerDependencies": {
         "three": ">= 0.159.0"
```

**File**: `packages/cadgen-js/package.json` (modified, +3/-3)
```diff
@@ -19,10 +19,10 @@
   ],
   "dependencies": {
     "meshoptimizer": "^1.2.0",
-    "three": "0.185.1",
-    "three-mesh-bvh": "0.9.14"
+    "three": "0.186.0",
+    "three-mesh-bvh": "0.9.15"
   },
   "devDependencies": {
-    "playwright": "^1.52.0"
+    "playwright": "^1.63.0"
   }
 }
```

---

### Incident Patch 12: `974b4427` (2026-09-16)
**Commit Message**: Three read-only test fixtures are built once per class (#408)

Follow-up to #399's test audit: test_generated_step_fidelity, test_step_export_target and test_mesh_export_store_reuse rebuilt the same document in every test and then only read it. Each now builds once in setUpClass and copies the script, the document and the store beside each test's own isolated roots (ClassCadRoots in tests/python/support/cad_test_roots.py). No test removed; 14 tests across the three files.

Per-file cost before, Linux / Windows CI: 14 / 63 s, 16 / 41 s, 31 / 72 s. Locally after: 6 s, 7 s, 16 s.

**File**: `tests/python/packages/cadgen/test_generated_step_fidelity.py` (modified, +34/-12)
```diff
@@ -25,7 +25,7 @@
 from cadgen import step_artifact_cli  # noqa: E402
 from cadgen._internal.step_assemble import assemble_step_from_package  # noqa: E402
 from cadgen.catalog import result_view_dir  # noqa: E402
-from tests.python.support.cad_test_roots import IsolatedCadRoots  # noqa: E402
+from tests.python.support.cad_test_roots import ClassCadRoots, IsolatedCadRoots  # noqa: E402
 
 # Two occurrences of DISTINCT parts with per-occurrence colors and a
 # kinematics block — the planetary pilot's shape of metadata, minimized.
@@ -56,26 +56,46 @@ def model():
 
 
 class GeneratedStepFidelityTests(unittest.TestCase):
+    # The generated package is built ONCE for the class: every test reads it (or
+    # assembles and imports a COPY into its own store), none rebuilds it.
+    @classmethod
+    def setUpClass(cls) -> None:
+        super().setUpClass()
+        cls._class_roots = ClassCadRoots(prefix="cadfid-seed-")
+        cls._seed_dir = cls._class_roots.cad_root / "seed"
+        cls._seed_dir.mkdir()
+        generator = cls._seed_dir / "colored.py"
+        generator.write_text(COLORED_ASSEMBLY_GENERATOR, encoding="utf-8")
+        payload = step_artifact_cli.build_step_artifact(
+            repo_root=Path.cwd(),
+            step=cls._seed_dir / "colored.step",
+            source_path=generator,
+        )
+        if not payload.get("ok"):
+            raise RuntimeError(f"the seed package could not be built: {payload}")
+
+    @classmethod
+    def tearDownClass(cls) -> None:
+        cls._class_roots.cleanup()
+        super().tearDownClass()
+
     def setUp(self) -> None:
         self._isolated_roots = IsolatedCadRoots(self, prefix="cadfid-")
         self._tempdir = self._isolated_roots.temporary_cad_directory(prefix="tmp-cadfid-")
         self.temp_root = Path(self._tempdir.name)
+        self._class_roots.copy_store_into(self._isolated_roots)
 
     def tearDown(self) -> None:
         shutil.rmtree(self.temp_root, ignore_errors=True)
         self._tempdir.cleanup()
 
     def _build_generated_package(self) -> tuple[Path, Path]:
-        generator = self.temp_root / "colored.py"
-        generator.write_text(COLORED_ASSEMBLY_GENERATOR, encoding="utf-8")
-        logical_step = self.temp_root / "colored.step"
-        payload = step_artifact_cli.build_step_artifact(
-            repo_root=Path.cwd(),
-            step=logical_step,
-            source_path=generator,
-        )
-        self.assertTrue(payload.get("ok"), payload)
-        return generator, logical_step
+        """The seed build's script, document and sidecar, copied beside this test's store."""
+        for name in ("colored.py", "colored.step", "colored.step.json"):
+            source = self._seed_dir / name
+            if source.is_file():
+                shutil.copyfile(source, self.temp_root / name)
+        return self.temp_root / "colored.py", self.temp_root / "colored.step"
 
     def _descriptor(self, step_path: Path) -> dict:
         return json.loads(
@@ -108,7 +128,9 @@ def test_generated_descriptor_records_occurrence_colors_and_pose(self) -> None:
         self.assertNotIn("sourcePath", sidecar)
         from cadgen._internal.source_sidecar import read_source_provenance
 
-        provenance = read_source_provenance(logical_step) or {}
+        # Provenance is the model RECORD behind the document, keyed by the path the
+        # model wrote; the copied store carries it under the seed's path.
+        provenance = read_source_provenance(self._seed_dir / "colored.step") or {}
         self.assertEqual(provenance.get("sourceKind"), "python")
 
     def test_assembled_step_carries_occurrence_colors_and_no_cadgen_metadata(self) -> None:
```

**File**: `tests/python/packages/cadgen/test_mesh_export_store_reuse.py` (modified, +29/-5)
```diff
@@ -16,6 +16,7 @@
 from __future__ import annotations
 
 import os
+import shutil
 import subprocess
 import sys
 import tempfile
@@ -52,10 +53,38 @@ def model():
 
 
 class MeshExportStoreReuseTest(unittest.TestCase):
+    # block.py is built cold ONCE for the class; each test gets a copy of the
+    # project (script, document, store) and drives the doors against that copy.
+    @classmethod
+    def setUpClass(cls) -> None:
+        super().setUpClass()
+        cls._seed_tmp = tempfile.TemporaryDirectory(prefix="mesh-export-store-seed-")
+        cls._seed_root = Path(cls._seed_tmp.name).resolve()
+        entry = _write_model(cls._seed_root, size=6.0)
+        env = dict(os.environ)
+        env.update({
+            "CADGEN_DAEMON": "0",
+            "CADGEN_COMPONENT_WORKERS": "1",
+            "CADGEN_CACHE_DIR": str(cls._seed_root / "store"),
+            "PYTHONPATH": str(REPO / "packages/cadgen/src"),
+        })
+        build = subprocess.run(
+            [PYTHON, entry.name], cwd=str(cls._seed_root), env=env,
+            capture_output=True, text=True, timeout=600,
+        )
+        if build.returncode != 0 or not (cls._seed_root / "block.step").is_file():
+            raise RuntimeError(f"the seed build failed:\n{build.stdout}{build.stderr}")
+
+    @classmethod
+    def tearDownClass(cls) -> None:
+        cls._seed_tmp.cleanup()
+        super().tearDownClass()
+
     def setUp(self) -> None:
         self._tmp = tempfile.TemporaryDirectory(prefix="mesh-export-store-")
         self.addCleanup(self._tmp.cleanup)
         self.root = Path(self._tmp.name).resolve()
+        shutil.copytree(self._seed_root, self.root, dirs_exist_ok=True)
         self.store = self.root / "store"
         self.env = dict(os.environ)
         self.env.update({
@@ -95,9 +124,6 @@ def _package_dirs(self) -> set[str]:
         return {p.name for p in records.iterdir() if p.is_file()}
 
     def test_a_generated_document_exports_current_and_after_source_edit(self) -> None:
-        entry = _write_model(self.root, size=6.0)
-        build = self._run([entry.name], self.root)
-        self.assertEqual(build.returncode, 0, build.stdout + build.stderr)
         step_file = self.root / "block.step"
         self.assertTrue(step_file.is_file(), "model script writes its STEP")
 
@@ -131,8 +157,6 @@ def test_a_generated_document_exports_current_and_after_source_edit(self) -> Non
     def test_an_imported_document_writes_defaults_then_reuses_one_compilation(self) -> None:
         # A door reads no declarations: a bare door tessellates the document's
         # tree and writes ONE mesh beside it — imported or generated alike.
-        entry = _write_model(self.root, size=6.0)
-        self.assertEqual(0, self._run([entry.name], self.root).returncode)
         imported = self.root / "imported_block.step"
         imported.write_bytes((self.root / "block.step").read_bytes() + b"\n")
         self.assertFalse(imported.with_suffix(".step.json").exists(), "an import has no sidecar")
```

**File**: `tests/python/packages/cadgen/test_step_export_target.py` (modified, +36/-15)
```diff
@@ -16,7 +16,7 @@
 
 from cadgen import render as cad_render  # noqa: E402
 from cadgen import step_export_target  # noqa: E402
-from tests.python.support.cad_test_roots import IsolatedCadRoots  # noqa: E402
+from tests.python.support.cad_test_roots import ClassCadRoots, IsolatedCadRoots  # noqa: E402
 
 # A tiny generated model: model() returns a single labeled solid.
 BOX_GENERATOR = """from build123d import Box
@@ -43,12 +43,43 @@ def model():
 
 
 class StepExportTargetTests(unittest.TestCase):
+    # box.step (and its re-export, box_document.step) are built ONCE for the
+    # class: every test reads them through the export ABI and rebuilds nothing.
+    @classmethod
+    def setUpClass(cls) -> None:
+        from cadgen.generation import generate_step_targets
+
+        super().setUpClass()
+        cls._class_roots = ClassCadRoots(prefix="cadexp-seed-")
+        cls._seed_dir = cls._class_roots.cad_root / "seed"
+        cls._seed_dir.mkdir()
+        generator = cls._seed_dir / "box.py"
+        generator.write_text(BOX_GENERATOR, encoding="utf-8")
+        if generate_step_targets([str(generator)]) != 0 or not (cls._seed_dir / "box.step").is_file():
+            raise RuntimeError("the model script wrote no box.step")
+        buffer = StringIO()
+        with redirect_stdout(buffer):
+            code = step_export_target.main([
+                "--repo-root", str(Path.cwd()),
+                "--step", str(cls._seed_dir / "box.step"),
+                "--format", "step",
+                "--out", str(cls._seed_dir / "box_document.step"),
+            ])
+        if code != 0:
+            raise RuntimeError(f"the seed re-export failed: {buffer.getvalue()}")
+
+    @classmethod
+    def tearDownClass(cls) -> None:
+        cls._class_roots.cleanup()
+        super().tearDownClass()
+
     def setUp(self) -> None:
         self._isolated_roots = IsolatedCadRoots(self, prefix="cadexp-")
         self._tempdir = self._isolated_roots.temporary_cad_directory(prefix="tmp-cadexp-")
         self.temp_root = Path(self._tempdir.name)
         self.out_dir = self.temp_root / "out"
         self.out_dir.mkdir(parents=True, exist_ok=True)
+        self._class_roots.copy_store_into(self._isolated_roots)
 
     def tearDown(self) -> None:
         shutil.rmtree(self.temp_root, ignore_errors=True)
@@ -77,13 +108,10 @@ def _write_box_generator(self) -> Path:
 
     def _build_box_document(self) -> Path:
         """``box.step``, written the ONE way a document is written: by running
-        the model script. The export ABI takes documents and nothing else."""
-        from cadgen.generation import generate_step_targets
-
-        generator = self._write_box_generator()
-        self.assertEqual(0, generate_step_targets([str(generator)]))
+        the model script (once, in setUpClass). The export ABI takes documents
+        and nothing else."""
         document = self.temp_root / "box.step"
-        self.assertTrue(document.is_file(), "the model script wrote no box.step")
+        shutil.copyfile(self._seed_dir / "box.step", document)
         return document
 
     def test_the_export_abi_takes_documents_only(self) -> None:
@@ -141,15 +169,8 @@ def _write_box_document(self) -> Path:
         DOCUMENTS-ONLY: `export_cad_target` is the engine behind
         `cadgen stl|3mf|glb build`, which never sees a script.
         """
-        built = self._build_box_document()
         document = self.temp_root / "box_document.step"
-        code, payload = self._run([
-            "--repo-root", str(Path.cwd()),
-            "--step", str(built),
-            "--format", "step",
-            "--out", str(document),
-        ])
-        self.assertEqual(code, 0, payload)
+        shutil.copyfile(self._seed_dir / "box_document.step", document)
         return document
 
     def test_export_cad_target_rejects_step_format(self) -> None:
```

**File**: `tests/python/support/cad_test_roots.py` (modified, +26/-0)
```diff
@@ -53,3 +53,29 @@ def restore_cache_dir() -> None:
 
     def temporary_cad_directory(self, *, prefix: str) -> tempfile.TemporaryDirectory[str]:
         return tempfile.TemporaryDirectory(prefix=prefix, dir=self.cad_root)
+
+
+class ClassCadRoots:
+    """:class:`IsolatedCadRoots` for a ``setUpClass``: one build, every test reads it.
+
+    A fixture that every test only READS is built once here, under the same cwd and
+    store isolation a test gets, with the cleanups held until ``tearDownClass``
+    (``IsolatedCadRoots`` registers them on a TestCase, so a bare one stands in).
+    Each test then gets its own :class:`IsolatedCadRoots` as before and
+    :meth:`copy_store_into` it: the store is content-addressed, so a document
+    copied beside it is served from the copied store exactly as from the one
+    that built it, and whatever a test then writes lands in its own copy.
+    """
+
+    def __init__(self, *, prefix: str) -> None:
+        self._case = unittest.TestCase()
+        self.roots = IsolatedCadRoots(self._case, prefix=prefix)
+        self.cad_root = self.roots.cad_root
+
+    def copy_store_into(self, roots: IsolatedCadRoots) -> None:
+        import shutil
+
+        shutil.copytree(self.roots.cache_dir, roots.cache_dir, dirs_exist_ok=True)
+
+    def cleanup(self) -> None:
+        self._case.doCleanups()
```

---

### Incident Patch 13: `d63edf2b` (2026-09-16)
**Commit Message**: Build the runtime bundles in CI, attach release assets, one CI job per concern, cold tests, audit cuts (#399)

`packages/cadgen/src/cadgen/_runtime/node/` and `_runtime/browser/` stop
being committed, exactly as `_runtime/viewer/` already was: the whole
`_runtime/` directory is gitignored, produced by
`scripts/bundle/bundle.sh`, and ships only inside the wheel. The wheel
is the release asset; no separate upload. Every rebundle was adding ~1.3
MB of `snapshot-render.js` to a commit whose reviewable change was the
cadgen-js source beside it — 10 MiB of history on one PR.

## What changed

**Untracked** — `git rm --cached` the seven files under `_runtime/node`
and `_runtime/browser`, and one `.gitignore` rule now covers all three
stages. `git ls-files packages/cadgen/src/cadgen/_runtime` is empty;
`pyproject.toml`'s `cadgen = ["py.typed", "*.pyi", "_runtime/**/*"]` is
untouched, so the wheel still carries them.

**`bundle.sh --check` redefined** — there is nothing committed to diff
against, so it now means *the runtime builds and every required output
exists*: it builds into the real `_runtime` like an ordinary run, then
asserts the files each stage owes (`NODE_OUTPUTS`, `BROWSER_OUTP

**File**: `.github/actions/setup-deps/action.yml` (modified, +32/-5)
```diff
@@ -1,12 +1,34 @@
 name: Set up dependencies
 description: >-
-  Set up Python and Node.js with dependency caching, then install the repo
-  Python and Node dependencies used by tests and production bundling.
+  Set up Python and Node.js with dependency caching, then install as much of the
+  repo's Python and Node dependencies as the calling job actually uses.
+
+# Every input defaults to the full install, so a job that asks for nothing gets
+# what this action always did. Jobs that need less say so: the test matrix runs
+# six ways, and three minutes of `npm ci` for an app a job never touches is three
+# minutes on the critical path of every one of them.
+inputs:
+  python:
+    description: Install the Python dependencies (requirements-dev.txt).
+    default: "true"
+  playwright:
+    description: >-
+      Install Playwright's Chromium. Only the snapshot suites render in it; skip
+      it in jobs that run no snapshot.
+    default: "true"
+  npm:
+    description: >-
+      Space-separated npm project prefixes to `npm ci`, or "none". Building
+      cadgen's packaged runtime needs `packages/cadgen-js`; the Viewer's client
+      build and its own suite need `apps/viewer`; only the docs check needs
+      `apps/docs`.
+    default: "packages/cadgen-js apps/viewer apps/docs"
 
 runs:
   using: composite
   steps:
     - name: Set up Python
+      if: inputs.python == 'true'
       uses: actions/setup-python@v5
       with:
         python-version: "3.12"
@@ -24,6 +46,7 @@ runs:
           apps/docs/package-lock.json
 
     - name: Install Python dependencies
+      if: inputs.python == 'true'
       shell: bash
       run: |
         python -m pip install --upgrade pip
@@ -33,6 +56,7 @@ runs:
     # happens to carry one; Windows does not, and a missing browser fails the
     # snapshot suites with "Executable doesn't exist". Install it on every OS.
     - name: Install the snapshot browser
+      if: inputs.playwright == 'true'
       shell: bash
       run: |
         if [ "$RUNNER_OS" = "Linux" ]; then
@@ -42,8 +66,11 @@ runs:
         fi
 
     - name: Install Node dependencies
+      if: inputs.npm != 'none'
       shell: bash
+      env:
+        NPM_PREFIXES: ${{ inputs.npm }}
       run: |
-        npm ci --prefix packages/cadgen-js
-        npm ci --prefix apps/viewer
-        npm ci --prefix apps/docs
+        for prefix in $NPM_PREFIXES; do
+          npm ci --prefix "$prefix"
+        done
```

**File**: `.github/workflows/release-publish.yml` (modified, +47/-5)
```diff
@@ -105,9 +105,10 @@ jobs:
         if: steps.gate.outputs.should_publish == 'true'
         uses: ./.github/actions/setup-deps
 
-      # The bundle feeds the WHEEL: cadgen's Node builders and snapshot bundle
-      # (committed, so --clean must reproduce them byte for byte) and the CAD Viewer
-      # client (gitignored, wheel-only). Nothing here writes to git.
+      # The bundle feeds the WHEEL, and it is the only thing that does: cadgen's Node
+      # builders, the snapshot browser bundle and the CAD Viewer client are all
+      # gitignored, so the release commit carries none of them. Nothing here writes to
+      # git -- the wheel is the release asset.
       - name: Bundle production outputs
         if: steps.gate.outputs.should_publish == 'true'
         run: scripts/bundle/bundle.sh --clean
@@ -165,6 +166,31 @@ jobs:
       # The distribution is kept whether or not it ships: a rehearsal's artifact is
       # what you inspect instead of a PyPI upload, and a main run's is the record of
       # exactly what was uploaded.
+      # The paranoid half of the same question check-wheel-contents.sh answers, asked of
+      # the wheel that actually ships rather than one rebuilt in scratch: the runtime is
+      # built minutes earlier by a step that could fail soft, and a wheel without it
+      # installs cleanly and then cannot render a snapshot or export a mesh.
+      - name: Assert the shipping wheel carries its built runtime
+        if: steps.gate.outputs.should_publish == 'true'
+        run: |
+          wheel="$(find packages/cadgen/dist -name '*.whl' -type f | head -n 1)"
+          [ -n "$wheel" ] || { echo "no wheel under packages/cadgen/dist" >&2; exit 1; }
+          listing="$(unzip -l "$wheel")"
+          echo "$listing" | grep -E 'cadgen/_runtime/' || true
+          for required in \
+            cadgen/_runtime/browser/snapshot-render.js \
+            cadgen/_runtime/browser/render.html \
+            cadgen/_runtime/node/mesh-export.mjs \
+            cadgen/_runtime/node/dxf-mesh.mjs \
+            cadgen/_runtime/viewer/index.html; do
+            if ! printf '%s\n' "$listing" | grep -qF " $required"; then
+              echo "$(basename "$wheel") does not contain $required" >&2
+              echo "scripts/bundle/bundle.sh produces it; [tool.setuptools.package-data] ships it." >&2
+              exit 1
+            fi
+          done
+          echo "$(basename "$wheel") carries its built runtime."
+
       - name: Upload the distribution as a workflow artifact
         if: steps.gate.outputs.should_publish == 'true'
         uses: actions/upload-artifact@v7
@@ -193,7 +219,9 @@ jobs:
           echo "Would have deployed the docs site from $GITHUB_SHA."
           # --dry-run computes the tag and the release it would create without
           # pushing anything; the version check inside it runs for real.
-          scripts/release/publish-github-release.sh --target HEAD --dry-run --publish
+          args=(--target HEAD --dry-run --publish)
+          for file in packages/cadgen/dist/*; do args+=(--asset "$file"); done
+          scripts/release/publish-github-release.sh "${args[@]}"
 
   # The docs site is built from the release commit itself: main is the source tree,
   # and apps/docs/package.json carries the stamped version the header reads.
@@ -236,8 +264,18 @@ jobs:
             echo "Using GITHUB_TOKEN for tag push."
           fi
 
+      # The distribution this run built and uploaded to PyPI, fetched back from the
+      # workflow artifact so the release page carries the same bytes -- not a
+      # rebuild, which could legally differ.
+      - name: Download the published distribution
+        uses: actions/download-artifact@v7
+        with:
+          name: cadgen-${{ needs.publish.outputs.version }}
+          path: packages/cadgen/dist
+
       # A push-triggered run has no `publish` input: it publishes. Only a manual
-      # dispatch can ask for a draft.
+      # dispatch can ask for a draft. The wheel and sdist are attached to the
+      # release; a resumed run attaches them to the release that already exists.
       - name: Create release tag and GitHub Release
         env:
           GH_TOKEN: ${{ github.token }}
@@ -247,4 +285,8 @@ jobs:
           if [ "${INPUT_PUBLISH:-true}" = "true" ]; then
             args+=(--publish)
           fi
+          ls -l packages/cadgen/dist
+          for file in packages/cadgen/dist/*.whl packages/cadgen/dist/*.tar.gz; do
+            [ -f "$file" ] && args+=(--asset "$file")
+          done
           scripts/release/publish-github-release.sh "${args[@]}"
```

**File**: `.github/workflows/test.yml` (modified, +243/-63)
```diff
@@ -1,3 +1,45 @@
+# The repo's test workflow: one job per thing that has to work, each conditional on
+# the changes that can break it. No gates, no shards. A job skipped by its own
+# condition satisfies its required check, so a prose-only pull request runs Version
+# Check and nothing else.
+#
+# WHAT CAN BREAK WHAT (the dependency graph the conditions encode)
+#   packages/cadgen     the Python engine, CLI doors, daemon and the CAD Viewer BACKEND.
+#                       Everything downstream runs it: the skills (thin entrypoints over
+#                       its CLIs), the viewer (served by cadgen.viewer), the docs site
+#                       (documents its commands), the wheel.
+#   packages/cadgen-js  bundled into the runtime cadgen executes (mesh exports,
+#                       snapshots), imported by the viewer client, and by the docs hero.
+#   apps/viewer         the client. Platform-agnostic JS; served by the backend.
+#   skills/             SKILL.md + scripts. Their suites run the cadgen CLIs; the docs
+#                       site mirrors their frontmatter.
+#   apps/docs           the docs site.
+#   scripts/, .github/, version metadata ("infra"): can break any job.
+#   Root *.md, notes/, models/, LICENSE ("prose"): read by no test. Markdown under
+#   skills/ and packages/cadgen/ is NOT prose -- test_documented_commands,
+#   test_skill_requirements and test_package_boundaries read it.
+#
+# WHAT RUNS WHERE
+#   Version Check     ubuntu   always: VERSION, derived metadata, skill pins
+#   cadgen (Linux)    ubuntu   the cadgen package suite, viewer backend included
+#   cadgen (Windows)  windows  the SAME suite. This is the one thing that must be
+#                              proven on Windows: paths, locks, subprocesses, file
+#                              URLs, the daemon, the viewer backend. Nothing else
+#                              runs there -- bundling, packaging, policy and the JS
+#                              suites are properties of the tree or of a browser,
+#                              not of an operating system.
+#   cadgen-js         ubuntu   cadgen-js unit tests (+ the viewer-memory bench helpers)
+#   viewer            ubuntu   the client's unit tests, then the bundled client
+#                              launched through the real backend
+#   skills            ubuntu   the policy gates (tests/python/global) + every skill suite
+#   docs              ubuntu   the docs site check
+#   packaging         ubuntu   bundle from clean, published-tree contract, wheel
+#                              package data, the CLIs pip-installed outside the repo
+#
+# Each job parallelises internally (unittest_files.py --jobs, node --test concurrency).
+# The packaged runtime is gitignored and built by whichever job needs it
+# (scripts/test/common.sh ensure_packaged_runtime, ~13 s).
+#
 name: Test
 
 on:
@@ -16,6 +58,52 @@ concurrency:
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 
 jobs:
+  # What changed, as the classes above. Every other job's `if:` reads these.
+  changes:
+    name: Changed paths
+    runs-on: ubuntu-latest
+    outputs:
+      cadgen: ${{ steps.filter.outputs.cadgen }}
+      cadgenjs: ${{ steps.filter.outputs.cadgenjs }}
+      viewer: ${{ steps.filter.outputs.viewer }}
+      skills: ${{ steps.filter.outputs.skills }}
+      docs: ${{ steps.filter.outputs.docs }}
+      infra: ${{ steps.filter.outputs.infra }}
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@v7
+
+      - uses: dorny/paths-filter@v3
+        id: filter
+        with:
+          filters: |
+            cadgen:
+              - 'packages/cadgen/**'
+              - 'tests/python/packages/**'
+              - 'tests/python/support/**'
+              - 'requirements*.txt'
+            cadgenjs:
+              - 'packages/cadgen-js/**'
+            viewer:
+              - 'apps/viewer/**'
+              - 'tests/browser/**'
+            skills:
+              - 'skills/**'
+              - 'tests/python/skills/**'
+              - 'tests/python/global/**'
+            docs:
+              - 'apps/docs/**'
+            infra:
+              - 'scripts/**'
+              - '.github/**'
+              - 'VERSION'
+              - '.claude-plugin/**'
+              - '.codex-plugin/**'
+              - 'package.json'
+              - 'package-lock.json'
+              - '.gitattributes'
+              - '.gitignore'
+
   version:
     name: Version Check
     runs-on: ubuntu-latest
@@ -61,11 +149,15 @@ jobs:
               ;;
           esac
 
-  test:
-    name: Test (Linux)
+  # The cadgen package suite, CAD Viewer backend included, on both platforms. cadgen-js
+  # is in the condition because it is bundled into the runtime these tests execute.
+  cadgen-linux:
+    name: cadgen (Linux)
+    needs: changes
+    if: needs.changes.outputs.cadgen == 'true' || needs.changes.outputs.cadgenjs == 'true' || needs.changes.outputs.infra == 'true'
    
```

**File**: `.gitignore` (modified, +6/-4)
```diff
@@ -74,10 +74,12 @@ models/**/*.mkv
 # `python -m build` scratch space (scripts/release/check-wheel-contents.sh).
 packages/cadgen/build/
 
-# The CAD Viewer client's place in the cadgen wheel. Written by
-# `scripts/bundle/bundle.sh` (the --viewer stage) right before `python -m build`;
-# never committed, because a checkout serves apps/viewer/dist directly.
-packages/cadgen/src/cadgen/_runtime/viewer/
+# cadgen's packaged runtime: the esbuilt Node builders (node/), the headless
+# snapshot bundle (browser/) and the CAD Viewer's built client (viewer/). All
+# three are BUILT by `scripts/bundle/bundle.sh` and shipped only inside the
+# wheel; none of them is committed. A fresh checkout has no _runtime until the
+# bundler runs, and cadgen says so by name when it needs one that is absent.
+packages/cadgen/src/cadgen/_runtime/
 
 # Design notes are local working files, never committed (user policy 2026-08-29).
 design/
```

**File**: `AGENTS.md` (modified, +49/-22)
```diff
@@ -23,7 +23,8 @@ any branch but `release/*`. Releases are two GitHub Actions workflows:
   Bundles, tests, builds the `cadgen` wheel, installs and exercises it, keeps
   the distribution as a workflow artifact, then — on `main` only — uploads to
   PyPI, deploys the docs site, and tags (`v<VERSION>`; releases before 0.5.0
-  are bare `0.4.x` tags) + GitHub-Releases that same merged commit.
+  are bare `0.4.x` tags) + GitHub-Releases that same merged commit with the
+  wheel and sdist that went to PyPI attached as release assets.
 
 When asked to publish, make, or ship a release, dispatch `Prepare Release` on
 `main`. Never pick the semver bump yourself: if the request does not name patch,
@@ -125,19 +126,21 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
   interpreter; raising the declared minimum relaxes the check automatically.
 - Reserve `scripts/` for durable repo commands. Do not write temporary,
   one-off, or local-only helper scripts there; use `tmp/` or `/tmp` instead.
-- When a change reaches what the bundlers consume, regenerate the derived
-  outputs with the one bundle entry point, `scripts/bundle/bundle.sh`;
-  `bundle.sh --check` is the freshness gate. Call
-  `scripts/bundle/cadgen-runtime.sh` directly only when debugging one stage.
+- cadgen's packaged runtime (`_runtime/node`, `_runtime/browser`,
+  `_runtime/viewer`) is BUILT, never committed: the whole directory is
+  gitignored and ships only inside the wheel. Build it with the one bundle
+  entry point, `scripts/bundle/bundle.sh`; `bundle.sh --check` builds it and
+  asserts every required output. Call `scripts/bundle/cadgen-runtime.sh`
+  directly only when debugging one stage.
 - Never let a symlink reach the published tree. Agent installers disagree about
   symlinks and one loses data silently: the Skills CLI dereferences them, Claude
   Code preserves them, and Codex `plugin add` drops them with no error, shipping
   a skill with missing files. `scripts/github-workflows/check-builds.sh` enforces
   this; do not relax it.
 - The CAD Viewer is `cadgen viewer`: the server is `cadgen.viewer` (Python, in
   `packages/cadgen`), the React client's source is `apps/viewer/` and its build
-  ships in the wheel at `cadgen/_runtime/viewer` (gitignored; a checkout serves
-  `apps/viewer/dist`). The cad-viewer skill is instructions over that verb.
+  ships in the wheel at `cadgen/_runtime/viewer` (built, never committed; a
+  checkout serves `apps/viewer/dist`). The cad-viewer skill is instructions over that verb.
   Nothing in `cadgen.viewer` imports the CAD kernel at module scope — the one
   kernel action, importing a foreign STEP, is a compile job in cadgen's build
   pool, never work the server process does.
@@ -184,19 +187,42 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
 Run the smallest path-targeted check that covers the change. Use broad wrappers
 when touching shared surfaces or before handoff:
 
-- Code tests: `scripts/test/test.sh`
-  - In GitHub Actions, `test.yml` (PRs to and pushes of `main`) checks the
-    canonical release version and the skill pins in a separate job so code
-    tests still run when version metadata is wrong; its test job checks
-    generated outputs against their sources, bundles production outputs, and
-    runs docs and code tests against that bundle. `Publish Release` repeats
-    those checks on the release commit before the wheel ships. GitHub branch
-    settings should require a PR for `main`.
-- Focused test runners: `scripts/test/test-js.sh`,
-  `scripts/test/test-docs.sh`, `scripts/test/test-python.sh`,
-  `scripts/test/test-global.sh`
+- Code tests: `scripts/test/test.sh` (JS, then Python, then policy).
+- Focused runners: `scripts/test/test-js.sh`, `scripts/test/test-docs.sh`,
+  `scripts/test/test-python.sh`, `scripts/test/test-global.sh`.
+  `test-python.sh` takes `--select cadgen|viewer|skills|all` and
+  `--print-weights`; see `scripts/README.md`.
+- In GitHub Actions, `test.yml` runs on pull requests to and pushes of `main`
+  as one job per thing that has to work, each conditional on the changes that
+  can break it. `Publish Release` repeats the same checks on the release commit
+  before the wheel ships. `CONTRIBUTING.md` has the reasoning.
+
+  | job | OS | runs when the diff touches | what |
+  | --- | --- | --- | --- |
+  | Version Check | ubuntu | anything | `VERSION`, derived metadata, skill pins |
+  | cadgen (Linux) | ubuntu | cadgen, cadgen-js, infra | the cadgen package suite, CAD Viewer backend included |
+  | cadgen (Windows) | windows | cadgen, cadgen-js, infra | the same suite: the one thing that must be proven on Windows |
+  | cadgen-js | ubuntu | cadgen-js, infra | `packages/cadgen-js` unit tests |
+  | viewer | ubuntu | viewer, cadgen-js, cadgen, infra | the client's unit tests, then the bundled client through the real backend |
+  | skills | ubuntu | skills, cadgen, cadgen-js, infra | `tests/python
```

**File**: `CONTRIBUTING.md` (modified, +161/-25)
```diff
@@ -37,6 +37,21 @@ installer resolves from PyPI). The editable install reports that same version,
 so the pin is satisfied in a checkout — but `pip install -r skills/<s>/requirements.txt`
 on its own would fetch the previous RELEASE from PyPI over your working copy.
 
+Then build cadgen's packaged runtime once:
+
+```bash
+scripts/bundle/bundle.sh
+```
+
+`packages/cadgen/src/cadgen/_runtime/` is BUILT, not committed — the whole
+directory is gitignored, and the wheel is the only place those files ship. A
+fresh clone therefore has no Node builders, no snapshot browser bundle and no
+Viewer client until the bundler runs, and cadgen says so by name (naming this
+command) the first time it reaches for one. `scripts/test/test-python.sh` and
+`scripts/test/test-global.sh` build the two stages they read if they are
+missing, so this step is about having the whole thing, including the Viewer
+client the wheel carries.
+
 For CAD Viewer development:
 
 ```bash
@@ -129,6 +144,86 @@ spelling or UI copy when observable behavior already covers the requirement.
 Real kernel and browser tests remain necessary for geometry fidelity,
 cache reuse, rendering, and process-lifecycle behavior.
 
+A test's COST is part of its design. A cold `python <model>.py` spends ~2.6 s
+importing the CAD kernel before it draws a box, so a file that runs one per
+assertion is mostly paying for imports: build a fixture the tests only READ once
+for the class and copy it in, keep each test's store, roots and freshness state
+private, and add a subprocess only where the subject IS the process. Model runs
+in tests are cold (`CADGEN_DAEMON=0`): routing them through a warm daemon was
+measured on CI and moved the kernel import into a daemon process rather than
+removing it (the runners are CPU-bound at four files), and cost more than it
+saved on Windows. `tests/python/support/warm_daemon.py` is for the opposite
+purpose — a test that deliberately exercises the WARM path, the production
+default, through a daemon private to its module — and only where the test's
+subject is what a warm worker does. Repeating a non-deterministic case N times
+is not coverage — if the underlying property can be pinned directly, pin it and
+run the case once.
+
+`scripts/test/test-python.sh --print-weights` prints what the slow files cost,
+the first thing to read when a run is slow.
+
+### CI
+
+`test.yml` is one job per thing that has to work, each conditional on the
+changes that can break it. `AGENTS.md` has the job table; this is why.
+
+**Jobs are split by condition, not by size.** Two tests belong in the same job
+unless they should run under different conditions — a different set of paths,
+or a different operating system. So the cadgen package suite is one job (one
+per platform), every skill suite plus the policy gates is one job, and there
+are no shards: each job parallelises internally (`unittest_files.py --jobs`,
+`node --test` concurrency) instead of across machines.
+
+**The conditions encode the dependency graph.** `packages/cadgen` is the engine
+everything downstream runs — the skills are thin entrypoints over its CLIs, the
+viewer is served by `cadgen.viewer`, the docs site documents its commands, the
+wheel packages it — so a cadgen change runs the cadgen, viewer, skills, docs and
+packaging jobs. `packages/cadgen-js` is bundled into the runtime cadgen
+executes and imported by the viewer and the docs hero, so it fans out the same
+way plus its own unit tests. A viewer-client change runs the viewer and
+packaging jobs; a docs change runs docs; a skills change runs skills and docs
+(the site mirrors the skills' frontmatter). `scripts/`, `.github/` and the
+version metadata can break any job, so they run all of them. The one direction
+that does NOT fan out is up: the viewer client, the skills and the docs cannot
+break cadgen, so touching them never runs the cadgen suite.
+
+**Only prose skips everything.** Root `*.md`, `notes/`, `models/`, `LICENSE`
+and issue templates are read by no test, so a pull request touching only those
+runs Version Check and nothing else. Markdown under `skills/` and
+`packages/cadgen/` is test input — `test_documented_commands` runs the command
+forms a SKILL.md teaches, `test_skill_requirements` reads a skill's prose for
+the extras it reaches, `test_package_boundaries` reads the package's own
+markdown — and is therefore not in that class.
+
+**Windows runs the cadgen suite and nothing else.** What has to be proven on
+Windows is the platform-facing code: paths, locks, subprocesses, file URLs, the
+daemon, the CAD Viewer backend — all of it in `packages/cadgen`, all of it
+covered by that one suite (four of the last five user-reported bugs were
+Windows-only bugs whose coverage existed and never ran there). Bundling,
+packaging, the policy gates and the skill suites are properties of the tree;
+the JS suites are properties of a browser or of Node; none of them has a
+Windows failure mode the cadgen suite does not 
```

**File**: `apps/viewer/README.md` (modified, +27/-0)
```diff
@@ -259,3 +259,30 @@ The backend's suite lives with cadgen and is not collected here; running only
 
 Headless UI verification uses Playwright with `--use-angle=metal` —
 the default software WebGL renderer is not what users see.
+
+### The browser gate
+
+The repository's browser gate (`test-viewer-browser.sh`, under its test
+scripts) drives the BUILT Viewer in a real Chromium against fixtures it
+generates itself. It comes in two sizes:
+
+- `--ci` — about 2 minutes: format, pick, kinematics, camera.
+- no flag — about 4 minutes: every gate.
+- `--only <gate>` — one gate while working on it.
+
+`--ci` is the subset that is safe to automate: it opens one file per load path
+(STEP package, mesh, drawing, robot), picks a face and toggles it, drives a
+joint five ways, and switches viewing mode. Nothing in it reads a frame rate or
+sleeps toward a conclusion — every assertion settles on state the app publishes,
+so a slower runner is slower, not redder.
+
+The rest stays manual, because it reads pixels in ways a software rasterizer
+will not reproduce: `picking` brute-force-clicks for a pixel on the silhouette
+(~26 probes at the 700 ms activation window, the most expensive gate here) and
+scores edge-highlight fragmentation pixel by pixel; `scene` compares mean
+luminance between appearance presets and between the Inspect grid and the Render
+floor. `quality` is deterministic and is the first gate to promote if the budget
+grows; it is out only on cost.
+
+Both sizes print `[setup] Ns` and `[gate NAME] Ns`, so a run that got slower
+says where.
```

**File**: `apps/viewer/scripts/run-tests.mjs` (modified, +11/-1)
```diff
@@ -1,4 +1,5 @@
 #!/usr/bin/env node
+import { availableParallelism } from "node:os";
 import { spawnSync } from "node:child_process";
 import fs from "node:fs";
 import path from "node:path";
@@ -57,12 +58,21 @@ const batches = [
   },
 ];
 
+// Each test file is its own process, and most of a file's life here is process
+// startup and reading fixtures, not CPU. node:test's default is
+// availableParallelism() - 1, which is ONE on the two-core runner CI gets, so every
+// file's startup is paid end to end. The floor of four overlaps those waits even
+// where there are not four cores to run them on.
+const testConcurrency = Math.max(4, availableParallelism());
+
 let status = 0;
 for (const batch of batches) {
   if (!batch.tests.length) {
     continue;
   }
-  const result = spawnSync(process.execPath, [...batch.nodeArgs, "--test", ...batch.tests], {
+  const result = spawnSync(process.execPath, [
+    ...batch.nodeArgs, "--test", `--test-concurrency=${testConcurrency}`, ...batch.tests,
+  ], {
     cwd: packageRoot,
     env: process.env,
     stdio: "inherit",
```

---

### Incident Patch 14: `28f1b8f3` (2026-09-16)
**Commit Message**: Merge PR #388: CAD caching, viewer performance and rendering workflows

Improve CAD caching, viewer performance, and rendering workflows

**File**: `.claude/launch.json` (removed, +0/-35)
```diff
@@ -1,35 +0,0 @@
-{
-  "version": "0.0.1",
-  "configurations": [
-    {
-      "name": "cad-viewer-dev",
-      "runtimeExecutable": "npm",
-      "runtimeArgs": [
-        "--prefix",
-        "apps/viewer",
-        "run",
-        "dev",
-        "--",
-        "--host",
-        "127.0.0.1",
-        "--port",
-        "3251"
-      ],
-      "port": 3251
-    },
-    {
-      "name": "docs",
-      "runtimeExecutable": "npm",
-      "runtimeArgs": [
-        "--prefix",
-        "apps/docs",
-        "run",
-        "dev",
-        "--",
-        "--port",
-        "3210"
-      ],
-      "port": 3210
-    }
-  ]
-}
\ No newline at end of file
```

**File**: `.gitattributes` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ assets/**/*.md !filter !diff !merge text
 apps/docs/public/hero/** !filter !diff !merge -text
 # Tiny plain-text STEP used by the viewer launch smoke's end-to-end import
 # (CI checks out without LFS, so this one fixture must be real text).
-models/examples/imported/import-smoke.step !filter !diff !merge text
+tests/fixtures/cad/import-smoke.step !filter !diff !merge text
 
 # The fixture corpus is LFS and never installed; archives (tarball installers,
 # GitHub source downloads) omit it. Clones keep it as pointers via .lfsconfig.
```

**File**: `.gitignore` (modified, +10/-0)
```diff
@@ -1,6 +1,7 @@
 # macOS
 .DS_Store
 .vscode
+/.claude/
 
 # Python
 __pycache__/
@@ -35,6 +36,15 @@ repo-scan*.md
 *-scan-*.md
 *-fix-plan*.md
 
+# Benchmark output is local evidence, not source. Use tmp/ for reports.
+/scripts/bench/**/results/
+/scripts/bench/**/*.json
+/scripts/bench/**/*.log
+/scripts/bench/**/*.gz
+/scripts/bench/**/*.cpuprofile
+/scripts/bench/**/*.heapsnapshot
+/scripts/bench/**/*.png
+
 # Review media rendered next to a fixture. models/ holds CAD/robot sources,
 # generated 3D and fabrication outputs, and docs only; see models/README.md.
 models/**/*.png
```

**File**: `AGENTS.md` (modified, +28/-7)
```diff
@@ -72,6 +72,16 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
   `packages/cadgen/README.md` (the laws), `packages/cadgen-js/README.md`,
   `apps/viewer/README.md`, and `apps/docs/README.md` before changing
   generation, rendering, storage, layout, or public interfaces.
+- A README holds the laws; the mechanism each law constrains lives one link
+  away, and the README names the link. Read the README, then follow the one
+  link — not the tree. What exists:
+  - `packages/cadgen/`: `STORE.md` (the store contract — sectioned, with a
+    table of contents), `MEMO.md` (`@memo`, and the process-wide geometric
+    `Shape` identity it installs), `SNAPSHOTS.md` (snapshot `--debug` timings).
+  - `packages/cadgen-js/docs/`: `render-pipeline.md`, `resource-ownership.md`,
+    `tube-deformation.md`.
+  - `apps/viewer/docs/`: `settings-ui.md` (BINDING for any settings control),
+    `render-types.md`, `render-mode.md`, `lod.md`, `storage.md`, `backend.md`.
 - Ships-alone law: `packages/cadgen` (the built PyPI wheel) works in isolation
   outside this repo, so its markdown must not refer to anything outside the
   package — enforced by `tests/python/global/test_package_boundaries.py`.
@@ -98,15 +108,26 @@ for the full flow, the resume path, the rehearsal, and local/manual fallbacks.
   the CAD Viewer client), so a skill ships no runtime of its own. Not every
   skill needs cadgen (bambu-labs, dfam-check, gcode, sendcutsend, step-parts
   are cadgen-free); do not add the dependency to a skill that never invokes it.
-- Regenerate derived outputs (`scripts/bundle/bundle.sh`) when a change reaches
-  what the bundlers consume; `bundle.sh --check` is the freshness gate.
-- Write all test, sample, permanent, and generated CAD/robot-description
-  artifacts under `models/`, including STEP/STP, STL, GLB, DXF, URDF, SRDF,
-  and SDF outputs. Do not create ad hoc artifact directories elsewhere.
+- Keep samples and manual CAD/robot-description validation artifacts under
+  `models/`. Automated tests must not read, build or import that sample corpus:
+  generate small fixtures in fresh temporary directories or use tiny test-owned
+  fixtures, with their own cache stores and cleanup. Repo `tmp/` is fine.
+  Enforced by `tests/python/global/test_tests_are_self_contained.py`.
+- Every test file is reached by a runner under `scripts/test/`, and a collector
+  that finds nothing fails the run rather than reporting a group that never
+  ran — so a renamed or emptied test directory stops CI instead of going quiet.
+- Benchmarks under `scripts/bench/` are manual and their output is never
+  committed: reports, logs, profiles and screenshots go to an ignored `tmp/`.
+  Only their pure helper units run in a test runner.
+- The Python floor is `requires-python` in `packages/cadgen/pyproject.toml` and
+  nowhere else. Every cadgen source is parsed against that floor, so syntax
+  newer than it fails here rather than at `pip install` time on a user's
+  interpreter; raising the declared minimum relaxes the check automatically.
 - Reserve `scripts/` for durable repo commands. Do not write temporary,
   one-off, or local-only helper scripts there; use `tmp/` or `/tmp` instead.
-- When source changes affect generated runtimes, refresh or check them with the
-  one bundle entry point, `scripts/bundle/bundle.sh`. Call
+- When a change reaches what the bundlers consume, regenerate the derived
+  outputs with the one bundle entry point, `scripts/bundle/bundle.sh`;
+  `bundle.sh --check` is the freshness gate. Call
   `scripts/bundle/cadgen-runtime.sh` directly only when debugging one stage.
 - Never let a symlink reach the published tree. Agent installers disagree about
   symlinks and one loses data silently: the Skills CLI dereferences them, Claude
```

**File**: `CONTRIBUTING.md` (modified, +71/-24)
```diff
@@ -111,15 +111,31 @@ prunes empty destination directories unless `--keep-empty-dirs` is passed.
 
 ## Test From This Repository
 
-Run development and test prompts from inside this repository instead of a
-separate project checkout. The skills assume this workbench layout while you are
-iterating: `models/` contains fixtures and generated CAD artifacts, `apps/viewer/`
-contains the editable CAD Viewer source, and repo-relative validation commands
-live under `scripts/`.
-
-Write test, sample, and durable CAD/robot-description artifacts under `models/`;
-do not create ad hoc artifact directories elsewhere. When you need a scratch
-project, create it under the fixture bucket it belongs in: a standalone part
+Automated tests are self-contained. They must not read, enumerate, build, or
+import sample models from this repository's `models/` directory. Generate the
+smallest fixture needed in a fresh temporary directory, or use a tiny fixture
+committed with the tests; do not rely on existing outputs or LFS downloads.
+Repo `tmp/` and system temporary directories are both fine. Give builds their
+own cache store and clean up their processes and files. The shared
+temporary-directory helper retains the Windows cleanup retries used by the suite.
+
+Keep regression tests focused on observable behavior. Reuse setup within a test
+when several assertions concern the same result; do not repeatedly build the
+same geometry to test unrelated metadata or duplicate an existing integration
+case. Each new test should protect a distinct contract or credible failure not
+already covered. Test a shared validator's cases once; callers need wiring
+checks, not copies of its full matrix. Avoid pinning private helpers, source
+spelling or UI copy when observable behavior already covers the requirement.
+Real kernel and browser tests remain necessary for geometry fidelity,
+cache reuse, rendering, and process-lifecycle behavior.
+
+Keep reusable manual edge-case and debugging models in `models/tests/`, with
+reproduction instructions. Despite its name, that folder is never CI input;
+see [its manual-validation policy](models/tests/README.md).
+
+For manual skill prompts and model review, work inside this repository and keep
+samples and CAD/robot-description artifacts under `models/`. Create a scratch
+project in the fixture bucket it belongs in: a standalone part
 goes in the `models/examples/` cad-project, an assembly gets its own group in
 `models/assemblies/` (`src/<assembly>/`, outputs in `STEP/<assembly>/`), a
 drawing goes in `models/drawings/` — script in `src/`, artifact declared into a
@@ -131,9 +147,9 @@ python models/examples/src/my_test.py
 ```
 
 Then start your agent with `/path/to/text-to-cad` as the working directory and
-ask it to write files under that scratch path. This keeps skill scripts,
-fixtures, generated sidecars, and Viewer links using the same repo-relative
-paths that CI and local checks expect.
+ask it to write files under that scratch path. This keeps manual model sources,
+generated artifacts, and Viewer links together, independently of the automated
+test suite.
 
 Review media such as snapshot PNGs are not model artifacts:
 render them under `/tmp` and attach them to the pull request instead. `.gitignore`
@@ -205,6 +221,16 @@ PYTHONPATH=<worktree>/packages/cadgen/src \
 <main>/.venv/bin/python -m cadgen.viewer --host 127.0.0.1 --json
 ```
 
+The self-contained browser regression suite checks supported formats, picking,
+placement, and Inspect/Render quality transitions. It creates tiny inputs and
+starts its own viewer with an isolated cache; no sample builds are needed.
+Bundle the client first and install Playwright Chromium from the development
+requirements:
+
+```bash
+scripts/test/test-viewer-browser.sh
+```
+
 Mesh exports (`@stl`/`@3mf`/`@glb`) and DXF previews run the checkout's live
 `packages/cadgen-js/bin` builders in Node, which import `three` and friends
 from `packages/cadgen-js/node_modules`. A fresh worktree has none, and cadgen
@@ -214,9 +240,20 @@ primary checkout (they are gitignored) or `npm install` in each package:
 
 ```bash
 ln -s <main>/packages/cadgen-js/node_modules <worktree>/packages/cadgen-js/node_modules
-ln -s <main>/apps/viewer/node_modules <worktree>/apps/viewer/node_modules
+mkdir <worktree>/apps/viewer/node_modules
+for e in <main>/apps/viewer/node_modules/* <main>/apps/viewer/node_modules/.bin; do
+  [ "$(basename "$e")" = cadgen-js ] || ln -s "$e" <worktree>/apps/viewer/node_modules/
+done
+ln -s <worktree>/packages/cadgen-js <worktree>/apps/viewer/node_modules/cadgen-js
 ```
 
+Do NOT symlink the Viewer's `node_modules` directory whole. Its `cadgen-js`
+entry is a RELATIVE link (`../../../packages/cadgen-js`) that resolves against
+the primary checkout, so the worktree's Viewer tests and dev server would run
+the primary checkout's cadgen-js and silently ignore every cadgen-js edit in
+the worktree. Link the entries individually and point `cadgen-js` at the
```

**File**: `apps/docs/README.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ Vercel, not this repo) must point at `apps/docs`.
 
 Hero STEP assets under `public/hero/` are a view of the tree behind the
 planetary gear STEP (`assembly.json` + each component's `.surf`) plus its
-sidecar, committed as PLAIN files (never LFS — Vercel serves them statically
+schema-v9 sidecar with embedded animation, committed as PLAIN files (never LFS — Vercel serves them statically
 with no backend). Refresh them after rebuilding the model:
 
 ```
```

**File**: `apps/docs/public/hero/planetary_gear_assembly.step.js` (removed, +0/-58)
```diff
@@ -1,58 +0,0 @@
-// Choreography for the planetary gear stage (copied into the sidecar at
-// build; the viewer's Animation tab is the only consumer). Raw transforms by
-// design: animation knows nothing of the mate graph, so the exact fixed-ring
-// ratios are restated here.
-const FULL_MESH_CYCLE_DEG = 1260;
-const CARRIER_RATIO = 24 / (24 + 60);
-const PLANET_RATIO = -(24 / 18) * (1 - CARRIER_RATIO);
-const Z = [0, 0, 1];
-const PLANETS = [
-  { gear: "planet_gear_1_18_teeth", pin: "planet_pin_1", center: [42, 0, 0], radial: [1, 0, 0] },
-  { gear: "planet_gear_2_18_teeth", pin: "planet_pin_2", center: [-21, 36.373067, 0], radial: [-0.5, 0.8660254, 0] },
-  { gear: "planet_gear_3_18_teeth", pin: "planet_pin_3", center: [-21, -36.373067, 0], radial: [-0.5, -0.8660254, 0] },
-];
-
-function driveTrain(m, driveDeg) {
-  const carrierDeg = driveDeg * CARRIER_RATIO;
-  m.get("sun_gear_24_teeth").rotate(Z, driveDeg, [0, 0, 0]);
-  m.get("carrier_plate").rotate(Z, carrierDeg, [0, 0, 0]);
-  for (const planet of PLANETS) {
-    const gear = m.get(planet.gear);
-    // Spin about the planet's own (rest) center first, then orbit with the
-    // carrier: successive calls premultiply, so the spin rides the orbit.
-    gear.rotate(Z, driveDeg * PLANET_RATIO, planet.center);
-    gear.rotate(Z, carrierDeg, [0, 0, 0]);
-    m.get(planet.pin).rotate(Z, carrierDeg, [0, 0, 0]);
-  }
-}
-
-const ease = { sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * 2 * t) };
-
-export const clips = {
-  meshCycle: {
-    label: "Mesh cycle",
-    duration: 6,
-    update(t, m) {
-      driveTrain(m, (t / 6) * FULL_MESH_CYCLE_DEG);
-    },
-  },
-  inspectExplode: {
-    label: "Explode inspect",
-    duration: 5,
-    update(t, m) {
-      const progress = t / 5;
-      driveTrain(m, progress * FULL_MESH_CYCLE_DEG);
-      const explode = ease.sine(progress) * 16;
-      for (const planet of PLANETS) {
-        const shift = planet.radial.map((v) => v * explode);
-        m.get(planet.gear).translate(shift);
-        m.get(planet.pin).translate(shift);
-      }
-      m.get("sun_gear_24_teeth").translate([0, 0, (explode / 16) * 7]);
-      m.get("carrier_plate").translate([0, 0, (explode / 16) * -4]);
-      for (const planet of PLANETS) {
-        m.get(planet.pin).translate([0, 0, (explode / 16) * -4]);
-      }
-    },
-  },
-};
```

**File**: `apps/docs/public/hero/planetary_gear_assembly.step.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"kinematics": {"couplings": [{"gears": {"carrier": 0.2857142857142857, "planet1": -0.9523809523809523, "planet2": -0.9523809523809523, "planet3": -0.9523809523809523, "sun": 1.0}, "limits": [0.0, 1260.0], "name": "drive"}], "mates": [{"axis": {"dir": [0.0, 0.0, 1.0], "origin": [0.0, 0.0, 0.0]}, "child": "#sun_gear_24_teeth", "childId": "o1.3", "kind": "revolute", "limits": {"value": [-1260.0, 1260.0]}, "name": "sun", "parent": "#ring_gear_60_internal_teeth", "parentId": "o1.2"}, {"axis": {"dir": [0.0, 0.0, 1.0], "origin": [0.0, 0.0, 0.0]}, "child": "#carrier_plate", "childId": "o1.1", "kind": "revolute", "limits": {"value": [-360.0, 360.0]}, "name": "carrier", "parent": "#ring_gear_60_internal_teeth", "parentId": "o1.2"}, {"axis": {"dir": [0.0, 0.0, 1.0], "origin": [42.0, 0.0, 0.0]}, "child": "#planet_gear_1_18_teeth", "childId": "o1.4", "kind": "revolute", "limits": {"value": [-5040.0, 5040.0]}, "name": "planet1", "parent": "#carrier_plate", "parentId": "o1.1"}, {"axis": {}, "child": "#planet_pin_1", "childId": "o1.5", "kind": "fastened", "limits": {}, "name": "pin1", "parent": "#carrier_plate", "parentId": "o1.1"}, {"axis": {"dir": [0.0, 0.0, 1.0], "origin": [-20.999999999999993, 36.373066958946424, 0.0]}, "child": "#planet_gear_2_18_teeth", "childId": "o1.6", "kind": "revolute", "limits": {"value": [-5040.0, 5040.0]}, "name": "planet2", "parent": "#carrier_plate", "parentId": "o1.1"}, {"axis": {}, "child": "#planet_pin_2", "childId": "o1.7", "kind": "fastened", "limits": {}, "name": "pin2", "parent": "#carrier_plate", "parentId": "o1.1"}, {"axis": {"dir": [0.0, 0.0, 1.0], "origin": [-21.000000000000018, -36.37306695894641, 0.0]}, "child": "#planet_gear_3_18_teeth", "childId": "o1.8", "kind": "revolute", "limits": {"value": [-5040.0, 5040.0]}, "name": "planet3", "parent": "#carrier_plate", "parentId": "o1.1"}, {"axis": {}, "child": "#planet_pin_3", "childId": "o1.9", "kind": "fastened", "limits": {}, "name": "pin3", "parent": "#carrier_plate", "parentId": "o1.1"}], "poses": {"half_cycle": {"drive": 630.0}, "quarter_cycle": {"drive": 315.0}}}, "meshExports": [{"at": null, "fmt": "stl", "meshAngularTolerance": null, "meshTolerance": null, "out": "../../STL/planetary_gear_assembly/planetary_gear_assembly.stl"}, {"at": null, "fmt": "3mf", "meshAngularTolerance": null, "meshTolerance": null, "out": "../../3MF/planetary_gear_assembly/planetary_gear_assembly.3mf"}, {"at": null, "fmt": "glb", "meshAngularTolerance": null, "meshTolerance": null, "out": "../../GLB/planetary_gear_assembly/planetary_gear_assembly.glb"}], "schemaVersion": 6}
\ No newline at end of file
+{"schemaVersion":9,"documentHash":"58dfc3609e12077876821915a7aff14e2333359142c0fd3770d357d55044c77d","kinematics":{"couplings":[{"gears":{"carrier":0.2857142857142857,"planet1":-0.9523809523809523,"planet2":-0.9523809523809523,"planet3":-0.9523809523809523,"sun":1},"limits":[0,1260],"name":"drive"}],"mates":[{"axis":{"dir":[0,0,1],"origin":[0,0,0]},"child":"#sun_gear_24_teeth","childId":"o1.3","kind":"revolute","limits":{"value":[-1260,1260]},"name":"sun","parent":"#ring_gear_60_internal_teeth","parentId":"o1.2"},{"axis":{"dir":[0,0,1],"origin":[0,0,0]},"child":"#carrier_plate","childId":"o1.1","kind":"revolute","limits":{"value":[-360,360]},"name":"carrier","parent":"#ring_gear_60_internal_teeth","parentId":"o1.2"},{"axis":{"dir":[0,0,1],"origin":[42,0,0]},"child":"#planet_gear_1_18_teeth","childId":"o1.4","kind":"revolute","limits":{"value":[-5040,5040]},"name":"planet1","parent":"#carrier_plate","parentId":"o1.1"},{"axis":{},"child":"#planet_pin_1","childId":"o1.5","kind":"fastened","limits":{},"name":"pin1","parent":"#carrier_plate","parentId":"o1.1"},{"axis":{"dir":[0,0,1],"origin":[-20.999999999999993,36.373066958946424,0]},"child":"#planet_gear_2_18_teeth","childId":"o1.6","kind":"revolute","limits":{"value":[-5040,5040]},"name":"planet2","parent":"#carrier_plate","parentId":"o1.1"},{"axis":{},"child":"#planet_pin_2","childId":"o1.7","kind":"fastened","limits":{},"name":"pin2","parent":"#carrier_plate","parentId":"o1.1"},{"axis":{"dir":[0,0,1],"origin":[-21.000000000000018,-36.37306695894641,0]},"child":"#planet_gear_3_18_teeth","childId":"o1.8","kind":"revolute","limits":{"value":[-5040,5040]},"name":"planet3","parent":"#carrier_plate","parentId":"o1.1"},{"axis":{},"child":"#planet_pin_3","childId":"o1.9","kind":"fastened","limits":{},"name":"pin3","parent":"#carrier_plate","parentId":"o1.1"}],"poses":{"half_cycle":{"drive":630},"quarter_cycle":{"drive":315}}},"animation":{"language":"javascript","source":"// Choreography for the planetary gear stage (copied into the sidecar at\n// build; the viewer's Animation tab is the only consumer). Raw transforms by\n// design: animation knows nothing of the mate graph, so the exact fixed-ring\n// ratios are restated here.\nconst FULL_MESH_CYCLE_DEG = 1260;\nconst CARRIER_RATIO = 24 / (24 + 60);\nconst PLANET_RATIO = -(24 / 18) * (1 - CARRIER_RATIO);\nconst Z = [0, 0, 1];\nconst PLANETS = [\
```

---

### Incident Patch 15: `e2f3be55` (2026-09-16)
**Commit Message**: Merge claude/viewer-mode-camera: a mode switch fits its own camera; the Render floor sits under the model

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `apps/viewer/README.md` (modified, +3/-1)
```diff
@@ -72,7 +72,9 @@ the constants and the per-format detail are in
 The navbar's **Viewing mode** menu switches Inspect ↔ Render. Their settings
 are SEPARATE per-model session state: entering a mode restores that mode, never
 a blend of the two, and kinematics and animation compose through the same model
-pose state in both. Quality is independent of the studio — Inspect is
+pose state in both. The camera does not travel between them at all — entering a
+mode fits ITS camera to the model's zero pose, so a switch is a Reset view for
+the mode being entered. Quality is independent of the studio — Inspect is
 Interactive, Render is **Preview** or **Final** (default Final) — and a quality
 change refines the view without rebuilding exact CAD geometry. The Viewer and
 `cadgen step snapshot --render` resolve photographic scenes through the same
```

**File**: `apps/viewer/docs/render-mode.md` (modified, +24/-13)
```diff
@@ -59,8 +59,11 @@ The navbar's **Viewing mode** icon menu switches between **Inspect** and
 
 The compact editor controls lens and exposure, softbox rotation, size and fill,
 plus backdrop color, transparency, ground visibility and position. The
-translucent ground stays at the model's original Z=0 plane by default;
-**Lowest point** aligns the floor to the model without moving its geometry.
+translucent ground sits under the model — at the bottom of its bounds — by
+default, so a document whose geometry reaches below its own origin is never
+veiled by its own floor; **Model origin** pins the plane to Z=0 instead, for
+models authored standing on it. Either way the geometry keeps its authored
+coordinates: the plane moves, the model never does.
 
 Khronos PBR Neutral tone mapping and a generated softbox environment provide
 the Render lighting. The overhead side key models depth, while a rear fill
@@ -125,14 +128,19 @@ clipped and floored — never how the model is framed, and never what 100% means
 **Reset view** re-fits to that same zero-pose box rather than to the pose on
 screen, so it reproduces the view the model opened at.
 
-Three things reopen that decision, and none of them is a pose: a different
-model; a progressive load reaching its full extent, having framed on the handful
-of components that arrived first; and a **rebuilt model whose zero pose
-changed** — a new revision is a new zero pose, so a save that grew the geometry
-re-fits rather than leaving the new geometry clipped outside the old frame. The
-last two stand down once the user has taken the view; their camera is a
-deliberate choice about this model, and Reset view still takes them to the new
-zero pose.
+Four things reopen that decision, and none of them is a pose: a different
+model; a **change of viewing mode**, because Inspect's orthographic frustum and
+Render's photographic lens are two cameras and the one being entered fits the
+zero pose itself; a progressive load reaching its full extent, having framed on
+the handful of components that arrived first; and a **rebuilt model whose zero
+pose changed** — a new revision is a new zero pose, so a save that grew the
+geometry re-fits rather than leaving the new geometry clipped outside the old
+frame. The last two stand down once the user has taken the view; their camera is
+a deliberate choice about this model, and Reset view still takes them to the new
+zero pose. A mode change does not stand down: switching is itself the deliberate
+act, and it carries Reset view's meaning for the mode being entered — which is
+also why a freehand CAD drawing, anchored to the view it was drawn in, ends
+there as it does on any other reframe.
 
 Mode changes keep the new canvas covered with the destination backdrop until
 geometry and lighting have drawn their first frame. This transition owns no
@@ -163,9 +171,12 @@ switch resolves the chunk before anything is presented.
 Entering Render applies its perspective camera and fixed presentation view —
 shaded authored colors, with guides, edges, clipping, exploded transforms and
 selection effects off. Kinematics and animation remain available and compose
-through the same model pose state used in Inspect. Returning to Inspect
-restores the CAD camera and inspection state; returning to Render restores the
-photographic view.
+through the same model pose state used in Inspect. Returning to Inspect restores
+the inspection state and its projection; the CAMERA is not restored in either
+direction but re-fitted, so each mode opens at its own view of the zero pose.
+The session still records where each mode's camera was left, for the file
+session it reopens with and for a snapshot request; nothing replays it across a
+switch.
 
 ## The Materials tab
 
```

**File**: `apps/viewer/docs/settings-ui.md` (modified, +2/-1)
```diff
@@ -301,7 +301,8 @@ The top Setup section contains Quality. Reset sits below the Backdrop section.
 Camera contains Lens and Exposure; Lighting contains Rotation,
 Softbox size, and Fill ratio; Backdrop contains Transparent, Color, Ground, and
 Ground position (visible only with Ground enabled). Ground position defaults to
-Model origin (Z=0); Lowest point is an explicit presentation option.
+Lowest point, which keeps the floor under the model; Model origin (Z=0) is the
+explicit alternative and is listed second.
 Studio defaults follow global app appearance. Customized backdrop settings remain
 in the model session until Reset, which restores defaults for the current
 appearance. Keep material presets in Materials. Do not add settings clipboard,
```

**File**: `apps/viewer/src/client/components/CadViewer.js` (modified, +31/-8)
```diff
@@ -212,6 +212,7 @@ import {
   runtimeFramingBounds,
   stepKeyboardOrbit,
   WHEEL_PINCH_DELTA_BOOST,
+  VIEWING_MODE,
   VIEW_PLANE_DEFAULT_PRESET,
   VIEW_PLANE_FACE_BY_ID,
   VIEW_PLANE_FACES,
@@ -1890,6 +1891,10 @@ const CadViewer = forwardRef(function CadViewer({
   const viewportFrameInsetsRef = useRef(normalizedViewportFrameInsets);
   const framedModelKeyRef = useRef("");
   const framedZeroPoseBoundsRef = useRef(null);
+  // The viewing mode this view was framed in. Inspect's orthographic CAD
+  // frustum and Render's photographic lens are two cameras, so each one fits
+  // the zero pose itself rather than inheriting the other's pose and zoom.
+  const framedViewingModeRef = useRef("");
   // The model key this view was framed against once every component had
   // arrived. A progressive load frames on the first publish so something is on
   // screen immediately, and that first batch is a fraction of the model.
@@ -2136,16 +2141,24 @@ const CadViewer = forwardRef(function CadViewer({
     if (!renderMode || !configuration || !runtime?.THREE || !studio) {
       return;
     }
-    studio.applyPhotographicStudio(runtime.THREE, runtime, configuration, {
+    const studioState = studio.applyPhotographicStudio(runtime.THREE, runtime, configuration, {
       bounds,
       sceneScale: normalizedSceneScaleMode,
       shadowMapSize: renderShadowMapSizeRef.current
     });
+    // Where the photographic floor actually ended up, so a browser test can
+    // assert that a model reaching below its own origin stands ON the plane
+    // rather than behind it. The scene sync republishes the placement seam, so
+    // the live value lives on the runtime and both writers read it from there.
+    runtime.photographicGroundZ = Number.isFinite(Number(studioState?.ground?.position?.z))
+      ? Number(studioState.ground.position.z)
+      : null;
     if (typeof window !== "undefined" && window.__cadModelPlacement) {
       window.__cadModelPlacement = {
         ...window.__cadModelPlacement,
         floorFollowsModel: configuration.backdrop?.ground === true
-          && configuration.backdrop.groundPlacement === "lowest"
+          && configuration.backdrop.groundPlacement !== "origin",
+        groundZ: runtime.photographicGroundZ
       };
     }
   }, [normalizedSceneScaleMode, renderMode, studioSceneTick]);
@@ -3546,6 +3559,7 @@ const CadViewer = forwardRef(function CadViewer({
     framedModelKeyRef.current = "";
     framedCompleteModelKeyRef.current = "";
     framedZeroPoseBoundsRef.current = null;
+    framedViewingModeRef.current = "";
     lastEmittedPerspectiveRef.current = null;
     defaultPerspectiveResettingRef.current = false;
     viewerAlertChangeRef.current?.(null);
@@ -4368,9 +4382,12 @@ const CadViewer = forwardRef(function CadViewer({
         boundsMin: [...boundsMin],
         boundsMax: [...boundsMax],
         gridFloorZ: Number.isFinite(Number(runtime.gridFloorZ)) ? Number(runtime.gridFloorZ) : null,
+        groundZ: renderMode && Number.isFinite(Number(runtime.photographicGroundZ))
+          ? Number(runtime.photographicGroundZ)
+          : null,
         floorFollowsModel: renderMode
           ? renderConfigurationRef.current?.backdrop?.ground === true
-            && renderConfigurationRef.current.backdrop.groundPlacement === "lowest"
+            && renderConfigurationRef.current.backdrop.groundPlacement !== "origin"
           : floorFollowsModel
       };
     }
@@ -4470,16 +4487,19 @@ const CadViewer = forwardRef(function CadViewer({
     controls.zoomSpeed = DEFAULT_ZOOM_SPEED;
     runtime.edgePickThreshold = Math.max(radius / 320, 0.65);
 
-    // Whether the camera fits at all, and why: a different model, a progressive
-    // load reaching its full extent, or a rebuild whose ZERO POSE changed. The
-    // decision (and what is deliberately NOT a reason: any pose, any detail
-    // swap) lives in reframeReason.
+    // Whether the camera fits at all, and why: a different model, a change of
+    // viewing mode, a progressive load reaching its full extent, or a rebuild
+    // whose ZERO POSE changed. The decision (and what is deliberately NOT a
+    // reason: any pose, any detail swap) lives in reframeReason.
     const missingComponentIds = meshData?.missingComponentIds;
     const modelIsComplete = !(Array.isArray(missingComponentIds) && missingComponentIds.length > 0);
+    const viewingMode = renderMode ? VIEWING_MODE.RENDER : VIEWING_MODE.INSPECT;
     const reframe = reframeReason({
       modelKey,
       framedModelKey: framedModelKeyRef.current,
       framedCompleteModelKey: framedCompleteModelKeyRef.current,
+      mode: viewingMode,
+      framedMode: framedViewingModeRef.current,
       modelComplete: modelIsComplete,
       zeroPoseBounds,
       framedZeroPoseBounds: framedZeroPoseBoundsRef.current,
@@ -4489,7 +4509,9 @@ const CadViewer = forwardRef(function CadViewer({
       framedCompleteModelKeyRef.current = modelKey || "";
     }
     if (ref
```

**File**: `apps/viewer/src/client/components/CadWorkspace.js` (modified, +29/-66)
```diff
@@ -1176,7 +1176,6 @@ export default function CadWorkspace({
   const [renderSession, setRenderSession] = useState(createRenderSessionState);
   const renderEnabledRef = useRef(renderSession.enabled);
   renderEnabledRef.current = renderSession.enabled;
-  const preserveCadDrawingsForCameraCommandRef = useRef(false);
   const [viewerPerspective, setViewerPerspective] = useState(null);
   const [hoveredListPartId, setHoveredListPartId] = useState("");
   const [hoveredModelPartId, setHoveredModelPartId] = useState("");
@@ -2884,11 +2883,6 @@ export default function CadWorkspace({
   const fileSessionSaveTimerRef = useRef(0);
   const openTabsRef = useRef(openTabs);
   const activePerspectiveRef = useRef(null);
-  // A copied CLI camera may name a preset or direction without carrying a
-  // fitted position. Resolve it only after this model's bounds are available;
-  // fitting it against the previous tab (or origin fallback) would persist the
-  // wrong framing for the model.
-  const pendingRenderCameraRef = useRef(null);
   const tabToolsResizeStateRef = useRef(null);
   const selectedFileSheetKeyRef = useRef("");
   const cadDirectorySessionBootstrappedRef = useRef(false);
@@ -3576,7 +3570,7 @@ export default function CadWorkspace({
     }, 180);
   }, [clearFileSessionSaveTimer, selectedEntry, writeFileSessionForEntry]);
 
-  const applyEntrySessionState = useCallback((key, fileSessionState = null, meshBounds = null) => {
+  const applyEntrySessionState = useCallback((key, fileSessionState = null) => {
     const normalizedKey = String(key || "").trim();
     if (!normalizedKey) {
       return;
@@ -3590,27 +3584,19 @@ export default function CadWorkspace({
       : normalizeDisplaySettings());
     const nextRenderSession = createRenderSessionState(sessionState?.slices?.render);
     setRenderSession(nextRenderSession);
-    pendingRenderCameraRef.current = null;
-    const renderCameraSpec = nextRenderSession.enabled
-      ? resolveSceneSettings({
+    // Only a camera this file's session actually RECORDED comes back. A file
+    // opened for the first time has none, and the viewer then fits the mode
+    // being opened to the model's zero pose. Synthesizing a stand-in here
+    // framed the model against a bounds-radius rule of its own, tagged it with
+    // the new model's key, and so suppressed that fit -- which is how a fresh
+    // model opened at a pose nothing had measured.
+    const restoredCamera = nextRenderSession.enabled
+      ? renderCameraSnapshot(resolveSceneSettings({
           appearance: colorSchemePreference,
           prefersDark: systemPrefersDark,
           render: nextRenderSession.payload
-        }).camera
-      : null;
-    let restoredCamera = nextRenderSession.enabled
-      ? renderCameraSnapshot(renderCameraSpec)
+        }).camera)
       : nextRenderSession.cadCamera;
-    if (nextRenderSession.enabled && !restoredCamera && meshBounds) {
-      restoredCamera = resolveRenderCameraSnapshot(renderCameraSpec, meshBounds, {
-        sceneScale: renderCapabilities(entrySourceFormat(entry)).sceneScale
-      });
-    } else if (nextRenderSession.enabled && !restoredCamera) {
-      pendingRenderCameraRef.current = {
-        key: normalizedKey,
-        camera: renderCameraSpec
-      };
-    }
     if (restoredCamera) {
       const scopedCamera = scopedWorkspacePerspective(restoredCamera, normalizedKey, entry);
       activePerspectiveRef.current = scopedCamera;
@@ -3803,7 +3789,7 @@ export default function CadWorkspace({
     }
 
     applyTabRecord(nextTab);
-    applyEntrySessionState(key, restoredSessionState, cachedMeshState?.meshData?.bounds || null);
+    applyEntrySessionState(key, restoredSessionState);
   }, [
     applyEntrySessionState,
     applyTabRecord,
@@ -7039,7 +7025,10 @@ export default function CadWorkspace({
     }
     // Camera moved: give the LOD scheduler a sample (it debounces internally).
     onLodCameraMoved();
-    if (renderEnabledRef.current || preserveCadDrawingsForCameraCommandRef.current) {
+    // Freehand strokes are anchored to the view they were drawn in, so a
+    // camera move ends them -- an orbit, Reset view, or the fit a mode switch
+    // performs. Render owns no CAD drawing layer, so its camera never does.
+    if (renderEnabledRef.current) {
       return;
     }
     const hasPerspectiveDependentDrawings =
@@ -7074,23 +7063,17 @@ export default function CadWorkspace({
     setViewerPerspective(scopedSnapshot);
   }, [isUrdfView, selectedEntry, selectedKey, selectedMeshData?.bounds]);
 
-  useEffect(() => {
-    const pending = pendingRenderCameraRef.current;
-    if (
-      !pending ||
-      pending.key !== selectedKey ||
-      !selectedMeshData?.bounds
-    ) {
-      return;
-    }
-    pendingRenderCameraRef.current = null;
-    applyActiveCamera(pending.camera);
-  }, [applyActiveCamera, selectedKey, selectedMeshData?.bounds]);
-
   const handleRenderEnabledChange = useCallback((enabled) => {
     if (ena
```

**File**: `apps/viewer/src/client/components/viewer/viewportCameraKit.js` (modified, +23/-3)
```diff
@@ -4,6 +4,12 @@
 // about how the scene itself is rendered.
 
 export const WORLD_UP = Object.freeze([0, 0, 1]);
+// The two viewing modes, as the camera sees them: Inspect's CAD frustum and
+// Render's photographic lens. Each frames the model itself (see reframeReason).
+export const VIEWING_MODE = Object.freeze({
+  INSPECT: "inspect",
+  RENDER: "render"
+});
 export const KEYBOARD_ORBIT_NUDGE_RAD = Math.PI / 32;
 export const KEYBOARD_ORBIT_SPEED_RAD_PER_SEC = Math.PI * 0.42;
 export const KEYBOARD_POLAR_EPSILON = 0.02;
@@ -183,10 +189,17 @@ export function sameZeroPoseBounds(a, b, epsilon = ZERO_POSE_REVISION_EPSILON) {
   return true;
 }
 
-// When the camera fits, and why. A model is framed ONCE, on its zero pose, and
-// three things reopen that decision -- none of them a pose:
+// When the camera fits, and why. A model is framed ONCE per viewing mode, on
+// its zero pose, and four things reopen that decision -- none of them a pose:
 //
 // - "model": a different model. Always fits.
+// - "mode": Inspect and Render are two cameras, not one camera with two looks:
+//   an orthographic CAD frustum and a photographic perspective lens. Carrying
+//   one mode's pose and zoom into the other landed the destination at a framing
+//   that was never fitted to anything -- a perspective distance read as an
+//   orthographic half-height, or a close-up taken in Render reopening Inspect
+//   inside the model. The destination mode fits its own camera to the zero pose
+//   on every switch.
 // - "complete": a progressive load frames on its first publish, against the
 //   handful of components that have arrived, and the model then grows well
 //   outside that frame, so it frames again once every component is composed.
@@ -200,11 +213,15 @@ export function sameZeroPoseBounds(a, b, epsilon = ZERO_POSE_REVISION_EPSILON) {
 //
 // The last two stand down once the user has taken the view: their camera is a
 // deliberate choice about this model and an automatic fit would throw it away on
-// every save. Reset view still takes them to the new zero pose.
+// every save. A mode change does NOT stand down -- switching mode is itself the
+// deliberate act, and it carries Reset view's meaning for the mode being
+// entered. Reset view still takes a stood-down camera to the new zero pose.
 export function reframeReason({
   modelKey = "",
   framedModelKey = "",
   framedCompleteModelKey = "",
+  mode = "",
+  framedMode = "",
   modelComplete = true,
   zeroPoseBounds = null,
   framedZeroPoseBounds = null,
@@ -214,6 +231,9 @@ export function reframeReason({
   if (String(framedModelKey || "") !== key) {
     return "model";
   }
+  if (String(mode || "") !== String(framedMode || "")) {
+    return "mode";
+  }
   if (!modelComplete || userMovedCamera) {
     return "";
   }
```

**File**: `apps/viewer/src/client/components/viewer/viewportCameraKit.test.js` (modified, +34/-2)
```diff
@@ -5,6 +5,7 @@ import {
   reframeReason,
   runtimeFramingBounds,
   sameZeroPoseBounds,
+  VIEWING_MODE,
   VIEW_PLANE_FACES,
   viewPlaneCameraBasis,
   viewportFitScale
@@ -150,14 +151,16 @@ test("a runtime with no zero pose yet falls back to the live bounds, then to the
   assert.equal(runtimeFramingBounds(null), null);
 });
 
-// A model is framed once, on its zero pose. These are the only three things that
-// reopen that decision, and a pose is never one of them.
+// A model is framed once per viewing mode, on its zero pose. These are the only
+// four things that reopen that decision, and a pose is never one of them.
 const SMALL = { min: [0, 0, 0], max: [10, 4, 2] };
 const GREW = { min: [0, 0, 0], max: [40, 4, 2] };
 const FRAMED = {
   modelKey: "hinge.step",
   framedModelKey: "hinge.step",
   framedCompleteModelKey: "hinge.step",
+  mode: VIEWING_MODE.INSPECT,
+  framedMode: VIEWING_MODE.INSPECT,
   modelComplete: true,
   zeroPoseBounds: SMALL,
   framedZeroPoseBounds: SMALL
@@ -192,6 +195,35 @@ test("the user's own camera stands through a completion and a rebuild", () => {
   assert.equal(reframeReason({ ...FRAMED, zeroPoseBounds: GREW, userMovedCamera: true }), "");
 });
 
+test("entering a viewing mode fits that mode's own camera, over one the user took", () => {
+  const entered = { ...FRAMED, mode: VIEWING_MODE.RENDER };
+  assert.equal(reframeReason(entered), "mode", "Render does not inherit Inspect's framing");
+  assert.equal(reframeReason({ ...entered, userMovedCamera: true }), "mode",
+    "a hand-framed Inspect view does not follow the model into Render");
+  assert.equal(
+    reframeReason({ ...FRAMED, mode: VIEWING_MODE.INSPECT, framedMode: VIEWING_MODE.RENDER }),
+    "mode",
+    "and back again"
+  );
+});
+
+test("staying in a mode is not a reason to re-fit", () => {
+  assert.equal(reframeReason(FRAMED), "");
+  assert.equal(reframeReason({ ...FRAMED, mode: VIEWING_MODE.RENDER, framedMode: VIEWING_MODE.RENDER }), "");
+  assert.equal(
+    reframeReason({ ...FRAMED, mode: VIEWING_MODE.RENDER, framedMode: VIEWING_MODE.RENDER, zeroPoseBounds: GREW, userMovedCamera: true }),
+    "",
+    "an in-mode revision still stands down for the camera the user took"
+  );
+});
+
+test("a different model opened in another mode is the model's own fit", () => {
+  assert.equal(
+    reframeReason({ ...FRAMED, modelKey: "other.step", mode: VIEWING_MODE.RENDER, userMovedCamera: true }),
+    "model"
+  );
+});
+
 test("a detail swap's float-level drift is the same zero pose, a millimetre is not", () => {
   const drifted = { min: [0, 0, 0], max: [10 + 1e-7, 4, 2] };
   assert.equal(sameZeroPoseBounds(drifted, SMALL), true);
```

**File**: `apps/viewer/src/client/components/workbench/RenderSettingsContent.js` (modified, +2/-2)
```diff
@@ -100,8 +100,8 @@ export default function RenderSettingsContent({
             value={configuration.backdrop.groundPlacement}
             onValueChange={(value) => setValue(["backdrop", "groundPlacement"], value)}
             options={[
-              { value: "origin", label: "Model origin" },
-              { value: "lowest", label: "Lowest point" }
+              { value: "lowest", label: "Lowest point" },
+              { value: "origin", label: "Model origin" }
             ]}
           />
         )}
```

#### Recent Merged Pull Requests:
- **PR #557** (closed): Docs: section menu on mobile, version as v0.7.14 (@earthtojake)
- **PR #556** (2026-10-05): Export a filleted, swept teacup as a closed mesh (#555) (@earthtojake)
- **PR #553** (2026-10-05): Release 0.7.14 (@earthtojake)
- **PR #551** (2026-10-05): In Codex, a model an agent shows opens beside its thread, never on the hidden sidebar page (@earthtojake)
- **PR #550** (2026-10-05): Release 0.7.13 (@earthtojake)
- **PR #549** (2026-10-05): Cursor's and Grok's install steps say to skip them before the command (@earthtojake)
- **PR #547** (2026-10-05): Release 0.7.12 (@earthtojake)
- **PR #544** (closed): Keep the MCP stream alive after invalid frame shapes (@rudycelekli)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

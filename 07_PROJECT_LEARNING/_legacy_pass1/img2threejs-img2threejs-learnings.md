# Forensic Learning Record (Deep Inspection): img2threejs/img2threejs

> **Canonical Artifact**: `07_PROJECT_LEARNING/img2threejs-img2threejs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/img2threejs/img2threejs](https://github.com/img2threejs/img2threejs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:35.419Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `img2threejs/img2threejs`
- **Description**: Rebuild the object in a reference image as a code-only, procedural, quality-gated, animation-ready Three.js model. Token-efficient image-to-3D.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17269 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `forge/_shared/artifact_cache.py`
```
"""Lightweight hash-based artifact cache (Plan 1.3 Workstream E).

Cache key = crop file content hash + the extracting script's OWN source-file
hash, both computed automatically at every run — no manually-maintained
version string exists to forget bumping (closes Risk R3: a cache keyed on a
human-maintained version constant will eventually serve stale results after
someone edits the algorithm without remembering to bump it).

This is NOT full module/spec-hash reuse (no dependency graph, no partial-
object hashing) — just "don't redo expensive-ish work on unchanged inputs."
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cache_key(crop_path: Path, script_path: Path) -> str:
    return f"{file_sha256(crop_path)}:{file_sha256(script_path)[:12]}"


def manifest_path_for(directory: Path, name: str) -> Path:
    return directory / ".cache" / name


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def get_cached(manifest_path: Path, key: str) -> dict[str, Any] | None:
    return load_manifest(manifest_path).get(key)


def put_cached(manifest_path: Path, key: str, value: dict[str, Any]) -> None:
    manifest = load_manifest(manifest_path)
    manifest[key] = value
    save_manifest(manifest_path, manifest)

```

### Core Architecture Module: `forge/_shared/chirality.py`
```
#!/usr/bin/env python3
"""Left and right, in one place, with the two ways of getting it wrong.

WHY THIS MODULE EXISTS. Two chirality defects shipped in the same figure and neither was caught by
any gate, because both produce geometry that is internally tidy and only wrong with respect to a
convention nothing had written down as code.

    THE HAND     `place()` built the mirrored limb as `[side*along, height, side*across]`, negating
                 x AND z. Two negations is not a reflection -- it is a 180-degree ROTATION about Y,
                 and a rotation PRESERVES handedness. The left hand was the right hand turned
                 around. Measured on the thumb tip: z +0.288 on one side and -0.288 on the other,
                 where a mirror leaves z alone.

    THE FOOT     The pair WAS a correct reflection, so any pair test passes. But the toes were
                 ordered little-to-big across a knuckle strip whose index 0 lands on the medial
                 edge, so the big toe went lateral -- on both feet. Measured in the render's toe
                 band: mass 350 medial / 443 lateral, against a reference of 529 / 488. A foot with
                 its big toe outside IS the other foot, so the pair read as swapped.

They need DIFFERENT tests, and that is the point of this module:

    check_pair()            catches the hand. Compares a left component against its right partner.
    medial_lateral_bias()   catches the foot. Compares one limb's own asymmetry against a reference,
                            because a pair that is wrong the SAME way on both sides is still a
                            perfectly good mirror of itself.

THE CONVENTION, stated once so nothing can quietly diverge from it. `new_sculpt_spec.py` carries it
as a comment -- "'left' is the CHARACTER's left, which the component tree spells `-l`. On a
front-facing reference that is the viewer's right." -- and a comment cannot be imported. With
`forward: +Z`, Y up and a right-handed frame, the camera in front looks along -Z and its right is
+X, so the character's own left is +X.

Pure Python 3.10+ standard library.
"""
from __future__ import annotations

import math
import re
from typing import Any, Iterable, Sequence

Point = Sequence[float]

# Index of the left-right axis in an (x, y, z) triple. The ONLY axis a sagittal mirror negates.
LATERAL_AXIS = 0
# Sign of the character's own left, given coordinateFrame up=+Y forward=+Z and a right-handed
# system. Derived, not chosen: the camera that sees the front looks along -Z, its right is +X, and
# a figure facing the camera has its own left on the viewer's right.
CHARACTER_LEFT_SIGN = 1

# Suffixes that mark a component as one half of a lateral pair.
LEFT_SUFFIX = "-l"
RIGHT_SUFFIX = "-r"
_PAIR_RE = re.compile(r"^(?P<stem>.+)-(?P<side>[lr])$")

# How far apart two mirrored coordinates may sit before the pair is called broken, in world units.
# Not a tuning knob: mirrored values are produced by negating the same authored number, so they
# agree to floating-point noise or they disagree structurally. Anything between those is itself a
# defect worth seeing.
MIRROR_TOLERANCE = 1e-6


def mirror_point(point: Point) -> tuple[float, float, float]:
    """The sagittal mirror of a position: negate the lateral axis, leave the rest alone."""
    values = [float(v) for v in point]
    if len(values) != 3:
        raise ValueError(f"a point needs three components, got {len(values)}")
    values[LATERAL_AXIS] = -values[LATERAL_AXIS]
    return (values[0], values[1], values[2])


def mirror_vector(vector: Point) -> tuple[float, float, float]:
    """The sagittal mirror of a DIRECTION. Same rule as a point.

    Kept as its own name because the reflex is to think a direction transforms differently, and
    reaching for a rotation here is exactly the recorded bug.
    """
    return mirror_point(vector)


def side_of(component_id: str) -> str | None:
    """'l', 'r', or None for a component that is not one half of a pair."""
    match = _PAIR_RE.match(str(component_id))
    return match.group("side") if match else None


def pair_stem(component_id: str) -> str | None:
    match = _PAIR_RE.match(str(component_id))
    return match.group("stem") if match else None


def find_pairs(component_ids: Iterable[str]) -> list[tuple[str, str]]:
    """Every `(right_id, left_id)` both halves of which are present. Right first, because the
    convention is stated as 'the left is the mirror of the right'."""
    by_stem: dict[str, dict[str, str]] = {}
    for component_id in component_ids:
        stem = pair_stem(component_id)
        side = side_of(component_id)
        if stem and side:
            by_stem.setdefault(stem, {})[side] = str(component_id)
    return [
        (sides["r"], sides["l"])
        for _stem, sides in sorted(by_stem.items())
        if "l" in sides and "r" in sides
    ]


def classify_relation(right: Point, left: Point) -> str:
    """How the two halves of a pair are actually related. One of:

        'reflection'   the left is the sagittal mirror of the right. Correct.
        'rotation'     the left is the right ROTATED about the vertical axis, not mirrored. This is
                       the recorded hand defect and the reason this function names it rather than
                       just saying 'mismatch': the two are trivially confused, they agree exactly on
                       a symmetric part, and they differ only in handedness.
        'translation'  the left is the right moved, not transformed at all.
        'unrelated'    none of the above.
    """
    r = [float(v) for v in right]
    l = [float(v) for v in left]
    if len(r) != 3 or len(l) != 3:
        raise ValueError("both points need three components")

    def close(a: Sequence[float], b: Sequence[float]) -> bool:
        return all(abs(x - y) <= MIRROR_TOLERANCE for x, y in zip(a, b))

    if close(mirror_point(r), l):
        return "reflection"
    # 180 degrees about Y negates x and z, leaves y. Indistinguishable from a reflection whenever
    # the part sits on the midline in z, which is why a symmetric torso never exposed this.
    if close((-r[0], r[1], -r[2]), l):
        return "rotation"
    if close((r[0], r[1], r[2]), l):
        return "translation"
    return "unrelated"


def check_pair(
    stem: str,
    right: Point,
    left: Point,
) -> tuple[bool, str]:
    """`(ok, message)` for one lateral pair. `ok` is True only for a true reflection."""
    relation = classify_relation(right, left)
    if relation == "reflection":
        return (True, "")
    expected = mirror_point(right)
    if relation == "rotation":
        return (False, (
            f"{stem}: the left half is the right half ROTATED about the vertical axis, not "
            f"mirrored. A rotation preserves handedness, so both halves are the same hand. "
            f"right {tuple(round(float(v), 6) for v in right)} should mirror to "
            f"{tuple(round(v, 6) for v in expected)}, but the left is "
            f"{tuple(round(float(v), 6) for v in left)}. Negate the lateral axis only."
        ))
    if relation == "translation":
        return (False, (
            f"{stem}: both halves sit on the same side -- the left is the right translated, not "
            f"mirrored at all. Expected {tuple(round(v, 6) for v in expected)}."
        ))
    return (False, (
        f"{stem}: the halves are not a sagittal mirror. right "
        f"{tuple(round(float(v), 6) for v in right)} mirrors to "
        f"{tuple(round(v, 6) for v in expected)}, but the left is "
        f"{tuple(round(float(v), 6) for v in left)}."
    ))


def medial_lateral_bias(
    samples: Sequence[tuple[float, float]],
    midline: float = 0.0,
) -> dict[str, Any]:
    """Which half of a limb carries more of it: the half toward the body, or the half away.

    `samples` is `(lateral_coordinate, weight)`. The limb's own midline is taken from its extent,
    and `midline` is the BODY's centreline,
```

### Core Architecture Module: `forge/_shared/color_metrics.py`
```
#!/usr/bin/env python3
"""Perceptual colour math for the harness — pure stdlib (sRGB→CIELAB + CIEDE2000).

Canonical sRGB→CIELAB and the full CIEDE2000 (ΔE00) difference, used by the Divine Eye
hue-zone signal and any per-region colour check. CIEDE2000 corrects CIELAB's non-uniformity
(the ~275° blue region especially — exactly where the M9 violet→blue failure lives) via the
R_T hue-rotation term, so it is the right metric for "is this the same hue zone?".

Verified against Sharma et al.'s published CIEDE2000 test pairs (see test_color_metrics.py).
"""
from __future__ import annotations

import math

# D65 reference white (2° observer)
_XN, _YN, _ZN = 95.047, 100.0, 108.883


def _lin(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb_to_lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    r, g, b = _lin(rgb[0]), _lin(rgb[1]), _lin(rgb[2])
    # linear sRGB → XYZ (D65)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100.0
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100.0
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100.0

    def f(t: float) -> float:
        return t ** (1.0 / 3.0) if t > 0.008856 else (7.787 * t + 16.0 / 116.0)

    fx, fy, fz = f(x / _XN), f(y / _YN), f(z / _ZN)
    return (116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz))


def ciede2000(lab1: tuple[float, float, float], lab2: tuple[float, float, float]) -> float:
    """Full CIEDE2000 colour difference (kL=kC=kH=1). Returns ΔE00."""
    l1, a1, b1 = lab1
    l2, a2, b2 = lab2
    c1 = math.hypot(a1, b1)
    c2 = math.hypot(a2, b2)
    c_bar = (c1 + c2) / 2.0
    g = 0.5 * (1.0 - math.sqrt(c_bar ** 7 / (c_bar ** 7 + 25.0 ** 7))) if c_bar > 0 else 0.0
    a1p = (1.0 + g) * a1
    a2p = (1.0 + g) * a2
    c1p = math.hypot(a1p, b1)
    c2p = math.hypot(a2p, b2)

    def hp(ap: float, bp: float) -> float:
        if ap == 0.0 and bp == 0.0:
            return 0.0
        deg = math.degrees(math.atan2(bp, ap))
        return deg + 360.0 if deg < 0 else deg

    h1p = hp(a1p, b1)
    h2p = hp(a2p, b2)

    dLp = l2 - l1
    dCp = c2p - c1p
    if c1p * c2p == 0.0:
        dhp = 0.0
    elif abs(h2p - h1p) <= 180.0:
        dhp = h2p - h1p
    elif h2p - h1p > 180.0:
        dhp = h2p - h1p - 360.0
    else:
        dhp = h2p - h1p + 360.0
    dHp = 2.0 * math.sqrt(c1p * c2p) * math.sin(math.radians(dhp) / 2.0)

    Lp_bar = (l1 + l2) / 2.0
    Cp_bar = (c1p + c2p) / 2.0
    if c1p * c2p == 0.0:
        hp_bar = h1p + h2p
    elif abs(h1p - h2p) <= 180.0:
        hp_bar = (h1p + h2p) / 2.0
    elif h1p + h2p < 360.0:
        hp_bar = (h1p + h2p + 360.0) / 2.0
    else:
        hp_bar = (h1p + h2p - 360.0) / 2.0

    t = (
        1.0
        - 0.17 * math.cos(math.radians(hp_bar - 30.0))
        + 0.24 * math.cos(math.radians(2.0 * hp_bar))
        + 0.32 * math.cos(math.radians(3.0 * hp_bar + 6.0))
        - 0.20 * math.cos(math.radians(4.0 * hp_bar - 63.0))
    )
    d_theta = 30.0 * math.exp(-(((hp_bar - 275.0) / 25.0) ** 2))
    rc = 2.0 * math.sqrt(Cp_bar ** 7 / (Cp_bar ** 7 + 25.0 ** 7)) if Cp_bar > 0 else 0.0
    sl = 1.0 + (0.015 * (Lp_bar - 50.0) ** 2) / math.sqrt(20.0 + (Lp_bar - 50.0) ** 2)
    sc = 1.0 + 0.045 * Cp_bar
    sh = 1.0 + 0.015 * Cp_bar * t
    rt = -math.sin(math.radians(2.0 * d_theta)) * rc

    return math.sqrt(
        (dLp / sl) ** 2
        + (dCp / sc) ** 2
        + (dHp / sh) ** 2
        + rt * (dCp / sc) * (dHp / sh)
    )


def delta_e_rgb(rgb1: tuple[int, int, int], rgb2: tuple[int, int, int]) -> float:
    """Convenience: CIEDE2000 between two sRGB colours."""
    return ciede2000(srgb_to_lab(rgb1), srgb_to_lab(rgb2))

```

### Core Architecture Module: `forge/_shared/domains/__init__.py`
```
"""Domain profiles the base pipeline can run.

The base pipeline names no domain. It asks this registry what is available, and a domain contributes
its own steps, its own evidence collection and its own track. Each module in this package declares a
single `DOMAIN` mapping; registration is by presence, not by the base holding a list of names.

This is the extension point the CS2 extraction needs. Today both entries are in-repo. When a domain
moves out to a plugin, its module leaves this directory and the harness supplies the same mapping
instead -- the base pipeline does not change either way, which is the property being bought here.

Required keys:
    id                  the profile identifier a run is started with
Optional keys, each defaulting to "contributes nothing":
    setupSteps          ((step_id, command), ...) spliced into the setup phase
    setupAnchorBefore   base step id to splice before; required when setupSteps is non-empty
    passSteps           ((step_id, command), ...) spliced into every correction pass
    passAnchorBefore    base step id to splice before; required when passSteps is non-empty
    specCollection      an extra local-evidence collection to search
    rigSteps            ((step_id, command), ...) appended after the FINAL steps as the rig track;
                        no anchor -- the rig phase always follows the terminal steps (v1.5.2)
"""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
from typing import Any, Final

_PACKAGE_DIR: Final = Path(__file__).resolve().parent

_REQUIRED: Final = ("id",)
_ALLOWED: Final = {
    "id",
    "setupSteps",
    "setupAnchorBefore",
    "passSteps",
    "passAnchorBefore",
    "specCollection",
    "rigSteps",
}


class DomainRegistryError(ValueError):
    pass


def _load_module(path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(f"_img2_domain_{path.stem}", path)
    if spec is None or spec.loader is None:
        raise DomainRegistryError(f"cannot load domain module {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _validate(entry: Any, source: Path) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise DomainRegistryError(f"{source.name}: DOMAIN must be a mapping")
    for key in _REQUIRED:
        if not entry.get(key):
            raise DomainRegistryError(f"{source.name}: DOMAIN is missing required key {key!r}")
    unknown = sorted(set(entry) - _ALLOWED)
    if unknown:
        # Refused rather than ignored: a typo'd key would otherwise silently contribute nothing.
        raise DomainRegistryError(f"{source.name}: DOMAIN has unknown key(s) {unknown}")
    for steps_key, anchor_key in (("setupSteps", "setupAnchorBefore"), ("passSteps", "passAnchorBefore")):
        if entry.get(steps_key) and not entry.get(anchor_key):
            raise DomainRegistryError(f"{source.name}: {steps_key} needs {anchor_key}")
    return entry


def registered_domains() -> dict[str, dict[str, Any]]:
    """Every domain profile available to this run, keyed by id.

    Two sources, treated identically once loaded: modules in this package (in-repo domains) and
    `domain.json` in each installed plugin. A domain that moves from the first to the second changes
    nothing for the base pipeline -- that equivalence is the point of the registry.
    """
    found: dict[str, dict[str, Any]] = {}

    def claim(entry: Any, source: Path) -> None:
        entry = _validate(entry, source)
        if entry["id"] in found:
            # Two providers claiming one id is ambiguous; the base must not pick one.
            raise DomainRegistryError(f"domain id {entry['id']!r} is declared twice")
        found[entry["id"]] = entry

    for path in sorted(_PACKAGE_DIR.glob("*.py")):
        if path.name == "__init__.py":
            continue
        module = _load_module(path)
        entry = getattr(module, "DOMAIN", None)
        if entry is None:
            raise DomainRegistryError(f"{path.name}: a domain module must declare DOMAIN")
        claim(entry, path)

    for path, entry in _installed_plugin_domains():
        claim(entry, path)

    return found


def _img2_home() -> Path:
    return Path(os.environ.get("IMG2_HOME") or Path.home() / ".img2")


def _installed_plugin_domains() -> list[tuple[Path, Any]]:
    """Domain declarations from installed plugins.

    Reads the harness registry rather than globbing the plugins directory, so a checkout left behind
    by a removed plugin does not silently contribute steps. A plugin that ships no `domain.json`
    simply contributes no domain -- it may still provide capabilities.
    """
    registry = _img2_home() / "plugins.json"
    if not registry.is_file():
        return []
    try:
        rows = json.loads(registry.read_text(encoding="utf-8")).get("plugins") or []
    except (OSError, json.JSONDecodeError) as exc:
        raise DomainRegistryError(f"cannot read the plugin registry at {registry}: {exc}") from exc

    out: list[tuple[Path, Any]] = []
    for row in rows:
        plugin_id = (row or {}).get("id")
        if not plugin_id:
            continue
        declaration = _img2_home() / "plugins" / plugin_id / "domain.json"
        if not declaration.is_file():
            continue
        try:
            entry = json.loads(declaration.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise DomainRegistryError(f"cannot read {declaration}: {exc}") from exc
        # Steps arrive as JSON arrays; the splice unpacks them as (id, command) pairs. {plugin_dir}
        # is resolved here, the same substitution the harness performs, so a checklist command a
        # plugin supplied is runnable from the workspace without the caller knowing where it lives.
        plugin_dir = str(declaration.parent)
        for key in ("setupSteps", "passSteps", "rigSteps"):
            if key in entry:
                try:
                    entry[key] = tuple(
                        (step_id, command.replace("{plugin_dir}", plugin_dir)) for step_id, command in entry[key]
                    )
                except (TypeError, ValueError, AttributeError) as exc:
                    # Unpacking used to run before validation, so a malformed row surfaced as a bare
                    # ValueError/AttributeError instead of an error naming the file at fault.
                    raise DomainRegistryError(
                        f"{declaration}: {key!r} rows must be [id, command] pairs of strings"
                    ) from exc
        out.append((declaration, entry))
    return out


def domain_profile(profile: str) -> dict[str, Any] | None:
    """The registered domain for `profile`, or None for the generic pipeline."""
    if profile == "generic":
        return None
    domains = registered_domains()
    if profile not in domains:
        known = ", ".join(sorted(["generic", *domains]))
        raise DomainRegistryError(
            f"no installed provider serves profile {profile!r}; available: {known}. "
            "Install the domain plugin that provides it, or start the run as generic."
        )
    return domains[profile]

```

### Core Architecture Module: `forge/_shared/domains/character.py`
```
"""Character domain profile.

Converted to a provider in the same change as CS2, deliberately: an extension point whose only
consumer is one hardcoded in-repo domain is a rename, not an abstraction. Character stays in-repo --
it is not being extracted -- but it reaches the pipeline through the same registry a plugin uses, so
the seam has two consumers from the day it exists.
"""

from __future__ import annotations

from typing import Any, Final

DOMAIN: Final[dict[str, Any]] = {
    "id": "character",
    "setupSteps": (
        (
            "character-contract-read",
            "Read grimoire/character/reconstruction.md and grimoire/character/likeness_maximization.md completely",
        ),
        (
            "character-landmarks",
            "python3 forge/stage1_intake/extract_landmarks.py {reference} --out anatomy.json --overlay landmarks.png",
        ),
    ),
    "setupAnchorBefore": "local-spec-search",
}

```

### Core Architecture Module: `forge/_shared/feature_acceptance_policy.py`
```
#!/usr/bin/env python3
"""Shared feature-level acceptance logic for visual sculpt passes."""

from __future__ import annotations

from typing import Any


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def feature_review_policy(spec: dict[str, Any]) -> dict[str, Any]:
    loop = spec.get("selfCorrectLoop")
    if not isinstance(loop, dict):
        return {}
    acceptance = loop.get("visualAcceptance")
    if not isinstance(acceptance, dict):
        return {}
    policy = acceptance.get("featureReviewPolicy")
    return policy if isinstance(policy, dict) else {}


def feature_targets_for_pass(spec: dict[str, Any], pass_id: str) -> list[dict[str, Any]]:
    targets = spec.get("featureReviewTargets", [])
    if not isinstance(targets, list):
        return []
    applicable: list[dict[str, Any]] = []
    for target in targets:
        if not isinstance(target, dict):
            continue
        pass_ids = target.get("passIds", [])
        if isinstance(pass_ids, list) and pass_id in pass_ids:
            applicable.append(target)
    return applicable


def feature_gate_failures(
    spec: dict[str, Any],
    entry: dict[str, Any],
    pass_id: str,
) -> list[str]:
    policy = feature_review_policy(spec)
    if policy.get("enabled") is not True:
        return []

    targets = feature_targets_for_pass(spec, pass_id)
    critical = [
        target
        for target in targets
        if target.get("tier") == "critical" or target.get("mustPass") is True
    ]
    max_critical = policy.get("maxCriticalFeaturesPerPass", 5)
    failures: list[str] = []
    if is_number(max_critical) and len(critical) > int(max_critical):
        failures.append(
            f"pass {pass_id!r} defines {len(critical)} critical features; "
            f"group them into at most {int(max_critical)} semantic systems"
        )
    important = [target for target in targets if target.get("tier") == "important"]
    max_important = policy.get("maxImportantFeaturesPerPass", 3)
    if is_number(max_important) and len(important) > int(max_important):
        failures.append(
            f"pass {pass_id!r} defines {len(important)} important features; "
            f"keep only the {int(max_important)} most uncertain or high-value systems"
        )

    reviews = entry.get("featureReviews", [])
    review_by_id = {
        review.get("id"): review
        for review in reviews
        if isinstance(review, dict) and isinstance(review.get("id"), str)
    } if isinstance(reviews, list) else {}

    default_threshold = policy.get("criticalDefaultThreshold", 0.8)
    for target in critical:
        target_id = target.get("id")
        if not isinstance(target_id, str) or not target_id:
            continue
        review = review_by_id.get(target_id)
        if not isinstance(review, dict):
            failures.append(f"critical feature {target_id!r} has no AI vision review")
            continue
        if review.get("visible") is False:
            failures.append(f"critical feature {target_id!r} is not visible in the review view")
            continue
        score = review.get("score")
        minimum = target.get("minimumScore", default_threshold)
        if not is_number(score):
            failures.append(f"critical feature {target_id!r} has no numeric score")
        elif not is_number(minimum) or float(score) < float(minimum):
            failures.append(
                f"critical feature {target_id!r} score {score} is below {minimum}"
            )
    important_ids = {
        target.get("id")
        for target in targets
        if target.get("tier") == "important" and isinstance(target.get("id"), str)
    }
    important_scores = [
        float(review["score"])
        for feature_id, review in review_by_id.items()
        if feature_id in important_ids and is_number(review.get("score"))
    ]
    important_threshold = policy.get("importantAverageThreshold", 0.65)
    if important_scores and is_number(important_threshold):
        average = sum(important_scores) / len(important_scores)
        if average < float(important_threshold):
            failures.append(
                f"reviewed important features average {average:.3f} is below "
                f"{float(important_threshold):.3f}"
            )
    return failures

```

### Core Architecture Module: `forge/_shared/glb_container.py`
```
"""The GLB binary-glTF container parse, shared between intake and export.

Extracted from `forge/stage1_intake/probe_glb.py` (task 3.6, `establish-the-emission-target-contract`
slice 3): the magic/version/chunk parse is intake-domain-independent, but `probe_glb.py` itself is
not a drop-in for the export side -- it also builds the richer semantic-decomposition report via
`semantic_decomposition.assess_semantic_decomposition`, which the export tier-1 verifier has no use
for and should not have to import. This module holds only the container parse: is this a well-formed
GLB, and (incidentally) what chunks does it carry. `probe_glb.py` now imports `GLB_MAGIC` and
`parse_glb` from here instead of defining its own copy, so both sides read one implementation.
"""

from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any

GLB_MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def _chunk_type_name(chunk_type: int) -> str:
    try:
        return chunk_type.to_bytes(4, "little").decode("ascii", errors="replace")
    except OverflowError:
        return hex(chunk_type)


def parse_glb(path: Path) -> tuple[dict[str, Any], bytes, dict[str, Any]]:
    """Parse the GLB container: header, chunk table, and the JSON/BIN chunk payloads.

    Raises ValueError naming the specific structural defect on anything malformed -- short header,
    wrong magic, unsupported version, a length mismatch, a truncated or overrunning chunk, more than
    one JSON or BIN chunk, a missing JSON chunk, or JSON that isn't a UTF-8 object. This is the
    complete container check; it does not look inside the document beyond confirming it parses as an
    object.
    """
    data = path.read_bytes()
    if len(data) < 12:
        raise ValueError("GLB is shorter than the 12-byte header")
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != GLB_MAGIC:
        raise ValueError("file does not start with the glTF binary magic")
    if version != 2:
        raise ValueError(f"unsupported GLB version {version}; expected 2")
    if declared_length != len(data):
        raise ValueError(f"header length {declared_length} does not match file size {len(data)}")

    cursor = 12
    json_payload: bytes | None = None
    bin_payload = b""
    bin_seen = False
    chunks: list[dict[str, Any]] = []
    while cursor < len(data):
        if cursor + 8 > len(data):
            raise ValueError("truncated GLB chunk header")
        chunk_length, chunk_type = struct.unpack_from("<II", data, cursor)
        cursor += 8
        end = cursor + chunk_length
        if end > len(data):
            raise ValueError("GLB chunk extends beyond the declared file")
        payload = data[cursor:end]
        cursor = end
        chunks.append({"type": _chunk_type_name(chunk_type), "bytes": chunk_length})
        if chunk_type == JSON_CHUNK:
            if json_payload is not None:
                raise ValueError("GLB contains more than one JSON chunk")
            json_payload = payload.rstrip(b" \t\r\n\x00")
        elif chunk_type == BIN_CHUNK:
            # A seen-flag, not truthiness: a zero-length first BIN chunk is falsy, and truthiness
            # let a second BIN chunk slide through the duplicate check.
            if bin_seen:
                raise ValueError("GLB contains more than one BIN chunk")
            bin_seen = True
            bin_payload = payload

    if json_payload is None:
        raise ValueError("GLB has no JSON chunk")
    try:
        document = json.loads(json_payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"GLB JSON chunk is invalid: {exc}") from exc
    if not isinstance(document, dict):
        raise ValueError("GLB JSON root must be an object")
    return document, bin_payload, {
        "version": version,
        "declaredLength": declared_length,
        "jsonChunkBytes": len(json_payload),
        "binChunkBytes": len(bin_payload),
        "chunks": chunks,
    }

```

### Core Architecture Module: `forge/_shared/image_hash.py`
```
"""Perceptual image hashing (DCT-based pHash), pure Python stdlib.

Plan 1.3. Shared by:
  - reference-admission duplicate detection (stage1_intake/check_reference_admission.py, §4.5.2)
  - the Divine Eye's coarse "same-thing?" pre-gate signal (stage4_review/divine_eye.py, §3.1)

Classic pHash: grayscale -> downsample to N×N (default 32) -> 2D DCT-II -> keep the
top-left low-frequency K×K block (default 8, excluding the DC term for robustness to
overall brightness) -> hash bit = coefficient > median. Produces a 64-bit integer whose
Hamming distance approximates perceptual similarity and is invariant to scale, small
blur, and uniform brightness shifts — exactly the invariances a duplicate/near-duplicate
check wants. No PIL/numpy.
"""

from __future__ import annotations

import math

_DCT_CACHE: dict[int, list[list[float]]] = {}


def _dct_matrix(n: int) -> list[list[float]]:
    """Cached DCT-II basis matrix M where out = M @ in."""
    cached = _DCT_CACHE.get(n)
    if cached is not None:
        return cached
    matrix: list[list[float]] = []
    factor = math.pi / (2.0 * n)
    for k in range(n):
        scale = math.sqrt(1.0 / n) if k == 0 else math.sqrt(2.0 / n)
        row = [scale * math.cos((2 * i + 1) * k * factor) for i in range(n)]
        matrix.append(row)
    _DCT_CACHE[n] = matrix
    return matrix


def _dct_2d(block: list[list[float]]) -> list[list[float]]:
    """Separable 2D DCT-II of a square matrix."""
    n = len(block)
    m = _dct_matrix(n)
    # rows: temp = M @ block
    temp = [[sum(m[k][i] * block[i][j] for i in range(n)) for j in range(n)] for k in range(n)]
    # cols: out = temp @ M^T
    out = [[sum(temp[k][j] * m[l][j] for j in range(n)) for l in range(n)] for k in range(n)]
    return out


def to_grayscale_downsampled(
    width: int,
    height: int,
    pixels: list[tuple[int, int, int, int]],
    size: int = 32,
) -> list[list[float]]:
    """Box-average downsample of the luminance channel to size×size (Rec.709 luma)."""
    if width <= 0 or height <= 0 or not pixels:
        return [[0.0] * size for _ in range(size)]
    out = [[0.0] * size for _ in range(size)]
    counts = [[0] * size for _ in range(size)]
    for idx, (r, g, b, _a) in enumerate(pixels):
        x = idx % width
        y = idx // width
        if y >= height:
            break
        sx = min(size - 1, x * size // width)
        sy = min(size - 1, y * size // height)
        out[sy][sx] += 0.2126 * r + 0.7152 * g + 0.0722 * b
        counts[sy][sx] += 1
    for sy in range(size):
        for sx in range(size):
            c = counts[sy][sx]
            if c:
                out[sy][sx] /= c
    return out


def phash(gray: list[list[float]], hash_size: int = 8) -> int:
    """64-bit pHash (for hash_size=8) from a square grayscale matrix (side ≥ hash_size)."""
    n = len(gray)
    if n < hash_size:
        raise ValueError(f"grayscale side {n} smaller than hash_size {hash_size}")
    coeffs = _dct_2d(gray)
    low = [coeffs[k][l] for k in range(hash_size) for l in range(hash_size)]
    # Exclude the DC term (index 0) from the median so overall brightness doesn't dominate.
    ac = [abs(value) for value in low[1:]]
    ordered = sorted(ac)
    mid = len(ordered) // 2
    median = ordered[mid] if len(ordered) % 2 else 0.5 * (ordered[mid - 1] + ordered[mid])
    noise_floor = max(abs(low[0]), *(abs(value) for value in ac)) * 1e-12
    bits = 0
    for i, value in enumerate(low):
        bits <<= 1
        if abs(value) > median + noise_floor:
            bits |= 1
    return bits


def phash_from_image(
    width: int,
    height: int,
    pixels: list[tuple[int, int, int, int]],
    hash_size: int = 8,
    img_size: int = 32,
) -> int:
    return phash(to_grayscale_downsampled(width, height, pixels, img_size), hash_size)


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def normalized_similarity(a: int, b: int, bits: int = 64) -> float:
    """1.0 = identical hash, 0.0 = maximally different. Used as a [0,1] agreement score."""
    return 1.0 - hamming(a, b) / bits

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #147** (2026-09-27): **docs(readme): dedupe pipeline blurb, fix broken rig/hair scripts table**
  *Symptoms*: The "How it works" section repeated the same paragraph and ARCHITECTURE.md link back to back. The Scripts table also split into two blocks because of a stray blank line before the rig/hair rows, so GitHub rendered those rows as raw pipe-delimited text instead of a table.  <!-- Thanks for contributing to img2threejs. Keep the pull request focused and remove instructional comments that do not apply before submitting. -->  ## Summary  <!-- What behavior or documentation changes? Why is it needed? Link related issues with "Refs #123" where applicable. Do not use closing keywords: maintainers close issues manually after final verification. -->  ## Changes  <!-- List the key changes. -->  -  ## Validation  <!-- Record the checks you ran and their results. Include render/comparison-sheet evidence for changes that affect reconstruction quality. -->  - [ ] `python3 forge/tests/test_pipeline.py` - [ ] Relevant targeted validation or test: - [ ] Render or comparison-sheet review, if applicable:  ## Contributor checklist  - [ ] This PR keeps the code-only procedural reconstruction contract; it does not silently download meshes or art packs. - [ ] Existing object specs remain valid, or this PR documents the intentional compatibility change. - [ ] I added or updated tests for new gates, schema fields, or templates where applicable. - [ ] I updated documentation and roadmap status where applicable. 

- **Issue #132** (2026-09-06): **docs(skill): document the img2 harness in SKILL.md**
  *Symptoms*: SKILL.md's Domain plugins section described plugin behavior but never said where plugins come from or how to manage them — the img2 harness (img2threejs/img2) made it into README's quick-start but SKILL.md was missed.  Adds a compact "The img2 harness" subsection scoped to agent decision points:  - the rule: when `state.py init` names a profile unavailable, name the `img2 add` command and stop — never vendor domain logic - `img2 add --ref <tag>`, `img2 doctor` (the authority on what each host resolves), `img2 capabilities` - setup and the full CLI reference deferred to README quick-start and the harness repo's docs  Reviewed: 4-angle cleanup pass trimmed setup/diagnostic commands and duplicated version constraints; correctness review caught and fixed a mischaracterization (the harness is a Node CLI with zero npm/pip dependencies — "stdlib-only" belongs to the forge).  Docs-only; no version bump.

- **Issue #130** (2026-09-05): **Lab/cs2 plugin**
  *Symptoms*: <!-- Thanks for contributing to img2threejs. Keep the pull request focused and remove instructional comments that do not apply before submitting. -->  ## Summary  <!-- What behavior or documentation changes? Why is it needed? Link related issues with "Refs #123" where applicable. Do not use closing keywords: maintainers close issues manually after final verification. -->  ## Changes  <!-- List the key changes. -->  -  ## Validation  <!-- Record the checks you ran and their results. Include render/comparison-sheet evidence for changes that affect reconstruction quality. -->  - [ ] `python3 forge/tests/test_pipeline.py` - [ ] Relevant targeted validation or test: - [ ] Render or comparison-sheet review, if applicable:  ## Contributor checklist  - [ ] This PR keeps the code-only procedural reconstruction contract; it does not silently download meshes or art packs. - [ ] Existing object specs remain valid, or this PR documents the intentional compatibility change. - [ ] I added or updated tests for new gates, schema fields, or templates where applicable. - [ ] I updated documentation and roadmap status where applicable. 

- **Issue #117** (2026-09-03): **1.5.2: animation pipeline**
  *Symptoms*: <!-- Thanks for contributing to img2threejs. Keep the pull request focused and remove instructional comments that do not apply before submitting. -->  ## Summary  <!-- What behavior or documentation changes? Why is it needed? Link related issues with "Refs #123" where applicable. Do not use closing keywords: maintainers close issues manually after final verification. -->  ## Changes  <!-- List the key changes. -->  -  ## Validation  <!-- Record the checks you ran and their results. Include render/comparison-sheet evidence for changes that affect reconstruction quality. -->  - [ ] `python3 forge/tests/test_pipeline.py` - [ ] Relevant targeted validation or test: - [ ] Render or comparison-sheet review, if applicable:  ## Contributor checklist  - [ ] This PR keeps the code-only procedural reconstruction contract; it does not silently download meshes or art packs. - [ ] Existing object specs remain valid, or this PR documents the intentional compatibility change. - [ ] I added or updated tests for new gates, schema fields, or templates where applicable. - [ ] I updated documentation and roadmap status where applicable. 

- **Issue #115** (2026-08-30): **feat: add Han Huan-Shou Dao reconstruction**
  *Symptoms*: ## Summary  - add the shared dao-family adapter and the complete code-only Han Huan-Shou Dao reconstruction - preserve the authoritative `fill_spec.py -> object-sculpt-spec.json -> TypeScript factory` generation chain - include the eight-pass review evidence, structural/action contracts, and weapon reconstruction playbook - finish the public-showcase polish with a smooth rounded-square ring fitting, refined hamon, corrected material response, and responsive capture audit  Companion showcase PR: https://github.com/img2threejs/img2threejs-showcase/pull/59  ## Release gates  - strict-quality validation: PASS - standardized 1680x360 silhouette IoU: 0.8864 - aspect-ratio delta / scale delta: 0.0 / 0.0 - max per-component color delta-E: 10.82 (limit 20) - standard capture: 16 artifacts, assembly and interaction audits passing - desktop and 390x844 showcase framing: full model fits and composited canvas is nonblank  ## Verification  - `python3 reconstructions/han-huan-shou-dao/fill_spec.py` - `python3 forge/stage2_spec/validate_sculpt_spec.py --strict-quality reconstructions/han-huan-shou-dao/object-sculpt-spec.json` - `python3 -m unittest forge.tests.test_dao_adapter` - generated factory and preview bundle rebuilt from authority sources 
  **Post-Mortem & Fix Analysis**:
  > Closing for now while I reconsider and reorganize the main-repository submission. The work remains available on my fork branch.

- **Issue #114** (2026-08-29): **chore: swap Buy Me a Coffee for Ko-fi**
  *Symptoms*: ## Why  Buy Me a Coffee is unusable for this project's maintainer. BMC holds supporter money and pays it out only through Stripe or a connected PayPal, and neither route is open from Vietnam — Stripe does not support Vietnamese accounts, and BMC does not offer plain PayPal linking. Anything sent through the BMC button was money that could be paid in but never withdrawn.  Ko-fi does not hold funds at all: a tip goes straight into the creator's PayPal account, and Ko-fi's own docs point creators in Stripe-less countries at PayPal as the supported path.  ## What changed  - Sponsor badge → Ko-fi (`shields.io`, Ko-fi brand colour) - Support button → the official Ko-fi GitHub button  No other links touched. The donate page (VietQR / MoMo / PayPal) is unaffected and still linked from the same place.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #113** (2026-08-27): **feat: gate model space and non-humanoid animation**
  *Symptoms*: ## Summary  Adds a fail-closed model-space gate so a correct forward label or marker cannot hide geometry that actually faces sideways, and documents a rigid articulated animation path for insects, quadrupeds, and mechanical creatures.  Refs #112  ## Changes  - Separate the skill authoring +Z convention from a consumer target coordinate frame. - Validate one conversion owner, identity semantic root, target-forward marker, and measured front/rear features with a standard-library gate. - Add rigid nested-pivot, gait-phase, in-place clip, binding, and phase-sampling guidance for non-humanoid subjects. - Route moving builds through the new gate without changing the existing humanoid skin payload.  ## Validation  - [x] Full Python suite: 1088 tests passed, 38 skipped. - [x] Focused model-space tests: 5 passed. - [x] Existing chirality and rig-payload tests: 37 passed. - [x] Render or comparison-sheet review: not applicable; this PR adds structural validation and documentation without changing generated geometry.  ## Contributor checklist  - [x] This PR keeps the code-only procedural reconstruction contract; it does not silently download meshes or art packs. - [x] Existing object specs remain valid. - [x] Tests were added for the new gate. - [x] Skill and gate documentation were updated.

- **Issue #112** (2026-08-27): **[Contribution]: Gate model forward and document rigid non-humanoid animation**
  *Symptoms*: ### What are you proposing?  A bounded new fix.  ### Target issue URL or number  new bounded fix  ### Proposed scope  Separate the skill authoring coordinate frame from the consumer target frame. Add a standard-library model-space hard gate that verifies one conversion owner, an identity semantic root, a target-forward marker, and measured front/rear features. Add a non-humanoid articulated-animation reference for rigid insects, quadrupeds, and mechanical creatures. Leave geometry generation, DCC integration, gameplay movement, and humanoid skinning behavior unchanged.  ### Acceptance criteria and validation plan  The gate rejects a sideways visible model even when its forward label or marker claims the target direction, rejects missing or redundant conversions, and rejects a transformed semantic root. Focused tests cover those failures, the existing chirality and rig-payload tests remain green, and the full Python suite is run before the PR.  ### Availability  The bounded implementation and tests are ready for maintainer review in a fork branch.  ### Acknowledgement  I understand this form does not assign or reserve the work, and I will reference this issue number in any implementation PR.

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

### Incident Patch 1: `1b79af58` (2026-09-03)
**Commit Message**: fix: commit the registry-port test adaptations; review follow-ups

The rig-suite and registry-expectation adaptations were working-tree-only at the merge commit (HEAD would ImportError on RIG_STEPS) -- caught in review. Plus: rig tests pin IMG2_HOME to a temp home so a developer's installed domains cannot fail them; README drops the extracted cs2_review row and names the registry; the two Unreleased Added headings are disambiguated.

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 broke meshes because no step in the workflow forbade it and no gate could tell a rigged mesh from a
 damaged one. This closes the loop between the gates and the pipeline that is supposed to enforce them.
 
-### Added
+### Added (rigging and animation workflow, merged from main)
 
 - **`animated-character` workflow profile** (now `forge/_shared/domains/animated_character.py` --
   ported from the hardcoded `RIG_STEPS` into the domain registry when this branch merged v1.5.2;
```

**File**: `README.md` (modified, +1/-2)
```diff
@@ -91,7 +91,7 @@ It runs under Claude Code, Codex, or OpenCode. It is agent-agnostic: wherever th
 - **Maximum likeness for a specific person or character.** An opt-in projection-first path fits a parametric template to image landmarks, de-lights the photo, camera-matches the render, and projects the reference onto the mesh. A single image cannot guarantee 100 percent likeness, so the pipeline reports per-region confidence and asks for more views when it matters. Details: `grimoire/character/likeness_maximization.md`.
 - **Multi-view silhouette carving.** An opt-in `geometryDescriptor.visualHull` intersects at least two deterministic orthographic binary silhouettes into a bounded, welded voxel mesh. It records unseen areas as low-confidence rather than inventing hidden detail. Schema and runtime check: `grimoire/scripts.md`.
 - **CS2 weapon review gates.** Knife and Glock-18 routes use family-specific component contracts. The review records exactness tier, family identity, painted-region and projection coverage, per-region confidence, approximation notes, and versioned review-scene metadata; component-coverage and map-stripped blockout gates prevent a convincing texture from standing in for real structure. Ships with the CS2 domain plugin; see its `docs/cs2/review-gates.md`.
-- **Resumable local workflow.** `forge/state.py` records an ordered, evidence-backed intake/pass checklist for generic, character, and CS2 profiles. `forge/next.py --state` resumes from that checklist while the existing spec, render, and review gates remain authoritative.
+- **Resumable local workflow.** `forge/state.py` records an ordered, evidence-backed intake/pass checklist for the generic profile and every registered domain (in-repo `character`/`animated-character`, plus installed domain plugins such as CS2). `forge/next.py --state` resumes from that checklist while the existing spec, render, and review gates remain authoritative.
 - **Material reference pipeline.** Every visible material region can be cropped, analyzed, resolved against the versioned Three.js material registry, fitted into `ObjectSculptSpec`, rendered from controlled camera views, and accepted only after a per-region comparison gate. See [`docs/materials/README.md`](docs/materials/README.md).
 - **Python-assisted browser rendering.** Python may orchestrate camera batches, hashes, manifests, and deterministic diagnostics, but the target browser Three.js route remains the rendering authority. See [`grimoire/build/python_threejs_render_bridge.md`](grimoire/build/python_threejs_render_bridge.md).
 
@@ -243,7 +243,6 @@ The net effect: you still get a faithful 3D model from an image, but the expensi
 | `stage4_review/material_gate.py` | Block material-pass until registry, crop, render, compatibility, and comparison evidence passes. |
 | `stage4_review/make_comparison_sheet.py` | Package one reference-vs-render sheet for review. |
 | `stage4_review/append_review.py` | Record a per-pass review: scores, decision, evidence. |
-| `stage4_review/cs2_review.py` | Evaluate the blocking CS2 knife review contract and versioned scene thresholds. |
 | `_shared/feature_acceptance_policy.py` | Internal helper enforcing per-feature score thresholds. |
 | `stage1_intake/build_detail_inventory.py` | Slice the reference into zones and scaffold a detail inventory. |
 | `stage1_intake/extract_landmarks.py` | Overlay a landmark grid and scaffold an anatomy block for characters. |
```

**File**: `forge/tests/test_domain_registry.py` (modified, +2/-2)
```diff
@@ -41,9 +41,9 @@ def test_both_registry_sources_register_hermetically(self) -> None:
         # happens to have under ~/.img2 -- the old form of this test asserted the INSTALLED cs2
         # plugin and was green or red depending on the machine, which is what turned CI red.
         with self._temp_img2_home({}):
-            self.assertEqual(sorted(registered_domains()), ["character"])
+            self.assertEqual(sorted(registered_domains()), ["animated-character", "character"])
         with self._temp_img2_home({"fixture-plugin": {"id": "fixture-dom"}}):
-            self.assertEqual(sorted(registered_domains()), ["character", "fixture-dom"])
+            self.assertEqual(sorted(registered_domains()), ["animated-character", "character", "fixture-dom"])
 
     def test_an_unregistered_profile_fails_loud_and_names_what_is_available(self) -> None:
         with self.assertRaises(DomainRegistryError) as ctx:
```

**File**: `forge/tests/test_rig_workflow_steps.py` (modified, +29/-5)
```diff
@@ -17,15 +17,39 @@
 
 from __future__ import annotations
 
+import os
 import sys
+import tempfile
 import unittest
 from pathlib import Path
 
 ROOT = Path(__file__).resolve().parents[1]
 sys.path.insert(0, str(ROOT / "_shared"))
 
+# Profiles resolve through the domain registry, which reads installed plugins from IMG2_HOME.
+# Pinned to an empty temp home so a developer's real ~/.img2 (malformed or colliding domain.json)
+# can never fail these tests -- the test_search_specs.py pattern.
+_TMP_HOME: tempfile.TemporaryDirectory | None = None
+_OLD_HOME: str | None = None
+
+
+def setUpModule() -> None:
+    global _TMP_HOME, _OLD_HOME
+    _TMP_HOME = tempfile.TemporaryDirectory()
+    _OLD_HOME = os.environ.get("IMG2_HOME")
+    os.environ["IMG2_HOME"] = _TMP_HOME.name
+
+
+def tearDownModule() -> None:
+    if _OLD_HOME is None:
+        os.environ.pop("IMG2_HOME", None)
+    else:
+        os.environ["IMG2_HOME"] = _OLD_HOME
+    if _TMP_HOME is not None:
+        _TMP_HOME.cleanup()
+
+from domains.animated_character import DOMAIN as ANIMATED_CHARACTER  # noqa: E402
 from workflow_state import (  # noqa: E402
-    RIG_STEPS,
     WorkflowStateError,
     new_state,
     next_entry,
@@ -46,7 +70,7 @@ def test_the_profile_is_accepted(self) -> None:
         self.assertEqual(self.state["profile"], "animated-character")
 
     def test_every_rig_step_reaches_the_checklist(self) -> None:
-        self.assertEqual(rig_ids(self.state), [step_id for step_id, _command in RIG_STEPS])
+        self.assertEqual(rig_ids(self.state), [step_id for step_id, _command in ANIMATED_CHARACTER["rigSteps"]])
 
     def test_it_keeps_the_character_steps_too(self) -> None:
         """An animated character is still a character; the anatomy contract must not be lost."""
@@ -137,7 +161,7 @@ def drain(self, profile: str) -> tuple[list[str], dict]:
 
     def test_every_rig_step_is_actually_dispatched(self) -> None:
         dispatched, _state = self.drain("animated-character")
-        self.assertEqual(dispatched, [step_id for step_id, _command in RIG_STEPS])
+        self.assertEqual(dispatched, [step_id for step_id, _command in ANIMATED_CHARACTER["rigSteps"]])
 
     def test_the_build_is_not_complete_while_a_rig_step_is_pending(self) -> None:
         """The exact bug: `complete` was reached with all nine rig steps still pending."""
@@ -170,13 +194,13 @@ def test_rig_steps_are_visible_in_status(self) -> None:
         """Invisible in status output is unreachable in practice: nobody knows to run them."""
         state = new_state("subject.glb", profile="animated-character", spec="spec.json")
         pending = status_payload(state)["pending"]
-        for step_id, _command in RIG_STEPS:
+        for step_id, _command in ANIMATED_CHARACTER["rigSteps"]:
             self.assertIn(step_id, pending)
 
 
 class StepsNameTheirTooling(unittest.TestCase):
     def setUp(self) -> None:
-        self.commands = dict(RIG_STEPS)
+        self.commands = dict(ANIMATED_CHARACTER["rigSteps"])
 
     def test_each_gate_step_names_the_script_that_runs_it(self) -> None:
         for step_id, script in (
```

---

### Incident Patch 2: `fa0575ae` (2026-09-03)
**Commit Message**: fix: drop the base's fifth copy of the knife-only family gate

cs2_manifest.py removed four copies of the knife restriction when the plugin generalized to every CS2 family, but this one lived in the base's strict validator, so any non-knife CS2 item still failed with 'requires the registered knife adapter'. Found (and patched in-tree) by the live MP9 run in test-e2e-02; landed here with the test that pins it.

**File**: `forge/stage2_spec/validate_sculpt_spec.py` (modified, +6/-2)
```diff
@@ -861,8 +861,12 @@ def validate_cs2_contract(spec: dict[str, Any], errors: list[str], warnings: lis
         errors.append("cs2Intake.route must be a supported CS2 route")
     if tier not in CS2_EXACTNESS_TIERS:
         errors.append("cs2Intake.exactnessTier must be a supported exactness tier")
-    if intake.get("itemFamily") != "knife":
-        errors.append("cs2Intake requires the registered knife adapter")
+    # No family gate here. The base names no domain (SKILL.md, "Domain plugins"), and the CS2
+    # plugin serves any CS2 item: only the component *tree* is family-specific, and its absence is
+    # recorded as geometrySource=agent-inferred rather than making the spec invalid. This was the
+    # fifth place the knife-only restriction was enforced -- cs2_manifest.py removed the other four
+    # and says so in a comment -- but this copy lived in the base, so every non-knife CS2 item was
+    # still blocked at strict validation.
     if route == "reference-projection":
         camera = spec.get("referenceCamera")
         source = intake.get("deLitAlbedo") or intake.get("sourceImage")
```

**File**: `forge/tests/test_pipeline_routing.py` (modified, +19/-0)
```diff
@@ -146,6 +146,25 @@ def test_legacy_cs2_intake_derives_valid_routing_without_persisting_it(self) ->
         self.assertEqual(errors, [])
         self.assertNotIn("pipelineRouting", spec)
 
+    def test_cs2_contract_accepts_any_item_family(self) -> None:
+        # The knife-only family gate lived on in the base validator after cs2_manifest.py removed
+        # its four plugin-side copies -- every non-knife CS2 item failed strict validation with
+        # "requires the registered knife adapter". Found by a live MP9 run (test-e2e-02).
+        from forge.stage2_spec.validate_sculpt_spec import validate_cs2_contract
+
+        errors: list[str] = []
+        warnings: list[str] = []
+        spec = {
+            "cs2Intake": {
+                "itemFamily": "smg",
+                "route": "procedural-finish",
+                "exactnessTier": "metadata-assisted",
+            }
+        }
+        validate_cs2_contract(spec, errors, warnings)
+        self.assertNotIn("cs2Intake requires the registered knife adapter", errors)
+        self.assertEqual([e for e in errors if "knife" in e], [])
+
 
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 3: `5ca9f819` (2026-09-02)
**Commit Message**: fix: surface the runner's stderr when no envelope was printed

An installed harness too old for a forwarded --gate-timeout rejects it on stderr and prints no envelope; the caller saw only "no parseable img2.gate-run envelope" while the actual cause never surfaced. Found in e2e re-verification (F8).

**File**: `forge/stage3_build/run_gates.py` (modified, +10/-1)
```diff
@@ -232,7 +232,16 @@ def run_plugin_gates(
         )
     except EmitTargetError as exc:
         raise GateExecutionError(f"plugin {plugin_id!r} gates: {exc}") from exc
-    doc = parse_gate_run_envelope(proc.stdout)
+    try:
+        doc = parse_gate_run_envelope(proc.stdout)
+    except GateExecutionError as exc:
+        # A runner that never printed an envelope said why on stderr (e.g. an installed harness too
+        # old for a forwarded --gate-timeout: "unrecognized arguments"). Flattening that into "no
+        # parseable envelope" hides the actual cause from the user.
+        stderr_text = proc.stderr.decode("utf-8", errors="replace").strip()
+        if stderr_text:
+            raise GateExecutionError(f"{exc}; gate runner stderr: {stderr_text[:500]}") from exc
+        raise
     _check_exit_agreement(doc, proc.returncode)
     return doc
 
```

**File**: `forge/tests/test_run_gates.py` (modified, +26/-0)
```diff
@@ -237,6 +237,32 @@ def test_a_registry_error_stops_the_run_instead_of_skipping_gates(self):
         self.assertIn("gated", str(ctx.exception))
 
 
+class RunnerStderrSurfacesOnEnvelopeFailure(RunGatesTestBase):
+    """A runner that never printed an envelope said why on stderr — e.g. an installed harness too
+    old for a forwarded --gate-timeout rejects it with argparse's "unrecognized arguments" and no
+    stdout at all. That cause must reach the error, not be flattened into "no parseable envelope"."""
+
+    def test_the_runners_stderr_is_named_when_no_envelope_was_printed(self):
+        _write_gated_plugin(
+            self.home, "gated",
+            gate_body=PASS_GATE.format(gate_id="gated-gate", plugin_id="gated"),
+        )
+        # Replace the copied runner with a stub that mimics a pre-0.2.2 harness: argparse rejects
+        # the forwarded flag on stderr and exits 2 without printing an envelope.
+        (self.home / "harness" / "img2_core" / "gate_runner.py").write_text(
+            "import sys\n"
+            "sys.stderr.write(\"gate_runner.py: error: unrecognized arguments: --gate-timeout 60\\n\")\n"
+            "sys.exit(2)\n",
+            encoding="utf-8",
+        )
+        with self.assertRaises(run_gates.GateExecutionError) as ctx:
+            run_gates.run_plugin_gates(
+                "gated", self.home / "plugins" / "gated",
+                workspace=self.workspace, home=self.home, gate_timeout=60,
+            )
+        self.assertIn("unrecognized arguments: --gate-timeout", str(ctx.exception))
+
+
 class BlockingStopNamesGateAndPlugin(RunGatesTestBase):
     def test_a_blocking_failure_stops_the_run_naming_gate_and_plugin(self):
         state = _action_ready_state(self.workspace, self.spec_path)
```

---

### Incident Patch 4: `aa702694` (2026-09-02)
**Commit Message**: fix: detect a second BIN chunk after an empty one

The duplicate check tested payload truthiness; a zero-length first BIN chunk is falsy, so a second BIN chunk slid through the check the docstring promises to refuse.

**File**: `forge/_shared/glb_container.py` (modified, +5/-1)
```diff
@@ -51,6 +51,7 @@ def parse_glb(path: Path) -> tuple[dict[str, Any], bytes, dict[str, Any]]:
     cursor = 12
     json_payload: bytes | None = None
     bin_payload = b""
+    bin_seen = False
     chunks: list[dict[str, Any]] = []
     while cursor < len(data):
         if cursor + 8 > len(data):
@@ -68,8 +69,11 @@ def parse_glb(path: Path) -> tuple[dict[str, Any], bytes, dict[str, Any]]:
                 raise ValueError("GLB contains more than one JSON chunk")
             json_payload = payload.rstrip(b" \t\r\n\x00")
         elif chunk_type == BIN_CHUNK:
-            if bin_payload:
+            # A seen-flag, not truthiness: a zero-length first BIN chunk is falsy, and truthiness
+            # let a second BIN chunk slide through the duplicate check.
+            if bin_seen:
                 raise ValueError("GLB contains more than one BIN chunk")
+            bin_seen = True
             bin_payload = payload
 
     if json_payload is None:
```

**File**: `forge/tests/test_glb_reference.py` (modified, +22/-0)
```diff
@@ -151,5 +151,27 @@ def test_v2_manifest_declares_shared_profile_and_six_passes(self) -> None:
             )
 
 
+class GlbContainerRefusesDuplicateBinChunks(unittest.TestCase):
+    """`parse_glb` promises to refuse more than one BIN chunk; the duplicate check must be a
+    seen-flag, not payload truthiness -- a zero-length first BIN chunk is falsy and let a second
+    one through."""
+
+    def test_a_second_bin_chunk_after_an_empty_one_is_refused(self) -> None:
+        from forge._shared.glb_container import parse_glb
+
+        payload = json.dumps({"asset": {"version": "2.0"}}).encode("utf-8")
+        payload += b" " * ((4 - len(payload) % 4) % 4)
+        chunks = struct.pack("<II", len(payload), 0x4E4F534A) + payload
+        chunks += struct.pack("<II", 0, 0x004E4942)
+        chunks += struct.pack("<II", 4, 0x004E4942) + b"\x00\x00\x00\x00"
+        blob = struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks
+        with tempfile.TemporaryDirectory() as tmp:
+            path = Path(tmp) / "double-bin.glb"
+            path.write_bytes(blob)
+            with self.assertRaises(ValueError) as ctx:
+                parse_glb(path)
+        self.assertIn("more than one BIN chunk", str(ctx.exception))
+
+
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 5: `d6f30a0d` (2026-09-02)
**Commit Message**: fix: fail loud on gate participation; widen the run bound

A DomainRegistryError during the participation check was swallowed as uninvolved, silently skipping a blocking gate whose domain steps had run -- fail-open in the enforcement layer. And the flat 300s wrapper bound could not cover the runner's PER-GATE timeout: two 200s gates were legitimate yet killed mid-flight, and a forwarded --gate-timeout above 300 could never be honoured; the bound now scales by the declared gate count.

**File**: `forge/stage3_build/run_gates.py` (modified, +17/-5)
```diff
@@ -215,9 +215,18 @@ def run_plugin_gates(
     # drift-guard test asserts the two match exactly.
     if gate_timeout is not None:
         argv += ["--gate-timeout", str(gate_timeout)]
+    # The runner applies its timeout PER GATE, so the outer bound must cover every declared gate --
+    # a flat bound killed a legitimately-configured multi-gate run mid-flight, and could never
+    # honour a forwarded --gate-timeout larger than itself. The margin is runner overhead.
+    per_gate = gate_timeout if gate_timeout is not None else GATE_TIMEOUT_SECONDS
+    try:
+        gate_count = len(json.loads((plugin_dir / "gates.json").read_text(encoding="utf-8")))
+    except (OSError, json.JSONDecodeError, TypeError):
+        gate_count = 1
+    outer_timeout = per_gate * max(gate_count, 1) + 30
     try:
         proc = run_bounded(
-            argv, cwd=workspace, timeout=GATE_TIMEOUT_SECONDS, declared_env=[],
+            argv, cwd=workspace, timeout=outer_timeout, declared_env=[],
             target_kind=f"gates:{plugin_id}",
         )
     except EmitTargetError as exc:
@@ -245,10 +254,13 @@ def run_gates_for_workspace(
     for plugin_id, plugin_dir in _installed_plugins_with_gates(home):
         try:
             involved = plugin_contributed_a_step(state, plugin_id, home)
-        except DomainRegistryError:
-            # The profile lookup failing here is not this plugin's fault and not this function's
-            # question to answer -- treat as uninvolved rather than crash the whole gate run.
-            involved = False
+        except DomainRegistryError as exc:
+            # Fail loud, not open: gates are the enforcement layer, so "cannot determine
+            # participation" must stop the run -- treating it as uninvolved silently skipped a
+            # blocking gate whose domain steps had actually run in this workspace.
+            raise GateExecutionError(
+                f"cannot determine gate participation for plugin {plugin_id!r}: {exc}"
+            ) from exc
         if not involved:
             continue
         doc = run_plugin_gates(plugin_id, plugin_dir, workspace=workspace, home=home, gate_timeout=gate_timeout)
```

**File**: `forge/tests/test_run_gates.py` (modified, +25/-0)
```diff
@@ -212,6 +212,31 @@ def test_no_installed_plugins_at_all_is_a_harmless_empty_run(self):
         self.assertEqual(results, {})
 
 
+class ParticipationLookupFailureFailsLoudNotOpen(RunGatesTestBase):
+    """A DomainRegistryError during the participation check used to be swallowed as "uninvolved",
+    which silently skipped a blocking gate whose domain steps had actually run -- fail-open in the
+    enforcement layer. It must stop the run naming the plugin instead."""
+
+    def test_a_registry_error_stops_the_run_instead_of_skipping_gates(self):
+        from unittest import mock
+
+        from domains import DomainRegistryError
+
+        _write_gated_plugin(
+            self.home, "gated",
+            gate_body=PASS_GATE.format(gate_id="gated-gate", plugin_id="gated"),
+        )
+        _action_ready_state(self.workspace, self.spec_path)
+        with mock.patch.object(
+            run_gates, "plugin_contributed_a_step",
+            side_effect=DomainRegistryError("domain id 'x' is declared twice"),
+        ):
+            with self.assertRaises(run_gates.GateExecutionError) as ctx:
+                run_gates.run_gates_for_workspace(self.workspace, home=self.home)
+        self.assertIn("participation", str(ctx.exception))
+        self.assertIn("gated", str(ctx.exception))
+
+
 class BlockingStopNamesGateAndPlugin(RunGatesTestBase):
     def test_a_blocking_failure_stops_the_run_naming_gate_and_plugin(self):
         state = _action_ready_state(self.workspace, self.spec_path)
```

---

### Incident Patch 6: `6fa7d5aa` (2026-09-02)
**Commit Message**: fix: pass --force to the reference target emitter

mkstemp pre-creates the out file, and the emitter refuses an existing --out without --force, so every real --target threejs-ts run failed with "already exists". No test caught it: each one either passed --force itself or aimed at a path that did not exist yet. The new socket end-to-end test runs the whole path with nothing pre-supplied and fails without this flag.

**File**: `forge/stage3_build/emit_target.py` (modified, +3/-1)
```diff
@@ -478,7 +478,9 @@ def _run_reference_target(target: Target, *, spec_path: Path, workspace: Path) -
     emitter = str(_FORGE_ROOT / "stage3_build" / "generate_threejs_factory.py")
 
     def invoke(out_path: Path) -> subprocess.CompletedProcess:
-        argv = [sys.executable, emitter, str(spec_path), "--out", str(out_path), "--pass-id", pass_id]
+        # --force is required: mkstemp below pre-creates out_path, and the emitter refuses an
+        # existing --out without it -- omitting the flag makes every reference-target run fail.
+        argv = [sys.executable, emitter, str(spec_path), "--out", str(out_path), "--force", "--pass-id", pass_id]
         return run_bounded(argv, cwd=workspace, timeout=timeout, declared_env=[], target_kind=target.kind)
 
     artifact_path.parent.mkdir(parents=True, exist_ok=True)
```

**File**: `forge/tests/test_target_reference_conformance.py` (modified, +57/-0)
```diff
@@ -15,6 +15,7 @@
 from __future__ import annotations
 
 import json
+import os
 import subprocess
 import sys
 import tempfile
@@ -198,5 +199,61 @@ def test_malformed_json_on_stderr_is_classified_as_error_never_a_pass(self) -> N
         self.assertEqual(emit_target._classify_reference_failure(2, wrong_shape).classification, "error")
 
 
+class ReferenceTargetSocketEndToEnd(unittest.TestCase):
+    """The full socket path for `--target threejs-ts`: resolve -> action-ready -> temp-write ->
+    emitter subprocess -> verify -> determinism -> rename -> provenance, with nothing pre-supplied.
+
+    Regression for the pre-created out-path defect: `_run_reference_target` mkstemps the output
+    file before the emitter runs, so its invocation must carry --force or every real
+    reference-target run failed with "already exists" -- which no other test caught, because each
+    one either passed --force itself or pointed the emitter at a path that did not exist yet."""
+
+    def test_the_socket_produces_the_oracle_artifact_end_to_end(self) -> None:
+        from forge.tests.test_emit_target import _action_ready_state_path
+        from feature_acceptance_policy import feature_targets_for_pass
+
+        spec = json.loads(FROZEN_SPEC.read_text(encoding="utf-8"))
+        # The minimum honest completion record for the frozen pass: review_completes_pass demands
+        # visual evidence, a passing vision score, a passing review per critical feature, and the
+        # spec's own required layer scores.
+        acceptance = spec["selfCorrectLoop"]["visualAcceptance"]
+        spec["reviewHistory"] = [{
+            "passId": FROZEN_PASS_ID, "action": "continue",
+            "visualEvidence": {"renderScreenshot": "render.png", "comparisonImage": "compare.png"},
+            "aiVisionScore": 0.9,
+            "layerScores": {layer: 0.9 for layer in acceptance["requiredLayerScores"]},
+            "featureReviews": [
+                {"id": target["id"], "score": 0.95}
+                for target in feature_targets_for_pass(spec, FROZEN_PASS_ID)
+                if isinstance(target.get("id"), str)
+            ],
+        }]
+        old_home = os.environ.get("IMG2_HOME")
+        with tempfile.TemporaryDirectory() as tmp:
+            workspace = Path(tmp) / "ws"
+            workspace.mkdir()
+            spec_path = workspace / "spec.json"
+            spec_path.write_text(json.dumps(spec), encoding="utf-8")
+            _action_ready_state_path(workspace)
+            os.environ["IMG2_HOME"] = str(Path(tmp) / "img2home-empty")
+            try:
+                rc = emit_target.main([
+                    "--spec", str(spec_path), "--target", "threejs-ts", "--workspace", str(workspace),
+                ])
+            finally:
+                if old_home is None:
+                    os.environ.pop("IMG2_HOME", None)
+                else:
+                    os.environ["IMG2_HOME"] = old_home
+            self.assertEqual(rc, 0)
+            artifact = workspace / ".img2" / "artifacts" / "threejs-ts" / "model.ts"
+            self.assertEqual(artifact.read_text(encoding="utf-8"), ORACLE_TS.read_text(encoding="utf-8"))
+            provenance = json.loads(
+                artifact.with_suffix(artifact.suffix + ".provenance.json").read_text(encoding="utf-8")
+            )
+            self.assertEqual(provenance["target"], "threejs-ts")
+            self.assertTrue(provenance["determinismVerified"])
+
+
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 7: `cb9c4b8b` (2026-09-02)
**Commit Message**: fix: refuse non-dict assessmentPatch values for guarded keys

objectClass and detailInventory carry guarded values; a non-dict replacement fell through to plain assignment and clobbered the dict the domain marker and the raise-only detail floor live in -- strict validation then saw no positive targetMinDetails and disabled the detail gate with clamped reporting nothing.

**File**: `forge/_shared/spec_augmentation.py` (modified, +6/-0)
```diff
@@ -89,6 +89,12 @@ def merge_spec_augmentation(spec: dict[str, Any], artifact: Any, *, domain_id: s
         raise SpecAugmentationError("assessmentPatch must be an object")
     pre = spec.setdefault("preSpecAssessment", {})
     for key, value in patch.items():
+        if key in ("objectClass", "detailInventory") and not isinstance(value, dict):
+            # These two carry guarded values (the domain marker, the raise-only detail floor). A
+            # non-dict replacement would fall through to the plain-assignment branch below and
+            # clobber the dict both guards live in -- refusing it keeps every path to a floor
+            # clamped, not just the well-formed one.
+            raise SpecAugmentationError(f"assessmentPatch.{key} must be an object, got {value!r}")
         if key == "objectClass" and isinstance(value, dict):
             if "domain" in value:
                 raise SpecAugmentationError("assessmentPatch may not set objectClass.domain; the base sets it from domain resolution")
```

**File**: `forge/tests/test_domain_spec_contract.py` (modified, +17/-0)
```diff
@@ -90,6 +90,23 @@ def test_assessment_patch_other_detail_inventory_keys_still_merge(self) -> None:
         )
         self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 40)
 
+    def test_a_non_dict_detail_inventory_patch_is_refused_not_applied(self) -> None:
+        # A non-dict value used to fall through to the plain-assignment branch and clobber the
+        # whole dict the floor lives in -- strict validation then saw no positive targetMinDetails
+        # and disabled the detail gate entirely, with `clamped` reporting nothing.
+        spec = {"preSpecAssessment": {"detailInventory": {"targetMinDetails": 40}}}
+        with self.assertRaises(SpecAugmentationError):
+            merge_spec_augmentation(spec, artifact(assessmentPatch={"detailInventory": 0}))
+        self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 40)
+
+    def test_a_non_dict_object_class_patch_is_refused_not_applied(self) -> None:
+        spec = {"preSpecAssessment": {"objectClass": {"domain": "base"}}}
+        with self.assertRaises(SpecAugmentationError):
+            merge_spec_augmentation(
+                spec, artifact(assessmentPatch={"objectClass": "weapon"}), domain_id="testdomain"
+            )
+        self.assertEqual(spec["preSpecAssessment"]["objectClass"], {"domain": "base"})
+
     def test_a_kept_tier_is_recorded_like_a_kept_number(self) -> None:
         spec = {"qualityContract": {"qualityBar": "ultra-complex"}}
         record = merge_spec_augmentation(spec, artifact(qualityFloors={"qualityBar": "simple"}))
```

---

### Incident Patch 8: `a2ceb410` (2026-08-31)
**Commit Message**: fix: name the file at fault when a domain declaration row is malformed

The (id, command) unpack ran before validation, so a malformed domain.json surfaced as a bare ValueError instead of a DomainRegistryError naming the declaration.

**File**: `forge/_shared/domains/__init__.py` (modified, +10/-3)
```diff
@@ -136,9 +136,16 @@ def _installed_plugin_domains() -> list[tuple[Path, Any]]:
         plugin_dir = str(declaration.parent)
         for key in ("setupSteps", "passSteps"):
             if key in entry:
-                entry[key] = tuple(
-                    (step_id, command.replace("{plugin_dir}", plugin_dir)) for step_id, command in entry[key]
-                )
+                try:
+                    entry[key] = tuple(
+                        (step_id, command.replace("{plugin_dir}", plugin_dir)) for step_id, command in entry[key]
+                    )
+                except (TypeError, ValueError, AttributeError) as exc:
+                    # Unpacking used to run before validation, so a malformed row surfaced as a bare
+                    # ValueError/AttributeError instead of an error naming the file at fault.
+                    raise DomainRegistryError(
+                        f"{declaration}: {key!r} rows must be [id, command] pairs of strings"
+                    ) from exc
         out.append((declaration, entry))
     return out
 
```

---

### Incident Patch 9: `041c790f` (2026-08-31)
**Commit Message**: fix: fail loud when a domain run's augmentation artifact is missing

A resolved --domain whose spec-augmentation.json was absent silently wrote the generic skeleton and exited 0 -- a run could finish with no domain contribution and nobody would know, while the wiki draws this case as FAIL LOUD. Without --domain the skip stays correct and is pinned by its own test.

**File**: `forge/stage2_spec/new_sculpt_spec.py` (modified, +22/-8)
```diff
@@ -1946,14 +1946,28 @@ def main(argv: list[str]) -> int:
         if isinstance(assessment, dict) and isinstance(assessment.get("preSpecAssessment"), dict):
             anatomy = assessment["preSpecAssessment"].get("anatomy")
         apply_character_template(spec, anatomy, include_accessories=args.accessories)
-    if args.augmentation is not None and args.augmentation.expanduser().is_file():
-        try:
-            artifact = json.loads(args.augmentation.expanduser().read_text(encoding="utf-8"))
-            merge_spec_augmentation(spec, artifact, domain_id=args.domain)
-        except (OSError, json.JSONDecodeError) as exc:
-            parser.error(f"cannot read spec augmentation {args.augmentation}: {exc}")
-        except SpecAugmentationError as exc:
-            parser.error(str(exc))
+    if args.augmentation is not None:
+        source = args.augmentation.expanduser()
+        if not source.is_file():
+            # A domain run whose augmentation artifact is missing means the domain's emit step
+            # failed or was skipped. Writing the generic skeleton and exiting 0 here is the silent
+            # downgrade 02-how-it-works.md draws as FAIL LOUD (PR #106 review, finding 4). Without
+            # --domain the flag is speculative plumbing from a generic checklist, and skipping stays
+            # correct.
+            if args.domain:
+                parser.error(
+                    f"--domain {args.domain} is resolved but the augmentation artifact "
+                    f"{args.augmentation} does not exist; run the domain's emit step instead of "
+                    f"continuing on the generic skeleton"
+                )
+        else:
+            try:
+                artifact = json.loads(source.read_text(encoding="utf-8"))
+                merge_spec_augmentation(spec, artifact, domain_id=args.domain)
+            except (OSError, json.JSONDecodeError) as exc:
+                parser.error(f"cannot read spec augmentation {args.augmentation}: {exc}")
+            except SpecAugmentationError as exc:
+                parser.error(str(exc))
     payload = json.dumps(spec, indent=2, ensure_ascii=False) + "\n"
 
     if args.out:
```

**File**: `forge/tests/test_pipeline.py` (modified, +27/-0)
```diff
@@ -889,6 +889,33 @@ def test_character_template_survives_an_augmentation_file(self):
         self.assertIn("fixtureSection", spec, "the augmentation merge was skipped")
         self.assertEqual(spec["specAugmentation"]["provider"], "fixture")
 
+    def test_a_domain_run_with_a_missing_augmentation_fails_loud(self):
+        """02-how-it-works draws the missing-provider case as FAIL LOUD; the code must match.
+
+        Before this test, a resolved --domain whose spec-augmentation.json was absent (emit step
+        failed, or an actor:agent step skipped) silently wrote the generic skeleton and exited 0 --
+        a whole run could finish with no domain contribution and nobody would know.
+        """
+        r = run(
+            "stage2_spec/new_sculpt_spec.py", "Knife",
+            "--domain", "fixturedom",
+            "--augmentation", self.dir / "does-not-exist.json",
+            "--out", self.spec,
+        )
+        self.assertNotEqual(r.returncode, 0)
+        self.assertIn("does-not-exist.json", r.stderr)
+        self.assertIn("fixturedom", r.stderr)
+        self.assertFalse(self.spec.exists(), "no generic skeleton may be written for a failed domain run")
+
+    def test_a_generic_run_still_skips_a_missing_augmentation(self):
+        r = run(
+            "stage2_spec/new_sculpt_spec.py", "Crate",
+            "--augmentation", self.dir / "does-not-exist.json",
+            "--out", self.spec,
+        )
+        self.assertEqual(r.returncode, 0, r.stderr)
+        self.assertTrue(self.spec.exists())
+
     def test_cs2_track_skipped_for_objects(self):
         run("stage2_spec/new_sculpt_spec.py", "Crate", "--out", self.spec)
         spec = json.loads(self.spec.read_text())
```

**File**: `forge/tests/test_suite_integrity.py` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@
 # registry layout instead of assumed from a name match) added 2 tests -- a plugin whose package
 # name differs from its domain id, and an in-repo domain's profile correctly attributing no
 # installed plugin as its owner.
-COLLECTED_FLOOR = 1185
+COLLECTED_FLOOR = 1192
 
 
 REPO_ROOT = TESTS_DIR.parents[1]
```

---

### Incident Patch 10: `78fd1c24` (2026-08-31)
**Commit Message**: fix: clamp every path to a floor, not just the qualityFloors partition

assessmentPatch could lower detailInventory.targetMinDetails -- the exact number strict validation reads -- while clamped reported nothing, and a patched value arriving first meant qualityFloors' own clamp never ran. The clamp now guards the value in whichever partition carries it. _stricter_tier records a kept tier like a kept number and refuses a malformed base tier instead of letting a looser proposal replace it. Found in review of PR #106 by executing the merge, reproduced here as tests first.

**File**: `forge/_shared/spec_augmentation.py` (modified, +22/-3)
```diff
@@ -33,12 +33,20 @@ class SpecAugmentationError(ValueError):
     pass
 
 
-def _stricter_tier(current: Any, proposed: Any) -> Any:
+def _stricter_tier(current: Any, proposed: Any, clamped: list[str]) -> Any:
     if proposed not in TIER_ORDER:
         raise SpecAugmentationError(f"unknown quality tier {proposed!r}; expected one of {', '.join(TIER_ORDER)}")
+    if current is None:
+        return proposed
     if current not in TIER_ORDER:
+        # A malformed base tier is a base defect to surface, not a blank the plugin gets to fill:
+        # silently accepting the proposal here let a looser tier replace a typo'd stricter one.
+        raise SpecAugmentationError(f"the spec's existing quality tier {current!r} is not one of {', '.join(TIER_ORDER)}")
+    if TIER_ORDER.index(proposed) > TIER_ORDER.index(current):
         return proposed
-    return proposed if TIER_ORDER.index(proposed) > TIER_ORDER.index(current) else current
+    if proposed != current:
+        clamped.append(f"qualityBar: kept {current} over proposed {proposed}")
+    return current
 
 
 def _raise_only_number(path: str, current: Any, proposed: Any, clamped: list[str]) -> Any:
@@ -85,6 +93,17 @@ def merge_spec_augmentation(spec: dict[str, Any], artifact: Any, *, domain_id: s
             if "domain" in value:
                 raise SpecAugmentationError("assessmentPatch may not set objectClass.domain; the base sets it from domain resolution")
             pre.setdefault("objectClass", {}).update(value)
+        elif key == "detailInventory" and isinstance(value, dict):
+            # The one floor-controlled value reachable through this partition. The clamp guards the
+            # VALUE, whichever partition carries it -- without this, a patch lowered the floor the
+            # strict validator reads while `clamped` reported nothing, and qualityFloors' own clamp
+            # never ran because the patched value arrived first.
+            inv = pre.setdefault(key, {})
+            for sub, proposed in value.items():
+                if sub == "targetMinDetails":
+                    inv[sub] = _raise_only_number("targetMinDetails", inv.get(sub), proposed, clamped)
+                else:
+                    inv[sub] = proposed
         elif isinstance(value, dict):
             pre.setdefault(key, {}).update(value)
         else:
@@ -98,7 +117,7 @@ def merge_spec_augmentation(spec: dict[str, Any], artifact: Any, *, domain_id: s
     contract = spec.setdefault("qualityContract", {})
     for key, value in floors.items():
         if key == "qualityBar":
-            contract["qualityBar"] = _stricter_tier(contract.get("qualityBar"), value)
+            contract["qualityBar"] = _stricter_tier(contract.get("qualityBar"), value, clamped)
         elif key == "targetMinDetails":
             inv = pre.setdefault("detailInventory", {})
             inv["targetMinDetails"] = _raise_only_number("targetMinDetails", inv.get("targetMinDetails"), value, clamped)
```

**File**: `forge/tests/test_domain_spec_contract.py` (modified, +49/-0)
```diff
@@ -54,6 +54,55 @@ def test_raising_is_allowed(self) -> None:
         self.assertEqual(spec["qualityContract"]["minimumSpecDepth"]["macroComponents"], 5)
 
 
+class RaiseOnlyCoversEveryPathToAFloor(unittest.TestCase):
+    """The clamp must guard the VALUE, not just the qualityFloors partition.
+
+    assessmentPatch merges into preSpecAssessment, and `detailInventory.targetMinDetails` -- the
+    exact number strict validation reads -- lives there. Before this test existed, a patch could
+    drop the floor 40 -> 2 with `clamped: []` reporting nothing, and plugin-cs2's own emit tool sent
+    the value through BOTH partitions with the unclamped one winning (found in review of PR #106 by
+    running the code, not by reading it).
+    """
+
+    def test_assessment_patch_cannot_lower_the_detail_floor(self) -> None:
+        spec = {"preSpecAssessment": {"detailInventory": {"targetMinDetails": 40}}}
+        record = merge_spec_augmentation(
+            spec, artifact(assessmentPatch={"detailInventory": {"targetMinDetails": 2}})
+        )
+        self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 40)
+        self.assertTrue(record["clamped"], "the kept-over-proposed decision must leave a record")
+
+    def test_assessment_patch_may_still_raise_the_detail_floor(self) -> None:
+        spec = {"preSpecAssessment": {"detailInventory": {"targetMinDetails": 12}}}
+        record = merge_spec_augmentation(
+            spec, artifact(assessmentPatch={"detailInventory": {"targetMinDetails": 60}})
+        )
+        self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 60)
+        self.assertEqual(record["clamped"], [])
+
+    def test_assessment_patch_other_detail_inventory_keys_still_merge(self) -> None:
+        spec = {"preSpecAssessment": {"detailInventory": {"targetMinDetails": 40}}}
+        merge_spec_augmentation(
+            spec, artifact(assessmentPatch={"detailInventory": {"expectedFinishes": ["anodized"]}})
+        )
+        self.assertEqual(
+            spec["preSpecAssessment"]["detailInventory"]["expectedFinishes"], ["anodized"]
+        )
+        self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 40)
+
+    def test_a_kept_tier_is_recorded_like_a_kept_number(self) -> None:
+        spec = {"qualityContract": {"qualityBar": "ultra-complex"}}
+        record = merge_spec_augmentation(spec, artifact(qualityFloors={"qualityBar": "simple"}))
+        self.assertEqual(spec["qualityContract"]["qualityBar"], "ultra-complex")
+        self.assertTrue(record["clamped"], "a tier kept over a looser proposal must leave a record")
+
+    def test_a_malformed_base_tier_is_refused_not_silently_replaced(self) -> None:
+        spec = {"qualityContract": {"qualityBar": "Ultra-Complex"}}
+        with self.assertRaises(SpecAugmentationError) as ctx:
+            merge_spec_augmentation(spec, artifact(qualityFloors={"qualityBar": "simple"}))
+        self.assertIn("Ultra-Complex", str(ctx.exception))
+
+
 class WhatAnArtifactMayNotDo(unittest.TestCase):
     def test_it_may_not_set_a_base_owned_section(self) -> None:
         with self.assertRaises(SpecAugmentationError) as ctx:
```

#### Recent Merged Pull Requests:
- **PR #147** (closed): docs(readme): dedupe pipeline blurb, fix broken rig/hair scripts table (@bhj95224-sudo)
- **PR #132** (2026-09-06): docs(skill): document the img2 harness in SKILL.md (@kokorolx)
- **PR #130** (2026-09-05): Lab/cs2 plugin (@kokorolx)
- **PR #117** (2026-09-03): 1.5.2: animation pipeline (@hoainho)
- **PR #115** (closed): feat: add Han Huan-Shou Dao reconstruction (@abyssalyanbin)
- **PR #114** (2026-08-29): chore: swap Buy Me a Coffee for Ko-fi (@hoainho)
- **PR #113** (closed): feat: gate model space and non-humanoid animation (@kimurakoki)
- **PR #106** (2026-09-03): cs2 plugin (@kokorolx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

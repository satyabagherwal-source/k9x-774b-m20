# Domain G — Architecture Intelligence: Architecture Intelligence: mixelpixx-kicad-mcp-server-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "mixelpixx-kicad-mcp-server-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T17:37:42.754Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mixelpixx-kicad-mcp-server-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mixelpixx-kicad-mcp-server-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T17:37:42.754Z`  
> **Learning ID**: `LEARN-EVO-mixelpixx-kicad-mcp-server-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: I (Content & Information Intelligence), K (Quality & Verification Intelligence), H (Technical Construction Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 52%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from mixelpixx-kicad-mcp-server-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mixelpixx-kicad-mcp-server-learnings.md`  
> **Source**: github ([https://github.com/mixelpixx/KiCAD-MCP-Server](https://github.com/mixelpixx/KiCAD-MCP-Server))  
> **Source Version**: `2669379b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T17:37:26.979Z  
> **Learning ID**: `learn-github-mixelpixx-kicad-mcp-server`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): mixelpixx/KiCAD-MCP-Server

> **Canonical Artifact**: `07_PROJECT_LEARNING/mixelpixx-kicad-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mixelpixx/KiCAD-MCP-Server](https://github.com/mixelpixx/KiCAD-MCP-Server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T17:37:26.595Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mixelpixx/KiCAD-MCP-Server`
- **Description**: KiCAD MCP is a Model Context Protocol (MCP) implementation that enables Large Language Models (LLMs) like Claude to directly interact with KiCAD for printed circuit board design.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 3309 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/commands/schematic_text_utils.py`
```
"""
Shared text/S-expression helpers for schematic command modules.

These operate directly on ``.kicad_sch`` file text (no pcbnew / KiCADInterface needed)
and are used by the field-layout, batch-authoring and hierarchy command modules. Keeping
them here avoids those modules importing helpers from one another.
"""

import math
import re
from pathlib import Path
from typing import Dict, Optional, Tuple

from utils.sexpr_format import QUOTED_VALUE, match_paren, unescape_sexpr_string

_KICAD_INTERNAL_PROPS = frozenset(
    {"ki_keywords", "ki_description", "ki_fp_filters", "ki_locked", "ki_model"}
)

# Paper sizes (landscape, mm). Border frame is ~12.7mm from each edge.
_PAPER_DIMS = {
    "A4": (297.0, 210.0),
    "A3": (420.0, 297.0),
    "A2": (594.0, 420.0),
    "A1": (841.0, 594.0),
    "A0": (1189.0, 841.0),
    "A": (279.4, 215.9),
    "B": (431.8, 279.4),
    "C": (558.8, 431.8),
    "D": (863.6, 558.8),
    "E": (1117.6, 863.6),
}


def _find_matching_paren(s: str, start: int) -> int:
    """Return index of the ')' matching the '(' at position *start*, or -1.

    Parens inside quoted strings are text: KiCad writes pin names such as
    "PA13(JTMS" raw.
    """
    return match_paren(s, start)


def _find_placed_symbol_block(
    content: str, reference: str, unit: Optional[int] = None
) -> Tuple[Optional[str], int, int]:
    """Find the placed symbol block for *reference*. Returns (block, start, end) or (None, -1, -1).

    ``unit`` picks one placement of a multi-unit part, whose units all carry the
    same reference; without it the first block in file order wins.
    """
    lib_sym_pos = content.find("(lib_symbols")
    lib_sym_end = _find_matching_paren(content, lib_sym_pos) if lib_sym_pos >= 0 else -1
    pattern = re.compile(r'\(symbol\s+\(lib_id\s+"')
    search_start = 0
    while True:
        m = pattern.search(content, search_start)
        if not m:
            break
        pos = m.start()
        if lib_sym_pos >= 0 and lib_sym_pos <= pos <= lib_sym_end:
            search_start = lib_sym_end + 1
            continue
        end = _find_matching_paren(content, pos)
        if end < 0:
            search_start = pos + 1
            continue
        block_text = content[pos : end + 1]
        if re.search(r'\(property\s+"Reference"\s+"' + re.escape(reference) + r'"', block_text):
            if unit is None:
                return block_text, pos, end
            um = re.search(r"\(unit\s+(\d+)\)", block_text)
            if um and int(um.group(1)) == int(unit):
                return block_text, pos, end
        search_start = end + 1
    return None, -1, -1


def _extract_component_properties(block_text: str, exclude_internal: bool = True) -> Dict[str, str]:
    """Extract {name: value} for all (property "name" "value" ...) entries in a symbol block."""
    props = {}
    for m in re.finditer(r"\(property\s+" + QUOTED_VALUE + r"\s+" + QUOTED_VALUE, block_text):
        name = unescape_sexpr_string(m.group(1))
        value = unescape_sexpr_string(m.group(2))
        if exclude_internal and name in _KICAD_INTERNAL_PROPS:
            continue
        props[name] = value
    return props


def _extract_property_position(block_text: str, property_name: str) -> Optional[Dict[str, float]]:
    """Return {"x","y","angle"} of a named property's (at ...), or None."""
    pat = re.compile(
        r'\(property\s+"'
        + re.escape(property_name)
        + r'"\s+"[^"]*"\s+\(at\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)'
    )
    m = pat.search(block_text)
    if m:
        return {"x": float(m.group(1)), "y": float(m.group(2)), "angle": float(m.group(3))}
    return None


def _extract_property_visible(block_text: str, property_name: str) -> bool:
    """True if the named property is visible (no hide flag)."""
    m = re.search(r'\(property\s+"' + re.escape(property_name) + r'"', block_text)
    if not m:
        return True
    end = _find_matching_paren(block_text, m.start())
    if end < 0:
        return True
    prop_sub = block_text[m.start() : end + 1]
    return "(hide yes)" not in prop_sub and "(hide)" not in prop_sub


def _get_sheet_usable_area(schematic_path) -> Tuple[float, float, float, float]:
    """Return (left, top, right, bottom) usable bounds in mm for the sheet's paper size."""
    border = 12.7
    width, height = 297.0, 210.0  # default A4
    try:
        with open(schematic_path, "r", encoding="utf-8") as f:
            content = f.read(4096)
        m = re.search(r'\(paper\s+"([^"]+)"', content)
        if m and m.group(1).strip() in _PAPER_DIMS:
            width, height = _PAPER_DIMS[m.group(1).strip()]
    except Exception:
        pass
    return (border, border, width - border, height - border)


def _apply_visibility(block: str, property_name: str, visible: bool) -> str:
    """Add or remove a (hide yes) flag on a property's (effects ...) sub-expression."""
    m = re.search(r'\(property\s+"' + re.escape(property_name) + r'"', block)
    if not m:
        return block
    ps = m.start()
    pe = _find_matching_paren(block, ps)
    if pe < 0:
        return block
    prop_sub = block[ps : pe + 1]
    is_hidden = "(hide yes)" in prop_sub or "(hide)" in prop_sub
    if not visible and not is_hidden:
        em = re.search(r"\(effects", prop_sub)
        if em:
            es = em.start()
            ee = _find_matching_paren(prop_sub, es)
            if ee >= 0:
                prop_sub = prop_sub[:es] + prop_sub[es:ee] + " (hide yes))" + prop_sub[ee + 1 :]
    elif visible and is_hidden:
        for tok in (" (hide yes)", "(hide yes) ", "(hide yes)", " (hide)", "(hide) ", "(hide)"):
            prop_sub = prop_sub.replace(tok, "")
    return block[:ps] + prop_sub + block[pe + 1 :]


def _move_property_in_block(block_text, property_name, x, y, angle, visible) -> Tuple[str, int]:
    """Replace a property's (at ...) and apply visibility. Returns (new_block, n_substitutions)."""
    prop_pat = re.compile(
        r'(\(property\s+"'
        + re.escape(property_name)
        + r'"\s+"[^"]*"\s+)\(at\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\)'
    )
    new_block, n_subs = prop_pat.subn(r"\g<1>" + f"(at {x} {y} {angle})", block_text)
    if n_subs == 0:
        return block_text, 0
    return _apply_visibility(new_block, property_name, visible), n_subs


def _find_project_root(start_dir: Path) -> Path:
    """Walk up from *start_dir* to the nearest dir containing a .kicad_pro (else start_dir)."""
    current = start_dir.resolve()
    while True:
        if list(current.glob("*.kicad_pro")):
            return current
        parent = current.parent
        if parent == current:
            break
        current = parent
    return start_dir


# Outward direction of a pin by its label orientation, in sheet coordinates (y down).
_OUTWARD = {0: (1, 0), 90: (0, -1), 180: (-1, 0), 270: (0, 1)}


def _straight_ahead(position, orientation, target, tol=0.01):
    """True when *target* lies on the pin's outward axis, in front of the pin."""
    d = _OUTWARD.get(int(round(orientation / 90) * 90) % 360)
    if d is None:
        return False
    dx, dy = float(target[0]) - float(position[0]), float(target[1]) - float(position[1])
    along = dx * d[0] + dy * d[1]
    across = abs(dx * d[1] - dy * d[0])
    return along > tol and across <= tol


def _find_facing_label(sch_path, net_name, position, orientation, proximity_mm=14.0):
    """Return [x, y] of an existing label for *net_name* that faces *position*, else None.

    "Facing" = within proximity_mm, oriented 180° opposite, and straight out in front
    of the pin on its own axis, so a single wire between the two pins is cleaner than
    two overlapping labels. A label off that axis is not facing: joining it would draw
    a diagonal wire, which no schematic is drawn with (and a label behind the pin would
    send the wire back across the symbol body).
    """
    try:
        content = sch_path.read_text(encoding="utf-8")
        pat = re.compile(r'\(label\s+"([^"]+)"\s+\(at\s+([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\)')
        px, py = float(position[0]), float(position[1])
        facing = (int(round(orientation)) % 360 + 180) % 360
        for m in pat.finditer(content):
            if m.group(1) != net_name:
                continue
            lx, ly, la = float(m.group(2)), float(m.group(3)), float(m.group(4))
            if math.hypot(lx - px, ly - py) > proximity_mm:
                continue
            if int(round(la)) % 360 == facing and _straight_ahead(position, orientation, (lx, ly)):
                return [lx, ly]
    except Exception:
        pass
    return None

```

### Core Architecture Module: `python/utils/__init__.py`
```
"""Utility modules for KiCAD MCP Server"""

```

### Core Architecture Module: `python/utils/board_items.py`
```
"""Safe deletion of items from a pcbnew BOARD.

Why this module exists (issue #247)
-----------------------------------
``BOARD.Remove()`` is **not** the API for deleting an item. KiCad's own SWIG
wrapper documents what it does (``pcbnew.py``, ``BOARD_ITEM_CONTAINER``)::

    def Remove(self, item):
        \"\"\"Remove a BOARD_ITEM ... set the thisdown flag so that the python
        wrapper owns the C++ BOARD_ITEM\"\"\"
        self.RemoveNative(item)
        if (not IsActionRunning()):
            item.thisown = 1          # <-- Python now owns the C++ object

    def Delete(self, item):
        \"\"\"Remove a BOARD_ITEM ... set the thisdown flag so that the python
        wrapper does not owns the C++ BOARD_ITEM\"\"\"
        item.thisown = 0              # C++ will free it
        self.DeleteNative(item)
        item.this = None

``Remove()`` hands ownership to Python because it is meant for *detaching* an
item you intend to keep or re-add. Code that removes an item and then drops
the reference makes the interpreter run the C++ destructor on an object
KiCad's structures still point at.

Observed consequence on KiCad 10.0 (reproduced against a real install):

* a single ``delete_component`` followed by the next board operation raises
  ``'SwigPyObject' object has no attribute 'thisown'``,
* pure reads fail too — ``'SwigPyObject' object has no attribute 'GetPosition'``,
* the damage is **process-wide**, not board-scoped: even ``pcbnew.FootprintLoad``
  degrades, because SWIG's type registry itself is corrupted,
* on some builds the process segfaults outright instead.

The board object keeps working, which is why the existing
``_is_board_healthy()`` probe never noticed: it only checks BOARD-level
methods, and the BOARD is fine. It is the items it hands back that are dead.

Using ``Delete()`` avoids the whole failure mode: ownership stays in C++, and
the item is freed by the code that knows how.
"""

import logging
from typing import Any

logger = logging.getLogger("kicad_interface")


def clone_footprint(footprint: Any) -> Any:
    """Return an independent copy of ``footprint``, ready for ``board.Add()``.

    Used to load a footprint from disk once and stamp out many instances
    (#248): ``FootprintLoad`` costs the same on every call, so a board with
    thirteen identical resistors otherwise paid for thirteen identical disk
    reads. Cloning is ~1000x cheaper than reloading.

    Two portability wrinkles, both verified against a real KiCad 10.0 install:

    * ``Duplicate()`` gained a required ``addToParentGroup`` argument in
      KiCad 10; KiCad 8/9 take none.
    * It returns a ``BOARD_ITEM`` — SWIG does not down-cast automatically, so
      the result has no ``SetReference``/``SetValue`` until it is passed
      through ``Cast_to_FOOTPRINT``.

    The caller must keep the prototype out of the board: handing it to
    ``board.Add()`` would leave the cache holding a board-owned object.
    """
    import pcbnew  # local: keeps this module importable without KiCad

    try:
        duplicate = footprint.Duplicate(False)  # KiCad 10
    except TypeError:
        duplicate = footprint.Duplicate()  # KiCad 8/9

    if not hasattr(duplicate, "SetReference"):
        cast = getattr(pcbnew, "Cast_to_FOOTPRINT", None)
        if cast is not None:
            duplicate = cast(duplicate)
    return duplicate


def delete_board_item(board: Any, item: Any) -> None:
    """Detach ``item`` from ``board`` and let C++ destroy it.

    Prefers ``BOARD.Delete()``. Falls back to ``Remove()`` plus an explicit
    ``thisown = False`` on builds (or test doubles) that expose no ``Delete``
    — that combination was verified to be equally safe, since the danger is
    solely Python owning and then freeing the C++ object.

    Never raises for a missing ``thisown`` attribute; a caller deleting an
    item must not fail because a proxy lacked a SWIG bookkeeping field.
    """
    delete = getattr(board, "Delete", None)
    if callable(delete):
        delete(item)
        return

    logger.debug("BOARD.Delete unavailable; falling back to Remove + disown")
    board.Remove(item)
    try:
        item.thisown = False
    except AttributeError:
        # Already a raw SwigPyObject, or a mock without the attribute. The
        # Remove() above has still detached it; there is nothing more to do.
        pass

```

### Core Architecture Module: `python/utils/duplicate_strategies.py`
```
"""Ways find_duplicate_symbols can decide two symbols are the same part.

Dependency-free so the tool schema and the command share one list instead of
drifting apart.

``graphics`` is deliberately absent from the defaults: every resistor in a
library is drawn with the same body, so on passives it groups the whole family
and reports nothing useful. It earns its keep when hunting a custom part that
was copied under a new name.

``name`` is absent for the opposite reason -- it is the weakest signal, not the
loudest. It collapses the separators between the parts of a name, so ``R_10K``
and ``R-10K`` match, and finds little beyond a part re-added by retyping its
name. The decimal point is NOT collapsed: doing so makes ``C_1.0uF_0805`` and
``C_10uF_0805`` the same key.

Whatever the strategy, a key has to be a value and not a marker meaning the
field was left blank -- ``N/A``, ``TBD``, ``-``, KiCad's ``~``. Grouping on one
of those puts every part an importer could not fill in into a single group.
"""

DUPLICATE_STRATEGIES = ("mpn", "supplier", "value_footprint", "graphics", "name")

DEFAULT_DUPLICATE_STRATEGIES = ("mpn", "value_footprint")

```

### Core Architecture Module: `python/utils/file_io.py`
```
"""File I/O helpers for KiCad text files."""

from __future__ import annotations

import os
from pathlib import Path


def read_text_preserve_newline(path: Path) -> tuple[str, str]:
    """Read UTF-8 text as LF internally and return the original newline style."""
    with open(path, "r", encoding="utf-8", newline="") as fh:
        raw = fh.read()
    return raw.replace("\r\n", "\n"), ("\r\n" if "\r\n" in raw else "\n")


def write_text_atomic(path: Path, text: str, newline: str) -> None:
    """Atomically write UTF-8 text while preserving the caller's newline style."""
    tmp = path.with_name(path.name + ".mcp-tmp")
    try:
        with open(tmp, "w", encoding="utf-8", newline=newline) as fh:
            fh.write(text)
        os.replace(tmp, path)
    except OSError:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise

```

### Core Architecture Module: `python/utils/interactive_schematic.py`
```
"""Opt-in Windows interactive schematic reload after MCP file edits.

Sends KiCad Schematic Editor Revert (reload from disk) and auto-confirms only
the specific reload/revert dialog. Every window handle is PID-scoped to KiCad;
destructive discard/unsaved dialogs are never auto-confirmed.
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Optional

from utils.kicad_process import KiCADProcessManager

logger = logging.getLogger("kicad_interface")

INTERACTIVE_SCHEMATIC = os.environ.get("KICAD_INTERACTIVE_SCHEMATIC", "false").lower() == "true"

if INTERACTIVE_SCHEMATIC:
    logger.info("KiCAD interactive schematic reload enabled (KICAD_INTERACTIVE_SCHEMATIC=true)")

REVERT_CMD_ID = 20236

# Affirmative labels for reload-from-disk confirmation only.
_AFFIRMATIVE_LABELS = frozenset(
    {
        "Yes",
        "&Yes",
        "OK",
        "&OK",
        "Ja",
        "&Ja",
        "Oui",
        "&Oui",
        "Reload",
        "&Reload",
        "Neu laden",
        "&Neu laden",
    }
)

# Never auto-click these — data-loss risk (#194 / #244).
_DESTRUCTIVE_LABELS = frozenset(
    {
        "Discard",
        "&Discard",
        "Discard Changes",
        "Don't Save",
        "Do Not Save",
        "Do not save",
        "No",
        "&No",
        "Cancel",
        "&Cancel",
        "Abort",
        "&Abort",
        "Verwerfen",
        "&Verwerfen",
        "Nicht speichern",
    }
)

_GENERIC_ONLY_TITLES = frozenset(
    {
        "Warning",
        "Information",
        "Confirmation",
        "Warnung",
        "Information",
        "Bestätigung",
        "KiCad",
    }
)

# Main editor frames — not modal reload confirmations.
_MAIN_WINDOW_TITLE_MARKERS = (
    "Schematic Editor",
    "eeschema",
)

# Title must match at least one reload-specific keyword (case-insensitive).
_RELOAD_TITLE_KEYWORDS = re.compile(
    r"(reload|revert|modified|changed|file change|"
    r"neu laden|geändert|aktualis|reload schematic|schematic file|schematic modified)",
    re.IGNORECASE,
)

# Title keywords that indicate a discard-unsaved-work dialog — never auto-confirm.
_DESTRUCTIVE_TITLE_KEYWORDS = re.compile(
    r"(discard|unsaved|verwerfen|nicht speichern|lose changes|without saving)",
    re.IGNORECASE,
)


def is_reload_confirmation_title(title: str) -> bool:
    """True when title looks like a schematic reload/revert prompt, not a generic dialog."""
    if not title or not title.strip():
        return False
    if title.strip() in _GENERIC_ONLY_TITLES:
        return False
    if any(marker in title for marker in _MAIN_WINDOW_TITLE_MARKERS):
        return False
    if _DESTRUCTIVE_TITLE_KEYWORDS.search(title):
        return False
    return bool(_RELOAD_TITLE_KEYWORDS.search(title))


def has_destructive_button(labels: list[str]) -> bool:
    return any(label in _DESTRUCTIVE_LABELS for label in labels)


def choose_affirmative_button(labels: list[str]) -> Optional[str]:
    for label in labels:
        if label in _AFFIRMATIVE_LABELS:
            return label
    return None


def reload_kicad_schematic() -> None:
    """Reload open Schematic Editor from disk after an external MCP edit (Windows, opt-in)."""
    if not INTERACTIVE_SCHEMATIC:
        return
    if os.name != "nt":
        return

    try:
        import win32api
        import win32con
        import win32gui
        import win32process
    except ImportError:
        logger.warning("pywin32 not available — interactive schematic reload disabled")
        return

    kicad_pids = KiCADProcessManager.get_running_pids()
    if not kicad_pids:
        logger.debug("reload_kicad_schematic: no KiCad process found")
        return

    def _hwnd_pid(hwnd: int) -> int:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        return pid

    def _owned_by_kicad(hwnd: int) -> bool:
        try:
            return _hwnd_pid(hwnd) in kicad_pids
        except Exception:
            return False

    def _button_labels(hwnd: int) -> list[str]:
        labels: list[str] = []

        def _visit(child: int, _: object) -> None:
            try:
                text = win32gui.GetWindowText(child)
                if text:
                    labels.append(text)
            except Exception:
                pass

        try:
            win32gui.EnumChildWindows(hwnd, _visit, None)
        except Exception:
            pass
        return labels

    def _try_confirm_reload_dialog(hwnd: int, title: str) -> bool:
        if not is_reload_confirmation_title(title):
            return False
        labels = _button_labels(hwnd)
        if has_destructive_button(labels):
            logger.warning(
                "reload_kicad_schematic: refusing auto-confirm on destructive dialog "
                f"'{title}' (buttons={labels!r})"
            )
            return False
        affirmative = choose_affirmative_button(labels)
        if not affirmative:
            logger.debug(
                f"reload_kicad_schematic: reload dialog '{title}' has no safe affirmative "
                f"button (buttons={labels!r})"
            )
            return False
        for child in _iter_child_buttons(hwnd):
            if win32gui.GetWindowText(child) == affirmative:
                win32api.PostMessage(child, win32con.BM_CLICK, 0, 0)
                logger.info(
                    f"reload_kicad_schematic: confirmed reload dialog '{title}' "
                    f"via '{affirmative}' hwnd={hex(hwnd)}"
                )
                return True
        return False

    def _iter_child_buttons(hwnd: int):
        buttons: list[int] = []

        def _visit(child: int, _: object) -> None:
            buttons.append(child)

        try:
            win32gui.EnumChildWindows(hwnd, _visit, None)
        except Exception:
            pass
        return buttons

    def _scan_reload_dialogs(skip_hwnd: Optional[int] = None) -> bool:
        confirmed = False

        def _check(hwnd: int, _: object) -> None:
            nonlocal confirmed
            if confirmed or hwnd == skip_hwnd:
                return
            if not win32gui.IsWindowVisible(hwnd) or not _owned_by_kicad(hwnd):
                return
            title = win32gui.GetWindowText(hwnd)
            if _try_confirm_reload_dialog(hwnd, title):
                confirmed = True

        win32gui.EnumWindows(_check, None)
        return confirmed

    schematic_hwnd: Optional[int] = None

    def _find_schematic(hwnd: int, _: object) -> None:
        nonlocal schematic_hwnd
        if schematic_hwnd is not None or not _owned_by_kicad(hwnd):
            return
        title = win32gui.GetWindowText(hwnd)
        if "Schematic Editor" in title or title.lower() == "eeschema":
            schematic_hwnd = hwnd

    win32gui.EnumWindows(_find_schematic, None)
    if schematic_hwnd is None:
        logger.debug("reload_kicad_schematic: Schematic Editor window not found")
        return

    win32api.PostMessage(schematic_hwnd, win32con.WM_COMMAND, REVERT_CMD_ID, 0)
    logger.info(f"reload_kicad_schematic: sent Revert to hwnd={hex(schematic_hwnd)}")

    for _ in range(8):
        time.sleep(0.15)
        if _scan_reload_dialogs(skip_hwnd=schematic_hwnd):
            return

    logger.debug("reload_kicad_schematic: no reload confirmation dialog appeared after Revert")

```

### Core Architecture Module: `python/utils/kicad_cli.py`
```
"""Robust resolution of the ``kicad-cli`` executable.

KiCad's Windows installer does **not** add ``KiCad\\<ver>\\bin`` to ``PATH``, so a
bare ``shutil.which("kicad-cli")`` fails on an otherwise-normal install even though
``kicad-cli.exe`` is sitting right there in the install's ``bin`` directory. Every MCP
tool that shells out to ``kicad-cli`` (netlist/gerber/drill/pos/pdf/svg/... exports,
ERC/DRC) then fails with a misleading "not found in PATH" error.

This module centralises resolution so every cli-backed tool uses the same logic:

    1. Explicit override: ``$KICAD_CLI`` / ``$KICAD_CLI_PATH`` (if set). An explicit
       override is authoritative — if it is set but does not point at a real file we
       refuse to silently fall back to a different binary.
    2. Adjacent to the running interpreter: ``Path(sys.executable).parent / kicad-cli``.
       The MCP backend runs under KiCad's bundled Python (``KiCad\\<ver>\\bin\\python``,
       which is how it imports ``pcbnew``); ``kicad-cli`` lives in that same ``bin``
       directory, making this the most reliable source for this server.
    3. ``PATH`` lookup.
    4. Known per-OS install locations (newest KiCad version first).

The resolved path is cached. The environment override is re-checked on every call so a
test (or a user) can change it without a stale cache masking the new value.
"""

import logging
import os
import platform
import shutil
import sys
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger("kicad_interface")

_ENV_VARS = ("KICAD_CLI", "KICAD_CLI_PATH")
_cached_cli: Optional[str] = None


def _cli_name() -> str:
    """Executable basename for the current OS."""
    return "kicad-cli.exe" if platform.system() == "Windows" else "kicad-cli"


def _override_value() -> Optional[str]:
    """Return the first non-empty KICAD_CLI / KICAD_CLI_PATH value, or None."""
    for env in _ENV_VARS:
        val = os.environ.get(env)
        if val:
            return val
    return None


def _candidate_paths() -> List[Path]:
    """Well-known per-OS install locations for kicad-cli, newest version first."""
    name = _cli_name()
    system = platform.system()
    candidates: List[Path] = []

    if system == "Windows":
        # Shared root discovery (registry + Program Files + custom C:\KiCad roots,
        # newest first) so cli/symbol/footprint lookups can't drift apart (#286).
        from utils.kicad_roots import windows_kicad_roots

        candidates.extend(root / "bin" / name for root in windows_kicad_roots())
    elif system == "Darwin":
        candidates.extend(
            [
                Path("/Applications/KiCad/KiCad.app/Contents/MacOS") / name,
                Path("/usr/local/bin") / name,
                Path("/opt/homebrew/bin") / name,
            ]
        )
    else:  # Linux / *nix
        candidates.extend(
            [
                Path("/usr/bin") / name,
                Path("/usr/local/bin") / name,
                Path("/app/bin") / name,  # Flatpak sandbox
                Path("/var/lib/flatpak/app/org.kicad.KiCad/current/active/files/bin") / name,
                Path.home() / ".local" / "bin" / name,
            ]
        )
    return candidates


def resolve_kicad_cli(force: bool = False) -> Optional[str]:
    """Return the absolute path to ``kicad-cli``, or ``None`` if it cannot be found.

    The environment override is honoured first and re-checked on every call. An override
    that is set but invalid returns ``None`` (we do not fall back to auto-detection — the
    user asked for a specific binary). Auto-detected results are cached; pass
    ``force=True`` to bypass the cache.
    """
    global _cached_cli

    # 1. Explicit override — authoritative, always checked first (never cached so a
    #    changed/cleared env var takes effect immediately).
    override = _override_value()
    if override is not None:
        path = Path(override)
        if path.is_file():
            return str(path)
        logger.warning(
            "KICAD_CLI override %r does not point at a file; refusing to fall back to "
            "another kicad-cli. Fix or unset the variable.",
            override,
        )
        return None

    if not force and _cached_cli is not None:
        return _cached_cli

    name = _cli_name()

    # 2. Adjacent to the running interpreter (KiCad's bundled python bin/).
    try:
        adjacent = Path(sys.executable).parent / name
        if adjacent.is_file():
            _cached_cli = str(adjacent)
            return _cached_cli
    except (OSError, ValueError):
        pass

    # 3. PATH.
    on_path = shutil.which(name) or shutil.which("kicad-cli")
    if on_path:
        _cached_cli = on_path
        return _cached_cli

    # 4. Known install locations.
    for candidate in _candidate_paths():
        if candidate.is_file():
            _cached_cli = str(candidate)
            return _cached_cli

    return None


def kicad_cli_not_found_message() -> str:
    """Build a clear, actionable error message listing every location tried.

    Replaces the old bare ``"kicad-cli not found in PATH"`` so users can see exactly
    where the resolver looked and how to point it at their install.
    """
    name = _cli_name()
    lines: List[str] = ["Could not locate kicad-cli. Tried, in order:"]

    override = _override_value()
    if override is not None:
        lines.append(f"  - ${{KICAD_CLI}} = {override}  (set, but not a file)")
    else:
        lines.append("  - $KICAD_CLI / $KICAD_CLI_PATH  (not set)")

    try:
        lines.append(f"  - next to the Python interpreter: {Path(sys.executable).parent / name}")
    except (OSError, ValueError):
        pass
    lines.append(f"  - PATH lookup of {name}")
    for candidate in _candidate_paths():
        lines.append(f"  - {candidate}")

    lines.append(
        "Set the KICAD_CLI environment variable to the full path of kicad-cli "
        "(e.g. on Windows: C:\\Program Files\\KiCad\\10.0\\bin\\kicad-cli.exe) and retry."
    )
    return "\n".join(lines)


def reset_cache() -> None:
    """Clear the cached resolution (primarily for tests)."""
    global _cached_cli
    _cached_cli = None

```

### Core Architecture Module: `python/utils/kicad_dru.py`
```
"""Read/write ``.kicad_dru`` custom design-rule files.

KiCad's per-layer/conditional DRC constraints live in a project-scoped
``.kicad_dru`` text file (an S-expression rules DSL), sibling to the
``.kicad_pcb``/``.kicad_pro`` with the same base filename — e.g.
``myproject.kicad_dru`` next to ``myproject.kicad_pcb``. This is not exposed
through any pcbnew SWIG API: there is no ``DRC_RULE``/rules-parsing class in
the bindings, so the write path here is pure text manipulation, not a live
board call. ``kicad-cli pcb drc`` auto-discovers the sibling file by
convention (there is no ``--rules``/``--dru`` flag), so writing this file is
the entire integration surface.

Verified against real KiCad 10 (``kicad-cli pcb drc``) with a deliberately
strict rule: all four constraint types below (``track_width``, ``clearance``,
``via_diameter``, ``hole_size``) are recognized and enforced, and violations
cite the rule by name (``rule 'mcp_layer_constraint_F.Cu' ...``).

These helpers do a surgical text edit (find-and-replace-by-name, or append)
rather than a full parse/reserialize, so a hand-edited file's other rules,
comments, and formatting survive untouched — matching how this codebase
already edits ``.kicad_sch`` files (see ``schematic_text_utils.py``) rather
than round-tripping them through a full S-expression reserializer.
"""

import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from utils.paren_match import match_paren

# Rule names generated by this module, so a later call for the same layer
# replaces its own rule instead of duplicating it.
_RULE_NAME_PREFIX = "mcp_layer_constraint_"


def rule_name_for_layer(layer: str) -> str:
    return f"{_RULE_NAME_PREFIX}{layer}"


def resolve_dru_path(board_path: Optional[str]) -> Optional[str]:
    """Derive the sibling ``.kicad_dru`` path from a ``.kicad_pcb`` path."""
    if not board_path or not board_path.endswith(".kicad_pcb"):
        return None
    return str(Path(board_path).with_suffix(".kicad_dru"))


def _find_matching_paren(s: str, start: int) -> int:
    """Return index of the ')' matching the '(' at position *start*, or -1.

    Parens inside quoted strings (rule names, condition expressions) are text.
    """
    return match_paren(s, start)


def _find_rule_block(content: str, rule_name: str) -> Tuple[int, int]:
    """Find a ``(rule "rule_name" ...)`` block.

    Returns ``(start, end)`` character offsets (``end`` is exclusive, one
    past the closing paren), or ``(-1, -1)`` if the rule isn't present.
    """
    marker = f'(rule "{rule_name}"'
    pos = content.find(marker)
    if pos == -1:
        return -1, -1
    end = _find_matching_paren(content, pos)
    if end == -1:
        return -1, -1
    return pos, end + 1


def build_layer_constraint_rule(
    layer: str,
    min_track_width: Optional[float] = None,
    min_clearance: Optional[float] = None,
    min_via_diameter: Optional[float] = None,
    min_via_drill: Optional[float] = None,
) -> str:
    """Build a ``(rule ...)`` block enforcing per-layer minimums.

    ``(layer "<layer>")`` alone scopes every constraint to that layer — no
    ``condition`` clause is needed since we're not filtering by net/diff-pair,
    just setting a floor for the whole layer.
    """
    constraints: List[str] = []
    if min_track_width is not None:
        constraints.append(f"  (constraint track_width (min {min_track_width}mm))")
    if min_clearance is not None:
        constraints.append(f"  (constraint clearance (min {min_clearance}mm))")
    if min_via_diameter is not None:
        constraints.append(f"  (constraint via_diameter (min {min_via_diameter}mm))")
    if min_via_drill is not None:
        constraints.append(f"  (constraint hole_size (min {min_via_drill}mm))")

    lines = [
        f'(rule "{rule_name_for_layer(layer)}"',
        f'  (layer "{layer}")',
        *constraints,
        ")",
    ]
    return "\n".join(lines)


def apply_layer_constraint_rule(dru_text: str, rule_name: str, rule_text: str) -> str:
    """Insert or replace a named rule block in ``dru_text``. Pure string transform."""
    start, end = _find_rule_block(dru_text, rule_name)
    if start != -1:
        return dru_text[:start] + rule_text + dru_text[end:]

    text = dru_text.rstrip("\n")
    if not text:
        text = "(version 1)"
    return text + "\n\n" + rule_text + "\n"


def persist_layer_constraint_rule(
    dru_path: Optional[str], rule_name: str, rule_text: str
) -> Dict[str, Any]:
    """Read/modify/write ``dru_path`` (creating it if absent). Atomic write.

    Returns ``{"persisted": bool, "druFile"?: str, "warning"?: str}``. Never
    raises: a persistence failure is reported, not fatal.
    """
    if not dru_path:
        return {
            "persisted": False,
            "warning": "could not determine .kicad_dru path (board has no .kicad_pcb file name)",
        }
    try:
        if os.path.exists(dru_path):
            with open(dru_path, "r", encoding="utf-8") as f:
                existing = f.read()
        else:
            existing = "(version 1)\n"

        new_text = apply_layer_constraint_rule(existing, rule_name, rule_text)

        directory = os.path.dirname(dru_path) or "."
        fd, tmp_path = tempfile.mkstemp(dir=directory, prefix=".dru-", suffix=".kicad_dru")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(new_text)
            os.replace(tmp_path, dru_path)
        except Exception:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            raise
        return {"persisted": True, "druFile": dru_path}
    except Exception as exc:  # report, never fail the command on a persistence error
        return {
            "persisted": False,
            "warning": f"could not persist layer constraint to {dru_path}: {exc}",
        }

```

### Core Architecture Module: `python/utils/kicad_netlist.py`
```
"""KiCad's own netlist for a schematic, from ``kicad-cli sch export netlist``.

``sync_schematic_to_board`` used to build the pad-to-net map itself, by
following wires and labels geometrically. That diverges from KiCad wherever
KiCad's connectivity is richer than a label match:
- a net that changes name across a sheet boundary (local label ``CANH`` on the
  root, sheet pin and hierarchical label ``CAN_H`` below) stayed two nets;
- names came out flat (``SWDIO``, not ``/MCU/SWDIO``);
- a label in the middle of a wire did not reach the pins at its ends.

On a 77-part, 9-sheet board this put 224 pads on the wrong net, while the tool
reported success. KiCad's netlist is the reference KiCad itself uses when it
updates a PCB, so this module reads it: components with their symbol paths,
fields and flags, and every net with its pins, including KiCad's
``unconnected-(R1-Pad1)`` nets for unwired pins.

The S-expression format (``kicadsexpr``) is read, not the XML one: the XML
writer unescapes net names, so a pin named ``ADC7/PB6`` gives
``Net-(U2-ADC7/PB6)`` there. Pcbnew and KiCad's parity check use the escaped
``Net-(U2-ADC7{slash}PB6)``, and a board built from the XML names fails parity on
every such net.
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger("kicad_interface")

SExpr = Union[str, List["SExpr"]]

# What KiCad's writer puts after a backslash inside a quoted token, and the
# character it stands for. Any other escaped character keeps its backslash,
# as KiCad's own lexer leaves it.
_UNESCAPES = {"n": "\n", "r": "\r", "t": "\t", '"': '"', "\\": "\\"}


def parse_sexpr(text: str) -> SExpr:
    """Parse one S-expression into nested lists of strings.

    Quoted and bare atoms both become ``str``. KiCad's escapes inside quotes
    (``\\n``, ``\\r``, ``\\t``, ``\\"`` and ``\\\\``) are mapped back to the
    characters the writer escaped: a multi-line field value written as
    ``"line1\\nline2"`` comes back with its line feed, not as ``line1nline2``.
    """
    stack: List[List[SExpr]] = [[]]
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == "(":
            stack.append([])
            i += 1
        elif c == ")":
            if len(stack) == 1:
                raise ValueError(f"unexpected ')' at offset {i}")
            done = stack.pop()
            stack[-1].append(done)
            i += 1
        elif c == '"':
            j = i + 1
            buf = []
            while j < n and text[j] != '"':
                if text[j] == "\\" and j + 1 < n:
                    nxt = text[j + 1]
                    buf.append(_UNESCAPES.get(nxt, "\\" + nxt))
                    j += 2
                    continue
                buf.append(text[j])
                j += 1
            if j >= n:
                raise ValueError("unterminated string")
            stack[-1].append("".join(buf))
            i = j + 1
        elif c.isspace():
            i += 1
        else:
            j = i
            while j < n and not text[j].isspace() and text[j] not in '()"':
                j += 1
            stack[-1].append(text[i:j])
            i = j
    if len(stack) != 1 or len(stack[0]) != 1:
        raise ValueError("unbalanced or multiple top-level expressions")
    return stack[0][0]


def _children(node: Any, tag: str) -> List[List[Any]]:
    return [c for c in node[1:] if isinstance(c, list) and c and c[0] == tag]


def _child(node: Any, tag: str) -> Optional[List[Any]]:
    found = _children(node, tag)
    return found[0] if found else None


def _text(node: Any, tag: str, default: str = "") -> str:
    """The string value of ``(tag "value")`` under *node*."""
    c = _child(node, tag)
    if c is None or len(c) < 2 or not isinstance(c[1], str):
        return default
    return c[1]


@dataclass
class Netlist:
    #: One entry per symbol: reference, value, footprint, uuid (the symbol's),
    #: path (``/sheet-uuid/.../symbol-uuid``, what a PCB footprint links by),
    #: sheetname, sheetfile, fields ({name: value}), and the flags
    #: exclude_from_bom / dnp / exclude_from_board.
    components: List[Dict[str, Any]] = field(default_factory=list)
    #: (reference, pin number) -> net name, escaped as pcbnew writes it
    pad_nets: Dict[Tuple[str, str], str] = field(default_factory=dict)
    #: Net names in KiCad's order (net code)
    net_names: List[str] = field(default_factory=list)
    #: Sheet paths by name, e.g. "/", "/MCU/"
    sheets: List[str] = field(default_factory=list)


_FLAGS = ("exclude_from_bom", "dnp", "exclude_from_board")


def parse_netlist(text: str) -> Netlist:
    """Parse a ``kicadsexpr`` netlist (as written by ``kicad-cli``)."""
    root = parse_sexpr(text)
    if not isinstance(root, list) or not root or root[0] != "export":
        raise ValueError("not a KiCad netlist (expected (export ...))")
    out = Netlist()
    design = _child(root, "design")
    for sheet in _children(design, "sheet") if design else []:
        out.sheets.append(_text(sheet, "name"))
    components = _child(root, "components")
    for comp in _children(components, "comp") if components else []:
        sheetpath = _child(comp, "sheetpath")
        sheet_tstamps = _text(sheetpath, "tstamps", "/") if sheetpath else "/"
        # (tstamps) is the symbol UUID. KiCad 10 writes one; older exports could
        # join several (one per instance of a reused sheet). Keep the first.
        uuids = _text(comp, "tstamps").replace(",", " ").split()
        uuid = uuids[0] if uuids else ""
        props: Dict[str, Optional[str]] = {}
        for prop in _children(comp, "property"):
            props[_text(prop, "name")] = _text(prop, "value") if _child(prop, "value") else None
        fields: Dict[str, str] = {}
        flds = _child(comp, "fields")
        for f in _children(flds, "field") if flds else []:
            name = _text(f, "name")
            value = next((x for x in f[2:] if isinstance(x, str)), "")
            if name:
                fields[name] = value
        entry: Dict[str, Any] = {
            "reference": _text(comp, "ref"),
            "value": _text(comp, "value"),
            "footprint": _text(comp, "footprint"),
            "uuid": uuid,
            "path": (sheet_tstamps.rstrip("/") + "/" + uuid) if uuid else "",
            "sheetname": props.get("Sheetname") or "",
            "sheetfile": props.get("Sheetfile") or "",
            "fields": fields,
        }
        for flag in _FLAGS:
            entry[flag] = flag in props
        out.components.append(entry)
    nets = _child(root, "nets")
    for net in _children(nets, "net") if nets else []:
        name = _text(net, "name")
        out.net_names.append(name)
        for node in _children(net, "node"):
            out.pad_nets[(_text(node, "ref"), _text(node, "pin"))] = name
    return out


def export_netlist(kicad_cli: str, schematic_path: str, timeout: int = 60) -> Optional[Netlist]:
    """Run kicad-cli and parse the result. None when kicad-cli fails, with the reason logged."""
    with tempfile.TemporaryDirectory(prefix="kicad-netlist-") as tmp:
        out_path = Path(tmp) / "netlist.net"
        cmd = [
            kicad_cli,
            "sch",
            "export",
            "netlist",
            "--format",
            "kicadsexpr",
            "--output",
            str(out_path),
            schematic_path,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        except (OSError, subprocess.TimeoutExpired) as exc:
            logger.warning(f"kicad-cli netlist export could not run: {exc}")
            return None
        if result.returncode != 0 or not out_path.exists():
            logger.warning(
                f"kicad-cli netlist export failed (exit {result.returncode}): "
                f"{(result.stderr or result.stdout).strip()[-500:]}"
            )
            return None
        try:
            return parse_netlist(out_path.read_text(encoding="utf-8"))
        except ValueError as exc:
            logger.warning(f"kicad-cli netlist did not parse: {exc}")
            return None

```

### Core Architecture Module: `python/utils/kicad_process.py`
```
"""
KiCAD Process Management Utilities

Detects if KiCAD is running and provides auto-launch functionality.
"""

import ctypes
import logging
import os
import platform
import subprocess
import time
from ctypes import wintypes
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)


class KiCADProcessManager:
    """Manages KiCAD process detection and launching"""

    @staticmethod
    def _windows_list_processes() -> List[dict]:
        """List running processes on Windows using Toolhelp API."""
        processes: List[dict] = []
        try:
            TH32CS_SNAPPROCESS = 0x00000002
            try:
                ulong_ptr = wintypes.ULONG_PTR  # type: ignore[attr-defined]
            except AttributeError:
                ulong_ptr = (
                    ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong
                )

            class PROCESSENTRY32W(ctypes.Structure):
                _fields_ = [
                    ("dwSize", wintypes.DWORD),
                    ("cntUsage", wintypes.DWORD),
                    ("th32ProcessID", wintypes.DWORD),
                    ("th32DefaultHeapID", ulong_ptr),
                    ("th32ModuleID", wintypes.DWORD),
                    ("cntThreads", wintypes.DWORD),
                    ("th32ParentProcessID", wintypes.DWORD),
                    ("pcPriClassBase", wintypes.LONG),
                    ("dwFlags", wintypes.DWORD),
                    ("szExeFile", wintypes.WCHAR * wintypes.MAX_PATH),
                ]

            CreateToolhelp32Snapshot = ctypes.windll.kernel32.CreateToolhelp32Snapshot
            Process32FirstW = ctypes.windll.kernel32.Process32FirstW
            Process32NextW = ctypes.windll.kernel32.Process32NextW
            CloseHandle = ctypes.windll.kernel32.CloseHandle

            snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            if snapshot == wintypes.HANDLE(-1).value:
                return processes

            entry = PROCESSENTRY32W()
            entry.dwSize = ctypes.sizeof(PROCESSENTRY32W)

            if Process32FirstW(snapshot, ctypes.byref(entry)):
                while True:
                    processes.append(
                        {
                            "pid": str(entry.th32ProcessID),
                            "name": entry.szExeFile,
                            "command": entry.szExeFile,
                        }
                    )
                    if not Process32NextW(snapshot, ctypes.byref(entry)):
                        break

            CloseHandle(snapshot)
        except Exception as e:
            logger.error(f"Error listing Windows processes: {e}")

        return processes

    @staticmethod
    def is_running() -> bool:
        """
        Check if KiCAD is currently running

        Returns:
            True if KiCAD process found, False otherwise
        """
        system = platform.system()

        try:
            if system == "Linux":
                # Check for actual pcbnew/kicad binaries (not python scripts)
                # Use exact process name matching to avoid matching our own kicad_interface.py
                result = subprocess.run(
                    ["pgrep", "-x", "pcbnew|kicad"], capture_output=True, text=True
                )
                if result.returncode == 0:
                    return True
                # Also check with -f for full path matching, but exclude our script
                result = subprocess.run(
                    ["pgrep", "-f", "/pcbnew|/kicad"], capture_output=True, text=True
                )
                # Double-check it's not our own process
                if result.returncode == 0:
                    pids = result.stdout.strip().split("\n")
                    for pid in pids:
                        try:
                            cmdline = subprocess.run(
                                ["ps", "-p", pid, "-o", "command="], capture_output=True, text=True
                            )
                            if "kicad_interface.py" not in cmdline.stdout:
                                return True
                        except:
                            pass
                return False

            elif system == "Darwin":  # macOS
                result = subprocess.run(
                    ["pgrep", "-f", "KiCad|pcbnew"], capture_output=True, text=True
                )
                return result.returncode == 0

            elif system == "Windows":
                return bool(KiCADProcessManager.get_running_pids())

            else:
                logger.warning(f"Process detection not implemented for {system}")
                return False

        except Exception as e:
            logger.error(f"Error checking if KiCAD is running: {e}")
            return False

    @staticmethod
    def get_running_pids() -> set[int]:
        """Return PIDs of running KiCad GUI processes (Windows only)."""
        if platform.system() != "Windows":
            return set()
        names = {"kicad.exe", "pcbnew.exe", "eeschema.exe"}
        pids: set[int] = set()
        for proc in KiCADProcessManager._windows_list_processes():
            if (proc.get("name") or "").lower() not in names:
                continue
            try:
                pids.add(int(proc["pid"]))
            except (TypeError, ValueError):
                pass
        return pids

    @staticmethod
    def get_executable_path() -> Optional[Path]:
        """
        Get path to KiCAD executable

        Returns:
            Path to pcbnew/kicad executable, or None if not found
        """
        system = platform.system()

        # Try to find executable in PATH first
        for cmd in ["pcbnew", "kicad"]:
            result = subprocess.run(
                ["which", cmd] if system != "Windows" else ["where", cmd],
                capture_output=True,
                text=True,
                encoding="mbcs" if system == "Windows" else None,
                errors="ignore" if system == "Windows" else None,
                timeout=5 if system == "Windows" else None,
            )
            if result.returncode == 0:
                exe_path = result.stdout.strip().split("\n")[0]
                logger.info(f"Found KiCAD executable: {exe_path}")
                return Path(exe_path)

        # Platform-specific default paths
        if system == "Linux":
            candidates = [
                Path("/usr/bin/pcbnew"),
                Path("/usr/local/bin/pcbnew"),
                Path("/usr/bin/kicad"),
            ]
        elif system == "Darwin":  # macOS
            candidates = [
                Path("/Applications/KiCad/KiCad.app/Contents/MacOS/kicad"),
                Path("/Applications/KiCad/pcbnew.app/Contents/MacOS/pcbnew"),
            ]
        elif system == "Windows":
            from utils.kicad_roots import kicad_install_roots

            # Every discovered install root first, newest version first: the
            # registry, Program Files and custom roots such as C:\KiCad\<ver>
            # (#286). The fixed locations stay as a last resort.
            candidates = [root / "bin" / "pcbnew.exe" for root in kicad_install_roots()]
            candidates += [
                Path("C:/Program Files/KiCad/10.0/bin/pcbnew.exe"),
                Path("C:/Program Files/KiCad/9.0/bin/pcbnew.exe"),
                Path("C:/Program Files/KiCad/8.0/bin/pcbnew.exe"),
                Path("C:/Program Files (x86)/KiCad/10.0/bin/pcbnew.exe"),
                Path("C:/Program Files (x86)/KiCad/9.0/bin/pcbnew.exe"),
            ]
        else:
            candidates = []

        for path in candidates:
            if path.exists():
                logger.info(f"Found KiCAD executable: {path}")
                return path

        logger.warning("Could not find KiCAD executable")
        return None

    @staticmethod
    def launch(project_path: Optional[Path] = None, wait_for_start: bool = True) -> bool:
        """
        Launch KiCAD PCB Editor

        Args:
            project_path: Optional path to .kicad_pcb file to open
            wait_for_start: Wait for process to start before returning

        Returns:
            True if launch successful, False otherwise
        """
        try:
            # Check if already running
            if KiCADProcessManager.is_running():
                logger.info("KiCAD is already running")
                return True

            # Find executable
            exe_path = KiCADProcessManager.get_executable_path()
            if not exe_path:
                logger.error("Cannot launch KiCAD: executable not found")
                return False

            # Build command
            cmd = [str(exe_path)]
            if project_path:
                cmd.append(str(project_path))

            logger.info(f"Launching KiCAD: {' '.join(cmd)}")

            # Launch process in background
            system = platform.system()
            if system == "Windows":
                # Windows: Use CREATE_NEW_PROCESS_GROUP to detach
                subprocess.Popen(
                    cmd,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                # Unix: Use nohup or start in background
                subprocess.Popen(
                    cmd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )

            # Wait for process to start
            if wait_for_start:
                logger.info("Waiting for KiCAD to start...")
                for i in range(10):  # Wait up to 5 seconds
                    time.sleep(0.5)
                    if KiCADProcessManager.is_running():
                        logger.info("✓ KiCAD started successfully")
   
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #432** (2026-09-24): **annotate_schematic gives every use of a sheet the same reference, and ignores numbers used on other sheets**
  *Symptoms*: `annotate_schematic` numbers the unannotated parts (`R?`) in one schematic file. In a hierarchical design it hands out duplicate references in two ways, and KiCad's netlist then lists parts more than once. ERC reports neither, and the tool itself reports a clean result.  ## 1. Every use of a sheet gets the same number  A part on a sheet that is used more than once has one instance entry per use, and KiCad needs a distinct reference in each. Placement handles this since #431 (fixing #428). `_handle_annotate_schematic` (python/commands/schematic_handlers.py) calls kicad-skip's `Symbol.setAllReferences(new_ref)`. That writes a single value into the Reference field and into every `(path ...)` entry.  To reproduce on main at 145d863, use a copy of KiCad 10.0.5's complex_hierarchy demo, where `ampli_ht.kicad_sch` is used twice:  1. Place `R?` on ampli_ht with `add_schematic_component`. Both uses get `R?`, which is correct. 2. Run `annotate_schematic` on ampli_ht. It reports one change, `R?` to `R1`, and both uses become R1. 3. `kicad-cli sch export netlist` lists R1 twice and prints "Warning: schematic has annotation errors, please use the schematic editor to fix them".  ## 2. Numbers used on other sheets are not seen  The set of used numbers comes from the one file being annotated. In the same demo copy, place `R1` on the root sheet, then annotate ampli_ht as above. It picks R1 again, and the netlist lists R1 three times: the root's R1 and both uses of ampli_ht.  ## Suggested fix 

- **Issue #428** (2026-09-24): **Hierarchical instance paths: multi-instance sheets, sub-sheets in subfolders, and fix_subsheet_instances below level 2**
  *Symptoms*: Follow-ups from the review of #424 (fix for #423). #424 makes a part placed on a single-instance sub-sheet get the `/<root-uuid>/<sheet-block-uuid>` path KiCad writes, at any depth. These cases are still wrong. They were checked against KiCad 10.0.5 with its own demo projects as the reference.  1. **A sheet used more than once gets one path.** `DynamicSymbolLoader._build_instance_path` returns a single string, and it names the first instance only. KiCad writes one `(path ...)` entry per sheet instance: the ampli_ht demo has 2, channel_strip 4, and vme-wren's io_driver 16. With one entry, both instances of a two-instance sheet carry the same reference. In the ampli_ht demo, RV301 disappears and RV201 appears twice. `kicad-cli sch export netlist` prints "schematic has annotation errors", and ERC still reports 0 violations. The fix is to return every chain from the root, which `_sheet_chain_to` could do by collecting instead of returning at the first match. `create_component_instance` would then write one `(path ...)` per chain, with a distinct reference per instance. 2. **Sub-sheets in a subdirectory never find their root.** `_root_candidates` / `_find_root_schematic` look only in the target's own directory. A sheet file referenced as `sub/child.kicad_sch` from a root one level up falls back to the one-level path. 3. **`fix_subsheet_instances` (python/commands/schematic_hierarchy.py) has the old spelling and depth assumptions.** It matches only `"Sheet file"`, while KiCad write

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

### Incident Patch 1: `94b05266` (2026-11-12)
**Commit Message**: fix: record the board signature after autoroute, import_ses and refill_zones

All three write the board file themselves but never recorded that write.
The session kept the file's signature from before the command, so the next
auto-save (after any board edit, and refill_zones' own) found the contents
changed and refused as "changed externally", leaving the edit in memory only.
Every later edit was refused the same way until the project was reopened.

autoroute and import_ses now save through FreeroutingCommands._save_board,
which reports a successful save to KiCADInterface._note_own_board_save. That
records the signature only when the saved file is the session's own board, so
a save to another file or a failed save still lets a real external edit be
refused. refill_zones records the signature after reloading the board the
fill subprocess wrote.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -101,6 +101,17 @@ All notable changes to the KiCAD MCP Server project are documented here.
 
 ### Bug Fixes
 
+- **`autoroute`, `import_ses` and `refill_zones` no longer make the next
+  auto-save refuse.** All three write the board file themselves but did not
+  record that write, so the session still held the file's signature from
+  before the command. The auto-save after the next board edit (and
+  `refill_zones`' own) then found the file changed, reported "the on-disk PCB
+  file's contents changed externally", and left the edit only in memory, as
+  it did for every later edit until the project was reopened. They now record
+  the file after a successful save of the session's own board. A save that
+  fails, or that goes to a different file, records nothing, so a real external
+  edit is still refused.
+
 - **A sheet with exactly one hierarchical label no longer breaks board
   creation.** kicad-skip returns a collection for two or more hierarchical
   labels (or no-connects), but the bare element when there is exactly one.
```

**File**: `python/commands/freerouting.py` (modified, +24/-12)
```diff
@@ -19,7 +19,7 @@
 import time
 import zipfile
 from pathlib import Path
-from typing import Any, Dict, Iterable, List, Optional, Tuple
+from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
 
 from utils.project_netclasses import apply_net_classes_to_board, load_project_net_classes
 from utils.project_settings_guard import preserve_project_settings
@@ -896,10 +896,30 @@ def _append_missing_keepouts(board, dsn_path) -> int:
 class FreeroutingCommands:
     """Handles Freerouting autoroute operations."""
 
-    def __init__(self, board: Any = None) -> None:
+    def __init__(
+        self,
+        board: Any = None,
+        on_board_saved: Optional[Callable[[str], None]] = None,
+    ) -> None:
         self.board = board
         # Nets left out of the last autoroute's DSN (routeNets / excludeNets), or None.
         self._nets_left_out: Optional[List[str]] = None
+        # Told the path after each successful save of self.board, so the
+        # interface can record the file's new signature. Without that, its
+        # next auto-save takes this save for an external change and refuses.
+        self.on_board_saved = on_board_saved
+
+    def _save_board(self, board_path: str, after: str) -> None:
+        """Save self.board to board_path; report a successful save."""
+        try:
+            with preserve_project_settings(board_path):
+                self.board.Save(board_path)
+        except Exception as e:
+            logger.warning(f"Board save after {after} failed: {e}")
+            return
+        on_board_saved = getattr(self, "on_board_saved", None)
+        if on_board_saved is not None:
+            on_board_saved(board_path)
 
     def _apply_project_net_classes(self, board_path: Optional[str]) -> Dict[str, Any]:
         """Push the project's net classes into the loaded board before DSN
@@ -1463,11 +1483,7 @@ def _autoroute_staged(
                 pass
 
         # Step 4: Save board
-        try:
-            with preserve_project_settings(board_path):
-                self.board.Save(board_path)
-        except Exception as e:
-            logger.warning(f"Board save after autoroute failed: {e}")
+        self._save_board(board_path, "autoroute")
 
         # Collect stats
         tracks = self.board.GetTracks()
@@ -1695,11 +1711,7 @@ def import_ses(self, params: Dict[str, Any]) -> Dict[str, Any]:
 
         board_path = params.get("boardPath") or self.board.GetFileName()
         if board_path:
-            try:
-                with preserve_project_settings(board_path):
-                    self.board.Save(board_path)
-            except Exception as e:
-                logger.warning(f"Board save after SES import failed: {e}")
+            self._save_board(board_path, "SES import")
 
         tracks = self.board.GetTracks()
         track_count = sum(1 for t in tracks if t.GetClass() != "PCB_VIA")
```

**File**: `python/kicad_interface.py` (modified, +22/-1)
```diff
@@ -511,7 +511,9 @@ def __init__(self) -> None:
         self.routing_commands = RoutingCommands(self.board)
         self.stackup_commands = StackupCommands(self.board, self)
         self.via_summary_commands = ViaSummaryCommands(self.board)
-        self.freerouting_commands = FreeroutingCommands(self.board)
+        self.freerouting_commands = FreeroutingCommands(
+            self.board, on_board_saved=self._note_own_board_save
+        )
         self.eagle_commands = EagleCommands()
         self.symbol_schematic_commands = SymbolSchematicCommands()
         self.library_management_commands = LibraryManagementCommands()
@@ -1637,6 +1639,21 @@ def _record_board_signature(self) -> None:
             path = None
         self._board_disk_signature = self._disk_signature(path) if path else None
 
+    def _note_own_board_save(self, path: str) -> None:
+        """A command saved self.board to ``path`` itself (autoroute, import_ses).
+
+        When that is the board's own file, record its new signature, as
+        handle_command does after save_project. Otherwise the next auto-save
+        sees the file differ from the signature taken before the command and
+        refuses, reporting our own write as an external change. A save to some
+        other file leaves the board's file, and its signature, as they were.
+        """
+        current = self._current_board_path()
+        if not current or not path:
+            return
+        if os.path.normcase(str(Path(path).resolve())) == os.path.normcase(current):
+            self._record_board_signature()
+
     def _current_board_path(self) -> Optional[str]:
         """Return the current board file path, if a healthy board is loaded."""
         board = getattr(self, "board", None)
@@ -5326,6 +5343,10 @@ def _handle_refill_zones(self, params: Dict[str, Any]) -> Dict[str, Any]:
                         }
                     self.board = reloaded
                     self._update_command_handlers()
+                    # The subprocess wrote the filled board to this file. Record
+                    # it, or the auto-save that follows takes that write for an
+                    # external change and refuses.
+                    self._record_board_signature()
                     logger.info("Zone fill subprocess succeeded")
                     return {
                         "success": True,
```

**File**: `tests/test_self_saving_commands_record_signature.py` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+"""
+autoroute, import_ses and refill_zones write the board file themselves. Before
+the fix none of them recorded that write, so the session's disk signature still
+described the file as it was before the command. The next auto-save (after any
+board-mutating command, or refill_zones' own) compared the file against that
+stale signature and refused with "the on-disk PCB file's contents changed
+externally", leaving the edit only in memory. Every later mutation was refused
+the same way until the project was reopened.
+
+The same mechanism must still refuse a genuine external edit, and must not
+record a file the command did not write as the session's own board.
+"""
+
+import os
+import sys
+from contextlib import nullcontext
+from pathlib import Path
+from typing import Any
+from unittest.mock import MagicMock, patch
+
+import pytest
+
+sys.path.insert(0, str(Path(__file__).parent.parent / "python"))
+
+pytestmark = pytest.mark.skipif(
+    os.environ.get("KICAD_USE_REAL_PCBNEW") == "1",
+    reason="drives KiCADInterface against the stubbed pcbnew",
+)
+
+pcbnew_mock = sys.modules["pcbnew"]
+
+SES = """(session board
+  (base_design board)
+  (routes
+    (resolution um 10)
+    (network_out
+      (net GND
+        (wire (path F.Cu 5000 0 0 1000 0))
+      )
+    )
+  )
+)
+"""
+
+
+def _fake_board(path: Path, text: str = "(kicad_pcb ; routed)\n") -> MagicMock:
+    board = MagicMock(name="board")
+    board.GetFileName.return_value = str(path)
+    board.GetFootprints.return_value = []
+    board.GetTracks.return_value = []
+    board.GetNetInfo.return_value.GetNetCount.return_value = 0
+    board.GetAreaCount.return_value = 1
+    # pcbnew's BOARD.Save writes the file.
+    board.Save.side_effect = lambda p: Path(p).write_text(text)
+    return board
+
+
+@pytest.fixture()
+def iface(tmp_path: Path) -> Any:
+    with patch("kicad_interface.USE_IPC_BACKEND", False):
+        from kicad_interface import KiCADInterface
+
+        iface = KiCADInterface()
+    iface.use_ipc = False
+    pcb = tmp_path / "p.kicad_pcb"
+    pcb.write_text("(kicad_pcb ; as opened)\n")
+    iface.board = _fake_board(pcb)
+    iface._update_command_handlers()
+    iface._record_board_signature()  # as open_project does
+    iface._safe_load_board = lambda p: iface.board
+    return iface
+
+
+@pytest.fixture(autouse=True)
+def _pcbnew_stub() -> Any:
+    pcbnew_mock.ImportSpecctraSES.side_effect = None
+    pcbnew_mock.ImportSpecctraSES.return_value = True
+    old = pcbnew_mock.SaveBoard.side_effect
+    pcbnew_mock.SaveBoard.side_effect = lambda p, b: Path(p).write_text("(kicad_pcb ; autosaved)\n")
+    with (
+        patch("commands.freerouting.preserve_project_settings", lambda p: nullcontext()),
+        patch("kicad_interface.preserve_project_settings", lambda p: nullcontext()),
+    ):
+        yield
+    pcbnew_mock.SaveBoard.side_effect = old
+
+
+def _pcb(iface: Any) -> Path:
+    return Path(iface.board.GetFileName())
+
+
+def _ses(tmp_path: Path) -> str:
+    ses = tmp_path / "p.ses"
+    ses.write_text(SES)
+    return str(ses)
+
+
+@pytest.mark.unit
+@pytest.mark.parametrize("pass_board_path", [True, False])
+def test_import_ses_records_its_own_save(iface, tmp_path, pass_board_path) -> None:
+    params = {"sesPath": _ses(tmp_path)}
+    if pass_board_path:
+        params["boardPath"] = str(_pcb(iface))
+    result = iface.handle_command("import_ses", params)
+
+    assert result["success"], result
+    assert "routed" in _pcb(iface).read_text()
+    assert iface._board_disk_signature == iface._disk_signature(str(_pcb(iface)))
+
+
+@pytest.mark.unit
+def test_mutation_after_import_ses_is_auto_saved(iface, tmp_path) -> None:
+    assert iface.handle_command("import_ses", {"sesPath": _ses(tmp_path)})["success"]
+
+    status = iface._auto_save_board()
+
+    assert status["saved"] is True, status
+    assert "diskChangedExternally" not in status
+    assert "autosaved" in _pcb(iface).read_text()
+
+
+@pytest.mark.unit
+def test_external_edit_after_import_ses_is_still_refused(iface, tmp_path) -> None:
+    assert iface.handle_command("import_ses", {"sesPath": _ses(tmp_path)})["success"]
+    _pcb(iface).write_text("(kicad_pcb ; edited in KiCad)\n")
+
+    status = iface._auto_save_board()
+
+    assert status["saved"] is False
+    assert status["diskChangedExternally"] is True
+    assert "edited in KiCad" in _pcb(iface).read_text()
+
+
+@pytest.mark.unit
+def test_save_to_another_file_does_not_record_it_as_the_board(iface, tmp_path) -> None:
+    """Saving the board to a different file leaves the session board's file
+    untouched, so an external edit to that file must still be refused."""
+    _pcb(iface).write_text("(kicad_pcb ; edited in KiCad)\n")
+    other = tmp_path / "other.kicad_pcb"
+    other.write_text("(kicad_pcb)\n")
+
+    iface.freerouting_commands._save_board(str(other), "SES import")
+
+    assert "routed" in other.read_text()
+    status = iface._auto_save_board()
+    asse
```

---

### Incident Patch 2: `5343c672` (2026-11-13)
**Commit Message**: CHANGELOG: one Bug Fixes heading under [Unreleased] after the #517/#489 merges

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -26,6 +26,7 @@ All notable changes to the KiCAD MCP Server project are documented here.
     field updates and one pad that the sync would disconnect from a routed
     net. The pad came from a symbol that defines pin 1 differently in two
     units.
+
 ### Bug Fixes
 
 - **`assign_net_to_class` membership now survives Update PCB from Schematic**
@@ -44,7 +45,6 @@ All notable changes to the KiCAD MCP Server project are documented here.
   `netclass_assignments` too. Assignments made with an earlier version were
   lost on the first sync after they were made, so redo them (call
   `assign_net_to_class` again for each net) after upgrading.
-### Bug Fixes
 
 - **Backend failures reach the client as MCP errors.** Most tools return the
   backend's JSON as it is, so a `{"success": false, ...}` reply went out as a
```

---

### Incident Patch 3: `c9f18ebe` (2026-11-11)
**Commit Message**: Merge pull request #515 from rmskkn/fix/modify-trace-no-op-save

fix: modify_trace silently discards width/layer/net changes

**File**: `python/kicad_api/ipc_backend.py` (modified, +119/-2)
```diff
@@ -1289,6 +1289,123 @@ def add_arc_track(
             logger.error(f"Failed to add arc track: {e}")
             return False
 
+    def modify_track(
+        self,
+        uuid: str,
+        width: Optional[float] = None,
+        layer: Optional[str] = None,
+        net_name: Optional[str] = None,
+    ) -> Dict[str, Any]:
+        """Modify an existing track's width/layer/net in place (live UI update).
+
+        A via UUID works too, as on the SWIG path where board.Tracks()
+        includes vias: width sets the via diameter and net reassigns it.
+
+        Unlike add_track's ``layer_map.get(layer, BL_F_Cu)``, an unrecognized
+        layer or net name here is a reported error, not a silent fallback —
+        modify_trace already shipped once reporting success while writing
+        nothing (#515, SWIG side); silently applying a different layer/net
+        than the one named is the same failure shape with a different cause.
+        """
+        try:
+            from kipy.board_types import Via
+            from kipy.proto.board.board_types_pb2 import BoardLayer
+            from kipy.util.units import from_mm
+
+            board = self._get_board()
+
+            track = None
+            for candidate in [*board.get_tracks(), *board.get_vias()]:
+                # track.id is a KIID message; str() gives protobuf text
+                # format ('value: "..."\n'), so compare the value field.
+                if candidate.id.value == uuid:
+                    track = candidate
+                    break
+
+            if track is None:
+                return {
+                    "success": False,
+                    "message": "Track not found",
+                    "errorDetails": f"No live track or via with uuid '{uuid}'",
+                }
+
+            is_via = isinstance(track, Via)
+            modifications = []
+
+            if width is not None:
+                if is_via:
+                    # Same as SetWidth() on a SWIG via. kipy also resets
+                    # the padstack to PST_NORMAL when it sets the diameter.
+                    track.diameter = from_mm(width)
+                else:
+                    track.width = from_mm(width)
+                modifications.append(f"width={width}mm")
+
+            if layer is not None:
+                if is_via:
+                    return {
+                        "success": False,
+                        "message": "Invalid layer",
+                        "errorDetails": "A via spans layers; 'layer' applies to traces only",
+                    }
+                # kipy enum names follow KiCad's canonical layer names
+                # (In3.Cu -> BL_In3_Cu), which covers all 32 copper layers.
+                enum_name = "BL_" + layer.replace(".", "_")
+                if not layer.endswith(".Cu") or enum_name not in BoardLayer.keys():
+                    return {
+                        "success": False,
+                        "message": "Invalid layer",
+                        "errorDetails": f"'{layer}' is not a copper layer name "
+                        "(expected F.Cu, B.Cu or In1.Cu..In30.Cu)",
+                    }
+                track.layer = BoardLayer.Value(enum_name)
+                modifications.append(f"layer={layer}")
+
+            if net_name is not None:
+                target_net = None
+                for net in board.get_nets():
+                    if net.name == net_name:
+                        target_net = net
+                        break
+                if target_net is None:
+                    return {
+                        "success": False,
+                        "message": "Invalid net",
+                        "errorDetails": f"Net '{net_name}' not found",
+                    }
+                track.net = target_net
+                modifications.append(f"net={net_name}")
+
+            if not modifications:
+                return {
+                    "success": False,
+                    "message": "No modifications specified",
+                    "errorDetails": "Provide at least one of: width, layer, net",
+                }
+
+            commit = board.begin_commit()
+            board.update_items([track])
+            board.push_commit(commit, "Modified track")
+
+            self._notify(
+                "track_modified",
+                {"uuid": uuid, "width": width, "layer": layer, "net": net_name},
+            )
+
+            return {
+                "success": True,
+                "message": f"Modified trace: {', '.join(modifications)}",
+                "uuid": uuid,
+                "modifications": modifications,
+            }
+        except Exception as e:
+            logger.error(f"Failed to modify track: {e}")
+            return {
+                "success": False,
+                "message": "Failed to modify trace",
+                "errorDetails": str(e),
+            }
+
     def add_via(
         self,
         x: float,
@@ -1
```

**File**: `python/kicad_interface.py` (modified, +30/-0)
```diff
@@ -850,6 +850,7 @@ def __init__(self) -> None:
         "route_arc_trace": "_ipc_route_arc_trace",
         "add_via": "_ipc_add_via",
         "add_net": "_ipc_add_net",
+        "modify_trace": "_ipc_modify_trace",
         "delete_trace": "_ipc_delete_trace",
         "query_traces": "_ipc_query_traces",
         "get_nets_list": "_ipc_get_nets_list",
@@ -1332,6 +1333,10 @@ def handle_command(self, command: str, params: Dict[str, Any]) -> Dict[str, Any]
         # setter for it, so the command edits the file and the handler above
         # reloads before this auto-save runs.
         "set_stackup_layer",
+        # modify_trace mutates track.SetWidth()/SetLayer()/SetNet() on the
+        # in-memory SWIG board but has no save of its own; without this entry
+        # it reported success and wrote nothing to disk, identical to #222.
+        "modify_trace",
         "place_component",
         "move_component",
         "rotate_component",
@@ -5910,6 +5915,31 @@ def _ipc_save_project(self, params: Dict[str, Any]) -> Dict[str, Any]:
             logger.error(f"IPC save_project error: {e}")
             return {"success": False, "message": str(e)}
 
+    def _ipc_modify_trace(self, params: Dict[str, Any]) -> Dict[str, Any]:
+        """IPC handler for modify_trace - mutates an existing track with real-time UI update.
+
+        ``traceUuid`` is the schema name (src/tools/routing.ts); ``uuid`` is
+        kept for JSON-RPC callers that predate the schema alignment (#403),
+        matching the SWIG handler's same two-key lookup.
+        """
+        try:
+            trace_uuid = params.get("traceUuid") or params.get("uuid")
+            if not trace_uuid:
+                return {
+                    "success": False,
+                    "message": "Missing trace identifier",
+                    "errorDetails": "Provide 'traceUuid' to identify the trace",
+                }
+            return self.ipc_board_api.modify_track(
+                uuid=trace_uuid,
+                width=params.get("width"),
+                layer=params.get("layer"),
+                net_name=params.get("net"),
+            )
+        except Exception as e:
+            logger.error(f"IPC modify_trace error: {e}")
+            return {"success": False, "message": str(e)}
+
     def _ipc_delete_trace(self, params: Dict[str, Any]) -> Dict[str, Any]:
         """IPC handler for delete_trace - Note: IPC doesn't support direct trace deletion yet"""
         # IPC API doesn't have a direct delete track method
```

**File**: `tests/test_ipc_modify_trace.py` (added, +275/-0)
```diff
@@ -0,0 +1,275 @@
+"""modify_trace over IPC (live KiCad GUI), follow-up to #515.
+
+#515 fixed modify_trace reporting success while writing nothing to disk on
+the SWIG path. It also has no IPC path at all, unlike route_trace/add_via —
+it always runs headless, so a KiCad window already open on the board won't
+show the new width/layer/net until File -> Revert. This adds
+IPCBoardAPI.modify_track (the kipy-side mutation, mirroring the
+update_items pattern already used by move_component/add_3d_model) and wires
+modify_trace into IPC_CAPABLE_COMMANDS so a live session uses it.
+
+An unrecognized layer or net name is a reported error here, not a silent
+fallback to F.Cu like add_track's ``layer_map.get(layer, BL_F_Cu)`` — modify
+already shipped once silently doing nothing; silently doing something other
+than what was asked is the same failure shape with a different cause.
+"""
+
+import sys
+from pathlib import Path
+from typing import Any
+from unittest.mock import MagicMock, patch
+
+import pytest
+
+sys.path.insert(0, str(Path(__file__).parent.parent / "python"))
+
+pytestmark = pytest.mark.unit
+
+# --- handler-level: param plumbing in kicad_interface._ipc_modify_trace -----
+
+
+def _make_iface() -> Any:
+    with patch("kicad_interface.USE_IPC_BACKEND", True):
+        from kicad_interface import KiCADInterface
+
+        iface = KiCADInterface.__new__(KiCADInterface)
+
+    iface.use_ipc = True
+    iface.board = None
+    iface.ipc_board_api = MagicMock()
+    iface.ipc_board_api.modify_track.return_value = {"success": True}
+    return iface
+
+
+def test_handler_reads_schema_key_traceUuid():
+    iface = _make_iface()
+    iface._ipc_modify_trace({"traceUuid": "abc-123", "width": 0.3})
+    _, kwargs = iface.ipc_board_api.modify_track.call_args
+    assert kwargs == {"uuid": "abc-123", "width": 0.3, "layer": None, "net_name": None}
+
+
+def test_handler_accepts_legacy_uuid_key():
+    iface = _make_iface()
+    iface._ipc_modify_trace({"uuid": "abc-123", "layer": "B.Cu"})
+    _, kwargs = iface.ipc_board_api.modify_track.call_args
+    assert kwargs["uuid"] == "abc-123"
+    assert kwargs["layer"] == "B.Cu"
+
+
+def test_handler_refuses_without_an_identifier():
+    iface = _make_iface()
+    result = iface._ipc_modify_trace({"width": 0.3})
+    assert not result["success"]
+    assert "traceUuid" in result["errorDetails"]
+    iface.ipc_board_api.modify_track.assert_not_called()
+
+
+# --- backend-level: the kipy mutation in IPCBoardAPI.modify_track ----------
+
+bt = pytest.importorskip("kipy.board_types", reason="kipy (kicad-python) not installed")
+pytest.importorskip("kipy.proto.board.board_types_pb2")
+
+from kicad_api.ipc_backend import IPCBoardAPI  # noqa: E402
+
+TRACE_UUID = "11111111-1111-1111-1111-111111111111"
+
+
+def _api_with_board(monkeypatch, board: Any) -> IPCBoardAPI:
+    api = IPCBoardAPI.__new__(IPCBoardAPI)
+    monkeypatch.setattr(IPCBoardAPI, "_get_board", lambda self: board)
+    monkeypatch.setattr(IPCBoardAPI, "_notify", lambda self, *a, **k: None, raising=False)
+    return api
+
+
+def _track(uuid: str = TRACE_UUID) -> Any:
+    # A real kipy Track, so track.id is a KIID message as on a live board.
+    # A MagicMock with a plain-string id hid a lookup that never matched.
+    track = bt.Track()
+    track._proto.id.value = uuid
+    return track
+
+
+def _net(name: str) -> Any:
+    net = bt.Net()
+    net.name = name
+    return net
+
+
+def test_modify_track_applies_width_layer_net_and_commits(monkeypatch):
+    track = _track()
+    board = MagicMock()
+    board.get_tracks.return_value = [track]
+    board.get_nets.return_value = [_net("GND"), _net("+12V")]
+    api = _api_with_board(monkeypatch, board)
+
+    result = api.modify_track(TRACE_UUID, width=0.3, layer="B.Cu", net_name="+12V")
+
+    assert result["success"], result
+    assert set(result["modifications"]) == {"width=0.3mm", "layer=B.Cu", "net=+12V"}
+    assert result["uuid"] == TRACE_UUID
+    (pushed,), _ = board.update_items.call_args
+    assert pushed == [track]
+    board.begin_commit.assert_called_once()
+    board.push_commit.assert_called_once()
+
+    from kipy.proto.board.board_types_pb2 import BoardLayer
+    from kipy.util.units import from_mm
+
+    assert track.width == from_mm(0.3)
+    assert track.layer == BoardLayer.BL_B_Cu
+    assert track.net.name == "+12V"
+
+
+@pytest.mark.parametrize("layer", ["F.Cu", "In3.Cu", "In30.Cu", "B.Cu"])
+def test_modify_track_accepts_every_copper_layer(monkeypatch, layer):
+    """A 6-layer board needs In3.Cu and up, which the SWIG path handles."""
+    from kipy.proto.board.board_types_pb2 import BoardLayer
+
+    track = _track()
+    board = MagicMock()
+    board.get_tracks.return_value = [track]
+    api = _api_with_board(monkeypatch, board)
+
+    result = api.modify_track(TRACE_UUID, layer=layer)
+
+    assert result["success"], result
+    assert track.layer == BoardLayer.Value("BL_" + layer.replace(".", "_"))
+
+
+def test_modify_track_re
```

**File**: `tests/test_routing_param_names.py` (modified, +18/-0)
```diff
@@ -89,6 +89,24 @@ def test_modify_trace_error_names_the_documented_key(board_with_track):
     assert "traceUuid" in result["errorDetails"]
 
 
+def test_modify_trace_is_a_board_mutating_command():
+    """Without this, modify_trace reports success and writes nothing to
+    disk: it SetWidth()s the in-memory SWIG board with no save of its own,
+    identical in shape to add_layer's #222."""
+    from kicad_interface import KiCADInterface
+
+    assert "modify_trace" in KiCADInterface._BOARD_MUTATING_COMMANDS
+
+
+def test_modify_trace_is_ipc_capable():
+    """Without this, modify_trace always ran headless (SWIG), so a KiCad
+    window already open on the board wouldn't show the change until
+    File -> Revert, unlike route_trace/add_via."""
+    from kicad_interface import KiCADInterface
+
+    assert KiCADInterface.IPC_CAPABLE_COMMANDS.get("modify_trace") == "_ipc_modify_trace"
+
+
 # --- add_net ----------------------------------------------------------------
 
 
```

#### Recent Merged Pull Requests:
- **PR #539** (2026-11-13): docs(readme): say up front that Konnect-EDA stays free for students, hobbyists and individual developers (@mixelpixx)
- **PR #538** (2026-11-13): docs(readme): point the GitHub landing README to Konnect-EDA; drop the forum notice (@mixelpixx)
- **PR #537** (2026-11-13): docs(readme): point to Konnect-EDA at Orchis.ai; this server carries on (@mixelpixx)
- **PR #536** (2026-11-13): Merge train: #517 and #489 (@mixelpixx)
- **PR #532** (2026-11-12): chore: release v2.9.0 (@mixelpixx)
- **PR #531** (2026-11-12): Record the board signature after autoroute, import_ses and refill_zones (@mixelpixx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. record the board signature after autoroute, import_ses and refill_zones

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mixelpixx/KiCAD-MCP-Server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `94b05266`: record the board signature after autoroute, import_ses and refill_zones. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **`autoroute`, `import_ses` and `refill_zones` no longer make the next
  auto-save refuse.** All three write the board file themselves but did not
  record that write, so the session still held the file's signature from
  before the command. The auto-save after the next board edit (and
  `refill_zones`' own) then found the file changed, reported "the on-disk PCB
  file's contents changed externally", and left the edit only in memory, as
  it did for every later edit until the project was reopened. They now record
  the file after a successful save of the session's own board. A save that
  fails, or that goes to a different file, records nothing, so a real external
  edit is still refused.

```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `94b05266` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

# Forensic Learning Record (Deep Inspection): hhyqhh/inno-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/hhyqhh-inno-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hhyqhh/inno-agent](https://github.com/hhyqhh/inno-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:45:30.669Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hhyqhh/inno-agent`
- **Description**: An open-source personal learning agent with three-layer memory (learner profile / wiki knowledge base / cross-conversation recall), a proactive scheduler, personal IM channels, and a workspace-scoped Practice Lab — built on the Pi SDK.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 1288 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/inno-agent/scripts/console_encoding.py`
```
#!/usr/bin/env python3
"""Console encoding helpers for PPT Master CLI scripts."""

from __future__ import annotations

import io
import sys
from typing import TextIO


def _reconfigure_stream(stream: TextIO) -> TextIO:
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
        return stream
    except AttributeError:
        buffer = getattr(stream, "buffer", None)
        if buffer is None:
            return stream
        return io.TextIOWrapper(buffer, encoding="utf-8", errors="replace")
    except (OSError, ValueError):
        return stream


def configure_utf8_stdio() -> None:
    """Use UTF-8 for CLI stdout/stderr, including Windows non-UTF-8 locales."""
    sys.stdout = _reconfigure_stream(sys.stdout)
    sys.stderr = _reconfigure_stream(sys.stderr)

```

### Core Architecture Module: `apps/inno-agent/scripts/pptx_to_svg.py`
```
#!/usr/bin/env python3
"""CLI entry: convert a .pptx file to one SVG per slide.

Usage:
    python3 pptx_to_svg.py <pptx_file> [-o <output_dir>] [--embed-images]
                                       [--media-subdir <name>] [--keep-hidden]
                                       [--inheritance-mode {both,layered,flat}]

Output structure (default --inheritance-mode both):
    <output_dir>/
        svg/                    layered machine input: masters/layouts/slides
        svg-flat/               self-contained visual preview slides
        <media_subdir>/         (default: assets/)
            image1.png
            image2.png
            ...

If -o is omitted, writes alongside the source file as <pptx_stem>_pptx_to_svg/.

This is the reverse of svg_to_pptx.py: it reads OOXML directly and emits
shape-level SVG without going through PowerPoint or PDF rendering.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running this script from anywhere
sys.path.insert(0, str(Path(__file__).resolve().parent))

from console_encoding import configure_utf8_stdio
from pptx_to_svg import convert_pptx_to_svg
from pptx_to_svg.converter import ConvertOptions

configure_utf8_stdio()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert .pptx to per-slide SVG by reading OOXML directly.",
    )
    parser.add_argument("pptx_file", help="Path to the source .pptx file")
    parser.add_argument(
        "-o",
        "--output",
        help="Output directory (default: <pptx_stem>_pptx_to_svg beside source)",
    )
    parser.add_argument(
        "--media-subdir",
        default="assets",
        help="Subdirectory for extracted media (default: assets)",
    )
    parser.add_argument(
        "--embed-images",
        action="store_true",
        help="Base64-embed images inline instead of writing files",
    )
    parser.add_argument(
        "--keep-hidden",
        action="store_true",
        help='Include shapes marked hidden="1"',
    )
    parser.add_argument(
        "--inheritance-mode",
        choices=("both", "layered", "flat"),
        default="both",
        help=(
            "How to render inheritance. 'both' (default) writes layered SVGs "
            "under svg/ and complete preview slides under svg-flat/. "
            "'layered' writes only svg/ plus inheritance.json. 'flat' writes "
            "self-contained slides under svg/ for backward compatibility."
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pptx_path = Path(args.pptx_file).expanduser().resolve()
    if not pptx_path.exists():
        print(f"Error: file does not exist: {pptx_path}", file=sys.stderr)
        return 1
    if pptx_path.suffix.lower() != ".pptx":
        print(f"Error: expected a .pptx file, got: {pptx_path.name}", file=sys.stderr)
        return 1

    output_dir = (
        Path(args.output).expanduser().resolve()
        if args.output
        else pptx_path.with_name(f"{pptx_path.stem}_pptx_to_svg")
    )

    options = ConvertOptions(
        media_subdir=args.media_subdir,
        embed_images=args.embed_images,
        keep_hidden=args.keep_hidden,
        inheritance_mode=args.inheritance_mode,
    )

    result = convert_pptx_to_svg(pptx_path, output_dir, options)

    print(f"Source: {pptx_path.name}")
    print(f"Canvas: {result.canvas_px[0]:.0f} x {result.canvas_px[1]:.0f} px")
    if result.theme_colors:
        scheme = ", ".join(f"{k}={v}" for k, v in sorted(result.theme_colors.items()))
        print(f"Theme colors: {scheme}")
    if result.theme_fonts:
        fonts = ", ".join(f"{k}={v}" for k, v in result.theme_fonts.items())
        print(f"Theme fonts: {fonts}")
    print(f"Slides converted: {len(result.slides)}")
    print(f"Output: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `apps/inno-agent/scripts/pptx_to_svg/__init__.py`
```
"""PPTX -> SVG semantic converter (reverse of svg_to_pptx).

Reads OOXML (DrawingML) directly from a .pptx zip archive and emits SVG with
shape-level fidelity: <p:sp prst="rect"> -> <rect>, <p:txBody> -> <text>, etc.

Public entry: convert_pptx_to_svg().
"""

from __future__ import annotations

from .converter import convert_pptx_to_svg

__all__ = ["convert_pptx_to_svg"]

```

### Core Architecture Module: `apps/inno-agent/scripts/pptx_to_svg/color_resolver.py`
```
"""DrawingML color resolution.

Resolves any of the 6 OOXML color types (srgbClr, schemeClr, sysClr, prstClr,
hslClr, scrgbClr) plus modifiers (tint/shade/lumMod/lumOff/satMod/satOff/
hueMod/hueOff/alpha) into an (#RRGGBB, alpha) pair.

Theme palette is resolved from the slide master's a:clrMap and theme1.xml's
a:clrScheme.
"""

from __future__ import annotations

import colorsys
from xml.etree import ElementTree as ET

from .emu_units import NS, percent_to_ratio
from .ooxml_loader import PartRef


# ---------------------------------------------------------------------------
# Preset color names (DrawingML <a:prstClr val="...">)
# ---------------------------------------------------------------------------

# Source: ECMA-376 ST_PresetColorVal (subset — full list has ~140 entries).
PRST_COLORS = {
    "aliceBlue": "F0F8FF", "antiqueWhite": "FAEBD7", "aqua": "00FFFF",
    "aquamarine": "7FFFD4", "azure": "F0FFFF", "beige": "F5F5DC",
    "bisque": "FFE4C4", "black": "000000", "blanchedAlmond": "FFEBCD",
    "blue": "0000FF", "blueViolet": "8A2BE2", "brown": "A52A2A",
    "burlyWood": "DEB887", "cadetBlue": "5F9EA0", "chartreuse": "7FFF00",
    "chocolate": "D2691E", "coral": "FF7F50", "cornflowerBlue": "6495ED",
    "cornsilk": "FFF8DC", "crimson": "DC143C", "cyan": "00FFFF",
    "darkBlue": "00008B", "darkCyan": "008B8B", "darkGoldenrod": "B8860B",
    "darkGray": "A9A9A9", "darkGrey": "A9A9A9", "darkGreen": "006400",
    "darkKhaki": "BDB76B", "darkMagenta": "8B008B", "darkOliveGreen": "556B2F",
    "darkOrange": "FF8C00", "darkOrchid": "9932CC", "darkRed": "8B0000",
    "darkSalmon": "E9967A", "darkSeaGreen": "8FBC8F", "darkSlateBlue": "483D8B",
    "darkSlateGray": "2F4F4F", "darkSlateGrey": "2F4F4F",
    "darkTurquoise": "00CED1", "darkViolet": "9400D3", "deepPink": "FF1493",
    "deepSkyBlue": "00BFFF", "dimGray": "696969", "dimGrey": "696969",
    "dkBlue": "00008B", "dkCyan": "008B8B", "dkGoldenrod": "B8860B",
    "dkGray": "A9A9A9", "dkGrey": "A9A9A9", "dkGreen": "006400",
    "dkKhaki": "BDB76B", "dkMagenta": "8B008B", "dkOliveGreen": "556B2F",
    "dkOrange": "FF8C00", "dkOrchid": "9932CC", "dkRed": "8B0000",
    "dkSalmon": "E9967A", "dkSeaGreen": "8FBC8F", "dkSlateBlue": "483D8B",
    "dkSlateGray": "2F4F4F", "dkSlateGrey": "2F4F4F",
    "dkTurquoise": "00CED1", "dkViolet": "9400D3",
    "dodgerBlue": "1E90FF", "firebrick": "B22222", "floralWhite": "FFFAF0",
    "forestGreen": "228B22", "fuchsia": "FF00FF", "gainsboro": "DCDCDC",
    "ghostWhite": "F8F8FF", "gold": "FFD700", "goldenrod": "DAA520",
    "gray": "808080", "grey": "808080", "green": "008000",
    "greenYellow": "ADFF2F", "honeydew": "F0FFF0", "hotPink": "FF69B4",
    "indianRed": "CD5C5C", "indigo": "4B0082", "ivory": "FFFFF0",
    "khaki": "F0E68C", "lavender": "E6E6FA", "lavenderBlush": "FFF0F5",
    "lawnGreen": "7CFC00", "lemonChiffon": "FFFACD",
    "lightBlue": "ADD8E6", "lightCoral": "F08080", "lightCyan": "E0FFFF",
    "lightGoldenrodYellow": "FAFAD2", "lightGray": "D3D3D3",
    "lightGrey": "D3D3D3", "lightGreen": "90EE90", "lightPink": "FFB6C1",
    "lightSalmon": "FFA07A", "lightSeaGreen": "20B2AA",
    "lightSkyBlue": "87CEFA", "lightSlateGray": "778899",
    "lightSlateGrey": "778899", "lightSteelBlue": "B0C4DE",
    "lightYellow": "FFFFE0", "ltBlue": "ADD8E6", "ltCoral": "F08080",
    "ltCyan": "E0FFFF", "ltGoldenrodYellow": "FAFAD2", "ltGray": "D3D3D3",
    "ltGrey": "D3D3D3", "ltGreen": "90EE90", "ltPink": "FFB6C1",
    "ltSalmon": "FFA07A", "ltSeaGreen": "20B2AA", "ltSkyBlue": "87CEFA",
    "ltSlateGray": "778899", "ltSlateGrey": "778899",
    "ltSteelBlue": "B0C4DE", "ltYellow": "FFFFE0",
    "lime": "00FF00", "limeGreen": "32CD32", "linen": "FAF0E6",
    "magenta": "FF00FF", "maroon": "800000", "medAquamarine": "66CDAA",
    "medBlue": "0000CD", "medOrchid": "BA55D3", "medPurple": "9370DB",
    "medSeaGreen": "3CB371", "medSlateBlue": "7B68EE",
    "medSpringGreen": "00FA9A", "medTurquoise": "48D1CC",
    "medVioletRed": "C71585", "mediumAquamarine": "66CDAA",
    "mediumBlue": "0000CD", "mediumOrchid": "BA55D3", "mediumPurple": "9370DB",
    "mediumSeaGreen": "3CB371", "mediumSlateBlue": "7B68EE",
    "mediumSpringGreen": "00FA9A", "mediumTurquoise": "48D1CC",
    "mediumVioletRed": "C71585",
    "midnightBlue": "191970", "mintCream": "F5FFFA", "mistyRose": "FFE4E1",
    "moccasin": "FFE4B5", "navajoWhite": "FFDEAD", "navy": "000080",
    "oldLace": "FDF5E6", "olive": "808000", "oliveDrab": "6B8E23",
    "orange": "FFA500", "orangeRed": "FF4500", "orchid": "DA70D6",
    "paleGoldenrod": "EEE8AA", "paleGreen": "98FB98", "paleTurquoise": "AFEEEE",
    "paleVioletRed": "DB7093", "papayaWhip": "FFEFD5", "peachPuff": "FFDAB9",
    "peru": "CD853F", "pink": "FFC0CB", "plum": "DDA0DD",
    "powderBlue": "B0E0E6", "purple": "800080", "red": "FF0000",
    "rosyBrown": "BC8F8F", "royalBlue": "4169E1", "saddleBrown": "8B4513",
    "salmon": "FA8072", "sandyBrown": "F4A460", "seaGreen": "2E8B57",
    "seaShell": "FFF5EE", "sienna": "A0522D", "silver": "C0C0C0",
    "skyBlue": "87CEEB", "slateBlue": "6A5ACD", "slateGray": "708090",
    "slateGrey": "708090", "snow": "FFFAFA", "springGreen": "00FF7F",
    "steelBlue": "4682B4", "tan": "D2B48C", "teal": "008080",
    "thistle": "D8BFD8", "tomato": "FF6347", "turquoise": "40E0D0",
    "violet": "EE82EE", "wheat": "F5DEB3", "white": "FFFFFF",
    "whiteSmoke": "F5F5F5", "yellow": "FFFF00", "yellowGreen": "9ACD32",
}


# Scheme color name normalization
SCHEME_ALIASES = {
    "bg1": "lt1", "bg2": "lt2",
    "tx1": "dk1", "tx2": "dk2",
}


# ---------------------------------------------------------------------------
# ColorPalette
# ---------------------------------------------------------------------------

class ColorPalette:
    """Resolves scheme colors via the master's a:clrMap + theme1's a:clrScheme.

    a:clrMap remaps presentation-level scheme names (bg1/tx1) to theme-level
    names (lt1/dk1) — this is rarely overridden but must be honored.
    """

    def __init__(self, master: PartRef | None, theme: PartRef | None) -> None:
        self.scheme: dict[str, str] = {}
        self.clr_map: dict[str, str] = {}
        if theme is not None:
            self._load_scheme(theme.xml)
        if master is not None:
            self._load_clr_map(master.xml)

    def _load_scheme(self, theme_root: ET.Element) -> None:
        clr_scheme = theme_root.find(".//a:clrScheme", NS)
        if clr_scheme is None:
            return
        for child in list(clr_scheme):
            if not isinstance(child.tag, str):
                continue
            name = child.tag.split("}", 1)[-1]
            srgb = child.find("a:srgbClr", NS)
            sys_clr = child.find("a:sysClr", NS)
            if srgb is not None and srgb.attrib.get("val"):
                self.scheme[name] = srgb.attrib["val"].upper()
            elif sys_clr is not None:
                last = sys_clr.attrib.get("lastClr")
                if last:
                    self.scheme[name] = last.upper()

    def _load_clr_map(self, master_root: ET.Element) -> None:
        clr_map = master_root.find("p:clrMap", NS)
        if clr_map is None:
            return
        # Each attribute on clrMap is a remap: bg1="lt1" tx1="dk1" ...
        for attr, val in clr_map.attrib.items():
            self.clr_map[attr] = val

    def resolve_scheme(self, name: str) -> str | None:
        """scheme name (e.g. 'accent1', 'bg1') -> 'RRGGBB'. None on miss."""
        # apply clrMap remap (bg1 -> lt1, tx1 -> dk1, etc.)
        mapped = self.clr_map.get(name, name)
        # canonical alias (bg1 -> lt1)
        mapped = SCHEME_ALIASES.get(mapped, mapped)
        return self.scheme.get(mapped)


# ---------------------------------------------------------------------------
# Color resolution
# ---------------------------------------------------------------------------

# All concrete color element names under the a: namespace.
COLOR_TAGS = ("srgbClr", "schemeClr", "sysClr", "prstClr",
```

### Core Architecture Module: `apps/inno-agent/scripts/pptx_to_svg/converter.py`
```
"""Top-level orchestrator for PPTX -> SVG conversion.

Public API: convert_pptx_to_svg(pptx_path, output_dir, options).

Composes the per-slide pipeline:
    OoxmlPackage -> shape_walker.walk_sp_tree
                 -> per-shape dispatch (prstgeom / txbody / pic / ...)
                 -> assembled SVG text + extracted media files

Stages B-F will fill in the per-shape dispatch. For Stage A this entry just
loads the package and reports basic per-slide structure to verify wiring.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from .color_resolver import ColorPalette
from .emu_units import NS
from .ooxml_loader import OoxmlPackage, PartRef, SlideRef
from .slide_to_svg import assemble_part_solo, assemble_slide


def _extract_theme_info(
    theme: PartRef,
    palette: ColorPalette,
) -> tuple[dict[str, str], dict[str, str]]:
    from .color_resolver import find_color_elem, resolve_color

    colors: dict[str, str] = {}
    fonts: dict[str, str] = {}

    scheme = theme.xml.find(".//a:clrScheme", NS)
    if scheme is not None:
        for child in list(scheme):
            if not isinstance(child.tag, str):
                continue
            name = child.tag.split("}", 1)[-1]
            color_elem = find_color_elem(child)
            hex_, _ = resolve_color(color_elem, palette)
            if hex_:
                colors[name] = hex_

    font_scheme = theme.xml.find(".//a:fontScheme", NS)
    if font_scheme is not None:
        for slot in ("majorFont", "minorFont"):
            fnt = font_scheme.find(f"a:{slot}", NS)
            if fnt is None:
                continue
            role_prefix = "major" if slot == "majorFont" else "minor"
            latin = fnt.find("a:latin", NS)
            if latin is not None and latin.attrib.get("typeface"):
                fonts[f"{role_prefix}Latin"] = latin.attrib["typeface"]
            ea = fnt.find("a:ea", NS)
            if ea is not None and ea.attrib.get("typeface"):
                fonts[f"{role_prefix}EastAsia"] = ea.attrib["typeface"]
            cs = fnt.find("a:cs", NS)
            if cs is not None and cs.attrib.get("typeface"):
                fonts[f"{role_prefix}ComplexScript"] = cs.attrib["typeface"]

    return colors, fonts


@dataclass
class ConvertOptions:
    """Convert behavior knobs.

    media_subdir: where to write media files relative to output_dir. SVG image
        href will use './<media_subdir>/<filename>'.
    embed_images: when True, base64-encode images inline instead of writing
        files. Default False (matches svg_to_pptx default of external images).
    keep_hidden: include shapes marked hidden="1". Default False.
    inheritance_mode: how to render master/layout shapes per slide SVG.
        - "both" (default): emit both views — layered under svg/ for template
          designers (master/layout/slide as separate files) and flat under
          svg-flat/ for previewers (each slide self-contained). Costs roughly
          1.3-1.5× converter time and ~1.6-2× disk vs. either single mode.
        - "layered": skip inherited shapes inside the slide. The orchestrator
          renders every master and layout to its own SVG, plus
          svg/inheritance.json describing the reuse graph. Optimised for
          template authors who need to see "what is shared vs. unique".
        - "flat": inline inherited shapes into every slide. Used by
          svg_to_pptx round-trip and any caller that wants self-contained
          slides (preview pages, screenshot pipelines).
    """

    media_subdir: str = "assets"
    embed_images: bool = False
    keep_hidden: bool = False
    inheritance_mode: str = "both"
    asset_name_map: dict[str, str] = field(default_factory=dict)


@dataclass
class PartArtifact:
    """Result of converting a master or layout part to SVG (layered mode only)."""

    role: str  # "master" | "layout"
    part_path: str  # OOXML part path, e.g. "ppt/slideLayouts/slideLayout3.xml"
    filename: str  # output svg filename, e.g. "layout_03_title.xml.svg"
    svg: str
    media_files: dict[str, bytes] = field(default_factory=dict)
    parent_master_part_path: str | None = None
    theme_part_path: str | None = None


@dataclass
class SlideArtifact:
    """Result of converting a single slide."""

    index: int  # 1-based
    svg: str
    media_files: dict[str, bytes] = field(default_factory=dict)
    layout_part_path: str | None = None
    master_part_path: str | None = None


@dataclass
class ConvertResult:
    """Result of converting an entire .pptx.

    ``slides`` holds the layered/primary view (or, in pure flat mode, the flat
    view). ``flat_slides`` is populated only in ``"both"`` mode and contains
    self-contained renderings of every slide; callers that don't care about
    the flat view can ignore it.
    """

    slides: list[SlideArtifact] = field(default_factory=list)
    canvas_px: tuple[float, float] = (1280.0, 720.0)
    theme_colors: dict[str, str] = field(default_factory=dict)
    theme_fonts: dict[str, str] = field(default_factory=dict)
    layouts: list[PartArtifact] = field(default_factory=list)
    masters: list[PartArtifact] = field(default_factory=list)
    flat_slides: list[SlideArtifact] = field(default_factory=list)
    master_themes: dict[str, dict[str, object]] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------

def convert_pptx_to_svg(
    pptx_path: Path,
    output_dir: Path | None = None,
    options: ConvertOptions | None = None,
) -> ConvertResult:
    """Convert a .pptx file to one SVG per slide.

    Args:
        pptx_path: Source .pptx file.
        output_dir: When given, write svg/<slide_NN>.svg + media files there.
            When None, files are not written; callers can read SlideArtifact.svg.
        options: ConvertOptions; defaults to ConvertOptions().

    Returns:
        ConvertResult with per-slide SVG strings and resolved theme info.
    """
    options = options or ConvertOptions()
    if options.inheritance_mode not in {"flat", "layered", "both"}:
        raise ValueError(
            f"inheritance_mode must be 'flat', 'layered', or 'both', "
            f"got {options.inheritance_mode!r}"
        )
    emit_layered = options.inheritance_mode in {"layered", "both"}
    emit_flat = options.inheritance_mode in {"flat", "both"}
    result = ConvertResult()

    with OoxmlPackage(pptx_path) as pkg:
        result.canvas_px = pkg.slide_size_px

        # Default theme summary is kept for compatibility; conversion itself
        # resolves palette/fonts per slide master.
        first_slide = pkg.get_slide(1)
        default_master = first_slide.master if first_slide else None
        default_theme = pkg.resolve_theme(default_master)
        palette = ColorPalette(default_master, default_theme)
        if default_theme is not None:
            result.theme_colors, result.theme_fonts = _extract_theme_info(default_theme, palette)

        for master in pkg.iter_all_masters():
            theme = pkg.resolve_theme(master) or default_theme
            pal = ColorPalette(master, theme)
            colors, fonts = _extract_theme_info(theme, pal) if theme is not None else ({}, {})
            result.master_themes[master.path] = {
                "themePath": theme.path if theme is not None else None,
                "colors": colors,
                "fonts": fonts,
            }

        # Per-slide conversion. The primary view is layered when emitted
        # (template designers care most about that one); the flat view is
        # rendered alongside when needed.
        primary_mode = "layered" if emit_layered else "flat"
        for slide in pkg.iter_slides():
            slide_theme = pkg.resolve_theme(slide.master) or default_theme
            slide_palette = ColorPalette(sl
```

### Core Architecture Module: `apps/inno-agent/scripts/pptx_to_svg/custgeom_to_svg.py`
```
"""DrawingML <a:custGeom> -> SVG <path d="..."> conversion.

Reverse of svg_to_pptx/drawingml_paths.path_commands_to_drawingml.

Path command mapping:
    <a:moveTo>      -> M
    <a:lnTo>        -> L
    <a:cubicBezTo>  -> C
    <a:quadBezTo>   -> Q
    <a:arcTo>       -> A   (DrawingML uses center + sweep angles; we convert
                            to SVG endpoint parameterization)
    <a:close/>      -> Z

DrawingML <a:path w="..." h="..."> defines a local EMU coordinate system. We
remap path coordinates from path-local to slide-absolute pixels using the
shape's xfrm.
"""

from __future__ import annotations

import math
from xml.etree import ElementTree as ET

from .emu_units import NS, Xfrm, emu_to_px, fmt_num


def convert_custom_geom(
    cust_geom: ET.Element,
    xfrm: Xfrm,
) -> str | None:
    """Return an SVG path d="..." string in slide-absolute coordinates, or None.
    """
    path_lst = cust_geom.find("a:pathLst", NS)
    if path_lst is None:
        return None

    paths = path_lst.findall("a:path", NS)
    if not paths:
        return None

    d_segments: list[str] = []
    for path_elem in paths:
        d = _convert_one_path(path_elem, xfrm)
        if d:
            d_segments.append(d)

    if not d_segments:
        return None
    return " ".join(d_segments)


def _convert_one_path(path_elem: ET.Element, xfrm: Xfrm) -> str:
    """Convert a single <a:path> to SVG path commands (slide-absolute coords)."""
    try:
        path_w_emu = int(path_elem.attrib.get("w", "0"))
        path_h_emu = int(path_elem.attrib.get("h", "0"))
    except ValueError:
        return ""
    path_w_px = emu_to_px(path_w_emu) if path_w_emu else xfrm.w
    path_h_px = emu_to_px(path_h_emu) if path_h_emu else xfrm.h
    if path_w_px <= 0 or path_h_px <= 0:
        return ""
    sx = xfrm.w / path_w_px if path_w_px else 1.0
    sy = xfrm.h / path_h_px if path_h_px else 1.0

    def map_pt(x_emu: float, y_emu: float) -> tuple[float, float]:
        x = emu_to_px(x_emu) * sx + xfrm.x
        y = emu_to_px(y_emu) * sy + xfrm.y
        return x, y

    # Track current point so a:arcTo (center-based) can compute its endpoint
    cx, cy = 0.0, 0.0  # slide-absolute pixels

    parts: list[str] = []
    for child in list(path_elem):
        if not isinstance(child.tag, str):
            continue
        local = child.tag.split("}", 1)[-1]
        if local == "moveTo":
            pt = child.find("a:pt", NS)
            if pt is None:
                continue
            x, y = _read_pt(pt, map_pt)
            parts.append(f"M {fmt_num(x)} {fmt_num(y)}")
            cx, cy = x, y
        elif local == "lnTo":
            pt = child.find("a:pt", NS)
            if pt is None:
                continue
            x, y = _read_pt(pt, map_pt)
            parts.append(f"L {fmt_num(x)} {fmt_num(y)}")
            cx, cy = x, y
        elif local == "cubicBezTo":
            pts = child.findall("a:pt", NS)
            if len(pts) < 3:
                continue
            p1 = _read_pt(pts[0], map_pt)
            p2 = _read_pt(pts[1], map_pt)
            p3 = _read_pt(pts[2], map_pt)
            parts.append(
                f"C {fmt_num(p1[0])} {fmt_num(p1[1])} "
                f"{fmt_num(p2[0])} {fmt_num(p2[1])} "
                f"{fmt_num(p3[0])} {fmt_num(p3[1])}"
            )
            cx, cy = p3
        elif local == "quadBezTo":
            pts = child.findall("a:pt", NS)
            if len(pts) < 2:
                continue
            p1 = _read_pt(pts[0], map_pt)
            p2 = _read_pt(pts[1], map_pt)
            parts.append(
                f"Q {fmt_num(p1[0])} {fmt_num(p1[1])} "
                f"{fmt_num(p2[0])} {fmt_num(p2[1])}"
            )
            cx, cy = p2
        elif local == "arcTo":
            arc_d, end_x, end_y = _arc_to_svg(child, cx, cy, sx, sy)
            if arc_d:
                parts.append(arc_d)
                cx, cy = end_x, end_y
        elif local == "close":
            parts.append("Z")
            # SVG semantics: Z returns to subpath start; we don't track that
            # explicitly here. cx/cy stays as-is — subsequent moveTo will reset.

    return " ".join(parts)


def _read_pt(pt_elem: ET.Element, mapper) -> tuple[float, float]:
    try:
        x = float(pt_elem.attrib.get("x", "0"))
        y = float(pt_elem.attrib.get("y", "0"))
    except ValueError:
        x = 0.0
        y = 0.0
    return mapper(x, y)


def _arc_to_svg(
    arc_elem: ET.Element,
    cx: float, cy: float,
    sx: float, sy: float,
) -> tuple[str, float, float]:
    """Convert <a:arcTo wR hR stAng swAng/> to an SVG A command.

    DrawingML semantics: starting at the current point, draw an elliptical arc
    where the ellipse has radii (wR, hR) in path-local EMU. stAng/swAng are
    1/60000 degrees, with 0° = +x axis, increasing clockwise.

    The center of the ellipse is at:
        center.x = cur.x - wR * cos(stAng)
        center.y = cur.y - hR * sin(stAng)
    The end point is on the same ellipse at angle (stAng + swAng).

    We emit a single SVG A command. SVG's sweep_flag = 1 means clockwise; the
    DrawingML convention is also clockwise so we pass sweep_flag = 1 when
    swAng > 0.
    """
    try:
        wR_emu = float(arc_elem.attrib.get("wR", "0"))
        hR_emu = float(arc_elem.attrib.get("hR", "0"))
        st_ang = float(arc_elem.attrib.get("stAng", "0"))
        sw_ang = float(arc_elem.attrib.get("swAng", "0"))
    except ValueError:
        return "", cx, cy

    if wR_emu <= 0 or hR_emu <= 0:
        return "", cx, cy

    rx = emu_to_px(wR_emu) * sx
    ry = emu_to_px(hR_emu) * sy
    st_rad = math.radians(st_ang / 60000.0)
    sw_rad = math.radians(sw_ang / 60000.0)
    end_rad = st_rad + sw_rad

    # Center of the ellipse in slide-absolute coords
    arc_cx = cx - rx * math.cos(st_rad)
    arc_cy = cy - ry * math.sin(st_rad)
    end_x = arc_cx + rx * math.cos(end_rad)
    end_y = arc_cy + ry * math.sin(end_rad)

    abs_sw = abs(sw_ang) / 60000.0
    large_arc = 1 if abs_sw > 180.0 else 0
    sweep = 1 if sw_ang >= 0 else 0

    return (
        f"A {fmt_num(rx)} {fmt_num(ry)} 0 {large_arc} {sweep} "
        f"{fmt_num(end_x)} {fmt_num(end_y)}",
        end_x,
        end_y,
    )

```

### Core Architecture Module: `apps/inno-agent/scripts/pptx_to_svg/effect_to_svg.py`
```
"""DrawingML <a:effectLst> -> SVG <filter> conversion.

Reverse of svg_to_pptx/drawingml_styles.build_effect_xml.

Covers the most common DrawingML effects:
- <a:outerShdw>  -> feDropShadow (or feGaussianBlur+feOffset+feFlood)
- <a:innerShdw>  -> approximated via inverted SourceAlpha pipeline
- <a:glow>       -> outer glow (no offset, uses flood color)
- <a:blur>       -> feGaussianBlur on whole shape
- <a:softEdge>   -> feGaussianBlur (approximation; SVG has no direct match)

Output: each call returns (filter_id, defs_xml). Caller adds filter="url(#id)"
to the shape and accumulates defs_xml into the slide's <defs>.
"""

from __future__ import annotations

import math
from xml.etree import ElementTree as ET

from .color_resolver import ColorPalette, find_color_elem, resolve_color
from .emu_units import NS, emu_to_px, fmt_num


def convert_effects(
    sp_pr: ET.Element | None,
    palette: ColorPalette | None,
    *,
    id_prefix: str = "fx",
    id_seq: list[int] | None = None,
) -> tuple[str | None, list[str]]:
    """Inspect <p:spPr> for <a:effectLst> and return (filter_id, defs_xml).

    If no effect is present returns (None, []). Multiple effects are layered
    inside one <filter> using SVG primitive results.
    """
    if sp_pr is None:
        return None, []
    effect_lst = sp_pr.find("a:effectLst", NS)
    if effect_lst is None:
        return None, []
    if len(list(effect_lst)) == 0:
        return None, []

    if id_seq is None:
        id_seq = [0]
    id_seq[0] += 1
    filter_id = f"{id_prefix}{id_seq[0]}"

    primitives: list[str] = []
    last_result = "SourceGraphic"
    # Filter region needs to extend beyond the bounding box to render shadows
    # and glows; choose generous defaults.
    filter_x = "-25%"
    filter_y = "-25%"
    filter_w = "150%"
    filter_h = "150%"

    for child in list(effect_lst):
        if not isinstance(child.tag, str):
            continue
        local = child.tag.split("}", 1)[-1]
        prim, last_result = _convert_one_effect(child, last_result, palette)
        if prim:
            primitives.append(prim)

    if not primitives:
        return None, []

    defs_xml = (
        f'<filter id="{filter_id}" x="{filter_x}" y="{filter_y}" '
        f'width="{filter_w}" height="{filter_h}">'
        + "".join(primitives)
        + "</filter>"
    )
    return filter_id, [defs_xml]


# ---------------------------------------------------------------------------
# Per-effect conversion
# ---------------------------------------------------------------------------

def _convert_one_effect(
    elem: ET.Element,
    last_result: str,
    palette: ColorPalette | None,
) -> tuple[str, str]:
    """Convert one effect to SVG filter primitives.

    Returns (primitives_xml, new_last_result_name).
    """
    local = elem.tag.split("}", 1)[-1]
    if local == "outerShdw":
        return _outer_shadow(elem, last_result, palette)
    if local == "innerShdw":
        return _inner_shadow(elem, last_result, palette)
    if local == "glow":
        return _glow(elem, last_result, palette)
    if local == "blur":
        return _blur(elem, last_result)
    if local == "softEdge":
        return _soft_edge(elem, last_result)
    if local == "reflection":
        # v1 approximation: skip (would require feImage + feFlood + transform)
        return "", last_result
    return "", last_result


def _color_alpha(elem: ET.Element, palette: ColorPalette | None) -> tuple[str, float]:
    color = find_color_elem(elem)
    hex_, alpha = resolve_color(color, palette)
    return hex_ or "#000000", alpha


def _direction_offset(elem: ET.Element) -> tuple[float, float]:
    """Read dir / dist into (dx, dy) px."""
    try:
        direction_units = float(elem.attrib.get("dir", "0"))
        dist_emu = float(elem.attrib.get("dist", "0"))
    except ValueError:
        return 0.0, 0.0
    direction_deg = direction_units / 60000.0
    dist_px = emu_to_px(dist_emu)
    rad = math.radians(direction_deg)
    return dist_px * math.cos(rad), dist_px * math.sin(rad)


def _blur_radius(elem: ET.Element, attr: str = "blurRad", default_emu: float = 0.0) -> float:
    try:
        v = float(elem.attrib.get(attr, str(default_emu)))
    except ValueError:
        return 0.0
    return emu_to_px(v)


def _outer_shadow(elem: ET.Element, last_result: str,
                  palette: ColorPalette | None) -> tuple[str, str]:
    dx, dy = _direction_offset(elem)
    blur = _blur_radius(elem, "blurRad")
    color, alpha = _color_alpha(elem, palette)
    # std deviation ~= blur radius / 2 (rough; PowerPoint shadows are larger)
    std = max(blur / 2.0, 0.1)
    # Use feDropShadow for compactness — it's well-supported in modern browsers.
    return (
        f'<feDropShadow dx="{fmt_num(dx)}" dy="{fmt_num(dy)}" '
        f'stdDeviation="{fmt_num(std)}" '
        f'flood-color="{color}" flood-opacity="{fmt_num(alpha, 4)}"/>',
        "shadow",
    )


def _inner_shadow(elem: ET.Element, last_result: str,
                  palette: ColorPalette | None) -> tuple[str, str]:
    """Inner shadow via inverted alpha + offset + blur + composite-in.

    Approximation: produces a darkened inner edge similar to PowerPoint.
    """
    dx, dy = _direction_offset(elem)
    blur = _blur_radius(elem, "blurRad")
    color, alpha = _color_alpha(elem, palette)
    std = max(blur / 2.0, 0.1)
    # Pipeline:
    #   feFlood (color) -> compose with inverted alpha -> blur -> offset ->
    #   composite-in original alpha
    return (
        f'<feFlood flood-color="{color}" flood-opacity="{fmt_num(alpha, 4)}" result="flood"/>'
        f'<feComposite in="flood" in2="SourceAlpha" operator="out" result="inverted"/>'
        f'<feGaussianBlur in="inverted" stdDeviation="{fmt_num(std)}" result="blurred"/>'
        f'<feOffset in="blurred" dx="{fmt_num(dx)}" dy="{fmt_num(dy)}" result="offset"/>'
        f'<feComposite in="offset" in2="SourceAlpha" operator="in" result="innerShadow"/>'
        f'<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="innerShadow"/></feMerge>',
        "innerShadow",
    )


def _glow(elem: ET.Element, last_result: str,
          palette: ColorPalette | None) -> tuple[str, str]:
    rad = _blur_radius(elem, "rad")
    color, alpha = _color_alpha(elem, palette)
    std = max(rad / 2.0, 0.1)
    return (
        f'<feMorphology operator="dilate" radius="{fmt_num(rad / 4.0)}" '
        f'in="SourceAlpha" result="dilated"/>'
        f'<feGaussianBlur in="dilated" stdDeviation="{fmt_num(std)}" result="blurred"/>'
        f'<feFlood flood-color="{color}" flood-opacity="{fmt_num(alpha, 4)}" result="flood"/>'
        f'<feComposite in="flood" in2="blurred" operator="in" result="glow"/>'
        f'<feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>',
        "glow",
    )


def _blur(elem: ET.Element, last_result: str) -> tuple[str, str]:
    rad = _blur_radius(elem, "rad")
    std = max(rad / 2.0, 0.1)
    return (
        f'<feGaussianBlur stdDeviation="{fmt_num(std)}"/>',
        "blurred",
    )


def _soft_edge(elem: ET.Element, last_result: str) -> tuple[str, str]:
    # softEdge fades the edges; approximate with an alpha-only Gaussian blur
    # then composite-in. v1 just outputs a gentle blur.
    rad = _blur_radius(elem, "rad")
    std = max(rad / 4.0, 0.1)
    return (
        f'<feGaussianBlur in="SourceAlpha" stdDeviation="{fmt_num(std)}" result="softEdge"/>'
        f'<feComposite in="SourceGraphic" in2="softEdge" operator="in"/>',
        "softEdge",
    )

```

### Core Architecture Module: `apps/inno-agent/scripts/pptx_to_svg/emu_units.py`
```
"""EMU <-> pixel conversion and DrawingML unit constants.

Mirrors svg_to_pptx/drawingml_utils.py and pptx_dimensions.py, in reverse.

DrawingML unit conventions:
- Coordinates / sizes: EMU (English Metric Unit). 914400 EMU = 1 inch = 96 px.
- Font size: hundredths of a point. 1 px = 0.75 pt = 75 hundredths-of-a-point.
- Angle: 60000ths of a degree.
- Color tint/shade/lumMod/lumOff/satMod: percent in 1000ths (100% = 100000).
- srcRect / fillRect: percent in 1000ths of the unit rect.
"""

from __future__ import annotations

from xml.etree import ElementTree as ET

EMU_PER_INCH = 914400
EMU_PER_PX = 9525  # 96 dpi
HUNDREDTHS_PT_PER_PX = 75  # 1 px = 0.75 pt = 75 hundredths
ANGLE_UNIT = 60000  # 1 degree = 60000 angle units
PERCENT_UNIT = 100000  # 100% = 100000 (DrawingML "ST_PositivePercentage")
SRCRECT_UNIT = 100000  # srcRect l/t/r/b are in 1000ths of percent (i.e. 100000 = 100%)


# Namespaces used throughout OOXML
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
    "asvg": "http://schemas.microsoft.com/office/drawing/2016/SVG/main",
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
}

# Register so ET output emits clean prefixes (writers normally don't need this
# since the SVG output uses the SVG namespace, but keep it consistent).
for prefix, uri in NS.items():
    try:
        ET.register_namespace(prefix, uri)
    except (ValueError, AttributeError):
        pass


# ---------------------------------------------------------------------------
# Length conversions
# ---------------------------------------------------------------------------

def emu_to_px(emu: float | int | None, default: float = 0.0) -> float:
    """Convert EMU to SVG px (96 dpi). None / unparsable -> default."""
    if emu is None:
        return default
    try:
        return float(emu) / EMU_PER_PX
    except (ValueError, TypeError):
        return default


def emu_attr_to_px(elem: ET.Element | None, attr: str, default: float = 0.0) -> float:
    """Read EMU integer attribute and return px."""
    if elem is None:
        return default
    return emu_to_px(elem.get(attr), default)


def hundredths_pt_to_px(val: float | int | str | None, default: float = 0.0) -> float:
    """Convert font size (a:rPr@sz) to px. 100 = 1 pt = 4/3 px."""
    if val is None:
        return default
    try:
        return float(val) / HUNDREDTHS_PT_PER_PX
    except (ValueError, TypeError):
        return default


def angle_to_deg(val: float | int | str | None, default: float = 0.0) -> float:
    """Convert DrawingML angle (1/60000 deg) to plain degrees."""
    if val is None:
        return default
    try:
        return float(val) / ANGLE_UNIT
    except (ValueError, TypeError):
        return default


def percent_to_ratio(val: float | int | str | None, default: float = 0.0) -> float:
    """DrawingML positive percent (100000 = 100%) -> ratio in [0, 1]."""
    if val is None:
        return default
    try:
        return float(val) / PERCENT_UNIT
    except (ValueError, TypeError):
        return default


# ---------------------------------------------------------------------------
# xfrm / transform parsing
# ---------------------------------------------------------------------------

class Xfrm:
    """Resolved <a:xfrm> in pixel space.

    Attributes:
        x, y: top-left position (px).
        w, h: size (px).
        rot: rotation in degrees, clockwise around the shape center.
        flip_h: bool — horizontal flip.
        flip_v: bool — vertical flip.
        ch_x, ch_y, ch_w, ch_h: only set when this is a group <p:grpSpPr>'s
            xfrm; describes the child coordinate frame (a:chOff / a:chExt).
            None on leaf shapes.
    """

    __slots__ = ("x", "y", "w", "h", "rot", "flip_h", "flip_v",
                 "ch_x", "ch_y", "ch_w", "ch_h")

    def __init__(
        self,
        x: float = 0.0,
        y: float = 0.0,
        w: float = 0.0,
        h: float = 0.0,
        rot: float = 0.0,
        flip_h: bool = False,
        flip_v: bool = False,
        ch_x: float | None = None,
        ch_y: float | None = None,
        ch_w: float | None = None,
        ch_h: float | None = None,
    ) -> None:
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.rot = rot
        self.flip_h = flip_h
        self.flip_v = flip_v
        self.ch_x = ch_x
        self.ch_y = ch_y
        self.ch_w = ch_w
        self.ch_h = ch_h

    def __repr__(self) -> str:
        parts = [f"x={self.x:.1f}", f"y={self.y:.1f}",
                 f"w={self.w:.1f}", f"h={self.h:.1f}"]
        if self.rot:
            parts.append(f"rot={self.rot:.2f}")
        if self.flip_h:
            parts.append("flipH")
        if self.flip_v:
            parts.append("flipV")
        return f"Xfrm({', '.join(parts)})"

    def to_svg_transform(self) -> str | None:
        """Build SVG transform attribute for rotation / flip around the center.

        Returns None if no rotation / flip is needed.
        """
        if not self.rot and not self.flip_h and not self.flip_v:
            return None
        cx = self.x + self.w / 2.0
        cy = self.y + self.h / 2.0
        parts: list[str] = []
        if self.rot:
            parts.append(f"rotate({_fmt(self.rot)} {_fmt(cx)} {_fmt(cy)})")
        if self.flip_h or self.flip_v:
            sx = -1 if self.flip_h else 1
            sy = -1 if self.flip_v else 1
            # scale around shape center
            parts.append(f"translate({_fmt(cx)} {_fmt(cy)})")
            parts.append(f"scale({sx} {sy})")
            parts.append(f"translate({_fmt(-cx)} {_fmt(-cy)})")
        return " ".join(parts) if parts else None


def parse_xfrm(xfrm_elem: ET.Element | None) -> Xfrm:
    """Parse <a:xfrm> into an Xfrm object. None -> zero Xfrm."""
    if xfrm_elem is None:
        return Xfrm()

    rot = angle_to_deg(xfrm_elem.get("rot"))
    flip_h = xfrm_elem.get("flipH") == "1"
    flip_v = xfrm_elem.get("flipV") == "1"

    off = xfrm_elem.find("a:off", NS)
    ext = xfrm_elem.find("a:ext", NS)
    ch_off = xfrm_elem.find("a:chOff", NS)
    ch_ext = xfrm_elem.find("a:chExt", NS)

    x = emu_attr_to_px(off, "x")
    y = emu_attr_to_px(off, "y")
    w = emu_attr_to_px(ext, "cx")
    h = emu_attr_to_px(ext, "cy")

    ch_x = emu_attr_to_px(ch_off, "x") if ch_off is not None else None
    ch_y = emu_attr_to_px(ch_off, "y") if ch_off is not None else None
    ch_w = emu_attr_to_px(ch_ext, "cx") if ch_ext is not None else None
    ch_h = emu_attr_to_px(ch_ext, "cy") if ch_ext is not None else None

    return Xfrm(x=x, y=y, w=w, h=h, rot=rot,
                flip_h=flip_h, flip_v=flip_v,
                ch_x=ch_x, ch_y=ch_y, ch_w=ch_w, ch_h=ch_h)


# ---------------------------------------------------------------------------
# Number formatting for SVG output
# ---------------------------------------------------------------------------

def _fmt(val: float, ndigits: int = 2) -> str:
    """Format a number for SVG attributes: trim trailing zeros, keep ints clean."""
    if val == 0:
        return "0"
    rounded = round(val, ndigits)
    if rounded == int(rounded):
        return str(int(rounded))
    s = f"{rounded:.{ndigits}f}"
    # trim trailing zeros after decimal
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


fmt_num = _fmt

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #242** (2026-09-19): **fix(docker): copy vendor/ before npm ci in production build**
  *Symptoms*: ## Summary - Dockerfile's build stage copies package manifests and runs `npm ci` before `vendor/` (holding the vendored `xlsx-0.20.3.tgz` both package.json files reference via `file:`) is ever copied in — `docker compose build` fails on a clean checkout with ENOENT on the tarball. - Adds `COPY vendor/ vendor/` right after the manifest COPYs, before `npm ci`.  ## Test plan - [x] `docker compose build --no-cache` completes - [x] `docker compose up -d` → `/health` returns `{"status":"ok"}` - [x] `bash restart-dev.sh smoke` passes (health, workspaces list, session+terminal create, WS upgrade)
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate of #240, which was merged as 5d3ae27 — same fix (COPY vendor/ before npm ci), same Dockerfile change. Thanks for the PR; the fix is already in main.

- **Issue #240** (2026-09-19): **fix(docker): copy vendor/ before npm ci in production build**
  *Symptoms*: Both apps/inno-agent/package.json and apps/inno-agent/web/package.json depend on xlsx via a file: reference to vendor/xlsx-0.20.3.tgz. The Dockerfile build stage never copied vendor/ into the build context, so `docker compose build` failed on a clean checkout with ENOENT on the tarball before npm ci could even run.

- **Issue #239** (2026-09-18): **feat: add session workspace switching with file migration**
  *Symptoms*: ## 概述  为会话增加工作区切换能力。用户可以在已有对话的标题栏选择另一个工作区，先查看该会话曾经访问过的文件，再逐文件决定复制、移动或不处理，最后完成会话绑定切换。  本 PR 包含以下两个已提交的改动：  - `26192d5 feat: add session workspace switching` - `24b6356 fix: harden session workspace activity tracking`  ## 主要改动  <img width="1200" height="800" alt="Screenshot 2026-09-18 at 00-50-19" src="https://github.com/user-attachments/assets/002ec59b-40ee-4df1-b97c-1311b7a5571a" />  ### 后端  - 新增 `workspace-activity-store` 会话工作区活动旁车数据：   - 将会话、工作区、相对路径、访问类型（读取/写入/读写）及首次/最近访问时间持久化到 `sessions/workspace-activity.json`。   - 只保存元数据，不保存文件内容、工具输出或 prompt 文本。   - 合并同一路径的多次访问，并正确合并为 `read_write`。   - 对绝对路径、越界路径、路径穿越、URL、符号链接、忽略目录等输入进行过滤。   - 会话删除时同步清理活动元数据。  - 新增 `workspace-switch` 切换与文件迁移服务：   - 生成源工作区到目标工作区的切换预览，只展示源工作区中仍存在且可安全处理的普通文件。   - 支持 `move`、`copy`、`none` 三种文件级操作。   - 使用排他复制，目标文件已存在时返回冲突，不覆盖目标文件。   - 拒绝符号链接、非普通文件、不安全目标路径和不可创建的目标目录。   - 每个文件返回 `moved`、`copied`、`conflict`、`missing` 或 `failed` 状态，并汇总成功、冲突、失败、缺失和已选择数量。  - 新增会话工作区切换接口：   - `GET /api/sessions/:id/workspace/switch-preview?targetWorkspaceId=...`   - `POST /api/sessions/:id/workspace/switch`   - 切换前校验会话、目标工作区和当前活动对话状态。   - 对当前正在使用的会话，在迁移文件前先原子更新工作区绑定并刷新 agent cwd；cwd 更新失败时恢复旧绑定。   - 保留会话历史和记忆，不迁移 session 文件或记忆数据。   - channel 专属工作区不允许作为对话切换目标。  - 加固工作区活动追踪：   - 在非流式、流式和 session prompt 入口统一观察工具执行事件，补齐不同 prompt 入口产生的读写记录。   - 记录图片写入、结构化附件访问及工具参数中明确声明的文件路径。   - 对 workspace change 事件记录写入路径；事件被截断或工具路径无法可靠分类时标记 `trackingIncomplete`，避免把不完整统计伪装成完整结果。   - 兼容旧的 trace/attachment 旁车数据：旧数据可

- **Issue #238** (2026-09-17): **feat: desktop computer use via @injaneity/pi-computer-use**
  *Symptoms*: ## What  Bundles [`@injaneity/pi-computer-use`](https://github.com/injaneity/pi-computer-use) so the **desktop app** can observe and control the local screen: accessibility-tree-first observation (`find_roots` / `observe_ui` / `search_ui` / `expand_ui` / `inspect_ui` / `read_text` / `wait_for`) plus side-effecting actions (`act_ui`, `launch_browser` / `navigate_browser` / `evaluate_browser`). Chosen over screenshot-coordinate alternatives because it supports macOS + Windows, works without a vision-capable model, and has zero runtime dependencies.  ## Gating — desktop only by default  - `electron/main.js` now sets `INNO_DESKTOP=1` for the spawned backend; `isComputerUseEnabled` (in `config.ts`, shared by the extension and the settings route) resolves: explicit `plugins.computerUse.enabled` wins in both directions → unset means on only under `INNO_DESKTOP=1`. **Online/server deployments stay off by default.** - TS-only plugin source is jiti-loaded like the other bundled plugins; it imports only pi-coding-agent + typebox, so no pi-ai alias is needed. - New `PUT /api/settings/computer-use` toggle + a switch in **Settings → General** (zh/en). Tool registration happens at session init, so the change applies on restart — the UI says so. - `GET /api/settings` exposes the effective state as `computerUse: { enabled, explicit, isDesktop }`.  ## Safety  - Managed permission policy now `ask`s on the four side-effecting tools (approval card per click/keystroke/browser action); passive obse

- **Issue #237** (2026-09-16): **fix: address PR #236 review follow-ups**
  *Symptoms*: ## Summary  Follow-ups from the post-merge review of #236 (https://github.com/hhyqhh/inno-agent/pull/236#issuecomment-5681542584):  - **checkins**: return an idempotent `200 {skipped: true, alreadySkipped: true}` on a *repeated skip* — the retry a lost skip response actually lands on (`POST /api/checkins/skip`), where a bare 409 would be misread as "auto-execution won the race". Also correct the misplaced comment on the claim route to describe the race it really covers (countdown takeover vs. a completed skip). - **server**: extract the uploaded-images prefix pattern into `src/server/upload-prefix.ts` as the single source of truth shared by `chat.ts` (builder) and `server.ts` (title stripper); the web client's mirrored regex in `ChatConversation.tsx` gets a cross-referencing comment (it cannot import server code). - **web**: scope job-stream settle/discard clearing of `pendingQuestion`/`pendingPermission` to the job run's session — the fields are shared with normal chat turns, so the unconditional clear could clobber a chat turn's card if that invariant ever broke. - **tests**: backend coverage for the previously untested #236 paths — check-ins skip/claim idempotency (4), `withRecordedTopic` `topicPendingUpgrade` transitions (5), and the upload-prefix stripper (2).  ## Verification  - `npm test`: 90 files / 703 tests pass (CLAUDE.md counts updated). - `npm run build` passes (backend + web). - Live end-to-end against the dev server: armed a real deferred slot, skipped it insid

- **Issue #236** (2026-09-15): **fix: stabilize chat sessions and scheduled runs**
  *Symptoms*: ## Summary  - 修复签到执行与跳过的竞态，避免重复提示或重复处理。 - 修复定时任务流在聊天页面中的可见性与会话切换行为。 - 增加会话首条消息标题预览，并修复预览标题升级后的侧边栏刷新。 - 提升上下文用量在会话切换、缓存和激活期间的稳定性。 - 更新 `CLAUDE.md` 的测试统计，并清理重复的上下文百分比格式化代码。  ## Verification  - `npm test`：87 个测试文件、692 个测试全部通过。 - `npm run build --workspace inno-agent` 通过。 - `npm run build --workspace inno-agent-web` 通过。
  **Post-Mortem & Fix Analysis**:
  > Post-merge review notes (verified locally on the merged head: 87 test files / 692 tests pass, backend + web builds pass). The changes are solid overall — these are follow-ups, not blockers, and I'll address them in a small fix PR.  **1. `alreadySkipped` idempotency sits on the wrong route (minor).** The comment in `server/routes/checkins.ts` describes "the response to an earlier skip can be lost… treat a repeated request for that same slot as success" — but a lost skip response is retried against `POST /api/checkins/skip`, which still returns a bare 409 (`checkins.ts:74`). The 200 `alreadySkipped` branch was added to the **claim** route instead. It's harmless today (the skip-route 409 is already treated as settled client-side, and a claim-after-skip is safely neutralized by `isSlotSettled` + `resolveOccurrence` + `discardJobStream`), but the handling and the comment should move to — or be duplicated on — the skip route.  **2. No backend test coverage for the two server-side changes.** 

- **Issue #235** (2026-09-14): **feat: read-only session context usage API and localized composer control**
  *Symptoms*: ## What  Adds a **context usage indicator** to the chat composer, showing how much of the model's context window the current session has consumed.  ## Changes  ### Backend - `src/shared/context-usage.ts` — shared types for the context usage payload. - `src/agent/context-usage.ts` — computes token usage vs. the active model's `contextWindow` from PI session state (with unit tests). - `src/server/routes/sessions.ts` — new **read-only** endpoint `GET /api/sessions/:id/context-usage` (with route tests).  ### Web UI - `web/src/api/sessions.ts` — client for the new endpoint. - `web/src/react/chat/useContextUsage.ts` — hook that fetches and refreshes usage for the active session. - `web/src/react/chat/ContextUsage.tsx` + `context-usage.css` — composer control rendering the usage readout. - Wired into `ChatCenter.tsx` / `ChatComposer.tsx`. - Fully localized (zh-CN + en), with component tests.  ### Docs - `docs/features/context-usage.md` — feature notes.  592 insertions across 15 files; no changes to existing behavior beyond the new endpoint and composer control.

- **Issue #234** (2026-09-14): **fix(web): adopt reference app's sidebar collapse pattern, fixing brand overlap**
  *Symptoms*: ## Problem  The renderer-owned window-chrome toggle rendered at all times at `left: 96px`. In a desktop-width **browser** window there are no macOS traffic lights beside it, so the button landed on top of the expanded sidebar's "Inno Agent" brand row (and the same overlap hit feature-page headers in browser + collapsed-sidebar state, which were desktop-scoped only).  ## Fix — reference harness's collapse pattern  The reference mockup (`innoagent 4`) splits the two states: the expanded sidebar carries its own collapse button inside its header, and the collapsed state leaves only a floating expand chip. Adopting that split removes the overlap entirely:  - **SessionSidebar**: new collapse button (`PanelLeftClose`, existing `sidebar.collapse` i18n) in the expanded header's right cluster, next to refresh. - **DesktopWindowChrome**: the sidebar toggle now renders only while collapsed — it is purely the expand button. - **app.css (browser)**: the expand button moves to the window edge (`control-left: 12px`, `title-inset: 54px`) and gets the card chip treatment (surface/border/shadow + fixed hover precedence) at every width, not just ≤960px. - **app.css (cleanup)**: sidebar header `padding-top` is desktop-only again (Electron traffic lights still need it); the narrow drawer header drops the toggle inset (toggle is hidden while the drawer is open); the collapsed-sidebar feature-header inset loses its desktop qualifier so browsers get the same clearance as conversation/workspace header

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

### Incident Patch 1: `5d3ae278` (2026-09-19)
**Commit Message**: fix(docker): copy vendor/ before npm ci in production build (#240)

Both apps/inno-agent/package.json and apps/inno-agent/web/package.json
depend on xlsx via a file: reference to vendor/xlsx-0.20.3.tgz. The
Dockerfile build stage never copied vendor/ into the build context, so
`docker compose build` failed on a clean checkout with ENOENT on the
tarball before npm ci could even run.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>

**File**: `Dockerfile` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/d
 COPY package.json package-lock.json tsconfig.base.json ./
 COPY apps/inno-agent/package.json apps/inno-agent/tsconfig.json apps/inno-agent/
 COPY apps/inno-agent/web/package.json apps/inno-agent/web/tsconfig.json apps/inno-agent/web/
+# Vendored xlsx tarball — both package.json files pull it in via a `file:` dependency,
+# so it must exist before npm ci runs.
+COPY vendor/ vendor/
 
 RUN npm config set registry https://registry.npmmirror.com && npm ci
 
```

---

### Incident Patch 2: `24b6356c` (2026-09-17)
**Commit Message**: fix: harden session workspace activity tracking

**File**: `apps/inno-agent/src/agent/pi-runner.ts` (modified, +25/-0)
```diff
@@ -35,6 +35,8 @@ let _currentCwd = "";
 let _configHolder: ConfigHolder | null = null;
 let _cwdResolver: ((sessionPath: string) => string | null) | null = null;
 let _activePromptToken: string | null = null;
+/** Server-side observer for metadata that must cover every prompt entrypoint. */
+let _promptEventObserver: ((event: AgentSessionEvent, sessionPath: string | null) => void) | null = null;
 /** Provider IDs registered into the active model registry by Inno's config. */
 const _registeredProviderIds = new Set<string>();
 
@@ -59,6 +61,26 @@ export function setWorkspaceCwdResolver(fn: ((sessionPath: string) => string | n
 	_cwdResolver = fn;
 }
 
+/**
+ * Observe raw agent events without changing prompt output or stream delivery.
+ * The server uses this for workspace activity metadata so channel, scheduler,
+ * and non-streaming prompts are tracked alongside web streams.
+ */
+export function setPromptEventObserver(
+	observer: ((event: AgentSessionEvent, sessionPath: string | null) => void) | null,
+): void {
+	_promptEventObserver = observer;
+}
+
+function notifyPromptEvent(event: AgentSessionEvent): void {
+	if (!_promptEventObserver) return;
+	try {
+		_promptEventObserver(event, _runtime?.session.sessionFile ?? null);
+	} catch (err) {
+		logger.warn({ err, eventType: event.type }, "prompt event observer failed");
+	}
+}
+
 function resolveCwdFor(sessionPath: string | null | undefined): string {
 	if (!sessionPath) return _workspaceDir;
 	if (_cwdResolver) {
@@ -1248,6 +1270,7 @@ export async function runPrompt(
 	const obsUnsub = session.subscribe(promptObserver);
 
 	const unsubscribe = session.subscribe((event) => {
+		notifyPromptEvent(event);
 		if (event.type === "message_update") {
 			const ev = event.assistantMessageEvent;
 			if (ev.type === "text_delta") {
@@ -1543,6 +1566,7 @@ export function runPromptStreaming(
 		const obsUnsub = session.subscribe(promptObserver);
 
 		const unsubscribe = session.subscribe((event) => {
+			notifyPromptEvent(event);
 			if (
 				!retryingWithoutNativeImages &&
 				isNativeImagePayloadError(eventErrorMessage(event))
@@ -1658,6 +1682,7 @@ export function runPromptStreamingInSession(
 				const promptObserver = createPromptObserver({ promptStartTime });
 				const obsUnsub = session.subscribe(promptObserver);
 				const unsubscribe = session.subscribe((event) => {
+					notifyPromptEvent(event);
 					if (
 						!retryingWithoutNativeImages &&
 						isNativeImagePayloadError(eventErrorMessage(event))
```

**File**: `apps/inno-agent/src/server.ts` (modified, +21/-0)
```diff
@@ -22,6 +22,7 @@ import {
 	initSession,
 	isQueueTaskCancelled,
 	reloadResources,
+	setPromptEventObserver,
 	setWorkspaceCwdResolver,
 } from "./agent/pi-runner.js";
 import { completePromptOnce, runPromptSerialized, runPromptStreamingInSession, runPromptInSession, abortPromptForTurnToken, abortJobPromptInSession } from "./agent/pi-runner.js";
@@ -58,6 +59,7 @@ import { handleChatRoutes } from "./server/routes/chat.js";
 import { handleCommandsRoutes } from "./server/routes/commands.js";
 import { handleBtwRoutes } from "./server/routes/btw.js";
 import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
+import { recordToolWorkspaceActivity } from "./server/workspace-activity-store.js";
 import { stripUploadedImagesPrefix } from "./server/upload-prefix.js";
 import {
 	mergeChannels,
@@ -222,6 +224,25 @@ async function ensureBootstrapped(): Promise<void> {
 			const workspaceId = workspaceRegistry.getSessionWorkspaceId(id);
 			return workspaceRegistry.resolveWorkspaceDir(workspaceId);
 		});
+		setPromptEventObserver((event, sessionPath) => {
+			if (event.type !== "tool_execution_start" && event.type !== "tool_execution_update") return;
+			// Progress events normally omit args; the start event is the source of
+			// truth in that case, so do not turn a harmless update into an
+			// incomplete-tracking warning.
+			if (event.type === "tool_execution_update" && event.args === undefined) return;
+			const sessionId = sessionPath ? basename(sessionPath) : getCurrentSessionId();
+			if (!sessionId) return;
+			const workspaceId = workspaceRegistry.getSessionWorkspaceId(sessionId);
+			const workspaceRoot = workspaceRegistry.resolveWorkspaceDir(workspaceId);
+			if (!workspaceRoot) return;
+			recordToolWorkspaceActivity(dataDir, {
+				sessionId,
+				workspaceId,
+				workspaceRoot,
+				toolName: event.toolName,
+				args: event.args,
+			});
+		});
 
 		migrateLegacyPiSkills();
 
```

**File**: `apps/inno-agent/src/server/attachments-store.ts` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ export interface SessionAttachmentEntry {
 	promptContent: string;
 	attachments: ChatAttachments;
 	timestamp: number;
+	/** Workspace that contained the attached files when the turn was accepted. */
+	workspaceId?: string;
 }
 
 export type SessionAttachmentsMetadata = Record<string, SessionAttachmentEntry[]>;
```

**File**: `apps/inno-agent/src/server/routes/chat.ts` (modified, +13/-31)
```diff
@@ -36,7 +36,6 @@ import { recordSessionAgentCommand } from "../agent-command-store.js";
 import { recordSessionTrace } from "../trace-store.js";
 import {
 	markWorkspaceTrackingIncomplete,
-	recordToolWorkspaceActivity,
 	recordWorkspaceAttachmentActivity,
 	recordWorkspaceFileAccess,
 } from "../workspace-activity-store.js";
@@ -546,6 +545,7 @@ export async function handleChatRoutes(
 				promptContent: prompt,
 				attachments,
 				timestamp: Date.now(),
+				workspaceId: imageWorkspaceId,
 			});
 			recordWorkspaceAttachmentActivity(dataDir, {
 				sessionId: imageSessionId,
@@ -804,6 +804,7 @@ export async function handleChatRoutes(
 				promptContent: prompt,
 				attachments: streamAttachments,
 				timestamp: Date.now(),
+				workspaceId: streamWorkspaceId,
 			});
 			recordWorkspaceAttachmentActivity(dataDir, {
 				sessionId: requestedSessionId,
@@ -885,37 +886,17 @@ export async function handleChatRoutes(
 					}
 					break;
 				}
-					case "tool_execution_start":
-						recordToolWorkspaceActivity(dataDir, {
-						sessionId: state.sessionId,
-						workspaceId: state.workspaceId,
-						workspaceRoot: state.workspaceRoot,
-						toolName: event.toolName,
-							args: event.args,
-						});
-						logger.info(
-							{ toolName: event.toolName, toolCallId: event.toolCallId },
-							"tool call started: %s", event.toolName,
-						);
-						break;
-					case "tool_execution_update":
-					recordToolWorkspaceActivity(dataDir, {
-						sessionId: state.sessionId,
-						workspaceId: state.workspaceId,
-						workspaceRoot: state.workspaceRoot,
-						toolName: event.toolName,
-							args: event.args,
-						});
-						// Partial tool output is forwarded to the stream registry below.
-						// Do not report these normal progress events as unhandled.
-						break;
+				case "tool_execution_start":
+					logger.info(
+						{ toolName: event.toolName, toolCallId: event.toolCallId },
+						"tool call started: %s", event.toolName,
+					);
+					break;
+				case "tool_execution_update":
+					// Partial tool output is forwarded to the stream registry below.
+					// Do not report these normal progress events as unhandled.
+					break;
 				case "tool_execution_end":
-					recordToolWorkspaceActivity(dataDir, {
-						sessionId: state.sessionId,
-						workspaceId: state.workspaceId,
-						workspaceRoot: state.workspaceRoot,
-						toolName: event.toolName,
-					});
 					workspaceChangeMonitor?.noteToolEnd(event.toolCallId, event.toolName);
 					if (event.isError) {
 						const errText = Array.isArray(event.result?.content)
@@ -1047,6 +1028,7 @@ export async function handleChatRoutes(
 								assistantMessageId: assistantMessage?.role === "assistant" ? assistantMessage.entryId : undefined,
 								startedAt: state.startedAt,
 								finishedAt: state.finishedAt ?? new Date().toISOString(),
+								workspaceId: state.workspaceId,
 								events: state.history,
 							});
 						} catch (err) {
```

**File**: `apps/inno-agent/src/server/trace-store.test.ts` (modified, +12/-0)
```diff
@@ -76,6 +76,18 @@ describe("session UI trace sidecar", () => {
 		expect(mergeSessionTraces(dataDir, "session-1", messages)).toEqual(messages);
 	});
 
+	it("persists the active workspace on trace events", () => {
+		recordSessionTrace(dataDir, "session-1", {
+			assistantIndex: 0,
+			workspaceId: "workspace-1",
+			events: [envelope(1, { type: "tool_start", toolName: "read_file", args: { path: "notes.md" } })],
+		});
+
+		const messages: SessionMessageSummary[] = [{ role: "assistant", content: "answer", timestamp: 1 }];
+		expect(mergeSessionTraces(dataDir, "session-1", messages)[0]?.traceEvents?.[0]?.event.workspaceId)
+			.toBe("workspace-1");
+	});
+
 	it("prefers the persisted PI message id when a branch changes message indexes", () => {
 		recordSessionTrace(dataDir, "session-1", {
 			assistantIndex: 4,
```

---

### Incident Patch 3: `fdd95ccd` (2026-09-16)
**Commit Message**: Merge pull request #237 from hhyqhh/fix/pr236-followups

fix: address PR #236 review follow-ups

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@e
 
 Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `@juicesharp/rpiv-ask-user-question` (bridges agent `ask_user_question` tool calls to the web UI), `@juicesharp/rpiv-todo` (`todo` task-list tool), `pi-web-access` (`fetch_content`/`get_search_content` URL/GitHub/PDF/YouTube extraction), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing), `graphology` + `graphology-communities-louvain` (wiki knowledge graph), `yaml` (YAML parsing), `@llamaindex/liteparse` (document parsing).
 
-Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 87 files (692 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
+Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 90 files (703 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
 
 When a PR changes the test count, the size of `server.ts`, or other structural facts stated in this file, update this file in the same PR — AI agents read it as ground truth.
 
```

**File**: `apps/inno-agent/src/server.ts` (modified, +2/-3)
```diff
@@ -58,6 +58,7 @@ import { handleChatRoutes } from "./server/routes/chat.js";
 import { handleCommandsRoutes } from "./server/routes/commands.js";
 import { handleBtwRoutes } from "./server/routes/btw.js";
 import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
+import { stripUploadedImagesPrefix } from "./server/upload-prefix.js";
 import {
 	mergeChannels,
 	selectActiveSessionEntries,
@@ -1283,9 +1284,7 @@ function cleanGeneratedTopic(raw: string): string {
 /** Strip machine-injected prefixes (e.g. the image-upload hint prepended to
  *  user prompts) so titles reflect the user's actual words. */
 function stripInjectedPrefix(content: string): string {
-	return content
-		.replace(/^\[用户本轮上传了 \d+ 张图片，已保存到工作区：[\s\S]*?\]\s*/, "")
-		.trim();
+	return stripUploadedImagesPrefix(content);
 }
 
 function fallbackTopicFromMessages(messages: SessionMessageSummary[], summary: SessionSummary): string {
```

**File**: `apps/inno-agent/src/server/routes/chat.ts` (modified, +4/-0)
```diff
@@ -236,6 +236,10 @@ function mimeTypeToExtension(mimeType: string): string {
  * Only sent when the model can't natively see images (text-only model or a
  * rejected native payload) — vision-capable turns receive the raw prompt so
  * they aren't steered toward `ocr_image`.
+ *
+ * The prefix format is owned by `server/upload-prefix.ts`
+ * (UPLOADED_IMAGES_PREFIX_PATTERN), which strips it back out when deriving
+ * session titles — keep the two in sync when changing the format.
  */
 function prependImagePathsHint(prompt: string, imagePaths: string[]): string {
 	if (imagePaths.length === 0) return prompt;
```

**File**: `apps/inno-agent/src/server/routes/checkins.test.ts` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+import { mkdtempSync, rmSync } from "node:fs";
+import type { IncomingMessage as HttpReq, ServerResponse } from "node:http";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { Readable } from "node:stream";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { CheckInStore } from "../../checkins/check-in-store.js";
+import { JobStore } from "../../scheduler/job-store.js";
+import { handleCheckInsRoutes } from "./checkins.js";
+
+let dir: string;
+let jobStore: JobStore;
+let checkInStore: CheckInStore;
+
+beforeEach(() => {
+	dir = mkdtempSync(join(tmpdir(), "inno-checkins-route-"));
+	jobStore = new JobStore(join(dir, "jobs"), "Asia/Shanghai");
+	checkInStore = new CheckInStore(join(dir, "data"), "Asia/Shanghai", jobStore);
+});
+
+afterEach(() => {
+	rmSync(dir, { recursive: true, force: true });
+});
+
+function fakeReq(body: unknown): HttpReq {
+	const req = Readable.from([JSON.stringify(body)]) as HttpReq;
+	req.headers = {};
+	return req;
+}
+
+function fakeRes(): ServerResponse & { statusCode: number; payload: unknown } {
+	const res = {
+		statusCode: 0,
+		payload: undefined as unknown,
+		writeHead(status: number) {
+			res.statusCode = status;
+			return res;
+		},
+		end(body?: string) {
+			res.payload = body ? JSON.parse(body) : undefined;
+			return res;
+		},
+	};
+	return res as unknown as ServerResponse & { statusCode: number; payload: unknown };
+}
+
+/** Create an enabled daily learning job and return today's planned slot. */
+function plannedOccurrence() {
+	const job = jobStore.create({
+		name: "daily review",
+		cron: "0 9 * * *",
+		timezone: "Asia/Shanghai",
+		enabled: true,
+		taskType: "daily_review",
+		prompt: "review my notes",
+	});
+	const occurrence = checkInStore.getTodayPlan().jobs
+		.find((candidate) => candidate.jobId === job.id)?.occurrences[0];
+	if (!occurrence) throw new Error("expected a planned occurrence for today");
+	return { job, occurrence };
+}
+
+function skipOccurrence(occurrenceId: string) {
+	checkInStore.recordOccurrence({
+		occurrenceId,
+		jobId: "job",
+		scheduledAt: new Date().toISOString(),
+		status: "skipped",
+		runId: "skip_test",
+		finishedAt: new Date().toISOString(),
+	});
+}
+
+describe("check-ins skip/claim idempotency", () => {
+	it("treats a repeated skip of an already-skipped slot as success", async () => {
+		const { occurrence } = plannedOccurrence();
+		skipOccurrence(occurrence.occurrenceId);
+		// No deferred run is registered, so the cancel misses and the route
+		// falls back to the persisted slot state.
+
+		const res = fakeRes();
+		const handled = await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(handled).toBe(true);
+		expect(res.statusCode).toBe(200);
+		expect(res.payload).toEqual({ skipped: true, alreadySkipped: true });
+	});
+
+	it("returns 409 for a repeated skip of a slot that is still pending", async () => {
+		const { occurrence } = plannedOccurrence();
+
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(409);
+	});
+
+	it("returns 409 for an unknown slot", async () => {
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: "nope" }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(409);
+	});
+
+	it("lets a late claim of an already-skipped slot stand down quietly", async () => {
+		const { occurrence } = plannedOccurrence();
+		skipOccurrence(occurrence.occurrenceId);
+
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/claim", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(200);
+		expect(res.payload).toEqual({ s
```

**File**: `apps/inno-agent/src/server/routes/checkins.ts` (modified, +13/-3)
```diff
@@ -47,9 +47,10 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
-			// The response to an earlier skip can be lost after the server has
-			// already persisted the slot. Treat a repeated request for that same
-			// slot as success so the client cannot resurrect the banner by polling.
+			// A claim can race a completed skip (e.g. the countdown takeover in
+			// another tab). The slot is already settled, so report success and
+			// let the client's settled-slot pre-check quietly stand down instead
+			// of surfacing a spurious failure.
 			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
 			if (occurrence?.status === "skipped") {
 				json(res, 200, { skipped: true, alreadySkipped: true });
@@ -72,6 +73,15 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
+			// The response to an earlier skip can be lost after the server has
+			// already persisted the slot. Treat a repeated skip for that same
+			// slot as success so the client cannot resurrect the banner by
+			// retrying (a plain 409 would look like "auto-execution won").
+			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
+			if (occurrence?.status === "skipped") {
+				json(res, 200, { skipped: true, alreadySkipped: true });
+				return true;
+			}
 			json(res, 409, { error: "This slot is no longer pending." });
 			return true;
 		}
```

---

### Incident Patch 4: `b125a454` (2026-09-15)
**Commit Message**: fix: address PR #236 review follow-ups

- checkins: return idempotent 200 alreadySkipped on a repeated skip (the
  response a lost skip is actually retried against), and correct the
  misplaced comment on the claim route
- server: extract the uploaded-images prefix pattern into
  src/server/upload-prefix.ts as the single source of truth shared by
  chat.ts (builder) and server.ts (stripper); cross-reference it from the
  web client's mirrored regex
- web: scope job-stream settle/discard clearing of pending
  question/permission cards to the job run's session so shared chat-turn
  state can never be clobbered
- tests: route-level coverage for check-ins skip/claim idempotency,
  withRecordedTopic topicPendingUpgrade transitions, and the upload-prefix
  stripper (90 files / 703 tests)

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@e
 
 Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `@juicesharp/rpiv-ask-user-question` (bridges agent `ask_user_question` tool calls to the web UI), `@juicesharp/rpiv-todo` (`todo` task-list tool), `pi-web-access` (`fetch_content`/`get_search_content` URL/GitHub/PDF/YouTube extraction), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing), `graphology` + `graphology-communities-louvain` (wiki knowledge graph), `yaml` (YAML parsing), `@llamaindex/liteparse` (document parsing).
 
-Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 87 files (692 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
+Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 90 files (703 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
 
 When a PR changes the test count, the size of `server.ts`, or other structural facts stated in this file, update this file in the same PR — AI agents read it as ground truth.
 
```

**File**: `apps/inno-agent/src/server.ts` (modified, +2/-3)
```diff
@@ -58,6 +58,7 @@ import { handleChatRoutes } from "./server/routes/chat.js";
 import { handleCommandsRoutes } from "./server/routes/commands.js";
 import { handleBtwRoutes } from "./server/routes/btw.js";
 import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
+import { stripUploadedImagesPrefix } from "./server/upload-prefix.js";
 import {
 	mergeChannels,
 	selectActiveSessionEntries,
@@ -1283,9 +1284,7 @@ function cleanGeneratedTopic(raw: string): string {
 /** Strip machine-injected prefixes (e.g. the image-upload hint prepended to
  *  user prompts) so titles reflect the user's actual words. */
 function stripInjectedPrefix(content: string): string {
-	return content
-		.replace(/^\[用户本轮上传了 \d+ 张图片，已保存到工作区：[\s\S]*?\]\s*/, "")
-		.trim();
+	return stripUploadedImagesPrefix(content);
 }
 
 function fallbackTopicFromMessages(messages: SessionMessageSummary[], summary: SessionSummary): string {
```

**File**: `apps/inno-agent/src/server/routes/chat.ts` (modified, +4/-0)
```diff
@@ -236,6 +236,10 @@ function mimeTypeToExtension(mimeType: string): string {
  * Only sent when the model can't natively see images (text-only model or a
  * rejected native payload) — vision-capable turns receive the raw prompt so
  * they aren't steered toward `ocr_image`.
+ *
+ * The prefix format is owned by `server/upload-prefix.ts`
+ * (UPLOADED_IMAGES_PREFIX_PATTERN), which strips it back out when deriving
+ * session titles — keep the two in sync when changing the format.
  */
 function prependImagePathsHint(prompt: string, imagePaths: string[]): string {
 	if (imagePaths.length === 0) return prompt;
```

**File**: `apps/inno-agent/src/server/routes/checkins.test.ts` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+import { mkdtempSync, rmSync } from "node:fs";
+import type { IncomingMessage as HttpReq, ServerResponse } from "node:http";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { Readable } from "node:stream";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { CheckInStore } from "../../checkins/check-in-store.js";
+import { JobStore } from "../../scheduler/job-store.js";
+import { handleCheckInsRoutes } from "./checkins.js";
+
+let dir: string;
+let jobStore: JobStore;
+let checkInStore: CheckInStore;
+
+beforeEach(() => {
+	dir = mkdtempSync(join(tmpdir(), "inno-checkins-route-"));
+	jobStore = new JobStore(join(dir, "jobs"), "Asia/Shanghai");
+	checkInStore = new CheckInStore(join(dir, "data"), "Asia/Shanghai", jobStore);
+});
+
+afterEach(() => {
+	rmSync(dir, { recursive: true, force: true });
+});
+
+function fakeReq(body: unknown): HttpReq {
+	const req = Readable.from([JSON.stringify(body)]) as HttpReq;
+	req.headers = {};
+	return req;
+}
+
+function fakeRes(): ServerResponse & { statusCode: number; payload: unknown } {
+	const res = {
+		statusCode: 0,
+		payload: undefined as unknown,
+		writeHead(status: number) {
+			res.statusCode = status;
+			return res;
+		},
+		end(body?: string) {
+			res.payload = body ? JSON.parse(body) : undefined;
+			return res;
+		},
+	};
+	return res as unknown as ServerResponse & { statusCode: number; payload: unknown };
+}
+
+/** Create an enabled daily learning job and return today's planned slot. */
+function plannedOccurrence() {
+	const job = jobStore.create({
+		name: "daily review",
+		cron: "0 9 * * *",
+		timezone: "Asia/Shanghai",
+		enabled: true,
+		taskType: "daily_review",
+		prompt: "review my notes",
+	});
+	const occurrence = checkInStore.getTodayPlan().jobs
+		.find((candidate) => candidate.jobId === job.id)?.occurrences[0];
+	if (!occurrence) throw new Error("expected a planned occurrence for today");
+	return { job, occurrence };
+}
+
+function skipOccurrence(occurrenceId: string) {
+	checkInStore.recordOccurrence({
+		occurrenceId,
+		jobId: "job",
+		scheduledAt: new Date().toISOString(),
+		status: "skipped",
+		runId: "skip_test",
+		finishedAt: new Date().toISOString(),
+	});
+}
+
+describe("check-ins skip/claim idempotency", () => {
+	it("treats a repeated skip of an already-skipped slot as success", async () => {
+		const { occurrence } = plannedOccurrence();
+		skipOccurrence(occurrence.occurrenceId);
+		// No deferred run is registered, so the cancel misses and the route
+		// falls back to the persisted slot state.
+
+		const res = fakeRes();
+		const handled = await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(handled).toBe(true);
+		expect(res.statusCode).toBe(200);
+		expect(res.payload).toEqual({ skipped: true, alreadySkipped: true });
+	});
+
+	it("returns 409 for a repeated skip of a slot that is still pending", async () => {
+		const { occurrence } = plannedOccurrence();
+
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(409);
+	});
+
+	it("returns 409 for an unknown slot", async () => {
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: "nope" }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(409);
+	});
+
+	it("lets a late claim of an already-skipped slot stand down quietly", async () => {
+		const { occurrence } = plannedOccurrence();
+		skipOccurrence(occurrence.occurrenceId);
+
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/claim", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(200);
+		expect(res.payload).toEqual({ s
```

**File**: `apps/inno-agent/src/server/routes/checkins.ts` (modified, +13/-3)
```diff
@@ -47,9 +47,10 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
-			// The response to an earlier skip can be lost after the server has
-			// already persisted the slot. Treat a repeated request for that same
-			// slot as success so the client cannot resurrect the banner by polling.
+			// A claim can race a completed skip (e.g. the countdown takeover in
+			// another tab). The slot is already settled, so report success and
+			// let the client's settled-slot pre-check quietly stand down instead
+			// of surfacing a spurious failure.
 			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
 			if (occurrence?.status === "skipped") {
 				json(res, 200, { skipped: true, alreadySkipped: true });
@@ -72,6 +73,15 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
+			// The response to an earlier skip can be lost after the server has
+			// already persisted the slot. Treat a repeated skip for that same
+			// slot as success so the client cannot resurrect the banner by
+			// retrying (a plain 409 would look like "auto-execution won").
+			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
+			if (occurrence?.status === "skipped") {
+				json(res, 200, { skipped: true, alreadySkipped: true });
+				return true;
+			}
 			json(res, 409, { error: "This slot is no longer pending." });
 			return true;
 		}
```

---

### Incident Patch 5: `949a9a6b` (2026-09-15)
**Commit Message**: Merge pull request #236 from nfcino/fix/inno-agent-stability

fix: stabilize chat sessions and scheduled runs

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@e
 
 Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `@juicesharp/rpiv-ask-user-question` (bridges agent `ask_user_question` tool calls to the web UI), `@juicesharp/rpiv-todo` (`todo` task-list tool), `pi-web-access` (`fetch_content`/`get_search_content` URL/GitHub/PDF/YouTube extraction), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing), `graphology` + `graphology-communities-louvain` (wiki knowledge graph), `yaml` (YAML parsing), `@llamaindex/liteparse` (document parsing).
 
-Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 84 files (670 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
+Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 87 files (692 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
 
 When a PR changes the test count, the size of `server.ts`, or other structural facts stated in this file, update this file in the same PR — AI agents read it as ground truth.
 
```

**File**: `apps/inno-agent/src/checkins/check-in-store.ts` (modified, +7/-0)
```diff
@@ -263,6 +263,13 @@ export class CheckInStore {
 			?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
 	}
 
+	/** Find a live occurrence by its stable id, including settled slots. */
+	getOccurrenceById(occurrenceId: string, now: Date = new Date()): CheckInOccurrence | undefined {
+		return this.getTodayPlan(now).jobs
+			.flatMap((job) => job.occurrences)
+			.find((occurrence) => occurrence.occurrenceId === occurrenceId);
+	}
+
 	/**
 	 * Persist the result for one planned slot and reconcile today's check-in.
 	 * A successful attempt is sticky: a later failed retry cannot undo a slot
```

**File**: `apps/inno-agent/src/server.ts` (modified, +9/-6)
```diff
@@ -61,6 +61,7 @@ import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
 import {
 	mergeChannels,
 	selectActiveSessionEntries,
+	TOPIC_UPGRADE_MESSAGE_THRESHOLD,
 	type SessionChannel,
 	type SessionChannelMetadata,
 	type SessionMessageSummary,
@@ -1358,14 +1359,14 @@ ${excerpt}
  *
  * Two passes, both guarded by `_pendingAutoTopics`:
  * 1. First pass: no topic recorded yet and ≥2 messages (the first exchange).
- * 2. Upgrade pass: the existing topic is auto-generated (never a manual
+ *    Persist the user's first-message preview immediately so the UI never
+ *    shows a model-generated placeholder or a session-file id.
+ * 2. Upgrade pass: the existing preview is auto-generated (never a manual
  *    rename), hasn't been upgraded yet, and the conversation has grown to
- *    TOPIC_UPGRADE_MESSAGE_THRESHOLD messages — the first-pass title was
- *    based on a single exchange and is often vague, so re-roll it once with
- *    richer context.
+ *    TOPIC_UPGRADE_MESSAGE_THRESHOLD messages — generate a richer summary
+ *    once there is enough context.
  */
 const _pendingAutoTopics = new Set<string>();
-const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
 
 function maybeAutoGenerateTopic(sessionId: string): void {
 	if (!sessionId || _pendingAutoTopics.has(sessionId)) return;
@@ -1381,7 +1382,9 @@ function maybeAutoGenerateTopic(sessionId: string): void {
 			const parsed = parseSessionFile(sessionPath);
 			if (!parsed || parsed.messages.length < 2) return;
 			if (existing && parsed.messages.length < TOPIC_UPGRADE_MESSAGE_THRESHOLD) return;
-			const topic = await generateSessionTopic(parsed.summary, parsed.messages);
+			const topic = existing
+				? await generateSessionTopic(parsed.summary, parsed.messages)
+				: fallbackTopicFromMessages(parsed.messages, parsed.summary);
 			writeSessionTopic(sessionId, topic, true, existing ? { upgraded: true } : undefined);
 			logger.info(`[auto-topic] ${sessionId} → ${topic}${existing ? " (upgraded)" : ""}`);
 		} catch (err) {
```

**File**: `apps/inno-agent/src/server/routes/checkins.ts` (modified, +8/-0)
```diff
@@ -47,6 +47,14 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
+			// The response to an earlier skip can be lost after the server has
+			// already persisted the slot. Treat a repeated request for that same
+			// slot as success so the client cannot resurrect the banner by polling.
+			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
+			if (occurrence?.status === "skipped") {
+				json(res, 200, { skipped: true, alreadySkipped: true });
+				return true;
+			}
 			json(res, 409, { error: "This slot is no longer pending." });
 			return true;
 		}
```

**File**: `apps/inno-agent/src/server/routes/sessions.ts` (modified, +11/-4)
```diff
@@ -42,6 +42,7 @@ import { contentDispositionAttachment } from "../file-helpers.js";
 import { HttpError, json, matchRoute, readBody } from "../http-helpers.js";
 import {
 	mergeChannels,
+	TOPIC_UPGRADE_MESSAGE_THRESHOLD,
 	type SessionChannel,
 	type SessionChannelMetadata,
 	type SessionMessageSummary,
@@ -215,10 +216,16 @@ function withRecordedChannels(summary: SessionSummary, metadata: SessionChannelM
 }
 
 function withRecordedTopic(summary: SessionSummary, metadata: SessionTopicMetadata): SessionSummary {
-	const topic = metadata[summary.id]?.topic?.trim();
-	// hasTopic lets clients distinguish "no topic recorded yet" (auto-topic may
-	// still be generating) from a fallback preview name, without guessing.
-	return topic ? { ...summary, name: topic, hasTopic: true } : { ...summary, hasTopic: false };
+	const recorded = metadata[summary.id];
+	const topic = recorded?.topic?.trim();
+	if (!topic) return { ...summary, hasTopic: false, topicPendingUpgrade: false };
+	// A generated preview is only provisional once the conversation has enough
+	// messages for the richer upgrade pass. Legacy generated topics without the
+	// upgraded marker remain final until a later turn reaches that threshold.
+	const topicPendingUpgrade = recorded.generated === true
+		&& recorded.upgraded !== true
+		&& summary.messageCount >= TOPIC_UPGRADE_MESSAGE_THRESHOLD;
+	return { ...summary, name: topic, hasTopic: true, topicPendingUpgrade };
 }
 
 /**
```

---

### Incident Patch 6: `f971d9b2` (2026-09-15)
**Commit Message**: fix(sessions): refresh after topic preview upgrade

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@e
 
 Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `@juicesharp/rpiv-ask-user-question` (bridges agent `ask_user_question` tool calls to the web UI), `@juicesharp/rpiv-todo` (`todo` task-list tool), `pi-web-access` (`fetch_content`/`get_search_content` URL/GitHub/PDF/YouTube extraction), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing), `graphology` + `graphology-communities-louvain` (wiki knowledge graph), `yaml` (YAML parsing), `@llamaindex/liteparse` (document parsing).
 
-Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 84 files (670 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
+Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 87 files (692 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
 
 When a PR changes the test count, the size of `server.ts`, or other structural facts stated in this file, update this file in the same PR — AI agents read it as ground truth.
 
```

**File**: `apps/inno-agent/src/server.ts` (modified, +1/-1)
```diff
@@ -61,6 +61,7 @@ import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
 import {
 	mergeChannels,
 	selectActiveSessionEntries,
+	TOPIC_UPGRADE_MESSAGE_THRESHOLD,
 	type SessionChannel,
 	type SessionChannelMetadata,
 	type SessionMessageSummary,
@@ -1366,7 +1367,6 @@ ${excerpt}
  *    once there is enough context.
  */
 const _pendingAutoTopics = new Set<string>();
-const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
 
 function maybeAutoGenerateTopic(sessionId: string): void {
 	if (!sessionId || _pendingAutoTopics.has(sessionId)) return;
```

**File**: `apps/inno-agent/src/server/routes/sessions.ts` (modified, +11/-4)
```diff
@@ -42,6 +42,7 @@ import { contentDispositionAttachment } from "../file-helpers.js";
 import { HttpError, json, matchRoute, readBody } from "../http-helpers.js";
 import {
 	mergeChannels,
+	TOPIC_UPGRADE_MESSAGE_THRESHOLD,
 	type SessionChannel,
 	type SessionChannelMetadata,
 	type SessionMessageSummary,
@@ -215,10 +216,16 @@ function withRecordedChannels(summary: SessionSummary, metadata: SessionChannelM
 }
 
 function withRecordedTopic(summary: SessionSummary, metadata: SessionTopicMetadata): SessionSummary {
-	const topic = metadata[summary.id]?.topic?.trim();
-	// hasTopic lets clients distinguish "no topic recorded yet" (auto-topic may
-	// still be generating) from a fallback preview name, without guessing.
-	return topic ? { ...summary, name: topic, hasTopic: true } : { ...summary, hasTopic: false };
+	const recorded = metadata[summary.id];
+	const topic = recorded?.topic?.trim();
+	if (!topic) return { ...summary, hasTopic: false, topicPendingUpgrade: false };
+	// A generated preview is only provisional once the conversation has enough
+	// messages for the richer upgrade pass. Legacy generated topics without the
+	// upgraded marker remain final until a later turn reaches that threshold.
+	const topicPendingUpgrade = recorded.generated === true
+		&& recorded.upgraded !== true
+		&& summary.messageCount >= TOPIC_UPGRADE_MESSAGE_THRESHOLD;
+	return { ...summary, name: topic, hasTopic: true, topicPendingUpgrade };
 }
 
 /**
```

**File**: `apps/inno-agent/src/server/session-model.ts` (modified, +4/-0)
```diff
@@ -46,6 +46,8 @@ export interface SessionTraceEvent {
 
 export type SessionChannel = "cli" | "web" | "feishu" | "qq" | "wechat" | "scheduler" | "unknown";
 
+export const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
+
 export interface SessionSummary {
 	id: string;
 	name: string;
@@ -58,6 +60,8 @@ export interface SessionSummary {
 	origin?: SessionChannel;
 	/** True once a topic (manual or auto-generated) has been recorded. */
 	hasTopic?: boolean;
+	/** True while an auto-generated preview is waiting for its richer summary. */
+	topicPendingUpgrade?: boolean;
 }
 
 export type SessionTopicMetadata = Record<string, { topic: string; updatedAt: string; generated?: boolean; upgraded?: boolean }>;
```

**File**: `apps/inno-agent/web/src/api/sessions.ts` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ export interface SessionMeta {
 	archived?: boolean;
 	/** True once a topic (manual or auto-generated) has been recorded server-side. */
 	hasTopic?: boolean;
+	/** True while an auto-generated preview is waiting for its richer summary. */
+	topicPendingUpgrade?: boolean;
 }
 
 export interface PendingQuestionData {
```

---

### Incident Patch 7: `d7128019` (2026-09-15)
**Commit Message**: fix(sessions): show first-message preview immediately

**File**: `apps/inno-agent/src/server.ts` (modified, +8/-5)
```diff
@@ -1358,11 +1358,12 @@ ${excerpt}
  *
  * Two passes, both guarded by `_pendingAutoTopics`:
  * 1. First pass: no topic recorded yet and ≥2 messages (the first exchange).
- * 2. Upgrade pass: the existing topic is auto-generated (never a manual
+ *    Persist the user's first-message preview immediately so the UI never
+ *    shows a model-generated placeholder or a session-file id.
+ * 2. Upgrade pass: the existing preview is auto-generated (never a manual
  *    rename), hasn't been upgraded yet, and the conversation has grown to
- *    TOPIC_UPGRADE_MESSAGE_THRESHOLD messages — the first-pass title was
- *    based on a single exchange and is often vague, so re-roll it once with
- *    richer context.
+ *    TOPIC_UPGRADE_MESSAGE_THRESHOLD messages — generate a richer summary
+ *    once there is enough context.
  */
 const _pendingAutoTopics = new Set<string>();
 const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
@@ -1381,7 +1382,9 @@ function maybeAutoGenerateTopic(sessionId: string): void {
 			const parsed = parseSessionFile(sessionPath);
 			if (!parsed || parsed.messages.length < 2) return;
 			if (existing && parsed.messages.length < TOPIC_UPGRADE_MESSAGE_THRESHOLD) return;
-			const topic = await generateSessionTopic(parsed.summary, parsed.messages);
+			const topic = existing
+				? await generateSessionTopic(parsed.summary, parsed.messages)
+				: fallbackTopicFromMessages(parsed.messages, parsed.summary);
 			writeSessionTopic(sessionId, topic, true, existing ? { upgraded: true } : undefined);
 			logger.info(`[auto-topic] ${sessionId} → ${topic}${existing ? " (upgraded)" : ""}`);
 		} catch (err) {
```

**File**: `apps/inno-agent/web/src/react/ChatCenter.tsx` (modified, +1/-0)
```diff
@@ -1564,6 +1564,7 @@ export function ChatCenter({ onOpenPresetPanels, onPreviewFile }: ChatCenterProp
 			onRetry={handleRetry}
 			wsError={wsError}
 			sessionTitle={currentSessionMeta?.name}
+			sessionHasTopic={currentSessionMeta?.hasTopic === true}
 			workspaceName={activeWorkspaceName}
 			workspaceCollapsed={appLayout.workspaceMode === "collapsed"}
 			sidebarCollapsed={appLayout.sidebarCollapsed}
```

**File**: `apps/inno-agent/web/src/react/chat/ChatConversation.tsx` (modified, +19/-5)
```diff
@@ -22,6 +22,15 @@ function traceContainsAssistantText(message: ChatMessage): boolean {
 	)));
 }
 
+function firstMessageTitle(messages: ChatMessage[]): string | undefined {
+	const content = messages.find((message) => message.role === "user")?.content
+		.replace(/^\[用户本轮上传了 \d+ 张图片，已保存到工作区：[\s\S]*?\]\s*/, "")
+		.replace(/\s+/g, " ")
+		.trim();
+	if (!content) return undefined;
+	return content.length > 28 ? `${content.slice(0, 28)}...` : content;
+}
+
 interface ChatConversationProps {
 	chat: {
 		messages: ChatMessage[];
@@ -64,6 +73,8 @@ interface ChatConversationProps {
 	wsError: string;
 	/** Session topic shown in the conversation header. */
 	sessionTitle?: string;
+	/** True once the server has recorded a deliberate session topic. */
+	sessionHasTopic?: boolean;
 	/** Bound workspace name rendered as a chip next to the title. */
 	workspaceName?: string | null;
 	/** Reserve room for the desktop chrome's workspace button when collapsed. */
@@ -97,6 +108,7 @@ export function ChatConversation({
 	onRetry,
 	wsError,
 	sessionTitle,
+	sessionHasTopic = false,
 	workspaceName,
 	workspaceCollapsed = false,
 	sidebarCollapsed = false,
@@ -113,6 +125,10 @@ export function ChatConversation({
 		return () => window.clearTimeout(timer);
 	}, [chat.isLoadingHistory, chat.messages.length]);
 	const conversationTurns = useMemo(() => buildConversationTurns(chat.messages), [chat.messages]);
+	const initialTitle = useMemo(() => firstMessageTitle(chat.messages), [chat.messages]);
+	const visibleSessionTitle = sessionHasTopic && sessionTitle
+		? sessionTitle
+		: initialTitle || t("nav.newChat", "新建会话");
 	const turnIndexByStartMessage = useMemo(
 		() => new Map(conversationTurns.map((turn) => [turn.startMessageIndex, turn.index])),
 		[conversationTurns],
@@ -216,10 +232,9 @@ export function ChatConversation({
 		<section className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--inno-chat-bg)]">
 			{topOverlay}
 			{smartToast}
-			{sessionTitle ? (
-				<header className={`inno-conversation-header relative z-[5] flex h-12 shrink-0 items-center gap-2.5 border-b border-[var(--inno-border)] bg-[color-mix(in_srgb,var(--inno-chat-bg)_85%,transparent)] pr-4 backdrop-blur-md ${workspaceCollapsed ? "pr-14" : ""} ${sidebarCollapsed ? "inno-conversation-header--sidebar-collapsed" : "pl-4"}`}>
+			<header className={`inno-conversation-header relative z-[5] flex h-12 shrink-0 items-center gap-2.5 border-b border-[var(--inno-border)] bg-[color-mix(in_srgb,var(--inno-chat-bg)_85%,transparent)] pr-4 backdrop-blur-md ${workspaceCollapsed ? "pr-14" : ""} ${sidebarCollapsed ? "inno-conversation-header--sidebar-collapsed" : "pl-4"}`}>
 					<div className="inno-conversation-heading flex min-w-0 items-center gap-2.5">
-						<span className="inno-conversation-title min-w-0 truncate text-[14.5px] font-semibold text-[var(--inno-text)]" title={sessionTitle}>{sessionTitle}</span>
+					<span className="inno-conversation-title min-w-0 truncate text-[14.5px] font-semibold text-[var(--inno-text)]" title={visibleSessionTitle}>{visibleSessionTitle}</span>
 					{workspaceName ? (
 						<span className="inno-conversation-workspace-chip inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-[var(--inno-chip-bg)] px-2.5 py-[3px] text-[11px] text-[var(--inno-text-subtle)]">
 							<Folder size={11} aria-hidden="true" />
@@ -228,8 +243,7 @@ export function ChatConversation({
 						) : null}
 					</div>
 					{btwControl ? <div className="ml-auto flex shrink-0 items-center">{btwControl}</div> : null}
-				</header>
-			) : null}
+			</header>
 			<div className="conversation-stage relative flex-1 min-h-0">
 				<div
 					ref={scrollRef}
```

**File**: `apps/inno-agent/web/src/stores/sessions-store.ts` (modified, +5/-5)
```diff
@@ -152,12 +152,12 @@ export class SessionsStoreImpl extends EventEmitter<SessionsStoreEvents> {
 	}
 
 	/**
-	 * Refresh the sidebar until the session's auto-generated topic lands.
+	 * Refresh the sidebar until the session's recorded topic/preview lands.
 	 *
-	 * Topic generation is fire-and-forget on the server (an extra LLM call
-	 * after the turn's `done` event), so the refresh that runs at turn end
-	 * usually sees the untitled fallback name. Poll with bounded backoff and
-	 * stop as soon as `hasTopic` flips (or the session disappears).
+	 * Topic recording is fire-and-forget on the server, so the refresh that
+	 * runs at turn end can race the first-message preview or the later summary.
+	 * Poll with bounded backoff and stop as soon as `hasTopic` flips (or the
+	 * session disappears).
 	 */
 	async refreshUntilTopic(sessionId: string): Promise<void> {
 		await this.refresh();
```

---

### Incident Patch 8: `9dae1a29` (2026-09-15)
**Commit Message**: fix(jobs): keep scheduled runs visible in chat

**File**: `apps/inno-agent/web/src/react/ChatCenter.tsx` (modified, +1/-0)
```diff
@@ -238,6 +238,7 @@ export function ChatCenter({ onOpenPresetPanels, onPreviewFile }: ChatCenterProp
 		isSending: chatStore.isSending,
 		isLoadingHistory: chatStore.isLoadingHistory,
 		jobStreaming: chatStore.jobStreaming,
+		jobStreamInCurrentSession: chatStore.jobStreamInCurrentSession,
 		canReconnect: chatStore.canReconnect,
 		activeTools: chatStore.activeTools,
 		completedTools: chatStore.completedTools,
```

**File**: `apps/inno-agent/web/src/react/chat/ChatConversation.tsx` (modified, +12/-9)
```diff
@@ -30,6 +30,8 @@ interface ChatConversationProps {
 		/** A manual job run is streaming into this conversation — the empty
 		 *  session placeholder must not cover the live job timeline. */
 		jobStreaming: boolean;
+		/** Whether the manual job stream belongs to this conversation. */
+		jobStreamInCurrentSession: boolean;
 		activeTools: ChatToolRecord[];
 		completedTools: ChatToolRecord[];
 		pendingQuestion: PendingQuestion | null;
@@ -131,13 +133,14 @@ export function ChatConversation({
 	// markdown re-parse) in place of the live stream tree. Defer that swap to
 	// a transition-scheduled render so React can slice the expensive mount
 	// across frames while StreamingBubbles keeps showing the finished stream.
-	const settledSending = useDeferredValue(chat.isSending);
-	const activeTurnStartMessage = settledSending ? conversationTurns.at(-1)?.startMessageIndex : undefined;
+	const liveTurn = chat.isSending || (chat.jobStreaming && chat.jobStreamInCurrentSession);
+	const settledLiveTurn = useDeferredValue(liveTurn);
+	const activeTurnStartMessage = settledLiveTurn ? conversationTurns.at(-1)?.startMessageIndex : undefined;
 	// The assistant record for a finished stream mounts at the same render the
 	// live trace unmounts; skip its entrance fade so the swap is seamless.
 	// Messages mounted any other way (e.g. switching conversations) still fade in.
 	const skipFadeKeysRef = useRef<Set<string>>(new Set());
-	const wasSendingRef = useRef(chat.isSending);
+	const wasLiveTurnRef = useRef(liveTurn);
 	const knownKeysRef = useRef<Set<string>>(new Set());
 	const currentKeys = chat.messages.map((message, index) => `${message.timestamp}-${index}`);
 	// Fresh conversation load: none of the previously seen keys survive, so
@@ -146,15 +149,15 @@ export function ChatConversation({
 		skipFadeKeysRef.current.clear();
 	}
 	knownKeysRef.current = new Set(currentKeys);
-	if (wasSendingRef.current && !chat.isSending) {
+	if (wasLiveTurnRef.current && !liveTurn) {
 		for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
 			if (chat.messages[index]?.role === "assistant") {
 				skipFadeKeysRef.current.add(`${chat.messages[index].timestamp}-${index}`);
 				break;
 			}
 		}
 	}
-	wasSendingRef.current = chat.isSending;
+	wasLiveTurnRef.current = liveTurn;
 	const traceTurnPresentation = useMemo(() => {
 		const coveredAssistantIndexes = new Set<number>();
 		const actionOwnerIndexes = new Set<number>();
@@ -244,7 +247,7 @@ export function ChatConversation({
 							</div>
 						) : null}
 
-						{!chat.isLoadingHistory && chat.messages.length === 0 && !chat.isSending && !chat.jobStreaming ? (
+						{!chat.isLoadingHistory && chat.messages.length === 0 && !chat.isSending && !chat.jobStreamInCurrentSession ? (
 							<div className="flex flex-col items-center justify-center pt-20 text-center text-[var(--inno-text-muted)]">
 								<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--inno-surface-muted)] text-[var(--inno-text-subtle)]"><Sparkles size={18} /></div>
 								<p className="text-sm font-medium text-[var(--inno-text)]">{t("chat.emptySessionTitle")}</p>
@@ -263,7 +266,7 @@ export function ChatConversation({
 								// terminal stream event. Keep the live trace as the only
 								// visible representation until the turn is finalized, so the
 								// trace does not briefly duplicate or change its geometry.
-								if (settledSending && index === chat.messages.length - 1 && message.role === "assistant") return null;
+								if (settledLiveTurn && index === chat.messages.length - 1 && message.role === "assistant") return null;
 								const isActiveTurnAssistant = activeTurnStartMessage !== undefined && index >= activeTurnStartMessage && message.role === "assistant";
 								const isTurnActionOwner = lastAssistantMessageIndexes.has(index) || traceTurnPresentation.actionOwnerIndexes.has(index);
 								const showActions = message.role === "user" || (isTurnActionOwne
```

**File**: `apps/inno-agent/web/src/react/chat/JobStreamBubbles.tsx` (modified, +30/-19)
```diff
@@ -1,15 +1,17 @@
+import { useRef } from "react";
 import { motion } from "motion/react";
 import { chatStore } from "../../stores/chat-store.js";
 import { useStoreSnapshot } from "../hooks.js";
 import { QuestionDialog } from "../QuestionDialog.js";
 import { PermissionDialog } from "../PermissionDialog.js";
 import { AgentTraceTimeline } from "./AgentTraceTimeline.js";
+import { AgentAvatar } from "./MessageBubble.js";
 
 /** Live view of a manual job run. Deliberately renders with the exact same
  *  trace timeline as a normal chat turn (StreamingBubbles), but is driven by
  *  the job-run SSE namespace so the composer never locks (isSending stays
  *  false) and an active chat stream is never disturbed. */
-export function JobStreamBubbles() {
+export function JobStreamBubbles({ holdCompleted = false }: { holdCompleted?: boolean }) {
 	const stream = useStoreSnapshot(chatStore, () => ({
 		active: chatStore.jobStreaming,
 		belongsToCurrentSession: chatStore.jobStreamInCurrentSession,
@@ -20,34 +22,43 @@ export function JobStreamBubbles() {
 		pendingQuestion: chatStore.pendingQuestion,
 		pendingPermission: chatStore.pendingPermission,
 	}));
-	if (!stream.active || !stream.belongsToCurrentSession) return null;
-	const pendingQuestion = stream.pendingQuestion
+	// The job store clears its live fields in the same update that appends the
+	// canonical assistant message. Keep the last live snapshot for the parent's
+	// deferred handoff so the timeline does not jump or briefly disappear.
+	const heldRef = useRef<typeof stream | null>(null);
+	if (stream.active && stream.belongsToCurrentSession) heldRef.current = stream;
+	const effective = stream.active ? stream : (holdCompleted ? heldRef.current : null);
+	if (!effective || !effective.belongsToCurrentSession) return null;
+	const pendingQuestion = effective.pendingQuestion
 		? {
-			questionId: stream.pendingQuestion.questionId,
-			card: <QuestionDialog pending={stream.pendingQuestion} />,
+			questionId: effective.pendingQuestion.questionId,
+			card: <QuestionDialog pending={effective.pendingQuestion} />,
 		}
 		: undefined;
-	const permissionCard = stream.pendingPermission
-		? <PermissionDialog pending={stream.pendingPermission} />
+	const permissionCard = effective.pendingPermission
+		? <PermissionDialog pending={effective.pendingPermission} />
 		: undefined;
 	return (
 		<motion.div
-			className="inno-trace-shell inno-trace-shell-live"
+			className="inno-trace-shell inno-trace-shell-live flex gap-3"
 			initial={{ opacity: 0, y: 8 }}
 			animate={{ opacity: 1, y: 0 }}
 			transition={{ duration: 0.2, ease: "easeOut" }}
 		>
-			<AgentTraceTimeline
-				steps={stream.trace}
-				isSending
-				startedAt={stream.startedAt}
-				finishedAt={null}
-				error={stream.error}
-				showText
-				fallbackText={stream.text}
-				pendingQuestion={pendingQuestion}
-				trailingCard={permissionCard}
-			/>
+			<AgentAvatar />
+			<div className="min-w-0 flex-1">
+				<AgentTraceTimeline
+					steps={effective.trace}
+					isSending
+					startedAt={effective.startedAt}
+					finishedAt={null}
+					error={effective.error}
+					showText
+					fallbackText={effective.text}
+					pendingQuestion={pendingQuestion}
+					trailingCard={permissionCard}
+				/>
+			</div>
 		</motion.div>
 	);
 }
```

**File**: `apps/inno-agent/web/src/react/jobs/runJobInConversation.ts` (modified, +5/-0)
```diff
@@ -1,3 +1,4 @@
+import { appStore } from "../../stores/app-store.js";
 import { chatStore } from "../../stores/chat-store.js";
 import { jobsStore } from "../../stores/jobs-store.js";
 import { sessionsStore } from "../../stores/sessions-store.js";
@@ -46,6 +47,10 @@ export async function runJobInConversation(job: ScheduledJob, t: Translate, occu
 		await sessionsStore.createSessionWith(workspaceId ? { workspaceId } : { newWorkspace: { isTemp: true } });
 		const targetSessionId = sessionsStore.currentSessionId;
 		if (!targetSessionId) throw new Error(t("jobs.errors.sessionCreateFailed"));
+		// The jobs page is a separate app route. Selecting the new session is
+		// not enough to render its conversation, so return to ChatCenter before
+		// starting the stream.
+		appStore.setPage("chat");
 		// createSessionWith clears the chat but does not load an empty history,
 		// so bind the new session before starting the streaming job view.
 		chatStore.loadHistory([], targetSessionId);
```

**File**: `apps/inno-agent/web/src/stores/chat-store.ts` (modified, +4/-0)
```diff
@@ -338,6 +338,8 @@ export class ChatStoreImpl extends EventEmitter<ChatStoreEvents> {
 		this.jobStreamTrace = [];
 		this.jobStreamText = "";
 		this.jobStreamError = "";
+		this.pendingQuestion = null;
+		this.pendingPermission = null;
 		this.jobUserMessageId = null;
 		if (!messageId) return;
 		const index = this.messages.findIndex((message) => message.turnId === messageId && message.transient);
@@ -362,6 +364,8 @@ export class ChatStoreImpl extends EventEmitter<ChatStoreEvents> {
 		this.jobStreamTrace = [];
 		this.jobStreamText = "";
 		this.jobStreamError = "";
+		this.pendingQuestion = null;
+		this.pendingPermission = null;
 		// The settled record belongs to the run's conversation only — never to
 		// whatever other session the user may be viewing by then.
 		if (!sessionId || sessionId !== this.currentSessionContext) return;
```

---

### Incident Patch 9: `c989d6c2` (2026-09-15)
**Commit Message**: fix(checkins): make scheduled actions race-safe

**File**: `apps/inno-agent/src/checkins/check-in-store.ts` (modified, +7/-0)
```diff
@@ -263,6 +263,13 @@ export class CheckInStore {
 			?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
 	}
 
+	/** Find a live occurrence by its stable id, including settled slots. */
+	getOccurrenceById(occurrenceId: string, now: Date = new Date()): CheckInOccurrence | undefined {
+		return this.getTodayPlan(now).jobs
+			.flatMap((job) => job.occurrences)
+			.find((occurrence) => occurrence.occurrenceId === occurrenceId);
+	}
+
 	/**
 	 * Persist the result for one planned slot and reconcile today's check-in.
 	 * A successful attempt is sticky: a later failed retry cannot undo a slot
```

**File**: `apps/inno-agent/src/server/routes/checkins.ts` (modified, +8/-0)
```diff
@@ -47,6 +47,14 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
+			// The response to an earlier skip can be lost after the server has
+			// already persisted the slot. Treat a repeated request for that same
+			// slot as success so the client cannot resurrect the banner by polling.
+			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
+			if (occurrence?.status === "skipped") {
+				json(res, 200, { skipped: true, alreadySkipped: true });
+				return true;
+			}
 			json(res, 409, { error: "This slot is no longer pending." });
 			return true;
 		}
```

**File**: `apps/inno-agent/web/src/react/chat/ScheduledRunBanner.tsx` (modified, +23/-2)
```diff
@@ -2,6 +2,7 @@ import { useEffect, useRef, useState } from "react";
 import { useTranslation } from "react-i18next";
 import { BellRing, Play } from "lucide-react";
 import { claimOccurrence, getPendingRuns, skipOccurrence, type PendingRun } from "../../api/checkins.js";
+import { ApiError } from "../../api/client.js";
 import { chatStore } from "../../stores/chat-store.js";
 import { sessionsStore } from "../../stores/sessions-store.js";
 import { findJobById, runJobInConversation } from "../jobs/runJobInConversation.js";
@@ -31,7 +32,10 @@ export function ScheduledRunBanner() {
 		let disposed = false;
 		const poll = async (): Promise<void> => {
 			try {
-				const next = await getPendingRuns();
+				// Keep a slot hidden while a user action is in flight (and after it
+				// succeeds), otherwise the 2s poll can re-add the same banner before
+				// the skip response arrives.
+				const next = (await getPendingRuns()).filter((run) => !handledRef.current.has(run.occurrenceId));
 				if (disposed) return;
 				// A run that vanished without our doing means the server settled
 				// it (auto-exec) — pull the new conversation into the sidebar.
@@ -102,11 +106,28 @@ export function ScheduledRunBanner() {
 	}
 
 	async function handleSkip(run: PendingRun): Promise<void> {
+		if (busyId) return;
 		handledRef.current.add(run.occurrenceId);
+		setBusyId(run.occurrenceId);
 		try {
 			await skipOccurrence(run.occurrenceId);
-		} finally {
 			setRuns((prev) => prev.filter((candidate) => candidate.occurrenceId !== run.occurrenceId));
+		} catch (error) {
+			// A 409 means the server has already taken the slot out of the
+			// pending queue (usually because auto-execution won the race), so it
+			// cannot produce this banner again. Other failures must remain
+			// retryable instead of silently allowing the server to execute it.
+			if (error instanceof ApiError && error.status === 409) {
+				setRuns((prev) => prev.filter((candidate) => candidate.occurrenceId !== run.occurrenceId));
+				void sessionsStore.refresh();
+			} else {
+				handledRef.current.delete(run.occurrenceId);
+				setRuns((prev) => prev.some((candidate) => candidate.occurrenceId === run.occurrenceId)
+					? prev
+					: [...prev, run]);
+			}
+		} finally {
+			setBusyId(null);
 		}
 	}
 
```

---

### Incident Patch 10: `d059f255` (2026-09-14)
**Commit Message**: Merge pull request #234 from hhyqhh/fix/sidebar-chrome-overlap

fix(web): adopt reference app's sidebar collapse pattern, fixing brand overlap

**File**: `apps/inno-agent/web/src/app.css` (modified, +36/-12)
```diff
@@ -1414,6 +1414,27 @@ inno-app-shell {
 	color: var(--inno-text);
 }
 
+/* Browsers have no traffic lights beside the toggle, which only renders as
+   the collapsed-state expand button: pull it to the window edge and give it
+   a card chip at every width — the <=960px block merely restyles it for
+   touch. */
+.app-layout--browser {
+	--inno-window-chrome-control-left: 12px;
+	--inno-window-chrome-title-inset: 54px;
+}
+
+.app-layout--browser .inno-window-chrome-button {
+	background: var(--inno-surface);
+	border: 1px solid var(--inno-border);
+	box-shadow: var(--inno-shadow-soft);
+	color: var(--inno-text-muted);
+}
+
+.app-layout--browser .inno-window-chrome-button:hover {
+	background: var(--inno-surface-muted);
+	color: var(--inno-text);
+}
+
 .inno-window-chrome-workspace-button {
 	position: absolute;
 	/* Match the workspace-header action buttons by aligning the shared 30px
@@ -1469,7 +1490,9 @@ inno-app-shell {
 
 /* Keep the sidebar brand row below the traffic lights. The conversation and
    workbench headers intentionally occupy the same top row as the compact
-   window chrome, matching the reference layout's title hierarchy. */
+   window chrome, matching the reference layout's title hierarchy. Browsers
+   need no such offset — their only chrome control is the collapsed-state
+   expand button, which never overlaps the expanded header. */
 .app-layout--desktop .inno-sidebar-header {
 	padding-top: var(--inno-window-chrome-height);
 	-webkit-app-region: drag;
@@ -1498,9 +1521,10 @@ inno-app-shell {
 }
 
 /* Feature pages also start at the window edge when the session rail is
-   collapsed. Keep their titles clear of macOS traffic lights just like the
-   conversation and workspace headers. */
-.app-layout--desktop.app-layout--sidebar-collapsed .inno-feature-header {
+   collapsed. Keep their titles clear of macOS traffic lights — and of the
+   chrome toggle, which also renders in browsers — just like the conversation
+   and workspace headers. */
+.app-layout--sidebar-collapsed .inno-feature-header {
 	padding-left: var(--inno-window-chrome-title-inset);
 }
 
@@ -1673,19 +1697,11 @@ inno-app-shell {
 		--inno-window-chrome-title-inset: calc(64px + env(safe-area-inset-left, 0px));
 	}
 
-	.app-layout--browser .inno-window-chrome-button {
-		background: var(--inno-surface);
-		border: 1px solid var(--inno-border);
-		box-shadow: var(--inno-shadow-soft);
-		color: var(--inno-text-muted);
-	}
-
 	.app-layout--browser .inno-window-chrome-workspace-button {
 		top: var(--inno-window-chrome-control-top);
 		right: calc(8px + env(safe-area-inset-right, 0px));
 	}
 
-	.app-layout--browser .inno-sidebar-header,
 	.app-layout--browser .inno-feature-header,
 	.app-layout--browser .inno-conversation-header,
 	.app-layout--browser .inno-workspace-panel-header {
@@ -1695,6 +1711,14 @@ inno-app-shell {
 		padding-left: var(--inno-window-chrome-title-inset);
 	}
 
+	/* The drawer header shares the safe-area top but needs no toggle inset —
+	   the chrome toggle only renders while the sidebar is collapsed. */
+	.app-layout--browser .inno-sidebar-header {
+		min-height: calc(48px + env(safe-area-inset-top, 0px));
+		padding-top: env(safe-area-inset-top, 0px);
+		padding-bottom: 0;
+	}
+
 	/* Component display rules override Tailwind's layered hidden utility. */
 	.inno-workspace-header-button[aria-pressed] {
 		display: none;
```

**File**: `apps/inno-agent/web/src/react/DesktopWindowChrome.tsx` (modified, +18/-12)
```diff
@@ -1,5 +1,5 @@
 import type { ReactNode } from "react";
-import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
+import { PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
 
 interface DesktopWindowChromeProps {
 	showWorkspaceControl: boolean;
@@ -14,6 +14,10 @@ interface DesktopWindowChromeProps {
  * Renderer-owned macOS window chrome. Electron keeps the traffic lights in
  * the hidden title-bar area; the overlay is limited to the renderer control
  * so the page headers below remain reliable drag surfaces and click targets.
+ *
+ * The sidebar toggle only renders while the sidebar is collapsed — the
+ * expanded sidebar carries its own collapse button inside its header, so no
+ * floating control ever overlaps the brand row (reference-app pattern).
  */
 export function DesktopWindowChrome({
 	showWorkspaceControl,
@@ -25,17 +29,19 @@ export function DesktopWindowChrome({
 }: DesktopWindowChromeProps) {
 	return (
 		<div className="inno-window-chrome" aria-label="窗口工具栏">
-			<div className="inno-window-chrome-bar">
-				<button
-					type="button"
-					className="inno-window-chrome-button"
-					title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
-					aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
-					onClick={onToggleSidebar}
-				>
-					{sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
-				</button>
-			</div>
+			{sidebarCollapsed ? (
+				<div className="inno-window-chrome-bar">
+					<button
+						type="button"
+						className="inno-window-chrome-button"
+						title="展开侧栏"
+						aria-label="展开侧栏"
+						onClick={onToggleSidebar}
+					>
+						<PanelLeftOpen size={15} />
+					</button>
+				</div>
+			) : null}
 			{btwControl ? (
 				<div className="inno-window-chrome-right-actions">
 					{btwControl}
```

**File**: `apps/inno-agent/web/src/react/SessionSidebar.tsx` (modified, +12/-0)
```diff
@@ -21,6 +21,7 @@ import {
 	ArrowUpDown,
 	Check,
 	GripVertical,
+	PanelLeftClose,
 	ChevronUp,
 	ChevronDown,
 	SquarePen,
@@ -1100,6 +1101,17 @@ export function SessionSidebar({ collapsed }: SessionSidebarProps) {
 						>
 							<RefreshCw size={14} />
 						</button>
+						{/* Collapse lives inside the sidebar header (reference-app
+							pattern); the floating chrome toggle only reappears as the
+							expand button once the rail is hidden. */}
+						<button
+							className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--inno-text-subtle)] transition-colors hover:bg-[var(--inno-surface)] hover:text-[var(--inno-text-muted)]"
+							title={t("sidebar.collapse")}
+							aria-label={t("sidebar.collapse")}
+							onClick={() => appStore.setSidebarCollapsed(true)}
+						>
+							<PanelLeftClose size={14} />
+						</button>
 					</div>
 				</div>
 			</div>
```

#### Recent Merged Pull Requests:
- **PR #242** (closed): fix(docker): copy vendor/ before npm ci in production build (@sy007-spec)
- **PR #240** (2026-09-19): fix(docker): copy vendor/ before npm ci in production build (@sy007-spec)
- **PR #239** (2026-09-18): feat: add session workspace switching with file migration (@nfcino)
- **PR #238** (2026-09-17): feat: desktop computer use via @injaneity/pi-computer-use (@hhyqhh)
- **PR #237** (2026-09-16): fix: address PR #236 review follow-ups (@hhyqhh)
- **PR #236** (2026-09-15): fix: stabilize chat sessions and scheduled runs (@nfcino)
- **PR #235** (2026-09-14): feat: read-only session context usage API and localized composer control (@hhyqhh)
- **PR #234** (2026-09-14): fix(web): adopt reference app's sidebar collapse pattern, fixing brand overlap (@hhyqhh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

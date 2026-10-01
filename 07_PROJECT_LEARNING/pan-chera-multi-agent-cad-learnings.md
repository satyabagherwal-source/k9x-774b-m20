# Forensic Learning Record (Deep Inspection): Pan-Chera/Multi-Agent-CAD

> **Canonical Artifact**: `07_PROJECT_LEARNING/pan-chera-multi-agent-cad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Pan-Chera/Multi-Agent-CAD](https://github.com/Pan-Chera/Multi-Agent-CAD))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T00:03:15.793Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Pan-Chera/Multi-Agent-CAD`
- **Description**: MAC (Multi-Agent CAD): A decoupled multi-agent framework for text-to-CAD generation via constrained test-time compute
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1013 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `legacy_refs/check_mesh.py`
```
#!/usr/bin/env python3
"""
3D支架模型分析工具 —— 将STL/OBJ/STEP等3D模型转换为AI可理解的自然语言报告。

功能模块：
  1. 精确尺寸分析 —— 包围盒、壁厚、截面分析
  2. 孔洞分析 —— 通孔/盲孔检测、孔距、边距
  3. 结构特征分析 —— 质心、惯性矩、锐边检测、加强筋
  4. 对称性与拓扑分析 —— 对称检测、结构类型推断
  5. 可制造性评估 —— 3D打印、CNC、材料适配
  6. 规格对比 —— 与目标尺寸/公差对比

用法:
  python check_mesh.py <模型文件>                    # 默认 JSON 输出
  python check_mesh.py <模型文件> --format markdown  # 详细中文报告
  python check_mesh.py <模型文件> --spec spec.json   # 规格对比
  python check_mesh.py --generate l_bracket -o test.stl  # 生成测试模型
"""

import trimesh
import numpy as np
import json
import sys
import os
import argparse
import warnings
from collections import defaultdict

# 屏蔽 trimesh 的冗余警告
warnings.filterwarnings("ignore", category=UserWarning)

# ============================================================================
#  工程标准常量
# ============================================================================

# 标准螺纹孔映射表（ISO公制粗牙）
# 格式: { 螺丝规格: (螺丝公称直径, 紧配孔径, 松配孔径, 沉头孔直径, 沉头角度) }
STANDARD_HOLE_CLEARANCES = {
    "M2":   {"screw_dia": 2.0, "tight_fit": 2.2, "loose_fit": 2.4, "countersink_dia": 4.0, "countersink_angle": 90},
    "M2.5": {"screw_dia": 2.5, "tight_fit": 2.7, "loose_fit": 3.0, "countersink_dia": 5.0, "countersink_angle": 90},
    "M3":   {"screw_dia": 3.0, "tight_fit": 3.2, "loose_fit": 3.4, "countersink_dia": 6.0, "countersink_angle": 90},
    "M4":   {"screw_dia": 4.0, "tight_fit": 4.2, "loose_fit": 4.5, "countersink_dia": 8.0, "countersink_angle": 90},
    "M5":   {"screw_dia": 5.0, "tight_fit": 5.3, "loose_fit": 5.5, "countersink_dia": 10.0, "countersink_angle": 90},
    "M6":   {"screw_dia": 6.0, "tight_fit": 6.4, "loose_fit": 6.6, "countersink_dia": 12.0, "countersink_angle": 90},
    "M8":   {"screw_dia": 8.0, "tight_fit": 8.4, "loose_fit": 9.0, "countersink_dia": 16.0, "countersink_angle": 90},
    "M10":  {"screw_dia": 10.0, "tight_fit": 10.5, "loose_fit": 11.0, "countersink_dia": 20.0, "countersink_angle": 90},
    "M12":  {"screw_dia": 12.0, "tight_fit": 13.0, "loose_fit": 13.5, "countersink_dia": 24.0, "countersink_angle": 90},
}


def lookup_standard_hole(screw_spec):
    """
    查询标准孔径。支持 "M3", "M4紧配", "M5松配" 等格式。
    返回建议的孔径和说明。
    """
    # 解析规格
    import re
    match = re.match(r'(M\d+(?:\.\d+)?)\s*(紧配|松配|沉头)?', screw_spec)
    if not match:
        return None
    screw_size = match.group(1)
    fit_type = match.group(2) or "默认"

    std = STANDARD_HOLE_CLEARANCES.get(screw_size)
    if not std:
        return None

    if fit_type in ("沉头",):
        return {
            "screw": screw_size,
            "recommended_hole_dia_mm": std["tight_fit"],
            "countersink_top_dia_mm": std["countersink_dia"],
            "countersink_angle_deg": std["countersink_angle"],
            "fit": "沉头孔",
            "note": f"通孔直径 {std['tight_fit']}mm + 沉头孔 {std['countersink_dia']}mm×{std['countersink_angle']}°",
        }
    if fit_type == "紧配" or fit_type == "默认":
        dia = std["tight_fit"]
        label = "紧配（定位孔）"
    else:
        dia = std["loose_fit"]
        label = "松配（自由孔）"

    return {
        "screw": screw_size,
        "recommended_hole_dia_mm": dia,
        "fit": label,
        "note": f"{screw_size}螺丝{label}建议孔径 {dia}mm",
    }


def load_feature_measurements(iteration=0, filename=None):
    """
    加载白盒插桩法生成的特征测量数据。

    这些测量是在布尔合并之前对独立特征的精确测量，
    避免了从合并后的 STEP 文件中逆向猜测特征的问题。

    Args:
        iteration: 迭代次数，用于定位 temp_measurements_{iteration}.json
        filename: 可选的自定义文件名

    Returns:
        dict: 特征测量数据，如果文件不存在则返回空字典
    """
    if filename is None:
        filename = f"temp_measurements_{iteration}.json"

    if not os.path.exists(filename):
        return {}

    try:
        with open(filename, 'r', encoding='utf-8') as f:
            measurements = json.load(f)
        return measurements
    except Exception as e:
        print(f"[WARNING] 无法加载特征测量文件 {filename}: {e}", file=sys.stderr)
        return {}


# ============================================================================
#  工具函数
# ============================================================================

def _load_mesh(file_path):
    """统一加载模型，处理 Scene 和单网格两种情况。"""
    obj = trimesh.load(file_path, force='mesh')
    if isinstance(obj, trimesh.Scene):
        geoms = list(obj.geometry.values())
        if not geoms:
            raise ValueError("场景为空或无法解析。")
        mesh = trimesh.util.concatenate(geoms)
    elif isinstance(obj, trimesh.Trimesh):
        mesh = obj
    else:
        raise TypeError(f"不支持的文件类型: {type(obj)}")
    # 合并重复顶点，修复法线
    mesh.merge_vertices()
    mesh.fix_normals()
    return mesh


def _safe_round(val, ndigits=2):
    """安全四舍五入，处理 None 和数组。"""
    if val is None:
        return None
    try:
        return round(float(val), ndigits)
    except (TypeError, ValueError):
        return val


def _vec3_to_list(v):
    """将 (3,) numpy 数组转为 [x, y, z] 列表。"""
    if v is None:
        return None
    return [_safe_round(x, 3) for x in np.asarray(v).flatten()[:3]]


def _estimate_mesh_resolution(mesh):
    """
    估算网格的实际分辨率（mm），即测量可靠性的下限。

    策略：分离"特征边"（短边，来自圆柱孔/圆角的多边形逼近）
    和"结构边"（长边，来自平面三角剖分）。用特征边的典型长度
    作为分辨率指标——因为孔、圆角等曲面特征决定了尺寸测量的精度瓶颈。

    返回: { resolution_mm, max_theoretical_error_mm, recommendation }
    """
    try:
        edges = mesh.edges_unique
        edge_lengths = np.linalg.norm(
            mesh.vertices[edges[:, 0]] - mesh.vertices[edges[:, 1]], axis=1
        )
        if len(edge_lengths) < 10:
            return {"resolution_mm": 0.1, "max_theoretical_error_mm": 0.15, "recommendation": "网格太简单，按默认精度处理。"}

        # 第5百分位：最短的5%边 → 特征分辨率（圆柱面、圆角等）
        p05 = float(np.percentile(edge_lengths, 5))
        # 第95百分位：最长的5%边 → 结构尺度（大平面三角剖分）
        p95 = float(np.percentile(edge_lengths, 95))
        # 中位数
        p50 = float(np.median(edge_lengths))

        # 用第5百分位作为真实特征分辨率
        feature_resolution = p05

        # 合理性检查：如果特征分辨率太接近结构尺度，说明模型可能没有曲面特征
        if feature_resolution > p50 * 0.5:
            feature_resolution = min(feature_resolution, 0.5)

        # 噪声阈值 = 特征边长（多边形逼近的最大理论偏差 ≈ 弦长本身）
        # 对于直径测量来说，实际偏差通常是特征边长的 0.5~1.5 倍
        if feature_resolution < 0.1:
            level = "fine"
            max_error = 0.10
            rec = "网格精度充足（angular_deflection<0.05 级别），测量值可信。"
        elif feature_resolution < 0.25:
            level = "good"
            max_error = 0.20
            rec = "网格精度良好（angular_deflection≈0.1 级别），直径测量误差约 ±0.15~0.2mm。"
        elif feature_resolution < 0.6:
            level = "coarse"
            max_error = 0.35
            rec = "网格偏粗（angular_deflection>0.5），直径测量误差可达 ±0.35mm。建议降低 angular_deflection。"
        else:
            level = "very_coarse"
            max_error = 0.5
            rec = "曲面特征分辨率 >0.6mm，圆孔测量值不精确，强烈建议设置 angular_deflection<=0.1。"

        return {
            "resolution_mm": _safe_round(feature_resolution, 3),
            "p50_edge_mm": _safe_round(p50, 3),
            "p95_edge_mm": _safe_round(p95, 3),
            "max_theoretical_error_mm": _safe_round(min(max_error, 0.5), 2),
            "level": level,
            "recommendation": rec,
        }
    except Exception:
        return {"resolution_mm": None, "max_theoretical_error_mm": None, "level": "unknown"}


def _check_connectivity(mesh):
    """
    拓扑连通性检查——检测STL是否包含多个分离的独立网格块。

    如果部件之间没有正确 union（如底板和侧板之间有缝隙），
    导出的STL会包含多个互不连接的网格块，切片打印时会散架。
    这是一个致命错误，必须反馈给AI。

    使用 Union-Find 算法检测连通分量，不依赖 networkx。

    返回: { is_single_body, body_count, body_volumes, is_fatal, message }
    """
    try:
        n_faces = len(mesh.faces)
        if n_faces == 0:
            return {"is_single_body": True, "body_count": 0,
                    "is_fatal": False, "message": "Empty mesh"}

        # --- Union-Find on face adjacency (no networkx needed) ---
        parent = list(ra
```

### Core Architecture Module: `mac_assembly/__init__.py`
```
"""mac_assembly -- multi-agent assembly pipeline on top of MAC.

Reuses:
* the single-part MAC pipeline (``multi_agent_cad``) verbatim as the
  structural part generator;
* CAD Skills' ``cadpy.assembly.AssemblyHelper`` + positioning philosophy
  (mates as semantic relationships, fixed-first, named datums);
* MAC's LLM client, JSON retry, render views, token tracker, and the
  QA-Judge anti-hallucination pattern.

Entry point::

    python -m mac_assembly
"""


def __getattr__(name: str):
    # Lazy re-exports: keep `python -m mac_assembly._part_runner` light
    # (it must not pull langgraph / the assembly nodes).
    if name in ("build_assembly_graph", "get_initial_state", "main"):
        from mac_assembly import graph_assembly

        return getattr(graph_assembly, name)
    raise AttributeError(name)


__all__ = ["build_assembly_graph", "get_initial_state", "main"]

```

### Core Architecture Module: `mac_assembly/__main__.py`
```
"""Make `python -m mac_assembly` work (the README-documented entry point).

Delegates to mac_assembly.graph_assembly.main.
"""
import sys

from mac_assembly.graph_assembly import main

if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `mac_assembly/_part_runner.py`
```
"""Subprocess runner: one single-part MAC pipeline, cwd-isolated.

Executed as ``python -m mac_assembly._part_runner [--mode {full,aider}]`` with::

    cwd    = <part_dir>                 (all temp_* files land here)
    env    MAC_PART_REQUEST   = single-part prompt
          MAC_PART_DIR        = absolute part dir (cache isolation)
          MAC_FORCE_REFRESH   = "1" to ignore the per-part plan cache (full mode only)

Modes:
    full   (default) -- regenerate a part from scratch via ``multi_agent_cad.graph``
                        (Spec Planner -> Architect -> Coder -> Skill Loop).
                        Reads MAC_FORCE_REFRESH from env so callers control caching.
    aider            -- patch an EXISTING part via ``multi_agent_cad.graph_aider``
                        (Aider-first workflow modifies the part's ``temp_design*.py``
                        with assembly-level feedback). Requires a pre-existing
                        ``temp_design*.py`` in the part dir; otherwise exits 3 so
                        the caller falls back to full regeneration. force_refresh
                        is hardcoded True -- the cache holds the pre-remodel design
                        hash, which is exactly what we want to bypass.

Patches before building the graph:

* ``multi_agent_cad.config.USER_REQUEST`` -- the part description.
* ``multi_agent_cad.nodes._CACHE_DIR``    -- per-part pipeline_cache so
  parallel/sequential parts never share Spec Planner / Architect caches.

The 10s interactive checkpoint auto-selects "1" (auto-iterate) because
stdin is not a TTY under subprocess -- exactly the CI behaviour MAC
already implements.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _parse_mode(argv: list[str]) -> str:
    parser = argparse.ArgumentParser(
        prog="mac_assembly._part_runner",
        description="Single-part MAC subprocess (full regenerate or aider remodel).",
    )
    parser.add_argument(
        "--mode", choices=("full", "aider", "resume"), default="full",
        help=("full: regenerate from scratch (default); aider: patch existing "
              "design; resume: validate an interrupted script and patch only "
              "when it still fails QA."),
    )
    args, _ = parser.parse_known_args(argv)
    return args.mode


def main(argv: list[str] | None = None) -> int:
    mode = _parse_mode(sys.argv[1:] if argv is None else argv)
    request = os.environ.get("MAC_PART_REQUEST", "")
    part_dir = Path(os.environ.get("MAC_PART_DIR", os.getcwd())).resolve()

    if not request:
        print(f"[part_runner:{mode}] MAC_PART_REQUEST not set", file=sys.stderr)
        return 2

    # Aider-first needs an existing design to patch.
    if mode in ("aider", "resume") and not list(part_dir.glob("temp_design*.py")):
        print(f"[part_runner:{mode}] no existing temp_design*.py -- cannot patch")
        return 3

    # Patch config BEFORE importing multi_agent_cad.graph / graph_aider (they
    # capture USER_REQUEST at import time).
    import multi_agent_cad.config as mac_config

    mac_config.USER_REQUEST = request

    import multi_agent_cad.nodes as mac_nodes

    part_dir.mkdir(parents=True, exist_ok=True)
    mac_nodes._CACHE_DIR = part_dir / "pipeline_cache"  # per-part cache isolation

    if mode in ("aider", "resume"):
        from multi_agent_cad.graph_aider import build_graph_aider
        app = build_graph_aider()
        force_refresh = True  # bypass the pre-remodel cache hash
        workflow_id = mode
    else:
        from multi_agent_cad.graph import build_graph
        app = build_graph()
        force_refresh = os.environ.get("MAC_FORCE_REFRESH", "") == "1"
        workflow_id = "original"

    initial_state = {
        "user_request": request,
        "iteration_count": 0,
        "max_iterations": 5,
        "force_refresh": force_refresh,
        "workflow_id": workflow_id,
        "node_history": [],
        "execution_log": [],
    }
    explicit_code_path = os.environ.get("MAC_PART_CODE_PATH", "").strip()
    if explicit_code_path:
        initial_state["current_python_code_path"] = explicit_code_path

    final: dict = dict(initial_state)
    crashed = False
    try:
        for event in app.stream(initial_state, {"recursion_limit": 60}):
            for _node, node_output in event.items():
                if isinstance(node_output, dict):
                    final.update(node_output)
    except Exception as exc:  # noqa: BLE001 - report and fail this attempt
        print(f"[part_runner:{mode}] pipeline error: {exc}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        crashed = True
    finally:
        # Persist this subprocess's token usage so the parent can aggregate
        # end-to-end cost (the project's core metric). In finally so a
        # crashed pipeline's spend is still accounted (B11).
        try:
            import json

            from multi_agent_cad.token_tracker import tracker

            summary = tracker.summary()
            summary.pop("calls", None)  # detail not needed for aggregation
            (part_dir / "token_summary.json").write_text(
                json.dumps(summary, indent=2), encoding="utf-8"
            )
        except Exception as exc:  # noqa: BLE001 - accounting must never fail the run
            print(f"[part_runner:{mode}] token summary failed: {exc}")

    if crashed:
        return 1

    error = final.get("error_type")
    error_str = getattr(error, "value", str(error)) if error else "none"
    ok = error_str == "none"

    print(f"[part_runner:{mode}] PART_DONE error_type={error_str}")
    return 0 if ok else 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())

```

### Core Architecture Module: `mac_assembly/assembly_codegen.py`
```
"""Deterministic assembly code generator: MateSpec -> AssemblyHelper source.

The assembly-layer analogue of MAC's ``_plan_to_code``: translating the
``AssemblyBrief`` into a build123d ``temp_assembly.py`` costs **zero
tokens**. Only when the closed loop fails does the LLM repair agent see
the generated source.

Reuse from CAD Skills (``positioning.md`` / ``cadpy.assembly``):

* AssemblyHelper + native build123d joints (RigidJoint / RevoluteJoint)
  with fixed-first directionality,
* mate/joint-driven structure instead of raw transforms,
* every anchor is a named datum (bbox face centre / axis point),
* labels survive because parts stay children of the Compound.

Generated script contract
-------------------------
* cwd = assembly job dir; part STEPs referenced by relative path.
* Anchors are derived **at runtime** from each part's bounding box, so
  the script re-measures geometry instead of trusting stale numbers.
* Writes ``assembly_manifest.json`` (per-label placed bbox) which the
  QA engine uses to map exported solids back to part labels.
"""

from __future__ import annotations

import math
from pathlib import Path

from mac_assembly.geometry_utils import FACE_AXIS, FACE_NORMALS
from mac_assembly.schemas_assembly import (
    AnchorKind,
    AssemblyBrief,
    MateType,
)

_PRELUDE = '''\
# Generated by mac_assembly.assembly_codegen (deterministic translator).
# Edit only via the assembly repair agent -- regenerate wipes manual edits.
import json
import os
import sys
from pathlib import Path

_REPO_ROOT = Path({repo_root!r})
for _p in (_REPO_ROOT, _REPO_ROOT / "packages" / "cadpy" / "src"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from build123d import Axis, Location, Rotation, Vector, import_step, export_step, export_stl
from cadpy.assembly import AssemblyHelper
from mac_assembly.selector_resolver import resolve_selector_anchor


def _anchor_point(shape, face, axis, offset_mm):
    """Deterministic named datum transformed from part-local to world.

    ``shape.bounding_box()`` is world-axis aligned after a parent mate has
    rotated the part, so reading a named face/axis point directly from it
    selects a different physical datum. Recover the original local bbox,
    evaluate the datum there, then apply the full current Location.
    """
    loc = shape.location
    bb = shape.moved(loc.inverse()).bounding_box()
    c = bb.center()
    faces = {{
        "top": (c.X, c.Y, bb.max.Z),
        "bottom": (c.X, c.Y, bb.min.Z),
        "right": (bb.max.X, c.Y, c.Z),
        "left": (bb.min.X, c.Y, c.Z),
        "back": (c.X, bb.max.Y, c.Z),
        "front": (c.X, bb.min.Y, c.Z),
    }}
    if face is not None:
        p = faces[face]
        w = loc * Location(p)
        return (w.position.X, w.position.Y, w.position.Z)
    d = {{"x": (offset_mm, 0.0, 0.0), "y": (0.0, offset_mm, 0.0),
         "z": (0.0, 0.0, offset_mm)}}[axis]
    p = (c.X + d[0], c.Y + d[1], c.Z + d[2])
    w = loc * Location(p)
    return (w.position.X, w.position.Y, w.position.Z)


def _local_point(shape, point):
    """Transform an explicit part-local point through the current pose."""
    w = shape.location * Location(point)
    return (w.position.X, w.position.Y, w.position.Z)


def _axis_direction(axis):
    return {{"x": (1.0, 0.0, 0.0), "y": (0.0, 1.0, 0.0),
            "z": (0.0, 0.0, 1.0)}}[axis]


# Axial-offset shift math: shared with assembly_qa (single source of truth
# in mac_assembly.geometry_utils so the codegen runtime and QA mirror cannot
# diverge). The subprocess PYTHONPATH includes _PROJECT_ROOT so the import
# resolves at runtime.
from mac_assembly.geometry_utils import shift_pt as _shift_pt
from mac_assembly.geometry_utils import snap_axis as _snap_axis


def _world_axis_dir(part, axis_name):
    # A mate's slide/joint axis is principal (x/y/z) in the FIXED part's
    # LOCAL frame. When the fixed part was itself placed by an earlier mate
    # (chained joints), its local axis is rotated in world -- transform it
    # through the part's current location (rotation only: the transformed
    # endpoint minus the transformed origin cancels the translation), then
    # snap away the ~1e-16 float noise so OCP's gp_Ax3 branch stays
    # deterministic (see geometry_utils.snap_axis). Identity for unmoved
    # parts, so pure-translation assemblies are byte-identical to before.
    _d = {{"x": (1.0, 0.0, 0.0), "y": (0.0, 1.0, 0.0),
          "z": (0.0, 0.0, 1.0)}}[axis_name]
    _o = part.location * Location((0.0, 0.0, 0.0))
    _e = part.location * Location(_d)
    _ax = (_e.position.X - _o.position.X,
           _e.position.Y - _o.position.Y,
           _e.position.Z - _o.position.Z)
    if abs(_ax[0]) + abs(_ax[1]) + abs(_ax[2]) < 1e-9:
        return _d
    return _snap_axis(_ax)


def _shift_xyz(point, part, delta_local):
    """Shift a world point by a vector expressed in ``part`` local axes."""
    _x = _world_axis_dir(part, "x")
    _y = _world_axis_dir(part, "y")
    _z = _world_axis_dir(part, "z")
    return (
        point[0] + delta_local[0] * _x[0] + delta_local[1] * _y[0] + delta_local[2] * _z[0],
        point[1] + delta_local[0] * _x[1] + delta_local[1] * _y[1] + delta_local[2] * _z[1],
        point[2] + delta_local[0] * _x[2] + delta_local[1] * _y[2] + delta_local[2] * _z[2],
    )


def _resolve_part_step(part_id):
    # 1. AUTHORITATIVE path: the PartResult's step_path recorded by the
    #    part_builder this iteration (passed in via _PART_STEP_OVERRIDES).
    #    Guards against a stale STEP file left in the part directory (e.g.
    #    a failed regeneration keeps the previous temp_output_features.step)
    #    being picked up by the mtime glob below and masquerading as this
    #    round's geometry. When an override IS recorded but the file is
    #    gone, we FAIL LOUDLY (FileNotFoundError) instead of falling back
    #    to the glob: the fallback could resurrect exactly the stale
    #    geometry the override exists to prevent, silently assembling
    #    last round's part as this round's result.
    # 2. Legacy compatibility mode (NO override recorded for this part,
    #    e.g. a script generated before part_step_overrides existed):
    #    newest temp_output_*.step by mtime (delegates to
    #    mac_assembly.file_utils.newest_file, single source of truth, R3):
    #    mtime primary, trailing iteration number as tiebreak -- NEVER
    #    alphabetical ("temp_output_10" < "temp_output_2" lexicographically).
    #    The subprocess PYTHONPATH includes the project root, so the import
    #    resolves at runtime (same as geometry_utils).
    _ovr = _PART_STEP_OVERRIDES.get(part_id)
    if _ovr is not None:
        _p = Path(_ovr)
        if _p.is_file():
            return _p
        raise FileNotFoundError(
            f"authoritative STEP for part {{part_id!r}} recorded at {{_ovr}} "
            f"is missing -- refusing the stale-glob fallback (it could pick "
            f"up an older temp_output_*.step and masquerade as this round's "
            f"geometry); rebuild the part or clear the override"
        )
    from mac_assembly.file_utils import newest_file as _nf
    p = _nf(Path("parts") / part_id, "temp_output_*.step")
    if p is None:
        raise FileNotFoundError(f"no STEP for part {{part_id!r}} under parts/")
    return p


asm = AssemblyHelper({assembly_name!r})
_parts = {{}}
_part_steps = {{}}          # part_id -> STEP path (for SELECTOR resolution)
_audit_selectors = []       # resolved cadpy numeric selectors (audit trail)
# part_id -> authoritative STEP path (relative to this cwd) from THIS
# iteration's PartResults -- see _resolve_part_step. Empty dict when the
# caller has no part results (legacy behaviour: mtime glob only).
_PART_STEP_OVERRIDES = {part_step_overrides!r}
'''

_FOOTER = '''\

# ---- build + export -------------------------------------------------------
compound = asm.build()

export_step(compound, {step_out!r})
try:
    export_stl(compound, {stl_out!r}, tolera
```

### Core Architecture Module: `mac_assembly/assembly_qa.py`
```
"""AssemblyQA: closed-loop detection for the assembled compound.

Deterministic checks decide pass/fail (philosophy reused from the CAD
Skills ``inspection-and-validation.md``):

1. **Part count** -- solids in the exported STEP == len(brief.parts).
2. **Envelope** -- assembly bbox within tolerance of the brief.
3. **Mate alignment** -- each MateSpec's two named datums are re-derived
   from the *placed* geometry and their world-space delta is compared
   against the expected offset (the in-process analogue of
   ``scripts/inspect align``).
4. **Interference** -- pairwise mesh overlap between placed parts
   (containment sampling + surface gap, via trimesh).

Visual review stays diagnostic (rendered views go to the Assembly
Judge), exactly like ``snapshot-review.md``: "visual review is
diagnostic, not authoritative".
"""

from __future__ import annotations

import json
import math
import time
from collections import OrderedDict
from pathlib import Path
from typing import NamedTuple

from mac_assembly import config_assembly as cfg
from mac_assembly.assembly_codegen import _get_anchor_axis
from mac_assembly.geometry_utils import (
    AXIS_DIRS as _AXIS_DIRS,
    FACE_NORMALS as _FACE_NORMALS,
    closest_point_robust,
    mesh_containment_available,
    shift_pt,
)
from mac_assembly.schemas_assembly import (
    Anchor,
    AnchorKind,
    AssemblyBrief,
    AssemblyErrorType,
    AssemblyQAReport,
    InterferenceCheck,
    KinematicCheck,
    MateCheck,
    MateType,
)
from multi_agent_cad.render_views import _render_isometric_views


# Volume below which a mesh is treated as zero-volume for interference
# probing (BUG-016). ``_pair_collides`` uses ``min(|Va|, |Vb|)`` as a
# penetration proxy; a zero-volume mesh (flat plate, single-triangle STL,
# sheet metal without thickness) zeroes the proxy and false-passes. The
# epsilon catches near-degenerate shells (floating-point thickness).
_ZERO_VOLUME_EPS_MM3 = 1e-9


# ---------------------------------------------------------------------------
# Geometry loading
# ---------------------------------------------------------------------------


def _load_placed_solids(assembly_dir: Path):
    """Return (placed, locations, error) from the exported assembly STEP.

    Solids are mapped back to part labels via the manifest written by the
    assembly script (nearest bbox centre), so QA never trusts STEP label
    metadata.

    ``locations`` is ``{label: (translation_tuple, rotation_euler_xyz_deg)}``
    from the manifest -- the part's full world transform after joints are
    applied. QA uses this to map part-local selector points through the
    FULL placed transform (not just bbox-centre translation) so rotated
    poses (chains of revolute joints) are handled exactly.
    """
    from build123d import import_step

    step_path = assembly_dir / "assembly_output.step"
    manifest_path = assembly_dir / "assembly_manifest.json"
    if not step_path.is_file():
        return None, None, "assembly_output.step missing"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else []

    locations: dict[str, tuple[tuple, tuple]] = {}
    for entry in manifest:
        loc = entry.get("location")
        if loc and "translation" in loc and "rotation_euler_xyz_deg" in loc:
            locations[entry["label"]] = (
                tuple(loc["translation"]),
                tuple(loc["rotation_euler_xyz_deg"]),
            )

    _t0 = time.perf_counter()
    compound = import_step(str(step_path))
    solids = list(compound.solids())
    print(f"[assembly] QA timing: assembly STEP import={time.perf_counter() - _t0:.1f}s")
    if not solids:
        return None, None, "assembly STEP contains no solids"

    placed = []
    used: set[int] = set()
    for entry in manifest:
        label = entry["label"]
        centre = (
            (entry["bbox_min"][0] + entry["bbox_max"][0]) / 2.0,
            (entry["bbox_min"][1] + entry["bbox_max"][1]) / 2.0,
            (entry["bbox_min"][2] + entry["bbox_max"][2]) / 2.0,
        )
        best_idx, best_d, best_size_err = None, float("inf"), float("inf")
        exp_size = (
            entry["bbox_max"][0] - entry["bbox_min"][0],
            entry["bbox_max"][1] - entry["bbox_min"][1],
            entry["bbox_max"][2] - entry["bbox_min"][2],
        )
        for idx, solid in enumerate(solids):
            if idx in used:
                continue
            bb = solid.bounding_box()
            c = bb.center()
            d = (c.X - centre[0]) ** 2 + (c.Y - centre[1]) ** 2 + (c.Z - centre[2]) ** 2
            # Tie-break on bbox SIZE similarity. Concentric pairs
            # (ball-in-socket, bushing-on-standoff) share a bbox centre, so
            # the centroid distance ties and a pure `d < best_d` assigns
            # labels by compound enumeration order -- ball and socket swap
            # labels deterministically and every downstream mate/kinematics
            # check then measures the wrong part. Sizes differ by design,
            # so the size error disambiguates.
            size_err = (
                abs((bb.max.X - bb.min.X) - exp_size[0])
                + abs((bb.max.Y - bb.min.Y) - exp_size[1])
                + abs((bb.max.Z - bb.min.Z) - exp_size[2])
            )
            if d < best_d - 1e-6 or (
                d <= best_d + 1e-6 and size_err < best_size_err - 1e-9
            ):
                best_idx, best_d, best_size_err = idx, d, size_err
        if best_idx is None:
            continue
        used.add(best_idx)
        bb = solids[best_idx].bounding_box()
        placed.append((label, (bb.min.X, bb.min.Y, bb.min.Z), (bb.max.X, bb.max.Y, bb.max.Z)))
    # Solids without a manifest match get an anonymous label.
    for idx, solid in enumerate(solids):
        if idx not in used:
            bb = solid.bounding_box()
            placed.append((f"unmatched_{idx}", (bb.min.X, bb.min.Y, bb.min.Z),
                           (bb.max.X, bb.max.Y, bb.max.Z)))
    return placed, locations, None


# ---------------------------------------------------------------------------
# Anchor maths (mirror of the runtime derivation in the generated script)
# ---------------------------------------------------------------------------


def _anchor_world_point(anchor: Anchor, bb_min, bb_max):
    cx = (bb_min[0] + bb_max[0]) / 2.0
    cy = (bb_min[1] + bb_max[1]) / 2.0
    cz = (bb_min[2] + bb_max[2]) / 2.0
    if anchor.kind == AnchorKind.SELECTOR:
        # SELECTOR anchors carry a semantic query, not bbox algebra. Callers
        # that can resolve the real face do so BEFORE calling this; this
        # fallback (bbox centre) only guards resolver-unavailable paths so a
        # SELECTOR anchor can never crash QA with KeyError: None (N2a).
        return (cx, cy, cz)
    if anchor.kind == AnchorKind.FACE:
        # Face centre = bbox centre + outward normal * half-extent
        # (normals from geometry_utils, single source of truth).
        n = _FACE_NORMALS[anchor.face]
        return (
            cx + n[0] * (bb_max[0] - bb_min[0]) / 2.0,
            cy + n[1] * (bb_max[1] - bb_min[1]) / 2.0,
            cz + n[2] * (bb_max[2] - bb_min[2]) / 2.0,
        )
    if anchor.kind == AnchorKind.SPHERE:
        # Sphere anchor: explicit sphere_center_mm in part-local coords.
        # QA transforms the part-local center through the placed Location
        # in the caller; here we return the part-local point so the caller
        # can apply the transform (mirrors _emit_anchor SPHERE branch).
        sc = anchor.sphere_center_mm or [0.0, 0.0, 0.0]
        return (float(sc[0]), float(sc[1]), float(sc[2]))
    if anchor.axis is None:
        # AXIS_POINT with axis=None (shouldn't happen, but guard) — fall
        # back to bbox centre so QA never crashes with KeyError: None.
        return (cx, cy, cz)
    if anchor.point_mm is not None:
        return tuple(float(v) for v in anchor.point_mm)
    off = anchor.offset_mm o
```

### Core Architecture Module: `mac_assembly/config_assembly.py`
```
"""Configuration for the multi-agent assembly pipeline.

Single-part stages reuse ``multi_agent_cad.config`` verbatim (per-stage
hybrid routing already lives there). This file only adds the
assembly-level stages (Decomposer / Assembly Repair / Assembly Judge)
and the closed-loop budgets.
"""

from __future__ import annotations

import os

# Reuse the single-part pipeline's provider settings (endpoint / API key
# resolution happens in multi_agent_cad.nodes._llm_client).
from multi_agent_cad.config import DS_BASE_URL  # noqa: F401  (re-export)

# ============================================================================
# Default LLM model for assembly-stage agents (Decomposer / Mating /
# Assembly Repair / Assembly Judge). Centralized so a model-ID swap is a
# one-line change; override per-stage via MAC_*_MODEL env vars.
# ============================================================================

_DEFAULT_MODEL = "qwen3.8-max"

# ============================================================================
# Default assembly request (used when MAC_ASSEMBLY_REQUEST env is unset)
# ============================================================================

DEFAULT_ASSEMBLY_REQUEST = (
    "Create a two-piece screw-top box assembly as a single STEP file in "
    "millimeters. Part 1 'base_box': a 60 x 60 x 35 mm hollow open-top box "
    "with 3 mm walls and floor, outer bottom face flat at Z=0, centered on "
    "the XY origin. Part 2 'lid': a 60 x 60 x 6 mm flat lid with a small "
    "cylindrical pull knob (radius 6 mm, height 8 mm) centered on its top "
    "face. The lid sits flat on the base box top rim with a 0.2 mm gap. "
    "Both parts must remain separate solids in one STEP file."
)

# ============================================================================
# Stage: Decomposer (assembly-level Spec Planner)
# ============================================================================

DECOMPOSER_MODEL = os.environ.get("MAC_DECOMPOSER_MODEL", _DEFAULT_MODEL)
DECOMPOSER_TEMPERATURE = 0.0
DECOMPOSER_MAX_TOKENS = 32768
DECOMPOSER_KWARGS: dict = {"extra_body": {"enable_thinking": False}}
DECOMPOSER_MULTIMODAL = "auto"   # "auto" | "always" | "never"

# ============================================================================
# Stage: Mating Architect (assembly-level Geometric Architect -- the HOW)
# ============================================================================

MATING_MODEL = os.environ.get("MAC_MATING_MODEL", _DEFAULT_MODEL)
MATING_TEMPERATURE = 0.0
MATING_MAX_TOKENS = 32768
MATING_KWARGS: dict = {"extra_body": {"enable_thinking": False}}

# ============================================================================
# Stage: Assembly Repair (edits temp_assembly.py when mates fail QA)
# ============================================================================

ASSEMBLY_REPAIR_MODEL = os.environ.get("MAC_ASM_REPAIR_MODEL", _DEFAULT_MODEL)
ASSEMBLY_REPAIR_TEMPERATURE = 0.0
ASSEMBLY_REPAIR_MAX_TOKENS = 16384
ASSEMBLY_REPAIR_KWARGS: dict = {"extra_body": {"enable_thinking": False}}

# ============================================================================
# Stage: Assembly Judge (mirrors MAC's QA Judge: temp 0, anti-hallucination)
# ============================================================================

ASSEMBLY_JUDGE_ENABLED = True
ASSEMBLY_JUDGE_MIN_RETRY = 1        # judge only from retry >= this
ASSEMBLY_JUDGE_MODEL = os.environ.get("MAC_ASM_JUDGE_MODEL", _DEFAULT_MODEL)
ASSEMBLY_JUDGE_TEMPERATURE = 0.0
ASSEMBLY_JUDGE_MAX_TOKENS = 8192
ASSEMBLY_JUDGE_KWARGS: dict = {"extra_body": {"enable_thinking": False}}
ASSEMBLY_JUDGE_MULTIMODAL = "auto"  # "auto" | "always" | "never"
ASSEMBLY_JUDGE_VIEWS_COUNT = 4
ASSEMBLY_JUDGE_VIEW_SIZE = 512
ASSEMBLY_JUDGE_SAVE_VIEWS = True

# ============================================================================
# Closed-loop budgets
# ============================================================================

# Outer assembly loop: assembler -> QA -> (judge) -> route back.
# This is the GLOBAL safety net across all route types (remate / remodel /
# repair_assembly / recompose). The per-route sub-budgets (MATING_MAX_RUNS,
# DECOMPOSER_MAX_RUNS) bind FIRST for their respective routes; this cap only
# fires when a route has no sub-budget (e.g. repair_assembly) or as a final
# backstop. With MATING_MAX_RUNS=4 the remate route is bounded by its
# sub-budget at mating_architect_runs=4 (iteration_count ~5); with DECOMPOSER_MAX_RUNS=2
# the recompose route binds even earlier. The outer cap therefore primarily
# constrains repair_assembly (no sub-budget) and guards against runaway loops.
# Default 8 gives repair_assembly room for complex multi-part assemblies
# (dexterous hand etc.); override via MAC_ASSEMBLY_MAX_ITER for quick local
# runs. Lowering below 4 would gate remates prematurely and make
# MATING_MAX_RUNS dead code.
ASSEMBLY_MAX_ITERATIONS = int(os.environ.get("MAC_ASSEMBLY_MAX_ITER") or "8")

# Per-part full-pipeline launches inside one part_builder run.  The single-part
# pipeline already owns its QA/Aider retry budget; launching it again used to
# multiply MAX_RETRIES=3 into six iterations and overwrite accumulated work.
PART_MAX_ATTEMPTS = 1

# Decomposer re-planning cap (recompose route).
DECOMPOSER_MAX_RUNS = 2

# PartBuilder remodel-round cap (remodel_parts / part_missing routes). The
# router counts rounds it sends back to part_builder (each round can cost
# one full MAC pipeline run per failing part, or one
# builder-remodel LLM call). Without this cap, a structurally infeasible
# builder param set or a persistently failing MAC pipeline loops forever:
# the assembler early-returns with qa_skipped_iter=True (no outer budget
# consumed), the Judge is skipped at iteration_count=0, and the router
# re-enters part_builder unbounded until recursion_limit crashes the run.
PART_BUILDER_MAX_RUNS = 4

# Mating Architect re-planning cap (remate route). Counts NODE RUNS of the
# architect (each run may issue up to 2 structured calls: one in-node retry
# when deterministic validation rejects the plan). Allows up to 3 remates
# (mating_architect_runs reaches 4 -> 4 < 4 False -> budget exhausted) on top
# of the initial mating. Pair with ASSEMBLY_MAX_ITERATIONS >= 5 so this
# budget, not the outer cap, binds for the remate route.
MATING_MAX_RUNS = 4

# ============================================================================
# Kinematic sweep (revolute mates)
# ============================================================================

# Rotate the moving subtree about each revolute joint axis over
# +/- KINEMATIC_SWEEP_DEG at KINEMATIC_SWEEP_SAMPLES angles (incl. 0)
# and test collisions against the static structure at each angle.
KINEMATIC_ENABLED = True
KINEMATIC_SWEEP_DEG = 30.0
KINEMATIC_SWEEP_SAMPLES = 5

# Translate the moving subtree of each linear/cylindrical joint along the
# mate axis over +/- LINEAR_SWEEP_MM at LINEAR_SWEEP_SAMPLES positions.
LINEAR_SWEEP_MM = 20.0
LINEAR_SWEEP_SAMPLES = 5

# QA tolerances
ENVELOPE_TOLERANCE_PCT = 0.15       # +-15% per axis on overall envelope
INTERFERENCE_VOLUME_TOL_MM3 = 5.0   # pairwise solid overlap tolerance
INTERFERENCE_VERTEX_FRACTION = 0.02 # >2% of sampled points penetrating -> fail
# Penetration deeper than this counts as interference. Contact/touching
# parts (sd ~= 0) are NOT interference -- essential for face_to_face
# mates and parts resting on each other.
INTERFERENCE_DEPTH_TOL_MM = 0.3

# Subprocess timeouts (seconds)
PART_PIPELINE_TIMEOUT = 3600        # one full single-part MAC run
ASSEMBLY_SCRIPT_TIMEOUT = 300       # execute temp_assembly.py

# Python interpreter used for subprocesses (defaults to sys.executable).
PYTHON_BIN = os.environ.get("MAC_PYTHON", "")

```

### Core Architecture Module: `mac_assembly/feature_operators.py`
```
"""v3 Feature operators: kinematic features attach to an LLM-generated base body.

Each operator has signature ``(base: Compound, feature: Feature) -> Compound``.
The base body is loaded via build123d.import_step from the LLM-generated
STEP. The operator builds feature geometry in local coords (bore at
origin), positions + orients it at ``feature.attachment.attach_point_mm``
+ ``feature.attachment.direction``, applies a 0.2mm overshoot along
-direction (into the base) so the boolean union happens between
intersecting volumes (not at a coincident-face tangent), and fuses.

Subtractive operators (through_bore, ball_cavity) overshoot 1mm
already (preserves bore/cavity face topology -- see plan §2e/§2h).

Snap-to-surface (plan §2g): if attach_point is >0.5mm from the base
surface, snap along -direction to the nearest surface. Then verify the
surface normal at the snap point lies within 15° of the expected attach
normal -- ``attachment.surface_axis`` when given, otherwise EITHER sign of
``direction`` (planar kinematics protection: reject tilted/curved-surface
snaps, not the natural straight-off-face case); if not, revert to the
original attach_point + log warning, let QA catch the bad geometry.

Multi-solid Compound fallback (plan §2f): if direct ``base + feature``
raises BRep_API, try fusing against each base solid individually; if
all fail, emit the feature as a disjoint solid in the Compound (the
part doesn't crash the pipeline; QA catches the disjoint geometry).
"""
from __future__ import annotations

import math
from typing import Any, Callable

from mac_assembly.geometry_utils import (
    DIR_VECTORS as _DIR_VECTORS,
    OPPOSITE_DIRECTION as _OPPOSITE_DIRECTION,
    X_AXIS_ROTATIONS as _X_AXIS_ROTATIONS,
    Z_AXIS_ROTATIONS as _Z_AXIS_ROTATIONS,
    closest_point_robust as _closest_point_robust,
)
from mac_assembly.schemas_assembly import Feature


# Direction -> (rotation rpy deg to orient local +X protrusion along direction,
#               unit vector of protrusion direction)
# Local feature geometry has bore at origin, body extending -X (the "back").
# For direction=+x (protrudes +X): no rotation needed; body in -X is "back".
# For direction=+y: rotate +X to +Y -> rotation 90° about Z. Body local -X
#   becomes global -Y (back away from +Y protrusion).
# For direction=-x: rotate 180° about Z. Body local -X becomes +X (back).
# For direction=-y: rotate -90° about Z (or 270°).
# For direction=+z / -z: valid only with pin_axis=x/y (the non-planar modes
#   in _FORK_ROTATIONS below); the legacy pin=z planar mode requires ±x/±y.
# Derived from geometry_utils' X_AXIS_ROTATIONS + DIR_VECTORS (single source
# of truth, R1) -- do not re-enter the numbers here.
_PROTRUSION_ROTATIONS: dict[str, tuple[tuple[float, float, float], tuple[float, float, float]]] = {
    d: (_X_AXIS_ROTATIONS[d], _DIR_VECTORS[d]) for d in _DIR_VECTORS
}

# Pin-axis rotation table for clevis_fork / clevis_tongue.
# Builds on _PROTRUSION_ROTATIONS by adding an extra rotation to re-orient
# the bore axis from +Z (default) to +X / +Y / +Z. This enables non-planar
# kinematics: pin=X means the clevis rotates about the world X axis (motion
# in YZ plane, e.g. fingers curling toward the palm); pin=Y means rotation
# about Y (motion in XZ plane); pin=Z (default) is the legacy planar mode
# (motion in XY plane).
#
# Local fork/tongue frame: body extends -X, bore along +Z at local origin
# (0, 0, bar_thickness/2). For pin_axis != "z", we pre-shift the fork by
# (0, 0, -bar_thickness/2) so the bore sits at the local origin *before*
# rotation. After rotation + Pos(attach), the bore ends up exactly at the
# attach_point. This means for pin_axis != "z", attach_z IS the bore center
# Z (not attach_z + bar_thickness/2 as in pin_axis="z" legacy mode).
#
# Convention: `direction` always describes the body protrusion axis (the
# direction the tip points). For pin="z" direction must be ±x/±y (planar
# XY); for pin="x" direction must be ±y/±z (planar YZ); for pin="y"
# direction must be ±x/±z (planar XZ). pin parallel to direction is invalid.
#
# RPY values were found by brute-force search using actual build123d
# Rotation(R, P, Y) = R_z(Y) * R_x(R) * R_y(P) semantics, choosing the
# candidate with smallest |R|+|P|+|Y|.
_FORK_ROTATIONS: dict[tuple[str, str], tuple[float, float, float]] = {
    # pin=Z: bore +Z, body in -direction (XY plane) -- legacy planar mode
    ("z", "+x"): (0.0, 0.0, 0.0),
    ("z", "-x"): (0.0, 0.0, -180.0),
    ("z", "+y"): (0.0, 0.0, 90.0),
    ("z", "-y"): (0.0, 0.0, -90.0),
    # pin=X: bore +X, body in -direction (YZ plane) -- fingers curl toward palm
    ("x", "+y"): (0.0, 90.0, 90.0),
    ("x", "-y"): (-90.0, 90.0, 0.0),
    ("x", "+z"): (-180.0, 90.0, 0.0),
    ("x", "-z"): (0.0, 90.0, 0.0),
    # pin=Y: bore +Y, body in -direction (XZ plane)
    ("y", "+x"): (-90.0, 0.0, 0.0),
    ("y", "-x"): (-90.0, 0.0, -180.0),
    ("y", "+z"): (-90.0, 0.0, -90.0),
    ("y", "-z"): (-90.0, 0.0, 90.0),
}

# _Z_AXIS_ROTATIONS (direction -> RPY orienting local +Z along it, for
# through_bore / ball_cavity opening / ball_stem stem / knuckle_ear) and
# _OPPOSITE_DIRECTION are imported from geometry_utils (single source of
# truth, R1). clevis_fork / clevis_tongue use _PROTRUSION_ROTATIONS instead
# -- their local body axis is X, not Z.

# Overshoot into the base along -direction (additive ops). 0.2mm matches
# existing clevis clearance_side default; well above OpenCASCADE 1e-6 tolerance.
_ADDITIVE_OVERSHOOT_MM = 0.2

# Subtractive operators carve voids (base - tool). Their "disjoint solid"
# fallback cannot be represented as positive geometry -- emitting the tool
# body would ADD material where a void was designed. When such an op fails
# to fuse with every base solid, apply_feature must fail the feature
# outright (part_generator reports ok=False -> remodel) rather than
# silently appending the tool solid.
_SUBTRACTIVE_OPERATORS = frozenset({"through_bore", "ball_cavity"})

# Additive KINEMATIC operators must end up CONNECTED to the base: a fork /
# tongue / ear / ball that did not fuse floats as a separate solid, which
# silently breaks the part (an extra disconnected solid in the STEP, no
# structural path). A disjoint fallback is only allowed for an explicitly
# opted-in decorative feature (params["allow_disjoint"]=True).
_DISJOINT_ALLOWED_PARAM = "allow_disjoint"


def _solid_count(shape: Any) -> int:
    try:
        return len(shape.solids())
    except Exception:  # noqa: BLE001 - not a solid-bearing shape
        return 0


def _feature_allows_disjoint(feature: Feature) -> bool:
    return bool(feature.params.get(_DISJOINT_ALLOWED_PARAM, False))

# Snap-to-surface tolerance + normal angle threshold.
_SNAP_TOLERANCE_MM = 0.5
_MAX_NORMAL_ANGLE_DEG = 15.0


def _snap_to_surface(
    base: Any,
    attach_point_mm: list[float],
    direction: str,
    surface_axis: str | None = None,
) -> tuple[list[float], str | None]:
    """If attach_point is >tolerance from base surface, snap along -direction.

    Returns (final_point, warning_msg). final_point is snapped_point if
    snap succeeds + normal aligned, else original attach_point. warning_msg
    is non-None if we reverted due to tilted normal.

    ``surface_axis`` (from FeatureAttachment, optional): the expected
    outward normal of the attach surface. The protrusion direction and the
    surface normal are INDEPENDENT concepts:
      - a clevis_fork protruding +y off a plate's +Y side face attaches to
        a surface whose normal is +y (== +direction);
      - a ball_stem's ball sits at -direction, so its attach surface normal
        is -direction;
      - a knuckle_ear centred on the TOP face protruding +y attaches to a
        +z-normal surface (perpendicular to direction).
    When ``surface_axis`` is given, the snap validates the surface normal
    against exactly that axis. Legacy fallback (surface_axis None): accept
    the snap when the normal is within the tolerance cone of EITHER
    +direction or -direction
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9** (2026-09-24): **Feature/assembly**
  *Symptoms*: 

- **Issue #8** (2026-09-16): **docs: USD price estimates and untrack prompt drafts**
  *Symptoms*: ## Summary 3 docs commits on top of PR #7 (already merged):  - **9b0b4a1** — convert README price estimates from CNY to USD (assembly gallery + single-part benchmark tables) - **672f378** — drop Total row and conversion footnotes from README - **c7f25f2** — untrack uncompleted assembly prompt drafts (Orbital_Service_Satellite, Quadruped_Inspection_Robot, tilting_display_stand)  English README only; Chinese README keeps CNY figures.

- **Issue #7** (2026-09-16): **Feature/assembly**
  *Symptoms*: 

- **Issue #6** (2026-08-26): **Sculpture**
  *Symptoms*: Créé une boite de 100mm de cotés et de 65mm de haut, ouverte sur le dessus avec des gorges de 16mm de coté et 6mm de profondeur
  **Post-Mortem & Fix Analysis**:
  > Could you please describe the issue you're experiencing in more detail?

- **Issue #5** (2026-08-13): **Multiple issues with Web UI, LLM provider switching, Architect schema validation, CAD generation and Windows execution**
  *Symptoms*: ## Summary  I tested the Multi-Agent-CAD project on Windows with `build123d==0.11.1`, the Web UI, NVIDIA/OpenAI-compatible APIs, and Google Gemini through the OpenAI-compatible Gemini API.  I encountered several independent issues during installation, configuration, Web UI execution, LLM provider switching, ArchitectPlan generation, CAD generation, QA, and Windows execution.  ---  ## 1. build123d fails to import because of an invalid Windows font  Initially:  ```text python -c "import build123d; print(build123d.__version__)"  failed with:  fontTools.ttLib.TTLibError: Not a TrueType or OpenType font (bad sfntVersion)  The problematic file was:  C:\Windows\Fonts\mstmc.ttf  A font-checking script found:  Found 441 font files.  # BAD FONT FILES:  C:\Windows\Fonts\mstmc.ttf ERROR: Not a TrueType or OpenType font (bad sfntVersion)  After dealing with the invalid font, build123d imported successfully:  BUILD123D OK: 0.11.1  A malformed system font should ideally not prevent the entire build123d package from importing.  2. Dependency conflict between build123d and aider-chat  Installing the project dependencies produced:  ERROR: Cannot install build123d==0.11.1 and multi-agent-cad because these package versions have conflicting dependencies.  The conflict was:  aider-chat 0.50.0 depends on numpy==1.26.4  build123d 0.11.1 depends on numpy<3 and >=2  Therefore pip cannot satisfy both dependencies in the same environment.  This is a problem because the project uses both build123d and Ai
  **Post-Mortem & Fix Analysis**:
  > Thanks for the thorough report. The actionable bugs are fixed on main:  Gemini model_hint pointing at the decommissioned gemini-2.0-flash (now gemini-2.5-flash).  Web UI startup URL showing 0.0.0.0 (Windows ERR_ADDRESS_INVALID); now prints 127.0.0.1 as the clickable URL, still binds all interfaces.  "DashScope API call failed" wording even when the provider is Gemini / OpenAI / Ollama (now "LLM API call failed").  Deterministic coder printing SUCCESS before checking runtime diagnostics, so a CHAMFER_FAILED run read as success-then-warning. Now: clean run -> SUCCESS, run with runtime issues -> PARTIAL SUCCESS with issue count.  Several items are outside what this project's code can fix:  build123d crashing on a malformed Windows system font (mstmc.ttf) - build123d enumerates fonts at import time; we don't touch fonts. Repair or remove the bad font file at the OS level.  LangGraph deprecation warning about allowed_objects - upstream change, no functional impact.  Gemini free-tier 429 on 

- **Issue #4** (2026-08-10): **Conda env create command fails on Windows 11 in Powershell**
  *Symptoms*: The `conda env create -f environment.yml` command fails on Windows 11 in Powershell.  **NOTE:** The full output of the command is attached [here](https://github.com/user-attachments/files/30879349/multi-agent-cad-conda-env-create-command-output.txt).  Error excerpt from command output: ```shell The conflict is caused by:     build123d 0.8.0 depends on numpy<3 and >=2     aider-chat 0.86.2 depends on numpy==1.26.4     aider-chat 0.86.1 depends on numpy==1.26.4     aider-chat 0.86.0 depends on numpy==1.26.4     aider-chat 0.85.5 depends on numpy==1.26.4     aider-chat 0.85.4 depends on numpy==1.26.4     aider-chat 0.85.3 depends on numpy==1.26.4     aider-chat 0.85.2 depends on numpy==1.26.4     aider-chat 0.85.1 depends on numpy==1.26.4     aider-chat 0.85.0 depends on numpy==1.26.4     aider-chat 0.84.0 depends on numpy==1.26.4     aider-chat 0.83.2 depends on numpy==1.26.4     aider-chat 0.83.1 depends on numpy==1.26.4     aider-chat 0.83.0 depends on numpy==1.26.4     aider-chat 0.82.3 depends on numpy==1.26.4     aider-chat 0.82.2 depends on numpy==1.26.4     aider-chat 0.82.1 depends on numpy==1.26.4     aider-chat 0.82.0 depends on numpy==1.26.4     aider-chat 0.81.3 depends on numpy==1.26.4     aider-chat 0.81.2 depends on numpy==1.26.4     aider-chat 0.81.1 depends on numpy==1.26.4     aider-chat 0.81.0 depends on numpy==1.26.4     aider-chat 0.80.4 depends on numpy==1.26.4     aider-chat 0.80.3 depends on numpy==1.26.4     aider-chat 0.80.2 depends on numpy==1.26.4   
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report - this is a different bug from the numpy/scipy warning fixed earlier, and is now fixed in 3d39dc1.  Root cause: every aider-chat version on PyPI (0.50.0 through 0.86.2+) hard-pins numpy==1.26.4 (1.x), which is incompatible with build123d's numpy>=2 requirement. conda's pip subprocess can't bypass per-package pins, so conda env create fails with ResolutionImpossible. This is platform-independent - macOS/Linux would hit it too on a fresh conda env create, but most users were following the README's pip workaround (which uses --no-deps) instead.  Fix: aider-chat is now removed from environment.yml. The install flow becomes:  conda env create -f environment.yml conda activate multi_agent_cad pip install --no-deps "aider-chat==0.82.3"  The --no-deps flag skips the numpy==1.26.4 pin; aider 0.82.3 imports cleanly on numpy 2.x. Could you pull main and try again?
  > I'll give it a try soon and let you know how it goes.

- **Issue #3** (2026-08-09): **Aider repair stage never runs: .gitignore excludes temp_*.py**
  *Symptoms*: On a fresh clone the Aider repair stage exits immediately with:  ``` [AIDER REPAIR] Launching Aider on: temp_design_0.py [AIDER REPAIR] Errors to fix: 6 Skipping /path/to/Multi-Agent-CAD/temp_design_0.py that matches gitignore spec. ```  `.gitignore:44` contains `temp_*.py`, which matches `temp_design_0.py` — the very file the repair stage is meant to edit. Aider refuses to add gitignored files to the chat, so every repair round is a no-op and the pipeline ships the first design even when QA has already flagged it as broken.  Confirmed with:  ``` $ git check-ignore -v temp_design_0.py .gitignore:44:temp_*.py	temp_design_0.py ```  **Workaround:** comment out `temp_*.py` in `.gitignore`. (The other `temp_output_*` / `temp_measurements_*` patterns are fine — Aider only needs the `.py`.)  ### Environment  macOS arm64 (M1 Max), Python 3.11.15, aider-chat 0.82.3, build123d 0.11.1, numpy 2.2.6, OpenAI-compatible local endpoint.  ### Two smaller notes from the same run  Happy to split these into separate issues if you prefer.  **1. The pip workaround leaves numpy in a version scipy rejects.** Following the README's non-conda path ends at numpy 2.4.6, but the installed scipy requires `>=1.22.4,<2.3.0`, so every `build123d` import prints:  ``` UserWarning: A NumPy version >=1.22.4 and <2.3.0 is required for this version of SciPy (detected version 2.4.6) ```  `pip install --no-deps --force-reinstall "numpy>=2,<2.3"` satisfies both build123d (`>=2,<3`) and scipy, and the warning disappea
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report - all three points are fixed in two commits on main:  1. Aider gitignore block (main bug) a3e4a85 dropped `temp_*.py` from .gitignore. Confirmed via `git check-ignore -v temp_design_0.py` -> exit 1 (no longer skipped). Side note: this same rule was also blocking two other Aider call sites (`_fill_unsupported_with_aider` and `generate_initial_solution`), not just the repair stage - all three are unblocked now. The other temp_output_* / temp_measurements_* / temp_missed_* patterns stay ignored since they're pure outputs.  2. numpy/scipy pin a3e4a85 tightened `numpy>=1.24,<3` to `numpy>=1.24,<2.3` across requirements.txt, pyproject.toml, README (EN+CN), and 0e0b4f9 added environment.yml + WORKFLOW.md. Resolves to numpy 2.2.x, which satisfies both build123d (>=2,<3) and scipy (<2.3.0). The SciPy import warning should be gone.  3. Engine B summary misleading a3e4a85 appended `Dims: pass/total OK|FAIL` to the Engine B summary line in `_run_engine_b_check_mesh`.
  > Pulled `main` (0e0b4f9), reverted my local workaround, and re-ran P5 three times. **Confirmed: the gitignore fix works.** `[AIDER REPAIR] Launching Aider on: temp_design_0.py` with no `Skipping ... gitignore spec` line, and the repair loop now actually edits the design.  ### Measured results  Backend was a local Qwen3.6-35B-A3B (8-bit MLX) over an OpenAI-compatible endpoint, so absolute quality is well below what you would get from a frontier model — the point here is the *change*, not the score.  Before your fix, three runs of the same prompt gave: a bare Ø3×10 drill cylinder, one good part, and a solid 209 614 mm³ block. After: no output, one good part, and **one fully correct part**.  Run 3, verified independently with build123d rather than from the pipeline's own report:  | Feature | Spec | Measured | |---|---|---| | Outer box | 100 × 70 × 30 | 100.00 × 70.00 × 30.00, Z 0…30 | | Wall / floor | 3 / 3 mm | inner floor at Z=3 ✓ | | Standoffs | Ø10, h=12 at X=±35, Y=±25 | r=5.00, axes 
  > Thanks for the detailed follow-up - the misdirection in the failure message is now fixed in c895114.  Root cause: _run_repair_on_script and its fallback _run_direct_repair_fallback both returned a plain bool, so the outer loop had no way to know why the repair failed. It hardcoded "cannot repair code (not installed or no API key)" - which was right for the original two failure modes (aider not installed, no API key) but wrong for everything else, including the request-timeout case you hit.  Fix: both functions now return tuple[bool, str | None] where the second element is a short reason identifying the actual cause. The outer node_autonomous_skill_loop unpacks it and prints "AIDER FAILED - {reason}." So your run would now log:  AIDER FAILED - API call failed: Request timed out. Halting immediately.  instead of the misleading "not installed or no API key".  Also replaced the inline hint "This usually means the API key is invalid or the model rejected the request" with "This is usually a

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

### Incident Patch 1: `d1de0a10` (2026-09-24)
**Commit Message**: docs: document web security controls and environment variables

Document X-MAC-CSRF usage and Batch C environment variables:

- MAC_WEB_HOST
- MAC_WEB_ALLOW_CUSTOM_ENDPOINT
- MAC_WEB_ALLOW_DEST_PATH
- MAC_WEB_DEST_ROOT
- MAC_CHILD_ENV_ALLOW

Clarify that environment-variable stripping reduces secret leakage but is not a sandbox.

**File**: `README.md` (modified, +42/-0)
```diff
@@ -223,6 +223,48 @@ your user account's permissions, so do not expose it directly to an untrusted
 network. Copying results to an arbitrary local directory is disabled unless
 `MAC_WEB_ALLOW_DEST_PATH=1` is explicitly set.
 
+#### Web UI security and environment variables
+
+State-changing API endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) require a
+custom `X-MAC-CSRF: 1` header. The browser frontend sends it automatically;
+non-browser clients (curl, HTTP libraries) must add it manually or the server
+returns `403`:
+
+```bash
+curl -X POST http://127.0.0.1:8000/api/run \
+  -H "X-MAC-CSRF: 1" \
+  -H "Content-Type: application/json" \
+  -d '{"user_request": "a 30 mm cube"}'
+```
+
+`GET` endpoints (`/api/health`, `/api/jobs`, status polling) are unaffected.
+
+The following environment variables control Web UI behavior:
+
+- `MAC_WEB_HOST` — bind address. Loopback values (`127.0.0.1`, `localhost`,
+  `::1`, the default) also enable a loopback `Host` allowlist as a
+  defense-in-depth CSRF layer. Binding to a non-loopback address (LAN
+  deployment) disables that layer; the `X-MAC-CSRF` header remains required.
+- `MAC_WEB_ALLOW_CUSTOM_ENDPOINT=1` — opt in to non-loopback
+  OpenAI-compatible `DS_BASE_URL` hosts: vLLM on a private hostname, a
+  corporate gateway, or Ollama / LM Studio on a non-loopback address. Default
+  off; otherwise the host must match the provider allowlist (loopback,
+  `api.openai.com`, `api.deepseek.com`, `generativelanguage.googleapis.com`,
+  `.aliyuncs.com`, `.googleapis.com`). Scheme (`http`/`https`) is always
+  enforced.
+- `MAC_WEB_ALLOW_DEST_PATH=1` — opt in to the `dest_path` artifact-copy
+  feature. When set, `MAC_WEB_DEST_ROOT` must also be set to an absolute
+  directory, and each request's `dest_path` must be relative and resolve
+  under that root. Absolute `dest_path` and `..` traversal are rejected.
+- `MAC_CHILD_ENV_ALLOW=VAR1,VAR2` — pass additional non-secret environment
+  variables through to the generated-Python subprocess (for example,
+  `HTTP_PROXY,HTTPS_PROXY` on a corporate network). The default allowlist is
+  `PATH`, `HOME`, `TMPDIR`, `TMP`, `TEMP`, `LANG`, `LC_ALL`, `LC_CTYPE`,
+  `PYTHONPATH`, `PYTHONIOENCODING`, `LD_LIBRARY_PATH`, `DYLD_LIBRARY_PATH`,
+  plus `ITERATION` set per child. **Never list API keys or credentials
+  here** — env-var stripping reduces secret leakage but does not sandbox
+  the subprocess; see [SECURITY.md](SECURITY.md).
+
 ### Generate an assembly
 
 Assembly input is also ordinary natural language. Run an included request:
```

**File**: `SECURITY.md` (modified, +6/-3)
```diff
@@ -30,9 +30,12 @@ This project executes model-generated Python code in a child process. A child
 process provides lifecycle isolation, **not a security sandbox**: generated code
 runs with the same operating-system permissions as the user who started MAC.
 Run the project only with trusted prompts and dependencies, preferably in a
-disposable container or restricted account. The Web UI binds to localhost by
-default and must not be exposed to an untrusted network without an independent
-authentication and sandboxing layer.
+disposable container or restricted account. This release strips
+environment-variable secrets from the generated-Python subprocess to reduce
+secret leakage; this is a mitigation, **not** a sandbox — filesystem, network,
+and process-spawn access with the operator's UID remain unchanged. The Web UI
+binds to localhost by default and must not be exposed to an untrusted network
+without an independent authentication and sandboxing layer.
 
 Reports of credential exposure, unsafe default network exposure, or unexpected
 access beyond the documented process privileges are in scope.
```

---

### Incident Patch 2: `61456eba` (2026-09-24)
**Commit Message**: test(release): add batch c security regression coverage

**File**: `tests/release/test_batch_c_security.py` (added, +653/-0)
```diff
@@ -0,0 +1,653 @@
+"""Batch C security regression tests.
+
+Covers BUG-011 (CSRF / browser boundary), BUG-012 (DS_BASE_URL),
+BUG-020 (dest_path), and BUG-010 (generated-code env hardening).
+
+All tests use FastAPI TestClient with mocked subprocess and LLM. No real
+network, no real API calls, no real generated-Python execution.
+"""
+from __future__ import annotations
+
+import asyncio
+import os
+import sys
+from pathlib import Path
+from unittest.mock import MagicMock, patch
+
+import pytest
+from fastapi.testclient import TestClient
+
+
+# ---------------------------------------------------------------------------
+# Fixtures
+# ---------------------------------------------------------------------------
+
+@pytest.fixture
+def web_env(monkeypatch):
+    """Default deployment env: loopback binding, no opt-ins."""
+    for k in (
+        "MAC_WEB_HOST",
+        "MAC_WEB_ALLOW_DEST_PATH",
+        "MAC_WEB_DEST_ROOT",
+        "MAC_WEB_ALLOW_CUSTOM_ENDPOINT",
+        "MAC_CHILD_ENV_ALLOW",
+    ):
+        monkeypatch.delenv(k, raising=False)
+    return monkeypatch
+
+
+class _FakeStdout:
+    """Async iterator over bytes lines — mimics asyncio.subprocess.Process.stdout."""
+
+    def __init__(self, lines):
+        self._lines = list(lines)
+
+    def __aiter__(self):
+        return self
+
+    async def __anext__(self):
+        if self._lines:
+            return self._lines.pop(0)
+        raise StopAsyncIteration
+
+
+@pytest.fixture
+def fake_proc():
+    """Stand-in for asyncio.subprocess.Process — no real subprocess."""
+    proc = MagicMock()
+    proc.returncode = None  # still "running"
+    proc.stdout = _FakeStdout([])
+    proc.stdin = None
+
+    async def _wait():
+        return 0
+
+    proc.wait = _wait
+    proc.terminate = MagicMock()
+    proc.kill = MagicMock()
+    return proc
+
+
+@pytest.fixture
+def client(web_env, fake_proc, monkeypatch):
+    """TestClient with subprocess spawn mocked out."""
+    async def _fake_create_subprocess_exec(*args, **kwargs):
+        return fake_proc
+
+    monkeypatch.setattr(asyncio, "create_subprocess_exec", _fake_create_subprocess_exec)
+    # Reset module-level job registry between tests so state doesn't leak.
+    from multi_agent_cad.web import server
+    server._JOBS.clear()
+    with TestClient(server.app, base_url="http://127.0.0.1:8000") as c:
+        yield c
+
+
+# ---------------------------------------------------------------------------
+# C1 — CSRF / browser boundary (BUG-011)
+# ---------------------------------------------------------------------------
+
+class TestCSRFMiddleware:
+    """C1: required custom header + loopback Host + Origin + Sec-Fetch-Site."""
+
+    def test_get_not_gated(self, client):
+        """GET endpoints are not subject to the CSRF guard."""
+        r = client.get("/api/health", headers={"Origin": "https://evil.example"})
+        assert r.status_code == 200
+        assert r.json()["status"] == "ok"
+
+    def test_missing_csrf_header_rejected(self, client):
+        """POST same-origin with no X-MAC-CSRF → 403."""
+        r = client.post(
+            "/api/run",
+            headers={
+                "Host": "127.0.0.1:8000",
+                "Origin": "http://127.0.0.1:8000",
+            },
+            json={"prompt": "x", "api_key": "k"},
+        )
+        assert r.status_code == 403
+        assert "X-MAC-CSRF" in r.json()["detail"]
+
+    def test_empty_csrf_header_rejected(self, client):
+        """POST with empty X-MAC-CSRF value → 403."""
+        r = client.post(
+            "/api/run",
+            headers={
+                "Host": "127.0.0.1:8000",
+                "X-MAC-CSRF": "   ",
+            },
+            json={"prompt": "x", "api_key": "k"},
+        )
+        assert r.status_code == 403
+        assert "X-MAC-CSRF" in r.json()["detail"]
+
+    def test_cross_origin_post_rejected(self, client):
+        """POST with cross-origin Origin (even with X-MAC-CSRF) → 403."""
+        r = cli
```

---

### Incident Patch 3: `2d9956cb` (2026-09-24)
**Commit Message**: fix(exec): isolate generated code subprocess environment

**File**: `multi_agent_cad/nodes.py` (modified, +58/-4)
```diff
@@ -59,6 +59,58 @@ def _safe_print(*args, **kwargs) -> None:
         print(*safe_args, **kwargs)
 
 
+# ---------------------------------------------------------------------------
+# C3 — Generated-Python subprocess env allowlist.
+#
+# The LLM-authored CAD script is executed via ``subprocess.run``. Passing the
+# full parent env leaks every operator-set secret (ANTHROPIC_API_KEY,
+# DEEPSEEK_API_KEY, etc.) plus the request-body api_key (DASHSCOPE_API_KEY,
+# OPENAI_API_KEY, OPENAI_API_BASE) into the child. The allowlist below keeps
+# only the runtime vars the script actually needs (PATH, locale, library
+# search paths, temp dir, PYTHONPATH) and passes ITERATION explicitly.
+#
+# This is env-secret stripping only. The generated Python still has the
+# launching user's filesystem and network access, so this is NOT a security
+# sandbox; the SECURITY.md disclaimer continues to apply. Real sandboxing
+# (containers / namespaces) is deferred to a future minor release.
+# ---------------------------------------------------------------------------
+_CHILD_ENV_ALLOWLIST = frozenset({
+    "PATH",
+    "HOME",
+    "TMPDIR",
+    "TMP",
+    "TEMP",
+    "LANG",
+    "LC_ALL",
+    "LC_CTYPE",
+    "PYTHONPATH",
+    "PYTHONIOENCODING",
+    "LD_LIBRARY_PATH",   # OCP / build123d native libs on Linux
+    "DYLD_LIBRARY_PATH",  # OCP / build123d native libs on macOS
+})
+
+_CHILD_ENV_ALLOW_OVERRIDE = "MAC_CHILD_ENV_ALLOW"
+
+
+def _build_child_env(iteration: int) -> dict[str, str]:
+    """Build an allowlisted env dict for the generated-Python subprocess.
+
+    ITERATION is set explicitly (the previous code mutated ``os.environ`` at
+    process level, which leaked the value into every other subprocess in the
+    web_runner; now it lives only in this child's env).
+
+    Operators who need additional vars (e.g. ``HTTP_PROXY`` for a corporate
+    network) set ``MAC_CHILD_ENV_ALLOW=VAR1,VAR2``; those names are added to
+    the allowlist on top of the defaults above.
+    """
+    extra = os.environ.get(_CHILD_ENV_ALLOW_OVERRIDE, "")
+    extra_names = {n.strip() for n in extra.split(",") if n.strip()}
+    allow = _CHILD_ENV_ALLOWLIST | extra_names
+    child_env = {k: v for k, v in os.environ.items() if k in allow}
+    child_env["ITERATION"] = str(iteration)
+    return child_env
+
+
 # ---------------------------------------------------------------------------
 # Qwen / DashScope client factory
 # ---------------------------------------------------------------------------
@@ -3163,6 +3215,7 @@ def node_python_coder(state: GraphState) -> dict:
             encoding="utf-8",
             timeout=_CFG_CAD_SCRIPT_TIMEOUT,
             cwd=str(cwd),
+            env=_build_child_env(iteration),
         )
     except subprocess.TimeoutExpired:
         return _coder_failure_state(
@@ -7182,10 +7235,10 @@ def _execute_cad_script(
     """
     cwd = script_path.parent
 
-    # Set ITERATION environment variable so the script can write measurements
-    # to the correct file (temp_measurements_{iteration}.json)
-    import os as _os
-    _os.environ["ITERATION"] = str(iteration)
+    # Build the child env using the C3 allowlist. ITERATION is set explicitly
+    # here; the previous code mutated ``os.environ`` at process level, which
+    # leaked the value into every other subprocess in the web_runner.
+    child_env = _build_child_env(iteration)
 
     # Delete stale runtime diagnostics from previous runs.
     # The generated script only writes temp_missed_{iter}.json if _MISSED_CUTS
@@ -7267,6 +7320,7 @@ def _execute_cad_script(
             errors="replace",
             timeout=timeout,
             cwd=str(cwd),
+            env=child_env,
         )
     except subprocess.TimeoutExpired:
         print(f"[EXECUTE CAD] Timed out after {timeout}s")
```

---

### Incident Patch 4: `2ec12c49` (2026-09-24)
**Commit Message**: fix(web): validate custom endpoints and artifact destinations

**File**: `multi_agent_cad/web/server.py` (modified, +125/-2)
```diff
@@ -174,6 +174,8 @@ async def _lifespan(app: FastAPI):
 
 _DEFAULT_HOST = "127.0.0.1"
 _ALLOW_DEST_PATH_ENV = "MAC_WEB_ALLOW_DEST_PATH"
+_ALLOW_CUSTOM_ENDPOINT_ENV = "MAC_WEB_ALLOW_CUSTOM_ENDPOINT"
+_DEST_ROOT_ENV = "MAC_WEB_DEST_ROOT"
 
 # C1 — Browser boundary / CSRF defense.
 # Loopback hosts allowed in the Host header when the server is bound to a
@@ -216,6 +218,95 @@ def _origin_host_port(origin: str) -> str:
     return parsed.hostname
 
 
+# C2 — DS_BASE_URL scheme + host allowlist.
+# Default deployment only accepts http(s) with host in the loopback set or
+# a recognized provider suffix. ``MAC_WEB_ALLOW_CUSTOM_ENDPOINT=1`` skips the
+# host check (scheme check still applies) for operators running corporate
+# gateways, vLLM on a private host, etc.
+_ALLOWED_DS_SCHEMES = frozenset({"http", "https"})
+_PROVIDER_HOST_EXACT = frozenset({
+    "api.openai.com",
+    "api.deepseek.com",
+    "generativelanguage.googleapis.com",
+})
+_PROVIDER_HOST_SUFFIXES = (
+    ".aliyuncs.com",       # DashScope regional endpoints (token-plan.cn-beijing.maas.aliyuncs.com, etc.)
+    ".googleapis.com",     # Google Gemini OpenAI-compatible endpoint family
+)
+
+
+def _is_allowed_ds_base_url(url: str) -> bool:
+    """Return True if ``url`` is acceptable as ``config.DS_BASE_URL``.
+
+    Empty / whitespace-only URLs are accepted (config default is used).
+    Scheme must be ``http`` or ``https``. Host must be loopback or a
+    recognized provider suffix unless ``MAC_WEB_ALLOW_CUSTOM_ENDPOINT=1``.
+    """
+    if not url or not url.strip():
+        return True
+    try:
+        parsed = urlparse(url.strip())
+    except ValueError:
+        return False
+    scheme = (parsed.scheme or "").lower()
+    if scheme not in _ALLOWED_DS_SCHEMES:
+        return False
+    host = (parsed.hostname or "").lower()
+    if not host:
+        return False
+    if os.environ.get(_ALLOW_CUSTOM_ENDPOINT_ENV) == "1":
+        return True
+    if host in _LOOPBACK_HOSTS:
+        return True
+    if host in _PROVIDER_HOST_EXACT:
+        return True
+    return any(host.endswith(suf) for suf in _PROVIDER_HOST_SUFFIXES)
+
+
+def _validate_dest_path(dest: str) -> Path:
+    """Resolve ``dest`` against ``MAC_WEB_DEST_ROOT``.
+
+    Pre-conditions (checked by caller): ``dest`` is non-empty and
+    ``MAC_WEB_ALLOW_DEST_PATH=1`` is set. This function:
+
+    1. Requires ``MAC_WEB_DEST_ROOT`` (absolute path) to be set.
+    2. Rejects absolute ``dest`` values.
+    3. Resolves ``root / dest`` and requires the result to remain under
+       the resolved root (blocks ``..`` traversal).
+
+    Returns the resolved absolute path on success. Raises ``HTTPException``
+    with status 400 on any violation.
+    """
+    root_env = os.environ.get(_DEST_ROOT_ENV, "").strip()
+    if not root_env:
+        raise HTTPException(
+            400,
+            "MAC_WEB_DEST_ROOT must be set to an absolute directory when "
+            "MAC_WEB_ALLOW_DEST_PATH=1; dest_path is interpreted relative to that root",
+        )
+    root = Path(root_env)
+    if not root.is_absolute():
+        raise HTTPException(
+            400,
+            "MAC_WEB_DEST_ROOT must be an absolute directory path",
+        )
+    p = Path(dest)
+    if p.is_absolute():
+        raise HTTPException(
+            400,
+            "dest_path must be relative, not absolute",
+        )
+    root_resolved = root.resolve(strict=False)
+    resolved = (root_resolved / p).resolve(strict=False)
+    if not resolved.is_relative_to(root_resolved):
+        raise HTTPException(
+            400,
+            "dest_path escapes MAC_WEB_DEST_ROOT",
+        )
+    return resolved
+
+
+
 @app.middleware("http")
 async def _csrf_guard(request: Request, call_next):
     """Gate state-changing endpoints behind browser-boundary defenses.
@@ -308,12 +399,27 @@ async def run(req: Request) -> dict:
         raise HTTPException(400, "prompt is required")
     if not api_key:
         raise HTTPException(400, "api_
```

---

### Incident Patch 5: `d6df2d39` (2026-09-24)
**Commit Message**: fix(web): add csrf protection for state-changing requests

**File**: `multi_agent_cad/web/server.py` (modified, +110/-0)
```diff
@@ -29,6 +29,7 @@
 from contextlib import asynccontextmanager
 from pathlib import Path
 from typing import Any
+from urllib.parse import urlparse
 
 try:
     from fastapi import FastAPI, HTTPException, Request
@@ -174,6 +175,115 @@ async def _lifespan(app: FastAPI):
 _DEFAULT_HOST = "127.0.0.1"
 _ALLOW_DEST_PATH_ENV = "MAC_WEB_ALLOW_DEST_PATH"
 
+# C1 — Browser boundary / CSRF defense.
+# Loopback hosts allowed in the Host header when the server is bound to a
+# loopback address (default deployment). DNS-rebinding attacks present a
+# non-loopback Host header (e.g. "attacker.example"); this allowlist blocks
+# them as defense-in-depth behind the required custom-header check.
+_LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
+_STATE_CHANGING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
+_CSRF_HEADER = "X-MAC-CSRF"
+
+
+def _split_host_port(host_header: str) -> str:
+    """Return the host part (no port) of a Host header value.
+
+    Handles bracketed IPv6 literals: ``[::1]:8000`` → ``::1``.
+    """
+    if not host_header:
+        return ""
+    s = host_header.strip()
+    if s.startswith("["):
+        end = s.find("]")
+        if end != -1:
+            return s[1:end]
+        return s
+    return s.split(":", 1)[0]
+
+
+def _origin_host_port(origin: str) -> str:
+    """Return ``host[:port]`` extracted from an Origin header, or ``""``."""
+    if not origin:
+        return ""
+    try:
+        parsed = urlparse(origin.strip())
+    except ValueError:
+        return ""
+    if not parsed.hostname:
+        return ""
+    if parsed.port:
+        return f"{parsed.hostname}:{parsed.port}"
+    return parsed.hostname
+
+
+@app.middleware("http")
+async def _csrf_guard(request: Request, call_next):
+    """Gate state-changing endpoints behind browser-boundary defenses.
+
+    Layers (any one rejects with 403):
+
+    1. Required custom header ``X-MAC-CSRF`` (non-empty). Browser
+       cross-origin JS cannot set custom headers without a satisfied
+       CORS preflight, which this server never provides. Primary
+       DNS-rebinding-safe defense.
+    2. Loopback ``Host`` allowlist when ``MAC_WEB_HOST`` is loopback
+       (default). Rejects DNS-rebinding hosts. Skipped when the operator
+       has explicitly bound to a non-loopback address.
+    3. ``Origin`` validation when the header is present: the origin's
+       host:port must equal ``Host`` or both sides must be loopback.
+       Absent ``Origin`` (non-browser client) is allowed.
+    4. ``Sec-Fetch-Site: cross-site`` is rejected.
+
+    No ``CORSMiddleware`` is added — CORS controls response readability,
+    not the side effect, and a permissive policy would weaken the boundary.
+    """
+    method = request.method.upper()
+    if method not in _STATE_CHANGING_METHODS:
+        return await call_next(request)
+
+    # 1. Required custom header.
+    csrf_value = request.headers.get(_CSRF_HEADER, "").strip()
+    if not csrf_value:
+        return JSONResponse(
+            status_code=403,
+            content={"detail": "missing X-MAC-CSRF header"},
+        )
+
+    # 2. Loopback Host allowlist (default deployment only).
+    host_binding = os.environ.get("MAC_WEB_HOST", _DEFAULT_HOST)
+    if host_binding in _LOOPBACK_HOSTS:
+        host_header = request.headers.get("Host", "")
+        host_part = _split_host_port(host_header)
+        if host_part not in _LOOPBACK_HOSTS:
+            return JSONResponse(
+                status_code=403,
+                content={"detail": "Host header not in loopback allowlist; set MAC_WEB_HOST to a non-loopback value to disable this check"},
+            )
+
+    # 3. Origin validation when present.
+    origin = request.headers.get("Origin", "").strip()
+    if origin:
+        origin_hp = _origin_host_port(origin)
+        host_header = request.headers.get("Host", "")
+        if origin_hp and origin_hp != host_header:
+            origin_host = _split_host_port(origin_hp)
+            req
```

**File**: `multi_agent_cad/web/static/app.js` (modified, +5/-2)
```diff
@@ -91,7 +91,7 @@ document.getElementById("run-btn").addEventListener("click", async () => {
 
   const r = await fetch("/api/run", {
     method: "POST",
-    headers: { "Content-Type": "application/json" },
+    headers: { "Content-Type": "application/json", "X-MAC-CSRF": "1" },
     body: JSON.stringify(body),
   });
   if (!r.ok) {
@@ -113,7 +113,10 @@ document.getElementById("stop-btn").addEventListener("click", async () => {
   stopBtn.textContent = "Cancelling...";
   status.textContent = "Cancelling — waiting for subprocess to exit...";
   try {
-    await fetch(`/api/jobs/${currentJobId}/cancel`, { method: "POST" });
+    await fetch(`/api/jobs/${currentJobId}/cancel`, {
+      method: "POST",
+      headers: { "X-MAC-CSRF": "1" },
+    });
   } catch (e) {
     status.textContent = "Cancel request failed: " + e;
     stopBtn.disabled = false;
```

---

### Incident Patch 6: `9ab4329e` (2026-09-24)
**Commit Message**: fix: reject degenerate mate graphs and invalid mesh volumes

Reject empty, disconnected, and cyclic multi-part mating plans.

Treat zero, non-finite, and unreadable mesh volumes as unverifiable during interference QA.

Fail URDF export closed for zero or non-finite link meshes so invalid inertial data is never emitted.

Add tracked regression coverage for mating graphs, zero-volume meshes, NaN/inf volumes, and normal closed-mesh behavior.

**File**: `mac_assembly/assembly_qa.py` (modified, +49/-0)
```diff
@@ -49,6 +49,14 @@
 from multi_agent_cad.render_views import _render_isometric_views
 
 
+# Volume below which a mesh is treated as zero-volume for interference
+# probing (BUG-016). ``_pair_collides`` uses ``min(|Va|, |Vb|)`` as a
+# penetration proxy; a zero-volume mesh (flat plate, single-triangle STL,
+# sheet metal without thickness) zeroes the proxy and false-passes. The
+# epsilon catches near-degenerate shells (floating-point thickness).
+_ZERO_VOLUME_EPS_MM3 = 1e-9
+
+
 # ---------------------------------------------------------------------------
 # Geometry loading
 # ---------------------------------------------------------------------------
@@ -1499,6 +1507,47 @@ def _pair_collides(mesh_a, mesh_b) -> tuple[bool | None, str, float]:
         None to "no collision" was a false PASS.
     """
     depth_tol = cfg.INTERFERENCE_DEPTH_TOL_MM
+    # Zero-volume / non-finite mesh guard (BUG-016): the volume-based
+    # penetration proxy ``vol = frac * min(|Va|, |Vb|)`` collapses to 0
+    # when either mesh has no enclosed volume (flat plates, sheet metal,
+    # single-triangle STLs). ``vol <= tol`` is then trivially true and the
+    # pair false-passes even when a zero-volume plate clearly crosses a
+    # closed box. NaN/inf volume (from a malformed mesh where trimesh's
+    # ``center_mass = integrated[1:4] / volume`` divides by zero, or from a
+    # property that raises on a degenerate shell) bypasses the ``<= eps``
+    # comparison entirely (``nan <= x`` is False) and the proxy propagates
+    # NaN, producing a nonsense collision verdict. Return UNVERIFIABLE --
+    # the volume proxy is degenerate for this geometry, and surface
+    # sampling alone is not an authoritative collision test. The try wraps
+    # the property access: ``getattr`` only defaults when the attribute is
+    # ABSENT, not when the property RAISES, so a raising ``volume``
+    # property would escape the function and crash the QA pipeline.
+    try:
+        vol_a = float(abs(getattr(mesh_a, "volume", 0.0)))
+        vol_b = float(abs(getattr(mesh_b, "volume", 0.0)))
+    except Exception:  # noqa: BLE001 - volume property raised (malformed mesh)
+        return (
+            None,
+            "UNVERIFIABLE (mesh.volume property raised) -- cannot "
+            "establish a finite volume for the collision probe",
+            0.0,
+        )
+    bad_a = (not math.isfinite(vol_a)) or vol_a <= _ZERO_VOLUME_EPS_MM3
+    bad_b = (not math.isfinite(vol_b)) or vol_b <= _ZERO_VOLUME_EPS_MM3
+    if bad_a or bad_b:
+        if bad_a and bad_b:
+            zero_side = "both meshes"
+        elif bad_a:
+            zero_side = "mesh_a"
+        else:
+            zero_side = "mesh_b"
+        return (
+            None,
+            f"UNVERIFIABLE (zero-volume {zero_side}: vol_a={vol_a:.3e}, "
+            f"vol_b={vol_b:.3e}) -- volume-based penetration proxy is "
+            f"degenerate; surface sampling alone is not authoritative",
+            0.0,
+        )
     try:
         pts_a = _sample_surface(mesh_a)
         pts_b = _sample_surface(mesh_b)
```

**File**: `mac_assembly/nodes_assembly.py` (modified, +23/-1)
```diff
@@ -1284,7 +1284,29 @@ def _validate_mating_plan(plan: MatingPlan, brief: AssemblyBrief) -> list[str]:
 
     moved = [m.moving_part_id for m in plan.mates]
     unmoved = graph_part_ids - set(moved)
-    if plan.mates:
+    n_graph = len(graph_part_ids)
+    # Edge-count necessary condition (BUG-013): a tree on N nodes needs N-1
+    # edges. The Pydantic schema can't enforce this because it doesn't see
+    # the brief (and ``len(brief.parts)`` over-counts template-only parts).
+    # Catches the silent-under-expansion case: 3 non-template parts + 0
+    # mates used to pass validation and the assembler emitted only the
+    # root part while QA reported PASS.
+    if n_graph > 1 and len(plan.mates) < n_graph - 1:
+        errors.append(
+            f"mate graph is under-connected: {len(plan.mates)} mate(s) for "
+            f"{n_graph} non-template part(s) -- a spanning tree needs at "
+            f"least {n_graph - 1} mate(s)"
+        )
+    # Connectivity / single-root / acyclicity checks. The ``plan.mates``
+    # guard used to skip these when mates was empty, which let multi-part
+    # briefs with zero mates through. Use ``n_graph > 1`` instead: a
+    # single-part (or empty) graph is trivially valid; a multi-part graph
+    # needs exactly one fixed root (``unmoved`` size 1), and a toposort
+    # that consumes every mate (else there's a cycle in a sub-component).
+    # The unmoved set IS the connectivity check -- a disconnected graph
+    # has >= 2 unmoved roots (forest) or 0 (cycle through all parts);
+    # toposort catches the mixed case (one tree + one cyclic component).
+    if n_graph > 1:
         if not unmoved:
             errors.append("every part is moved by some mate -- need a fixed root")
         elif len(unmoved) > 1:
```

**File**: `mac_assembly/urdf_export.py` (modified, +54/-0)
```diff
@@ -71,6 +71,15 @@
 DEG_TO_RAD = math.pi / 180.0
 DEFAULT_DENSITY_KG_M3 = 1000.0
 
+# Volume below which a link mesh is treated as zero-volume (BUG-008).
+# ``_inertial_from_mesh`` already returns mass=0 for ``mesh.volume <= 0``;
+# the preflight uses the same threshold (with a small epsilon to catch
+# near-degenerate shells) so a zero-volume link never reaches _emit_link
+# -- a URDF missing <inertial> blocks lets PyBullet silently assign
+# mass=1.0 and MuJoCo reject outright. Kept local rather than imported
+# from assembly_qa to avoid coupling the two modules' volume contracts.
+_ZERO_VOLUME_EPS_MM3 = 1e-9
+
 # Principal axis name -> URDF <axis xyz> string (ball decomposition).
 _AXIS_STRS = {"x": "1 0 0", "y": "0 1 0", "z": "0 0 1"}
 
@@ -147,6 +156,51 @@ def export_urdf(work_dir: Path | str, brief=None) -> Path | None:
             print(f"  [urdf] no STL for part(s) {missing}; skipping URDF export")
             return None
 
+        # Zero-volume mesh preflight (BUG-008): a zero-volume link emits
+        # <visual> + <collision> but no <inertial> -- _inertial_from_mesh
+        # returns mass=0 for ``mesh.volume <= 0`` and _emit_link then skips
+        # the <inertial> block. PyBullet silently assigns mass=1.0 (with a
+        # printed warning); MuJoCo rejects the URDF outright. Fail closed
+        # at preflight instead of emitting a URDF with wrong dynamics.
+        # Runs BEFORE any link is emitted so no half-URDF reaches disk.
+        try:
+            import trimesh  # noqa: F401
+        except ImportError:
+            print("  [urdf] trimesh unavailable; cannot preflight mesh volumes; skipping URDF export")
+            return None
+        zero_vol_links = []
+        for label in labels:
+            stl_path = mesh_by_label[label]
+            # Load + volume probe in one try: ``getattr`` only defaults when
+            # the attribute is ABSENT, not when the property RAISES, so a
+            # raising ``volume`` property (malformed mesh) must be caught
+            # here rather than escape to the outer handler and print a
+            # generic "export failed". NaN/inf volume (``nan <= eps`` is
+            # False) would otherwise pass the preflight and let
+            # ``_inertial_from_mesh`` compute ``mass = nan`` (skipping
+            # ``<inertial>`` -- the exact BUG-008 regression) or
+            # ``mass = inf`` (emitting ``<inertial>`` with non-finite
+            # dynamics that PyBullet/MuJoCo reject).
+            try:
+                _preflight_mesh = trimesh.load(str(stl_path), force="mesh")
+                preflight_empty = bool(getattr(_preflight_mesh, "is_empty", False))
+                preflight_vol = float(getattr(_preflight_mesh, "volume", 0.0))
+            except Exception as exc:  # noqa: BLE001 - load/volume failure = unverifiable
+                print(f"  [urdf] mesh load or volume probe failed for {label!r}: {exc}; skipping URDF export")
+                return None
+            if (
+                preflight_empty
+                or not math.isfinite(preflight_vol)
+                or preflight_vol <= _ZERO_VOLUME_EPS_MM3
+            ):
+                zero_vol_links.append(label)
+        if zero_vol_links:
+            print(
+                f"  [urdf] zero-volume mesh for link(s) {sorted(zero_vol_links)}; "
+                f"refusing to emit URDF with wrong dynamics (fix the part geometry)"
+            )
+            return None
+
         for label in labels:
             mesh_dst = meshes_dir / f"{label}.stl"
             shutil.copyfile(mesh_by_label[label], mesh_dst)
```

**File**: `tests/release/test_batch_b_regressions.py` (added, +535/-0)
```diff
@@ -0,0 +1,535 @@
+"""Tracked runtime regression guards for Batch B fixes.
+
+These tests exercise the runtime contracts behind the Batch B production
+fixes -- they do not call any external model.
+
+* BUG-013: ``_validate_mating_plan`` rejects multi-part briefs whose mate
+  graph is empty / under-connected / disconnected / cyclic. Before the
+  fix, an empty ``mates`` list plus an empty ``interfaces`` list passed
+  validation for any ``len(parts)`` -- the assembler then emitted only
+  the root part while QA reported PASS.
+
+* BUG-016: ``_pair_collides`` returns ``None`` (UNVERIFIABLE) -- never
+  ``False`` -- when either mesh has zero volume. Before the fix, the
+  ``vol = frac * min(abs(mesh_a.volume), abs(mesh_b.volume))`` proxy
+  collapsed to 0 and the pair reported "no collision" even when a flat
+  plate clearly crossed a closed box.
+
+* BUG-008: ``export_urdf`` fails closed (returns ``None``) when any link
+  resolves to a zero-volume mesh, instead of emitting a URDF that skips
+  ``<inertial>`` and lets PyBullet assign mass=1. The preflight runs
+  before any link is emitted so no half-URDF is left on the final path.
+"""
+from __future__ import annotations
+
+import json
+import tempfile
+import unittest
+from pathlib import Path
+from unittest.mock import patch
+
+import pytest
+import trimesh
+
+from mac_assembly.schemas_assembly import (
+    Anchor,
+    AnchorKind,
+    AssemblyBrief,
+    MateSpec,
+    MateType,
+    MatingPlan,
+    PartSpec,
+)
+from mac_assembly.nodes_assembly import _validate_mating_plan
+
+
+# ---------------------------------------------------------------------------
+# Test fixtures
+# ---------------------------------------------------------------------------
+
+def _brief(part_ids):
+    """AssemblyBrief with N non-template parts and no interfaces."""
+    return AssemblyBrief(
+        assembly_name="t",
+        user_request_raw="t",
+        parts=[
+            PartSpec(part_id=pid, part_name=pid.upper(), description=pid)
+            for pid in part_ids
+        ],
+        interfaces=[],
+    )
+
+
+def _rigid_mate(mid, fixed, moving):
+    """Minimal RIGID mate between two parts (AXIS_POINT anchors on Z)."""
+    return MateSpec(
+        mate_id=mid,
+        mate_type=MateType.RIGID,
+        fixed_part_id=fixed,
+        moving_part_id=moving,
+        fixed_anchor=Anchor(kind=AnchorKind.AXIS_POINT, axis="z", offset_mm=0.0),
+        moving_anchor=Anchor(kind=AnchorKind.AXIS_POINT, axis="z", offset_mm=0.0),
+    )
+
+
+# ---------------------------------------------------------------------------
+# BUG-013 -- _validate_mating_plan tree invariants
+# ---------------------------------------------------------------------------
+
+class TestValidateMatingPlanTreeInvariants(unittest.TestCase):
+    """Cover the seven contract cases listed in the BUG-013 brief."""
+
+    def test_single_part_zero_mates_is_valid(self):
+        brief = _brief(["a"])
+        plan = MatingPlan(assembly_name="t", mates=[])
+        self.assertEqual(_validate_mating_plan(plan, brief), [])
+
+    def test_two_parts_zero_mates_is_invalid(self):
+        brief = _brief(["a", "b"])
+        plan = MatingPlan(assembly_name="t", mates=[])
+        errs = _validate_mating_plan(plan, brief)
+        self.assertGreaterEqual(len(errs), 1)
+        self.assertTrue(
+            any("under-connected" in e for e in errs),
+            f"expected an under-connected error, got {errs}",
+        )
+
+    def test_three_parts_zero_mates_is_invalid(self):
+        brief = _brief(["a", "b", "c"])
+        plan = MatingPlan(assembly_name="t", mates=[])
+        errs = _validate_mating_plan(plan, brief)
+        self.assertGreaterEqual(len(errs), 1)
+        self.assertTrue(
+            any("under-connected" in e for e in errs),
+            f"expected an under-connected error, got {errs}",
+        )
+
+    def test_three_parts_one_edge_is_invalid(self):
+        brief = _brief(["a", "b", "c"])
+        plan = Mat
```

---

### Incident Patch 7: `d63de094` (2026-09-24)
**Commit Message**: fix: harden CAD generation and builder dispatch

* register bent_jaw_xz builder
* preserve deterministic coder failure routing
* use the final fenced JSON block from LLM responses
* keep build123d reference context read-only in Aider
* add tracked regression coverage
* sync assembly builder count

**File**: `mac_assembly/README.md` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ PartBuilder chooses the smallest reliable path for each component:
    an independent opposite-handed component, such as a right jaw derived from
    a left jaw.
 
-The current [`BUILDERS`](builders.py) registry contains **28** parameterized
+The current [`BUILDERS`](builders.py) registry contains **29** parameterized
 builders. Treat the source registry as authoritative if this number changes.
 Builders target common failure-prone structures such as horizontal bores,
 clevises, linkage bars, plates, bushings, yokes, trussed arm links, and sensor
```

**File**: `mac_assembly/builders.py` (modified, +1/-0)
```diff
@@ -2081,6 +2081,7 @@ def rounded_palm_plate_xy(
     "crane_counterweight_frame": crane_counterweight_frame,
     "rounded_finger_bar_y": rounded_finger_bar_y,
     "rounded_palm_plate_xy": rounded_palm_plate_xy,
+    "bent_jaw_xz": bent_jaw_xz,
 }
 
 
```

**File**: `multi_agent_cad/nodes.py` (modified, +20/-13)
```diff
@@ -792,6 +792,11 @@ def _node_python_coder_deterministic(
     # Pre-compute node_history for failure state
     _coder_history = list(state.get("node_history", [])) + ["coder"]
 
+    cwd = Path.cwd()
+    script_path = cwd / f"temp_design_{iteration}.py"
+    step_path = cwd / f"temp_output_{iteration}.step"
+    stl_path = cwd / f"temp_output_{iteration}.stl"
+
     try:
         code = _plan_to_code(architect_plan, iteration)
     except NotImplementedError as e:
@@ -805,15 +810,10 @@ def _node_python_coder_deterministic(
         return _coder_failure_state(
             iteration=iteration,
             error_message=f"Deterministic coder code generation failed: {e}\n\nTraceback:\n{traceback.format_exc()}",
-            script_path=str(cwd / f"temp_design_{iteration}.py"),
+            script_path=str(script_path),
             node_history=_coder_history,
         )
 
-    cwd = Path.cwd()
-    script_path = cwd / f"temp_design_{iteration}.py"
-    step_path = cwd / f"temp_output_{iteration}.step"
-    stl_path = cwd / f"temp_output_{iteration}.stl"
-
     # Split generated code at the solids marker.
     # Module-level: imports, shim, key_dimensions, helper functions.
     # gen_step body: solid generation, export, return.
@@ -2869,7 +2869,8 @@ def _fill_unsupported_with_aider(
         coder = Coder.create(
             main_model=model,
             io=io,
-            fnames=[str(script_path), _BUILD123D_REF],
+            fnames=[str(script_path)],
+            read_only_fnames=[_BUILD123D_REF],
             auto_commits=False,
             # Assembly jobs are intentionally gitignored runtime artifacts.
             # These paths are explicitly supplied by the workflow and must
@@ -5819,15 +5820,19 @@ def _to_verification_target(raw) -> VerificationTarget | None:
 def _extract_json_from_llm(raw: str) -> str:
     """Aggressively extract JSON object from LLM response.
 
-    1. Try `` ```json { ... } ``` `` or `` ``` { ... } ``` `` fences.
+    1. Try `` ```json { ... } ``` `` or `` ``` { ... } ``` `` fences. If
+       multiple fenced JSON blocks appear (e.g. an example followed by the
+       actual answer), the *last* one is returned -- matches the contract
+       of ``_extract_code_from_llm_response`` where the final block is the
+       complete payload.
     2. Fall back to outermost ``{ ... }`` span via rfind.
     3. Return raw text if nothing matches.
     """
     # Priority 1: fenced JSON block — use greedy .* so nested braces work
     pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
-    match = re.search(pattern, raw, flags=re.DOTALL)
-    if match:
-        content = match.group(1).strip()
+    matches = re.findall(pattern, raw, flags=re.DOTALL)
+    if matches:
+        content = matches[-1].strip()
         # Find the outermost JSON object inside the fence content
         start = content.find("{")
         end = content.rfind("}")
@@ -6758,7 +6763,8 @@ def generate_initial_solution(
                 coder = Coder.create(
                     main_model=model,
                     io=io,
-                    fnames=[script_path, _BUILD123D_REF],
+                    fnames=[script_path],
+                    read_only_fnames=[_BUILD123D_REF],
                     auto_commits=False,
                     add_gitignore_files=True,
                 )
@@ -6955,7 +6961,8 @@ def _run_repair_on_script(
                 coder = Coder.create(
                     main_model=model,
                     io=io,
-                    fnames=[script_path, _BUILD123D_REF],
+                    fnames=[script_path],
+                    read_only_fnames=[_BUILD123D_REF],
                     auto_commits=False,
                     add_gitignore_files=True,
                 )
```

**File**: `tests/release/test_batch_a_regressions.py` (added, +228/-0)
```diff
@@ -0,0 +1,228 @@
+"""Tracked runtime regression guards for Batch A fixes.
+
+These tests exercise the runtime contracts behind the Batch A production
+fixes -- they do not call any external model.
+
+* BUG-002: ``_node_python_coder_deterministic`` routes a non-
+  ``NotImplementedError`` from ``_plan_to_code`` to a failure-state dict
+  (preserving ``coder`` in ``node_history``) and returns ``None`` for
+  ``NotImplementedError`` to trigger the LLM fallback.  Before the fix,
+  ``cwd`` was first assigned inside the ``try`` body, so the ``except``
+  handler raised ``UnboundLocalError`` and the autonomous repair loop
+  never saw the failure.
+
+* BUG-007: Aider's three ``Coder.create(...)`` call sites in
+  ``multi_agent_cad/nodes.py`` pass ``_BUILD123D_REF`` via
+  ``read_only_fnames=[...]`` (read-only context), never via editable
+  ``fnames=[...]``.  ``script_path`` remains editable; ``auto_commits=False``
+  and ``add_gitignore_files=True`` are preserved.  Before the fix, the
+  reference doc was editable and the LLM could corrupt it across runs.
+
+The BUG-002 tests run in CI.  The BUG-007 tests self-skip when aider is
+not installed (e.g. the release-contract CI job, which uses only the
+core dependencies).  They run locally and in any environment that has
+``aider-chat`` installed.
+"""
+from __future__ import annotations
+
+import os
+from pathlib import Path
+from unittest import mock
+
+import pytest
+
+from multi_agent_cad import nodes as mac_nodes
+
+
+# ---------------------------------------------------------------------------
+# BUG-002 — runtime failure routing
+# ---------------------------------------------------------------------------
+@pytest.mark.parametrize(
+    "exc",
+    [
+        KeyError("missing field"),
+        TypeError("bad type"),
+        ValueError("bad value"),
+        RuntimeError("runtime issue"),
+        AttributeError("missing attribute"),
+    ],
+    ids=lambda exc: type(exc).__name__,
+)
+def test_coder_deterministic_failure_routing_returns_failure_state(exc):
+    """A non-NotImplementedError from _plan_to_code must route to a
+    failure-state dict -- not raise UnboundLocalError.  ``coder`` must
+    appear in ``node_history`` and the failure description must reach
+    ``qa_report.error_details`` and ``execution_log`` so the autonomous
+    repair loop can consume it.
+    """
+    with mock.patch("multi_agent_cad.nodes._plan_to_code", side_effect=exc):
+        result = mac_nodes._node_python_coder_deterministic(
+            state={}, architect_plan=object(), iteration=0
+        )
+
+    assert isinstance(result, dict), (
+        f"{type(exc).__name__} must produce a failure-state dict, not raise"
+    )
+    assert "coder" in result["node_history"], (
+        "coder round must be recorded in node_history"
+    )
+    qa_report = result.get("qa_report")
+    assert qa_report is not None, "failure state must carry a qa_report"
+    error_details = getattr(qa_report, "error_details", []) or []
+    assert any("Deterministic coder code generation failed" in d for d in error_details), (
+        f"qa_report.error_details must carry the failure description; got: {error_details}"
+    )
+    log_lines = result.get("execution_log", []) or []
+    assert any("Deterministic coder code generation failed" in line for line in log_lines), (
+        f"execution_log must carry the failure description; got: {log_lines}"
+    )
+
+
+def test_coder_deterministic_not_implemented_returns_none_for_llm_fallback():
+    """NotImplementedError must return None so the workflow falls back to the
+    LLM coder -- this is the intentional escape hatch, not a crash.
+    """
+    with mock.patch(
+        "multi_agent_cad.nodes._plan_to_code",
+        side_effect=NotImplementedError("unsupported op"),
+    ):
+        result = mac_nodes._node_python_coder_deterministic(
+            state={}, architect_plan=object(), iteration=0
+        )
+    assert result is None
+
+
+# -----------------------
```

**File**: `tests/release/test_release_contract.py` (modified, +171/-0)
```diff
@@ -14,6 +14,8 @@
 import tomllib
 from pathlib import Path
 
+import pytest
+
 
 ROOT = Path(__file__).resolve().parents[2]
 
@@ -113,3 +115,172 @@ def test_readme_local_markdown_links_exist() -> None:
                 continue
             clean = target.split("#", 1)[0]
             assert (ROOT / clean).exists(), f"broken link in {readme.name}: {target}"
+
+
+def test_assembly_prompt_builders_registered() -> None:
+    """Every builder.name referenced by a tracked assembly prompt must be
+    a registered key in BUILDERS, so the PartBuilder dispatch can resolve it.
+    Helper functions in builders.py are intentionally not registered -- this
+    test only enforces the contract from the prompt side.
+    """
+    from mac_assembly.builders import BUILDERS
+
+    prompt_root = ROOT / "mac_assembly" / "assembly_prompts"
+    referenced: dict[str, list[str]] = {}
+    for path in sorted(prompt_root.rglob("*.md")):
+        text = path.read_text(encoding="utf-8")
+        for match in re.finditer(r"^\s*builder\.name\s*=\s*([A-Za-z_][A-Za-z0-9_]*)", text, re.MULTILINE):
+            name = match.group(1)
+            referenced.setdefault(name, []).append(str(path.relative_to(ROOT)))
+    assert referenced, "expected at least one builder.name reference in assembly prompts"
+    missing = [name for name in referenced if name not in BUILDERS]
+    assert not missing, (
+        f"assembly prompts reference builders missing from BUILDERS: "
+        f"{ {name: referenced[name] for name in missing} }"
+    )
+
+
+def test_bent_jaw_xz_smoke() -> None:
+    """build_part('bent_jaw_xz', ...) must dispatch to the builder and
+    return a Compound -- guards the BUG-001 regression where the builder
+    was defined but absent from BUILDERS.
+    """
+    pytest.importorskip("build123d")
+    from mac_assembly.builders import build_part
+
+    result = build_part("bent_jaw_xz", {"side": "left"})
+    assert result is not None
+    assert hasattr(result, "solids")
+    solids = list(result.solids())
+    assert len(solids) == 1
+
+
+def _extract_json_cases() -> list[tuple[str, str, str]]:
+    return [
+        (
+            "single_fence",
+            '```json\n{"a": 1}\n```',
+            '{"a": 1}',
+        ),
+        (
+            "example_then_actual",
+            'Sure, here is an example:\n```json\n{"example": 1}\n```\n'
+            'And the actual answer:\n```json\n{"actual": 2}\n```',
+            '{"actual": 2}',
+        ),
+        (
+            "prose_then_single_fence",
+            'Prose text before.\n```json\n{"x": 7}\n```',
+            '{"x": 7}',
+        ),
+        (
+            "no_fence_with_inline_object",
+            'text {"no": "fence"} trailing',
+            '{"no": "fence"}',
+        ),
+        (
+            "two_fences_last_with_surrounding_prose",
+            '```json\n{"first": 1}\n```\nprose between\n'
+            '```json\nleading prose {"last": 2} trailing prose\n```',
+            '{"last": 2}',
+        ),
+    ]
+
+
+@pytest.mark.parametrize("name, raw, expected", _extract_json_cases())
+def test_extract_json_last_fenced_block(name: str, raw: str, expected: str) -> None:
+    """BUG-003: `_extract_json_from_llm` must return the LAST fenced JSON
+    block (not the first), matching `_extract_code_from_llm_response`'s
+    last-block-wins contract.  The no-fence fallback and the outermost
+    ``{ ... }`` span extraction inside a fence must be preserved.
+    """
+    import json
+
+    from multi_agent_cad.nodes import _extract_json_from_llm
+
+    result = _extract_json_from_llm(raw)
+    assert result == expected, f"[{name}] expected {expected!r}, got {result!r}"
+    # The extracted string must be valid JSON for all five cases.
+    json.loads(result)
+
+
+def test_build123d_ref_not_in_editable_fnames() -> None:
+    """BUG-007: every `Coder.create(...)` call in `multi_agent_cad/nodes.py`
+    must pass `_BUILD123D_REF` via `read_only_fnames=[...]` (read-only
+    context) -- never 
```

---

### Incident Patch 8: `a778d8e6` (2026-08-27)
**Commit Message**: v3: add mac_assembly pipeline + fix _VALIDATION_HELPERS bugs

- mac_assembly/: new assembly extension (7-node LangGraph: decomposer,
  mating_architect, part_builder, assembler, assembly_qa, judge,
  feedback_router) wrapping the single-part pipeline; v3 feature-based
  architecture (LLM base_body + deterministic feature operators)
- multi_agent_cad/nodes.py: _VALIDATION_HELPERS template — fix
  _validate_solid (is_valid is a property, not a method) and _safe_union
  (coincident-face union produced a Compound; add 0.005mm epsilon-retry
  along the coincident axis to force watertight union)
- packages/cadpy/assembly.py: assembly API additions
- prompts/geometric_architect.md, build123d_reference.md: spec updates
- .gitignore: exclude assembly_jobs/ runtime artifacts

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

**File**: `.gitignore` (modified, +5/-0)
```diff
@@ -56,6 +56,11 @@ temp_missed_*.json
 # Use `git add -f pipeline_cache/<file>.json` to share a specific cache snapshot.
 pipeline_cache/
 
+# Assembly job outputs (mac_assembly pipeline). Each job_*/ directory holds
+# generated parts (STEP/STL), LLM temp_design_*.py iterations, assembly_cache,
+# placed_stl, judge views, etc. Pure runtime artifacts - never commit.
+assembly_jobs/
+
 # Local Claude Code state (session logs, scheduled tasks).
 .claude/
 
```

**File**: `mac_assembly/README.md` (added, +390/-0)
```diff
@@ -0,0 +1,390 @@
+# mac_assembly -- 多 Agent 装配流水线
+
+在 MAC（多 Agent 单零件 CAD）之上扩展装配能力：**多 agent 拆分整个装配体任务，
+每个零件独立走原有 MAC 流水线生成，再确定性组装成装配体 STEP，闭环 QA 反复迭代**。
+
+设计原则：思想上和代码上最大化复用 [earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad)
+（CAD Skills）与本项目（MAC）的现成件，不闭门造车。
+
+## 架构
+
+```
+decomposer ──> mating_architect ──> part_builder ──> assembler ──> assembly_qa ──> judge
+   (what:          (how: mates[]        (MAC 黑盒)     (确定性)                    │
+   parts+接口语义    anchor/offset/tol)                                            v
+     ^    ^                                                                        │
+     │    └──── remate（mate 设计错，带 QA delta 反馈）<── feedback_router <────────┘
+     └──────── recompose（拆分本身错）                     │  │  │
+                       remodel_parts（零件几何错）→ part_builder；repair_assembly（脚本级缺陷）→ assembler
+                       END（accept / halt / 预算耗尽）
+```
+
+Decomposer 与 Mating Architect 的拆分对标 MAC 单零件侧的 Spec Planner /
+Geometric Architect 分工（"what" 与 "how" 分离，agent 之间只传结构化
+JSON），两级之间有确定性校验层 `_validate_mating_plan`（引用存在性、
+单主 mate、固定根唯一、接口全覆盖），错误归因因此可以路由到正确的
+阶段：recompose / remate / remodel / repair 四条反馈回路各管一层。
+
+| 阶段 | Agent | 复用来源 | 说明 |
+|---|---|---|---|
+| 1 | **Decomposer** | MAC `_llm_client` + `_call_llm_json_with_retry` + `image_preprocess` | 装配请求 -> `AssemblyBrief`（parts + 功能接口散文 + 包络 + 意图） |
+| 1b | **Mating Architect** | positioning.md few-shot | 接口 -> `MatingPlan`（结构化 MateSpec：anchor/offset/tolerance） |
+| 2/3 | **PartBuilder** | MAC 单零件流水线**零改动**（`_part_runner` 子进程 + per-part cwd/缓存隔离） | 每个零件独立跑 Spec Planner -> Architect -> 确定性 Coder -> Skill Loop |
+| 4a | **Assembler** | CAD Skills `cadpy.assembly.AssemblyHelper` + positioning.md 哲学 | **确定性翻译器** `assembly_codegen`：MateSpec -> `asm.add/rigid_frame/face_to_face/revolute` 源码，零 token；LLM 仅在脚本失败时修复 |
+| 4b | **AssemblyQA** | inspection-and-validation.md 哲学 + MAC render_views | 零件计数 / mate 对齐 delta / 双向干涉（射线法）/ **revolute ±30° 扫角运动学碰撞** / 包络 |
+| 5 | **Assembly Judge** | MAC QA-Judge 反幻觉模式 | accept / remate / repair_assembly / remodel_parts / recompose / halt + evidence gate + 多模态 |
+| 6 | **FeedbackRouter** | repair-loop.md 失败分类 | 四条回路 + 预算封顶（外层 8 轮默认 / remate 4 次 / recompose 2 次） |
+
+## 反馈路由策略（FeedbackRouter 决策表）
+
+`node_feedback_router` 是**节点**（非条件边）—— 它根据 QA report + Judge decision 改写
+状态（`remodel_part_ids` / `repair_context` / `__next__`），再由条件边
+`route_after_feedback` 按 `__next__` 路由。决策优先级
+（[graph_assembly.py:60-143](mac_assembly/graph_assembly.py#L60-L143)）：
+
+1. QA 全绿或 Judge `ACCEPT` / `HALT` → END
+2. 外层 `ASSEMBLY_MAX_ITERATIONS` 耗尽 → END
+3. Judge `REMODEL_PARTS` → part_builder（带 `remodel_part_ids`）
+4. Judge `RECOMPOSE` → decomposer（受 `DECOMPOSER_MAX_RUNS` 限制）
+5. QA `PART_MISSING` → part_builder（自动重试失败零件）
+6. Judge `REMATE` 或 QA mate-level 错误 → mating_architect（受 `MATING_MAX_RUNS` 限制）
+7. 默认（含 Judge `REPAIR_ASSEMBLY`、`FATAL`）→ assembler
+
+| QA `error_type` | 含义 | 默认路由 |
+|---|---|---|
+| `PART_MISSING` | 零件生成失败 | part_builder（remodel） |
+| `MATE_MISALIGNMENT` / `INTERFERENCE` / `KINEMATIC` / `ENVELOPE` / `RECONCILE` | mate 设计错 | mating_architect（remate） |
+| `FATAL` | 脚本执行失败 / STEP 缺失 | assembler（repair_assembly） |
+| `NONE` | 全绿 | END |
+
+**预算绑定**：`MATING_MAX_RUNS=4` 和 `DECOMPOSER_MAX_RUNS=2` 在外层
+`ASSEMBLY_MAX_ITERATIONS=8`（默认；`MAC_ASSEMBLY_MAX_ITER` 环境变量可覆盖）之前绑定
+（per-route 优先）；外层 8 次是兜底，覆盖无 per-route 预算的 `repair_assembly` 路径，
+并为复杂多零件装配（灵巧手等）留余地。设 `ASSEMBLY_MAX_ITERATIONS<4` 会让 remate
+预算成死代码。
+
+## 装配哲学（复用 skill 的 positioning.md）
+
+- **定位写在源码里**：组装产物是 `temp_assembly_N.py`（AssemblyHelper + 原生
+  build123d joints），不是对导出 STEP 的补丁；修复永远回到源码。
+- **mate/joint 驱动，非裸变换**：`MateSpec` 是语义关系（face_to_face /
+  coaxial / rigid / revolute），fixed-first 方向性贯穿始终。
+- **每个 anchor 是命名 datum**（bbox 面心 / 轴向点），因此 MateSpec ->
+  AssemblyHelper 的翻译是确定性的——这是 MAC `_plan_to_code` 在装配层的对应物。
+- **确定性检查定 pass/fail，视觉只做诊断**：渲染视图喂 Judge 校准，
+  量测数据冲突时信任量测（snapshot-review.md 原则）。
+
+## Anchor 与 Mate 语义（数据契约）
+
+**Anchor 双轨*
```

**File**: `mac_assembly/__init__.py` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+"""mac_assembly -- multi-agent assembly pipeline on top of MAC.
+
+Reuses:
+* the single-part MAC pipeline (``multi_agent_cad``) verbatim as the
+  structural part generator;
+* CAD Skills' ``cadpy.assembly.AssemblyHelper`` + positioning philosophy
+  (mates as semantic relationships, fixed-first, named datums);
+* MAC's LLM client, JSON retry, render views, token tracker, and the
+  QA-Judge anti-hallucination pattern.
+
+Entry point::
+
+    python -m mac_assembly
+"""
+
+
+def __getattr__(name: str):
+    # Lazy re-exports: keep `python -m mac_assembly._part_runner` light
+    # (it must not pull langgraph / the assembly nodes).
+    if name in ("build_assembly_graph", "get_initial_state", "main"):
+        from mac_assembly import graph_assembly
+
+        return getattr(graph_assembly, name)
+    raise AttributeError(name)
+
+
+__all__ = ["build_assembly_graph", "get_initial_state", "main"]
```

**File**: `mac_assembly/__main__.py` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+"""Make `python -m mac_assembly` work (the README-documented entry point).
+
+Delegates to mac_assembly.graph_assembly.main.
+"""
+import sys
+
+from mac_assembly.graph_assembly import main
+
+if __name__ == "__main__":
+    sys.exit(main())
```

**File**: `mac_assembly/_part_runner.py` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+"""Subprocess runner: one single-part MAC pipeline, cwd-isolated.
+
+Executed as ``python -m mac_assembly._part_runner [--mode {full,aider}]`` with::
+
+    cwd    = <part_dir>                 (all temp_* files land here)
+    env    MAC_PART_REQUEST   = single-part prompt
+          MAC_PART_DIR        = absolute part dir (cache isolation)
+          MAC_FORCE_REFRESH   = "1" to ignore the per-part plan cache (full mode only)
+
+Modes:
+    full   (default) -- regenerate a part from scratch via ``multi_agent_cad.graph``
+                        (Spec Planner -> Architect -> Coder -> Skill Loop).
+                        Reads MAC_FORCE_REFRESH from env so callers control caching.
+    aider            -- patch an EXISTING part via ``multi_agent_cad.graph_aider``
+                        (Aider-first workflow modifies the part's ``temp_design*.py``
+                        with assembly-level feedback). Requires a pre-existing
+                        ``temp_design*.py`` in the part dir; otherwise exits 3 so
+                        the caller falls back to full regeneration. force_refresh
+                        is hardcoded True -- the cache holds the pre-remodel design
+                        hash, which is exactly what we want to bypass.
+
+Patches before building the graph:
+
+* ``multi_agent_cad.config.USER_REQUEST`` -- the part description.
+* ``multi_agent_cad.nodes._CACHE_DIR``    -- per-part pipeline_cache so
+  parallel/sequential parts never share Spec Planner / Architect caches.
+
+The 10s interactive checkpoint auto-selects "1" (auto-iterate) because
+stdin is not a TTY under subprocess -- exactly the CI behaviour MAC
+already implements.
+"""
+
+from __future__ import annotations
+
+import argparse
+import os
+import sys
+from pathlib import Path
+
+_REPO_ROOT = Path(__file__).resolve().parent.parent
+if str(_REPO_ROOT) not in sys.path:
+    sys.path.insert(0, str(_REPO_ROOT))
+
+
+def _parse_mode(argv: list[str]) -> str:
+    parser = argparse.ArgumentParser(
+        prog="mac_assembly._part_runner",
+        description="Single-part MAC subprocess (full regenerate or aider remodel).",
+    )
+    parser.add_argument(
+        "--mode", choices=("full", "aider"), default="full",
+        help="full: regenerate from scratch (default). aider: patch existing design.",
+    )
+    args, _ = parser.parse_known_args(argv)
+    return args.mode
+
+
+def main(argv: list[str] | None = None) -> int:
+    mode = _parse_mode(sys.argv[1:] if argv is None else argv)
+    request = os.environ.get("MAC_PART_REQUEST", "")
+    part_dir = Path(os.environ.get("MAC_PART_DIR", os.getcwd())).resolve()
+
+    if not request:
+        print(f"[part_runner:{mode}] MAC_PART_REQUEST not set", file=sys.stderr)
+        return 2
+
+    # Aider-first needs an existing design to patch.
+    if mode == "aider" and not list(part_dir.glob("temp_design*.py")):
+        print("[part_runner:aider] no existing temp_design*.py -- cannot patch")
+        return 3
+
+    # Patch config BEFORE importing multi_agent_cad.graph / graph_aider (they
+    # capture USER_REQUEST at import time).
+    import multi_agent_cad.config as mac_config
+
+    mac_config.USER_REQUEST = request
+
+    import multi_agent_cad.nodes as mac_nodes
+
+    part_dir.mkdir(parents=True, exist_ok=True)
+    mac_nodes._CACHE_DIR = part_dir / "pipeline_cache"  # per-part cache isolation
+
+    if mode == "aider":
+        from multi_agent_cad.graph_aider import build_graph_aider
+        app = build_graph_aider()
+        force_refresh = True  # bypass the pre-remodel cache hash
+        workflow_id = "aider"
+    else:
+        from multi_agent_cad.graph import build_graph
+        app = build_graph()
+        force_refresh = os.environ.get("MAC_FORCE_REFRESH", "") == "1"
+        workflow_id = "original"
+
+    initial_state = {
+        "user_request": request,
+        "iteration_count": 0,
+        "max_iterations": 5,
+        "force_refresh": force_refr
```

---

### Incident Patch 9: `8fcdcaf7` (2026-08-17)
**Commit Message**: v2.1: token snapshot crash safety, no-reasoning config, benchmark docs

- nodes.py: write temp_token_snapshot.json before gen_step() execution so
  token stats survive OCP SIGSEGV crashes at export_step; Aider thinking
  control via extra_params
- config.py: Qwen3.8 template, all thinking disabled (enable_thinking: False)
- run_v2_benchmark-side: crash handler recovers tokens from snapshot file +
  Aider stdout parsing (paper/scripts, not committed here)
- .gitignore: un-ignore temp_design_*.py (Aider refuses to edit gitignored files)
- docs: qwen3.7_token.md adds multi agent v2 (qwen3.8 + vision) rows;
  new qwen3.8_token.md (cad skill benchmark); new test_prompts_features_cn.md
  (26 prompts with geometric features + baseline/no-reasoning pass rates)
- deps + README refresh

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

**File**: `.gitignore` (modified, +4/-1)
```diff
@@ -41,7 +41,10 @@ env/
 
 # ── MAC runtime artifacts ───────────────────────────────────────────────────
 # Per-iteration generated files (see WORKFLOW.md §6 for what each contains).
-temp_*.py
+# NOTE: temp_design_*.py is intentionally NOT ignored - Aider's repair stage
+# adds it to the chat, and Aider refuses to edit gitignored files. The other
+# temp_output_* / temp_measurements_* / temp_missed_* artifacts are ignored
+# because they are pure outputs, never edited.
 temp_output_*.step
 temp_output_*.stp
 temp_output_*.stl
```

**File**: `README.md` (modified, +5/-2)
```diff
@@ -97,8 +97,11 @@ git clone https://github.com/Pan-Chera/Multi-Agent-CAD
 cd Multi-Agent-CAD
 conda env create -f environment.yml
 conda activate multi_agent_cad
+pip install --no-deps "aider-chat==0.82.3"
 ```
 
+The last `pip install` is needed because every `aider-chat` version on PyPI hard-pins `numpy==1.26.4` (1.x), which conflicts with `build123d`'s `numpy>=2` requirement - conda's pip subprocess can't bypass that pin, so `aider-chat` is omitted from `environment.yml`. `--no-deps` skips the pin; aider 0.82.3 imports cleanly on numpy 2.x (the pin is over-cautious upstream).
+
 > **pip users (no conda)**: `aider-chat` pins `numpy==1.26.4`, but `build123d>=0.8` requires `numpy>=2,<3` — these conflict in pure pip. Use this workaround (verified on macOS arm64 + Python 3.11):
 >
 > ```bash
@@ -108,7 +111,7 @@ conda activate multi_agent_cad
 > # Install aider first (pulls numpy 1.26.4 + transitive deps), then force-upgrade numpy.
 > # Verified: aider 0.82.3 imports cleanly on numpy 2.x — the pin is over-cautious upstream.
 > pip install "aider-chat==0.82.3"
-> pip install --no-deps --force-reinstall "numpy>=2,<3"
+> pip install --no-deps --force-reinstall "numpy>=2,<2.3"
 > pip install "build123d>=0.8" "langgraph>=0.2,<0.3" "langgraph-checkpoint>=2.0,<3.0" \
 >             "pydantic>=2.5" "openai>=1.20.0" "anthropic>=0.30" \
 >             "trimesh>=4.0" "rtree>=1.1" "scipy>=1.10" "scikit-learn>=1.3" \
@@ -120,7 +123,7 @@ conda activate multi_agent_cad
 >
 > The last step registers the `mac-config-reset` console script and lets you run `python -m multi_agent_cad.graph` from any directory. See [requirements.txt](requirements.txt) / [pyproject.toml](pyproject.toml) for the canonical dependency list.
 
-> **Windows**: `conda env create -f environment.yml` works out of the box — `trimesh` and `rtree` come from conda-forge prebuilt; `OCP` is pulled in transitively by `build123d` (via its PyPI dep `cadquery-ocp-novtk`). Don't use the pure-pip workaround above on Windows — native wheels for `trimesh`/`rtree` can be unreliable. Set the API key in PowerShell as `$env:DASHSCOPE_API_KEY = "sk-..."` (or `set DASHSCOPE_API_KEY=sk-...` in cmd.exe). For the Web UI under conda, `pip install -e ".[web]"` inside the activated env works — `uvloop` auto-skips on Windows. Windows isn't in CI, but the code avoids Unix-only APIs and uses UTF-8 throughout; issues welcome.
+> **Windows**: the same `conda env create` + `pip install --no-deps aider-chat==0.82.3` flow works — `trimesh` and `rtree` come from conda-forge prebuilt; `OCP` is pulled in transitively by `build123d` (via its PyPI dep `cadquery-ocp-novtk`). Don't use the pure-pip workaround below on Windows — native wheels for `trimesh`/`rtree` can be unreliable. Set the API key in PowerShell as `$env:DASHSCOPE_API_KEY = "sk-..."` (or `set DASHSCOPE_API_KEY=sk-...` in cmd.exe). For the Web UI under conda, `pip install -e ".[web]"` inside the activated env works — `uvloop` auto-skips on Windows. Windows isn't in CI, but the code avoids Unix-only APIs and uses UTF-8 throughout; issues welcome.
 
 ### Configuration
 
```

**File**: `README_cn.md` (modified, +5/-2)
```diff
@@ -97,8 +97,11 @@ git clone https://github.com/Pan-Chera/Multi-Agent-CAD
 cd Multi-Agent-CAD
 conda env create -f environment.yml
 conda activate multi_agent_cad
+pip install --no-deps "aider-chat==0.82.3"
 ```
 
+最后一步 `pip install` 是必需的：PyPI 上所有 `aider-chat` 版本都硬 pin `numpy==1.26.4`（1.x），与 `build123d` 的 `numpy>=2` 要求冲突，conda 的 pip 子进程无法绕过这个 pin，所以 `aider-chat` 没放进 `environment.yml`。`--no-deps` 跳过该 pin；aider 0.82.3 在 numpy 2.x 上能正常 import（上游 pin 过度保守）。
+
 > **pip 用户（无 conda）**：`aider-chat` 锁定 `numpy==1.26.4`，与 `build123d>=0.8` 要求的 `numpy>=2,<3` 冲突，纯 pip 直接装失败。走以下 workaround（已在 macOS arm64 + Python 3.11 验证）：
 >
 > ```bash
@@ -108,7 +111,7 @@ conda activate multi_agent_cad
 > # 先装 aider（会拉 numpy 1.26.4 + 一堆传递依赖），再强制覆盖 numpy 到 2.x。
 > # 已验证 aider 0.82.3 在 numpy 2.x 上能正常 import——上游的 pin 是过度保守。
 > pip install "aider-chat==0.82.3"
-> pip install --no-deps --force-reinstall "numpy>=2,<3"
+> pip install --no-deps --force-reinstall "numpy>=2,<2.3"
 > pip install "build123d>=0.8" "langgraph>=0.2,<0.3" "langgraph-checkpoint>=2.0,<3.0" \
 >             "pydantic>=2.5" "openai>=1.20.0" "anthropic>=0.30" \
 >             "trimesh>=4.0" "rtree>=1.1" "scipy>=1.10" "scikit-learn>=1.3" \
@@ -119,7 +122,7 @@ conda activate multi_agent_cad
 >
 > 最后一步同时注册 `mac-config-reset` 命令行脚本、并允许在任意目录（不只是仓库根）跑 `python -m multi_agent_cad.graph`。完整依赖清单见 [requirements.txt](requirements.txt) / [pyproject.toml](pyproject.toml)。
 
-> **Windows**：`conda env create -f environment.yml` 在 Windows 上开箱即用——`trimesh` 和 `rtree` 来自 conda-forge 预编译包；`OCP` 由 `build123d` 的 PyPI 依赖 `cadquery-ocp-novtk` 传递性拉入。Windows 上不要走上面的纯 pip workaround——`trimesh`/`rtree` 的 native wheel 在 Windows 上不可靠。PowerShell 设 API key：`$env:DASHSCOPE_API_KEY = "sk-..."`（cmd.exe 用 `set DASHSCOPE_API_KEY=sk-...`）。conda 环境内跑 Web UI 用 `pip install -e ".[web]"`——`uvloop` 在 Windows 上自动跳过。Windows 不在 CI 里，但代码避开 Unix 专属 API、全程 UTF-8；遇到问题欢迎反馈。
+> **Windows**：在 Windows 上同样的 `conda env create` + `pip install --no-deps aider-chat==0.82.3` 流程可用——`trimesh` 和 `rtree` 来自 conda-forge 预编译包；`OCP` 由 `build123d` 的 PyPI 依赖 `cadquery-ocp-novtk` 传递性拉入。Windows 上不要走下面的纯 pip workaround——`trimesh`/`rtree` 的 native wheel 在 Windows 上不可靠。PowerShell 设 API key：`$env:DASHSCOPE_API_KEY = "sk-..."`（cmd.exe 用 `set DASHSCOPE_API_KEY=sk-...`）。conda 环境内跑 Web UI 用 `pip install -e ".[web]"`——`uvloop` 在 Windows 上自动跳过。Windows 不在 CI 里，但代码避开 Unix 专属 API、全程 UTF-8；遇到问题欢迎反馈。
 
 ### 配置
 
```

**File**: `docs/qwen3.7_token.md` (modified, +94/-13)
```diff
@@ -2,7 +2,9 @@
 
 ## Unit Price Reference
 
-Model: `qwen3.7-max`
+### qwen3.7-max (currently on limited-time discount)
+
+Used by `cad skill` and `multi agent v1`.
 
 | Item | Unit Price (CNY / million tokens) |
 |---|---:|
@@ -11,6 +13,17 @@ Model: `qwen3.7-max`
 | cache_read | 0.6 |
 | output | 18 |
 
+### qwen3.8-max (standard pricing, 2x qwen3.7)
+
+Used by `multi agent v2` (MAC with visual self-verification). qwen3.7 is currently on a limited-time promotional discount; qwen3.8 standard price is 2x qwen3.7.
+
+| Item | Unit Price (CNY / million tokens) |
+|---|---:|
+| input | 12 |
+| cache_creation | 15 |
+| cache_read | 1.2 |
+| output | 36 |
+
 ## Prompt 1 
 > Create a single solid STEP model in millimeters. The part is a rectangular block, 100 mm long in X, 60 mm wide in Y, and 20 mm tall in Z. Center the block on the XY origin, with the bottom face at Z = 0. Add four vertical through-holes, each 8 mm in diameter, located at X = +/-35 mm and Y = +/-20 mm. Add a 2 mm chamfer to the top perimeter edges only. Do not chamfer the holes.
 
@@ -26,7 +39,8 @@ Model: `qwen3.7-max`
 | Category | Pass Rate | input | cache_w | cache_r | output | total | API calls | Cost (CNY) |
 |---|---|---:|---:|---:|---:|---:|---:|---:|
 | cad skill | 7/7 | 212,689 | 0 | 5,413,760 | 55,878 | 5,682,327 | 112 | **5.53** |
-| multi agent | 7/7 | 23,453 | 0 | 0 | 9,156 | 32,609 | 3 | **0.31** |
+| multi agent v1 | 7/7 | 23,453 | 0 | 0 | 9,156 | 32,609 | 3 | **0.31** |
+| multi agent v2 (qwen3.8 + vision) | 7/7 | 32,774 | 0 | 0 | 15,404 | 48,178 | 4 | **0.95** |
 
 ## Prompt 2 
 > Create a single solid circular flange as a STEP model in millimeters. The flange is a cylinder with an outside diameter of 80 mm and a thickness of 10 mm. Its axis is vertical along Z, with the bottom face at Z = 0 and the center at X = 0, Y = 0. Add a central vertical through-bore with diameter 30 mm. Add six equally spaced vertical through-holes, each 6 mm in diameter, on a 60 mm bolt-circle diameter. Add a 1.5 mm fillet to the top and bottom outside circular edges.
@@ -46,7 +60,8 @@ Model: `qwen3.7-max`
 | Category | Pass Rate | input | cache_w | cache_r | output | total | API calls | Cost (CNY) |
 |---|---|---:|---:|---:|---:|---:|---:|---:|
 | cad skill | 10/10 | 412,097 | 0 | 6,625,536 | 89,885 | 7,127,518 | 126 | **8.07** |
-| multi agent | 10/10 | 24,179 | 0 | 0 | 10,648 | 34,827 | 3 | **0.34** |
+| multi agent v1 | 10/10 | 24,179 | 0 | 0 | 10,648 | 34,827 | 3 | **0.34** |
+| multi agent v2 (qwen3.8 + vision) | 10/10 | 32,712 | 0 | 10,240 | 20,990 | 63,942 | 4 | **1.16** |
 
 ## Prompt 3
 > Create a single solid L-bracket STEP model in millimeters. The bracket has a horizontal base plate 80 mm long in X, 50 mm wide in Y, and 8 mm thick in Z. Center the base plate on the XY origin, with its bottom at Z = 0. Add a vertical back plate along the rear long edge of the base. The back plate is 80 mm long in X, 8 mm thick in Y, and 50 mm tall in Z, rising from the top of the base plate. The back plate should sit along the rear edge at positive Y. Add two vertical through-holes in the base plate, each 6 mm in diameter, located at X = +/-25 mm and Y = -10 mm. Add two horizontal through-holes in the vertical plate, each 6 mm in diameter, located at X = +/-25 mm and Z = 30 mm, passing through the 8 mm thickness of the vertical plate. Add two triangular gussets, each 8 mm thick in X, located at X = +/-20 mm. Each gusset should connect the base plate to the back plate with a right-triangle side profile 30 mm tall and 30 mm deep. Add 2 mm fillets to the outside corner where the base and back plate meet.
@@ -70,7 +85,8 @@ Model: `qwen3.7-max`
 | Category | Pass Rate | input | cache_w | cache_r | output | total | API calls | Cost (CNY) |
 |---|---|---:|---:|---:|---:|---:|---:|---:|
 | cad skill | 14/14 | 457,731 | 0 | 8,393,600 | 293,629 | 9,144,960 | 113 | **13.07** |
-| multi agent | 14/14 | 51,886 | 0 | 0 | 42,618 | 94,504 | 5 | **1.08** |
+| multi agent v1 | 14/14 | 51,886 |
```

**File**: `docs/qwen3.8_token.md` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+# 3D Modeling Token Consumption Statistics — qwen3.8 (cad skill)
+
+Single-agent `cad skill` benchmark with `qwen3.8-max` (10 prompts P1–P10). Companion file to `qwen3.7_token.md` (same skill, `qwen3.7-max`).
+
+## Unit Price Reference
+
+Model: `qwen3.8-max` (standard pricing, 2× qwen3.7; qwen3.7 currently on limited-time discount).
+
+| Item | Unit Price (CNY / million tokens) |
+|---|---:|
+| input | 12 |
+| cache_creation (cache_w) | 15 |
+| cache_read (cache_r) | 1.2 |
+| output | 36 |
+
+## P1
+ # calls      input    cache_w      cache_r     output        total      cost  prompt
+------------------------------------------------------------------------------------------------------------------------
+ 1     2     49,344          0            0        364       49,708    0.61元  Create a single solid STEP model in millimeters. The part is
+ 2    11    328,598          0            0      3,604      332,202    4.07元  Base directory for this skill: /Users/puma/.claude/skills/ca
+ 3     0          0          0            0          0            0    0.00元  [Request interrupted by user]
+------------------------------------------------------------------------------------------------------------------------
+      13    377,942          0            0      3,968      381,910    4.68元  TOTAL
+
+## P2
+ # calls      input    cache_w      cache_r     output        total      cost  prompt
+------------------------------------------------------------------------------------------------------------------------
+ 1     2     49,466          0            0         88       49,554    0.60元  Create a single solid circular flange as a STEP model in mil
+ 2    76    216,287          0    3,249,664     49,624    3,515,575    8.28元  Base directory for this skill: /Users/puma/.claude/skills/ca
+ 3     9      4,865          0      561,024      2,633      568,522    0.83元  Base directory for this skill: /Users/puma/.claude/skills/ca
+------------------------------------------------------------------------------------------------------------------------
+      87    270,618          0    3,810,688     52,345    4,133,651    9.70元  TOTAL
+
+## P3
+ # calls      input    cache_w      cache_r     output        total      cost  prompt
+------------------------------------------------------------------------------------------------------------------------
+ 1     2     49,754          0            0         88       49,842    0.60元  Create a single solid L-bracket STEP model in millimeters. T
+ 2   111    819,510          0    9,634,432    340,735   10,794,677   33.66元  Base directory for this skill: /Users/puma/.claude/skills/ca
+ 3    15      8,706          0    1,827,968      4,784    1,841,458    2.47元  Base directory for this skill: /Users/puma/.claude/skills/ca
+------------------------------------------------------------------------------------------------------------------------
+     128    877,970          0   11,462,400    345,607   12,685,977   36.73元  TOTAL
+
+## P4
+ # calls      input    cache_w      cache_r     output        total      cost  prompt
+------------------------------------------------------------------------------------------------------------------------
+ 1     2     49,564          0            0         72       49,636    0.60元  Create a single solid stepped shaft STEP model in millimeter
+ 2   108    223,687          0    5,991,424     93,428    6,308,539   13.24元  Base directory for this skill: /Users/puma/.claude/skills/ca
+ 3    13      7,453          0    1,056,128      3,704    1,067,285    1.49元  Base directory for this skill: /Users/puma/.claude/skills/ca
+------------------------------------------------------------------------------------------------------------------------
+     123    280,704          0    7,047,552     97,204    7,425,460   15.32元  TOTAL
+
+## P5
+ # calls      input    cache_w      cache_r     output        total      cost  prompt
+---------------------------------------
```

---

### Incident Patch 10: `f31a2f65` (2026-08-13)
**Commit Message**: Fix misleading SUCCESS log when deterministic coder has runtime issues

The deterministic coder printed "[DETERMINISTIC CODER] SUCCESS" BEFORE
checking the runtime diagnostics file (temp_missed_*.json). When a
chamfer or fillet operation failed, the WARNING was printed AFTER
SUCCESS, making the log read as if the run succeeded and then
after-the-fact mentioned issues - which led users to mistake a
partially-failed run for a clean success.

Fix: move the SUCCESS print to AFTER the missed-cuts check. If runtime
issues are found, print "PARTIAL SUCCESS - <STEP/STL sizes>, but N
runtime issue(s): <label>" instead of "WARNING", so the user sees both
that files were produced AND that some operations failed. The early
return with ErrorType.DIMENSION is unchanged - only the log wording
and ordering change.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

**File**: `multi_agent_cad/nodes.py` (modified, +2/-2)
```diff
@@ -606,7 +606,6 @@ def _node_python_coder_deterministic(
         )
 
     stl_size = _file_size_kb(stl_path) if stl_path.is_file() else "N/A"
-    print(f"[DETERMINISTIC CODER] SUCCESS — {_file_size_kb(step_path)} STEP, {stl_size} STL")
 
     # ── Check for missed cuts / fillet failures (runtime diagnostics) ──
     missed_path = cwd / f"temp_missed_{iteration}.json"
@@ -617,7 +616,7 @@ def _node_python_coder_deterministic(
                 cats = _parse_missed_cuts(missed)
                 error_details, label = _format_missed_cuts_errors(cats)
                 total = sum(len(v) for v in cats.values())
-                print(f"[DETERMINISTIC CODER] WARNING: {total} runtime issue(s): {label}")
+                print(f"[DETERMINISTIC CODER] PARTIAL SUCCESS — {_file_size_kb(step_path)} STEP, {stl_size} STL, but {total} runtime issue(s): {label}")
                 for m in missed[:5]:
                     print(f"  → {m}")
                 return {
@@ -646,6 +645,7 @@ def _node_python_coder_deterministic(
         except Exception:
             pass
 
+    print(f"[DETERMINISTIC CODER] SUCCESS — {_file_size_kb(step_path)} STEP, {stl_size} STL")
     return {
         "current_python_code": code,
         "current_python_code_path": str(script_path.resolve()),
```

#### Recent Merged Pull Requests:
- **PR #9** (2026-09-24): Feature/assembly (@Pan-Chera)
- **PR #8** (2026-09-16): docs: USD price estimates and untrack prompt drafts (@Pan-Chera)
- **PR #7** (2026-09-16): Feature/assembly (@Pan-Chera)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

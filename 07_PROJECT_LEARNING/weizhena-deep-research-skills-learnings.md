# Forensic Learning Record (Deep Inspection): Weizhena/Deep-Research-skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/weizhena-deep-research-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Weizhena/Deep-Research-skills](https://github.com/Weizhena/Deep-Research-skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:03:07.691Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Weizhena/Deep-Research-skills`
- **Description**: Structured deep research skill for Claude Code/Open Code/Codex with human-in-the-loop control
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2272 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/research-codex-en/research/validate_json.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
from collections import defaultdict
from pathlib import Path

import yaml

CATEGORY_MAPPING = {
    "basic_info": ["basic_info", "Basic Info"],
    "technical_features": ["technical_features", "technical_characteristics", "Technical Features"],
    "performance_metrics": ["performance_metrics", "performance", "Performance Metrics"],
    "milestone_significance": ["milestone_significance", "milestones", "Milestone Significance"],
    "business_info": ["business_info", "commercial_info", "Business Info"],
    "competition_ecosystem": ["competition_ecosystem", "competition", "Competition Ecosystem"],
    "history": ["history", "History"],
    "market_positioning": ["market_positioning", "market", "Market Positioning"],
}

_SKIP_KEYS = {"_source_file", "uncertain"}


def load_fields_yaml(fields_path):
    """Parse fields.yaml in the single schema the research skills emit:

        fields:
          <category>:
            - {name: ..., description: ..., detail_level: ...}
            ...
        uncertain: []

    This is the ONLY accepted shape. A fields.yaml that does not match fails
    loudly instead of silently passing with zero fields.

    Required semantics (so the validator can never pass vacuously / "lie"):
      - if ANY field carries an explicit `required:` key -> opt-in, preserve it
      - else (detail_level-style, no markers)            -> ALL fields required, because the
        script's stated purpose is COMPLETE field coverage.
    """
    with fields_path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    defs = []  # (name, category, required_or_None)

    fn = data.get("fields")
    if not isinstance(fn, dict):
        print(f"[ERROR] fields.yaml must use the `fields: {{<category>: [{{name, ...}}]}}` shape; got {type(fn).__name__ if fn is not None else 'None'}.")
        sys.exit(1)

    for cname, flist in fn.items():
        if cname in _SKIP_KEYS:
            continue
        if not isinstance(flist, list):
            print(f"[ERROR] category `{cname}` must map to a list of field dicts; got {type(flist).__name__}.")
            sys.exit(1)
        for field in flist:
            if isinstance(field, dict) and "name" in field:
                defs.append((str(field["name"]), str(cname), field.get("required", None)))
            else:
                print(f"[ERROR] field entry under `{cname}` must be a dict with a `name` key; got {field!r}.")
                sys.exit(1)

    if not defs:
        print("[ERROR] fields.yaml parsed zero fields. Ensure at least one category with field dicts.")
        sys.exit(1)

    all_fields = {n for n, _, _ in defs}
    if any(r is not None for _, _, r in defs):
        required_fields = {n for n, _, r in defs if r}
    else:
        required_fields = set(all_fields)
    field_categories = {n: c for n, c, _ in defs}
    return all_fields, required_fields, field_categories


def extract_json_fields(data, category_mapping=None):
    category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
    nested_keys = {k for keys in category_mapping.values() for k in keys}
    fields = set()
    stack = [(data, True)]
    while stack:
        obj, is_category_level = stack.pop()
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in _SKIP_KEYS:
                    continue
                if is_category_level and k in nested_keys:
                    if isinstance(v, dict):
                        stack.append((v, True))
                    continue
                fields.add(k)
        elif isinstance(obj, list):
            stack.extend((item, is_category_level) for item in obj if isinstance(item, dict))
    return fields


def validate_json(json_path, all_fields, required_fields, field_categories):
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)
    json_fields = extract_json_fields(data)
    covered = all_fields & json_fields
    missing = all_fields - json_fields
    extra = json_fields - all_fields
    missing_required = missing & required_fields
    missing_by_category = defaultdict(list)
    for field in missing:
        missing_by_category[field_categories.get(field, "Unknown")].append(field)
    return {
        "file": json_path.name,
        "total_defined": len(all_fields),
        "covered": len(covered),
        "missing": len(missing),
        "extra": len(extra),
        "coverage_rate": len(covered) / len(all_fields) * 100 if all_fields else 100,
        "missing_required": sorted(missing_required),
        "missing_optional": sorted(missing - required_fields),
        "missing_by_category": {k: sorted(v) for k, v in missing_by_category.items()},
        "extra_fields": sorted(extra),
        "valid": len(missing_required) == 0,
    }


def print_result(result, verbose=True):
    status = "PASS" if result["valid"] else "FAIL"
    line = "=" * 60
    print(f"\n{line}")
    print(f"[{status}] {result['file']}")
    print(line)
    print(f"Coverage: {result['coverage_rate']:.1f}% ({result['covered']}/{result['total_defined']})")
    if result["missing_required"]:
        print(f"\n[ERROR] Missing required fields ({len(result['missing_required'])}):")
        print("\n".join(f"  - {f}" for f in result["missing_required"]))
    if verbose and result["missing_optional"]:
        missing_required = set(result["missing_required"])
        print(f"\n[WARN] Missing optional fields ({len(result['missing_optional'])}):")
        for cat in sorted(result["missing_by_category"]):
            optional = [f for f in result["missing_by_category"][cat] if f not in missing_required]
            if optional:
                print(f"  [{cat}]: {', '.join(optional)}")
    if verbose and result["extra_fields"]:
        extra = result["extra_fields"]
        print(f"\n[INFO] Extra fields ({len(extra)}):")
        print(f"  {', '.join(extra[:10])}")
        if len(extra) > 10:
            print(f"  ... and {len(extra) - 10} more")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Validate whether JSON files cover all fields defined in fields.yaml")
    parser.add_argument("--fields", "-f", type=str, help="Path to fields.yaml", default="fields.yaml")
    parser.add_argument("--json", "-j", type=str, nargs="*", help="JSON file paths to validate")
    parser.add_argument("--dir", "-d", type=str, help="Directory containing JSON files", default="results")
    parser.add_argument("--quiet", "-q", action="store_true", help="Show summary only")
    args = parser.parse_args()
    fields_path = Path(args.fields)
    if not fields_path.exists():
        for p in (Path.cwd() / "fields.yaml", Path.cwd().parent / "fields.yaml"):
            if p.exists():
                fields_path = p
                break
    if not fields_path.exists():
        print(f"[ERROR] fields.yaml not found: {fields_path}")
        sys.exit(1)
    print(f"Field definition file: {fields_path}")
    all_fields, required_fields, field_categories = load_fields_yaml(fields_path)
    print(f"Total fields: {len(all_fields)} (required: {len(required_fields)}, optional: {len(all_fields) - len(required_fields)})")
    json_files = (
        [Path(p) for p in args.json]
        if args.json
        else sorted(Path(args.dir).glob("*.json")) if Path(args.dir).exists() else []
    )
    if not json_files:
        print("[WARN] No JSON files found")
        sys.exit(0)
    results = []
    for json_path in json_files:
        if not json_path.exists():
            print(f"[WARN] File not found: {json_path}")
            continue
        result = validate_json(json_path, all_fields, required_fields, field_categories)
        results.append(result)
        print_result(result, verbose=not args.quiet)
    line = "=" * 60
    print(f"\n{line}")
    print("Summary")
    print(line)
    passed = sum(1 for r in results if r["valid"])
    avg_coverage =
```

### Core Architecture Module: `skills/research-codex-zh/research/validate_json.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
from collections import defaultdict
from pathlib import Path

import yaml

CATEGORY_MAPPING = {
    "basic_info": ["basic_info", "Basic Info"],
    "technical_features": ["technical_features", "technical_characteristics", "Technical Features"],
    "performance_metrics": ["performance_metrics", "performance", "Performance Metrics"],
    "milestone_significance": ["milestone_significance", "milestones", "Milestone Significance"],
    "business_info": ["business_info", "commercial_info", "Business Info"],
    "competition_ecosystem": ["competition_ecosystem", "competition", "Competition Ecosystem"],
    "history": ["history", "History"],
    "market_positioning": ["market_positioning", "market", "Market Positioning"],
}

_SKIP_KEYS = {"_source_file", "uncertain"}


def load_fields_yaml(fields_path):
    """Parse fields.yaml in the single schema the research skills emit:

        fields:
          <category>:
            - {name: ..., description: ..., detail_level: ...}
            ...
        uncertain: []

    This is the ONLY accepted shape. A fields.yaml that does not match fails
    loudly instead of silently passing with zero fields.

    Required semantics (so the validator can never pass vacuously / "lie"):
      - if ANY field carries an explicit `required:` key -> opt-in, preserve it
      - else (detail_level-style, no markers)            -> ALL fields required, because the
        script's stated purpose is COMPLETE field coverage.
    """
    with fields_path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    defs = []  # (name, category, required_or_None)

    fn = data.get("fields")
    if not isinstance(fn, dict):
        print(f"[ERROR] fields.yaml must use the `fields: {{<category>: [{{name, ...}}]}}` shape; got {type(fn).__name__ if fn is not None else 'None'}.")
        sys.exit(1)

    for cname, flist in fn.items():
        if cname in _SKIP_KEYS:
            continue
        if not isinstance(flist, list):
            print(f"[ERROR] category `{cname}` must map to a list of field dicts; got {type(flist).__name__}.")
            sys.exit(1)
        for field in flist:
            if isinstance(field, dict) and "name" in field:
                defs.append((str(field["name"]), str(cname), field.get("required", None)))
            else:
                print(f"[ERROR] field entry under `{cname}` must be a dict with a `name` key; got {field!r}.")
                sys.exit(1)

    if not defs:
        print("[ERROR] fields.yaml parsed zero fields. Ensure at least one category with field dicts.")
        sys.exit(1)

    all_fields = {n for n, _, _ in defs}
    if any(r is not None for _, _, r in defs):
        required_fields = {n for n, _, r in defs if r}
    else:
        required_fields = set(all_fields)
    field_categories = {n: c for n, c, _ in defs}
    return all_fields, required_fields, field_categories


def extract_json_fields(data, category_mapping=None):
    category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
    nested_keys = {k for keys in category_mapping.values() for k in keys}
    fields = set()
    stack = [(data, True)]
    while stack:
        obj, is_category_level = stack.pop()
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in _SKIP_KEYS:
                    continue
                if is_category_level and k in nested_keys:
                    if isinstance(v, dict):
                        stack.append((v, True))
                    continue
                fields.add(k)
        elif isinstance(obj, list):
            stack.extend((item, is_category_level) for item in obj if isinstance(item, dict))
    return fields


def validate_json(json_path, all_fields, required_fields, field_categories):
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)
    json_fields = extract_json_fields(data)
    covered = all_fields & json_fields
    missing = all_fields - json_fields
    extra = json_fields - all_fields
    missing_required = missing & required_fields
    missing_by_category = defaultdict(list)
    for field in missing:
        missing_by_category[field_categories.get(field, "Unknown")].append(field)
    return {
        "file": json_path.name,
        "total_defined": len(all_fields),
        "covered": len(covered),
        "missing": len(missing),
        "extra": len(extra),
        "coverage_rate": len(covered) / len(all_fields) * 100 if all_fields else 100,
        "missing_required": sorted(missing_required),
        "missing_optional": sorted(missing - required_fields),
        "missing_by_category": {k: sorted(v) for k, v in missing_by_category.items()},
        "extra_fields": sorted(extra),
        "valid": len(missing_required) == 0,
    }


def print_result(result, verbose=True):
    status = "PASS" if result["valid"] else "FAIL"
    line = "=" * 60
    print(f"\n{line}")
    print(f"[{status}] {result['file']}")
    print(line)
    print(f"Coverage: {result['coverage_rate']:.1f}% ({result['covered']}/{result['total_defined']})")
    if result["missing_required"]:
        print(f"\n[ERROR] Missing required fields ({len(result['missing_required'])}):")
        print("\n".join(f"  - {f}" for f in result["missing_required"]))
    if verbose and result["missing_optional"]:
        missing_required = set(result["missing_required"])
        print(f"\n[WARN] Missing optional fields ({len(result['missing_optional'])}):")
        for cat in sorted(result["missing_by_category"]):
            optional = [f for f in result["missing_by_category"][cat] if f not in missing_required]
            if optional:
                print(f"  [{cat}]: {', '.join(optional)}")
    if verbose and result["extra_fields"]:
        extra = result["extra_fields"]
        print(f"\n[INFO] Extra fields ({len(extra)}):")
        print(f"  {', '.join(extra[:10])}")
        if len(extra) > 10:
            print(f"  ... and {len(extra) - 10} more")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Validate whether JSON files cover all fields defined in fields.yaml")
    parser.add_argument("--fields", "-f", type=str, help="Path to fields.yaml", default="fields.yaml")
    parser.add_argument("--json", "-j", type=str, nargs="*", help="JSON file paths to validate")
    parser.add_argument("--dir", "-d", type=str, help="Directory containing JSON files", default="results")
    parser.add_argument("--quiet", "-q", action="store_true", help="Show summary only")
    args = parser.parse_args()
    fields_path = Path(args.fields)
    if not fields_path.exists():
        for p in (Path.cwd() / "fields.yaml", Path.cwd().parent / "fields.yaml"):
            if p.exists():
                fields_path = p
                break
    if not fields_path.exists():
        print(f"[ERROR] fields.yaml not found: {fields_path}")
        sys.exit(1)
    print(f"Field definition file: {fields_path}")
    all_fields, required_fields, field_categories = load_fields_yaml(fields_path)
    print(f"Total fields: {len(all_fields)} (required: {len(required_fields)}, optional: {len(all_fields) - len(required_fields)})")
    json_files = (
        [Path(p) for p in args.json]
        if args.json
        else sorted(Path(args.dir).glob("*.json")) if Path(args.dir).exists() else []
    )
    if not json_files:
        print("[WARN] No JSON files found")
        sys.exit(0)
    results = []
    for json_path in json_files:
        if not json_path.exists():
            print(f"[WARN] File not found: {json_path}")
            continue
        result = validate_json(json_path, all_fields, required_fields, field_categories)
        results.append(result)
        print_result(result, verbose=not args.quiet)
    line = "=" * 60
    print(f"\n{line}")
    print("Summary")
    print(line)
    passed = sum(1 for r in results if r["valid"])
    avg_coverage =
```

### Core Architecture Module: `skills/research-en/research/validate_json.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
from collections import defaultdict
from pathlib import Path

import yaml

CATEGORY_MAPPING = {
    "basic_info": ["basic_info", "Basic Info"],
    "technical_features": ["technical_features", "technical_characteristics", "Technical Features"],
    "performance_metrics": ["performance_metrics", "performance", "Performance Metrics"],
    "milestone_significance": ["milestone_significance", "milestones", "Milestone Significance"],
    "business_info": ["business_info", "commercial_info", "Business Info"],
    "competition_ecosystem": ["competition_ecosystem", "competition", "Competition Ecosystem"],
    "history": ["history", "History"],
    "market_positioning": ["market_positioning", "market", "Market Positioning"],
}

_SKIP_KEYS = {"_source_file", "uncertain"}


def load_fields_yaml(fields_path):
    """Parse fields.yaml in the single schema the research skills emit:

        fields:
          <category>:
            - {name: ..., description: ..., detail_level: ...}
            ...
        uncertain: []

    This is the ONLY accepted shape. A fields.yaml that does not match fails
    loudly instead of silently passing with zero fields.

    Required semantics (so the validator can never pass vacuously / "lie"):
      - if ANY field carries an explicit `required:` key -> opt-in, preserve it
      - else (detail_level-style, no markers)            -> ALL fields required, because the
        script's stated purpose is COMPLETE field coverage.
    """
    with fields_path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    defs = []  # (name, category, required_or_None)

    fn = data.get("fields")
    if not isinstance(fn, dict):
        print(f"[ERROR] fields.yaml must use the `fields: {{<category>: [{{name, ...}}]}}` shape; got {type(fn).__name__ if fn is not None else 'None'}.")
        sys.exit(1)

    for cname, flist in fn.items():
        if cname in _SKIP_KEYS:
            continue
        if not isinstance(flist, list):
            print(f"[ERROR] category `{cname}` must map to a list of field dicts; got {type(flist).__name__}.")
            sys.exit(1)
        for field in flist:
            if isinstance(field, dict) and "name" in field:
                defs.append((str(field["name"]), str(cname), field.get("required", None)))
            else:
                print(f"[ERROR] field entry under `{cname}` must be a dict with a `name` key; got {field!r}.")
                sys.exit(1)

    if not defs:
        print("[ERROR] fields.yaml parsed zero fields. Ensure at least one category with field dicts.")
        sys.exit(1)

    all_fields = {n for n, _, _ in defs}
    if any(r is not None for _, _, r in defs):
        required_fields = {n for n, _, r in defs if r}
    else:
        required_fields = set(all_fields)
    field_categories = {n: c for n, c, _ in defs}
    return all_fields, required_fields, field_categories


def extract_json_fields(data, category_mapping=None):
    category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
    nested_keys = {k for keys in category_mapping.values() for k in keys}
    fields = set()
    stack = [(data, True)]
    while stack:
        obj, is_category_level = stack.pop()
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in _SKIP_KEYS:
                    continue
                if is_category_level and k in nested_keys:
                    if isinstance(v, dict):
                        stack.append((v, True))
                    continue
                fields.add(k)
        elif isinstance(obj, list):
            stack.extend((item, is_category_level) for item in obj if isinstance(item, dict))
    return fields


def validate_json(json_path, all_fields, required_fields, field_categories):
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)
    json_fields = extract_json_fields(data)
    covered = all_fields & json_fields
    missing = all_fields - json_fields
    extra = json_fields - all_fields
    missing_required = missing & required_fields
    missing_by_category = defaultdict(list)
    for field in missing:
        missing_by_category[field_categories.get(field, "Unknown")].append(field)
    return {
        "file": json_path.name,
        "total_defined": len(all_fields),
        "covered": len(covered),
        "missing": len(missing),
        "extra": len(extra),
        "coverage_rate": len(covered) / len(all_fields) * 100 if all_fields else 100,
        "missing_required": sorted(missing_required),
        "missing_optional": sorted(missing - required_fields),
        "missing_by_category": {k: sorted(v) for k, v in missing_by_category.items()},
        "extra_fields": sorted(extra),
        "valid": len(missing_required) == 0,
    }


def print_result(result, verbose=True):
    status = "PASS" if result["valid"] else "FAIL"
    line = "=" * 60
    print(f"\n{line}")
    print(f"[{status}] {result['file']}")
    print(line)
    print(f"Coverage: {result['coverage_rate']:.1f}% ({result['covered']}/{result['total_defined']})")
    if result["missing_required"]:
        print(f"\n[ERROR] Missing required fields ({len(result['missing_required'])}):")
        print("\n".join(f"  - {f}" for f in result["missing_required"]))
    if verbose and result["missing_optional"]:
        missing_required = set(result["missing_required"])
        print(f"\n[WARN] Missing optional fields ({len(result['missing_optional'])}):")
        for cat in sorted(result["missing_by_category"]):
            optional = [f for f in result["missing_by_category"][cat] if f not in missing_required]
            if optional:
                print(f"  [{cat}]: {', '.join(optional)}")
    if verbose and result["extra_fields"]:
        extra = result["extra_fields"]
        print(f"\n[INFO] Extra fields ({len(extra)}):")
        print(f"  {', '.join(extra[:10])}")
        if len(extra) > 10:
            print(f"  ... and {len(extra) - 10} more")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Validate whether JSON files cover all fields defined in fields.yaml")
    parser.add_argument("--fields", "-f", type=str, help="Path to fields.yaml", default="fields.yaml")
    parser.add_argument("--json", "-j", type=str, nargs="*", help="JSON file paths to validate")
    parser.add_argument("--dir", "-d", type=str, help="Directory containing JSON files", default="results")
    parser.add_argument("--quiet", "-q", action="store_true", help="Show summary only")
    args = parser.parse_args()
    fields_path = Path(args.fields)
    if not fields_path.exists():
        for p in (Path.cwd() / "fields.yaml", Path.cwd().parent / "fields.yaml"):
            if p.exists():
                fields_path = p
                break
    if not fields_path.exists():
        print(f"[ERROR] fields.yaml not found: {fields_path}")
        sys.exit(1)
    print(f"Field definition file: {fields_path}")
    all_fields, required_fields, field_categories = load_fields_yaml(fields_path)
    print(f"Total fields: {len(all_fields)} (required: {len(required_fields)}, optional: {len(all_fields) - len(required_fields)})")
    json_files = (
        [Path(p) for p in args.json]
        if args.json
        else sorted(Path(args.dir).glob("*.json")) if Path(args.dir).exists() else []
    )
    if not json_files:
        print("[WARN] No JSON files found")
        sys.exit(0)
    results = []
    for json_path in json_files:
        if not json_path.exists():
            print(f"[WARN] File not found: {json_path}")
            continue
        result = validate_json(json_path, all_fields, required_fields, field_categories)
        results.append(result)
        print_result(result, verbose=not args.quiet)
    line = "=" * 60
    print(f"\n{line}")
    print("Summary")
    print(line)
    passed = sum(1 for r in results if r["valid"])
    avg_coverage =
```

### Core Architecture Module: `skills/research-zh/research/validate_json.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
from collections import defaultdict
from pathlib import Path

import yaml

CATEGORY_MAPPING = {
    "基本信息": ["basic_info", "基本信息"],
    "技术特性": ["technical_features", "technical_characteristics", "技术特性"],
    "性能指标": ["performance_metrics", "performance", "性能指标"],
    "里程碑意义": ["milestone_significance", "milestones", "里程碑意义"],
    "商业信息": ["business_info", "commercial_info", "商业信息"],
    "竞争与生态": ["competition_ecosystem", "competition", "竞争与生态"],
    "历史沿革": ["history", "历史沿革"],
    "市场定位": ["market_positioning", "market", "市场定位"],
}

_SKIP_KEYS = {"_source_file", "uncertain"}


def load_fields_yaml(fields_path):
    """解析 fields.yaml，仅接受 research skill 实际生成的唯一 schema：

        fields:
          <category>:
            - {name: ..., description: ..., detail_level: ...}
            ...
        uncertain: []

    只接受这一种格式。不符合的 fields.yaml 会直接报错退出，
    而不是以零字段静默通过。

    Required 语义（避免校验器空转通过/说谎）：
      - 若任一字段显式带 `required:` 键 -> 沿用 opt-in 语义
      - 否则（detail_level 式、无标记）-> 全部字段视为必填，因为脚本的目的就是完整覆盖。
    """
    with fields_path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    defs = []  # (name, category, required_or_None)

    fn = data.get("fields")
    if not isinstance(fn, dict):
        print(f"[错误] fields.yaml 必须使用 `fields: {{<category>: [{{name, ...}}]}}` 格式；当前为 {type(fn).__name__ if fn is not None else 'None'}。")
        sys.exit(1)

    for cname, flist in fn.items():
        if cname in _SKIP_KEYS:
            continue
        if not isinstance(flist, list):
            print(f"[错误] 分类 `{cname}` 必须映射为字段字典列表；当前为 {type(flist).__name__}。")
            sys.exit(1)
        for field in flist:
            if isinstance(field, dict) and "name" in field:
                defs.append((str(field["name"]), str(cname), field.get("required", None)))
            else:
                print(f"[错误] `{cname}` 下的字段必须是带 `name` 键的字典；当前为 {field!r}。")
                sys.exit(1)

    if not defs:
        print("[错误] fields.yaml 解析到零个字段。请确保至少有一个分类及其字段字典。")
        sys.exit(1)

    all_fields = {n for n, _, _ in defs}
    if any(r is not None for _, _, r in defs):
        required_fields = {n for n, _, r in defs if r}
    else:
        required_fields = set(all_fields)
    field_categories = {n: c for n, c, _ in defs}
    return all_fields, required_fields, field_categories


def extract_json_fields(data, category_mapping=None):
    category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
    nested_keys = {k for keys in category_mapping.values() for k in keys}
    fields = set()
    stack = [(data, True)]
    while stack:
        obj, is_category_level = stack.pop()
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in _SKIP_KEYS:
                    continue
                if is_category_level and k in nested_keys:
                    if isinstance(v, dict):
                        stack.append((v, True))
                    continue
                fields.add(k)
        elif isinstance(obj, list):
            stack.extend((item, is_category_level) for item in obj if isinstance(item, dict))
    return fields


def validate_json(json_path, all_fields, required_fields, field_categories):
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)
    json_fields = extract_json_fields(data)
    covered = all_fields & json_fields
    missing = all_fields - json_fields
    extra = json_fields - all_fields
    missing_required = missing & required_fields
    missing_by_category = defaultdict(list)
    for field in missing:
        missing_by_category[field_categories.get(field, "未知")].append(field)
    return {
        "file": json_path.name,
        "total_defined": len(all_fields),
        "covered": len(covered),
        "missing": len(missing),
        "extra": len(extra),
        "coverage_rate": len(covered) / len(all_fields) * 100 if all_fields else 100,
        "missing_required": sorted(missing_required),
        "missing_optional": sorted(missing - required_fields),
        "missing_by_category": {k: sorted(v) for k, v in missing_by_category.items()},
        "extra_fields": sorted(extra),
        "valid": len(missing_required) == 0,
    }


def print_result(result, verbose=True):
    status = "通过" if result["valid"] else "失败"
    line = "=" * 60
    print(f"\n{line}")
    print(f"[{status}] {result['file']}")
    print(line)
    print(f"覆盖率: {result['coverage_rate']:.1f}% ({result['covered']}/{result['total_defined']})")
    if result["missing_required"]:
        print(f"\n[错误] 缺少必填字段 ({len(result['missing_required'])}):")
        print("\n".join(f"  - {f}" for f in result["missing_required"]))
    if verbose and result["missing_optional"]:
        missing_required = set(result["missing_required"])
        print(f"\n[警告] 缺少可选字段 ({len(result['missing_optional'])}):")
        for cat in sorted(result["missing_by_category"]):
            optional = [f for f in result["missing_by_category"][cat] if f not in missing_required]
            if optional:
                print(f"  [{cat}]: {', '.join(optional)}")
    if verbose and result["extra_fields"]:
        extra = result["extra_fields"]
        print(f"\n[信息] 额外字段 ({len(extra)}):")
        print(f"  {', '.join(extra[:10])}")
        if len(extra) > 10:
            print(f"  ... 还有 {len(extra) - 10} 个")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="验证JSON文件是否覆盖fields.yaml中定义的所有字段")
    parser.add_argument("--fields", "-f", type=str, help="fields.yaml路径", default="fields.yaml")
    parser.add_argument("--json", "-j", type=str, nargs="*", help="要验证的JSON文件路径")
    parser.add_argument("--dir", "-d", type=str, help="包含JSON文件的目录", default="results")
    parser.add_argument("--quiet", "-q", action="store_true", help="仅显示摘要")
    args = parser.parse_args()
    fields_path = Path(args.fields)
    if not fields_path.exists():
        for p in (Path.cwd() / "fields.yaml", Path.cwd().parent / "fields.yaml"):
            if p.exists():
                fields_path = p
                break
    if not fields_path.exists():
        print(f"[错误] 找不到fields.yaml: {fields_path}")
        sys.exit(1)
    print(f"字段定义文件: {fields_path}")
    all_fields, required_fields, field_categories = load_fields_yaml(fields_path)
    print(f"总字段数: {len(all_fields)} (必填: {len(required_fields)}, 可选: {len(all_fields) - len(required_fields)})")
    json_files = (
        [Path(p) for p in args.json]
        if args.json
        else sorted(Path(args.dir).glob("*.json")) if Path(args.dir).exists() else []
    )
    if not json_files:
        print("[警告] 未找到JSON文件")
        sys.exit(0)
    results = []
    for json_path in json_files:
        if not json_path.exists():
            print(f"[警告] 文件不存在: {json_path}")
            continue
        result = validate_json(json_path, all_fields, required_fields, field_categories)
        results.append(result)
        print_result(result, verbose=not args.quiet)
    line = "=" * 60
    print(f"\n{line}")
    print("汇总")
    print(line)
    passed = sum(1 for r in results if r["valid"])
    avg_coverage = sum(r["coverage_rate"] for r in results) / len(results) if results else 0
    print(f"验证通过: {passed}/{len(results)}")
    print(f"平均覆盖率: {avg_coverage:.1f}%")
    if passed < len(results):
        sys.exit(1)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10** (2026-08-24): **`web-research.toml` has no name or description field.**
  *Symptoms*: Pretty self-explanatory. I have only tested in codex, which gives this message at launch:  ```md Ignoring malformed agent role definition: agent role file at ~/.codex/agents/web-researcher.toml must define a non-empty `name` ```
  **Post-Mortem & Fix Analysis**:
  > fixed 

- **Issue #9** (2026-08-23): **docs: add Autohand Code install path**
  *Symptoms*: ## Summary - add Autohand Code to the supported assistants in the README - document the Autohand Community Skills install command: `$skill-installer deep-research-skills` - mirror the update in `README.zh.md`  ## Validation - `git diff --check`
  **Post-Mortem & Fix Analysis**:
  > no commercial at all, just use it in codex, claude code, opencode, or someone can adapte this in their own tool

- **Issue #8** (2026-08-23): **Fix validate_json.py: parse all fields.yaml schemas; stop vacuous pass**
  *Symptoms*: ## Problem  `validate_json.py` is meant to enforce that each `/research-deep` result JSON covers every field defined in `fields.yaml` ("Task is complete only after validation passes"). In practice it passed everything, due to two issues:  **1. Only the `field_categories:` schema was parsed.** But `/research` (per its own `SKILL.md` Step 4) emits `fields.yaml` as:  ```yaml fields:   <category>:     - {name: ..., description: ..., detail_level: ...} uncertain: [] ```  `load_fields_yaml` read `data.get("field_categories", [])` → `[]` → **0 fields**. With an empty field set, `coverage_rate` defaults to `100%` and `missing_required` is empty, so **every JSON "passes" vacuously**. (`field_categories` does not appear in any SKILL.md — only inside this script.)  **2. `required` defaulted to `False`.** Even when fields were parsed, `valid` (`len(missing_required) == 0`) stayed `True` with missing fields unless each was explicitly `required: true` — which the emitted schema never sets.  Repro (before), with a `fields.yaml` in the `fields:{cat:[...]}` shape `/research` produces:  ``` $ python validate_json.py -f fields.yaml -d results Total fields: 0 (required: 0, optional: 0) [PASS] foo.json   Coverage: 100.0% (0/0) ```  ## Fix  - **`load_fields_yaml`** now accepts `field_categories: [...]`, `fields: {<cat>: [...]}`, flat `fields: [...]`, and a generic fallback that walks for `{name: ...}` dicts. When **no** field carries an explicit `required:` key, all fields are treated as required 

- **Issue #6** (2026-06-30): **实测成本数据：建议解耦收集模型与写作模型**
  *Symptoms*: ## 实测成本数据：建议解耦收集模型与写作模型  ### 背景  我们在 [pafozz/hermes-deep-research](https://github.com/pafozz/hermes-deep-research)（本项目的 Hermes Agent 移植版）上运行了一次完整的研究流程：11 个条目 × 43 个字段的 Beyond Meat 深度研究。过程中遇到了一个可能影响首次用户体验的问题，分享实测数据供参考。  ### 问题：Opus 全流程的成本曲线  当前 agent 配置将 `model: opus`（Claude Code）/ `model: gpt-5.4`（Codex）硬编码在整个流程中，包括 Phase 2 的并行搜索阶段。对于多条目研究，实际成本增长很快：  | 条目数 | 估算成本 (Opus) | |--------|----------------| | 5 | ~$10-12 | | 10 | ~$20-24 | | 14 (本次) | ~$30+ |  我们在完成第一批 5 个文件后看到成本估算，**主动中断了流程**，切换模型后才继续。如果这是一个新用户的第一次 `/research-deep` 运行，这个成本曲线很可能在第一阶段就劝退了。  ### 实测对比：模型大小在搜索阶段不关键  我们在不同模型上跑了分组对照：  | 维度 | Claude Sonnet 4.6 (5 file) | DeepSeek V4 Flash (6 file) | |------|---------------------------|---------------------------| | 字段覆盖率 | 100% (43/43) | 100% (43/43) | | 文件通过率 | 5/5 | 6/6 | | 质量问题 | 无 | 1 处中文引号冲突（语法级，patch 修复） | | **成本/文件** | **~$0.90** | **~$0.07** |  子代理搜索 + 写 JSON 的任务本质上是**机械性**的，不需要深度推理： - `web_search` + `web_extract` → 工具框架执行 - 从搜索结果中提取数值填入对应字段 → 定位+复制 - 输出 valid JSON 并通过 schema 验证 → 迭代到通过  ### 建议：解耦收集模型和写作模型  ``` 当前: Opus × N 并行收集 → Opus × 1 写报告 建议: Flash × N 并行收集 → Opus/Sonnet × 1 写报告 ```  #### 实际成本对比  | 方案 | 6 文件收集 | 1 份报告 | 总计 | |------|-----------|---------|------| | Sonnet 全流程 | ~$4.50 | ~$0.80 | **$5.30** | | **Flash 收集 + Sonnet 写作** | **~$0.28** | **~$0.80** | **$1.08** | | **Flash 收集 + Opus 写作** | **~$0.28** | **~$3.00** | **$3.28** |  #### 收益  1. **成本降低 5-13×**，搜索阶段的 JSON 质量无差异 2. **报告质量不会降低** —— 写作阶段仍使用高级模型，且输入数据是已清洗的结构化 JSON，效果甚至更好 3. **首次运行门槛降低** —— 从 ~$30
  **Post-Mortem & Fix Analysis**:
  > web search是灵魂，不用强基座相当于无效。费用问题的确是核心问题，一般有高级别订阅会好点

- **Issue #5** (2026-06-30): **关于Deep-Research的优化，新增子代理使用模型的选择来节省token**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 这个自己去sub agent的模型栏修改即可

- **Issue #3** (2026-05-07): **Add a LICENSE file**
  *Symptoms*: Hi — thanks for the great work on this skill, it's been really useful.  I'd like to vendor it into our internal Claude Code plugin marketplace so the team can pick up your updates automatically. Before I do that, I'd love to see a LICENSE file added to the repo so it's clear under what terms we (and others) can redistribute.  A permissive license like MIT or Apache-2.0 would be ideal for adoption, but anything explicit would unblock us. GitHub has a quick path: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-license-to-a-repository  Happy to send a PR if that's easier. Thanks!
  **Post-Mortem & Fix Analysis**:
  > i have done this, mit 

- **Issue #2** (2026-04-10): **hard-coded home directory path in research-deep skill.md**
  *Symptoms*: Line 54 has a hard coded reference to your home directory.
  **Post-Mortem & Fix Analysis**:
  > Fixed in dc18cf4 - replaced all hardcoded /home/weizhena/ paths with ~ and {project_dir} placeholders in research-deep SKILL.md files.

- **Issue #1** (2026-04-10): **Some of the skills do not have "name" and "description" fields**
  *Symptoms*: Thanks for this awesome work!  One minor thing: some of the markdown files for the **skills** are missing the `name` and `description` fields in the frontmatter, which might cause Opencode to ignore them. According to [their guidelines](https://opencode.ai/docs/skills#troubleshoot-loading) these must be be present.
  **Post-Mortem & Fix Analysis**:
  > Fixed in dc18cf4 - added missing name field to all research-zh and research-en SKILL.md frontmatter.

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

### Incident Patch 1: `9453a672` (2026-08-23)
**Commit Message**: Merge pull request #8 from xwang4-svg/fix/validate-json-schema-coverage

Fix validate_json.py: parse all fields.yaml schemas; stop vacuous pass

**File**: `skills/research-codex-en/research/validate_json.py` (modified, +69/-11)
```diff
@@ -22,23 +22,81 @@
 _SKIP_KEYS = {"_source_file", "uncertain"}
 
 
+def _iter_field_defs(node, category="(uncategorized)"):
+    """Generic fallback: yield (field_dict, category) for any dict carrying a 'name'."""
+    if isinstance(node, dict):
+        if isinstance(node.get("name"), (str, int, float)):
+            yield node, category
+            return
+        for k, v in node.items():
+            if k in _SKIP_KEYS:
+                continue
+            sub = category if k in ("fields", "field_categories") else str(k)
+            yield from _iter_field_defs(v, sub)
+    elif isinstance(node, list):
+        for item in node:
+            yield from _iter_field_defs(item, category)
+
+
 def load_fields_yaml(fields_path):
+    """Parse fields.yaml, tolerating the shapes the research skills actually emit:
+      A) field_categories: [ {category, fields: [{name, required?}]} ]   (validator-native)
+      B) fields: { <category>: [ {name, description, detail_level} ] }   (research-skill docs)
+      C) fields: [ {name, ...} ]                                         (flat list)
+      *) anything else -> generic walk for {name: ...} dicts
+
+    Required semantics (so the validator can never pass vacuously / "lie"):
+      - if ANY field carries an explicit `required:` key -> opt-in, preserve original behaviour
+      - else (detail_level-style, no markers)            -> ALL fields required, because the
+        script's stated purpose is COMPLETE field coverage.
+    """
     with fields_path.open(encoding="utf-8") as f:
-        data = yaml.safe_load(f)
-    items = [
-        (field["name"], category["category"], field.get("required", False))
-        for category in data.get("field_categories", [])
-        for field in category.get("fields", [])
-    ]
-    all_fields = {name for name, _, _ in items}
-    required_fields = {name for name, _, required in items if required}
-    field_categories = {name: category for name, category, _ in items}
+        data = yaml.safe_load(f) or {}
+    defs = []  # (name, category, required_or_None)
+
+    def add(field, category):
+        if isinstance(field, dict) and "name" in field:
+            defs.append((str(field["name"]), str(category), field.get("required", None)))
+
+    fc = data.get("field_categories")
+    if isinstance(fc, list):                                       # Schema A
+        for cat in fc:
+            if isinstance(cat, dict):
+                cname = cat.get("category", "(uncategorized)")
+                for field in cat.get("fields", []) or []:
+                    add(field, cname)
+
+    if not defs:                                                   # Schema B / C
+        fn = data.get("fields")
+        if isinstance(fn, dict):
+            for cname, flist in fn.items():
+                if isinstance(flist, list):
+                    for field in flist:
+                        add(field, cname)
+                else:
+                    add(flist, cname)
+        elif isinstance(fn, list):
+            for field in fn:
+                add(field, "(uncategorized)")
+
+    if not defs:                                                   # generic fallback
+        for field, cat in _iter_field_defs(data):
+            add(field, cat)
+
+    all_fields = {n for n, _, _ in defs}
+    if any(r is not None for _, _, r in defs):
+        required_fields = {n for n, _, r in defs if r}
+    else:
+        required_fields = set(all_fields)
+    field_categories = {n: c for n, c, _ in defs}
     return all_fields, required_fields, field_categories
 
 
-def extract_json_fields(data, category_mapping=None):
+def extract_json_fields(data, category_mapping=None, extra_nested_keys=None):
     category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
     nested_keys = {k for keys in category_mapping.values() for k in keys}
+    if extra_nested_keys:
+        nested_keys |= {str(k) for k in extra_nested_keys}
     fields = set()
 
```

**File**: `skills/research-codex-zh/research/validate_json.py` (modified, +69/-11)
```diff
@@ -22,23 +22,81 @@
 _SKIP_KEYS = {"_source_file", "uncertain"}
 
 
+def _iter_field_defs(node, category="(uncategorized)"):
+    """Generic fallback: yield (field_dict, category) for any dict carrying a 'name'."""
+    if isinstance(node, dict):
+        if isinstance(node.get("name"), (str, int, float)):
+            yield node, category
+            return
+        for k, v in node.items():
+            if k in _SKIP_KEYS:
+                continue
+            sub = category if k in ("fields", "field_categories") else str(k)
+            yield from _iter_field_defs(v, sub)
+    elif isinstance(node, list):
+        for item in node:
+            yield from _iter_field_defs(item, category)
+
+
 def load_fields_yaml(fields_path):
+    """Parse fields.yaml, tolerating the shapes the research skills actually emit:
+      A) field_categories: [ {category, fields: [{name, required?}]} ]   (validator-native)
+      B) fields: { <category>: [ {name, description, detail_level} ] }   (research-skill docs)
+      C) fields: [ {name, ...} ]                                         (flat list)
+      *) anything else -> generic walk for {name: ...} dicts
+
+    Required semantics (so the validator can never pass vacuously / "lie"):
+      - if ANY field carries an explicit `required:` key -> opt-in, preserve original behaviour
+      - else (detail_level-style, no markers)            -> ALL fields required, because the
+        script's stated purpose is COMPLETE field coverage.
+    """
     with fields_path.open(encoding="utf-8") as f:
-        data = yaml.safe_load(f)
-    items = [
-        (field["name"], category["category"], field.get("required", False))
-        for category in data.get("field_categories", [])
-        for field in category.get("fields", [])
-    ]
-    all_fields = {name for name, _, _ in items}
-    required_fields = {name for name, _, required in items if required}
-    field_categories = {name: category for name, category, _ in items}
+        data = yaml.safe_load(f) or {}
+    defs = []  # (name, category, required_or_None)
+
+    def add(field, category):
+        if isinstance(field, dict) and "name" in field:
+            defs.append((str(field["name"]), str(category), field.get("required", None)))
+
+    fc = data.get("field_categories")
+    if isinstance(fc, list):                                       # Schema A
+        for cat in fc:
+            if isinstance(cat, dict):
+                cname = cat.get("category", "(uncategorized)")
+                for field in cat.get("fields", []) or []:
+                    add(field, cname)
+
+    if not defs:                                                   # Schema B / C
+        fn = data.get("fields")
+        if isinstance(fn, dict):
+            for cname, flist in fn.items():
+                if isinstance(flist, list):
+                    for field in flist:
+                        add(field, cname)
+                else:
+                    add(flist, cname)
+        elif isinstance(fn, list):
+            for field in fn:
+                add(field, "(uncategorized)")
+
+    if not defs:                                                   # generic fallback
+        for field, cat in _iter_field_defs(data):
+            add(field, cat)
+
+    all_fields = {n for n, _, _ in defs}
+    if any(r is not None for _, _, r in defs):
+        required_fields = {n for n, _, r in defs if r}
+    else:
+        required_fields = set(all_fields)
+    field_categories = {n: c for n, c, _ in defs}
     return all_fields, required_fields, field_categories
 
 
-def extract_json_fields(data, category_mapping=None):
+def extract_json_fields(data, category_mapping=None, extra_nested_keys=None):
     category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
     nested_keys = {k for keys in category_mapping.values() for k in keys}
+    if extra_nested_keys:
+        nested_keys |= {str(k) for k in extra_nested_keys}
     fields = set()
 
```

**File**: `skills/research-en/research/validate_json.py` (modified, +69/-11)
```diff
@@ -22,23 +22,81 @@
 _SKIP_KEYS = {"_source_file", "uncertain"}
 
 
+def _iter_field_defs(node, category="(uncategorized)"):
+    """Generic fallback: yield (field_dict, category) for any dict carrying a 'name'."""
+    if isinstance(node, dict):
+        if isinstance(node.get("name"), (str, int, float)):
+            yield node, category
+            return
+        for k, v in node.items():
+            if k in _SKIP_KEYS:
+                continue
+            sub = category if k in ("fields", "field_categories") else str(k)
+            yield from _iter_field_defs(v, sub)
+    elif isinstance(node, list):
+        for item in node:
+            yield from _iter_field_defs(item, category)
+
+
 def load_fields_yaml(fields_path):
+    """Parse fields.yaml, tolerating the shapes the research skills actually emit:
+      A) field_categories: [ {category, fields: [{name, required?}]} ]   (validator-native)
+      B) fields: { <category>: [ {name, description, detail_level} ] }   (research-skill docs)
+      C) fields: [ {name, ...} ]                                         (flat list)
+      *) anything else -> generic walk for {name: ...} dicts
+
+    Required semantics (so the validator can never pass vacuously / "lie"):
+      - if ANY field carries an explicit `required:` key -> opt-in, preserve original behaviour
+      - else (detail_level-style, no markers)            -> ALL fields required, because the
+        script's stated purpose is COMPLETE field coverage.
+    """
     with fields_path.open(encoding="utf-8") as f:
-        data = yaml.safe_load(f)
-    items = [
-        (field["name"], category["category"], field.get("required", False))
-        for category in data.get("field_categories", [])
-        for field in category.get("fields", [])
-    ]
-    all_fields = {name for name, _, _ in items}
-    required_fields = {name for name, _, required in items if required}
-    field_categories = {name: category for name, category, _ in items}
+        data = yaml.safe_load(f) or {}
+    defs = []  # (name, category, required_or_None)
+
+    def add(field, category):
+        if isinstance(field, dict) and "name" in field:
+            defs.append((str(field["name"]), str(category), field.get("required", None)))
+
+    fc = data.get("field_categories")
+    if isinstance(fc, list):                                       # Schema A
+        for cat in fc:
+            if isinstance(cat, dict):
+                cname = cat.get("category", "(uncategorized)")
+                for field in cat.get("fields", []) or []:
+                    add(field, cname)
+
+    if not defs:                                                   # Schema B / C
+        fn = data.get("fields")
+        if isinstance(fn, dict):
+            for cname, flist in fn.items():
+                if isinstance(flist, list):
+                    for field in flist:
+                        add(field, cname)
+                else:
+                    add(flist, cname)
+        elif isinstance(fn, list):
+            for field in fn:
+                add(field, "(uncategorized)")
+
+    if not defs:                                                   # generic fallback
+        for field, cat in _iter_field_defs(data):
+            add(field, cat)
+
+    all_fields = {n for n, _, _ in defs}
+    if any(r is not None for _, _, r in defs):
+        required_fields = {n for n, _, r in defs if r}
+    else:
+        required_fields = set(all_fields)
+    field_categories = {n: c for n, c, _ in defs}
     return all_fields, required_fields, field_categories
 
 
-def extract_json_fields(data, category_mapping=None):
+def extract_json_fields(data, category_mapping=None, extra_nested_keys=None):
     category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
     nested_keys = {k for keys in category_mapping.values() for k in keys}
+    if extra_nested_keys:
+        nested_keys |= {str(k) for k in extra_nested_keys}
     fields = set()
 
```

**File**: `skills/research-zh/research/validate_json.py` (modified, +69/-11)
```diff
@@ -22,23 +22,81 @@
 _SKIP_KEYS = {"_source_file", "uncertain"}
 
 
+def _iter_field_defs(node, category="(uncategorized)"):
+    """Generic fallback: yield (field_dict, category) for any dict carrying a 'name'."""
+    if isinstance(node, dict):
+        if isinstance(node.get("name"), (str, int, float)):
+            yield node, category
+            return
+        for k, v in node.items():
+            if k in _SKIP_KEYS:
+                continue
+            sub = category if k in ("fields", "field_categories") else str(k)
+            yield from _iter_field_defs(v, sub)
+    elif isinstance(node, list):
+        for item in node:
+            yield from _iter_field_defs(item, category)
+
+
 def load_fields_yaml(fields_path):
+    """Parse fields.yaml, tolerating the shapes the research skills actually emit:
+      A) field_categories: [ {category, fields: [{name, required?}]} ]   (validator-native)
+      B) fields: { <category>: [ {name, description, detail_level} ] }   (research-skill docs)
+      C) fields: [ {name, ...} ]                                         (flat list)
+      *) anything else -> generic walk for {name: ...} dicts
+
+    Required semantics (so the validator can never pass vacuously / "lie"):
+      - if ANY field carries an explicit `required:` key -> opt-in, preserve original behaviour
+      - else (detail_level-style, no markers)            -> ALL fields required, because the
+        script's stated purpose is COMPLETE field coverage.
+    """
     with fields_path.open(encoding="utf-8") as f:
-        data = yaml.safe_load(f)
-    items = [
-        (field["name"], category["category"], field.get("required", False))
-        for category in data.get("field_categories", [])
-        for field in category.get("fields", [])
-    ]
-    all_fields = {name for name, _, _ in items}
-    required_fields = {name for name, _, required in items if required}
-    field_categories = {name: category for name, category, _ in items}
+        data = yaml.safe_load(f) or {}
+    defs = []  # (name, category, required_or_None)
+
+    def add(field, category):
+        if isinstance(field, dict) and "name" in field:
+            defs.append((str(field["name"]), str(category), field.get("required", None)))
+
+    fc = data.get("field_categories")
+    if isinstance(fc, list):                                       # Schema A
+        for cat in fc:
+            if isinstance(cat, dict):
+                cname = cat.get("category", "(uncategorized)")
+                for field in cat.get("fields", []) or []:
+                    add(field, cname)
+
+    if not defs:                                                   # Schema B / C
+        fn = data.get("fields")
+        if isinstance(fn, dict):
+            for cname, flist in fn.items():
+                if isinstance(flist, list):
+                    for field in flist:
+                        add(field, cname)
+                else:
+                    add(flist, cname)
+        elif isinstance(fn, list):
+            for field in fn:
+                add(field, "(uncategorized)")
+
+    if not defs:                                                   # generic fallback
+        for field, cat in _iter_field_defs(data):
+            add(field, cat)
+
+    all_fields = {n for n, _, _ in defs}
+    if any(r is not None for _, _, r in defs):
+        required_fields = {n for n, _, r in defs if r}
+    else:
+        required_fields = set(all_fields)
+    field_categories = {n: c for n, c, _ in defs}
     return all_fields, required_fields, field_categories
 
 
-def extract_json_fields(data, category_mapping=None):
+def extract_json_fields(data, category_mapping=None, extra_nested_keys=None):
     category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
     nested_keys = {k for keys in category_mapping.values() for k in keys}
+    if extra_nested_keys:
+        nested_keys |= {str(k) for k in extra_nested_keys}
     fields = set()
 
```

**File**: `tests/test_validate_json_schemas.py` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+#!/usr/bin/env python3
+# -*- coding: utf-8 -*-
+"""Regression test for skills/*/research/validate_json.py.
+
+Guards two bugs that made the validator pass vacuously (a "green" that means nothing):
+  1. Only the `field_categories:` schema was parsed. But /research emits fields.yaml as
+     `fields: {<category>: [{name, description, detail_level}]}`, which was read as ZERO
+     fields -> coverage defaulted to 100% -> every JSON "passed".
+  2. `required` defaulted to False, so `valid` (== no missing required) was True even when
+     fields were missing.
+
+After the fix, the loader accepts the `field_categories`, `fields:{cat:[...]}` and flat
+`fields:[...]` shapes (plus a generic fallback), and treats every field as required when no
+explicit `required:` marker is present. A JSON missing a defined field now actually FAILS.
+
+Run:  python tests/test_validate_json_schemas.py   (exit 0 = all pass)
+"""
+import importlib.util
+import json
+import sys
+import tempfile
+from pathlib import Path
+
+ROOT = Path(__file__).resolve().parents[1]
+COPIES = sorted(ROOT.glob("skills/*/research/validate_json.py"))
+
+tmp = Path(tempfile.mkdtemp())
+# Schema A: field_categories + explicit `required` (one optional field 'notes')
+(tmp / "A.yaml").write_text(
+    "field_categories:\n"
+    "  - category: basic\n"
+    "    fields:\n"
+    "      - {name: a, required: true}\n"
+    "      - {name: b, required: true}\n"
+    "      - {name: notes, required: false}\n", encoding="utf-8")
+# Schema B: nested fields:{category:[...]} with detail_level, NO `required` markers
+(tmp / "B.yaml").write_text(
+    "fields:\n"
+    "  basic:\n"
+    "    - {name: a, detail_level: detailed}\n"
+    "    - {name: b, detail_level: brief}\n"
+    "    - {name: c, detail_level: moderate}\n"
+    "    - {name: d, detail_level: moderate}\n"
+    "uncertain: []\n", encoding="utf-8")
+(tmp / "good.json").write_text(json.dumps({"a": 1, "b": 1, "c": 1, "d": 1}), encoding="utf-8")
+(tmp / "bad.json").write_text(json.dumps({"a": 1, "b": 1, "c": 1}), encoding="utf-8")  # missing 'd'
+
+
+def load(path, i):
+    spec = importlib.util.spec_from_file_location(f"vj{i}", path)
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+fails = []
+def check(label, cond):
+    print(("PASS " if cond else "FAIL ") + label)
+    if not cond:
+        fails.append(label)
+
+
+assert COPIES, "no validate_json.py copies found under skills/*/research/"
+for i, path in enumerate(COPIES):
+    tag = path.relative_to(ROOT).parts[1]  # e.g. research-en
+    m = load(path, i)
+
+    aA, rA, _ = m.load_fields_yaml(tmp / "A.yaml")
+    check(f"[{tag}] Schema A: parses 3, keeps 'notes' optional", aA == {"a", "b", "notes"} and rA == {"a", "b"})
+
+    aB, rB, cB = m.load_fields_yaml(tmp / "B.yaml")
+    check(f"[{tag}] Schema B: parses 4 fields (was 0 before fix)", aB == {"a", "b", "c", "d"})
+    check(f"[{tag}] Schema B: all required when unmarked (no vacuous pass)", rB == aB)
+
+    good = m.validate_json(tmp / "good.json", aB, rB, cB)
+    bad = m.validate_json(tmp / "bad.json", aB, rB, cB)
+    check(f"[{tag}] good.json -> valid", good["valid"])
+    check(f"[{tag}] bad.json  -> INVALID (catches missing 'd')", (not bad["valid"]) and "d" in bad["missing_required"])
+
+print("\nRESULT:", "ALL PASS" if not fails else f"{len(fails)} FAILED -> {fails}")
+sys.exit(1 if fails else 0)
```

---

### Incident Patch 2: `e24c5cb4` (2026-06-19)
**Commit Message**: Fix validate_json.py: parse all fields.yaml schemas; stop vacuous pass

The validator only parsed the `field_categories:` schema, but /research emits
fields.yaml as `fields: {<category>: [{name, description, detail_level}]}`. That
shape was read as ZERO fields, so coverage defaulted to 100% and every result
JSON "passed" -- the validation step was effectively a no-op. `required` also
defaulted to False, so `valid` stayed True even when fields were missing.

- load_fields_yaml: accept field_categories / fields:{cat:[...]} / flat fields:[...]
  plus a generic fallback; treat all fields as required when no `required:` marker
  exists (explicit `required:` markers keep their opt-in semantics, unchanged).
- extract_json_fields: also descend into JSON keys named after declared categories.
- Apply to all 4 skill copies (research-en/zh, research-codex-en/zh).
- Add tests/test_validate_json_schemas.py regression test (guards all copies).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `skills/research-codex-en/research/validate_json.py` (modified, +69/-11)
```diff
@@ -22,23 +22,81 @@
 _SKIP_KEYS = {"_source_file", "uncertain"}
 
 
+def _iter_field_defs(node, category="(uncategorized)"):
+    """Generic fallback: yield (field_dict, category) for any dict carrying a 'name'."""
+    if isinstance(node, dict):
+        if isinstance(node.get("name"), (str, int, float)):
+            yield node, category
+            return
+        for k, v in node.items():
+            if k in _SKIP_KEYS:
+                continue
+            sub = category if k in ("fields", "field_categories") else str(k)
+            yield from _iter_field_defs(v, sub)
+    elif isinstance(node, list):
+        for item in node:
+            yield from _iter_field_defs(item, category)
+
+
 def load_fields_yaml(fields_path):
+    """Parse fields.yaml, tolerating the shapes the research skills actually emit:
+      A) field_categories: [ {category, fields: [{name, required?}]} ]   (validator-native)
+      B) fields: { <category>: [ {name, description, detail_level} ] }   (research-skill docs)
+      C) fields: [ {name, ...} ]                                         (flat list)
+      *) anything else -> generic walk for {name: ...} dicts
+
+    Required semantics (so the validator can never pass vacuously / "lie"):
+      - if ANY field carries an explicit `required:` key -> opt-in, preserve original behaviour
+      - else (detail_level-style, no markers)            -> ALL fields required, because the
+        script's stated purpose is COMPLETE field coverage.
+    """
     with fields_path.open(encoding="utf-8") as f:
-        data = yaml.safe_load(f)
-    items = [
-        (field["name"], category["category"], field.get("required", False))
-        for category in data.get("field_categories", [])
-        for field in category.get("fields", [])
-    ]
-    all_fields = {name for name, _, _ in items}
-    required_fields = {name for name, _, required in items if required}
-    field_categories = {name: category for name, category, _ in items}
+        data = yaml.safe_load(f) or {}
+    defs = []  # (name, category, required_or_None)
+
+    def add(field, category):
+        if isinstance(field, dict) and "name" in field:
+            defs.append((str(field["name"]), str(category), field.get("required", None)))
+
+    fc = data.get("field_categories")
+    if isinstance(fc, list):                                       # Schema A
+        for cat in fc:
+            if isinstance(cat, dict):
+                cname = cat.get("category", "(uncategorized)")
+                for field in cat.get("fields", []) or []:
+                    add(field, cname)
+
+    if not defs:                                                   # Schema B / C
+        fn = data.get("fields")
+        if isinstance(fn, dict):
+            for cname, flist in fn.items():
+                if isinstance(flist, list):
+                    for field in flist:
+                        add(field, cname)
+                else:
+                    add(flist, cname)
+        elif isinstance(fn, list):
+            for field in fn:
+                add(field, "(uncategorized)")
+
+    if not defs:                                                   # generic fallback
+        for field, cat in _iter_field_defs(data):
+            add(field, cat)
+
+    all_fields = {n for n, _, _ in defs}
+    if any(r is not None for _, _, r in defs):
+        required_fields = {n for n, _, r in defs if r}
+    else:
+        required_fields = set(all_fields)
+    field_categories = {n: c for n, c, _ in defs}
     return all_fields, required_fields, field_categories
 
 
-def extract_json_fields(data, category_mapping=None):
+def extract_json_fields(data, category_mapping=None, extra_nested_keys=None):
     category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
     nested_keys = {k for keys in category_mapping.values() for k in keys}
+    if extra_nested_keys:
+        nested_keys |= {str(k) for k in extra_nested_keys}
     fields = set()
 
```

**File**: `skills/research-codex-zh/research/validate_json.py` (modified, +69/-11)
```diff
@@ -22,23 +22,81 @@
 _SKIP_KEYS = {"_source_file", "uncertain"}
 
 
+def _iter_field_defs(node, category="(uncategorized)"):
+    """Generic fallback: yield (field_dict, category) for any dict carrying a 'name'."""
+    if isinstance(node, dict):
+        if isinstance(node.get("name"), (str, int, float)):
+            yield node, category
+            return
+        for k, v in node.items():
+            if k in _SKIP_KEYS:
+                continue
+            sub = category if k in ("fields", "field_categories") else str(k)
+            yield from _iter_field_defs(v, sub)
+    elif isinstance(node, list):
+        for item in node:
+            yield from _iter_field_defs(item, category)
+
+
 def load_fields_yaml(fields_path):
+    """Parse fields.yaml, tolerating the shapes the research skills actually emit:
+      A) field_categories: [ {category, fields: [{name, required?}]} ]   (validator-native)
+      B) fields: { <category>: [ {name, description, detail_level} ] }   (research-skill docs)
+      C) fields: [ {name, ...} ]                                         (flat list)
+      *) anything else -> generic walk for {name: ...} dicts
+
+    Required semantics (so the validator can never pass vacuously / "lie"):
+      - if ANY field carries an explicit `required:` key -> opt-in, preserve original behaviour
+      - else (detail_level-style, no markers)            -> ALL fields required, because the
+        script's stated purpose is COMPLETE field coverage.
+    """
     with fields_path.open(encoding="utf-8") as f:
-        data = yaml.safe_load(f)
-    items = [
-        (field["name"], category["category"], field.get("required", False))
-        for category in data.get("field_categories", [])
-        for field in category.get("fields", [])
-    ]
-    all_fields = {name for name, _, _ in items}
-    required_fields = {name for name, _, required in items if required}
-    field_categories = {name: category for name, category, _ in items}
+        data = yaml.safe_load(f) or {}
+    defs = []  # (name, category, required_or_None)
+
+    def add(field, category):
+        if isinstance(field, dict) and "name" in field:
+            defs.append((str(field["name"]), str(category), field.get("required", None)))
+
+    fc = data.get("field_categories")
+    if isinstance(fc, list):                                       # Schema A
+        for cat in fc:
+            if isinstance(cat, dict):
+                cname = cat.get("category", "(uncategorized)")
+                for field in cat.get("fields", []) or []:
+                    add(field, cname)
+
+    if not defs:                                                   # Schema B / C
+        fn = data.get("fields")
+        if isinstance(fn, dict):
+            for cname, flist in fn.items():
+                if isinstance(flist, list):
+                    for field in flist:
+                        add(field, cname)
+                else:
+                    add(flist, cname)
+        elif isinstance(fn, list):
+            for field in fn:
+                add(field, "(uncategorized)")
+
+    if not defs:                                                   # generic fallback
+        for field, cat in _iter_field_defs(data):
+            add(field, cat)
+
+    all_fields = {n for n, _, _ in defs}
+    if any(r is not None for _, _, r in defs):
+        required_fields = {n for n, _, r in defs if r}
+    else:
+        required_fields = set(all_fields)
+    field_categories = {n: c for n, c, _ in defs}
     return all_fields, required_fields, field_categories
 
 
-def extract_json_fields(data, category_mapping=None):
+def extract_json_fields(data, category_mapping=None, extra_nested_keys=None):
     category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
     nested_keys = {k for keys in category_mapping.values() for k in keys}
+    if extra_nested_keys:
+        nested_keys |= {str(k) for k in extra_nested_keys}
     fields = set()
 
```

**File**: `skills/research-en/research/validate_json.py` (modified, +69/-11)
```diff
@@ -22,23 +22,81 @@
 _SKIP_KEYS = {"_source_file", "uncertain"}
 
 
+def _iter_field_defs(node, category="(uncategorized)"):
+    """Generic fallback: yield (field_dict, category) for any dict carrying a 'name'."""
+    if isinstance(node, dict):
+        if isinstance(node.get("name"), (str, int, float)):
+            yield node, category
+            return
+        for k, v in node.items():
+            if k in _SKIP_KEYS:
+                continue
+            sub = category if k in ("fields", "field_categories") else str(k)
+            yield from _iter_field_defs(v, sub)
+    elif isinstance(node, list):
+        for item in node:
+            yield from _iter_field_defs(item, category)
+
+
 def load_fields_yaml(fields_path):
+    """Parse fields.yaml, tolerating the shapes the research skills actually emit:
+      A) field_categories: [ {category, fields: [{name, required?}]} ]   (validator-native)
+      B) fields: { <category>: [ {name, description, detail_level} ] }   (research-skill docs)
+      C) fields: [ {name, ...} ]                                         (flat list)
+      *) anything else -> generic walk for {name: ...} dicts
+
+    Required semantics (so the validator can never pass vacuously / "lie"):
+      - if ANY field carries an explicit `required:` key -> opt-in, preserve original behaviour
+      - else (detail_level-style, no markers)            -> ALL fields required, because the
+        script's stated purpose is COMPLETE field coverage.
+    """
     with fields_path.open(encoding="utf-8") as f:
-        data = yaml.safe_load(f)
-    items = [
-        (field["name"], category["category"], field.get("required", False))
-        for category in data.get("field_categories", [])
-        for field in category.get("fields", [])
-    ]
-    all_fields = {name for name, _, _ in items}
-    required_fields = {name for name, _, required in items if required}
-    field_categories = {name: category for name, category, _ in items}
+        data = yaml.safe_load(f) or {}
+    defs = []  # (name, category, required_or_None)
+
+    def add(field, category):
+        if isinstance(field, dict) and "name" in field:
+            defs.append((str(field["name"]), str(category), field.get("required", None)))
+
+    fc = data.get("field_categories")
+    if isinstance(fc, list):                                       # Schema A
+        for cat in fc:
+            if isinstance(cat, dict):
+                cname = cat.get("category", "(uncategorized)")
+                for field in cat.get("fields", []) or []:
+                    add(field, cname)
+
+    if not defs:                                                   # Schema B / C
+        fn = data.get("fields")
+        if isinstance(fn, dict):
+            for cname, flist in fn.items():
+                if isinstance(flist, list):
+                    for field in flist:
+                        add(field, cname)
+                else:
+                    add(flist, cname)
+        elif isinstance(fn, list):
+            for field in fn:
+                add(field, "(uncategorized)")
+
+    if not defs:                                                   # generic fallback
+        for field, cat in _iter_field_defs(data):
+            add(field, cat)
+
+    all_fields = {n for n, _, _ in defs}
+    if any(r is not None for _, _, r in defs):
+        required_fields = {n for n, _, r in defs if r}
+    else:
+        required_fields = set(all_fields)
+    field_categories = {n: c for n, c, _ in defs}
     return all_fields, required_fields, field_categories
 
 
-def extract_json_fields(data, category_mapping=None):
+def extract_json_fields(data, category_mapping=None, extra_nested_keys=None):
     category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
     nested_keys = {k for keys in category_mapping.values() for k in keys}
+    if extra_nested_keys:
+        nested_keys |= {str(k) for k in extra_nested_keys}
     fields = set()
 
```

**File**: `skills/research-zh/research/validate_json.py` (modified, +69/-11)
```diff
@@ -22,23 +22,81 @@
 _SKIP_KEYS = {"_source_file", "uncertain"}
 
 
+def _iter_field_defs(node, category="(uncategorized)"):
+    """Generic fallback: yield (field_dict, category) for any dict carrying a 'name'."""
+    if isinstance(node, dict):
+        if isinstance(node.get("name"), (str, int, float)):
+            yield node, category
+            return
+        for k, v in node.items():
+            if k in _SKIP_KEYS:
+                continue
+            sub = category if k in ("fields", "field_categories") else str(k)
+            yield from _iter_field_defs(v, sub)
+    elif isinstance(node, list):
+        for item in node:
+            yield from _iter_field_defs(item, category)
+
+
 def load_fields_yaml(fields_path):
+    """Parse fields.yaml, tolerating the shapes the research skills actually emit:
+      A) field_categories: [ {category, fields: [{name, required?}]} ]   (validator-native)
+      B) fields: { <category>: [ {name, description, detail_level} ] }   (research-skill docs)
+      C) fields: [ {name, ...} ]                                         (flat list)
+      *) anything else -> generic walk for {name: ...} dicts
+
+    Required semantics (so the validator can never pass vacuously / "lie"):
+      - if ANY field carries an explicit `required:` key -> opt-in, preserve original behaviour
+      - else (detail_level-style, no markers)            -> ALL fields required, because the
+        script's stated purpose is COMPLETE field coverage.
+    """
     with fields_path.open(encoding="utf-8") as f:
-        data = yaml.safe_load(f)
-    items = [
-        (field["name"], category["category"], field.get("required", False))
-        for category in data.get("field_categories", [])
-        for field in category.get("fields", [])
-    ]
-    all_fields = {name for name, _, _ in items}
-    required_fields = {name for name, _, required in items if required}
-    field_categories = {name: category for name, category, _ in items}
+        data = yaml.safe_load(f) or {}
+    defs = []  # (name, category, required_or_None)
+
+    def add(field, category):
+        if isinstance(field, dict) and "name" in field:
+            defs.append((str(field["name"]), str(category), field.get("required", None)))
+
+    fc = data.get("field_categories")
+    if isinstance(fc, list):                                       # Schema A
+        for cat in fc:
+            if isinstance(cat, dict):
+                cname = cat.get("category", "(uncategorized)")
+                for field in cat.get("fields", []) or []:
+                    add(field, cname)
+
+    if not defs:                                                   # Schema B / C
+        fn = data.get("fields")
+        if isinstance(fn, dict):
+            for cname, flist in fn.items():
+                if isinstance(flist, list):
+                    for field in flist:
+                        add(field, cname)
+                else:
+                    add(flist, cname)
+        elif isinstance(fn, list):
+            for field in fn:
+                add(field, "(uncategorized)")
+
+    if not defs:                                                   # generic fallback
+        for field, cat in _iter_field_defs(data):
+            add(field, cat)
+
+    all_fields = {n for n, _, _ in defs}
+    if any(r is not None for _, _, r in defs):
+        required_fields = {n for n, _, r in defs if r}
+    else:
+        required_fields = set(all_fields)
+    field_categories = {n: c for n, c, _ in defs}
     return all_fields, required_fields, field_categories
 
 
-def extract_json_fields(data, category_mapping=None):
+def extract_json_fields(data, category_mapping=None, extra_nested_keys=None):
     category_mapping = CATEGORY_MAPPING if category_mapping is None else category_mapping
     nested_keys = {k for keys in category_mapping.values() for k in keys}
+    if extra_nested_keys:
+        nested_keys |= {str(k) for k in extra_nested_keys}
     fields = set()
 
```

**File**: `tests/test_validate_json_schemas.py` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+#!/usr/bin/env python3
+# -*- coding: utf-8 -*-
+"""Regression test for skills/*/research/validate_json.py.
+
+Guards two bugs that made the validator pass vacuously (a "green" that means nothing):
+  1. Only the `field_categories:` schema was parsed. But /research emits fields.yaml as
+     `fields: {<category>: [{name, description, detail_level}]}`, which was read as ZERO
+     fields -> coverage defaulted to 100% -> every JSON "passed".
+  2. `required` defaulted to False, so `valid` (== no missing required) was True even when
+     fields were missing.
+
+After the fix, the loader accepts the `field_categories`, `fields:{cat:[...]}` and flat
+`fields:[...]` shapes (plus a generic fallback), and treats every field as required when no
+explicit `required:` marker is present. A JSON missing a defined field now actually FAILS.
+
+Run:  python tests/test_validate_json_schemas.py   (exit 0 = all pass)
+"""
+import importlib.util
+import json
+import sys
+import tempfile
+from pathlib import Path
+
+ROOT = Path(__file__).resolve().parents[1]
+COPIES = sorted(ROOT.glob("skills/*/research/validate_json.py"))
+
+tmp = Path(tempfile.mkdtemp())
+# Schema A: field_categories + explicit `required` (one optional field 'notes')
+(tmp / "A.yaml").write_text(
+    "field_categories:\n"
+    "  - category: basic\n"
+    "    fields:\n"
+    "      - {name: a, required: true}\n"
+    "      - {name: b, required: true}\n"
+    "      - {name: notes, required: false}\n", encoding="utf-8")
+# Schema B: nested fields:{category:[...]} with detail_level, NO `required` markers
+(tmp / "B.yaml").write_text(
+    "fields:\n"
+    "  basic:\n"
+    "    - {name: a, detail_level: detailed}\n"
+    "    - {name: b, detail_level: brief}\n"
+    "    - {name: c, detail_level: moderate}\n"
+    "    - {name: d, detail_level: moderate}\n"
+    "uncertain: []\n", encoding="utf-8")
+(tmp / "good.json").write_text(json.dumps({"a": 1, "b": 1, "c": 1, "d": 1}), encoding="utf-8")
+(tmp / "bad.json").write_text(json.dumps({"a": 1, "b": 1, "c": 1}), encoding="utf-8")  # missing 'd'
+
+
+def load(path, i):
+    spec = importlib.util.spec_from_file_location(f"vj{i}", path)
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+fails = []
+def check(label, cond):
+    print(("PASS " if cond else "FAIL ") + label)
+    if not cond:
+        fails.append(label)
+
+
+assert COPIES, "no validate_json.py copies found under skills/*/research/"
+for i, path in enumerate(COPIES):
+    tag = path.relative_to(ROOT).parts[1]  # e.g. research-en
+    m = load(path, i)
+
+    aA, rA, _ = m.load_fields_yaml(tmp / "A.yaml")
+    check(f"[{tag}] Schema A: parses 3, keeps 'notes' optional", aA == {"a", "b", "notes"} and rA == {"a", "b"})
+
+    aB, rB, cB = m.load_fields_yaml(tmp / "B.yaml")
+    check(f"[{tag}] Schema B: parses 4 fields (was 0 before fix)", aB == {"a", "b", "c", "d"})
+    check(f"[{tag}] Schema B: all required when unmarked (no vacuous pass)", rB == aB)
+
+    good = m.validate_json(tmp / "good.json", aB, rB, cB)
+    bad = m.validate_json(tmp / "bad.json", aB, rB, cB)
+    check(f"[{tag}] good.json -> valid", good["valid"])
+    check(f"[{tag}] bad.json  -> INVALID (catches missing 'd')", (not bad["valid"]) and "d" in bad["missing_required"])
+
+print("\nRESULT:", "ALL PASS" if not fails else f"{len(fails)} FAILED -> {fails}")
+sys.exit(1 if fails else 0)
```

---

### Incident Patch 3: `dc18cf45` (2026-04-10)
**Commit Message**: Fix missing frontmatter name fields and hardcoded paths in skills

Add missing `name` field to all research-zh and research-en SKILL.md
frontmatter (fixes #1). Replace hardcoded /home/weizhena/ paths with
~ and {project_dir} placeholders in research-deep skills (fixes #2).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

**File**: `skills/research-codex-en/research-deep/SKILL.md` (modified, +5/-5)
```diff
@@ -51,7 +51,7 @@ Read {fields_path} to get all field definitions
 
 ## Validation
 After completing JSON output, run validation script to ensure complete field coverage:
-python /home/weizhena/.codex/skills/research/validate_json.py -f {fields_path} -j {output_path}
+python ~/.codex/skills/research/validate_json.py -f {fields_path} -j {output_path}
 Task is complete only after validation passes.
 """
 ```
@@ -61,10 +61,10 @@ Task is complete only after validation passes.
 ## Task
 Research name: GitHub Copilot
 category: International Product
-description: Developed by Microsoft/GitHub, first mainstream AI coding assistant, ~40% market share, output structured JSON to /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+description: Developed by Microsoft/GitHub, first mainstream AI coding assistant, ~40% market share, output structured JSON to {project_dir}/results/GitHub_Copilot.json
 
 ## Field Definitions
-Read /home/weizhena/AIcoding/aicoding-history/fields.yaml to get all field definitions
+Read {project_dir}/fields.yaml to get all field definitions
 
 ## Output Requirements
 1. Output JSON according to fields defined in fields.yaml
@@ -73,11 +73,11 @@ Read /home/weizhena/AIcoding/aicoding-history/fields.yaml to get all field defin
 4. All field values must be in English
 
 ## Output Path
-/home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+{project_dir}/results/GitHub_Copilot.json
 
 ## Validation
 After completing JSON output, run validation script to ensure complete field coverage:
-python /home/weizhena/.codex/skills/research/validate_json.py -f /home/weizhena/AIcoding/aicoding-history/fields.yaml -j /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+python ~/.codex/skills/research/validate_json.py -f {project_dir}/fields.yaml -j {project_dir}/results/GitHub_Copilot.json
 Task is complete only after validation passes.
 ```
 
```

**File**: `skills/research-codex-zh/research-deep/SKILL.md` (modified, +5/-5)
```diff
@@ -51,7 +51,7 @@ Read {fields_path} to get all field definitions
 
 ## Validation
 After completing JSON output, run validation script to ensure complete field coverage:
-python /home/weizhena/.codex/skills/research/validate_json.py -f {fields_path} -j {output_path}
+python ~/.codex/skills/research/validate_json.py -f {fields_path} -j {output_path}
 Task is complete only after validation passes.
 """
 ```
@@ -61,10 +61,10 @@ Task is complete only after validation passes.
 ## Task
 Research name: GitHub Copilot
 category: International Product
-description: Developed by Microsoft/GitHub, first mainstream AI coding assistant, ~40% market share, output structured JSON to /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+description: Developed by Microsoft/GitHub, first mainstream AI coding assistant, ~40% market share, output structured JSON to {project_dir}/results/GitHub_Copilot.json
 
 ## Field Definitions
-Read /home/weizhena/AIcoding/aicoding-history/fields.yaml to get all field definitions
+Read {project_dir}/fields.yaml to get all field definitions
 
 ## Output Requirements
 1. Output JSON according to fields defined in fields.yaml
@@ -73,11 +73,11 @@ Read /home/weizhena/AIcoding/aicoding-history/fields.yaml to get all field defin
 4. All field values must be in English
 
 ## Output Path
-/home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+{project_dir}/results/GitHub_Copilot.json
 
 ## Validation
 After completing JSON output, run validation script to ensure complete field coverage:
-python /home/weizhena/.codex/skills/research/validate_json.py -f /home/weizhena/AIcoding/aicoding-history/fields.yaml -j /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+python ~/.codex/skills/research/validate_json.py -f {project_dir}/fields.yaml -j {project_dir}/results/GitHub_Copilot.json
 Task is complete only after validation passes.
 ```
 
```

**File**: `skills/research-en/research-add-fields/SKILL.md` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 ---
+name: research-add-fields
 user-invocable: true
 description: Add field definitions to existing research outline.
 allowed-tools: Bash, Read, Write, Glob, WebSearch, Task, AskUserQuestion
```

**File**: `skills/research-en/research-add-items/SKILL.md` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 ---
+name: research-add-items
 user-invocable: true
 description: Add items (research objects) to existing research outline.
 allowed-tools: Bash, Read, Write, Glob, WebSearch, Task, AskUserQuestion
```

**File**: `skills/research-en/research-deep/SKILL.md` (modified, +5/-4)
```diff
@@ -1,4 +1,5 @@
 ---
+name: research-deep
 user-invocable: true
 description: Read research outline, launch independent agent for each item for deep research. Disable task output.
 allowed-tools: Bash, Read, Write, Glob, WebSearch, Task
@@ -62,10 +63,10 @@ Task is complete only after validation passes.
 ## Task
 Research name: GitHub Copilot
 category: International Product
-description: Developed by Microsoft/GitHub, first mainstream AI coding assistant, ~40% market share, output structured JSON to /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+description: Developed by Microsoft/GitHub, first mainstream AI coding assistant, ~40% market share, output structured JSON to {project_dir}/results/GitHub_Copilot.json
 
 ## Field Definitions
-Read /home/weizhena/AIcoding/aicoding-history/fields.yaml to get all field definitions
+Read {project_dir}/fields.yaml to get all field definitions
 
 ## Output Requirements
 1. Output JSON according to fields defined in fields.yaml
@@ -74,11 +75,11 @@ Read /home/weizhena/AIcoding/aicoding-history/fields.yaml to get all field defin
 4. All field values must be in English
 
 ## Output Path
-/home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+{project_dir}/results/GitHub_Copilot.json
 
 ## Validation
 After completing JSON output, run validation script to ensure complete field coverage:
-python ~/.claude/skills/research/validate_json.py -f /home/weizhena/AIcoding/aicoding-history/fields.yaml -j /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+python ~/.claude/skills/research/validate_json.py -f {project_dir}/fields.yaml -j {project_dir}/results/GitHub_Copilot.json
 Task is complete only after validation passes.
 ```
 
```

---

### Incident Patch 4: `055b0fcd` (2026-01-08)
**Commit Message**: docs: fix wording in en README

**File**: `README.md` (modified, +4/-4)
```diff
@@ -51,7 +51,7 @@ pip install pyyaml
 ```
 /research AI Agent Demo 2025
 ```
-💡 **What happens**: Tell it your topic → It creates a research list for you
+💡 **What will happen**: Tell it your topic → It creates a research list for you
 
 **You get**: A list of 17 AI Agents to research (ChatGPT Agent, Claude Computer Use, Cursor, etc.) + what info to collect for each
 
@@ -60,21 +60,21 @@ pip install pyyaml
 /research-add-items
 /research-add-fields
 ```
-💡 **What happens**: Add more research items or field definitions
+💡 **What will happen**: Add more research items or field definitions
 
 ### Phase 2: Deep Research
 ```
 /research-deep
 ```
-💡 **What happens**: AI automatically searches the web for each item, one by one
+💡 **What will happen**: AI automatically searches the web for each item, one by one
 
 **You get**: Detailed info for each Agent (company, release date, pricing, tech specs, reviews...)
 
 ### Phase 3: Generate Report
 ```
 /research-report
 ```
-💡 **What happens**: All data → One organized report
+💡 **What will happen**: All data → One organized report
 
 **You get**: `report.md` - A complete markdown report with table of contents, ready to read or share
 
```

---

### Incident Patch 5: `5155c76d` (2026-01-08)
**Commit Message**: docs: fix wording in zh README

**File**: `README.zh.md` (modified, +4/-4)
```diff
@@ -51,7 +51,7 @@ pip install pyyaml
 ```
 /research AI Agent Demo 2025
 ```
-💡 **发生了什么**：告诉它你要研究什么 → 它帮你列出调研清单
+💡 **会发生什么**：告诉它你要研究什么 → 它帮你列出调研清单
 
 **你会得到**：17个待调研的AI Agent清单（ChatGPT Agent、Claude Computer Use、Cursor等）+ 每个要收集哪些信息
 
@@ -60,21 +60,21 @@ pip install pyyaml
 /research-add-items
 /research-add-fields
 ```
-💡 **发生了什么**：补充更多调研对象或字段定义
+💡 **会发生什么**：补充更多调研对象或字段定义
 
 ### 阶段2：深度调研
 ```
 /research-deep
 ```
-💡 **发生了什么**：AI自动上网搜索每个item的详细信息，逐个完成
+💡 **会发生什么**：AI自动上网搜索每个item的详细信息，逐个完成
 
 **你会得到**：每个Agent的详细资料（公司、发布日期、定价、技术规格、用户评价...）
 
 ### 阶段3：生成报告
 ```
 /research-report
 ```
-💡 **发生了什么**：所有数据 → 一份整理好的报告
+💡 **会发生什么**：所有数据 → 一份整理好的报告
 
 **你会得到**：`report.md` - 带目录的完整Markdown报告，可直接阅读或分享
 
```

---

### Incident Patch 6: `779c4476` (2026-01-07)
**Commit Message**: fix: address code review issues from Claude and GPT-5.2

- report/SKILL.md: add AskUserQuestion to allowed-tools
- validate_json.py: remove unused imports (List, Any)
- validate_json.py: sort output lists for deterministic order
- validate_json.py: limit recursion to category level only
- validate_json.py: add list-of-dict handling
- EN validate_json.py: remove Chinese from CATEGORY_MAPPING
- EN deep/SKILL.md: change output language from Chinese to English
- deep/SKILL.md: add slug handling for filenames
- report/SKILL.md: fix uncertain_fields -> uncertain naming
- README: add PyYAML dependency note

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

**File**: `README.md` (modified, +3/-0)
```diff
@@ -24,6 +24,9 @@ cp -r skills/research-zh ~/.claude/skills/research
 
 # Required: Install agent
 cp agents/web-search-agent.md ~/.claude/agents/
+
+# Required: Install Python dependency
+pip install pyyaml
 ```
 
 ## Commands
```

**File**: `README.zh.md` (modified, +3/-0)
```diff
@@ -24,6 +24,9 @@ cp -r skills/research-en ~/.claude/skills/research
 
 # 必需：安装agent
 cp agents/web-search-agent.md ~/.claude/agents/
+
+# 必需：安装Python依赖
+pip install pyyaml
 ```
 
 ## 命令
```

**File**: `skills/research-en/deep/SKILL.md` (modified, +3/-3)
```diff
@@ -28,7 +28,7 @@ Find `*/outline.yaml` file in current working directory, read items list, execut
 - `{item_related_info}`: item's complete yaml content (name + category + description etc.)
 - `{output_dir}`: execution.output_dir from outline.yaml (default: ./results)
 - `{fields_path}`: absolute path to {topic}/fields.yaml
-- `{output_path}`: absolute path to {output_dir}/{item_name}.json
+- `{output_path}`: absolute path to {output_dir}/{item_name_slug}.json (slugify item_name: replace spaces with _, remove special chars)
 
 **Hard Constraint**: The following prompt must be strictly reproduced, only replacing variables in {xxx}, do not modify structure or wording.
 
@@ -44,7 +44,7 @@ Read {fields_path} to get all field definitions
 1. Output JSON according to fields defined in fields.yaml
 2. Mark uncertain field values with [uncertain]
 3. Add uncertain array at the end of JSON, listing all uncertain field names
-4. All field values must be in Chinese (research can be in English, but final JSON values in Chinese)
+4. All field values must be in English
 
 ## Output Path
 {output_path}
@@ -70,7 +70,7 @@ Read /home/weizhena/AIcoding/aicoding-history/fields.yaml to get all field defin
 1. Output JSON according to fields defined in fields.yaml
 2. Mark uncertain field values with [uncertain]
 3. Add uncertain array at the end of JSON, listing all uncertain field names
-4. All field values must be in Chinese (research can be in English, but final JSON values in Chinese)
+4. All field values must be in English
 
 ## Output Path
 /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
```

**File**: `skills/research-en/report/SKILL.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 ---
 description: Summarize deep research results into markdown report, cover all fields, skip uncertain values.
-allowed-tools: Read, Write, Glob, Bash
+allowed-tools: Read, Write, Glob, Bash, AskUserQuestion
 ---
 
 # Research Report - Summary Report
@@ -75,7 +75,7 @@ CATEGORY_MAPPING = {
 Collect fields that exist in JSON but not defined in fields.yaml, put in "Other Info" category. Note to filter:
 - Internal fields: `_source_file`, `uncertain`
 - Nested structure top-level keys: `basic_info`, `technical_features` etc.
-- `uncertain_fields` list: Display each field name on separate line, don't compress into one line
+- `uncertain` array: Display each field name on separate line, don't compress into one line
 
 **5. Uncertain Value Skipping**
 Skip conditions:
```

**File**: `skills/research-en/validate_json.py` (modified, +44/-28)
```diff
@@ -9,18 +9,18 @@
 import yaml
 import sys
 from pathlib import Path
-from typing import Dict, List, Set, Any, Tuple
+from typing import Dict, Set, Tuple
 
-# Category mapping (supports both Chinese and English keys)
+# Category mapping (English keys only)
 CATEGORY_MAPPING = {
-    "basic_info": ["basic_info", "基本信息"],
-    "technical_features": ["technical_features", "technical_characteristics", "技术特性"],
-    "performance_metrics": ["performance_metrics", "performance", "性能指标"],
-    "milestone_significance": ["milestone_significance", "milestones", "里程碑意义"],
-    "business_info": ["business_info", "commercial_info", "商业信息"],
-    "competition_ecosystem": ["competition_ecosystem", "competition", "竞争与生态"],
-    "history": ["history", "历史沿革"],
-    "market_positioning": ["market_positioning", "market", "市场定位"],
+    "basic_info": ["basic_info", "Basic Info"],
+    "technical_features": ["technical_features", "technical_characteristics", "Technical Features"],
+    "performance_metrics": ["performance_metrics", "performance", "Performance Metrics"],
+    "milestone_significance": ["milestone_significance", "milestones", "Milestone Significance"],
+    "business_info": ["business_info", "commercial_info", "Business Info"],
+    "competition_ecosystem": ["competition_ecosystem", "competition", "Competition Ecosystem"],
+    "history": ["history", "History"],
+    "market_positioning": ["market_positioning", "market", "Market Positioning"],
 }
 
 
@@ -53,30 +53,41 @@ def load_fields_yaml(fields_path: Path) -> Tuple[Set[str], Set[str], Dict[str, s
 def extract_json_fields(data: Dict, category_mapping: Dict = None) -> Set[str]:
     """
     Extract all field names from JSON (supports both flat and nested structures)
+    Only extracts field names at category level, not nested dict/list values
     """
     if category_mapping is None:
         category_mapping = CATEGORY_MAPPING
 
-    # Get all possible nested keys
+    # Get all possible nested keys (category containers)
     nested_keys = set()
     for keys in category_mapping.values():
         nested_keys.update(keys)
 
     fields = set()
 
-    def collect_fields(d: Dict, is_top_level: bool = True):
-        for k, v in d.items():
-            # Skip internal fields
-            if k in {"_source_file", "uncertain"}:
-                continue
-            # If it's a top-level nested key, recurse into it
-            if is_top_level and k in nested_keys:
-                if isinstance(v, dict):
-                    collect_fields(v, is_top_level=False)
-            else:
-                fields.add(k)
-                if isinstance(v, dict):
-                    collect_fields(v, is_top_level=False)
+    def collect_fields(d, is_category_level: bool = True):
+        """
+        Collect fields from dict or list structures
+        is_category_level: True if we're at top level or inside a category container
+        """
+        if isinstance(d, dict):
+            for k, v in d.items():
+                # Skip internal fields
+                if k in {"_source_file", "uncertain"}:
+                    continue
+                # If it's a category container key, recurse into it
+                if is_category_level and k in nested_keys:
+                    if isinstance(v, dict):
+                        collect_fields(v, is_category_level=True)
+                else:
+                    # This is a field name, add it
+                    fields.add(k)
+                    # Don't recurse into field values (avoid counting nested keys as fields)
+        elif isinstance(d, list):
+            # Handle list-of-dict structures at category level
+            for item in d:
+                if isinstance(item, dict):
+                    collect_fields(item, is_category_level=is_category_level)
 
     collect_fields(data)
     return fields
@@ -110,17 +121,21 @@ def validate_json(json_path: Path, all_fields: Set[str], required_fields: Set[st
             missing_by_category[c
```

---

### Incident Patch 7: `98ddfce4` (2026-01-06)
**Commit Message**: fix: update validate_json.py path from commands to skills

~/.claude/commands/research/ -> ~/.claude/skills/research/

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

**File**: `skills/research-en/deep/SKILL.md` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ Read {fields_path} to get all field definitions
 
 ## Validation
 After completing JSON output, run validation script to ensure complete field coverage:
-python ~/.claude/commands/research/validate_json.py -f {fields_path} -j {output_path}
+python ~/.claude/skills/research/validate_json.py -f {fields_path} -j {output_path}
 Task is complete only after validation passes.
 """
 ```
@@ -77,7 +77,7 @@ Read /home/weizhena/AIcoding/aicoding-history/fields.yaml to get all field defin
 
 ## Validation
 After completing JSON output, run validation script to ensure complete field coverage:
-python ~/.claude/commands/research/validate_json.py -f /home/weizhena/AIcoding/aicoding-history/fields.yaml -j /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+python ~/.claude/skills/research/validate_json.py -f /home/weizhena/AIcoding/aicoding-history/fields.yaml -j /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
 Task is complete only after validation passes.
 ```
 
```

**File**: `skills/research-zh/deep/SKILL.md` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ prompt = f"""## 任务
 
 ## 验证
 完成JSON输出后，运行验证脚本确保字段完整覆盖：
-python ~/.claude/commands/research/validate_json.py -f {fields_path} -j {output_path}
+python ~/.claude/skills/research/validate_json.py -f {fields_path} -j {output_path}
 验证通过后才算完成任务。
 """
 ```
@@ -77,7 +77,7 @@ description: Microsoft/GitHub开发，首个主流AI编程助手，市场份额
 
 ## 验证
 完成JSON输出后，运行验证脚本确保字段完整覆盖：
-python ~/.claude/commands/research/validate_json.py -f /home/weizhena/AIcoding/aicoding-history/fields.yaml -j /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
+python ~/.claude/skills/research/validate_json.py -f /home/weizhena/AIcoding/aicoding-history/fields.yaml -j /home/weizhena/AIcoding/aicoding-history/results/GitHub_Copilot.json
 验证通过后才算完成任务。
 ```
 
```

---

### Incident Patch 8: `36644496` (2026-01-06)
**Commit Message**: docs: fix command syntax - use 'run /research' instead of '/research'

- Add note about slash command conflict with built-in commands
- Update all command examples to use 'run' prefix

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

**File**: `README.md` (modified, +24/-20)
```diff
@@ -19,13 +19,15 @@ A structured research workflow skill for Claude Code, supporting two-phase resea
 
 ### Commands
 
+> **Note**: Use `run /research` instead of `/research` directly, as slash commands conflict with built-in commands.
+
 | Command | Description |
 |---------|-------------|
-| `/research` | Generate research outline with items and fields |
-| `/research/add-items` | Add more items to existing outline |
-| `/research/add-fields` | Add more fields to existing outline |
-| `/research/deep` | Deep research each item with parallel agents |
-| `/research/report` | Generate markdown report from JSON results |
+| `run /research` | Generate research outline with items and fields |
+| `run /research/add-items` | Add more items to existing outline |
+| `run /research/add-fields` | Add more fields to existing outline |
+| `run /research/deep` | Deep research each item with parallel agents |
+| `run /research/report` | Generate markdown report from JSON results |
 
 ### Installation
 
@@ -46,7 +48,7 @@ cp agents/web-search-agent.md ~/.claude/agents/
 
 #### Phase 1: Generate Outline
 ```
-/research <topic>
+run /research <topic>
 ```
 - Model knowledge generates initial items and field framework
 - Web search supplements latest items
@@ -55,7 +57,7 @@ cp agents/web-search-agent.md ~/.claude/agents/
 
 #### Phase 2: Deep Research
 ```
-/research/deep
+run /research/deep
 ```
 - Parallel agents research each item (batch_size configurable)
 - Each agent reads fields.yaml and outputs structured JSON
@@ -64,13 +66,13 @@ cp agents/web-search-agent.md ~/.claude/agents/
 
 #### Optional: Expand Outline
 ```
-/research/add-items    # Add research targets via user input or web search
-/research/add-fields   # Add field definitions
+run /research/add-items    # Add research targets via user input or web search
+run /research/add-fields   # Add field definitions
 ```
 
 #### Phase 3: Generate Report
 ```
-/research/report
+run /research/report
 ```
 - Generates Python script to convert JSON to markdown
 - User selects summary fields for TOC
@@ -94,13 +96,15 @@ Claude Code 的结构化调研工作流技能，支持两阶段调研：outline
 
 ### 命令
 
+> **注意**：使用 `run /research` 而非直接 `/research`，因为斜杠命令与内置命令冲突。
+
 | 命令 | 描述 |
 |------|------|
-| `/research` | 生成包含items和fields的调研outline |
-| `/research/add-items` | 向现有outline添加更多items |
-| `/research/add-fields` | 向现有outline添加更多fields |
-| `/research/deep` | 使用并行agents对每个item进行深度调研 |
-| `/research/report` | 从JSON结果生成markdown报告 |
+| `run /research` | 生成包含items和fields的调研outline |
+| `run /research/add-items` | 向现有outline添加更多items |
+| `run /research/add-fields` | 向现有outline添加更多fields |
+| `run /research/deep` | 使用并行agents对每个item进行深度调研 |
+| `run /research/report` | 从JSON结果生成markdown报告 |
 
 ### 安装
 
@@ -121,7 +125,7 @@ cp agents/web-search-agent.md ~/.claude/agents/
 
 #### 阶段1：生成Outline
 ```
-/research <topic>
+run /research <topic>
 ```
 - 模型知识生成初始items和字段框架
 - 网络搜索补充最新items
@@ -130,7 +134,7 @@ cp agents/web-search-agent.md ~/.claude/agents/
 
 #### 阶段2：深度调研
 ```
-/research/deep
+run /research/deep
 ```
 - 并行agents调研每个item（batch_size可配置）
 - 每个agent读取fields.yaml并输出结构化JSON
@@ -139,13 +143,13 @@ cp agents/web-search-agent.md ~/.claude/agents/
 
 #### 可选：扩展Outline
 ```
-/research/add-items    # 通过用户输入或网络搜索添加调研对象
-/research/add-fields   # 添加字段定义
+run /research/add-items    # 通过用户输入或网络搜索添加调研对象
+run /research/add-fields   # 添加字段定义
 ```
 
 #### 阶段3：生成报告
 ```
-/research/report
+run /research/report
 ```
 - 生成Python脚本将JSON转换为markdown
 - 用户选择目录中显示的摘要字段
```

#### Recent Merged Pull Requests:
- **PR #9** (closed): docs: add Autohand Code install path (@igorcosta)
- **PR #8** (2026-08-23): Fix validate_json.py: parse all fields.yaml schemas; stop vacuous pass (@xwang4-svg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

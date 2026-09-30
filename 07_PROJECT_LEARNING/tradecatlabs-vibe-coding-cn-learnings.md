# Forensic Learning Record (Deep Inspection): tradecatlabs/vibe-coding-cn

> **Canonical Artifact**: `07_PROJECT_LEARNING/tradecatlabs-vibe-coding-cn-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tradecatlabs/vibe-coding-cn](https://github.com/tradecatlabs/vibe-coding-cn))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:05.986Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tradecatlabs/vibe-coding-cn`
- **Description**: Vibe Coding 从入门到精通教程｜AI 结对编程工作流｜Prompt、Skill、Workflow、上下文管理、codex实战指南
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 16981 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `research/vibe-cybersecurity-cn/governance/tasks/0001-survey-cybersecurity-supply-chain/validate_candidates.py`
```
#!/usr/bin/env python3
"""校验网络安全供应链候选目录并重建可读表。
运行：python3 governance/tasks/0001-survey-cybersecurity-supply-chain/validate_candidates.py
依赖：Python 3.10+ 标准库，以及同目录 supply-chain-candidates.json。
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "supply-chain-candidates.json"
TABLE_PATH = ROOT / "CANDIDATE_TABLE.md"

VALID_CATEGORIES = {
    "agent-harness",
    "orchestration-operations",
    "asset-discovery",
    "dynamic-validation",
    "code-cloud-analysis",
    "software-supply-chain",
    "intelligence-standards",
    "benchmarks-labs",
}
VALID_DISPOSITIONS = {"mvp", "pilot", "reference", "hold"}
VALID_EFFECTS = {"none", "data-only", "passive", "active-low", "active-medium", "active-high"}
SCORE_KEYS = ("fit", "evidence", "safety", "operability", "maturity")


def fail(message: str) -> None:
    raise ValueError(message)


def valid_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def validate(catalog: dict[str, object]) -> list[dict[str, object]]:
    if catalog.get("schema_version") != "1.0.0":
        fail("schema_version 必须为 1.0.0")
    if not isinstance(catalog.get("snapshot_date"), str):
        fail("缺少 snapshot_date")

    candidates = catalog.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        fail("candidates 必须是非空数组")

    seen: set[str] = set()
    for index, candidate in enumerate(candidates):
        prefix = f"candidates[{index}]"
        if not isinstance(candidate, dict):
            fail(f"{prefix} 必须是对象")

        candidate_id = candidate.get("id")
        if not isinstance(candidate_id, str) or not candidate_id:
            fail(f"{prefix}.id 缺失")
        if candidate_id in seen:
            fail(f"重复 id: {candidate_id}")
        seen.add(candidate_id)

        if candidate.get("category") not in VALID_CATEGORIES:
            fail(f"{candidate_id}: category 非法")
        if candidate.get("disposition") not in VALID_DISPOSITIONS:
            fail(f"{candidate_id}: disposition 非法")
        if candidate.get("network_effect") not in VALID_EFFECTS:
            fail(f"{candidate_id}: network_effect 非法")
        if not valid_url(candidate.get("upstream_url")):
            fail(f"{candidate_id}: upstream_url 必须是 HTTPS")

        source_urls = candidate.get("fact_sources")
        if not isinstance(source_urls, list) or not source_urls:
            fail(f"{candidate_id}: 至少需要一个 fact_sources")
        if not all(valid_url(url) for url in source_urls):
            fail(f"{candidate_id}: fact_sources 必须全部是 HTTPS")

        for field in ("name", "license", "role", "rationale", "evidence_ceiling", "isolation"):
            if not isinstance(candidate.get(field), str) or not candidate[field].strip():
                fail(f"{candidate_id}: {field} 不能为空")

        for field in ("interfaces", "machine_outputs", "supply_chain_controls", "blockers"):
            if not isinstance(candidate.get(field), list):
                fail(f"{candidate_id}: {field} 必须是数组")

        scores = candidate.get("scores")
        if not isinstance(scores, dict) or set(scores) != set(SCORE_KEYS):
            fail(f"{candidate_id}: scores 字段不完整")
        for score_name, value in scores.items():
            if not isinstance(value, int) or not 0 <= value <= 5:
                fail(f"{candidate_id}: scores.{score_name} 必须为 0..5 整数")

        if candidate["disposition"] == "mvp" and candidate["network_effect"] == "active-high":
            fail(f"{candidate_id}: active-high 不得直接进入 mvp")
        if candidate["disposition"] in {"mvp", "pilot"} and not candidate["machine_outputs"]:
            fail(f"{candidate_id}: mvp/pilot 必须有机器输出")
        if candidate["network_effect"].startswith("active") and candidate["isolation"] == "none":
            fail(f"{candidate_id}: 主动工具必须声明隔离")

    return candidates


def total_score(candidate: dict[str, object]) -> int:
    scores = candidate["scores"]
    assert isinstance(scores, dict)
    return sum(int(scores[key]) for key in SCORE_KEYS)


def render(catalog: dict[str, object], candidates: list[dict[str, object]]) -> str:
    sorted_candidates = sorted(
        candidates,
        key=lambda item: (
            {"mvp": 0, "pilot": 1, "reference": 2, "hold": 3}[str(item["disposition"])],
            -total_score(item),
            str(item["name"]).lower(),
        ),
    )
    lines = [
        "# 开源网络安全供应链候选表",
        "",
        f"检索截面：`{catalog['snapshot_date']}`。本表由 `supply-chain-candidates.json` 生成，请勿手工编辑。",
        "",
        "评分是本项目的选型判断，不是上游官方声明，也不代表已完成本地能力验证。",
        "",
        "| 状态 | 候选 | 类别 | 角色 | 接口 / 输出 | 网络副作用 | 许可 | 分数 | 主要门禁 |",
        "|---|---|---|---|---|---|---|---:|---|",
    ]
    for candidate in sorted_candidates:
        interfaces = ", ".join(str(value) for value in candidate["interfaces"]) or "-"
        outputs = ", ".join(str(value) for value in candidate["machine_outputs"]) or "-"
        blockers = "；".join(str(value) for value in candidate["blockers"]) or "无"
        lines.append(
            "| {disposition} | [{name}]({url}) | {category} | {role} | {interfaces} / {outputs} | "
            "{effect} | {license} | {score}/25 | {blockers} |".format(
                disposition=candidate["disposition"],
                name=str(candidate["name"]).replace("|", "\\|"),
                url=candidate["upstream_url"],
                category=candidate["category"],
                role=str(candidate["role"]).replace("|", "\\|"),
                interfaces=interfaces.replace("|", "\\|"),
                outputs=outputs.replace("|", "\\|"),
                effect=candidate["network_effect"],
                license=str(candidate["license"]).replace("|", "\\|"),
                score=total_score(candidate),
                blockers=blockers.replace("|", "\\|"),
            )
        )

    disposition_counts = Counter(str(candidate["disposition"]) for candidate in candidates)
    category_counts = Counter(str(candidate["category"]) for candidate in candidates)
    lines.extend(
        [
            "",
            "## 汇总",
            "",
            f"- 总候选：{len(candidates)}",
            "- 状态：" + "，".join(f"{key}={disposition_counts[key]}" for key in ("mvp", "pilot", "reference", "hold")),
            "- 类别：" + "，".join(f"{key}={category_counts[key]}" for key in sorted(category_counts)),
            "",
            "## 状态语义",
            "",
            "- `mvp`：允许进入本地隔离纵向样例；仍需固定版本和真实复跑。",
            "- `pilot`：价值明确，但部署、许可、动作风险或运维成本需要先校准。",
            "- `reference`：仅用于架构、方法、数据或评测研究，不进入默认执行工具面。",
            "- `hold`：当前阻塞未闭合，不进入实施计划。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    try:
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        if not isinstance(catalog, dict):
            fail("catalog 顶层必须是对象")
        candidates = validate(catalog)
        rendered = render(catalog, candidates)
        TABLE_PATH.write_text(rendered, encoding="utf-8")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"BLOCK: {exc}", file=sys.stderr)
        return 1

    print(f"PASS: {len(candidates)} candidates validated; rebuilt {TABLE_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


```

### Core Architecture Module: `research/vibe-cybersecurity-cn/governance/tasks/0002-prepare-supply-chain-admission/validate_admission_candidates.py`
```
#!/usr/bin/env python3
"""校验供应链准入候选并生成可读表。
运行：python3 governance/tasks/0002-prepare-supply-chain-admission/validate_admission_candidates.py
依赖：Python 3.10+ 标准库、同目录准入目录和 0001 研究目录。
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ADMISSION_PATH = ROOT / "admission-candidates.json"
TABLE_PATH = ROOT / "ADMISSION_CANDIDATE_TABLE.md"
VALID_CLASSES = {"container", "data", "executable", "rules", "schema"}
VALID_STATES = {"admission-candidate", "pinned", "verified", "admitted", "suspended", "retired"}
VALID_CHECKS = {"pass", "pending", "block", "not-applicable"}
REQUIRED_CHECK_KEYS = (
    "research_source", "license_review", "immutable_pin",
    "integrity_verification", "security_review", "interface_contract",
    "isolation_policy", "behavior_test", "rollback_test",
)
EXPECTED_SOURCE_CATALOG = "../0001-survey-cybersecurity-supply-chain/supply-chain-candidates.json"
PROFILE_EFFECTS = {
    "schema-data": {"data-only"},
    "local-readonly": {"none"},
    "lab-active": {"data-only", "active-low", "active-medium"},
    "authorized-passive": {"passive"},
    "authorized-active": {"active-low", "active-medium"},
}
SAFE_RELATIVE_REF = re.compile(r"^(?!/)(?!.*(?:^|/)\.\.(?:/|$)).+\S$")
SHA256_DIGEST = re.compile(r"^sha256:[a-f0-9]{64}$")


def fail(message: str) -> None:
    raise ValueError(message)


def load_json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        fail(f"{path.name}: 顶层必须是对象")
    return payload


def validate() -> tuple[dict[str, object], list[dict[str, object]], dict[str, dict[str, object]]]:
    admission = load_json(ADMISSION_PATH)
    if admission.get("schema_version") != "1.0.0":
        fail("schema_version 必须为 1.0.0")
    if admission.get("source_catalog") != EXPECTED_SOURCE_CATALOG:
        fail("source_catalog 必须指向固定的 0001 研究目录")
    source_path = (ADMISSION_PATH.parent / EXPECTED_SOURCE_CATALOG).resolve()
    source = load_json(source_path)
    if admission.get("source_snapshot_date") != source.get("snapshot_date"):
        fail("source_snapshot_date 与研究目录不一致")

    source_candidates = source.get("candidates")
    if not isinstance(source_candidates, list):
        fail("研究目录 candidates 非法")
    source_by_id = {
        str(item["id"]): item for item in source_candidates if isinstance(item, dict)
    }

    check_keys = admission.get("check_keys")
    profiles = admission.get("profiles")
    waves = admission.get("waves")
    candidates = admission.get("candidates")
    if check_keys != list(REQUIRED_CHECK_KEYS):
        fail("check_keys 必须与校验器固定八门禁完全一致")
    if not isinstance(profiles, dict) or not profiles:
        fail("profiles 必须是非空对象")
    if not isinstance(waves, dict) or not waves:
        fail("waves 必须是非空对象")
    if not isinstance(candidates, list) or not candidates:
        fail("candidates 必须是非空数组")

    seen: set[str] = set()
    orders: set[int] = set()
    for index, item in enumerate(candidates):
        if not isinstance(item, dict):
            fail(f"candidates[{index}] 必须是对象")
        source_id = item.get("source_id")
        if not isinstance(source_id, str) or source_id not in source_by_id:
            fail(f"candidates[{index}].source_id 不在研究目录")
        if source_id in seen:
            fail(f"重复 source_id: {source_id}")
        seen.add(source_id)
        source_item = source_by_id[source_id]
        if source_item.get("disposition") != "mvp":
            fail(f"{source_id}: 只有研究状态 mvp 可进入准入候选")
        if source_item.get("network_effect") == "active-high":
            fail(f"{source_id}: active-high 不得进入当前准入候选")

        order = item.get("order")
        if not isinstance(order, int) or order < 0 or order in orders:
            fail(f"{source_id}: order 必须是唯一非负整数")
        orders.add(order)
        if item.get("wave") not in waves:
            fail(f"{source_id}: wave 未定义")
        if item.get("artifact_class") not in VALID_CLASSES:
            fail(f"{source_id}: artifact_class 非法")
        if item.get("profile") not in profiles:
            fail(f"{source_id}: profile 未定义")
        network_effect = str(source_item.get("network_effect"))
        if network_effect not in PROFILE_EFFECTS.get(str(item.get("profile")), set()):
            fail(f"{source_id}: profile 与 network_effect 不匹配")
        if item.get("admission_state") not in VALID_STATES:
            fail(f"{source_id}: admission_state 非法")
        if item.get("default_enabled") is not False:
            fail(f"{source_id}: 候选阶段必须 default_enabled=false")
        for field in ("planned_role", "owner_role"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                fail(f"{source_id}: {field} 不能为空")

        pin = item.get("pin")
        if not isinstance(pin, dict) or set(pin) != {"ref", "digest", "status"}:
            fail(f"{source_id}: pin 字段不完整")
        if pin.get("status") not in {"pending", "verified"}:
            fail(f"{source_id}: pin.status 非法")
        if pin.get("status") == "verified" and (not pin.get("ref") or not pin.get("digest")):
            fail(f"{source_id}: verified pin 必须有 ref 和 digest")
        if pin.get("status") == "verified" and not SHA256_DIGEST.fullmatch(str(pin.get("digest"))):
            fail(f"{source_id}: verified pin.digest 必须是 sha256")

        checks = item.get("checks")
        if not isinstance(checks, dict) or set(checks) != set(check_keys):
            fail(f"{source_id}: checks 与 check_keys 不一致")
        if any(value not in VALID_CHECKS for value in checks.values()):
            fail(f"{source_id}: checks 状态非法")
        if checks.get("research_source") != "pass":
            fail(f"{source_id}: research_source 必须通过")
        evidence_refs = item.get("evidence_refs")
        if not isinstance(evidence_refs, dict) or not set(evidence_refs).issubset(
            set(REQUIRED_CHECK_KEYS) - {"research_source"}
        ):
            fail(f"{source_id}: evidence_refs 字段非法")
        for check_name in REQUIRED_CHECK_KEYS[1:]:
            refs = evidence_refs.get(check_name, [])
            if not isinstance(refs, list) or not all(
                isinstance(ref, str) and SAFE_RELATIVE_REF.fullmatch(ref) for ref in refs
            ):
                fail(f"{source_id}: evidence_refs.{check_name} 必须是安全相对引用数组")
            if checks[check_name] == "pass" and not refs:
                fail(f"{source_id}: {check_name}=pass 必须绑定 evidence_refs")
        if item["admission_state"] == "admitted":
            if pin.get("status") != "verified" or any(value != "pass" for value in checks.values()):
                fail(f"{source_id}: 未完成全部门禁不得 admitted")
        for field in ("extra_gates", "blocking_conditions"):
            values = item.get(field)
            if not isinstance(values, list) or not values or not all(
                isinstance(value, str) and value.strip() for value in values
            ):
                fail(f"{source_id}: {field} 必须是非空字符串数组")

    research_mvp_ids = {
        str(item["id"]) for item in source_candidates
        if isinstance(item, dict) and item.get("disposition") == "mvp"
    }
    if seen != research_mvp_ids:
        missing = sorted(research_mvp_ids - seen)
        extra = sorted(seen - research_mvp_ids)
        fail(f"准入候选必须完整覆盖研究 MVP；missing={missing}, extra={extra}")
    return admission, candidates, source_by_id


def render(
    admission: dict[str, object],
    candidates: list[dict[str, object]],
    source_by_id: dict[str, dict[str, object]],
) -> str:
    check_keys = list(admission["check_keys"])
    sorted_items = sorted(candidates, key=lambda item: int(item["order"]))
    lines = [
        "# 网络安全供应链准入候选表",
        "",
        f"快照：`{admission['snapshot_date']}`。本表由 `admission-candidates.json` 与 0001 研究目录联合生成，禁止手工修改。",
        "",
        "`准入候选` 不等于已安装、已纳入或已启用。当前所有候选默认禁用；版本、摘要和门禁未闭合前不得进入执行面。",
        "",
        "| 波次 | 候
```

### Core Architecture Module: `research/vibe-cybersecurity-cn/governance/tasks/0004-web3-vertical-proof/validate_web3_candidates.py`
```
#!/usr/bin/env python3
"""校验 Web3/EVM 供应链候选目录并重建可读表。
运行：python3 governance/tasks/0004-web3-vertical-proof/validate_web3_candidates.py
依赖：Python 3.10+ 标准库，以及同目录 web3-supply-chain-candidates.json。
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "web3-supply-chain-candidates.json"
TABLE_PATH = ROOT / "WEB3_CANDIDATE_TABLE.md"

VALID_CATEGORIES = {
    "static-analysis",
    "fuzzing-property",
    "formal-verification",
    "toolchain-stdlib",
    "benchmarks-labs",
    "vulnerability-intel",
    "intelligence-standards",
}
VALID_DISPOSITIONS = {"mvp", "pilot", "reference", "hold"}
VALID_EFFECTS = {"none", "data-only", "passive", "active-low", "active-medium", "active-high"}
SCORE_KEYS = ("fit", "evidence", "safety", "operability", "maturity")


def fail(message: str) -> None:
    raise ValueError(message)


def valid_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def validate(catalog: dict[str, object]) -> list[dict[str, object]]:
    if catalog.get("schema_version") != "1.0.0":
        fail("schema_version 必须为 1.0.0")
    if not isinstance(catalog.get("snapshot_date"), str):
        fail("缺少 snapshot_date")
    if catalog.get("ecosystem") != "evm-solidity":
        fail("ecosystem 必须为 evm-solidity")

    candidates = catalog.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        fail("candidates 必须是非空数组")

    seen: set[str] = set()
    for index, candidate in enumerate(candidates):
        prefix = f"candidates[{index}]"
        if not isinstance(candidate, dict):
            fail(f"{prefix} 必须是对象")

        candidate_id = candidate.get("id")
        if not isinstance(candidate_id, str) or not candidate_id:
            fail(f"{prefix}.id 缺失")
        if candidate_id in seen:
            fail(f"重复 id: {candidate_id}")
        seen.add(candidate_id)

        if candidate.get("category") not in VALID_CATEGORIES:
            fail(f"{candidate_id}: category 非法")
        if candidate.get("disposition") not in VALID_DISPOSITIONS:
            fail(f"{candidate_id}: disposition 非法")
        if candidate.get("network_effect") not in VALID_EFFECTS:
            fail(f"{candidate_id}: network_effect 非法")
        if not valid_url(candidate.get("upstream_url")):
            fail(f"{candidate_id}: upstream_url 必须是 HTTPS")

        source_urls = candidate.get("fact_sources")
        if not isinstance(source_urls, list) or not source_urls:
            fail(f"{candidate_id}: 至少需要一个 fact_sources")
        if not all(valid_url(url) for url in source_urls):
            fail(f"{candidate_id}: fact_sources 必须全部是 HTTPS")

        for field in ("name", "license", "role", "rationale", "evidence_ceiling", "isolation"):
            if not isinstance(candidate.get(field), str) or not candidate[field].strip():
                fail(f"{candidate_id}: {field} 不能为空")

        for field in ("interfaces", "machine_outputs", "supply_chain_controls", "blockers"):
            if not isinstance(candidate.get(field), list):
                fail(f"{candidate_id}: {field} 必须是数组")

        scores = candidate.get("scores")
        if not isinstance(scores, dict) or set(scores) != set(SCORE_KEYS):
            fail(f"{candidate_id}: scores 字段不完整")
        for score_name, value in scores.items():
            if not isinstance(value, int) or not 0 <= value <= 5:
                fail(f"{candidate_id}: scores.{score_name} 必须为 0..5 整数")

        if candidate["disposition"] == "mvp" and candidate["network_effect"] == "active-high":
            fail(f"{candidate_id}: active-high 不得直接进入 mvp")
        if candidate["disposition"] in {"mvp", "pilot"} and not candidate["machine_outputs"]:
            fail(f"{candidate_id}: mvp/pilot 必须有机器输出")
        if candidate["network_effect"].startswith("active") and candidate["isolation"] == "none":
            fail(f"{candidate_id}: 主动工具必须声明隔离")

    return candidates


def total_score(candidate: dict[str, object]) -> int:
    scores = candidate["scores"]
    assert isinstance(scores, dict)
    return sum(int(scores[key]) for key in SCORE_KEYS)


def render(catalog: dict[str, object], candidates: list[dict[str, object]]) -> str:
    sorted_candidates = sorted(
        candidates,
        key=lambda item: (
            {"mvp": 0, "pilot": 1, "reference": 2, "hold": 3}[str(item["disposition"])],
            -total_score(item),
            str(item["name"]).lower(),
        ),
    )
    lines = [
        "# Web3/EVM 供应链候选表",
        "",
        f"检索截面：`{catalog['snapshot_date']}`。本表由 `web3-supply-chain-candidates.json` 生成，请勿手工编辑。",
        "",
        "评分是本项目的选型判断，不是上游官方声明，也不代表已完成本地能力验证。",
        "",
        "| 状态 | 候选 | 类别 | 角色 | 接口 / 输出 | 网络副作用 | 许可 | 分数 | 主要门禁 |",
        "|---|---|---|---|---|---|---|---:|---|",
    ]
    for candidate in sorted_candidates:
        interfaces = ", ".join(str(value) for value in candidate["interfaces"]) or "-"
        outputs = ", ".join(str(value) for value in candidate["machine_outputs"]) or "-"
        blockers = "；".join(str(value) for value in candidate["blockers"]) or "无"
        lines.append(
            "| {disposition} | [{name}]({url}) | {category} | {role} | {interfaces} / {outputs} | "
            "{effect} | {license} | {score}/25 | {blockers} |".format(
                disposition=candidate["disposition"],
                name=str(candidate["name"]).replace("|", "\\|"),
                url=candidate["upstream_url"],
                category=candidate["category"],
                role=str(candidate["role"]).replace("|", "\\|"),
                interfaces=interfaces.replace("|", "\\|"),
                outputs=outputs.replace("|", "\\|"),
                effect=candidate["network_effect"],
                license=str(candidate["license"]).replace("|", "\\|"),
                score=total_score(candidate),
                blockers=blockers.replace("|", "\\|"),
            )
        )

    disposition_counts = Counter(str(candidate["disposition"]) for candidate in candidates)
    category_counts = Counter(str(candidate["category"]) for candidate in candidates)
    lines.extend(
        [
            "",
            "## 汇总",
            "",
            f"- 总候选：{len(candidates)}",
            "- 状态：" + "，".join(f"{key}={disposition_counts[key]}" for key in ("mvp", "pilot", "reference", "hold")),
            "- 类别：" + "，".join(f"{key}={category_counts[key]}" for key in sorted(category_counts)),
            "",
            "## 状态语义",
            "",
            "- `mvp`：允许进入本地隔离纵向样例；仍需固定版本和真实复跑。",
            "- `pilot`：价值明确，但部署、许可、动作风险或运维成本需要先校准。",
            "- `reference`：仅用于架构、方法、数据或评测研究，不进入默认执行工具面。",
            "- `hold`：当前阻塞未闭合，不进入实施计划。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    try:
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        if not isinstance(catalog, dict):
            fail("catalog 顶层必须是对象")
        candidates = validate(catalog)
        rendered = render(catalog, candidates)
        TABLE_PATH.write_text(rendered, encoding="utf-8")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"BLOCK: {exc}", file=sys.stderr)
        return 1

    print(f"PASS: {len(candidates)} candidates validated; rebuilt {TABLE_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `research/vibe-cybersecurity-cn/governance/tasks/0005-admit-web3-toolchain/validate_web3_admission.py`
```
#!/usr/bin/env python3
"""校验 Web3 工具链准入目录并重建可读表。
运行：python3 governance/tasks/0005-admit-web3-toolchain/validate_web3_admission.py
依赖：Python 3.10+ 标准库、同目录准入目录和 0004 Web3 研究目录。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ADMISSION_PATH = ROOT / "web3-admission-candidates.json"
TABLE_PATH = ROOT / "ADMISSION_TABLE.md"
SOURCE_CATALOG = (
    ROOT.parent / "0004-web3-vertical-proof" / "web3-supply-chain-candidates.json"
).resolve()

EXPECTED_SOURCE_CATALOG = "../0004-web3-vertical-proof/web3-supply-chain-candidates.json"
CHECK_KEYS = {
    "research_source",
    "license_review",
    "immutable_pin",
    "integrity_verification",
    "security_review",
    "interface_contract",
    "isolation_policy",
    "behavior_test",
    "rollback_test",
}
ALLOWED_STATES = {"admission-candidate", "pinned", "verified", "admitted", "suspended", "retired"}
VALID_CLASSES = {"executable", "library", "schema", "data", "rules", "container"}


def fail(message: str) -> None:
    raise ValueError(message)


def main() -> int:
    try:
        admission = json.loads(ADMISSION_PATH.read_text(encoding="utf-8"))
        source = json.loads(SOURCE_CATALOG.read_text(encoding="utf-8"))
        if admission.get("schema_version") != "1.0.0":
            fail("schema_version 必须为 1.0.0")
        if admission.get("source_catalog") != EXPECTED_SOURCE_CATALOG:
            fail("source_catalog 必须指向固定的 0004 Web3 研究目录")

        source_by_id = {item["id"]: item for item in source["candidates"]}
        seen: set[str] = set()
        admitted = 0

        for index, item in enumerate(admission["candidates"]):
            prefix = f"candidates[{index}]"
            source_id = item.get("source_id")
            if not isinstance(source_id, str) or source_id not in source_by_id:
                fail(f"{prefix}.source_id 不在 0004 研究目录")
            if source_id in seen:
                fail(f"重复 source_id: {source_id}")
            seen.add(source_id)
            source_item = source_by_id[source_id]
            if source_item.get("disposition") not in {"mvp", "pilot"}:
                fail(f"{source_id}: 只有 mvp/pilot 研究候选可进入 Web3 准入")
            if not isinstance(item.get("order"), int) or item["order"] < 0:
                fail(f"{source_id}: order 必须是唯一非负整数")
            if item.get("artifact_class") not in VALID_CLASSES:
                fail(f"{source_id}: artifact_class 非法")
            if item.get("admission_state") not in ALLOWED_STATES:
                fail(f"{source_id}: admission_state 非法")

            checks = item.get("checks")
            if not isinstance(checks, dict) or set(checks) != CHECK_KEYS:
                fail(f"{source_id}: checks 必须恰好覆盖 9 项门禁")
            for key, value in checks.items():
                if value not in {"pass", "pending", "fail", "n-a"}:
                    fail(f"{source_id}: checks.{key} 非法")

            if item["admission_state"] == "admitted":
                admitted += 1
                if item.get("default_enabled") is not True:
                    fail(f"{source_id}: admitted 必须 default_enabled=true")
                for key in CHECK_KEYS:
                    if checks[key] != "pass":
                        fail(f"{source_id}: admitted 但门禁 {key} 未 pass")
                pin = item.get("pin") or {}
                if not pin.get("ref") or pin.get("status") != "pinned":
                    fail(f"{source_id}: admitted 必须已 pinned（含 ref）")
                if item.get("blocking_conditions"):
                    fail(f"{source_id}: admitted 但存在 blocking_conditions")

        lines = [
            "# Web3 工具链准入表",
            "",
            f"快照：`{admission['snapshot_date']}`。本表由 `web3-admission-candidates.json` 生成，禁止手工修改。",
            "",
            "`admitted` 表示已完成 9 项门禁（含 research_source）并固定版本；运行权仍由 ScopeGrant 和运行时策略决定。",
            "",
            "| 状态 | 工具 | 角色 | 固定版本 | 门禁 | 行为证据 |",
            "|---|---|---|---|---|---|",
        ]
        for item in sorted(admission["candidates"], key=lambda x: x["order"]):
            name = source_by_id[item["source_id"]]["name"]
            checks = item["checks"]
            passed = sum(1 for v in checks.values() if v == "pass")
            behavior = checks.get("behavior_test")
            behavior_evidence = item["evidence_refs"].get("behavior_test", "-")
            lines.append(
                f"| {item['admission_state']} | {name} | {item['planned_role']} | "
                f"{item['pin']['ref']} | {passed}/9 | {behavior_evidence} |"
            )
        lines.extend(
            [
                "",
                "## 汇总",
                "",
                f"- 准入候选：{len(admission['candidates'])}",
                f"- 已正式纳入（admitted）：{admitted}",
                "",
                "## 门禁含义",
                "",
                "research_source / license_review / immutable_pin / integrity_verification / "
                "security_review / interface_contract / isolation_policy / behavior_test / rollback_test：",
                "9 项全部 pass 才允许 admitted。",
                "",
            ]
        )
        TABLE_PATH.write_text("\n".join(lines), encoding="utf-8")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"BLOCK: {exc}", file=sys.stderr)
        return 1

    print(f"PASS: {admitted} admitted / {len(admission['candidates'])} candidates; rebuilt {TABLE_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `research/vibe-cybersecurity-cn/governance/tasks/0006-audit-security-skills-sandbox/audit_skills.py`
```
#!/usr/bin/env python3
"""供应链安全审计：统计、恶意模式、嵌入指令、许可核验。
运行：python3 governance/tasks/0006-audit-security-skills-sandbox/audit_skills.py
依赖：Python 3.10+ 标准库；需要 .sandbox/skill-audit/ 下已克隆的仓库。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


SANDBOX = Path(__file__).resolve().parents[3] / ".sandbox" / "skill-audit"
OUT = Path(__file__).resolve().parent / "AUDIT_DATA.json"

# 高危/中危恶意模式（正则，大小写不敏感）
HIGH_PATTERNS = [
    (r"curl[^\n]*\|\s*(ba)?sh", "curl-pipe-shell"),
    (r"wget[^\n]*\|\s*(ba)?sh", "wget-pipe-shell"),
    (r"iwr[^\n]*\|\s*iex", "powershell-download-execute"),
    (r"Invoke-WebRequest[^\n]*Invoke-Expression", "pwsh-download-execute"),
    (r"base64\s*-d[^\n]*\|\s*(ba)?sh", "base64-pipe-shell"),
    (r"eval\s*\(\s*subprocess", "python-eval-subprocess"),
    (r"os\.system\s*\(\s*['\"]rm\s+-rf", "destructive-rm"),
    (r"shutil\.rmtree\s*\(\s*['\"]/", "destructive-rmtree"),
]
MEDIUM_PATTERNS = [
    (r"eval\s*\(", "eval"),
    (r"exec\s*\(", "exec"),
    (r"BEGIN\s*\{[^}]*system\(", "perl-system"),
    (r"\.ssh[\\/](id_rsa|id_ed25519|authorized_keys)", "ssh-key-reference"),
    (r"AKIA[0-9A-Z]{16}", "aws-key-lookalike"),
    (r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----", "private-key-block"),
    (r"sk-ant-[A-Za-z0-9_-]{20,}", "anthropic-key-lookalike"),
    (r"ghp_[A-Za-z0-9]{30,}", "github-pat-lookalike"),
    (r"sk-[A-Za-z0-9]{30,}", "openai-key-lookalike"),
]
# 嵌入指令模式：仅标记为数据，绝不执行
EMBEDDED_INSTRUCTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"disregard\s+(all\s+)?previous",
    r"you\s+must\s+(now\s+)?(ignore|forget|override)",
    r"system\s+prompt\s*:",
    r"<system>",
]
TEXT_SUFFIXES = {".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".py", ".sh", ".js", ".ts", ".sol", ".rst"}


def scan_repo(repo_dir: Path) -> dict:
    files = [p for p in repo_dir.rglob("*") if p.is_file()]
    total_bytes = sum(p.stat().st_size for p in files)
    by_ext: dict[str, int] = {}
    for p in files:
        ext = p.suffix.lower() or "(none)"
        by_ext[ext] = by_ext.get(ext, 0) + 1
    top_exts = sorted(by_ext.items(), key=lambda kv: -kv[1])[:8]

    high_hits: list[dict] = []
    medium_hits: list[dict] = []
    embedded_hits: list[dict] = []
    binary_files: list[str] = []
    suspicious_binaries: list[str] = []
    license_files: list[str] = []
    seen_text_bytes = 0

    for p in files:
        rel = str(p.relative_to(repo_dir))
        if p.name.lower() in {"license", "license.md", "license.txt", "copying", "copying.md"}:
            license_files.append(p.name)
        # 二进制检测
        try:
            head = p.read_bytes()[:4096]
        except OSError:
            continue
        is_binary = b"\x00" in head
        if is_binary:
            binary_files.append(rel)
            # ELF/Mach-O/PE 可执行
            if head.startswith(b"\x7fELF") or head[:2] in {b"MZ", b"\xcf\xfa\xed\xfe"}:
                suspicious_binaries.append(rel)
            continue
        if p.suffix.lower() not in TEXT_SUFFIXES and p.name not in {"LICENSE", "LICENSE.md", "README.md", "SKILL.md"}:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        seen_text_bytes += len(text)
        for pattern, label in HIGH_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                high_hits.append({"file": rel, "pattern": label})
        for pattern, label in MEDIUM_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                medium_hits.append({"file": rel, "pattern": label})
        for pattern in EMBEDDED_INSTRUCTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                embedded_hits.append({"file": rel, "pattern": pattern})

    # 去重
    high_hits = {f"{h['file']}:{h['pattern']}": h for h in high_hits}.values()
    medium_hits = {f"{h['file']}:{h['pattern']}": h for h in medium_hits}.values()
    embedded_hits = {f"{h['file']}:{h['pattern']}": h for h in embedded_hits}.values()

    # 顶层结构抽样
    top_level = sorted(p.name for p in repo_dir.iterdir())

    verdict = "pass"
    if high_hits:
        verdict = "high-risk"
    elif suspicious_binaries or any(h["pattern"].startswith("ssh-key") or "key-lookalike" in h["pattern"] or "private-key" in h["pattern"] for h in medium_hits):
        verdict = "review"

    return {
        "files": len(files),
        "total_bytes": total_bytes,
        "top_exts": dict(top_exts),
        "high_hits": list(high_hits)[:20],
        "medium_hits": list(medium_hits)[:30],
        "embedded_hits": list(embedded_hits)[:20],
        "binary_files": len(binary_files),
        "suspicious_binaries": suspicious_binaries[:10],
        "licenses": sorted(set(license_files)),
        "top_level": top_level[:15],
        "verdict": verdict,
    }


def main() -> int:
    if not SANDBOX.is_dir():
        print(f"BLOCK: 沙盒不存在 {SANDBOX}", file=sys.stderr)
        return 1
    results: dict[str, dict] = {}
    for repo_dir in sorted(SANDBOX.iterdir()):
        if not repo_dir.is_dir():
            continue
        results[repo_dir.name] = scan_repo(repo_dir)
    payload = {
        "schema_version": "1.0.0",
        "snapshot_date": "2026-08-14",
        "sandbox": str(SANDBOX),
        "repos": results,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"PASS: {len(results)} repos audited -> {OUT.name}")
    for name, r in results.items():
        print(f"  {name}: files={r['files']} bytes={r['total_bytes']} high={len(r['high_hits'])} "
              f"medium={len(r['medium_hits'])} embedded={len(r['embedded_hits'])} bins={r['binary_files']} "
              f"verdict={r['verdict']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `research/vibe-cybersecurity-cn/governance/tools/governance_context_bundle.py`
```
#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from pathlib import Path


GOV_ROOT = Path("governance")

DEFAULT_DOCS = [
    "INDEX.md",
    "context/AGENT-ENTRY.md",
    "context/PROJECT_OPERATING_MODEL.md",
    "context/PROJECT-TOPOLOGY.md",
    "context/CONTEXT-MAP.md",
    "context/CONTEXT-ROUTER.md",
]

DOCUMENT_DRIVEN_DOCS = [
    "context/PROJECT_OPERATING_MODEL.md",
    "processes/DOCUMENT_DRIVEN_DEVELOPMENT.md",
    "context/TOOLCHAIN_MODEL.md",
    "context/project_operating_model_contract.v1.yaml",
]

ROUTES = {
    "feature": {
        "label": "新功能",
        "required": [
            "standards/工程质量标准.md",
            "standards/非功能性需求标准.md",
            "processes/QA计划标准.md",
            "processes/代理协作协议.md",
        ],
        "optional": [
            "standards/优质代码定义.md",
            "standards/工程变更安全标准.md",
            "standards/术语表.md",
            "processes/工程变更安全审查流程.md",
            "decisions/adr/INDEX.md",
        ],
        "outputs": ["QA 计划或验证证据", "变更摘要", "风险等级", "副作用/兼容性/失败恢复说明", "回滚路径"],
    },
    "bugfix": {
        "label": "Bug 修复",
        "required": [
            "standards/劣质代码定义.md",
            "processes/本地工具与验证入口.md",
        ],
        "optional": [
            "evidence/postmortems/INDEX.md",
            "evidence/lessons/INDEX.md",
        ],
        "outputs": ["复现步骤", "根因结论", "回归测试或验证证据"],
    },
    "performance": {
        "label": "性能优化",
        "required": [
            "standards/非功能性需求标准.md",
            "architecture-gates/门禁与护栏.md",
        ],
        "optional": [
            "standards/性能效率优化标准.md",
            "evidence/postmortems/INDEX.md",
            "evidence/lessons/INDEX.md",
        ],
        "outputs": ["复杂度结论", "benchmark/profile 或指标证据", "性能收益与维护成本权衡"],
    },
    "architecture": {
        "label": "架构变更",
        "required": [
            "standards/工程质量标准.md",
            "standards/非功能性需求标准.md",
            "standards/架构设计原则.md",
            "decisions/adr/INDEX.md",
        ],
        "optional": [
            "evidence/tech-debt/INDEX.md",
            "processes/RPI研究计划实施流程.md",
        ],
        "outputs": ["ADR 或 ADR 更新", "边界与依赖说明", "迁移和回滚路径"],
    },
    "review": {
        "label": "代码审查",
        "required": [
            "architecture-gates/门禁与护栏.md",
        ],
        "optional": [
            "context/module-contexts/skills-auto-review/CONTEXT.md",
            "evidence/lessons/INDEX.md",
            "agent-governance/agent-feedback/INDEX.md",
        ],
        "outputs": ["PASS/WARN/BLOCK finding", "证据", "最小修复建议"],
    },
    "postmortem": {
        "label": "复盘",
        "required": [
            "architecture-gates/门禁与护栏.md",
            "evidence/postmortems/INDEX.md",
        ],
        "optional": [
            "processes/文档治理规则.md",
            "evidence/lessons/INDEX.md",
            "agent-governance/agent-feedback/INDEX.md",
        ],
        "outputs": ["根因", "防复发动作", "lesson/gate 转化判断"],
    },
    "governance": {
        "label": "治理包维护",
        "required": [
            "architecture-gates/门禁与护栏.md",
            "agent-governance/agent-feedback/INDEX.md",
        ],
        "optional": [
            "processes/文档治理规则.md",
            "evidence/lessons/INDEX.md",
            "decisions/adr/INDEX.md",
        ],
        "outputs": ["索引重建", "strict validate", "health report"],
    },
    "docs": {
        "label": "文档治理",
        "required": [
            "context/PROJECT_OPERATING_MODEL.md",
            "processes/DOCUMENT_DRIVEN_DEVELOPMENT.md",
            "context/TOOLCHAIN_MODEL.md",
            "context/CONTEXT-ROUTER.md",
        ],
        "optional": [
            "decisions/adr/INDEX.md",
            "context/module-contexts",
            "tasks/README.md",
            "tasks/lessons.md",
            "processes/文档治理规则.md",
        ],
        "outputs": ["文档同步证据", "受影响真相源清单", "无需更新的明确豁免理由", "strict validate 或缺口清单"],
    },
    "baseline": {
        "label": "基线治理",
        "required": [
            "control-plane/README.md",
            "evidence/baselines/INDEX.md",
            "evidence/verification/INDEX.md",
            "evidence/rollback/INDEX.md",
            "architecture-gates/GATE-INDEX.md",
        ],
        "optional": [
            "evidence/releases/INDEX.md",
            "evidence/compatibility/INDEX.md",
            "evidence/adoption/INDEX.md",
            "evidence/support/INDEX.md",
            "evidence/exceptions/INDEX.md",
        ],
        "outputs": ["基线证据包", "验证环境锁", "回滚验证", "例外状态", "晋级或阻断结论"],
    },
    "control": {
        "label": "控制项治理",
        "required": [
            "control-plane/README.md",
            "control-plane/controls/INDEX.md",
            "architecture-gates/GATE-INDEX.md",
        ],
        "optional": [
            "evidence/audit-exports/INDEX.md",
            "evidence/exceptions/INDEX.md",
            "risk-register/INDEX.md",
        ],
        "outputs": ["控制项覆盖", "检测方式", "证据路径", "planned/guarded/implemented 状态"],
    },
    "audit": {
        "label": "审计导出",
        "required": [
            "evidence/audit-exports/INDEX.md",
            "control-plane/README.md",
            "evidence/conformance/INDEX.md",
        ],
        "optional": [
            "evidence/verification/INDEX.md",
            "risk-register/INDEX.md",
            "evidence/exceptions/INDEX.md",
        ],
        "outputs": ["审计导出清单", "完整性证据", "provenance 或签名状态", "缺口清单"],
    },
    "risk": {
        "label": "风险治理",
        "required": [
            "risk-register/INDEX.md",
            "architecture-gates/GATE-INDEX.md",
            "evidence/exceptions/INDEX.md",
        ],
        "optional": [
            "decisions/adr/INDEX.md",
            "evidence/postmortems/INDEX.md",
            "control-plane/controls/INDEX.md",
        ],
        "outputs": ["风险记录", "缓解措施", "残余风险", "复审周期", "关联控制项"],
    },
}


ALIASES = {
    "new-feature": "feature",
    "新功能": "feature",
    "bug": "bugfix",
    "fix": "bugfix",
    "修复": "bugfix",
    "perf": "performance",
    "性能": "performance",
    "arch": "architecture",
    "架构": "architecture",
    "审查": "review",
    "复盘": "postmortem",
    "治理": "governance",
    "doc": "docs",
    "docs": "docs",
    "documentation": "docs",
    "文档": "docs",
    "文档治理": "docs",
    "baseline": "baseline",
    "基线": "baseline",
    "control": "control",
    "控制项": "control",
    "audit": "audit",
    "审计": "audit",
    "risk": "risk",
    "风险": "risk",
}


def slug_from_code_path(code_path: str) -> str:
    value = code_path.strip().strip("/").replace("\\", "/")
    chars = []
    for char in value:
        if char.isalnum() or "\u4e00" <= char <= "\u9fff":
            chars.append(char)
        else:
            chars.append("-")
    slug = "".join(chars).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "module"


def resolve_task_type(value: str) -> str:
    key = value.strip().lower()
    key = ALIASES.get(key, key)
    if key not in ROUTES:
        allowed = ", ".join(sorted(ROUTES))
        raise SystemExit(f"Unknown task type: {value}. Allowed: {allowed}")
    return key


def doc_entry(root: Path, rel: str, required: bool) -> dict[str, object]:
    path = root / rel
    return {
        "path": rel,
        "required": required,
        "exists": path.exists(),
    }


def document_driven_enabled(root: Path) -> bool:
    return any((root / rel).exists() for rel in DOCUMENT_DRIVEN_DOCS)


def unique_doc_entries(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    merged: dict[str, dict[str, object]] = {}
    order: list[str] = []
    for entry in entries:
        path = str(entry["path"])
        if path not in merged:
            merged[path] = dict(entry)
            order.append(path)
            continue
        merged[path]["required"] = bool(merged[path]["required"] or entry["required"])
        merged[path]["exists"] = bool(merged[path]["exists"] or entry["exists"])
    re
```

### Core Architecture Module: `research/vibe-cybersecurity-cn/governance/tools/governance_health_report.py`
```
#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path

import sys

sys.dont_write_bytecode = True

from validate_governance_package import GOV_ROOT, parse_frontmatter, validate

DOCUMENT_DRIVEN_REQUIRED = [
    "context/PROJECT_OPERATING_MODEL.md",
    "processes/DOCUMENT_DRIVEN_DEVELOPMENT.md",
    "context/TOOLCHAIN_MODEL.md",
    "context/project_operating_model_contract.v1.yaml",
]


RECORD_DIRS = {
    "adr": ("ADR", Path("decisions/adr")),
    "review": ("REVIEW", Path("evidence/reviews")),
    "postmortem": ("POSTMORTEM", Path("evidence/postmortems")),
    "lesson": ("LESSON", Path("evidence/lessons")),
    "workorder": ("WO", Path("evidence/workorders")),
    "debt": ("DEBT", Path("evidence/tech-debt")),
    "gate": ("GATE", Path("architecture-gates/rules")),
    "qa": ("QA", Path("evidence/qa-plans")),
    "agent-feedback": ("AF", Path("agent-governance/agent-feedback")),
    "baseline": ("BASELINE", Path("evidence/baselines")),
    "control": ("CONTROL", Path("control-plane/controls")),
    "exception": ("EXCEPTION", Path("evidence/exceptions")),
    "risk": ("RISK", Path("risk-register")),
    "conformance": ("CONFORMANCE", Path("evidence/conformance")),
    "audit-export": ("AUDIT", Path("evidence/audit-exports")),
    "release": ("RELEASE", Path("evidence/releases")),
}


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def review_cycle_days(value: str | None) -> int:
    if not value:
        return 90
    match = re.fullmatch(r"P(\d+)D", value.strip())
    return int(match.group(1)) if match else 90


def markdown_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(path for path in root.rglob("*.md") if path.is_file())


def record_counts(root: Path) -> dict[str, int]:
    counts: dict[str, int] = {}
    for kind, (prefix, rel_dir) in RECORD_DIRS.items():
        directory = root / rel_dir
        counts[kind] = len(list(directory.glob(f"{prefix}-*.md"))) if directory.exists() else 0
    return counts


def placeholder_docs(root: Path) -> list[str]:
    docs: list[str] = []
    for path in markdown_files(root):
        rel = path.relative_to(root)
        if rel.parts and rel.parts[0] == "templates":
            continue
        text = path.read_text(encoding="utf-8")
        if "待补充" in text:
            docs.append(str(rel))
    return docs


def stale_docs(root: Path, today: date) -> list[str]:
    stale: list[str] = []
    for path in markdown_files(root):
        rel = path.relative_to(root)
        if rel.parts and rel.parts[0] in {"templates", "archive"}:
            continue
        fm = parse_frontmatter(path.read_text(encoding="utf-8")) or {}
        last = parse_date(fm.get("last_reviewed"))
        if not last:
            continue
        cycle = review_cycle_days(fm.get("review_cycle"))
        if today - last > timedelta(days=cycle):
            stale.append(str(rel))
    return stale


def active_feedback(root: Path) -> list[str]:
    directory = root / "agent-governance" / "agent-feedback"
    if not directory.exists():
        return []
    open_items: list[str] = []
    for path in sorted(directory.glob("AF-*.md")):
        text = path.read_text(encoding="utf-8")
        fm = parse_frontmatter(text) or {}
        status = fm.get("status", "").strip().lower()
        if status not in {"converted", "rejected", "archived", "deprecated"}:
            open_items.append(path.name)
    return open_items


def gate_quality(root: Path) -> dict[str, int]:
    directory = root / "architecture-gates" / "rules"
    total = 0
    auto_ready = 0
    if not directory.exists():
        return {"total": 0, "auto_ready": 0}
    for path in sorted(directory.glob("GATE-*.md")):
        total += 1
        fm = parse_frontmatter(path.read_text(encoding="utf-8")) or {}
        detectability = fm.get("detectability", "").lower()
        if any(token in detectability for token in ("test", "ci", "lint", "script", "auto")):
            auto_ready += 1
    return {"total": total, "auto_ready": auto_ready}


def document_driven_status(root: Path) -> dict[str, object]:
    existing = [rel for rel in DOCUMENT_DRIVEN_REQUIRED if (root / rel).exists()]
    missing = [rel for rel in DOCUMENT_DRIVEN_REQUIRED if rel not in existing]
    return {
        "enabled": bool(existing),
        "complete": bool(existing) and not missing,
        "existing": existing,
        "missing": missing,
    }


def build_report(project_root: Path, strict: bool) -> dict[str, object]:
    root = project_root / GOV_ROOT
    validation = validate(project_root, strict)
    counts = record_counts(root)
    placeholders = placeholder_docs(root)
    stale = stale_docs(root, date.today())
    feedback = active_feedback(root)
    gate_stats = gate_quality(root)
    doc_driven = document_driven_status(root)
    markdown_count = len(markdown_files(root))

    decision = validation["decision"]
    if decision == "PASS" and (placeholders or stale or feedback):
        decision = "WARN"

    next_actions: list[str] = []
    if validation["decision"] == "BLOCK":
        next_actions.append("先修复 validate_governance_package.py 报出的 BLOCK。")
    if placeholders:
        next_actions.append("优先补齐含有“待补充”的当前标准、流程、gate 和模块上下文。")
    if feedback:
        next_actions.append("处理 open agent feedback：转成 lesson/gate，或明确 rejected/archived。")
    if stale:
        next_actions.append("复审过期文档并更新 last_reviewed。")
    if gate_stats["total"] and gate_stats["auto_ready"] == 0:
        next_actions.append("选择至少一个高价值 gate 转成 script/test/CI/agent 可检测护栏。")
    if doc_driven["enabled"] and not doc_driven["complete"]:
        next_actions.append("补齐 document-driven operating model：PROJECT_OPERATING_MODEL、DOCUMENT_DRIVEN_DEVELOPMENT、TOOLCHAIN_MODEL 和机器契约必须成套存在。")
    if not next_actions and decision == "PASS":
        next_actions.append("治理包健康，继续按事件增量维护。")

    return {
        "decision": decision,
        "root": str(root),
        "markdown_count": markdown_count,
        "record_counts": counts,
        "gate_quality": gate_stats,
        "document_driven": doc_driven,
        "placeholder_count": len(placeholders),
        "placeholder_examples": placeholders[:20],
        "stale_count": len(stale),
        "stale_examples": stale[:20],
        "open_agent_feedback_count": len(feedback),
        "open_agent_feedback_examples": feedback[:20],
        "validation": validation,
        "next_actions": next_actions,
    }


def render_markdown(report: dict[str, object]) -> str:
    counts = report["record_counts"]
    gates = report["gate_quality"]
    doc_driven = report["document_driven"]
    lines = [
        "# Governance Health Report",
        "",
        f"- `decision`: {report['decision']}",
        f"- `root`: {report['root']}",
        f"- `markdown_count`: {report['markdown_count']}",
        f"- `placeholder_count`: {report['placeholder_count']}",
        f"- `stale_count`: {report['stale_count']}",
        f"- `open_agent_feedback_count`: {report['open_agent_feedback_count']}",
        f"- `gate_auto_ready`: {gates['auto_ready']} / {gates['total']}",
        f"- `document_driven_operating_model`: {'enabled' if doc_driven['enabled'] else 'disabled'} / {'complete' if doc_driven['complete'] else 'incomplete'}",
        "",
        "## Record Counts",
        "",
    ]
    for kind, count in counts.items():
        lines.append(f"- `{kind}`: {count}")
    lines.extend(["", "## Placeholder Examples", ""])
    placeholders = report["placeholder_examples"]
    if placeholders:
        lines.extend(f"- `{item}`" for item in placeholders)
    else:
        lines.append("- none")
    lines.extend(["", "## Stale Examples", ""])
    stale = report["stale_examples"]
    if stale:
        lines.extend(f
```

### Core Architecture Module: `research/vibe-cybersecurity-cn/governance/tools/init_governance_package.py`
```
#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import shutil
from datetime import date
from pathlib import Path


GOV_ROOT = Path("governance")
TOOL_NAMES = [
    "init_governance_package.py",
    "new_governance_record.py",
    "validate_governance_package.py",
    "rebuild_governance_index.py",
    "new_module_context.py",
    "governance_health_report.py",
    "governance_context_bundle.py",
    "scan_principle_gates.py",
]


def fm(doc_id: str, doc_type: str, status: str = "current") -> str:
    today = date.today().isoformat()
    return (
        "---\n"
        f"id: {doc_id}\n"
        f"type: {doc_type}\n"
        f"status: {status}\n"
        "owner: engineering\n"
        f"created: {today}\n"
        f"last_reviewed: {today}\n"
        "review_cycle: P90D\n"
        "---\n\n"
    )


def doc(doc_id: str, doc_type: str, title: str, body: str, status: str = "current") -> str:
    return fm(doc_id, doc_type, status) + f"# {title}\n\n{body.strip()}\n"


def gate_doc(
    doc_id: str,
    title: str,
    body: str,
    severity: str = "BLOCK",
    detectability: str = "agent+manual",
    source: str = "STD-PONYTAIL-LADDER",
) -> str:
    today = date.today().isoformat()
    return (
        "---\n"
        f"id: {doc_id}\n"
        "type: gate\n"
        "status: active\n"
        "owner: engineering\n"
        f"created: {today}\n"
        f"last_reviewed: {today}\n"
        "review_cycle: P90D\n"
        f"severity: {severity}\n"
        f"detectability: {detectability}\n"
        f"source: {source}\n"
        "---\n\n"
        f"# {title}\n\n{body.strip()}\n"
    )


def index_doc(title: str, rows: list[tuple[str, str]]) -> str:
    safe_id = "IDX-" + re.sub(r"[^A-Z0-9]+", "-", title.upper()).strip("-")
    lines = [
        f"# {title}",
        "",
        "| 名称 | 说明 |",
        "|---|---|",
    ]
    for name, desc in rows:
        lines.append(f"| `{name}` | {desc} |")
    return fm(safe_id, "index") + "\n".join(lines) + "\n"


def record_index_doc(title: str) -> str:
    safe_id = "IDX-" + re.sub(r"[^A-Z0-9]+", "-", title.upper()).strip("-")
    lines = [
        f"# {title}",
        "",
        "| ID | 标题 | 状态 | 文件 |",
        "|---|---|---|---|",
    ]
    return fm(safe_id, "index") + "\n".join(lines) + "\n"


def default_gate_rules_index_doc() -> str:
    lines = [
        "# GATE Index",
        "",
        "| ID | 标题 | 状态 | 文件 |",
        "|---|---|---|---|",
        "| `GATE-0000` | 新增所有权面必须证明存在必要性 | active | `GATE-0000-PONYTAIL-OWNERSHIP-SURFACE.md` |",
        "| `GATE-0001` | 非平凡方案不得主动降级成短期补丁 | active | `GATE-0001-FUTURE-OPTIMAL-NO-DOWNGRADE.md` |",
    ]
    return fm("IDX-GATE-INDEX", "index") + "\n".join(lines) + "\n"


def gate_index_doc() -> str:
    return doc(
        "GATE-INDEX",
        "gate-index",
        "Gate Index",
        """
| Gate ID | 严重级别 | 标题 | 检测方式 | 来源 | 状态 | 文件 |
|---|---|---|---|---|---|---|
| `GATE-0000` | BLOCK | 新增所有权面必须证明存在必要性 | agent+script+manual | STD-PONYTAIL-LADDER | active | `rules/GATE-0000-PONYTAIL-OWNERSHIP-SURFACE.md` |
| `GATE-0001` | BLOCK | 非平凡方案不得主动降级成短期补丁 | agent+script+manual | STD-FUTURE-OPTIMAL | active | `rules/GATE-0001-FUTURE-OPTIMAL-NO-DOWNGRADE.md` |
        """,
    )


def project_operating_model_doc() -> str:
    return doc(
        "GOV-PROJECT-OPERATING-MODEL",
        "context",
        "Project Operating Model",
        """
本文件是项目级人类入口和代理入口的共享操作模型。它只记录项目当前应该如何被理解、修改、验证和交付；不替代代码、契约、ADR、任务包、README 或 AGENTS。

## 项目一句话定义

待补充：用一句话说明项目服务的对象、核心价值和运行边界。

## 业务模型

- 核心用户：
- 核心对象：
- 关键流程：
- 不属于本项目的范围：

## 技术模型

- 主要运行形态：
- 核心模块：
- 数据事实源：
- 外部依赖：
- 主要验证入口：

## 工具链模型

工具链边界以 `context/TOOLCHAIN_MODEL.md` 为准。这里仅记录最短摘要：

- 构建：
- 测试：
- 类型检查：
- 格式 / lint：
- 发布 / 回滚：

## 目录和真相源地图

| 事实类型 | 真相源 | 备注 |
|---|---|---|
| 项目操作模型 | `governance/context/PROJECT_OPERATING_MODEL.md` | 人类和代理的项目入口 |
| 上下文路由 | `governance/context/CONTEXT-ROUTER.md` | 任务类型到最小上下文包 |
| 工程流程 | `governance/processes/DOCUMENT_DRIVEN_DEVELOPMENT.md` | 文档先行和文档回填规则 |
| 工具链边界 | `governance/context/TOOLCHAIN_MODEL.md` | 成熟工具、项目脚本和禁用做法 |
| 机器契约 | `governance/context/project_operating_model_contract.v1.yaml` | 脚本和 agent 可读取的契约 |
| 架构决策 | `governance/decisions/adr/` | 不可逆或高影响决策 |
| 任务证据 | `governance/tasks/` | 执行计划、状态、验收、closeout |

## 变更入口

非平凡工程变更开始前必须判断：

- 是否需要先更新本操作模型。
- 是否需要更新文档驱动开发流程。
- 是否需要更新工具链模型。
- 是否需要新增或更新 ADR、Gate、module context、contracts、catalog、README 或 AGENTS。

## 验证入口

```bash
python3 governance/tools/governance_context_bundle.py --project-root . --task-type docs
python3 governance/tools/validate_governance_package.py --project-root . --strict
python3 governance/tools/governance_health_report.py --project-root . --strict
```

## 最近一次 review

- 日期：待补充
- 结论：待补充
- 后续动作：待补充
        """,
    )


def document_driven_development_doc() -> str:
    return doc(
        "PROC-DOCUMENT-DRIVEN-DEVELOPMENT",
        "process",
        "Document Driven Development",
        """
文档驱动开发不是多写文档，而是让项目的关键事实先有稳定真相源，再让代码、任务、审查和交付围绕这些真相源闭环。

## 适用范围

默认适用于：

- 新增功能、接口、数据模型、配置、依赖、任务流程或运行模式。
- 修改既有业务逻辑、模块边界、公共契约、工具链或发布方式。
- 产生长期影响的 bug 修复、复盘、审查反馈或架构决策。

## 执行顺序

1. 读取 `context/PROJECT_OPERATING_MODEL.md`。
2. 使用 `context/CONTEXT-ROUTER.md` 选择最小上下文。
3. 判断本次变更影响哪些真相源。
4. 若变更会改变项目理解、模块边界、流程、契约或工具链，先更新对应文档或在任务包中记录明确豁免理由。
5. 实现代码、运行验证、记录证据。
6. closeout 前执行文档同步检查，确认所有受影响真相源已更新或明确无需更新。

## 文档影响分类

| 影响类型 | 默认落点 | 说明 |
|---|---|---|
| 项目整体理解变化 | `context/PROJECT_OPERATING_MODEL.md` | 项目定位、边界、核心流程、事实源变化 |
| 执行流程变化 | `processes/DOCUMENT_DRIVEN_DEVELOPMENT.md` | 开发、验证、交付、回填流程变化 |
| 工具链变化 | `context/TOOLCHAIN_MODEL.md` | 构建、测试、发布、脚本、成熟工具边界变化 |
| 架构决策 | `decisions/adr/` | 有 trade-off、难反转、未来会惊讶的决策 |
| 质量护栏 | `architecture-gates/rules/` | 可复发、可检测、必须阻止的问题 |
| 任务执行证据 | `tasks/` | 计划、状态、验收、验证、closeout |
| 模块事实 | `context/module-contexts/` 或项目局部 README/AGENTS | 模块职责、边界、上下游、验证入口 |

## Closeout 必填判断

每个非平凡任务 closeout 必须回答：

- 本次是否改变项目操作模型。
- 本次是否改变工具链模型。
- 本次是否改变文档驱动开发流程。
- 本次是否改变模块上下文、ADR、Gate、contract、catalog、README 或 AGENTS。
- 若没有更新文档，原因是什么。

## 不接受的做法

- 代码已经改变系统事实，但文档仍描述旧事实。
- 只在聊天记录里说明变更，不落到项目可迁移资产。
- 把任务包临时结论当成长期真相源。
- 用泛泛的“无需更新文档”绕过 closeout 证据。
        """,
    )


def toolchain_model_doc() -> str:
    return doc(
        "GOV-TOOLCHAIN-MODEL",
        "context",
        "Toolchain Model",
        """
本文件记录项目工具链的当前真相，帮助人类和代理优先复用成熟能力、项目既有脚本和稳定验证入口。

## 成熟工具优先

- 优先使用语言标准工具、官方 CLI、包管理器、测试框架、lint/typecheck、数据库迁移工具和云平台能力。
- 自研脚本只用于连接、编排、适配和表达项目特有流程。
- 新增工具前必须证明：已有工具无法满足、引入后总拥有成本更低、验证和回滚路径明确。

## 项目命令

| 场景 | 命令 | 备注 |
|---|---|---|
| 安装依赖 | 待补充 |  |
| 测试 | 待补充 |  |
| 类型检查 | 待补充 |  |
| lint / format | 待补充 |  |
| 构建 | 待补充 |  |
| 本地运行 | 待补充 |  |
| 发布 | 待补充 |  |
| 回滚 | 待补充 |  |

## 禁止或谨慎使用

- 禁止绕过项目已有脚本直接调用内部实现细节，除非在调试任务中明确说明。
- 禁止新增无 owner、无验证、无回滚说明的脚本。
- 禁止把一次性命令伪装成长期工具链。

## 工具链变更流程

1. 先检查现有命令、脚本、CI 和文档。
2. 记录新增或替换工具的存在性理由。
3. 更新本文件和相关流程文档。
4. 运行最小验证。
5. 在任务 closeout 中记录验证证据和回滚方式。
        """,
    )


def project_operating_model_contract_doc() -> str:
    today = date.today().isoformat()
    return f"""version: 1
id: project_operating_model_contract.v1
status: current
owner: engineering
created: {today}
last_reviewed: {today}
required_documents:
  - path: governance/context/PROJECT_OPERATING_MODEL.md
    owner: auto-governance
    purpose: human_and_agent_project_entry
  - path: governance/processes/DOCUMENT_DRIVEN_DEVELOPMENT.md
    owner: auto-governance
    purpose: docs_first_change_workflow
  - path: governance/context/TOOLCHAIN_MODEL.md
    owner: auto-governance
    purpose: tool_boundary_and_validation_entry
  - path: governance/context/CONTEXT-ROUTER.md
    owner: auto-governance
    purpose: task_type_to_minimal_context
closeout_required_fields:
  - operating_model_update
  - toolchain_model_update
  - process_update
  - source_of_truth_updates
  - documentation_exemption_reason
validation:
  governance_validate: python3 governance/tools/validate_governance_package.py --project-root . --strict
  context_bundle_docs: python3 governance/tools/governance_context_bundle.py --project-root . --task-type doc
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15** (2026-05-12): **[Bug]: workflow熔断机制失效**
  *Symptoms*: 位置：在 /i18n/zh/workflow/auto-dev-loop/workflow_engine/runner.py 的 start_workflow 函数中，当 Step 5 判定验证失败并触发重试（回滚到 Step 2）时，代码使用了嵌套的 for 循环来执行重试步骤（第158行）。  问题：内层的 for retry_step 循环仅仅调用了 run_step，没有在 Step 4 重新读取 verify_status（验证结果），没有在 Step 5 重新判断是否需要再次回滚。如果重试的那一次依然失败，程序会直接退出内层循环并结束整个工作流，而无法触发第 2 次或第 3 次重试，导致重试机制失效。  代码片段： ```python # 如果需要回跳，递归处理（带熔断） if state.get("target_step") == "step2":     retry_count = state.get("retry_count", 0) + 1     # ... 省略熔断检查 ...     state["retry_count"] = retry_count          # === 问题代码 ===     # 这里只单纯执行了步骤，没有任何 if step == 'step4' 或 'step5' 的逻辑判断，并没有递归     for retry_step in STEP_FLOW[1:]:  # step2 onwards         run_step(retry_step, state)           break # 执行完一次重试后直接退出了 ```
  **Post-Mortem & Fix Analysis**:
  > 👋 你好，@JJL-8！感谢你第一次向 vibe-coding-cn 提交 Issue！ 我们会尽快查看。欢迎你加入我们的社区！
  > 感谢反馈。这个问题指向的是旧版目录  里的 workflow engine 实现。\n\n当前仓库已经完成结构重组，旧的  工作流代码已不再作为当前版本维护对象；现在的工作流入口已经收敛到 ，以文档化开发流程、质量门禁、版本控制和交付闭环为主。\n\n因此这个 issue 对应的是已移除的旧实现，不再适用于当前代码结构。我先关闭该 issue。后续如果要重新实现可执行 workflow engine，会按当前  的新口径重新设计。
  > 旧版 workflow engine 已移除，不再适用于当前仓库结构，关闭。

- **Issue #10** (2026-05-12): **[Bug]:**
  *Symptoms*: i18n/zh/documents/00-基础指南/胶水编程.md中 151行的📚 延伸阅读下的 胶水开发提示词 和 项目实战 两个超链接不对了
  **Post-Mortem & Fix Analysis**:
  > 👋 你好，@CrayonL！感谢你第一次向 vibe-coding-cn 提交 Issue！ 我们会尽快查看。欢迎你加入我们的社区！
  > 已修复完成，相关链接问题已处理。感谢反馈。

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

### Incident Patch 1: `130d3ccb` (2026-09-17)
**Commit Message**: fix: render proposition notation correctly

修复命题 0 在 GitHub 页面上的原始转义符号显示。

**File**: `README.md` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@
 
 ### 零、固定目标、分层反馈的可验证收敛系统
 
-> **Vibe Coding 可以理解为一种目标驱动、受约束、可验证的状态转移闭环；从控制结构看，它是一种固定目标、可变策略、分层反馈的系统：先将模糊需求经过澄清、结构化、一致性检查和人工确认，冻结为带版本的目标基线 \(G^*\)；再让 Agent 在目标基线和约束不被静默修改的前提下，反复执行“观察当前状态 \(S_t\) → 识别状态差距 \(\Delta_t\) → 选择策略与行动 → 获取验证证据 \(E_t\) → 接受、修正、回滚或切换策略”，使系统逐步进入目标的验收集合。若单次行动无效，则修正行动；若当前策略无效，则切换策略；若目标存在矛盾、不可行或无法判定，则暂停执行，重新审查目标或交由人决定。任何目标变更都必须通过显式版本、差异和授权进入新一轮闭环；每一层都必须具备独立验证、回滚、尝试上限和退出机制。**
+> **Vibe Coding 可以理解为一种目标驱动、受约束、可验证的状态转移闭环；从控制结构看，它是一种固定目标、可变策略、分层反馈的系统：先将模糊需求经过澄清、结构化、一致性检查和人工确认，冻结为带版本的目标基线 `G*`；再让 Agent 在目标基线和约束不被静默修改的前提下，反复执行“观察当前状态 `S_t` → 识别状态差距 `Δ_t` → 选择策略与行动 → 获取验证证据 `E_t` → 接受、修正、回滚或切换策略”，使系统逐步进入目标的验收集合。若单次行动无效，则修正行动；若当前策略无效，则切换策略；若目标存在矛盾、不可行或无法判定，则暂停执行，重新审查目标或交由人决定。任何目标变更都必须通过显式版本、差异和授权进入新一轮闭环；每一层都必须具备独立验证、回滚、尝试上限和退出机制。**
 
 ```text
 原始需求 R
```

---

### Incident Patch 2: `f9802320` (2026-09-12)
**Commit Message**: fix: links - exclude unstable social and vendor endpoints

**File**: `.lychee.toml` (modified, +5/-0)
```diff
@@ -47,4 +47,9 @@ exclude = [
   '^https://xn--9kqz23b19z\.com/.*',
   '^https://opencode\.ai/go\?ref=FF7EBR5TKW.*',
   '^https://www\.bybit\.com/.*',
+  # 外部站点风控/TLS/限流导致 runner 上不稳定，属于既有失败类。
+  '^https://x\.com/.*',
+  '^https://opencode\.ai/docs/%E3%80%82$',
+  '^https://windsurf\.com/.*',
+  '^https://www\.lesswrong\.com/.*',
 ]
```

---

### Incident Patch 3: `f2a89b46` (2026-09-12)
**Commit Message**: fix: links - exclude independent research projects

**File**: `.lychee.toml` (modified, +4/-0)
```diff
@@ -21,6 +21,10 @@ exclude_path = [
   '^docs/references/modern-enterprise-architecture-template\.md$',
   '^tools/external(/|$)',
   '^tools/chat-vault(/|$)',
+  # These research projects have independent link-checking contracts and are
+  # intentionally excluded from the root repository's first-party scan.
+  '^research/vibe-cybersecurity-cn(/|$)',
+  '^research/vibe-harness-cn(/|$)',
   '^tools/prompts-library(/|$)',
   '^skills/claude-official-skills(/|$)',
   '^skills/auto-tmux/assets/(oh-my-tmux|tmux-src)(/|$)',
```

---

### Incident Patch 4: `259ac32a` (2026-09-12)
**Commit Message**: feat: research - integrate reviewed security and harness projects

Deliver the reviewed cybersecurity and harness research projects as a single linear, signed change for protected develop.

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -6,9 +6,9 @@ name: CI
 on:
   workflow_dispatch:
   push:
-    branches: [ develop, master ]
+    branches: [ develop ]
   pull_request:
-    branches: [ develop, master ]
+    branches: [ develop ]
 
 jobs:
   markdown-lint:
```

**File**: `AGENTS.md` (modified, +6/-4)
```diff
@@ -165,6 +165,8 @@ git push origin develop
 ├── research/                    # 根级研究域：新技术、优秀 repo 与工程范式研究
 │   ├── README.md                # research 总索引
 │   ├── AGENTS.md                # research 目录规则
+│   ├── vibe-cybersecurity-cn/   # 纳入的授权网络安全 Agent 研究项目
+│   ├── vibe-harness-cn/         # 纳入的元 Harness 研究项目
 │   └── harness/                 # Harness Engineering 研究对象
 │
 ├── prompts/                     # 提示词库入口（指向云端表格）
@@ -236,7 +238,7 @@ git push origin develop
 - `.github/AGENTS.md` - GitHub 平台配置目录规则；根 `.github/` 不保留 `README.md`，避免 GitHub 首页误展示目录说明
 - `.github/CODEOWNERS` - 路径级 owner 评审基线，用于让关键目录变更自动请求维护者审查
 - `.github/lint_config.json` - markdownlint 规则，供 `make lint` 与 CI 共用
-- `.github/workflows/ci.yml` - GitHub Actions：develop/master 分支 markdown-lint + link-checker
+- `.github/workflows/ci.yml` - GitHub Actions：develop 分支 markdown-lint + link-checker
 - `scripts/check-local-links.py` - 仓库内 Markdown 相对链接与锚点检查脚本，供 `make check-links` 与 CI 使用
 - `scripts/check-markdown-details.py` - 仓库内 Markdown 折叠块结构检查脚本，供 `make check-details` 与 CI 使用
 - `scripts/check-doc-structure.py` - docs README 标准块顺序、目录入口和重复锚点检查脚本，供 `make check-doc-structure` 与 CI 使用
@@ -297,8 +299,8 @@ feat|fix|docs|chore|refactor|test: scope - summary
 - 测试与验证步骤
 
 ### CI 触发条件
-- `push` 到 `develop` 或 `master` 分支
-- `pull_request` 到 `develop` 或 `master` 分支
+- `push` 到 `develop` 分支
+- `pull_request` 到 `develop` 分支
 - 手动触发 `workflow_dispatch`
 
 ### CI 检查项
@@ -367,7 +369,7 @@ make test
 2. **Conversion Tool**: 使用 Python + pandas + openpyxl
 3. **Documentation Standard**: 用户文档使用中文；代码/文件名使用英文
 4. **Skills**: 每个技能有独立的 `SKILL.md`
-5. **Quality Gates**: `make test` 执行 Markdown lint、本地相对链接/锚点检查、折叠块结构检查、docs 结构检查、metadata 路径检查、AI 引用一致性检查与现代企业架构 starter kit 检查
+5. **Quality Gates**: `make test` 执行 Markdown lint、本地相对链接/锚点检查、折叠块结构检查、docs 结构检查、metadata 路径检查、AI 引用一致性检查与现代企业架构 starter kit 检查；纳入的 `research/vibe-cybersecurity-cn/` 与 `research/vibe-harness-cn/` 保留独立项目门禁，仓库级文档检查跳过其内部文件。
 
 ## Development Workflow
 
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ help:
 
 lint:
 	@echo "Linting markdown files..."
-	@$(MARKDOWNLINT) --config .github/lint_config.json --ignore .history --ignore tools/external --ignore 'research/**/raw/repository/**' '**/*.md'
+	@$(MARKDOWNLINT) --config .github/lint_config.json --ignore .history --ignore tools/external --ignore 'research/**/raw/repository/**' --ignore 'research/vibe-cybersecurity-cn/**' --ignore 'research/vibe-harness-cn/**' '**/*.md'
 
 check-links:
 	@echo "Checking local markdown links and anchors..."
```

**File**: `README.md` (modified, +24/-2)
```diff
@@ -570,10 +570,29 @@ AI 负责生成候选解，隔离上下文负责审查和优化候选解，事
 *   [**scripts 仓库控制面治理**](docs/references/modern-enterprise-architecture-template.md#reference-modern-enterprise-scripts-control-plane): 成熟企业项目的脚本分层、风险边界、登记、测试、审计和下线规则。
 *   [**scripts 目录说明**](scripts/README.md): 本仓库自动化入口、验证命令和脚本职责索引。
 *   [**研究域治理契约**](research/research-domain-contract.md): 研究域的结构、raw 原始事实层、成熟度、证据、沉淀和归档规则。
-*   [**研究价值与应用地图**](research/research-value-application-map.md): 17 个研究域的用户价值、核心启示、应用位置和下沉路线。
+*   [**研究项目第三方许可说明**](research/vibe-cybersecurity-cn/THIRD_PARTY_NOTICES.md): 纳入研究项目的来源、许可证和公开边界。
+*   [**研究价值与应用地图**](research/research-value-application-map.md): 35 个研究域的用户价值、核心启示、应用位置和下沉路线。
 *   [**研究迁移综合**](research/research-transfer-synthesis.md): 用对标拆解、改良迭代和杂交创新把研究转成可执行路线。
 *   [**Harness 工程解析**](research/harness/harness-engineering.md): Harness Engineering 的工程控制、评估器与反馈闭环解析。
+*   [**vibe-cybersecurity-cn 研究项目**](research/vibe-cybersecurity-cn/README.md): 授权边界内的 Agent 网络安全自动化研究与工程项目。
+*   [**vibe-harness-cn 研究项目**](research/vibe-harness-cn/README.md): 治理 Agent Harness 与问题求解算子库的元 Harness 项目。
 *   [**OpenAI Codex 研究域**](research/openai-codex/README.md): 官方 coding agent 工具源码研究对象。
+*   [**OpenAI Plugins 研究域**](research/openai-plugins/README.md): Codex 插件、marketplace 与 skill-only plugin 分发研究对象。
+*   [**OpenAI Skills 研究域**](research/openai-skills/README.md): 已 deprecated 的 Codex Skills Catalog 与插件迁移参照。
+*   [**OpenAI Agents SDK 研究域**](research/openai-agents-python/README.md): Agent、工具、护栏、handoff 与 tracing 运行时研究对象。
+*   [**OpenAI Agents JS 研究域**](research/openai-agents-js/README.md): 官方 TypeScript/JavaScript Agent 运行时研究对象。
+*   [**OpenAI Cookbook 研究域**](research/openai-cookbook/README.md): OpenAI API、Codex、Agent、评估与安全示例库研究对象。
+*   [**GitHub Spec Kit 研究域**](research/github-spec-kit/README.md): GitHub 官方规格驱动开发工具包研究对象。
+*   [**OpenSpec 研究域**](research/fission-ai-openspec/README.md): 面向 AI coding assistant 的规格驱动开发工具研究对象。
+*   [**OpenCode 研究域**](research/anomalyco-opencode/README.md): 模型无关的终端与编辑器 coding agent 研究对象。
+*   [**Gemini CLI 研究域**](research/google-gemini-gemini-cli/README.md): 终端 coding agent、MCP、扩展与安全评估研究对象。
+*   [**OpenHands 研究域**](research/openhands-openhands/README.md): Agent Canvas、工作区、后端与自动化控制中心研究对象。
+*   [**Superpowers 研究域**](research/obra-superpowers/README.md): 跨 coding agent 的技能框架与开发方法论研究对象。
+*   [**Addy Agent Skills 研究域**](research/addyosmani-agent-skills/README.md): 面向 coding agent 的生命周期技能与质量门禁研究对象。
+*   [**Goose 研究域**](research/aaif-goose-goose/README.md): 跨模型、跨平台的开源 AI Agent 研究对象。
+*   [**Continue 研究域**](research/continuedev-continue/README.md): 已停止主动维护的 IDE/CLI Agent 历史对标对象。
+*   [**mini-SWE-agent 研究域**](research/swe-agent-mini-swe-agent/README.md): 面向 issue 和命令行任务的极简软件工程 Agent 研究对象。
+*   [**ECC 研究域**](research/affaan-m-ecc/README.md): 多种 coding agent 的 Harness、技能与质量实践集合研究对象。
 *   [**Claude Code Best Practice 研究域**](research/shanraisshan-claude-code-best-practice/README.md): Agentic Engineering 方法论对标研究对象。
 *   [**Cline 研究域**](research/cline-cline/README.md): IDE/SDK/CLI 自主编码 Agent 研究对象。
 *   [**Aider 研究域**](research/aider-ai-aider/README.md): 终端 AI 结对编程工具研究对象。
@@ -648,13 +667,16 @@ pip install -r tools/prompts-library/scripts/requirements.txt
 | 提示词格式转换 | `cd tools/prompts-library && python3 main.py` | `tools/prompts-library/main.py` |
 | Skill 严格校验示例 | `skills/auto-skill/scripts/validate-skill.sh skills/auto-skill --strict` | `skills/auto-skill/scripts/validate-skill.sh` |
 
+仓库级文档门禁跳过两个纳入的独立工程研究项目：`research/vibe-cybersecurity-cn/` 和
+`research/vibe-harness-cn/`；请按各项目 README 运行其独立验证。
+
 ### 配置与 CI
 
 - 路径级 owner 评审基线：`.github/CODEOWNERS`
 - Markdown lint 配置：`.github/lint_config.json`
 - Markdown lint 版本：`Makefile` 中固定为 `markdownlint-cli@0.48.0`
 - 外部链接检查配置：`.lychee.toml`，统一管理外链检查的超时、重试、并发上限和排除项
-- CI 配置：`.github/workflows/ci.yml`，在 `develop` / `master` 分支的 push / pull_request 上运行 markdown-lint、本地链接检查、docs 结构检查与 link-checker
+- CI 配置：`.github/workflows/ci.yml`，在 `develop` 分支的 push / pull_request 上运行 markdown-lint、本地链接检查、docs 结构检查与 link-checker
 
```

**File**: `assets/ai-citation/llms-full.txt` (modified, +56/-0)
```diff
@@ -85,6 +85,14 @@ GEOFlow 的关键启发是：GEO 不是关键词堆砌，而是内容工程链
 - research/research-transfer-synthesis.md：将对标拆解、改良迭代和杂交创新转成可执行研究路线。
 - research/harness/README.md：Harness Engineering 的工程控制、评估器与反馈闭环研究对象。
 - research/harness/harness-engineering.md：Harness Engineering 的工程控制、评估器与反馈闭环解析。
+- research/walkinglabs-learn-harness-engineering/README.md：Harness Engineering 课程、模板、Skill 与审计工具研究对象。
+- research/walkinglabs-learn-harness-engineering/analysis.md：Harness 课程、控制面和验证闭环的结构化研究。
+- research/walkinglabs-learn-harness-engineering/deep-dive.md：Harness 结构、工具链和可迁移机制的 L2 研究。
+- research/mindfold-ai-trellis/README.md：跨平台 Agent Harness、任务规格与会话记忆系统研究对象。
+- research/mindfold-ai-trellis/analysis.md：任务控制面、规格注入和多平台适配的结构化研究。
+- research/mindfold-ai-trellis/deep-dive.md：Harness 架构、CLI 和记忆系统的 L2 研究。
+- research/vibe-cybersecurity-cn/README.md：授权边界内的 Agent 网络安全自动化研究与工程项目。
+- research/vibe-harness-cn/README.md：治理 Agent Harness 与问题求解算子库的元 Harness 项目。
 - research/aider-ai-aider/README.md：终端 AI 结对编程工具研究对象。
 - research/aider-ai-aider/analysis.md：Aider-AI/aider 的结构化研究结论、可借鉴点、风险和下一轮任务。
 - research/aider-ai-aider/deep-dive.md：Aider-AI/aider 的 L2 源码/结构深度研究、关键机制和可迁移模式。
@@ -97,6 +105,54 @@ GEOFlow 的关键启发是：GEO 不是关键词堆砌，而是内容工程链
 - research/openai-codex/README.md：OpenAI Codex 官方 coding agent 工具源码研究对象。
 - research/openai-codex/analysis.md：openai/codex 的结构化研究结论、可借鉴点、风险和下一轮任务。
 - research/openai-codex/deep-dive.md：openai/codex 的 L2 源码/结构深度研究、关键机制和可迁移模式。
+- research/openai-plugins/README.md：OpenAI Codex 插件、marketplace 与 skill-only plugin 分发研究对象。
+- research/openai-plugins/analysis.md：openai/plugins 的能力包、发现和权限边界结构化研究。
+- research/openai-plugins/deep-dive.md：openai/plugins 的 manifest、marketplace 和验证资产 L2 研究。
+- research/openai-skills/README.md：已 deprecated 的 OpenAI Codex Skills Catalog 与插件迁移研究对象。
+- research/openai-skills/analysis.md：openai/skills 的技能目录生命周期和迁移边界结构化研究。
+- research/openai-skills/deep-dive.md：openai/skills 的技能目录、能力包和渐进加载 L2 研究。
+- research/openai-agents-python/README.md：OpenAI Agents SDK 的 Agent 运行时与多 Agent 工作流研究对象。
+- research/openai-agents-python/analysis.md：openai/openai-agents-python 的 Agent、工具、护栏和追踪结构化研究。
+- research/openai-agents-python/deep-dive.md：OpenAI Agents SDK 运行时对象与验证机制 L2 研究。
+- research/openai-agents-js/README.md：OpenAI 官方 TypeScript/JavaScript Agent 运行时研究对象。
+- research/openai-agents-js/analysis.md：openai/openai-agents-js 的 TypeScript Agent 运行时结构化研究。
+- research/openai-agents-js/deep-dive.md：openai/openai-agents-js 的 SDK 包结构、sandbox 与验证机制 L2 研究。
+- research/openai-cookbook/README.md：OpenAI API、Codex、Agent、评估与安全示例库研究对象。
+- research/openai-cookbook/analysis.md：openai/openai-cookbook 的官方示例、登记表和可复现产物结构化研究。
+- research/openai-cookbook/deep-dive.md：OpenAI Cookbook registry、Codex 示例、Agent 示例与风险边界 L2 研究。
+- research/github-spec-kit/README.md：GitHub 官方规格驱动开发工具包研究对象。
+- research/github-spec-kit/analysis.md：github/spec-kit 的规格驱动流程和测试分层结构化研究。
+- research/github-spec-kit/deep-dive.md：github/spec-kit 的 `.specify`、命令模板、扩展和测试结构 L2 研究。
+- research/fission-ai-openspec/README.md：面向 AI coding assistant 的规格驱动开发工具研究对象。
+- research/fission-ai-openspec/analysis.md：Fission-AI/OpenSpec 的变更提案、规格资产和 CLI/Skill 边界结构化研究。
+- research/fission-ai-openspec/deep-dive.md：OpenSpec 的 changes、specs、schema、skills 与命令 L2 研究。
+- research/google-gemini-gemini-cli/README.md：Google Gemini CLI 终端 coding agent、MCP 和扩展研究对象。
+- research/google-gemini-gemini-cli/analysis.md：Gemini CLI 上下文、工具、权限和安全评估结构化研究。
+- research/google-gemini-gemini-cli/deep-dive.md：Gemini CLI 的 CLI、扩展、checkpoint 和负例评估 L2 研究。
+- research/openhands-openhands/README.md：OpenHands Agent Canvas、工作区和后端控制中心研究对象。
+- research/openhands-openhands/analysis.md：OpenHands Agent 编排、工作区和自动化结构化研究。
+- research/openhands-openhands/deep-dive.md：OpenHands Agent Server、适配层和状态边界 L2 研究。
+- research/anomalyco-opencode/README.md：当前规范 OpenCode 的模型无关终端与编辑器 coding agent 研究对象。
+- research/anomalyco-opencode/analysis.md：OpenCode provider、权限、插件和配置生命周期结构化研究。
+- research/anomalyco-opencode/deep-dive.md：OpenCode plan/build、策略、插件 reload 和 v2 spec L2 研究。
+- research/
```

---

### Incident Patch 5: `511f9f36` (2026-06-02)
**Commit Message**: fix: architecture - align V2.93 release ledger example

**File**: `docs/references/modern-enterprise-architecture-template.md` (modified, +2/-2)
```diff
@@ -19611,7 +19611,7 @@ versionPolicyReleaseControlLedger:
   releaseCandidate:
     releaseChannel: candidate
     sourceCommit: <git-sha-of-baseline-commit>
-    releaseTag: architecture/v2.92-candidate
+    releaseTag: architecture/v2.93-candidate
     tagSigned: true
     tagSignatureVerified: true
     tagTargetMatchesSourceCommit: true
@@ -19628,7 +19628,7 @@ versionPolicyReleaseControlLedger:
     executionGateChanged: true
     migrationRequired: false
     adrRequired: false
-    changelogEntry: governance/evidence/releases/changelog-v2.92.md
+    changelogEntry: governance/evidence/releases/changelog-v2.93.md
   channelControls:
     allowedTransitions:
       - from: review
```

---

### Incident Patch 6: `bbb5ac1c` (2026-06-02)
**Commit Message**: fix: ci - exclude flaky javabetter link

**File**: `.lychee.toml` (modified, +1/-0)
```diff
@@ -35,4 +35,5 @@ exclude = [
   '^https://user-images\.githubusercontent\.com.*',
   '^https://notebooklm\.google\.com.*',
   '^https://www\.contributor-covenant\.org.*',
+  '^https://javabetter\.cn/.*',
 ]
```

#### Recent Merged Pull Requests:
- **PR #102** (2026-09-28): docs: define domain-bounded cultivation contract and worldview (@tradecatlabs)
- **PR #101** (2026-09-28): docs: draft bounded cultivation ontology and taxonomy (@tradecatlabs)
- **PR #100** (2026-09-27): docs: define cultivation war power as task-relative evaluation (@tradecatlabs)
- **PR #99** (2026-09-26): docs: index cultivation V1 in short AI context (@tradecatlabs)
- **PR #98** (2026-09-26): docs: align cultivation navigation and AI citation with V1 (@tradecatlabs)
- **PR #97** (2026-09-26): docs: distinguish model capability from one session response (@tradecatlabs)
- **PR #96** (2026-09-26): docs: distinguish V1 classification layers and resource budgets (@tradecatlabs)
- **PR #95** (2026-09-26): docs: clarify V1 method and tool mapping (@tradecatlabs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

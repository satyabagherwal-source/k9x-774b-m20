# Forensic Learning Record (Deep Inspection): study8677/repobrain

> **Canonical Artifact**: `07_PROJECT_LEARNING/study8677-repobrain-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/study8677/repobrain](https://github.com/study8677/repobrain))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:14:22.785Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `study8677/repobrain`
- **Description**: 🧠 RepoBrain (formerly Antigravity) — Give your repo a brain. ChatGPT for your codebase: works in Claude Code, Cursor, Codex, Windsurf & more.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 1325 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/codegraph-comparison/scripts/render_benchmark_v2_report.py`
```
#!/usr/bin/env python3
"""Render a v2 multi-repository, repeated benchmark JSON as Markdown."""

from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict
from pathlib import Path


def fmt_seconds(value: float | None) -> str:
    return "-" if value is None else f"{value:.2f} 秒"


def summarize(results: list[dict]) -> dict:
    present = [result for result in results if result]
    successful = [result for result in present if result.get("status") == "success"]
    seconds = [
        result["seconds"] for result in present
        if result.get("seconds") is not None
    ]
    usage = [
        result["usage"] for result in present
        if result.get("usage", {}).get("status") == "available"
    ]
    costs = [
        result["cost"] for result in present
        if result.get("cost", {}).get("status") == "available"
    ]
    return {
        "attempted": len(present),
        "success": len(successful),
        "found": sum(result.get("score", {}).get("found", 0) for result in present),
        "total": sum(result.get("score", {}).get("total", 0) for result in present),
        "total_seconds": sum(seconds),
        "mean": statistics.mean(seconds) if seconds else None,
        "median": statistics.median(seconds) if seconds else None,
        "usage_available": len(usage),
        "total_tokens": sum(item.get("total_tokens", 0) for item in usage),
        "input_tokens": sum(item.get("input_tokens", 0) for item in usage),
        "output_tokens": sum(item.get("output_tokens", 0) for item in usage),
        "cost_available": len(costs),
        "cost_usd": sum(item.get("amount", 0) for item in costs),
    }


def fmt_accuracy(found: int, total: int) -> str:
    if not total:
        return "-"
    return f"{found}/{total}（{found / total:.1%}）"


def fmt_usage(summary: dict) -> str:
    available = summary["usage_available"]
    attempted = summary["attempted"]
    if not available:
        return f"unavailable（0/{attempted}）"
    return f"{summary['total_tokens']:,}（{available}/{attempted} 可得）"


def fmt_cost(summary: dict) -> str:
    available = summary["cost_available"]
    attempted = summary["attempted"]
    if not available:
        return f"unavailable（0/{attempted}）"
    return f"${summary['cost_usd']:.6f}（{available}/{attempted} 可得）"


def result_cell(result: dict | None) -> str:
    if not result:
        return "未运行"
    score = result.get("score") or {}
    usage = result.get("usage") or {}
    cost = result.get("cost") or {}
    tokens = (
        f"{usage.get('total_tokens', 0):,} tokens"
        if usage.get("status") == "available"
        else "tokens unavailable"
    )
    cost_text = (
        f"${cost.get('amount', 0):.6f}"
        if cost.get("status") == "available"
        else "cost unavailable"
    )
    return (
        f"{score.get('found', 0)}/{score.get('total', 0)}，"
        f"{fmt_seconds(result.get('seconds'))}，{tokens}，{cost_text}，"
        f"{result.get('status', 'unknown')}"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    if payload.get("schema_version") != 2:
        parser.error("input must be a schema_version 2 result")

    grouped: dict[tuple[str, int, str], dict[str, dict | None]] = defaultdict(dict)
    repository_results: dict[str, dict[str, list[dict]]] = defaultdict(
        lambda: defaultdict(list)
    )
    all_results: dict[str, list[dict]] = defaultdict(list)
    for record in payload.get("records") or []:
        result = record.get("result")
        key = (record["repository"], record["repeat"], record["question_id"])
        grouped[key][record["product"]] = result
        if result:
            repository_results[record["repository"]][record["product"]].append(result)
            all_results[record["product"]].append(result)
    codegraph_commands = sum(
        result.get("audit", {}).get("commands", 0)
        for result in all_results["codegraph"]
    )
    native_codegraph_commands = sum(
        result.get("audit", {}).get("codegraph_commands", 0)
        for result in all_results["codegraph"]
    )
    non_codegraph_commands = sum(
        result.get("audit", {}).get("non_codegraph_commands", 0)
        for result in all_results["codegraph"]
    )
    direct_source_reads = sum(
        result.get("audit", {}).get("direct_source_read_commands", 0)
        for result in all_results["codegraph"]
    )
    reroutes = sorted({
        reroute
        for product_results in all_results.values()
        for result in product_results
        for reroute in result.get("model", {}).get("routes", [])
    })

    lines = [
        f"# RepoBrain 与 CodeGraph 对比：{payload['run_id']}",
        "",
        "## 评测口径",
        "",
        f"- Manifest：`{payload.get('manifest', '-')}`",
        f"- 请求模型：`{payload.get('model', '-')}`",
        f"- 赛道：`{payload.get('track', 'unknown')}`",
        f"- 源码访问：`{payload.get('source_access', 'unknown')}`",
        f"- 重复次数：`{payload.get('repeat_count', 1)}`",
        f"- 并发数：`{payload.get('concurrency', 1)}`",
        "- 每个 repository、repeat、product 的原始结果和日志独立保存。",
        "",
    ]
    tools = payload.get("tools") or {}
    if tools:
        repo_tool = tools.get("repobrain") or {}
        graph_tool = tools.get("codegraph") or {}
        lines.extend([
            f"- RepoBrain：`{repo_tool.get('version', '-')}` / `{repo_tool.get('revision', '-')}`",
            f"- CodeGraph：`{graph_tool.get('release', '-')}`",
            "",
        ])
    lines.extend([
        "## 总体结果",
        "",
        "| 产品 | 成功/已运行 | 证据提及召回率 | 总耗时 | 总 tokens | 总成本 |",
        "|---|---:|---:|---:|---:|---:|",
    ])
    for product in ("repobrain", "codegraph"):
        summary = summarize(all_results[product])
        lines.append(
            f"| {product} | {summary['success']}/{summary['attempted']} | "
            f"{fmt_accuracy(summary['found'], summary['total'])} | "
            f"{fmt_seconds(summary['total_seconds'])} | {fmt_usage(summary)} | "
            f"{fmt_cost(summary)} |"
        )
    lines.extend([
        "", "## Agent 行为审计", "",
        f"- CodeGraph Agent 命令总数：`{codegraph_commands}`",
        f"- 其中 CodeGraph CLI 调用：`{native_codegraph_commands}`",
        f"- 其中非 CodeGraph shell 命令：`{non_codegraph_commands}`（无限制赛道允许）",
        f"- 检出的直接源码读取命令：`{direct_source_reads}`（"
        + ("无限制赛道允许）" if payload.get("source_access") else "source-free 赛道不允许）"),
    ])
    if reroutes:
        lines.extend([
            "", "Trae 事件中记录到的模型路由：", "",
            *[f"- `{reroute}`" for reroute in reroutes],
        ])

    lines.extend([
        "", "## 分项目结果", "",
        "| 项目 | 产品 | 成功/已运行 | 证据提及召回率 | 总耗时 | 总 tokens | 总成本 |",
        "|---|---|---:|---:|---:|---:|---:|",
    ])
    for repository in sorted(repository_results):
        for product in ("repobrain", "codegraph"):
            summary = summarize(repository_results[repository][product])
            lines.append(
                f"| {repository} | {product} | {summary['success']}/{summary['attempted']} | "
                f"{fmt_accuracy(summary['found'], summary['total'])} | "
                f"{fmt_seconds(summary['total_seconds'])} | "
                f"{fmt_usage(summary)} | {fmt_cost(summary)} |"
            )

    lines.extend([
        "", "## 逐次逐题结果", "",
        "| 项目 | 重复 | 问题 | RepoBrain | CodeGraph | CG 命令/非 CG/源码读取 |",
        "|---|---:|---|---:|---:|---:|",
    ])
    for (repository, repeat, question_id), products in sorted(grouped.items()):
        audit = (products.get("codegraph") or {}).get("audit", {})
        lines.append(
            f"| {repository} | {repeat} | `{question_id}` | "
            f"{result_cell(products.get('repobrain'))} | "
            f"{result_cell(products.get('codegraph'))} | "
            f"{audit.get('commands', 0)}/"
            f"{audit.get('non_codegraph_commands', 0)}/"
            f"{audit.get('direct_source_read_commands', 0)} |"
        )
    lines.extend([
        "", "## 证据提及召回率说明", "",
        "该指标不是语义正确率：文件仅在 `sources` 给出存在于锁定源码快照中的完整仓库相对路径时命中，",
        "符号仅按标识符边界检查是否在答案或来源中被提及；它不判断调用关系、执行顺序或解释是否正确。",
        "失败和未完成任务不会从已运行任务的分母中删除；完整答案、来源、",
        "限制与运行日志保存在对应 run-id 的分层目录中。",
        "",
    ])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `benchmarks/codegraph-comparison/scripts/render_fair_e2e_report.py`
```
#!/usr/bin/env python3
"""Render the matched end-to-end benchmark as a Chinese Markdown report."""

from __future__ import annotations

import argparse
import json
import re
import statistics
from pathlib import Path


QUESTION_ZH = {
    "verl-ppo-entry": "PPO 主入口与 legacy Trainer 调用链",
    "verl-advantage-dispatch": "GAE/GRPO advantage 分派",
    "verl-worker-resources": "Legacy worker 与资源池映射",
    "verl-runtime-runner-selection": "Ray 配置与 V1/legacy runner 选择",
    "verl-v1-runner-lifecycle": "V1 与 legacy runner 生命周期",
    "verl-response-mask-advantage": "Response mask 与 advantage 计算",
    "verl-kl-penalty-flow": "KL penalty 计算与反馈",
    "verl-validation-pipeline": "Validation 生成、评分与合并",
    "verl-checkpoint-lifecycle": "Checkpoint 加载、保存与触发",
    "verl-worker-initialization": "Colocated worker group 初始化",
    "verl-logprob-value-flow": "Old/ref log-prob 与 critic value",
    "verl-actor-critic-update-order": "Actor/critic 更新顺序",
    "verl-advantage-registry": "Advantage estimator 注册表",
    "verl-policy-loss-registry": "Policy loss 注册表",
    "verl-kl-controller-selection": "Adaptive/fixed KL controller",
}


def product_summary(records: list[dict], product: str) -> dict:
    results = [record.get(product) for record in records]
    present = [result for result in results if result]
    successful = [result for result in present if result["status"] == "success"]
    seconds = [result["seconds"] for result in successful if result["seconds"] is not None]
    return {
        "completed": len(successful),
        "attempted": len(present),
        "found": sum(result["score"]["found"] for result in present),
        "total": sum(result["score"]["total"] for result in present),
        "mean": statistics.mean(seconds) if seconds else None,
        "median": statistics.median(seconds) if seconds else None,
        "minimum": min(seconds) if seconds else None,
        "maximum": max(seconds) if seconds else None,
        "failures": len(present) - len(successful),
    }


def fmt_seconds(value: float | None) -> str:
    return "-" if value is None else f"{value:.2f} 秒"


def fmt_result(result: dict | None) -> str:
    if not result:
        return "未运行"
    score = result["score"]
    return (
        f"{score['found']}/{score['total']}，"
        f"{fmt_seconds(result['seconds'])}，{result['status']}"
    )


def audit_events(raw_dir: Path) -> tuple[list[str], dict[str, dict]]:
    reroutes = set()
    audits = {}
    for path in raw_dir.glob("*.codegraph-events.jsonl"):
        question_id = path.name.removesuffix(".codegraph-events.jsonl")
        commands = []
        with path.open(encoding="utf-8", errors="replace") as stream:
            for line in stream:
                if '"type":"model_reroute"' in line:
                    source = re.search(r'"from_model":"([^"]+)"', line)
                    target = re.search(r'"to_model":"([^"]+)"', line)
                    if source and target:
                        reroutes.add(f"{source.group(1)} -> {target.group(1)}")
                if (
                    '"type":"item.completed"' in line
                    and '"type":"command_execution"' in line
                ):
                    commands.append(line.split('"aggregated_output"', 1)[0])
        audits[question_id] = {
            "commands": len(commands),
            "non_codegraph_commands": [
                command for command in commands if "codegraph" not in command
            ],
        }
    return sorted(reroutes), audits


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--raw-dir", type=Path)
    args = parser.parse_args()

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    records = payload["records"]
    repo = product_summary(records, "repobrain")
    graph = product_summary(records, "codegraph")
    reroutes, audits = audit_events(args.raw_dir) if args.raw_dir else ([], {})
    total_graph_commands = sum(item["commands"] for item in audits.values())
    total_non_graph_commands = sum(
        len(item["non_codegraph_commands"]) for item in audits.values()
    )

    lines = [
        "# RepoBrain 与 CodeGraph 公平端到端对比",
        "",
        "## 评测口径",
        "",
        f"- 请求模型：`{payload['model']}`",
        f"- 并发数：`{payload.get('concurrency', 1)}`",
        "- RepoBrain：计时覆盖知识检索、Trae Agent 推理和结构化答案生成。",
        "- CodeGraph：计时覆盖 Trae Agent 启动、CodeGraph CLI 检索、证据阅读和答案生成。",
        "- 两边使用相同问题、相同请求模型，并采用端到端墙钟时间。",
        "- RepoBrain 查询目录不含源码；CodeGraph Agent 使用不含源码的可写索引副本。",
        "",
    ]
    if reroutes:
        lines.extend(
            [
                "Trae 事件日志记录到以下服务端模型路由：",
                "",
                *[f"- `{item}`" for item in reroutes],
                "",
            ]
        )
    lines.extend(
        [
            "## 总体结果",
            "",
            "| 指标 | RepoBrain | CodeGraph + 外层模型 |",
            "|---|---:|---:|",
            f"| 成功完成 | {repo['completed']}/{repo['attempted']} | {graph['completed']}/{graph['attempted']} |",
            f"| 证据原子命中 | {repo['found']}/{repo['total']} | {graph['found']}/{graph['total']} |",
            f"| 平均端到端耗时 | {fmt_seconds(repo['mean'])} | {fmt_seconds(graph['mean'])} |",
            f"| 中位端到端耗时 | {fmt_seconds(repo['median'])} | {fmt_seconds(graph['median'])} |",
            f"| 最快 | {fmt_seconds(repo['minimum'])} | {fmt_seconds(graph['minimum'])} |",
            f"| 最慢 | {fmt_seconds(repo['maximum'])} | {fmt_seconds(graph['maximum'])} |",
            f"| 失败 | {repo['failures']} | {graph['failures']} |",
            f"| CodeGraph Agent shell 命令 | - | {total_graph_commands} |",
            f"| 非 CodeGraph shell 命令 | - | {total_non_graph_commands} |",
            "",
            "## 逐题结果",
            "",
            "| 问题 | RepoBrain：命中、耗时、状态 | CodeGraph：命中、耗时、状态 | CG 命令/非 CG 命令 |",
            "|---|---:|---:|---:|",
        ]
    )
    for record in records:
        title = QUESTION_ZH.get(record["id"], record["id"])
        audit = audits.get(record["id"], {"commands": 0, "non_codegraph_commands": []})
        lines.append(
            f"| `{record['id']}` {title} | "
            f"{fmt_result(record.get('repobrain'))} | "
            f"{fmt_result(record.get('codegraph'))} | "
            f"{audit['commands']}/{len(audit['non_codegraph_commands'])} |"
        )
    lines.extend(
        [
            "",
            "## 准确率说明",
            "",
            "这里的准确率是预先定义的文件与符号证据原子召回率。完整答案、来源和限制",
            "保存在配套 JSON 中，可继续进行人工语义核验。失败任务按未命中计，不从",
            "分母中删除。",
            "",
        ]
    )
    args.output.write_text("\n".join(lines), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `benchmarks/codegraph-comparison/scripts/score_answers.py`
```
#!/usr/bin/env python3
"""Score benchmark outputs against deterministic file and symbol atoms."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_text(path: Path) -> str:
    if path.suffix == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("answer"), str):
            return payload["answer"]
    return path.read_text(encoding="utf-8")


def recall(expected: list[str], text: str) -> tuple[int, int, float]:
    found = sum(1 for item in expected if item.casefold() in text.casefold())
    total = len(expected)
    return found, total, found / total if total else 1.0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", type=Path, required=True)
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    questions = json.loads(args.questions.read_text(encoding="utf-8"))["questions"]
    scores: list[dict[str, object]] = []

    for question in questions:
        question_id = question["id"]
        for tool, suffix in (("repobrain", ".json"), ("codegraph", ".md")):
            result_path = args.results / f"{question_id}-{tool}{suffix}"
            exit_code_path = args.results / f"{question_id}-{tool}.exit-code"
            if exit_code_path.exists():
                exit_code = int(exit_code_path.read_text(encoding="utf-8").strip())
                if exit_code != 0:
                    scores.append(
                        {
                            "question_id": question_id,
                            "tool": tool,
                            "status": "unavailable",
                            "reason": f"command exited with code {exit_code}",
                        }
                    )
                    continue
            if not result_path.exists():
                scores.append(
                    {
                        "question_id": question_id,
                        "tool": tool,
                        "status": "missing",
                    }
                )
                continue

            try:
                text = load_text(result_path)
            except (OSError, json.JSONDecodeError) as exc:
                scores.append(
                    {
                        "question_id": question_id,
                        "tool": tool,
                        "status": "invalid",
                        "reason": str(exc),
                    }
                )
                continue
            file_found, file_total, file_recall = recall(
                question["expected_files"], text
            )
            symbol_found, symbol_total, symbol_recall = recall(
                question["expected_symbols"], text
            )
            scores.append(
                {
                    "question_id": question_id,
                    "tool": tool,
                    "status": "scored",
                    "expected_files_found": file_found,
                    "expected_files_total": file_total,
                    "expected_file_recall": file_recall,
                    "expected_symbols_found": symbol_found,
                    "expected_symbols_total": symbol_total,
                    "expected_symbol_recall": symbol_recall,
                    "output_bytes": len(text.encode("utf-8")),
                }
            )

    output = json.dumps({"schema_version": 1, "scores": scores}, indent=2)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `engine/repobrain_engine/__init__.py`
```
"""RepoBrain Engine — Dynamic multi-agent Knowledge Hub.

Public API:
    - ``refresh_pipeline``  — scan project, generate knowledge docs
    - ``ask_pipeline``      — answer questions via Router → ModuleAgent cluster
    - ``Settings``          — Pydantic configuration
"""

from repobrain_engine.config import Settings

__version__ = "0.3.2"

__all__ = [
    "Settings",
    "refresh_pipeline",
    "ask_pipeline",
    "__version__",
]


def refresh_pipeline(*args, **kwargs):
    """Lazily import and run the refresh pipeline.

    See :func:`repobrain_engine.hub.pipeline.refresh_pipeline` for full docs.
    """
    from repobrain_engine.hub.pipeline import refresh_pipeline as _refresh

    return _refresh(*args, **kwargs)


def ask_pipeline(*args, **kwargs):
    """Lazily import and run the ask pipeline.

    See :func:`repobrain_engine.hub.pipeline.ask_pipeline` for full docs.
    """
    from repobrain_engine.hub.pipeline import ask_pipeline as _ask

    return _ask(*args, **kwargs)

```

### Core Architecture Module: `engine/repobrain_engine/__main__.py`
```
from repobrain_engine._cli_entry import engine_main

if __name__ == "__main__":
    engine_main()

```

### Core Architecture Module: `engine/repobrain_engine/_cli_entry.py`
```
"""CLI entry points for RepoBrain Engine.

Provides:
- rb-ask "question"   → ask the multi-agent cluster
- rb-refresh          → refresh the knowledge base (module agents self-learn)
- rb-mcp              → MCP server (see hub/mcp_server.py)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import traceback
from pathlib import Path
from typing import Sequence


def _parse_args(
    parser: argparse.ArgumentParser,
    argv: Sequence[str] | None,
) -> argparse.Namespace:
    """Parse CLI arguments from an explicit argv list or sys.argv.

    Args:
        parser: Configured argument parser.
        argv: Optional explicit argv list without the executable name.

    Returns:
        Parsed argument namespace.
    """
    if argv is None:
        return parser.parse_args()
    return parser.parse_args(list(argv))


def _run_ask_pipeline(workspace: Path, question: str) -> str:
    """Run the ask pipeline for CLI entry points."""
    import asyncio
    from repobrain_engine.hub.pipeline import ask_pipeline

    return asyncio.run(ask_pipeline(workspace, question))


def _split_answer_sections(answer_text: str) -> dict[str, object]:
    """Split a rendered answer into ``{answer, sources, limitations}``.

    The pipeline returns a single Markdown string. The host-runner path
    appends ``Sources:`` / ``Limitations:`` blocks (see
    :meth:`HostRunnerAnswer.to_markdown`); the LLM/structured paths return
    free-form prose with no such headers. This best-effort splitter peels off
    those trailing blocks when present so programmatic callers get structured
    fields, and otherwise leaves the whole text as ``answer`` with empty lists.

    Args:
        answer_text: The rendered answer string from ``ask_pipeline``.

    Returns:
        A dict with ``answer`` (str), ``sources`` (list[str]), and
        ``limitations`` (list[str]).
    """
    sources: list[str] = []
    limitations: list[str] = []

    # Match a trailing "Limitations:" block, then a trailing "Sources:" block.
    # Order matters: strip Limitations (which follows Sources) first so the
    # Sources regex then sees a clean tail.
    def _pop_block(text: str, header: str) -> tuple[str, list[str]]:
        pattern = re.compile(
            rf"\n\n{re.escape(header)}:\n((?:- .*(?:\n|$))+)\Z"
        )
        match = pattern.search(text)
        if not match:
            return text, []
        items = [
            line[2:].strip()
            for line in match.group(1).splitlines()
            if line.startswith("- ")
        ]
        return text[: match.start()], [item for item in items if item]

    remaining, limitations = _pop_block(answer_text, "Limitations")
    remaining, sources = _pop_block(remaining, "Sources")

    return {
        "answer": remaining.strip(),
        "sources": sources,
        "limitations": limitations,
    }


def _emit_ask_json(workspace: Path, question: str, answer_text: str) -> None:
    """Print the ask result as a stable JSON envelope on stdout.

    Guarantees a machine-parseable object so LLM tool wrappers never have to
    scrape human-formatted text:

        {"answer": ..., "sources": [...], "limitations": [...],
         "workspace": ..., "question": ...}
    """
    payload = _split_answer_sections(answer_text)
    payload["workspace"] = str(workspace)
    payload["question"] = question
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def _run_refresh_pipeline(workspace: Path, *, quick: bool, failed_only: bool):
    """Run the refresh pipeline for CLI entry points."""
    import asyncio
    from repobrain_engine.hub.pipeline import refresh_pipeline

    return asyncio.run(
        refresh_pipeline(
            workspace=workspace,
            quick=quick,
            failed_only=failed_only,
        )
    )


def _diagnostic_log_path() -> Path:
    """Return the MCP diagnostic log path for actionable CLI errors."""
    try:
        from repobrain_engine.hub.mcp_server import _mcp_log_path

        return _mcp_log_path()
    except Exception:
        data_dir = os.environ.get("CLAUDE_PLUGIN_DATA_DIR", "").strip()
        if data_dir:
            base = Path(data_dir).expanduser()
        else:
            base = Path.home() / ".claude" / "plugins" / "data" / "repobrain-repobrain"
        return base / "rb-mcp.log"


def _debug_mode_enabled() -> bool:
    """Return whether full tracebacks should be printed."""
    value = os.environ.get("DEBUG_MODE", "")
    if value.strip().lower() in {"1", "true", "yes", "on"}:
        return True
    try:
        from repobrain_engine.config import settings

        return bool(settings.DEBUG_MODE)
    except Exception:
        return False


def _one_line_message(exc: BaseException) -> str:
    """Return an exception message without embedded newlines."""
    message = str(exc).replace("\n", " ").replace("\r", " ").strip()
    return message or exc.__class__.__name__


def _suggestion_for_exception(exc: BaseException) -> str:
    """Return a short actionable suggestion for a CLI failure."""
    name = exc.__class__.__name__.lower()
    message = _one_line_message(exc).lower()
    if "timeout" in name or "timeout" in message or "timed out" in message:
        return "Try increasing RB_ASK_TIMEOUT_SECONDS or rerun rb doctor."
    if "connection" in name or "connect" in message or "provider" in message:
        return "Run rb doctor to check provider connectivity."
    if "permission" in name or "permission" in message:
        return "Check workspace file permissions, then rerun rb doctor."
    return "Run rb doctor for environment and knowledge-base diagnostics."


def _handle_unexpected_cli_exception(exc: Exception) -> None:
    """Print a compact actionable error, then optional debug traceback."""
    print(
        "Error: "
        f"{exc.__class__.__name__}: {_one_line_message(exc)}. "
        f"{_suggestion_for_exception(exc)} "
        f"Diagnostic log: {_diagnostic_log_path()}",
        file=sys.stderr,
    )
    if _debug_mode_enabled():
        traceback.print_exception(type(exc), exc, exc.__traceback__, file=sys.stderr)
    sys.exit(1)


def ask_main(argv: Sequence[str] | None = None) -> None:
    """Entry point for ``rb-ask``.

    Args:
        argv: Optional explicit argv list without the executable name.
    """

    parser = argparse.ArgumentParser(
        prog="rb-ask",
        description="Ask the RepoBrain multi-agent cluster a question",
    )
    parser.add_argument("question", help="Natural language question about the project")
    parser.add_argument("--workspace", default=".", help="Project root (default: cwd)")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit a machine-readable JSON envelope "
        "{answer, sources, limitations, workspace, question} instead of "
        "human-formatted text. Errors are also emitted as JSON on stderr. "
        "Use this when an LLM or script calls rb-ask programmatically.",
    )
    args = _parse_args(parser, argv)

    workspace = Path(args.workspace).resolve()
    os.environ["WORKSPACE_PATH"] = str(workspace)

    try:
        answer_text = _run_ask_pipeline(workspace, args.question)
        if args.json:
            _emit_ask_json(workspace, args.question, answer_text)
        else:
            print(answer_text)
    except KeyboardInterrupt:
        sys.exit(130)
    except ValueError as exc:
        if args.json:
            print(
                json.dumps({"error": str(exc)}, ensure_ascii=False),
                file=sys.stderr,
            )
        else:
            print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 - CLI boundary formats unknown failures
        if args.json:
            print(
                json.dumps(
                    {"error": f"{exc.__class__.__name__}: {_one_line_message(exc)}"},
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
            sys.exit(1)
        _handle_unexpected_cli_exception(exc)


def refresh_main(argv: Sequence[str] | None = None) -> None:
    """Entry point for ``rb-refresh``.

    Args:
        argv: Optional explicit argv list without the executable name.
    """

    parser = argparse.ArgumentParser(
        prog="rb-refresh",
        description="Refresh the RepoBrain knowledge base",
    )
    parser.add_argument("--workspace", default=".", help="Project root (default: cwd)")
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Judge committed diff impact and update only affected Agent groups",
    )
    parser.add_argument(
        "--failed-only",
        action="store_true",
        help="Resume failed/pending groups for the current target commit",
    )
    args = _parse_args(parser, argv)

    workspace = Path(args.workspace).resolve()
    os.environ["WORKSPACE_PATH"] = str(workspace)

    try:
        status = _run_refresh_pipeline(
            workspace=workspace,
            quick=args.quick,
            failed_only=args.failed_only,
        )
        if getattr(status, "exit_code", 0) != 0:
            sys.exit(int(status.exit_code))
    except KeyboardInterrupt:
        sys.exit(130)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 - CLI boundary formats unknown failures
        _handle_unexpected_cli_exception(exc)


def mcp_main(argv: Sequence[str] | None = None) -> None:
    """Entry point for ``rb-mcp``.

    Args:
        argv: Optional explicit argv list without the executable name.
    """
    from repobrain_engine.hub.mcp_server import main as mcp_server_main

    if argv is None:
        mcp_server_main()
        return

    original_argv = sys.argv[:]
    try:
        sys.argv = ["rb-mcp", *list(argv)]
        mcp_server_main()
    finally:
        sys.argv = original_argv


def _dispatch_m
```

### Core Architecture Module: `engine/repobrain_engine/config.py`
```
import os
from pathlib import Path
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPServerConfig(BaseSettings):
    """Configuration for a single MCP server."""

    name: str = Field(description="Unique name for the MCP server")
    transport: str = Field(
        default="stdio", description="Transport type: stdio, http, sse"
    )
    command: Optional[str] = Field(
        default=None, description="Command to run for stdio transport"
    )
    args: List[str] = Field(
        default_factory=list, description="Arguments for the command"
    )
    url: Optional[str] = Field(default=None, description="URL for http/sse transport")
    env: dict = Field(
        default_factory=dict, description="Environment variables for the server"
    )
    enabled: bool = Field(default=True, description="Whether this server is enabled")

    model_config = SettingsConfigDict(extra="ignore")


class Settings(BaseSettings):
    """Application settings managed by Pydantic."""

    # Agent Configuration
    AGENT_NAME: str = "RepoBrainAgent"
    # Stream Configuration
    STREAM_ENABLED: bool = Field(
        default=False,
        description="Enable streaming for LLM responses via litellm. "
        "Set to true for real-time token streaming.",
    )
    DEBUG_MODE: bool = False
    PROJECT_ROOT: str = Field(
        default_factory=lambda: os.environ.get(
            "WORKSPACE_PATH", str(Path.cwd())
        ),
        description="Absolute path to the user workspace. "
        "Set via --workspace CLI arg or WORKSPACE_PATH env var. "
        "Defaults to current working directory.",
    )

    # External LLM (OpenAI-compatible) Configuration
    OPENAI_BASE_URL: str = Field(
        default="",
        description="Base URL for OpenAI-compatible API (e.g., https://api.openai.com/v1 or http://localhost:11434/v1)",
    )
    OPENAI_API_KEY: str = Field(
        default="",
        description="API key for OpenAI-compatible endpoint. Leave blank if not required.",
    )
    OPENAI_MODEL: str = Field(
        default="gpt-4o-mini",
        description="Default model name for OpenAI-compatible chat completions.",
    )

    # Local host runner (experimental, no API key) Configuration
    RB_HOST_RUNNER: str = Field(
        default="",
        description="Experimental local host runner for rb-ask, e.g. 'codex' or 'generic'.",
    )
    RB_HOST_MODEL: str = Field(
        default="",
        description="Optional model for the 'codex' host runner's --model flag. "
        "Leave empty to let the CLI use its own default model. Ignored by the "
        "'generic' runner (put any model flag directly in RB_HOST_COMMAND).",
    )
    RB_HOST_COMMAND: str = Field(
        default="",
        description="Command template for RB_HOST_RUNNER=generic. Supports placeholders "
        "{prompt_file}, {schema_file}, {output_file}, {workspace}. Example: "
        "'trae exec --prompt {prompt_file}'. When {prompt_file} is omitted, the prompt "
        "is sent on stdin.",
    )
    RB_HOST_OUTPUT_MODE: str = Field(
        default="file",
        description="Where the generic host runner reads its JSON answer from: "
        "'file' (the {output_file}) or 'stdout'.",
    )
    RB_HOST_TIMEOUT_SECONDS: float = Field(
        default=600.0,
        description="Timeout in seconds for local host runner calls.",
    )
    RB_HOST_MAX_CONTEXT_CHARS: int = Field(
        default=60000,
        description="Maximum prompt size passed to the local host runner.",
    )
    RB_REFRESH_SCAN_ONLY: bool = Field(
        default=False,
        description="Run refresh without LLM analysis and write scan artifacts only.",
    )

    # Backward-compatible reminder toggle for rb-ask. Ask is read-only and
    # never invokes refresh; committed drift is handled manually via --quick.
    RB_ASK_AUTO_REFRESH: str = Field(
        default="stale",
        description="Deprecated auto-refresh setting, now used only as a "
        "manual-refresh reminder toggle. 'off' disables reminders.",
    )
    RB_ASK_AUTO_REFRESH_LAG: int = Field(
        default=20,
        description="Deprecated compatibility field. Any positive committed "
        "lag is now reported; ask never executes refresh.",
    )
    RB_IMPACT_MAX_ROUNDS: int = Field(
        default=3,
        ge=1,
        description="Maximum independent Planner/Verifier rounds for quick refresh.",
    )

    # Memory Configuration
    MEMORY_FILE: str = "memory/agent_memory.md"
    MEMORY_SUMMARY_FILE: str = "memory/agent_summary.md"
    ARTIFACTS_DIR: str = Field(
        default="artifacts",
        description="Directory for artifacts and logs. Relative paths are resolved from PROJECT_ROOT.",
    )

    # RepoBrain Context Directory
    REPOBRAIN_DIR: str = Field(
        default=".repobrain",
        description="Directory for project context files. Relative to PROJECT_ROOT.",
    )

    # MCP Configuration
    MCP_ENABLED: bool = Field(default=False, description="Enable MCP integration")
    MCP_SERVERS_CONFIG: str = Field(
        default="mcp_servers.json", description="Path to MCP servers configuration file"
    )
    MCP_CONNECTION_TIMEOUT: int = Field(
        default=30, description="Timeout in seconds for MCP server connections"
    )
    MCP_TOOL_PREFIX: str = Field(
        default="mcp_", description="Prefix for MCP tool names to avoid conflicts"
    )

    model_config = SettingsConfigDict(
        env_file=str(
            Path(
                os.environ.get("WORKSPACE_PATH", str(Path.cwd()))
            ) / ".env"
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def project_root_path(self) -> Path:
        """Return project root as an absolute path."""
        return Path(self.PROJECT_ROOT).expanduser().resolve()

    def resolve_path(self, path_value: str) -> Path:
        """
        Resolve a path value against project root when it is not absolute.

        Args:
            path_value: Relative or absolute file system path.

        Returns:
            Absolute resolved path.
        """
        path = Path(path_value).expanduser()
        if path.is_absolute():
            return path
        return self.project_root_path / path

    @property
    def memory_file_path(self) -> Path:
        """Return the resolved memory file path."""
        return self.resolve_path(self.MEMORY_FILE)

    @property
    def memory_summary_file_path(self) -> Path:
        """Return the resolved memory summary file path."""
        return self.resolve_path(self.MEMORY_SUMMARY_FILE)

    @property
    def repobrain_dir_path(self) -> Path:
        """Return the resolved repobrain context directory path."""
        return self.resolve_path(self.REPOBRAIN_DIR)

    @property
    def artifacts_path(self) -> Path:
        """Return the resolved artifacts directory path."""
        return self.resolve_path(self.ARTIFACTS_DIR)


# Lazy global settings — instantiated on first access so that env-var
# overrides in tests take effect.
_settings: Settings | None = None


def get_settings() -> Settings:
    """Return the global Settings instance, creating it on first call.

    Resolves the .env path from the *current* value of WORKSPACE_PATH
    rather than the value frozen at class-definition time. This lets
    runtime workspace upgrades (e.g. via MCP roots protocol) take effect
    after `reset_settings()`.
    """
    global _settings
    if _settings is None:
        env_path = Path(os.environ.get("WORKSPACE_PATH", str(Path.cwd()))) / ".env"
        _settings = Settings(_env_file=str(env_path))
    return _settings


def reset_settings() -> None:
    """Reset the cached settings (useful in tests after changing env vars)."""
    global _settings
    _settings = None


class _SettingsProxy:
    """Transparent proxy so ``from config import settings`` keeps working."""

    def __getattr__(self, name: str):
        return getattr(get_settings(), name)

    def __setattr__(self, name: str, value):
        setattr(get_settings(), name, value)

    def __repr__(self) -> str:
        return repr(get_settings())


settings = _SettingsProxy()

```

### Core Architecture Module: `engine/repobrain_engine/hub/__init__.py`
```
"""Knowledge Hub — multi-agent system for maintaining project context."""

```

### Core Architecture Module: `engine/repobrain_engine/hub/__main__.py`
```
from repobrain_engine._cli_entry import hub_main

hub_main()

```

### Core Architecture Module: `engine/repobrain_engine/hub/_constants.py`
```
"""Shared constants for the Hub package.

Centralises directory-skip lists, language maps, and file-type
classifications that were previously duplicated across scanner,
ask_tools, and pipeline modules.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Directories to skip during scanning / searching / listing
# ---------------------------------------------------------------------------

SKIP_DIRS: frozenset[str] = frozenset({
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "dist",
    "build",
    ".eggs",
    ".next",
    ".nuxt",
    "target",
    "vendor",
    ".repobrain",
    "artifacts",
})
"""Superset of all previously duplicated ``_SKIP_DIRS`` definitions.

Used by scanner, ask_tools, and pipeline for consistent filtering.
Individual modules may extend this set (e.g. ``detect_modules`` adds
``.repobrain``, ``artifacts``, etc.) but should never redefine it.
"""

# ---------------------------------------------------------------------------
# File extension → language name mapping
# ---------------------------------------------------------------------------

LANG_MAP: dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript (React)",
    ".jsx": "JavaScript (React)",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".swift": "Swift",
    ".dart": "Dart",
    ".lua": "Lua",
    ".sh": "Shell",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".toml": "TOML",
    ".json": "JSON",
    ".md": "Markdown",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sql": "SQL",
}

# ---------------------------------------------------------------------------
# File-type classification sets
# ---------------------------------------------------------------------------

DOCUMENTATION_EXTS: frozenset[str] = frozenset({
    ".md", ".rst", ".txt", ".adoc", ".pdf",
})

DATA_EXTS: frozenset[str] = frozenset({
    ".csv", ".tsv", ".json", ".jsonl", ".yaml", ".yml",
    ".xml", ".sql", ".db", ".sqlite", ".parquet",
})

MEDIA_EXTS: frozenset[str] = frozenset({
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
    ".mp3", ".wav", ".ogg", ".mp4", ".mov", ".avi", ".mkv",
})

TEXT_EXTS: frozenset[str] = frozenset(LANG_MAP) | DOCUMENTATION_EXTS | DATA_EXTS | frozenset({".env", ".log"})

# ---------------------------------------------------------------------------
# Source code module analysis
# ---------------------------------------------------------------------------

SOURCE_CODE_EXTS: frozenset[str] = frozenset({
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".kt",
    ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp", ".swift", ".dart",
    ".lua", ".sh", ".scala", ".zig", ".ex", ".exs", ".clj", ".hs",
})
"""File extensions treated as analyzable source code for module discovery."""

WORKSPACE_ROOT_MODULE_ID = "__workspace_root__"
"""Internal module identifier used for source files that live at repo root."""

# ---------------------------------------------------------------------------
# Framework / tool marker files
# ---------------------------------------------------------------------------

FRAMEWORK_MARKERS: dict[str, str] = {
    "pyproject.toml": "Python (pyproject.toml)",
    "setup.py": "Python (setup.py)",
    "requirements.txt": "Python (requirements.txt)",
    "package.json": "Node.js",
    "Cargo.toml": "Rust (Cargo)",
    "go.mod": "Go Modules",
    "Gemfile": "Ruby (Bundler)",
    "pom.xml": "Java (Maven)",
    "build.gradle": "Java/Kotlin (Gradle)",
    "composer.json": "PHP (Composer)",
    "pubspec.yaml": "Dart/Flutter",
    "Makefile": "Make",
    "CMakeLists.txt": "CMake",
    "Dockerfile": "Docker",
    "docker-compose.yml": "Docker Compose",
    "docker-compose.yaml": "Docker Compose",
    ".github/workflows": "GitHub Actions",
    "Jenkinsfile": "Jenkins",
    ".gitlab-ci.yml": "GitLab CI",
    "tsconfig.json": "TypeScript",
    "next.config.js": "Next.js",
    "next.config.mjs": "Next.js",
    "vite.config.ts": "Vite",
    "webpack.config.js": "Webpack",
    "tailwind.config.js": "Tailwind CSS",
    ".eslintrc.js": "ESLint",
    ".prettierrc": "Prettier",
    "pytest.ini": "Pytest",
    "setup.cfg": "Python (setup.cfg)",
    "tox.ini": "Tox",
}

# ---------------------------------------------------------------------------
# Fallback knowledge-doc markers
# ---------------------------------------------------------------------------

# Written at the top / in the body of an auto-generated fallback agent.md.
# A fallback doc is emitted when a module's LLM analysis fails or times out and
# contains only a bare file listing — NOT real analyzed knowledge. The ask
# pipeline detects either marker so a degraded module is never silently served
# as if it were factual, grounded knowledge.
AGENT_MD_FALLBACK_MARKER = "<!-- rb:status=fallback -->"
AGENT_MD_FALLBACK_SENTINEL = "(Auto-generated fallback — LLM analysis was unavailable)"

```

### Core Architecture Module: `engine/repobrain_engine/hub/_merkle.py`
```
"""Content-hash change detection for incremental refresh.

A Merkle-style content hash tree over the workspace at file -> module -> repo
granularity.  Persisting a snapshot lets a later refresh diff the current tree
against the previous one and learn *which modules changed* without trusting
git state — it sees uncommitted edits, survives branch switches, and works in
non-git directories.

This module is deliberately self-contained and side-effect-free apart from the
explicit snapshot read/write helpers.  It is NOT yet wired into the refresh
pipeline: detecting change here has no behavioural effect on its own.  The
follow-up step consumes :func:`diff_trees` to skip unchanged modules and
recompute only a changed module plus its graph impact closure.

Why module-grained hashes (not Cursor-style per-chunk):  Cursor re-embeds only
changed files because an embedding is a context-free function of one chunk.
RepoBrain's per-module knowledge is *interpreted* and cross-references other
modules, so the eventual cache key is ``hash(own files + dependency closure)``
— but the raw per-file/per-module hashes built here are the inputs that key is
computed from.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

logger = logging.getLogger(__name__)

# Bump when the on-disk snapshot schema changes; an older snapshot then loads
# as ``None`` and the caller rebuilds from scratch instead of misreading it.
SNAPSHOT_VERSION = 1

# Default file name for a persisted tree, written under the .repobrain dir.
SNAPSHOT_FILENAME = "merkle.json"

# Separator placed between a path and its hash inside a hashed line. NUL never
# appears in file paths, so it cannot be forged by a crafted path.
_SEP = "\0"


def compute_content_hash(content: str | bytes) -> str:
    """Return the SHA-256 hex digest of file content."""
    data = content.encode("utf-8") if isinstance(content, str) else content
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class ModuleNode:
    """One module's hash plus the per-file hashes it was derived from."""

    hash: str
    files: dict[str, str] = field(default_factory=dict)  # rel_path -> file hash


@dataclass(frozen=True)
class MerkleTree:
    """A workspace content-hash tree: root hash over all module hashes."""

    root: str
    modules: dict[str, ModuleNode] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "version": SNAPSHOT_VERSION,
            "root": self.root,
            "modules": {
                module_id: {"hash": node.hash, "files": node.files}
                for module_id, node in self.modules.items()
            },
        }

    @classmethod
    def from_dict(cls, data: Mapping) -> "MerkleTree":
        modules = {
            module_id: ModuleNode(
                hash=str(entry.get("hash", "")),
                files=dict(entry.get("files", {})),
            )
            for module_id, entry in data.get("modules", {}).items()
        }
        return cls(root=str(data.get("root", "")), modules=modules)


@dataclass(frozen=True)
class MerkleDiff:
    """Modules that appeared, changed, or vanished between two trees."""

    added: list[str]
    modified: list[str]
    removed: list[str]

    @property
    def changed_modules(self) -> list[str]:
        """Modules whose knowledge must be (re)generated: added + modified."""
        return sorted(set(self.added) | set(self.modified))

    @property
    def is_empty(self) -> bool:
        return not (self.added or self.modified or self.removed)


def _hash_lines(lines: list[str]) -> str:
    """Hash a set of ``name<SEP>hash`` lines order-independently."""
    return hashlib.sha256("\n".join(sorted(lines)).encode("utf-8")).hexdigest()


def build_tree(module_file_hashes: Mapping[str, Mapping[str, str]]) -> MerkleTree:
    """Build a :class:`MerkleTree` from precomputed per-file hashes.

    Pure: takes ``{module_id: {rel_path: file_hash}}`` and rolls hashes up
    deterministically (a module hash covers its file paths *and* contents, so
    renames register; the root covers all module ids and hashes).
    """
    modules: dict[str, ModuleNode] = {}
    for module_id, file_hashes in module_file_hashes.items():
        files = dict(file_hashes)
        module_hash = _hash_lines(
            [f"{rel_path}{_SEP}{files[rel_path]}" for rel_path in files]
        )
        modules[module_id] = ModuleNode(hash=module_hash, files=files)

    root = _hash_lines(
        [f"{module_id}{_SEP}{node.hash}" for module_id, node in modules.items()]
    )
    return MerkleTree(root=root, modules=modules)


def build_workspace_tree(workspace: Path) -> MerkleTree:
    """Build the content-hash tree for ``workspace``.

    Uses the same module detection and file-loading the refresh pipeline uses,
    so a "changed module" here corresponds exactly to a unit refresh would
    regenerate.  Performs file reads only — no LLM, no network.
    """
    from repobrain_engine.hub.module_grouping import load_module_files
    from repobrain_engine.hub.scanner import detect_modules, resolve_module_path

    module_file_hashes: dict[str, dict[str, str]] = {}
    for module_id in detect_modules(workspace):
        module_path = resolve_module_path(workspace, module_id)
        if module_path is None or not Path(module_path).is_dir():
            continue
        files = load_module_files(module_path, workspace)
        module_file_hashes[module_id] = {
            source_file.rel_path: compute_content_hash(source_file.content)
            for source_file in files
        }
    return build_tree(module_file_hashes)


def diff_trees(previous: MerkleTree | None, current: MerkleTree) -> MerkleDiff:
    """Compare two trees and report added / modified / removed modules."""
    if previous is None:
        return MerkleDiff(added=sorted(current.modules), modified=[], removed=[])

    prev_ids = set(previous.modules)
    cur_ids = set(current.modules)
    added = sorted(cur_ids - prev_ids)
    removed = sorted(prev_ids - cur_ids)
    modified = sorted(
        module_id
        for module_id in (cur_ids & prev_ids)
        if current.modules[module_id].hash != previous.modules[module_id].hash
    )
    return MerkleDiff(added=added, modified=modified, removed=removed)


def save_snapshot(tree: MerkleTree, path: Path) -> None:
    """Persist ``tree`` to ``path`` as JSON (creating parent dirs)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(tree.to_dict(), indent=2, sort_keys=True), encoding="utf-8"
    )


def load_snapshot(path: Path) -> MerkleTree | None:
    """Load a previously saved tree, or ``None`` if missing/unreadable/stale.

    Returns ``None`` (rather than raising) on a missing file, malformed JSON,
    or a snapshot written by a different :data:`SNAPSHOT_VERSION`, so callers
    transparently fall back to a full rebuild.
    """
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError) as exc:
        logger.warning("Ignoring unreadable merkle snapshot %s: %s", path, exc)
        return None
    if not isinstance(data, dict) or data.get("version") != SNAPSHOT_VERSION:
        logger.info("Discarding merkle snapshot %s: schema version mismatch", path)
        return None
    return MerkleTree.from_dict(data)

```

### Core Architecture Module: `engine/repobrain_engine/hub/_providers.py`
```
"""Multi-provider LLM failover for the Knowledge Hub.

The hub talks to a single OpenAI-compatible endpoint by default
(``OPENAI_BASE_URL`` / ``OPENAI_API_KEY`` / ``OPENAI_MODEL``).  When that
endpoint suffers a *sustained* outage, same-provider retries cannot help —
every retry hits the same dead host.  This module adds an opt-in ordered
list of backup providers (``RB_LLM_FALLBACKS``) plus a wrapper that re-runs
an operation against the next provider when the active one keeps failing
with a transient/provider error.

Behaviour is unchanged when ``RB_LLM_FALLBACKS`` is unset: the chain holds
exactly one provider and the wrapper is a pass-through with no environment
mutation.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass
from typing import TYPE_CHECKING, Awaitable, Callable, TypeVar

if TYPE_CHECKING:
    from repobrain_engine.config import Settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Substrings (lower-cased) that mark an error as a transient provider failure.
# Kept as the single source of truth for both the retry path and failover.
_RETRYABLE_KEYWORDS = (
    "timeout",
    "gateway time-out",
    "504",
    "connection",
    "network",
    "unreachable",
    "refused",
    "rate limit",
    "ratelimit",
    "429",
    "502",
    "503",
    "500",
    "serviceunavailable",
    "service unavailable",
    "service temporarily unavailable",
    "temporarily unavailable",
    "bad gateway",
    "internalservererror",
    "internal server error",
)


def is_retryable_provider_error(exc: Exception) -> bool:
    """Return True for transient model/provider failures worth retrying.

    LiteLLM often wraps a provider 503 in an exception whose text preserves
    the wording ("Service temporarily unavailable") but not the numeric
    code, so the classifier matches on both.
    """
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
        return True
    msg = f"{type(exc).__module__}.{type(exc).__name__}: {exc}".lower()
    return any(keyword in msg for keyword in _RETRYABLE_KEYWORDS)


@dataclass(frozen=True)
class ProviderConfig:
    """One LLM endpoint: an OpenAI-compatible base URL, key, and model."""

    model: str
    base_url: str = ""
    api_key: str = ""
    label: str = "primary"


def get_provider_chain(settings: "Settings") -> list[ProviderConfig]:
    """Build the ordered provider list: primary first, then fallbacks.

    The primary comes from the ``OPENAI_*`` settings.  Fallbacks are parsed
    from the ``RB_LLM_FALLBACKS`` env var — a JSON array of objects with
    optional ``base_url`` / ``api_key`` / ``model`` / ``label`` keys; a
    missing ``api_key`` or ``model`` inherits the primary's value.  A
    malformed value degrades to the primary alone and never breaks the
    default path.
    """
    primary = ProviderConfig(
        model=settings.OPENAI_MODEL,
        base_url=settings.OPENAI_BASE_URL,
        api_key=settings.OPENAI_API_KEY,
        label="primary",
    )
    chain = [primary]

    raw = os.environ.get("RB_LLM_FALLBACKS", "").strip()
    if not raw:
        return chain

    try:
        entries = json.loads(raw)
    except (ValueError, TypeError) as exc:
        logger.warning("Ignoring invalid RB_LLM_FALLBACKS (not JSON): %s", exc)
        return chain
    if not isinstance(entries, list):
        logger.warning("Ignoring RB_LLM_FALLBACKS: expected a JSON array")
        return chain

    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            logger.warning("Skipping non-object RB_LLM_FALLBACKS entry #%d", idx)
            continue
        model = str(entry.get("model") or primary.model).strip()
        if not model:
            logger.warning("Skipping RB_LLM_FALLBACKS entry #%d: empty model", idx)
            continue
        chain.append(
            ProviderConfig(
                model=model,
                base_url=str(entry.get("base_url") or "").strip(),
                api_key=str(entry.get("api_key") or primary.api_key),
                label=str(entry.get("label") or f"fallback{idx + 1}"),
            )
        )
    return chain


def activate_provider(provider: ProviderConfig) -> None:
    """Make ``provider`` the active LLM endpoint for subsequent agent calls.

    Sets the ``OPENAI_*`` environment variables and resets the cached
    settings so the next ``get_settings()`` / ``create_model()`` resolves to
    this provider.  ``litellm`` reads these at request time, so even
    already-built agents pick up the change on their next call.
    """
    from repobrain_engine.config import reset_settings

    os.environ["OPENAI_BASE_URL"] = provider.base_url or ""
    if provider.api_key:
        os.environ["OPENAI_API_KEY"] = provider.api_key
    os.environ["OPENAI_MODEL"] = provider.model
    reset_settings()


async def run_with_provider_failover(
    operation: Callable[[], Awaitable[T]],
    *,
    providers: list[ProviderConfig],
    is_retryable: Callable[[Exception], bool] | None = None,
    label: str = "operation",
) -> T:
    """Run ``operation`` against each provider until one succeeds.

    With a single provider the behaviour is unchanged: the operation runs
    once and the environment is left untouched.  With fallbacks configured, a
    transient/provider failure (per ``is_retryable``) on the active provider
    triggers a switch to the next provider and a full re-run.  A
    non-retryable error is raised immediately without failing over.
    """
    if is_retryable is None:
        is_retryable = is_retryable_provider_error

    # No fallback configured: preserve the exact default behaviour.
    if len(providers) <= 1:
        return await operation()

    last_exc: Exception | None = None
    for idx, provider in enumerate(providers):
        activate_provider(provider)
        try:
            return await operation()
        except Exception as exc:  # noqa: BLE001 — re-raised below unless we fail over
            last_exc = exc
            is_last = idx >= len(providers) - 1
            if is_last or not is_retryable(exc):
                raise
            raw_msg = str(exc).replace("\n", " ").replace("\r", "")[:150]
            next_label = providers[idx + 1].label
            print(
                f"  ⚠ Provider '{provider.label}' failed for {label}: "
                f"{raw_msg or type(exc).__name__}. "
                f"Failing over to '{next_label}'...",
                file=sys.stderr,
            )

    # Unreachable: the loop returns on success or raises on the last provider.
    assert last_exc is not None
    raise last_exc

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #27** (2026-03-09): **Self-edit prompt contamination / Self-edit 场景下的 prompt 污染**
  *Symptoms*: Problem / 问题  This project is meant to be a scaffold for AI coding tools. However, when the AI tool is used to modify itself, its existing prompts, identity presets, and behavior rules can leak into the editing process.  这个项目本来是一个 AI 编程工具脚手架。 但当我用这个 AI 工具去修改它自己时，已有的 prompt、身份设定和行为规则会反向污染修改过程。  Impact / 影响  This mixes two modes that should stay separate:  runtime mode: normal product behavior  maintainer mode: development / self-edit behavior  这会把两种本应分离的模式混在一起：  runtime mode：产品正常运行时的模式  maintainer mode：开发 / self-edit 时的模式  Result:  role confusion / 角色混乱  prompt contamination / prompt 污染  unstable self-edit behavior / self-edit 行为不稳定   Goal / 目标  Prevent runtime cognition from contaminating self-edit, so the scaffold remains stable and maintainable.  避免运行时认知污染 self-edit 过程，让脚手架保持稳定、可维护。
  **Post-Mortem & Fix Analysis**:
  > 通过研究OpenAI官方的攻略，包括codex agent sdk ，OpenAI关于大项目的处理，会缓解这一点

- **Issue #19** (2026-01-30): **ModuleNotFoundError: No module named 'google'**
  *Symptoms*: if i run the agent.py on a windows systems (install.bat had run successfull):  src\agent.py", line 16, in <module>     from google import genai ModuleNotFoundError: No module named 'google'
  **Post-Mortem & Fix Analysis**:
  > you should activated your environment first  `source venv/bin/activate` 
  > Hey following feedback from the install.bat:  Next steps: 1. Configure your API keys in .env file:    notepad .env  2. The virtual environment is already activated.  3. Run the agent:    python src/agent.py  if i run source venv/bin/activate i getting following error: In Zeile:1 Zeichen:1 + source venv/bin/activate + ~~~~~~     + CategoryInfo          : ObjectNotFound: (source:String) [], CommandNotFoundException     + FullyQualifiedErrorId : CommandNotFoundException
  > Thanks for the report. I’ll reproduce this issue locally and investigate the root cause. I’ll update here once I have a solution.  > Hey following feedback from the install.bat:嗨，听从 install.bat 的反馈： >  > Next steps:  下一步： >  > 1. Configure your API keys in .env file:在 .env 文件中配置你的 API 密钥： >    notepad .env > 2. The virtual environment is already activated.虚拟环境已经激活。 > 3. Run the agent:  运行代理： >    python src/agent.py >  > if i run source venv/bin/activate i getting following error:如果我运行 Source Venv/Bin/Activate，我会收到以下错误： In Zeile:1 Zeichen:1  在线：1 角色：1 >  > * source venv/bin/activate来源：venv/bin/activate > * ``` >     + CategoryInfo          : ObjectNotFound: (source:String) [], CommandNotFoundException >     + FullyQualifiedErrorId : CommandNotFoundException >   ```  

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

### Incident Patch 1: `aefb94d1` (2026-08-27)
**Commit Message**: docs: fix documentation inaccuracies flagged by Codex in PR #115 (#117)

* docs: fix documentation inaccuracies flagged by Codex in PR #115

Fix all seven documentation inaccuracies across en/zh/es docs:

1. Generic host runner: Add required RB_HOST_COMMAND example
   - Show concrete trae-cli template instead of claiming generic is drop-in
   - SWARM_PROTOCOL.md: Configuration section

2. Ask fallback order: Correct pipeline flow description
   - Document actual code behavior: host-runner bypasses swarm entirely
   - Structured facts path tries agent.md then legacy-facts internally
   - SWARM_PROTOCOL.md: Fallback Strategy section

3. Remove non-existent RB_LOG_LEVEL env var
   - No such env var exists in engine or CLI
   - SWARM_PROTOCOL.md: Example 3 debugging section

4. Remove .repobrain/config.json ignore pattern advice
   - No reader/schema exists for this file
   - Scan exclusions are hard-coded in hub/scanner.py
   - SWARM_PROTOCOL.md: Performance Tips section

5. Fix Phase 9 status conflict in ROADMAP.md
   - Mark Phase 9 as completed with productization achievements
   - Relabel future ideas (sandbox, DAG, fleet, observability) as extensions
   - ROADMAP.md: Phase 9 secti

**File**: `docs/en/ROADMAP.md` (modified, +14/-15)
```diff
@@ -99,19 +99,18 @@ one IDE.
 
 **Implemented by:** [@devalexanderdaza](https://github.com/devalexanderdaza)
 
-## 🚀 Phase 9: Enterprise Core (In Progress)
+## 🚀 Phase 9: Enterprise Core (Completed with Future Extensions)
 
-**Goal**: Transform RepoBrain from a workspace into an autonomous **Agent Operating System**
+**Completed:** 2025
 
-The final vision is a production-grade system where enterprises can:
-- 🏗️ Build agents declaratively
-- 🚀 Deploy at global scale
-- 🔒 Execute code safely in sandboxes
-- 🧪 Orchestrate complex workflows
-- 📊 Monitor and observe at scale
-- 💾 Persist state and history
+**Productized Achievements:**
+- Safety boundaries and model selection controls
+- Observability through `rb report`, status tracking, and structured logs
+- Deployment polish: host-runner backend, incremental refresh, stable CLI
 
-### Phase 9A: Sandbox Environment 🔒
+The core phase is complete. Below are **future extension ideas** (not currently in-progress) that would build on this foundation:
+
+### Future Extension: Sandbox Environment 🔒
 **Objective**: Safe, isolated code execution for high-risk operations
 
 **Proposed Solutions:**
@@ -138,7 +137,7 @@ result = sandbox.execute(
 - ✅ Cost-efficient resource scaling
 - ✅ Compliance with security policies
 
-### Phase 9B: Orchestrated Flows 🔀
+### Future Extension: Orchestrated Flows 🔀
 **Objective**: Complex, structured task pipelines with DAG support
 
 **Proposed Architecture:**
@@ -185,7 +184,7 @@ steps:
 - 📈 Real-time monitoring and observability
 - 🎯 Composable, reusable workflows
 
-### Phase 9C: Distributed Agent Fleet 🌍
+### Future Extension: Distributed Agent Fleet 🌍
 **Objective**: Multi-agent coordination across regions
 
 **Planned Features:**
@@ -195,8 +194,8 @@ steps:
 - **Load Balancing**: Intelligent task distribution
 - **Failover**: Automatic agent replacement
 
-### Phase 9D: Observability & Monitoring 📊
-**Objective**: Production-grade observability
+### Future Extension: Observability & Monitoring 📊
+**Objective**: Production-grade observability beyond current status tracking
 
 **Planned Components:**
 - **Metrics**: Agent performance, tool usage, success rates
@@ -205,7 +204,7 @@ steps:
 - **Alerts**: Anomaly detection and alerting
 - **Dashboards**: Real-time agent health monitoring
 
-### Phase 9E: Enterprise Integrations 🔗
+### Future Extension: Enterprise Integrations 🔗
 **Objective**: Out-of-the-box enterprise connectors
 
 **Target Integrations:**
```

**File**: `docs/en/SWARM_PROTOCOL.md` (modified, +39/-12)
```diff
@@ -72,6 +72,8 @@ Keeps it under 300 words, outputs ONLY Markdown content.
 
 When no API key is configured (`RB_HOST_RUNNER` set to `codex` or `generic`), Refresh uses a single-turn, tool-free Convention Agent (`build_single_turn_convention_agent()`) that collapses the three-stage chain into one generation.
 
+**Important:** Host-runner mode for refresh is single-turn only. It does not use the full three-agent handoff chain.
+
 ## 💬 Ask Swarm: Dynamic Module Router
 
 When you run `rb-ask "question"`, the Ask Swarm routes your question to the relevant module's agent and returns an answer with file paths and line numbers.
@@ -115,11 +117,11 @@ graph TD
 **Responsibility:** Deep knowledge of a specific module
 
 Each module gets its own agent with:
-- Module's structured facts (JSON claims + source evidence)
+- Module's agent knowledge (`agents/*.md` — grouped module summaries or legacy `modules/*.md`)
 - Tools to explore code (read_file, search_code, etc.)
 - Ability to hand off to other ModuleAgents for cross-module information
 
-ModuleAgents are created dynamically based on the project scan (one agent per detected module).
+ModuleAgents are created dynamically in the legacy swarm path (one agent per detected module). When structured artifacts exist, the ask pipeline uses `_ask_with_agent_md` instead, which routes directly via `map.md` without building the full swarm.
 
 #### 📜 GitAgent
 **Responsibility:** Git history and change analysis
@@ -136,13 +138,29 @@ Handles questions about:
 - **Pipeline:** `engine/repobrain_engine/hub/ask_pipeline.py`
 - **Knowledge:** Reads from generation directory pointed to by `.repobrain/current.json`
 
+### Host-Runner Mode (No Multi-Agent Routing)
+
+When `RB_HOST_RUNNER` is set (`codex` or `generic`), Ask uses `_ask_with_host_runner` exclusively:
+- **Single local CLI invocation** with project context and question
+- Does **not** build Router/ModuleAgent/GitAgent or perform multi-agent handoffs
+- Returns direct answer from the local host CLI (no swarm orchestration)
+
+Users of the no-API-key path must understand that they get a single-turn local answer, not the full Router-Worker collaboration.
+
 ### Fallback Strategy
 
-The ask pipeline implements a three-tier fallback mechanism:
+The ask pipeline implements a context-sensitive fallback mechanism:
+
+**When `RB_HOST_RUNNER` is set** (codex or generic):
+- Uses `_ask_with_host_runner` exclusively
+- Does not build Router/ModuleAgent/GitAgent
+- Single local CLI invocation with no multi-agent routing
 
-1. **`_ask_with_structured_facts`** — Uses structured facts (JSON claims + source verification)
-2. **`_ask_with_agent_md`** — Falls back to agent.md files (plain text knowledge)
-3. **`_ask_with_legacy_swarm`** — Final fallback (if both fail)
+**Standard API-based ask flow:**
+1. **`_ask_with_structured_facts`** (when `.repobrain/map.md` and `agents/*.md` exist):
+   - First tries `_ask_with_agent_md` — Routes via map.md to agent.md knowledge
+   - Falls back to `_ask_with_legacy_facts` within the same call — Uses legacy `*.facts.json` if available
+2. **`_ask_with_legacy_swarm`** — Final fallback when structured artifacts return no answer
 
 This ensures ask functionality remains available even if knowledge base is partially generated or uses older formats.
 
@@ -157,7 +175,13 @@ This ensures ask functionality remains available even if knowledge base is parti
 
 2. **Host-runner (no API key):**
    ```bash
-   export RB_HOST_RUNNER=codex  # or generic
+   # Codex preset (built-in configuration)
+   export RB_HOST_RUNNER=codex
+   
+   # Generic runner (requires RB_HOST_COMMAND template)
+   export RB_HOST_RUNNER=generic
+   export RB_HOST_COMMAND='trae-cli exec --cd {workspace} --sandbox read-only --skip-git-repo-check --ephemeral -o {output_file}'
+   export RB_HOST_OUTPUT_MODE=file
    # Uses logged-in IDE CLI, no API key needed
    ```
 
@@ -219,11 +243,14 @@ rb-ask "What changed in the auth module?"
 ### Example 3: Debugging Usage
 
 ```bash
-# Refresh with debug logging
-RB_LOG_LEVEL=DEBUG rb-refresh
+# Ask with verbose output (streamed progress)
+rb-ask "Where is the database connection?"
 
-# Ask with verbose output
-RB_LOG_LEVEL=DEBUG rb-ask "Where is the database connection?"
+# Check refresh status
+rb report
+
+# Force full refresh (non-incremental)
+rb-refresh  # without --quick
 ```
 
 ## 🐛 Troubleshooting
@@ -272,7 +299,7 @@ MCP server implementation: `engine/repobrain_engine/hub/mcp_server.py`
 
 ### Speed Up Refresh
 - Use `--quick` for incremental updates (clean worktree after commit)
-- Exclude unnecessary directories (configure ignore patterns in `.repobrain/config.json`)
+- Scan exclusions are built-in (venv, node_modules, .git, etc. — see `SKIP_DIRS` in `engine/repobrain_engine/hub/_constants.py`)
 - Use faster models (e.g., GPT-4o-mini or Claude 3.5 Haiku)
 
 ### Improve Answer Quality
```

**File**: `docs/es/SWARM_PROTOCOL.md` (modified, +39/-12)
```diff
@@ -72,6 +72,8 @@ Lo mantiene bajo 300 palabras, genera SOLO contenido Markdown.
 
 Cuando no hay API key configurada (`RB_HOST_RUNNER` establecido en `codex` o `generic`), Refresh usa un Agente de Convenciones de turno único sin herramientas (`build_single_turn_convention_agent()`) que colapsa la cadena de tres etapas en una sola generación.
 
+**Importante:** El modo host-runner para refresh es de turno único solamente. No usa la cadena completa de handoff de tres agentes.
+
 ## 💬 Ask Swarm: Enrutador de Módulos Dinámico
 
 Cuando ejecutas `rb-ask "pregunta"`, el Ask Swarm enruta tu pregunta al agente del módulo relevante y devuelve una respuesta con rutas de archivo y números de línea.
@@ -115,11 +117,11 @@ graph TD
 **Responsabilidad:** Conocimiento profundo de un módulo específico
 
 Cada módulo obtiene su propio agente con:
-- Facts estructurados del módulo (claims JSON + evidencia de fuente)
+- Conocimiento del agente del módulo (`agents/*.md` — resúmenes de módulos agrupados o `modules/*.md` heredado)
 - Herramientas para explorar código (read_file, search_code, etc.)
 - Capacidad de pasar el control a otros ModuleAgents para información entre módulos
 
-Los ModuleAgents se crean dinámicamente basados en el escaneo del proyecto (un agente por módulo detectado).
+Los ModuleAgents se crean dinámicamente en el camino de swarm heredado (un agente por módulo detectado). Cuando existen artefactos estructurados, el pipeline ask usa `_ask_with_agent_md` en su lugar, que enruta directamente vía `map.md` sin construir el swarm completo.
 
 #### 📜 GitAgent
 **Responsabilidad:** Historial de Git y análisis de cambios
@@ -136,13 +138,29 @@ Maneja preguntas sobre:
 - **Pipeline:** `engine/repobrain_engine/hub/ask_pipeline.py`
 - **Conocimiento:** Lee del directorio de generación apuntado por `.repobrain/current.json`
 
+### Modo Host-Runner (Sin Enrutamiento Multi-Agente)
+
+Cuando `RB_HOST_RUNNER` está configurado (`codex` o `generic`), Ask usa `_ask_with_host_runner` exclusivamente:
+- **Invocación CLI local única** con contexto del proyecto y pregunta
+- **No** construye Router/ModuleAgent/GitAgent ni realiza handoffs multi-agente
+- Devuelve respuesta directa del CLI local (sin orquestación de swarm)
+
+Los usuarios del modo sin API key deben entender que reciben una respuesta local de turno único, no la colaboración completa Router-Worker.
+
 ### Estrategia de Fallback
 
-El pipeline de ask implementa un mecanismo de fallback de tres niveles:
+El pipeline de ask implementa un mecanismo de fallback sensible al contexto:
+
+**Cuando `RB_HOST_RUNNER` está configurado** (codex o generic):
+- Usa `_ask_with_host_runner` exclusivamente
+- No construye Router/ModuleAgent/GitAgent
+- Invocación CLI local única sin enrutamiento multi-agente
 
-1. **`_ask_with_structured_facts`** — Usa facts estructurados (claims JSON + verificación de fuente)
-2. **`_ask_with_agent_md`** — Recurre a archivos agent.md (conocimiento en texto plano)
-3. **`_ask_with_legacy_swarm`** — Fallback final (si ambos fallan)
+**Flujo ask estándar basado en API:**
+1. **`_ask_with_structured_facts`** (cuando `.repobrain/map.md` y `agents/*.md` existen):
+   - Primero intenta `_ask_with_agent_md` — Enruta vía map.md al conocimiento de agent.md
+   - Recurre a `_ask_with_legacy_facts` dentro de la misma llamada — Usa `*.facts.json` heredado si está disponible
+2. **`_ask_with_legacy_swarm`** — Fallback final cuando los artefactos estructurados no devuelven respuesta
 
 Esto asegura que la funcionalidad ask permanezca disponible incluso si la base de conocimiento está parcialmente generada o usa formatos antiguos.
 
@@ -157,7 +175,13 @@ Esto asegura que la funcionalidad ask permanezca disponible incluso si la base d
 
 2. **Host-runner (sin API key):**
    ```bash
-   export RB_HOST_RUNNER=codex  # o generic
+   # Preset Codex (configuración incorporada)
+   export RB_HOST_RUNNER=codex
+   
+   # Generic runner (requiere plantilla RB_HOST_COMMAND)
+   export RB_HOST_RUNNER=generic
+   export RB_HOST_COMMAND='trae-cli exec --cd {workspace} --sandbox read-only --skip-git-repo-check --ephemeral -o {output_file}'
+   export RB_HOST_OUTPUT_MODE=file
    # Usa IDE CLI con sesión iniciada, no se necesita API key
    ```
 
@@ -219,11 +243,14 @@ rb-ask "¿Qué cambió en el módulo auth?"
 ### Ejemplo 3: Uso de Depuración
 
 ```bash
-# Actualizar con logging de depuración
-RB_LOG_LEVEL=DEBUG rb-refresh
+# Preguntar con salida verbosa (progreso en streaming)
+rb-ask "¿Dónde está la conexión de base de datos?"
 
-# Preguntar con salida verbosa
-RB_LOG_LEVEL=DEBUG rb-ask "¿Dónde está la conexión de base de datos?"
+# Verificar estado de actualización
+rb report
+
+# Forzar actualización completa (no incremental)
+rb-refresh  # sin --quick
 ```
 
 ## 🐛 Solución de Problemas
@@ -272,7 +299,7 @@ Implementación del servidor MCP: `engine/repobrain_engine/hub/mcp_server.py`
 
 ### Acelerar Actualización
 - Usar `--quick` para actualizaciones incrementales (árbol de tr
```

**File**: `docs/zh/ROADMAP.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ RepoBrain 正收敛为一个可移植的 repository knowledge engine：把 works
 | 6 动态发现 | 完成 | 工具/上下文零配置加载 |
 | 7 Multi-Agent Swarm | 完成 | Router-Worker 编排 |
 | 8 MCP 集成 | 完成 | MCP server / consumer 支持 |
-| 9 产品化加固 | 进行中 | 安全边界、可观测、安装与文档契约 |
+| 9 产品化加固 | 完成 | 安全边界、可观测、安装与文档契约 |
 | 10 Knowledge Hub | 完成 | 代码库刷新、模块知识、路由式问答 |
 
 ## 已完成的核心功能（截至 2026 年 8 月）
```

**File**: `docs/zh/SWARM_PROTOCOL.md` (modified, +39/-12)
```diff
@@ -72,6 +72,8 @@ graph LR
 
 当没有配置 API key 时（`RB_HOST_RUNNER` 设置为 `codex` 或 `generic`），Refresh 会使用单轮、无工具的 Convention Agent (`build_single_turn_convention_agent()`)，该 Agent 将三阶段链压缩为一次生成。
 
+**重要：** Host-runner 模式的 refresh 仅为单轮。不使用完整的三 Agent handoff 链。
+
 ## 💬 Ask Swarm：动态模块路由
 
 当你运行 `rb-ask "问题"` 时，Ask Swarm 会将问题路由到相关模块的 Agent 并返回带有文件路径和行号的答案。
@@ -115,11 +117,11 @@ graph TD
 **职责：** 负责特定模块的深度知识
 
 每个模块都有自己的 Agent，具有：
-- 模块的结构化 facts（JSON claims + 源码证据）
+- 模块的 agent 知识（`agents/*.md` — 分组模块摘要或旧版 `modules/*.md`）
 - 探索代码的工具（read_file、search_code 等）
 - 可以移交给其他 ModuleAgent 以获取跨模块信息
 
-ModuleAgent 根据项目扫描结果动态创建（每个检测到的模块一个 Agent）。
+ModuleAgent 在旧版 swarm 路径中动态创建（每个检测到的模块一个 Agent）。当结构化工件存在时，ask pipeline 使用 `_ask_with_agent_md`，通过 `map.md` 直接路由，而不构建完整的 swarm。
 
 #### 📜 GitAgent
 **职责：** Git 历史和变更分析
@@ -136,13 +138,29 @@ ModuleAgent 根据项目扫描结果动态创建（每个检测到的模块一
 - **管道：** `engine/repobrain_engine/hub/ask_pipeline.py`
 - **知识库：** 从 `.repobrain/current.json` 指向的生成目录读取
 
+### Host-Runner 模式（无多 Agent 路由）
+
+当设置 `RB_HOST_RUNNER`（`codex` 或 `generic`）时，Ask 仅使用 `_ask_with_host_runner`：
+- **单次本地 CLI 调用**，包含项目上下文和问题
+- **不**构建 Router/ModuleAgent/GitAgent 或执行多 Agent handoff
+- 从本地 host CLI 直接返回答案（无 swarm 编排）
+
+使用无 API key 路径的用户必须理解，他们得到的是单轮本地答案，而非完整的 Router-Worker 协作。
+
 ### 回退策略
 
-Ask pipeline 实现了三层回退机制：
+Ask pipeline 实现了上下文感知的回退机制：
+
+**当设置 `RB_HOST_RUNNER`（codex 或 generic）时：**
+- 仅使用 `_ask_with_host_runner`
+- 不构建 Router/ModuleAgent/GitAgent
+- 单次本地 CLI 调用，无多 Agent 路由
 
-1. **`_ask_with_structured_facts`** — 使用结构化 facts（JSON claims + 源码验证）
-2. **`_ask_with_agent_md`** — 回退到 agent.md 文件（纯文本知识）
-3. **`_ask_with_legacy_swarm`** — 最终回退（如果前两者都失败）
+**标准 API-based ask 流程：**
+1. **`_ask_with_structured_facts`**（当 `.repobrain/map.md` 和 `agents/*.md` 存在时）：
+   - 首先尝试 `_ask_with_agent_md` — 通过 map.md 路由到 agent.md 知识
+   - 在同一调用中回退到 `_ask_with_legacy_facts` — 如可用则使用旧版 `*.facts.json`
+2. **`_ask_with_legacy_swarm`** — 当结构化工件未返回答案时的最终回退
 
 这确保了即使知识库部分生成或使用旧格式，ask 功能仍然可用。
 
@@ -157,7 +175,13 @@ Ask pipeline 实现了三层回退机制：
 
 2. **Host-runner（无 API key）：**
    ```bash
-   export RB_HOST_RUNNER=codex  # 或 generic
+   # Codex 预设（内置配置）
+   export RB_HOST_RUNNER=codex
+   
+   # Generic runner（需要 RB_HOST_COMMAND 模板）
+   export RB_HOST_RUNNER=generic
+   export RB_HOST_COMMAND='trae-cli exec --cd {workspace} --sandbox read-only --skip-git-repo-check --ephemeral -o {output_file}'
+   export RB_HOST_OUTPUT_MODE=file
    # 使用登录的 IDE CLI，无需 API key
    ```
 
@@ -219,11 +243,14 @@ rb-ask "auth 模块有什么变化？"
 ### 示例 3：调试使用
 
 ```bash
-# 带调试日志的刷新
-RB_LOG_LEVEL=DEBUG rb-refresh
+# 带详细输出的问答（流式进度）
+rb-ask "数据库连接在哪里？"
 
-# 带详细输出的问答
-RB_LOG_LEVEL=DEBUG rb-ask "数据库连接在哪里？"
+# 检查刷新状态
+rb report
+
+# 强制完全刷新（非增量）
+rb-refresh  # 不使用 --quick
 ```
 
 ## 🐛 故障排查
@@ -272,7 +299,7 @@ MCP server 实现：`engine/repobrain_engine/hub/mcp_server.py`
 
 ### 加快刷新速度
 - 使用 `--quick` 进行增量更新（提交后的干净工作树）
-- 排除不必要的目录（在 `.repobrain/config.json` 中配置忽略模式）
+- 扫描排除项已内置（venv、node_modules、.git 等 — 参见 `engine/repobrain_engine/hub/_constants.py` 中的 `SKIP_DIRS`）
 - 使用更快的模型（例如 GPT-4o-mini 或 Claude 3.5 Haiku）
 
 ### 提高回答质量
```

---

### Incident Patch 2: `c250a2e0` (2026-08-24)
**Commit Message**: docs: drop --json from agent guidance templates

IDE agents consume rb-ask output as plain text just like a human reading the
terminal, so --json only added noise and token overhead in the guidance while
never being the parser it targets. Remove it from the AGENTS.md and Trae rule
templates; --json stays a real, discoverable advanced option via `rb-ask --help`
and the programmatic note in AI_INSTALL.md.

**File**: `cli/src/rb_cli/templates/.trae/rules/project_rules.md` (modified, +2/-5)
```diff
@@ -11,16 +11,13 @@ first, then load dynamic context from `.repobrain/` (`conventions.md`,
 data flow, onboarding — you MUST run `rb-ask` first:
 
 ```bash
-rb-ask "<question>" --workspace . --json
+rb-ask "<question>" --workspace .
 ```
 
 **Hard rule: do NOT manually `grep`, `rg`, `find`, or fan out file reads to
 answer a broad question before you have run `rb-ask` for it.** It returns an
 answer grounded in real source with file paths and line numbers; start there,
-then open only the specific files it points you to. The `--json` form gives you
-a stable `{answer, sources, limitations, workspace, question}` object; on
-failure stdout stays empty and a `{"error": "..."}` object is written to stderr
-with a non-zero exit code, so you can branch on it cleanly.
+then open only the specific files it points you to.
 
 You do **not** need to run `rb-refresh` by hand: `rb-ask` builds the knowledge
 base itself on first use and rebuilds it when it drifts too far behind HEAD
```

**File**: `cli/src/rb_cli/templates/AGENTS.md` (modified, +0/-13)
```diff
@@ -35,19 +35,6 @@ wasteful and skips the grounded, cross-referenced answer the hub already has.
 `rb-ask` returns an answer backed by real source with file paths and line
 numbers; start there, then open only the specific files it points you to.
 
-If you are an LLM or script calling RepoBrain programmatically (not a human
-reading the terminal), add `--json` to get a stable, parseable envelope instead
-of formatted prose — no need to scrape the text:
-
-```bash
-rb-ask "<question>" --workspace . --json
-# → {"answer": "...", "sources": [...], "limitations": [...],
-#    "workspace": "...", "question": "..."}
-```
-
-On failure with `--json`, stdout stays empty and a `{"error": "..."}` object is
-written to stderr with a non-zero exit code, so callers can branch on it cleanly.
-
 This CLI is the lightweight way to let any agent that can run shell commands
 query RepoBrain — no long-running MCP server required. (An MCP server, `rb-mcp`,
 also exists for MCP-only clients, but the CLI is preferred when you can shell
```

---

### Incident Patch 3: `f9d90ae0` (2026-08-24)
**Commit Message**: fix: stop forcing a model on the local host runner

RepoBrain hardcoded gpt-5.3-codex-spark into every codex `exec` call and the
RB_HOST_MODEL default, so it decided the model even outside the API-key path.
Make --model optional: leave RB_HOST_MODEL empty (new default) to let the CLI
use its own login default; set it only to force a specific model. The generic
runner still ignores model entirely (put any flag in RB_HOST_COMMAND).

**File**: `AI_INSTALL.md` (modified, +2/-1)
```diff
@@ -94,7 +94,8 @@ Check in this order and use the **first** one that is available and logged in:
 
    ```bash
    RB_HOST_RUNNER=codex
-   RB_HOST_MODEL=gpt-5.3-codex-spark
+   # RB_HOST_MODEL is optional; leave it unset to use the codex login's default
+   # model. Set it only to force a specific one, e.g. RB_HOST_MODEL=gpt-5.3-codex-spark
    RB_HOST_TIMEOUT_SECONDS=240
    RB_HOST_MAX_CONTEXT_CHARS=60000
    ```
```

**File**: `INSTALL.md` (modified, +7/-1)
```diff
@@ -69,7 +69,9 @@ which detects your CLI and writes this for you; to configure it by hand, pick yo
 codex login status
 cat >> .env <<'EOF'
 RB_HOST_RUNNER=codex
-RB_HOST_MODEL=gpt-5.3-codex-spark
+# RB_HOST_MODEL is optional. Leave it unset to use the model your codex login
+# defaults to; set it only to force a specific model, e.g.:
+# RB_HOST_MODEL=gpt-5.3-codex-spark
 RB_HOST_TIMEOUT_SECONDS=240
 RB_HOST_MAX_CONTEXT_CHARS=60000
 EOF
@@ -87,6 +89,10 @@ RB_HOST_TIMEOUT_SECONDS=240
 EOF
 ```
 
+The generic runner never picks a model for you (`RB_HOST_MODEL` is ignored). To
+pin a model, add the CLI's own model flag directly to `RB_HOST_COMMAND`
+(e.g. `trae-cli exec --model <name> ...`).
+
 Then:
 
 ```
```

**File**: `engine/repobrain_engine/config.py` (modified, +4/-2)
```diff
@@ -68,8 +68,10 @@ class Settings(BaseSettings):
         description="Experimental local host runner for rb-ask, e.g. 'codex' or 'generic'.",
     )
     RB_HOST_MODEL: str = Field(
-        default="gpt-5.3-codex-spark",
-        description="Model passed to the local host runner (used by the 'codex' runner).",
+        default="",
+        description="Optional model for the 'codex' host runner's --model flag. "
+        "Leave empty to let the CLI use its own default model. Ignored by the "
+        "'generic' runner (put any model flag directly in RB_HOST_COMMAND).",
     )
     RB_HOST_COMMAND: str = Field(
         default="",
```

**File**: `engine/repobrain_engine/hub/host_runner.py` (modified, +23/-13)
```diff
@@ -22,7 +22,6 @@
 from typing import Any
 
 
-DEFAULT_CODEX_HOST_MODEL = "gpt-5.3-codex-spark"
 DEFAULT_HOST_TIMEOUT_SECONDS = 600.0
 DEFAULT_HOST_MAX_CONTEXT_CHARS = 60000
 
@@ -167,13 +166,13 @@ async def run_codex_host_runner(
 def build_codex_command(
     *,
     workspace: Path,
-    model: str,
+    model: str | None,
     schema_path: Path,
     output_path: Path,
     prompt: str,
 ) -> list[str]:
     """Build the ``codex exec`` command for a read-only host-runner ask."""
-    return [
+    cmd = [
         "codex",
         "exec",
         "--cd",
@@ -182,14 +181,17 @@ def build_codex_command(
         "read-only",
         "--ephemeral",
         "--skip-git-repo-check",
-        "--model",
-        model,
+    ]
+    if model:
+        cmd += ["--model", model]
+    cmd += [
         "--output-schema",
         str(schema_path),
         "--output-last-message",
         str(output_path),
         prompt,
     ]
+    return cmd
 
 
 def _run_codex_host_runner_sync(
@@ -209,7 +211,7 @@ def _run_codex_host_runner_sync(
             "`codex login` before using RB_HOST_RUNNER=codex."
         )
 
-    model_name = (model or os.environ.get("RB_HOST_MODEL") or DEFAULT_CODEX_HOST_MODEL).strip()
+    model_name = _resolve_host_model(model)
     timeout = _resolve_timeout(timeout_seconds)
     max_chars = _resolve_max_context_chars(max_context_chars)
 
@@ -615,6 +617,13 @@ def _resolve_timeout(timeout_seconds: float | None) -> float:
     )
 
 
+def _resolve_host_model(model: str | None) -> str | None:
+    """Resolve the codex model from an explicit arg or env; None = let the CLI decide."""
+    resolved = model if model is not None else os.environ.get("RB_HOST_MODEL")
+    resolved = (resolved or "").strip()
+    return resolved or None
+
+
 def _resolve_max_context_chars(max_context_chars: int | None) -> int:
     """Resolve the max prompt size from an explicit arg or env fallback."""
     return _coerce_int(
@@ -649,12 +658,12 @@ def _redact_secrets(text: str) -> str:
 def build_codex_text_command(
     *,
     workspace: Path,
-    model: str,
+    model: str | None,
     output_path: Path,
     prompt: str,
 ) -> list[str]:
     """Build ``codex exec`` for a read-only free-form text generation."""
-    return [
+    cmd = [
         "codex",
         "exec",
         "--cd",
@@ -663,12 +672,15 @@ def build_codex_text_command(
         "read-only",
         "--ephemeral",
         "--skip-git-repo-check",
-        "--model",
-        model,
+    ]
+    if model:
+        cmd += ["--model", model]
+    cmd += [
         "--output-last-message",
         str(output_path),
         prompt,
     ]
+    return cmd
 
 
 def run_host_text_generation(
@@ -702,9 +714,7 @@ def run_host_text_generation(
                 "Codex CLI is not installed or not on PATH. Install Codex CLI and run "
                 "`codex login` before using RB_HOST_RUNNER=codex."
             )
-        model_name = (
-            model or os.environ.get("RB_HOST_MODEL") or DEFAULT_CODEX_HOST_MODEL
-        ).strip()
+        model_name = _resolve_host_model(model)
         with tempfile.TemporaryDirectory(prefix="rb-host-runner-") as tmp_dir:
             output_path = Path(tmp_dir) / "codex_host_text.txt"
             cmd = build_codex_text_command(
```

**File**: `engine/tests/test_host_runner.py` (modified, +52/-0)
```diff
@@ -13,6 +13,7 @@
     HostRunnerError,
     HostRunnerModel,
     build_codex_command,
+    build_codex_text_command,
     build_generic_command,
     is_host_runner_enabled,
     is_host_runner_model,
@@ -48,6 +49,57 @@ def test_codex_command_constructs_read_only_exec(tmp_path: Path) -> None:
     assert cmd[-1] == "answer this"
 
 
+def test_codex_command_omits_model_when_none(tmp_path: Path) -> None:
+    schema_path = tmp_path / "schema.json"
+    output_path = tmp_path / "answer.json"
+
+    cmd = build_codex_command(
+        workspace=tmp_path,
+        model=None,
+        schema_path=schema_path,
+        output_path=output_path,
+        prompt="answer this",
+    )
+
+    assert "--model" not in cmd
+    assert cmd[:2] == ["codex", "exec"]
+    assert cmd[cmd.index("--sandbox") + 1] == "read-only"
+    assert cmd[cmd.index("--output-schema") + 1] == str(schema_path)
+    assert cmd[cmd.index("--output-last-message") + 1] == str(output_path)
+    assert cmd[-1] == "answer this"
+
+
+def test_codex_text_command_includes_model_when_set(tmp_path: Path) -> None:
+    output_path = tmp_path / "text.txt"
+
+    cmd = build_codex_text_command(
+        workspace=tmp_path,
+        model="gpt-5.3-codex-spark",
+        output_path=output_path,
+        prompt="write docs",
+    )
+
+    assert cmd[cmd.index("--model") + 1] == "gpt-5.3-codex-spark"
+    assert cmd[cmd.index("--output-last-message") + 1] == str(output_path)
+    assert cmd[-1] == "write docs"
+
+
+def test_codex_text_command_omits_model_when_none(tmp_path: Path) -> None:
+    output_path = tmp_path / "text.txt"
+
+    cmd = build_codex_text_command(
+        workspace=tmp_path,
+        model=None,
+        output_path=output_path,
+        prompt="write docs",
+    )
+
+    assert "--model" not in cmd
+    assert cmd[:2] == ["codex", "exec"]
+    assert cmd[cmd.index("--output-last-message") + 1] == str(output_path)
+    assert cmd[-1] == "write docs"
+
+
 @pytest.mark.asyncio
 async def test_missing_codex_cli_has_clear_error(tmp_path: Path, monkeypatch) -> None:
     monkeypatch.setattr("shutil.which", lambda _: None)
```

---

### Incident Patch 4: `9e0a954e` (2026-08-24)
**Commit Message**: fix: raise host-runner call timeout to 600s

Each per-module Trae host-runner call was capped at 240s, forcing large
module groups (e.g. server_biz with 19 groups) to hit the ceiling and fall
back on the first full build. Bump the default to 600s so single-shot waits
complete within budget.

**File**: `engine/repobrain_engine/config.py` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ class Settings(BaseSettings):
         "'file' (the {output_file}) or 'stdout'.",
     )
     RB_HOST_TIMEOUT_SECONDS: float = Field(
-        default=240.0,
+        default=600.0,
         description="Timeout in seconds for local host runner calls.",
     )
     RB_HOST_MAX_CONTEXT_CHARS: int = Field(
```

**File**: `engine/repobrain_engine/hub/host_runner.py` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
 
 
 DEFAULT_CODEX_HOST_MODEL = "gpt-5.3-codex-spark"
-DEFAULT_HOST_TIMEOUT_SECONDS = 240.0
+DEFAULT_HOST_TIMEOUT_SECONDS = 600.0
 DEFAULT_HOST_MAX_CONTEXT_CHARS = 60000
 
 #: Host runners recognized by ``rb-ask``. ``codex`` is a built-in preset;
```

---

### Incident Patch 5: `ffcc7a32` (2026-08-24)
**Commit Message**: docs: make AI-install a one-line copy-paste command in Quick Start

Replace the "open AI_INSTALL.md" pointer with a single copy-paste line
that instructs the AI to read the full AI_INSTALL.md URL and install
RepoBrain — so users command their AI directly instead of reading a doc.

**File**: `README.md` (modified, +6/-6)
```diff
@@ -67,13 +67,13 @@
 > [Head-to-head benchmark ↓](#head-to-head-eval-repobrain-vs-codex-cli-vs-claude-code-2026-05-09)
 > Codex CLI users — drop the `repobrain:` prefix; the same four slash commands ship there too.
 
-### 🧠 Already using an AI IDE? Let it install RepoBrain for you — no API key.
+### 🧠 Fastest start — let your AI install it for you (no API key)
 
-If you use Trae / Cursor / Claude Code / Codex (and it's logged in), you don't need to touch
-pip or an API key. **Paste [`AI_INSTALL.md`](AI_INSTALL.md) to your AI assistant and say
-"install RepoBrain in this project by following it."** It detects your logged-in CLI, wires up
-a zero-key backend, initializes the project, and self-tests — then you just ask it anything
-about your codebase.
+Already in a logged-in AI IDE (Trae / Cursor / Claude Code / Codex)? Don't touch pip or an API key — **paste this one line to your AI assistant** and it does the rest (detects your logged-in CLI, wires up a zero-key backend, initializes the project, self-tests):
+
+> Read https://github.com/study8677/repobrain/blob/main/AI_INSTALL.md and follow it to install RepoBrain in this project.
+
+Then just ask your AI anything about your codebase.
 
 ---
 
```

**File**: `README_CN.md` (modified, +6/-4)
```diff
@@ -54,11 +54,13 @@
 
 **与 Codex CLI 和 Claude Code 在三个真实 Python 仓库（`fastapi`、`requests`、`sqlmodel`）上做了 36 道题的三方对决——RepoBrain 事实题 99%、审计题 97%，事实题速度比 Codex 快 2.1×。** [查看对比](#三方对决repobrain-vs-codex-cli-vs-claude-code2026-05-09)
 
-### 🧠 已经在用 AI IDE？让它帮你装 RepoBrain —— 无需 API key。
+### 🧠 最快上手 —— 让你的 AI 帮你装（无需 API key）
 
-如果你在用 Trae / Cursor / Claude Code / Codex（且已登录），你**不用碰 pip，也不用 API key**。
-**把 [`AI_INSTALL.md`](AI_INSTALL.md) 整段贴给你的 AI 助手，说"照着它在这个项目里装好 RepoBrain"。**
-它会探测你已登录的 CLI、配好零-key 后端、初始化项目并自测——之后你直接问它关于代码库的任何问题即可。
+已经在用登录好的 AI IDE（Trae / Cursor / Claude Code / Codex）？不用碰 pip，也不用 API key ——**把下面这一句话贴给你的 AI 助手**，剩下的它全包（探测你已登录的 CLI、配好零-key 后端、初始化项目、自测）：
+
+> 阅读 https://github.com/study8677/repobrain/blob/main/AI_INSTALL.md 并照着它在这个项目里装好 RepoBrain。
+
+之后直接问你的 AI 关于代码库的任何问题即可。
 
 ```
 传统做法：                           RepoBrain 做法：
```

---

### Incident Patch 6: `fdd2004f` (2026-07-17)
**Commit Message**: build(deps): update openai-agents requirement in /engine

Updates the requirements on [openai-agents](https://github.com/openai/openai-agents-python) to permit the latest version.
- [Release notes](https://github.com/openai/openai-agents-python/releases)
- [Changelog](https://github.com/openai/openai-agents-python/blob/main/docs/release.md)
- [Commits](https://github.com/openai/openai-agents-python/compare/v0.12.0...v0.18.3)

---
updated-dependencies:
- dependency-name: openai-agents
  dependency-version: 0.18.3
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `engine/pyproject.toml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ dependencies = [
     "python-dotenv>=1.0,<2",
     "requests>=2.33.0,<3",
     "mcp[cli]>=1.0.0,<2",
-    "openai-agents[litellm]>=0.12,<0.18",
+    "openai-agents[litellm]>=0.12,<0.19",
     "tomli>=2.0,<3; python_version < \"3.11\"",
 ]
 
```

---

### Incident Patch 7: `c9cba3a5` (2026-07-10)
**Commit Message**: Merge pull request #99 from leisen6688/codex/fix-quick-scan-worktree-paths

Fix quick scans for working tree and non-ASCII paths

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
       "name": "repobrain",
       "source": "./",
       "description": "Repository knowledge engine: CLI-backed slash commands (rb-setup / rb-init / rb-refresh / rb-ask) for both Claude Code and Codex CLI, agent-repo-init skill, and optional MCP server.",
-      "version": "0.3.1",
+      "version": "0.3.2",
       "category": "developer-tools",
       "keywords": ["mcp", "knowledge-graph", "multi-agent", "scaffolding"]
     }
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "repobrain",
-  "version": "0.3.1",
+  "version": "0.3.2",
   "description": "Repository knowledge engine plugin. Bundles CLI-backed slash commands (rb-setup / rb-init / rb-refresh / rb-ask) plus the agent-repo-init skill. Works in both Claude Code and Codex CLI.",
   "author": {
     "name": "RepoBrain Team",
```

**File**: `.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "repobrain",
-  "version": "0.3.1",
+  "version": "0.3.2",
   "description": "Repository knowledge engine plugin (Codex CLI). Bundles slash commands (/rb-setup, /rb-init, /rb-refresh, /rb-ask) plus the agent-repo-init skill. Backed by the rb-ask / rb-refresh CLI; MCP optional.",
   "skills": "./skills/",
   "interface": {
```

**File**: `engine/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "repobrain-engine"
-version = "0.3.1"
+version = "0.3.2"
 description = "Repository knowledge engine with grounded Q&A and optional MCP server"
 requires-python = ">=3.10"
 dependencies = [
```

**File**: `engine/repobrain_engine/__init__.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 from repobrain_engine.config import Settings
 
-__version__ = "0.3.1"
+__version__ = "0.3.2"
 
 __all__ = [
     "Settings",
```

**File**: `engine/repobrain_engine/hub/scanner.py` (modified, +35/-3)
```diff
@@ -889,16 +889,48 @@ def quick_scan(root: Path, since_sha: str) -> ScanReport:
 
     try:
         result = subprocess.run(
-            ["git", "diff", "--name-only", since_sha, "HEAD"],
+            [
+                "git",
+                "diff",
+                "--name-only",
+                "-z",
+                "--no-renames",
+                "--relative",
+                since_sha,
+                "--",
+                ".",
+            ],
             capture_output=True,
-            text=True,
             cwd=str(root),
             check=False,
         )
         if result.returncode != 0:
             return full_scan(root)
 
-        changed_files = [f.strip() for f in result.stdout.splitlines() if f.strip()]
+        untracked_result = subprocess.run(
+            [
+                "git",
+                "ls-files",
+                "--others",
+                "--exclude-standard",
+                "-z",
+                "--",
+                ".",
+            ],
+            capture_output=True,
+            cwd=str(root),
+            check=False,
+        )
+        if untracked_result.returncode != 0:
+            return full_scan(root)
+
+        raw_paths = (
+            result.stdout.split(b"\0")
+            + untracked_result.stdout.split(b"\0")
+        )
+        changed_files = sorted(
+            {os.fsdecode(raw_path) for raw_path in raw_paths if raw_path}
+        )
         report.changed_files = changed_files
     except FileNotFoundError:
         return full_scan(root)
```

**File**: `engine/tests/test_hub_scanner.py` (modified, +85/-2)
```diff
@@ -1,4 +1,5 @@
 """Tests for hub.scanner — pure Python, no LLM needed."""
+import subprocess
 from pathlib import Path
 
 from repobrain_engine.hub._constants import WORKSPACE_ROOT_MODULE_ID
@@ -137,6 +138,90 @@ def test_quick_scan_falls_back_to_full(tmp_path: Path) -> None:
     assert isinstance(report, ScanReport)
 
 
+def _init_git_repo(path: Path) -> None:
+    subprocess.run(["git", "init", "-q"], cwd=path, check=True)
+    subprocess.run(
+        ["git", "config", "user.email", "test@example.com"],
+        cwd=path,
+        check=True,
+    )
+    subprocess.run(
+        ["git", "config", "user.name", "Test"],
+        cwd=path,
+        check=True,
+    )
+
+
+def test_quick_scan_includes_worktree_and_untracked_changes(tmp_path: Path) -> None:
+    """Quick scans include changes that have not been committed yet."""
+    _init_git_repo(tmp_path)
+    tracked = tmp_path / "tracked.py"
+    tracked.write_text("value = 1\n", encoding="utf-8")
+    subprocess.run(["git", "add", "tracked.py"], cwd=tmp_path, check=True)
+    subprocess.run(["git", "commit", "-qm", "base"], cwd=tmp_path, check=True)
+    base = subprocess.check_output(
+        ["git", "rev-parse", "HEAD"], cwd=tmp_path, text=True
+    ).strip()
+
+    tracked.write_text("value = 2\n", encoding="utf-8")
+    (tmp_path / "new.py").write_text("created = True\n", encoding="utf-8")
+
+    report = quick_scan(tmp_path, base)
+
+    assert report.changed_files == ["new.py", "tracked.py"]
+    assert report.file_count == 2
+    assert set(report.file_metadata) == {"tracked.py", "new.py"}
+
+
+def test_quick_scan_uses_workspace_relative_non_ascii_paths(tmp_path: Path) -> None:
+    """Git paths stay relative to a nested workspace and preserve Unicode."""
+    _init_git_repo(tmp_path)
+    subprocess.run(
+        ["git", "config", "core.quotePath", "true"], cwd=tmp_path, check=True
+    )
+    workspace = tmp_path / "子目录"
+    workspace.mkdir()
+    source = workspace / "测试.py"
+    source.write_text("value = 1\n", encoding="utf-8")
+    subprocess.run(["git", "add", "子目录/测试.py"], cwd=tmp_path, check=True)
+    subprocess.run(["git", "commit", "-qm", "base"], cwd=tmp_path, check=True)
+    base = subprocess.check_output(
+        ["git", "rev-parse", "HEAD"], cwd=tmp_path, text=True
+    ).strip()
+
+    source.write_text("value = 2\n", encoding="utf-8")
+    subprocess.run(["git", "commit", "-qam", "change"], cwd=tmp_path, check=True)
+
+    report = quick_scan(workspace, base)
+
+    assert report.changed_files == ["测试.py"]
+    assert report.scanned_file_samples == ["测试.py"]
+    assert report.file_count == 1
+    assert "测试.py" in report.file_metadata
+
+
+def test_quick_scan_reports_both_sides_of_rename(tmp_path: Path) -> None:
+    """Renames invalidate both the old and new paths for incremental refresh."""
+    _init_git_repo(tmp_path)
+    source = tmp_path / "old.py"
+    source.write_text("value = 1\n", encoding="utf-8")
+    subprocess.run(["git", "add", "old.py"], cwd=tmp_path, check=True)
+    subprocess.run(["git", "commit", "-qm", "base"], cwd=tmp_path, check=True)
+    base = subprocess.check_output(
+        ["git", "rev-parse", "HEAD"], cwd=tmp_path, text=True
+    ).strip()
+
+    source.rename(tmp_path / "new.py")
+    subprocess.run(["git", "add", "-A"], cwd=tmp_path, check=True)
+    subprocess.run(["git", "commit", "-qm", "rename"], cwd=tmp_path, check=True)
+
+    report = quick_scan(tmp_path, base)
+
+    assert report.changed_files == ["new.py", "old.py"]
+    assert report.file_count == 1
+    assert set(report.file_metadata) == {"new.py"}
+
+
 def test_detect_modules_finds_go_directories(tmp_path: Path) -> None:
     """Go source directories should be treated as analyzable modules."""
     cmd_dir = tmp_path / "cmd"
@@ -254,8 +339,6 @@ def test_full_scan_git_summary_no_git(tmp_path: Path) -> None:
 
 def test_full_scan_git_summary_with_repo(tmp_path: Path) -> None:
     """git_summary contains commit info when a git repo exists."""
-    import subprocess
-
     subprocess.run(["git", "init"], cwd=str(tmp_path), capture_output=True, check=True)
     subprocess.run(
         ["git", "config", "user.email", "test@test.com"],
```

---

### Incident Patch 8: `3215469a` (2026-07-10)
**Commit Message**: fix: include working tree paths in quick scans

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
       "name": "repobrain",
       "source": "./",
       "description": "Repository knowledge engine: CLI-backed slash commands (rb-setup / rb-init / rb-refresh / rb-ask) for both Claude Code and Codex CLI, agent-repo-init skill, and optional MCP server.",
-      "version": "0.3.1",
+      "version": "0.3.2",
       "category": "developer-tools",
       "keywords": ["mcp", "knowledge-graph", "multi-agent", "scaffolding"]
     }
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "repobrain",
-  "version": "0.3.1",
+  "version": "0.3.2",
   "description": "Repository knowledge engine plugin. Bundles CLI-backed slash commands (rb-setup / rb-init / rb-refresh / rb-ask) plus the agent-repo-init skill. Works in both Claude Code and Codex CLI.",
   "author": {
     "name": "RepoBrain Team",
```

**File**: `.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "repobrain",
-  "version": "0.3.1",
+  "version": "0.3.2",
   "description": "Repository knowledge engine plugin (Codex CLI). Bundles slash commands (/rb-setup, /rb-init, /rb-refresh, /rb-ask) plus the agent-repo-init skill. Backed by the rb-ask / rb-refresh CLI; MCP optional.",
   "skills": "./skills/",
   "interface": {
```

**File**: `engine/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "repobrain-engine"
-version = "0.3.1"
+version = "0.3.2"
 description = "Repository knowledge engine with grounded Q&A and optional MCP server"
 requires-python = ">=3.10"
 dependencies = [
```

**File**: `engine/repobrain_engine/__init__.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 from repobrain_engine.config import Settings
 
-__version__ = "0.3.1"
+__version__ = "0.3.2"
 
 __all__ = [
     "Settings",
```

**File**: `engine/repobrain_engine/hub/scanner.py` (modified, +35/-3)
```diff
@@ -889,16 +889,48 @@ def quick_scan(root: Path, since_sha: str) -> ScanReport:
 
     try:
         result = subprocess.run(
-            ["git", "diff", "--name-only", since_sha, "HEAD"],
+            [
+                "git",
+                "diff",
+                "--name-only",
+                "-z",
+                "--no-renames",
+                "--relative",
+                since_sha,
+                "--",
+                ".",
+            ],
             capture_output=True,
-            text=True,
             cwd=str(root),
             check=False,
         )
         if result.returncode != 0:
             return full_scan(root)
 
-        changed_files = [f.strip() for f in result.stdout.splitlines() if f.strip()]
+        untracked_result = subprocess.run(
+            [
+                "git",
+                "ls-files",
+                "--others",
+                "--exclude-standard",
+                "-z",
+                "--",
+                ".",
+            ],
+            capture_output=True,
+            cwd=str(root),
+            check=False,
+        )
+        if untracked_result.returncode != 0:
+            return full_scan(root)
+
+        raw_paths = (
+            result.stdout.split(b"\0")
+            + untracked_result.stdout.split(b"\0")
+        )
+        changed_files = sorted(
+            {os.fsdecode(raw_path) for raw_path in raw_paths if raw_path}
+        )
         report.changed_files = changed_files
     except FileNotFoundError:
         return full_scan(root)
```

**File**: `engine/tests/test_hub_scanner.py` (modified, +85/-2)
```diff
@@ -1,4 +1,5 @@
 """Tests for hub.scanner — pure Python, no LLM needed."""
+import subprocess
 from pathlib import Path
 
 from repobrain_engine.hub._constants import WORKSPACE_ROOT_MODULE_ID
@@ -124,6 +125,90 @@ def test_quick_scan_falls_back_to_full(tmp_path: Path) -> None:
     assert isinstance(report, ScanReport)
 
 
+def _init_git_repo(path: Path) -> None:
+    subprocess.run(["git", "init", "-q"], cwd=path, check=True)
+    subprocess.run(
+        ["git", "config", "user.email", "test@example.com"],
+        cwd=path,
+        check=True,
+    )
+    subprocess.run(
+        ["git", "config", "user.name", "Test"],
+        cwd=path,
+        check=True,
+    )
+
+
+def test_quick_scan_includes_worktree_and_untracked_changes(tmp_path: Path) -> None:
+    """Quick scans include changes that have not been committed yet."""
+    _init_git_repo(tmp_path)
+    tracked = tmp_path / "tracked.py"
+    tracked.write_text("value = 1\n", encoding="utf-8")
+    subprocess.run(["git", "add", "tracked.py"], cwd=tmp_path, check=True)
+    subprocess.run(["git", "commit", "-qm", "base"], cwd=tmp_path, check=True)
+    base = subprocess.check_output(
+        ["git", "rev-parse", "HEAD"], cwd=tmp_path, text=True
+    ).strip()
+
+    tracked.write_text("value = 2\n", encoding="utf-8")
+    (tmp_path / "new.py").write_text("created = True\n", encoding="utf-8")
+
+    report = quick_scan(tmp_path, base)
+
+    assert report.changed_files == ["new.py", "tracked.py"]
+    assert report.file_count == 2
+    assert set(report.file_metadata) == {"tracked.py", "new.py"}
+
+
+def test_quick_scan_uses_workspace_relative_non_ascii_paths(tmp_path: Path) -> None:
+    """Git paths stay relative to a nested workspace and preserve Unicode."""
+    _init_git_repo(tmp_path)
+    subprocess.run(
+        ["git", "config", "core.quotePath", "true"], cwd=tmp_path, check=True
+    )
+    workspace = tmp_path / "子目录"
+    workspace.mkdir()
+    source = workspace / "测试.py"
+    source.write_text("value = 1\n", encoding="utf-8")
+    subprocess.run(["git", "add", "子目录/测试.py"], cwd=tmp_path, check=True)
+    subprocess.run(["git", "commit", "-qm", "base"], cwd=tmp_path, check=True)
+    base = subprocess.check_output(
+        ["git", "rev-parse", "HEAD"], cwd=tmp_path, text=True
+    ).strip()
+
+    source.write_text("value = 2\n", encoding="utf-8")
+    subprocess.run(["git", "commit", "-qam", "change"], cwd=tmp_path, check=True)
+
+    report = quick_scan(workspace, base)
+
+    assert report.changed_files == ["测试.py"]
+    assert report.scanned_file_samples == ["测试.py"]
+    assert report.file_count == 1
+    assert "测试.py" in report.file_metadata
+
+
+def test_quick_scan_reports_both_sides_of_rename(tmp_path: Path) -> None:
+    """Renames invalidate both the old and new paths for incremental refresh."""
+    _init_git_repo(tmp_path)
+    source = tmp_path / "old.py"
+    source.write_text("value = 1\n", encoding="utf-8")
+    subprocess.run(["git", "add", "old.py"], cwd=tmp_path, check=True)
+    subprocess.run(["git", "commit", "-qm", "base"], cwd=tmp_path, check=True)
+    base = subprocess.check_output(
+        ["git", "rev-parse", "HEAD"], cwd=tmp_path, text=True
+    ).strip()
+
+    source.rename(tmp_path / "new.py")
+    subprocess.run(["git", "add", "-A"], cwd=tmp_path, check=True)
+    subprocess.run(["git", "commit", "-qm", "rename"], cwd=tmp_path, check=True)
+
+    report = quick_scan(tmp_path, base)
+
+    assert report.changed_files == ["new.py", "old.py"]
+    assert report.file_count == 1
+    assert set(report.file_metadata) == {"new.py"}
+
+
 def test_detect_modules_finds_go_directories(tmp_path: Path) -> None:
     """Go source directories should be treated as analyzable modules."""
     cmd_dir = tmp_path / "cmd"
@@ -241,8 +326,6 @@ def test_full_scan_git_summary_no_git(tmp_path: Path) -> None:
 
 def test_full_scan_git_summary_with_repo(tmp_path: Path) -> None:
     """git_summary contains commit info when a git repo exists."""
-    import subprocess
-
     subprocess.run(["git", "init"], cwd=str(tmp_path), capture_output=True, check=True)
     subprocess.run(
         ["git", "config", "user.email", "test@test.com"],
```

---

### Incident Patch 9: `46d4b309` (2026-07-09)
**Commit Message**: Add freshness-aware ask, incremental quick refresh, rb doctor, and README demo

Per openspec/changes/improve-freshness-and-first-run:
- rb-ask warns when knowledge is N commits behind HEAD or has
  partial/failed modules (structured, legacy, and host-runner paths)
- rb-refresh --quick maps changed files to module groups and only
  re-runs affected groups; zero LLM calls when nothing changed
- Refresh persists per-group progress to status.json and resumes
  after interruption, skipping groups completed at the same HEAD
- New rb doctor command: engine/env/provider/knowledge-base/log checks
  with masked keys; CLI entry points now format unexpected errors with
  actionable hints (full traceback only under DEBUG_MODE=1)
- Render docs/assets/demo.tape to demo.gif and embed in README hero

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +4/-0)
```diff
@@ -28,6 +28,10 @@
 
 <sub>**English** · [中文](README_CN.md) · [Español](README_ES.md)</sub>
 
+<br/><br/>
+
+<img src="docs/assets/demo.gif" alt="rb-ask demo — ask your codebase, get grounded answers with file paths and line numbers" width="800"/>
+
 </div>
 
 <br/>
```

**File**: `README_CN.md` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@
 <img src="https://img.shields.io/badge/Cline-✓-FF6B6B?style=flat-square" alt="Cline"/>
 <img src="https://img.shields.io/badge/Aider-✓-8B5CF6?style=flat-square" alt="Aider"/>
 
+<br/><br/>
+
+<img src="docs/assets/demo.gif" alt="rb-ask 演示 — 向代码库提问,答案带文件路径和行号" width="800"/>
+
 </div>
 
 <br/>
```

**File**: `README_ES.md` (modified, +4/-0)
```diff
@@ -31,6 +31,10 @@ Idioma: [English](README.md) | [中文](README_CN.md) | **Español**
 <img src="https://img.shields.io/badge/Cline-✓-FF6B6B?style=flat-square" alt="Cline"/>
 <img src="https://img.shields.io/badge/Aider-✓-8B5CF6?style=flat-square" alt="Aider"/>
 
+<br/><br/>
+
+<img src="docs/assets/demo.gif" alt="Demo de rb-ask — respuestas fundamentadas con rutas de archivo y números de línea" width="800"/>
+
 </div>
 
 <br/>
```

**File**: `cli/pyproject.toml` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ requires-python = ">=3.10"
 dependencies = [
     "typer>=0.9.0",
     "rich>=13.0.0",
+    "requests>=2.33.0,<3",
 ]
 
 [project.scripts]
```

**File**: `cli/src/rb_cli/cli.py` (modified, +270/-5)
```diff
@@ -7,10 +7,16 @@
 
 from __future__ import annotations
 
+import json
+import os
 import shutil
+import subprocess
 import sys
 import time
+import urllib.error
+import urllib.request
 from importlib import resources as importlib_resources
+from importlib.util import find_spec
 from pathlib import Path
 from typing import Final
 
@@ -81,6 +87,10 @@ def _copy_tree(src: Path, dst: Path, force: bool = False) -> list[str]:
     "refresh": "rb-refresh",
     "mcp": "rb-mcp",
 }
+_INSTALL_ENGINE_HINT: Final[str] = (
+    "pip install ./engine or pip install "
+    "\"git+https://github.com/study8677/repobrain.git#subdirectory=engine\""
+)
 
 
 def _run_hub(workspace: Path, *args: str) -> int:
@@ -123,13 +133,221 @@ def _run_hub(workspace: Path, *args: str) -> int:
         ]
         return subprocess.run(cmd, cwd=str(engine_dir), check=False).returncode
 
-    console.print(
-        "[red]Engine not installed. Install: pip install ./engine "
-        "or pip install \"git+https://github.com/study8677/"
-        "repobrain.git#subdirectory=engine\"[/red]"
-    )
+    console.print(f"[red]Engine not installed. Install: {_INSTALL_ENGINE_HINT}[/red]")
     return 1
 
+
+def _load_workspace_env(workspace: Path) -> tuple[bool, dict[str, str]]:
+    """Load simple KEY=VALUE entries from the workspace .env plus process env."""
+    env_path = workspace / ".env"
+    values: dict[str, str] = {}
+    if env_path.is_file():
+        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
+            line = raw_line.strip()
+            if not line or line.startswith("#") or "=" not in line:
+                continue
+            key, value = line.split("=", 1)
+            key = key.strip()
+            value = value.strip().strip("\"'")
+            if key:
+                values[key] = value
+    for key in (
+        "OPENAI_BASE_URL",
+        "OPENAI_API_KEY",
+        "OPENAI_MODEL",
+        "RB_HOST_RUNNER",
+    ):
+        if os.environ.get(key):
+            values[key] = os.environ[key]
+    return env_path.is_file(), values
+
+
+def _mask_secret(value: str) -> str:
+    """Mask an API key, preserving only the first and last four characters."""
+    if len(value) <= 8:
+        return "*" * len(value)
+    return f"{value[:4]}...{value[-4:]}"
+
+
+def _one_line_error(exc: BaseException) -> str:
+    """Return an exception message safe for one-line CLI output."""
+    message = str(exc).replace("\n", " ").replace("\r", " ").strip()
+    return message or exc.__class__.__name__
+
+
+def _mcp_log_path() -> Path:
+    """Return the rb-mcp diagnostic log path without importing the engine."""
+    data_dir = os.environ.get("CLAUDE_PLUGIN_DATA_DIR", "").strip()
+    if data_dir:
+        base = Path(data_dir).expanduser()
+    else:
+        base = Path.home() / ".claude" / "plugins" / "data" / "repobrain-repobrain"
+    return base / "rb-mcp.log"
+
+
+def _engine_is_available() -> tuple[bool, str]:
+    """Return whether the engine can be invoked and the human-readable source."""
+    script = shutil.which("rb-ask")
+    if script:
+        return True, f"rb-ask at {script}"
+    if find_spec("repobrain_engine") is not None:
+        return True, "repobrain_engine importable"
+    return False, f"not found; install: {_INSTALL_ENGINE_HINT}"
+
+
+def _check_provider(env_values: dict[str, str]) -> tuple[str, str]:
+    """Check configured provider reachability."""
+    host_runner = env_values.get("RB_HOST_RUNNER", "").strip().lower()
+    if host_runner == "codex":
+        codex = shutil.which("codex")
+        if not codex:
+            return "⚠", "codex CLI not found on PATH"
+        try:
+            result = subprocess.run(
+                [codex, "login", "status"],
+                capture_output=True,
+                text=True,
+                timeout=5,
+                check=False,
+            )
+        except (OSError, subprocess.TimeoutExpired) as exc:
+            return "⚠", _one_line_error(exc)
+        if result.returncode != 0:
+            error = (
+                result.stderr
+                or result.stdout
+                or f"exit {result.returncode}"
+            ).strip()
+            return "⚠", _one_line_error(RuntimeError(error))
+        return "✓", "codex host runner login status ok"
+
+    base_url = env_values.get("OPENAI_BASE_URL", "").rstrip("/")
+    api_key = env_values.get("OPENAI_API_KEY", "")
+    if not base_url or not api_key:
+        return "⚠", "provider not checked because OpenAI-compatible config is incomplete"
+    models_url = f"{base_url}/models"
+    try:
+        import requests
+    except ImportError:
+        request = urllib.request.Request(
+            models_url,
+            headers={"Authorization": f"Bearer {api_key}"},
+            method="GET",
+        )
+        try:
+            with urllib.request.urlopen(request, timeout=5):
+                pass
+        except (OSError, urllib.error.URLError, urllib.error.HTTPError) as exc:

```

**File**: `cli/tests/test_cli_doctor.py` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+"""Tests for rb doctor diagnostics."""
+from __future__ import annotations
+
+import json
+import subprocess
+import builtins
+from contextlib import nullcontext
+from pathlib import Path
+from unittest.mock import MagicMock, patch
+
+from typer.testing import CliRunner
+
+from rb_cli.cli import app
+
+runner = CliRunner()
+_ORIGINAL_IMPORT = builtins.__import__
+
+
+def _write_env(workspace: Path) -> None:
+    (workspace / ".env").write_text(
+        "\n".join(
+            [
+                "OPENAI_BASE_URL=https://api.example.test/v1",
+                "OPENAI_API_KEY=sk-test-1234567890",
+                "OPENAI_MODEL=gpt-test",
+            ]
+        ),
+        encoding="utf-8",
+    )
+
+
+def _write_knowledge(workspace: Path) -> None:
+    rb_dir = workspace / ".repobrain"
+    agents_dir = rb_dir / "agents"
+    agents_dir.mkdir(parents=True)
+    (rb_dir / "map.md").write_text("# Map\n", encoding="utf-8")
+    (agents_dir / "core.md").write_text("# Core\n", encoding="utf-8")
+    (rb_dir / ".last_refresh_sha").write_text("abc123\n", encoding="utf-8")
+    (rb_dir / "status.json").write_text(
+        json.dumps(
+            {
+                "refresh_run_id": "test",
+                "overall_status": "success",
+                "modules": {"core": "success"},
+                "groups": {"core/default": "success"},
+            }
+        ),
+        encoding="utf-8",
+    )
+
+
+def _git_run_with_lag(lag: int):
+    def fake_run(cmd, **kwargs):
+        if cmd[:3] == ["git", "rev-parse", "--is-inside-work-tree"]:
+            return subprocess.CompletedProcess(cmd, 0, stdout="true\n", stderr="")
+        if cmd[:3] == ["git", "rev-list", "--count"]:
+            return subprocess.CompletedProcess(cmd, 0, stdout=f"{lag}\n", stderr="")
+        raise AssertionError(f"unexpected command: {cmd}")
+
+    return fake_run
+
+
+def _mock_provider_ok():
+    response = MagicMock()
+    response.raise_for_status.return_value = None
+    return patch("requests.get", return_value=response)
+
+
+def _import_without_requests(name, *args, **kwargs):
+    if name == "requests":
+        raise ImportError("No module named requests")
+    return _ORIGINAL_IMPORT(name, *args, **kwargs)
+
+
+def test_doctor_happy_path(tmp_path: Path, monkeypatch) -> None:
+    """rb doctor exits 0 when engine, env, provider, and knowledge are healthy."""
+    _write_env(tmp_path)
+    _write_knowledge(tmp_path)
+    for key in ("OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL", "RB_HOST_RUNNER"):
+        monkeypatch.delenv(key, raising=False)
+
+    with patch("rb_cli.cli.shutil.which", return_value="/usr/local/bin/rb-ask"):
+        with patch("rb_cli.cli.subprocess.run", side_effect=_git_run_with_lag(0)):
+            with _mock_provider_ok():
+                result = runner.invoke(app, ["doctor", "--workspace", str(tmp_path)])
+
+    assert result.exit_code == 0
+    assert "✓ Engine install: rb-ask at /usr/local/bin/rb-ask" in result.output
+    assert "OPENAI_API_KEY=sk-t...7890" in result.output
+    assert "✓ Provider reachability: GET https://api.example.test/v1/models ok" in result.output
+    assert "✓ Knowledge base health:" in result.output
+    assert "0 commit(s) behind HEAD" in result.output
+
+
+def test_doctor_provider_uses_urllib_when_requests_missing(
+    tmp_path: Path,
+    monkeypatch,
+) -> None:
+    """Provider check falls back to urllib if requests is unavailable."""
+    _write_env(tmp_path)
+    _write_knowledge(tmp_path)
+    for key in ("OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL", "RB_HOST_RUNNER"):
+        monkeypatch.delenv(key, raising=False)
+
+    with patch("rb_cli.cli.shutil.which", return_value="/usr/local/bin/rb-ask"):
+        with patch("rb_cli.cli.subprocess.run", side_effect=_git_run_with_lag(0)):
+            with patch("builtins.__import__", side_effect=_import_without_requests):
+                with patch("rb_cli.cli.urllib.request.urlopen", return_value=nullcontext()):
+                    result = runner.invoke(app, ["doctor", "--workspace", str(tmp_path)])
+
+    assert result.exit_code == 0
+    assert "✓ Provider reachability: GET https://api.example.test/v1/models ok" in result.output
+
+
+def test_doctor_missing_env_is_blocking(tmp_path: Path, monkeypatch) -> None:
+    """Missing workspace .env is a blocking doctor failure."""
+    _write_knowledge(tmp_path)
+    for key in ("OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL", "RB_HOST_RUNNER"):
+        monkeypatch.delenv(key, raising=False)
+
+    with patch("rb_cli.cli.shutil.which", return_value="/usr/local/bin/rb-ask"):
+        with patch("rb_cli.cli.subprocess.run", side_effect=_git_run_with_lag(0)):
+            result = runner.invoke(app, ["doctor", "--workspace", str(tmp_path)])
+
+    assert result.exit_code == 1
+    assert "✗ .env config: .env missing; run rb-setup" in result.output
+    assert "⚠ Provider reachability:" in result.output
+
+
+def test_doctor_engine_not_installe
```

**File**: `engine/repobrain_engine/_cli_entry.py` (modified, +97/-13)
```diff
@@ -10,6 +10,7 @@
 import argparse
 import os
 import sys
+import traceback
 from pathlib import Path
 from typing import Sequence
 
@@ -32,6 +33,89 @@ def _parse_args(
     return parser.parse_args(list(argv))
 
 
+def _run_ask_pipeline(workspace: Path, question: str) -> str:
+    """Run the ask pipeline for CLI entry points."""
+    import asyncio
+    from repobrain_engine.hub.pipeline import ask_pipeline
+
+    return asyncio.run(ask_pipeline(workspace, question))
+
+
+def _run_refresh_pipeline(workspace: Path, *, quick: bool, failed_only: bool):
+    """Run the refresh pipeline for CLI entry points."""
+    import asyncio
+    from repobrain_engine.hub.pipeline import refresh_pipeline
+
+    return asyncio.run(
+        refresh_pipeline(
+            workspace=workspace,
+            quick=quick,
+            failed_only=failed_only,
+        )
+    )
+
+
+def _diagnostic_log_path() -> Path:
+    """Return the MCP diagnostic log path for actionable CLI errors."""
+    try:
+        from repobrain_engine.hub.mcp_server import _mcp_log_path
+
+        return _mcp_log_path()
+    except Exception:
+        data_dir = os.environ.get("CLAUDE_PLUGIN_DATA_DIR", "").strip()
+        if data_dir:
+            base = Path(data_dir).expanduser()
+        else:
+            base = Path.home() / ".claude" / "plugins" / "data" / "repobrain-repobrain"
+        return base / "rb-mcp.log"
+
+
+def _debug_mode_enabled() -> bool:
+    """Return whether full tracebacks should be printed."""
+    value = os.environ.get("DEBUG_MODE", "")
+    if value.strip().lower() in {"1", "true", "yes", "on"}:
+        return True
+    try:
+        from repobrain_engine.config import settings
+
+        return bool(settings.DEBUG_MODE)
+    except Exception:
+        return False
+
+
+def _one_line_message(exc: BaseException) -> str:
+    """Return an exception message without embedded newlines."""
+    message = str(exc).replace("\n", " ").replace("\r", " ").strip()
+    return message or exc.__class__.__name__
+
+
+def _suggestion_for_exception(exc: BaseException) -> str:
+    """Return a short actionable suggestion for a CLI failure."""
+    name = exc.__class__.__name__.lower()
+    message = _one_line_message(exc).lower()
+    if "timeout" in name or "timeout" in message or "timed out" in message:
+        return "Try increasing RB_ASK_TIMEOUT_SECONDS or rerun rb doctor."
+    if "connection" in name or "connect" in message or "provider" in message:
+        return "Run rb doctor to check provider connectivity."
+    if "permission" in name or "permission" in message:
+        return "Check workspace file permissions, then rerun rb doctor."
+    return "Run rb doctor for environment and knowledge-base diagnostics."
+
+
+def _handle_unexpected_cli_exception(exc: Exception) -> None:
+    """Print a compact actionable error, then optional debug traceback."""
+    print(
+        "Error: "
+        f"{exc.__class__.__name__}: {_one_line_message(exc)}. "
+        f"{_suggestion_for_exception(exc)} "
+        f"Diagnostic log: {_diagnostic_log_path()}",
+        file=sys.stderr,
+    )
+    if _debug_mode_enabled():
+        traceback.print_exception(type(exc), exc, exc.__traceback__, file=sys.stderr)
+    sys.exit(1)
+
+
 def ask_main(argv: Sequence[str] | None = None) -> None:
     """Entry point for ``rb-ask``.
 
@@ -51,13 +135,14 @@ def ask_main(argv: Sequence[str] | None = None) -> None:
     os.environ["WORKSPACE_PATH"] = str(workspace)
 
     try:
-        import asyncio
-        from repobrain_engine.hub.pipeline import ask_pipeline
-
-        print(asyncio.run(ask_pipeline(workspace, args.question)))
+        print(_run_ask_pipeline(workspace, args.question))
+    except KeyboardInterrupt:
+        sys.exit(130)
     except ValueError as exc:
         print(f"Error: {exc}", file=sys.stderr)
         sys.exit(1)
+    except Exception as exc:  # noqa: BLE001 - CLI boundary formats unknown failures
+        _handle_unexpected_cli_exception(exc)
 
 
 def refresh_main(argv: Sequence[str] | None = None) -> None:
@@ -80,21 +165,20 @@ def refresh_main(argv: Sequence[str] | None = None) -> None:
     os.environ["WORKSPACE_PATH"] = str(workspace)
 
     try:
-        import asyncio
-        from repobrain_engine.hub.pipeline import refresh_pipeline
-
-        status = asyncio.run(
-            refresh_pipeline(
-                workspace=workspace,
-                quick=args.quick,
-                failed_only=args.failed_only,
-            )
+        status = _run_refresh_pipeline(
+            workspace=workspace,
+            quick=args.quick,
+            failed_only=args.failed_only,
         )
         if getattr(status, "exit_code", 0) != 0:
             sys.exit(int(status.exit_code))
+    except KeyboardInterrupt:
+        sys.exit(130)
     except ValueError as exc:
         print(f"Error: {exc}", file=sys.stderr)
         sys.exit(1)
+    except Exception as exc:  # noqa: BLE001 - CLI boundary formats unknown failures
+      
```

**File**: `engine/repobrain_engine/hub/ask_pipeline.py` (modified, +78/-2)
```diff
@@ -204,7 +204,8 @@ async def ask_pipeline(workspace: Path, question: str) -> str:
                 f"Unsupported RB_HOST_RUNNER={settings.RB_HOST_RUNNER!r}. "
                 "Supported values: codex."
             )
-        return await _ask_with_host_runner(workspace, question, settings)
+        answer = await _ask_with_host_runner(workspace, question, settings)
+        return _prepend_workspace_health_notices(workspace, answer)
 
     from repobrain_engine.hub._providers import (
         get_provider_chain,
@@ -216,12 +217,13 @@ async def ask_pipeline(workspace: Path, question: str) -> str:
     async def _once() -> str:
         return await _ask_pipeline_once(workspace, question)
 
-    return await run_with_provider_failover(
+    answer = await run_with_provider_failover(
         _once,
         providers=providers,
         is_retryable=_is_retryable_ask_error,
         label="ask",
     )
+    return _prepend_workspace_health_notices(workspace, answer)
 
 
 async def _ask_pipeline_once(workspace: Path, question: str) -> str:
@@ -485,6 +487,80 @@ def _structured_artifacts_available(workspace: Path) -> bool:
     )
 
 
+def _prepend_workspace_health_notices(workspace: Path, answer: str) -> str:
+    """Add non-blocking workspace health notices before an ask answer."""
+    notices = _build_workspace_health_notices(workspace)
+    if not notices:
+        return answer
+    return "\n".join(notices + [answer])
+
+
+def _build_workspace_health_notices(workspace: Path) -> list[str]:
+    """Return staleness/degradation notices for existing knowledge artifacts."""
+    notices: list[str] = []
+    behind_count = _get_refresh_commit_lag(workspace)
+    if behind_count and behind_count > 0:
+        notices.append(
+            "⚠ Knowledge base is "
+            f"{behind_count} commit(s) behind HEAD -- consider running "
+            "rb-refresh --quick."
+        )
+
+    degraded_modules = _load_degraded_status_modules(workspace)
+    if degraded_modules:
+        notices.append(
+            "⚠ Knowledge base has partial/failed module knowledge for: "
+            f"{', '.join(degraded_modules)}."
+        )
+    return notices
+
+
+def _get_refresh_commit_lag(workspace: Path) -> int | None:
+    """Return commits between last refresh SHA and HEAD, or None on failure."""
+    sha_path = workspace / ".repobrain" / ".last_refresh_sha"
+    try:
+        last_sha = sha_path.read_text(encoding="utf-8").strip()
+    except OSError:
+        return None
+    if not last_sha:
+        return None
+
+    try:
+        result = subprocess.run(
+            ["git", "rev-list", "--count", f"{last_sha}..HEAD"],
+            capture_output=True,
+            text=True,
+            cwd=str(workspace),
+            check=False,
+        )
+    except (FileNotFoundError, OSError):
+        return None
+    if result.returncode != 0:
+        return None
+    try:
+        return int(result.stdout.strip())
+    except (TypeError, ValueError):
+        return None
+
+
+def _load_degraded_status_modules(workspace: Path) -> list[str]:
+    """Return modules marked partial/failed in status.json, if readable."""
+    status_path = workspace / ".repobrain" / "status.json"
+    try:
+        payload = json.loads(status_path.read_text(encoding="utf-8"))
+    except (OSError, json.JSONDecodeError, TypeError):
+        return []
+    modules = payload.get("modules")
+    if not isinstance(modules, dict):
+        return []
+    degraded = [
+        str(module)
+        for module, state in modules.items()
+        if state in {"partial", "failed"}
+    ]
+    return sorted(degraded)
+
+
 async def _ask_with_structured_facts(workspace: Path, question: str) -> str | None:
     """Answer a question using agent.md knowledge documents.
 
```

---

### Incident Patch 10: `ab746dff` (2026-07-07)
**Commit Message**: Merge pull request #96 from study8677/codex/memory-rg-fallback-lling0000

Handle rg execution failures in memory search

**File**: `engine/antigravity_engine/tools/memory_tools.py` (modified, +2/-2)
```diff
@@ -92,8 +92,8 @@ def search_memory_md(
             return completed.stdout.strip()
         if completed.returncode in (0, 1):
             return "No matching memory lines found."
-    except FileNotFoundError:
-        # Fallback for environments without ripgrep installed.
+    except OSError:
+        # Fallback for environments where ripgrep is missing or cannot run.
         pass
 
     matches = []
```

**File**: `engine/tests/test_memory_tools.py` (modified, +24/-0)
```diff
@@ -27,6 +27,30 @@ def test_search_memory_md(tmp_path):
     assert "microsandbox" in result.lower()
 
 
+def test_search_memory_md_falls_back_when_rg_cannot_run(tmp_path, monkeypatch):
+    memory_file = tmp_path / "agent_memory.md"
+    memory_file.write_text(
+        "# Agent Memory Log\n\nMicrosandbox enabled.\nDocker removed.\n",
+        encoding="utf-8",
+    )
+
+    def raise_permission_error(*args, **kwargs):
+        raise PermissionError("rg is not executable")
+
+    monkeypatch.setattr(
+        "antigravity_engine.tools.memory_tools.subprocess.run",
+        raise_permission_error,
+    )
+
+    result = search_memory_md(
+        query="docker",
+        max_results=5,
+        memory_file=str(memory_file),
+    )
+
+    assert "Docker removed." in result
+
+
 def test_search_memory_md_empty_query(tmp_path):
     memory_file = tmp_path / "agent_memory.md"
     memory_file.write_text("any", encoding="utf-8")
```

---

### Incident Patch 11: `85dcd723` (2026-07-07)
**Commit Message**: Handle rg execution failures in memory search

**File**: `engine/antigravity_engine/tools/memory_tools.py` (modified, +2/-2)
```diff
@@ -92,8 +92,8 @@ def search_memory_md(
             return completed.stdout.strip()
         if completed.returncode in (0, 1):
             return "No matching memory lines found."
-    except FileNotFoundError:
-        # Fallback for environments without ripgrep installed.
+    except OSError:
+        # Fallback for environments where ripgrep is missing or cannot run.
         pass
 
     matches = []
```

**File**: `engine/tests/test_memory_tools.py` (modified, +24/-0)
```diff
@@ -27,6 +27,30 @@ def test_search_memory_md(tmp_path):
     assert "microsandbox" in result.lower()
 
 
+def test_search_memory_md_falls_back_when_rg_cannot_run(tmp_path, monkeypatch):
+    memory_file = tmp_path / "agent_memory.md"
+    memory_file.write_text(
+        "# Agent Memory Log\n\nMicrosandbox enabled.\nDocker removed.\n",
+        encoding="utf-8",
+    )
+
+    def raise_permission_error(*args, **kwargs):
+        raise PermissionError("rg is not executable")
+
+    monkeypatch.setattr(
+        "antigravity_engine.tools.memory_tools.subprocess.run",
+        raise_permission_error,
+    )
+
+    result = search_memory_md(
+        query="docker",
+        max_results=5,
+        memory_file=str(memory_file),
+    )
+
+    assert "Docker removed." in result
+
+
 def test_search_memory_md_empty_query(tmp_path):
     memory_file = tmp_path / "agent_memory.md"
     memory_file.write_text("any", encoding="utf-8")
```

---

### Incident Patch 12: `1575775b` (2026-06-04)
**Commit Message**: Merge pull request #89 from study8677/fix/refresh-timeout-hang

fix(refresh): stop refresh hanging on slow / reasoning models

**File**: `engine/.env.example` (modified, +11/-0)
```diff
@@ -36,6 +36,17 @@
 # Initial backoff delay in seconds (doubles each attempt).
 # AG_REFRESH_RETRY_DELAY=1.0
 
+# -------------------------------------------------------------------
+# Refresh agent timeouts (optional) — per-attempt wall-clock seconds.
+# Defaults are sized for slow *reasoning* models (a single call may emit a long
+# reasoning/<think> block); fast models finish well under them. A bare timeout
+# is NOT retried (it falls back immediately), so raising these only costs time
+# if a call genuinely runs that long.
+# AG_REFRESH_AGENT_TIMEOUT_SECONDS=300   # conventions: 3-hop handoff swarm
+# AG_MODULE_AGENT_TIMEOUT_SECONDS=300    # per-module knowledge doc
+# AG_MAP_AGENT_TIMEOUT_SECONDS=300       # map.md generation over all docs
+# AG_REGISTRY_TIMEOUT_SECONDS=120        # module registry
+
 # -------------------------------------------------------------------
 # Ask retry policy (optional)
 # Same-provider retry for transient ask-time failures (timeouts, 5xx,
```

**File**: `engine/antigravity_engine/hub/refresh_pipeline.py` (modified, +17/-7)
```diff
@@ -143,9 +143,16 @@ def _is_retryable_error(exc: Exception) -> bool:
     Returns:
         True if the error is retryable.
     """
-    # asyncio.TimeoutError has an empty str() — check type first.
-    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
-        return True
+    # A bare asyncio wait_for timeout has an empty str() and means OUR own
+    # per-attempt deadline elapsed — the model is slow/stalling, not
+    # transiently failing. Retrying the same full-length attempt just
+    # multiplies wall-clock by (retries + 1) for the same outcome, which is
+    # what made refresh appear to hang. Treat a *bare* timeout as NON-retryable
+    # so the step falls back immediately. A provider-side timeout that carries
+    # a message (e.g. "gateway time-out"/"504") falls through to the keyword
+    # check below and stays retryable.
+    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)) and not str(exc).strip():
+        return False
     msg = str(exc).lower()
     retryable_keywords = (
         "timeout",
@@ -332,7 +339,10 @@ async def refresh_pipeline(workspace: Path, quick: bool = False, failed_only: bo
 
         print("[2/3] Analyzing with multi-agent swarm...", file=sys.stderr)
 
-        refresh_timeout = float(os.environ.get("AG_REFRESH_AGENT_TIMEOUT_SECONDS", "90"))
+        # Conventions is a 3-hop handoff swarm (ScanAnalyst → ArchitectureReviewer
+        # → ConventionWriter), so it needs ~3x a single call. Default is generous
+        # enough for slow reasoning models; fast models finish well under it.
+        refresh_timeout = float(os.environ.get("AG_REFRESH_AGENT_TIMEOUT_SECONDS", "300"))
         try:
             result = await _run_with_retry(
                 Runner.run, agent, prompt,
@@ -449,7 +459,7 @@ async def refresh_pipeline(workspace: Path, quick: bool = False, failed_only: bo
                 "OpenAI Agent SDK not found. Install: pip install antigravity-engine"
             ) from None
 
-        module_timeout = float(os.environ.get("AG_MODULE_AGENT_TIMEOUT_SECONDS", "45"))
+        module_timeout = float(os.environ.get("AG_MODULE_AGENT_TIMEOUT_SECONDS", "300"))
 
         # Skip module agents when failed-only mode has no modules to process
         if modules_filter is not None and not modules_filter:
@@ -1902,7 +1912,7 @@ async def _generate_map_md(workspace: Path, model: str) -> str:
         batches.append(current_batch)
 
     map_agent = build_map_agent(model)
-    map_timeout = float(os.environ.get("AG_MAP_AGENT_TIMEOUT_SECONDS", "90"))
+    map_timeout = float(os.environ.get("AG_MAP_AGENT_TIMEOUT_SECONDS", "300"))
 
     async def _run_map_batch(batch: list[str], batch_idx: int) -> str:
         prompt = "Create a map.md from these module knowledge documents:\n" + "\n".join(batch)
@@ -2100,7 +2110,7 @@ async def _generate_module_registry(workspace: Path, model: str) -> str:
         model=model,
     )
 
-    registry_timeout = float(os.environ.get("AG_REGISTRY_TIMEOUT_SECONDS", "60"))
+    registry_timeout = float(os.environ.get("AG_REGISTRY_TIMEOUT_SECONDS", "120"))
     result = await _run_with_retry(
         Runner.run, registry_agent, prompt,
         timeout=registry_timeout,
```

**File**: `engine/tests/test_refresh_retry.py` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+"""Regression tests for refresh retry classification.
+
+A bare ``asyncio.wait_for`` timeout means our own per-attempt deadline elapsed
+(the model is slow/stalling). Retrying it just multiplies wall-clock by
+(retries + 1) for the same outcome — the behaviour that made refresh appear to
+hang. It must be treated as NON-retryable so the step falls back immediately.
+Genuine transient provider failures (rate limits, 5xx, network, and
+*messaged* gateway timeouts) must still be retried.
+"""
+
+from __future__ import annotations
+
+import asyncio
+
+from antigravity_engine.hub.refresh_pipeline import _is_retryable_error
+
+
+def test_bare_wait_for_timeout_is_not_retryable() -> None:
+    # asyncio.TimeoutError() and TimeoutError() carry an empty message.
+    assert _is_retryable_error(asyncio.TimeoutError()) is False
+    assert _is_retryable_error(TimeoutError()) is False
+
+
+def test_messaged_gateway_timeout_is_retryable() -> None:
+    # A provider-side timeout carries a message and stays retryable.
+    assert _is_retryable_error(TimeoutError("504 Gateway Time-out")) is True
+
+
+def test_transient_provider_errors_are_retryable() -> None:
+    assert _is_retryable_error(RuntimeError("connection reset by peer")) is True
+    assert _is_retryable_error(RuntimeError("rate limit exceeded")) is True
+    assert _is_retryable_error(RuntimeError("503 Service Unavailable")) is True
+    assert _is_retryable_error(RuntimeError("network is unreachable")) is True
+
+
+def test_non_transient_errors_are_not_retryable() -> None:
+    assert _is_retryable_error(ValueError("invalid api key")) is False
+    assert _is_retryable_error(RuntimeError("bad request: malformed prompt")) is False
```

---

### Incident Patch 13: `bb1153ad` (2026-06-04)
**Commit Message**: fix(refresh): bump module/map agent timeout defaults to 300s

OOTB verification showed per-module knowledge-doc calls still timing out at
240s with MiniMax-M3 (3 modules concurrent) and falling back; the proven
value is 300s (same as the conventions swarm). Raise
AG_MODULE_AGENT_TIMEOUT_SECONDS and AG_MAP_AGENT_TIMEOUT_SECONDS defaults
240 -> 300 so refresh produces real (non-fallback) docs out of the box.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `engine/.env.example` (modified, +2/-2)
```diff
@@ -43,8 +43,8 @@
 # is NOT retried (it falls back immediately), so raising these only costs time
 # if a call genuinely runs that long.
 # AG_REFRESH_AGENT_TIMEOUT_SECONDS=300   # conventions: 3-hop handoff swarm
-# AG_MODULE_AGENT_TIMEOUT_SECONDS=240    # per-module knowledge doc
-# AG_MAP_AGENT_TIMEOUT_SECONDS=240       # map.md generation over all docs
+# AG_MODULE_AGENT_TIMEOUT_SECONDS=300    # per-module knowledge doc
+# AG_MAP_AGENT_TIMEOUT_SECONDS=300       # map.md generation over all docs
 # AG_REGISTRY_TIMEOUT_SECONDS=120        # module registry
 
 # -------------------------------------------------------------------
```

**File**: `engine/antigravity_engine/hub/refresh_pipeline.py` (modified, +2/-2)
```diff
@@ -459,7 +459,7 @@ async def refresh_pipeline(workspace: Path, quick: bool = False, failed_only: bo
                 "OpenAI Agent SDK not found. Install: pip install antigravity-engine"
             ) from None
 
-        module_timeout = float(os.environ.get("AG_MODULE_AGENT_TIMEOUT_SECONDS", "240"))
+        module_timeout = float(os.environ.get("AG_MODULE_AGENT_TIMEOUT_SECONDS", "300"))
 
         # Skip module agents when failed-only mode has no modules to process
         if modules_filter is not None and not modules_filter:
@@ -1912,7 +1912,7 @@ async def _generate_map_md(workspace: Path, model: str) -> str:
         batches.append(current_batch)
 
     map_agent = build_map_agent(model)
-    map_timeout = float(os.environ.get("AG_MAP_AGENT_TIMEOUT_SECONDS", "240"))
+    map_timeout = float(os.environ.get("AG_MAP_AGENT_TIMEOUT_SECONDS", "300"))
 
     async def _run_map_batch(batch: list[str], batch_idx: int) -> str:
         prompt = "Create a map.md from these module knowledge documents:\n" + "\n".join(batch)
```

---

### Incident Patch 14: `02b5be8e` (2026-06-04)
**Commit Message**: fix(refresh): stop refresh hanging on slow / reasoning models

Two changes so `ag-refresh` works out-of-the-box with slow reasoning models
(e.g. MiniMax-M3) instead of appearing to hang for many minutes:

1. A bare asyncio.wait_for timeout is no longer treated as retryable
   (_is_retryable_error). Our own per-attempt deadline elapsing means the model
   is slow/stalling, not transiently failing — retrying the same full-length
   attempt just multiplied wall-clock by (AG_REFRESH_RETRY_COUNT + 1) (default
   4x) for the same outcome. It now falls back immediately. Messaged provider
   timeouts ("504" / "gateway time-out") stay retryable.

2. Raise the refresh per-attempt timeout defaults, which were tuned for fast
   models and too low for reasoning models (one call may emit a long reasoning
   block; conventions is a 3-hop handoff swarm):
   - AG_REFRESH_AGENT_TIMEOUT_SECONDS 90 -> 300  (conventions swarm)
   - AG_MODULE_AGENT_TIMEOUT_SECONDS  45 -> 240  (per-module doc)
   - AG_MAP_AGENT_TIMEOUT_SECONDS     90 -> 240  (map.md)
   - AG_REGISTRY_TIMEOUT_SECONDS      60 -> 120
   A bare timeout no longer retries, so a higher ceiling only costs time if a
   call genuinely runs that lo

**File**: `engine/.env.example` (modified, +11/-0)
```diff
@@ -36,6 +36,17 @@
 # Initial backoff delay in seconds (doubles each attempt).
 # AG_REFRESH_RETRY_DELAY=1.0
 
+# -------------------------------------------------------------------
+# Refresh agent timeouts (optional) — per-attempt wall-clock seconds.
+# Defaults are sized for slow *reasoning* models (a single call may emit a long
+# reasoning/<think> block); fast models finish well under them. A bare timeout
+# is NOT retried (it falls back immediately), so raising these only costs time
+# if a call genuinely runs that long.
+# AG_REFRESH_AGENT_TIMEOUT_SECONDS=300   # conventions: 3-hop handoff swarm
+# AG_MODULE_AGENT_TIMEOUT_SECONDS=240    # per-module knowledge doc
+# AG_MAP_AGENT_TIMEOUT_SECONDS=240       # map.md generation over all docs
+# AG_REGISTRY_TIMEOUT_SECONDS=120        # module registry
+
 # -------------------------------------------------------------------
 # Ask retry policy (optional)
 # Same-provider retry for transient ask-time failures (timeouts, 5xx,
```

**File**: `engine/antigravity_engine/hub/refresh_pipeline.py` (modified, +17/-7)
```diff
@@ -143,9 +143,16 @@ def _is_retryable_error(exc: Exception) -> bool:
     Returns:
         True if the error is retryable.
     """
-    # asyncio.TimeoutError has an empty str() — check type first.
-    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
-        return True
+    # A bare asyncio wait_for timeout has an empty str() and means OUR own
+    # per-attempt deadline elapsed — the model is slow/stalling, not
+    # transiently failing. Retrying the same full-length attempt just
+    # multiplies wall-clock by (retries + 1) for the same outcome, which is
+    # what made refresh appear to hang. Treat a *bare* timeout as NON-retryable
+    # so the step falls back immediately. A provider-side timeout that carries
+    # a message (e.g. "gateway time-out"/"504") falls through to the keyword
+    # check below and stays retryable.
+    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)) and not str(exc).strip():
+        return False
     msg = str(exc).lower()
     retryable_keywords = (
         "timeout",
@@ -332,7 +339,10 @@ async def refresh_pipeline(workspace: Path, quick: bool = False, failed_only: bo
 
         print("[2/3] Analyzing with multi-agent swarm...", file=sys.stderr)
 
-        refresh_timeout = float(os.environ.get("AG_REFRESH_AGENT_TIMEOUT_SECONDS", "90"))
+        # Conventions is a 3-hop handoff swarm (ScanAnalyst → ArchitectureReviewer
+        # → ConventionWriter), so it needs ~3x a single call. Default is generous
+        # enough for slow reasoning models; fast models finish well under it.
+        refresh_timeout = float(os.environ.get("AG_REFRESH_AGENT_TIMEOUT_SECONDS", "300"))
         try:
             result = await _run_with_retry(
                 Runner.run, agent, prompt,
@@ -449,7 +459,7 @@ async def refresh_pipeline(workspace: Path, quick: bool = False, failed_only: bo
                 "OpenAI Agent SDK not found. Install: pip install antigravity-engine"
             ) from None
 
-        module_timeout = float(os.environ.get("AG_MODULE_AGENT_TIMEOUT_SECONDS", "45"))
+        module_timeout = float(os.environ.get("AG_MODULE_AGENT_TIMEOUT_SECONDS", "240"))
 
         # Skip module agents when failed-only mode has no modules to process
         if modules_filter is not None and not modules_filter:
@@ -1902,7 +1912,7 @@ async def _generate_map_md(workspace: Path, model: str) -> str:
         batches.append(current_batch)
 
     map_agent = build_map_agent(model)
-    map_timeout = float(os.environ.get("AG_MAP_AGENT_TIMEOUT_SECONDS", "90"))
+    map_timeout = float(os.environ.get("AG_MAP_AGENT_TIMEOUT_SECONDS", "240"))
 
     async def _run_map_batch(batch: list[str], batch_idx: int) -> str:
         prompt = "Create a map.md from these module knowledge documents:\n" + "\n".join(batch)
@@ -2100,7 +2110,7 @@ async def _generate_module_registry(workspace: Path, model: str) -> str:
         model=model,
     )
 
-    registry_timeout = float(os.environ.get("AG_REGISTRY_TIMEOUT_SECONDS", "60"))
+    registry_timeout = float(os.environ.get("AG_REGISTRY_TIMEOUT_SECONDS", "120"))
     result = await _run_with_retry(
         Runner.run, registry_agent, prompt,
         timeout=registry_timeout,
```

**File**: `engine/tests/test_refresh_retry.py` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+"""Regression tests for refresh retry classification.
+
+A bare ``asyncio.wait_for`` timeout means our own per-attempt deadline elapsed
+(the model is slow/stalling). Retrying it just multiplies wall-clock by
+(retries + 1) for the same outcome — the behaviour that made refresh appear to
+hang. It must be treated as NON-retryable so the step falls back immediately.
+Genuine transient provider failures (rate limits, 5xx, network, and
+*messaged* gateway timeouts) must still be retried.
+"""
+
+from __future__ import annotations
+
+import asyncio
+
+from antigravity_engine.hub.refresh_pipeline import _is_retryable_error
+
+
+def test_bare_wait_for_timeout_is_not_retryable() -> None:
+    # asyncio.TimeoutError() and TimeoutError() carry an empty message.
+    assert _is_retryable_error(asyncio.TimeoutError()) is False
+    assert _is_retryable_error(TimeoutError()) is False
+
+
+def test_messaged_gateway_timeout_is_retryable() -> None:
+    # A provider-side timeout carries a message and stays retryable.
+    assert _is_retryable_error(TimeoutError("504 Gateway Time-out")) is True
+
+
+def test_transient_provider_errors_are_retryable() -> None:
+    assert _is_retryable_error(RuntimeError("connection reset by peer")) is True
+    assert _is_retryable_error(RuntimeError("rate limit exceeded")) is True
+    assert _is_retryable_error(RuntimeError("503 Service Unavailable")) is True
+    assert _is_retryable_error(RuntimeError("network is unreachable")) is True
+
+
+def test_non_transient_errors_are_not_retryable() -> None:
+    assert _is_retryable_error(ValueError("invalid api key")) is False
+    assert _is_retryable_error(RuntimeError("bad request: malformed prompt")) is False
```

---

### Incident Patch 15: `04c453ca` (2026-06-04)
**Commit Message**: fix(cli): drop redundant templates force-include that broke the wheel build

`packages = ["src/ag_cli"]` already includes src/ag_cli/templates, so the extra
`force-include` re-added every template file at the same wheel path. Newer
hatchling rejects duplicate archive paths (ValueError: a second file is being
added ... `ag_cli/templates/.clinerules`), which failed `pip install ./cli` in
the cli-check CI job (all Python versions). Removing the redundant force-include
builds a clean wheel with all 12 templates present exactly once.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `cli/pyproject.toml` (modified, +0/-3)
```diff
@@ -20,6 +20,3 @@ ag = "ag_cli.cli:app"
 # ── Hatch build configuration ──────────────────────────────────────
 [tool.hatch.build.targets.wheel]
 packages = ["src/ag_cli"]
-
-[tool.hatch.build.targets.wheel.force-include]
-"src/ag_cli/templates" = "ag_cli/templates"
```

#### Recent Merged Pull Requests:
- **PR #117** (2026-08-27): docs: fix documentation inaccuracies flagged by Codex in PR #115 (@study8677)
- **PR #116** (2026-08-27): docs: update hub/ layout in READMEs to match actual files (@study8677)
- **PR #115** (2026-08-27): docs: update documentation to match current codebase (2026-08) (@study8677)
- **PR #114** (2026-08-26): feat: add true agent-group incremental refresh (@Lling0000)
- **PR #113** (2026-08-24): feat: generic host-runner + rb-ask --json for programmatic callers (@study8677)
- **PR #112** (closed): build(deps): update openai-agents requirement from <0.19,>=0.12 to >=0.12,<0.22 in /engine (@dependabot[bot])
- **PR #110** (closed): build(deps): update openai-agents requirement from <0.19,>=0.12 to >=0.12,<0.21 in /engine (@dependabot[bot])
- **PR #109** (2026-08-14): docs: add opt-in DeepSeek Harness CLI/MCP overlay (@study8677)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

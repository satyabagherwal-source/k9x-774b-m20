# Forensic Learning Record (Deep Inspection): yvgude/lean-ctx

> **Canonical Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:38:02.218Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yvgude/lean-ctx`
- **Description**: LeanCTX — Context Intelligence for AI systems.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3837 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `_archive/bench/agent-task/r2/preflight.mjs`
```
#!/usr/bin/env node
// R2 faithful-arm preflight — prove "installed = running as designed" before a
// priced run. Targets the R1 finding that the agent logged 102 native `bash`
// calls and 0 `ctx_shell` calls, so the heaviest addressable surface in a fix
// task (make / reproducer / test logs) never reached the compressor (#361).
//
// It verifies, on THIS machine, that:
//   1. the lean-ctx binary is present (and reports its version),
//   2. the resolved pi config suppresses native `bash` (mode=replace or
//      routeShell), so the agent must use `ctx_shell` — the suppression itself
//      is the unit-tested invariant `resolveSuppressedBuiltins` in
//      packages/pi-lean-ctx/extensions/config.ts,
//   3. the embedded MCP bridge / session cache is enabled,
//   4. the faithful-arm overhead levers are set (rules_injection=off,
//      tool_profile=minimal, structure_first),
//   5. lean-ctx actually compresses shell output (measured: smaller than raw).
//
// A green run is the precondition devasur asked for: shell routes through
// ctx_shell and is metered, not native bash.
//
// Usage:
//   node bench/agent-task/r2/preflight.mjs [--config <path>]
//
// POSIX shell is assumed for the compression probe (the R2 rail is the
// forge-cli / pi runtime on Linux). Exit code 1 if any hard gate fails.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const RECOMMENDED_MIN_VERSION = "3.8.6"; // anti-inflation guard + bridged ctx_read

// ── tiny PASS/FAIL/WARN reporter ──────────────────────────────────────────
let failed = false;
const pass = (name, detail) => console.log(`  [PASS] ${name.padEnd(24)} ${detail}`);
const warn = (name, detail) => console.log(`  [WARN] ${name.padEnd(24)} ${detail}`);
const fail = (name, detail) => {
  console.log(`  [FAIL] ${name.padEnd(24)} ${detail}`);
  failed = true;
};
const gate = (ok, name, okDetail, failDetail) =>
  ok ? pass(name, okDetail) : fail(name, failDetail);

// ── config resolution (mirrors extensions/config.ts precedence) ───────────
function envFlag(name) {
  const raw = process.env[name];
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function parseConfigArg() {
  const i = process.argv.indexOf("--config");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

function resolveConfigPath() {
  const explicit = parseConfigArg();
  if (explicit) return explicit;
  const installed = resolve(
    homedir(), ".pi", "agent", "extensions", "pi-lean-ctx", "config.json",
  );
  if (existsSync(installed)) return installed;
  // Fall back to this repo's reference config so the preflight self-tests
  // locally even when the extension is not installed on the dev machine.
  return resolve(SCRIPT_DIR, "pi-config.json");
}

function readConfig(path) {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    fail("config.json", `invalid JSON at ${path} (${err.message})`);
    return {};
  }
}

// Effective env value: an explicit process env always wins over the config
// `env` block the extension forwards to every lean-ctx subprocess.
function effectiveEnv(cfg, key) {
  return process.env[key] ?? (cfg.env && typeof cfg.env === "object" ? cfg.env[key] : undefined);
}

function resolveMode(cfg) {
  const raw = (process.env.LEAN_CTX_PI_MODE ?? cfg.mode ?? "additive").toLowerCase();
  return raw === "replace" ? "replace" : "additive";
}

function resolveRouteShell(mode, cfg) {
  if (mode === "replace") return true;
  if (process.env.LEAN_CTX_PI_ROUTE_SHELL !== undefined) return envFlag("LEAN_CTX_PI_ROUTE_SHELL");
  return cfg.routeShell === true;
}

function resolveEnableMcp(cfg) {
  return process.env.LEAN_CTX_PI_ENABLE_MCP !== undefined
    ? envFlag("LEAN_CTX_PI_ENABLE_MCP")
    : cfg.enableMcp !== false;
}

function resolveBinary() {
  return process.env.LEAN_CTX_BIN || "lean-ctx";
}

function compareSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// ── individual checks ─────────────────────────────────────────────────────
function checkBinary(bin) {
  try {
    const out = execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
    pass("lean-ctx binary", out);
    const m = out.match(/(\d+\.\d+\.\d+)/);
    if (m && compareSemver(m[1], RECOMMENDED_MIN_VERSION) < 0) {
      warn("version", `${m[1]} < ${RECOMMENDED_MIN_VERSION} — pin a release with the anti-inflation + routeShell fixes`);
    }
    return true;
  } catch (err) {
    fail("lean-ctx binary", `not runnable (${err.message}) — set LEAN_CTX_BIN or add lean-ctx to PATH`);
    return false;
  }
}

function checkShellRouting(mode, routeShell) {
  // resolveSuppressedBuiltins (config.ts, unit-tested): replace ⇒ all natives,
  // additive+routeShell ⇒ just bash, additive ⇒ none. bash gone ⟺ the agent
  // cannot pick native bash and must use ctx_shell.
  const bashSuppressed = mode === "replace" || routeShell;
  gate(
    bashSuppressed,
    "shell routing",
    `native bash suppressed (mode=${mode}, routeShell=${routeShell}) → ctx_shell only`,
    `native bash still exposed (mode=${mode}, routeShell=${routeShell}) — set "mode":"replace" or "routeShell":true, else the agent reproduces R1's 102 bash / 0 ctx_shell`,
  );
}

function checkBridge(enableMcp) {
  gate(
    enableMcp,
    "session cache",
    "embedded MCP bridge enabled (unchanged re-reads ~13 tokens)",
    'embedded bridge disabled — remove "enableMcp":false / LEAN_CTX_PI_ENABLE_MCP=0',
  );
}

function checkFaithfulLevers(cfg) {
  const rules = (effectiveEnv(cfg, "LEAN_CTX_RULES_INJECTION") || "").toLowerCase();
  gate(rules === "off", "rules_injection", "off (no per-turn rule-file prefix)", `"${rules || "unset"}" — set LEAN_CTX_RULES_INJECTION=off`);

  const profile = (effectiveEnv(cfg, "LEAN_CTX_TOOL_PROFILE") || "").toLowerCase();
  gate(profile === "minimal", "tool_profile", "minimal (6-tool core)", `"${profile || "unset"}" — set LEAN_CTX_TOOL_PROFILE=minimal`);

  const structureRaw = effectiveEnv(cfg, "LEAN_CTX_STRUCTURE_FIRST");
  const structureOn = ["1", "true", "yes", "on"].includes((structureRaw || "").toLowerCase());
  gate(structureOn, "structure_first", "on (capability-safe cold-read bias)", `"${structureRaw || "unset"}" — set LEAN_CTX_STRUCTURE_FIRST=1`);
}

function checkCompression(bin) {
  // Real proof that shell output is compressed (and therefore metered), without
  // depending on a footer string: run a log-like command raw vs through
  // lean-ctx and assert the lean-ctx output is strictly smaller. The generator is
  // a single `awk` BEGIN loop: it avoids shell command-substitution (so the probe
  // runs under shell_strict_mode) and `awk` is in the default shell_allowlist —
  // unlike `seq`, which mode=replace blocks, making the probe false-fail (#361).
  const cmd =
    'awk \'BEGIN { for (i = 1; i <= 80; i++) printf "[INFO] building module %d of 80 ... ok\\n", i }\'';
  try {
    const raw = execFileSync("/bin/sh", ["-c", cmd], { encoding: "utf8" });
    const compressed = execFileSync(bin, ["-c", cmd], {
      encoding: "utf8",
      env: { ...process.env, LEAN_CTX_COMPRESS: "1", LEAN_CTX_SAVINGS_FOOTER: "always" },
    });
    const pct = raw.length > 0 ? Math.round((1 - compressed.length / raw.length) * 100) : 0;
    gate(
      compressed.length < raw.length,
      "shell compression",
      `${raw.length} → ${compressed.length} bytes (-${pct}%) via ctx_shell path`,
      `lean-ctx output (
```

### Core Architecture Module: `_archive/bench/agent-task/swebench_harness/__init__.py`
```
"""Agent-Task-Benchmark v1 harness (GL #493) — shared helpers.

Measures task success rate and cost per solved task for an agentic coding
workload (SWE-bench Verified subset), with and without lean-ctx, under the
pre-registered protocol in ../PROTOCOL.md.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

BENCH_ROOT = Path(__file__).resolve().parent.parent

ARMS = ("native", "leanctx")


def load_config() -> dict:
    return json.loads((BENCH_ROOT / "config.json").read_text())


def load_tasks_lock() -> list:
    lock = BENCH_ROOT / "tasks.lock.json"
    if not lock.exists():
        raise SystemExit(
            "tasks.lock.json missing — generate it once with: python -m swebench_harness.select_tasks"
        )
    return json.loads(lock.read_text())["instances"]


def canonical_dumps(obj) -> str:
    """Stable JSON for hashing: sorted keys, no float surprises, no whitespace drift."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_jsonl(path: Path) -> list:
    rows = []
    with path.open() as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows

```

### Core Architecture Module: `_archive/bench/agent-task/swebench_harness/collect.py`
```
"""Assemble per-arm predictions.jsonl for the official SWE-bench evaluation.

Usage:
    python -m swebench_harness.collect --run-id v1
Then evaluate each arm (docker required):
    python -m swebench.harness.run_evaluation \
        --dataset_name princeton-nlp/SWE-bench_Verified \
        --predictions_path runs/v1/predictions-native.jsonl \
        --run_id v1-native --max_workers 4
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import ARMS, BENCH_ROOT, load_config, load_tasks_lock


def collect_arm(run_root: Path, arm: str, instances: list) -> Path:
    out_path = run_root / f"predictions-{arm}.jsonl"
    rows, missing = [], []
    for inst in instances:
        iid = inst["instance_id"]
        patch_file = run_root / iid / arm / "model_patch.diff"
        if not patch_file.exists():
            missing.append(iid)
            continue
        rows.append({
            "instance_id": iid,
            "model_name_or_path": f"claude-code-{arm}",
            "model_patch": patch_file.read_text(),
        })
    with out_path.open("w") as fh:
        for row in rows:
            fh.write(json.dumps(row) + "\n")
    print(f"{arm}: {len(rows)} predictions -> {out_path}" + (f" (missing: {', '.join(missing)})" if missing else ""))
    return out_path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run-id", required=True)
    args = ap.parse_args()

    cfg = load_config()
    run_root = BENCH_ROOT / cfg["runs_dir"] / args.run_id
    instances = load_tasks_lock()
    for arm in ARMS:
        collect_arm(run_root, arm, instances)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `_archive/bench/agent-task/swebench_harness/preflight.py`
```
"""Preflight: verify the machine can run the benchmark before spending money.

Checks everything the runbook needs — binaries, auth, docker, network, the
frozen task lock — and prints one PASS/FAIL line each. Exit 1 if anything
required for the requested stage is missing.

Usage:
    python3 -m swebench_harness.preflight             # checks for agent runs
    python3 -m swebench_harness.preflight --evaluate  # also checks docker
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request

from . import BENCH_ROOT, load_config


def run(cmd: list) -> "tuple[int, str]":
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30)
        return res.returncode, (res.stdout or "").strip()
    except FileNotFoundError:
        return 127, "not found"
    except subprocess.TimeoutExpired:
        return 124, "timed out"


class Preflight:
    def __init__(self) -> None:
        self.failed = False

    def check(self, name: str, ok: bool, detail: str) -> None:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name:<28} {detail}")
        if not ok:
            self.failed = True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--evaluate", action="store_true", help="also check the docker evaluation prerequisites")
    args = ap.parse_args()

    cfg = load_config()
    pf = Preflight()
    print("agent-run prerequisites:")

    code, out = run([cfg["agent"]["binary"], "--version"])
    pf.check("claude CLI", code == 0, out.splitlines()[0] if out else "not found")

    code, out = run([cfg["leanctx"]["binary"], "--version"])
    pf.check("lean-ctx CLI", code == 0, out.splitlines()[0] if out else "not found")

    code, out = run(["git", "--version"])
    pf.check("git", code == 0, out)

    has_key = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
    pf.check(
        "ANTHROPIC_API_KEY",
        has_key,
        "set" if has_key else "missing — fresh-HOME runs have no stored login (export it first)",
    )

    lock = BENCH_ROOT / "tasks.lock.json"
    if lock.exists():
        n = json.loads(lock.read_text())["n"]
        pf.check("tasks.lock.json", True, f"frozen, n={n}")
    else:
        pf.check("tasks.lock.json", False, "missing — python3 -m swebench_harness.select_tasks (one-time)")

    try:
        with urllib.request.urlopen("https://github.com", timeout=10) as resp:
            pf.check("github.com reachable", resp.status < 500, f"HTTP {resp.status} (repo mirrors clone from here)")
    except OSError as e:
        pf.check("github.com reachable", False, str(e))

    free_gb = shutil.disk_usage(BENCH_ROOT).free / 1e9
    pf.check("disk space", free_gb > 20, f"{free_gb:.0f} GB free (mirrors ~2 GB, eval images need more)")

    if args.evaluate:
        print("evaluation prerequisites:")
        code, out = run(["docker", "info", "--format", "{{.ServerVersion}}"])
        pf.check("docker daemon", code == 0, f"server {out}" if code == 0 else out[-120:])
        code, out = run([sys.executable, "-c", "import swebench; print(swebench.__version__)"])
        pf.check("swebench package", code == 0, out if code == 0 else "pip install -r requirements.txt")

    if pf.failed:
        sys.exit(1)
    print("all checks passed.")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `_archive/bench/agent-task/swebench_harness/report.py`
```
"""Compute endpoints (PROTOCOL.md §5) and emit the verifiable result artifact.

Inputs: per-run meta.json files + the official SWE-bench evaluation reports.
Output: runs/<id>/result-v1.json (canonical, self-hashing) + markdown summary.

Usage:
    python -m swebench_harness.report --run-id v1 \
        --eval-report native=claude-code-native.v1-native.json \
        --eval-report leanctx=claude-code-leanctx.v1-leanctx.json
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

from . import ARMS, BENCH_ROOT, canonical_dumps, load_config, load_tasks_lock, sha256_file, sha256_text


def arm_metrics(run_root: Path, arm: str, instances: list, resolved_ids: set) -> dict:
    metas = []
    for inst in instances:
        meta_file = run_root / inst["instance_id"] / arm / "meta.json"
        if meta_file.exists():
            metas.append(json.loads(meta_file.read_text()))
    n = len(metas)
    resolved = sum(1 for m in metas if m["instance_id"] in resolved_ids)
    usable = [m for m in metas if not m.get("usage_missing")]
    total_cost = round(sum(m.get("total_cost_usd") or 0.0 for m in usable), 4)
    input_tokens = [m["input_tokens"] for m in usable if m.get("input_tokens") is not None]
    output_tokens = [m["output_tokens"] for m in usable if m.get("output_tokens") is not None]
    return {
        "n_run": n,
        "resolved": resolved,
        "resolved_rate": round(resolved / n, 4) if n else None,
        "usage_missing_runs": n - len(usable),
        "total_cost_usd": total_cost,
        "cost_per_resolved_usd": round(total_cost / resolved, 4) if resolved else None,
        "median_input_tokens": statistics.median(input_tokens) if input_tokens else None,
        "median_output_tokens": statistics.median(output_tokens) if output_tokens else None,
        "median_wall_time_seconds": statistics.median(m["wall_time_seconds"] for m in metas) if metas else None,
        "timed_out_runs": sum(1 for m in metas if m.get("timed_out")),
        "resolved_instance_ids": sorted(m["instance_id"] for m in metas if m["instance_id"] in resolved_ids),
    }


def load_resolved_ids(report_path: Path) -> set:
    report = json.loads(report_path.read_text())
    ids = report.get("resolved_ids")
    if ids is None:
        sys.exit(f"{report_path}: no resolved_ids field — pass the official run_evaluation report")
    return set(ids)


def render_markdown(result: dict) -> str:
    lines = [
        "# Agent-Task-Benchmark v1 — result",
        "",
        f"run_id `{result['run_id']}` · N={result['n_tasks']} (SWE-bench Verified subset) · protocol sha256 `{result['protocol_sha256'][:16]}…`",
        "",
        "| endpoint | native | leanctx |",
        "|---|---|---|",
    ]
    rows = [
        ("resolved", "resolved"),
        ("resolved rate", "resolved_rate"),
        ("total cost (USD)", "total_cost_usd"),
        ("cost / resolved task (USD)", "cost_per_resolved_usd"),
        ("median billed input tokens", "median_input_tokens"),
        ("median output tokens", "median_output_tokens"),
        ("median wall time (s)", "median_wall_time_seconds"),
        ("timed-out runs", "timed_out_runs"),
    ]
    for label, key in rows:
        lines.append(f"| {label} | {result['arms']['native'][key]} | {result['arms']['leanctx'][key]} |")
    lines += ["", f"artifact sha256: `{result['artifact_sha256']}`", ""]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--eval-report", action="append", required=True,
                    metavar="ARM=PATH", help="official evaluation report per arm")
    args = ap.parse_args()

    reports = {}
    for spec in args.eval_report:
        arm, _, path = spec.partition("=")
        if arm not in ARMS or not path:
            sys.exit(f"bad --eval-report '{spec}' (expected ARM=PATH)")
        reports[arm] = Path(path)
    if set(reports) != set(ARMS):
        sys.exit(f"need eval reports for both arms: {ARMS}")

    cfg = load_config()
    instances = load_tasks_lock()
    run_root = BENCH_ROOT / cfg["runs_dir"] / args.run_id

    result = {
        "benchmark": "lean-ctx agent-task v1 (GL #493)",
        "run_id": args.run_id,
        "n_tasks": len(instances),
        "protocol_sha256": sha256_file(BENCH_ROOT / "PROTOCOL.md"),
        "tasks_lock_sha256": sha256_file(BENCH_ROOT / "tasks.lock.json"),
        "arms": {
            arm: arm_metrics(run_root, arm, instances, load_resolved_ids(reports[arm]))
            for arm in ARMS
        },
    }
    result["artifact_sha256"] = sha256_text(canonical_dumps(result))

    out_json = run_root / "result-v1.json"
    out_json.write_text(canonical_dumps(result) + "\n")
    out_md = run_root / "result-v1.md"
    out_md.write_text(render_markdown(result))
    print(render_markdown(result))
    print(f"wrote {out_json} + {out_md}")
    print("sign it:  ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n lean-ctx-bench " + str(out_json))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `_archive/bench/agent-task/swebench_harness/run_arm.py`
```
"""Run one benchmark arm over the locked task set (PROTOCOL.md §3-§4).

Per (instance, arm): clean checkout of base_commit → identical prompt →
Claude Code headless → transcript.jsonl + model_patch.diff + meta.json.

Isolation: every run gets a fresh HOME so the operator's global lean-ctx /
agent config cannot bleed into either arm. The `leanctx` arm gets its MCP
wiring exclusively from `lean-ctx init --agent claude` inside the workspace.

Usage:
    python -m swebench_harness.run_arm --arm native  --run-id v1
    python -m swebench_harness.run_arm --arm leanctx --run-id v1 [--instance ID]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from . import ARMS, BENCH_ROOT, load_config, load_tasks_lock


def sh(cmd: list, cwd: Path = None, env: dict = None, timeout: int = None) -> "subprocess.CompletedProcess":
    return subprocess.run(
        cmd, cwd=str(cwd) if cwd else None, env=env, timeout=timeout,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )


def ensure_repo_mirror(repo: str, cache_dir: Path) -> Path:
    mirror = cache_dir / f"{repo.replace('/', '__')}.git"
    if not mirror.exists():
        mirror.parent.mkdir(parents=True, exist_ok=True)
        print(f"  mirror-clone {repo} …")
        res = sh(["git", "clone", "--mirror", f"https://github.com/{repo}.git", str(mirror)])
        if res.returncode != 0:
            raise RuntimeError(f"mirror clone failed for {repo}:\n{res.stdout[-2000:]}")
    return mirror


def checkout_workspace(mirror: Path, base_commit: str, workspace: Path) -> None:
    res = sh(["git", "clone", "--no-checkout", str(mirror), str(workspace / "repo")])
    if res.returncode != 0:
        raise RuntimeError(f"clone from mirror failed:\n{res.stdout[-2000:]}")
    res = sh(["git", "checkout", "--force", base_commit], cwd=workspace / "repo")
    if res.returncode != 0:
        raise RuntimeError(f"checkout {base_commit} failed:\n{res.stdout[-2000:]}")


def fresh_home(run_dir: Path) -> dict:
    home = run_dir / "home"
    home.mkdir(parents=True, exist_ok=True)
    env = {
        "HOME": str(home),
        "PATH": os.environ["PATH"],
        "GIT_TERMINAL_PROMPT": "0",
        "TERM": "dumb",
    }
    for key in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"):
        if os.environ.get(key):
            env[key] = os.environ[key]
    if "ANTHROPIC_API_KEY" not in env and "ANTHROPIC_AUTH_TOKEN" not in env:
        sys.exit("ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) must be set — fresh-HOME runs have no stored login.")
    return env


def setup_leanctx(cfg: dict, repo_dir: Path, env: dict, run_dir: Path) -> Path:
    """`lean-ctx init --agent claude` in the workspace, then pin the MCP surface.

    init registers the MCP server in the fresh HOME's `~/.claude.json` (plus
    the CLAUDE.md rules in the repo). Relying on that implicit user-scope
    lookup would make the arm fragile, so the `mcpServers` block is extracted
    into an explicit config the agent is pinned to via `--strict-mcp-config`.
    A missing registration is a hard error — the arm must never silently run
    without lean-ctx.
    """
    binary = cfg["leanctx"]["binary"]
    res = sh([binary, *cfg["leanctx"]["init_args"]], cwd=repo_dir, env=env)
    (run_dir / "leanctx-init.log").write_text(res.stdout)
    if res.returncode != 0:
        raise RuntimeError(f"lean-ctx init failed (see {run_dir / 'leanctx-init.log'})")

    servers = {}
    for candidate in (repo_dir / ".mcp.json", Path(env["HOME"]) / ".claude.json"):
        if candidate.exists():
            servers = json.loads(candidate.read_text()).get("mcpServers") or {}
            if "lean-ctx" in servers:
                break
    if "lean-ctx" not in servers:
        raise RuntimeError("lean-ctx init left no MCP registration — leanctx arm would be inert")

    mcp_config = run_dir / "mcp-config.json"
    mcp_config.write_text(json.dumps({"mcpServers": {"lean-ctx": servers["lean-ctx"]}}, indent=2) + "\n")
    return mcp_config


def agent_cmd(cfg: dict, prompt: str, mcp_config: "Path | None") -> list:
    cmd = [
        cfg["agent"]["binary"], "-p", prompt,
        "--output-format", cfg["agent"]["output_format"],
        "--max-turns", str(cfg["max_turns"]),
        *cfg["agent"]["extra_args"],
    ]
    # Both arms get a hard-pinned MCP surface: empty for native, exactly the
    # lean-ctx registration for leanctx (PROTOCOL.md §3).
    if mcp_config is None:
        cmd += ["--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}']
    else:
        cmd += ["--strict-mcp-config", "--mcp-config", str(mcp_config)]
    return cmd


def parse_usage(transcript: Path) -> dict:
    """Extract the runtime's own final usage report (stream-json `result` event)."""
    result = {}
    try:
        with transcript.open() as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if event.get("type") == "result":
                    result = event
    except OSError:
        pass
    usage = result.get("usage") or {}
    return {
        "usage_missing": not usage,
        "input_tokens": usage.get("input_tokens"),
        "output_tokens": usage.get("output_tokens"),
        "cache_creation_input_tokens": usage.get("cache_creation_input_tokens"),
        "cache_read_input_tokens": usage.get("cache_read_input_tokens"),
        "total_cost_usd": result.get("total_cost_usd"),
        "num_turns": result.get("num_turns"),
        "is_error": result.get("is_error"),
        "subtype": result.get("subtype"),
    }


def extract_patch(repo_dir: Path, out: Path) -> bool:
    sh(["git", "add", "-A"], cwd=repo_dir)
    res = sh(["git", "diff", "--cached"], cwd=repo_dir)
    out.write_text(res.stdout)
    return bool(res.stdout.strip())


def tool_versions(cfg: dict, arm: str, env: dict) -> dict:
    versions = {}
    res = sh([cfg["agent"]["binary"], "--version"], env=env)
    versions["agent"] = res.stdout.strip().splitlines()[0] if res.stdout else "unknown"
    if arm == "leanctx":
        res = sh([cfg["leanctx"]["binary"], "--version"], env=env)
        versions["leanctx"] = res.stdout.strip().splitlines()[0] if res.stdout else "unknown"
    return versions


def run_instance(cfg: dict, inst: dict, arm: str, run_root: Path, prompt_template: str) -> dict:
    iid = inst["instance_id"]
    run_dir = run_root / iid / arm
    if (run_dir / "meta.json").exists():
        print(f"  {iid}/{arm}: already done, skipping")
        return json.loads((run_dir / "meta.json").read_text())
    run_dir.mkdir(parents=True, exist_ok=True)

    mirror = ensure_repo_mirror(inst["repo"], BENCH_ROOT / cfg["repo_cache_dir"])
    checkout_workspace(mirror, inst["base_commit"], run_dir)
    repo_dir = run_dir / "repo"

    env = fresh_home(run_dir)
    mcp_config = setup_leanctx(cfg, repo_dir, env, run_dir) if arm == "leanctx" else None

    prompt = prompt_template.replace("{problem_statement}", inst["problem_statement"])
    cmd = agent_cmd(cfg, prompt, mcp_config)

    print(f"  {iid}/{arm}: running agent …")
    started = time.time()
    timed_out = False
    with (run_dir / "transcript.jsonl").open("w") as out:
        try:
            proc = subprocess.run(
                cmd, cwd=str(repo_dir), env=env, stdout=out,
                stderr=subprocess.STDOUT, timeout=cfg["timeout_seconds"],
            )
            agent_exit = proc.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
            agent_exit = -1
    wall = round(time.time() - started, 1)

    meta = {
        "instance_id": iid,
        "arm": arm,
        "agent_exit_code": agent_exit,
        "timed_out": timed_out,
        "wall_time_seconds": wall,
        "has_pa
```

### Core Architecture Module: `_archive/bench/agent-task/swebench_harness/select_tasks.py`
```
"""Deterministic task selection → tasks.lock.json (run exactly once; see PROTOCOL.md §2).

Selection rule (pre-registered): sort all SWE-bench-Verified instances by
instance_id; group by repo; visit repos in ascending name order round-robin,
taking the lexicographically first untaken instance per repo each cycle,
until N are selected. No seed, no randomness — fully reproducible from the
public dataset.

The lock embeds everything the runner needs (problem statement, base commit),
so benchmark runs do not depend on Hugging Face availability.
"""

from __future__ import annotations

import json
import sys
from collections import OrderedDict

from . import BENCH_ROOT, canonical_dumps, load_config, sha256_text


def select(instances: list, n: int) -> list:
    by_repo: "OrderedDict[str, list]" = OrderedDict()
    for inst in sorted(instances, key=lambda r: r["instance_id"]):
        by_repo.setdefault(inst["repo"], []).append(inst)

    picked = []
    while len(picked) < n:
        progressed = False
        for repo in sorted(by_repo):
            if by_repo[repo]:
                picked.append(by_repo[repo].pop(0))
                progressed = True
                if len(picked) == n:
                    break
        if not progressed:
            break
    return picked


def main() -> None:
    lock_path = BENCH_ROOT / "tasks.lock.json"
    if lock_path.exists():
        sys.exit(f"{lock_path} already exists — the v1 lock is frozen (PROTOCOL.md §2).")

    cfg = load_config()
    from datasets import load_dataset  # heavy import, only needed here

    ds = load_dataset(cfg["dataset"], split=cfg["split"])
    picked = select(list(ds), cfg["n_tasks"])

    keep = [
        "instance_id",
        "repo",
        "base_commit",
        "environment_setup_commit",
        "version",
        "problem_statement",
    ]
    instances = [{k: inst[k] for k in keep} for inst in picked]
    payload = {
        "dataset": cfg["dataset"],
        "split": cfg["split"],
        "selection_rule": "sorted-round-robin-by-repo (PROTOCOL.md §2)",
        "n": len(instances),
        "instances": instances,
    }
    text = canonical_dumps(payload)
    lock_path.write_text(text + "\n")
    print(f"wrote {lock_path} ({len(instances)} instances, sha256 {sha256_text(text)[:16]}…)")
    for inst in instances:
        print(f"  {inst['instance_id']}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `_archive/bench/compress/benchmark.py`
```
#!/usr/bin/env python3
"""Head-to-head compression benchmark: lean-ctx `/v1/compress` vs Headroom.

Runs both libraries over the *same* real corpus with the *same* tokenizer and
reports compression ratio + latency as JSON. Numbers are always measured, never
fabricated: a tool that is not installed/reachable is reported as
``available: false`` rather than guessed.

Prerequisites
-------------
* lean-ctx daemon with ``POST /v1/compress`` running (``lean-ctx dev-install``).
* Optional head-to-head: ``pip install headroom-ai``.
* Optional accurate token counts: ``pip install tiktoken`` (else char counts).

Usage
-----
    python bench/compress/benchmark.py                  # JSON to stdout
    python bench/compress/benchmark.py --corpus docs/   # custom corpus
    python bench/compress/benchmark.py --out report.json --model gpt-4o
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
PY_SDK = REPO_ROOT / "packages" / "python-lean-ctx"
if PY_SDK.is_dir():
    sys.path.insert(0, str(PY_SDK))

Message = Dict[str, Any]


def build_tokenizer(model: str) -> tuple[Callable[[str], int], str]:
    """Return ``(count_fn, name)``. Prefers tiktoken; falls back to chars."""
    try:
        import tiktoken

        try:
            enc = tiktoken.encoding_for_model(model)
        except KeyError:
            enc = tiktoken.get_encoding("o200k_base")
        return (lambda text: len(enc.encode(text)), enc.name)
    except Exception:
        return (len, "chars")


def iter_text(content: Any):
    """Yield every text payload inside an OpenAI/Anthropic message content."""
    if isinstance(content, str):
        yield content
    elif isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text" and isinstance(block.get("text"), str):
                yield block["text"]
            elif block.get("type") == "tool_result":
                yield from iter_text(block.get("content"))


def total_tokens(messages: List[Message], count: Callable[[str], int]) -> int:
    return sum(count(text) for msg in messages for text in iter_text(msg.get("content")))


def load_corpus(path: Path, max_files: int, max_bytes: int) -> List[Message]:
    """Build one user message per real text file under ``path`` (no fixtures)."""
    if not path.exists():
        raise SystemExit(f"corpus path does not exist: {path}")
    suffixes = {".md", ".rs", ".py", ".ts", ".txt", ".json", ".log", ".yaml", ".yml"}
    files = sorted(p for p in path.rglob("*") if p.is_file() and p.suffix in suffixes)
    messages: List[Message] = []
    for file in files:
        if len(messages) >= max_files:
            break
        try:
            text = file.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if len(text) > max_bytes:
            text = text[:max_bytes]
        if text.strip():
            messages.append({"role": "user", "content": text})
    if not messages:
        raise SystemExit(f"no readable text files found under {path}")
    return messages


def measure(
    label: str,
    compress: Callable[[List[Message]], List[Message]],
    messages: List[Message],
    count: Callable[[str], int],
) -> Dict[str, Any]:
    """Run one compressor once, returning measured tokens + latency."""
    original = total_tokens(messages, count)
    started = time.perf_counter()
    try:
        out = compress(messages)
    except Exception as exc:  # noqa: BLE001 - any failure is reported, not raised
        return {"available": False, "error": f"{type(exc).__name__}: {exc}"}
    latency_ms = round((time.perf_counter() - started) * 1000, 2)
    compressed = total_tokens(out, count)
    ratio = round(1 - compressed / original, 4) if original else 0.0
    return {
        "available": True,
        "original_tokens": original,
        "compressed_tokens": compressed,
        "tokens_saved": original - compressed,
        "ratio": ratio,
        "latency_ms": latency_ms,
    }


def lean_ctx_compressor(model: str) -> Optional[Callable[[List[Message]], List[Message]]]:
    try:
        from lean_ctx import compress as lc_compress
    except ImportError:
        return None
    return lambda messages: lc_compress(messages, model=model)


def headroom_compressor(model: str) -> Optional[Callable[[List[Message]], List[Message]]]:
    try:
        from headroom import compress as hr_compress
    except ImportError:
        return None
    return lambda messages: hr_compress(messages, model=model).messages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", default=str(REPO_ROOT / "docs" / "reference"))
    parser.add_argument("--model", default="gpt-4o")
    parser.add_argument("--max-files", type=int, default=50)
    parser.add_argument("--max-bytes", type=int, default=200_000)
    parser.add_argument("--out", help="write the JSON report to this file")
    args = parser.parse_args()

    count, tokenizer = build_tokenizer(args.model)
    messages = load_corpus(Path(args.corpus), args.max_files, args.max_bytes)

    report: Dict[str, Any] = {
        "corpus": {
            "path": str(Path(args.corpus)),
            "messages": len(messages),
            "model": args.model,
            "tokenizer": tokenizer,
        },
    }

    lc = lean_ctx_compressor(args.model)
    report["lean_ctx"] = (
        measure("lean-ctx", lc, messages, count)
        if lc
        else {"available": False, "install": "pip install lean-ctx-sdk (and run the daemon)"}
    )

    hr = headroom_compressor(args.model)
    report["headroom"] = (
        measure("headroom", hr, messages, count)
        if hr
        else {"available": False, "install": "pip install headroom-ai"}
    )

    payload = json.dumps(report, indent=2)
    print(payload)
    if args.out:
        Path(args.out).write_text(payload + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1899** (2026-09-29): **bug: lean-ctx prints: <jemalloc>: option background_thread currently supports pthread only**
  *Symptoms*: On FreeBSD 15.1 lean-ctx prints: ``` $ lean-ctx --version <jemalloc>: option background_thread currently supports pthread only lean-ctx 3.10.2 (official, https://github.com/yvgude/lean-ctx) ```  

- **Issue #1898** (2026-09-29): **bug:**
  *Symptoms*: **lean-ctx version:** lean-ctx 3.10.2 (official, https://github.com/yvgude/lean-ctx)   **OS:** FreeBSD 15.1  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other) Claude CLI, kimi-2.7 model  **What happened:**  Claude CLI prints this: ```  Bash(cd /usr/ports/distfiles/pdfium && ls -lb | grep -a df65 | head -5; echo '---'; find . -maxdepth 1 -name 'df65*' -print0 | xxd | head -5)                   ⎿  Error: Exit code 127                                                                      /usr/local/bin/bash: line 1: _lc: command not found                                                                                                             /usr/local/bin/bash: line 1: _lc: command not found                                                                                                             /usr/local/bin/bash: line 1: _lc: command not found                                                                                                             ---                                                                                                                                                             /usr/local/bin/bash: line 1: _lc: command not found                                                                                                             /usr/local/bin/bash: line 1: _lc: command not found                                                                                                        ```  **What you expected:** n/a  **Steps to 

- **Issue #1876** (2026-09-27): **bug: Concurrent foreground ctx_shell calls**
  *Symptoms*:   Title: Concurrent foreground ctx_shell calls: one request never gets a response (the first caller to finish removes the shared job entry)    lean-ctx version: lean-ctx 3.10.4 (official, https://github.com/yvgude/lean-ctx). Also reproduced on 3.10.3 and 3.9.13. 3.9.12 is not affected.    OS: Linux — Ubuntu 22.04.4 LTS, kernel 5.15.0-191-generic, x86_64    AI tool: Ontocode CLI (a Codex-based agent host), with lean-ctx as a stdio MCP server started with no arguments. The agent issues tool calls in parallel.    What happened:   When two foreground ctx_shell calls are in progress at the same time, one returns normally and the other never gets a response.    - stdio: the stranded request never receives a JSON-RPC reply; the host times out.   - HTTP (lean-ctx serve): it ends with the 30 s request_timeout (HTTP 504).    Cause, from the source of v3.10.4, rust/src/server/background_shell.rs:    - run_foreground_or_detach calls start().   - start() builds the job id from the call's content: shell_ + blake3(command \0 cwd \0 timeout_ms \0 env).   - If a job with that id is already Running, start() returns the existing id instead of starting a new job (the #498 coalescing).   - So two identical foreground calls poll the same registry entry.   - When the job completes, the first caller to see it calls remove(&id) and returns Finished.   - The second caller then gets status(&id) == None on every poll. That never matches Completed or Cancelled, so it loops until the soft cap or the host 

- **Issue #1864** (2026-09-26): **bug: Install prevents opencode free tier from operating**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`) lean-ctx 3.10.2 (official, https://github.com/yvgude/lean-ctx)  **OS:** (macOS / Linux / Windows) Linux  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other) opencode  **What happened:** Running install modifies the opencode.jsonc config file and causes opencode to deny free tier requests.  **What you expected:** opencode to function  as normal  **Steps to reproduce:** 1. Auth to opencode zen with free tier account 2. Run lean-ctx install 3. Attempt to run a prompt through opencode  **Resolution:** Modifying the permissions section and changing from deny to prompt resolves the issue and lean-ctx is still called. 

- **Issue #1833** (2026-09-23): **bug: pi-lean-ctx ctx_shell does not forward its per-call timeout to lean-ctx -c**
  *Symptoms*: ## Environment  - `pi-lean-ctx 3.10.2` - `lean-ctx 3.10.2`  ## Summary  The Pi extension exposes `ctx_shell(..., timeout=<seconds>)`, but non-raw calls are still terminated by `lean-ctx -c` at its default 120-second limit when a larger timeout is requested.  The timeout reaches Pi’s outer Bash tool, but the extension’s spawn hook wraps the command as `lean-ctx -c <command>` without forwarding that timeout to the inner process.  ## Reproduction  In a Pi session with `pi-lean-ctx` enabled, run:  ```text ctx_shell(   command="sleep 125; printf 'COMPLETED\n'",   timeout=200 ) ```  ## Actual result  After approximately 120 seconds, the command exits with code 1:  ```text [lean-ctx: output truncated at 8 MB / 120s limit] ```  `COMPLETED` is not returned.  As a control, the same call with `raw=true` completes after 125 seconds. This isolates the failure to the `lean-ctx -c` wrapper rather than Pi’s outer Bash timeout.  ## Expected result  The command should print `COMPLETED` after approximately 125 seconds because it remains within the requested 200-second timeout.  If values above the inner limit cannot be honored, the schema should reject or accurately describe them instead of accepting them and failing at a lower undocumented limit.  ## Source-level mechanism  In `packages/pi-lean-ctx/extensions/index.ts`:  1. The public schema exposes `timeout` in seconds. 2. `execute` passes `{ command, timeout }` to Pi’s Bash tool. 3. The spawn hook rewrites the command to `lean-ctx -c <comman

- **Issue #1832** (2026-09-23): **bug: `ctx_overview` reports facts as task-relevant after only a generic verb match**
  *Symptoms*: ## Environment  ```text lean-ctx 3.10.2 (official, https://github.com/yvgude/lean-ctx) ```  ## Summary  A task-scoped `lean-ctx overview` can label unrelated knowledge as “relevant facts” when a fact and the task share only one generic action word. Two domain-disjoint tasks can therefore receive the same unrelated facts.  The reproduction below is fully isolated and synthetic. It changes `HOME` and all XDG data directories, creates a temporary Git repository, and imports synthetic knowledge through the public CLI.  ## Reproduction  Save as `repro.sh`, then run `bash repro.sh`:  ```bash #!/usr/bin/env bash set -euo pipefail  tmp="$(mktemp -d)" cleanup() {   lean-ctx serve --stop >/dev/null 2>&1 || true   rm -rf -- "$tmp" } trap cleanup EXIT  mkdir -p -- "$tmp/home" "$tmp/config" "$tmp/data" "$tmp/cache" "$tmp/repo" export HOME="$tmp/home" export XDG_CONFIG_HOME="$tmp/config" export XDG_DATA_HOME="$tmp/data" export XDG_CACHE_HOME="$tmp/cache"  git -C "$tmp/repo" init -q printf 'def validate_header(value):\n    return bool(value)\n' \   >"$tmp/repo/alpha_parser.py" printf 'package beta\n\nfunc Render(value string) string { return value }\n' \   >"$tmp/repo/beta_renderer.go"  cat >"$tmp/facts.json" <<'JSON' [   {     "category": "finding",     "key": "malformed-launcher",     "value": "Finding: #!/usr/bin/env: Inspect and review a synthetic workflow launcher.",     "confidence": 0.6   },   {     "category": "finding",     "key": "gamma-deployer",     "value": "Inspect and review 

- **Issue #1794** (2026-09-18): **bug: `ctx_read(mode="map")` treats TypeScript under a skill as an instruction file and returns truncated full source**
  *Symptoms*: ## Summary  `ctx_read` classifies ordinary TypeScript implementation files beneath a skill directory as instruction files. An explicit `mode="map"` request is overridden to `full`, which can return a large, truncated source body instead of the requested structural map.  ## Environment  - lean-ctx: 3.10.2 - OS: Linux - AI tool: Pi - Tool: `ctx_read` - Rule injection: disabled with `LEAN_CTX_RULES_INJECTION=off` (the failure still reproduces)  ## Steps to reproduce  1. In a project, create an ordinary TypeScript implementation file beneath a skill directory, for example:     ```text    .agents/skills/example/scripts/runtime.ts    ```     The file should be long enough for `map` mode to be useful; it does not need to contain instructions.  2. Call:     ```json    {      "path": "/path/to/project/.agents/skills/example/scripts/runtime.ts",      "mode": "map",      "fresh": true    }    ```  3. Observe that `ctx_read` overrides `map` to `full` because it considers the `.ts` source an instruction file.  The current reproduction was run against a 10,000-line TypeScript runtime source under `.agents/skills/.../scripts/`.  ## Expected behavior  An ordinary `.ts` implementation file should use the requested `map` mode. Instruction-file full-read enforcement should be limited to actual instruction documents such as `SKILL.md`, not every source file beneath a skill directory.  ## Actual behavior  The response starts with:  ```text [mode overridden: map -> full, reason=instruction file re

- **Issue #1793** (2026-09-18): **bug: shell allowlist rejects `[[ ... ]]` when an `if` follows earlier command segments**
  *Symptoms*: **lean-ctx version:** 3.10.2 (official)  **OS:** Linux x86_64  **AI tool:** Pi (`pi-lean-ctx` / `ctx_shell`)  ## What happened  `ctx_shell` accepts a standalone Bash conditional using `[[ ... ]]`, but rejects the same conditional when it appears later in a compound command after other command segments. The allowlist treats `[[` as a command name and blocks the entire command before execution.  This appears to be a regression or uncovered edge of the compound-command support merged in #474, which says `if/then/fi` bodies are expanded to their allowlisted leaf commands.  ## Control that succeeds  With the default shell gating and no environment/config override:  ```bash if [[ -n x ]]; then printf 'double-bracket=ok\n'; fi ```  Output:  ```text double-bracket=ok ```  ## Reproduction that fails  A read-only verification command with preceding segments and several `[[ ... ]]` predicates:  ```bash cd /path/to/project && \ printf '%s\n' 'verification:' && \ if [[ -z "$(git diff --name-only -- AGENTS.md)" ]] && \    [[ -x ./setup && -x ./scripts/lint && -x ./scripts/test ]] && \    [[ -d scripts && -d config ]]; then     echo 'No drift detected.' else     echo 'Drift detected.'     exit 1 fi ```  Actual result:  ```text [BLOCKED — DO NOT RETRY] '[[' is not in the shell allowlist. [pipeline: segment 3/16 blocked — the entire command was rejected before execution, no part of the pipeline ran] Command exited with code 126 ```  Replacing each `[[ ... ]]` predicate with `test ...` succeed

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

### Incident Patch 1: `ce5094ff` (2026-09-30)
**Commit Message**: Merge pull request #1951 from yvgude/fix/pi-brace-expansion

fix(deps): raise the brace-expansion floor to 5.0.12 in pi-lean-ctx

**File**: `packages/pi-lean-ctx/package-lock.json` (modified, +3/-3)
```diff
@@ -1320,9 +1320,9 @@
       "license": "MIT"
     },
     "node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

**File**: `packages/pi-lean-ctx/package.json` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@
   },
   "overrides": {
     "@hono/node-server": "^2.0.5",
-    "brace-expansion": "^5.0.9",
+    "brace-expansion": "^5.0.12",
     "vite": "^6.4.2",
     "esbuild": "^0.28.1",
     "undici": "^8.10.0",
```

---

### Incident Patch 2: `f3372c50` (2026-09-30)
**Commit Message**: Merge pull request #1948 from yvgude/fix/telemetry-lease-flake

test(telemetry): judge the send-lease/purge exclusion on outcomes, not timing

**File**: `rust/src/core/telemetry_aggregate/tests.rs` (modified, +19/-11)
```diff
@@ -245,22 +245,30 @@ fn histogram_edges_are_bounded_and_deterministic() {
 #[test]
 #[serial_test::serial]
 fn send_lease_blocks_purge_until_send_finishes() {
+    // Judged on outcomes, not on how fast a thread is scheduled: the earlier
+    // threaded version failed on a loaded macOS runner when purge had already
+    // hit its bounded lock timeout before the test started its 50 ms window.
     let _iso = crate::core::data_dir::isolated_data_dir();
     let lease = begin_daily_send().expect("begin send");
-    let (tx, rx) = std::sync::mpsc::channel();
-    let worker = std::thread::spawn(move || {
-        tx.send(purge_local_state()).expect("report purge");
-    });
+    let state = state_path().expect("state path");
+    assert!(
+        state.exists(),
+        "the send lease persists the aggregate state"
+    );
+
+    let error = purge_local_state().expect_err("purge must not run during an in-flight send");
+    assert!(
+        error.contains("timed out"),
+        "unexpected purge error: {error}"
+    );
     assert!(
-        rx.recv_timeout(std::time::Duration::from_millis(50))
-            .is_err(),
-        "purge must wait for in-flight send lease"
+        state.exists(),
+        "a refused purge must leave the state intact"
     );
+
     drop(lease);
-    rx.recv_timeout(std::time::Duration::from_secs(2))
-        .expect("purge completed")
-        .expect("purge succeeded");
-    worker.join().expect("purge worker");
+    purge_local_state().expect("purge succeeds once the send finished");
+    assert!(!state.exists(), "purge removes the aggregate state");
 }
 
 /// Two fixed buckets and the clock values that name them. Admission and day
```

---

### Incident Patch 3: `96952e44` (2026-09-30)
**Commit Message**: fix(deps): raise the brace-expansion floor to 5.0.12 in pi-lean-ctx

Dependabot alert #190 (moderate): brace-expansion >= 4.0.0, < 5.0.12 has a
quadratic-time expansion of the `{a},b}` rewrite (CPU denial of service).
pi-lean-ctx pins the package through `overrides` at "^5.0.9", and the lock
held 5.0.9 under @earendil-works/pi-coding-agent > minimatch. It is a dev
dependency, so nothing shipped is affected.

The override floor is now "^5.0.12", and the lock entry points at 5.0.12
with the registry's integrity hash (`npm view brace-expansion@5.0.12
dist.integrity`). The dependency set (balanced-match ^4.0.2) and engines
are unchanged. The same bump for _archive/vscode-extension landed as #1942.

The lock was edited by hand on purpose: the local npm 10.2.4 / Node 20 is
older than the package's engine range and strips the `libc` fields from 14
platform entries when it rewrites the lock.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `packages/pi-lean-ctx/package-lock.json` (modified, +3/-3)
```diff
@@ -1320,9 +1320,9 @@
       "license": "MIT"
     },
     "node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

**File**: `packages/pi-lean-ctx/package.json` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@
   },
   "overrides": {
     "@hono/node-server": "^2.0.5",
-    "brace-expansion": "^5.0.9",
+    "brace-expansion": "^5.0.12",
     "vite": "^6.4.2",
     "esbuild": "^0.28.1",
     "undici": "^8.10.0",
```

---

### Incident Patch 4: `3b544355` (2026-09-30)
**Commit Message**: fix(cli_cache): serialize the store's load-modify-save within the process

check_and_read, invalidate, clear and clear_project each load cache.json,
change their own key and write the whole file back. Two concurrent callers
(parallel tool calls in the daemon, or tests) raced: the later write dropped
the entry the other had just added. CI hit it as
ctx_refactor::reformat_jetbrains_scope_invalidates_all_changed_paths failing
its "b.kt must be cached after warming" premise (run 36734092333) while an
unisolated ctx_refactor test's invalidate() rewrote the same file.

A process-wide mutex now spans every load → save. The regression test runs
8 writers over 64 files in one data dir; without the lock it lost entries
in 3 of 3 runs, with it all 8 cli_cache tests pass.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `rust/src/core/cli_cache.rs` (modified, +49/-0)
```diff
@@ -87,6 +87,17 @@ fn normalize_key(path: &str) -> String {
     crate::core::pathutil::normalize_tool_path(path)
 }
 
+/// Serializes every load → modify → save of the store within this process.
+/// Without it, two concurrent callers (parallel tool calls in the daemon, or
+/// tests) each load the file, change their own key and write it back — and the
+/// later write silently drops the earlier caller's entry.
+fn store_guard() -> std::sync::MutexGuard<'static, ()> {
+    static STORE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
+    STORE_LOCK
+        .lock()
+        .unwrap_or_else(std::sync::PoisonError::into_inner)
+}
+
 fn load_store() -> CliCacheStore {
     let Some(path) = cache_file() else {
         return CliCacheStore::default();
@@ -125,6 +136,7 @@ pub(crate) fn check_and_read(path: &str) -> CacheResult {
     let key = normalize_key(path);
     let hash = compute_md5(&content);
     let now = now_secs();
+    let _guard = store_guard();
     let mut store = load_store();
 
     store.total_reads += 1;
@@ -167,12 +179,14 @@ pub(crate) fn check_and_read(path: &str) -> CacheResult {
 
 pub(crate) fn invalidate(path: &str) {
     let key = normalize_key(path);
+    let _guard = store_guard();
     let mut store = load_store();
     store.entries.remove(&key);
     save_store(&store);
 }
 
 pub(crate) fn clear() -> usize {
+    let _guard = store_guard();
     let mut store = load_store();
     let count = store.entries.len();
     store.entries.clear();
@@ -181,6 +195,7 @@ pub(crate) fn clear() -> usize {
 }
 
 pub(crate) fn clear_project(project_root: &str) -> usize {
+    let _guard = store_guard();
     let mut store = load_store();
     let prefix = normalize_key(project_root);
     let before = store.entries.len();
@@ -407,4 +422,38 @@ mod tests {
         crate::test_env::remove_var("LEAN_CTX_DATA_DIR");
         let _ = std::fs::remove_dir_all(&test_data_dir);
     }
+
+    #[test]
+    fn concurrent_writers_never_drop_each_others_entries() {
+        // Each writer loads the whole store, changes its own key and writes the
+        // file back. Unserialized, a later write dropped entries that a
+        // concurrent writer had just added (flaked ctx_refactor's
+        // `reformat_jetbrains_scope_invalidates_all_changed_paths`).
+        let data = crate::core::data_dir::isolated_data_dir();
+        let files: Vec<String> = (0..64)
+            .map(|i| {
+                let path = data.path().join(format!("f{i}.rs"));
+                std::fs::write(&path, format!("fn f{i}() {{}}\n")).unwrap();
+                path.to_str().unwrap().to_string()
+            })
+            .collect();
+
+        std::thread::scope(|s| {
+            for chunk in files.chunks(8) {
+                s.spawn(move || {
+                    for path in chunk {
+                        let _ = check_and_read(path);
+                    }
+                });
+            }
+        });
+
+        let store = load_store();
+        for path in &files {
+            assert!(
+                store.entries.contains_key(&normalize_key(path)),
+                "entry for {path} was lost to a concurrent write"
+            );
+        }
+    }
 }
```

---

### Incident Patch 5: `b85c1ce8` (2026-09-30)
**Commit Message**: fix(telemetry): give tests the production send-lock bound again

4e26419ac8 cut SEND_LOCK_TIMEOUT to 150 ms under cfg(test) so the tests that
sit out the timeout would hold the global test env lock for less time. But
two_callers_contending_over_one_bucket_admit_exactly_one_batch needs the
loser to *outwait* the winner's lease, and under Coverage's instrumentation
that took longer than 150 ms: "telemetry aggregate lock timed out after
150ms" (run 36719971816). Tests use the 750 ms production bound again; the
three timeout tests wait ~0.6 s longer each.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `rust/src/core/telemetry_aggregate.rs` (modified, +2/-5)
```diff
@@ -1384,12 +1384,9 @@ fn open_sidecar_lock(path: &std::path::Path) -> Result<std::fs::File, String> {
 
 /// Contention fails without mutating state; failed acknowledgements keep the
 /// frozen batch retryable. This bounds acquisition, not filesystem I/O.
-#[cfg(not(test))]
+/// Tests use the production bound: a contender must outwait a lease holder
+/// even under coverage instrumentation, where 150 ms timed out.
 const SEND_LOCK_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(750);
-/// Same bounded path, still several retries: contention tests sit out the full
-/// timeout while holding the global test env lock.
-#[cfg(test)]
-const SEND_LOCK_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(150);
 const SEND_LOCK_RETRY_INTERVAL: std::time::Duration = std::time::Duration::from_millis(25);
 
 /// Shared acquisition for aggregate, one-shot and ledger locks, in that order.
```

---

### Incident Patch 6: `de423337` (2026-09-30)
**Commit Message**: Merge pull request #1944 from yvgude/fix/shared-context-prune-flake

test: fix three CI timing flakes (prune age, run_git timeout, ETXTBSY)

**File**: `rust/src/core/git/mod.rs` (modified, +7/-3)
```diff
@@ -127,13 +127,17 @@ fn drain(pipe: Option<&mut impl Read>) -> String {
 mod tests {
     use super::*;
 
+    /// These tests check what `run_git` reports, not how fast git is. A loaded
+    /// Windows runner has taken more than 5 s for a plain `rev-parse`.
+    const TEST_TIMEOUT: Duration = Duration::from_secs(30);
+
     #[test]
     fn git_version_runs() {
         if !git_available() {
             return; // CI without git — nothing to assert
         }
-        let out = run_git(&["--version"], Path::new("."), Duration::from_secs(5), &[])
-            .expect("git --version");
+        let out =
+            run_git(&["--version"], Path::new("."), TEST_TIMEOUT, &[]).expect("git --version");
         assert!(out.success);
         assert!(out.stdout.to_lowercase().contains("git version"));
     }
@@ -146,7 +150,7 @@ mod tests {
         let out = run_git(
             &["rev-parse", "--verify", "definitely-not-a-ref"],
             Path::new("."),
-            Duration::from_secs(5),
+            TEST_TIMEOUT,
             &[],
         )
         .expect("git should run");
```

**File**: `rust/src/core/shared_context.rs` (modified, +8/-2)
```diff
@@ -621,9 +621,15 @@ mod tests {
         context.put("new one", "codex", "fact").unwrap();
         context.put("new two", "cursor", "fact").unwrap();
         let mut entries = context.load().unwrap();
-        entries[0].last_accessed = 0;
+        entries
+            .iter_mut()
+            .find(|entry| entry.content == "old")
+            .unwrap()
+            .last_accessed = 0;
         context.save(&entries).unwrap();
-        assert_eq!(context.prune(1, 1).unwrap(), 2);
+        // An hour, not a second: a slow runner must not age the fresh entries
+        // out. "old" expires by age, and one fresh entry goes to the cap.
+        assert_eq!(context.prune(3600, 1).unwrap(), 2);
         assert_eq!(context.stats().unwrap().total_entries, 1);
     }
 
```

**File**: `rust/src/lsp/format/mod.rs` (modified, +25/-2)
```diff
@@ -378,6 +378,29 @@ mod tests {
         );
     }
 
+    /// Spawn a formatter script the test has just written. When another test
+    /// thread forks while that write handle is still open, the child inherits
+    /// it and `exec` fails with ETXTBSY until the child execs or exits. Retry
+    /// only that error; any other spawn failure is returned at once.
+    #[cfg(unix)]
+    fn spawn_fresh_script(
+        template: &str,
+        abs_path: &str,
+        project_root: &str,
+    ) -> Result<CapturedFormatter, String> {
+        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
+        loop {
+            match spawn_command_formatter(template, abs_path, project_root) {
+                Err(error)
+                    if error.contains("Text file busy") && std::time::Instant::now() < deadline =>
+                {
+                    std::thread::sleep(std::time::Duration::from_millis(20));
+                }
+                result => return result,
+            }
+        }
+    }
+
     #[test]
     fn rs_defaults_to_rustfmt() {
         let f = resolve_formatter("/x/a.rs");
@@ -579,7 +602,7 @@ mod tests {
         let template = format!("{} {{file}}", formatter.display());
         let source_path = source.to_str().unwrap().to_owned();
         let project_root = dir.path().to_str().unwrap().to_owned();
-        let process = spawn_command_formatter(&template, &source_path, &project_root)
+        let process = spawn_fresh_script(&template, &source_path, &project_root)
             .expect("formatter process must spawn");
 
         assert!(
@@ -612,7 +635,7 @@ mod tests {
         let source = dir.path().join("a.rs");
         std::fs::write(&source, "fn x() {}\n").unwrap();
 
-        let process = spawn_command_formatter(
+        let process = spawn_fresh_script(
             &format!("{} {{file}}", formatter.display()),
             source.to_str().unwrap(),
             dir.path().to_str().unwrap(),
```

---

### Incident Patch 7: `e720abbf` (2026-09-30)
**Commit Message**: Merge pull request #1938 from yvgude/fix/1910-1911-compression

fix(read): compression never costs more than the raw file (#1910, #1911)

**File**: `CHANGELOG.md` (modified, +31/-0)
```diff
@@ -96,6 +96,37 @@ Format follows [Keep a Changelog](https://keepachangelog.com/).
   whole marker lines count as blocks, and a strip removes the solution block
   together with the lean-ctx block.
 
+### Fixed — `ctx_read` compression never costs more than the raw file (#1910, #1911)
+
+- `entropy` mode now compresses real source. It used to keep every line of a
+  typical Rust file, and `aggressiveness` had no effect. Lines are now dropped
+  against a file-relative surprise floor, so the default saves roughly 10–35%
+  and higher `aggressiveness` drops strictly more.
+- An `auto` read that resolves to a mode unable to shrink the file now returns
+  the bare file, never banner + file. Such reads used to cost more than raw on
+  ~600-token files. Explicit mode requests keep the "no compression applied"
+  banner. When the file exceeds the per-turn budget, the banner now says the
+  content is truncated and names `raw=true`.
+- `auto` and explicit reads of the same mode no longer share a cache entry, so
+  a banner-free fallback is never replayed to an explicit request, or the other
+  way round.
+- `html_` CCR handles from the proxy now resolve in `ctx_expand`.
+- `map` exports keep nested Rust generics intact.
+- The edit-quality penalty now escalates a mode with repeated edit failures
+  straight to `full`, as documented. It no longer steps down to a lossier
+  `signatures` or `map` view.
+- `entropy` reads are deterministic. Once `entropy` actually dropped lines,
+  two things made two reads of the same file differ, which defeats provider
+  prompt caching:
+  - the semantic line filter ran only while the embedding model happened to
+    be loaded;
+  - the learned thresholds (feedback, quality learner, bandit arm) shift
+    between calls.
+
+  Reads now use the per-language threshold adjusted by the file's own
+  compressibility, plus `aggressiveness`. The semantic filter is off for
+  reads.
+
 ### Fixed — quality claims match what the gates can show (#1905)
 
 - `lean-ctx eval ab` reports now print `POWER: underpowered` when a run has
```

**File**: `packages/pi-lean-ctx/extensions/index.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ const readModeSchema = Type.Union([
   Type.Literal("reference"),
   Type.Literal("task"),
   Type.String({ description: "lines:N-M window (e.g. lines:5-20)" }),
-], { description: "Override auto-selection: full=verbatim anchored=full+anchors(edit via ctx_patch) diff=git-delta map=structure signatures=API raw=exact-bytes lines:N-M=window auto=smart(default)" });
+], { description: "Override auto-selection: full=complete(≤turn budget; raw=true beyond) anchored=full+anchors(edit via ctx_patch) diff=git-delta map=structure signatures=API raw=exact-bytes lines:N-M=window auto=smart(default)" });
 
 // Kept field-compatible with the canonical MCP `ctx_read` schema (registry in
 // rust/src/tools/registered/ctx_read.rs) so the tool looks identical across
```

**File**: `rust/src/core/adaptive_thresholds.rs` (modified, +29/-6)
```diff
@@ -303,12 +303,7 @@ pub fn adaptive_thresholds(path: &str, content: &str) -> CompressionThresholds {
     base.bpe_entropy =
         (base.bpe_entropy + super::threshold_learning::learned_delta(ext)).clamp(0.4, 2.0);
 
-    if content.len() > 500 {
-        let k = kolmogorov_proxy(content);
-        let k_adjustment = (k - 0.45) * 0.5;
-        base.bpe_entropy = (base.bpe_entropy + k_adjustment).clamp(0.4, 2.0);
-        base.jaccard = (base.jaccard - k_adjustment * 0.3).clamp(0.5, 0.85);
-    }
+    apply_content_compressibility(&mut base, content);
 
     if let Some(project_root) =
         crate::core::session::SessionState::load_latest().and_then(|s| s.project_root)
@@ -331,6 +326,34 @@ pub fn adaptive_thresholds(path: &str, content: &str) -> CompressionThresholds {
     base
 }
 
+/// Shift the thresholds by the content's own compressibility (Kolmogorov
+/// proxy): a pure function of the text.
+fn apply_content_compressibility(base: &mut CompressionThresholds, content: &str) {
+    if content.len() > 500 {
+        let k = kolmogorov_proxy(content);
+        let k_adjustment = (k - 0.45) * 0.5;
+        base.bpe_entropy = (base.bpe_entropy + k_adjustment).clamp(0.4, 2.0);
+        base.jaccard = (base.jaccard - k_adjustment * 0.3).clamp(0.5, 0.85);
+    }
+}
+
+/// Thresholds for rendering a read: the per-language base adjusted by the
+/// content's compressibility, so the rendered text is a pure function of
+/// `(path, content)` (#498).
+///
+/// The learned blend in [`adaptive_thresholds`] — feedback store, threshold
+/// learner, bandit arm — moves between calls. Since #1910 the entropy
+/// threshold decides which lines survive, so two reads of one file could
+/// differ and bust provider prompt caches. The arm is still selected here, so
+/// the Phi field weights it sets keep working; only the text ignores the
+/// learned values.
+pub fn read_thresholds(path: &str, content: &str) -> CompressionThresholds {
+    let _learned = adaptive_thresholds(path, content);
+    let mut base = thresholds_for_path(path);
+    apply_content_compressibility(&mut base, content);
+    base
+}
+
 /// The bandit arm selected for a file's most recent threshold-driven read, kept
 /// so a *deferred* real outcome (bounce, edit-fail) can penalize the arm that
 /// actually produced the compression — instead of a hardcoded success (#593).
```

**File**: `rust/src/core/auto_mode_resolver.rs` (modified, +8/-12)
```diff
@@ -148,15 +148,11 @@ pub fn resolve(ctx: &AutoModeContext) -> ResolvedMode {
     let r = resolve_inner(ctx);
 
     // Quality loop (#494), signal 2: this mode keeps producing edit failures
-    // for this file type — compression here is a proven net loss. Instead of
-    // jumping straight to `full`, try `signatures` first (the next-safest
-    // compressed mode). This preserves ~85% compression when only `map` is risky.
+    // for this file type — compression here is a proven net loss, so serve
+    // `full` (docs/contracts/quality-loop-v1.md). #1911: no `signatures` step
+    // in between — a body-less view is exactly what the failing edits lacked,
+    // and the penalty may only ever escalate toward `full`.
     if r.mode != "full" && crate::core::edit_quality::is_risky_mode(ctx.path, &r.mode) {
-        if r.mode != "signatures"
-            && !crate::core::edit_quality::is_risky_mode(ctx.path, "signatures")
-        {
-            return resolved("signatures", "edit_quality_fallback");
-        }
         return resolved("full", "edit_quality_penalty");
     }
     r
@@ -263,10 +259,10 @@ fn resolve_inner(ctx: &AutoModeContext) -> ResolvedMode {
     // band: measured on this repo (#1914) roughly 0-20% below ~2.5k tokens and
     // 6-67% above. The #361 raw cap keeps `auto` from ever costing more than
     // the raw file, so the small tier degrades to a near-full read, not a loss.
-    if crate::core::cognitive_gate::basic_science_enabled()
-        && is_code(ext)
-        && ctx.token_count > 500
-        && !crate::core::edit_quality::has_any_penalty(ctx.path)
+    // #1911: no edit-penalty skip here — skipping cognitive fell through to a
+    // *lossier* `map`/`signatures`; a risky `cognitive` is escalated to `full`
+    // by the quality-loop check in `resolve` instead.
+    if crate::core::cognitive_gate::basic_science_enabled() && is_code(ext) && ctx.token_count > 500
     {
         if ctx.token_count > 8000 {
             return resolved("cognitive", "science_cognitive_large");
```

**File**: `rust/src/core/deps.rs` (modified, +57/-13)
```diff
@@ -152,21 +152,19 @@ fn extract_rust_deps(content: &str) -> DepInfo {
             }
         }
 
-        if trimmed.starts_with("pub fn ") || trimmed.starts_with("pub async fn ") {
-            if let Some(name) = trimmed
-                .split('(')
-                .next()
-                .and_then(|s| s.split_whitespace().last())
-            {
+        // #1911: cut at the first non-identifier char, so generics and
+        // lifetimes (`Foo<'a>`, `bar<T: X>(`) never leak into the export name.
+        let item = trimmed
+            .strip_prefix("pub fn ")
+            .or_else(|| trimmed.strip_prefix("pub async fn "))
+            .or_else(|| trimmed.strip_prefix("pub struct "))
+            .or_else(|| trimmed.strip_prefix("pub enum "))
+            .or_else(|| trimmed.strip_prefix("pub trait "));
+        if let Some(rest) = item {
+            let name = leading_identifier(rest.trim_start());
+            if !name.is_empty() {
                 exports.push(name.to_string());
             }
-        } else if (trimmed.starts_with("pub struct ")
-            || trimmed.starts_with("pub enum ")
-            || trimmed.starts_with("pub trait "))
-            && let Some(name) = trimmed.split_whitespace().nth(2)
-        {
-            let clean = name.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '_');
-            exports.push(clean.to_string());
         }
     }
 
@@ -176,6 +174,16 @@ fn extract_rust_deps(content: &str) -> DepInfo {
     }
 }
 
+/// The identifier `s` starts with (raw `r#ident` kept whole), up to the first
+/// char that cannot continue it — `<`, `(`, `:`, `{`, whitespace, ….
+fn leading_identifier(s: &str) -> &str {
+    let body_start = if s.starts_with("r#") { 2 } else { 0 };
+    let end = s[body_start..]
+        .find(|c: char| !(c.is_alphanumeric() || c == '_'))
+        .map_or(s.len(), |i| body_start + i);
+    if end == body_start { "" } else { &s[..end] }
+}
+
 fn extract_python_deps(content: &str) -> DepInfo {
     let mut imports = BTreeSet::new();
     let mut exports = Vec::new();
@@ -420,6 +428,42 @@ fn extract_export_name(line: &str) -> Option<String> {
 mod tests {
     use super::*;
 
+    /// #1911: generics and lifetimes are cut off the export name.
+    #[test]
+    fn rust_exports_strip_generics_and_lifetimes() {
+        let src = "pub struct AutoModeContext<'a> {\n\
+                   pub enum Bar<T: Clone> { A(T) }\n\
+                   pub trait Baz<T>: Sized {}\n\
+                   pub struct Unit;\n\
+                   pub struct Tuple(u8);\n\
+                   pub fn generic<T: Into<String>>(t: T) {}\n\
+                   pub async fn run(x: u8) {}\n\
+                   pub fn r#type() {}\n";
+        let deps = extract_deps(src, "rs");
+        assert_eq!(
+            deps.exports,
+            [
+                "AutoModeContext",
+                "Bar",
+                "Baz",
+                "Unit",
+                "Tuple",
+                "generic",
+                "run",
+                "r#type"
+            ]
+        );
+    }
+
+    #[test]
+    fn leading_identifier_edge_cases() {
+        assert_eq!(leading_identifier("Foo<'a>"), "Foo");
+        assert_eq!(leading_identifier("r#match("), "r#match");
+        assert_eq!(leading_identifier("<T>"), "");
+        assert_eq!(leading_identifier("r#"), "");
+        assert_eq!(leading_identifier("naïve_ß()"), "naïve_ß");
+    }
+
     #[test]
     fn c_include_relative_is_extracted() {
         let src = r#"#include "foo/bar.h"
```

---

### Incident Patch 8: `93af4376` (2026-09-30)
**Commit Message**: test(read): replace the #1910 fixture #1927 removed (#1910)

`auto_cognitive_fallback_is_bare_file` and the auto-read corpus read
src/core/attention_placement.rs as a real ~600-token fixture; #1927
removed that module as dead code (#1915), so the test panicked on a
missing file. Both now use src/core/error.rs, which the whole crate uses.

Refs #1910

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `rust/src/tools/ctx_read/tests_inflation.rs` (modified, +6/-4)
```diff
@@ -135,7 +135,7 @@ fn auto_read_never_inflates_small_file() {
 /// the 500–700-token `science_cognitive_small` band, mid-size and over the
 /// turn budget, plus prose and Python/TypeScript.
 const AUTO_CORPUS: &[&str] = &[
-    "src/core/attention_placement.rs",
+    "src/core/error.rs",
     "src/core/surprise.rs",
     "src/core/compressor.rs",
     "src/core/entropy.rs",
@@ -190,18 +190,20 @@ fn auto_cognitive_fallback_is_bare_file() {
     let _lock = crate::core::data_dir::test_env_lock();
     crate::test_env::set_var("LEAN_CTX_SHOW_SAVINGS", "0");
     let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
-    let content = std::fs::read_to_string(root.join("src/core/attention_placement.rs")).unwrap();
+    // A small real source file; `core/error.rs` is used crate-wide, so it
+    // will not disappear the way the original fixture did in #1915.
+    let content = std::fs::read_to_string(root.join("src/core/error.rs")).unwrap();
     let raw = count_tokens(&content);
     let render = || {
         process_mode_tuned(
             &content,
             "cognitive",
             "F1",
-            "attention_placement.rs",
+            "error.rs",
             "rs",
             raw,
             CrpMode::Off,
-            "src/core/attention_placement.rs",
+            "src/core/error.rs",
             None,
             ReadTuning::default(),
         )
```

---

### Incident Patch 9: `bed219e0` (2026-09-30)
**Commit Message**: fix(tests): gate the ctx_read security tests' json import to unix (#1910)

The module's `use super::*` and every `json!` use sit behind
`#[cfg(unix)]`; the `serde_json::json` import added in the LOC split did
not, so Windows builds failed with `-D unused-imports`.

Refs #1910

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `rust/src/tools/registered/ctx_read_security_tests.rs` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 
 #[cfg(unix)]
 use super::*;
+#[cfg(unix)]
 use serde_json::json;
 
 #[cfg(unix)]
```

---

### Incident Patch 10: `9ed85ff9` (2026-09-30)
**Commit Message**: fix(read): entropy output ignores learned thresholds (#1910)

Since #1910 the entropy threshold decides which lines survive. The
threshold came from `adaptive_thresholds`, which blends the feedback
store, the quality-signal learner (time-decayed) and a bandit arm, all
process-global state that moves between calls. Two reads of one file
could therefore differ, breaking the output-determinism contract (#498);
CI caught it as `read_mode_deterministic:entropy` in the conformance
suite, where parallel tests feed that state.

The read path now uses `read_thresholds`: the per-language base adjusted
by the content's own compressibility, a pure function of (path, content),
plus `aggressiveness`. Before #1910 the learned value had no visible
effect on entropy output (nothing was dropped), so no working behaviour
is lost. The bandit arm is still selected, so the Phi field weights it
sets keep working.

Refs #1910

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +11/-4)
```diff
@@ -115,10 +115,17 @@ Format follows [Keep a Changelog](https://keepachangelog.com/).
 - The edit-quality penalty now escalates a mode with repeated edit failures
   straight to `full`, as documented. It no longer steps down to a lossier
   `signatures` or `map` view.
-- `entropy` reads are deterministic again. The semantic line filter only ran
-  while the embedding model happened to be loaded, so two reads of the same
-  file could differ, which defeats provider prompt caching. It is off for
-  reads now.
+- `entropy` reads are deterministic. Once `entropy` actually dropped lines,
+  two things made two reads of the same file differ, which defeats provider
+  prompt caching:
+  - the semantic line filter ran only while the embedding model happened to
+    be loaded;
+  - the learned thresholds (feedback, quality learner, bandit arm) shift
+    between calls.
+
+  Reads now use the per-language threshold adjusted by the file's own
+  compressibility, plus `aggressiveness`. The semantic filter is off for
+  reads.
 
 ### Fixed — quality claims match what the gates can show (#1905)
 
```

**File**: `rust/src/core/adaptive_thresholds.rs` (modified, +29/-6)
```diff
@@ -303,12 +303,7 @@ pub fn adaptive_thresholds(path: &str, content: &str) -> CompressionThresholds {
     base.bpe_entropy =
         (base.bpe_entropy + super::threshold_learning::learned_delta(ext)).clamp(0.4, 2.0);
 
-    if content.len() > 500 {
-        let k = kolmogorov_proxy(content);
-        let k_adjustment = (k - 0.45) * 0.5;
-        base.bpe_entropy = (base.bpe_entropy + k_adjustment).clamp(0.4, 2.0);
-        base.jaccard = (base.jaccard - k_adjustment * 0.3).clamp(0.5, 0.85);
-    }
+    apply_content_compressibility(&mut base, content);
 
     if let Some(project_root) =
         crate::core::session::SessionState::load_latest().and_then(|s| s.project_root)
@@ -331,6 +326,34 @@ pub fn adaptive_thresholds(path: &str, content: &str) -> CompressionThresholds {
     base
 }
 
+/// Shift the thresholds by the content's own compressibility (Kolmogorov
+/// proxy): a pure function of the text.
+fn apply_content_compressibility(base: &mut CompressionThresholds, content: &str) {
+    if content.len() > 500 {
+        let k = kolmogorov_proxy(content);
+        let k_adjustment = (k - 0.45) * 0.5;
+        base.bpe_entropy = (base.bpe_entropy + k_adjustment).clamp(0.4, 2.0);
+        base.jaccard = (base.jaccard - k_adjustment * 0.3).clamp(0.5, 0.85);
+    }
+}
+
+/// Thresholds for rendering a read: the per-language base adjusted by the
+/// content's compressibility, so the rendered text is a pure function of
+/// `(path, content)` (#498).
+///
+/// The learned blend in [`adaptive_thresholds`] — feedback store, threshold
+/// learner, bandit arm — moves between calls. Since #1910 the entropy
+/// threshold decides which lines survive, so two reads of one file could
+/// differ and bust provider prompt caches. The arm is still selected here, so
+/// the Phi field weights it sets keep working; only the text ignores the
+/// learned values.
+pub fn read_thresholds(path: &str, content: &str) -> CompressionThresholds {
+    let _learned = adaptive_thresholds(path, content);
+    let mut base = thresholds_for_path(path);
+    apply_content_compressibility(&mut base, content);
+    base
+}
+
 /// The bandit arm selected for a file's most recent threshold-driven read, kept
 /// so a *deferred* real outcome (bounce, edit-fail) can penalize the arm that
 /// actually produced the compression — instead of a hardcoded success (#593).
```

**File**: `rust/src/core/entropy.rs` (modified, +4/-4)
```diff
@@ -256,7 +256,7 @@ pub fn entropy_compress_adaptive(
     path: &str,
     force_keep: &[String],
 ) -> EntropyResult {
-    let thresholds = super::adaptive_thresholds::adaptive_thresholds(path, content);
+    let thresholds = super::adaptive_thresholds::read_thresholds(path, content);
     let before_lines = content.lines().count() as u32;
     let result = entropy_compress_with_thresholds(
         content,
@@ -280,7 +280,7 @@ pub fn entropy_compress_adaptive(
     result
 }
 
-/// Like [`entropy_compress_adaptive`] but overrides the learned BPE-entropy
+/// Like [`entropy_compress_adaptive`] but overrides the file-adaptive BPE-entropy
 /// threshold (e.g. from the aggressiveness knob) while keeping the file-adaptive
 /// jaccard. Pure function of its inputs (#498). Higher `bpe_entropy` drops more
 /// low-information lines.
@@ -290,7 +290,7 @@ pub fn entropy_compress_with_threshold(
     bpe_entropy: f64,
     force_keep: &[String],
 ) -> EntropyResult {
-    let thresholds = super::adaptive_thresholds::adaptive_thresholds(path, content);
+    let thresholds = super::adaptive_thresholds::read_thresholds(path, content);
     entropy_compress_with_thresholds(content, bpe_entropy, thresholds.jaccard, force_keep)
 }
 
@@ -305,7 +305,7 @@ pub fn entropy_compress_task_conditioned(
     task_keywords: &[String],
     force_keep: &[String],
 ) -> EntropyResult {
-    let thresholds = super::adaptive_thresholds::adaptive_thresholds(path, content);
+    let thresholds = super::adaptive_thresholds::read_thresholds(path, content);
     let before_lines = content.lines().count() as u32;
     let result = entropy_compress_with_task(
         content,
```

**File**: `rust/src/tools/ctx_read/render.rs` (modified, +1/-1)
```diff
@@ -1226,7 +1226,7 @@ fn render_entropy(content: &str, ctx: RenderCtx<'_>, tuning: &ReadTuning<'_>) ->
         })
         .unwrap_or_default();
     let result = match (task_kws.is_empty(), tuning.aggressiveness) {
-        // Aggressiveness overrides the learned BPE-entropy threshold for
+        // Aggressiveness overrides the file-adaptive BPE-entropy threshold for
         // the plain (no task keywords) path; task-conditioned entropy
         // keeps its own relevance-aware thresholds.
         (true, Some(a)) => entropy::entropy_compress_with_threshold(
```

**File**: `rust/src/tools/ctx_read/tests_compression.rs` (modified, +3/-3)
```diff
@@ -184,9 +184,9 @@ fn entropy_saves_on_real_source_and_scales_with_aggressiveness() {
         .0
     };
     let default = render_at(None);
-    // The default threshold is learned (feedback, bandit arm), so it is not a
-    // fixed point on the aggressiveness scale; monotonicity is checked on
-    // explicit levels only.
+    // The default threshold is file-adaptive (per-language base plus the
+    // content's compressibility), not a point on the aggressiveness scale;
+    // monotonicity is checked on explicit levels only.
     let low = count_tokens(&render_at(Some(0.1)));
     let mid = count_tokens(&render_at(Some(0.5)));
     let high = count_tokens(&render_at(Some(0.9)));
```

#### Recent Merged Pull Requests:
- **PR #1952** (2026-09-30): chore(deps): bump dompurify from 3.4.13 to 3.4.16 in /cookbook (@dependabot[bot])
- **PR #1951** (2026-09-30): fix(deps): raise the brace-expansion floor to 5.0.12 in pi-lean-ctx (@yvgude)
- **PR #1950** (2026-09-30): feat(addons): browser OAuth login for HTTP MCP servers (#1391) (@yvgude)
- **PR #1948** (2026-09-30): test(telemetry): judge the send-lease/purge exclusion on outcomes, not timing (@yvgude)
- **PR #1945** (2026-09-30): ci: shorten the critical path (ubuntu purge, Windows split) + fix a Coverage flake (@yvgude)
- **PR #1944** (2026-09-30): test: fix three CI timing flakes (prune age, run_git timeout, ETXTBSY) (@yvgude)
- **PR #1943** (2026-09-30): chore(deps): bump undici from 7.29.0 to 7.30.0 in /_archive/vscode-extension (@dependabot[bot])
- **PR #1942** (2026-09-30): chore(deps-dev): bump brace-expansion from 5.0.9 to 5.0.12 in /_archive/vscode-extension (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

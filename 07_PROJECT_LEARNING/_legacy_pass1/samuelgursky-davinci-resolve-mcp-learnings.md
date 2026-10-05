# Forensic Learning Record (Deep Inspection): samuelgursky/davinci-resolve-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/samuelgursky-davinci-resolve-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:36:27.734Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `samuelgursky/davinci-resolve-mcp`
- **Description**: MCP server integration for DaVinci Resolve Studio
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3259 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/hooks/agent_rules_drift_check.py`
```
#!/usr/bin/env python3
"""PostToolUse check: catch generated-agent-rules drift the moment it happens.

scripts/agent-rules/generate.mjs is the single source for every per-IDE rule
file (.cursor/rules, .windsurf/rules, .clinerules, .roo/rules, .continue/rules,
.github/copilot-instructions.md, and the AGENTS.md domain-routing block).
tests/test_agent_rules_drift.py fails if any of those go stale relative to
their sources without a regeneration — but that is only caught at test time.
The sources are the three files generate.mjs actually reads (docs/SKILL.md,
docs/kernels/README.md, resolve-advanced/README.md) plus the DOMAINS manifest
inlined in generate.mjs itself; AGENTS.md is an output, so an edit there can
also leave it stale. This hook runs the same `--check` the test does, right
after an edit to one of those, so drift surfaces immediately instead of at the
next test run.

Informational only: it never blocks the edit. If node is missing, the
generator is missing, or the edited file isn't a generator source, it exits
quietly. Reads the PostToolUse payload on stdin, emits additionalContext on
stdout when there's something to say.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hook_runtime import edited_paths, load_event, posttool_context

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATOR = REPO_ROOT / "scripts" / "agent-rules" / "generate.mjs"

# A write to any of these can leave the generated per-IDE files stale.
#
# The first four are what generate.mjs reads: docs/SKILL.md supplies the
# compound and granular tool counts, docs/kernels/README.md the kernel-action
# count, resolve-advanced/README.md the advanced tool count, and generate.mjs
# itself carries the DOMAINS routing manifest inline. AGENTS.md is an *output*
# (the domain-routing block is written into it), so an edit there is drift too.
# If generate.mjs ever grows a new input, add it here or this hook goes silent
# on exactly the edit it exists to catch.
SOURCE_PATHS = (
    REPO_ROOT / "docs" / "SKILL.md",
    REPO_ROOT / "docs" / "kernels" / "README.md",
    REPO_ROOT / "resolve-advanced" / "README.md",
    REPO_ROOT / "scripts" / "agent-rules" / "generate.mjs",
    REPO_ROOT / "AGENTS.md",
)
# Watched defensively rather than because generate.mjs reads them: these dirs
# hold the kernels and guides the generated files point at, and a `--check` run
# is cheap enough that a false watch costs far less than a missed one.
SOURCE_DIRS = (
    REPO_ROOT / "docs" / "kernels",
    REPO_ROOT / "docs" / "guides",
)


def say_nothing() -> None:
    sys.exit(0)


def additional_context(message: str) -> None:
    posttool_context(message)


def is_generator_source(path: str) -> bool:
    if not path:
        return False
    try:
        resolved = Path(path).resolve()
    except OSError:
        return False
    if resolved in SOURCE_PATHS:
        return True
    return any(
        resolved == d or d in resolved.parents for d in SOURCE_DIRS
    )


def main() -> None:
    paths = edited_paths(load_event())
    if not any(is_generator_source(path) for path in paths):
        say_nothing()

    node = shutil.which("node")
    if node is None or not GENERATOR.is_file():
        say_nothing()

    try:
        proc = subprocess.run(
            [node, str(GENERATOR), "--check"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        say_nothing()
        return

    if proc.returncode == 0:
        say_nothing()

    output = (proc.stdout + proc.stderr).strip()

    # generate.mjs exits 1 for two different reasons: it found drift, or it
    # threw before it could look. Only the first is fixed by regenerating —
    # telling the session to run the generator when the generator is the thing
    # that crashed sends it in a circle. The drift path always prints the "✗ N
    # agent-rule file(s) are stale" line; a throw never does.
    if "agent-rule file(s) are stale" in output:
        additional_context(
            "Generated agent-rule files are stale after this edit — "
            f"`node scripts/agent-rules/generate.mjs` needs to run.\n{output}"
        )

    additional_context(
        "`node scripts/agent-rules/generate.mjs --check` failed to run "
        f"(exit {proc.returncode}) — this is a broken generator, not drift, so "
        "regenerating will not fix it. Most often a canonical count moved out "
        "from under one of the patterns generate.mjs parses.\n"
        f"{output}"
    )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/hooks/frame_verification_guard.py`
```
#!/usr/bin/env python3
"""PreToolUse guard: no grade lands without a frame reference behind it.

AGENTS.md ("Frame-Referenced Color Work") requires inspecting Resolve-rendered
frames before applying a grade, look, shot match, LUT, CDL, DRX, or copied
grade. That rule is prose, so it decays as a session gets long. This hook makes
it structural: a grade-applying action is refused until the session shows
evidence that frames were actually looked at.

Reads the PreToolUse payload on stdin, emits a permission decision on stdout.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hook_runtime import load_event, pretool_decision

# Actions on timeline_item_color that write grade state to the project.
GRADE_APPLY_ACTIONS = {
    "safe_set_cdl",
    "safe_copy_grade",
    "safe_apply_drx",
    "bulk_match_to_hero",
    "propose_grade",
}

# Whole-grade artifacts applied across many clips. These are the actions that
# overwrite hand-work irrecoverably, so they always surface to the user even
# when frame evidence exists.
BULK_APPLY_ACTIONS = {"safe_copy_grade", "bulk_match_to_hero"}

# Tools whose use counts as having looked at frames.
EVIDENCE_TOOLS = {
    "mcp__davinci-resolve__media_analysis",
    "mcp__davinci-resolve__gallery",
    "mcp__davinci-resolve__gallery_stills",
}

# timeline_item_color actions that inspect rather than write.
EVIDENCE_ACTIONS = {
    "grade_evidence_base",
    "grade_boundary_report",
    "probe_grade_item",
    "probe_node_graph",
    "grade_version_snapshot",
}

IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".dpx", ".exr")


def decide(decision: str, reason: str) -> None:
    pretool_decision(decision, reason)


def state_path(session_id: str) -> Path | None:
    if not session_id:
        return None
    digest = sha256(session_id.encode("utf-8", errors="replace")).hexdigest()
    return Path(tempfile.gettempdir()) / "davinci-resolve-agent-hooks" / f"{digest}.frame-evidence"


def event_has_frame_evidence(event: Dict[str, Any]) -> bool:
    name = str(event.get("tool_name") or "")
    payload = event.get("tool_input") or {}
    if not isinstance(payload, dict):
        payload = {}
    if name in EVIDENCE_TOOLS:
        return True
    if name == "mcp__davinci-resolve__timeline_item_color":
        return payload.get("action") in EVIDENCE_ACTIONS
    if name in {"Read", "view_image"}:
        target = str(payload.get("file_path") or payload.get("path") or "").lower()
        return target.endswith(IMAGE_SUFFIXES)
    if name == "Bash":
        return "contact_sheet.py" in str(payload.get("command") or "")
    return False


def record_frame_evidence(event: Dict[str, Any]) -> None:
    if not event_has_frame_evidence(event):
        return
    path = state_path(str(event.get("session_id") or ""))
    if path is None:
        return
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("frame evidence observed\n", encoding="utf-8")
    except OSError:
        pass


def has_recorded_frame_evidence(event: Dict[str, Any]) -> bool:
    path = state_path(str(event.get("session_id") or ""))
    return bool(path and path.is_file())


def transcript_entries(path: str) -> List[Dict[str, Any]]:
    if not path or not os.path.exists(path):
        return []
    entries: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def tool_uses(entries: List[Dict[str, Any]]):
    """Yield (name, input) for every tool_use block in the transcript."""
    for entry in entries:
        message = entry.get("message")
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                yield block.get("name", ""), block.get("input") or {}


def has_frame_evidence(path: str) -> bool:
    for name, payload in tool_uses(transcript_entries(path)):
        if name in EVIDENCE_TOOLS:
            return True

        if name == "mcp__davinci-resolve__timeline_item_color":
            if payload.get("action") in EVIDENCE_ACTIONS:
                return True

        # Frames read back as local images — the host-vision path in
        # docs/guides/media-analysis-guide.md ends here.
        if name == "Read":
            target = str(payload.get("file_path", "")).lower()
            if target.endswith(IMAGE_SUFFIXES):
                return True

        if name == "Bash":
            command = str(payload.get("command", ""))
            if "contact_sheet.py" in command:
                return True

    return False


def main() -> None:
    event = load_event()
    if not event:
        sys.exit(0)

    if event.get("hook_event_name") == "PostToolUse":
        record_frame_evidence(event)
        sys.exit(0)

    tool_input = event.get("tool_input") or {}
    action = tool_input.get("action")
    if action not in GRADE_APPLY_ACTIONS:
        sys.exit(0)

    params = tool_input.get("params") or {}
    if params.get("dry_run"):
        sys.exit(0)  # A preview writes nothing.

    evidence = has_recorded_frame_evidence(event) or has_frame_evidence(
        event.get("transcript_path", "")
    )

    if not evidence:
        decide(
            "deny",
            f"AGENTS.md requires frame references before '{action}' applies a grade. "
            "Nothing in this session has looked at a Resolve-rendered frame yet.\n\n"
            "Gather evidence first, then retry:\n"
            "  - timeline_item_color(action='grade_evidence_base') for the trust-scored base\n"
            "  - timeline_item_color(action='probe_node_graph') to see the existing grade\n"
            "  - gallery_stills / media_analysis to pull frames, then Read them as images\n\n"
            "Grading from metadata, graph availability, or a style label alone is the "
            "failure mode this guard exists to catch. If the user explicitly asked for a "
            "blind/global pass, say so and re-run with dry_run first.",
        )

    if action in BULK_APPLY_ACTIONS:
        decide(
            "ask",
            f"'{action}' applies a whole-grade artifact across clips and can overwrite "
            "hand-graded work with no recovery path. Frame evidence is present, so this "
            "is a confirmation, not a block.\n\n"
            "Before confirming, be sure you have: verified the target clips are uniform, "
            "and taken a grade_version_snapshot so the previous grade is recoverable.",
        )

    sys.exit(0)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/hooks/hook_runtime.py`
```
"""Shared host-protocol helpers for repository agent hooks."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List


def host() -> str:
    return os.environ.get("DAVINCI_AGENT_HOST", "claude").strip().lower()


def load_event() -> Dict[str, Any]:
    try:
        value = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def _write(payload: Dict[str, Any]) -> None:
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")


def pretool_decision(decision: str, reason: str) -> None:
    if decision == "ask" and host() == "codex":
        # Codex PreToolUse currently supports allow/deny but not ask. The MCP
        # actions covered by this branch issue their own confirmation tokens,
        # so preserve that server gate and surface the warning as context.
        _write(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "additionalContext": reason,
                }
            }
        )
    else:
        _write(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": decision,
                    "permissionDecisionReason": reason,
                }
            }
        )
    raise SystemExit(0)


def posttool_context(message: str) -> None:
    _write(
        {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": message,
            }
        }
    )
    raise SystemExit(0)


def _candidate_strings(event: Dict[str, Any]) -> Iterable[str]:
    tool_input = event.get("tool_input") or {}
    tool_response = event.get("tool_response") or {}
    if isinstance(tool_input, dict):
        for key in ("file_path", "path"):
            value = tool_input.get(key)
            if isinstance(value, str):
                yield value
        command = tool_input.get("command")
        if isinstance(command, str):
            for match in re.finditer(
                r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", command, re.MULTILINE
            ):
                yield match.group(1).strip()
            for match in re.finditer(r"^\+\+\+ b/(.+)$", command, re.MULTILINE):
                yield match.group(1).strip()
    if isinstance(tool_response, dict):
        for key in ("filePath", "file_path", "path"):
            value = tool_response.get(key)
            if isinstance(value, str):
                yield value


def edited_paths(event: Dict[str, Any]) -> List[str]:
    base = Path(str(event.get("cwd") or os.getcwd()))
    paths: List[str] = []
    for raw in _candidate_strings(event):
        candidate = Path(os.path.expandvars(os.path.expanduser(raw)))
        if not candidate.is_absolute():
            candidate = base / candidate
        try:
            resolved = str(candidate.resolve())
        except OSError:
            continue
        if resolved not in paths:
            paths.append(resolved)
    return paths

```

### Core Architecture Module: `.agents/hooks/source_media_guard.py`
```
#!/usr/bin/env python3
"""PreToolUse guard: shell commands may read source media, never rewrite it.

AGENTS.md opens with the non-negotiable rule — never modify, transcode, convert,
proxy, relink, replace, or create derivatives of source media unless the user
asked for that exact operation. Analysis output belongs in scratch space, the
session sandbox, or the davinci-resolve-mcp-analysis project root.

Nothing enforced that for Bash. A single `ffmpeg -i camera.mov out.mov` with the
wrong output path, or an `rm` on a card, is unrecoverable. This hook denies
mutating shell commands whose target is a media file outside a scratch root.

What it does not catch, stated plainly so it is not mistaken for a sandbox: it
reads argv lexically, so a directory delete with no media extension
(`rm -rf /Volumes/CARD/DCIM`), an indirect delete (`find … -delete`,
`… | xargs rm`), or a script that writes media of its own
(`python transcode.py --out …`) all pass. This is a tripwire for the common
direct mistake, not a boundary. The boundary is still the rule in AGENTS.md.

Reads the PreToolUse payload on stdin, emits a permission decision on stdout.
"""

from __future__ import annotations

import os
import re
import shlex
import sys
from pathlib import Path
from typing import List, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hook_runtime import load_event, pretool_decision

MEDIA_SUFFIXES = (
    # camera + delivery containers
    ".mov", ".mp4", ".mxf", ".avi", ".mkv", ".m4v", ".mts", ".m2ts", ".webm",
    # camera raw
    ".braw", ".r3d", ".ari", ".arx", ".arriraw", ".crm", ".cine", ".dng",
    # image sequences
    ".exr", ".dpx", ".tif", ".tiff", ".cr2", ".cr3", ".nef", ".arw",
    # audio
    ".wav", ".aif", ".aiff", ".caf", ".flac", ".mp3", ".m4a",
    # project + grade state
    ".drp", ".drt", ".drx",
)

# Commands that write, move, or destroy whatever they are pointed at.
MUTATING = {
    "rm", "mv", "cp", "dd", "truncate", "shred", "unlink", "install",
    "ffmpeg", "avconv", "HandBrakeCLI", "handbrakecli",
    "convert", "magick", "sips", "qt-faststart",
    "exiftool", "touch", "chmod", "chown",
}

# Commands that destroy or relocate what they are pointed at, as opposed to
# writing something new. A derivative-output directory licenses the second but
# never the first: a camera card with an `exports` folder is still a camera card.
DESTRUCTIVE = {"rm", "mv", "dd", "truncate", "shred", "unlink"}

# Scratch roots, anchored: the normalized path must start inside one of these.
SCRATCH_ROOTS = ("/tmp", "/private/tmp", "/var/folders")

# Directory names that mark scratch space, matched as whole path components —
# never as substrings, so `/Volumes/CARD/scratchpad-dailies` is not exempt.
SCRATCH_COMPONENTS = ("scratch", "davinci-resolve-mcp-analysis", ".cache")

# Host session scratch directory prefixes. Deliberately NARROW: this tuple
# EXEMPTS paths from the source-media deny, so a generic prefix would make
# any real directory that happens to share it silently deletable. Only the
# exact prefixes real hosts generate belong here.
SCRATCH_COMPONENT_PREFIXES = ("claude-", "codex-")

# Multi-segment markers, matched as a contiguous run of components.
SCRATCH_RUNS = (("tests", "fixtures"), ("tests", "tmp"))

# Derivative-output directories. These exempt a *write* — a render, a proxy, an
# export landing where it belongs — but deliberately do not exempt a delete or a
# move, which is how a folder named `renders` on a source drive got a pass.
WRITE_ONLY_COMPONENTS = ("proxies", "renders", "exports")


def normalize(path: str) -> str:
    """Absolute, `..`-collapsed, `~`-expanded. Traversal cannot outrun a marker."""
    expanded = os.path.expanduser(os.path.expandvars(path))
    return os.path.normpath(os.path.abspath(expanded))


def components(path: str) -> List[str]:
    return [part for part in normalize(path).lower().split(os.sep) if part]


def has_run(parts: List[str], marker: Sequence[str]) -> bool:
    """True when marker appears as a contiguous run of whole components."""
    width = len(marker)
    return any(parts[i:i + width] == list(marker) for i in range(len(parts) - width + 1))


def decide(decision: str, reason: str) -> None:
    pretool_decision(decision, reason)


def is_scratch(path: str, destructive: bool = False) -> bool:
    """Is this path somewhere a derivative may land?

    `destructive` narrows the answer: a delete or a move must clear a genuine
    scratch root, not merely sit in a directory named `renders`.
    """
    resolved = normalize(path).lower()
    parts = components(path)

    configured = os.environ.get("RESOLVE_MCP_SCRATCH", "")
    roots = SCRATCH_ROOTS + ((normalize(configured).lower(),) if configured else ())
    if any(resolved == root or resolved.startswith(root.rstrip(os.sep) + os.sep) for root in roots):
        return True

    if any(part in SCRATCH_COMPONENTS for part in parts):
        return True
    if any(part.startswith(SCRATCH_COMPONENT_PREFIXES) for part in parts):
        return True
    if any(has_run(parts, marker) for marker in SCRATCH_RUNS):
        return True

    if not destructive and any(part in WRITE_ONLY_COMPONENTS for part in parts):
        return True

    return False


def is_media(token: str) -> bool:
    return token.lower().endswith(MEDIA_SUFFIXES)


def split_commands(command: str) -> List[str]:
    """Split on shell separators so `ffprobe x && rm y` is checked as two.

    Newlines are separators too, and that was a hole worth naming: a multi-line
    block was one segment, so `argv0` came from the first line and a harmless
    one returned before anything under it was looked at. `mkdir -p x` then a
    newline then `mv camera.mov x/` passed, while the same two joined by `;`
    denied — the same command to a shell, two answers from the guard.

    The cost of splitting on newlines is that any multi-line text carried inside
    a command — a heredoc body, a commit message — is read as commands too, so a
    message that merely *quotes* `rm camera.mov` is denied. That is the right way
    round for a tripwire: rephrase, or write the text to a file first.
    """
    return [part for part in re.split(r"&&|\|\||;|\||\n", command) if part.strip()]


def endangered_targets(segment: str) -> List[str]:
    try:
        tokens = shlex.split(segment)
    except ValueError:
        tokens = segment.split()
    if not tokens:
        return []

    argv0 = os.path.basename(tokens[0])
    # Skip an env prefix like `FOO=bar ffmpeg ...`
    index = 0
    while index < len(tokens) and "=" in tokens[index] and not tokens[index].startswith("-"):
        index += 1
        argv0 = os.path.basename(tokens[index]) if index < len(tokens) else argv0

    args = tokens[index + 1:]

    if argv0 not in MUTATING:
        # Still catch redirection onto a media file: `... > camera.mov`
        return [t for t in re.findall(r">>?\s*(\S+)", segment) if is_media(t)]

    destructive = argv0 in DESTRUCTIVE

    if argv0 in {"ffmpeg", "avconv"}:
        # ffmpeg reads every -i and writes the trailing operand. That operand is
        # checked even when it also appears as an input: `ffmpeg -i x.mp4 x.mp4`
        # is the in-place overwrite this hook exists to stop, and exempting an
        # output for matching an input exempted exactly that command.
        #
        # The one trailing token that is not an output is the value of a `-i`
        # immediately before it — `ffmpeg -i master.mov` prints stream info and
        # writes nothing. Denying a read would only teach an agent to route
        # around the guard to look at a file.
        trailing = args[-1:] if args and not args[-1].startswith("-") else []
        if len(args) >= 2 and args[-2] == "-i":
            trailing = []
        return [t for t in trailing if is_media(t) and not is_scratch(t)]

    if argv0 == "cp":
        # Only the destination is at risk.
        operands = [a for a in args if not a.startswith("-")]
        ret
```

### Core Architecture Module: `.claude/hooks/agent_rules_drift_check.py`
```
#!/usr/bin/env python3
import os
import runpy
from pathlib import Path

os.environ["DAVINCI_AGENT_HOST"] = "claude"
runpy.run_path(str(Path(__file__).resolve().parents[2] / ".agents/hooks/agent_rules_drift_check.py"), run_name="__main__")

```

### Core Architecture Module: `.claude/hooks/frame_verification_guard.py`
```
#!/usr/bin/env python3
import os
import runpy
from pathlib import Path

os.environ["DAVINCI_AGENT_HOST"] = "claude"
runpy.run_path(str(Path(__file__).resolve().parents[2] / ".agents/hooks/frame_verification_guard.py"), run_name="__main__")

```

### Core Architecture Module: `.claude/hooks/source_media_guard.py`
```
#!/usr/bin/env python3
import os
import runpy
from pathlib import Path

os.environ["DAVINCI_AGENT_HOST"] = "claude"
runpy.run_path(str(Path(__file__).resolve().parents[2] / ".agents/hooks/source_media_guard.py"), run_name="__main__")

```

### Core Architecture Module: `.codex/hooks/agent_rules_drift_check.py`
```
#!/usr/bin/env python3
import os
import runpy
from pathlib import Path

os.environ["DAVINCI_AGENT_HOST"] = "codex"
runpy.run_path(str(Path(__file__).resolve().parents[2] / ".agents/hooks/agent_rules_drift_check.py"), run_name="__main__")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #253** (2026-09-19): **Follower follow-up: TransformSize and Softness1 refuse spline attach under add_keyframe**
  *Symptoms*: <!-- Tip: from any MCP client you can ask the assistant to "send this as a bug". It drafts this report for you with the server version, Resolve build, connection mode and OS already filled in. -->  ### What happened  ### Steps to reproduce  1.  ### Expected  ### Actual  ### Failing call  <!-- tool → action, and the error it returned -->  ### Environment  | | | |---|---| | MCP server | | | DaVinci Resolve | <!-- e.g. DaVinci Resolve Studio 21.0.4.5, or the free edition --> | | Connection | <!-- local scripting / in-app bridge / network scripting --> | | OS | | | MCP client | <!-- Claude Desktop, Claude Code, Cursor, … --> | 
  **Post-Mortem & Fix Analysis**:
  > Fixed and released as [v4.8.4](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.8.4). Thank you for the follow-up. The report came through as the empty template with only its title, so I worked from the title — and the title was enough to reproduce it exactly.  **What is going on.** `TransformSize` and `Softness1` are not inputs you can animate; they are *nest controls*, the fold-down group headers the Fusion UI draws. Measured today on Studio 19.1.3.7 on the Follower your #250 fix creates:  | input | `INPID_InputControl` | `AddModifier(…, BezierSpline)` | |---|---|---| | `TransformSize` (shown as "Size") | `NestControl`, passive | False, also for Path and TextScramble | | `Softness1` | `NestControl`, passive | False | | `Size1` | `NestControl`, passive | False | | `Size`, `Opacity1`, `Delay` | `SliderControl` | attaches |  TextPlus's own `Softness1` refuses the same way, so this is not specific to the Follower. The controls a header folds are the next entries in `Ge

- **Issue #243** (2026-09-16): **serverInfo.version reports the MCP SDK version (1.30.0) instead of the project version**
  *Symptoms*:   ### What happened    The server advertises the MCP SDK's version as its own. In the `initialize`   response, `serverInfo.version` is the version of the installed `mcp` package   (1.30.0), not the project version (4.7.4, `VERSION` in `src/server.py:14`).   Every MCP client shows that number, so the version a user reports back — in a   bug report, for instance — is the SDK's, not this project's.    ### Steps to reproduce    1. Start the server in any transport, e.g. `python src/server.py`.   2. Perform the MCP `initialize` handshake (any client, or a raw POST to      `/mcp` when using `--transport streamable-http`).   3. Read `result.serverInfo` in the response.    ### Expected    "serverInfo": {"name": "DaVinciResolveMCP", "version": "4.7.4"}    Actual    "serverInfo": {"name": "DaVinciResolveMCP", "version": "1.30.0"}    1.30.0 is the installed mcp SDK version; it changes when the SDK is   upgraded, with no relation to this project's releases.    Cause: src/server.py builds FastMCP("DaVinciResolveMCP", …) without a   version, and FastMCP.__init__ has no version parameter at all in SDK 1.30   (verified with inspect.signature). It constructs the low-level Server   without one (mcp/server/fastmcp/server.py:221), so   Server.create_initialization_options() falls back to the package version:   server_version=self.version if self.version else pkg_version("mcp")   (mcp/server/lowlevel/server.py:183).    Suggested fix — set it on the low-level server right after building mcp:    mc
  **Post-Mortem & Fix Analysis**:
  > Fixed and released as [v4.7.6](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.7.6), by @DYNOSuprovo in #244, which followed your diagnosis exactly — including the granular instance you flagged as needing the same treatment. Thank you for the report; the SDK line you cited was the whole story, and you are credited in the changelog and release notes.  Both FastMCP instances now set the low-level server's version right after construction, and `tests/test_server_info_version.py` pins `create_initialization_options().server_version` on each, so the handshake reports the project version from here on. The private-attribute route is recorded as deliberate; if the SDK grows a public `version` parameter, that test is the thing that tells us it is safe to switch. 

- **Issue #241** (2026-09-16): **Networked transport (streamable-http) refuses every request with HTTP 421 when DAVINCI_MCP_HOST is non-loopback**
  *Symptoms*: ### What happened  The networked transport (`--transport streamable-http`) cannot serve a client on another machine. With `DAVINCI_MCP_HOST` set to a LAN address, every request to that address is rejected with **HTTP 421 Misdirected Request**, even with a valid bearer token. The transport is documented as supporting a non-loopback bind — it logs a loud security warning, and `install.md` advises restricting access with a host firewall — but in practice nothing can reach it.  ### Steps to reproduce  1. Start the server bound to a LAN address:    ```bash    DAVINCI_MCP_HOST=192.168.1.xx DAVINCI_MCP_PORT=8000 DAVINCI_MCP_TOKEN=secret \      python src/server.py --transport streamable-http 2. Confirm it is listening on 192.168.1.xx:8000. 3. Send an initialize request to that address with the token: curl -i -X POST http://192.168.1.xx:8000/mcp \   -H 'Authorization: Bearer secret' \   -H 'Accept: application/json, text/event-stream' \   -H 'Content-Type: application/json' \   -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"0"}}}'  Expected  HTTP/1.1 200 and a normal MCP initialize result, so a remote MCP client (here: the n8n MCP Client Tool on another host) can use the server.  Actual  HTTP/1.1 421 for every request. The bind itself succeeds and the auth middleware is reached — the same request with a wrong token returns 401 — so the rejection happens in the transport's Host check.  Ca
  **Post-Mortem & Fix Analysis**:
  > Fixed and released as [v4.7.4](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.7.4). Thank you for the report — the diagnosis was exact, down to the SDK line, and it saved the round trip. Credited in the changelog and the release notes.  **What I confirmed.** Reproduced on v4.7.3 with the real SDK app (`mcp` 1.30.0) before changing anything: `FastMCP("…")` built without a host, `DAVINCI_MCP_HOST=192.168.1.50`, then `initialize` with a valid token — LAN Host → 421, wrong token → 401, loopback → 200, and `settings.transport_security.allowed_hosts` still read `['127.0.0.1:*', 'localhost:*', '[::1]:*']` after `run_networked`. Exactly as you described.  **What changed.** Your first suggestion, made general. `transport_security_for(host, extra_hosts)` in `src/utils/mcp_transport.py` now rebuilds the allowlist from the bind host *before* the app is built (the app reads the setting once, at construction — the reason setting `settings.host` afterwards was not enough):  - loo

- **Issue #232** (2026-09-14): **timeline.normalize_audio_level rejects every documented option schema with "Unknown normalization options"**
  *Symptoms*: ### What happened  The timeline.normalize_audio_level action advertises native 21.1 normalization and get_normalize_audio_modes returns valid modes (including "True Peak"), but every attempt to pass options is rejected with "Unknown normalization options or non-dictionary options".
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. The message you hit is fixed in [v4.4.2](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.4.2), though probably not in the way the title expects — so here is what I found.  **The action does accept every documented option schema.** I ran all seven `NormalizeAudioOptions` shapes against the validator, and each one passes and reaches `Timeline.NormalizeAudioLevel`: `Sample Peak Program` with `targetLevel`, `True Peak` with `targetLevel`, `EBU R128` with `targetLoudness`, either `setLevelMode` constant on its own, all four keys together, and `{}`. There is now a test pinning all seven, so this cannot silently regress.  **The bug was the error message.** It read:  > Unknown normalization options or non-dictionary options  That is one sentence covering two unrelated failures with two different fixes, and it named neither the offending key nor the type it actually received. So a typo and a malformed payload were indistinguishable — to you, and to

- **Issue #224** (2026-09-13): **False drift warning on project_manager.load: DriftDetectionHook compares timeline durations across different projects**
  *Symptoms*: ### What happened  Switching projects with `project_manager(action="load")` emits a drift warning that compares the *previous* project's timeline against the *new* project's timeline:  ```json {"result": {"success": true, "_operation": {"lifecycle": {"drift_detection": {   "drift_detected": true,   "drift_warnings": ["Timeline duration drifted unexpectedly from 120 to 17854 frames during non-duration altering action 'load'"],   "duration_delta_frames": 17734 }}}}} ```  120 and 17854 are durations of two entirely different timelines in two different projects. No timeline drifted; nothing was edited. `load` itself correctly reported `success: true`.  ## Steps to reproduce  1. Have two projects, each with a timeline of a different duration. 2. `project_manager(action="load", params={"name": "A"})` 3. `project_manager(action="load", params={"name": "B"})` 4. Observe `drift_detection` in the `_operation.lifecycle` block of step 3.  ## Root cause  `src/utils/execution_lifecycle.py:535-581`, `DriftDetectionHook.after_tool_call`:  - It compares `ctx.pre_state["duration_frames"]` against `post_state["duration_frames"]` with no check that the two states describe the *same* timeline (or even the same project). - `load` is not in `_DURATION_ALTERING_ACTIONS`, so a project switch takes the "unexpected drift" branch by construction.  Any action that legitimately replaces the current timeline — rather than modifying it — will trip this. `load` is the clearest case.  ## Why this seems worth 
  **Post-Mortem & Fix Analysis**:
  > Fixed and released in [v4.1.1](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.1.1). Your diagnosis was exactly right, down to the line numbers and the reason it fires *by construction* rather than intermittently — `load` is not in `_DURATION_ALTERING_ACTIONS`, so a project switch can only take the unexpected-drift branch.  **I took the first of your two suggested directions**, and it's worth saying why, because your second one would also have worked and you framed the distinction correctly yourself.  Adding `load` to a list treats one action. Checking identity treats the question. The set of actions that can *replace* the current timeline rather than modify it is open-ended — `load`, `create`, `set_current`, anything that closes a project — and each new one would have to be remembered. Your own sentence is the reason: "the point is not 'duration may change' but 'the previous baseline no longer refers to anything'." That's a property of the two states, not of the ac

- **Issue #2** (2025-03-28): **[BUG] [Windows] Setup. Not getting the MCP server to run on Claude Desktop**
  *Symptoms*: ## Bug Description I am fairly new to MCP so maybe doing something obviously wrong. But perhaps you could offer debug tips or add better docs.  So far, I have not gotten the MCP server to work on Windows with Claude Desktop.  ## Steps To Reproduce 1. Clone this repo and read the docs.  2. Read some basic MCP docs for Claude Desktop - https://modelcontextprotocol.io/quickstart/user 3. Look at env setup. There seems to be env variables required but it's unclear how to get them to Claude Desktop. I can hack these in say with command line Claude launch but right now saving these for later until I get an error message related to this 4. pip install -e . // Seems successful  `Successfully built davinci-resolve-mcp Installing collected packages: pluggy, packaging, iniconfig, colorama, pytest, davinci-resolve-mcp .... Successfully installed colorama-0.4.6 davinci-resolve-mcp-1.1.0 iniconfig-2.1.0 packaging-24.2 pluggy-1.5.0 pytest-8.3.5` 6. I see no other setup / install instructions so winging it ### Winging it 7. Claud Desktop - File -> Settings -> Developer -> Edit Config (opens folder with claude_desktop_config.json in it) // Not documented 8. See mcp.json in this repo and copy to claude_desktop_config.json 9. Close claude Desktop GUI, but it's clear MCP server was not picked up. On Windows, need to exit with tray icon 10. Claude Desktop restarts and shows error with links to log file 11. Log is something like `python: can't open file '%localappdata%\\AnthropicClaude\\app-0.8.1\\
  **Post-Mortem & Fix Analysis**:
  > FYI I don't think this helps but for setup.py looks like a dep was missing  `s:\src\davinci-resolve-mcp>pip install setuptools Defaulting to user installation because normal site-packages is not writeable Collecting setuptools   Using cached setuptools-77.0.3-py3-none-any.whl.metadata (6.6 kB) Using cached setuptools-77.0.3-py3-none-any.whl (1.3 MB) Installing collected packages: setuptools Successfully installed setuptools-77.0.3  s:\src\davinci-resolve-mcp>python setup.py S:\packages\python\Python313\site-packages\setuptools\dist.py:760: SetuptoolsDeprecationWarning: License classifiers are deprecated. !!          ********************************************************************************         Please consider removing the following classifiers in favor of a SPDX license expression:          License :: OSI Approved :: MIT License          See https://packaging.python.org/en/latest/guides/writing-pyproject-toml/#license for details.         *************************************
  > I get the impression that even outside of Claude Desktop, we should be able to get the MCP server to run first as a basic troubleshooting step. E.g. This fails with the same error so likely it's nothing to do yet with Claude integration, but a more basic issue. Here I even set env variables first  `s:\src\davinci-resolve-mcp>python src\resolve_mcp.py Traceback (most recent call last):   File "s:\src\davinci-resolve-mcp\src\resolve_mcp.py", line 1, in <module>     from mcp.server.fastmcp import FastMCP   File "s:\src\davinci-resolve-mcp\src\mcp.py", line 7, in <module>     from .fixed_timeline_functions import fixed_delete_timeline, fixed_duplicate_timeline ImportError: attempted relative import with no known parent package`
  > Working on refactoring for Claude Desktop now, I'll push an update as soon as it's ready! Thank you for flagging. 

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

### Incident Patch 1: `a39dcebf` (2026-09-30)
**Commit Message**: fix(granular): open_settings/open_app_preferences report "not supported"; v4.8.25

Both tools went through Resolve.GetUIManager(), which does not exist.
Measured on Studio 19.1.3.7: dir(resolve) lists 23 methods, GetUIManager
is not one; Fusion().UIManager has neither OpenProjectSettings nor
OpenPreferences; none of the three names is in the 21.1 typed API. The
call raised "'NoneType' object is not callable", a broad except caught
it, an ERROR was logged, and the tool answered "Failed to open Project
Settings dialog" with no reason. The tools could never work and said so
as an ordinary failure.

app_control._open_dialog probes the route with has_method (hasattr is
True for every name on a Resolve object) and returns
{success, supported, message}. On a build without the calls the tools
answer "Not supported:" and name what is missing; open_settings points
at get_project_settings / get_project_setting / set_project_setting.
Nothing is logged as an error. On a build that has the calls they are
used and their return is reported: the old code discarded it and
answered success regardless.

api_truth: the absence, with what Fusion().UIManager does expose.
DoAction/QueueAction were not tri

**File**: `CHANGELOG.md` (modified, +41/-0)
```diff
@@ -2,6 +2,47 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.25 — open_settings and open_app_preferences say what Resolve cannot do
+
+### Fixed
+
+- **The granular `open_settings` and `open_app_preferences` tools could never
+  work, and reported that as an ordinary failure.** Both went through
+  `Resolve.GetUIManager()`, which does not exist. Measured on Studio 19.1.3.7:
+  `dir(resolve)` lists 23 methods and `GetUIManager` is not one of them;
+  `Fusion().UIManager` is real but has neither `OpenProjectSettings` nor
+  `OpenPreferences`; and none of the three names appears in the 21.1 typed API.
+  The call raised `'NoneType' object is not callable`, a broad `except`
+  swallowed it, an ERROR was logged, and the tool answered
+  `Failed to open Project Settings dialog` with no reason.
+  Both tools now answer `Not supported:` and name the call that is missing;
+  `open_settings` also names the tools that read and write project settings.
+  Nothing is logged as an error, because nothing went wrong.
+- The route is now probed with `has_method` rather than `hasattr`, which is
+  true for every name on a Resolve object. If a future build does provide these
+  calls they are used, and their result is reported: the old code discarded the
+  return and answered success regardless, so a refusal would have read as a
+  dialog that opened.
+
+### Documentation
+
+- `api_truth` records the absence, with what `Fusion().UIManager` does expose.
+  Whether `UIManager.DoAction` or `QueueAction` can open these dialogs was not
+  tried: both dialogs are modal, and a modal dialog blocks the scripting API
+  until a person closes it.
+- `scripts/audit_api_parity.py` no longer describes `GetUIManager` as a
+  documented API.
+
+### Tests
+
+- `tests/test_app_control_dialogs.py`: a fake that fabricates attributes the way
+  a Resolve object does (every `hasattr` true, a missing `getattr` is `None`).
+  Covers the measured build, a manager without the method, a build that has
+  the call, a refusal, an exception, and both granular tools. Eight of its
+  twelve tests fail against v4.8.24.
+- `tests/test_discarded_resolve_returns.py` now covers every `Open*` call, not
+  only `OpenPage`.
+
 ## What's New in v4.8.24 — a frame capture leaves the render output folder and file name alone
 
 ### Fixed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.24-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.25-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.24-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.25-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.24 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.25 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.24"
+VERSION = "4.8.25"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.24",
+  "version": "4.8.25",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.24",
+      "version": "4.8.25",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

---

### Incident Patch 2: `08ad6327` (2026-09-30)
**Commit Message**: fix(timeline_frame): capture leaves TargetDir and CustomName alone; v4.8.24

A render-route capture wrote the project's TargetDir and CustomName and
put neither back: there is no GetRenderSettings, and an empty CustomName
is refused. The user's next render job inherited a temporary folder the
capture had already deleted and a name like capture-<timestamp>.

TargetDir: a queued render job carries the settings it inherited, so
_render_target_dir queues a throwaway job, reads TargetDir off its
GetRenderJobList entry and deletes it (about 150 ms on Studio 19.1.3.7).
The read happens in single-clip mode, before the capture changes
anything, and the folder is written back in the teardown. A folder that
is not put back, or a throwaway job that cannot be removed, goes into
the capture's warnings block.

CustomName: no longer written. The capture renders under the project's
own naming into a private subfolder of the shared capture folder and
takes the one file that appears. That also stops the frame being
confused with, or deleting, a same-named file in the shared folder.

Remaining gap, stated in the docstring, SKILL.md and capabilities
(render_settings_caveat): a project that has never ha

**File**: `CHANGELOG.md` (modified, +60/-0)
```diff
@@ -2,6 +2,66 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.24 — a frame capture leaves the render output folder and file name alone
+
+### Fixed
+
+- **`timeline_frame` capture left the project's render output folder and file
+  name on its own temporary values.** The render route (`quality="frame"`,
+  `"preview"`, `"full"`) wrote `TargetDir` and `CustomName` and put neither
+  back, because there is no `GetRenderSettings` to read them from. The user's
+  next render job inherited a temporary folder the capture had already deleted
+  and a name like `capture-<timestamp>`. v4.8.23 documented this; this release
+  fixes it.
+  - **Output folder (`TargetDir`).** A queued render job carries the settings it
+    inherited, so the capture queues a throwaway job, reads `TargetDir` off its
+    `GetRenderJobList` entry, deletes the job, and writes the folder back
+    afterwards. A folder that is not put back, or a throwaway job that cannot
+    be removed, is reported in the capture's `warnings` block.
+  - **File name (`CustomName`).** It is no longer written at all. It can be
+    neither read back nor cleared (an empty one is refused), so the capture
+    renders under whatever name the project already produces, into a private
+    folder of its own, and takes the one file that appears there.
+  - Live on Studio 19.1.3.7, with a `.mov` format, an output folder and a custom
+    name set: a job queued after each of 15 captures inherited the same folder,
+    file name, range and format as one queued before, and the render queue was
+    left empty.
+- **One gap remains, and it is stated rather than hidden.** A project that has
+  never had an output folder has none to read (`AddRenderJob` returns `''`),
+  and Resolve cannot clear one once set, so such a project is left with the
+  capture's temporary folder as its `TargetDir`. `timeline_frame capabilities`
+  reports this as `render_settings_caveat`.
+- The captured frame can no longer be confused with, or delete, another file in
+  the shared capture folder. Each capture renders into its own subfolder; the
+  shared one (`~/Documents/resolve-stills` on macOS) is only removed when empty.
+
+### Changed
+
+- `timeline_frame capabilities`: `render_settings_restorable.TargetDir` and
+  `.CustomName` are now `true`, and `render_settings_caveat` is new.
+- A render capture takes about 0.2 s longer (measured: roughly 1.3 s against
+  1.1 s), which is the throwaway job used to read the output folder.
+
+### Documentation
+
+- `api_truth` gains `Project.AddRenderJob (the only readback for render
+  settings)`, measured on Studio 19.1.3.7: what a job entry exposes, that
+  `TargetDir` cannot be cleared, when `AddRenderJob` returns `''`, and that
+  duplicate jobs and existing output files raise no dialog.
+  `docs/reference/api-limitations.md` is regenerated.
+
+### Tests
+
+- `tests/test_playhead_frame_capture.py`: the render fake now models the job
+  queue as the readback it is. `CaptureOutputSettingsTest` covers the folder
+  coming back, the name never being written, a project with no output folder, a
+  same-named file already in the shared folder, the read happening in
+  single-clip mode before anything changes, and both failure reports. Six of
+  its ten tests fail against v4.8.23.
+- `tests/live_frame_capture_page_restore_validation.py` now gives the disposable
+  project a user's render settings and compares what a job inherits before and
+  after every capture, including one from Individual-clips mode.
+
 ## What's New in v4.8.23 — a frame capture no longer leaves Resolve on the Deliver page
 
 ### Fixed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.23-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.24-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.23-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.24-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.23 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.24 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `docs/SKILL.md` (modified, +9/-8)
```diff
@@ -1860,17 +1860,18 @@ metadata. (For the raw camera file instead, use
   `frame` is the absolute timeline frame. Omit both to capture the playhead.
 
 The playhead, page, current timeline and Gallery are restored. The render route
-additionally touches project render settings: render mode, format, codec and the
-mark range are restored and the render job is deleted. `TargetDir` and
-`CustomName` cannot be read back (there is no `GetRenderSettings`), so they are
-not restored: they stay on the capture's temporary folder and name, and
-`capabilities` reports them under `render_settings_restorable`. Set your own
-before the next render. Reach for `quality="thumbnail"` when zero side effects
-matter more than accuracy.
+additionally touches project render settings and puts them back: render mode,
+format, codec, mark range and output folder (`TargetDir`, read off a throwaway
+render job because there is no `GetRenderSettings`). The file name
+(`CustomName`) is never written, and the render job is deleted. One gap: a
+project that has never had an output folder has none to put back, and Resolve
+cannot clear one, so it is left on the capture's temporary folder
+(`capabilities` repeats this as `render_settings_caveat`). Reach for
+`quality="thumbnail"` when zero side effects matter more than accuracy.
 
 The render calls pull Resolve onto the Deliver page. The capture switches back
 and reads the page to confirm it. If a restore does not take (page, playhead,
-timeline, render mode, format or range), the image is followed by a
+timeline, render mode, format, range or output folder), the image is followed by a
 `{"warnings": [...]}` block naming what was left changed and the call that puts
 it back. No warnings block means every restore was confirmed.
 
```

**File**: `docs/reference/api-limitations.md` (modified, +11/-2)
```diff
@@ -12,7 +12,7 @@ that none exists).
 
 **Verified on:** DaVinci Resolve Studio 21.0.2
 
-**Totals:** 41 missing capabilities, 56 bugs / unreliable behaviors.
+**Totals:** 42 missing capabilities, 56 bugs / unreliable behaviors.
 
 The authoritative source is the runtime-queryable `api_truth` ledger
 (`resolve_control api_truth "<query>"`); this document is generated from
@@ -255,6 +255,15 @@ equivalent, blocking full automation.
 - **Workaround / current handling:** Check GetRenderCodecs(format) first; when it is empty, treat the format as unreachable through this API rather than guessing a codec value. Render audio-only via ExportVideo=False on a format that does expose codecs, or drive it from a saved render preset.
 - **Tags:** render, deliver, audio, unsupported
 
+### Project.AddRenderJob (the only readback for render settings)
+
+- **Object:** `Project`
+- **Signature:** `() -> str`
+- **Behavior:** There is no GetRenderSettings, but a queued job carries the settings it inherited. Measured 2026-09-30 on Studio 19.1.3.7: after AddRenderJob, the matching GetRenderJobList entry reports TargetDir, OutputFilename (the custom name, or the timeline name when none was ever set, plus the format's extension), MarkIn/MarkOut, VideoFormat/VideoCodec, RenderMode and PresetName, and DeleteRenderJob removes it. The round trip took about 150 ms and switches Resolve to the Deliver page. Queuing two identical jobs, or a job whose output file already exists, raised no dialog and returned distinct ids. Limits: AddRenderJob returns '' when no TargetDir has ever been set, and also in Individual-clips mode on a generator-only timeline, so neither state can be read this way. Once set, TargetDir cannot be cleared — SetRenderSettings returns False for '' and for None — though a TargetDir that does not exist is accepted. CustomName has no direct readback: it is only visible folded into OutputFilename.
+- **Workaround / current handling:** To preserve a user's output folder across work that has to change it: in single-clip mode, queue a job, read TargetDir off its entry, delete the job, and write TargetDir back afterwards. Leave CustomName alone wherever possible — it can be neither read nor cleared; render into a private folder and take the file that appears instead of naming it.
+- **Reference:** [issue #270](https://github.com/samuelgursky/davinci-resolve-mcp/issues/270)
+- **Tags:** render, deliver, readback, unsupported
+
 ### TimelineItem.SetCDL (write-only — no GetCDL anywhere)
 
 - **Object:** `TimelineItem`
@@ -703,7 +712,7 @@ values, or automation-hostile modal prompts.
 - **Object:** `Project`
 - **Signature:** `({settings}) -> bool`
 - **Behavior:** SetRenderSettings returns False for {'CustomName': ''} and for {'CustomName': None}, and when that key rides in a larger payload the WHOLE payload is rejected, not just the name. Measured 2026-09-30 on Studio 19.1.3.7: with the render range pinned to one frame, {SelectAllFrames: True, MarkIn: start, MarkOut: end, CustomName: ''} returned False and a job added afterwards still carried MarkIn == MarkOut == the pinned frame; the same payload without CustomName returned True and the job carried the whole timeline. A single space IS accepted, and becomes the file name. So a custom name, once set, cannot be cleared through this API, and there is no GetRenderSettings to read the previous one back from.
-- **Workaround / current handling:** Never send an empty CustomName, and never bundle a best-effort key with keys that matter: send the range in its own payload and check its return. To see what a job will inherit, AddRenderJob, read MarkIn/MarkOut/TargetDir/OutputFilename off GetRenderJobList, then DeleteRenderJob.
+- **Workaround / current handling:** Never send an empty CustomName, and never bundle a best-effort key with keys that matter: send each setting in its own payload and check its return. Better, do not write CustomName at all when the name is not yours to keep. To see what a job will in
```

---

### Incident Patch 3: `00f489d1` (2026-09-30)
**Commit Message**: fix(timeline_frame): capture returns to the caller's page; v4.8.23

Issue #270: a render-route capture left Resolve on the Deliver page. The
page to return to was read after Project.GetCurrentRenderMode(), and that
getter switches Resolve to Deliver by itself (measured on Studio 19.1.3.7
from Edit, Color and Fairlight). The recorded page was always 'deliver',
so the restore was skipped. The page is now read before any render call.

Also in the same teardown:
- The switch back is read back with GetCurrentPage. A restore that does
  not take (page, playhead, timeline, render mode, format, range) is
  returned as a {"warnings": [...]} block after the image, or a "warnings"
  key on an error result. A clean capture is still one image.
- The render range was never restored: it shared a SetRenderSettings
  payload with CustomName "", which Resolve refuses whole (19.1.3.7). The
  range now goes in its own payload and its return is checked.

Same getter, same stranding: render get_mode, render
probe_render_settings and granular get_current_render_mode now return to
the page they were called from (page_lock.restoring_page).
resolve_control restore_state lists the page as restored only when 

**File**: `CHANGELOG.md` (modified, +65/-0)
```diff
@@ -2,6 +2,71 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.23 — a frame capture no longer leaves Resolve on the Deliver page
+
+### Fixed
+
+- **`timeline_frame` capture left Resolve on the Deliver page.** ([#270](https://github.com/samuelgursky/davinci-resolve-mcp/issues/270), reported by @Dragonfist76 on Studio 21.1.0.17)
+  The render route (`quality="frame"`, `"preview"`, `"full"`) recorded the page
+  to return to *after* calling `Project.GetCurrentRenderMode()`. That getter
+  switches Resolve to the Deliver page by itself (measured on Studio 19.1.3.7
+  from Edit, Color and Fairlight), so the page recorded was always `deliver` and
+  the restore was skipped as having nothing to do. The page is now read before
+  any render call. Live on 19.1.3.7: 14 captures from seven starting pages all
+  ended on the page they started on.
+- **A restore that does not take is no longer silent.** The switch back is read
+  back with `GetCurrentPage()`. If the page, playhead, current timeline, render
+  mode, render format or render range is not put back, the image is followed by
+  a `{"warnings": [...]}` block naming what was left changed and the call that
+  restores it; an error result carries the same `warnings` key. A clean capture
+  is unchanged: one image.
+- **The render range was never restored after a capture.** The restore shared a
+  `SetRenderSettings` payload with `CustomName: ""`, and Resolve refuses an empty
+  `CustomName` by rejecting the whole payload (measured on 19.1.3.7: `False`, and
+  a job queued afterwards still carried `MarkIn == MarkOut ==` the captured
+  frame). The range now goes in its own payload and its result is checked. Live
+  on 19.1.3.7: a job queued after each capture carried the whole timeline.
+- **`render get_mode`, `render probe_render_settings` and the granular
+  `get_current_render_mode` left Resolve on the Deliver page**, for the same
+  reason: they call the same getter. They now return to the page they were
+  called from.
+- **`resolve_control restore_state` reported the page as restored without
+  checking.** `OpenPage`'s return was discarded. `restored.page` is now written
+  only when the page reads back, and `page_error` says why otherwise.
+- The Color-page and Edit-page guards used by thumbnails and timeline edits
+  discarded `OpenPage` on their way back too. Both now read the page back and
+  log a failure.
+
+### Changed
+
+- `timeline_frame capabilities` returns `render_settings_restorable`, which its
+  docstring already listed. `TargetDir` and `CustomName` are `false`: there is no
+  `GetRenderSettings`, so after a render capture they stay on the capture's
+  temporary folder and name. The docs previously said they were reset.
+
+### Documentation
+
+- `api_truth` gains two measured entries, both on Studio 19.1.3.7:
+  `Project.GetCurrentRenderMode` switches to the Deliver page (with the list of
+  render calls that do and do not), and `Project.SetRenderSettings` rejects a
+  whole payload over an empty `CustomName`. `docs/reference/api-limitations.md`
+  is regenerated.
+
+### Tests
+
+- `tests/test_playhead_frame_capture.py`: the render fake now behaves as
+  measured (the mode getter switches page; an empty `CustomName` refuses the
+  payload). New tests cover the page coming back, a refused or lying `OpenPage`
+  being reported with the image, the warning reaching an MCP client as a text
+  block after the image, and the range Resolve holds after a capture. The two
+  regression tests fail against v4.8.22.
+- `tests/test_page_restore.py`: `restore_page`, `restoring_page`, both page
+  guards, the three render-mode readers and `restore_state`.
+- `tests/test_discarded_resolve_returns.py` now treats `OpenPage` and the
+  `open_page_serialized` wrapper as mutators whose return must be used.
+- `tests/live_frame_capture_page_restore
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.22-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.23-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.22-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.23-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.22 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.23 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `docs/SKILL.md` (modified, +13/-5)
```diff
@@ -1860,11 +1860,19 @@ metadata. (For the raw camera file instead, use
   `frame` is the absolute timeline frame. Omit both to capture the playhead.
 
 The playhead, page, current timeline and Gallery are restored. The render route
-additionally touches project render settings: format and codec are restored and
-the render job is deleted, but `TargetDir`/`CustomName`/mark range cannot be read
-back on builds without `GetRenderSettings`, so they are reset to the full
-timeline rather than restored. Reach for `quality="thumbnail"` when zero side
-effects matter more than accuracy.
+additionally touches project render settings: render mode, format, codec and the
+mark range are restored and the render job is deleted. `TargetDir` and
+`CustomName` cannot be read back (there is no `GetRenderSettings`), so they are
+not restored: they stay on the capture's temporary folder and name, and
+`capabilities` reports them under `render_settings_restorable`. Set your own
+before the next render. Reach for `quality="thumbnail"` when zero side effects
+matter more than accuracy.
+
+The render calls pull Resolve onto the Deliver page. The capture switches back
+and reads the page to confirm it. If a restore does not take (page, playhead,
+timeline, render mode, format or range), the image is followed by a
+`{"warnings": [...]}` block naming what was left changed and the call that puts
+it back. No warnings block means every restore was confirmed.
 
 ```
 timeline_frame(action="capture", params={"timecode": "01:00:15:12", "max_width": 1280})
```

**File**: `docs/reference/api-limitations.md` (modified, +19/-1)
```diff
@@ -12,7 +12,7 @@ that none exists).
 
 **Verified on:** DaVinci Resolve Studio 21.0.2
 
-**Totals:** 41 missing capabilities, 54 bugs / unreliable behaviors.
+**Totals:** 41 missing capabilities, 56 bugs / unreliable behaviors.
 
 The authoritative source is the runtime-queryable `api_truth` ledger
 (`resolve_control api_truth "<query>"`); this document is generated from
@@ -689,6 +689,24 @@ values, or automation-hostile modal prompts.
 - **Reference:** [issue #123](https://github.com/samuelgursky/davinci-resolve-mcp/issues/123)
 - **Tags:** render, deliver, silent-failure, preset, readback-lies
 
+### Project.GetCurrentRenderMode (switches to the Deliver page)
+
+- **Object:** `Project`
+- **Signature:** `() -> int`
+- **Behavior:** A getter with a side effect: calling it switches Resolve to the Deliver page. Measured 2026-09-30 on Studio 19.1.3.7 from the Edit, Color and Fairlight pages: GetCurrentPage() read 'deliver' immediately afterwards, every time. The other render readers do not do this — GetCurrentRenderFormatAndCodec, GetRenderFormats, GetRenderCodecs, GetRenderResolutions, GetRenderJobList, GetRenderPresetList, IsRenderingInProgress and Timeline.GetMarkInOut all left the page alone in the same run. The render WRITERS all switch: SetCurrentRenderMode, SetCurrentRenderFormatAndCodec, SetRenderSettings, AddRenderJob and StartRendering each moved Edit to Deliver; DeleteRenderJob did not. Nothing switches back on its own. Issue #270 reported the consequence on Studio 21.1.0.17 — a frame capture that left the user on Deliver — but the per-call measurement was not repeated on that build.
+- **Workaround / current handling:** Read GetCurrentPage() BEFORE the first render call, not after, and OpenPage back when done. A page read after GetCurrentRenderMode is always 'deliver', which makes a restore look unnecessary — that ordering is how the capture stranded users. src/utils/page_lock.py:restoring_page reads first, restores after, and reads the page back to confirm.
+- **Reference:** [issue #270](https://github.com/samuelgursky/davinci-resolve-mcp/issues/270)
+- **Tags:** render, deliver, page, side-effect, getter
+
+### Project.SetRenderSettings (an empty CustomName rejects the whole payload)
+
+- **Object:** `Project`
+- **Signature:** `({settings}) -> bool`
+- **Behavior:** SetRenderSettings returns False for {'CustomName': ''} and for {'CustomName': None}, and when that key rides in a larger payload the WHOLE payload is rejected, not just the name. Measured 2026-09-30 on Studio 19.1.3.7: with the render range pinned to one frame, {SelectAllFrames: True, MarkIn: start, MarkOut: end, CustomName: ''} returned False and a job added afterwards still carried MarkIn == MarkOut == the pinned frame; the same payload without CustomName returned True and the job carried the whole timeline. A single space IS accepted, and becomes the file name. So a custom name, once set, cannot be cleared through this API, and there is no GetRenderSettings to read the previous one back from.
+- **Workaround / current handling:** Never send an empty CustomName, and never bundle a best-effort key with keys that matter: send the range in its own payload and check its return. To see what a job will inherit, AddRenderJob, read MarkIn/MarkOut/TargetDir/OutputFilename off GetRenderJobList, then DeleteRenderJob.
+- **Reference:** [issue #270](https://github.com/samuelgursky/davinci-resolve-mcp/issues/270)
+- **Tags:** render, deliver, silent-failure, unreliable-return
+
 ### ProjectManager.SaveProject
 
 - **Object:** `ProjectManager`
```

---

### Incident Patch 4: `89da04b1` (2026-09-26)
**Commit Message**: fix(control-panel): port check cannot hang on a wedged lsof; v4.8.22

_port_owner_pid ran lsof through subprocess.run(timeout=3). On macOS lsof
wedges in uninterruptible kernel wait (state U) on a stale network mount
and ignores SIGKILL; subprocess.run's timeout path kills the child and
then waits for it, so the caller hung with the child. Measured
2026-09-26: 489 lsof processes stuck 12 h, offline suite blocked here
13 min.

Now Popen with start_new_session, poll to the deadline, kill and abandon
the child on expiry, read stdout only after poll() reports an exit, close
the pipe on every path. Missing lsof is still None.

tests/test_port_owner_pid.py: stuck fake child returns None in time with
wait()/communicate() never called; exited child yields its PID; missing
binary yields None; a real SIGTERM-ignoring child with kill patched out
is left running. Old code against the real wedged lsof hung past a 25 s
alarm; new code returns None in 3.02 s. Suite 3932 OK with real lsof.

**File**: `CHANGELOG.md` (modified, +25/-0)
```diff
@@ -2,6 +2,31 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.22 — the control panel port check cannot hang on a wedged lsof
+
+### Fixed
+
+- **`open_control_panel` could block forever behind an unkillable `lsof`.** The
+  port-owner check ran `lsof -iTCP:<port> -sTCP:LISTEN -t` through
+  `subprocess.run(timeout=3)`. On macOS, lsof wedges in uninterruptible kernel wait
+  (state `U` in `ps`) when a network mount is stale, and a process in that state
+  ignores SIGKILL. `subprocess.run`'s timeout path kills the child and then waits
+  for it, so the 3-second timeout never returned: the caller hung with the child.
+  Measured on 2026-09-26 on the release machine, where 489 lsof processes had been
+  stuck for 12 hours and the offline suite sat in this function for 13 minutes.
+  `_port_owner_pid` now starts lsof in its own session, polls to the deadline, and
+  on expiry sends SIGKILL and abandons the child instead of joining it. stdout is
+  read only once `poll()` reports an exit, and the pipe is closed on every path.
+  A missing lsof is still `None`, not an exception.
+
+### Tests
+
+- `tests/test_port_owner_pid.py`: a fake child whose `poll()` never returns and
+  whose `kill()` is a no-op yields `None` within the deadline with `wait()` and
+  `communicate()` never called and the pipe closed; an exited child still yields
+  its PID; a missing binary yields `None`; and a real subprocess that ignores
+  SIGTERM, with `kill` patched out, is left running rather than joined.
+
 ## What's New in v4.8.21 — timeline duration no longer overcounts by one frame
 
 ### Fixed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.21-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.22-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.21-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.22-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.21 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.22 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.21"
+VERSION = "4.8.22"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.21",
+  "version": "4.8.22",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.21",
+      "version": "4.8.22",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

---

### Incident Patch 5: `373fb503` (2026-09-26)
**Commit Message**: fix(duration): remove off-by-one in granular and project_properties duration

get_current_timeline (granular/timeline.py) and get_project_info
(utils/project_properties.py) reported a timeline's duration as
GetEndFrame() - GetStartFrame() + 1, one frame more than server.py,
utils/brain_edits.py and scripts/render_stress.py report for the same
timeline. GetEndFrame() points just past the last frame, so the + 1
counts a frame that is not there.

The new test fails before the change (601 instead of 600 for a timeline
from 86400 to 87000) and passes after.

**File**: `src/granular/timeline.py` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ def get_current_timeline() -> Dict[str, Any]:
             "width": current_timeline.GetSetting("timelineResolutionWidth"),
             "height": current_timeline.GetSetting("timelineResolutionHeight")
         },
-        "duration": current_timeline.GetEndFrame() - current_timeline.GetStartFrame() + 1
+        "duration": current_timeline.GetEndFrame() - current_timeline.GetStartFrame()
     }
     
     return result
```

**File**: `src/utils/project_properties.py` (modified, +1/-1)
```diff
@@ -592,7 +592,7 @@ def get_project_info(project_obj) -> Dict[str, Any]:
                 timeline_info = {
                     "name": timeline.GetName(),
                     "isCurrent": timeline.GetName() == current_timeline_name,
-                    "duration": timeline.GetEndFrame() - timeline.GetStartFrame() + 1
+                    "duration": timeline.GetEndFrame() - timeline.GetStartFrame()
                 }
                 project_info["timelines"].append(timeline_info)
         
```

**File**: `tests/test_timeline_duration.py` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+"""Off-by-one: granular/timeline and utils/project_properties report
+duration as ``GetEndFrame() - GetStartFrame() + 1``, one frame more than the
+real value.  server.py and scripts/render_stress.py both use the correct
+``GetEndFrame() - GetStartFrame()`` form, and the Resolve mock in
+test_variant_audio_accounting derives GetEndFrame from an item whose
+``GetEnd() - GetStart() == GetDuration()`` — no +1.
+
+A timeline spanning frames 86400..87000 has 600 frames; the buggy path
+reports 601.
+"""
+
+import types
+import unittest
+
+import src.granular.timeline as gtimeline
+import src.granular.common  as gcommon
+import src.utils.project_properties as pp
+
+
+# ── Stubs ────────────────────────────────────────────────────────────────────
+
+
+class _FakeTimeline:
+    def GetName(self):
+        return "Main"
+
+    def GetUniqueId(self):
+        return "tl-main"
+
+    def GetStartFrame(self):
+        return 86400
+
+    def GetEndFrame(self):
+        return 87000
+
+    def GetSetting(self, key):
+        return {"timelineFrameRate": "24.0",
+                "timelineResolutionWidth": "1920",
+                "timelineResolutionHeight": "1080"}.get(key)
+
+    def GetStartTimecode(self):
+        return "01:00:00:00"
+
+
+class _FakeProject:
+    def __init__(self, tl):
+        self._tl = tl
+
+    def GetCurrentTimeline(self):
+        return self._tl
+
+    def GetName(self):
+        return "TestProject"
+
+    def GetTimelineCount(self):
+        return 1
+
+    def GetTimelineByIndex(self, idx):
+        return self._tl if idx == 1 else None
+
+    def GetSetting(self, key):
+        return None
+
+    def GetCurrentRenderFormatAndCodec(self):
+        return {"format": "mp4", "codec": "H264"}
+
+
+# ── Tests ────────────────────────────────────────────────────────────────────
+
+
+class GranularTimelineDurationTest(unittest.TestCase):
+    """get_current_timeline must report duration == EndFrame - StartFrame."""
+
+    def setUp(self):
+        self._tl = _FakeTimeline()
+        self._proj = _FakeProject(self._tl)
+        self._orig = gcommon.get_current_project
+        gcommon.get_current_project = lambda: (object(), self._proj)
+        # The granular module imports get_current_project via star-import,
+        # so patch it there too.
+        gtimeline.get_current_project = gcommon.get_current_project
+
+    def tearDown(self):
+        gcommon.get_current_project = self._orig
+        gtimeline.get_current_project = self._orig
+
+    def test_duration_equals_end_minus_start(self):
+        out = gtimeline.get_current_timeline()
+        expected = self._tl.GetEndFrame() - self._tl.GetStartFrame()  # 600
+        self.assertEqual(out["duration"], expected,
+                         f"duration should be {expected}, got {out['duration']}")
+
+
+class ProjectPropertiesDurationTest(unittest.TestCase):
+    """get_project_info must report duration == EndFrame - StartFrame."""
+
+    def setUp(self):
+        self._tl = _FakeTimeline()
+        self._proj = _FakeProject(self._tl)
+
+    def test_duration_equals_end_minus_start(self):
+        info = pp.get_project_info(self._proj)
+        expected = self._tl.GetEndFrame() - self._tl.GetStartFrame()  # 600
+        tl_entry = info["timelines"][0]
+        self.assertEqual(tl_entry["duration"], expected,
+                         f"duration should be {expected}, got {tl_entry['duration']}")
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 6: `6337d8cf` (2026-09-24)
**Commit Message**: fix(params): coerce every boolean param read; v4.8.20

server.py read ~160 boolean params with bare truthiness, so "false",
"no", "0" and "off" behaved as true. 126 get(k, True|False)/bool(get)
reads and 36 bare truth-context reads now go through _coerce_bool with
the handler's own default, plus 9 caller-option reads in src/utils.
Impactful cases: override_governance="false" skipped governance
enforcement, close with stop_render="false" stopped the render,
propose_grade execute="false" executed, clear_flags/clear_clip_color,
install/cleanup and allow_timeline_mismatch all inverted.

allow_non_mcp_name and overwrite were already coerced at the point of
use; their handler reads are coerced for consistency.

Guard tests fail on the previous code (47 subtests); two AST ratchets
keep bare reads out of server.py.

**File**: `CHANGELOG.md` (modified, +48/-0)
```diff
@@ -2,6 +2,54 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.20 — every boolean param honours `"false"`
+
+### Fixed
+
+- **Boolean tool params read with bare truthiness, file-wide.** The last four
+  releases fixed this one key at a time (`background`, `create_missing`, `dry_run`,
+  `include_*`). This release sweeps the rest: 126 `p.get("k", True|False)` /
+  `bool(p.get(...))` reads and 36 bare `if p.get("k"):` tests of flag params in
+  `src/server.py`, plus 9 reads in `src/utils` (multicam setup, Fuse/DCTL template
+  options, the batch-analysis `auto_build_index`). A caller sending `"false"` (or
+  `"no"`, `"0"`, `"off"`) got the opposite of what they asked for. The cases that
+  mattered:
+  - `override_governance="false"` skipped AI-governance enforcement in `enforce` mode.
+  - `project_manager(action="close", stop_render="false")` stopped a running render
+    and closed the project instead of refusing.
+  - `timeline_item_color(action="propose_grade", execute="false")` took the execute path.
+  - `timeline_markers(action="clear_annotations_by_scope", clear_flags="false" /
+    clear_clip_color="false")` cleared them, and `media_pool_item(action="open_in_viewer",
+    clear_marks="false")` cleared the clip's mark in/out.
+  - `timeline_item_color(action="apply_trace_plan", allow_timeline_mismatch="false")` allowed a mismatched timeline.
+  - The extension lifecycle probes installed on `install="false"` and removed the
+    install on `cleanup="false"`; `grab_and_export` deleted the grabbed still from the
+    Gallery album on `delete_after="false"` and discarded its staging files on
+    `cleanup="false"`; the export round-trip deleted the
+    imported timeline on `cleanup_imported="false"`.
+  Every read keeps its default when the key is omitted, `None`, or an unrecognized
+  string. One change for explicit `null`: a key whose default is `True` (e.g.
+  `overwrite` in the lifecycle probes, `require_temp_path`) now reads `null` as that
+  default instead of as false.
+- **Correction to an earlier claim.** `allow_non_mcp_name="false"` and
+  `overwrite="false"` were *not* bypasses: `_require_disposable_project_name`,
+  `_extension_safe_name` and the `fuse_plugin`/`dctl` install actions already coerce at
+  the point of use. Their handler reads are coerced now for consistency, and tests pin
+  that a real `False` reaches the next layer.
+- Left as-is on purpose: `from_preset` (a preset name), `reference_movie` (a path), the
+  server-set `_setup_defaults_applied` marker, and `generate_speech`'s
+  `AddToTimeline`, which is passed verbatim to Resolve.
+
+### Tests
+
+- `tests/test_bool_param_coercion.py`: behavioural guards for governance override,
+  close-during-render, `propose_grade` execute, annotation clearing, the Fuse probe's
+  install/cleanup, Fuse/DCTL template flags, and the `allow_non_mcp_name` /
+  `overwrite` contracts. 47 subtests fail on the previous code.
+- Two AST ratchets on `src/server.py`: every `x.get("k", True|False)` sits inside a
+  coercer (fallback chains included), and a key coerced anywhere in the file is never
+  tested with bare truthiness on caller input.
+
 ## What's New in v4.8.19 — generated OFX nodes bind their params on Resolve 21.0
 
 ### Fixed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.19-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.20-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.19-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.20-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.19 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.20 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.19"
+VERSION = "4.8.20"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.19",
+  "version": "4.8.20",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.19",
+      "version": "4.8.20",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

---

### Incident Patch 7: `c7af3ee1` (2026-09-23)
**Commit Message**: fix(copy_clip_annotations): coerce include_markers/flags/clip_color through _coerce_bool

_copy_clip_annotations read the three annotation-type opt-out flags with
bare p.get(), so a caller sending include_flags="false" (or "no", "0",
"off") got a truthy non-empty string and flags were copied anyway — the
same bug that dry_run carried before v4.8.17.

Route each read through _coerce_bool(..., True) so the false spellings
suppress the copy and the default (omitting the key) keeps the current
copy-everything behaviour.

Guard tests: 15 subtests cover all five false spellings for each of the
three parameters, plus a positive-path check that omitting any flag still
copies everything.

**File**: `src/server.py` (modified, +3/-3)
```diff
@@ -14657,9 +14657,9 @@ def _copy_clip_annotations(root, p: Dict[str, Any]):
     markers = source.GetMarkers() or {}
     flags = source.GetFlagList() or []
     color = source.GetClipColor()
-    include_markers = p.get("include_markers", True)
-    include_flags = p.get("include_flags", True)
-    include_color = p.get("include_clip_color", True)
+    include_markers = _coerce_bool(p.get("include_markers"), True)
+    include_flags = _coerce_bool(p.get("include_flags"), True)
+    include_color = _coerce_bool(p.get("include_clip_color"), True)
     results = []
     for target_id in target_ids:
         target = _find_clip(root, str(target_id))
```

**File**: `tests/test_copy_clip_annotations_coercion.py` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+"""include_markers/flags/clip_color="false" must suppress the copy.
+
+_copy_clip_annotations read include_markers, include_flags, and
+include_clip_color with bare p.get(): a string "false", "no", "0", or "off"
+is truthy in Python, so a caller explicitly opting out of an annotation
+type still had it copied.  Each read should go through _coerce_bool, like
+the dry_run read in the same function already does.
+"""
+import unittest
+
+from src.server import _copy_clip_annotations
+from tests.test_media_pool_ingest_probe import FolderStub, MediaPoolItemStub
+
+FALSE_SPELLINGS = ("false", "False", "no", "0", "off")
+
+
+class TrackingClip(MediaPoolItemStub):
+    """Subclass that records SetClipColor calls so tests can inspect them."""
+
+    def __init__(self, *args, **kwargs):
+        super().__init__(*args, **kwargs)
+        self.set_color_calls = []
+
+    def SetClipColor(self, color):
+        self.set_color_calls.append(color)
+        return True
+
+
+def _tree():
+    source = MediaPoolItemStub(unique_id="src-1", name="source.mov")
+    target = TrackingClip(unique_id="tgt-1", name="target.mov")
+    target.flags = []
+    target.markers = {}
+    root = FolderStub(clips=[source, target])
+    return root, source, target
+
+
+class CopyClipAnnotationsCoercionTest(unittest.TestCase):
+    """include_*="false" must suppress each annotation type."""
+
+    def test_include_flags_false_suppresses_flag_copy(self):
+        for spelling in FALSE_SPELLINGS:
+            with self.subTest(spelling=spelling):
+                root, _src, tgt = _tree()
+                result = _copy_clip_annotations(root, {
+                    "source_clip_id": "src-1",
+                    "target_clip_ids": ["tgt-1"],
+                    "include_flags": spelling,
+                })
+                self.assertTrue(result.get("success"), result)
+                self.assertEqual(tgt.flags, [],
+                    f"include_flags={spelling!r} should suppress flag copy but flags were added")
+
+    def test_include_markers_false_suppresses_marker_copy(self):
+        for spelling in FALSE_SPELLINGS:
+            with self.subTest(spelling=spelling):
+                root, _src, tgt = _tree()
+                result = _copy_clip_annotations(root, {
+                    "source_clip_id": "src-1",
+                    "target_clip_ids": ["tgt-1"],
+                    "include_markers": spelling,
+                })
+                self.assertTrue(result.get("success"), result)
+                self.assertEqual(tgt.markers, {},
+                    f"include_markers={spelling!r} should suppress marker copy but markers were added")
+
+    def test_include_clip_color_false_suppresses_color_copy(self):
+        for spelling in FALSE_SPELLINGS:
+            with self.subTest(spelling=spelling):
+                root, _src, tgt = _tree()
+                result = _copy_clip_annotations(root, {
+                    "source_clip_id": "src-1",
+                    "target_clip_ids": ["tgt-1"],
+                    "include_clip_color": spelling,
+                })
+                self.assertTrue(result.get("success"), result)
+                self.assertEqual(tgt.set_color_calls, [],
+                    f"include_clip_color={spelling!r} should suppress color copy but SetClipColor was called")
+
+    def test_true_spelling_still_copies_all(self):
+        """Positive-path sanity: omitting the flags copies everything."""
+        root, _src, tgt = _tree()
+        result = _copy_clip_annotations(root, {
+            "source_clip_id": "src-1",
+            "target_clip_ids": ["tgt-1"],
+        })
+        self.assertTrue(result.get("success"), result)
+        self.assertNotEqual(tgt.flags, [], "flags should have been copied")
+        self.assertNotEqual(tgt.markers, {}, "markers should have been copied")
```

---

### Incident Patch 8: `683f97be` (2026-09-23)
**Commit Message**: fix(drx-codec): bind generated OFX params via keyed instance id; encode int params

Generated OFX nodes (e.g. Color Space Transform) applied with the right label and
plugin but ran on the plugin's defaults: the stored params never bound.

Native Resolve (Studio 21.0 CST capture) writes the tool-list instance entry
(0xC000005E) as "<context>_<clip-version DbId>_<node id>" and keeps the bare
context only in the OFX container's F3. The generator wrote the bare context in
both slots. generateMultiNodeDRX now creates the clip version DbId before the
nodes and passes a keyed instanceKey to buildOFXToolEntry (explicit
options.instanceKey still wins).

Integer/choice params (CST doFwdOOTF / doInvOOTF) are varint F3 on the wire, not
F2 doubles. buildOFXToolEntry now accepts {int: n} and booleans, and
extract-ofx-params decodes F3 to {int: n} (previously null), so parse -> generate
round-trips them.

Live check on Resolve Studio 21.0.0.48: a generated CC -> Balance -> CST
(DWG/Intermediate -> Rec.709 2.4) graph applied via ApplyGradeFromDRX exports a
33-pt LUT bit-identical (35,937/35,937 points) to the same CST built by hand;
before the fix the LUTs differed (max 0.95).

Tests: new __tests_

**File**: `resolve-advanced/vendor/drx-codec/__tests__/ofx-instance-key.test.js` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+/**
+ * OFX instance binding + integer params in generated DRX.
+ *
+ * Native Resolve (Studio 21.0 CST capture) writes the tool-list instance entry
+ * (0xC000005E) as "<context>_<clip-version DbId>_<node id>" while the OFX
+ * container's F3 keeps the bare context. With the bare context in both slots
+ * the node applies but the plugin's stored params never bind — verified live by
+ * exporting a 33-pt LUT: the generated CST only matched a hand-built CST
+ * (bit-identical, 35,937/35,937 points) once the keyed form was emitted.
+ *
+ * Integer params (doFwdOOTF / doInvOOTF) are varint F3 on the wire.
+ */
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const zlib = require('node:zlib');
+
+const { drxGenerator, drxParser } = require('..');
+
+const CST = 'com.blackmagicdesign.resolvefx.colorspacetransformv2';
+
+function decompressClipBody(xml) {
+  const hex = xml.match(/<pClipFullVer>[\s\S]*?<Body>([0-9a-f]+)<\/Body>/)[1];
+  const body = Buffer.from(hex, 'hex');
+  assert.equal(body[0], 0x81);
+  const decompress = zlib.zstdDecompressSync
+    ? (b) => zlib.zstdDecompressSync(b)
+    : (b) => Buffer.from(require('fzstd').decompress(b));
+  return decompress(body.subarray(1));
+}
+
+async function generateCstGraph() {
+  const nodes = [
+    { label: 'CC' },
+    {
+      label: 'CST 709',
+      params: {
+        ofx: {
+          pluginId: CST,
+          params: {
+            inputColorSpace: 'DWG_COLORSPACE',
+            inputGamma: 'DAV_INTER_OETF_GAMMA',
+            outputColorSpace: 'REC709_COLORSPACE',
+            outputGamma: 'TWOPOINTFOUR_GAMMA',
+            doFwdOOTF: { int: 1 },
+            doInvOOTF: { int: 0 },
+          },
+          options: { version: '1.4' },
+        },
+      },
+    },
+  ];
+  return drxGenerator.generateMultiNodeDRX(nodes, [{ from: 1, to: 2 }], { label: 'test' });
+}
+
+test('tool-list instance entry is keyed by clip version DbId and node id', async () => {
+  const xml = await generateCstGraph();
+  const versionId = xml.match(/<pClipFullVer>\s*<ListMgt::LmVersion DbId="([0-9a-f-]+)"/)[1];
+  const raw = decompressClipBody(xml);
+  // Fresh mode numbers nodes from 2, so the CST (second node) has id 3.
+  const keyed = Buffer.from(`OfxImageEffectContextFilter_${versionId}_3`, 'utf-8');
+  assert.ok(raw.includes(keyed), 'keyed instance id present in tool list');
+});
+
+test('OFX container keeps the bare context name', async () => {
+  const xml = await generateCstGraph();
+  const parsed = await drxParser.parseDRXContent(xml);
+  const tool = parsed.nodes[1].ofxTools[0];
+  assert.equal(tool.pluginId, CST);
+  assert.equal(tool.instanceId, 'OfxImageEffectContextFilter');
+});
+
+test('integer params round-trip as {int} via varint F3', async () => {
+  const xml = await generateCstGraph();
+  const parsed = await drxParser.parseDRXContent(xml);
+  const params = parsed.nodes[1].ofxTools[0].params;
+  assert.deepEqual(params.doFwdOOTF, { int: 1 });
+  assert.deepEqual(params.doInvOOTF, { int: 0 });
+  assert.equal(params.inputColorSpace, 'DWG_COLORSPACE');
+  assert.equal(params.outputGamma, 'TWOPOINTFOUR_GAMMA');
+
+  // wire check: name entry followed by F2{F3 varint 1}
+  const raw = decompressClipBody(xml);
+  const name = Buffer.from('doFwdOOTF', 'utf-8');
+  const expected = Buffer.concat([Buffer.from([0x0a, name.length]), name, Buffer.from([0x12, 0x02, 0x18, 0x01])]);
+  assert.ok(raw.includes(expected), 'doFwdOOTF encoded as varint F3');
+});
+
+test('explicit instanceKey option is honoured', async () => {
+  const xml = await drxGenerator.generateMultiNodeDRX(
+    [{ label: 'X', params: { ofx: { pluginId: CST, params: {}, options: { instanceKey: 'Custom_key_9' } } } }],
+    [],
+    { label: 'test' },
+  );
+  assert.ok(decompressClipBody(xml).includes(Buffer.from('Custom_key_9')));
+});
```

**File**: `resolve-advanced/vendor/drx-codec/drx-generator.js` (modified, +24/-4)
```diff
@@ -900,7 +900,12 @@ function createNode(nodeId, xPos, yPos, colorParams = null, options = {}) {
   // OFX spec ({ofx:{pluginId, params, options?}}), emit the full OFX container instead
   // (params are self-describing name/value pairs on the wire — see extract-ofx-params).
   if (colorParams && colorParams.ofx && colorParams.ofx.pluginId) {
-    parts.push(buildOFXToolEntry(colorParams.ofx.pluginId, colorParams.ofx.params || {}, colorParams.ofx.options || {}));
+    const ofxOptions = { ...(colorParams.ofx.options || {}) };
+    if (options.clipVersionId && !ofxOptions.instanceKey) {
+      const ctx = ofxOptions.instanceId || 'OfxImageEffectContextFilter';
+      ofxOptions.instanceKey = `${ctx}_${options.clipVersionId}_${nodeId}`;
+    }
+    parts.push(buildOFXToolEntry(colorParams.ofx.pluginId, colorParams.ofx.params || {}, ofxOptions));
   } else {
     // Structure: F10 = {F1 = {F1=0xC0000001, F2={F2=2}}}
     const f10InnerInner = Buffer.concat([
@@ -1750,6 +1755,8 @@ async function generateMultiNodeDRX(nodes, connections, metadata = {}) {
   } = metadata;
 
   const timestamp = generateTimestamp();
+  // The clip version DbId is also the key Resolve embeds in each OFX node's instance id.
+  const clipVersionId = require('node:crypto').randomUUID();
 
   // Determine node ID scheme
   let baseNodeId, firstNodeId, lastNodeId;
@@ -1798,6 +1805,7 @@ async function generateMultiNodeDRX(nodes, connections, metadata = {}) {
         label: nodeConfig.label || `Node ${nodeIndex}`,
         enabled: nodeConfig.enabled !== false,
         nodeIndex: nodeIndex, // Pass separate index for F2 field
+        clipVersionId,
       }
     );
     containerParts.push(node);
@@ -1861,7 +1869,7 @@ async function generateMultiNodeDRX(nodes, connections, metadata = {}) {
   // Generate UUIDs
   const { randomUUID: uuidv4 } = require('node:crypto');
   const stillId = uuidv4();
-  const clipVersionId = uuidv4();
+  // clipVersionId is generated before the nodes (it keys OFX instances).
 
   const now = new Date().toISOString().replace('Z', '');
 
@@ -3981,6 +3989,13 @@ function buildOFXToolEntry(pluginId, params, options = {}) {
   // plugin un-instantiated: node applies but the effect never engages — found live
   // 2026-07-03). Callers can still override for generator/transition contexts.
   const instanceId = options.instanceId || 'OfxImageEffectContextFilter';
+  // The tool-list instance entry (0xC000005E) is NOT the bare context name in native
+  // captures: Resolve writes "<context>_<clip-version DbId>_<node id>" there (e.g.
+  // "OfxImageEffectContextFilter_06aff833-..._5", Resolve Studio 21.0 CST capture),
+  // while the container's F3 keeps the bare context. With the bare name in both
+  // slots the node applies but the plugin's stored params do not bind, so it runs on
+  // defaults. generateMultiNodeDRX supplies the keyed form via options.instanceKey.
+  const instanceKey = options.instanceKey || instanceId;
 
   // Build F5 repeated param entries. Native containers always carry resolvefxVersion
   // and serialize params in name order — mirror both.
@@ -3993,6 +4008,11 @@ function buildOFXToolEntry(pluginId, params, options = {}) {
     if (typeof value === 'string') {
       const strBuf = Buffer.from(value, 'utf-8');
       valueBuf = protoBytes(5, strBuf);
+    } else if (typeof value === 'boolean') {
+      valueBuf = protoVarint(3, value ? 1 : 0);
+    } else if (value && typeof value === 'object' && Number.isInteger(value.int)) {
+      // Integer/choice params (e.g. CST doFwdOOTF) are varint F3 on the wire, not F2 doubles.
+      valueBuf = protoVarint(3, value.int);
     } else {
       valueBuf = protoFloat64(2, value);
     }
@@ -4023,10 +4043,10 @@ function buildOFXToolEntry(pluginId, params, options = {}) {
       protoVarint(1, ID_PLUGIN),
       protoBytes(2, protoBytes(5, Buffer.from(pluginId, 'utf-8'))),
     ])),
-    // Instance ID
+    // Instance ID (keyed form — see instanceKey above)
     protoBytes
```

**File**: `resolve-advanced/vendor/drx-codec/extract-ofx-params.js` (modified, +7/-1)
```diff
@@ -88,7 +88,11 @@ const OFY_MARKER = 0x4F4659;
 /**
  * Decode an F5 param-entry buffer to {name, value}.
  * F1 = name (length-delimited UTF-8)
- * F2 = wrapped value (F2 = float64 OR F5 = UTF-8 string)
+ * F2 = wrapped value (F2 = float64, F3 = varint int/choice, OR F5 = UTF-8 string)
+ *
+ * Integer params (e.g. Color Space Transform doFwdOOTF / doInvOOTF) come back as
+ * {int: n} — the same shape buildOFXToolEntry accepts — so a parse → generate
+ * round-trip re-emits them as varints instead of dropping or float-encoding them.
  */
 function decodeParamEntry(entryBuf) {
   let name = '';
@@ -103,6 +107,8 @@ function decodeParamEntry(entryBuf) {
       for (const inn of inner) {
         if (inn.fieldNum === 2 && inn.wireType === 1) {
           value = inn.value; // float64
+        } else if (inn.fieldNum === 3 && inn.wireType === 0) {
+          value = { int: Number(inn.value) };
         } else if (inn.fieldNum === 5 && inn.wireType === 2) {
           value = utf8(inn.value);
         }
```

---

### Incident Patch 9: `ad24d117` (2026-09-22)
**Commit Message**: fix(dry_run): coerce every handler dry_run read; v4.8.17

61 reads in src/server.py and the media-rules generator read dry_run
with bare truthiness, so dry_run="false" returned a preview while the
destructive hook (already coercing) had gated the call as a mutation.
All now go through _coerce_bool with the handler's own default. Guard
test adds behavioural checks plus an AST ratchet on server.py.

Follow-up to #266.

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -2,6 +2,22 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.17 — `dry_run="false"` runs the real operation
+
+### Fixed
+
+- **Handlers read `dry_run` with bare truthiness.** 61 reads in `src/server.py` and
+  the `script_plugin` media-rules generator treated `dry_run="false"` (or `"no"`,
+  `"0"`, `"off"`) as true and returned a preview, even though the destructive-op hook,
+  which already coerced the flag, had gated the call as a real mutation. Every
+  handler read now goes through `_coerce_bool` with the handler's own default, so
+  actions that preview by default keep doing so when the flag is omitted or `None`.
+  Reads that already used the media-analysis and setup coercers are unchanged.
+  Follow-up to [#266](https://github.com/samuelgursky/davinci-resolve-mcp/pull/266).
+  Guard test: `organize_clips` and `safe_import_folder` act on five false spellings
+  (ten subtests failing on the previous code), plus an AST ratchet that fails on any
+  `p.get("dry_run")` in `server.py` not wrapped in a coercer.
+
 ## What's New in v4.8.16 — `organize_clips` honours `create_missing="false"`
 
 ### Fixed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.16-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.17-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.16-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.17-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.16 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.17 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.16"
+VERSION = "4.8.17"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.16",
+  "version": "4.8.17",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.16",
+      "version": "4.8.17",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

---

### Incident Patch 10: `649865cd` (2026-09-22)
**Commit Message**: fix(media_pool): read create_missing="false" as false in organize_clips

_organize_clips checked `p.get("create_missing")` with bare truthiness:
a string "false", "no", "0", or "off" is truthy in Python, so a caller
explicitly opting out of folder creation still got one via
_ensure_folder_path.

Route through _coerce_bool, the same helper every other boolean
parameter in the server already uses.

**File**: `src/server.py` (modified, +1/-1)
```diff
@@ -13559,7 +13559,7 @@ def _organize_clips(mp, root, p: Dict[str, Any]):
     target_path = p.get("target_path")
     if not target_path:
         return _err("target_path is required")
-    if p.get("create_missing"):
+    if _coerce_bool(p.get("create_missing")):
         target, target_err = _ensure_folder_path(mp, target_path)
     else:
         target = _navigate_folder(mp, target_path)
```

**File**: `tests/test_organize_clips_create_missing.py` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+"""create_missing="false" in organize_clips must not create folders.
+
+_organize_clips checked ``p.get("create_missing")`` with bare truthiness: a
+string "false", "no", "0", or "off" is truthy in Python, so a caller
+explicitly requesting *no* folder creation still got one via
+_ensure_folder_path. Route through _coerce_bool like every other boolean
+parameter in the server.
+"""
+import unittest
+from unittest import mock
+
+from src import server as s
+
+
+class FakeClip:
+    def __init__(self, name, uid):
+        self._name = name
+        self._uid = uid
+
+    def GetName(self):
+        return self._name
+
+    def GetUniqueId(self):
+        return self._uid
+
+
+class FakeFolder:
+    def __init__(self, name, uid, clips=None, subs=None):
+        self._name = name
+        self._uid = uid
+        self._clips = clips or []
+        self._subs = subs or []
+
+    def GetName(self):
+        return self._name
+
+    def GetUniqueId(self):
+        return self._uid
+
+    def GetClipList(self):
+        return list(self._clips)
+
+    def GetSubFolderList(self):
+        return list(self._subs)
+
+
+class FakeMP:
+    def __init__(self, root):
+        self._root = root
+        self.added_folders = []
+
+    def GetRootFolder(self):
+        return self._root
+
+    def GetCurrentFolder(self):
+        return self._root
+
+    def AddSubFolder(self, parent, name):
+        self.added_folders.append((parent.GetName(), name))
+        created = FakeFolder(name, f"uid-{name}")
+        return created
+
+    def MoveClips(self, clips, target):
+        return True
+
+
+class OrganizeClipsCreateMissingTest(unittest.TestCase):
+    """create_missing="false" must NOT create missing target folders."""
+
+    def _make_tree(self):
+        clip = FakeClip("A.mov", "clip-a")
+        root = FakeFolder("Master", "root", clips=[clip])
+        mp = FakeMP(root)
+        return mp, root, clip
+
+    def test_string_false_does_not_create_folder(self):
+        """create_missing="false" must fail when the target folder is missing."""
+        mp, root, clip = self._make_tree()
+        for spelling in ("false", "False", "FALSE", "no", "0", "off"):
+            with self.subTest(spelling=spelling):
+                mp.added_folders.clear()
+                out = s._organize_clips(mp, root, {
+                    "target_path": "Nonexistent/Deep",
+                    "clip_ids": [clip.GetUniqueId()],
+                    "create_missing": spelling,
+                })
+                self.assertFalse(out.get("success"),
+                    f'create_missing="{spelling}" must not succeed '
+                    f'when the folder does not exist')
+                self.assertEqual(mp.added_folders, [],
+                    f'create_missing="{spelling}" must not call AddSubFolder')
+
+    def test_true_creates_folder(self):
+        """Sanity: create_missing=True must create the folder."""
+        mp, root, clip = self._make_tree()
+        out = s._organize_clips(mp, root, {
+            "target_path": "NewFolder",
+            "clip_ids": [clip.GetUniqueId()],
+            "create_missing": True,
+        })
+        self.assertTrue(out.get("success"))
+        self.assertEqual(len(mp.added_folders), 1)
+
+    def test_omitted_does_not_create_folder(self):
+        """Default (no create_missing key) must not create folders."""
+        mp, root, clip = self._make_tree()
+        out = s._organize_clips(mp, root, {
+            "target_path": "Missing",
+            "clip_ids": [clip.GetUniqueId()],
+        })
+        self.assertFalse(out.get("success"))
+        self.assertEqual(mp.added_folders, [])
+
+
+if __name__ == "__main__":
+    unittest.main()
```

#### Recent Merged Pull Requests:
- **PR #269** (2026-09-26): fix(duration): remove off-by-one in granular and project_properties (@Dev-next-gen)
- **PR #268** (2026-09-23): fix(copy_clip_annotations): coerce include_markers/flags/clip_color through _coerce_bool (@Dev-next-gen)
- **PR #267** (2026-09-23): fix(drx-codec): bind generated OFX params via keyed instance id; encode int params (@noah1234j)
- **PR #266** (2026-09-22): fix(media_pool): read create_missing="false" as false in organize_clips (@Dev-next-gen)
- **PR #265** (2026-09-21): fix(background): read background="false" as false in _run_maybe_background (@Dev-next-gen)
- **PR #264** (2026-09-21): chore(deps): both dependency trees read zero advisories again (@denvital)
- **PR #263** (closed): feat(codex): migrate project defaults to GPT-6 Astra (@panda8413)
- **PR #262** (2026-09-19): fix(timeline): read include_linked="false" as false (@Dev-next-gen)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

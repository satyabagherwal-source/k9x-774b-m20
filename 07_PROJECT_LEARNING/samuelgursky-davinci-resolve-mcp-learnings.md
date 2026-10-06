# Forensic Learning Record (Deep Inspection): samuelgursky/davinci-resolve-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/samuelgursky-davinci-resolve-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:04:05.181Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `samuelgursky/davinci-resolve-mcp`
- **Description**: MCP server integration for DaVinci Resolve Studio
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3362 stars

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
        return [t for t in operands[-1:] if is_media(t) and not is_scratch(t)]

    return [
        a for a in args
        if not a.startswith("-") and is_media(a) and not is_scratch(a, destructive)
    ]


def main() -> None:
    event = load_event()

    command = str((event.get("tool_input") or {}).get("command", ""))
    if not command.strip():
        sys.exit(0)

    hits: List[str] = []
    for segment in split_commands(command):
        hits.extend(endangered_targets(segment))

    if not hits:
        sys.exit(0)

    listed = "\n".join(f"  - {path}" for path in dict.fromkeys(hits))
    decide(
        "deny",
        "Blocked: this command writes to, moves, or deletes source media outside a "
        "scratch root.\n\n"
        f"{listed}\n\n"
        "AGENTS.md: never modify, transcode, convert, proxy, relink, replace, or create "
        "derivatives of source media unless the user asked for that exact operation. "
        "Reading is fine — ffprobe, and ffmpeg that writes into scratch, both pass.\n\n"
        "Send derivatives to the session scratch directory or the "
        "davinci-resolve-mcp-analysis project root instead. If the user did explicitly "
        "ask for this exact operation on this exact file, say so and let them approve it.",
    )


if __name__ == "__main__":
    main()

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

### Core Architecture Module: `.codex/hooks/frame_verification_guard.py`
```
#!/usr/bin/env python3
import os
import runpy
from pathlib import Path

os.environ["DAVINCI_AGENT_HOST"] = "codex"
runpy.run_path(str(Path(__file__).resolve().parents[2] / ".agents/hooks/frame_verification_guard.py"), run_name="__main__")

```

### Core Architecture Module: `.codex/hooks/source_media_guard.py`
```
#!/usr/bin/env python3
import os
import runpy
from pathlib import Path

os.environ["DAVINCI_AGENT_HOST"] = "codex"
runpy.run_path(str(Path(__file__).resolve().parents[2] / ".agents/hooks/source_media_guard.py"), run_name="__main__")

```

### Core Architecture Module: `resolve-advanced/server/render-manifest.mjs`
```
/**
 * Cluster D — render_manifest + reconcile. Build an expected-outputs manifest (checksums +
 * frame counts) BEFORE/AT render, then reconcile the actual outputs AFTER: every deliverable
 * rendered, right length, no dropped/duplicate frames (by frame-count mismatch), checksum match.
 *
 * Silent-lie discipline: a manifest entry asserts bytes-read>0; reconcile flags missing/extra/
 * size-mismatch/frame-count-mismatch rather than glossing. Black-frame-run detection is a
 * SAMPLED live follow-up (honest scope note) — this reconciles structure + checksum + count.
 *
 * Deps: node crypto (checksums, always available) + ffprobe (frame counts, peer/optional). No Resolve.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { probeMedia } from './ffprobe-media.mjs';
import { hasFfprobe } from './capabilities.mjs';

/** sha256 of a file (streamed). Asserts bytes>0. */
export function checksumFile(file) {
  const st = fs.statSync(file);
  if (!st.size) throw new Error(`checksum: '${file}' is 0 bytes (empty-green silent-lie guard)`);
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return { sha256: h.digest('hex'), size: st.size };
}

/**
 * Build a manifest for a set of expected output files.
 * @param {Array<{name?:string, path:string, entity?:string}>} outputs
 * @param {{probeFrames?:boolean}} [opts]
 */
export function buildManifest(outputs, opts = {}) {
  const probeFrames = opts.probeFrames !== false && hasFfprobe();
  const entries = [];
  const missing = [];
  for (const o of outputs) {
    if (!fs.existsSync(o.path)) {
      missing.push({ name: o.name || path.basename(o.path), path: o.path });
      continue;
    }
    const { sha256, size } = checksumFile(o.path);
    const entry = { name: o.name || path.basename(o.path), path: o.path, entity: o.entity || null, sha256, size };
    if (probeFrames) {
      const p = probeMedia(o.path);
      if (p && p.video) {
        entry.frameCount = p.video.frameCount;
        entry.duration = p.format.duration;
        entry.fps = p.video.fps;
      }
    }
    entries.push(entry);
  }
  return { version: 1, count: entries.length, outputs: entries, missing };
}

/**
 * Reconcile a prior manifest against the actual files on disk NOW.
 * @param {object} manifest a buildManifest() result
 * @param {{probeFrames?:boolean, expectExtraIn?:string}} [opts]
 */
export function reconcileManifest(manifest, opts = {}) {
  const probeFrames = opts.probeFrames !== false && hasFfprobe();
  const results = [];
  for (const e of manifest.outputs || []) {
    const r = { name: e.name, path: e.path };
    if (!fs.existsSync(e.path)) {
      results.push({ ...r, status: 'missing', pass: false });
      continue;
    }
    const { sha256, size } = checksumFile(e.path);
    const checksumMatch = sha256 === e.sha256;
    const sizeMatch = size === e.size;
    let frameMatch = null;
    if (probeFrames && e.frameCount != null) {
      const p = probeMedia(e.path);
      const fc = p && p.video ? p.video.frameCount : null;
      frameMatch = fc === e.frameCount;
      r.frameCount = fc;
      r.expectedFrameCount = e.frameCount;
    }
    const pass = checksumMatch && sizeMatch && frameMatch !== false;
    results.push({ ...r, status: pass ? 'ok' : 'changed', pass, checksumMatch, sizeMatch, ...(frameMatch !== null ? { frameMatch } : {}) });
  }
  const failed = results.filter((r) => !r.pass);
  return {
    pass: failed.length === 0,
    reconciled: results.length,
    failedCount: failed.length,
    results,
    gate: 'review',
    note: 'checksum + size + frame-count reconcile. Black-frame/duplicate-run detection is a SAMPLED live follow-up, not covered here.',
  };
}

```

### Core Architecture Module: `scripts/mode_matrix_worker.py`
```
#!/usr/bin/env python3
"""Run probes in order, streaming one JSONL result per probe. Not run directly.

Launched by `scripts/mode_matrix.py`, which supervises it. The division of labour
is the whole design: this process is *expected* to die. When a probe never
returns there is nothing this side can do about it — the call is blocked inside
fusionscript, and a Python signal handler cannot preempt a thread parked in a C
`pthread_cond_wait`. So the worker's only obligation is to have already written
down everything it finished, in order, flushed, before it hangs. The supervisor
reads that and infers the culprit from what is missing.

Consequences of that contract, both load-bearing:

  - every result is written and flushed immediately, never batched;
  - probes run in the catalogue's order, so "first missing" is unambiguous.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.utils.mode_matrix import classify_outcome  # noqa: E402
from src.utils.probe_catalogue import CATALOGUE, fingerprint  # noqa: E402
from src.utils.project_cleanup import UNSAVED_DEFAULT_PROJECT, save_project_if_safe  # noqa: E402
from src.utils import resolve_runtime as rr  # noqa: E402


class Context:
    """What a probe body is handed."""

    def __init__(self) -> None:
        self.resolve: Any = None
        self.pm: Any = None
        self.project: Any = None
        self.timeline: Any = None
        self.item: Any = None
        self.clip: Any = None
        self.work: Path = Path(tempfile.mkdtemp(prefix="mode_matrix_"))
        self.project_name = ""


def connect() -> Any:
    api = os.environ.get(
        "RESOLVE_SCRIPT_API",
        "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting",
    )
    modules = str(Path(api) / "Modules")
    if modules not in sys.path:
        sys.path.append(modules)
    import DaVinciResolveScript as dvr

    for _ in range(120):
        resolve = dvr.scriptapp("Resolve")
        if resolve is not None:
            try:
                pm = resolve.GetProjectManager()
                if pm is not None and pm.GetCurrentDatabase():
                    return resolve
            except Exception:
                pass
        time.sleep(1)
    return None


def make_media(work: Path) -> Path:
    clip = work / "probe_source.mov"
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error",
         "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=2",
         "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
         "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac",
         "-y", str(clip)],
        check=True, timeout=180,
    )
    return clip


def build_fixture(ctx: Context) -> None:
    """A disposable project with one clip on one timeline."""
    ctx.pm = ctx.resolve.GetProjectManager()
    # Guarded: on the never-saved default project this call hangs forever
    # headless. The worker reaching it here would take down setup for every
    # probe rather than for the one probe that is meant to measure it.
    save_project_if_safe(ctx.pm)
    ctx.project_name = f"MODE_MATRIX_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    if not ctx.pm.CreateProject(ctx.project_name):
        raise RuntimeError(f"could not create {ctx.project_name}")
    ctx.pm.LoadProject(ctx.project_name)
    ctx.project = ctx.pm.GetCurrentProject()

    media = make_media(ctx.work)
    clips = ctx.resolve.GetMediaStorage().AddItemListToMediaPool([str(media)]) or []
    ctx.clip = clips[0] if clips else None
    if ctx.clip is None:
        raise RuntimeError("media import produced no clips")
    pool = ctx.project.GetMediaPool()
    ctx.timeline = pool.CreateTimelineFromClips("PROBE_TL", [ctx.clip])
    if ctx.timeline:
        ctx.project.SetCurrentTimeline(ctx.timeline)
        items = ctx.timeline.GetItemListInTrack("video", 1) or []
        ctx.item = items[0] if items else None


def ensure_state(ctx: Context, state: str) -> Optional[str]:
    """Put Resolve on the project this probe needs. Returns a skip reason or None.

    `untitled` means Resolve's never-saved default project — reachable by closing
    whatever is open. It exists as a state because the only mode-dependent hang
    found so far happens exclusively there, and a catalogue that always ran
    against a well-formed scratch project reported no differences at all.
    """
    current = ctx.pm.GetCurrentProject()
    name = current.GetName() if current else None
    if state == "untitled":
        if name == UNSAVED_DEFAULT_PROJECT:
            return None
        # SAVE BEFORE CLOSING. The scratch project has unsaved changes by this
        # point (media imported, timeline built), and CloseProject on a modified
        # project raises the GUI's "save changes?" dialog — which blocked the
        # whole application, put a modal on the user's screen, and got
        # misattributed to the probe that never got to run. It is a named
        # project, so the save is safe in both modes.
        save_project_if_safe(ctx.pm)
        ctx.pm.CloseProject(current) if current else None
        current = ctx.pm.GetCurrentProject()
        name = current.GetName() if current else None
        return None if name == UNSAVED_DEFAULT_PROJECT else f"could not reach the default project (on {name!r})"
    if name != ctx.project_name:
        if not ctx.pm.LoadProject(ctx.project_name):
            return f"could not return to the scratch project (on {name!r})"
        ctx.project = ctx.pm.GetCurrentProject()
        ctx.timeline = ctx.project.GetCurrentTimeline() if ctx.project else None
        if ctx.timeline:
            items = ctx.timeline.GetItemListInTrack("video", 1) or []
            ctx.item = items[0] if items else None
    return None


def unmet(ctx: Context, needs) -> Optional[str]:
    for need in needs:
        if getattr(ctx, need, None) is None:
            return f"needs {need}"
    return None


def emit(handle, record: Dict[str, Any]) -> None:
    handle.write(json.dumps(record, default=str) + "\n")
    handle.flush()
    os.fsync(handle.fileno())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--probes", nargs="+", required=True)
    args = parser.parse_args()

    mode = "headless" if rr.is_headless() else "gui"
    ctx = Context()
    ctx.resolve = connect()
    if ctx.resolve is None:
        print("worker: no healthy Resolve", file=sys.stderr)
        return 2

    wanted = set(args.probes)
    probes = [p for p in CATALOGUE if p.name in wanted]

    with args.out.open("a", encoding="utf-8") as handle:
        try:
            build_fixture(ctx)
        except Exception as exc:
            for probe in probes:
                emit(handle, {"probe": probe.name, "category": probe.category,
                              "outcome": "skipped", "mode": mode,
                              "detail": f"fixture failed: {type(exc).__name__}: {exc}"})
            return 3

        for probe in probes:
            # Breadcrumbs, so a hang can be attributed to the phase that caused
            # it. Setting up a probe's state is itself a sequence of Resolve
            # calls that can block, and blaming the probe for a hang in its
            # setup sends the reader looking at the wrong call — which is exactly
            # what happened when CloseProject-on-a-modified-project raised a
            # dialog and `pm.save_untitled_project` was recorded as the culprit.
            emit(handle, {"_start": probe.name, "phase": "state"})
            skip = ensure_state(ctx, probe.state) or unmet(ctx, probe.needs)
            if skip:
                emit(handle, {"probe": probe.name, "category": probe.category,
                              "outcome": "skipped", "mode": mode, "detail": skip})
                continue
            emit(handle, {"_start": probe.name, "phase": "body"})
            started = time.monotonic()
            try:
                value = probe.body(ctx)
                outcome = classify_outcome(value)
                detail = ""
            except Exception as exc:
                value, outcome, detail = None, "raised", f"{type(exc).__name__}: {exc}"
            emit(handle, {
                "probe": probe.name, "category": probe.category, "outcome": outcome,
                "value": repr(value)[:200] if outcome != "raised" else None,
                "seconds": round(time.monotonic() - started, 2),
                "mode": mode, "detail": detail, "note": probe.note,
                "catalogue": fingerprint(),
            })

        # Teardown: close (releases the session lock) before deleting, and never
        # leave the session on the unsaveable default project.
        try:
            ctx.pm.LoadProject(ctx.project_name)
            ctx.pm.CloseProject(ctx.pm.GetCurrentProject())
            ctx.pm.DeleteProject(ctx.project_name)
        except Exception:
            pass
    shutil.rmtree(ctx.work, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #272** (2026-10-04): **plan_silence_ripple hangs indefinitely on Windows (free 21.0.2 via bridge), server then crashes**
  *Symptoms*: Environment: Windows 11, DaVinci Resolve Free 21.0.2.4 via in-app bridge, MCP v4.8.27, Python 3.12.10, ffmpeg 9.0.2 (gyan.dev) on PATH, Claude Desktop.  edit_engine plan_silence_ripple never returns, regardless of clip length (18 min and 3 min tested, MKV 1080p60, 12 audio channels). Client cancels after 4 min; when the worker later responds, the server crashes with "AssertionError: Request already responded to", taking the connection down.  Other tools (import, create_timeline_from_clips, probe_clip_properties) work fine. Setting PYTHONUTF8=1 fixed earlier cp1252 UnicodeEncodeError logging errors but not the hang.  Possible cause: ffmpeg subprocess inheriting the MCP stdio stdin on Windows (missing -nostdin / stdin=DEVNULL)?
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v4.8.28](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.8.28). Thank you. Your stdin guess was right, and the details you gave (the 4-minute cancel, then the crash when the worker answered) were enough to find the second bug too.  **The hang.** ffmpeg checks stdin for keyboard commands while it runs. The runner behind every ffmpeg/ffprobe pass let the child inherit the server's stdin, and over stdio that is the JSON-RPC stream. The `c` in `"jsonrpc"` is ffmpeg's "enter a command" key. Once that prompt opens, ffmpeg waits for a newline and consumes protocol bytes while it waits. Measured with ffmpeg 9.0.2 using the exact argv `plan_silence_ripple` builds:  | stdin given to ffmpeg | Result | |---|---| | `DEVNULL` | finished normally | | inherited pipe, nothing written | finished normally | | inherited pipe, a partial JSON-RPC frame arrives mid-run | hung until killed; stderr shows `Enter command` |  That run was on macOS, and I can't test on Windows. But ff
  > Thanks for the quick fix! Confirmed on Windows 11 with Resolve Free 21.0.2.4 via the in-app bridge, MCP v4.8.28, ffmpeg 9.0.2 (gyan.dev):  plan_silence_ripple now completes in about 5 seconds on a 3-minute 1080p60 MKV timeline (12 audio channels) – the exact case that hung indefinitely on v4.8.27. 41 silence lifts detected, no hang, no server crash.  Really appreciate the detailed write-up of the root cause – the "c" in "jsonrpc" opening ffmpeg's command prompt is a great find.

- **Issue #270** (2026-10-05): **timeline_frame capture (quality=preview/frame) leaves Resolve on the Deliver page; the restore failure is silent**
  *Symptoms*: <!-- Tip: from any MCP client you can ask the assistant to "send this as a bug". It drafts this report for you with the server version, Resolve build, connection mode and OS already filled in. -->   ### What happened  A frame-exact capture switched Resolve from the Edit page to the Deliver page and left it there. The docstring says the page is restored, and _playhead_frame_render does attempt it — but in its finally block the result of OpenPage is discarded and any exception is swallowed (`try: _open_page_serialized(resolve, original_page) except Exception: pass`, around server.py:15269). The capture result carried no warning, so the caller has no way to know the user was stranded. A manual resolve_control open_page("edit") a few seconds later succeeded, which suggests the restore runs too early (while Resolve is still leaving the render) rather than OpenPage being unable to do it.  ### Steps to reproduce  1. Resolve Studio 21 open on the Edit page, a timeline active, playhead parked. 2. timeline_frame(action="capabilities") -> current_page: "edit". 3. timeline_frame(action="capture", params={"quality": "preview", "max_width": 1280, "format": "jpg"}) with no timecode (current playhead). 4. timeline_frame(action="capabilities") again.  ### Expected  current_page is "edit" again after the capture, as the docstring states ("The playhead, the Color page, the current timeline and the Gallery are all restored"). If the restore cannot be done, the capture result says so.  ### Actual
  **Post-Mortem & Fix Analysis**:
  > Fixed across [v4.8.23](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.8.23) (the page) and [v4.8.24](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.8.24) (the output folder and file name). Thank you for a report precise enough to reproduce from.  Your symptom was right and so was the silent `finally`. The cause turned out to be different from the timing theory, and it reproduces on Studio 19.1.3.7 too.  **What was happening.** The capture recorded "the page to go back to" *after* calling `Project.GetCurrentRenderMode()`. That getter switches Resolve to the Deliver page by itself. So the recorded page was always `deliver`, and the restore was skipped as having nothing to do. `OpenPage` was never refused; it was never called. Measured on 19.1.3.7 from the Edit page:  | Call | Page afterwards | |---|---| | `GetCurrentRenderFormatAndCodec`, `GetRenderFormats`, `GetRenderCodecs`, `GetRenderJobList`, `GetRenderPresetList`, `IsRenderingInProgress` | `
  > Closing this as fixed in [v4.8.23](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.8.23) and [v4.8.24](https://github.com/samuelgursky/davinci-resolve-mcp/releases/tag/v4.8.24). Both changes are covered by tests and were validated live on Studio 19.1.3.7.  The 21.1 check is still welcome. If the capture leaves you on Deliver on 21.1.0.17, or if `python tests/live_frame_capture_page_restore_validation.py` reports a mismatch, please reopen this with the output and I'll pick it up. Thanks again for the report.

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

### Incident Patch 1: `8fbd185e` (2026-10-06)
**Commit Message**: Merge pull request #276 from Dev-next-gen/fix/conform-lint-nested-source-reuse

**File**: `src/utils/conform_lint.py` (modified, +13/-1)
```diff
@@ -337,14 +337,26 @@ def check_duplicate_usage(items: Sequence[Mapping[str, Any]]) -> List[Dict[str,
                 length = int(entry["timeline_end_frame"]) - int(entry["timeline_start_frame"])
             spans.append((start, start + max(0, length), _name(entry)))
         spans.sort()
-        for (a_start, a_end, a_name), (b_start, b_end, b_name) in zip(spans, spans[1:]):
+        # Each pull is compared against the furthest-reaching EARLIER pull, not
+        # against its immediate predecessor. Sorted by source in-point, one long
+        # pull is followed by every short callback lifted from inside it, so
+        # `spans[i - 1]` is the previous CALLBACK — which the next callback need
+        # not overlap — and the reuse of the long pull went unreported from the
+        # second callback onward. Where the out-points already increase the
+        # furthest pull *is* the predecessor, so ordinary material is unchanged.
+        furthest = spans[0]
+        for current in spans[1:]:
+            b_start, b_end, b_name = current
+            a_start, a_end, a_name = furthest
             if b_start < a_end:
                 dupes.append({
                     "source": str(ref),
                     "first": a_name,
                     "second": b_name,
                     "overlap_frames": min(a_end, b_end) - b_start,
                 })
+            if b_end > a_end:
+                furthest = current
     if not dupes:
         return []
     return [_finding(
```

**File**: `tests/test_conform_lint.py` (modified, +40/-0)
```diff
@@ -68,6 +68,46 @@ def test_media_with_no_reference_is_a_blocker(self) -> None:
         self.assertIn("OFFLINE_MEDIA", codes(out))
 
 
+class DuplicateUsageTests(unittest.TestCase):
+    """Reuse is legitimate; the value is knowing about all of it, not some of it."""
+
+    @staticmethod
+    def _reuse_pairs(out):
+        for finding in out["findings"]:
+            if finding["code"] == "DUPLICATE_USAGE":
+                return {(row["first"], row["second"]) for row in finding["items"]}
+        return set()
+
+    def test_two_adjacent_pulls_from_one_source_do_not_overlap(self) -> None:
+        """Two separate shots out of one clip are two shots, not a dupe."""
+        out = cl.lint_timeline(snapshot([
+            item(item_name="TAKE 1", source_start_frame=0, timeline_start_frame=0, timeline_end_frame=100),
+            item(item_name="TAKE 2", source_start_frame=500, timeline_start_frame=100, timeline_end_frame=200),
+        ]))
+        self.assertNotIn("DUPLICATE_USAGE", codes(out))
+
+    def test_every_callback_inside_one_long_pull_is_reported(self) -> None:
+        """A montage callback lifted from inside a long take is reuse, and so is the next one.
+
+        Sorted by source in-point the long pull comes first and the callbacks
+        follow it, so comparing only neighbouring pulls measured the second
+        callback against the first — which it does not overlap — and the report
+        named one reuse out of two.
+        """
+        out = cl.lint_timeline(snapshot([
+            item(item_name="INTERVIEW", source_start_frame=0,
+                 timeline_start_frame=0, timeline_end_frame=5000),
+            item(item_name="CALLBACK 1", source_start_frame=100,
+                 timeline_start_frame=6000, timeline_end_frame=6100),
+            item(item_name="CALLBACK 2", source_start_frame=300,
+                 timeline_start_frame=7000, timeline_end_frame=7100),
+        ]))
+        self.assertEqual(
+            self._reuse_pairs(out),
+            {("INTERVIEW", "CALLBACK 1"), ("INTERVIEW", "CALLBACK 2")},
+        )
+
+
 class InterchangeTests(unittest.TestCase):
     def test_scale_to_frame_size_is_flagged(self) -> None:
         """Its sizing data does not reach Resolve at all — every shot redone by hand."""
```

---

### Incident Patch 2: `f4a1aae9` (2026-10-05)
**Commit Message**: fix(conform_lint): report every reuse of one source, not just the first

check_duplicate_usage sorts a source's pulls by in-point and then walks
them with zip(spans, spans[1:]), so each pull is only ever measured
against its immediate predecessor.

That ordering puts a long pull first and every short callback lifted from
inside it after, which means the predecessor of the second callback is the
FIRST callback — a range it does not overlap. So the reuse of the long
take is reported once and then silently stops being reported, which is the
montage case the docstring names: an interview used at length, then two
moments pulled back out of it for a callback.

On a snapshot shaped exactly as _edit_engine_collect_items builds it for
editorial(action="conform_lint") — INTERVIEW at source 0 for 5000 frames,
CALLBACK 1 at source 100 and CALLBACK 2 at source 300, all one media_path
— the finding read "1 source ranges are used more than once" and listed
only INTERVIEW/CALLBACK 1. CALLBACK 2 overlaps INTERVIEW by 100 frames and
was absent, so an editor reading the turnover report sees that moment as
used once.

Each pull is now compared against the furthest-reaching earlier pull. Where
out-poin

**File**: `src/utils/conform_lint.py` (modified, +13/-1)
```diff
@@ -337,14 +337,26 @@ def check_duplicate_usage(items: Sequence[Mapping[str, Any]]) -> List[Dict[str,
                 length = int(entry["timeline_end_frame"]) - int(entry["timeline_start_frame"])
             spans.append((start, start + max(0, length), _name(entry)))
         spans.sort()
-        for (a_start, a_end, a_name), (b_start, b_end, b_name) in zip(spans, spans[1:]):
+        # Each pull is compared against the furthest-reaching EARLIER pull, not
+        # against its immediate predecessor. Sorted by source in-point, one long
+        # pull is followed by every short callback lifted from inside it, so
+        # `spans[i - 1]` is the previous CALLBACK — which the next callback need
+        # not overlap — and the reuse of the long pull went unreported from the
+        # second callback onward. Where the out-points already increase the
+        # furthest pull *is* the predecessor, so ordinary material is unchanged.
+        furthest = spans[0]
+        for current in spans[1:]:
+            b_start, b_end, b_name = current
+            a_start, a_end, a_name = furthest
             if b_start < a_end:
                 dupes.append({
                     "source": str(ref),
                     "first": a_name,
                     "second": b_name,
                     "overlap_frames": min(a_end, b_end) - b_start,
                 })
+            if b_end > a_end:
+                furthest = current
     if not dupes:
         return []
     return [_finding(
```

**File**: `tests/test_conform_lint.py` (modified, +40/-0)
```diff
@@ -68,6 +68,46 @@ def test_media_with_no_reference_is_a_blocker(self) -> None:
         self.assertIn("OFFLINE_MEDIA", codes(out))
 
 
+class DuplicateUsageTests(unittest.TestCase):
+    """Reuse is legitimate; the value is knowing about all of it, not some of it."""
+
+    @staticmethod
+    def _reuse_pairs(out):
+        for finding in out["findings"]:
+            if finding["code"] == "DUPLICATE_USAGE":
+                return {(row["first"], row["second"]) for row in finding["items"]}
+        return set()
+
+    def test_two_adjacent_pulls_from_one_source_do_not_overlap(self) -> None:
+        """Two separate shots out of one clip are two shots, not a dupe."""
+        out = cl.lint_timeline(snapshot([
+            item(item_name="TAKE 1", source_start_frame=0, timeline_start_frame=0, timeline_end_frame=100),
+            item(item_name="TAKE 2", source_start_frame=500, timeline_start_frame=100, timeline_end_frame=200),
+        ]))
+        self.assertNotIn("DUPLICATE_USAGE", codes(out))
+
+    def test_every_callback_inside_one_long_pull_is_reported(self) -> None:
+        """A montage callback lifted from inside a long take is reuse, and so is the next one.
+
+        Sorted by source in-point the long pull comes first and the callbacks
+        follow it, so comparing only neighbouring pulls measured the second
+        callback against the first — which it does not overlap — and the report
+        named one reuse out of two.
+        """
+        out = cl.lint_timeline(snapshot([
+            item(item_name="INTERVIEW", source_start_frame=0,
+                 timeline_start_frame=0, timeline_end_frame=5000),
+            item(item_name="CALLBACK 1", source_start_frame=100,
+                 timeline_start_frame=6000, timeline_end_frame=6100),
+            item(item_name="CALLBACK 2", source_start_frame=300,
+                 timeline_start_frame=7000, timeline_end_frame=7100),
+        ]))
+        self.assertEqual(
+            self._reuse_pairs(out),
+            {("INTERVIEW", "CALLBACK 1"), ("INTERVIEW", "CALLBACK 2")},
+        )
+
+
 class InterchangeTests(unittest.TestCase):
     def test_scale_to_frame_size_is_flagged(self) -> None:
         """Its sizing data does not reach Resolve at all — every shot redone by hand."""
```

---

### Incident Patch 3: `4f80d017` (2026-10-05)
**Commit Message**: chore(release): v4.8.29 — optional granular arguments accept an explicit null

Lands #274 from @vishalhabib99. Sixteen optional arguments on nine granular
tools were annotated str/float/bool/int with a None default, so their schema
advertised "default": null on a type that rejected null. Clients that fill
optional arguments with the advertised default failed validation before the
tool ran. They are now Optional[T].

tests/test_tool_schema_null_defaults.py checks both servers offline; on
v4.8.28 it names all sixteen. Schema-only; no Resolve call changed.
Suite 3999 OK (2 skipped).

**File**: `CHANGELOG.md` (modified, +32/-0)
```diff
@@ -2,6 +2,38 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.29 — optional granular arguments accept an explicit null
+
+### Fixed
+
+- **Sixteen optional arguments on nine granular tools rejected `null`.**
+  They were annotated `str` / `float` / `bool` / `int` with a `None`
+  default, so the generated schema advertised `"default": null` on a field
+  whose type excluded null. Clients that fill every optional argument with
+  its advertised default sent `null`, and the call failed argument
+  validation before the tool ran. Affected: `create_project`
+  (`media_location_path`), `set_color_space_tool` (`gamma`),
+  `import_layout_preset_tool` and `import_user_preferences_preset`
+  (`preset_name`), `set_timeline_item_composite` (`composite_mode`,
+  `opacity`), `set_timeline_item_retime` (`speed`, `process`),
+  `set_timeline_item_stabilization` (`enabled`, `method`, `strength`),
+  `set_timeline_item_audio` (`volume`, `pan`, `eq_enabled`) and
+  `modify_keyframe` (`new_value`, `new_frame`). They are now `Optional[T]`;
+  callers that omit them see no change. Only the granular server (`--full`)
+  was affected. Contributed by @vishalhabib99 (#274).
+
+### Tests
+
+- `tests/test_tool_schema_null_defaults.py` (new) lists every tool on the
+  compound and granular servers offline and fails on any argument whose
+  default is null but whose schema rejects null. On v4.8.28 it names all
+  sixteen.
+
+### Validation
+
+- Schema-only change; no Resolve scripting call changed, so no live run was
+  required.
+
 ## What's New in v4.8.28 — ffmpeg can no longer hang on the protocol stream; a cancelled call no longer kills the server
 
 ### Fixed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.28-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.29-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.28-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.29-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.28 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.29 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.28"
+VERSION = "4.8.29"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.28",
+  "version": "4.8.29",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.28",
+      "version": "4.8.29",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.28",
+  "version": "4.8.29",
   "description": "NPM bootstrapper for the DaVinci Resolve MCP Server.",
   "license": "MIT",
   "author": "Samuel Gursky <samgursky@gmail.com>",
```

**File**: `src/granular/common.py` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@
         handlers=[logging.StreamHandler()],
     )
 
-VERSION = "4.8.28"
+VERSION = "4.8.29"
 logger = logging.getLogger("davinci-resolve-mcp")
 logger.info(f"Starting DaVinci Resolve MCP Server v{VERSION}")
 logger.info(f"Detected platform: {get_platform()}")
```

**File**: `src/server.py` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     python src/server.py --full       # Start the 377-tool granular server instead
 """
 
-VERSION = "4.8.28"
+VERSION = "4.8.29"
 
 import base64
 import os
```

---

### Incident Patch 4: `9fd6ae0d` (2026-10-05)
**Commit Message**: Merge pull request #274 from vishalhabib99/fix/nullable-optional-args

**File**: `src/granular/project.py` (modified, +2/-2)
```diff
@@ -140,7 +140,7 @@ def open_project(name: str) -> str:
 
 
 @mcp.tool()
-def create_project(name: str, media_location_path: str = None) -> str:
+def create_project(name: str, media_location_path: Optional[str] = None) -> str:
     """Create a new project with the given name.
     
     Args:
@@ -728,7 +728,7 @@ def set_color_science_mode_tool(mode: str) -> str:
 
 @mcp.tool()
 @granular_destructive_op()
-def set_color_space_tool(color_space: str, gamma: str = None) -> str:
+def set_color_space_tool(color_space: str, gamma: Optional[str] = None) -> str:
     """Set timeline color space and gamma.
     
     Args:
```

**File**: `src/granular/resolve_control.py` (modified, +2/-2)
```diff
@@ -262,7 +262,7 @@ def export_layout_preset_tool(preset_name: str, export_path: str) -> Dict[str, A
 
 
 @mcp.tool()
-def import_layout_preset_tool(import_path: str, preset_name: str = None) -> Dict[str, Any]:
+def import_layout_preset_tool(import_path: str, preset_name: Optional[str] = None) -> Dict[str, Any]:
     """Import a layout preset from a file.
 
     Calls Resolve.ImportLayoutPreset() to import a preset from disk.
@@ -701,7 +701,7 @@ def delete_user_preferences_preset(preset_name: str) -> Dict[str, Any]:
 
 
 @mcp.tool()
-def import_user_preferences_preset(import_path: str, preset_name: str = None) -> Dict[str, Any]:
+def import_user_preferences_preset(import_path: str, preset_name: Optional[str] = None) -> Dict[str, Any]:
     """Import a user-preferences preset from a file (Resolve 21.0.4+).
 
     The imported preset is NOT auto-loaded; it takes its name from the file
```

**File**: `src/granular/timeline_item.py` (modified, +11/-11)
```diff
@@ -358,8 +358,8 @@ def set_timeline_item_crop(timeline_item_id: str,
 @mcp.tool()
 @granular_destructive_op()
 def set_timeline_item_composite(timeline_item_id: str, 
-                               composite_mode: str = None, 
-                               opacity: float = None) -> str:
+                               composite_mode: Optional[str] = None, 
+                               opacity: Optional[float] = None) -> str:
     """Set composite properties for a timeline item.
     
     Args:
@@ -446,8 +446,8 @@ def set_timeline_item_composite(timeline_item_id: str,
 @mcp.tool()
 @granular_destructive_op()
 def set_timeline_item_retime(timeline_item_id: str, 
-                            speed: float = None, 
-                            process: str = None) -> str:
+                            speed: Optional[float] = None, 
+                            process: Optional[str] = None) -> str:
     """Set retiming properties for a timeline item.
     
     Args:
@@ -525,9 +525,9 @@ def set_timeline_item_retime(timeline_item_id: str,
 @mcp.tool()
 @granular_destructive_op()
 def set_timeline_item_stabilization(timeline_item_id: str, 
-                                   enabled: bool = None, 
-                                   method: str = None,
-                                   strength: float = None) -> str:
+                                   enabled: Optional[bool] = None, 
+                                   method: Optional[str] = None,
+                                   strength: Optional[float] = None) -> str:
     """Set stabilization properties for a timeline item.
     
     Args:
@@ -617,9 +617,9 @@ def set_timeline_item_stabilization(timeline_item_id: str,
 @mcp.tool()
 @granular_destructive_op()
 def set_timeline_item_audio(timeline_item_id: str, 
-                           volume: float = None, 
-                           pan: float = None,
-                           eq_enabled: bool = None) -> str:
+                           volume: Optional[float] = None, 
+                           pan: Optional[float] = None,
+                           eq_enabled: Optional[bool] = None) -> str:
     """Set audio properties for a timeline item.
     
     Args:
@@ -947,7 +947,7 @@ def add_keyframe(timeline_item_id: str, property_name: str, frame: int, value: f
 
 
 @mcp.tool()
-def modify_keyframe(timeline_item_id: str, property_name: str, frame: int, new_value: float = None, new_frame: int = None) -> str:
+def modify_keyframe(timeline_item_id: str, property_name: str, frame: int, new_value: Optional[float] = None, new_frame: Optional[int] = None) -> str:
     """Modify an existing keyframe by changing its value or frame position.
     
     Args:
```

**File**: `tests/test_tool_schema_null_defaults.py` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+"""Every tool argument that defaults to ``None`` must accept ``null``.
+
+An argument annotated ``str = None`` (or ``float = None``, ``bool = None``)
+becomes a schema like ``{"type": "string", "default": null}``: it advertises a
+default its own type rejects. Some agent frameworks fill every optional argument
+with its advertised default, so they send ``null``, and the call fails argument
+validation before the tool runs. Sixteen granular arguments had this shape, for
+example ``create_project.media_location_path``.
+
+Runs fully offline: enumerating tools via ``mcp.list_tools()`` touches no live
+handle.
+"""
+import asyncio
+import unittest
+
+
+def _allows_null(schema):
+    if schema.get("type") == "null":
+        return True
+    if isinstance(schema.get("type"), list) and "null" in schema["type"]:
+        return True
+    return any(_allows_null(s) for s in schema.get("anyOf", []))
+
+
+def _null_default_args_rejecting_null(mcp):
+    bad = []
+    for tool in asyncio.run(mcp.list_tools()):
+        for name, prop in tool.inputSchema.get("properties", {}).items():
+            if "default" in prop and prop["default"] is None and not _allows_null(prop):
+                bad.append(f"{tool.name}.{name}")
+    return sorted(bad)
+
+
+class NullDefaultSchemaTest(unittest.TestCase):
+    def test_compound_server(self):
+        import src.server as server
+
+        self.assertEqual(_null_default_args_rejecting_null(server.mcp), [])
+
+    def test_granular_server(self):
+        from src.granular import mcp
+
+        self.assertEqual(_null_default_args_rejecting_null(mcp), [])
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 5: `0f6bbac9` (2026-10-05)
**Commit Message**: fix(granular): let optional tool arguments accept an explicit null

Sixteen optional granular arguments were annotated str/float/bool/int
with a None default, so the generated schema advertised "default": null
on a field whose type excluded null. A client that sends the advertised
default (some agent frameworks fill every optional field with null) got
an argument validation error before the tool ran. Annotate them Optional[T],
matching the existing style.

Adds an offline test that every argument defaulting to null accepts null,
for both the compound and granular servers.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/granular/project.py` (modified, +2/-2)
```diff
@@ -140,7 +140,7 @@ def open_project(name: str) -> str:
 
 
 @mcp.tool()
-def create_project(name: str, media_location_path: str = None) -> str:
+def create_project(name: str, media_location_path: Optional[str] = None) -> str:
     """Create a new project with the given name.
     
     Args:
@@ -728,7 +728,7 @@ def set_color_science_mode_tool(mode: str) -> str:
 
 @mcp.tool()
 @granular_destructive_op()
-def set_color_space_tool(color_space: str, gamma: str = None) -> str:
+def set_color_space_tool(color_space: str, gamma: Optional[str] = None) -> str:
     """Set timeline color space and gamma.
     
     Args:
```

**File**: `src/granular/resolve_control.py` (modified, +2/-2)
```diff
@@ -262,7 +262,7 @@ def export_layout_preset_tool(preset_name: str, export_path: str) -> Dict[str, A
 
 
 @mcp.tool()
-def import_layout_preset_tool(import_path: str, preset_name: str = None) -> Dict[str, Any]:
+def import_layout_preset_tool(import_path: str, preset_name: Optional[str] = None) -> Dict[str, Any]:
     """Import a layout preset from a file.
 
     Calls Resolve.ImportLayoutPreset() to import a preset from disk.
@@ -701,7 +701,7 @@ def delete_user_preferences_preset(preset_name: str) -> Dict[str, Any]:
 
 
 @mcp.tool()
-def import_user_preferences_preset(import_path: str, preset_name: str = None) -> Dict[str, Any]:
+def import_user_preferences_preset(import_path: str, preset_name: Optional[str] = None) -> Dict[str, Any]:
     """Import a user-preferences preset from a file (Resolve 21.0.4+).
 
     The imported preset is NOT auto-loaded; it takes its name from the file
```

**File**: `src/granular/timeline_item.py` (modified, +11/-11)
```diff
@@ -358,8 +358,8 @@ def set_timeline_item_crop(timeline_item_id: str,
 @mcp.tool()
 @granular_destructive_op()
 def set_timeline_item_composite(timeline_item_id: str, 
-                               composite_mode: str = None, 
-                               opacity: float = None) -> str:
+                               composite_mode: Optional[str] = None, 
+                               opacity: Optional[float] = None) -> str:
     """Set composite properties for a timeline item.
     
     Args:
@@ -446,8 +446,8 @@ def set_timeline_item_composite(timeline_item_id: str,
 @mcp.tool()
 @granular_destructive_op()
 def set_timeline_item_retime(timeline_item_id: str, 
-                            speed: float = None, 
-                            process: str = None) -> str:
+                            speed: Optional[float] = None, 
+                            process: Optional[str] = None) -> str:
     """Set retiming properties for a timeline item.
     
     Args:
@@ -525,9 +525,9 @@ def set_timeline_item_retime(timeline_item_id: str,
 @mcp.tool()
 @granular_destructive_op()
 def set_timeline_item_stabilization(timeline_item_id: str, 
-                                   enabled: bool = None, 
-                                   method: str = None,
-                                   strength: float = None) -> str:
+                                   enabled: Optional[bool] = None, 
+                                   method: Optional[str] = None,
+                                   strength: Optional[float] = None) -> str:
     """Set stabilization properties for a timeline item.
     
     Args:
@@ -617,9 +617,9 @@ def set_timeline_item_stabilization(timeline_item_id: str,
 @mcp.tool()
 @granular_destructive_op()
 def set_timeline_item_audio(timeline_item_id: str, 
-                           volume: float = None, 
-                           pan: float = None,
-                           eq_enabled: bool = None) -> str:
+                           volume: Optional[float] = None, 
+                           pan: Optional[float] = None,
+                           eq_enabled: Optional[bool] = None) -> str:
     """Set audio properties for a timeline item.
     
     Args:
@@ -947,7 +947,7 @@ def add_keyframe(timeline_item_id: str, property_name: str, frame: int, value: f
 
 
 @mcp.tool()
-def modify_keyframe(timeline_item_id: str, property_name: str, frame: int, new_value: float = None, new_frame: int = None) -> str:
+def modify_keyframe(timeline_item_id: str, property_name: str, frame: int, new_value: Optional[float] = None, new_frame: Optional[int] = None) -> str:
     """Modify an existing keyframe by changing its value or frame position.
     
     Args:
```

**File**: `tests/test_tool_schema_null_defaults.py` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+"""Every tool argument that defaults to ``None`` must accept ``null``.
+
+An argument annotated ``str = None`` (or ``float = None``, ``bool = None``)
+becomes a schema like ``{"type": "string", "default": null}``: it advertises a
+default its own type rejects. Some agent frameworks fill every optional argument
+with its advertised default, so they send ``null``, and the call fails argument
+validation before the tool runs. Sixteen granular arguments had this shape, for
+example ``create_project.media_location_path``.
+
+Runs fully offline: enumerating tools via ``mcp.list_tools()`` touches no live
+handle.
+"""
+import asyncio
+import unittest
+
+
+def _allows_null(schema):
+    if schema.get("type") == "null":
+        return True
+    if isinstance(schema.get("type"), list) and "null" in schema["type"]:
+        return True
+    return any(_allows_null(s) for s in schema.get("anyOf", []))
+
+
+def _null_default_args_rejecting_null(mcp):
+    bad = []
+    for tool in asyncio.run(mcp.list_tools()):
+        for name, prop in tool.inputSchema.get("properties", {}).items():
+            if "default" in prop and prop["default"] is None and not _allows_null(prop):
+                bad.append(f"{tool.name}.{name}")
+    return sorted(bad)
+
+
+class NullDefaultSchemaTest(unittest.TestCase):
+    def test_compound_server(self):
+        import src.server as server
+
+        self.assertEqual(_null_default_args_rejecting_null(server.mcp), [])
+
+    def test_granular_server(self):
+        from src.granular import mcp
+
+        self.assertEqual(_null_default_args_rejecting_null(mcp), [])
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 6: `5aee72d1` (2026-10-04)
**Commit Message**: chore(release): v4.8.28 — ffmpeg stdin hang and cancel-then-respond crash

Fixes #272. Two bugs behind one report.

ffmpeg inherited the server's stdin, which over stdio is the JSON-RPC
stream. ffmpeg polls stdin for keyboard commands; the "c" in "jsonrpc"
opens its command prompt, which blocks for a newline while eating
protocol bytes. Measured with ffmpeg 9.0.2: a partial frame mid-run hung
a silencedetect pass; stdin=DEVNULL finished normally. _run_command and
the 29 other src/ spawn sites without stdin= now pass DEVNULL, and
tests/test_subprocess_stdin_discipline.py keeps new ones out.

A client cancel while a tool body ran in its worker thread was never
raised: run_sync shields its wait, so the late result went out as a
second response and the SDK's "Request already responded to" assert
closed the session. The threaded dispatch wrapper now raises the
pending cancellation after the body returns; an end-to-end SDK test
covers it.

No Resolve scripting call changed. Suite 3997 OK (2 skipped).

**File**: `CHANGELOG.md` (modified, +45/-0)
```diff
@@ -2,6 +2,51 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.28 — ffmpeg can no longer hang on the protocol stream; a cancelled call no longer kills the server
+
+### Fixed
+
+- **ffmpeg could hang indefinitely while reading the server's stdin.** Every
+  ffmpeg/ffprobe analysis pass (`edit_engine plan_silence_ripple`, media
+  analysis, sync detection, sound density and the rest) ran through a
+  runner that let the child inherit the server's stdin. Over stdio that is
+  the JSON-RPC stream. ffmpeg polls stdin for keyboard commands; the `c` in
+  `"jsonrpc"` opens its interactive command prompt, which then waits for a
+  newline while consuming the protocol bytes it reads. Measured with ffmpeg
+  9.0.2: a partial frame arriving mid-pass hung a silencedetect run until it
+  was killed, and the same run with `stdin=subprocess.DEVNULL` finished
+  normally. The runner, and all 29 other call sites under `src/` that spawned
+  a child without `stdin=`, now pass `stdin=subprocess.DEVNULL`. Reported on
+  Windows with the free 21.0.2 bridge (#272); the mechanism was reproduced on
+  macOS, and the Windows build was not available to test.
+- **A tool call cancelled by the client could take the whole session down.**
+  Tool bodies run in a worker thread, and the wait for that thread is
+  shielded from cancellation. When the client cancelled (for example after
+  its own timeout) and the body finished later, its result came back as if
+  nothing had happened. The SDK then tried to answer a request it had already
+  answered "cancelled", and its `Request already responded to` assertion
+  closed the connection. The pending cancellation is now raised once the
+  body returns, which the SDK treats as the cancellation it already
+  acknowledged. The body still runs to completion, so Resolve is never left
+  half-mutated; only its result is discarded.
+
+### Tests
+
+- `tests/test_subprocess_stdin_discipline.py` (new) fails the suite on any
+  `subprocess.run/Popen/call/check_call/check_output` under `src/` that does
+  not pass `stdin=` or `input=`, in any import spelling. With the fix
+  reverted it names all 30 sites (the runner plus the 29 others).
+- `tests/test_threaded_tool_dispatch.py` gains an end-to-end case over the
+  real SDK's in-memory transport: it cancels a call mid-body, lets the body
+  finish, and requires the next call to succeed. With the fix reverted, it
+  fails with the reported `AssertionError`.
+
+### Validation
+
+- No Resolve scripting call changed. Both mechanisms were reproduced before
+  the fix and confirmed fixed after it, on macOS with ffmpeg 9.0.2 and
+  mcp 1.30.0. Not tested on Windows.
+
 ## What's New in v4.8.27 — Linux exports no longer redirected away from /tmp-named folders
 
 ### Fixed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.27-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.28-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.27-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.28-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.27 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.28 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.27"
+VERSION = "4.8.28"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.27",
+  "version": "4.8.28",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.27",
+      "version": "4.8.28",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.27",
+  "version": "4.8.28",
   "description": "NPM bootstrapper for the DaVinci Resolve MCP Server.",
   "license": "MIT",
   "author": "Samuel Gursky <samgursky@gmail.com>",
```

**File**: `src/analysis_dashboard.py` (modified, +3/-0)
```diff
@@ -14738,6 +14738,7 @@ def _launch_claude_code_terminal() -> Dict[str, Any]:
     try:
         check = subprocess.run(
             ["osascript", "-e", 'application "iTerm" is running'],
+            stdin=subprocess.DEVNULL,
             capture_output=True, text=True, encoding="utf-8", errors="replace",
             timeout=8,
         )
@@ -14762,6 +14763,7 @@ def _launch_claude_code_terminal() -> Dict[str, Any]:
     try:
         proc = subprocess.run(
             ["osascript", "-e", script],
+            stdin=subprocess.DEVNULL,
             capture_output=True, text=True, encoding="utf-8", errors="replace",
             timeout=15,
         )
@@ -14794,6 +14796,7 @@ def _native_directory_picker(initial: Optional[str] = None) -> Dict[str, Any]:
             import subprocess
             proc = subprocess.run(
                 ["osascript", "-e", script],
+                stdin=subprocess.DEVNULL,
                 capture_output=True, text=True, encoding="utf-8", errors="replace",
                 timeout=120,
             )
```

**File**: `src/granular/common.py` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@
         handlers=[logging.StreamHandler()],
     )
 
-VERSION = "4.8.27"
+VERSION = "4.8.28"
 logger = logging.getLogger("davinci-resolve-mcp")
 logger.info(f"Starting DaVinci Resolve MCP Server v{VERSION}")
 logger.info(f"Detected platform: {get_platform()}")
```

---

### Incident Patch 7: `53f8fc91` (2026-10-03)
**Commit Message**: chore(release): v4.8.27 — Linux temp-path check compares by segment

Lands #271 (@Dev-next-gen). On Linux, _resolve_safe_dir tested
path.startswith("/tmp"), so /tmpdata, /tmpfiles, /tmp-scratch and
/var/tmpdata were treated as temp directories and replaced with
~/Documents/resolve-stills; gallery_stills grab_and_export then reported
that folder as the one requested. Both copies of the helper now compare
by path segment, matching the macOS branch.

No Resolve behavior changed. Suite 3994 OK (2 skipped).

**File**: `CHANGELOG.md` (modified, +26/-0)
```diff
@@ -2,6 +2,32 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.27 — Linux exports no longer redirected away from /tmp-named folders
+
+### Fixed
+
+- **On Linux, an output folder whose name merely began with `/tmp` or
+  `/var/tmp` was silently replaced.** `_resolve_safe_dir` tested
+  `path.startswith("/tmp")`, which is also true of `/tmpdata`, `/tmpfiles`,
+  `/tmp-scratch` and `/var/tmpdata`. Each was treated as a temp directory and
+  swapped for `~/Documents/resolve-stills`, and
+  `gallery_stills(grab_and_export)` then reported that folder as if it were the
+  one asked for. The same helper picks the output folder for `encrypt_dctl` and
+  the granular `save_project` export fallback. The Linux branch now compares by
+  path segment, as the macOS branch already did; `/tmp`, `/tmp/…`, `/var/tmp`
+  and `/var/tmp/…` still redirect. Both copies of the helper (`src/server.py`
+  and `src/granular/common.py`) are fixed. Thanks to @Dev-next-gen (#271).
+
+### Tests
+
+- `tests/test_granular_safe_dir.py` gains a Linux class covering both copies:
+  real temp paths still redirect, sibling names are left alone.
+
+### Validation
+
+- Path classification only, decided before any Resolve call; no Resolve
+  behavior changed. Live test not required.
+
 ## What's New in v4.8.26 — two dead layout-preset helpers removed
 
 ### Removed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.26-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.27-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.26-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.27-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.26 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.27 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.26"
+VERSION = "4.8.27"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.26",
+  "version": "4.8.27",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.26",
+      "version": "4.8.27",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.26",
+  "version": "4.8.27",
   "description": "NPM bootstrapper for the DaVinci Resolve MCP Server.",
   "license": "MIT",
   "author": "Samuel Gursky <samgursky@gmail.com>",
```

**File**: `src/granular/common.py` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@
         handlers=[logging.StreamHandler()],
     )
 
-VERSION = "4.8.26"
+VERSION = "4.8.27"
 logger = logging.getLogger("davinci-resolve-mcp")
 logger.info(f"Starting DaVinci Resolve MCP Server v{VERSION}")
 logger.info(f"Detected platform: {get_platform()}")
```

**File**: `src/server.py` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     python src/server.py --full       # Start the 377-tool granular server instead
 """
 
-VERSION = "4.8.26"
+VERSION = "4.8.27"
 
 import base64
 import os
```

---

### Incident Patch 8: `c2700459` (2026-10-03)
**Commit Message**: Merge pull request #271 from Dev-next-gen/fix/linux-tmp-prefix-segment

fix(safe_dir): decide a Linux temp path by segment, not by character prefix

**File**: `src/granular/common.py` (modified, +4/-1)
```diff
@@ -377,7 +377,10 @@ def _resolve_safe_dir(path):
         # silently into both, same as /var/folders (matches src/server.py).
         _is_sandbox = path.startswith(("/var/", "/private/var/", "/tmp/", "/private/tmp/")) or path in ("/tmp", "/private/tmp")
     elif platform.system() == "Linux":
-        _is_sandbox = path.startswith("/tmp") or path.startswith("/var/tmp")
+        # By segment, not by character prefix (matches src/server.py): a sibling
+        # of /tmp whose name merely begins with it — /tmpfiles, /tmp-scratch,
+        # /var/tmpdata — cleared `startswith("/tmp")` and was redirected.
+        _is_sandbox = path.startswith(("/tmp/", "/var/tmp/")) or path in ("/tmp", "/var/tmp")
     elif platform.system() == "Windows":
         try:
             _is_sandbox = os.path.commonpath([os.path.abspath(path), os.path.abspath(system_temp)]) == os.path.abspath(system_temp)
```

**File**: `src/server.py` (modified, +7/-1)
```diff
@@ -1421,7 +1421,13 @@ def _resolve_safe_dir(path):
         # silently fails into both (live-verified 2026-07-03), same as /var/folders.
         _is_sandbox = path.startswith(("/var/", "/private/var/", "/tmp/", "/private/tmp/")) or path in ("/tmp", "/private/tmp")
     elif platform.system() == "Linux":
-        _is_sandbox = path.startswith("/tmp") or path.startswith("/var/tmp")
+        # By segment, not by character prefix: `startswith("/tmp")` also matched a
+        # sibling of /tmp whose name merely begins with it — /tmpfiles,
+        # /tmp-scratch, /var/tmpdata — so an export the caller aimed at one of
+        # those was redirected away from it. The Darwin branch already compares
+        # this way, and `/tmpfiles/out` is one of the paths
+        # tests/test_granular_safe_dir.py asserts is left alone.
+        _is_sandbox = path.startswith(("/tmp/", "/var/tmp/")) or path in ("/tmp", "/var/tmp")
     elif platform.system() == "Windows":
         # Check if path is under the system temp directory (e.g. AppData\Local\Temp)
         try:
```

**File**: `tests/test_granular_safe_dir.py` (modified, +33/-0)
```diff
@@ -39,5 +39,38 @@ def test_other_paths_are_left_alone(self):
                 self.assertEqual(granular, path)
 
 
+class SafeDirLinuxTest(unittest.TestCase):
+    """On Linux the redirect compared by character prefix, not by segment.
+
+    `startswith("/tmp")` is true of /tmpfiles, /tmp-scratch and /tmpdata, and
+    `startswith("/var/tmp")` of /var/tmpdata — ordinary directories a Linux
+    workstation can carry at the root, none of them a temp directory Resolve
+    fails into. An export aimed at one of them was silently rewritten to
+    ~/Documents/resolve-stills: gallery_stills(grab_and_export) passes the
+    caller's folder_path straight through this helper and then creates and
+    exports into whatever comes back. The Darwin branch has always compared by
+    segment, and the macOS test above already requires /tmpfiles/out to survive.
+    """
+
+    def _both(self, path):
+        with patch("platform.system", return_value="Linux"):
+            return server._resolve_safe_dir(path), common._resolve_safe_dir(path)
+
+    def test_real_temp_paths_still_redirect(self):
+        for path in ("/tmp", "/tmp/out", "/var/tmp", "/var/tmp/out"):
+            with self.subTest(path=path):
+                compound, granular = self._both(path)
+                self.assertEqual(compound, REDIRECT)
+                self.assertEqual(granular, compound)
+
+    def test_siblings_named_like_tmp_are_left_alone(self):
+        for path in ("/tmpfiles/out", "/tmp-scratch/stills", "/tmpdata",
+                     "/var/tmpdata/out", "/home/me/stills"):
+            with self.subTest(path=path):
+                compound, granular = self._both(path)
+                self.assertEqual(granular, compound)
+                self.assertEqual(granular, path)
+
+
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 9: `0334e3ec` (2026-10-03)
**Commit Message**: fix(safe_dir): decide a Linux temp path by segment, not by character prefix

On Linux `_resolve_safe_dir` tested `path.startswith("/tmp")` and
`path.startswith("/var/tmp")`, so any root-level directory whose name merely
begins with those characters -- /tmpdata, /tmpfiles, /tmp-scratch, /var/tmpdata
-- was treated as a sandbox temp directory and the caller's folder was replaced
by ~/Documents/resolve-stills.

gallery_stills(grab_and_export) passes `folder_path` straight into this helper
with nothing in between, then creates and exports into whatever comes back, so
the export silently landed somewhere the caller never named and the response
reported that other folder. encrypt_dctl and the granular save_project export
fallback resolve their output folder the same way.

The Darwin branch in the same function already compares by segment
("/tmp/", "/private/tmp/" plus an exact match on "/tmp"), and
tests/test_granular_safe_dir.py already asserts that /tmpfiles/out is left
alone -- under Darwin only, which is why the Linux branch went unnoticed. Both
copies of the helper (src/server.py and src/granular/common.py) carried the
same line; both are corrected the same way. /tmp, /tmp/..., /var

**File**: `src/granular/common.py` (modified, +4/-1)
```diff
@@ -377,7 +377,10 @@ def _resolve_safe_dir(path):
         # silently into both, same as /var/folders (matches src/server.py).
         _is_sandbox = path.startswith(("/var/", "/private/var/", "/tmp/", "/private/tmp/")) or path in ("/tmp", "/private/tmp")
     elif platform.system() == "Linux":
-        _is_sandbox = path.startswith("/tmp") or path.startswith("/var/tmp")
+        # By segment, not by character prefix (matches src/server.py): a sibling
+        # of /tmp whose name merely begins with it — /tmpfiles, /tmp-scratch,
+        # /var/tmpdata — cleared `startswith("/tmp")` and was redirected.
+        _is_sandbox = path.startswith(("/tmp/", "/var/tmp/")) or path in ("/tmp", "/var/tmp")
     elif platform.system() == "Windows":
         try:
             _is_sandbox = os.path.commonpath([os.path.abspath(path), os.path.abspath(system_temp)]) == os.path.abspath(system_temp)
```

**File**: `src/server.py` (modified, +7/-1)
```diff
@@ -1421,7 +1421,13 @@ def _resolve_safe_dir(path):
         # silently fails into both (live-verified 2026-07-03), same as /var/folders.
         _is_sandbox = path.startswith(("/var/", "/private/var/", "/tmp/", "/private/tmp/")) or path in ("/tmp", "/private/tmp")
     elif platform.system() == "Linux":
-        _is_sandbox = path.startswith("/tmp") or path.startswith("/var/tmp")
+        # By segment, not by character prefix: `startswith("/tmp")` also matched a
+        # sibling of /tmp whose name merely begins with it — /tmpfiles,
+        # /tmp-scratch, /var/tmpdata — so an export the caller aimed at one of
+        # those was redirected away from it. The Darwin branch already compares
+        # this way, and `/tmpfiles/out` is one of the paths
+        # tests/test_granular_safe_dir.py asserts is left alone.
+        _is_sandbox = path.startswith(("/tmp/", "/var/tmp/")) or path in ("/tmp", "/var/tmp")
     elif platform.system() == "Windows":
         # Check if path is under the system temp directory (e.g. AppData\Local\Temp)
         try:
```

**File**: `tests/test_granular_safe_dir.py` (modified, +33/-0)
```diff
@@ -39,5 +39,38 @@ def test_other_paths_are_left_alone(self):
                 self.assertEqual(granular, path)
 
 
+class SafeDirLinuxTest(unittest.TestCase):
+    """On Linux the redirect compared by character prefix, not by segment.
+
+    `startswith("/tmp")` is true of /tmpfiles, /tmp-scratch and /tmpdata, and
+    `startswith("/var/tmp")` of /var/tmpdata — ordinary directories a Linux
+    workstation can carry at the root, none of them a temp directory Resolve
+    fails into. An export aimed at one of them was silently rewritten to
+    ~/Documents/resolve-stills: gallery_stills(grab_and_export) passes the
+    caller's folder_path straight through this helper and then creates and
+    exports into whatever comes back. The Darwin branch has always compared by
+    segment, and the macOS test above already requires /tmpfiles/out to survive.
+    """
+
+    def _both(self, path):
+        with patch("platform.system", return_value="Linux"):
+            return server._resolve_safe_dir(path), common._resolve_safe_dir(path)
+
+    def test_real_temp_paths_still_redirect(self):
+        for path in ("/tmp", "/tmp/out", "/var/tmp", "/var/tmp/out"):
+            with self.subTest(path=path):
+                compound, granular = self._both(path)
+                self.assertEqual(compound, REDIRECT)
+                self.assertEqual(granular, compound)
+
+    def test_siblings_named_like_tmp_are_left_alone(self):
+        for path in ("/tmpfiles/out", "/tmp-scratch/stills", "/tmpdata",
+                     "/var/tmpdata/out", "/home/me/stills"):
+            with self.subTest(path=path):
+                compound, granular = self._both(path)
+                self.assertEqual(granular, compound)
+                self.assertEqual(granular, path)
+
+
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 10: `f85f1bda` (2026-09-30)
**Commit Message**: chore(layout_presets): remove two dead GetUIManager helpers; v4.8.26

save_layout_preset and load_layout_preset in src/utils/layout_presets.py
went through Resolve.GetUIManager().SaveUILayout / LoadUILayout. None of
the three exist on any build measured (Studio 19.1.3.7; api_truth entry
from v4.8.25), and nothing called them: the granular save/load tools use
Resolve.SaveLayoutPreset / LoadLayoutPreset directly and still do. No
tool, action or count changes.

The module docstring now says what the file does (preset files on disk)
and where live save/load happens. audit_api_parity drops LoadUILayout
and SaveUILayout from its allowlist.

No Resolve behavior changed. Suite 3992 OK (2 skipped); Node 988 pass,
0 fail in a clean install.

**File**: `CHANGELOG.md` (modified, +20/-0)
```diff
@@ -2,6 +2,26 @@
 
 Release history for the DaVinci Resolve MCP Server. The latest release is summarized in the root README; older entries live here to keep the README focused.
 
+## What's New in v4.8.26 — two dead layout-preset helpers removed
+
+### Removed
+
+- `src/utils/layout_presets.py` no longer carries `save_layout_preset` and
+  `load_layout_preset`. Both went through `Resolve.GetUIManager()` and then
+  `SaveUILayout` / `LoadUILayout`, none of which exist on any build measured
+  (Studio 19.1.3.7; see the `api_truth` entry added in v4.8.25). Nothing called
+  them: the granular `save_layout_preset_tool` and `load_layout_preset_tool`
+  use `Resolve.SaveLayoutPreset` / `LoadLayoutPreset` directly, and still do.
+  No tool, action or count changes. The module docstring now says what the
+  file actually does (preset files on disk) and where live save/load happens.
+- `scripts/audit_api_parity.py` drops `LoadUILayout` and `SaveUILayout` from
+  its allowlist, since no source calls them any more.
+
+### Validation
+
+- No Resolve behavior changed; the removed functions had no callers. Live test
+  not required.
+
 ## What's New in v4.8.25 — open_settings and open_app_preferences say what Resolve cannot do
 
 ### Fixed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 English | [简体中文](README.zh-CN.md)
 
-[![Version](https://img.shields.io/badge/version-4.8.25-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.26-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#server-modes)
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 [English](README.md) | 简体中文
 
-[![Version](https://img.shields.io/badge/version-4.8.25-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
+[![Version](https://img.shields.io/badge/version-4.8.26-blue.svg)](https://github.com/samuelgursky/davinci-resolve-mcp/releases)
 [![npm](https://img.shields.io/npm/v/davinci-resolve-mcp.svg?label=npm&color=CB3837)](https://www.npmjs.com/package/davinci-resolve-mcp)
 [![API Coverage](https://img.shields.io/badge/API%20Coverage-100%25-brightgreen.svg)](docs/reference/api-coverage.md)
 [![Tools](https://img.shields.io/badge/MCP%20Tools-37%20(389%20full)-blue.svg)](#服务器模式)
@@ -12,7 +12,7 @@
 [![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/downloads/)
 [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
 
-> 本翻译对应 v4.8.25 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
+> 本翻译对应 v4.8.26 版 README。如与英文原版有出入，以 [英文原版](README.md) 为准。
 
 一个 Model Context Protocol (MCP) 服务器，让 AI 助手通过官方脚本 API 控制 DaVinci Resolve Studio（达芬奇）。它提供完整的 API 覆盖，外加带护栏的工作流助手，涵盖剪辑、媒体池整理、渲染设置、审阅标记、调色、Fusion、Fairlight、项目生命周期任务、扩展开发，以及不碰源媒体的媒体分析。
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.25"
+VERSION = "4.8.26"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.25",
+  "version": "4.8.26",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.25",
+      "version": "4.8.26",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.25",
+  "version": "4.8.26",
   "description": "NPM bootstrapper for the DaVinci Resolve MCP Server.",
   "license": "MIT",
   "author": "Samuel Gursky <samgursky@gmail.com>",
```

**File**: `scripts/audit_api_parity.py` (modified, +3/-4)
```diff
@@ -148,10 +148,9 @@ def find_methods_missing_from_source(
     # Resolve app-control method, not in the scripting README this audit parses
     "SetHighPriority",
     # NOT a documented API: Resolve has no GetUIManager on any build measured
-    # (Studio 19.1.3.7; api_truth 'Resolve.GetUIManager ...'). It is called
-    # only behind has_method in src/utils/app_control.py, and from the unused
-    # helpers in src/utils/layout_presets.py along with the other two.
-    "GetUIManager", "LoadUILayout", "SaveUILayout",
+    # (Studio 19.1.3.7; api_truth 'Resolve.GetUIManager ...'). Called only
+    # behind has_method in src/utils/app_control.py.
+    "GetUIManager",
     # Lua-table iteration helper used as a fallback in object_inspection.py
     "GetKeyList",
     # Project metadata accessor used defensively (hasattr-guarded)
```

**File**: `src/granular/common.py` (modified, +1/-3)
```diff
@@ -45,8 +45,6 @@
     export_layout_preset,
     import_layout_preset,
     list_layout_presets,
-    load_layout_preset,
-    save_layout_preset,
 )
 from src.utils.object_inspection import inspect_object, print_object_help
 from src.utils.platform import get_platform, get_resolve_paths
@@ -93,7 +91,7 @@
         handlers=[logging.StreamHandler()],
     )
 
-VERSION = "4.8.25"
+VERSION = "4.8.26"
 logger = logging.getLogger("davinci-resolve-mcp")
 logger.info(f"Starting DaVinci Resolve MCP Server v{VERSION}")
 logger.info(f"Detected platform: {get_platform()}")
```

---

### Incident Patch 11: `a39dcebf` (2026-09-30)
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

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.24",
+  "version": "4.8.25",
   "description": "NPM bootstrapper for the DaVinci Resolve MCP Server.",
   "license": "MIT",
   "author": "Samuel Gursky <samgursky@gmail.com>",
```

**File**: `scripts/audit_api_parity.py` (modified, +7/-4)
```diff
@@ -145,10 +145,13 @@ def find_methods_missing_from_source(
     "AddKeyframe", "DeleteKeyframe", "ModifyKeyframe", "RemoveKeyFrame",
     "GetKeyframeAtIndex", "GetKeyframeCount", "GetPropertyAtKeyframeIndex",
     "SetKeyframeInterpolation", "Render", "StartUndo",
-    # UIManager / Resolve app-control API (documented under UIManager, not
-    # the main Resolve scripting README)
-    "GetUIManager", "OpenPreferences", "SetHighPriority",
-    "OpenProjectSettings", "LoadUILayout", "SaveUILayout",
+    # Resolve app-control method, not in the scripting README this audit parses
+    "SetHighPriority",
+    # NOT a documented API: Resolve has no GetUIManager on any build measured
+    # (Studio 19.1.3.7; api_truth 'Resolve.GetUIManager ...'). It is called
+    # only behind has_method in src/utils/app_control.py, and from the unused
+    # helpers in src/utils/layout_presets.py along with the other two.
+    "GetUIManager", "LoadUILayout", "SaveUILayout",
     # Lua-table iteration helper used as a fallback in object_inspection.py
     "GetKeyList",
     # Project metadata accessor used defensively (hasattr-guarded)
```

**File**: `src/granular/common.py` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@
         handlers=[logging.StreamHandler()],
     )
 
-VERSION = "4.8.24"
+VERSION = "4.8.25"
 logger = logging.getLogger("davinci-resolve-mcp")
 logger.info(f"Starting DaVinci Resolve MCP Server v{VERSION}")
 logger.info(f"Detected platform: {get_platform()}")
```

---

### Incident Patch 12: `08ad6327` (2026-09-30)
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
+- **Workaround / current handling:** Never send an empty CustomName, and never bundle a best-effort key with keys that matter: send each setting in its own payload and check its return. Better, do not write CustomName at all when the name is not yours to keep. To see what a job will inherit, AddRenderJob, read MarkIn/MarkOut/TargetDir/OutputFilename off GetRenderJobList, then DeleteRenderJob.
 - **Reference:** [issue #270](https://github.com/samuelgursky/davinci-resolve-mcp/issues/270)
 - **Tags:** render, deliver, silent-failure, unreliable-return
 
```

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.23"
+VERSION = "4.8.24"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.23",
+  "version": "4.8.24",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.23",
+      "version": "4.8.24",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.23",
+  "version": "4.8.24",
   "description": "NPM bootstrapper for the DaVinci Resolve MCP Server.",
   "license": "MIT",
   "author": "Samuel Gursky <samgursky@gmail.com>",
```

---

### Incident Patch 13: `00f489d1` (2026-09-30)
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
+- `tests/live_frame_capture_page_restore_validation.py`: the live harness behind
+  the numbers above.
+
 ## What's New in v4.8.22 — the control panel port check cannot hang on a wedged lsof
 
 ### Fixed
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

**File**: `install.py` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 # ─── Version ──────────────────────────────────────────────────────────────────
 
-VERSION = "4.8.22"
+VERSION = "4.8.23"
 # Only hard floor: mcp[cli] requires Python 3.10+. There is no upper bound —
 # Resolve's scripting bridge loads into newer interpreters on recent builds
 # (Python 3.14 verified against Resolve Studio 20.3.2). Older Resolve builds
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.22",
+  "version": "4.8.23",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "davinci-resolve-mcp",
-      "version": "4.8.22",
+      "version": "4.8.23",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.22",
+  "version": "4.8.23",
   "description": "NPM bootstrapper for the DaVinci Resolve MCP Server.",
   "license": "MIT",
   "author": "Samuel Gursky <samgursky@gmail.com>",
```

---

### Incident Patch 14: `89da04b1` (2026-09-26)
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

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "davinci-resolve-mcp",
-  "version": "4.8.21",
+  "version": "4.8.22",
   "description": "NPM bootstrapper for the DaVinci Resolve MCP Server.",
   "license": "MIT",
   "author": "Samuel Gursky <samgursky@gmail.com>",
```

**File**: `src/granular/common.py` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@
         handlers=[logging.StreamHandler()],
     )
 
-VERSION = "4.8.21"
+VERSION = "4.8.22"
 logger = logging.getLogger("davinci-resolve-mcp")
 logger.info(f"Starting DaVinci Resolve MCP Server v{VERSION}")
 logger.info(f"Detected platform: {get_platform()}")
```

**File**: `src/server.py` (modified, +41/-8)
```diff
@@ -11,7 +11,7 @@
     python src/server.py --full       # Start the 377-tool granular server instead
 """
 
-VERSION = "4.8.21"
+VERSION = "4.8.22"
 
 import base64
 import os
@@ -17750,24 +17750,57 @@ def _control_panel_remote_version(host: str, port: int, timeout: float = 1.5) ->
     return _control_panel_probe(host, port, timeout).get("version")
 
 
-def _port_owner_pid(host: str, port: int) -> Optional[int]:
+def _port_owner_pid(host: str, port: int, timeout: float = 3.0) -> Optional[int]:
     """Return PID of the process LISTENing on `port`, or None if free/unknown.
 
     Uses lsof with `-iTCP:<port> -sTCP:LISTEN -t`: one PID per line, no header.
     Host is informational only — lsof matches any local LISTEN socket on that
     port (which is what we care about for port-collision detection).
+
+    The deadline is enforced by polling, not by ``subprocess.run(timeout=)``.
+    On macOS, lsof can wedge in uninterruptible kernel wait (state ``U`` in
+    ``ps``) when a network mount is stale, and a child in that state ignores
+    SIGKILL. ``subprocess.run``'s timeout path kills the child and then WAITS
+    for it, so the caller hung with it — measured 2026-09-26 on the release
+    machine: 489 lsof processes stuck in ``U`` for 12 h, and the offline suite
+    blocked here for 13 min. Now the child is killed on expiry and abandoned
+    rather than joined; stdout is read only once ``poll()`` says it exited.
     """
     import subprocess
+    import time as _t
     try:
-        result = subprocess.run(
+        proc = subprocess.Popen(
             ["lsof", "-nP", "-iTCP:" + str(port), "-sTCP:LISTEN", "-t"],
-            capture_output=True, timeout=3, text=True, encoding="utf-8",
-            errors="replace", check=False,
-            stdin=subprocess.DEVNULL,
+            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
+            stdin=subprocess.DEVNULL, start_new_session=True,
         )
-    except (OSError, subprocess.TimeoutExpired):
+    except OSError:
         return None
-    for line in (result.stdout or "").splitlines():
+    deadline = _t.monotonic() + max(0.0, float(timeout))
+    out = b""
+    try:
+        while proc.poll() is None:
+            if _t.monotonic() >= deadline:
+                try:
+                    proc.kill()
+                except OSError:
+                    pass
+                # Deliberately no wait()/communicate(): a wedged lsof never
+                # exits, and joining it is exactly the hang this guards against.
+                return None
+            _t.sleep(0.05)
+        if proc.stdout is not None:
+            try:
+                out = proc.stdout.read() or b""
+            except OSError:
+                out = b""
+    finally:
+        if proc.stdout is not None:
+            try:
+                proc.stdout.close()
+            except OSError:
+                pass
+    for line in out.decode("utf-8", "replace").splitlines():
         line = line.strip()
         if line.isdigit():
             return int(line)
```

---

### Incident Patch 15: `373fb503` (2026-09-26)
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

#### Recent Merged Pull Requests:
- **PR #276** (2026-10-06): fix(conform_lint): report every reuse of one source, not just the first (@Dev-next-gen)
- **PR #275** (2026-10-06): Add bounded Media Pool subclip import (@dmourati)
- **PR #274** (2026-10-05): fix(granular): let optional tool arguments accept an explicit null (@vishalhabib99)
- **PR #271** (2026-10-03): fix(safe_dir): decide a Linux temp path by segment, not by character prefix (@Dev-next-gen)
- **PR #269** (2026-09-26): fix(duration): remove off-by-one in granular and project_properties (@Dev-next-gen)
- **PR #268** (2026-09-23): fix(copy_clip_annotations): coerce include_markers/flags/clip_color through _coerce_bool (@Dev-next-gen)
- **PR #267** (2026-09-23): fix(drx-codec): bind generated OFX params via keyed instance id; encode int params (@noah1234j)
- **PR #266** (2026-09-22): fix(media_pool): read create_missing="false" as false in organize_clips (@Dev-next-gen)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

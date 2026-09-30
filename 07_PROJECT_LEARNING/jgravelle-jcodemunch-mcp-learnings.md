# Forensic Learning Record (Deep Inspection): jgravelle/jcodemunch-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/jgravelle-jcodemunch-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jgravelle/jcodemunch-mcp](https://github.com/jgravelle/jcodemunch-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:43:40.132Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jgravelle/jcodemunch-mcp`
- **Description**: Cut AI token costs 95%+ on code exploration. The leading MCP server for precise, symbol-level GitHub code retrieval via tree-sitter AST. Works with Claude Code, Cursor & any MCP client. 313B+ tokens saved.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2719 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/_common.py`
```
"""Shared plumbing for the workflow hooks (docs/workflows/DESIGN.md section 4).

purpose:  read the hook JSON, locate the repo, run a command under a budget,
          and report in the three shapes the design allows: block (exit 2 with
          the reason on stderr), warn (exit 0 with additionalContext), pass.
invokes:  nothing on its own
produces: nothing on its own
refuses:  nothing on its own

A hook past its budget WARNS and names what it skipped (D7); it never
silently passes and never blocks on its own slowness.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# Windows consoles default to cp1252; an ARCHAEOLOGY row or a harness verdict
# carries characters outside it, and a hook that dies encoding its own reason
# blocks with a traceback instead of the reason (Standing lesson: encoding=).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass  # a stream with no reconfigure (a pipe replaced by the runner) keeps its encoding

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
STATE = REPO / ".claude" / "state"
EVIDENCE = STATE / "evidence"
# W-43: ONE table of paths, with the questions each answers, from which the
# three hook lists are projected. The lists grew apart with three memberships
# (a hooks-only commit skipped the fast tier while the checklist called the
# same edit a code change, and a hook edit left the D5 stamp valid).
#   stamp    - the full tier's verdict depends on it (D5 tree identity)
#   fast     - a commit touching it runs the fast tier first (H1)
#   redgreen - a change under it needs a red/green pair (checklist row 1)
#   bench    - a change under it needs the bench tier (checklist row 10)
# `.claude/hooks/` moves the stamp and needs a pair, and does NOT trigger the
# fast tier: harness/tiers.json's fast list carries no hook test, so that run
# would judge nothing about the change; the full tier runs them.
QUESTIONS = frozenset({"stamp", "fast", "redgreen", "bench"})
PATH_TABLE: dict[str, frozenset[str]] = {
    "src/": frozenset({"stamp", "fast", "redgreen"}),
    "tests/": frozenset({"stamp", "fast", "redgreen"}),
    "harness/": frozenset({"stamp", "fast", "redgreen", "bench"}),
    "scripts/": frozenset({"stamp", "fast", "redgreen"}),
    "benchmarks/": frozenset({"stamp", "redgreen", "bench"}),
    "benchmarks/harness/": frozenset({"fast"}),
    ".github/": frozenset({"stamp", "fast"}),
    "pyproject.toml": frozenset({"stamp"}),
    "uv.lock": frozenset({"stamp"}),
    ".claude/hooks/": frozenset({"stamp", "redgreen"}),
    # The dispatcher's latency Floors read it; under src/, so stamp/fast/redgreen
    # already hold through the "src/" row, and this row adds the bench question.
    "src/jcodemunch_mcp/server.py": frozenset({"bench"}),
}


def paths_for(question: str) -> tuple[str, ...]:
    """The paths that answer one question, in table order."""
    if question not in QUESTIONS:
        raise ValueError(f"unknown question {question!r}; one of {sorted(QUESTIONS)}")
    return tuple(p for p, qs in PATH_TABLE.items() if question in qs)


# What the full tier's verdict depends on (tree identity for the D5 stamp).
TIER_PATHS = paths_for("stamp")


def _rebind_repo(cwd: str | None) -> None:
    """Point REPO/STATE/EVIDENCE at the checkout the SESSION is in.

    Claude Code runs a project hook with `$CLAUDE_PROJECT_DIR` fixed, so a
    session working in a `git worktree` of this repo got the explicit
    scripts (run_full.py, dod_checklist.py resolve from their own file)
    and NONE of the automatic ones: the /fix-issue probe's reintroducing
    commit passed pre_commit silently (FINDINGS W-30). The payload's `cwd`
    names the real tree; if it is a checkout of this repo, use it.
    """
    global REPO, STATE, EVIDENCE
    if not cwd:
        return
    try:
        top = subprocess.run(
            ["git", "-C", cwd, "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=10,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return
    if not top:
        return
    top_path = Path(top).resolve()
    if top_path == REPO or not (top_path / ".claude" / "hooks").exists():
        return
    REPO = top_path
    STATE = REPO / ".claude" / "state"
    EVIDENCE = STATE / "evidence"
    # The hooks import these names at module level; rebind their copies too.
    main = sys.modules.get("__main__")
    for name, value in (("REPO", REPO), ("STATE", STATE), ("EVIDENCE", EVIDENCE)):
        if main is not None and hasattr(main, name):
            setattr(main, name, value)


def read_hook_input() -> dict:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except (json.JSONDecodeError, OSError):
        return {}
    _rebind_repo(payload.get("cwd"))
    return payload


def tool_command(payload: dict) -> str:
    ti = payload.get("tool_input") or {}
    return str(ti.get("command") or "")


_HEREDOC_RE = re.compile(r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?\n\s*\1\s*$", re.S | re.M)


def strip_heredocs(cmd: str) -> str:
    """Drop heredoc BODIES so prose that mentions a verb is not the verb.

    A FINDINGS entry piped through `python - <<'EOF'` carried the words
    `git commit` and tripped H1 (W-19). Quoted strings are kept: a commit
    message naming `git commit` sits beside a real one anyway, and the
    deny guard deliberately does not strip anything.
    """
    return _HEREDOC_RE.sub("<<HEREDOC>>", cmd)


def split_segments(cmd: str) -> list[str]:
    """Split a shell line on `&&`, `||` and `;` OUTSIDE quotes.

    A commit message with a semicolon in it is one segment, not three
    (the third H1 probe of the day refused its own commit over one).
    """
    out: list[str] = []
    buf: list[str] = []
    quote: str | None = None
    i = 0
    while i < len(cmd):
        c = cmd[i]
        if quote:
            buf.append(c)
            if c == quote:
                quote = None
            elif c == "\\" and i + 1 < len(cmd):
                buf.append(cmd[i + 1])
                i += 1
        elif c in ("'", '"'):
            quote = c
            buf.append(c)
        elif cmd.startswith(("&&", "||"), i):
            out.append("".join(buf))
            buf = []
            i += 1
        elif c == ";":
            out.append("".join(buf))
            buf = []
        else:
            buf.append(c)
        i += 1
    out.append("".join(buf))
    return [s.strip() for s in out if s.strip()]


def tool_path(payload: dict) -> Path | None:
    ti = payload.get("tool_input") or {}
    p = ti.get("file_path") or ti.get("path")
    return Path(p).resolve() if p else None


def under(path: Path | None, *parts: str) -> bool:
    if path is None:
        return False
    try:
        rel = path.relative_to(REPO)
    except ValueError:
        return False
    return rel.parts[: len(parts)] == parts


def git(*args: str, timeout: int = 20) -> str:
    r = subprocess.run(
        ["git", *args],
        cwd=REPO,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    return r.stdout


def git_env(env: dict, *args: str, timeout: int = 60) -> str:
    """`git` under an explicit environment (tree_id's throwaway GIT_INDEX_FILE)."""
    r = subprocess.run(
        ["git", *args],
        cwd=REPO,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    if r.returncode != 0:
        raise subprocess.CalledProcessError(r.returncode, ["git", *args], r.stdout, r.stderr)
    return r.stdout


UNREADABLE_PREFIX = "unreadable-"


def tree_id() -
```

### Core Architecture Module: `.claude/hooks/deny_guard.py`
```
"""H5: belt to the settings deny list (DESIGN section 4, D8).

purpose:  nothing in a session does the IRREVERSIBLE: publish, tag, dispatch a
          release, merge, force-push; the refusal names the RUNBOOK section
          the human runs instead. Posting (a PR, a comment, a review, an
          edit, an alert dismissal) is the session's: every one of those can
          be undone from the page (W-40, jjg 2026-09-07)
invokes:  nothing
produces: nothing
refuses:  the verbs below, on Bash and PowerShell
budget:   1 s
"""

from __future__ import annotations

import re

from _common import block, ok, read_hook_input, tool_command

DENIED = [
    (
        r"\bgit\s+push\b[^|;&]*(?:--force|(?-i:\s-f\b)|--force-with-lease)",
        "a force-push; RUNBOOK section 6 is the emergency path",
    ),
    (
        # W-44: the creating forms, as `settings.json` lists them (a `v`-prefixed
        # name, or a create/sign/force/delete flag), not any two words after the
        # verb: prose such as "the git tag rule" is not a tag. The read forms
        # (`--list`, `--sort`, `--contains`, ...) fall outside by construction.
        # A combined short flag (`-am msg`) is the same act (review round 1).
        # Residual, recorded in W-44: a lightweight non-`v` name (`git tag foo`)
        # is refused by neither list, and neither is its push by bare name.
        r"\bgit\s+tag\s+(?:-[asfdm]\w*|--force\b|--delete\b|--annotate\b|--sign\b|--message\b|v\d)",
        "a tag; release.yml tags (RUNBOOK section 1)",
    ),
    (
        r"\bgit\s+push\b[^|;&]*\s(?:--tags\b|v\d|refs/tags/)",
        "pushing a tag; release.yml tags (RUNBOOK section 1)",
    ),
    (
        # W-44: the ACT, never the word. `view`, `list` and `download` are reads
        # (the hand-finish downloads the CI artifact); flags may sit between
        # `release` and its verb (`gh release -R x/y create`).
        r"\bgh\s+release\b(?:\s+-\S+(?:\s+\S+)?)*\s+(?:create|edit|delete|delete-asset|upload)\b",
        "a GitHub release; release.yml creates it (RUNBOOK section 1)",
    ),
    (
        r"\bgh\s+workflow\s+run\b",
        "a workflow dispatch; the human dispatches (RUNBOOK section 1, step 3)",
    ),
    (
        r"\bgh\s+pr\s+merge\b",
        "a merge; the human merges when the gate is green (RUNBOOK section 1, step 2)",
    ),
    (
        r"\bgh\s+issue\s+delete\b",
        "deleting an issue, which no page undoes; the human does it",
    ),
    (
        # An API write is the session's (W-40) unless its path is one of the
        # irreversible acts the verbs above already refuse: a merge, a release,
        # a workflow dispatch, a tag ref, a deletion.
        r"\bgh\s+api\b(?=.*(?:--method\s+(?:POST|PATCH|PUT|DELETE)|\s-X\s*(?:POST|PATCH|PUT|DELETE)))"
        r".*(?:/pulls/\d+/merge\b|/releases\b|/dispatches\b|/git/tags\b|refs/tags/|--method\s+DELETE|\s-X\s*DELETE)",
        "an irreversible write through the API (merge, release, dispatch, tag or delete); the human runs it",
    ),
    (
        # W-41: the rule above is gated on --method/-X, and a GraphQL mutation
        # carries neither. The same acts by the mutation names GraphQL has (a
        # release and a dispatch are REST-only): a merge or auto-merge, a ref
        # deletion, an issue, discussion or project deletion, and a ref
        # CREATED under refs/tags/ (a tag push by another spelling).
        # `graphql` may sit after flags (`gh api -H ... graphql`), as the REST
        # rule's path may; adjacency was a spelling (review round 1).
        r"\bgh\s+api\b(?=.*\bgraphql\b).*\bmutation\b.*(?:\b(?:mergePullRequest|enablePullRequestAutoMerge"
        r"|deleteRef|deleteIssue|deleteDiscussion|deleteProjectV2)\b|refs/tags/)",
        "an irreversible act through a GraphQL mutation (merge, ref deletion, a deletion, or a tag ref); the human runs it",
    ),
    (
        r"\bgh\s+repo\s+delete\b",
        "deleting a repository, which no page undoes; the human does it",
    ),
    # W-44: `twine check` is RUNBOOK 1a's own gate line and a grep may carry the
    # word; only the upload is irreversible.
    # Flags may sit between the binary and its verb (`twine --no-color upload`),
    # as `settings.json`'s `*twine upload*` glob already admits (review round 1).
    (
        r"\btwine\b(?:\s+-\S+(?:\s+[^-\s]\S*)?)*\s+(?:upload|register)\b",
        "a PyPI upload; RUNBOOK section 1a is the human's hand-finish",
    ),
    # W-44: `--version`/`--help` and prose naming the binary are not a publish.
    # `login` stays refused: it writes live credential files into the CWD and
    # is the human's device flow. Optional `.exe"` and flags between name and
    # verb; `--help`/`-h` anywhere after the verb, within the SAME command, is
    # a read: the lookahead stops at `|`, `;` and `&` like the push rules, or
    # `publish && echo --help` would pass (review round 2).
    (
        r"mcp-publisher(?:\.exe)?[\"']?(?:\s+-\S+(?:\s+[^-\s]\S*)?)*\s+(?:publish|login)\b(?![^|;&]*\s(?:--help|-h)\b)",
        "a registry publish; release.yml publishes",
    ),
]


def main() -> None:
    cmd = tool_command(read_hook_input())
    if not cmd:
        ok()
    for pattern, why in DENIED:
        if re.search(pattern, cmd, re.I):
            block(
                f"deny_guard: refused {why}. Hand the line to the human in cmd.exe form (docs/workflows/DESIGN.md D8)."
            )
    ok()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.claude/hooks/dod_checklist.py`
```
"""The Definition-of-Done checklist, produced from evidence (DESIGN D6, section 1.1).

purpose:  every workflow ends in a checklist the AGENT did not fill in; each of
          STANDARD.md's twelve DoD items is met / unmet / n.a. with the evidence
          path, and pre_pr.py refuses a PR with an `unmet` row
invokes:  git diff against --base-ref, scripts/dod_changelog.py,
          scripts/surface_diff.py, the evidence files under
          .claude/state/evidence/, harness/thresholds.json (diff only)
produces: .claude/state/evidence/checklist.md (also printed)
refuses:  nothing; it reports

Usage: python .claude/hooks/dod_checklist.py [--base-ref origin/main] [--labels a,b] [--contributor]
       python .claude/hooks/dod_checklist.py --stamp red|green   (right after each run, #671)
The DoD text itself is read from docs/standard/STANDARD.md at run time; the
item numbers are the only thing this file knows.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import pathlib
import re
import subprocess
import sys

from _common import (
    EVIDENCE,
    REPO,
    UNREADABLE_PREFIX,
    content_tree,
    git,
    paths_for,
    tree_diff_paths,
    tree_id,
)

RATE_KEY_RE = re.compile(
    r'^\+.*["\'](\w+_(?:pct|rate|share)|confidence)["\']\s*:', re.M
)
BACKGROUND_RE = re.compile(
    r"^\+.*(?:threading\.Thread|socket\.socket|httpx\.|asyncio\.create_task|schedule)",
    re.M,
)


def sh(*cmd: str) -> tuple[int, str]:
    r = subprocess.run(
        cmd,
        cwd=REPO,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def dod_items() -> dict[int, str]:
    text = (REPO / "docs" / "standard" / "STANDARD.md").read_text(encoding="utf-8")
    sec = text.split("## Definition of Done for a change", 1)[1].split("\n## ", 1)[0]
    items = {}
    for m in re.finditer(r"^(\d+)\.\s+(.*?)(?=^\d+\.\s|\Z)", sec, re.M | re.S):
        items[int(m.group(1))] = " ".join(m.group(2).split())
    return items


def evidence(name: str) -> str | None:
    p = EVIDENCE / name
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else None


# W-38: the roots a red/green pair is REQUIRED for (this list serves row 1
# only; pre_commit.CODE_ROOTS and _common.TIER_PATHS answer other questions,
# W-43 names the three). Row 1 grades a pair that
# exists whatever the path; the roots decide only whether an absent pair is
# unmet or n.a. Three reviewers in one day graded the row by hand because
# `.claude/hooks/`, `benchmarks/` and `tests/` were not on the old list.
CODE_ROOTS = paths_for("redgreen")  # W-43: projected from _common.PATH_TABLE


def row1_verdict(changed: list[str], red: str | None, green: str | None) -> tuple[str, str]:
    """Row 1: red then green. Returns (verdict, evidence)."""
    if red is None or green is None:
        if not any(c.startswith(CODE_ROOTS) for c in changed):
            return "n.a.", "no change under a code root (" + ", ".join(CODE_ROOTS) + ") and no red/green pair"
        return (
            "unmet",
            "evidence/red.txt (touched tests at the base ref, must fail) and evidence/green.txt (at HEAD, must pass) are required",
        )
    # A red run that dies at collection says `error`, not `failed`, and
    # exits 2 (W-38 review; the remedy named EXIT=1 and EXIT=2 both).
    red_fail = "EXIT=0" not in red.splitlines()[-1:] and (
        "failed" in red.lower() or "error" in red.lower()
    )
    green_ok = "EXIT=0" in green.splitlines()[-1:] or (
        " passed" in green.lower() and "failed" not in green.lower()
    )
    return (
        "met" if red_fail and green_ok else "unmet",
        f"evidence/red.txt fails={red_fail}; evidence/green.txt passes={green_ok}",
    )


# #671: row 1 read red.txt/green.txt by path alone, so a later change on the
# same box inherited them (#669 graded `met` from #666's pair). A stamp binds a
# run to the branch, the tier-path tree it ran on (`_common.tree_id`, the
# identity pre_pr.py already holds the full-tier stamp to) and its own output.


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def make_stamp(kind: str, text: str, branch: str, tree: str, *, content: str | None = None) -> dict:
    stamp = {"kind": kind, "branch": branch, "tree": tree, "sha256": _sha(text)}
    if content is not None:
        stamp["content_tree"] = content  # #715: every tracked file, not only the code roots
    return stamp


def current_branch() -> str:
    return git("rev-parse", "--abbrev-ref", "HEAD").strip()


def write_stamp(kind: str) -> int:
    """`--stamp red|green`: bind the run just written to this branch and tree."""
    text = evidence(f"{kind}.txt")
    if text is None:
        print(f"dod_checklist: evidence/{kind}.txt is absent; run the tests into it first", file=sys.stderr)
        return 2
    tree = tree_id()
    if tree.startswith(UNREADABLE_PREFIX):
        # UNKNOWN is not a tree: a random id would always "differ" from green's.
        print(f"dod_checklist: the tree could not be read; evidence/{kind}.txt is not stamped", file=sys.stderr)
        return 2
    stamp = make_stamp(kind, text, current_branch(), tree, content=content_tree())
    (EVIDENCE / f"{kind}.stamp.json").write_text(json.dumps(stamp, indent=1), encoding="utf-8")
    print(f"stamped evidence/{kind}.txt: branch={stamp['branch']} tree={stamp['tree'][:12]}")
    return 0


def _outside_code_roots_only(
    red_stamp: dict, green_stamp: dict, diff_paths, *, changed: list[str], content_now: str | None
) -> tuple[list[str] | None, str]:
    """#715: equal tier trees are a genuine pair when the fix lives outside the code roots.

    A docs correction guarded by a new test has ONE tier tree for red and green
    by construction. This admits exactly that shape and nothing wider (review
    round 2 found the first draft passed a src fix whose red ran on the fixed
    code, once any unrelated doc moved before green):
    - the change touches no code root but `tests/`, so the tier tree could not
      have moved between an honest red and green;
    - green ran on the content tree that is there NOW;
    - the content trees differ, git can name what moved, nothing that moved is
      under a code root, and EVERY non-code path the branch changes moved, so
      red ran before any of them (a doc edited before red leaves red on the fix).
    Every UNKNOWN fails closed. Returns (moved paths, "") or (None, why not).
    """
    beyond_tests = [c for c in changed if c.startswith(CODE_ROOTS) and not c.startswith("tests/")]
    if beyond_tests:
        return None, (
            f"the change touches code roots beyond tests/ ({', '.join(beyond_tests[:3])}), "
            "so red must run on a different code-root tree"
        )
    a, b = red_stamp.get("content_tree"), green_stamp.get("content_tree")
    for kind, c in (("red", a), ("green", b), ("the current", content_now)):
        if not isinstance(c, str) or not c:
            return None, f"{kind} content tree is missing; re-stamp it"
        if c.startswith(UNREADABLE_PREFIX):
            return None, f"{kind} content tree could not be read (fail closed)"
    if b != content_now:
        return None, "evidence/green.txt ran on content that has changed since; re-run green and stamp it"
    if a == b:
        return None, "red and green ran on identical content, so red did not run on the pre-change tree"
    moved = diff_paths(a, b)
    if moved is None:
        return None, "git could not compare the red and green content trees (fail closed)"
    if not moved:
        return None, "git names no path between the red and green content trees (fail closed)"
    inside = [p for p in moved if p.startswith(CODE_ROOTS)]
    if inside:
        return None, (
            f"the content trees differ under a code root the tier tree did not see: {inside[:3]}. "
            "The usual
```

### Core Architecture Module: `.claude/hooks/pre_commit.py`
```
"""H1: the fast tier before a commit (docs/workflows/DESIGN.md section 4).

purpose:  a diff CI would reject on stage 1 never reaches the human
invokes:  `uv run python -m harness fast --summary`, the format check with
          pr-gate.yml's own scope and command (read from the workflow file,
          never restated), `uv run python -m harness check types.error_max`
          when pyright is importable
produces: .claude/state/evidence/fast.md
refuses:  a `git commit` when any of the three FAILS (exit 2 with the
          verdict lines); docs-only commits are not checked at all, except
          one that stages a file a Floor's Method READS (CLAUDE.md, whose
          size is `claude_md.max_chars`; the frozen benchmark artifacts the
          fidelity, schema and goldset Floors read; FINDINGS W-39)
budget:   150 s; past it, WARNING naming what was skipped, commit allowed
"""

from __future__ import annotations

import re

from _common import (
    EVIDENCE,
    REPO,
    Budget,
    block,
    budget_warning,
    git,
    ok,
    paths_for,
    read_hook_input,
    run_budgeted,
    settle_summary,
    split_segments,
    strip_heredocs,
    tool_command,
    warn,
    write_pending_summary,
)

BUDGET_SECONDS = 150
# W-43: projected from _common.PATH_TABLE; the table is where a path is admitted.
CODE_ROOTS = paths_for("fast")
# Files a Floor's Method READS, outside the code roots: a commit that stages
# one is not a free docs commit, because the fast tier's verdict moves with
# it (W-39: a docs-only PR reached pre_pr with a stamp two commits stale
# while the one Floor it moved, CLAUDE.md's size, went unmeasured). The
# benchmark entries are the frozen artifacts harness/__main__.py reads for
# the fidelity, schema and goldset Floors; tests/test_workflow_hooks.py
# reads that module's path literals and fails when one is not covered here.
FLOOR_INPUTS = (
    "CLAUDE.md",
    "benchmarks/schema_baseline.json",
    "benchmarks/rust_fidelity/",
    "benchmarks/racket_fidelity/",
    "benchmarks/provenance/",
    "benchmarks/route_recall/",
)
TIER_TRIGGERS = CODE_ROOTS + FLOOR_INPUTS
COMMIT_RE = re.compile(r"\bgit\s+(?:-\S+\s+)*commit\b")


def tier_needed(staged: list[str]) -> bool:
    """Does this commit's content reach anything the fast tier judges?"""
    return any(p.startswith(TIER_TRIGGERS) for p in staged)


def _format_command() -> str | None:
    """The `fast: format` step's command from pr-gate.yml, verbatim up to the tee."""
    text = (REPO / ".github" / "workflows" / "pr-gate.yml").read_text(encoding="utf-8")
    m = re.search(
        r"^\s*(uvx ruff\S* format --check[^\n|]*?)(?:\s*2>&1.*)?$", text, re.M
    )
    return m.group(1).strip() if m else None


def main() -> None:
    payload = read_hook_input()
    cmd = strip_heredocs(tool_command(payload))
    if not COMMIT_RE.search(cmd):
        ok()
    # The hook runs BEFORE the line it is asked about, so it can only judge a
    # commit whose content already exists. A line that also CREATES or EDITS
    # files (a printf, a heredoc, `python -`, `sed -i`) hides the commit's
    # content from every check here: two probes slipped past two earlier
    # rules this way (FINDINGS W-11, W-15). Such a line is refused outright,
    # not checked: create and edit first, then commit in a line of its own.
    segments = split_segments(cmd)
    provable = all(
        re.match(
            r"^(?:cd\s|git\s+(?:add|commit|status|diff|rm|mv|log|show|rev-parse|branch)\b|\{|\}|echo\s)",
            s,
        )
        for s in segments
    )
    if not provable:
        block(
            "pre_commit: this line does more than add and commit, so the hook cannot see "
            "what the commit will contain. Make the file changes in their own tool call, "
            "then run `git add ... && git commit ...` alone (FINDINGS W-15)."
        )
    staged = git("diff", "--cached", "--name-only").split()
    if re.search(
        r"\bgit\s+(?:add|rm|mv)\b|\bcommit\b[^|;&]*\s(?:-\S*a\S*|--all)\b", cmd
    ):
        staged += [
            ln[3:].strip().strip('"')
            for ln in git("status", "--porcelain", "--untracked-files=all").splitlines()
        ]
    if not tier_needed(staged):
        ok()

    budget = Budget(BUDGET_SECONDS)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    summary = EVIDENCE / "fast.md"
    # W-42: written BEFORE the run, so a hook the runner kills leaves a summary
    # that reads as FAIL. `--summary` appends (W-20); the settle below drops the
    # pending block once a verdict sits beneath it.
    write_pending_summary(summary, "pre_commit")
    skipped: list[str] = []
    failures: list[str] = []

    # F-26: the 12-line tail below is a console tail; the harness keeps the
    # tracebacks of a red run here and removes the file on a green one.
    failures_file = EVIDENCE / "fast-failures.txt"
    rc, out = run_budgeted(
        [
            "uv",
            "run",
            "python",
            "-m",
            "harness",
            "fast",
            "--summary",
            str(summary),
            "--failures",
            str(failures_file),
        ],
        budget,
    )
    if rc is None:
        # The pending summary stays: the checklist reads it unmet, not silent.
        skipped.append("the fast tier")
    else:
        settle_summary(summary)
    if rc is not None and rc != 0:
        tail = [
            ln for ln in out.splitlines() if " FAIL" in ln or "failed" in ln.lower()
        ][-12:]
        failures.append(
            "fast tier FAIL:\n"
            + "\n".join(tail or out.splitlines()[-12:])
            + (f"\n(tracebacks: {failures_file})" if failures_file.exists() else "")
        )

    fmt = _format_command()
    if fmt is None:
        skipped.append("the format check (pr-gate.yml `fast: format` step not found)")
    else:
        rc, out = run_budgeted(fmt, budget, shell=True)
        if rc is None:
            skipped.append("the format check")
        elif rc != 0:
            failures.append(
                f"format check FAIL (`{fmt}`):\n" + "\n".join(out.splitlines()[-8:])
            )

    rc, _ = run_budgeted(
        ["uv", "run", "python", "-c", "import pyright"],
        Budget(min(15, max(budget.left(), 1))),
    )
    if rc == 0:
        rc, out = run_budgeted(
            ["uv", "run", "python", "-m", "harness", "check", "types.error_max"], budget
        )
        if rc is None:
            skipped.append("the type ratchet (types.error_max)")
        elif rc != 0:
            failures.append(
                "types.error_max FAIL:\n" + "\n".join(out.splitlines()[-4:])
            )
    else:
        skipped.append(
            "the type ratchet (pyright not importable here; CI's `fast: types` runs it)"
        )

    if failures:
        block(
            "pre_commit: commit refused (DESIGN section 4, H1). Fix, then commit again.\n\n"
            + "\n\n".join(failures)
        )
    if skipped:
        warn("PreToolUse", budget_warning("pre_commit", ", ".join(skipped), budget))
    ok()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.claude/hooks/pre_pr.py`
```
"""H4: no PR without a full-tier pass on THIS tree (DESIGN section 4, D5).

purpose:  the PR gate's stage 2 is never the first place the full tier runs
invokes:  .claude/state/full-tier.json (written by run_full.py), git tree id,
          .claude/state/evidence/checklist.md (written by dod_checklist.py)
produces: nothing
refuses:  `gh pr create` when the stamp is absent, failed, or for another
          tree; when the branch is main; when the checklist is absent or has
          an `unmet` row
budget:   5 s
"""

from __future__ import annotations

import json
import re

from _common import (
    PENDING_MARK,
    EVIDENCE,
    STATE,
    block,
    git,
    ok,
    read_hook_input,
    strip_heredocs,
    tool_command,
    tree_id,
)

PR_RE = re.compile(r"\bgh\s+pr\s+create\b")


def main() -> None:
    cmd = strip_heredocs(tool_command(read_hook_input()))
    if not PR_RE.search(cmd):
        ok()
    # Resolved after read_hook_input, which may rebind STATE to a worktree (W-30).
    STAMP = STATE / "full-tier.json"  # noqa: N806
    CHECKLIST = EVIDENCE / "checklist.md"  # noqa: N806
    branch = git("rev-parse", "--abbrev-ref", "HEAD").strip()
    if branch == "main":
        block(
            "pre_pr: on `main`; every change goes through a branch and the gate (enforce_admins is on)."
        )
    if not STAMP.exists():
        block(
            "pre_pr: no full-tier stamp. Run `python .claude/hooks/run_full.py` (the full tier with --summary) "
            "on this tree first; the /feature and /fix-issue commands do."
        )
    stamp = json.loads(STAMP.read_text(encoding="utf-8"))
    now = tree_id()
    if not stamp.get("ok"):
        block(
            f"pre_pr: the last full tier on this box FAILED ({stamp.get('date')}, tree {stamp.get('tree', '?')[:12]})."
        )
    if stamp.get("tree") != now:
        block(
            "pre_pr: the full-tier stamp is for a DIFFERENT tree "
            f"(stamped {stamp.get('tree', '?')[:12]} at {stamp.get('date')}, now {now[:12]}). "
            "The tree changed after the run; run `python .claude/hooks/run_full.py` again."
        )
    # W-42 remedy (3): a pre_commit the runner killed leaves `fast.md` as its
    # pending block, and a checklist generated earlier can still read 12/12.
    FAST = EVIDENCE / "fast.md"  # noqa: N806
    fast_text = FAST.read_text(encoding="utf-8") if FAST.exists() else None
    if fast_text is None or PENDING_MARK in fast_text:
        block(
            "pre_pr: no fast-tier verdict on this box"
            + (" (the last pre_commit was killed before it wrote one)" if fast_text else "")
            + ". Run `uv run python -m harness fast --summary .claude/state/evidence/fast.md`, "
            "then the checklist again."
        )
    if "HARNESS FAIL" in fast_text or "**FAIL**" in fast_text:
        block("pre_pr: the last fast tier on this box FAILED; fix, then run it again.")
    if not CHECKLIST.exists():
        block(
            "pre_pr: no Definition-of-Done checklist. Run `python .claude/hooks/dod_checklist.py` and paste it into the PR body."
        )
    text = CHECKLIST.read_text(encoding="utf-8")
    unmet = [ln for ln in text.splitlines() if "| unmet |" in ln]
    if unmet:
        block("pre_pr: the checklist has unmet items:\n" + "\n".join(unmet))
    ok()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.claude/hooks/run_full.py`
```
"""The full tier with the D5 stamp (DESIGN section 4; FINDINGS W-3).

purpose:  run `python -m harness full --summary` and record that it passed on
          exactly this tree, so pre_pr.py can refuse a PR from any other tree
invokes:  `uv run python -m harness full --summary .claude/state/evidence/full.md`
produces: .claude/state/evidence/full.md, .claude/state/full-tier.json
          {tree, ok, date, commit, workers, seconds}, and on a red pytest run
          .claude/state/evidence/full-failures.txt (tracebacks, harness F-26)
refuses:  nothing; exit code is the harness's

Usage: python .claude/hooks/run_full.py [--workers N] [extra harness args]
The stamp is written BEFORE the run with ok=false and rewritten after, so an
interrupted run never leaves a stale pass behind.

`--workers N` caps xdist's `-n auto` through PYTEST_XDIST_AUTO_NUM_WORKERS,
for a box where other work leaves too little memory for one worker per core
(two full runs were killed that way, F-26). The stamp records the cap, so a
capped run's wall clock is never read as an uncapped one.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time

from _common import EVIDENCE, REPO, STATE, UNREADABLE_PREFIX, git, tree_id

STAMP = STATE / "full-tier.json"
WORKERS_ENV = "PYTEST_XDIST_AUTO_NUM_WORKERS"


def _split_workers(argv: list[str]) -> tuple[str | None, list[str]]:
    """`--workers N` (or `--workers=N`) out of argv; the rest goes to the harness."""
    rest: list[str] = []
    workers = None
    given = False
    it = iter(argv)
    for arg in it:
        if arg == "--workers":
            given, workers = True, next(it, None)
        elif arg.startswith("--workers="):
            given, workers = True, arg.split("=", 1)[1]
        else:
            rest.append(arg)
    # ⚠ A bare `--workers` must refuse, not run uncapped: a flag that is
    # present and does nothing reads as the cap it failed to set (review).
    # ASCII digits only: `"²".isdigit()` is True and `int("²")` raises.
    if given and not (workers and re.fullmatch(r"[1-9][0-9]*", workers)):
        raise SystemExit(f"run_full: --workers takes a positive integer, got {workers!r}")
    return workers, rest


def main(argv: list[str]) -> int:
    workers, argv = _split_workers(argv)
    env = dict(os.environ)
    if workers is not None:
        env[WORKERS_ENV] = workers
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    # `--summary` APPENDS; a stale FAIL row from an earlier run would read as
    # this run failing (FINDINGS W-20). One run, one summary.
    (EVIDENCE / "full.md").unlink(missing_ok=True)
    (EVIDENCE / "full-failures.txt").unlink(missing_ok=True)
    tree = tree_id()
    commit = git("rev-parse", "--short", "HEAD").strip()
    stamp = {
        "tree": tree,
        "ok": False,
        "date": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "commit": commit,
        # A cap set in the caller's environment counts too; "auto" is none.
        "workers": env.get(WORKERS_ENV) or "auto",
    }
    STAMP.write_text(json.dumps(stamp, indent=1), encoding="utf-8")
    t0 = time.monotonic()
    rc = subprocess.call(
        [
            "uv",
            "run",
            "python",
            "-m",
            "harness",
            "full",
            "--summary",
            str(EVIDENCE / "full.md"),
            # F-26: the id alone did not explain a Windows-only failure twice.
            # The harness writes the tracebacks here on red, removes it on green.
            "--failures",
            str(EVIDENCE / "full-failures.txt"),
            *argv,
        ],
        cwd=REPO,
        env=env,
    )
    # The cap reaches `full.md` too, the file a reviewer reads: a capped run
    # near the `suite.full_seconds` Floor is a different measurement (review).
    with open(EVIDENCE / "full.md", "a", encoding="utf-8") as fh:
        fh.write(f"\nxdist workers: {stamp['workers']}\n")
    after = tree_id()
    stamp.update(
        ok=(rc == 0 and after == tree), seconds=round(time.monotonic() - t0, 1)
    )
    if tree.startswith(UNREADABLE_PREFIX) or after.startswith(UNREADABLE_PREFIX):
        stamp["note"] = "tree identity could not be read (see stderr); stamp invalid"
    elif after != tree:
        stamp["note"] = "tree changed during the run; stamp invalid"
    STAMP.write_text(json.dumps(stamp, indent=1), encoding="utf-8")
    print(f"full-tier stamp: ok={stamp['ok']} tree={tree[:12]} workers={stamp['workers']} -> {STAMP}")
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

```

### Core Architecture Module: `.claude/hooks/surface_guard.py`
```
"""H3: the tool surface changed under an edit (DESIGN section 4).

purpose:  an edit under the tool-registration path recomputes the listing and
          says when it moved, so README, CLAUDE.md/KEY-FILES, CHANGELOG and the
          schema baseline are changed WITH the feature, not in the release commit
invokes:  `python scripts/surface_diff.py --base-ref HEAD` (working tree vs
          HEAD; never a hand-typed count)
produces: .claude/state/evidence/surface.md
refuses:  nothing; warning only (exit 2 feedback)
budget:   40 s
"""

from __future__ import annotations

import sys

from _common import (
    EVIDENCE,
    REPO,
    Budget,
    budget_warning,
    ok,
    read_hook_input,
    run_budgeted,
    tool_path,
    under,
    warn,
)

BUDGET_SECONDS = 40
SURFACE_PATHS = (
    ("src", "jcodemunch_mcp", "server.py"),
    ("src", "jcodemunch_mcp", "counter.py"),
    ("src", "jcodemunch_mcp", "cli", "policy.py"),
    ("src", "jcodemunch_mcp", "tools"),
    ("src", "jcodemunch_mcp", "encoding", "schemas"),
)


def _descriptions_flag() -> list[str]:
    """`--descriptions` once PR #592 (FINDINGS W-1) is on the base; the flag is read from the script, never assumed."""
    text = (REPO / "scripts" / "surface_diff.py").read_text(encoding="utf-8")
    return ["--descriptions"] if "--descriptions" in text else []


def main() -> None:
    payload = read_hook_input()
    path = tool_path(payload)
    if not any(under(path, *p) for p in SURFACE_PATHS):
        ok()
    budget = Budget(BUDGET_SECONDS)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    out_path = EVIDENCE / "surface.md"
    rc, out = run_budgeted(
        [
            sys.executable,
            "scripts/surface_diff.py",
            *_descriptions_flag(),
            "--base-ref",
            "HEAD",
            "--summary",
            str(out_path),
        ],
        budget,
    )
    if rc is None:
        warn("PostToolUse", budget_warning("surface_guard", "the surface diff", budget))
    if rc == 0 and "no surface change" in out:
        ok()
    tail = "\n".join(out.splitlines()[-15:])
    warn(
        "PostToolUse",
        "surface_guard: the tool surface differs from HEAD after this edit.\n"
        + tail
        + "\nDoD 4: README tool reference, CLAUDE.md Key Files (invariant) or KEY-FILES.md (description), "
        "CHANGELOG naming each tool, and the schema baseline regenerated with the token delta stated. "
        "Stage 5 (`done: tool surface`) checks this on the PR. "
        "Description changes are listed above only when the script has `--descriptions` (FINDINGS W-1, PR #592).",
    )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/anchor/measure.py`
```
"""Aggregate collected session_yield rows into the P0 redelivery artifact.

The number this produces decides F-15 P2 under a rule that was pre-registered
before any data existed (docs/prd-cue-anchored-delivery.md §3/§7):

    < 10%   P2 does not ship. Annotation alone is the product, and we say so.
    10-25%  P2 ships opt-in.
    > 25%   opt-in-by-default becomes a live question for a later release.

Usage:

    PYTHONPATH=src python benchmarks/anchor/measure.py
    PYTHONPATH=src python benchmarks/anchor/measure.py --db ~/.code-index/telemetry.db
    PYTHONPATH=src python benchmarks/anchor/measure.py --out benchmarks/anchor/results.json

Rows come from real sessions, and only when `perf_telemetry_enabled` is on --
there is no synthetic corpus here on purpose. Redelivery measures whether an
agent re-fetches what it already holds; a scripted session would encode the
answer in the script, which is why the harness reads observed sessions instead
of generating them.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

# A pooled rate over very few deliveries is noise wearing a decimal point. The
# threshold is a floor for REPORTING a verdict, not a target to collect toward.
MIN_DELIVERIES = 200
MIN_SESSIONS = 5


def _default_db() -> Path:
    return Path.home() / ".code-index" / "telemetry.db"


def collect(db: Path) -> dict:
    """Pool counts across sessions. Returns the artifact dict."""
    if not db.exists():
        return {"error": f"no telemetry db at {db}", "sessions": 0, "deliveries": 0}
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        try:
            rows = conn.execute(
                "SELECT session_uid, started_at, updated_at, deliveries,"
                " distinct_symbols, redelivered_symbols, redelivered_tokens_est,"
                " full_source_symbols FROM session_yield"
            ).fetchall()
        except sqlite3.OperationalError:
            return {
                "error": "session_yield table absent -- nothing collected yet",
                "sessions": 0,
                "deliveries": 0,
            }
    finally:
        conn.close()

    if not rows:
        return {"error": "session_yield is empty", "sessions": 0, "deliveries": 0}

    deliveries = sum(r[3] for r in rows)
    distinct = sum(r[4] for r in rows)
    redelivered_symbols = sum(r[5] for r in rows)
    redelivered_tokens = sum(r[6] for r in rows)
    full_source = sum(r[7] for r in rows)

    # POOLED, not the mean of per-session rates: a 3-delivery session must not
    # weigh the same as a 300-delivery one.
    rate = (deliveries - distinct) / deliveries if deliveries else 0.0

    art = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sessions": len(rows),
        "deliveries": deliveries,
        "distinct_symbols": distinct,
        "redelivered_symbols": redelivered_symbols,
        "redelivered_tokens_est": redelivered_tokens,
        "full_source_symbols": full_source,
        "redelivery_rate": round(rate, 4),
        "span": {
            "first": datetime.fromtimestamp(
                min(r[1] for r in rows), timezone.utc
            ).strftime("%Y-%m-%d"),
            "last": datetime.fromtimestamp(
                max(r[2] for r in rows), timezone.utc
            ).strftime("%Y-%m-%d"),
        },
    }

    sufficient = deliveries >= MIN_DELIVERIES and len(rows) >= MIN_SESSIONS
    art["sufficient"] = sufficient
    art["thresholds"] = {"min_deliveries": MIN_DELIVERIES, "min_sessions": MIN_SESSIONS}
    if not sufficient:
        # Absence of enough data is its own state -- NOT a verdict of "low".
        art["verdict"] = "insufficient_data"
        art["verdict_detail"] = (
            f"{deliveries} deliveries over {len(rows)} sessions; need "
            f"{MIN_DELIVERIES} over {MIN_SESSIONS}. No P2 decision is licensed yet."
        )
    elif rate < 0.10:
        art["verdict"] = "kill_p2"
        art["verdict_detail"] = "< 10%: P2 does not ship; annotation alone is the product."
    elif rate <= 0.25:
        art["verdict"] = "ship_p2_opt_in"
        art["verdict_detail"] = "10-25%: P2 ships opt-in."
    else:
        art["verdict"] = "opt_in_by_default_live"
        art["verdict_detail"] = "> 25%: opt-in-by-default is a live question for a later release."
    return art


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default=None, help="telemetry db (default ~/.code-index/telemetry.db)")
    ap.add_argument("--out", default=None, help="write the artifact JSON here")
    args = ap.parse_args()

    art = collect(Path(args.db).expanduser() if args.db else _default_db())
    text = json.dumps(art, indent=2)
    print(text)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
        print(f"\nwrote {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #856** (2026-09-26): **F#: a non-rec `let ... and ...` chain is not parsed as a chain by tree-sitter-fsharp**
  *Symptoms*: A non-`rec` F# `let ... and ...` chain is not parsed as a chain by tree-sitter-fsharp, so its second binding is absent or, inside a type body, error-recovered into a fabricated type.  ```fsharp let a = 1 and b = 2                    // module level: `and b = 2` parses as an infix_expression; b absent  type T() =     let mutable a = 1     and b = 2                // in a body: ERROR recovery yields a second anon_type_defn named `b`     member this.M() = a ```  Both are valid F# (spec 8.6: `let rec? function-or-value-defns`). `let rec a = 1 / and b = 2` parses clean in both positions and binds both since #824.  ## Measured  On `main` and on the #824 branch (2026-09-24): module level, `b` absent, no error node; in a body the `type_definition` has `has_error=True` and a second `anon_type_defn` `b` follows the first. #824 emits only the first definition of a chain whose `type_definition` carries an error, so the body case yields `T`, `T.a` and no `M` (the same absence `main` had), pinned as a tracked absence in `tests/test_an_fsharp_and_chain_binds_every_name.py`.  ## What a fix decides  The grammar is the limit. Options: read the spilled `infix_expression` for an `and <left> = <body>` shape at module level (fragile); or record a per-file parse warning when a `type_definition` carries an error (the same shape as #848's `static member val` spill). A newer tree-sitter-fsharp may parse the form; the pinned pack version is the first thing to check.  ## How this was found  The #824 rev

- **Issue #852** (2026-09-26): **C/C++: a prototype list (`int f(int), g(int);`) binds only its first name**
  *Symptoms*: A C or C++ prototype list binds only its first name.  ```c int f(int), g(int); ```  yields `function f` and no `g`, in C (since #835) and in C++ (before it). Both names are declared.  ## Mechanism  `_extract_symbol` returns one symbol per node and `name_fields` reads `child_by_field_name("declarator")`, which is the FIRST declarator. #823 fixed the identical shape for `typedef int A, B;` with `_typedef_extra_names`, which is gated on `type_definition`, so a `declaration` with N function declarators still yields one. #817's mechanism in its fourth C-family spelling (#817 Go, #823 typedef, #837 JS/TS `let`, this).  ## Fix shape  Widen `_typedef_extra_names` to a `declaration` whose extra declarators are function declarators (per declarator, `_cpp_declarator_is_function`, so `int f(int), x;` binds `f` and not `x`), for all three spec copies at once, and add the row to `tests/test_one_declaration_binds_every_name.py`. New symbols, no moved ids.  ## How this was found  Measured while fixing #835, pinned there as found (`test_a_multi_declarator_prototype_binds_what_cpp_binds`). Filed on its own under policy 1. 

- **Issue #850** (2026-09-26): **C++: a local function-pointer variable and a lambda variable are published as file-scope functions**
  *Symptoms*: A C++ local variable with a function-shaped declarator is published as a file-scope function.  ```cpp void vf() { int (*fp)(int); } void lf() { auto l = [](int a) { return a; }; } ```  yields `function fp` and `function l`, both at file scope with no owner, in C++ and Arduino. `fp` is a function-pointer variable and `l` is a lambda held in a variable; neither is a function declaration, and neither belongs at file scope.  ## Mechanism  `_walk_tree` keeps a C++ `declaration` when `_is_cpp_function_declaration` passes it, and that predicate reads the declarator's shape: a parenthesised declarator with a parameter list (`(*fp)(int)`) and an initialised declarator whose initialiser carries a parameter list (the lambda) both look like a function declaration to it. #833 then deliberately exempts every block-scope `declaration` from the enclosing function's ownership, because a real prototype declares a namespace-scope function, so these two ride that exemption to file scope.  ## What a fix decides  Whether a lambda variable is indexed at all (Python indexes a `lambda` assigned to a name as a function; if C++ follows, it is `lf.l` owned by `lf`, never file-scope) and that a function-pointer variable is not a function (a local variable emits nothing today, which is the consistent answer). The predicate is the layer to fix: a declarator that is a `function_declarator` directly under the declaration is a prototype; one wrapped in a `parenthesized_declarator` with a `pointer_declarator` 

- **Issue #848** (2026-09-26): **F#: every member after a `static member val ... with get, set` line is absent (grammar mis-parse)**
  *Symptoms*: In an F# type body, every member written after a `static member val ... with get, set` line is absent.  ```fsharp type A() =     static member val Total = 0 with get, set     static member Make() = A()     member val Size = 0 ```  yields `type A` and `property A.Total`; `Make` and `Size` are absent.  ## Mechanism  tree-sitter-fsharp mis-parses the line: it takes `val` as the member name, binds `Total` as the member's `args`, and spills `with get, set` and everything after it out of the type body as a file-level `tuple_expression` / `application_expression` chain. The parser cannot read members the grammar has placed outside the body. `member val` without `static` parses correctly.  #812's review caught the fabricated `A.val` half (the walker took `val` as the name and graded it `method`); that is fixed by naming from the `identifier_pattern`. The trailing-member loss is the grammar's and is filed here.  ## What a fix decides  Whether to recover from the mis-parse (read the spilled `application_expression` chain for `member` tokens, fragile) or to record the loss as a per-file parse warning the way `parse_file` reports other grammar limits. A pinned grammar version in the language pack is the first thing to check: a newer tree-sitter-fsharp may parse this correctly.  ## How this was found  The #812 reviewer's probe beyond the fixtures. Filed on its own under policy 1, beside #845. 

- **Issue #847** (2026-09-25): **Nim: a type declared with a pragma carries the pragma in its name**
  *Symptoms*: A Nim type declared with a pragma carries the pragma in its symbol name.  ``` type   Inh {.inheritable.} = object     v: int ```  yields `type Inh {.inheritable.}`, and after #812 its field is `Inh {.inheritable.}.v` with parent `a.nim::Inh {.inheritable.}#type`. A search for `Inh` by exact name misses, and every member id built on the owner's name inherits the pragma text.  ## Mechanism  `_parse_nim_symbols` names a type from `_text(type_symbol_declaration).strip().rstrip("*")`, the whole node's text, and the grammar puts the pragma inside `type_symbol_declaration` beside the name. The name is the `name` field (`identifier`, or `exported_symbol > identifier`), which #812's field walk already reads for fields; the type branch still reads text.  ## Fix shape  Read the `name` field for the type the way the field walk does. The ids of every pragma-bearing type and of its fields MOVE (`Inh {.inheritable.}` -> `Inh`), so `PARSER_GENERATION` names it; a test with an exported pragma-bearing type (`Inh* {.inheritable.}`) pins both spellings.  ## How this was found  The #812 reviewer's probe beyond the fixtures: a pre-existing owner name that #812 propagates into one new id per field. Filed so the owner id settles before those ids are relied on. 

- **Issue #846** (2026-09-25): **Pascal: a generic class (`TBox<T> = class`) is absent entirely**
  *Symptoms*: A generic Pascal class is absent entirely, and so are its members.  ``` type   TBox<T> = class     Value: T;     function Get: T;   end; ```  yields nothing. `TBox` is not a symbol, so after #812 `Value` and `Get` have no owner to be members of and are absent too.  ## Mechanism  `_parse_pascal_symbols` reads a `declType`'s name through `_first_child_of_type(node, "identifier")`. With type parameters the grammar puts the name under `genericTpl > identifier`, so the direct-child lookup misses and the whole declaration is skipped. It is the same no-direct-identifier mechanism as #844 (`genericDot` in the implementation section) one node over.  ## Fix shape  Read the `name` field and descend through `genericTpl`; the name is `TBox` (the parameter list belongs in the signature, not the name, the way C++ and TypeScript generics index). A test for the class and for a member of it; `PARSER_GENERATION` names the new symbols.  ## How this was found  The #812 reviewer's probe beyond the fixtures. Filed beside #844 under policy 1. 

- **Issue #845** (2026-09-26): **Pascal interface types and F# abstract members, interface implementations and secondary constructors declare members that are not indexed**
  *Symptoms*: A Pascal `interface` type and an F# abstract member, interface implementation or secondary constructor declare members that are not indexed.  ``` pascal   IFoo = interface  procedure Bar; property Q: Integer read GetQ;  end;   -> type IFoo, no members fsharp   type IShape = abstract Area : float                                     -> type IShape, no members fsharp   type C(x) = abstract Name : string  (in a class)                        -> Name absent fsharp   interface IDisposable with member this.Dispose() = ()                   -> Dispose absent fsharp   new() = C(0)                                                            -> the constructor absent ```  ## Mechanism  #812 gave the three parsers a body walk, and each reads the member node types it was written against. Pascal's `_parse_pascal_symbols` walks a body only for `declClass`/`declRecord`, so `declIntf` (the grammar's interface node) is never entered. F#'s `_walk_members` reads `function_or_value_defn`, `member_defn > method_or_prop_defn`, `member_defn > property_or_ident` and `member_defn > value_declaration`; `member_defn > abstract + member_signature`, `interface_implementation` and `additional_constr_defn` are unread. A grammar node a parser never names reads as the language having no such thing (Standing lesson 09-15).  ## What a fix decides  - A Pascal interface method: `method` owned by the interface (there is no body to distinguish it from a class method's declaration). - An F# `abstract` member: `method` 

- **Issue #844** (2026-09-25): **Pascal: a method's implementation (`function TAudit.RunIt`) is not indexed**
  *Symptoms*: A Pascal method's implementation is not indexed; only its declaration in the class is.  ``` unit U; interface type   TAudit = class     function RunIt: Integer;   end; implementation function TAudit.RunIt: Integer; begin   Result := 1; end; end. ```  After #812 this yields `class TAudit` and `method TAudit.RunIt` spanning the one-line declaration in the interface. The body in the implementation section, which is where the code is, yields nothing, so `get_symbol_source` on the method returns a signature and no body.  ## Mechanism  `_parse_pascal_symbols` handles `defProc > declProc` by asking for a direct `identifier` child. A qualified implementation name is `declProc > genericDot(identifier TAudit . identifier RunIt)`, so the lookup misses and the `defProc` is skipped. A free function's `defProc` has the bare identifier and is indexed.  ## What a fix decides  Two symbols exist for one method (Delphi's own model: declaration and implementation), so a fix must say which one owns the id. The C++ out-of-class definition is the precedent to read first: `_extract_symbol`'s `scoped_identifier` handling and whatever `test_member_kind_audit.py` says about cpp. One option is to keep the declaration as the member and attach the implementation's span as a second symbol under the same qualified name with a distinct kind; another is to prefer the implementation's span when it exists. Either way `PARSER_GENERATION` names it.  ## How this was found  Measuring #812's fixtures. Filed on its o

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

### Incident Patch 1: `306ae935` (2026-09-30)
**Commit Message**: fix: release notes fit GitHub's release body limit (LEDGER L-92) (#945)

* fix: release notes fit GitHub's release body limit (LEDGER L-92)

release.yml published the CHANGELOG block verbatim from an inline script,
and the 1.108.320 block renders to 335,771 characters against a 125,000
limit, in a job that runs after the PyPI publish. scripts/release_notes.py
keeps the verbatim body when it fits, and otherwise the lead, every
heading and a link at the tag; a test renders every block, and
[Unreleased] as if cut.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix: the release-notes fallback is bounded by construction, and the runbook renders through it (L-92 review)

The lead is capped, list items are dropped until the body plus the written
newline fits, and the verbatim check counts that newline. RUNBOOK's manual
fallback renders through scripts/release_notes.py instead of pasting the
block, and DESIGN no longer says verbatim.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `.github/workflows/release.yml` (modified, +4/-13)
```diff
@@ -327,25 +327,16 @@ jobs:
         uses: sigstore/gh-action-sigstore-python@04cffa1d795717b140764e8b640de88853c92acc  # v3.3.0
         with:
           inputs: dist/*.whl dist/*.tar.gz
-      - name: Notes = the CHANGELOG block verbatim + computed figures
+      - name: Notes = the CHANGELOG block (verbatim when it fits GitHub's limit) + computed figures
         env:
           GH_TOKEN: ${{ github.token }}
         shell: bash
         run: |
           set -euo pipefail
           V="${{ needs.preflight.outputs.version }}"
-          python - "$V" "${{ needs.preflight.outputs.tool_count }}" > "${RUNNER_TEMP}/notes.md" <<'PY'
-          import re, sys, pathlib
-          v, count = sys.argv[1], sys.argv[2]
-          text = pathlib.Path("CHANGELOG.md").read_text(encoding="utf-8")
-          m = re.search(rf"^## \[{re.escape(v)}\][^\n]*\n(.*?)(?=^## \[|\Z)", text, re.M | re.S)
-          if not m:
-              sys.exit(f"no CHANGELOG block for {v}")
-          py = re.search(r'requires-python\s*=\s*"([^"]+)"', pathlib.Path("pyproject.toml").read_text(encoding="utf-8"))
-          print(m.group(1).strip())
-          print()
-          print(f"---\n{count} tools in the `full` surface; Python {py.group(1) if py else 'unknown'}. Published by the Release workflow with PyPI trusted publishing and sigstore-signed artifacts.")
-          PY
+          # (LEDGER L-92) A tested renderer, never an inline script: GitHub refuses a body over
+          # 125,000 characters and this job runs AFTER the PyPI publish.
+          python scripts/release_notes.py "$V" "${{ needs.preflight.outputs.tool_count }}" > "${RUNNER_TEMP}/notes.md"
           TITLE=$(grep -m1 -E "^## \[$V\]" CHANGELOG.md | sed -E 's/^## \[[^]]+\] *-? *[0-9-]* *-? *//')
           if [ "${{ needs.preflight.outputs.dry_run }}" = "true" ]; then
             { echo "## github release (DRY RUN) — v$V — $TITLE"; echo; cat "${RUNNER_TEMP}/notes.md"; } >> "$GITHUB_STEP_SUMMARY"; exit 0
```

**File**: `docs/cicd/DESIGN.md` (modified, +3/-3)
```diff
@@ -93,7 +93,7 @@ Jobs, strictly sequential:
 5. **`release: tag`**. `git tag -a vX -m "<CHANGELOG heading>"` on the pre-flight's SHA, pushed by the workflow token with `contents: write`. Refuses if the SHA is no longer `main`'s HEAD (something merged mid-release; re-dispatch).
 6. **`release: pypi`** (environment `pypi`, `id-token: write`). Trusted publishing with attestations. Skipped entirely under `dry_run`.
 7. **`release: post-publish (<os>)`** x 2 (`handshake.yml`'s job, moved here). Poll PyPI up to 10 min, fresh venv, install `==X`, handshake, **and** assert the tool count from `surface` equals the pre-flight's count (both computed this run; never a literal). OPENS ISSUE `P0: post-publish check failed for vX` labeled `release`, `P0` on failure. No yank.
-8. **`release: github release`**. Notes generated from `CHANGELOG.md`'s `## [X]` block verbatim (the prose is human-written in the PR; nothing is composed here), tool count and Python range inserted from the pre-flight outputs, `dist/` and the sigstore bundles attached (fold `sign-release.yml` in: sign the artifact set from step 2 before upload). Marked as latest.
+8. **`release: github release`**. Notes rendered by `scripts/release_notes.py` from `CHANGELOG.md`'s `## [X]` block: verbatim when it fits GitHub's 125,000-character release body, and otherwise the block's lead paragraph, every entry heading and a link to the full block at the tag (LEDGER L-92; the prose is human-written in the PR; nothing is composed here), tool count and Python range inserted from the pre-flight outputs, `dist/` and the sigstore bundles attached (fold `sign-release.yml` in: sign the artifact set from step 2 before upload). Marked as latest.
 9. **`release: mcp registry`**. `mcp-publisher login github-oidc && mcp-publisher publish`, then the nested-row verification from CLAUDE.md as a script. `dry_run`: login + `--dry-run` publish only. OPENS ISSUE on failure; PyPI is already live, so this is a follow-up, not a rollback.
 
 Runtime: ~15 min real, ~8 min dry-run. Steps 3, 6 and 9 are the only ones with
@@ -228,8 +228,8 @@ verdict; updated in place on each push (one comment per PR).
 - **Major/minor version decisions.** MINOR has been 108 for four months by
   choice; the pipeline verifies the number, it never picks it.
 - **Changelog and release-note prose.** Both are written by a human in the
-  PR; the release copies the block verbatim and fills in only computed
-  figures.
+  PR; the release copies the block (verbatim when it fits GitHub's limit,
+  its lead and headings when not) and fills in only computed figures.
 - **Whether a change is user-facing.** A label (`release`, `no-changelog`)
   set by the human who knows; the gate checks consistency with the label,
   not the judgement behind it.
```

**File**: `docs/cicd/RUNBOOK.md` (modified, +4/-2)
```diff
@@ -63,8 +63,10 @@ uvx --from twine twine upload dist-ci\jcodemunch_mcp-X.Y.Z*
 
 then the post-publish smoke from PyPI in a fresh venv
 (`scripts\handshake.py --expect-version X.Y.Z --command <venv>\Scripts\jcodemunch-mcp.exe --fixture testsixtures\pkg_smoke`),
-`gh release create vX.Y.Z dist-ci\* --title ... --notes-file ...` with the
-notes rendered from the CHANGELOG block, and the registry line from
+`gh release create vX.Y.Z dist-ci\* --title ... --notes-file notes.md` with the
+notes rendered by `python scripts\release_notes.py X.Y.Z <tool_count> > notes.md`
+(never the block pasted by hand: GitHub refuses a body over 125,000
+characters, and 1.108.320's block alone was 335,730; LEDGER L-92), and the registry line from
 CLAUDE.md. The publisher is listed on PyPI since 2026-09-11 (FINDINGS C-15);
 the next dispatched run is the proof; if it is refused again, re-enter
 the form before each release. When `release: pypi` passes once, this
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -461,6 +461,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_sql_language.py | SQL DDL (tables, views, functions, indexes, schemas) and dbt Jinja SQL extract as symbols. | `49426fd Adding dbt sql support` | 10 | LOAD-BEARING | Inline SQL fixtures only. |
 | tests/test_sqlite_store.py | SQLiteIndexStore creates schema/WAL, saves/loads/incrementally saves indexes, and cross-process mtime invalidation works. | `1950077 fix: cross-process LRU cache invalidation`; `2ff57a8 fix: report unloadable repo indexes truthfully (#291)` | 3 | LOAD-BEARING | Core store contract. |
 | tests/test_stdio_guard.py | With the stdio transport, any non-JSON-RPC write to fd 1 (C-level, subprocess, thread) is redirected to stderr. | `044c3c9 release: v1.108.268 - JSON-RPC owns a private stdout`; docstring jdoc#110 parity | 6 | LOAD-BEARING | Spawns real Python subprocesses by design; sets PYTHONPATH=src. |
+| tests/test_release_notes_fit_the_github_limit.py | `release.yml`'s notes step renders through `scripts/release_notes.py`, never an inline script; the notes for the twelve newest released blocks and for [Unreleased] cut as a release fit GitHub's 125,000-character release body; a block that fits is verbatim; an oversized one keeps its lead, every heading and a link at the tag; a list too long for the limit says how many it cut; a missing block refuses. | LEDGER L-92 (2026-09-30), found cutting 1.108.320 | 1 | LOAD-BEARING | The inline renderer produced 335,771 characters for 1.108.320, and the job runs AFTER the PyPI publish, so the release would have half-published (`evidence/measure.txt`). Rendering [Unreleased] as if cut is the point: the next release is the one nobody has measured. |
 | tests/test_definition_exclusion_is_case_exact.py | `check_references` excludes only the lines of definitions spelled EXACTLY as the identifier: a call to `file()` inside a Java sibling `File()` is a reference and `check_delete_safe` does not certify the used `file`; asking about `File` still excludes `File`'s own lines; the target's own lines stay excluded (control); an unused `load` beside `Load` reads as referenced, the accepted cost, pinned. | LEDGER L-88 (2026-09-30), found in the L-84 review | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for the used method. 3 of 3 mutants killed (key lowered, symbol name lowered, exclusion dropped). |
 | tests/test_references_compare_normalised_spellings.py | `check_references` finds a call or an import written in another Unicode spelling of the identifier (ligature, math-bold, fullwidth, composed vs decomposed, either side), each pair run under Python to prove it names one function, and never reports the definition's own line; `check_delete_safe` no longer certifies the live `def file()` / `ﬁle()` case; a Java sibling `ﬁle()` whose name folds to the target keeps the call to `file()` inside its body; twenty test files mentioning the name do not push the one real caller off `check_delete_safe`'s page (L-89); `fire` still does not match `file` (control). | LEDGER L-84 and L-89 (2026-09-30), found in the L-83 reviews | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for a used function. The sibling case is review round 1's: a FOLDED definition-span exclusion removed that call and certified the used method at 1.0. 5 of 5 mutants killed (content, import names, the folded exclusion, identifier left unfolded, NFC instead of NFKC) plus L-89's (the page capped at 20 again), 6 of 6. |
 | tests/test_non_ascii_names_keep_refusing.py | A used Python function whose declared and called spellings differ only by Unicode normalisation (ligature, decomposed accent, math-bold or fullwidth letter, on either side) is never certified deletable, each pair proven to name one function by running it; the name predicate refuses non-ASCII names and admits ASCII ones (control). | LEDGER L-83 (2026-09-30), closed by design for normalising languages; the defect is L-84, the r
```

**File**: `docs/workflows/LEDGER.md` (modified, +1/-0)
```diff
@@ -140,3 +140,4 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-89 | 2026-09-30, L-84 review | `check_delete_safe` classified from `check_references`' content search capped at 20 files, so twenty test files that merely mention the name pushed a real same-file caller off the page and a used function graded `test_coverage_only` (#559's shape). `check_edit_safe` reads the same capped page for its blocker count, which lowers a count on an edit preflight and certifies nothing. | `src/jcodemunch_mcp/tools/check_delete_safe.py` | defect | medium | FIXED 2026-09-30 (the preflight reads every file through `check_references._check_single`; `check_edit_safe`'s count is left capped) |
 | L-90 | 2026-09-30, L-84 review | The deletion investigator (`investigator/deletion_safety.py`) re-filters `check_references`' `import_references` with a raw comparison, `target_name in (m.get("names") or [])`, so an import L-84's fold now finds (`from a import ﬁle` for `file`) is dropped there and `export_not_imported` can still read SATISFIED. Not a regression (main never matched it either): a second comparison site the fold does not reach. It should reuse `check_references._fold`, or trust the match `check_references` already made. | `src/jcodemunch_mcp/investigator/deletion_safety.py` | defect | low | OPEN |
 | L-91 | 2026-09-30, L-88 | `check_references` still excludes the lines of EVERY definition spelled exactly like the identifier, so a use inside a same-named definition elsewhere is lost: Java class `B { int file() { return new A().file(); } }` hides B's call to `A.file` when `check_delete_safe` asks about `A.file`, and one overload calling another is hidden the same way. The fix is to exclude only the TARGET symbol's own span when the caller knows it (`check_delete_safe` and `check_edit_safe` do). ⚠ Measure first: it makes an overload's sibling declarations, and a Python property's setter, read as references, which moves many verdicts toward blocking. | `src/jcodemunch_mcp/tools/check_references.py`, `src/jcodemunch_mcp/tools/check_delete_safe.py`, `src/jcodemunch_mcp/tools/check_edit_safe.py` | defect | medium | OPEN |
+| L-92 | 2026-09-30, cutting 1.108.320 | `release.yml` published the version's CHANGELOG block verbatim as the GitHub release body, from an inline script. GitHub refuses a body over 125,000 characters, and the 1.108.320 block rendered to 335,771. The github-release job runs after the PyPI publish and the registry job needs it, so dispatching would have published to PyPI, failed the GitHub release and skipped the registry. | `.github/workflows/release.yml` | defect | medium | FIXED 2026-09-30 (`scripts/release_notes.py`: verbatim when it fits, else the lead, every heading and a link at the tag; tested over every released block and [Unreleased] as if cut) |
```

---

### Incident Patch 2: `c547e502` (2026-09-30)
**Commit Message**: fix: a differently-cased sibling no longer hides a caller (LEDGER L-88) (#943)

* fix: a differently-cased sibling no longer hides a caller (LEDGER L-88)

check_references excluded the lines of every symbol whose name matched the
identifier case-insensitively, so Java File() beside file() skipped the
call to file() inside File() and check_delete_safe graded the used file
safe_to_delete at 1.0. The exclusion now matches the declared spelling
exactly; on this repo none of 359 case-shared names changed referenced state.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* docs: L-88 names its non-blocking cost; L-91 names check_edit_safe and overloads (L-88 review)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +22/-0)
```diff
@@ -2,6 +2,28 @@
 
 ## [Unreleased]
 
+### Fixed - a differently-cased sibling no longer hides a caller (LEDGER L-88)
+
+`check_references` leaves the definition's own lines out of its content
+search, so a declaration is not counted as a use of itself (#406). It picked
+those lines by matching every symbol's name to the identifier
+case-insensitively. In a case-sensitive language that names a different
+symbol: Java `File()` beside `file()` is two methods, and the call to `file()`
+inside `File()`'s body was skipped as `file`'s own definition.
+`check_delete_safe` then graded the used `file` `safe_to_delete` at confidence
+1.0.
+
+The exclusion now matches the declared spelling exactly, case included. An
+exclusion removes matches, so it must never be wider than the definition it
+stands for, the rule L-84 set for Unicode spellings. In a case-insensitive
+language, exact case errs toward counting a differently-cased declaration as
+a reference, which blocks a delete and never licenses one; the same false
+positive means the post-task diagnostic stops listing an unused `load` beside
+`Load` as unreferenced, and the reuse audit reads it as live. Measured on this
+repository's index: of the 359 names that share a lowercase form with another
+spelling, every one gains the sibling's lines, and none changes between
+referenced and unreferenced or loses a line.
+
 ### Fixed - a page of test mentions no longer hides a real caller from `check_delete_safe` (LEDGER L-89)
 
 `check_delete_safe` asked `check_references` for at most 20 files and built
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -461,6 +461,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_sql_language.py | SQL DDL (tables, views, functions, indexes, schemas) and dbt Jinja SQL extract as symbols. | `49426fd Adding dbt sql support` | 10 | LOAD-BEARING | Inline SQL fixtures only. |
 | tests/test_sqlite_store.py | SQLiteIndexStore creates schema/WAL, saves/loads/incrementally saves indexes, and cross-process mtime invalidation works. | `1950077 fix: cross-process LRU cache invalidation`; `2ff57a8 fix: report unloadable repo indexes truthfully (#291)` | 3 | LOAD-BEARING | Core store contract. |
 | tests/test_stdio_guard.py | With the stdio transport, any non-JSON-RPC write to fd 1 (C-level, subprocess, thread) is redirected to stderr. | `044c3c9 release: v1.108.268 - JSON-RPC owns a private stdout`; docstring jdoc#110 parity | 6 | LOAD-BEARING | Spawns real Python subprocesses by design; sets PYTHONPATH=src. |
+| tests/test_definition_exclusion_is_case_exact.py | `check_references` excludes only the lines of definitions spelled EXACTLY as the identifier: a call to `file()` inside a Java sibling `File()` is a reference and `check_delete_safe` does not certify the used `file`; asking about `File` still excludes `File`'s own lines; the target's own lines stay excluded (control); an unused `load` beside `Load` reads as referenced, the accepted cost, pinned. | LEDGER L-88 (2026-09-30), found in the L-84 review | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for the used method. 3 of 3 mutants killed (key lowered, symbol name lowered, exclusion dropped). |
 | tests/test_references_compare_normalised_spellings.py | `check_references` finds a call or an import written in another Unicode spelling of the identifier (ligature, math-bold, fullwidth, composed vs decomposed, either side), each pair run under Python to prove it names one function, and never reports the definition's own line; `check_delete_safe` no longer certifies the live `def file()` / `ﬁle()` case; a Java sibling `ﬁle()` whose name folds to the target keeps the call to `file()` inside its body; twenty test files mentioning the name do not push the one real caller off `check_delete_safe`'s page (L-89); `fire` still does not match `file` (control). | LEDGER L-84 and L-89 (2026-09-30), found in the L-83 reviews | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for a used function. The sibling case is review round 1's: a FOLDED definition-span exclusion removed that call and certified the used method at 1.0. 5 of 5 mutants killed (content, import names, the folded exclusion, identifier left unfolded, NFC instead of NFKC) plus L-89's (the page capped at 20 again), 6 of 6. |
 | tests/test_non_ascii_names_keep_refusing.py | A used Python function whose declared and called spellings differ only by Unicode normalisation (ligature, decomposed accent, math-bold or fullwidth letter, on either side) is never certified deletable, each pair proven to name one function by running it; the name predicate refuses non-ASCII names and admits ASCII ones (control). | LEDGER L-83 (2026-09-30), closed by design for normalising languages; the defect is L-84, the rest L-85 | 1 | LOAD-BEARING | Kills both predicate-only fixes the L-83 reviews rejected: `isidentifier()` alone (6 shapes) and `isidentifier()` plus NFKC form (the 3 call-side shapes). The refusal stands until the reference search compares normalised text. |
 | tests/test_name_not_searchable_keeps_its_other_gaps.py | A symbol `check_delete_safe` grades `name_not_searchable` keeps that verdict and gains the corpus gate's blocker and "re-index this repo" gap on an inadequate corpus, and the dynamic gate's blocker and loader gap when a site reaches its file; an adequate corpus adds nothing (control). | LEDGER L-81 (2026-09-29), found in the L-80 review | 1 | LOAD-BEARING | The dynamic half runs on a real package loader and a non-ASCII Python name (`café`, which the ASCII-only name predicate r
```

**File**: `docs/workflows/LEDGER.md` (modified, +2/-1)
```diff
@@ -136,6 +136,7 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-85 | 2026-09-30, L-83 review | In a language that compares identifiers code unit for code unit with no normalisation (Java JLS 3.8, ECMAScript, Go, Kotlin), a raw-spelling reference search is sound for a non-ASCII name, so `_name_reachability`'s ASCII-only refusal is a plain false refusal there: `check_delete_safe` answers `name_not_searchable` for a Java `café()` it could have graded. It fails toward a refusal. The fix is a language-aware predicate that admits Unicode identifiers where the language does not normalise, and it does not need L-84. ⚠ Check L-86's escape spelling before admitting anything. | `src/jcodemunch_mcp/tools/_name_reachability.py` | defect | low | OPEN |
 | L-86 | 2026-09-30, L-83 review | A Java or C# `\uXXXX` escape at a call site names the same identifier in other bytes: `\u0066ile()` is `file()` to the compiler. The ASCII name passes the name predicate, the raw-spelling reference search misses the escaped call, and with no importer edge (same file, or a loader-reached file) that is L-84's mechanism: a used symbol graded `safe_to_delete`. Not reproduced through the tool yet; the fix's first test does that. Decoding escapes belongs in the same search-layer comparison L-84 normalises. | `src/jcodemunch_mcp/tools/check_references.py`, `src/jcodemunch_mcp/tools/check_delete_safe.py` | defect | medium | OPEN |
 | L-87 | 2026-09-30, L-84 | With the reference search comparing NFKC-folded text (L-84), the reason L-83 closed by design for Python is gone: a non-ASCII Python name's calls are now found in any spelling, so `_name_reachability` could admit Python identifiers again. Lifting it means rewriting `tests/test_non_ascii_names_keep_refusing.py`, which pins the refusal, and re-running both L-83 reviews' spelling pairs through `check_delete_safe`. Rust (NFC) folds the same way. | `src/jcodemunch_mcp/tools/_name_reachability.py` | defect | low | OPEN |
-| L-88 | 2026-09-30, L-84 review | `check_references` excludes every line span of every symbol whose name matches the identifier CASE-INSENSITIVELY, but a case-sensitive language has distinct symbols there: Java `public int File() { return file(); }` beside `private int file()` skips `File`'s body as `file`'s own definition, loses the call inside it, and `check_delete_safe` grades the used `file` `safe_to_delete` at 1.0, on main. The `unspanned_files` skip drops whole files on the same comparison. The exclusion should key on the TARGET symbol's own span (its id), not on every symbol sharing its name. | `src/jcodemunch_mcp/tools/check_references.py` | defect | medium | OPEN |
+| L-88 | 2026-09-30, L-84 review | `check_references` excludes every line span of every symbol whose name matches the identifier CASE-INSENSITIVELY, but a case-sensitive language has distinct symbols there: Java `public int File() { return file(); }` beside `private int file()` skips `File`'s body as `file`'s own definition, loses the call inside it, and `check_delete_safe` grades the used `file` `safe_to_delete` at 1.0, on main. The `unspanned_files` skip drops whole files on the same comparison. The exclusion should key on the TARGET symbol's own span (its id), not on every symbol sharing its name. | `src/jcodemunch_mcp/tools/check_references.py` | defect | medium | FIXED 2026-09-30 (the exclusion matches the declared spelling exactly, case included; the target-span refinement is L-91) |
 | L-89 | 2026-09-30, L-84 review | `check_delete_safe` classified from `check_references`' content search capped at 20 files, so twenty test files that merely mention the name pushed a real same-file caller off the page and a used function graded `test_coverage_only` (#559's shape). `check_edit_safe` reads the same capped page for its blocker count, which lowers a count on an edit preflight and certifies nothing. | `src/jcodemunch_mcp/tools/check_delete_safe.py` | defect | medium | FIXED 2026-09-30 (the
```

**File**: `src/jcodemunch_mcp/tools/check_references.py` (modified, +9/-4)
```diff
@@ -55,9 +55,14 @@ def _check_single(
 ) -> dict:
     """Core logic for checking a single identifier against import + content data."""
     ident_lower = _fold(identifier)
-    # The exclusion's key: exact spelling, case-insensitive as before (see
-    # `_fold`'s ⚠⚠ -- an exclusion must never widen).
-    ident_exact = identifier.lower()
+    # The exclusion's key: the EXACT declared spelling, case included. An
+    # exclusion REMOVES matches, so it must never widen (see `_fold`'s ⚠⚠):
+    # compared case-insensitively, Java `File()` beside `file()` skipped the
+    # body of `File` as `file`'s own definition and lost the call inside it,
+    # grading the used `file` `safe_to_delete` at 1.0 (LEDGER L-88). In a
+    # case-insensitive language, exact case errs toward counting a
+    # differently-cased declaration as a reference, which only blocks.
+    ident_exact = identifier
 
     # ── Import-level check ──────────────────────────────────────────────────
     import_references = []
@@ -111,7 +116,7 @@ def _check_single(
     defining_spans: dict[str, list[tuple[int, int]]] = {}
     unspanned_files: set[str] = set()
     for sym in index.symbols:
-        if sym.get("name", "").lower() != ident_exact:
+        if sym.get("name", "") != ident_exact:
             continue
         file_path = sym.get("file", "")
         if not file_path:
```

**File**: `tests/test_definition_exclusion_is_case_exact.py` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+"""A differently-cased sibling's body is not the target's definition (LEDGER L-88).
+
+`check_references` excludes the definition's own lines from its content search,
+so a declaration is not counted as a use of itself (#406). It chose those lines
+by matching every symbol's name to the identifier CASE-INSENSITIVELY. In a
+case-sensitive language that names a different symbol: Java `File()` beside
+`file()` is two methods, and the call to `file()` inside `File()`'s body was
+skipped as `file`'s own definition. `check_delete_safe` then graded the used
+`file` `safe_to_delete` at confidence 1.0, on main.
+
+The exclusion now matches the declared spelling exactly. In a case-insensitive
+language that errs toward counting a differently-cased declaration as a
+reference, which blocks a delete and never licenses one.
+"""
+from __future__ import annotations
+
+from jcodemunch_mcp.tools.check_delete_safe import check_delete_safe
+from jcodemunch_mcp.tools.check_references import check_references
+from jcodemunch_mcp.tools.index_folder import index_folder
+
+_ABSENCE = ("safe_to_delete", "internal_only", "test_coverage_only")
+
+_JAVA = (
+    "public class A {\n"
+    "    public int File() {\n"
+    "        return file();\n"
+    "    }\n"
+    "    private int file() {\n"
+    "        return 1;\n"
+    "    }\n"
+    "}\n"
+)
+
+
+def _repo(tmp_path, files):
+    for rel, text in files.items():
+        (tmp_path / rel).write_text(text, encoding="utf-8")
+    storage = str(tmp_path / "idx")
+    return index_folder(path=str(tmp_path), use_ai_summaries=False, storage_path=storage)["repo"], storage
+
+
+def _lines(result):
+    return [m["line"] for f in result.get("content_references", []) for m in f["matches"]]
+
+
+def test_a_call_inside_a_differently_cased_sibling_is_a_reference(tmp_path):
+    repo, sp = _repo(tmp_path, {"A.java": _JAVA})
+    got = check_references(repo, identifier="file", storage_path=sp)
+    assert 3 in _lines(got), got
+
+
+def test_the_used_method_is_not_certified_deletable(tmp_path):
+    repo, sp = _repo(tmp_path, {"A.java": _JAVA})
+    got = check_delete_safe(repo, "file", storage_path=sp)
+    assert got["verdict"] not in _ABSENCE, (got["verdict"], got["confidence"])
+
+
+def test_control_the_definitions_own_lines_are_still_excluded(tmp_path):
+    """The exact-name definition keeps its exclusion: `file`'s declaration and
+    body (lines 5-7) are not a reference to itself."""
+    repo, sp = _repo(tmp_path, {"A.java": _JAVA})
+    lines = _lines(check_references(repo, identifier="file", storage_path=sp))
+    assert not set(lines) & {5, 6, 7}, lines
+
+
+def test_the_accepted_cost_a_cased_siblings_declaration_reads_as_a_reference(tmp_path):
+    """The direction this fix errs in, pinned so it is a decision and not an
+    accident: an unused `load` beside `Load` now reads as referenced, because
+    the case-insensitive substring search sees `Load`'s declaration and the
+    exact exclusion no longer hides it. That blocks a delete; it never
+    licenses one. The target's own lines stay excluded."""
+    src = (
+        "public class B {\n"
+        "    public int Load() {\n"
+        "        return 2;\n"
+        "    }\n"
+        "    private int load() {\n"
+        "        return 1;\n"
+        "    }\n"
+        "}\n"
+    )
+    repo, sp = _repo(tmp_path, {"B.java": src})
+    lines = _lines(check_references(repo, identifier="load", storage_path=sp))
+    assert 2 in lines, lines
+    assert not set(lines) & {5, 6, 7}, lines
+
+
+def test_a_capitalised_targets_own_lines_are_excluded(tmp_path):
+    """The key is the declared spelling as given, not a lowered copy: asking
+    about `File` excludes `File`'s own lines (2-4), including the call to
+    `file()` inside it, which is not a use of `File`."""
+    repo, sp = _repo(tmp_path, {"A.java": _JAVA})
+    lines = _lines(check_references(repo, identifier="File", storage_path=sp))
+    assert not set(lines) & {2, 3, 4}, l
```

---

### Incident Patch 3: `fe8ee771` (2026-09-30)
**Commit Message**: fix: check_references finds a call written in another spelling, and check_delete_safe reads every file (LEDGER L-84, L-89) (#942)

* fix: check_references finds a call written in another spelling of the name (LEDGER L-84)

Python normalises identifiers to NFKC, so def file() called as ﬁle()
is one function called once; the byte comparison never saw the call and
check_delete_safe graded it safe_to_delete at 1.0. check_references folds
the identifier, content lines, imported names and the definition span
through NFKC, for every language, since folding only adds matches.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix: the definition-span exclusion keeps the exact name (L-84 review)

Folding the exclusion removed matches: in Java, ﬁle() and file() are two
methods, and the folded exclusion skipped the call to file() inside
ﬁle()'s body, grading the used method safe_to_delete at 1.0 where main
blocked. Line and import matches stay folded; the exclusion is exact. A
Java sibling test pins it, the docstrings state the real invariant, and
LEDGER L-88 records the case over-exclusion already on main.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix: check_delete

**File**: `CHANGELOG.md` (modified, +40/-0)
```diff
@@ -2,6 +2,46 @@
 
 ## [Unreleased]
 
+### Fixed - a page of test mentions no longer hides a real caller from `check_delete_safe` (LEDGER L-89)
+
+`check_delete_safe` asked `check_references` for at most 20 files and built
+its verdict from that page alone. Twenty test files that merely mention the
+name, in a comment, pushed the one real caller off the page, and a used
+function graded `test_coverage_only`. This is #559's shape: a count taken
+after the page is cut describes the page. It predates L-84, which added a new
+way to fill the page (a name's compatibility spelling in prose), and the L-84
+review found it.
+
+The preflight now reads every file. It calls the same search the public tool
+uses, without the tool's page cap, which costs at most one full scan, the
+cost a search that finds nothing already pays. Measured on this repository's
+own index (cross-repo on, as by default), the median of five went from 12,826
+to 13,566 ms for `resolve_repo`, a widely referenced symbol, and from 13,476
+to 13,573 ms for `build_stop_rule`.
+
+### Fixed - `check_references` finds a call written in another spelling of the name (LEDGER L-84)
+
+Python normalises identifiers to NFKC, so `def file()` called as `ﬁle()`
+(the fi ligature) is one function called once. `check_references` tested
+whether the identifier's bytes appeared in a line, so it never saw that call,
+and `check_delete_safe`, which reads it for its no-reference evidence, graded
+the used function `safe_to_delete` at confidence 1.0. The name gate could not
+catch it, because `file` is a plain ASCII identifier. The same held for a
+decomposed accent, a fullwidth letter or a mathematical-bold letter on either
+side, and for an import written in another spelling.
+
+`check_references` now compares NFKC-folded text on both sides of a line match
+and an import match, for every language: a found reference only ever blocks a
+delete, and the search already over-matches on purpose (substring,
+case-insensitive). The exclusion of the definition's own lines is NOT folded.
+Review found that folding it removes matches: in Java, `ﬁle()` and `file()`
+are two methods, and a folded exclusion skipped the body of `ﬁle` as `file`'s
+definition, losing the call inside it and grading the used method
+`safe_to_delete` at 1.0 where main blocked. ASCII text skips the
+normalisation, since NFKC changes nothing there. Measured with a scratch script
+on this repository's own index, the median over five runs went from 524 to 534
+ms for a name that appears nowhere and from 247 to 272 ms for `verdict`.
+
 ### Fixed - `name_not_searchable` names the re-index and the loaders that could move it (LEDGER L-81)
 
 `check_delete_safe` runs three gates over an absence verdict: the name gate
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -461,6 +461,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_sql_language.py | SQL DDL (tables, views, functions, indexes, schemas) and dbt Jinja SQL extract as symbols. | `49426fd Adding dbt sql support` | 10 | LOAD-BEARING | Inline SQL fixtures only. |
 | tests/test_sqlite_store.py | SQLiteIndexStore creates schema/WAL, saves/loads/incrementally saves indexes, and cross-process mtime invalidation works. | `1950077 fix: cross-process LRU cache invalidation`; `2ff57a8 fix: report unloadable repo indexes truthfully (#291)` | 3 | LOAD-BEARING | Core store contract. |
 | tests/test_stdio_guard.py | With the stdio transport, any non-JSON-RPC write to fd 1 (C-level, subprocess, thread) is redirected to stderr. | `044c3c9 release: v1.108.268 - JSON-RPC owns a private stdout`; docstring jdoc#110 parity | 6 | LOAD-BEARING | Spawns real Python subprocesses by design; sets PYTHONPATH=src. |
+| tests/test_references_compare_normalised_spellings.py | `check_references` finds a call or an import written in another Unicode spelling of the identifier (ligature, math-bold, fullwidth, composed vs decomposed, either side), each pair run under Python to prove it names one function, and never reports the definition's own line; `check_delete_safe` no longer certifies the live `def file()` / `ﬁle()` case; a Java sibling `ﬁle()` whose name folds to the target keeps the call to `file()` inside its body; twenty test files mentioning the name do not push the one real caller off `check_delete_safe`'s page (L-89); `fire` still does not match `file` (control). | LEDGER L-84 and L-89 (2026-09-30), found in the L-83 reviews | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for a used function. The sibling case is review round 1's: a FOLDED definition-span exclusion removed that call and certified the used method at 1.0. 5 of 5 mutants killed (content, import names, the folded exclusion, identifier left unfolded, NFC instead of NFKC) plus L-89's (the page capped at 20 again), 6 of 6. |
 | tests/test_non_ascii_names_keep_refusing.py | A used Python function whose declared and called spellings differ only by Unicode normalisation (ligature, decomposed accent, math-bold or fullwidth letter, on either side) is never certified deletable, each pair proven to name one function by running it; the name predicate refuses non-ASCII names and admits ASCII ones (control). | LEDGER L-83 (2026-09-30), closed by design for normalising languages; the defect is L-84, the rest L-85 | 1 | LOAD-BEARING | Kills both predicate-only fixes the L-83 reviews rejected: `isidentifier()` alone (6 shapes) and `isidentifier()` plus NFKC form (the 3 call-side shapes). The refusal stands until the reference search compares normalised text. |
 | tests/test_name_not_searchable_keeps_its_other_gaps.py | A symbol `check_delete_safe` grades `name_not_searchable` keeps that verdict and gains the corpus gate's blocker and "re-index this repo" gap on an inadequate corpus, and the dynamic gate's blocker and loader gap when a site reaches its file; an adequate corpus adds nothing (control). | LEDGER L-81 (2026-09-29), found in the L-80 review | 1 | LOAD-BEARING | The dynamic half runs on a real package loader and a non-ASCII Python name (`café`, which the ASCII-only name predicate refuses, LEDGER L-83); nothing patches the reach rule. 4 of 4 mutants killed. |
 | tests/test_unsettled_verdicts_are_never_terminal.py | Every verdict in `_stop_rule._UNSETTLED` (an absence that could not be established) is non-terminal with every channel open and no gap passed, and names what would move it; `check_delete_safe`'s `name_not_searchable` is non-terminal through the tool with runtime traces present and names reading the call sites; `safe_to_delete` with every channel open stays terminal (control). | LEDGER L-80 (2026-09-29), found in the L-79 review | 1 | LOAD-BEARING | #714's `test_the_refusal_is_not_terminal` passed only because no traces were i
```

**File**: `docs/workflows/LEDGER.md` (modified, +5/-1)
```diff
@@ -132,6 +132,10 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-81 | 2026-09-29, L-80 review | `check_delete_safe`'s dynamic-import and corpus gates fire only on `safe_to_delete` / `internal_only` / `test_coverage_only` (the corpus gate also on `dynamic_import_boundary`), so a symbol the name gate already moved to `name_not_searchable` never gets `dynamic_gap` or `corpus_gap`: its `would_change_verdict` omits "re-index this repo" and the named loaders, though the corpus gate's own comment says dropping that gap hides the re-index that could change the answer. `terminal` is correct since L-80; the next actions are incomplete. | `src/jcodemunch_mcp/tools/check_delete_safe.py` | defect | low | FIXED 2026-09-29 (the dynamic and corpus gates run on `name_not_searchable`, which keeps its name and gains their blockers and gaps) |
 | L-82 | 2026-09-29, L-80 review | `_stop_rule._UNSETTLED` is a hand-kept list: a future bounded verdict whose meaning is an unestablished absence is not forced into it, and `tests/test_unsettled_verdicts_are_never_terminal.py` pins the current four in both directions but cannot see a fifth. Every current caller also passes its gap, so the exposure is a lost action, not a false `terminal`; the three per-cause gap kwargs (`corpus_gap`, `dynamic_gap`, `name_gap`) are the shape that let one be forgotten. | `src/jcodemunch_mcp/tools/_stop_rule.py` | test | low | OPEN |
 | L-83 | 2026-09-29, L-81 review | `_name_reachability._IDENTIFIER` is ASCII-only (`^[A-Za-z_][A-Za-z0-9_]*$`), so a non-ASCII identifier (Python `def café()`, and the same in Java, C#, JS, Kotlin) is graded `name_not_searchable` though a call site writes it, contradicting the module docstring's "a name that is not a plain identifier cannot be a call-site token in any language". It fails toward a refusal, never a deletion. The fix moves `tests/test_name_not_searchable_keeps_its_other_gaps.py`'s `café` fixture to another unsearchable Python name, or that test fails on its first assert. | `src/jcodemunch_mcp/tools/_name_reachability.py` | defect | low | CLOSED 2026-09-30, by design FOR LANGUAGES THAT NORMALISE IDENTIFIERS (Python NFKC, Rust NFC; session call, for jjg to overrule): two review rounds measured a used Python function certified `safe_to_delete` at 1.0 under each predicate-only fix, because the reference search compares raw spellings; the refusal stands until L-84; pinned by `tests/test_non_ascii_names_keep_refusing.py`. The non-normalising languages are L-85, still open |
-| L-84 | 2026-09-30, L-83 reviews | The reference search `check_delete_safe` relies on compares raw spellings, and Python identifiers are NFKC-equivalent, so a call written in another Unicode spelling of the defined name is never found. Live on main for an ASCII definition, which the name predicate admits: `def file()` called as `ﬁle()` (the fi ligature) runs and is graded `safe_to_delete` at confidence 1.0. It also keeps every non-ASCII name refused (L-83): no test of the definition's spelling can say whether a call site writes the same bytes. The destructive path is a use with no importer edge (same file, or a file a loader reaches): across files, `from a import ﬁle` is caught by `find_importers` (`external_uses_blocking`). The fix is one layer down, comparing text normalised the way the LANGUAGE compares identifiers: NFKC for Python, NFC for Rust, and only after checking each other language's spec (C# and Swift are unverified). Its first failing test is the `def file()` / `ﬁle()` case, which has no witness in the tree because it would be red on main; then L-83's refusal can be lifted for those languages and `tests/test_non_ascii_names_keep_refusing.py` rewritten. | `src/jcodemunch_mcp/tools/check_references.py`, `src/jcodemunch_mcp/tools/check_delete_safe.py` | defect | medium | OPEN |
+| L-84 | 2026-09-30, L-83 reviews | The reference search `check_delete_safe` relies on compares raw spellings, and Python identifiers are NFK
```

**File**: `src/jcodemunch_mcp/tools/check_delete_safe.py` (modified, +14/-10)
```diff
@@ -264,16 +264,20 @@ def check_delete_safe(
     internal_ref_count = 0
     test_ref_count = 0
     try:
-        from .check_references import check_references  # noqa: PLC0415
-        # Batch form (identifiers=[...]) so check_references returns its grouped
-        # `results` shape — singular (identifier=...) returns a flat response with
-        # no `results` key, which this loop would silently read as empty (#338).
-        ref_out = check_references(
-            repo=f"{owner}/{name}", identifiers=[target_name],
-            search_content=True, max_content_results=20,
-            storage_path=storage_path,
-        )
-        for entry in ref_out.get("results", []) or []:
+        from . import check_references  # noqa: PLC0415
+        # ⚠⚠ (LEDGER L-89) EVERY file, never a page. The public tool caps its
+        # content search at 20 files (100 at most), and this verdict was built
+        # from that page alone: twenty test files that merely MENTION the name
+        # pushed the one real caller off it, and a used function graded
+        # `test_coverage_only`. An absence claim needs the whole corpus -- a
+        # count taken after the page is cut describes the page (#559). The
+        # cost is at most one full scan, which a no-match search pays anyway.
+        ref_entries = [check_references._check_single(
+            identifier=target_name, index=index, search_content=True,
+            max_content_results=max(1, len(index.source_files)),
+            owner=owner, name=name, store=store, start=time.perf_counter(),
+        )]
+        for entry in ref_entries:
             for ref in entry.get("content_references", []) or []:
                 ref_file = ref.get("file", "")
                 if not ref_file:
```

**File**: `src/jcodemunch_mcp/tools/check_references.py` (modified, +39/-5)
```diff
@@ -6,12 +6,43 @@
 
 import posixpath
 import time
+import unicodedata
 from typing import Optional
 
 from ..storage import IndexStore
 from ._utils import index_status_to_tool_error, resolve_repo
 
 
+def _fold(text: str) -> str:
+    """The spelling two identifiers are compared in (LEDGER L-84).
+
+    ⚠⚠ Python normalises identifiers to NFKC, so `def file()` called as
+    `\ufb01le()` (the fi ligature) is one function called once, and a byte
+    comparison never saw the call: `check_delete_safe` read that as no
+    reference and graded the used function `safe_to_delete` at 1.0.
+
+    NFKC on both sides of a LINE or IMPORT match, for every language: a
+    found reference only ever blocks a delete, and the search already
+    over-matches on purpose (substring, case-insensitive). Folding can drop
+    a raw hit only where a combining mark follows the identifier and NFKC
+    composes it onto the last letter (`file` + U+0301), which spells a
+    different identifier, so no real reference is lost.
+
+    ⚠⚠ NEVER fold the definition-span EXCLUSION (review, L-84): that step
+    REMOVES matches, and in a language that does not normalise, Java's
+    `\ufb01le()` and `file()` are two methods. Folding it skipped the body of
+    `\ufb01le` as `file`'s own definition and lost the call inside it --
+    `safe_to_delete` at 1.0 where main blocked. The identifier is the
+    declared spelling, so the exclusion needs no folding to find it.
+
+    ASCII is returned as `lower()` without normalising: NFKC is the
+    identity there, and this runs on every line of every file.
+    """
+    if text.isascii():
+        return text.lower()
+    return unicodedata.normalize("NFKC", text).lower()
+
+
 def _check_single(
     identifier: str,
     index,
@@ -23,17 +54,20 @@ def _check_single(
     start: float,
 ) -> dict:
     """Core logic for checking a single identifier against import + content data."""
-    ident_lower = identifier.lower()
+    ident_lower = _fold(identifier)
+    # The exclusion's key: exact spelling, case-insensitive as before (see
+    # `_fold`'s ⚠⚠ -- an exclusion must never widen).
+    ident_exact = identifier.lower()
 
     # ── Import-level check ──────────────────────────────────────────────────
     import_references = []
     if index.imports is not None:
         for src_file, file_imports in index.imports.items():
             matches = []
             for imp in file_imports:
-                named_match = any(n.lower() == ident_lower for n in imp.get("names", []))
+                named_match = any(_fold(n) == ident_lower for n in imp.get("names", []))
                 spec = imp["specifier"]
-                spec_stem = posixpath.splitext(posixpath.basename(spec))[0].lower()
+                spec_stem = _fold(posixpath.splitext(posixpath.basename(spec))[0])
                 stem_match = spec_stem == ident_lower
 
                 if named_match or stem_match:
@@ -77,7 +111,7 @@ def _check_single(
     defining_spans: dict[str, list[tuple[int, int]]] = {}
     unspanned_files: set[str] = set()
     for sym in index.symbols:
-        if sym.get("name", "").lower() != ident_lower:
+        if sym.get("name", "").lower() != ident_exact:
             continue
         file_path = sym.get("file", "")
         if not file_path:
@@ -118,7 +152,7 @@ def _check_single(
 
             file_matches = []
             for line_index, line in enumerate(content.split("\n")):
-                if ident_lower not in line.lower():
+                if ident_lower not in _fold(line):
                     continue
                 line_no = line_index + 1
                 if any(lo <= line_no <= hi for lo, hi in spans):
```

---

### Incident Patch 4: `953851cf` (2026-09-30)
**Commit Message**: fix: name_not_searchable names the re-index and the loaders that could move it (LEDGER L-81) (#939)

* fix: name_not_searchable names the re-index and the loaders that could move it (LEDGER L-81)

check_delete_safe ran its dynamic-import and corpus gates only on the plain
absence verdicts, so a symbol the name gate had already moved to
name_not_searchable lost their blockers and gaps; on a stale index the stop
rule never named the re-index. Both gates now run on it, and it keeps its
name as the narrower cause.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix: drive the L-81 dynamic half through a real loader, drop the dead clamp (L-81 review)

The dynamic half is reachable: a non-ASCII Python name (café) fails the
ASCII-only name predicate (LEDGER L-83). The test uses a real package loader
instead of patching the reach rule, the corpus clamp on name_not_searchable
was dead by construction and is removed with its vacuous test, and the
CHANGELOG no longer says the dynamic half is unreachable.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* docs: LEDGER L-83 names the fixture its fix must move (L-81 review)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic

**File**: `CHANGELOG.md` (modified, +19/-0)
```diff
@@ -2,6 +2,25 @@
 
 ## [Unreleased]
 
+### Fixed - `name_not_searchable` names the re-index and the loaders that could move it (LEDGER L-81)
+
+`check_delete_safe` runs three gates over an absence verdict: the name gate
+(#714), then the dynamic-import gate (L-70), then the corpus gate (#566). The
+later two fired only on the plain absence verdicts, so a symbol the name gate
+had already moved to `name_not_searchable` skipped both. On a stale index its
+`stop_rule.would_change_verdict` named reading the call sites and left out
+"re-index this repo", which the corpus gate's own comment says is the gap that
+could change the answer, and the blocker list dropped the corpus blocker.
+
+Both gates now run on `name_not_searchable` too. The verdict keeps its name,
+because the name gate is the narrower cause, the same rule the corpus gate
+already applies to `dynamic_import_boundary`, and it gains the other gates'
+blockers and gaps. Both halves are reachable on a real repo: a C# operator on a
+stale index, and a Python function with a non-ASCII name (`def café()`) in a
+package that loads its modules by computed name. The name predicate is
+ASCII-only, so it refuses `café` though a call site writes it; that is LEDGER
+L-83, and it fails toward a refusal, never a deletion.
+
 ### Fixed - `check_delete_safe` no longer tells an agent to stop checking on an unsearchable name (LEDGER L-80)
 
 `name_not_searchable` (#714) is the verdict for a symbol no call site names:
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -461,6 +461,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_sql_language.py | SQL DDL (tables, views, functions, indexes, schemas) and dbt Jinja SQL extract as symbols. | `49426fd Adding dbt sql support` | 10 | LOAD-BEARING | Inline SQL fixtures only. |
 | tests/test_sqlite_store.py | SQLiteIndexStore creates schema/WAL, saves/loads/incrementally saves indexes, and cross-process mtime invalidation works. | `1950077 fix: cross-process LRU cache invalidation`; `2ff57a8 fix: report unloadable repo indexes truthfully (#291)` | 3 | LOAD-BEARING | Core store contract. |
 | tests/test_stdio_guard.py | With the stdio transport, any non-JSON-RPC write to fd 1 (C-level, subprocess, thread) is redirected to stderr. | `044c3c9 release: v1.108.268 - JSON-RPC owns a private stdout`; docstring jdoc#110 parity | 6 | LOAD-BEARING | Spawns real Python subprocesses by design; sets PYTHONPATH=src. |
+| tests/test_name_not_searchable_keeps_its_other_gaps.py | A symbol `check_delete_safe` grades `name_not_searchable` keeps that verdict and gains the corpus gate's blocker and "re-index this repo" gap on an inadequate corpus, and the dynamic gate's blocker and loader gap when a site reaches its file; an adequate corpus adds nothing (control). | LEDGER L-81 (2026-09-29), found in the L-80 review | 1 | LOAD-BEARING | The dynamic half runs on a real package loader and a non-ASCII Python name (`café`, which the ASCII-only name predicate refuses, LEDGER L-83); nothing patches the reach rule. 4 of 4 mutants killed. |
 | tests/test_unsettled_verdicts_are_never_terminal.py | Every verdict in `_stop_rule._UNSETTLED` (an absence that could not be established) is non-terminal with every channel open and no gap passed, and names what would move it; `check_delete_safe`'s `name_not_searchable` is non-terminal through the tool with runtime traces present and names reading the call sites; `safe_to_delete` with every channel open stays terminal (control). | LEDGER L-80 (2026-09-29), found in the L-79 review | 1 | LOAD-BEARING | #714's `test_the_refusal_is_not_terminal` passed only because no traces were ingested; this one opens every channel. 4 of 5 mutants killed; the survivor (terminal read from a never-empty gap list) is equivalent. |
 | tests/test_stop_rule.py | build_stop_rule yields terminal=True only on positive evidence and False on every uncertainty or unknown verdict; ALREADY_CONSULTED binds to real import sites. | `2a097af feat(safety): ship an executable stop rule beside the confidence score`; docstring arXiv 2608.01347 | 9 | LOAD-BEARING | Practice 7; fail-closed on destructive verdicts. |
 | tests/test_storage.py | IndexStore save/load/has_index/list and corruption handling behave, including unloadable-index truth (#291). | `f580cd4 release: v1.108.105 — index-write lock on delta paths + load_index corruption guard`; `2ff57a8 (#291)` | 3 | LOAD-BEARING | Overlaps test_sqlite_store on save/load but covers corruption guard + has_index. |
```

**File**: `docs/workflows/LEDGER.md` (modified, +2/-1)
```diff
@@ -129,5 +129,6 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-78 | 2026-09-29, pyjwt lock review | `.claude/hooks/dod_checklist.py --stamp red` records the tree at STAMP time, not the tree the red run measured, so a lock-only change (red = the dependency audit on main's lock, run with the branch's lock stashed) stamps red and green with the same `content_tree` and DoD 1 reads `n.a.` though a red/green pair exists. The pyjwt PR's red was reproduced by its reviewer instead. The commit hook also wrote no `fast.md` for that lock-only commit. | `.claude/hooks/dod_checklist.py`, `.claude/hooks/pre_commit.py` | gap | low | OPEN |
 | L-79 | 2026-09-29, L-75 | The `check_delete_safe` and `check_edit_safe` tool DESCRIPTIONS (`server.py`) enumerate their "Verdict tiers" and list none of the bounded verdicts added since: `corpus_inadequate` (#566), `name_not_searchable` (#714) and `dynamic_import_boundary` (L-70, L-75). A caller reading the tiers meets a verdict the description never named; `stop_rule` carries its meaning. A description edit re-writes every client's cached tool block, so it wants a batch, and `tests/test_schema_budget.py`'s ceiling decides the wording. | `src/jcodemunch_mcp/server.py` | drift | low | FIXED 2026-09-29 (both descriptions name every verdict `_stop_rule.known_verdicts` classifies, bound in both directions by a test; `scip_referenced` was missing too) |
 | L-80 | 2026-09-29, L-79 review | `check_delete_safe`'s `name_not_searchable` is terminal with every channel open: `build_stop_rule('check_delete_safe', 'name_not_searchable', cross_repo=True, include_runtime=True, runtime_data_present=True)` returns `terminal: True`, because the tool computes `unreachable_name` and never passes it to `build_stop_rule`. `_stop_rule.py`'s comment says the verdict "can still move either way, so it is bounded rather than terminal", and `check_delete_safe.py`'s docstring says absence of the token is not evidence of disuse. | `src/jcodemunch_mcp/tools/check_delete_safe.py`, `src/jcodemunch_mcp/tools/_stop_rule.py` | defect | medium | FIXED 2026-09-29 (`_stop_rule._UNSETTLED`: an unproven-absence verdict is never terminal whatever gaps are passed; `check_delete_safe` passes the name gap) |
-| L-81 | 2026-09-29, L-80 review | `check_delete_safe`'s dynamic-import and corpus gates fire only on `safe_to_delete` / `internal_only` / `test_coverage_only` (the corpus gate also on `dynamic_import_boundary`), so a symbol the name gate already moved to `name_not_searchable` never gets `dynamic_gap` or `corpus_gap`: its `would_change_verdict` omits "re-index this repo" and the named loaders, though the corpus gate's own comment says dropping that gap hides the re-index that could change the answer. `terminal` is correct since L-80; the next actions are incomplete. | `src/jcodemunch_mcp/tools/check_delete_safe.py` | defect | low | OPEN |
+| L-81 | 2026-09-29, L-80 review | `check_delete_safe`'s dynamic-import and corpus gates fire only on `safe_to_delete` / `internal_only` / `test_coverage_only` (the corpus gate also on `dynamic_import_boundary`), so a symbol the name gate already moved to `name_not_searchable` never gets `dynamic_gap` or `corpus_gap`: its `would_change_verdict` omits "re-index this repo" and the named loaders, though the corpus gate's own comment says dropping that gap hides the re-index that could change the answer. `terminal` is correct since L-80; the next actions are incomplete. | `src/jcodemunch_mcp/tools/check_delete_safe.py` | defect | low | FIXED 2026-09-29 (the dynamic and corpus gates run on `name_not_searchable`, which keeps its name and gains their blockers and gaps) |
 | L-82 | 2026-09-29, L-80 review | `_stop_rule._UNSETTLED` is a hand-kept list: a future bounded verdict whose meaning is an unestablished absence is not forced into it, and `tests/test_unsettled_verdicts_are_never_terminal.py` pins the current four in both directions but cannot see a fifth. Every current call
```

**File**: `src/jcodemunch_mcp/tools/check_delete_safe.py` (modified, +11/-4)
```diff
@@ -453,8 +453,13 @@ def check_delete_safe(
     # not a blocker (jjg, 2026-09-29); `get_blast_radius` discloses it.
     dynamic_gap = None
     reaching = DynamicBoundary(index.imports).reaching(target.get("file", ""))
-    if reaching and verdict in ("safe_to_delete", "internal_only", "test_coverage_only"):
-        verdict = "dynamic_import_boundary"
+    # (LEDGER L-81) `name_not_searchable` gains the gap and the blocker and
+    # keeps its name, the narrower cause; skipping it hid the loaders.
+    if reaching and verdict in (
+        "safe_to_delete", "internal_only", "test_coverage_only", "name_not_searchable",
+    ):
+        if verdict != "name_not_searchable":
+            verdict = "dynamic_import_boundary"
         dynamic_gap = {
             "action": "read the named loaders for the module names they can produce",
             "why": (
@@ -477,11 +482,13 @@ def check_delete_safe(
     # ⚠ Evaluated after the dynamic gate too: when that gate has already
     # replaced the absence verdict, a thin corpus is still a blocker and a
     # gap, and dropping it would hide the re-index that could change the
-    # answer. The dynamic verdict keeps the name; it is the narrower cause.
+    # answer. The dynamic verdict keeps the name; it is the narrower cause,
+    # and so does `name_not_searchable` (LEDGER L-81).
     if not corpus_adequacy.adequate and verdict in (
         "safe_to_delete", "internal_only", "test_coverage_only", "dynamic_import_boundary",
+        "name_not_searchable",
     ):
-        if verdict != "dynamic_import_boundary":
+        if verdict not in ("dynamic_import_boundary", "name_not_searchable"):
             verdict = "corpus_inadequate"
         corpus_gap = {
             "action": "re-index this repo",
```

**File**: `tests/test_name_not_searchable_keeps_its_other_gaps.py` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+"""`name_not_searchable` keeps every gap that could move it (LEDGER L-81).
+
+`check_delete_safe` runs three gates over an absence verdict in order: the name
+gate (#714), the dynamic-import gate (L-70) and the corpus gate (#566). The
+later two fired only on the plain absence verdicts, so a symbol the name gate
+had already moved to `name_not_searchable` never got their gaps. On a stale
+index, `would_change_verdict` named reading the call sites and left out
+"re-index this repo", although the corpus gate's own comment says dropping that
+gap hides the re-index that could change the answer. A loader that could import
+the file was dropped the same way.
+
+The verdict keeps its name: the name gate is the narrower cause, the rule the
+corpus gate already applies to `dynamic_import_boundary`. What it gains is the
+other gates' blockers and gaps.
+
+Both halves are reachable from a real repo. A C# operator reaches the name gate,
+and so does a Python function with a non-ASCII name (`def café()`), because the
+name predicate is ASCII-only (LEDGER L-83), so a package that loads its modules
+by computed name reaches the dynamic gate too. Nothing below patches the reach
+rule; only the corpus adequacy is faked, as #566's tests do, because a stale
+index needs a git history the fixture does not have.
+"""
+from __future__ import annotations
+
+import pytest
+
+from jcodemunch_mcp.tools import check_delete_safe as cds
+from jcodemunch_mcp.tools._corpus_adequacy import CorpusAdequacy
+from jcodemunch_mcp.tools.index_folder import index_folder
+
+_SOURCE = """public class Vec {
+    public static Vec operator +(Vec a, Vec b) { return a; }
+}
+"""
+_USE = """public class Use {
+    public void Go() {
+        var a = new Vec();
+        var c = a + a;
+    }
+}
+"""
+OP = "Vec.cs::Vec.operator +#method"
+
+_LOADER = "import importlib\n\ndef load(n):\n    return importlib.import_module(__name__ + '.' + n)\n"
+_UNICODE = "def café():\n    return 1\n"
+
+
+def _index(root, files):
+    for rel, text in files.items():
+        p = root / rel
+        p.parent.mkdir(parents=True, exist_ok=True)
+        p.write_text(text, encoding="utf-8")
+    storage = str(root / "idx")
+    return index_folder(path=str(root), use_ai_summaries=False, storage_path=storage)["repo"], storage
+
+
+@pytest.fixture
+def csharp(tmp_path):
+    return _index(tmp_path, {"Vec.cs": _SOURCE, "Use.cs": _USE})
+
+
+def _actions(result):
+    return [g["action"] for g in result["stop_rule"]["would_change_verdict"]]
+
+
+def _kinds(result):
+    return [b["kind"] for b in result["blockers"]]
+
+
+def test_a_stale_index_is_named_beside_the_unsearchable_name(csharp, monkeypatch):
+    r, sp = csharp
+    monkeypatch.setattr(cds, "assess_corpus", lambda index, **kw: CorpusAdequacy("stale", {}, True, ["stale_index"]))
+    got = cds.check_delete_safe(r, OP, storage_path=sp)
+    assert got["verdict"] == "name_not_searchable", got["verdict"]
+    assert "re-index this repo" in _actions(got), _actions(got)
+    assert any("call sites" in a for a in _actions(got)), _actions(got)
+    assert "corpus_inadequate" in _kinds(got), _kinds(got)
+
+
+def test_a_reaching_loader_is_named_beside_the_unsearchable_name(tmp_path):
+    r, sp = _index(tmp_path, {"pkg/__init__.py": _LOADER, "pkg/m.py": _UNICODE})
+    got = cds.check_delete_safe(r, "café", storage_path=sp)
+    assert got["verdict"] == "name_not_searchable", got["verdict"]
+    assert any("loaders" in a for a in _actions(got)), _actions(got)
+    assert any("call sites" in a for a in _actions(got)), _actions(got)
+    blocker = next((b for b in got["blockers"] if b["kind"] == "dynamic_import_boundary"), None)
+    assert blocker is not None, _kinds(got)
+    assert blocker["files"] == ["pkg/__init__.py"]
+
+
+def test_control_an_adequate_corpus_and_no_loader_add_nothing(csharp):
+    r, sp = csharp
+    got = cds.check_delete_safe(r, OP, storage_path=sp)
+    assert got["verdict"] == "name_not_searchable"
+    a
```

---

### Incident Patch 5: `c7dfcbfc` (2026-09-30)
**Commit Message**: fix: an unproven-absence verdict is never terminal, and check_delete_safe passes its name gap (LEDGER L-80) (#938)

* fix: an unproven-absence verdict is never terminal, and check_delete_safe passes its name gap (LEDGER L-80)

name_not_searchable built the gap that names what would settle it and never
passed it to build_stop_rule, so with every channel open it came back
terminal: true before a delete. _stop_rule._UNSETTLED makes every verdict
whose meaning is an unestablished absence non-terminal, whichever gaps a
caller passes; check_delete_safe now passes the name gap.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* docs: LEDGER L-81 and L-82 from the L-80 review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +21/-0)
```diff
@@ -2,6 +2,27 @@
 
 ## [Unreleased]
 
+### Fixed - `check_delete_safe` no longer tells an agent to stop checking on an unsearchable name (LEDGER L-80)
+
+`name_not_searchable` (#714) is the verdict for a symbol no call site names:
+a C# operator is invoked as `a + b`, so "no reference found" proves nothing.
+The tool built the gap that says what would settle it ("read the call sites by
+hand") and never passed it to the stop rule. With cross-repo on, runtime on
+and traces ingested, no other channel was open, and the verdict came back
+`stop_rule.terminal: true`, an instruction to stop checking before a delete
+the tool's own docstring calls unproven. #714's test asserted the opposite
+and passed only because no traces were ingested, so the runtime channel
+stayed open; the fixture could not reach the failing shape.
+
+The fix is in the stop rule, not only at the call site. `_stop_rule._UNSETTLED`
+names the verdicts whose meaning is that an absence could not be established
+(`corpus_inadequate`, `name_not_searchable` and `dynamic_import_boundary` for
+`check_delete_safe`; `dynamic_import_boundary` for `check_edit_safe`), and
+those are never terminal, whichever gaps the caller passed. A caller that
+forgets its gap now loses the specific action, which falls back to "review
+manually", and never the verdict's meaning. `check_delete_safe` also passes
+the name gap, so the action it names is reading the call sites.
+
 ### Fixed - the safety preflights' descriptions name every verdict they return (LEDGER L-79)
 
 `check_delete_safe` and `check_edit_safe` list their verdicts in the tool
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -461,6 +461,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_sql_language.py | SQL DDL (tables, views, functions, indexes, schemas) and dbt Jinja SQL extract as symbols. | `49426fd Adding dbt sql support` | 10 | LOAD-BEARING | Inline SQL fixtures only. |
 | tests/test_sqlite_store.py | SQLiteIndexStore creates schema/WAL, saves/loads/incrementally saves indexes, and cross-process mtime invalidation works. | `1950077 fix: cross-process LRU cache invalidation`; `2ff57a8 fix: report unloadable repo indexes truthfully (#291)` | 3 | LOAD-BEARING | Core store contract. |
 | tests/test_stdio_guard.py | With the stdio transport, any non-JSON-RPC write to fd 1 (C-level, subprocess, thread) is redirected to stderr. | `044c3c9 release: v1.108.268 - JSON-RPC owns a private stdout`; docstring jdoc#110 parity | 6 | LOAD-BEARING | Spawns real Python subprocesses by design; sets PYTHONPATH=src. |
+| tests/test_unsettled_verdicts_are_never_terminal.py | Every verdict in `_stop_rule._UNSETTLED` (an absence that could not be established) is non-terminal with every channel open and no gap passed, and names what would move it; `check_delete_safe`'s `name_not_searchable` is non-terminal through the tool with runtime traces present and names reading the call sites; `safe_to_delete` with every channel open stays terminal (control). | LEDGER L-80 (2026-09-29), found in the L-79 review | 1 | LOAD-BEARING | #714's `test_the_refusal_is_not_terminal` passed only because no traces were ingested; this one opens every channel. 4 of 5 mutants killed; the survivor (terminal read from a never-empty gap list) is equivalent. |
 | tests/test_stop_rule.py | build_stop_rule yields terminal=True only on positive evidence and False on every uncertainty or unknown verdict; ALREADY_CONSULTED binds to real import sites. | `2a097af feat(safety): ship an executable stop rule beside the confidence score`; docstring arXiv 2608.01347 | 9 | LOAD-BEARING | Practice 7; fail-closed on destructive verdicts. |
 | tests/test_storage.py | IndexStore save/load/has_index/list and corruption handling behave, including unloadable-index truth (#291). | `f580cd4 release: v1.108.105 — index-write lock on delta paths + load_index corruption guard`; `2ff57a8 (#291)` | 3 | LOAD-BEARING | Overlaps test_sqlite_store on save/load but covers corruption guard + has_index. |
 | tests/test_storage_path_resolution.py | A relative base_path resolves against cwd at construction, so two stores named "store" in different cwds are distinct. | `af12cf2 fix(storage): resolve relative cache paths` | 6 | LOAD-BEARING | No docstring; chdir-based; clears _VERIFIED_PATHS and _initialized_dbs. |
```

**File**: `docs/workflows/LEDGER.md` (modified, +3/-1)
```diff
@@ -128,4 +128,6 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-77 | 2026-09-29, L-74 review | `search_symbols`' module-level `_result_cache` (read by `server.py`'s session save/restore) is not cleared by `_fresh_session`, which resets the SHARED result cache through a fresh `token_tracker._State()` only. Keys are repo-scoped and most fixtures index under a per-test tmp path, so the reviewer rates the leak risk low; a test reusing a repo id across tests would read a cached answer. Named by the L-74 reviewer from source; not reproduced. | `tests/conftest.py`, `src/jcodemunch_mcp/tools/search_symbols.py` | gap | low | OPEN |
 | L-78 | 2026-09-29, pyjwt lock review | `.claude/hooks/dod_checklist.py --stamp red` records the tree at STAMP time, not the tree the red run measured, so a lock-only change (red = the dependency audit on main's lock, run with the branch's lock stashed) stamps red and green with the same `content_tree` and DoD 1 reads `n.a.` though a red/green pair exists. The pyjwt PR's red was reproduced by its reviewer instead. The commit hook also wrote no `fast.md` for that lock-only commit. | `.claude/hooks/dod_checklist.py`, `.claude/hooks/pre_commit.py` | gap | low | OPEN |
 | L-79 | 2026-09-29, L-75 | The `check_delete_safe` and `check_edit_safe` tool DESCRIPTIONS (`server.py`) enumerate their "Verdict tiers" and list none of the bounded verdicts added since: `corpus_inadequate` (#566), `name_not_searchable` (#714) and `dynamic_import_boundary` (L-70, L-75). A caller reading the tiers meets a verdict the description never named; `stop_rule` carries its meaning. A description edit re-writes every client's cached tool block, so it wants a batch, and `tests/test_schema_budget.py`'s ceiling decides the wording. | `src/jcodemunch_mcp/server.py` | drift | low | FIXED 2026-09-29 (both descriptions name every verdict `_stop_rule.known_verdicts` classifies, bound in both directions by a test; `scip_referenced` was missing too) |
-| L-80 | 2026-09-29, L-79 review | `check_delete_safe`'s `name_not_searchable` is terminal with every channel open: `build_stop_rule('check_delete_safe', 'name_not_searchable', cross_repo=True, include_runtime=True, runtime_data_present=True)` returns `terminal: True`, because the tool computes `unreachable_name` and never passes it to `build_stop_rule`. `_stop_rule.py`'s comment says the verdict "can still move either way, so it is bounded rather than terminal", and `check_delete_safe.py`'s docstring says absence of the token is not evidence of disuse. | `src/jcodemunch_mcp/tools/check_delete_safe.py`, `src/jcodemunch_mcp/tools/_stop_rule.py` | defect | medium | OPEN |
+| L-80 | 2026-09-29, L-79 review | `check_delete_safe`'s `name_not_searchable` is terminal with every channel open: `build_stop_rule('check_delete_safe', 'name_not_searchable', cross_repo=True, include_runtime=True, runtime_data_present=True)` returns `terminal: True`, because the tool computes `unreachable_name` and never passes it to `build_stop_rule`. `_stop_rule.py`'s comment says the verdict "can still move either way, so it is bounded rather than terminal", and `check_delete_safe.py`'s docstring says absence of the token is not evidence of disuse. | `src/jcodemunch_mcp/tools/check_delete_safe.py`, `src/jcodemunch_mcp/tools/_stop_rule.py` | defect | medium | FIXED 2026-09-29 (`_stop_rule._UNSETTLED`: an unproven-absence verdict is never terminal whatever gaps are passed; `check_delete_safe` passes the name gap) |
+| L-81 | 2026-09-29, L-80 review | `check_delete_safe`'s dynamic-import and corpus gates fire only on `safe_to_delete` / `internal_only` / `test_coverage_only` (the corpus gate also on `dynamic_import_boundary`), so a symbol the name gate already moved to `name_not_searchable` never gets `dynamic_gap` or `corpus_gap`: its `would_change_verdict` omits "re-index this repo" and the named loaders, though the corpus gate's own comment says dropping that gap hides the re-index that co
```

**File**: `src/jcodemunch_mcp/tools/_stop_rule.py` (modified, +35/-0)
```diff
@@ -84,6 +84,23 @@
     }),
 }
 
+# (LEDGER L-80) Bounded verdicts whose MEANING is that the absence could not
+# be established. They are never terminal, whichever gaps the caller passed:
+# `name_not_searchable` built its gap and never handed it over, so with every
+# channel open it came back terminal, telling an agent to stop checking before
+# a delete on a claim the tool calls "not evidence of disuse". A gap a caller
+# forgets now costs the specific action, never the verdict's meaning.
+_UNSETTLED = {
+    "check_delete_safe": frozenset({
+        "corpus_inadequate",
+        "name_not_searchable",
+        "dynamic_import_boundary",
+    }),
+    "check_edit_safe": frozenset({
+        "dynamic_import_boundary",
+    }),
+}
+
 # Tools whose evidence is already folded into each verdict. Named in the tool
 # DESCRIPTION so an agent does not re-derive them, not in the response.
 ALREADY_CONSULTED = {
@@ -104,6 +121,7 @@ def _channel_gaps(
     runtime_data_present: bool,
     corpus_gap: Optional[dict] = None,
     dynamic_gap: Optional[dict] = None,
+    name_gap: Optional[dict] = None,
 ) -> list[dict]:
     """Evidence channels that could still move a bound-style verdict."""
     gaps: list[dict] = []
@@ -116,6 +134,10 @@ def _channel_gaps(
     # channel below can supply: only reading the loader settles it.
     if dynamic_gap:
         gaps.append(dynamic_gap)
+    # (#714, LEDGER L-80) A name no call site writes: only reading the call
+    # sites settles it, and no channel below can.
+    if name_gap:
+        gaps.append(name_gap)
     if not cross_repo:
         gaps.append({
             "action": "re-run with cross_repo=true",
@@ -146,6 +168,7 @@ def build_stop_rule(
     runtime_data_present: bool,
     corpus_gap: Optional[dict] = None,
     dynamic_gap: Optional[dict] = None,
+    name_gap: Optional[dict] = None,
 ) -> dict:
     """Return the ``stop_rule`` block for one verdict.
 
@@ -163,8 +186,20 @@ def build_stop_rule(
         runtime_data_present=runtime_data_present,
         corpus_gap=corpus_gap,
         dynamic_gap=dynamic_gap,
+        name_gap=name_gap,
     )
 
+    if verdict in _UNSETTLED.get(tool, frozenset()):
+        if not gaps:
+            gaps = [{
+                "action": "review manually",
+                "why": (
+                    f"verdict {verdict!r} means the absence could not be "
+                    "established, and no channel that settles it was named"
+                ),
+            }]
+        return {"terminal": False, "would_change_verdict": gaps}
+
     if verdict in _BOUNDED.get(tool, frozenset()):
         return {"terminal": not gaps, "would_change_verdict": gaps}
 
```

**File**: `src/jcodemunch_mcp/tools/check_delete_safe.py` (modified, +1/-0)
```diff
@@ -623,6 +623,7 @@ def check_delete_safe(
             runtime_data_present=runtime_data_present,
             corpus_gap=corpus_gap,
             dynamic_gap=dynamic_gap,
+            name_gap=unreachable_name,
         ),
         "corpus_adequacy": corpus_adequacy.as_dict(),
         "signals": {
```

---

### Incident Patch 6: `d38495a1` (2026-09-30)
**Commit Message**: fix: the safety preflights' descriptions name every verdict they return (LEDGER L-79) (#937)

* fix: the safety preflights' descriptions name every verdict they return (LEDGER L-79)

check_delete_safe's description listed eight verdicts and it returns twelve;
check_edit_safe's listed five of six. scip_referenced, corpus_inadequate,
name_not_searchable and dynamic_import_boundary were classified in
_stop_rule.py and never named. A new test binds each description's
"Verdict tiers" list to _stop_rule.known_verdicts in both directions.
+23 tokens under standard and full; core and counter unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* docs: the README says a bounded preflight verdict is never terminal (LEDGER L-79)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix: README names only the two bounded verdicts that are never terminal; the ratchet scans every tier list (L-79 review)

name_not_searchable is terminal with every channel open, so the class
framing was false for one member; that is LEDGER L-80. The test now finds
every published "Verdict tiers:" list rather than only registered tools.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>


**File**: `CHANGELOG.md` (modified, +19/-0)
```diff
@@ -2,6 +2,25 @@
 
 ## [Unreleased]
 
+### Fixed - the safety preflights' descriptions name every verdict they return (LEDGER L-79)
+
+`check_delete_safe` and `check_edit_safe` list their verdicts in the tool
+description, and the list stopped growing when the verdicts did. Four of
+`check_delete_safe`'s and one of `check_edit_safe`'s were classified in
+`_stop_rule.py`, returned to callers, and absent from the description a caller
+reads first: `scip_referenced`, `corpus_inadequate` (#566), `name_not_searchable`
+(#714) and `dynamic_import_boundary` (L-70, L-75). The LEDGER row named three;
+the ratchet found `scip_referenced` too, missing since v1.108.120.
+
+Nothing bound the prose to the verdicts. `test_stop_rule` binds the verdicts a
+tool assigns to `known_verdicts`, and
+`tests/test_preflight_descriptions_name_every_verdict.py` now binds
+`known_verdicts` to the published description in both directions, so a tier
+added or retired fails until the description says so. The descriptions grow
+by 23 tokens under `standard` and `full`; `core` and `counter` do not carry
+these tools and did not move (`benchmarks/schema_baseline.json`, re-pinned in
+`harness/corpora.json`).
+
 ### Fixed - `check_edit_safe` does not certify an edit past a dynamic import (LEDGER L-75)
 
 `check_edit_safe` answers "what breaks if I change this" from `find_importers`'
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ src/jcodemunch_mcp/
     _scip_consume.py   # (v1.108.118) Shared SCIP-evidence reader for the graph consumers (P2): open_scip_reader (mode=ro, honest-None when scip_edges absent/empty incl. pre-v17) + scip_meta_and_stale + scip_meta_block. Used by get_blast_radius._attach_scip_to_blast + get_call_hierarchy._attach_scip_to_hierarchy
     get_pr_risk_profile.py    # get_pr_risk_profile: unified PR/branch risk assessment — fuses blast radius + complexity + churn + test gaps + volume into composite score. Phase 7: when runtime traces have been ingested, adds a 6th signal (runtime_traffic; W=0.15 with the static five rebalanced to 0.85 of their original weights) plus a runtime_dark_code_introduced flag for PRs that add code in files with zero runtime evidence. Static-only callers (no traces) keep the historical 5-signal mix bit-for-bit.
     find_dead_code.py         # ⚠⚠ **`_ENTRY_POINT_FILENAMES` is Python and nothing else** -- eleven `.py` names plus `Makefile` -- so on a JS repo it names NOTHING (#562). Framework roots come from `_entry_points.entry_point_spec`, never from this list. ⚠⚠ **`_TOOLCHAIN_MANIFESTS`**: nothing imports a lockfile BY DESIGN, so `zero_importers` is a tautology there -- `pnpm-lock.yaml`, `tsconfig.json` and `package.json` were reported dead, the last by the same run that READS it to find entry points. **Excluded by NAME, never by extension**: an orphaned `data/fixtures.json` is a real finding and must keep being reported. `Makefile` was already in the set above for exactly this reason.
-    check_delete_safe.py      # check_delete_safe: composite preflight — can this symbol be deleted? Combines find_importers (cross_repo) + check_references + find_dead_code + runtime evidence + entry-point heuristics into a single verdict (safe_to_delete / test_coverage_only / internal_only / internal_uses_blocking / external_uses_blocking / cross_repo_blocking / runtime_observed / entry_point) plus top-5 blockers ranked by severity plus a one-line recommended_action. Read-only. Pairs with check_rename_safe for the rename-and-delete refactor flows. v1.104.1: track test_import_count separately from external_import_count so test-only consumption correctly downgrades to test_coverage_only. v1.108.6: honest-hint caveat — when `safe_to_delete` is reached AND `include_runtime=True` AND no traces are ingested for the repo (`_runtime_data_present()` returns False), the `recommended_action` surfaces that the verdict rests on static signals only and points at `import-trace`. `signals.runtime_data_present` surfaced for callers to introspect. Back-ported from `check_column_drop_safe` in jdatamunch-mcp v1.8.0. ⚠⚠ **(#566) THE DESTRUCTIVE SURFACE OF THE ABSENCE-CLAIM DEFECT, and it needed its own fix**: the "no refs at all" fallback reaches `safe_to_delete` **regardless of `dead_code_conf`** and then FLOORS the confidence at 0.85, so capping `find_dead_code` alone left a delete certified over a corpus that could not support it -- the twelve `encoding/schemas` encoders of #569 have no refs at all and each graded safe at 0.85. `corpus_inadequate` is the verdict; classified in `_stop_rule._BOUNDED` and never terminal, with `corpus_gap` naming re-indexing. ⚠ **Only the ABSENCE verdicts are replaced** -- a found importer is positive evidence and a thin corpus cannot unfind it, the same asymmetry `_HARD_BLOCKER` encodes. ⚠⚠ `assess_corpus` is imported at MODULE level HERE deliberately: a function-local import resolves through `_corpus_adequacy`'s globals, so patching it in this module would silently do nothing (the `cli/policy.py` trap; found by a test that patched the name and watched the verdict not move).
+    check_delete_safe.py      # check_delete_safe: composite preflight — can this symbol be deleted? Combines find_importers (cross_repo) + check_references + find_dead_code + runtime evidence + entry-point heuristics into a single verdict (safe_to_delete / test_coverage_only / internal_only / internal_uses_blocki
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -149,7 +149,7 @@ Want to skip initial indexing for popular frameworks? Pre-built **starter packs*
 - **Retrieve one symbol instead of loading a file.** `get_symbol_source` returns the exact function body, byte-precise, for the majority of edits that touch one function in a 700-line file (~95% savings on that read).
 - **Assemble a whole task's context in one call.** `assemble_task_context` classifies the task intent, extracts anchor symbols, and runs the right tool sequence under one token budget. `plan_turn` routes the turn before the first read.
 - **Ask structural questions grep can't answer.** `find_importers`, `get_blast_radius`, `get_call_hierarchy`, `find_dead_code`, `get_changed_symbols`, `get_hotspots`, `search_ast` anti-pattern sweeps, and more. Two of them sound alike and are not: `check_references` answers where a name is used (import sites plus every file whose content mentions it), `find_references` answers who imports it, over the import graph alone, so a call site is invisible to it.
-- **Preflight risky changes, and know when to stop.** `check_edit_safe`, `check_delete_safe`, `get_pr_risk_profile`, and `plan_refactoring` with edit-ready `{old_text, new_text}` blocks. The two safety checks return `stop_rule.terminal`: true means no further jcodemunch call moves the verdict, so re-running `find_importers` or `check_references` to be sure is wasted work. It means final, not safe. `check_rename_safe` answers `safe: null` rather than `true` when the import graph could not reach the symbol's file, so the files that use it were never checked, and `get_pr_risk_profile` answers `risk_score: null` with `unmeasurable_axes` when it could not measure the blast axis; a CI gate should fail on null. Hand the server your type checker's own output (`jcodemunch-mcp import-trace --diagnostics <file>`: `mypy --output json`, `pyright --outputjson`, `tsc --pretty false`, `ruff --output-format json`) and `check_edit_safe`, `get_changed_symbols`, `get_pr_risk_profile` and `get_symbol_provenance` say which symbols the checker already flags, as of which commit. Nothing runs a checker for you. False names the specific thing that would change the answer.
+- **Preflight risky changes, and know when to stop.** `check_edit_safe`, `check_delete_safe`, `get_pr_risk_profile`, and `plan_refactoring` with edit-ready `{old_text, new_text}` blocks. The two safety checks return `stop_rule.terminal`: true means no further jcodemunch call moves the verdict, so re-running `find_importers` or `check_references` to be sure is wasted work. It means final, not safe. `corpus_inadequate` (the index could not back an absence claim) and `dynamic_import_boundary` (a dynamic import can load the file) are never terminal, and each tool's description lists every verdict it returns. `check_rename_safe` answers `safe: null` rather than `true` when the import graph could not reach the symbol's file, so the files that use it were never checked, and `get_pr_risk_profile` answers `risk_score: null` with `unmeasurable_axes` when it could not measure the blast axis; a CI gate should fail on null. Hand the server your type checker's own output (`jcodemunch-mcp import-trace --diagnostics <file>`: `mypy --output json`, `pyright --outputjson`, `tsc --pretty false`, `ruff --output-format json`) and `check_edit_safe`, `get_changed_symbols`, `get_pr_risk_profile` and `get_symbol_provenance` say which symbols the checker already flags, as of which commit. Nothing runs a checker for you. False names the specific thing that would change the answer.
 - **Trust the answers.** Calibrated confidence scores, freshness flags, coverage contracts on absence claims, compiler-verified references via SCIP import, and automatic secret redaction before anything reaches the LLM.
 - **Keep the index fresh automatically.** Watch modes, agent hooks, and a VS Code extension close the staleness gap.
 
```

**File**: `benchmarks/schema_baseline.json` (modified, +4/-4)
```diff
@@ -1,10 +1,10 @@
 {
   "core_compact": 3971,
   "core_full": 6024,
-  "standard_compact": 20006,
-  "standard_full": 22379,
-  "full_compact": 21540,
-  "full_full": 23913,
+  "standard_compact": 20029,
+  "standard_full": 22402,
+  "full_compact": 21563,
+  "full_full": 23936,
   "counter_compact": 945,
   "counter_full": 945
 }
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -97,6 +97,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_a_dynamic_import_is_an_edge_or_a_named_boundary.py | The reported shape (a literal passed into `_passthrough`'s `__import__(module_name)`) makes `cli.py` a dependent of `run_g_gates.main`; `__import__("x")` and `importlib.import_module("x")` are edges; one-step propagation works by position and keyword; a subscript into a module-level literal table follows its path and never yields keys; a loop over a literal sequence is a set of edges; a method feeder skips `self`; an opaque target is DISCLOSED beside an empty blast (`dynamic_imports_unfollowed`) and keeps `absent`; a literal module prefix and a package-relative target (the #569 shape) refuse only inside their package; a public loader with no in-file caller is an opaque site; an unparseable file is no site; controls: no dynamic import, and a fully resolved one, both keep `absent`; `PARSER_GENERATION >= 9`. Red against main: 13 failed, 4 passed (the two controls and two no-site cases main satisfies trivially); the review arms: 8 failed on the round-0 fix. | #876 (2026-09-29), reported by @Torolosko | 1 | LOAD-BEARING | ⚠⚠ Fixed at the import AUTHORITY, so every graph consumer inherits the edges; the refusal lives in `blast_verdict`, the one authority on a walk. ⚠⚠ Review measured the first draft refusing EVERY empty Python blast on this repo (sites in tests/ and benchmarks/ too, not only src/). The ruling (jjg, 2026-09-29): only a scope that reaches the file refuses; an opaque site is disclosed. `dynamic-sites.txt` in the run's evidence has the per-scope census. ⚠ The unresolved marker's specifier resolves to nothing, so every other consumer skips it. |
 | tests/test_dead_code_reads_the_dynamic_import_boundary.py | The three dead-code tools read #876's dynamic-import boundary: a file a prefix-scoped `import_module(f"adapters.{name}")` can load is withheld by `find_dead_code` at the default threshold and, with `min_confidence=0`, capped at the unproven ceiling with `dynamic_import_boundary` in `confidence_capped_by` and the site named; `get_dead_code_v2` leaves `unreachable_file` undecided for it and keeps `no_callers`, measures signal 1's rate only where it was decided, and a repo-root loader cannot turn a withheld health grade into a published one; `check_delete_safe` returns the bounded verdict `dynamic_import_boundary` naming the loader, never terminal with every other channel closed; the deletion investigator answers `not_established`, never `static_clear`. An opaque site is disclosed as `dynamic_imports_unfollowed` and caps nothing; a file no site reaches keeps confidence 1.0. | LEDGER L-70 (2026-09-29), found in #876 | 1 | LOAD-BEARING | ⚠⚠ The reach rule is `tools/_dynamic_boundary.py`, shared with `get_blast_radius`: before it the same module was "cannot prove nothing depends on it" in the blast radius and "provably unreachable, 1.0" plus `safe_to_delete` here. The measurement on this repo is `l70-measure.txt` in the run's evidence. |
 | tests/test_find_importers_discloses_the_dynamic_boundary.py | `find_importers` names a package- or prefix-scoped dynamic import that can load the file in a `dynamic_import_boundary` block, in singular and batch mode, whatever the static count, and never counts it as an importer; an opaque site is disclosed as `dynamic_imports_unfollowed` beside an empty answer no scoped site qualifies, as `get_blast_radius` does (once per batch); both survive the compact encoder; the deletion investigator does not call a loadable importer dead. | LEDGER L-73 (2026-09-29), found in L-70 review | 1 | LOAD-BEARING | ⚠⚠ The investigator's liveness split read `importer_count: 0` as unreachable and offered a helper for deletion in a dead cluster (`static_clear`) when its only importer was a loadable module. An undeclared dict is dropped by the compact encoder, so the schema test is the half a dispatcher-free test cannot see. |
+| tests/test_prefli
```

---

### Incident Patch 7: `1132a5dc` (2026-09-29)
**Commit Message**: fix: check_edit_safe does not certify an edit past a dynamic import (LEDGER L-75) (#936)

* fix: check_edit_safe does not certify an edit past a dynamic import (LEDGER L-75)

check_edit_safe graded a function in a module a scoped dynamic import can
load `safe_to_edit` ("no external callers") while the loader calls into it at
runtime; L-70 and L-73 had closed the same gap in check_delete_safe and
find_importers. It now reads find_importers' dynamic_import_boundary block:
safe_to_edit becomes the bounded verdict dynamic_import_boundary at the
unproven ceiling, names the loaders, and passes the loader to the stop rule;
a verdict backed by positive evidence keeps its name and gains the blocker.

Measured on this repo: 167 of 392 functions in reached files moved
safe_to_edit -> dynamic_import_boundary, nothing else moved. LEDGER L-79
records that neither preflight's description lists its bounded verdicts.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix: check_edit_safe's untested verdict is never terminal past a loader either (L-75 review)

untested rests on the same "no external caller" claim as safe_to_edit,
because signature_impact outranks it, and it still published 

**File**: `CHANGELOG.md` (modified, +30/-0)
```diff
@@ -2,6 +2,36 @@
 
 ## [Unreleased]
 
+### Fixed - `check_edit_safe` does not certify an edit past a dynamic import (LEDGER L-75)
+
+`check_edit_safe` answers "what breaks if I change this" from `find_importers`'
+list, and it did not read #876's dynamic-import boundary. So a function in a
+module `import_module(f"adapters.{name}")` can load graded `safe_to_edit`,
+"no external callers", while the loader calls into it at runtime. L-70 and
+L-73 had closed the same gap in the delete preflight and the importer list.
+
+It now reads the `dynamic_import_boundary` block `find_importers` returns (one
+reach rule, `tools/_dynamic_boundary.py`). A function that would have graded
+`safe_to_edit` grades the bounded verdict `dynamic_import_boundary` instead.
+Its confidence is capped at the unproven ceiling and never reads safer than
+`untested`, and it names the loaders, saying how many a capped list left
+out. The loader is a gap in `stop_rule`, so the verdict is never terminal.
+`untested` rests on the same "no external caller" claim, because
+`signature_impact` outranks it, so it keeps its name and is never terminal
+past a loader either. `complexity_risk`, `signature_impact` and
+`runtime_critical` rest on positive evidence and keep their names, gaining
+the loader as a blocker; `signals.dynamic_loader_count` survives the top-5
+blocker cut. An opaque site blocks nothing (#876).
+
+Measured on this repository (`l75-measure.txt`, one index, main's source and
+this branch's, every function and method in a file a scoped site reaches):
+167 of 392 moved from `safe_to_edit` to `dynamic_import_boundary`, and no other
+verdict moved. The reached files are the encoder schemas
+`encoding/schemas/registry.py` loads by package, the context providers and
+the competitive adapters, each named by the loader that reaches it. The tool
+description's verdict list is unchanged, as `check_delete_safe`'s was for
+its three bounded verdicts; that drift is LEDGER L-79.
+
 ### Fixed - `find_importers` names the dynamic import that can load a file (LEDGER L-73)
 
 L-70 made every absence tool read #876's dynamic-import boundary, and
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -147,7 +147,7 @@ src/jcodemunch_mcp/
   groq/
   parser/
     complexity.py      # cyclomatic / max_nesting / param_count from body TEXT, no AST. ⚠⚠ **`max_nesting` is `max(bracket_channel, indent_channel)` and BOTH are required.** Brackets alone cannot see Python control flow — `if`/`for`/`while` open a block with a colon and contribute NO bracket depth, so the field reported the deepest EXPRESSION under the same name (`index_folder`: brackets 3, AST truth 6, an underreport by HALF that supported the OPPOSITE conclusion about the symbol). Indentation alone cannot see MINIFIED code, which has none. Max can only RAISE a depth, so brace languages are unmeasured-by-neither and unchanged. ⚠ `max_nesting` is REPORTED (get_symbol_complexity / get_hotspots / get_extraction_candidates / get_pr_risk_profile) and SCORED NOWHERE — `hotspot_score` and `_complexity_assessment` use cyclomatic alone, so correcting it moves no grade. ⚠⚠ A literal BACKSPACE (0x08) once replaced `` in the opener regex and **compiled, ran and passed ruff**; `tests/test_nesting_depth_channels.py` pins the boundary behaviourally and scans for stray control characters
-    imports.py         # Regex import extraction (19 languages); extract_imports(), resolve_specifier(), build_psr4_map(). ⚠⚠ **`_JS_SPECIFIER_REWRITES` exists because a TS specifier names the EMITTED file, not the source**: `.mts` is imported as `./foo.mjs` and `.cts` as `./foo.cjs`, extensions that are NEVER on disk. Adding an extension to `LANGUAGE_EXTENSIONS` without its rewrite entry makes the file visible and its importers invisible -- which reads downstream as a file nobody imports, i.e. #550 in a new costume. The `.js -> .ts/.tsx` rule predates the table and is unchanged; `test_ts_module_extensions.py` asserts that byte-for-byte ⚠⚠ **`_tsconfig_skip_dirs()` DERIVES from `security._SKIP_DIRECTORY_NAMES` (#557)** -- it was the FOURTH copy of a skip list in this tree and the only one deriving from nothing, so `_walk_tsconfigs` descended into Rust's `target/` on every watcher event (**13.58s of a 13.75s reindex, 0.27s once excluded**). **Add a spelling to the AUTHORITY, never here.** ⚠ **UNION with `_TSCONFIG_EXTRA_SKIP_DIRS`, never replacement**: `out` is deliberately absent from the authority (the "DOTTED ONLY" rule -- it names a real source dir for the INDEXING walk) but has been skipped for tsconfig discovery for this function's whole life, and **removing a skip is the one direction this may not go**. ⚠ Imported lazily: `security` imports `config`, and resolving that at module scope would put a parser module in the chain for no benefit. ⚠⚠ **(#876) A Python dynamic import is an edge** (literal, one-step literal parameter, literal table) or a `<dynamic-import>` marker edge with `dynamic_unresolved` and a `dynamic_scope` (`package` / `prefix:<m>` / `opaque`); only a scope that reaches the file refuses, an opaque one is DISCLOSED (jjg, 2026-09-29); the marker resolves to nothing; `tools/_dynamic_boundary.py` is THE reach rule, and `blast_verdict`, `find_dead_code`, `get_dead_code_v2`, `check_delete_safe`, the deletion investigator and `find_importers` all read it (L-70, L-73); a reached file is UNDECIDED, never an entry point, and its loaders are never counted as importers. A change here changes `files.imports` on unchanged content: bump `PARSER_GENERATION`.
+    imports.py         # Regex import extraction (19 languages); extract_imports(), resolve_specifier(), build_psr4_map(). ⚠⚠ **`_JS_SPECIFIER_REWRITES` exists because a TS specifier names the EMITTED file, not the source**: `.mts` is imported as `./foo.mjs` and `.cts` as `./foo.cjs`, extensions that are NEVER on disk. Adding an extension to `LANGUAGE_EXTENSIONS` without its rewrite entry makes the file visible and its importers invisible -- which reads downstream as a file nobody imports, i.e. #550 in a new costume. The `.js -> .ts/.tsx` rule predates the table and is unchanged; `test_ts_module_extensions.py` asserts that byte-for-byte
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -97,6 +97,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_a_dynamic_import_is_an_edge_or_a_named_boundary.py | The reported shape (a literal passed into `_passthrough`'s `__import__(module_name)`) makes `cli.py` a dependent of `run_g_gates.main`; `__import__("x")` and `importlib.import_module("x")` are edges; one-step propagation works by position and keyword; a subscript into a module-level literal table follows its path and never yields keys; a loop over a literal sequence is a set of edges; a method feeder skips `self`; an opaque target is DISCLOSED beside an empty blast (`dynamic_imports_unfollowed`) and keeps `absent`; a literal module prefix and a package-relative target (the #569 shape) refuse only inside their package; a public loader with no in-file caller is an opaque site; an unparseable file is no site; controls: no dynamic import, and a fully resolved one, both keep `absent`; `PARSER_GENERATION >= 9`. Red against main: 13 failed, 4 passed (the two controls and two no-site cases main satisfies trivially); the review arms: 8 failed on the round-0 fix. | #876 (2026-09-29), reported by @Torolosko | 1 | LOAD-BEARING | ⚠⚠ Fixed at the import AUTHORITY, so every graph consumer inherits the edges; the refusal lives in `blast_verdict`, the one authority on a walk. ⚠⚠ Review measured the first draft refusing EVERY empty Python blast on this repo (sites in tests/ and benchmarks/ too, not only src/). The ruling (jjg, 2026-09-29): only a scope that reaches the file refuses; an opaque site is disclosed. `dynamic-sites.txt` in the run's evidence has the per-scope census. ⚠ The unresolved marker's specifier resolves to nothing, so every other consumer skips it. |
 | tests/test_dead_code_reads_the_dynamic_import_boundary.py | The three dead-code tools read #876's dynamic-import boundary: a file a prefix-scoped `import_module(f"adapters.{name}")` can load is withheld by `find_dead_code` at the default threshold and, with `min_confidence=0`, capped at the unproven ceiling with `dynamic_import_boundary` in `confidence_capped_by` and the site named; `get_dead_code_v2` leaves `unreachable_file` undecided for it and keeps `no_callers`, measures signal 1's rate only where it was decided, and a repo-root loader cannot turn a withheld health grade into a published one; `check_delete_safe` returns the bounded verdict `dynamic_import_boundary` naming the loader, never terminal with every other channel closed; the deletion investigator answers `not_established`, never `static_clear`. An opaque site is disclosed as `dynamic_imports_unfollowed` and caps nothing; a file no site reaches keeps confidence 1.0. | LEDGER L-70 (2026-09-29), found in #876 | 1 | LOAD-BEARING | ⚠⚠ The reach rule is `tools/_dynamic_boundary.py`, shared with `get_blast_radius`: before it the same module was "cannot prove nothing depends on it" in the blast radius and "provably unreachable, 1.0" plus `safe_to_delete` here. The measurement on this repo is `l70-measure.txt` in the run's evidence. |
 | tests/test_find_importers_discloses_the_dynamic_boundary.py | `find_importers` names a package- or prefix-scoped dynamic import that can load the file in a `dynamic_import_boundary` block, in singular and batch mode, whatever the static count, and never counts it as an importer; an opaque site is disclosed as `dynamic_imports_unfollowed` beside an empty answer no scoped site qualifies, as `get_blast_radius` does (once per batch); both survive the compact encoder; the deletion investigator does not call a loadable importer dead. | LEDGER L-73 (2026-09-29), found in L-70 review | 1 | LOAD-BEARING | ⚠⚠ The investigator's liveness split read `importer_count: 0` as unreachable and offered a helper for deletion in a dead cluster (`static_clear`) when its only importer was a loadable module. An undeclared dict is dropped by the compact encoder, so the schema test is the half a dispatcher-free test cannot see. |
+| tests/test_check_
```

**File**: `docs/workflows/LEDGER.md` (modified, +2/-1)
```diff
@@ -123,7 +123,8 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-72 | 2026-09-29, harness F-19 | A FAILING bench run uploads the wrong `self_latency.json`. `harness/__main__.py` copies a step's scratch artifact into the tree only when `rc == 0` and deletes the scratch copy either way, while `pr-gate.yml` and `main.yml` upload `harness/results/self_latency.json` under `if: always()`. So a red run's artifact is the TRACKED copy from the last weekly bench commit, named after the failing SHA. Measured on #922's failed attempt (run 36464454301, job 109076146863): the log says `get_symbol_source_warm_p95_ms` observed 116.3 FAIL; artifact 10988643704 holds `commit e83178e0` and 1.6, identical to the tracked file at aeb43e50, with no `*_resampled` keys. The measurement F-19 needs, including whether #920's re-sample ran, is destroyed on exactly the runs that fail. Candidate: on `rc != 0` keep the scratch artifact beside the tracked one (for example `self_latency.failed.json`) and upload it; never write it over the tracked file. Found while recording F-19's thirteenth occurrence. | `harness/__main__.py`, `.github/workflows/pr-gate.yml`, `.github/workflows/main.yml`, `.github/workflows/nightly.yml` | defect | medium | FIXED 2026-09-29 (a failed step's measurement rides in `latest.json` as `measurement` and, under `--write-results`, in `self_latency.failed.json`, which pr-gate, main and nightly upload; the tracked file is never overwritten) |
 | L-73 | 2026-09-29, L-70 review round 1 | `find_importers` answers `importer_count: 0` for a file a package- or prefix-scoped dynamic import can load, with no disclosure: the #876 boundary that `get_blast_radius` refuses on and the dead-code tools now read (`tools/_dynamic_boundary.py`) is absent from its response. It reports edges, not an absence verdict, so the fix is a disclosure field, not a cap. Measured: `scratchpad/l70review/dsprobe.py`, `adapters/alpha.py` under `import_module(f'adapters.{name}')` returns 0 importers and no dynamic key. | `src/jcodemunch_mcp/tools/find_importers.py` | gap | low | FIXED 2026-09-29 (`dynamic_import_boundary` block, opaque disclosure on an empty answer, both in the compact encoder; the investigator's liveness split reads it) |
 | L-74 | 2026-09-29, #932 CI | `tests/test_session_state_does_not_leak_between_tests.py::test_a_result_cache_hit_answers_with_the_cold_calls_key_set[search_symbols-args0]` failed once on `full: test (ubuntu-latest, 3.13)` (run 36588176655, job 109474658601; the re-run passed): the warm call carried a top-level `budget_warning`. `tools/turn_budget.get_turn_budget()` is a process singleton (`turn_budget_tokens` default 20000, 30 s turn gap) and `tests/conftest.py`'s per-test session reset (#801) does not reset it, so calls through `server.call_tool` on one xdist worker accumulate into one turn and whichever test crosses 80% gains the key. Cause read from source, not yet reproduced locally. | `tests/conftest.py`, `src/jcodemunch_mcp/tools/turn_budget.py` | flake | low | FIXED 2026-09-29 (`tests/conftest.py` `_fresh_session` clears `turn_budget._budget` and, found by the same question, `session_journal._journal`, whose negative evidence `plan_turn` cites; reproduced as a file-ordered pair: the next test started at 95.9% of the budget) |
-| L-75 | 2026-09-29, L-73 | `check_edit_safe` reads `find_importers`' list for signature impact and does not read the #876 dynamic-import boundary, so a symbol in a file a scoped loader can reach grades `safe_to_edit` although the loader calls it at runtime. Reading it would move verdicts on this repo (the competitive adapters under `benchmarks/competitive/adapters/`, which one test file loads by prefix), so it needs a measurement before it ships. Found in L-73. | `src/jcodemunch_mcp/tools/check_edit_safe.py` | gap | low | OPEN |
+| L-75 | 2026-09-29, L-73 | `check_edit_safe` reads `find_importers`' list for signature impact and does not read the #876 dynamic-import boun
```

**File**: `src/jcodemunch_mcp/tools/_stop_rule.py` (modified, +3/-0)
```diff
@@ -78,6 +78,9 @@
     "check_edit_safe": frozenset({
         "safe_to_edit",
         "untested",
+        # (LEDGER L-75) safe_to_edit's absence claim, unproven past a dynamic
+        # import that can load the file. Reading the loader can move it.
+        "dynamic_import_boundary",
     }),
 }
 
```

---

### Incident Patch 8: `1599c6e0` (2026-09-29)
**Commit Message**: fix: pyjwt 2.15.1 in the lock, clearing GHSA-w6j9-cwv2-h6wq (fast: dependency audit) (#935)

The required `fast: dependency audit` check (Floor deps.vuln_max <= 0)
began failing on every PR on 2026-09-29 with a new advisory against the
locked pyjwt 2.13.0 (fixed in 2.14.0); first seen on #934. pyjwt is a
transitive dependency; nothing in src/ or tests/ imports it.

Only the pyjwt package block changes. `uv lock --upgrade-package pyjwt`
under CI's pinned uv 0.9.5 also rewrote the nvidia markers (the older-uv
hazard in the release skill), so the regenerated block was spliced into
main's lock by hand; `uv@0.9.5 lock --check` accepts the result.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -2261,14 +2261,14 @@ wheels = [
 
 [[package]]
 name = "pyjwt"
-version = "2.13.0"
+version = "2.15.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz", hash = "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423", size = 107515, upload-time = "2026-05-21T19:54:36.618Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz", hash = "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8", size = 121252, upload-time = "2026-09-28T18:40:42.598Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl", hash = "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728", size = 31274, upload-time = "2026-05-21T19:54:35.362Z" },
+    { url = "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl", hash = "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193", size = 33860, upload-time = "2026-09-28T18:40:41.429Z" },
 ]
 
 [package.optional-dependencies]
```

---

### Incident Patch 9: `2d6a1b3c` (2026-09-29)
**Commit Message**: fix: find_importers names the dynamic import that can load a file (LEDGER L-73) (#933)

* fix: find_importers names the dynamic import that can load a file (LEDGER L-73)

For a module a scoped dynamic import can load, find_importers answered
importer_count 0 with nothing beside it, while get_blast_radius refused to
call the same file unreferenced. It now names the loaders in a
dynamic_import_boundary block (never counted as importers) and discloses an
opaque site beside an empty answer, in both modes and through the compact
encoder, which dropped an undeclared dict silently.

The deletion investigator read importer_count 0 as "unreachable" and offered
a helper imported only by a loadable module for deletion in a dead cluster
(static_clear); a loadable importer is live now. check_edit_safe is LEDGER
L-75; the turn-budget flake seen on #932's CI is L-74.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix: find_importers discloses an opaque site exactly where get_blast_radius does (L-73 review)

The review found find_importers returning the opaque disclosure beside a
scoped block, where get_blast_radius suppresses it once it has refused,
while the CHANGELOG claimed the sa

**File**: `CHANGELOG.md` (modified, +25/-0)
```diff
@@ -2,6 +2,31 @@
 
 ## [Unreleased]
 
+### Fixed - `find_importers` names the dynamic import that can load a file (LEDGER L-73)
+
+L-70 made every absence tool read #876's dynamic-import boundary, and
+`find_importers` was left out. For a module `import_module(f"adapters.{name}")`
+can load, it answered `importer_count: 0` with nothing beside it. That reads as
+"nothing imports this", one call away from `get_blast_radius` refusing to say
+so over the same file.
+
+A package- or prefix-scoped site that can reach the file is now named in a
+`dynamic_import_boundary` block (`files`, capped, beside `files_total`, and a `note`),
+in singular and batch mode, whatever the static count. The loaders are not
+importers and are never counted in `importer_count`: the module is named at
+runtime. An opaque site is disclosed as `dynamic_imports_unfollowed` only beside
+an EMPTY answer that no scoped site already qualifies, exactly the rule
+`get_blast_radius` applies (#876); a batch names it once. Both are declared in the compact encoder, which drops an undeclared dict
+without a word.
+
+⚠⚠ The deletion investigator was the consumer that acted on the missing
+field. Its liveness split calls an importer file with `importer_count: 0`
+unreachable, so a helper imported only by a dynamically loaded module was
+offered for deletion as part of a dead cluster (`static_clear`). A loadable
+importer is live now, and that verdict is `unsafe`. `check_edit_safe` reads the
+same importer list for signature impact and does not read the boundary yet;
+that verdict change needs its own measurement and is LEDGER L-75.
+
 ### Fixed - the dead-code tools read the dynamic-import boundary the blast radius reads (LEDGER L-70)
 
 #876 records a Python dynamic import it cannot resolve as a site with a
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -147,7 +147,7 @@ src/jcodemunch_mcp/
   groq/
   parser/
     complexity.py      # cyclomatic / max_nesting / param_count from body TEXT, no AST. ⚠⚠ **`max_nesting` is `max(bracket_channel, indent_channel)` and BOTH are required.** Brackets alone cannot see Python control flow — `if`/`for`/`while` open a block with a colon and contribute NO bracket depth, so the field reported the deepest EXPRESSION under the same name (`index_folder`: brackets 3, AST truth 6, an underreport by HALF that supported the OPPOSITE conclusion about the symbol). Indentation alone cannot see MINIFIED code, which has none. Max can only RAISE a depth, so brace languages are unmeasured-by-neither and unchanged. ⚠ `max_nesting` is REPORTED (get_symbol_complexity / get_hotspots / get_extraction_candidates / get_pr_risk_profile) and SCORED NOWHERE — `hotspot_score` and `_complexity_assessment` use cyclomatic alone, so correcting it moves no grade. ⚠⚠ A literal BACKSPACE (0x08) once replaced `` in the opener regex and **compiled, ran and passed ruff**; `tests/test_nesting_depth_channels.py` pins the boundary behaviourally and scans for stray control characters
-    imports.py         # Regex import extraction (19 languages); extract_imports(), resolve_specifier(), build_psr4_map(). ⚠⚠ **`_JS_SPECIFIER_REWRITES` exists because a TS specifier names the EMITTED file, not the source**: `.mts` is imported as `./foo.mjs` and `.cts` as `./foo.cjs`, extensions that are NEVER on disk. Adding an extension to `LANGUAGE_EXTENSIONS` without its rewrite entry makes the file visible and its importers invisible -- which reads downstream as a file nobody imports, i.e. #550 in a new costume. The `.js -> .ts/.tsx` rule predates the table and is unchanged; `test_ts_module_extensions.py` asserts that byte-for-byte ⚠⚠ **`_tsconfig_skip_dirs()` DERIVES from `security._SKIP_DIRECTORY_NAMES` (#557)** -- it was the FOURTH copy of a skip list in this tree and the only one deriving from nothing, so `_walk_tsconfigs` descended into Rust's `target/` on every watcher event (**13.58s of a 13.75s reindex, 0.27s once excluded**). **Add a spelling to the AUTHORITY, never here.** ⚠ **UNION with `_TSCONFIG_EXTRA_SKIP_DIRS`, never replacement**: `out` is deliberately absent from the authority (the "DOTTED ONLY" rule -- it names a real source dir for the INDEXING walk) but has been skipped for tsconfig discovery for this function's whole life, and **removing a skip is the one direction this may not go**. ⚠ Imported lazily: `security` imports `config`, and resolving that at module scope would put a parser module in the chain for no benefit. ⚠⚠ **(#876) A Python dynamic import is an edge** (literal, one-step literal parameter, literal table) or a `<dynamic-import>` marker edge with `dynamic_unresolved` and a `dynamic_scope` (`package` / `prefix:<m>` / `opaque`); only a scope that reaches the file refuses, an opaque one is DISCLOSED (jjg, 2026-09-29); the marker resolves to nothing; `tools/_dynamic_boundary.py` is THE reach rule, and `blast_verdict`, `find_dead_code`, `get_dead_code_v2`, `check_delete_safe` and the deletion investigator all read it (L-70); a reached file is UNDECIDED, never an entry point. A change here changes `files.imports` on unchanged content: bump `PARSER_GENERATION`.
+    imports.py         # Regex import extraction (19 languages); extract_imports(), resolve_specifier(), build_psr4_map(). ⚠⚠ **`_JS_SPECIFIER_REWRITES` exists because a TS specifier names the EMITTED file, not the source**: `.mts` is imported as `./foo.mjs` and `.cts` as `./foo.cjs`, extensions that are NEVER on disk. Adding an extension to `LANGUAGE_EXTENSIONS` without its rewrite entry makes the file visible and its importers invisible -- which reads downstream as a file nobody imports, i.e. #550 in a new costume. The `.js -> .ts/.tsx` rule predates the table and is unchanged; `test_ts_module_extensions.py` asserts that byte-for-byte ⚠⚠ **`_tsconfig_skip_dirs()` DERIVES from `security._SKIP_DIRECTORY_NAM
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -96,6 +96,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_blast_radius.py | `_bfs_importers` depth bucketing/cycle safety, risk fields always present, and `include_source` snippet extraction. | b7f28be "feat: add include_source flag to get_blast_radius for fix-ready context (#221)"; 62f6164 v1.11.13-14 | 1 | LOAD-BEARING | #221. |
 | tests/test_a_dynamic_import_is_an_edge_or_a_named_boundary.py | The reported shape (a literal passed into `_passthrough`'s `__import__(module_name)`) makes `cli.py` a dependent of `run_g_gates.main`; `__import__("x")` and `importlib.import_module("x")` are edges; one-step propagation works by position and keyword; a subscript into a module-level literal table follows its path and never yields keys; a loop over a literal sequence is a set of edges; a method feeder skips `self`; an opaque target is DISCLOSED beside an empty blast (`dynamic_imports_unfollowed`) and keeps `absent`; a literal module prefix and a package-relative target (the #569 shape) refuse only inside their package; a public loader with no in-file caller is an opaque site; an unparseable file is no site; controls: no dynamic import, and a fully resolved one, both keep `absent`; `PARSER_GENERATION >= 9`. Red against main: 13 failed, 4 passed (the two controls and two no-site cases main satisfies trivially); the review arms: 8 failed on the round-0 fix. | #876 (2026-09-29), reported by @Torolosko | 1 | LOAD-BEARING | ⚠⚠ Fixed at the import AUTHORITY, so every graph consumer inherits the edges; the refusal lives in `blast_verdict`, the one authority on a walk. ⚠⚠ Review measured the first draft refusing EVERY empty Python blast on this repo (sites in tests/ and benchmarks/ too, not only src/). The ruling (jjg, 2026-09-29): only a scope that reaches the file refuses; an opaque site is disclosed. `dynamic-sites.txt` in the run's evidence has the per-scope census. ⚠ The unresolved marker's specifier resolves to nothing, so every other consumer skips it. |
 | tests/test_dead_code_reads_the_dynamic_import_boundary.py | The three dead-code tools read #876's dynamic-import boundary: a file a prefix-scoped `import_module(f"adapters.{name}")` can load is withheld by `find_dead_code` at the default threshold and, with `min_confidence=0`, capped at the unproven ceiling with `dynamic_import_boundary` in `confidence_capped_by` and the site named; `get_dead_code_v2` leaves `unreachable_file` undecided for it and keeps `no_callers`, measures signal 1's rate only where it was decided, and a repo-root loader cannot turn a withheld health grade into a published one; `check_delete_safe` returns the bounded verdict `dynamic_import_boundary` naming the loader, never terminal with every other channel closed; the deletion investigator answers `not_established`, never `static_clear`. An opaque site is disclosed as `dynamic_imports_unfollowed` and caps nothing; a file no site reaches keeps confidence 1.0. | LEDGER L-70 (2026-09-29), found in #876 | 1 | LOAD-BEARING | ⚠⚠ The reach rule is `tools/_dynamic_boundary.py`, shared with `get_blast_radius`: before it the same module was "cannot prove nothing depends on it" in the blast radius and "provably unreachable, 1.0" plus `safe_to_delete` here. The measurement on this repo is `l70-measure.txt` in the run's evidence. |
+| tests/test_find_importers_discloses_the_dynamic_boundary.py | `find_importers` names a package- or prefix-scoped dynamic import that can load the file in a `dynamic_import_boundary` block, in singular and batch mode, whatever the static count, and never counts it as an importer; an opaque site is disclosed as `dynamic_imports_unfollowed` beside an empty answer no scoped site qualifies, as `get_blast_radius` does (once per batch); both survive the compact encoder; the deletion investigator does not call a loadable importer dead. | LEDGER L-73 (2026-09-29), found in L-70 review | 1 | LOAD-BEARING | ⚠⚠ The investigator's liveness split read `im
```

**File**: `docs/workflows/LEDGER.md` (modified, +3/-1)
```diff
@@ -121,4 +121,6 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-70 | 2026-09-29, #876 | `find_dead_code`, `get_dead_code_v2` and `check_delete_safe` gain #876's dynamic-import EDGES but never read its unresolved-boundary marker, so a Python module an unresolved `__import__`/`import_module` could load still reads as zero importers there (only `blast_verdict` refuses). `_corpus_adequacy` or `_runtime_discovery` is the likely home. Found in #876. | `src/jcodemunch_mcp/tools/find_dead_code.py`, `_corpus_adequacy.py` | gap | low | FIXED 2026-09-29 (`tools/_dynamic_boundary.py` is the one reach rule; `find_dead_code` caps, `get_dead_code_v2` leaves `unreachable_file` undecided, `check_delete_safe` returns `dynamic_import_boundary`, the investigator's `no_dynamic_loader` stays open) |
 | L-71 | 2026-09-29, #876 | A PUBLIC module-level literal table (`REGISTRY = {"a": "pkg.a"}`) feeding `import_module` resolves to its literal values, though another file can do `mod.REGISTRY["b"] = path`; a public loader FUNCTION is an opaque site for the same reason. Making public tables sites turns `grammar_pack.STANDALONE_GRAMMARS` into a site too, so this is an owner trade-off, not a blind fix. Found in #876 review round 4. | `src/jcodemunch_mcp/parser/imports.py` | gap | low | CLOSED 2026-09-29, by design (jjg: public tables stay trusted) |
 | L-72 | 2026-09-29, harness F-19 | A FAILING bench run uploads the wrong `self_latency.json`. `harness/__main__.py` copies a step's scratch artifact into the tree only when `rc == 0` and deletes the scratch copy either way, while `pr-gate.yml` and `main.yml` upload `harness/results/self_latency.json` under `if: always()`. So a red run's artifact is the TRACKED copy from the last weekly bench commit, named after the failing SHA. Measured on #922's failed attempt (run 36464454301, job 109076146863): the log says `get_symbol_source_warm_p95_ms` observed 116.3 FAIL; artifact 10988643704 holds `commit e83178e0` and 1.6, identical to the tracked file at aeb43e50, with no `*_resampled` keys. The measurement F-19 needs, including whether #920's re-sample ran, is destroyed on exactly the runs that fail. Candidate: on `rc != 0` keep the scratch artifact beside the tracked one (for example `self_latency.failed.json`) and upload it; never write it over the tracked file. Found while recording F-19's thirteenth occurrence. | `harness/__main__.py`, `.github/workflows/pr-gate.yml`, `.github/workflows/main.yml`, `.github/workflows/nightly.yml` | defect | medium | FIXED 2026-09-29 (a failed step's measurement rides in `latest.json` as `measurement` and, under `--write-results`, in `self_latency.failed.json`, which pr-gate, main and nightly upload; the tracked file is never overwritten) |
-| L-73 | 2026-09-29, L-70 review round 1 | `find_importers` answers `importer_count: 0` for a file a package- or prefix-scoped dynamic import can load, with no disclosure: the #876 boundary that `get_blast_radius` refuses on and the dead-code tools now read (`tools/_dynamic_boundary.py`) is absent from its response. It reports edges, not an absence verdict, so the fix is a disclosure field, not a cap. Measured: `scratchpad/l70review/dsprobe.py`, `adapters/alpha.py` under `import_module(f'adapters.{name}')` returns 0 importers and no dynamic key. | `src/jcodemunch_mcp/tools/find_importers.py` | gap | low | OPEN |
+| L-73 | 2026-09-29, L-70 review round 1 | `find_importers` answers `importer_count: 0` for a file a package- or prefix-scoped dynamic import can load, with no disclosure: the #876 boundary that `get_blast_radius` refuses on and the dead-code tools now read (`tools/_dynamic_boundary.py`) is absent from its response. It reports edges, not an absence verdict, so the fix is a disclosure field, not a cap. Measured: `scratchpad/l70review/dsprobe.py`, `adapters/alpha.py` under `import_module(f'adapters.{name}')` returns 0 importers and no dynamic key. | `src/jcodemunch_mcp/tools/find_importers.py` | ga
```

**File**: `src/jcodemunch_mcp/encoding/schemas/find_importers.py` (modified, +3/-1)
```diff
@@ -17,7 +17,9 @@
 _SCALARS = ("repo", "file_path", "importer_count", "note")
 _META = ("timing_ms", "truncated", "tokens_saved", "total_tokens_saved")
 _META_JSON = ("verdict",)  # structured _meta that must survive compaction
-_JSON = ("results",)
+# (LEDGER L-73) BODY dicts: the dispatcher deletes `_meta` on the shipped
+# default, and an undeclared dict is dropped by the encoder without a word.
+_JSON = ("results", "dynamic_import_boundary", "dynamic_imports_unfollowed")
 
 
 def encode(tool: str, response: dict) -> tuple[str, str]:
```

---

### Incident Patch 10: `10c3df74` (2026-09-29)
**Commit Message**: fix: the dead-code tools read the dynamic-import boundary the blast radius reads (LEDGER L-70) (#932)

* fix: the dead-code tools read the dynamic-import boundary the blast radius reads (LEDGER L-70)

#876 records a Python dynamic import it cannot resolve as a site with a
scope, and only get_blast_radius read it. find_dead_code published a module
import_module(f'adapters.{name}') can load as zero_importers at confidence 1.0,
and check_delete_safe certified it safe_to_delete.

tools/_dynamic_boundary.py is now the one reach rule, read by all four:
- find_dead_code caps a reached file at the unproven ceiling, names the sites,
  and counts what the default threshold withholds
- get_dead_code_v2 does not fire unreachable_file for a reached file
- check_delete_safe returns the bounded verdict dynamic_import_boundary
- an opaque site caps nothing and is disclosed (jjg's #876 ruling)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix: a dynamically loadable file is undecided, not an entry point (L-70 review round 1)

Round 1 made every file a scoped dynamic import can reach an entry point in
get_dead_code_v2. An entry point is skipped whole, so no_callers and
not_barrel_expor

**File**: `CHANGELOG.md` (modified, +50/-0)
```diff
@@ -2,6 +2,56 @@
 
 ## [Unreleased]
 
+### Fixed - the dead-code tools read the dynamic-import boundary the blast radius reads (LEDGER L-70)
+
+#876 records a Python dynamic import it cannot resolve as a site with a
+scope, and only `get_blast_radius` read the site. The other three absence
+tools got #876's edges and not its boundary. So a module that
+`import_module(f"adapters.{name}")` can load was "an empty result here is NOT
+evidence" in the blast radius, and at the same time `find_dead_code`
+published it `zero_importers` at confidence 1.0, the value this project
+documents as provably unreachable. `check_delete_safe` certified its
+symbols `safe_to_delete`.
+
+The reach rule now lives in one place, `tools/_dynamic_boundary.py`, and
+every absence tool reads it:
+- `find_dead_code` caps a file a package- or prefix-scoped site can reach at
+  the unproven ceiling, beside `uncapped_confidence`, with
+  `dynamic_import_boundary` in `confidence_capped_by` and the sites named in
+  `dynamic_import_sites`. At the default threshold the file is withheld and
+  counted in `dynamic_import_boundary_withheld`, never silently dropped.
+- `get_dead_code_v2` records `unreachable_file` as UNDECIDED for such a file
+  and for everything it imports (`undecided_signals` on the row,
+  `signal_diagnostics.undecided`, and a `dynamic_import_boundary` block naming
+  the loaders). Its other two signals still vote, and signal 1's fire rate is
+  measured only over the symbols it could be decided for. ⚠⚠ The first draft
+  made those files entry points instead. An entry point is skipped whole, so
+  `no_callers` went silent with it, and a loader at the repo root reaches
+  every file: nothing was analysed, no `signal_warning` was raised, and
+  `get_repo_health` published a grade that main withholds. Counting the
+  undecided symbols as "did not fire" is the same error one step removed: it
+  pulls a constant signal into the informative band and hands it a vote on
+  every unrelated symbol.
+- `check_delete_safe` returns the new bounded verdict
+  `dynamic_import_boundary`, naming the loaders. Like `corpus_inadequate` and
+  `name_not_searchable`, it replaces only an absence verdict; a found
+  importer still blocks. The loader is a gap in `stop_rule`, so the verdict
+  is never terminal, and a thin corpus still adds its own blocker beside it.
+- The deletion investigator gains a `no_dynamic_loader` obligation, left
+  unestablished when a site reaches the file, so it answers
+  `not_established` there instead of `static_clear`.
+- An opaque site (a name computed from data) caps nothing and is disclosed
+  as `dynamic_imports_unfollowed`, per the #876 ruling.
+
+Measured on this repository (`l70-measure.txt`, one index, main's source and
+this branch's): the default `find_dead_code` still returns no dead files on
+either side, because the corpus is already capped (`withheld_files`,
+`runtime_discovery_unresolved`) below the default threshold. It now carries
+`dynamic_imports_unfollowed`, naming 4 files. `get_dead_code_v2` leaves
+`unreachable_file` undecided for 165 symbols in the twelve competitive
+adapters, which one test file loads by prefix, and returns 100 matches where
+main returned 144.
+
 ### Fixed - a dynamic import is an import edge when its target is a literal, and a named boundary when not (#876)
 
 Reported by @Torolosko (split from #718). The static model stopped at a
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -147,7 +147,7 @@ src/jcodemunch_mcp/
   groq/
   parser/
     complexity.py      # cyclomatic / max_nesting / param_count from body TEXT, no AST. ⚠⚠ **`max_nesting` is `max(bracket_channel, indent_channel)` and BOTH are required.** Brackets alone cannot see Python control flow — `if`/`for`/`while` open a block with a colon and contribute NO bracket depth, so the field reported the deepest EXPRESSION under the same name (`index_folder`: brackets 3, AST truth 6, an underreport by HALF that supported the OPPOSITE conclusion about the symbol). Indentation alone cannot see MINIFIED code, which has none. Max can only RAISE a depth, so brace languages are unmeasured-by-neither and unchanged. ⚠ `max_nesting` is REPORTED (get_symbol_complexity / get_hotspots / get_extraction_candidates / get_pr_risk_profile) and SCORED NOWHERE — `hotspot_score` and `_complexity_assessment` use cyclomatic alone, so correcting it moves no grade. ⚠⚠ A literal BACKSPACE (0x08) once replaced `` in the opener regex and **compiled, ran and passed ruff**; `tests/test_nesting_depth_channels.py` pins the boundary behaviourally and scans for stray control characters
-    imports.py         # Regex import extraction (19 languages); extract_imports(), resolve_specifier(), build_psr4_map(). ⚠⚠ **`_JS_SPECIFIER_REWRITES` exists because a TS specifier names the EMITTED file, not the source**: `.mts` is imported as `./foo.mjs` and `.cts` as `./foo.cjs`, extensions that are NEVER on disk. Adding an extension to `LANGUAGE_EXTENSIONS` without its rewrite entry makes the file visible and its importers invisible -- which reads downstream as a file nobody imports, i.e. #550 in a new costume. The `.js -> .ts/.tsx` rule predates the table and is unchanged; `test_ts_module_extensions.py` asserts that byte-for-byte ⚠⚠ **`_tsconfig_skip_dirs()` DERIVES from `security._SKIP_DIRECTORY_NAMES` (#557)** -- it was the FOURTH copy of a skip list in this tree and the only one deriving from nothing, so `_walk_tsconfigs` descended into Rust's `target/` on every watcher event (**13.58s of a 13.75s reindex, 0.27s once excluded**). **Add a spelling to the AUTHORITY, never here.** ⚠ **UNION with `_TSCONFIG_EXTRA_SKIP_DIRS`, never replacement**: `out` is deliberately absent from the authority (the "DOTTED ONLY" rule -- it names a real source dir for the INDEXING walk) but has been skipped for tsconfig discovery for this function's whole life, and **removing a skip is the one direction this may not go**. ⚠ Imported lazily: `security` imports `config`, and resolving that at module scope would put a parser module in the chain for no benefit. ⚠⚠ **(#876) A Python dynamic import is an edge** (literal, one-step literal parameter, literal table) or a `<dynamic-import>` marker edge with `dynamic_unresolved` and a `dynamic_scope` (`package` / `prefix:<m>` / `opaque`); only a scope that reaches the file refuses, an opaque one is DISCLOSED (jjg, 2026-09-29); the marker resolves to nothing and only `blast_verdict` reads it. A change here changes `files.imports` on unchanged content: bump `PARSER_GENERATION`.
+    imports.py         # Regex import extraction (19 languages); extract_imports(), resolve_specifier(), build_psr4_map(). ⚠⚠ **`_JS_SPECIFIER_REWRITES` exists because a TS specifier names the EMITTED file, not the source**: `.mts` is imported as `./foo.mjs` and `.cts` as `./foo.cjs`, extensions that are NEVER on disk. Adding an extension to `LANGUAGE_EXTENSIONS` without its rewrite entry makes the file visible and its importers invisible -- which reads downstream as a file nobody imports, i.e. #550 in a new costume. The `.js -> .ts/.tsx` rule predates the table and is unchanged; `test_ts_module_extensions.py` asserts that byte-for-byte ⚠⚠ **`_tsconfig_skip_dirs()` DERIVES from `security._SKIP_DIRECTORY_NAMES` (#557)** -- it was the FOURTH copy of a skip list in this tree and the only one deriving from nothing, so `_walk_tsconfigs` descended into Rust's `target/` on every watcher event (**13.58s o
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -95,6 +95,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_blade.py | Blade fixture extracts @extends/@section/components and is not mistaken for plain PHP. | cb57224 "Add Laravel Blade template support (.blade.php) — closes #47" | 10 | LOAD-BEARING | Fixture-driven; #47. |
 | tests/test_blast_radius.py | `_bfs_importers` depth bucketing/cycle safety, risk fields always present, and `include_source` snippet extraction. | b7f28be "feat: add include_source flag to get_blast_radius for fix-ready context (#221)"; 62f6164 v1.11.13-14 | 1 | LOAD-BEARING | #221. |
 | tests/test_a_dynamic_import_is_an_edge_or_a_named_boundary.py | The reported shape (a literal passed into `_passthrough`'s `__import__(module_name)`) makes `cli.py` a dependent of `run_g_gates.main`; `__import__("x")` and `importlib.import_module("x")` are edges; one-step propagation works by position and keyword; a subscript into a module-level literal table follows its path and never yields keys; a loop over a literal sequence is a set of edges; a method feeder skips `self`; an opaque target is DISCLOSED beside an empty blast (`dynamic_imports_unfollowed`) and keeps `absent`; a literal module prefix and a package-relative target (the #569 shape) refuse only inside their package; a public loader with no in-file caller is an opaque site; an unparseable file is no site; controls: no dynamic import, and a fully resolved one, both keep `absent`; `PARSER_GENERATION >= 9`. Red against main: 13 failed, 4 passed (the two controls and two no-site cases main satisfies trivially); the review arms: 8 failed on the round-0 fix. | #876 (2026-09-29), reported by @Torolosko | 1 | LOAD-BEARING | ⚠⚠ Fixed at the import AUTHORITY, so every graph consumer inherits the edges; the refusal lives in `blast_verdict`, the one authority on a walk. ⚠⚠ Review measured the first draft refusing EVERY empty Python blast on this repo (sites in tests/ and benchmarks/ too, not only src/). The ruling (jjg, 2026-09-29): only a scope that reaches the file refuses; an opaque site is disclosed. `dynamic-sites.txt` in the run's evidence has the per-scope census. ⚠ The unresolved marker's specifier resolves to nothing, so every other consumer skips it. |
+| tests/test_dead_code_reads_the_dynamic_import_boundary.py | The three dead-code tools read #876's dynamic-import boundary: a file a prefix-scoped `import_module(f"adapters.{name}")` can load is withheld by `find_dead_code` at the default threshold and, with `min_confidence=0`, capped at the unproven ceiling with `dynamic_import_boundary` in `confidence_capped_by` and the site named; `get_dead_code_v2` leaves `unreachable_file` undecided for it and keeps `no_callers`, measures signal 1's rate only where it was decided, and a repo-root loader cannot turn a withheld health grade into a published one; `check_delete_safe` returns the bounded verdict `dynamic_import_boundary` naming the loader, never terminal with every other channel closed; the deletion investigator answers `not_established`, never `static_clear`. An opaque site is disclosed as `dynamic_imports_unfollowed` and caps nothing; a file no site reaches keeps confidence 1.0. | LEDGER L-70 (2026-09-29), found in #876 | 1 | LOAD-BEARING | ⚠⚠ The reach rule is `tools/_dynamic_boundary.py`, shared with `get_blast_radius`: before it the same module was "cannot prove nothing depends on it" in the blast radius and "provably unreachable, 1.0" plus `safe_to_delete` here. The measurement on this repo is `l70-measure.txt` in the run's evidence. |
 | tests/test_blast_radius_package_granular_verdict.py | Go package-granular imports yield a withheld (not zero) risk score with a verdict naming the unresolved edge; Python resolvable imports keep a real score. | ed28e18 "release: v1.108.245 - a blast radius of zero now says whether it was measured (#415)" | 9 | LOAD-BEARING | #415; controls included so the fix cannot refuse everything. Also 3 (absence claim). |
 | te
```

**File**: `docs/workflows/LEDGER.md` (modified, +2/-1)
```diff
@@ -118,6 +118,7 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-67 | 2026-09-28, #874 | `get_changed_symbols` reads a RENAMED file's before side at its NEW path, which does not exist at `since_sha`, so every symbol of the file is published as `added` and none is removed at the old path, while `symbol_diff_complete` reads true. Pre-existing: main's `--name-only` read did the same. Since #874 the `--name-status -z` parse sees the old path and discards it, so reading the before side there is available. Found in #874's review. | `src/jcodemunch_mcp/tools/get_changed_symbols.py` per-file loop | defect | low | OPEN |
 | L-68 | 2026-09-28, #875 | `_runtime_body` sits on each row while its basis (`body_basis: "index_body_at_ingest"`) travels only in `_meta.runtime_freshness`, which `meta_fields: []` (the default) strips, so a default install reads `_runtime_body: current` with no statement that it means "the index held this body at ingest" rather than "the trace ran this body" (Standing lesson 08-30). Put the basis on the row or in the value (e.g. `current_at_ingest`). Found in #875's review. | `src/jcodemunch_mcp/runtime/confidence.py` `annotate` | gap | low | OPEN |
 | L-69 | 2026-09-28, #871 | The `claude-md` subcommand (`--generate`, `--format full|append|policy`) has no row in `CLI-AND-ENV.md`, `CONFIGURATION.md` or `README.md`; its only documentation is argparse help, so the `policy` format `config --check` now names is discoverable only from the message itself. Found in #871's review. | `CLI-AND-ENV.md` | gap | low | OPEN |
-| L-70 | 2026-09-29, #876 | `find_dead_code`, `get_dead_code_v2` and `check_delete_safe` gain #876's dynamic-import EDGES but never read its unresolved-boundary marker, so a Python module an unresolved `__import__`/`import_module` could load still reads as zero importers there (only `blast_verdict` refuses). `_corpus_adequacy` or `_runtime_discovery` is the likely home. Found in #876. | `src/jcodemunch_mcp/tools/find_dead_code.py`, `_corpus_adequacy.py` | gap | low | OPEN |
+| L-70 | 2026-09-29, #876 | `find_dead_code`, `get_dead_code_v2` and `check_delete_safe` gain #876's dynamic-import EDGES but never read its unresolved-boundary marker, so a Python module an unresolved `__import__`/`import_module` could load still reads as zero importers there (only `blast_verdict` refuses). `_corpus_adequacy` or `_runtime_discovery` is the likely home. Found in #876. | `src/jcodemunch_mcp/tools/find_dead_code.py`, `_corpus_adequacy.py` | gap | low | FIXED 2026-09-29 (`tools/_dynamic_boundary.py` is the one reach rule; `find_dead_code` caps, `get_dead_code_v2` leaves `unreachable_file` undecided, `check_delete_safe` returns `dynamic_import_boundary`, the investigator's `no_dynamic_loader` stays open) |
 | L-71 | 2026-09-29, #876 | A PUBLIC module-level literal table (`REGISTRY = {"a": "pkg.a"}`) feeding `import_module` resolves to its literal values, though another file can do `mod.REGISTRY["b"] = path`; a public loader FUNCTION is an opaque site for the same reason. Making public tables sites turns `grammar_pack.STANDALONE_GRAMMARS` into a site too, so this is an owner trade-off, not a blind fix. Found in #876 review round 4. | `src/jcodemunch_mcp/parser/imports.py` | gap | low | CLOSED 2026-09-29, by design (jjg: public tables stay trusted) |
 | L-72 | 2026-09-29, harness F-19 | A FAILING bench run uploads the wrong `self_latency.json`. `harness/__main__.py` copies a step's scratch artifact into the tree only when `rc == 0` and deletes the scratch copy either way, while `pr-gate.yml` and `main.yml` upload `harness/results/self_latency.json` under `if: always()`. So a red run's artifact is the TRACKED copy from the last weekly bench commit, named after the failing SHA. Measured on #922's failed attempt (run 36464454301, job 109076146863): the log says `get_symbol_source_warm_p95_ms` observed 116.3 FAIL; artifact 10988643704 holds `commit e83178e0` and 1.6, identical to the tracked 
```

**File**: `src/jcodemunch_mcp/investigator/deletion_safety.py` (modified, +24/-0)
```diff
@@ -396,6 +396,30 @@ def investigate_deletion_safety(
         entry_ob.evidence.append("No route/command/task/signal indicator on the symbol")
     obligations.append(entry_ob)
 
+    # ── Obligation 4b: no dynamic import can load the file (LEDGER L-70) ─
+    # A package- or prefix-scoped dynamic import names its module at runtime,
+    # so obligations 2 and 3 pass by construction for every file it can load.
+    # Source CAN answer this (read the loader), so it is a static obligation
+    # left open, never `static_clear`. Only present when a site reaches the
+    # file; an opaque site is disclosed elsewhere and blocks nothing (#876).
+    from ..tools._dynamic_boundary import DynamicBoundary  # noqa: PLC0415
+
+    reaching = DynamicBoundary(index.imports).reaching(target_file)
+    if reaching:
+        obligations.append(
+            Obligation(
+                name="no_dynamic_loader",
+                question="Can a dynamic import load the file that defines it?",
+                status=UNESTABLISHED,
+                evidence=[
+                    f"{reaching[0]} imports a module by a computed name that can "
+                    f"reach {target_file}; read it for the names it can produce"
+                ],
+                detail={"loaders": reaching[:10], "loaders_total": len(reaching)},
+                calls=1,
+            )
+        )
+
     # ── Obligation 5: production never ran it ───────────────────────────
     # UNESTABLISHED when no traces exist. This is the obligation most likely to
     # be honestly unresolvable, and reporting it as satisfied would be the
```

#### Recent Merged Pull Requests:
- **PR #945** (2026-09-30): fix: release notes fit GitHub's release body limit (LEDGER L-92) (@jgravelle)
- **PR #944** (2026-09-30): release: v1.108.320 - a member the index never saw and a caller the search never found both read as nothing there (@jgravelle)
- **PR #943** (2026-09-30): fix: a differently-cased sibling no longer hides a caller (LEDGER L-88) (@jgravelle)
- **PR #942** (2026-09-30): fix: check_references finds a call written in another spelling, and check_delete_safe reads every file (LEDGER L-84, L-89) (@jgravelle)
- **PR #941** (2026-09-30): test: a non-ASCII name keeps refusing until the search normalises (LEDGER L-83, L-84) (@jgravelle)
- **PR #939** (2026-09-30): fix: name_not_searchable names the re-index and the loaders that could move it (LEDGER L-81) (@jgravelle)
- **PR #938** (2026-09-30): fix: an unproven-absence verdict is never terminal, and check_delete_safe passes its name gap (LEDGER L-80) (@jgravelle)
- **PR #937** (2026-09-30): fix: the safety preflights' descriptions name every verdict they return (LEDGER L-79) (@jgravelle)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

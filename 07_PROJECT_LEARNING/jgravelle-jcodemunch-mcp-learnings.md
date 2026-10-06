# Forensic Learning Record (Deep Inspection): jgravelle/jcodemunch-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/jgravelle-jcodemunch-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jgravelle/jcodemunch-mcp](https://github.com/jgravelle/jcodemunch-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:08:33.836Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jgravelle/jcodemunch-mcp`
- **Description**: Cut AI token costs 95%+ on code exploration. The leading MCP server for precise, symbol-level GitHub code retrieval via tree-sitter AST. Works with Claude Code, Cursor & any MCP client. 313B+ tokens saved.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2733 stars

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


def tree_id() -> str:
    """Identity of the working tree's CONTENT under the tier paths.

    A full-tier run is valid for exactly this identity, whatever its age (D5).
    """
    # The identity covers what the full tier's verdict DEPENDS on: the code
    # roots, the packaging and the harness. A CHANGELOG line, a PR body draft
    # or a docs/ edit after the run does not invalidate it; committing the
    # same content does not either (W-21, #675). The harness's own footprint
    # (pytest-cov's `.coverage.<host>.<pid>` files, the hook state) never
    # counts (W-13).
    # ⚠ #675: this hashed `ls-tree HEAD` + `git diff HEAD` + the untracked
    # listing, and committing moves a change from the second string into the
    # first, so the claim above was false for its whole life. The working
    # copy is staged into a THROWAWAY index (a copy of the real one, so the
    # stat cache spares re-hashing unchanged files) and written as a tree:
    # blob ids of the content, identical before and after a commit, with
    # untracked files included. The real index is never written.
    # Residual: a doc edit CAN flip a doc-reading test (CLAUDE.md size); the
    # PR gate is the authority for that, this hook is the early one.
    # ⚠ A tier path absent from both the working copy and the index is a
    # pathspec `git add` refuses OUTRIGHT, adding nothing; pass only live ones.
    # ⚠ Any git failure yields an id no stamp can hold (fail closed): a
    # constant fallback would let two failed reads certify each other.
    # ⚠⚠ The copy KEEPS the index's mtime (`copy2`, never `copyfile`). Git
    # re-reads a file whose stat matches its entry only when that entry is
    # "racily clean" (mtime >= the INDEX FILE's mtime); a copy stamped "now"
    # makes every entry look settled, so a same-size edit inside the racy
    # window is trusted from the stat cache and the id names STALE content.
    # A draft that used `copyfile` named stale content in 3 of 25 looped runs.
    # ⚠ It also writes 
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
            "The usual cause is a new test that was untracked at red; `git add` it before "
            "running red, then re-run red and green"
        )
    stray = [p for p in moved if p not in changed]
    if stray:
        return None, f"{', '.join(stray[:3])} moved between red and green but is not part of this change"
    unmoved = [c for c in changed if not c.startswith(CODE_ROOTS) and c not in moved]
    if unmoved:
        return None, (
            f"{', '.join(unmoved[:3])} changed on the branch but not between red and green, "
            "so red ran after part of the change"
        )
    return moved, ""


def row1_binding(
    red: str,
    green: str,
    red_stamp: dict | None,
    green_stamp: dict | None,
    *,
    branch: str,
    tree: str,
    diff_paths=tree_diff_paths,
    changed: list[str] = (),
    content_now: str | None = None,
) -> str | None:
    """None when the pair belongs to this change; otherwise why it does not."""
    if red_stamp is None or green_stamp is None:
        missing = [k for k, s in (("red", red_stamp), ("green", green_stamp)) if s is None]
        return (
            f"evidence/{'/'.join(missing)} not stamped; run "
            "`python .claude/hooks/dod_checklist.py --stamp red|green` right after each run"
        )
    for kind, text, stamp in (("red", red, red_stamp), ("green", green, green_stamp)):
        if stamp.get("branch") != branch:
            return f"evidence/{kind}.txt was stamped on branch {stamp.get('branch')!r}, not {branch!r}"
        if stamp.get("sha256") != _sha(text):
            return f"evidence/{kind}.txt changed after it was stamped"
    for kind, t in (("red", red_stamp.get("tree")), ("green", green_stamp.get("tree")), ("the current", tree)):
        if not isinstance(t, str) or not t or t.startswith(UNREADABLE_PREFIX):
            return f"{kind} tree could not be read, so the pair cannot be bound (fail closed)"
    if green_stamp.get("tree") != tree:
        return (
            f"evidence/green.txt ran on
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

### Core Architecture Module: `benchmarks/competitive/sandbox/jcm_worker.py`
```
"""jCodeMunch's in-container worker (docs/competitive/DESIGN.md s1.4; FINDINGS CF-3).

purpose:  index /corpus into CODE_INDEX_PATH and answer every task in
          /out/tasks.json with the published workflow, writing
          /out/answers.json; the same file is also run on the host when the
          sandbox is `none` (tests, a box without Docker), so the two modes
          run one code path
invokes:  index_folder with its shipped defaults (AI summaries off, R28),
          search_symbols(max_results=5, detail_level="standard") +
          get_symbol_source on the top 3 (R27) for P1 and T,
          check_references(identifier=<query>) at its shipped defaults for
          P2 (CF-51: find_references is the IMPORT-graph tool and answered
          0 on every corpus; the usage-site question is check_references'
          own description, imports plus file content, definition spans
          excluded, capped at 20 FILES, and the cap is the tool's, never
          raised for the gold), find_importers for P4; the live
          tools/list weight from server._build_tools_list (CF-6)
produces: /out/answers.json {index, answers, tools_list_chars, reindex_one}
          — `reindex_one` (STANDARD 3(b), CF-61) is the wall seconds of
          index_folder(paths=[<file>], force_reparse=True) on the ONE file
          named by the optional fifth argument, measured AFTER every task so
          no answer pays for it: the watcher's and `refresh`'s incremental
          path, re-parse plus incremental save, without editing the file
          (a pinned corpus is a checkout and the container mounts it
          read-only; the cost is the re-parse, not the edit)
refuses:  nothing; a task that raises is recorded as an error on its row
pinned:   the checkout the image was built from
fairness: DESIGN s1.4; runs under the same sandbox flags as every competitor

Usage: python jcm_worker.py <corpus> <store> <tasks.json> <answers.json> [<reindex file>]
"""

from __future__ import annotations

import json
import sys
import time

SEARCH_MAX_RESULTS = 5
SYMBOLS_FETCHED = 3


def cite_references(s: dict) -> list:
    """The (file, line) citations in a check_references reply: every content
    match's line, and an import-graph file at line 0 (an import edge has no
    line in the reply) ONLY when no content line already cites that file: a
    file that imports X also contains the text X, so citing the import row
    too would be a second citation of a cited file, a precision penalty
    the worker's reading would add and the tool's reply does not (review
    round 1 of CF-51). The singular shape is read; a batch `results` list
    is not what the worker asks for."""
    cited: list = []
    content_files: set = set()
    for row in s.get("content_references") or []:
        f = row.get("file")
        for m in row.get("matches") or []:
            ln = m.get("line") if isinstance(m, dict) else None
            if f and ln:
                cited.append([f, int(ln)])
                content_files.add(f)
    for row in s.get("import_references") or []:
        f = row.get("file") if isinstance(row, dict) else row
        if f and f not in content_files:
            cited.append([f, 0])
    return cited


def ser(o) -> str:
    return json.dumps(o, separators=(",", ":"), default=str)


def main(argv: list[str]) -> int:
    corpus, store, tasks_json, answers_json = argv[1:5]
    reindex_file = argv[5] if len(argv) > 5 else None
    tasks = json.loads(open(tasks_json, encoding="utf-8").read())
    from jcodemunch_mcp.tools.index_folder import index_folder

    t = time.perf_counter()
    r = index_folder(path=corpus, use_ai_summaries=False, storage_path=store)
    idx = {"secs": time.perf_counter() - t, "repo": r.get("repo"), "success": r.get("success"),
           "file_count": r.get("file_count"), "symbol_count": r.get("symbol_count"), "error": r.get("error")}
    out: dict = {"index": idx, "answers": {}, "tools_list_chars": None}
    try:
        from jcodemunch_mcp import server as _server

        tools = _server._build_tools_list()
        out["tools_list_chars"] = len(ser([{"name": x.name, "description": x.description, "inputSchema": x.inputSchema} for x in tools]))
        out["tools_list_json"] = ser([{"name": x.name, "description": x.description, "inputSchema": x.inputSchema} for x in tools])
    except Exception as e:  # reported, never fatal
        out["tools_list_error"] = f"{type(e).__name__}: {e}"
    if idx["success"] and idx["repo"]:
        from jcodemunch_mcp.tools.search_symbols import search_symbols
        from jcodemunch_mcp.tools.get_symbol import get_symbol_source
        from jcodemunch_mcp.tools.check_references import check_references
        from jcodemunch_mcp.tools.find_importers import find_importers

        repo = idx["repo"]
        for task in tasks:
            cat, q = task["category"], task["query"]
            payload, lat, cited, err = [], [], [], None
            try:
                if cat in ("P1", "T"):
                    t0 = time.perf_counter()
                    s = search_symbols(repo=repo, query=q, max_results=SEARCH_MAX_RESULTS, detail_level="standard")
                    lat.append((time.perf_counter() - t0) * 1000)
                    payload.append(ser(s))
                    rows = s.get("results") or s.get("symbols") or []
                    for row in rows:
                        f, ln = row.get("file") or row.get("file_path"), row.get("line") or row.get("start_line")
                        if f and ln:
                            cited.append([f, int(ln)])
                    ids = [x.get("id") or x.get("symbol_id") for x in rows if x.get("id") or x.get("symbol_id")][:SYMBOLS_FETCHED]
                    for sid in ids:
                        t0 = time.perf_counter()
                        g = get_symbol_source(repo=repo, symbol_id=sid)
                        lat.append((time.perf_counter() - t0) * 1000)
                        payload.append(ser(g))
                        f, ln = g.get("file") or g.get("file_path"), g.get("start_line") or g.get("line")
                        if f and ln:
                            cited.append([f, int(ln)])
                elif cat == "P2":
                    t0 = time.perf_counter()
                    s = check_references(repo=repo, identifier=q)
                    lat.append((time.perf_counter() - t0) * 1000)
                    payload.append(ser(s))
                    cited.extend(cite_references(s))
                elif cat == "P4":
                    t0 = time.perf_counter()
                    s = find_importers(repo=repo, file_path=q)
                    lat.append((time.perf_counter() - t0) * 1000)
                    payload.append(ser(s))
                    for row in s.get("importers") or s.get("results") or []:
                        f = row.get("file") or row.get("file_path") or row.get("path") if isinstance(row, dict) else row
                        if f:
                            cited.append([f, 0])
                else:
                    err = "category not answered by this adapter"
            except Exception as e:  # the row fails, not the run
                err = f"{type(e).__name__}: {e}"
            out["answers"][task["id"]] = {"payload": "".join(payload), "calls": len(lat), "latency_ms": lat, "cited": cited, "error": err}
    if idx["success"] and reindex_file:
        # 3(b): one file, the incremental path, after every task (CF-61)
        t0 = time.perf_counter()
        try:
            rr = index_folder(path=corpus, use_ai_summaries=False, storage_path=store, paths=[reindex_file], force_reparse=True)
            # the tool says which path it took: `performed_incremental` False is a
            # full re-index and is charged as one, never relabelled
            mode = "incremental" if rr.get("performed_incremental") else "full_reindex"
            reparsed = (rr.get("changed") or 0) + (rr.get("new") or 0) if rr.get("performed_incremental") else rr.get("file_count")
            out["reindex_one"] = {"secs": time.perf_counter() - t0, "path": reindex_file, "mode": mode,
                                  "success": bool(rr.get("success")), "files_reparsed": reparsed, "error": rr.get("error")}
        except Exception as e:  # the row is NOT COMPARABLE, not the run
            out["reindex_one"] = {"secs": time.perf_counter() - t0, "path": reindex_file, "mode": None,
                                  "success": False, "files_reparsed": None, "error": f"{type(e).__name__}: {e}"}
    with open(answers_json, "w", encoding="utf-8") as fh:
        json.dump(out, fh)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

```

### Core Architecture Module: `benchmarks/competitive/score.py`
```
"""Scoring of the competitive tier (docs/competitive/DESIGN.md s5).

purpose:  per (axis, tool, corpus): median of three runs, the spread, our
          value on the same row, the delta, the band and whether the gap is
          meaningful; F1 per task with the field's line tolerance
invokes:  nothing outside the standard library
produces: plain dicts the runner writes into the result file
refuses:  a band from fewer than three runs (a one-run comparison has no
          spread and therefore no band: harness DESIGN s5)
pinned:   n/a
fairness: a row is unstable when its own spread exceeds UNSTABLE_FRACTION
          of its own median, judged BEFORE the band is built, so an
          unstable row cannot widen the band it is then measured against
          (the first draft did exactly that and called a 50/100/300 triple
          stable); the band is max(5%% of our median, 3x the larger
          spread) over stable rows only; F1 counts an expected hit once,
          and a cited line that matches nothing counts against precision.
"""

from __future__ import annotations

import statistics
from typing import Iterable, Optional

RATIO_AXES = ("tokens_per_task", "calls_per_task", "latency_call_ms", "index_cold_seconds", "reindex_one_seconds", "tools_list_tokens")
DIFF_AXES = ("f1_P1", "f1_P2", "f1_P4", "f1_P5")
UNSTABLE_FRACTION = 0.10  # DESIGN s5.1


def f1(cited: Iterable[tuple[str, int]], expected: Iterable[tuple[str, int]], tolerance: int,
       cites_all: bool = False, corpus_lines: int = 0) -> Optional[float]:
    """ONE-TO-ONE matching (DESIGN s5.1): each expected line is matched to the
    nearest still-unmatched cited line within the tolerance, so two citations
    beside one expected line count as one hit and one stray, and one citation
    cannot credit two expected lines. Many-to-many matching (the first draft)
    paid a tool for citing densely near a hit, which grep does by construction
    (review, finding 2). A read-all answer cites every line of the corpus:
    recall 1, precision = expected over corpus lines."""
    exp = list(expected)
    if not exp:
        return None
    if cites_all:
        if corpus_lines <= 0:
            return 0.0
        precision = min(1.0, len(exp) / corpus_lines)
        return round(2 * precision / (precision + 1.0), 4)
    cit = set(cited)
    if not cit:
        return 0.0
    free = set(cit)
    matched = 0
    for ef, el in exp:
        candidates = sorted((abs(c[1] - el), c) for c in free if c[0] == ef and abs(c[1] - el) <= tolerance)
        if candidates:
            free.discard(candidates[0][1])
            matched += 1
    precision = matched / len(cit)
    recall = matched / len(exp)
    if precision + recall == 0:
        return 0.0
    return round(2 * precision * recall / (precision + recall), 4)


def median_spread(values: list[float]) -> tuple[Optional[float], Optional[float]]:
    xs = [v for v in values if v is not None]
    if not xs:
        return None, None
    return statistics.median(xs), (max(xs) - min(xs))


def _stable(median: float, spread: float) -> bool:
    """Spread within UNSTABLE_FRACTION of the row's OWN median; a zero median
    is stable only with a zero spread."""
    if median == 0:
        return spread == 0
    return spread <= UNSTABLE_FRACTION * abs(median)


def band(jcm_median: float, spread_tool: float, spread_jcm: float) -> float:
    return max(0.05 * abs(jcm_median), 3.0 * max(spread_tool, spread_jcm))


def compare(axis: str, tool_vals: list[float], jcm_vals: list[float]) -> dict:
    """One row. `runs` is the raw triple so a reader can recompute."""
    tm, ts = median_spread(tool_vals)
    jm, js = median_spread(jcm_vals)
    row = {"axis": axis, "runs": tool_vals, "measured": tm, "spread": ts, "jcm": jm, "jcm_spread": js,
           "delta": None, "band": None, "meaningful": False, "stable": None, "note": ""}
    if tm is None or jm is None:
        row["note"] = "NOT COMPARABLE"
        return row
    if len([v for v in tool_vals if v is not None]) < 3 or len([v for v in jcm_vals if v is not None]) < 3:
        row["note"] = "fewer than three runs: no band (harness DESIGN s5)"
        row["delta"] = (tm / jm if jm else None) if axis in RATIO_AXES else round(tm - jm, 4)
        return row
    row["stable"] = _stable(tm, ts) and _stable(jm, js)
    b = band(jm, ts, js)
    row["band"] = round(b, 4)
    if axis in RATIO_AXES:
        row["delta"] = round(tm / jm, 4) if jm else None
    else:
        row["delta"] = round(tm - jm, 4)
    row["meaningful"] = bool(row["stable"] and abs(tm - jm) > b)
    if not row["stable"]:
        row["note"] = "unstable: a spread exceeds 10% of its own median"
    return row

```

### Core Architecture Module: `benchmarks/description_smells/score_descriptions.py`
```
"""Score jMunch MCP tool descriptions against the rubric from arXiv:2602.14878.

Rubric source: SAILResearch/mcp-tool-description-augmentation,
mcpuniverse/scripts/description_evaluation_prompt.py (DESCRIPTION_QUALITY_PROMPT).

The paper operationalises the rubric through an FM judge. This script is a
deterministic re-implementation of the mechanical parts of that rubric so the
scores are reproducible and auditable. Components that need judgement (purpose
wording quality) use cue-based proxies; those are flagged in the output so they
can be spot-checked by hand.

Two scoring frames, because the paper's scanner payload is name + server +
description text ONLY (no inputSchema):
  - frame "paper": parameter_explanation judged on description prose alone.
    Rubric 1/5 is literally "Parameters not explained or only in schema".
  - frame "schema": parameter_explanation credited when the JSON Schema carries
    a per-parameter description (which the client does send to the model).
"""

import json
import re
import sys
from pathlib import Path

SP = Path(__file__).parent

WHEN_TO_USE = re.compile(
    r"\b(use (this|it|when|before|after|for|to|instead)|call (this|it|before|once)|"
    r"start here|good first call|designed for|designed to be|run this|pairs? with|"
    r"use case|opening move|first tool called|use [a-z_]{4,} (as|when|for|to)|"
    r"for cheap|for navigation|workflow)\b",
    re.I,
)
WHEN_NOT_TO_USE = re.compile(
    r"(\buse [a-z_]+ instead\b|\bfor [^.]{3,60}, use [a-z_]+\b|\bprefer [a-z_(]+\b|"
    r"\bdoes not\b|\bdoes NOT\b|\bdistinct from\b|\brather than\b|\bnot supported\b|"
    r"\binstead of\b|\bdo not re-run\b|\bnever\b|\bskip\b)",
    re.I,
)
LIMITATION = re.compile(
    r"(\brequires?\b|\bonly\b|\bdoes not\b|\bnot supported\b|\bheuristic\b|\bcapped?\b|"
    r"\breturns? (an )?empty\b|\bread-only\b|\bnever (writes|mutates|edits)\b|"
    r"\bdegrades\b|\bestimate\b|\bnot exhaustive\b|\bfails? closed\b|\bunless\b|"
    r"\bmust be\b|\bcannot\b|\bno .{0,20}(access|i/o)\b|\breserved\b|\bopt-in\b|"
    r"\bwhen no [a-z ]{3,30}(been )?(ingested|run|configured|indexed)\b|"
    r"\bempty [a-z_ ]{0,20}(list|patterns)\b|\bexcludes?\b|\brefuses?\b|"
    r"\bpre-?1\.\d|\bre-?index\b|\bnot yet\b|\bpartial\b|\bmay (be|not)\b|"
    r"\bNOT\b|\bno (content|embeddings?|index|dataset|repo|registry|traces?) [a-z]{2,12}\b|"
    r"\boptional(ly)? \[?[a-z]|\bwhen the optional\b|\bskipped\b|\bfalls? back\b)",
    re.I,
)
RETURN_SHAPE = re.compile(r"\b(returns?|reports?|surfaces?|emits?|yields?)\b", re.I)
EXAMPLE_CUE = re.compile(r"(e\.g\.|for example|such as|'[^']{2,40}'|\"[^\"]{2,40}\")")


def sentences(text):
    parts = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    return [s for s in parts if len(s.split()) >= 3]


def score_tool(tool, frame):
    desc = (tool.get("description") or "").strip()
    schema = tool.get("inputSchema") or {}
    props = schema.get("properties") or {}
    sents = sentences(desc)
    n_sent = len(sents)
    words = len(desc.split())

    # 6. Length and Completeness
    if n_sent >= 4:
        length = 5
    elif n_sent == 3:
        length = 4
    elif n_sent == 2:
        length = 3
    elif n_sent == 1 and words >= 8:
        length = 2
    else:
        length = 1

    # 1. Purpose
    # Judged on the whole description, not the opening sentence: several tools
    # open with a terse noun-phrase label and carry the behaviour immediately after.
    has_return = bool(RETURN_SHAPE.search(desc))
    if has_return and n_sent >= 2 and words >= 25:
        purpose = 5
    elif (n_sent >= 2 and words >= 15) or (has_return and words >= 12):
        purpose = 4
    elif words >= 8:
        purpose = 3
    elif words >= 5:
        purpose = 2
    else:
        purpose = 1

    # 2. Usage Guideline
    pos = bool(WHEN_TO_USE.search(desc))
    neg = bool(WHEN_NOT_TO_USE.search(desc))
    if pos and neg:
        guideline = 5
    elif pos:
        guideline = 4
    elif neg:
        guideline = 3
    elif n_sent >= 3:
        guideline = 3
    else:
        guideline = 2

    # 3. Limitation
    lim_hits = len(set(m.group(0).lower() for m in LIMITATION.finditer(desc)))
    if lim_hits >= 3:
        limitation = 5
    elif lim_hits == 2:
        limitation = 4
    elif lim_hits == 1:
        limitation = 3
    else:
        limitation = 1

    # 4. Parameter Explanation
    if not props:
        param = 5  # no parameters to explain
        param_note = "no-params"
    else:
        named = sum(1 for p in props if re.search(rf"\b{re.escape(p)}\b", desc))
        ratio_desc = named / len(props)
        schema_described = sum(
            1 for v in props.values()
            if isinstance(v, dict) and (v.get("description") or "").strip()
        )
        ratio_schema = schema_described / len(props)
        ratio = ratio_desc if frame == "paper" else max(ratio_desc, ratio_schema)
        if ratio >= 0.9:
            param = 5
        elif ratio >= 0.6:
            param = 4
        elif ratio >= 0.3:
            param = 3
        elif ratio > 0:
            param = 2
        else:
            param = 1
        param_note = f"prose={named}/{len(props)} schema={schema_described}/{len(props)}"

    # 5. Examples vs. Description Balance
    ex_hits = len(EXAMPLE_CUE.findall(desc))
    prose_chars = len(desc)
    if ex_hits == 0:
        examples = 5
    elif ex_hits * 60 < prose_chars * 0.5:
        examples = 5
    else:
        examples = 4

    scores = {
        "purpose": purpose,
        "usage_guideline": guideline,
        "limitation": limitation,
        "parameter_explanation": param,
        "examples_balance": examples,
        "length_completeness": length,
    }
    total = sum(scores.values())
    overall = round(((total - 6) / 24) * 100, 1)
    smells = [k for k, v in scores.items() if v < 3]
    return {
        "name": tool["name"],
        **scores,
        "overall": overall,
        "label": "Bad" if smells else "Good",
        "smells": smells,
        "n_sent": n_sent,
        "chars": len(desc),
        "param_note": param_note,
    }


SMELL_NAMES = {
    "purpose": "Unclear Purpose",
    "usage_guideline": "Missing Usage Guidance",
    "limitation": "Unstated Limitation",
    "parameter_explanation": "Opaque Parameters",
    "length_completeness": "Underspecified or Incomplete",
    "examples_balance": "Exemplar Issues",
}


def run(server_files, frame):
    all_rows = []
    print(f"\n{'='*72}\nFRAME: {frame}\n{'='*72}")
    for label, path in server_files:
        tools = json.loads(Path(path).read_text(encoding="utf-8"))
        rows = [score_tool(t, frame) for t in tools]
        for r in rows:
            r["server"] = label
        all_rows.extend(rows)
        smelly = [r for r in rows if r["smells"]]
        print(f"\n{label}: {len(rows)} tools | smell-free {len(rows)-len(smelly)} "
              f"({100*(len(rows)-len(smelly))/len(rows):.1f}%) | "
              f"median overall {sorted(r['overall'] for r in rows)[len(rows)//2]:.1f}")
        for comp, sname in SMELL_NAMES.items():
            n = sum(1 for r in rows if r[comp] < 3)
            med = sorted(r[comp] for r in rows)[len(rows)//2]
            print(f"   {sname:<30} median {med}/5   smelly {n:>3}/{len(rows)} ({100*n/len(rows):5.1f}%)")

    n = len(all_rows)
    smelly = [r for r in all_rows if r["smells"]]
    print(f"\nSUITE TOTAL: {n} tools | at least one smell: {len(smelly)} "
          f"({100*len(smelly)/n:.1f}%)  [paper baseline: 97.1%]")
    for comp, sname in SMELL_NAMES.items():
        c = sum(1 for r in all_rows if r[comp] < 3)
        print(f"   {sname:<30} {c:>3}/{n} ({100*c/n:5.1f}%)")
    return all_rows


if __name__ == "__main__":
    files = [
        ("jcodemunch", SP / "jcm_tools_full.json"),
        ("jdocmunch", SP / "jdoc_tools.json"),
        ("jdatamunch", SP / "jdata_tools.json"),
    ]
    paper = run(files, "paper")
    schema = run(files, "schema")
    json.dump({"paper": paper, "schema": schema},
              open(SP / "scores.json", "w", encoding="utf-8"), indent=1)

```

### Core Architecture Module: `benchmarks/goldset/corpus/go/collect/queue.go`
```
package collect

// Queue is the collection protocol target: Push appends an item.
type Queue struct{ items []string }

func (q *Queue) Push(item string) {
	q.items = append(q.items, item)
}

```

### Core Architecture Module: `src/jcodemunch_mcp/cli/hooks/__init__.py`
```
"""Claude Code hook handlers for jCodemunch enforcement.

One module per hook family; this facade re-exports only the ``run_*`` entry
points ``server.py`` dispatches. Tests import helpers from their defining
modules, the same way they monkeypatch them.
"""

from .briefing import run_subagentstart  # noqa: F401
from .reindex import run_copilot_posttooluse, run_posttooluse  # noqa: F401
from .snapshot import run_precompact, run_sessionstart  # noqa: F401
from .steering import run_pretooluse  # noqa: F401
from .taskcomplete import run_taskcomplete  # noqa: F401

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

### Incident Patch 1: `3f5f9e7e` (2026-10-06)
**Commit Message**: fix: a bare Python module name resolves to the script directory beside the importer (#972)

* fix: a bare Python module name resolves to the script directory beside the importer

A script's own directory is sys.path[0], so a directory of scripts imports
itself by bare name: `from checks import x` in `tools/run.py` names
`tools/checks.py`. resolve_specifier tried a bare name against the repo root
only, so no edge was built between the scripts.

The lookup climbs from the importer's directory through package directories
(inside a package a bare name is absolute) to the first directory without an
`__init__.py`, tries `<name>/__init__.py` then `<name>.py` there, and stops:
only that directory is on sys.path. It runs before the root lookup, because
the script directory comes first. Gated on a .py or .pyi importer and an
undotted specifier.

* fix: a bare name builds no edge for a standard-library name or inside a namespace sub-package (#972 follow-up)

Maintainer follow-up on @whakomatic's branch, from review. In a directory
with no __init__.py that sits inside a package, a bare import of a
standard-library or third-party name resolved to a same-named file beside
the importer; find_impo

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -85,6 +85,22 @@
   test held and the replacement does not, a caller released during work that passes no checkpoint,
   is the PyYAML case above.
 
+- **A bare Python module name resolves to the script directory beside the importer (#972, @whakomatic).**
+  `from checks import verify` in `tools/run.py` names `tools/checks.py`, because a script's own
+  directory is first on `sys.path`, but `resolve_specifier` tried a bare name against the repo root
+  only. No edge was built: `find_importers` returned nothing for the module and `find_dead_code`
+  listed it as dead. The lookup now climbs from the importer through package directories to the
+  first directory without an `__init__.py`, tries the name there before the root, and stops:
+  nothing above it is treated as being on `sys.path`. Two cases build no edge, because a false edge
+  gives a file an importer it does not have and `find_dead_code` then stops reporting it with no
+  sign. A standard-library name is never the file beside the importer (`import types` next to a
+  `types.py`). A directory without an `__init__.py` under a package at any level is read as a
+  namespace sub-package, where a bare name is absolute; a real script directory kept inside a
+  package (`pkg/tests/`) gets no edge either, as before this change. These can still build no edge, as before:
+  a dotted name through a directory with no `__init__.py` (`from helpers import util`), a nested
+  test directory importing a module beside a `conftest.py` above it, and a sibling that exists
+  only as `.pyi` (LEDGER L-120).
+
 ## [1.108.329] - 2026-10-05 - the parse budget stops a slow parse
 
 ### Fixed
```

**File**: `docs/workflows/LEDGER.md` (modified, +1/-0)
```diff
@@ -168,3 +168,4 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-117 | 2026-10-05, L-116 review round 2 | Three Python loops on the parse path are quadratic in file size. Since L-116 a file is stopped and named at `JCODEMUNCH_PARSE_BUDGET_SECONDS`; below the budget the time is still spent, and at the default 20 s that is a long wait per file. (1) `_find_enclosing_symbol` rebuilds its list of symbol starts and scans it for every call site, in the generic path every spec language uses: a 309,590-byte Python file of 6,250 functions and 20,000 module-level calls ran 9.62 s under the first form of L-116's fix, which did not stop it. (2) `_extract_razor_brace_block` scans to the end of the file for each `@code {`: a 50,000-byte Razor file held its caller 41.34 s on 1.108.329. (3) The dbt directive loop (`sql_preprocessor.extract_dbt_directives`, `_extract_preceding_docstring`) searches backward per directive: a 25,000-byte `.sql` of open comments and macros took 48.40 s on 1.108.329. All three: `evidence/l116_quadratic_shapes.txt`. Not run: how often real files have these shapes; the Jinja template path through `template_shared.py`. | `src/jcodemunch_mcp/parser/extractor.py` (`_find_enclosing_symbol`, `_extract_razor_brace_block`); `src/jcodemunch_mcp/parser/sql_preprocessor.py` | defect | medium | OPEN |
 | L-118 | 2026-10-05, L-116 review round 3 | Three regex calls over a whole file are superlinear on unclosed delimiters, and a regex call cannot be stopped part-way by the parse budget (it passes no checkpoint and holds the interpreter), so the caller waits for it and the file is named afterwards. At a 0.5 s budget (`evidence/l116_one_call_shapes.txt`): a 140,000-byte EJS file of `<% x` lines held its caller 30.90 s (`_EJS_SCRIPTLET_RE.finditer`), a 149,996-byte Astro file of `<!-- x` lines 11.16 s (the comment mask's `sub`), a 150,000-byte dbt `.sql` of `{% x` lines 23.63 s (`JINJA_PATTERN.sub`). The same on 1.108.329 (30.62, 11.21, 23.76 s). With the budget off the time about quadruples per doubling of the file: EJS 0.38, 1.47 and 6.50 s at 15, 30 and 60 KB, Astro 0.13, 0.54 and 2.01 s, dbt 0.29, 1.12 and 4.20 s (the same file's GROWTH lines). 61 `for` statements in the six parse-path modules iterate a `finditer`, `findall`, `split` or `splitlines` call, 57 of them in `extractor.py` (`evidence/l116_regex_iterables.txt`); each such call runs before its loop's checkpoint. Not run: which of those patterns can backtrack; any size above 150 KB. | `src/jcodemunch_mcp/parser/extractor.py` (`_parse_ejs_symbols`, the Astro comment mask); `src/jcodemunch_mcp/parser/sql_preprocessor.py` (`strip_jinja`) | defect | medium | OPEN |
 | L-119 | 2026-10-05, L-116 review round 2 | A Racket file with 12,500 nested parentheses (25,000 bytes) raises `RecursionError` out of `parse_file`, on 1.108.329 and after L-116 (`evidence/l116_one_call_shapes.txt`, first line of each half). The reader in `racket_reader.py` recurses per nesting level. What a user sees was not traced: whether the index names the file as a parse failure or loses it. Not run: the depth at which it starts; other recursive walkers on deeply nested input in other languages. | `src/jcodemunch_mcp/parser/racket_reader.py` | defect | low | OPEN |
+| L-120 | 2026-10-05, review of contributor PR #972 | A bare Python module name is resolved against the importer's script directory since #972 (`resolve_specifier`), and four spellings of the same dependency can still build no edge, so `find_importers` returns nothing for the target and `find_dead_code` can list it. (1) A dotted name through a directory with no `__init__.py`: `from helpers import util` beside a namespace `helpers/` (the branch is gated on a name with no dot; in a repo with no package the dotted form does resolve, through the source-root lookup). (2) A nested test directory importing a module that sits beside a `conftest.py` above it (`tests/unit/test_x.py` importing `tests/helpers.py` by bare name; pytest's rootdir insertion is not modelled). (3) A sibling that exists only as `.pyi`. (4) A real script directory kept inside a package (`pkg/tests/`, `pkg/demos/`): the follow-up commit on #972 refuses a directory with no `__init__.py` under a package at any level, because the same shape is a namespace sub-package where the edge is false (reproduced: `import openai` in `app/llms/openai/common_utils.py` resolved to an unimported `app/llms/openai/openai.py`, and `find_dead_code` then listed no dead file). The reviewer counted the branch's firings in the site-packages of this box's `C:\Program Files\Python310` (37,971 `.py`/`.pyi` files): 112 unguarded, 100 with the standard-library refusal, 47 with a refusal on the parent directory alone (round 1), 39 with the any-level refusal that shipped (round 2). Round 2 classed the 53 that the parent-only refusal drops as 39 plausible script edges and 14 names that are also an installed distribution, and the 8 more that the any-level refus
```

**File**: `src/jcodemunch_mcp/parser/imports.py` (modified, +37/-0)
```diff
@@ -5,6 +5,7 @@
 import os
 import posixpath
 import re
+import sys
 import threading
 from collections import deque
 from pathlib import Path
@@ -2248,6 +2249,42 @@ def resolve_specifier(
                     if cand in source_files:
                         return cand
 
+    # Python bare module name: a script's own directory is `sys.path[0]`, so
+    # `import checks` in `tools/run.py` is `tools/checks.py`, ahead of the root.
+    # Climb out of packages (there a bare name is absolute) to the first plain
+    # directory and stop: only that one is treated as being on `sys.path`.
+    #
+    # ⚠⚠ Two refusals, and both err toward NO edge. A false edge gives a file
+    # an importer it does not have, so `find_dead_code` stops reporting it and
+    # nothing shows; a missed edge is the behaviour before this branch existed.
+    # (1) A standard-library name is the standard library: `import types`
+    # beside a `types.py` is not that file. (2) A directory with no
+    # `__init__.py` that has a package ANYWHERE above it is a namespace
+    # sub-package, not a script directory (`pkg/files/main.py` is imported as
+    # `pkg.files.main`), so a bare name there is absolute. Any level, not the
+    # parent alone: `pkg/types/llms/` is the same shape one directory deeper.
+    # That also refuses a real script directory kept inside a package
+    # (`pkg/tests/`, `pkg/demos/`).
+    if (
+        importer_path.endswith((".py", ".pyi"))
+        and "." not in specifier
+        and "/" not in specifier
+        and specifier not in sys.stdlib_module_names
+    ):
+        script_dir = posixpath.dirname(importer_path)
+        while script_dir and f"{script_dir}/__init__.py" in source_files:
+            script_dir = posixpath.dirname(script_dir)
+        inside_a_package = False
+        above = script_dir
+        while above and not inside_a_package:
+            above = posixpath.dirname(above)
+            init = f"{above}/__init__.py" if above else "__init__.py"
+            inside_a_package = init in source_files
+        if script_dir and not inside_a_package:
+            for c in (f"{script_dir}/{specifier}/__init__.py", f"{script_dir}/{specifier}.py"):
+                if c in source_files:
+                    return c
+
     # Absolute: try direct match first (e.g., for Go or absolute paths)
     for c in _candidates(specifier):
         if c in source_files:
```

**File**: `tests/test_python_script_dir_imports.py` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+"""`from checks import x` in a script names the `checks.py` beside it.
+
+A script's own directory is `sys.path[0]`, so a directory of scripts imports
+itself by bare module name. `resolve_specifier` tried such a name against the
+repo root only, so no edge was built between the scripts.
+
+Each expectation below is what Python itself does: the script directory is the
+first directory at or above the importer with no `__init__.py`, it beats the
+root, and nothing above it is treated as being on `sys.path`.
+
+Two shapes build NO edge (maintainer follow-up on #972): a standard-library
+name, and a directory with no `__init__.py` under a package at any level. A false
+edge there gives a file an importer it does not have, and `find_dead_code`
+then stops reporting it.
+"""
+
+import pytest
+
+from jcodemunch_mcp.parser.imports import resolve_specifier
+from jcodemunch_mcp.tools.find_dead_code import find_dead_code
+from jcodemunch_mcp.tools.find_importers import find_importers
+from jcodemunch_mcp.tools.index_folder import index_folder
+
+_FILES = {
+    "tools/run.py",
+    "tools/checks.py",
+    "tools/dup.py",
+    "tools/dup/__init__.py",
+    "tools/steps/__init__.py",
+    "tools/steps/plan.py",
+    "tools/steps/cycle.py",
+    "pkg/__init__.py",
+    "pkg/logging.py",
+    "pkg/mod.py",
+    "top.py",
+    "other/top.py",
+    "other/user.py",
+    "scripts/helpers.py",
+    "scripts/sub/run.py",
+    "tools/types.py",
+    "tools/a/b.py",
+    "app/__init__.py",
+    "app/files/main.py",
+    "app/files/helper.py",
+    "app/files/types.py",
+    "app/tests/test_x.py",
+    "app/tests/util.py",
+    "app/types/llms/common.py",
+    "app/types/llms/openai.py",
+}
+
+
+@pytest.mark.parametrize("specifier, importer, expected", [
+    # the module beside the script
+    ("checks", "tools/run.py", "tools/checks.py"),
+    # a package directory beside the script (`from steps import plan`)
+    ("steps", "tools/run.py", "tools/steps/__init__.py"),
+    # a package wins over a module of the same name, as in Python's finder
+    ("dup", "tools/run.py", "tools/dup/__init__.py"),
+    # a subpackage module loaded by the script climbs to the script directory
+    ("checks", "tools/steps/plan.py", "tools/checks.py"),
+    # inside a package a bare name is absolute: `pkg/logging.py` is not it
+    ("logging", "pkg/mod.py", None),
+    ("cycle", "tools/steps/plan.py", None),
+    # only the script's own directory is on sys.path, not its parent
+    ("helpers", "scripts/sub/run.py", None),
+    # the script directory beats the root; the root answers when it misses
+    ("top", "other/user.py", "other/top.py"),
+    ("top", "tools/run.py", "top.py"),
+    ("top", "pkg/mod.py", "top.py"),
+    # a name with no file, and a non-Python importer
+    ("yaml", "tools/run.py", None),
+    ("checks", "tools/run.js", None),
+    # a standard-library name is the standard library, not the file beside it
+    ("types", "tools/run.py", None),
+    ("types", "app/files/main.py", None),
+    # a directory with no `__init__.py` inside a package is a namespace
+    # sub-package: a bare name there is absolute
+    ("helper", "app/files/main.py", None),
+    ("util", "app/tests/test_x.py", None),
+    # the same shape one directory deeper: the package is two levels up
+    ("openai", "app/types/llms/common.py", None),
+    # a path is not a module name
+    ("a/b", "tools/run.py", None),
+])
+def test_a_bare_name_resolves_where_python_finds_it(specifier, importer, expected):
+    assert resolve_specifier(specifier, importer, _FILES | {importer}) == expected
+
+
+def test_a_repo_whose_root_is_a_package_has_no_script_directory():
+    files = {"__init__.py", "tools/run.py", "tools/checks.py"}
+    assert resolve_specifier("checks", "tools/run.py", files) is None
+
+
+def test_find_importers_sees_a_script_directory_import(tmp_path):
+    src = tmp_path / "src"
+    store = tmp_path / "store"
+    (src / "tools" / "steps").mkdir(parents=True)
+    (src / "scripts" / "sub").mkdir(parents=True)
+    store.mkdir()
+    (src / "tools" / "checks.py").write_text("def verify():\n    return 1\n")
+    (src / "tools" / "run.py").write_text("from checks import verify\n\nverify()\n")
+    (src / "tools" / "steps" / "__init__.py").write_text("")
+    (src / "tools" / "steps" / "plan.py").write_text("import checks\n")
+    (src / "scripts" / "helpers.py").write_text("def h():\n    return 1\n")
+    (src / "scripts" / "sub" / "run.py").write_text("import helpers\n")
+    result = index_folder(str(src), use_ai_summaries=False, storage_path=str(store))
+    assert result["success"] is True
+
+    def importers(path):
+        r = find_importers(repo=result["repo"], file_path=path, storage_path=str(store))
+        return {i["file"] for i in r["importers"]}
+
+    assert importers("tools/checks.py") == {"tools/run.py", "tools/steps/plan.py"}
+    assert importers("scripts/helpers.py") == set()
+
+
+def test_a_namespace_sub_package_gets_
```

---

### Incident Patch 2: `e3a12cfa` (2026-10-06)
**Commit Message**: fix: the parse budget bounds a file's Python-side time, in the parsing thread, on every route (LEDGER L-116) (#978)

* fix: the parse budget bounds a file's Python-side time in the parsing thread, on every route (LEDGER L-116)

The thread wait around parse_file is gone. Building a Symbol and each node of
the generic walker is a checkpoint that raises inside a parse_file call once the
file's deadline has passed, so the first index has the limit, another thread's
time is not charged to a file, and no abandoned worker is left to write the
parse cache.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: retire the thread wait's witness, with its ledger entry (LEDGER L-116)

test_pathological_parse_raises_named_budget_error replaced parse_file with a
sleep and asserted the waiting caller returned. The budget is enforced in the
parsing thread now; the replacement is
tests/test_parse_budget_python_side.py::test_a_walk_past_the_deadline_is_stopped_and_the_file_named.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: the thread-time case does not race a second thread (LEDGER L-116)

The removed assertion ran 40 small parses beside a burner thread. It passed with
a wall-c

**File**: `CHANGELOG.md` (modified, +83/-0)
```diff
@@ -2,6 +2,89 @@
 
 ## [Unreleased]
 
+### Fixed
+
+- **The parse budget bounds a file's Python-side time, on every route, in the thread that parses
+  (LEDGER L-116).** 1.108.329 put the tree-sitter half of `JCODEMUNCH_PARSE_BUDGET_SECONDS` inside
+  the parser and left the other half, the time spent in Python after the tree is built, to the old
+  thread wait (`parse_file_budgeted`). That wait had four defects. The first index of a folder never
+  asked it. It was wall-clock, so a file was charged for time another thread held the interpreter. Its
+  worker could not be stopped, kept running after the caller was told the file is skipped, and with
+  `JCODEMUNCH_PARSE_CACHE` set stored that file's result in the parse cache. Its message counted
+  characters where the parse limit counts bytes. The wait is gone and no second thread replaces it:
+  the parsing thread checks its own deadline at a checkpoint (`parse_budget.checkpoint()`), and
+  inside a `parse_file` call a checkpoint raises once the deadline has passed. Such a limit holds
+  only where a checkpoint is passed, and review found a loop without one twice, so the rule is over
+  the source and a test holds it there: every `for` and `while` statement in the six modules a parse
+  runs through starts with a checkpoint, every function there that can call itself passes one, and
+  building a `Symbol` is one. Three loops are exempt, each named in the test with its reason (two
+  single passes over one symbol's characters, and one loop whose every iteration enters a function
+  that starts with a checkpoint). Measured on a 441,827-byte `.vue` whose plain `<script>` holds
+  6000 functions (L-115's shape), at a 2 s budget (`evidence/l116_vue_first_index_and_reindex.txt`):
+  on 1.108.329 the first index took 13.96 s and indexed the file with no warning, and a re-index
+  after an edit skipped and named it after 4.39 s and left a thread behind; now the first index
+  takes 2.86 s and the re-index 2.85 s, both name the file, and neither starts a thread. What
+  changes for a user:
+  - A file whose Python-side work runs past the budget (default 20 s) is skipped and named on the
+    first index and at any size. The first index used to wait for it, and the wait on the other
+    routes armed only at 128 KiB. A file that was indexed slowly can now be absent and named in
+    `warnings`; raise the variable to keep it. A 50,000-byte Razor file of repeated `@code {` lines
+    held its caller 41.34 s on 1.108.329 at a 2 s budget and was not named; it is stopped and named
+    after 2.01 s (`evidence/l116_quadratic_shapes.txt`).
+  - The deadline counts the parsing thread's own time. Beside one over-budget parse in a second
+    thread, a 201,780-char file that parses in 0.32 s alone was named over a 1 s budget in 9 of 60
+    calls on 1.108.329 and in 0 of 60 now (`evidence/l116_two_threads.txt`).
+  - A stopped file writes nothing. On 1.108.329 the parse cache held 0 rows for the skipped file
+    when the caller was told and 1 row after the abandoned worker ended; now 0 and 0, with no other
+    thread started (`evidence/l116_parse_cache.txt`).
+  - The warning counts bytes on every route.
+  - `SECURITY.md` loses the "An abandoned parse worker" line added in 1.108.329. The behaviour it
+    disclosed no longer exists: indexing starts no thread to parse a file.
+  What a checkpoint cannot do is cut one slow call short. Three things pass none: a regex over the
+  whole file (also when it is the iterable of a `for`, which runs before that loop's checkpoint), a
+  comprehension, and Python code outside the six modules, which here is PyYAML's loader. Such a
+  file is named after the call returns, at the next clock read (within 64 checkpoints) or by
+  `parse_file`, which reads the deadline once more at the end. Against the old wait, on the routes and sizes where it existed
+  (`evidence/l116_one_call_shapes.txt`, a 0.5 s budget): it could not cut a regex short either,
+  because the call holds the interpreter, and a 140,000-byte EJS file of unclosed scriptlets held
+  its caller 30.62 s on 1.108.329 and 30.90 s now, named both times; an Astro and a dbt file of
+  that kind took 11.21 s and 23.76 s then, 11.16 s and 23.63 s now. It did release its caller during
+  PyYAML, with the load still running behind it: a 400,000-byte YAML list was named after 0.53 s on
+  1.108.329 and is named after 1.87 s now. That is the one measured case where a caller waits
+  longer than before. With the deadline forced to pass as the tree-sitter parse returned, on 66
+  inputs of 400 KB, with every language enabled
+  (`evidence/l116_residue_probe.txt`, a probe written by this change's reviewer; the counts are the
+  file's own summary): 55 were stopped and named, 48 of them with the forced deadline in effect and
+  none more than 0.12 s past it, 7 by the real 0.3 s budget alone; the other 11 load no parser, so
+  the forced deadline never applied and they returned. The first form of
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ prohibition, a constraint whose violation causes a defect, or a rationale.
 | `JCODEMUNCH_LICENSE_KEY` | — | (v1.108.42) jCodeMunch license key (config key `license_key`). Gates the `org-rollup` team feature ONLY; everything else is free. Validated online vs `validate.php` (sticky-offline cache; 14-day grace for new orgs). **Requires a multi-seat tier — Studio or Platform** (v1.108.43); Builder doesn't unlock org-rollup. Check with the `license` CLI. |
 | `JCODEMUNCH_INDEX_CACHE_TTL` | 0 (off) | (v1.108.172) Seconds an unused hydrated index may sit in the in-memory cache before being released. **OPT-IN: 0/unset/garbage = disabled = today's behavior exactly.** ⚠ **Do NOT default this on** — cold hydration of a 665k-symbol index was measured at 7.5-11.4 min (#370), so evicting during a quiet spell hands the next query that bill. For hosts whose MCP client leaks stdio servers (#375: 25+ instances, ~17 GB), where each idle process otherwise sits on its own cache. Swept on access, no timer thread. |
 | `JCODEMUNCH_PROVIDER_BUDGET_SECONDS` | 30.0 | (v1.108.182) Wall-clock ceiling on ONE context provider's `detect()`+`load()`. Discovery runs before a single file is indexed, so an unbounded provider takes the whole index down with it (#375). On overrun the provider is skipped and NAMED in `providers_skipped` + `warnings`. `0`/negative = no ceiling (pre-.182 inline behaviour). ⚠ **A watchdog stops the CALLER waiting; it cannot stop the work** — Python cannot preempt a thread, so the abandoned provider keeps burning CPU until it finishes or polls `budget_expired()`. Only the Express walk polls it so far. |
-| `JCODEMUNCH_PARSE_BUDGET_SECONDS` | 20.0 | (v1.108.182; L-114) Per-file ceiling on a file's tree-sitter parses, enforced INSIDE `parse_file` (`parser/parse_budget.py`), so every indexing route and every file size has it. On overrun the parse is stopped and the file is named in the index result's `warnings`. ⚠⚠ **A thread wait cannot do this**: the parse holds the GIL, so the old watchdog returned only when the parse did. The cancel is tree-sitter's `timeout_micros` (deprecated in 0.25; the progress callback that replaces it crashed the interpreter here). ⚠ **A stop is recognised by what the binding raises, never by a clock.** ⚠ Two clocks: between a file's parses the deadline is the parsing THREAD's own time; inside one it is tree-sitter's wall timer, so a box starved by other processes can stop a file that would fit. ⚠⚠ **Do not route the first index through `parse_file_budgeted`**: its wall-clock wait (every other route, at or above 128 KiB, Python-side time) charges a file for another thread's time and leaves the abandoned walk running (L-116). `0`/negative disables. |
+| `JCODEMUNCH_PARSE_BUDGET_SECONDS` | 20.0 | (v1.108.182; L-114, L-116) Per-file ceiling on a file's parse, tree-sitter and Python side, enforced INSIDE `parse_file` (`parser/parse_budget.py`) in the parsing thread, so every indexing route and every file size has it. On overrun the file is skipped and named in the index result's `warnings`. ⚠⚠ **Never wait on a parse from a second thread**: the parse holds the GIL, so the old watchdog returned only when the parse did; on Python-side work it charged a file for another thread's time and left its worker running. The C parse is cancelled by tree-sitter's `timeout_micros` (deprecated in 0.25; the progress callback that replaces it crashed the interpreter here). ⚠ **A stop is recognised by what the binding raises, never by a clock.** ⚠⚠ **The Python side is COOPERATIVE**: it holds only where `parse_budget.checkpoint()` is passed, so EVERY `for`/`while` on the parse path starts with one (`tests/test_parse_budget_python_side.py` scans the source; review found an unchecked quadratic loop twice). ⚠ One slow call (a whole-file regex, PyYAML) is NOT cut short; the file is named when it returns. ⚠ Two clocks: outside a parse the deadline is the parsing THREAD's own time; inside one it is tree-sitter's wall timer, so a box starved by other processes can stop a file that would fit. `0`/negative disables. |
 | `JCODEMUNCH_MAX_FILE_SIZE` | 512000 | (v1.108.193, @dkiaulakis) Per-file byte cap for indexing (config key `max_file_size`; **settable per-project in `.jcodemunch.jsonc` as of v1.108.197 — before that the project file was parsed and then ignored**). ⚠ **This was the ONE limit of three with no route at all** — its neighbours `max_index_files`/`max_folder_files` each had a resolver, this was hardcoded. **Default deliberately UNCHANGED**; this is an escape hatch. ⚠ A file over the cap is `too_large`, which is now **WITHHELD** (real+current+wanted) rather than an ordinary exclusion, so it makes coverage `complete: false` and **refuses absence claims**. |
 | `JCODEMUNCH_RESPECT_CACHEDIR_TAG` | 1 | (v1.108.270) Honour the Cache Directory Tagging Specification (<https://bford.info/cachedir/>): prune any directory holding a `CACHEDIR.TAG` whose **first 43 bytes** are the spec signature (conf
```

**File**: `KEY-FILES.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ src/jcodemunch_mcp/
     languages.py       # LANGUAGE_REGISTRY, extension → language map, LanguageSpec
     extractor.py       # parse_file() dispatch; custom parsers for Erlang, Fortran, SQL, Razor
     grammar_pack.py    # (#608) Which GENERATION of tree-sitter-language-pack is installed (bundled 0.x / download 1.x / absent) and what that costs; records a grammar-load failure per language, once, where the extractor used to swallow it as `[]`. A leaf that never calls the pack's network API: the unavailable-language list is what the extractor SAW fail, never a manifest lookup. Read by index_folder (warnings + `grammar_pack` block), evidence/capability.py (`grammar_source`) and install-status; on a bundled pack with no failures `notice()` is None so a 0.x result is byte-identical
-    parse_budget.py    # (L-114) The per-file parse budget, enforced in the parser: `armed()` opens one deadline per `parse_file` call (a nested call shares it), counted in the parsing thread's own time between parses and by tree-sitter's wall timer inside one; `bind()` wraps a parser so tree-sitter's own timeout stops the parse at the deadline, and a cancel swallowed by a dedicated parser is still raised by `parse_file`. Stdlib-only leaf; `ParseBudgetExceeded` lives here and `tools/_indexing_pipeline` re-exports it.
+    parse_budget.py    # (L-114, L-116) The per-file parse budget, enforced in the parser: `armed()` opens one deadline per `parse_file` call (a nested call shares it), counted in the parsing thread's own time between parses and by tree-sitter's wall timer inside one; `bind()` wraps a parser so tree-sitter's own timeout stops the parse at the deadline, and a cancel swallowed by a dedicated parser is still raised by `parse_file`. `checkpoint()` is the Python side: the first statement of every loop in the modules a parse runs through (three exemptions, named in the test) and called where a `Symbol` is built; `parse_file` reads the deadline once more at its end; it raises inside a `parse_file` call once the deadline has passed, and is one attribute read outside one. Stdlib-only leaf; `ParseBudgetExceeded` lives here and `tools/_indexing_pipeline` re-exports it.
     fqn.py             # PHP FQN ↔ symbol_id translation (PSR-4); symbol_to_fqn(), fqn_to_symbol()
   encoding/
     __init__.py          # Dispatcher: encode_response(tool, response, format) — auto/compact/json
```

**File**: `SECURITY.md` (modified, +0/-1)
```diff
@@ -396,7 +396,6 @@ Everything jCodeMunch does beyond answering a tool call is listed here. All of i
 - **Local per-tool savings attribution.** `~/.code-index/_savings.json` records how much of your lifetime token-savings total each tool earned (a map of tool name to a running count, plus the date attribution started). It exists because the meter previously stored a single lifetime number, so "which tools produced this" had no answer — including for us, when we needed to size the effect of a baseline correction. **This stays on your machine**: the anonymous meter above sends the aggregate total and never a per-tool breakdown, and a test in the suite fails if that payload ever changes shape. Tool names only — no code, no paths, no queries, no repo names. Counts earned before this shipped cannot be attributed retroactively and are reported as `lifetime_unattributed` rather than dropped. Read it with `get_session_stats`; delete `~/.code-index/` to erase it.
 - **Startup import of the local embedding backend.** When a native embedding provider is configured (the bundled ONNX encoder, or a sentence-transformers model), the server imports that library at startup, on the main thread, before it begins serving. That adds a few seconds to launch and is not optional polish: importing it later, on the worker thread a tool call runs in, deadlocks on the Windows loader lock and hangs the call forever. Nothing is downloaded and no model is loaded — the import alone is what matters, and no network is touched. Opt out with `JCODEMUNCH_EAGER_EMBED_IMPORT=0`.
 - **In-process embedding cache.** After a semantic search reads a repository's stored vectors out of `~/.code-index/`, the decoded matrix stays in that server process's memory so the next query doesn't re-read and re-decode the whole thing (roughly 46 MB for a 30,000-symbol index). At most 2 repositories are held at a time, it is dropped when the index is written, and it dies with the process — nothing is written anywhere and no network is touched. Turn retention off with `JCODEMUNCH_EMBED_MATRIX_CACHE=0`.
-- **An abandoned parse worker.** When a file of 128 KiB or more is indexed by an incremental `index_folder`, by `index_file` or by `index_repo`, its parse runs in a worker thread so the index can stop waiting at `JCODEMUNCH_PARSE_BUDGET_SECONDS` (default 20). If the wait expires the file is skipped and named in `warnings`, and the worker **keeps running until its work ends**, which can be after the tool call has returned: Python cannot stop a thread. It is a daemon thread inside the server process, reads nothing new, opens no connection, and dies with the process. It writes one thing, and only when `JCODEMUNCH_PARSE_CACHE` is set: that file's parse result, into the parse cache, when it finishes. The first index of a local folder does not use it. `JCODEMUNCH_PARSE_BUDGET_SECONDS=0` disables the wait and the worker with it.
 - **Agent hooks.** `init` / `install` can write hook entries (auto-reindex on edit, read-interception nudges) into your MCP client's settings. They're offered during the interactive flow, shown before writing, and fully removed by `uninstall`.
 - **Local index storage.** Indexes live at `~/.code-index/` (override with `CODE_INDEX_PATH`). Delete the directory and every trace of indexing is gone.
 - **Live session journal.** While the server runs, it periodically writes a small `_session_live.json` in `~/.code-index/` recording the files and searches the agent touched this session (paths and query strings only, no file contents). It exists so the out-of-process PreCompact hook can restore session orientation after context compaction. Throttled, atomically written, overwritten in place; disable with `JCODEMUNCH_LIVE_JOURNAL=0`.
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +3/-2)
```diff
@@ -348,7 +348,8 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_pagerank.py | `compute_pagerank` scores sum to 1, respect edge direction/convergence, and `search_symbols` ranking integrates centrality. | `c0ad048 feat: PageRank / centrality ranking (v1.11.12)`; docstring "Feature 2 from upgrades-PRD.md" | 1 | LOAD-BEARING | Cites a PRD document; verify it still exists before relying on the citation (cf. the phantom PRD noted for get_endpoint_impact). |
 | tests/test_paid_embeddings_optin.py | `_detect_provider` never selects a paid cloud embedding provider from an API key alone -- the explicit `*_EMBED_MODEL` is the opt-in and the local ONNX encoder wins at priority 0. | `2971bb2 test: pin that a bare cloud key cannot select a paid embedding provider`; docstring: suite-parity check for a jdocmunch defect, deliberately NOT a port of its gate | 8 | LOAD-BEARING | Pins a property jcm already had so a "simplification" cannot remove it; env-only, no network. |
 | tests/test_parity_map.py | `get_parity_map` classifies ported/renamed/diverged/added/orphaned symbols across two scopes, computes `parity_pct`, orders the port plan topologically with SCC grouping, errors on same scope/unindexed/empty, and is read-only. | `07bbb0c get_parity_map: correspondence-aware migration parity map (v1.108.111)`; docstring | 1 | LOAD-BEARING | Fixture is a legacy/ vs v2/ tree with commented expected outcomes per symbol. |
-| tests/test_parse_budget_cancels.py | An over-budget tree-sitter parse is stopped at `JCODEMUNCH_PARSE_BUDGET_SECONDS` and the file is named in `warnings`, on `parse_file`, a full index and an incremental re-index, at any file size; a stop is recognised without a clock; another thread's time is not charged to the file; a first index starts no wait thread; the installed binding can still cancel a parse. | LEDGER L-114 (2026-10-04): the thread wait could not return while the parse held the GIL | 5 | LOAD-BEARING | The slow input is L-113's shape; each cancelled case costs its 0.25 s budget. The fake-parser cases pin both directions of the stop rule and the expired-deadline branch (review rounds found mutants that passed an earlier form). `test_a_first_index_leaves_no_thread_behind` is the L-116 decision: do not invert it without fixing the wait's clock. The binding canary fails when `Parser.timeout_micros` is gone |
+| tests/test_parse_budget_cancels.py | An over-budget tree-sitter parse is stopped at `JCODEMUNCH_PARSE_BUDGET_SECONDS` and the file is named in `warnings`, on `parse_file`, a full index and an incremental re-index, at any file size; a stop is recognised without a clock; another thread's time is not charged to the file; a first index starts no wait thread; the installed binding can still cancel a parse. | LEDGER L-114 (2026-10-04): the thread wait could not return while the parse held the GIL | 5 | LOAD-BEARING | The slow input is L-113's shape; each cancelled case costs its 0.25 s budget. The fake-parser cases pin both directions of the stop rule and the expired-deadline branch (review rounds found mutants that passed an earlier form). `test_a_first_index_leaves_no_thread_behind` predates L-116's fix and still holds; every route is in `tests/test_parse_budget_python_side.py`. `OLD_WAIT_GATE` is the retired wait's 128 KiB threshold, kept as a fixture boundary. The binding canary fails when `Parser.timeout_micros` is gone |
+| tests/test_parse_budget_python_side.py | A file's Python-side work is stopped at `JCODEMUNCH_PARSE_BUDGET_SECONDS` in the parsing thread and the file is named: the generic walker, dedicated parsers, a regex language, seven walkers on a tree that builds no symbol, and three quadratic loops that are no recursion. Over the source: every `for`/`while` in the six parse-path modules starts with a checkpoint (three named exemptions), no recursion lacks one, every module of `parser/` is classified. Also: a parser that swallows the stop builds nothing more; a parser-side stop raises at the next checkpoint; a file that ends past its deadline with no checkpoint having seen it is named; time the thread did not spend is not charged; a first index and a re-index name the same file the same way; every file is parsed on the calling thread; no clock is read outside a file or with the budget off. | LEDGER L-116 (2026-10-05): the thread wait was wall-clock, skipped one route and left its worker running | 5 | LOAD-BEARING | The clock is the test's: the deadline passes 5.5 s into a 5 s budget when the file's C parse returns, so nothing depends on a slow fixture and a far-over-only stop fails. ⚠ A new loop on the parse path fails the scan until its first statement is `parse_budget.checkpoint()`; do NOT add it to the exemption table to pass (each entry there has its reason beside it). A new module in `parser/` must be put on or off the path. The scans see statements, not a comprehension, a loop's iterable or one slow call (L-118) |
 | tests/test_parse
```

**File**: `docs/workflows/LEDGER.md` (modified, +5/-2)
```diff
@@ -163,5 +163,8 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-112 | 2026-10-02, L-102 review round 2 | `tools/index_folder.py` walks `package.json` `main`/`module`/`browser`/`exports`/`bin` with its own code and its own extension list (no `/index.*`, no `scripts`) to force-include the files a manifest names. It answers a different question from `_entry_points.package_json_entries` (which files to index, not which are roots) with a second copy of the same derivation, so a field one learns the other does not: a file only a script runs is not force-included. Route it through the one reader, or state why the two differ. | `src/jcodemunch_mcp/tools/index_folder.py`; `src/jcodemunch_mcp/tools/_entry_points.py` | defect | low | OPEN |
 | L-113 | 2026-10-04, harness F-41 | A Python file parses in QUADRATIC time in a run of comment lines that follows any statement. `parser.parse` alone, tree-sitter's Python grammar, 4000 80-character comment lines (`evidence/l113_shapes.txt`): after a function 4.452 s, after a plain `x = 1` with no block anywhere 4.436 s, after an `import` and BEFORE the function 4.501 s, after a class, inside a class or function body, after a dedent: 4.4 to 4.9 s each. Free: a run that OPENS the file (0.004 s) and a run inside parentheses (0.003 s). The cost tracks lines times run bytes, not file size: 40000 one-character `#` lines, 80,035 bytes, take 11.615 s, and by length (`evidence/l113_ts_probe.txt`) 500 lines 0.075 s, 1000 0.303 s, 2000 1.145 s, 6300 lines (510,335 bytes) 11.284 s, then (`evidence/l113_shapes.txt`) 8000 lines 17.653 s, 9000 lines 22.324 s. The same bytes as code lines, as one docstring, or as `//` comments in JavaScript parse in under 0.02 s. What a user sees: a module with a long commented-out region or a data dump in comments indexes slowly, at any file size the cap admits; whether it is then skipped depends on the path (L-114). An earlier draft of this row said the run had to follow an INDENTED BLOCK; the review's shapes (rows A to S of `evidence/l113_shapes.txt`) refuted that. Not measured: how many files in real corpora carry such a run, other indentation-scanner grammars (YAML, Nim, F#), and whether a newer grammar release has it. Found because six cases of `tests/test_size_cap_end_to_end.py` took 14 to 16 s each; that fixture now opens with its padding. Possible fix, not designed: hand the grammar a copy with comment-only lines blanked to the same byte length (offsets hold; a `#` line inside a string would be blanked too, so text must still be read from the original bytes), which changes parse input and so needs a `PARSER_GENERATION` decision. | `src/jcodemunch_mcp/parser/extractor.py` (`_parse_with_spec`) | defect | medium | OPEN |
 | L-114 | 2026-10-04, harness F-41 review | `JCODEMUNCH_PARSE_BUDGET_SECONDS` cannot stop or shorten a slow tree-sitter parse on any route, and one route does not ask it to. All of this is `evidence/l114_budget.txt`, budget 2 s, a 324,035-byte file that takes about 4.5 s to parse (L-113's shape). **The mechanism:** `parse_file_budgeted` waits with `worker.join(budget)`, and tree-sitter's parse holds the GIL for its whole duration: a ticker thread asked to tick every 50 ms ticked ONCE during a 4.57 s parse (about 91 were due), and `join(2.0)` returned after 4.57 s with the worker already finished. So the wait cannot return early, and by the time it returns the parse is usually done: four direct calls in one process raised `ParseBudgetExceeded` once (the cold first call, after 4.44 s) and returned the file's symbols three times (4.57 to 4.72 s), with no warning. The budget therefore bounds neither the latency nor, reliably, the outcome, and while the parse runs no other Python thread in the server runs either. **The routes** in `tools/index_folder.py`: the full-index loop calls `parse_file` directly (line 2928), so the budget is never consulted: a first index took 4.58 s with `incremental=True` (the default) and 4.75 s with `incremental=False`, each `warnings None` and no budgeted call; the incremental re-index (`parse_and_prepare_incremental`, line 2748) and the immediate route (`parse_immediate`, line 2120) reach `parse_file_budgeted`: a re-index after an edit took 4.70 s, made the budgeted call, got symbols back after 4.54 s, and reported no warning. CLAUDE.md's Env Vars row says an overrun file "is skipped and named in the index result's `warnings` instead of the run hanging" and adds that a watchdog cannot stop the work; measured, it does not skip or name the file either, in 4 of the 5 calls quoted here (6 of the 8 over-budget calls in the evidence file; both that raised were a process's cold first call). By the same mechanism the budget does bound time spent in Python code, which releases the GIL between bytecodes (the round-3 reviewer's probe: a 5 s pure-Python loop raised after 2.03 s; not in the evidence file); that was not what stalled here. Not run: the watcher's path, `index_repo`, a gramma
```

**File**: `harness/retired.json` (modified, +7/-0)
```diff
@@ -148,6 +148,13 @@
       "replacement": "tests/test_framework_script_bindings.py::test_a_local_function_binding_is_a_function",
       "commit": "L-42",
       "date": "2026-09-27"
+    },
+    {
+      "path": "tests/test_v1_108_182.py::test_pathological_parse_raises_named_budget_error",
+      "lesson": "A wait in a second thread is not a limit on the work. The test replaced `parse_file` with a 30 s sleep, which releases the GIL, and asserted the waiting caller came back inside the budget: true for a sleep, false for a tree-sitter parse (L-114, it holds the GIL) and wrong for a Python walk (L-116: the wait was wall-clock, so a file was charged for time another thread held the GIL, and the abandoned worker kept running and could write the parse cache). It stated the mechanism, a caller that returns, and not the outcome, work that stops (Practice 9). The budget is enforced in the parsing thread now, so a fake `parse_file` that sleeps is not stopped by anything and the assertion cannot hold.",
+      "replacement": "tests/test_parse_budget_python_side.py::test_a_walk_past_the_deadline_is_stopped_and_the_file_named",
+      "commit": "L-116",
+      "date": "2026-10-05"
     }
   ]
 }
```

**File**: `src/jcodemunch_mcp/parser/astro_shared.py` (modified, +4/-0)
```diff
@@ -5,6 +5,8 @@
 import re
 from typing import Optional
 
+from . import parse_budget
+
 
 _ASTRO_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
 
@@ -16,6 +18,7 @@ def split_astro_frontmatter(text: str) -> tuple[Optional[str], str, int, int]:
 
     i = 0
     while i < len(lines) and lines[i].strip() == "":
+        parse_budget.checkpoint()
         i += 1
 
     if i >= len(lines) or lines[i].strip() != "---":
@@ -24,6 +27,7 @@ def split_astro_frontmatter(text: str) -> tuple[Optional[str], str, int, int]:
     start = i + 1
     j = start
     while j < len(lines):
+        parse_budget.checkpoint()
         if lines[j].strip() == "---":
             frontmatter = "".join(lines[start:j])
             remainder = "".join(lines[j + 1:])
```

---

### Incident Patch 3: `c892fcb5` (2026-10-05)
**Commit Message**: fix: the parse budget stops a slow tree-sitter parse, on every route (LEDGER L-114) (#975)

* fix: the parse budget stops a slow tree-sitter parse, on every route (LEDGER L-114)

The budget was a thread wait, and the parse holds the GIL, so the wait
returned only when the parse did. The limit now sits in the parser:
parse_file opens one deadline per file, grammar_pack.get_parser returns a
parser carrying what is left of it, and tree-sitter's own timeout ends
the parse in C.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: the bound parser carries named attributes, not a computed pass-through (full tier, test_grammar_spelled_forms)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: a stop is recognised without a clock, the deadline is the parsing thread's own time, the full index asks the thread wait (review round 1)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs: L-114's entry, row and env line state the three review changes and what stays unbounded; L-115 records the slow Vue walk (review round 1)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: the first index keeps off the wall-clock wait, a stopped parser is reset, four guards the rev

**File**: `CHANGELOG.md` (modified, +40/-0)
```diff
@@ -2,6 +2,46 @@
 
 ## [Unreleased]
 
+### Fixed
+
+- **`JCODEMUNCH_PARSE_BUDGET_SECONDS` stops a slow parse (LEDGER L-114).** The budget was a thread wait
+  around `parse_file`, and tree-sitter's parse holds the GIL for its whole duration, so the wait could
+  not return before the parse did. An over-budget file came back with its symbols and no warning after
+  the full parse time, and the first index of a folder never consulted the budget at all. The limit is
+  now inside the parser: `parse_file` opens one deadline per file, the one loader every grammar call
+  uses (`grammar_pack.get_parser`) hands back a parser carrying what is left of it, and tree-sitter's
+  own timeout ends the parse in the C code. Measured at a 2 s budget on a 324,035-byte file that takes
+  4.66 s to parse (`evidence/l114_after.txt`): `parse_file` raised `ParseBudgetExceeded` after 2.01 to
+  2.07 s on four calls of four, and a first index, an incremental first index and a re-index after an
+  edit each finished in 2.22 to 2.26 s with the file named in `warnings` and the other file's symbol
+  kept. What changes for a user:
+  - The parse limit applies to a file of any size (the old wait armed only at 128 KiB) and on every
+    indexing route. A file whose tree-sitter parse runs past the default 20 s is now skipped and
+    named where a first index used to wait for it.
+  - Between a file's parses the deadline counts the parsing thread's own time, so a parse in
+    another thread of the server cannot spend it: 0 of 192 under-budget files were skipped beside an
+    over-budget parse in a second thread (`evidence/l114_r2_two_threads.txt`), and 0 of 120 across
+    ten first indexes run beside another (`evidence/l114_r3_first_index_two_threads.txt`). The index
+    that holds a stopped file still returns later than the budget while another thread is busy (4.67
+    to 7.12 s at a 2 s budget in that second run), because the time it waits for the interpreter
+    between steps is not charged. Inside a parse the timer is tree-sitter's own and it is
+    wall-clock, so other PROCESSES can spend a file's budget: beside 48 CPU-burning processes on 24 cores, a file that parses in 0.672 s alone was
+    stopped at a 1.01 s budget 12 times of 12 (`evidence/l114_r4_other_processes.txt`). The file is
+    named when that happens; not measured at the default 20 s.
+  Parsing this package's 287 Python files took a mean 3.167 s with the budget on and 3.130 s with
+  it off over five alternating rounds (`evidence/l114_cost.txt`). Not covered, and unchanged by this
+  release: time spent in Python after the tree is built. The first index waits for it (a Vue file
+  slow in that walk was indexed after 14.91 s at a 2 s budget, no warning); every other route (an
+  incremental `index_folder`, `index_file`, `index_repo`) still wraps it in the old thread wait, which
+  is wall-clock, arms at 128 KiB, skipped and named the same file after 4.27 s on a re-index
+  (`evidence/l114_r2_python_side.txt`) and can charge a file for another thread's time (L-116; the
+  slow walk itself is L-115). Also not covered: `search_ast` parses outside
+  the budget (`get_changed_symbols` is inside it, and reports an over-budget file as one it could
+  not diff), and the mechanism is `Parser.timeout_micros`, which tree-sitter 0.25 deprecates. Its
+  replacement, the progress callback, crashed the interpreter on every variant tried
+  (`evidence/l114_read_cb_variants.txt`), and a test fails if an installed tree-sitter can no longer
+  cancel a parse.
+
 ## [1.108.328] - 2026-10-04 - a file a package.json script runs is an entry point
 
 ### Fixed
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ prohibition, a constraint whose violation causes a defect, or a rationale.
 | `JCODEMUNCH_LICENSE_KEY` | — | (v1.108.42) jCodeMunch license key (config key `license_key`). Gates the `org-rollup` team feature ONLY; everything else is free. Validated online vs `validate.php` (sticky-offline cache; 14-day grace for new orgs). **Requires a multi-seat tier — Studio or Platform** (v1.108.43); Builder doesn't unlock org-rollup. Check with the `license` CLI. |
 | `JCODEMUNCH_INDEX_CACHE_TTL` | 0 (off) | (v1.108.172) Seconds an unused hydrated index may sit in the in-memory cache before being released. **OPT-IN: 0/unset/garbage = disabled = today's behavior exactly.** ⚠ **Do NOT default this on** — cold hydration of a 665k-symbol index was measured at 7.5-11.4 min (#370), so evicting during a quiet spell hands the next query that bill. For hosts whose MCP client leaks stdio servers (#375: 25+ instances, ~17 GB), where each idle process otherwise sits on its own cache. Swept on access, no timer thread. |
 | `JCODEMUNCH_PROVIDER_BUDGET_SECONDS` | 30.0 | (v1.108.182) Wall-clock ceiling on ONE context provider's `detect()`+`load()`. Discovery runs before a single file is indexed, so an unbounded provider takes the whole index down with it (#375). On overrun the provider is skipped and NAMED in `providers_skipped` + `warnings`. `0`/negative = no ceiling (pre-.182 inline behaviour). ⚠ **A watchdog stops the CALLER waiting; it cannot stop the work** — Python cannot preempt a thread, so the abandoned provider keeps burning CPU until it finishes or polls `budget_expired()`. Only the Express walk polls it so far. |
-| `JCODEMUNCH_PARSE_BUDGET_SECONDS` | 20.0 | (v1.108.182) Per-file wall-clock ceiling on `parse_file`, via `parse_file_budgeted`. On overrun the file is skipped and named in the index result's `warnings` instead of the run hanging. ⚠ **Armed only at or above 128 KiB** (`_PARSE_WATCHDOG_MIN_BYTES`) so the common path stays inline — a 2 KB file that takes 20s is a bug to see, not to paper over. `0`/negative disables. Same no-preemption caveat: tree-sitter is C code. |
+| `JCODEMUNCH_PARSE_BUDGET_SECONDS` | 20.0 | (v1.108.182; L-114) Per-file ceiling on a file's tree-sitter parses, enforced INSIDE `parse_file` (`parser/parse_budget.py`), so every indexing route and every file size has it. On overrun the parse is stopped and the file is named in the index result's `warnings`. ⚠⚠ **A thread wait cannot do this**: the parse holds the GIL, so the old watchdog returned only when the parse did. The cancel is tree-sitter's `timeout_micros` (deprecated in 0.25; the progress callback that replaces it crashed the interpreter here). ⚠ **A stop is recognised by what the binding raises, never by a clock.** ⚠ Two clocks: between a file's parses the deadline is the parsing THREAD's own time; inside one it is tree-sitter's wall timer, so a box starved by other processes can stop a file that would fit. ⚠⚠ **Do not route the first index through `parse_file_budgeted`**: its wall-clock wait (every other route, at or above 128 KiB, Python-side time) charges a file for another thread's time and leaves the abandoned walk running (L-116). `0`/negative disables. |
 | `JCODEMUNCH_MAX_FILE_SIZE` | 512000 | (v1.108.193, @dkiaulakis) Per-file byte cap for indexing (config key `max_file_size`; **settable per-project in `.jcodemunch.jsonc` as of v1.108.197 — before that the project file was parsed and then ignored**). ⚠ **This was the ONE limit of three with no route at all** — its neighbours `max_index_files`/`max_folder_files` each had a resolver, this was hardcoded. **Default deliberately UNCHANGED**; this is an escape hatch. ⚠ A file over the cap is `too_large`, which is now **WITHHELD** (real+current+wanted) rather than an ordinary exclusion, so it makes coverage `complete: false` and **refuses absence claims**. |
 | `JCODEMUNCH_RESPECT_CACHEDIR_TAG` | 1 | (v1.108.270) Honour the Cache Directory Tagging Specification (<https://bford.info/cachedir/>): prune any directory holding a `CACHEDIR.TAG` whose **first 43 bytes** are the spec signature (config key `respect_cachedir_tag`). ⚠⚠ **The signature is VERIFIED — a file merely NAMED `CACHEDIR.TAG` excludes nothing.** A name-only check is an assertion about one instance of the property instead of the property, which is the exact defect class this answers. ⚠ The only exclusion rule here **declared by the WRITER** rather than listed by us, so a tool that drops a cache in your tree is honoured without jcm knowing its name, and it covers caches that are **not dotted** (which a dot-dir rule cannot). Counted as `cache_dir` in `discovery_skip_counts`; **NOT a withheld reason**, so absence stays citable — a tagged dir is derived data by its writer's own declaration, i.e. corpus definition like `gitignore`. Only an explicit `false` disables it. ⚠ Local walks only; `index_repo` is deliberately uncovered because validating the signature needs blob CONTENT the tree listing does not carry.
```

**File**: `KEY-FILES.md` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ src/jcodemunch_mcp/
     languages.py       # LANGUAGE_REGISTRY, extension → language map, LanguageSpec
     extractor.py       # parse_file() dispatch; custom parsers for Erlang, Fortran, SQL, Razor
     grammar_pack.py    # (#608) Which GENERATION of tree-sitter-language-pack is installed (bundled 0.x / download 1.x / absent) and what that costs; records a grammar-load failure per language, once, where the extractor used to swallow it as `[]`. A leaf that never calls the pack's network API: the unavailable-language list is what the extractor SAW fail, never a manifest lookup. Read by index_folder (warnings + `grammar_pack` block), evidence/capability.py (`grammar_source`) and install-status; on a bundled pack with no failures `notice()` is None so a 0.x result is byte-identical
+    parse_budget.py    # (L-114) The per-file parse budget, enforced in the parser: `armed()` opens one deadline per `parse_file` call (a nested call shares it), counted in the parsing thread's own time between parses and by tree-sitter's wall timer inside one; `bind()` wraps a parser so tree-sitter's own timeout stops the parse at the deadline, and a cancel swallowed by a dedicated parser is still raised by `parse_file`. Stdlib-only leaf; `ParseBudgetExceeded` lives here and `tools/_indexing_pipeline` re-exports it.
     fqn.py             # PHP FQN ↔ symbol_id translation (PSR-4); symbol_to_fqn(), fqn_to_symbol()
   encoding/
     __init__.py          # Dispatcher: encode_response(tool, response, format) — auto/compact/json
```

**File**: `SECURITY.md` (modified, +1/-0)
```diff
@@ -396,6 +396,7 @@ Everything jCodeMunch does beyond answering a tool call is listed here. All of i
 - **Local per-tool savings attribution.** `~/.code-index/_savings.json` records how much of your lifetime token-savings total each tool earned (a map of tool name to a running count, plus the date attribution started). It exists because the meter previously stored a single lifetime number, so "which tools produced this" had no answer — including for us, when we needed to size the effect of a baseline correction. **This stays on your machine**: the anonymous meter above sends the aggregate total and never a per-tool breakdown, and a test in the suite fails if that payload ever changes shape. Tool names only — no code, no paths, no queries, no repo names. Counts earned before this shipped cannot be attributed retroactively and are reported as `lifetime_unattributed` rather than dropped. Read it with `get_session_stats`; delete `~/.code-index/` to erase it.
 - **Startup import of the local embedding backend.** When a native embedding provider is configured (the bundled ONNX encoder, or a sentence-transformers model), the server imports that library at startup, on the main thread, before it begins serving. That adds a few seconds to launch and is not optional polish: importing it later, on the worker thread a tool call runs in, deadlocks on the Windows loader lock and hangs the call forever. Nothing is downloaded and no model is loaded — the import alone is what matters, and no network is touched. Opt out with `JCODEMUNCH_EAGER_EMBED_IMPORT=0`.
 - **In-process embedding cache.** After a semantic search reads a repository's stored vectors out of `~/.code-index/`, the decoded matrix stays in that server process's memory so the next query doesn't re-read and re-decode the whole thing (roughly 46 MB for a 30,000-symbol index). At most 2 repositories are held at a time, it is dropped when the index is written, and it dies with the process — nothing is written anywhere and no network is touched. Turn retention off with `JCODEMUNCH_EMBED_MATRIX_CACHE=0`.
+- **An abandoned parse worker.** When a file of 128 KiB or more is indexed by an incremental `index_folder`, by `index_file` or by `index_repo`, its parse runs in a worker thread so the index can stop waiting at `JCODEMUNCH_PARSE_BUDGET_SECONDS` (default 20). If the wait expires the file is skipped and named in `warnings`, and the worker **keeps running until its work ends**, which can be after the tool call has returned: Python cannot stop a thread. It is a daemon thread inside the server process, reads nothing new, opens no connection, and dies with the process. It writes one thing, and only when `JCODEMUNCH_PARSE_CACHE` is set: that file's parse result, into the parse cache, when it finishes. The first index of a local folder does not use it. `JCODEMUNCH_PARSE_BUDGET_SECONDS=0` disables the wait and the worker with it.
 - **Agent hooks.** `init` / `install` can write hook entries (auto-reindex on edit, read-interception nudges) into your MCP client's settings. They're offered during the interactive flow, shown before writing, and fully removed by `uninstall`.
 - **Local index storage.** Indexes live at `~/.code-index/` (override with `CODE_INDEX_PATH`). Delete the directory and every trace of indexing is gone.
 - **Live session journal.** While the server runs, it periodically writes a small `_session_live.json` in `~/.code-index/` recording the files and searches the agent touched this session (paths and query strings only, no file contents). It exists so the out-of-process PreCompact hook can restore session orientation after context compaction. Throttled, atomically written, overwritten in place; disable with `JCODEMUNCH_LIVE_JOURNAL=0`.
```

**File**: `USER_GUIDE.md` (modified, +2/-2)
```diff
@@ -583,8 +583,8 @@ Three things worth knowing before scheduling it:
 
 * **The budget bounds when a run ENDS, not what it costs while it runs.** A slice
   running flat out still saturates a core. `--pause-ms` is what lowers the duty
-  cycle. Python cannot preempt a running parse (tree-sitter is C), so the same
-  limit applies here as to `JCODEMUNCH_PARSE_BUDGET_SECONDS`.
+  cycle. The budget is checked between batches, so a batch in progress finishes
+  first; one file's parse is bounded separately by `JCODEMUNCH_PARSE_BUDGET_SECONDS`.
 * **AI summaries are off by default here**, unlike `index_folder`. A scheduled
   background job must not bill a paid summarizer API without being asked.
 * **A `parser_generation` upgrade is only claimed when the whole corpus has been
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -348,6 +348,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_pagerank.py | `compute_pagerank` scores sum to 1, respect edge direction/convergence, and `search_symbols` ranking integrates centrality. | `c0ad048 feat: PageRank / centrality ranking (v1.11.12)`; docstring "Feature 2 from upgrades-PRD.md" | 1 | LOAD-BEARING | Cites a PRD document; verify it still exists before relying on the citation (cf. the phantom PRD noted for get_endpoint_impact). |
 | tests/test_paid_embeddings_optin.py | `_detect_provider` never selects a paid cloud embedding provider from an API key alone -- the explicit `*_EMBED_MODEL` is the opt-in and the local ONNX encoder wins at priority 0. | `2971bb2 test: pin that a bare cloud key cannot select a paid embedding provider`; docstring: suite-parity check for a jdocmunch defect, deliberately NOT a port of its gate | 8 | LOAD-BEARING | Pins a property jcm already had so a "simplification" cannot remove it; env-only, no network. |
 | tests/test_parity_map.py | `get_parity_map` classifies ported/renamed/diverged/added/orphaned symbols across two scopes, computes `parity_pct`, orders the port plan topologically with SCC grouping, errors on same scope/unindexed/empty, and is read-only. | `07bbb0c get_parity_map: correspondence-aware migration parity map (v1.108.111)`; docstring | 1 | LOAD-BEARING | Fixture is a legacy/ vs v2/ tree with commented expected outcomes per symbol. |
+| tests/test_parse_budget_cancels.py | An over-budget tree-sitter parse is stopped at `JCODEMUNCH_PARSE_BUDGET_SECONDS` and the file is named in `warnings`, on `parse_file`, a full index and an incremental re-index, at any file size; a stop is recognised without a clock; another thread's time is not charged to the file; a first index starts no wait thread; the installed binding can still cancel a parse. | LEDGER L-114 (2026-10-04): the thread wait could not return while the parse held the GIL | 5 | LOAD-BEARING | The slow input is L-113's shape; each cancelled case costs its 0.25 s budget. The fake-parser cases pin both directions of the stop rule and the expired-deadline branch (review rounds found mutants that passed an earlier form). `test_a_first_index_leaves_no_thread_behind` is the L-116 decision: do not invert it without fixing the wait's clock. The binding canary fails when `Parser.timeout_micros` is gone |
 | tests/test_parse_cache.py | Content-addressed parse cache is a passthrough when disabled, returns identical symbols on hit, and FIFO-evicts past `DEFAULT_MAX_ROWS`. | `c57b070 release: v1.108.40 -- content-addressed parse cache for shared-host indexing`; `444925e v1.108.41 -- bound the shared parse cache (FIFO eviction)` | 3 | LOAD-BEARING | Env-gated by `JCODEMUNCH_PARSE_CACHE`; compares `dataclasses.asdict` of symbols. |
 | tests/test_parse_warnings.py | `index_folder` reports `missing_extractors` for a language with symbols but no import extractor (Elixir), and `get_dead_code_v2` emits `framework_warning` when no entry points are found. | `b4db152 release: v1.21.19 -- Phase 5 uncertainty disclosure (T15-T18)`; docstring T17/T18 | 9 | LOAD-BEARING | Elixir is the representative gap; if an Elixir import extractor is added this fixture language must change. |
 | tests/test_parser.py | Core `parse_file` extraction for Python plus Lua, JS/TS const constants, and Astro frontmatter/components. | `ac91053 feat: add Lua language support (v1.0.1)`; `c984804 feat: extract JS/TS const declarations as constants`; `d1aa0e5 feat(parser): enhance Astro support ... regression tests` | 1 | LOAD-BEARING | Phase 1 file that accreted language cases; one `read_text` on a fixture. |
```

**File**: `docs/harness/FINDINGS.md` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ the tests that carry them.
 | F-40 | A test fixture replaced `time.sleep` on the REAL module and failed on whichever worker held a sleeping thread. `tests/test_registry_verify_retries_an_unanswered_read.py` (merged in #955) loaded `scripts/registry_verify.py` and set `mod.time.sleep` to a list's `append`; `mod.time` is the module every thread in the xdist worker shares. PR #956, run 36911633390: `full: test (ubuntu-latest, 3.11)` read `1 failed, 14034 passed, 28 skipped`, `AssertionError: assert (2 == 2 and 258047 == 1)`, and `full: test (windows-latest, 3.11)` failed the same test with `assert (2 == 2 and 179403 == 1)`; `windows-latest, 3.13` was cancelled and five legs passed. ⚠⚠ **The thread is `tests/test_v1_108_182.py`'s `_StubProvider.load`**, which loops `time.sleep(0.01)` to a 30 s deadline; `_run_with_budget` (`src/jcodemunch_mcp/parser/context/base.py`) abandons it on a daemon thread after its 0.2 s budget, by design (a watchdog cannot preempt a thread), so it outlives its test by half a minute and resolves `time.sleep` on every iteration (found by the reviewer; the log's list is all `0.01`). The miss is also a race: the failing test can finish inside one real 10 ms sleep, which fits two legs of eight. The eight `full:` legs of #955's merged head passed. | `tests/test_registry_verify_retries_an_unanswered_read.py`, `tests/test_registry_verify_reads_every_page.py`, `tests/test_v1_108_182.py` | FIXED 2026-10-01 for the two fixtures: each replaces the loaded module's own `time` NAME with a stub and asserts the real `time.sleep` and `time.monotonic` are untouched; a test with a sleeping thread beside it fails against the old fixture. OPEN for the rest: the abandoned 30 s provider thread is still there for the next fixture that patches a shared module (release it at teardown); both registry files still replace `urllib.request.urlopen` on the real module (no `urlopen` call exists under `src/` or elsewhere in `tests/`); `tests/test_watcher_lock.py` sets `watcher.asyncio.sleep`, the same class; no ratchet scans `tests/` for the property |
 | F-41 | `suite.full_seconds` failed a LOCAL full tier whose tests all passed, and the local margin F-39 leaned on is gone. Branch `fix/l101-root-level-test-dirs` (LEDGER L-101), `python .claude/hooks/run_full.py --workers 4`, seven runs on 2026-10-01, in order: 355.33, 348.87, 348.75, 345.79, 346.27, 372.03, 357.0 against `<= 360`. The sixth, on commit 901b2106, read `14125 passed, 25 skipped ... in 370.65s` and `observed 372.03 FAIL`; the box was idle when checked afterwards (CPU 12%, 14 GB free) and the re-run on the same tree read 357.0. Only the last reading is in an evidence file (`evidence/full.md`); the other six, the pytest line and the load figures were read from run output in the session and are not. F-39 recorded 311.38 for this command the same day; the suite has grown by 110 tests since by totals (14040 on F-39's leg, 14150 here), which is unlikely to account for the 34 to 61 s between 311.38 and these readings, so something slower than test count moved and it has not been measured. | `harness/thresholds.json` `suite.full_seconds`; `.claude/hooks/run_full.py` | FIXED 2026-10-04 at its cause (the last sentences of this cell); the Floor did not move. History: OPEN. The Floor did not move and the failed run was re-run (F-38's handling). Measure before touching it: `--durations` on main against the 311.38 s tree, and the same tier under `-n auto`, which is what the metric names. 2026-10-02: the same Floor failed in CI with every test passing, `full: test (ubuntu-latest, 3.10)` on PR #965, run 37022224795, `observed 361.12 FAIL` over `14174 passed, 28 skipped ... in 358.78s` (attempt 1, job 110888500645; `evidence/f41_ci.txt`); the re-run of that job passed. The margin is thin on a runner as well as on this box. 2026-10-02, later the same day, branch `fix/l102-undeclared-entry-points`, commit 79cb89a0: two consecutive local runs passed every test and read 361.42 and 368.77 (read from run output, not in an evidence file); CPU was idle when checked and the cause was not found. The next two full tiers on the same branch read 351.5 and 355.48 (`evidence/full.md`, each overwritten by the next run), so the margin there was 4.52 s. 2026-10-03, commit b3a5b337, two more 4-worker runs passed every test and FAILED: 360.61 and 363.93 (read from run output). The same commit under `pytest -n 4 --durations=40` with no coverage read 319.89 s, and no test from the branch's new file is among the 40 slowest, the 40th of which took 4.11 s (`evidence/f41_durations.txt`); the whole file runs in about 3 s serially. A run with `--workers 8` passed at 256.04 (read from run output; `evidence/full.md` holds whichever tier ran last); the metric names `-n auto` and `--workers 4` is this box's memory cap, so on this box the cap spends most of the margin. **FIXED 2026-10-04 at the cause the durations run pointed at**: six cases of `tests/test_size_cap_end_to_end.py` took 1
```

**File**: `docs/workflows/LEDGER.md` (modified, +3/-1)
```diff
@@ -162,4 +162,6 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-111 | 2026-10-02, L-102 fix | The UNDECLARED entry points L-102 named are still reported dead: `index.js` or `src/index.ts` in a tree with no `package.json`, and a Python script with no main guard. Nothing in the tree declares them, so a rule for them is a filename or content guess, and a wider guess suppresses real findings (#569). Not measured: how many zero-importer files on real corpora such a guess would revive, and how many of those are truly dead. Other DECLARED sources are unread too: a `Procfile`, a `Dockerfile` `CMD`/`ENTRYPOINT`, a workflow `run:` line, a `Makefile` recipe, `pyproject.toml` `[project.scripts]` (which names a function, not a file), and a `package.json` script that runs a file through a program outside the runner list (`pm2 start`, `vite-node`, `electron-forge`). Each is the same shape as `scripts`: read the declaration, root only the file it executes. Residue of the `scripts` reader itself. It is an allowlist, so the direction that remains is almost all MISSED ROOT (the executed file stays reported, which the reader can see); each example was run and prints no root in `evidence/l102_residue_probe.txt`: a bare or extensionless argument (`node server`, `node lib`, `bun run server`); a flag the runner's table does not know (`node --some-new-flag x.js`, `node --inspect 9229 x.js`) or one that runs tests or a REPL (`node --test x.js`, `tsx --test x.ts`, `node -i x.js`); a value flag whose value is itself a runnable indexed file (`nodemon --ignore legacy.js server.js`); `deno serve main.ts`; a directory argument that holds its own `package.json` (`node ./sub`); every changed directory (`cd sub && node x.js`, `nodemon --cwd sub x.js`); every wrapper other than `npx` and `cross-env` (`yarn node x.js`, `pnpm exec node x.js`, `yarn workspace foo node x.js`, `dotenv -e .env -- node x.js`, `time`/`sudo node x.js`, `concurrently "node x.js"`, `sh -c "node x.js"`); a pipe, a redirect, `&`, a subshell or a shell keyword anywhere in the command (`node x.js | tee log`, `if ...; then node x.js; fi`); `$npm_package_main`; a character outside the command allowlist anywhere in the command, including after the entry (`node x.js --glob "src/**"`, `node x.js --match a?c`, `node x.js --pct 50%`, `node x.js --name (a)`, `node build.js # c`, `node x.js --home ~/out`); a backslash at the start of a word (`\node x.js`); `cross-env A=1 npx nodemon x.js` (the wrapper order read is `npx` then `cross-env`); and a `scripts` entry in a `package.json` that is not indexed. WRONG ROOT, round by round (the current list closes this paragraph). Rounds 5 to 7: a table that is wrong (a flag listed in a runner's `flags`, no next-token value, that does take one has its value read as the entry when that value is path-shaped and indexed; a word in `exec_sub` that is not an execute word skips to the next argument), and shell syntax the lexer reads differently from a shell. Review round 5 found one of the first by running node 24 (`--env-file` and `--unhandled-rejections` take a next-token value; both moved to the value table) and four of the second (`FOO=1 cd sub && node b.js`, `\cd sub`, a `#` comment, a quoted `"&&"`), all closed and tested. Round 6 found more of the second (a shell word behind an assignment or in a later segment, a newline, `\"`), all contrived, and the answer was to stop listing them: the command text is a character allowlist (`_COMMAND_TEXT`), a quoted string holds plain text only, and a backslash is a path separator inside a word and nothing else. Round 7 ran the runners. The table was wrong in the OTHER direction for bun `-c`/`--config` and deno `--v8-flags` (listed as taking the next word; bun 1.4.2 and deno 2.9.6 take the value only after `=`, so the next word is the file they execute), and ts-node-dev had inherited ts-node's flags, nine of which its own parser does not know (`--esm`, `--swc`, `--inspect`, the camelCase spellings, `-q`); its table is now transcribed from `ts-node-dev/lib/bin.js` 2.0.0. Shell words `exit`, `exec`, `return`, `alias`, `trap` and a quoted `"A=1"` were read through and are refused now. Round 8 ran more and found two wrong roots outside both kinds, in working commands: nodemon reads its own options after the script (`nodemon ./a.js --cwd sub` ran `sub/a.js`; `nodemon ./b.js --exec "node ./a.js"` ran `a.js`), and ts-node and tsx try `.js` before `.ts` (`ts-node ./a` ran `a.js` with `a.ts` beside it) while ts-node-dev and `ts-node --prefer-ts-exts` try `.ts` first. Fixed in round 8 by reading nodemon's options after the script too; round 9 found that reading them was itself a wrong root (`nodemon ./a.js -r ./b.js` runs only `a.js`: node's flags after the script stay in the script's argv) and that nodemon takes the first argument that EXISTS and gives an extensionless one the first `-e` extension (`nodemon ./a -e ts` ran `a.ts`). So now: any option after nodemon's script declar
```

---

### Incident Patch 4: `2ba8b6ae` (2026-10-05)
**Commit Message**: test: the size-cap fixture opens with its padding, restoring the full tier's margin (#940) (#973)

* test: the size-cap fixture pads before its function (harness F-41)

tree-sitter's Python grammar is quadratic in a run of comment lines that
follows an indented block, so the oversize fixture took 11 s to parse in
each of six cases. The padding now comes first; the file is the same
size and the seven assertions are unchanged.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs: F-41 fixed at its cause, F-42 takes #866, L-113 records the quadratic comment parse

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: pin the size-cap fixture's shape so the quadratic parse cannot return (harness F-41)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: L-113's trigger is any statement, L-114 records the unbudgeted walk, the guard sees indented comments (review round 1)

The quadratic parse needs no indented block: a comment run after any
statement outside brackets pays it, and only a run that opens the file
is free. The fixture guard now counts indented comment lines too. F-42
names all three re-runs in its window and keeps what issue #866 held.

Co-Authored-By: Cl

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-1)
```diff
@@ -454,7 +454,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_session_state.py | SessionState save/load round-trips the journal and search cache. | `2fb56d8 feat: session-aware routing — 10 features for smarter AI-guided code exploration` | 9 | LOAD-BEARING | Feature unit test; hardcoded 2026-04-05 timestamps in cache keys. |
 | tests/test_share_savings.py | set_bool_key handles all three template shapes, apply_share_savings writes the flag, and upgrade_config preserves a user-set share_savings across upgrades. | `6a84e68 release: v1.108.21 — share_savings opt-out flag`; docstring "critical PRD invariant" | 6 | LOAD-BEARING | Config-upgrade preservation is the load-bearing half. |
 | tests/test_signal_fusion.py | Weighted reciprocal rank fuse() math and channel builders produce non-zero weights (the #324 inert-fusion regression). | `ead6dfc release: v1.108.29 — fix inert WRR signal fusion (all weights resolved to 0.0) (#324)` | 1 | LOAD-BEARING | Regression at L112/L158 for #324 default-weight sentinel. |
-| tests/test_size_cap_end_to_end.py | For every documented max_file_size route x every discovery entry point, a symbol inside an oversize file is retrievable after indexing. | `293e758 test: verify the size cap where the user stands, not at the layer we edited`; docstring v1.108.193/.194/.197 three-release history | 6 | LOAD-BEARING | Deliberately altitude-level matrix; pins storage before load_config (#437). |
+| tests/test_size_cap_end_to_end.py | For every documented max_file_size route x every discovery entry point, a symbol inside an oversize file is retrievable after indexing. | `293e758 test: verify the size cap where the user stands, not at the layer we edited`; docstring v1.108.193/.194/.197 three-release history | 6 | LOAD-BEARING | Deliberately altitude-level matrix; pins storage before load_config (#437). The oversize fixture OPENS with its comment padding: a comment run after any statement parses quadratically (LEDGER L-113) and cost six cases 14 to 16 s each until 2026-10-04 (harness F-41); `test_the_oversize_fixture_opens_with_its_padding` pins the shape. |
 | tests/test_skill_candidates.py | Skill-candidate advisory fires only on subtree concentration, never on size alone or on a package root, and is silent on a default install. | `cc8d87a release: v1.108.249`; docstring NON-VACUITY NOTE; thresholds tuned 2026-08-06 against five real configs | 9 | LOAD-BEARING | Negative assertions are the point; tuning corpus named in comments. |
 | tests/test_skills.py | Claude Agent Skill bundle content has frontmatter/marker and install/uninstall/status round-trip. | `ff6992c release: v1.107.0 — Claude Agent Skill bundle` | 6 | LOAD-BEARING | Feature unit test; writes into tmp skill dirs. |
 | tests/test_source_drift.py | install-status reports source_drift tri-state from running-process start time vs source mtime, never False for unknown. | `3d1f95c feat: install-status reports whether the running code matches its tree`; docstring: box ran 1.108.293 against a 1.108.307 tree | 6 | LOAD-BEARING | Tri-state guard; L238 cites #559 mock lesson. |
```

**File**: `docs/harness/FINDINGS.md` (modified, +2/-1)
```diff
@@ -46,7 +46,8 @@ the tests that carry them.
 | F-38 | `suite.full_seconds_ci_windows` failed a leg whose tests all passed. PR #946 (run 36767909287, `full: test (windows-latest, 3.11)`, head 11c9f611): `13940 passed, 25 skipped ... in 1076.37s`, the Floor line `observed 1078.7` against its Floor. The diff is two `release.yml` install lines, the RUNBOOK and one test, so it cannot move suite runtime. The other three windows legs of the same run took 650, 764 and 775 s as whole jobs, and this one 1109 s (`gh run view 36767909287`). ⚠ The Floor was set on 2026-09-04 from four legs of one commit (median 516.3 s, x2, the entry's own `set_at`); the suite has grown since, to 13,965 collected here, so the margin over a typical leg has narrowed with the suite, not with the runner. | `harness/thresholds.json` `suite.full_seconds_ci_windows`, `harness/__main__.py::_full_wall_floor_id` | OPEN. One occurrence, and the tolerance rule (`docs/harness/DESIGN.md`) moves a timing Floor only on three CI runs, never on one flake: the failed job is re-run and the Floor stays. The candidate, if it recurs: re-set from the windows legs' pytest seconds of three green runs at today's suite size, recorded the way `self_latency_ci_runs_2026-09-22.json` was. |
 | F-39 | `suite.full_seconds` failed an ubuntu leg whose tests all passed. PR #955 (run 36900539828, `full: test (ubuntu-latest, 3.10)`, head 59d353b3): `14012 passed, 28 skipped ... in 358.03s`, the Floor line `observed 360.94` against `<= 360`. The diff is a release script, two `release.yml` steps, the RUNBOOK and one test file of 21 fast tests, so it cannot move suite runtime. The other three ubuntu legs of the same run read `observed 186.03` (3.12), `230.78` (3.13) and `342.14` (3.11): one tree, a spread of almost 2x between runners, and two of four legs within 20 s of the Floor. ⚠ The same Floor serves the local run, where this tree read 311.38 with four workers. Second occurrence of F-38's shape on the other OS. | `harness/thresholds.json` `suite.full_seconds`, `harness/__main__.py::_full_wall_floor_id` | OPEN. The Floor did not move. A push re-ran the leg. The 3.10 and 3.11 legs are the slow ones on both OSes in the two recorded misses, which is worth measuring before the Floor is touched |
 | F-40 | A test fixture replaced `time.sleep` on the REAL module and failed on whichever worker held a sleeping thread. `tests/test_registry_verify_retries_an_unanswered_read.py` (merged in #955) loaded `scripts/registry_verify.py` and set `mod.time.sleep` to a list's `append`; `mod.time` is the module every thread in the xdist worker shares. PR #956, run 36911633390: `full: test (ubuntu-latest, 3.11)` read `1 failed, 14034 passed, 28 skipped`, `AssertionError: assert (2 == 2 and 258047 == 1)`, and `full: test (windows-latest, 3.11)` failed the same test with `assert (2 == 2 and 179403 == 1)`; `windows-latest, 3.13` was cancelled and five legs passed. ⚠⚠ **The thread is `tests/test_v1_108_182.py`'s `_StubProvider.load`**, which loops `time.sleep(0.01)` to a 30 s deadline; `_run_with_budget` (`src/jcodemunch_mcp/parser/context/base.py`) abandons it on a daemon thread after its 0.2 s budget, by design (a watchdog cannot preempt a thread), so it outlives its test by half a minute and resolves `time.sleep` on every iteration (found by the reviewer; the log's list is all `0.01`). The miss is also a race: the failing test can finish inside one real 10 ms sleep, which fits two legs of eight. The eight `full:` legs of #955's merged head passed. | `tests/test_registry_verify_retries_an_unanswered_read.py`, `tests/test_registry_verify_reads_every_page.py`, `tests/test_v1_108_182.py` | FIXED 2026-10-01 for the two fixtures: each replaces the loaded module's own `time` NAME with a stub and asserts the real `time.sleep` and `time.monotonic` are untouched; a test with a sleeping thread beside it fails against the old fixture. OPEN for the rest: the abandoned 30 s provider thread is still there for the next fixture that patches a shared module (release it at teardown); both registry files still replace `urllib.request.urlopen` on the real module (no `urlopen` call exists under `src/` or elsewhere in `tests/`); `tests/test_watcher_lock.py` sets `watcher.asyncio.sleep`, the same class; no ratchet scans `tests/` for the property |
-| F-41 | `suite.full_seconds` failed a LOCAL full tier whose tests all passed, and the local margin F-39 leaned on is gone. Branch `fix/l101-root-level-test-dirs` (LEDGER L-101), `python .claude/hooks/run_full.py --workers 4`, seven runs on 2026-10-01, in order: 355.33, 348.87, 348.75, 345.79, 346.27, 372.03, 357.0 against `<= 360`. The sixth, on commit 901b2106, read `14125 passed, 25 skipped ... in 370.65s` and `observed 372.03 FAIL`; the box was idle when checked afterwards (CPU 12%, 14 GB free) and the re-run on the same tree read 357.0. Only the last reading is in an evidence file (`evidence/full.md`); the other six, the pytest line and the load figures were read from ru
```

**File**: `docs/workflows/LEDGER.md` (modified, +2/-0)
```diff
@@ -161,3 +161,5 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-110 | 2026-10-02, L-108 review round 3 | Three things follow from `search_symbols(fusion=true)` naming a failed similarity channel, none a wrong answer. (1) A zero-row call with a failed channel mints a `symbol_lookup_absence` receipt with `proves_absence: true` beside the limitation that a requested semantic channel was unavailable (`evidence/producers.py`); the pairing is consistent with the v1.108.185 ruling and no test pins it. (2) The `absent` note on that answer says not to reformulate the same query, while `semantic_channel_error` names a remedy after which the same query can return rows. (3) A failed answer is not cached, so while a channel keeps failing each identical call rescans, pays the provider's timeout again and writes a `ranking_events` row that the regret signals count as a repeat. A short negative cache keyed on the provider and the error would bound (3). | `src/jcodemunch_mcp/evidence/producers.py`; `src/jcodemunch_mcp/retrieval/verdict.py`; `src/jcodemunch_mcp/tools/search_symbols.py` | improvement | low | OPEN |
 | L-111 | 2026-10-02, L-102 fix | The UNDECLARED entry points L-102 named are still reported dead: `index.js` or `src/index.ts` in a tree with no `package.json`, and a Python script with no main guard. Nothing in the tree declares them, so a rule for them is a filename or content guess, and a wider guess suppresses real findings (#569). Not measured: how many zero-importer files on real corpora such a guess would revive, and how many of those are truly dead. Other DECLARED sources are unread too: a `Procfile`, a `Dockerfile` `CMD`/`ENTRYPOINT`, a workflow `run:` line, a `Makefile` recipe, `pyproject.toml` `[project.scripts]` (which names a function, not a file), and a `package.json` script that runs a file through a program outside the runner list (`pm2 start`, `vite-node`, `electron-forge`). Each is the same shape as `scripts`: read the declaration, root only the file it executes. Residue of the `scripts` reader itself. It is an allowlist, so the direction that remains is almost all MISSED ROOT (the executed file stays reported, which the reader can see); each example was run and prints no root in `evidence/l102_residue_probe.txt`: a bare or extensionless argument (`node server`, `node lib`, `bun run server`); a flag the runner's table does not know (`node --some-new-flag x.js`, `node --inspect 9229 x.js`) or one that runs tests or a REPL (`node --test x.js`, `tsx --test x.ts`, `node -i x.js`); a value flag whose value is itself a runnable indexed file (`nodemon --ignore legacy.js server.js`); `deno serve main.ts`; a directory argument that holds its own `package.json` (`node ./sub`); every changed directory (`cd sub && node x.js`, `nodemon --cwd sub x.js`); every wrapper other than `npx` and `cross-env` (`yarn node x.js`, `pnpm exec node x.js`, `yarn workspace foo node x.js`, `dotenv -e .env -- node x.js`, `time`/`sudo node x.js`, `concurrently "node x.js"`, `sh -c "node x.js"`); a pipe, a redirect, `&`, a subshell or a shell keyword anywhere in the command (`node x.js | tee log`, `if ...; then node x.js; fi`); `$npm_package_main`; a character outside the command allowlist anywhere in the command, including after the entry (`node x.js --glob "src/**"`, `node x.js --match a?c`, `node x.js --pct 50%`, `node x.js --name (a)`, `node build.js # c`, `node x.js --home ~/out`); a backslash at the start of a word (`\node x.js`); `cross-env A=1 npx nodemon x.js` (the wrapper order read is `npx` then `cross-env`); and a `scripts` entry in a `package.json` that is not indexed. WRONG ROOT, round by round (the current list closes this paragraph). Rounds 5 to 7: a table that is wrong (a flag listed in a runner's `flags`, no next-token value, that does take one has its value read as the entry when that value is path-shaped and indexed; a word in `exec_sub` that is not an execute word skips to the next argument), and shell syntax the lexer reads differently from a shell. Review round 5 found one of the first by running node 24 (`--env-file` and `--unhandled-rejections` take a next-token value; both moved to the value table) and four of the second (`FOO=1 cd sub && node b.js`, `\cd sub`, a `#` comment, a quoted `"&&"`), all closed and tested. Round 6 found more of the second (a shell word behind an assignment or in a later segment, a newline, `\"`), all contrived, and the answer was to stop listing them: the command text is a character allowlist (`_COMMAND_TEXT`), a quoted string holds plain text only, and a backslash is a path separator inside a word and nothing else. Round 7 ran the runners. The table was wrong in the OTHER direction for bun `-c`/`--config` and deno `--v8-flags` (listed as taking the next word; bun 1.4.2 and deno 2.9.6 take the value only after `=`, so the next word is the file they execute), and ts-node-dev had inherited ts-node's flags, nine of which its own parser does n
```

**File**: `tests/test_size_cap_end_to_end.py` (modified, +25/-2)
```diff
@@ -53,10 +53,14 @@ def _make_project(tmp_path):
     """
     project = tmp_path / "project"
     project.mkdir()
+    # The padding OPENS the file. tree-sitter's Python grammar is quadratic in
+    # a run of comment lines that follows any statement (LEDGER L-113): with the
+    # function first this file took about 11 s to parse
+    # (`evidence/l113_shapes.txt`), and this module is about the cap, not that.
     padding = "# " + ("x" * 78) + "\n"
     (project / "big_module.py").write_text(
-        "def marker_symbol():\n    return 1\n\n"
-        + padding * (OVERSIZE // len(padding) + 1),
+        padding * (OVERSIZE // len(padding) + 1)
+        + "\ndef marker_symbol():\n    return 1\n",
         encoding="utf-8",
     )
     (project / "small_helper.py").write_text(
@@ -195,3 +199,22 @@ def test_the_default_refuses_only_the_oversize_file(tmp_path):
         "an oversize file was indexed with NO cap raised; the 500 KB default "
         "is not being enforced"
     )
+
+
+def test_the_oversize_fixture_opens_with_its_padding(tmp_path):
+    """Every comment line of the oversize fixture comes before its first statement.
+
+    A comment run after any statement parses in quadratic time (LEDGER L-113):
+    with the function first, this file took about 11 s to parse and six cases of
+    this module took 14 to 16 s each, which spent the full tier's wall-clock
+    margin (harness F-41). Only a run that opens the file is free, so that is
+    the shape pinned here, for indented comments as well as column-0 ones.
+    """
+    text = (_make_project(tmp_path) / "big_module.py").read_text(encoding="utf-8")
+    lines = text.splitlines()
+    comments = [i for i, line in enumerate(lines) if line.lstrip().startswith("#")]
+    code = [i for i, line in enumerate(lines) if line.strip() and not line.lstrip().startswith("#")]
+    assert comments and code, "the fixture needs its padding and its function"
+    assert max(comments) < min(code), (
+        f"a comment on line {max(comments) + 1} follows code that starts on line {min(code) + 1}"
+    )
```

---

### Incident Patch 5: `e2a2c617` (2026-10-04)
**Commit Message**: fix: a repeat `index <subdir>` inside a git root is incremental (#961) (#970)

The incremental branch in index_folder was gated on
`_merge_with_existing is None`, and the collision guard sets it for
every subdir walk, so a repeat subdir walk always re-parsed the whole
subdirectory. Run the incremental diff when walk_prefix is already in
the stored source_roots, and scope `deleted` to walk_prefix so carried
files outside it are never counted as deleted.

Co-authored-by: jgravelle <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -4,6 +4,21 @@
 
 ### Fixed
 
+- **A repeat `index <subdir>` inside a git root is incremental (#961).** A subdirectory of a git
+  working tree is indexed under the git root's identity and walked as `walk_prefix`; the collision
+  guard sets `_merge_with_existing` so files outside the prefix carry over, and the incremental
+  branch ran only when `_merge_with_existing` was `None`. So no repeat subdir walk could reach the
+  no-change path: every run re-parsed the whole subdirectory and saved it through the merge, with
+  `performed_incremental: false` (93 of 93 scheduled runs in the report). #504 fixed the same gate
+  for a repeat full-root walk. The incremental diff now runs for a subdir walk whose prefix is
+  already recorded in `source_roots`, with `deleted` scoped to that prefix: a carried file outside it
+  is not the subdir walk's to prune, and `incremental_save` leaves every file it is not told about
+  untouched. A first walk of a new prefix, a branch delta, and any run that turns `incremental` off
+  (a parser upgrade, an invalidated cache) still take the merge path. Measured on a copy of the
+  reporter's storage (17 indexes, 741 files under the walked prefix): 4.8 s before,
+  2.9 s after with nothing changed; with one file edited, one added and one deleted the result
+  is identical to a fresh build (file set, hashes, mtimes and symbol ids).
+
 - **A file a `package.json` script runs is an entry point.** `find_dead_code` and `get_dead_code_v2`
   read `main`, `module`, `browser`, `exports` and `bin` from the manifest and not `scripts`, so a server
   started by `"start": "node server.js"` has no importer by construction and was reported dead at
```

**File**: `src/jcodemunch_mcp/tools/index_folder.py` (modified, +18/-1)
```diff
@@ -2633,12 +2633,29 @@ def _hash_file(rel_path: str) -> str:
         # index covers other subdirs — incremental's "changed/new/deleted"
         # accounting against the full existing file set would mis-attribute
         # carryover files as deleted.
-        if incremental and existing_index is not None and _merge_with_existing is None:
+        #
+        # Exception: a RE-walk of a subdir already recorded in `source_roots`.
+        # Scoping `deleted` to `walk_prefix` removes the mis-attribution, and
+        # `incremental_save` leaves every unlisted (carried) file untouched, so
+        # a scheduled `index <subdir>` no longer re-parses the whole subdir.
+        _subdir_incremental = (
+            _merge_with_existing is not None
+            and not _is_branch_delta
+            and walk_prefix in (getattr(_merge_with_existing, "source_roots", None) or [])
+        )
+        if incremental and existing_index is not None and (
+            _merge_with_existing is None or _subdir_incremental
+        ):
             changed, new, deleted, computed_hashes, updated_mtimes = (
                 store.detect_changes_with_mtimes(
                     owner, repo_name, file_mtimes, _hash_file
                 )
             )
+            if _subdir_incremental:
+                deleted = [
+                    fp for fp in deleted
+                    if not _file_outside_walk_prefix(fp, walk_prefix)
+                ]
 
             # Subset refresh (paths=[...]): detect_changes_with_mtimes diffs the
             # supplied subset against the ENTIRE stored index, so every unlisted
```

**File**: `tests/test_repeat_subdir_walk.py` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+"""A repeat `index <subdir>` inside a git root is incremental (#961).
+
+#504 fixed the repeat FULL-root walk. A subdir walk takes the merge path
+instead (`_merge_with_existing` is set so files outside `walk_prefix` carry
+over), and the incremental branch was gated on `_merge_with_existing is None`,
+so every repeat subdir walk re-parsed the whole subdir.
+
+⚠ A no-change path taken unconditionally would satisfy the first test and
+index nothing; the second and fourth tests are the controls against that.
+"""
+
+import subprocess
+
+import pytest
+
+from jcodemunch_mcp.storage import IndexStore
+from jcodemunch_mcp.tools.index_folder import index_folder
+
+
+def _git(cwd, *args):
+    subprocess.run(
+        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True
+    )
+
+
+@pytest.fixture
+def repo(tmp_path):
+    work = tmp_path / "demo"
+    work.mkdir()
+    _git(work, "init", "-q")
+    _git(work, "config", "user.email", "repro@example.invalid")
+    _git(work, "config", "user.name", "repro")
+    _git(work, "remote", "add", "origin", "https://github.com/acme/demo.git")
+    (work / "main.py").write_text("def main():\n    return 1\n")
+    (work / "pkg").mkdir()
+    (work / "pkg" / "a.py").write_text("def alpha():\n    return 1\n")
+    (work / "pkg" / "b.py").write_text("def beta():\n    return 2\n")
+    _git(work, "add", "-A")
+    _git(work, "commit", "-q", "-m", "A")
+
+    def _index(target, store):
+        return index_folder(
+            str(target), use_ai_summaries=False, storage_path=str(store),
+            identity_mode="git",
+        )
+
+    class Repo:
+        path = work
+
+        def __init__(self, store_dir):
+            store_dir.mkdir()
+            self.store_path = str(store_dir)
+
+        def index(self):
+            return _index(work, self.store_path)
+
+        def index_subdir(self, rel):
+            return _index(work / rel, self.store_path)
+
+        def load(self, result):
+            owner, name = result["repo"].split("/", 1)
+            return IndexStore(base_path=self.store_path).load_index(owner, name)
+
+    Repo.new = staticmethod(lambda name="store": Repo(tmp_path / name))
+    return Repo
+
+
+def _snapshot(index):
+    return (
+        dict(index.file_hashes),
+        sorted(s["id"] if isinstance(s, dict) else s.id for s in index.symbols),
+    )
+
+
+class TestRepeatSubdirWalk:
+    def test_a_repeat_subdir_walk_takes_the_no_change_path(self, repo):
+        r = repo.new()
+        first = r.index_subdir("pkg")
+        assert first["success"] is True
+
+        again = r.index_subdir("pkg")
+
+        assert again["performed_incremental"] is True, (
+            "a repeat subdir walk re-parsed the whole subdir"
+        )
+        assert again.get("message") == "No changes detected"
+
+    def test_edits_inside_the_prefix_are_applied_and_carried_files_kept(self, repo):
+        r = repo.new()
+        r.index()
+        r.index_subdir("pkg")
+
+        (repo.path / "pkg" / "a.py").write_text("def alpha_v2():\n    return 9\n")
+        (repo.path / "pkg" / "c.py").write_text("def gamma():\n    return 3\n")
+        (repo.path / "pkg" / "b.py").unlink()
+
+        result = r.index_subdir("pkg")
+
+        assert result["performed_incremental"] is True
+        assert (result["changed"], result["new"], result["deleted"]) == (1, 1, 1)
+
+        index = r.load(result)
+        names = {s["name"] if isinstance(s, dict) else s.name for s in index.symbols}
+        assert {"alpha_v2", "gamma", "main"} <= names
+        assert not {"alpha", "beta"} & names
+        assert "main.py" in index.file_hashes, (
+            "a file outside the walked prefix was pruned as deleted"
+        )
+
+    def test_a_subdir_walk_does_not_prune_outside_its_prefix(self, repo):
+        """Pruning a file outside `walk_prefix` is the root walk's job; the
+        subdir walk never saw it, so absence from its walk is not deletion."""
+        r = repo.new()
+        r.index()
+        r.index_subdir("pkg")
+        (repo.path / "main.py").unlink()
+
+        result = r.index_subdir("pkg")
+
+        assert result["performed_incremental"] is True
+        assert result.get("deleted", 0) == 0
+        assert "main.py" in r.load(result).file_hashes
+
+    def test_the_incremental_result_matches_a_fresh_build(self, repo):
+        inc = repo.new("store_inc")
+        inc.index()
+        inc.index_subdir("pkg")
+        (repo.path / "pkg" / "a.py").write_text("def alpha_v2():\n    return 9\n")
+        (repo.path / "pkg" / "c.py").write_text("def gamma():\n    return 3\n")
+        (repo.path / "pkg" / "b.py").unlink()
+        inc_result = inc.index_subdir("pkg")
+        assert inc_result["performed_incremental"] is True  # precondition
+
+        fresh = repo.new("store_fresh")
+        fresh.index()
+        fresh_result = fresh.index_subdir("pkg")
+
+        assert _snapshot(inc.load(inc_result)) == _snapshot(fresh.load(fresh_result)
```

---

### Incident Patch 6: `c3276130` (2026-10-04)
**Commit Message**: fix: a file a package.json script runs is an entry point (L-102) (#969)

* fix: a file a package.json script runs is an entry point (L-102)

find_dead_code and get_dead_code_v2 read main/module/browser/exports/bin
and not scripts, so a server started by node server.js read dead at 1.0.
The reader existed twice, byte for byte; it is one function in
tools/_entry_points.py. Only the file a runner executes is a root: a file
a script merely names (eslint x.js, node build.js x.js) declares nothing.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: every doubt in a package.json script declares nothing (review round 1)

A wrong root hides a dead file with no symptom. The parser took a flag's
value as the entry when there was no plain argument, resolved subcommand
words as paths, and applied the script-name guard to every runner, so
nodemon --watch src rooted src/index.ts, deno lint rooted lint.ts and
node --check x.js rooted x.js. Value flags consume their value; a check,
inline code and a non-executing subcommand end the segment; a directory
with its own package.json defers to it; quoting is read before operators.

The test file is new on this branch. Its cases moved from one in

**File**: `CHANGELOG.md` (modified, +52/-0)
```diff
@@ -2,6 +2,58 @@
 
 ## [Unreleased]
 
+### Fixed
+
+- **A file a `package.json` script runs is an entry point.** `find_dead_code` and `get_dead_code_v2`
+  read `main`, `module`, `browser`, `exports` and `bin` from the manifest and not `scripts`, so a server
+  started by `"start": "node server.js"` has no importer by construction and was reported dead at
+  confidence 1.0, with everything only it imports reported as `all_importers_dead`. The deletion
+  investigator then read a name that server imports as imported only by an unreachable file. The reader
+  also existed twice, one copy in each tool with the same logic; it is one function in
+  `tools/_entry_points.py` now.
+  A wrong root is the worse error here, because it removes a dead file from the report with no symptom,
+  and review rounds kept finding a spelling a list of exclusions had not named. So the rule is an
+  allowlist. A script roots a file only in the form `[NAME=value] [npx | cross-env] RUNNER [flags the
+  runner's table knows] PATH`, where the runner is one of `node`, `nodejs`, `nodemon`, `ts-node`,
+  `ts-node-esm`, `ts-node-dev`, `tsx`, `bun`, `deno`, `babel-node`, `electron`, `pm2-runtime`, and the
+  path has a `/` or a `.` in it. The command text is an allowlist as well: a script is read only when
+  every character is a letter, a digit, a space or one of `_ . / : = @ , + - & | ; " ' \`, and a
+  backslash only as a path separator inside a word.
+  Flags are read per runner, because `--watch` takes a value for nodemon and none for node. A module
+  named by `--require`, `--import` or `--loader` is a root when it is a relative path. Everything else
+  declares nothing: a file named to a linter or a test runner, the arguments after the entry, a flag
+  the table does not know, a bare word (`deno lint`, `bun run build`, `node server`), any other wrapper
+  (`yarn`, `pnpm --filter`, `sudo`), a `cd` anywhere before the runner, a pipe, a redirect, a shell
+  keyword, any other character a shell interprets (`$`, `*`, `?`, `~`, `#`, `%`, a bracket, a newline)
+  anywhere in the command, and a directory that has its own `package.json` (`node .`,
+  where `main` decides). The cost is missed roots, which stay visible in the report; L-111 lists them.
+  Every wrong root the reviews found came from a fact about one runner that the reader had
+  assumed instead of measured: a flag that does or does not take the next word (`node --env-file`
+  does; `bun --config` and `deno run --v8-flags` do not), ts-node-dev given ts-node's flags, and how
+  a runner finds its script: nodemon reads options on both sides of it (`nodemon server.js --cwd
+  sub`), takes the first argument that exists, gives an extensionless one the first `-e`
+  extension; ts-node and tsx try `.js` before `.ts` and ts-node-dev the reverse; node tries `x.js`,
+  then `x.json`, then `x/index.js`, and ts-node tries `x.json` before `x.ts`; ESM resolution
+  (`ts-node-esm`, `ts-node --esm`, node's `--import` and `--loader`, tsx's `--loader`) appends nothing. So for nodemon
+  the script is the path exactly as written, with no option after it; an extensionless path that
+  names more than one indexed file, or a `.json` the runner tries first, declares nothing; and an
+  ESM preload that does not resolve as written (no extension, or not indexed) makes the command
+  declare nothing. Each shape above was run against the
+  installed runner (`evidence/l102_round8_real.txt`), and so was every flag in the tables of nodemon,
+  ts-node, ts-node-dev, tsx, babel-node, bun and deno and most of node's; electron and pm2-runtime
+  were not run. The ways left are more facts of that kind not yet run, and shell syntax made of
+  allowed characters that the lexer reads differently from a shell; two contrived commands of the
+  second kind still root a file (`true || node x.js`, `./tools/node x.js`), and L-111 records them.
+  What moves besides the two lists: `get_dead_code_v2` counts script-run files in
+  `entry_points_detected` and lists them in `_meta.package_json_entries`, so a JS repository whose only
+  roots are script-run files leaves the zero-entry-point path (`diagnostics.degraded` and its
+  `framework_warning`), and `get_repo_health`'s `dead_code_pct` follows. `check_delete_safe`, the
+  deletion investigator, `digest` and `assemble_task_context` read these tools and follow too.
+  Measured on the 11 repositories indexed on this machine that hold a `package.json`: 40 files become
+  roots, each the first argument of a runner (`evidence/l102_measure.txt`). Still reported dead, and
+  still wrong: `index.js` in a tree with no `package.json`, and a Python script with no main guard
+  (LEDGER L-111).
+
 ## [1.108.327] - 2026-10-02 - a local model path is refused when the installed sentence-transformers would run its code
 
 ### Security
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -179,7 +179,7 @@ src/jcodemunch_mcp/
     get_endpoint_impact.py    # (v1.108.90) Endpoint-centric impact: "what breaks if I change GET /users?" _collect_endpoints unifies flow_edges route edges (string-dispatch) + get_signal_chains decorator gateways (Flask/FastAPI/Spring local path) into one endpoint table; _match_endpoints (verb+path exact→suffix); _impact_for_handler fuses get_blast_radius (importers+callers) + render→view edges. Read-only, standard tier. handler_symbol_id bypasses URL resolution for prefixed routes. First slice of the framework-routes design; FastAPI prefix / Spring class-mapping composition is the follow-on. ⚠ The PRD this used to cite (`docs/prd-framework-routes-endpoint-impact.md`) **has never existed** — not on disk, not in git history. A citation to a document nobody can open is worse than none, because it sends a reader hunting; the design intent above is the part that was real
     get_repo_health.py        # get_repo_health: one-call triage snapshot (delegate aggregator); includes six-axis `radar` field (v1.87.0) ⚠⚠ **`_count_unstable_modules` excludes framework entry points from BOTH sides of the ratio (#561)** -- the rule it already applied to tests, whose own comment says they have "Ca=0 by construction". Numerator-only would shrink a count without shrinking what it is a fraction of: **the 84.0 B -> 88.8 B sign error of 1.108.305.** ⚠ So an entry point with a real `Ce` problem is graded by NOTHING; `coupling_entry_points_excluded` + `coupling_framework_profile` disclose it. ⚠ Only the DETECTED profile excludes -- widening to `_ENTRY_POINT_FILENAMES` moves every Python repo's published score on a heuristic, and needs its own measurement. ⚠⚠ **A REFUSAL IS NOT A ZERO**: `get_dead_code_v2` returning `[]` WITH a `signal_warning` became `dead_code_pct: 0.0` and a dead_code axis of 100 -- the strongest claim assembled from an admission that nothing was established. `dead_code_measurable` feeds `unmeasurable_axes`, which withholds composite and grade.
     _test_paths.py            # (L-101) `is_test_file`, THE one test-file rule; six copies disagreed and a root-level `tests/` read dead. ⚠⚠ **`check_delete_safe`/`check_edit_safe` read it to DOWNGRADE a blocking verdict**, so a false positive is the worse error: each suffix is tied to its convention's extensions (`_spec` is `.rb`; `models/pod_spec.py` is production). Add a spelling HERE, with both preflights' verdicts tested. Misses and false positives: L-104.
-    _entry_points.py          # (#561/#562) `entry_point_spec(index)` -- reads the framework profile `detect_framework` persists into `context_metadata`. ⚠⚠ **That key was WRITTEN in one place and READ IN NONE for its whole life**, so three tools each reproduced their own Python-only answer to "is this a root?" and a Next.js repo detected ZERO entry points -- v2 returned `dead_symbols: []`, and 203 of 366 "unstable" files were `route.ts` handlers whose Ca is 0 BY CONSTRUCTION. ⚠⚠ **Flask/FastAPI shipped `"*.py"` there**, which under fnmatch declares the whole tree; catch-alls are removed at the source AND refused by `_is_catch_all`, gated by a test over every profile. Directory SCOPE saves a pattern (`routes/*.php` is fine, `**/*.php` is not). ⚠ Three dialects, all shipped: glob, bare filename (ROOT-LEVEL only -- `main.py` must not claim `src/vendor/main.py`), and directory prefix (`cmd/`, which fnmatch never matches). ⚠⚠ **`matches()` False is NOT "an ordinary module"** -- `profile_name is None` is the tell for no-declaration-available. [[grep-a-persisted-field-for-its-readers]]
+    _entry_points.py          # (#561/#562) `entry_point_spec(index)` -- reads the framework profile `detect_framework` persists into `context_metadata`. ⚠⚠ **That key was WRITTEN in one place and READ IN NONE for its whole life**, so three tools each reproduced their own Python-only answer to "is this a root?" and a Next.js repo detected ZERO entry points -- v2 returned `dead_symbols: []`, and 203 of 366 "unstable" files were `route.ts` handlers whose Ca is 0 BY CONSTRUCTION. ⚠⚠ **Flask/FastAPI shipped `"*.py"` there**, which under fnmatch declares the whole tree; catch-alls are removed at the source AND refused by `_is_catch_all`, gated by a test over every profile. Directory SCOPE saves a pattern (`routes/*.php` is fine, `**/*.php` is not). ⚠ Three dialects, all shipped: glob, bare filename (ROOT-LEVEL only -- `main.py` must not claim `src/vendor/main.py`), and directory prefix (`cmd/`, which fnmatch never matches). ⚠⚠ **`matches()` False is NOT "an ordinary module"** -- `profile_name is None` is the tell for no-declaration-available. [[grep-a-persisted-field-for-its-readers]] ⚠⚠ (L-102) `package_json_entries` is the one manifest reader the dead-code tools use (`index_folder` has its own, L-112) and reads `scripts`. **The rule is an ALLOWLIST**: `[NAME=value] [npx or cross-env] RUNNER [flags that runner's table knows] PATH`, with a path-shaped PATH; an unknown wrapper, flag, bare word, `cd`, p
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -466,6 +466,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_unicode_escapes_name_the_same_identifier.py | A call spelled with a Java/C#/ECMAScript Unicode escape (one or more `u` and four hex digits, hex in either case, every letter escaped, C#'s eight-digit `U`, ECMAScript's braced form) is a reference to the identifier it spells, and `check_delete_safe` does not grade the called Java method or JS function deletable; two escaped surrogates join into one character; a lone surrogate keeps its neighbour; the escape of another letter does not match. Java and JS fixtures are compiled/run when `javac`/`node` are present, outside the indexed tree. | LEDGER L-86 (2026-09-30), found in the L-83 review | 1 | LOAD-BEARING | Every escape is built from `chr(92)` and the fixture asserts the backslash reached disk: two drafts had their literal escapes decoded (by `printf`, then by the editing tool) and tested the plain spelling. Mutants: the braced branch absent and the surrogate join removed each fail one test (`red_review_round1.txt`); single-`u` only, lowercase hex only and the `U` branch disabled each fail one test (the L-86 reviewer's probes, both rounds, not in an evidence file). |
 | tests/test_investigator_trusts_the_folded_import_match.py | The deletion investigator refutes `export_not_imported` for an import in another Unicode form or written with an escape, and still does not count a specifier-stem match as an import of the name. | LEDGER L-90 (2026-10-01): a raw `target_name in names` re-filtered the rows `check_references` had matched through `_fold` | 1 | LOAD-BEARING | Escapes are built from `chr(92)`; each importer has its own importer because of L-94. Mutants (review, 2026-10-01): the raw comparison restored fails the two refuting tests; the filter replaced by `if r.get("matches")` fails the stem test, which passed against it until `src/app.js` gave `main.js` an importer. |
 | tests/test_investigator_entry_point_importer_is_live.py | A name imported only by a root (`main.py`, `package.json`'s `main`, a package `__init__.py`, a test) refutes `export_not_imported` and `no_textual_use`; a really dead importer still satisfies both with its cluster named; an importer `find_dead_code` is unsure of, or cannot answer for, is live. | LEDGER L-94 (2026-10-01): the investigator called an importer dead when nothing imported it, and an entry point has no importer by construction | 1 | LOAD-BEARING | The fix asks `find_dead_code`; the cannot-answer cases patch that function on its own module because the investigator imports it at call time. Five mutants, none survives (an unsure file counted dead, every importer dead, every importer live, an error and a raise read as all dead). The one test-file case passes by its `test_` name; a root-level `tests/` directory is L-101 and is not pinned here. |
+| tests/test_package_json_scripts_are_entry_points.py | A file a `package.json` script RUNS is a live root in `find_dead_code`, `get_dead_code_v2` and the deletion investigator; a script that is not in the allowlisted form (`[NAME=value] [npx or cross-env] RUNNER [known flags] PATH`) roots NOTHING; both tools bind the one reader. | LEDGER L-102 (2026-10-01): `scripts` was unread and the reader existed twice, so `node server.js` read dead at 1.0 | 1 | LOAD-BEARING | Most cases assert that nothing is rooted, and that is the half that matters (#569). Review rounds found, in order, wrong roots a list of exclusions had not named: the first argument that RESOLVED (`node build.js server.js`); a flag's value and a subcommand word (`nodemon --watch src`, `deno lint`); one flag table for every runner (`node --watch server.js worker.js`); a changed directory and a bare preload (`cd client && node build.js`, `-r esm`); a workspace-selecting wrapper flag (`pnpm --filter=web exec`). The rule became an allowlist after the last of those; the round after it found `node --env-file` listed as taking no value, and four shell spellings the lexer misread (`FOO=1 cd sub`, `\cd sub`, a `#` comment, a quoted `"&&"`). Round 6 found more of those (a shell word behind an assignment, a newline, `\"`), so the command text became an allowlist too: one character parametrization asserts that each character a shell interprets, anywhere in the command, roots nothing, and the value-flag table is written out whole and compared for equality. Round 7 ran the real runners and found that table wrong for bun `--config` and deno `--v8-flags`, with a test pinning the error: a table test agrees with the table, so the measurement is `evidence/l102_runner_flags.txt`. Round 8 found two more per-runner facts the cases had assumed: nodemon reads options after the script, and ts-node/tsx try `.js` before `.ts`; their cases are written from runs (`evidence/l102_round8_real.txt`), and the shell-word list is written out and compared for equality. Round 9 found the round-8 nodemon fix rooting a preload nodemon never loads; node
```

**File**: `docs/harness/FINDINGS.md` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ the tests that carry them.
 | F-38 | `suite.full_seconds_ci_windows` failed a leg whose tests all passed. PR #946 (run 36767909287, `full: test (windows-latest, 3.11)`, head 11c9f611): `13940 passed, 25 skipped ... in 1076.37s`, the Floor line `observed 1078.7` against its Floor. The diff is two `release.yml` install lines, the RUNBOOK and one test, so it cannot move suite runtime. The other three windows legs of the same run took 650, 764 and 775 s as whole jobs, and this one 1109 s (`gh run view 36767909287`). ⚠ The Floor was set on 2026-09-04 from four legs of one commit (median 516.3 s, x2, the entry's own `set_at`); the suite has grown since, to 13,965 collected here, so the margin over a typical leg has narrowed with the suite, not with the runner. | `harness/thresholds.json` `suite.full_seconds_ci_windows`, `harness/__main__.py::_full_wall_floor_id` | OPEN. One occurrence, and the tolerance rule (`docs/harness/DESIGN.md`) moves a timing Floor only on three CI runs, never on one flake: the failed job is re-run and the Floor stays. The candidate, if it recurs: re-set from the windows legs' pytest seconds of three green runs at today's suite size, recorded the way `self_latency_ci_runs_2026-09-22.json` was. |
 | F-39 | `suite.full_seconds` failed an ubuntu leg whose tests all passed. PR #955 (run 36900539828, `full: test (ubuntu-latest, 3.10)`, head 59d353b3): `14012 passed, 28 skipped ... in 358.03s`, the Floor line `observed 360.94` against `<= 360`. The diff is a release script, two `release.yml` steps, the RUNBOOK and one test file of 21 fast tests, so it cannot move suite runtime. The other three ubuntu legs of the same run read `observed 186.03` (3.12), `230.78` (3.13) and `342.14` (3.11): one tree, a spread of almost 2x between runners, and two of four legs within 20 s of the Floor. ⚠ The same Floor serves the local run, where this tree read 311.38 with four workers. Second occurrence of F-38's shape on the other OS. | `harness/thresholds.json` `suite.full_seconds`, `harness/__main__.py::_full_wall_floor_id` | OPEN. The Floor did not move. A push re-ran the leg. The 3.10 and 3.11 legs are the slow ones on both OSes in the two recorded misses, which is worth measuring before the Floor is touched |
 | F-40 | A test fixture replaced `time.sleep` on the REAL module and failed on whichever worker held a sleeping thread. `tests/test_registry_verify_retries_an_unanswered_read.py` (merged in #955) loaded `scripts/registry_verify.py` and set `mod.time.sleep` to a list's `append`; `mod.time` is the module every thread in the xdist worker shares. PR #956, run 36911633390: `full: test (ubuntu-latest, 3.11)` read `1 failed, 14034 passed, 28 skipped`, `AssertionError: assert (2 == 2 and 258047 == 1)`, and `full: test (windows-latest, 3.11)` failed the same test with `assert (2 == 2 and 179403 == 1)`; `windows-latest, 3.13` was cancelled and five legs passed. ⚠⚠ **The thread is `tests/test_v1_108_182.py`'s `_StubProvider.load`**, which loops `time.sleep(0.01)` to a 30 s deadline; `_run_with_budget` (`src/jcodemunch_mcp/parser/context/base.py`) abandons it on a daemon thread after its 0.2 s budget, by design (a watchdog cannot preempt a thread), so it outlives its test by half a minute and resolves `time.sleep` on every iteration (found by the reviewer; the log's list is all `0.01`). The miss is also a race: the failing test can finish inside one real 10 ms sleep, which fits two legs of eight. The eight `full:` legs of #955's merged head passed. | `tests/test_registry_verify_retries_an_unanswered_read.py`, `tests/test_registry_verify_reads_every_page.py`, `tests/test_v1_108_182.py` | FIXED 2026-10-01 for the two fixtures: each replaces the loaded module's own `time` NAME with a stub and asserts the real `time.sleep` and `time.monotonic` are untouched; a test with a sleeping thread beside it fails against the old fixture. OPEN for the rest: the abandoned 30 s provider thread is still there for the next fixture that patches a shared module (release it at teardown); both registry files still replace `urllib.request.urlopen` on the real module (no `urlopen` call exists under `src/` or elsewhere in `tests/`); `tests/test_watcher_lock.py` sets `watcher.asyncio.sleep`, the same class; no ratchet scans `tests/` for the property |
-| F-41 | `suite.full_seconds` failed a LOCAL full tier whose tests all passed, and the local margin F-39 leaned on is gone. Branch `fix/l101-root-level-test-dirs` (LEDGER L-101), `python .claude/hooks/run_full.py --workers 4`, seven runs on 2026-10-01, in order: 355.33, 348.87, 348.75, 345.79, 346.27, 372.03, 357.0 against `<= 360`. The sixth, on commit 901b2106, read `14125 passed, 25 skipped ... in 370.65s` and `observed 372.03 FAIL`; the box was idle when checked afterwards (CPU 12%, 14 GB free) and the re-run on the same tree read 357.0. Only the last reading is in an evidence file (`evidence/full.md`); the other six, the pytest line and the load figures were read from ru
```

**File**: `docs/workflows/LEDGER.md` (modified, +3/-1)
```diff
@@ -150,7 +150,7 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-99 | 2026-10-01, L-96 review | `scripts/registry_verify.py` reads one page (`&limit=100`) and follows no cursor. The live read returned 65 rows for `io.github.jgravelle/jcodemunch-mcp` on 2026-10-01, and each release adds one. Past the page size the latest row may not be on the page, which would read as exit 1 and "registry publish failed" on a good publish. | `scripts/registry_verify.py` | defect | medium | FIXED 2026-10-01: `fetch` follows `metadata.nextCursor` to the last page (a cursor that repeats or is in an unknown shape, a page that is not the registry's, or a run past `MAX_PAGES` is no answer), and the whole run, every attempt and page, ends inside `BUDGET_SECONDS`, which a test holds under the registry job's `timeout-minutes` because a cancelled job opens no issue; followed live at 10 and at 30 rows a page (`evidence/live_l99_paging.txt`); RUNBOOK 3a names the new causes (`tests/test_registry_verify_reads_every_page.py`) |
 | L-100 | 2026-10-01, L-99 review | `scripts/registry_verify.py`'s time budget bounds when a request may START, not when it ends: `urlopen(timeout=)` applies per socket operation, and a response dripping 20 bytes every 0.6 s ran 6.64 s on `--budget 1.0` (reviewer's measurement). The comment and the commit message say the run ends inside the budget. The job has 300 s of slack over the default, less the install and publish steps. Three budget mutants also survive the tests: the sleep check ignoring `--delay`; the budget `break` replaced by `return UNREADABLE` after an earlier wrong-row answer (a real FAIL retitled "could not be read"); the deadline reset on each attempt. And `--budget` is not validated: `0` or a negative makes no request and prints "no answer in 1 attempt(s)", `nan` and `inf` switch the budget off. `release.yml` passes no `--budget`. | `scripts/registry_verify.py`, `tests/test_registry_verify_reads_every_page.py` | defect | low | OPEN |
 | L-101 | 2026-10-01, L-94 review | `find_dead_code._is_test_file` tests `"/tests/" in fp`, `"/test/"` and `"/__tests__/"`, each needing a LEADING slash, so a test directory at the repository root is not one: `tests/helpers.py` and `__tests__/shapes.js` are reported dead at `1.0 zero_importers` where `pkg/tests/helpers.py` is skipped (reviewer's measurement). The deletion investigator, which asks this tool since L-94, then answers `export_not_imported` SATISFIED for a name such a file imports. ⚠ There are six test-file predicates under `src/` (`find_dead_code`, `get_dead_code_v2`, `check_delete_safe`, `find_similar_symbols`, `get_pr_risk_profile`, `investigator/reuse_audit`); the fix is one shared predicate with pinned cases, not a sixth patch. | `src/jcodemunch_mcp/tools/find_dead_code.py` and the five siblings | defect | medium | FIXED 2026-10-01: one rule, `tools/_test_paths.is_test_file`, reads the path's directories and its filename; the six copies and `get_file_risk`'s inline regex are imports of it. Each filename suffix is tied to the extensions that carry its convention (`_spec` is `.rb`, `.spec.`/`.test.` are JavaScript and TypeScript), because `check_delete_safe` and `check_edit_safe` read the rule to downgrade a blocking verdict; the first draft called `models/pod_spec.py` a test and the review measured the downgrade. On this repository `find_dead_code` stops reporting `tests/conftest_helpers.py` and reports nothing new. `tests/test_one_test_file_predicate.py` pins the cases in both directions, fails when a module binds the names the copies used at any depth by a def, a class, an assignment, a walrus, a loop or `with` target, an argument, an import alias (unless the name it imports is itself one of those names), a `match` capture or an `except ... as` (a write through `globals()` or onto another module's attribute, and a function-local import of the same name, are not read), and runs `find_dead_code`, `get_dead_code_v2`, the investigator, `get_file_risk`, `check_delete_safe` and `check_edit_safe`. The other consumers (`get_pr_risk_profile`, `find_similar_symbols`, the reuse audit, `get_blast_radius`, `get_untested_symbols`, `find_unused_paths`, `get_parity_map`) are covered by the binding check alone, which a rule under a new name passes |
-| L-102 | 2026-10-01, L-94 review | `find_dead_code` knows no undeclared non-Python entry point: `_ENTRY_POINT_FILENAMES` is Python and nothing else, and `_package_json_entries` reads `main`/`module`/`browser`/`exports`/`bin`, not `scripts`. `index.js` with no `package.json`, `server.js` named only by `scripts.start`, `src/index.ts` with no `package.json`, and a Python script with no main guard are each reported dead, and the deletion investigator then reads a name they import as "Imported only by X, which is itself unreachable" (reviewer's measurement, unchanged from before L-94). Measure what a wider root list does to the false-negative side before widening it (#569's lesson). | `
```

**File**: `src/jcodemunch_mcp/investigator/deletion_safety.py` (modified, +3/-3)
```diff
@@ -116,9 +116,9 @@ def _split_importers_by_liveness(
     never in its answer, so a test importing the name is a live importer.
 
     ⚠ This inherits the authority's gaps as well as its roots. It does not
-    recognise a root-level `tests/` directory (LEDGER L-101) or an undeclared
-    non-Python entry point such as `index.js` with no `package.json` (L-102),
-    and both still read as dead here. Fix them THERE.
+    recognise an undeclared non-Python entry point such as `index.js` with
+    no `package.json` (LEDGER L-111), which still reads as dead here. Fix it
+    THERE.
     """
     try:
         from ..tools.find_dead_code import find_dead_code  # noqa: PLC0415
```

**File**: `src/jcodemunch_mcp/tools/_entry_points.py` (modified, +466/-0)
```diff
@@ -25,7 +25,11 @@
 from __future__ import annotations
 
 import fnmatch
+import json
 import logging
+import posixpath
+import re
+import shlex
 from dataclasses import dataclass
 from typing import Optional
 
@@ -139,3 +143,465 @@ def entry_point_spec(index) -> EntryPointSpec:
         profile_name=name if isinstance(name, str) and name else None,
         patterns=patterns,
     )
+
+
+# ---------------------------------------------------------------------------
+# package.json: the files a manifest DECLARES as roots
+# ---------------------------------------------------------------------------
+#
+# One reader (LEDGER L-102). It lived twice, in `find_dead_code` and in
+# `get_dead_code_v2`, with the same logic, and neither read `scripts`: a server
+# started by `"start": "node server.js"` has no importer by construction and
+# was published dead at confidence 1.0.
+
+_JS_ENTRY_SUFFIXES = (
+    "", ".js", ".ts", ".mjs", ".cjs", ".mts", ".cts", ".jsx", ".tsx",
+    "/index.js", "/index.ts", "/index.mjs", "/index.cjs",
+)
+
+# ⚠⚠ THE RULE IS AN ALLOWLIST. A wrong root removes a dead file from the report
+# and from the delete preflight with no symptom (#569), and four review rounds
+# each found a new spelling a denylist had not named: a flag's value, a
+# subcommand word, `cd client &&`, `pnpm --filter=web exec`. So a command roots
+# a file only when EVERY token in front of it is one this table knows:
+#
+#   [NAME=value ...] [npx [-y] | cross-env [NAME=value ...]] RUNNER [known flags] [exec word] PATH
+#
+# and PATH is path-shaped (it has a `/` or a `.`), so a bare word is never read
+# as a file. An unknown wrapper, an unknown flag, a shell keyword, a redirect, a
+# pipe or a changed directory makes the command declare nothing. A missed root
+# leaves a live file reported, which the reader can see.
+#
+# There is no list of flags that execute no file (`node --check x.js`, `-e`,
+# `--test`, `--run`, `--version`): they are simply absent from `flags`, and an
+# unknown flag declares nothing. ⚠ Adding one of them to `flags` roots its
+# argument.
+#
+# Per runner, because one spelling means different things (`--watch` takes a
+# value for nodemon and none for node; `-r` is `--require` for node and
+# `--reload` for deno):
+#   flags     known flags that take no value in the next token (boolean, or `--flag=value`)
+#   value     known flags that take their value in the NEXT token
+#   preload   value flags whose value is a module loaded before the entry
+#   exec_sub  words that come before the file and mean "execute it"
+#   exec      flags whose value is a COMMAND the runner runs (nodemon --exec)
+#   suffixes  what the runner appends when the argument names no file exactly
+#   prefixes  flag prefixes known as a family (`--allow-net`, `--unstable-kv`)
+_NODE_FLAGS = frozenset({
+    "--watch", "--watch-preserve-output", "--inspect", "--inspect-brk", "--trace-warnings",
+    "--trace-deprecation", "--throw-deprecation", "--no-warnings", "--no-deprecation",
+    "--enable-source-maps", "--experimental-modules", "--experimental-json-modules",
+    "--experimental-vm-modules", "--experimental-strip-types", "--experimental-specifier-resolution",
+    "--harmony", "--expose-gc", "--preserve-symlinks", "--abort-on-uncaught-exception",
+    "--max-old-space-size", "--stack-size",
+})
+_NODE_VALUE = frozenset({
+    "-C", "--conditions", "--watch-path", "--inspect-port", "--title", "--input-type",
+    "--env-file", "--unhandled-rejections",
+})
+_NODE_PRELOAD = frozenset({"-r", "--require", "--import", "--loader", "--experimental-loader"})
+_NODE_ESM_PRELOAD = frozenset({"--import", "--loader", "--experimental-loader"})
+# ts-node's pretty-printing flag is deliberately absent: tests/test_tectonic_temporal_signal.py
+# reads that literal anywhere under src/ as a git format argument.
+_TS_NODE_FLAGS = frozenset({
+    # `--esm` is absent: ts-node 10.9.2 then resolves the entry as ESM, which appends no
+    # extension, so the flag is unknown here and the command declares nothing.
+    "--files", "-T", "--transpile-only", "--transpileOnly", "--swc", "-H", "--compiler-host",
+    "--skip-project", "--skipProject", "--skip-ignore", "--prefer-ts-exts", "--log-error",
+    "--emit", "--type-check", "--typeCheck",
+})
+_TS_NODE_VALUE = frozenset({
+    "-P", "--project", "-C", "--compiler", "-O", "--compiler-options", "--compilerOptions",
+    "-I", "--ignore", "--scope-dir", "--scopeDir", "-D", "--ignore-diagnostics", "--transpiler",
+})
+_NONE: frozenset = frozenset()
+_JS = ("", ".js", "/index.js")  # node tries `.js`; it never tries `.ts` or `.mjs`
+_TS = ("", ".ts", ".tsx", ".js", "/index.ts", "/index.js")
+
+
+def _spec(
+    flags=_NONE, value=_NONE, preload=_NONE, exec_sub=_NONE, exec=_NONE, suffixes=_JS, prefixes=(),
+    equals=True, trailing=False,
+):
+    """One runner's grammar. ``equals``: it reads `--flag=value`. ``trailing``: it
+    reads options after the script too (nodemon does; node does not), so
```

**File**: `src/jcodemunch_mcp/tools/find_dead_code.py` (modified, +1/-64)
```diff
@@ -3,7 +3,6 @@
 from __future__ import annotations
 
 import fnmatch
-import json
 import logging
 import re
 import time
@@ -13,7 +12,7 @@
 from ..parser.imports import resolve_specifier
 from ._utils import index_status_to_tool_error, resolve_repo
 from ..parser.context._route_utils import ENTRY_POINT_DECORATOR_RE
-from ._entry_points import entry_point_spec
+from ._entry_points import entry_point_spec, package_json_entries as _package_json_entries
 from ._runtime_discovery import discover_dynamic_packages
 from ._corpus_adequacy import UNPROVEN_CEILING, assess_corpus
 from ._dynamic_boundary import FILES_CAP as DYNAMIC_FILES_CAP, DynamicBoundary
@@ -126,68 +125,6 @@ def unmatched_patterns(patterns: Optional[list[str]], source_files) -> list[str]
     return [p for p in patterns if not any(_matches_any_pattern(f, [p]) for f in files)]
 
 
-def _package_json_entries(index, store, owner: str, repo_name: str) -> set[str]:
-    """Return source files referenced by any ``package.json``'s ``main`` /
-    ``module`` / ``exports`` / ``bin`` field. JS-library equivalent of the
-    Python ``app.py``/``main.py`` filename heuristic. (Backported from
-    get_dead_code_v2 in v1.80.8 — sverklo bench parity.)
-    """
-    entries: set[str] = set()
-    source_files = frozenset(index.source_files)
-    for f in index.source_files:
-        fn = f.replace("\\", "/").rsplit("/", 1)[-1]
-        if fn != "package.json":
-            continue
-        content = store.get_file_content(owner, repo_name, f)
-        if not content:
-            continue
-        try:
-            pkg = json.loads(content)
-        except (ValueError, TypeError):
-            continue
-        if not isinstance(pkg, dict):
-            continue
-        candidates: list[str] = []
-        for key in ("main", "module", "browser"):
-            v = pkg.get(key)
-            if isinstance(v, str):
-                candidates.append(v)
-        exports = pkg.get("exports")
-        if isinstance(exports, str):
-            candidates.append(exports)
-        elif isinstance(exports, dict):
-            def _walk_exports(node):
-                if isinstance(node, str):
-                    candidates.append(node)
-                elif isinstance(node, dict):
-                    for v in node.values():
-                        _walk_exports(v)
-            _walk_exports(exports)
-        bins = pkg.get("bin")
-        if isinstance(bins, str):
-            candidates.append(bins)
-        elif isinstance(bins, dict):
-            candidates.extend(v for v in bins.values() if isinstance(v, str))
-
-        pkg_dir = f.replace("\\", "/").rsplit("/", 1)[0] if "/" in f else ""
-        for cand in candidates:
-            cand = cand.lstrip("./").replace("\\", "/")
-            joined = f"{pkg_dir}/{cand}" if pkg_dir else cand
-            joined = joined.lstrip("/")
-            if joined in source_files:
-                entries.add(joined)
-                continue
-            for ext in ("", ".js", ".ts", ".mjs", ".cjs", ".mts", ".cts",
-                        ".jsx", ".tsx",
-                        "/index.js", "/index.ts", "/index.mjs",
-                        "/index.cjs"):
-                trial = joined + ext
-                if trial in source_files:
-                    entries.add(trial)
-                    break
-    return entries
-
-
 def _has_entry_point_decorator(sym: dict) -> bool:
     for dec in sym.get("decorators") or []:
         if ENTRY_POINT_DECORATOR_RE.search(str(dec)):
```

---

### Incident Patch 7: `8f7dc64c` (2026-10-02)
**Commit Message**: fix: a local model path is refused when the installed sentence-transformers would run its code (L-108) (#967)

* fix: a local model path is refused when the installed sentence-transformers would run its code (L-108)

The semantic extra's floor is install metadata, so an upgrade that does not
name the extra keeps a release before 5.6.0 (GHSA-jhr6-gm9c-rqjv). The call
site checks the release it imported and refuses an existing path before the
model is constructed. A Hub name is not refused. Unknown version refuses.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: a 5.6.0 pre-release is refused, and fusion search names why its semantic channel did not run (review round 1)

search_symbols(fusion=true) caught the refusal and answered semantic: off,
the same as a repository never embedded. It carries semantic_channel_error
in the body and the verdict channel reads unavailable. The compact encoder
declares the key. LEDGER L-109: the sibling servers' call sites.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: a fusion answer whose similarity channel failed is not cached (review round 2)

The result cache key holds no provider or library version, so the refusal
was re

**File**: `CHANGELOG.md` (modified, +25/-0)
```diff
@@ -2,6 +2,31 @@
 
 ## [Unreleased]
 
+### Security
+
+- **A local model path is refused when the installed `sentence-transformers` would run its code.**
+  1.108.326 raised the `semantic` extra's floor to 5.6.0 (GHSA-jhr6-gm9c-rqjv), and a floor is install
+  metadata: `pip install -U jcodemunch-mcp` without the extra named, or a `sentence-transformers`
+  installed directly, keeps the older release, and nothing said so. The embedding call now checks the
+  release it imported. When `embed_model` (or `JCODEMUNCH_EMBED_MODEL`) is a path that exists and the
+  release is older than 5.6.0, is a pre-release of 5.6.0, or has a version that cannot be read, the call
+  refuses before the model is constructed and names the advisory and the upgrade command. Where the
+  reason appears: `embed_repo` reports it under `error_causes`; `search_symbols(semantic=true)` returns
+  it as the error; `search_symbols(fusion=true)` still answers from its other channels and carries it
+  in a new `semantic_channel_error` field, with the verdict's semantic channel reading `unavailable`.
+  That fusion exit used to catch every failure of its similarity channel and answer `off`, the same as
+  a repository that was never embedded; any exception there is named now, not only this refusal, with
+  the message redacted and cut like `error_causes`. Two things follow. A fusion answer whose channel
+  failed is not cached, so the next call tries the channel again (a cached refusal would have been
+  replayed after the upgrade it asks for). And a fusion search that returns nothing while the channel
+  failed still reads `absent`, as it did before: its lexical and identity passes score every candidate,
+  so zero rows is a fact about the corpus. The failed channel is labelled beside that verdict.
+  An embedded repository with no provider configured still reads `off`; nothing was attempted there. A Hub
+  model name is not refused, because the bypass is in the local-directory path. A name that is a path
+  only after `~` or `$VAR` expansion is refused too, although the library would not load it from disk.
+  A fixed release behaves as before (LEDGER L-108). jdocmunch-mcp and jdatamunch-mcp have their own
+  call sites and do not have this check (L-109).
+
 ## [1.108.326] - 2026-10-02 - the semantic extra requires a sentence-transformers that does not run a local model's code
 
 ### Security
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -469,6 +469,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_one_test_file_predicate.py | One rule says whether a path is a test file: the cases are pinned in both directions; every name a module binds for the question IS the shared function; a root-level `tests/`, `test/` and `__tests__/` are tests to `find_dead_code`, `get_dead_code_v2`, the deletion investigator and `get_file_risk`; and `check_delete_safe` and `check_edit_safe` give a production `models/pod_spec.py` consumer the verdict they give `models/pod.py`. | LEDGER L-101 (2026-10-01): six predicates, no two agreeing; the dead-code pair needed a slash before `tests/` and reported a root-level test file dead at 1.0. The first draft of the shared rule downgraded a blocked delete for a `*_spec.py` consumer | 1 | LOAD-BEARING | ⚠ The binding check is keyed on the names the copies used; a rule under a new name, or written inline, is seen only through the tools the file runs, and `get_pr_risk_profile`, `find_similar_symbols`, the reuse audit, `get_blast_radius`, `get_untested_symbols`, `find_unused_paths` and `get_parity_map` are not among them. It also pins both preflights' verdicts for the three ambiguous spellings kept (`ab_test.py`, `tests.py`, `ab_tests/`); the edit verdict there is `safe_to_edit` and is a disclosed trade (L-104), so a narrowed rule changes that test on purpose. Mutants: `evidence/red_l101_mutants.txt`. |
 | tests/test_repo_key_lookup_caches_what_it_learned.py | `config._resolve_repo_key` lists the index store once for a miss, for a matched source root and for a repo id; discovery under a root that matches no index does not list per file; a remembered miss does not outlive an index saved here, expires for one saved elsewhere, and a listing that raises is not remembered; a resolved key does not outlive its deleted index; both caches are bounded. | #960 (@ebataeva, 2026-10-02): the negative cache was documented and never written, so each candidate file in a walk cost a listing of every index | 1 | LOAD-BEARING | Counts `IndexStore.list_repos` calls on a real storage dir; the clock is a stub on the module's own `time` name, never the real module (F-40). Mutants: `evidence/red_960_mutants.txt`. |
 | tests/test_semantic_extra_floor.py | Every requirement in `pyproject.toml` (dependencies, extras, dependency groups) that names `sentence-transformers` excludes the releases before 5.6.0, no tracked requirements, constraints or `.pins` file admits one under any spelling of the name, and the lock holds a fixed `sentence-transformers` and `urllib3`. | GHSA-jhr6-gm9c-rqjv (2026-10-02, Dependabot alert 151): a local model directory ran its own code with `trust_remote_code` off, and the extra's floor was `>=2.2.0` | 1 | LOAD-BEARING | Reads `pyproject.toml` and `uv.lock`; the PR gate's audit covers the runtime set only, which contains neither package, so it stayed green with the alerts open (`evidence/dependabot_alerts.txt`). The first version of this file read the extras and the lock only and missed `benchmarks/requirements-rag-bench.txt`, which pinned `<4.0`; the second matched the name by prefix and walked untracked files. It enumerates with `git ls-files` and compares canonical names. The third read only the extras table, compared that name raw, and put a one-separator regex in front of the parse, so `sentence_transformers` in a new extra, any spelling in a dependency group, and `sentence__transformers` in a pin file all passed; every requirement line is parsed now and `requirements/` and `.lock` names are read. The fourth dropped a line `Requirement` rejects, so a VCS link, a wheel URL, an editable or a tab before `--hash` passed, and it followed no `-r`/`-c`; a rejected line that names the package fails the test now and includes are followed. A pin in a file that no pin file includes and `_PIN_FILE` does not name is not seen; an include whose target does not resolve as written (a quoted path, a variable) is skipped; a line that cannot be parsed and does not name the package in its text (`-e ./vendor/st`) is not seen, and the pin files are not read for `urllib3` (LEDGER L-107). |
+| tests/test_embed_model_version_floor.py | A local model path is refused before `SentenceTransformer` is constructed when the imported `sentence-transformers` is older than 5.6.0 or its version cannot be read; a fixed release and a Hub name load; a pre-release of 5.6.0 is refused; `embed_repo`'s response carries the cause and the remedy inside the failure ledger's 300 characters; `search_symbols(fusion=true)` carries it as `semantic_channel_error` and the compact encoder keeps that key. | LEDGER L-108 (2026-10-02): the `semantic` extra's floor is install metadata, so an upgrade that does not name the extra keeps a release that runs a local model's code (GHSA-jhr6-gm9c-rqjv) | 1 | LOAD-BEARING | The library is faked and the fake records construction, so a refusal that arrives after the load fails. The first mess
```

**File**: `docs/harness/FINDINGS.md` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ the tests that carry them.
 | F-38 | `suite.full_seconds_ci_windows` failed a leg whose tests all passed. PR #946 (run 36767909287, `full: test (windows-latest, 3.11)`, head 11c9f611): `13940 passed, 25 skipped ... in 1076.37s`, the Floor line `observed 1078.7` against its Floor. The diff is two `release.yml` install lines, the RUNBOOK and one test, so it cannot move suite runtime. The other three windows legs of the same run took 650, 764 and 775 s as whole jobs, and this one 1109 s (`gh run view 36767909287`). ⚠ The Floor was set on 2026-09-04 from four legs of one commit (median 516.3 s, x2, the entry's own `set_at`); the suite has grown since, to 13,965 collected here, so the margin over a typical leg has narrowed with the suite, not with the runner. | `harness/thresholds.json` `suite.full_seconds_ci_windows`, `harness/__main__.py::_full_wall_floor_id` | OPEN. One occurrence, and the tolerance rule (`docs/harness/DESIGN.md`) moves a timing Floor only on three CI runs, never on one flake: the failed job is re-run and the Floor stays. The candidate, if it recurs: re-set from the windows legs' pytest seconds of three green runs at today's suite size, recorded the way `self_latency_ci_runs_2026-09-22.json` was. |
 | F-39 | `suite.full_seconds` failed an ubuntu leg whose tests all passed. PR #955 (run 36900539828, `full: test (ubuntu-latest, 3.10)`, head 59d353b3): `14012 passed, 28 skipped ... in 358.03s`, the Floor line `observed 360.94` against `<= 360`. The diff is a release script, two `release.yml` steps, the RUNBOOK and one test file of 21 fast tests, so it cannot move suite runtime. The other three ubuntu legs of the same run read `observed 186.03` (3.12), `230.78` (3.13) and `342.14` (3.11): one tree, a spread of almost 2x between runners, and two of four legs within 20 s of the Floor. ⚠ The same Floor serves the local run, where this tree read 311.38 with four workers. Second occurrence of F-38's shape on the other OS. | `harness/thresholds.json` `suite.full_seconds`, `harness/__main__.py::_full_wall_floor_id` | OPEN. The Floor did not move. A push re-ran the leg. The 3.10 and 3.11 legs are the slow ones on both OSes in the two recorded misses, which is worth measuring before the Floor is touched |
 | F-40 | A test fixture replaced `time.sleep` on the REAL module and failed on whichever worker held a sleeping thread. `tests/test_registry_verify_retries_an_unanswered_read.py` (merged in #955) loaded `scripts/registry_verify.py` and set `mod.time.sleep` to a list's `append`; `mod.time` is the module every thread in the xdist worker shares. PR #956, run 36911633390: `full: test (ubuntu-latest, 3.11)` read `1 failed, 14034 passed, 28 skipped`, `AssertionError: assert (2 == 2 and 258047 == 1)`, and `full: test (windows-latest, 3.11)` failed the same test with `assert (2 == 2 and 179403 == 1)`; `windows-latest, 3.13` was cancelled and five legs passed. ⚠⚠ **The thread is `tests/test_v1_108_182.py`'s `_StubProvider.load`**, which loops `time.sleep(0.01)` to a 30 s deadline; `_run_with_budget` (`src/jcodemunch_mcp/parser/context/base.py`) abandons it on a daemon thread after its 0.2 s budget, by design (a watchdog cannot preempt a thread), so it outlives its test by half a minute and resolves `time.sleep` on every iteration (found by the reviewer; the log's list is all `0.01`). The miss is also a race: the failing test can finish inside one real 10 ms sleep, which fits two legs of eight. The eight `full:` legs of #955's merged head passed. | `tests/test_registry_verify_retries_an_unanswered_read.py`, `tests/test_registry_verify_reads_every_page.py`, `tests/test_v1_108_182.py` | FIXED 2026-10-01 for the two fixtures: each replaces the loaded module's own `time` NAME with a stub and asserts the real `time.sleep` and `time.monotonic` are untouched; a test with a sleeping thread beside it fails against the old fixture. OPEN for the rest: the abandoned 30 s provider thread is still there for the next fixture that patches a shared module (release it at teardown); both registry files still replace `urllib.request.urlopen` on the real module (no `urlopen` call exists under `src/` or elsewhere in `tests/`); `tests/test_watcher_lock.py` sets `watcher.asyncio.sleep`, the same class; no ratchet scans `tests/` for the property |
-| F-41 | `suite.full_seconds` failed a LOCAL full tier whose tests all passed, and the local margin F-39 leaned on is gone. Branch `fix/l101-root-level-test-dirs` (LEDGER L-101), `python .claude/hooks/run_full.py --workers 4`, seven runs on 2026-10-01, in order: 355.33, 348.87, 348.75, 345.79, 346.27, 372.03, 357.0 against `<= 360`. The sixth, on commit 901b2106, read `14125 passed, 25 skipped ... in 370.65s` and `observed 372.03 FAIL`; the box was idle when checked afterwards (CPU 12%, 14 GB free) and the re-run on the same tree read 357.0. Only the last reading is in an evidence file (`evidence/full.md`); the other six, the pytest line and the load figures were read from ru
```

**File**: `docs/workflows/LEDGER.md` (modified, +3/-1)
```diff
@@ -156,4 +156,6 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-105 | 2026-10-02, #960 review | `config._resolve_repo_key` compares the identifier raw. Another spelling of an indexed root (a trailing separator, forward slashes on Windows, a different case on Windows) matches neither `_PROJECT_CONFIGS` nor the listing's resolved path, so `config.get(key, repo=<that spelling>)` answers from global where the project's `.jcodemunch.jsonc` sets the key (reviewer's probe: 512000 where the file says 1234, on `origin/main` and on the #960 branch alike). Since #960 the wrong answer is also remembered for the miss TTL. Normalise the identifier once at the top of the resolver; check what `index_folder` and the watcher pass. Also: `SQLiteIndexStore.delete_index` called from the store's own sweep does not reach `forget_repo_resolutions`, so a resolved key can outlive an index removed that way, and so can one removed by another process (benign: no project overlay is found and global answers). Three more from the #960 review, round 2: (a) a source-root PATH hit is not retained when the listing fills the bound and many roots are asked in turn, because the bound is one listing plus one asked-for key (reviewer's measurement on the #960 branch: 250 indexes and 100 distinct root paths list on every one of 500 lookups; up to 17 paths list once each); `main` listed on every path lookup, so it is not a regression, and the fix is to key the listing by resolved path as well and size the bound for three keys an index; (b) `IndexStore.delete_index` forgets before it unlinks a legacy `.json` index, so a lookup between the two can remember an index that is about to go; move the call to the end; (c) nothing tests that an overtaken listing writes no HIT, and `updates.pop(repo, None)` and the `_REPO_MISS_CACHE.pop` on a hit are lines no test needs. | `src/jcodemunch_mcp/config.py` | defect | low | OPEN |
 | L-106 | 2026-10-02, GHSA-jhr6-gm9c-rqjv review | `benchmarks/requirements-rag-bench.txt` moved `sentence-transformers` from `>=2.2.0,<4.0` to `>=5.6.0,<7.0` because the old pin required a release inside the advisory range. The RAG baseline (`benchmarks/run_rag_baseline.py`) was NOT re-run under the new pin: `langchain-huggingface` 0.1.0 and 0.1.2 declare `sentence-transformers>=2.6.0` with no cap (PyPI metadata, `evidence/langchain_requires.txt`), so the two specifiers do not conflict, but nobody has run the set (`run_rag_baseline.py` and `benchmarks/harness/run_odysseus_compare.py` both install this file), and an embedding library moved from under 4.0 to 5.6 or later can move the baseline's numbers. Re-run it and re-sync the mirrors before the next time a RAG ratio is quoted. Also: `C:\MCPs\jdatamunch-mcp\pyproject.toml` declares `sentence-transformers>=2.2.0` in its `semantic` and `all` extras and needs the same floor (a setting fixed in one repo of a suite is fixed in one repo). | `benchmarks/requirements-rag-bench.txt`; jdatamunch-mcp `pyproject.toml` | defect | medium | OPEN |
 | L-107 | 2026-10-02, GHSA-jhr6-gm9c-rqjv review round 3 | Three competitive-sandbox pin files require a `urllib3` inside the advisory ranges the lock just left (GHSA-8988-9cw3-xx77, GHSA-vxq7-64xx-v4gw, GHSA-gh4c-6fx4-qh6g, fixed in 2.8.0): `aider.pins` holds `urllib3==2.6.3`, `cocoindex.pins` and `serena.pins` hold `urllib3==2.7.0`. They build the competitor containers only and nothing a user installs reads them. Re-pinning changes the environment a recorded competitor result was measured in, so it belongs with the next recorded competitive run: regenerate the three files with `urllib3>=2.8.0`, re-run, and extend `tests/test_semantic_extra_floor.py`'s pin scan to `urllib3`. | `benchmarks/competitive/sandbox/aider.pins`, `cocoindex.pins`, `serena.pins` | defect | low | OPEN |
-| L-108 | 2026-10-02, GHSA-jhr6-gm9c-rqjv review round 3 | The floor is install metadata only. `tools/embed_repo._embed_sentence_transformers` imports whatever `sentence-transformers` is installed and hands it `embed_model`, which may be a local path. A user who upgrades with `pip install -U jcodemunch-mcp` (no extra named), or who installed `sentence-transformers` directly, keeps a release before 5.6.0 and nothing says so. The layer-down fix is a version check at that call site that refuses, or warns, when the installed release is older than 5.6.0 and the model name is a path. It is a `src/` change with its own entry and tests. | `src/jcodemunch_mcp/tools/embed_repo.py` | defect | medium | OPEN |
+| L-108 | 2026-10-02, GHSA-jhr6-gm9c-rqjv review round 3 | The floor is install metadata only. `tools/embed_repo._embed_sentence_transformers` imports whatever `sentence-transformers` is installed and hands it `embed_model`, which may be a local path. A user who upgrades with `pip install -U jcodemunch-mcp` (no extra named), or who installed `sentence-transformers` directly, keeps a release before 5.6.0 and nothing says so. The layer-down fix is a vers
```

**File**: `src/jcodemunch_mcp/encoding/schemas/search_symbols.py` (modified, +3/-1)
```diff
@@ -26,7 +26,9 @@
 # semantic_topup (CF-66): the symbols a failed lazy-embedding batch left scored
 # lexically only, with the cause. A BODY dict (the dispatcher deletes `_meta`
 # on the shipped default), and an undeclared dict is dropped by the encoder.
-_JSON_BLOBS = ("semantic_topup",)
+# semantic_channel_error (L-108): why the fusion exit's similarity channel did not
+# run, e.g. a refused local model. A BODY dict for the same reason.
+_JSON_BLOBS = ("semantic_topup", "semantic_channel_error")
 
 
 def encode(tool: str, response: dict) -> tuple[str, str]:
```

**File**: `src/jcodemunch_mcp/tools/embed_repo.py` (modified, +71/-0)
```diff
@@ -214,6 +214,76 @@ def warm_up_embedding_backend() -> Optional[str]:
 # ── Per-provider embedding functions (all lazy-imported) ───────────────────
 
 
+# GHSA-jhr6-gm9c-rqjv: before this release, loading a LOCAL model directory
+# bypassed `trust_remote_code` and executed the custom Python inside it.
+_ST_LOCAL_CODE_FIXED = (5, 6, 0)
+
+
+def _sentence_transformers_version() -> tuple[Optional[tuple[int, ...]], bool, str]:
+    """(parsed release, is a pre-release, raw text) of the sentence-transformers actually imported.
+
+    The module's own `__version__` first, then the distribution metadata.
+    `None` means it could not be read, which is not the same as fixed.
+    """
+    import re
+    import sys
+
+    raw = getattr(sys.modules.get("sentence_transformers"), "__version__", None)
+    if not isinstance(raw, str):
+        try:
+            import importlib.metadata
+
+            raw = importlib.metadata.version("sentence-transformers")
+        except Exception:
+            logger.debug("sentence-transformers version could not be read", exc_info=True)
+            return None, False, ""
+    if not isinstance(raw, str):  # a distribution with no Version field answers None
+        return None, False, ""
+    match = re.fullmatch(r"(\d+)\.(\d+)(?:\.(\d+))?(.*)", raw.strip())
+    if not match:
+        return None, False, raw
+    pre = bool(re.match(r"[-_.]?(a|b|c|rc|alpha|beta|pre|preview|dev)\d*", match.group(4), re.IGNORECASE))
+    return tuple(int(part or 0) for part in match.groups()[:3]), pre, raw
+
+
+def _is_local_model_path(model_name: str) -> bool:
+    """True when the name is a path that exists.
+
+    The library tests `os.path.exists` on the RAW name, so the raw check is the
+    one that matches what it would load. The expanded check (`~`, `$VAR`) only
+    adds refusals: the library does not expand, so such a name would not load
+    from disk there. Refusing it is the safe direction.
+    """
+    expanded = os.path.expanduser(os.path.expandvars(model_name))
+    return os.path.exists(model_name) or os.path.exists(expanded)
+
+
+def _refuse_local_model_on_an_old_release(model_name: str) -> None:
+    """Raise before a local model directory reaches a release that runs its code unasked.
+
+    The `semantic` extra's floor is install metadata: an upgrade that does not
+    name the extra, or a `sentence-transformers` installed directly, keeps an
+    older release. A Hub name is not refused; the advisory is the local path.
+    """
+    if not _is_local_model_path(model_name):
+        return
+    parsed, pre, raw = _sentence_transformers_version()
+    # A pre-release OF the fixed release (5.6.0.dev0, 5.6.0rc1) may predate the fix.
+    if parsed is not None and (parsed > _ST_LOCAL_CODE_FIXED or (parsed == _ST_LOCAL_CODE_FIXED and not pre)):
+        return
+    found = f"sentence-transformers {raw}" if parsed is not None else (
+        "a sentence-transformers whose version could not be read"
+    )
+    # The cause and the remedy come first: the failure ledger keeps the first
+    # 300 characters of a message, and a path can be longer than that.
+    raise RuntimeError(
+        f"Refused: this environment has {found}, and releases before 5.6.0 final run the custom "
+        "code inside a local model directory with trust_remote_code off (GHSA-jhr6-gm9c-rqjv). "
+        "Run: pip install -U 'jcodemunch-mcp[semantic]', or set embed_model to a Hub model name. "
+        f"embed_model is the local path {model_name!r}."
+    )
+
+
 def _embed_sentence_transformers(texts: list[str], model_name: str) -> list[list[float]]:
     try:
         from sentence_transformers import SentenceTransformer  # type: ignore[import]
@@ -222,6 +292,7 @@ def _embed_sentence_transformers(texts: list[str], model_name: str) -> list[list
             "sentence-transformers is not installed. "
             "Run: pip install 'jcodemunch-mcp[semantic]'"
         ) from exc
+    _refuse_local_model_on_an_old_release(model_name)
     model = SentenceTransformer(model_name)
     raw = model.encode(texts, convert_to_numpy=False, show_progress_bar=False)
     return [list(map(float, e)) for e in raw]
```

**File**: `src/jcodemunch_mcp/tools/search_symbols.py` (modified, +28/-3)
```diff
@@ -1906,6 +1906,7 @@ def _search_symbols_fusion(
     #  embed_repo.embed_texts; the earlier EmbeddingStore(base_path=)/get_all(owner,name)/
     #  _embed_texts forms all raised and were swallowed, so this channel never ran.)
     similarity_used = False
+    similarity_error: Optional[dict] = None
     try:
         # v1.108.185: read-only, because the plain read wrote. `_connect` runs a
         # WAL pragma and a CREATE-TABLE script on every connection, so probing for
@@ -1931,11 +1932,18 @@ def _search_symbols_fusion(
                     )
                     channels.append(sim_ch)
                     similarity_used = True
-    except Exception:
+    except Exception as exc:
         import logging as _logging
         _logging.getLogger(__name__).debug(
             "fusion similarity channel unavailable", exc_info=True
         )
+        # The channel was attempted and failed. Saying `off` here read the same as a
+        # repo with no embeddings, and dropped a refusal's reason (L-108): a local
+        # model on an old sentence-transformers is refused inside `embed_texts`.
+        from ..embeddings.failures import FailureLedger
+        _ledger = FailureLedger()
+        _ledger.record(exc)
+        similarity_error = _ledger.rows()[0]
 
     # Fuse
     fused = fuse(channels, smoothing=smoothing, weights=weights)
@@ -2132,6 +2140,13 @@ def _search_symbols_fusion(
     # weakens the RANKING and cannot manufacture a false absence. That asymmetry is
     # exactly what the semantic exit lacked, and it is why there is no
     # `absence_unprovable` here.
+    #
+    # ⚠ That holds when the similarity channel was ATTEMPTED AND FAILED too
+    # (L-108): the fused set is still every candidate the lexical and identity
+    # passes scored, so `absent` stays reachable and is the same corpus fact the
+    # lexical path reports. What the caller is owed is the label and the cause:
+    # `semantic: unavailable` and `semantic_channel_error`, beside the verdict.
+    # tests/test_embed_model_version_floor.py pins that pair on a zero-row call.
     from ..retrieval.verdict import retrieval_verdict_for_index as _rv
     _vres = _rv(
         index,
@@ -2145,9 +2160,16 @@ def _search_symbols_fusion(
         query_terms=query_terms,
         scope=file_pattern,
         state_before=state_before,
-        semantic_channel="ok" if similarity_used else "off",
+        semantic_channel=(
+            "ok" if similarity_used else "unavailable" if similarity_error else "off"
+        ),
     )
     meta["verdict"] = _vres["verdict"]
+    if similarity_error:
+        # In the result, not `_meta`: `meta_fields: []` is the default and strips `_meta`.
+        result["semantic_channel_error"] = {
+            "type": similarity_error["type"], "message": similarity_error["message"],
+        }
     if _vres["negative_evidence"] is not None:
         # Parity with this tool's other exits: the same question must not get a
         # differently-honest answer depending on which ranking mode ran.
@@ -2165,7 +2187,10 @@ def _search_symbols_fusion(
             )
 
     _attach_index_truncation(result.get("_meta"), index)
-    if cacheable and cache_key is not None:
+    # A failed channel is not cached: the key holds neither provider nor library
+    # version, so a replay would assert the failure for a call that never had it,
+    # including after the upgrade the refusal tells the user to run.
+    if cacheable and cache_key is not None and not similarity_error:
         from ..retrieval import subject_state as _subject
         _result_cache_put(
             cache_key,
```

**File**: `tests/test_embed_model_version_floor.py` (added, +375/-0)
```diff
@@ -0,0 +1,375 @@
+"""A local model directory is not handed to a sentence-transformers that runs its code unasked.
+
+GHSA-jhr6-gm9c-rqjv: before 5.6.0, loading a LOCAL model directory bypassed
+`trust_remote_code` and executed the custom Python inside it. 1.108.326 raised
+the `semantic` extra's floor, which is install metadata: `pip install -U
+jcodemunch-mcp` without the extra named, or a `sentence-transformers` installed
+directly, keeps the old release (LEDGER L-108). The call site checks the
+release it actually imported.
+
+The library is faked here. No test loads a real model, and the fake records
+whether it was constructed, so a refusal that arrives after the load fails.
+"""
+
+from __future__ import annotations
+
+import importlib.metadata
+import sys
+import types
+
+import pytest
+
+from jcodemunch_mcp.tools import embed_repo
+
+
+def _fake_library(monkeypatch, version):
+    built: list[str] = []
+
+    class SentenceTransformer:
+        def __init__(self, name):
+            built.append(name)
+
+        def encode(self, texts, **_kwargs):
+            return [[0.0, 1.0] for _ in texts]
+
+    module = types.ModuleType("sentence_transformers")
+    module.SentenceTransformer = SentenceTransformer
+    if version is not None:
+        module.__version__ = version
+    monkeypatch.setitem(sys.modules, "sentence_transformers", module)
+    return built
+
+
+@pytest.fixture
+def model_dir(tmp_path):
+    path = tmp_path / "local-model"
+    path.mkdir()
+    return path
+
+
+@pytest.mark.parametrize("version", ["2.2.0", "4.1.0", "5.3.0", "5.5.1", "5.5.1.post1", "5.5"])
+def test_an_old_release_is_refused_for_a_local_directory(monkeypatch, model_dir, version):
+    built = _fake_library(monkeypatch, version)
+    with pytest.raises(RuntimeError) as exc:
+        embed_repo._embed_sentence_transformers(["x"], str(model_dir))
+    assert built == []
+    message = str(exc.value)
+    assert "GHSA-jhr6-gm9c-rqjv" in message and version in message
+    assert "jcodemunch-mcp[semantic]" in message
+
+
+@pytest.mark.parametrize("version", ["5.6.0", "5.6.1", "5.7.0", "6.1.0", "10.0.0"])
+def test_a_fixed_release_loads_a_local_directory(monkeypatch, model_dir, version):
+    built = _fake_library(monkeypatch, version)
+    assert embed_repo._embed_sentence_transformers(["x"], str(model_dir)) == [[0.0, 1.0]]
+    assert built == [str(model_dir)]
+
+
+def test_an_old_release_still_loads_a_hub_model(monkeypatch, tmp_path):
+    """The advisory is the local-directory path; a Hub name honours `trust_remote_code`."""
+    monkeypatch.chdir(tmp_path)
+    built = _fake_library(monkeypatch, "5.3.0")
+    assert embed_repo._embed_sentence_transformers(["x"], "BAAI/bge-base-en-v1.5") == [[0.0, 1.0]]
+    assert built == ["BAAI/bge-base-en-v1.5"]
+
+
+def test_a_bare_name_that_is_a_directory_in_the_working_directory_is_local(monkeypatch, tmp_path):
+    (tmp_path / "all-MiniLM-L6-v2").mkdir()
+    monkeypatch.chdir(tmp_path)
+    built = _fake_library(monkeypatch, "5.3.0")
+    with pytest.raises(RuntimeError):
+        embed_repo._embed_sentence_transformers(["x"], "all-MiniLM-L6-v2")
+    assert built == []
+
+
+def test_a_home_relative_path_is_local(monkeypatch, tmp_path):
+    (tmp_path / "models" / "m").mkdir(parents=True)
+    monkeypatch.setenv("HOME", str(tmp_path))
+    monkeypatch.setenv("USERPROFILE", str(tmp_path))
+    built = _fake_library(monkeypatch, "5.3.0")
+    with pytest.raises(RuntimeError):
+        embed_repo._embed_sentence_transformers(["x"], "~/models/m")
+    assert built == []
+
+
+def test_a_model_file_path_is_local(monkeypatch, tmp_path):
+    target = tmp_path / "model.bin"
+    target.write_bytes(b"")
+    built = _fake_library(monkeypatch, "5.3.0")
+    with pytest.raises(RuntimeError):
+        embed_repo._embed_sentence_transformers(["x"], str(target))
+    assert built == []
+
+
+def test_an_unreadable_version_is_refused_for_a_local_directory(monkeypatch, model_dir):
+    """UNKNOWN is not fixed: no `__version__` and no distribution metadata refuses."""
+    built = _fake_library(monkeypatch, None)
+
+    def missing(_name):
+        raise importlib.metadata.PackageNotFoundError("sentence-transformers")
+
+    monkeypatch.setattr(importlib.metadata, "version", missing)
+    with pytest.raises(RuntimeError) as exc:
+        embed_repo._embed_sentence_transformers(["x"], str(model_dir))
+    assert built == []
+    assert "could not be read" in str(exc.value)
+
+
+def test_the_distribution_version_is_read_when_the_module_has_none(monkeypatch, model_dir):
+    built = _fake_library(monkeypatch, None)
+    monkeypatch.setattr(importlib.metadata, "version", lambda _name: "6.1.0")
+    assert embed_repo._embed_sentence_transformers(["x"], str(model_dir)) == [[0.0, 1.0]]
+    assert built == [str(model_dir)]
+
+
+def test_the_refusal_reaches_the_caller_of_embed_texts(monkeypatch, model_dir):
+    built = _fake_library(monkeypatch, "5.3.0")
+    with pytest.raises(RuntimeError, match="
```

---

### Incident Patch 8: `ea5f088f` (2026-10-02)
**Commit Message**: release: v1.108.326 - the semantic extra requires a sentence-transformers that does not run a local model's code (#966)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
   "name": "jcodemunch",
   "displayName": "jCodeMunch",
-  "version": "1.108.325",
+  "version": "1.108.326",
   "description": "Token-efficient MCP server for source code exploration via tree-sitter AST parsing",
   "author": {
     "name": "J. Gravelle",
```

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## [Unreleased]
 
+## [1.108.326] - 2026-10-02 - the semantic extra requires a sentence-transformers that does not run a local model's code
+
 ### Security
 
 - **The `semantic` and `all` extras require `sentence-transformers>=5.6.0`.** GHSA-jhr6-gm9c-rqjv
```

**File**: `CLAUDE.md` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 # jcodemunch-mcp — Project Brief
 
 ## Current State
-- **Version:** 1.108.325 — **A lookup that found nothing is remembered.** `config._resolve_repo_key` documented a negative cache and never wrote one, so a `repo=` matching no index listed every index (opening every `.db`) on every call, and discovery asks once per candidate FILE (#960, @ebataeva). Both answers are cached; `forget_repo_resolutions()` runs on `IndexStore.save_index`/`delete_index`, and a miss expires after `_REPO_MISS_TTL_SECONDS` for a save made by another process. ⚠⚠ **A lookup writes NOTHING if a forget overtook its listing** (`_REPO_CACHE_GENERATION`); without it a miss written after a save hid the new index's project config. ⚠ The identifier is compared raw and many root PATHS past ~256 indexes are not all held (L-105). Forensics: `docs/workflows/LEDGER.md`.
+- **Version:** 1.108.326 — **The `semantic` extra requires a `sentence-transformers` that does not run a local model's code.** Before 5.6.0 a LOCAL model directory ran its own Python with `trust_remote_code` off (GHSA-jhr6-gm9c-rqjv), and `embed_repo` hands `embed_model` to it. The `semantic`/`all` extras floor is `>=5.6.0`; the lock holds 6.1.0 and `urllib3` 2.8.0. `tests/test_semantic_extra_floor.py` reads `pyproject.toml`, tracked pin files and the lock. ⚠⚠ **The floor is install metadata**: an upgrade without the extra named keeps an old release and the call site does not check (L-108, OPEN). ⚠ The RAG baseline is not re-run under the new pin (L-106); three sandbox `.pins` hold an old `urllib3` (L-107). ⚠ The PR gate's audit reads the RUNTIME set only. Forensics: `docs/workflows/LEDGER.md`.
+- **Prior (1.108.325):** **A lookup that found nothing is remembered.** `config._resolve_repo_key` caches hits and misses; `forget_repo_resolutions()` runs on `IndexStore.save_index`/`delete_index` (#960, @ebataeva). ⚠⚠ **A lookup writes NOTHING if a forget overtook its listing** (`_REPO_CACHE_GENERATION`). ⚠ The identifier is compared raw (L-105, OPEN). Full text: `CHANGELOG.md`; verbatim in `ISSUE-HISTORY.md` (2026-10-02, release 1.108.326).
 - **Prior (1.108.324):** **One rule says whether a path is a test file.** `tools/_test_paths.is_test_file` replaced six disagreeing rules; a root-level `tests/` no longer reads dead (L-101). ⚠⚠ **The delete and edit preflights read it to DOWNGRADE a blocking verdict**: `*_test.*`, `tests.py` and `*_tests/` are kept, so a production consumer named that way reads `test_coverage_only` / `safe_to_edit` (L-104, OPEN; Key Files). Full text: `CHANGELOG.md`; verbatim in `ISSUE-HISTORY.md` (2026-10-02, release 1.108.325).
-- **Prior (1.108.323):** **An entry point has no importer, and that does not make it dead.** The deletion investigator's `_split_importers_by_liveness` asks `find_dead_code` and keeps no answer of its own (L-94). ⚠⚠ **It inherits that tool's gaps with its roots**: an undeclared non-Python entry point (L-102) still reads dead; fix it THERE. Also `registry_verify.py` retries, pages inside a budget and exits `UNREADABLE` for an unanswered read (L-96, L-98, L-99; RUNBOOK 3a). Full text: `CHANGELOG.md`; verbatim in `ISSUE-HISTORY.md` (2026-10-02, release 1.108.324).
-- **Older releases (1.108.322 and earlier):** see `CHANGELOG.md` (1.108.303-.310, 1.108.314-.315, 1.108.316 through 1.108.322 in `ISSUE-HISTORY.md`). The 1.108.182 entry ("a stall has a name and a ceiling", #375) and the 1.108.177-.181 #377 hardening arc are there in full.
-- **Tests:** 14142 passed, 25 skipped, **0 failed** (14167 total, +17 over the .324 line's 14150) (1.108.325, the full tier, `python .claude/hooks/run_full.py --workers 4`, on the settled tree after the bump and the rotation) **+ `uv run ruff check src/` clean**. ⚠ Prior (1.108.324): 14125 passed, 25 skipped, **0 failed** (14150 total). ⚠ Prior (1.108.323): 14049 passed, 25 skipped, **0 failed** (14074 total). ⚠ `ruff check tests/` reports 292 PRE-EXISTING errors and is NOT this project's gate; `src/` is. ⚠⚠ **THE ROTATION IS TWO EDITS, NOT ONE** — moving a release out of Current State also moves the "Older releases (X and earlier)" boundary, and `test_claude_md_rotation.py` fails naming both numbers; it caught .311's settled run at `1 failed`. ⚠⚠ **READ THE SKIP COUNT, NOT JUST THE EXIT CODE AND THE TOTAL** — a .305 reproduce came back exit 0 with the total reconciling exactly while 105 tests silently did not execute. Forensics and the correct command: **Reproducing CI's environment**. ⚠⚠ **Compare TOTALS, never passed counts, and NEVER a skip count ACROSS machines** — CI ubuntu skips 26 and windows 19 where this box skips 13, all pre-existing; **the before/after delta on the SAME job is the only signal**. ⚠⚠ **A BACKGROUND-TASK BANNER SAYING "exit code 0" IS NOT A GREEN SUITE** — one run reported exit 0 having never started pytest (`--timeout` plugin absent), and .306 had a banner say exit 0 over a log whose own `EXIT=` line said 1. **Redirect the exit code INTO the log (`{ pytest; echo "EX
```

**File**: `ISSUE-HISTORY.md` (modified, +14/-0)
```diff
@@ -2130,3 +2130,17 @@ The 1.108.324 entry, verbatim, dropped when it was compressed to a `Prior` line:
 The `Tests:` line's 1.108.322 count, verbatim:
 
 - ⚠ Prior (1.108.322): 13994 passed, 25 skipped, **0 failed** (14019 total).
+
+## Current State rotation (2026-10-02, release 1.108.326)
+
+The 1.108.323 entry, verbatim as it stood in `CLAUDE.md`:
+
+- **Prior (1.108.323):** **An entry point has no importer, and that does not make it dead.** The deletion investigator's `_split_importers_by_liveness` asks `find_dead_code` and keeps no answer of its own (L-94). ⚠⚠ **It inherits that tool's gaps with its roots**: an undeclared non-Python entry point (L-102) still reads dead; fix it THERE. Also `registry_verify.py` retries, pages inside a budget and exits `UNREADABLE` for an unanswered read (L-96, L-98, L-99; RUNBOOK 3a). Full text: `CHANGELOG.md`; verbatim in `ISSUE-HISTORY.md` (2026-10-02, release 1.108.324).
+
+The 1.108.325 entry, verbatim, dropped when it was compressed to a `Prior` line:
+
+- **Version:** 1.108.325 — **A lookup that found nothing is remembered.** `config._resolve_repo_key` documented a negative cache and never wrote one, so a `repo=` matching no index listed every index (opening every `.db`) on every call, and discovery asks once per candidate FILE (#960, @ebataeva). Both answers are cached; `forget_repo_resolutions()` runs on `IndexStore.save_index`/`delete_index`, and a miss expires after `_REPO_MISS_TTL_SECONDS` for a save made by another process. ⚠⚠ **A lookup writes NOTHING if a forget overtook its listing** (`_REPO_CACHE_GENERATION`); without it a miss written after a save hid the new index's project config. ⚠ The identifier is compared raw and many root PATHS past ~256 indexes are not all held (L-105). Forensics: `docs/workflows/LEDGER.md`.
+
+The `Tests:` line's 1.108.323 count, verbatim:
+
+- ⚠ Prior (1.108.323): 14049 passed, 25 skipped, **0 failed** (14074 total).
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -158,10 +158,10 @@ That's the highlight reel. The complete tour of 90+ tools, the MUNCH compact wir
 <!-- WHATSNEW:START -->
 #### What's new
 
+- **[v1.108.326](https://github.com/jgravelle/jcodemunch-mcp/releases/tag/v1.108.326)** (2026-10-02) — the semantic extra requires a sentence-transformers that does not run a local model's code
 - **[v1.108.325](https://github.com/jgravelle/jcodemunch-mcp/releases/tag/v1.108.325)** (2026-10-02) — a lookup that found nothing is remembered
 - **[v1.108.324](https://github.com/jgravelle/jcodemunch-mcp/releases/tag/v1.108.324)** (2026-10-02) — one rule says whether a path is a test file
 - **[v1.108.323](https://github.com/jgravelle/jcodemunch-mcp/releases/tag/v1.108.323)** (2026-10-01) — an entry point has no importer, and that does not make it dead
-- **[v1.108.322](https://github.com/jgravelle/jcodemunch-mcp/releases/tag/v1.108.322)** (2026-10-01) — the deletion investigator reads the match the search made
 <!-- WHATSNEW:END -->
 
 ---
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "jcodemunch-mcp"
-version = "1.108.325"
+version = "1.108.326"
 description = "Token-efficient MCP server for source code exploration via tree-sitter AST parsing"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `server.json` (modified, +2/-2)
```diff
@@ -3,12 +3,12 @@
   "name": "io.github.jgravelle/jcodemunch-mcp",
   "title": "jCodemunch MCP",
   "description": "Token-efficient code exploration via tree-sitter AST parsing. 70+ languages, 86-99% token savings.",
-  "version": "1.108.325",
+  "version": "1.108.326",
   "packages": [
     {
       "registryType": "pypi",
       "identifier": "jcodemunch-mcp",
-      "version": "1.108.325",
+      "version": "1.108.326",
       "transport": {
         "type": "stdio"
       }
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1012,7 +1012,7 @@ wheels = [
 
 [[package]]
 name = "jcodemunch-mcp"
-version = "1.108.325"
+version = "1.108.326"
 source = { editable = "." }
 dependencies = [
     { name = "httpx" },
```

---

### Incident Patch 9: `0998e513` (2026-10-02)
**Commit Message**: fix: the semantic extra and the lock no longer admit a sentence-transformers that runs a local model's code (GHSA-jhr6-gm9c-rqjv) (#965)

* fix: the semantic extra requires a sentence-transformers that does not run a local model's code (GHSA-jhr6-gm9c-rqjv)

Before 5.6.0, loading a local model directory bypassed trust_remote_code. The
semantic and all extras declared >=2.2.0, so an environment already holding an
older release satisfied them. The floor is 5.6.0. The lock moves
sentence-transformers 5.3.0 -> 6.1.0 and urllib3 2.7.0 -> 2.8.0 (three open
advisories), spliced block by block and checked with uv 0.9.5.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: the RAG benchmark's requirements no longer require a vulnerable sentence-transformers (review round 1)

benchmarks/requirements-rag-bench.txt pinned <4.0, inside the advisory range,
and the new test read the extras and the lock only. It reads every tracked
requirements file now. The baseline has not been re-run under the new pin
(LEDGER L-106). The CHANGELOG names the embed_model config key beside the
environment variable.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: the pin scan reads tracked files

**File**: `CHANGELOG.md` (modified, +23/-0)
```diff
@@ -2,6 +2,29 @@
 
 ## [Unreleased]
 
+### Security
+
+- **The `semantic` and `all` extras require `sentence-transformers>=5.6.0`.** GHSA-jhr6-gm9c-rqjv
+  (critical): before 5.6.0, loading a LOCAL model directory bypassed `trust_remote_code` and ran the
+  custom Python inside it. `embed_repo` hands the `embed_model` config key, or `JCODEMUNCH_EMBED_MODEL`, to
+  `SentenceTransformer`, and that value may be a path. The extras declared `>=2.2.0`: a fresh install resolved to the latest
+  release, but an environment that already held an older one satisfied the requirement and kept it.
+  If you use the local `sentence-transformers` provider, upgrade it (`pip install -U
+  "jcodemunch-mcp[semantic]"`); the default install and the ONNX provider do not import it. The
+  repository's lock moves `sentence-transformers` from 5.3.0 to 6.1.0 and `urllib3` from 2.7.0 to
+  2.8.0 (GHSA-8988-9cw3-xx77, GHSA-vxq7-64xx-v4gw, GHSA-gh4c-6fx4-qh6g); neither is in the runtime
+  dependency set, and the published wheel pins neither. `benchmarks/requirements-rag-bench.txt`
+  pinned `sentence-transformers<4.0`, which required a vulnerable release; it reads `>=5.6.0,<7.0`
+  now, and the RAG baseline has not been re-run under it (LEDGER L-106). The upgrade crosses a major
+  version. What was run: `embed_repo`'s `sentence-transformers` path under 6.1.0 on Windows, Python
+  3.10, CPU, with `all-MiniLM-L6-v2` (`evidence/embed_under_6.txt`: 384-dimension vectors, the two
+  similar inputs closer than the unrelated one). That environment was a fresh resolve of 6.1.0 and
+  not the one `uv.lock` describes; the file lists the versions it installed. Linux, Python 3.11 to 3.13 and a GPU were not run, and
+  CI installs neither embedding backend. Still open: three competitive-sandbox pin files require a
+  `urllib3` before 2.8.0 (L-107; they build competitor containers, not anything a user installs), and
+  the floor is install metadata, so `pip install -U jcodemunch-mcp` without the extra keeps an older
+  `sentence-transformers` and nothing at the call site checks it (L-108).
+
 ## [1.108.325] - 2026-10-02 - a lookup that found nothing is remembered
 
 ### Fixed
```

**File**: `benchmarks/requirements-rag-bench.txt` (modified, +3/-1)
```diff
@@ -5,5 +5,7 @@ langchain-community>=0.3.0,<0.4
 langchain-huggingface>=0.1.0,<0.2
 langchain-text-splitters>=0.3.0,<0.4
 faiss-cpu>=1.7.0,<2.0
-sentence-transformers>=2.2.0,<4.0
+# >=5.6.0: GHSA-jhr6-gm9c-rqjv. The old pin (<4.0) REQUIRED a release inside the advisory range.
+# The RAG baseline has not been re-run under this pin (LEDGER L-106); re-measure before quoting it.
+sentence-transformers>=5.6.0,<7.0
 tiktoken>=0.5.0,<1.0
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -468,6 +468,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_investigator_entry_point_importer_is_live.py | A name imported only by a root (`main.py`, `package.json`'s `main`, a package `__init__.py`, a test) refutes `export_not_imported` and `no_textual_use`; a really dead importer still satisfies both with its cluster named; an importer `find_dead_code` is unsure of, or cannot answer for, is live. | LEDGER L-94 (2026-10-01): the investigator called an importer dead when nothing imported it, and an entry point has no importer by construction | 1 | LOAD-BEARING | The fix asks `find_dead_code`; the cannot-answer cases patch that function on its own module because the investigator imports it at call time. Five mutants, none survives (an unsure file counted dead, every importer dead, every importer live, an error and a raise read as all dead). The one test-file case passes by its `test_` name; a root-level `tests/` directory is L-101 and is not pinned here. |
 | tests/test_one_test_file_predicate.py | One rule says whether a path is a test file: the cases are pinned in both directions; every name a module binds for the question IS the shared function; a root-level `tests/`, `test/` and `__tests__/` are tests to `find_dead_code`, `get_dead_code_v2`, the deletion investigator and `get_file_risk`; and `check_delete_safe` and `check_edit_safe` give a production `models/pod_spec.py` consumer the verdict they give `models/pod.py`. | LEDGER L-101 (2026-10-01): six predicates, no two agreeing; the dead-code pair needed a slash before `tests/` and reported a root-level test file dead at 1.0. The first draft of the shared rule downgraded a blocked delete for a `*_spec.py` consumer | 1 | LOAD-BEARING | ⚠ The binding check is keyed on the names the copies used; a rule under a new name, or written inline, is seen only through the tools the file runs, and `get_pr_risk_profile`, `find_similar_symbols`, the reuse audit, `get_blast_radius`, `get_untested_symbols`, `find_unused_paths` and `get_parity_map` are not among them. It also pins both preflights' verdicts for the three ambiguous spellings kept (`ab_test.py`, `tests.py`, `ab_tests/`); the edit verdict there is `safe_to_edit` and is a disclosed trade (L-104), so a narrowed rule changes that test on purpose. Mutants: `evidence/red_l101_mutants.txt`. |
 | tests/test_repo_key_lookup_caches_what_it_learned.py | `config._resolve_repo_key` lists the index store once for a miss, for a matched source root and for a repo id; discovery under a root that matches no index does not list per file; a remembered miss does not outlive an index saved here, expires for one saved elsewhere, and a listing that raises is not remembered; a resolved key does not outlive its deleted index; both caches are bounded. | #960 (@ebataeva, 2026-10-02): the negative cache was documented and never written, so each candidate file in a walk cost a listing of every index | 1 | LOAD-BEARING | Counts `IndexStore.list_repos` calls on a real storage dir; the clock is a stub on the module's own `time` name, never the real module (F-40). Mutants: `evidence/red_960_mutants.txt`. |
+| tests/test_semantic_extra_floor.py | Every requirement in `pyproject.toml` (dependencies, extras, dependency groups) that names `sentence-transformers` excludes the releases before 5.6.0, no tracked requirements, constraints or `.pins` file admits one under any spelling of the name, and the lock holds a fixed `sentence-transformers` and `urllib3`. | GHSA-jhr6-gm9c-rqjv (2026-10-02, Dependabot alert 151): a local model directory ran its own code with `trust_remote_code` off, and the extra's floor was `>=2.2.0` | 1 | LOAD-BEARING | Reads `pyproject.toml` and `uv.lock`; the PR gate's audit covers the runtime set only, which contains neither package, so it stayed green with the alerts open (`evidence/dependabot_alerts.txt`). The first version of this file read the extras and the lock only and missed `benchmarks/requirements-rag-bench.txt`, which pinned `<4.0`; the second matched the name by prefix and walked untracked files. It enumerates with `git ls-files` and compares canonical names. The third read only the extras table, compared that name raw, and put a one-separator regex in front of the parse, so `sentence_transformers` in a new extra, any spelling in a dependency group, and `sentence__transformers` in a pin file all passed; every requirement line is parsed now and `requirements/` and `.lock` names are read. The fourth dropped a line `Requirement` rejects, so a VCS link, a wheel URL, an editable or a tab before `--hash` passed, and it followed no `-r`/`-c`; a rejected line that names the package fails the test now and includes are followed. A pin in a file that no pin file includes and `_PIN_FILE` does not name is not seen; an include whose target does not resolve as written (a quoted path, a variable) is skipped; a line that cannot be parsed and does not name the package in its 
```

**File**: `docs/workflows/LEDGER.md` (modified, +3/-0)
```diff
@@ -154,3 +154,6 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-103 | 2026-10-01, L-94 review | When `find_dead_code` caps its confidence (a stale index, a withheld file) or cannot answer, the deletion investigator calls every importer live and grades `export_not_imported` REFUTED with "Imported by name in orphan.py" over a file that is dead. The direction is safe, but REFUTED means established, nothing was, and the evidence carries neither the corpus blockers nor `signal_warning`, so the reader is not told that re-indexing changes the answer; on an index with blockers the dead-cluster path is unreachable. It should grade the unclassifiable case UNESTABLISHED or put the blockers in `detail`. Also: the investigation calls `find_dead_code` twice with identical arguments when both obligations have files (4.4 s a call on this repository's 1281 files, reviewer's measurement); one result per investigation would halve it. | `src/jcodemunch_mcp/investigator/deletion_safety.py` | defect | low | OPEN |
 | L-104 | 2026-10-01, L-101 | `get_repo_health._is_production_path` keeps a filename rule of its own, `_NON_PRODUCTION_FILENAME_RE`, beside the shared test-file rule. It asks a different question (tests, benchmarks, scripts and examples are all non-production) but its test half disagrees with `_test_paths.is_test_file`: it matches `Test.java` under `re.IGNORECASE`, so `src/latest.java` is non-production, and it does not match `a_test.py`, `test_a.py` or `conftest.py` outside a listed directory. Routing its test half through the shared rule moves the published coupling axis, so measure the score on a real repository first. The shared rule's known misses, none recognised by any tool: a JUnit `FooTest.java`, `UserTest.php` or `FooTests.cs` outside a test directory; a bare `test.py` or `test.js`; Go's `testutil/`; RSpec's `spec/spec_helper.rb` and `spec/support/`; `*.cy.ts` and `e2e/`. Its known false positives: `TEST_PLAN.md` and `src/test_driver.c` (the `test_` prefix), `experiments/ab_test.py`, a non-Django `tests.py`, a production `ab_tests/` directory, `config/load_test.yaml`, and any path handed in with an ancestor directory named `test_*`. ⚠ For the three that can hold importing code (`ab_test.py`, `tests.py`, `ab_tests/`), `check_delete_safe` moved from `external_uses_blocking` to `test_coverage_only` and `check_edit_safe` from `signature_impact` to `safe_to_edit` (the head verdicts are pinned in `tests/test_one_test_file_predicate.py`; the base verdicts are the review's measurement); the edit verdict is the one that says safe over a production consumer. Widen or narrow the rule only with both preflights' verdicts measured on both sides. | `src/jcodemunch_mcp/tools/get_repo_health.py` | defect | low | OPEN |
 | L-105 | 2026-10-02, #960 review | `config._resolve_repo_key` compares the identifier raw. Another spelling of an indexed root (a trailing separator, forward slashes on Windows, a different case on Windows) matches neither `_PROJECT_CONFIGS` nor the listing's resolved path, so `config.get(key, repo=<that spelling>)` answers from global where the project's `.jcodemunch.jsonc` sets the key (reviewer's probe: 512000 where the file says 1234, on `origin/main` and on the #960 branch alike). Since #960 the wrong answer is also remembered for the miss TTL. Normalise the identifier once at the top of the resolver; check what `index_folder` and the watcher pass. Also: `SQLiteIndexStore.delete_index` called from the store's own sweep does not reach `forget_repo_resolutions`, so a resolved key can outlive an index removed that way, and so can one removed by another process (benign: no project overlay is found and global answers). Three more from the #960 review, round 2: (a) a source-root PATH hit is not retained when the listing fills the bound and many roots are asked in turn, because the bound is one listing plus one asked-for key (reviewer's measurement on the #960 branch: 250 indexes and 100 distinct root paths list on every one of 500 lookups; up to 17 paths list once each); `main` listed on every path lookup, so it is not a regression, and the fix is to key the listing by resolved path as well and size the bound for three keys an index; (b) `IndexStore.delete_index` forgets before it unlinks a legacy `.json` index, so a lookup between the two can remember an index that is about to go; move the call to the end; (c) nothing tests that an overtaken listing writes no HIT, and `updates.pop(repo, None)` and the `_REPO_MISS_CACHE.pop` on a hit are lines no test needs. | `src/jcodemunch_mcp/config.py` | defect | low | OPEN |
+| L-106 | 2026-10-02, GHSA-jhr6-gm9c-rqjv review | `benchmarks/requirements-rag-bench.txt` moved `sentence-transformers` from `>=2.2.0,<4.0` to `>=5.6.0,<7.0` because the old pin required a release inside the advisory range. The RAG baseline (`benchmarks/run_rag_baseline.py`) was NOT re-run under the new pin: `langchain-huggingface` 0.1.0 and 0.1.2 declare `sen
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -83,7 +83,7 @@ zhipu = ["openai>=1.0.0"]
 dbt = ["pyyaml>=6.0"]
 http = ["uvicorn>=0.20.0", "starlette>=1.3.1", "anyio>=4.14.2"]
 watch = ["watchfiles>=1.0.0"]
-semantic = ["sentence-transformers>=2.2.0"]
+semantic = ["sentence-transformers>=5.6.0"]
 local-embed = ["onnxruntime>=1.16.0"]
 groq = ["openai>=1.0.0"]
 groq-voice = ["openai>=1.0.0", "sounddevice>=0.4.6", "numpy>=1.24.0"]
@@ -92,7 +92,7 @@ keyring = ["keyring>=24.0"]
 bench = ["openai>=1.0.0", "anthropic>=0.40.0", "pyyaml>=6.0", "rich>=13.0", "jinja2>=3.1"]
 # `all` is a hand-maintained union of every extra above. When you add a new
 # extra or a new dependency to one, mirror it here (there is no auto-union).
-all = ["anthropic>=0.40.0", "google-generativeai>=0.8.0", "openai>=1.0.0", "pyyaml>=6.0", "uvicorn>=0.20.0", "starlette>=1.3.1", "anyio>=4.14.2", "watchfiles>=1.0.0", "sentence-transformers>=2.2.0", "onnxruntime>=1.16.0", "sounddevice>=0.4.6", "numpy>=1.24.0", "Pillow>=10.0.0", "rich>=13.0", "jinja2>=3.1", "keyring>=24.0"]
+all = ["anthropic>=0.40.0", "google-generativeai>=0.8.0", "openai>=1.0.0", "pyyaml>=6.0", "uvicorn>=0.20.0", "starlette>=1.3.1", "anyio>=4.14.2", "watchfiles>=1.0.0", "sentence-transformers>=5.6.0", "onnxruntime>=1.16.0", "sounddevice>=0.4.6", "numpy>=1.24.0", "Pillow>=10.0.0", "rich>=13.0", "jinja2>=3.1", "keyring>=24.0"]
 
 
 [project.scripts]
```

**File**: `tests/test_semantic_extra_floor.py` (added, +253/-0)
```diff
@@ -0,0 +1,253 @@
+"""The `semantic` extra cannot resolve to a sentence-transformers that runs a local model's code unasked.
+
+GHSA-jhr6-gm9c-rqjv (critical): before 5.6.0, loading a LOCAL model directory
+bypassed `trust_remote_code` and executed the custom Python inside it.
+`embed_repo` passes the `embed_model` config key, or `JCODEMUNCH_EMBED_MODEL`,
+straight to `SentenceTransformer`, and that value may be a path. The extra declared `>=2.2.0`, so a fresh
+`pip install "jcodemunch-mcp[semantic]"` took the latest release and was fine,
+while an environment that already held an older one satisfied the requirement
+and stayed exposed. The floor is the fixed release.
+
+Three tables of `pyproject.toml` are read, by canonical name: `project.dependencies`, the
+extras and the dependency groups. `build-system.requires` and a `[tool.*]` table are not; a
+`tool.uv` constraint reaches the lock, which is checked below. Every tracked requirements,
+constraints and `.pins` file is read too, with what it includes; a line there that names the
+package and cannot be parsed fails the test: `benchmarks/requirements-rag-bench.txt`
+pinned `<4.0`, which REQUIRED a vulnerable release, and a check of the
+extras alone could not see it.
+
+The lock is checked as well: the repository's own environments are built from
+it, and it held 5.3.0 and a urllib3 with three open advisories
+(GHSA-8988-9cw3-xx77, GHSA-vxq7-64xx-v4gw, GHSA-gh4c-6fx4-qh6g).
+"""
+
+from __future__ import annotations
+
+import re
+import subprocess
+import sys
+from pathlib import Path
+
+if sys.version_info >= (3, 11):
+    import tomllib
+else:  # 3.10: pytest depends on tomli there
+    import tomli as tomllib
+
+import pytest
+from packaging.requirements import InvalidRequirement, Requirement
+from packaging.utils import canonicalize_name
+from packaging.version import Version
+
+ROOT = Path(__file__).resolve().parent.parent
+FIXED = {"sentence-transformers": Version("5.6.0"), "urllib3": Version("2.8.0")}
+
+
+_NAME = "sentence-transformers"
+# Releases before the fix, the 5.x line in full, and a version just under the floor.
+_VULNERABLE_SAMPLES = (
+    "2.2.0", "2.7.0", "3.0.0", "3.4.1", "4.0.0", "4.1.0", "5.0.0", "5.1.0", "5.1.1", "5.1.2", "5.2.0",
+    "5.2.1", "5.2.2", "5.2.3", "5.3.0", "5.4.0", "5.4.1", "5.5.0", "5.5.1", "5.5.999",
+)
+_FIXED_SAMPLES = ("5.6.0", "6.0.1", "6.1.0")
+
+
+def _admitted(req: Requirement) -> list[str]:
+    return [v for v in _VULNERABLE_SAMPLES if req.specifier.contains(v)]
+
+
+def _pyproject_requirements(data: dict):
+    """(table, key, Requirement) for every requirement string in the project's metadata."""
+    project = data.get("project", {})
+    tables = {
+        "dependencies": {"": project.get("dependencies", [])},
+        "optional-dependencies": project.get("optional-dependencies", {}),
+        "dependency-groups": data.get("dependency-groups", {}),
+    }
+    for table, groups in tables.items():
+        for key, entries in groups.items():
+            for entry in entries:
+                if isinstance(entry, str):  # a dependency group may hold {include-group = ...}
+                    yield table, key, Requirement(entry)
+
+
+def _named(data: dict):
+    return [(t, k, r) for t, k, r in _pyproject_requirements(data) if canonicalize_name(r.name) == _NAME]
+
+
+def test_every_extra_that_names_sentence_transformers_excludes_the_vulnerable_releases():
+    data = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
+    found = _named(data)
+    assert sorted((t, k) for t, k, _ in found) == [
+        ("optional-dependencies", "all"),
+        ("optional-dependencies", "semantic"),
+    ], found
+    for table, key, req in found:
+        assert _admitted(req) == [], (table, key, str(req))
+        assert req.specifier.contains(str(FIXED[_NAME])), (table, key, str(req))
+
+
+@pytest.mark.parametrize(
+    "toml,where",
+    [
+        ('[project.optional-dependencies]\nembed2 = ["sentence_transformers>=2.2.0"]\n', "optional-dependencies"),
+        ('[dependency-groups]\nst = ["Sentence.Transformers>=2.2.0,<4.0", {include-group = "x"}]\nx = []\n', "dependency-groups"),
+        ('[project]\ndependencies = ["sentence--transformers>=5.4.0,!=5.5.1"]\n', "dependencies"),
+    ],
+)
+def test_the_pyproject_scan_reads_every_table_and_spelling(toml, where):
+    found = _named(tomllib.loads(toml))
+    assert [t for t, _, _ in found] == [where], found
+    assert _admitted(found[0][2]) != []
+
+
+_PIN_FILE = re.compile(
+    r"(^|/)(requirements|constraints)/.+\.(txt|in|lock)$|(requirements|constraints)[^/]*\.(txt|in|lock)$|\.pins$",
+    re.IGNORECASE,
+)
+_INCLUDE = re.compile(r"(?:-r|-c|--requirement|--constraint)[\s=]*(\S+)")
+
+
+@pytest.mark.parametrize(
+    "rel,is_pin_file",
+    [
+        ("requirements.txt", True),
+        ("benchmarks/requirements-rag-bench.txt", True),
+        ("requirements/bench.txt", True),
+        ("requirements/x.lock", True),
+        ("requirements/
```

**File**: `uv.lock` (modified, +9/-8)
```diff
@@ -1149,8 +1149,8 @@ requires-dist = [
     { name = "pyyaml", marker = "extra == 'dbt'", specifier = ">=6.0" },
     { name = "rich", marker = "extra == 'all'", specifier = ">=13.0" },
     { name = "rich", marker = "extra == 'bench'", specifier = ">=13.0" },
-    { name = "sentence-transformers", marker = "extra == 'all'", specifier = ">=2.2.0" },
-    { name = "sentence-transformers", marker = "extra == 'semantic'", specifier = ">=2.2.0" },
+    { name = "sentence-transformers", marker = "extra == 'all'", specifier = ">=5.6.0" },
+    { name = "sentence-transformers", marker = "extra == 'semantic'", specifier = ">=5.6.0" },
     { name = "sounddevice", marker = "extra == 'all'", specifier = ">=0.4.6" },
     { name = "sounddevice", marker = "extra == 'groq-voice'", specifier = ">=0.4.6" },
     { name = "starlette", marker = "extra == 'all'", specifier = ">=1.3.1" },
@@ -3057,7 +3057,7 @@ wheels = [
 
 [[package]]
 name = "sentence-transformers"
-version = "5.3.0"
+version = "6.1.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "huggingface-hub" },
@@ -3067,14 +3067,15 @@ dependencies = [
     { name = "scikit-learn", version = "1.8.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.11'" },
     { name = "scipy", version = "1.15.3", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
     { name = "scipy", version = "1.17.1", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.11'" },
+    { name = "tokenizers" },
     { name = "torch" },
     { name = "tqdm" },
     { name = "transformers" },
     { name = "typing-extensions" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/fe/26/448453925b6ce0c29d8b54327caa71ee4835511aef02070467402273079c/sentence_transformers-5.3.0.tar.gz", hash = "sha256:414a0a881f53a4df0e6cbace75f823bfcb6b94d674c42a384b498959b7c065e2", size = 403330, upload-time = "2026-03-12T14:53:40.778Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/c4/a1/53ae87971817e2d8370f8e79b843a881be33ab339502d71c5f82ac31f7af/sentence_transformers-6.1.0.tar.gz", hash = "sha256:299025df51550dc1a38f05be27a9b0bf881c4e5e70542b3b7757d05e00aa3868", size = 576566, upload-time = "2026-09-18T10:44:24.279Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/e2/9c/2fa7224058cad8df68d84bafee21716f30892cecc7ad1ad73bde61d23754/sentence_transformers-5.3.0-py3-none-any.whl", hash = "sha256:dca6b98db790274a68185d27a65801b58b4caf653a4e556b5f62827509347c7d", size = 512390, upload-time = "2026-03-12T14:53:39.035Z" },
+    { url = "https://files.pythonhosted.org/packages/b5/6e/9115e19589c83172bd37ec793cfef7f7c719464053fa6a8882700c1f4488/sentence_transformers-6.1.0-py3-none-any.whl", hash = "sha256:eb8122f4d180f552eda26dc3d77e84e8c11dc2b1d456a406b9f24abb70ceeadd", size = 740560, upload-time = "2026-09-18T10:44:22.841Z" },
 ]
 
 [[package]]
@@ -3601,11 +3602,11 @@ wheels = [
 
 [[package]]
 name = "urllib3"
-version = "2.7.0"
+version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c", size = 433602, upload-time = "2026-05-07T16:13:18.596Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63", size = 458972, upload-time = "2026-09-15T19:29:36.253Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897", size = 131087, upload-time = "2026-05-07T16:13:17.151Z" },
+    { url = "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3", size = 135717, upload-time = "2026-09-15T19:29:34.577Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 10: `1157da2f` (2026-10-02)
**Commit Message**: fix: a repo-key lookup that found nothing is remembered (#960) (#963)

* fix: a repo-key lookup that found nothing is remembered (#960)

config._resolve_repo_key documented a negative cache and never wrote one, so a
repo= value that matched no index listed every index on every call; discovery
asks once per candidate file. A matched source root was not written back
either. Both answers are remembered; a miss is forgotten when this process
saves or deletes an index and expires for a save made elsewhere.

Reported by @ebataeva.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: a listing overtaken by a save is not remembered, and the hit cache holds a whole listing (#960, review round 1)

A lookup that listed the store before a concurrent save wrote its miss after
the save's forget. A generation counter is compared before anything is
written. Only the identifier asked for is added beside the two keys per
index, and the bound is never smaller than one listing, so a store past 256
indexes no longer evicts the key it just resolved.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs: what the repo-key cache still does not hold (LEDGER L-105; #960 review round 2 notes)

C

**File**: `CHANGELOG.md` (modified, +20/-0)
```diff
@@ -2,6 +2,26 @@
 
 ## [Unreleased]
 
+### Fixed
+
+- **A repo-key lookup that found nothing was never remembered (#960, reported by @ebataeva).**
+  `config._resolve_repo_key` documented a negative cache and wrote none: a `repo=` value that matched
+  no index listed every index in storage on every call, and the listing opens every `.db`. Discovery
+  asks once per candidate file (`is_secret_file(rel_path, repo=str(root))`), so indexing a
+  subdirectory of a git root paid one full listing per file, and the bill grew with the number of
+  indexes the user has. A source root that DID match was not written back either, which is the
+  second, smaller cost in the report. Both answers are remembered now. A remembered miss is dropped
+  when this process saves or deletes an index through `IndexStore`, and expires after
+  `_REPO_MISS_TTL_SECONDS` (5 s) for a save made by another process, which nothing here is told
+  about; so a walk longer than that lists once per window, not once per file. A listing that raises
+  is not a miss and is not remembered, and neither is one that a save overtook while it was in
+  flight. `IndexStore.delete_index` also drops the keys resolved for the index, which used to
+  outlive it. The hit cache holds at least one whole listing, so a store past 256 indexes no longer
+  evicts the key it just resolved. One shape is still not held: past roughly 256 indexes, many
+  different source-root PATHS asked in turn push each other out (LEDGER L-105). Measured with 17 indexes in storage and 1,000 candidate files under a root that
+  matches none (the run is in the PR body): 1,005 listings and 40.98 s before, 1
+  listing and 4.05 s after.
+
 ## [1.108.324] - 2026-10-02 - one rule says whether a path is a test file
 
 ### Fixed
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -467,6 +467,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_investigator_trusts_the_folded_import_match.py | The deletion investigator refutes `export_not_imported` for an import in another Unicode form or written with an escape, and still does not count a specifier-stem match as an import of the name. | LEDGER L-90 (2026-10-01): a raw `target_name in names` re-filtered the rows `check_references` had matched through `_fold` | 1 | LOAD-BEARING | Escapes are built from `chr(92)`; each importer has its own importer because of L-94. Mutants (review, 2026-10-01): the raw comparison restored fails the two refuting tests; the filter replaced by `if r.get("matches")` fails the stem test, which passed against it until `src/app.js` gave `main.js` an importer. |
 | tests/test_investigator_entry_point_importer_is_live.py | A name imported only by a root (`main.py`, `package.json`'s `main`, a package `__init__.py`, a test) refutes `export_not_imported` and `no_textual_use`; a really dead importer still satisfies both with its cluster named; an importer `find_dead_code` is unsure of, or cannot answer for, is live. | LEDGER L-94 (2026-10-01): the investigator called an importer dead when nothing imported it, and an entry point has no importer by construction | 1 | LOAD-BEARING | The fix asks `find_dead_code`; the cannot-answer cases patch that function on its own module because the investigator imports it at call time. Five mutants, none survives (an unsure file counted dead, every importer dead, every importer live, an error and a raise read as all dead). The one test-file case passes by its `test_` name; a root-level `tests/` directory is L-101 and is not pinned here. |
 | tests/test_one_test_file_predicate.py | One rule says whether a path is a test file: the cases are pinned in both directions; every name a module binds for the question IS the shared function; a root-level `tests/`, `test/` and `__tests__/` are tests to `find_dead_code`, `get_dead_code_v2`, the deletion investigator and `get_file_risk`; and `check_delete_safe` and `check_edit_safe` give a production `models/pod_spec.py` consumer the verdict they give `models/pod.py`. | LEDGER L-101 (2026-10-01): six predicates, no two agreeing; the dead-code pair needed a slash before `tests/` and reported a root-level test file dead at 1.0. The first draft of the shared rule downgraded a blocked delete for a `*_spec.py` consumer | 1 | LOAD-BEARING | ⚠ The binding check is keyed on the names the copies used; a rule under a new name, or written inline, is seen only through the tools the file runs, and `get_pr_risk_profile`, `find_similar_symbols`, the reuse audit, `get_blast_radius`, `get_untested_symbols`, `find_unused_paths` and `get_parity_map` are not among them. It also pins both preflights' verdicts for the three ambiguous spellings kept (`ab_test.py`, `tests.py`, `ab_tests/`); the edit verdict there is `safe_to_edit` and is a disclosed trade (L-104), so a narrowed rule changes that test on purpose. Mutants: `evidence/red_l101_mutants.txt`. |
+| tests/test_repo_key_lookup_caches_what_it_learned.py | `config._resolve_repo_key` lists the index store once for a miss, for a matched source root and for a repo id; discovery under a root that matches no index does not list per file; a remembered miss does not outlive an index saved here, expires for one saved elsewhere, and a listing that raises is not remembered; a resolved key does not outlive its deleted index; both caches are bounded. | #960 (@ebataeva, 2026-10-02): the negative cache was documented and never written, so each candidate file in a walk cost a listing of every index | 1 | LOAD-BEARING | Counts `IndexStore.list_repos` calls on a real storage dir; the clock is a stub on the module's own `time` name, never the real module (F-40). Mutants: `evidence/red_960_mutants.txt`. |
 | tests/test_references_compare_normalised_spellings.py | `check_references` finds a call or an import written in another Unicode spelling of the identifier (ligature, math-bold, fullwidth, composed vs decomposed, either side), each pair run under Python to prove it names one function, and never reports the definition's own line; `check_delete_safe` no longer certifies the live `def file()` / `ﬁle()` case; a Java sibling `ﬁle()` whose name folds to the target keeps the call to `file()` inside its body; twenty test files mentioning the name do not push the one real caller off `check_delete_safe`'s page (L-89); `fire` still does not match `file` (control). | LEDGER L-84 and L-89 (2026-09-30), found in the L-83 reviews | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for a used function. The sibling case is review round 1's: a FOLDED definition-span exclusion removed that call and certified the used method at 1.0. 5 of 5 mutants killed (content, import names, the folded exclusion, identifier left unfolded, NFC instead of NFKC) plus L-89's (the page capped at 20 again), 6 
```

**File**: `docs/workflows/LEDGER.md` (modified, +1/-0)
```diff
@@ -153,3 +153,4 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-102 | 2026-10-01, L-94 review | `find_dead_code` knows no undeclared non-Python entry point: `_ENTRY_POINT_FILENAMES` is Python and nothing else, and `_package_json_entries` reads `main`/`module`/`browser`/`exports`/`bin`, not `scripts`. `index.js` with no `package.json`, `server.js` named only by `scripts.start`, `src/index.ts` with no `package.json`, and a Python script with no main guard are each reported dead, and the deletion investigator then reads a name they import as "Imported only by X, which is itself unreachable" (reviewer's measurement, unchanged from before L-94). Measure what a wider root list does to the false-negative side before widening it (#569's lesson). | `src/jcodemunch_mcp/tools/find_dead_code.py` | defect | medium | OPEN |
 | L-103 | 2026-10-01, L-94 review | When `find_dead_code` caps its confidence (a stale index, a withheld file) or cannot answer, the deletion investigator calls every importer live and grades `export_not_imported` REFUTED with "Imported by name in orphan.py" over a file that is dead. The direction is safe, but REFUTED means established, nothing was, and the evidence carries neither the corpus blockers nor `signal_warning`, so the reader is not told that re-indexing changes the answer; on an index with blockers the dead-cluster path is unreachable. It should grade the unclassifiable case UNESTABLISHED or put the blockers in `detail`. Also: the investigation calls `find_dead_code` twice with identical arguments when both obligations have files (4.4 s a call on this repository's 1281 files, reviewer's measurement); one result per investigation would halve it. | `src/jcodemunch_mcp/investigator/deletion_safety.py` | defect | low | OPEN |
 | L-104 | 2026-10-01, L-101 | `get_repo_health._is_production_path` keeps a filename rule of its own, `_NON_PRODUCTION_FILENAME_RE`, beside the shared test-file rule. It asks a different question (tests, benchmarks, scripts and examples are all non-production) but its test half disagrees with `_test_paths.is_test_file`: it matches `Test.java` under `re.IGNORECASE`, so `src/latest.java` is non-production, and it does not match `a_test.py`, `test_a.py` or `conftest.py` outside a listed directory. Routing its test half through the shared rule moves the published coupling axis, so measure the score on a real repository first. The shared rule's known misses, none recognised by any tool: a JUnit `FooTest.java`, `UserTest.php` or `FooTests.cs` outside a test directory; a bare `test.py` or `test.js`; Go's `testutil/`; RSpec's `spec/spec_helper.rb` and `spec/support/`; `*.cy.ts` and `e2e/`. Its known false positives: `TEST_PLAN.md` and `src/test_driver.c` (the `test_` prefix), `experiments/ab_test.py`, a non-Django `tests.py`, a production `ab_tests/` directory, `config/load_test.yaml`, and any path handed in with an ancestor directory named `test_*`. ⚠ For the three that can hold importing code (`ab_test.py`, `tests.py`, `ab_tests/`), `check_delete_safe` moved from `external_uses_blocking` to `test_coverage_only` and `check_edit_safe` from `signature_impact` to `safe_to_edit` (the head verdicts are pinned in `tests/test_one_test_file_predicate.py`; the base verdicts are the review's measurement); the edit verdict is the one that says safe over a production consumer. Widen or narrow the rule only with both preflights' verdicts measured on both sides. | `src/jcodemunch_mcp/tools/get_repo_health.py` | defect | low | OPEN |
+| L-105 | 2026-10-02, #960 review | `config._resolve_repo_key` compares the identifier raw. Another spelling of an indexed root (a trailing separator, forward slashes on Windows, a different case on Windows) matches neither `_PROJECT_CONFIGS` nor the listing's resolved path, so `config.get(key, repo=<that spelling>)` answers from global where the project's `.jcodemunch.jsonc` sets the key (reviewer's probe: 512000 where the file says 1234, on `origin/main` and on the #960 branch alike). Since #960 the wrong answer is also remembered for the miss TTL. Normalise the identifier once at the top of the resolver; check what `index_folder` and the watcher pass. Also: `SQLiteIndexStore.delete_index` called from the store's own sweep does not reach `forget_repo_resolutions`, so a resolved key can outlive an index removed that way, and so can one removed by another process (benign: no project overlay is found and global answers). Three more from the #960 review, round 2: (a) a source-root PATH hit is not retained when the listing fills the bound and many roots are asked in turn, because the bound is one listing plus one asked-for key (reviewer's measurement on the #960 branch: 250 indexes and 100 distinct root paths list on every one of 500 lookups; up to 17 paths list once each); `main` listed on every path lookup, so it is not a regression, and the fix is to key the listing by resolved path as well and size the bound for three keys
```

**File**: `src/jcodemunch_mcp/config.py` (modified, +69/-8)
```diff
@@ -6,6 +6,7 @@
 import os
 import re
 import threading
+import time
 from copy import deepcopy
 from pathlib import Path
 from typing import Any
@@ -29,6 +30,17 @@
 _DEPRECATED_ENV_VARS_LOGGED: set[str] = set()
 _CONFIG_LOCK = threading.Lock()
 _REPO_PATH_CACHE: dict[str, str] = {}
+# Identifiers `_resolve_repo_key` looked up and did not find, with the
+# monotonic time each stops being believed (#960). Misses are forgotten when
+# this process saves or deletes an index; the TTL is for a save made by
+# ANOTHER process, which nothing here hears about. A loaded project config
+# needs no forgetting: its key is answered from `_PROJECT_CONFIGS` first.
+_REPO_MISS_CACHE: dict[str, float] = {}
+_REPO_MISS_TTL_SECONDS = 5.0
+_REPO_CACHE_MAX = 512
+# Bumped by `forget_repo_resolutions`. A lookup that listed the store BEFORE a
+# forget must not write what it learned AFTER it: the listing predates the save.
+_REPO_CACHE_GENERATION = 0
 
 ENV_VAR_MAPPING = {
     "JCODEMUNCH_USE_AI_SUMMARIES": "use_ai_summaries",
@@ -940,6 +952,32 @@ def _apply_env_var_fallback(explicit_keys: set[str] | None = None) -> None:
                 _GLOBAL_CONFIG[config_key] = parsed
 
 
+def forget_repo_resolutions() -> None:
+    """Drop everything `_resolve_repo_key` has learned, hits and misses.
+
+    Called when the set of indexes changes in this process (an index saved or
+    deleted) and by `invalidate_cache`. The next lookup lists the store once.
+    """
+    global _REPO_CACHE_GENERATION
+    with _CONFIG_LOCK:
+        _REPO_PATH_CACHE.clear()
+        _REPO_MISS_CACHE.clear()
+        _REPO_CACHE_GENERATION += 1
+
+
+def _trim_oldest(cache: dict, keep: int = 0) -> None:
+    """Hold a lookup cache to its bound, oldest first. Caller holds the lock.
+
+    The bound is `_REPO_CACHE_MAX` or `keep`, whichever is larger. `keep` is the
+    size of one listing: a cache smaller than the listing that fills it evicts
+    the key just resolved, and every lookup lists again.
+    """
+    excess = len(cache) - max(_REPO_CACHE_MAX, keep)
+    if excess > 0:
+        for k in list(cache)[:excess]:
+            del cache[k]
+
+
 def _resolve_repo_key(repo: str) -> str | None:
     """Resolve a repo identifier to the absolute path key used in _PROJECT_CONFIGS.
 
@@ -949,14 +987,25 @@ def _resolve_repo_key(repo: str) -> str | None:
     - A repo identifier like "jcodemunch-mcp" or "local/jcodemunch-mcp-384d867b"
 
     Returns the resolved key if found, None otherwise.
+
+    ⚠⚠ Both answers are remembered (#960, @ebataeva). A lookup that reaches the
+    store lists every index, and `list_repos` opens every `.db`. Discovery asks
+    once per FILE, so a miss that was not written back cost one full listing
+    per candidate file, scaling with how many indexes the user has. A source
+    root that matched was not written back either. A listing that RAISES is
+    not a miss and is not remembered, and neither is one that an index save or
+    delete overtook. A miss is believed for `_REPO_MISS_TTL_SECONDS`, so a
+    long walk lists once per window, not once per file.
     """
     with _CONFIG_LOCK:
         if repo in _PROJECT_CONFIGS:
             return repo
         if repo in _REPO_PATH_CACHE:
-            cached = _REPO_PATH_CACHE[repo]
-            # None = negative cache (unknown repo), str = resolved path
-            return cached
+            return _REPO_PATH_CACHE[repo]
+        expires = _REPO_MISS_CACHE.get(repo)
+        if expires is not None and time.monotonic() < expires:
+            return None
+        generation = _REPO_CACHE_GENERATION
 
     # Miss: query store without holding the lock (I/O)
     try:
@@ -978,16 +1027,28 @@ def _resolve_repo_key(repo: str) -> str | None:
                 updates[repo_name] = resolved
             if repo == display_name or repo == repo_name or repo == resolved:
                 result = resolved
+        if result is not None:
+            # The identifier asked for, written last so it is the newest entry.
+            # This is what remembers a source-root path, which is neither a
+            # display name nor a repo id.
+            updates.pop(repo, None)
+            updates[repo] = result
         with _CONFIG_LOCK:
+            if generation != _REPO_CACHE_GENERATION:
+                # An index was saved or deleted while this listing was in
+                # flight. The answer is returned and nothing is remembered.
+                return result
             _REPO_PATH_CACHE.update(updates)
+            if result is None:
+                _REPO_MISS_CACHE[repo] = time.monotonic() + _REPO_MISS_TTL_SECONDS
+            else:
+                _REPO_MISS_CACHE.pop(repo, None)
             # Prevent unbounded growth (evict oldest entries first)
-            if len(_REPO_PATH_CACHE) > 512:
-                excess = len(_REPO_PATH_CACHE) - 512
-                for k in list(_REPO_PATH_CACHE)[:excess]:
-                    del _REPO_PATH_CACHE[k]
+            _trim_oldest(_REPO_P
```

**File**: `src/jcodemunch_mcp/storage/index_store.py` (modified, +4/-0)
```diff
@@ -1190,6 +1190,8 @@ def save_index(
         self._lock_path(owner, name).unlink(missing_ok=True)
         self._checksum_path(index_path).unlink(missing_ok=True)
 
+        # The set of indexes changed: a remembered repo-key miss may now be wrong (#960).
+        _config.forget_repo_resolutions()
         return result
 
     def has_index(self, owner: str, name: str) -> bool:
@@ -1593,6 +1595,8 @@ def delete_index(self, owner: str, name: str, force: bool = False) -> bool:
         """
         db_existed = self._sqlite.has_index(owner, name)
         deleted = self._sqlite.delete_index(owner, name)
+        # A resolved repo key must not outlive its index (#960).
+        _config.forget_repo_resolutions()
 
         index_path = self._index_path(owner, name)
         meta_path = self._meta_path(owner, name)
```

**File**: `src/jcodemunch_mcp/tools/invalidate_cache.py` (modified, +1/-1)
```diff
@@ -53,8 +53,8 @@ def invalidate_cache(
     _force_full_reindex.add(f"{owner}/{name}")
 
     # Clear all in-process caches (X1 / C4-B / T4.5)
+    _cfg.forget_repo_resolutions()
     with _cfg._CONFIG_LOCK:
-        _cfg._REPO_PATH_CACHE.clear()
         if source_root:
             _cfg._PROJECT_CONFIGS.pop(source_root, None)
             _cfg._PROJECT_CONFIG_HASHES.pop(source_root, None)
```

**File**: `tests/conftest.py` (modified, +1/-0)
```diff
@@ -191,6 +191,7 @@ def _reset_config_state():
         cfg._PROJECT_CONFIGS.clear()
         cfg._PROJECT_CONFIG_HASHES.clear()
         cfg._REPO_PATH_CACHE.clear()
+        cfg._REPO_MISS_CACHE.clear()
     except ImportError:
         pass
 
```

**File**: `tests/test_repo_key_lookup_caches_what_it_learned.py` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+"""A repo-key lookup that found nothing is remembered (#960, @ebataeva).
+
+`config._resolve_repo_key` documented a negative cache and never wrote one: a
+`repo=` value that matched no index listed every index in storage on EVERY
+call, and `list_repos` opens every `.db`. Discovery asks once per file
+(`is_secret_file(rel_path, repo=str(root))`), so indexing a subdirectory of a
+git root cost one full listing per candidate file, scaling with how many
+indexes the user has. A source root that DID match was not cached either,
+because only the display name and the repo id were written back.
+
+What is checked: the number of listings, at the resolver and at the entry
+point the reporter used (`discover_local_files`); and that a remembered miss
+cannot outlive the thing that makes it wrong (an index saved or deleted in
+this process, or a few seconds for a save made by another process), and that
+a project config loaded afterwards is answered ahead of it.
+"""
+
+from __future__ import annotations
+
+import types
+from pathlib import Path
+
+import pytest
+
+from jcodemunch_mcp import config as cfg
+from jcodemunch_mcp.storage.index_store import IndexStore
+from jcodemunch_mcp.tools.index_folder import discover_local_files, index_folder
+
+
+@pytest.fixture
+def storage(tmp_path, monkeypatch):
+    """A storage dir the resolver reads, holding one index, with listings counted."""
+    store_dir = tmp_path / "store"
+    store_dir.mkdir()
+    monkeypatch.setenv("CODE_INDEX_PATH", str(store_dir))
+    indexed = tmp_path / "indexed"
+    (indexed / "pkg").mkdir(parents=True)
+    (indexed / "pkg" / "a.py").write_text("def a():\n    return 1\n", encoding="utf-8")
+    res = index_folder(str(indexed), use_ai_summaries=False, storage_path=str(store_dir))
+    assert "error" not in res, res
+
+    calls = {"n": 0}
+    real = IndexStore.list_repos
+
+    def counted(self):
+        calls["n"] += 1
+        return real(self)
+
+    monkeypatch.setattr(IndexStore, "list_repos", counted)
+    cfg._PROJECT_CONFIGS.clear()
+    # Resolved by name so the file reproduces the defect on a tree that predates the function.
+    getattr(cfg, "forget_repo_resolutions", cfg._REPO_PATH_CACHE.clear)()
+    return types.SimpleNamespace(dir=store_dir, indexed=indexed, repo=res["repo"], calls=calls, tmp=tmp_path)
+
+
+def test_a_miss_is_listed_once(storage):
+    unknown = str(storage.tmp / "nowhere")
+    for _ in range(50):
+        assert cfg._resolve_repo_key(unknown) is None
+    assert storage.calls["n"] == 1
+
+
+def test_a_source_root_that_resolves_is_listed_once(storage):
+    root = str(storage.indexed.resolve())
+    for _ in range(50):
+        assert cfg._resolve_repo_key(root) == root
+    assert storage.calls["n"] == 1
+
+
+def test_a_repo_id_that_resolves_is_listed_once(storage):
+    root = str(storage.indexed.resolve())
+    for _ in range(50):
+        assert cfg._resolve_repo_key(storage.repo) == root
+    assert storage.calls["n"] == 1
+
+
+def test_config_get_for_an_unindexed_root_lists_once(storage):
+    unknown = str(storage.tmp / "nowhere")
+    for _ in range(50):
+        cfg.get("exclude_secret_patterns", [], repo=unknown)
+    assert storage.calls["n"] == 1
+
+
+def test_discovery_under_an_unindexed_root_does_not_list_per_file(storage):
+    """The reported shape: a walk whose root matches no index."""
+    sub = storage.tmp / "notes" / "Projects"
+    sub.mkdir(parents=True)
+    for i in range(40):
+        (sub / f"m{i}.py").write_text(f"def f{i}():\n    return {i}\n", encoding="utf-8")
+    files, _warnings, _skips = discover_local_files(sub.resolve())
+    assert len(files) == 40
+    assert storage.calls["n"] <= 2, storage.calls["n"]
+
+
+def test_a_remembered_miss_does_not_outlive_an_index_saved_here(storage, monkeypatch):
+    # A frozen clock: the miss cannot end on its own while the index is built.
+    monkeypatch.setattr(cfg, "time", types.SimpleNamespace(monotonic=lambda: 1000.0))
+    later = storage.tmp / "later"
+    later.mkdir()
+    (later / "b.py").write_text("def b():\n    return 2\n", encoding="utf-8")
+    root = str(later.resolve())
+    assert cfg._resolve_repo_key(root) is None
+    res = index_folder(root, use_ai_summaries=False, storage_path=str(storage.dir))
+    assert "error" not in res, res
+    cfg._PROJECT_CONFIGS.clear()  # the lookup must come from the store, not the loaded config
+    assert cfg._resolve_repo_key(root) == root
+    assert cfg._resolve_repo_key(res["repo"]) == root
+
+
+def test_a_resolved_key_does_not_outlive_its_index(storage):
+    root = str(storage.indexed.resolve())
+    assert cfg._resolve_repo_key(storage.repo) == root
+    owner, name = storage.repo.split("/", 1)
+    assert IndexStore(base_path=str(storage.dir)).delete_index(owner, name) is True
+    assert cfg._resolve_repo_key(storage.repo) is None
+
+
+def test_a_remembered_miss_expires(storage, monkeypatch):
+    """A save made by another process is not announced here; the
```

---

### Incident Patch 11: `c097c6e4` (2026-10-02)
**Commit Message**: fix: one rule says whether a path is a test file, and a root-level tests/ is one (LEDGER L-101) (#959)

* fix: one rule says whether a path is a test file, and a root-level tests/ is one (LEDGER L-101)

find_dead_code and get_dead_code_v2 tested '/tests/' in the path, which needs a
slash before the directory, so a test file under a root-level tests/, test/ or
__tests__/ was reported dead at 1.0 and the deletion investigator called a name
it imports imported by nothing live. Six predicates under src/ answered the
question and no two agreed. tools/_test_paths.is_test_file is the one rule and
every tool imports it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: a production file named like a spec is not a test (L-101, review round 1)

The shared rule matched *_spec.* and *.spec.* in any language, so the delete
and edit preflights counted a use in models/pod_spec.py as a test use and
downgraded a blocking verdict. Each suffix is tied to the extensions that carry
its convention. Tests run check_delete_safe, check_edit_safe and
get_dead_code_v2; the claims in the CHANGELOG, the ledger and the archaeology
row are narrowed to what the checks see.

Co-Authored-By: Claude Opus 5

**File**: `CHANGELOG.md` (modified, +53/-0)
```diff
@@ -2,6 +2,59 @@
 
 ## [Unreleased]
 
+### Fixed
+
+- **A test directory at the repository root was not a test directory (LEDGER L-101).**
+  `find_dead_code` and `get_dead_code_v2` asked whether `"/tests/"` appears in a path, which needs a
+  slash BEFORE the directory, so `tests/helpers.py`, `test/helpers.py` and `__tests__/shapes.js` at
+  the root were reported dead at confidence 1.0 while `pkg/tests/helpers.py` was skipped. The deletion
+  investigator asks `find_dead_code` whether an importer is dead (L-94), so it called a name such a
+  file imports "imported by nothing live". Six rules answered the question under `src/` and no two
+  agreed: `check_delete_safe` and `find_similar_symbols` saw the root directory and missed `a_test.py`,
+  `a.spec.ts` and `__tests__/`; `get_pr_risk_profile` matched `"/test"` anywhere, which made
+  `src/testimonials.tsx` a test. There is one rule now, `tools/_test_paths.is_test_file`, and every
+  tool imports it: a directory named `tests`, `test`, `__tests__`, `__test__`, `test_*` or `*_tests`
+  at any depth, or a filename `test_*`, `*_test.*`, `conftest.py`, `tests.py`, `*_spec.rb`, or
+  `*.test.*` / `*.spec.*` with a JavaScript or TypeScript extension. Each suffix is tied to the
+  extensions that carry its convention because `check_delete_safe` and `check_edit_safe` read the
+  rule to call a use a TEST use, which downgrades a blocking verdict: `models/pod_spec.py` and
+  `docs/api_spec.yaml` are not tests, and a test holds those two tools to the verdict they give for
+  `models/pod.py`.
+
+  Every tool's answer moves on some path. For each old rule against the new one:
+  - `find_dead_code`, and `get_blast_radius`, `get_untested_symbols`, `find_unused_paths` and
+    `get_parity_map`, which import its predicate: gain the root-level directories, `__test__/`,
+    `*_tests/` and `test_*/` directories, `*_test.<any extension>`, `*_spec.rb` and `tests.py`, and
+    match without regard to case (`Tests/`, `TEST_PLAN.md`); lose `*.spec.*` and `*.test.*` outside
+    JavaScript and TypeScript.
+  - `get_dead_code_v2`: the same gains, plus `__tests__/` at any depth and `*.spec.*` / `*.test.*`,
+    which it never had.
+  - `check_delete_safe`, `check_edit_safe`, `find_similar_symbols` and the reuse audit: gain
+    `__tests__/`, `__test__/`, `*_tests/`, `*_test.*`, `*.spec.*`, `*.test.*`, `*_spec.rb` and `tests.py`; the last
+    two tools also gain `conftest.py`. ⚠⚠ Three of those spellings can name a production file:
+    `experiments/ab_test.py`, `certs/tests.py` and `experiments/ab_tests/`. A use there is a test
+    use to both preflights now, as a use in `test_utils.py` already was. `check_delete_safe` answers
+    `test_coverage_only` where it answered `external_uses_blocking`: not terminal, the file named as
+    a blocker, never `safe_to_delete`. `check_edit_safe` answers `safe_to_edit` where it answered
+    `signature_impact`, so read `test_import_count` before trusting that verdict on a repository
+    that names production files this way. Both verdicts are pinned by tests.
+  - `get_pr_risk_profile`: stops calling `testing/`, `testutil/`, `testdata/`, `pytest_*.py`, a
+    filename with `test_` after its first character (`_test_paths.py`),
+    `test.py`, `test.js`, `tests.js`, `*_spec.<not rb>`, `*.spec.*` and `*.test.*` outside JavaScript
+    and TypeScript (`x.test.d.ts` included), `my_test.config.js` and `.github/workflows/test.yml`
+    tests; gains `conftest.py`, a root-level `__tests__/`, `__test__/` and `*_tests/`.
+  - `get_file_risk` (`has_tests`, which feeds its `test_gap` score): gains `conftest.py`, `tests.py`,
+    `*.spec.*`, `*.test.*` and `*_spec.rb`; loses every name its old pattern matched in the middle
+    of a segment: a directory ending `_test` (`src/ab_test/`), `my_test.config.js`, `foo_testing.py`.
+
+  `tests/test_one_test_file_predicate.py` pins the cases in both directions and fails when a module
+  binds the names the copies used, at any depth, by a def, a class, an assignment,
+  a walrus, a loop or `with` target, an argument, an import alias (unless the name it
+  imports is itself one of those names), a `match` capture or an `except ... as`. A rule under a new name is seen only
+  through the tools that test runs: the two dead-code tools, the investigator, `get_file_risk` and
+  the two preflights. `get_repo_health`'s production-path rule answers a different question and
+  is unchanged (L-104).
+
 ## [1.108.323] - 2026-10-01 - an entry point has no importer, and that does not make it dead
 
 ### Fixed
```

**File**: `CLAUDE.md` (modified, +2/-1)
```diff
@@ -1,7 +1,7 @@
 # jcodemunch-mcp — Project Brief
 
 ## Current State
-- **Version:** 1.108.323 — **An entry point has no importer, and that does not make it dead.** The deletion investigator called an importer dead when nothing imported it, so a name imported only by `main.py`, `package.json`'s `main`, a package `__init__.py` or a test read `export_not_imported` SATISFIED (L-94). `_split_importers_by_liveness` asks `find_dead_code` and keeps no answer of its own; only a file reported at the default confidence is dead. ⚠⚠ **It inherits that tool's gaps with its roots**: a root-level `tests/` directory (L-101, six test-file predicates under `src/`) and an undeclared non-Python entry point (L-102) still read dead. Fix them THERE. Also: `registry_verify.py` retries, reads every page inside a time budget and exits `UNREADABLE` for a read that got no answer (L-96, L-98, L-99; RUNBOOK 3a). Forensics: `docs/workflows/LEDGER.md`.
+- **Version:** 1.108.323 — **An entry point has no importer, and that does not make it dead.** The deletion investigator called an importer dead when nothing imported it, so a name imported only by `main.py`, `package.json`'s `main`, a package `__init__.py` or a test read `export_not_imported` SATISFIED (L-94). `_split_importers_by_liveness` asks `find_dead_code` and keeps no answer of its own; only a file reported at the default confidence is dead. ⚠⚠ **It inherits that tool's gaps with its roots**: an undeclared non-Python entry point (L-102) still reads dead; fix it THERE. The root-level `tests/` gap (L-101) is fixed in `[Unreleased]`: `tools/_test_paths.is_test_file` is the ONE test-file rule. Also: `registry_verify.py` retries, reads every page inside a time budget and exits `UNREADABLE` for a read that got no answer (L-96, L-98, L-99; RUNBOOK 3a). Forensics: `docs/workflows/LEDGER.md`.
 - **Prior (1.108.322):** **The deletion investigator reads the match the search made.** It re-filtered `check_references`' import rows with a raw name comparison and dropped an import spelled in another Unicode form or with an escape (L-90); it reads `match_type` now. ⚠⚠ **Never re-compare what `check_references` matched**; `find_references` still does, at two sites (L-95). Full text: `CHANGELOG.md`; verbatim in `ISSUE-HISTORY.md` (2026-10-01, release 1.108.323).
 - **Prior (1.108.321):** **A call written with an escape is still a call.** `check_references._fold` decodes Unicode escapes before it compares, so an escaped Java, C# or JavaScript call is a reference and the delete preflight no longer grades the called function `safe_to_delete` (L-86). ⚠⚠ **A literal escape typed into a tool input reaches disk DECODED**: build escapes from `chr(92)` and assert the backslash reached the fixture. First release under the cadence gate (STANDARD N8; Standing lesson 10-01). Full text: `CHANGELOG.md`; verbatim in `ISSUE-HISTORY.md` (2026-10-01, release 1.108.322).
 - **Older releases (1.108.320 and earlier):** see `CHANGELOG.md` (1.108.303-.310, 1.108.314-.315, 1.108.316, 1.108.317, 1.108.318, 1.108.319 and 1.108.320 in `ISSUE-HISTORY.md`). The 1.108.182 entry ("a stall has a name and a ceiling", #375) and the 1.108.177-.181 #377 hardening arc are there in full.
@@ -178,6 +178,7 @@ src/jcodemunch_mcp/
     check_delete_safe.py      # check_delete_safe: composite preflight — can this symbol be deleted? Combines find_importers (cross_repo) + check_references + find_dead_code + runtime evidence + entry-point heuristics into a single verdict (safe_to_delete / test_coverage_only / internal_only / internal_uses_blocking / external_uses_blocking / cross_repo_blocking / runtime_observed / scip_referenced / entry_point, and the bounded corpus_inadequate / name_not_searchable / dynamic_import_boundary; the description's list is test-bound, L-79) plus top-5 blockers ranked by severity plus a one-line recommended_action. Read-only. Pairs with check_rename_safe for the rename-and-delete refactor flows. v1.104.1: track test_import_count separately from external_import_count so test-only consumption correctly downgrades to test_coverage_only. v1.108.6: honest-hint caveat — when `safe_to_delete` is reached AND `include_runtime=True` AND no traces are ingested for the repo (`_runtime_data_present()` returns False), the `recommended_action` surfaces that the verdict rests on static signals only and points at `import-trace`. `signals.runtime_data_present` surfaced for callers to introspect. Back-ported from `check_column_drop_safe` in jdatamunch-mcp v1.8.0. ⚠⚠ **(#566) THE DESTRUCTIVE SURFACE OF THE ABSENCE-CLAIM DEFECT, and it needed its own fix**: the "no refs at all" fallback reaches `safe_to_delete` **regardless of `dead_code_conf`** and then FLOORS the confidence at 0.85, so capping `find_dead_code` alone left a delete certified over a corpus that could not support it -- the twelve `encoding/schemas` encoders of #569 have no refs at all and each graded safe at 0.85. `corpus_inadequate` is the verdict; classified in `_stop_rul
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -466,6 +466,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_unicode_escapes_name_the_same_identifier.py | A call spelled with a Java/C#/ECMAScript Unicode escape (one or more `u` and four hex digits, hex in either case, every letter escaped, C#'s eight-digit `U`, ECMAScript's braced form) is a reference to the identifier it spells, and `check_delete_safe` does not grade the called Java method or JS function deletable; two escaped surrogates join into one character; a lone surrogate keeps its neighbour; the escape of another letter does not match. Java and JS fixtures are compiled/run when `javac`/`node` are present, outside the indexed tree. | LEDGER L-86 (2026-09-30), found in the L-83 review | 1 | LOAD-BEARING | Every escape is built from `chr(92)` and the fixture asserts the backslash reached disk: two drafts had their literal escapes decoded (by `printf`, then by the editing tool) and tested the plain spelling. Mutants: the braced branch absent and the surrogate join removed each fail one test (`red_review_round1.txt`); single-`u` only, lowercase hex only and the `U` branch disabled each fail one test (the L-86 reviewer's probes, both rounds, not in an evidence file). |
 | tests/test_investigator_trusts_the_folded_import_match.py | The deletion investigator refutes `export_not_imported` for an import in another Unicode form or written with an escape, and still does not count a specifier-stem match as an import of the name. | LEDGER L-90 (2026-10-01): a raw `target_name in names` re-filtered the rows `check_references` had matched through `_fold` | 1 | LOAD-BEARING | Escapes are built from `chr(92)`; each importer has its own importer because of L-94. Mutants (review, 2026-10-01): the raw comparison restored fails the two refuting tests; the filter replaced by `if r.get("matches")` fails the stem test, which passed against it until `src/app.js` gave `main.js` an importer. |
 | tests/test_investigator_entry_point_importer_is_live.py | A name imported only by a root (`main.py`, `package.json`'s `main`, a package `__init__.py`, a test) refutes `export_not_imported` and `no_textual_use`; a really dead importer still satisfies both with its cluster named; an importer `find_dead_code` is unsure of, or cannot answer for, is live. | LEDGER L-94 (2026-10-01): the investigator called an importer dead when nothing imported it, and an entry point has no importer by construction | 1 | LOAD-BEARING | The fix asks `find_dead_code`; the cannot-answer cases patch that function on its own module because the investigator imports it at call time. Five mutants, none survives (an unsure file counted dead, every importer dead, every importer live, an error and a raise read as all dead). The one test-file case passes by its `test_` name; a root-level `tests/` directory is L-101 and is not pinned here. |
+| tests/test_one_test_file_predicate.py | One rule says whether a path is a test file: the cases are pinned in both directions; every name a module binds for the question IS the shared function; a root-level `tests/`, `test/` and `__tests__/` are tests to `find_dead_code`, `get_dead_code_v2`, the deletion investigator and `get_file_risk`; and `check_delete_safe` and `check_edit_safe` give a production `models/pod_spec.py` consumer the verdict they give `models/pod.py`. | LEDGER L-101 (2026-10-01): six predicates, no two agreeing; the dead-code pair needed a slash before `tests/` and reported a root-level test file dead at 1.0. The first draft of the shared rule downgraded a blocked delete for a `*_spec.py` consumer | 1 | LOAD-BEARING | ⚠ The binding check is keyed on the names the copies used; a rule under a new name, or written inline, is seen only through the tools the file runs, and `get_pr_risk_profile`, `find_similar_symbols`, the reuse audit, `get_blast_radius`, `get_untested_symbols`, `find_unused_paths` and `get_parity_map` are not among them. It also pins both preflights' verdicts for the three ambiguous spellings kept (`ab_test.py`, `tests.py`, `ab_tests/`); the edit verdict there is `safe_to_edit` and is a disclosed trade (L-104), so a narrowed rule changes that test on purpose. Mutants: `evidence/red_l101_mutants.txt`. |
 | tests/test_references_compare_normalised_spellings.py | `check_references` finds a call or an import written in another Unicode spelling of the identifier (ligature, math-bold, fullwidth, composed vs decomposed, either side), each pair run under Python to prove it names one function, and never reports the definition's own line; `check_delete_safe` no longer certifies the live `def file()` / `ﬁle()` case; a Java sibling `ﬁle()` whose name folds to the target keeps the call to `file()` inside its body; twenty test files mentioning the name do not push the one real caller off `check_delete_safe`'s page (L-89); `fire` still does not match `file` (control). | LEDGER L-84 and L-89 (2026-09-30), found in the L-83 reviews | 1 | LOAD-BEARING | Measure
```

**File**: `docs/harness/FINDINGS.md` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ the tests that carry them.
 | F-38 | `suite.full_seconds_ci_windows` failed a leg whose tests all passed. PR #946 (run 36767909287, `full: test (windows-latest, 3.11)`, head 11c9f611): `13940 passed, 25 skipped ... in 1076.37s`, the Floor line `observed 1078.7` against its Floor. The diff is two `release.yml` install lines, the RUNBOOK and one test, so it cannot move suite runtime. The other three windows legs of the same run took 650, 764 and 775 s as whole jobs, and this one 1109 s (`gh run view 36767909287`). ⚠ The Floor was set on 2026-09-04 from four legs of one commit (median 516.3 s, x2, the entry's own `set_at`); the suite has grown since, to 13,965 collected here, so the margin over a typical leg has narrowed with the suite, not with the runner. | `harness/thresholds.json` `suite.full_seconds_ci_windows`, `harness/__main__.py::_full_wall_floor_id` | OPEN. One occurrence, and the tolerance rule (`docs/harness/DESIGN.md`) moves a timing Floor only on three CI runs, never on one flake: the failed job is re-run and the Floor stays. The candidate, if it recurs: re-set from the windows legs' pytest seconds of three green runs at today's suite size, recorded the way `self_latency_ci_runs_2026-09-22.json` was. |
 | F-39 | `suite.full_seconds` failed an ubuntu leg whose tests all passed. PR #955 (run 36900539828, `full: test (ubuntu-latest, 3.10)`, head 59d353b3): `14012 passed, 28 skipped ... in 358.03s`, the Floor line `observed 360.94` against `<= 360`. The diff is a release script, two `release.yml` steps, the RUNBOOK and one test file of 21 fast tests, so it cannot move suite runtime. The other three ubuntu legs of the same run read `observed 186.03` (3.12), `230.78` (3.13) and `342.14` (3.11): one tree, a spread of almost 2x between runners, and two of four legs within 20 s of the Floor. ⚠ The same Floor serves the local run, where this tree read 311.38 with four workers. Second occurrence of F-38's shape on the other OS. | `harness/thresholds.json` `suite.full_seconds`, `harness/__main__.py::_full_wall_floor_id` | OPEN. The Floor did not move. A push re-ran the leg. The 3.10 and 3.11 legs are the slow ones on both OSes in the two recorded misses, which is worth measuring before the Floor is touched |
 | F-40 | A test fixture replaced `time.sleep` on the REAL module and failed on whichever worker held a sleeping thread. `tests/test_registry_verify_retries_an_unanswered_read.py` (merged in #955) loaded `scripts/registry_verify.py` and set `mod.time.sleep` to a list's `append`; `mod.time` is the module every thread in the xdist worker shares. PR #956, run 36911633390: `full: test (ubuntu-latest, 3.11)` read `1 failed, 14034 passed, 28 skipped`, `AssertionError: assert (2 == 2 and 258047 == 1)`, and `full: test (windows-latest, 3.11)` failed the same test with `assert (2 == 2 and 179403 == 1)`; `windows-latest, 3.13` was cancelled and five legs passed. ⚠⚠ **The thread is `tests/test_v1_108_182.py`'s `_StubProvider.load`**, which loops `time.sleep(0.01)` to a 30 s deadline; `_run_with_budget` (`src/jcodemunch_mcp/parser/context/base.py`) abandons it on a daemon thread after its 0.2 s budget, by design (a watchdog cannot preempt a thread), so it outlives its test by half a minute and resolves `time.sleep` on every iteration (found by the reviewer; the log's list is all `0.01`). The miss is also a race: the failing test can finish inside one real 10 ms sleep, which fits two legs of eight. The eight `full:` legs of #955's merged head passed. | `tests/test_registry_verify_retries_an_unanswered_read.py`, `tests/test_registry_verify_reads_every_page.py`, `tests/test_v1_108_182.py` | FIXED 2026-10-01 for the two fixtures: each replaces the loaded module's own `time` NAME with a stub and asserts the real `time.sleep` and `time.monotonic` are untouched; a test with a sleeping thread beside it fails against the old fixture. OPEN for the rest: the abandoned 30 s provider thread is still there for the next fixture that patches a shared module (release it at teardown); both registry files still replace `urllib.request.urlopen` on the real module (no `urlopen` call exists under `src/` or elsewhere in `tests/`); `tests/test_watcher_lock.py` sets `watcher.asyncio.sleep`, the same class; no ratchet scans `tests/` for the property |
+| F-41 | `suite.full_seconds` failed a LOCAL full tier whose tests all passed, and the local margin F-39 leaned on is gone. Branch `fix/l101-root-level-test-dirs` (LEDGER L-101), `python .claude/hooks/run_full.py --workers 4`, seven runs on 2026-10-01, in order: 355.33, 348.87, 348.75, 345.79, 346.27, 372.03, 357.0 against `<= 360`. The sixth, on commit 901b2106, read `14125 passed, 25 skipped ... in 370.65s` and `observed 372.03 FAIL`; the box was idle when checked afterwards (CPU 12%, 14 GB free) and the re-run on the same tree read 357.0. Only the last reading is in an evidence file (`evidence/full.md`); the other six, the pytest line and the load figures were read from ru
```

**File**: `docs/workflows/LEDGER.md` (modified, +2/-1)
```diff
@@ -149,6 +149,7 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-98 | 2026-10-01, L-96 review | `scripts/registry_verify.py` checks that the body carries a list of objects and no deeper. A row whose inside is malformed (`"server": "x"`, `"_meta": "x"`, `"packages": [null]`) raises `AttributeError` out of `verdict()`, outside the retry, and the process exits 1, so the issue reads "registry publish failed". RUNBOOK 3a's no-`FAIL:`-line case routes the human correctly. Treating `AttributeError`/`TypeError` from `verdict` as no answer closes the class. Also: every test calls `main()` in-process, so nothing binds its return value to the process exit status `release.yml` reads (`sys.exit(main())` replaced by `main()` leaves the file green). | `scripts/registry_verify.py`, `tests/test_registry_verify_retries_an_unanswered_read.py` | defect | low | FIXED 2026-10-01: `_judge` wraps `verdict` alone and turns an `AttributeError`/`TypeError` from a row into no answer (the same types raised anywhere else are this script's bug and still raise); `test_the_process_exits_with_what_main_returns` runs the file as `__main__` for exit 0, 1 and `UNREADABLE` (`tests/test_registry_verify_reads_every_page.py`) |
 | L-99 | 2026-10-01, L-96 review | `scripts/registry_verify.py` reads one page (`&limit=100`) and follows no cursor. The live read returned 65 rows for `io.github.jgravelle/jcodemunch-mcp` on 2026-10-01, and each release adds one. Past the page size the latest row may not be on the page, which would read as exit 1 and "registry publish failed" on a good publish. | `scripts/registry_verify.py` | defect | medium | FIXED 2026-10-01: `fetch` follows `metadata.nextCursor` to the last page (a cursor that repeats or is in an unknown shape, a page that is not the registry's, or a run past `MAX_PAGES` is no answer), and the whole run, every attempt and page, ends inside `BUDGET_SECONDS`, which a test holds under the registry job's `timeout-minutes` because a cancelled job opens no issue; followed live at 10 and at 30 rows a page (`evidence/live_l99_paging.txt`); RUNBOOK 3a names the new causes (`tests/test_registry_verify_reads_every_page.py`) |
 | L-100 | 2026-10-01, L-99 review | `scripts/registry_verify.py`'s time budget bounds when a request may START, not when it ends: `urlopen(timeout=)` applies per socket operation, and a response dripping 20 bytes every 0.6 s ran 6.64 s on `--budget 1.0` (reviewer's measurement). The comment and the commit message say the run ends inside the budget. The job has 300 s of slack over the default, less the install and publish steps. Three budget mutants also survive the tests: the sleep check ignoring `--delay`; the budget `break` replaced by `return UNREADABLE` after an earlier wrong-row answer (a real FAIL retitled "could not be read"); the deadline reset on each attempt. And `--budget` is not validated: `0` or a negative makes no request and prints "no answer in 1 attempt(s)", `nan` and `inf` switch the budget off. `release.yml` passes no `--budget`. | `scripts/registry_verify.py`, `tests/test_registry_verify_reads_every_page.py` | defect | low | OPEN |
-| L-101 | 2026-10-01, L-94 review | `find_dead_code._is_test_file` tests `"/tests/" in fp`, `"/test/"` and `"/__tests__/"`, each needing a LEADING slash, so a test directory at the repository root is not one: `tests/helpers.py` and `__tests__/shapes.js` are reported dead at `1.0 zero_importers` where `pkg/tests/helpers.py` is skipped (reviewer's measurement). The deletion investigator, which asks this tool since L-94, then answers `export_not_imported` SATISFIED for a name such a file imports. ⚠ There are six test-file predicates under `src/` (`find_dead_code`, `get_dead_code_v2`, `check_delete_safe`, `find_similar_symbols`, `get_pr_risk_profile`, `investigator/reuse_audit`); the fix is one shared predicate with pinned cases, not a sixth patch. | `src/jcodemunch_mcp/tools/find_dead_code.py` and the five siblings | defect | medium | OPEN |
+| L-101 | 2026-10-01, L-94 review | `find_dead_code._is_test_file` tests `"/tests/" in fp`, `"/test/"` and `"/__tests__/"`, each needing a LEADING slash, so a test directory at the repository root is not one: `tests/helpers.py` and `__tests__/shapes.js` are reported dead at `1.0 zero_importers` where `pkg/tests/helpers.py` is skipped (reviewer's measurement). The deletion investigator, which asks this tool since L-94, then answers `export_not_imported` SATISFIED for a name such a file imports. ⚠ There are six test-file predicates under `src/` (`find_dead_code`, `get_dead_code_v2`, `check_delete_safe`, `find_similar_symbols`, `get_pr_risk_profile`, `investigator/reuse_audit`); the fix is one shared predicate with pinned cases, not a sixth patch. | `src/jcodemunch_mcp/tools/find_dead_code.py` and the five siblings | defect | medium | FIXED 2026-10-01: one rule, `tools/_test_paths.is_test_file`, reads the path's directories and its filename; the six copies and `get_file_ri
```

**File**: `src/jcodemunch_mcp/investigator/reuse_audit.py` (modified, +2/-6)
```diff
@@ -53,6 +53,8 @@
 from dataclasses import dataclass, field
 from typing import Any, Optional
 
+from ..tools._test_paths import is_test_file as _is_test_path
+
 from .deletion_safety import (
     Obligation,
     REFUTED,
@@ -226,12 +228,6 @@ def _identifier_forms(terms: list[str]) -> list[str]:
     return out
 
 
-def _is_test_path(path: str) -> bool:
-    from ..tools.find_similar_symbols import _is_test_file  # noqa: PLC0415
-
-    return _is_test_file(path or "")
-
-
 def _index_was_rewritten(index) -> bool:
     """Sample the .db-rewritten probe. Never raises; unknown is not changed.
 
```

**File**: `src/jcodemunch_mcp/tools/_test_paths.py` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+"""THE one answer to "is this path a test file?" (LEDGER L-101).
+
+Six rules answered this under `src/` and no two agreed. `find_dead_code` and
+`get_dead_code_v2` tested `"/tests/" in path`, which needs a LEADING slash,
+so a test directory at the repository root was not one: `tests/helpers.py`
+was reported dead at confidence 1.0 where `pkg/tests/helpers.py` was skipped.
+`check_delete_safe` and `find_similar_symbols` saw the root directory and
+missed `a_test.py`, `a.spec.ts` and `__tests__/`. `get_pr_risk_profile`
+matched `"/test" in path`, which calls `src/testimonials.tsx` a test.
+
+Every caller imports `is_test_file` from here. Add a spelling HERE, never
+beside a tool.
+
+⚠⚠ `check_delete_safe` and `check_edit_safe` read this rule to decide that a
+use is a TEST use, which downgrades a blocking verdict. A false positive here
+is therefore worse than a false negative, and each suffix is tied to the
+extensions that carry its convention: `_spec` is RSpec (`.rb`) and
+`.spec.`/`.test.` are JavaScript and TypeScript. `models/pod_spec.py` and
+`api_spec.yaml` are not tests.
+⚠⚠ Three spellings are kept although a production file can carry them:
+`*_test.<ext>`, `tests.py` and a `*_tests/` directory. A use in
+`experiments/ab_test.py` reads `test_coverage_only` to the delete preflight
+(never `safe_to_delete`) and `safe_to_edit` to the edit preflight.
+⚠ `spec/` is not a test directory here: it also names a folder of
+specifications.
+⚠ The rule reads the PATH, relative to the repository. A JUnit `FooTest.java`
+outside `src/test/`, a bare `test.py`, and Rust's inline `#[cfg(test)]`
+module are not recognised (LEDGER L-104).
+"""
+
+from __future__ import annotations
+
+import re
+
+_TEST_DIR_RE = re.compile(r"^(tests?|__tests?__|test_.+|.+_tests)$", re.IGNORECASE)
+_TEST_NAME_RE = re.compile(
+    r"^(test_.*|.+_test\.[^.]+|.+_spec\.rb|.+\.(test|spec)\.[cm]?[jt]sx?|conftest\.py|tests\.py)$",
+    re.IGNORECASE,
+)
+
+
+def is_test_file(file_path: str) -> bool:
+    """True when a directory on the path, or the filename, names a test."""
+    parts = [p for p in (file_path or "").replace("\\", "/").split("/") if p]
+    if not parts:
+        return False
+    if any(_TEST_DIR_RE.match(p) for p in parts[:-1]):
+        return True
+    return bool(_TEST_NAME_RE.match(parts[-1]))
```

**File**: `src/jcodemunch_mcp/tools/check_delete_safe.py` (modified, +1/-5)
```diff
@@ -47,6 +47,7 @@
 from ._corpus_adequacy import UNPROVEN_CEILING, assess_corpus
 from ._dynamic_boundary import FILES_CAP as DYNAMIC_FILES_CAP, DynamicBoundary
 from ._stop_rule import build_stop_rule
+from ._test_paths import is_test_file as _is_test_file  # noqa: F401  (the one rule, LEDGER L-101)
 from ._utils import index_status_to_tool_error, resolve_repo
 
 logger = logging.getLogger(__name__)
@@ -70,11 +71,6 @@
     re.IGNORECASE,
 )
 
-_TEST_FILE_RE = re.compile(r"(^|[/\\])(test_|tests?[/\\]|_test\.|conftest\.py)", re.IGNORECASE)
-
-
-def _is_test_file(file_path: str) -> bool:
-    return bool(_TEST_FILE_RE.search(file_path or ""))
 
 
 def _resolve_target(index, symbol: str) -> Optional[dict]:
```

---

### Incident Patch 12: `5804d7e7` (2026-10-01)
**Commit Message**: fix: the deletion investigator asks find_dead_code whether an importer is dead (LEDGER L-94) (#957)

* fix: the deletion investigator asks find_dead_code whether an importer is dead (LEDGER L-94)

It called an importer dead when nothing imported it, and an entry point has no
importer by construction: a name imported only by main.py, package.json's main,
a package __init__.py or a test read export_not_imported SATISFIED. The
investigator's own find_importers loop is deleted; find_dead_code is the one
answer, at its default confidence, and an error or a raise leaves every
importer live.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* review: L-94's claims narrowed to the roots find_dead_code knows; L-101, L-102, L-103 record the rest

A root-level tests/ directory and an undeclared non-Python entry point are
still reported dead by the authority, and so by the investigator. The
docstring, the CHANGELOG entry and the ledger row say so; CLAUDE.md no longer
calls L-94 open.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -2,6 +2,23 @@
 
 ## [Unreleased]
 
+### Fixed
+
+- **The deletion investigator called an entry point dead, and had its own answer to the question
+  (LEDGER L-94).** It split a name's
+  importers into live and dead by asking whether anything imported the importer. An entry point
+  has no importer by construction, so a name imported only by `main.py`, by the file
+  `package.json` names as `main`, by a package's `__init__.py` or by a test read
+  `export_not_imported` SATISFIED, with the evidence "Imported only by main.py, which is itself
+  unreachable". The text sweep asked the same question of the same file and agreed. `find_dead_code`
+  already answers whether a file is dead, with every root this project knows, and the investigator
+  had its own second answer beside it. It asks that tool now and keeps none: a root added there
+  later is a live importer here with no second change. Only a file the tool reports at its default
+  confidence counts as dead; one it is unsure of, or a call that errors, leaves the importer live,
+  so the change can block a delete and cannot permit one that was blocked. It inherits that tool's
+  gaps with its roots: a root-level `tests/` directory (L-101) and an undeclared non-Python entry
+  point such as `index.js` with no `package.json` (L-102) still read as dead, there and here.
+
 ## [1.108.322] - 2026-10-01 - the deletion investigator reads the match the search made
 
 ### Fixed
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # jcodemunch-mcp — Project Brief
 
 ## Current State
-- **Version:** 1.108.322 — **The deletion investigator reads the match the search made.** `check_references` matches import names through `_fold`; the investigator filtered those rows again with a raw `target_name in names`, so an import in another Unicode form or written with an escape was dropped and `export_not_imported` read SATISFIED over a live importer (L-90). It reads `match_type` and compares no name of its own. ⚠⚠ **Never re-compare what `check_references` matched**; `find_references` still does, at two sites (L-95), and the investigator still counts an entry-point importer as unreachable (L-94). First release cut inside the 2-hour cadence (N8). Forensics: `docs/workflows/LEDGER.md`.
+- **Version:** 1.108.322 — **The deletion investigator reads the match the search made.** `check_references` matches import names through `_fold`; the investigator filtered those rows again with a raw `target_name in names`, so an import in another Unicode form or written with an escape was dropped and `export_not_imported` read SATISFIED over a live importer (L-90). It reads `match_type` and compares no name of its own. ⚠⚠ **Never re-compare what `check_references` matched**; `find_references` still does, at two sites (L-95). First release cut inside the 2-hour cadence (N8). Forensics: `docs/workflows/LEDGER.md`.
 - **Prior (1.108.321):** **A call written with an escape is still a call.** `check_references._fold` decodes Unicode escapes before it compares, so an escaped Java, C# or JavaScript call is a reference and the delete preflight no longer grades the called function `safe_to_delete` (L-86). ⚠⚠ **A literal escape typed into a tool input reaches disk DECODED**: build escapes from `chr(92)` and assert the backslash reached the fixture. First release under the cadence gate (STANDARD N8; Standing lesson 10-01). Full text: `CHANGELOG.md`; verbatim in `ISSUE-HISTORY.md` (2026-10-01, release 1.108.322).
 - **Prior (1.108.320):** **A member the index never saw and a caller the search never found both read as nothing there.** Class members and state indexed in the languages that dropped them (#713-#858); the delete and edit preflights stopped certifying an absence their search could not see (a dynamic import, an unsearchable name, another Unicode spelling, a differently-cased sibling, a page of test mentions). ⚠⚠ **The definition-span exclusion is NEVER folded and matches the exact declared spelling.** Shipped 14 days after .319 (Standing lesson 09-30). Full text: `CHANGELOG.md`; verbatim in `ISSUE-HISTORY.md` (2026-10-01).
 - **Older releases (1.108.319 and earlier):** see `CHANGELOG.md` (1.108.303-.310, 1.108.314-.315, 1.108.316, 1.108.317, 1.108.318 and 1.108.319 in `ISSUE-HISTORY.md`). The 1.108.182 entry ("a stall has a name and a ceiling", #375) and the 1.108.177-.181 #377 hardening arc are there in full.
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -465,6 +465,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_definition_exclusion_is_case_exact.py | `check_references` excludes only the lines of definitions spelled EXACTLY as the identifier: a call to `file()` inside a Java sibling `File()` is a reference and `check_delete_safe` does not certify the used `file`; asking about `File` still excludes `File`'s own lines; the target's own lines stay excluded (control); an unused `load` beside `Load` reads as referenced, the accepted cost, pinned. | LEDGER L-88 (2026-09-30), found in the L-84 review | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for the used method. 3 of 3 mutants killed (key lowered, symbol name lowered, exclusion dropped). |
 | tests/test_unicode_escapes_name_the_same_identifier.py | A call spelled with a Java/C#/ECMAScript Unicode escape (one or more `u` and four hex digits, hex in either case, every letter escaped, C#'s eight-digit `U`, ECMAScript's braced form) is a reference to the identifier it spells, and `check_delete_safe` does not grade the called Java method or JS function deletable; two escaped surrogates join into one character; a lone surrogate keeps its neighbour; the escape of another letter does not match. Java and JS fixtures are compiled/run when `javac`/`node` are present, outside the indexed tree. | LEDGER L-86 (2026-09-30), found in the L-83 review | 1 | LOAD-BEARING | Every escape is built from `chr(92)` and the fixture asserts the backslash reached disk: two drafts had their literal escapes decoded (by `printf`, then by the editing tool) and tested the plain spelling. Mutants: the braced branch absent and the surrogate join removed each fail one test (`red_review_round1.txt`); single-`u` only, lowercase hex only and the `U` branch disabled each fail one test (the L-86 reviewer's probes, both rounds, not in an evidence file). |
 | tests/test_investigator_trusts_the_folded_import_match.py | The deletion investigator refutes `export_not_imported` for an import in another Unicode form or written with an escape, and still does not count a specifier-stem match as an import of the name. | LEDGER L-90 (2026-10-01): a raw `target_name in names` re-filtered the rows `check_references` had matched through `_fold` | 1 | LOAD-BEARING | Escapes are built from `chr(92)`; each importer has its own importer because of L-94. Mutants (review, 2026-10-01): the raw comparison restored fails the two refuting tests; the filter replaced by `if r.get("matches")` fails the stem test, which passed against it until `src/app.js` gave `main.js` an importer. |
+| tests/test_investigator_entry_point_importer_is_live.py | A name imported only by a root (`main.py`, `package.json`'s `main`, a package `__init__.py`, a test) refutes `export_not_imported` and `no_textual_use`; a really dead importer still satisfies both with its cluster named; an importer `find_dead_code` is unsure of, or cannot answer for, is live. | LEDGER L-94 (2026-10-01): the investigator called an importer dead when nothing imported it, and an entry point has no importer by construction | 1 | LOAD-BEARING | The fix asks `find_dead_code`; the cannot-answer cases patch that function on its own module because the investigator imports it at call time. Five mutants, none survives (an unsure file counted dead, every importer dead, every importer live, an error and a raise read as all dead). The one test-file case passes by its `test_` name; a root-level `tests/` directory is L-101 and is not pinned here. |
 | tests/test_references_compare_normalised_spellings.py | `check_references` finds a call or an import written in another Unicode spelling of the identifier (ligature, math-bold, fullwidth, composed vs decomposed, either side), each pair run under Python to prove it names one function, and never reports the definition's own line; `check_delete_safe` no longer certifies the live `def file()` / `ﬁle()` case; a Java sibling `ﬁle()` whose name folds to the target keeps the call to `file()` inside its body; twenty test files mentioning the name do not push the one real caller off `check_delete_safe`'s page (L-89); `fire` still does not match `file` (control). | LEDGER L-84 and L-89 (2026-09-30), found in the L-83 reviews | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for a used function. The sibling case is review round 1's: a FOLDED definition-span exclusion removed that call and certified the used method at 1.0. 5 of 5 mutants killed (content, import names, the folded exclusion, identifier left unfolded, NFC instead of NFKC) plus L-89's (the page capped at 20 again), 6 of 6. |
 | tests/test_non_ascii_names_keep_refusing.py | A used Python function whose declared and called spellings differ only by Unicode normalisation (ligature, decomposed accent, math-bold or fullwidth letter, on either side) is never certified deletable, each pair proven to name one function by running it; the name predicate refuses non-A
```

**File**: `docs/workflows/LEDGER.md` (modified, +4/-1)
```diff
@@ -142,10 +142,13 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-91 | 2026-09-30, L-88 | `check_references` still excludes the lines of EVERY definition spelled exactly like the identifier, so a use inside a same-named definition elsewhere is lost: Java class `B { int file() { return new A().file(); } }` hides B's call to `A.file` when `check_delete_safe` asks about `A.file`, and one overload calling another is hidden the same way. The fix is to exclude only the TARGET symbol's own span when the caller knows it (`check_delete_safe` and `check_edit_safe` do). ⚠ Measure first: it makes an overload's sibling declarations, and a Python property's setter, read as references, which moves many verdicts toward blocking. | `src/jcodemunch_mcp/tools/check_references.py`, `src/jcodemunch_mcp/tools/check_delete_safe.py`, `src/jcodemunch_mcp/tools/check_edit_safe.py` | defect | medium | OPEN |
 | L-92 | 2026-09-30, cutting 1.108.320 | `release.yml` published the version's CHANGELOG block verbatim as the GitHub release body, from an inline script. GitHub refuses a body over 125,000 characters, and the 1.108.320 block rendered to 335,771. The github-release job runs after the PyPI publish and the registry job needs it, so dispatching would have published to PyPI, failed the GitHub release and skipped the registry. | `.github/workflows/release.yml` | defect | medium | FIXED 2026-09-30 (`scripts/release_notes.py`: verbatim when it fits, else the lead, every heading and a link at the tag; tested over every released block and [Unreleased] as if cut) |
 | L-93 | 2026-09-30, releasing 1.108.320 | `release.yml`'s retried installs (`smoke-testpypi`, `post-publish`) re-read `uv`'s cached index page on every attempt. Run 36759801785: the ubuntu smoke asked Test PyPI at 18:37:59, 13 s after the upload finished, got a page not yet listing 1.108.320, and spent its ten-minute budget re-reading that cached page twenty times; windows asked at 18:38:15 and installed first try. The run stopped before the tag and PyPI; a rerun of the failed job on a fresh runner recovered it. C-19 made the install its own probe, and the probe never asked again. | `.github/workflows/release.yml` | defect | medium | FIXED 2026-09-30 (both loops pass `--refresh-package jcodemunch-mcp`; `tests/test_release_install_is_its_own_probe.py` requires a refresh on every retried remote install) |
-| L-94 | 2026-10-01, L-90 | The deletion investigator's `_split_importers_by_liveness` counts an importer with no importers of its own as unreachable, and an entry point has none by construction. A name imported only by `main.py`, or by the file `package.json`'s `main` names, reads `export_not_imported` SATISFIED with the evidence "Imported only by main.py, which is itself unreachable" (measured on both L-90 fixtures before each importer was given an importer). It should ask `tools/_entry_points.entry_point_spec` and the Python entry-point filenames before it calls an importer dead. The investigator is not an MCP tool. | `src/jcodemunch_mcp/investigator/deletion_safety.py` | defect | medium | OPEN |
+| L-94 | 2026-10-01, L-90 | The deletion investigator's `_split_importers_by_liveness` counts an importer with no importers of its own as unreachable, and an entry point has none by construction. A name imported only by `main.py`, or by the file `package.json`'s `main` names, reads `export_not_imported` SATISFIED with the evidence "Imported only by main.py, which is itself unreachable" (measured on both L-90 fixtures before each importer was given an importer). It should ask `tools/_entry_points.entry_point_spec` and the Python entry-point filenames before it calls an importer dead. The investigator is not an MCP tool. | `src/jcodemunch_mcp/investigator/deletion_safety.py` | defect | medium | FIXED 2026-10-01: `_split_importers_by_liveness` asks `find_dead_code` which importers are dead and keeps no second answer (the roots it does not know are L-101 and L-102), so every root that tool knows (entry-point filenames, `__init__`, `package.json` entries, the framework profile, render edges, the dynamic-import boundary) is a live importer; only a file it reports at its default confidence is dead, and an error or a raise leaves every importer live. Both callers, the import obligation and the text sweep, read it (`tests/test_investigator_entry_point_importer_is_live.py`) |
 | L-95 | 2026-10-01, L-90 | `find_references` compares import names with `n.lower() == ident_lower` at two sites, not through `check_references._fold`, so an import in another Unicode form or written with an escape is absent from the import-graph answer while `check_references` finds it. A third comparison site the fold does not reach; the fix is the shared fold. | `src/jcodemunch_mcp/tools/find_references.py` | defect | low | OPEN |
 | L-96 | 2026-10-01, releasing 1.108.321 | `scripts/registry_verify.py` makes ONE request with a 30 s timeout and no retry, and `release.yml` opens
```

**File**: `src/jcodemunch_mcp/investigator/deletion_safety.py` (modified, +35/-31)
```diff
@@ -38,10 +38,13 @@
 
 from __future__ import annotations
 
+import logging
 import time
 from dataclasses import dataclass, field
 from typing import Any, Optional
 
+logger = logging.getLogger(__name__)
+
 SATISFIED = "satisfied"      # we established this obligation holds
 REFUTED = "refuted"          # we established it does NOT hold: a real blocker
 UNESTABLISHED = "unestablished"  # we could not find out; NOT the same as satisfied
@@ -96,39 +99,40 @@ def _split_importers_by_liveness(
 ) -> tuple[list[str], list[str]]:
     """Partition importer files into (unreachable, reachable).
 
-    One level of recursion only, deliberately. A file with zero importers of its
-    own is unreachable; deciding that its importers are in turn unreachable is
-    the same question one level up, and unbounded walking would turn a bounded
-    investigation into a graph traversal with no budget. One level covers the
-    case the 2026-03-18 A/B actually hit (a dead loader importing a helper) and
-    reports the rest honestly rather than guessing.
-
-    An importer we cannot classify counts as REACHABLE, so uncertainty blocks
-    deletion rather than permitting it.
+    ⚠⚠ `find_dead_code` is the authority on whether a file is dead, and this
+    asks it (LEDGER L-94). The first form asked `find_importers` whether the
+    importer had an importer of its own, which is a second answer to that
+    question and a wrong one for every root: an entry point has no importer BY
+    CONSTRUCTION, so a name imported only by `main.py`, by the file
+    `package.json` names, by a package's `__init__.py` or by a test read as
+    imported by nothing live. `find_dead_code` knows those roots, the
+    framework profile, render edges and the dynamic-import boundary (L-73),
+    and a root added there later is inherited here.
+
+    ⚠ Only a file it reports at its default confidence is dead. A lower one
+    (`all_importers_dead`, a capped corpus) is a file it is unsure of, and an
+    importer we cannot classify counts as REACHABLE, so uncertainty blocks
+    deletion rather than permitting it. A test file that tool RECOGNISES is
+    never in its answer, so a test importing the name is a live importer.
+
+    ⚠ This inherits the authority's gaps as well as its roots. It does not
+    recognise a root-level `tests/` directory (LEDGER L-101) or an undeclared
+    non-Python entry point such as `index.js` with no `package.json` (L-102),
+    and both still read as dead here. Fix them THERE.
     """
-    dead: list[str] = []
-    live: list[str] = []
     try:
-        from ..tools.find_importers import find_importers  # noqa: PLC0415
-    except Exception:  # pragma: no cover - defensive
+        from ..tools.find_dead_code import find_dead_code  # noqa: PLC0415
+
+        res = find_dead_code(repo, granularity="file", storage_path=storage_path)
+        if "error" in res:
+            return [], list(files)
+        dead_files = {d["file"] for d in res.get("dead_files") or []}
+    except Exception:  # noqa: BLE001
+        logger.debug("_split_importers_by_liveness: find_dead_code raised", exc_info=True)
         return [], list(files)
 
-    for f in files:
-        try:
-            res = find_importers(repo, f, storage_path=storage_path)
-            if "error" in res:
-                live.append(f)
-                continue
-            # (LEDGER L-73) A file a dynamic import can load has no static
-            # importer by construction; that is not evidence it is dead.
-            if res.get("dynamic_import_boundary"):
-                live.append(f)
-            elif int(res.get("importer_count", 0) or 0) == 0:
-                dead.append(f)
-            else:
-                live.append(f)
-        except Exception:  # pragma: no cover - defensive
-            live.append(f)
+    dead = [f for f in files if f in dead_files]
+    live = [f for f in files if f not in dead_files]
     return dead, live
 
 
@@ -301,7 +305,7 @@ def investigate_deletion_safety(
                 dead_importers, live_importers = _split_importers_by_liveness(
                     repo, named_importers, storage_path
                 )
-                ref_ob.calls += len(named_importers)
+                ref_ob.calls += 1  # one find_dead_code call classifies them all
                 if live_importers:
                     ref_ob.status = REFUTED
                     ref_ob.evidence = [
@@ -368,7 +372,7 @@ def investigate_deletion_safety(
                 dead_m, live_m = _split_importers_by_liveness(
                     repo, [f for f in other_files if f], storage_path
                 )
-                text_ob.calls += len(other_files)
+                text_ob.calls += 1  # one find_dead_code call classifies them all
                 if live_m:
                     text_ob.status = REFUTED
                     text_ob.evidence = [f"Name appears in {f}" for f in live_m[:5]]
```

**File**: `tests/test_investigator_entry_point_importer_is_live.py` (added, +165/-0)
```diff
@@ -0,0 +1,165 @@
+"""An importer nothing imports is not thereby dead (LEDGER L-94).
+
+The deletion investigator split a name's importers into live and dead by one
+question: does anything import the importer? An entry point has no importer by
+construction, so a name imported ONLY by `main.py`, by the file `package.json`
+names as `main`, by a package's `__init__.py` or by a test read
+`export_not_imported` SATISFIED with the evidence "Imported only by main.py,
+which is itself unreachable".
+
+`find_dead_code` already answers "is this file dead?" with every root this
+project knows (entry-point filenames, `__init__`, `package.json` entries, the
+framework profile, render edges, dynamic imports). The investigator asks it
+and keeps no second answer. The other direction is tested too: an importer
+that really is dead still lets the obligation through, with its cluster
+named, and one the tool is unsure of or cannot answer for stays live.
+"""
+
+from __future__ import annotations
+
+from pathlib import Path
+
+import pytest
+
+from jcodemunch_mcp.investigator import REFUTED, SATISFIED, investigate_deletion_safety
+from jcodemunch_mcp.investigator.deletion_safety import UNSAFE
+from jcodemunch_mcp.tools.index_folder import index_folder
+
+PKG = '{"name":"fx","version":"1.0.0","type":"module","main":"src/main.js"}'
+
+
+def _index(root: Path, files: dict[str, str]) -> tuple[str, str]:
+    for rel, body in files.items():
+        p = root / rel
+        p.parent.mkdir(parents=True, exist_ok=True)
+        p.write_text(body, encoding="utf-8")
+    storage = str(root / ".index")
+    res = index_folder(str(root), use_ai_summaries=False, storage_path=storage)
+    return res.get("repo", str(root)), storage
+
+
+def _ob(result: dict, name: str) -> dict:
+    assert "error" not in result, result
+    for o in result["obligations"]:
+        if o["obligation"] == name:
+            return o
+    raise AssertionError(f"obligation {name!r} missing from {result['obligations']}")
+
+
+CASES = {
+    "python-main": (
+        {
+            "shapes.py": "def area():\n    return 1\n",
+            "main.py": "from shapes import area\n\nprint(area())\n",
+        },
+        "shapes.py::area#function",
+        "main.py",
+    ),
+    "package-json-main": (
+        {
+            "package.json": PKG,
+            "src/shapes.js": "export function area() { return 1; }\n",
+            "src/main.js": "import { area } from './shapes.js';\nexport function boot() { return area(); }\n",
+        },
+        "src/shapes.js::area#function",
+        "src/main.js",
+    ),
+    "package-init": (
+        {
+            "pkg/shapes.py": "def area():\n    return 1\n",
+            "pkg/__init__.py": "from .shapes import area\n\n__all__ = ['area']\n",
+        },
+        "pkg/shapes.py::area#function",
+        "pkg/__init__.py",
+    ),
+    "test-file": (
+        {
+            "shapes.py": "def area():\n    return 1\n",
+            "tests/test_shapes.py": "from shapes import area\n\n\ndef test_area():\n    assert area() == 1\n",
+        },
+        "shapes.py::area#function",
+        "tests/test_shapes.py",
+    ),
+}
+
+
+@pytest.mark.parametrize("case", sorted(CASES))
+def test_a_name_imported_only_by_a_root_is_imported(tmp_path, case):
+    files, symbol, importer = CASES[case]
+    repo, storage = _index(tmp_path, files)
+    result = investigate_deletion_safety(repo, symbol, storage_path=storage)
+    ob = _ob(result, "export_not_imported")
+    assert ob["status"] == REFUTED, ob
+    assert any(importer in e for e in ob["evidence"]), ob
+    # The text sweep asks the same liveness question of the same file.
+    text = _ob(result, "no_textual_use")
+    assert text["status"] == REFUTED and importer in text["detail"]["files"], text
+    assert result["verdict"] == UNSAFE
+
+
+def test_a_name_imported_only_by_a_dead_file_is_still_removable_with_it(tmp_path):
+    """Gap 3, kept: `orphan.py` is no root and nothing imports it."""
+    files = {
+        "shapes.py": "def area():\n    return 1\n\n\ndef side():\n    return 2\n",
+        "orphan.py": "from shapes import area\n\n\ndef unused():\n    return area()\n",
+        "main.py": "from shapes import side\n\nprint(side())\n",
+    }
+    repo, storage = _index(tmp_path, files)
+    result = investigate_deletion_safety(
+        repo, "shapes.py::area#function", storage_path=storage
+    )
+    ob = _ob(result, "export_not_imported")
+    assert ob["status"] == SATISFIED, ob
+    assert ob["detail"]["deletion_cluster"] == ["orphan.py"], ob
+    text = _ob(result, "no_textual_use")
+    assert text["status"] == SATISFIED and text["detail"]["in_unreachable_files"] == [
+        "orphan.py"
+    ], text
+    assert result["verdict"] != UNSAFE
+
+
+def test_an_importer_the_dead_code_tool_is_unsure_of_counts_as_live(tmp_path):
+    """`loader.py` is imported, but only by a dead file: `find_dead_code` reports it below
+    its default confidence. Unsure is not dead, and an un
```

**File**: `tests/test_investigator_trusts_the_folded_import_match.py` (modified, +4/-2)
```diff
@@ -10,8 +10,10 @@
 already states as `match_type`. The last test pins that half: a file imported
 by its stem alone is not an import of a name.
 
-Each importer here has an importer of its own: the investigator counts a file
-nothing imports as unreachable, entry points included (LEDGER L-94).
+Each importer here has an importer of its own. When this was written the
+investigator counted a file nothing imports as unreachable, entry points
+included (LEDGER L-94, fixed since); the fixtures stay as they are so the two
+properties are tested apart.
 """
 
 from __future__ import annotations
```

---

### Incident Patch 13: `c2a23484` (2026-10-01)
**Commit Message**: fix: the registry verify reads every page, and a row it cannot read is no answer (LEDGER L-99, L-98) (#956)

* fix: the registry verify reads every page, and a row it cannot read is no answer (LEDGER L-99, L-98)

fetch follows metadata.nextCursor to the last page; a repeated cursor, a run
past MAX_PAGES and a later page that is not the registry's fail the whole read.
verdict runs inside the retry, so a malformed row is UNREADABLE, not exit 1.
A test runs the file as __main__ and binds the process exit to main's return.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* review: the registry verify's whole run is bounded, an unknown cursor shape is no answer, and only a row's error is retried

Six attempts of fifty pages at thirty seconds was 9,100 s against a 900 s job,
and a cancelled job opens no issue: the run ends inside BUDGET_SECONDS, which a
test holds under the job's timeout. A cursor or metadata in an unknown shape
was read as the last page and the partial read judged. AttributeError and
TypeError were caught around fetch too, hiding a bug in the paging code as an
unreadable registry; _judge wraps verdict alone. RUNBOOK 3a names the causes.

Co-Authored-By: Claude Opus 

**File**: `docs/cicd/RUNBOOK.md` (modified, +17/-4)
```diff
@@ -137,16 +137,29 @@ title says which of two things happened (LEDGER L-96).
 1. **"registry could not be read after publishing vX.Y.Z".** The publish step
    passed. No read of the registry got an answer: `scripts/registry_verify.py`
    exited with its `UNREADABLE` code after every attempt timed out, was cut,
-   got an HTTP error status, or returned a body that was not the registry's.
-   This says nothing about the publish. Read the registry again:
+   got an HTTP error status, returned a body, a page cursor or a row that was
+   not in the registry's shape, did not reach the last page, or the run's time
+   budget ran out. This says nothing about the publish. Read the registry
+   again:
 
    ```
    cd /d C:\MCPs\jcodemunch-mcp && python scripts\registry_verify.py --version X.Y.Z
    ```
 
    `PASS`: close the issue with that output. Do not re-publish.
-   `UNREADABLE` again: the registry is still not answering; wait and run it
-   again. `FAIL:` lines: the registry answered; go to item 2's first case.
+   The last line decides: `attempt N: FAIL: ...` lines above a final `PASS`
+   are a stale row that was asked again.
+   `UNREADABLE` again: read the `attempt N: no answer (<type>: ...)` lines.
+   - A timeout, a connection error, an HTTP 5xx or an HTTP 429: the registry
+     is still not answering. Wait and run it again.
+   - The same `ValueError` or `JSONDecodeError` on every attempt (a body, a
+     cursor or a row in another shape, a cursor that did not advance, too
+     many pages), or any other HTTP 4xx (the request itself is refused):
+     waiting will not fix it. The registry's shape changed or the script is wrong.
+     Read the row by hand
+     (`https://registry.modelcontextprotocol.io/v0/servers?search=io.github.jgravelle/jcodemunch-mcp&version=latest`),
+     close the issue on what it shows, and fix the script in a PR.
+   `FAIL:` as the last lines: the registry answered; go to item 2's first case.
 2. **"registry publish failed for vX.Y.Z".** Open the run and read which step
    failed.
    - The verify step failed with `FAIL:` lines: the registry answered and the
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +2/-1)
```diff
@@ -810,7 +810,8 @@ Key: LOAD-BEARING = a committed test or CI job reads it; STRUCTURAL = documented
 | `tests/test_competitive_checks.py` | The competitive tier's fairness checks (DESIGN s3.3, s4.3, s10): corpus_check's five criteria each failing ALONE over synthetic descriptions with every threshold read from `corpus_policy.json`; the policy file complete and a missing key refusing; corpora.json pinned by full SHA with a domain; every task file's corpus a set member or self@HEAD, with the P1/P2/P4 shapes; the task generators' definition-line verification refusing a moved line and their grep rules; task_check's symmetric split, the check's three refusals, and tools_not_called naming only the silent tool; the sandbox kill WAITS for the exit after a delivered kill and not after a failed one (CF-65: `docker kill` returns on delivery, and `docker ps` the instant after listed a timed-out container once in the eight gate runs of 2026-09-07; the test passed in the other seven); the live-container test's skip gate asks `sandbox.docker_available()` (CF-68: a copy that only asked whether `docker info` succeeds ran it on a windows-latest runner in Windows-container mode and failed PR #681's gate), with a daemon-free test that reports a Windows daemon and asserts the skip and the question, and a ratchet over every test file for a re-derived `docker info`. | competitive PR 3a (2026-09-06), CF-65 (2026-09-07), CF-68 (2026-09-13); docstring | 1 | LOAD-BEARING | competitive layer; the checkouts are not needed (nothing here fetches) |
 | `tests/test_workflow_commit_identity.py` | Every `user.email` a workflow commits or tags under is the numeric `<id>+<login>@users.noreply.github.com` form of an account we own. `main.yml` committed the weekly results as `harness-bot@users.noreply.github.com`, which GitHub resolved to a stranger's account (created 2026-05-18), so CLA Assistant reported the PR unsigned and it sat BLOCKED with every check green; `release.yml`'s tagger `release-bot` (an account since 2014) and the five inbound/competitive workflows' `inbound` (since 2012) are the same shape. The allowlist is by site and names the finding that owns it (IN-20), and a third test fails when an allowlisted site stops carrying the address. Red against main's two workflows: 2 failed. IN-21 (2026-09-09): the scanner reads every spelling git accepts, `user.email` with `=` or whitespace, `GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_EMAIL` with `:` or `=`, and the email in `--author`'s angle brackets, with nine spellings each carrying a stranger's address run through it and a script argument named `--author` refused; red over main's scanner: 7 of the nine failed. | cicd FINDINGS C-17 (2026-09-07), reviewer round 3 of #634; docstring | 1 | LOAD-BEARING | cicd layer; reads `.github/workflows/*.yml` only |
 | `tests/test_release_install_is_its_own_probe.py` | A step that installs a just-published version from a remote index must retry THAT INSTALL, not gate on a readiness probe of another endpoint. `release.yml`'s `post-publish` polled `pypi.org/pypi/<pkg>/<version>/json` (the JSON API) and then installed through the `/simple/` index; separately cached, so the JSON API answered 200 on the first iteration and the install failed 13 s after the upload finished on v1.108.319, giving up in under a second against a ten-minute budget, skipping the GitHub release and the MCP registry publish and opening P0 #706/#707. The step was named "poll up to 10 min" and never polled. Four properties plus a non-vacuity scan: the install retries itself, no step gates an install on a PyPI URL it does not install from, an exhausted retry still fails (the `if` that enables the retry swallows the last status), and a step name promising a wait has a loop. Red against main's `release.yml` with the SHIPPED file, pasted from `.claude/state/evidence/red.txt` rather than described (the count in this cell was typed and wrong twice -- first `2 failed` from a capture that predated `test_an_exhausted_retry_still_fails`, then a `two and two` split against a measured three and one): **4 failed**, the four being `test_a_remote_install_retries_itself[post-publish]`, `test_no_step_gates_an_install_on_a_different_endpoint[post-publish]`, `test_an_exhausted_retry_still_fails[smoke-testpypi]`, `test_an_exhausted_retry_still_fails[post-publish]` -- so 3 on `post-publish` and 1 on `smoke-testpypi`. ⚠⚠ **The PASSED count is deliberately not quoted here.** It is an artifact of how many spellings happen to be pinned, says nothing about the defect, and quoting it coupled every future test in that file to an edit of BOTH these records -- which is where two of this PR's own defects came from, each created while correcting something else rather than by the original work, whose retry had no `uv pip show` guard on main either. | cicd FINDINGS C-19 (2026-09-16), #709; docstring | 1 | LOAD-BEARING | cicd layer; reads `.github/workflows/release.yml` only. ⚠⚠ **STATED GAP: a package name held in a shell vari
```

**File**: `docs/harness/FINDINGS.md` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ the tests that carry them.
 | F-37 | **DoD 11's "in its own commit" is unenforced, and the record shows it.** STANDARD.md item 11 asks for a `harness/retired.json` entry in its own commit; `dod_checklist.py` row 11 checks that the entry EXISTS and the ledger test passes, never which commit carries it, and `pre_commit.py` runs on one commit at a time and cannot see the split. On 2026-09-23 the #833 fix (`b1ffdbba`) carried its retirement entry beside `src/` and the tests, exactly as `fbd6b5b0` (#812's audit retirement) had the day before; both were caught by a reviewer reading `git show --stat`, not by any gate. ⚠ The rule's purpose is that a retirement is REVIEWABLE apart from the fix; on a squash-merged branch the two commits collapse to one on `main` regardless, so the only reader the split serves is the PR reviewer, who has the ledger diff in hand either way. ⚠⚠ Recorded rather than silently tolerated: a rule that two consecutive fixes broke without a gate firing is either a rule the checklist should enforce (row 11 reads `git log -- harness/retired.json` and refuses an entry whose commit also touches `src/`) or a rule to strike from STANDARD.md; a third unenforced instance should settle which. ⚠⚠ **Measured on the third review round of #833: the clause is UNSATISFIABLE under the commit hook, not merely unenforced.** `tests/test_retirement_ledger.py::test_every_ledger_entry_names_a_test_that_actually_left_this_branch` runs in the fast tier that `pre_commit.py` requires of every commit and compares the working tree against the merge base, so a ledger entry committed BEFORE the deletion names a test that has not left (refused), and the deletion committed BEFORE the entry is a retirement with no ledger row (refused). The two halves can only arrive together, which is what W-31/#797 already recorded about the hook's timing. The rule and the gate contradict each other, and the remedy is a STANDARD.md edit (strike "in its own commit", or say "in the same commit as the deletion and no other change"), which is the maintainer's. | `docs/standard/STANDARD.md` item 11, `.claude/hooks/dod_checklist.py` row 11, `tests/test_retirement_ledger.py` | OPEN, handed to the maintainer with #833's PR; the two instances are `fbd6b5b0` and `b1ffdbba`. |
 | F-38 | `suite.full_seconds_ci_windows` failed a leg whose tests all passed. PR #946 (run 36767909287, `full: test (windows-latest, 3.11)`, head 11c9f611): `13940 passed, 25 skipped ... in 1076.37s`, the Floor line `observed 1078.7` against its Floor. The diff is two `release.yml` install lines, the RUNBOOK and one test, so it cannot move suite runtime. The other three windows legs of the same run took 650, 764 and 775 s as whole jobs, and this one 1109 s (`gh run view 36767909287`). ⚠ The Floor was set on 2026-09-04 from four legs of one commit (median 516.3 s, x2, the entry's own `set_at`); the suite has grown since, to 13,965 collected here, so the margin over a typical leg has narrowed with the suite, not with the runner. | `harness/thresholds.json` `suite.full_seconds_ci_windows`, `harness/__main__.py::_full_wall_floor_id` | OPEN. One occurrence, and the tolerance rule (`docs/harness/DESIGN.md`) moves a timing Floor only on three CI runs, never on one flake: the failed job is re-run and the Floor stays. The candidate, if it recurs: re-set from the windows legs' pytest seconds of three green runs at today's suite size, recorded the way `self_latency_ci_runs_2026-09-22.json` was. |
 | F-39 | `suite.full_seconds` failed an ubuntu leg whose tests all passed. PR #955 (run 36900539828, `full: test (ubuntu-latest, 3.10)`, head 59d353b3): `14012 passed, 28 skipped ... in 358.03s`, the Floor line `observed 360.94` against `<= 360`. The diff is a release script, two `release.yml` steps, the RUNBOOK and one test file of 21 fast tests, so it cannot move suite runtime. The other three ubuntu legs of the same run read `observed 186.03` (3.12), `230.78` (3.13) and `342.14` (3.11): one tree, a spread of almost 2x between runners, and two of four legs within 20 s of the Floor. ⚠ The same Floor serves the local run, where this tree read 311.38 with four workers. Second occurrence of F-38's shape on the other OS. | `harness/thresholds.json` `suite.full_seconds`, `harness/__main__.py::_full_wall_floor_id` | OPEN. The Floor did not move. A push re-ran the leg. The 3.10 and 3.11 legs are the slow ones on both OSes in the two recorded misses, which is worth measuring before the Floor is touched |
+| F-40 | A test fixture replaced `time.sleep` on the REAL module and failed on whichever worker held a sleeping thread. `tests/test_registry_verify_retries_an_unanswered_read.py` (merged in #955) loaded `scripts/registry_verify.py` and set `mod.time.sleep` to a list's `append`; `mod.time` is the module every thread in the xdist worker shares. PR #956, run 36911633390: `full: test (ubuntu-latest, 3.11)` read `1 failed, 14034 passed, 28 skipped`, `AssertionError: assert (2 == 2 and 2580
```

**File**: `docs/workflows/LEDGER.md` (modified, +3/-2)
```diff
@@ -146,5 +146,6 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-95 | 2026-10-01, L-90 | `find_references` compares import names with `n.lower() == ident_lower` at two sites, not through `check_references._fold`, so an import in another Unicode form or written with an escape is absent from the import-graph answer while `check_references` finds it. A third comparison site the fold does not reach; the fix is the shared fold. | `src/jcodemunch_mcp/tools/find_references.py` | defect | low | OPEN |
 | L-96 | 2026-10-01, releasing 1.108.321 | `scripts/registry_verify.py` makes ONE request with a 30 s timeout and no retry, and `release.yml` opens a "registry publish failed" issue when the step fails. On the 1.108.321 run the publish succeeded, the verify read timed out once, the run read Failure and #952 was opened against a registry that already carried the version as `isLatest`. A read that could not be made is not a publish that failed: retry the read, and name the two outcomes apart in the issue title. | `scripts/registry_verify.py`, `.github/workflows/release.yml` | defect | medium | FIXED 2026-10-01: the script retries the read (and a wrong row, which the registry can serve for a moment after a publish) and exits 1 when the registry answered wrong, `UNREADABLE` (a code argparse and a missing file do not share) when no attempt got an answer; `release.yml` runs it without a pipe, exports the code, and titles the issue "registry could not be read" for that code, with "do not re-publish" in the body; RUNBOOK 3a is the human's half (`tests/test_registry_verify_retries_an_unanswered_read.py`) |
 | L-97 | 2026-10-01, after releasing 1.108.321 | `scripts/repair-munch-installs.ps1` did not run under Windows PowerShell 5.1, the shell `powershell` starts. Two causes. 5.1 strips embedded double quotes from an argument passed to a native program, so the install probe's `python -c` text reached Python as a syntax error. And under `$ErrorActionPreference = 'Stop'`, 5.1 turns a native program's redirected stderr line into a terminating error, so `-Apply` reinstalled the first product and stopped at pip's first stderr line, leaving the other four untouched. No test runs the script (it needs a second shell and real installs). | `scripts/repair-munch-installs.ps1` | defect | low | FIXED 2026-10-01: the probe uses single quotes and `chr(9)`; every Python call goes through `Invoke-Py`, which lowers the preference for the call and restores it, and the install checks `$LASTEXITCODE`. Checked by hand under 5.1 (the helper alone, and by the reviewer); the whole script has not been re-run with `-Apply` |
-| L-98 | 2026-10-01, L-96 review | `scripts/registry_verify.py` checks that the body carries a list of objects and no deeper. A row whose inside is malformed (`"server": "x"`, `"_meta": "x"`, `"packages": [null]`) raises `AttributeError` out of `verdict()`, outside the retry, and the process exits 1, so the issue reads "registry publish failed". RUNBOOK 3a's no-`FAIL:`-line case routes the human correctly. Treating `AttributeError`/`TypeError` from `verdict` as no answer closes the class. Also: every test calls `main()` in-process, so nothing binds its return value to the process exit status `release.yml` reads (`sys.exit(main())` replaced by `main()` leaves the file green). | `scripts/registry_verify.py`, `tests/test_registry_verify_retries_an_unanswered_read.py` | defect | low | OPEN |
-| L-99 | 2026-10-01, L-96 review | `scripts/registry_verify.py` reads one page (`&limit=100`) and follows no cursor. The live read returned 65 rows for `io.github.jgravelle/jcodemunch-mcp` on 2026-10-01, and each release adds one. Past the page size the latest row may not be on the page, which would read as exit 1 and "registry publish failed" on a good publish. | `scripts/registry_verify.py` | defect | medium | OPEN |
+| L-98 | 2026-10-01, L-96 review | `scripts/registry_verify.py` checks that the body carries a list of objects and no deeper. A row whose inside is malformed (`"server": "x"`, `"_meta": "x"`, `"packages": [null]`) raises `AttributeError` out of `verdict()`, outside the retry, and the process exits 1, so the issue reads "registry publish failed". RUNBOOK 3a's no-`FAIL:`-line case routes the human correctly. Treating `AttributeError`/`TypeError` from `verdict` as no answer closes the class. Also: every test calls `main()` in-process, so nothing binds its return value to the process exit status `release.yml` reads (`sys.exit(main())` replaced by `main()` leaves the file green). | `scripts/registry_verify.py`, `tests/test_registry_verify_retries_an_unanswered_read.py` | defect | low | FIXED 2026-10-01: `_judge` wraps `verdict` alone and turns an `AttributeError`/`TypeError` from a row into no answer (the same types raised anywhere else are this script's bug and still raise); `test_the_process_exits_with_what_main_returns` runs the file as `__main__` for exit 0, 1 and `UNREADABLE` (`tests/test_registr
```

**File**: `scripts/registry_verify.py` (modified, +93/-10)
```diff
@@ -33,9 +33,16 @@
 UNREADABLE = 75
 
 
-def fetch(name: str) -> list[dict]:
-    url = f"{API}?search={urllib.request.quote(name)}&limit=100"
-    with urllib.request.urlopen(url, timeout=30) as r:  # noqa: S310
+MAX_PAGES = 50
+REQUEST_SECONDS = 30.0
+# The whole run, every attempt and every page. `release.yml`'s registry job is
+# cancelled at its `timeout-minutes`, and a cancelled job opens no issue at
+# all, so the script must finish, and say what it found, before that.
+BUDGET_SECONDS = 600.0
+
+
+def _page(url: str, timeout: float = REQUEST_SECONDS) -> tuple[list[dict], str | None]:
+    with urllib.request.urlopen(url, timeout=timeout) as r:  # noqa: S310
         data = json.load(r)
     if not isinstance(data, dict):
         # `null` or a list is a proxy's or an error page's body, not the registry's answer.
@@ -46,7 +53,55 @@ def fetch(name: str) -> list[dict]:
         # An error object served with a 200 (`{"error": ...}`) has no row
         # list. Read as zero rows it would be a FAIL about the publish.
         raise ValueError(f"no row list in the body (keys: {sorted(data)[:5]})")
-    return rows
+    meta = data.get("metadata")
+    if meta is None:
+        return rows, None
+    if not isinstance(meta, dict):
+        raise ValueError(f"metadata is {type(meta).__name__}, not an object")
+    cursor = meta.get("nextCursor")
+    if cursor is None:
+        return rows, None
+    if not isinstance(cursor, str) or not cursor:
+        # Read as "last page", a cursor in a shape this script does not know
+        # would end the read early and the partial read would be judged.
+        raise ValueError(f"nextCursor is {cursor!r}, not a non-empty string")
+    return rows, cursor
+
+
+def fetch(name: str, deadline: float | None = None) -> list[dict]:
+    """Every page (LEDGER L-99).
+
+    Rows come back `limit` a page, ordered by version STRING (the live
+    read ends on `1.8.6`), and `metadata.nextCursor` names the next page.
+    Which page holds the latest row is therefore not knowable from here:
+    one page of 100 held all 66 rows on 2026-10-01 and would have dropped
+    rows at 101. A page that fails fails the whole read; half a read is
+    never judged.
+    """
+    base = f"{API}?search={urllib.request.quote(name)}&limit=100"
+    rows: list[dict] = []
+    seen: set[str] = set()
+    cursor = None
+    for _ in range(MAX_PAGES):
+        url = (
+            base
+            if cursor is None
+            else f"{base}&cursor={urllib.request.quote(cursor, safe='')}"
+        )
+        timeout = REQUEST_SECONDS
+        if deadline is not None:
+            left = deadline - time.monotonic()
+            if left <= 0:
+                raise TimeoutError("the time budget ran out before the last page")
+            timeout = min(REQUEST_SECONDS, left)
+        page, cursor = _page(url, timeout)
+        rows.extend(page)
+        if cursor is None:
+            return rows
+        if cursor in seen:
+            raise ValueError(f"the cursor did not advance ({cursor!r})")
+        seen.add(cursor)
+    raise ValueError(f"more than {MAX_PAGES} pages")
 
 
 def verdict(rows: list[dict], name: str, version: str) -> tuple[bool, list[str]]:
@@ -81,6 +136,19 @@ def verdict(rows: list[dict], name: str, version: str) -> tuple[bool, list[str]]
     return True, lines + ["PASS"]
 
 
+def _judge(rows: list[dict], name: str, version: str) -> tuple[bool, list[str]]:
+    """`verdict`, with a row it cannot read turned into no answer (LEDGER L-98).
+
+    Only `verdict` is wrapped. An AttributeError or TypeError anywhere else is
+    a bug in this script and must raise with its traceback, not be retried six
+    times and reported as a registry that could not be read.
+    """
+    try:
+        return verdict(rows, name, version)
+    except (AttributeError, TypeError) as exc:
+        raise ValueError(f"malformed row ({type(exc).__name__}: {exc})") from exc
+
+
 def main(argv=None) -> int:
     ap = argparse.ArgumentParser()
     ap.add_argument("--version", required=True)
@@ -89,26 +157,39 @@ def main(argv=None) -> int:
     ap.add_argument(
         "--delay", type=float, default=20.0, help="seconds between attempts"
     )
+    ap.add_argument(
+        "--budget",
+        type=float,
+        default=BUDGET_SECONDS,
+        help="seconds for the whole run, every attempt and every page",
+    )
     a = ap.parse_args(argv)
     attempts = max(a.attempts, 1)
+    deadline = time.monotonic() + a.budget
     answered: list[str] = []
+    made = 0
     for attempt in range(1, attempts + 1):
         if attempt > 1:
+            if time.monotonic() + a.delay >= deadline:
+                print(f"the {a.budget:g} s budget is spent after {made} attempt(s)")
+                break
             time.sleep(a.delay)
+        made = attempt
         try:
-            rows = fetch(a.name)
+            rows = fetch(a.name, deadline)
+            ok, lines = _judge(rows, a.name, a.version)
         
```

**File**: `tests/test_registry_verify_reads_every_page.py` (added, +331/-0)
```diff
@@ -0,0 +1,331 @@
+"""The registry verify reads every page, and a row it cannot read is not an answer (LEDGER L-99, L-98).
+
+The registry returns `limit` rows a page, ordered by version string, with
+`metadata.nextCursor` naming the next page. `scripts/registry_verify.py` read
+one page of 100 and followed no cursor: 66 rows on 2026-10-01, one more per
+release, so past the page size the latest row can be on a page nobody asked
+for and a good publish reads "none marked isLatest".
+
+L-98 is the same script one level down: a row whose inside is malformed raised
+out of `verdict()`, outside the retry, and the process exited 1. And every test
+called `main()` in-process, so nothing bound its return value to the exit
+status `release.yml` reads; the last test runs the file the way the workflow
+does.
+"""
+
+from __future__ import annotations
+
+import importlib.util
+import io
+import json
+import runpy
+import sys
+import time
+import types
+import urllib.parse
+import urllib.request
+from pathlib import Path
+
+import pytest
+
+ROOT = Path(__file__).resolve().parent.parent
+SCRIPT = ROOT / "scripts" / "registry_verify.py"
+NAME = "io.github.jgravelle/jcodemunch-mcp"
+META = "io.modelcontextprotocol.registry/official"
+_REAL_SLEEP, _REAL_MONOTONIC = time.sleep, time.monotonic
+
+
+@pytest.fixture()
+def rv(monkeypatch):
+    spec = importlib.util.spec_from_file_location(
+        "registry_verify_pages_under_test", SCRIPT
+    )
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    # The module's own `time` name, not the real module's attribute (F-40).
+    monkeypatch.setattr(
+        mod,
+        "time",
+        types.SimpleNamespace(sleep=lambda s: None, monotonic=time.monotonic),
+    )
+    return mod
+
+
+def _row(version: str, latest: bool = False) -> dict:
+    return {
+        "server": {
+            "name": NAME,
+            "version": version,
+            "packages": [{"version": version}],
+        },
+        "_meta": {META: {"isLatest": latest}},
+    }
+
+
+def _paged(monkeypatch, pages: dict[str | None, dict]):
+    """Serve `pages` keyed by the cursor the request carries (None: no cursor)."""
+    asked = []
+
+    def urlopen(url, timeout=None):
+        q = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
+        cursor = (q.get("cursor") or [None])[0]
+        asked.append(cursor)
+        return io.BytesIO(json.dumps(pages[cursor]).encode())
+
+    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
+    return asked
+
+
+def test_the_fixture_leaves_the_process_clock_alone(rv):
+    """The script's `time` NAME is replaced, never an attribute of the real module.
+
+    The first form of this fixture set `time.sleep` on the module every thread
+    in the worker shares. `tests/test_v1_108_182.py` abandons a provider thread
+    that sleeps 10 ms at a time for 30 s; under xdist it called the fake 258,047
+    times in one test and `len(slept) == 1` failed on two CI legs (harness
+    FINDINGS F-40). Each of those sleeps also returned at once.
+    """
+    assert rv.time is not time
+    assert time.sleep is _REAL_SLEEP and time.monotonic is _REAL_MONOTONIC
+
+
+def test_the_latest_row_on_a_later_page_is_found(rv, monkeypatch, capsys):
+    asked = _paged(
+        monkeypatch,
+        {
+            None: {
+                "servers": [_row("9.9.7"), _row("9.9.8")],
+                "metadata": {"nextCursor": "c1", "count": 2},
+            },
+            "c1": {"servers": [_row("9.9.9", latest=True)], "metadata": {"count": 1}},
+        },
+    )
+    assert rv.main(["--version", "9.9.9", "--attempts", "1"]) == 0
+    assert asked == [None, "c1"]
+    assert "3 row(s)" in capsys.readouterr().out
+
+
+def test_a_cursor_that_does_not_advance_is_no_answer(rv, monkeypatch, capsys):
+    """A page that names itself as the next page would loop for ever."""
+    asked = _paged(
+        monkeypatch,
+        {
+            None: {"servers": [_row("9.9.8")], "metadata": {"nextCursor": "c1"}},
+            "c1": {"servers": [_row("9.9.8")], "metadata": {"nextCursor": "c1"}},
+        },
+    )
+    assert rv.main(["--version", "9.9.9", "--attempts", "1"]) == rv.UNREADABLE
+    assert asked == [None, "c1"]
+    assert "FAIL" not in capsys.readouterr().out
+
+
+def test_cursors_that_never_end_are_no_answer(rv, monkeypatch, capsys):
+    """Every cursor is new, so the repeat check never fires; the page cap is what stops it."""
+    asked = []
+
+    def urlopen(url, timeout=None):
+        asked.append(url)
+        # With the cap gone the script would ask for ever; fail by name instead of hanging.
+        assert len(asked) <= rv.MAX_PAGES + 1, "the script asked past its page cap"
+        body = {
+            "servers": [_row("9.9.8")],
+            "metadata": {"nextCursor": f"c{len(asked)}"},
+        }
+        return io.BytesIO(json.dumps(body).encode())
+
+    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
+    assert rv.main(["
```

**File**: `tests/test_registry_verify_retries_an_unanswered_read.py` (modified, +46/-1)
```diff
@@ -19,6 +19,9 @@
 import io
 import json
 import re
+import threading
+import time
+import types
 import urllib.error
 from pathlib import Path
 
@@ -27,6 +30,7 @@
 ROOT = Path(__file__).resolve().parent.parent
 NAME = "io.github.jgravelle/jcodemunch-mcp"
 META = "io.modelcontextprotocol.registry/official"
+_REAL_SLEEP, _REAL_MONOTONIC = time.sleep, time.monotonic
 
 
 @pytest.fixture()
@@ -37,7 +41,12 @@ def rv(monkeypatch):
     mod = importlib.util.module_from_spec(spec)
     spec.loader.exec_module(mod)
     mod.slept = []
-    monkeypatch.setattr(mod.time, "sleep", mod.slept.append)
+    # The module's own `time` name, not the real module's attribute (F-40).
+    monkeypatch.setattr(
+        mod,
+        "time",
+        types.SimpleNamespace(sleep=mod.slept.append, monotonic=time.monotonic),
+    )
     return mod
 
 
@@ -68,6 +77,42 @@ def urlopen(url, timeout=None):
     return calls
 
 
+def test_the_fixture_leaves_the_process_clock_alone(rv):
+    """The script's `time` NAME is replaced, never an attribute of the real module.
+
+    The first form of this fixture set `time.sleep` on the module every thread
+    in the worker shares. `tests/test_v1_108_182.py` abandons a provider thread
+    that sleeps 10 ms at a time for 30 s; under xdist it called the fake 258,047
+    times in one test and `len(slept) == 1` failed on two CI legs (harness
+    FINDINGS F-40). Each of those sleeps also returned at once.
+    """
+    assert rv.time is not time
+    assert time.sleep is _REAL_SLEEP and time.monotonic is _REAL_MONOTONIC
+
+
+def test_a_thread_sleeping_elsewhere_does_not_reach_the_fixture(
+    rv, monkeypatch, capsys
+):
+    """F-40 reproduced on purpose: another test's leftover thread sleeps while this one runs."""
+    stop = threading.Event()
+
+    def napper():
+        while not stop.is_set():
+            time.sleep(0.001)
+
+    t = threading.Thread(target=napper, daemon=True)
+    t.start()
+    try:
+        _serve(rv, monkeypatch, [TimeoutError("timed out"), _payload("9.9.9")])
+        assert rv.main(["--version", "9.9.9"]) == 0
+        _REAL_SLEEP(0.05)
+    finally:
+        stop.set()
+        t.join(5)
+    assert not t.is_alive()
+    assert rv.slept == [20.0], f"{len(rv.slept)} sleeps recorded"
+
+
 def test_one_timed_out_read_does_not_fail_a_good_publish(rv, monkeypatch, capsys):
     calls = _serve(rv, monkeypatch, [TimeoutError("timed out"), _payload("9.9.9")])
     assert rv.main(["--version", "9.9.9"]) == 0
```

---

### Incident Patch 14: `2a0acb56` (2026-10-01)
**Commit Message**: fix: a registry read that got no answer is not a publish that failed (LEDGER L-96) (#955)

* fix: a registry read that got no answer is not a publish that failed (LEDGER L-96)

registry_verify.py retries the read and exits 2 (UNREADABLE) when no attempt
was answered, 1 when the registry answered with the wrong row. release.yml
runs it without a pipe, exports the code and titles its issue from it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* review: every spelling of an unanswered read is UNREADABLE, and the code is one nothing else exits with

http.client.HTTPException and a non-object JSON body escaped the retry and
exited 1. UNREADABLE moves from 2 (argparse, a missing file) to 75. The two
workflow tests keep their names and now bind each title to its branch and the
step's exit to the script's code; the weaker assertions they replace passed
with the branches swapped (Practice 9). RUNBOOK 3a is the human's half.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* review: the verify step survives bash -e without set +e, and a body with no row list is no answer

The step used set +e around the run; removing it reproduced L-96 with every
test green. It now reads the code

**File**: `.github/workflows/release.yml` (modified, +19/-4)
```diff
@@ -380,15 +380,30 @@ jobs:
           fi
           ./mcp-publisher publish
       - name: Verify the registry row (nested shape; a flat read returns 0 rows on a good publish)
+        id: verify
         if: needs.preflight.outputs.dry_run != 'true'
         shell: bash
         run: |
-          python scripts/registry_verify.py --version "${{ needs.preflight.outputs.version }}" | tee -a "$GITHUB_STEP_SUMMARY"
+          # No pipe: the script's exit code names the outcome (1 the row is wrong, 75 no read got an answer).
+          # The code is written before the summary, so a failed append cannot lose it.
+          # `|| code=$?` and not `set +e`: this shell runs with -e, and the step must reach the write below.
+          code=0
+          python scripts/registry_verify.py --version "${{ needs.preflight.outputs.version }}" > verify.txt 2>&1 || code=$?
+          echo "code=$code" >> "$GITHUB_OUTPUT"
+          cat verify.txt
+          cat verify.txt >> "$GITHUB_STEP_SUMMARY"
+          exit "$code"
       - name: Open an issue (PyPI is live; the registry is a follow-up, not a rollback)
         if: failure()
         env:
           GH_TOKEN: ${{ github.token }}
         run: |
-          gh issue create --repo "${{ github.repository }}" --label release \
-            --title "registry publish failed for v${{ needs.preflight.outputs.version }}" \
-            --body "Run: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}. PyPI and the GitHub release are live. Fallback is the cmd.exe line in CLAUDE.md (Registry verification reads a NESTED row)."
+          if [ "${{ steps.verify.outputs.code }}" = "75" ]; then
+            gh issue create --repo "${{ github.repository }}" --label release \
+              --title="registry could not be read after publishing v${{ needs.preflight.outputs.version }}" \
+              --body "Run: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}. PyPI and the GitHub release are live, and the publish step passed. No read of the registry got an answer, so nothing here says the publish failed. Run scripts/registry_verify.py again (docs/cicd/RUNBOOK.md section 3a); do not re-publish on this issue."
+          else
+            gh issue create --repo "${{ github.repository }}" --label release \
+              --title="registry publish failed for v${{ needs.preflight.outputs.version }}" \
+              --body "Run: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}. PyPI and the GitHub release are live. Read the failed step first: a verify that answered with the wrong row and a publish step that failed are different. Never re-publish on a zero-row read (docs/cicd/RUNBOOK.md section 3a). Fallback is the cmd.exe line in CLAUDE.md (Registry verification reads a NESTED row)."
+          fi
```

**File**: `docs/cicd/RUNBOOK.md` (modified, +32/-0)
```diff
@@ -129,6 +129,38 @@ PyPI has the version and cannot be re-uploaded. Do not yank from a script.
    check was wrong, fix the check in a PR and close the issue with the run
    link. Either way the issue records the decision.
 
+## 3a. The registry job failed (a `release` issue was opened)
+
+PyPI and the GitHub release are live. Nothing is rolled back. The issue's
+title says which of two things happened (LEDGER L-96).
+
+1. **"registry could not be read after publishing vX.Y.Z".** The publish step
+   passed. No read of the registry got an answer: `scripts/registry_verify.py`
+   exited with its `UNREADABLE` code after every attempt timed out, was cut,
+   got an HTTP error status, or returned a body that was not the registry's.
+   This says nothing about the publish. Read the registry again:
+
+   ```
+   cd /d C:\MCPs\jcodemunch-mcp && python scripts\registry_verify.py --version X.Y.Z
+   ```
+
+   `PASS`: close the issue with that output. Do not re-publish.
+   `UNREADABLE` again: the registry is still not answering; wait and run it
+   again. `FAIL:` lines: the registry answered; go to item 2's first case.
+2. **"registry publish failed for vX.Y.Z".** Open the run and read which step
+   failed.
+   - The verify step failed with `FAIL:` lines: the registry answered and the
+     row is wrong. Run the line above. A zero-row read is the parse or the
+     name, never the publish. If the latest row is still the previous version,
+     the publish did not take; use the publish line in CLAUDE.md ("Registry
+     verification reads a NESTED row").
+   - The install or the publish step failed: the verify step never ran. Run
+     the line above first; publish by hand only if it does not read `PASS`.
+   - The verify step failed with no `FAIL:` line (a traceback, a usage
+     error): the script broke, and nothing was learned about the registry.
+     Run the line above; fix the script in a PR.
+3. The issue records what was run and what it printed.
+
 ## 4. PyPI quarantine or index trouble
 
 - **Quarantine / account block** (it happened 2026-06): the pipeline's
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -810,6 +810,7 @@ Key: LOAD-BEARING = a committed test or CI job reads it; STRUCTURAL = documented
 | `tests/test_competitive_checks.py` | The competitive tier's fairness checks (DESIGN s3.3, s4.3, s10): corpus_check's five criteria each failing ALONE over synthetic descriptions with every threshold read from `corpus_policy.json`; the policy file complete and a missing key refusing; corpora.json pinned by full SHA with a domain; every task file's corpus a set member or self@HEAD, with the P1/P2/P4 shapes; the task generators' definition-line verification refusing a moved line and their grep rules; task_check's symmetric split, the check's three refusals, and tools_not_called naming only the silent tool; the sandbox kill WAITS for the exit after a delivered kill and not after a failed one (CF-65: `docker kill` returns on delivery, and `docker ps` the instant after listed a timed-out container once in the eight gate runs of 2026-09-07; the test passed in the other seven); the live-container test's skip gate asks `sandbox.docker_available()` (CF-68: a copy that only asked whether `docker info` succeeds ran it on a windows-latest runner in Windows-container mode and failed PR #681's gate), with a daemon-free test that reports a Windows daemon and asserts the skip and the question, and a ratchet over every test file for a re-derived `docker info`. | competitive PR 3a (2026-09-06), CF-65 (2026-09-07), CF-68 (2026-09-13); docstring | 1 | LOAD-BEARING | competitive layer; the checkouts are not needed (nothing here fetches) |
 | `tests/test_workflow_commit_identity.py` | Every `user.email` a workflow commits or tags under is the numeric `<id>+<login>@users.noreply.github.com` form of an account we own. `main.yml` committed the weekly results as `harness-bot@users.noreply.github.com`, which GitHub resolved to a stranger's account (created 2026-05-18), so CLA Assistant reported the PR unsigned and it sat BLOCKED with every check green; `release.yml`'s tagger `release-bot` (an account since 2014) and the five inbound/competitive workflows' `inbound` (since 2012) are the same shape. The allowlist is by site and names the finding that owns it (IN-20), and a third test fails when an allowlisted site stops carrying the address. Red against main's two workflows: 2 failed. IN-21 (2026-09-09): the scanner reads every spelling git accepts, `user.email` with `=` or whitespace, `GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_EMAIL` with `:` or `=`, and the email in `--author`'s angle brackets, with nine spellings each carrying a stranger's address run through it and a script argument named `--author` refused; red over main's scanner: 7 of the nine failed. | cicd FINDINGS C-17 (2026-09-07), reviewer round 3 of #634; docstring | 1 | LOAD-BEARING | cicd layer; reads `.github/workflows/*.yml` only |
 | `tests/test_release_install_is_its_own_probe.py` | A step that installs a just-published version from a remote index must retry THAT INSTALL, not gate on a readiness probe of another endpoint. `release.yml`'s `post-publish` polled `pypi.org/pypi/<pkg>/<version>/json` (the JSON API) and then installed through the `/simple/` index; separately cached, so the JSON API answered 200 on the first iteration and the install failed 13 s after the upload finished on v1.108.319, giving up in under a second against a ten-minute budget, skipping the GitHub release and the MCP registry publish and opening P0 #706/#707. The step was named "poll up to 10 min" and never polled. Four properties plus a non-vacuity scan: the install retries itself, no step gates an install on a PyPI URL it does not install from, an exhausted retry still fails (the `if` that enables the retry swallows the last status), and a step name promising a wait has a loop. Red against main's `release.yml` with the SHIPPED file, pasted from `.claude/state/evidence/red.txt` rather than described (the count in this cell was typed and wrong twice -- first `2 failed` from a capture that predated `test_an_exhausted_retry_still_fails`, then a `two and two` split against a measured three and one): **4 failed**, the four being `test_a_remote_install_retries_itself[post-publish]`, `test_no_step_gates_an_install_on_a_different_endpoint[post-publish]`, `test_an_exhausted_retry_still_fails[smoke-testpypi]`, `test_an_exhausted_retry_still_fails[post-publish]` -- so 3 on `post-publish` and 1 on `smoke-testpypi`. ⚠⚠ **The PASSED count is deliberately not quoted here.** It is an artifact of how many spellings happen to be pinned, says nothing about the defect, and quoting it coupled every future test in that file to an edit of BOTH these records -- which is where two of this PR's own defects came from, each created while correcting something else rather than by the original work, whose retry had no `uv pip show` guard on main either. | cicd FINDINGS C-19 (2026-09-16), #709; docstring | 1 | LOAD-BEARING | cicd layer; reads `.github/workflows/release.yml` only. ⚠⚠ **STATED GAP: a package name held in a shell vari
```

**File**: `docs/harness/FINDINGS.md` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ the tests that carry them.
 | F-36 | **The ledger's side of W-49, which is the record.** `test_edit_guard` demanded a `harness/retired.json` row for a CONDITIONAL `pytest.skip(` added beside a test this branch had itself introduced, so nothing was retired and the row would have been a FALSE entry -- and this is the one file where a false entry is worse than a warning, because every later reader treats it as history. The hook's rule, its two blind spots and why the obvious remedy fires identically are in `docs/workflows/FINDINGS.md` **W-49**, beside W-30 on the same hook, which is where a reader of `test_edit_guard.py` lands. ⚠ Kept to a pointer deliberately: the first draft restated three of W-49's claims here, nothing in this tree watches two FINDINGS rows for drift (`test_key_files_split.py` and `test_cli_env_split.py` exist because that has been paid for twice), and one copy of each claim is not optional. |
 | F-37 | **DoD 11's "in its own commit" is unenforced, and the record shows it.** STANDARD.md item 11 asks for a `harness/retired.json` entry in its own commit; `dod_checklist.py` row 11 checks that the entry EXISTS and the ledger test passes, never which commit carries it, and `pre_commit.py` runs on one commit at a time and cannot see the split. On 2026-09-23 the #833 fix (`b1ffdbba`) carried its retirement entry beside `src/` and the tests, exactly as `fbd6b5b0` (#812's audit retirement) had the day before; both were caught by a reviewer reading `git show --stat`, not by any gate. ⚠ The rule's purpose is that a retirement is REVIEWABLE apart from the fix; on a squash-merged branch the two commits collapse to one on `main` regardless, so the only reader the split serves is the PR reviewer, who has the ledger diff in hand either way. ⚠⚠ Recorded rather than silently tolerated: a rule that two consecutive fixes broke without a gate firing is either a rule the checklist should enforce (row 11 reads `git log -- harness/retired.json` and refuses an entry whose commit also touches `src/`) or a rule to strike from STANDARD.md; a third unenforced instance should settle which. ⚠⚠ **Measured on the third review round of #833: the clause is UNSATISFIABLE under the commit hook, not merely unenforced.** `tests/test_retirement_ledger.py::test_every_ledger_entry_names_a_test_that_actually_left_this_branch` runs in the fast tier that `pre_commit.py` requires of every commit and compares the working tree against the merge base, so a ledger entry committed BEFORE the deletion names a test that has not left (refused), and the deletion committed BEFORE the entry is a retirement with no ledger row (refused). The two halves can only arrive together, which is what W-31/#797 already recorded about the hook's timing. The rule and the gate contradict each other, and the remedy is a STANDARD.md edit (strike "in its own commit", or say "in the same commit as the deletion and no other change"), which is the maintainer's. | `docs/standard/STANDARD.md` item 11, `.claude/hooks/dod_checklist.py` row 11, `tests/test_retirement_ledger.py` | OPEN, handed to the maintainer with #833's PR; the two instances are `fbd6b5b0` and `b1ffdbba`. |
 | F-38 | `suite.full_seconds_ci_windows` failed a leg whose tests all passed. PR #946 (run 36767909287, `full: test (windows-latest, 3.11)`, head 11c9f611): `13940 passed, 25 skipped ... in 1076.37s`, the Floor line `observed 1078.7` against its Floor. The diff is two `release.yml` install lines, the RUNBOOK and one test, so it cannot move suite runtime. The other three windows legs of the same run took 650, 764 and 775 s as whole jobs, and this one 1109 s (`gh run view 36767909287`). ⚠ The Floor was set on 2026-09-04 from four legs of one commit (median 516.3 s, x2, the entry's own `set_at`); the suite has grown since, to 13,965 collected here, so the margin over a typical leg has narrowed with the suite, not with the runner. | `harness/thresholds.json` `suite.full_seconds_ci_windows`, `harness/__main__.py::_full_wall_floor_id` | OPEN. One occurrence, and the tolerance rule (`docs/harness/DESIGN.md`) moves a timing Floor only on three CI runs, never on one flake: the failed job is re-run and the Floor stays. The candidate, if it recurs: re-set from the windows legs' pytest seconds of three green runs at today's suite size, recorded the way `self_latency_ci_runs_2026-09-22.json` was. |
+| F-39 | `suite.full_seconds` failed an ubuntu leg whose tests all passed. PR #955 (run 36900539828, `full: test (ubuntu-latest, 3.10)`, head 59d353b3): `14012 passed, 28 skipped ... in 358.03s`, the Floor line `observed 360.94` against `<= 360`. The diff is a release script, two `release.yml` steps, the RUNBOOK and one test file of 21 fast tests, so it cannot move suite runtime. The other three ubuntu legs of the same run read `observed 186.03` (3.12), `230.78` (3.13) and `342.14` (3.11): one tree, a spread of almost 2x between runners, and two of four legs within 20 s of the Floor. ⚠ The same Floo
```

**File**: `docs/workflows/LEDGER.md` (modified, +3/-1)
```diff
@@ -144,5 +144,7 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-93 | 2026-09-30, releasing 1.108.320 | `release.yml`'s retried installs (`smoke-testpypi`, `post-publish`) re-read `uv`'s cached index page on every attempt. Run 36759801785: the ubuntu smoke asked Test PyPI at 18:37:59, 13 s after the upload finished, got a page not yet listing 1.108.320, and spent its ten-minute budget re-reading that cached page twenty times; windows asked at 18:38:15 and installed first try. The run stopped before the tag and PyPI; a rerun of the failed job on a fresh runner recovered it. C-19 made the install its own probe, and the probe never asked again. | `.github/workflows/release.yml` | defect | medium | FIXED 2026-09-30 (both loops pass `--refresh-package jcodemunch-mcp`; `tests/test_release_install_is_its_own_probe.py` requires a refresh on every retried remote install) |
 | L-94 | 2026-10-01, L-90 | The deletion investigator's `_split_importers_by_liveness` counts an importer with no importers of its own as unreachable, and an entry point has none by construction. A name imported only by `main.py`, or by the file `package.json`'s `main` names, reads `export_not_imported` SATISFIED with the evidence "Imported only by main.py, which is itself unreachable" (measured on both L-90 fixtures before each importer was given an importer). It should ask `tools/_entry_points.entry_point_spec` and the Python entry-point filenames before it calls an importer dead. The investigator is not an MCP tool. | `src/jcodemunch_mcp/investigator/deletion_safety.py` | defect | medium | OPEN |
 | L-95 | 2026-10-01, L-90 | `find_references` compares import names with `n.lower() == ident_lower` at two sites, not through `check_references._fold`, so an import in another Unicode form or written with an escape is absent from the import-graph answer while `check_references` finds it. A third comparison site the fold does not reach; the fix is the shared fold. | `src/jcodemunch_mcp/tools/find_references.py` | defect | low | OPEN |
-| L-96 | 2026-10-01, releasing 1.108.321 | `scripts/registry_verify.py` makes ONE request with a 30 s timeout and no retry, and `release.yml` opens a "registry publish failed" issue when the step fails. On the 1.108.321 run the publish succeeded, the verify read timed out once, the run read Failure and #952 was opened against a registry that already carried the version as `isLatest`. A read that could not be made is not a publish that failed: retry the read, and name the two outcomes apart in the issue title. | `scripts/registry_verify.py`, `.github/workflows/release.yml` | defect | medium | OPEN |
+| L-96 | 2026-10-01, releasing 1.108.321 | `scripts/registry_verify.py` makes ONE request with a 30 s timeout and no retry, and `release.yml` opens a "registry publish failed" issue when the step fails. On the 1.108.321 run the publish succeeded, the verify read timed out once, the run read Failure and #952 was opened against a registry that already carried the version as `isLatest`. A read that could not be made is not a publish that failed: retry the read, and name the two outcomes apart in the issue title. | `scripts/registry_verify.py`, `.github/workflows/release.yml` | defect | medium | FIXED 2026-10-01: the script retries the read (and a wrong row, which the registry can serve for a moment after a publish) and exits 1 when the registry answered wrong, `UNREADABLE` (a code argparse and a missing file do not share) when no attempt got an answer; `release.yml` runs it without a pipe, exports the code, and titles the issue "registry could not be read" for that code, with "do not re-publish" in the body; RUNBOOK 3a is the human's half (`tests/test_registry_verify_retries_an_unanswered_read.py`) |
 | L-97 | 2026-10-01, after releasing 1.108.321 | `scripts/repair-munch-installs.ps1` did not run under Windows PowerShell 5.1, the shell `powershell` starts. Two causes. 5.1 strips embedded double quotes from an argument passed to a native program, so the install probe's `python -c` text reached Python as a syntax error. And under `$ErrorActionPreference = 'Stop'`, 5.1 turns a native program's redirected stderr line into a terminating error, so `-Apply` reinstalled the first product and stopped at pip's first stderr line, leaving the other four untouched. No test runs the script (it needs a second shell and real installs). | `scripts/repair-munch-installs.ps1` | defect | low | FIXED 2026-10-01: the probe uses single quotes and `chr(9)`; every Python call goes through `Invoke-Py`, which lowers the preference for the call and restores it, and the install checks `$LASTEXITCODE`. Checked by hand under 5.1 (the helper alone, and by the reviewer); the whole script has not been re-run with `-Apply` |
+| L-98 | 2026-10-01, L-96 review | `scripts/registry_verify.py` checks that the body carries a list of objects and no deeper. A row whose inside is malformed (`"server": "x"`, `"_meta": "x"`, `"packages"
```

**File**: `scripts/registry_verify.py` (modified, +59/-4)
```diff
@@ -9,23 +9,44 @@
 survives `&limit=100`. Never re-publish on a zero-row read; fix the parse.
 Exit 1 unless a row with `server.version == X` exists, is marked latest, and
 its `packages[].version` advanced too.
+
+The read is retried, and the exit code says which thing went wrong (LEDGER
+L-96). 1: the registry ANSWERED and the row is wrong. `UNREADABLE` (75, the
+sysexits temporary-failure code): no attempt got an answer, which says nothing
+about the publish. Not 2: argparse and a missing script file both exit 2, and
+`release.yml` titles an issue from this code. One read with no
+retry timed out after the 1.108.321 publish had succeeded, and `release.yml`
+opened "registry publish failed" over it.
 """
 
 from __future__ import annotations
 
 import argparse
+import http.client
 import json
 import sys
+import time
+import urllib.error
 import urllib.request
 
 API = "https://registry.modelcontextprotocol.io/v0/servers"
+UNREADABLE = 75
 
 
 def fetch(name: str) -> list[dict]:
     url = f"{API}?search={urllib.request.quote(name)}&limit=100"
     with urllib.request.urlopen(url, timeout=30) as r:  # noqa: S310
         data = json.load(r)
-    return data.get("servers") or data.get("items") or []
+    if not isinstance(data, dict):
+        # `null` or a list is a proxy's or an error page's body, not the registry's answer.
+        raise ValueError(f"body is {type(data).__name__}, not an object")
+    key = next((k for k in ("servers", "items") if k in data), None)
+    rows = data.get(key) if key else None
+    if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
+        # An error object served with a 200 (`{"error": ...}`) has no row
+        # list. Read as zero rows it would be a FAIL about the publish.
+        raise ValueError(f"no row list in the body (keys: {sorted(data)[:5]})")
+    return rows
 
 
 def verdict(rows: list[dict], name: str, version: str) -> tuple[bool, list[str]]:
@@ -64,10 +85,44 @@ def main(argv=None) -> int:
     ap = argparse.ArgumentParser()
     ap.add_argument("--version", required=True)
     ap.add_argument("--name", default="io.github.jgravelle/jcodemunch-mcp")
+    ap.add_argument("--attempts", type=int, default=6)
+    ap.add_argument(
+        "--delay", type=float, default=20.0, help="seconds between attempts"
+    )
     a = ap.parse_args(argv)
-    ok, lines = verdict(fetch(a.name), a.name, a.version)
-    print("\n".join(lines))
-    return 0 if ok else 1
+    attempts = max(a.attempts, 1)
+    answered: list[str] = []
+    for attempt in range(1, attempts + 1):
+        if attempt > 1:
+            time.sleep(a.delay)
+        try:
+            rows = fetch(a.name)
+        except (OSError, http.client.HTTPException, ValueError) as exc:
+            # URLError, HTTPError and a socket timeout are OSError; a cut or
+            # malformed response (IncompleteRead, BadStatusLine) is
+            # HTTPException and NOT OSError; a body that is not a JSON
+            # object carrying a row list is ValueError. None of them is an
+            # answer.
+            print(
+                f"attempt {attempt}: no answer ({type(exc).__name__}: {exc})",
+                flush=True,
+            )
+            continue
+        ok, answered = verdict(rows, a.name, a.version)
+        if ok:
+            print("\n".join(answered))
+            return 0
+        # A wrong row is asked again too: the registry can serve the old
+        # version for a moment after a publish.
+        print(f"attempt {attempt}: {answered[-1]}")
+    if answered:
+        print("\n".join(answered))
+        return 1
+    print(
+        f"UNREADABLE: the registry gave no answer in {attempts} attempt(s). "
+        "This is not evidence about the publish; read the registry again before any re-publish."
+    )
+    return UNREADABLE
 
 
 if __name__ == "__main__":
```

**File**: `tests/test_registry_verify_retries_an_unanswered_read.py` (added, +253/-0)
```diff
@@ -0,0 +1,253 @@
+"""A registry read that got no answer is not a publish that failed (LEDGER L-96).
+
+`scripts/registry_verify.py` made one request with a 30 s timeout. On the
+1.108.321 release the publish succeeded, that one read timed out, the run read
+Failure and `release.yml` opened "registry publish failed" (#952) against a
+registry already serving the version as latest.
+
+The script now retries, and it separates the two outcomes by exit code: 1 when
+the registry ANSWERED and the row is wrong, `UNREADABLE` when no attempt got an
+answer (a code argparse and a missing file do not share).
+`release.yml` titles its issue from that code, so nobody is told to re-publish
+over a read that never happened.
+"""
+
+from __future__ import annotations
+
+import http.client
+import importlib.util
+import io
+import json
+import re
+import urllib.error
+from pathlib import Path
+
+import pytest
+
+ROOT = Path(__file__).resolve().parent.parent
+NAME = "io.github.jgravelle/jcodemunch-mcp"
+META = "io.modelcontextprotocol.registry/official"
+
+
+@pytest.fixture()
+def rv(monkeypatch):
+    spec = importlib.util.spec_from_file_location(
+        "registry_verify_under_test", ROOT / "scripts" / "registry_verify.py"
+    )
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    mod.slept = []
+    monkeypatch.setattr(mod.time, "sleep", mod.slept.append)
+    return mod
+
+
+def _payload(version: str) -> io.BytesIO:
+    row = {
+        "server": {
+            "name": NAME,
+            "version": version,
+            "packages": [{"version": version}],
+        },
+        "_meta": {META: {"isLatest": True}},
+    }
+    return io.BytesIO(json.dumps({"servers": [row]}).encode())
+
+
+def _serve(rv, monkeypatch, answers):
+    """Each call to urlopen takes the next answer: an exception to raise or a body to return."""
+    calls = []
+
+    def urlopen(url, timeout=None):
+        calls.append(url)
+        a = answers[min(len(calls), len(answers)) - 1]
+        if isinstance(a, BaseException):
+            raise a
+        return a
+
+    monkeypatch.setattr(rv.urllib.request, "urlopen", urlopen)
+    return calls
+
+
+def test_one_timed_out_read_does_not_fail_a_good_publish(rv, monkeypatch, capsys):
+    calls = _serve(rv, monkeypatch, [TimeoutError("timed out"), _payload("9.9.9")])
+    assert rv.main(["--version", "9.9.9"]) == 0
+    assert len(calls) == 2 and len(rv.slept) == 1
+    assert "PASS" in capsys.readouterr().out
+
+
+def test_a_registry_that_never_answers_is_unreadable_not_failed(
+    rv, monkeypatch, capsys
+):
+    calls = _serve(rv, monkeypatch, [urllib.error.URLError("no route")])
+    code = rv.main(["--version", "9.9.9", "--attempts", "3"])
+    out = capsys.readouterr().out
+    assert code == rv.UNREADABLE
+    assert len(calls) == 3
+    assert "UNREADABLE" in out and "FAIL" not in out
+    assert "re-publish" in out
+
+
+def test_a_body_that_is_not_json_is_an_unanswered_read(rv, monkeypatch, capsys):
+    _serve(rv, monkeypatch, [io.BytesIO(b"<html>502</html>"), _payload("9.9.9")])
+    assert rv.main(["--version", "9.9.9"]) == 0
+
+
+@pytest.mark.parametrize(
+    "unanswered",
+    [
+        http.client.IncompleteRead(b"{"),  # the response was cut; NOT an OSError
+        http.client.BadStatusLine("garbage"),
+        urllib.error.HTTPError("u", 503, "unavailable", None, None),
+        ConnectionResetError("reset"),
+        b"null",  # valid JSON, and not the registry's object
+        b"[]",
+        b"",
+        b'{"error": "rate limited"}',  # an object, served with a 200, with no row list
+        b'{"servers": "x"}',
+        b'{"servers": [null]}',
+    ],
+    ids=[
+        "cut",
+        "bad-status",
+        "http-503",
+        "reset",
+        "json-null",
+        "json-list",
+        "empty",
+        "error-object",
+        "rows-not-a-list",
+        "row-not-an-object",
+    ],
+)
+def test_every_spelling_of_no_answer_is_unreadable(rv, monkeypatch, capsys, unanswered):
+    answer = io.BytesIO(unanswered) if isinstance(unanswered, bytes) else unanswered
+    calls = _serve(rv, monkeypatch, [answer])
+    assert rv.main(["--version", "9.9.9", "--attempts", "2"]) == rv.UNREADABLE
+    assert len(calls) == 2
+    assert "FAIL" not in capsys.readouterr().out
+
+
+def test_the_unreadable_code_is_one_nothing_else_exits_with(rv, capsys):
+    """argparse exits 2 on a usage error and so does python on a missing file;
+    the workflow would title either "could not be read ... the publish step passed"."""
+    with pytest.raises(SystemExit) as usage:
+        rv.main([])
+    capsys.readouterr()
+    assert usage.value.code == 2
+    assert rv.UNREADABLE not in (0, 1, 2)
+
+
+def test_an_empty_row_list_is_an_answer(rv, monkeypatch, capsys):
+    """`{"servers": []}` is the registry saying it has no such server: exit 1, not UNREADABLE."""
+    _serve(rv, monkeypatch, [io.BytesIO(b'{"servers": []}')])
+    assert rv.main(["--version", "
```

---

### Incident Patch 15: `5311e47d` (2026-10-01)
**Commit Message**: fix: the deletion investigator reads the import match check_references made (LEDGER L-90) (#953)

* fix: the deletion investigator reads the import match check_references made (LEDGER L-90)

A raw name comparison re-filtered rows the fold had matched, so an import in
another Unicode form or written with an escape read export_not_imported
SATISFIED. The filter reads match_type now.

Also: repair-munch-installs.ps1 runs under Windows PowerShell 5.1 (the probe
lost its double quotes; native stderr aborted the run), and LEDGER L-94, L-95,
L-96 and cicd C-21 record defects found on the way.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* review: the stem test fails against the filter-dropped mutant; LEDGER L-97 records the repair script

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -2,6 +2,19 @@
 
 ## [Unreleased]
 
+### Fixed
+
+- **The deletion investigator dropped an import the reference search had found (LEDGER L-90).**
+  `check_references` compares import names through one fold, so `from shapes import` of `file`
+  spelled with the fi ligature, or with a Unicode escape, is an import of `file`. The investigator
+  then filtered those rows again with a raw `target_name in names`, lost both, and answered
+  `export_not_imported` SATISFIED for a name a live file imports. The filter was only ever meant to
+  separate a named import from a specifier-stem match, and every row already states that as
+  `match_type`. It reads that field now and compares no name of its own, so a spelling the search
+  learns later reaches the investigator with no second change. That includes one it already had:
+  the fold ignores case, so `from shapes import File` now refutes for `file` as well. It can only
+  block a delete, never permit one.
+
 ## [1.108.321] - 2026-10-01 - a call written with an escape is still a call
 
 A Java, C# or JavaScript call can spell a name with a Unicode escape, and the
```

**File**: `docs/cicd/FINDINGS.md` (modified, +1/-0)
```diff
@@ -26,3 +26,4 @@ around by weakening the harness.
 | C-18 | `main.yml`'s "results PR (weekly, Mondays)" ran on EVERY push to main that fell on a Monday, not once a week. Merging the Monday results PR is itself such a push, so #684's merge (d1e8152e, 2026-09-14 11:26Z) opened #688 for the same date, and the next two Monday merges (406a654b, 1bf251c5) failed the job at `git push` of the existing `harness-bot/results-2026-09-14` branch, turning main's run red with the harness and bench jobs green. The step now asks first: an OPEN or MERGED PR for the date (`--state all`, because the branch is deleted on merge) opens nothing; a CLOSED one does not block, so RUNBOOK section 7's close-delete-dispatch recovery still works; a branch with no open or merged PR exits green with a `::warning::` naming the hand-open route. | `tests/test_weekly_results_pr_once.py` (executes the step under bash with `gh`/`git` stubs that apply `--state`, exact `--head` and the `--jq` projection; red against main's step: 3 failed, 3 passed; `.claude/state/evidence/nonvacuity.txt` on the branch run: seven mutants of the fix, each failing an arm) | FIXED 2026-09-14; #688 closed as the duplicate |
 | C-19 | **`release: post-publish` gated its install on a readiness probe of a DIFFERENT endpoint, and skipping it skips the GitHub release and the MCP registry.** On v1.108.319 (run 35090523511) both platforms failed **13 s after the upload finished** and gave up in under a second against a ten-minute budget (`release: pypi` completed 11:38:36Z, the install step ran 11:38:49Z on ubuntu; the 250 ms often quoted is the RESOLVER's own duration inside the step, not the gap from the upload) with `No solution found when resolving dependencies: Because there is no version of jcodemunch-mcp==1.108.319`, opening P0 #706 and #707 and leaving the release half-finished -- PyPI and the tag done, `github release` and `mcp registry` SKIPPED -- behind a dispatch line that had already reported success. ⚠⚠ **The step is named "poll up to 10 min" and it did not poll.** Its loop asked `curl -fsS https://pypi.org/pypi/<pkg>/$V/json` (the JSON API) and the install that followed read the **`/simple/` index**. Two surfaces, separately cached: the JSON API answered 200 on the first iteration, the loop broke, and the install ran against an index that had not published the file yet. **The ten-minute budget was real and was never spent** -- a probe on another endpoint can only confirm readiness by luck, so this was never PyPI being slow. ⚠ The job one stage earlier had it right the whole time: `smoke from test pypi` retries the install itself inside an `if`, which both retries and keeps `set -e` from aborting on attempt one. ⚠⚠ **Polling `/simple/` instead would have worked today and rotted the moment the installer changed what it reads** -- the fix is that the install IS the probe, because a probe and a consumer cannot drift when they are the same operation. Same family as the CI-env reproduce command that never built CI's environment and Practice 6's unread Action step: the thing being verified was not the thing being run. | `.github/workflows/release.yml` `post-publish` and `smoke-testpypi`; `docs/cicd/RUNBOOK.md` section 4 (the THIRD reader of "is PyPI ready", and the one a human types -- it told the operator to re-run once the JSON API showed the version, which is the endpoint that lied) | FIXED 2026-09-16 (#709). ⚠ **v1.108.319 itself was RECOVERED the same day** and this row is not describing a missing release: run 35090523511 `run_attempt=2` re-ran the failed jobs once PyPI had propagated, post-publish succeeded 14:03:43Z, and `github release` (14:04:11Z) and `mcp registry` (14:04:37Z) both completed; verified against the live registry API with the nested-row parse (`isLatest: 1.108.319`, `packages: ['1.108.319']`). Nothing was yanked. The fix: both remote installs are their own retry loop, and each is followed by a `uv pip show` check that exits 1 with an `::error` line. ⚠ That second half is the COST of the first and was already live in `smoke-testpypi`: the `if` that makes a retry possible also swallows the last attempt's status, so an exhausted loop walked on to the handshake with nothing installed and surfaced as a confusing error from a later command. ⚠ **OPEN, not blocking (round 6): the retry check requires the install to be the `if`'s condition but NOT that the `if` sits inside a loop**, so `if ! uv pip install ...; then exit 1; fi` and the shipped shape with the `for` deleted both pass. `post-publish` is covered only because the step-name test matches on "poll"; `smoke-testpypi`'s name does not, so nothing would see its budget removed -- C-19's own harm by a different route, in the silent direction. One clause reusing the loop regex already in the file; fold it in the next time that file is opened. `tests/test_release_install_is_its_own_probe.py` holds four properties -- the install retries itself, no step gates an install on a PyPI URL it does not install
```

**File**: `docs/harness/ARCHAEOLOGY.md` (modified, +1/-0)
```diff
@@ -464,6 +464,7 @@ Criterion codes: 1 correctness, 2 token reduction, 3 freshness/caches/absence, 4
 | tests/test_release_notes_fit_the_github_limit.py | `release.yml`'s notes step renders through `scripts/release_notes.py`, never an inline script; the notes for the twelve newest released blocks and for [Unreleased] cut as a release fit GitHub's 125,000-character release body; a block that fits is verbatim; an oversized one keeps its lead, every heading and a link at the tag; a list too long for the limit says how many it cut; a missing block refuses. | LEDGER L-92 (2026-09-30), found cutting 1.108.320 | 1 | LOAD-BEARING | The inline renderer produced 335,771 characters for 1.108.320, and the job runs AFTER the PyPI publish, so the release would have half-published (`evidence/measure.txt`). Rendering [Unreleased] as if cut is the point: the next release is the one nobody has measured. |
 | tests/test_definition_exclusion_is_case_exact.py | `check_references` excludes only the lines of definitions spelled EXACTLY as the identifier: a call to `file()` inside a Java sibling `File()` is a reference and `check_delete_safe` does not certify the used `file`; asking about `File` still excludes `File`'s own lines; the target's own lines stay excluded (control); an unused `load` beside `Load` reads as referenced, the accepted cost, pinned. | LEDGER L-88 (2026-09-30), found in the L-84 review | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for the used method. 3 of 3 mutants killed (key lowered, symbol name lowered, exclusion dropped). |
 | tests/test_unicode_escapes_name_the_same_identifier.py | A call spelled with a Java/C#/ECMAScript Unicode escape (one or more `u` and four hex digits, hex in either case, every letter escaped, C#'s eight-digit `U`, ECMAScript's braced form) is a reference to the identifier it spells, and `check_delete_safe` does not grade the called Java method or JS function deletable; two escaped surrogates join into one character; a lone surrogate keeps its neighbour; the escape of another letter does not match. Java and JS fixtures are compiled/run when `javac`/`node` are present, outside the indexed tree. | LEDGER L-86 (2026-09-30), found in the L-83 review | 1 | LOAD-BEARING | Every escape is built from `chr(92)` and the fixture asserts the backslash reached disk: two drafts had their literal escapes decoded (by `printf`, then by the editing tool) and tested the plain spelling. Mutants: the braced branch absent and the surrogate join removed each fail one test (`red_review_round1.txt`); single-`u` only, lowercase hex only and the `U` branch disabled each fail one test (the L-86 reviewer's probes, both rounds, not in an evidence file). |
+| tests/test_investigator_trusts_the_folded_import_match.py | The deletion investigator refutes `export_not_imported` for an import in another Unicode form or written with an escape, and still does not count a specifier-stem match as an import of the name. | LEDGER L-90 (2026-10-01): a raw `target_name in names` re-filtered the rows `check_references` had matched through `_fold` | 1 | LOAD-BEARING | Escapes are built from `chr(92)`; each importer has its own importer because of L-94. Mutants (review, 2026-10-01): the raw comparison restored fails the two refuting tests; the filter replaced by `if r.get("matches")` fails the stem test, which passed against it until `src/app.js` gave `main.js` an importer. |
 | tests/test_references_compare_normalised_spellings.py | `check_references` finds a call or an import written in another Unicode spelling of the identifier (ligature, math-bold, fullwidth, composed vs decomposed, either side), each pair run under Python to prove it names one function, and never reports the definition's own line; `check_delete_safe` no longer certifies the live `def file()` / `ﬁle()` case; a Java sibling `ﬁle()` whose name folds to the target keeps the call to `file()` inside its body; twenty test files mentioning the name do not push the one real caller off `check_delete_safe`'s page (L-89); `fire` still does not match `file` (control). | LEDGER L-84 and L-89 (2026-09-30), found in the L-83 reviews | 1 | LOAD-BEARING | Measured `safe_to_delete` at 1.0 on main for a used function. The sibling case is review round 1's: a FOLDED definition-span exclusion removed that call and certified the used method at 1.0. 5 of 5 mutants killed (content, import names, the folded exclusion, identifier left unfolded, NFC instead of NFKC) plus L-89's (the page capped at 20 again), 6 of 6. |
 | tests/test_non_ascii_names_keep_refusing.py | A used Python function whose declared and called spellings differ only by Unicode normalisation (ligature, decomposed accent, math-bold or fullwidth letter, on either side) is never certified deletable, each pair proven to name one function by running it; the name predicate refuses non-ASCII names and admits ASCII ones (control). | LEDGER L-83 (2026-09-30), closed by design for normalising languages; the defe
```

**File**: `docs/workflows/LEDGER.md` (modified, +5/-1)
```diff
@@ -138,7 +138,11 @@ with jjg's reason. Keep the row. To promote a row to an issue, set Status to
 | L-87 | 2026-09-30, L-84 | With the reference search comparing NFKC-folded text (L-84), the reason L-83 closed by design for Python is gone: a non-ASCII Python name's calls are now found in any spelling, so `_name_reachability` could admit Python identifiers again. Lifting it means rewriting `tests/test_non_ascii_names_keep_refusing.py`, which pins the refusal, and re-running both L-83 reviews' spelling pairs through `check_delete_safe`. Rust (NFC) folds the same way. | `src/jcodemunch_mcp/tools/_name_reachability.py` | defect | low | OPEN |
 | L-88 | 2026-09-30, L-84 review | `check_references` excludes every line span of every symbol whose name matches the identifier CASE-INSENSITIVELY, but a case-sensitive language has distinct symbols there: Java `public int File() { return file(); }` beside `private int file()` skips `File`'s body as `file`'s own definition, loses the call inside it, and `check_delete_safe` grades the used `file` `safe_to_delete` at 1.0, on main. The `unspanned_files` skip drops whole files on the same comparison. The exclusion should key on the TARGET symbol's own span (its id), not on every symbol sharing its name. | `src/jcodemunch_mcp/tools/check_references.py` | defect | medium | FIXED 2026-09-30 (the exclusion matches the declared spelling exactly, case included; the target-span refinement is L-91) |
 | L-89 | 2026-09-30, L-84 review | `check_delete_safe` classified from `check_references`' content search capped at 20 files, so twenty test files that merely mention the name pushed a real same-file caller off the page and a used function graded `test_coverage_only` (#559's shape). `check_edit_safe` reads the same capped page for its blocker count, which lowers a count on an edit preflight and certifies nothing. | `src/jcodemunch_mcp/tools/check_delete_safe.py` | defect | medium | FIXED 2026-09-30 (the preflight reads every file through `check_references._check_single`; `check_edit_safe`'s count is left capped) |
-| L-90 | 2026-09-30, L-84 review | The deletion investigator (`investigator/deletion_safety.py`) re-filters `check_references`' `import_references` with a raw comparison, `target_name in (m.get("names") or [])`, so an import L-84's fold now finds (`from a import ﬁle` for `file`) is dropped there and `export_not_imported` can still read SATISFIED. Not a regression (main never matched it either): a second comparison site the fold does not reach. It should reuse `check_references._fold`, or trust the match `check_references` already made. | `src/jcodemunch_mcp/investigator/deletion_safety.py` | defect | low | OPEN |
+| L-90 | 2026-09-30, L-84 review | The deletion investigator (`investigator/deletion_safety.py`) re-filters `check_references`' `import_references` with a raw comparison, `target_name in (m.get("names") or [])`, so an import L-84's fold now finds (`from a import ﬁle` for `file`) is dropped there and `export_not_imported` can still read SATISFIED. Not a regression (main never matched it either): a second comparison site the fold does not reach. It should reuse `check_references._fold`, or trust the match `check_references` already made. | `src/jcodemunch_mcp/investigator/deletion_safety.py` | defect | low | FIXED 2026-10-01: the filter reads the `match_type` `check_references` already states (`named` against `specifier_stem`) and compares no name of its own, so an import in another Unicode form or written with an escape refutes `export_not_imported` (`tests/test_investigator_trusts_the_folded_import_match.py`) |
 | L-91 | 2026-09-30, L-88 | `check_references` still excludes the lines of EVERY definition spelled exactly like the identifier, so a use inside a same-named definition elsewhere is lost: Java class `B { int file() { return new A().file(); } }` hides B's call to `A.file` when `check_delete_safe` asks about `A.file`, and one overload calling another is hidden the same way. The fix is to exclude only the TARGET symbol's own span when the caller knows it (`check_delete_safe` and `check_edit_safe` do). ⚠ Measure first: it makes an overload's sibling declarations, and a Python property's setter, read as references, which moves many verdicts toward blocking. | `src/jcodemunch_mcp/tools/check_references.py`, `src/jcodemunch_mcp/tools/check_delete_safe.py`, `src/jcodemunch_mcp/tools/check_edit_safe.py` | defect | medium | OPEN |
 | L-92 | 2026-09-30, cutting 1.108.320 | `release.yml` published the version's CHANGELOG block verbatim as the GitHub release body, from an inline script. GitHub refuses a body over 125,000 characters, and the 1.108.320 block rendered to 335,771. The github-release job runs after the PyPI publish and the registry job needs it, so dispatching would have published to PyPI, failed the GitHub release and skipped the registry. | `.github/workflows/release.yml` | defect | medium | FIXED 2026-09-30 (`scripts/release_notes.py`: verbatim when it f
```

**File**: `scripts/repair-munch-installs.ps1` (modified, +40/-9)
```diff
@@ -57,6 +57,29 @@ $Targets = @(
 
 function Write-Head($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
 
+# ⚠⚠ EVERY call to $Python goes through this. Windows PowerShell 5.1 turns
+#    each stderr line of a native command into an ErrorRecord once stderr is
+#    redirected, and under `$ErrorActionPreference = 'Stop'` the first one
+#    TERMINATES the script. pip writes a blank line to stderr after a
+#    successful editable install, so the 2026-10-01 run reinstalled
+#    jcodemunch-mcp, then died before the other four products. The exit code
+#    is the verdict, read from $LASTEXITCODE; stderr is text.
+#    -Merge returns stderr lines too (pip's messages); without it only stdout.
+function Invoke-Py {
+    param([string[]]$PyArgs, [switch]$Merge)
+    $old = $ErrorActionPreference
+    $ErrorActionPreference = 'Continue'
+    try { $all = & $Python @PyArgs 2>&1 } finally { $ErrorActionPreference = $old }
+    foreach ($x in $all) {
+        if ($x -is [System.Management.Automation.ErrorRecord]) {
+            # A blank stderr line has an empty message and would print as the
+            # exception's type name.
+            $m = $x.Exception.Message
+            if ($Merge -and $m) { $m }
+        } else { "$x" }
+    }
+}
+
 # --------------------------------------------------------------------------
 # Pre-flight: refuse while any MCP server holds its console script open.
 # --------------------------------------------------------------------------
@@ -86,19 +109,24 @@ Write-Host 'No *munch* processes running.' -ForegroundColor Green
 # --------------------------------------------------------------------------
 # Report current state
 # --------------------------------------------------------------------------
+# ⚠⚠ SINGLE QUOTES ONLY inside this Python. Windows PowerShell 5.1 strips an
+#    embedded double quote when it passes an argument to a native program, so
+#    `d.metadata["Name"] or ""` reached python.exe as a syntax error on line 4
+#    and the report was empty (2026-10-01, run as `powershell -File`). pwsh 7
+#    keeps them, which is why it worked where it was written.
 $probe = @'
 import importlib.metadata as md
 rows = set()
 for d in md.distributions():
-    n = (d.metadata["Name"] or "")
-    if "munch" in n.lower():
+    n = (d.metadata['Name'] or '')
+    if 'munch' in n.lower():
         rows.add((n, d.version, str(d._path)))
 for n, v, p in sorted(rows):
-    print(f"{n}\t{v}\t{p}")
+    print(chr(9).join((n, v, p)))
 '@
 
 function Get-MunchDists {
-    $out = & $Python -c $probe 2>$null
+    $out = Invoke-Py @('-c', $probe)
     if (-not $out) { return @() }
     $out | ForEach-Object {
         $f = $_ -split "`t"
@@ -128,7 +156,7 @@ if ($unmanaged) {
 # --------------------------------------------------------------------------
 Write-Head 'Staging leftovers ("~" dist-info)'
 
-$siteDirs = & $Python -c "import site,sys;[print(p) for p in set(site.getsitepackages()+([site.getusersitepackages()] if site.ENABLE_USER_SITE else []))]" 2>$null
+$siteDirs = Invoke-Py @('-c', 'import site,sys;[print(p) for p in set(site.getsitepackages()+([site.getusersitepackages()] if site.ENABLE_USER_SITE else []))]')
 $turds = foreach ($sd in $siteDirs) {
     if (Test-Path $sd) {
         Get-ChildItem -Path $sd -Directory -Filter '~*munch*' -ErrorAction SilentlyContinue
@@ -192,7 +220,7 @@ foreach ($t in $Targets) {
     #   it is a decision, so say it out loud rather than performing it quietly.
     $importsFromTree = $false
     $modName = $dist -replace '-', '_'
-    $loc = & $Python -c "import $modName as m; print(m.__file__)" 2>$null
+    $loc = Invoke-Py @('-c', "import $modName as m; print(m.__file__)")
     if ($LASTEXITCODE -eq 0 -and $loc -like "$tree*") { $importsFromTree = $true }
     if (-not $importsFromTree) {
         Write-Host '  NOTE: currently a regular install; this will convert it to editable' -ForegroundColor Yellow
@@ -209,7 +237,7 @@ foreach ($t in $Targets) {
         $still = @(Get-MunchDists | Where-Object { $_.Name -eq $dist })
         if ($still.Count -eq 0) { break }
         Write-Host "  uninstall pass $i (remaining: $($still.Count))"
-        & $Python -m pip uninstall -y $dist 2>&1 | Out-Null
+        Invoke-Py @('-m', 'pip', 'uninstall', '-y', $dist) -Merge | Out-Null
     }
 
     $left = @(Get-MunchDists | Where-Object { $_.Name -eq $dist })
@@ -229,10 +257,13 @@ foreach ($t in $Targets) {
     Write-Host '  reinstalling editable from tree'
     Push-Location $tree
     try {
-        & $Python -m pip install -e . --no-deps 2>&1 |
+        Invoke-Py @('-m', 'pip', 'install', '-e', '.', '--no-deps') -Merge |
             Select-String -Pattern 'error|ERROR|Successfully' | ForEach-Object {
                 Write-Host "    $_"
             }
+        if ($LASTEXITCODE -ne 0) {
+            Write-Host "    pip install exited $LASTEXITCODE for $dist" -ForegroundColor Red
+        }
     } finally { Pop-Location }
 }
 
@@ -268,7 +299,7 @@ forea
```

**File**: `src/jcodemunch_mcp/investigator/deletion_safety.py` (modified, +7/-1)
```diff
@@ -280,10 +280,16 @@ def investigate_deletion_safety(
             ref_ob.evidence.append(f"check_references failed: {refs['error']}")
         else:
             import_refs = refs.get("import_references") or []
+            # ⚠ Read the match check_references made; never compare names
+            # again here (LEDGER L-90). Its comparison folds Unicode forms
+            # and escapes, so a raw `target_name in names` dropped an import
+            # it had found and this obligation read SATISFIED over a live
+            # importer. `match_type` already separates a named import from a
+            # specifier-stem one, which is all this filter is for.
             named_importers = [
                 r["file"]
                 for r in import_refs
-                if any(target_name in (m.get("names") or []) for m in r.get("matches", []))
+                if any(m.get("match_type") == "named" for m in r.get("matches", []))
             ]
             if named_importers:
                 # A refutation is only real if the thing that would break is
```

**File**: `tests/test_investigator_trusts_the_folded_import_match.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+"""The deletion investigator reads the import match `check_references` made (LEDGER L-90).
+
+`check_references` compares names through `_fold`, so `from shapes import
+<fi-ligature>le` is an import of `file` (L-84) and an import spelled with a
+Unicode escape is an import of the plain name (L-86). The investigator then
+re-filtered those rows with a raw `target_name in names`, dropped both, and
+answered `export_not_imported` SATISFIED for a name a live file imports.
+
+The filter it needed was only "named, not specifier-stem", which every row
+already states as `match_type`. The last test pins that half: a file imported
+by its stem alone is not an import of a name.
+
+Each importer here has an importer of its own: the investigator counts a file
+nothing imports as unreachable, entry points included (LEDGER L-94).
+"""
+
+from __future__ import annotations
+
+from pathlib import Path
+
+from jcodemunch_mcp.investigator import REFUTED, SATISFIED, investigate_deletion_safety
+from jcodemunch_mcp.tools.index_folder import index_folder
+
+LIGATURE = chr(0xFB01)  # one code point, NFKC-normalises to "fi"
+BS = chr(92)  # a literal escape typed here would reach disk decoded
+ESCAPED = BS + "u0066ile"  # `file`, first letter written as an escape
+
+
+def _index(root: Path, files: dict[str, str]) -> tuple[str, str]:
+    for rel, body in files.items():
+        p = root / rel
+        p.parent.mkdir(parents=True, exist_ok=True)
+        p.write_text(body, encoding="utf-8")
+    storage = str(root / ".index")
+    res = index_folder(str(root), use_ai_summaries=False, storage_path=storage)
+    return res.get("repo", str(root)), storage
+
+
+def _ob(result: dict, name: str) -> dict:
+    for o in result["obligations"]:
+        if o["obligation"] == name:
+            return o
+    raise AssertionError(f"obligation {name!r} missing from {result['obligations']}")
+
+
+def test_an_import_in_another_unicode_form_refutes(tmp_path):
+    files = {
+        "shapes.py": "def file():\n    return 1\n",
+        "user.py": f"from shapes import {LIGATURE}le\n\n\ndef use():\n    return {LIGATURE}le()\n",
+        "main.py": "from user import use\n\nprint(use())\n",
+    }
+    assert LIGATURE in files["user.py"] and "import file" not in files["user.py"]
+    repo, storage = _index(tmp_path, files)
+    r = investigate_deletion_safety(repo, "file", storage_path=storage)
+    ob = _ob(r, "export_not_imported")
+    assert ob["status"] == REFUTED, ob
+    assert any("user.py" in e for e in ob["evidence"]), ob
+
+
+def test_an_import_written_with_an_escape_refutes(tmp_path):
+    files = {
+        "package.json": '{"name":"fx","version":"1.0.0","type":"module","main":"src/main.js"}',
+        "src/shapes.js": "export function file() { return 1; }\n",
+        "src/user.js": (
+            "import { " + ESCAPED + " } from './shapes.js';\n"
+            "export function use() { return file(); }\n"
+        ),
+        "src/main.js": "import { use } from './user.js';\nexport function boot() { return use(); }\n",
+    }
+    assert BS + "u0066" in files["src/user.js"]
+    repo, storage = _index(tmp_path, files)
+    r = investigate_deletion_safety(repo, "file", storage_path=storage)
+    ob = _ob(r, "export_not_imported")
+    assert ob["status"] == REFUTED, ob
+    assert any("user.js" in e for e in ob["evidence"]), ob
+
+
+def test_a_specifier_stem_match_is_not_an_import_of_the_name(tmp_path):
+    """`import { other } from './file.js'` names the FILE `file`, not the export."""
+    files = {
+        "package.json": '{"name":"fx","version":"1.0.0","type":"module","main":"src/main.js"}',
+        "src/shapes.js": "export function file() { return 1; }\n",
+        "src/file.js": "export function other() { return 2; }\n",
+        "src/main.js": "import { other } from './file.js';\nexport function boot() { return other(); }\n",
+        # Without an importer of its own, main.js reads unreachable and the
+        # obligation is SATISFIED whether or not the stem match is filtered.
+        "src/app.js": "import { boot } from './main.js';\nboot();\n",
+    }
+    repo, storage = _index(tmp_path, files)
+    r = investigate_deletion_safety(repo, "src/shapes.js::file#function", storage_path=storage)
+    assert "error" not in r, r
+    assert _ob(r, "export_not_imported")["status"] == SATISFIED
```

#### Recent Merged Pull Requests:
- **PR #978** (2026-10-06): fix: the parse budget bounds a file's Python-side time, in the parsing thread, on every route (LEDGER L-116) (@jgravelle)
- **PR #977** (2026-10-05): release: v1.108.329 - the parse budget stops a slow parse (@jgravelle)
- **PR #975** (2026-10-05): fix: the parse budget stops a slow tree-sitter parse, on every route (LEDGER L-114) (@jgravelle)
- **PR #974** (2026-10-05): harness: weekly bench result (2026-10-05) (@github-actions[bot])
- **PR #973** (2026-10-05): test: the size-cap fixture opens with its padding, restoring the full tier's margin (#940) (@jgravelle)
- **PR #972** (2026-10-06): fix: a bare Python module name resolves to the script directory beside the importer (@whakomatic)
- **PR #971** (2026-10-04): release: v1.108.328 - a file a package.json script runs is an entry point (@jgravelle)
- **PR #970** (2026-10-04): fix: a repeat `index <subdir>` inside a git root is incremental (#961) (@ebataeva)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

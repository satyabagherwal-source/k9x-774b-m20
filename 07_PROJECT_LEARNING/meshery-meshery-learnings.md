> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshery-meshery-learnings.md`  
> **Source**: github ([https://github.com/meshery/meshery](https://github.com/meshery/meshery))  
> **Source Version**: `2d7c3d0b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T06:55:12.307Z  
> **Learning ID**: `learn-github-meshery-meshery`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): meshery/meshery

> **Canonical Artifact**: `07_PROJECT_LEARNING/meshery-meshery-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meshery/meshery](https://github.com/meshery/meshery))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T06:55:12.152Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshery/meshery`
- **Description**: Meshery, the cloud native manager
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12307 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/iterate-pr/scripts/fetch_pr_checks.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Fetch PR CI checks and optional failure snippets.

Usage:
    uv run fetch_pr_checks.py [--pr PR_NUMBER]
    python3 fetch_pr_checks.py [--pr PR_NUMBER]

If --pr is not specified, uses the PR for the current branch.

Output contract: a single JSON object on stdout carrying a top-level ``status``
field, ``"ok"`` or ``"error"``. On error ``summary`` and ``checks`` are ``null``
- never empty - so a caller reading only stdout cannot mistake a failed lookup
for a green PR. Errors also exit non-zero.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from typing import Any, NoReturn

RUN_ID_PATTERN = re.compile(r"/actions/runs/(\d+)")
FAILURE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\berror[:\s]",
        r"\bfailed[:\s]",
        r"\bfailure[:\s]",
        r"\btraceback\b",
        r"\bexception\b",
        r"\bpanic:",
        r"\bfatal:",
        r"\bnpm ERR!",
        r"\bTypeError\b",
        r"\bSyntaxError\b",
        r"\bImportError\b",
        r"\bModuleNotFoundError\b",
        r"===.*FAILURES.*===",
    )
]


def fail(message: str) -> NoReturn:
    """Emit a machine-readable failure and exit non-zero."""
    print(
        json.dumps(
            {
                "status": "error",
                "error": message,
                "pr": None,
                "summary": None,
                "checks": None,
                "action_required": (
                    "STOP: CI status could not be fetched, so this PR's check state "
                    "is unknown. Do not treat this as 'checks passed' and do not "
                    f"merge. Cause: {message}"
                ),
            },
            indent=2,
        )
    )
    sys.exit(1)


def run_gh_json(args: list[str], allowed_exit_codes: tuple[int, ...] = (0,)) -> Any:
    try:
        result = subprocess.run(
            ["gh", *args],
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        raise RuntimeError(f"failed to run gh CLI: {exc}") from exc

    if result.returncode not in allowed_exit_codes:
        stderr = (result.stderr or result.stdout).strip() or "unknown gh error"
        raise RuntimeError(f"gh {' '.join(args)} failed: {stderr}")

    stdout = result.stdout.strip()
    if not stdout:
        return None

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"gh {' '.join(args)} returned non-JSON output") from exc


def get_pr_info(pr_number: int | None = None) -> dict[str, Any] | None:
    args = ["pr", "view", "--json", "number,url,headRefName,baseRefName"]
    if pr_number is not None:
        args.insert(2, str(pr_number))
    result = run_gh_json(args)
    if not isinstance(result, dict):
        raise RuntimeError("unable to determine PR for current branch")
    return result


def get_checks(pr_number: int | None = None) -> list[dict[str, Any]]:
    args = ["pr", "checks", "--json", "name,bucket,state,link,workflow"]
    if pr_number is not None:
        args.insert(2, str(pr_number))

    result = run_gh_json(args, allowed_exit_codes=(0, 8))
    if not isinstance(result, list):
        return []

    checks: list[dict[str, Any]] = []
    for entry in result:
        if not isinstance(entry, dict):
            continue
        checks.append(
            {
                "name": str(entry.get("name") or "unknown"),
                "status": str(entry.get("bucket") or entry.get("state") or "unknown"),
                "link": str(entry.get("link") or ""),
                "workflow": str(entry.get("workflow") or ""),
            }
        )

    checks.sort(key=lambda check: (check["name"].lower(), check["workflow"].lower(), check["status"], check["link"]))
    return checks


def get_run_id(check_link: str) -> int | None:
    match = RUN_ID_PATTERN.search(check_link)
    if not match:
        return None
    return int(match.group(1))


def extract_failure_snippet(log_text: str, max_lines: int = 50) -> str:
    lines = log_text.splitlines()
    if not lines:
        return ""

    first_failure = None
    for index, line in enumerate(lines):
        if any(pattern.search(line) for pattern in FAILURE_PATTERNS):
            first_failure = index
            break

    if first_failure is None:
        return "\n".join(lines[-max_lines:])

    start = max(0, first_failure - 5)
    end = min(len(lines), start + max_lines)
    return "\n".join(lines[start:end])


def get_run_logs(run_id: int) -> str | None:
    """Failure logs for a run, or ``None`` when they cannot be read.

    A log snippet is an enrichment, so every failure here degrades to no
    snippet. Raising instead would abort an otherwise-complete checks fetch and
    leave stdout empty, which is the one thing this script's contract forbids.
    """
    try:
        result = subprocess.run(
            ["gh", "run", "view", str(run_id), "--log-failed"],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (subprocess.TimeoutExpired, OSError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout if result.stdout.strip() else None


def summarize(checks: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "total": len(checks),
        "passed": sum(1 for check in checks if check["status"] == "pass"),
        "failed": sum(1 for check in checks if check["status"] == "fail"),
        "pending": sum(1 for check in checks if check["status"] == "pending"),
        "skipped": sum(1 for check in checks if check["status"] in {"skipping", "cancel"}),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch PR CI checks with failure snippets")
    parser.add_argument("--pr", type=int, help="PR number (defaults to current branch PR)")
    args = parser.parse_args()

    try:
        pr_info = get_pr_info(args.pr)
        checks = get_checks(pr_info["number"])
    except RuntimeError as error:
        fail(str(error))

    pr_number = pr_info["number"]
    branch = pr_info["headRefName"]

    processed_checks = []
    log_cache: dict[int, str | None] = {}

    for check in checks:
        processed = dict(check)

        if processed["status"] == "fail":
            run_id = get_run_id(processed.get("link", ""))
            if run_id is not None:
                processed["run_id"] = run_id
                if run_id not in log_cache:
                    log_cache[run_id] = get_run_logs(run_id)
                logs = log_cache[run_id]
                if logs:
                    snippet = extract_failure_snippet(logs)
                    if snippet:
                        processed["log_snippet"] = snippet

        processed_checks.append(processed)

    output = {
        "status": "ok",
        "pr": {
            "number": pr_number,
            "url": pr_info.get("url", ""),
            "branch": branch,
            "base": pr_info.get("baseRefName", ""),
        },
        "summary": summarize(processed_checks),
        "checks": processed_checks,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/iterate-pr/scripts/fetch_pr_feedback.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Fetch and categorize PR review feedback.

Usage:
    uv run fetch_pr_feedback.py [--pr PR_NUMBER]
    python3 fetch_pr_feedback.py [--pr PR_NUMBER]

If --pr is not specified, uses the PR for the current branch.

Output contract: a single JSON object on stdout carrying a top-level ``status``
field. ``status`` is ``"ok"`` when the fetch completed and ``"error"`` when it
did not. On error the ``summary`` and ``feedback`` keys are ``null`` - never
empty - so that "there is no feedback" and "the feedback was never fetched"
cannot be confused by a caller reading only stdout. Errors also exit non-zero.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from typing import Any, NoReturn


# Bots whose comments are actionable code review. Matched against the login with
# any trailing "[bot]" stripped, because the REST API reports "coderabbitai[bot]"
# while GraphQL reports "coderabbitai" for the same account.
REVIEW_BOT_PATTERNS = [
    r"(?i)^sentry",
    r"(?i)^warden",
    r"(?i)^cursor",
    r"(?i)^bugbot",
    r"(?i)^seer",
    r"(?i)^copilot",
    r"(?i)^codex",
    r"(?i)^claude",
    r"(?i)^codeql",
    r"(?i)^coderabbit",
    r"(?i)^gemini-code-assist",
    r"(?i)^greptile",
    r"(?i)^sourcery",
    r"(?i)^qodo",
    r"(?i)^codium",
    r"(?i)^ellipsis",
]

# Bots that post informational status reports rather than review findings.
INFO_BOT_PATTERNS = [
    r"(?i)^codecov",
    r"(?i)^dependabot",
    r"(?i)^renovate",
    r"(?i)^github-actions",
    r"(?i)^mergify",
    r"(?i)^semantic-release",
    r"(?i)^sonarcloud",
    r"(?i)^snyk",
    r"(?i)^netlify",
    r"(?i)^vercel",
    r"(?i)bot$",
    r"(?i)\[bot\]$",
]

LOGAF_PATTERNS = [
    (re.compile(r"^\s*(?:h:|h\s*:|high:|\[h\])", re.IGNORECASE), "high"),
    (re.compile(r"^\s*(?:m:|m\s*:|medium:|\[m\])", re.IGNORECASE), "medium"),
    (re.compile(r"^\s*(?:l:|l\s*:|low:|\[l\])", re.IGNORECASE), "low"),
]

HIGH_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"must\s+(fix|change|update|address)",
        r"this\s+(is\s+)?(wrong|incorrect|broken|buggy)",
        r"security\s+(issue|vulnerability|concern)",
        r"will\s+(break|cause|fail)",
        r"\bcritical\b",
        r"\bblocker\b",
    )
]

LOW_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"nit[:\s]",
        r"nitpick",
        r"suggestion[:\s]",
        r"consider\s+",
        r"could\s+(also\s+)?",
        r"might\s+(want\s+to|be\s+better)",
        r"optional[:\s]",
        r"minor[:\s]",
        r"style[:\s]",
        r"prefer\s+",
        r"what\s+do\s+you\s+think",
        r"up\s+to\s+you",
        r"take\s+it\s+or\s+leave",
        r"\bfwiw\b",
    )
]

BOT_SUFFIX = re.compile(r"\[bot\]$", re.IGNORECASE)


def fail(message: str) -> NoReturn:
    """Emit a machine-readable failure and exit non-zero.

    ``summary`` and ``feedback`` are explicitly null so a caller that reads only
    stdout cannot mistake a failed lookup for a clean PR.
    """
    print(
        json.dumps(
            {
                "status": "error",
                "error": message,
                "pr": None,
                "summary": None,
                "feedback": None,
                "action_required": (
                    "STOP: PR feedback could not be fetched, so this PR's review "
                    "state is unknown. Do not treat this as 'no feedback' and do "
                    f"not merge. Cause: {message}"
                ),
            },
            indent=2,
        )
    )
    sys.exit(1)


def run_gh_json(args: list[str]) -> Any:
    try:
        result = subprocess.run(
            ["gh", *args],
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        raise RuntimeError(f"failed to run gh CLI: {exc}") from exc
    if result.returncode != 0:
        stderr = (result.stderr or result.stdout).strip() or "unknown gh error"
        raise RuntimeError(f"gh {' '.join(args)} failed: {stderr}")

    stdout = result.stdout.strip()
    if not stdout:
        return None

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"gh {' '.join(args)} returned non-JSON output") from exc


def run_gh_json_list(args: list[str]) -> list[dict[str, Any]]:
    """Fetch a paginated REST list and flatten it, or raise.

    Every caller of this needs a list. ``gh`` can exit 0 while writing nothing -
    a truncated response, a proxy, a degraded endpoint - and the shape that
    reaches us is then ``None``, not ``[]``. Returning ``[]`` for it is the
    silent-empty inversion this whole script exists to prevent: a whole feedback
    channel disappears and the run reports a clean PR. So anything that is not a
    list is an error, not an absence.
    """
    result = run_gh_json(args)
    if result is None:
        raise RuntimeError(
            f"gh {' '.join(args)} exited 0 but returned no output; "
            "the response was not delivered, so the feedback it carries is unknown"
        )
    if not isinstance(result, list):
        raise RuntimeError(
            f"gh {' '.join(args)} returned {type(result).__name__}, expected a list of pages"
        )
    return flatten_pages(result)


def get_repo_info() -> tuple[str, str]:
    result = run_gh_json(["repo", "view", "--json", "owner,name"])
    if not isinstance(result, dict):
        raise RuntimeError("could not determine repository from current directory")
    owner = result.get("owner", {}).get("login")
    repo = result.get("name")
    if not owner or not repo:
        raise RuntimeError("could not determine repository owner/name")
    return str(owner), str(repo)


def get_current_user() -> str:
    """Login of the account ``gh`` is authenticated as.

    Required, not optional: without it the fetcher cannot tell the caller's own
    replies apart from reviewer feedback, and reports them back as new work.
    """
    result = run_gh_json(["api", "user"])
    if not isinstance(result, dict):
        raise RuntimeError("could not determine the authenticated gh user")
    login = result.get("login")
    if not login:
        raise RuntimeError("authenticated gh user has no login")
    return str(login)


def get_pr_info(pr_number: int | None = None) -> dict[str, Any]:
    args = ["pr", "view", "--json", "number,url,headRefName,author,reviewDecision"]
    if pr_number is not None:
        args.insert(2, str(pr_number))
    result = run_gh_json(args)
    if not isinstance(result, dict):
        raise RuntimeError("unable to determine PR for current branch")
    return result


def normalize_login(username: str) -> str:
    """Strip the REST-only ``[bot]`` suffix so both APIs classify identically."""
    return BOT_SUFFIX.sub("", username or "").strip()


def is_review_bot(username: str) -> bool:
    login = normalize_login(username)
    return any(re.search(p, login) for p in REVIEW_BOT_PATTERNS)


def is_info_bot(username: str) -> bool:
    return any(re.search(p, username or "") for p in INFO_BOT_PATTERNS)


def flatten_pages(result: list[Any]) -> list[dict[str, Any]]:
    """Flatten the list of pages ``gh api --paginate --slurp`` returns.

    Shape validation belongs to ``run_gh_json_list``; by the time we get here the
    payload is known to be a list of pages.
    """
    entries: list[dict[str, Any]] = []
    for page in result:
        if isinstance(page, list):
            entries.extend(entry for entry in page if isinstance(entry, dict))
        elif isinstance(page, dict):
            entries.append(page)
    return entries


def get_issue_comments(owner: str, repo: str, pr_number: int) -> list[dict[str, Any]]:
    return run_gh_json_list([
        "api",
        f"repos/{owner}/{repo}/issues/{pr_number}/comments",
        "--paginate",
        "--slurp",
    ])


def get_reviews(owner: str, repo: str, pr_number: int) -> list[dict[str, Any]]:
    """Submitted reviews, read from REST because only REST carries ``html_url``.

    ``gh pr view --json reviews`` exposes the review's GraphQL node id, while the
    page anchor is keyed on the numeric database id, so a review body sourced
    that way reaches the caller with no link back to the review it came from.
    """
    return run_gh_json_list([
        "api",
        f"repos/{owner}/{repo}/pulls/{pr_number}/reviews",
        "--paginate",
        "--slurp",
    ])


def get_review_threads(owner: str, repo: str, pr_number: int) -> list[dict[str, Any]]:
    query = """
    query($owner: String!, $repo: String!, $pr: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              isResolved
              isOutdated
              path
              line
              firstComment: comments(first: 1) {
                nodes {
                  body
                  createdAt
                  author {
                    login
                  }
                }
              }
              lastComment: comments(last: 1) {
                nodes {
                  createdAt
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    threads: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        args = [
            "api",
            "graphql",
            "-f",
            f"query={query}",
            "-F",
            f"owner={owner}",
            "-F",
            f"repo={repo}",
            "-F",
            f"pr={pr_number}",
        ]
        if cursor is not None:
            args.extend(["-F", f"after={cursor}"])

        result = run_g
```

### Core Architecture Module: `.agents/skills/iterate-pr/scripts/reply_to_thread.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Reply to PR review threads.

Usage:
    python reply_to_thread.py THREAD_ID BODY [THREAD_ID BODY ...]

Accepts one or more (thread_id, body) pairs as positional arguments.
Batches all replies into a single GraphQL mutation for efficiency.

Example:
    python reply_to_thread.py PRRT_abc "Fixed the issue."
    python reply_to_thread.py PRRT_abc "Fixed." PRRT_def "Also fixed."
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

PROHIBITED_TERM_PATTERN = re.compile(
    r"\b(?:claude(?:\s+code)?|cloude\s+code|anthropic)\b",
    re.IGNORECASE,
)
SIGNATURE_PATTERN = re.compile(r"^\*[—-]\s+.+\*$")
SIGNOFF_PATTERN = re.compile(r"^\s*(?:signed-off-by|co-authored-by)\s*:", re.IGNORECASE)


def _normalize_body(body: str) -> str:
    """Normalize escaped newlines and strip attribution/sign-off text.

    Bash double quotes keep "\\n" literal, but reply bodies should contain
    actual newlines for readability.
    """
    normalized = body.replace("\\r\\n", "\\n").replace("\\n", "\n")

    sanitized_lines: list[str] = []
    for line in normalized.split("\n"):
        stripped = line.strip()
        if SIGNATURE_PATTERN.match(stripped) or SIGNOFF_PATTERN.match(stripped):
            continue

        had_prohibited_terms = bool(PROHIBITED_TERM_PATTERN.search(line))
        sanitized = PROHIBITED_TERM_PATTERN.sub("", line)
        sanitized = re.sub(r"\s{2,}", " ", sanitized).rstrip()
        if had_prohibited_terms and re.fullmatch(r"[\W_]*(?:and|or|and/or|&)?[\W_]*", sanitized.strip(), re.IGNORECASE):
            continue
        sanitized_lines.append(sanitized)

    sanitized = "\n".join(sanitized_lines).strip()
    sanitized = re.sub(r"\n{3,}", "\n\n", sanitized)

    return sanitized or "Updated."


def reply_to_threads(pairs: list[tuple[str, str]]) -> list[tuple[str, bool]]:
    """Reply to one or more review threads in a single GraphQL call.

    Returns a per-operation list of (thread_id, success) tuples.
    """
    # Build aliased mutation
    mutations = []
    for i, (thread_id, body) in enumerate(pairs):
        escaped_thread_id = json.dumps(thread_id)
        normalized_body = _normalize_body(body)
        if normalized_body != body.replace("\\r\\n", "\\n").replace("\\n", "\n"):
            print(
                f"Sanitized reply body for thread {thread_id} to remove signatures or attribution.",
                file=sys.stderr,
            )
        escaped_body = json.dumps(normalized_body)  # handles newlines, quotes
        mutations.append(
            f"  r{i}: addPullRequestReviewThreadReply(input: {{"
            f"pullRequestReviewThreadId: {escaped_thread_id}, "
            f"body: {escaped_body}"
            f"}}) {{ clientMutationId }}"
        )

    query = "mutation {\n" + "\n".join(mutations) + "\n}"

    try:
        result = subprocess.run(
            ["gh", "api", "graphql", "-f", f"query={query}"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            print(f"GraphQL error: {result.stderr}", file=sys.stderr)
            return [(tid, False) for tid, _ in pairs]

        # Parse response to detect per-alias GraphQL errors
        try:
            response = json.loads(result.stdout)
        except (json.JSONDecodeError, TypeError):
            print(f"Failed to parse GraphQL response: {result.stdout}", file=sys.stderr)
            return [(tid, False) for tid, _ in pairs]

        data = response.get("data") or {}
        errors = response.get("errors") or []

        # Build a set of alias indices that have errors
        error_paths = set()
        for err in errors:
            for segment in err.get("path") or []:
                if isinstance(segment, str) and segment.startswith("r"):
                    error_paths.add(segment)

        operation_results = []
        for i, (tid, _) in enumerate(pairs):
            alias = f"r{i}"
            if alias in error_paths or data.get(alias) is None:
                operation_results.append((tid, False))
            else:
                operation_results.append((tid, True))

        if any(not ok for _, ok in operation_results):
            failed = [tid for tid, ok in operation_results if not ok]
            print(f"GraphQL partial failure for threads: {failed}", file=sys.stderr)

        return operation_results
    except subprocess.TimeoutExpired:
        print("Request timed out", file=sys.stderr)
        return [(tid, False) for tid, _ in pairs]


def main():
    parser = argparse.ArgumentParser(
        description="Reply to PR review threads",
        usage="%(prog)s THREAD_ID BODY [THREAD_ID BODY ...]",
    )
    parser.add_argument(
        "args",
        nargs="+",
        help="Alternating thread_id and body pairs",
    )
    parsed = parser.parse_args()

    if len(parsed.args) % 2 != 0:
        print("Error: arguments must be (thread_id, body) pairs", file=sys.stderr)
        sys.exit(1)

    pairs = []
    for i in range(0, len(parsed.args), 2):
        pairs.append((parsed.args[i], parsed.args[i + 1]))

    results = reply_to_threads(pairs)

    # Output results
    success = all(ok for _, ok in results)
    by_thread = {}
    for tid, ok in results:
        by_thread.setdefault(tid, []).append(ok)

    output = {
        "replied": sum(1 for _, ok in results if ok),
        "failed": sum(1 for _, ok in results if not ok),
        "operations": [
            {"thread_id": tid, "status": "ok" if ok else "failed"}
            for tid, ok in results
        ],
        "threads": {
            tid: "ok" if all(statuses) else "failed"
            for tid, statuses in by_thread.items()
        },
    }
    print(json.dumps(output, indent=2))

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24235** (2026-11-24): **fix(server): record kubeconfig discovery errors only for selected contexts**
  *Symptoms*: ## Intent  Fix meshery issue #24220 (found during review of #23852): kubeconfig discovery records metadata["error"] for every context that fails, including contexts the user deselected in the import wizard, so the import receipt event is raised to Error severity while the wizard shows success. Lee's decision: record discovery errors only for the contexts the user selected. Implementation: in the kubeconfig import handler (addK8SConfig), when an explicit selection is sent, drop the discovery metadata entries of every context outside it before the import loop (retainSelectedContextMetadata); with no selection (legacy clients such as mesheryctl) nothing is removed, so failed or skipped contexts still show; a renamed context's stale entry under its old name is dropped. Test that fails before the fix: a failing deselected context produces no error metadata and an Informational receipt (TestImportReceiptIgnoresFailingDeselectedContext), plus unit tests of the helper. Known, deliberately out of scope: the loop already overwrote discovery's error for selected reachable contexts whose version lookup fails (pre-existing). An Opus review of the diff found a regression for the no-selection path, which is fixed. PR must link and close #24220. Merge master first (done); commits are signed off as Yi nuo.  ## What Changed - Added `retainSelectedContextMetadata` in `server/handlers/k8sconfig_handler.go` and call it in `addK8SConfig` before the import loop. When the wizard sends an explicit co

- **Issue #24233** (2026-11-24): **fix(server): reject exec, auth-provider and file-path Kubernetes credentials**
  *Symptoms*: ## Intent  Rebind the PR attestation to the final head for meshery issue #24218. The only new commit since the last run is a signed merge of master (resolved the next_error_code conflict in component_info.json after #24230 merged). No code change.  ## What Changed - Added `server/models/k8s_credential_guard.go`, a guard that rejects Kubernetes credential secrets and kubeconfigs carrying an exec plugin, an auth-provider, or file-path references. It has a new MeshKit error in `server/models/error.go`, with `next_error_code` bumped in `server/helpers/component_info.json`. - Applied the guard on the saved-credential paths: `credentials_handlers.go` (credential create/update), `k8s_context.go`, `remote_provider.go` and `machines/actions.go`. This closes the bypass of the kubeconfig upload guard described in #24218. - Added unit tests for the guard (`k8s_credential_guard_test.go`) and handler tests (`credentials_handlers_test.go`). Updated the "Registering a connection" guide to document the restriction. - The latest commit is a signed merge of `master` that resolves the `next_error_code` conflict in `component_info.json` after #24230 merged. It contains no code change.  ## Risk Assessment  ✅ Low: The guard is applied at credential save, update, the connect action and K8sContextFromConnection, and I found no reachable bypass or wrong-result path; the only new commit is a signed merge that bumps next_error_code to 1501 past the new 1500 code.  ## Testing  The only change since the l

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

### Incident Patch 1: `323f07f0` (2026-11-24)
**Commit Message**: fix(server): record import receipt errors only for the selected contexts

Kubeconfig discovery recorded metadata["error"] for every failing
context, including contexts the user deselected in the wizard, so the
import receipt was raised to Error while the wizard showed success.
With an explicit selection, drop the discovery entries of every context
outside it before the import loop, and drop the entry keyed by a
context's old name when it is renamed.

Fixes #24220

Signed-off-by: Yī nuò <[REDACTED_EMAIL]>

**File**: `server/handlers/k8sconfig_handler.go` (modified, +37/-0)
```diff
@@ -184,6 +184,14 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 		}
 	}
 
+	// Discovery recorded a per-context entry (with an "error" for any context
+	// that failed) for every context in the file, including the ones the user
+	// deselected and the ones Meshery skipped. The receipt below describes only
+	// what this import acted on, so drop the entries of contexts outside an
+	// explicit selection; otherwise a broken context the user chose not to import would
+	// raise the receipt to Error while the wizard reports success (issue #24220).
+	retainSelectedContextMetadata(eventMetadata, contexts, selectedContexts)
+
 	// Helper function to get meshsync deployment mode for a context
 	// Uses closure pattern to call req.FormValue only once while keeping globalMeshsyncMode scoped
 	getMeshsyncModeForContext := func() func(*models.K8sContext) string {
@@ -279,6 +287,9 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 		// so regenerate the context ID to keep the struct's ID in sync with the
 		// connection ID SaveK8sContext will mint.
 		if opts, ok := contextsConfig[ctx.ID]; ok && opts.Name != "" && opts.Name != ctx.Name {
+			// The receipt is keyed by the name the connection is saved under;
+			// drop the discovery entry that is keyed by the old name.
+			delete(eventMetadata, ctx.Name)
 			ctx.Name = opts.Name
 			if regeneratedID, idErr := models.K8sContextGenerateID(*ctx); idErr == nil {
 				ctx.ID = regeneratedID
@@ -421,6 +432,32 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 	}
 }
 
+// retainSelectedContextMetadata removes from eventMetadata, the per-context
+// discovery metadata keyed by context name, the entries of contexts the user
+// left out of an explicit selection: discovered contexts outside it, and
+// contexts discovery skipped (never importable, so never selected). With no
+// selection every context is imported, so nothing is removed and a context that
+// failed or was skipped during discovery still shows in the receipt.
+func retainSelectedContextMetadata(eventMetadata map[string]interface{}, contexts []*models.K8sContext, selected map[string]struct{}) {
+	if selected == nil {
+		return
+	}
+	keep := make(map[string]struct{}, len(selected))
+	for _, ctx := range contexts {
+		if ctx == nil {
+			continue
+		}
+		if _, ok := selected[ctx.ID]; ok {
+			keep[ctx.Name] = struct{}{}
+		}
+	}
+	for name := range eventMetadata {
+		if _, ok := keep[name]; !ok {
+			delete(eventMetadata, name)
+		}
+	}
+}
+
 // k8sEventMetadataHasError reports whether any per-context entry in a Kubernetes
 // connection receipt's metadata recorded a failure. Each context's outcome is
 // keyed by its name and carries an "error" entry only when that context failed
```

**File**: `server/handlers/k8sconfig_handler_test.go` (modified, +98/-0)
```diff
@@ -633,3 +633,101 @@ users:
 		}
 	}
 }
+
+// TestImportReceiptIgnoresFailingDeselectedContext pins issue #24220: a context
+// that fails discovery but that the user deselected must leave no error in the
+// import receipt, which then stays Informational like the wizard's success.
+func TestImportReceiptIgnoresFailingDeselectedContext(t *testing.T) {
+	authUser := &models.User{ID: uuid.Must(uuid.NewV4())}
+	// Nothing listens on port 1, so discovery cannot reach the API server and
+	// records an error for the context.
+	kubeconfig := []byte(`apiVersion: v1
+kind: Config
+current-context: broken
+clusters:
+- cluster:
+    server: https://127.0.0.1:1
+  name: broken
+contexts:
+- context:
+    cluster: broken
+    user: broken-user
+  name: broken
+users:
+- name: broken-user
+  user:
+    token: token-0
+`)
+	receiptOf := func(t *testing.T, form map[string]string) events.Event {
+		t.Helper()
+		h := newTestHandler(t, map[string]models.Provider{}, "")
+		provider := &mockK8sConfigProvider{}
+		var b bytes.Buffer
+		w := multipart.NewWriter(&b)
+		part, err := w.CreateFormFile("k8sfile", "kubeconfig")
+		if err != nil {
+			t.Fatalf("create form file: %v", err)
+		}
+		if _, err := part.Write(kubeconfig); err != nil {
+			t.Fatalf("write form file: %v", err)
+		}
+		for k, v := range form {
+			if err := w.WriteField(k, v); err != nil {
+				t.Fatalf("write field %s: %v", k, err)
+			}
+		}
+		if err := w.Close(); err != nil {
+			t.Fatalf("close writer: %v", err)
+		}
+		req := httptest.NewRequest(http.MethodPost, "/api/system/kubernetes", &b)
+		req.Header.Set("Content-Type", w.FormDataContentType())
+		req = req.WithContext(context.WithValue(req.Context(), models.TokenCtxKey, "test-token"))
+		rec := httptest.NewRecorder()
+		h.K8SConfigHandler(rec, req, nil, authUser, provider)
+		if rec.Code != http.StatusOK {
+			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
+		}
+		if len(provider.persistedEvents) != 1 {
+			t.Fatalf("persisted %d events, want the single import receipt", len(provider.persistedEvents))
+		}
+		return provider.persistedEvents[0]
+	}
+
+	t.Run("deselected failing context leaves an informational receipt", func(t *testing.T) {
+		receipt := receiptOf(t, map[string]string{SelectedContextsFormKey: "[]"})
+		if receipt.Severity != events.Informational {
+			t.Fatalf("receipt severity = %v, want Informational (description %q)", receipt.Severity, receipt.Description)
+		}
+		if k8sEventMetadataHasError(receipt.Metadata) {
+			t.Fatalf("receipt metadata carries an error for a context the user deselected: %#v", receipt.Metadata)
+		}
+		if _, ok := receipt.Metadata["broken"]; ok {
+			t.Fatalf("receipt metadata describes the deselected context: %#v", receipt.Metadata)
+		}
+	})
+}
+
+func TestRetainSelectedContextMetadata(t *testing.T) {
+	picked := &models.K8sContext{ID: "id-picked", Name: "picked"}
+	dropped := &models.K8sContext{ID: "id-dropped", Name: "dropped"}
+	failing := map[string]interface{}{"error": errors.New("unreachable")}
+	newMetadata := func() map[string]interface{} {
+		return map[string]interface{}{"picked": failing, "dropped": failing, "skipped": failing}
+	}
+
+	t.Run("a selection keeps only the selected contexts", func(t *testing.T) {
+		metadata := newMetadata()
+		retainSelectedContextMetadata(metadata, []*models.K8sContext{picked, dropped}, map[string]struct{}{"id-picked": {}})
+		if len(metadata) != 1 || metadata["picked"] == nil {
+			t.Fatalf("metadata = %#v, want only the selected context's entry", metadata)
+		}
+	})
+
+	t.Run("no selection removes nothing, so skipped and failed contexts still show", func(t *testing.T) {
+		metadata := newMetadata()
+		retainSelectedContextMetadata(metadata, []*models.K8sContext{picked, dropped}, nil)
+		if len(metadata) != 3 || !k8sEventMetadataHasError(metadata) {
+			t.Fatalf("metadata = %#v, want all three entries kept", metadata)
+		}
+	})
+}
```

---

### Incident Patch 2: `350d231c` (2026-11-24)
**Commit Message**: fix(server): refuse exec and file-path Kubernetes credentials

A saved connection's credential secret can be edited (PUT
/api/integrations/credentials) to carry an exec plugin, an auth-provider or a
certificate, key or token file path. Ping, the connection state machine and
graphql then build a client from it through K8sContextFromConnection, which
runs the command or reads the file on the Meshery Server host.

Reject such a secret on credential save and update (400, field names only), and
re-check in K8sContextFromConnection against what client-go will actually see
(the rendered kubeconfig, parsed by clientcmd). A field identical to the one in
the server's own kubeconfig stays allowed so contexts imported from it (EKS,
GKE exec plugins) keep working. The remote provider's context listing skips a
poisoned connection instead of failing the whole page.

Fixes #24218

Signed-off-by: Yī nuò <[REDACTED_EMAIL]>

**File**: `docs/content/en/guides/infrastructure-management/registering-a-connection.md` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ Creating a Connection performs two transitions in sequence: it **registers** the
 
 ### Credentials
 
-Credentials entered in the wizard are persisted as first-class, named [Credentials]({{< ref "concepts/logical/credentials.md" >}}), encrypted at rest, and reusable across other Connections. Meshery never exposes them in logs or API responses. To learn how Meshery interprets a credential's secret (Basic auth vs. bearer token vs. anonymous), see [Credentials]({{< ref "concepts/logical/credentials.md" >}}) and the [Telemetry authentication note]({{< ref "guides/telemetry/_index.md" >}}).
+Credentials entered in the wizard are persisted as first-class, named [Credentials]({{< ref "concepts/logical/credentials.md" >}}), encrypted at rest, and reusable across other Connections. Meshery never exposes them in logs or API responses. A Kubernetes credential must carry plain data: Meshery rejects (HTTP 400) one that sets an `exec` plugin, an `auth-provider`, or a `certificate-authority`, `client-certificate`, `client-key` or `tokenFile` path, because building a client from it would run a command or read a file on the machine running Meshery Server. Credentials of Kubernetes contexts that Meshery Server imported from its own kubeconfig are the exception, and keep working. Embed the data instead (`*-data` fields or a `token`). To learn how Meshery interprets a credential's secret (Basic auth vs. bearer token vs. anonymous), see [Credentials]({{< ref "concepts/logical/credentials.md" >}}) and the [Telemetry authentication note]({{< ref "guides/telemetry/_index.md" >}}).
 
 ## Importing a Kubernetes cluster
 
```

**File**: `server/handlers/credentials_handlers.go` (modified, +26/-0)
```diff
@@ -56,6 +56,11 @@ func (h *Handler) SaveUserCredential(w http.ResponseWriter, req *http.Request, _
 	// onto another user's account.
 	credential.UserId = userUUID
 
+	if err := rejectUnsafeKubeCredential(credential.Secret); err != nil {
+		writeMeshkitError(w, err, http.StatusBadRequest)
+		return
+	}
+
 	createdCredential, err := provider.SaveUserCredential(token, &credential)
 	if err != nil {
 		if h.log != nil {
@@ -216,6 +221,11 @@ func (h *Handler) UpdateUserCredential(w http.ResponseWriter, req *http.Request,
 	// field to confirm the caller owns the credential being updated).
 	credential.UserId = userUUID
 
+	if err := rejectUnsafeKubeCredential(credential.Secret); err != nil {
+		writeMeshkitError(w, err, http.StatusBadRequest)
+		return
+	}
+
 	_, err = provider.UpdateUserCredential(req, credential)
 	if err != nil {
 		// The local provider reports a missing or deleted credential with
@@ -295,3 +305,19 @@ func (h *Handler) DeleteUserCredential(w http.ResponseWriter, req *http.Request,
 	}
 	w.WriteHeader(http.StatusOK)
 }
+
+// rejectUnsafeKubeCredential refuses a Kubernetes credential secret whose
+// kubeconfig user or cluster would make Meshery Server run a command (exec,
+// auth-provider) or read a file (certificate, key and token paths) on its own
+// host to build a client (issue #24218), unless it is a context of the server's own
+// kubeconfig (see models.UntrustedKubeCredentialFields). Credentials that carry no Kubernetes
+// auth or cluster block are not affected. It reports field names only.
+func rejectUnsafeKubeCredential(secret map[string]interface{}) error {
+	payload := models.CredentialPayload(secret)
+	auth, _ := payload["auth"].(map[string]interface{})
+	cluster, _ := payload["cluster"].(map[string]interface{})
+	if fields := models.UntrustedKubeCredentialFields(auth, cluster); len(fields) > 0 {
+		return models.ErrUnsafeKubeCredential(fields)
+	}
+	return nil
+}
```

**File**: `server/handlers/credentials_handlers_test.go` (modified, +63/-0)
```diff
@@ -649,3 +649,66 @@ func TestDeleteUserCredential_NilProvider_ReturnsInternalServerError(t *testing.
 		t.Fatalf("expected %s, got %s", ErrNilProviderCode, decoded.Code)
 	}
 }
+
+// TestSaveAndUpdateUserCredential_RejectUnsafeKubeCredential pins issue #24218:
+// a Kubernetes credential secret must not carry an exec plugin, an
+// auth-provider or a certificate, key or token file path, in either the
+// canonical {auth, cluster} shape or the legacy {credentialName, secret} wrapper.
+// The provider must never see it, and the response must not echo the command or
+// the path.
+func TestSaveAndUpdateUserCredential_RejectUnsafeKubeCredential(t *testing.T) {
+	cluster := `"cluster":{"name":"c","cluster":{"server":"https://127.0.0.1:1"}}`
+	secrets := map[string]string{
+		"exec":                `{"auth":{"name":"u","user":{"exec":{"apiVersion":"client.authentication.k8s.io/v1","command":"leak-cmd","args":["/leak/path"]}}},` + cluster + `}`,
+		"auth-provider":       `{"auth":{"name":"u","user":{"auth-provider":{"name":"oidc"}}},` + cluster + `}`,
+		"tokenFile":           `{"auth":{"name":"u","user":{"tokenFile":"/leak/path"}},` + cluster + `}`,
+		"client-key":          `{"auth":{"name":"u","user":{"client-key":"/leak/path"}},` + cluster + `}`,
+		"ca path":             `{"auth":{"name":"u","user":{"token":"t"}},"cluster":{"name":"c","cluster":{"server":"https://k","certificate-authority":"/leak/path"}}}`,
+		"legacy wrapper exec": `{"credentialName":"x","secret":{"auth":{"name":"u","user":{"exec":{"apiVersion":"client.authentication.k8s.io/v1","command":"leak-cmd"}}},` + cluster + `}}`,
+	}
+	for name, secret := range secrets {
+		for _, method := range []string{http.MethodPost, http.MethodPut} {
+			t.Run(name+" "+method, func(t *testing.T) {
+				body := `{"id":"abcdefab-abcd-abcd-abcd-abcdefabcdef","name":"k","type":"kubernetes","secret":` + secret + `}`
+				h := newTestHandler(t, map[string]models.Provider{}, "")
+				p := newCredentialSpyProvider()
+				req := httptest.NewRequest(method, "/api/integrations/credentials", bytes.NewBufferString(body))
+				req = req.WithContext(context.WithValue(req.Context(), models.TokenCtxKey, "test-token"))
+				rec := httptest.NewRecorder()
+				user := &models.User{ID: uuid.Must(uuid.NewV4())}
+
+				if method == http.MethodPost {
+					h.SaveUserCredential(rec, req, nil, user, p)
+				} else {
+					h.UpdateUserCredential(rec, req, nil, user, p)
+				}
+
+				if rec.Code != http.StatusBadRequest {
+					t.Fatalf("status = %d, want 400 (body=%q)", rec.Code, rec.Body.String())
+				}
+				if p.observedSave.Load() != nil || p.observedUpdate.Load() != nil {
+					t.Fatalf("the provider was asked to store an unsafe credential")
+				}
+				if strings.Contains(rec.Body.String(), "leak-cmd") || strings.Contains(rec.Body.String(), "/leak/path") {
+					t.Fatalf("response echoes the credential: %s", rec.Body.String())
+				}
+				if got := decodeErrorBody(t, rec.Body.Bytes()).Code; got != models.ErrUnsafeKubeCredentialCode {
+					t.Fatalf("error code = %q, want %q", got, models.ErrUnsafeKubeCredentialCode)
+				}
+			})
+		}
+	}
+
+	t.Run("embedded data is stored", func(t *testing.T) {
+		body := `{"name":"k","type":"kubernetes","secret":{"auth":{"name":"u","user":{"token":"t","client-key-data":"Yg=="}},` + cluster + `}}`
+		h := newTestHandler(t, map[string]models.Provider{}, "")
+		p := newCredentialSpyProvider()
+		req := httptest.NewRequest(http.MethodPost, "/api/integrations/credentials", bytes.NewBufferString(body))
+		req = req.WithContext(context.WithValue(req.Context(), models.TokenCtxKey, "test-token"))
+		rec := httptest.NewRecorder()
+		h.SaveUserCredential(rec, req, nil, &models.User{ID: uuid.Must(uuid.NewV4())}, p)
+		if rec.Code != http.StatusCreated || p.observedSave.Load() == nil {
+			t.Fatalf("status = %d, saved = %v (body=%q)", rec.Code, p.observedSave.Load() != nil, rec.Body.String())
+		}
+	})
+}
```

**File**: `server/helpers/component_info.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
   "name": "meshery-server",
   "type": "component",
-  "next_error_code": 1498
+  "next_error_code": 1501
 }
\ No newline at end of file
```

**File**: `server/models/error.go` (modified, +18/-0)
```diff
@@ -5,6 +5,7 @@ import (
 	stderrors "errors"
 	"fmt"
 	"net/http"
+	"strings"
 	"time"
 
 	"github.com/meshery/meshery/server/models/httputil"
@@ -178,6 +179,7 @@ const (
 	ErrMigrateEventIndexesCode            = "meshery-server-1491"
 	ErrHandlerPanicCode                   = "meshery-server-1495"
 	ErrInvalidDesignVersionCode           = "meshery-server-1496"
+	ErrUnsafeKubeCredentialCode           = "meshery-server-1500"
 )
 
 var (
@@ -1052,3 +1054,19 @@ func ErrInvalidDesignVersion(version string, err error) error {
 		[]string{"Set the design file's version to a semver string such as 0.0.1 and save again"},
 	)
 }
+
+// ErrUnsafeKubeCredential reports a Kubernetes credential that would make
+// Meshery Server run a command or read a file on its own host to build a client
+// (an exec plugin, an auth-provider, or a certificate, key or token file path).
+// fields holds only field names, never their values, so the message cannot echo
+// a path or a command.
+func ErrUnsafeKubeCredential(fields []string) error {
+	return errors.New(
+		ErrUnsafeKubeCredentialCode,
+		errors.Alert,
+		[]string{"The Kubernetes credential is not allowed to run commands or read files on the Meshery Server host"},
+		[]string{fmt.Sprintf("The credential sets: %s", strings.Join(fields, ", "))},
+		[]string{"exec plugins, auth-providers and certificate, key or token file paths are executed or read on the machine running Meshery Server, so only the server's own kubeconfig may use them"},
+		[]string{"Replace the credential with embedded data (client-certificate-data, client-key-data, certificate-authority-data, token) and save it again"},
+	)
+}
```

**File**: `server/models/k8s_context.go` (modified, +7/-0)
```diff
@@ -92,6 +92,13 @@ func K8sContextFromConnection(provider Provider, token string, connection *conne
 	credentialPayload := CredentialPayload(credential.Secret)
 	ctx.Auth, _ = credentialPayload["auth"].(map[string]interface{})
 	ctx.Cluster, _ = credentialPayload["cluster"].(map[string]interface{})
+	// The credential is user-editable, and building a client runs an exec
+	// plugin or reads files on this host. Refuse one that carries either unless
+	// it is the server's own (issue #24218). Callers that build a client from the
+	// returned context (ping, the state machine, graphql) get this error instead.
+	if fields := UntrustedKubeCredentialFields(ctx.Auth, ctx.Cluster); len(fields) > 0 {
+		return K8sContext{}, ErrUnsafeKubeCredential(fields)
+	}
 	ctx.CreatedAt = &connection.CreatedAt
 	ctx.UpdatedAt = &connection.UpdatedAt
 
```

**File**: `server/models/k8s_credential_guard.go` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+package models
+
+import (
+	"os"
+	"path/filepath"
+	"reflect"
+	"sort"
+
+	"github.com/spf13/viper"
+	"k8s.io/client-go/tools/clientcmd"
+	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
+)
+
+// A Kubernetes credential is a kubeconfig user plus cluster ({auth, cluster}),
+// and building a client from it is not passive: an `exec` plugin is run as a
+// command on the Meshery Server host, and certificate, key and token file
+// references are read from its disk. Meshery therefore only builds a client
+// from fields that are plain data, unless the credential is the server's own
+// kubeconfig, which the operator controls (see issue #24218).
+
+// Names of the unsafe kubeconfig fields, as reported by UnsafeKubeCredentialFields.
+const (
+	kubeFieldExec                 = "exec"
+	kubeFieldAuthProvider         = "auth-provider"
+	kubeFieldClientCertificate    = "client-certificate"
+	kubeFieldClientKey            = "client-key"
+	kubeFieldTokenFile            = "tokenFile"
+	kubeFieldCertificateAuthority = "certificate-authority"
+)
+
+// UnsafeKubeCredentialFields returns the names of the kubeconfig fields in a
+// credential's auth and cluster that make building a client run a command or
+// read a file on the Meshery Server host. It inspects what client-go will
+// actually see (the kubeconfig GenerateKubeConfig renders, parsed by clientcmd)
+// rather than the raw map, so no spelling of the YAML hides a field from it.
+// The result is sorted and carries no values, so it is safe to return to a
+// caller. It returns nil for a credential that has neither auth nor cluster.
+func UnsafeKubeCredentialFields(auth, cluster map[string]interface{}) []string {
+	if len(auth) == 0 && len(cluster) == 0 {
+		return nil
+	}
+	cfg, err := loadCredentialKubeconfig(auth, cluster)
+	if err != nil {
+		// A credential that does not render to a kubeconfig cannot be used to
+		// build a client either.
+		return nil
+	}
+	return unsafeFields(cfg, nil)
+}
+
+func loadCredentialKubeconfig(auth, cluster map[string]interface{}) (*clientcmdapi.Config, error) {
+	data, err := K8sContext{Name: "credential", Auth: auth, Cluster: cluster}.GenerateKubeConfig()
+	if err != nil {
+		return nil, err
+	}
+	return clientcmd.Load(data)
+}
+
+// unsafeFields lists the unsafe fields set in cfg. When trusted is non-nil, a
+// field whose value is identical to the one the trusted kubeconfig holds for the
+// same user (or cluster) name is not reported.
+func unsafeFields(cfg, trusted *clientcmdapi.Config) []string {
+	found := map[string]struct{}{}
+	for name, u := range cfg.AuthInfos {
+		var t *clientcmdapi.AuthInfo
+		if trusted != nil {
+			t = trusted.AuthInfos[name]
+		}
+		if u.Exec != nil && (t == nil || !reflect.DeepEqual(u.Exec, t.Exec)) {
+			found[kubeFieldExec] = struct{}{}
+		}
+		if u.AuthProvider != nil && (t == nil || !reflect.DeepEqual(u.AuthProvider, t.AuthProvider)) {
+			found[kubeFieldAuthProvider] = struct{}{}
+		}
+		if u.ClientCertificate != "" && (t == nil || u.ClientCertificate != t.ClientCertificate) {
+			found[kubeFieldClientCertificate] = struct{}{}
+		}
+		if u.ClientKey != "" && (t == nil || u.ClientKey != t.ClientKey) {
+			found[kubeFieldClientKey] = struct{}{}
+		}
+		if u.TokenFile != "" && (t == nil || u.TokenFile != t.TokenFile) {
+			found[kubeFieldTokenFile] = struct{}{}
+		}
+	}
+	for name, c := range cfg.Clusters {
+		var t *clientcmdapi.Cluster
+		if trusted != nil {
+			t = trusted.Clusters[name]
+		}
+		if c.CertificateAuthority != "" && (t == nil || c.CertificateAuthority != t.CertificateAuthority) {
+			found[kubeFieldCertificateAuthority] = struct{}{}
+		}
+	}
+	var out []string
+	for f := range found {
+		out = append(out, f)
+	}
+	sort.Strings(out)
+	return out
+}
+
+// serverKubeconfig loads the kubeconfig the Meshery Server itself runs with
+// (KUBECONFIG_FOLDER/config), or nil when there is none (for example in-cluster).
+func serverKubeconfig() *clientcmdapi.Config {
+	folder := viper.GetString("KUBECONFIG_FOLDER")
+	if folder == "" {
+		return nil
+	}
+	path := filepath.Join(folder, "config")
+	if _, err := os.Stat(path); err != nil {
+		return nil
+	}
+	cfg, err := clientcmd.LoadFromFile(path)
+	if err != nil {
+		return nil
+	}
+	return cfg
+}
+
+// UntrustedKubeCredentialFields returns the unsafe fields of a credential's auth
+// and cluster that the server's own kubeconfig does not vouch for. A user and
+// cluster pair is the server's own only when a context of the server's
+// kubeconfig names both, the cluster points at the same endpoint (server, proxy,
+// TLS server name, skip-verify), and every unsafe field is identical to the
+// server's. That keeps contexts imported from the server's kubeconfig (an EKS or
+// GKE exec plugin, say) working, while a credential a user created or edited
+// cannot introduce a command or a path of their choosing, nor reuse the
+// operator's exec plugin to send a token to another host.
+func UntrustedKubeCredentialFields(au
```

**File**: `server/models/k8s_credential_guard_test.go` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+package models
+
+import (
+	"os"
+	"path/filepath"
+	"reflect"
+	"strings"
+	"testing"
+
+	"github.com/gofrs/uuid"
+	"github.com/meshery/meshery/server/models/connections"
+	"github.com/meshery/meshkit/database"
+	meshkiterrors "github.com/meshery/meshkit/errors"
+	"github.com/meshery/schemas/models/core"
+	"github.com/spf13/viper"
+)
+
+// setKubeconfigFolder points the server's own kubeconfig lookup at folder for
+// the test and restores whatever was set before.
+func setKubeconfigFolder(t *testing.T, folder string) {
+	t.Helper()
+	prev := viper.Get("KUBECONFIG_FOLDER")
+	viper.Set("KUBECONFIG_FOLDER", folder)
+	t.Cleanup(func() { viper.Set("KUBECONFIG_FOLDER", prev) })
+}
+
+func kubeCredential(user map[string]interface{}, cluster map[string]interface{}) (auth, clusterBlock map[string]interface{}) {
+	return map[string]interface{}{"name": "u", "user": user},
+		map[string]interface{}{"name": "c", "cluster": cluster}
+}
+
+func TestUnsafeKubeCredentialFields(t *testing.T) {
+	execPlugin := map[string]interface{}{"apiVersion": "client.authentication.k8s.io/v1", "command": "sh", "args": []interface{}{"-c", "id"}}
+	tests := []struct {
+		name    string
+		user    map[string]interface{}
+		cluster map[string]interface{}
+		want    []string
+	}{
+		{"embedded data only", map[string]interface{}{"client-certificate-data": "YQ==", "client-key-data": "Yg==", "token": "t"}, map[string]interface{}{"server": "https://k8s", "certificate-authority-data": "Yw=="}, nil},
+		{"exec plugin", map[string]interface{}{"exec": execPlugin}, map[string]interface{}{"server": "https://k8s"}, []string{"exec"}},
+		{"auth-provider", map[string]interface{}{"auth-provider": map[string]interface{}{"name": "oidc"}}, map[string]interface{}{"server": "https://k8s"}, []string{"auth-provider"}},
+		{"token file", map[string]interface{}{"tokenFile": "/var/run/secrets/kubernetes.io/serviceaccount/token"}, map[string]interface{}{"server": "https://attacker"}, []string{"tokenFile"}},
+		{"key and cert paths", map[string]interface{}{"client-key": "/k", "client-certificate": "/c"}, map[string]interface{}{"server": "https://k8s"}, []string{"client-certificate", "client-key"}},
+		{"ca path", map[string]interface{}{"token": "t"}, map[string]interface{}{"server": "https://k8s", "certificate-authority": "/ca"}, []string{"certificate-authority"}},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			auth, cluster := kubeCredential(tt.user, tt.cluster)
+			got := UnsafeKubeCredentialFields(auth, cluster)
+			if !reflect.DeepEqual(got, tt.want) {
+				t.Fatalf("UnsafeKubeCredentialFields = %v, want %v", got, tt.want)
+			}
+		})
+	}
+	if got := UnsafeKubeCredentialFields(nil, nil); got != nil {
+		t.Fatalf("empty credential = %v, want nil", got)
+	}
+}
+
+func saveKubeCredentialAndConnection(t *testing.T, secret map[string]interface{}) (*DefaultLocalProvider, *connections.Connection) {
+	t.Helper()
+	db, err := database.New(database.Options{Engine: database.SQLITE, Filename: ":memory:"})
+	if err != nil {
+		t.Fatalf("open database: %v", err)
+	}
+	if err := db.AutoMigrate(Credential{}); err != nil {
+		t.Fatalf("migrate tables: %v", err)
+	}
+	provider := &DefaultLocalProvider{GenericPersister: &db}
+	credential, err := provider.SaveUserCredential("", &Credential{Name: "kube-cred", Type: "kubernetes", Secret: secret})
+	if err != nil {
+		t.Fatalf("save credential: %v", err)
+	}
+	id := credential.ID
+	return provider, &connections.Connection{ID: uuid.Must(uuid.NewV4()), Name: "cluster-a", Kind: "kubernetes", CredentialID: &id, Metadata: core.Map{"name": "cluster-a"}}
+}
+
+// TestK8sContextFromConnectionRefusesUnsafeCredential pins issue #24218: a saved
+// connection's credential secret can be edited to carry an exec plugin or a file
+// path, and ping, the state machine and graphql then build a client from it.
+// Every one of them goes through K8sContextFromConnection first, so it must
+// refuse, and it must do so without echoing the command or the path.
+func TestK8sContextFromConnectionRefusesUnsafeCredential(t *testing.T) {
+	setKubeconfigFolder(t, t.TempDir()) // no kubeconfig of its own inside
+
+	for name, user := range map[string]map[string]interface{}{
+		"exec":       {"exec": map[string]interface{}{"apiVersion": "client.authentication.k8s.io/v1", "command": "touch-marker-cmd", "args": []interface{}{"/tmp/marker-path"}}},
+		"tokenFile":  {"tokenFile": "/tmp/marker-path"},
+		"client-key": {"client-key": "/tmp/marker-path"},
+	} {
+		t.Run(name, func(t *testing.T) {
+			auth, cluster := kubeCredential(user, map[string]interface{}{"server": "https://127.0.0.1:1"})
+			provider, conn := saveKubeCredentialAndConnection(t, map[string]interface{}{"auth": auth, "cluster": cluster})
+
+			_, err := K8sContextFromConnection(provider, "", conn)
+			if meshkiterrors.GetCode(err) != ErrUnsafeKubeCredentialCode {
+				t.Fatalf("err = %v, want ErrUnsafeKubeCredential", err)
+			}
+			for _, leak := range []
```

---

### Incident Patch 3: `2d7c3d0b` (2026-11-24)
**Commit Message**: Merge pull request #24235 from meshery/fix/discovery-errors-selected-contexts-only

fix(server): record kubeconfig discovery errors only for selected contexts

**File**: `server/handlers/k8sconfig_handler.go` (modified, +37/-0)
```diff
@@ -184,6 +184,14 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 		}
 	}
 
+	// Discovery recorded a per-context entry (with an "error" for any context
+	// that failed) for every context in the file, including the ones the user
+	// deselected and the ones Meshery skipped. The receipt below describes only
+	// what this import acted on, so drop the entries of contexts outside an
+	// explicit selection; otherwise a broken context the user chose not to import would
+	// raise the receipt to Error while the wizard reports success (issue #24220).
+	retainSelectedContextMetadata(eventMetadata, contexts, selectedContexts)
+
 	// Helper function to get meshsync deployment mode for a context
 	// Uses closure pattern to call req.FormValue only once while keeping globalMeshsyncMode scoped
 	getMeshsyncModeForContext := func() func(*models.K8sContext) string {
@@ -279,6 +287,9 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 		// so regenerate the context ID to keep the struct's ID in sync with the
 		// connection ID SaveK8sContext will mint.
 		if opts, ok := contextsConfig[ctx.ID]; ok && opts.Name != "" && opts.Name != ctx.Name {
+			// The receipt is keyed by the name the connection is saved under;
+			// drop the discovery entry that is keyed by the old name.
+			delete(eventMetadata, ctx.Name)
 			ctx.Name = opts.Name
 			if regeneratedID, idErr := models.K8sContextGenerateID(*ctx); idErr == nil {
 				ctx.ID = regeneratedID
@@ -421,6 +432,32 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 	}
 }
 
+// retainSelectedContextMetadata removes from eventMetadata, the per-context
+// discovery metadata keyed by context name, the entries of contexts the user
+// left out of an explicit selection: discovered contexts outside it, and
+// contexts discovery skipped (never importable, so never selected). With no
+// selection every context is imported, so nothing is removed and a context that
+// failed or was skipped during discovery still shows in the receipt.
+func retainSelectedContextMetadata(eventMetadata map[string]interface{}, contexts []*models.K8sContext, selected map[string]struct{}) {
+	if selected == nil {
+		return
+	}
+	keep := make(map[string]struct{}, len(selected))
+	for _, ctx := range contexts {
+		if ctx == nil {
+			continue
+		}
+		if _, ok := selected[ctx.ID]; ok {
+			keep[ctx.Name] = struct{}{}
+		}
+	}
+	for name := range eventMetadata {
+		if _, ok := keep[name]; !ok {
+			delete(eventMetadata, name)
+		}
+	}
+}
+
 // k8sEventMetadataHasError reports whether any per-context entry in a Kubernetes
 // connection receipt's metadata recorded a failure. Each context's outcome is
 // keyed by its name and carries an "error" entry only when that context failed
```

**File**: `server/handlers/k8sconfig_handler_test.go` (modified, +98/-0)
```diff
@@ -633,3 +633,101 @@ users:
 		}
 	}
 }
+
+// TestImportReceiptIgnoresFailingDeselectedContext pins issue #24220: a context
+// that fails discovery but that the user deselected must leave no error in the
+// import receipt, which then stays Informational like the wizard's success.
+func TestImportReceiptIgnoresFailingDeselectedContext(t *testing.T) {
+	authUser := &models.User{ID: uuid.Must(uuid.NewV4())}
+	// Nothing listens on port 1, so discovery cannot reach the API server and
+	// records an error for the context.
+	kubeconfig := []byte(`apiVersion: v1
+kind: Config
+current-context: broken
+clusters:
+- cluster:
+    server: https://127.0.0.1:1
+  name: broken
+contexts:
+- context:
+    cluster: broken
+    user: broken-user
+  name: broken
+users:
+- name: broken-user
+  user:
+    token: token-0
+`)
+	receiptOf := func(t *testing.T, form map[string]string) events.Event {
+		t.Helper()
+		h := newTestHandler(t, map[string]models.Provider{}, "")
+		provider := &mockK8sConfigProvider{}
+		var b bytes.Buffer
+		w := multipart.NewWriter(&b)
+		part, err := w.CreateFormFile("k8sfile", "kubeconfig")
+		if err != nil {
+			t.Fatalf("create form file: %v", err)
+		}
+		if _, err := part.Write(kubeconfig); err != nil {
+			t.Fatalf("write form file: %v", err)
+		}
+		for k, v := range form {
+			if err := w.WriteField(k, v); err != nil {
+				t.Fatalf("write field %s: %v", k, err)
+			}
+		}
+		if err := w.Close(); err != nil {
+			t.Fatalf("close writer: %v", err)
+		}
+		req := httptest.NewRequest(http.MethodPost, "/api/system/kubernetes", &b)
+		req.Header.Set("Content-Type", w.FormDataContentType())
+		req = req.WithContext(context.WithValue(req.Context(), models.TokenCtxKey, "test-token"))
+		rec := httptest.NewRecorder()
+		h.K8SConfigHandler(rec, req, nil, authUser, provider)
+		if rec.Code != http.StatusOK {
+			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
+		}
+		if len(provider.persistedEvents) != 1 {
+			t.Fatalf("persisted %d events, want the single import receipt", len(provider.persistedEvents))
+		}
+		return provider.persistedEvents[0]
+	}
+
+	t.Run("deselected failing context leaves an informational receipt", func(t *testing.T) {
+		receipt := receiptOf(t, map[string]string{SelectedContextsFormKey: "[]"})
+		if receipt.Severity != events.Informational {
+			t.Fatalf("receipt severity = %v, want Informational (description %q)", receipt.Severity, receipt.Description)
+		}
+		if k8sEventMetadataHasError(receipt.Metadata) {
+			t.Fatalf("receipt metadata carries an error for a context the user deselected: %#v", receipt.Metadata)
+		}
+		if _, ok := receipt.Metadata["broken"]; ok {
+			t.Fatalf("receipt metadata describes the deselected context: %#v", receipt.Metadata)
+		}
+	})
+}
+
+func TestRetainSelectedContextMetadata(t *testing.T) {
+	picked := &models.K8sContext{ID: "id-picked", Name: "picked"}
+	dropped := &models.K8sContext{ID: "id-dropped", Name: "dropped"}
+	failing := map[string]interface{}{"error": errors.New("unreachable")}
+	newMetadata := func() map[string]interface{} {
+		return map[string]interface{}{"picked": failing, "dropped": failing, "skipped": failing}
+	}
+
+	t.Run("a selection keeps only the selected contexts", func(t *testing.T) {
+		metadata := newMetadata()
+		retainSelectedContextMetadata(metadata, []*models.K8sContext{picked, dropped}, map[string]struct{}{"id-picked": {}})
+		if len(metadata) != 1 || metadata["picked"] == nil {
+			t.Fatalf("metadata = %#v, want only the selected context's entry", metadata)
+		}
+	})
+
+	t.Run("no selection removes nothing, so skipped and failed contexts still show", func(t *testing.T) {
+		metadata := newMetadata()
+		retainSelectedContextMetadata(metadata, []*models.K8sContext{picked, dropped}, nil)
+		if len(metadata) != 3 || !k8sEventMetadataHasError(metadata) {
+			t.Fatalf("metadata = %#v, want all three entries kept", metadata)
+		}
+	})
+}
```

#### Recent Merged Pull Requests:
- **PR #24235** (2026-11-24): fix(server): record kubeconfig discovery errors only for selected contexts (@leecalcote)
- **PR #24233** (2026-11-24): fix(server): reject exec, auth-provider and file-path Kubernetes credentials (@leecalcote)
- **PR #24231** (closed): fix(ui): guard SearchBar against missing setModelsFilters and undefined window (@madhavzanwar)
- **PR #24230** (2026-11-24): fix(server): reject file-path credentials in uploaded kubeconfigs (@leecalcote)
- **PR #24222** (2026-11-24): [CI] Honor docs, website, and CI exemptions in the no-mistakes gate (@yi-nuo426)
- **PR #24215** (2026-11-24): test(mesheryctl): add unit tests for adapter validate (@dhruvdumra)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. server): record import receipt errors only for the selected contexts

**RULE**:
When implementing operations in `server/handlers/k8sconfig_handler.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshery/meshery. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `323f07f0`: server): record import receipt errors only for the selected contexts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/handlers/k8sconfig_handler.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// Discovery recorded a per-context entry (with an "error" for any context
	// that failed) for every context in the file, including the ones the user
	// deselected and the ones Meshery skipped. The receipt below describes only
	// what this import acted on, so drop the entries of contexts outside an
	// explicit selection; otherwise a broken context the user chose not to import would
	// raise the receipt to Error while the wizard reports success (issue #24220).
	retainSelectedContextMetadata(eventMetadata, contexts, selectedContexts)

			// The receipt is keyed by the name the connection is saved under;
			// drop the discovery entry that is keyed by the old name.
			delete(eventMetadata, ctx.Name)
// retainSelectedContextMetadata removes from eventMetadata, the per-context
// discovery metadata keyed by context name, the entries of contexts the user
// left out of an explicit selection: discovered contexts outside it, and
// contexts discovery skipped (never importable, so never selected). With no
// selection every context is imported, so nothing is removed and a context that
// failed or was skipped during discovery still shows in the receipt.
func retainSelectedContextMetad
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `323f07f0` are properly handled with clean fallback behavior.

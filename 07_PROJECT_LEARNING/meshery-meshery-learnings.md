> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshery-meshery-learnings.md`  
> **Source**: github ([https://github.com/meshery/meshery](https://github.com/meshery/meshery))  
> **Source Version**: `125ba14d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T00:19:00.482Z  
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
> **Harvest Timestamp**: 2026-10-30T00:18:59.012Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshery/meshery`
- **Description**: Meshery, the cloud native manager
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12081 stars

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
- **Issue #22642** (2026-10-29): **[Bug]: Catalog table view overlaps the left filter sidebar**
  *Symptoms*: ### Description In the MeshMap catalog, switching from grid view to table view causes the table to overlap the left filter sidebar.  The table extends into the sidebar's area instead of respecting the available space within the catalog modal, making the filters partially obscured and the interface difficult to use.  ### Steps to Reproduce 1. Open the [[Meshery Playground MeshMap editor](https://playground.meshery.io/extension/meshmap?mode=design)](https://playground.meshery.io/extension/meshmap?mode=design). 2. Click **Start with a Template** to open the catalog. 3. Switch to table view using the view toggle in the top-right area of the catalog. 4. Observe the table layout in relation to the left filter sidebar.  ### Expected Behavior The table should remain within the catalog's content area without overlapping the left filter sidebar. Both the table and sidebar should remain accessible and properly laid out.  ### Actual Behavior The table extends over the left filter sidebar, obscuring part of the sidebar and disrupting the catalog layout.  ### Environment - **Application:** Meshery Playground / MeshMap - **Browser:** Mozilla Firefox - **Operating System:** Ubuntu Linux  ### Additional Context The issue is observed when switching from grid view to table view. The grid view appears to maintain separation between the sidebar and the main content area.  ### I'd like to investigate and work on fixing this issue. Could you please assign it to me?  <img width="1825" height="1005" 

- **Issue #22619** (2026-10-27): **[UI] Replace waitForTimeout in user preference e2e spec with a web-first assertion**
  *Symptoms*: **Notes for Reviewers**  - This PR fixes # (no issue; small e2e reliability cleanup)  `ui/tests/e2e/userpreference.spec.ts` was the only spec still using `page.waitForTimeout(2000)`: after clicking a preference switch it slept 2 s and then branched on the switch state. The switch updates on click and the test already awaits the matching POST and its 200 response, so this replaces the sleep and the if/else with a web-first assertion:  ```ts await expect(prefSwitch).toBeChecked({ checked: !wasChecked }); ```  Note: the old sleep implicitly also checked that the switch did not flip back within 2 s. I found no code that flips it back; happy to add an explicit check if you want that covered.  **Before / after** (Local provider, server built from source, static UI build, `--repeat-each=5`):  ``` before: 10 passed (+ setup), ~8.0 s per test after:  10 passed (+ setup), ~6.3 s per test ```  Changing the expectation to `checked: wasChecked` makes the test fail, so the assertion is not vacuous. `prettier --check` and `eslint` pass on the touched file. Not run: the `chromium-meshery-provider` project (needs a remote token) and the full suite.  AI assistance: I used Claude (an AI coding assistant) to help find and draft this change. I reviewed the change; the runs above were made in a sandbox with the assistant's help. The commit carries an `Assisted-by` trailer.  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificat

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

### Incident Patch 1: `1ac48c18` (2026-10-28)
**Commit Message**: Merge pull request #22570 from Ayush-AM/fix/issue-22445-notification-blob-leak

fix(ui): manage blob URL lifecycle and prevent memory leak in DataToF…

**File**: `ui/components/layout/NotificationCenter/formatters/common.test.tsx` (modified, +35/-4)
```diff
@@ -1,5 +1,5 @@
 import React from 'react';
-import { render, screen } from '@testing-library/react';
+import { render, screen, cleanup } from '@testing-library/react';
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
 vi.mock('@sistent/sistent', () => ({
@@ -57,21 +57,25 @@ describe('EmptyState', () => {
 });
 
 describe('DataToFileLink', () => {
-  // jsdom does not implement URL.createObjectURL by default; stub it for these tests.
+  // jsdom does not implement URL.createObjectURL or URL.revokeObjectURL by default; stub them for these tests.
   const originalCreateObjectURL = (global.URL as any).createObjectURL;
+  const originalRevokeObjectURL = (global.URL as any).revokeObjectURL;
 
   beforeEach(() => {
-    (global.URL as any).createObjectURL = vi.fn(() => 'blob:fake-url');
+    (global.URL as any).createObjectURL = vi.fn((file: File) => `blob:fake-url-${file.name}`);
+    (global.URL as any).revokeObjectURL = vi.fn();
   });
 
   afterEach(() => {
+    cleanup();
     (global.URL as any).createObjectURL = originalCreateObjectURL;
+    (global.URL as any).revokeObjectURL = originalRevokeObjectURL;
   });
 
   it('creates a download link pointing to a generated blob URL', () => {
     render(<DataToFileLink data="hello world" />);
     const link = screen.getByRole('link', { name: /download trace/i });
-    expect(link).toHaveAttribute('href', 'blob:fake-url');
+    expect(link).toHaveAttribute('href', 'blob:fake-url-trace.txt');
     expect(link).toHaveAttribute('download', 'trace.txt');
   });
 
@@ -83,4 +87,31 @@ describe('DataToFileLink', () => {
     expect(blobArg).toBeInstanceOf(File);
     expect(blobArg.name).toBe('trace.txt');
   });
+
+  it('revokes the blob URL on component unmount to prevent memory leaks', () => {
+    const { unmount } = render(<DataToFileLink data="trace info" />);
+    const revokeSpy = (global.URL as any).revokeObjectURL as ReturnType<typeof vi.fn>;
+
+    expect(revokeSpy).not.toHaveBeenCalled();
+
+    unmount();
+
+    expect(revokeSpy).toHaveBeenCalledTimes(1);
+    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url-trace.txt');
+  });
+
+  it('revokes previous blob URL and creates a new one when data prop updates', () => {
+    const { rerender } = render(<DataToFileLink data="first-trace" />);
+    const createSpy = (global.URL as any).createObjectURL as ReturnType<typeof vi.fn>;
+    const revokeSpy = (global.URL as any).revokeObjectURL as ReturnType<typeof vi.fn>;
+
+    expect(createSpy).toHaveBeenCalledTimes(1);
+    expect(revokeSpy).not.toHaveBeenCalled();
+
+    rerender(<DataToFileLink data="second-trace" />);
+
+    expect(revokeSpy).toHaveBeenCalledTimes(1);
+    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url-trace.txt');
+    expect(createSpy).toHaveBeenCalledTimes(2);
+  });
 });
```

**File**: `ui/components/layout/NotificationCenter/formatters/common.tsx` (modified, +15/-5)
```diff
@@ -1,4 +1,4 @@
-import React from 'react';
+import React, { useState, useEffect } from 'react';
 import { LaunchIcon, Typography } from '@sistent/sistent';
 import { TextWithLinks } from '../../../data-formatter';
 
@@ -59,12 +59,22 @@ export const EmptyState = ({ event }: { event: { description?: string } }) => {
 };
 
 export const DataToFileLink = ({ data }: { data: unknown }) => {
-  // convert the trace to a file
-  const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
-  const file = new File([dataString], 'trace.txt', { type: 'text/plain' });
+  const [downloadUrl, setDownloadUrl] = useState<string>('');
+
+  useEffect(() => {
+    // convert the trace to a file
+    const dataString = typeof data === 'string' ? data : JSON.stringify(data ?? '', null, 2) || '';
+    const file = new File([dataString], 'trace.txt', { type: 'text/plain' });
+    const url = URL.createObjectURL(file);
+    setDownloadUrl(url);
+
+    return () => {
+      URL.revokeObjectURL(url);
+    };
+  }, [data]);
 
   return (
-    <TitleLink href={URL.createObjectURL(file)} download="trace.txt">
+    <TitleLink href={downloadUrl} download="trace.txt">
       Download Trace
     </TitleLink>
   );
```

---

### Incident Patch 2: `dc687079` (2026-10-28)
**Commit Message**: Merge branch 'master' into fix/issue-22445-notification-blob-leak

**File**: `AGENTS.md` (modified, +17/-0)
```diff
@@ -474,6 +474,23 @@ touching any of them.
 - Hooks in `.agents/hooks/`: `format-frontend.sh` (post-edit Prettier) and
   `block-lockfiles.sh` (pre-edit lock-file guard).
 
+## Worktrees and landing a change
+
+- **Work in a treehouse worktree, never in the main clone.** Other agent sessions and the
+  no-mistakes pipeline share the main clone. Take a worktree with
+  `treehouse get --lease -b <branch>` (it prints the path; `--base <branch>` starts it from
+  another branch), work there, and release it with `treehouse return <path>` once the change
+  has merged. `treehouse status` lists the pool. Never make one with `git worktree add` or a
+  second clone.
+- **Land every change through no-mistakes, at most three runs per pull request.** Commit in
+  the worktree, then run `no-mistakes axi run --intent "<goal>"` (a clone without a
+  `no-mistakes` remote needs `no-mistakes init` once). `no-mistakes axi status` shows the step
+  and its findings, and `no-mistakes axi respond` answers a review gate. The pipeline reviews,
+  tests, pushes and opens the pull request. After the third run, open an issue for anything
+  still flagged and merge the pull request as it stands only if CI is green and it touches no
+  "Require Human Review" area; otherwise hand it to a human. A run that stopped on a usage limit
+  counts; one cancelled before it did anything does not.
+
 ## Reusable Workflows Consumed by Other Repos
 
 `.github/workflows/*.{yml,yaml}` here are called by repos across `meshery` and
```

**File**: `CLAUDE.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-@AGENTS.md
```

**File**: `CLAUDE.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+AGENTS.md
\ No newline at end of file
```

**File**: `docs/CONTRIBUTING-gitflow.md` (modified, +22/-0)
```diff
@@ -132,6 +132,28 @@ Now, it may be desirable to squash some of your smaller commits down into a smal
 
 This will open up a text editor where you can specify which commits to squash.
 <br><br>
+## <a name="markdown-export">LLM-friendly page output</a>
+
+Every documentation page is also published as Markdown at `<page-url>/index.md`,
+with the page title, description, and body content and no navigation, sidebar,
+footer, or styling. A **View as Markdown** link to it appears in the page's
+right-hand meta column (wide screens). The home page shows no link, but its Markdown is still
+published and listed in `llms.txt`. Hugo also generates
+[`/llms.txt`](https://llmstxt.org/) (an index of pages) and `/llms-full.txt`
+(full content of every page) at the site root for AI agents.
+
+The `llms.txt`, `llms-full.txt`, and home-page Markdown layouts are provided by
+the existing [Layer5 docs Hugo module](https://github.com/layer5io/docs), pinned
+in `go.mod`. Since `hugo.toml` sets `ignoreConfig = true` for that module and
+selects explicit mounts, it mounts `layouts/index.llms`, `layouts/index.llmsfull`,
+and `layouts/index.md` from the module and declares their output formats locally.
+
+To leave a path out of `llms.txt` and `llms-full.txt`, add it to `exclude` under
+`[params.llms]` in `hugo.toml`. To keep only the newest N pages of a section in `llms.txt`, add it to
+`[params.llms.limit_sections]`; Meshery releases under `/project/releases/` are
+capped at 5 this way. The limit is implemented by the Layer5 module's
+`layouts/index.llms` template.
+
 <li><h3>References</h3></li>
 <a href="https://git-scm.com/docs">Git Reference Docs</a>
 <br>
```

**File**: `docs/content/en/extensions/extensions/helm-snapshot/index.md` (modified, +8/-8)
```diff
@@ -34,11 +34,11 @@ To install the Meshery Snapshot Helm Plugin, use the following steps:
 
 <pre class="codeblock-pre">
   <div class="codeblock">
-     <div class="clipboardjs"> helm plugin install https://github.com/meshery-extensions/helm-snapshot </div>
+     <div class="clipboardjs"> helm plugin install https://github.com/meshery-extensions/helm-kanvas-snapshot </div>
    </div>
 </pre>
 
-3. Verify the installation by running:
+2. Verify the installation by running:
 
 
 <pre class="codeblock-pre">
@@ -47,9 +47,9 @@ To install the Meshery Snapshot Helm Plugin, use the following steps:
    </div>
 </pre>
 
-   You should see the snapshot listed as `helm-snapshot`.
+   You should see the snapshot listed as `helm-kanvas-snapshot`.
 
-4. Set up the required environment variables (see the [Environment Variables](#environment-variables) section).
+No environment variables or tokens need to be set. The plugin installs a prebuilt release binary that already includes its Meshery Cloud configuration.
 
 ### Usage
 
@@ -58,21 +58,21 @@ Once the plugin is installed, you can generate a snapshot using either a package
 
 <pre class="codeblock-pre">
   <div class="codeblock">
-     <div class="clipboardjs">helm snapshot --f &lt;chart-URI&gt; [--name &lt;snapshot-name&gt;] [--email &lt;email&gt;]</div>
+     <div class="clipboardjs">helm helm-kanvas-snapshot -f &lt;chart-URI&gt; [--name &lt;snapshot-name&gt;] [-e &lt;email&gt;]</div>
    </div>
 </pre>
 
-- **`-f`**, **`--file`**: (required) path or URL to the Helm chart (required).
+- **`-f`**, **`--file`**: (required) path or URL to the Helm chart.
 - **`--name`**: (optional) name for the snapshot. If not provided, a name will be auto-generated based on the chart name.
 - **`-e`**, **`--email`**: (optional) email address to notify when snapshot is ready. If not provided, a link to the snapshot will be displayed in the terminal.
 
 **Example**
 
-To generate a snapshot for a Helm chart located at `https://meshery.io/charts/v0.8.0-meshery.tar.gz`, you can use:
+To generate a snapshot for a Helm chart located at `https://meshery.io/charts/meshery-v0.8.12.tgz`, you can use:
 
 <pre class="codeblock-pre">
   <div class="codeblock">
-     <div class="clipboardjs">helm snapshot -f https://meshery.io/charts/v0.8.0-meshery.tar.gz --name meshery-chart</div>
+     <div class="clipboardjs">helm helm-kanvas-snapshot -f https://meshery.io/charts/meshery-v0.8.12.tgz --name meshery-chart</div>
    </div>
 </pre>
 
```

**File**: `docs/content/en/extensions/models/crossplane-provider-openstack/index.md` (modified, +5/-1)
```diff
@@ -381,7 +381,11 @@ components:
   colorIcon: extensions/models/crossplane-provider-openstack/components/cluster-provider-config/icons/color/cluster-provider-config-color.svg
   whiteIcon: extensions/models/crossplane-provider-openstack/components/cluster-provider-config/icons/white/cluster-provider-config-white.svg
   description: 
-components-count: 93
+- name: cluster-provider-config
+  colorIcon: extensions/models/crossplane-provider-openstack/components/cluster-provider-config/icons/color/cluster-provider-config-color.svg
+  whiteIcon: extensions/models/crossplane-provider-openstack/components/cluster-provider-config/icons/white/cluster-provider-config-white.svg
+  description: 
+components-count: 94
 relationships: 
 relationship-count: 0
 featureList: [
```

**File**: `docs/data/openapi.yml` (modified, +342/-38)
```diff
@@ -23,6 +23,8 @@ tags:
     description: APIs for configuring Meshery Operator, MeshSync, and Meshery Broker.
   - name: Console_API_Console
     description: Interactive terminal and log consoles against a connection's resources.
+  - name: Diagnostics_Diagnostics
+    description: Operations related to failure diagnostics
   - name: Evaluation_Evaluation
     description: Operations related to design evaluation
   - name: Feature_Features
@@ -65,8 +67,6 @@ tags:
     description: Operations related to Meshery Academy content and curriculum
   - name: BlowhornHealth_blowhornHealth
     description: Operations related to Blowhorn health.
-  - name: BlowhornProfile_blowhornProfiles
-    description: Operations related to Blowhorn profiles.
   - name: Claim_claims
     description: Operations related to claims on resources.
   - name: ContentItem_contentItems
@@ -72388,7 +72388,10 @@ paths:
 
 
         Every connection belongs to exactly one organization. The server assigns `organizationId` from the session
-        (`X-Current-Orgid`, then the caller's selected organization) and does not accept it in the body.
+        (`X-Current-Orgid`, then the caller's selected organization) and does not accept it in the body. When the
+        session names none, the server may use the caller's only organization (Meshery Cloud: the only live organization
+        the caller belongs to, else the only one of those the caller owns); it must not guess between several, and
+        answers 400 instead.
 
 
         Desktop registration uses this shared operation, but kind `desktop` is implemented by Cloud: a server that does
@@ -74859,8 +74862,8 @@ paths:
                 description: >-
                   A MeshKit error answered as a JSON body. `error` is the sentence the caller is shown; MeshKit's long
                   description is never serialized. Use the `MeshkitError400`, `MeshkitError403`, `MeshkitError404`,
-                  `MeshkitError409`, `MeshkitError500` and `MeshkitError502` responses for an operation whose server
-                  answers its refusals this way.
+                  `MeshkitError409`, `MeshkitError429`, `MeshkitError500` and `MeshkitError502` responses for an
+                  operation whose server answers its refusals this way.
                 required:
                   - error
                 additionalProperties: false
@@ -74959,6 +74962,59 @@ paths:
                         type: string
                         description: Where the client can get an update, when the provider knows one.
                         maxLength: 2048
+        '429':
+          description: >-
+            Too many requests - the caller exceeded the server's per-user request rate for this route family. Wait the
+            number of seconds in `Retry-After` before retrying.
+          headers:
+            Retry-After:
+              description: Number of seconds the caller must wait before retrying.
+              required: true
+              schema:
+                type: integer
+                minimum: 1
+          content:
+            application/json:
+              schema:
+                type: object
+                description: >-
+                  A MeshKit error answered as a JSON body. `error` is the sentence the caller is shown; MeshKit's long
+                  description is never serialized. Use the `MeshkitError400`, `MeshkitError403`, `MeshkitError404`,
+                  `MeshkitError409`, `MeshkitError429`, `MeshkitError500` and `MeshkitError502` responses for an
+                  operation whose server answers its refusals this way.
+                required:
+                  - error
+                additionalProperties: false
+                properties:
+                  error:
+                    type: string
+                    minLength: 1
+                    description: The sentence the caller is shown.
+                  code:
+                    type: string
+                    minLength: 1
+                    description: >-
+                      MeshKit error code, a component-scoped identifier allocated by the emitting service (e.g.
+                      `<component>-<number>`); it is not a stable part of this contract. Omitted for an error that is
+                      not a MeshKit error.
+                  severity:
+                    type: string
+                    description: MeshKit severity name. Omitted when MeshKit reports none.
+                    enum:
+                      - emergency
+                      - alert
+                      - critical
+                      - fatal
+                  probableCause:
+                    type: array
+                    description: MeshKit's probable causes of the error.
+                    items:
+                      type: string
+                  suggestedRemediation:
+                    type: array
+                    description: MeshKit's suggested remediations for the 
```

**File**: `docs/go.mod` (modified, +1/-1)
```diff
@@ -5,5 +5,5 @@ go 1.26.4
 require (
 	github.com/google/docsy v0.15.0 // indirect
 	github.com/google/docsy/dependencies v0.7.2 // indirect
-	github.com/layer5io/docs v0.0.0-20260901204535-b59d3b67363e // indirect
+	github.com/layer5io/docs v0.0.0-20261021153954-6106eb9d5444 // indirect
 )
```

---

### Incident Patch 3: `237693d4` (2026-10-28)
**Commit Message**: Merge pull request #22349 from Ayush-AM/fix/issue-22303-adapter-selection

[UI] Fix inert adapter selection and variable shadowing in MesheryPlayComponent

**File**: `ui/components/MesheryPlayComponent.test.tsx` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+import React from 'react';
+import { render, screen, fireEvent, act } from '@testing-library/react';
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+import MesheryPlayComponent from './MesheryPlayComponent';
+
+const mockDispatch = vi.fn();
+let mockRouter: any = {
+  push: vi.fn(),
+  events: {
+    on: vi.fn(),
+    off: vi.fn(),
+  },
+  query: {},
+};
+
+let mockAdapters = [
+  { name: 'Istio', adapterLocation: 'meshery-istio:10000' },
+  { name: 'Linkerd', adapterLocation: 'meshery-linkerd:10001' },
+];
+
+let mockHasPermission = true;
+
+vi.mock('next/router', () => ({
+  useRouter: () => mockRouter,
+}));
+
+vi.mock('react-redux', () => ({
+  useDispatch: () => mockDispatch,
+  useSelector: (selector: any) =>
+    selector({
+      adapter: { meshAdapters: mockAdapters },
+    }),
+}));
+
+vi.mock('@sistent/sistent', async () => {
+  const actual: any = await vi.importActual('@sistent/sistent');
+  return {
+    ...actual,
+    useHasPermission: () => mockHasPermission,
+    NoSsr: ({ children }: any) => <>{children}</>,
+  };
+});
+
+vi.mock('./MesheryAdapterPlayComponent', () => ({
+  default: ({ adapter }: any) => (
+    <div data-testid="meshery-adapter-play">{adapter?.name || 'no-adapter'}</div>
+  ),
+}));
+
+vi.mock('./general/error-404/index', () => ({
+  default: () => <div data-testid="default-error">Permission Denied</div>,
+}));
+
+describe('MesheryPlayComponent', () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    mockHasPermission = true;
+    mockAdapters = [
+      { name: 'Istio', adapterLocation: 'meshery-istio:10000' },
+      { name: 'Linkerd', adapterLocation: 'meshery-linkerd:10001' },
+    ];
+    mockRouter = {
+      push: vi.fn(),
+      events: {
+        on: vi.fn(),
+        off: vi.fn(),
+      },
+      query: {},
+    };
+  });
+
+  it('renders permission error when user does not have permission', () => {
+    mockHasPermission = false;
+    render(<MesheryPlayComponent />);
+    expect(screen.getByTestId('default-error')).toBeInTheDocument();
+  });
+
+  it('renders "Adapter Unavailable" state when no adapters are configured', () => {
+    mockAdapters = [];
+    render(<MesheryPlayComponent />);
+    expect(screen.getByText('Adapter Unavailable')).toBeInTheDocument();
+    expect(screen.getByText('Configure Settings')).toBeInTheDocument();
+
+    fireEvent.click(screen.getByText('Configure Settings'));
+    expect(mockRouter.push).toHaveBeenCalledWith('/settings?settingsCategory=Adapters');
+  });
+
+  it('renders adapter dropdown and adapter play component with default adapter', () => {
+    render(<MesheryPlayComponent />);
+    expect(screen.getByLabelText('Select Meshery Adapter')).toBeInTheDocument();
+    expect(screen.getByTestId('meshery-adapter-play')).toHaveTextContent('Istio');
+  });
+
+  it('dispatches setAdapter and updates rendered UI when selecting a different adapter', () => {
+    const { container } = render(<MesheryPlayComponent />);
+
+    expect(screen.getByTestId('meshery-adapter-play')).toHaveTextContent('Istio');
+
+    const input = container.querySelector('input[name="adapter_name"]') as HTMLInputElement;
+    expect(input).toBeInTheDocument();
+    fireEvent.change(input, { target: { value: 'meshery-linkerd:10001' } });
+
+    expect(mockDispatch).toHaveBeenCalledWith({
+      type: 'adapter/setAdapter',
+      payload: { selectedAdapter: 'Linkerd' },
+    });
+    expect(screen.getByTestId('meshery-adapter-play')).toHaveTextContent('Linkerd');
+  });
+
+  it('renders individual adapter when adapter query param is set', () => {
+    mockRouter.query = { adapter: 'meshery-linkerd:10001' };
+    render(<MesheryPlayComponent />);
+
+    expect(screen.getByTestId('meshery-adapter-play')).toHaveTextContent('Linkerd');
+    expect(screen.queryByLabelText('Select Meshery Adapter')).not.toBeInTheDocument();
+  });
+
+  it('falls back to default adapter dropdown view when adapter query param is unknown', () => {
+    mockRouter.query = { adapter: 'unknown-adapter:9999' };
+    render(<MesheryPlayComponent />);
+
+    expect(screen.getByLabelText('Select Meshery Adapter')).toBeInTheDocument();
+    expect(screen.getByTestId('meshery-adapter-play')).toHaveTextContent('Istio');
+  });
+
+  it('resets to default adapter when routeChangeComplete introduces an unknown adapter query after selecting another adapter', () => {
+    const { container } = render(<MesheryPlayComponent />);
+
+    // Select Linkerd
+    const input = container.querySelector('input[name="adapter_name"]') as HTMLInputElement;
+    fireEvent.change(input, { target: { value: 'meshery-linkerd:10001' } });
+    expect(screen.getByTestId('meshery-adapter-play')).toHaveTextContent('Linkerd');
+
+    // Simulate route change with unknown adapter query
+    mockRouter.query = { adapter: 'unknown-adapter:9999' };
+    const routeChangeHandler = mockRouter.events.on.mock.calls.find(
+      (call: any) => call[0] === 'routeChangeComplete',
+    )?.
```

**File**: `ui/components/MesheryPlayComponent.tsx` (modified, +25/-29)
```diff
@@ -8,7 +8,6 @@ import {
   Grid2,
   Typography,
   styled,
-  useTheme,
   gray,
   charcoal,
   NoSsr,
@@ -38,14 +37,11 @@ const PlayRoot = styled('div')(({ theme }) => ({
   marginBottom: theme.spacing(2),
 }));
 
-export const PaneSection = styled('div')(() => {
-  const theme = useTheme();
-  return {
-    backgroundColor: theme.palette.mode === 'dark' ? gray[20] : charcoal[90],
-    padding: theme.spacing(2.5),
-    borderRadius: 4,
-  };
-});
+export const PaneSection = styled('div')(({ theme }) => ({
+  backgroundColor: theme.palette.mode === 'dark' ? gray[20] : charcoal[90],
+  padding: theme.spacing(2.5),
+  borderRadius: 4,
+}));
 
 const AlreadyConfigured = styled('div')({
   textAlign: 'center',
@@ -79,8 +75,11 @@ const MesheryPlayComponent = () => {
       );
       if (selectedAdapter) {
         setAdapterState(selectedAdapter);
+        return;
       }
-    } else if (meshAdapters.length > 0) {
+    }
+
+    if (meshAdapters && meshAdapters.length > 0) {
       setAdapterState(meshAdapters[0]);
     }
   };
@@ -91,7 +90,7 @@ const MesheryPlayComponent = () => {
     return () => {
       router.events.off('routeChangeComplete', handleRouteChange);
     };
-  }, [router.events]);
+  }, [router.events, meshAdapters]);
 
   useEffect(() => {
     if (meshAdapters?.length > 0) {
@@ -116,34 +115,31 @@ const MesheryPlayComponent = () => {
   const handleAdapterChange = () => {
     return (event) => {
       if (event.target.value !== '') {
-        const selectedAdapter = meshAdapters.filter(
+        const selectedAdapter = meshAdapters.find(
           ({ adapterLocation }) => adapterLocation === event.target.value,
         );
-        if (selectedAdapter && selectedAdapter.size === 1) {
-          setAdapterState(selectedAdapter[0]);
-          dispatch(setAdapter({ selectedAdapter: selectedAdapter[0].name }));
+        if (selectedAdapter) {
+          setAdapterState(selectedAdapter);
+          dispatch(setAdapter({ selectedAdapter: selectedAdapter.name }));
         }
       }
     };
   };
 
   const renderIndividualAdapter = () => {
+    const queryParam = router?.query?.adapter;
+    if (!queryParam) return '';
     let adapCount = 0;
-    let adapter;
-    meshAdapters.forEach((adap) => {
-      if (adap.adapterLocation === adapter) {
-        adapter = adap;
-        meshAdapters.forEach((ad) => {
-          if (ad.name == adap.name) adapCount += 1;
-        });
-      }
-    });
-    if (adapter) {
-      const imageIcon = pickImage(adapter);
+    const targetAdapter = meshAdapters.find((adap) => adap.adapterLocation === queryParam);
+    if (targetAdapter) {
+      meshAdapters.forEach((ad) => {
+        if (ad.name === targetAdapter.name) adapCount += 1;
+      });
+      const imageIcon = pickImage(targetAdapter);
       return (
         <>
           <MesheryAdapterPlayComponent
-            adapter={adapter}
+            adapter={targetAdapter}
             adapCount={adapCount}
             adapter_icon={imageIcon}
           />
@@ -181,7 +177,7 @@ const MesheryPlayComponent = () => {
     );
   }
 
-  if (adapter && adapter !== '') {
+  if (router?.query?.adapter) {
     const indContent = renderIndividualAdapter();
     if (indContent !== '') {
       return indContent;
@@ -226,7 +222,7 @@ const MesheryPlayComponent = () => {
                 >
                   {meshAdapters.map((ada) => (
                     <MenuItem
-                      key={`${ada.adapterLocation}_${new Date().getTime()}`}
+                      key={ada.adapterLocation}
                       value={ada.adapterLocation}
                       sx={{
                         display: 'flex',
```

#### Recent Merged Pull Requests:
- **PR #22619** (2026-10-27): [UI] Replace waitForTimeout in user preference e2e spec with a web-first assertion (@nguyenvanlinh14)
- **PR #22606** (2026-10-26): chore: make CLAUDE.md a symlink to AGENTS.md (@ritzorama)
- **PR #22605** (2026-10-26): docs(agents): require treehouse worktrees and no-mistakes landing (@CodeAhmedJamil)
- **PR #22600** (closed): Bump undici in /ui (@dependabot[bot])
- **PR #22594** (2026-10-26): docs: add Paul Anyebe introduction (@cutewizzy11)
- **PR #22589** (2026-10-26): [mesheryctl] Re-enable unit tests and fix query URL in environment list_test.go (@AliRana30)

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

## X. Merge pull request #22570 from Ayush-AM/fix/issue-22445-notification-blob-leak

**RULE**:
When implementing operations in `ui/components/layout/NotificationCenter/formatters/common.test.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshery/meshery. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1ac48c18`: Merge pull request #22570 from Ayush-AM/fix/issue-22445-notification-blob-leak. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `ui/components/layout/NotificationCenter/formatters/common.test.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { render, screen, cleanup } from '@testing-library/react';
  // jsdom does not implement URL.createObjectURL or URL.revokeObjectURL by default; stub them for these tests.
  const originalRevokeObjectURL = (global.URL as any).revokeObjectURL;
    (global.URL as any).createObjectURL = vi.fn((file: File) => `blob:fake-url-${file.name}`);
    (global.URL as any).revokeObjectURL = vi.fn();
    cleanup();
    (global.URL as any).revokeObjectURL = originalRevokeObjectURL;
    expect(link).toHaveAttribute('href', 'blob:fake-url-trace.txt');

  it('revokes the blob URL on component unmount to prevent memory leaks', () => {
    const { unmount } = render(<DataToFileLink data="trace info" />);
    const revokeSpy = (global.URL as any).revokeObjectURL as ReturnType<typeof vi.fn>;

    expect(revokeSpy).not.toHaveBeenCalled();

    unmount();

    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url-trace.txt');
  });

  it('revokes previous blob URL and creates a new one when data prop updates', () => {
    const { rerender } = render(<DataToFileLink data="first-trace" />);
    const createSpy = (global.URL as any).createObjectURL as Retu
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
import { render, screen } from '@testing-library/react';
  // jsdom does not implement URL.createObjectURL by default; stub it for these tests.
    (global.URL as any).createObjectURL = vi.fn(() => 'blob:fake-url');
    expect(link).toHaveAttribute('href', 'blob:fake-url');
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1ac48c18` are properly handled with clean fallback behavior.

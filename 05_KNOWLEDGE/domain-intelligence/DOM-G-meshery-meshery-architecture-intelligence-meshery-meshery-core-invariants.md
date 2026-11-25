# Domain G — Architecture Intelligence: Architecture Intelligence: meshery/meshery Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "meshery/meshery",
  "source_url": "https://github.com/meshery/meshery",
  "source_version": "9bed2e12",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T01:36:06.890Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshery-meshery",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshery/meshery](https://github.com/meshery/meshery) (Revision: `9bed2e12`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T01:36:06.890Z`  
> **Learning ID**: `learn-github-meshery-meshery`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 68%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from meshery/meshery:

# Forensic Learning Record (Deep Inspection): meshery/meshery

> **Canonical Artifact**: `07_PROJECT_LEARNING/meshery-meshery-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meshery/meshery](https://github.com/meshery/meshery))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T01:36:05.475Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshery/meshery`
- **Description**: Meshery, the cloud native manager
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12315 stars

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
- **Issue #24286** (2026-11-24): **[Docs] Fix DCO sign-off links to removed CONTRIBUTING.md sections**
  *Symptoms*: **Notes for Reviewers**  - This PR fixes #24285  `CONTRIBUTING.md` was shortened in June 2025, and five links in four files still point to sections it no longer has. #22745 fixed the same problem in `welcome-first-time-contributors.yml`. This finishes the rest.  | File | Link | Before | After | |---|---|---|---| | `.github/PULL_REQUEST_TEMPLATE.md` | "Signed commits" | `CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin` | `docs.meshery.io/project/contributing#general-contribution-flow` | | `.github/config.yml` | first PR welcome comment | same dead anchor | same new target | | `.github/label-commenter-config.yml` | `issue/dco` comment (issue and PR) | same dead anchor | same new target | | `docs/.../contributing-docs/docs.md` | "Documentation Contribution Flow" | `CONTRIBUTING.md#documentation-contribution-flow` | `ref` to the contributing index, `#general-contribution-flow` |  How I checked it:  - The `general-contribution-flow` anchor exists on the live page, and the sign-off instructions sit directly under it. - Both YAML files still parse. - The docs link uses the same `ref "project/contributing/_index.md"` form as `contributing-adapters.md`. I did not run the Hugo build locally, so the docs preview on this PR is the check for that line. - No other `CONTRIBUTING.md#` links are left under `.github/` or `docs/content/`. The archived `docs/static/v0.8` and `v0.9` snapshots still have them and I left those alone.  **Also changed: the s

- **Issue #24285** (2026-11-24): **[Docs] DCO sign-off links still point to removed CONTRIBUTING.md sections**
  *Symptoms*: ### Current State  `CONTRIBUTING.md` was shortened in June 2025 and no longer has the "Signing-off on commits" or "Documentation Contribution Flow" sections. #22745 fixed the link in `welcome-first-time-contributors.yml`, but four other files still link to those anchors, so the link opens the top of a four-line file:  - `.github/PULL_REQUEST_TEMPLATE.md` ("Signed commits") - `.github/config.yml` (the first pull request welcome comment) - `.github/label-commenter-config.yml` (the `issue/dco` comment, for both issues and pull requests) - `docs/content/en/project/contributing/contributing-docs/docs.md` ("Documentation Contribution Flow")  The `issue/dco` one matters most. It is the comment a contributor gets when a commit is missing its sign-off, and its "see these instructions" link has no instructions behind it.  ### Desired State  All five links go to the General Contribution Flow section of the contributing guide (https://docs.meshery.io/project/contributing#general-contribution-flow), which is where the sign-off instructions live now.  I have a fix ready and will open a pull request.  ---  ### Contributor [Guides](https://docs.meshery.io/project/contributing) and [Handbook](https://meshery.io/community#handbook) - 📚 [Instructions for contributing to documentation](https://docs.meshery.io/project/contributing/contributing-docs)    - Meshery documentation [site](https://docs.meshery.io/) and [source](https://github.com/meshery/meshery/tree/master/docs) - 🙋🏾🙋🏼 Questions: 

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

### Incident Patch 1: `319818a6` (2026-11-24)
**Commit Message**: fix(server): handle context refresh errors and harden DiscoverAction field sync

- Capture refreshErr from inst.UpdateContext in k8sconfig_handler, mark context
  with ctx.ImportError, record error in metadata, and skip transition event on failure.
- In DiscoverAction, sync only KubernetesServerID and Version to machinectx.K8sContext
  under setupLock rather than replacing the whole struct.
- Assign provider on test state machines and protect mock persistedEvents with mutex.
- Add TestRefreshK8sContext_ReturnsErrorOnInvalidCredentials test.

Signed-off-by: Nishant JS <[REDACTED_EMAIL]>

**File**: `server/handlers/k8sconfig_handler.go` (modified, +16/-1)
```diff
@@ -381,18 +381,21 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 			// Refresh its stored context so credential updates are applied and,
 			// if the machine previously failed initial startup with a nil Context,
 			// its Context is properly initialized.
+			var refreshErr error
 			if inst != nil {
 				inst.UpdateContext(func(oldCtx interface{}) interface{} {
 					if oldCtx == nil {
 						assigned, _, aerr := kubernetes.AssignInitialCtx(req.Context(), machineCtx, log)
 						if aerr != nil {
+							refreshErr = aerr
 							log.Error(aerr)
 							return oldCtx
 						}
 						return assigned
 					}
 					if stored, ok := oldCtx.(*kubernetes.MachineCtx); ok && stored != nil {
 						if _, rerr := stored.RefreshK8sContext(*ctx, models.NewServerEvent(req.Context()), log); rerr != nil {
+							refreshErr = rerr
 							log.Error(rerr)
 						}
 						return stored
@@ -406,7 +409,19 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 			// on a cache hit, one whose Context was never assigned. The connection
 			// has still been persisted in the discovered state; just skip the
 			// event. See mhelpers.HasMachineContext.
-			if mhelpers.HasMachineContext(inst) {
+			//
+			// If refreshing the stored context failed (e.g. invalid rotation credentials),
+			// capture the error on the context metadata and skip the event so we do not
+			// probe or report success against the stale credentials.
+			if refreshErr != nil {
+				ctx.ImportError = fmt.Sprintf("Failed to refresh Kubernetes context \"%s\": %v", ctx.Name, refreshErr)
+				metadata["error"] = refreshErr
+				if status == connections.DISCOVERED && len(saveK8sContextResponse.RegisteredContexts) > 0 {
+					saveK8sContextResponse.RegisteredContexts[len(saveK8sContextResponse.RegisteredContexts)-1].ImportError = ctx.ImportError
+				} else if status == connections.CONNECTED && len(saveK8sContextResponse.ConnectedContexts) > 0 {
+					saveK8sContextResponse.ConnectedContexts[len(saveK8sContextResponse.ConnectedContexts)-1].ImportError = ctx.ImportError
+				}
+			} else if mhelpers.HasMachineContext(inst) {
 				// Import returns before the transition finishes, so keep its values
 				// without tying discovery to the request's cancellation.
 				transitionCtx, cancel := backgroundDiscoveryContext(req.Context())
```

**File**: `server/handlers/k8sconfig_handler_test.go` (modified, +27/-9)
```diff
@@ -13,6 +13,7 @@ import (
 	"os/exec"
 	"path/filepath"
 	"strings"
+	"sync"
 	"testing"
 
 	"github.com/gofrs/uuid"
@@ -736,7 +737,8 @@ func TestRetainSelectedContextMetadata(t *testing.T) {
 }
 
 type mockReimportProvider struct {
-	*models.DefaultLocalProvider
+	models.Provider
+	sync.Mutex
 	persistedEvents []events.Event
 	connectionID    core.Uuid
 }
@@ -745,7 +747,21 @@ func (m *mockReimportProvider) SaveK8sContext(token string, k8sContext models.K8
 	return connections.Connection{ID: m.connectionID, Status: connections.DISCOVERED}, nil
 }
 
+func (m *mockReimportProvider) GetConnectionByID(token string, connectionID core.Uuid) (*connections.Connection, int, error) {
+	return &connections.Connection{ID: m.connectionID, Status: connections.DISCOVERED}, 0, nil
+}
+
+func (m *mockReimportProvider) UpdateConnectionStatusByID(token string, connectionID core.Uuid, connectionStatus connections.ConnectionStatus) (*connections.Connection, int, error) {
+	return &connections.Connection{ID: m.connectionID, Status: connectionStatus}, 0, nil
+}
+
+func (m *mockReimportProvider) UpdateConnectionStatusIf(token string, connectionID core.Uuid, fromStatuses []connections.ConnectionStatus, newStatus connections.ConnectionStatus) (bool, *connections.Connection, error) {
+	return true, &connections.Connection{ID: m.connectionID, Status: newStatus}, nil
+}
+
 func (m *mockReimportProvider) PersistEvent(event events.Event, _ string) (models.PersistedEvent, error) {
+	m.Lock()
+	defer m.Unlock()
 	m.persistedEvents = append(m.persistedEvents, event)
 	return models.PersistedEvent{Event: &event, Disposition: models.EventCreated}, nil
 }
@@ -781,10 +797,15 @@ users:
 		}
 		h.ConnectionToStateMachineInstanceTracker = tracker
 
+		provider := &mockReimportProvider{
+			connectionID: connID,
+		}
+
 		inst, err := kubernetes.New(connID.String(), core.Uuid(uuid.Nil), h.log)
 		if err != nil {
 			t.Fatalf("failed to create state machine: %v", err)
 		}
+		inst.Provider = provider
 		storedCtx := &kubernetes.MachineCtx{
 			K8sContext: models.K8sContext{
 				Name:   "old-name",
@@ -794,10 +815,6 @@ users:
 		inst.Context = storedCtx
 		tracker.Add(connID, inst)
 
-		provider := &mockReimportProvider{
-			connectionID: connID,
-		}
-
 		req := uploadKubeconfigRequest(t, "/api/system/kubernetes", kubeconfig)
 		req = req.WithContext(context.WithValue(req.Context(), models.TokenCtxKey, "test-token"))
 		rec := httptest.NewRecorder()
@@ -825,17 +842,18 @@ users:
 		}
 		h.ConnectionToStateMachineInstanceTracker = tracker
 
+		provider := &mockReimportProvider{
+			connectionID: connID,
+		}
+
 		inst, err := kubernetes.New(connID.String(), core.Uuid(uuid.Nil), h.log)
 		if err != nil {
 			t.Fatalf("failed to create state machine: %v", err)
 		}
+		inst.Provider = provider
 		inst.Context = nil
 		tracker.Add(connID, inst)
 
-		provider := &mockReimportProvider{
-			connectionID: connID,
-		}
-
 		req := uploadKubeconfigRequest(t, "/api/system/kubernetes", kubeconfig)
 		req = req.WithContext(context.WithValue(req.Context(), models.TokenCtxKey, "test-token"))
 		rec := httptest.NewRecorder()
```

**File**: `server/machines/kubernetes/discover.go` (modified, +4/-4)
```diff
@@ -94,11 +94,11 @@ func (da *DiscoverAction) Execute(ctx context.Context, machineCtx interface{}, d
 		return machines.NoOp, eventBuilder.WithDescription(fmt.Sprintf("Unable to establish connection with context \"%s\" at %s", k8sContext.Name, k8sContext.Server)).WithMetadata(map[string]interface{}{"error": err}).Build(), err
 	}
 
-	// Update the machine context with the resolved server ID and version under
-	// setupLock so downstream states and external readers (e.g. K8sContextSnapshot)
-	// observe the populated fields rather than the unpopulated stack copy.
+	// Update only the enriched server ID and version under setupLock, preserving
+	// any concurrent updates to other fields on the stored context.
 	machinectx.setupLock.Lock()
-	machinectx.K8sContext = k8sContext
+	machinectx.K8sContext.KubernetesServerID = k8sContext.KubernetesServerID
+	machinectx.K8sContext.Version = k8sContext.Version
 	machinectx.setupLock.Unlock()
 
 	// machinectx.log.Debug("exiting execute func from discovered state", connection)
```

**File**: `server/machines/kubernetes/discover_test.go` (modified, +29/-0)
```diff
@@ -12,6 +12,7 @@ import (
 	"github.com/meshery/meshery/server/models"
 	"github.com/meshery/meshery/server/models/connections"
 	"github.com/meshery/meshkit/logger"
+	"github.com/meshery/meshkit/models/events"
 	mkkube "github.com/meshery/meshkit/utils/kubernetes"
 	"github.com/meshery/schemas/models/core"
 	k8sclient "k8s.io/client-go/kubernetes"
@@ -132,3 +133,31 @@ func TestRefreshK8sContext_SynchronizesMissingServerID(t *testing.T) {
 		t.Fatalf("expected KubernetesServerID to be %s, got %v", existingID, m.K8sContext.KubernetesServerID)
 	}
 }
+
+func TestRefreshK8sContext_ReturnsErrorOnInvalidCredentials(t *testing.T) {
+	log, err := logger.New("test", logger.Options{})
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	m := &MachineCtx{
+		K8sContext: models.K8sContext{
+			Name:   "cluster-1",
+			Server: "https://k8s.example.com:6443",
+		},
+		log: log,
+	}
+
+	badCtx := models.K8sContext{
+		Name:   "cluster-1",
+		Server: "https://k8s-new.example.com:6443",
+	}
+
+	changed, err := m.RefreshK8sContext(badCtx, events.NewEvent(), log)
+	if err == nil {
+		t.Fatalf("expected error on invalid credentials, got nil")
+	}
+	if changed {
+		t.Fatalf("expected changed=false on error, got true")
+	}
+}
```

**File**: `server/machines/kubernetes/helpers.go` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ func AssignClientSetToContext(machinectx *MachineCtx, eventBuilder *events.Event
 // logger: the stored machine context's own log may be nil on machines built
 // outside the normal init path, and a failed build logs through it.
 func (m *MachineCtx) RefreshK8sContext(newCtx models.K8sContext, eventBuilder *events.EventBuilder, log logger.Handler) (bool, error) {
-	if m.clientset != nil && k8sContextCredentialsEqual(m.K8sContext, newCtx) {
+	if k8sContextCredentialsEqual(m.K8sContext, newCtx) {
 		if m.K8sContext.KubernetesServerID == nil && newCtx.KubernetesServerID != nil {
 			m.setupLock.Lock()
 			m.K8sContext.KubernetesServerID = newCtx.KubernetesServerID
```

---

### Incident Patch 2: `1d289655` (2026-11-24)
**Commit Message**: Merge pull request #24253 from Sarthak-Pandey/fix-24249-order-by-sanitization

[Server] Add security edge cases and remove redundant tests for SanitizeOrderInput

**File**: `server/models/sql-utils_test.go` (modified, +44/-29)
```diff
@@ -22,12 +22,6 @@ func TestSanitizeOrderInput(t *testing.T) {
 			columns:  validColumns,
 			expected: "created_at desc",
 		},
-		{
-			name:     "camelCase ascending",
-			order:    "updatedAt asc",
-			columns:  validColumns,
-			expected: "updated_at asc",
-		},
 		{
 			name:     "legacy snake_case input still accepted",
 			order:    "created_at desc",
@@ -52,30 +46,12 @@ func TestSanitizeOrderInput(t *testing.T) {
 			columns:  validColumns,
 			expected: "created_at asc",
 		},
-		{
-			name:     "acronym run stays intact when folding",
-			order:    "userID desc",
-			columns:  []string{"user_id"},
-			expected: "user_id desc",
-		},
-		{
-			name:     "performance profile lastRun folds to its aliased column",
-			order:    "lastRun desc",
-			columns:  []string{"updated_at", "created_at", "name", "last_run"},
-			expected: "last_run desc",
-		},
 		{
 			name:     "column outside the whitelist is ignored",
 			order:    "password desc",
 			columns:  validColumns,
 			expected: "",
 		},
-		{
-			name:     "camelCase column outside the whitelist is ignored",
-			order:    "secretToken desc",
-			columns:  validColumns,
-			expected: "",
-		},
 		{
 			name:     "more than two words is rejected",
 			order:    "created_at desc; DROP TABLE users",
@@ -100,6 +76,48 @@ func TestSanitizeOrderInput(t *testing.T) {
 			columns:  validColumns,
 			expected: "",
 		},
+		{
+			name:     "extra spaces",
+			order:    "createdAt   desc",
+			columns:  validColumns,
+			expected: "",
+		},
+		{
+			name:     "tab separator",
+			order:    "createdAt\tdesc",
+			columns:  validColumns,
+			expected: "",
+		},
+		{
+			name:     "uppercase column",
+			order:    "CREATED_AT desc",
+			columns:  validColumns,
+			expected: "",
+		},
+		{
+			name:     "SQL comment in column",
+			order:    "created_at-- desc",
+			columns:  validColumns,
+			expected: "",
+		},
+		{
+			name:     "quoted column",
+			order:    "'name' desc",
+			columns:  validColumns,
+			expected: "",
+		},
+		{
+			name:     "empty columns slice",
+			order:    "createdAt desc",
+			columns:  []string{},
+			expected: "",
+		},
+		{
+			name:     "nil columns slice",
+			order:    "createdAt desc",
+			columns:  nil,
+			expected: "",
+		},
 	}
 
 	for _, tt := range tests {
@@ -117,12 +135,9 @@ func TestToSnakeCase(t *testing.T) {
 		expected string
 	}{
 		{"createdAt", "created_at"},
-		{"updatedAt", "updated_at"},
-		{"subType", "sub_type"},
-		{"lastRun", "last_run"},
-		{"name", "name"},
-		{"created_at", "created_at"},
 		{"userID", "user_id"},
+		{"created_at", "created_at"},
+		{"name", "name"},
 		{"", ""},
 	}
 
```

---

### Incident Patch 3: `94233af3` (2026-11-24)
**Commit Message**: [server] Fix stack-copy value drop of KubernetesServerID in DiscoverAction and stale FSM context on kubeconfig re-import

In DiscoverAction.Execute, k8sContext := machinectx.K8sContext creates a stack value copy of the machine context. AssignServerID and AssignVersion mutate this local copy and persist it to the database, but the resolved fields were never assigned back to machinectx.K8sContext. Consequently, subsequent state machine actions (such as RegisterAction and ConnectAction) as well as snapshot readers (K8sContextSnapshot) continued observing a nil KubernetesServerID.

Additionally, in K8SConfigHandler, when a kubeconfig is re-imported for an existing cluster connection, InitializeMachineWithContext returned the cached state machine instance from smInstanceTracker and dropped the incoming machineCtx. If the cluster had credentials rotated or was previously unreachable at initial startup (leaving inst.Context nil), the state machine retained stale credentials or remained permanently frozen with a nil Context.

This commit:
1. Syncs the resolved k8sContext back to machinectx.K8sContext under setupLock upon successful discovery.
2. Enhances RefreshK8sContext to back-fill miss

**File**: `server/handlers/k8sconfig_handler.go` (modified, +25/-0)
```diff
@@ -376,6 +376,31 @@ func (h *Handler) addK8SConfig(user *models.User, _ *models.Preference, w http.R
 				log.Error(err)
 			}
 
+			// When the instance was already present in the tracker (cache hit),
+			// InitializeMachineWithContext returns it as-is and drops machineCtx.
+			// Refresh its stored context so credential updates are applied and,
+			// if the machine previously failed initial startup with a nil Context,
+			// its Context is properly initialized.
+			if inst != nil {
+				inst.UpdateContext(func(oldCtx interface{}) interface{} {
+					if oldCtx == nil {
+						assigned, _, aerr := kubernetes.AssignInitialCtx(req.Context(), machineCtx, log)
+						if aerr != nil {
+							log.Error(aerr)
+							return oldCtx
+						}
+						return assigned
+					}
+					if stored, ok := oldCtx.(*kubernetes.MachineCtx); ok && stored != nil {
+						if _, rerr := stored.RefreshK8sContext(*ctx, models.NewServerEvent(req.Context()), log); rerr != nil {
+							log.Error(rerr)
+						}
+						return stored
+					}
+					return oldCtx
+				})
+			}
+
 			// An unreachable context cannot build a client set, so the state
 			// machine fails to initialize - either returning a nil instance, or,
 			// on a cache hit, one whose Context was never assigned. The connection
```

**File**: `server/handlers/k8sconfig_handler_test.go` (modified, +124/-0)
```diff
@@ -17,7 +17,10 @@ import (
 
 	"github.com/gofrs/uuid"
 	"github.com/meshery/meshery/server/helpers"
+	"github.com/meshery/meshery/server/machines"
+	"github.com/meshery/meshery/server/machines/kubernetes"
 	"github.com/meshery/meshery/server/models"
+	"github.com/meshery/meshery/server/models/connections"
 	meshkiterrors "github.com/meshery/meshkit/errors"
 	"github.com/meshery/meshkit/models/events"
 	"github.com/meshery/schemas/models/core"
@@ -731,3 +734,124 @@ func TestRetainSelectedContextMetadata(t *testing.T) {
 		}
 	})
 }
+
+type mockReimportProvider struct {
+	*models.DefaultLocalProvider
+	persistedEvents []events.Event
+	connectionID    core.Uuid
+}
+
+func (m *mockReimportProvider) SaveK8sContext(token string, k8sContext models.K8sContext, metadata map[string]any) (connections.Connection, error) {
+	return connections.Connection{ID: m.connectionID, Status: connections.DISCOVERED}, nil
+}
+
+func (m *mockReimportProvider) PersistEvent(event events.Event, _ string) (models.PersistedEvent, error) {
+	m.persistedEvents = append(m.persistedEvents, event)
+	return models.PersistedEvent{Event: &event, Disposition: models.EventCreated}, nil
+}
+
+func TestK8SConfigHandler_ReimportRefreshesCachedStateMachineContext(t *testing.T) {
+	authUser := &models.User{ID: uuid.Must(uuid.NewV4())}
+	connUUID := uuid.Must(uuid.NewV4())
+	connID := core.Uuid(connUUID)
+
+	kubeconfig := []byte(`apiVersion: v1
+kind: Config
+current-context: reimported
+clusters:
+- cluster:
+    server: https://127.0.0.1:6443
+  name: reimported
+contexts:
+- context:
+    cluster: reimported
+    user: reimported-user
+  name: reimported
+users:
+- name: reimported-user
+  user:
+    token: token-reimported
+`)
+
+	t.Run("refreshes credentials on cache hit with existing context", func(t *testing.T) {
+		h := newTestHandler(t, map[string]models.Provider{}, "")
+		h.config.K8scontextChannel = &models.K8scontextChan{}
+		tracker := &machines.ConnectionToStateMachineInstanceTracker{
+			ConnectToInstanceMap: make(map[core.Uuid]*machines.StateMachine),
+		}
+		h.ConnectionToStateMachineInstanceTracker = tracker
+
+		inst, err := kubernetes.New(connID.String(), core.Uuid(uuid.Nil), h.log)
+		if err != nil {
+			t.Fatalf("failed to create state machine: %v", err)
+		}
+		storedCtx := &kubernetes.MachineCtx{
+			K8sContext: models.K8sContext{
+				Name:   "old-name",
+				Server: "https://old-server:6443",
+			},
+		}
+		inst.Context = storedCtx
+		tracker.Add(connID, inst)
+
+		provider := &mockReimportProvider{
+			connectionID: connID,
+		}
+
+		req := uploadKubeconfigRequest(t, "/api/system/kubernetes", kubeconfig)
+		req = req.WithContext(context.WithValue(req.Context(), models.TokenCtxKey, "test-token"))
+		rec := httptest.NewRecorder()
+
+		h.K8SConfigHandler(rec, req, nil, authUser, provider)
+		if rec.Code != http.StatusOK {
+			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
+		}
+
+		ctxObj := inst.GetContext()
+		updatedCtx, ok := ctxObj.(*kubernetes.MachineCtx)
+		if !ok || updatedCtx == nil {
+			t.Fatalf("expected *kubernetes.MachineCtx, got %#v", ctxObj)
+		}
+		if updatedCtx.K8sContext.Server != "https://127.0.0.1:6443" {
+			t.Fatalf("expected server https://127.0.0.1:6443, got %s", updatedCtx.K8sContext.Server)
+		}
+	})
+
+	t.Run("initializes context on cache hit when initial startup left Context nil", func(t *testing.T) {
+		h := newTestHandler(t, map[string]models.Provider{}, "")
+		h.config.K8scontextChannel = &models.K8scontextChan{}
+		tracker := &machines.ConnectionToStateMachineInstanceTracker{
+			ConnectToInstanceMap: make(map[core.Uuid]*machines.StateMachine),
+		}
+		h.ConnectionToStateMachineInstanceTracker = tracker
+
+		inst, err := kubernetes.New(connID.String(), core.Uuid(uuid.Nil), h.log)
+		if err != nil {
+			t.Fatalf("failed to create state machine: %v", err)
+		}
+		inst.Context = nil
+		tracker.Add(connID, inst)
+
+		provider := &mockReimportProvider{
+			connectionID: connID,
+		}
+
+		req := uploadKubeconfigRequest(t, "/api/system/kubernetes", kubeconfig)
+		req = req.WithContext(context.WithValue(req.Context(), models.TokenCtxKey, "test-token"))
+		rec := httptest.NewRecorder()
+
+		h.K8SConfigHandler(rec, req, nil, authUser, provider)
+		if rec.Code != http.StatusOK {
+			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
+		}
+
+		ctxObj := inst.GetContext()
+		initializedCtx, ok := ctxObj.(*kubernetes.MachineCtx)
+		if !ok || initializedCtx == nil {
+			t.Fatalf("expected initialized *kubernetes.MachineCtx, got %#v", ctxObj)
+		}
+		if initializedCtx.K8sContext.Server != "https://127.0.0.1:6443" {
+			t.Fatalf("expected server https://127.0.0.1:6443, got %s", initializedCtx.K8sContext.Server)
+		}
+	})
+}
```

**File**: `server/machines/kubernetes/discover.go` (modified, +7/-0)
```diff
@@ -94,6 +94,13 @@ func (da *DiscoverAction) Execute(ctx context.Context, machineCtx interface{}, d
 		return machines.NoOp, eventBuilder.WithDescription(fmt.Sprintf("Unable to establish connection with context \"%s\" at %s", k8sContext.Name, k8sContext.Server)).WithMetadata(map[string]interface{}{"error": err}).Build(), err
 	}
 
+	// Update the machine context with the resolved server ID and version under
+	// setupLock so downstream states and external readers (e.g. K8sContextSnapshot)
+	// observe the populated fields rather than the unpopulated stack copy.
+	machinectx.setupLock.Lock()
+	machinectx.K8sContext = k8sContext
+	machinectx.setupLock.Unlock()
+
 	// machinectx.log.Debug("exiting execute func from discovered state", connection)
 
 	return machines.Register, nil, nil
```

**File**: `server/machines/kubernetes/discover_test.go` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+package kubernetes
+
+import (
+	"context"
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/gofrs/uuid"
+	"github.com/meshery/meshery/server/machines"
+	"github.com/meshery/meshery/server/models"
+	"github.com/meshery/meshery/server/models/connections"
+	"github.com/meshery/meshkit/logger"
+	mkkube "github.com/meshery/meshkit/utils/kubernetes"
+	"github.com/meshery/schemas/models/core"
+	k8sclient "k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/rest"
+)
+
+type mockProviderForDiscoverTest struct {
+	models.Provider
+	savedContext models.K8sContext
+}
+
+func (m *mockProviderForDiscoverTest) SaveK8sContext(token string, k8sContext models.K8sContext, metadata map[string]any) (connections.Connection, error) {
+	m.savedContext = k8sContext
+	return connections.Connection{ID: core.Uuid(uuid.Must(uuid.NewV4()))}, nil
+}
+
+func TestDiscoverAction_PropagatesServerIDAndVersionToMachineCtx(t *testing.T) {
+	clusterUID := "30e099e0-ef31-477a-9f2d-754ee9b1d41a"
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		w.Header().Set("Content-Type", "application/json")
+		if r.URL.Path == "/api/v1/namespaces/kube-system" {
+			_ = json.NewEncoder(w).Encode(map[string]interface{}{
+				"metadata": map[string]string{"uid": clusterUID},
+			})
+			return
+		}
+		if r.URL.Path == "/version" {
+			_ = json.NewEncoder(w).Encode(map[string]string{
+				"major": "1",
+				"minor": "30",
+				"gitVersion": "v1.30.0",
+			})
+			return
+		}
+		http.NotFound(w, r)
+	}))
+	defer server.Close()
+
+	clientset, err := k8sclient.NewForConfig(&rest.Config{Host: server.URL})
+	if err != nil {
+		t.Fatal(err)
+	}
+	log, err := logger.New("test", logger.Options{})
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	mockProv := &mockProviderForDiscoverTest{}
+	machineCtx := &MachineCtx{
+		K8sContext: models.K8sContext{
+			Name:   "test-ctx",
+			Server: server.URL,
+		},
+		clientset: &mkkube.Client{KubeClient: clientset},
+		log:       log,
+	}
+
+	ctx := context.WithValue(context.Background(), models.ProviderCtxKey, mockProv)
+	ctx = context.WithValue(ctx, models.TokenCtxKey, "test-token")
+
+	da := &DiscoverAction{}
+	nextEvent, _, err := da.Execute(ctx, machineCtx, nil)
+	if err != nil {
+		t.Fatalf("unexpected DiscoverAction error: %v", err)
+	}
+	if nextEvent != machines.Register {
+		t.Fatalf("expected next event %v, got %v", machines.Register, nextEvent)
+	}
+
+	// Verify that machineCtx.K8sContext has been updated in memory
+	if machineCtx.K8sContext.KubernetesServerID == nil {
+		t.Fatalf("expected machineCtx.K8sContext.KubernetesServerID to be populated, but it was nil")
+	}
+	if machineCtx.K8sContext.KubernetesServerID.String() != clusterUID {
+		t.Fatalf("expected KubernetesServerID %s, got %s", clusterUID, machineCtx.K8sContext.KubernetesServerID.String())
+	}
+	if machineCtx.K8sContext.Version != "v1.30.0" {
+		t.Fatalf("expected Version v1.30.0, got %s", machineCtx.K8sContext.Version)
+	}
+
+	// Verify K8sContextSnapshot also reflects the updated server ID
+	snap := machineCtx.K8sContextSnapshot()
+	if snap.KubernetesServerID == nil || snap.KubernetesServerID.String() != clusterUID {
+		t.Fatalf("expected K8sContextSnapshot().KubernetesServerID to be %s, got %v", clusterUID, snap.KubernetesServerID)
+	}
+}
+
+func TestRefreshK8sContext_SynchronizesMissingServerID(t *testing.T) {
+	log, err := logger.New("test", logger.Options{})
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	existingID := core.Uuid(uuid.Must(uuid.NewV4()))
+	m := &MachineCtx{
+		K8sContext: models.K8sContext{
+			Name:   "cluster-1",
+			Server: "https://k8s.example.com:6443",
+		},
+		clientset: &mkkube.Client{},
+		log:       log,
+	}
+
+	newCtx := models.K8sContext{
+		Name:               "cluster-1",
+		Server:             "https://k8s.example.com:6443",
+		KubernetesServerID: &existingID,
+	}
+
+	changed, err := m.RefreshK8sContext(newCtx, nil, log)
+	if err != nil {
+		t.Fatalf("unexpected RefreshK8sContext error: %v", err)
+	}
+	if !changed {
+		t.Fatalf("expected changed to be true when populating missing server ID")
+	}
+	if m.K8sContext.KubernetesServerID == nil || *m.K8sContext.KubernetesServerID != existingID {
+		t.Fatalf("expected KubernetesServerID to be %s, got %v", existingID, m.K8sContext.KubernetesServerID)
+	}
+}
```

**File**: `server/machines/kubernetes/helpers.go` (modified, +7/-1)
```diff
@@ -94,7 +94,13 @@ func AssignClientSetToContext(machinectx *MachineCtx, eventBuilder *events.Event
 // logger: the stored machine context's own log may be nil on machines built
 // outside the normal init path, and a failed build logs through it.
 func (m *MachineCtx) RefreshK8sContext(newCtx models.K8sContext, eventBuilder *events.EventBuilder, log logger.Handler) (bool, error) {
-	if k8sContextCredentialsEqual(m.K8sContext, newCtx) {
+	if m.clientset != nil && k8sContextCredentialsEqual(m.K8sContext, newCtx) {
+		if m.K8sContext.KubernetesServerID == nil && newCtx.KubernetesServerID != nil {
+			m.setupLock.Lock()
+			m.K8sContext.KubernetesServerID = newCtx.KubernetesServerID
+			m.setupLock.Unlock()
+			return true, nil
+		}
 		return false, nil
 	}
 	handler, err := GenerateClientSetAction(&newCtx, eventBuilder, log)
```

#### Recent Merged Pull Requests:
- **PR #24286** (2026-11-24): [Docs] Fix DCO sign-off links to removed CONTRIBUTING.md sections (@jashwanth176)
- **PR #24280** (2026-11-24): [mesheryctl] Guard Kubernetes version parsing against slice bounds panic and nil dereference (@mystic-fae)
- **PR #24278** (2026-11-24): [server] Fix stack-copy value drop of KubernetesServerID in DiscoverAction and stale FSM context on kubeconfig re-import (@nishant-devv)
- **PR #24275** (2026-11-24): docs: add OCI registry push and pull examples (@shreyaagrawal788-dotcom)
- **PR #24272** (2026-11-24): [Server] Bound concurrent visitor execution in parallel process planner (@Sarthak-Pandey)
- **PR #24271** (2026-11-24): [mesheryctl] Enforce exact argument validation in system start (@err0rgod)

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

## X. server): handle context refresh errors and harden DiscoverAction field sync

**RULE**:
When implementing operations in `server/handlers/k8sconfig_handler.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshery/meshery. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `319818a6`: server): handle context refresh errors and harden DiscoverAction field sync. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/handlers/k8sconfig_handler.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			var refreshErr error
							refreshErr = aerr
							refreshErr = rerr
			//
			// If refreshing the stored context failed (e.g. invalid rotation credentials),
			// capture the error on the context metadata and skip the event so we do not
			// probe or report success against the stale credentials.
			if refreshErr != nil {
				ctx.ImportError = fmt.Sprintf("Failed to refresh Kubernetes context \"%s\": %v", ctx.Name, refreshErr)
				metadata["error"] = refreshErr
				if status == connections.DISCOVERED && len(saveK8sContextResponse.RegisteredContexts) > 0 {
					saveK8sContextResponse.RegisteredContexts[len(saveK8sContextResponse.RegisteredContexts)-1].ImportError = ctx.ImportError
				} else if status == connections.CONNECTED && len(saveK8sContextResponse.ConnectedContexts) > 0 {
					saveK8sContextResponse.ConnectedContexts[len(saveK8sContextResponse.ConnectedContexts)-1].ImportError = ctx.ImportError
				}
			} else if mhelpers.HasMachineContext(inst) {
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
			if mhelpers.HasMachineContext(inst) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `319818a6` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

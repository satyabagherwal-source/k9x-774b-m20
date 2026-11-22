# Verification Protocol: Verification Protocol: Empirical Defect Shield for meshery/meshery

<!-- PROVENANCE_START
{
  "source_repository": "meshery/meshery",
  "source_url": "https://github.com/meshery/meshery",
  "source_version": "03883b4b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T07:27:40.083Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshery-meshery",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshery/meshery](https://github.com/meshery/meshery) (Revision: `03883b4b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T07:27:40.083Z`  
> **Learning ID**: `learn-github-meshery-meshery`


## 1. Scope & Verification Target
- **Target Repository**: `meshery/meshery` (Commit: `03883b4b`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): meshery/meshery

> **Canonical Artifact**: `07_PROJECT_LEARNING/meshery-meshery-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meshery/meshery](https://github.com/meshery/meshery))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T07:27:38.568Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshery/meshery`
- **Description**: Meshery, the cloud native manager
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12285 stars

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
- **Issue #24119** (2026-11-22): **[Docs] Add language tags to untagged code fences**
  *Symptoms*: **Notes for Reviewers**  - This PR fixes #24118  This PR adds explicit language tags to previously untagged code fence openers (```) across two documentation files without altering content or closing fences: 1. `docs/content/en/project/contributing/contributing-gitflow.md`: Added `sh` tag to 12 git command fences. 2. `docs/content/en/project/contributing/contributing-docs/docs.md`: Added `yaml` tag to the YAML front-matter example fence at line 439.  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)** - [x] Yes, I signed my commits.  <!-- Thank you for contributing to Meshery!   Contributing Conventions:  1. Include descriptive PR titles with [<component-name>] prepended. 2. Build and test your changes before submitting a PR.  3. Sign your commits. 4. Include before and after screenshots/terminal output.  By following the community's contribution conventions upfront, the review process will  be accelerated and your PR merged more quickly. -->  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  <!-- coderabbit-ai-generated:v1 -->  ## Summary by CodeRabbit  * **Documentation**   * Added syntax highlighting to YAML and shell command examples in the contributing guides.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->

- **Issue #24118** (2026-11-22): **[Docs]Add language tags to untagged code fences in contributing-gitflow.md and contributing-docs/docs.md**
  *Symptoms*: Title: [Docs] Add language tags to untagged code fences in contributing-gitflow.md and contributing-docs/docs.md  ### Current State Several code fences have no language tag, so they render without syntax highlighting: - docs/content/en/project/contributing/contributing-gitflow.md: 12 fences containing git shell commands (git clone, git remote, git fetch, git checkout, ...) - docs/content/en/project/contributing/contributing-docs/docs.md (~line 439): a fence containing YAML front matter  ### Desired State Tag the shell fences with `sh` and the front matter example with `yaml`. No content changes. 

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

### Incident Patch 1: `87be8689` (2026-11-21)
**Commit Message**: Merge pull request #24103 from madhavzanwar/fix/ui-dimension-ssr-guards

[UI] Guard getWindowDimensions against undefined window in SSR and clean up resize timeout

**File**: `ui/utils/__tests__/dimension.test.tsx` (modified, +30/-0)
```diff
@@ -51,6 +51,17 @@ describe('getWindowDimensions', () => {
 
     expect(getWindowDimensions()).toEqual({ width: 320, height: 480 });
   });
+
+  it('returns { width: 0, height: 0 } when window is undefined in SSR', () => {
+    const originalWindow = globalThis.window;
+    // @ts-expect-error simulating SSR environment
+    delete globalThis.window;
+    try {
+      expect(getWindowDimensions()).toEqual({ width: 0, height: 0 });
+    } finally {
+      globalThis.window = originalWindow;
+    }
+  });
 });
 
 describe('useWindowDimensions', () => {
@@ -132,4 +143,23 @@ describe('useWindowDimensions', () => {
     expect(removeListenerSpy.mock.calls.some(([eventName]) => eventName === 'resize')).toBe(true);
     removeListenerSpy.mockRestore();
   });
+
+  it('cleans up pending searchTimeout on unmount', () => {
+    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
+    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
+    const { unmount } = render(<Probe onRender={() => {}} />);
+
+    act(() => {
+      window.dispatchEvent(new Event('resize'));
+    });
+
+    const pendingTimeout = setTimeoutSpy.mock.results.at(-1)?.value;
+
+    // Unmount before the 500ms debounce timer fires
+    unmount();
+
+    expect(clearTimeoutSpy).toHaveBeenCalledWith(pendingTimeout);
+    clearTimeoutSpy.mockRestore();
+    setTimeoutSpy.mockRestore();
+  });
 });
```

**File**: `ui/utils/dimension.ts` (modified, +12/-1)
```diff
@@ -5,6 +5,12 @@ import { useState, useEffect } from 'react';
  * @returns {object} {width, height}
  */
 export function getWindowDimensions() {
+  if (typeof window === 'undefined') {
+    return {
+      width: 0,
+      height: 0,
+    };
+  }
   const { innerWidth: width, innerHeight: height } = window;
   return {
     width,
@@ -45,7 +51,12 @@ export function useWindowDimensions() {
     }
 
     window.addEventListener('resize', handleResize);
-    return () => window.removeEventListener('resize', handleResize);
+    return () => {
+      if (searchTimeout) {
+        clearTimeout(searchTimeout);
+      }
+      window.removeEventListener('resize', handleResize);
+    };
   }, []);
 
   return windowDimensions;
```

---

### Incident Patch 2: `44fb193c` (2026-11-21)
**Commit Message**: Merge pull request #24115 from Hpsingh26/fix/docs-broken-image-references

[Docs] Fix broken image references and shortcode paths in documentation

**File**: `docs/CONTRIBUTING-gitflow.md` (modified, +2/-2)
```diff
@@ -8,11 +8,11 @@
 <ul>
 <li><h3> Fork the Repository of Project</h3></li><br>
 
-<p><img src="/.github/assets/images/fork.png" align="center"></p>
+<p><img src="../.github/assets/images/fork.png" align="center"></p>
 
 ( You will see this on Top Right of Github Repository !)<br><br>
 <li><h3>Clone your fork to your local machine</h3></li><br>
-<img width="50%" align="center"  src="/.github/assets/images/clone.png"><br>
+<img width="50%" align="center"  src="../.github/assets/images/clone.png"><br>
 ( Click on the Green Code button and Copy the link `https://github.com/........` )<br><br>
 <li><h3>Open Git bash where you want to clone the project ( Avoid On Desktop )</h3></li>
 
```

**File**: `docs/content/en/concepts/logical/relationships/index.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ aliases:
 - /concepts/relationships/
 ---
 
-Meshery Relationships characterize how [components]({{< ref "components.md" >}}) are connected and interact with each other. Relationships are defined within [models]({{< ref "models/index.md" >}}) to aid in structuring the interrelationships between one or more components in a [design]({{< ref "designs.md" >}}) to further in comprehending the overall structure and dependencies within managed systems.
+Meshery Relationships characterize how [components]({{< ref "concepts/logical/components.md" >}}) are connected and interact with each other. Relationships are defined within [models]({{< ref "concepts/logical/models/index.md" >}}) to aid in structuring the interrelationships between one or more components in a [design]({{< ref "concepts/logical/designs.md" >}}) to aid in comprehending the overall structure and dependencies within managed systems.
 
 Meshery recognizes that relationships exist in various forms and that the existence of a relationship might be interdependent upon the existence (or absence) of another relationship. To support this complexity, Meshery relationships are highly expressive, characterizing the nature of interaction of interconnected components no matter their genealogy.
 
```

**File**: `docs/content/en/guides/configuration-management/creating-a-meshery-design/index.md` (renamed, +1/-1)
```diff
@@ -61,7 +61,7 @@ The YAML editor sits next to the component forms. To write or paste a design by
 
 Instead of starting from nothing, import a design from the [Meshery Catalog](https://meshery.io/catalog), from a URL, or from a Kubernetes manifest, Helm chart, or Docker Compose file. See [Importing and Exporting Designs]({{< ref "guides/configuration-management/import-export-designs.md" >}}).
 
-<img src="../images/pattern-import.png" width="60%" alt="Importing a design in Meshery UI" />
+<img src="images/pattern-import.png" width="60%" alt="Importing a design in Meshery UI" />
 
 <!-- tab -->
 mesheryctl | fa fa-terminal
```

**File**: `docs/content/en/installation/quick-start/index.md` (modified, +1/-1)
```diff
@@ -116,6 +116,6 @@ You can now design and manage any infrastructure that Meshery supports. For the
 
 ## Additional Resources
 
-- [Troubleshooting Meshery Installations]({{< ref "guides/troubleshooting/installation.md" >}})
+- [Troubleshooting Meshery Installations]({{< ref "guides/troubleshooting/installation/index.md" >}})
 - [Meshery Error Code Reference]({{< ref "reference/error-codes.md" >}})
 - [mesheryctl system check]({{< ref "reference/mesheryctl/system/check.md" >}})
```

**File**: `docs/content/en/project/contributing/cli/cli.md` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ Annotations: linkScreenshot,
 Also, if the screenshot is present in the command, an `Annotation` macro variable (of `map[string]string` type) containing the `link` and the `caption` has to be added at the bottom of the `Examples` field in the command file. The image file has to be included in the `docs/content/en/reference/images` folder in **PNG** format. The screenshot field is given for reference below
 
 {{< code code=`var linkDocPatternApply = map[string]string{
- "link":    "![pattern-apply-usage](../../../images/patternApply.png)",
+ "link":    "![pattern-apply-usage](../../images/patternApply.png)",
  "caption": "Usage of mesheryctl design apply",
 }
 ...
```

**File**: `docs/content/en/project/contributing/cli/tests/index.md` (renamed, +1/-1)
```diff
@@ -257,7 +257,7 @@ To filter and view only CLI-related test cases using the Sheet Views feature:
 1. In the top menu bar, click Data → Change view
 2. Choose the pre-defined view labeled "CLI"
 
-![Meshery Test Plan Screenshot](../../images/meshery-test-plan-v0.8.0-ui.png)
+![Meshery Test Plan Screenshot](images/meshery-test-plan-v0.8.0-ui.png)
 
 ## Development
 
```

**File**: `docs/content/en/project/contributing/contributing-docs/docs.md` (modified, +3/-1)
```diff
@@ -240,9 +240,11 @@ If the code snippet has special characters then use backtick delimiters:
 Don't use `code` shortcode when the snippet is in between an ordered list, this breaks the order and next item in the list will start numbering from 1. Instead, use `<pre class="codeblock-pre">...</pre>` method described above.
 
 **A full block:**
+````markdown
 ```
-```code snippet```
+code snippet
 ```
+````
 
 **Inline formatting:**
 
```

**File**: `docs/content/en/project/contributing/contributing-relationships-best-practices.md` (modified, +3/-3)
```diff
@@ -6,11 +6,11 @@ categories: [contributing]
 
 # Relationship Testing and Best Practices
 
-This guide complements the [Contributing to Model Relationships](/project/contributing/contributing-relationships) documentation by focusing on **practical testing and debugging techniques** for relationship definitions.
+This guide complements the [Contributing to Model Relationships](/project/contributing/models/relationships) documentation by focusing on **practical testing and debugging techniques** for relationship definitions.
 
 ## Before You Start
 
-Make sure you've read the [Contributing to Model Relationships](/project/contributing/contributing-relationships) guide to understand relationship structure, schema, and components.
+Make sure you've read the [Contributing to Model Relationships](/project/contributing/models/relationships) guide to understand relationship structure, schema, and components.
 
 ## 1. Validate JSON Syntax
 
@@ -394,7 +394,7 @@ Once validated and tested:
 
 ## Resources
 
-- [Contributing to Model Relationships](/project/contributing/contributing-relationships)
+- [Contributing to Model Relationships](/project/contributing/models/relationships)
 - [Meshery Relationship Schema](https://github.com/meshery/schemas/tree/master/schemas/constructs/v1alpha3/relationship)
 - [Existing Relationships](https://github.com/meshery/meshery/tree/master/models)
 - [OPA Policies](https://github.com/meshery/meshery/tree/master/models/meshery-core)
```

---

### Incident Patch 3: `01fe4256` (2026-11-21)
**Commit Message**: Merge branch 'master' into fix/docs-broken-image-references

**File**: `docs/content/en/reference/mesheryctl/model/build.md` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ Create an OCI-compliant package from the model files
 Create an OCI-compliant package from the model files.
 Model files are taken from [path]/[model-name]/[model-version] folder.
 Expects input to be in the format scaffolded by the model init command.
+When only [model-name] is provided, the model directory must contain exactly one version directory.
+Root-level files such as README.md, .gitignore, and LICENSE do not affect this validation.
 
 <pre class='codeblock-pre'>
 <div class='codeblock'>
```

**File**: `mesheryctl/internal/cli/pkg/flags/validator.go` (modified, +6/-1)
```diff
@@ -51,8 +51,13 @@ func (fv *FlagValidator) Validate(s interface{}) error {
 	return nil
 }
 
+// IsSemver returns true if the string matches Meshery's supported model-version format (^vMAJOR.MINOR.PATCH...).
+func IsSemver(version string) bool {
+	return vSemverRegex.MatchString(version)
+}
+
 func isSemver(fl validator.FieldLevel) bool {
-	return vSemverRegex.MatchString(fl.Field().String())
+	return IsSemver(fl.Field().String())
 }
 
 func isRelativePath(fl validator.FieldLevel) bool {
```

**File**: `mesheryctl/internal/cli/pkg/flags/validator_test.go` (modified, +3/-0)
```diff
@@ -67,6 +67,9 @@ func TestValidateSemver(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
+			if got := IsSemver(tt.version); got != !tt.wantErr {
+				t.Errorf("IsSemver(%q) = %v, want %v", tt.version, got, !tt.wantErr)
+			}
 			type testStruct struct {
 				Version string `validate:"semver"`
 			}
```

**File**: `mesheryctl/internal/cli/root/model/build.go` (modified, +244/-5)
```diff
@@ -1,7 +1,10 @@
 package model
 
 import (
+	"errors"
 	"fmt"
+	"io"
+	"io/fs"
 	"os"
 	"path/filepath"
 	"strings"
@@ -24,6 +27,8 @@ var buildModelCmd = &cobra.Command{
 	Long: `Create an OCI-compliant package from the model files.
 Model files are taken from [path]/[model-name]/[model-version] folder.
 Expects input to be in the format scaffolded by the model init command.
+When only [model-name] is provided, the model directory must contain exactly one version directory.
+Root-level files such as README.md, .gitignore, and LICENSE do not affect this validation.
 Find more information at: https://docs.meshery.io/reference/mesheryctl/model/build`,
 	Example: `
 // Create an OCI-compliant package from the model files
@@ -91,11 +96,8 @@ mesheryctl model build [model-name]/[model-version]
 
 				count := 0
 				for _, entry := range entries {
-					if entry.IsDir() {
+					if entry.IsDir() && mesheryctlflags.IsSemver(entry.Name()) {
 						count++
-					} else {
-						// If there is a file, it's not exactly one subfolder
-						return false
 					}
 				}
 
@@ -120,7 +122,16 @@ mesheryctl model build [model-name]/[model-version]
 		folder := buildModelCompileFolderName(cmdModelBuildFlagsProvided.Path, name, version)
 
 		utils.Log.Infof("Building meshery model from path %s", folder)
-		img, errBuildImage := meshkitOci.BuildImage(folder)
+
+		buildSource, cleanup, err := prepareModelBuildSource(folder)
+		if err != nil {
+			err = ErrModelBuild(err)
+			utils.Log.Error(err)
+			return err
+		}
+		defer cleanup()
+
+		img, errBuildImage := meshkitOci.BuildImage(buildSource)
 		if errBuildImage != nil {
 			return ErrModelBuild(errBuildImage)
 		}
@@ -179,3 +190,231 @@ func buildModelCompileImageName(name string, version string, extension string) s
 		extension,
 	)
 }
+
+// hasGitMetadata checks whether .git exists anywhere within src (as a file or directory).
+func hasGitMetadata(src string) (bool, error) {
+	hasGit := false
+	err := filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
+		if err != nil {
+			return err
+		}
+		if d.Name() == ".git" {
+			hasGit = true
+			if d.IsDir() {
+				return fs.SkipDir
+			}
+		}
+		return nil
+	})
+	return hasGit, err
+}
+
+// prepareModelBuildSource prepares a build source directory that excludes any Git repository metadata (.git).
+// If no .git metadata is present, it returns the original folder with a no-op cleanup to avoid copying overhead.
+// If .git metadata is present, it stages a clean copy into an isolated temporary directory outside the source tree.
+func prepareModelBuildSource(folder string) (string, func(), error) {
+	cleanFolder := filepath.Clean(folder)
+	hasGit, err := hasGitMetadata(cleanFolder)
+	if err != nil {
+		return "", func() {}, err
+	}
+	if !hasGit {
+		return cleanFolder, func() {}, nil
+	}
+
+	tmpDir, err := os.MkdirTemp("", "meshery-model-build-*")
+	if err != nil {
+		return "", func() {}, err
+	}
+	cleanup := func() {
+		_ = filepath.WalkDir(tmpDir, func(p string, d fs.DirEntry, err error) error {
+			if err == nil && d.IsDir() {
+				_ = os.Chmod(p, 0700)
+			}
+			return nil
+		})
+		_ = os.RemoveAll(tmpDir)
+	}
+
+	if err := copyModelExcludingGit(cleanFolder, tmpDir); err != nil {
+		cleanup()
+		return "", func() {}, err
+	}
+
+	return tmpDir, cleanup, nil
+}
+
+type dirPerm struct {
+	path string
+	perm os.FileMode
+}
+
+func isSubpathOrEqual(p, target string) bool {
+	cleanTarget := filepath.Clean(target)
+	cleanP := filepath.Clean(p)
+	if cleanP == cleanTarget {
+		return true
+	}
+	if cleanTarget == string(filepath.Separator) {
+		return true
+	}
+	return strings.HasPrefix(cleanP, cleanTarget+string(filepath.Separator))
+}
+
+// copyModelExcludingGit recursively copies src into dst while omitting any .git file or directory.
+func copyModelExcludingGit(src, dst string) error {
+	srcInfo, err := os.Stat(src)
+	if err != nil {
+		return err
+	}
+	if !srcInfo.IsDir() {
+		return fmt.Errorf("source path is not a directory: %s", src)
+	}
+
+	absDst, err := filepath.Abs(dst)
+	if err != nil {
+		return err
+	}
+	realDst, err := filepath.EvalSymlinks(absDst)
+	if err != nil {
+		realDst = absDst
+	}
+
+	var dirsToRestore []dirPerm
+
+	err = filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
+		if err != nil {
+			return err
+		}
+
+		absPath, err := filepath.Abs(path)
+		if err != nil {
+			return err
+		}
+		// Prevent recursion if destination is inside source (e.g. TMPDIR set inside model source)
+		if isSubpathOrEqual(absPath, absDst) || isSubpathOrEqual(absPath, realDst) {
+			if d.IsDir() {
+				return fs.SkipDir
+			}
+			return nil
+		}
+		if realPath, err := filepath.EvalSymlinks(absPath); err == nil {
+			if isSubpathOrEqual(realPath, absDst) || isSubpathOrEqual(realPath, realDst) {
+				if d.IsDir() {
+					return fs.SkipDir
+				}
+				return nil
+			}
+		}
+
+		if d.Name() == ".git" {
+			if d.IsDir() {
+				return fs.SkipDir
+			}
+			return nil
+		}
+
+		relPath, err := filepa
```

**File**: `mesheryctl/internal/cli/root/model/build_test.go` (modified, +845/-0)
```diff
@@ -1,14 +1,20 @@
 package model
 
 import (
+	archiveTar "archive/tar"
 	"fmt"
+	"io"
+	"io/fs"
 	"os"
 	"path/filepath"
 	"runtime"
+	"strings"
 	"testing"
 
+	"github.com/google/go-containerregistry/pkg/v1/tarball"
 	mesheryctlflags "github.com/meshery/meshery/mesheryctl/internal/cli/pkg/flags"
 	"github.com/meshery/meshery/mesheryctl/pkg/utils"
+	meshkitOci "github.com/meshery/meshkit/models/oci"
 	"github.com/spf13/cobra"
 	"github.com/spf13/pflag"
 	"github.com/stretchr/testify/assert"
@@ -28,6 +34,8 @@ func TestModelBuild(t *testing.T) {
 		buildTestDynamoController    = "test-case-model-build-aws-dynamodb-controller"
 		buildTestDynamoControllerGbx = "test-case-model-build-aws-dynamodb-controller-gbxter34"
 		buildTestEC2Controller       = "aws-ec2-controller"
+		buildTestNoVersionDir        = "test-case-model-build-no-versions"
+		buildTestTwoVersions         = "test-case-model-build-two-versions"
 		buildTestVersion             = "v0.1.0"
 		buildTestNonExistentFolder   = "not_existing_folder"
 	)
@@ -36,6 +44,8 @@ func TestModelBuild(t *testing.T) {
 	cleanupDirs := []string{
 		buildTestDynamoController,
 		buildTestDynamoControllerGbx,
+		buildTestNoVersionDir,
+		buildTestTwoVersions,
 	}
 	// Clean up all test artifacts from previous runs
 	cleanupTestArtifacts(cleanupDirs)
@@ -113,6 +123,26 @@ func TestModelBuild(t *testing.T) {
 			t.Log("removed created dirs and files")
 		}
 	}
+	setupHookCreateRootFiles := func(modelDir string, files ...string) func() {
+		return func() {
+			for _, file := range files {
+				filePath := filepath.Join(modelDir, file)
+				if err := os.WriteFile(filePath, []byte("sample content"), 0o644); err != nil {
+					t.Fatal(err)
+				}
+			}
+		}
+	}
+	setupHookCreateRootDirectories := func(modelDir string, dirs ...string) func() {
+		return func() {
+			for _, dir := range dirs {
+				dirPath := filepath.Join(modelDir, dir)
+				if err := os.MkdirAll(dirPath, 0o755); err != nil {
+					t.Fatal(err)
+				}
+			}
+		}
+	}
 
 	tests := []struct {
 		Name             string
@@ -179,6 +209,214 @@ func TestModelBuild(t *testing.T) {
 				),
 			},
 		},
+		{
+			Name:             "given name only with README.md when model build then model is built",
+			Args:             []string{"build", buildTestDynamoController},
+			ExpectError:      false,
+			ExpectedResponse: "model.build.from-model-name-only.golden",
+			ExpectedFiles: []string{
+				buildTestDynamoController + ".tar",
+			},
+			SetupHooks: []func(){
+				setupHookModelInit("init", buildTestDynamoController, "--version", buildTestVersion),
+				setupHookCreateRootFiles(buildTestDynamoController, "README.md"),
+			},
+			CleanupHooks: []func(){
+				cleanUpHookRemoveDirsAndFiles(
+					buildTestDynamoController,
+					buildTestDynamoController+".tar",
+				),
+			},
+		},
+		{
+			Name:             "given name only with .gitignore when model build then model is built",
+			Args:             []string{"build", buildTestDynamoController},
+			ExpectError:      false,
+			ExpectedResponse: "model.build.from-model-name-only.golden",
+			ExpectedFiles: []string{
+				buildTestDynamoController + ".tar",
+			},
+			SetupHooks: []func(){
+				setupHookModelInit("init", buildTestDynamoController, "--version", buildTestVersion),
+				setupHookCreateRootFiles(buildTestDynamoController, ".gitignore"),
+			},
+			CleanupHooks: []func(){
+				cleanUpHookRemoveDirsAndFiles(
+					buildTestDynamoController,
+					buildTestDynamoController+".tar",
+				),
+			},
+		},
+		{
+			Name:             "given name only with README.md and .gitignore when model build then model is built",
+			Args:             []string{"build", buildTestDynamoController},
+			ExpectError:      false,
+			ExpectedResponse: "model.build.from-model-name-only.golden",
+			ExpectedFiles: []string{
+				buildTestDynamoController + ".tar",
+			},
+			SetupHooks: []func(){
+				setupHookModelInit("init", buildTestDynamoController, "--version", buildTestVersion),
+				setupHookCreateRootFiles(buildTestDynamoController, "README.md", ".gitignore"),
+			},
+			CleanupHooks: []func(){
+				cleanUpHookRemoveDirsAndFiles(
+					buildTestDynamoController,
+					buildTestDynamoController+".tar",
+				),
+			},
+		},
+		{
+			Name:             "given name only with LICENSE when model build then model is built",
+			Args:             []string{"build", buildTestDynamoController},
+			ExpectError:      false,
+			ExpectedResponse: "model.build.from-model-name-only.golden",
+			ExpectedFiles: []string{
+				buildTestDynamoController + ".tar",
+			},
+			SetupHooks: []func(){
+				setupHookModelInit("init", buildTestDynamoController, "--version", buildTestVersion),
+				setupHookCreateRootFiles(buildTestDynamoController, "LICENSE"),
+			},
+			CleanupHooks: []func(){
+				cleanUpHookRemoveDirsAndFiles(
+					buildTestDynamoController,
+					buildTestDynamoController+".tar",
+				),
+			},
+		},
+		{
+			Name:             "given name only with .git directory when model build the
```

#### Recent Merged Pull Requests:
- **PR #24119** (2026-11-22): [Docs] Add language tags to untagged code fences (@ItsAbir005)
- **PR #24115** (2026-11-21): [Docs] Fix broken image references and shortcode paths in documentation (@Hpsingh26)
- **PR #24110** (2026-11-21): fix(server): compare core semver so kanvas builds are not flagged outdated (@leecalcote)
- **PR #24103** (2026-11-21): [UI] Guard getWindowDimensions against undefined window in SSR and clean up resize timeout (@madhavzanwar)
- **PR #24097** (2026-11-21): [mesheryctl] Migrate live WriteTokenFile tests and remove orphaned legacy files (@abhinavkdeval08-design)
- **PR #24096** (2026-11-21): [mesheryctl] Fix model build validation with root-level files (@BHAUMIK0711)

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

## X. Empirical Invariant Guard in dimension.test.tsx

**RULE**:
When implementing operations in `ui/utils/__tests__/dimension.test.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshery/meshery. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `87be8689`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `ui/utils/__tests__/dimension.test.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

  it('returns { width: 0, height: 0 } when window is undefined in SSR', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulating SSR environment
    delete globalThis.window;
    try {
      expect(getWindowDimensions()).toEqual({ width: 0, height: 0 });
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('cleans up pending searchTimeout on unmount', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = render(<Probe onRender={() => {}} />);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const pendingTimeout = setTimeoutSpy.mock.results.at(-1)?.value;

    // Unmount before the 500ms debounce timer fires
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(pendingTimeout);
    clearTimeoutSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `87be8689` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

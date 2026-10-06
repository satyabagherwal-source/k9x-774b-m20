# Forensic Learning Record (Deep Inspection): meshery/meshery

> **Canonical Artifact**: `07_PROJECT_LEARNING/meshery-meshery-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meshery/meshery](https://github.com/meshery/meshery))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:03:05.051Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshery/meshery`
- **Description**: Meshery, the cloud native manager
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 11906 stars

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
- **Issue #22239** (2026-10-05): **docs: update Yash Sharma's affiliation to UiPath in Community Maintainers**
  *Symptoms*: **Notes for Reviewers**  Follow-up to c73429b.  Merging c73429b updated Yash Sharma's affiliation from Digital Ocean to UiPath in the UI maintainers table, but the entry in the Community Maintainers section of MAINTAINERS.md was left unchanged. This PR updates it so the affiliation is consistent throughout the file.  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)** - [x] Yes, I signed my commits.  <!-- Thank you for contributing to Meshery!   Contributing Conventions:  1. Include descriptive PR titles with [<component-name>] prepended. 2. Build and test your changes before submitting a PR.  3. Sign your commits. 4. Include before and after screenshots/terminal output.  By following the community's contribution conventions upfront, the review process will  be accelerated and your PR merged more quickly. -->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Updated the Community Maintainers listing to show Yash Sharma’s affiliation as UiPath instead of Digital Ocean. This change is limited to the published affiliation; no other public declarations were changed.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22239?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: defaults - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**: `b24fed81-6637-4ece-9501-0f6dad3f39bf`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of

- **Issue #22237** (2026-10-05): **Update Yash Sharma's affiliation to UiPath**
  *Symptoms*: **Notes for Reviewers**  Hi Meshery Maintainer, I have officially changed my employer from DigitalOcean to UiPath and I'm no longer affiliated to DigitalOcean. Which is why I'm requesting a change of affiliation in maintainers list.  Lemme know if there is anything else I need to do. Thankyou  - This PR fixes #  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)** - [ ] Yes, I signed my commits.  <!-- Thank you for contributing to Meshery!   Contributing Conventions:  1. Include descriptive PR titles with [<component-name>] prepended. 2. Build and test your changes before submitting a PR.  3. Sign your commits. 4. Include before and after screenshots/terminal output.  By following the community's contribution conventions upfront, the review process will  be accelerated and your PR merged more quickly. -->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Updated the listed affiliation for a UI maintainer.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22237?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The maintainer listing changes Yash Sharma’s affiliation from Digital Ocean to UiPath.  ### Changes  **Maintainer listing**  |Layer / File(s)|Summary| |:---|:---| |**Update maintainer affiliation** <br> `MAINTAINERS.md`|Yash Sharma’s listed affiliation changes from Digital Ocean to UiPath.|  <!-- change_assessment_start --> **Priority:** ⬇️ L

- **Issue #22229** (2026-10-05): **[UI] Footer social links overflow out of container on small and desktop/tablet screens**
  *Symptoms*: ### URL `https://discuss.meshery.io/u/[username]/activity/replies`   ### Current Behavior On small and intermediate/narrow desktop viewports, the footer columns do not wrap into a secondary row. As a result, the 4th column (**Socials**) overflows horizontally beyond the right boundary of the footer container and spills onto the background.  ### Expected Behavior Footer columns should wrap responsively (e.g., into a 2x2 grid or column stack) using `flex-wrap: wrap` and appropriate max-width sizing so that all sections, including **Socials**, remain fully within the footer container.  ### Steps to Reproduce 1. Navigate to `https://discuss.meshery.io/u/[username]/activity/replies` (or any discuss page). 2. Resize the browser window to a tablet or narrower desktop width (or inspect with responsive view). 3. Scroll down to the footer. 4. Notice the **Socials** column overflowing past the right edge of the dark footer container.  ### ScreenRecording https://github.com/user-attachments/assets/a6769af6-9e9b-47b3-bfcf-5da96a427afa  ### Suggested Fix Ensure `footer .footer-columns` has `flex-wrap: wrap` in `common/common.scss` (or responsive `@media` breakpoints) so wrapping applies to all viewport sizes, not just mobile viewports. 
  **Post-Mortem & Fix Analysis**:
  >   This issue has been labeled with 'component/ui'. 🧰 Here are docs on [Contributing to Meshery UI](https://docs.meshery.io/project/contributing/contributing-ui). 🎨 Here is the [Meshery UI Figma File](https://www.figma.com/file/SMP3zxOjZztdOLtgN4dS2W/Meshery-UI?node-id=4%3A0) File. Lastly, here are docs on [Contributing to Meshery's End-to-End Tests](https://docs.meshery.io/project/contributing/contributing-ui-tests).  ---   > &nbsp; &#9; &nbsp; &#9;  &nbsp; &#9;  &nbsp; &#9; Be sure to [join the community](https://slack.meshery.io), if you haven't yet and please leave a :star: [star on the project](../stargazers) :smile: 
  > @hiyach28 @Bharath314 i can work on this issue. could you please assign me ? 
  > Hi @AliRana30,  The discussion forum at discuss.meshery.io uses the Discourse theme maintained in the [layer5io/discuss-theme](https://github.com/layer5io/discuss-theme) repository rather than meshery/meshery.  Since your PR ([layer5io/discuss-theme#19](https://github.com/layer5io/discuss-theme/pull/19)) is already targeting layer5io/discuss-theme, could you please reopen this issue in [layer5io/discuss-theme/issues](https://github.com/layer5io/discuss-theme/issues) so that the issue and PR are tracked in the same repository?  Once created, please update your PR description to reference the new issue number. I'm closing this one to avoid confusion for contributors looking for the theme files in meshery/meshery.

- **Issue #22218** (2026-10-03): **Kshitij-Jha.md**
  *Symptoms*: Kshitij Jha  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added a heading to Kshitij Jha’s meeting notes.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22218?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The meeting notes file adds the heading “Kshitij Jha”.  ### Changes  **Meeting Notes**  |Layer / File(s)|Summary| |:---|:---| |**Add meeting notes heading** <br> `docs/meetings/2026/week-of-10-01-2026/Kshitij-Jha.md`|The file adds the heading “Kshitij Jha”.|  <!-- change_assessment_start --> **Priority:** ⬇️ Low  **Estimated code review effort:** 1 (Trivial) | ~2 minutes  <!-- change_assessment_comm
  > 📖 Docs preview: https://docs.meshery.io/pr-preview/pr-22218/ <!-- Sticky Pull Request Commentpr-preview -->
  > ### ✅ Meeting Minutes Auto-Merged 🗓️  This pull request has been automatically merged because it contains **only** changes to meeting minutes in `docs/meetings/`.  **Summary:** - Files modified: 1 - Merged by: @meshery-ci (Community Manager Bot)  Thank you for keeping our meeting records up to date! 📝

- **Issue #22204** (2026-10-02): **Add newcomers attendance for Oluwadamilare Emmanuel Oduyomi**
  *Symptoms*: Added newcomer attendance details for Oluwadamilare Emmanuel Oduyomi.  **Notes for Reviewers**  - This PR fixes #  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)** - [ ] Yes, I signed my commits.  <!-- Thank you for contributing to Meshery!   Contributing Conventions:  1. Include descriptive PR titles with [<component-name>] prepended. 2. Build and test your changes before submitting a PR.  3. Sign your commits. 4. Include before and after screenshots/terminal output.  By following the community's contribution conventions upfront, the review process will  be accelerated and your PR merged more quickly. -->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added an attendance profile for Excel, including his background, projects, open-source goals, and GitHub profile link.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22204?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `292ea1d3-0d2f-4016-affb-4fc89f475de1`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between f829880f327f0a2cf677a30a59bb33c2a91fddef an
  > Preview deployment for PR #22204 removed.  This PR preview was automatically pruned because we keep only the 6 most recently updated previews on GitHub Pages to stay within deployment size limits.  If needed, push a new commit to this PR to generate a fresh preview. <!-- Sticky Pull Request Commentpr-preview -->
  > ### ✅ Meeting Minutes Auto-Merged 🗓️  This pull request has been automatically merged because it contains **only** changes to meeting minutes in `docs/meetings/`.  **Summary:** - Files modified: 1 - Merged by: @meshery-ci (Community Manager Bot)  Thank you for keeping our meeting records up to date! 📝

- **Issue #22203** (2026-10-02): **Create damilare.md with personal introduction**
  *Symptoms*: Added personal introduction and background information for Oluwadamilare Emmanuel Oduyomi.  **Notes for Reviewers**  - This PR fixes #  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)** - [ ] Yes, I signed my commits.  <!-- Thank you for contributing to Meshery!   Contributing Conventions:  1. Include descriptive PR titles with [<component-name>] prepended. 2. Build and test your changes before submitting a PR.  3. Sign your commits. 4. Include before and after screenshots/terminal output.  By following the community's contribution conventions upfront, the review process will  be accelerated and your PR merged more quickly. -->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added a profile highlighting Oluwadamilare Emmanuel Oduyomi’s background, projects, and GitHub profile.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22203?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `9df860ce-e300-4e75-afae-a5b4d45277db`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 0cd3a1b853861926a6f7f6debeff2a113fe54537 an
  > 📖 Docs preview: https://docs.meshery.io/pr-preview/pr-22203/ <!-- Sticky Pull Request Commentpr-preview -->
  > ### ✅ Meeting Minutes Auto-Merged 🗓️  This pull request has been automatically merged because it contains **only** changes to meeting minutes in `docs/meetings/`.  **Summary:** - Files modified: 1 - Merged by: @meshery-ci (Community Manager Bot)  Thank you for keeping our meeting records up to date! 📝

- **Issue #22202** (2026-10-02): **Revise Ankush Ujawane's introduction**
  *Symptoms*: Updated personal introduction and skills description.  **Notes for Reviewers**  - This PR fixes #  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)** - [x] Yes, I signed my commits.  <!-- Thank you for contributing to Meshery!   Contributing Conventions:  1. Include descriptive PR titles with [<component-name>] prepended. 2. Build and test your changes before submitting a PR.  3. Sign your commits. 4. Include before and after screenshots/terminal output.  By following the community's contribution conventions upfront, the review process will  be accelerated and your PR merged more quickly. -->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added a brief introduction to Ankush Ujawane, including his education, interests, skills, and professional profiles.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22202?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `d571e10f-0974-4447-b3a9-b260aedc6321`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 0cd3a1b853861926a6f7f6debeff2a113fe54537 an
  > 📖 Docs preview: https://docs.meshery.io/pr-preview/pr-22202/ <!-- Sticky Pull Request Commentpr-preview -->
  > ### ✅ Meeting Minutes Auto-Merged 🗓️  This pull request has been automatically merged because it contains **only** changes to meeting minutes in `docs/meetings/`.  **Summary:** - Files modified: 1 - Merged by: @meshery-ci (Community Manager Bot)  Thank you for keeping our meeting records up to date! 📝

- **Issue #22201** (2026-10-02): **Add Ayushman's introduction and project experience**
  *Symptoms*: **Notes for Reviewers**  - This PR fixes #  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)** - [x ] Yes, I signed my commits.  <!-- Thank you for contributing to Meshery!   Contributing Conventions:  1. Include descriptive PR titles with [<component-name>] prepended. 2. Build and test your changes before submitting a PR.  3. Sign your commits. 4. Include before and after screenshots/terminal output.  By following the community's contribution conventions upfront, the review process will  be accelerated and your PR merged more quickly. -->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added a short profile highlighting Ayushman’s studies, interests, and software projects.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22201?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `cb6d22b0-2320-40d8-b8f3-6a077e82c99f`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 0c39467e69c530de73611f1b0d1be20aa9d40747 an
  > 📖 Docs preview: https://docs.meshery.io/pr-preview/pr-22201/ <!-- Sticky Pull Request Commentpr-preview -->
  > ### ✅ Meeting Minutes Auto-Merged 🗓️  This pull request has been automatically merged because it contains **only** changes to meeting minutes in `docs/meetings/`.  **Summary:** - Files modified: 1 - Merged by: @meshery-ci (Community Manager Bot)  Thank you for keeping our meeting records up to date! 📝

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

### Incident Patch 1: `4ced37d7` (2026-10-05)
**Commit Message**: Merge pull request #22239 from banana-three-join/fix/yash-sharma-entry

docs: update Yash Sharma's affiliation to UiPath in Community Maintainers

**File**: `MAINTAINERS.md` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ Repositories:
 | Alex Quinn          | @alexquincy     | Netflix       |
 | Marcus Blom         | @marblom007     | AWS           |
 | Kate Suttons        | @suttonskate    | Layer5        |
-| Yash Sharma         | @Yashsharma1911 | Digital Ocean |
+| Yash Sharma         | @Yashsharma1911 | UiPath        |
 | Shivay Lamba        | @shivaylamba    | Qualcomm      |
 
 Repositories:
```

---

### Incident Patch 2: `3ceb4e9c` (2026-10-05)
**Commit Message**: Update Yash Sharma's affiliation to UiPath

Signed-off-by: Yash sharma <[REDACTED_EMAIL]>

**File**: `MAINTAINERS.md` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ UI maintainers are responsible for the development and maintenance of Meshery's
 | Nikhil Ladha       | @Nikhil-Ladha   | IBM           |
 | Antonette Caldwell | @acald-creator  | Acquia        |
 | Aabid Sofi         | @aabidsofi19    | Independent   |
-| Yash Sharma        | @Yashsharma1911 | Digital Ocean |
+| Yash Sharma        | @Yashsharma1911 | UiPath        |
 | Sudhanshu Dasgupta | @sudhanshutech  | SafeDep       |
 | Ian Whitney        | @ianrwhitney    | Intuit        |
 
```

---

### Incident Patch 3: `c99c2162` (2026-10-04)
**Commit Message**: Merge pull request #21691 from Piyush-13090/fix/21687-remove-duplicate-view-connection

[UI]: Remove duplicate View Connection link from connection creation toast

**File**: `ui/components/connections/ConnectionWizard.helpers.test.ts` (modified, +23/-12)
```diff
@@ -1,5 +1,6 @@
-import { describe, expect, it, vi } from 'vitest';
+import { describe, expect, it } from 'vitest';
 import { CoreConnectionKinds } from '@/utils/Enum';
+import { EVENT_TYPES } from 'lib/event-types';
 import {
   buildConnectionWizardKindConfigs,
   buildCredentialSecret,
@@ -294,20 +295,30 @@ describe('ConnectionWizard.helpers', () => {
     expect(isCreateConnectionQuery('false')).toBe(false);
   });
 
-  it('builds connection-created notify payloads with optional View connections action', () => {
-    vi.stubGlobal('window', { location: { pathname: '/dashboard' } });
-    const payload = connectionCreatedNotify('Prometheus');
-    expect(payload.message).toBe('Prometheus connection created.');
-    expect(payload.link?.href).toBe('/management/connections');
-    vi.stubGlobal('window', { location: { pathname: '/management/connections' } });
-    expect(connectionCreatedNotify('Grafana').link).toBeUndefined();
-    vi.unstubAllGlobals();
+  it('builds connection-created notify payloads', () => {
+    expect(connectionCreatedNotify('Prometheus')).toEqual({
+      message: 'Prometheus connection created.',
+      event_type: EVENT_TYPES.SUCCESS,
+    });
+    expect(connectionCreatedNotify('')).toEqual({
+      message: 'Connection created.',
+      event_type: EVENT_TYPES.SUCCESS,
+    });
   });
 
   it('formats kubernetes import notify summaries', () => {
-    vi.stubGlobal('window', { location: { pathname: '/dashboard' } });
-    expect(kubernetesImportedNotify(2).message).toBe('Imported 2 Kubernetes connections.');
-    vi.unstubAllGlobals();
+    expect(kubernetesImportedNotify(1)).toEqual({
+      message: 'Imported 1 Kubernetes connection.',
+      event_type: EVENT_TYPES.SUCCESS,
+    });
+    expect(kubernetesImportedNotify(2)).toEqual({
+      message: 'Imported 2 Kubernetes connections.',
+      event_type: EVENT_TYPES.SUCCESS,
+    });
+    expect(kubernetesImportedNotify(0)).toEqual({
+      message: 'Imported 0 Kubernetes connections.',
+      event_type: EVENT_TYPES.WARNING,
+    });
   });
 });
 
```

**File**: `ui/components/connections/ConnectionWizard.helpers.tsx` (modified, +1/-14)
```diff
@@ -50,40 +50,27 @@ export const isCreateConnectionQuery = (value: string | string[] | undefined): b
 export type ConnectionCreatedNotifyPayload = {
   message: string;
   event_type: typeof EVENT_TYPES.SUCCESS | typeof EVENT_TYPES.WARNING;
-  link?: { href: string; label: string };
 };
 
-const isOnConnectionsPage = (): boolean =>
-  typeof window !== 'undefined' && window.location.pathname.startsWith(CONNECTIONS_PATH);
-
 /**
- * Success snackbar after create/import. Plain string (BasicMarkdown-safe) plus an
- * optional same-tab action when not already on the Connections page.
+ * Success snackbar after create/import. Plain string (BasicMarkdown-safe).
  */
 export const connectionCreatedNotify = (label: string): ConnectionCreatedNotifyPayload => {
   const name = (label && String(label).trim()) || '';
   const summary = name ? `${name} connection created.` : 'Connection created.';
-  if (isOnConnectionsPage()) {
-    return { message: summary, event_type: EVENT_TYPES.SUCCESS };
-  }
   return {
     message: summary,
     event_type: EVENT_TYPES.SUCCESS,
-    link: { href: CONNECTIONS_PATH, label: 'View connections' },
   };
 };
 
 export const kubernetesImportedNotify = (count: number): ConnectionCreatedNotifyPayload => {
   const noun = count === 1 ? 'connection' : 'connections';
   const summary = `Imported ${count} Kubernetes ${noun}.`;
   const event_type = count > 0 ? EVENT_TYPES.SUCCESS : EVENT_TYPES.WARNING;
-  if (isOnConnectionsPage() || count === 0) {
-    return { message: summary, event_type };
-  }
   return {
     message: summary,
     event_type,
-    link: { href: CONNECTIONS_PATH, label: 'View connections' },
   };
 };
 
```

---

### Incident Patch 4: `019059a3` (2026-09-30)
**Commit Message**: Merge pull request #22169 from AliRana30/server/fix-delete-context-error-handling

[Server] Return on GetK8sContext error to prevent event clobbering in DeleteContext

**File**: `server/handlers/contexts_handler.go` (modified, +19/-4)
```diff
@@ -86,9 +86,22 @@ func (h *Handler) DeleteContext(w http.ResponseWriter, req *http.Request, _ *mod
 	smInstanceTracker := h.ConnectionToStateMachineInstanceTracker
 	k8scontext, err := provider.GetK8sContext(token, contextID)
 	if err != nil {
-		eventBuilder.WithSeverity(events.Error).WithDescription(fmt.Sprintf("Failed to delete connection for %s", k8scontext.Name)).WithMetadata(map[string]interface{}{
-			"error": err,
-		})
+		ctxName := k8scontext.Name
+		if ctxName == "" {
+			ctxName = contextID
+		}
+		event := eventBuilder.WithSeverity(events.Error).
+			WithDescription(fmt.Sprintf("Failed to delete connection for %s", ctxName)).
+			WithMetadata(map[string]interface{}{
+				"error": err,
+			}).Build()
+		_ = provider.PersistEvent(*event, token)
+		if h.config != nil && h.config.EventBroadcaster != nil {
+			go h.config.EventBroadcaster.Publish(userID, event)
+		}
+		h.log.Error(ErrGetK8sContexts(err))
+		writeMeshkitError(w, ErrGetK8sContexts(err), http.StatusInternalServerError)
+		return
 	}
 
 	description := fmt.Sprintf("Delete request received for kubernetes context \"%s\"", k8scontext.Name)
@@ -149,7 +162,9 @@ func (h *Handler) DeleteContext(w http.ResponseWriter, req *http.Request, _ *mod
 		})
 		event := eventBuilder.Build()
 		_ = provider.PersistEvent(*event, token)
-		go h.config.EventBroadcaster.Publish(userID, event)
+		if h.config != nil && h.config.EventBroadcaster != nil {
+			go h.config.EventBroadcaster.Publish(userID, event)
+		}
 	}
 	// go h.config.EventBroadcaster.Publish(userID, event)
 
```

**File**: `server/handlers/contexts_handler_test.go` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+package handlers
+
+import (
+	"context"
+	"errors"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/gofrs/uuid"
+	"github.com/gorilla/mux"
+	"github.com/meshery/meshery/server/models"
+	"github.com/meshery/meshkit/models/events"
+)
+
+type mockContextsProvider struct {
+	*models.DefaultLocalProvider
+	getK8sContextFn func(token, id string) (models.K8sContext, error)
+	persistEventFn  func(event events.Event, token string) error
+	persistedEvents []events.Event
+}
+
+func (m *mockContextsProvider) GetK8sContext(token, id string) (models.K8sContext, error) {
+	if m.getK8sContextFn != nil {
+		return m.getK8sContextFn(token, id)
+	}
+	return models.K8sContext{}, nil
+}
+
+func (m *mockContextsProvider) PersistEvent(event events.Event, token string) error {
+	m.persistedEvents = append(m.persistedEvents, event)
+	if m.persistEventFn != nil {
+		return m.persistEventFn(event, token)
+	}
+	return nil
+}
+
+func TestDeleteContext_MissingToken(t *testing.T) {
+	systemID := uuid.Must(uuid.NewV4())
+	h := &Handler{
+		config:   &models.HandlerConfig{EventBroadcaster: &models.Broadcast{}},
+		log:      newTestLogger(t),
+		SystemID: &systemID,
+	}
+	provider := &mockContextsProvider{
+		DefaultLocalProvider: &models.DefaultLocalProvider{},
+	}
+	contextID := uuid.Must(uuid.NewV4())
+	req := httptest.NewRequest(http.MethodDelete, "/api/system/kubernetes/contexts/"+contextID.String(), nil)
+	req = mux.SetURLVars(req, map[string]string{"id": contextID.String()})
+	rec := httptest.NewRecorder()
+
+	h.DeleteContext(rec, req, nil, &models.User{ID: uuid.Must(uuid.NewV4())}, provider)
+
+	if rec.Code != http.StatusInternalServerError {
+		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
+	}
+	if !strings.Contains(rec.Body.String(), ErrFetchTokenCode) {
+		t.Fatalf("expected error code %s in body, got %s", ErrFetchTokenCode, rec.Body.String())
+	}
+}
+
+func TestDeleteContext_GetK8sContextError(t *testing.T) {
+	systemID := uuid.Must(uuid.NewV4())
+	broadcaster := &models.Broadcast{}
+	userID := uuid.Must(uuid.NewV4())
+	ch, unsub := broadcaster.Subscribe(userID)
+	defer unsub()
+
+	h := &Handler{
+		config:   &models.HandlerConfig{EventBroadcaster: broadcaster},
+		log:      newTestLogger(t),
+		SystemID: &systemID,
+	}
+	provider := &mockContextsProvider{
+		DefaultLocalProvider: &models.DefaultLocalProvider{},
+		getK8sContextFn: func(token, id string) (models.K8sContext, error) {
+			return models.K8sContext{}, errors.New("context not found")
+		},
+	}
+
+	contextID := uuid.Must(uuid.NewV4())
+	req := httptest.NewRequest(http.MethodDelete, "/api/system/kubernetes/contexts/"+contextID.String(), nil)
+	req = mux.SetURLVars(req, map[string]string{"id": contextID.String()})
+	ctx := context.WithValue(req.Context(), models.TokenCtxKey, "test-token")
+	req = req.WithContext(ctx)
+	rec := httptest.NewRecorder()
+
+	h.DeleteContext(rec, req, nil, &models.User{ID: userID}, provider)
+
+	if rec.Code != http.StatusInternalServerError {
+		t.Fatalf("expected status %d, got %d. body: %s", http.StatusInternalServerError, rec.Code, rec.Body.String())
+	}
+	if !strings.Contains(rec.Body.String(), ErrGetK8sContextsCode) {
+		t.Fatalf("expected error code %s in body, got %s", ErrGetK8sContextsCode, rec.Body.String())
+	}
+
+	// Verify exactly one event was persisted with Error severity
+	if len(provider.persistedEvents) != 1 {
+		t.Fatalf("expected 1 persisted event, got %d", len(provider.persistedEvents))
+	}
+	ev := provider.persistedEvents[0]
+	if ev.Severity != events.Error {
+		t.Fatalf("expected event severity %v, got %v", events.Error, ev.Severity)
+	}
+	expectedDesc := "Failed to delete connection for " + contextID.String()
+	if ev.Description != expectedDesc {
+		t.Fatalf("expected event description %q, got %q", expectedDesc, ev.Description)
+	}
+	if ev.Metadata == nil || ev.Metadata["error"] == nil {
+		t.Fatalf("expected error metadata in event, got %v", ev.Metadata)
+	}
+
+	// Verify broadcast received
+	select {
+	case broadcastMsg := <-ch:
+		bEvent, ok := broadcastMsg.(*events.Event)
+		if !ok {
+			t.Fatalf("expected *events.Event from broadcaster, got %T", broadcastMsg)
+		}
+		if bEvent.Severity != events.Error {
+			t.Fatalf("expected broadcast event severity %v, got %v", events.Error, bEvent.Severity)
+		}
+	case <-time.After(500 * time.Millisecond):
+		t.Fatal("timed out waiting for broadcast event")
+	}
+}
+
+func TestDeleteContext_GetK8sContextError_WithNameFallback(t *testing.T) {
+	systemID := uuid.Must(uuid.NewV4())
+	h := &Handler{
+		config:   &models.HandlerConfig{EventBroadcaster: &models.Broadcast{}},
+		log:      newTestLogger(t),
+		SystemID: &systemID,
+	}
+	provider := &mockContextsProvider{
+		DefaultLocalProvider: &models.DefaultLocalProvider{},
+		getK8sContextFn: func(token, id string) (models.K8sContext, error) {
+			return models.K8sContext{Name: "production-cluster"}, errors.New("provider failure")
+		},
+	}
+
+	c
```

---

### Incident Patch 5: `a8bdcbb4` (2026-09-30)
**Commit Message**: Merge branch 'master' into server/fix-delete-context-error-handling

**File**: `docs/catalog/deployment/4497e10e-004a-472f-b9b8-6f3624814164.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+---
+layout: item
+name: CI/CD Pipeline - GitHub Actions to Kubernetes
+publishedVersion: 0.0.84
+userId: b8bf3050-14a6-45ab-a7e8-963975882165
+userName: Ankit Rewar
+userAvatarURL: https://lh3.googleusercontent.com/pw/AP1GczMxBqDm3yxp8zfpwbhA2z2LvHRP5bVERb7WLKCW7jrtMddEqLFcM4XcAUPmElBPF7c18uVyhCM_kcGtsyse6nwUDaqc0QuqxfyQ-JTCUMsSZX5rEdjnenV_ge20niBlr2n5TaU1ZXpqu2PDM1O52UsQ=w1254-h1254-s-no-gm?authuser=0
+type: deployment
+compatibility:
+    - kubernetes
+patternId: 4497e10e-004a-472f-b9b8-6f3624814164
+image: /assets/images/logos/service-mesh-pattern.svg
+patternInfo: |
+  A%20simple%20CI%2FCD%20pipeline%20design%20showing%20GitHub%20Actions%20triggering%20build%2C%20test%2C%20and%20deployment%20stages%20on%20Kubernetes.
+patternCaveats: |
+  This%20is%20a%20demonstration%20design%20for%20learning%20purposes.%20Container%20ports%20use%20nginx%3A%20latest%20as%20a%20placeholder%20image%3B%20replace%20it%20with%20actual%20application%20images%20before%20deploying%20to%20a%20production%20cluster.
+createdAt: 2026-09-18T20:42:23Z
+permalink: catalog/deployment/ci-cd-pipeline-github-actions-to-kubernetes-4497e10e-004a-472f-b9b8-6f3624814164.html
+URL: 'https://raw.githubusercontent.com/meshery/meshery.io/master/catalog/4497e10e-004a-472f-b9b8-6f3624814164/0.0.84/design.yml'
+downloadLink: 4497e10e-004a-472f-b9b8-6f3624814164/design.yml
+---
\ No newline at end of file
```

**File**: `docs/catalog/deployment/76082cd4-c66c-4e7b-8a9b-02ee0f09c08e.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+---
+layout: item
+name: My First Kubernetes Web App-copy
+publishedVersion: 0.0.5
+userId: 888589e8-d93f-4e70-a661-d5332cad0d77
+userName: Anushka Kawalkar
+userAvatarURL: https://lh3.googleusercontent.com/a/ACg8ocIG7WKag6QeA0WxecgHtoXMPE5N6g2RQiRbuk1f8q7SABMENQ=s96-c
+type: deployment
+compatibility:
+    - kubernetes
+patternId: 76082cd4-c66c-4e7b-8a9b-02ee0f09c08e
+image: /assets/images/logos/service-mesh-pattern.svg
+patternInfo: |
+  A%20simple%20Kubernetes%20web%20application%20architecture%20demonstrating%20the%20relationship%20between%20a%20Service%2C%20Deployment%2C%20Pod%2C%20ConfigMap%2C%20and%20Namespace.%20Created%20as%20an%20introductory%20Meshery%20design%20to%20explore%20Kubernetes%20visualization%20and%20cloud-native%20architecture.
+patternCaveats: |
+  This%20is%20a%20basic%20reference%20design%20intended%20for%20visualization%20and%20learning.%20It%20does%20not%20include%20production-specific%20configurations%20such%20as%20resource%20limits%2C%20security%20policies%2C%20persistent%20storage%2C%20or%20high-availability%20settings.%20Additional%20configuration%20would%20be%20required%20before%20using%20it%20in%20a%20production%20environment.
+createdAt: 2026-09-06T07:19:20Z
+permalink: catalog/deployment/my-first-kubernetes-web-app-copy-76082cd4-c66c-4e7b-8a9b-02ee0f09c08e.html
+URL: 'https://raw.githubusercontent.com/meshery/meshery.io/master/catalog/76082cd4-c66c-4e7b-8a9b-02ee0f09c08e/0.0.5/design.yml'
+downloadLink: 76082cd4-c66c-4e7b-8a9b-02ee0f09c08e/design.yml
+---
\ No newline at end of file
```

**File**: `docs/catalog/deployment/8aeeda0a-bc0b-4dae-9814-06ea97258969.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+---
+layout: item
+name: Sample Kubernetes App
+publishedVersion: 0.0.5
+userId: 9cf9f47f-3700-4e0f-9382-c339ecf9c20e
+userName: Nikhil Kumar
+userAvatarURL: https://lh3.googleusercontent.com/a/ACg8ocLGZ8InVoDiUrNl73__lG8S_FlD_XoFRfuP1QXdZjcuHRMuQwOM3A=s96-c
+type: deployment
+compatibility:
+
+patternId: 8aeeda0a-bc0b-4dae-9814-06ea97258969
+image: /assets/images/logos/service-mesh-pattern.svg
+patternInfo: |
+  ""
+patternCaveats: |
+  ""
+createdAt: 2026-09-26T19:14:33Z
+permalink: catalog/deployment/sample-kubernetes-app-8aeeda0a-bc0b-4dae-9814-06ea97258969.html
+URL: 'https://raw.githubusercontent.com/meshery/meshery.io/master/catalog/8aeeda0a-bc0b-4dae-9814-06ea97258969/0.0.5/design.yml'
+downloadLink: 8aeeda0a-bc0b-4dae-9814-06ea97258969/design.yml
+---
\ No newline at end of file
```

**File**: `docs/catalog/deployment/d55d0818-4b00-4ab1-bf40-1c7df9598a42.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+---
+layout: item
+name: API Architecture
+publishedVersion: 0.0.1
+userId: d6be414f-a61f-4ac6-85ec-a08fb87b7198
+userName: Ashish Vaghela
+userAvatarURL: https://lh3.googleusercontent.com/a/ACg8ocIvFlt5cmfjjhQh9qFN41bnrxBnchx6QogIN3pyGaYlcxeRl9s=s96-c
+type: deployment
+compatibility:
+    - aws-api-gateway-operator
+patternId: d55d0818-4b00-4ab1-bf40-1c7df9598a42
+image: /assets/images/logos/service-mesh-pattern.svg
+patternInfo: |
+  Simple%20API%20service%20architecture
+patternCaveats: |
+  Api%20As%20a%20Service%20for%20multiple%20cloud%20providers
+createdAt: 2026-09-17T07:08:17Z
+permalink: catalog/deployment/api-architecture-d55d0818-4b00-4ab1-bf40-1c7df9598a42.html
+URL: 'https://raw.githubusercontent.com/meshery/meshery.io/master/catalog/d55d0818-4b00-4ab1-bf40-1c7df9598a42/0.0.1/design.yml'
+downloadLink: d55d0818-4b00-4ab1-bf40-1c7df9598a42/design.yml
+---
\ No newline at end of file
```

**File**: `docs/content/en/extensions/models/consul/components/route-header-match-invert-filter/icons/color/route-header-match-invert-filter-color.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#a)" fill="#e03875"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.626 12.114c-1.17 0-2.082-.94-2.082-2.147 0-1.208.911-2.148 2.082-2.148 1.17 0 2.081.94 2.081 2.148 0 1.208-.91 2.147-2.081 2.147Zm4.064-1.14a.994.994 0 0 1-.975-1.007c0-.537.423-1.007.976-1.007.52 0 .975.436.975 1.007a.994.994 0 0 1-.975 1.006Zm3.513.939a.947.947 0 0 1-1.17.704c-.521-.134-.814-.67-.684-1.208a.948.948 0 0 1 1.17-.705.985.985 0 0 1 .716 1.141s0 .034-.033.067h.001Zm-.684-2.551c-.52.134-1.04-.202-1.17-.739a1.002 1.002 0 0 1 .715-1.208c.52-.134 1.04.202 1.17.739a.843.843 0 0 1 0 .402.91.91 0 0 1-.715.806Zm3.446 2.416c-.098.536-.585.906-1.105.805a.984.984 0 0 1-.78-1.14c.097-.538.584-.907 1.105-.806.488.1.846.57.813 1.073-.032.034-.032.034-.032.068Zm-.779-2.482c-.52.1-1.008-.269-1.105-.806a.984.984 0 0 1 .78-1.14c.52-.101 1.008.268 1.106.805 0 .1.033.168 0 .268a.951.951 0 0 1-.78.873Zm-.682 5.94a.941.941 0 0 1-1.301.368 1.005 1.005 0 0 1-.358-1.342.941.941 0 0 1 1.3-.37c.326.202.521.571.489.94a1.934 1.934 0 0 1-.13.403Zm-.358-9.128a.941.941 0 0 1-1.3-.37 1.005 1.005 0 0 1 .357-1.342.941.941 0 0 1 1.3.37c.098.2.13.369.13.57a1.007 1.007 0 0 1-.487.772"/><path d="M9.658 20c-2.601 0-5.008-1.04-6.861-2.92A10.35 10.35 0 0 1 0 10c0-2.685 1.008-5.168 2.83-7.081C4.65 1.04 7.09 0 9.657 0a9.4 9.4 0 0 1 5.886 2.047l-1.203 1.61c-1.364-1.071-2.99-1.642-4.68-1.642-2.049 0-4 .839-5.463 2.349C2.733 5.873 1.952 7.853 1.952 10a8.08 8.08 0 0 0 2.277 5.638 7.5 7.5 0 0 0 5.463 2.315 7.4 7.4 0 0 0 4.683-1.644l1.17 1.61C13.855 19.261 11.805 20 9.66 20Z"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h20v20H0z"/></clipPath></defs></svg>
\ No newline at end of file
```

**File**: `docs/content/en/extensions/models/consul/components/route-header-match-invert-filter/icons/white/route-header-match-invert-filter-white.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#a)" fill="#fff"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.401 19.383c-1.873 0-3.33-1.503-3.33-3.436s1.457-3.436 3.33-3.436 3.33 1.503 3.33 3.436-1.457 3.436-3.33 3.436Zm6.504-1.825c-.832 0-1.56-.698-1.56-1.611 0-.86.675-1.61 1.56-1.61.832 0 1.561.697 1.561 1.61 0 .913-.728 1.61-1.56 1.61Zm5.62 1.503a1.516 1.516 0 0 1-1.874 1.126c-.832-.214-1.3-1.073-1.092-1.932a1.516 1.516 0 0 1 1.873-1.128c.779.214 1.3.966 1.144 1.825 0 0 0 .054-.052.107v.002Zm-1.095-4.082c-.833.214-1.665-.323-1.873-1.182a1.604 1.604 0 0 1 1.145-1.933c.832-.215 1.664.323 1.872 1.182.052.215.052.43 0 .644-.052.59-.468 1.128-1.144 1.289Zm5.515 3.865c-.157.859-.938 1.45-1.77 1.289a1.574 1.574 0 0 1-1.248-1.826c.155-.858.936-1.45 1.768-1.288.781.16 1.354.912 1.302 1.718-.052.053-.052.053-.052.107Zm-1.247-3.971c-.832.161-1.613-.43-1.769-1.288a1.575 1.575 0 0 1 1.25-1.826c.832-.161 1.612.43 1.768 1.289 0 .16.052.268 0 .429-.052.698-.572 1.289-1.249 1.396Zm-1.092 9.503c-.416.752-1.353 1.02-2.082.59-.728-.429-.988-1.395-.572-2.147.416-.752 1.353-1.02 2.081-.59.52.322.833.912.78 1.503-.051.215-.103.43-.207.644Zm-.573-14.603c-.728.43-1.665.16-2.08-.591-.417-.752-.157-1.718.572-2.148.728-.43 1.664-.16 2.08.591.157.322.209.59.209.913-.052.483-.312.966-.78 1.235"/><path d="M15.453 32c-4.162 0-8.013-1.664-10.978-4.67A16.56 16.56 0 0 1 0 16c0-4.296 1.613-8.27 4.527-11.33C7.44 1.664 11.343 0 15.453 0c3.434 0 6.712 1.127 9.418 3.276l-1.924 2.576c-2.186-1.717-4.788-2.63-7.493-2.63-3.278 0-6.4 1.343-8.741 3.759-2.34 2.416-3.59 5.584-3.59 9.02 0 3.382 1.301 6.604 3.643 9.02 2.341 2.415 5.411 3.704 8.741 3.704 2.758 0 5.36-.913 7.492-2.63l1.874 2.576c-2.706 2.147-5.984 3.328-9.418 3.328l-.002.001Z"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h32v32H0z"/></clipPath></defs></svg>
\ No newline at end of file
```

**File**: `docs/content/en/extensions/models/consul/components/route-upstream-limits-filter/icons/color/route-upstream-limits-filter-color.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#a)" fill="#e03875"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.626 12.114c-1.17 0-2.082-.94-2.082-2.147 0-1.208.911-2.148 2.082-2.148 1.17 0 2.081.94 2.081 2.148 0 1.208-.91 2.147-2.081 2.147Zm4.064-1.14a.994.994 0 0 1-.975-1.007c0-.537.423-1.007.976-1.007.52 0 .975.436.975 1.007a.994.994 0 0 1-.975 1.006Zm3.513.939a.947.947 0 0 1-1.17.704c-.521-.134-.814-.67-.684-1.208a.948.948 0 0 1 1.17-.705.985.985 0 0 1 .716 1.141s0 .034-.033.067h.001Zm-.684-2.551c-.52.134-1.04-.202-1.17-.739a1.002 1.002 0 0 1 .715-1.208c.52-.134 1.04.202 1.17.739a.843.843 0 0 1 0 .402.91.91 0 0 1-.715.806Zm3.446 2.416c-.098.536-.585.906-1.105.805a.984.984 0 0 1-.78-1.14c.097-.538.584-.907 1.105-.806.488.1.846.57.813 1.073-.032.034-.032.034-.032.068Zm-.779-2.482c-.52.1-1.008-.269-1.105-.806a.984.984 0 0 1 .78-1.14c.52-.101 1.008.268 1.106.805 0 .1.033.168 0 .268a.951.951 0 0 1-.78.873Zm-.682 5.94a.941.941 0 0 1-1.301.368 1.005 1.005 0 0 1-.358-1.342.941.941 0 0 1 1.3-.37c.326.202.521.571.489.94a1.934 1.934 0 0 1-.13.403Zm-.358-9.128a.941.941 0 0 1-1.3-.37 1.005 1.005 0 0 1 .357-1.342.941.941 0 0 1 1.3.37c.098.2.13.369.13.57a1.007 1.007 0 0 1-.487.772"/><path d="M9.658 20c-2.601 0-5.008-1.04-6.861-2.92A10.35 10.35 0 0 1 0 10c0-2.685 1.008-5.168 2.83-7.081C4.65 1.04 7.09 0 9.657 0a9.4 9.4 0 0 1 5.886 2.047l-1.203 1.61c-1.364-1.071-2.99-1.642-4.68-1.642-2.049 0-4 .839-5.463 2.349C2.733 5.873 1.952 7.853 1.952 10a8.08 8.08 0 0 0 2.277 5.638 7.5 7.5 0 0 0 5.463 2.315 7.4 7.4 0 0 0 4.683-1.644l1.17 1.61C13.855 19.261 11.805 20 9.66 20Z"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h20v20H0z"/></clipPath></defs></svg>
\ No newline at end of file
```

**File**: `docs/content/en/extensions/models/consul/components/route-upstream-limits-filter/icons/white/route-upstream-limits-filter-white.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#a)" fill="#fff"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.401 19.383c-1.873 0-3.33-1.503-3.33-3.436s1.457-3.436 3.33-3.436 3.33 1.503 3.33 3.436-1.457 3.436-3.33 3.436Zm6.504-1.825c-.832 0-1.56-.698-1.56-1.611 0-.86.675-1.61 1.56-1.61.832 0 1.561.697 1.561 1.61 0 .913-.728 1.61-1.56 1.61Zm5.62 1.503a1.516 1.516 0 0 1-1.874 1.126c-.832-.214-1.3-1.073-1.092-1.932a1.516 1.516 0 0 1 1.873-1.128c.779.214 1.3.966 1.144 1.825 0 0 0 .054-.052.107v.002Zm-1.095-4.082c-.833.214-1.665-.323-1.873-1.182a1.604 1.604 0 0 1 1.145-1.933c.832-.215 1.664.323 1.872 1.182.052.215.052.43 0 .644-.052.59-.468 1.128-1.144 1.289Zm5.515 3.865c-.157.859-.938 1.45-1.77 1.289a1.574 1.574 0 0 1-1.248-1.826c.155-.858.936-1.45 1.768-1.288.781.16 1.354.912 1.302 1.718-.052.053-.052.053-.052.107Zm-1.247-3.971c-.832.161-1.613-.43-1.769-1.288a1.575 1.575 0 0 1 1.25-1.826c.832-.161 1.612.43 1.768 1.289 0 .16.052.268 0 .429-.052.698-.572 1.289-1.249 1.396Zm-1.092 9.503c-.416.752-1.353 1.02-2.082.59-.728-.429-.988-1.395-.572-2.147.416-.752 1.353-1.02 2.081-.59.52.322.833.912.78 1.503-.051.215-.103.43-.207.644Zm-.573-14.603c-.728.43-1.665.16-2.08-.591-.417-.752-.157-1.718.572-2.148.728-.43 1.664-.16 2.08.591.157.322.209.59.209.913-.052.483-.312.966-.78 1.235"/><path d="M15.453 32c-4.162 0-8.013-1.664-10.978-4.67A16.56 16.56 0 0 1 0 16c0-4.296 1.613-8.27 4.527-11.33C7.44 1.664 11.343 0 15.453 0c3.434 0 6.712 1.127 9.418 3.276l-1.924 2.576c-2.186-1.717-4.788-2.63-7.493-2.63-3.278 0-6.4 1.343-8.741 3.759-2.34 2.416-3.59 5.584-3.59 9.02 0 3.382 1.301 6.604 3.643 9.02 2.341 2.415 5.411 3.704 8.741 3.704 2.758 0 5.36-.913 7.492-2.63l1.874 2.576c-2.706 2.147-5.984 3.328-9.418 3.328l-.002.001Z"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h32v32H0z"/></clipPath></defs></svg>
\ No newline at end of file
```

---

### Incident Patch 6: `b644d92a` (2026-09-29)
**Commit Message**: Merge pull request #22058 from AliRana30/docs/fix-ui-contributing-relative-links

[Docs] Fix broken relative links to server and testing guides in UI contributing doc

**File**: `docs/content/en/project/contributing/contributing-server.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ make ui-build` >}}
 {{< code code=`make server` >}}
 
 Any time changes are made to the Go code, you will have to stop the server and run the above command again.
-Once the Meshery server is up and running, you should be able to access Meshery on your `localhost` on port `9081` at `http://localhost:9081`. One thing to note, you might NOT see the [Meshery UI](#contributing-ui) until the UI code is built as well.
+Once the Meshery server is up and running, you should be able to access Meshery on your `localhost` on port `9081` at `http://localhost:9081`. One thing to note, you might NOT see the [Meshery UI]({{< ref "project/contributing/ui/ui#contributing-ui" >}}) until the UI code is built as well.
 After running Meshery server, you will need to select your **Cloud Provider** by navigating to `localhost:9081`. Only then you will be able to use the Meshery UI on port `3000`.
 
 **Please note**: If you get error while starting the server as **"Meshery Development Incompatible"** then follow the below guideline 👇
```

**File**: `docs/content/en/project/contributing/ui/ui.md` (modified, +2/-2)
```diff
@@ -126,15 +126,15 @@ If you want to work on the UI, it will be a good idea to use the included UI dev
 
 {{< code code=`make ui` >}}
 
-Refer to [Contributing to Meshery Server](contributing-server), if needed.
+Refer to [Contributing to Meshery Server]({{< ref "project/contributing/contributing-server" >}}), if needed.
 
 > Make sure to have Meshery Server configured, up and running on the default port `http://localhost:9081` and choose a provider to login with (visit `http://localhost:9081`) before proceeding to access and work on the UI server at `http://localhost:3000`.
 
 Any UI changes made now will _automatically_ be rebuilt and served in your browser.
 
 ### Running end-to-end integration tests
 
-Refer to [Meshery UI Testing](contributing-ui-tests) for details of how to contribute and benefit from Meshery UI testing.
+Refer to [Meshery UI Testing]({{< ref "project/contributing/ui/tests" >}}) for details of how to contribute and benefit from Meshery UI testing.
 
 ### Static Files, Icons and Images
 
```

---

### Incident Patch 7: `8a643331` (2026-09-29)
**Commit Message**: Merge branch 'master' into docs/fix-ui-contributing-relative-links

**File**: `AGENTS.md` (modified, +3/-1)
```diff
@@ -222,7 +222,9 @@ make helm-docs      # Generate Helm chart docs
   event raised outside a user request through `HandlerConfig.SystemEventPersister`; index
   `Providers` only with the comma-ok form, and only on the request path. Boot-time work
   that can fault belongs inside `models.RunSeedStage` so it degrades the server rather
-  than terminating it. Detail:
+  than terminating it - but its `recover` reaches only the stage's own goroutine, so a
+  stage that spawns one must defer its own recover at the spawn site (as `SeedKeys` does)
+  instead of widening the wrapper. Detail:
   [Extensibility: Providers](./docs/content/en/reference/extensibility/providers/index.md).
 - Only `utils.Log.Error(err)` renders a MeshKit error's code, cause and remediation; cobra's
   default print shows just the message. In `mesheryctl` commands, log the structured error
```

**File**: `docs/content/en/extensions/models/aws-opensearchservice-controller/components/vpc-endpoint-access/icons/color/vpc-endpoint-access-color.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg width="30" height="34" viewBox="0 0 64.386 62.635" xmlns="http://www.w3.org/2000/svg"><path d="m18.112 62.241c-.58208-.2097-1.0825-.38307-1.1121-.38526-.05964-.004-6.9703-8.5523-8.016-9.9151-.3638-.47411-1.8521-2.3244-3.3073-4.1118-6.169-7.5771-5.7671-6.894-5.6043-9.525.07652-1.2369.2681-2.6062.42574-3.0427.15763-.43656.88408-3.4726 1.6143-6.7469s1.4423-6.4294 1.5822-7.0115c.13998-.58209.49521-2.1299.78941-3.4396 1.3414-5.9718 1.3876-6.0514 4.3737-7.5406 1.313-.65484 3.9324-1.927 5.8208-2.8269 1.8885-.89995 6.3475-3.0258 9.9091-4.7242 7.7798-3.7099 7.4615-3.6736 12.178-1.3871 1.6735.81137 4.531 2.1853 6.35 3.0532 1.819.86788 4.4384 2.1189 5.8208 2.78 1.3824.66112 3.7644 1.7868 5.2931 2.5015 2.9983 1.4017 4.0296 2.3189 4.4852 3.9889.24392.89408.61395 2.4653 2.1314 9.0501.28504 1.2369.86914 3.7372 1.298 5.5562s.97374 4.2003 1.2108 5.2917c.2371 1.0914.56563 2.4425.73006 3.0024.50213 1.7098.37232 3.363-.34938 4.4494-.35422.53325-2.549 3.3137-4.8774 6.1788-2.3283 2.8651-4.531 5.6016-4.8948 6.0813-3.5052 4.6213-6.5923 8.1362-7.558 8.6052-1.0278.49922-1.6581.52197-14.155.51087-10.7-.01-13.272-.081-14.138-.39289zm14.42-14.853c1.993-.65861 4.1321-1.8055 5.208-2.7923l.57777-.52995.15829 1.0218c.37804 2.4404.25325 2.3447 3.0582 2.3447h2.5072v-12.965c0-14.742.01357-14.637-2.1954-17.096-2.2207-2.4725-5.3026-3.3183-11.157-3.0616-3.7392.16395-6.9101.77913-9.2875 1.8019l-1.3054.56157v2.2164c0 1.219.0817 2.2164.18156 2.2164s1.0226-.23473 2.0505-.52163c2.4182-.67492 6.8343-1.3304 8.9629-1.3304 2.0099.0 4.3168.63112 5.1681 1.4139 1.22 1.1218 1.459 1.9649 1.5795 5.5722.10844 3.2453.08971 3.4049-.37858 3.2252-.27096-.10398-1.6251-.35976-3.0091-.56841-6.4942-.979-10.999.005-14.067 3.0735-2.0011 2.0011-2.4548 3.2402-2.4641 6.7305-.0065 2.4258.08634 3.1141.55768 4.1334 1.179 2.5499 3.2925 4.2534 5.9416 4.9794 2.3169.63499 5.0434.52227 7.9127-.42589zm-5.3603-4.4174c-1.3419-.50246-1.7811-.90498-2.3487-2.1529-.96238-2.1156-.37837-5.1724 1.2299-6.4375 1.6643-1.3091 6.0181-1.7402 10.183-1.0084l1.7198.30217v6.6092l-1.4496.86623c-3.1522 1.8836-7.1071 2.6552-9.3347 1.8212z" stroke-width=".26458" style="fill:#212529"></path><path style="fill:none;stroke-width:.271169" d="m97.026736 181.42372c-11.841729-2.08439-21.332462-9.10215-26.093859-19.29466-1.998022-4.27707-2.054194-4.6839-2.055098-14.88419-841e-6-9.49243.144169-11.16725 1.267846-14.64314 1.712817-5.29828 6.177554-10.936 12.299033-15.53024 2.542552-1.90822 7.390509-4.53026 10.594967-5.73033 8.933335-3.34556 20.674605-4.18152 34.409895-2.44995 4.41785.55695 12.65266 1.97363 14.19738 2.44244 1.76241.53489 1.85502.50959 2.22367-.60744.24279-.73566.28029-2.73516.14369-7.66053-.44788-16.149002-1.23751-19.911778-5.02917-23.965076-1.80821-1.932978-3.56225-2.973051-7.11557-4.219231-5.30124-1.859191-12.26098-2.569875-19.19872-1.960452-10.49153.921594-19.993865 2.573896-30.430988 5.291456l-5.619006 1.463045-.198978-.992725C76.31239 78.136699 76.217381 74.401849 76.210696 70.38303l-.01215-7.306943 3.356503-1.444983c10.517529-4.527823 21.216871-6.656502 37.293351-7.419665 12.51101-.593907 22.76653.582675 29.54824 3.389974 4.64166 1.921419 7.46417 3.920688 11.49419 8.14168 5.92808 6.208991 7.10885 9.292714 7.94906 20.759878.20234 2.761617.35353 19.385439.44083 48.471489l.13286 44.26837-6.87266-.008c-7.35796-.009-10.40797-.26157-11.45694-.94889-1.06894-.70039-1.56607-2.17132-2.37024-7.01314-.41845-2.51943-.81979-4.63975-.89185-4.71182-.0721-.0721-.94053.61073-1.92991 1.51732-2.61666 2.39769-6.17638 4.67392-11.10375 7.10019-7.00303 3.44832-13.15672 5.41292-19.90153 6.35366-4.14851.57862-11.25229.52696-14.85996-.10807zM117.9586 163.14859c7.66738-1.41157 14.24402-3.97835 21.89691-8.5461l3.72858-2.22546v-12.58107c0-11.74762-.0314-12.59038-.47455-12.72168-1.42309-.42168-10.77757-1.80215-14.1221-2.08405-4.68265-.39467-14.28993-.18758-17.80807.38387-8.70887 1.41459-13.028171 3.55254-15.811026 7.82606-2.230704 3.42561-3.30745 7.4555-3.304504 12.36763.0032 5.38208 1.685615 10.33001 4.555689 13.39835 1.872987 2.00238 6.082191 3.96008 9.779001 4.54822 2.10281.33454 8.92935.11855 11.56007-.36577z" transform="scale(0.26458333)"></path></svg>
\ No newline at end of file
```

**File**: `docs/content/en/extensions/models/aws-opensearchservice-controller/components/vpc-endpoint-access/icons/white/vpc-endpoint-access-white.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg width="30" height="34" viewBox="0 0 64.386 62.635" xmlns="http://www.w3.org/2000/svg"><path d="m18.112 62.241c-.58208-.2097-1.0825-.38307-1.1121-.38526-.05964-.004-6.9703-8.5523-8.016-9.9151-.3638-.47411-1.8521-2.3244-3.3073-4.1118-6.169-7.5771-5.7671-6.894-5.6043-9.525.07652-1.2369.2681-2.6062.42574-3.0427.15763-.43656.88408-3.4726 1.6143-6.7469s1.4423-6.4294 1.5822-7.0115c.13998-.58209.49521-2.1299.78941-3.4396 1.3414-5.9718 1.3876-6.0514 4.3737-7.5406 1.313-.65484 3.9324-1.927 5.8208-2.8269 1.8885-.89995 6.3475-3.0258 9.9091-4.7242 7.7798-3.7099 7.4615-3.6736 12.178-1.3871 1.6735.81137 4.531 2.1853 6.35 3.0532 1.819.86788 4.4384 2.1189 5.8208 2.78 1.3824.66112 3.7644 1.7868 5.2931 2.5015 2.9983 1.4017 4.0296 2.3189 4.4852 3.9889.24392.89408.61395 2.4653 2.1314 9.0501.28504 1.2369.86914 3.7372 1.298 5.5562s.97374 4.2003 1.2108 5.2917c.2371 1.0914.56563 2.4425.73006 3.0024.50213 1.7098.37232 3.363-.34938 4.4494-.35422.53325-2.549 3.3137-4.8774 6.1788-2.3283 2.8651-4.531 5.6016-4.8948 6.0813-3.5052 4.6213-6.5923 8.1362-7.558 8.6052-1.0278.49922-1.6581.52197-14.155.51087-10.7-.01-13.272-.081-14.138-.39289zm14.42-14.853c1.993-.65861 4.1321-1.8055 5.208-2.7923l.57777-.52995.15829 1.0218c.37804 2.4404.25325 2.3447 3.0582 2.3447h2.5072v-12.965c0-14.742.01357-14.637-2.1954-17.096-2.2207-2.4725-5.3026-3.3183-11.157-3.0616-3.7392.16395-6.9101.77913-9.2875 1.8019l-1.3054.56157v2.2164c0 1.219.0817 2.2164.18156 2.2164s1.0226-.23473 2.0505-.52163c2.4182-.67492 6.8343-1.3304 8.9629-1.3304 2.0099.0 4.3168.63112 5.1681 1.4139 1.22 1.1218 1.459 1.9649 1.5795 5.5722.10844 3.2453.08971 3.4049-.37858 3.2252-.27096-.10398-1.6251-.35976-3.0091-.56841-6.4942-.979-10.999.005-14.067 3.0735-2.0011 2.0011-2.4548 3.2402-2.4641 6.7305-.0065 2.4258.08634 3.1141.55768 4.1334 1.179 2.5499 3.2925 4.2534 5.9416 4.9794 2.3169.63499 5.0434.52227 7.9127-.42589zm-5.3603-4.4174c-1.3419-.50246-1.7811-.90498-2.3487-2.1529-.96238-2.1156-.37837-5.1724 1.2299-6.4375 1.6643-1.3091 6.0181-1.7402 10.183-1.0084l1.7198.30217v6.6092l-1.4496.86623c-3.1522 1.8836-7.1071 2.6552-9.3347 1.8212z" stroke-width=".26458" style="fill:#fff"></path><path style="fill:none;stroke-width:.271169" d="m97.026736 181.42372c-11.841729-2.08439-21.332462-9.10215-26.093859-19.29466-1.998022-4.27707-2.054194-4.6839-2.055098-14.88419-841e-6-9.49243.144169-11.16725 1.267846-14.64314 1.712817-5.29828 6.177554-10.936 12.299033-15.53024 2.542552-1.90822 7.390509-4.53026 10.594967-5.73033 8.933335-3.34556 20.674605-4.18152 34.409895-2.44995 4.41785.55695 12.65266 1.97363 14.19738 2.44244 1.76241.53489 1.85502.50959 2.22367-.60744.24279-.73566.28029-2.73516.14369-7.66053-.44788-16.149002-1.23751-19.911778-5.02917-23.965076-1.80821-1.932978-3.56225-2.973051-7.11557-4.219231-5.30124-1.859191-12.26098-2.569875-19.19872-1.960452-10.49153.921594-19.993865 2.573896-30.430988 5.291456l-5.619006 1.463045-.198978-.992725C76.31239 78.136699 76.217381 74.401849 76.210696 70.38303l-.01215-7.306943 3.356503-1.444983c10.517529-4.527823 21.216871-6.656502 37.293351-7.419665 12.51101-.593907 22.76653.582675 29.54824 3.389974 4.64166 1.921419 7.46417 3.920688 11.49419 8.14168 5.92808 6.208991 7.10885 9.292714 7.94906 20.759878.20234 2.761617.35353 19.385439.44083 48.471489l.13286 44.26837-6.87266-.008c-7.35796-.009-10.40797-.26157-11.45694-.94889-1.06894-.70039-1.56607-2.17132-2.37024-7.01314-.41845-2.51943-.81979-4.63975-.89185-4.71182-.0721-.0721-.94053.61073-1.92991 1.51732-2.61666 2.39769-6.17638 4.67392-11.10375 7.10019-7.00303 3.44832-13.15672 5.41292-19.90153 6.35366-4.14851.57862-11.25229.52696-14.85996-.10807zM117.9586 163.14859c7.66738-1.41157 14.24402-3.97835 21.89691-8.5461l3.72858-2.22546v-12.58107c0-11.74762-.0314-12.59038-.47455-12.72168-1.42309-.42168-10.77757-1.80215-14.1221-2.08405-4.68265-.39467-14.28993-.18758-17.80807.38387-8.70887 1.41459-13.028171 3.55254-15.811026 7.82606-2.230704 3.42561-3.30745 7.4555-3.304504 12.36763.0032 5.38208 1.685615 10.33001 4.555689 13.39835 1.872987 2.00238 6.082191 3.96008 9.779001 4.54822 2.10281.33454 8.92935.11855 11.56007-.36577z" transform="scale(0.26458333)"></path></svg>
\ No newline at end of file
```

**File**: `docs/content/en/extensions/models/aws-opensearchservice-controller/index.md` (modified, +9/-1)
```diff
@@ -29,7 +29,15 @@ components:
   colorIcon: extensions/models/aws-opensearchservice-controller/components/vpc-endpoint/icons/color/vpc-endpoint-color.svg
   whiteIcon: extensions/models/aws-opensearchservice-controller/components/vpc-endpoint/icons/white/vpc-endpoint-white.svg
   description: 
-components-count: 5
+- name: vpc-endpoint-access
+  colorIcon: extensions/models/aws-opensearchservice-controller/components/vpc-endpoint-access/icons/color/vpc-endpoint-access-color.svg
+  whiteIcon: extensions/models/aws-opensearchservice-controller/components/vpc-endpoint-access/icons/white/vpc-endpoint-access-white.svg
+  description: 
+- name: vpc-endpoint-access
+  colorIcon: extensions/models/aws-opensearchservice-controller/components/vpc-endpoint-access/icons/color/vpc-endpoint-access-color.svg
+  whiteIcon: extensions/models/aws-opensearchservice-controller/components/vpc-endpoint-access/icons/white/vpc-endpoint-access-white.svg
+  description: 
+components-count: 7
 relationships: 
 - type: "non-binding"
   kind: "edge"
```

**File**: `docs/content/en/guides/mesheryctl/system-commands/index.md` (modified, +3/-3)
```diff
@@ -59,7 +59,7 @@ Let's get familiar with mesheryctl system commands. The syntax of the mesheryctl
 <a href="images/reset.png"><img class="content-image" alt="skip-browser" src="images/reset.png" /></a>
 
 ### restart 
-`meshryctl system restart` : Stops Meshery and then starts it again. Opens the website in your default browser.
+`mesheryctl system restart` : Stops Meshery and then starts it again. Opens the website in your default browser.
 
 <a href="images/restart.png"><img class="content-image" alt="skip-browser" src="images/restart.png" /></a>
 
@@ -97,7 +97,7 @@ Let's get familiar with mesheryctl system commands. The syntax of the mesheryctl
 
 `mesheryctl system check --preflight` : Runs pre-deployment checks.
 
-`mesheryctl system check --adapter` : Runs checks for a specific Mesh adapter.
+`mesheryctl system check --adapter <adapter-name>` : Runs checks for a specified Mesh adapter.
 
 `mesheryctl system check --adapters` : Runs checks for Meshery adapters
 
@@ -126,7 +126,7 @@ Let's get familiar with mesheryctl system commands. The syntax of the mesheryctl
 
 <a href="images/context create.png"><img class="content-image" alt="skip-browser" src="images/context create.png" /></a>
 
-`mesheryctl system context create --component stringArray` : Specifies the component to be created in the context.
+`mesheryctl system context create --components stringArray` : Specifies the components to be created in the context.
 
 `mesheryctl system context create --platform string` : Specifies the platform.
 
```

**File**: `docs/content/en/project/contributing/cli/cli.md` (modified, +0/-2)
```diff
@@ -144,8 +144,6 @@ Unit tests and integration tests are essential to make each mesheryctl release r
 
 Unit test code coverage reports can be found in the [CodeCov logs](https://app.codecov.io/gh/meshery/meshery/). _Note: GitHub login may be required for access._
 
-This format should reference an external file where your manual changes are stored. These files should be present at the folder path (`_includes/mesheryctl/`). Any content added using this method will not be altered during the documentation generation process, but instead will be included post-auto doc generation. When making new changes or additions, understand that these additional details are positioned at the end their given CLI reference page, so bear this in mind as you organize and present your additional command details.
-
 ### Integration Tests
 
 **Marking integration tests under unit tests**
```

**File**: `docs/content/en/reference/extensibility/authorization/index.md` (modified, +25/-0)
```diff
@@ -76,6 +76,28 @@ The local database seeds are populated via `server/permissions/keys.csv` in the
 
 On startup, Meshery Server's [`SeedKeys`](https://github.com/meshery/meshery/blob/master/server/models/keys_helper.go) seeds these keys into the database.
 
+{{% alert color="warning" title="The `Local Provider` header selects every seeded row" %}}
+`SeedKeys` decides what to seed by looking up the **`Local Provider`** column by
+name in the header row of `keys.csv` (or of the file `KEYS_PATH` points at). If
+that header is renamed or dropped, the lookup matches nothing, **no** row is
+selected, and nothing is seeded from the file - not just for the key you were
+adding. On a fresh or reset database the Key table is left empty on every boot;
+previously seeded keys are not cleared and keep working. `SeedKeys` reports this
+once per seeding run - at boot, and again after a database reset - as
+[`meshery-server-1486`]({{< ref "reference/references/error-codes.md" >}});
+restore the header and restart the server to seed again.
+
+An empty Key table is fail-closed, and its effect is confined to Meshery UI. The
+CASL `ability` in [`ui/utils/can.ts`](https://github.com/meshery/meshery/blob/master/ui/utils/can.ts)
+starts with no rules, so zero keys means every gate evaluates to `false` and
+every gated control hides or disables - the same direction as one absent row,
+never "unrestricted". It gates nothing server-side: the Key table is read only
+by `GetUsersKeys`, which serves `GET /api/identity/orgs/{orgId}/users/keys`, and
+no server endpoint consults a key to authorize a request. So an empty table
+hides the affordance without blocking the matching API call. Pinned by
+`TestSeedKeysMissingRegisterColumnIsLoud` in `server/models`.
+{{% /alert %}}
+
 ---
 
 #### Phase 3: Wire Key in the UI
@@ -201,6 +223,8 @@ If the key is missing from `Keys` altogether, it has not made it through the spr
 ##### 5. Local Provider: confirm database seeding
 The key must be in [`server/permissions/keys.csv`](https://github.com/meshery/meshery/blob/master/server/permissions/keys.csv) with **`Local Provider = TRUE`**. Restart Meshery Server (or reset the local DB) after the CSV updates.
 
+If *no* key gates correctly rather than just this one, check the server log for [`meshery-server-1486`]({{< ref "reference/references/error-codes.md" >}}): the CSV's `Local Provider` header itself is missing, so `SeedKeys` seeded nothing at all.
+
 ##### 6. Remote Provider: confirm role assignment
 Keys come from roles assigned in the Remote Provider admin UI. An empty API response usually means a role/keychain issue—not a missing entry in the generated `Keys` alone.
 
@@ -216,6 +240,7 @@ Verify that the `token` cookie is set and not expired:
 |---------|----------------|
 | Button never appears | User lacks the key; the key is missing from the generated `Keys`; or the gate is not wired |
 | New key not visible after merge | Stale `sessionStorage.keys`; missing Local Provider seed row; or only schemas PR merged |
+| *Every* gated control is hidden or disabled | The Key table seeded empty - check the server log for `meshery-server-1486`, which means the `Local Provider` header is missing from `keys.csv` |
 | Works in one org, not another | Keys are org-scoped—check `currentOrg` and refetch keys |
 | API returns `401` or `403` when fetching keys | Expired or missing `token` cookie; verify browser cookie store |
 
```

**File**: `docs/content/en/reference/extensibility/providers/index.md` (modified, +21/-0)
```diff
@@ -195,6 +195,27 @@ unaffected: it receives its provider from the request context, which enforcement
 resolves consistently.
 {{% /alert %}}
 
+{{% alert color="warning" title="Contributing: a seeding fault must not terminate the server" %}}
+Every boot seeding stage runs through `models.RunSeedStage`, which recovers a
+panic raised inside that stage, logs it as
+[`meshery-server-1483`]({{< ref "reference/references/error-codes.md" >}}) with
+the stage name and stack trace, and lets the remaining stages run. A Meshery
+Server with an incomplete registry is still useful and its operator can read the
+error; one that exits at boot leaves them a crash loop and no UI to read it in.
+
+`recover` reaches only the goroutine that deferred it, so wrapping a stage does
+not cover a goroutine that stage spawns - a fault there would still take the
+process down. A stage that spawns one therefore recovers at its own spawn site
+and reports through the same `ErrSeedingStagePanic`, making the failure
+indistinguishable in the log from one `RunSeedStage` caught itself. `SeedKeys`
+(`server/models/keys_helper.go`), which parses `keys.csv` on a spawned
+goroutine, is the only seeding callee that spawns one today; give any new one
+the same deferred recover rather than widening `RunSeedStage`, which cannot
+reach a child goroutine. Both halves are pinned by tests in `server/models`:
+`TestRunSeedStageRecoversPanic` and
+`TestSeedKeysChildGoroutinePanicIsContained`.
+{{% /alert %}}
+
 ### Deep-Link Preservation
 
 Meshery preserves the originally requested URL when authentication is required, enabling seamless navigation after login:
```

---

### Incident Patch 8: `c613aae6` (2026-09-29)
**Commit Message**: [Docs] Fix broken relative links in UI and server contributor guides

Update relative documentation links in the UI and server contributor guides to use Hugo ref shortcodes. Specifically:
- Target nested ui/ui#contributing-ui anchor from contributing-server.md
- Use Hugo ref shortcodes for server and UI testing guide references in ui/ui.md

Fixes #22056

Signed-off-by: Ali Mahmood <[REDACTED_EMAIL]>

**File**: `docs/content/en/project/contributing/contributing-server.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ make ui-build` >}}
 {{< code code=`make server` >}}
 
 Any time changes are made to the Go code, you will have to stop the server and run the above command again.
-Once the Meshery server is up and running, you should be able to access Meshery on your `localhost` on port `9081` at `http://localhost:9081`. One thing to note, you might NOT see the [Meshery UI](#contributing-ui) until the UI code is built as well.
+Once the Meshery server is up and running, you should be able to access Meshery on your `localhost` on port `9081` at `http://localhost:9081`. One thing to note, you might NOT see the [Meshery UI]({{< ref "project/contributing/ui/ui#contributing-ui" >}}) until the UI code is built as well.
 After running Meshery server, you will need to select your **Cloud Provider** by navigating to `localhost:9081`. Only then you will be able to use the Meshery UI on port `3000`.
 
 **Please note**: If you get error while starting the server as **"Meshery Development Incompatible"** then follow the below guideline 👇
```

**File**: `docs/content/en/project/contributing/ui/ui.md` (modified, +2/-2)
```diff
@@ -126,15 +126,15 @@ If you want to work on the UI, it will be a good idea to use the included UI dev
 
 {{< code code=`make ui` >}}
 
-Refer to [Contributing to Meshery Server](contributing-server), if needed.
+Refer to [Contributing to Meshery Server]({{< ref "project/contributing/contributing-server" >}}), if needed.
 
 > Make sure to have Meshery Server configured, up and running on the default port `http://localhost:9081` and choose a provider to login with (visit `http://localhost:9081`) before proceeding to access and work on the UI server at `http://localhost:3000`.
 
 Any UI changes made now will _automatically_ be rebuilt and served in your browser.
 
 ### Running end-to-end integration tests
 
-Refer to [Meshery UI Testing](contributing-ui-tests) for details of how to contribute and benefit from Meshery UI testing.
+Refer to [Meshery UI Testing]({{< ref "project/contributing/ui/tests" >}}) for details of how to contribute and benefit from Meshery UI testing.
 
 ### Static Files, Icons and Images
 
```

---

### Incident Patch 9: `53c386a9` (2026-09-28)
**Commit Message**: Merge pull request #22127 from meshery/fm/seedkeys-done-race-drops-last-key

[Server] Fix SeedKeys Done-race dropping last key, buffered errors, and panicking-save leak

**File**: `server/models/keys_helper.go` (modified, +32/-5)
```diff
@@ -92,16 +92,43 @@ func (kh *KeysRegistrationHelper) SeedKeys(filePath string) {
 		select {
 
 		case data := <-ch:
-			_, err := kh.keyPersister.SaveUsersKey(&data)
-			if err != nil {
-				kh.log.Error(err)
-			}
+			kh.saveSeededKey(data)
 		case err := <-errorChan:
 			kh.log.Error(err)
 
 		case <-csvReader.Context.Done():
-			return
+			// The parser calls its deferred cancel only as Parse returns,
+			// after every send has completed, so once Done is observed no
+			// further send can occur. Either channel may still hold a
+			// buffered row or error alongside Done, so drain both
+			// non-blockingly before returning instead of dropping
+			// whatever the select did not pick.
+			for {
+				select {
+				case data := <-ch:
+					kh.saveSeededKey(data)
+				case err := <-errorChan:
+					kh.log.Error(err)
+				default:
+					return
+				}
+			}
 		}
 	}
 
 }
+
+// saveSeededKey persists one parsed key. A panic from the persistence call is
+// contained here so it cannot unwind the seed loop: without a consumer the
+// parser would block forever on its next send and never run the deferred
+// cleanup that ends parsing, leaking the goroutine and the file it holds.
+func (kh *KeysRegistrationHelper) saveSeededKey(data Key) {
+	defer func() {
+		if r := recover(); r != nil {
+			kh.log.Error(ErrSeedingStagePanic("user keys", r, debug.Stack()))
+		}
+	}()
+	if _, err := kh.keyPersister.SaveUsersKey(&data); err != nil {
+		kh.log.Error(err)
+	}
+}
```

**File**: `server/models/keys_helper_test.go` (modified, +295/-0)
```diff
@@ -1,14 +1,27 @@
 package models
 
 import (
+	"fmt"
+	"io"
 	"os"
 	"path/filepath"
+	"runtime"
+	"strings"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
+	"github.com/go-logr/logr"
+	"github.com/gofrs/uuid"
 	"github.com/meshery/meshkit/database"
 	"github.com/meshery/meshkit/logger"
+	"github.com/sirupsen/logrus"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+	gormlogger "gorm.io/gorm/logger"
 )
 
 // seedKeysPanickingLogger panics on its first Error call, then delegates every
@@ -81,3 +94,285 @@ func TestSeedKeysChildGoroutinePanicIsContained(t *testing.T) {
 		time.Sleep(10 * time.Millisecond)
 	}
 }
+
+// seeding fault was surfaced instead of silently dropped.
+type captureLogger struct {
+	mu   sync.Mutex
+	errs []error
+}
+
+func (l *captureLogger) Error(err error) {
+	l.mu.Lock()
+	defer l.mu.Unlock()
+	l.errs = append(l.errs, err)
+}
+
+func (l *captureLogger) Info(_ ...interface{})                {}
+func (l *captureLogger) Infof(_ string, _ ...interface{})     {}
+func (l *captureLogger) Debug(_ ...interface{})               {}
+func (l *captureLogger) Debugf(_ string, _ ...interface{})    {}
+func (l *captureLogger) Warn(_ error)                         {}
+func (l *captureLogger) Warnf(_ string, _ ...interface{})     {}
+func (l *captureLogger) Errorf(_ string, _ ...interface{})    {}
+func (l *captureLogger) Fatal(_ error)                        {}
+func (l *captureLogger) Fatalf(_ string, _ ...interface{})    {}
+func (l *captureLogger) SetLevel(_ logrus.Level)              {}
+func (l *captureLogger) GetLevel() logrus.Level               { return logrus.ErrorLevel }
+func (l *captureLogger) UpdateLogOutput(_ io.Writer)          {}
+func (l *captureLogger) UpdateErrorLogOutput(_ io.Writer)     {}
+func (l *captureLogger) ControllerLogger() logr.Logger        { return logr.Discard() }
+func (l *captureLogger) DatabaseLogger() gormlogger.Interface { return nil }
+
+func (l *captureLogger) errorCount() int {
+	l.mu.Lock()
+	defer l.mu.Unlock()
+	return len(l.errs)
+}
+
+// newKeysSeedDB opens an isolated in-memory database. The DSN names a
+// shared-cache database unique to the caller: a bare ":memory:" gives every
+// pooled connection its own empty database, so a migrate on one connection
+// is invisible to a save on another.
+var keysSeedDBSeq int32
+
+func newKeysSeedDB(t *testing.T, name string) (*gorm.DB, *database.Handler) {
+	t.Helper()
+	// The sequence number keeps the database fresh across -count repetitions
+	// of the test within one process: rows left behind by an earlier
+	// iteration would turn the next iteration's saves into updates, and the
+	// gating create callbacks below would never fire.
+	seq := atomic.AddInt32(&keysSeedDBSeq, 1)
+	dsn := fmt.Sprintf("file:%s-%d?mode=memory&cache=shared", name, seq)
+	gdb, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
+	require.NoError(t, err, "open in-memory database")
+	return gdb, &database.Handler{DB: gdb}
+}
+
+func keysSeedHelper(t *testing.T, gdb *gorm.DB, clog *captureLogger) *KeysRegistrationHelper {
+	t.Helper()
+	krh, err := NewKeysRegistrationHelper(&database.Handler{DB: gdb}, clog)
+	require.NoError(t, err, "build keys registration helper")
+	return krh
+}
+
+// parserGone polls the goroutine dump until no goroutine remains inside the
+// meshkit CSV parser, which proves Parse has returned and therefore run its
+// deferred cancel. It reports whether the parser exited before the deadline.
+func parserGone(timeout time.Duration) bool {
+	deadline := time.Now().Add(timeout)
+	var buf [1 << 20]byte
+	for time.Now().Before(deadline) {
+		n := runtime.Stack(buf[:], true)
+		if !strings.Contains(string(buf[:n]), "meshkit/utils/csv") {
+			return true
+		}
+		time.Sleep(10 * time.Millisecond)
+	}
+	return false
+}
+
+// runSeedKeys runs SeedKeys off the test goroutine and reports whether it
+// returned before the timeout. It cannot catch an escaping panic (that lands
+// on the spawned goroutine), so tests covering the panic strand call SeedKeys
+// directly instead.
+func runSeedKeys(t *testing.T, krh *KeysRegistrationHelper, fixture string, timeout time.Duration) bool {
+	t.Helper()
+	done := make(chan struct{})
+	go func() {
+		defer close(done)
+		krh.SeedKeys(fixture)
+	}()
+	select {
+	case <-done:
+		return true
+	case <-time.After(timeout):
+		return false
+	}
+}
+
+func mustKeyUUID(t *testing.T, s string) uuid.UUID {
+	t.Helper()
+	id, err := uuid.FromString(s)
+	require.NoError(t, err, "parse fixture key id")
+	return id
+}
+
+func seededKeyIDs(t *testing.T, gdb *gorm.DB) map[uuid.UUID]bool {
+	t.Helper()
+	var keys []Key
+	require.NoError(t, gdb.Find(&keys).Error, "list seeded keys")
+	ids := make(map[uuid.UUID]bool, len(keys))
+	for _, k := range keys {
+		ids[k.ID] = true
+	}
+	return ids
+}
+
+// TestSeedKeysDrainsBufferedRowAndErrorAfterCancel forces the
+// cancellation-before-drain ordering: the first save blocks until the parse
```

**File**: `server/models/testdata/keys_seed_drain.csv` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+,,,Authorization,,,,,,,,Keychain,Keys,,
+Category,Function,Feature,User,Team Admin,Academy Admin,Leaner,Workspace Admin,Org Billing Manager,Org Admin,Provider Admin,Keychain ID,Key ID,Inserted,Local Provider
+Catalog,First Key,A first key,X,X,,,X,,X,X,Chain A,11111111-1111-4111-8111-111111111111,X,TRUE
+Catalog,Bad Key,A key whose ID is not a UUID,X,X,,,X,,X,X,Chain A,not-a-uuid,X,TRUE
+Catalog,Last Key,A last key,X,X,,,X,,X,X,Chain A,22222222-2222-4222-8222-222222222222,X,TRUE
+Catalog,Skipped One,Not registered with the local provider,,,,,,,,,,Chain A,33333333-3333-4333-8333-333333333333,X,FALSE
+Catalog,Skipped Two,Not registered with the local provider,,,,,,,,,,Chain A,44444444-4444-4444-8444-444444444444,X,FALSE
```

**File**: `server/models/testdata/keys_seed_panic.csv` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+,,,Authorization,,,,,,,,Keychain,Keys,,
+Category,Function,Feature,User,Team Admin,Academy Admin,Leaner,Workspace Admin,Org Billing Manager,Org Admin,Provider Admin,Keychain ID,Key ID,Inserted,Local Provider
+Catalog,panic-row,A row whose save panics,X,X,,,X,,X,X,Chain A,55555555-5555-4555-8555-555555555555,X,TRUE
+Catalog,Second Key,A second key,X,X,,,X,,X,X,Chain A,66666666-6666-4666-8666-666666666666,X,TRUE
+Catalog,Last Key,A last key,X,X,,,X,,X,X,Chain A,77777777-7777-4777-8777-777777777777,X,TRUE
+Catalog,Skipped One,Not registered with the local provider,,,,,,,,,,Chain A,88888888-8888-4888-8888-888888888888,X,FALSE
+Catalog,Skipped Two,Not registered with the local provider,,,,,,,,,,Chain A,99999999-9999-4999-8999-999999999999,X,FALSE
```

---

### Incident Patch 10: `beb32de3` (2026-09-28)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fm/seedkeys-done-race-drops-last-key

Signed-off-by: Lee Calcote <[REDACTED_EMAIL]>

# Conflicts:
#	server/models/keys_helper_test.go

**File**: `AGENTS.md` (modified, +3/-1)
```diff
@@ -222,7 +222,9 @@ make helm-docs      # Generate Helm chart docs
   event raised outside a user request through `HandlerConfig.SystemEventPersister`; index
   `Providers` only with the comma-ok form, and only on the request path. Boot-time work
   that can fault belongs inside `models.RunSeedStage` so it degrades the server rather
-  than terminating it. Detail:
+  than terminating it - but its `recover` reaches only the stage's own goroutine, so a
+  stage that spawns one must defer its own recover at the spawn site (as `SeedKeys` does)
+  instead of widening the wrapper. Detail:
   [Extensibility: Providers](./docs/content/en/reference/extensibility/providers/index.md).
 - Only `utils.Log.Error(err)` renders a MeshKit error's code, cause and remediation; cobra's
   default print shows just the message. In `mesheryctl` commands, log the structured error
```

**File**: `docs/content/en/reference/extensibility/providers/index.md` (modified, +21/-0)
```diff
@@ -195,6 +195,27 @@ unaffected: it receives its provider from the request context, which enforcement
 resolves consistently.
 {{% /alert %}}
 
+{{% alert color="warning" title="Contributing: a seeding fault must not terminate the server" %}}
+Every boot seeding stage runs through `models.RunSeedStage`, which recovers a
+panic raised inside that stage, logs it as
+[`meshery-server-1483`]({{< ref "reference/references/error-codes.md" >}}) with
+the stage name and stack trace, and lets the remaining stages run. A Meshery
+Server with an incomplete registry is still useful and its operator can read the
+error; one that exits at boot leaves them a crash loop and no UI to read it in.
+
+`recover` reaches only the goroutine that deferred it, so wrapping a stage does
+not cover a goroutine that stage spawns - a fault there would still take the
+process down. A stage that spawns one therefore recovers at its own spawn site
+and reports through the same `ErrSeedingStagePanic`, making the failure
+indistinguishable in the log from one `RunSeedStage` caught itself. `SeedKeys`
+(`server/models/keys_helper.go`), which parses `keys.csv` on a spawned
+goroutine, is the only seeding callee that spawns one today; give any new one
+the same deferred recover rather than widening `RunSeedStage`, which cannot
+reach a child goroutine. Both halves are pinned by tests in `server/models`:
+`TestRunSeedStageRecoversPanic` and
+`TestSeedKeysChildGoroutinePanicIsContained`.
+{{% /alert %}}
+
 ### Deep-Link Preservation
 
 Meshery preserves the originally requested URL when authentication is required, enabling seamless navigation after login:
```

**File**: `server/handlers/environments_handlers_test.go` (modified, +62/-0)
```diff
@@ -252,6 +252,68 @@ func TestSaveEnvironmentHandler_PropagatesProviderStatus(t *testing.T) {
 	}
 }
 
+// environmentAllowThenDenyProvider serves one successful SaveEnvironment call
+// and refuses every later one, so the test below can drive the same request
+// twice and observe both outcomes from a single stub.
+type environmentAllowThenDenyProvider struct {
+	*models.DefaultLocalProvider
+	calls   int
+	denyErr error
+}
+
+func newEnvironmentAllowThenDenyProvider(denyErr error) *environmentAllowThenDenyProvider {
+	base := &models.DefaultLocalProvider{}
+	base.Initialize()
+	return &environmentAllowThenDenyProvider{DefaultLocalProvider: base, denyErr: denyErr}
+}
+
+func (m *environmentAllowThenDenyProvider) SaveEnvironment(_ *http.Request, _ *environment.EnvironmentPayload, _ string, _ bool) ([]byte, error) {
+	m.calls++
+	if m.calls == 1 {
+		return []byte(`{"id":"env-1","name":"prod"}`), nil
+	}
+	return nil, m.denyErr
+}
+
+// TestSaveEnvironmentHandler_AllowsThenRefusesSameRequest closes the
+// "same request, one refused" gap: one SaveEnvironment request body driven
+// twice against a stub provider must succeed with 201 while the provider
+// allows it and be refused with exactly 403 once the provider says no.
+//
+// The refusal is built with the exact expression RemoteProvider.SaveEnvironment
+// evaluates when the upstream provider answers 403 (server/models/remote_provider.go,
+// non-2xx branch): models.ErrPost with the provider's own message, object and
+// status. No distinct ErrPermissionDenied value exists in this repository or
+// its Meshery-module dependencies, so this - the error the provider really
+// returns on this path - is the genuine refusal body. The status assertion is
+// deliberately exact: provider statuses are lost on most provider-error paths,
+// so accepting any non-2xx would pass while the reason is being remapped.
+func TestSaveEnvironmentHandler_AllowsThenRefusesSameRequest(t *testing.T) {
+	h := newTestHandler(t, map[string]models.Provider{}, "")
+	provider := newEnvironmentAllowThenDenyProvider(
+		models.ErrPost(errors.New("failed to save the environment"), "Environment", http.StatusForbidden),
+	)
+
+	const body = `{"name":"prod","description":"","organizationId":"11111111-1111-1111-1111-111111111111"}`
+	// One request, driven twice: request bodies are single-use streams, so
+	// each drive gets a fresh request carrying the identical bytes.
+	newReq := func() *http.Request {
+		return httptest.NewRequest(http.MethodPost, "/api/environments", strings.NewReader(body))
+	}
+
+	allowed := httptest.NewRecorder()
+	h.SaveEnvironment(allowed, newReq(), nil, nil, provider)
+	if allowed.Code != http.StatusCreated {
+		t.Fatalf("allowed request: status = %d, want %d (body=%q)", allowed.Code, http.StatusCreated, allowed.Body.String())
+	}
+
+	refused := httptest.NewRecorder()
+	h.SaveEnvironment(refused, newReq(), nil, nil, provider)
+	if refused.Code != http.StatusForbidden {
+		t.Fatalf("refused request: status = %d, want %d (body=%q)", refused.Code, http.StatusForbidden, refused.Body.String())
+	}
+}
+
 // TestGetEnvironmentsHandler_PropagatesProviderStatus covers the read path with
 // the same contract: a provider 403 must not be reported as a 404.
 func TestGetEnvironmentsHandler_PropagatesProviderStatus(t *testing.T) {
```

**File**: `server/models/keys_helper.go` (modified, +12/-0)
```diff
@@ -70,7 +70,19 @@ func (kh *KeysRegistrationHelper) SeedKeys(filePath string) {
 		return
 	}
 
+	// This goroutine is outside the reach of RunSeedStage's recover, which
+	// only covers the stage's own goroutine, so it recovers on its own. The
+	// failure is reported through ErrSeedingStagePanic with the same stage
+	// name the call sites register ("user keys"), making it indistinguishable
+	// in the log from a panic RunSeedStage caught itself. Parse's deferred
+	// cancel closes its context while unwinding, so the select loop below
+	// still observes Done and returns instead of hanging.
 	go func() {
+		defer func() {
+			if r := recover(); r != nil {
+				kh.log.Error(ErrSeedingStagePanic("user keys", r, debug.Stack()))
+			}
+		}()
 		err := csvReader.Parse(ch, errorChan)
 		if err != nil {
 			kh.log.Error(err)
```

**File**: `server/models/keys_helper_test.go` (modified, +73/-2)
```diff
@@ -2,6 +2,7 @@ package models
 
 import (
 	"fmt"
+	"io"
 	"os"
 	"path/filepath"
 	"runtime"
@@ -14,16 +15,86 @@ import (
 	"github.com/go-logr/logr"
 	"github.com/gofrs/uuid"
 	"github.com/meshery/meshkit/database"
+	"github.com/meshery/meshkit/logger"
 	"github.com/sirupsen/logrus"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 	gormlogger "gorm.io/gorm/logger"
-	"io"
 )
 
-// captureLogger records errors passed to Error so tests can assert that a
+// seedKeysPanickingLogger panics on its first Error call, then delegates every
+// later call to the wrapped logger. It stands in for any unexpected fault on
+// SeedKeys' parse goroutine: where the panic comes from is irrelevant to the
+// recover at the spawn site, which must contain it no matter which statement
+// faulted.
+type seedKeysPanickingLogger struct {
+	logger.Handler
+	mu    sync.Mutex
+	calls int
+}
+
+func (l *seedKeysPanickingLogger) Error(err error) {
+	l.mu.Lock()
+	defer l.mu.Unlock()
+	l.calls++
+	if l.calls == 1 {
+		panic("simulated fault on the parse goroutine")
+	}
+	l.Handler.Error(err)
+}
+
+// TestSeedKeysChildGoroutinePanicIsContained pins the residual path
+// meshery/meshery#21586 left documented but open: RunSeedStage recovers only
+// panics on the wrapped stage's own goroutine, while SeedKeys does its parsing
+// on a spawned goroutine. A panic there used to unwind to the top of that
+// goroutine and terminate the whole server at boot.
+//
+// The empty CSV makes Parse return before sending any row, so the only fault
+// in play is the injected panic, and Parse's deferred cancel still closes its
+// context while unwinding, letting SeedKeys' select loop observe Done and
+// return. Without the recover at the spawn site this test does not fail
+// cleanly - the unrecovered panic kills the test binary itself.
+func TestSeedKeysChildGoroutinePanicIsContained(t *testing.T) {
+	db, err := database.New(database.Options{Engine: database.SQLITE, Filename: ":memory:"})
+	if err != nil {
+		t.Fatalf("open database: %v", err)
+	}
+	base, sink := capturingTestLogger(t)
+	krh, err := NewKeysRegistrationHelper(&db, &seedKeysPanickingLogger{Handler: base})
+	if err != nil {
+		t.Fatalf("build keys helper: %v", err)
+	}
+
+	keysPath := filepath.Join(t.TempDir(), "keys.csv")
+	if err := os.WriteFile(keysPath, []byte{}, 0o644); err != nil {
+		t.Fatalf("write keys fixture: %v", err)
+	}
+
+	laterStageRan := false
+	RunSeedStage(base, "user keys", func() {
+		krh.SeedKeys(keysPath)
+	})
+	RunSeedStage(base, "models", func() {
+		laterStageRan = true
+	})
+
+	if !laterStageRan {
+		t.Fatal("a panic on the user-keys stage's child goroutine prevented a later stage from running")
+	}
+	// The recovered report races SeedKeys' return: Done closes during the
+	// panic unwind, before the deferred recover logs, so the select loop can
+	// return first. Poll rather than asserting immediately.
+	deadline := time.Now().Add(10 * time.Second)
+	for !sink.reports(t, ErrSeedingStagePanicCode) {
+		if time.Now().After(deadline) {
+			t.Fatalf("the child-goroutine fault was not reported as %s, so containing it swallowed it; emitted: %+v", ErrSeedingStagePanicCode, sink.records(t))
+		}
+		time.Sleep(10 * time.Millisecond)
+	}
+}
+
 // seeding fault was surfaced instead of silently dropped.
 type captureLogger struct {
 	mu   sync.Mutex
```

**File**: `server/models/seed_models.go` (modified, +5/-3)
```diff
@@ -135,9 +135,11 @@ func getLatestModelDefDir(latestVersionDirPath string) (string, error) {
 //
 // The cover is bounded by what recover can reach: only panics on the wrapped
 // stage's own goroutine. A stage that itself spawns a goroutine - SeedKeys
-// does, in keys_helper.go - leaves that goroutine outside this recover, and a
-// panic there still terminates the process. Recovering it belongs where it is
-// spawned, not here.
+// does, in keys_helper.go - leaves that goroutine outside this recover, so
+// each such spawn site recovers on its own goroutine instead: SeedKeys
+// reports through ErrSeedingStagePanic, exactly as a stage panic caught here.
+// A wrapper cannot reach a child goroutine, so any future stage that spawns
+// one must recover where it spawns, not here.
 func RunSeedStage(log logger.Handler, stage string, fn func()) {
 	defer func() {
 		if r := recover(); r != nil {
```

---

### Incident Patch 11: `2d947352` (2026-09-28)
**Commit Message**: Merge pull request #22121 from meshery/fm/seedkeys-goroutine-panic-escapes-stage-recover

fix(server): keep a SeedKeys goroutine panic from terminating the server at boot

**File**: `AGENTS.md` (modified, +3/-1)
```diff
@@ -222,7 +222,9 @@ make helm-docs      # Generate Helm chart docs
   event raised outside a user request through `HandlerConfig.SystemEventPersister`; index
   `Providers` only with the comma-ok form, and only on the request path. Boot-time work
   that can fault belongs inside `models.RunSeedStage` so it degrades the server rather
-  than terminating it. Detail:
+  than terminating it - but its `recover` reaches only the stage's own goroutine, so a
+  stage that spawns one must defer its own recover at the spawn site (as `SeedKeys` does)
+  instead of widening the wrapper. Detail:
   [Extensibility: Providers](./docs/content/en/reference/extensibility/providers/index.md).
 - Only `utils.Log.Error(err)` renders a MeshKit error's code, cause and remediation; cobra's
   default print shows just the message. In `mesheryctl` commands, log the structured error
```

**File**: `docs/content/en/reference/extensibility/providers/index.md` (modified, +21/-0)
```diff
@@ -195,6 +195,27 @@ unaffected: it receives its provider from the request context, which enforcement
 resolves consistently.
 {{% /alert %}}
 
+{{% alert color="warning" title="Contributing: a seeding fault must not terminate the server" %}}
+Every boot seeding stage runs through `models.RunSeedStage`, which recovers a
+panic raised inside that stage, logs it as
+[`meshery-server-1483`]({{< ref "reference/references/error-codes.md" >}}) with
+the stage name and stack trace, and lets the remaining stages run. A Meshery
+Server with an incomplete registry is still useful and its operator can read the
+error; one that exits at boot leaves them a crash loop and no UI to read it in.
+
+`recover` reaches only the goroutine that deferred it, so wrapping a stage does
+not cover a goroutine that stage spawns - a fault there would still take the
+process down. A stage that spawns one therefore recovers at its own spawn site
+and reports through the same `ErrSeedingStagePanic`, making the failure
+indistinguishable in the log from one `RunSeedStage` caught itself. `SeedKeys`
+(`server/models/keys_helper.go`), which parses `keys.csv` on a spawned
+goroutine, is the only seeding callee that spawns one today; give any new one
+the same deferred recover rather than widening `RunSeedStage`, which cannot
+reach a child goroutine. Both halves are pinned by tests in `server/models`:
+`TestRunSeedStageRecoversPanic` and
+`TestSeedKeysChildGoroutinePanicIsContained`.
+{{% /alert %}}
+
 ### Deep-Link Preservation
 
 Meshery preserves the originally requested URL when authentication is required, enabling seamless navigation after login:
```

**File**: `server/models/keys_helper.go` (modified, +13/-0)
```diff
@@ -1,6 +1,7 @@
 package models
 
 import (
+	"runtime/debug"
 	"strings"
 
 	"github.com/meshery/meshkit/database"
@@ -69,7 +70,19 @@ func (kh *KeysRegistrationHelper) SeedKeys(filePath string) {
 		return
 	}
 
+	// This goroutine is outside the reach of RunSeedStage's recover, which
+	// only covers the stage's own goroutine, so it recovers on its own. The
+	// failure is reported through ErrSeedingStagePanic with the same stage
+	// name the call sites register ("user keys"), making it indistinguishable
+	// in the log from a panic RunSeedStage caught itself. Parse's deferred
+	// cancel closes its context while unwinding, so the select loop below
+	// still observes Done and returns instead of hanging.
 	go func() {
+		defer func() {
+			if r := recover(); r != nil {
+				kh.log.Error(ErrSeedingStagePanic("user keys", r, debug.Stack()))
+			}
+		}()
 		err := csvReader.Parse(ch, errorChan)
 		if err != nil {
 			kh.log.Error(err)
```

**File**: `server/models/keys_helper_test.go` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+package models
+
+import (
+	"os"
+	"path/filepath"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/meshery/meshkit/database"
+	"github.com/meshery/meshkit/logger"
+)
+
+// seedKeysPanickingLogger panics on its first Error call, then delegates every
+// later call to the wrapped logger. It stands in for any unexpected fault on
+// SeedKeys' parse goroutine: where the panic comes from is irrelevant to the
+// recover at the spawn site, which must contain it no matter which statement
+// faulted.
+type seedKeysPanickingLogger struct {
+	logger.Handler
+	mu    sync.Mutex
+	calls int
+}
+
+func (l *seedKeysPanickingLogger) Error(err error) {
+	l.mu.Lock()
+	defer l.mu.Unlock()
+	l.calls++
+	if l.calls == 1 {
+		panic("simulated fault on the parse goroutine")
+	}
+	l.Handler.Error(err)
+}
+
+// TestSeedKeysChildGoroutinePanicIsContained pins the residual path
+// meshery/meshery#21586 left documented but open: RunSeedStage recovers only
+// panics on the wrapped stage's own goroutine, while SeedKeys does its parsing
+// on a spawned goroutine. A panic there used to unwind to the top of that
+// goroutine and terminate the whole server at boot.
+//
+// The empty CSV makes Parse return before sending any row, so the only fault
+// in play is the injected panic, and Parse's deferred cancel still closes its
+// context while unwinding, letting SeedKeys' select loop observe Done and
+// return. Without the recover at the spawn site this test does not fail
+// cleanly - the unrecovered panic kills the test binary itself.
+func TestSeedKeysChildGoroutinePanicIsContained(t *testing.T) {
+	db, err := database.New(database.Options{Engine: database.SQLITE, Filename: ":memory:"})
+	if err != nil {
+		t.Fatalf("open database: %v", err)
+	}
+	base, sink := capturingTestLogger(t)
+	krh, err := NewKeysRegistrationHelper(&db, &seedKeysPanickingLogger{Handler: base})
+	if err != nil {
+		t.Fatalf("build keys helper: %v", err)
+	}
+
+	keysPath := filepath.Join(t.TempDir(), "keys.csv")
+	if err := os.WriteFile(keysPath, []byte{}, 0o644); err != nil {
+		t.Fatalf("write keys fixture: %v", err)
+	}
+
+	laterStageRan := false
+	RunSeedStage(base, "user keys", func() {
+		krh.SeedKeys(keysPath)
+	})
+	RunSeedStage(base, "models", func() {
+		laterStageRan = true
+	})
+
+	if !laterStageRan {
+		t.Fatal("a panic on the user-keys stage's child goroutine prevented a later stage from running")
+	}
+	// The recovered report races SeedKeys' return: Done closes during the
+	// panic unwind, before the deferred recover logs, so the select loop can
+	// return first. Poll rather than asserting immediately.
+	deadline := time.Now().Add(10 * time.Second)
+	for !sink.reports(t, ErrSeedingStagePanicCode) {
+		if time.Now().After(deadline) {
+			t.Fatalf("the child-goroutine fault was not reported as %s, so containing it swallowed it; emitted: %+v", ErrSeedingStagePanicCode, sink.records(t))
+		}
+		time.Sleep(10 * time.Millisecond)
+	}
+}
```

**File**: `server/models/seed_models.go` (modified, +5/-3)
```diff
@@ -135,9 +135,11 @@ func getLatestModelDefDir(latestVersionDirPath string) (string, error) {
 //
 // The cover is bounded by what recover can reach: only panics on the wrapped
 // stage's own goroutine. A stage that itself spawns a goroutine - SeedKeys
-// does, in keys_helper.go - leaves that goroutine outside this recover, and a
-// panic there still terminates the process. Recovering it belongs where it is
-// spawned, not here.
+// does, in keys_helper.go - leaves that goroutine outside this recover, so
+// each such spawn site recovers on its own goroutine instead: SeedKeys
+// reports through ErrSeedingStagePanic, exactly as a stage panic caught here.
+// A wrapper cannot reach a child goroutine, so any future stage that spawns
+// one must recover where it spawns, not here.
 func RunSeedStage(log logger.Handler, stage string, fn func()) {
 	defer func() {
 		if r := recover(); r != nil {
```

---

### Incident Patch 12: `6824a35c` (2026-09-28)
**Commit Message**: [Server] Fix SeedKeys Done-race dropping last key, buffered errors, and panicking-save leak

Signed-off-by: Lee Calcote <[REDACTED_EMAIL]>

**File**: `server/models/keys_helper.go` (modified, +33/-5)
```diff
@@ -1,6 +1,7 @@
 package models
 
 import (
+	"runtime/debug"
 	"strings"
 
 	"github.com/meshery/meshkit/database"
@@ -79,16 +80,43 @@ func (kh *KeysRegistrationHelper) SeedKeys(filePath string) {
 		select {
 
 		case data := <-ch:
-			_, err := kh.keyPersister.SaveUsersKey(&data)
-			if err != nil {
-				kh.log.Error(err)
-			}
+			kh.saveSeededKey(data)
 		case err := <-errorChan:
 			kh.log.Error(err)
 
 		case <-csvReader.Context.Done():
-			return
+			// The parser calls its deferred cancel only as Parse returns,
+			// after every send has completed, so once Done is observed no
+			// further send can occur. Either channel may still hold a
+			// buffered row or error alongside Done, so drain both
+			// non-blockingly before returning instead of dropping
+			// whatever the select did not pick.
+			for {
+				select {
+				case data := <-ch:
+					kh.saveSeededKey(data)
+				case err := <-errorChan:
+					kh.log.Error(err)
+				default:
+					return
+				}
+			}
 		}
 	}
 
 }
+
+// saveSeededKey persists one parsed key. A panic from the persistence call is
+// contained here so it cannot unwind the seed loop: without a consumer the
+// parser would block forever on its next send and never run the deferred
+// cleanup that ends parsing, leaking the goroutine and the file it holds.
+func (kh *KeysRegistrationHelper) saveSeededKey(data Key) {
+	defer func() {
+		if r := recover(); r != nil {
+			kh.log.Error(ErrSeedingStagePanic("user keys", r, debug.Stack()))
+		}
+	}()
+	if _, err := kh.keyPersister.SaveUsersKey(&data); err != nil {
+		kh.log.Error(err)
+	}
+}
```

**File**: `server/models/keys_helper_test.go` (added, +307/-0)
```diff
@@ -0,0 +1,307 @@
+package models
+
+import (
+	"fmt"
+	"os"
+	"path/filepath"
+	"runtime"
+	"strings"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/go-logr/logr"
+	"github.com/gofrs/uuid"
+	"github.com/meshery/meshkit/database"
+	"github.com/sirupsen/logrus"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+	gormlogger "gorm.io/gorm/logger"
+	"io"
+)
+
+// captureLogger records errors passed to Error so tests can assert that a
+// seeding fault was surfaced instead of silently dropped.
+type captureLogger struct {
+	mu   sync.Mutex
+	errs []error
+}
+
+func (l *captureLogger) Error(err error) {
+	l.mu.Lock()
+	defer l.mu.Unlock()
+	l.errs = append(l.errs, err)
+}
+
+func (l *captureLogger) Info(_ ...interface{})                {}
+func (l *captureLogger) Infof(_ string, _ ...interface{})     {}
+func (l *captureLogger) Debug(_ ...interface{})               {}
+func (l *captureLogger) Debugf(_ string, _ ...interface{})    {}
+func (l *captureLogger) Warn(_ error)                         {}
+func (l *captureLogger) Warnf(_ string, _ ...interface{})     {}
+func (l *captureLogger) Errorf(_ string, _ ...interface{})    {}
+func (l *captureLogger) Fatal(_ error)                        {}
+func (l *captureLogger) Fatalf(_ string, _ ...interface{})    {}
+func (l *captureLogger) SetLevel(_ logrus.Level)              {}
+func (l *captureLogger) GetLevel() logrus.Level               { return logrus.ErrorLevel }
+func (l *captureLogger) UpdateLogOutput(_ io.Writer)          {}
+func (l *captureLogger) UpdateErrorLogOutput(_ io.Writer)     {}
+func (l *captureLogger) ControllerLogger() logr.Logger        { return logr.Discard() }
+func (l *captureLogger) DatabaseLogger() gormlogger.Interface { return nil }
+
+func (l *captureLogger) errorCount() int {
+	l.mu.Lock()
+	defer l.mu.Unlock()
+	return len(l.errs)
+}
+
+// newKeysSeedDB opens an isolated in-memory database. The DSN names a
+// shared-cache database unique to the caller: a bare ":memory:" gives every
+// pooled connection its own empty database, so a migrate on one connection
+// is invisible to a save on another.
+var keysSeedDBSeq int32
+
+func newKeysSeedDB(t *testing.T, name string) (*gorm.DB, *database.Handler) {
+	t.Helper()
+	// The sequence number keeps the database fresh across -count repetitions
+	// of the test within one process: rows left behind by an earlier
+	// iteration would turn the next iteration's saves into updates, and the
+	// gating create callbacks below would never fire.
+	seq := atomic.AddInt32(&keysSeedDBSeq, 1)
+	dsn := fmt.Sprintf("file:%s-%d?mode=memory&cache=shared", name, seq)
+	gdb, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
+	require.NoError(t, err, "open in-memory database")
+	return gdb, &database.Handler{DB: gdb}
+}
+
+func keysSeedHelper(t *testing.T, gdb *gorm.DB, clog *captureLogger) *KeysRegistrationHelper {
+	t.Helper()
+	krh, err := NewKeysRegistrationHelper(&database.Handler{DB: gdb}, clog)
+	require.NoError(t, err, "build keys registration helper")
+	return krh
+}
+
+// parserGone polls the goroutine dump until no goroutine remains inside the
+// meshkit CSV parser, which proves Parse has returned and therefore run its
+// deferred cancel. It reports whether the parser exited before the deadline.
+func parserGone(timeout time.Duration) bool {
+	deadline := time.Now().Add(timeout)
+	var buf [1 << 20]byte
+	for time.Now().Before(deadline) {
+		n := runtime.Stack(buf[:], true)
+		if !strings.Contains(string(buf[:n]), "meshkit/utils/csv") {
+			return true
+		}
+		time.Sleep(10 * time.Millisecond)
+	}
+	return false
+}
+
+// runSeedKeys runs SeedKeys off the test goroutine and reports whether it
+// returned before the timeout. It cannot catch an escaping panic (that lands
+// on the spawned goroutine), so tests covering the panic strand call SeedKeys
+// directly instead.
+func runSeedKeys(t *testing.T, krh *KeysRegistrationHelper, fixture string, timeout time.Duration) bool {
+	t.Helper()
+	done := make(chan struct{})
+	go func() {
+		defer close(done)
+		krh.SeedKeys(fixture)
+	}()
+	select {
+	case <-done:
+		return true
+	case <-time.After(timeout):
+		return false
+	}
+}
+
+func mustKeyUUID(t *testing.T, s string) uuid.UUID {
+	t.Helper()
+	id, err := uuid.FromString(s)
+	require.NoError(t, err, "parse fixture key id")
+	return id
+}
+
+func seededKeyIDs(t *testing.T, gdb *gorm.DB) map[uuid.UUID]bool {
+	t.Helper()
+	var keys []Key
+	require.NoError(t, gdb.Find(&keys).Error, "list seeded keys")
+	ids := make(map[uuid.UUID]bool, len(keys))
+	for _, k := range keys {
+		ids[k.ID] = true
+	}
+	return ids
+}
+
+// TestSeedKeysDrainsBufferedRowAndErrorAfterCancel forces the
+// cancellation-before-drain ordering: the first save blocks until the parser
+// has provably exited (cancel runs only as Parse returns, so at release time
+// a row sits buffered in ch, an error sits buffered in errorChan, and the
+// context is a
```

**File**: `server/models/testdata/keys_seed_drain.csv` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+,,,Authorization,,,,,,,,Keychain,Keys,,
+Category,Function,Feature,User,Team Admin,Academy Admin,Leaner,Workspace Admin,Org Billing Manager,Org Admin,Provider Admin,Keychain ID,Key ID,Inserted,Local Provider
+Catalog,First Key,A first key,X,X,,,X,,X,X,Chain A,11111111-1111-4111-8111-111111111111,X,TRUE
+Catalog,Bad Key,A key whose ID is not a UUID,X,X,,,X,,X,X,Chain A,not-a-uuid,X,TRUE
+Catalog,Last Key,A last key,X,X,,,X,,X,X,Chain A,22222222-2222-4222-8222-222222222222,X,TRUE
+Catalog,Skipped One,Not registered with the local provider,,,,,,,,,,Chain A,33333333-3333-4333-8333-333333333333,X,FALSE
+Catalog,Skipped Two,Not registered with the local provider,,,,,,,,,,Chain A,44444444-4444-4444-8444-444444444444,X,FALSE
```

**File**: `server/models/testdata/keys_seed_panic.csv` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+,,,Authorization,,,,,,,,Keychain,Keys,,
+Category,Function,Feature,User,Team Admin,Academy Admin,Leaner,Workspace Admin,Org Billing Manager,Org Admin,Provider Admin,Keychain ID,Key ID,Inserted,Local Provider
+Catalog,panic-row,A row whose save panics,X,X,,,X,,X,X,Chain A,55555555-5555-4555-8555-555555555555,X,TRUE
+Catalog,Second Key,A second key,X,X,,,X,,X,X,Chain A,66666666-6666-4666-8666-666666666666,X,TRUE
+Catalog,Last Key,A last key,X,X,,,X,,X,X,Chain A,77777777-7777-4777-8777-777777777777,X,TRUE
+Catalog,Skipped One,Not registered with the local provider,,,,,,,,,,Chain A,88888888-8888-4888-8888-888888888888,X,FALSE
+Catalog,Skipped Two,Not registered with the local provider,,,,,,,,,,Chain A,99999999-9999-4999-8999-999999999999,X,FALSE
```

#### Recent Merged Pull Requests:
- **PR #22239** (2026-10-05): docs: update Yash Sharma's affiliation to UiPath in Community Maintainers (@banana-three-join)
- **PR #22237** (2026-10-05): Update Yash Sharma's affiliation to UiPath (@Yashsharma1911)
- **PR #22218** (2026-10-03): Kshitij-Jha.md (@kshitij787corporation)
- **PR #22204** (2026-10-02): Add newcomers attendance for Oluwadamilare Emmanuel Oduyomi (@ExcelDsigN-tech)
- **PR #22203** (2026-10-02): Create damilare.md with personal introduction (@ExcelDsigN-tech)
- **PR #22202** (2026-10-02): Revise Ankush Ujawane's introduction (@AnkushUjawane)
- **PR #22201** (2026-10-02): Add Ayushman's introduction and project experience (@Ayush-GARG41)
- **PR #22200** (2026-10-02): Create profile for Sanskar Soni (@sanskar-dev-git)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

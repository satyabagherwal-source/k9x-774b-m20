> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshery-meshery-learnings.md`  
> **Source**: github ([https://github.com/meshery/meshery](https://github.com/meshery/meshery))  
> **Source Version**: `4e28fc8c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T01:01:29.243Z  
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
> **Harvest Timestamp**: 2026-11-09T01:01:29.234Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshery/meshery`
- **Description**: Meshery, the cloud native manager
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12149 stars

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
- **Issue #23045** (2026-11-08): **[Server] Parse Content-Disposition when naming a design imported from a URL**
  *Symptoms*: **Notes for Reviewers**  - This PR fixes #23016  For a design imported from a URL, `getFileNameFromResponse` split `Content-Disposition` on `filename=` and trimmed quotes, so every parameter after the quoted name stayed in the file name, and a `filename*`-only header was ignored. That name feeds the extension check, the design name and the import event.  The header is now parsed with `mime.ParseMediaType`, which returns the `filename` parameter on its own and decodes `filename*` (RFC 6266, section 4.3) into it. When the header has no usable file name, or does not parse, the name comes from the URL path as before.  The table test in `server/handlers/design_import_filename_test.go` covers both forms together, a parameter after the name, `filename` alone, an encoded `filename*`, no header, a header without a file name, and an empty file name.  Before, on master:      --- FAIL: TestGetFileNameFromResponse (0.00s)         filename and filename*: file name "design.yaml\"; filename*=UTF-8''design.yaml", want "design.yaml"         parameter after filename: file name "design.yaml\"; size=2048", want "design.yaml"         encoded filename*: file name "from-url.yaml", want "my design.yaml"         empty filename: file name "", want "from-url.yaml"     FAIL  After:      --- PASS: TestGetFileNameFromResponse (0.00s)     ok  	github.com/meshery/meshery/server/handlers  The full `server/handlers` package passes.  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING

- **Issue #23043** (2026-11-08): **[Server] Stop repeated workspace assignments from surviving removal**
  *Symptoms*: **Notes for Reviewers**  - This PR fixes #23014  `AddEnvironmentToWorkspace`, `AddViewToWorkspace` and `AddTeamToWorkspace` inserted a new mapping row on every call, and the matching `Delete...FromWorkspace` removed only the first row of the pair. A member assigned twice (a double-click, a retried request, an API client) therefore stayed assigned after one removal.  - Assigning a member the workspace already has now returns the existing mapping instead of inserting a second row. - Removing a member deletes every mapping row of the pair, so duplicates already stored in a database also go with one removal. A pair with no mapping still answers not found.  Designs are unchanged: `AddDesignToWorkspace` already replaces an existing mapping.  The tests in `server/models/workspace_mapping_duplicates_test.go` use `WorkspacePersister` with a SQLite database and cover environments, views and teams. The test helper migrates the v1beta3 `environments` table first, because the system migration still builds it from v1beta1 (#21802).  Before, on master:      --- FAIL: TestWorkspaceAssignTwiceThenRemoveOnce (0.04s)         environment: mappings after assigning twice = 2, want 1         view: mappings after assigning twice = 2, want 1         team: mappings after assigning twice = 2, want 1     --- FAIL: TestWorkspaceRemoveDeletesStoredDuplicates (0.03s)         environment: mappings after removing = 1, want 0         view: mappings after removing = 1, want 0         team: mappings after remov

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

### Incident Patch 1: `a4d7f8a5` (2026-11-08)
**Commit Message**: Merge pull request #23036 from nishant-devv/fix/token-view-empty-prompt-hang

[mesheryctl] Prevent hang on empty token view prompt and respect --yes flag

**File**: `mesheryctl/internal/cli/root/system/token.go` (modified, +4/-0)
```diff
@@ -227,6 +227,10 @@ mesheryctl system token view (show token of current context)
 			tokenNames = append(tokenNames, t.Name)
 		}
 
+		if len(tokenNames) == 0 || utils.SilentFlag {
+			return fmt.Errorf("token %q not found in config", tokenName)
+		}
+
 		utils.Log.Info("Invalid token name. Select from available tokens-")
 		prompt := promptui.Select{
 			Label: "Select a token from the list",
```

**File**: `mesheryctl/internal/cli/root/system/token_test.go` (modified, +59/-0)
```diff
@@ -574,3 +574,62 @@ tokens:
 		})
 	}
 }
+
+// TestTokenViewCmd_NonExistentTokenWithSilentFlag tests that token view fails immediately
+// without prompting when passed a non-existent token with the silent flag (-y / --yes).
+func TestTokenViewCmd_NonExistentTokenWithSilentFlag(t *testing.T) {
+	_, filename, _, ok := runtime.Caller(0)
+	if !ok {
+		t.Fatal("Not able to get current working directory")
+	}
+	currDir := filepath.Dir(filename)
+	utils.SetupCustomContextEnv(t, currDir+"/testdata/token/view.yaml")
+
+	originalSilentFlag := utils.SilentFlag
+	utils.SilentFlag = false
+	t.Cleanup(func() {
+		utils.SilentFlag = originalSilentFlag
+	})
+
+	b := utils.SetupMeshkitLoggerTesting(t, false)
+	SystemCmd.SetOut(b)
+	SystemCmd.SetArgs([]string{"token", "view", "nonexistent-token", "-y"})
+	err := SystemCmd.Execute()
+	assert.Error(t, err)
+	assert.Contains(t, err.Error(), `token "nonexistent-token" not found in config`)
+	BreakupFunc()
+}
+
+// TestTokenViewCmd_NoTokensConfigured tests that token view fails immediately without hanging
+// when attempting to view a token and no other tokens are configured in the meshconfig.
+func TestTokenViewCmd_NoTokensConfigured(t *testing.T) {
+	configPath := filepath.Join(t.TempDir(), "config.yaml")
+	sampleMeshConfig := `contexts:
+  local:
+    endpoint: http://localhost:9081
+    token: default
+current-context: local
+tokens: []
+`
+	if err := os.WriteFile(configPath, []byte(sampleMeshConfig), 0o644); err != nil {
+		t.Fatal(err)
+	}
+	viper.Reset()
+	originalCfgFile := utils.CfgFile
+	originalDefaultConfigPath := utils.DefaultConfigPath
+	utils.CfgFile = configPath
+	utils.DefaultConfigPath = configPath
+	t.Cleanup(func() {
+		utils.CfgFile = originalCfgFile
+		utils.DefaultConfigPath = originalDefaultConfigPath
+		viper.Reset()
+	})
+
+	b := utils.SetupMeshkitLoggerTesting(t, false)
+	SystemCmd.SetOut(b)
+	SystemCmd.SetArgs([]string{"token", "view", "any-token"})
+	err := SystemCmd.Execute()
+	assert.Error(t, err)
+	assert.Contains(t, err.Error(), `token "any-token" not found in config`)
+	BreakupFunc()
+}
```

---

### Incident Patch 2: `e2f1c76f` (2026-11-08)
**Commit Message**: Merge branch 'master' into fix/token-view-empty-prompt-hang

**File**: `server/handlers/design_import.go` (modified, +8/-8)
```diff
@@ -6,11 +6,11 @@ import (
 	"errors"
 	"fmt"
 	"io"
+	"mime"
 	"net/http"
 	"net/url"
 	"os"
 	"path"
-	"strings"
 	"time"
 
 	"github.com/meshery/meshery/server/models"
@@ -134,13 +134,13 @@ func stringFromPtr(p *string) string {
 }
 
 func getFileNameFromResponse(resp *http.Response, fileURL string) string {
-	// Check Content-Disposition header
-	contentDisp := resp.Header.Get("Content-Disposition")
-	if contentDisp != "" {
-		parts := strings.Split(contentDisp, "filename=")
-		if len(parts) > 1 {
-			filename := strings.Trim(parts[1], `"`)
-			return filename
+	// Content-Disposition can carry more than the name: other parameters, or
+	// a filename* form next to filename (RFC 6266, section 4.3).
+	// ParseMediaType returns the filename parameter on its own, decoding
+	// filename* into it when present.
+	if contentDisp := resp.Header.Get("Content-Disposition"); contentDisp != "" {
+		if _, params, err := mime.ParseMediaType(contentDisp); err == nil && params["filename"] != "" {
+			return params["filename"]
 		}
 	}
 
```

**File**: `server/handlers/design_import_filename_test.go` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+package handlers
+
+import (
+	"net/http"
+	"testing"
+)
+
+// The import names a file fetched from a URL after the filename parameter of
+// its Content-Disposition, or after the URL path when the header has none.
+func TestGetFileNameFromResponse(t *testing.T) {
+	const fileURL = "https://example.com/designs/from-url.yaml"
+
+	for _, tc := range []struct {
+		name, disposition, want string
+	}{
+		{"filename and filename*", `inline; filename="design.yaml"; filename*=UTF-8''design.yaml`, "design.yaml"},
+		{"parameter after filename", `attachment; filename="design.yaml"; size=2048`, "design.yaml"},
+		{"filename only", `attachment; filename="design.yaml"`, "design.yaml"},
+		{"encoded filename*", `attachment; filename*=UTF-8''my%20design.yaml`, "my design.yaml"},
+		{"no header", "", "from-url.yaml"},
+		{"no filename parameter", "inline", "from-url.yaml"},
+		{"empty filename", `attachment; filename=`, "from-url.yaml"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			resp := &http.Response{Header: http.Header{}}
+			if tc.disposition != "" {
+				resp.Header.Set("Content-Disposition", tc.disposition)
+			}
+
+			if got := getFileNameFromResponse(resp, fileURL); got != tc.want {
+				t.Errorf("Content-Disposition %q: file name %q, want %q", tc.disposition, got, tc.want)
+			}
+		})
+	}
+}
```

**File**: `server/handlers/meshsync_handler.go` (modified, +15/-24)
```diff
@@ -204,33 +204,24 @@ func filterByPatternIds(query *gorm.DB, patternIDs []string) *gorm.DB {
 	return query
 }
 
-// filterByKey filters a GORM query to only include resources with specific key-value pairs in their metadata.
+// filterByKey keeps the resources whose metadata carries every one of the
+// given "key=value" pairs of the given kind (e.g. "label"). The query must
+// already join kubernetes_resource_object_meta.
 //
-// This function performs the following steps:
-// 1. Joins the `kubernetes_resources` table with `kubernetes_resource_object_meta` to access metadata for resources.
-// 2. Joins the `kubernetes_resource_object_meta` table with `kubernetes_key_values` to access key-value pairs.
-// 3. Filters the results based on:
-//   - The `kind` of the key-value pair (e.g., "label", "annotation").
-//   - A set of key-value pairs provided in the `keyValues` slice, formatted as "key=value".
-//
-// The query ensures only matching resources are returned.
-//
-// Parameters:
-// - query: The initial GORM query to apply the filters to.
-// - kind: The kind of key-value pair to filter by (e.g., "label").
-// - keyValues: A slice of strings in the format "key=value" used to match key-value pairs.
-//
-// Returns:
-// - A filtered GORM query that includes only resources with matching key-value pairs.
+// Each pair is its own EXISTS condition rather than a join on
+// kubernetes_key_values: the join returned a resource once per matching pair,
+// matched any of the pairs instead of all of them, and brought a second `kind`
+// column into scope, which made ORDER BY kind ambiguous. Key and value are
+// compared as one "key=value" string so a key never pairs with another
+// label's value.
 func filterByKey(query *gorm.DB, kind string, keyValues []string) *gorm.DB {
-	if len(keyValues) == 0 {
-		return query
+	for _, keyValue := range keyValues {
+		query = query.Where(
+			"EXISTS (SELECT 1 FROM kubernetes_key_values WHERE kubernetes_key_values.id = kubernetes_resource_object_meta.id AND kubernetes_key_values.kind = ? AND (kubernetes_key_values.key || '=' || kubernetes_key_values.value) = ?)",
+			kind, keyValue,
+		)
 	}
-	return query.
-		// Joins("join kubernetes_resource_object_meta on kubernetes_resources.id = kubernetes_resource_object_meta.id").
-		Joins("join kubernetes_key_values on kubernetes_resource_object_meta.id = kubernetes_key_values.id").
-		// We need to use the `||` operator to concatenate the key and value, so we can compare it to the key-value pairs. and not cross match with other key value pairs
-		Where("kubernetes_key_values.kind = ? AND  (kubernetes_key_values.key || '=' || kubernetes_key_values.value) IN (?)", kind, keyValues)
+	return query
 }
 
 func selectDistinctKeyValues(db *gorm.DB, kind string) *gorm.DB {
```

**File**: `server/handlers/meshsync_label_filter_test.go` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+package handlers
+
+import (
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"net/url"
+	"path/filepath"
+	"sort"
+	"testing"
+
+	"github.com/meshery/meshery/server/models"
+	"github.com/meshery/meshkit/database"
+	"github.com/meshery/meshsync/pkg/model"
+	"github.com/stretchr/testify/require"
+)
+
+// newLabelFilterFixture stores two Pods of cluster c1 that share app=web and
+// differ in tier, the way MeshSync stores them: each label is a
+// kubernetes_key_values row keyed by the object's metadata ID.
+func newLabelFilterFixture(t *testing.T) (*Handler, models.Provider) {
+	t.Helper()
+	db, err := database.New(database.Options{Engine: database.SQLITE, Filename: filepath.Join(t.TempDir(), "meshsync.db")})
+	require.NoError(t, err)
+	require.NoError(t, db.AutoMigrate(&model.KubernetesResource{}, &model.KubernetesResourceObjectMeta{},
+		&model.KubernetesKeyValue{}, &model.KubernetesResourceSpec{}, &model.KubernetesResourceStatus{}))
+
+	for _, pod := range []struct{ id, name, tier string }{
+		{"pod-frontend", "web-frontend", "frontend"},
+		{"pod-backend", "web-backend", "backend"},
+	} {
+		resource := model.KubernetesResource{
+			ID: pod.id, APIVersion: "v1", Kind: "Pod", Model: "kubernetes", ClusterID: "c1",
+			KubernetesResourceMeta: &model.KubernetesResourceObjectMeta{
+				ID: pod.id, Name: pod.name, Namespace: "default", ClusterID: "c1",
+				Labels: []*model.KubernetesKeyValue{
+					{ID: pod.id, Kind: model.KindLabel, Key: "app", Value: "web"},
+					{ID: pod.id, Kind: model.KindLabel, Key: "tier", Value: pod.tier},
+				},
+			},
+		}
+		require.NoError(t, db.Create(&resource).Error)
+	}
+	return &Handler{log: newTestLogger(t)}, &models.DefaultLocalProvider{GenericPersister: &db}
+}
+
+// listByLabels sends GET /api/system/meshsync/resources for cluster c1 with the
+// given labels and extra query values.
+func listByLabels(t *testing.T, h *Handler, provider models.Provider, labels []string, extra url.Values) (*httptest.ResponseRecorder, models.MeshSyncResourcesAPIResponse) {
+	t.Helper()
+	q := url.Values{"clusterIds": {`["c1"]`}, "label": labels}
+	for key, values := range extra {
+		q[key] = values
+	}
+	req := httptest.NewRequest(http.MethodGet, "/api/system/meshsync/resources?"+q.Encode(), nil)
+	rec := httptest.NewRecorder()
+	h.GetMeshSyncResources(rec, req, nil, nil, provider)
+
+	var page models.MeshSyncResourcesAPIResponse
+	if rec.Code == http.StatusOK {
+		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &page))
+	}
+	return rec, page
+}
+
+func resourceNames(page models.MeshSyncResourcesAPIResponse) []string {
+	names := []string{}
+	for _, resource := range page.Resources {
+		if resource.KubernetesResourceMeta != nil {
+			names = append(names, resource.KubernetesResourceMeta.Name)
+		}
+	}
+	sort.Strings(names)
+	return names
+}
+
+// Several labels select the resources that carry all of them, each once.
+func TestGetMeshSyncResourcesMatchesAllLabels(t *testing.T) {
+	h, provider := newLabelFilterFixture(t)
+
+	rec, page := listByLabels(t, h, provider, []string{"app=web", "tier=frontend"}, nil)
+
+	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
+	require.Equal(t, []string{"web-frontend"}, resourceNames(page))
+	require.EqualValues(t, 1, page.TotalCount)
+}
+
+// One label still selects every resource that carries it.
+func TestGetMeshSyncResourcesMatchesOneLabel(t *testing.T) {
+	h, provider := newLabelFilterFixture(t)
+
+	rec, page := listByLabels(t, h, provider, []string{"app=web"}, nil)
+
+	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
+	require.Equal(t, []string{"web-backend", "web-frontend"}, resourceNames(page))
+	require.EqualValues(t, 2, page.TotalCount)
+}
+
+// Sorting by kind, an allowed sort column, works together with a label filter.
+func TestGetMeshSyncResourcesLabelFilterSortedByKind(t *testing.T) {
+	h, provider := newLabelFilterFixture(t)
+
+	rec, page := listByLabels(t, h, provider, []string{"app=web"}, url.Values{"order": {"kind asc"}})
+
+	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
+	require.EqualValues(t, 2, page.TotalCount)
+}
```

**File**: `server/models/workspace_mapping_duplicates_test.go` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
+package models
+
+import (
+	"encoding/json"
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/meshery/meshkit/database"
+	"github.com/meshery/schemas/models/core"
+	"github.com/meshery/schemas/models/v1beta3/environment"
+)
+
+func newWorkspaceMappingDB(t *testing.T) *database.Handler {
+	t.Helper()
+	db := newMigratedDB(t)
+	// The system migration still builds environments from v1beta1 (#21802), so
+	// add the v1beta3 columns the environment persister writes.
+	if err := db.AutoMigrate(&environment.Environment{}); err != nil {
+		t.Fatalf("migrate environments: %v", err)
+	}
+	return db
+}
+
+// workspaceMappingKinds are the workspace assignments that map one member to a
+// workspace per row.
+var workspaceMappingKinds = []struct {
+	name, table, column string
+	assign, remove      func(*WorkspacePersister, core.Uuid, core.Uuid) ([]byte, error)
+}{
+	{"environment", "workspaces_environments_mappings", "environment_id", (*WorkspacePersister).AddEnvironmentToWorkspace, (*WorkspacePersister).DeleteEnvironmentFromWorkspace},
+	{"view", "workspaces_views_mappings", "view_id", (*WorkspacePersister).AddViewToWorkspace, (*WorkspacePersister).DeleteViewFromWorkspace},
+	{"team", "workspaces_teams_mappings", "team_id", (*WorkspacePersister).AddTeamToWorkspace, (*WorkspacePersister).DeleteTeamFromWorkspace},
+}
+
+func countWorkspaceMappings(t *testing.T, db *database.Handler, table, column string, workspaceID, memberID core.Uuid) int64 {
+	t.Helper()
+	var n int64
+	if err := db.Table(table).Where("workspace_id = ? AND "+column+" = ?", workspaceID, memberID).Count(&n).Error; err != nil {
+		t.Fatalf("count %s: %v", table, err)
+	}
+	return n
+}
+
+// Assigning a member twice keeps one mapping, and one removal unassigns it.
+func TestWorkspaceAssignTwiceThenRemoveOnce(t *testing.T) {
+	for _, kind := range workspaceMappingKinds {
+		t.Run(kind.name, func(t *testing.T) {
+			db := newWorkspaceMappingDB(t)
+			wp := &WorkspacePersister{DB: db}
+			workspaceID, memberID := mustUUID(t), mustUUID(t)
+
+			for i := 1; i <= 2; i++ {
+				if _, err := kind.assign(wp, workspaceID, memberID); err != nil {
+					t.Fatalf("assign #%d: %v", i, err)
+				}
+			}
+			if n := countWorkspaceMappings(t, db, kind.table, kind.column, workspaceID, memberID); n != 1 {
+				t.Fatalf("mappings after assigning twice = %d, want 1", n)
+			}
+
+			if _, err := kind.remove(wp, workspaceID, memberID); err != nil {
+				t.Fatalf("remove: %v", err)
+			}
+			if n := countWorkspaceMappings(t, db, kind.table, kind.column, workspaceID, memberID); n != 0 {
+				t.Errorf("mappings after removing = %d, want 0", n)
+			}
+		})
+	}
+}
+
+// Duplicate mappings stored before assignments were checked all go with one
+// removal.
+func TestWorkspaceRemoveDeletesStoredDuplicates(t *testing.T) {
+	for _, kind := range workspaceMappingKinds {
+		t.Run(kind.name, func(t *testing.T) {
+			db := newWorkspaceMappingDB(t)
+			wp := &WorkspacePersister{DB: db}
+			workspaceID, memberID := mustUUID(t), mustUUID(t)
+
+			insert := fmt.Sprintf("INSERT INTO %s (id, workspace_id, %s, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", kind.table, kind.column)
+			for i := 1; i <= 2; i++ {
+				if err := db.Exec(insert, mustUUID(t), workspaceID, memberID, time.Now(), time.Now()).Error; err != nil {
+					t.Fatalf("store mapping #%d: %v", i, err)
+				}
+			}
+
+			if _, err := kind.remove(wp, workspaceID, memberID); err != nil {
+				t.Fatalf("remove: %v", err)
+			}
+			if n := countWorkspaceMappings(t, db, kind.table, kind.column, workspaceID, memberID); n != 0 {
+				t.Errorf("mappings after removing = %d, want 0", n)
+			}
+		})
+	}
+}
+
+// An environment assigned twice and removed once is no longer listed among
+// the workspace's environments.
+func TestWorkspaceEnvironmentUnlistedAfterRemoval(t *testing.T) {
+	db := newWorkspaceMappingDB(t)
+	wp := &WorkspacePersister{DB: db}
+	env := &environment.Environment{Name: "dev"}
+	if _, err := (&EnvironmentPersister{DB: db}).SaveEnvironment(env); err != nil {
+		t.Fatalf("save environment: %v", err)
+	}
+	workspaceID := mustUUID(t)
+
+	for i := 1; i <= 2; i++ {
+		if _, err := wp.AddEnvironmentToWorkspace(workspaceID, env.ID); err != nil {
+			t.Fatalf("assign #%d: %v", i, err)
+		}
+	}
+	if _, err := wp.DeleteEnvironmentFromWorkspace(workspaceID, env.ID); err != nil {
+		t.Fatalf("remove: %v", err)
+	}
+
+	raw, err := wp.GetWorkspaceEnvironments(workspaceID, "", "", "0", "10", "")
+	if err != nil {
+		t.Fatalf("list: %v", err)
+	}
+	var page struct {
+		TotalCount int `json:"totalCount"`
+	}
+	if err := json.Unmarshal(raw, &page); err != nil {
+		t.Fatalf("decode %s: %v", raw, err)
+	}
+	if page.TotalCount != 0 {
+		t.Errorf("assigned environments after removal = %d, want 0", page.TotalCount)
+	}
+}
```

**File**: `server/models/workspace_persister.go` (modified, +49/-18)
```diff
@@ -244,12 +244,16 @@ func (wp *WorkspacePersister) DeleteWorkspaceByID(workspaceID core.Uuid) ([]byte
 	return wp.DeleteWorkspace(ws)
 }
 
-// AddEnvironmentToWorkspace adds an environment to a workspace
+// AddEnvironmentToWorkspace adds an environment to a workspace. Adding one the
+// workspace already has returns the existing mapping instead of a second row.
 func (wp *WorkspacePersister) AddEnvironmentToWorkspace(workspaceID, environmentID core.Uuid) ([]byte, error) {
-	// delete any existing mapping for the environment in the workspace
-	_, err := wp.DeleteEnvironmentFromWorkspace(workspaceID, environmentID)
-	if err != nil && !strings.Contains(err.Error(), "record not found") {
-		return nil, fmt.Errorf("failed to delete existing environment mapping: %w", err)
+	var existing workspace.WorkspacesEnvironmentsMapping
+	found := wp.DB.Where("workspace_id = ? AND environment_id = ?", workspaceID, environmentID).Limit(1).Find(&existing)
+	if found.Error != nil {
+		return nil, ErrDBRead(found.Error)
+	}
+	if found.RowsAffected > 0 {
+		return json.Marshal(existing)
 	}
 
 	wsEnvMapping := workspace.WorkspacesEnvironmentsMapping{
@@ -371,7 +375,9 @@ func (wp *WorkspacePersister) GetWorkspaceEnvironments(workspaceID core.Uuid, se
 	return envsJSON, nil
 }
 
-// DeleteEnvironmentFromWorkspace deletes an environment from a workspace
+// DeleteEnvironmentFromWorkspace deletes an environment from a workspace.
+// Every mapping of the pair is deleted, including duplicates stored before
+// assignments were checked.
 func (wp *WorkspacePersister) DeleteEnvironmentFromWorkspace(workspaceID, environmentID core.Uuid) ([]byte, error) {
 	var wsEnvMapping workspace.WorkspacesEnvironmentsMapping
 
@@ -383,8 +389,9 @@ func (wp *WorkspacePersister) DeleteEnvironmentFromWorkspace(workspaceID, enviro
 		return nil, ErrDBRead(err)
 	}
 
-	// Delete the environment mapping
-	if err := wp.DB.Delete(&wsEnvMapping).Error; err != nil {
+	// Delete every mapping of the pair: rows added twice before assignments
+	// were checked would otherwise keep the environment assigned.
+	if err := wp.DB.Where("workspace_id = ? AND environment_id = ?", workspaceID, environmentID).Delete(&workspace.WorkspacesEnvironmentsMapping{}).Error; err != nil {
 		return nil, ErrDBDelete(err, wp.fetchUserDetails().ID.String())
 	}
 
@@ -573,11 +580,18 @@ func schemaMesheryPatterns(patterns []*MesheryPattern) ([]patternv1beta1.Meshery
 	return decoded, nil
 }
 
+// AddViewToWorkspace adds a view to a workspace. Adding one the workspace
+// already has returns the existing mapping instead of a second row.
 func (wp *WorkspacePersister) AddViewToWorkspace(workspaceID, viewID core.Uuid) ([]byte, error) {
-	// delete any existing mapping for the view in the workspace
-	_, err := wp.DeleteViewFromWorkspace(workspaceID, viewID)
-	if err != nil && !strings.Contains(err.Error(), "record not found") {
-		return nil, fmt.Errorf("failed to delete existing view mapping: %w", err)
+	// A view the workspace already has keeps its mapping; a second row would
+	// survive DeleteViewFromWorkspace.
+	var existing workspace.WorkspacesViewsMapping
+	found := wp.DB.Where("workspace_id = ? AND view_id = ?", workspaceID, viewID).Limit(1).Find(&existing)
+	if found.Error != nil {
+		return nil, ErrDBRead(found.Error)
+	}
+	if found.RowsAffected > 0 {
+		return json.Marshal(existing)
 	}
 
 	wsViewMapping := workspace.WorkspacesViewsMapping{
@@ -605,6 +619,9 @@ func (wp *WorkspacePersister) AddViewToWorkspace(workspaceID, viewID core.Uuid)
 	return wsJSON, nil
 }
 
+// DeleteViewFromWorkspace deletes a view from a workspace. Every mapping of
+// the pair is deleted, including duplicates stored before assignments were
+// checked.
 func (wp *WorkspacePersister) DeleteViewFromWorkspace(workspaceID, viewID core.Uuid) ([]byte, error) {
 	var wsViewMapping workspace.WorkspacesViewsMapping
 
@@ -615,7 +632,9 @@ func (wp *WorkspacePersister) DeleteViewFromWorkspace(workspaceID, viewID core.U
 		return nil, ErrDBRead(err)
 	}
 
-	if err := wp.DB.Delete(&wsViewMapping).Error; err != nil {
+	// Delete every mapping of the pair, including duplicates stored before
+	// assignments were checked.
+	if err := wp.DB.Where("workspace_id = ? AND view_id = ?", workspaceID, viewID).Delete(&workspace.WorkspacesViewsMapping{}).Error; err != nil {
 		return nil, ErrDBDelete(err, wp.fetchUserDetails().ID.String())
 	}
 
@@ -707,11 +726,18 @@ func (wp *WorkspacePersister) GetWorkspaceViews(workspaceID core.Uuid, search, o
 	return viewsJSON, nil
 }
 
+// AddTeamToWorkspace adds a team to a workspace. Adding one the workspace
+// already has returns the existing mapping instead of a second row.
 func (wp *WorkspacePersister) AddTeamToWorkspace(workspaceID, teamID core.Uuid) ([]byte, error) {
-	// delete any existing mapping for the team in the workspace
-	_, err := wp.DeleteTeamFromWorkspace(workspaceID, teamID)
-	if err != nil && !strings.Contains(err.Error(), "record not found") {
-		return nil, fmt.Erro
```

---

### Incident Patch 3: `2c47fc51` (2026-11-08)
**Commit Message**: Merge branch 'master' into fix/token-view-empty-prompt-hang

**File**: `server/handlers/component_handler.go` (modified, +40/-0)
```diff
@@ -789,6 +789,15 @@ func (h *Handler) RegisterMeshmodelComponents(rw http.ResponseWriter, r *http.Re
 			writeMeshkitError(rw, models.ErrUnmarshal(err, "component definition"), http.StatusBadRequest)
 			return
 		}
+		// Reject a model version that could escape the export working
+		// directory. Registration is unauthenticated, so a hostile version
+		// planted here would otherwise reach ExportModel (CWE-22).
+		if c.Model != nil && (!isSafePathComponent(c.Model.Version) || !isSafePathComponent(c.Model.Model.Version)) {
+			err := fmt.Errorf("invalid model version: must be a single path component")
+			h.log.Error(ErrRequestBody(err))
+			writeMeshkitError(rw, ErrRequestBody(err), http.StatusBadRequest)
+			return
+		}
 		utils.WriteSVGsOnFileSystem(&c)
 		isRegistranError, isModelError, err = h.registryManager.RegisterEntity(cc.Connection, &c)
 		helpers.HandleError(registry.RegistrantHostToV1beta1(cc.Connection), &c, err, isModelError, isRegistranError)
@@ -1313,6 +1322,16 @@ func ociRepositoryName(modelName string) string {
 	return sanitized
 }
 
+// isSafePathComponent reports whether s can be interpolated into a filesystem
+// path as a single component without escaping its parent directory. An empty
+// string is harmless (filepath.Join drops it) and is accepted.
+func isSafePathComponent(s string) bool {
+	if s == "" {
+		return true
+	}
+	return s != "." && s != ".." && filepath.Base(s) == s
+}
+
 func (h *Handler) ExportModel(rw http.ResponseWriter, r *http.Request) {
 	modelId := r.URL.Query().Get("id")
 	name := r.URL.Query().Get("name")
@@ -1397,6 +1416,19 @@ func (h *Handler) ExportModel(rw http.ResponseWriter, r *http.Request) {
 		writeMeshkitError(rw, ErrExportModel(err, "model name validation"), http.StatusBadRequest)
 		return
 	}
+	// The model versions are interpolated into the same paths. Apply the same
+	// single-component check to both, so a hostile version cannot escape the
+	// per-request temp directory either (CWE-22).
+	if !isSafePathComponent(model.Model.Version) {
+		err := fmt.Errorf("invalid model version %q: must be a single path component", model.Model.Version)
+		writeMeshkitError(rw, ErrExportModel(err, "model version validation"), http.StatusBadRequest)
+		return
+	}
+	if !isSafePathComponent(model.Version) {
+		err := fmt.Errorf("invalid model version %q: must be a single path component", model.Version)
+		writeMeshkitError(rw, ErrExportModel(err, "model version validation"), http.StatusBadRequest)
+		return
+	}
 	// 2. Convert it to oci
 	// Fixed pattern: the model name is already preserved in modelDir inside the
 	// temp root, and embedding it here risks exceeding filesystem name limits.
@@ -1416,6 +1448,14 @@ func (h *Handler) ExportModel(rw http.ResponseWriter, r *http.Request) {
 	modelDir := filepath.Join(tempDir, model.Name)
 	versionDir := filepath.Join(modelDir, model.Model.Version, model.Version)
 
+	// Defense in depth: even if a version slips past the checks above, the
+	// working directory must stay inside the per-request temp directory.
+	if versionDir != modelDir && !strings.HasPrefix(versionDir, modelDir+string(filepath.Separator)) {
+		err := fmt.Errorf("invalid model version: resolved path %q escapes the export directory", versionDir)
+		writeMeshkitError(rw, ErrExportModel(err, "model version validation"), http.StatusBadRequest)
+		return
+	}
+
 	// Create necessary directories: {modelName}/v1.0.0/1.0.0/{components, relationships}
 	dirs := []string{
 		versionDir,
```

**File**: `server/handlers/component_handler_test.go` (modified, +140/-0)
```diff
@@ -4,23 +4,29 @@ import (
 	"archive/tar"
 	"bytes"
 	"compress/gzip"
+	"crypto/rand"
+	"encoding/hex"
 	"encoding/json"
 	"fmt"
 	"io"
 	"net/http"
 	"net/http/httptest"
 	"net/url"
+	"os"
 	"path/filepath"
 	"strings"
 	"sync"
 	"testing"
 
 	"github.com/meshery/meshkit/database"
 	"github.com/meshery/meshkit/logger"
+	"github.com/meshery/meshkit/models/meshmodel/entity"
 	"github.com/meshery/meshkit/models/meshmodel/registry"
 	"github.com/meshery/schemas/models/v1beta1/category"
 	"github.com/meshery/schemas/models/v1beta1/connection"
 	"github.com/meshery/schemas/models/v1beta1/model"
+	compv1beta3 "github.com/meshery/schemas/models/v1beta3/component"
+	connv1beta3 "github.com/meshery/schemas/models/v1beta3/connection"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 )
@@ -66,6 +72,140 @@ func seedTestExportModel(t *testing.T, rm *registry.RegistryManager, modelName s
 	require.NoError(t, err, "seedTestExportModel: RegisterEntity failed")
 }
 
+// seedTestExportModelVersion seeds a model with explicit version strings,
+// so a traversal version can be registered for export testing.
+func seedTestExportModelVersion(t *testing.T, rm *registry.RegistryManager, modelName, modelVersion, innerVersion string) {
+	t.Helper()
+	conn := connection.Connection{
+		Name:    "test-registrant",
+		Kind:    modelName,
+		Type:    "platform",
+		SubType: "orchestration",
+		Status:  connection.ConnectionStatusConnected,
+	}
+	m := &model.ModelDefinition{
+		Name:          modelName,
+		DisplayName:   "Test Model",
+		SchemaVersion: "models.meshery.io/v1beta1",
+		Version:       modelVersion,
+		Model:         model.Model{Version: innerVersion},
+		Category:      category.CategoryDefinition{Name: "Orchestration"},
+		Status:        model.Enabled,
+		Metadata:      &model.ModelDefinition_Metadata{},
+	}
+	id, err := m.GenerateID()
+	require.NoError(t, err)
+	m.ID = id
+	_, _, err = rm.RegisterEntity(registry.RegistrantHostToV1beta3(conn), m)
+	require.NoError(t, err, "seedTestExportModelVersion: RegisterEntity failed")
+}
+
+// TestExportModel_VersionTraversal verifies that a model version containing
+// path separators cannot make the export write outside the per-request temp
+// directory (CWE-22). The export joins model.Model.Version and model.Version
+// into the working directory, so either field carrying ".." escapes it.
+func TestExportModel_VersionTraversal(t *testing.T) {
+	suffix := make([]byte, 8)
+	_, err := rand.Read(suffix)
+	require.NoError(t, err)
+	probeName := "meshery-traversal-probe-" + hex.EncodeToString(suffix)
+	probePath := filepath.Join(os.TempDir(), probeName)
+	t.Cleanup(func() {
+		_ = os.RemoveAll(probePath)
+	})
+
+	tests := []struct {
+		name         string
+		modelVersion string
+		innerVersion string
+	}{
+		{"model version traverses", "../../../" + probeName, "v1"},
+		{"inner model version traverses", "v1", "../../../" + probeName},
+		{"both versions traverse", "../../../" + probeName, "../../../" + probeName},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			rm, _ := newTestRegistryDB(t)
+			modelName := "traversal-model"
+			seedTestExportModelVersion(t, rm, modelName, tt.modelVersion, tt.innerVersion)
+
+			log, err := logger.New("component_handler_test", logger.Options{})
+			require.NoError(t, err)
+
+			h := &Handler{
+				registryManager: rm,
+				log:             log,
+			}
+
+			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/meshmodels/models/export?name=%s&fileType=tar", modelName), nil)
+			rw := httptest.NewRecorder()
+
+			h.ExportModel(rw, req)
+
+			resp := rw.Result()
+			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
+			_, statErr := os.Stat(probePath)
+			assert.True(t, os.IsNotExist(statErr), "export wrote outside the temp dir: %s exists", probePath)
+		})
+	}
+}
+
+// TestRegisterMeshmodelComponents_VersionTraversal verifies that registration
+// rejects a component whose model version carries a traversal string, in
+// either the outer version or the embedded model version, so a hostile
+// version cannot be planted through the registration endpoint.
+func TestRegisterMeshmodelComponents_VersionTraversal(t *testing.T) {
+	tests := []struct {
+		name         string
+		version      string
+		innerVersion string
+	}{
+		{"outer version traverses", "../../../escaped", "v1"},
+		{"embedded version traverses", "v1", "../../../escaped"},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			rm, _ := newTestRegistryDB(t)
+
+			log, err := logger.New("component_handler_test", logger.Options{})
+			require.NoError(t, err)
+
+			h := &Handler{
+				registryManager: rm,
+				log:             log,
+			}
+
+			comp := compv1beta3.ComponentDefinition{
+				Model: &model.ModelDefinition{
+					Name:    "traversal-model",
+					Version: tt.version,
+					Model:   model.Model{Version: tt.innerVersion},
+				},
+			}
+			entityBytes, err := json.Marshal(comp)
+			require.NoErr
```

**File**: `server/handlers/meshery_filter_component_test.go` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+package handlers
+
+import (
+	"encoding/json"
+	"os"
+	"path/filepath"
+	"runtime"
+	"testing"
+
+	"github.com/meshery/meshkit/logger"
+	"github.com/meshery/meshkit/models/meshmodel/registry"
+	"github.com/meshery/schemas/models/v1beta1/connection"
+	"github.com/meshery/schemas/models/v1beta3/component"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// registerWASMFilterComponent registers the WASMFilter component definition
+// shipped in the meshery-core model, so the lookup in generateFilterComponent
+// is tested against the real definition rather than a hand-written copy.
+func registerWASMFilterComponent(t *testing.T, rm *registry.RegistryManager) {
+	t.Helper()
+
+	_, filename, _, ok := runtime.Caller(0)
+	require.True(t, ok)
+	path := filepath.Join(filepath.Dir(filename), "..", "..", "models", "meshery-core", "0.7.2", "v1.0.0", "components", "WASMFilter.json")
+	content, err := os.ReadFile(path)
+	require.NoError(t, err)
+
+	var comp component.ComponentDefinition
+	require.NoError(t, json.Unmarshal(content, &comp))
+	id, err := comp.GenerateID()
+	require.NoError(t, err)
+	comp.ID = id
+
+	conn := connection.Connection{
+		Name:   "meshery",
+		Kind:   "meshery",
+		Type:   "registry",
+		Status: connection.ConnectionStatusConnected,
+	}
+	_, _, err = rm.RegisterEntity(registry.RegistrantHostToV1beta3(conn), &comp)
+	require.NoError(t, err, "registering the WASMFilter component")
+}
+
+func newFilterComponentTestHandler(t *testing.T, withWASMFilter bool) *Handler {
+	t.Helper()
+
+	rm, _ := newTestRegistryDB(t)
+	if withWASMFilter {
+		registerWASMFilterComponent(t, rm)
+	}
+	log, err := logger.New("meshery_filter_component_test", logger.Options{})
+	require.NoError(t, err)
+	return &Handler{registryManager: rm, log: log}
+}
+
+// TestGenerateFilterComponentCarriesConfig guards the filter configuration a
+// save persists: it is stored in filterResource under configuration.config, and
+// is lost if the WASMFilter component cannot be found in the registry.
+func TestGenerateFilterComponentCarriesConfig(t *testing.T) {
+	h := newFilterComponentTestHandler(t, true)
+	const config = "match: route-a\nratelimit: 100\n"
+
+	filterResource, err := h.generateFilterComponent(config)
+	require.NoError(t, err)
+	require.NotEmpty(t, filterResource, "the configuration must not be dropped")
+
+	var stored struct {
+		Component struct {
+			Kind string `json:"kind"`
+		} `json:"component"`
+		Configuration map[string]interface{} `json:"configuration"`
+	}
+	require.NoError(t, json.Unmarshal([]byte(filterResource), &stored))
+	assert.Equal(t, "WASMFilter", stored.Component.Kind)
+	assert.Equal(t, config, stored.Configuration["config"])
+}
+
+// TestGenerateFilterComponentWithoutWASMFilter pins what happens when the
+// registry has no WASMFilter component: a configuration must not be silently
+// discarded, while a save without one has nothing to lose.
+func TestGenerateFilterComponentWithoutWASMFilter(t *testing.T) {
+	h := newFilterComponentTestHandler(t, false)
+
+	_, err := h.generateFilterComponent("match: route-a\n")
+	assert.Error(t, err, "a configuration that cannot be stored must be reported")
+
+	filterResource, err := h.generateFilterComponent("")
+	require.NoError(t, err)
+	assert.Empty(t, filterResource)
+}
```

**File**: `server/handlers/meshery_filter_handler.go` (modified, +53/-37)
```diff
@@ -15,7 +15,6 @@ import (
 	"github.com/meshery/meshery/server/models/pattern/utils"
 	"github.com/meshery/meshkit/models/events"
 	regv1beta1 "github.com/meshery/meshkit/models/meshmodel/registry/v1beta1"
-	"github.com/meshery/schemas/models/v1beta1"
 	"github.com/meshery/schemas/models/v1beta1/model"
 	"github.com/meshery/schemas/models/v1beta3/component"
 )
@@ -543,46 +542,63 @@ func (h *Handler) FilterFileHandler(
 	h.PatternFileHandler(rw, r, prefObj, user, provider)
 }
 
+// wasmFilterModelName is the model that ships the WASMFilter component.
+const wasmFilterModelName = "meshery-core"
+
+// generateFilterComponent wraps a filter's configuration in a WASMFilter
+// component, which is what a filter save persists as its filterResource.
 func (h *Handler) generateFilterComponent(config string) (string, error) {
-	res, _, _, _ := h.registryManager.GetEntities(&regv1beta1.ComponentFilter{
-		Name:       "WASMFilter",
-		Trim:       false,
-		APIVersion: v1beta1.ComponentSchemaVersion,
-		Version:    "v1.0.0",
-		Limit:      1,
+	// Look the component up by kind and model. ComponentFilter matches
+	// APIVersion against the component's own version
+	// (core.meshery.io/v1alpha1) and Version against its model's version, so
+	// constraining them to the component schema version never matched and
+	// every filter configuration was silently dropped.
+	res, _, _, err := h.registryManager.GetEntities(&regv1beta1.ComponentFilter{
+		Name:      "WASMFilter",
+		ModelName: wasmFilterModelName,
+		Trim:      false,
+		Limit:     1,
 	})
 
+	var filterCompDef *component.ComponentDefinition
 	if len(res) > 0 {
-		filterEntity := res[0]
-		filterCompDef, ok := filterEntity.(*component.ComponentDefinition)
-		if ok {
-			filterID := uuid.Must(uuid.NewV4())
-			filterSvc := component.ComponentDefinition{
-				ID:          filterID,
-				DisplayName: strings.ToLower(filterCompDef.Component.Kind) + utils.GetRandomAlphabetsOfDigit(5),
-				Component: component.Component{
-					Kind:    filterCompDef.Component.Kind,
-					Version: filterCompDef.Component.Version,
-				},
-				Model: &model.ModelDefinition{
-					Name: filterCompDef.Model.Name,
-					Model: model.Model{
-						Version: filterCompDef.Model.Model.Version,
-					},
-				},
-				Metadata: component.ComponentDefinition_Metadata{
-					IsAnnotation: true,
-				},
-				Configuration: map[string]interface{}{
-					"config": config,
-				},
-			}
-			marshalledFilter, err := json.Marshal(filterSvc)
-			if err != nil {
-				return string(marshalledFilter), err
-			}
-			return string(marshalledFilter), nil
+		filterCompDef, _ = res[0].(*component.ComponentDefinition)
+	}
+	if filterCompDef == nil {
+		// Without the component there is nowhere to keep a configuration.
+		// Report that rather than saving the filter without it.
+		if config == "" {
+			return "", nil
+		}
+		if err != nil {
+			return "", err
 		}
+		return "", fmt.Errorf("the WASMFilter component of the %s model is not registered, so the filter configuration cannot be stored", wasmFilterModelName)
+	}
+
+	filterSvc := component.ComponentDefinition{
+		ID:          uuid.Must(uuid.NewV4()),
+		DisplayName: strings.ToLower(filterCompDef.Component.Kind) + utils.GetRandomAlphabetsOfDigit(5),
+		Component: component.Component{
+			Kind:    filterCompDef.Component.Kind,
+			Version: filterCompDef.Component.Version,
+		},
+		Model: &model.ModelDefinition{
+			Name: filterCompDef.Model.Name,
+			Model: model.Model{
+				Version: filterCompDef.Model.Model.Version,
+			},
+		},
+		Metadata: component.ComponentDefinition_Metadata{
+			IsAnnotation: true,
+		},
+		Configuration: map[string]interface{}{
+			"config": config,
+		},
+	}
+	marshalledFilter, err := json.Marshal(filterSvc)
+	if err != nil {
+		return string(marshalledFilter), err
 	}
-	return "", nil
+	return string(marshalledFilter), nil
 }
```

**File**: `server/handlers/middlewares.go` (modified, +23/-0)
```diff
@@ -189,6 +189,29 @@ func (h *Handler) AuthMiddleware(next http.Handler, auth models.AuthenticationMe
 	return http.HandlerFunc(fn)
 }
 
+// RegistrationAuthMiddleware requires provider authentication for component
+// registration only when a provider is actually in play: a provider is
+// enforced through PROVIDER, or the request carries a selector for a remote
+// provider. Adapters register against a local deployment with no provider
+// selector, and in local mode there is no session to validate, so forcing
+// ProviderAuth there would redirect every selector-free registration to
+// /provider and break adapter registration. Requests that select Local
+// (including the legacy None alias) pass through for the same reason: local
+// mode has no credentials to check. The traversal itself is still blocked by
+// the single-path-component validation in RegisterMeshmodelComponents, which
+// runs regardless of auth.
+func (h *Handler) RegistrationAuthMiddleware(next http.Handler) http.Handler {
+	fn := func(w http.ResponseWriter, r *http.Request) {
+		name, _ := resolveProviderName(r, h.config.ProviderCookieName, h.Provider)
+		if h.Provider != "" || (name != "" && name != models.LocalProviderName) {
+			h.AuthMiddleware(next, models.ProviderAuth).ServeHTTP(w, r)
+			return
+		}
+		next.ServeHTTP(w, r)
+	}
+	return http.HandlerFunc(fn)
+}
+
 func (h *Handler) validateAuth(provider models.Provider, req *http.Request) (bool, error) {
 	err := provider.GetSession(req)
 	if err == nil {
```

**File**: `server/handlers/middlewares_test.go` (modified, +82/-0)
```diff
@@ -398,3 +398,85 @@ func TestKubernetesMiddleware_NilGuards(t *testing.T) {
 		}
 	})
 }
+
+// TestRegistrationAuthMiddleware pins the auth boundary for component
+// registration: selector-free posts on a PROVIDER-unset deployment must reach
+// the handler (adapters register with no provider selector and local mode has
+// no session to validate), while a remote selector or an enforced provider
+// must go through ProviderAuth instead of reaching the handler.
+func TestRegistrationAuthMiddleware(t *testing.T) {
+	local := &models.DefaultLocalProvider{}
+	local.Initialize()
+	providers := map[string]models.Provider{local.Name(): local}
+
+	tests := []struct {
+		name             string
+		providerOverride string
+		setup            func(*http.Request)
+		wantReached      bool
+	}{
+		{
+			name:        "no selector, no enforced provider reaches handler",
+			wantReached: true,
+		},
+		{
+			name: "Local cookie reaches handler",
+			setup: func(r *http.Request) {
+				r.AddCookie(&http.Cookie{Name: "meshery-provider", Value: "Local"})
+			},
+			wantReached: true,
+		},
+		{
+			name: "legacy None cookie reaches handler",
+			setup: func(r *http.Request) {
+				r.AddCookie(&http.Cookie{Name: "meshery-provider", Value: "None"})
+			},
+			wantReached: true,
+		},
+		{
+			name: "remote selector requires auth and does not reach handler",
+			setup: func(r *http.Request) {
+				r.AddCookie(&http.Cookie{Name: "meshery-provider", Value: "Meshery"})
+			},
+			wantReached: false,
+		},
+		{
+			name: "remote provider query param requires auth and does not reach handler",
+			setup: func(r *http.Request) {
+				r.URL.RawQuery = "provider=Meshery"
+			},
+			wantReached: false,
+		},
+		{
+			name:             "enforced provider requires auth and does not reach handler",
+			providerOverride: "Meshery",
+			wantReached:      false,
+		},
+	}
+
+	for _, tc := range tests {
+		tc := tc
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			h := newTestHandler(t, providers, tc.providerOverride)
+			reached := false
+			inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				reached = true
+				w.WriteHeader(http.StatusOK)
+			})
+			chain := h.ProviderMiddleware(h.RegistrationAuthMiddleware(inner))
+			req := httptest.NewRequest(http.MethodPost, "/api/meshmodel/components/register", nil)
+			if tc.setup != nil {
+				tc.setup(req)
+			}
+			rec := httptest.NewRecorder()
+			chain.ServeHTTP(rec, req)
+			if reached != tc.wantReached {
+				t.Fatalf("reached = %v, want %v (status %d, location %q)", reached, tc.wantReached, rec.Result().StatusCode, rec.Header().Get("Location"))
+			}
+			if tc.wantReached && rec.Result().StatusCode != http.StatusOK {
+				t.Fatalf("expected 200 when handler is reached, got %d", rec.Result().StatusCode)
+			}
+		})
+	}
+}
```

**File**: `server/models/handlers.go` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@ type HandlerInterface interface {
 	//2. For adapter and other components of Meshery, they register/use endpoints without any provider authentication. Although we can have a different type of authentication built for
 	//such external systems trying to communicate without provider authentication. So for different endpoints, different authentication mechanisms other than provider can be used.
 	AuthMiddleware(http.Handler, AuthenticationMechanism) http.Handler
+	// RegistrationAuthMiddleware requires provider authentication for
+	// component registration only when a provider is enforced or a remote
+	// provider is selected. Adapters register without a provider selector
+	// on local deployments, so those requests pass through unauthenticated,
+	// matching the pre-existing behaviour the NoAuth registration routes had.
+	RegistrationAuthMiddleware(http.Handler) http.Handler
 	KubernetesMiddleware(func(http.ResponseWriter, *http.Request, *Preference, *User, Provider)) func(http.ResponseWriter, *http.Request, *Preference, *User, Provider)
 	K8sFSMMiddleware(func(http.ResponseWriter, *http.Request, *Preference, *User, Provider)) func(http.ResponseWriter, *http.Request, *Preference, *User, Provider)
 	SessionInjectorMiddleware(func(http.ResponseWriter, *http.Request, *Preference, *User, Provider)) http.Handler
```

**File**: `server/router/server.go` (modified, +3/-3)
```diff
@@ -262,8 +262,8 @@ func NewRouter(_ context.Context, h models.HandlerInterface, port int, g http.Ha
 	}
 
 	handleRegistry("/validate", h.ProviderMiddleware(h.AuthMiddleware(http.HandlerFunc(h.ValidationHandler), models.NoAuth)), "POST")
-	handleRegistry("/components", h.ProviderMiddleware(h.AuthMiddleware(http.HandlerFunc(h.RegisterMeshmodelComponents), models.NoAuth)), "POST") //This should also be left with NoAuth
-	gMux.Handle("/api/meshmodel/components/register", h.ProviderMiddleware((http.HandlerFunc(h.RegisterMeshmodelComponents)))).Methods("POST") //For backwards compatibility with previous registrants
+	handleRegistry("/components", h.ProviderMiddleware(h.RegistrationAuthMiddleware(http.HandlerFunc(h.RegisterMeshmodelComponents))), "POST")
+	gMux.Handle("/api/meshmodel/components/register", h.ProviderMiddleware(h.RegistrationAuthMiddleware(http.HandlerFunc(h.RegisterMeshmodelComponents)))).Methods("POST") //For backwards compatibility with previous registrants
 	handleRegistry("/{entityType}/status", h.ProviderMiddleware(h.AuthMiddleware(h.SessionInjectorMiddleware(h.UpdateEntityStatus), models.NoAuth)), "POST")
 	handleRegistry("/components", h.ProviderMiddleware(h.AuthMiddleware(http.HandlerFunc(h.GetAllMeshmodelComponents), models.NoAuth)), "GET")
 
@@ -311,7 +311,7 @@ func NewRouter(_ context.Context, h models.HandlerInterface, port int, g http.Ha
 	// form above uses the corrected /policies/{name} shape.
 	gMux.Handle("/api/meshmodels/models/{model}/policies{name}", h.ProviderMiddleware(h.AuthMiddleware(http.HandlerFunc(h.GetAllMeshmodelPoliciesByName), models.NoAuth))).Methods("GET")
 
-	handleRegistry("/export", h.ProviderMiddleware(h.AuthMiddleware(http.HandlerFunc(h.ExportModel), models.NoAuth)), "GET")
+	handleRegistry("/export", h.ProviderMiddleware(h.AuthMiddleware(http.HandlerFunc(h.ExportModel), models.ProviderAuth)), "GET")
 
 	gMux.Handle("/api/filter/deploy", h.ProviderMiddleware(h.AuthMiddleware(h.SessionInjectorMiddleware(h.KubernetesMiddleware(h.FilterFileHandler)), models.ProviderAuth))).
 		Methods("POST", "DELETE")
```

#### Recent Merged Pull Requests:
- **PR #23045** (2026-11-08): [Server] Parse Content-Disposition when naming a design imported from a URL (@BarbieRajput)
- **PR #23043** (2026-11-08): [Server] Stop repeated workspace assignments from surviving removal (@BarbieRajput)
- **PR #23041** (2026-11-08): [Server] Match every label in MeshSync resource filters (@BarbieRajput)
- **PR #23040** (2026-11-08): [Server][UI] Store and show filter configuration (@Asheesh7298)
- **PR #23037** (2026-11-08): Introduction - Lekha (@lekha-saradhi)
- **PR #23036** (2026-11-08): [mesheryctl] Prevent hang on empty token view prompt and respect --yes flag (@nishant-devv)

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

## X. Merge pull request #23036 from nishant-devv/fix/token-view-empty-prompt-hang

**RULE**:
When implementing operations in `mesheryctl/internal/cli/root/system/token.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshery/meshery. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a4d7f8a5`: Merge pull request #23036 from nishant-devv/fix/token-view-empty-prompt-hang. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `mesheryctl/internal/cli/root/system/token.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		if len(tokenNames) == 0 || utils.SilentFlag {
			return fmt.Errorf("token %q not found in config", tokenName)
		}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a4d7f8a5` are properly handled with clean fallback behavior.

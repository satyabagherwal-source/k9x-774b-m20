# Forensic Learning Record (Deep Inspection): meshery/meshery

> **Canonical Artifact**: `07_PROJECT_LEARNING/meshery-meshery-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meshery/meshery](https://github.com/meshery/meshery))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:25:43.086Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshery/meshery`
- **Description**: Meshery, the cloud native manager
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 11888 stars

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


def get_reviews(owner: str, r
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
- **Issue #22166** (2026-09-30): **[Server] Apply search and order when listing local performance profiles**
  *Symptoms*: **Notes for Reviewers**  - This PR fixes #22165  `DefaultLocalProvider.GetPerformanceProfiles` discarded its `search` and `order` arguments (`_, page, pageSize, _, _`) and always called the persister with empty values. The persister already supports both: it filters by name and runs `order` through `SanitizeOrderInput` with its own allow-list. So this change only forwards the two arguments and adds a regression test.  On the Local provider this makes the Performance Profiles search and sort work. It also fixes `mesheryctl perf apply <name>`, whose name lookup got back every profile and so could run an unrelated one.  **Changes** - `server/models/default_local_provider.go`: forward `search` and `order` to `PerformanceProfilesPersister.GetPerformanceProfiles` - `server/models/default_local_provider_test.go`: add `TestDefaultLocalProviderGetPerformanceProfilesAppliesSearchAndOrder`, using the existing in-memory `newMigratedDB` helper  **Before / after**  The new test on `master`, before the fix: ``` --- FAIL: TestDefaultLocalProviderGetPerformanceProfilesAppliesSearchAndOrder (0.01s)     default_local_provider_test.go:417: search=alpha returned [beta alpha], want [alpha]     default_local_provider_test.go:420: order=name asc returned [beta alpha], want [alpha beta] ```  After the fix: ``` $ go test ./server/models/ -count=1 ok  	github.com/meshery/meshery/server/models	22.537s ```  Against a running server on the Local provider, before the fix, with pr
  **Post-Mortem & Fix Analysis**:
  > Yay, your first pull request! :thumbsup: A contributor will be by to give feedback soon. In the meantime, you can find updates in the [#github-notifications](https://mesheryio.slack.com/archives/CLVT4TSG4) channel in the [community Slack](https://slack.meshery.io). Be sure to double-check that you have signed your commits. Here are instructions for [making signing an implicit activity while performing a commit](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin). 
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22166?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The Local provider now passes search and order values to the performance-profile persister. A test checks that search filters profiles and that `name asc` sorts them.  ### Changes  **Performance profile listing**  |Layer / File(s)|Summary| |---|---| |**Forward search and order** <br> `server/models/default_local_provider.go`, `server/models/default_local_provider_test.go`|`GetPerformanceProfiles` fo
  >            **Commit SHA:** `b4a20f66e1b0f9a721909cfc49e6f90017cdf5cb`      ### END-TO-END TESTS  - Testing started at: September 30th 2026, 4:51:44 pm  **📦 Test Result Summary**  - ✅ 75 passed - ❌ 0 failed - ⚠️ 0 flaked - ⏩ 11 skipped  ⌛ _Duration: 9 minutes and 48 seconds_  **Overall Result**: 👍 All tests passed.    <details>     <summary>[Show/Hide] Test Result Details</summary>     <div markdown="1">  | Test | Provider | Browser | Test Case | Tags | Result | | :---: | :---: | :---: | :--- | :---: | :---: | | 1 | Local | chromium-local-provider | Aggregation Charts are displayed |  | ✅ | | 2 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 3 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 4 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 5 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 6 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 7 | Local

- **Issue #22165** (2026-09-30): **[Server] Local provider ignores search and order when listing performance profiles**
  *Symptoms*: ### Current Behavior When the server runs with the **Local** provider, `GET /api/user/performance/profiles` ignores the `search` and `order` query params. It always returns the first page of **all** profiles, sorted by `updated_at desc`.  The handler passes both params on (`server/handlers/performance_profiles_handler.go:96`), but `DefaultLocalProvider.GetPerformanceProfiles` discards them:  ```go // server/models/default_local_provider.go:1267 func (l *DefaultLocalProvider) GetPerformanceProfiles(_, page, pageSize, _, _ string) ([]byte, error) { 	... 	return l.PerformanceProfilesPersister.GetPerformanceProfiles("", "", "", pg, pgs) } ```  `PerformanceProfilePersister.GetPerformanceProfiles` already supports both: it sanitizes `order` through `SanitizeOrderInput` and applies a `LIKE` filter for `search` (`server/models/performance_profile_persister.go:31`). The Remote provider forwards both params. Only the Local provider drops them.  **Impact:** - Searching or sorting the Performance Profiles table in the UI does nothing on the Local provider. - `mesheryctl perf profile <name>` lists every profile, not just the matching ones. - `mesheryctl perf apply <name>` (`mesheryctl/internal/cli/root/perf/apply.go:213-245`) uses this search to decide which profile to run:   - If **no** profiles exist, it offers to create one, which is correct.   - If exactly **one** profile exists, it runs that profile **whatever name was typed**.   - If several exist, it asks the user to pick from all 
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening this issue. A contributor will be by to give feedback soon. In the meantime, please review the [Contributors' Welcome Guide](https://docs.meshery.io/project/community), engage in the [discussion forum](https://discuss.meshery.io), and be sure to join the [community Slack](https://slack.meshery.io/). 

- **Issue #22157** (2026-09-30): **fix(server): keep the deep-link query on the post-login redirect**
  *Symptoms*: ## Intent  After Cloud returns the session to kanvas.new, Meshery Server drops mode=design from the return address. The Sign In link sends an absolute ref and never sets the ref cookie. TokenHandler ignores the ref query and rejects a same-origin absolute ref, so the user lands on /extension/meshmap without mode=design. Keep every cross-origin ref rejected. https://github.com/layer5io/meshery-cloud/issues/6126  ## What Changed  - `resolvePostLoginRedirect` now takes the server host and accepts a same-host absolute `ref`, reducing it to path and query (comparing host only, so scheme and port differences still match) while rejecting every other host; refs are decoded from both the server's raw-url encoding and standard base64, and `selectPostLoginRefValue` falls back to the `?ref=` query param when the ref cookie is absent *or* empty. `postLoginHost` derives the compared host from the configured server URL before the inbound `Host` header. - Hardened and unified the redirect gate: `safePostLoginTarget` rejects protocol-relative values and backslashes in the path (checked both on the received ref and on the reduced target), runs the auth-initiation denylist over the decoded path *and* the `path.Clean`-normalized effective `Location` so encoded and fragment-hidden traversal is caught, and adds `/login` to that denylist. The anonymous-session exit in `InterceptLoginAndInitiateAnonymousUserSession` now routes its `/extension` referrer through the same gate instead of redirecting th
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22157?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Review was skipped as selected files did not have any reviewable changes. >  >  >  >  >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `b77e46de-598c-40f9-a798-5fefe98c4f6a` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files t
  > <!-- meshery-ui-audit-marker --> ### Meshery UI restructure audits  Phase 1 baseline counters (informational; see [#18656](https://github.com/meshery/meshery/issues/18656)).  ``` AUDIT mui files=0 matches=0 AUDIT hex files=167 matches=453 hex=414 rgb=39 AUDIT size over_warn=7 over_hard=0 AUDIT lint-ui-kit status=pass ```  Full per-file breakdowns are in the workflow's [job summary](https://github.com/meshery/meshery/actions/runs/36734365452).
  > 📖 Docs preview: https://docs.meshery.io/pr-preview/pr-22157/ <!-- Sticky Pull Request Commentpr-preview -->

- **Issue #22128** (2026-09-28): **[Server] Report missing keys register column instead of seeding zero keys silently**
  *Symptoms*: ## What this fixes  `GetIndexForRegisterCol` in `server/models/keys_helper.go` returns -1 when the expected `Local Provider` header is absent from `server/permissions/keys.csv`. The `SeedKeys` row predicate then returns false for every row, so `SeedKeys` persists **zero** keys and logs nothing at all. A header rename, a column reorder that drops that name, or an editor rewriting the CSV would silently empty the Key table on every boot: no error, no warning, no failed startup.  With this change a missing or renamed register column is reported loudly at boot as `meshery-server-1486` (`ErrKeysRegisterColumnMissing`), once on the first blocked row, instead of seeding zero keys silently.  ## Severity determination (established from the code before building)  An empty Key table **denies every capability, and it can make nothing permissive**. Both halves, stated plainly:  - The Key table drives the interface's capability model only. `DefaultLocalProvider.GetUsersKeys` is its sole reader, served at one route behind `AuthMiddleware`; the UI turns each row into a CASL rule and the ability object starts empty, so zero rows means every gate evaluates to `false`. - No server endpoint consults a key to authorize a request. Server-side authorization comes from the provider's own responses, not from this table.  So a renamed or dropped header causes a **capability outage** - gated controls disappear and legitimate users lose access - and it **cannot grant anyone anything they did not already
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22128?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `8c126474-e51e-4d83-a158-7b03604ef5dc`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 396b64f993f8f2a86e03c8b78f2ab77bcd60023f an
  > Preview deployment for PR #22128 removed.  This PR preview was automatically pruned because we keep only the 6 most recently updated previews on GitHub Pages to stay within deployment size limits.  If needed, push a new commit to this PR to generate a fresh preview. <!-- Sticky Pull Request Commentpr-preview -->
  >            **Commit SHA:** `afe0166482361dfcb9bc0f942ce2e3f2a5486f75`      ### END-TO-END TESTS  - Testing started at: September 28th 2026, 10:51:06 pm  **📦 Test Result Summary**  - ✅ 76 passed - ❌ 0 failed - ⚠️ 0 flaked - ⏩ 10 skipped  ⌛ _Duration: 7 minutes and 56 seconds_  **Overall Result**: 👍 All tests passed.    <details>     <summary>[Show/Hide] Test Result Details</summary>     <div markdown="1">  | Test | Provider | Browser | Test Case | Tags | Result | | :---: | :---: | :---: | :--- | :---: | :---: | | 1 | Local | chromium-local-provider | Aggregation Charts are displayed |  | ✅ | | 2 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 3 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 4 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 5 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 6 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 7 | Loca

- **Issue #22127** (2026-09-28): **[Server] Fix SeedKeys Done-race dropping last key, buffered errors, and panicking-save leak**
  *Symptoms*: ## Summary  Closes the `SeedKeys` completion-handshake defect in `server/models/keys_helper.go` and its two sibling manifestations, which share one root cause: the select loop treats `csvReader.Context.Done()` as the producer-finished signal without draining the channels first.  - **Dropped last key:** the parser sends the final matching row of `server/permissions/keys.csv` (line 106, "Credentials / View Credentials", `96759f76-4add-45f8-b4ef-d4ace5ab1bc4`) into the capacity-1 channel, then its deferred cancel closes the context. The parent re-enters the `select` with both receive and `Done` ready, and Go picks at random — so roughly half of boots return without persisting that key, silently. Fixed by draining both channels non-blockingly on the `Done` case before returning. - **Dropped buffered parse error:** same coin flip on `errorChan`. Same drain covers it. - **Panicking-save leak:** if `SaveUsersKey` panics, `RunSeedStage` recovers it, so nobody drains the channel; the parser goroutine blocks forever on its next send and its file is never released. Fixed by containing a per-item persistence panic inside `saveSeededKey`, so the loop (and the consumer) survives.  The parser's cancel runs strictly after every send completes (verified in meshkit v1.0.22 `utils/csv/csv.go`), so once `Done` is observed no further send can occur and the bounded drain cannot miss a row.  ## Severity  A missing key row is **fail-closed**. The `Key` table is written only by `KeyPersister.SaveUser
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22127?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  `SeedKeys` now drains buffered parser results after parser completion. Key persistence runs through a helper that logs persistence errors and recovers from panics. New tests cover buffered results, continued seeding after a panic, resource cleanup, and the shipped permissions CSV.  ### Changes  **Seeded Key Processing**  |Layer / File(s)|Summary| |---|---| |**Contain persistence failures** <br> `ser
  >            **Commit SHA:** `beb32de3684001c30bafcfcdeaba7c403232d204`      ### END-TO-END TESTS  - Testing started at: September 28th 2026, 9:33:36 pm  **📦 Test Result Summary**  - ✅ 74 passed - ❌ 0 failed - ⚠️ 0 flaked - ⏩ 12 skipped  ⌛ _Duration: 9 minutes and 56 seconds_  **Overall Result**: 👍 All tests passed.    <details>     <summary>[Show/Hide] Test Result Details</summary>     <div markdown="1">  | Test | Provider | Browser | Test Case | Tags | Result | | :---: | :---: | :---: | :--- | :---: | :---: | | 1 | Local | chromium-local-provider | Aggregation Charts are displayed |  | ✅ | | 2 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 3 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 4 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 5 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 6 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 7 | Local

- **Issue #22126** (2026-09-28): **[Docs] Add introduction for Atreo Pramanick**
  *Symptoms*: **Notes for Reviewers**  - This PR adds a new file `Atreo` under `docs/meetings/` containing my introduction. - No code changes; documentation only.  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)** - [x] Yes, I signed my commits.  <!-- Thank you for contributing to Meshery!   Contributing Conventions:  1. Include descriptive PR titles with [<component-name>] prepended. 2. Build and test your changes before submitting a PR.  3. Sign your commits. 4. Include before and after screenshots/terminal output.  By following the community's contribution conventions upfront, the review process will  be accelerated and your PR merged more quickly. -->  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added an introduction to the meeting notes with a contributor’s background, experience, and interest in open-source contributions.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22126"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `46847129-eb38-4512-ad85-889e0c08e4c2`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 37833924f9db079334fcde3938e56392c6829160 and 65e7021f25672969834f221
  > Preview deployment for PR #22126 removed.  This PR preview was automatically pruned because we keep only the 6 most recently updated previews on GitHub Pages to stay within deployment size limits.  If needed, push a new commit to this PR to generate a fresh preview. <!-- Sticky Pull Request Commentpr-preview -->
  > The "Validate and Auto-Merge Meeting Minutes" workflow has been stuck on "Fetching the repository" in the Checkout step for quite some time now. Could a maintainer cancel and re-run it? Thanks!

- **Issue #22122** (2026-09-28): **[Docs] Add Priyanshu Shrivastava introduction**
  *Symptoms*: **Notes for Reviewers**  - Adds my introduction to the Meshery meeting notes. - Includes my education, technical interests, and open-source contributions.  **[Signed commits](https://github.com/meshery/meshery/blob/master/CONTRIBUTING.md#signing-off-on-commits-developer-certificate-of-origin)**  - [ ] Yes, I signed my commits.  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added an introductory profile highlighting Priyanshu Shrivastava’s education, development interests, technologies, open-source contributions, and GitHub profile.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22122"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `e2203d1a-65fb-4c52-8d89-9c612e7c9b9f`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 90bac8dc4c9ea5d6d915c41fec0bb013adc1b6fe and 9e1b8c76753b1841fe62b25
  > Preview deployment for PR #22122 removed.  This PR preview was automatically pruned because we keep only the 6 most recently updated previews on GitHub Pages to stay within deployment size limits.  If needed, push a new commit to this PR to generate a fresh preview. <!-- Sticky Pull Request Commentpr-preview -->
  > ### ✅ Meeting Minutes Auto-Merged 🗓️  This pull request has been automatically merged because it contains **only** changes to meeting minutes in `docs/meetings/`.  **Summary:** - Files modified: 1 - Merged by: @meshery-ci (Community Manager Bot)  Thank you for keeping our meeting records up to date! 📝

- **Issue #22121** (2026-09-28): **fix(server): keep a SeedKeys goroutine panic from terminating the server at boot**
  *Symptoms*: ## Intent  Close the residual path that meshery/meshery#21586 left open: a boot seeding stage can still terminate the whole Meshery server.  #21586 fixed the pinned-PROVIDER seeding panic in meshery/meshery#21584 by wrapping each boot seeding stage in models.RunSeedStage, which recovers a panic, logs it with a stack trace via ErrSeedingStagePanic, and lets the remaining stages run. Its accepted intent was that seeding must not be able to kill the server. That is now true for every stage that does its work inline - but not for all of them.  The PR documents the limit honestly at server/models/seed_models.go:133-138:  "The cover is bounded by what recover can reach: only panics on the wrapped stage's own goroutine. A stage that itself spawns a goroutine - SeedKeys does, in keys_helper.go - leaves that goroutine outside this recover, and a panic there still terminates the process. Recovering it belongs where it is spawned, not here."  So the "user keys" stage still has a path that can take the whole server down at boot, exactly as the original defect did. Go's recover only reaches panics on the goroutine that deferred it; a panic on a child goroutine unwinds to the top of that goroutine and terminates the process regardless of any recover in the parent.  This is worth closing rather than leaving documented because a reader who sees every stage wrapped in RunSeedStage will reasonably conclude the class is closed. It is not, and the one place it is not is invisible from the call s
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/meshery/meshery/pull/22121"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `ca90006b-8b38-44ff-aaf7-8de95200b767`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 8c16e9ec9d528c56e646e781b5ff2a0bf28c1eef and 12b2405167cdcdaa4e9dc60
  > Preview deployment for PR #22121 removed.  This PR preview was automatically pruned because we keep only the 6 most recently updated previews on GitHub Pages to stay within deployment size limits.  If needed, push a new commit to this PR to generate a fresh preview. <!-- Sticky Pull Request Commentpr-preview -->
  >            **Commit SHA:** `78d54cbd8445ab558acd14bf0e141d30fd1004c4`      ### END-TO-END TESTS  - Testing started at: September 28th 2026, 1:12:50 am  **📦 Test Result Summary**  - ✅ 76 passed - ❌ 0 failed - ⚠️ 0 flaked - ⏩ 10 skipped  ⌛ _Duration: 9 minutes and 50 seconds_  **Overall Result**: 👍 All tests passed.    <details>     <summary>[Show/Hide] Test Result Details</summary>     <div markdown="1">  | Test | Provider | Browser | Test Case | Tags | Result | | :---: | :---: | :---: | :--- | :---: | :---: | | 1 | Local | chromium-local-provider | Aggregation Charts are displayed |  | ✅ | | 2 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 3 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 4 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 5 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 6 | Local | chromium-local-provider | alias resolution | relationship | ✅ | | 7 | Local

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

### Incident Patch 1: `b644d92a` (2026-09-29)
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

### Incident Patch 2: `8a643331` (2026-09-29)
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
+<svg width="30" height="34" viewBox="0 0 64.386 62.635" xmlns="http://www.w3.org/2000/svg"><path d="m18.112 62.241c-.58208-.2097-1.0825-.38307-1.1121-.38526-.05964-.004-6.9703-8.5523-8.016-9.9151-.3638-.47411-1.8521-2.3244-3.3073-4.1118-6.169-7.5771-5.7671-6.894-5.6043-9.525.07652-1.2369.2681-2.6062.42574-3.0427.15763-.43656.88408-3.4726 1.6143-6.7469s1.4423-6.4294 1.5822-7.0115c.13998-.58209.49521-2.1299.78941-3.4396 1.3414-5.9718 1.3876-6.0514 4.3737-7.5406 1.313-.65484 3.9324-1.927 5.8208-2.8269 1.8885-.89995 6.3475-3.0258 9.9091-4.7242 7.7798-3.7099 7.4615-3.6736 12.178-1.3871 1.6735.81137 4.531 2.1853 6.35 3.0532 1.819.86788 4.4384 2.1189 5.8208 2.78 1.3824.66112 3.7644 1.7868 5.2931 2.5015 2.9983 1.4017 4.0296 2.3189 4.4852 3.9889.24392.89408.61395 2.4653 2.1314 9.0501.28504 1.2369.86914 3.7372 1.298 5.5562s.97374 4.2003 1.2108 5.2917c.2371 1.0914.56563 2.4425.73006 3.0024.50213 1.7098.37232 3.363-.34938 4.4494-.35422.53325-2.549 3.3137-4.8774 6.1788-2.3283 2.8651-4.531 5.6016-4.8948 6.0813-3.5052 4.6213-6.5923 8.1362-7.558 8.6052-1.0278.49922-1.6581.52197-14.155.51087-10.7-.01-13.272-.081-14.138-.39289zm14.42-14.853c1.993-.65861 4.1321-1.8055 5.208-2.7923l.57777-.52995.15829 1.0218c.37804 2.4404.25325 2.3447 3.0582 2.3447h2.5072v-12.965c0-14.742.01357-14.637-2.1954-17.096-2.2207-2.4725-5.3026-3.3183-11.157-3.0616-3.7392.16395-6.9101.77913-9.2875 1.8019l-1.3054.56157v2.2164c0 1.219.0817 2.2164.18156 2.2164s1.0226-.23473 2.0505-.52163c2.4182-.67492 6.8343-1.3304 8.9629-1.3304 2.0099.0 4.3168.63112 5.1681 1.4139 1.22 1.1218 1.459 1.9649 1.5795 5.5722.10844 3.2453.08971 3.4049-.37858 3.2252-.27096-.10398-1.6251-.35976-3.0091-.56841-6.4942-.979-10.999.005-14.067 3.0735-2.0011 2.0011-2.4548 3.2402-2.4641 6.7305-.0065 2.4258.08634 3.1141.55768 4.1334 1.179 2.5499 3.2925 4.2534 5.9416 4.9794 2.3169.63499 5.0434.52227 7.9127-.42589zm-5.3603-4.4174c-1.3419-.50246-1.7811-.90498-2.3487-2.1529-.96238-2.1156-.37837-5.1724 1.2299-6.4375 1.6643-1.3091 6.0181-1.7402 10.183-1.0084l1.7198.30217v6.6092l-1.4496.86623c-3.1522 1.8836-7.1071 2.6552-9.3347 1.8212z" stroke-width=".26458" style="fill:#212529"></path><path style="fill:none;stroke-width:.271169" d="m97.026736 181.42372c-11.841729-2.08439-21.332462-9.10215-26.093859-19.29466-1.998022-4.27707-2.054194-4.6839-2.055098-14.88419-841e-6-9.49243.144169-11.16725 1.267846-14.64314 1.712817-5.29828 6.177554-10.936 12.299033-15.53024 2.542552-1.90822 7.390509-4.53026 10.594967-5.73033 8.933335-3.34556 20.674605-4.18152 34.409895-2.44995 4.41785.55695 12.65266 1.97363 14.19738 2.44244 1.76241.53489 1.85502.50959 2.22367-.60744.24279-.73566.28029-2.73516.14369-7.66053-.44788-16.149002-1.23751-19.911778-5.02917-23.965076-1.80821-1.932978-3.56225-2.973051-7.11557-4.219231-5.30124-1.859191-12.26098-2.569875-19.19872-1.960452-10.49153.921594-19.993865 2.573896-30.430988 5.291456l-5.619006 1.463045-.198978-.992725C76.31239 78.136699 76.217381 74.401849 76.210696 70.38303l-.01215-7.306943 3.356503-1.444983c10.517529-4.527823 21.216871-6.656502 37.293351-7.419665 12.51101-.593907 22.76653.582675 29.54824 3.389974 4.64166 1.921419 7.46417 3.920688 11.49419 8.14168 5.92808 6.208991 7.10885 9.292714 7.94906 20.759878.20234 2.761617.35353 19.385439.44083 48.471489l.13286 44.26837-6.87266-.008c-7.35796-.009-10.40797-.26157-11.45694-.94889-1.06894-.70039-1.56607-2.17132-2.37024-7.01314-.41845-2.51943-.81979-4.63975-.89185-4.71182-.0721-.0721-.94053.61073-1.92991 1.51732-2.61666 2.39769-6.17638 4.67392-11.10375 7.10019-7.00303 3.44832-13.15672 5.41292-19.90153 6.35366-4.14851.57862-11.25229.52696-14.85996-.10807zM117.9586 163.14859c7.66738-1.41157 14.24402-3.97835 21.89691-8.5461l3.72858-2.22546v-12.58107c0-11.74762-.0314-12.59038-.47455-12.72168-1.42309-.42168-10.77757-1.80215-14.1221-2.08405-4.68265-.39467-14.28993-.18758-17.80807.38387-8.70887 1.41459-13.028171 3.55254-15.811026 7.82606-2.230704 3.42561-3.30745 7.4555-3.304504 12.36763.0032 5.38208 1.685615 10.33001 4.555689 13.39835 1.8729
```

**File**: `docs/content/en/extensions/models/aws-opensearchservice-controller/components/vpc-endpoint-access/icons/white/vpc-endpoint-access-white.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg width="30" height="34" viewBox="0 0 64.386 62.635" xmlns="http://www.w3.org/2000/svg"><path d="m18.112 62.241c-.58208-.2097-1.0825-.38307-1.1121-.38526-.05964-.004-6.9703-8.5523-8.016-9.9151-.3638-.47411-1.8521-2.3244-3.3073-4.1118-6.169-7.5771-5.7671-6.894-5.6043-9.525.07652-1.2369.2681-2.6062.42574-3.0427.15763-.43656.88408-3.4726 1.6143-6.7469s1.4423-6.4294 1.5822-7.0115c.13998-.58209.49521-2.1299.78941-3.4396 1.3414-5.9718 1.3876-6.0514 4.3737-7.5406 1.313-.65484 3.9324-1.927 5.8208-2.8269 1.8885-.89995 6.3475-3.0258 9.9091-4.7242 7.7798-3.7099 7.4615-3.6736 12.178-1.3871 1.6735.81137 4.531 2.1853 6.35 3.0532 1.819.86788 4.4384 2.1189 5.8208 2.78 1.3824.66112 3.7644 1.7868 5.2931 2.5015 2.9983 1.4017 4.0296 2.3189 4.4852 3.9889.24392.89408.61395 2.4653 2.1314 9.0501.28504 1.2369.86914 3.7372 1.298 5.5562s.97374 4.2003 1.2108 5.2917c.2371 1.0914.56563 2.4425.73006 3.0024.50213 1.7098.37232 3.363-.34938 4.4494-.35422.53325-2.549 3.3137-4.8774 6.1788-2.3283 2.8651-4.531 5.6016-4.8948 6.0813-3.5052 4.6213-6.5923 8.1362-7.558 8.6052-1.0278.49922-1.6581.52197-14.155.51087-10.7-.01-13.272-.081-14.138-.39289zm14.42-14.853c1.993-.65861 4.1321-1.8055 5.208-2.7923l.57777-.52995.15829 1.0218c.37804 2.4404.25325 2.3447 3.0582 2.3447h2.5072v-12.965c0-14.742.01357-14.637-2.1954-17.096-2.2207-2.4725-5.3026-3.3183-11.157-3.0616-3.7392.16395-6.9101.77913-9.2875 1.8019l-1.3054.56157v2.2164c0 1.219.0817 2.2164.18156 2.2164s1.0226-.23473 2.0505-.52163c2.4182-.67492 6.8343-1.3304 8.9629-1.3304 2.0099.0 4.3168.63112 5.1681 1.4139 1.22 1.1218 1.459 1.9649 1.5795 5.5722.10844 3.2453.08971 3.4049-.37858 3.2252-.27096-.10398-1.6251-.35976-3.0091-.56841-6.4942-.979-10.999.005-14.067 3.0735-2.0011 2.0011-2.4548 3.2402-2.4641 6.7305-.0065 2.4258.08634 3.1141.55768 4.1334 1.179 2.5499 3.2925 4.2534 5.9416 4.9794 2.3169.63499 5.0434.52227 7.9127-.42589zm-5.3603-4.4174c-1.3419-.50246-1.7811-.90498-2.3487-2.1529-.96238-2.1156-.37837-5.1724 1.2299-6.4375 1.6643-1.3091 6.0181-1.7402 10.183-1.0084l1.7198.30217v6.6092l-1.4496.86623c-3.1522 1.8836-7.1071 2.6552-9.3347 1.8212z" stroke-width=".26458" style="fill:#fff"></path><path style="fill:none;stroke-width:.271169" d="m97.026736 181.42372c-11.841729-2.08439-21.332462-9.10215-26.093859-19.29466-1.998022-4.27707-2.054194-4.6839-2.055098-14.88419-841e-6-9.49243.144169-11.16725 1.267846-14.64314 1.712817-5.29828 6.177554-10.936 12.299033-15.53024 2.542552-1.90822 7.390509-4.53026 10.594967-5.73033 8.933335-3.34556 20.674605-4.18152 34.409895-2.44995 4.41785.55695 12.65266 1.97363 14.19738 2.44244 1.76241.53489 1.85502.50959 2.22367-.60744.24279-.73566.28029-2.73516.14369-7.66053-.44788-16.149002-1.23751-19.911778-5.02917-23.965076-1.80821-1.932978-3.56225-2.973051-7.11557-4.219231-5.30124-1.859191-12.26098-2.569875-19.19872-1.960452-10.49153.921594-19.993865 2.573896-30.430988 5.291456l-5.619006 1.463045-.198978-.992725C76.31239 78.136699 76.217381 74.401849 76.210696 70.38303l-.01215-7.306943 3.356503-1.444983c10.517529-4.527823 21.216871-6.656502 37.293351-7.419665 12.51101-.593907 22.76653.582675 29.54824 3.389974 4.64166 1.921419 7.46417 3.920688 11.49419 8.14168 5.92808 6.208991 7.10885 9.292714 7.94906 20.759878.20234 2.761617.35353 19.385439.44083 48.471489l.13286 44.26837-6.87266-.008c-7.35796-.009-10.40797-.26157-11.45694-.94889-1.06894-.70039-1.56607-2.17132-2.37024-7.01314-.41845-2.51943-.81979-4.63975-.89185-4.71182-.0721-.0721-.94053.61073-1.92991 1.51732-2.61666 2.39769-6.17638 4.67392-11.10375 7.10019-7.00303 3.44832-13.15672 5.41292-19.90153 6.35366-4.14851.57862-11.25229.52696-14.85996-.10807zM117.9586 163.14859c7.66738-1.41157 14.24402-3.97835 21.89691-8.5461l3.72858-2.22546v-12.58107c0-11.74762-.0314-12.59038-.47455-12.72168-1.42309-.42168-10.77757-1.80215-14.1221-2.08405-4.68265-.39467-14.28993-.18758-17.80807.38387-8.70887 1.41459-13.028171 3.55254-15.811026 7.82606-2.230704 3.42561-3.30745 7.4555-3.304504 12.36763.0032 5.38208 1.685615 10.33001 4.555689 13.39835 1.872987 
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

---

### Incident Patch 3: `c613aae6` (2026-09-29)
**Commit Message**: [Docs] Fix broken relative links in UI and server contributor guides

Update relative documentation links in the UI and server contributor guides to use Hugo ref shortcodes. Specifically:
- Target nested ui/ui#contributing-ui anchor from contributing-server.md
- Use Hugo ref shortcodes for server and UI testing guide references in ui/ui.md

Fixes #22056

Signed-off-by: Ali Mahmood <alimahmoodrana82@gmail.com>

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

### Incident Patch 4: `53c386a9` (2026-09-28)
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
+// returned before the timeout. It cannot catch an escaping panic (that lan
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

### Incident Patch 5: `beb32de3` (2026-09-28)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fm/seedkeys-done-race-drops-last-key

Signed-off-by: Lee Calcote <lee.calcote@layer5.io>

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

---

### Incident Patch 6: `6824a35c` (2026-09-28)
**Commit Message**: [Server] Fix SeedKeys Done-race dropping last key, buffered errors, and panicking-save leak

Signed-off-by: Lee Calcote <lee.calcote@layer5.io>

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
+func runSeedKeys(t *testing.T, krh *KeysRegistrationHelper, fixture
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

### Incident Patch 7: `5956d06d` (2026-09-25)
**Commit Message**: Merge pull request #22057 from AliRana30/docs/fix-system-commands-context-flags

[Docs] Fix invalid --components flag syntax and typos in system command guide

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

---

### Incident Patch 8: `89776a0c` (2026-09-25)
**Commit Message**: Merge branch 'master' into docs/fix-system-commands-context-flags

**File**: `docs/data/discuss/meshery.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"users":[{"id":4636,"username":"francoXwrld","name":"Franco Wrld ","avatar_template":"/user_avatar/discuss.meshery.io/francoxwrld/{size}/3841_2.png","trust_level":0},{"id":4623,"username":"Tushar","name":"Tushar Agarwal","avatar_template":"/user_avatar/discuss.meshery.io/tushar/{size}/3835_2.png","trust_level":0},{"id":2497,"username":"Sangram.Rath","name":"Sangram Rath","avatar_template":"/user_avatar/discuss.meshery.io/sangram.rath/{size}/2292_2.png","admin":true,"moderator":true,"trust_level":2},{"id":3824,"username":"RaunaK_Madan","name":"RaunaK Madan","avatar_template":"/user_avatar/discuss.meshery.io/raunak_madan/{size}/3503_2.png","trust_level":1},{"id":3,"username":"Lee","name":"Lee Calcote","avatar_template":"/user_avatar/discuss.meshery.io/lee/{size}/7_2.png","flair_name":"Team","flair_url":"/uploads/default/original/2X/5/5ac732fb153a994a5c32d5e9093b4ef9cbc16be2.png","flair_bg_color":"7FFFFFF","flair_group_id":42,"admin":true,"moderator":true,"trust_level":2},{"id":4571,"username":"Nishant","name":"Nishant ","avatar_template":"/user_avatar/discuss.meshery.io/nishant/{size}/3810_2.png","trust_level":0},{"id":16,"username":"discuss","name":"Layer5 Forum","avatar_template":"/user_avatar/discuss.meshery.io/discuss/{size}/36_2.png","admin":true,"trust_level":1},{"id":4531,"username":"AkashNaickar","name":"Akash Naickar","avatar_template":"/user_avatar/discuss.meshery.io/akashnaickar/{size}/3773_2.png","trust_level":1},{"id":4537,"username":"Darshan_K","name":"Darshan K","avatar_template":"/user_avatar/discuss.meshery.io/darshan_k/{size}/3776_2.png","trust_level":0},{"id":3280,"username":"Omolade_Akinwumi","name":"Omolade Akinwumi","avatar_template":"/user_avatar/discuss.meshery.io/omolade_akinwumi/{size}/3175_2.png","trust_level":0},{"id":4541,"username":"ISHWAR","name":"ISHWAR","avatar_template":"/user_avatar/discuss.meshery.io/ishwar/{size}/3781_2.png","trust_level":0},{"id":4546,"username":"whozahm3d","name":"Ali Ahmad","avatar_template":"/user_avatar/discuss.meshery.io/whozahm3d/{size}/3786_2.png","trust_level":0},{"id":4542,"username":"Harshith029","name":"Pali Krishna Harshith ","avatar_template":"/user_avatar/discuss.meshery.io/harshith029/{size}/3782_2.png","trust_level":0},{"id":4543,"username":"Ayush_Kumar","name":"Ayush Kumar","avatar_template":"/user_avatar/discuss.meshery.io/ayush_kumar/{size}/3785_2.png","trust_level":0},{"id":4484,"username":"Dhruvesh_Mishra","name":"Dhruvesh Mishra","avatar_template":"/user_avatar/discuss.meshery.io/dhruvesh_mishra/{size}/3719_2.png","trust_level":1},{"id":4262,"username":"Bhumika_Garg","name":"Bhumika Garg","avatar_template":"/user_avatar/discuss.meshery.io/bhumika_garg/{size}/3593_2.png","trust_level":1},{"id":3452,"username":"saurabhraghuvansii","name":"Saurabh Raghuvanshi","avatar_template":"/user_avatar/discuss.meshery.io/saurabhraghuvansii/{size}/3399_2.png","trust_level":1},{"id":4025,"username":"yatharth.katta","name":"yatharth katta","avatar_template":"/user_avatar/discuss.meshery.io/yatharth.katta/{size}/3536_2.png","trust_level":0},{"id":3908,"username":"Yash.Mahakal","name":"Yash Mahakal","avatar_template":"/user_avatar/discuss.meshery.io/yash.mahakal/{size}/3537_2.png","trust_level":1},{"id":3900,"username":"Kavitha_Karunakaran","name":"Kavitha Karunakaran","avatar_template":"/user_avatar/discuss.meshery.io/kavitha_karunakaran/{size}/3597_2.png","trust_level":1},{"id":56,"username":"Cyna","name":"Anirudh Jain","avatar_template":"/user_avatar/discuss.meshery.io/cyna/{size}/101_2.png","trust_level":1},{"id":4516,"username":"yuriko_diaz","name":null,"avatar_template":"/letter_avatar_proxy/v4/letter/y/258eb7/{size}.png","trust_level":0},{"id":4528,"username":"Yi_Nuo","name":"Yi Nuo","avatar_template":"/user_avatar/discuss.meshery.io/yi_nuo/{size}/3769_2.png","trust_level":0},{"id":4523,"username":"Suthar_Bhavesh","name":"Suthar Bhavesh","avatar_template":"/user_avatar/discuss.meshery.io/suthar_bhavesh/{size}/3759_2.png","trust_level":1},{"id":4316,"u
```

**File**: `docs/meetings/2026/week-of-09-17-2026/Bhuvan Somisetty` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+Hello This is BHUVAN SOMISETTY
+Engineering Student
```

**File**: `docs/meetings/2026/week-of-09-24-2026/ANSHU-attendence.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+HII I’m Anshu Raj Biosyi, a Computer Science student from India, specializing in AI and Machine Learning. I’m passionate about building practical technology that solves real-world problems, with a focus on AI/ML, full-stack development, and intelligent systems. I enjoy learning by building projects, exploring new technologies, and collaborating with others to turn ideas into impactful products.
+
+
```

**File**: `docs/meetings/2026/week-of-09-24-2026/Ajay-Mathuriya.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Hi, I'm Ajay Mathuriya, a third-year BTech student from Madhya Pradesh, also pursuing a minor at IIT Ropar. I work on AI/ML - I've shipped 13+ PRs to Open Directory at Varnan Labs, including an OSS launch orchestrator and AI agent skills. I build and self-host my own AI agent tooling. I'm here to learn the cloud-native side of things properly and contribute to Meshery - excited to be part of the community!
```

**File**: `docs/meetings/2026/week-of-09-24-2026/Akarsh Dhingra` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Hi, my name is Akarsh Dhingra. I'm a full-stack developer from India. Here are my [GitHub](https://github.com/akarsh-dhingra) and [X](https://x.com/AakarshDhi43154) profiles—please give me a follow!
```

---

### Incident Patch 9: `7f72772c` (2026-09-23)
**Commit Message**: [Docs] Fix invalid --components flag syntax and typos in system commands guide

Signed-off-by: Ali Mahmood <alimahmoodrana82@gmail.com>

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

#### Recent Merged Pull Requests:
- **PR #22166** (closed): [Server] Apply search and order when listing local performance profiles (@Raghavcommercialwinner)
- **PR #22157** (2026-09-30): fix(server): keep the deep-link query on the post-login redirect (@jijillery)
- **PR #22128** (2026-09-28): [Server] Report missing keys register column instead of seeding zero keys silently (@jijillery)
- **PR #22127** (2026-09-28): [Server] Fix SeedKeys Done-race dropping last key, buffered errors, and panicking-save leak (@jijillery)
- **PR #22126** (2026-09-28): [Docs] Add introduction for Atreo Pramanick (@AtreoP)
- **PR #22122** (2026-09-28): [Docs] Add Priyanshu Shrivastava introduction (@priyanshuuu777)
- **PR #22121** (2026-09-28): fix(server): keep a SeedKeys goroutine panic from terminating the server at boot (@jijillery)
- **PR #22120** (2026-09-28): test(server): assert SaveEnvironment refuses the same request with 403 when the provider denies it (@jijillery)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): getsentry/MobileBuildMCP

> **Canonical Artifact**: `07_PROJECT_LEARNING/getsentry-mobilebuildmcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/getsentry/MobileBuildMCP](https://github.com/getsentry/MobileBuildMCP))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:43:44.002Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `getsentry/MobileBuildMCP`
- **Description**: A Model Context Protocol (MCP) server and CLI that provides tools for agent use when working on iOS and macOS projects.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6449 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/_utils.py`
```
"""Shared utilities for warden-sweep scripts."""
from __future__ import annotations

import json
import os
import subprocess
from typing import Any


def run_cmd(
    args: list[str], timeout: int = 30, cwd: str | None = None
) -> subprocess.CompletedProcess[str]:
    """Run a command and return the result."""
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=cwd,
    )


def run_cmd_stdout(
    args: list[str], timeout: int = 30, cwd: str | None = None
) -> str | None:
    """Run a command and return stripped stdout, or None on failure."""
    try:
        result = run_cmd(args, timeout=timeout, cwd=cwd)
        return result.stdout.strip() if result.returncode == 0 else None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def read_json(path: str) -> dict[str, Any] | None:
    """Read a JSON file and return parsed object, or None on failure."""
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def write_json(path: str, data: dict[str, Any]) -> None:
    """Write a dict to a JSON file with trailing newline."""
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def read_jsonl(path: str) -> list[dict[str, Any]]:
    """Read a JSONL file and return list of parsed objects."""
    entries: list[dict[str, Any]] = []
    if not os.path.exists(path):
        return entries
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def severity_badge(severity: str) -> str:
    """Return a markdown-friendly severity indicator."""
    badges = {
        "critical": "**CRITICAL**",
        "high": "**HIGH**",
        "medium": "MEDIUM",
        "low": "LOW",
        "info": "info",
    }
    return badges.get(severity, severity)


def pr_number_from_url(pr_url: str) -> str:
    """Extract the PR or issue number from a GitHub URL's last path segment."""
    return pr_url.rstrip("/").split("/")[-1]


def ensure_github_label(name: str, color: str, description: str) -> None:
    """Create a GitHub label if it doesn't exist (idempotent)."""
    try:
        subprocess.run(
            [
                "gh", "label", "create", name,
                "--color", color,
                "--description", description,
            ],
            capture_output=True,
            timeout=15,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

```

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/create_issue.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Warden Sweep: Create tracking issue.

Creates a GitHub issue summarizing the sweep results after verification
but before patching. Gives every PR a parent to reference and gives
reviewers a single place to see the full picture.

Usage:
    uv run create_issue.py <sweep-dir>

Stdout: JSON with issueUrl and issueNumber
Stderr: Progress lines

Idempotent: if issueUrl already exists in manifest, skips creation.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _utils import (  # noqa: E402
    ensure_github_label,
    pr_number_from_url,
    read_json,
    read_jsonl,
    severity_badge,
    write_json,
)


def build_issue_body(
    run_id: str,
    scan_index: list[dict[str, Any]],
    all_findings: list[dict[str, Any]],
    verified: list[dict[str, Any]],
    rejected: list[dict[str, Any]],
) -> str:
    """Build the GitHub issue body markdown."""
    files_scanned = sum(1 for e in scan_index if e.get("status") == "complete")
    files_timed_out = sum(
        1 for e in scan_index
        if e.get("status") == "error" and e.get("error") == "timeout"
    )
    files_errored = sum(
        1 for e in scan_index
        if e.get("status") == "error" and e.get("error") != "timeout"
    )

    # Collect unique skills from scan index
    skills: set[str] = set()
    for entry in scan_index:
        for skill in entry.get("skills", []):
            skills.add(skill)

    lines = [
        f"## Warden Sweep `{run_id}`",
        "",
        "| Metric | Count |",
        "|--------|-------|",
        f"| Files scanned | {files_scanned} |",
        f"| Files timed out | {files_timed_out} |",
        f"| Files errored | {files_errored} |",
        f"| Total findings | {len(all_findings)} |",
        f"| Verified | {len(verified)} |",
        f"| Rejected | {len(rejected)} |",
        "",
    ]

    if verified:
        lines.append("### Verified Findings")
        lines.append("")
        lines.append("| Severity | Skill | File | Title |")
        lines.append("|----------|-------|------|-------|")
        for f in verified:
            sev = severity_badge(f.get("severity", "info"))
            skill = f.get("skill", "")
            file_path = f.get("file", "")
            start_line = f.get("startLine")
            location = f"{file_path}:{start_line}" if start_line else file_path
            title = f.get("title", "")
            lines.append(f"| {sev} | {skill} | `{location}` | {title} |")
        lines.append("")

    if skills:
        lines.append("### Skills Run")
        lines.append("")
        lines.append(", ".join(sorted(skills)))
        lines.append("")

    lines.append("> Generated by Warden Sweep. PRs referencing this issue will appear below.")

    return "\n".join(lines) + "\n"


def create_github_issue(title: str, body: str) -> dict[str, Any]:
    """Create a GitHub issue with the warden label. Returns issueUrl and issueNumber."""
    ensure_github_label("warden", "5319E7", "Automated fix from Warden Sweep")

    result = subprocess.run(
        [
            "gh", "issue", "create",
            "--label", "warden",
            "--title", title,
            "--body", body,
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode != 0:
        raise RuntimeError(f"gh issue create failed: {result.stderr.strip()}")

    issue_url = result.stdout.strip()
    try:
        issue_number = int(pr_number_from_url(issue_url))
    except (ValueError, IndexError):
        raise RuntimeError(f"Could not parse issue number from gh output: {issue_url}")

    return {"issueUrl": issue_url, "issueNumber": issue_number}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Warden Sweep: Create tracking issue"
    )
    parser.add_argument("sweep_dir", help="Path to the sweep directory")
    args = parser.parse_args()

    sweep_dir = args.sweep_dir
    data_dir = os.path.join(sweep_dir, "data")
    manifest_path = os.path.join(data_dir, "manifest.json")

    if not os.path.isdir(sweep_dir):
        print(
            json.dumps({"error": f"Sweep directory not found: {sweep_dir}"}),
            file=sys.stdout,
        )
        sys.exit(1)

    manifest = read_json(manifest_path) or {}

    # Idempotency: if issue already exists, return existing values
    if manifest.get("issueUrl"):
        output = {
            "issueUrl": manifest["issueUrl"],
            "issueNumber": manifest.get("issueNumber", 0),
        }
        print(json.dumps(output))
        return

    run_id = manifest.get("runId", "unknown")

    # Read sweep data
    scan_index = read_jsonl(os.path.join(data_dir, "scan-index.jsonl"))
    all_findings = read_jsonl(os.path.join(data_dir, "all-findings.jsonl"))
    verified = read_jsonl(os.path.join(data_dir, "verified.jsonl"))
    rejected = read_jsonl(os.path.join(data_dir, "rejected.jsonl"))

    files_scanned = sum(1 for e in scan_index if e.get("status") == "complete")

    # Build issue
    title = f"Warden Sweep {run_id}: {len(verified)} findings across {files_scanned} files"
    body = build_issue_body(run_id, scan_index, all_findings, verified, rejected)

    print("Creating tracking issue...", file=sys.stderr)
    result = create_github_issue(title, body)
    print(f"Created issue: {result['issueUrl']}", file=sys.stderr)

    # Write issueUrl and issueNumber to manifest
    manifest["issueUrl"] = result["issueUrl"]
    manifest["issueNumber"] = result["issueNumber"]
    manifest.setdefault("phases", {})["issue"] = "complete"
    write_json(manifest_path, manifest)

    print(json.dumps(result))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/extract_findings.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Extract individual findings from warden JSONL log files.

Usage:
    python extract_findings.py <log-path-or-directory> -o <output.jsonl>
    python extract_findings.py .warden/logs/ --scan-index data/scan-index.jsonl -o findings.jsonl

Reads warden JSONL logs (one skill record per line, summary as last line),
extracts each finding as a standalone record with a stable ID, and writes
one finding per line to the output file.

Finding ID format: <skill>-<sha256(title+path+line)[:8]>
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any


def generate_finding_id(skill: str, title: str, path: str, line: int | None) -> str:
    """Generate a stable, deterministic finding ID."""
    raw = f"{title}:{path}:{line or 0}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:8]
    # Sanitize skill name for use in ID
    safe_skill = skill.replace("/", "-").replace(" ", "-").lower()
    return f"{safe_skill}-{digest}"


def parse_jsonl_log(log_path: str) -> list[dict[str, Any]]:
    """Parse a warden JSONL log file and extract individual findings.

    Each non-summary line has the shape:
    {
      "run": {...},
      "skill": "...",
      "findings": [{...}, ...],
      ...
    }

    The last line is a summary record with "type": "summary" which we skip.
    """
    findings = []
    try:
        with open(log_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Skip summary records
                if record.get("type") == "summary":
                    continue

                skill = record.get("skill", "unknown")
                run_meta = record.get("run", {})
                record_findings = record.get("findings", [])

                for finding in record_findings:
                    location = finding.get("location", {})
                    file_path = location.get("path", "")
                    start_line = location.get("startLine")
                    end_line = location.get("endLine")

                    finding_id = generate_finding_id(
                        skill=skill,
                        title=finding.get("title", ""),
                        path=file_path,
                        line=start_line,
                    )

                    normalized = {
                        "findingId": finding_id,
                        "file": file_path,
                        "skill": skill,
                        "severity": finding.get("severity", "info"),
                        "confidence": finding.get("confidence"),
                        "title": finding.get("title", ""),
                        "description": finding.get("description", ""),
                        "verification": finding.get("verification"),
                        "location": {
                            "path": file_path,
                            "startLine": start_line,
                            "endLine": end_line,
                        },
                        "suggestedFix": finding.get("suggestedFix"),
                        "logPath": log_path,
                        "runId": run_meta.get("runId", ""),
                    }

                    findings.append(normalized)

    except (OSError, IOError) as e:
        print(f"Error reading {log_path}: {e}", file=sys.stderr)

    return findings


def collect_log_paths(source: str, scan_index: str | None = None) -> list[str]:
    """Collect log file paths from a directory or scan index."""
    paths: list[str] = []

    if scan_index and os.path.exists(scan_index):
        # Read log paths from scan-index.jsonl
        seen = set()
        total_entries = 0
        missing = 0
        with open(scan_index) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("status") != "complete":
                    continue
                total_entries += 1
                log_path = entry.get("logPath", "")
                if log_path and log_path not in seen:
                    seen.add(log_path)
                    if os.path.isfile(log_path):
                        paths.append(log_path)
                    else:
                        missing += 1
        if missing > 0:
            print(
                f"Warning: {missing} log path(s) from scan-index not found on disk",
                file=sys.stderr,
            )
        # Only use scan-index results if we actually found logs;
        # fall through to source directory otherwise
        if paths:
            return paths
        if total_entries > 0:
            print(
                "Warning: scan-index had entries but no valid log paths; "
                "falling back to source directory",
                file=sys.stderr,
            )

    source_path = Path(source)
    if source_path.is_file():
        return [str(source_path)]

    if source_path.is_dir():
        for f in sorted(source_path.glob("*.jsonl")):
            paths.append(str(f))
        return paths

    print(f"Source not found: {source}", file=sys.stderr)
    return paths


def main():
    parser = argparse.ArgumentParser(
        description="Extract findings from warden JSONL logs"
    )
    parser.add_argument(
        "source",
        help="Path to a JSONL log file or directory of log files",
    )
    parser.add_argument(
        "-o", "--output",
        required=True,
        help="Output path for normalized findings JSONL",
    )
    parser.add_argument(
        "--scan-index",
        help="Path to scan-index.jsonl (uses log paths from completed scans)",
    )
    args = parser.parse_args()

    log_paths = collect_log_paths(args.source, args.scan_index)
    if not log_paths:
        print("No log files found.", file=sys.stderr)
        sys.exit(1)

    all_findings: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for log_path in log_paths:
        findings = parse_jsonl_log(log_path)
        for f in findings:
            fid = f["findingId"]
            if fid not in seen_ids:
                seen_ids.add(fid)
                all_findings.append(f)

    # Write output
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w") as out:
        for finding in all_findings:
            out.write(json.dumps(finding) + "\n")

    print(
        json.dumps({
            "logsProcessed": len(log_paths),
            "findingsExtracted": len(all_findings),
            "outputPath": args.output,
        })
    )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/find_reviewers.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Find top git contributors for a file to use as PR reviewers.

Usage:
    python find_reviewers.py <file-path>
    python find_reviewers.py src/foo.ts

Output: JSON to stdout with GitHub usernames of top 2 contributors
from the last 12 months.

{"reviewers": ["user1", "user2"]}

If no contributors found or mapping fails, returns empty list.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _utils import run_cmd_stdout as run_cmd  # noqa: E402


def get_top_authors(file_path: str, count: int = 2) -> list[str]:
    """Get top N author emails for a file from git log (last 12 months)."""
    output = run_cmd([
        "git", "log",
        "--format=%ae",
        "--since=12 months ago",
        "--", file_path,
    ])

    if not output:
        return []

    # Count occurrences of each email
    email_counts: dict[str, int] = {}
    for email in output.splitlines():
        email = email.strip()
        if email:
            email_counts[email] = email_counts.get(email, 0) + 1

    # Sort by count descending
    sorted_emails = sorted(email_counts.items(), key=lambda x: x[1], reverse=True)

    return [email for email, _ in sorted_emails[:count]]


def email_to_github_username(email: str) -> str | None:
    """Try to map a git email to a GitHub username.

    Extracts from noreply emails directly. For other emails,
    uses the GitHub search-by-email API via gh CLI.
    """
    # Handle GitHub noreply emails directly
    if email.endswith("@users.noreply.github.com"):
        # Format: 12345+username@users.noreply.github.com
        # or: username@users.noreply.github.com
        local = email.split("@")[0]
        if "+" in local:
            return local.split("+", 1)[1]
        return local

    # gh api handles URL encoding; pass email directly in the query
    output = run_cmd([
        "gh", "api", f"search/users?q={email}+in:email",
        "--jq", ".items[0].login",
    ])
    return output if output else None


def get_current_github_user() -> str | None:
    """Get the currently authenticated GitHub username."""
    output = run_cmd(["gh", "api", "/user", "--jq", ".login"])
    return output if output else None


def main():
    parser = argparse.ArgumentParser(
        description="Find top git contributors for PR reviewer assignment"
    )
    parser.add_argument("file_path", help="Path to the file to find reviewers for")
    parser.add_argument(
        "--count", type=int, default=2,
        help="Number of reviewers to find (default: 2)",
    )
    args = parser.parse_args()

    current_user = get_current_github_user()

    # Request extra candidates to compensate for self-exclusion
    fetch_count = args.count + 1 if current_user else args.count
    emails = get_top_authors(args.file_path, fetch_count)
    if not emails:
        print(json.dumps({"reviewers": [], "note": "No recent authors found"}))
        return

    reviewers: list[str] = []
    for email in emails:
        username = email_to_github_username(email)
        if username and username != current_user:
            reviewers.append(username)

    print(json.dumps({"reviewers": reviewers[:args.count]}))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/generate_report.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Generate summary.md and report.json from a completed sweep.

Usage:
    python generate_report.py <sweep-dir>

Reads the data/ subdirectory for all-findings.jsonl, verified.jsonl,
rejected.jsonl, patches.jsonl, and security/index.jsonl, then produces:
  - <sweep-dir>/summary.md
  - <sweep-dir>/data/report.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _utils import read_json, read_jsonl, severity_badge  # noqa: E402


def generate_summary_md(
    manifest: dict[str, Any],
    scan_index: list[dict[str, Any]],
    all_findings: list[dict[str, Any]],
    verified: list[dict[str, Any]],
    rejected: list[dict[str, Any]],
    patches: list[dict[str, Any]],
    security_index: list[dict[str, Any]],
) -> str:
    """Generate the summary.md content."""
    run_id = manifest.get("runId", "unknown")
    started_at = manifest.get("startedAt", "unknown")
    repo = manifest.get("repo", "unknown")
    completed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    files_scanned = sum(1 for e in scan_index if e.get("status") == "complete")
    files_timed_out = sum(
        1 for e in scan_index
        if e.get("status") == "error" and e.get("error") == "timeout"
    )
    files_errored = sum(
        1 for e in scan_index
        if e.get("status") == "error" and e.get("error") != "timeout"
    )

    prs_created = sum(1 for p in patches if p.get("status") == "created")
    prs_failed = sum(1 for p in patches if p.get("status") == "error")

    # Severity breakdown of verified findings
    by_severity: dict[str, int] = {}
    for f in verified:
        sev = f.get("severity", "info")
        by_severity[sev] = by_severity.get(sev, 0) + 1

    lines = [
        f"# Warden Sweep: `{run_id}`",
        "",
        f"**Repo**: {repo}",
        f"**Started**: {started_at}",
        f"**Completed**: {completed_at}",
        "",
        "## Stats",
        "",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Files scanned | {files_scanned} |",
        f"| Files timed out | {files_timed_out} |",
        f"| Files errored | {files_errored} |",
        f"| Total findings | {len(all_findings)} |",
        f"| Verified | {len(verified)} |",
        f"| Rejected | {len(rejected)} |",
        f"| PRs created | {prs_created} |",
        f"| PRs failed | {prs_failed} |",
        f"| Security findings | {len(security_index)} |",
        "",
    ]

    if by_severity:
        lines.append("### By Severity")
        lines.append("")
        for sev in ["critical", "high", "medium", "low", "info"]:
            count = by_severity.get(sev, 0)
            if count > 0:
                lines.append(f"- {severity_badge(sev)}: {count}")
        lines.append("")

    # Security callout
    if security_index:
        lines.append("## Security Findings")
        lines.append("")
        lines.append("The following findings are security-related and may need priority review:")
        lines.append("")
        lines.append("| ID | Severity | Skill | File | Title |")
        lines.append("|----|----------|-------|------|-------|")
        for sf in security_index:
            fid = sf.get("findingId", "")
            sev = severity_badge(sf.get("severity", "info"))
            skill = sf.get("skill", "")
            filepath = sf.get("file", "")
            title = sf.get("title", "")
            lines.append(f"| `{fid}` | {sev} | {skill} | `{filepath}` | {title} |")
        lines.append("")

    # Verified findings table
    if verified:
        lines.append("## Verified Findings")
        lines.append("")
        lines.append("| ID | Severity | Skill | File | Title | PR |")
        lines.append("|----|----------|-------|------|-------|-----|")

        # Build patches lookup
        pr_lookup: dict[str, str] = {}
        for p in patches:
            if p.get("status") == "created" and p.get("findingId"):
                pr_lookup[p["findingId"]] = p.get("prUrl", "")

        for f in verified:
            fid = f.get("findingId", "")
            sev = severity_badge(f.get("severity", "info"))
            skill = f.get("skill", "")
            filepath = f.get("file", "")
            title = f.get("title", "")
            pr_url = pr_lookup.get(fid, "")
            pr_link = f"[PR]({pr_url})" if pr_url else "-"
            lines.append(f"| `{fid}` | {sev} | {skill} | `{filepath}` | {title} | {pr_link} |")
        lines.append("")

    # Rejected findings summary
    if rejected:
        lines.append(f"## Rejected Findings ({len(rejected)})")
        lines.append("")
        lines.append("These findings were evaluated and determined to be false positives.")
        lines.append("See `data/rejected.jsonl` for details.")
        lines.append("")

    lines.append("---")
    lines.append(f"*Generated by Warden Sweep `{run_id}`*")

    return "\n".join(lines) + "\n"


def generate_report_json(
    manifest: dict[str, Any],
    scan_index: list[dict[str, Any]],
    all_findings: list[dict[str, Any]],
    verified: list[dict[str, Any]],
    rejected: list[dict[str, Any]],
    patches: list[dict[str, Any]],
    security_index: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate the report.json data."""
    run_id = manifest.get("runId", "unknown")
    completed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    files_scanned = sum(1 for e in scan_index if e.get("status") == "complete")
    files_timed_out = sum(
        1 for e in scan_index
        if e.get("status") == "error" and e.get("error") == "timeout"
    )
    files_errored = sum(
        1 for e in scan_index
        if e.get("status") == "error" and e.get("error") != "timeout"
    )
    prs_created = sum(1 for p in patches if p.get("status") == "created")
    prs_failed = sum(1 for p in patches if p.get("status") == "error")

    # Count verify errors (findings in all but not in verified or rejected)
    verified_ids = {f["findingId"] for f in verified if "findingId" in f}
    rejected_ids = {f["findingId"] for f in rejected if "findingId" in f}
    all_ids = {f["findingId"] for f in all_findings if "findingId" in f}
    verify_errors = len(all_ids - verified_ids - rejected_ids)

    return {
        "runId": run_id,
        "completedAt": completed_at,
        "scan": {
            "filesScanned": files_scanned,
            "filesTimedOut": files_timed_out,
            "filesErrored": files_errored,
            "totalFindings": len(all_findings),
        },
        "verify": {
            "verified": len(verified),
            "rejected": len(rejected),
            "errors": verify_errors,
        },
        "patch": {
            "prsCreated": prs_created,
            "prsFailed": prs_failed,
        },
        "security": {
            "count": len(security_index),
        },
        "prs": [
            {
                "findingId": p.get("findingId", ""),
                "url": p.get("prUrl", ""),
                "severity": next(
                    (f.get("severity", "") for f in verified if f.get("findingId") == p.get("findingId")),
                    "",
                ),
            }
            for p in patches
            if p.get("status") == "created"
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate sweep summary and report"
    )
    parser.add_argument("sweep_dir", help="Path to the sweep output directory")
    args = parser.parse_args()

    sweep_dir = args.sweep_dir
    data_dir = os.path.join(sweep_dir, "data")

    # Read inputs
    manifest = read_json(os.path.join(data_dir, "manifest.json")) or {}
    scan_index = read_jsonl(os.path.join(data_dir, "scan-index.jsonl"))
    all_findings = read_jsonl(os.path.join(data_dir, "all-findings.jsonl"))
    ve
```

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/index_prs.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Warden Sweep: Index existing PRs for deduplication.

Fetches open warden-labeled PRs via gh, identifies file overlap with
verified findings, and caches diffs for overlapping PRs.

Usage:
    uv run index_prs.py <sweep-dir>

Stdout: JSON summary (for LLM consumption)
Stderr: Progress lines

Side effects:
    - Creates data/existing-prs.json
    - Creates data/pr-diffs/<number>.diff for overlapping PRs
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _utils import read_jsonl, run_cmd  # noqa: E402


def fetch_warden_prs(sweep_dir: str) -> list[dict[str, Any]]:
    """Fetch open PRs with the warden label."""
    result = run_cmd(
        [
            "gh", "pr", "list",
            "--label", "warden",
            "--state", "open",
            "--json", "number,title,url,files",
            "--limit", "100",
        ],
        timeout=30,
    )

    if result.returncode != 0:
        print(f"Warning: gh pr list failed: {result.stderr}", file=sys.stderr)
        return []

    try:
        prs = json.loads(result.stdout)
    except json.JSONDecodeError:
        print("Warning: Failed to parse gh pr list output", file=sys.stderr)
        return []

    # Save raw PR data
    prs_path = os.path.join(sweep_dir, "data", "existing-prs.json")
    with open(prs_path, "w") as f:
        json.dump(prs, f, indent=2)
        f.write("\n")

    return prs


def build_file_index(
    prs: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Build a file-to-PR lookup from the PR list."""
    index: dict[str, list[dict[str, Any]]] = {}

    for pr in prs:
        pr_info = {
            "number": pr.get("number"),
            "title": pr.get("title", ""),
            "url": pr.get("url", ""),
        }
        files = pr.get("files") or []
        for file_entry in files:
            # gh returns files as objects with "path" key
            if isinstance(file_entry, dict):
                path = file_entry.get("path", "")
            else:
                path = str(file_entry)
            if path:
                index.setdefault(path, []).append(pr_info)

    return index


def get_verified_files(sweep_dir: str) -> set[str]:
    """Get the set of files that have verified findings."""
    verified_path = os.path.join(sweep_dir, "data", "verified.jsonl")
    entries = read_jsonl(verified_path)
    return {e.get("file", "") for e in entries if e.get("file")}


def fetch_pr_diff(pr_number: int, sweep_dir: str) -> bool:
    """Fetch and cache a PR diff. Returns True on success."""
    diff_path = os.path.join(
        sweep_dir, "data", "pr-diffs", f"{pr_number}.diff"
    )

    # Skip if already cached
    if os.path.exists(diff_path):
        return True

    result = run_cmd(
        ["gh", "pr", "diff", str(pr_number)],
        timeout=30,
    )

    if result.returncode != 0:
        print(
            f"Warning: Failed to fetch diff for PR #{pr_number}: {result.stderr}",
            file=sys.stderr,
        )
        return False

    with open(diff_path, "w") as f:
        f.write(result.stdout)

    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Warden Sweep: Index existing PRs for dedup"
    )
    parser.add_argument("sweep_dir", help="Path to the sweep directory")
    args = parser.parse_args()

    sweep_dir = args.sweep_dir

    if not os.path.isdir(sweep_dir):
        print(
            json.dumps({"error": f"Sweep directory not found: {sweep_dir}"}),
            file=sys.stdout,
        )
        sys.exit(1)

    # Ensure pr-diffs directory exists
    os.makedirs(os.path.join(sweep_dir, "data", "pr-diffs"), exist_ok=True)

    # Fetch open warden PRs
    print("Fetching open warden-labeled PRs...", file=sys.stderr)
    prs = fetch_warden_prs(sweep_dir)
    print(f"Found {len(prs)} open warden PR(s)", file=sys.stderr)

    # Build file index
    file_index = build_file_index(prs)

    # Find overlap with verified findings
    verified_files = get_verified_files(sweep_dir)
    overlapping_prs: set[int] = set()

    for vfile in verified_files:
        if vfile in file_index:
            for pr_info in file_index[vfile]:
                overlapping_prs.add(pr_info["number"])

    # Fetch diffs for overlapping PRs
    diffs_cached = 0
    for pr_number in sorted(overlapping_prs):
        print(f"Caching diff for PR #{pr_number}...", file=sys.stderr)
        if fetch_pr_diff(pr_number, sweep_dir):
            diffs_cached += 1

    # Build output file index (only for files that have verified findings)
    output_file_index: dict[str, list[dict[str, Any]]] = {}
    for vfile in verified_files:
        if vfile in file_index:
            output_file_index[vfile] = file_index[vfile]

    # Output summary
    output = {
        "totalPRs": len(prs),
        "overlappingPRs": len(overlapping_prs),
        "fileIndex": output_file_index,
        "diffsCached": diffs_cached,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/organize.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Warden Sweep: Organize phase.

Identifies security findings, creates security indexes, labels security PRs,
updates finding reports with PR links, generates summary report, and
finalizes the manifest.

Usage:
    uv run organize.py <sweep-dir>

Stdout: JSON summary (for LLM consumption)
Stderr: Progress lines

Side effects:
    - Creates security/index.jsonl with security findings
    - Copies security finding .md files to security/
    - Creates "security" label on GitHub
    - Labels security PRs with "security"
    - Appends PR links to findings/*.md
    - Runs generate_report.py for summary.md and report.json
    - Updates manifest phases.organize to "complete"
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _utils import ensure_github_label, pr_number_from_url, read_json, read_jsonl, write_json  # noqa: E402


SECURITY_SKILL_PATTERNS = [
    "security-review",
    "owasp-review",
    "security-audit",
]


def is_security_skill(skill_name: str) -> bool:
    """Check if a skill name indicates a security-related skill."""
    name_lower = skill_name.lower()
    if "security" in name_lower:
        return True
    return name_lower in SECURITY_SKILL_PATTERNS


def severity_label(severity: str) -> str:
    """Format a severity string for inline display in issue comments."""
    if not severity:
        return ""
    if severity in ("critical", "high"):
        return f" (**{severity.upper()}**)"
    return f" ({severity.upper()})"


def identify_security_findings(
    sweep_dir: str,
) -> list[dict[str, Any]]:
    """Find security-related verified findings and write security/index.jsonl."""
    verified = read_jsonl(os.path.join(sweep_dir, "data", "verified.jsonl"))

    security_findings: list[dict[str, Any]] = []
    for finding in verified:
        skill = finding.get("skill", "")
        if is_security_skill(skill):
            entry = {
                "findingId": finding.get("findingId", ""),
                "skill": skill,
                "severity": finding.get("severity", "info"),
                "file": finding.get("file", ""),
                "title": finding.get("title", ""),
            }
            security_findings.append(entry)

    # Write security index
    security_dir = os.path.join(sweep_dir, "security")
    os.makedirs(security_dir, exist_ok=True)
    index_path = os.path.join(security_dir, "index.jsonl")
    with open(index_path, "w") as f:
        for entry in security_findings:
            f.write(json.dumps(entry) + "\n")

    return security_findings


def copy_security_findings(
    sweep_dir: str, security_findings: list[dict[str, Any]]
) -> None:
    """Copy security finding .md files to security/ directory."""
    findings_dir = os.path.join(sweep_dir, "findings")
    security_dir = os.path.join(sweep_dir, "security")

    for finding in security_findings:
        fid = finding.get("findingId", "")
        src = os.path.join(findings_dir, f"{fid}.md")
        dst = os.path.join(security_dir, f"{fid}.md")
        if os.path.exists(src):
            shutil.copy2(src, dst)


def create_security_label() -> None:
    """Create the security label on GitHub (idempotent)."""
    ensure_github_label("security", "D93F0B", "Security-related changes")


def label_security_prs(
    sweep_dir: str, security_findings: list[dict[str, Any]]
) -> int:
    """Add "security" label to PRs for security findings. Returns count labeled."""
    patches = read_jsonl(os.path.join(sweep_dir, "data", "patches.jsonl"))
    security_ids = {f.get("findingId", "") for f in security_findings}

    labeled = 0
    for patch in patches:
        if patch.get("status") != "created":
            continue
        if patch.get("findingId", "") not in security_ids:
            continue

        pr_url = patch.get("prUrl", "")
        if not pr_url:
            continue

        try:
            result = subprocess.run(
                ["gh", "pr", "edit", pr_url, "--add-label", "security"],
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode == 0:
                labeled += 1
            else:
                print(
                    f"Warning: Failed to label PR {pr_url}: {result.stderr.strip()}",
                    file=sys.stderr,
                )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            print(
                f"Warning: Failed to label PR {pr_url}",
                file=sys.stderr,
            )

    return labeled


def _has_sweep_complete_comment(issue_url: str) -> bool:
    """Check if the tracking issue already has a 'Sweep Complete' comment."""
    try:
        result = subprocess.run(
            ["gh", "issue", "view", issue_url, "--json", "comments", "--jq",
             '.comments[].body | select(startswith("## Sweep Complete"))'],
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.returncode == 0 and result.stdout.strip() != ""
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def update_tracking_issue(sweep_dir: str) -> None:
    """Post a comment on the tracking issue with final PR results. Idempotent."""
    manifest = read_json(os.path.join(sweep_dir, "data", "manifest.json"))
    if not manifest:
        return

    issue_url = manifest.get("issueUrl")
    if not issue_url:
        return

    if _has_sweep_complete_comment(issue_url):
        print("Tracking issue already has completion comment, skipping.", file=sys.stderr)
        return

    patches = read_jsonl(os.path.join(sweep_dir, "data", "patches.jsonl"))
    verified = read_jsonl(os.path.join(sweep_dir, "data", "verified.jsonl"))
    security_index = read_jsonl(os.path.join(sweep_dir, "security", "index.jsonl"))

    # Build lookup from findingId to verified finding
    verified_lookup: dict[str, dict[str, Any]] = {}
    for f in verified:
        fid = f.get("findingId", "")
        if fid:
            verified_lookup[fid] = f

    security_ids = {f.get("findingId", "") for f in security_index}

    created = sum(1 for p in patches if p.get("status") == "created")
    existing = sum(1 for p in patches if p.get("status") == "existing")
    failed = sum(1 for p in patches if p.get("status") == "error")

    lines = [
        "## Sweep Complete",
        "",
        "| PRs Created | PRs Skipped (existing) | PRs Failed | Security Findings |",
        "|-------------|------------------------|------------|-------------------|",
        f"| {created} | {existing} | {failed} | {len(security_index)} |",
        "",
    ]

    # PR task list
    pr_entries = [p for p in patches if p.get("status") == "created" and p.get("prUrl")]
    if pr_entries:
        lines.append("### PRs")
        lines.append("")
        for p in pr_entries:
            fid = p.get("findingId", "")
            pr_number = pr_number_from_url(p.get("prUrl", ""))
            finding = verified_lookup.get(fid, {})
            title = finding.get("title", fid)
            sev = severity_label(finding.get("severity", ""))
            lines.append(f"- [ ] #{pr_number} - fix: {title}{sev}")
        lines.append("")

    # Security findings section
    security_prs = [
        p for p in patches
        if p.get("status") == "created"
        and p.get("findingId", "") in security_ids
        and p.get("prUrl")
    ]
    if security_prs:
        lines.append("### Security Findings")
        lines.append("")
        for p in security_prs:
            fid = p.get("findingId", "")
            pr_number = pr_number_from_url(p.get("prUrl", ""))
            finding = verified_lookup.get(fid, {})
            title = finding.get("title", fid)

```

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/scan.py`
```
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["tomli; python_version < '3.11'"]
# ///
"""
Warden Sweep: Scan phase.

Replaces Phase 0 (setup) and Phase 1 (scan) with a single script.
Generates a run ID, creates the sweep directory, checks dependencies,
creates the warden label, enumerates files, runs warden on each file,
writes scan-index.jsonl, and calls extract_findings.py.

Usage:
    uv run scan.py [file ...]
    uv run scan.py --sweep-dir .warden/sweeps/abc123
    uv run scan.py src/foo.ts src/bar.ts

Stdout: JSON summary (for LLM consumption)
Stderr: Progress lines as files complete
Exit codes: 0 = success, 1 = fatal, 2 = partial (some files errored)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib  # type: ignore[no-redefine]

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _utils import ensure_github_label, run_cmd  # noqa: E402


SUPPORTED_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
    ".rb", ".php", ".c", ".cpp", ".h", ".hpp", ".cs", ".swift",
    ".kt", ".scala", ".sh", ".bash", ".zsh",
}


def generate_run_id() -> str:
    """Generate a short random run ID."""
    return secrets.token_hex(4)


def check_dependencies() -> list[str]:
    """Check that required commands are available. Return list of missing."""
    import shutil
    return [cmd for cmd in ["warden", "gh", "git"] if shutil.which(cmd) is None]


def create_sweep_dir(sweep_dir: str) -> None:
    """Create the sweep directory structure."""
    for subdir in [
        "findings",
        "security",
        "data/verify",
        "data/logs",
        "data/pr-diffs",
    ]:
        os.makedirs(os.path.join(sweep_dir, subdir), exist_ok=True)


def write_manifest(sweep_dir: str, run_id: str) -> None:
    """Write the initial manifest.json."""
    repo = "unknown"
    try:
        result = run_cmd(["git", "remote", "get-url", "origin"])
        if result.returncode == 0 and result.stdout.strip():
            repo = result.stdout.strip()
        else:
            repo = os.path.basename(os.getcwd())
    except Exception:
        repo = os.path.basename(os.getcwd())

    manifest = {
        "runId": run_id,
        "startedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repo": repo,
        "phases": {
            "scan": "pending",
            "verify": "pending",
            "issue": "pending",
            "patch": "pending",
            "organize": "pending",
        },
    }

    manifest_path = os.path.join(sweep_dir, "data", "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def load_ignore_paths() -> list[str]:
    """Load ignorePaths from warden.toml defaults if present."""
    toml_path = "warden.toml"
    if not os.path.exists(toml_path):
        return []
    try:
        with open(toml_path, "rb") as f:
            config = tomllib.load(f)
        paths = config.get("defaults", {}).get("ignorePaths", [])
        return paths if isinstance(paths, list) else []
    except Exception:
        return []


def should_ignore(path: str, ignore_patterns: list[str]) -> bool:
    """Check if a path matches any ignore pattern (simple glob matching)."""
    if not ignore_patterns:
        return False

    from fnmatch import fnmatch

    for pattern in ignore_patterns:
        if fnmatch(path, pattern):
            return True
        # Handle ** patterns
        if "**" in pattern:
            # Convert ** glob to work with fnmatch
            simple = pattern.replace("**/", "*/")
            if fnmatch(path, simple):
                return True
            # Also try zero-directory match (** matches zero directories)
            collapsed = pattern.replace("**/", "")
            if fnmatch(path, collapsed):
                return True
            # Also try matching any subdirectory
            parts = path.split("/")
            glob_parts = pattern.split("/")
            if glob_parts[0] == "**":
                # Match from any point
                rest = "/".join(glob_parts[1:])
                for i in range(len(parts)):
                    if fnmatch("/".join(parts[i:]), rest):
                        return True
            elif glob_parts[-1].startswith("*"):
                # e.g., dist/** matches dist/anything, src/**/*.py matches src/x/y.py
                prefix = pattern.split("**")[0].rstrip("/")
                if path.startswith(prefix + "/") or path == prefix:
                    suffix = pattern.split("**")[-1]
                    if not suffix or suffix == "/":
                        # Pure prefix pattern like dist/** - any subpath matches
                        return True
                    # Has suffix like **/*.py - check with fnmatch on the remaining path
                    remaining = path[len(prefix) :].lstrip("/")
                    suffix_pattern = suffix.lstrip("/")
                    if fnmatch(remaining, suffix_pattern) or fnmatch(
                        remaining.split("/")[-1], suffix_pattern
                    ):
                        return True
    return False


def enumerate_files(
    specific_files: list[str] | None, ignore_patterns: list[str]
) -> list[str]:
    """Enumerate files to scan using git ls-files, filtered by extension."""
    if specific_files:
        return [f for f in specific_files if not should_ignore(f, ignore_patterns)]

    result = run_cmd(["git", "ls-files"])
    if result.returncode != 0:
        print(f"git ls-files failed: {result.stderr}", file=sys.stderr)
        return []

    files = []
    for line in result.stdout.splitlines():
        path = line.strip()
        if not path:
            continue

        # Filter by extension
        ext = os.path.splitext(path)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue

        # Filter by ignore patterns
        if should_ignore(path, ignore_patterns):
            continue

        files.append(path)

    return files


def load_completed_files(sweep_dir: str) -> set[str]:
    """Load already-completed files from scan-index.jsonl for incrementality."""
    index_path = os.path.join(sweep_dir, "data", "scan-index.jsonl")
    completed: set[str] = set()
    if not os.path.exists(index_path):
        return completed

    with open(index_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                if entry.get("status") == "complete":
                    completed.add(entry.get("file", ""))
            except json.JSONDecodeError:
                continue
    return completed


def log_path_for_file(sweep_dir: str, file_path: str) -> str:
    """Generate a deterministic log path for a file."""
    digest = hashlib.sha256(file_path.encode()).hexdigest()[:16]
    return os.path.join(sweep_dir, "data", "logs", f"{digest}.jsonl")


def scan_file(
    file_path: str, log_file: str, timeout: int = 600, skill: str | None = None
) -> dict[str, Any]:
    """Run warden on a single file. Returns scan-index entry."""
    try:
        cmd = [
            "warden", file_path,
            "--json", "--log",
            "--min-confidence", "off",
            "--fail-on", "off",
            "--quiet",
            "--output", log_file,
        ]
        if skill:
            cmd.extend(["--skill", skill])
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        # Check for warden failure
        if result.retur
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #514** (2026-09-17): **[Bug]: Simulator test fails on mixed iOS and watchOS test plans in 2.7.0**
  *Symptoms*: ### Bug Description  `simulator test` fails on XcodeBuildMCP 2.7.0 when the scheme's test plan contains both iOS and watchOS unit test targets. The same command, project and simulator pass on 2.6.2.  2.7.0 builds the project and discovers both tests, then the prepared test phase fails to resolve the requested iOS Simulator. Removing only the watchOS test target from the test plan makes 2.7.0 pass.  I have attached a standalone repro with three targets and no dependencies, package manager or code signing.  ### Debug Output  ``` ⚙️ XcodeBuildMCP Doctor     Generated: 2026-08-11T00:51:34.307Z    Server Version: 2.7.0    Output Mode: Redacted (default)  System Information   platform: darwin   release: 25.6.0   arch: arm64   cpus: 15 x Apple M5 Pro   memory: 48 GB   hostname: <redacted>   username: <redacted>   homedir: /Users/<redacted>   tmpdir: /var/folders/ql/lrbqh2nx1615gy6k6tptrdjc0000gn/T  Node.js Information   version: v26.7.0   execPath: /opt/homebrew/Cellar/node/26.7.0/bin/node   pid: 93030   ppid: 89346   platform: darwin   arch: arm64   cwd: /Users/<redacted>/Documents/Work/<redacted>   argv: /opt/homebrew/Cellar/node/26.7.0/bin/node /opt/homebrew/Cellar/xcodebuildmcp/2.7.0/libexec/build/doctor-cli.js  Process Tree   Running under Xcode: No   93030 (ppid 89346): node -- node /opt/homebrew/Cellar/xcodebuildmcp/2.7.0/libexec/build/doctor-cli.js   89346 (ppid 89339): /opt/homebrew/li -- /opt/homebrew/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/v
  **Post-Mortem & Fix Analysis**:
  > This issue has been inactive for 30 days. It will be closed in 7 days if no further activity occurs. Add a comment to keep it open, or apply the `no-stale` label.
  > Closing due to inactivity. If this is still relevant, please reopen or file a new issue with updated context.

- **Issue #478** (2026-07-21): **Warden: code-review**
  *Symptoms*: ## Warden Scheduled Scan Results  **Run:** 2026-07-20T07:18:39.308Z **Commit:** `60cfdc3`  ### Summary  | Severity | Count | |----------|-------| | Medium | 3 | | Low | 2 |  ### Findings  #### [`src/mcp/tools/macos/stop_mac_app.ts`](https://github.com/getsentry/XcodeBuildMCP/blob/60cfdc357ea6e91744ad85fe3bbe9d037a84d675/src/mcp/tools/macos/stop_mac_app.ts)  - `BHS-GHQ` **`pkill -f` with unvalidated appName may kill unintended processes** ([L68](https://github.com/getsentry/XcodeBuildMCP/blob/60cfdc357ea6e91744ad85fe3bbe9d037a84d675/src/mcp/tools/macos/stop_mac_app.ts#L68)) · medium   `pkill -f` matches the given pattern as a regex against the full command line of every process. Passing an arbitrary user-supplied `appName` here can match and terminate unrelated processes (e.g., a short/common name, or regex metacharacters), and could be abused to kill processes the caller shouldn't be able to target. Consider using `pkill -x` against the executable name, resolving the app to a specific PID first, or at least validating/escaping `appName`. - `ALJ-4DM` **`processId === 0` produces misleading log target** ([L60](https://github.com/getsentry/XcodeBuildMCP/blob/60cfdc357ea6e91744ad85fe3bbe9d037a84d675/src/mcp/tools/macos/stop_mac_app.ts#L60)) · low   On line 63, `params.processId ? \`PID ${params.processId}\` : params.appName!` uses a truthy check, which is inconsistent with the `!== undefined` checks on lines 59 and 68. If `processId === 0` (and `appName` is undefined), `target` b
  **Post-Mortem & Fix Analysis**:
  > I spot-checked the reported findings against `60cfdc3`. All four code paths match the description.  - `stop_mac_app.ts:68` passes raw `params.appName` into `pkill -f`. - `stop_mac_app.ts:63` uses a truthy check that skips `processId === 0`. - `axe-helpers.ts:82` throws instead of returning `null` when the configured source directory is missing or has no release build. - `domain-result-text.ts:1131` dereferences `activeProfile[key]` without guarding for `undefined`. - `bundle-id.ts` returns untrimmed spawn output, leaving a trailing newline for callers to handle.  Consider splitting these into individual issues so they can be assigned and closed independently.
  > Re-triaged each finding against current main and its callers:\n\n- The stop_mac_app finding is valid and more severe than the original report: substring matching can target unrelated processes, while zero or negative PIDs have unsafe kill semantics. I reopened the existing focused issue #306 and opened draft PR #484 with exact-name matching plus schema and execution-boundary PID validation.\n- The AXe helper throwing for an invalid configured source directory is intentional. Project configuration is required context, and the runtime contract is to fail loudly rather than silently fall back.\n- The activeProfile renderer claim is not reachable as reported; its callers only enter the field loop after establishing an active profile.\n- Bundle identifier output is normalized by every current caller. Trimming inside the helper could be a cleanup, but there is no demonstrated user-facing defect.\n\nThe actionable defect is now independently tracked by #306 and PR #484, so I am closing this a

- **Issue #466** (2026-07-22): **[Bug]:  xcodemake incremental builds fails**
  *Symptoms*: ### Bug Description   xcodemake incremental builds fail when derivedDataPath contains slashes; bundled xcodemake also inherits Git safe.bareRepository env  ## Summary  `xcodebuildmcp simulator build` fails when xcodemake incremental builds are enabled. The failure appears to come from the bundled `xcodemake` script constructing its capture log filename from the raw argument list, including `-derivedDataPath /Users/...`, which introduces `/` path separators into the log filename.  The current upstream `johnno1962/xcodemake` appears to have fixed this by writing logs under `.xcodemake/` with sanitized/truncated argument text plus an MD5 hash.  ## Environment  - xcodebuildmcp: 2.6.2 installed via Homebrew - macOS: Darwin - Xcode: 26.4 / build 17E192 - Workflow: `xcodebuildmcp simulator build` - Simulator: iPhone 12  ## Command  ```bash time xcodebuildmcp simulator build \   --scheme MyScheme \   --workspace-path MyWorkspace.xcworkspace  Also reproduced after unsetting Git config env vars:  time env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0 \   xcodebuildmcp simulator build \   --scheme MyScheme \   --workspace-path MyWorkspace.xcworkspace  Actual result  The build fails during xcodemake Makefile generation:  xcodemake is enabled and available, using it for incremental builds. Generating Makefile with xcodemake (first build may take longer)  iOS Simulator Build build failed for scheme MyScheme. Incremental build using xcodemake failed, suggest using preferXcod
  **Post-Mortem & Fix Analysis**:
  > I'm new at contributing to open source, but I'm going to take a stab at submitting a PR to resolve this issue. At the very least, I have forked this repo and will know if the update will solve my issue locally. 
  > Confirmed and addressed in draft PR #485, following the merged repair in `cameroncooke/xcodemake#2`.  The XcodeBuildMCP PR updates the checksum-pinned wrapper and always delegates incremental state validation to it. That fixes absolute DerivedData log names while avoiding a stale-Makefile hazard where retained logs from older argument sets could incorrectly select the single project `Makefile`.  Regression coverage executes the exact pinned Perl wrapper with fake `xcodebuild` and `make` binaries and verifies initial capture, matching reuse, changed-argument recapture, project freshness invalidation, and the external absolute DerivedData path from this report.  Local validation passed: lint, format, typecheck, build, the full unit suite (2,894 tests), focused wrapper tests, and independent review. Snapshot and smoke suites were not run because repository policy requires explicit approval.  The inherited Git security configuration and incorrect `xcodebuildmcp doctor` setup guidance are s
  > Progress update: the wrapper lifecycle fixes identified during review are merged upstream in [cameroncooke/xcodemake#3](https://github.com/cameroncooke/xcodemake/pull/3). Draft PR #485 is repinned to the merged commit and now includes regression coverage for Makefile reuse, `-configuration` preservation, and direct fallback. Local lint, typecheck, format, build, focused tests, and the full unit suite pass; the new CI cycle is running.

- **Issue #458** (2026-07-22): **snapshot_ui 'No translation object returned' persists across simulator reboots on iOS 26.5**
  *Symptoms*: ### Summary  `snapshot_ui` / `axe describe-ui` returns `Error: No translation object returned for simulator. This means you have likely specified a point onscreen that is invalid or invisible due to a fullscreen dialog` on **every** call, for **~40 minutes across multiple `shutdown`+`boot` cycles**, on a booted iOS 26.5 simulator where the app and SpringBoard are visibly healthy (screenshots work fine the whole time).  The documented recovery in the AXe skill / #290 (shutdown+boot, wait past the ~5–30s AX-daemon warmup window, use a fresh simulator) did **not** help. The actual root cause turned out to be a **wedged host `CoreSimulatorBridge` process**, and the fix is to kill it so it respawns:  ```sh pgrep -f "/usr/libexec/CoreSimulatorBridge" | xargs kill -9 sleep 2 axe describe-ui --udid <UDID>   # immediately returns a full tree again ```  After the `kill -9`, `describe-ui` / `snapshot_ui` returned a correct hierarchy on the very next call and stayed reliable for the rest of a long session (hundreds of subsequent taps/snapshots). No reboot, no data wipe, no fresh simulator needed.  This looks like the *"different bug"* the maintainer explicitly invited a reproduction of in #290:  > If you ever see the empty hierarchy persist longer than ~30 s on a freshly-booted sim, that would be a different bug than the one #312 was trying to address; we'd be interested in a reproduction.  One nuance vs #290: the symptom here is the **point-only error string** (`No translation object re
  **Post-Mortem & Fix Analysis**:
  > Confirmed and addressed in draft AXe PR cameroncooke/AXe#62: https://github.com/cameroncooke/AXe/pull/62\n\nThe implementation does not use the reported host-wide pgrep/kill -9 workaround. Frontmost hierarchy requests first poll through the observed accessibility warm-up window, then use simctl and launchctl to restart only user/foreground/com.apple.CoreSimulator.bridge for the affected simulator. Recovery is serialized per simulator across processes so overlapping requests share one attempt, while later independent requests can retry.\n\nPoint-based accessibility requests preserve the existing noTranslationObject behavior and never restart the bridge.\n\nValidation passed on Xcode 26.5 and Xcode 27 beta 4 (227 tests on each), plus manual frontmost-hierarchy and point-query validation on iOS 26.5. This issue should remain open until AXe is released and XcodeBuildMCP pins that release.
  > Closing as unable to reproduce on the current matching Xcode/iOS environment. The original observation may still have been real and environmental, but there is not enough evidence to ship automatic CoreSimulator service recovery in AXe.  The investigation used the exact AXe 1.7.1 release binary from this report, Xcode 26.5, iOS 26.5, and fresh iPhone 17 Pro Simulators. Twenty fresh-device trials covered idle operation, sustained Simulator CPU pressure, media-analysis pressure, and combined CPU/media pressure with concurrent AX hierarchy requests, screenshots, and app switching.  Across 1,115 hierarchy requests:  - 1,115 returned valid populated hierarchies; - zero returned `No translation object returned`; - zero produced other failures or timeouts; - zero screenshots failed.  A reproduction required the exact error to continue for at least 30 seconds while the Simulator, SpringBoard, Settings, and screenshots remained healthy. That condition did not occur.  The host was macOS 26.5.2 r

- **Issue #453** (2026-07-21): **Xcode 27 beta: UI automation still fails because bundled AXe looks for SimulatorKit under PrivateFrameworks**
  *Symptoms*: ### Summary  This is a fresh reproduction of the Xcode 27 beta `SimulatorKit.framework` path issue discussed in #446. I am opening a new issue because #446 is closed as not planned, but the current released XcodeBuildMCP still reports UI automation as available while `snapshot_ui` / AXe-backed UI automation fails at runtime.  Build, install, launch, and screenshots still work. The broken part is semantic UI automation / accessibility hierarchy capture / element-ref tapping.  ### Environment  - XcodeBuildMCP: `2.6.2` - AXe reported by doctor: `1.7.1` - Xcode: `Xcode 27.0`, build `27A5194q` - Active developer dir: `/Applications/Xcode-beta.app/Contents/Developer` - macOS/Darwin: `27.0.0` - Host arch: `arm64` - Client: Codex Desktop using XcodeBuildMCP tools  ### What works  These XcodeBuildMCP simulator actions worked against the same app/simulator:  - `build_run_sim` after passing `IPHONEOS_DEPLOYMENT_TARGET=16.4` - `install_app_sim` - `launch_app_sim` - `screenshot`  ### What fails  `mcp__xcodebuildmcp.snapshot_ui` fails after the app is launched:  ```text Failed to get accessibility hierarchy. CLIError(errorDescription: "Failed to load essential private frameworks: Attempting to load a file at path '/Applications/Xcode-beta.app/Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework', but it does not exist") ```  The framework exists in the Xcode 27 beta bundle at the new location:  ```text /Applications/Xcode-beta.app/Contents/SharedFrameworks/SimulatorKit.frame
  **Post-Mortem & Fix Analysis**:
  > @judiazm Did you find any workaround for this issue? I've stumbled across the same issue and haven’t found a solution by now.
  > Yes I'm working on it, a fix should be out shortly.  On Sat, Jul 18, 2026 at 9:18 AM Michael Biehler ***@***.***> wrote:  > *biehlermi* left a comment (getsentry/XcodeBuildMCP#453) > <https://github.com/getsentry/XcodeBuildMCP/issues/453#issuecomment-5010555932> > > @judiazm <https://github.com/judiazm> Did you find any workaround for > this issue? I've stumbled across the same issue and haven’t found a > solution by now. > > — > Reply to this email directly, view it on GitHub > <https://github.com/getsentry/XcodeBuildMCP/issues/453?email_source=notifications&email_token=AAEZ6SLDT5H6V6IQIXDBJST5FMXDVA5CNFSNUABFM5UWIORPF5TWS5BNNB2WEL2JONZXKZKDN5WW2ZLOOQXTKMBRGA2TKNJZGMZKM4TFMFZW63VGMFZXG2LHN2SWK5TFNZ2KYZTPN52GK4S7MNWGSY3L#issuecomment-5010555932>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/AAEZ6SNHIL6Y6JWKVIXKJLL5FMXDVAVCNFSNUABFKJSXA33TNF2G64TZHM4TINJVGUYTGNRRHNEXG43VMU5TINZSGIYTMNRRGQYKC5QC> > . > You are receiving this because you were ass
  > Verified and fixed on `main`.  AXe 1.7.1 reproduces the reported Xcode 27 failure because it only checks `Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework`. [AXe #60](https://github.com/cameroncooke/AXe/pull/60) added the Xcode 27 `Contents/SharedFrameworks` lookup while retaining the legacy fallback, and its validation included a successful `snapshot_ui` capture under Xcode 27.  [XcodeBuildMCP #479](https://github.com/getsentry/XcodeBuildMCP/pull/479) updates the bundled AXe pin to 1.8.0. I also verified that AXe 1.8.0 loads the simulator frameworks under Xcode 27 beta 4, where 1.7.1 fails with the exact error reported here.  The fix will be included in the next XcodeBuildMCP release. Until then, 2.6.2 remains affected; an explicit AXe 1.8.0 override is the workaround. 

- **Issue #447** (2026-07-12): **[Bug]: suppressWarnings doesn't work**
  *Symptoms*: ### Bug Description  We have a legacy app with many existing warnings, so I'm trying to filter them out of MCP or CLI responses for the agent to  avoid unecessarily filling up context. I've found that suppressWarnings: true in sessionDefaults doesn't work when using either the MCP or the CLI.   This is Claude's analysis of why - it's a different cause for each:  ### 1. The structured/domain result renderer ignores suppressWarnings (affects MCP runtime).  The text the MCP tool returns is produced by createStandardDiagnosticSections in build/utils/renderers/domain-result-text.js, which renders diagnostics.warnings unconditionally:  ```js if (diagnostics.warnings.length > 0) {   sections.push(     createSection(       `Warnings (${diagnostics.warnings.length}):`,       createMarkedDiagnosticLines(diagnostics.warnings, "\u26A0"),       { blankLineAfterTitle: true }     )   ); } ``` suppressWarnings is never threaded into domain-result-text.js / renderDomainResultTextItems. It is only honored in the streaming cli-text transcript path:  ```js // build/utils/renderers/cli-text-renderer.js case "compiler-warning": {   if (!suppressWarnings) {     groupedWarnings.push(item);   }   break; } ```  The diagnostics.warnings array is likewise always populated regardless of the flag:  ```js // build/utils/xcodebuild-domain-results.js function createBasicDiagnostics(state, didError, fallbackErrorMessages) {   const warnings = state.warnings.map((warning) => ({     message: warning.message,   

- **Issue #446** (2026-06-09): **[Bug]: Bundled AXe fails with Xcode 27 because SimulatorKit.framework moved to Contents/SharedFrameworks**
  *Symptoms*: ### Bug Description  When using XcodeBuildMCP with Xcode 27 beta, bundled AXe fails to load SimulatorKit.framework because it assumes the Xcode 26 framework location:  `Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework`  In Xcode 27, SimulatorKit.framework appears to have moved to:  `Contents/SharedFrameworks/SimulatorKit.framework`  This breaks simulator UI automation / AXe commands that load private simulator frameworks.  ### Debug Output  ``` Running XcodeBuildMCP Doctor (v2.6.2)... Collecting system information and checking dependencies...   ⚙️ XcodeBuildMCP Doctor     Generated: 2026-06-08T23:07:21.993Z    Server Version: 2.6.2    Output Mode: Redacted (default)  System Information   platform: darwin   release: 27.0.0   arch: arm64   cpus: 8 x Apple M3   memory: 16 GB   hostname: <redacted>   username: <redacted>   homedir: /Users/<redacted>   tmpdir: /var/folders/hf/y9db8py56j59mcnr_z039gkh0000gn/T  Node.js Information   version: v25.6.1   execPath: /opt/homebrew/Cellar/node/25.6.1/bin/node   pid: 12525   ppid: 12456   platform: darwin   arch: arm64   cwd: /Users/<redacted>/Documents/workspace/<redacted>   argv: /opt/homebrew/Cellar/node/25.6.1/bin/node /var/folders/hf/y9db8py56j59mcnr_z039gkh0000gn/T/tmp.CplNFz4qjg/_npx/0d0ba08c6c224614/node_modules/.bin/xcodebuildmcp-doctor  Process Tree   Running under Xcode: No   12525 (ppid 12456): node -- node /var/folders/hf/y9db8py56j59mcnr_z039gkh0000gn/T/tmp.CplNFz4qjg/_npx/0d0ba08c6c224614/node_modules/.bin/

- **Issue #440** (2026-06-03): **[Bug]: build_macOS is super slow and hangs my entire mac in Codex.**
  *Symptoms*: ### Bug Description  I usually tell codex to run build_macOS after modifications to verify work. This used to run within a few seconds until recently. It slows my entire Macbook to build whereas building manually via XCode gets done in seconds.  I added `tool_timeout_sec = 600` to codex's config.toml file like mentioned in the [documentation](https://www.xcodebuildmcp.com/docs/troubleshooting) (It wasn't stated under which section so I put it on the top of the file), codex still returns `timed out awaiting tools/call after 120s`.    ### Debug Output  ⚙️ XcodeBuildMCP Doctor     Generated: 2026-06-02T09:40:08.823Z    Server Version: 2.6.0    Output Mode: Redacted (default)  System Information   platform: darwin   release: 25.0.0   arch: arm64   cpus: 8 x Apple M2   memory: 16 GB   hostname: <redacted>   username: <redacted>   homedir: /Users/<redacted>   tmpdir: /var/folders/s0/0vsl_1hs23vgb5blg86p4khh0000gn/T  Node.js Information   version: v25.2.1   execPath: /opt/homebrew/Cellar/node/25.2.1/bin/node   pid: 14357   ppid: 14345   platform: darwin   arch: arm64   cwd: /Users/<redacted>   argv: /opt/homebrew/Cellar/node/25.2.1/bin/node /Users/<redacted>/.npm/_npx/99336612077b7094/node_modules/.bin/xcodebuildmcp-doctor  Process Tree   Running under Xcode: No   14357 (ppid 14345): node -- node /Users/<redacted>/.npm/_npx/99336612077b7094/node_modules/.bin/xcodebuildmcp-doctor   14345 (ppid 768): npm -- exec xcodebu npm exec xcodebuildmcp-doctor   768 (ppid 760): -zsh -- -zsh   76
  **Post-Mortem & Fix Analysis**:
  > Thanks @BarnoTD, a couple of questions:  1. Have you tried using the CLI i.e. `xcodebuildmcp macos build-and-run`? 2. If you can repo with the CLI can you run `xcodebuildmcp macos build-and-run --verbose --output raw` and see where it's getting stuck, also can you send me the output?  or  3. Can you send me a repro project?  
  > Thank you @cameroncooke. I was using XCodeBuildMCP for MCP-server-only, so now I installed xcodebuildmcp globally to try the commands given.   The build was fast and successful. I re-tried by removing the mcp from code, installing xcodebuildmcp (this time via NPM globally) and going through `xcodebuildmcp setup` and `xcodebuild init`. this seems to solve my problem.  **What I was doing wrong:** before, I manually inserted "enabled workflows" and other env variables into Codex's mcp settings because I didn't want to install cli (in order to get macOS workflow). 

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

### Incident Patch 1: `f0e977ec` (2026-09-23)
**Commit Message**: Merge pull request #539 from getsentry/itaybre/fix/release-workflow-failures

ci: Unblock tag-triggered release workflows

**File**: `.github/workflows/sentry.yml` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@ jobs:
       - uses: actions/checkout@v4
         with:
           fetch-depth: 0
+      - name: Setup Node.js
+        uses: actions/setup-node@v4
+        with:
+          node-version: '24'
       - name: Install dependencies
         run: npm ci
 
```

**File**: `src/snapshot-tests/__tests__/json-fixture-schema.test.ts` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ describe('structured JSON fixture schemas', () => {
         expect(result.rawText, probe.toolName).toContain(probe.expectedInfrastructureText);
       }
     }
-  }, 30_000);
+  }, 120_000);
 
   it('rejects the historical schema-valued additionalProperties input', () => {
     expect(() =>
```

---

### Incident Patch 2: `116ac5cb` (2026-09-23)
**Commit Message**: fix(scaffolding): Keep existing template repository names

The iOS and macOS template repositories and their release assets still use
the XcodeBuildMCP prefix. Renaming the repositories alone would not help,
because GitHub keeps existing release asset filenames and the download URL
is derived from the repository name. Restore the original names in the
template manager, tests, and local development configs so scaffolding keeps
working. Renaming the templates is a separate follow-up.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `.mcp.json` (modified, +2/-2)
```diff
@@ -14,8 +14,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "MOBILEBUILDMCP_SENTRY_DISABLED": "true",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "../../../MobileBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "../../../MobileBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "../../../XcodeBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "../../../XcodeBuildMCP-macOS-Template"
       }
     }
   }
```

**File**: `.vscode/launch.json` (modified, +2/-2)
```diff
@@ -36,8 +36,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
       },
       "sourceMaps": true,
       "outFiles": [
```

**File**: `.vscode/mcp.json` (modified, +4/-4)
```diff
@@ -11,8 +11,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
       }
     },
     "MobileBuildMCP-Dev": {
@@ -27,8 +27,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
       }
     }
   }
```

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ ESM TypeScript project (`type: module`). Key layers:
    ```
 4. Update `CHANGELOG.md` under `## [Unreleased]`
 5. Update documentation if adding or modifying features
-6. Clone and test against example projects (e.g., `MobileBuildMCP-iOS-Template`) when changes affect runtime behavior
+6. Clone and test against example projects (e.g., `XcodeBuildMCP-iOS-Template`) when changes affect runtime behavior
 7. Push and create a pull request with a clear description
 8. Link any related issues
 
```

**File**: `MobileBuildMCP.code-workspace` (modified, +2/-2)
```diff
@@ -4,10 +4,10 @@
       "path": ".",
     },
     {
-      "path": "../MobileBuildMCP-iOS-Template",
+      "path": "../XcodeBuildMCP-iOS-Template",
     },
     {
-      "path": "../MobileBuildMCP-macOS-Template",
+      "path": "../XcodeBuildMCP-macOS-Template",
     },
   ],
 }
```

---

### Incident Patch 3: `9e848ebc` (2026-08-02)
**Commit Message**: fix(mcp): Complete Codex schema compatibility

Expose Codex-compatible MCP wire schemas for record-shaped environment
inputs and arbitrary Xcode arguments while preserving object-based CLI
and domain inputs.

Add build-first, fail-closed per-tool contract fixtures for both public
schema modes and validate the complete static catalog.

Fixes #491

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@
 
 ## [Unreleased]
 
-### Fixed
+### Changed
 
-- Fixed Codex MCP tool-schema compatibility and added fail-closed static contract baselines for adaptive and full session-default schemas ([#491](https://github.com/getsentry/XcodeBuildMCP/issues/491)).
+- Dictionary-shaped MCP inputs now use client-compatible wire representations ([#491](https://github.com/getsentry/XcodeBuildMCP/issues/491)). The `env` and `testRunnerEnv` inputs on build, launch, test, and session-default tools are arrays of `{ "key": "...", "value": "..." }` entries, while `xcode_ide_call_tool.arguments` is a JSON object string. XcodeBuildMCP converts these values to their existing internal objects only after MCP input validation.
 
 ## [2.7.0]
 
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -47,10 +47,10 @@
     "license:check": "npx -y license-checker --production --onlyAllow 'MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Unlicense;FSL-1.1-MIT;BlueOak-1.0.0'",
     "knip": "knip",
     "test": "vitest run",
-    "test:tool-contracts": "npm run build && vitest run --config vitest.contract.config.ts",
     "posttest": "npm run test:warden-watchdog",
     "test:warden-watchdog": "node --test scripts/__tests__/warden-watchdog.test.mjs",
-    "test:schema-fixtures": "vitest run src/snapshot-tests/__tests__/json-fixture-schema.test.ts",
+    "test:schema-fixtures": "npm run build && vitest run --config vitest.schema.config.ts",
+    "test:schema-fixtures:update": "UPDATE_SNAPSHOTS=1 npm run test:schema-fixtures",
     "test:snapshot": "npm run build && vitest run --config vitest.snapshot.config.ts",
     "test:snapshots": "npm run test:snapshot",
     "test:snapshot:device": "npm run build && vitest run --config vitest.snapshot.config.ts src/snapshot-tests/__tests__/device.snapshot.test.ts && vitest run --config vitest.snapshot.config.ts src/snapshot-tests/__tests__/cli-json.snapshot.test.ts src/snapshot-tests/__tests__/mcp-json.snapshot.test.ts -t 'device workflow'",
```

**File**: `src/contract-tests/__tests__/mcp-tool-contracts.test.ts` (removed, +0/-32)
```diff
@@ -1,32 +0,0 @@
-import { execFile } from 'node:child_process';
-import { readFile } from 'node:fs/promises';
-import { fileURLToPath } from 'node:url';
-import { promisify } from 'node:util';
-import { describe, expect, it } from 'vitest';
-import type { McpToolContractFixture } from '../capture-mcp-tool-contracts.ts';
-
-const execFileAsync = promisify(execFile);
-const fixtureDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));
-
-async function readFixture(mode: 'adaptive' | 'full'): Promise<McpToolContractFixture> {
-  const contents = await readFile(`${fixtureDirectory}mcp-tool-contracts.${mode}.json`, 'utf8');
-  return JSON.parse(contents) as McpToolContractFixture;
-}
-
-async function captureFixture(mode: 'adaptive' | 'full'): Promise<McpToolContractFixture> {
-  const { stdout } = await execFileAsync(process.execPath, [
-    'build/contract-tests/capture-mcp-tool-contracts.js',
-    mode,
-  ]);
-  return JSON.parse(stdout) as McpToolContractFixture;
-}
-
-describe('MCP static tool contracts', () => {
-  it.each(['adaptive', 'full'] as const)(
-    'matches the fail-closed %s schema baseline',
-    async (mode) => {
-      await expect(captureFixture(mode)).resolves.toEqual(await readFixture(mode));
-    },
-    30_000,
-  );
-});
```

**File**: `src/contract-tests/capture-mcp-tool-contracts.ts` (removed, +0/-171)
```diff
@@ -1,171 +0,0 @@
-import { mkdir, writeFile } from 'node:fs/promises';
-import { join } from 'node:path';
-import { pathToFileURL } from 'node:url';
-import { Client } from '@modelcontextprotocol/sdk/client/index.js';
-import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
-import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
-import { getPackageRoot, loadManifest } from '../core/manifest/load-manifest.ts';
-import { initConfigStore } from '../utils/config-store.ts';
-import { getDefaultFileSystemExecutor } from '../utils/execution/index.ts';
-import { importToolModule } from '../core/manifest/import-tool-module.ts';
-import { registerMcpTool } from '../utils/tool-registry.ts';
-
-type ContractMode = 'adaptive' | 'full';
-
-interface ToolContract {
-  name: string;
-  inputSchema: unknown;
-  outputSchema: string | null;
-}
-
-export interface McpToolContractFixture {
-  mode: ContractMode;
-  tools: ToolContract[];
-  outputSchemas: Record<string, unknown>;
-}
-
-function sortJson(value: unknown): unknown {
-  if (Array.isArray(value)) {
-    return value.map(sortJson);
-  }
-  if (typeof value !== 'object' || value === null) {
-    return value;
-  }
-
-  return Object.fromEntries(
-    Object.entries(value)
-      .sort(([left], [right]) => left.localeCompare(right))
-      .map(([key, child]) => [key, sortJson(child)]),
-  );
-}
-
-function assertCodexCompatibleSchema(schema: unknown, label: string): void {
-  if (JSON.stringify(schema).includes('propertyNames')) {
-    throw new Error(`Codex-incompatible propertyNames keyword in ${label}`);
-  }
-}
-
-function hasSessionDefaultsStructuredOutput(value: unknown): boolean {
-  return (
-    typeof value === 'object' &&
-    value !== null &&
-    'schema' in value &&
-    value.schema === 'xcodebuildmcp.output.session-defaults'
-  );
-}
-
-function parseMode(args: string[]): ContractMode {
-  if (args.length < 1 || args.length > 2 || (args[0] !== 'adaptive' && args[0] !== 'full')) {
-    throw new Error('Usage: capture-mcp-tool-contracts <adaptive|full>');
-  }
-  if (args.length === 2 && args[1] !== '--write') {
-    throw new Error('Usage: capture-mcp-tool-contracts <adaptive|full> [--write]');
-  }
-  return args[0];
-}
-
-function outputSchemaReference(
-  outputSchema: { schema: string; version: string } | undefined,
-): string | null {
-  return outputSchema ? `${outputSchema.schema}@${outputSchema.version}` : null;
-}
-
-export async function captureMcpToolContracts(mode: ContractMode): Promise<McpToolContractFixture> {
-  await initConfigStore({
-    cwd: process.cwd(),
-    fs: getDefaultFileSystemExecutor(),
-    overrides: { disableSessionDefaults: mode === 'full' },
-  });
-
-  const manifest = loadManifest();
-  const server = new McpServer({ name: 'mcp-tool-contract-test', version: '1.0.0' });
-  const outputSchemaReferences = new Map<string, string | null>();
-
-  for (const tool of manifest.tools.values()) {
-    const module = await importToolModule(tool.module);
-    registerMcpTool(server, tool, module);
-    outputSchemaReferences.set(tool.names.mcp, outputSchemaReference(tool.outputSchema));
-  }
-
-  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
-  await server.connect(serverTransport);
-  const client = new Client({ name: 'mcp-tool-contract-client', version: '1.0.0' });
-  await client.connect(clientTransport);
-
-  try {
-    const result = await client.listTools();
-    const sessionDefaultsResult = await client.callTool({
-      name: 'session_set_defaults',
-      arguments: { env: { FEATURE_FLAG: mode } },
-    });
-    if (!hasSessionDefaultsStructuredOutput(sessionDefaultsResult.structuredContent)) {
-      throw new Error('session_set_defaults did not reach its domain result through MCP.');
-    }
-    const outputSchemas: Record<string, unknown> = {};
-    return {
-      mode,
-      tools: result.tools
-        .map((tool) => {
-          const outputSchemaReference = ou
```

**File**: `src/core/manifest/import-tool-module.ts` (modified, +3/-1)
```diff
@@ -11,6 +11,7 @@ import { getPackageRoot } from './load-manifest.ts';
 
 export interface ImportedToolModule {
   schema: ToolSchemaShape;
+  mcpSchema: ToolSchemaShape;
   handler: (params: Record<string, unknown>, ctx?: ToolHandlerContext) => Promise<unknown>;
 }
 
@@ -19,7 +20,7 @@ const moduleCache = new Map<string, ImportedToolModule>();
 /**
  * Import a tool module by its manifest module path.
  *
- * Accepts named exports only: `export const schema = ...` and `export const handler = ...`
+ * Accepts named exports only: `schema`, optional MCP-specific `mcpSchema`, and `handler`.
  *
  * @param moduleId - Extensionless module path (e.g., 'mcp/tools/simulator/build_sim')
  * @returns Imported tool module with schema and handler
@@ -50,6 +51,7 @@ export async function importToolModule(moduleId: string): Promise<ImportedToolMo
 
   const result: ImportedToolModule = {
     schema: mod.schema as ToolSchemaShape,
+    mcpSchema: (mod.mcpSchema ?? mod.schema) as ToolSchemaShape,
     handler: mod.handler as (
       params: Record<string, unknown>,
       ctx?: ToolHandlerContext,
```

---

### Incident Patch 4: `95b89f24` (2026-08-01)
**Commit Message**: fix(mcp): normalize Codex tool schemas

Normalize published MCP schemas for Codex compatibility and add build-first static contract baselines for adaptive and full session-default modes.

Fixes #491

**File**: `CHANGELOG.md` (modified, +6/-1)
```diff
@@ -1,5 +1,11 @@
 # Changelog
 
+## [Unreleased]
+
+### Fixed
+
+- Fixed Codex MCP tool-schema compatibility and added fail-closed static contract baselines for adaptive and full session-default schemas ([#491](https://github.com/getsentry/XcodeBuildMCP/issues/491)).
+
 ## [2.7.0]
 
 ### New! Xcode 27 Device Hub simulator support
@@ -749,4 +755,3 @@ Please note that the UI automation features are an early preview and currently i
 ## [v1.0.1] - 2025-04-02
 - Initial release of XcodeBuildMCP
 - Basic support for building iOS and macOS applications
-
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@
     "license:check": "npx -y license-checker --production --onlyAllow 'MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Unlicense;FSL-1.1-MIT;BlueOak-1.0.0'",
     "knip": "knip",
     "test": "vitest run",
+    "test:tool-contracts": "npm run build && vitest run --config vitest.contract.config.ts",
     "posttest": "npm run test:warden-watchdog",
     "test:warden-watchdog": "node --test scripts/__tests__/warden-watchdog.test.mjs",
     "test:schema-fixtures": "vitest run src/snapshot-tests/__tests__/json-fixture-schema.test.ts",
```

**File**: `src/contract-tests/__tests__/mcp-tool-contracts.test.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import { execFile } from 'node:child_process';
+import { readFile } from 'node:fs/promises';
+import { fileURLToPath } from 'node:url';
+import { promisify } from 'node:util';
+import { describe, expect, it } from 'vitest';
+import type { McpToolContractFixture } from '../capture-mcp-tool-contracts.ts';
+
+const execFileAsync = promisify(execFile);
+const fixtureDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));
+
+async function readFixture(mode: 'adaptive' | 'full'): Promise<McpToolContractFixture> {
+  const contents = await readFile(`${fixtureDirectory}mcp-tool-contracts.${mode}.json`, 'utf8');
+  return JSON.parse(contents) as McpToolContractFixture;
+}
+
+async function captureFixture(mode: 'adaptive' | 'full'): Promise<McpToolContractFixture> {
+  const { stdout } = await execFileAsync(process.execPath, [
+    'build/contract-tests/capture-mcp-tool-contracts.js',
+    mode,
+  ]);
+  return JSON.parse(stdout) as McpToolContractFixture;
+}
+
+describe('MCP static tool contracts', () => {
+  it.each(['adaptive', 'full'] as const)(
+    'matches the fail-closed %s schema baseline',
+    async (mode) => {
+      await expect(captureFixture(mode)).resolves.toEqual(await readFixture(mode));
+    },
+    30_000,
+  );
+});
```

**File**: `src/contract-tests/capture-mcp-tool-contracts.ts` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+import { mkdir, writeFile } from 'node:fs/promises';
+import { join } from 'node:path';
+import { pathToFileURL } from 'node:url';
+import { Client } from '@modelcontextprotocol/sdk/client/index.js';
+import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
+import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
+import { getPackageRoot, loadManifest } from '../core/manifest/load-manifest.ts';
+import { initConfigStore } from '../utils/config-store.ts';
+import { getDefaultFileSystemExecutor } from '../utils/execution/index.ts';
+import { importToolModule } from '../core/manifest/import-tool-module.ts';
+import { registerMcpTool } from '../utils/tool-registry.ts';
+
+type ContractMode = 'adaptive' | 'full';
+
+interface ToolContract {
+  name: string;
+  inputSchema: unknown;
+  outputSchema: string | null;
+}
+
+export interface McpToolContractFixture {
+  mode: ContractMode;
+  tools: ToolContract[];
+  outputSchemas: Record<string, unknown>;
+}
+
+function sortJson(value: unknown): unknown {
+  if (Array.isArray(value)) {
+    return value.map(sortJson);
+  }
+  if (typeof value !== 'object' || value === null) {
+    return value;
+  }
+
+  return Object.fromEntries(
+    Object.entries(value)
+      .sort(([left], [right]) => left.localeCompare(right))
+      .map(([key, child]) => [key, sortJson(child)]),
+  );
+}
+
+function assertCodexCompatibleSchema(schema: unknown, label: string): void {
+  if (JSON.stringify(schema).includes('propertyNames')) {
+    throw new Error(`Codex-incompatible propertyNames keyword in ${label}`);
+  }
+}
+
+function hasSessionDefaultsStructuredOutput(value: unknown): boolean {
+  return (
+    typeof value === 'object' &&
+    value !== null &&
+    'schema' in value &&
+    value.schema === 'xcodebuildmcp.output.session-defaults'
+  );
+}
+
+function parseMode(args: string[]): ContractMode {
+  if (args.length < 1 || args.length > 2 || (args[0] !== 'adaptive' && args[0] !== 'full')) {
+    throw new Error('Usage: capture-mcp-tool-contracts <adaptive|full>');
+  }
+  if (args.length === 2 && args[1] !== '--write') {
+    throw new Error('Usage: capture-mcp-tool-contracts <adaptive|full> [--write]');
+  }
+  return args[0];
+}
+
+function outputSchemaReference(
+  outputSchema: { schema: string; version: string } | undefined,
+): string | null {
+  return outputSchema ? `${outputSchema.schema}@${outputSchema.version}` : null;
+}
+
+export async function captureMcpToolContracts(mode: ContractMode): Promise<McpToolContractFixture> {
+  await initConfigStore({
+    cwd: process.cwd(),
+    fs: getDefaultFileSystemExecutor(),
+    overrides: { disableSessionDefaults: mode === 'full' },
+  });
+
+  const manifest = loadManifest();
+  const server = new McpServer({ name: 'mcp-tool-contract-test', version: '1.0.0' });
+  const outputSchemaReferences = new Map<string, string | null>();
+
+  for (const tool of manifest.tools.values()) {
+    const module = await importToolModule(tool.module);
+    registerMcpTool(server, tool, module);
+    outputSchemaReferences.set(tool.names.mcp, outputSchemaReference(tool.outputSchema));
+  }
+
+  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
+  await server.connect(serverTransport);
+  const client = new Client({ name: 'mcp-tool-contract-client', version: '1.0.0' });
+  await client.connect(clientTransport);
+
+  try {
+    const result = await client.listTools();
+    const sessionDefaultsResult = await client.callTool({
+      name: 'session_set_defaults',
+      arguments: { env: { FEATURE_FLAG: mode } },
+    });
+    if (!hasSessionDefaultsStructuredOutput(sessionDefaultsResult.structuredContent)) {
+      throw new Error('session_set_defaults did not reach its domain result through MCP.');
+    }
+    const outputSchemas: Record<string, unknown> = {};
+    return {
+      mode,
+      tools: result.tools
+        .map((tool) => {
+          const outputSchemaReference = ou
```

**File**: `src/core/structured-output-schema.ts` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@ import fs from 'node:fs';
 import path from 'node:path';
 import { z, type ZodType } from 'zod';
 import { getStructuredOutputSchemasDir } from './resource-root.ts';
+import { normalizeMcpSchemaForCodex } from '../utils/mcp-input-schema.ts';
 
 const SCHEMA_PATTERN = /^xcodebuildmcp\.output\.[a-z0-9-]+$/;
 const SCHEMA_VERSION_PATTERN = /^[0-9]+$/;
@@ -269,7 +270,7 @@ function getMcpOutputSchemaForRegistrationJson(ref: StructuredOutputSchemaRef):
     registrationSchema.$defs = defs;
   }
 
-  return registrationSchema;
+  return normalizeMcpSchemaForCodex(registrationSchema) as JsonObject;
 }
 
 export function getMcpOutputSchemaForRegistration(ref: StructuredOutputSchemaRef): McpOutputSchema {
```

---

### Incident Patch 5: `61795738` (2026-07-23)
**Commit Message**: fix(security): harden shell arguments and workflow permissions (#488)

* fix(security): Resolve CodeQL alerts

* fix(security): Guard shell executable option parsing

* fix(security): Use portable command relay

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@ on:
   pull_request:
     branches: [main]
 
+permissions:
+  contents: read
+
 jobs:
   build-and-test:
     runs-on: ubuntu-latest
```

**File**: `.github/workflows/sentry.yml` (modified, +3/-0)
```diff
@@ -4,6 +4,9 @@ on:
     tags:
       - 'v*'
 
+permissions:
+  contents: read
+
 jobs:
   release:
     runs-on: ubuntu-latest
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
 - Fixed `stop_mac_app` app-name targeting so it no longer terminates unrelated processes whose command lines contain the app name, and reject unsafe process IDs before execution ([#306](https://github.com/getsentry/XcodeBuildMCP/issues/306)).
 - Fixed incremental `xcodemake` builds when DerivedData uses an absolute path by updating the pinned wrapper and delegating Makefile reuse to it so its argument and freshness checks are always applied ([#466](https://github.com/getsentry/XcodeBuildMCP/issues/466)).
 - Fixed the scheduled Warden sweep to authenticate through OpenRouter and track the current v0 action release ([#483](https://github.com/getsentry/XcodeBuildMCP/issues/483)).
+- Fixed shell-mode command execution so environment-derived arguments never become shell source, and restricted CI and Sentry release workflows to read-only repository access.
 
 ## [2.6.2]
 
```

**File**: `src/utils/__tests__/command.test.ts` (modified, +62/-0)
```diff
@@ -1,7 +1,69 @@
+import { chmod, mkdtemp, rm, writeFile } from 'fs/promises';
+import { tmpdir } from 'os';
+import { join } from 'path';
 import { describe, expect, it } from 'vitest';
 import { __getRealCommandExecutor } from '../command.ts';
 
 describe('defaultExecutor', () => {
+  it('passes arguments literally when shell execution is requested', async () => {
+    const executor = __getRealCommandExecutor();
+    const argumentsWithMetacharacters = [
+      '$(printf injected)',
+      '`printf injected`',
+      'value; printf injected',
+      '$HOME',
+      "single'quote",
+    ];
+
+    const result = await executor(
+      ['/usr/bin/printf', '%s\n', ...argumentsWithMetacharacters],
+      'Shell Argument Test',
+      true,
+    );
+
+    expect(result).toMatchObject({
+      success: true,
+      exitCode: 0,
+      output: `${argumentsWithMetacharacters.join('\n')}\n`,
+    });
+  });
+
+  it('treats a leading-dash executable as a command name when shell execution is requested', async () => {
+    const executableDirectory = await mkdtemp(join(tmpdir(), 'xcodebuildmcp-command-'));
+    const executablePath = join(executableDirectory, '-c');
+    await writeFile(executablePath, '#!/bin/sh\nprintf "%s\\n" "$@"\n', 'utf8');
+    await chmod(executablePath, 0o700);
+
+    try {
+      const executor = __getRealCommandExecutor();
+      const result = await executor(['-c', 'literal argument'], 'Shell Executable Test', true, {
+        env: { PATH: executableDirectory },
+      });
+
+      expect(result).toMatchObject({
+        success: true,
+        exitCode: 0,
+        output: 'literal argument\n',
+      });
+    } finally {
+      await rm(executableDirectory, { recursive: true, force: true });
+    }
+  });
+
+  it('returns an exit response when a shell-mode executable is missing', async () => {
+    const executor = __getRealCommandExecutor();
+    const result = await executor(
+      ['xcodebuildmcp-command-that-does-not-exist'],
+      'Missing Shell Executable Test',
+      true,
+    );
+
+    expect(result).toMatchObject({
+      success: false,
+      exitCode: 127,
+    });
+  });
+
   it('settles after exit even when child close is delayed', async () => {
     const executor = __getRealCommandExecutor();
     const startedAt = Date.now();
```

**File**: `src/utils/command.ts` (modified, +8/-9)
```diff
@@ -18,17 +18,15 @@ async function defaultExecutor(
   opts?: CommandExecOptions,
   detached: boolean = false,
 ): Promise<CommandResponse> {
-  let escapedCommand = command;
-  if (useShell) {
-    const commandString = command.map((arg) => shellEscapeArg(arg)).join(' ');
+  let executable = command[0];
+  let args = command.slice(1);
 
-    escapedCommand = ['/bin/sh', '-c', commandString];
+  if (useShell) {
+    executable = '/usr/bin/env';
+    args = ['--', ...command];
   }
 
   return new Promise((resolve, reject) => {
-    let executable = escapedCommand[0];
-    let args = escapedCommand.slice(1);
-
     if (!useShell && executable === 'xcodebuild') {
       const xcrunPath = '/usr/bin/xcrun';
       if (existsSync(xcrunPath)) {
@@ -37,8 +35,9 @@ async function defaultExecutor(
       }
     }
 
-    const displayCommand =
-      useShell && escapedCommand.length === 3 ? escapedCommand[2] : [executable, ...args].join(' ');
+    const displayCommand = useShell
+      ? command.map((arg) => shellEscapeArg(arg)).join(' ')
+      : [executable, ...args].join(' ');
     log('debug', `Executing ${logPrefix ?? ''} command: ${displayCommand}`);
 
     const emitTranscript = transcriptEmitterStorage.getStore();
```

---

### Incident Patch 6: `bc54feeb` (2026-07-23)
**Commit Message**: Fix badge links in README.md

Updated badge links in the README file.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 A Model Context Protocol (MCP) server and CLI that provides tools for agent use when working on iOS and macOS projects.
 
 [![CI](https://github.com/getsentry/XcodeBuildMCP/actions/workflows/ci.yml/badge.svg)](https://github.com/getsentry/XcodeBuildMCP/actions/workflows/ci.yml)
-[![npm version](https://badge.fury.io/js/xcodebuildmcp.svg)](https://badge.fury.io/js/xcodebuildmcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/badge/node->=18.x-brightgreen.svg)](https://nodejs.org/) [![Xcode 16](https://img.shields.io/badge/Xcode-16-blue.svg)](https://developer.apple.com/xcode/) [![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/) [![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/getsentry/XcodeBuildMCP) [![AgentAudit Security](https://img.shields.io/badge/AgentAudit-Safe-brightgreen?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAxTDMgNXY2YzAgNS41NSAzLjg0IDEwLjc0IDkgMTIgNS4xNi0xLjI2IDktNi40NSA5LTEyVjVsLTktNHoiLz48L3N2Zz4=)](https://www.agentaudit.dev/skills/xcodebuildmcp)
+[![npm version](https://badge.fury.io/js/xcodebuildmcp.svg)](https://badge.fury.io/js/xcodebuildmcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/badge/node->=18.x-brightgreen.svg)](https://nodejs.org/) [![Xcode 16](https://img.shields.io/badge/Xcode-16-blue.svg)](https://developer.apple.com/xcode/) [![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/) [![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/getsentry/XcodeBuildMCP) [![AgentAudit Security](https://img.shields.io/badge/AgentAudit-Safe-brightgreen?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAxTDMgNXY2YzAgNS41NSAzLjg0IDEwLjc0IDkgMTIgNS4xNi0xLjI2IDktNi40NSA5LTEyVjVsLTktNHoiLz48L3N2Zz4=)](https://www.agentaudit.dev/skills/xcodebuildmcp) [![pkg.pr.new](https://pkg.pr.new/badge/getsentry/XcodeBuildMCP)](https://pkg.pr.new/~/getsentry/XcodeBuildMCP)
 
 ## Installation
 
```

---

### Incident Patch 7: `a7d367fa` (2026-07-22)
**Commit Message**: fix(macos): prevent stop_mac_app from terminating unrelated processes (#484)

* fix(macos): Target app processes exactly

Stop macOS apps by exact executable name instead of matching the app name against every process argument. Reject empty app names and unsafe process IDs before command execution.

Fixes #306

* fix(macos): Validate process IDs at execution boundary

Reject unsafe process IDs before constructing or invoking kill, even when callers bypass the typed-tool schema.

Refs #306

* fix: reject unsafe macOS process IDs in schema

* fix: support long macOS app names

* fix(macos): Match app names by process name

Use killall instead of full-command regular expressions so later arguments cannot select unrelated processes.

Refs #306

* test(macos): Clarify long app name coverage

Name the unit test for its command-construction boundary; host-level validation covers actual process selection.

Refs #306

* fix(macos): Sanitize invalid stop artifacts

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
 - Fixed iOS scaffold orientation and device-family settings, LLDB command isolation and argument escaping, run-destination parsing without an active scheme, concurrent working-directory mutations, blocking physical-device name lookup, and unverified `xcodemake` downloads ([#459](https://github.com/getsentry/XcodeBuildMCP/issues/459)).
 - Fixed simulator UI launching and keyboard controls to prefer Xcode 27's Device Hub when available, with Simulator.app as the legacy fallback.
+- Fixed `stop_mac_app` app-name targeting so it no longer terminates unrelated processes whose command lines contain the app name, and reject unsafe process IDs before execution ([#306](https://github.com/getsentry/XcodeBuildMCP/issues/306)).
 - Fixed incremental `xcodemake` builds when DerivedData uses an absolute path by updating the pinned wrapper and delegating Makefile reuse to it so its argument and freshness checks are always applied ([#466](https://github.com/getsentry/XcodeBuildMCP/issues/466)).
 
 ## [2.6.2]
```

**File**: `src/mcp/tools/macos/__tests__/stop_mac_app.test.ts` (modified, +90/-28)
```diff
@@ -1,6 +1,11 @@
 import { describe, it, expect } from 'vitest';
 import { schema, handler, stop_mac_appLogic } from '../stop_mac_app.ts';
-import { allText, runLogic } from '../../../../test-utils/test-helpers.ts';
+import {
+  allText,
+  createMockToolHandlerContext,
+  runLogic,
+} from '../../../../test-utils/test-helpers.ts';
+import { createMockExecutor, createNoopExecutor } from '../../../../test-utils/mock-executors.ts';
 
 describe('stop_mac_app plugin', () => {
   describe('Export Field Validation (Literal)', () => {
@@ -17,28 +22,53 @@ describe('stop_mac_app plugin', () => {
 
       // Test invalid inputs
       expect(schema.appName.safeParse(null).success).toBe(false);
+      expect(schema.appName.safeParse('').success).toBe(false);
       expect(schema.processId.safeParse('not-number').success).toBe(false);
       expect(schema.processId.safeParse(null).success).toBe(false);
+      expect(schema.processId.safeParse(0).success).toBe(false);
+      expect(schema.processId.safeParse(-1).success).toBe(false);
+      expect(schema.processId.safeParse(1.5).success).toBe(false);
+      expect(schema.processId.safeParse(Number.NaN).success).toBe(false);
+      expect(schema.processId.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
     });
   });
 
   describe('Input Validation', () => {
     it('should return exact validation error for missing parameters', async () => {
-      const mockExecutor = async () => ({ success: true, output: '', process: {} as any });
-      const result = await runLogic(() => stop_mac_appLogic({}, mockExecutor));
+      const result = await runLogic(() => stop_mac_appLogic({}, createNoopExecutor()));
 
       expect(result.isError).toBe(true);
       expect(allText(result)).toContain('appName or processId');
     });
+
+    it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
+      'should reject unsafe process ID %s at the execution boundary',
+      async (processId) => {
+        const calls: string[][] = [];
+        const executor = createMockExecutor({ onExecute: (command) => calls.push(command) });
+        const { ctx, result, run } = createMockToolHandlerContext();
+
+        await run(() => stop_mac_appLogic({ processId }, executor));
+
+        expect(result.isError()).toBe(true);
+        expect(result.text()).toContain('processId must be a positive safe integer');
+        const structuredResult = ctx.structuredOutput?.result;
+        expect(structuredResult?.kind).toBe('stop-result');
+        if (structuredResult?.kind !== 'stop-result') {
+          throw new Error('Expected stop-result structured output.');
+        }
+        expect(structuredResult.artifacts).toEqual({ appName: '' });
+        expect(calls).toHaveLength(0);
+      },
+    );
   });
 
   describe('Command Generation', () => {
     it('should generate correct command for process ID', async () => {
-      const calls: any[] = [];
-      const mockExecutor = async (command: string[]) => {
-        calls.push({ command });
-        return { success: true, output: '', process: {} as any };
-      };
+      const calls: string[][] = [];
+      const mockExecutor = createMockExecutor({
+        onExecute: (command) => calls.push(command),
+      });
 
       await runLogic(() =>
         stop_mac_appLogic(
@@ -50,35 +80,69 @@ describe('stop_mac_app plugin', () => {
       );
 
       expect(calls).toHaveLength(1);
-      expect(calls[0].command).toEqual(['kill', '1234']);
+      expect(calls[0]).toEqual(['kill', '1234']);
     });
 
-    it('should generate correct command for app name', async () => {
-      const calls: any[] = [];
-      const mockExecutor = async (command: string[]) => {
-        calls.push({ command });
-        return { success: true, output: '', process: {} as any };
-      };
+    it('should target app names by literal process name', async () => {
+      const calls: string[][] = [];
+      const mockExecutor = createMockExecutor({
+        onExecute: (command) =>
```

**File**: `src/mcp/tools/macos/stop_mac_app.ts` (modified, +21/-7)
```diff
@@ -14,8 +14,13 @@ import {
 } from '../../../utils/app-lifecycle-results.ts';
 
 const stopMacAppSchema = z.object({
-  appName: z.string().optional(),
-  processId: z.number().optional(),
+  appName: z.string().min(1).optional(),
+  processId: z
+    .number()
+    .int()
+    .positive()
+    .refine(Number.isSafeInteger, 'processId must be a positive safe integer.')
+    .optional(),
 });
 
 type StopMacAppParams = z.infer<typeof stopMacAppSchema>;
@@ -54,20 +59,29 @@ export function createStopMacAppExecutor(
   executor: CommandExecutor,
 ): NonStreamingExecutor<StopMacAppParams, StopMacAppResult> {
   return async (params) => {
-    const artifacts = createStopMacAppArtifacts(params);
-
     if (!params.appName && params.processId === undefined) {
-      return buildStopFailure(artifacts, 'Either appName or processId must be provided.');
+      return buildStopFailure({ appName: '' }, 'Either appName or processId must be provided.');
     }
 
-    const target = params.processId ? `PID ${params.processId}` : params.appName!;
+    if (
+      params.processId !== undefined &&
+      (!Number.isSafeInteger(params.processId) || params.processId <= 0)
+    ) {
+      return buildStopFailure(
+        { appName: params.appName ?? '' },
+        'processId must be a positive safe integer.',
+      );
+    }
+
+    const artifacts = createStopMacAppArtifacts(params);
+    const target = params.processId !== undefined ? `PID ${params.processId}` : params.appName!;
     log('info', `Stopping macOS app: ${target}`);
 
     try {
       const command =
         params.processId !== undefined
           ? ['kill', String(params.processId)]
-          : ['pkill', '-f', params.appName!];
+          : ['killall', '--', params.appName!];
       const result = await executor(command, 'Stop macOS App');
 
       if (!result.success) {
```

**File**: `src/smoke-tests/__tests__/e2e-mcp-device-macos.test.ts` (modified, +3/-3)
```diff
@@ -20,7 +20,7 @@ beforeAll(async () => {
       'xctrace list devices': { success: true, output: 'No devices found.' },
       open: { success: true, output: '' },
       kill: { success: true, output: '' },
-      pkill: { success: true, output: '' },
+      killall: { success: true, output: '' },
       'defaults read': { success: true, output: 'io.sentry.MyApp' },
       PlistBuddy: { success: true, output: 'io.sentry.MyApp' },
       xcresulttool: { success: true, output: '{}' },
@@ -328,7 +328,7 @@ describe('MCP Device and macOS Tool Invocation (e2e)', () => {
       expect(commandStrs.some((c) => c.includes('kill') && c.includes('54321'))).toBe(true);
     });
 
-    it('stop_mac_app captures pkill command with appName', async () => {
+    it('stop_mac_app captures killall command with appName', async () => {
       harness.resetCapturedCommands();
       const result = await harness.client.callTool({
         name: 'stop_mac_app',
@@ -338,7 +338,7 @@ describe('MCP Device and macOS Tool Invocation (e2e)', () => {
       expectContent(result);
 
       const commandStrs = harness.capturedCommands.map((c) => c.command.join(' '));
-      expect(commandStrs.some((c) => c.includes('MyMacApp'))).toBe(true);
+      expect(commandStrs.some((c) => c === 'killall -- MyMacApp')).toBe(true);
     });
 
     it('get_mac_app_path captures xcodebuild showBuildSettings command', async () => {
```

---

### Incident Patch 8: `931b57ac` (2026-07-22)
**Commit Message**: fix(build): support absolute DerivedData paths with xcodemake (#485)

* fix(build): Support hashed xcodemake logs

Update the pinned xcodemake revision so absolute DerivedData paths produce safe capture log filenames. Match the new logs by their argument hash before deciding whether to run make directly.

Fixes #466

* fix(build): Delegate incremental builds to xcodemake

Always invoke the pinned wrapper so it owns Makefile argument and freshness validation before delegating to make.

Refs #466

* test(build): Cover pinned xcodemake lifecycle

Execute the checksum-verified pinned wrapper with fake build tools and verify capture, reuse, argument invalidation, and project freshness behavior.

Refs #466

* fix(build): preserve xcodemake lifecycle state

Repin the bundled wrapper to the upstream lifecycle fixes and add regression coverage for long configuration arguments, direct fallback, and Makefile reuse.

* test(build): Resolve xcodemake fixture by module

Keep the wrapper lifecycle test independent of the process working directory.

* test(build): Stabilize wrapper mtime assertion

Compare the observed Makefile timestamp with the explicit sentinel using a filesystem-resolution tol

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
 - Fixed iOS scaffold orientation and device-family settings, LLDB command isolation and argument escaping, run-destination parsing without an active scheme, concurrent working-directory mutations, blocking physical-device name lookup, and unverified `xcodemake` downloads ([#459](https://github.com/getsentry/XcodeBuildMCP/issues/459)).
 - Fixed simulator UI launching and keyboard controls to prefer Xcode 27's Device Hub when available, with Simulator.app as the legacy fallback.
+- Fixed incremental `xcodemake` builds when DerivedData uses an absolute path by updating the pinned wrapper and delegating Makefile reuse to it so its argument and freshness checks are always applied ([#466](https://github.com/getsentry/XcodeBuildMCP/issues/466)).
 
 ## [2.6.2]
 
```

**File**: `src/utils/__tests__/build-utils-xcodemake.test.ts` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { createMockExecutor } from '../../test-utils/mock-executors.ts';
+
+const { executeXcodemakeCommandMock } = vi.hoisted(() => ({
+  executeXcodemakeCommandMock: vi.fn(),
+}));
+
+vi.mock('../xcodemake.ts', () => ({
+  isXcodemakeEnabled: () => true,
+  isXcodemakeAvailable: () => Promise.resolve(true),
+  executeXcodemakeCommand: executeXcodemakeCommandMock,
+}));
+
+import { executeXcodeBuildCommand } from '../build-utils.ts';
+import { XcodePlatform } from '../xcode.ts';
+
+describe('build-utils xcodemake lifecycle', () => {
+  let projectDirectory: string;
+
+  beforeEach(() => {
+    projectDirectory = mkdtempSync(path.join(tmpdir(), 'xcodebuildmcp-xcodemake-'));
+    writeFileSync(path.join(projectDirectory, 'Makefile'), 'all:\n\t@true\n');
+    executeXcodemakeCommandMock.mockResolvedValue({ success: true, output: 'BUILD SUCCEEDED' });
+  });
+
+  afterEach(() => {
+    rmSync(projectDirectory, { recursive: true, force: true });
+    vi.clearAllMocks();
+  });
+
+  it('delegates existing Makefile validation to xcodemake for external DerivedData', async () => {
+    const workspacePath = path.join(projectDirectory, 'MyWorkspace.xcworkspace');
+    const derivedDataPath =
+      '/Users/developer/Library/Developer/XcodeBuildMCP/DerivedData/MyWorkspace-57a542dedf16';
+    const executorCall = vi.fn();
+    const executor = createMockExecutor({ onExecute: executorCall });
+
+    const result = await executeXcodeBuildCommand(
+      {
+        scheme: 'MyScheme',
+        configuration: 'Debug',
+        workspacePath,
+        derivedDataPath,
+      },
+      {
+        platform: XcodePlatform.iOSSimulator,
+        simulatorId: 'SIMULATOR-UDID',
+        logPrefix: 'iOS Simulator Build',
+      },
+      false,
+      'build',
+      executor,
+    );
+
+    expect(result.isError).toBeFalsy();
+    expect(executorCall).not.toHaveBeenCalled();
+    expect(executeXcodemakeCommandMock).toHaveBeenCalledWith(
+      projectDirectory,
+      [
+        '-workspace',
+        workspacePath,
+        '-scheme',
+        'MyScheme',
+        '-configuration',
+        'Debug',
+        '-skipMacroValidation',
+        '-destination',
+        'platform=iOS Simulator,id=SIMULATOR-UDID',
+        '-collect-test-diagnostics',
+        'never',
+        '-derivedDataPath',
+        derivedDataPath,
+        'build',
+      ],
+      'iOS Simulator Build',
+    );
+  });
+
+  it('uses the current working directory when no project or workspace path is provided', async () => {
+    const derivedDataPath =
+      '/Users/developer/Library/Developer/XcodeBuildMCP/DerivedData/MyScheme-57a542dedf16';
+    const executorCall = vi.fn();
+    const executor = createMockExecutor({ onExecute: executorCall });
+
+    const result = await executeXcodeBuildCommand(
+      {
+        scheme: 'MyScheme',
+        derivedDataPath,
+      },
+      {
+        platform: XcodePlatform.iOSSimulator,
+        simulatorId: 'SIMULATOR-UDID',
+        logPrefix: 'iOS Simulator Build',
+      },
+      false,
+      'build',
+      executor,
+    );
+
+    expect(result.isError).toBeFalsy();
+    expect(executorCall).not.toHaveBeenCalled();
+    expect(executeXcodemakeCommandMock).toHaveBeenCalledWith(
+      process.cwd(),
+      expect.arrayContaining(['-derivedDataPath', derivedDataPath]),
+      'iOS Simulator Build',
+    );
+  });
+});
```

**File**: `src/utils/__tests__/fixtures/xcodemake/README.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Pinned xcodemake test data
+
+`xcodemake-75f47d4b69c1604cb886ab37d348c2c245d18329` is an exact, unmodified copy of
+[`cameroncooke/xcodemake` at commit `75f47d4b69c1604cb886ab37d348c2c245d18329`](https://github.com/cameroncooke/xcodemake/blob/75f47d4b69c1604cb886ab37d348c2c245d18329/xcodemake).
+
+SHA-256: `0934f784661f8b295f51064b8e94659c986ca25affc5062f20d5210ae0e25201`
+
+The wrapper regression test verifies this checksum against the production pin before execution. Do
+not edit the fixture independently of `XCODEMAKE_COMMIT` and `XCODEMAKE_SHA256`.
```

**File**: `src/utils/__tests__/fixtures/xcodemake/xcodemake-75f47d4b69c1604cb886ab37d348c2c245d18329` (added, +605/-0)
```diff
@@ -0,0 +1,605 @@
+#!/usr/bin/env perl -w
+#
+# "xcodemake"
+#
+# Derived from: https://github.com/johnno1962/xcodemake
+#
+# A short script to convert xcodebuild output into a Makefile.
+# Once a Makefile has been generated you can use the much
+# faster "make" command for most builds instead of launching
+# the more ponderous xcodebuild for each iteration. Sure,
+# this could be rewritten in python and use ninja instead.
+#
+# xcodebuild re-run if its arguments change or make fails or project modified.
+# Makefile re-generated if script modified or xcodebuild recaptured.
+#
+
+use IO::File;
+use strict;
+use JSON::PP;
+use Digest::MD5 qw(md5_hex);
+
+my @original_ARGV = @ARGV;
+
+# --- Global Utility Functions ---
+sub escape {
+    # Escape characters in $_[1] listed in $_[0] with a backslash
+    $_[1] =~ s/([$_[0]])/\\$1/g;
+}
+sub unescape {
+    # Unescape characters in $_[1] listed in $_[0] preceded by a backslash
+    $_[1] =~ s/\\([$_[0]])/$1/g;
+}
+
+# escape literal '$' for make --> '$$'
+sub dollarEscape {
+    # $_[0] is the variable passed by reference implicitly
+    $_[0] =~ s/\$/\$\$/g;
+}
+# escape characters sensitive to the shell/make for file paths
+sub shellEscape {
+     # $_[0] is the variable passed by reference implicitly
+    escape("()#&\$", $_[0]); # Escape shell metacharacters & Make '$'
+    # Escape spaces for shell commands separately
+    $_[0] =~ s/ /\\ /g;
+}
+
+sub hasConfigurationArgument {
+    return scalar grep { /^--?(?:config|configuration)$/ } @_;
+}
+
+sub fileContainsLiteral {
+    my ($file, $literal) = @_;
+    open my $fh, "<", $file or return 0;
+    while (my $line = <$fh>) {
+        if (index($line, $literal) != -1) {
+            close $fh;
+            return 1;
+        }
+    }
+    close $fh;
+    return 0;
+}
+
+# --- Global Variables ---
+my $log_tag = join "_", ("xcodemake", @original_ARGV);
+$log_tag =~ s{[/:]+}{_}g;
+$log_tag =~ s{[^[:alnum:]._+=,@ -]+}{_}g;
+$log_tag =~ s{\s+}{_}g;
+$log_tag =~ s{_+}{_}g;
+$log_tag =~ s{^_+|_+$}{}g;
+$log_tag ||= "xcodemake";
+my $max_log_name_length = 150;
+my $log_suffix = "-" . md5_hex(join "\0", @original_ARGV) . ".log";
+$log_tag = substr($log_tag, 0, $max_log_name_length - length($log_suffix));
+$log_tag =~ s{_+$}{};
+my $log = ($log_tag || "xcodemake") . $log_suffix;
+my $make = "Makefile";
+
+my $xcodebuild = ($ENV{DEVELOPER_BIN_DIR}||'/usr/bin')."/xcodebuild";
+my $archs = $ENV{ARCHS}||'arm64';
+my $has_config_in_original = hasConfigurationArgument(@original_ARGV);
+
+my $variant = "$xcodebuild ARCHS=$archs @original_ARGV";
+$variant .= " -config Debug" unless $has_config_in_original;
+
+my $builddb = ($ENV{OBJROOT}||'/tmp')."/XCBuildData/build.db";
+
+my $EXIT_SUCCESS = 0;
+my ($LOG, $fileArg); # $LOG will be lexical to generateMakefile
+
+# regex for file path argument (handles spaces escaped with backslash)
+my $notSpace = "[^\\\\\\s]";
+$fileArg = "$notSpace+(?:\\\\.$notSpace*)*";
+
+# --- Main Logic ---
+
+# Recapture xcodebuild output if paramaters change or project has been edited
+captureXcodebuild() if ! -f $log || `find . -name project.pbxproj -newer '$log'`;
+
+# Regenerate Makefile if the script, xcodebuild path, or arguments changed.
+generateMakefile() if ! -f $make || -M $0 < -M $make || !fileContainsLiteral($make, $variant);
+
+exit $EXIT_SUCCESS if $EXIT_SUCCESS == system "make";
+
+rename $builddb, $builddb.".save" if -f $builddb;
+
+# If make failed, try running xcodebuild directly. If it succeeds, regenerate and try make again.
+# Prepare command array for direct xcodebuild run (needs env)
+my @direct_build_cmd_parts = ($xcodebuild);
+# Use the original arguments captured at the start
+my @direct_build_args = @original_ARGV;
+push @direct_build_args, ('-config', 'Debug') unless $has_config_in_original;
+my @direct_build_cmd = (@direct_build_cmd_parts, @direct_build_args);
+
+my $direct_build_status;
+{
+    local $ENV{ARCHS} = $archs; # Set environment for direct build too
+    $direct_build_status = 
```

**File**: `src/utils/__tests__/xcodemake-wrapper.test.ts` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
+import { execFileSync } from 'node:child_process';
+import { createHash } from 'node:crypto';
+import {
+  chmodSync,
+  existsSync,
+  mkdirSync,
+  mkdtempSync,
+  readFileSync,
+  readdirSync,
+  rmSync,
+  statSync,
+  utimesSync,
+  writeFileSync,
+} from 'node:fs';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+import { XCODEMAKE_COMMIT, XCODEMAKE_SHA256 } from '../xcodemake.ts';
+
+const FILESYSTEM_TIMESTAMP_TOLERANCE_MS = 1_000;
+const PINNED_FIXTURE_PATH = fileURLToPath(
+  new URL(`./fixtures/xcodemake/xcodemake-${XCODEMAKE_COMMIT}`, import.meta.url),
+);
+
+function writeExecutable(filePath: string, contents: string): void {
+  writeFileSync(filePath, contents);
+  chmodSync(filePath, 0o755);
+}
+
+function readLines(filePath: string): string[] {
+  if (!existsSync(filePath)) {
+    return [];
+  }
+
+  const contents = readFileSync(filePath, 'utf8').trim();
+  return contents.length > 0 ? contents.split('\n') : [];
+}
+
+describe('pinned xcodemake wrapper lifecycle', () => {
+  let temporaryDirectory: string;
+  let projectDirectory: string;
+  let projectFile: string;
+  let fakeBinDirectory: string;
+  let xcodebuildInvocationLog: string;
+  let makeInvocationLog: string;
+
+  beforeEach(() => {
+    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'xcodebuildmcp-xcodemake-wrapper-'));
+    projectDirectory = path.join(temporaryDirectory, 'project');
+    fakeBinDirectory = path.join(temporaryDirectory, 'bin');
+    xcodebuildInvocationLog = path.join(temporaryDirectory, 'xcodebuild-invocations.log');
+    makeInvocationLog = path.join(temporaryDirectory, 'make-invocations.log');
+
+    mkdirSync(path.join(projectDirectory, 'MyWorkspace.xcworkspace'), { recursive: true });
+    mkdirSync(fakeBinDirectory, { recursive: true });
+    projectFile = path.join(projectDirectory, 'MyWorkspace.xcodeproj', 'project.pbxproj');
+    mkdirSync(path.dirname(projectFile), { recursive: true });
+    writeFileSync(projectFile, '// test project\n');
+
+    writeExecutable(
+      path.join(fakeBinDirectory, 'xcodebuild'),
+      '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$XCODEMAKE_TEST_XCODEBUILD_LOG"\n',
+    );
+    writeExecutable(
+      path.join(fakeBinDirectory, 'make'),
+      '#!/bin/sh\nprintf \'make\\n\' >> "$XCODEMAKE_TEST_MAKE_LOG"\nattempts=0\nwhile IFS= read -r _; do attempts=$((attempts + 1)); done < "$XCODEMAKE_TEST_MAKE_LOG"\nif [ "${XCODEMAKE_TEST_FAIL_FIRST_MAKE:-0}" = "1" ] && [ "$attempts" -eq 1 ]; then\n  exit 1\nfi\n',
+    );
+  });
+
+  afterEach(() => {
+    rmSync(temporaryDirectory, { recursive: true, force: true });
+  });
+
+  function runWrapper(arguments_: string[], environment: Record<string, string> = {}): void {
+    execFileSync('perl', [PINNED_FIXTURE_PATH, ...arguments_], {
+      cwd: projectDirectory,
+      encoding: 'utf8',
+      stdio: 'pipe',
+      env: {
+        ...process.env,
+        PATH: `${fakeBinDirectory}${path.delimiter}${process.env.PATH ?? ''}`,
+        DEVELOPER_BIN_DIR: fakeBinDirectory,
+        OBJROOT: path.join(temporaryDirectory, 'objroot'),
+        XCODEMAKE_TEST_XCODEBUILD_LOG: xcodebuildInvocationLog,
+        XCODEMAKE_TEST_MAKE_LOG: makeInvocationLog,
+        ...environment,
+      },
+    });
+  }
+
+  function captureLogs(): string[] {
+    return readdirSync(projectDirectory).filter(
+      (fileName) => fileName.startsWith('xcodemake') && fileName.endsWith('.log'),
+    );
+  }
+
+  it('captures and reuses builds while invalidating changed or stale state', () => {
+    const fixtureChecksum = createHash('sha256')
+      .update(readFileSync(PINNED_FIXTURE_PATH))
+      .digest('hex');
+    expect(fixtureChecksum).toBe(XCODEMAKE_SHA256);
+
+    const derivedDataPath =
+      '/Users/developer/Library/Developer/XcodeBuildMCP/DerivedData/MyWorkspace-57a542dedf16';
+    const initialArguments = [
+      '-
```

---

### Incident Patch 9: `7cd7d5af` (2026-07-21)
**Commit Message**: fix(simulator): prefer Device Hub for simulator UI (#479)

* build: Upgrade AXe to 1.8.0

* fix(simulator): prefer Device Hub for simulator UI

Open Device Hub for visible simulator workflows when available, with Simulator.app as the compatibility fallback. Target the selected simulator by UDID and drive keyboard controls through Device Hub's menus.

* fix(simulator): make Device Hub shortcuts locale independent

* docs(manifests): simplify simulator tool descriptions

**File**: `.axe-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.7.1
+1.8.0
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@
 - Fixed malformed simulator discovery responses, project discovery path-boundary checks, and compiler diagnostic filenames containing glob metacharacters ([#424](https://github.com/getsentry/XcodeBuildMCP/issues/424)).
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
 - Fixed iOS scaffold orientation and device-family settings, LLDB command isolation and argument escaping, run-destination parsing without an active scheme, concurrent working-directory mutations, blocking physical-device name lookup, and unverified `xcodemake` downloads ([#459](https://github.com/getsentry/XcodeBuildMCP/issues/459)).
+- Fixed simulator UI launching and keyboard controls to prefer Xcode 27's Device Hub when available, with Simulator.app as the legacy fallback.
 
 ## [2.6.2]
 
```

**File**: `manifests/tools/build_run_sim.yaml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ module: mcp/tools/simulator/build_run_sim
 names:
   mcp: build_run_sim
   cli: build-and-run
-description: Build, install, and launch on iOS Simulator; boots simulator and attempts to open Simulator.app as needed. Runtime logs are captured automatically and the log file path is included in the response. Preferred single-step run tool when defaults are set.
+description: Build, install, and launch on iOS Simulator, booting it when needed. Runtime logs are captured automatically and the log file path is included in the response. Preferred single-step run tool when defaults are set.
 outputSchema:
   schema: xcodebuildmcp.output.build-run-result
   version: "2"
```

**File**: `manifests/tools/open_sim.yaml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ module: mcp/tools/simulator/open_sim
 names:
   mcp: open_sim
   cli: open
-description: Open Simulator.app for visibility/manual workflows. Not required before simulator build-and-run (build_run_sim).
+description: Open the simulator frontend for visibility and manual workflows. Not required before simulator build-and-run (build_run_sim).
 outputSchema:
   schema: xcodebuildmcp.output.simulator-action-result
   version: "2"
```

**File**: `manifests/tools/toggle_connect_hardware_keyboard.yaml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ module: mcp/tools/simulator-management/toggle_connect_hardware_keyboard
 names:
   mcp: toggle_connect_hardware_keyboard
   cli: toggle-connect-hardware-keyboard
-description: Toggle whether the iOS Simulator receives Mac hardware keyboard input (Cmd+Shift+K). Disconnecting makes the on-screen keyboard appear for tap-based input. Requires the simulator to be booted and Accessibility permission for the MCP host.
+description: Toggle whether the iOS Simulator simulates a hardware keyboard connection. Disconnecting makes the on-screen keyboard appear for tap-based input. Requires the simulator to be booted and Accessibility permission for the MCP host.
 outputSchema:
   schema: xcodebuildmcp.output.simulator-action-result
   version: "2"
```

---

### Incident Patch 10: `60cfdc35` (2026-07-16)
**Commit Message**: fix: Harden scaffold and utility edge cases (#476)

* fix: Address verified Warden findings

Correct scaffold settings, isolate LLDB command output, and make device lookup asynchronous.

Also harden xcuserstate parsing, template extraction, and xcodemake installation.

Fixes #459

* fix(debugger): Report running state after resume

* fix(device): Preserve names after refresh failure

* fix(debugger): Clear running state after termination

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,6 +11,7 @@
 
 - Fixed malformed simulator discovery responses, project discovery path-boundary checks, and compiler diagnostic filenames containing glob metacharacters ([#424](https://github.com/getsentry/XcodeBuildMCP/issues/424)).
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
+- Fixed iOS scaffold orientation and device-family settings, LLDB command isolation and argument escaping, run-destination parsing without an active scheme, concurrent working-directory mutations, blocking physical-device name lookup, and unverified `xcodemake` downloads ([#459](https://github.com/getsentry/XcodeBuildMCP/issues/459)).
 
 ## [2.6.2]
 
@@ -694,4 +695,3 @@ Please note that the UI automation features are an early preview and currently i
 - Initial release of XcodeBuildMCP
 - Basic support for building iOS and macOS applications
 
-
```

**File**: `src/mcp/tools/project-scaffolding/__tests__/ios-scaffold-settings.test.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import { describe, expect, it } from 'vitest';
+import { deviceFamiliesToNumeric, orientationToIOSConstant } from '../ios-scaffold-settings.ts';
+
+describe('iOS scaffold settings', () => {
+  it.each([
+    ['portrait', 'UIInterfaceOrientationPortrait'],
+    ['portrait-upside-down', 'UIInterfaceOrientationPortraitUpsideDown'],
+    ['landscape-left', 'UIInterfaceOrientationLandscapeLeft'],
+    ['landscape-right', 'UIInterfaceOrientationLandscapeRight'],
+  ] as const)('maps %s to its Info.plist constant', (orientation, expected) => {
+    expect(orientationToIOSConstant(orientation)).toBe(expected);
+  });
+
+  it.each([
+    [['iphone'], '1'],
+    [['ipad'], '2'],
+    [['iphone', 'ipad'], '1,2'],
+    [['universal'], '1,2'],
+  ] as const)('maps device families %j to %s', (families, expected) => {
+    expect(deviceFamiliesToNumeric([...families])).toBe(expected);
+  });
+});
```

**File**: `src/mcp/tools/project-scaffolding/__tests__/scaffold_ios_project.test.ts` (modified, +31/-1)
```diff
@@ -129,12 +129,16 @@ describe('scaffold_ios_project plugin', () => {
       await initConfigStoreForTest({ iosTemplatePath: '' });
 
       let capturedCommands: string[][] = [];
+      let unzipOptions: unknown;
       const trackingCommandExecutor = createMockExecutor({
         success: true,
         output: 'Command executed successfully',
       });
       const capturingExecutor = async (command: string[], ...args: any[]) => {
         capturedCommands.push(command);
+        if (command[0] === 'unzip') {
+          unzipOptions = args[2];
+        }
         return trackingCommandExecutor(command, ...args);
       };
 
@@ -162,6 +166,9 @@ describe('scaffold_ios_project plugin', () => {
           /https:\/\/github\.com\/getsentry\/XcodeBuildMCP-iOS-Template\/releases\/download\/v\d+\.\d+\.\d+\/XcodeBuildMCP-iOS-Template-\d+\.\d+\.\d+\.zip/,
         ),
       ]);
+      expect(unzipOptions).toEqual({
+        cwd: expect.stringMatching(/xcodebuild-mcp-template-/),
+      });
 
       await initConfigStoreForTest({ iosTemplatePath: '/mock/template/path' });
     });
@@ -242,6 +249,22 @@ describe('scaffold_ios_project plugin', () => {
     });
 
     it('should return success response with all optional parameters', async () => {
+      let writtenXCConfig: string | undefined;
+      const xcconfigFileSystem = createMockFileSystemExecutor({
+        existsSync: (path) => path.includes('/mock/template/path'),
+        readdir: async () => [
+          { name: 'Project.xcconfig', isDirectory: () => false, isFile: () => true } as any,
+        ],
+        readFile: async () =>
+          [
+            'TARGETED_DEVICE_FAMILY = old',
+            'INFOPLIST_KEY_UISupportedInterfaceOrientations = old',
+            'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = old',
+          ].join('\n'),
+        writeFile: async (_path, content) => {
+          writtenXCConfig = content;
+        },
+      });
       const result = await runLogic(() =>
         scaffold_ios_projectLogic(
           {
@@ -258,13 +281,20 @@ describe('scaffold_ios_project plugin', () => {
             supportedOrientationsIpad: ['portrait', 'landscape-left'],
           },
           mockCommandExecutor,
-          mockFileSystemExecutor,
+          xcconfigFileSystem,
         ),
       );
 
       expect(result.isError).toBeFalsy();
       const text = allText(result);
       expect(text).toContain('Project scaffolded successfully');
+      expect(writtenXCConfig).toContain('TARGETED_DEVICE_FAMILY = 1');
+      expect(writtenXCConfig).toContain(
+        'INFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait',
+      );
+      expect(writtenXCConfig).toContain(
+        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft',
+      );
       expect(result.nextStepParams).toEqual({
         build_sim: {
           workspacePath: '/tmp/test-projects/TestIOSApp.xcworkspace',
```

**File**: `src/mcp/tools/project-scaffolding/ios-scaffold-settings.ts` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+export type IOSDeviceFamily = 'iphone' | 'ipad' | 'universal';
+
+export type IOSOrientation =
+  | 'portrait'
+  | 'landscape-left'
+  | 'landscape-right'
+  | 'portrait-upside-down';
+
+const ORIENTATION_CONSTANTS: Record<IOSOrientation, string> = {
+  portrait: 'UIInterfaceOrientationPortrait',
+  'portrait-upside-down': 'UIInterfaceOrientationPortraitUpsideDown',
+  'landscape-left': 'UIInterfaceOrientationLandscapeLeft',
+  'landscape-right': 'UIInterfaceOrientationLandscapeRight',
+};
+
+/** Converts a scaffold orientation token to its Info.plist build-setting constant. */
+export function orientationToIOSConstant(orientation: IOSOrientation): string {
+  return ORIENTATION_CONSTANTS[orientation];
+}
+
+/** Converts scaffold device-family tokens to Xcode's numeric build-setting value. */
+export function deviceFamiliesToNumeric(families: IOSDeviceFamily[]): string {
+  if (families.includes('universal')) {
+    return '1,2';
+  }
+
+  const numericFamilies = new Set<string>();
+  if (families.includes('iphone')) {
+    numericFamilies.add('1');
+  }
+  if (families.includes('ipad')) {
+    numericFamilies.add('2');
+  }
+  return [...numericFamilies].join(',');
+}
```

**File**: `src/mcp/tools/project-scaffolding/scaffold_ios_project.ts` (modified, +13/-39)
```diff
@@ -14,6 +14,12 @@ import {
   getHandlerContext,
 } from '../../../utils/typed-tool-factory.ts';
 import { createScaffoldDomainResult, setScaffoldStructuredOutput } from './domain-result.ts';
+import {
+  deviceFamiliesToNumeric,
+  orientationToIOSConstant,
+  type IOSDeviceFamily,
+  type IOSOrientation,
+} from './ios-scaffold-settings.ts';
 
 const BaseScaffoldSchema = z.object({
   projectName: z.string().min(1),
@@ -36,40 +42,6 @@ const ScaffoldiOSProjectSchema = BaseScaffoldSchema.extend({
     .optional(),
 });
 
-/**
- * Convert orientation enum to iOS constant
- */
-function orientationToIOSConstant(orientation: string): string {
-  switch (orientation) {
-    case 'Portrait':
-      return 'UIInterfaceOrientationPortrait';
-    case 'PortraitUpsideDown':
-      return 'UIInterfaceOrientationPortraitUpsideDown';
-    case 'LandscapeLeft':
-      return 'UIInterfaceOrientationLandscapeLeft';
-    case 'LandscapeRight':
-      return 'UIInterfaceOrientationLandscapeRight';
-    default:
-      return orientation;
-  }
-}
-
-/**
- * Convert device family enum to numeric value
- */
-function deviceFamilyToNumeric(family: string): string {
-  switch (family) {
-    case 'iPhone':
-      return '1';
-    case 'iPad':
-      return '2';
-    case 'iPhone+iPad':
-      return '1,2';
-    default:
-      return '1,2';
-  }
-}
-
 /**
  * Update Package.swift file with deployment target
  */
@@ -114,9 +86,11 @@ function updateXCConfigFile(content: string, params: Record<string, unknown>): s
   const currentProjectVersion = params.currentProjectVersion as string | undefined;
   const platform = params.platform as string;
   const deploymentTarget = params.deploymentTarget as string | undefined;
-  const targetedDeviceFamily = params.targetedDeviceFamily as string | undefined;
-  const supportedOrientations = params.supportedOrientations as string[] | undefined;
-  const supportedOrientationsIpad = params.supportedOrientationsIpad as string[] | undefined;
+  const targetedDeviceFamily = params.targetedDeviceFamily as IOSDeviceFamily[] | undefined;
+  const supportedOrientations = params.supportedOrientations as IOSOrientation[] | undefined;
+  const supportedOrientationsIpad = params.supportedOrientationsIpad as
+    | IOSOrientation[]
+    | undefined;
 
   // Update project identity settings
   result = result.replace(/PRODUCT_NAME = .+/g, `PRODUCT_NAME = ${projectName}`);
@@ -148,8 +122,8 @@ function updateXCConfigFile(content: string, params: Record<string, unknown>): s
     }
 
     // Device family
-    if (targetedDeviceFamily) {
-      const deviceFamilyValue = deviceFamilyToNumeric(targetedDeviceFamily);
+    if (targetedDeviceFamily && targetedDeviceFamily.length > 0) {
+      const deviceFamilyValue = deviceFamiliesToNumeric(targetedDeviceFamily);
       result = result.replace(
         /TARGETED_DEVICE_FAMILY = .+/g,
         `TARGETED_DEVICE_FAMILY = ${deviceFamilyValue}`,
```

#### Recent Merged Pull Requests:
- **PR #539** (2026-09-23): ci: Unblock tag-triggered release workflows (@itaybre)
- **PR #538** (2026-09-23): ref!: Rename project to MobileBuildMCP (@itaybre)
- **PR #536** (closed): feat: add managed simulator resource leases (@RxChi1d)
- **PR #515** (closed): chore(deps): bump @hono/node-server from 1.19.13 to 1.19.17 (@dependabot[bot])
- **PR #510** (closed): chore(deps): bump hono from 4.12.31 to 4.13.1 (@dependabot[bot])
- **PR #508** (closed): feat(mcp): support protocol revision 2026-07-28 on SDK v2 (@anxkhn)
- **PR #507** (closed): chore(deps): bump fast-uri from 3.1.4 to 3.1.5 (@dependabot[bot])
- **PR #506** (closed): chore(deps): bump hono from 4.12.31 to 4.13.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

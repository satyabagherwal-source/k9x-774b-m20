# Forensic Learning Record (Deep Inspection): mukul975/Anthropic-Cybersecurity-Skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/mukul975-anthropic-cybersecurity-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:06:19.199Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mukul975/Anthropic-Cybersecurity-Skills`
- **Description**: 817 structured cybersecurity skills for AI agents · Mapped to 6 frameworks: MITRE ATT&CK, NIST CSF 2.0, MITRE ATLAS, D3FEND, NIST AI RMF & MITRE F3 (Fight Fraud) · agentskills.io standard · Works with Claude Code, GitHub Copilot, Codex CLI, Cursor, Gemini CLI & 20+ platforms · 29 security domains · Apache 2.0
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 33809 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/conducting-social-engineering-pretext-call/scripts/agent.py`
```
#!/usr/bin/env python3
"""Social engineering pretext call planning and tracking agent."""

import json
import argparse
from datetime import datetime


def generate_pretext_templates():
    """Generate pretext call templates for authorized engagements."""
    return [
        {
            "name": "IT Help Desk Password Reset",
            "target_role": "General employee",
            "objective": "Obtain credentials or MFA bypass",
            "opening": "Hi, this is [Name] from the IT help desk. We noticed unusual activity on your account.",
            "key_questions": [
                "Can you verify your employee ID?",
                "What is your current password so we can compare against the compromised list?",
                "Can you read me the code from your authenticator app?",
            ],
            "success_criteria": "Target provides password, MFA token, or confirms identity details",
            "difficulty": "easy",
        },
        {
            "name": "Executive Assistant Urgency",
            "target_role": "Executive assistant / Finance",
            "objective": "Initiate wire transfer or reveal financial info",
            "opening": "Hi, this is [Name] calling on behalf of [CEO]. They need an urgent wire processed.",
            "key_questions": [
                "Can you process this payment today?",
                "What account do we usually wire from?",
                "The CEO said to skip the usual approval — can you make an exception?",
            ],
            "success_criteria": "Target initiates process or reveals account details",
            "difficulty": "hard",
        },
        {
            "name": "Vendor Support Callback",
            "target_role": "IT administrator",
            "objective": "Gain remote access or credential disclosure",
            "opening": "This is [Name] from [Vendor] support returning your call about the ticket.",
            "key_questions": [
                "Can you give me remote access to troubleshoot?",
                "What is the admin password for the [system]?",
                "Can you add our support account to the admin group temporarily?",
            ],
            "success_criteria": "Target provides remote access or admin credentials",
            "difficulty": "medium",
        },
    ]


def create_call_tracking_sheet(targets):
    """Create tracking sheet for pretext calls."""
    tracking = []
    for target in targets:
        tracking.append({
            "name": target.get("name", ""),
            "phone": target.get("phone", ""),
            "department": target.get("department", ""),
            "pretext": target.get("pretext", "IT Help Desk"),
            "status": "pending",
            "result": None,
            "info_obtained": [],
            "call_duration": None,
            "notes": "",
        })
    return tracking


def analyze_results(call_results):
    """Analyze pretext call results for reporting."""
    total = len(call_results)
    success = sum(1 for c in call_results if c.get("result") == "success")
    partial = sum(1 for c in call_results if c.get("result") == "partial")
    failed = sum(1 for c in call_results if c.get("result") == "failed")
    reported = sum(1 for c in call_results if c.get("result") == "reported")
    return {
        "total_calls": total,
        "successful": success,
        "partial_success": partial,
        "failed": failed,
        "reported_to_security": reported,
        "success_rate": round(success / max(total, 1) * 100, 1),
        "report_rate": round(reported / max(total, 1) * 100, 1),
    }


def run_planning(targets_file=None, results_file=None):
    """Execute pretext call planning and analysis."""
    print(f"\n{'='*60}")
    print(f"  SOCIAL ENGINEERING PRETEXT CALL PLANNER")
    print(f"  Generated: {datetime.utcnow().isoformat()} UTC")
    print(f"{'='*60}\n")

    templates = generate_pretext_templates()
    print(f"--- PRETEXT TEMPLATES ({len(templates)}) ---")
    for t in templates:
        print(f"  [{t['difficulty'].upper()}] {t['name']}")
        print(f"    Target: {t['target_role']}")
        print(f"    Objective: {t['objective']}")

    if targets_file:
        with open(targets_file, "r") as f:
            targets = json.load(f)
        sheet = create_call_tracking_sheet(targets)
        print(f"\n--- TRACKING SHEET ({len(sheet)} targets) ---")
        for s in sheet[:10]:
            print(f"  {s['name']} ({s['department']}): {s['pretext']}")

    if results_file:
        with open(results_file, "r") as f:
            results = json.load(f)
        metrics = analyze_results(results)
        print(f"\n--- CAMPAIGN METRICS ---")
        for k, v in metrics.items():
            print(f"  {k}: {v}")

    return {"templates": templates}


def main():
    parser = argparse.ArgumentParser(description="Pretext Call Planning Agent")
    parser.add_argument("--targets", help="Target list JSON file")
    parser.add_argument("--results", help="Call results JSON file for analysis")
    parser.add_argument("--output", help="Save report to JSON file")
    args = parser.parse_args()

    report = run_planning(args.targets, args.results)
    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"\n[+] Report saved to {args.output}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/conducting-social-engineering-pretext-call/scripts/process.py`
```
#!/usr/bin/env python3
"""
Social Engineering Campaign Tracker

Tracks vishing (pretext call) campaign results, calculates susceptibility
metrics, and generates reports for security awareness improvement.
"""

import json
import os
import csv
from datetime import datetime
from collections import defaultdict
from dataclasses import dataclass, field, asdict


@dataclass
class VishingCall:
    """Represents a single vishing call attempt."""
    call_id: str
    timestamp: str
    target_name: str
    target_department: str
    target_role: str
    pretext_used: str
    call_duration_seconds: int
    call_answered: bool
    credential_disclosed: bool
    sensitive_info_disclosed: bool
    info_type_disclosed: str = ""  # password, username, badge_number, etc.
    verification_attempted: bool = False
    reported_to_security: bool = False
    susceptibility_score: int = 0  # 1-5
    notes: str = ""
    operator: str = ""


class VishingCampaignTracker:
    """Track and analyze vishing campaign results."""

    def __init__(self, campaign_id: str, client_name: str):
        self.campaign_id = campaign_id
        self.client_name = client_name
        self.calls: list[VishingCall] = []

    def log_call(self, call: VishingCall) -> None:
        """Log a vishing call result."""
        self.calls.append(call)

    def calculate_metrics(self) -> dict:
        """Calculate campaign metrics."""
        answered = [c for c in self.calls if c.call_answered]
        total_answered = len(answered)
        if total_answered == 0:
            return {"error": "No answered calls to analyze"}

        cred_disclosed = [c for c in answered if c.credential_disclosed]
        info_disclosed = [c for c in answered if c.sensitive_info_disclosed]
        verified = [c for c in answered if c.verification_attempted]
        reported = [c for c in answered if c.reported_to_security]

        # Per-department breakdown
        dept_stats = defaultdict(lambda: {
            "total": 0, "cred_disclosed": 0, "info_disclosed": 0,
            "verified": 0, "reported": 0,
        })
        for call in answered:
            dept = call.target_department
            dept_stats[dept]["total"] += 1
            if call.credential_disclosed:
                dept_stats[dept]["cred_disclosed"] += 1
            if call.sensitive_info_disclosed:
                dept_stats[dept]["info_disclosed"] += 1
            if call.verification_attempted:
                dept_stats[dept]["verified"] += 1
            if call.reported_to_security:
                dept_stats[dept]["reported"] += 1

        # Per-pretext breakdown
        pretext_stats = defaultdict(lambda: {"total": 0, "success": 0})
        for call in answered:
            pretext_stats[call.pretext_used]["total"] += 1
            if call.credential_disclosed or call.sensitive_info_disclosed:
                pretext_stats[call.pretext_used]["success"] += 1

        avg_duration = sum(c.call_duration_seconds for c in answered) / total_answered
        avg_susceptibility = sum(c.susceptibility_score for c in answered) / total_answered

        return {
            "campaign_id": self.campaign_id,
            "total_calls": len(self.calls),
            "calls_answered": total_answered,
            "answer_rate": total_answered / len(self.calls) * 100,
            "credential_disclosure_rate": len(cred_disclosed) / total_answered * 100,
            "sensitive_info_disclosure_rate": len(info_disclosed) / total_answered * 100,
            "verification_rate": len(verified) / total_answered * 100,
            "security_reporting_rate": len(reported) / total_answered * 100,
            "avg_call_duration_seconds": avg_duration,
            "avg_susceptibility_score": avg_susceptibility,
            "department_breakdown": dict(dept_stats),
            "pretext_effectiveness": dict(pretext_stats),
        }

    def generate_report(self) -> str:
        """Generate campaign report."""
        metrics = self.calculate_metrics()
        if "error" in metrics:
            return metrics["error"]

        lines = []
        lines.append("=" * 70)
        lines.append("VISHING CAMPAIGN ASSESSMENT REPORT")
        lines.append(f"Campaign: {self.campaign_id}")
        lines.append(f"Client: {self.client_name}")
        lines.append(f"Date: {datetime.now().strftime('%Y-%m-%d')}")
        lines.append("=" * 70)

        lines.append(f"\nOVERALL METRICS:")
        lines.append(f"  Total Calls Made:           {metrics['total_calls']}")
        lines.append(f"  Calls Answered:              {metrics['calls_answered']}")
        lines.append(f"  Answer Rate:                 {metrics['answer_rate']:.1f}%")
        lines.append(f"  Credential Disclosure Rate:  {metrics['credential_disclosure_rate']:.1f}%")
        lines.append(f"  Info Disclosure Rate:         {metrics['sensitive_info_disclosure_rate']:.1f}%")
        lines.append(f"  Verification Rate:           {metrics['verification_rate']:.1f}%")
        lines.append(f"  Security Reporting Rate:     {metrics['security_reporting_rate']:.1f}%")
        lines.append(f"  Avg Call Duration:           {metrics['avg_call_duration_seconds']:.0f}s")
        lines.append(f"  Avg Susceptibility (1-5):    {metrics['avg_susceptibility_score']:.1f}")

        # Risk assessment
        cred_rate = metrics['credential_disclosure_rate']
        risk = "CRITICAL" if cred_rate > 30 else "HIGH" if cred_rate > 15 else "MEDIUM" if cred_rate > 5 else "LOW"
        lines.append(f"\n  OVERALL RISK RATING: {risk}")

        # Department breakdown
        lines.append(f"\nDEPARTMENT BREAKDOWN:")
        lines.append("-" * 70)
        for dept, stats in metrics["department_breakdown"].items():
            total = stats["total"]
            cred_pct = stats["cred_disclosed"] / total * 100 if total else 0
            verify_pct = stats["verified"] / total * 100 if total else 0
            lines.append(
                f"  {dept:<20} Calls: {total:>3} | "
                f"Cred Disclosed: {cred_pct:>5.1f}% | "
                f"Verified: {verify_pct:>5.1f}%"
            )

        # Pretext effectiveness
        lines.append(f"\nPRETEXT EFFECTIVENESS:")
        lines.append("-" * 70)
        for pretext, stats in metrics["pretext_effectiveness"].items():
            success_rate = stats["success"] / stats["total"] * 100 if stats["total"] else 0
            lines.append(f"  {pretext:<30} Success: {success_rate:.1f}% ({stats['success']}/{stats['total']})")

        # Recommendations
        lines.append(f"\nRECOMMENDATIONS:")
        lines.append("-" * 70)
        if metrics["credential_disclosure_rate"] > 10:
            lines.append("  [CRITICAL] Implement mandatory caller verification procedures")
        if metrics["verification_rate"] < 50:
            lines.append("  [HIGH] Enhance security awareness training on verification")
        if metrics["security_reporting_rate"] < 30:
            lines.append("  [HIGH] Establish easy-to-use suspicious call reporting process")
        lines.append("  [MEDIUM] Conduct quarterly vishing simulations")
        lines.append("  [MEDIUM] Implement callback verification for sensitive requests")

        return "\n".join(lines)

    def export_csv(self, output_path: str) -> None:
        """Export results to CSV."""
        with open(output_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Call ID", "Timestamp", "Target", "Department", "Role",
                "Pretext", "Duration(s)", "Answered", "Cred Disclosed",
                "Info Disclosed", "Verified", "Reported", "Score",
            ])
            for call in self.calls:
                writer.writerow([
                    call.call_id, call.timestamp, call.target_name,
                    call.target_department, call.target_role, call.pretext_used,
                    call.call_duration_seconds, call.call_answered,
                    call.credential_disclosed, call.sensitive_info_disclosed,
                    call.verification_attempted, call.reported_to_security,
                    call.susceptibility_score,
                ])


def main():
    """Demonstrate vishing campaign tracking."""
    tracker = VishingCampaignTracker("VISH-2025-001", "Example Corp")

    sample_calls = [
        VishingCall("V001", "2025-02-01T09:00:00", "Alice Johnson", "Finance",
                    "Accountant", "IT Helpdesk - VPN Update", 180, True, True,
                    True, "password", False, False, 5),
        VishingCall("V002", "2025-02-01T09:30:00", "Bob Smith", "IT",
                    "Sysadmin", "Vendor Support Call", 45, True, False,
                    False, "", True, True, 1),
        VishingCall("V003", "2025-02-01T10:00:00", "Carol Davis", "HR",
                    "HR Manager", "Benefits Verification", 120, True, False,
                    True, "employee_id", False, False, 3),
        VishingCall("V004", "2025-02-01T10:30:00", "Dan Wilson", "Finance",
                    "Controller", "Wire Transfer Request", 60, True, False,
                    False, "", True, True, 1),
        VishingCall("V005", "2025-02-01T11:00:00", "Eve Brown", "Marketing",
                    "Manager", "IT Helpdesk - Password Reset", 150, True, True,
                    True, "password", False, False, 4),
        VishingCall("V006", "2025-02-01T11:30:00", "Frank Lee", "Engineering",
                    "Developer", "IT Helpdesk - VPN Update", 30, True, False,
                    False, "", True, False, 2),
        VishingCall("V007", "2025-02-01T13:00:00", "Grace Kim", "Reception",
                    "Front Desk", "Delivery Confirmation", 90, True, False,
                    True, "employee_directory", False, False, 3),
        VishingCall("V008", "2025-02-01T13:30:00", "Henry Chen", "IT",
                    "Help Desk", "New Employee Onboarding", 20, True, False,
                    False, "", True, True, 1),
    ]

    for call in sample_calls:
        tra
```

### Core Architecture Module: `skills/implementing-epss-score-for-vulnerability-prioritization/scripts/agent.py`
```
#!/usr/bin/env python3
"""Agent for implementing EPSS (Exploit Prediction Scoring System) for vulnerability prioritization."""

import json
import argparse
import csv

try:
    import requests
except ImportError:
    requests = None

EPSS_API_URL = "https://api.first.org/data/v1/epss"


def get_epss_scores(cve_list):
    """Fetch EPSS scores for a list of CVE IDs from the FIRST.org API."""
    if not requests:
        return {"error": "requests library not installed"}
    results = []
    # API supports up to 100 CVEs per request
    for i in range(0, len(cve_list), 100):
        batch = cve_list[i:i + 100]
        params = {"cve": ",".join(batch)}
        resp = requests.get(EPSS_API_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("data", []):
            results.append({
                "cve": item["cve"],
                "epss": float(item["epss"]),
                "percentile": float(item["percentile"]),
            })
    return {"total": len(results), "scores": results}


def get_epss_csv():
    """Download the full EPSS score CSV from FIRST.org."""
    if not requests:
        return {"error": "requests library not installed"}
    resp = requests.get(f"{EPSS_API_URL}?envelope=true&pretty=true", timeout=60)
    resp.raise_for_status()
    return resp.json()


def prioritize_vulnerabilities(cve_scores, epss_threshold=0.1, percentile_threshold=0.9):
    """Prioritize vulnerabilities based on EPSS score and percentile."""
    critical = []
    high = []
    medium = []
    low = []
    for item in cve_scores:
        epss = item["epss"]
        pct = item["percentile"]
        if epss >= epss_threshold or pct >= percentile_threshold:
            item["priority"] = "CRITICAL"
            critical.append(item)
        elif epss >= 0.05:
            item["priority"] = "HIGH"
            high.append(item)
        elif epss >= 0.01:
            item["priority"] = "MEDIUM"
            medium.append(item)
        else:
            item["priority"] = "LOW"
            low.append(item)
    return {
        "thresholds": {"epss": epss_threshold, "percentile": percentile_threshold},
        "summary": {
            "critical": len(critical),
            "high": len(high),
            "medium": len(medium),
            "low": len(low),
        },
        "critical": sorted(critical, key=lambda x: x["epss"], reverse=True),
        "high": sorted(high, key=lambda x: x["epss"], reverse=True),
    }


def enrich_from_scan(scan_file, output_file=None):
    """Enrich a vulnerability scan CSV with EPSS scores."""
    with open(scan_file, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    cve_col = None
    for col in ["CVE", "cve", "CVE-ID", "cve_id", "vulnerability_id"]:
        if col in (rows[0] if rows else {}):
            cve_col = col
            break
    if not cve_col:
        return {"error": "No CVE column found in scan file"}
    cves = [row[cve_col] for row in rows if row.get(cve_col, "").startswith("CVE-")]
    if not cves:
        return {"error": "No CVE IDs found in scan file"}
    epss_data = get_epss_scores(cves)
    epss_map = {s["cve"]: s for s in epss_data.get("scores", [])}

    enriched = []
    for row in rows:
        cve = row.get(cve_col, "")
        epss_info = epss_map.get(cve, {})
        row["epss_score"] = epss_info.get("epss", "N/A")
        row["epss_percentile"] = epss_info.get("percentile", "N/A")
        enriched.append(row)

    if output_file:
        fieldnames = list(enriched[0].keys())
        with open(output_file, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(enriched)

    prioritized = prioritize_vulnerabilities(
        [s for s in epss_data.get("scores", [])]
    )
    return {
        "scan_file": scan_file,
        "total_cves": len(cves),
        "enriched_count": sum(1 for r in enriched if r["epss_score"] != "N/A"),
        "prioritization": prioritized["summary"],
        "top_10_exploitable": prioritized.get("critical", [])[:10],
    }


def main():
    parser = argparse.ArgumentParser(description="EPSS Vulnerability Prioritization Agent")
    sub = parser.add_subparsers(dest="command")
    s = sub.add_parser("score", help="Get EPSS scores for CVE IDs")
    s.add_argument("--cves", nargs="+", required=True, help="CVE IDs (e.g., CVE-2024-1234)")
    e = sub.add_parser("enrich", help="Enrich vulnerability scan with EPSS scores")
    e.add_argument("--scan-file", required=True, help="CSV vulnerability scan report")
    e.add_argument("--output", help="Output enriched CSV file")
    args = parser.parse_args()
    if args.command == "score":
        epss = get_epss_scores(args.cves)
        result = prioritize_vulnerabilities(epss.get("scores", []))
        result["raw_scores"] = epss["scores"]
    elif args.command == "enrich":
        result = enrich_from_scan(args.scan_file, args.output)
    else:
        parser.print_help()
        return
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/implementing-epss-score-for-vulnerability-prioritization/scripts/process.py`
```
#!/usr/bin/env python3
"""EPSS Vulnerability Prioritization Tool.

Fetches EPSS scores from FIRST API and prioritizes vulnerabilities
using a combined EPSS + CVSS matrix approach.
"""

import argparse
import csv
import gzip
import io
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

EPSS_API = "https://api.first.org/data/v1/epss"
EPSS_BULK_URL = "https://epss.cyentia.com/epss_scores-current.csv.gz"
KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

PRIORITY_MAP = {
    "P0": {"label": "Immediate", "sla_hours": 24},
    "P1": {"label": "Urgent", "sla_hours": 48},
    "P2": {"label": "High", "sla_days": 7},
    "P3": {"label": "Medium", "sla_days": 30},
    "P4": {"label": "Low", "sla_days": 90},
}


def fetch_epss_bulk():
    """Download full EPSS dataset for local lookups."""
    print("[*] Downloading full EPSS dataset...")
    resp = requests.get(EPSS_BULK_URL, timeout=60)
    resp.raise_for_status()
    content = gzip.decompress(resp.content).decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    scores = {}
    for row in reader:
        cve = row.get("cve", "").strip()
        if cve:
            scores[cve] = {
                "epss": float(row.get("epss", 0)),
                "percentile": float(row.get("percentile", 0)),
            }
    print(f"    Loaded EPSS scores for {len(scores)} CVEs")
    return scores


def fetch_epss_api(cve_list):
    """Fetch EPSS scores for specific CVEs via API."""
    scores = {}
    batch_size = 100
    for i in range(0, len(cve_list), batch_size):
        batch = cve_list[i : i + batch_size]
        try:
            resp = requests.get(
                EPSS_API, params={"cve": ",".join(batch)}, timeout=30
            )
            if resp.status_code == 200:
                for entry in resp.json().get("data", []):
                    scores[entry["cve"]] = {
                        "epss": float(entry.get("epss", 0)),
                        "percentile": float(entry.get("percentile", 0)),
                    }
        except requests.RequestException as e:
            print(f"[-] EPSS API error: {e}")
        time.sleep(0.5)
    return scores


def fetch_kev_catalog():
    """Download CISA KEV catalog."""
    resp = requests.get(KEV_URL, timeout=30)
    resp.raise_for_status()
    return {v["cveID"] for v in resp.json().get("vulnerabilities", [])}


def assign_priority(epss_score, cvss_score, in_kev=False):
    """Assign priority based on EPSS + CVSS + KEV matrix."""
    if in_kev:
        if cvss_score >= 9.0:
            return "P0"
        return "P1"
    if epss_score > 0.7 and cvss_score >= 9.0:
        return "P0"
    if epss_score > 0.7 and cvss_score >= 7.0:
        return "P1"
    if epss_score > 0.4 and cvss_score >= 7.0:
        return "P2"
    if epss_score > 0.1 or cvss_score >= 7.0:
        return "P3"
    return "P4"


def prioritize_scan_results(input_csv, output_csv, use_bulk=False):
    """Enrich vulnerability scan results with EPSS and prioritize."""
    vulnerabilities = []
    with open(input_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            vulnerabilities.append(row)

    cve_list = list({v.get("cve_id", "") for v in vulnerabilities if v.get("cve_id")})
    print(f"[*] Processing {len(vulnerabilities)} findings ({len(cve_list)} unique CVEs)")

    if use_bulk:
        epss_scores = fetch_epss_bulk()
    else:
        epss_scores = fetch_epss_api(cve_list)

    print("[*] Fetching CISA KEV catalog...")
    kev_set = fetch_kev_catalog()
    print(f"    {len(kev_set)} CVEs in KEV catalog")

    results = []
    for vuln in vulnerabilities:
        cve_id = vuln.get("cve_id", "")
        cvss = float(vuln.get("cvss_score", 0))
        epss_data = epss_scores.get(cve_id, {"epss": 0, "percentile": 0})
        in_kev = cve_id in kev_set
        priority = assign_priority(epss_data["epss"], cvss, in_kev)

        results.append({
            **vuln,
            "epss_score": round(epss_data["epss"], 5),
            "epss_percentile": round(epss_data["percentile"], 5),
            "in_cisa_kev": in_kev,
            "priority": priority,
            "priority_label": PRIORITY_MAP[priority]["label"],
        })

    results.sort(key=lambda r: (
        {"P0": 0, "P1": 1, "P2": 2, "P3": 3, "P4": 4}[r["priority"]],
        -r["epss_score"],
    ))

    if results:
        with open(output_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)

    priority_counts = {}
    for r in results:
        p = r["priority"]
        priority_counts[p] = priority_counts.get(p, 0) + 1

    print(f"\n[+] Prioritization Results -> {output_csv}")
    for p in ["P0", "P1", "P2", "P3", "P4"]:
        count = priority_counts.get(p, 0)
        print(f"    {p} ({PRIORITY_MAP[p]['label']}): {count}")
    print(f"    KEV matches: {sum(1 for r in results if r['in_cisa_kev'])}")
    return results


def detect_epss_spikes(previous_csv, current_scores, threshold=0.2):
    """Compare EPSS scores to detect significant increases."""
    previous = {}
    with open(previous_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cve = row.get("cve_id", "")
            if cve:
                previous[cve] = float(row.get("epss_score", 0))

    spikes = []
    for cve, prev_score in previous.items():
        current = current_scores.get(cve, {}).get("epss", 0)
        increase = current - prev_score
        if increase >= threshold:
            spikes.append({
                "cve_id": cve,
                "previous_epss": prev_score,
                "current_epss": current,
                "increase": round(increase, 5),
            })

    spikes.sort(key=lambda s: s["increase"], reverse=True)
    if spikes:
        print(f"\n[!] EPSS Spikes Detected ({len(spikes)} CVEs):")
        for s in spikes[:20]:
            print(f"    {s['cve_id']}: {s['previous_epss']:.4f} -> {s['current_epss']:.4f} (+{s['increase']:.4f})")
    return spikes


def main():
    parser = argparse.ArgumentParser(description="EPSS Vulnerability Prioritization Tool")
    parser.add_argument("--input", help="Input CSV with vulnerability scan results")
    parser.add_argument("--output", default="epss_prioritized.csv", help="Output prioritized CSV")
    parser.add_argument("--bulk", action="store_true", help="Use bulk EPSS download instead of API")
    parser.add_argument("--detect-spikes", help="Previous results CSV for spike detection")
    parser.add_argument("--spike-threshold", type=float, default=0.2, help="EPSS increase threshold")
    parser.add_argument("--query", help="Query EPSS for specific CVE(s), comma-separated")
    args = parser.parse_args()

    if args.query:
        cves = [c.strip() for c in args.query.split(",")]
        scores = fetch_epss_api(cves)
        for cve, data in scores.items():
            pct = data["epss"] * 100
            print(f"{cve}: {pct:.2f}% exploitation probability (percentile: {data['percentile']:.4f})")
    elif args.input:
        results = prioritize_scan_results(args.input, args.output, args.bulk)
        if args.detect_spikes:
            current_scores = {r["cve_id"]: {"epss": r["epss_score"]} for r in results if r.get("cve_id")}
            detect_epss_spikes(args.detect_spikes, current_scores, args.spike_threshold)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/implementing-microsegmentation-with-guardicore/scripts/agent.py`
```
#!/usr/bin/env python3
"""Guardicore Microsegmentation Agent - audits segmentation policies and network flow visibility."""

import json
import argparse
import logging
import os
import subprocess
from collections import defaultdict
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

GC_API = os.environ.get("GUARDICORE_API_URL", "https://gc-centra.example.com/api/v3.0")


def gc_request(api_url, token, endpoint, method="GET", data=None):
    cmd = ["curl", "-s", "-k", "-X", method,
           "-H", f"Authorization: Bearer {token}",
           "-H", "Content-Type: application/json",
           f"{api_url}{endpoint}"]
    if data:
        cmd.extend(["-d", json.dumps(data)])
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return json.loads(result.stdout) if result.stdout else {}


def authenticate(api_url, username, password):
    """Authenticate to Guardicore Centra and get access token."""
    data = {"username": username, "password": password}
    result = gc_request(api_url, "", "/authenticate", "POST", data)
    return result.get("access_token", "")


def get_segmentation_policies(api_url, token):
    """Retrieve all segmentation policies."""
    return gc_request(api_url, token, "/policies")


def get_network_flows(api_url, token, hours_back=24):
    """Get recent network flow data for analysis."""
    params = f"?time_range={hours_back}h&limit=1000"
    return gc_request(api_url, token, f"/connections{params}")


def get_labels(api_url, token):
    """Get all asset labels/tags."""
    return gc_request(api_url, token, "/labels")


def get_agents(api_url, token):
    """Get deployed agent status."""
    return gc_request(api_url, token, "/agents")


def analyze_policy_coverage(policies, flows):
    """Analyze how well policies cover observed traffic."""
    policy_rules = set()
    for policy in policies:
        for rule in policy.get("rules", []):
            src = rule.get("source", {}).get("label", "any")
            dst = rule.get("destination", {}).get("label", "any")
            port = rule.get("port", "any")
            policy_rules.add((src, dst, str(port)))
    covered = 0
    uncovered_flows = []
    for flow in flows:
        src_label = flow.get("source_label", "unknown")
        dst_label = flow.get("destination_label", "unknown")
        port = str(flow.get("destination_port", ""))
        if (src_label, dst_label, port) in policy_rules or ("any", "any", "any") in policy_rules:
            covered += 1
        else:
            uncovered_flows.append({
                "source": flow.get("source_ip", ""),
                "destination": flow.get("destination_ip", ""),
                "port": port,
                "protocol": flow.get("protocol", ""),
                "bytes": flow.get("bytes_total", 0),
            })
    total = len(flows)
    return {
        "total_flows": total,
        "covered_by_policy": covered,
        "uncovered": len(uncovered_flows),
        "coverage_percent": round(covered / max(total, 1) * 100, 1),
        "top_uncovered_flows": sorted(uncovered_flows, key=lambda x: x["bytes"], reverse=True)[:20],
    }


def detect_lateral_movement_risk(flows):
    """Identify potential lateral movement patterns in east-west traffic."""
    source_targets = defaultdict(set)
    for flow in flows:
        src = flow.get("source_ip", "")
        dst = flow.get("destination_ip", "")
        if src and dst and src != dst:
            source_targets[src].add(dst)
    risks = []
    for src, targets in source_targets.items():
        if len(targets) > 10:
            risks.append({"source_ip": src, "unique_targets": len(targets), "risk": "high"})
    return sorted(risks, key=lambda x: x["unique_targets"], reverse=True)


def audit_agent_health(agents):
    """Audit deployment agent health status."""
    healthy = sum(1 for a in agents if a.get("status") == "online")
    offline = sum(1 for a in agents if a.get("status") == "offline")
    return {"total": len(agents), "online": healthy, "offline": offline,
            "health_percent": round(healthy / max(len(agents), 1) * 100, 1)}


def generate_report(policies, flows, agents, api_url):
    coverage = analyze_policy_coverage(policies, flows)
    lateral = detect_lateral_movement_risk(flows)
    health = audit_agent_health(agents)
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "guardicore_url": api_url,
        "total_policies": len(policies),
        "policy_coverage": coverage,
        "lateral_movement_risks": lateral[:10],
        "agent_health": health,
    }
    return report


def main():
    parser = argparse.ArgumentParser(description="Guardicore Microsegmentation Audit Agent")
    parser.add_argument("--api-url", default=GC_API, help="Guardicore Centra API URL")
    parser.add_argument("--username", required=True, help="API username")
    parser.add_argument("--password", required=True, help="API password")
    parser.add_argument("--hours-back", type=int, default=24, help="Flow analysis window (hours)")
    parser.add_argument("--output", default="microseg_report.json")
    args = parser.parse_args()

    token = authenticate(args.api_url, args.username, args.password)
    policies = get_segmentation_policies(args.api_url, token)
    flows = get_network_flows(args.api_url, token, args.hours_back)
    agents = get_agents(args.api_url, token)
    report = generate_report(policies, flows, agents, args.api_url)
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2, default=str)
    logger.info("Coverage: %.1f%%, Agent health: %.1f%%",
                report["policy_coverage"]["coverage_percent"], report["agent_health"]["health_percent"])
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/implementing-security-chaos-engineering/scripts/agent.py`
```
#!/usr/bin/env python3
"""Agent for security chaos engineering experiments."""

import os
import json
import time
import argparse
from datetime import datetime

import boto3
from botocore.exceptions import ClientError


class ChaosExperiment:
    """Base class for security chaos experiments."""

    def __init__(self, name, description, severity="MEDIUM"):
        self.name = name
        self.description = description
        self.severity = severity
        self.start_time = None
        self.end_time = None
        self.result = None

    def run(self, setup_fn, verify_fn, rollback_fn, timeout=300):
        """Execute experiment with automatic rollback."""
        self.start_time = datetime.utcnow().isoformat()
        try:
            setup_fn()
            self.result = verify_fn(timeout)
        except Exception as e:
            self.result = {"status": "ERROR", "error": str(e)}
        finally:
            rollback_fn()
            self.end_time = datetime.utcnow().isoformat()
        return self.to_dict()

    def to_dict(self):
        return {
            "name": self.name,
            "description": self.description,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "result": self.result,
        }


def experiment_open_security_group(session, sg_id, check_interval=30, timeout=300):
    """Experiment: Open a security group and verify detection."""
    ec2 = session.client("ec2")
    config_client = session.client("config")

    def setup():
        ec2.authorize_security_group_ingress(
            GroupId=sg_id, IpProtocol="tcp", FromPort=22, ToPort=22,
            CidrIp="0.0.0.0/0",
        )
        print(f"  [!] Opened SG {sg_id} port 22 to 0.0.0.0/0")

    def verify(timeout_sec):
        elapsed = 0
        while elapsed < timeout_sec:
            time.sleep(check_interval)
            elapsed += check_interval
            results = config_client.get_compliance_details_by_config_rule(
                ConfigRuleName="restricted-ssh", ComplianceTypes=["NON_COMPLIANT"]
            )
            items = results.get("EvaluationResults", [])
            for item in items:
                resource_id = item.get("EvaluationResultIdentifier", {}).get(
                    "EvaluationResultQualifier", {}).get("ResourceId", "")
                if resource_id == sg_id:
                    return {"detected": True, "detection_time_sec": elapsed}
        return {"detected": False, "timeout": timeout_sec}

    def rollback():
        try:
            ec2.revoke_security_group_ingress(
                GroupId=sg_id, IpProtocol="tcp", FromPort=22, ToPort=22,
                CidrIp="0.0.0.0/0",
            )
            print(f"  [+] Rolled back SG {sg_id}")
        except ClientError:
            pass

    exp = ChaosExperiment("open_security_group",
                          "Verify detection of unrestricted SSH access")
    return exp.run(setup, verify, rollback, timeout)


def experiment_create_admin_user(session, username="chaos-test-admin", timeout=300):
    """Experiment: Create IAM admin user and verify detection."""
    iam = session.client("iam")
    gd = session.client("guardduty")

    def setup():
        iam.create_user(UserName=username)
        iam.attach_user_policy(
            UserName=username,
            PolicyArn="arn:aws:iam::aws:policy/AdministratorAccess",
        )
        print(f"  [!] Created admin user {username}")

    def verify(timeout_sec):
        elapsed = 0
        while elapsed < timeout_sec:
            time.sleep(30)
            elapsed += 30
            detectors = gd.list_detectors()["DetectorIds"]
            for det_id in detectors:
                findings = gd.list_findings(
                    DetectorId=det_id,
                    FindingCriteria={"Criterion": {
                        "type": {"Eq": ["Recon:IAMUser/UserPermissions"]},
                    }},
                )
                if findings.get("FindingIds"):
                    return {"detected": True, "detection_time_sec": elapsed}
        return {"detected": False, "timeout": timeout_sec}

    def rollback():
        try:
            iam.detach_user_policy(
                UserName=username,
                PolicyArn="arn:aws:iam::aws:policy/AdministratorAccess",
            )
            iam.delete_user(UserName=username)
            print(f"  [+] Rolled back user {username}")
        except ClientError:
            pass

    exp = ChaosExperiment("create_admin_user",
                          "Verify detection of unauthorized admin user creation")
    return exp.run(setup, verify, rollback, timeout)


def experiment_stop_cloudtrail(session, trail_name, timeout=300):
    """Experiment: Stop CloudTrail and verify detection."""
    ct = session.client("cloudtrail")

    def setup():
        ct.stop_logging(Name=trail_name)
        print(f"  [!] Stopped CloudTrail {trail_name}")

    def verify(timeout_sec):
        elapsed = 0
        cw = session.client("cloudwatch")
        while elapsed < timeout_sec:
            time.sleep(30)
            elapsed += 30
            alarms = cw.describe_alarms(AlarmNamePrefix="CloudTrail")
            for alarm in alarms.get("MetricAlarms", []):
                if alarm["StateValue"] == "ALARM":
                    return {"detected": True, "detection_time_sec": elapsed,
                            "alarm": alarm["AlarmName"]}
        return {"detected": False, "timeout": timeout_sec}

    def rollback():
        try:
            ct.start_logging(Name=trail_name)
            print(f"  [+] Restarted CloudTrail {trail_name}")
        except ClientError:
            pass

    exp = ChaosExperiment("stop_cloudtrail",
                          "Verify detection of CloudTrail logging disabled")
    return exp.run(setup, verify, rollback, timeout)


def dry_run_experiments():
    """List available experiments without executing them."""
    return [
        {"name": "open_security_group", "severity": "HIGH",
         "description": "Open SG port 22 to 0.0.0.0/0, verify Config Rule alert"},
        {"name": "create_admin_user", "severity": "CRITICAL",
         "description": "Create IAM admin user, verify GuardDuty detection"},
        {"name": "stop_cloudtrail", "severity": "CRITICAL",
         "description": "Stop CloudTrail logging, verify CloudWatch alarm"},
    ]


def main():
    parser = argparse.ArgumentParser(description="Security Chaos Engineering Agent")
    parser.add_argument("--profile", default=os.getenv("AWS_PROFILE"))
    parser.add_argument("--region", default=os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
    parser.add_argument("--sg-id", help="Security Group ID for SG experiment")
    parser.add_argument("--trail-name", help="CloudTrail name for trail experiment")
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--output", default="chaos_report.json")
    parser.add_argument("--action", choices=[
        "dry_run", "open_sg", "admin_user", "stop_trail", "full_suite"
    ], default="dry_run")
    args = parser.parse_args()

    report = {"generated_at": datetime.utcnow().isoformat(), "experiments": []}

    if args.action == "dry_run":
        report["experiments"] = dry_run_experiments()
        print("[+] Dry run - experiments listed but not executed")
        for exp in report["experiments"]:
            print(f"    {exp['name']}: {exp['description']}")
    else:
        session = boto3.Session(profile_name=args.profile, region_name=args.region)
        if args.action in ("open_sg", "full_suite") and args.sg_id:
            result = experiment_open_security_group(session, args.sg_id, timeout=args.timeout)
            report["experiments"].append(result)

        if args.action in ("admin_user", "full_suite"):
            result = experiment_create_admin_user(session, timeout=args.timeout)
            report["experiments"].append(result)

        if args.action in ("stop_trail", "full_suite") and args.trail_name:
            result = experiment_stop_cloudtrail(session, args.trail_name, timeout=args.timeout)
            report["experiments"].append(result)

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"[+] Report saved to {args.output}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/implementing-threat-intelligence-lifecycle-management/scripts/agent.py`
```
#!/usr/bin/env python3
"""Threat intelligence lifecycle management agent.

Manages the threat intelligence lifecycle: collection from feeds,
processing/normalization of IOCs, analysis/enrichment via VirusTotal
and AbuseIPDB, dissemination to SIEM/firewalls, and tracking of
IOC aging and confidence scoring.
"""
import argparse
import csv
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

try:
    import requests
except ImportError:
    requests = None


IOC_PATTERNS = {
    "ipv4": re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
    "domain": re.compile(r'\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b', re.I),
    "md5": re.compile(r'\b[a-fA-F0-9]{32}\b'),
    "sha1": re.compile(r'\b[a-fA-F0-9]{40}\b'),
    "sha256": re.compile(r'\b[a-fA-F0-9]{64}\b'),
    "url": re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+'),
    "email": re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'),
}


def extract_iocs(text):
    """Extract IOCs from unstructured text."""
    iocs = {}
    for ioc_type, pattern in IOC_PATTERNS.items():
        matches = set(pattern.findall(text))
        # Filter out private IPs for ipv4
        if ioc_type == "ipv4":
            matches = {ip for ip in matches
                      if not ip.startswith(("10.", "192.168.", "127.", "0."))
                      and not ip.startswith("172.") or not (16 <= int(ip.split(".")[1]) <= 31)}
        if matches:
            iocs[ioc_type] = sorted(matches)
    return iocs


def load_ioc_feed(source):
    """Load IOCs from a file (JSON, CSV, or plain text)."""
    ext = os.path.splitext(source)[1].lower()
    iocs = []

    if ext == ".json":
        with open(source, "r") as f:
            data = json.load(f)
        if isinstance(data, list):
            iocs = data
        elif isinstance(data, dict):
            iocs = data.get("indicators", data.get("iocs", data.get("data", [])))
    elif ext == ".csv":
        with open(source, "r", newline="") as f:
            reader = csv.DictReader(f)
            iocs = list(reader)
    else:
        with open(source, "r") as f:
            text = f.read()
        extracted = extract_iocs(text)
        for ioc_type, values in extracted.items():
            for v in values:
                iocs.append({"type": ioc_type, "value": v, "source": source})

    return iocs


def normalize_ioc(ioc):
    """Normalize IOC into standard format."""
    if isinstance(ioc, str):
        for ioc_type, pattern in IOC_PATTERNS.items():
            if pattern.fullmatch(ioc):
                return {"type": ioc_type, "value": ioc.lower().strip()}
        return {"type": "unknown", "value": ioc.strip()}

    return {
        "type": (ioc.get("type") or ioc.get("indicator_type") or "unknown").lower(),
        "value": (ioc.get("value") or ioc.get("indicator") or "").lower().strip(),
        "source": ioc.get("source", ""),
        "confidence": ioc.get("confidence", 50),
        "first_seen": ioc.get("first_seen", ""),
        "last_seen": ioc.get("last_seen", ""),
        "tags": ioc.get("tags", []),
        "description": ioc.get("description", ""),
    }


def enrich_ioc_virustotal(ioc_value, ioc_type, api_key):
    """Enrich IOC via VirusTotal API v3."""
    if not requests or not api_key:
        return {}

    headers = {"x-apikey": api_key}
    base = "https://www.virustotal.com/api/v3"

    if ioc_type in ("md5", "sha1", "sha256"):
        url = f"{base}/files/{ioc_value}"
    elif ioc_type == "domain":
        url = f"{base}/domains/{ioc_value}"
    elif ioc_type == "ipv4":
        url = f"{base}/ip_addresses/{ioc_value}"
    elif ioc_type == "url":
        url_id = hashlib.sha256(ioc_value.encode()).hexdigest()
        url = f"{base}/urls/{url_id}"
    else:
        return {}

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            data = resp.json().get("data", {}).get("attributes", {})
            stats = data.get("last_analysis_stats", {})
            return {
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "harmless": stats.get("harmless", 0),
                "undetected": stats.get("undetected", 0),
                "reputation": data.get("reputation", 0),
                "source": "virustotal",
            }
    except requests.RequestException:
        pass
    return {}


def calculate_confidence(ioc, enrichment=None):
    """Calculate confidence score for an IOC (0-100)."""
    score = ioc.get("confidence", 50)

    # Boost for VT detections
    if enrichment:
        malicious = enrichment.get("malicious", 0)
        if malicious > 10:
            score = min(score + 30, 100)
        elif malicious > 5:
            score = min(score + 20, 100)
        elif malicious > 0:
            score = min(score + 10, 100)
        elif enrichment.get("harmless", 0) > 20:
            score = max(score - 20, 0)

    # Decay based on age
    first_seen = ioc.get("first_seen", "")
    if first_seen:
        try:
            if "T" in first_seen:
                seen_dt = datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
            else:
                seen_dt = datetime.strptime(first_seen[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - seen_dt).days
            if age_days > 180:
                score = max(score - 20, 0)
            elif age_days > 90:
                score = max(score - 10, 0)
        except (ValueError, TypeError):
            pass

    return min(max(score, 0), 100)


def format_summary(iocs, enriched_count):
    """Print lifecycle report."""
    print(f"\n{'='*60}")
    print(f"  Threat Intelligence Lifecycle Report")
    print(f"{'='*60}")
    print(f"  Total IOCs    : {len(iocs)}")
    print(f"  Enriched      : {enriched_count}")

    by_type = {}
    for ioc in iocs:
        t = ioc.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
    print(f"\n  By Type:")
    for t, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"    {t:12s}: {count}")

    high_conf = [i for i in iocs if i.get("confidence", 0) >= 80]
    med_conf = [i for i in iocs if 50 <= i.get("confidence", 0) < 80]
    low_conf = [i for i in iocs if i.get("confidence", 0) < 50]
    print(f"\n  By Confidence:")
    print(f"    High (>=80) : {len(high_conf)}")
    print(f"    Medium      : {len(med_conf)}")
    print(f"    Low (<50)   : {len(low_conf)}")

    if high_conf:
        print(f"\n  High-Confidence IOCs:")
        for i in high_conf[:15]:
            print(f"    [{i['type']:8s}] {i['value'][:50]:50s} (confidence: {i.get('confidence', 0)})")


def main():
    parser = argparse.ArgumentParser(description="Threat intelligence lifecycle management agent")
    parser.add_argument("--source", required=True, help="IOC source file (JSON/CSV/text)")
    parser.add_argument("--vt-key", help="VirusTotal API key (or VT_API_KEY env)")
    parser.add_argument("--enrich", action="store_true", help="Enrich IOCs via VirusTotal")
    parser.add_argument("--min-confidence", type=int, default=0, help="Min confidence to include")
    parser.add_argument("--output", "-o", help="Output JSON report")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    vt_key = args.vt_key or os.environ.get("VT_API_KEY", "")

    raw_iocs = load_ioc_feed(args.source)
    print(f"[*] Loaded {len(raw_iocs)} raw IOCs from {args.source}")

    iocs = [normalize_ioc(ioc) for ioc in raw_iocs]
    iocs = [i for i in iocs if i.get("value")]

    # Deduplicate
    seen = set()
    unique_iocs = []
    for ioc in iocs:
        key = f"{ioc['type']}:{ioc['value']}"
        if key not in seen:
            seen.add(key)
            unique_iocs.append(ioc)
    iocs = unique_iocs
    print(f"[*] {len(iocs)} unique IOCs after dedup")

    enriched_count = 0
    if args.enrich and vt_key:
        print(f"[*] Enriching IOCs via VirusTotal...")
        for ioc in iocs[:100]:  # Rate limit
            enrichment = enrich_ioc_virustotal(ioc["value"], ioc["type"], vt_key)
            if enrichment:
                ioc["enrichment"] = enrichment
                enriched_count += 1
            ioc["confidence"] = calculate_confidence(ioc, enrichment)
    else:
        for ioc in iocs:
            ioc["confidence"] = calculate_confidence(ioc)

    iocs = [i for i in iocs if i.get("confidence", 0) >= args.min_confidence]
    iocs.sort(key=lambda x: -x.get("confidence", 0))

    format_summary(iocs, enriched_count)

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tool": "TI Lifecycle Manager",
        "source": args.source,
        "total_iocs": len(iocs),
        "enriched": enriched_count,
        "iocs": iocs,
    }

    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\n[+] Report saved to {args.output}")
    elif args.verbose:
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/managing-intelligence-lifecycle/scripts/agent.py`
```
#!/usr/bin/env python3
"""
Cyber Threat Intelligence Lifecycle Management Agent
Manages the CTI lifecycle from requirements gathering through dissemination,
tracking PIRs, collection sources, and intelligence product metrics.
"""

import json
import os
import sys
from datetime import datetime, timezone


def load_intelligence_requirements(filepath: str) -> list[dict]:
    """Load Priority Intelligence Requirements (PIRs) from config."""
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return json.load(f)

    return [
        {"id": "PIR-001", "requirement": "Which threat actors are actively targeting our industry sector?",
         "stakeholder": "CISO", "priority": "HIGH", "status": "active", "review_date": "2024-06-01"},
        {"id": "PIR-002", "requirement": "What new vulnerabilities affect our technology stack?",
         "stakeholder": "VP Engineering", "priority": "HIGH", "status": "active", "review_date": "2024-06-01"},
        {"id": "PIR-003", "requirement": "Are any of our credentials or data exposed on dark web?",
         "stakeholder": "CISO", "priority": "MEDIUM", "status": "active", "review_date": "2024-06-01"},
    ]


def evaluate_collection_sources(sources_file: str) -> list[dict]:
    """Evaluate intelligence collection source coverage and quality."""
    if os.path.exists(sources_file):
        with open(sources_file, "r") as f:
            return json.load(f)

    return [
        {"name": "MITRE ATT&CK", "type": "open-source", "category": "TTPs",
         "reliability": "A", "update_freq": "quarterly", "pirs_covered": ["PIR-001"]},
        {"name": "NVD/CVE", "type": "open-source", "category": "vulnerabilities",
         "reliability": "A", "update_freq": "daily", "pirs_covered": ["PIR-002"]},
        {"name": "Recorded Future", "type": "commercial", "category": "multi-source",
         "reliability": "B", "update_freq": "real-time", "pirs_covered": ["PIR-001", "PIR-002", "PIR-003"]},
        {"name": "VirusTotal", "type": "commercial", "category": "IOCs",
         "reliability": "B", "update_freq": "real-time", "pirs_covered": ["PIR-001"]},
        {"name": "ISAC Feeds", "type": "sharing-community", "category": "sector-specific",
         "reliability": "B", "update_freq": "weekly", "pirs_covered": ["PIR-001", "PIR-002"]},
    ]


def assess_pir_coverage(pirs: list[dict], sources: list[dict]) -> dict:
    """Assess how well collection sources cover PIRs."""
    coverage = {}
    for pir in pirs:
        pir_id = pir["id"]
        covering_sources = [s["name"] for s in sources if pir_id in s.get("pirs_covered", [])]
        coverage[pir_id] = {
            "requirement": pir["requirement"],
            "priority": pir["priority"],
            "sources_count": len(covering_sources),
            "sources": covering_sources,
            "gap": len(covering_sources) == 0,
        }

    total_pirs = len(pirs)
    covered_pirs = sum(1 for c in coverage.values() if not c["gap"])
    gap_pirs = [pid for pid, c in coverage.items() if c["gap"]]

    return {
        "total_pirs": total_pirs,
        "covered_pirs": covered_pirs,
        "coverage_pct": round(covered_pirs / max(total_pirs, 1) * 100, 1),
        "gaps": gap_pirs,
        "details": coverage,
    }


def track_intelligence_products(products_file: str) -> dict:
    """Track intelligence products and dissemination metrics."""
    if os.path.exists(products_file):
        with open(products_file, "r") as f:
            products = json.load(f)
    else:
        products = [
            {"id": "PROD-001", "type": "Weekly Threat Briefing", "audience": "SOC Team",
             "frequency": "weekly", "last_published": "2024-03-08", "feedback_score": 4.2},
            {"id": "PROD-002", "type": "Threat Actor Profile", "audience": "Executive Leadership",
             "frequency": "monthly", "last_published": "2024-03-01", "feedback_score": 3.8},
            {"id": "PROD-003", "type": "IOC Feed", "audience": "SIEM/EDR",
             "frequency": "daily", "last_published": "2024-03-15", "feedback_score": 4.5},
            {"id": "PROD-004", "type": "Vulnerability Intelligence", "audience": "Engineering",
             "frequency": "weekly", "last_published": "2024-03-10", "feedback_score": 4.0},
        ]

    overdue = []
    for prod in products:
        last = datetime.strptime(prod["last_published"], "%Y-%m-%d")
        freq_days = {"daily": 1, "weekly": 7, "monthly": 30, "quarterly": 90}
        expected_interval = freq_days.get(prod["frequency"], 30)
        days_since = (datetime.now() - last).days
        if days_since > expected_interval * 1.5:
            overdue.append({"product": prod["type"], "days_overdue": days_since - expected_interval})

    avg_feedback = sum(p["feedback_score"] for p in products) / max(len(products), 1)

    return {
        "total_products": len(products),
        "overdue_products": overdue,
        "avg_feedback_score": round(avg_feedback, 2),
        "products": products,
    }


def assess_maturity(pir_coverage: dict, products: dict, sources: list) -> dict:
    """Assess CTI program maturity using simplified FIRST CTI-SIG model."""
    scores = {}

    scores["planning_direction"] = min(5, 1 + (pir_coverage["total_pirs"] // 2))
    scores["collection"] = min(5, 1 + len(sources) // 2)
    scores["processing"] = 3 if products["total_products"] > 2 else 2
    scores["analysis"] = 3 if pir_coverage["coverage_pct"] > 80 else 2
    scores["dissemination"] = min(5, 1 + products["total_products"])
    scores["feedback"] = 4 if products["avg_feedback_score"] > 4.0 else 3

    overall = round(sum(scores.values()) / len(scores), 1)

    return {"dimension_scores": scores, "overall_maturity": overall, "maturity_level": (
        "Initial" if overall < 2 else "Developing" if overall < 3 else
        "Defined" if overall < 4 else "Managed" if overall < 4.5 else "Optimizing"
    )}


def generate_report(pirs: list, coverage: dict, products: dict, maturity: dict) -> str:
    """Generate CTI lifecycle management report."""
    lines = [
        "CYBER THREAT INTELLIGENCE LIFECYCLE REPORT",
        "=" * 50,
        f"Report Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        f"PIR COVERAGE: {coverage['coverage_pct']}%",
        f"  Total PIRs: {coverage['total_pirs']}",
        f"  Covered: {coverage['covered_pirs']}",
        f"  Gaps: {len(coverage['gaps'])}",
        "",
        f"INTELLIGENCE PRODUCTS:",
        f"  Active Products: {products['total_products']}",
        f"  Overdue: {len(products['overdue_products'])}",
        f"  Avg Feedback Score: {products['avg_feedback_score']}/5.0",
        "",
        f"PROGRAM MATURITY: {maturity['maturity_level']} ({maturity['overall_maturity']}/5.0)",
    ]
    for dim, score in maturity["dimension_scores"].items():
        lines.append(f"  {dim}: {score}/5")

    return "\n".join(lines)


if __name__ == "__main__":
    pir_file = sys.argv[1] if len(sys.argv) > 1 else "pirs.json"
    sources_file = sys.argv[2] if len(sys.argv) > 2 else "sources.json"
    products_file = sys.argv[3] if len(sys.argv) > 3 else "products.json"

    print("[*] CTI Lifecycle Management Assessment")
    pirs = load_intelligence_requirements(pir_file)
    sources = evaluate_collection_sources(sources_file)
    coverage = assess_pir_coverage(pirs, sources)
    products = track_intelligence_products(products_file)
    maturity = assess_maturity(coverage, products, sources)

    report = generate_report(pirs, coverage, products, maturity)
    print(report)

    output = f"cti_lifecycle_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
    with open(output, "w") as f:
        json.dump({"pirs": pirs, "coverage": coverage, "products": products, "maturity": maturity}, f, indent=2)
    print(f"\n[*] Results saved to {output}")

```

### Core Architecture Module: `skills/performing-indicator-lifecycle-management/scripts/agent.py`
```
#!/usr/bin/env python3
"""Agent for performing indicator of compromise (IOC) lifecycle management."""

import json
import argparse
import csv
import re
from datetime import datetime
from pathlib import Path


IOC_PATTERNS = {
    "ipv4": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
    "domain": re.compile(r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b"),
    "md5": re.compile(r"\b[a-f0-9]{32}\b", re.I),
    "sha256": re.compile(r"\b[a-f0-9]{64}\b", re.I),
    "sha1": re.compile(r"\b[a-f0-9]{40}\b", re.I),
    "url": re.compile(r"https?://[^\s<>\"']+"),
    "email": re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b"),
    "cve": re.compile(r"CVE-\d{4}-\d{4,}", re.I),
}


def extract_iocs(text_file):
    """Extract IOCs from a text file or report."""
    text = Path(text_file).read_text(encoding="utf-8", errors="replace")
    extracted = {}
    for ioc_type, pattern in IOC_PATTERNS.items():
        matches = list(set(pattern.findall(text)))
        if matches:
            extracted[ioc_type] = matches[:100]
    total = sum(len(v) for v in extracted.values())
    return {"source": text_file, "total_iocs": total, "by_type": {k: len(v) for k, v in extracted.items()}, "indicators": extracted}


def ingest_ioc_feed(csv_file):
    """Ingest IOC feed from CSV and normalize."""
    with open(csv_file, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    iocs = []
    for row in rows:
        indicator = row.get("indicator", row.get("ioc", row.get("value", row.get("Indicator", ""))))
        ioc_type = row.get("type", row.get("ioc_type", row.get("Type", "")))
        if not ioc_type:
            for t, p in IOC_PATTERNS.items():
                if p.fullmatch(indicator.strip()):
                    ioc_type = t
                    break
        iocs.append({
            "indicator": indicator.strip(),
            "type": ioc_type,
            "source": row.get("source", row.get("feed", "")),
            "confidence": row.get("confidence", row.get("score", "")),
            "first_seen": row.get("first_seen", row.get("date", "")),
            "tags": row.get("tags", row.get("malware_family", "")),
        })
    return {"total_ingested": len(iocs), "by_type": _count_field(iocs, "type"), "iocs": iocs[:50]}


def check_expiration(ioc_db_file, ttl_days=90):
    """Check IOC database for expired indicators based on TTL."""
    with open(ioc_db_file, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    now = datetime.utcnow()
    expired = []
    active = []
    for row in rows:
        date_str = row.get("first_seen", row.get("date", row.get("added", "")))
        try:
            added = datetime.fromisoformat(date_str.replace("Z", "+00:00").replace("+00:00", ""))
        except (ValueError, AttributeError):
            active.append(row)
            continue
        age_days = (now - added).days
        if age_days > ttl_days:
            expired.append({**row, "age_days": age_days})
        else:
            active.append(row)
    return {
        "total": len(rows), "active": len(active), "expired": len(expired),
        "ttl_days": ttl_days, "expired_indicators": expired[:30],
    }


def deduplicate_iocs(csv_file):
    """Deduplicate IOCs and merge metadata from multiple sources."""
    with open(csv_file, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    seen = {}
    for row in rows:
        key = row.get("indicator", row.get("ioc", row.get("value", ""))).strip().lower()
        if key in seen:
            seen[key]["sources"].add(row.get("source", ""))
            seen[key]["count"] += 1
        else:
            seen[key] = {"indicator": key, "type": row.get("type", ""), "sources": {row.get("source", "")}, "count": 1, "first_row": row}
    unique = [{"indicator": v["indicator"], "type": v["type"], "sources": list(v["sources"]), "occurrences": v["count"]}
              for v in seen.values()]
    return {
        "original_count": len(rows), "unique_count": len(unique),
        "duplicates_removed": len(rows) - len(unique),
        "multi_source": [u for u in unique if u["occurrences"] > 1][:20],
        "unique_iocs": unique[:50],
    }


def generate_lifecycle_report(csv_file, ttl_days=90):
    """Generate full IOC lifecycle status report."""
    ingested = ingest_ioc_feed(csv_file)
    expiration = check_expiration(csv_file, ttl_days)
    dedup = deduplicate_iocs(csv_file)
    return {
        "generated": datetime.utcnow().isoformat(),
        "total_iocs": ingested["total_ingested"],
        "unique_iocs": dedup["unique_count"],
        "duplicates": dedup["duplicates_removed"],
        "active": expiration["active"],
        "expired": expiration["expired"],
        "by_type": ingested["by_type"],
        "ttl_days": ttl_days,
    }


def _count_field(items, field):
    counts = {}
    for item in items:
        val = item.get(field, "unknown")
        counts[val] = counts.get(val, 0) + 1
    return counts


def main():
    parser = argparse.ArgumentParser(description="IOC Lifecycle Management Agent")
    sub = parser.add_subparsers(dest="command")
    e = sub.add_parser("extract", help="Extract IOCs from text")
    e.add_argument("--file", required=True)
    i = sub.add_parser("ingest", help="Ingest IOC feed CSV")
    i.add_argument("--csv", required=True)
    x = sub.add_parser("expire", help="Check IOC expiration")
    x.add_argument("--csv", required=True)
    x.add_argument("--ttl", type=int, default=90, help="TTL in days")
    d = sub.add_parser("dedup", help="Deduplicate IOCs")
    d.add_argument("--csv", required=True)
    r = sub.add_parser("report", help="Full lifecycle report")
    r.add_argument("--csv", required=True)
    r.add_argument("--ttl", type=int, default=90)
    args = parser.parse_args()
    if args.command == "extract":
        result = extract_iocs(args.file)
    elif args.command == "ingest":
        result = ingest_ioc_feed(args.csv)
    elif args.command == "expire":
        result = check_expiration(args.csv, args.ttl)
    elif args.command == "dedup":
        result = deduplicate_iocs(args.csv)
    elif args.command == "report":
        result = generate_lifecycle_report(args.csv, args.ttl)
    else:
        parser.print_help()
        return
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/performing-indicator-lifecycle-management/scripts/process.py`
```
#!/usr/bin/env python3
"""
Indicator Lifecycle Management Script

Manages IOC lifecycle: discovery, validation, deployment, monitoring, retirement.

Requirements: pip install requests

Usage:
    python process.py --import-iocs iocs.csv --output lifecycle_db.json
    python process.py --decay --db lifecycle_db.json
    python process.py --review --db lifecycle_db.json --output review_report.json
"""

import argparse
import csv
import json
import sys
from datetime import datetime, timedelta


class IOCLifecycleManager:
    def __init__(self):
        self.indicators = {}

    def add_indicator(self, ioc_type, value, source, confidence=50):
        key = f"{ioc_type}:{value}"
        self.indicators[key] = {
            "type": ioc_type, "value": value, "source": source,
            "confidence": confidence, "state": "discovered",
            "created": datetime.utcnow().isoformat(),
            "last_updated": datetime.utcnow().isoformat(),
            "hit_count": 0, "fp_count": 0, "last_seen": None,
        }

    def apply_decay(self):
        half_lives = {"ip": 30, "domain": 90, "hash": 365, "url": 60, "email": 180}
        for key, ioc in self.indicators.items():
            if ioc["state"] == "retired":
                continue
            hl = half_lives.get(ioc["type"], 90)
            age = (datetime.utcnow() - datetime.fromisoformat(ioc["created"])).days
            decay = 0.5 ** (age / hl)
            ioc["confidence"] = max(0, int(ioc["confidence"] * decay))
            if ioc["confidence"] < 10:
                ioc["state"] = "under_review"

    def review_indicators(self):
        review = {"retire": [], "keep": [], "boost": []}
        for key, ioc in self.indicators.items():
            age = (datetime.utcnow() - datetime.fromisoformat(ioc["created"])).days
            max_ages = {"ip": 90, "domain": 180, "hash": 730, "url": 120}
            max_age = max_ages.get(ioc["type"], 180)

            if age > max_age and ioc["hit_count"] == 0:
                review["retire"].append(key)
                ioc["state"] = "retired"
            elif ioc["fp_count"] > 3:
                review["retire"].append(key)
                ioc["state"] = "retired"
            elif ioc["hit_count"] > 5:
                review["boost"].append(key)
                ioc["confidence"] = min(100, ioc["confidence"] + 10)
            else:
                review["keep"].append(key)
        return review

    def get_stats(self):
        states = {}
        for ioc in self.indicators.values():
            states[ioc["state"]] = states.get(ioc["state"], 0) + 1
        return {
            "total": len(self.indicators),
            "by_state": states,
            "avg_confidence": (
                sum(i["confidence"] for i in self.indicators.values()) / len(self.indicators)
                if self.indicators else 0
            ),
        }

    def load(self, filepath):
        with open(filepath) as f:
            self.indicators = json.load(f)

    def save(self, filepath):
        with open(filepath, "w") as f:
            json.dump(self.indicators, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="IOC Lifecycle Manager")
    parser.add_argument("--import-iocs", help="CSV file with IOCs")
    parser.add_argument("--decay", action="store_true", help="Apply confidence decay")
    parser.add_argument("--review", action="store_true", help="Review indicators")
    parser.add_argument("--stats", action="store_true", help="Show statistics")
    parser.add_argument("--db", default="lifecycle_db.json", help="Database file")
    parser.add_argument("--output", default="lifecycle_report.json")
    args = parser.parse_args()

    mgr = IOCLifecycleManager()
    try:
        mgr.load(args.db)
    except FileNotFoundError:
        pass

    if args.import_iocs:
        with open(args.import_iocs) as f:
            reader = csv.DictReader(f)
            for row in reader:
                mgr.add_indicator(
                    row.get("type", "ip"), row.get("value", ""),
                    row.get("source", "import"), int(row.get("confidence", 50)),
                )
        mgr.save(args.db)

    if args.decay:
        mgr.apply_decay()
        mgr.save(args.db)

    if args.review:
        result = mgr.review_indicators()
        mgr.save(args.db)
        print(json.dumps(result, indent=2))

    if args.stats:
        print(json.dumps(mgr.get_stats(), indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/performing-ssl-certificate-lifecycle-management/scripts/agent.py`
```
#!/usr/bin/env python3
"""Agent for SSL/TLS certificate lifecycle management.

Generates CSRs, parses X.509 certificates using the cryptography
library, monitors expiration across infrastructure, checks OCSP
revocation status, and maintains a certificate inventory.
"""

import json
import sys
import ssl
import socket
from datetime import datetime
from pathlib import Path

try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec, rsa
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


class CertLifecycleAgent:
    """Manages SSL/TLS certificate lifecycle operations."""

    def __init__(self, output_dir="./cert_inventory"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.inventory = []

    def generate_csr(self, common_name, org="", country="US",
                     san_names=None, key_type="ecdsa"):
        """Generate a private key and Certificate Signing Request."""
        if not HAS_CRYPTO:
            return {"error": "cryptography library required"}

        if key_type == "ecdsa":
            private_key = ec.generate_private_key(ec.SECP256R1())
        else:
            private_key = rsa.generate_private_key(
                public_exponent=65537, key_size=2048)

        subject = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, country),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, org or common_name),
            x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        ])

        builder = x509.CertificateSigningRequestBuilder().subject_name(subject)

        if san_names:
            sans = [x509.DNSName(n) for n in san_names]
            builder = builder.add_extension(
                x509.SubjectAlternativeName(sans), critical=False)

        csr = builder.sign(private_key, hashes.SHA256())

        key_path = self.output_dir / f"{common_name}.key"
        csr_path = self.output_dir / f"{common_name}.csr"

        key_path.write_bytes(private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption()))
        csr_path.write_bytes(csr.public_bytes(serialization.Encoding.PEM))

        return {"common_name": common_name, "key_file": str(key_path),
                "csr_file": str(csr_path), "key_type": key_type}

    def fetch_remote_cert(self, hostname, port=443):
        """Fetch and parse a certificate from a remote server."""
        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
                s.settimeout(10)
                s.connect((hostname, port))
                der = s.getpeercert(binary_form=True)
                pem_info = s.getpeercert()

            not_after = datetime.strptime(
                pem_info["notAfter"], "%b %d %H:%M:%S %Y %Z")
            not_before = datetime.strptime(
                pem_info["notBefore"], "%b %d %H:%M:%S %Y %Z")
            days_remaining = (not_after - datetime.utcnow()).days

            subject = dict(x[0] for x in pem_info.get("subject", ()))
            issuer = dict(x[0] for x in pem_info.get("issuer", ()))
            sans = [entry[1] for entry in pem_info.get("subjectAltName", ())]

            entry = {
                "hostname": hostname, "port": port,
                "subject_cn": subject.get("commonName", ""),
                "issuer_cn": issuer.get("commonName", ""),
                "issuer_org": issuer.get("organizationName", ""),
                "not_before": not_before.isoformat(),
                "not_after": not_after.isoformat(),
                "days_remaining": days_remaining,
                "san": sans[:20],
                "serial": pem_info.get("serialNumber", ""),
                "version": pem_info.get("version", 0),
                "expired": days_remaining < 0,
                "expiring_soon": 0 < days_remaining <= 30,
            }
            self.inventory.append(entry)
            return entry

        except (socket.error, ssl.SSLError, OSError) as exc:
            return {"hostname": hostname, "error": str(exc)}

    def scan_hosts(self, hostnames, port=443):
        """Scan multiple hosts and collect certificate data."""
        results = []
        for host in hostnames:
            result = self.fetch_remote_cert(host, port)
            results.append(result)
        return results

    def check_expiring(self, threshold_days=30):
        """Return certificates expiring within threshold days."""
        return [c for c in self.inventory
                if c.get("days_remaining", 999) <= threshold_days
                and "error" not in c]

    def generate_report(self):
        """Generate certificate inventory report."""
        expiring = self.check_expiring(30)
        expired = [c for c in self.inventory if c.get("expired")]

        report = {
            "report_date": datetime.utcnow().isoformat(),
            "total_certificates": len(self.inventory),
            "expired": len(expired),
            "expiring_30d": len(expiring),
            "healthy": len(self.inventory) - len(expired) - len(expiring),
            "certificates": self.inventory,
            "alerts": [
                {"hostname": c["hostname"],
                 "days_remaining": c["days_remaining"],
                 "severity": "critical" if c.get("expired") else "warning"}
                for c in expired + expiring
            ],
        }

        report_path = self.output_dir / "cert_inventory_report.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(json.dumps(report, indent=2, default=str))
        return report


def main():
    hosts = sys.argv[1:] if len(sys.argv) > 1 else [
        "google.com", "github.com", "expired.badssl.com"]
    agent = CertLifecycleAgent()
    agent.scan_hosts(hosts)
    agent.generate_report()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/performing-ssl-certificate-lifecycle-management/scripts/process.py`
```
#!/usr/bin/env python3
"""
SSL Certificate Lifecycle Management Tool

Implements certificate generation, parsing, monitoring, chain validation,
and OCSP checking for managing TLS certificate lifecycles.

Requirements:
    pip install cryptography requests

Usage:
    python process.py generate-csr --domain example.com --output ./certs
    python process.py check-expiry --host example.com
    python process.py parse-cert --cert ./server.crt
    python process.py monitor --domains domains.txt --threshold 30
    python process.py verify-chain --cert ./server.crt --ca-bundle ./ca-bundle.crt
"""

import os
import ssl
import sys
import json
import socket
import argparse
import logging
import datetime
from pathlib import Path
from typing import Dict, List, Optional

from cryptography import x509
from cryptography.x509.oid import NameOID, ExtensionOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.hazmat.backends import default_backend

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

EXPIRY_WARNING_DAYS = 30
EXPIRY_CRITICAL_DAYS = 15


def generate_csr(
    domain: str,
    output_dir: str,
    key_type: str = "ecdsa",
    san_domains: Optional[List[str]] = None,
    organization: Optional[str] = None,
) -> Dict:
    """Generate a private key and CSR for a domain."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    if key_type == "ecdsa":
        private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    else:
        private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=4096, backend=default_backend()
        )

    subject_attrs = [
        x509.NameAttribute(NameOID.COMMON_NAME, domain),
    ]
    if organization:
        subject_attrs.insert(0, x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization))

    subject = x509.Name(subject_attrs)

    san_list = [x509.DNSName(domain)]
    if san_domains:
        for d in san_domains:
            san_list.append(x509.DNSName(d))

    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(subject)
        .add_extension(x509.SubjectAlternativeName(san_list), critical=False)
        .sign(private_key, hashes.SHA256(), default_backend())
    )

    key_path = output_path / f"{domain}.key"
    csr_path = output_path / f"{domain}.csr"

    key_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )

    csr_path.write_bytes(csr.public_bytes(serialization.Encoding.PEM))

    logger.info(f"Generated CSR for {domain}")

    return {
        "domain": domain,
        "key_type": key_type,
        "key_path": str(key_path),
        "csr_path": str(csr_path),
        "san_domains": [d.value for d in san_list],
    }


def parse_certificate(cert_path: str) -> Dict:
    """Parse an X.509 certificate and extract key information."""
    cert_data = Path(cert_path).read_bytes()

    if b"-----BEGIN CERTIFICATE-----" in cert_data:
        cert = x509.load_pem_x509_certificate(cert_data, default_backend())
    else:
        cert = x509.load_der_x509_certificate(cert_data, default_backend())

    subject_attrs = {}
    for attr in cert.subject:
        subject_attrs[attr.oid._name] = attr.value

    issuer_attrs = {}
    for attr in cert.issuer:
        issuer_attrs[attr.oid._name] = attr.value

    san_names = []
    try:
        san_ext = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
        san_names = [name.value for name in san_ext.value.get_values_for_type(x509.DNSName)]
    except x509.ExtensionNotFound:
        pass

    now = datetime.datetime.utcnow()
    not_after = cert.not_valid_after_utc.replace(tzinfo=None)
    days_remaining = (not_after - now).days

    pub_key = cert.public_key()
    if isinstance(pub_key, rsa.RSAPublicKey):
        key_info = {"type": "RSA", "size": pub_key.key_size}
    elif isinstance(pub_key, ec.EllipticCurvePublicKey):
        key_info = {"type": "ECDSA", "curve": pub_key.curve.name, "size": pub_key.key_size}
    else:
        key_info = {"type": "Unknown"}

    return {
        "subject": subject_attrs,
        "issuer": issuer_attrs,
        "serial_number": hex(cert.serial_number),
        "not_valid_before": cert.not_valid_before_utc.isoformat(),
        "not_valid_after": cert.not_valid_after_utc.isoformat(),
        "days_remaining": days_remaining,
        "san_domains": san_names,
        "signature_algorithm": cert.signature_algorithm_oid._name,
        "public_key": key_info,
        "version": cert.version.value,
        "is_expired": days_remaining < 0,
        "fingerprint_sha256": cert.fingerprint(hashes.SHA256()).hex(),
    }


def check_remote_certificate(host: str, port: int = 443, timeout: int = 10) -> Dict:
    """Check the TLS certificate of a remote host."""
    result = {
        "host": host,
        "port": port,
        "status": "unknown",
        "days_remaining": None,
        "certificate": None,
        "errors": [],
    }

    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert_der = ssock.getpeercert(binary_form=True)
                cert = x509.load_der_x509_certificate(cert_der, default_backend())

                now = datetime.datetime.utcnow()
                not_after = cert.not_valid_after_utc.replace(tzinfo=None)
                days_remaining = (not_after - now).days

                result["days_remaining"] = days_remaining
                result["not_after"] = not_after.isoformat()
                result["protocol"] = ssock.version()
                result["cipher"] = ssock.cipher()[0]

                subject_cn = None
                for attr in cert.subject:
                    if attr.oid == NameOID.COMMON_NAME:
                        subject_cn = attr.value
                        break

                result["common_name"] = subject_cn
                result["fingerprint_sha256"] = cert.fingerprint(hashes.SHA256()).hex()

                if days_remaining < 0:
                    result["status"] = "EXPIRED"
                elif days_remaining < EXPIRY_CRITICAL_DAYS:
                    result["status"] = "CRITICAL"
                elif days_remaining < EXPIRY_WARNING_DAYS:
                    result["status"] = "WARNING"
                else:
                    result["status"] = "OK"

    except ssl.SSLCertVerificationError as e:
        result["status"] = "INVALID"
        result["errors"].append(f"Certificate verification failed: {e}")
    except socket.timeout:
        result["status"] = "TIMEOUT"
        result["errors"].append("Connection timed out")
    except Exception as e:
        result["status"] = "ERROR"
        result["errors"].append(str(e))

    return result


def monitor_domains(domains: List[str], threshold_days: int = 30) -> Dict:
    """Monitor certificate expiration for multiple domains."""
    results = {
        "scan_time": datetime.datetime.utcnow().isoformat() + "Z",
        "threshold_days": threshold_days,
        "total_domains": len(domains),
        "ok": 0,
        "warning": 0,
        "critical": 0,
        "expired": 0,
        "errors": 0,
        "domains": [],
    }

    for domain in domains:
        domain = domain.strip()
        if not domain or domain.startswith("#"):
            continue

        host = domain.split(":")[0]
        port = int(domain.split(":")[1]) if ":" in domain else 443

        logger.info(f"Checking {host}:{port}...")
        check = check_remote_certificate(host, port)
        results["domains"].append(check)

        status = check["status"]
        if status == "OK":
            results["ok"] += 1
        elif status == "WARNING":
            results["warning"] += 1
        elif status == "CRITICAL":
            results["critical"] += 1
        elif status == "EXPIRED":
            results["expired"] += 1
        else:
            results["errors"] += 1

    return results


def verify_certificate_chain(cert_path: str, ca_bundle_path: str) -> Dict:
    """Verify a certificate chain against a CA bundle."""
    cert_data = Path(cert_path).read_bytes()
    ca_data = Path(ca_bundle_path).read_bytes()

    cert = x509.load_pem_x509_certificate(cert_data, default_backend())

    ca_certs = []
    pem_blocks = ca_data.split(b"-----END CERTIFICATE-----")
    for block in pem_blocks:
        block = block.strip()
        if block and b"-----BEGIN CERTIFICATE-----" in block:
            pem = block + b"\n-----END CERTIFICATE-----\n"
            ca_certs.append(x509.load_pem_x509_certificate(pem, default_backend()))

    chain = []
    current = cert
    chain.append({
        "subject": current.subject.rfc4514_string(),
        "issuer": current.issuer.rfc4514_string(),
    })

    for ca in ca_certs:
        if current.issuer == ca.subject:
            chain.append({
                "subject": ca.subject.rfc4514_string(),
                "issuer": ca.issuer.rfc4514_string(),
            })
            current = ca
            if ca.issuer == ca.subject:
                break

    is_self_signed = cert.issuer == cert.subject
    chain_complete = len(chain) > 1 or is_self_signed

    return {
        "certificate": cert.subject.rfc4514_string(),
        "chain_length": len(chain),
        "chain": chain,
        "chain_complete": chain_complete,
        "is_self_signed": is_self_signed,
    }


def main():
    parser = argparse.ArgumentParser(description="SSL Certificate Lifecycle Tool")
    subparsers = parser.add_subparsers(dest="command")

    csr = subparsers.add_parser("generat
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #79** (2026-06-20): **[Bug]: Windows Defender quarantines supply-chain api-reference.md as Trojan:Script/Stealer.HAX!MTB**
  *Symptoms*: ### Skill Name  analyzing-supply-chain-malware-artifacts  ### Bug Type  Other  ### Description     Microsoft Defender quarantines the following documentation file as a severe Trojan:    `skills/analyzing-supply-chain-malware-artifacts/references/api-reference.md`    Detection details:    - Threat: `Trojan:Script/Stealer.HAX!MTB`   - Threat ID: `2147971254`   - Defender security intelligence: `1.453.90.0`   - File blob SHA: `932dc27dbe0644adff6b5654e05265ea5f9a4353`   - Action: Quarantined successfully   - Execution status: `DidThreatExecute: False`   - Platform: Windows 11    The detection occurred when Git's `grep.exe` read the file. Nothing from the file was executed.   Likely Trigger    The likely trigger is the intentionally malicious npm installation-hook example near the end of the file, particularly   the example that downloads content and pipes it directly to a shell.    Although this is clearly documentation for malware analysis, Defender appears to classify the complete Markdown file   as a script-based stealer.   Impact    Defender automatically removes the tracked file, leaving the repository worktree dirty:    ```text   D skills/analyzing-supply-chain-malware-artifacts/references/api-reference.md    The alert can recur whenever the repository is cloned, restored, updated, searched, or scanned.  ### Expected Behavior  Please consider defanging the example so it still communicates the risk without matching executable malware   signatures. For example:    - Use a de

- **Issue #65** (2026-05-27): **[Bug]: can't install via NPX**
  *Symptoms*: ### Skill Name  main   ### Bug Type  SKILL.md validation error  ### Description  ```  ✗ sfw npx skills add mukul975/Anthropic-Cybersecurity-Skills Protected by Socket Firewall  ███████╗██╗  ██╗██╗██╗     ██╗     ███████╗ ██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝ ███████╗█████╔╝ ██║██║     ██║     ███████╗ ╚════██║██╔═██╗ ██║██║     ██║     ╚════██║ ███████║██║  ██╗██║███████╗███████╗███████║ ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝  ┌   skills │ ◇  Source: https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git │ ◒  Cloning repository│ ■  Failed to clone repository │ │  Failed to clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git: Cloning into '/tmp/skills-SL5Kxe'... │ │  fatal: unable to access 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git/': SSL certificate problem: unable to get local issuer certificate │ │ │ │  Tip: use the --yes (-y) and --global (-g) flags to install without prompts. │ └  Installation failed  ■  Canceled  === Socket Firewall ===  Warning: Socket Firewall did not detect any package fetch attempts ```  ### Expected Behavior  should install cleanly  ### AI Agent Used  codex
  **Post-Mortem & Fix Analysis**:
  > this seems to be related to the socket firewall, closing.

- **Issue #33** (2026-04-03): **[Bug]: Trojan/script/Wataca.Cm!c on windows defender**
  *Symptoms*: ### Skill Name  Whole repository  ### Bug Type  Other  ### Description  When I downloaded the .zip on my PC to use on Claude Web, defender pop up appears warning the threat.  ### Expected Behavior  N/A  ### AI Agent Used  Claude WEB
  **Post-Mortem & Fix Analysis**:
  > Hi @Gontijex,  Thank you for reporting this — I appreciate you taking the time to flag it. I understand how alarming a Trojan detection can be, and I want to assure you that this is a **false positive** triggered by antivirus heuristics, not actual malware.  ### Root Cause  This repository contains **600+ cybersecurity education skills** covering blue-team detection, threat hunting, penetration testing, and malware analysis. The educational content includes code snippets and detection signatures that reference real-world attack patterns — things like `Set-MpPreference`, `Invoke-Expression`, PowerShell obfuscation patterns, and IOC detection strings. These are the exact strings that AV engines use heuristic matching against, so when Windows Defender scans the zip archive and encounters dozens of them across many files, it flags the bundle as `Trojan:Script/Wacatac.C!ml`.  This is a well-known issue with cybersecurity education repositories, YARA rule collections, and detection engineeri

- **Issue #24** (2026-03-31): **[Bug]: Eset Smart Security defense is triggerd by the Performing-active-directory-bloodhound-analyses**
  *Symptoms*: ### Skill Name   Performing-active-directory-bloodhound-analyses  ### Bug Type  Other  ### Description  Trigger by the browser too if you check the raw md file   ### Expected Behavior  should not be a security concern for the browser nor my antivirus   ### AI Agent Used  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this! The issue has been fixed — the skill content has been updated to avoid triggering antivirus and browser security warnings. Appreciate the feedback! 🙏

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

### Incident Patch 1: `1b3f6b22` (2026-08-24)
**Commit Message**: fix: pick up contributors the cached API has not caught up with

GitHub's /contributors endpoint is heavily cached and can lag a merge by up
to a day. dakshverma23's commit from #129 was already linked to their account
- /commits reports it, and the commit API confirms the link - but they were
absent from the contributor wall because /contributors had not refreshed.

update-contributors.py now unions the two endpoints: /contributors for the
authoritative counts and ordering, /commits for anyone linked but not yet
surfaced. Commits authored with an unlinkable email still appear in neither,
which matches what GitHub's own contributor graph shows.

Wall goes from 13 to 14.

**File**: `README.md` (modified, +2/-1)
```diff
@@ -419,9 +419,10 @@ This library is built by the community. Thank you to everyone who has contribute
 <a href="https://github.com/shanujans" title="shanujans — 1 contribution"><img src="https://github.com/shanujans.png?size=100" width="72" height="72" alt="@shanujans"></a>
 <a href="https://github.com/farhan6667" title="farhan6667 — 1 contribution"><img src="https://github.com/farhan6667.png?size=100" width="72" height="72" alt="@farhan6667"></a>
 <a href="https://github.com/nyxst4ck" title="nyxst4ck — 1 contribution"><img src="https://github.com/nyxst4ck.png?size=100" width="72" height="72" alt="@nyxst4ck"></a>
+<a href="https://github.com/dakshverma23" title="dakshverma23 — 1 contribution"><img src="https://github.com/dakshverma23.png?size=100" width="72" height="72" alt="@dakshverma23"></a>
 </p>
 
-<p align="center"><sub>13 contributors, ordered by contribution count · see the full <a href="https://github.com/mukul975/Anthropic-Cybersecurity-Skills/graphs/contributors">contributor graph</a></sub></p>
+<p align="center"><sub>14 contributors, ordered by contribution count · see the full <a href="https://github.com/mukul975/Anthropic-Cybersecurity-Skills/graphs/contributors">contributor graph</a></sub></p>
 <!-- contributors:end -->
 
 ## Community
```

**File**: `tools/update-contributors.py` (modified, +49/-18)
```diff
@@ -39,35 +39,66 @@
 AVATAR_PX = 72
 
 
+def _get(path: str):
+    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/{path}", headers={
+        "Accept": "application/vnd.github+json",
+        "User-Agent": "update-contributors",
+    })
+    token = os.environ.get("GITHUB_TOKEN")
+    if token:
+        req.add_header("Authorization", f"Bearer {token}")
+    with urllib.request.urlopen(req, timeout=30) as resp:
+        return json.load(resp)
+
+
+def _keep(login: str) -> bool:
+    return bool(login) and not login.endswith(EXCLUDE_SUFFIXES) and login not in EXCLUDE_LOGINS
+
+
 def fetch_contributors() -> list[dict]:
-    """Every non-bot contributor, most contributions first."""
+    """Every non-bot contributor, most contributions first.
+
+    Two endpoints, because one of them lies. /contributors carries the
+    authoritative contribution counts but is heavily cached — a merge can take
+    up to a day to show up there. /commits is live. So anyone whose commit is
+    already linked to their account but has not yet surfaced in /contributors
+    gets picked up from the commit list instead of waiting a day to be thanked.
+
+    Commits authored with an unlinkable email (a machine hostname such as
+    user@HOST.localdomain) have no `author` object and are skipped by both
+    paths. They never appear in GitHub's own contributor graph either, so the
+    wall matches what GitHub itself shows.
+    """
     people: list[dict] = []
     page = 1
     while True:
-        url = f"https://api.github.com/repos/{REPO}/contributors?per_page=100&page={page}"
-        req = urllib.request.Request(url, headers={
-            "Accept": "application/vnd.github+json",
-            "User-Agent": "update-contributors",
-        })
-        token = os.environ.get("GITHUB_TOKEN")
-        if token:
-            req.add_header("Authorization", f"Bearer {token}")
-
-        with urllib.request.urlopen(req, timeout=30) as resp:
-            batch = json.load(resp)
+        batch = _get(f"contributors?per_page=100&page={page}")
         if not batch:
             break
         people.extend(batch)
         if len(batch) < 100:
             break
         page += 1
 
-    return [
-        p for p in people
-        if p.get("type") != "Bot"
-        and not p.get("login", "").endswith(EXCLUDE_SUFFIXES)
-        and p.get("login") not in EXCLUDE_LOGINS
-    ]
+    known = {p.get("login") for p in people}
+    ranked = [p for p in people if p.get("type") != "Bot" and _keep(p.get("login", ""))]
+
+    # Catch anyone the cached endpoint has not caught up with yet.
+    recent: dict[str, int] = {}
+    for page in (1, 2):
+        for commit in _get(f"commits?per_page=100&page={page}") or []:
+            author = commit.get("author")
+            if not author or author.get("type") == "Bot":
+                continue
+            login = author.get("login", "")
+            if login in known or not _keep(login):
+                continue
+            recent[login] = recent.get(login, 0) + 1
+
+    for login, count in sorted(recent.items(), key=lambda kv: (-kv[1], kv[0])):
+        ranked.append({"login": login, "contributions": count})
+
+    return ranked
 
 
 def render(people: list[dict]) -> str:
```

---

### Incident Patch 2: `c071749a` (2026-08-23)
**Commit Message**: Merge pull request #124 from OctoBored/fix/star-history-chart

Fix broken star history chart in README



---

### Incident Patch 3: `6e363c46` (2026-08-23)
**Commit Message**: chore: regenerate index.json with the fixed generator

First regeneration through tools/generate-index.py. Restores the 591
descriptions that were previously truncated to their first line.

The 13 that still lack terminal punctuation are genuine source-level
omissions in the SKILL.md files, not parser damage.



---

### Incident Patch 4: `2e9e49b9` (2026-08-23)
**Commit Message**: fix(readme): restore the star history chart

GitHub restricted access to the stargazer API endpoints in July 2026, so
api.star-history.com now returns an error notice rather than a chart.
Verified by parsing both SVGs: the official endpoint returns a single
path with five text nodes reading "GitHub restricted access to star
data", while the replacement returns real axes, ticks and series.

Reported in #124.

**File**: `README.fr.md` (modified, +1/-1)
```diff
@@ -346,7 +346,7 @@ Toutes les plateformes supportant le standard agentskills.io peuvent charger ces
 
 ## Historique des étoiles
 
-![Star History Chart](https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date)
+![Star History Chart](https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date)
 
 ## Releases
 
```

**File**: `README.md` (modified, +4/-4)
```diff
@@ -363,11 +363,11 @@ All platforms that support the [agentskills.io](https://agentskills.io) standard
 
 ## Star history
 
-<a href="https://star-history.com/#mukul975/Anthropic-Cybersecurity-Skills&Date">
+<a href="https://star-history.dera.page/#mukul975/Anthropic-Cybersecurity-Skills&Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" width="100%" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" width="100%" />
  </picture>
 </a>
 
```

---

### Incident Patch 5: `6972fe93` (2026-08-23)
**Commit Message**: docs(skills): rewrite container-security descriptions to a uniform standard

All 33 container-security skills now carry what it does, an explicit
"Use when" trigger, keywords, and a negative trigger naming the nearest
neighbour. Six collision clusters resolved by differentiating scope
rather than merging, so no skill is removed:

- kube-bench: running the tool vs interpreting findings into an audit
- Calico: portable upstream NetworkPolicy vs Calico-as-CNI vs Calico-only
  CRDs (GlobalNetworkPolicy, HostEndpoint, DNS egress)
- Falco: deploying and operating it vs authoring escape rules
- container escape: tool-agnostic runtime signals vs Falco rule syntax vs
  static posture audit vs offensive breakout
- Trivy: all-target platform and operator vs single-image scan
- Docker: images and Dockerfiles vs daemon.json vs the CIS audit script

Also replaces the templated "When to Use" boilerplate in these files,
including bullets that only restated the skill's own name.

Worst pair (Pod Security Standards vs Pod Security Admission) drops from
0.77 cosine to below the 0.45 threshold. Repo-wide: colliding pairs
60 -> 56, skills involved 105 -> 94.

**File**: `skills/analyzing-kubernetes-audit-logs/SKILL.md` (modified, +8/-4)
```diff
@@ -1,9 +1,13 @@
 ---
 name: analyzing-kubernetes-audit-logs
-description: 'Parses Kubernetes API server audit logs (JSON lines) to detect exec-into-pod,
-  secret access, RBAC modifications, privileged pod creation, and anonymous API access.
-  Builds threat detection rules from audit event patterns. Use when investigating
-  Kubernetes cluster compromise or building k8s-specific SIEM detection rules.
+description: >-
+  Parses Kubernetes API server audit logs (JSON lines) to detect exec-into-pod, secret access,
+  RBAC modifications, privileged pod creation, and anonymous API access, and builds SIEM
+  detection rules from the event patterns. Use when investigating a suspected cluster
+  compromise, reconstructing what an attacker did through the API server, or writing
+  Kubernetes-specific detection content. Keywords: audit policy, audit log, kube-apiserver,
+  exec into pod, RBAC change, anonymous access, detection rules. Do not use for syscall-level
+  detection inside a running container - use detecting-container-runtime-threats-with-falco.
 
   '
 domain: cybersecurity
```

**File**: `skills/auditing-kubernetes-rbac-privilege-escalation/SKILL.md` (modified, +8/-1)
```diff
@@ -1,6 +1,13 @@
 ---
 name: auditing-kubernetes-rbac-privilege-escalation
-description: Find over-permissive RBAC roles and service-account token abuse paths in Kubernetes using kubectl auth can-i, rbac-police, kubectl-who-can, and rakkess during authorized cluster security reviews.
+description: >-
+  Finds over-permissive RBAC roles and service-account token abuse paths in a Kubernetes
+  cluster using kubectl auth can-i, rbac-police, kubectl-who-can, and rakkess, tracing which
+  subjects can escalate toward cluster-admin. Use when reviewing who can escalate privileges
+  in a cluster, hunting exploitable RoleBindings during an authorized review, or validating
+  least privilege after an RBAC change. Keywords: RBAC, ClusterRoleBinding, service account
+  token, auth can-i, rbac-police, escalate, bind, impersonate. Do not use for designing and
+  applying hardened RBAC - use implementing-rbac-hardening-for-kubernetes.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/benchmarking-kubernetes-with-kube-bench/SKILL.md` (modified, +9/-1)
```diff
@@ -1,6 +1,14 @@
 ---
 name: benchmarking-kubernetes-with-kube-bench
-description: Run kube-bench (Aqua Security) against a Kubernetes cluster's control-plane, kubelet, and node configuration to check compliance with the CIS Kubernetes Benchmark and remediate PASS/FAIL/WARN findings. Use when establishing a security baseline for a new cluster, performing periodic hardening audits, validating remediation after configuration changes, or gathering compliance evidence for SOC 2/PCI DSS.
+description: >-
+  Installs and runs the kube-bench tool against a Kubernetes cluster as a Job, DaemonSet, or
+  standalone binary, selecting the correct benchmark version and targets (control plane, etcd,
+  kubelet, worker nodes) and emitting JSON or JUnit output for pipelines. Use when setting
+  kube-bench up for the first time, choosing which benchmark version and node targets to run,
+  wiring it into CI, or troubleshooting skipped or misdetected checks. Keywords: kube-bench,
+  DaemonSet, --benchmark, --targets, JSON output, JUnit, CI integration. Do not use for
+  interpreting the findings or producing an audit report - use
+  performing-kubernetes-cis-benchmark-with-kube-bench.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/detecting-container-drift-at-runtime/SKILL.md` (modified, +9/-1)
```diff
@@ -1,6 +1,14 @@
 ---
 name: detecting-container-drift-at-runtime
-description: Detect unauthorized runtime drift in containers by monitoring binary execution, file system changes, and configuration deviations from the original immutable image, using tools like Falco and Microsoft Defender for Kubernetes/container workloads. Use when investigating possible container compromise, validating immutable-infrastructure controls, or hunting for unexpected package installs and file modifications inside running containers.
+description: >-
+  Detects unauthorized runtime drift in containers by monitoring binary execution, filesystem
+  changes, and configuration deviation from the original immutable image, using Falco and
+  Microsoft Defender for Containers. Use when validating immutable-infrastructure controls,
+  hunting for unexpected package installs or binaries written inside a running container, or
+  determining whether a container diverged from the image it was built from. Keywords: drift,
+  immutable infrastructure, new binary executed, package install, image mismatch, Falco. Do
+  not use for detecting breakout from the container to the host - use
+  detecting-container-escape-attempts.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/detecting-container-escape-attempts/SKILL.md` (modified, +10/-1)
```diff
@@ -1,6 +1,15 @@
 ---
 name: detecting-container-escape-attempts
-description: Detect container escape attempts where an adversary breaks out of container isolation to reach the host or other containers, by monitoring namespace manipulation, capability abuse, kernel exploits, sensitive mounted paths, and anomalous syscalls with tools like Falco, Sysdig, and seccomp/audit rules. Use when hunting for privilege escalation from containerized workloads or investigating suspected breakout from a Docker/Kubernetes environment.
+description: >-
+  Detects container escape at runtime across tooling - namespace manipulation, capability
+  abuse, kernel exploits, sensitive host mounts, and anomalous syscalls - and explains which
+  signals matter regardless of whether Falco, Sysdig, auditd, or an EDR is doing the
+  collection. Use when deciding what breakout behaviour to monitor, investigating a suspected
+  Docker or Kubernetes breakout, or comparing escape coverage across runtime sensors.
+  Keywords: container escape, breakout, namespaces, CAP_SYS_ADMIN, privileged, hostPath,
+  kernel exploit, syscall. Do not use for Falco rule syntax itself - use
+  detecting-container-escape-with-falco-rules; for a static configuration sweep use
+  performing-container-escape-detection.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/detecting-container-escape-with-falco-rules/SKILL.md` (modified, +9/-1)
```diff
@@ -1,6 +1,14 @@
 ---
 name: detecting-container-escape-with-falco-rules
-description: Write and tune Falco rules that monitor Linux syscalls to detect container escape techniques in real time, including host filesystem mounts, sensitive host path access, kernel module loading, and abuse of privileged container capabilities. Use when deploying or tuning Falco for a Kubernetes/container environment, or when investigating an alert tied to syscall-level escape behavior.
+description: >-
+  Writes and tunes Falco rule syntax for container escape detection - conditions, macros,
+  lists, priorities, and output fields - covering host filesystem mounts, sensitive host path
+  access, kernel module loading, and privileged capability abuse, including how to drive down
+  false positives. Use when authoring or tuning a specific Falco rule for breakout behaviour,
+  or triaging a noisy escape-related Falco alert. Keywords: Falco rule, macro, list,
+  condition, priority, falco_rules.local.yaml, tuning, false positive. Do not use for
+  deploying and operating Falco itself - use detecting-container-runtime-threats-with-falco;
+  for tool-agnostic escape signals use detecting-container-escape-attempts.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/detecting-container-runtime-threats-with-falco/SKILL.md` (modified, +8/-1)
```diff
@@ -1,6 +1,13 @@
 ---
 name: detecting-container-runtime-threats-with-falco
-description: Write and deploy Falco rules with the modern eBPF driver to detect container escape, namespace abuse, privileged mounts, and anomalous syscalls at runtime in Kubernetes and Docker.
+description: >-
+  Deploys and operates Falco with the modern eBPF driver in Kubernetes and Docker, covering
+  driver selection, Helm installation, output channels, and the built-in ruleset that detects
+  container escape, namespace abuse, privileged mounts, and anomalous syscalls. Use when
+  standing Falco up on a cluster, choosing between the eBPF and kernel-module drivers, routing
+  Falco alerts into a SIEM or Falcosidekick, or upgrading an existing deployment. Keywords:
+  Falco, modern_ebpf, kernel module, Helm, Falcosidekick, runtime security, syscall. Do not
+  use for authoring individual escape rules - use detecting-container-escape-with-falco-rules.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/detecting-privilege-escalation-in-kubernetes-pods/SKILL.md` (modified, +8/-5)
```diff
@@ -1,10 +1,13 @@
 ---
 name: detecting-privilege-escalation-in-kubernetes-pods
-description: Detect and prevent privilege escalation in Kubernetes pods by combining
-  admission control (OPA policies), runtime monitoring (Falco), and audit log
-  analysis of security contexts, Linux capabilities, and syscall patterns. Use
-  when hardening pod security policies, investigating a pod running as root or
-  privileged, or hunting for containers escaping their intended scope.
+description: >-
+  Detects and prevents privilege escalation inside Kubernetes pods by combining admission
+  control (OPA policies), runtime monitoring (Falco), and audit log analysis of security
+  contexts, Linux capabilities, and syscall patterns. Use when investigating a pod running as
+  root or privileged, hardening workloads against in-pod escalation, or hunting for containers
+  exceeding their intended scope. Keywords: allowPrivilegeEscalation, runAsRoot, capabilities,
+  securityContext, OPA, Falco, audit log. Do not use for escalation through RBAC and
+  service-account permissions - use auditing-kubernetes-rbac-privilege-escalation.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

---

### Incident Patch 6: `796d96c4` (2026-08-23)
**Commit Message**: fix: replace three hand-rolled YAML parsers with a shared PyYAML loader

index.json shipped 604 of 817 descriptions truncated to their first line.
The cause was the inline regex parser in update-index.yml: it reconstructed
multi-line descriptions only for the YAML block-scalar styles ('>' and '|')
and silently dropped continuation lines for every other style.

A census of the corpus explains the blast radius:

  block scalar   (description: >-)    43
  single-quoted multiline            278
  plain unquoted multiline           496
  single-line                          0

So 774 of 817 skills (94.7%) used a style the parser mishandled. Commit
d56fc0a7 had fixed only the 43 block-scalar files, and CONTRIBUTING.md
recommends that one working style, which is why it stayed hidden.

- add tools/skill_frontmatter.py, the single PyYAML-backed loader
- add tools/generate-index.py so generation is testable outside CI, with
  a --check mode for use as a gate
- delete the hand-rolled parsers from validate-skill.py (98 lines) and
  validate-agentskills.py, routing both through the shared loader
- implement the reserved-word check that agentskills-skill.schema.json
  names validate-agentskills.

**File**: `.github/workflows/update-index.yml` (modified, +8/-65)
```diff
@@ -18,72 +18,15 @@ jobs:
         with:
           token: ${{ secrets.GITHUB_TOKEN }}
 
-      - name: Regenerate index.json
-        run: |
-          python3 << 'EOF'
-          import os, json, re
-          from datetime import datetime, timezone
-
-          skills_dir = "skills"
-          skills = []
-
-          for skill_name in sorted(os.listdir(skills_dir)):
-              skill_md = os.path.join(skills_dir, skill_name, "SKILL.md")
-              if not os.path.isfile(skill_md):
-                  continue
-              with open(skill_md, "r", encoding="utf-8") as f:
-                  content = f.read()
-              fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
-              description = ""
-              if fm_match:
-                  fm = fm_match.group(1)
-                  dm = re.search(r"^description:[ \t]*(.*)$", fm, re.MULTILINE)
-                  if dm:
-                      first = dm.group(1).strip()
-                      if first[:1] in (">", "|"):
-                          # YAML block scalar: gather the following more-indented lines
-                          buf = []
-                          for ln in fm[dm.end():].split("\n"):
-                              if ln.strip() == "":
-                                  buf.append("")
-                              elif re.match(r"^[ \t]+\S", ln):
-                                  buf.append(ln.strip())
-                              else:
-                                  break
-                          if first.startswith(">"):  # folded: blank line = break, else join w/ space
-                              paras, cur = [], []
-                              for b in buf:
-                                  if b == "":
-                                      if cur: paras.append(" ".join(cur)); cur = []
-                                  else:
-                                      cur.append(b)
-                              if cur: paras.append(" ".join(cur))
-                              description = " ".join(paras).strip()
-                          else:  # literal
-                              description = " ".join(b for b in buf if b).strip()
-                      else:
-                          description = first.strip('"').strip("'")
-              skills.append({
-                  "name": skill_name,
-                  "description": description,
-                  "domain": "cybersecurity",
-                  "path": f"skills/{skill_name}"
-              })
-
-          index = {
-              "version": "1.1.0",
-              "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
-              "repository": "https://github.com/mukul975/Anthropic-Cybersecurity-Skills",
-              "domain": "cybersecurity",
-              "total_skills": len(skills),
-              "skills": skills
-          }
-
-          with open("index.json", "w", encoding="utf-8") as f:
-              json.dump(index, f, separators=(',', ':'))
+      - name: Install dependencies
+        run: pip install pyyaml
 
-          print(f"Updated index.json: {len(skills)} skills")
-          EOF
+      # Generation lives in tools/generate-index.py so it is testable outside CI
+      # and shares one PyYAML-backed frontmatter parser with the validators.
+      # The previous inline regex parser silently truncated 604/817 descriptions
+      # to their first line for every YAML scalar style except '>'/'|'.
+      - name: Regenerate index.json
+        run: python3 tools/generate-index.py
 
       - name: Sync skill count into README and marketplace
         run: |
```

**File**: `tools/generate-index.py` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+#!/usr/bin/env python3
+"""Generate index.json from the SKILL.md files under skills/.
+
+Previously this logic lived as an inline heredoc inside
+.github/workflows/update-index.yml with a hand-rolled regex YAML parser that
+truncated 604 of 817 descriptions. It lives here now so it is testable outside
+CI and shares one PyYAML-backed parser with every other tool.
+
+Usage:
+    python tools/generate-index.py            # write index.json
+    python tools/generate-index.py --check    # verify index.json is current (CI)
+"""
+from __future__ import annotations
+
+import argparse
+import json
+import os
+import sys
+from datetime import datetime, timezone
+
+sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
+
+from skill_frontmatter import description_of, iter_skill_dirs, load_frontmatter, FrontmatterError
+
+INDEX_VERSION = "1.1.0"
+REPOSITORY = "https://github.com/mukul975/Anthropic-Cybersecurity-Skills"
+DEFAULT_DOMAIN = "cybersecurity"
+
+
+def build_index(skills_dir: str = "skills") -> tuple[dict, list[str]]:
+    """Build the index payload. Returns (index, errors)."""
+    skills = []
+    errors = []
+
+    for slug, skill_dir in iter_skill_dirs(skills_dir):
+        try:
+            frontmatter = load_frontmatter(os.path.join(skill_dir, "SKILL.md"))
+        except FrontmatterError as exc:
+            errors.append(f"{slug}: {exc}")
+            continue
+
+        description = description_of(frontmatter)
+        if not description:
+            errors.append(f"{slug}: empty description")
+
+        skills.append({
+            "name": slug,
+            "description": description,
+            "domain": frontmatter.get("domain") or DEFAULT_DOMAIN,
+            "path": f"{skills_dir}/{slug}",
+        })
+
+    index = {
+        "version": INDEX_VERSION,
+        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
+        "repository": REPOSITORY,
+        "domain": DEFAULT_DOMAIN,
+        "total_skills": len(skills),
+        "skills": skills,
+    }
+    return index, errors
+
+
+def _comparable(index: dict) -> str:
+    """Serialize an index ignoring generated_at, so --check tolerates a re-run."""
+    return json.dumps({k: v for k, v in index.items() if k != "generated_at"}, sort_keys=True)
+
+
+def main() -> int:
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("--check", action="store_true",
+                        help="verify index.json matches the skills tree; do not write")
+    parser.add_argument("--skills-dir", default="skills")
+    parser.add_argument("--out", default="index.json")
+    args = parser.parse_args()
+
+    if not os.path.isdir(args.skills_dir):
+        print(f"ERROR: '{args.skills_dir}' not found. Run from the repository root.")
+        return 1
+
+    index, errors = build_index(args.skills_dir)
+
+    for error in errors:
+        print(f"ERROR {error}")
+    if errors:
+        print(f"\n{len(errors)} skill(s) could not be indexed.")
+        return 1
+
+    if args.check:
+        if not os.path.isfile(args.out):
+            print(f"ERROR: {args.out} is missing. Run: python tools/generate-index.py")
+            return 1
+        with open(args.out, encoding="utf-8") as handle:
+            current = json.load(handle)
+        if _comparable(current) != _comparable(index):
+            print(f"ERROR: {args.out} is out of date. Run: python tools/generate-index.py")
+            return 1
+        print(f"OK: {args.out} is up to date ({index['total_skills']} skills)")
+        return 0
+
+    with open(args.out, "w", encoding="utf-8") as handle:
+        json.dump(index, handle, separators=(",", ":"))
+
+    print(f"Updated {args.out}: {index['total_skills']} skills")
+    return 0
+
+
+if __name__ == "__main__":
+    sys.exit(main())
```

**File**: `tools/skill_frontmatter.py` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+#!/usr/bin/env python3
+"""Single source of truth for reading SKILL.md YAML frontmatter.
+
+Every tool in this repository MUST read frontmatter through this module.
+
+Why this exists
+---------------
+This repo previously carried three independent hand-rolled "YAML-ish" parsers
+(the index generator, validate-skill.py, validate-agentskills.py). Each handled
+a different subset of YAML scalar styles, and all of them silently truncated
+multi-line descriptions to their first line.
+
+A census of the 817 skills shows why that was fatal:
+
+    block scalar   (description: >-)    43
+    single-quoted multiline            278
+    plain unquoted multiline           496
+    single-line                          0
+
+Only the 43 block-scalar files parsed correctly; 774 (94.7%) used a style the
+hand-rolled parsers mishandled, and 604 descriptions shipped truncated in
+index.json with no error and no warning.
+
+PyYAML handles every scalar style, quoting form and escape correctly. Do not
+reintroduce a regex-based frontmatter parser -- CI greps for that.
+"""
+from __future__ import annotations
+
+import os
+import re
+from typing import Dict, Iterator, Tuple
+
+import yaml
+
+# Frontmatter is the block between the opening '---' and the next '---' that
+# sits alone on its own line. Tolerates CRLF and a leading UTF-8 BOM.
+_FRONTMATTER_RE = re.compile(r"\A﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL)
+
+BACKUP_SUFFIX = ".bak"
+
+
+class FrontmatterError(ValueError):
+    """Raised when a SKILL.md has missing or unparseable frontmatter."""
+
+
+def extract_block(text: str) -> str:
+    """Return the raw YAML frontmatter block from a SKILL.md's text."""
+    match = _FRONTMATTER_RE.match(text)
+    if not match:
+        raise FrontmatterError("no YAML frontmatter block (file must start with '---')")
+    return match.group(1)
+
+
+def parse(text: str) -> dict:
+    """Parse a SKILL.md's full text into a frontmatter dict."""
+    try:
+        data = yaml.safe_load(extract_block(text))
+    except yaml.YAMLError as exc:
+        raise FrontmatterError(f"invalid YAML in frontmatter: {exc}") from exc
+
+    if data is None:
+        return {}
+    if not isinstance(data, dict):
+        raise FrontmatterError(f"frontmatter must be a mapping, got {type(data).__name__}")
+    return data
+
+
+def load_frontmatter(skill_md_path: str) -> dict:
+    """Read one SKILL.md and return its frontmatter as a dict."""
+    try:
+        with open(skill_md_path, encoding="utf-8") as handle:
+            text = handle.read()
+    except UnicodeDecodeError as exc:
+        raise FrontmatterError(f"not valid UTF-8: {exc}") from exc
+    return parse(text)
+
+
+def description_of(frontmatter: dict) -> str:
+    """Return the description as a single normalized line.
+
+    YAML preserves the newlines of a literal ('|') scalar and folds a folded
+    ('>') one; collapsing whitespace here gives every style the same shape,
+    which is what index.json and the linters want to compare.
+    """
+    return " ".join(str(frontmatter.get("description", "")).split())
+
+
+def iter_skill_dirs(skills_dir: str = "skills") -> Iterator[Tuple[str, str]]:
+    """Yield (slug, skill_dir) for every real skill, in sorted order.
+
+    Skips '*.bak' backup directories and any directory lacking a SKILL.md.
+    """
+    for slug in sorted(os.listdir(skills_dir)):
+        if slug.endswith(BACKUP_SUFFIX):
+            continue
+        skill_dir = os.path.join(skills_dir, slug)
+        if not os.path.isdir(skill_dir):
+            continue
+        if not os.path.isfile(os.path.join(skill_dir, "SKILL.md")):
+            continue
+        yield slug, skill_dir
+
+
+def load_all(skills_dir: str = "skills") -> Tuple[Dict[str, dict], Dict[str, str]]:
+    """Load frontmatter for every skill.
+
+    Returns (frontmatter_by_slug, errors_by_slug). Callers decide whether a
+    parse failure is fatal; nothing is silently dropped.
+    """
+    loaded: Dict[str, dict] = {}
+    errors: Dict[str, str] = {}
+
+    for slug, skill_dir in iter_skill_dirs(skills_dir):
+        try:
+            loaded[slug] = load_frontmatter(os.path.join(skill_dir, "SKILL.md"))
+        except FrontmatterError as exc:
+            errors[slug] = str(exc)
+
+    return loaded, errors
```

**File**: `tools/validate-agentskills.py` (modified, +29/-48)
```diff
@@ -13,82 +13,63 @@
 import os, re, sys, json, glob
 from collections import Counter
 
+sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
+
+from skill_frontmatter import description_of, load_frontmatter, FrontmatterError
+
 REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
 ALLOWED = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}
 NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
 
-def top_level_keys_and_scalars(fm):
-    """Minimal YAML: top-level keys (col 0) + scalar values for name/description."""
-    keys = []
-    scalars = {}
-    lines = fm.split("\n")
-    for i, line in enumerate(lines):
-        m = re.match(r"^([A-Za-z0-9_-]+):(.*)$", line)
-        if not m:
-            continue
-        key, rest = m.group(1), m.group(2)
-        keys.append(key)
-        val = rest.strip()
-        if val and val[0] in "|>":  # block scalar -> gather following indented lines
-            buf = []
-            for nxt in lines[i + 1:]:
-                if re.match(r"^\s+\S", nxt):
-                    buf.append(nxt.strip())
-                elif nxt.strip() == "":
-                    buf.append("")
-                else:
-                    break
-            val = " ".join(x for x in buf if x != "").strip()
-        elif not val:
-            # could be a folded plain scalar wrapped onto continuation lines
-            buf = []
-            for nxt in lines[i + 1:]:
-                if re.match(r"^\s+-\s", nxt) or re.match(r"^[A-Za-z0-9_-]+:", nxt):
-                    break
-                if re.match(r"^\s+\S", nxt):
-                    buf.append(nxt.strip())
-                else:
-                    break
-            val = " ".join(buf).strip()
-        scalars[key] = val.strip().strip("\"'")
-    return keys, scalars
+# The agentskills.io standard forbids reserved vendor words in a skill name.
+# tools/agentskills-skill.schema.json names this script as the enforcement
+# point, but the check was never actually implemented until now.
+RESERVED_NAME_WORDS = ("anthropic", "claude")
+
 
 def validate(path):
     slug = os.path.basename(os.path.dirname(path))
-    text = open(path, encoding="utf-8").read()
-    m = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
     problems = []
-    if not m:
-        return slug, ["no YAML frontmatter block"], []
-    fm = m.group(1)
-    keys, scalars = top_level_keys_and_scalars(fm)
+
+    try:
+        fm = load_frontmatter(path)
+    except FrontmatterError as exc:
+        return slug, [str(exc)], []
+
+    keys = list(fm.keys())
 
     if "name" not in keys:
         problems.append("missing required key: name")
     if "description" not in keys:
         problems.append("missing required key: description")
 
-    name = scalars.get("name", "")
+    name = str(fm.get("name", "") or "")
     if name:
         if not NAME_RE.match(name):
             problems.append(f"name not lowercase-kebab-case: {name!r}")
         if not (1 <= len(name) <= 64):
             problems.append(f"name length {len(name)} out of 1..64")
         if name != slug:
             problems.append(f"name {name!r} != directory {slug!r}")
+        for reserved in RESERVED_NAME_WORDS:
+            if reserved in name.lower():
+                problems.append(f"name contains reserved word {reserved!r}: {name!r}")
 
-    desc = scalars.get("description", "")
+    desc = description_of(fm)
     if desc:
         if not (1 <= len(desc) <= 1024):
             problems.append(f"description length {len(desc)} out of 1..1024")
     elif "description" in keys:
         problems.append("description empty")
 
-    # Ignore YAML block-scalar indicators (`key: >`, `key: >-`, `key: |`, ...);
-    # only genuine `<...>`/`>` content in values is an injection concern.
-    fm_no_ind = re.sub(r":[ \t]*[|>][+-]?[ \t]*(?=\n|$)", ":", fm)
-    if "<" in fm_no_ind or ">" in fm_no_ind:
-        problems.append("frontmatter contains angle brackets (injection risk / not allowed)")
+    # Angle brackets are an injection risk. Checking the PARSED values (rather
+    # than the raw text) means YAML block-scalar indicators like `>-` are never
+    # mistaken for content, so no indicator-stripping hack is needed.
+    for key, value in fm.items():
+        if isinstance(value, str) and ("<" in value or ">" in value):
+            problems.append(f"frontmatter value for {key!r} contains angle brackets "
+                            "(injection risk / not allowed)")
+            break
 
     # Additional top-level keys are PERMITTED by the standard (name+description
     # are the only required fields). They are reported for information, not
```

**File**: `tools/validate-skill.py` (modified, +7/-106)
```diff
@@ -10,6 +10,10 @@
 import sys
 import glob
 
+sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
+
+from skill_frontmatter import load_frontmatter, FrontmatterError
+
 # Kept in sync with the CI workflow (.github/workflows/validate-skills.yml),
 # which now delegates to this script so there is a single source of truth.
 REQUIRED_FIELDS = ["name", "description", "domain", "subdomain", "tags",
@@ -81,104 +85,6 @@
 RESET = "\033[0m"
 
 
-def parse_frontmatter(text):
-    """Extract YAML frontmatter as a dict (simple stdlib-only parser).
-
-    Handles the common SKILL.md patterns:
-    - key: scalar value
-    - key: [inline, list]
-    - key:\n  - list\n  - items
-    - key: >-  (folded scalar — content on following indented lines)
-
-    Edge case note: ``list_values`` is reset to ``[]`` whenever a new key
-    with a scalar value is encountered, so a list from a prior block cannot
-    leak into an unrelated key.  The only remaining theoretical edge case is
-    a key with *no* value that is immediately followed by non-list, non-empty
-    lines that look like scalars — those lines are currently ignored (the key
-    is treated as having no value).  This is acceptable for well-formed SKILL.md
-    files and matches the behaviour contributors expect.
-    """
-    if not text.startswith("---"):
-        return None
-    end = text.find("---", 3)
-    if end == -1:
-        return None
-    block = text[3:end].strip()
-    data = {}
-    current_key = None
-    list_values: list = []
-    in_folded = False  # True when we are collecting a YAML >- / > folded scalar
-    folded_lines: list = []
-
-    for line in block.split("\n"):
-        stripped = line.strip()
-
-        # Flush a completed folded scalar when we hit the next top-level key.
-        if in_folded and stripped and not line.startswith(" ") and not line.startswith("\t"):
-            if current_key and folded_lines:
-                data[current_key] = " ".join(folded_lines)
-            in_folded = False
-            folded_lines = []
-            current_key = None
-
-        if in_folded:
-            if stripped:
-                folded_lines.append(stripped)
-            continue
-
-        if not stripped or stripped.startswith("#"):
-            continue
-
-        # Handle list items (must come before key: value to avoid misparse).
-        if stripped.startswith("- ") and current_key:
-            list_values.append(stripped[2:].strip().strip('"').strip("'"))
-            data[current_key] = list(list_values)  # copy so future mutations don't leak
-            continue
-
-        # Only TOP-LEVEL keys (column 0) define frontmatter fields. An indented
-        # ``key: value`` line belongs to a nested structure (e.g. a framework
-        # mapping object that has its own ``name:``/``id:``) and must NOT be
-        # treated as a top-level field — otherwise a nested ``name:`` clobbers
-        # the skill's real ``name``.
-        if line[:1].isspace():
-            continue
-
-        # Handle inline list: tags: [a, b, c]
-        m = re.match(r"^(\w[\w_-]*):\s*\[(.+)\]\s*$", stripped)
-        if m:
-            current_key = m.group(1)
-            items = [i.strip().strip('"').strip("'") for i in m.group(2).split(",")]
-            data[current_key] = items
-            list_values = list(items)
-            continue
-
-        # Handle key: >- or key: > (folded scalar start)
-        m = re.match(r"^(\w[\w_-]*):\s*>[-|]?\s*$", stripped)
-        if m:
-            current_key = m.group(1)
-            list_values = []
-            in_folded = True
-            folded_lines = []
-            continue
-
-        # Handle key: value (plain scalar)
-        m = re.match(r'^(\w[\w_-]*):\s*(.*)$', stripped)
-        if m:
-            current_key = m.group(1)
-            val = m.group(2).strip().strip('"').strip("'")
-            list_values = []  # reset; new scalar key cannot inherit a prior list
-            if val:
-                data[current_key] = val
-            # If val is empty the key is present but value-less (e.g. start of block list)
-            continue
-
-    # Flush any trailing folded scalar.
-    if in_folded and current_key and folded_lines:
-        data[current_key] = " ".join(folded_lines)
-
-    return data
-
-
 def validate_skill(skill_dir):
     """Validate a single skill directory. Returns list of error strings."""
     errors = []
@@ -188,16 +94,11 @@ def validate_skill(skill_dir):
         return [f"SKILL.md not found in {skill_dir}"]
 
     try:
-        with open(skill_md, encoding="utf-8") as f:
-            content = f.read()
+        fm = load_frontmatter(skill_md)
+    except FrontmatterError as e:
+        return [str(e)]
     except IOError as e:
         return [f"Could not read SKILL.md: {e}"]
-    except UnicodeDecodeError as e:
-        return [f"Encoding error in SKILL.md (not valid UTF-8): {e}"]
-
-    fm = parse_frontmatter(content)
-    if fm is None:
-        return ["No valid 
```

---

### Incident Patch 7: `4f4ec193` (2026-08-20)
**Commit Message**: Merge pull request #107 from ridaqp/fix/fileless-malware-attack-mapping

Fix ATT&CK mapping in detecting-fileless-malware-techniques

**File**: `skills/detecting-fileless-malware-techniques/SKILL.md` (modified, +4/-0)
```diff
@@ -32,8 +32,12 @@ nist_csf:
 mitre_attack:
 - T1027
 - T1055
+- T1059
+- T1112
 - T1140
+- T1218
 - T1497
+- T1546
 - T1547
 ---
 
```

---

### Incident Patch 8: `1a7cad8d` (2026-08-20)
**Commit Message**: Merge pull request #113 from farhan6667/fix/ioc-extraction-agent-report-timestamp

Fix always-empty timestamp in performing-malware-ioc-extraction agent.py report

**File**: `skills/performing-malware-ioc-extraction/scripts/agent.py` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@
 import argparse
 import re
 import hashlib
+from datetime import datetime, timezone
 from pathlib import Path
 
 
@@ -102,7 +103,7 @@ def generate_ioc_report(file_path, output=None):
     hashes = hash_file(file_path)
     strings = extract_strings(file_path)
     report = {
-        "generated": datetime.utcnow().isoformat() if "datetime" in dir() else "",
+        "generated": datetime.now(timezone.utc).isoformat(),
         "file_info": hashes,
         "strings_analysis": {
             "total": strings["total_strings"],
```

---

### Incident Patch 9: `7b8f4838` (2026-08-19)
**Commit Message**: README: fix broken star history chart

The star history chart in both READMEs no longer renders due to GitHub stargazer API restrictions. Switch the chart to a working mirror so the stargazer history displays again.

**File**: `README.fr.md` (modified, +1/-1)
```diff
@@ -346,7 +346,7 @@ Toutes les plateformes supportant le standard agentskills.io peuvent charger ces
 
 ## Historique des étoiles
 
-![Star History Chart](https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date)
+![Star History Chart](https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date)
 
 ## Releases
 
```

**File**: `README.md` (modified, +4/-4)
```diff
@@ -363,11 +363,11 @@ All platforms that support the [agentskills.io](https://agentskills.io) standard
 
 ## Star history
 
-<a href="https://star-history.com/#mukul975/Anthropic-Cybersecurity-Skills&Date">
+<a href="https://star-history.dera.page/#mukul975/Anthropic-Cybersecurity-Skills&Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" width="100%" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" width="100%" />
  </picture>
 </a>
 
```

---

### Incident Patch 10: `d56fc0a7` (2026-08-02)
**Commit Message**: Fix index.json generator to parse folded YAML descriptions

The generator's `^description:\s*(.+)$` regex captured the block-scalar
indicator (">-") instead of the wrapped text, corrupting 43 descriptions in
index.json. Parse `>`/`|` block scalars properly and regenerate (0 broken).
Also refresh the count-update comment examples 754 -> 817.

**File**: `.github/workflows/update-index.yml` (modified, +29/-5)
```diff
@@ -36,9 +36,33 @@ jobs:
               fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
               description = ""
               if fm_match:
-                  m = re.search(r"^description:\s*(.+)$", fm_match.group(1), re.MULTILINE)
-                  if m:
-                      description = m.group(1).strip().strip('"')
+                  fm = fm_match.group(1)
+                  dm = re.search(r"^description:[ \t]*(.*)$", fm, re.MULTILINE)
+                  if dm:
+                      first = dm.group(1).strip()
+                      if first[:1] in (">", "|"):
+                          # YAML block scalar: gather the following more-indented lines
+                          buf = []
+                          for ln in fm[dm.end():].split("\n"):
+                              if ln.strip() == "":
+                                  buf.append("")
+                              elif re.match(r"^[ \t]+\S", ln):
+                                  buf.append(ln.strip())
+                              else:
+                                  break
+                          if first.startswith(">"):  # folded: blank line = break, else join w/ space
+                              paras, cur = [], []
+                              for b in buf:
+                                  if b == "":
+                                      if cur: paras.append(" ".join(cur)); cur = []
+                                  else:
+                                      cur.append(b)
+                              if cur: paras.append(" ".join(cur))
+                              description = " ".join(paras).strip()
+                          else:  # literal
+                              description = " ".join(b for b in buf if b).strip()
+                      else:
+                          description = first.strip('"').strip("'")
               skills.append({
                   "name": skill_name,
                   "description": description,
@@ -80,8 +104,8 @@ jobs:
           with open("README.md", encoding="utf-8") as f:
               readme = f.read()
           readme = re.sub(r"(badge/skills-)\d+", rf"\g<1>{count}", readme)
-          # "754 production-grade", "754 structured", "754 skills", "all 754 skills",
-          # "Scans 754 skill", "contains **754 skills**", BibTeX "{754 structured"
+          # "817 production-grade", "817 structured", "817 skills", "all 817 skills",
+          # "Scans 817 skill", "contains **817 skills**", BibTeX "{817 structured"
           readme = re.sub(r"\b\d+(?=\s+production-grade cybersecurity skills)", str(count), readme)
           readme = re.sub(r"\b\d+(?=\s+structured cybersecurity skills)", str(count), readme)
           readme = re.sub(r"(all\s+)\d+(?=\s+skills)", rf"\g<1>{count}", readme)
```

---

### Incident Patch 11: `2545b2d3` (2026-08-02)
**Commit Message**: Fix framework-ID defects across 53 skills (grounded in authoritative data)

Deterministic audit against vendored MITRE/NIST oracles (ATT&CK v19.1,
ATLAS 2026.07, NIST CSF 2.0, D3FEND v1.4.0) found and fixed:

- 27 wrong-framework leaks on 12 AI-security skills: ATLAS AML.* IDs were
  under `mitre_attack` (-> `atlas_techniques`) and AI-RMF GOVERN/MEASURE IDs
  under `nist_csf` (-> `nist_ai_rmf`).
- RS.AN-01 -> RS.AN-03 on 37 forensics/incident-analysis skills (CSF 1.1 ID
  retired in CSF 2.0; RS.AN-03 is the incident-analysis successor).
- PR.DS-06 -> PR.DS-01 on the SLSA/Sigstore provenance skill (CSF 1.1 ID
  absorbed into PR.DS-01 in CSF 2.0; body prose updated too).
- AML.T0104 -> AML.T0010 on 3 software-supply-chain skills (T0104 is
  "Publish Poisoned AI Agent Tool" -- wrong topic; T0010 "AI Supply Chain
  Compromise" is correct).

CSF/ATLAS replacements verified against NIST CSWP.29, the official CSF
1.1->2.0 transition workbook, and mitre-atlas/atlas-data.
Framework-ID gate: 0 defects. Schema: 817/817 pass.

**File**: `skills/acquiring-disk-image-with-dd-and-dcfldd/SKILL.md` (modified, +0/-1)
```diff
@@ -15,7 +15,6 @@ version: '1.0'
 author: mahipal
 license: Apache-2.0
 nist_csf:
-- RS.AN-01
 - RS.AN-03
 - DE.AE-02
 - RS.MA-01
```

**File**: `skills/analyzing-browser-forensics-with-hindsight/SKILL.md` (modified, +0/-1)
```diff
@@ -20,7 +20,6 @@ version: '1.0'
 author: mahipal
 license: Apache-2.0
 nist_csf:
-- RS.AN-01
 - RS.AN-03
 - DE.AE-02
 - RS.MA-01
```

**File**: `skills/analyzing-disk-image-with-autopsy/SKILL.md` (modified, +0/-1)
```diff
@@ -15,7 +15,6 @@ version: '1.0'
 author: mahipal
 license: Apache-2.0
 nist_csf:
-- RS.AN-01
 - RS.AN-03
 - DE.AE-02
 - RS.MA-01
```

**File**: `skills/analyzing-docker-container-forensics/SKILL.md` (modified, +0/-1)
```diff
@@ -15,7 +15,6 @@ version: '1.0'
 author: mahipal
 license: Apache-2.0
 nist_csf:
-- RS.AN-01
 - RS.AN-03
 - DE.AE-02
 - RS.MA-01
```

**File**: `skills/analyzing-email-headers-for-phishing-investigation/SKILL.md` (modified, +0/-1)
```diff
@@ -18,7 +18,6 @@ license: Apache-2.0
 atlas_techniques:
 - AML.T0052
 nist_csf:
-- RS.AN-01
 - RS.AN-03
 - DE.AE-02
 - RS.MA-01
```

**File**: `skills/analyzing-linux-kernel-rootkits/SKILL.md` (modified, +0/-1)
```diff
@@ -19,7 +19,6 @@ version: '1.0'
 author: mahipal
 license: Apache-2.0
 nist_csf:
-- RS.AN-01
 - RS.AN-03
 - DE.AE-02
 - RS.MA-01
```

**File**: `skills/analyzing-linux-system-artifacts/SKILL.md` (modified, +0/-1)
```diff
@@ -16,7 +16,6 @@ version: '1.0'
 author: mahipal
 license: Apache-2.0
 nist_csf:
-- RS.AN-01
 - RS.AN-03
 - DE.AE-02
 - RS.MA-01
```

**File**: `skills/analyzing-lnk-file-and-jump-list-artifacts/SKILL.md` (modified, +0/-1)
```diff
@@ -20,7 +20,6 @@ version: '1.0'
 author: mahipal
 license: Apache-2.0
 nist_csf:
-- RS.AN-01
 - RS.AN-03
 - DE.AE-02
 - RS.MA-01
```

---

### Incident Patch 12: `37786484` (2026-07-28)
**Commit Message**: docs: fix copilot-instructions review feedback

Address PR review threads: valid YAML subdomain example, separate
D3FEND list items, NIST CSF ID convention, document tools/validate-skill.py,
and fix Quick Reference backticks.

**File**: `.github/copilot-instructions.md` (modified, +9/-6)
```diff
@@ -108,7 +108,7 @@ description: >-
   Include keywords for search/filtering.
   This is what agents read to decide whether to use this skill.
 domain: cybersecurity
-subdomain: red-teaming | digital-forensics | compliance-governance | etc.
+subdomain: red-teaming  # e.g. digital-forensics, compliance-governance, etc.
 tags:
   - tool-names (mimikatz, burp-suite, etc.)
   - frameworks (active-directory, cloud, kubernetes, etc.)
@@ -125,7 +125,8 @@ mitre_attack:
 mitre_atlas:
   - AML.P1.003
 mitre_d3fend:
-  - D3-CAA | D3-PCA
+  - D3-CAA
+  - D3-PCA
 nist_ai_rmf:
   - GOV-1
 mitre_f3:
@@ -459,7 +460,7 @@ jq '[.skills[] | .subdomain] | group_by(.) | map({subdomain: .[0], count: length
 ### Framework Maintenance
 
 - **MITRE ATT&CK updates**: v14 is current; check attack.mitre.org for latest
-- **NIST CSF 2.0**: Rolled out Feb 2024; use new control IDs (e.g., DE.CM not DE.CM-01)
+- **NIST CSF 2.0**: Rolled out Feb 2024; use subcategory IDs as in this repo (e.g., `DE.CM-01`, `PR.PS-01`)
 - **Technique changes**: Techniques may deprecate; verify via attack.mitre.org
 
 ### Subdomain Assignment
@@ -498,8 +499,10 @@ Before submitting a PR:
 ### Manual Verification
 
 ```bash
-# Validate YAML frontmatter:
-python3 -c "import yaml; yaml.safe_load(open('skills/my-skill/SKILL.md'))" 
+# Validate skill frontmatter and conventions (repo validator):
+python3 tools/validate-skill.py skills/my-skill/
+# Or validate all skills:
+python3 tools/validate-skill.py --all
 
 # Check for framework ID patterns:
 grep -E "^  - (T1[0-9]{3,4}(\.[0-9]{3})?|DE\.[A-Z]{2}-[0-9]{2}|AML\.)" skills/*/SKILL.md
@@ -538,6 +541,6 @@ done
 | Add skill | `mkdir skills/name && cat > SKILL.md` |
 | Search by technique | `grep -r "T1055" skills/` |
 | Search by subdomain | `grep "subdomain: red-teaming" skills/*/SKILL.md` |
-| Validate YAML | `python3 -c "import yaml; yaml.safe_load(open(...))` |
+| Validate skill | `python3 tools/validate-skill.py skills/my-skill/` |
 | Regenerate index | `python3 generate_index.py` (if exists) |
 | View mapping coverage | Open `mappings/mitre-attack/attack-navigator-layer.json` in ATT&CK Navigator |
```

---

### Incident Patch 13: `a1340473` (2026-07-17)
**Commit Message**: Fix always-empty timestamp in IOC extraction report

generate_ioc_report()'s "generated" field used:
    datetime.utcnow().isoformat() if "datetime" in dir() else ""

"datetime" is never imported anywhere in this file, and dir() with
no arguments only inspects local scope names -- so this guard is
always False, and every generated report had "generated": "" instead
of a real timestamp.

Fixed by importing datetime/timezone at the top and calling
datetime.now(timezone.utc).isoformat() directly (the non-deprecated
replacement for utcnow(), since Python 3.12 deprecates utcnow()).

Tested: python3 -m py_compile, --help works, and:
    python3 agent.py report --file <any file>
now produces a real ISO 8601 UTC timestamp
(e.g. "2026-07-17T14:46:03.178652+00:00") instead of an empty string.

**File**: `skills/performing-malware-ioc-extraction/scripts/agent.py` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@
 import argparse
 import re
 import hashlib
+from datetime import datetime, timezone
 from pathlib import Path
 
 
@@ -102,7 +103,7 @@ def generate_ioc_report(file_path, output=None):
     hashes = hash_file(file_path)
     strings = extract_strings(file_path)
     report = {
-        "generated": datetime.utcnow().isoformat() if "datetime" in dir() else "",
+        "generated": datetime.now(timezone.utc).isoformat(),
         "file_info": hashes,
         "strings_analysis": {
             "total": strings["total_strings"],
```

---

### Incident Patch 14: `eec1246f` (2026-07-16)
**Commit Message**: fix: use explicit path for YARA rule in Volatility command

The --yara-file reference should not assume a specific working directory.
Use a placeholder path that analysts will substitute for their setup.

**File**: `skills/detecting-fileless-malware-techniques/SKILL.md` (modified, +3/-2)
```diff
@@ -245,8 +245,9 @@ vol3 -f memory.dmp windows.vadinfo --pid 4012 | grep -i "PAGE_EXECUTE"
 # PowerShell CLR usage (indicates .NET reflection loading)
 vol3 -f memory.dmp windows.cmdline | grep -i "powershell"
 
-# Scan for known fileless frameworks (rule file avoids AV false positives on SKILL.md)
-vol3 -f memory.dmp yarascan.YaraScan --yara-file references/yara-fileless-powershell.yar
+# Scan for known fileless frameworks
+# YARA rule lives in references/yara-fileless-powershell.yar (kept separate to reduce AV false positives)
+vol3 -f memory.dmp yarascan.YaraScan --yara-file /path/to/yara-fileless-powershell.yar
 
 # Extract PowerShell command history from memory
 vol3 -f memory.dmp windows.cmdline
```

---

### Incident Patch 15: `d4e38c28` (2026-07-16)
**Commit Message**: fix: reduce Windows Defender false positive on fileless malware skill

Add AV false-positive guidance for issue #100, move inline YARA rule to
references/yara-fileless-powershell.yar, and replace literal encoded
PowerShell payload with a placeholder in the sample report.

**File**: `skills/detecting-fileless-malware-techniques/SKILL.md` (modified, +11/-14)
```diff
@@ -49,6 +49,12 @@ mitre_attack:
 
 **Do not use** for traditional file-based malware; standard static and dynamic analysis methods are more appropriate for disk-resident malware.
 
+## Windows Defender / Antivirus False Positive
+
+Some endpoint antivirus products — notably **Windows Defender** (signature `Trojan:script/Wacatac.H!ml`) — may quarantine this skill's `SKILL.md` as malicious. This is a **known false positive**: the file intentionally documents fileless attack patterns (LOLBins, encoded PowerShell, memory YARA indicators) for defensive detection and investigation. The content is educational only; it does not execute code.
+
+**If quarantined:** restore the file from quarantine, add an exclusion for your local agent skills directory, and see [GitHub issue #100](https://github.com/mukul975/Anthropic-Cybersecurity-Skills/issues/100) for discussion. YARA strings live in `references/yara-fileless-powershell.yar` (not inline in this file) to reduce scanner triggers while preserving the rule for analysts.
+
 ## Prerequisites
 
 - Sysmon installed and configured with comprehensive logging (process creation, WMI events, registry changes)
@@ -239,22 +245,13 @@ vol3 -f memory.dmp windows.vadinfo --pid 4012 | grep -i "PAGE_EXECUTE"
 # PowerShell CLR usage (indicates .NET reflection loading)
 vol3 -f memory.dmp windows.cmdline | grep -i "powershell"
 
-# Scan for known fileless frameworks
-vol3 -f memory.dmp yarascan.YaraScan --yara-rules "
-rule Fileless_PowerShell {
-    strings:
-        \$s1 = \"System.Reflection.Assembly\" ascii wide
-        \$s2 = \"[System.Convert]::FromBase64String\" ascii wide
-        \$s3 = \"Invoke-Expression\" ascii wide
-        \$s4 = \"DownloadString\" ascii wide
-    condition:
-        2 of them
-}
-"
+# Scan for known fileless frameworks (rule file avoids AV false positives on SKILL.md)
+vol3 -f memory.dmp yarascan.YaraScan --yara-file references/yara-fileless-powershell.yar
 
 # Extract PowerShell command history from memory
 vol3 -f memory.dmp windows.cmdline
-strings memory.dmp | grep -i "invoke-\|iex \|downloadstring\|-encodedcommand"
+# Search memory strings for common fileless indicators (encoded commands, cradles, reflection)
+strings memory.dmp | grep -iE 'encodedcommand|downloadstring|invoke-expression|\.reflection\.'
 ```
 
 ### Step 5: Build Comprehensive Detection Rules
@@ -400,7 +397,7 @@ Filter Name:      WindowsUpdateCheck
 Filter Query:     SELECT * FROM __InstanceModificationEvent WITHIN 300
                   WHERE TargetInstance ISA 'Win32_PerfFormattedData_PerfOS_System'
 Consumer:         CommandLineEventConsumer
-Command:          powershell.exe -nop -w hidden -enc JABjAGwAaQBlAG4AdAA...
+Command:          powershell.exe -nop -w hidden -enc <BASE64_UTF16LE_PAYLOAD>
 
 DECODED PAYLOAD
 [Layer 1] Base64 UTF-16LE decode
```

**File**: `skills/detecting-fileless-malware-techniques/references/api-reference.md` (modified, +2/-0)
```diff
@@ -61,6 +61,8 @@ vol3 -f memory.dmp windows.malfind --dump --pid 1234
 
 ## Suspicious PowerShell Indicators
 
+Detection patterns to search for in Script Block Logging (Event ID 4104) and memory strings. See `yara-fileless-powershell.yar` in this directory for a Volatility YARA rule covering the same indicators.
+
 ```
 -enc / -EncodedCommand    → Base64-encoded command
 IEX / Invoke-Expression   → Dynamic code execution
```

**File**: `skills/detecting-fileless-malware-techniques/references/yara-fileless-powershell.yar` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+// YARA rule for Volatility yarascan — fileless PowerShell indicators in memory.
+// Stored separately from SKILL.md to reduce antivirus false positives on the skill file.
+// See GitHub issue #100.
+
+rule Fileless_PowerShell {
+    strings:
+        $s1 = "System.Reflection.Assembly" ascii wide
+        $s2 = "[System.Convert]::FromBase64String" ascii wide
+        $s3 = "Invoke-Expression" ascii wide
+        $s4 = "DownloadString" ascii wide
+    condition:
+        2 of them
+}
```

#### Recent Merged Pull Requests:
- **PR #147** (closed): chore: normalize subdomains to canonical form and fix count drift (@brunoncaldas-collab)
- **PR #138** (closed): Fix dead navigation anchors in the French README (@gabrieldaltonPB)
- **PR #137** (closed): Fix dead AI RMF link, Navigator-asset claims, and stale releases table (@gabrieldaltonPB)
- **PR #136** (closed): Fix dead documentation links (verified replacements only) (@gabrieldaltonPB)
- **PR #135** (closed): Fix dead Navigator repo link and wrong Log4Shell CVE ID (@gabrieldaltonPB)
- **PR #134** (closed): Correct mislabelled OWASP Top 10 year (2025 -> 2021) (@gabrieldaltonPB)
- **PR #133** (closed): Fix broken script path, frontmatter schema, and dead links in copilot-instructions (@gabrieldaltonPB)
- **PR #129** (2026-08-24): gdpr compliance skill (@dakshverma23)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Ecosystem Adaptation Protocol

## 1. Overview
The Ecosystem Adaptation Protocol governs how changes in the external software ecosystem (frameworks, tools, standards, documentation) are safely discovered, analyzed, verified, and integrated into the Master Brain and Project Factory.

---

## 2. The 13-Stage Adaptation Pipeline

```
[1. External Authoritative Source]
                 ↓
[2. Source Registry (Metadata & Pinning)]
                 ↓
[3. Current Version / Revision Detection]
                 ↓
[4. Change Detection (Semantic / Checksum)]
                 ↓
[5. Content / Documentation Diff Analysis]
                 ↓
[6. Impact Analysis (Breaking changes & Affected components)]
                 ↓
[7. Compatibility Analysis (Project Factory & Template contracts)]
                 ↓
[8. Empirical Verification (Live Build & Runtime Probe)]
                 ↓
[9. Knowledge Update (Drafting Pattern / Rule adjustment)]
                 ↓
[10. Project Adaptation Decision]
        ┌────────┴────────┐
        ▼                 ▼
[11A. Safe Auto-Update]  [11B. Review Required (High-impact / Breaking)]
        └────────┬────────┘
                 ▼
[12. Evidence-Backed Promotion to Master Brain]
                 ▼
[13. Downstream Project Notification via Brain Bridge]
```

---

## 3. Detailed Stage Requirements

### Stage 1: External Authoritative Source
Only official sources qualify: primary documentation sites, official GitHub repositories, package registries (npm/PyPI), and standards specifications (W3C, WHATWG, ECMAScript). Unverified blogs or AI syntheses are rejected.

### Stage 2: Source Registry
Every tracked external dependency or documentation reference is registered in the Source Registry with complete metadata:
- Technology, Official URL, Source Type, Tracked Version, Checksum/ETag, Update Frequency, Severity Level, and Review Policy.

### Stage 3: Current Version / Revision Detection
Automated query to authoritative endpoints (npm registry API, GitHub releases API, HTTP HEAD etag) to retrieve the latest published version and publication date.

### Stage 4: Change Detection
Compare detected version/revision against last verified state:
- If versions match and checksum is identical: status is `CURRENT`.
- If new version or content diff detected: transition to `DRIFT_DETECTED`.

### Stage 5: Content / Documentation Diff
Extract changelogs, release notes, and documentation diffs to identify what specifically altered.

### Stage 6: Impact Analysis
Classify the change severity:
- **PATCH / DOCS_POLISH**: Low impact, non-breaking bugfix or clarification.
- **MINOR / NEW_FEATURE**: Medium impact, backward-compatible addition.
- **MAJOR / BREAKING**: High impact, syntax changes, deprecated APIs, configuration paradigm shifts.

### Stage 7: Compatibility Analysis
Determine which Project Factory templates, build scripts, or Master Brain engineering patterns are affected.

### Stage 8: Empirical Verification
Execute a live verification build in an isolated sandbox with the updated dependency or practice.
- Must compile cleanly (`exit code 0`).
- Must pass dev-server runtime probe (HTTP 200).
- Must maintain all invariants (responsive layout, SEO, performance).

### Stage 9: Knowledge Update
Draft updated guidance in Master Brain or Project Factory adapters with clear provenance (e.g., "Updated for Tailwind v4.1 on [date]").

### Stage 10: Project Adaptation Decision
- **Path A (Safe Automatic Update)**: Minor/patch releases with zero breaking changes and 100% verified test passes can be adopted automatically by the Project Factory template.
- **Path B (Review Required)**: Breaking changes, architectural paradigm shifts, or new major versions require human builder review. A structured proposal is queued.

### Stage 11: Evidence-Backed Promotion
Changes to Master Brain canonical files require commit-level tracking and verification evidence logs.

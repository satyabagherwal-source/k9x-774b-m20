# Candidate Directive: [CD-XOEI] build: replace the loading benchmark page and keep partial benchmark results

<!-- PROVENANCE_START
{
  "source_repository": "electron-electron-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T02:13:40.078Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-electron-electron-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [electron-electron-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T02:13:40.078Z`  
> **Learning ID**: `LEARN-EVO-electron-electron-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `script/benchmarks/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in electron/electron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7ccb4856`: build: replace the loading benchmark page and keep partial benchmark results. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `script/benchmarks/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
| `loading` | `first_load`, `reload` (warm process, same page) of the app shell (see [The app shell page](#the-app-shell-page)) | FCP, `loadEventEnd`, `app_ready` and LCP in ms; PSS in MiB after `first_load` (total, browser, renderer and GPU processes) |
| `trace` | `first_load` and `resize` of the app shell, traced | FCP and LCP in ms; resize latency median and p90 in ms |
  `performance.mark()` entries from the page after each story. The app shell
  marks `app-ready` and keeps its LCP as the `app-lcp` mark, since the probe
  reads no LCP entries. The file-loading pages mark `files-loaded`
  themselves once every file has run, because only the page knows when that
  is.
  * Resize: once the app shell has loaded, a script the story injects steps
    the window between 1280x800 and 900x600 (below the app's 960px layout
    breakpoint) with `BrowserWindow.setSize()`, through the harness preload,
    20 times. Each is timed from the browser's
    after the page's `resize` event. Frames are matched by their commit
    because a `PipelineReporter` starts at its BeginFrame timestamp, which can
    be earlier than the resize the frame shows.
`trace` suite's FCP and LCP are a cross-check o
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
| `loading` | `first_load`, `reload` (warm process, same page) | FCP and `loadEventEnd` in ms; PSS in MiB after `first_load` (total, browser, renderer and GPU processes) |
| `trace` | `first_load`, `resize`, traced | FCP and LCP in ms; resize latency median and p90 in ms |
  `performance.mark()` entries from the page after each story. The
  file-loading pages mark `files-loaded` themselves once every file has run,
  because only the page knows when that is.
  * Resize: `BrowserWindow.setSize()` from the browser's
    after the page's `resize` event, 20 times per run. Frames are matched by
    their commit because a `PipelineReporter` starts at its BeginFrame
    timestamp, which can be earlier than the resize the frame shows.
`trace` suite's FCP is a cross-check of the untraced one and the only source of
LCP, which `performance.entries` does not read.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7ccb4856` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:13:40.168Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795227220168",
    "title": "build: replace the loading benchmark page and keep partial benchmark results",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "electron-electron-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5c75982cf6d23adcae7540815ed87b19f89851ca628f5d4c67541eb51d1be909"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (4 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T02:13:40.169Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "3ac5e64965f17efc12c36525cd6dc73db043e5a111fa55e0dd86d8a310b6c62a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-S3HO] app, ios): share GoogleUtilities when only Messaging or Analytics is installed u

<!-- PROVENANCE_START
{
  "source_repository": "invertase-react-native-firebase-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T15:06:28.033Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-invertase-react-native-firebase-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [invertase-react-native-firebase-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T15:06:28.033Z`  
> **Learning ID**: `LEARN-EVO-invertase-react-native-firebase-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/scripts/check-duplicate-objc-classes.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in invertase/react-native-firebase. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0d426fe3`: app, ios): share GoogleUtilities when only Messaging or Analytics is installed under SPM. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/scripts/check-duplicate-objc-classes.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
#          [--expect-duplicates N | --report-only] [--canary-hint TEXT]
# --expect-duplicates N passes only when exactly N classes are duplicated
# (default 0). Every other guard still applies, so a control run cannot pass
# on an empty or unreadable scan. GULNetwork is a canary for the
# GoogleUtilities sharing graph this check exists for: with 0 expected
# duplicates it must be defined by exactly one binary; with N > 0 it must be
# one of the duplicated classes, so a control run proves it hit that graph.
#
# --report-only lists every duplicate, the GULNetwork and FIRApp owners, and
# exits 0 unless a scan guard (dyld_info, missing binary, empty scan) fails.
#
# --canary-hint TEXT is appended to the error when GULNetwork is missing.
# Usage and flag errors exit 2.
#
USAGE="usage: $0 <path/to/App.app> [--expect-duplicates N | --report-only] [--canary-hint TEXT]"

usage_error() {
  log "ERROR: $*"
  log "$USAGE"
  exit 2
}

if [[ $# -lt 1 ]]; then
  usage_error "missing app bundle path"
shift
EXPECT_DUPLICATES=0
EXPECT_SET=0
REPORT_ONLY=0
CANARY_HINT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --expect-duplicates)
      [[ $# -ge 2 ]] || usage_error "$1 needs a value"
      EXPEC
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T15:06:28.136Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794927988136",
    "title": "app, ios): share GoogleUtilities when only Messaging or Analytics is installed u",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "invertase-react-native-firebase-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ace67d0418307437efcffc5017fd578dd78f249a0a2c24b64f6f8afdd71fbc9b"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T15:06:28.137Z"
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
  "auth_token": "fd224cc52a4235c6c5634cc21345ddfbb3adaf2b692fa162c0ebe448700247ae"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

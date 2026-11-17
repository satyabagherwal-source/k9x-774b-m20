# Candidate Directive: [CD-RYBB] app, ios): share GoogleUtilities when only Messaging or Analytics is installed u

<!-- PROVENANCE_START
{
  "source_repository": "invertase/react-native-firebase",
  "source_url": "https://github.com/invertase/react-native-firebase",
  "source_version": "0d426fe3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T15:06:21.431Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-invertase-react-native-firebase",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [invertase/react-native-firebase](https://github.com/invertase/react-native-firebase) (Revision: `0d426fe3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T15:06:21.431Z`  
> **Learning ID**: `learn-github-invertase-react-native-firebase`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
if [[ $# -ne 1 ]]; then
  dup_check_fail "usage: $0 <path/to/App.app>"
    log "ERROR: duplicate class ${line}"
  log "NOTE: a reused DerivedData can embed frameworks left over from an earlier build ([RNFB] Embed Firebase SPM Frameworks copies every dynamic framework in PackageFrameworks); re-check a local failure from an empty DerivedData"
canary_owner="$(awk -F'\t' '$1 == "GULNetwork" { print $2 }' "$class_owners_file")"
if [[ -z "$canary_owner" ]]; then
  dup_check_fail "GoogleUtilities canary GULNetwork not found in any scanned binary; test-expo/
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0d426fe3` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T15:06:21.429Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794927981429",
    "title": "app, ios): share GoogleUtilities when only Messaging or Analytics is installed u",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "invertase/react-native-firebase",
    "source_uri": "https://github.com/invertase/react-native-firebase",
    "source_version": "HEAD",
    "content_hash": "f85528f5202b1607bf00813b886bfd0047e94ffb5de0fd235d3b61aac066e394"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
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
        "Harvested/verified timestamp recorded: 2026-11-17T15:06:21.429Z"
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
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "9a0086087f5d0dfcdf0cf3c253697bd34653db1b0c2136a1d2236bd9c8dfdb70"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

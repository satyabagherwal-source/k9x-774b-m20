# Candidate Directive: [CD-4K0K] cli): clean up full uninstall and verify installer release identity

<!-- PROVENANCE_START
{
  "source_repository": "beclab-olares-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T00:08:02.039Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-beclab-olares-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [beclab-olares-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T00:08:02.039Z`  
> **Learning ID**: `LEARN-EVO-beclab-olares-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `build/base-package/install.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in beclab/Olares. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `139e4a83`: cli): clean up full uninstall and verify installer release identity. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `build/base-package/install.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
function installed_cli_matches() {
    local version_output current_version current_commit
    command_exists olares-cli || return 1
    version_output=$(olares-cli --version) || return 1
    current_version=$(awk 'NR==1{print $3}' <<< "$version_output")
    [[ "$current_version" == "$VERSION" ]] || return 1
    [[ "$(olares-cli --vendor)" == "$expected_vendor" ]] || return 1

    if [[ -n "$RELEASE_ID_SUFFIX" ]]; then
        current_commit=$(awk '/^Git commit: /{print $3; exit}' <<< "$version_output")
        # Older or unstamped binaries can still be reused by version/vendor.
        if [[ -z "$current_commit" || "$current_commit" == "unknown" ]]; then
            return 0
        fi
        # Release workflows use git rev-parse --short=7 (at least 7 digits),
        # while GoReleaser stamps GitCommit with .FullCommit.
        [[ "$RELEASE_ID" =~ ^[0-9a-f]{7,40}$ ]] || return 1
        [[ "$current_commit" =~ ^[0-9a-f]{40}$ ]] || return 1
        [[ "$current_commit" == "$RELEASE_ID"* ]] || return 1
    fi
}

    if installed_cli_matches; then
        echo "olares-cli already installed and matches the expected version, vendor and release"
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
    if command_exists olares-cli && [[ "$(olares-cli -v | awk 'NR==1{print $3}')" == "$VERSION" ]] && [[ "$(olares-cli --vendor)" == "$expected_vendor" ]]; then
        echo "olares-cli already installed and is the expected version"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `139e4a83` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T00:08:02.131Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794960482131",
    "title": "cli): clean up full uninstall and verify installer release identity",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "beclab-olares-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "06ed482927de980cdb469e4c97ff209d3539cc93a7d77aa05fb1c07543acf9e1"
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
        "Harvested/verified timestamp recorded: 2026-11-18T00:08:02.131Z"
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
  "auth_token": "d61c5fd3c8c7ac12c1280f235a8559bcc5381f73a78d0756243c86976fde13e0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

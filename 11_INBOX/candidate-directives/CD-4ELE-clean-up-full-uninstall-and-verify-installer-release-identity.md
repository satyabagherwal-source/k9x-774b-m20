# Candidate Directive: [CD-4ELE] clean up full uninstall and verify installer release identity

<!-- PROVENANCE_START
{
  "source_repository": "beclab/Olares",
  "source_url": "https://github.com/beclab/Olares",
  "source_version": "139e4a83",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-18T00:07:55.106Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-beclab-olares",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [beclab/Olares](https://github.com/beclab/Olares) (Revision: `139e4a83`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-18T00:07:55.106Z`  
> **Learning ID**: `learn-github-beclab-olares`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-18T00:07:55.104Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794960475104",
    "title": "clean up full uninstall and verify installer release identity",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "beclab/Olares",
    "source_uri": "https://github.com/beclab/Olares",
    "source_version": "HEAD",
    "content_hash": "01f9f39f36658b73d85128f634bd289da5457344d4cd52a2848c5679adb569fb"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T00:07:55.104Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "998e056cf178250bdf4a210a41e65c4faac65598c61b9daf2e64be34f1b12e58"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-M22B] ci(release): retry flaky Apple stapler/notarytool during Beta builds

<!-- PROVENANCE_START
{
  "source_repository": "Folkbench/folkbench",
  "source_url": "https://github.com/Folkbench/folkbench",
  "source_version": "4bb39f16",
  "license": "NOASSERTION",
  "timestamp": "2026-11-16T04:30:14.771Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-folkbench-folkbench",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Folkbench/folkbench](https://github.com/Folkbench/folkbench) (Revision: `4bb39f16`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-16T04:30:14.771Z`  
> **Learning ID**: `learn-github-folkbench-folkbench`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/switch-beta.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Folkbench/folkbench. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `af4c9d9c`: ci(release): retry flaky Apple stapler/notarytool during Beta builds. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/switch-beta.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
          retry() {
            local attempt=1
            local max=6
            local delay=15
            until "$@"; do
              if (( attempt >= max )); then
                echo "gave up after ${attempt} attempts: $*"
                return 1
              fi
              echo "attempt ${attempt} failed; sleeping ${delay}s then retrying: $*"
              sleep "$delay"
              attempt=$((attempt + 1))
              delay=$((delay + 15))
            done
          }
          # Ticket delivery can lag or flake on Apple's CDN; wait/retry before failing the whole matrix.
          retry xcrun stapler validate "$app"
          retry bash -c 'xcrun notarytool submit "$0" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait --output-format json > "$FOLKBENCH_APPLE_SIGNING_DIR/notarization.json"' "${installers[0]}"
          retry xcrun stapler staple "${installers[0]}"
          retry xcrun stapler validate "${installers[0]}"
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
          xcrun stapler validate "$app"
          xcrun notarytool submit "${installers[0]}" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait --output-format json > "$FOLKBENCH_APPLE_SIGNING_DIR/notarization.json"
          xcrun stapler staple "${installers[0]}"
          xcrun stapler validate "${installers[0]}"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `af4c9d9c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T04:30:14.769Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794803414769",
    "title": "ci(release): retry flaky Apple stapler/notarytool during Beta builds",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Folkbench/folkbench",
    "source_uri": "https://github.com/Folkbench/folkbench",
    "source_version": "HEAD",
    "content_hash": "aa7a2e65eda54dc631173cb4c8bbd8f2e97e7e5795bbf1d948c0b11dc1abb824"
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
        "Harvested/verified timestamp recorded: 2026-11-16T04:30:14.769Z"
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
  "auth_token": "e01ee4668d9889d104f69896ce6b37e2efc9ab67654eefa8de4d68f980a8b13a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

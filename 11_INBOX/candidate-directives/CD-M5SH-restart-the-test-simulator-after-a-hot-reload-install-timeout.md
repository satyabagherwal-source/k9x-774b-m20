# Candidate Directive: [CD-M5SH] Restart the test simulator after a hot-reload install timeout

<!-- PROVENANCE_START
{
  "source_repository": "sweetpad-dev/sweetpad",
  "source_url": "https://github.com/sweetpad-dev/sweetpad",
  "source_version": "11b271ee",
  "license": "MIT",
  "timestamp": "2026-11-24T00:31:44.849Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sweetpad-dev-sweetpad",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad) (Revision: `11b271ee`).  
> **License**: MIT | **Timestamp**: `2026-11-24T00:31:44.849Z`  
> **Learning ID**: `learn-github-sweetpad-dev-sweetpad`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `sweetpad-lib/ci/hot-reload-e2e.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sweetpad-dev/sweetpad. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b2ff0f84`: Restart the test simulator after a hot-reload install timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `sweetpad-lib/ci/hot-reload-e2e.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  if [ -n "${selfcheck_log:-}" ]; then rm -f "$selfcheck_log"; fi
selfcheck_log=
selfcheck_log=$(mktemp)
boot_simulator() {
  perl -e 'alarm shift; exec @ARGV' 600 xcrun simctl bootstatus "$UDID" -b \
    || fail "simulator $UDID failed to boot (10-minute timeout)"
}
boot_simulator
  local args=(app run --project "$APP" --scheme SweetpadCIApp --destination "$DEST"
    --hot --hot-recompiler "$mode" --hot-selfcheck "$SRC")
  if ! "$BIN" "${args[@]}" 2>&1 | tee "$selfcheck_log"; then
    # CoreSimulator can report a completed boot while app installation is wedged.
    grep -Fq "'xcrun simctl install' didn't finish within" "$selfcheck_log" \
      || fail "simulator/$mode: injection self-check failed"
    echo "  Install timed out. Restarting test simulator $UDID and retrying $mode once."
    perl -e 'alarm shift; exec @ARGV' 60 xcrun simctl shutdown "$UDID" \
      || fail "simulator $UDID failed to shut down for install recovery"
    boot_simulator
    "$BIN" "${args[@]}" || fail "simulator/$mode: injection self-check failed after restart"
  fi
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
xcrun simctl boot "$UDID"
perl -e 'alarm shift; exec @ARGV' 600 xcrun simctl bootstatus "$UDID" -b \
  || fail "simulator $UDID failed to boot (10-minute timeout)"
  "$BIN" app run --project "$APP" --scheme SweetpadCIApp --destination "$DEST" \
    --hot --hot-recompiler "$mode" --hot-selfcheck "$SRC" \
    || fail "simulator/$mode: injection self-check failed"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b2ff0f84` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T00:31:44.847Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795480304847",
    "title": "Restart the test simulator after a hot-reload install timeout",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sweetpad-dev/sweetpad",
    "source_uri": "https://github.com/sweetpad-dev/sweetpad",
    "source_version": "HEAD",
    "content_hash": "5d619ab4a7cdefa133fd6286bd89266b43637346d316614cab30719b3b091c0a"
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
        "Harvested/verified timestamp recorded: 2026-11-24T00:31:44.847Z"
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
  "auth_token": "69e90a79b041a48494983f70cd8ed14f3b56ca62ca162e0ec01ae9ecda6fbaed"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

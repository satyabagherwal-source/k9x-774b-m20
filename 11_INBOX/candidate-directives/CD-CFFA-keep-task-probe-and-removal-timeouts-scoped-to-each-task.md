# Candidate Directive: [CD-CFFA] keep task probe and removal timeouts scoped to each task

<!-- PROVENANCE_START
{
  "source_repository": "tw93/Mole",
  "source_url": "https://github.com/tw93/Mole",
  "source_version": "a381d561",
  "license": "GPL-3.0",
  "timestamp": "2026-11-18T07:14:03.670Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tw93-mole",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93/Mole](https://github.com/tw93/Mole) (Revision: `a381d561`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-18T07:14:03.670Z`  
> **Learning ID**: `learn-github-tw93-mole`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `lib/optimize/tasks.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `97f66d63`: optimize): keep task probe and removal timeouts scoped to each task. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/optimize/tasks.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
    mole_rc_signal "$size_rc" && return "$size_rc"
        mole_rc_signal "$size_rc" && return "$size_rc"
            # A scan timeout fails only this task; a signal still cancels.
            mole_rc_signal "$scan_rc" && return "$scan_rc"
    local timed_out_count=0
        mole_rc_signal "$plist_rc" && return "$plist_rc"
        if mole_rc_timeout "$plist_rc"; then
            timed_out_count=$((timed_out_count + 1))
            continue
        fi
            mole_rc_signal "$plist_rc" && return "$plist_rc"
            if mole_rc_timeout "$plist_rc"; then
                timed_out_count=$((timed_out_count + 1))
                continue
            fi
            mole_rc_signal "$plist_rc" && return "$plist_rc"
    # A plist that could not be read in time is unknown: it is never called
    # healthy, and the task counts as failed in the summary line.
    if [[ $broken_count -eq 0 && $timed_out_count -eq 0 ]]; then
    if [[ $broken_count -gt 0 ]]; then
        echo -e "  ${YELLOW}${ICON_WARNING}${NC} $broken_count Launch Agent(s) point at a missing program · left in ~/Library/LaunchAgents"
    fi
    if [[ $timed_out_count -gt 0 ]]; then
        optimize_task_result "$MOLE_OPTIMI
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
    mole_rc_timeout_or_signal "$size_rc" && return "$size_rc"
        mole_rc_timeout_or_signal "$size_rc" && return "$size_rc"
            mole_rc_timeout_or_signal "$scan_rc" && return "$scan_rc"
        mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
            mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
            mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
    if [[ $broken_count -eq 0 ]]; then
    echo -e "  ${YELLOW}${ICON_WARNING}${NC} $broken_count Launch Agent(s) point at a missing program · left in ~/Library/LaunchAgents"
        mole_rc_timeout_or_signal "$scan_rc" && return "$scan_rc"
        # Permission-only errors make the scan unavailable. Mixed errors or
        # an unreadable diagnostic keep the ordinary failed outcome.
        local permission_only=false
        if [[ -n "$scan_err_file" && -s "$scan_err_file" ]]; then
            local permission_pattern='(Permission denied|Operation not permitted)( \(os error [0-9]+\))?\.?$'
            local permission_scan_rc=0
            grep -Ev -e "$permission_pattern" -e '^$' "$scan_err_file" \
                > /dev/null || permission_scan_rc=$?
            if [[ $per
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `97f66d63` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T07:14:03.669Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794986043669",
    "title": "keep task probe and removal timeouts scoped to each task",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tw93/Mole",
    "source_uri": "https://github.com/tw93/Mole",
    "source_version": "HEAD",
    "content_hash": "6a07765381bfbd68859fccef95e97cd457e14892c840f4d85cb804388868106c"
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
        "Harvested/verified timestamp recorded: 2026-11-18T07:14:03.669Z"
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
  "auth_token": "bd625f071574c872e38f39ba456e0a121addc2c44fcb46d434db7377ad3521c4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

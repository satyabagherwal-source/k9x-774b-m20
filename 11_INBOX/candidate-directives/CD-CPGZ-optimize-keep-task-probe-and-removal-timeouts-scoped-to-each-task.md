# Candidate Directive: [CD-CPGZ] optimize): keep task probe and removal timeouts scoped to each task

<!-- PROVENANCE_START
{
  "source_repository": "tw93-mole-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T07:14:16.583Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tw93-mole-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93-mole-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T07:14:16.583Z`  
> **Learning ID**: `LEARN-EVO-tw93-mole-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T07:14:16.687Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794986056686",
    "title": "optimize): keep task probe and removal timeouts scoped to each task",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tw93-mole-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6f45dbe83fc058124874bbcbae494da2a05ea4bd35dbfa0cffde89e02ccdafa8"
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
        "Harvested/verified timestamp recorded: 2026-11-18T07:14:16.687Z"
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
  "auth_token": "85d8a05cd09e5ddd386995ede6b528996671c06fc12949e30d986defcb165854"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

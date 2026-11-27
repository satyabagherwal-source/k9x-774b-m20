# Candidate Directive: [CD-B54X] activate): avoid repeated bash hooks and keep prompt callbacks

<!-- PROVENANCE_START
{
  "source_repository": "flox-flox-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T17:01:57.683Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-flox-flox-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [flox-flox-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T17:01:57.683Z`  
> **Learning ID**: `LEARN-EVO-flox-flox-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cli/flox-activations/src/gen_rc/bash.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in flox/flox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2f6e75b9`: activate): avoid repeated bash hooks and keep prompt callbacks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/flox-activations/src/gen_rc/bash.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            if ! (
              _flox_nl=$'\n';
              if (( BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 1) )); then
                _flox_commands="${PROMPT_COMMAND:-}";
                builtin printf -v _flox_commands '%s;' "${PROMPT_COMMAND[@]:-}";
              fi;
              if [[ "${PROMPT_COMMAND:-}" == "__vsc_prompt_cmd_original" ]]; then
                _flox_commands="$_flox_commands;${__vsc_original_prompt_command:-}";
              fi;
              _flox_commands=";${_flox_commands//$_flox_nl/;};";
              [[ "${_flox_commands//; /;}" == *";_flox_hook;"* ]];
            ); then
              if (( BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 1) )) || [[ "$(declare -p PROMPT_COMMAND 2>&1)" != "declare -a"* ]]; then
              else
                PROMPT_COMMAND=(_flox_hook "${PROMPT_COMMAND[@]}");
            if ! (
              _flox_nl=$'\n';
              if (( BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 1) )); then
                _flox_commands="${PROMPT_COMMAND:-}";
                builtin printf -v _flox_commands '%s;' "${PROMPT_COMMAND[@]:-}";
              fi;
       
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            if [[ ";${PROMPT_COMMAND[*]:-};" != *";_flox_hook;"* ]]; then
              if [[ "$(declare -p PROMPT_COMMAND 2>&1)" == "declare -a"* ]]; then
                PROMPT_COMMAND=(_flox_hook "${PROMPT_COMMAND[@]}");
            if [[ ";${PROMPT_COMMAND[*]:-};" != *";_flox_hook;"* ]]; then
              if [[ "$(declare -p PROMPT_COMMAND 2>&1)" == "declare -a"* ]]; then
                PROMPT_COMMAND=(_flox_hook "${PROMPT_COMMAND[@]}");
```

**VERIFICATION METHOD**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T17:01:57.822Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795798917821",
    "title": "activate): avoid repeated bash hooks and keep prompt callbacks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "flox-flox-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9d03f3ebb50dfc5b6c15ea0dea2cd9b6503af440c8983aadda89bd07d55e0de6"
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
        "Harvested/verified timestamp recorded: 2026-11-27T17:01:57.822Z"
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
  "auth_token": "1f4e443930a00cfac11d56c3f890dd7807859cce6feb0083bc04d57f05cb6c08"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

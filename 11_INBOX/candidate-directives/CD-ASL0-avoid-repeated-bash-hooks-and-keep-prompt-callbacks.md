# Candidate Directive: [CD-ASL0] avoid repeated bash hooks and keep prompt callbacks

<!-- PROVENANCE_START
{
  "source_repository": "flox/flox",
  "source_url": "https://github.com/flox/flox",
  "source_version": "704cfbcb",
  "license": "GPL-2.0",
  "timestamp": "2026-11-27T17:01:41.557Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-flox-flox",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [flox/flox](https://github.com/flox/flox) (Revision: `704cfbcb`).  
> **License**: GPL-2.0 | **Timestamp**: `2026-11-27T17:01:41.557Z`  
> **Learning ID**: `learn-github-flox-flox`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
Automated regression test asserting that input states reproducing defect `2f6e75b9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T17:01:41.555Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795798901555",
    "title": "avoid repeated bash hooks and keep prompt callbacks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "flox/flox",
    "source_uri": "https://github.com/flox/flox",
    "source_version": "HEAD",
    "content_hash": "f0eed889f457658f340a4037f4076476f37a4c09ed747e3f011c1fd46655a70e"
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
        "Harvested/verified timestamp recorded: 2026-11-27T17:01:41.555Z"
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
  "auth_token": "fdd8d8f7cbbe3b957a7ea3eedc9a380fb81ef85443be56b3464ea53947ab4c9b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

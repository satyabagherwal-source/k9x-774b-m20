# Candidate Directive: [CD-H7IC] resolve #670 regressions and clippy lints, plus #652, #665, #669 [skip ci]

<!-- PROVENANCE_START
{
  "source_repository": "Dicklesworthstone/destructive_command_guard",
  "source_url": "https://github.com/Dicklesworthstone/destructive_command_guard",
  "source_version": "2f372957",
  "license": "NOASSERTION",
  "timestamp": "2026-11-22T05:04:29.508Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dicklesworthstone-destructive_command_guard",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard) (Revision: `2f372957`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-22T05:04:29.508Z`  
> **Learning ID**: `learn-github-dicklesworthstone-destructive_command_guard`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: "﻿"
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `install.ps1`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c8eeaee5`: resolve #670 regressions and clippy lints, plus #652, #665, #669 [skip ci]. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `install.ps1`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
﻿# dcg PowerShell installer
  $dcgHook = [pscustomobject][ordered]@{
    type = "command"
    command = $DcgPath
    statusMessage = "dcg (destructive command guard)"
  }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
# dcg PowerShell installer
  $dcgHook = [pscustomobject][ordered]@{ type = "command"; command = $DcgPath }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c8eeaee5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T05:04:29.505Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"﻿\"",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795323869505",
    "title": "resolve #670 regressions and clippy lints, plus #652, #665, #669 [skip ci]",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Dicklesworthstone/destructive_command_guard",
    "source_uri": "https://github.com/Dicklesworthstone/destructive_command_guard",
    "source_version": "HEAD",
    "content_hash": "2cdb8e80bb68b0dbfd4f4bf7ad4968d375b11ff7f04421704927e4824d45d8ac"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "FAIL",
      "score": 0,
      "directive_opposition": false,
      "opposing_rule": null,
      "is_adversarial": true,
      "has_dangerous_security": false,
      "unsupported_assumptions": [],
      "findings": [
        "PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"﻿\""
      ],
      "details": [
        "External instructions attempting to override AI constraints rejected fail-closed."
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
        "Harvested/verified timestamp recorded: 2026-11-22T05:04:29.505Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "36e17589a2ce396209bbbbd085f734882aa9e683d4f224ae10c79d1efec93791"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-3BV6] keep regex fragments from widening Bash heredoc dialects [skip ci]

<!-- PROVENANCE_START
{
  "source_repository": "Dicklesworthstone/destructive_command_guard",
  "source_url": "https://github.com/Dicklesworthstone/destructive_command_guard",
  "source_version": "37d14736",
  "license": "NOASSERTION",
  "timestamp": "2026-11-15T22:39:45.618Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dicklesworthstone-destructive_command_guard",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard) (Revision: `37d14736`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-15T22:39:45.618Z`  
> **Learning ID**: `learn-github-dicklesworthstone-destructive_command_guard`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/hook.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `37d14736`: hook): keep regex fragments from widening Bash heredoc dialects [skip ci]. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/hook.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    use crate::normalize::{
        NormalizeTokenKind, ShellTokenDecoder, ShellTokenRole, tokenize_for_shell_dialect,
    };

    let has_unquoted_caret = |word: &str| {
        let mut quote = None;
        for byte in word.bytes() {
            if let Some(delimiter) = quote {
                if byte == delimiter {
                    quote = None;
                }
            } else if matches!(byte, b'\'' | b'"') {
                quote = Some(byte);
            } else if byte == b'^' {
                return true;
        }
        false
    };
    if !has_unquoted_caret(first) {
        return is_percent_expansion(first);
    }

    // The raw heredoc scan can split a regex at '(' and '|', presenting
    // ".*?)^\" as an apparent command word (#654). Cmd reads that as ".*?",
    // a closing group, and "^\": the only caret-bearing word decodes to a
    // directory root, which cannot be an executable. Use the existing Cmd
    // lexer so a real ")g^it" still supplies evidence. Do not infer anything
    // about runtime expansions or quote boundaries: the initial whitespace
    // split may end inside a quoted word, and Cmd does not quote apostrophes.
    // Bound this opti
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    let mut quote = None;
    for byte in first.bytes() {
        if let Some(delimiter) = quote {
            if byte == delimiter {
                quote = None;
        } else if matches!(byte, b'\'' | b'"') {
            quote = Some(byte);
        } else if byte == b'^' {
    is_percent_expansion(first)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `37d14736` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T22:39:45.615Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794782385615",
    "title": "keep regex fragments from widening Bash heredoc dialects [skip ci]",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Dicklesworthstone/destructive_command_guard",
    "source_uri": "https://github.com/Dicklesworthstone/destructive_command_guard",
    "source_version": "HEAD",
    "content_hash": "831b589729e9329f1700d13bf9c482ce06b9b76df3954d83ab3ce2e5bf320037"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T22:39:45.615Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "f110c05ccd6972e9c535d109a1162ebba211d480f7532422265dd397a361fd36"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

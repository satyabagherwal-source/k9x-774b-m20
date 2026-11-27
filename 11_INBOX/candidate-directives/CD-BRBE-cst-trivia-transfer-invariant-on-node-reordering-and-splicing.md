# Candidate Directive: [CD-BRBE] CST Trivia Transfer Invariant on Node Reordering and Splicing

<!-- PROVENANCE_START
{
  "source_repository": "biomejs-biome-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T09:34:32.545Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-biomejs-biome-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs-biome-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T09:34:32.545Z`  
> **Learning ID**: `LEARN-EVO-biomejs-biome-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When reordering, partitioning, or replacing nodes within a Concrete Syntax Tree, transformations MUST explicitly calculate, detach, and migrate trailing and leading trivia (comments, whitespace, trailing commas). Transformations MUST NOT delete a separator token without re-anchoring its attached trivia to the preceding syntax node or the nearest neighbor token.

**WHY**:
In a lossless CST, tokens own trivia. If a formatter or linter rule reorders import statements, object properties, or array elements and drops a trailing comma or separator token without reassigning its attached comments, those comments disappear from the output. This results in silent source corruption and loss of developer documentation.

**WHEN TO APPLY**:
Apply to all AST/CST code-fix actions, code refactoring rules, formatters, and migration tools modifying sequences, lists, or separated elements.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use biome_rowan::{AstNode, Language, SyntaxToken, chain_trivia_pieces};

pub fn safely_remove_trailing_separator<L: Language, N: AstNode<Language = L>>(
    node: &mut N,
    separator: &mut Option<SyntaxToken<L>>,
    needs_last_separator: bool,
) {
    if let Some(sep) = separator.take() {
        // If comments are attached, we MUST preserve them by appending them
        // to the trailing trivia of the target AST node.
        if sep.has_leading_comments() || sep.has_trailing_comments() {
            let combined_trivia = chain_trivia_pieces(
                sep.leading_trivia().pieces(),
                sep.trailing_trivia().pieces(),
            );
            if let Some(reanchored_node) = node.clone().append_trivia_pieces(combined_trivia) {
                *node = reanchored_node;
            }
        }
        // If needs_last_separator is true, reinstate the separator token
        if needs_last_separator {
            *separator = Some(sep);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Discarding the separator token directly.
// All comments (// comment or /* comment */) anchored to `sep` are silently erased.
pub fn unsafe_strip_separator<L: Language>(separator: &mut Option<SyntaxToken<L>>) {
    *separator = None; // SILENT DATA CORRUPTION: Attached comment tokens deleted!
}
```

**VERIFICATION METHOD**:
Implement property-based tests that assert comment preservation:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:34:32.713Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772072713",
    "title": "CST Trivia Transfer Invariant on Node Reordering and Splicing",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs-biome-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "78f0f3eda922c51ac3b4da2c70d84a0fdfc347af9ff81a2027fe2f8c4877e920"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:34:32.713Z"
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
  "auth_token": "bfaf38b148499f0259c786c0a548396412936a8a8111bcc4f92babecca6db203"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

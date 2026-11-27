# Candidate Directive: [CD-BNT3] CST Trivia Transfer Invariant on Node Reordering and Splicing

<!-- PROVENANCE_START
{
  "source_repository": "biomejs/biome",
  "source_url": "https://github.com/biomejs/biome",
  "source_version": "c199c75a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T09:34:28.167Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-biomejs-biome",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs/biome](https://github.com/biomejs/biome) (Revision: `c199c75a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T09:34:28.167Z`  
> **Learning ID**: `learn-github-biomejs-biome`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```rust
#[test]
fn test_trivia_retention_after_reorder() {
    let source = "import { b /* keep-b */, a /* keep-a */ } from 'mod';";
    let formatted = run_sort_imports_rule(source);
    assert!(formatted.contains("/* keep-b */"));
    assert!(formatted.contains("/* keep-a */"));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:34:28.166Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772068166",
    "title": "CST Trivia Transfer Invariant on Node Reordering and Splicing",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs/biome",
    "source_uri": "https://github.com/biomejs/biome",
    "source_version": "HEAD",
    "content_hash": "13ab4e70f15f2b4baea670a9a15cbe7fb1e69de36d5f4595158ed530f1396e22"
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:34:28.166Z"
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
  "auth_token": "b52463feb9a7cffdeea596bf0ae292867299a24d4772ddc6bab9d5fb0d5883a3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

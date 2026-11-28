# Candidate Directive: [CD-MUGJ] Delimited AST Chunk Partitioning with Non-Lossy Trivia Preservation

<!-- PROVENANCE_START
{
  "source_repository": "biomejs/biome",
  "source_url": "https://github.com/biomejs/biome",
  "source_version": "71660779",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T09:30:50.419Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-biomejs-biome",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs/biome](https://github.com/biomejs/biome) (Revision: `71660779`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T09:30:50.419Z`  
> **Learning ID**: `learn-github-biomejs-biome`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When programmatically reordering, sorting, or partitioning an AST-separated list (e.g., import specifiers, object keys, enum variants), code transformations MUST partition the list into independent sorting chunks using non-keyable nodes (comments, unparseable/bogus syntax) as hard partition boundaries. When transferring separators during sorting, the syntax trivia (comments, spaces, newlines) attached to displaced separators MUST be explicitly appended to the preceding or succeeding node. Trivia MUST NEVER be dropped.

**WHY**:
AST list transformations that sort across non-keyable elements or naively generate new separators destroy comments attached to existing commas or line endings. Furthermore, blindly sorting across comment blocks changes human developer intent (e.g., grouping imports logically by category with separator comments).

**WHEN TO APPLY**:
AST rewriters, import organizers, syntax linters with auto-fix capabilities, code formatters.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/biome_analyze/src/utils.rs

pub fn fix_separators<'a, L: Language + 'a, N: AstNode<Language = L> + 'a>(
    iter: impl std::iter::ExactSizeIterator<Item = (&'a mut N, &'a mut Option<SyntaxToken<L>>)>,
    needs_last_separator: bool,
    make_separator: fn() -> SyntaxToken<L>,
) {
    let last_index = iter.len().saturating_sub(1);
    for (i, (node, optional_separator)) in iter.enumerate() {
        if let Some(separator) = optional_separator {
            // If it's the last element and we shouldn't have a trailing separator
            if i == last_index && !needs_last_separator {
                // INVARIANT: If comments exist on the separator, DO NOT DISCARD!
                if separator.has_leading_comments() || separator.has_trailing_comments() {
                    continue; // Preserve separator to avoid losing user comments
                }
                
                // Transfer trivia from the removed separator onto the terminal node
                if let Some(new_node) = node.clone().append_trivia_pieces(chain_trivia_pieces(
                    separator.leading_trivia().pieces(),
                    separator.trailing_trivia().pieces(),
                )) {
                    *node = new_node;
                }
                *optional_separator = None;
            }
        } else if i != last_index || needs_last_separator {
            // Synthesize missing separator in the interior of the list
            *optional_separator = Some(match node.syntax().last_trailing_trivia() {
                Some(trivia) => make_separator()
                    .append_trivia_pieces(trim_trailing_trivia_pieces(trivia.pieces())),
                _ => make_separator(),
            });

            if let Some(new_node) = node.clone().with_trailing_trivia_pieces([]) {
                *node = new_node;
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER discard separators without preserving their trivia
if !needs_last_separator {
    *optional_separator = None; // BUG: User comments attached to the comma are deleted!
}
```

**VERIFICATION METHOD**:
Test with auto-fix passes ensuring round-trip trivia retention:
```rust
#[test]
fn test_sorting_preserves_trailing_comma_comments() {
    let input = "import { b, /* comment */ a, } from 'mod';";
    let formatted = organize_imports(input);
    assert!(formatted.contains("/* comment */"), "Trivia was eliminated during reordering!");
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:30:50.419Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858250419",
    "title": "Delimited AST Chunk Partitioning with Non-Lossy Trivia Preservation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs/biome",
    "source_uri": "https://github.com/biomejs/biome",
    "source_version": "HEAD",
    "content_hash": "6680b64dcda1d9ab24e9198343839b53c27bf52c38487519d08d62f348c97732"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:30:50.419Z"
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
  "auth_token": "5dcb62f009c06273b319b50ab27084fcf19bf92c3fc8d560875cc8e3fc098d6a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

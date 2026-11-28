# Candidate Directive: [CD-R9ND] Delimited AST Chunk Partitioning with Non-Lossy Trivia Preservation

<!-- PROVENANCE_START
{
  "source_repository": "biomejs-biome-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:34:16.598Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-biomejs-biome-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs-biome-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:34:16.598Z`  
> **Learning ID**: `LEARN-EVO-biomejs-biome-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:34:16.729Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858456729",
    "title": "Delimited AST Chunk Partitioning with Non-Lossy Trivia Preservation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs-biome-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b1bafe97c2bc993f9b585954459aabbb96165ba391c09dd5f4859b48386e67cf"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-28T09:34:16.729Z"
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
  "auth_token": "c3b70e48dc01dca1732f89d523ea246a97c0f62af228ddb93af117863dfaadea"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-PANP] Pre-Tokenization Guarding of External Untrusted Parsers

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs-fallow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:23:29.349Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-fallow-rs-fallow-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs-fallow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:23:29.349Z`  
> **Learning ID**: `LEARN-EVO-fallow-rs-fallow-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When feeding untrusted or generated input into third-party parsers compiled with `panic = "abort"` or lacking recursion/complexity bounds, the caller MUST perform a fast, pre-lexical scan to prove that input invariants hold (e.g., nesting depth $\le N$, balanced delimiter tokens, valid domain reductions) before handing input to the structural parser.

**WHY**:
Third-party parsers (such as `lightningcss` or native AST parsers) frequently make algebraic assumptions (e.g., `Percentage::parse` assuming CSS math expressions evaluate strictly to `<percentage>`) or exhibit exponential backtracking $O(2^d)$ on deeply nested functions. Under `panic = "abort"`, any unhandled panic or recursion crash in the parser terminates the entire host process without salvageable diagnostic output.

**WHEN TO APPLY**:
Static analysis tools, language servers, CI/CD linters, and compiler front-ends ingesting user-authored or fuzz-generated CSS, HTML, JSX, or AST fragments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use cssparser::{Parser, ParserInput};

/// Enforce safety boundary on CSS parsing
pub fn parse_style_bounded<R: Send>(
    source: &str, 
    parse: impl FnOnce() -> R + Send
) -> Option<R> {
    const MAX_NESTING_DEPTH: u32 = 1024;
    const MAX_COLOR_FUNCTION_DEPTH: usize = 8;
    const MAX_MATH_FUNCTION_DEPTH: usize = 6;

    // Phase 1: Bounded lightweight structural scan
    let scan = scan_depth(source, MAX_NESTING_DEPTH, Dialect::Style);
    if scan.max_colors > MAX_COLOR_FUNCTION_DEPTH || scan.max_depth > MAX_NESTING_DEPTH {
        return None;
    }

    // Phase 2: Token-level invariant pre-validation via cssparser
    run_bounded(source, scan.max_depth, || {
        if !style_parse_is_safe(source) {
            return None;
        }
        Some(parse())
    }).flatten()
}

pub fn style_parse_is_safe(source: &str) -> bool {
    if !may_open_checked_function(source) {
        return true;
    }
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    walk_css_tokens(&mut parser, Context::default()).is_ok()
}
```

**NEGATIVE CONSTRAINT**:
```rust

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:23:29.458Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795137809457",
    "title": "Pre-Tokenization Guarding of External Untrusted Parsers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs-fallow-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e9f7366c53627cdea71662c305164cee47c0eb086e68faba15a235fa1fd57816"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:23:29.458Z"
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
  "auth_token": "636f19f5b90c241a387262a081cbbd03e391ecd51bbc2a38a5633f0e0bed72ed"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

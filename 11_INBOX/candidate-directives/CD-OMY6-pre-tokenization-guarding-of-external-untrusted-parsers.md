# Candidate Directive: [CD-OMY6] Pre-Tokenization Guarding of External Untrusted Parsers

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs/fallow",
  "source_url": "https://github.com/fallow-rs/fallow",
  "source_version": "202f6188",
  "license": "MIT",
  "timestamp": "2026-11-20T01:22:58.735Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fallow-rs-fallow",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (Revision: `202f6188`).  
> **License**: MIT | **Timestamp**: `2026-11-20T01:22:58.735Z`  
> **Learning ID**: `learn-github-fallow-rs-fallow`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
// NEVER invoke third-party parsers directly on untrusted inputs
// when the binary compiles with panic = "abort".
pub fn parse_style_unsafe<R>(source: &str, parse: impl FnOnce() -> R) -> R {
    // BUG: If lightningcss panics or recurses 2000 times on calc(calc(...)),
    // the whole process aborts immediately, taking down CI/LSP.
    parse()
}
```

**VERIFICATION METHOD**:
Fuzz test with malformed expressions (`opacity: max(4%, 5)`, `color: lab(max(4, nan) 1 1)`) and verify that `parse_style_bounded` returns `None` instead of aborting the test runner process.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:22:58.733Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795137778733",
    "title": "Pre-Tokenization Guarding of External Untrusted Parsers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs/fallow",
    "source_uri": "https://github.com/fallow-rs/fallow",
    "source_version": "HEAD",
    "content_hash": "c4f7a17960ae5b482fd72d2aa9ab963f2afaaa04d694da443291a552cad9bd2b"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:22:58.733Z"
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
  "auth_token": "fd5d7eb026e2a9437a08f373e017c499571cf560c718cb92544d51df327fa090"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

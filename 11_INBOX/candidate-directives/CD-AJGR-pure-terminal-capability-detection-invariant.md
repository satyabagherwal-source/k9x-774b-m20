# Candidate Directive: [CD-AJGR] Pure Terminal Capability Detection Invariant

<!-- PROVENANCE_START
{
  "source_repository": "ratatui-ratatui-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T10:26:14.507Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-ratatui-ratatui-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ratatui-ratatui-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T10:26:14.507Z`  
> **Learning ID**: `LEARN-EVO-ratatui-ratatui-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Terminal environment detection logic (such as checking for Truecolor or ANSI feature support via environment variables like `TERM_PROGRAM`, `COLORTERM`, and `TERM`) MUST be structured as pure, side-effect-free functions accepting borrowed option slices (`Option<&str>`). Code MUST NOT directly query `std::env::var` within parsing, branch evaluation, or layout loops.

**WHY**:
Directly invoking `std::env::var` in core rendering or initialization paths creates hidden global state dependencies, introduces locking overhead on process environment locks (especially on Windows and newer glibc versions), and prevents deterministic, hermetic unit testing across simulated platforms without mutating process-wide variables via `std::env::set_var` (which is inherently thread-unsafe in multi-threaded Rust test harnesses).

**WHEN TO APPLY**:
Apply in any CLI, TUI, or backend driver system that queries the OS environment to configure runtime capabilities, styling, color palettes, or feature flags.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct ColorCapabilities {
    pub true_color: bool,
}

impl ColorCapabilities {
    /// Detects environment capability via pure string inputs.
    /// Never queries `std::env` inside this function.
    pub const fn detect(
        term_program: Option<&str>,
        term_program_version: Option<&str>,
        colorterm: Option<&str>,
    ) -> Self {
        if let Some(colorterm) = colorterm {
            if matches_truecolor(colorterm) {
                return Self { true_color: true };
            }
        }

        if let Some(program) = term_program {
            if str_eq(program, "Apple_Terminal") {
                let build = parse_leading_u32(term_program_version);
                // Apple Terminal supports 24-bit Truecolor only from build 465 onwards
                return Self {
                    true_color: match build {
                        Some(v) => v >= 465,
                        None => false,
                    },
                };
            }
        }

        Self { true_color: true }
    }
}

const fn matches_truecolor(val: &str) -> bool {
    let b = val.as_bytes();

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T10:26:14.662Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795602374662",
    "title": "Pure Terminal Capability Detection Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ratatui-ratatui-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "dd94f8e2197b1c8d4f11d1a18ac9b3a18ef0d3f2f01844bc512ac75d08e04c99"
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
        "Harvested/verified timestamp recorded: 2026-11-25T10:26:14.663Z"
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
  "auth_token": "ca21c03d2449758e87801ec971858d86e173d6351c730784d4bca9ef8dd71282"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

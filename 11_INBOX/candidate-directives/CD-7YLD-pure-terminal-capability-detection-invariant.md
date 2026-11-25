# Candidate Directive: [CD-7YLD] Pure Terminal Capability Detection Invariant

<!-- PROVENANCE_START
{
  "source_repository": "ratatui/ratatui",
  "source_url": "https://github.com/ratatui/ratatui",
  "source_version": "ae8c0e08",
  "license": "MIT",
  "timestamp": "2026-11-25T10:24:14.305Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ratatui-ratatui",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ratatui/ratatui](https://github.com/ratatui/ratatui) (Revision: `ae8c0e08`).  
> **License**: MIT | **Timestamp**: `2026-11-25T10:24:14.305Z`  
> **Learning ID**: `learn-github-ratatui-ratatui`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    // Case-sensitive exact match for "truecolor" or "24bit"
    (b.len() == 9
        && b[0] == b't'
        && b[1] == b'r'
        && b[2] == b'u'
        && b[3] == b'e'
        && b[4] == b'c'
        && b[5] == b'o'
        && b[6] == b'l'
        && b[7] == b'o'
        && b[8] == b'r')
        || (b.len() == 5
            && b[0] == b'2'
            && b[1] == b'4'
            && b[2] == b'b'
            && b[3] == b'i'
            && b[4] == b't')
}

const fn parse_leading_u32(val: Option<&str>) -> Option<u32> {
    let s = match val {
        Some(s) => s.as_bytes(),
        None => return None,
    };
    let mut acc = 0u32;
    let mut i = 0;
    let mut found_digit = false;
    while i < s.len() {
        let b = s[i];
        if b == b'.' {
            break;
        }
        if b >= b'0' && b <= b'9' {
            found_digit = true;
            match acc.checked_mul(10).and_then(|v| v.checked_add((b - b'0') as u32)) {
                Some(next) => acc = next,
                None => return None, // Overflow safety
            }
        } else {
            break;
        }
        i += 1;
    }
    if found_digit { Some(acc) } else { None }
}

const fn str_eq(a: &str, b: &str) -> bool {
    let ab = a.as_bytes();
    let bb = b.as_bytes();
    if ab.len() != bb.len() {
        return false;
    }
    let mut i = 0;
    while i < ab.len() {
        if ab[i] != bb[i] {
            return false;
        }
        i += 1;
    }
    true
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct query of process environment inside domain logic.
// Un-testable in parallel test runners; triggers TOCTOU data races.
impl Theme {
    fn new() -> Self {
        // BAD: Directly reading environment variables inside construction
        let is_apple = std::env::var("TERM_PROGRAM").map(|s| s == "Apple_Terminal").unwrap_or(false);
        let version: u32 = std::env::var("TERM_PROGRAM_VERSION")
            .unwrap_or_default()
            .split('.')
            .next()
            .unwrap()
            .parse() // Panic hazard if string is empty
            .unwrap();
            
        if is_apple && version < 465 {
            Self::indexed()
        } else {
            Self::truecolor()
        }
    }
}
```

**VERIFICATION METHOD**:
Automated hermetic unit tests verifying capability matrices without setting environment variables:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verify_apple_terminal_build_boundaries() {
        assert!(!ColorCapabilities::detect(Some("Apple_Terminal"), Some("455.0.0"), None).true_color);
        assert!(!ColorCapabilities::detect(Some("Apple_Terminal"), Some("464"), None).true_color);
        assert!(ColorCapabilities::detect(Some("Apple_Terminal"), Some("465"), None).true_color);
        assert!(ColorCapabilities::detect(Some("Apple_Terminal"), Some("500.1.2"), None).true_color);
        assert!(!ColorCapabilities::detect(Some("Apple_Terminal"), None, None).true_color);
        assert!(!ColorCapabilities::detect(Some("Apple_Terminal"), Some("invalid"), None).true_color);
        assert!(ColorCapabilities::detect(Some("iTerm2"), Some("3.4.0"), None).true_color);
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T10:24:14.303Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795602254303",
    "title": "Pure Terminal Capability Detection Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ratatui/ratatui",
    "source_uri": "https://github.com/ratatui/ratatui",
    "source_version": "HEAD",
    "content_hash": "862b7438f05702d4b432f4f78895d85ae1c341b3e72cb16ff457510b44b53f1f"
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
        "Harvested/verified timestamp recorded: 2026-11-25T10:24:14.303Z"
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
  "auth_token": "e273798aa10bf6e8ebb4e0f590408301d06be7d4637459e943cedab77cd43272"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

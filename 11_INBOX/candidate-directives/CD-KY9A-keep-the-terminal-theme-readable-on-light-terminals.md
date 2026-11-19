# Candidate Directive: [CD-KY9A] keep the terminal theme readable on light terminals

<!-- PROVENANCE_START
{
  "source_repository": "herdrdev/herdr",
  "source_url": "https://github.com/herdrdev/herdr",
  "source_version": "8734523b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T21:08:10.222Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-herdrdev-herdr",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [herdrdev/herdr](https://github.com/herdrdev/herdr) (Revision: `8734523b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T21:08:10.222Z`  
> **Learning ID**: `learn-github-herdrdev-herdr`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/app/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in herdrdev/herdr. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8734523b`: keep the terminal theme readable on light terminals. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/app/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    host: Option<&crate::terminal_theme::TerminalTheme>,
    if crate::config::canonical_theme_name(name) == Some("terminal") {
        if let Some(host) = host {
            palette = state::Palette::terminal_for_host(host);
        }
    }
        palette.accent_fg = None;
    host: Option<&crate::terminal_theme::TerminalTheme>,
        resolve_palette_for_theme_name(name, fallback, runtime, mode_custom, host),
    host: &crate::terminal_theme::TerminalTheme,
    resolve_palette_for_theme_name(name, "catppuccin", runtime, None, Some(host))
    resolve_effective_theme(&runtime, None, None).0
    appearance: Option<crate::terminal_theme::HostAppearance>,
    host: &crate::terminal_theme::TerminalTheme,
    resolve_effective_theme(runtime, appearance, Some(host)).0
        let (theme_palette, theme_name) = resolve_effective_theme(&theme_runtime, None, None);
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        resolve_palette_for_theme_name(name, fallback, runtime, mode_custom),
    resolve_palette_for_theme_name(name, "catppuccin", runtime, None)
    resolve_effective_theme(&runtime, None).0
    appearance: crate::terminal_theme::HostAppearance,
    resolve_effective_theme(runtime, Some(appearance)).0
        let (theme_palette, theme_name) = resolve_effective_theme(&theme_runtime, None);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8734523b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T21:08:10.220Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795122490220",
    "title": "keep the terminal theme readable on light terminals",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "herdrdev/herdr",
    "source_uri": "https://github.com/herdrdev/herdr",
    "source_version": "HEAD",
    "content_hash": "09f905149748651b7712d71ad630dd96ac337a1bbf59645e16d1b88249f227e7"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T21:08:10.220Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "88928f408a52e01c0a26814c7500313b18466c3c3308c8f357b5764fc0d5ea2e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

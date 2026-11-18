# Candidate Directive: [CD-TLXG] Recursive Transitive Config Boundary and Diff-Risk Preservation

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs/fallow",
  "source_url": "https://github.com/fallow-rs/fallow",
  "source_version": "548aba6d",
  "license": "MIT",
  "timestamp": "2026-11-18T05:35:26.788Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fallow-rs-fallow",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (Revision: `548aba6d`).  
> **License**: MIT | **Timestamp**: `2026-11-18T05:35:26.788Z`  
> **Learning ID**: `learn-github-fallow-rs-fallow`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When computing security, lint, or testing diff-risks across Git revisions (base vs head), the configuration parser **MUST NOT** limit evaluation to the leaf config file at the repository root. It **MUST** recursively traverse the entire `extends` inheritance hierarchy on both base and head commits up to an explicit loop-prevention depth (`MAX_EXTENDS_DEPTH`), resolving path-relative links. If an extended target cannot be parsed at base (e.g., external `npm:` package or uncommitted URL), that specific branch **MUST** be marked `Opaque` / `Unknown`, and any rule whose final resolved state depends on that opaque node **MUST NOT** trigger false weakening assertions. Furthermore, introducing broader path globs or removing negation exceptions (`!`) in ignore tables (`ignorePatterns`) **MUST** be classified as a suppression violation.

**WHY**:
Audits checking for weakened checks can be bypassed if an engineer removes an `extends: ["@company/strict-rules"]` line, alters a rule inside a nested `.eslintrc.json`/`.fallowrc.json` imported via `extends`, or adds an entry to `ignorePatterns`. Restricting checks to root keys lets critical safety weakenings slip through unnoticed.

**WHEN TO APPLY**:
Static audit tools, pull-request safety gates, policy compliance analyzers, and monorepo governance engines evaluating configuration mutations between two Git trees.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};
use rustc_hash::{FxHashMap, FxHashSet};
use serde_json::Value;

pub const MAX_EXTENDS_DEPTH: usize = 10;

pub enum LookupResult<'a> {
    Unknown, // Blocked by opaque boundary (e.g., remote npm package)
    Unset,   // Explicitly not set anywhere in chain
    Set { value: &'a Value, source_file: &'a Path },
}

pub struct ConfigChainResolver {
    order: Vec<Option<usize>>, // None represents an Opaque external source
    values: Vec<(PathBuf, serde_json::Map<String, Value>)>,
    active_cycle_guard: FxHashSet<PathBuf>,
}

impl ConfigChainResolver {
    pub fn resolve_key(&self, key: &str) -> LookupResult<'_> {
        // Evaluate in reverse merge order (latest source takes precedence)
        for source_idx in self.order.iter().rev() {
            match source_idx {
                None => {
                    // Encountered an opaque external source: future queries cannot guarantee state
                    return LookupResult::Unknown;
                }
                Some(idx) => {
                    let (path, map) = &self.values[*idx];
                    if let Some(val) = map.get(key) {
                        return LookupResult::Set { value: val, source_file: path.as_path() };
                    }
                }
            }
        }
        LookupResult::Unset
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Comparing only the local file content strings at HEAD vs BASE
fn detect_weakened_rules_bad(base_content: &str, head_content: &str) {
    // FAILS: Ignores changes made in inherited extends configs, fails on circular configs,
    // and cannot detect bypasses introduced via glob broadening in ignorePatterns.
    let base_rules = parse_rules(base_content);
    let head_rules = parse_rules(head_content);
    compare_rules(base_rules, head_rules);
}
```

**VERIFICATION METHOD**:
Provide test cases with chained configurations where a parent configuration alters rule severities or introduces `ignorePatterns`:
```bash
cargo test -p fallow-api --test integration_test -- test_config_chain_follows_extends_and_detects_negation_removal
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T05:35:26.787Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794980126787",
    "title": "Recursive Transitive Config Boundary and Diff-Risk Preservation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs/fallow",
    "source_uri": "https://github.com/fallow-rs/fallow",
    "source_version": "HEAD",
    "content_hash": "9d8492ca627c181478480340272267df87ed2f2c354143e2f257b73edb8c6bf0"
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
        "Harvested/verified timestamp recorded: 2026-11-18T05:35:26.787Z"
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
  "auth_token": "31cbdb5f3b220bcd369948de749b0aab44906ed0341270de9b0374f2e024a7ce"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

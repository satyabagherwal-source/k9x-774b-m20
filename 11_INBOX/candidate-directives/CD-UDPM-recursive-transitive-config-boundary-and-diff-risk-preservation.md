# Candidate Directive: [CD-UDPM] Recursive Transitive Config Boundary and Diff-Risk Preservation

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs-fallow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T05:36:02.682Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-fallow-rs-fallow-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs-fallow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T05:36:02.682Z`  
> **Learning ID**: `LEARN-EVO-fallow-rs-fallow-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T05:36:02.794Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794980162794",
    "title": "Recursive Transitive Config Boundary and Diff-Risk Preservation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs-fallow-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7c41ed80414aa37920800b1651ecbb5ac7183a7957bf118124bb7198f913f890"
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
        "Harvested/verified timestamp recorded: 2026-11-18T05:36:02.794Z"
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
  "auth_token": "725d3f516a65820cda0ac83f0b4c22abd228e106800512e3c1a4fa6456ae9c43"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

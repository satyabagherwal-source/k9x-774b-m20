# Candidate Directive: [CD-CL9B] Guard Invariant Against Syntactic Collision in Empty Collection Selectors

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "588d2c40",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T00:45:37.055Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `588d2c40`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T00:45:37.055Z`  
> **Learning ID**: `learn-github-dathere-qsv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
A selection/projection function that parses an empty string (`""`) or default sequence MUST NOT fall back to an "all columns / match everything" wildcard mode if an empty set semantically denotes "zero items match".

**WHY**:
In command-line and query-building interfaces, passing empty strings to parsers often aliases to the root default selector (`*` or "all fields"). When upstream filtering filters out all candidates (e.g., cardinality filtering finding zero columns below a given threshold), returning an empty selector string triggers the wildcard fallback. This causes the exact inverse of the intended behavior: the engine scans and processes *every* column instead of *no* columns, causing latency spikes, unexpected memory allocation, and erroneous data emission.

**WHEN TO APPLY**:
Apply in projection compilers, CLI argument serializers, dynamic SQL generators, and column-selector parsers where domain queries are serialized into downstream command strings.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub enum ColumnSelection {
    None,
    All,
    Specific(Vec<String>),
}

pub fn build_cardinality_selector(eligible_columns: &[String]) -> ColumnSelection {
    if eligible_columns.is_empty() {
        // Explicitly model the empty set as a distinct state
        ColumnSelection::None
    } else {
        ColumnSelection::Specific(eligible_columns.to_vec())
    }
}

pub fn execute_analysis(selection: ColumnSelection) -> Result<(), Box<dyn std::error::Error>> {
    match selection {
        ColumnSelection::None => {
            // Short-circuit: Do not spawn downstream analyzers or execute queries
            Ok(())
        }
        ColumnSelection::All => {
            // Explicitly requested wildcard
            run_frequency_analysis("*")
        }
        ColumnSelection::Specific(cols) => {
            run_frequency_analysis(&cols.join(","))
        }
    }
}

fn run_frequency_analysis(_arg: &str) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Empty string collapses to wildcard
pub fn build_selector_string(eligible_columns: &[String]) -> String {
    // If eligible_columns is empty, this returns ""
    eligible_columns.join(",")
}

pub fn execute_bad(eligible_columns: &[String]) {
    let selector = build_selector_string(eligible_columns);
    // BUG: SelectColumns::parse("") treats "" as "select all"!
    // Evaluates every column in the dataset instead of none!
    let cols = SelectColumns::parse(&selector).unwrap(); 
}
```

**VERIFICATION METHOD**:
Implement property-based tests verifying boundary handling. Provide an empty input array to the selector builder, feed the serialized result into the downstream query engine, and assert that zero items are queried or emitted.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T00:45:37.054Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795135537054",
    "title": "Guard Invariant Against Syntactic Collision in Empty Collection Selectors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "518ebd552ed3c7d47e36e8e79b6856936f53b7bb2d861dfdf51bc8363ba8b1c1"
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
        "Harvested/verified timestamp recorded: 2026-11-20T00:45:37.054Z"
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
  "auth_token": "aee3e81e95a870ebfd7f49c21f581b13fb248493c806ed1cca0b7efc668ead23"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

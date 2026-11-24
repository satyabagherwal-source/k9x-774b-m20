# Candidate Directive: [CD-HOV5] bound what one tool call may ask for (fixes #553)

<!-- PROVENANCE_START
{
  "source_repository": "Ataraxy-Labs/sem",
  "source_url": "https://github.com/Ataraxy-Labs/sem",
  "source_version": "e98c27d7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T19:36:00.545Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ataraxy-labs-sem",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Ataraxy-Labs/sem](https://github.com/Ataraxy-Labs/sem) (Revision: `e98c27d7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T19:36:00.545Z`  
> **Learning ID**: `learn-github-ataraxy-labs-sem`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/sem-mcp/src/server.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Ataraxy-Labs/sem. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f1f906ef`: mcp: bound what one tool call may ask for (fixes #553). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/sem-mcp/src/server.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        if let Some(msg) = params.entities().and_then(|e| crate::tools::batch_over(e.len(), "entities")) {
            return Ok(tool_error(msg));
        }
        let budget = params.token_budget.unwrap_or(8000).min(crate::tools::MAX_TOKEN_BUDGET);
        if let Some(msg) = queries.as_ref().and_then(|q| crate::tools::batch_over(q.len(), "queries")) {
            return Ok(tool_error(msg));
        }
        // Issue #553: a path named twice is read once, at most MAX_FILES distinct files per call, read on at most
        // READ_THREADS threads (never one thread per path), and a file past MAX_FILE_BYTES is refused with its size.
        let mut seen = std::collections::HashSet::new();
        let paths: Vec<String> = paths.into_iter().filter(|p| seen.insert(p.clone())).collect();
        if paths.len() > crate::tools::MAX_FILES {
            return tool_error(format!(
                "{} files in one read; at most {} (split the read)",
                paths.len(),
                crate::tools::MAX_FILES
            ));
        }
            let read_one = |p: &String| -> (String, Result<String, String>) {
                let (rel, abs) = Self::resolve_file_path(&root, p);
       
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        let budget = params.token_budget.unwrap_or(8000);
                let jobs: Vec<_> = paths
                    .iter()
                    .map(|p| {
                        let root = &root;
                        scope.spawn(move || {
                            let (rel, abs) = Self::resolve_file_path(root, p);
                            let text = match std::fs::read(&abs) {
                                Ok(b) if b.contains(&0) => Err(format!("binary file, {} bytes", b.len())),
                                Ok(b) => Ok(String::from_utf8_lossy(&b).into_owned()),
                                Err(e) if abs.is_dir() => Err(format!("a directory ({e}); list it with `in` and no mode")),
                                Err(e) => Err(e.to_string()),
                            };
                            (rel, text)
                        })
                    })
                    .collect();
                jobs.into_iter().filter_map(|j| j.join().ok()).collect()
            })
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f1f906ef` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T19:36:00.543Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795548960543",
    "title": "bound what one tool call may ask for (fixes #553)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Ataraxy-Labs/sem",
    "source_uri": "https://github.com/Ataraxy-Labs/sem",
    "source_version": "HEAD",
    "content_hash": "34ffad44c2c233018209b61f4c03b41280ad6354ecb058a86f2762c169251162"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T19:36:00.544Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "170aa5e626268fca67753f1adf48a2cbfb45fe3e049d94b855f1521dc7003854"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

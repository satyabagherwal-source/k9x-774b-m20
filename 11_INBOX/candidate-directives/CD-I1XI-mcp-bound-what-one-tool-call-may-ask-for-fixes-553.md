# Candidate Directive: [CD-I1XI] mcp: bound what one tool call may ask for (fixes #553)

<!-- PROVENANCE_START
{
  "source_repository": "ataraxy-labs-sem-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T19:36:17.340Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-ataraxy-labs-sem-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ataraxy-labs-sem-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T19:36:17.340Z`  
> **Learning ID**: `LEARN-EVO-ataraxy-labs-sem-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T19:36:17.474Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795548977474",
    "title": "mcp: bound what one tool call may ask for (fixes #553)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ataraxy-labs-sem-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5011a358873f222cae0177d365eaf045018dbb01e6427ce6991cf92d4e823ebc"
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
        "Harvested/verified timestamp recorded: 2026-11-24T19:36:17.475Z"
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
  "auth_token": "f35cc4204370e597cf9c376591e7757a5a90bd7d8fa42b46a21249a3b46972d3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

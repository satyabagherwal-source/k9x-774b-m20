# Candidate Directive: [CD-D8S3] retain unchanged cells in sparse frame snapshots

<!-- PROVENANCE_START
{
  "source_repository": "1jehuang/jcode",
  "source_url": "https://github.com/1jehuang/jcode",
  "source_version": "25b40def",
  "license": "MIT",
  "timestamp": "2026-11-15T05:31:42.387Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-1jehuang-jcode",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [1jehuang/jcode](https://github.com/1jehuang/jcode) (Revision: `25b40def`).  
> **License**: MIT | **Timestamp**: `2026-11-15T05:31:42.387Z`  
> **Learning ID**: `learn-github-1jehuang-jcode`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/jcode-tui/src/tui/app/run_shell.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 1jehuang/jcode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0a3e25f7`: tui): retain unchanged cells in sparse frame snapshots. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/jcode-tui/src/tui/app/run_shell.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Keep the spinner/animation snapshot exact without cloning unchanged cells
/// on sparse frames. Ratatui already counted flushed updates, so dense redraws
/// retain the straight vector copy rather than paying another diff scan.
pub(super) fn update_retained_frame(previous: &mut Buffer, rendered: &Buffer, updates: usize) {
    let sparse = previous.area == rendered.area
        && previous.content.len() == rendered.content.len()
        && updates < rendered.content.len() / 4;
    previous.area = rendered.area;
    if sparse {
        for (to, from) in previous.content.iter_mut().zip(&rendered.content) {
            if to != from {
                to.clone_from(from);
            }
        }
    } else {
        previous.content.clone_from(&rendered.content);
    }
}

                // Reuse the Vec and skip unchanged cells on sparse frames.
                update_retained_frame(&mut buffer, completed.buffer, completed.flushed_updates);
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                // Derived `Buffer::clone_from` reallocates; `Vec::clone_from`
                // reuses the existing cell storage.
                buffer.area = completed.buffer.area;
                buffer.content.clone_from(&completed.buffer.content);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0a3e25f7` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T05:31:42.385Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794720702385",
    "title": "retain unchanged cells in sparse frame snapshots",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "1jehuang/jcode",
    "source_uri": "https://github.com/1jehuang/jcode",
    "source_version": "HEAD",
    "content_hash": "606fccaf8f09cee87fbfbb870b77a30581d055bf0c6ef13cec01746b1cd30a8a"
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
        "Harvested/verified timestamp recorded: 2026-11-15T05:31:42.385Z"
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
  "auth_token": "bd5958116b9e83b8a01285c4dfa086c4a6bbe69ec760ec5ed3b3cf15a70a1bf7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

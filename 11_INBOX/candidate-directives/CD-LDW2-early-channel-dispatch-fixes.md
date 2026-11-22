# Candidate Directive: [CD-LDW2] early channel dispatch fixes

<!-- PROVENANCE_START
{
  "source_repository": "grpc/grpc-rust",
  "source_url": "https://github.com/grpc/grpc-rust",
  "source_version": "831ba3d9",
  "license": "MIT",
  "timestamp": "2026-11-22T01:23:47.474Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-grpc-grpc-rust",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [grpc/grpc-rust](https://github.com/grpc/grpc-rust) (Revision: `831ba3d9`).  
> **License**: MIT | **Timestamp**: `2026-11-22T01:23:47.474Z`  
> **Learning ID**: `learn-github-grpc-grpc-rust`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `grpc/src/client/channel.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in grpc/grpc-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `10337899`: grpc: early channel dispatch fixes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `grpc/src/client/channel.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use crate::client::InvokeOnce;
                    if let Ok(invoker) = sc.ready_invoker() {
                        let on_complete = pr.on_complete.take();
                        let (tx, rx) = invoker.invoke_once(headers, options).await;
                        // Notify the LB policy when the RPC completes (or is
                        // abandoned) so it can release any per-call state.
                        let rx = match on_complete {
                            Some(on_complete) => {
                                BoxRecvStream::new(CompletionRecvStream::new(rx, on_complete))
                            }
                            None => rx,
                        };
                        return (tx, rx);
                    }
                    // The subchannel likely left READY before the LB policy
                    // updated its picker, so queue the pick and wait for a new
                    // picker.  Dropping the pick drops its completion callback
                    // without invoking it, since the RPC never started.
                    // TODO: Check wait-for-ready and queue instead.
                    if status.is_restricted_control_plane_code() {
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                    let on_complete = pr.on_complete.take();
                    let (tx, rx) = sc.invoke(headers, options).await;
                    // Notify the LB policy when the RPC completes (or is
                    // abandoned) so it can release any per-call state.
                    let rx = match on_complete {
                        Some(on_complete) => {
                            BoxRecvStream::new(CompletionRecvStream::new(rx, on_complete))
                        }
                        None => rx,
                    };
                    return (tx, rx);
                    todo!("dropped pick: {:?}", status);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `10337899` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T01:23:47.472Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795310627472",
    "title": "early channel dispatch fixes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "grpc/grpc-rust",
    "source_uri": "https://github.com/grpc/grpc-rust",
    "source_version": "HEAD",
    "content_hash": "38c569df5de8efba5ea6cfaefa50d49ccf5a646a48fd2f11adc239815f905355"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-22T01:23:47.472Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "21d296f874076e95d48c9b92375c769afb6ac8337b951335370895c51187b2b4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

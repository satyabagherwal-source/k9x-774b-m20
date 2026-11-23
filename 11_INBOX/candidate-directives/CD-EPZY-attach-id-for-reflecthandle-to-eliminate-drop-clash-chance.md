# Candidate Directive: [CD-EPZY] attach id for ReflectHandle to eliminate drop clash chance

<!-- PROVENANCE_START
{
  "source_repository": "kube-rs-kube-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T19:18:01.894Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kube-rs-kube-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kube-rs-kube-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T19:18:01.894Z`  
> **Learning ID**: `LEARN-EVO-kube-rs-kube-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `kube-runtime/src/reflector/dispatcher.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kube-rs/kube. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6a339634`: attach id for ReflectHandle to eliminate drop clash chance. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `kube-runtime/src/reflector/dispatcher.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#[cfg(feature = "unstable-runtime-subscribe")]
use crate::reflector::subscriber::SubscriberId;
Subscribers can be added or removed while the root stream is running, but
the semantics are not fully replay-safe: a subscriber added mid-stream receives no
replay of already-deleted or pending entries, and a dropped subscriber never receives
pending delete events. Prefer creating all subscribers before polling the root stream
and keeping them alive until it terminates.
    #[cfg(feature = "unstable-runtime-subscribe")]
    id: SubscriberId,
        #[cfg(feature = "unstable-runtime-subscribe")]
        let id = reader.add_subscriber();
        #[cfg(feature = "unstable-runtime-subscribe")]
        return Self { rx, reader, id };
        #[cfg(not(feature = "unstable-runtime-subscribe"))]
                    let obj = if obj_ref.extra.pending_lookups.is_some() {
                        this.reader.remove(&obj_ref, *this.id)
        self.reader().drop_subscriber(self.id);
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:

    // Return a number of active subscribers to this shared sender.
    #[cfg(feature = "unstable-runtime-subscribe")]
    pub(crate) fn subscribers(&self) -> Option<usize> {
        Some(self.dispatch_tx.receiver_count()).filter(|c| *c > 0)
    }
Dynamically adding or removing subscribers while the root stream is running
is experimental and may cause issues. Create all subscribers before polling 
the root stream and keep them alive until it terminates.
                    let obj = if obj_ref.extra.remaining_lookups.is_some() {
                        this.reader.remove(&obj_ref)
        self.reader().drop_subscriber();
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T19:18:02.010Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795461482010",
    "title": "attach id for ReflectHandle to eliminate drop clash chance",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kube-rs-kube-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ef2437f69f90a3075d8929c0a277365c304f0ccc70826c53b0691fb25902f522"
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
        "Harvested/verified timestamp recorded: 2026-11-23T19:18:02.010Z"
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
  "auth_token": "ac833e3e40e35f984c6b3997f65665a72ebbf592c361f02372717e9186bf7a68"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-PVEJ] Bounded-Frame Body Ingestion with Saturating Cap Defense

<!-- PROVENANCE_START
{
  "source_repository": "telemt-telemt-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T18:17:21.112Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-telemt-telemt-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [telemt-telemt-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T18:17:21.112Z`  
> **Learning ID**: `LEARN-EVO-telemt-telemt-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Network API ingestion endpoints parsing untrusted HTTP chunked or raw byte streams MUST NOT use unbounded `read_to_end()` or allocate before validating size. The stream reader MUST check each incoming frame using `saturating_add` against a strict byte limit and reject oversized payloads immediately before copying bytes into memory.

**WHY**:
Using `.len() + chunk.len() > limit` without saturation causes integer overflow bugs on 32-bit targets or under crafted huge chunk lengths. Furthermore, collecting chunks into an internal buffer before checking the aggregate size allows an attacker to consume gigabytes of heap memory through slow-drip HTTP/1.1 chunk-encoded attacks, leading to OOM crashes in the host proxy process.

**WHEN TO APPLY**:
Apply to all REST/JSON administrative endpoints, webhook receivers, and configuration mutation controllers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use http_body_util::BodyExt;
use hyper::body::Incoming;

#[derive(Debug)]
pub enum IngestionError {
    PayloadTooLarge { limit: usize },
    StreamError,
}

pub async fn read_bounded_payload(
    mut body: Incoming,
    max_allowed_bytes: usize,
) -> Result<Vec<u8>, IngestionError> {
    let mut collected = Vec::new();

    while let Some(frame_res) = body.frame().await {
        let frame = frame_res.map_err(|_| IngestionError::StreamError)?;
        
        if let Some(chunk) = frame.data_ref() {
            // SATURATING CHECK: Guard against overflow while enforcing strict limit
            let projected_len = collected.len().saturating_add(chunk.len());
            if projected_len > max_allowed_bytes {
                return Err(IngestionError::PayloadTooLarge {
                    limit: max_allowed_bytes,
                });
            }
            collected.extend_from_slice(chunk);
        }
    }

    Ok(collected)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER use standard read_to_end or unchecked addition for external HTTP frames
pub async fn bad_read(mut body: Incoming, limit: usize) -> Vec<u8> {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T18:17:21.210Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794766641210",
    "title": "Bounded-Frame Body Ingestion with Saturating Cap Defense",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "telemt-telemt-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d50fb4b990ef63193b02d94b9875796f7065e010d73531905dced36bf0a09b55"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T18:17:21.210Z"
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
  "auth_token": "6e090913e572a3fae9d1467f4a54f53c6ebc1c17f30bfa19b8654664325ce837"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

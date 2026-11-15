# Candidate Directive: [CD-PST2] Bounded-Frame Body Ingestion with Saturating Cap Defense

<!-- PROVENANCE_START
{
  "source_repository": "telemt/telemt",
  "source_url": "https://github.com/telemt/telemt",
  "source_version": "dac7aeee",
  "license": "NOASSERTION",
  "timestamp": "2026-11-15T18:17:17.846Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-telemt-telemt",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [telemt/telemt](https://github.com/telemt/telemt) (Revision: `dac7aeee`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-15T18:17:17.846Z`  
> **Learning ID**: `learn-github-telemt-telemt`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    let mut buf = Vec::new();
    while let Some(frame) = body.frame().await {
        let chunk = frame.unwrap().into_data().unwrap();
        // ANTI-PATTERN: Unchecked addition + buffer allocation before verification
        buf.extend(chunk);
        if buf.len() > limit { // Already allocated the excess memory!
            panic!("too large");
        }
    }
    buf
}
```

**VERIFICATION METHOD**:
Run unit tests supplying an `Incoming` mock stream generating `max_allowed_bytes + 1` across multiple chunks; assert that the reader returns `IngestionError::PayloadTooLarge` immediately upon receiving the frame that crosses the boundary, without accumulating subsequent data.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T18:17:17.846Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794766637846",
    "title": "Bounded-Frame Body Ingestion with Saturating Cap Defense",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "telemt/telemt",
    "source_uri": "https://github.com/telemt/telemt",
    "source_version": "HEAD",
    "content_hash": "abe0868c8f2ddb899cf78caad62e2843afb6cb90986753a44c8c9f30bbf6b052"
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
        "Harvested/verified timestamp recorded: 2026-11-15T18:17:17.846Z"
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
  "auth_token": "33e0e9cae177d3b09ebf575522f4a9b75df10769bcf848b5979d239de586b54e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

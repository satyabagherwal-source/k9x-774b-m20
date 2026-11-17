# Candidate Directive: [CD-3RKW] Idempotent Precondition Retries on Storage Boundaries

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "d97ac24e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:43:37.952Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `d97ac24e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:43:37.952Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing exclusive writes (`createExclusive`, `PUT if-none-match: *`, `O_CREAT | O_EXCL`) against eventual-consistency or retrying network clients, the operational layer MUST NOT interpret client-side precondition failures as definitive proof of conflict without validating if the existing entity's unique upload identifier matches the current transaction attempt.

**WHY**:
Network partitions or HTTP socket timeouts often occur *after* the remote storage engine (e.g., AWS S3, Azure Blob, GCS) successfully persists data and registers the metadata. Automatic client SDK retries replay the request with `If-None-Match: *`. The second request fails with `412 Precondition Failed` (`FileAlreadyExistsException`), falsely alerting the query engine that another concurrent writer won the race, aborting an otherwise valid single-producer operation.

**WHEN TO APPLY**:
Storage connectors, object-store adaptors (S3, GCS, ADLS), distributed lock managers, and consensus client writers executing conditional network writes.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Safe exclusive write retry pattern with ownership confirmation
public void createExclusiveWithRetry(Path target, byte[] data, String writeNonce) 
        throws FileAlreadyExistsException, IOException
{
    try {
        underlyingClient.putObjectConditional(target, data, /* ifNoneMatch */ "*");
    }
    catch (PreconditionFailedException e) {
        // Did our previous attempt succeed before the connection severed?
        ObjectMetadata meta = underlyingClient.getObjectMetadata(target);
        if (writeNonce.equals(meta.getUserMetadata().get("write-nonce"))) {
            // Self-write confirmed; succeed idempotently
            return;
        }
        // Genuine collision with another writer
        throw new FileAlreadyExistsException(target.toString());
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Direct translation of precondition failure to collision error
public void createExclusiveBuggy(Path target, byte[] data) throws IOException {
    try {
        s3Client.putObject(PutObjectRequest.builder()
            .bucket(bucket).key(key).ifNoneMatch("*").build(), 
            RequestBody.fromBytes(data));
    } catch (S3Exception e) {
        if (e.statusCode() == 412) {
            // BLIND ASSUMPTION: Another writer created this file.
            // Reality: The first attempt succeeded, the TCP socket dropped, the retry hit 412!
            throw new FileAlreadyExistsException(target.toString());
        }
        throw e;
    }
}
```

**VERIFICATION METHOD**:
Implement a mock proxy injecting TCP RST after 100% of bytes are uploaded on initial `PUT`. Validate that subsequent SDK retries or application retry loops complete successfully without throwing `FileAlreadyExistsException`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:43:37.952Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905017952",
    "title": "Idempotent Precondition Retries on Storage Boundaries",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb/trino",
    "source_uri": "https://github.com/trinodb/trino",
    "source_version": "HEAD",
    "content_hash": "b3d4e339c448d1d980f443878b38a45689c39360dc3e5beca50d35e830b510ab"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:43:37.952Z"
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
  "auth_token": "f3564902930218db7d3d2fc14269c6aa1ab3d26ffa207cda255f3076b65a7ef1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

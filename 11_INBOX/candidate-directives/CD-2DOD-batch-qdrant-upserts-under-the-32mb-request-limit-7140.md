# Candidate Directive: [CD-2DOD] batch Qdrant upserts under the 32MB request limit (#7140)

<!-- PROVENANCE_START
{
  "source_repository": "mintplex-labs-anything-llm-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T16:59:45.321Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mintplex-labs-anything-llm-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mintplex-labs-anything-llm-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T16:59:45.321Z`  
> **Learning ID**: `LEARN-EVO-mintplex-labs-anything-llm-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `server/utils/vectorDbProviders/qdrant/index.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Mintplex-Labs/anything-llm. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a145523c`: batch Qdrant upserts under the 32MB request limit (#7140). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/utils/vectorDbProviders/qdrant/index.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
          const records = [];
                records.push({ id, vector: chunk.vector, payload });
          await this.#upsertRecords(client, namespace, records);
        await this.#upsertRecords(client, namespace, vectors);
        await storeVectorResult(toChunks(vectors, 500), fullFilePath);
      // Qdrant's reason for a rejected request is in the response body, not the message.
      const reason = e?.data?.status?.error;
      const message = reason ? `${e.message}: ${reason}` : e.message;
      this.logger("addDocumentToNamespace", message);
      return { vectorized: false, error: message };
    }
  }

  /**
   * Upsert points in batches small enough to stay under Qdrant's default 32MB
   * request limit. A 500-point batch of 4096-dim vectors is ~42MB of JSON.
   * @param {QdrantClient} client
   * @param {string} namespace
   * @param {{id: string, vector: number[], payload: object}[]} records
   */
  async #upsertRecords(client, namespace, records) {
    for (const batch of toChunks(records, 100)) {
      const result = await client.upsert(namespace, {
        wait: true,
        batch: {
          ids: batch.map((r) => r.id),
          vectors: batch.map((r) => r.vecto
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
            const submission = {
              ids: [],
              vectors: [],
              payloads: [],

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T16:59:45.465Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794589185465",
    "title": "batch Qdrant upserts under the 32MB request limit (#7140)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mintplex-labs-anything-llm-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "114092763b7af434f495b9f1e848f90f13e06aa84a4e150079db2d72d6cdac60"
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
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-13T16:59:45.466Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
    "Conflict with RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
  ],
  "missing_information": [
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "dfbf66da60a411af805253c2853bb27c3f409487825d6f5276ee22733ec01f23"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

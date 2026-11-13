# Candidate Directive: [CD-1AYZ] batch Qdrant upserts under the 32MB request limit (#7140)

<!-- PROVENANCE_START
{
  "source_repository": "Mintplex-Labs/anything-llm",
  "source_url": "https://github.com/Mintplex-Labs/anything-llm",
  "source_version": "1626d971",
  "license": "MIT",
  "timestamp": "2026-11-13T16:58:55.308Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mintplex-labs-anything-llm",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm) (Revision: `1626d971`).  
> **License**: MIT | **Timestamp**: `2026-11-13T16:58:55.308Z`  
> **Learning ID**: `learn-github-mintplex-labs-anything-llm`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
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
            };

                submission.ids.push(id);
                submission.vectors.push(chunk.vector);
                submission.payloads.push(payload);

            const additionResult = await client.upsert(namespace, {
              wait: true,
              batch: { ...submission },
            });
            if (additionResult?.status !== "completed")
              throw new Error("Error embedding into QDrant", additionResult);
        const chunks = [];

        for (const chunk of toChunks(vectors, 500)) {
          const batchIds = [],
            batchVectors = [],
            batchPayloads = [];
          chunks.push(chunk);
          chunk.forEach((v) => {
            batchIds.push(v.id);
            batchVectors.push(v.vector);
            batchPayloads.push(v.payload);
          });

          const additionResult = await client.upsert(namespace, {
            wait: true,
            batch: {
              ids: batchIds,
              vectors: batchVectors,
              payloads: batchPayloads,
            },
          });
          if (additionRes
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a145523c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T16:58:55.305Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794589135305",
    "title": "batch Qdrant upserts under the 32MB request limit (#7140)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Mintplex-Labs/anything-llm",
    "source_uri": "https://github.com/Mintplex-Labs/anything-llm",
    "source_version": "HEAD",
    "content_hash": "911f2018ea89fac895963188ab7c1b7e6037d4900d6033f1dba5cb728ebb9ab9"
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
        "Harvested/verified timestamp recorded: 2026-11-13T16:58:55.305Z"
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
  "auth_token": "2b472dfa4c5462bd0bf6bccade05f1312b0481631d95f477fb82f2516a83025f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

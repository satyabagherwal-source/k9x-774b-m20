# Candidate Directive: [CD-7P4G] Distributed Lock Monotonicity Invariant on Version Progression

<!-- PROVENANCE_START
{
  "source_repository": "apple/foundationdb",
  "source_url": "https://github.com/apple/foundationdb",
  "source_version": "17a225f7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:18:41.776Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apple-foundationdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apple/foundationdb](https://github.com/apple/foundationdb) (Revision: `17a225f7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:18:41.776Z`  
> **Learning ID**: `learn-github-apple-foundationdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Any distributed background worker executing partitioned log application, recovery, or backup/restore across version ranges $[V_{\text{start}}, V_{\text{end}})$ MUST await the full durable commit of its checkpoint transaction before scheduling or publishing the next window range $[V_{\text{end}}, V_{\text{next}})$.

**WHY**:
In asynchronous distributed actors, if an actor updates an in-memory cursor $V_{\text{end}}$ and dispatches an asynchronous commit request `sendCommitTransactionRequest()` without awaiting the completion `Future`, a concurrent loop iteration or failover controller can observe the old uncommitted start version $V_{\text{start}}$ alongside an updated end marker. This triggers overlapping executions over $[V_{\text{start}}, V_{\text{next}})$. Because mutations in range $[V_{\text{start}}, V_{\text{end}})$ are already purged or advanced, the re-entrant actor encounters missing mutation stream chunks and crashes with unrecoverable corruption.

**WHEN TO APPLY**:
Distributed continuous log replay engines, Change Data Capture (CDC) pipelines, backup restoration actors, and replication streams.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// Verified Pattern: Actor Monotonicity Guard
ACTOR Future<Void> applyMutationRangePipeline(Reference<IDatabase> cx, Version beginVersion, Version endVersion) {
    state Reference<ITransaction> tr = cx->createTransaction();
    loop {
        try {
            tr->setOption(FDBTransactionOptions::PRIORITY_SYSTEM_IMMEDIATE);
            tr->setOption(FDBTransactionOptions::ACCESS_SYSTEM_KEYS);
            tr->setOption(FDBTransactionOptions::LOCK_AWARE);

            // Persist the new progress checkpoint
            tr->set(applyProgressKey, BinaryWriter::toValue(endVersion, Unversioned()));

            // MANDATORY: Block actor execution until commit is fully ACKed by Proxies and TLogs
            wait(tr->commit());
            break;
        } catch (Error& e) {
            wait(tr->onError(e));
        }
    }
    // Only dispatch or update subsequent version windows AFTER durable ACK
    return Void();
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Firing commit asynchronously without waiting before progressing pipeline state
void processMutations(Version begin, Version end) {
    applyMutations(begin, end);
    // CATASTROPHIC: Dispatches transaction commit to network thread but does not wait()
    sendCommitTransactionRequest(end);
    
    // Updates end version marker in memory immediately
    this->currentBegin = end; 
    // If scheduler yields, next step picks up stale database state if another actor reads DB
}
```

**VERIFICATION METHOD**:
Inject random delays into the network layer handling commit acknowledgments in simulation tests, verifying that the next batch version is never read from the database until the prior transaction successfully commits.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:18:41.775Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903521775",
    "title": "Distributed Lock Monotonicity Invariant on Version Progression",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apple/foundationdb",
    "source_uri": "https://github.com/apple/foundationdb",
    "source_version": "HEAD",
    "content_hash": "48652764886e24ddf86070b4d87765075f8c4dd7a1480ab5ac6b5ea802e416f7"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:18:41.775Z"
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
  "auth_token": "f9399800dd0b12fb331941db416af1a41c23613daca9b7732b92cdb74c681d62"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

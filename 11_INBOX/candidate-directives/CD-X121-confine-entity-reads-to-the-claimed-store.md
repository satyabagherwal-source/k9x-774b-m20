# Candidate Directive: [CD-X121] confine entity reads to the claimed store

<!-- PROVENANCE_START
{
  "source_repository": "doobidoo/mcp-memory-service",
  "source_url": "https://github.com/doobidoo/mcp-memory-service",
  "source_version": "f4eac406",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T02:47:50.425Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-doobidoo-mcp-memory-service",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) (Revision: `f4eac406`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T02:47:50.425Z`  
> **Learning ID**: `learn-github-doobidoo-mcp-memory-service`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `changelog.d/2118.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `41b792b2`: graph): confine entity reads to the claimed store. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/2118.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Store-scoped entity reads no longer cross partitions (#2118, part of #1880).** `memory_graph` has no store column, so every `GraphStorage` entity read was global: `list_entities`, `get_entity_profile`, `find_memories_by_entity` and `get_entities_for_memory` counted and returned links from every store, and `_discover_related_entities` walked `common_neighbors` unfiltered. A credential scoped to one store therefore received `related_entities` reachable only through another store's memories — `chunks` was already confined by post-filtering `get_by_hash`, `related_entities` was not. The graph shares its SQLite file with `memories`, so each of those reads now confines through the store of the edge's source memory, and `memory_detail` passes its claimed store down instead of scanning a `limit * 10` window and discarding the difference. `None` and `"all"` stay unscoped, so single-store installs and every unscoped caller see exactly what they saw before. `MilvusGraphStorage` accepts the same `store` keyword to keep the signature-parity guard green and returns nothing for a named store until #2119 gives its collection the field — refusing rather than serving the global answer.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `41b792b2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T02:47:50.423Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795574870423",
    "title": "confine entity reads to the claimed store",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "doobidoo/mcp-memory-service",
    "source_uri": "https://github.com/doobidoo/mcp-memory-service",
    "source_version": "HEAD",
    "content_hash": "a4e68f410e397f9c691d9b616f1b58a55d44a2773c33bd47a652cf86c0222a26"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T02:47:50.423Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "a3e7dee4811ac8292e9dff7840052ac76b5baa15a3b918b508fa7df47b8de4eb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

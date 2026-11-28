# Candidate Directive: [CD-S50J] Canonical Zero-Allocation Wire Deserialization with Omission Semantics

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "9e3af362",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T08:38:58.147Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `9e3af362`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T08:38:58.147Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
When serializing distributed configuration, payload metadata, or execution manifests where server admission policies differentiate between "omitted" and "explicit default" values, the client-side AST **MUST** preserve three-state logic (`None` vs `Explicit(val)`) through to wire serialization and runtime digest hashing. It **MUST NOT** collapse missing optional fields into assumed client-side defaults prior to wire serialization.

**WHY**:
Modern distributed catalog servers and older backward-compatible enterprise deployments often employ admission controllers with hardcoded validation rules. Forcing an explicit field (e.g., `gpus_per_worker: 1`) when the caller simply requested boolean capability (`gpu: True`) causes older or strictly-scoped servers to reject the query as unrecognized. Furthermore, computing an environment verification digest over pre-defaulted payloads invalidates fingerprint caches between heterogeneous client-server versions.

**WHEN TO APPLY**:
API boundary normalizers, AST builders, and remote service RPC dispatchers communicating with heterogeneous distributed nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Optional, Tuple

def normalize_compute_spec(
    gpu_enabled: bool,
    gpu_count: Optional[int]
) -> Tuple[bool, Optional[int]]:
    if not gpu_enabled:
        return False, None
    if gpu_count is None:
        # Invariant: Preserve None to allow the server admission controller
        # to apply its own cluster-wide defaults without breaking wire schema checks.
        return True, None
    if isinstance(gpu_count, bool) or not isinstance(gpu_count, int) or gpu_count < 1:
        raise ValueError("gpu_count must be a positive integer")
    return True, gpu_count
```

**NEGATIVE CONSTRAINT**:
```python
def normalize_compute_spec_anti_pattern(gpu_enabled: bool, gpu_count: Optional[int]):
    # ANTI-PATTERN: Forcing implicit defaults at the edge prevents server-side schema evolution
    # and breaks runtime compatibility with back-level servers.
    if gpu_enabled and gpu_count is None:
        gpu_count = 1 
    return gpu_enabled, gpu_count
```

**VERIFICATION METHOD**:
Unit test comparing serialized JSON outputs under omitted vs explicit conditions:
```python
def test_compute_spec_omission_preserves_wire_format():
    enabled, count = normalize_compute_spec(True, None)
    payload = {"gpu": enabled, **({"gpus_per_worker": count} if count is not None else {})}
    assert "gpus_per_worker" not in payload
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:38:58.147Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795855138147",
    "title": "Canonical Zero-Allocation Wire Deserialization with Omission Semantics",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb/lancedb",
    "source_uri": "https://github.com/lancedb/lancedb",
    "source_version": "HEAD",
    "content_hash": "0e6b25f27ae5af8aadb6063c1a270ceb8b7ec941ce94c457ef45b909ccec898d"
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:38:58.147Z"
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
  "auth_token": "12dbf9605bc5351da02ad1b49f4633ee7e78675f9c2f668bec66d47bc48aa2f8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

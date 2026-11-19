# Candidate Directive: [CD-QMKG] Multi-Tier Policy Inheritance Overwrite Guard

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "15845c2a",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-19T08:08:45.760Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `15845c2a`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-19T08:08:45.760Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When inheriting multi-field security, extraction, or memory policies across hierarchical scopes (Global $\to$ User $\to$ Session $\to$ Request), hierarchical policy resolvers **MUST** perform recursive partial field-level merges rather than full-object level overwrites. A higher-precedence scope specifying a single configuration flag **MUST NOT** obliterate orthogonal configuration arrays or constraints defined at an ancestor scope.

**WHY**:
In OpenViking, the gateway created capture sessions with `{"memory_policy": {"working_memory": {"enabled": false}}}`. The policy engine evaluated session policy as having complete precedence over user policy. Because the session policy did not specify `memory_types: ["events"]` (which was configured at the user level), the whole object overwrite resolved `memory_types` to `null` (allow all). Sensitive memories, raw transcripts, and unapproved categories were extracted because a child boolean flag wiped an ancestor security allowlist.

**WHEN TO APPLY**:
Mandatory for RBAC/ABAC policy engines, LLM extraction rules, tool authorization contexts, and runtime configuration layers where defaults can be overridden at session or request granularity.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MemoryPolicy(BaseModel):
    working_memory_enabled: Optional[bool] = None
    memory_types: Optional[List[str]] = None
    max_tokens: Optional[int] = None

    def merge_with_ancestor(self, ancestor: "MemoryPolicy") -> "MemoryPolicy":
        """
        Deeply merges current policy over ancestor policy.
        Child explicit values take precedence, but omitted (None) values
        preserve ancestor constraints.
        """
        return MemoryPolicy(
            working_memory_enabled=(
                self.working_memory_enabled
                if self.working_memory_enabled is not None
                else ancestor.working_memory_enabled
            ),
            memory_types=(
                self.memory_types
                if self.memory_types is not None
                else (ancestor.memory_types.copy() if ancestor.memory_types is not None else None)
            ),
            max_tokens=(
                self.max_tokens
                if self.max_tokens is not None
                else ancestor.max_tokens
            ),
        )


def resolve_effective_policy(
    user_policy: Optional[MemoryPolicy],
    session_policy: Optional[MemoryPolicy],
) -> MemoryPolicy:
    base = user_policy or MemoryPolicy(working_memory_enabled=True, memory_types=["all"])
    if not session_policy:
        return base
    return session_policy.merge_with_ancestor(base)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Whole-object precedence replacement
def resolve_policy_unsafe(user_policy: dict, session_policy: dict) -> dict:
    # If session defines ANY policy, user policy is completely discarded!
    if session_policy:
        return session_policy  # Masks memory_types, principal scoping, etc.
    return user_policy
```

**VERIFICATION METHOD**:
Execute property-based unit tests where ancestor policies define restrictive allowlists (`memory_types=['events']`) and child policies set unrelated flags (`working_memory_enabled=False`). Assert that `effective_policy.memory_types == ['events']`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T08:08:45.759Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795075725759",
    "title": "Multi-Tier Policy Inheritance Overwrite Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "volcengine/OpenViking",
    "source_uri": "https://github.com/volcengine/OpenViking",
    "source_version": "HEAD",
    "content_hash": "59f33cbc93c628c7b94272c282db792c524f8470b8d3cd9d41426dd8a2f1040b"
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
        "Harvested/verified timestamp recorded: 2026-11-19T08:08:45.759Z"
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
  "auth_token": "7b98aec8153aa5ffeff1b1e4b57b2b4e31eb68f3ecd9f63e64738ae1de2b696c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

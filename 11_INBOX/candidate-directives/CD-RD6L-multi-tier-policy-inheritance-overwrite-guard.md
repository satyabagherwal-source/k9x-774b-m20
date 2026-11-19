# Candidate Directive: [CD-RD6L] Multi-Tier Policy Inheritance Overwrite Guard

<!-- PROVENANCE_START
{
  "source_repository": "volcengine-openviking-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T08:09:20.142Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-volcengine-openviking-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine-openviking-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T08:09:20.142Z`  
> **Learning ID**: `LEARN-EVO-volcengine-openviking-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T08:09:20.253Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795075760253",
    "title": "Multi-Tier Policy Inheritance Overwrite Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "volcengine-openviking-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "10fcff3c5ab1a8e22d2f44fdf12809bbcf3ce048dd1e6dda79db1834848d744a"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-19T08:09:20.253Z"
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
  "auth_token": "6e46eb71ab83a90b38fa2bcf78f5f7e551df1c9a4c92eb46828df6beb937a66e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

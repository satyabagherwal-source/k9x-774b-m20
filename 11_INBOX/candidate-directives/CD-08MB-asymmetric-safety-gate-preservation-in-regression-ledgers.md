# Candidate Directive: [CD-08MB] Asymmetric Safety-Gate Preservation in Regression Ledgers

<!-- PROVENANCE_START
{
  "source_repository": "maziyarpanahi-openmed-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:04:00.301Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-maziyarpanahi-openmed-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [maziyarpanahi-openmed-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:04:00.301Z`  
> **Learning ID**: `LEARN-EVO-maziyarpanahi-openmed-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When comparing candidate artifacts (e.g., fine-tuned models, algorithmic revisions, configuration policies) against a baseline champion in an automated promotion ledger, any evaluation axis or safety gate present in and passed by the champion that is omitted or unreported by the challenger MUST be evaluated as a blocking `REGRESSION` (`missing_in_challenger`) rather than a silent skip or neutral pass.

**WHY**:
In evaluation and deployment frameworks, matrix comparisons that iterate over the intersection of candidate and baseline metrics create an existential blind spot: a fine-tuned model or configuration that fails to output a critical security evaluation axis (such as an adversarial PII recall metric or HIPAA PHI gate) will emit zero records for that axis. If the ledger engine only scores reported gates, missing critical measurements are dropped entirely from the ledger, allowing a deficient challenger to bypass critical regression barriers and get promoted to production.

**WHEN TO APPLY**:
Apply to all model promotion evaluators, canary release gates, CI/CD automated deployment blockers, and ML continuous evaluation pipelines measuring accuracy, drift, safety, and latency invariants.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from dataclasses import dataclass
from enum import Enum
from typing import Any

class GateStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REGRESSION = "REGRESSION"

@dataclass(frozen=True)
class GateLedgerEntry:
    axis: str
    status: GateStatus
    reason: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {"axis": self.axis, "status": self.status.value}
        if self.reason is not None:
            data["reason"] = self.reason
        return data

def build_gate_ledger(
    champion_report: dict[str, float],
    challenger_report: dict[str, float],
    critical_axes: set[str],
    tolerance: float = 0.02,
) -> list[GateLedgerEntry]:
    ledger: list[GateLedgerEntry] = []
    
    # 1. Asymmetric Challenger Audit: Check all axes the champion reported
    for axis, champ_score in champion_report.items():
        if axis in critical_axes and axis not in challenger_report:
            # MUST block promotion when challenger drops a safety axis
            ledger.append(
                GateLedgerEntry(
                    axis=axis,
                    status=GateStatus.REGRESSION,
                    reason="missing_in_challenger",

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:04:00.418Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795136640418",
    "title": "Asymmetric Safety-Gate Preservation in Regression Ledgers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "maziyarpanahi-openmed-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0de2be290fcf3c5f4305ca0a8c865af4be01633900bb3fcc16467f9edad25558"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:04:00.418Z"
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
  "auth_token": "aa52138267ebb08834a8aa5b84323d9f6cfe1a7696d652d95d5887e171ca0995"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

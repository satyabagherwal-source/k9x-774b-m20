# Candidate Directive: [CD-WICN] Asymmetric Safety-Gate Preservation in Regression Ledgers

<!-- PROVENANCE_START
{
  "source_repository": "maziyarpanahi/openmed",
  "source_url": "https://github.com/maziyarpanahi/openmed",
  "source_version": "e8325586",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T01:01:06.407Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-maziyarpanahi-openmed",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed) (Revision: `e8325586`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T01:01:06.407Z`  
> **Learning ID**: `learn-github-maziyarpanahi-openmed`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant): Opposing directive on 'validated': candidate forbids action ('never validated') while canonical Rule CANON-001 prescribes it ('always validate'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant)
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
                )
            )
            continue
            
        if axis in challenger_report:
            chal_score = challenger_report[axis]
            if (champ_score - chal_score) > tolerance:
                ledger.append(
                    GateLedgerEntry(
                        axis=axis,
                        status=GateStatus.REGRESSION,
                        reason=f"score_dropped_{champ_score:.4f}_to_{chal_score:.4f}",
                    )
                )
            else:
                ledger.append(GateLedgerEntry(axis=axis, status=GateStatus.PASS))

    return ledger

def evaluate_promotion(ledger: list[GateLedgerEntry]) -> tuple[bool, list[str]]:
    blocking_reasons = [
        f"blocking safety regression on {e.axis} ({e.reason})"
        for e in ledger
        if e.status == GateStatus.REGRESSION
    ]
    is_promotable = len(blocking_reasons) == 0
    return is_promotable, blocking_reasons
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER compute promotion eligibility solely over the intersection of keys
def build_broken_ledger(champion: dict, challenger: dict) -> bool:
    # BUG: If challenger completely omits 'HIPAA_API_KEY_RECALL', this loop
    # silently passes the challenger because champion keys are never validated!
    for axis in challenger.keys():
        if challenger[axis] < champion.get(axis, 0.0):
            return False
    return True
```

**VERIFICATION METHOD**:
Implement offline synthetic regression tests confirming that:
1. Providing a challenger report with 100% metrics across common keys but omitting a single critical gate present in the champion report results in an immediate `REGRESSION` entry tagged with `reason="missing_in_challenger"`.
2. The promotion decision evaluator returns `False` and explicitly formats the blocking axis name into the rejection log.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:01:06.407Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant): Opposing directive on 'validated': candidate forbids action ('never validated') while canonical Rule CANON-001 prescribes it ('always validate'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.48,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 48%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1795136466407",
    "title": "Asymmetric Safety-Gate Preservation in Regression Ledgers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "maziyarpanahi/openmed",
    "source_uri": "https://github.com/maziyarpanahi/openmed",
    "source_version": "HEAD",
    "content_hash": "9923aaffc0616d88b3536da99be8ac94e3021f4ac15defef2ade4ada113920b3"
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
      "opposing_rule": "RULE-CANON-001 (Untrusted External Input Boundary Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant): Opposing directive on 'validated': candidate forbids action ('never validated') while canonical Rule CANON-001 prescribes it ('always validate')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:01:06.407Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-001 (Untrusted External Input Boundary Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-001 (Untrusted External Input Boundary Invariant)",
    "Conflict with RULE-CANON-001 (Untrusted External Input Boundary Invariant)"
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
  "auth_token": "0050e5c129c0b83192221afceafba43b1d6ca91b7d616f840fb8a003c946ccb1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

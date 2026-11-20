# Candidate Directive: [CD-X37G] Dual-Mode Agentic Graceful Fallback for Third-Party API Integrations

<!-- PROVENANCE_START
{
  "source_repository": "tmolavi-siteprobe-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T06:37:28.716Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tmolavi-siteprobe-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tmolavi-siteprobe-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T06:37:28.716Z`  
> **Learning ID**: `LEARN-EVO-tmolavi-siteprobe-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Integrations interacting with paid or authenticated external APIs MUST provide a zero-credential, deterministic heuristic fallback mode that returns identical schema structures, allowing autonomous agents to execute end-to-end without credentials. Integrations MUST explicitly tag returned payloads with the execution mode (`mode: "live_api" | "free_agentic_heuristics"`).

**WHY**:
Autonomous coding agents run in sandboxed, transient environments (CI runners, local containers, isolated development environments) where third-party API credentials (such as DataForSEO, Search Console, Ahrefs) are rarely mounted. Hard dependencies on paid external APIs crash the agent's control loop, halting downstream evaluation and preventing remediation plan generation. Providing structured heuristic simulations maintains tool availability and preserves schema contracts.

**WHEN TO APPLY**:
Apply to all MCP servers, external data connectors, indexing trackers, and intelligence integrations consumed by autonomous agents where API availability cannot be guaranteed.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import os
from typing import Any, Dict, Optional
import httpx


class ResilientThirdPartyProvider:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("THIRD_PARTY_API_KEY")
        self.base_url = "https://api.external-service.com/v1"

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def get_domain_metrics(self, domain: str) -> Dict[str, Any]:
        clean_domain = domain.replace("https://", "").replace("http://", "").strip("/")

        # 1. Primary Path: Live API call
        if self.is_available():
            try:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{self.base_url}/metrics",
                        params={"domain": clean_domain},
                        headers=headers,
                    )
                    if resp.status_code == 200:
                        payload = resp.json()
                        return {
                            "mode": "live_api",
                            "domain": clean_domain,
                            "authority_score": payload.get("authority", 0),
                            "citation_count": payload.get("citations", 0),
                        }
            except Exception:
                # Fall back gracefully to heuristic mode on network/auth failure
                pass

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T06:37:28.825Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795156648824",
    "title": "Dual-Mode Agentic Graceful Fallback for Third-Party API Integrations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tmolavi-siteprobe-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5d2997568552ac6294548263c805ca13aabf5796af205aecb44a13079ae530d7"
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
        "Harvested/verified timestamp recorded: 2026-11-20T06:37:28.825Z"
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
  "auth_token": "35e1c19b5e1e1476908143fc482ecc56063e210126b02791fe569ed6f432af13"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

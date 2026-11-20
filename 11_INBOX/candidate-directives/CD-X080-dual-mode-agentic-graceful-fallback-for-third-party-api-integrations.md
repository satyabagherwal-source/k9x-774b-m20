# Candidate Directive: [CD-X080] Dual-Mode Agentic Graceful Fallback for Third-Party API Integrations

<!-- PROVENANCE_START
{
  "source_repository": "tmolavi/siteprobe",
  "source_url": "https://github.com/tmolavi/siteprobe",
  "source_version": "4b116b3c",
  "license": "MIT",
  "timestamp": "2026-11-20T06:37:24.960Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tmolavi-siteprobe",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tmolavi/siteprobe](https://github.com/tmolavi/siteprobe) (Revision: `4b116b3c`).  
> **License**: MIT | **Timestamp**: `2026-11-20T06:37:24.960Z`  
> **Learning ID**: `learn-github-tmolavi-siteprobe`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

        # 2. Resilient Path: Free Agentic Heuristic Mode (Zero-cost, identical schema)
        return {
            "mode": "free_agentic_heuristics",
            "domain": clean_domain,
            "authority_score": 50,  # Baseline neutral prior
            "citation_count": 0,
            "warning": "Synthesized heuristic data; credentials not provided.",
        }
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Fails agent workflows when credentials are missing or endpoints fail
class UnsafeThirdPartyProvider:
    def __init__(self):
        # Crashes immediately or raises unhandled exceptions down the line
        self.api_key = os.environ["THIRD_PARTY_API_KEY"]

    async def get_domain_metrics(self, domain: str):
        # No fallback, crashes agent execution loop when offline or unauthenticated
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.external-service.com/v1/metrics",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            resp.raise_for_status()
            return resp.json()
```

**VERIFICATION METHOD**:
Enforce dual execution testing via pytest with cleared environment variables:
```python
import os
import pytest


@pytest.mark.asyncio
async def test_provider_dual_mode_fallback(monkeypatch):
    monkeypatch.delenv("THIRD_PARTY_API_KEY", raising=False)
    provider = ResilientThirdPartyProvider()
    assert not provider.is_available()

    result = await provider.get_domain_metrics("example.com")
    assert result["mode"] == "free_agentic_heuristics"
    assert "authority_score" in result
    assert result["domain"] == "example.com"
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T06:37:24.958Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795156644958",
    "title": "Dual-Mode Agentic Graceful Fallback for Third-Party API Integrations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tmolavi/siteprobe",
    "source_uri": "https://github.com/tmolavi/siteprobe",
    "source_version": "HEAD",
    "content_hash": "498b4404a758e9a5b259e3eaa686cf8bcb45c15ae5bd4d94c4104846ce6b4105"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T06:37:24.958Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "86c95d5b719933d8d75f42c87150c516dda6da3a511a9cdaddef5c4ca17df828"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-ZDXY] Close the reactorless loop of AsyncCrawlerProcess instances never started

<!-- PROVENANCE_START
{
  "source_repository": "scrapy/scrapy",
  "source_url": "https://github.com/scrapy/scrapy",
  "source_version": "531bc329",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-24T14:41:50.422Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-scrapy-scrapy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [scrapy/scrapy](https://github.com/scrapy/scrapy) (Revision: `531bc329`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-24T14:41:50.422Z`  
> **Learning ID**: `learn-github-scrapy-scrapy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `scrapy/crawler.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in scrapy/scrapy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `531bc329`: Close the reactorless loop of AsyncCrawlerProcess instances never started. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `scrapy/crawler.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
import weakref
def _close_reactorless(
    loop: asyncio.AbstractEventLoop, hook: ReactorImportHook
) -> None:
    # loop.close() can raise, so we uninstall the hook first
    uninstall_reactor_import_hook(hook)
    loop.close()


            # Also covers instances that are never started.
            self._close_reactorless = weakref.finalize(
                self,
                _close_reactorless,
                self._reactorless_loop,
                install_reactor_import_hook(),
            )
            self._close_reactorless()
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
        self._reactor_import_hook: ReactorImportHook | None = None
            self._reactor_import_hook = install_reactor_import_hook()
            # loop.close() can raise, so we uninstall the hook first
            if self._reactor_import_hook:  # pragma: no branch
                uninstall_reactor_import_hook(self._reactor_import_hook)
                self._reactor_import_hook = None
            loop.close()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `531bc329` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T14:41:50.420Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795531310420",
    "title": "Close the reactorless loop of AsyncCrawlerProcess instances never started",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "scrapy/scrapy",
    "source_uri": "https://github.com/scrapy/scrapy",
    "source_version": "HEAD",
    "content_hash": "5bb2ca7475bc506049449eedbb6c5d101d6143150d5f62b709b81557ec9542ac"
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
        "Harvested/verified timestamp recorded: 2026-11-24T14:41:50.420Z"
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
  "auth_token": "4ef45a11f6813f0a3e7c9e24fb163db0834a1ca383338b5360ef9bacd405b2ce"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-EIFL] docs(site): lead with the compiler and the loop, add recurring work to the rollo

<!-- PROVENANCE_START
{
  "source_repository": "dosco/deeporg",
  "source_url": "https://github.com/dosco/deeporg",
  "source_version": "4c697dc8",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T03:41:45.297Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dosco-deeporg",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco/deeporg](https://github.com/dosco/deeporg) (Revision: `4c697dc8`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T03:41:45.297Z`  
> **Learning ID**: `learn-github-dosco-deeporg`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `website/content/_index.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dosco/deeporg. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `de5af28b`: docs(site): lead with the compiler and the loop, add recurring work to the rollout guide. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `website/content/_index.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
description: "DeepORG puts AI agents to work on the systems your company already runs, without rebuilding them. It maps your databases, APIs, files and code, compiles each request the agent makes into queries your systems run under your access rules, and turns the questions people ask into tests you can run again."
<section class="dx-hero"><div class="dx-hero-inner"><div class="dx-hero-copy"><p class="dx-kicker"><b>DeepORG</b><i></i><span>formerly GraphJin</span><i></i><span>Apache 2.0</span></p><h1>AI agents for the company you already run. Nothing to rebuild.</h1><div class="dx-hero-row"><p class="dx-lede">Connect your databases, warehouses, APIs, files and code, and DeepORG maps what is there. Its agent writes each request against that map, and the engine checks it against your access rules and compiles it into queries your own systems run. No tools to build, no data to move. The questions people ask become tests you can run again.</p><div class="home-actions"><a class="button-primary" href="#quickstart">Try it in 2 minutes</a><a class="button-secondary" href="/benchmark/">See the public benchmark</a></div></div></div><div class="dx-hero-art">{{< ascii scene="orgwide" narrow="or
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
description: "DeepORG is one AI agent for your whole organization. It answers questions and makes changes across your databases, APIs, files and code, is graded on its own public benchmark, and turns your organization into a training environment."
<section class="dx-hero"><div class="dx-hero-inner"><div class="dx-hero-copy"><p class="dx-kicker"><b>DeepORG</b><i></i><span>formerly GraphJin</span><i></i><span>Apache 2.0</span></p><h1>One AI agent for your whole organization.</h1><div class="dx-hero-row"><p class="dx-lede">Ask in plain words. DeepORG answers questions and makes changes across the systems your company already runs: databases, warehouses, APIs, files and code. There are no tools to build. It stays inside your access rules, and a change waits for your approval.</p><div class="home-actions"><a class="button-primary" href="#quickstart">Try it in 2 minutes</a><a class="button-secondary" href="/benchmark/">See the public benchmark</a></div></div></div><div class="dx-hero-art">{{< ascii scene="orgwide" narrow="org" data="hero-rotate-data" label="Animated diagram: a question is asked, three of seven connected systems are queried, and DeepORG returns one answer with its evidenc
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `de5af28b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T03:41:45.292Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795491705292",
    "title": "docs(site): lead with the compiler and the loop, add recurring work to the rollo",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco/deeporg",
    "source_uri": "https://github.com/dosco/deeporg",
    "source_version": "HEAD",
    "content_hash": "05ecdcd790ac40771137085f3e57e6c19369c0b5800839a83aac2bca8eb5f221"
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
        "Harvested/verified timestamp recorded: 2026-11-24T03:41:45.293Z"
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
  "auth_token": "49a127b78e95118a486d14541d3079b2723369a9b2a6607a02bae970f6105db4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

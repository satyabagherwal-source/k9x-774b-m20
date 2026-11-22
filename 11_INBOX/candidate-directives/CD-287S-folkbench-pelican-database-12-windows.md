# Candidate Directive: [CD-287S] 新增 Folkbench Pelican Database 开源发布博客（12 语种）并修复 Windows 路径校验兼容

<!-- PROVENANCE_START
{
  "source_repository": "Folkbench/folkbench",
  "source_url": "https://github.com/Folkbench/folkbench",
  "source_version": "f0856c35",
  "license": "NOASSERTION",
  "timestamp": "2026-11-22T18:52:39.064Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-folkbench-folkbench",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Folkbench/folkbench](https://github.com/Folkbench/folkbench) (Revision: `f0856c35`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-22T18:52:39.064Z`  
> **Learning ID**: `learn-github-folkbench-folkbench`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `scripts/distribution/subsite-core.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Folkbench/folkbench. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f0856c35`: 新增 Folkbench Pelican Database 开源发布博客（12 语种）并修复 Windows 路径校验兼容. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/distribution/subsite-core.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  const rootPosix=resolve(root).replaceAll('\\','/')
  for(const path of htmlFiles){const body=await readFile(path,'utf8');if(forbidden.some(word=>body.includes(word)))throw new Error('subsite_wording_rejected');if(path.replaceAll('\\','/').endsWith('/404.html'))continue
      if(href.startsWith('/')){const url=new URL(href,origin);if(url.origin!==origin)throw new Error('subsite_external_relative_link');const target=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!target.replaceAll('\\','/').startsWith(rootPosix+'/'))throw new Error('subsite_link_escape');await readFile(target)}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
  for(const path of htmlFiles){const body=await readFile(path,'utf8');if(forbidden.some(word=>body.includes(word)))throw new Error('subsite_wording_rejected');if(path.endsWith('/404.html'))continue
      if(href.startsWith('/')){const url=new URL(href,origin);if(url.origin!==origin)throw new Error('subsite_external_relative_link');const target=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!target.startsWith(resolve(root)+'/'))throw new Error('subsite_link_escape');await readFile(target)}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f0856c35` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T18:52:39.062Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795373559062",
    "title": "新增 Folkbench Pelican Database 开源发布博客（12 语种）并修复 Windows 路径校验兼容",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Folkbench/folkbench",
    "source_uri": "https://github.com/Folkbench/folkbench",
    "source_version": "HEAD",
    "content_hash": "f664c256eb07820450340e52c8c6146c55475e57b1037b604cff6e26073a4ce6"
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
        "Harvested/verified timestamp recorded: 2026-11-22T18:52:39.062Z"
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
  "auth_token": "6966bbdf9fa9803bf2fa0a8bdfb109c105de68ff7ebdd152f1974c962aea14dc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

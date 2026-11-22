# Candidate Directive: [CD-2LHJ] 新增 Folkbench Pelican Database 开源发布博客（12 语种）并修复 Windows 路径校验兼容

<!-- PROVENANCE_START
{
  "source_repository": "folkbench-folkbench-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T18:52:56.139Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-folkbench-folkbench-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [folkbench-folkbench-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T18:52:56.139Z`  
> **Learning ID**: `LEARN-EVO-folkbench-folkbench-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-22T18:52:56.259Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795373576259",
    "title": "新增 Folkbench Pelican Database 开源发布博客（12 语种）并修复 Windows 路径校验兼容",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "folkbench-folkbench-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f664c256eb07820450340e52c8c6146c55475e57b1037b604cff6e26073a4ce6"
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
        "Harvested/verified timestamp recorded: 2026-11-22T18:52:56.259Z"
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
  "auth_token": "b0cfc69f7c283a356c65292de184ee8e9ed95ead2e64fedef3ec97a67daab82d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-KJ7N] Empirical Invariant Guard in ComfyUIGen.js

<!-- PROVENANCE_START
{
  "source_repository": "lioensky/VCPToolBox",
  "source_url": "https://github.com/lioensky/VCPToolBox",
  "source_version": "7131e7e4",
  "license": "NOASSERTION",
  "timestamp": "2026-11-22T04:39:05.027Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lioensky-vcptoolbox",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox) (Revision: `7131e7e4`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-22T04:39:05.027Z`  
> **Learning ID**: `learn-github-lioensky-vcptoolbox`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Plugin/ComfyUIGen/ComfyUIGen.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `82c0efd4`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `Plugin/ComfyUIGen/ComfyUIGen.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
        COMFYUI_MAX_WAIT_MINUTES: 30,
        COMFYUI_MISSING_QUEUE_TOLERANCE: 5,
            if (userSettings.maxWaitMinutes !== undefined) {
                config.COMFYUI_MAX_WAIT_MINUTES = resolveNumericArg(userSettings.maxWaitMinutes, config.COMFYUI_MAX_WAIT_MINUTES);
            }
    if (process.env.COMFYUI_MAX_WAIT_MINUTES !== undefined && process.env.COMFYUI_MAX_WAIT_MINUTES !== '') {
        config.COMFYUI_MAX_WAIT_MINUTES = resolveNumericArg(process.env.COMFYUI_MAX_WAIT_MINUTES, config.COMFYUI_MAX_WAIT_MINUTES);
    }
    if (process.env.COMFYUI_MISSING_QUEUE_TOLERANCE !== undefined && process.env.COMFYUI_MISSING_QUEUE_TOLERANCE !== '') {
        config.COMFYUI_MISSING_QUEUE_TOLERANCE = Math.max(1, Math.floor(resolveNumericArg(process.env.COMFYUI_MISSING_QUEUE_TOLERANCE, 5)));
    }
    
// 检查历史完成状态
        headers: config.COMFYUI_API_KEY ? { 'Authorization': `Bearer ${config.COMFYUI_API_KEY}` } : {},
    return (response.data && response.data[promptId]) ? response.data[promptId] : null;
// 检查 ComfyUI 实时运行队列 (/queue)，判断 promptId 是否仍在 running 或 pending 中推进
async function checkActiveQueue(promptId, config) {
    const comfyuiAxios = axios.create({
        baseURL: config.C
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:

// 检查队列状态
    return response.data[promptId] || null;
// 等待生成完成
async function waitForCompletion(promptId, config, maxAttempts = 60, interval = 3000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        debugLog(`Checking queue status, attempt ${attempt + 1}/${maxAttempts}`);
        
        const history = await checkQueueStatus(promptId, config);
        if (history && history.status && history.status.completed) {
            debugLog('Generation completed!');
            return history;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `82c0efd4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T04:39:05.024Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795322345024",
    "title": "Empirical Invariant Guard in ComfyUIGen.js",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lioensky/VCPToolBox",
    "source_uri": "https://github.com/lioensky/VCPToolBox",
    "source_version": "HEAD",
    "content_hash": "5bfa90bebf41bf7cff8a7d53ade9fd62c9a48d10ed81f562dfeeb46e1c365423"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-22T04:39:05.024Z"
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
  "auth_token": "426f18a0159205d699c5a98d837bfe1d18c65e7004d8579f74fd7c0771cb9078"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

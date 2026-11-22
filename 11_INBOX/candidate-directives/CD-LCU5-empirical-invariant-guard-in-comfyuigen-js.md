# Candidate Directive: [CD-LCU5] Empirical Invariant Guard in ComfyUIGen.js

<!-- PROVENANCE_START
{
  "source_repository": "lioensky-vcptoolbox-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T04:39:43.284Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lioensky-vcptoolbox-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky-vcptoolbox-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T04:39:43.284Z`  
> **Learning ID**: `LEARN-EVO-lioensky-vcptoolbox-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T04:39:43.416Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795322383416",
    "title": "Empirical Invariant Guard in ComfyUIGen.js",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lioensky-vcptoolbox-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d66e41ca537bd89fd49b61b335b048c7696cd5c8243b739c72b7af04d9b01009"
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
        "Harvested/verified timestamp recorded: 2026-11-22T04:39:43.417Z"
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
  "auth_token": "336c72efa0a260003b4dd4d03274c7f44748b78e8cd12618c3d4ce8234b6cfad"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

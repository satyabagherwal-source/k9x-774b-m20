# Candidate Directive: [CD-Y4QF] Empirical Invariant Guard in workspace-chat-list.js

<!-- PROVENANCE_START
{
  "source_repository": "mdiri-ai-soduwork-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T06:47:16.490Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mdiri-ai-soduwork-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mdiri-ai-soduwork-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T06:47:16.490Z`  
> **Learning ID**: `LEARN-EVO-mdiri-ai-soduwork-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `client/components/workspace/workspace-chat-list.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mdiri-ai/SoduWork. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9dec9f44`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `client/components/workspace/workspace-chat-list.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
  const cloudCacheKeys = new Map();
  function cloudDisplaySource(id) {
    for (const row of localRows) {
      const source = row.displayCloudSourceId;
      if (!source || !localVisible(row)) continue;
      if (row.id === id || source === id || ctx.chatItems.some(item => item.id === id &&
          item.cloud && !hiddenRow(item) && item.historyAliasIds?.includes(source))) return source;
    }
    return '';
  }
  function selectedCloudCache(id, active = ctx.activeChatId) {
    const source = cloudDisplaySource(id);
    return Boolean(source && source === cloudDisplaySource(active));
  }
    cloudCacheKeys.clear();
        const project = ctx.sidebarProjects?.projectForChat(b.dataset.sidebarChatId || id);
      const id = b.dataset.sidebarChatId || b.dataset.chatId || '';
      const id = b.dataset.sidebarChatId || b.dataset.chatId || '';
    const status = copy.offlineCloudCache ? historyText('workspace.history.cloudCache', '本地缓存（只读）')
      : ctx.wsT('chat.state.' + copy.state, ctx.CHAT_STATE[copy.state]);
    const selected = ctx.active === 'create' && (selectedChat(id) || selectedCloudCache(id));
    b.dataset.sidebarChatId = c.displaySlotId || id;
    b._localeChat = { titl
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
        const project = ctx.sidebarProjects?.projectForChat(id);
      const id = b.dataset.chatId || '';
      const id = b.dataset.chatId || '';
    const status = ctx.wsT('chat.state.' + copy.state, ctx.CHAT_STATE[copy.state]);
    const selected = ctx.active === 'create' && selectedChat(id);
    b._localeChat = { title: c.title, state, harnesses: runtimeName };
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:47:16.595Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794898036594",
    "title": "Empirical Invariant Guard in workspace-chat-list.js",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mdiri-ai-soduwork-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "733a8640fd00859711f412339fa5b64af8765034848de60459b84c5c41fbaa67"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:47:16.595Z"
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
  "auth_token": "e03cd9e167506b71e08fccfa0d47c8ae91b271083781939b12b16b880ceec45d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

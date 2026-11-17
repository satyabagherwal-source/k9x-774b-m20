# Candidate Directive: [CD-XSMX] Empirical Invariant Guard in workspace-chat-list.js

<!-- PROVENANCE_START
{
  "source_repository": "mdiri-ai/SoduWork",
  "source_url": "https://github.com/mdiri-ai/SoduWork",
  "source_version": "c3487b97",
  "license": "MIT",
  "timestamp": "2026-11-17T06:47:00.921Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mdiri-ai-soduwork",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mdiri-ai/SoduWork](https://github.com/mdiri-ai/SoduWork) (Revision: `c3487b97`).  
> **License**: MIT | **Timestamp**: `2026-11-17T06:47:00.921Z`  
> **Learning ID**: `learn-github-mdiri-ai-soduwork`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9dec9f44` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:47:00.918Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794898020918",
    "title": "Empirical Invariant Guard in workspace-chat-list.js",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mdiri-ai/SoduWork",
    "source_uri": "https://github.com/mdiri-ai/SoduWork",
    "source_version": "HEAD",
    "content_hash": "b253c0845119071ac2ac758dd3d105e2c64486eeb8602d1b77afa2d010e26453"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:47:00.918Z"
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
  "auth_token": "8b6dc455771a174bfbe62f607e3386ec7ef50f0e42b43036004d617f5cb1b8e9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

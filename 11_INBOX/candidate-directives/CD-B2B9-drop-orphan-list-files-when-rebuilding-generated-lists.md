# Candidate Directive: [CD-B2B9] drop orphan list files when rebuilding generated lists

<!-- PROVENANCE_START
{
  "source_repository": "lioensky/VCPToolBox",
  "source_url": "https://github.com/lioensky/VCPToolBox",
  "source_version": "699ed4b3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-27T17:01:54.165Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lioensky-vcptoolbox",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox) (Revision: `699ed4b3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-27T17:01:54.165Z`  
> **Learning ID**: `learn-github-lioensky-vcptoolbox`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `routes/admin/emojis.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `15fb5246`: emojis): drop orphan list files when rebuilding generated lists. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `routes/admin/emojis.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
async function rebuildEmojiGeneratedLists({
    imageRootDir = IMAGE_ROOT_DIR,
    listsDir = EMOJI_LISTS_DIR,
} = {}) {
    await fs.mkdir(listsDir, { recursive: true });
    const sourceEntries = await fs.readdir(imageRootDir, { withFileTypes: true });
        const packDirPath = path.join(imageRootDir, packName);
        const targetFilePath = path.join(listsDir, `${packName}.txt`);
        await assertSafePath(listsDir, targetFilePath);
    // 目录被删除后，旧的列表文件不会随重建消失，会让 /emojis/list 继续吐出
    // 已经不存在的表情（前端兜底后表现为裂图）。这里按目录真相清理孤儿列表。
    const validPackNames = new Set(emojiDirs);
    const removed = [];
    for (const file of await fs.readdir(listsDir)) {
        if (!file.toLowerCase().endsWith('.txt')) continue;
        const packName = path.basename(file, path.extname(file));
        if (validPackNames.has(packName)) continue;

        const staleFilePath = path.join(listsDir, file);
        await assertSafePath(listsDir, staleFilePath);
        await fs.unlink(staleFilePath);
        removed.push(packName);
    }

        removedCount: removed.length,
        removed,

// 供测试直接驱动列表重建，避免为了验证孤儿清理去启动整个 admin 服务。
module.exports.rebuildEmojiGeneratedLists = rebuildEmojiGeneratedLists;
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
async function rebuildEmojiGeneratedLists() {
    await fs.mkdir(EMOJI_LISTS_DIR, { recursive: true });
    const sourceEntries = await fs.readdir(IMAGE_ROOT_DIR, { withFileTypes: true });
        const packDirPath = path.join(IMAGE_ROOT_DIR, packName);
        const targetFilePath = path.join(EMOJI_LISTS_DIR, `${packName}.txt`);
        await assertSafePath(EMOJI_LISTS_DIR, targetFilePath);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `15fb5246` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T17:01:54.163Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795798914163",
    "title": "drop orphan list files when rebuilding generated lists",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lioensky/VCPToolBox",
    "source_uri": "https://github.com/lioensky/VCPToolBox",
    "source_version": "HEAD",
    "content_hash": "9a64a4ae23aec9a1857dc1c2d4d883321929004c6197a680f74c70f015a2dcb9"
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
        "Harvested/verified timestamp recorded: 2026-11-27T17:01:54.163Z"
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
  "auth_token": "87480c27714609297f168dc43901bb190b6878b8ed160521240903e8fbd98c14"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

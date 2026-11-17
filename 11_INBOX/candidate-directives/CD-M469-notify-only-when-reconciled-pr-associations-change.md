# Candidate Directive: [CD-M469] notify only when reconciled PR associations change

<!-- PROVENANCE_START
{
  "source_repository": "makecindy/cindy",
  "source_url": "https://github.com/makecindy/cindy",
  "source_version": "50dbd865",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T06:09:56.385Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-makecindy-cindy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [makecindy/cindy](https://github.com/makecindy/cindy) (Revision: `50dbd865`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T06:09:56.385Z`  
> **Learning ID**: `learn-github-makecindy-cindy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/desktop/src/main/git-context/prRefsStore.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `677fdc84`: github): notify only when reconciled PR associations change. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/git-context/prRefsStore.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    const readRefs = () => db.select(prRefColumns()).from(sessionPrRefs)
      .where(eq(sessionPrRefs.sessionId, sessionId)).orderBy(asc(sessionPrRefs.id));
    const before = await readRefs();
    if (prune) {
      const staleIds = before
        .filter((r) => !r.manuallyAdded && r.removedAt === null && !keep.has(prStatusKey(r)))
        .map((r) => r.id);
      if (staleIds.length > 0) {
        await db.delete(sessionPrRefs).where(inArray(sessionPrRefs.id, staleIds));
      }
    // Compare final records under the write queue: repeated mentions can change
    // timestamps transiently during recomputation without changing the result.
    // Include ordering/provenance fields so meaningful updates still refresh.
    const after = await readRefs();
    if ((!scope || scope.isCurrent()) && JSON.stringify(before) !== JSON.stringify(after)) {
      onRefsChanged?.(sessionId);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    if (!prune) {
      if (!scope || scope.isCurrent()) onRefsChanged?.(sessionId);
      return;
    const existing = await db
      .select({
        id: sessionPrRefs.id,
        provider: sessionPrRefs.provider,
        host: sessionPrRefs.host,
        owner: sessionPrRefs.owner,
        repo: sessionPrRefs.repo,
        prNumber: sessionPrRefs.prNumber,
        manuallyAdded: sessionPrRefs.manuallyAdded,
        removedAt: sessionPrRefs.removedAt,
      })
      .from(sessionPrRefs)
      .where(eq(sessionPrRefs.sessionId, sessionId));
    const staleIds = existing
      .filter((r) => !r.manuallyAdded && r.removedAt === null && !keep.has(prStatusKey(r)))
      .map((r) => r.id);
    if (staleIds.length > 0) {
      await db.delete(sessionPrRefs).where(inArray(sessionPrRefs.id, staleIds));
    if (!scope || scope.isCurrent()) onRefsChanged?.(sessionId);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `677fdc84` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:09:56.383Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794895796383",
    "title": "notify only when reconciled PR associations change",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "makecindy/cindy",
    "source_uri": "https://github.com/makecindy/cindy",
    "source_version": "HEAD",
    "content_hash": "5e77a6b5d23956e5d61c56dcd6a8fcfa1341766d30c9dc1b4718f23176afa881"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:09:56.383Z"
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
  "auth_token": "79a7448c25e751491627c2357c9feead788653a4b4df956e51cedc3a366749aa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

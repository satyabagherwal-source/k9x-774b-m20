# Candidate Directive: [CD-NR3M] misleading Model Router delete confirmation and surface workspac...

<!-- PROVENANCE_START
{
  "source_repository": "Mintplex-Labs/anything-llm",
  "source_url": "https://github.com/Mintplex-Labs/anything-llm",
  "source_version": "64b599fc",
  "license": "MIT",
  "timestamp": "2026-11-18T09:14:50.482Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mintplex-labs-anything-llm",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm) (Revision: `64b599fc`).  
> **License**: MIT | **Timestamp**: `2026-11-18T09:14:50.482Z`  
> **Learning ID**: `learn-github-mintplex-labs-anything-llm`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `server/__tests__/models/modelRouter.test.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Mintplex-Labs/anything-llm. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `64b599fc`: misleading Model Router delete confirmation and surface workspac.... Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/__tests__/models/modelRouter.test.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
  $transaction: jest.fn(async (ops) => Promise.all(ops)),
  model_routers: {
    create: jest.fn(async ({ data }) => ({ id: 1, ...data })),
    delete: jest.fn(async ({ where }) => ({ id: where.id })),
  },
  workspaces: {
    updateMany: jest.fn(async () => ({ count: 1 })),
  },

/**
 * Deleting a router also resets every workspace pointing at it back to the
 * system LLM, in the same transaction, so no workspace keeps a router_id
 * that no longer exists. Rollback on failure is Prisma's guarantee and is
 * not something these mocks can observe.
 */
describe("ModelRouter.delete", () => {
  const ROUTER_ID = 5;

  beforeEach(() => {
    prisma.$transaction.mockClear();
    prisma.model_routers.delete.mockClear();
    prisma.workspaces.updateMany.mockClear();
  });

  it("resets referencing workspaces to the system LLM and deletes the router in one transaction", async () => {
    const success = await ModelRouter.delete(ROUTER_ID);

    expect(success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    expect(prisma.workspaces.updateMany).toHaveBeenCalledWith({
      where: { router_id: ROUTER_I
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
  model_routers: { create: jest.fn(async ({ data }) => ({ id: 1, ...data })) },
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `64b599fc` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T09:14:50.480Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794993290480",
    "title": "misleading Model Router delete confirmation and surface workspac...",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Mintplex-Labs/anything-llm",
    "source_uri": "https://github.com/Mintplex-Labs/anything-llm",
    "source_version": "HEAD",
    "content_hash": "a30c3113cfc2ef1d76b1f06c5bc58ee786c0decf2ab3caec453e37fe3c19be65"
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
        "Harvested/verified timestamp recorded: 2026-11-18T09:14:50.480Z"
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
  "auth_token": "b720aa03acc2538884c8c32d95ac456c59066459b36bfa09af777f2b5a986043"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

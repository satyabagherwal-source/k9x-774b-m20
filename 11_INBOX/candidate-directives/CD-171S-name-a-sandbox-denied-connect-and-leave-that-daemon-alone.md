# Candidate Directive: [CD-171S] name a sandbox-denied connect and leave that daemon alone

<!-- PROVENANCE_START
{
  "source_repository": "callstack/agent-device",
  "source_url": "https://github.com/callstack/agent-device",
  "source_version": "3e0814c5",
  "license": "MIT",
  "timestamp": "2026-11-27T04:18:24.112Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-callstack-agent-device",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack/agent-device](https://github.com/callstack/agent-device) (Revision: `3e0814c5`).  
> **License**: MIT | **Timestamp**: `2026-11-27T04:18:24.112Z`  
> **Learning ID**: `learn-github-callstack-agent-device`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/daemon-client/src/__tests__/daemon-client-ensure-drain.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2d29b6d6`: daemon-client): name a sandbox-denied connect and leave that daemon alone. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/daemon-client/src/__tests__/daemon-client-ensure-drain.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
// The escalation route: a daemon still running at the drain deadline that answers no probe gets force
// retired. A connect the HOST refused is not a missed probe, so this route names the sandbox instead.
test('a drain that outlives the deadline with a probe the host refused signals nothing', async (t) => {
  if (!(await withLoopback(t))) return;
  const { stateDir, paths } = stateDirAndPaths();
  let childPid = 0;
  const drain = installVirtualDrain(() => childPid);
  const stale = await startScriptedDaemon(draining, {
    afterRpc: () => {
      drain.begin(undefined);
      void closeLoopbackServer(stale.server);
    },
  });
  const { child } = await registerDaemon(paths, {
    httpPort: stale.port,
    version: '0.0.0-stale',
    capabilities: ['quiesce'],
  });
  childPid = child.pid;
  const liveness = await import('../daemon-client-liveness-probe.ts');
  vi.spyOn(liveness, 'answersLivenessProbe').mockResolvedValue({
    reachable: false,
    denial: { errno: 'EPERM', transport: 'socket', port: stale.port },
  });

  try {
    await assert.rejects(ensureDaemon({ stateDir, daemonTransport: 'http' }), (error: unknown) => {
      assert.ok(error instanceof AppError);
      ass
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2d29b6d6` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T04:18:24.110Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795753104110",
    "title": "name a sandbox-denied connect and leave that daemon alone",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "callstack/agent-device",
    "source_uri": "https://github.com/callstack/agent-device",
    "source_version": "HEAD",
    "content_hash": "adcab3ee8b296ed9e25ccda0aabc03f641e315206de3fe978c0198c2afd23b8c"
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
        "Harvested/verified timestamp recorded: 2026-11-27T04:18:24.110Z"
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
  "auth_token": "522edc32eab8e7f2470a71c7c6e8f3de2fc39111c9531d0e03d2fb8842083ee1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

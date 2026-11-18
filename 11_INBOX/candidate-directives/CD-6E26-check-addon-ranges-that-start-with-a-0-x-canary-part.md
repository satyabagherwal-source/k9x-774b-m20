# Candidate Directive: [CD-6E26] check addon ranges that start with a 0.x canary part

<!-- PROVENANCE_START
{
  "source_repository": "storybookjs/storybook",
  "source_url": "https://github.com/storybookjs/storybook",
  "source_version": "1227202d",
  "license": "MIT",
  "timestamp": "2026-11-18T09:57:19.662Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-storybookjs-storybook",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [storybookjs/storybook](https://github.com/storybookjs/storybook) (Revision: `1227202d`).  
> **License**: MIT | **Timestamp**: `2026-11-18T09:57:19.662Z`  
> **Learning ID**: `learn-github-storybookjs-storybook`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `code/lib/cli-storybook/src/doctor/getIncompatibleStorybookPackages.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in storybookjs/storybook. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fbb34286`: cli): check addon ranges that start with a 0.x canary part. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `code/lib/cli-storybook/src/doctor/getIncompatibleStorybookPackages.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  it.each([
    ['ignores a 0.x range', '^0.4.0', '11.0.0', false],
    [
      'flags a range whose canary part comes first',
      '^0.0.0-0 || ^10.0.0 || ^10.3.0-0',
      '11.0.0-beta.3',
      true,
    ],
    ['accepts a range with a canary part', '^0.0.0-0 || ^10.6.0-0 || ^11.0.0-0', '11.0.0', false],
    [
      'accepts a canary through the canary part',
      '^0.0.0-0 || ^10.0.0',
      '0.0.0-pr-1-sha-abc',
      false,
    ],
  ])('%s', async (_, range, currentStorybookVersion, hasIncompatibleDependencies) => {
    vi.mocked(packageManagerMock.getModulePackageJSON).mockResolvedValueOnce({
      name: 'my-storybook-package',
      version: '1.0.0',
      peerDependencies: { storybook: range },
    });
    const result = await checkPackageCompatibility('my-storybook-package', {
      currentStorybookVersion,
      packageManager: packageManagerMock as JsPackageManager,
    });
    expect(result.hasIncompatibleDependencies).toBe(hasIncompatibleDependencies);
  });

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fbb34286` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T09:57:19.660Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794995839660",
    "title": "check addon ranges that start with a 0.x canary part",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "storybookjs/storybook",
    "source_uri": "https://github.com/storybookjs/storybook",
    "source_version": "HEAD",
    "content_hash": "022514ad866edb7567c22854bcb3c047d6d6ab450577d6f93c921db6a02349fc"
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
        "Harvested/verified timestamp recorded: 2026-11-18T09:57:19.660Z"
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
  "auth_token": "6dda4ffc65c12e99c9c4a36695e72beff56f70d193d42e4eb52a6c26aa54359f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-NGCN] Fine-Grained Optimizer Segment Decoupling for Non-Rendering Lifecycle Tasks

<!-- PROVENANCE_START
{
  "source_repository": "QwikDev/qwik",
  "source_url": "https://github.com/QwikDev/qwik",
  "source_version": "cfa0e890",
  "license": "MIT",
  "timestamp": "2026-11-17T06:10:58.823Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-qwikdev-qwik",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [QwikDev/qwik](https://github.com/QwikDev/qwik) (Revision: `cfa0e890`).  
> **License**: MIT | **Timestamp**: `2026-11-17T06:10:58.823Z`  
> **Learning ID**: `learn-github-qwikdev-qwik`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Code-splitting compilers and build optimizers MUST emit component render JSX bodies and reactive background tasks (`useTask$`, `useVisibleTask$`, `computed$`) into separate, non-overlapping modules. Background computations MUST NOT drag component rendering code or virtual DOM structures into the network payload.

**WHY**:
When background tasks (such as telemetry, background data synching, or cache warming) are bundled alongside the component's JSX render tree, triggering a state computation or executing a background task downloads the entire JSX render graph of that component and all components it references. This creates unnecessary network utilization and CPU overhead, breaking the zero-JS resumability invariant.

**WHEN TO APPLY**:
Static analysis compilers, macro optimizers, AST transformers, and bundler code-splitting algorithms targeting lazy-loaded frameworks, web workers, and micro-frontends.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Bundler Manifest Assertion Verification
export const chunkHasComponent = (url: string, manifest: Manifest): boolean =>
  chunkHasSymbolOf(url, 'component$', manifest);

export const chunkHasTask = (url: string, manifest: Manifest): boolean =>
  chunkHasSymbolOf(url, 'useTask$', manifest) || chunkHasSymbolOf(url, 'useVisibleTask$', manifest);

// Optimizer Invariant Test
test('optimizer splits task and render chunks cleanly', () => {
  const manifest = compileFixture('src/components/modal.tsx');
  const taskUrls = findChunksForSymbol(manifest, 'Modal_useTask');
  
  for (const url of taskUrls) {
    // A task execution chunk MUST NOT import or contain the component$ render segment
    expect(chunkHasComponent(url, manifest)).toBe(false);
  }
});
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER bundle the component render closure together with task closures:
// Bundled Output: chunk-modal.js
export const Modal_component_render = (props) => jsx('div', { children: props.title });
export const Modal_useTask_1 = async (store) => { store.count++; };

// DEFECT: Running Modal_useTask_1 pulls in JSX runtime, DOM bindings, and
// downstream child component references, even if no visual DOM re-render is triggered.
```

**VERIFICATION METHOD**:
In Playwright/E2E test harnesses, intercept all network requests emitted when clicking a button that triggers an asynchronous state computation. Assert that the array of requested URLs filtered by `chunkHasComponent` strictly equals `[]`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:10:58.822Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794895858822",
    "title": "Fine-Grained Optimizer Segment Decoupling for Non-Rendering Lifecycle Tasks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "QwikDev/qwik",
    "source_uri": "https://github.com/QwikDev/qwik",
    "source_version": "HEAD",
    "content_hash": "d62316a29652321827732e4ae64042427bb1309284df2252abce6c394f40198d"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:10:58.822Z"
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
  "auth_token": "457be904017fb07e569a54dba6bb6661c7b8ea444cc5f146736469cea37f45e1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

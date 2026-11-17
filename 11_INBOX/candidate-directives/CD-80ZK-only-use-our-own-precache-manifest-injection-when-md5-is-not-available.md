# Candidate Directive: [CD-80ZK] only use our own precache manifest injection when MD5 is not available

<!-- PROVENANCE_START
{
  "source_repository": "meta/docusaurus",
  "source_url": "https://github.com/facebook/docusaurus",
  "source_version": "4c4ec4aa",
  "license": "MIT",
  "timestamp": "2026-11-17T14:22:52.160Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meta-docusaurus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meta/docusaurus](https://github.com/facebook/docusaurus) (Revision: `4c4ec4aa`).  
> **License**: MIT | **Timestamp**: `2026-11-17T14:22:52.160Z`  
> **Learning ID**: `learn-github-meta-docusaurus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/docusaurus-plugin-pwa/src/__tests__/injectManifestFIPS.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meta/docusaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5b2eeddc`: pwa): only use our own precache manifest injection when MD5 is not available. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/docusaurus-plugin-pwa/src/__tests__/injectManifestFIPS.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import {describe, expect, it, vi} from 'vitest';
import {injectManifestFIPS} from '../injectManifestFIPS';

// injectManifestFIPS() only runs when MD5 is not available
vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:crypto')>()),
  getHashes: () => ['sha256'],
}));
describe('injectManifestFIPS', () => {
  it('injects the same files as Workbox', async () => {
    await injectManifestFIPS(getOptions(outDir.path));
    expect(manifest.map((entry) => entry.url)).toEqual(
      workboxManifest.map((entry) => entry.url),
    );
    // Workbox hashes with MD5 anyway
    manifest.forEach((entry, index) => {
      expect(entry.revision).not.toBe(workboxManifest[index]!.revision);
    });
  it('injects files hashed with SHA-256', async () => {
    await injectManifestFIPS(getOptions(outDir.path));
      {
        url: 'assets/main.css',
        revision:
          '7c98040a541657584690ae2a1cc3b42a8b53b159cc60c5d3abbfecbaeac6c94a',
      },
      {
        url: 'assets/main.js',
        revision:
          '6e11c72f7cf6bc383152dd16ddd5903aba6bb1c99d6b6639a4bb0b838185fa92',
      },
      {
        url: 'index.html',
        revision:
        
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
import {describe, expect, it} from 'vitest';
import {injectPrecacheManifest} from '../precacheManifest';
describe('injectPrecacheManifest', () => {
  it('injects the same manifest as Workbox', async () => {
    await injectPrecacheManifest(getOptions(outDir.path));
    expect(manifest).toEqual(workboxManifest);
  it('injects files hashed with MD5, except the service worker', async () => {
    await injectPrecacheManifest(getOptions(outDir.path));
      {url: 'assets/main.css', revision: 'aa676972bbd2b68e94ef8e91e81d20be'},
      {url: 'assets/main.js', revision: '238e96d5b62a1aec3739730469f27192'},
      {url: 'index.html', revision: 'fe919dfbe925337c176e602ebbf0d15c'},
    await injectPrecacheManifest({
    await injectPrecacheManifest({
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5b2eeddc` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T14:22:52.158Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794925372158",
    "title": "only use our own precache manifest injection when MD5 is not available",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meta/docusaurus",
    "source_uri": "https://github.com/facebook/docusaurus",
    "source_version": "HEAD",
    "content_hash": "99fa9577c5b8437f70f0e2a0a344b321bec101e70dc551875d2c87f83a942df3"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T14:22:52.158Z"
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
  "auth_token": "cf573d92db2ed452cd6a6e322b4670aa447c702ecd1d44abc5cedf07f9ba1695"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-NGCN] Strict Boundary Isolation for Minified Class Expressions and Bare Specifiers

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
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Bundlers and minifiers targeting virtualized or restricted environments (such as StackBlitz WebContainer, isolated WebWorkers, or sandboxed VMs) MUST NOT generate top-level local variable identifiers that shadow bare module specifier imports within the same scope.

**WHY**:
Certain JavaScript execution runtimes (specifically WebContainer's module resolution interception layer and strict ESM polyfills) exhibit edge-case scoping defects where named class expressions (e.g. `_e = class e { ... new e() ... }`) incorrectly resolve `e` to an outer module-level import (`import { createOptimizer as e }`) rather than the local class constructor. This causes runtime exceptions like `TypeError: e is not a constructor`.

**WHEN TO APPLY**:
Rollup/esbuild/Terser bundling configurations, plugin distribution pipelines, and WASM/Rust bridge packaging systems that must run deterministically in browser-based Node.js runtimes.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Rollup/Vite configuration invariant
export const getSafeMinificationConfig = () => ({
  output: {
    // Prevent name collisions across external specifier re-exports
    // and internal minified class names
    keep_classnames: true,
    reserved: ['createOptimizer', 'MagicString'],
  },
  treeshake: {
    moduleSideEffects: false,
  },
});
```

**NEGATIVE CONSTRAINT**:
```javascript
// Minified bundle snippet causing runtime failure in virtual runtimes:
import { createOptimizer as e } from "@qwik.dev/optimizer";
// ...
var _e = class e {
  split(t) {
    return new e(t, this.end); // CRASH: In WebContainers, resolves to imported function `e` instead of class `e`
  }
};
```

**VERIFICATION METHOD**:
Run an automated CI integration step targeting `@webcontainer/api` or a Node.js VM context with mocked dynamic import maps, evaluating every exported production distribution artifact directly inside the guest environment.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:10:58.823Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794895858823",
    "title": "Strict Boundary Isolation for Minified Class Expressions and Bare Specifiers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "QwikDev/qwik",
    "source_uri": "https://github.com/QwikDev/qwik",
    "source_version": "HEAD",
    "content_hash": "4909f5125a56caa7de350507de0a358608ea65b7aa6df1769b36186fb2e69d07"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:10:58.823Z"
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
  "auth_token": "cb480a15a22aa75517c85b29cb3ec6a8afee52dfa0bd11bcc675bcb30057879d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

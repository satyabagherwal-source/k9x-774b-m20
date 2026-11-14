# Candidate Directive: [CD-Z3PN] 🐙): drop an e2e reply that comes after its request timed out

<!-- PROVENANCE_START
{
  "source_repository": "wcandillon/react-native-skia",
  "source_url": "https://github.com/Shopify/react-native-skia",
  "source_version": "c72569b3",
  "license": "MIT",
  "timestamp": "2026-11-14T06:57:01.067Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-wcandillon-react-native-skia",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [wcandillon/react-native-skia](https://github.com/Shopify/react-native-skia) (Revision: `c72569b3`).  
> **License**: MIT | **Timestamp**: `2026-11-14T06:57:01.067Z`  
> **Learning ID**: `learn-github-wcandillon-react-native-skia`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/example/src/Tests/Tests.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wcandillon/react-native-skia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e2c676a`: 🐙): drop an e2e reply that comes after its request timed out. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/example/src/Tests/Tests.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import type { ComponentRef, ReactElement } from "react";
import React, { useEffect, useRef, useState } from "react";
import { serve } from "./serve";
const noop = () => {};
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
// Runs a snippet the host sent, with the app's Skia.
const evaluate = (
  { code, ctx }: { code: string; ctx: any },
  assets: TestsProps["assets"]
) =>
  eval(
    `(function Main() {
        const __addDisposableResource = (e, o) => { return o; };
        const __disposeResources = () => {};
        return (${code})(this.Skia, this.ctx, this.size, this.scale);
      })`
  ).call({
    Skia,
    // The worklet serializer spec needs app-side worklets (see
    // workletSerialization.ts), and the Gpu spec a way to lose the device;
    // hand them over through the context.
    ctx: {
      ...parseProps(ctx, assets),
      workletSerialization,
      forceGpuDeviceLoss,
    },
    size: size * PixelRatio.get(),
    scale: s,
  });
      return image.encodeToBase64();
  const [drawing, setDrawing] = useState<ReactElement | null>(null);
  // The screen shown, the key it is mounted with, and what it calls once it
  // has settl
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
import type { ComponentRef } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { SerializedNode } from "./deserialize";
// Report a failure back to the host as { $$error: message } so the matching
// test can `.rejects` instead of hanging on a missing reply, and so the throw
// is not surfaced as an unhandled exception that could break the socket for
// subsequent tests.
const errorEnvelope = (error: unknown) =>
  JSON.stringify({
    $$error: error instanceof Error ? error.message : String(error),
  });
// JSON.stringify returns undefined for a result JSON cannot carry: undefined, a function, a symbol.
const resultMessage = (result: unknown) => {
  const json: string | undefined = JSON.stringify(result);
  return json === undefined
    ? errorEnvelope(`The snippet's result has no JSON form: ${typeof result}`)
    : json;
};
      return await image.encodeToBytes();
  const [drawing, setDrawing] = useState<any>(null);
  // The screen shown and the key it is mounted with. Requested again, a
  // screen that settles is mounted again, so that it settles again; any other
  // keeps its instance and what it shows.
  // Whether the screen 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e2c676a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T06:57:01.063Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794639421063",
    "title": "🐙): drop an e2e reply that comes after its request timed out",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "wcandillon/react-native-skia",
    "source_uri": "https://github.com/Shopify/react-native-skia",
    "source_version": "HEAD",
    "content_hash": "b7ba7ddb145a233da572d44fcea9a2eccd40251a552eaa1adc6046d60fa9198b"
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
        "Harvested/verified timestamp recorded: 2026-11-14T06:57:01.063Z"
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
  "auth_token": "6c804fbac59ff8202cdaeb1a8422075e8ea68f89cf665cde339b81b744f2cf7b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

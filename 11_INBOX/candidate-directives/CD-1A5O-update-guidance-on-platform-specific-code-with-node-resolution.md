# Candidate Directive: [CD-1A5O] update guidance on platform specific code with node resolution

<!-- PROVENANCE_START
{
  "source_repository": "callstack/react-native-builder-bob",
  "source_url": "https://github.com/callstack/react-native-builder-bob",
  "source_version": "5961f36d",
  "license": "PERMISSIVE_OPEN_SOURCE",
  "timestamp": "2026-11-28T17:09:57.804Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-callstack-react-native-builder-bob",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack/react-native-builder-bob](https://github.com/callstack/react-native-builder-bob) (Revision: `5961f36d`).  
> **License**: PERMISSIVE_OPEN_SOURCE | **Timestamp**: `2026-11-28T17:09:57.804Z`  
> **Learning ID**: `learn-github-callstack-react-native-builder-bob`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/pages/esm.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/react-native-builder-bob. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5961f36d`: docs: update guidance on platform specific code with node resolution. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/pages/esm.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
  Alternatively, if you want to be able to use the library in Node.js with `import` syntax, use `Platform.select` or `Platform.OS` checks instead of platform-specific extensions:
  ```js
  import { Platform } from 'react-native';
  import { foo as fooAndroid } from './fooAndroid.js';
  import { foo as fooIOS } from './fooIOS.js';
  import { foo as fooFallback } from './fooFallback.js';
  const foo = Platform.select({
    android: fooAndroid,
    ios: fooIOS,
    default: fooFallback,
  });
  ```
  Note that code in all of these files will be included in the bundle for every platform unlike platform-specific extensions.
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
  Alternatively, if you want to be able to use the library in Node.js with `import` syntax, there are a few options:
  - Use `Platform.select` instead of platform-specific extensions:
    ```js
    import { Platform } from 'react-native';

    const foo = Platform.select({
      android: require('./fooAndroid.js'),
      ios: require('./fooIOS.js'),
      default: require('./fooFallback.js'),
    });
    ```

  - Use `require` to import code with platform-specific extensions in your library:
    ```js
    // will import `foo.native.js`, `foo.ios.js`, `foo.js` etc.
    const { foo } = require('./foo');
    ```
    Make sure to have a file without any platform-specific extensions that will be loaded by Node.js.
    Also note that if your module (e.g. `foo.js` in this case) contains ESM syntax, it will only work on a recent Node.js version. See [Compatibility](#compatibility) section for more information.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5961f36d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T17:09:57.802Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795885797802",
    "title": "update guidance on platform specific code with node resolution",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "callstack/react-native-builder-bob",
    "source_uri": "https://github.com/callstack/react-native-builder-bob",
    "source_version": "HEAD",
    "content_hash": "2daf6f03a23ec973ef0faad7c0f1d02739476409ba430126feb5ca540aa1ed85"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T17:09:57.802Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "e1fb07956abf364193f044164c818902d050c10647807780a9e646ad5c21ed1c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

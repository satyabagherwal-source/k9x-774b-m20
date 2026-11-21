# Candidate Directive: [CD-JUDW] AST-Neutral Bundled Artifact Checksum Invalidation

<!-- PROVENANCE_START
{
  "source_repository": "mswjs/msw",
  "source_url": "https://github.com/mswjs/msw",
  "source_version": "b3df8504",
  "license": "MIT",
  "timestamp": "2026-11-21T01:34:55.124Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mswjs-msw",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mswjs/msw](https://github.com/mswjs/msw) (Revision: `b3df8504`).  
> **License**: MIT | **Timestamp**: `2026-11-21T01:34:55.124Z`  
> **Learning ID**: `learn-github-mswjs-msw`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When validating the integrity of distributed runtime scripts (such as Service Workers or injected bootstrap bridges) across environments, the build system MUST compute the cryptographic checksum over an intermediate, whitespace-normalized, comment-stripped IIFE AST bundle with compression and variable mangling disabled.

**WHY**:
Raw file hashing (`crypto.createHash('sha256').update(fileBuffer)`) invalidates checksums on cosmetic diffs (line endings `CRLF` vs `LF`, package manager header injections, licensing comments). Conversely, hashing fully minified artifacts causes checksum instability across minor compiler/minifier version bumps due to variable renaming heuristics and dead code elimination re-ordering.

**WHEN TO APPLY**:
Static scripts deployed to user directories (e.g., `public/mockServiceWorker.js`) where client-side code must ensure runtime-to-library synchronization without false-positive version mismatch warnings.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import crypto from 'node:crypto'
import { Rolldown } from 'tsdown'
import { invariant } from 'outvariant'

export async function computeStableScriptChecksum(entryPath: string): Promise<string> {
  const bundle = await Rolldown.rolldown({
    input: entryPath,
    platform: 'browser',
    treeshake: false,
    logLevel: 'silent',
  })

  // Normalize formatting: remove comments and redundant whitespace,
  // but freeze variable names and syntax trees by disabling compression/mangling.
  const { output } = await bundle.generate({
    format: 'iife',
    comments: false,
    minify: {
      compress: false,
      mangle: false,
      codegen: {
        removeWhitespace: true,
      },
    },
  })
  await bundle.close()

  const [chunk] = output
  invariant(chunk && chunk.code, 'Failed to normalize script: empty bundle output')

  return crypto
    .createHash('md5')
    .update(chunk.code, 'utf8')
    .digest('hex')
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Hashing raw disk buffers or fully mangled output
import fs from 'node:fs'
import crypto from 'node:crypto'

export function computeUnstableChecksum(filePath: string): string {
  // FAILS: Git checkout line endings (LF vs CRLF) change the hash!
  const content = fs.readFileSync(filePath, 'utf8')
  return crypto.createHash('md5').update(content).digest('hex')
}
```

**VERIFICATION METHOD**:
Unit test validating that checking out the repository on Windows (`core.autocrlf=true`) vs Linux (`core.autocrlf=input`) generates identical hexadecimal digests for `mockServiceWorker.js`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T01:34:55.123Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795224895123",
    "title": "AST-Neutral Bundled Artifact Checksum Invalidation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mswjs/msw",
    "source_uri": "https://github.com/mswjs/msw",
    "source_version": "HEAD",
    "content_hash": "f6a9687d50fac5063c05841d1f06d9ad5a473e55f09f959bf1ae11d88b2e4b4b"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T01:34:55.123Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "894727a4f4878adae1c7e0e4a83c8f27a217229ea7abc1832b6b3af2e6a59c3c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

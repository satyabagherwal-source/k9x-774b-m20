# Candidate Directive: [CD-KN8V] AST-Neutral Bundled Artifact Checksum Invalidation

<!-- PROVENANCE_START
{
  "source_repository": "mswjs-msw-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T01:35:32.401Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mswjs-msw-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mswjs-msw-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T01:35:32.401Z`  
> **Learning ID**: `LEARN-EVO-mswjs-msw-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T01:35:32.526Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795224932526",
    "title": "AST-Neutral Bundled Artifact Checksum Invalidation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mswjs-msw-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6890852269bb9e6bb6ffaacecefa50e51414263dfb9f90a44e022738f3267bc3"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Harvested/verified timestamp recorded: 2026-11-21T01:35:32.526Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "96f4f4df343062169b77056cbfba4fbaab0e06627521ae9283e1d1ae2e9d6a03"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

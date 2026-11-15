# Candidate Directive: [CD-KJ9M] Lexicographically Stable Hashing for Configuration Invariants

<!-- PROVENANCE_START
{
  "source_repository": "melnixdev-seo-crawl-audit-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T08:53:19.789Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-melnixdev-seo-crawl-audit-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [melnixdev-seo-crawl-audit-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T08:53:19.789Z`  
> **Learning ID**: `LEARN-EVO-melnixdev-seo-crawl-audit-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Structural configuration objects used as identity keys or integrity hashes MUST NOT be hashed directly via standard `JSON.stringify()`. They MUST be serialized using a recursive lexicographical key-sorting serializer (`stableJson`) that recursively handles nested objects and arrays while escaping non-deterministic or transient fields.

**WHY**:
V8 and other JavaScript runtimes do not guarantee deterministic key enumeration order across different execution paths, optimization tiers, or Node.js versions. If two scan configurations with identical semantics have keys defined in different orders (e.g., `{ timeout: 1000, delay: 50 }` vs `{ delay: 50, timeout: 1000 }`), raw `JSON.stringify` produces distinct strings, causing false-positive cache misses, invalidating comparison baselines, and corrupting regression histories.

**WHEN TO APPLY**:
Apply to configuration hashing, audit finding fingerprinting, database row deduplication, and any deterministic state tree verification.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { createHash } from "node:crypto";

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeConfigurationHash(config: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(config)).digest("hex");
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL ANTI-PATTERN: Native JSON.stringify produces non-deterministic hashes
export function computeBadHash(config: Record<string, unknown>): string {
  // FAILS: Key ordering mutations alter digest output
  return crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex");
}
```

**VERIFICATION METHOD**:
Property-based testing: Generate randomized nested objects with identical key-value mappings but shuffled key insertion orders. Assert that `computeConfigurationHash(objA) === computeConfigurationHash(objB)` holds true across $10^5$ random permutations.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:53:19.882Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794732799882",
    "title": "Lexicographically Stable Hashing for Configuration Invariants",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "melnixdev-seo-crawl-audit-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8d9dd6ba1d0caf6254bb8e2caefbc41412bbb33b3215f4c44793d9f02dd675c9"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:53:19.882Z"
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
  "auth_token": "91e78ae9f024d01a611e4957c9bff350f2a7f631087c810b137df5112f787e1d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

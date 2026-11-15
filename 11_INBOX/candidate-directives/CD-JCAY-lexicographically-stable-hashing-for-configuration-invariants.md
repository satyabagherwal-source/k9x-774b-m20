# Candidate Directive: [CD-JCAY] Lexicographically Stable Hashing for Configuration Invariants

<!-- PROVENANCE_START
{
  "source_repository": "MelnixDev/seo-crawl-audit",
  "source_url": "https://github.com/MelnixDev/seo-crawl-audit",
  "source_version": "abed0505",
  "license": "MIT",
  "timestamp": "2026-11-15T08:52:24.202Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-melnixdev-seo-crawl-audit",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MelnixDev/seo-crawl-audit](https://github.com/MelnixDev/seo-crawl-audit) (Revision: `abed0505`).  
> **License**: MIT | **Timestamp**: `2026-11-15T08:52:24.202Z`  
> **Learning ID**: `learn-github-melnixdev-seo-crawl-audit`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-15T08:52:24.201Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794732744201",
    "title": "Lexicographically Stable Hashing for Configuration Invariants",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MelnixDev/seo-crawl-audit",
    "source_uri": "https://github.com/MelnixDev/seo-crawl-audit",
    "source_version": "HEAD",
    "content_hash": "8d9dd6ba1d0caf6254bb8e2caefbc41412bbb33b3215f4c44793d9f02dd675c9"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:52:24.201Z"
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
  "auth_token": "269fac34fdce12319e407b4d1c0c4001f147c0de21ab6dab9aab3958f37cecee"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

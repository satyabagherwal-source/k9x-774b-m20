# Candidate Directive: [CD-QMKG] File System URI Segment Idempotent Decoding Invariant

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "15845c2a",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-19T08:08:45.760Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `15845c2a`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-19T08:08:45.760Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When rendering, previewing, or segmenting hierarchical Virtual Filesystem URIs (e.g., `viking://`), paths **MUST** be decoded exactly once strictly for presentation labels, while **ALL** underlying network operations, index references, route navigations, and cache keys **MUST** retain the raw, canonically encoded URI. Encoded path delimiters (`%2F`) **MUST NOT** be decoded prior to path segment splitting.

**WHY**:
Double-decoding or decoding before splitting path segments causes catastrophic directory traversal bugs, splits single files containing encoded slashes into non-existent virtual directories, and causes cache misses. Furthermore, decoding raw URIs before sending them to backend storage services leads to 404s when filenames contain reserved URI characters (`?`, `#`, `%`, `&`).

**WHEN TO APPLY**:
Applies to UI breadcrumbs, file trees, object storage explorers, and agent path navigators interfacing with URI-based naming systems.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified implementation from OpenViking frontend/shared/path-label.ts
export interface PathSegment {
  label: string;
  uri: string;
  isFirst: boolean;
}

export function decodePathLabel(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // Gracefully handle malformed escape sequences without throwing
    return segment;
  }
}

export function splitVfsUri(rawUri: string): PathSegment[] {
  const trimmed = rawUri.trim();
  if (!trimmed) return [];

  const schemeEndIndex = trimmed.indexOf("://");
  let scheme = "";
  let pathPart = trimmed;

  if (schemeEndIndex !== -1) {
    scheme = trimmed.slice(0, schemeEndIndex + 3);
    pathPart = trimmed.slice(schemeEndIndex + 3);
  }

  // Split on physical path delimiter '/' BEFORE decoding segments
  const parts = pathPart.split("/").filter((part) => part.length > 0);
  const segments: PathSegment[] = [];
  let accumulatedUri = scheme.replace(/\/+$/, "");

  parts.forEach((part, index) => {
    accumulatedUri = `${accumulatedUri}/${part}`;
    segments.push({
      // Decode ONLY for human-visible label
      label: scheme ? decodePathLabel(part) : part,
      // Retain RAW canonically-encoded URI for RPC/REST operations
      uri: accumulatedUri,
      isFirst: index === 0,
    });
  });

  return segments;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Decoding before splitting or returning decoded URI for operations
function unsafeSplitUri(rawUri: string) {
  // If rawUri is "viking://folder%2Fsub/file.txt", decoding first splits one folder into two!
  const decoded = decodeURIComponent(rawUri);
  return decoded.split("/").map((part) => ({
    label: part,
    uri: part, // Using decoded value for server requests creates 400/404 errors
  }));
}
```

**VERIFICATION METHOD**:
Test with synthetic URIs containing encoded delimiters and Unicode: `viking://my%20bucket/dir%2Fsub/test%25file.md`. Assert that `segments.length === 3`, `segments[1].label === "dir/sub"`, and `segments[1].uri === "viking://my%20bucket/dir%2Fsub"`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T08:08:45.760Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795075725760",
    "title": "File System URI Segment Idempotent Decoding Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "volcengine/OpenViking",
    "source_uri": "https://github.com/volcengine/OpenViking",
    "source_version": "HEAD",
    "content_hash": "08f5450e558f8828787ca26daf1746b30cfea4a94457d6c7cde52d19ffb6b108"
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
        "Harvested/verified timestamp recorded: 2026-11-19T08:08:45.760Z"
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
  "auth_token": "3345972e67b2dda68cee01ba3658320d845982fee35a92a34851fc839ffadc33"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

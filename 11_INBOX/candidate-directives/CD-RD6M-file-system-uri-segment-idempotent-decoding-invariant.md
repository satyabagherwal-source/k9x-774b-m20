# Candidate Directive: [CD-RD6M] File System URI Segment Idempotent Decoding Invariant

<!-- PROVENANCE_START
{
  "source_repository": "volcengine-openviking-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T08:09:20.142Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-volcengine-openviking-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine-openviking-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T08:09:20.142Z`  
> **Learning ID**: `LEARN-EVO-volcengine-openviking-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T08:09:20.253Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795075760253",
    "title": "File System URI Segment Idempotent Decoding Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "volcengine-openviking-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7eb9abd36bf755bbd16a3a3427282160eaacf2fcffc6de683c8ec9869cb32de9"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-19T08:09:20.253Z"
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
  "auth_token": "6441d531ef37bb4969118970ad35f096aa7c33c7606700611440add0268c6e9c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

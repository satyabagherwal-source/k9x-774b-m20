# Candidate Directive: [CD-O25P] console): make project search one request and debounce it

<!-- PROVENANCE_START
{
  "source_repository": "appwrite-appwrite-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T16:00:21.071Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-appwrite-appwrite-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [appwrite-appwrite-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T16:00:21.071Z`  
> **Learning ID**: `LEARN-EVO-appwrite-appwrite-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/console/src/components/global/shared/CommandCenter.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in appwrite/appwrite. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4ba94d47`: console): make project search one request and debounce it. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/console/src/components/global/shared/CommandCenter.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
  // Scoped lists hit the API, so they search once typing pauses.
  const debouncedSearch = useDebouncedValue(search, 300)
      shouldFetch && searchScope === 'projects' ? debouncedSearch : undefined,
      shouldFetch && searchScope === 'databases' ? debouncedSearch : undefined,
    shouldFetch && searchScope === 'users' ? debouncedSearch : undefined,
    shouldFetch && searchScope === 'teams' ? debouncedSearch : undefined,
      shouldFetch && searchScope === 'buckets' ? debouncedSearch : undefined,
      shouldFetch && searchScope === 'functions' ? debouncedSearch : undefined,
    shouldFetch && searchScope === 'sites' ? debouncedSearch : undefined,
      shouldFetch && searchScope === 'messages' ? debouncedSearch : undefined,
    shouldFetch && searchScope === 'topics' ? debouncedSearch : undefined,
      shouldFetch && searchScope === 'providers' ? debouncedSearch : undefined,
    shouldFetch && searchScope === 'videos' ? debouncedSearch : undefined,
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
      shouldFetch && searchScope === 'projects' ? search : undefined,
      shouldFetch && searchScope === 'databases' ? search : undefined,
    shouldFetch && searchScope === 'users' ? search : undefined,
    shouldFetch && searchScope === 'teams' ? search : undefined,
      shouldFetch && searchScope === 'buckets' ? search : undefined,
      shouldFetch && searchScope === 'functions' ? search : undefined,
    shouldFetch && searchScope === 'sites' ? search : undefined,
      shouldFetch && searchScope === 'messages' ? search : undefined,
    shouldFetch && searchScope === 'topics' ? search : undefined,
      shouldFetch && searchScope === 'providers' ? search : undefined,
    shouldFetch && searchScope === 'videos' ? search : undefined,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4ba94d47` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T16:00:21.227Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795708821227",
    "title": "console): make project search one request and debounce it",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "appwrite-appwrite-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7fc6942f49e8da7b34ae3d8657265e23ac17ad022eefa495f4774a943ab09d65"
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
        "Harvested/verified timestamp recorded: 2026-11-26T16:00:21.228Z"
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
  "auth_token": "3603b61ca32180d0cffa59ebc9d33feaf7089aa7c6dc3e69f501b23e2b0848df"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

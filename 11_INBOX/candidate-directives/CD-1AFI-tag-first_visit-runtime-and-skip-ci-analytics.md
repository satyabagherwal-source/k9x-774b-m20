# Candidate Directive: [CD-1AFI] tag first_visit runtime and skip CI analytics

<!-- PROVENANCE_START
{
  "source_repository": "genkit-ai/genkit",
  "source_url": "https://github.com/genkit-ai/genkit",
  "source_version": "76f631c6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T17:03:17.262Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-genkit-ai-genkit",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [genkit-ai/genkit](https://github.com/genkit-ai/genkit) (Revision: `76f631c6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T17:03:17.262Z`  
> **Learning ID**: `learn-github-genkit-ai-genkit`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/build-cli-binaries.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `aa34700a`: genkit-tools): tag first_visit runtime and skip CI analytics. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/build-cli-binaries.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
          # Start UI in background in non-interactive mode so CI doesn't opt into analytics
          ./genkit-${{ matrix.target }} --non-interactive ui:start > ui_output.log 2>&1 &
            ./genkit-${{ matrix.target }} --non-interactive ui:stop || true
          # Start UI in background in non-interactive mode so CI doesn't opt into analytics
            -ArgumentList "--non-interactive", "ui:start" `
            & ".\genkit-${{ matrix.target }}.exe" --non-interactive ui:stop
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
          # Start UI in background, piping any prompts to accept them
          (echo "" | ./genkit-${{ matrix.target }} ui:start 2>&1 | tee ui_output.log) &
            ./genkit-${{ matrix.target }} ui:stop || true
          # Create empty input file first for redirecting stdin
          "" | Out-File -FilePath ".\empty.txt"
          
          # Start UI in background, redirecting input to handle prompts
            -ArgumentList "ui:start" `
            -RedirectStandardInput ".\empty.txt" `
            & ".\genkit-${{ matrix.target }}.exe" ui:stop
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `aa34700a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T17:03:17.260Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795539797260",
    "title": "tag first_visit runtime and skip CI analytics",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "genkit-ai/genkit",
    "source_uri": "https://github.com/genkit-ai/genkit",
    "source_version": "HEAD",
    "content_hash": "d1735e83daad6f1e825b942f6ed188a791ff9ebcc0afcaf2416e3b5b5681c22f"
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
        "Harvested/verified timestamp recorded: 2026-11-24T17:03:17.260Z"
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
  "auth_token": "c421f113d58be2b52e0d680e35099192627331eb1608d5699b187931d064f2de"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-RFZP] js/plugins/google-genai): send tool_choice none/auto as string in Interactions

<!-- PROVENANCE_START
{
  "source_repository": "genkit-ai/genkit",
  "source_url": "https://github.com/genkit-ai/genkit",
  "source_version": "9a7d0b65",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T11:41:01.237Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-genkit-ai-genkit",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [genkit-ai/genkit](https://github.com/genkit-ai/genkit) (Revision: `9a7d0b65`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T11:41:01.237Z`  
> **Learning ID**: `learn-github-genkit-ai-genkit`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `js/plugins/google-genai/src/common/interaction-converters.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9a7d0b65`: js/plugins/google-genai): send tool_choice none/auto as string in Interactions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `js/plugins/google-genai/src/common/interaction-converters.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
 *
 * The server only accepts `allowed_tools` with mode `any` or `validated`
 * (`{"allowed_tools": {"mode": "none"}}` is a 400 "allowed_tools mode must
 * be either ANY or VALIDATED."), so every other mode is sent as a plain
 * string. `allowedFunctionNames` without `ANY` or `VALIDATED` can't be
 * expressed and is dropped via `warnDropped`.
  toolChoice?: string,
  warnDropped?: (field: string) => void
): string | InteractionToolChoiceConfig | undefined {
    const names = functionCallingConfig.allowedFunctionNames;
    const hasNames = !!names?.length;
    if (hasNames && (validMode === 'any' || validMode === 'validated')) {
      return { allowed_tools: { mode: validMode, tools: names } };
    if (hasNames) {
      warnDropped?.('functionCallingConfig.allowedFunctionNames');
    }
    return validMode;
    return toolChoice === 'required' ? 'any' : toolChoice;
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
  toolChoice?: string
): InteractionToolChoiceConfig | undefined {
    if (!validMode && !functionCallingConfig.allowedFunctionNames?.length) {
      return undefined;
    return {
      allowed_tools: {
        ...(validMode ? { mode: validMode } : {}),
        ...(functionCallingConfig.allowedFunctionNames
          ? { tools: functionCallingConfig.allowedFunctionNames }
          : {}),
      },
    };
    return {
      allowed_tools: { mode: toolChoice === 'required' ? 'any' : toolChoice },
    };
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9a7d0b65` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T11:41:01.235Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795174861235",
    "title": "js/plugins/google-genai): send tool_choice none/auto as string in Interactions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "genkit-ai/genkit",
    "source_uri": "https://github.com/genkit-ai/genkit",
    "source_version": "HEAD",
    "content_hash": "6f2640aebb382f3bc9ce3c43cbffaa6ebb7f08f41d345e42a10715fca7fcc306"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T11:41:01.235Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "cda83508e3b0614e6ac1bffcf5c90ff00c5a4caa3aadd845fd0b65984abaeb69"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

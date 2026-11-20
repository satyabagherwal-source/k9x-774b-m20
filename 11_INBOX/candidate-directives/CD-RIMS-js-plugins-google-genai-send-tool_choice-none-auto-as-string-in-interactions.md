# Candidate Directive: [CD-RIMS] js/plugins/google-genai): send tool_choice none/auto as string in Interactions

<!-- PROVENANCE_START
{
  "source_repository": "genkit-ai-genkit-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T11:41:04.576Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-genkit-ai-genkit-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [genkit-ai-genkit-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T11:41:04.576Z`  
> **Learning ID**: `LEARN-EVO-genkit-ai-genkit-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T11:41:04.656Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795174864656",
    "title": "js/plugins/google-genai): send tool_choice none/auto as string in Interactions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "genkit-ai-genkit-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "32acc98069e8f8ea34ffd7348ac9181e8190477f6d358d8c4651ac5f5d4f14a9"
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
        "Harvested/verified timestamp recorded: 2026-11-20T11:41:04.656Z"
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
  "auth_token": "94994f0304e6c8b518f08699418987ddfc3e7b47e8cfbd578431be6292eb3624"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-H0W6] Python 3.14+ Deferred Annotation Recovery via Bytecode Const Inspection

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable-pixeltable-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:18:01.049Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pixeltable-pixeltable-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable-pixeltable-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:18:01.049Z`  
> **Learning ID**: `LEARN-EVO-pixeltable-pixeltable-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When building metaprogramming frameworks, ORMs, or declarative schema systems that parse type annotations on class bodies, you MUST NOT rely solely on `__annotations__` or `eval()`, nor assume annotations are executed during class body definition. Under PEP 649 (Python 3.14+), you MUST inspect the class frame's code object constants (`co_consts`) to find the deferred compiler-generated `__annotate__` code block and evaluate it using a synthesized `__classdict__` closure cell before class completion.

**WHY**:
PEP 649 defers class annotation evaluation: annotations are no longer emitted as direct namespace mutations during body execution; they are compiled into an isolated `__annotate__(format)` code object. Standard access before class creation crashes or returns empty dicts. Direct eval of AST fails on closure-dependent types (e.g., local type aliases). Without inspecting bytecode constants, dynamic schema generation and validation fail during the frame execution phase.

**WHEN TO APPLY**:
Any Python ORM, validation library (Pydantic-like), database interface, or schema compiler supporting Python 3.14 and Python 3.15+.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import dis
import types
from typing import Any

def extract_deferred_annotations(
    caller_frame: types.FrameType,
    cls_name: str,
    eval_globals: dict[str, Any],
    namespace: dict[str, Any]
) -> dict[str, Any]:
    """
    Recovers PEP 649 annotations from CPython bytecode before class construction.
    """
    code = caller_frame.f_code
    # Step 1: Locate class body code object among constants
    body_code: types.CodeType | None = None
    for instr in dis.get_instructions(code):
        if instr.offset > caller_frame.f_lasti:
            break
        if (
            instr.opname.startswith('LOAD_CONST')
            and isinstance(instr.argval, types.CodeType)
            and instr.argval.co_name == cls_name
        ):
            body_code = instr.argval

    if body_code is None:
        return {}

    # Step 2: Locate the synthetic '__annotate__' function in the body code constants
    annotate_code = next(
        (c for c in body_code.co_consts if isinstance(c, types.CodeType) and c.co_name == '__annotate__'),
        None
    )
    if annotate_code is None:
        return {}

    # Step 3: Wrap __classdict__ in a closure cell to support closure references

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:18:01.158Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885481158",
    "title": "Python 3.14+ Deferred Annotation Recovery via Bytecode Const Inspection",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pixeltable-pixeltable-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0021924a45b720e0e6618a210f0db58a01957c912b7d9b3beab094eabbfc7d28"
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:18:01.158Z"
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
  "auth_token": "d491963dec3b1e5b57ff81d1754169b578869545b40ed7dbff10488abb29c970"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

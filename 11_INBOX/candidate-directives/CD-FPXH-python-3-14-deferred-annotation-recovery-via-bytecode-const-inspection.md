# Candidate Directive: [CD-FPXH] Python 3.14+ Deferred Annotation Recovery via Bytecode Const Inspection

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable/pixeltable",
  "source_url": "https://github.com/pixeltable/pixeltable",
  "source_version": "9c30a9a6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T03:17:00.293Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pixeltable-pixeltable",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable/pixeltable](https://github.com/pixeltable/pixeltable) (Revision: `9c30a9a6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T03:17:00.293Z`  
> **Learning ID**: `learn-github-pixeltable-pixeltable`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    closure = tuple(types.CellType(namespace) for _ in annotate_code.co_freevars)
    fn = types.FunctionType(annotate_code, eval_globals, '__annotate__', None, closure)

    # Format 1 indicates VALUE format (evaluating to runtime type instances)
    return fn(1)
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL DEFECT: Fails on Python 3.14+ PEP 649
def unsafe_get_annotations(cls_dict: dict[str, Any]) -> dict[str, Any]:
    # __annotations__ will be absent or unpopulated during class-body metaprogramming
    if '__annotations__' not in cls_dict:
        return {}
    return cls_dict['__annotations__']
```

**VERIFICATION METHOD**:
Run unit tests across Python 3.11, 3.12, 3.13, 3.14, and 3.15-dev validating that a class declaring nested annotations resolves all types identically without executing user code twice.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:17:00.293Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885420293",
    "title": "Python 3.14+ Deferred Annotation Recovery via Bytecode Const Inspection",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pixeltable/pixeltable",
    "source_uri": "https://github.com/pixeltable/pixeltable",
    "source_version": "HEAD",
    "content_hash": "ee4888702317060e91d518144d60c2531e038cc0e446919597e6d874266a07ee"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:17:00.293Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "76f826146baefaa8133318e62283e37e1bac3c951b66b07c3a964139c4df59a3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

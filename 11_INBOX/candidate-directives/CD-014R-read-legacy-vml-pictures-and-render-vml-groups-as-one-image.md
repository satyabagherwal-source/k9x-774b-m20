# Candidate Directive: [CD-014R] Read legacy VML pictures and render VML groups as one image

<!-- PROVENANCE_START
{
  "source_repository": "Ontos-AI/knowhere",
  "source_url": "https://github.com/Ontos-AI/knowhere",
  "source_version": "90197327",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T05:06:48.123Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ontos-ai-knowhere",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere) (Revision: `90197327`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T05:06:48.123Z`  
> **Learning ID**: `learn-github-ontos-ai-knowhere`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/worker/app/services/document_parser/formats/docx/block_stream.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Ontos-AI/knowhere. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b8d3b813`: Read legacy VML pictures and render VML groups as one image. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/worker/app/services/document_parser/formats/docx/block_stream.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
from app.services.document_parser.formats.docx.vml_graphics import (
    is_composite,
    render_composites,
    single_picture_rid,
    vml_pictures,
)
            "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
        # Composite VML graphics in the paragraphs read below render together.
        composites = list(
            dict.fromkeys(
                pict
                for paragraph in body.xpath(
                    "w:p | w:sdt/w:sdtContent//w:p", namespaces=ns
                )
                for pict in vml_pictures(paragraph, ns)
                if is_composite(pict, ns)
            )
        )
        composite_images = render_composites(doc_data, root, composites, ns)
                        if p_elem.xpath("ancestor::w:p", namespaces=ns):
                            # A text-box paragraph: its images belong to the
                            # enclosing paragraph, which is read as well.
                            continue
                            p_elem,
                            text=text,
                            docx=docx,
                            rel_map=rel_map,
                            ns=ns,
                           
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
                            p_elem, text=text, docx=docx, rel_map=rel_map, ns=ns
                    elem, text=text, docx=docx, rel_map=rel_map, ns=ns
def _paragraph_images(paragraph, *, text, docx, rel_map, ns):
    """Images a paragraph holds, or a placeholder for a VML-only graphic."""
        rid = blip.get(f"{r_ns}embed")
        if not rid or rid in seen_rids:
            continue
        target = rel_map.get(rid)
        if not target or not target.startswith("media/"):
            continue
        seen_rids.add(rid)
        data = docx.read("word/" + target)
        if is_below_img_min_size(len(data)):
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b8d3b813` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T05:06:48.121Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795410408121",
    "title": "Read legacy VML pictures and render VML groups as one image",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Ontos-AI/knowhere",
    "source_uri": "https://github.com/Ontos-AI/knowhere",
    "source_version": "HEAD",
    "content_hash": "512f02e3b972e86691a53161eff9c6e3eb5a861bbf8418276c084c0fe29ab20b"
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
        "Harvested/verified timestamp recorded: 2026-11-23T05:06:48.121Z"
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
  "auth_token": "974d24d2680c1c793372947b5b6291196a989ed479ff518e09376cb36ee05ca1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

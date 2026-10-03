# Source Record Template

Use this structure when an external source materially contributes to Brain knowledge.

## Source & Terms Check

- Title:
- Author / organization:
- URL:
- License / Terms: (e.g. MIT, Apache-2.0, BSD-3, Official Public Docs)
- Terms of Service Compliance Verified: [YES / NO]
- Publication / update date:
- Date accessed:

## Provenance Metadata

```json
{
  "source": "",
  "source_url": "",
  "source_version": "",
  "source_type": "github_repo | official_docs | project_incident",
  "license": "",
  "extracted_at": "",
  "ai_provider": "",
  "generation_mode": "source_derived_ai_synthesized | human_curated",
  "evidence": [],
  "verified": true,
  "confidence": "high | medium",
  "promotion_status": "candidate | approved",
  "distillation_prohibited": true
}
```

## Relevant claim

State only the claim relevant to the Brain.

## What the source actually supports

Explain the supported point in your own words, citing exact commit SHAs, file paths, or section numbers.

## What it does not establish

Record important limitations or scope.

## Brain impact

State whether the source:
- confirms an existing rule,
- modifies an existing rule,
- suggests a candidate rule,
- or provides background only.

## Verification status

- Unverified
- Partially verified
- Verified
- Rejected

> **Invariant**: Do not treat the source itself as a permanent Brain rule without evidence verification. Brain records must never be compiled as an ML model training corpus.


# Candidate Directive: [CD-RNTB] Feedback & Evolution Intelligence: ildrm-northstar-seo-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "ildrm-northstar-seo-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:39:28.725Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-ildrm-northstar-seo-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ildrm-northstar-seo-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:39:28.725Z`  
> **Learning ID**: `LEARN-REEXTRACT-ildrm-northstar-seo-learnings`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Rejection / Holding Reason**: Human approval authorization required before canonical promotion
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ildrm-northstar-seo-learnings.md`  
> **Source**: github (https://github.com/ildrm/northstar-seo)  
> **Source Version**: `5ec9c7dc23`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:30:00.000Z  
> **Learning ID**: `learn-github-ildrm-northstar-seo`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: ildrm/northstar-seo

## 1. Executive Forensic Architecture & System Mechanics
TypeScript monorepo (pnpm + Turborepo) implementing `packages/seo-engine`.
- **SSRF Network Safety Boundary (`src/network-safety.ts`)**:
  - Enforces `assertPublicHttpUrl` before fetching, preventing crawlers from being weaponized against local loopbacks, AWS/GCP cloud metadata endpoints (`metadata.google.internal`, `169.254.169.254`), and private RFC 1918 / RFC 4193 subnets.

## 2. Promoted Master Brain Rules
- **Rule 1612**: Crawler SSRF Quarantine & Inline Data-URI Memory Barrier.

## Quality Gate Validation Dimensions
```json
{
  "decision": "STAGED_FOR_REVIEW",
  "note": "Human approval authorization required before canonical promotion"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Skill: Operational & Integration Playbook for bourd/dev/seo/skills

<!-- PROVENANCE_START
{
  "source_repository": "bourd/dev/seo/skills",
  "source_url": "https://github.com/bourd/dev/seo/skills",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "skill_playbook"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [bourd/dev/seo/skills](https://github.com/bourd/dev/seo/skills) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Skill Overview & Purpose
Procedural playbook defining verified operational and implementation patterns for **bourd/dev/seo/skills**.
- **Canonical Domain**: Domain J (Search & Distribution Intelligence)
- **Model Independence**: Universal (Applies across Claude, Gemini, GPT, and Local agents)

## 2. Prerequisites & Technical Boundary
- Runtime ecosystem: Verified against bourd/dev/seo/skills revision `historical`.
- Required security tier: Sanitized against PII/secrets.

## 3. Step-by-Step Procedural Workflow
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bourd-dev-seo-skills-learnings.md`  
> **Source**: github (https://github.com/bourd-dev/seo-skills)  
> **Source Version**: `4b0005f6e6`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:30:00.000Z  
> **Learning ID**: `learn-github-bourd-dev-seo-skills`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: bourd-dev/seo-skills

## 1. Executive Forensic Architecture & System Mechanics
`bourd-dev/seo-skills` provides 25 modular audit skills and technical reference playbooks grounded strictly in official Google Search Central documentation and Schema.org standards.

### Key Architectural Innovations:
1. **Standardized Audit Output Contract (`references/audit-output-contract.md`)**:
   - Universal JSON schema (`schemas/audit-finding.schema.json`) enforcing required finding fields: `id`, `category`, `severity`, `scope`, `summary`, `evidence`, `why_it_matters`, `recommendation`, `verification`.
2. **Dual Evidence Operating Modes (`references/evidence-modes.md`)**:
   - Distinguishes `Live Audit` (public URLs, HTTP behavior, rendered DOM, search console exports) from `Preflight Audit` (source code, generated HTML, intended routes).
   - Enforces 4 confidence classifications: `observed-live`, `verified-preflight`, `inferred-from-source`, `requires-post-deploy-verification`.
3. **Tooling Reliability Ground-Truth Protocol**:
   - Raw HTTP response (`curl -sIL` and `curl -s`) is mandatory for `<head>` directives (canonical, robots meta, hreflang, JSON-LD, Open Graph).
   - Markdown-converting fetchers silently strip `<head>` elements, causing false-negative bugs. Findings must cite raw HTTP stream evidence.

## 2. Multi-Dimensional Investigation Summary (D1 to D8)
- **D1 (Structural Boundaries)**: 25 standalone skills including `audit-indexability`, `audit-canonicalization`, `audit-crawlability`, `audit-js-rendering`, `audit-structured-data`, and `diagnose-search-traffic-drop`.
- **D3 (Verification & Truth)**: Every recommendation must cite either an observed site fact or a primary source (Google Search Essentials, RFCs, Schema.org). Speculative conventional SEO advice is banned.
- **D5 (Data Contracts)**: JSON Schema validation ensures machine-readable interoperability between autonomous audit agents.

## 3. Promoted Master Brain Rules
- **Rule 1611**: Raw HTTP Stream vs Rendered DOM Dual-Observer Verification Invariant.

## 4. Empirical Verification & Quality Gate
```bash
node scripts/verify-execution.mjs --target "bourd-dev-seo-skills"
```

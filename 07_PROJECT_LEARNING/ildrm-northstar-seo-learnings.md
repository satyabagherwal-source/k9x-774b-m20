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
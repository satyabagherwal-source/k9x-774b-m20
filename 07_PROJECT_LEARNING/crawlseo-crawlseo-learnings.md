> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crawlseo-crawlseo-learnings.md`  
> **Source**: github (https://github.com/crawlseo/crawlseo)  
> **Source Version**: `1e7207b6eb`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:45:00.000Z  
> **Learning ID**: `learn-github-crawlseo-crawlseo`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: crawlseo/crawlseo

## 1. Executive Forensic Architecture & System Mechanics
Next.js / TypeScript crawler platform with Prisma, Postgres job queue, and 79 test files.
- **Postgres Job Queue (`worker/`)**: Decouples UI web requests from long-running crawl executions, preventing serverless timeout terminations.
- **Outbound Host Boundary (`outbound-hosts.json`)**: Enforces domain scoping to prevent recursive spider escapes.
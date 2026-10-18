# Incident Record: Cloud Harvester 404 Poison-Pill Infinite Retry Trap

- **Incident ID**: INC-002
- **Timestamp**: 2026-10-18T07:30:00.000Z
- **Environment**: Node 22 | GitHub Actions Ubuntu-24.04 Runner & Windows 11
- **Status**: RESOLVED_WITH_EVIDENCE
- **Verification Gate**: VERIFIED

---

## 1. Context & Expected Behavior
The 24/7 autonomous multi-agent cloud harvester fleet (`multi-agent-fleet.mjs` running 9 worker agents) was expected to continuously consume URLs from `repos.txt`, perform zero-clone AST/commit audits via the GitHub REST API, format deep forensic learning dossiers in `07_PROJECT_LEARNING/`, promote universal rules into `05_KNOWLEDGE/engineering-patterns.md`, and commit results to `origin/main`.

## 2. Actual Behavior & Observed Symptoms
The GitHub Actions workflow executed repeatedly every 2-3 minutes with `success` status, but 0 bytes of new knowledge were generated. The runner skipped commits with:
```
ℹ️ No new knowledge files, rules, or queue targets were modified in this run (only timestamps/cursors). Skipping empty commit.
```
Simultaneously, `04_WORKFLOWS/factory-engine/sources-registry.json` repeatedly logged:
```
[Agent-Alpha:HARVEST_ERR] [WARN] Could not retrieve metadata for scrapy-plugins/scrapy-redis
[Agent-Beta:HARVEST_ERR] [WARN] Could not retrieve metadata for scrapy-plugins/scrapy-fake-useragent
```

## 3. Empirical Evidence
Investigation revealed that 9 URLs in `repos.txt` (Batch 17) were invalid, renamed, or returned `HTTP 404 Not Found` on GitHub (e.g., `scrapy-plugins/scrapy-redis` is actually `rmax/scrapy-redis`, `scrapy-plugins/scrapy-fake-useragent` is `alecxe/scrapy-fake-useragent`).
Because these repositories 404'd, `harvestGitHubZeroClone` returned `null`, and no dossier was written to `07_PROJECT_LEARNING/`.
Consequently, `isDeeplyHarvested(slug)` persistently returned `false`. On every subsequent cycle, `getTargetForWorker()` re-selected the exact same 9 broken repos as top priority unharvested targets, trapping the entire 9-agent fleet in an infinite loop.

## 4. Root Cause Analysis
**Poison-Pill Dead-Letter Loop**: The queue consumer lacked dead-letter filtration. When a target failed with an unrecoverable 404, it was neither marked as unharvestable in the queue nor skipped in `getTargetForWorker()`. It remained in the highest-priority "unharvested" backlog forever, starving all valid subsequent queue items.

## 5. Non-Destructive Invariant Fix
1. **Quarantine Dead Targets**: Added status check in `getTargetForWorker()` (`04_WORKFLOWS/factory-engine/multi-agent-fleet.mjs`):
   ```javascript
   if (entry?.harvestStatus === '404_OR_UNAVAILABLE' || entry?.harvestStatus === 'DEAD_OR_UNAVAILABLE') {
     continue;
   }
   ```
2. **Queue Cleansing & Replenishment**: Removed 9 broken URLs from `repos.txt` and replenished with 16 active, verified repositories (`rmax/scrapy-redis`, `tiangolo/fastapi`, `pallets/flask`, `fastify/fastify`, etc.).
3. **Self-Referential Meta-Learning**: Codified the invariant that AI-Builder-Brain itself must be treated as a learning source, harvesting its own incidents and architectural remediation into canonical knowledge.

## 6. Verification Outcome
Verified via `gh run list` and local dry-run simulation: all 9 agents immediately advanced past 404 targets and were assigned valid repositories (`webpack`, `rollup`, `cypress`, `webdriverio`, `fastapi`, `flask`, `express`).

## 7. Reusability Assessment
- **Is this potentially reusable across other projects?**: YES
- **Proposed Candidate Rule**: Rule 1669: Autonomous Fleet Poison-Pill Dead-Letter Quarantine & Self-Referential Meta-Learning Invariant

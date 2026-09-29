# Project Learning Record (Full-Spectrum Forensic Harvest): AI-Builder-Brain Factory Engine & Autonomous Harvester Optimization

> **Canonical Artifact**: `07_PROJECT_LEARNING/ai-builder-brain-factory-engine-learnings.md`  
> **Source Platform**: Local Master Brain System Refinement & Cloud Runner Hardening (`C:\AI-Builder-Brain`)  
> **Harvest Method**: Self-Reflective Forensic Harvest (Real Architectural Bugs, Local-Cloud Sync Desync, Cron Delays, API Rate Limits)  
> **Harvest Timestamp**: 2026-09-29T16:40:00.000Z  
> **Compliance State**: Verified Empirical Intelligence | Promoted to Rules 211–214  

---

## 1. Executive Forensic Architecture & System Mechanics
`AI-Builder-Brain` features an autonomous, multi-agent continuous harvesting pipeline designed to run 24/7 across both local developer environments and cloud server-to-server runners (GitHub Actions + Google Gemini Swarm). The architecture coordinates autonomous auto-discovery scouts, parallel domain workers, atomic git rebase-retry synchronizers, and zero-clone API extractors.

During operational stress testing and active pair-programming refinement, four critical architectural defect modes were uncovered, diagnosed, and remediated:
1. Multi-hour cloud schedule latency caused by standard `:00` cron queue congestion.
2. Local-versus-remote workspace desynchronization where 51 upstream intelligence records remained unreflected locally.
3. Shallow metadata extraction causing LLM reasoning dilution into generic 5KB summaries without real code diffs.
4. Sub-second burst requests triggering platform secondary rate-limits (abuse detection).

---

## 2. Forensic Incident & Learning Records

### Incident 1: Top-of-the-Hour (:00) Cron Schedule Congestion Trap in Multi-Tenant Cloud Runners (`BUG-ABB-01`)
* **Context**: `.github/workflows/24-7-cloud-harvester.yml#L6` — Cloud Cron Dispatcher.
* **What Was Expected**: The GitHub Actions runner was configured with `cron: '0 */2 * * *'` to execute every 2 hours continuously in the cloud.
* **What Actually Happened**: Instead of running strictly every 2 hours, executions suffered 5 to 6.5 hour delays (`20:20 UTC` -> `01:23 UTC` -> `07:44 UTC` -> `14:30 UTC`).
* **Evidence in Repo**: Commit logs on `origin/main` demonstrated that jobs were queuing for hours before runner allocation.
* **Root Cause**: Minute `:00` is the single most congested time slot on multi-tenant cloud schedulers worldwide. When millions of workflows trigger at `:00`, GitHub Actions queues and drops pending runs until peak load clears.
* **Remediation & Code Diff**:
  ```diff
  - on:
  -   schedule:
  -     - cron: '0 */2 * * *'
  + on:
  +   schedule:
  +     # Runs at minute 23 of every hour (Off-peak minute avoids GitHub :00 congestion)
  +     - cron: '23 * * * *'
  ```
* **Lesson**: *Cloud Cron Jitter & Off-Peak Dispatch Invariant*. Always assign scheduled workflows to off-peak, non-zero odd minutes (e.g. `23 * * * *` or `17 */2 * * *`) to bypass dispatcher traffic jams.
* **Promotion Decision**: Promoted as **Rule 211** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 2: Asynchronous Distributed Workspace Desynchronization & Stale Mirror State (`BUG-ABB-02`)
* **Context**: Git repository synchronization between GitHub Actions cloud agent and local IDE workspace (`c:\AI-Builder-Brain`).
* **What Was Expected**: The developer expects to open their local IDE and immediately observe recently harvested intelligence records.
* **What Actually Happened**: The cloud agent was actively harvesting and had pushed 51 commits to `origin/main`. However, because the local git branch was not automatically pulling in the background, the local workspace remained 16 hours out of date (`87d0c11`). From the user's perspective, it appeared as though the brain had stalled completely.
* **Evidence in Repo**: `git rev-list --count main..origin/main` returned 51 missing commits locally.
* **Root Cause**: Distributed dual-state architecture without an automated local fetch/pull on IDE boot or agent startup.
* **Remediation & Code Diff**:
  ```diff
  + // Enforce automatic rebase sync on agent session start
  + export function syncLocalWithCloud() {
  +   const out = run('git pull --rebase origin main');
  +   console.log(`[SYNC RESULT] ${out}`);
  + }
  ```
* **Lesson**: *Asynchronous Distributed Repository Convergence Invariant*. In multi-agent cloud-to-local systems, local workspaces must proactively fast-forward / rebase upstream changes upon session boot and report sync delta to developers.
* **Promotion Decision**: Promoted as **Rule 212** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 3: Shallow Metadata Summarization vs Deep Forensic Patch Grounding (`BUG-ABB-03`)
* **Context**: `04_WORKFLOWS/factory-engine/zero-clone-harvester.mjs` and `gemini-brain-agent.mjs`.
* **What Was Expected**: Full-spectrum intelligence extraction (25KB-35KB) containing real failure mechanics, exact file paths, line numbers, and before/after code blocks.
* **What Actually Happened**: Harvester collected only single-line commit titles and issue names. AI reasoning models given only titles were forced to generalize, producing 5KB superficial summaries without real code diffs or concrete root-cause post-mortems.
* **Evidence in Repo**: Comparing 5KB superficial records (`rustls-rustls-learnings.md`) against 30KB full-spectrum records (`diffusers-learnings.md`).
* **Root Cause**: Lack of empirical code grounding. Feeding metadata headlines rather than actual git patches (`files[].patch`) and issue developer discussions to the reasoning LLM.
* **Remediation & Code Diff**:
  ```diff
  + // Fetch real commit diffs and code patches
  + const commitDetail = await compliantFetch(`${target.apiUrl}/commits/${fix.fullSha}`);
  + const filesWithPatches = commitDetail.files.map(f => ({
  +   filename: f.filename,
  +   patchSnippet: f.patch.slice(0, 1500)
  + }));
  ```
* **Lesson**: *Empirical Code Diff Grounding Invariant for AI Forensic Extractors*. Autonomous extractors must supply real commit patches, before/after diffs, and core source code files to reasoning engines.
* **Promotion Decision**: Promoted as **Rule 213** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 4: Sub-Second Burst Requests Triggering Secondary API Abuse Limits (`BUG-ABB-04`)
* **Context**: `04_WORKFLOWS/factory-engine/zero-clone-harvester.mjs#L60-L105` — REST API Fetcher.
* **What Was Expected**: Smooth, continuous API harvesting across multiple files, commits, and issues.
* **What Actually Happened**: Fetching commit patches and issue comments in tight asynchronous loops fired 10-15 requests in milliseconds, triggering platform abuse detection (HTTP 403 secondary rate limit / 429) despite having ample remaining hourly token quota.
* **Evidence in Repo**: Rapid consecutive fetches risking secondary rate limit lockouts without polite pacing.
* **Root Cause**: Absence of inter-request pacing delays and lack of `Retry-After` header parsing.
* **Remediation & Code Diff**:
  ```diff
  + async function compliantFetch(url, customHeaders = {}) {
  +   await sleep(400); // Proactive inter-request pacing
  +   const res = await fetch(url, { headers });
  +   const retryAfter = res.headers.get('retry-after');
  +   if (retryAfter) {
  +     await sleep((parseInt(retryAfter, 10) + 1) * 1000);
  +   }
  +   return res;
  + }
  ```
* **Lesson**: *Proactive Inter-Request Pacing & Secondary Rate-Limit Invariant*. Always enforce mandatory inter-request delays (`sleep(300..500ms)`), honor `Retry-After` headers, and apply exponential backoff.
* **Promotion Decision**: Promoted as **Rule 214** in `05_KNOWLEDGE/engineering-patterns.md`.

---

## 3. 8-Dimensional Multi-Axis Forensic Deep Sweep
- **D1: Architecture & Structural Boundaries**: Decoupled multi-agent workers with targeted target-level lockfiles (`.harvest-locks/`).
- **D2: Asynchronous State & Concurrency Defense**: Atomic rebase-retry (`pushWithRebaseRetry`) ensures concurrent cloud and local commits never cause git merge collisions.
- **D3: Error Boundaries, Recovery & Rollback Protocols**: Rebase abort guards (`git rebase --abort`) preserve clean working trees if upstream conflicts emerge.
- **D4: Resource Lifecycle & Leak Defenses**: Immediate cleanup of temporary clones (`safeRemoveDir`) ensures 0 bytes retained on local disks.
- **D5: Boundary Deserialization, Schemas & Input Sanitization**: Overflow-checked parsing of rule numbers and JSON configs.
- **D6: Cross-Platform & Runtime Compatibility Gotchas**: Windows read-only attribute stripping (`attrib -r -s -h`) enables flawless directory deletion across Windows/POSIX.
- **D7: Build, CI/CD, Deployment & Tooling**: Off-peak cron scheduling (`23 * * * *`) eliminates GitHub Actions queue starvation.
- **D8: Concrete Bug Fixes & Forensic Patches**: Upgraded `zero-clone-harvester.mjs` and `batch-auto-harvester.mjs` to extract deep git patches and issue comments.

---

## 4. Net-New Universal Engineering Rules (Promoted to Master Brain)

### Rule 211: Cloud Cron Jitter & Off-Peak Dispatch Invariant
**RULE**: Never schedule automated cloud workflows, background maintenance runners, or cron jobs at the top of the hour (`:00`) or standard even half-hour marks (`:30`). Always assign scheduled intervals to off-peak, non-zero odd minutes (e.g., `23 * * * *`, `17 */2 * * *`).

### Rule 212: Asynchronous Distributed Repository Convergence Invariant
**RULE**: In distributed multi-agent systems where background cloud runners autonomously commit and push state to a shared remote Git repository, local development environments MUST execute an automatic fast-forward / rebase sync (`git pull --rebase origin main`) upon session boot and before local mutations.

### Rule 213: Empirical Code Diff Grounding Invariant for AI Forensic Extractors
**RULE**: Autonomous code inspection agents and learning harvesters MUST ground their reasoning in actual code patches (`git diff`, `patch`, line-level modifications) and developer post-mortems, NEVER solely in commit message titles or issue headlines.

### Rule 214: Proactive Inter-Request Pacing & Secondary Rate-Limit Invariant
**RULE**: Automated API extraction loops, crawlers, and repository harvesters MUST enforce proactive inter-request pacing delays (`sleep(300..500ms)`) between consecutive HTTP requests, inspect and obey platform `Retry-After` headers, and apply exponential backoff.

---

## 5. Actionable Implementation Checklist
- [x] Configure cloud cron schedules to off-peak odd minutes (`23 * * * *`).
- [x] Verify local git sync before diagnosing cloud runner activity.
- [x] Enforce real commit diff patch extraction in harvesting scripts.
- [x] Integrate proactive 400ms sleep in `compliantFetch` to avoid secondary rate limits.
- [x] Verify that all self-improvements are documented and promoted into Master Brain knowledge.

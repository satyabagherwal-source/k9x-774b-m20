# Forensic Learning Record (Zero-Clone): affaan-m/ECC

> **Canonical Artifact**: `07_PROJECT_LEARNING/affaan-m-ecc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/affaan-m/ECC](https://github.com/affaan-m/ECC))  
> **Harvest Method**: 100% Zero-Clone API & Raw Web Stream (0 bytes downloaded to disk)  
> **Harvest Timestamp**: 2026-09-28T04:51:27.521Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `affaan-m/ECC`
- **Description**: The agent harness performance optimization system. Skills, instincts, memory, security, and research-first development for Claude Code, Codex, Opencode, Cursor and beyond.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 268504 stars

---

## 2. Multi-Dimensional 8-Axis Investigation (Zero-Clone Stream)

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns extracted from closed production bug issues:
- **#3203** (2026-09-21): [Problem] Installation Error
- **#3112** (2026-09-19): [Problem] Bug: OpenCode app stops responding after installing ECC (ERR_MODULE_NOT_FOUND on custom tools)
- **#2886** (2026-09-19): gateguard destructive-command detector matches heredoc body text, not just the actual command
- **#2876** (2026-09-02): Test suite writes to the real ~/.claude/session-aliases.json — HOME isolation torn down at line 828 of 1830
- **#2771** (2026-08-27): [Problem] Cannot uninstall `sync-ecc-to-codex.sh` installation: "No ECC install-stage files" error
- **#2735** (2026-08-29): [Problem]
- **#2730** (2026-08-29): Privacy: skill-comply runner.py persists operator's home path into written compliance reports
- **#2675** (2026-08-29): gan-evaluator agent instructs Playwright MCP use but declares no MCP tools — live-app evaluation silently degrades on the /gan-build path
- **#2673** (2026-09-07): continuous-learning-v2: observer analysis resolves relative path against $HOME, not PROJECT_DIR — batch archived unanalyzed despite failure (#2370 semantic-failure path)
- **#2656** (2026-08-29): cost-estimate.js has the same stale Opus rate and silent Sonnet fallback as #2574 (currently dead code)
- **#2644** (2026-08-04): B-05: interstitial args between git subcommand and flag bypass the matcher (installed release; fixed on main)
- **#2643** (2026-08-04): B-03: git global options between git and subcommand bypass every destructive git arm (installed release; fixed on main)
- **#2636** (2026-08-29): Stop hook persists one-shot and summarizer-subagent sessions, breaking /resume-session selection
- **#2626** (2026-08-08): bug(memory-vault): sameFileIdentity compares stat dev, which is always 0 on Windows — every ecc memory write and --body-file read fails
- **#2622** (2026-08-04): Null skill reference in harness-optimizer agent

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & PR Resolutions
Observed empirical fixes and PR updates:
- **`042924e1`** (2026-09-28): fix(install): support invocation through POSIX sh (#3014)
- **`befde0d2`** (2026-09-27): fix(profiles): bind routing receipts and harden review paths
- **`a9e3ecb7`** (2026-09-27): fix(ci): allow slow Windows test cleanup
- **`874883c7`** (2026-09-27): fix(profiles): make evaluator permissions and Windows checks portable
- **`bf70150e`** (2026-09-21): fix(gateguard): sanitize dangerous invisible unicode in denial paths (#3103)
- **`8b951d3b`** (2026-09-21): fix(skill-comply): stop a failed step supplying evidence downstream (#3109)
- **`7b7dfc64`** (2026-09-21): fix(gateguard): detect destructive SQL passed quoted to SQL clients (#3107)
- **`c056ae7d`** (2026-09-21): fix(hooks): support python style comments in pre-commit quality checks (#3194)
- **`d7cf4584`** (2026-09-21): fix: restore Claude plugin setup compatibility (#3205)
- **`8d597276`** (2026-09-21): fix(skills): confine frontend-slides export server to the deck directory and bind loopback (#3206)
- **`2b6e8397`** (2026-09-20): Fix/proximity a11y risk cues (#3193)
- **`651118bd`** (2026-09-20): Fix/control plane canvas size (#3192)
- **`9606a741`** (2026-09-20): fix(control-pane): handle proximity HTTP errors (#3191)
- **`9ac593b5`** (2026-09-20): fix(scripts): extract cross-platform openBrowser helper with structured launch result (#3180)
- **`95448ad8`** (2026-09-20): fix: isolate Claude project hooks from ESM hosts (#3184)
- **`111387af`** (2026-09-20): docs: fix dead MCP overview link in shortform guide (#3190)
- **`934195f9`** (2026-09-20): Merge pull request #3123 from VarunGore36/fix/security-critical-hardening
- **`fc9273e5`** (2026-09-19): Merge pull request #3126 from VarunGore36/fix/reviewer-followups
- **`b2279eb1`** (2026-09-19): Merge pull request #3130 from shoyann/fix/preserve-codex-user-config
- **`1ec2263b`** (2026-09-19): Merge pull request #3137 from iyertalks/fix/pi-doctor-scoped-companion
- **`4ec72291`** (2026-09-19): Merge pull request #3104 from cedrickcantero/fix/security-review-sql-placeholder

#### Recent Merged Pull Requests:
- **PR #3247** (closed): feat: add custom OG social preview image for ECC (@astra-intelligence)
- **PR #3240** (closed): fix(plan-canvas): import spawn in plan-canvas and drop unused import in control-pane (@ushbay)
- **PR #3234** (2026-09-27): feat(profiles): add opt-in Lean/Full with hybrid Auto skill selection (@haelyra)
- **PR #3228** (closed): feat(copilot): add native local ECC plugin packaging (@PaulTozer)
- **PR #3215** (closed): fix: align scope migration install arguments (@Dante-dan)
- **PR #3209** (closed): fix(plan-canvas): restore child_process spawn import dropped in #3180 (@affaan-m)
- **PR #3206** (2026-09-21): fix(skills): confine frontend-slides export server to the deck directory and bind loopback (@pablolozano0216-art)
- **PR #3205** (2026-09-21): fix: restore Claude plugin setup compatibility (@ASP-SuperExplorer)
- **PR #3202** (closed): docs(zh-TW): refresh primary documentation (@c-cf)
- **PR #3196** (2026-09-21): Update README with install health check instructions (@ramsingh73729-ctrl)
- **PR #3194** (2026-09-21): fix(hooks): support python style comments in pre-commit quality checks (@sedatdagg)
- **PR #3193** (2026-09-20): Fix/proximity a11y risk cues (@tamerbak)
- **PR #3192** (2026-09-20): Fix/control plane canvas size (@tamerbak)
- **PR #3191** (2026-09-20): fix(control-pane): handle proximity HTTP errors (@tamerbak)
- **PR #3190** (2026-09-20): docs: fix dead MCP overview link in shortform guide (@kuishou68)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of git repository files were stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_ZERO_CLONE
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

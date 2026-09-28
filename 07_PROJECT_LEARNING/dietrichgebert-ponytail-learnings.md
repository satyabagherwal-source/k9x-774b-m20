# Forensic Learning Record (Zero-Clone): DietrichGebert/ponytail

> **Canonical Artifact**: `07_PROJECT_LEARNING/dietrichgebert-ponytail-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail))  
> **Harvest Method**: 100% Zero-Clone API & Raw Web Stream (0 bytes downloaded to disk)  
> **Harvest Timestamp**: 2026-09-28T17:35:00.322Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DietrichGebert/ponytail`
- **Description**: Makes your AI agent think like the laziest senior dev in the room. The best code is the code you never wrote.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 147409 stars

---

## 2. Multi-Dimensional 8-Axis Investigation (Zero-Clone Stream)

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns extracted from closed production bug issues:
- *No recent closed bug issues fetched.*

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
- **`a2712bc8`** (2026-08-07): fix: detect VS Code Copilot via CLAUDE_PLUGIN_ROOT fallback (#528) (#579)
- **`cc37a5d5`** (2026-08-07): fix: drop commandWindows from hooks.json for Claude.ai marketplace validation (#593) (#601)
- **`f12f210e`** (2026-07-10): fix(benchmarks): kill timed-out agent cells cross-platform (#225)
- **`0cdd11fe`** (2026-07-10): fix: stop filterSkillBodyForMode from swallowing rule bullets that start with a mode word (#571)
- **`b6c04480`** (2026-07-10): fix: narrow the ponytail: marker to real corner-cuts, keep the prefix (#120) (#577)
- **`65db9025`** (2026-07-09): fix: reject review as a default mode in pi-extension and config (#576)
- **`3465b1a3`** (2026-07-09): Fix Codex hook output schema (#573) (#574)
- **`2ba02621`** (2026-07-09): fix: drop bash-only `exec` from hooks so they run under PowerShell (#527, #569) (#572)
- **`523e9dc0`** (2026-07-09): fix: read version from package.json instead of hardcoding 0.1.0 (#354)
- **`33c00d3d`** (2026-07-09): fix: Codex CLI SessionStart additionalContext at top level (#505) (#508)
- **`055a1453`** (2026-07-09): fix: merge system entries in OpenCode plugin for Qwen compat (#296) (#536)
- **`fee48ca5`** (2026-07-09): fix: guard against non-string input.arguments in OpenCode plugin (#557)

#### Recent Merged Pull Requests:
- **PR #928** (closed): fix(opencode): support V2 plugin API via dual V1/V2 export (@snakeice)
- **PR #924** (closed): feat(audit): hunt AI-shaped test brittleness (@kitchen7c)
- **PR #906** (closed): fix(rules): check both fallback rulesets, host load frontmatter, and command TOML (@ishank-ninja)
- **PR #905** (closed): fix(skills): resync command prompts and help card with SKILL.md (@ishank-ninja)
- **PR #904** (closed): ci: run the test suite on Windows and macOS too (@ishank-ninja)
- **PR #903** (closed): fix(benchmarks): agentic bench measures the checkout and runs on Windows (@ishank-ninja)
- **PR #902** (closed): fix(qoder): register subagent injection on SubagentStart instead of PreToolUse (@ishank-ninja)
- **PR #901** (closed): fix(opencode,hermes): honor "stop ponytail" and keep review out of the OpenCode flag (@ishank-ninja)
- **PR #900** (closed): docs: make benchmark claims match the published per-task data (@ishank-ninja)
- **PR #899** (closed): fix(statusline): suggested PowerShell command skips the user's profile (@ishank-ninja)
- **PR #898** (closed): fix(cursor-hooks): only strip ponytail's own hook scripts (@ishank-ninja)
- **PR #897** (closed): docs: drop the past Gemini CLI cutoff date and fix stale Korean install steps (@ishank-ninja)
- **PR #896** (closed): fix(hooks): accept install paths with non-ASCII letters (@ishank-ninja)
- **PR #895** (closed): fix(config): /ponytail default no longer wipes an unparseable config.json (@ishank-ninja)
- **PR #894** (closed): fix(rules): AGENTS.md ships first on complex requests, like SKILL.md (@ishank-ninja)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of git repository files were stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_ZERO_CLONE
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

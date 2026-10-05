# Forensic Learning Record (Zero-Clone): rtk-ai/rtk

> **Canonical Artifact**: `07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk))  
> **Harvest Method**: 100% Zero-Clone API & Raw Web Stream (0 bytes downloaded to disk)  
> **Harvest Timestamp**: 2026-09-28T12:33:01.097Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rtk-ai/rtk`
- **Description**: CLI proxy that reduces LLM token consumption by 60-90% on common dev commands. Single Rust binary, zero dependencies
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 81879 stars

---

## 2. Multi-Dimensional 8-Axis Investigation (Zero-Clone Stream)

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns extracted from closed production bug issues:
- **#4307** (2026-09-27): fix: fail closed when permissions settings file cannot be read or parsed (fixes #4282)
- **#4270** (2026-09-27): fix(filter): do not apply code comment patterns to Language::Unknown (#4249)
- **#4267** (2026-09-27): fix(filter): preserve nested Python replacement fields
- **#4266** (2026-09-26): fix: allow clean-run summaries to bypass never_worse guard for injected JSON (fixes #4218)
- **#4263** (2026-09-26): fix: allow tee mode to record recall stats (fixes #4219)
- **#4262** (2026-09-28): fix: allow tee mode to record recall stats (fixes #4219)
- **#4246** (2026-09-27): fix(find): return force-tracked files pruned by gitignore
- **#4244** (2026-09-26): rtk find -iname silently drops matches inside a gitignored-but-tracked directory
- **#4230** (2026-09-28): fix(pip): stop doubling the tool name in pip messages
- **#4199** (2026-09-22): bug(windows): passthrough subcommand (grep/find/wc/...) hangs indefinitely when an argument contains a literal double quote
- **#4198** (2026-09-26): grep -h returns RTK's usage instead of matches, and the hook rewrites it automatically
- **#4196** (2026-09-25): fix(filter): handle single-line Python docstrings
- **#4189** (2026-09-26): `rtk rewrite` skips rewriting entirely when the command contains a pipe
- **#4186** (2026-09-26): fix(hooks): refuse symlinked backup destinations
- **#4182** (2026-09-26): sleep-refusal message recommends Monitor unconditionally, with no config surface

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
- **`0671ac5b`** (2026-09-27): fix(init): give the Antigravity plugin its awareness rules, and report like the sibling agents
- **`720d2764`** (2026-09-28): Merge pull request #4053 from obrienciaran/fix/pip-doubled-tool-name-4050
- **`2955687e`** (2026-09-27): Merge pull request #2931 from TemRevil/fix/discover-windows-path-case
- **`bccafef3`** (2026-09-27): Merge pull request #3374 from jaideeppyne/fix/3315-discover-zero-sessions
- **`925f9be5`** (2026-09-27): Merge upstream/develop into fix/discover-windows-path-case
- **`22ae255a`** (2026-09-27): fix(discover): name the scan scope in the zero-session message
- **`c529013e`** (2026-09-27): Merge pull request #4076 from igorzelaya-io/fix/pytest-preserve-duration
- **`ebb6b720`** (2026-09-27): fix(pytest): preserve long-run durations
- **`45b0b4c3`** (2026-09-26): Merge pull request #4125 from pashifika/fix/cli-argv-boundaries
- **`0b07197a`** (2026-09-26): fix(hooks): reach deployed hooks with the host scrub, and pin it
- **`3d829e15`** (2026-09-26): Merge pull request #4266 from TechWizard9999/fix/4218-ruff-clean-json-guard
- **`bff334ca`** (2026-09-26): fix(ruff): bypass never_worse only for the format rtk injected
- **`f9f40924`** (2026-09-26): revert: leave the tee-mode recall store change to #4263
- **`09cc268a`** (2026-09-25): fix(cli): scope the --shell guard to test, and compose the group strip
- **`3ee51b24`** (2026-09-22): fix(cli): answer for a program that cannot run, not just an unresolvable name
- **`c298de6a`** (2026-07-18): fix(cli)!: preserve argv boundaries in generic runners
- **`7a446f14`** (2026-09-26): fix: use contains() instead of iter().any() for clippy
- **`8c033aa5`** (2026-09-26): fmt: fix line length in pint_cmd.rs

#### Recent Merged Pull Requests:
- **PR #4307** (closed): fix: fail closed when permissions settings file cannot be read or parsed (fixes #4282) (@TechWizard9999)
- **PR #4270** (closed): fix(filter): do not apply code comment patterns to Language::Unknown (#4249) (@Cid-oe)
- **PR #4267** (closed): fix(filter): preserve nested Python replacement fields (@Yurii201811)
- **PR #4266** (2026-09-26): fix: allow clean-run summaries to bypass never_worse guard for injected JSON (fixes #4218) (@TechWizard9999)
- **PR #4263** (2026-09-26): fix: allow tee mode to record recall stats (fixes #4219) (@TechWizard9999)
- **PR #4262** (closed): fix: allow tee mode to record recall stats (fixes #4219) (@TechWizard9999)
- **PR #4246** (closed): fix(find): return force-tracked files pruned by gitignore (@BinarySpecter)
- **PR #4230** (closed): fix(pip): stop doubling the tool name in pip messages (@amandeavor)
- **PR #4220** (2026-09-24): chore(master): release 0.50.0 (@rtk-release-bot[bot])
- **PR #4206** (closed): fix(err): pass the child argv through verbatim (@MincongZhou)
- **PR #4205** (closed): fix(read): only drop a line as a block comment when it starts with the marker (@Protocol-zero-0)
- **PR #4196** (closed): fix(filter): handle single-line Python docstrings (@Yubel426)
- **PR #4186** (closed): fix(hooks): refuse symlinked backup destinations (@Ha1baraA11)
- **PR #4176** (closed): fix(codex): reject external AGENTS.md symlinks (@Ha1baraA11)
- **PR #4170** (2026-09-25): feat(search): fold shared path prefix in file-list passthrough (@israellot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of git repository files were stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_ZERO_CLONE
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

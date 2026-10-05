# Forensic Learning Record (Zero-Clone): herdrdev/herdr

> **Canonical Artifact**: `07_PROJECT_LEARNING/herdrdev-herdr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/herdrdev/herdr](https://github.com/herdrdev/herdr))  
> **Harvest Method**: 100% Zero-Clone API & Raw Web Stream (0 bytes downloaded to disk)  
> **Harvest Timestamp**: 2026-09-28T16:34:27.062Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `herdrdev/herdr`
- **Description**: the runtime your coding agents live on
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 41205 stars

---

## 2. Multi-Dimensional 8-Axis Investigation (Zero-Clone Stream)

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns extracted from closed production bug issues:
- **#4630** (2026-09-25): SGR mouse tails become shell input after focus switch (Windows Terminal to SSH to Linux, v0.9.1)
- **#4601** (2026-09-26): API listener dies on a single transient accept error; CLI and live handoff unreachable while server and panes keep running
- **#4581** (2026-09-25): Linux/Ghostty: Ctrl+Shift+C reaches pane apps as bare Ctrl+C
- **#4507** (2026-09-24): Codex 0.155.1 can be reported idle during sentence-style active output
- **#4494** (2026-09-22): Linux: pasted text loses bracketed paste markers when attached over SSH from Windows Terminal (multiline paste submits Claude Code at first newline)
- **#4477** (2026-09-22): SSH session: multi-paragraph paste into Claude Code pane splits across several submissions (0.9.1)
- **#4470** (2026-09-23): Windows: Ctrl+Win opens prefix mode when prefix is ctrl+space
- **#4446** (2026-09-26): herdr plugin install --help usage syntax contradicts actual CLI behavior
- **#4430** (2026-09-21): Eligible herdr-plugin repository is missing from the marketplace index
- **#4393** (2026-09-20): session attach <new-name> creates a session as a side effect, then panics without a TTY (exit 101)
- **#4369** (2026-09-28): 0.9.1: early host color replies leave pane OSC 10/11 queries unanswered
- **#4344** (2026-09-18): events.subscribe: one unknown pane fails the whole subscription, and the response id is not the request id
- **#4333** (2026-09-18): Grok 1.0.34 idle panes stay working when OSC title does not end with grok
- **#4326** (2026-09-23): 0.9.0-preview.2026-09-16: clicking a space in the left sidebar no longer switches workspace (Windows)
- **#4320** (2026-09-20): 0.9.0: reboot can still clear session when SIGHUP becomes exit code 1

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
- **`d5680d84`** (2026-09-28): fix: capture Windows host default colors at startup (#4710)
- **`8c8cb49c`** (2026-09-28): fix(windows): read agent command lines without PROCESS_VM_READ (#4708)
- **`7f89b11a`** (2026-09-28): feat: support multiple prefix keys (#4653)
- **`0d5d6f1f`** (2026-09-27): test: fix pane shell idle foreground-command race (#4691)
- **`2527eed2`** (2026-09-27): fix: make release test robust to diff.noPrefix git config (#4663)
- **`c210c953`** (2026-09-27): fix: bound external event batches in the server loop (#4671)
- **`25aaa0b7`** (2026-09-27): fix: keep offscreen kitty images loaded instead of resending them on scroll (#4686)
- **`bde45262`** (2026-09-26): fix: keep api listener alive after transient accept errors (#4659)
- **`bd69871d`** (2026-09-26): fix: refresh host palette on terminal redraw (#4349)
- **`c34dd6b2`** (2026-09-26): fix: create a symlink on non-elevated windows in docs test (#4654)
- **`804a4aaf`** (2026-09-26): fix: crop kitty images around overlays instead of hiding them (#4652)
- **`81ddfc65`** (2026-09-26): fix: accept plugin install options before the repository (#4453)
- **`7184be49`** (2026-09-25): fix: retain mouse input grace for split csi prefixes (#4636)
- **`21d0ce60`** (2026-09-25): fix: preserve shift on ctrl+shift+letter for legacy panes (#4597)
- **`8d95e9bd`** (2026-09-24): fix: keep copy mode active during projection updates (#4281)

#### Recent Merged Pull Requests:
- **PR #4713** (closed): fix: submit agent prompts with a settled follow-up enter (@shuber-ai)
- **PR #4711** (2026-09-28): perf: send scrolling pane output as row shifts and skip blank cells (@ogulcancelik)
- **PR #4710** (2026-09-28): fix: capture Windows host default colors at startup (@JJLiebig)
- **PR #4708** (2026-09-28): fix(windows): read agent command lines without PROCESS_VM_READ (@JJLiebig)
- **PR #4706** (closed): fix(detect): recognize bootstrap -c launcher wrapped Hermes agent (@MossSpace)
- **PR #4705** (closed): fix: use launch_executable for tab bar command bin path (@ericcurtin)
- **PR #4694** (closed): fix: attribute codex sessions by turn timing instead of hook pane (@ogulcancelik)
- **PR #4693** (closed): fix(shell): prevent agent scrollbar from intercepting sidebar toggle click (@DebGit96)
- **PR #4691** (2026-09-27): test: fix pane shell idle foreground-command race (@JJLiebig)
- **PR #4687** (2026-09-27): feat: let agents report their own resume command (@ogulcancelik)
- **PR #4686** (2026-09-27): fix: keep offscreen kitty images loaded instead of resending them on scroll (@ogulcancelik)
- **PR #4685** (2026-09-27): feat: accept mouse events on terminal session control (@ogulcancelik)
- **PR #4678** (2026-09-27): feat: default machine add label to the ssh host (@dhh)
- **PR #4672** (2026-09-27): perf: skip frame clones for unchanged retained graphics (@minatoaquaMK2)
- **PR #4671** (2026-09-27): fix: bound external event batches in the server loop (@minatoaquaMK2)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of git repository files were stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_ZERO_CLONE
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

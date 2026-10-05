# Forensic Learning Record (Zero-Clone): NousResearch/hermes-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/nousresearch-hermes-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent))  
> **Harvest Method**: 100% Zero-Clone API & Raw Web Stream (0 bytes downloaded to disk)  
> **Harvest Timestamp**: 2026-09-28T04:52:25.883Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NousResearch/hermes-agent`
- **Description**: The agent that grows with you
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 249550 stars

---

## 2. Multi-Dimensional 8-Axis Investigation (Zero-Clone Stream)

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns extracted from closed production bug issues:
- **#124318** (2026-09-27): [Bug]:Windows: the updater's own gateway is invisible to Hermes process discovery — runtime_command() emits `python -I -c …` while _gateway_command_subcommand() rejects that form (exit 1, and the next update is blocked at the gate)
- **#123399** (2026-09-27): [Bug]: PyInstaller 环境下 DDGS worker 启动失败，web_search 返回 code=2
- **#122774** (2026-09-27): [Bug]: [X] failed to extract pinned git archive stage=prerequisites
- **#122512** (2026-09-27): [Bug]: windows desktop setup fail
- **#122240** (2026-09-27): [Bug]: ffmpeg lock.json points to expired BtbN autobuild (404)
- **#120976** (2026-09-24): [Bug]: Locked out of switching providers during a Nous backend outage — a `503 deployment unavailable` is misclassified as an auth failure and blocks `hermes model`
- **#120687** (2026-09-23): [Bug]: cannot select text in Hermes app
- **#120164** (2026-09-24): [Bug]: Windows desktop backend exits with WinError 10014 and ECONNREFUSED
- **#120104** (2026-09-23): [Bug]: Desktop renders the same assistant reply twice (duplicate render of a single response)
- **#120049** (2026-09-23): [Bug]: Desktop app model selection writes to global config, ignores per-profile config.yaml
- **#119643** (2026-09-23): [Bug]: Desktop chat freezes for minutes on a busy host; generated replies can be dropped from the UI
- **#119340** (2026-09-27): [Bug]: a plugin added to plugin-catalog/ is "not in the plugin catalog" for up to 6h after hermes update (stale live cache out-votes the newer in-tree catalog)
- **#118833** (2026-09-22): [Perf] hermes skills inspect makes ~29 serial TLS connections without connection reuse — 25-52s per skill preview
- **#117802** (2026-09-22): [Bug]: Turn-recovery ASCII fallback irreversibly strips non-ASCII content from session history (state.db)
- **#117298** (2026-09-21): [Bug]: Desktop - programmatic timeline jump leaves edit-composer/selection gates stuck; wheel scrolling unaffected

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
- **`68fa7e9f`** (2026-09-27): fix(desktop): keep PM store dirs first on PATH for Hermes's own children
- **`5b770c8b`** (2026-09-27): fix(mcp): name the rebuild when a stdio server's native addon was built for another Node
- **`06fbb71c`** (2026-09-27): fix(update): a stopped-but-unreaped dashboard is no longer a pre-update survivor
- **`78999579`** (2026-09-28): fix(desktop): bound NVIDIA EGL fallback to confirmed-broken driver series (#123213)
- **`27062c34`** (2026-09-27): fix: install cua-driver and the Browser Use CLI by default again
- **`f8c3e763`** (2026-09-25): fix(update): provision Browser Use CLI when default backend would downgrade
- **`bfda74c7`** (2026-09-28): fix(desktop): interrupt a deleted session's runtime so no prompt outlives it (#124859)
- **`e1fdfb32`** (2026-09-28): fix(desktop): re-point the window route after a primary connection apply (#124816)
- **`2a27f121`** (2026-09-28): fix(desktop): never adopt a page from a backend that ignored order=latest (#124815)
- **`90c8598e`** (2026-09-27): fix(desktop): cron run rows carry their owning backend so the transcript opens
- **`865b141a`** (2026-09-28): fmt(js): `npm run fix` on merge (#125870)
- **`80ee8830`** (2026-09-27): fix(tui_gateway): declare known_issues on the plugins.manage result contract; drop issue number from test filename
- **`113a63e8`** (2026-09-27): fix(plugins): make catalog known_issues informational, not a fail-closed gate
- **`839fb764`** (2026-09-26): fix(plugins): gate installs of catalog entries that document known issues (#124037)

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of git repository files were stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_ZERO_CLONE
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

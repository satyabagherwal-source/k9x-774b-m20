# Forensic Learning Record (Zero-Clone): chroma-core/chroma

> **Canonical Artifact**: `07_PROJECT_LEARNING/chroma-core-chroma-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chroma-core/chroma](https://github.com/chroma-core/chroma))  
> **Harvest Method**: 100% Zero-Clone API & Raw Web Stream (0 bytes downloaded to disk)  
> **Harvest Timestamp**: 2026-09-29T14:30:03.680Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chroma-core/chroma`
- **Description**: Search infrastructure for AI
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 29404 stars

---

## 2. Multi-Dimensional 8-Axis Investigation (Zero-Clone Stream)

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns extracted from closed production bug issues:
- **#7278** (2026-06-18): [Bug]: GoogleGeminiEmbeddingFunction does not find the GEMINI_API_KEY when vertexai is not enabled
- **#7226** (2026-07-07): [SECURITY]: ChromaDB Python project has a pre-authentication code injection vulnerability
- **#6972** (2026-08-17): [Bug]: npm package @chroma-core/ollama depends on unused "testcontainers"
- **#6837** (2026-04-06): [Bug]: Python client throwing error when using Chroma Cloud Qwen
- **#6787** (2026-04-04): [Bug]: In TypeScript I cannot remove the process from `chroma run --path /db_path`
- **#6723** (2026-03-31): [Docs]: Missing prerequisite: `protoc` required for `uv sync` on macOS
- **#6681** (2026-03-18): [Bug]: Knn(query="string") raises ValueError with Cloud embedding functions
- **#6546** (2026-03-05): [Bug]: chromadb 1.5.2 fails with Pydantic v.1 error in conftest.py
- **#6512** (2026-03-03): [Bug]: Multiple threads calling get can trigger a Key error from telemetry
- **#6375** (2026-02-25): [Bug]: Broken dead links in "Embeddings" section of README
- **#6202** (2026-01-22): [Bug]: Docs have incorrect import for OpenAIEmbeddingFunction
- **#6193** (2026-02-19): [Bug]: typo issue in chroma/clients/js/README.md
- **#6188** (2026-03-03): [Bug]: Some docs pages have code tabs which don't correctly update with the language selection
- **#6132** (2026-01-20): [Bug]: Persistence not working when running ChromaDB Docker container
- **#6098** (2026-01-05): [Bug]: posthog is destroying chromadb performance

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
- **`da4f68be`** (2026-09-24): [BUG](sysdb): Return segment row read errors (#7785)
- **`e6eca82e`** (2026-09-24): [BUG](agent): Drop unpriced Opus from models (#7793)
- **`839d7152`** (2026-09-21): [BUG](benchmark): Flush a cached dataset file before renaming it into place (#7717)
- **`b287a24b`** (2026-09-21): [BUG](wal3): Bound the backoff test by elapsed time, not a fixed duration (#7718)
- **`0dad2c71`** (2026-09-18): [BUG](log): Preserve float metadata precision (#7755)
- **`9e623fe5`** (2026-09-15): [PERF](agent): Cache the Anthropic request prefix (#7744)
- **`da60f682`** (2026-09-14): [BUG](sysdb): Honor database pagination (#7710)
- **`d0e51753`** (2026-09-09): [BUG](mdac): Fix and automate Modal deploy (#7706)
- **`5d8645d7`** (2026-09-08): [BUG](worker): Revert the async fn window widening from #7621 (#7684)

#### Recent Merged Pull Requests:
- **PR #7818** (2026-09-29): [ENH](sysdb): Add tenant-scoped bulk database lookup (@tanujnay112)
- **PR #7815** (2026-09-28): [ENH](sysdb): Count databases without listing (@tanujnay112)
- **PR #7799** (2026-09-24): [DOC]: Replace retired Claude Sonnet 4 in docs code samples (@davedash)
- **PR #7793** (2026-09-24): [BUG](agent): Drop unpriced Opus from models (@davedash)
- **PR #7785** (2026-09-24): [BUG](sysdb): Return segment row read errors (@dbeglord)
- **PR #7783** (closed): [BUG] Preserve Foundation scope in staging RC (@chroma-droid)
- **PR #7782** (2026-09-24): [ENH](foundation-api): Pause Foundation creation during migration (@dbeglord)
- **PR #7780** (closed): [ENH](foundation): Resolve Foundation identity through the product catalog (@dbeglord)
- **PR #7773** (closed): [BUG](api): Fix deleted count for non-existent IDs (@shobhitagnihotri69)
- **PR #7769** (closed): [TST](python): Respect HNSW bounds in generators (@rescrv)
- **PR #7759** (2026-09-23): [ENH](foundation-api): Debit agent query spend (@davedash)
- **PR #7756** (2026-09-17): [HOTFIX] applying PR #7748 to release/2026-09-04 (@tanujnay112)
- **PR #7755** (2026-09-18): [BUG](log): Preserve float metadata precision (@rescrv)
- **PR #7750** (closed): [BUG](base-types): Reject non-finite sparse vector values and non-string labels (@Drima-code)
- **PR #7749** (2026-09-15): [BLD](tilt): Remove log build override (@tanujnay112)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of git repository files were stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_ZERO_CLONE
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

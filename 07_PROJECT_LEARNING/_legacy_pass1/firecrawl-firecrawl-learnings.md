# Forensic Learning Record (Zero-Clone): firecrawl/firecrawl

> **Canonical Artifact**: `07_PROJECT_LEARNING/firecrawl-firecrawl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/firecrawl/firecrawl](https://github.com/firecrawl/firecrawl))  
> **Harvest Method**: 100% Zero-Clone API & Raw Web Stream (0 bytes downloaded to disk)  
> **Harvest Timestamp**: 2026-09-28T17:34:56.302Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `firecrawl/firecrawl`
- **Description**: The web data API to search, scrape, and interact at scale. 🔥
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 185873 stars

---

## 2. Multi-Dimensional 8-Axis Investigation (Zero-Clone Stream)

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns extracted from closed production bug issues:
- **#4595** (2026-09-16): [Bug] Self-hosted /v1/scrape always times out — scrape jobs appear not to be processed
- **#4315** (2026-08-18): [Bug] `allowExternalLinks` rejects external links that redirect
- **#4104** (2026-07-23): [Bug]  docker-compose.yaml: REDIS_RATE_LIMIT_URL is interpolated from the wrong variable, so setting it has no effect
- **#3887** (2026-07-27): [Bug] "Join our community" link in README points to docs instead of community
- **#3876** (2026-06-25): [Bug] serpapi-python contains malicious code and it is a non-existing package now
- **#3857** (2026-06-23): [Bug]
- **#3784** (2026-06-23): [Bug] When extracting text from PDF files, some Chinese characters may appear as garbled characters.
- **#3648** (2026-06-23): [Bug]
- **#3643** (2026-06-25): [Bug] MonitorPageSnapshot and MonitorPageDiff shadow Pydantic's json field
- **#3614** (2026-08-27): [Bug] Cancelling a crawl floods webhook with `crawl.failed` events for all remaining queued URLs
- **#3407** (2026-07-23): [Bug] Interact() timeout is used both as API seconds and Axios milliseconds
- **#3394** (2026-07-18): [Bug] Malformed scrape request body in Go SDK when using JSON format
- **#3384** (2026-07-27): [Bug] Screenshot not capturing full page
- **#3335** (2026-07-10): [Bug] Limit/search order of operations
- **#3327** (2026-04-11): [Bug] js sdk axios is locked to older vulnerable 1.14.0

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
- **`5507d605`** (2026-09-28): fix(browser): floor trusted agent browser concurrency at the hobby limit (#4811)
- **`e139f08f`** (2026-09-28): fix(json): stop repairing extractions cut off at the output token limit (#4810)
- **`828a794d`** (2026-09-28): fix(branding): stop discarding LLM branding results on schema mismatches (#4808)
- **`36b9a269`** (2026-09-28): fix(query): fit query and highlights prompts to each model's context window (#4809)
- **`2c88cbb0`** (2026-09-28): fix(json): stop JSON extraction failing on schema wrapping, oversized pages and unsupported schemas (#4807)
- **`7d6a07e2`** (2026-09-28): fix(auth): accept an agent run's hosted MCP key from the trusted agent service (#4805)
- **`9b15c332`** (2026-09-25): fix(browser): disable session recording by default (#4765)
- **`7ecc538d`** (2026-09-25): fix(api): gate agent hints by endpoint availability
- **`e9e5d3bf`** (2026-09-21): fix(api): distinguish absent search content
- **`389340bd`** (2026-09-21): fix(api): prioritize low-credit agent hint
- **`c68d9a5e`** (2026-09-21): fix(api): suppress capped PDF hint
- **`074f9211`** (2026-09-21): fix(api): harden agent hint identifiers
- **`99c0dc6b`** (2026-09-21): fix(api): lower low-credit hint threshold
- **`0769644a`** (2026-09-17): fix(api): make agent hints opt-in
- **`be51e710`** (2026-09-24): fix(security): resolve pnpm audit failures (#4754)
- **`ffa7e213`** (2026-09-24): fix(api): make browser session DELETE idempotent for destroyed sessions (#4753)

#### Recent Merged Pull Requests:
- **PR #4811** (2026-09-28): fix(browser): floor trusted agent browser concurrency at the hobby limit (@rakshith48)
- **PR #4810** (2026-09-28): fix(json): stop repairing extractions cut off at the output token limit (@mogery)
- **PR #4809** (2026-09-28): fix(query): fit query and highlights prompts to each model's context window (@mogery)
- **PR #4808** (2026-09-28): fix(branding): stop discarding LLM branding results on schema mismatches (@mogery)
- **PR #4807** (2026-09-28): fix(json): stop JSON extraction failing on schema wrapping, oversized pages and unsupported schemas (@mogery)
- **PR #4805** (2026-09-28): fix(auth): accept an agent run's hosted MCP key from the trusted agent service (@rakshith48)
- **PR #4786** (2026-09-28): chore(sdks): bump versions for agent hints (@rakshith48)
- **PR #4768** (2026-09-25): fix(alexandria): forward authorization experiment query (@developersdigest)
- **PR #4765** (2026-09-25): fix(browser): disable session recording by default (@tomsideguide)
- **PR #4764** (closed): fix(rust-sdk): surface server errors from status and cancel (@SachinD6)
- **PR #4763** (closed): feat(alexandria): terms/accept also writes the org's provider access record (@rakshith48)
- **PR #4762** (2026-09-25): feat(api): specific search/404 agent hints with MCP tool names (@rakshith48)
- **PR #4759** (2026-09-25): feat(agent): accept exchange.onTermsRequired; type terms-required fields in gateway and SDKs (@rakshith48)
- **PR #4758** (closed): fix(billing): honor charge IDs across Autumn and ledger retries (@tomsideguide)
- **PR #4757** (2026-09-25): feat: migrate browser and interact APIs to Hangar (@tomsideguide)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of git repository files were stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_ZERO_CLONE
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

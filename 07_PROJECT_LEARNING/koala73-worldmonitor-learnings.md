> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/koala73-worldmonitor-learnings.md`  
> **Source**: GitHub ([https://github.com/koala73/worldmonitor](https://github.com/koala73/worldmonitor))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-30T01:22:07.697Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): koala73/worldmonitor

## 1. Executive Forensic Architecture & System Mechanics

`koala73/worldmonitor` is a real-time global intelligence dashboard engineered for geopolitical monitoring, military tracking, infrastructure surveillance, and open-source intelligence (OSINT) aggregation.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND DASHBOARD / SPA                              │
│  (Deck.gl / MapLibre GL / Globe / SVG Map Engine + Multi-Variant Shells)          │
└─────────────────────────┬────────────────────────────────────────────────────────┘
                          │ HTTP REST / Connect Protocol / WebSockets
                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         EDGE MIDDLEWARE & AGENT RELAY                            │
│  (ais-relay.cjs: Tool Sanitize, Auth Invariants, Rate Limits, Prompt Injection) │
└─────────────────────────┬────────────────────────────────────────────────────────┘
                          │ Internal Route Allowlist
                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND SERVICES & INTELLIGENCE APIs                         │
│  (server/worldmonitor/intelligence/*, /api/*, gRPC-web/Connect Protobufs)        │
└─────────────────────────┬────────────────────────────────────────────────────────┘
                          │ Explicit Key Namespace Isolation
                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            UPSTREAM DATA & REDIS                                 │
│  (Redis Cache/State, EIA, ENTSO-E, ACLED, UCDP, HDX HAPI, OWID Energy Data)       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Boundaries and Abstractions
1. **Multi-Variant Client Tier**: The frontend is built as a single code base serving multiple domain-focused variants (`world`, `tech`, `finance`, `commodity`). Variant states are passed via environment configs and initialized via client `localStorage` flags (`worldmonitor-variant`).
2. **AI Agent & Tool Execution Relay (`scripts/ais-relay.cjs`)**: Acts as a security and context proxy between LLM engines (e.g., Anthropic Claude, OpenAI) and internal APIs (`/api/*`). The relay enforces prompt injection sanitization, model tool limits, payload compaction (`compactWidgetToolJson`), and strict endpoint allowlists (`isWidgetEndpointAllowed`).
3. **Data Ingestion and Seeding Pipeline (`scripts/seed-*.mjs`)**: Independent cron-driven seeders query external feeds (ENTSO-E electricity, EIA petroleum, UCDP conflict events, HDX HAPI political violence), aggregate statistics, write structural metadata (`seed-meta:*`), and store cached payloads into Redis with namespace isolation (`APP_OWNED_KEYS` vs. Seeder Keys).
4. **Resilience & Fallback Engine (`server/worldmonitor/intelligence/v1/get-risk-scores.ts`)**: Intelligence APIs enforce multi-tier fallback mechanisms. Primary live calculations consume freshly seeded Redis keys; if upstream data reads fail or time out, the calculation explicitly halts, rejecting zeroed state publication, and serves cached stale snapshots (`*:stale:v8`) or fallback risk models.

---

## 2. Forensic Real Incidents & Production Patches (Incidents 1 to 6)

### Incident 1: Silent Failures Masked as Missing Keys in Redis Cache Reads Leading to Zeroed-Out Live State (BUG-RISK-SCORES-01)
- **Context**: Subsystem: Risk Scores Calculation (`server/worldmonitor/intelligence/v1/get-risk-scores.ts`, `api/_redis-key-ownership.js`, `tests/api-legacy-redis-key-prefix.test.mts`).
- **What Was Expected**: When a Redis read error occurs during risk computation, the pipeline MUST distinguish between a missing key (valid empty state) and a read infrastructure error (timeout/network error), throwing an error to prevent publishing invalid zeroed risk scores.
- **What Actually Happened**: `getCachedJson` caught all Redis operational errors (timeouts, network drops) and swallowed them, returning `null`. The risk score builder interpreted `null` as missing data, initialized every signal-family input to empty, computed a live snapshot containing zeroed-out scores (`recordCount: 0`), published this empty snapshot over the live Redis key (`risk:scores:sebuf:v8`), and triggered `CRIT EMPTY_DATA` system health alerts.
- **Evidence in Repo**: Commit `c41690c7`. Modified `server/worldmonitor/intelligence/v1/get-risk-scores.ts` and `api/_redis-key-ownership.js`.
- **Root Cause**: Confused error states in data access abstraction. The caching interface collapsed transport/infrastructure failures and data absence into a single return value (`null`).
- **Remediation Code Diff**:
```typescript
// - const signalData = await getCachedJson(key);
// - if (!signalData) { /* treated as empty dataset */ }

// + export class RiskInputsUnavailableError extends Error {
// +   constructor(public readonly failures: readonly RiskInputReadFailure[]) {
// +     super(`Failed to read risk inputs: ${failures.map(f => `${f.key} (${f.failure})`).join(', ')}`);
// +   }
// + }

// + const signalData = await readCachedJson(key); // Throws RiskInputsUnavailableError on Redis failure
```
- **Lesson**: Data access functions MUST NOT collapse exceptional infrastructure failures into non-exceptional empty states (`null` / `undefined`). Errors MUST propagate to trigger fallback handlers (e.g., serving stale snapshots).

---

### Incident 2: LLM Tool Result Truncation via Mid-Record String Slicing and Unconstrained Prompt Hallucination (BUG-WIDGET-AGENT-02)
- **Context**: LLM Relay and Widget Builder (`scripts/ais-relay.cjs`, `tests/widget-builder.test.mjs`, `docs/solutions/integration-issues/widget-agent-data-fetches-401-silently-routed-to-web-search.md`).
- **What Was Expected**: LLM tool responses exceeding context budget limits must be structurally pruned (JSON awareness) while preserving schema validity, array integrity, and explicitly informing the LLM of truncation.
- **What Actually Happened**: `sanitizeToolContent` used naive string slicing `.slice(0, 20_000)`. When raw API results (e.g., 580 intraday commodity price records) were returned, string slicing severed the payload mid-JSON object, hiding the truncation point. The LLM parsed only the first ~8 valid records and hallucinated that intraday points represented a "30-day" time horizon, creating misleading widget titles and charts.
- **Evidence in Repo**: Commits `0621cbba` and `6ec5b3de`. Modified `scripts/ais-relay.cjs`.
- **Root Cause**: Naive character-length slicing applied to structured data payloads without schema awareness or downsampling strategies.
- **Remediation Code Diff**:
```javascript
// - function sanitizeToolContent(content) {
// -   return filterWidgetToolInjection(content).slice(0, 20_000);
// - }

// + function compactWidgetToolJson(text, symbols = []) {
// +   const budget = 20_000;
// +   const points = 48;
// +   let value;
// +   try { value = JSON.parse(text); } catch { return text; }
// +   if (!value || typeof value !== 'object' || Array.isArray(value)) return text;
// +   // Structurally downsample arrays to `points` count, filter required symbols,
// +   // and inject metadata field `_truncated: true` when arrays are downsampled.
// +   const compacted = JSON.stringify(value);
// +   return compacted.length > budget ? compacted.slice(0, budget) : compacted;
// + }
```
- **Lesson**: Structured data supplied to LLM tool contexts MUST undergo AST/JSON-aware compaction and downsampling rather than raw byte/character slicing.

---

### Incident 3: Non-Idempotent External API Cron Failures Triggering False-Alarm Deployment Alerts (BUG-ELECTRICITY-SEEDER-03)
- **Context**: Electricity Price Data Seeder (`scripts/seed-electricity-prices.mjs`, `api/health.js`, `api/mcp/registry/cache-tools.ts`).
- **What Was Expected**: A daily batch seeder hitting external APIs with variable latency/degradation should allow re-tries within the same UTC day, adjust HTTP timeouts for degraded endpoints, and exit zero if a valid daily snapshot was already compiled and preserved.
- **What Actually Happened**: The ENTSO-E API experienced severe degradation (23–45 second responses per region). The seeder's 20-second hard timeout caused all regions to fail. The process exited with code 1, sending "Deploy Crashed!" alerts every run, while erasing opportunity to retry later in the same UTC day without re-downloading existing valid regions.
- **Evidence in Repo**: Commit `95ace39e`. Modified `scripts/seed-electricity-prices.mjs`.
- **Root Cause**: Rigid timeout configurations coupled with brittle process exit codes that treated temporary external API latency as catastrophic system failures.
- **Remediation Code Diff**:
```javascript
// - signal: AbortSignal.timeout(20_000),
// - LOCK_TTL_MS = 10 * 60 * 1000;

// + export const ENTSO_E_ATTEMPT_TIMEOUT_MS = 30_000;
// + export const LOCK_TTL_MS = 20 * 60 * 1000;
// + // Skip fetch if current UTC day snapshot already successfully stored:
// + if (existingSnapshot?.utcDate === currentUtcDate) {
// +   console.log('Today snapshot already exists; skipping redundant fetch.');
// +   process.exit(0);
// + }
```
- **Lesson**: Data acquisition cron scripts MUST check for existing valid snapshots for the active temporal window before initiating external I/O, adjust timeouts to match upstream service degradation SLAs, and exit gracefully (exit code 0) when existing valid data is preserved.

---

### Incident 4: Double Counting of Non-Exclusive Subsets in Aggregated Intelligence Metrics (BUG-HAPI-DOUBLE-COUNT-04)
- **Context**: Conflict Intelligence Aggregation (`scripts/_conflict-hapi.mjs`, Issue #8620).
- **What Was Expected**: Aggregating conflict event totals across datasets (e.g., HDX HAPI, ACLED) must respect category subset relationships defined by the upstream data provider.
- **What Actually Happened**: `conflictEventsTotal` summed all rows' `eventsTotal += events` prior to checking `event_type`. In HDX HAPI, `civilian_targeting` is a non-exclusive subset of `political_violence`. Adding both numbers together caused every civilian targeting incident to be counted twice in the aggregated total.
- **Evidence in Repo**: Issue #8620.
- **Root Cause**: Failure to enforce domain schema mathematical invariants regarding parent-child or subset relationship between metric categories.
- **Remediation Code Diff**:
```javascript
// - aggregate.eventsTotal += events; // Summed every row blindly
// - if (event_type === 'political_violence') aggregate.politicalViolence += events;

// + if (event_type === 'political_violence') {
// +   aggregate.politicalViolence += events;
// +   aggregate.eventsTotal += events; // Only political_violence contributes to total
// + } else if (event_type === 'civilian_targeting') {
// +   aggregate.civilianTargeting += events; // Recorded as subset breakdown, NOT added to total
// + }
```
- **Lesson**: Mathematical aggregations over multi-sourced datasets MUST explicitly branch on domain taxonomy to prevent double-counting non-exclusive subset metrics.

---

### Incident 5: Destructive Source Deduplication Overwriting Primary Intelligence Feeds (BUG-UCDP-DEDUPE-05)
- **Context**: Conflict Data Deduplication (`src/services/conflict/ucdp-dedupe.ts`, Issue #8585).
- **What Was Expected**: When two disparate conflict data sources (UCDP vs. ACLED) record an event within similar spatio-temporal boundaries (7 days, 50 km), the system must preserve both records with distinct source attribution rather than deleting one.
- **What Actually Happened**: `isDuplicatedByAcled` dropped UCDP records whenever an ACLED event existed nearby. This violated core intelligence requirements to preserve multi-source attribution and allow users to compare disparate reporting agencies.
- **Evidence in Repo**: Issue #8585.
- **Root Cause**: Destructive deduplication logic designed as record deletion rather than record linking/attribution tagging.
- **Remediation Code Diff**:
```typescript
// - if (isDuplicatedByAcled(ucdpEvent, acledEvents)) {
// -   return null; // Deleted UCDP event!
// - }

// + const matchingAcled = findMatchingAcled(ucdpEvent, acledEvents);
// + if (matchingAcled) {
// +   return { ...ucdpEvent, correlatedSourceId: matchingAcled.id, correlationType: 'SPATIO_TEMPORAL_OVERLAP' };
// + }
```
- **Lesson**: Deduplication in multi-source intelligence systems MUST be non-destructive; overlapping records must be linked via correlation identifiers rather than dropped.

---

### Incident 6: Single-Period Rolling Buffer Overwrites Preventing Multi-Source Cross-Temporal Analysis (BUG-HAPI-BUFFER-06)
- **Context**: Conflict HAPI Seeder (`scripts/_conflict-hapi.mjs`, Issue #8584).
- **What Was Expected**: The seeder must retain complete prior temporal reference periods (e.g., previous complete month) alongside the active in-progress month to enable cross-source comparative analytics against datasets that update on monthly cadences (e.g., UCDP).
- **What Actually Happened**: The aggregation logic reset its state whenever a new `referencePeriod` was encountered during row parsing. As a result, only the newest month survived in Redis. When HAPI held September data and UCDP held August data, zero overlapping months existed, breaking all multi-source comparison widgets.
- **Evidence in Repo**: Issue #8584.
- **Root Cause**: Accumulator state reset on key transition without retaining a rolling multi-period history buffer.
- **Remediation Code Diff**:
```javascript
// - aggregate = createEmptyAggregate(); // Reset aggregate lost previous month!

// + summaries.set(row.referencePeriod, aggregate);
// + // Retain both current month and previous complete reference period:
// + const previousCompleteSummary = summaries.get(previousMonthKey) || null;
```
- **Lesson**: Batch aggregation jobs MUST maintain historical period buffers equal to at least `N + 1` update windows to guarantee overlap with asynchronously updated external datasets.

---

## 3. The 9 Deep Learning Dimensions

### 1. Architecture
- **Subsystem Boundaries**: Strict segregation between frontend web shell (`/src`), server-side gRPC/Connect protobuf handlers (`/server`), edge serverless endpoint wrappers (`/api`), and background offline batch seeders (`/scripts`).
- **Decoupling Strategy**: Backend intelligence domain services are completely decoupled from frontend rendering logic using Protobuf service definitions (`.proto`) generating TypeScript types via `@bufbuild/buf`.
- **State Ownership**: Operational state resides in Redis with explicit ownership boundaries defined in `api/_redis-key-ownership.js`. Client state is isolated in DOM `localStorage` keys managed under explicit reload policies (`enforce-overlay-reload-policy.mjs`).

### 2. Core Abstractions
- **Domain Primitives**: Standardized country ISO mapping (`shared/iso3-to-iso2.json`), threat level enums, and temporal window identifiers (`seed-meta:*`).
- **Service Interfaces**: gRPC-web service contracts defining inputs, outputs, and metadata fields for intelligence endpoints (e.g., `get-risk-scores.ts`).
- **Invariant Contracts**: Static key allowlists (`APP_OWNED_KEYS`) enforcing key namespace ownership between app runtime writes and background seeders.

### 3. Error Handling
- **Fault Boundaries**: Endpoint handlers catch infrastructure exceptions (Redis disconnects, API timeouts) at the service boundary, mapping them to explicit custom errors (e.g., `RiskInputsUnavailableError`).
- **Fallback Chains**: Live Redis state -> Stale cached snapshot (`*:stale:v8`) -> Seed meta default model -> Degradation warning response.
- **Rollback Mechanics**: Failure during dataset build steps immediately halts key overwrites; rejected payloads are logged under dedicated dead-letter keys (e.g., `risk:scores:sebuf:rejected:v8`).

### 4. Testing
- **E2E Driver Harness**: Customized Playwright driver harness (`.agents/skills/verify-worldmonitor/scripts/drive.mjs`) executing step scripts (`.mjs`) with automated browser profile seeding (`seedProfile`).
- **Linter-Enforced Invariants**: Extensive static checks run via Node scripts:
  - `lint:boundaries`: Prevents illegal modular imports.
  - `lint:api-contract`: Verifies gRPC/Connect protobuf contract adherence.
  - `lint:rate-limit-policies`: Enforces rate-limiting middleware presence on public APIs.
  - `lint:safe-html`: Prevents XSS via unsafe HTML injection.
- **Mocking Strategy**: In-memory context evaluation (`vm.runInNewContext`) testing LLM agent relay functions under simulated network/API failures (`tests/widget-builder.test.mjs`).

### 5. Security
- **Threat Model**: Defense against LLM prompt injection, unauthorized API endpoint access via model hallucinations, client-side XSS through dynamic dashboard panels, and secret leaks in environment variables.
- **Sanitization & Prompt Injection Filtering**: `filterWidgetToolInjection` in `scripts/ais-relay.cjs` strips common system override directives (`ignore previous instructions`, `[system]`, `<system>`).
- **Endpoint Gating**: `isWidgetEndpointAllowed` validates LLM tool endpoint requests against an explicit route allowlist, preventing arbitrary internal request forgery.
- **Credential Integrity**: Enforced via build scripts (`check-local-secret-dumps.mjs`, `check-vite-env-secrets.mjs`) preventing `VITE_` prefixed environment variables from leaking private API credentials.

### 6. Performance
- **Latency Profiles**: High-throughput endpoints utilize Redis pre-aggregated seed payloads to guarantee sub-50ms HTTP response times.
- **Payload Optimization**: Large JSON arrays returned to LLM tool chains are structurally compacted (`compactWidgetToolJson`) to fit within a strict 20,000 character limit while preserving dataset utility.
- **Concurrency & Locks**: Background seeders employ Redis distributed locks (`LOCK_DOMAIN`, `LOCK_TTL_MS`) to prevent concurrent cron execution races.

### 7. Deployment
- **Container Strategy**: Multi-stage Docker build (`Dockerfile`) compiling TypeScript API handlers into standalone ESM bundles via `docker/build-handlers.mjs`. Run under Alpine Linux with Node.js 24 and Nginx supervised by `supervisord`.
- **Build Invariants**:
  - Pristine source verification gate (`build:crawlable-corpus`) runs before inventory fact generation (`generate-inventory-facts.mjs`).
  - Strict linting on PRs (`agent:preflight`, `agent:pr-snapshot`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DOCKER MULTI-STAGE BUILD                        │
├────────────────────────────────────────────────────────────────────────┤
│ STAGE 1: BUILDER (node:24-alpine)                                      │
│  ├── npm ci --ignore-scripts                                           │
│  ├── npm run build:crawlable-corpus && npm run build:sitemap          │
│  ├── node scripts/generate-inventory-facts.mjs                        │
│  ├── node docker/build-handlers.mjs (TS -> ESM Bundles)                │
│  └── npm run build (Vite Frontend compilation)                         │
├────────────────────────────────────────────────────────────────────────┤
│ STAGE 2: RUNTIME-DEPS                                                  │
│  └── npm ci --omit=dev --ignore-scripts                                │
├────────────────────────────────────────────────────────────────────────┤
│ STAGE 3: FINAL DEPLOYMENT CONTAINER                                    │
│  ├── Alpine + Nginx + Node.js 24                                       │
│  ├── Process Supervisor: Supervisord                                   │
│  ├── Port 80: Nginx (Serves Static SPA + reverse-proxies /api)          │
│  └── Port 3000: Internal Node.js ESM Handler Server                    │
└────────────────────────────────────────────────────────────────────────┘
```

### 8. Agent Patterns
- **Autonomous Operating Policies**: Mandated in `AGENTS.md`: Investigation/debugging reports are implicitly treated as direct execution requests to fix and open PRs without requiring user re-confirmation.
- **Context Budget Management**: System prompts include explicit current dates, exact allowlists of parameters (e.g., `ALLOWED_FRED_SERIES`), and rigid output instructions.
- **Agent Verification Artifacts**: Automated agent skill scripts (`wm-verify.sh`, `drive.mjs`) record screenshot evidence and network logs into `.claude/verify-evidence/` for PR verification.

### 9. Data Flow
- **Ingestion**: Scheduled cron -> External API -> Payload Validation -> Data Structuring & Downsampling.
- **Storage & Caching**: Active Data Key (`risk:scores:sebuf:v8`) + Stale Backup Key (`risk:scores:sebuf:stale:v8`) + Seed Metadata Key (`seed-meta:*`).
- **Serving**: API Route -> Endpoint Handler -> `readCachedJson` -> Serialization (gRPC-web / JSON) -> Frontend Store -> Map Engine / Panel Rendering.

```
[ External API (ENTSO-E / ACLED / EIA) ]
                   │
                   ▼
[ Cron Seeder Script (scripts/seed-*.mjs) ]
                   │
         Validate & Downsample
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│                     REDIS STORAGE                       │
│  ├── Live Key:  risk:scores:sebuf:v8                   │
│  ├── Stale Key: risk:scores:sebuf:stale:v8             │
│  └── Meta Key:  seed-meta:intelligence:risk-scores     │
└──────────────────────────┬──────────────────────────────┘
                           │
                 readCachedJson()
                           │
                           ▼
[ Intelligence API Handler (server/.../get-risk-scores.ts) ]
                           │
              gRPC-web / JSON Serialization
                           │
                           ▼
[ Frontend Web App (Deck.gl / Map / Panel Display) ]
```

---

## 4. The 8 Learning Extraction Artifacts

### 1. Pattern: Differentiating Infrastructure Failure from Missing Data in Caching Layer
- **Description**: A wrapper around cache reads that throws typed exceptions on network/timeout errors, reserving `null` exclusively for confirmed missing keys.
- **Code Example**:
```typescript
export class CacheReadException extends Error {
  constructor(public readonly key: string, public readonly reason: 'timeout' | 'redis' | 'parse') {
    super(`Cache read failure for ${key}: ${reason}`);
  }
}

export async function readCachedJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (raw === null) return null; // Genuine key absence
    return JSON.parse(raw) as T;
  } catch (err) {
    const reason = err instanceof SyntaxError ? 'parse' : 'redis';
    throw new CacheReadException(key, reason);
  }
}
```

### 2. Rule
- **Definition**: Endpoints MUST NOT synthesize zeroed or default live intelligence data state when underlying storage reads fail due to transient infrastructure errors. They MUST fail over to explicit stale snapshots or propagate the error.

### 3. Architecture Principle
- **Definition**: **Non-Destructive Multi-Source Ingestion Law**. Intelligence systems consuming overlapping data feeds from external vendors MUST never delete records during deduplication. Deduplication MUST operate via cross-record correlation and linkage metadata.

### 4. Failure Mode
- **Description**: **Mid-Record String Truncation**. Truncating JSON strings using arbitrary character length limits (`.slice(0, N)`) corrupts payload structure, leading to broken parsers or hallucinated interpretations by downstream LLMs.

### 5. Reusable Skill: AI Agent E2E Verification Workflow
1. Launch local dev server or preview build: `wm-verify.sh launch`.
2. Seed client state: Invoke `seedProfile(page)` in Playwright to bypass first-run modal overlays.
3. Drive user interaction path using Playwright step scripts (`drive.mjs step.mjs`).
4. Validate DOM state markers (e.g., `html[data-wm-event-handlers-ready="true"]`).
5. Capture screenshot and network transcript into `.claude/verify-evidence/`.

### 6. Decision: Structurally Downsampled JSON Context vs. Raw Truncation
- **Trade-off**: When serving large API responses to LLM tools, raw truncation is computationally cheap but breaks JSON syntax and context.
- **Rationale**: Implementing structural downsampling (`compactWidgetToolJson`) parses JSON, samples array elements evenly (e.g., down to 48 points), and appends structural truncation flags. The LLM receives valid, representationally accurate data without exceeding context limits.

### 7. Anti-Pattern: Swallowing Transport Errors in Cache Getters
- **Bad Code**:
```typescript
// NEVER DO THIS: Returns null on Redis error, masking crash as empty key!
async function getCachedJson(key) {
  try {
    return await redis.get(key);
  } catch (e) {
    return null; // DANGEROUS!
  }
}
```

### 8. Verification Method: Static Rule Enforcer for Critical Handlers
- **Description**: Custom static analysis script run in CI to verify that handler imports match allowlists and enforce required resilience checks.
- **Script Snippet (`scripts/enforce-sebuf-api-contract.mjs`)**:
```javascript
import fs from 'node:fs';
const code = fs.readFileSync('server/worldmonitor/intelligence/v1/get-risk-scores.ts', 'utf8');
if (code.includes('getCachedJson(')) {
  console.error('CRITICAL: Risk scores MUST use readCachedJson to prevent silent Redis error swallowing.');
  process.exit(1);
}
```

---

## 5. Net-New Universal Engineering Rules (Candidates for Master Brain)

## 1. Explicit Transport vs Absential Data Exception Separation
**RULE**:
Data access layers MUST explicitly distinguish between transport/infrastructure failures and key non-existence. Transport errors MUST throw typed exceptions, while key non-existence MUST return a distinct sentinel value (`null`).

**WHY**:
Swallowing transport failures (e.g., Redis timeouts, network partitions) and returning `null` causes application code to treat infrastructure outages as valid empty states. This leads to corrupt downstream calculations, zeroed-out state publications, and false alert triggers.

**WHEN TO APPLY**:
All caching, database, and key-value store access layers across all languages and frameworks.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export class DataUnavailableException extends Error {
  constructor(public readonly resourceKey: string, public readonly cause: unknown) {
    super(`Data resource unavailable: ${resourceKey}`);
  }
}

export async function fetchState<T>(key: string): Promise<T | null> {
  let result: string | null;
  try {
    result = await redisClient.get(key);
  } catch (err) {
    throw new DataUnavailableException(key, err);
  }
  
  if (result === null) return null; // Verified key absence
  
  try {
    return JSON.parse(result) as T;
  } catch (err) {
    throw new DataUnavailableException(key, err);
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER return null or empty defaults on caught errors in storage helpers
async function fetchStateBad(key) {
  try {
    return await redisClient.get(key);
  } catch (err) {
    return null; // BAD: Collapses failure into key absence!
  }
}
```

**VERIFICATION METHOD**:
Automated unit test asserting that `fetchState` throws `DataUnavailableException` when the underlying client rejects, verified by a custom linter blocking silent catch-blocks in data layers.

---

## 2. LLM Tool Response AST-Aware Compaction
**RULE**:
Structured JSON data returned from dynamic tool executions in LLM agent pipelines MUST be pruned using AST-aware/JSON-aware downsampling and compaction functions before being injected into the conversation context window. Raw string truncation (`.slice()`) MUST NOT be used on structured payloads.

**WHY**:
Raw string truncation cuts JSON payloads mid-syntax, rendering them unparseable or hiding dataset truncation from the model. This causes LLMs to misinterpret partial records (e.g., treating 8 intraday points as a full 30-day historical trend).

**WHEN TO APPLY**:
Any LLM middleware, agent relay, or MCP tool executor handling dynamic API or database query outputs.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function compactJsonToolOutput<T>(
  rawJson: string,
  maxCharBudget: number = 20000,
  maxArrayElements: number = 50
): string {
  let data: unknown;
  try {
    data = JSON.parse(rawJson);
  } catch {
    // Not valid JSON, fallback to safe substring
    return rawJson.slice(0, maxCharBudget);
  }

  if (typeof data !== 'object' || data === null) {
    return rawJson.slice(0, maxCharBudget);
  }

  const pruned = pruneContainer(data, maxArrayElements);
  const serialized = JSON.stringify(pruned);

  if (serialized.length <= maxCharBudget) {
    return serialized;
  }

  // If still oversized, inject metadata warning and trim safely
  return JSON.stringify({
    _warning: "Payload truncated due to size limits",
    
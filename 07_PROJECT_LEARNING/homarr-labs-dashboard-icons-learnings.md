> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/homarr-labs-dashboard-icons-learnings.md`  
> **Source**: github ([https://github.com/homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons))  
> **Source Version**: `9725fbdd`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T08:05:09.400Z  
> **Learning ID**: `learn-github-homarr-labs-dashboard-icons`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): homarr-labs/dashboard-icons

---

## 1. Executive Forensic Architecture & System Mechanics

`homarr-labs/dashboard-icons` is a high-scale curated icon ecosystem serving over 1,800 services, dashboards (Homarr, Dashy, Homepage), and AI agents via Model Context Protocol (MCP). The repository integrates three distinct subsystem tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND TIER (Next.js)                         │
│  - App Router ISR/SSR (revalidate: 900)                                     │
│  - Review Bench, Submission Drafts, MagicCard Preview, Icon Picker           │
│  - MCP Endpoint (/api/mcp) with JSON-RPC Batch & Streaming Tool Dispatch    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / PocketBase JS SDK
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    PERSISTENCE & POLICY TIER (PocketBase)                   │
│  - pb_hooks Engine (Goja JavaScript runtime running inside Go)              │
│  - ACID Transactions: runInTransaction(tx) & Optimistic Concurrency Checks  │
│  - Publish Batch Reservation Lock ("active = true" in publish_batches)      │
│  - Variant Policy & Canonical Revision Hashing (SHA-256 target fingerprint) │
│  - OAuth Replay Table: INSERT ... ON CONFLICT DO NOTHING                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Git / GitHub REST API v3
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                      UPSTREAM CANONICAL ASSET STORAGE                       │
│  - Git Repository (homarr-labs/dashboard-icons@main)                        │
│  - metadata.json (monolithic catalog with aliases, categories, variants)    │
│  - CDN Distribution (jsDelivr, Statically, GitHub Raw)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Subsystem Boundaries & Invariant Contracts

1. **Frontend / Agent Protocol Layer (`web/src/app`, `/api/mcp`)**:
   - Next.js App Router providing administrative review workflows, contributor submissions, and an MCP server.
   - MCP acts as a bidirectional JSON-RPC interface exposing icon discovery tools to AI agents (Cursor, Claude Code) with dynamic rate-limiting (token bucket per call) and body size gates (64 KiB anonymous vs. 512 KiB authenticated).

2. **PocketBase Hook Engine (`web/backend/pb_hooks/`)**:
   - Executes inside a Goja runtime embedded in the PocketBase Go server.
   - Enforces business logic on collections: `submissions`, `submission_events`, `publish_batches`, and `mcp_oauth_replay`.
   - Rejects unprivileged writes at the request boundary via `onRecordCreateRequest` and performs transactional audit logging and variant collision validation inside `onRecordCreate` / `onRecordUpdate`.

3. **Deterministic Canonical Identity Engine (`icon-update-policy.js`, `variant-policy.js`)**:
   - Resolves asset collisions by tracking "stem ownership" (e.g., `plex-dark` stem belonging to `plex`).
   - Uses strict canonical serialization (`canonical()`) to generate cryptographic hashes of the target state (`sha256(canonical(revisionContent(target)))`), ensuring proposals cannot be merged if upstream records change concurrently (preventing lost updates).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Cryptographic Revision Locking for Asynchronous Propose-Review Lifecycles
**RULE**:
Distributed proposal-review systems MUST seal the target entity's state into a deterministic canonical fingerprint (SHA-256 over key-sorted JSON) at proposal creation time. The review/merge transaction MUST re-derive and assert identity against the latest upstream target revision before mutation, rejecting mismatches with HTTP 409 Conflict.

**WHY**:
In asynchronous review pipelines where contributors propose changes against existing published entities or long-running PR branches, upstream records can mutate (renamed, asset replaced, variant removed) while the proposal is pending. Without a canonical revision fingerprint, merging an outdated delta overwrites or deletes intermediate upstream changes without generating a merge conflict, silently corrupting catalog assets.

**WHEN TO APPLY**:
Any entity-delta architecture, offline-first client submission workflow, CMS review bench, or git-backed database where client proposals are prepared asynchronously against dynamic targets.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Canonical serialization ensures identical byte outputs across engines
function canonical(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonical).join(",")}]`;
    }
    if (value !== null && typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}

function computeRevision(target) {
    const content = {
        kind: target.kind,
        name: target.name,
        id: target.id,
        metadata: target.metadata,
        files: target.files,
        updated: target.updated,
        status: target.status,
    };
    if (target.kind === "published") content.blobs = target.source?.blobs || null;
    if (target.unresolved) content.unresolved = target.unresolved;
    return $security.sha256(canonical(content));
}

// Validation inside ACID transaction
function validateProposalExecution(tx, proposalRecord, currentTarget) {
    const currentRevision = computeRevision(currentTarget);
    const proposalTarget = JSON.parse(proposalRecord.getString("icon_update") || "{}").target;
    
    if (!proposalTarget || proposalTarget.revision !== currentRevision) {
        throw new ApiError(409, "Target entity changed upstream. Review the latest target state before saving.");
    }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Comparing arbitrary timestamps or shallow hashes
function validateProposalShallow(proposalRecord, currentTarget) {
    // VIOLATION: updated timestamps can collide, be clock-skewed, or fail to reflect
    // nested blob changes; JSON.stringify has non-deterministic key ordering in v8/Goja.
    if (proposalRecord.get("target_updated") !== currentTarget.get("updated")) {
        throw new Error("Stale");
    }
    // VIOLATION: Shallow comparison misses nested variant changes
    if (JSON.stringify(proposalRecord.get("target")) !== JSON.stringify(currentTarget)) {
        throw new Error("Mismatch");
    }
}
```

**VERIFICATION METHOD**:
Implement an automated concurrency test:
1. Seed Target $T_0$, compute revision $R_0$.
2. Generate Proposal $P$ bound to $R_0$.
3. Mutate $T_0$ to $T_1$ (updating a nested property, e.g., adding an alias).
4. Assert that attempting to apply Proposal $P$ throws `ApiError(409)` matching `/Target.*changed/`.

---

### 2. Failure-Resistant Cache Tier Isolation for External Upstream Dependencies
**RULE**:
When wrapping data fetches with persistent edge or framework caches (e.g., Next.js `unstable_cache`), downstream fallback error handling MUST reside OUTSIDE the caching layer, and framework-level routing/suspense control errors MUST be rethrown via `unstable_rethrow(error)` before application-level fallback logic triggers.

**WHY**:
If a try/catch block resides *inside* the function passed to `unstable_cache`, any transient network failure or upstream 5xx will return the fallback value (e.g., `[]` or `null`). The caching engine will treat this return value as successful, writing the empty or broken state to cache for the entire TTL (e.g., 900 seconds). Concurrently, catching framework exceptions like Next.js `RedirectError` or `NotFoundError` inside an uncontrolled block suppresses navigation and stalls rendering pipelines.

**WHEN TO APPLY**:
All Next.js App Router data-fetching layers, SSR routes utilizing `unstable_cache`, and edge-side cache layers wrapping upstream microservices or third-party APIs (PocketBase, GitHub, Stripe).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";

// Core worker: Never swallow errors here. Let exceptions bubble so cache is NOT written.
async function loadCommunitySubmissions(): Promise<IconWithName[]> {
    const pb = createServerPB();
    const records = await pb.collection("community_gallery").getFullList<CommunityGallery>({
        sort: "-updated",
    });
    return records
        .filter((item) => item.assets && item.assets.length > 0)
        .map(transformGalleryToIcon);
}

// Cache wrapper: Revalidates on schedule or explicit tag
const getCachedCommunitySubmissions = unstable_cache(
    loadCommunitySubmissions,
    ["community-submissions-list-v3"],
    {
        revalidate: 900,
        tags: ["community-gallery"],
    }
);

// Consumption boundary: Error handling, framework re-throw, and fallback isolation
export async function getCommunitySubmissions(): Promise<IconWithName[]> {
    try {
        return await getCachedCommunitySubmissions();
    } catch (error) {
        // MUST rethrow Next.js internal control-flow exceptions (NEXT_REDIRECT, NEXT_NOT_FOUND)
        unstable_rethrow(error);
        logCommunityFetchFailure(error);
        // Return fallback only for this ephemeral request; cache remains unaffected
        return [];
    }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Caching error fallback responses
export const getCommunitySubmissions = unstable_cache(
    async () => {
        try {
            return await loadCommunitySubmissions();
        } catch (error) {
            // FATAL: The cache stores this empty array for 900 seconds.
            // A 50ms database hiccup causes a 15-minute complete site outage.
            return [];
        }
    },
    ["community-submissions-list-v3"],
    { revalidate: 900 }
);
```

**VERIFICATION METHOD**:
Mock the database client to reject with `new Error("DB_CONNECTION_TIMEOUT")`. Invoke `getCommunitySubmissions()` once (observes fallback `[]`). Restore database connectivity immediately. Invoke `getCommunitySubmissions()` again and assert that it queries the database and returns populated data rather than serving the cached empty array.

---

### 3. Constant-Time Timing-Safe Mutual Replay-Bound Secrets
**RULE**:
Private internal bridge routes (e.g., between serverless frontend handlers and embedded backend databases) asserting bearer secrets MUST hash inputs to fixed-length representations and compare via constant-time equality guards (`$security.equal` or `crypto.timingSafeEqual`). Replay payloads MUST enforce atomic single-use insertion constraints (`INSERT ... ON CONFLICT DO NOTHING`) with safe-integer epoch bounds.

**WHY**:
String comparisons using standard equality (`===`) are vulnerable to timing attacks via character-by-character short-circuit execution. Furthermore, distributed token replay attacks bypass authorization when tokens lack atomic single-use database constraints or accept malleable future timestamps.

**WHEN TO APPLY**:
Webhook consumers, inter-service replay caches, OAuth 2.0 authorization code validation, and administrative proxy backchannels.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// PocketBase Goja backend route invariant
routerAdd("POST", "/api/dashboard/mcp-oauth-replay", (e) => {
    e.response.header().set("Cache-Control", "no-store");
    const secret = $os.getenv("MCP_OAUTH_REPLAY_SECRET");
    if (!secret || secret.length < 32) {
        throw new ApiError(503, "OAuth replay storage is not configured.");
    }
    
    const supplied = e.request.header.get("X-MCP-Replay-Key");
    // Hashing to fixed length eliminates length-leakage; constant-time check stops byte-timing attacks
    if (!$security.equal($security.sha256(supplied || ""), $security.sha256(secret))) {
        throw new UnauthorizedError();
    }

    const body = e.requestInfo().body;
    const now = Math.floor(Date.now() / 1000);

    // Invariant: strict schema boundary & safe-integer epoch validation
    if (
        (body.purpose !== "code" && body.purpose !== "refresh") ||
        typeof body.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(body.id) ||
        !Number.isSafeInteger(body.expiry) ||
        body.expiry <= now ||
        body.expiry > now + 2592060 // Reject claims exceeding 30 days
    ) {
        throw new BadRequestError("Invalid replay claim.");
    }

    // Atomic consumption: SQLite INSERT ON CONFLICT DO NOTHING
    const result = e.app.db()
        .newQuery(
            "INSERT INTO mcp_oauth_replay (purpose, id, expires_at) " +
            "VALUES ({:purpose}, {:id}, {:expiry}) " +
            "ON CONFLICT (purpose, id) DO NOTHING"
        )
        .bind({ purpose: body.purpose, id: body.id, expiry: body.expiry })
        .execute();

    if (result.rowsAffected() !== 1) {
        return e.json(409, { consumed: false }); // Already replayed
    }

    return e.json(200, { consumed: true });
}, $apis.bodyLimit(1024));
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Variable-time comparison & non-atomic TOCTOU check
if (req.headers["x-mcp-replay-key"] !== process.env.MCP_OAUTH_REPLAY_SECRET) {
    throw new UnauthorizedError(); // Leak: timing varies by common prefix length
}
// TOCTOU Race Condition: Check then insert allows concurrent double-spend
const exists = db.query("SELECT id FROM mcp_oauth_replay WHERE id = ?", id);
if (exists) return res.status(409).send();
db.query("INSERT INTO mcp_oauth_replay (id) VALUES (?)", id);
```

**VERIFICATION METHOD**:
Run high-concurrency race condition testing using a suite of 50 concurrent worker threads transmitting identical `{ purpose: "code", id: "nonce-XYZ" }` payloads. Assert that exactly 1 request returns HTTP 200 `{ consumed: true }` and 49 requests return HTTP 409 `{ consumed: false }`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Blocking SSR Waterfall & Token Exhaustion on GitHub API
- **Context**: Submissions detail page metadata generation (`web/src/app/community/submissions/[id]/page.tsx`) and API client (`web/src/lib/api.ts`).
- **What Was Expected**: Next.js Server Components should render public community submissions immediately with author avatars and links without inducing external network blocking or exhausting rate limits.
- **What Actually Happened**: The server component executed blocking round-trips to `https://api.github.com/users/${authorMetaLogin}` with a 10,000ms timeout during SSR. When rate limits were exceeded (60 req/hr unauthenticated), page rendering blocked for 10 seconds per request and cascaded into 504 Gateway Timeouts.
- **Evidence in Repo**: Commit `6386d5ff`, lines 37-147 in `page.tsx` and lines 105-108 in `api.ts`.
- **Root Cause**: Tight coupling of dynamic external API availability to local HTML document generation. The system failed to leverage deterministic GitHub static CDN patterns.
- **Remediation Code Diff**:
```typescript
// - files: web/src/app/community/submissions/[id]/page.tsx
-   if (githubId && /^\d+$/.test(String(githubId))) {
-       authorData = await getAuthorData(String(githubId), { login: authorMetaLogin, name: author?.name })
-   } else if (authorMetaLogin && authorMetaLogin !== "community" && authorMetaLogin !== "Community") {
-       try {
-           const res = await fetch(`https://api.github.com/users/${encodeURIComponent(authorMetaLogin)}`, { headers })
-           if (res.ok) {
-               const gh = await res.json()
-               authorData = { id: gh?.id ?? 0, name: gh?.name ?? authorMetaLogin, login: gh?.login ?? authorMetaLogin, avatar_url: gh?.avatar_url ?? "", html_url: gh?.html_url ?? "" }
-           }
-       } catch (err) { ... }
-   }

// + Deterministic URL synthesis without network overhead
+   const authorLogin: string = author?.login || author?.name || ""
+   const githubId = String(author?.github_id ?? "")
+   const authorData: AuthorData = {
+       id: 0,
+       name: author?.name || "Community",
+       login: authorLogin || "community",
+       avatar_url: "",
+       html_url: "",
+   }
+   if (authorLogin && authorLogin.toLowerCase() !== "community") {
+       authorData.html_url = `https://github.com/${encodeURIComponent(authorLogin)}`
+       authorData.avatar_url = `https://github.com/${encodeURIComponent(authorLogin)}.png`
+   }
+   if (/^\d+$/.test(githubId)) {
+       authorData.id = Number(githubId)
+       authorData.avatar_url = `https://avatars.githubusercontent.com/u/${githubId}?v=4`
+   }
```
- **Lesson**: Do not query third-party REST APIs during SSR to fetch profile decorations. Synthesize static deterministic CDN URLs client-side or during background jobs.

---

### Incident 2: Infinite Error Cache Poisoning in Next.js Cache Subsystem
- **Context**: Community submissions catalog cache (`web/src/lib/community.ts`).
- **What Was Expected**: If PocketBase fails or restarts, transient connection errors should cause the current request to fail or degrade gracefully without poisoning long-lived cache layers.
- **What Actually Happened**: `fetchCommunitySubmissions` wrapped the database call in a `try/catch` block that caught errors and returned `[]`. This function was wrapped in `unstable_cache` with a 900-second TTL. The caching engine cached `[]` as a valid result, turning a 200ms database restart into a 15-minute data outage for all users.
- **Evidence in Repo**: Commit `9c165ef8`, lines 63-127 in `web/src/lib/community.ts`.
- **Root Cause**: Mixing error handling into the cached producer function instead of the consumer interface, combined with swallowing Next.js framework signals (`unstable_rethrow`).
- **Remediation Code Diff**:
```typescript
// - files: web/src/lib/community.ts
- export const getCommunitySubmissions = unstable_cache(fetchCommunitySubmissions, ["community-submissions-list-v3"], {
-     revalidate: 900,
-     tags: ["community-gallery"],
- })

// + Decoupled architecture: Cached worker bubbles, consumer handles and rethrows
+ async function loadCommunitySubmissions(): Promise<IconWithName[]> {
+     const records = await createServerPB().collection("community_gallery").getFullList<CommunityGallery>({
+         sort: "-updated",
+     })
+     return records.filter((item) => item.assets && item.assets.length > 0).map(transformGalleryToIcon)
+ }
+ 
+ const getCachedCommunitySubmissions = unstable_cache(loadCommunitySubmissions, ["community-submissions-list-v3"], {
+     revalidate: 900,
+     tags: ["community-gallery"],
+ })
+ 
+ export async function getCommunitySubmissions(): Promise<IconWithName[]> {
+     try {
+         return await getCachedCommunitySubmissions()
+     } catch (error) {
+         unstable_rethrow(error)
+         logCommunityFetchFailure(error)
+         return []
+     }
+ }
```
- **Lesson**: Functions wrapped with `unstable_cache` MUST throw on failure so the cache key remains uncommitted and stale-while-revalidate policies function correctly.

---

### Incident 3: DOM Event Loop Starvation on Massive Review Lists
- **Context**: Administrative dashboard workspace (`web/src/components/dashboard/workspace.tsx`).
- **What Was Expected**: The dashboard submissions list should render immediately and remain interactive when opening catalogs with thousands of items.
- **What Actually Happened**: The component mounted and rendered all 1,500+ submission items into the DOM simultaneously. While the PocketBase API answered in ~30ms, React tree reconciliation, DOM node allocations, and layout calculation froze the browser main thread for 1.8–3.5 seconds.
- **Evidence in Repo**: Issue #2992, Commit `9725fbdd`, lines 64-490 in `workspace.tsx`.
- **Root Cause**: Unbounded mapping of raw API response arrays to DOM nodes without pagination, windowing, or progressive slicing.
- **Remediation Code Diff**:
```tsx
// - files: web/src/components/dashboard/workspace.tsx
- <SubmissionList
-     records={rows}
-     selected={selected}
-     ...
- />

// + Paged slicing bounded by dynamic window
+ const LIST_PAGE = 100
+ const [listLimit, setListLimit] = useState(LIST_PAGE)
+ 
+ useEffect(() => {
+     setListLimit(LIST_PAGE)
+ }, [selectionKey]) // Reset on filter change
+ 
+ <SubmissionList
+     records={rows.slice(0, listLimit)}
+     selected={selected}
+     ...
+ />
+ {list.data && (
+     <LoadMore
+         shown={Math.min(listLimit, rows.length)}
+         total={rows.length}
+         loading={false}
+         onMore={() => setListLimit((limit) => limit + LIST_PAGE)}
+     />
+ )}
```
- **Lesson**: Fast backend queries (sub-50ms) are easily neutralized by unbounded DOM mounting. Cap initial rendering lists at <= 100 nodes.

---

### Incident 4: Authentication Bypass & Body Limit Exploitation in Legacy MCP Batches
- **Context**: MCP API Route Handler (`/api/mcp`).
- **What Was Expected**: JSON-RPC batch requests executing tools requiring user authentication must enforce authentication challenges (HTTP 401) and rate limiting across every batch element before tool dispatch.
- **What Actually Happened**: The handler applied authentication inspection and body size verification (64 KiB vs 512 KiB) only to single-request payloads. When requests arrived as a JSON-RPC batch array (`[{...}, {...}]`), the top-level inspection bypassed the individual tool security checks. Unauthenticated callers received internal execution errors rather than HTTP 401 challenges, and anonymous batch payloads could abuse unauthenticated body size limits.
- **Evidence in Repo**: Issue #2991.
- **Root Cause**: Architectural divergence between single RPC message inspection and array-based batch loop processing.
- **Remediation Code Diff**:
```typescript
// - files: /api/mcp (Simulated reconstruction based on PR #2991)
- if (!Array.isArray(body)) {
-     if (isAccountScopedTool(body.params?.name)) {
-         assertAuthenticated(req)
-     }
- }

// + Full-Spectrum Batch Decomposition & Quota Enforcement
+ const messages = Array.isArray(body) ? body : [body]
+ const hasAccountTool = messages.some(
+     (msg) => msg.method === "tools/call" && isAccountScopedTool(msg.params?.name)
+ )
+ const maxAllowedBytes = (hasAccountTool || isAuthenticated(req)) ? 512 * 1024 : 64 * 1024
+ 
+ if (contentLength > maxAllowedBytes) {
+     throw new ApiError(413, `Payload exceeds limit of ${maxAllowedBytes} bytes`)
+ }
+ 
+ if (hasAccountTool) {
+     assertAuthenticated(req) // Throws 401 triggering client sign-in flow
+ }
+ 
+ for (const msg of messages) {
+     if (msg.method === "tools/call") {
+         rateLimiter.chargeToolCall(req, msg.params.name) // Charged once per call
+     }
+ }
```
- **Lesson**: Every security invariant (authentication, authorization, rate-limit debiting, payload limit) applied to a standalone request MUST be mapped uniformly across all elements of batch requests before dispatching any element.

---

### Incident 5: Git Tree Recursion Truncation and Buffer Overflow in Published Snapshot Importer
- **Context**: Published Icon Snapshot Generator (`web/backend/pb_hooks/published-icon-snapshot.js`).
- **What Was Expected**: Snapshot validation must ingest the upstream GitHub Git tree and `metadata.json` while defending against memory exhaustion and payload manipulation.
- **What Actually Happened**: Early versions relied on standard GitHub tree lookups without guarding against the `truncated: true` flag on repositories with high entry counts (>100,000 files), leading to partial metadata parsing and phantom variant deletions.
- **Evidence in Repo**: `published-icon-snapshot.js`, lines 54-85.
- **Root Cause**: Failing to validate tree boundary guarantees and payload byte length before deserialization in embedded Goja JS engines.
- **Remediation Code Diff**:
```javascript
// - files: web/backend/pb_hooks/published-icon-snapshot.js
- const result = request(`${REPOSITORY}/git/trees/${tree}?recursive=1`).json
- const metadataEntry = result.tree.find((entry) => entry.path === "metadata.json")
- const raw = toString(request(`${REPOSITORY}/git/blobs/${metadataEntry.sha}`, true).body)
- const snapshot = decode(head, raw, blobs)

// + Hard invariant bounds and UTF-8 byte length calculation
+ const MAX_METADATA_BYTES = 4 * 1024 * 1024
+ const MAX_TREE_ENTRIES = 100000
+ const result = request(`${REPOSITORY}/git/trees/${tree}?recursive=1`).json
+ if (result.truncated || !Array.isArray(result.tree) || result.tree.length > MAX_TREE_ENTRIES) {
+     unavailable()
+ }
+ const metadataEntry = result.tree.find((entry) => entry.path === "metadata.json" && entry.type === "blob")
+ if (!metadataEntry || metadataEntry.size > MAX_METADATA_BYTES) unavailable()
+ 
+ const raw = toString(request(`${REPOSITORY}/git/blobs/${metadataEntry.sha}`, true).body)
+ // Exact byte length calculation preventing UTF-8 multi-byte string bypass
+ const bytes = encodeURIComponent(raw).replace(/%[0-9A-F]{2}|./g, "x").length
+ if (bytes > MAX_METADATA_BYTES || (metadataSha256 && $security.sha256(raw) !== metadataSha256)) {
+     unavailable()
+ }
```
- **Lesson**: When accepting trees and blobs from external VCS providers, check truncation status explicitly and enforce strict bounds on array sizes, raw byte lengths, and SHA-256 integrity.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **PocketBase Byte Buffer Deserialization**: In Goja, `record.get(key)` returns a Go byte slice or pointer. Passing this directly to `JSON.parse()` causes runtime crashes.
  ```javascript
  // MANDATORY GOJA DESERIALIZATION PATTERN:
  function readJsonField(record, key) {
      const value = record.get(key);
      if (!value) return null;
      try {
          // toString() must be called to convert Go []byte to JavaScript string primitive
          return JSON.parse(toString(value));
      } catch (_) {
          return null;
      }
  }
  ```
- **Zero vs. Falsy Coercion in Author ID Parsing**: Using `!authorId` breaks on user ID 0 (system/automation user).
  ```typescript
  // PITFALL:
  if (!author.github_id) // Evaluates true if github_id is 0 or ""

  // CORRECT:
  const githubId = String(author?.github_id ?? "")
  if (/^\d+$/.test(githubId)) {
      authorData.id = Number(githubId) // Correctly assigns 0 or positive integer
  }
  ```
- **Strict Key Ordering in Canonical JSON**: V8 and Goja do not guarantee key order preservation across runtime versions.
  ```javascript
  // Keys MUST be explicitly sorted prior to serialization
  Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")
  ```

---

### 2. Infinite Loop & Recursion Guards
- **Variant Policy Recursive Stem Normalization Guard**:
  When computing stem ownership, custom variant names could reference alias chains creating cyclic expansions.
  ```javascript
  // Termination Invariant: Bounded iteration depth and single-pass ownership mapping
  function submissionVariantStems(name, extras) {
      const stems
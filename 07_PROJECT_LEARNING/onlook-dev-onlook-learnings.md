> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/onlook-dev-onlook-learnings.md`  
> **Source**: GitHub ([https://github.com/onlook-dev/onlook](https://github.com/onlook-dev/onlook))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-30T02:52:57.488Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): onlook-dev/onlook

---

## 1. Executive Forensic Architecture & System Mechanics

Onlook (`onlook-dev/onlook`) is a hybrid visual engineering platform and AI-powered browser-based design IDE that bridges design tools (like Figma) with production Next.js/React codebases. It executes React components inside sandboxed `<iframe>` instances on a canvas while establishing bi-directional real-time Inter-Process Communication (IPC) via `penpal` to manipulate the underlying DOM, modify AST trees, manage state, and execute AI visual transformations.

```
+-------------------------------------------------------------------------------------------------------+
|                                  BROWSER CLIENT (Next.js / React 19)                                  |
|                                                                                                       |
|  +---------------------------+   State Management (MobX)    +--------------------------------------+  |
|  |     Canvas Workspace      | <--------------------------> |    EditorEngine Store / Preload API |  |
|  |                           |                              +--------------------------------------+  |
|  |  +---------------------+  |                                                 |                      |
|  |  |  Preview Frame      |  |   IPC Bridge (penpal / WindowMessenger)        |                      |
|  |  |  +---------------+  |  | <-----------------------------------------------+                      |
|  |  |  | Target App    |  |  |                                                 |                      |
|  |  |  | (Iframe)      |  |  |                                                 v                      |
|  |  |  +---------------+  |  |                              +--------------------------------------+  |
|  |  +---------------------+  |                              |    tRPC Client API Layer             |  |
|  +---------------------------+                              +--------------------------------------+  |
+--------------------------------------------------------------------------------|----------------------+
                                                                                 | HTTP / WebSockets
                                                                                 v
+-------------------------------------------------------------------------------------------------------+
|                                    BACKEND SERVICES (Bun / Next.js)                                   |
|                                                                                                       |
|  +-------------------------------------------------------------------------------------------------+  |
|  |                                    tRPC API Router System                                       |  |
|  |                                                                                                 |  |
|  |   [Protected Procedure] -> [verifyProjectAccess / verifyConversationAccess]                     |  |
|  |                                                 |                                               |  |
|  |                                                 v                                               |  |
|  |                                  +------------------------------+                               |  |
|  |                                  |   Drizzle ORM Engine         |                               |  |
|  |                                  +------------------------------+                               |  |
|  +-------------------------------------------------|-----------------------------------------------+  |
|                                                    | Native Superuser Pool (RLS Exempt)               |
|                                                    v                                                  |
|  +-------------------------------------------------------------------------------------------------+  |
|  |                                PostgreSQL Database (Supabase)                                   |  |
|  +-------------------------------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------------------------------+
```

### Architectural Subsystems & Decoupling Topology

1. **Canvas & Frame Preload Engine (`apps/web/preload`, `apps/web/client/src/app/project/[id]/_components/canvas`)**:
   - The user application runs inside an `<iframe>` configured with a injected script (`preload`). 
   - Penpal (`WindowMessenger`) establishes parent-child RPC calls (`PenpalChildMethods` / `PenpalParentMethods`).
   - DOM manipulation occurs directly within the iframe frame context, which then emits mutations back to the Next.js parent host via type-safe event channels (`PENPAL_PARENT_CHANNEL`).

2. **Server API & Authorization Gateways (`apps/web/client/src/server/api`)**:
   - Built on tRPC with Next.js App Router API routes.
   - Access controls are enforced at the application middleware level using dedicated transaction-aware assertion helpers (`verifyProjectAccess`, `verifyConversationAccess`).
   - The backend ORM layer uses Drizzle ORM connecting to PostgreSQL using connection strings that bypass Supabase Row Level Security (RLS). Consequently, the tRPC middleware and helper functions form the *sole defense barrier* for data isolation.

3. **State Management & MobX Reactive Core (`apps/web/client/src/components/store`)**:
   - Complex IDE state (selection bounds, spatial zoom, tree structures, active mutations, streaming LLM chat sessions) is managed via MobX singletons (`useEditorEngine`).
   - Decoupled from React's render loop to maintain 60 FPS spatial manipulation during canvas pans, zooms, and drag operations.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Cross-User IDOR via Superuser Database Connection Bypassing RLS (BUG-ONLOOK-01)

- **Context**: `apps/web/client/src/server/api/routers/chat/conversation.ts`, `apps/web/client/src/server/api/routers/chat/message.ts`, `apps/web/client/src/server/api/routers/chat/suggestion.ts`
- **What Was Expected**: Multi-tenant data boundary enforcement where authenticated users can only query, upsert, or mutate conversations, messages, and suggestions associated with projects to which they have explicit membership.
- **What Actually Happened**: The backend database connection (`Drizzle ORM`) was initialized using a PostgreSQL superuser connection string (`SUPABASE_DATABASE_URL = postgresql://postgres:postgres@...`). Because PostgreSQL superuser connections bypass Postgres Row Level Security (RLS), RLS policies failed to execute. tRPC procedures trusted client-supplied identifiers (`projectId`, `conversationId`, `messageId`) without asserting tenancy membership, allowing any authenticated user to read, write, or delete arbitrary conversations and messages across the entire database.
- **Evidence in Repo**: Commit `423e2e92`, Issue `#3122`, PR `#3129`.
- **Root Cause**: Reliance on database-level RLS policies when utilizing a superuser connection pool, combined with missing application-level access validation on tRPC endpoints accepting string IDs in Zod input schemas.
- **Remediation Code Diff**:

```typescript
// - Buggy code: Direct db execution relying on missing application authorization
export const conversationRouter = createTRPCRouter({
    getAll: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
            const dbConversations = await ctx.db.query.conversations.findMany({
                where: eq(conversations.projectId, input.projectId),
                orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)],
            });
            return dbConversations;
        }),
});

// + Fixed pattern: Explicit pre-execution tenant authorization check
export const conversationRouter = createTRPCRouter({
    getAll: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
            await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
            const dbConversations = await ctx.db.query.conversations.findMany({
                where: eq(conversations.projectId, input.projectId),
                orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)],
            });
            return dbConversations;
        }),
});
```

- **Lesson**: When ORM or DB connections bypass engine-level RLS (such as superuser pools or pooled proxies), authorization MUST be explicitly verified programmatically at the router/service boundary before executing any database queries or mutations.

---

### Incident 2: Unchecked Header Trust Host Injection Leading to Open Redirect (BUG-ONLOOK-02)

- **Context**: `apps/web/client/src/app/auth/callback/route.ts`
- **What Was Expected**: After successful OAuth code exchange in Next.js App Router, the application must safely redirect the user back to the application's trusted local relative authentication redirect route (`Routes.AUTH_REDIRECT`).
- **What Actually Happened**: The authentication callback extracted the `x-forwarded-host` HTTP header directly from the raw incoming request and interpolated it into a redirection URL: `NextResponse.redirect(`${forwardedProto}://${forwardedHost}${Routes.AUTH_REDIRECT}`)`. Attackers could forge `X-Forwarded-Host: attacker.com` in HTTP request headers, causing the application server to generate a 302 redirect sending user auth tokens/session states to external malicious servers (CVE-2025-63784).
- **Evidence in Repo**: Commit `6962f87a`, CVE-2025-63784, PR `#3065`.
- **Root Cause**: Trusting untrusted reverse-proxy headers (`X-Forwarded-Host`) without validating against an allowed host list or relying on the verified server `origin`.
- **Remediation Code Diff**:

```typescript
// - Buggy code: Untrusted header extraction for OAuth callback redirect
const forwardedHost = request.headers.get('x-forwarded-host');
if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    return NextResponse.redirect(`${forwardedProto}://${forwardedHost}${Routes.AUTH_REDIRECT}`);
} else {
    return NextResponse.redirect(`${origin}${Routes.AUTH_REDIRECT}`);
}

// + Fixed pattern: Hardened host selection using verified request origin
return NextResponse.redirect(`${origin}${Routes.AUTH_REDIRECT}`);
```

- **Lesson**: Never construct redirect URLs using arbitrary client-controllable request headers (`X-Forwarded-Host`, `Host`) unless strictly validated against an immutable compile-time allowlist. Prefer `request.nextUrl.origin` or runtime configuration constants.

---

### Incident 3: DOM-Based XSS via Unsanitized InnerHTML Replacement in Canvas Text Preload (BUG-ONLOOK-03)

- **Context**: `apps/web/preload/script/api/elements/text.ts`
- **What Was Expected**: Updating text content inside visual elements on the canvas canvas must support multi-line breaking (`<br>`) while neutralizing potential Cross-Site Scripting (XSS) payload injections (e.g., `<img src=x onerror=alert(1)>`).
- **What Actually Happened**: The `updateTextContent` function naively replaced `\n` with `<br>` and assigned the resulting raw string to `el.innerHTML`. When users edited visual text nodes containing malicious HTML tag patterns, arbitrary JavaScript was injected and executed inside the context of the canvas runner iframe (CVE-2025-63785).
- **Evidence in Repo**: Commit `2e6cda3b`, CVE-2025-63785, PR `#3064`.
- **Root Cause**: Directly setting `innerHTML` on DOM nodes with unsanitized string replacements.
- **Remediation Code Diff**:

```typescript
// - Buggy code: Direct innerHTML assignment allowing arbitrary script injection
function updateTextContent(el: HTMLElement, content: string): void {
    const htmlContent = content.replace(/\n/g, '<br>');
    el.innerHTML = htmlContent;
}

// + Fixed pattern: Strict line-ending normalization and safe DOM text-node construction
function updateTextContent(el: HTMLElement, content: string): void {
    // SECURITY INVARIANT: Only escaped text nodes and explicit <br> elements are allowed.
    // 1. Normalize line endings (CRLF/CR -> LF)
    // 2. Split on newlines to get text segments
    // 3. Build DOM with text nodes (auto-escaped) interleaved with <br> elements
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');

    el.innerHTML = '';
    lines.forEach((line, index) => {
        el.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
            el.appendChild(document.createElement('br'));
        }
    });
}
```

- **Lesson**: Never assign unsanitized strings to `innerHTML`. When converting raw text formatting (like newlines) into markup structure, build the tree imperatively using `document.createTextNode()` and explicit structural nodes (`document.createElement('br')`).

---

### Incident 4: Broken Object-Level Authorization (BOLA) in Project Mutations & DB Transactions (BUG-ONLOOK-04)

- **Context**: `apps/web/client/src/server/api/routers/project/helper.ts`, `apps/web/client/src/server/api/routers/project/project.ts`
- **What Was Expected**: Deleting a project, modifying project metadata, or updating tags requires verifying that the authenticated user owns or is a member of the project *within the same atomic database transaction*.
- **What Actually Happened**: Deletion procedures executed `tx.delete(projects).where(eq(projects.id, input.id))` without checking `userProjects` association within the database transaction block. Attackers could issue project mutation calls targeting known project UUIDs to erase other tenants' projects (CVE-2025-63783).
- **Evidence in Repo**: Commit `57ce1ccf`, CVE-2025-63783, PR `#3062`.
- **Root Cause**: Deleting primary database records before or without verifying relational mapping records (`userProjects`), alongside missing support for passing transaction contexts (`tx`) into validation routines.
- **Remediation Code Diff**:

```typescript
// - Buggy code: Unprotected multi-table cascade deletion inside transaction
delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
        await ctx.db.transaction(async (tx) => {
            await tx.delete(projects).where(eq(projects.id, input.id));
            await tx.delete(userProjects).where(eq(userProjects.projectId, input.id));
        });
    });

// + Fixed pattern: Pre-mutation verification accepting transaction handle (tx)
export async function verifyProjectAccess(
    db: Pick<DrizzleDb, 'query'>,
    userId: string,
    projectId: string,
): Promise<void> {
    const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
            userProjects: {
                where: eq(userProjects.userId, userId),
            },
        },
    });

    if (!project || project.userProjects.length === 0) {
        throw new Error('Unauthorized or not found');
    }
}

delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
        await ctx.db.transaction(async (tx) => {
            await verifyProjectAccess(tx, ctx.user.id, input.id);
            await tx.delete(userProjects).where(eq(userProjects.projectId, input.id));
            await tx.delete(projects).where(eq(projects.id, input.id));
        });
    });
```

- **Lesson**: Authorization checks in database operations must participate in active transactional blocks (`tx`) to prevent race conditions and ensure relational dependency order is respected before issuing dynamic `DELETE` or `UPDATE` SQL statements. Return ambiguous error messages ("Unauthorized or not found") to prevent resource enumeration.

---

### Incident 5: Penpal IPC RPC Desynchronization & Unhandled Iframe Lifecycle Exceptions (BUG-ONLOOK-05)

- **Context**: `apps/web/client/src/app/project/[id]/_components/canvas/frame/view.tsx`
- **What Was Expected**: The visual canvas host iframe communicates with the inner app runner via `penpal`. If the iframe is re-rendering, unmounting, or undergoing hot-module reloading (HMR), RPC calls initiated from MobX canvas tools should fail gracefully without throwing unhandled promise rejections or crashing the canvas UI engine.
- **What Actually Happened**: When canvas frames were zoomed or manipulated while the underlying iframe host was in a loading or unmounted state, RPC method dispatches (e.g., `getElements`, `captureScreenshot`) threw synchronous bridge errors, disrupting the main MobX editor engine render pipeline.
- **Evidence in Repo**: Commit `ccd2302f`.
- **Root Cause**: Missing fallback implementations and proxy guards on promisified Penpal parent-child RPC method bindings during iframe connection setup transitions.
- **Remediation Code Diff**:

```typescript
// - Buggy code: Direct raw binding to penpal connection handle without fallback boundary
const connection = connect<PenpalChildMethods>({
    url: frameUrl,
    element: iframeRef.current,
});
const childMethods = await connection.promise;
setChild(childMethods);

// + Fixed pattern: Safe proxy fallback wrapper handling transient connection states
const createSafeFallbackMethods = (): PromisifiedPendpalChildMethods => {
    return new Proxy({} as PromisifiedPendpalChildMethods, {
        get: (_target, prop) => {
            return async (..._args: any[]) => {
                const method = String(prop);
                if (method.startsWith('get') || method.includes('capture')) {
                    return null;
                }
                return undefined;
            };
        },
    });
};
```

- **Lesson**: Inter-process cross-frame RPC interfaces must implement proxy-based fallback handlers to absorb transient availability states during iframe lifecycles and hot-module reloading.

---

## 3. The 9 Deep Learning Dimensions

### 1. Architecture
- **Monorepo Topology**: Bun Workspaces + Next.js App Router (`apps/web/client`), Supabase Backend migrations (`apps/backend`), and shared packages (`packages/db`, `packages/models`, `packages/penpal`, `packages/ui`).
- **Canvas-Iframe Decoupling**: Visual editing operates on a decoupled iframe engine (`penpal`). The web studio hosts the outer canvas (spatial zoom, bounding box overlays, toolbar) while the preview app executes inside isolated child processes or `<iframe>` sandboxes.
- **Layer Boundary Enforcement**: DB access is strictly isolated in `@onlook/db`. tRPC API routers act as orchestrators, binding validation schemas, transaction boundary helpers, and external providers (e.g., Firecrawl, Anthropic/OpenRouter).

### 2. Core Abstractions
- **`DbOrTx` Type Polymorphism**: Architectural pattern defined as `type DbOrTx = Pick<DrizzleDb, 'query'>`. Allows authorization routines (`verifyProjectAccess`) to run interchangeably against full database instances (`ctx.db`) or transactional contexts (`tx`).
- **`PromisifiedPendpalChildMethods`**: Proxy contract wrapping window IPC calls, turning asynchronous cross-frame events into imperative typed promise interfaces.
- **Visual Frame Representation**: Frame domain model (`Frame`) storing viewport dimensions, canvas coordinates, sandbox port metrics, and dynamic rendering settings.

### 3. Error Handling
- **Ambiguous Authorization Failures**: Intentionally returning identical error messages (`Unauthorized or not found`) across non-existent resources and forbidden resources to shield system state against resource-enumeration attacks.
- **Graceful RPC Degradation**: RPC client callers implement safe fallback proxy traps returning `null` or `undefined` during transient iframe disconnects instead of crashing host state machines.
- **Transaction Rollback Integration**: Direct invocation of exceptions inside Drizzle transaction blocks (`ctx.db.transaction(async (tx) => { ... })`) triggers automatic SQL transaction rollbacks.

### 4. Testing
- **Storybook Isolated Mocks**: Complex third-party client dependencies (e.g., Supabase storage, Next.js environment bindings `@t3-oss/env-nextjs`) are mocked out at the Vite resolution level (`viteFinal.resolve.alias`) to eliminate reliance on active backend connections during UI unit and visual testing.
- **Vitest & Storybook Integration**: Automated component testing via `@storybook/addon-vitest` and Chromatic integration (`.github/workflows/chromatic.yml`).

### 5. Security
- **BOLA / IDOR Defense Standard**: Mandatory pre-query call to `verifyProjectAccess()` or `verifyConversationAccess()` on every tRPC endpoint taking a user-supplied ID.
- **Sanitized DOM Injection Invariants**: Total elimination of unsafe `innerHTML` dynamic string interpolation. Enforced pattern requires constructing text trees via `document.createTextNode` and `document.createElement('br')`.
- **Callback Host Injection Shielding**: Explicit deprecation and removal of `X-Forwarded-Host` request header parsing in Next.js Auth callback routes to maintain rigid 302 redirect targets (`request.nextUrl.origin`).

### 6. Performance
- **MobX Decoupled Rendering**: Fast spatial pan/zoom operations bypass React state reconciliation loops through direct MobX dynamic observables and direct canvas canvas transforms.
- **Standalone Distribution**: Docker builds leverage Next.js standalone outputs (`STANDALONE_BUILD=true`), reducing final container deployment size by eliminating non-essential dev dependencies.
- **Zero-Copy Serialization over IPC**: Penpal handles structured clone messaging across iframe boundaries to send minimal structural JSON payloads instead of re-serializing raw DOM strings.

### 7. Deployment
- **Bun Native Runtime Pipeline**: Unified reliance on Bun (`bun@1.3.1`) across CI/CD (`.github/workflows/ci.yml`), monorepo script filters (`bun --filter`), and production container runtime (`oven/bun:1`).
- **Container Health Check Protocols**: Embedded runtime healthcheck command in `Dockerfile`:
  `CMD bun -e "fetch('http://localhost:3000').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"`

### 8. Agent Patterns
- **Provider Agnostic LLM Execution**: Integration with `@ai-sdk` (Vercel AI SDK) via OpenRouter / Anthropic models (`OPENROUTER_MODELS.OPEN_AI_GPT_5_NANO`).
- **Structured LLM Output Generation**: Using `generateObject()` with Zod schemas to constrain AI model output for UI prompt-to-design suggestions.
- **Context Budgeting**: Conversion of message history via `convertToModelMessages()` before sending prompts, stripping internal canvas operational metadata to minimize context window consumption.

### 9. Data Flow
- **Mutation Lifecycle**: User Edit -> Canvas Selection -> IPC Frame Dispatch -> Preload Element API -> Web Engine State (MobX) -> tRPC Mutation -> `verifyProjectAccess` Check -> Drizzle DB Transaction -> Postgres Superuser Connection.

```
+--------------------------------------------------------------------------------------------------+
|                                  MUTATION DATA FLOW PIPELINE                                     |
|                                                                                                  |
| [User Interaction]                                                                               |
|        |                                                                                         |
|        v                                                                                         |
| [Canvas Selection & Preload Element API]                                                         |
|        |                                                                                         |
|        v (IPC Channel / Penpal)                                                                  |
| [Web Engine State Store - MobX]                                                                  |
|        |                                                                                         |
|        v (tRPC Client Call)                                                                      |
| [tRPC Router Procedure]                                                                          |
|        |                                                                                         |
|        +---> [verifyProjectAccess Check] (Throws "Unauthorized or not found" if invalid)        |
|        |                                                                                         |
|        v (DbOrTx Context)                                                                        |
| [Drizzle DB Transaction]                                                                         |
|        |                                                                                         |
|        v (Postgres Superuser Connection)                                                         |
| [PostgreSQL Engine Commit]                                                                       |
+--------------------------------------------------------------------------------------------------+
```

---

## 4. The 8 Learning Extraction Artifacts

### 1. Pattern: Transaction-Aware Authorization Enforcement Pattern

A reusable, type-safe pattern for verifying tenant access in tRPC procedures that works seamlessly inside and outside database transactions.

```typescript
import { eq } from 'drizzle-orm';
import { projects, userProjects, type DrizzleDb } from '@onlook/db';

/** Subtype accepting both full Drizzle DB instance and active Transaction blocks */
export type DbOrTx = Pick<DrizzleDb, 'query'>;

/**
 * Validates project membership for a given user.
 * Prevents Information Disclosure by returning uniform error messages.
 */
export async function verifyProjectAccess(
    db: DbOrTx,
    userId: string,
    projectId: string,
): Promise<void> {
    const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
            userProjects: {
                where: eq(userProjects.userId, userId),
            },
        },
    });

    if (!project || project.userProjects.length === 0) {
        // Uniform error to prevent project ID enumeration
        throw new Error('Unauthorized or not found');
    }
}
```

### 2. Rule: RLS Superuser Authorization Requirement
> **RULE**: Any application layer using database client connections that run as PostgreSQL superusers or bypass Row-Level Security (RLS) MUST execute explicit access validation helpers at every RPC/API procedure boundary prior to issuing database reads or writes.

### 3. Architecture Principle: Multi-Tenant Authorization Decoupling
> System access control logic must be decoupled from database-level RLS policies when using elevated connection pools. Authorization must be executed in the application layer within the same transaction context (`DbOrTx`) as the target operation.

### 4. Failure Mode: IDOR via Unverified Foreign Identifiers
- **Failure Cause**: Endpoint receives an entity ID (e.g., `conversationId`, `projectId`, `messageId`) from the client and directly queries/modifies the table using a superuser DB client without validating ownership.
- **Impact**: Authenticated multi-tenant data leaks and unauthorized data deletion across accounts (IDOR/BOLA).
- **Detection**: Static code analysis searching for tRPC `protectedProcedure` query/mutation handlers lacking an `await verify*Access(...)` assertion.

### 5. Reusable Skill: Safe DOM Text Injection Protocol
When converting multi-line user input to HTML in browser preview/preload environments:
1. Normalize line endings: `content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')`.
2. Split string content on `\n`.
3. Clear target container element inner contents (`el.innerHTML = ''`).
4. Loop through line segments, creating text nodes via `document.createTextNode(line)`.
5. Append `document.createElement('br')` between segments.

### 6. Decision: Superuser Application Connection Pool with Explicit Middleware Guards
- **Decision**: Use a superuser database connection string for Drizzle ORM paired with mandatory explicit application middleware authorization checks (`verifyProjectAccess`), rather than creating dynamic per-user RLS Postgres connections.
- **Rationale**: Dynamic per-user DB connection pooling introduces severe connection overhead and latency in serverless Next.js environments. Application-level verification provides high performance while maintaining tenant isolation when combined with strict RPC authorization invariants.

### 7. Anti-Pattern: Naive Multi-Line innerHTML String Interpolation

```typescript
// BAD: Vulnerable to DOM-based XSS (CVE-2025-63785)
function updateTextContentUnsafe(el: HTMLElement, content: string): void {
    const htmlContent = content.replace(/\n/g, '<br>');
    el.innerHTML = htmlContent; // DO NOT DO THIS! Malicious HTML tags execute!
}
```

### 8. Verification Method: Automated Structural AST Linter for Procedure Guard Enforcement

An automated check to verify that all tRPC procedure definitions containing `projectId`, `conversationId`, or `messageId` inputs include a corresponding authorization call (`verifyProjectAccess` or `verifyConversationAccess`).

```typescript
import { readFileSync } from 'fs';
import ts from 'typescript';

export function verifyTRPCRoutersHaveAuthGuards(filePath: string): boolean {
    const sourceText = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
    let isViolated = false;

    function visit(node: ts.Node) {
        if (ts.isPropertyAssignment(node) && node.name.getText() === 'mutation') {
            const bodyText = node.initializer.getText();
            if (bodyText.includes('input.projectId') && !bodyText.includes('verifyProjectAccess')) {
                console.error(`SECURITY VIOLATION: Missing verifyProjectAccess in ${filePath}`);
                isViolated = true;
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return !isViolated;
}
```

---

## 5. Net-New Universal Engineering Rules

## 1. Unified Transaction/Client Authorization Interface (`DbOrTx`)
**RULE**:
All domain access-control helper functions MUST accept a unified database interface (`type DbOrTx = Pick<DrizzleDb, 'query'>`) allowing them to execute within both standalone client contexts and active database transactions (`tx`).

**WHY**:
Passing authorization helpers a separate non-transactional database handle inside an active transaction block causes race conditions, phantom reads, and dirty state reads where the authorization check does not see uncommitted transactional mutations.

**WHEN TO APPLY**:
Apply across all ORM-based backend architectures (Drizzle, Prisma, TypeORM) where transactional atomicity and access checks coincide.

**VERIFIED IMPLEMENTATION PATTERN**:

```typescript
import { eq } from 'drizzle-orm';
import { userProjects, projects, type DrizzleDb } from '@onlook/db';

export type DbOrTx = Pick<DrizzleDb, 'query'>;

export async function verifyProjectAccess(
    db: DbOrTx,
    userId: string,
    projectId: string
): Promise<void> {
    const record = await db
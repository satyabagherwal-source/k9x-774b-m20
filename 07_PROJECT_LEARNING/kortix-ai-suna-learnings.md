# Forensic Learning Record (Deep Inspection): kortix-ai/suna

> **Canonical Artifact**: `07_PROJECT_LEARNING/kortix-ai-suna-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kortix-ai/suna](https://github.com/kortix-ai/suna))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:45:34.561Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kortix-ai/suna`
- **Description**: The open-source AI Management System
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 20238 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/contributing/scripts/preview-subscribe.ts`
```
#!/usr/bin/env bun
/**
 * Subscribe a preview-signed-in synthetic account to a real Stripe test-mode
 * plan, so it is entitled to Kortix-managed models before a demo is recorded.
 *
 * A fresh preview account is free tier. `accountIsFreeTierForModels`
 * (apps/api/src/billing/services/tiers.ts) denies managed models to any tier
 * that isn't paid — enforced everywhere on purpose since commit 406eb5e9ac
 * "fix(gateway): enforce paid managed model access", which deliberately
 * removed the earlier `env === 'dev' || env === 'preview'` bypass. Preview
 * keeps billing ON precisely so the subscribe -> entitlement -> managed-models
 * path is exercised, not skipped (tests/src/core/preview-stack.ts). The
 * sanctioned way for a demo account to reach real model output is the same
 * front door a real customer uses: Stripe test-mode subscribe
 * (preview-environments.md -> "Sign in": "subscribe with a Stripe test card").
 *
 * This script automates exactly that path — the same one GW-MANAGED-1
 * (tests/src/flows/llm-gateway.flow.ts) already drives against every preview —
 * so a PR demo does not need a human to click through Stripe Checkout by hand.
 * It does not touch the billing-enforcement code, an admin override, or any
 * account-creation default: it is tooling that calls the real subscribe route
 * for one account, the same way tests/src/fixtures/billing.ts's `subscribe()`
 * already does.
 *
 *   preview-subscribe.ts <origin> <access_token> <account_id> [tier_key]
 *
 * `access_token` is the signed-in account's Supabase JWT. Its personal
 * account id equals its user id (apps/api/src/accounts/core/
 * bootstrap-personal-account.ts: "Personal accounts use `accountId ===
 * userId`"). preview-subscribe.sh extracts both from the agent-browser
 * session's auth cookie and calls this.
 *
 * Reads STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET from the environment — the
 * same test-mode Stripe secret already used to test every preview
 * (KE2E_STRIPE_SECRET_KEY / KE2E_STRIPE_WEBHOOK_SECRET on the preview runtime
 * allowlist). No new secret; preview-subscribe.sh sources them from the
 * repo's own dotenvx-encrypted apps/api/.env.staging.
 */
import { Client } from '../../../../tests/src/core/client';
import { subscribe } from '../../../../tests/src/fixtures/billing';
import type { Env } from '../../../../tests/src/core/env';

async function main(): Promise<void> {
  const [origin, accessToken, accountId, tierKeyArg] = process.argv.slice(2);
  if (!origin || !accessToken || !accountId) {
    console.error(
      'usage: preview-subscribe.ts <origin> <access_token> <account_id> [tier_key]',
    );
    process.exit(1);
  }
  const tierKey = tierKeyArg || 'pro';

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  // Demo tooling must never reach live Stripe, whatever the caller exported.
  if (stripeSecretKey && !/^(sk|rk)_test_/.test(stripeSecretKey)) {
    console.error('STRIPE_SECRET_KEY is not a test-mode key; refusing (preview-subscribe.sh)');
    process.exit(1);
  }
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY is required (see preview-subscribe.sh)');
    process.exit(1);
  }
  if (!stripeWebhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is required (see preview-subscribe.sh)');
    process.exit(1);
  }

  const apiUrl = `${origin.replace(/\/+$/, '')}/v1`;
  // Only the three fields `subscribe()` reads (apiUrl, stripeSecretKey,
  // stripeWebhookSecret) are populated — this script never runs a flow, so
  // the rest of `Env` (Supabase creds, capability flags, …) has no caller.
  const env = { apiUrl, stripeSecretKey, stripeWebhookSecret } as Env;
  const client = new Client(apiUrl).withBearer(accessToken, 'preview-demo');

  await subscribe(env, client, accountId, tierKey);
  console.log(`subscribed ${accountId} to ${tierKey} on ${origin} — managed models are live`);
}

main().catch((err) => {
  console.error(`preview-subscribe failed: ${(err as Error)?.message ?? err}`);
  process.exit(1);
});

```

### Core Architecture Module: `.deepsec/deepsec.config.ts`
```
import { defineConfig, type DeepsecPlugin } from "deepsec/config";
import { kortixHonoEntrypoint } from "./matchers/kortix-hono-entrypoint.js";
import { kortixTerraformIacSurface } from "./matchers/kortix-terraform-iac-surface.js";

const kortixPlugin: DeepsecPlugin = {
  name: "kortix-security-surfaces",
  matchers: [kortixHonoEntrypoint, kortixTerraformIacSurface],
};

export default defineConfig({
  projects: [
    { id: "suna", root: ".." },
    // <deepsec:projects-insert-above>
  ],
  plugins: [kortixPlugin],
});

```

### Core Architecture Module: `.deepsec/matchers/kortix-hono-entrypoint.ts`
```
import type { CandidateMatch, MatcherPlugin } from "deepsec/config";

const ROUTE_RE =
  /\b(?:app|router|projectsApp|projectWebhooksApp|kortixRouter|setupLinksPublicApp|oauthApp|tunnelApp|connectorApp|adminApp|opsApp|scimRouter|accountsRouter|accountInvitesRouter|sandboxProxyApp|webProxyRouter)\s*\.\s*(?:get|post|put|patch|delete|all|route|openapi|use)\s*\(/;

export const kortixHonoEntrypoint: MatcherPlugin = {
  slug: "kortix-hono-entrypoint",
  description: "Kortix Hono/OpenAPI route and middleware entry points for auth/proxy review",
  noiseTier: "noisy",
  filePatterns: [
    "apps/api/src/**/*.ts",
    "apps/kortix-sandbox-agent-server/src/**/*.ts",
  ],
  match(content, filePath): CandidateMatch[] {
    if (/\.(test|spec)\.ts$/.test(filePath) || filePath.includes("/__tests__/")) return [];
    if (!/(Hono|OpenAPIHono|makeOpenApiApp|\.openapi\s*\(|\.route\s*\(|\.use\s*\()/.test(content)) return [];

    const lines = content.split("\n");
    const matches: CandidateMatch[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!ROUTE_RE.test(lines[i])) continue;
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 8);
      matches.push({
        vulnSlug: "kortix-hono-entrypoint",
        lineNumbers: [i + 1],
        snippet: lines.slice(start, end).join("\n"),
        matchedPattern: "Kortix Hono/OpenAPI route or middleware registration",
      });
    }
    return matches;
  },
};

```

### Core Architecture Module: `.deepsec/matchers/kortix-terraform-iac-surface.ts`
```
import type { CandidateMatch, MatcherPlugin } from "deepsec/config";

const IAC_RE = /^(?:resource|module|data|provider|terraform|variable|output)\s+["{]/;

export const kortixTerraformIacSurface: MatcherPlugin = {
  slug: "kortix-terraform-iac-surface",
  description: "Kortix Terraform/IaC files for cloud security review coverage",
  noiseTier: "noisy",
  filePatterns: ["infra/terraform/**/*.tf"],
  match(content, filePath): CandidateMatch[] {
    if (filePath.includes("/.terraform/")) return [];
    const lines = content.split("\n");
    const matches: CandidateMatch[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!IAC_RE.test(lines[i].trim())) continue;
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 7);
      matches.push({
        vulnSlug: "kortix-terraform-iac-surface",
        lineNumbers: [i + 1],
        snippet: lines.slice(start, end).join("\n"),
        matchedPattern: "Terraform/IaC declaration requiring cloud security review",
      });
      break;
    }
    return matches;
  },
};

```

### Core Architecture Module: `apps/api/scripts/bench-boot-attribution.ts`
```
#!/usr/bin/env bun
/**
 * Full-attribution session-boot benchmark.
 *
 * The older `bench-session-boot.ts` reports a single `total_ms` from polling the
 * session status — enough to say "boot is slow", useless for saying WHERE. This
 * one instruments every observable transition end to end, on both sides of the
 * VM boundary, so a boot decomposes into named stages:
 *
 *   HOST      t0 ─ POST /sessions returns              → api_create_ms
 *             ─ session_sandboxes.external_id set      → vm_created_ms   (VM exists)
 *             ─ session_sandboxes.status = 'active'    → row_active_ms
 *   IN-GUEST  ─ first 2xx from /kortix/health          → daemon_reachable_ms
 *             ─ health.runtimeReady = true             → runtime_ready_ms  (usable)
 *
 * plus the daemon's own `boot_timeline` (BootMark[]) harvested off the health
 * response — the per-stage in-guest breakdown (clone / config-deps / opencode
 * spawn / opencode session) that is otherwise unattributable because the daemon
 * never persists it.
 *
 * Host-side transitions are read straight from Postgres rather than from the
 * session API: the API's own readiness resolution is one of the things being
 * measured, and DB polling sees `external_id` land the moment provider.create
 * returns, which no public endpoint exposes.
 *
 * Usage:
 *   cd apps/api
 *   BENCH_DB_URL="$(dotenvx get DATABASE_URL -f .env.prod)" \
 *   BENCH_TOKEN=... BENCH_API=https://api.kortix.com \
 *   BENCH_TARGETS='[{"label":"daytona","projectId":"..."},{"label":"platinum","projectId":"..."}]' \
 *   bun run scripts/bench-boot-attribution.ts
 *
 * Env:
 *   BENCH_TARGETS   JSON array of {label, projectId}. Required.
 *   BENCH_DB_URL    Postgres URL for host-side transitions. Required.
 *   BENCH_API       API base origin (default https://api.kortix.com).
 *   BENCH_TOKEN     kortix_pat_… Required. Read from env only, never from a
 *                   config file — see the comment on TOKEN below.
 *   BENCH_ROUNDS    boots per target (default 3).
 *   BENCH_TIMEOUT_S per-boot ceiling (default 180).
 *   BENCH_KEEP      "1" to leave the sessions behind (default: delete them).
 *   BENCH_OUT       write the raw JSON here (default: stdout only).
 *
 * Boots are sequential per target and targets run in parallel, so the two
 * providers see comparable control-plane load without self-contention.
 */
import { writeFileSync } from 'node:fs';
import { SQL } from 'bun';
import { classifyBootImage, type BootImageKind } from './boot-image-kind';

const API = (process.env.BENCH_API ?? 'https://api.kortix.com').replace(/\/+$/, '');
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 3);
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_S ?? 180) * 1000;
const KEEP = process.env.BENCH_KEEP === '1';
const DB_URL = process.env.BENCH_DB_URL ?? '';

// Token comes from the environment ONLY — deliberately not read out of
// ~/.config/kortix/config.json. Two reasons, and the second is the important one:
//   1. This harness points at whatever BENCH_API says, including production.
//      Silently pairing an explicit host with an implicitly-discovered credential
//      from a config file is how you benchmark the wrong deployment with the wrong
//      account's token. Making the credential as explicit as the target removes
//      that whole class of mistake.
//   2. It also removes a real file-data-to-outbound-request flow (CodeQL
//      js/file-data-in-outbound-request), rather than suppressing the alert.
const TOKEN = (process.env.BENCH_TOKEN ?? '').trim();

interface Target { label: string; projectId: string }
const TARGETS: Target[] = JSON.parse(process.env.BENCH_TARGETS ?? '[]');

if (!TARGETS.length || !DB_URL || !TOKEN) {
  console.error('Need BENCH_TARGETS, BENCH_DB_URL, and BENCH_TOKEN.');
  process.exit(1);
}

const sql = new SQL(DB_URL);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BootMark { label: string; atMs: number }
interface Boot {
  target: string;
  round: number;
  sessionId: string | null;
  provider: string | null;
  /** Snapshot the session actually booted from — distinguishes a warm (ppwarm) image from a cold one. */
  image: string | null;
  imageKind: BootImageKind;
  apiCreateMs: number | null;
  vmCreatedMs: number | null;
  rowActiveMs: number | null;
  daemonReachableMs: number | null;
  runtimeReadyMs: number | null;
  /** Host-side ProvisionTimeline marks, as persisted by the API. */
  hostMarks: Array<{ label: string; deltaMs: number }> | null;
  /** In-guest BootMark[] read off /kortix/health. */
  bootTimeline: BootMark[] | null;
  error?: string;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...init?.headers },
    signal: AbortSignal.timeout(60_000),
  });
}

/** One boot, fully attributed. Never throws — a failed boot is recorded as one. */
async function measureBoot(target: Target, round: number): Promise<Boot> {
  const boot: Boot = {
    target: target.label, round, sessionId: null, provider: null, image: null, imageKind: 'unknown',
    apiCreateMs: null, vmCreatedMs: null, rowActiveMs: null,
    daemonReachableMs: null, runtimeReadyMs: null, hostMarks: null, bootTimeline: null,
  };
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);

  try {
    const res = await api(`/v1/projects/${target.projectId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    boot.apiCreateMs = at();
    const body: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`create ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
    const sessionId = body?.id ?? body?.session_id ?? body?.sessionId;
    if (!sessionId) throw new Error(`create returned no session id: ${JSON.stringify(body).slice(0, 300)}`);
    boot.sessionId = sessionId;

    let externalId: string | null = null;
    let healthPolling: Promise<void> | null = null;

    // Once the VM exists, poll the daemon concurrently with the DB — the guest
    // boots while the host is still finishing its row writes, so serializing the
    // two would fold host bookkeeping into the in-guest numbers.
    const pollHealth = async (eid: string) => {
      while (performance.now() - t0 < TIMEOUT_MS) {
        try {
          const h = await fetch(`${API}/v1/p/${eid}/8000/kortix/health`, {
            headers: { Authorization: `Bearer ${TOKEN}` },
            signal: AbortSignal.timeout(10_000),
          });
          if (h.ok) {
            if (boot.daemonReachableMs === null) boot.daemonReachableMs = at();
            const hb: any = await h.json().catch(() => null);
            if (hb?.boot_timeline) boot.bootTimeline = hb.boot_timeline;
            if (hb?.runtimeReady) { boot.runtimeReadyMs = at(); return; }
          }
        } catch { /* daemon not up yet */ }
        await sleep(200);
      }
    };

    while (performance.now() - t0 < TIMEOUT_MS) {
      const rows = await sql`
        select provider::text as provider, external_id, status::text as status, metadata
        from kortix.session_sandboxes where sandbox_id = ${sessionId} limit 1`;
      const row = rows[0];
      if (row) {
        boot.provider = row.provider;
        if (row.external_id && boot.vmCreatedMs === null) {
          boot.vmCreatedMs = at();
          externalId = row.external_id;
          healthPolling = pollHealth(externalId!);
        }
        if (row.status === 'active' && boot.rowActiveMs === null) boot.rowActiveMs = at();
        const md = row.metadata ?? {};
        if (md.provisionTimeline?.marks) boot.hostMarks = md.provisionTimeline.marks;
        const ref = md.runtimeArtifact?.providerArtifactRef ?? null;
        if (ref) { boot.image = ref; boot.imageKind = classifyBootImage(ref); }
        if (row.status === 'error') throw new Error(`sandbox error: ${md.lastInitError ?? 'unk
```

### Core Architecture Module: `apps/api/scripts/bench-meta-boot.ts`
```
#!/usr/bin/env bun
/**
 * Meta-agent session boot benchmark.
 *
 * `bench-boot-attribution.ts` measures ordinary sessions and needs a direct
 * Postgres connection for the host-side transitions. This one measures the
 * PLATFORM META sandbox (`sandbox_slug: 'meta'`, the `meta` runtime profile)
 * from a laptop against a deployed API, with no database access:
 *
 *   t0 ─ POST /projects/:p/sessions returns        → api_create_ms
 *      ─ GET  /sessions/:s exposes `sandbox_url`   → vm_created_ms
 *      ─ first 2xx from /kortix/health             → daemon_reachable_ms
 *      ─ health.runtimeReady === true              → runtime_ready_ms   (usable)
 *
 * plus the daemon's own `boot_timeline` (in-guest, daemon-start-relative), so a
 * boot decomposes into "waiting for the provider" vs "the guest booting itself".
 *
 * `sandbox_url` lands the moment the provider returns the VM, which is the
 * closest public proxy for the `external_id` write the DB harness watches.
 *
 * Usage:
 *   cd apps/api
 *   BENCH_API=https://dev-api.kortix.com \
 *   BENCH_TOKEN=kortix_pat_... \
 *   BENCH_PROJECT=<project with meta_agent enabled> \
 *   BENCH_ROUNDS=3 bun run scripts/bench-meta-boot.ts
 *
 * Env:
 *   BENCH_PROJECT   project id. Required. meta_agent must be enabled on it
 *                   unless BENCH_AGENT/BENCH_SLUG say otherwise.
 *   BENCH_TOKEN     kortix_pat_… Required. Environment only, never a config file.
 *   BENCH_API       API origin (default https://dev-api.kortix.com).
 *   BENCH_ROUNDS    boots per label (default 3).
 *   BENCH_LABEL     row label (default "meta").
 *   BENCH_AGENT     explicit agent for the create body (default: omitted, so
 *                   the project's meta default applies).
 *   BENCH_SLUG      explicit sandbox_slug (default: omitted).
 *   BENCH_TIMEOUT_S per-boot ceiling (default 240).
 *   BENCH_KEEP      "1" to leave the sessions behind (default: delete them).
 *   BENCH_OUT       write raw JSON here.
 */
import { writeFileSync } from 'node:fs';
import { SQL } from 'bun';

const API = (process.env.BENCH_API ?? 'https://dev-api.kortix.com').replace(/\/+$/, '');
const TOKEN = (process.env.BENCH_TOKEN ?? '').trim();
const PROJECT = (process.env.BENCH_PROJECT ?? '').trim();
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 3);
const LABEL = process.env.BENCH_LABEL ?? 'meta';
const AGENT = process.env.BENCH_AGENT ?? '';
const SLUG = process.env.BENCH_SLUG ?? '';
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_S ?? 240) * 1000;
const KEEP = process.env.BENCH_KEEP === '1';
// Optional. With it, the host-side marks the API already records
// (`session_sandboxes.metadata.provisionTimeline`) are merged into the client
// timeline, which is the only way to see WHERE the pre-VM seconds go: the
// public API exposes the outcome, never the stages that produced it.
const DB_URL = (process.env.BENCH_DB_URL ?? '').trim();
const sqlDb = DB_URL ? new SQL(DB_URL) : null;

if (!TOKEN || !PROJECT) {
  console.error('Need BENCH_TOKEN and BENCH_PROJECT.');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BootMark { label: string; atMs: number }
interface Boot {
  label: string;
  round: number;
  sessionId: string | null;
  provider: string | null;
  agent: string | null;
  slug: string | null;
  externalId: string | null;
  apiCreateMs: number | null;
  vmCreatedMs: number | null;
  daemonReachableMs: number | null;
  runtimeReadyMs: number | null;
  bootTimeline: BootMark[] | null;
  /** Wall-clock epoch of t0, so server timestamps join onto the client clock. */
  t0Epoch: number;
  sessionRowMs: number | null;
  sandboxRowMs: number | null;
  provisionMarks: { label: string; atMs: number; deltaMs: number }[] | null;
  provisionStartMs: number | null;
  error?: string;
}

function api(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(120_000),
  });
}

/** One boot, fully attributed. Never throws — a failed boot is recorded as one. */
async function measureBoot(round: number): Promise<Boot> {
  const boot: Boot = {
    label: LABEL, round, sessionId: null, provider: null, agent: null, slug: null,
    externalId: null, apiCreateMs: null, vmCreatedMs: null,
    daemonReachableMs: null, runtimeReadyMs: null, bootTimeline: null,
    t0Epoch: Date.now(), sessionRowMs: null, sandboxRowMs: null,
    provisionMarks: null, provisionStartMs: null,
  };
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);

  try {
    const body: Record<string, unknown> = {};
    if (AGENT) body.agent = AGENT;
    if (SLUG) body.sandbox_slug = SLUG;
    const res = await api(`/v1/projects/${PROJECT}/sessions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    boot.apiCreateMs = at();
    const created: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`create ${res.status}: ${JSON.stringify(created).slice(0, 300)}`);
    boot.sessionId = created?.session_id ?? created?.id ?? null;
    if (!boot.sessionId) throw new Error(`create returned no session id: ${JSON.stringify(created).slice(0, 300)}`);
    boot.provider = created?.sandbox_provider ?? null;
    boot.agent = created?.agent_name ?? null;
    boot.slug = created?.metadata?.sandbox_slug ?? null;

    // The health poll runs concurrently with the session poll: the guest is
    // already booting while the host is still finishing its bookkeeping, so
    // serializing the two would fold host writes into the in-guest numbers.
    let healthPolling: Promise<void> | null = null;
    const pollHealth = async (eid: string) => {
      while (performance.now() - t0 < TIMEOUT_MS) {
        try {
          const h = await fetch(`${API}/v1/p/${eid}/8000/kortix/health`, {
            headers: { Authorization: `Bearer ${TOKEN}` },
            signal: AbortSignal.timeout(10_000),
          });
          if (h.ok) {
            if (boot.daemonReachableMs === null) boot.daemonReachableMs = at();
            const hb: any = await h.json().catch(() => null);
            if (hb?.boot_timeline) boot.bootTimeline = hb.boot_timeline;
            if (hb?.runtimeReady) { boot.runtimeReadyMs = at(); return; }
          }
        } catch { /* daemon not up yet */ }
        await sleep(200);
      }
    };

    while (performance.now() - t0 < TIMEOUT_MS) {
      const r = await api(`/v1/projects/${PROJECT}/sessions/${boot.sessionId}`);
      const s: any = await r.json().catch(() => null);
      if (s?.status === 'error') throw new Error(`session error: ${s?.error ?? 'unknown'}`);
      const url: string | null = s?.sandbox_url ?? null;
      if (url && boot.vmCreatedMs === null) {
        boot.vmCreatedMs = at();
        // sandbox_url = `${API}/v1/p/<external_id>/8000`
        boot.externalId = url.split('/v1/p/')[1]?.split('/')[0] ?? null;
        if (boot.externalId) healthPolling = pollHealth(boot.externalId);
      }
      if (boot.runtimeReadyMs !== null) break;
      if (healthPolling) { await healthPolling; break; }
      await sleep(250);
    }
    if (healthPolling) await healthPolling;
    if (boot.runtimeReadyMs === null) boot.error ??= 'timeout before runtimeReady';
  } catch (err) {
    boot.error = err instanceof Error ? err.message : String(err);
  } finally {
    if (sqlDb && boot.sessionId) {
      try {
        const [row] = await sqlDb`
          select s.created_at as sess_created,
                 b.created_at as sbx_created,
                 b.metadata->'provisionTimeline' as tl
          from kortix.project_sessions s
          left join kortix.session_sandboxes b on b.sandbox_id::text = s.session_id::text
          where s.session_id::text = ${boot.sessionId} limit 1`;
        if (row) {
          const rel = (d: Date | string | null) => (d ? new Date(d).getTime() - boot.t0Epoch : null
```

### Core Architecture Module: `apps/api/scripts/bench-session-boot.ts`
```
#!/usr/bin/env bun
/**
 * Phase 0 benchmark harness for the session-boot 1-second threshold (goal §1).
 *
 * Times session boot (create → runtime-ready) N times against a live Kortix
 * deployment, aggregates P50/P95/P99, and prints a numbers table. This is
 * MEASUREMENT ONLY — no optimization, no behavior change. The numbers this
 * produces unblock the entire session-boot-1s workstream.
 *
 * Usage:
 *   cd apps/api && bun run scripts/bench-session-boot.ts
 *
 * Env:
 *   KORTIX_API_URL       — the API base URL (default: https://api.kortix.com/v1)
 *   KORTIX_TOKEN         — project-scoped auth token
 *   KORTIX_PROJECT_ID    — project to start sessions in
 *   BENCH_ROUNDS         — number of boot measurements (default: 10)
 *   BENCH_CONCURRENCY    — parallel sessions (default: 1; >1 stresses the pool)
 *   BENCH_TIMEOUT_S      — per-session timeout (default: 120)
 *   BENCH_WARM           — "1" to skip the first (cold) boot (default: "0")
 *
 * Output: JSON on stdout (machine-readable) + a human table on stderr.
 *
 * Untested — run manually once against staging before relying on the numbers.
 */
import { performance } from 'node:perf_hooks';

const API_URL = process.env.KORTIX_API_URL ?? 'https://api.kortix.com/v1';
const TOKEN = process.env.KORTIX_TOKEN ?? '';
const PROJECT_ID = process.env.KORTIX_PROJECT_ID ?? '';
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 10);
const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY ?? 1);
const TIMEOUT_S = Number(process.env.BENCH_TIMEOUT_S ?? 120);
const SKIP_COLD = process.env.BENCH_WARM === '1';

if (!TOKEN || !PROJECT_ID) {
  console.error('Missing KORTIX_TOKEN or KORTIX_PROJECT_ID.');
  process.exit(1);
}

interface BootResult {
  round: number;
  cold: boolean;
  createMs: number;
  readyMs: number;
  totalMs: number;
  status: string;
  error?: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${url}: ${JSON.stringify(body)}`);
  return body;
}

async function startSession(): Promise<{ sessionId: string }> {
  const body = await fetchJson(`${API_URL}/projects/${PROJECT_ID}/sessions`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return { sessionId: body.id ?? body.session_id ?? body.sessionId };
}

async function getSession(sessionId: string): Promise<any> {
  return fetchJson(`${API_URL}/projects/${PROJECT_ID}/sessions/${sessionId}`);
}

async function stopSession(sessionId: string): Promise<void> {
  await fetchJson(`${API_URL}/projects/${PROJECT_ID}/sessions/${sessionId}`, {
    method: 'DELETE',
  }).catch(() => {});
}

async function measureBoot(round: number, cold: boolean): Promise<BootResult> {
  const t0 = performance.now();
  let sessionId = '';
  try {
    const { sessionId: sid } = await startSession();
    sessionId = sid;
    const createMs = performance.now() - t0;

    const deadline = t0 + TIMEOUT_S * 1000;
    let status = 'pending';
    while (performance.now() < deadline) {
      const session = await getSession(sid);
      status = session.status ?? session.state ?? 'unknown';
      if (status === 'ready' || status === 'ok') break;
      if (status === 'failed' || status === 'error') throw new Error(`session ${status}`);
      await new Promise((r) => setTimeout(r, 500)); // 500ms poll
    }
    const readyMs = performance.now() - t0;
    const totalMs = readyMs;
    if (status !== 'ready' && status !== 'ok') throw new Error(`timeout: ${status}`);

    return { round, cold, createMs, readyMs, totalMs, status };
  } catch (err) {
    return {
      round,
      cold,
      createMs: performance.now() - t0,
      readyMs: -1,
      totalMs: -1,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (sessionId) await stopSession(sessionId);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return -1;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

async function main() {
  console.error(`\n=== session boot benchmark ===`);
  console.error(`API: ${API_URL}`);
  console.error(`Project: ${PROJECT_ID}`);
  console.error(`Rounds: ${ROUNDS} (concurrency: ${CONCURRENCY}, timeout: ${TIMEOUT_S}s, skip cold: ${SKIP_COLD})\n`);

  const results: BootResult[] = [];
  const rounds = Array.from({ length: ROUNDS }, (_, i) => i);

  // Optionally skip round 0 (cold) — the first boot warms the snapshot cache.
  const toMeasure = SKIP_COLD ? rounds.slice(1) : rounds;

  for (let i = 0; i < toMeasure.length; i += CONCURRENCY) {
    const batch = toMeasure.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((r) => measureBoot(r + 1, r === 0 && !SKIP_COLD)),
    );
    results.push(...batchResults);
    for (const r of batchResults) {
      console.error(
        `  round ${String(r.round).padStart(3)}  ${r.cold ? 'cold' : 'warm'}  ` +
        `create=${r.createMs.toFixed(0)}ms  ready=${r.readyMs > 0 ? r.readyMs.toFixed(0) + 'ms' : '—'}  ` +
        `total=${r.totalMs > 0 ? r.totalMs.toFixed(0) + 'ms' : '—'}  ${r.status}${r.error ? '  ' + r.error : ''}`,
      );
    }
  }

  const ok = results.filter((r) => r.totalMs > 0);
  const totals = ok.map((r) => r.totalMs).sort((a, b) => a - b);
  const creates = ok.map((r) => r.createMs).sort((a, b) => a - b);

  const summary = {
    api: API_URL,
    project: PROJECT_ID,
    rounds: ROUNDS,
    succeeded: ok.length,
    failed: results.length - ok.length,
    total_ms: totals.length
      ? { p50: percentile(totals, 50), p95: percentile(totals, 95), p99: percentile(totals, 99), min: totals[0], max: totals[totals.length - 1] }
      : null,
    create_ms: creates.length
      ? { p50: percentile(creates, 50), p95: percentile(creates, 95), p99: percentile(creates, 99) }
      : null,
    one_second_threshold: totals.length ? { met: percentile(totals, 95) < 1000, p95_ms: percentile(totals, 95) } : null,
    results,
  };

  console.error(`\n=== summary ===`);
  if (totals.length) {
    console.error(`  total: P50=${(percentile(totals, 50)).toFixed(0)}ms  P95=${(percentile(totals, 95)).toFixed(0)}ms  P99=${(percentile(totals, 99)).toFixed(0)}ms  min=${totals[0].toFixed(0)}ms  max=${(totals[totals.length - 1]).toFixed(0)}ms`);
    console.error(`  create: P50=${(percentile(creates, 50)).toFixed(0)}ms  P95=${(percentile(creates, 95)).toFixed(0)}ms`);
    const p95 = percentile(totals, 95);
    console.error(`  1s threshold (P95 < 1000ms): ${p95 < 1000 ? '✅ MET' : '❌ NOT MET'} (${p95.toFixed(0)}ms)`);
  } else {
    console.error(`  no successful boots — check errors above`);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

```

### Core Architecture Module: `apps/api/scripts/boot-image-kind.ts`
```
import { PPWARM_PREFIX, SCOPED_PPWARM_PREFIX } from '../src/snapshots/quota-gc-select';

/**
 * Complete names of the two RETIRED per-project warm image formats. The baker is
 * gone; these names only ever appear now in persisted boot telemetry, which this
 * report classifies after the fact. Kept here (not in the deleted namer) because
 * this is the last consumer.
 */
const EXACT_PPWARM_IMAGE_NAME =
  /^(?:kortix-ppwarm-(?:[0-9a-f]{8}-[0-9a-f]{12}|[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{12})|kpp2-[0-9a-f]{12}-[0-9a-f]{12}-[0-9a-f]{16}-[0-9a-f]{16})$/;

function isExactPpwarmImageName(name: string): boolean {
  return EXACT_PPWARM_IMAGE_NAME.test(name);
}

export type BootImageKind =
  | 'ppwarm'
  | 'default-cold'
  | 'per-project-tpl'
  | 'unknown';

export type TelemetryImageKind =
  | 'warm-hit'
  | 'cold-shared-default'
  | 'cold-per-project-template'
  | 'unknown'
  | 'other';

export interface TelemetryImageRefRow {
  provider: string;
  image_ref: string | null;
  n: number;
}

export interface TelemetryImageRow {
  provider: string;
  image_kind: TelemetryImageKind;
  n: number;
}

/**
 * Historical project images used prefix-only recognition. Keep that behavior
 * for persisted telemetry. Scoped project images use a new namespace and must
 * match its complete shape so an unrelated `kpp2-` value is never counted.
 */
export function classifyBootImage(ref: string | null): BootImageKind {
  if (!ref) return 'unknown';
  if (ref.startsWith(PPWARM_PREFIX)) return 'ppwarm';
  if (ref.startsWith(SCOPED_PPWARM_PREFIX) && isExactPpwarmImageName(ref)) {
    return 'ppwarm';
  }
  if (ref.startsWith('kortix-default-')) return 'default-cold';
  if (ref.startsWith('kortix-tpl-')) return 'per-project-tpl';
  return 'unknown';
}

export function classifyTelemetryImage(ref: string | null): TelemetryImageKind {
  if (ref === null) return 'unknown';
  switch (classifyBootImage(ref)) {
    case 'ppwarm':
      return 'warm-hit';
    case 'default-cold':
      return 'cold-shared-default';
    case 'per-project-tpl':
      return 'cold-per-project-template';
    default:
      return 'other';
  }
}

export function aggregateTelemetryImages(
  rows: readonly TelemetryImageRefRow[],
): TelemetryImageRow[] {
  const counts = new Map<string, TelemetryImageRow>();
  for (const row of rows) {
    const imageKind = classifyTelemetryImage(row.image_ref);
    const key = `${row.provider}\u0000${imageKind}`;
    const current = counts.get(key);
    if (current) {
      current.n += row.n;
      continue;
    }
    counts.set(key, { provider: row.provider, image_kind: imageKind, n: row.n });
  }
  return [...counts.values()].sort(
    (a, b) => a.provider.localeCompare(b.provider) || b.n - a.n,
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8486** (2026-09-30): **fix(apps): App viewer tokens stop 401ing after an access-policy save, and stop leaking into App logs**
  *Symptoms*: ## Summary  A self-hosted customer App running with `viewer_token_scope: 'api'` ("Acts as them in Kortix") got intermittent `401 Invalid OAuth access token` from the API. Its access log also exposed the viewer token. The customer's audit log shows the pattern. One case: 119 of 228 viewer-token calls failed (52%) in the 22 min after an access-policy save, on a 2-replica API. A second report showed the same pattern after 4 further saves. This PR fixes four defects on that path.  1. **The token cache served revoked tokens** (`apps/api/src/apps/viewer.ts`). An access-policy save revokes every viewer token in the DB. It clears the in-process cache only on the replica that handled the save. Every other replica kept sending the dead token, for up to 55 min. A cache hit is now re-checked with `validateOAuthAccessToken`, the API's own validator. That one check covers all 10 revocation paths: the policy save, `/v1/oauth/revoke`, and consent revokes. 2. **The WebSocket and preview-subdomain paths refused viewer tokens** (`apps/api/src/sandbox-proxy/preview-auth.ts`). `kortix_oat_…` fell into the API-key lookup and got 401. `/v1/p/...` over HTTP (`combinedAuth`) accepted the same token. `preview-auth.ts` now accepts it with the `kortix` scope and checks sandbox ownership, like `combinedAuth`. 3. **The browser SDK replayed a 401 with the same token** (`packages/sdk`). `kortixAppViewerToken()` kept returning its cached token, so the transport's one 401 replay gave up. `getToken` may now ca
  **Post-Mortem & Fix Analysis**:
  > [vc]: #KucNhUWLrDAmTUIASh/f3B7DRpPBz7jDFbhft56XTtg=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS8zS3YyQjJVeEVSWVlKaTVkRVRoQWN4eFFMZXZDIiwicHJldmlld1VybCI6InN1bmEtZ2l0LWFwcC12aWV3ZXItdG9rZW4ta29ydGl4YWkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWtvcnRpeC1haSZyZXBvPXN1bmEmcHI9ODQ4NiJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/suna"><sup><img src="https:
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed all 18 changed files in PR #8486. The production-code changes are four genuine security fixes: (1) `mintAppViewerToken` now re-validates every cached viewer token with `validateOAuthAccessToken` before serving it, closing the cross-replica revoked-token window — the re-mint path derives scope from a fresh DB row (`loadPublicAppState` reads per request), so a scope downgrade cannot re-mint a wider token; (2) `preview-auth.ts` accepts `kortix_oat_` tokens on the WebSocket/subdomain edges only with the `kortix` scope plus `canAccessPreviewSandbox`, matching `combinedAuth` parity without granting new capability; (3) Caddy access logs drop request headers, removing viewer/ingress credentials from `kortix apps logs`; and (4) the SDK transport invalidates a rejected viewer token before its single 401 replay. The token-invalidation logic only drops the exac

- **Issue #8483** (2026-09-30): **fix(db): repair main after 699dadc38a — project_usage_read sorts after the migrations already applied**
  *Symptoms*: ## Summary  Deploy Dev fails on every `main` commit since #8457:  ``` error: Not run migration 20260930150000000_project_usage_read is preceding already run migration 20260930151406016_session_labels ```  #8457 added a hand-written seed migration with a timestamp (15:00:00) older than `20260930151406016_session_labels`, which #8249 had merged earlier and dev had already applied. node-pg-migrate's `checkOrder` refuses every later `migrate`.  **Fix:** pure rename to `20260930172039000_project_usage_read.sql` (the "Out-of-order migration timestamps" fix in the kortix-release skill; same shape as #8010). The file is idempotent seed SQL (`ON CONFLICT DO NOTHING`), has no drizzle snapshot or journal entry, and has not run on dev (dev's newest applied migration is `20260930151406016_session_labels`), staging, or prod.  ## Demo video  No UI change.  ## Type of change  - [x] Bug fix - [ ] New feature - [ ] Refactor / chore - [ ] Docs / skills - [x] Infrastructure / CI - [ ] Security fix - [ ] Breaking change  ## How was this tested?  - `pnpm --filter @kortix/db lint` → `Found 0 issues in 162 files`. - `pnpm test -- --db-only iam-role-catalog-parity migration-status` → PASS 2/2 suites, 15 tests (fresh migrated databases).  ## Security & data review  - [x] No secrets, keys, or credentials are committed (verified by secret scan / review) - [x] Authorization checks are in place for any new/changed endpoints (IAM / access control) (none) - [x] User input is validated (e.g. Zod) and output 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #wiuHQIQjoFrUBuk0jTn/cqdOr2uYYzPUt+CrCx8VVz4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS82cVh3OFZIOHNjMlEzSlBxM2RzcnBRRDFiWFI0IiwicHJldmlld1VybCI6InN1bmEtZ2l0LWluby1yZXBhaXItcHJvamVjdC11c2FnZS1yZWFkLW9yZGVyLWtvcnRpeGFpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiSUdOT1JFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1rb3J0aXgtYWkmcmVwbz1zdW5hJnByPTg0ODMifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  This PR performs a pure filename rename of a single database migration (`20260930150000000_project_usage_read.sql` → `20260930172039000_project_usage_read.sql`) to repair out-of-order migration timestamps. The diff shows a 100% similarity rename with no content, logic, or behavioral changes. The renamed seed SQL is idempotent (`ON CONFLICT DO NOTHING`) and backfill-safe, and contains no endpoints, authentication/authorization logic, user input handling, secrets, or dangerous sinks. No security findings were identified in the changed code.  </details>  <sub>Updated for `1a18568`.</sub>  --- *Reviewed by [Strix](https://strix.ai)* <sub>[Re-run review](https://app.strix.ai/api/pr-reviews/rerun?review_id=3602a942-365c-459d-9810-ed1c12748d0b) · [Configure security review settings](https://app.strix.ai/repositories/af7f4d79-2ea3-4790-bbf7-c1e4cdcae7fa)</sub>
  > <!-- dev-live --> ### Live on dev — 13m 18s after merge  `28799c80d4` serves on every surface this deploy changed, checked on `/health`.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `28799c80d4` | | Gateway · gateway-dev.kortix.com | serving `28799c80d4` | | Web · dev.kortix.com | serving `28799c80d4` |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/36750777584. Shipped together with #8448, #8472, #8457, #8458, #8459, #8460, #8462, #8463, #8464, #8465, #8467, #8479, #8478, #8466, #8482.

- **Issue #8482** (2026-09-30): **fix(sessions): reload brings the base branch agent config into a session without config releases**
  *Symptoms*: ## Summary  **Problem.** On a project without `config_releases` (the default: `registry.ts` `platformDefault: () => false`), OpenCode reads its agent files from the session's own checkout (`OPENCODE_CONFIG_DIR` → `/workspace/<config dir>`). "Reload config" only fast-forwarded the session branch (`git pull --ff-only origin <session>`), so a fix merged to the base branch never reached a live session. Seen on prod 2026-09-30: an agent `.md` fix merged to a project's `main` did not reach its long-lived Slack triage session through two reloads. On current daemons the reload did not even restart OpenCode: they advertise `config.release.v1`, so the governance push returns early.  **Cause.** #7403 moved "sessions run the base config" behind `config_releases` and removed the config-dir sync #6083 had added to every reload (`syncConfigDirToBase`, and its test file). The flag-off path, where most projects are, lost it.  **Fix.** - `apps/kortix-sandbox-agent-server/src/lib/git/git.ts`: restore `syncConfigDirToBase` unchanged. It touches one literal pathspec (`GIT_LITERAL_PATHSPECS`), never moves a ref, refuses the session's own uncommitted edits or commits in the dir, and leaves an unstaged change whose diff against base is empty. - `POST /kortix/refresh?base_config=1` (`routes/kortix/refresh.ts`, `harness/open-code/control.ts`): runs it on the config dir OpenCode actually reads, only when that dir is inside the checkout (the boot link), and reloads OpenCode when files changed — even und
  **Post-Mortem & Fix Analysis**:
  > [vc]: #nNPaPsaM4XEqRgxFSL8Z/wTrJKlFS+lyuSp4DhcxR14=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS80UUdFdFhBamVYVVBhYVJ5VnlNODlSR3pKV2Z6IiwicHJldmlld1VybCI6InN1bmEtZ2l0LWluby1yZWxvYWQtYmFzZS1hZ2VudC1jb25maWcta29ydGl4YWkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWtvcnRpeC1haSZyZXBvPXN1bmEmcHI9ODQ4MiJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/suna"><sup>
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed all ten changed files in PR #8482, which restores the flag-off config-dir sync path for sessions without config releases. The new `syncConfigDirToBase` helper and `base_config=1` refresh flag are the security-relevant additions. I traced the full data flow from the refresh route through the OpenCode control service into the git layer, and verified the key hardening claims: the config directory passes through `isPlainConfigDir`/manifest validation and a boot-link containment check before becoming a git pathspec, and `GIT_LITERAL_PATHSPECS=1` was empirically confirmed to neutralize both `:(...)` magic and glob wildcards. Git invocations use argument-array spawning (no shell), `base_sha` is strictly validated as 40-hex, the refresh route retains its existing `authorizeControl` gate, and the non-destructive sync refuses local edits/commits without movin
  > <!-- dev-live --> ### Live on dev — 14m 54s after merge  `28799c80d4` serves on every surface this deploy changed, checked on `/health`.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `28799c80d4` | | Gateway · gateway-dev.kortix.com | serving `28799c80d4` | | Web · dev.kortix.com | serving `28799c80d4` |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/36750777584. Shipped together with #8448, #8472, #8457, #8458, #8459, #8460, #8462, #8463, #8464, #8465, #8467, #8479, #8478, #8466, #8483.

- **Issue #8481** (2026-09-30): **fix(cli): repair split-manifest wiring fixtures (KRTX-174)**
  *Symptoms*: ## Review in 60 seconds - KRTX-174: the merged wiring lint correctly requires real agent files; three pre-existing split-manifest CLI tests used agents without files. - Add the two synthetic agent files to their shared fixture, preserving production validation behavior. - Keep the existing validation strict instead of weakening the lint to satisfy old fixtures. No demo video: code-only change **Risk:** low — test fixture only. **Verified:** 8 focused tests passed, CLI typecheck passed; full suite and local stack cannot start Docker/Supabase in this sandbox. ESLint unavailable for CLI (no eslint.config); Biome flags existing formatting in the fixture. suna-skills: worktree, testing, learnings, contributing ponytail: full · review: Lean already. Ship. · markers: 0  ## Summary Fix the split-manifest fixture after KRTX-174's wiring lint started checking actual agent files. Closes KRTX-174.  ## Demo video No demo video: code-only change.  ## Type of change - [x] Bug fix - [ ] New feature - [ ] Refactor / chore - [ ] Docs / skills - [ ] Infrastructure / CI - [ ] Security fix - [ ] Breaking change  ## How was this tested? - `bun test apps/cli/src/__tests__/manifest-imports.test.ts` → exit 0; 8 pass, 0 fail, 27 assertions (4.22s). This invokes real CLI processes including `validate --json` and trigger add/remove. - `pnpm --filter @kortix/cli typecheck` → exit 0; `tsc --noEmit`. - `pnpm exec eslint apps/cli/src/__tests__/manifest-imports.test.ts` → exit 2: ESLint 9 cannot find eslint.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #yG92RtKKW4/9Mi51kiyYSjuB8Oa3IoAvB3i/Wabyxes=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2tvcnRpeGFpL3N1bmEvNkpONjN3RDNBNFJobUZGcFFkdEhFUlI4SHBCMyIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1rb3J0aXgtYWkmcmVwbz1zdW5hJnByPTg0ODEifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/suna"><sup><img src="https://vercel.com/api/www/avatar?projectId=prj_SoUUSNJPvOTDneE0E7faWHFuWMAY&teamId=team_6wPTUrLXccl65xQAt
  > <!-- linear-linkback --> <p><a href="https://linear.app/kortix/issue/KRTX-174">KRTX-174</a></p>
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  The PR adds two static markdown agent-file fixtures to a CLI test setup so split-manifest tests pass the tightened wiring lint. The change is confined to a test fixture (+2 lines) with no production code, no secrets, and no security-relevant data flow. No vulnerabilities were identified.  </details>  <sub>Updated for `beff7e4`.</sub>  --- *Reviewed by [Strix](https://strix.ai)* <sub>[Re-run review](https://app.strix.ai/api/pr-reviews/rerun?review_id=d964888b-1a90-45ef-a083-f9a787998030) · [Configure security review settings](https://app.strix.ai/repositories/af7f4d79-2ea3-4790-bbf7-c1e4cdcae7fa)</sub>

- **Issue #8480** (2026-09-30): **refactor(mobile): reuse SDK session health probe (KRTX-771)**
  *Symptoms*: ## Review in 60 seconds - KRTX-771: The mobile connect loop now probes sandbox health through the SDK authenticated fetch instead of a second host fetch. - Preserves 503, boot error, ready, and signal-less responses with a focused characterization test. The loop moved from ProjectScreen to `project-connect.ts` on main; this PR updates its actual owner. - SDK canonical probe replaces host fetch.  No demo video: code-only change  **Risk:** medium — The SDK health parser and native fetch behavior could differ on malformed proxy responses; local device execution is unavailable. **Verified:** Feedback merge conflict resolved on 270fae3b6 (mergeable); focused test 1 pass and session suite 1388 pass; `git diff --check origin/main` clean. Focused tests pass. Full `pnpm test` and local stack cannot start because sandbox Docker lacks netfilter/bridge support. Mobile typecheck has pre-existing failures outside changed files; eslint configuration is not installed for mobile.  suna-skills: worktree, testing, learnings, contributing, sdk. ponytail: full · review: Lean already. Ship. · markers: 0  ## Summary Replace mobile's hand-rolled health request with `getSessionHealth` and retain the existing readiness mapping. Closes KRTX-771.  `git diff --color-moved=zebra --color-moved-ws=allow-indentation-change origin/main`: the original health type and its incident comments move intact to `project-health.ts`; the obsolete fetch is deleted. LOC: 47 deleted → 51 added (`git diff --shortstat origin
  **Post-Mortem & Fix Analysis**:
  > [vc]: #koW1iNm3I61H5jrZ+ektWagT1R50j6pSgA/dQ5WVa2Q=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9rb3J0aXhhaS9zdW5hLzhGRTRjR2JSWHhkd2Z4ZXo0dXJLcUZ6VjZpaTciLCJuZXh0Q29tbWl0U3RhdHVzIjoiSUdOT1JFRCIsInJvb3REaXJlY3RvcnkiOiJhcHBzL3dlYiIsInByZXZpZXdVcmwiOiJzdW5hLWdpdC1rcnR4LTc3MS1rb3J0aXhhaS52ZXJjZWwuYXBwIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1rb3J0aXgtYWkmcmVwbz1zdW5hJnByPTg0ODAifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/suna"><sup><img src="https://vercel
  > <!-- linear-linkback --> <p><a href="https://linear.app/kortix/issue/KRTX-771">KRTX-771</a></p>
  > <!-- strix-pr-review:master --> ## Strix Security Review  <!-- strix-pr-review:unreviewed-commits --> > [!WARNING] > This pull request has **7 commits** after the last Strix review (`3cfa603`). Strix has **not** reviewed these changes. > Automatic review on push is off for this repository. To review the latest changes, tag `@strix-security` in a comment, or [turn on re-review on push](https://app.strix.ai/repositories/af7f4d79-2ea3-4790-bbf7-c1e4cdcae7fa). <!-- /strix-pr-review:unreviewed-commits -->  No security issues found.  <details> <summary>Review summary</summary>  Reviewed the three changed files: `apps/mobile/lib/session/project-connect.ts`, the new `apps/mobile/lib/session/project-health.ts`, and its characterization test. The PR swaps mobile's hand-rolled `probeSandboxHealth` for the SDK's pre-existing `getSessionHealth` and extracts the existing readiness parsing into a pure `mapSandboxHealth` function. Traced both code paths end to end: auth token resolution is unchanged (

- **Issue #8479** (2026-09-30): **chore(secrets): per-env OpenCode Zen key in api env profiles**
  *Symptoms*: ## Summary  Adds `OPENCODE_ZEN_API_KEY` to the four API dotenvx profiles. #8303 and #8313 put OpenCode Zen first for `glm-5.3-flash`, but the route stayed inert because no environment had a funded Zen key. Each environment now has its own key: local and dev share the dev key, and staging and prod each have their own. The deployed environments read AWS Secrets Manager, and the same keys were written there in the same change. These files keep parity with those blobs.  ## Demo video  No user-visible surface. The change is encrypted env values. The proof is the dev gateway request and usage row listed under "How was this tested?".  ## Type of change  - [x] Infrastructure / CI  ## How was this tested?  - Each key answered `glm-5.3-flash` on `https://opencode.ai/zen/v1/chat/completions` with HTTP 200. - `dotenvx get OPENCODE_ZEN_API_KEY` decrypts in all 4 profiles to the expected key prefix. - `pnpm test:envs`: `OPENCODE_ZEN_API_KEY` passes separation in local, dev, and staging. The only failure is `MORPH_API_KEY == prod`, which predates this change: one Morph key is in all 4 profiles. - AWS SM: `OPENCODE_ZEN_API_KEY` was added to `kortix-dev-env`, `kortix-preview-env`, `kortix-staging-env`, `kortix-prod-env` (us-west-2 primary, eu-west-2 replica verified), and `kortix-prod-us-east-2-env`. A read-back diff shows that no other key changed. - ECS force-new-deployment ran on the dev and staging API and gateway services. The result of the dev check is in the PR comments.  ## Security &
  **Post-Mortem & Fix Analysis**:
  > [vc]: #tAL2QgG91Pp28rIjflQUlNEedbNISNJnnc7qug8Adjs=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2tvcnRpeGFpL3N1bmEvQWluUW13TDQ3UVlwU1lHZ0o1NGdSdHBTUHAyVSIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1rb3J0aXgtYWkmcmVwbz1zdW5hJnByPTg0NzkifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/suna"><sup><img src="https://vercel.com/api/www/avatar?projectId=prj_SoUUSNJPvOTDneE0E7faWHFuWMAY&teamId=team_6wPTUrLXccl65xQAt
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed all four changed files in this PR. Each change adds a single `OPENCODE_ZEN_API_KEY` entry to an API dotenvx profile (`.env`, `.env.dev`, `.env.staging`, `.env.prod`). All four values are dotenvx ciphertext (`encrypted:`-prefixed, opaque base64), matching the established pattern used by the dozens of other secrets already in these committed files. The repository's `.gitignore` confirms dotenvx private decryption keys (`.env.keys`) are excluded from git, so the ciphertext is not independently usable. No plaintext secrets, credentials, or other security-relevant changes were introduced by this PR.  </details>  <sub>Updated for `2d881f0`.</sub>  --- *Reviewed by [Strix](https://strix.ai)* <sub>[Re-run review](https://app.strix.ai/api/pr-reviews/rerun?review_id=050209a5-9e1e-4aa7-82f5-89ebb7983c5b) · [Configure security review settings](https://app.strix
  > Dev verified after the SM write and ECS restart (kortix-dev + kortix-dev-gateway, rollout COMPLETED): `POST https://dev-api.kortix.com/v1/llm/chat/completions` with `glm-5.3-flash` returned 200; the dev `kortix.usage_events` row at 16:48:45Z has `metadata.upstreamProvider = opencode`. Staging restarted (COMPLETED); no GLM traffic since then yet. Prod restart in progress.

- **Issue #8478** (2026-09-30): **fix(api): the session token acts as the person who starts each turn**
  *Symptoms*: ## Summary  A session sandbox holds one Kortix credential (`account_tokens` row, `KORTIX_TOKEN`) for its whole life, and its `user_id` was the member who provisioned it. When a second member prompted a shared session, the agent kept acting as the first member in every call it made: authorization (launcher ∩ agent grant when `agent_principal` is off), LLM usage attribution and member budgets, and git/API audit. The first foreign prompt also cleared `on_behalf_of` permanently, so the launcher lost their personal connections for the rest of the session.  This PR binds the session token to the person who starts each turn, **without minting a new secret**. Identity lives on the token row, and every consumer (`validateAccountToken`, LLM gateway, git proxy, preview proxy) reads that row fresh per request. So one conditional UPDATE at turn start re-points everything. The UPDATE writes nothing when the token already acts as the prompter.  Rules, as decided on the design question (R2.9 / D8 in the API + SDK refactor plan):  1. **Person prompts** (web, mobile, CLI, direct `prompt_async`/`command`, linked Slack/Teams sender): `user_id` and `on_behalf_of_user_id` become the prompter. The cleared stamp is removed, so a re-mint follows them. 2. **Non-person prompts** (trigger, email, Telegram, unlinked Slack, service account, API key): `on_behalf_of` is cleared and `user_id` is kept. The automation actor is never bound: it is the account owner, and binding it would widen authority. 3. **Age
  **Post-Mortem & Fix Analysis**:
  > @DimitrijeGlibic is attempting to deploy a commit to the **Kortix AI Corp** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Kortix%20AI%20Corp&slug=kortixai&teamId=team_6wPTUrLXccl65xQAtgxIFIt6&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%229e0bdf6e4a68e5dde1ab4725ade00c2063d547a7%22%7D%2C%22id%22%3A%22QmbZtFUdLjgsdLTXacXtWp3Be1RuYUDUKE7mhoeBPmjFhA%22%2C%22org%22%3A%22kortix-ai%22%2C%22prId%22%3A8478%2C%22repo%22%3A%22suna%22%7D).  
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed all 19 changed files, with deep tracing of the new session-token identity binding. The core `bindSessionTurnIdentity` statement uses drizzle-orm `sql` tagged templates, so all interpolated values (prompter id, account id, session id) become bound parameters rather than raw SQL — no injection surface exists. The `user_id`/`on_behalf_of` mutation only ever binds the token to the authenticated prompter, and only while that prompter is a member of the session's account (re-checked in the same SQL statement), so no cross-member or cross-account privilege escalation is possible. Both new `bindTurnIdentity` signals derive from existing, well-tested auth predicates (`isProjectSessionPrincipal`, `isSandboxAuthored`) that correctly separate person, agent-session, and sandbox credentials. Binding failures fail closed (delivery retry or fixed 502). The change i
  > <!-- dev-live --> ### Live on dev — 38m 58s after merge  `28799c80d4` serves on every surface this deploy changed, checked on `/health`.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `28799c80d4` | | Gateway · gateway-dev.kortix.com | serving `28799c80d4` | | Web · dev.kortix.com | serving `28799c80d4` |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/36750777584. Shipped together with #8448, #8472, #8457, #8458, #8459, #8460, #8462, #8463, #8464, #8465, #8467, #8479, #8466, #8482, #8483.

- **Issue #8476** (2026-09-30): **fix(api): retain implicit audit on failed explicit write (KRTX-104)**
  *Symptoms*: ## Review in 60 seconds  - Keep automatic request audit as the default at the API edge. - Record an explicit action as a stand-in only after its write succeeds; a failed synchronous write no longer hides the request. - Add a regression that fails before the fix and passes after it.  No demo video: code-only change  **Risk:** Low — async queue acceptance still cannot guarantee durable persistence; queue overflow remains best-effort by design. **Verified:** focused test → 10 pass; API typecheck → exit 0; full `pnpm test` and local stack → unavailable: sandbox Docker lacks netfilter/bridge; ESLint → unavailable: API has no ESLint config (Biome reports pre-existing violations). suna-skills: worktree, testing, learnings, contributing (references: attachments, preview-environments), ponytail, ponytail-review ponytail: full · review: Lean already. Ship. · markers: 0  ## Summary  KRTX-104: The existing API edge already audits inbound dispatch implicitly. A successful explicit domain event substitutes for the edge row. This PR fixes the case where an explicit synchronous write fails: the edge must not treat that failed event as persisted. This interpretation retains the existing probe, anonymous-traffic and bounded-queue policies rather than claiming lossless persistence.  Closes KRTX-104  ## Demo video  No demo video: code-only change  ## Type of change  - [x] Bug fix - [ ] New feature - [ ] Refactor / chore - [ ] Docs / skills - [ ] Infrastructure / CI - [ ] Security fix - [ ] Break
  **Post-Mortem & Fix Analysis**:
  > [vc]: #RjbzN74BhGUOovgrVKIe41VqgUcJlpNkkmAfQvEF0W0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS9HNXNRanpNcWl2OWp3cFBOWFNVRGMyc1dpMWIyIiwicHJldmlld1VybCI6InN1bmEtZ2l0LWtydHgtMTA0LWF1ZGl0LWJvdW5kYXJ5LWtvcnRpeGFpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiSUdOT1JFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1rb3J0aXgtYWkmcmVwbz1zdW5hJnByPTg0NzYifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/suna"><sup><img
  > <!-- linear-linkback --> <p><a href="https://linear.app/kortix/issue/KRTX-104">KRTX-104</a></p>
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  PR #8476 reorders `recordAuditEvent` in `apps/api/src/shared/audit.ts` so the inbound audit scope's `recordedActions` is marked only after the audit write (synchronous insert or queue enqueue) succeeds, instead of before. This corrects a bug where a failed explicit synchronous write previously suppressed the edge's implicit request row, hiding the request from the audit log. The change strictly improves audit completeness on the failure path: a rejected write now falls through to the request-level audit row, and there is no new user input, authorization path, secret handling, or dangerous sink. The accompanying test additions are mock/test-only. No security vulnerabilities were identified.  </details>  <sub>Updated for `1c4e7e1`.</sub>  --- *Reviewed by [Strix](https://strix.ai)* <sub>[Re-run review](https://app.strix.ai/api/pr-reviews/rerun?review_id=79baa1

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `596cb90c` (2026-09-30)
**Commit Message**: fix(apps): App viewer tokens stop 401ing after an access-policy save, and stop leaking into App logs (#8486)

## Summary

A self-hosted customer App running with `viewer_token_scope: 'api'`
("Acts as them in Kortix") got intermittent `401 Invalid OAuth access
token` from the API. Its access log also exposed the viewer token. The
customer's audit log shows the pattern. One case: 119 of 228
viewer-token calls failed (52%) in the 22 min after an access-policy
save, on a 2-replica API. A second report showed the same pattern after
4 further saves. This PR fixes four defects on that path.

1. **The token cache served revoked tokens**
(`apps/api/src/apps/viewer.ts`). An access-policy save revokes every
viewer token in the DB. It clears the in-process cache only on the
replica that handled the save. Every other replica kept sending the dead
token, for up to 55 min. A cache hit is now re-checked with
`validateOAuthAccessToken`, the API's own validator. That one check
covers all 10 revocation paths: the policy save, `/v1/oauth/revoke`, and
consent revokes.
2. **The WebSocket and preview-subdomain paths refused viewer tokens**
(`apps/api/src/sandbox-proxy/preview-auth.ts`). `kortix_oat_…` fe

**File**: `.agents/skills/learnings/MEMORY.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ Open the entry for the incident, the trigger surface, and the enforcement.
 
 Generated by `scripts/index.sh` from `entries/`. Do not edit by hand.
 
+- `2026-09-30 17:10:47Z` [Re-check a cached credential against its row before handing it out; a revoke on one replica never reaches another replica's memory](entries/2026-09-30T171047Z-re-check-a-cached-credential-against-its-row-before-handing.md)
 - `2026-09-30 17:17:38Z` [When a mechanism moves behind a flag, keep the flag-off path's behaviour: most projects stay there](entries/2026-09-30T171738Z-when-a-mechanism-moves-behind-a-flag-keep-the-flag-off-path.md)
 - `2026-09-30 16:30:09Z` [Apply a new list filter to every row a list appends after its query, not only to the query](entries/2026-09-30T163009Z-apply-a-new-list-filter-to-every-row-a-list-appends-after-it.md)
 - `2026-09-30 14:07:28Z` [Classify invalid connector GraphQL as a caller error before reporting an upstream failure](entries/2026-09-30T140728Z-classify-invalid-connector-graphql-as-a-caller-error-before.md)
```

**File**: `.agents/skills/learnings/entries/2026-09-30T171047Z-re-check-a-cached-credential-against-its-row-before-handing.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+recorded: 2026-09-30T17:10:47Z
+incident_date: 2026-09-30
+---
+# Re-check a cached credential against its row before handing it out; a revoke on one replica never reaches another replica's memory
+
+**Rule:** An in-process cache of a credential (a token plaintext, a signed handle) must re-validate the credential's row before it hands the credential out. Clearing the cache inside the revoke function is not enough: the revoke runs on one API replica, and every other replica keeps its copy.
+
+**Trigger surface:** adding or changing a `Map`/LRU that holds a credential, and any code path that revokes one (`revokedAt`, status flips, policy saves) while another process may hold it. Related: `2026-08-24T082044Z-provider-traffic-credentials-need-a-cross-replica-refresh-bo.md`.
+
+**Incident:** 2026-09-30, a self-hosted deployment with 2 API replicas. Every access-policy save on an App with `viewer_token_scope: 'api'` revoked its viewer tokens in the DB, but `mintAppViewerToken` on the other replica kept serving the dead token for up to 55 min: 119 of 228 viewer-token API calls (52%) answered `401 Invalid OAuth access token`. Reproduced with 2 local replicas (5 of 10 → 0 of 10 after the fix). The same App's Caddy access log also printed the viewer token and the provider ingress token.
+
+**Enforcement:** `apps/api/src/apps/viewer-token.integration.test.ts` ("a token revoked outside this process is never handed out again") goes red when the cache hit skips the row check. Log redaction: `TestCaddyAccessLogDropsRequestHeaders` in `apps/kortix-app-runtime/main_test.go`.
```

**File**: `apps/api/src/__tests__/unit-preview-auth-principal.test.ts` (modified, +28/-0)
```diff
@@ -77,6 +77,20 @@ mock.module('../repositories/service-accounts', () => ({
   deleteServiceAccount: unmocked('service-accounts.deleteServiceAccount'),
 }));
 
+// App viewer tokens (`kortix_oat_`): the credential an App's server sends when
+// it acts as its viewer. combinedAuth accepts one on `/v1/p/...`; these edges
+// must too, and only with the `kortix` scope.
+const actualOAuth = await import('../oauth/access-token');
+mock.module('../oauth/access-token', () => ({
+  ...actualOAuth,
+  validateOAuthAccessToken: async (t: string) => {
+    if (t === 'kortix_oat_owner') return { isValid: true, userId: 'user-owner', scopes: ['profile', 'email', 'kortix'] };
+    if (t === 'kortix_oat_identity') return { isValid: true, userId: 'user-owner', scopes: ['profile', 'email'] };
+    if (t === 'kortix_oat_other') return { isValid: true, userId: 'user-other', scopes: ['profile', 'email', 'kortix'] };
+    return { isValid: false, error: 'Invalid OAuth access token' };
+  },
+}));
+
 mock.module('../shared/jwt-verify', () => ({
   decodeSupabaseJwtPayload: () => null,
   verifySupabaseJwt: async (t: string) => {
@@ -188,6 +202,20 @@ describe('authenticatePreviewPrincipalDetailed — which credentials prove a pri
     expect(await principalId('kortix_bad')).toBeNull();
   });
 
+  // ── App viewer token (kortix_oat_) — WS + subdomain used to send it to the API-key table ──
+  test('accepts an App viewer token with the kortix scope and returns the viewer', async () => {
+    expect(await principalId('kortix_oat_owner')).toBe('user-owner');
+  });
+  test('rejects an identity-only viewer token: profile/email never opens a sandbox', async () => {
+    expect(await principalId('kortix_oat_identity')).toBeNull();
+  });
+  test('rejects a viewer token whose viewer lacks sandbox access', async () => {
+    expect(await principalId('kortix_oat_other')).toBeNull();
+  });
+  test('rejects a revoked or unknown viewer token', async () => {
+    expect(await principalId('kortix_oat_revoked')).toBeNull();
+  });
+
   // ── Supabase JWT ───────────────────────────────────────────────────────────
   test('accepts a JWT owner via local verify', async () => {
     expect(await principalId('jwt-owner')).toBe('user-owner');
```

**File**: `apps/api/src/apps/public-proxy-access.ts` (modified, +2/-1)
```diff
@@ -314,7 +314,8 @@ export interface AppViewerHeaders {
  * App shares nothing (`off`) or nobody is signed in.
  *
  * The token mint is cached in-process per (App, viewer), so this costs one
- * `Map` lookup on the hot path after the first request of each hour.
+ * `Map` lookup and one token-row read on the hot path after the first request
+ * of each hour. The read is what keeps a token revoked elsewhere off the wire.
  */
 export async function appViewerContextHeader(
   request: Request,
```

**File**: `apps/api/src/apps/viewer-token.integration.test.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
+import { accounts, apps, createDb, oauthAccessTokens, oauthClients, projects, type Database } from '@kortix/db';
+import { eq } from 'drizzle-orm';
+import { validateOAuthAccessToken } from '../oauth/access-token';
+import { mintAppViewerToken, resetAppViewerCaches, revokeAppViewerTokens } from './viewer';
+
+const CONFIRMATION = 'I_UNDERSTAND_THIS_DELETES_TEST_DATA';
+const HAS_CONFIRMED_TEST_DB = Boolean(
+  process.env.TEST_DATABASE_URL &&
+    process.env.KORTIX_TEST_DB_CONFIRM === CONFIRMATION &&
+    process.env.INTERNAL_KORTIX_ENV !== 'prod',
+);
+const describeWithDb = HAS_CONFIRMED_TEST_DB ? describe : describe.skip;
+
+const ACCOUNT_ID = '00000000-0000-4000-a000-00000000c201';
+const PROJECT_ID = '00000000-0000-4000-a000-00000000c202';
+const APP_ID = '00000000-0000-4000-a000-00000000c203';
+const VIEWER_ID = '00000000-0000-4000-a000-00000000c204';
+const APP = { appId: APP_ID, accountId: ACCOUNT_ID, name: 'Viewer token test', viewerTokenScope: 'api' };
+
+let integrationDb: Database | null = null;
+function testDb(): Database {
+  const url = process.env.TEST_DATABASE_URL;
+  if (!url) throw new Error('TEST_DATABASE_URL is required');
+  if (!integrationDb) integrationDb = createDb(url, { max: 2 });
+  return integrationDb;
+}
+
+async function cleanup(): Promise<void> {
+  const database = testDb();
+  await database.delete(oauthClients).where(eq(oauthClients.appId, APP_ID));
+  await database.delete(apps).where(eq(apps.appId, APP_ID));
+  await database.delete(projects).where(eq(projects.projectId, PROJECT_ID));
+  await database.delete(accounts).where(eq(accounts.accountId, ACCOUNT_ID));
+}
+
+/** What another API replica, `/v1/oauth/revoke`, or a consent revoke does: the row dies, this process's cache does not hear of it. */
+async function revokeElsewhere(): Promise<void> {
+  const [client] = await testDb().select({ clientId: oauthClients.clientId }).from(oauthClients)
+    .where(eq(oauthClients.appId, APP_ID)).limit(1);
+  await testDb().update(oauthAccessTokens).set({ revokedAt: new Date() })
+    .where(eq(oauthAccessTokens.clientId, client!.clientId));
+}
+
+describeWithDb('App viewer token cache — real PostgreSQL', () => {
+  beforeAll(async () => {
+    await cleanup();
+    const database = testDb();
+    await database.insert(accounts).values({ accountId: ACCOUNT_ID, name: 'Viewer token test' });
+    await database.insert(projects).values({
+      projectId: PROJECT_ID,
+      accountId: ACCOUNT_ID,
+      name: 'Viewer token test',
+      repoUrl: 'https://example.test/viewer-token.git',
+      metadata: { experimental: { apps: true } },
+    });
+    await database.insert(apps).values({
+      appId: APP_ID,
+      accountId: ACCOUNT_ID,
+      projectId: PROJECT_ID,
+      slug: 'viewer-token-test',
+      name: 'Viewer token test',
+      routeKey: 'cccccccccccccccc',
+      createdBy: VIEWER_ID,
+      viewerTokenScope: 'api',
+    });
+  });
+  afterAll(cleanup);
+
+  test('a live cached token is reused: one row per viewer per hour, not one per request', async () => {
+    resetAppViewerCaches();
+    const first = await mintAppViewerToken(APP, VIEWER_ID);
+    const second = await mintAppViewerToken(APP, VIEWER_ID);
+    expect(second!.accessToken).toBe(first!.accessToken);
+    expect((await validateOAuthAccessToken(first!.accessToken)).isValid).toBe(true);
+  });
+
+  test('a token revoked outside this process is never handed out again', async () => {
+    resetAppViewerCaches();
+    const cached = await mintAppViewerToken(APP, VIEWER_ID);
+    await revokeElsewhere();
+    expect((await validateOAuthAccessToken(cached!.accessToken)).isValid).toBe(false);
+
+    const next = await mintAppViewerToken(APP, VIEWER_ID);
+    expect(next!.accessToken).not.toBe(cached!.accessToken);
+    const verdict = await validateOAuthAccessToken(next!.accessToken);
+    expect(verdict).toMatchObject({ isValid: true, us
```

---

### Incident Patch 2: `b3254e8f` (2026-09-30)
**Commit Message**: fix(cli): repair split-manifest wiring fixtures (KRTX-174) (#8481)

## Review in 60 seconds
- KRTX-174: the merged wiring lint correctly requires real agent files;
three pre-existing split-manifest CLI tests used agents without files.
- Add the two synthetic agent files to their shared fixture, preserving
production validation behavior.
- Keep the existing validation strict instead of weakening the lint to
satisfy old fixtures.
No demo video: code-only change
**Risk:** low — test fixture only.
**Verified:** 8 focused tests passed, CLI typecheck passed; full suite
and local stack cannot start Docker/Supabase in this sandbox. ESLint
unavailable for CLI (no eslint.config); Biome flags existing formatting
in the fixture.
suna-skills: worktree, testing, learnings, contributing
ponytail: full · review: Lean already. Ship. · markers: 0

## Summary
Fix the split-manifest fixture after KRTX-174's wiring lint started
checking actual agent files. Closes KRTX-174.

## Demo video
No demo video: code-only change.

## Type of change
- [x] Bug fix
- [ ] New feature
- [ ] Refactor / chore
- [ ] Docs / skills
- [ ] Infrastructure / CI
- [ ] Security fix
- [ ] Breaking change

## How was this tested?

**File**: `apps/cli/src/__tests__/manifest-imports.test.ts` (modified, +2/-0)
```diff
@@ -97,6 +97,8 @@ beforeEach(() => {
   write({
     'kortix.yaml': ROOT,
     '.kortix/agents.yaml': 'agents:\n  galileo:\n    connectors: none\n',
+    'agents/kortix.md': '# Kortix\n',
+    'agents/galileo.md': '# Galileo\n',
     '.kortix/triggers/reports/weekly.yaml': WEEKLY,
     '.kortix/triggers/dockets.yaml': DOCKETS,
     'config.json': JSON.stringify({ active: 'test', hosts: {} }),
```

---

### Incident Patch 3: `fd8b5075` (2026-09-30)
**Commit Message**: fix(api): retain implicit audit on failed explicit write (KRTX-104) (#8476)

## Review in 60 seconds

- Keep automatic request audit as the default at the API edge.
- Record an explicit action as a stand-in only after its write succeeds;
a failed synchronous write no longer hides the request.
- Add a regression that fails before the fix and passes after it.

No demo video: code-only change

**Risk:** Low — async queue acceptance still cannot guarantee durable
persistence; queue overflow remains best-effort by design.
**Verified:** focused test → 10 pass; API typecheck → exit 0; full `pnpm
test` and local stack → unavailable: sandbox Docker lacks
netfilter/bridge; ESLint → unavailable: API has no ESLint config (Biome
reports pre-existing violations).
suna-skills: worktree, testing, learnings, contributing (references:
attachments, preview-environments), ponytail, ponytail-review
ponytail: full · review: Lean already. Ship. · markers: 0

## Summary

KRTX-104: The existing API edge already audits inbound dispatch
implicitly. A successful explicit domain event substitutes for the edge
row. This PR fixes the case where an explicit synchronous write fails:
the edge must not treat that fa

**File**: `apps/api/src/shared/audit-edge.test.ts` (modified, +37/-3)
```diff
@@ -15,7 +15,16 @@ let auditRows: Array<Record<string, unknown>> = [];
 function captured(values: Record<string, unknown> | Array<Record<string, unknown>>) {
   for (const row of Array.isArray(values) ? values : [values]) auditRows.push(row);
   return {
-    returning: async () => [{ eventId: 'audit_test' }],
+    returning: async () => {
+      if (
+        !Array.isArray(values) &&
+        (values.metadata as Record<string, unknown> | undefined)?.fail
+      ) {
+        auditRows.pop();
+        throw new Error('audit insert failed');
+      }
+      return [{ eventId: 'audit_test' }];
+    },
     onConflictDoNothing: async () => undefined,
   };
 }
@@ -36,7 +45,9 @@ mock.module('./db', () => ({
 
 const { runInboundAudit } = await import('./audit-edge');
 const { auditApiRequest, flushAuditEvents } = await import('./audit');
-const { bindAuditPrincipal, setInboundAuditEntrypoint } = await import('./audit-scope');
+const { annotateAuditEvent, bindAuditPrincipal, setInboundAuditEntrypoint } = await import(
+  './audit-scope'
+);
 
 const USER = '00000000-0000-4000-a000-000000000001';
 const ACCOUNT = '00000000-0000-4000-a000-000000000101';
@@ -107,7 +118,11 @@ describe('every entrypoint is written exactly once', () => {
     });
 
     expect(auditRows).toHaveLength(1);
-    expect(auditRows[0]).toMatchObject({ actorType: 'anonymous', outcome: 'denied', httpStatus: 401 });
+    expect(auditRows[0]).toMatchObject({
+      actorType: 'anonymous',
+      outcome: 'denied',
+      httpStatus: 401,
+    });
   });
 
   test('a request dispatched into Hono is written once, with the status Hono saw', async () => {
@@ -139,6 +154,25 @@ describe('every entrypoint is written exactly once', () => {
     });
   });
 
+  test('a failed explicit audit write does not suppress the implicit request row', async () => {
+    const [req, url] = inbound('/v1/projects');
+    await runInboundAudit(req, url, async () => {
+      const { recordAuditEvent } = await import('./audit');
+      annotateAuditEvent({ action: 'project.list' });
+      // The explicit event fails before persistence; the request row remains required.
+      await expect(
+        recordAuditEvent({
+          action: 'project.list',
+          resourceType: 'project',
+          metadata: { fail: true },
+        }),
+      ).rejects.toThrow('audit insert failed');
+      return new Response('ok');
+    });
+    expect(auditRows).toHaveLength(1);
+    expect(auditRows[0]).toMatchObject({ httpStatus: 200 });
+  });
+
   test('a dispatcher that throws is written as a 500, and the error still propagates', async () => {
     const [req, url] = inbound('/v1/p/sbx/3000/');
 
```

**File**: `apps/api/src/shared/audit.ts` (modified, +3/-3)
```diff
@@ -512,12 +512,12 @@ export function auditWritesAreSynchronous(): boolean {
  */
 export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
   const scope = currentInboundAuditScope();
-  if (scope && scope.owner !== 'worker') scope.recordedActions.add(input.action);
   if (auditWritesAreSynchronous()) {
     await insertAuditEvent(auditDb(), input);
-    return;
+  } else {
+    getAuditQueue(auditDb()).enqueue(buildAuditRow(input));
   }
-  getAuditQueue(auditDb()).enqueue(buildAuditRow(input));
+  if (scope && scope.owner !== 'worker') scope.recordedActions.add(input.action);
 }
 
 /**
```

---

### Incident Patch 4: `364cf5c4` (2026-09-30)
**Commit Message**: fix(api): deny account keys before session daemon access (KRTX-426) (#8474)

## Review in 60 seconds
- KRTX-426: Account-scoped API keys have an account ID, not a member
principal. `/start` previously proceeded to the daemon, where its
unsigned context was rejected with 401.
- Deny these keys with 403 after session visibility and before sandbox
provisioning. Human, service-account, and session-bound PAT paths stay
unchanged.
- Added a route-order regression guard.

No demo video: code-only change

**Risk:** medium — Account-key clients that previously received a
misleading 200 now receive 403. The audit batch-drop signal is unrelated
until proven otherwise.
**Verified:** `bun test
apps/api/src/projects/routes/session-runtime-warm-adopt.test.ts
apps/api/src/projects/routes/session-runtime-account-key.test.ts` → 8
pass, 0 fail; `bunx tsc --noEmit -p apps/api/tsconfig.json` → exit 0.
Full `pnpm test` and local stack cannot start because Docker
bridge/netfilter is unavailable. ESLint cannot run on API files: the
package has no ESLint config.
suna-skills: worktree, testing, learnings, contributing
(references/attachments.md, references/preview-environments.md)
ponytail: full · review: L

**File**: `apps/api/src/projects/routes/session-runtime-account-key.test.ts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import { expect, test } from 'bun:test';
+import { readFileSync } from 'node:fs';
+
+// Guard the HTTP route order: a rejected account key must never provision a box.
+test('account-scoped keys are denied after visibility and before session start', () => {
+  const route = readFileSync(new URL('./session-runtime.ts', import.meta.url), 'utf8');
+  const start = route.slice(route.indexOf("path: '/{projectId}/sessions/{sessionId}/start'"), route.indexOf("path: '/{projectId}/sessions/{sessionId}/restart'"));
+  const visible = start.indexOf('if (!visible) return');
+  const denial = start.indexOf("c.get('authType') === 'apiKey' && c.get('apiKeyType') === 'user'");
+  const provision = start.indexOf('await startSession({');
+  expect(visible).toBeGreaterThan(0);
+  expect(denial).toBeGreaterThan(visible);
+  expect(provision).toBeGreaterThan(denial);
+  expect(start.slice(denial, provision)).toContain("}, 403)");
+});
```

**File**: `apps/api/src/projects/routes/session-runtime.ts` (modified, +5/-0)
```diff
@@ -75,6 +75,11 @@ projectsApp.openapi(
     // restartable and the UI offers a Restart that can never work. 404, the
     // same answer the read-by-id gives (see sessionIsTombstoned).
     if (sessionIsTombstoned(visible.row)) return c.json({ error: 'Not found' }, 404);
+    // Account-scoped keys have no member identity to sign for the daemon.
+    // Reject before provisioning rather than returning a misleading ready/start response.
+    if (c.get('authType') === 'apiKey' && c.get('apiKeyType') === 'user') {
+      return c.json({ error: 'A user or service-account credential is required to start a session' }, 403);
+    }
     const projectMetadata = loaded.row.metadata as Record<string, unknown>;
     const sessionMetadata = visible.row.metadata as Record<string, unknown>;
     const repositoryMode = c.req.query('repository_mode');
```

---

### Incident Patch 5: `99fc1350` (2026-09-30)
**Commit Message**: fix(connectors): repair main after ada1948 (KRTX-163) (#8471)

## Review in 60 seconds
- Fixes main after ada1948: registers the new connection PATCH route in
the audit label table.
- Reuses the existing rename action and title, so both rename endpoints
produce the same human-readable audit event.
- No behavior change to the endpoint; this repairs route-label coverage.
KRTX-163.

No demo video: code-only change.

**Risk:** low — the PATCH route now emits the existing connector rename
audit action.
**Verified:** Focused audit suite: 10 pass; shared and API typechecks:
exit 0; full pnpm test and local stack blocked by sandbox Docker
netfilter/bridge limitation; eslint cannot find a flat config. HTTP
route not exercised without local stack.

suna-skills: worktree, testing, learnings, contributing
ponytail: full · review: Lean already. Ship. · markers: 0

## Summary
Adds the missing audit label for the PATCH connection rename route
introduced by ada1948. Reuses the PUT rename action. Closes KRTX-163.

## Demo video
No demo video: code-only change.

## Type of change
- [x] Bug fix
- [ ] New feature
- [ ] Refactor / chore
- [ ] Docs / skills
- [ ] Infrastructure / CI
- [ ] Security fix
-

**File**: `packages/shared/src/audit-route-labels.ts` (modified, +1/-0)
```diff
@@ -483,6 +483,7 @@ export const AUDIT_ROUTE_LABELS: Readonly<Record<string, AuditRouteLabel | strin
   'PUT /v1/projects/:projectId/connections/:connectionId/credential': { action: 'connector.connection.credential.update', title: 'Updated connector account credential' },
   'PUT /v1/projects/:projectId/connections/:connectionId/default': { action: 'connector.connection.default.set', title: 'Set default connector account' },
   'PUT /v1/projects/:projectId/connections/:connectionId/label': { action: 'connector.connection.rename', title: 'Renamed connector account' },
+  'PATCH /v1/projects/:projectId/connections/:connectionId': { action: 'connector.connection.rename', title: 'Renamed connector account' },
   'GET /v1/projects/:projectId/connections/:connectionId/oauth2/application': { action: 'connector.connection.oauth.application.read', title: 'Viewed connector OAuth application' },
   'PUT /v1/projects/:projectId/connections/:connectionId/oauth2/application': { action: 'connector.connection.oauth.application.update', title: 'Updated connector OAuth application' },
   'POST /v1/projects/:projectId/connections/:connectionId/oauth2/authorize': { action: 'connector.connection.oauth.authorize', title: 'Started connector OAuth authorization' },
```

---

### Incident Patch 6: `8aa952a1` (2026-09-30)
**Commit Message**: fix(api): classify Platinum reaper write throttle as transient (KRTX-345) (#8470)

## Review in 60 seconds
- KRTX-345: Platinum's per-org write throttle returns HTTP 429 during a
reaper lifecycle renewal. The reaper currently logs an error for every
box despite retrying on its next pass.
- Classify only the Platinum `/exec` 429 with the provider's
write-throttle message as transient. Preserve errors for other failures,
including 503, timeouts, and non-throttle 429 responses.
- Added a regression that fails before the change and verifies the
deadline stays live with no reaper error line.

No demo video: code-only change

**Risk:** medium — The throttle remains upstream; renewal succeeds only
when provider capacity recovers. Other Platinum failures remain visible.
**Verified:** focused Bun test: 162 pass, 0 fail. `git diff --check`:
pass. Full `pnpm test` and local-stack exercise cannot run because this
sandbox kernel lacks Docker netfilter/bridge support; API typecheck
passes; eslint cannot run because apps/api has no ESLint config.
suna-skills: worktree, testing, learnings, contributing (including
references/attachments.md and references/preview-environments.md)
ponytail: full · re

**File**: `apps/api/src/projects/reaping/box-reaper.ts` (modified, +4/-0)
```diff
@@ -892,6 +892,10 @@ export async function reapAndReconcileSandboxes(
         if (
           isDaytonaRateLimitError(err) ||
           isDaytonaTransientProviderError(err) ||
+          (row.provider === 'platinum' &&
+            err instanceof Error &&
+            /^platinum POST \/v1\/sandboxes\/[^/]+\/exec -> 429\b/.test(err.message) &&
+            err.message.includes('too many write requests for this org')) ||
           (row.provider === 'platinum' &&
             err instanceof Error &&
             err.message.includes('Platinum lifecycle renewal failed') &&
```

**File**: `apps/api/src/projects/sandbox-reaper.test.ts` (modified, +20/-0)
```diff
@@ -2560,6 +2560,26 @@ describe('reapAndReconcileSandboxes — the one rule: deadline_at <= now', () =>
     expect(logged.filter((line) => line.includes('[reaper] failed for sandbox'))).toEqual([]);
   });
 
+  test('a Platinum org write throttle during renewal is transient, not a reaper error', async () => {
+    candidates = [candidate({ provider: 'platinum', deadlineAt: new Date(NOW.getTime() + HOUR) })];
+    statusByExternal['ext-1'] = 'running';
+    lifecycleRenewErrorByExternal['ext-1'] = new Error(
+      'platinum POST /v1/sandboxes/sbx_synthetic/exec -> 429 {"code":"rate_limited","error":"too many write requests for this org"}',
+    );
+    const logged: string[] = [];
+    const realError = console.error;
+    console.error = (...args: unknown[]) => { logged.push(String(args[0])); };
+    try {
+      const result = await reapAndReconcileSandboxes(NOW);
+      expect(result.transient).toBe(1);
+      expect(result.errors).toBe(0);
+      expect(result.stopped).toBe(0);
+      expect(logged).toEqual([]);
+    } finally {
+      console.error = realError;
+    }
+  });
+
   test('an unreachable Platinum guest during renewal retries without paging each pass', async () => {
     candidates = [candidate({ provider: 'platinum', deadlineAt: new Date(NOW.getTime() + HOUR) })];
     statusByExternal['ext-1'] = 'running';
```

---

### Incident Patch 7: `28799c80` (2026-09-30)
**Commit Message**: fix(db): repair main after 699dadc38a — project_usage_read sorts after the migrations already applied (#8483)

## Summary

Deploy Dev fails on every `main` commit since #8457:

```
error: Not run migration 20260930150000000_project_usage_read is preceding already run migration 20260930151406016_session_labels
```

#8457 added a hand-written seed migration with a timestamp (15:00:00)
older than `20260930151406016_session_labels`, which #8249 had merged
earlier and dev had already applied. node-pg-migrate's `checkOrder`
refuses every later `migrate`.

**Fix:** pure rename to `20260930172039000_project_usage_read.sql` (the
"Out-of-order migration timestamps" fix in the kortix-release skill;
same shape as #8010). The file is idempotent seed SQL (`ON CONFLICT DO
NOTHING`), has no drizzle snapshot or journal entry, and has not run on
dev (dev's newest applied migration is
`20260930151406016_session_labels`), staging, or prod.

## Demo video

No UI change.

## Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / chore
- [ ] Docs / skills
- [x] Infrastructure / CI
- [ ] Security fix
- [ ] Breaking change

## How was this tested?

- `pnpm --filter @kortix/db lint` → `Found 0 iss



---

### Incident Patch 8: `e29bec4e` (2026-09-30)
**Commit Message**: fix(sessions): reload brings the base branch agent config into a session without config releases (#8482)

## Summary

**Problem.** On a project without `config_releases` (the default:
`registry.ts` `platformDefault: () => false`), OpenCode reads its agent
files from the session's own checkout (`OPENCODE_CONFIG_DIR` →
`/workspace/<config dir>`). "Reload config" only fast-forwarded the
session branch (`git pull --ff-only origin <session>`), so a fix merged
to the base branch never reached a live session. Seen on prod
2026-09-30: an agent `.md` fix merged to a project's `main` did not
reach its long-lived Slack triage session through two reloads. On
current daemons the reload did not even restart OpenCode: they advertise
`config.release.v1`, so the governance push returns early.

**Cause.** #7403 moved "sessions run the base config" behind
`config_releases` and removed the config-dir sync #6083 had added to
every reload (`syncConfigDirToBase`, and its test file). The flag-off
path, where most projects are, lost it.

**Fix.**
- `apps/kortix-sandbox-agent-server/src/lib/git/git.ts`: restore
`syncConfigDirToBase` unchanged. It touches one literal pathspec
(`GIT_LITERAL_PATHSPECS`), never

**File**: `.agents/skills/learnings/MEMORY.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ Open the entry for the incident, the trigger surface, and the enforcement.
 
 Generated by `scripts/index.sh` from `entries/`. Do not edit by hand.
 
+- `2026-09-30 17:17:38Z` [When a mechanism moves behind a flag, keep the flag-off path's behaviour: most projects stay there](entries/2026-09-30T171738Z-when-a-mechanism-moves-behind-a-flag-keep-the-flag-off-path.md)
 - `2026-09-30 16:30:09Z` [Apply a new list filter to every row a list appends after its query, not only to the query](entries/2026-09-30T163009Z-apply-a-new-list-filter-to-every-row-a-list-appends-after-it.md)
 - `2026-09-30 14:07:28Z` [Classify invalid connector GraphQL as a caller error before reporting an upstream failure](entries/2026-09-30T140728Z-classify-invalid-connector-graphql-as-a-caller-error-before.md)
 - `2026-09-30 12:54:08Z` [Lock the row a new foreign key points at when another request can delete it, and treat a gone row as a normal outcome](entries/2026-09-30T125408Z-lock-the-row-a-new-foreign-key-points-at-when-another-reques.md)
```

**File**: `.agents/skills/learnings/entries/2026-09-30T171738Z-when-a-mechanism-moves-behind-a-flag-keep-the-flag-off-path.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+recorded: 2026-09-30T17:17:38Z
+incident_date: 2026-09-30
+---
+# When a mechanism moves behind a flag, keep the flag-off path's behaviour: most projects stay there
+
+**Rule:** When a new mechanism replaces an old one behind a per-project flag that defaults OFF, the flag-off path must keep doing what the old mechanism did. Removing it from the flag-off path is a silent regression for every project that has not opted in. A reload on a project without `config_releases` must bring the base branch's OpenCode config dir into the session's checkout (`syncConfigDirToBase`, via `POST /kortix/refresh?base_config=1`), because OpenCode reads agent files from that checkout.
+
+**Trigger surface:** Putting a replacement mechanism behind a feature flag (`registry.ts` `platformDefault: () => false`); editing the pre-release path of `reloadSessionConfig` (`apps/api/src/projects/lib/session-reload.ts`) or the daemon's refresh (`harness/open-code/control.ts`, `routes/kortix/refresh.ts`).
+
+**Incident:** PR #7403 (2026-09-25) moved "sessions run the base branch's config" behind `config_releases` (default OFF) and removed the config-dir sync that PR #6083 had added to every reload. On 2026-09-30 an agent `.md` fix merged to a project's `main` never reached its long-lived Slack triage session: two reloads fast-forwarded only the session branch, and on current daemons the governance push returns early, so OpenCode was not even restarted.
+
+**Enforcement:** `apps/api/src/projects/lib/__tests__/session-reload-capability-gate.test.ts` › "reloadSessionConfig with config_releases off" (the refresh carries `base_config=1`; `updated` / `kept-yours` / `already current` outcomes) and `apps/kortix-sandbox-agent-server/src/__tests__/refresh-route.test.ts` › "base_config=1 brings the base branch agent config into the checkout", plus `config-dir-sync.test.ts` (real git: never moves a ref, refuses local edits and commits, pathspec magic cannot widen it).
```

**File**: `apps/api/src/projects/lib/__tests__/session-reload-capability-gate.test.ts` (modified, +69/-4)
```diff
@@ -64,6 +64,10 @@ function fakeDaemon(opts: {
   converge?: unknown;
   convergeStatus?: number[];
   etagAfter?: string;
+  /** What `POST /kortix/refresh` answers. */
+  refreshBody?: Record<string, unknown>;
+  /** What the governance push returns. */
+  push?: Record<string, unknown>;
 }) {
   const requests: Array<{ method: string; path: string }> = [];
   let healthReads = 0;
@@ -86,7 +90,9 @@ function fakeDaemon(opts: {
           ...(opts.capable ? { config: healthConfig() } : {}),
         });
       }
-      if (u.pathname === '/kortix/refresh') return Response.json({ repo: { after: { commit: 'd'.repeat(40) } } });
+      if (u.pathname === '/kortix/refresh') {
+        return Response.json({ repo: { after: { commit: 'd'.repeat(40) } }, ...opts.refreshBody });
+      }
       if (u.pathname === '/kortix/config/converge') {
         const status = convergeStatuses.shift() ?? 200;
         if (status !== 200) return Response.json({ error: 'busy' }, { status });
@@ -96,7 +102,7 @@ function fakeDaemon(opts: {
     },
     pushGovernance: async (input) => {
       pushes.push(input);
-      return { applied: true, opencodeReload: 'restarted', opencodeTurnEnded: false } as never;
+      return (opts.push ?? { applied: true, opencodeReload: 'restarted', opencodeTurnEnded: false }) as never;
     },
     latestEtag: async () => 'ffff',
     sleep: async () => {},
@@ -180,9 +186,11 @@ describe('reloadSessionConfig capability gate', () => {
     const daemon = fakeDaemon({ capable: false });
     const result = await reloadSessionConfig(INPUT, daemon.deps);
 
+    // `base_config=1` is ignored by a daemon built before it; it answers
+    // without `config_dir`, which reads back as 'unknown'.
     expect(daemon.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
       'GET /kortix/health?turn=1',
-      'POST /kortix/refresh?restart=0',
+      'POST /kortix/refresh?restart=0&base_config=1',
     ]);
     expect(daemon.pushes.length).toBe(1);
     expect(result.config_path).toBe('legacy');
@@ -411,7 +419,7 @@ describe('reloadSessionConfig with config_releases off', () => {
 
     expect(daemon.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
       'GET /kortix/health?turn=1',
-      'POST /kortix/refresh?restart=0',
+      'POST /kortix/refresh?restart=0&base_config=1',
     ]);
     expect(daemon.requests.map((r) => r.path)).not.toContain('/kortix/config/converge');
     expect(daemon.pushes.length).toBe(1);
@@ -440,6 +448,63 @@ describe('reloadSessionConfig with config_releases off', () => {
     expect(daemon.requests.filter((r) => r.path.includes('config_dir'))).toEqual([]);
   });
 
+  // Prod 2026-09-30: with the flag off OpenCode reads the agent files in the
+  // session's checkout, and a fix merged to base never reached a live session
+  // through two reloads. The refresh now brings the base config dir in.
+  test('the base agent files are brought forward, and the daemon reload counts as applied', async () => {
+    const daemon = fakeDaemon({
+      capable: true,
+      releasesEnabled: false,
+      refreshBody: { config_dir: { synced: true }, reload: { outcome: 'swapped', port: 4097, pid: 2, turn_ended: false } },
+      push: { applied: false, reason: 'the daemon receives compiled governance in its config release' },
+    });
+    const result = await reloadSessionConfig(INPUT, daemon.deps);
+
+    expect(result).toMatchObject({
+      applied: true,
+      agent_files: 'updated',
+      opencode_reload: 'restarted',
+      turn_ended: false,
+      config_path: 'legacy',
+    });
+    expect(result.reason).toBeUndefined();
+    expect(reloadDetail(result)).toContain('The next prompt runs the new config.');
+  });
+
+  test('the session\'s own agent edits are kept and reported', async () => {
+    const daemon = fakeDaemon({
+      capable: true,
+      releasesEnabled: false,
+      refreshBody: { config_dir: { synced: false, skipped: 'local changes' } },
+      push: { applied: false, reason: 'the
```

**File**: `apps/api/src/projects/lib/session-reload.ts` (modified, +75/-24)
```diff
@@ -842,11 +842,12 @@ export async function reloadSessionConfig(input: {
 
   // ── The pre-release path ────────────────────────────────────────────────
   // Reached two ways: a daemon without `config.release.v1`, and a project
-  // whose `config_releases` flag is OFF (spec, "Feature flag"). Only the plain
-  // refresh plus the governance push — what a reload did before releases.
-  // Never `config_dir=1`: the old handler writes into `/workspace`.
+  // whose `config_releases` flag is OFF (spec, "Feature flag"). OpenCode reads
+  // the agent files in the session's checkout here, so the refresh also brings
+  // the base branch's config dir into it (`base_config=1`). Without that, a fix
+  // merged to base never reached a live session (prod 2026-09-30).
   input.onPhase?.('refreshing-workspace');
-  const refreshed = await refreshSandboxWorkspace(input.sessionId, { pullRepo }, deps);
+  const refreshed = await refreshSandboxWorkspace(input.sessionId, { pullRepo, baseConfig: pullRepo }, deps);
   repoRefreshed = pullRepo && refreshed.ok;
   checkout = classifyWorkspaceCheckout({
     requested: pullRepo,
@@ -856,9 +857,12 @@ export async function reloadSessionConfig(input: {
   });
   commitSha = refreshed.commitSha ?? commitSha;
 
-  // An old daemon cannot report its agent files: the files converge after its
-  // self-update, on the convergence scheduler's 6- and 7-minute attempts.
-  const agentFiles: ReloadAgentFiles = 'unknown';
+  // A daemon built before `base_config` answers without `config_dir`: 'unknown'.
+  const agentFiles = classifyAgentFiles({
+    requested: pullRepo,
+    synced: refreshed.configDirSynced,
+    reason: refreshed.configDirReason,
+  });
   if (input.onlyIfStale) {
     const latestEtag = await deps.latestEtag({
       projectId: input.projectId,
@@ -900,25 +904,36 @@ export async function reloadSessionConfig(input: {
     baseRef: input.baseRef,
   });
 
+  // The daemon reloads OpenCode itself when it brought agent files forward. A
+  // daemon that knows `base_config` receives governance in its release, so the
+  // push above returns without a second restart.
+  const daemonReload =
+    agentFiles === 'updated' && refreshed.reload
+      ? refreshed.reload.outcome === 'swapped'
+        ? ('restarted' as const)
+        : ('kept-old' as const)
+      : null;
+  const applied = push.applied || daemonReload === 'restarted';
+  const opencodeReload = push.opencodeReload ?? daemonReload;
   return {
-    applied: push.applied,
+    applied,
     previous_etag: before.etag,
     // On a refusal the box still runs what it ran; do not report the new hash as
     // though it had landed.
-    etag: push.applied ? latest : before.etag,
+    etag: applied ? latest : before.etag,
     repo_refreshed: repoRefreshed,
     commit_sha: commitSha,
     agent_files: agentFiles,
-    opencode_reload: push.opencodeReload ?? null,
-    turn_ended: push.opencodeTurnEnded ?? null,
-    ...(push.applied
-      ? push.opencodeReload === 'kept-old'
+    opencode_reload: opencodeReload ?? null,
+    turn_ended: push.opencodeTurnEnded ?? (daemonReload ? refreshed.reload?.turnEnded ?? null : null),
+    ...(applied || daemonReload === 'kept-old'
+      ? opencodeReload === 'kept-old'
         ? {
             reason:
               'the new opencode did not start, so the session kept the config it was already running',
           }
         : {}
-      : { reason: push.reason ?? 'agent config unchanged' }),
+      : { reason: agentFiles === 'already-current' ? 'already current' : (push.reason ?? 'agent config unchanged') }),
     ...releaseFields(null, null),
   };
 }
@@ -1038,15 +1053,29 @@ async function convergeSandboxConfig(
  * `/workspace`; on a capable daemon it is an alias for converge, which the
  * reload sends explicitly.
  *
+ * `baseConfig` sends `base_config=1`: the daemon brings ONLY the base branch's
+ * OpenCode config dir into the checkout (`syncConfigDirToBase` — it refuses the
+ * session's ow
```

**File**: `apps/kortix-sandbox-agent-server/src/__tests__/config-dir-sync.test.ts` (added, +266/-0)
```diff
@@ -0,0 +1,266 @@
+/**
+ * `syncConfigDirToBase` — the operation a reload actually needs.
+ *
+ * Context, because the shape of these tests only makes sense with it: opencode
+ * is spawned with `OPENCODE_CONFIG_DIR` pointing INTO the working tree, and the
+ * agent `.md` files there beat the compiled config the API pushes as JSON.
+ * Measured on dev: after a "successful" reload the marker was present in
+ * `~/.config/kortix-opencode.json` and absent from opencode's own `/config` and
+ * `/agent`. So the reload moved the etag and changed nothing the agent reads.
+ *
+ * The obvious fix — sync the workspace to base — is the one thing that must not
+ * happen. `syncWorkspaceToBase` runs `git checkout -B <branch> <sha>` and
+ * `branch` is the SESSION ID, so on a live session it discards the session's own
+ * commits. Also reproduced, on a real sandbox.
+ *
+ * So this function touches ONE pathspec, never moves a ref, and refuses when the
+ * session has its own work in that directory. These tests run against real git
+ * repositories rather than mocks, because every property that matters here is a
+ * property of git's behaviour, not of our control flow.
+ */
+import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
+import { spawnSync } from 'node:child_process'
+import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import type { OpenCodeConfig as Config } from '@/harness/open-code/config'
+import { syncConfigDirToBase } from '@/lib/git/git'
+
+const CONFIG_DIR = '.kortix/opencode'
+const AGENT = `${CONFIG_DIR}/agents/kortix.md`
+
+let root: string
+let origin: string
+let work: string
+
+function git(cwd: string, ...args: string[]) {
+  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
+  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`)
+  return r.stdout.trim()
+}
+
+function write(repo: string, rel: string, body: string) {
+  mkdirSync(join(repo, rel.split('/').slice(0, -1).join('/')), { recursive: true })
+  writeFileSync(join(repo, rel), body)
+}
+
+function cfg(): Config {
+  // Only the fields this function reads. `apiUrl`/`projectId`/`sandboxToken` are
+  // deliberately absent so `resolveCloneCredential` short-circuits and no
+  // control-plane call is attempted.
+  return { projectTarget: work, defaultBranch: 'main', repoUrl: origin } as unknown as Config
+}
+
+beforeEach(() => {
+  root = mkdtempSync(join(tmpdir(), 'kortix-cfgdir-'))
+  origin = join(root, 'origin')
+  work = join(root, 'work')
+
+  mkdirSync(origin, { recursive: true })
+  git(origin, 'init', '--initial-branch=main', '--quiet')
+  git(origin, 'config', 'user.email', 't@t.co')
+  git(origin, 'config', 'user.name', 'T')
+  write(origin, AGENT, 'ORIGINAL PROMPT\n')
+  write(origin, 'app.ts', 'export const x = 1\n')
+  git(origin, 'add', '-A')
+  git(origin, 'commit', '-qm', 'base')
+
+  git(root, 'clone', '--quiet', origin, work)
+  git(work, 'config', 'user.email', 't@t.co')
+  git(work, 'config', 'user.name', 'T')
+  // A session branch, exactly as the daemon names it.
+  git(work, 'checkout', '-q', '-b', 'ses-1111-2222')
+
+  // Base moves on: the agent prompt is edited and merged.
+  write(origin, AGENT, 'UPDATED PROMPT\n')
+  git(origin, 'add', '-A')
+  git(origin, 'commit', '-qm', 'update agent')
+})
+
+afterEach(() => rmSync(root, { recursive: true, force: true }))
+
+const agentText = () => readFileSync(join(work, AGENT), 'utf8')
+
+describe('syncConfigDirToBase', () => {
+  test('brings the agent config forward to base', async () => {
+    expect(agentText()).toBe('ORIGINAL PROMPT\n')
+
+    const result = await syncConfigDirToBase(cfg(), CONFIG_DIR)
+
+    expect(result).toEqual({ synced: true })
+    expect(agentText()).toBe('UPDATED PROMPT\n')
+  })
+
+  test('it does NOT move the branch, and it keeps the session\'s commits', async () => {
+    // The whole reason this 
```

---

### Incident Patch 9: `5c6a01a0` (2026-09-30)
**Commit Message**: fix(api): the session token acts as the person who starts each turn (#8478)

## Summary

A session sandbox holds one Kortix credential (`account_tokens` row,
`KORTIX_TOKEN`) for its whole life, and its `user_id` was the member who
provisioned it. When a second member prompted a shared session, the
agent kept acting as the first member in every call it made:
authorization (launcher ∩ agent grant when `agent_principal` is off),
LLM usage attribution and member budgets, and git/API audit. The first
foreign prompt also cleared `on_behalf_of` permanently, so the launcher
lost their personal connections for the rest of the session.

This PR binds the session token to the person who starts each turn,
**without minting a new secret**. Identity lives on the token row, and
every consumer (`validateAccountToken`, LLM gateway, git proxy, preview
proxy) reads that row fresh per request. So one conditional UPDATE at
turn start re-points everything. The UPDATE writes nothing when the
token already acts as the prompter.

Rules, as decided on the design question (R2.9 / D8 in the API + SDK
refactor plan):

1. **Person prompts** (web, mobile, CLI, direct
`prompt_async`/`command`, linked Slack/Teams 

**File**: `apps/api/src/__tests__/integration-session-turn-identity.test.ts` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+/**
+ * Integration test (real local DB): bindSessionTurnIdentity — the session token
+ * acts as the person who started the current turn.
+ *
+ * One sandbox holds one Kortix credential for its whole life. When a second
+ * member prompts a shared session, every call the agent makes in that turn
+ * (authorization, LLM usage, git audit, personal resources) must act as that
+ * member, not as whoever provisioned the sandbox.
+ */
+import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
+import { and, eq, sql } from 'drizzle-orm';
+import { accountMemberships, accountTokens, accounts, projectSessions, projects } from '@kortix/db';
+import { db } from '../shared/db';
+import { bindSessionTurnIdentity, ON_BEHALF_OF_CLEARED_KEY } from '../projects/lib/on-behalf-of';
+
+const ACCOUNT = crypto.randomUUID();
+const OTHER_ACCOUNT = crypto.randomUUID();
+const PROJECT = crypto.randomUUID();
+const LAUNCHER = crypto.randomUUID();
+const TAKER = crypto.randomUUID();
+const SERVICE_ACCOUNT = crypto.randomUUID(); // not in auth.users, not a member
+
+let n = 0;
+async function seedSession(): Promise<string> {
+  const sessionId = `turn-identity-${crypto.randomUUID()}`;
+  await db.insert(projectSessions).values({
+    sessionId,
+    accountId: ACCOUNT,
+    projectId: PROJECT,
+    branchName: `kortix/${sessionId}`,
+  });
+  return sessionId;
+}
+
+async function seedToken(
+  sessionId: string,
+  opts: { accountId?: string; revoked?: boolean } = {},
+): Promise<string> {
+  const tokenId = crypto.randomUUID();
+  n += 1;
+  await db.insert(accountTokens).values({
+    tokenId,
+    accountId: opts.accountId ?? ACCOUNT,
+    userId: LAUNCHER,
+    onBehalfOfUserId: LAUNCHER,
+    name: `turn-${n}`,
+    publicKey: `pk_turn_${n}_${tokenId.slice(0, 8)}`,
+    secretKeyHash: `hash_turn_${n}_${tokenId.slice(0, 8)}`,
+    projectId: opts.accountId ? null : PROJECT,
+    sessionId,
+    ...(opts.revoked ? { status: 'revoked' as const, revokedAt: new Date() } : {}),
+  });
+  return tokenId;
+}
+
+async function identityOf(tokenId: string) {
+  const [row] = await db
+    .select({ userId: accountTokens.userId, onBehalfOf: accountTokens.onBehalfOfUserId })
+    .from(accountTokens)
+    .where(eq(accountTokens.tokenId, tokenId));
+  return row;
+}
+
+async function clearedStampOf(sessionId: string): Promise<unknown> {
+  const [row] = await db
+    .select({ metadata: projectSessions.metadata })
+    .from(projectSessions)
+    .where(eq(projectSessions.sessionId, sessionId));
+  return (row?.metadata as Record<string, unknown> | null)?.[ON_BEHALF_OF_CLEARED_KEY];
+}
+
+beforeAll(async () => {
+  await db.execute(sql`
+    insert into auth.users (id, email) values
+      (${LAUNCHER}::uuid, ${`launcher-${LAUNCHER}@example.test`}),
+      (${TAKER}::uuid, ${`taker-${TAKER}@example.test`})
+  `);
+  await db.insert(accounts).values([
+    { accountId: ACCOUNT, name: 'turn-identity' },
+    { accountId: OTHER_ACCOUNT, name: 'turn-identity-other' },
+  ]);
+  await db.insert(accountMemberships).values([
+    { userId: LAUNCHER, accountId: ACCOUNT },
+    { userId: TAKER, accountId: ACCOUNT },
+  ]);
+  await db.insert(projects).values({
+    projectId: PROJECT,
+    accountId: ACCOUNT,
+    name: 'turn-identity',
+    repoUrl: 'https://example.com/turn-identity.git',
+  });
+});
+
+afterAll(async () => {
+  await db.delete(accounts).where(eq(accounts.accountId, ACCOUNT)); // cascades tokens, sessions, members
+  await db.delete(accounts).where(eq(accounts.accountId, OTHER_ACCOUNT));
+  await db.execute(sql`delete from auth.users where id in (${LAUNCHER}::uuid, ${TAKER}::uuid)`);
+});
+
+describe('bindSessionTurnIdentity', () => {
+  test('a second member takes over: every live token of the session acts as them', async () => {
+    const sessionId = await seedSession();
+    const first = await seedToken(sessionId);
+    const afterRestart = await seedToken(sessionId);
+
+    expect(await bindSessionTurnIdentity({
```

**File**: `apps/api/src/projects/lib/on-behalf-of.test.ts` (modified, +1/-12)
```diff
@@ -3,7 +3,7 @@
  * a human-initiated session, NULL for every unattended run.
  */
 import { describe, expect, test } from 'bun:test';
-import { channelPrompterForOnBehalfOf, decideSessionOnBehalfOf, promptClearsOnBehalfOf } from './on-behalf-of';
+import { channelPrompterForOnBehalfOf, decideSessionOnBehalfOf } from './on-behalf-of';
 
 const HUMAN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
@@ -67,17 +67,6 @@ describe('decideSessionOnBehalfOf', () => {
   });
 });
 
-describe('promptClearsOnBehalfOf', () => {
-  test('a prompt from a human other than on_behalf_of clears it', () => {
-    expect(promptClearsOnBehalfOf({ onBehalfOfUserId: HUMAN, prompterUserId: OTHER, prompterIsHuman: true })).toBe(true);
-  });
-  test('the same human, an unset value, or a non-human prompter does not', () => {
-    expect(promptClearsOnBehalfOf({ onBehalfOfUserId: HUMAN, prompterUserId: HUMAN, prompterIsHuman: true })).toBe(false);
-    expect(promptClearsOnBehalfOf({ onBehalfOfUserId: null, prompterUserId: OTHER, prompterIsHuman: true })).toBe(false);
-    expect(promptClearsOnBehalfOf({ onBehalfOfUserId: HUMAN, prompterUserId: OTHER, prompterIsHuman: false })).toBe(false);
-  });
-});
-
 describe('channelPrompterForOnBehalfOf', () => {
   const rule = (source: string, userId: string | null, linked = true) =>
     channelPrompterForOnBehalfOf({
```

**File**: `apps/api/src/projects/lib/on-behalf-of.ts` (modified, +60/-15)
```diff
@@ -11,9 +11,11 @@
  *     unattended run (trigger, cron, webhook, email/Telegram, a Slack/Teams
  *     message without a linked user, a backend service account). A child
  *     session inherits its parent session's value, never the token user.
- *   - Prompt: the first prompt from a human other than `on_behalf_of` clears it
- *     permanently for the session (closes V6: a person prompting a private
- *     session never acts through another person's accounts).
+ *   - Turn: every turn a member starts binds the session token to that member
+ *     (`bindSessionTurnIdentity`): `user_id` and `on_behalf_of` both become the
+ *     prompter, so a person never acts through another person's authority or
+ *     accounts (closes V6). A turn from a non-person (trigger, channel sender,
+ *     service account) clears `on_behalf_of` and keeps `user_id`.
  *
  * Readers: `getRequestOnBehalfOf(c)` (fresh, per request, from the auth
  * middleware) or `credentialOnBehalfOf(actor)` (iam/actor.ts, 15 s memo).
@@ -65,22 +67,14 @@ export function decideSessionOnBehalfOf(input: OnBehalfOfInput): string | null {
   return input.isAccountMember ? input.userId : null;
 }
 
-/** Pure prompt rule: does this prompt clear `on_behalf_of`? */
-export function promptClearsOnBehalfOf(input: {
-  onBehalfOfUserId: string | null;
-  prompterUserId: string;
-  prompterIsHuman: boolean;
-}): boolean {
-  return input.prompterIsHuman && input.onBehalfOfUserId !== null && input.onBehalfOfUserId !== input.prompterUserId;
-}
-
 /**
  * Pure rule for a prompt that did NOT come through the HTTP prompt route: a
  * trigger fire or a channel message. Returns the prompter to compare against
  * `on_behalf_of` — a human id, or `null` for a non-human prompter, which clears
- * any value — or `undefined` when this source never clears (the HTTP sources,
- * which clear in the route, and platform notifications such as
- * `system:connector-connected`, which the session's own human caused).
+ * any value — or `undefined` when this source never changes it (the HTTP
+ * sources, which mark their human prompts `bindTurnIdentity`, and platform
+ * notifications such as `system:connector-connected`, which the session's own
+ * human caused).
  *
  * The channel identities mirror the mint rule above: email and Telegram
  * senders are never Kortix identities, and a Slack/Teams message carries its
@@ -203,6 +197,57 @@ export async function clearSessionOnBehalfOfForPrompt(input: {
   return true;
 }
 
+/**
+ * `prompterUserId` started a turn in session `sessionId`. From this turn on,
+ * the session token acts as them:
+ *
+ *   - a member of the account: `user_id` (authorization, LLM usage and member
+ *     budgets, audit) and `on_behalf_of` (personal resources) both become the
+ *     prompter, and the cleared stamp is removed so a re-mint follows them;
+ *   - anyone else (a service account, an API-key caller): `on_behalf_of` is
+ *     cleared and stamped, `user_id` is kept — the same result as
+ *     `clearSessionOnBehalfOfForPrompt`.
+ *
+ * One statement: the token UPDATE and the session stamp run in one
+ * data-modifying CTE, so they land together and the prompt waits for one
+ * round trip, not two. It writes nothing when the token already acts as the
+ * prompter, which is every turn but the first after a change of hands.
+ * Returns true when it changed a token.
+ */
+export async function bindSessionTurnIdentity(input: {
+  accountId: string;
+  sessionId: string;
+  prompterUserId: string;
+}): Promise<boolean> {
+  const prompter = sql`${input.prompterUserId}::uuid`;
+  const member = sql`exists (select 1 from kortix.account_memberships m where m.user_id = ${prompter} and m.account_id = ${input.accountId})`;
+  const changed = await db.execute<{ token_id: string }>(sql`
+    with changed as (
+      update kortix.account_tokens t
+         set user_id = case when ${member} then ${prompter} else t.user_id end,
+             on_behalf_of_user_id = case when ${memb
```

**File**: `apps/api/src/projects/routes/session-prompts.ts` (modified, +5/-14)
```diff
@@ -6,7 +6,6 @@ import { createRoute, z } from '@hono/zod-openapi';
 import { assertProjectCapability, loadProjectForUser, loadVisibleSession } from '../lib/access';
 import { resolveAndAuthorizeAgent } from '../lib/agent-access';
 import { promptModelOverride } from '../lib/prompt-model';
-import { clearSessionOnBehalfOfForPrompt } from '../lib/on-behalf-of';
 import { assertAgentScope, isProjectSessionPrincipal } from '../../iam/agent-scope';
 import { PROJECT_ACTIONS } from '../../iam';
 import { callerKortixSessionId } from '../lib/caller-session';
@@ -257,19 +256,6 @@ projectsApp.openapi(
     // back to the session's own agent when the prompt names none.
     await resolveAndAuthorizeAgent(c, loaded, projectId, overrides.agent, visible.row.agentName);
 
-    // Spec 2026-09-22 §2.3 (closes V6): the first prompt from a HUMAN other than
-    // the session's `on_behalf_of` clears it permanently. The agent keeps its
-    // own authority; it loses the creator's personal resources, so the person
-    // prompting never acts through another person's accounts. An agent-session
-    // credential is not a human prompter and clears nothing.
-    if (!isProjectSessionPrincipal(c)) {
-      await clearSessionOnBehalfOfForPrompt({
-        accountId: loaded.row.accountId,
-        sessionId,
-        prompterUserId: loaded.userId,
-      });
-    }
-
     // NO connector pre-flight here. A prompt used to be refused 409
     // `CONNECTOR_CONNECTION_REQUIRED` when a connector the session declared had
     // nothing connected. That gate could not be cleared from the product: a
@@ -315,6 +301,11 @@ projectsApp.openapi(
       accountId: loaded.row.accountId,
       sessionId,
       actorUserId: loaded.userId,
+      // Spec 2026-09-22 §2.3 (closes V6): the session token acts as the person
+      // who sent this prompt, from the moment its turn is delivered — not now,
+      // while it may still wait behind another member's turn. An agent-session
+      // credential is not a person and never changes the token's identity.
+      bindTurnIdentity: !isProjectSessionPrincipal(c),
       text,
       idempotencyKey,
       clientMessageId,
```

**File**: `apps/api/src/projects/session-lifecycle/__tests__/continue-session.test.ts` (modified, +71/-0)
```diff
@@ -21,6 +21,9 @@ let opens = 0;
 let openedStage: 'ready' | 'stopped' | null = null;
 let syncs = 0;
 let transitions: string[] = [];
+/** Turn-identity writes and the prompt forward, in the order they happened. */
+let identityEvents: string[] = [];
+let bindFails = false;
 
 mock.module('../../../config', () => ({
   config: { KORTIX_URL: 'https://kortix.test' },
@@ -64,6 +67,7 @@ mock.module('../../../sandbox-proxy/routes/preview', () => ({
     _body: ArrayBuffer,
   ) => {
     forwardedAccess.push(access as Record<string, unknown>);
+    identityEvents.push('forward');
     return new Response(null, { status: 204 });
   },
 }));
@@ -90,6 +94,23 @@ mock.module('../../../platform/service-key', () => ({ serviceKeyForExternalId: a
 mock.module('../../../sandbox-proxy/backend', () => ({ resolveSandboxIngress: async () => ({ url: 'https://sandbox.test', headers: {} }), resolveServiceKey: async () => 'key' }));
 mock.module('../../lib/sandbox-env-sync', () => ({ syncSandboxEnvForPrompt: async () => { syncs++; } }));
 
+mock.module('../../lib/on-behalf-of', () => ({
+  // The pure source rule, reduced to the sources these cases send.
+  channelPrompterForOnBehalfOf: (input: { source: string; userId: string | null }) =>
+    input.source?.startsWith('trigger:') ? null : input.source === 'slack' ? input.userId : undefined,
+  clearSessionOnBehalfOfForPrompt: async (input: { prompterUserId: string | null }) => {
+    identityEvents.push(`clear:${input.prompterUserId}`);
+    return true;
+  },
+  bindSessionTurnIdentity: async (input: { prompterUserId: string }) => {
+    identityEvents.push(`bind:start:${input.prompterUserId}`);
+    await new Promise((resolve) => setTimeout(resolve, 20));
+    if (bindFails) throw new Error('db down');
+    identityEvents.push(`bind:done:${input.prompterUserId}`);
+    return true;
+  },
+}));
+
 mock.module('../actor', () => ({
   resolveProjectAutomationActor: async () => actor,
   resolveAgentRunAttribution: async () => null,
@@ -138,6 +159,8 @@ beforeEach(() => {
   openedStage = null;
   syncs = 0;
   transitions = [];
+  identityEvents = [];
+  bindFails = false;
 });
 
 describe('wake delivery characterization', () => {
@@ -233,3 +256,51 @@ describe('continueSession — trigger delivery access carries no agent binding',
     });
   });
 });
+
+// The session token acts as the person who starts the turn. The bind lands
+// before the prompt is forwarded; a non-person clears `on_behalf_of` only and is
+// never bound, so a trigger never runs as the account owner.
+describe('continueSession — turn identity', () => {
+  const awake = () => {
+    sessionRow = { ...sessionRow, opencodeSessionId: OC_SESSION_ID };
+    boxRow = { status: 'active', externalId: EXTERNAL_ID };
+  };
+
+  test('a prompt the route marked as a person binds that person before the forward', async () => {
+    awake();
+    const outcome = await continueSession({
+      source: 'ui', sessionId: SESSION_ID, text: 'hi', userId: 'member-b', bindTurnIdentity: true,
+    } as never);
+    expect(outcome).toBe('delivered');
+    expect(identityEvents).toEqual(['bind:start:member-b', 'bind:done:member-b', 'forward']);
+  });
+
+  test('an unmarked prompt (agent session, or a row older than the flag) keeps the identity', async () => {
+    awake();
+    await continueSession({ source: 'ui', sessionId: SESSION_ID, text: 'hi', userId: 'member-b' } as never);
+    expect(identityEvents).toEqual(['forward']);
+  });
+
+  test('a trigger fire clears on_behalf_of and never binds the automation actor', async () => {
+    awake();
+    actor = 'account-owner-1';
+    await continueSession({ source: 'trigger:cron', sessionId: SESSION_ID, text: 'tick' } as never);
+    expect(identityEvents).toEqual(['clear:null', 'forward']);
+  });
+
+  test('a linked Slack sender is a person: their turn binds them', async () => {
+    awake();
+    await continueSession({ source: 'slack', sessionId: SESSION_ID, text: 'hi', userId: 'member-c' } as never);
```

---

### Incident Patch 10: `fb3462bd` (2026-09-30)
**Commit Message**: fix(sdk): identify failed project secret POST transport (KRTX-466) (#8467)

## Review in 60 seconds

- KRTX-466: distinguish a failed project-secret POST from an unspecified
fetch failure in the SDK error returned to the dialog.
- Keep the POST non-retryable: a lost response cannot prove the secret
was not persisted.
- Add a regression test that proves the endpoint is visible but the
secret value is not.

No demo video: code-only change. The SDK request-error formatting is the
only changed behavior.

**Risk:** high — This improves diagnosis, but does not establish that
the reported network failure is fixed. No sanitized failed preflight or
POST trace exists. The cause may be outside the application (CDN, DNS,
CORS or upstream). Do not claim the create path succeeds in production
on this evidence alone.
**Verified:** `bun test packages/sdk/src/core/http/api-client.test.ts`:
46 pass; `pnpm --filter @kortix/sdk typecheck`: exit 0; `pnpm --filter
@kortix/sdk smoke:install`: passed. Full `pnpm test` and the local stack
cannot run: Docker cannot start on this sandbox kernel. Root eslint
cannot run against SDK files because this workspace has no root or SDK
eslint config. SDK full-suite r

**File**: `packages/sdk/src/core/http/api-client.test.ts` (modified, +14/-0)
```diff
@@ -356,6 +356,20 @@ describe('makeRequest retries transient transport failures on idempotent reads',
     }
   });
 
+  test('a project secret POST transport failure identifies the endpoint without leaking its value', async () => {
+    configureKortix({ backendUrl: 'http://api.test/v1', getToken: async () => 'tok' });
+    const originalFetch = globalThis.fetch;
+    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
+    try {
+      const response = await backendApi.post('/projects/p1/secrets', { name: 'SAMPLE', value: 'synthetic-secret' });
+      expect(response.success).toBe(false);
+      expect(response.error?.message).toContain('POST /projects/p1/secrets');
+      expect(response.error?.message).not.toContain('synthetic-secret');
+    } finally {
+      globalThis.fetch = originalFetch;
+    }
+  });
+
   test('a POST transport failure is not retried', async () => {
     configureKortix({
       backendUrl: 'http://api.test/v1',
```

**File**: `packages/sdk/src/core/http/api-client.ts` (modified, +8/-4)
```diff
@@ -613,10 +613,14 @@ async function makeRequest<T = any>(
       // Return the typed error to the caller, but never invoke the host's global
       // error handler. Explicit callers can still render local recovery UI.
     } else if (error instanceof Error) {
-      apiError = new ApiError(error.message, {
-        name: error.name || 'ApiError',
-        stack: error.stack,
-      });
+      // A browser TypeError has no HTTP response (CORS, DNS, or edge failure).
+      // Include only the route, never the request body or credential.
+      apiError = new ApiError(
+        fetchOptions.method === 'POST' && error instanceof TypeError && error.message === 'Failed to fetch'
+          ? `Failed to fetch: POST ${url.replace(getApiUrl(), '') || url}`
+          : error.message,
+        { name: error.name || 'ApiError', stack: error.stack },
+      );
 
       if (showErrors) {
         platformConfig().onError?.(apiError, errorContext);
```

#### Recent Merged Pull Requests:
- **PR #8486** (2026-09-30): fix(apps): App viewer tokens stop 401ing after an access-policy save, and stop leaking into App logs (@markokraemer)
- **PR #8483** (2026-09-30): fix(db): repair main after 699dadc38a — project_usage_read sorts after the migrations already applied (@Ino-Bagaric)
- **PR #8482** (2026-09-30): fix(sessions): reload brings the base branch agent config into a session without config releases (@Ino-Bagaric)
- **PR #8481** (2026-09-30): fix(cli): repair split-manifest wiring fixtures (KRTX-174) (@agent-kortix)
- **PR #8480** (2026-09-30): refactor(mobile): reuse SDK session health probe (KRTX-771) (@agent-kortix)
- **PR #8479** (2026-09-30): chore(secrets): per-env OpenCode Zen key in api env profiles (@markokraemer)
- **PR #8478** (2026-09-30): fix(api): the session token acts as the person who starts each turn (@DimitrijeGlibic)
- **PR #8476** (2026-09-30): fix(api): retain implicit audit on failed explicit write (KRTX-104) (@agent-kortix)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): koala73/worldmonitor

> **Canonical Artifact**: `07_PROJECT_LEARNING/koala73-worldmonitor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/koala73/worldmonitor](https://github.com/koala73/worldmonitor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:45:11.793Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `koala73/worldmonitor`
- **Description**: Real-time global intelligence dashboard. AI-powered news aggregation, geopolitical monitoring, and infrastructure tracking in a unified situational awareness interface
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 87824 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/_notification-webhook-ssrf.ts`
```
const BLOCKED_METADATA_HOSTNAMES = new Set([
  'localhost',
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  'metadata',
  'computemetadata',
  'link-local.s3.amazonaws.com',
]);

const DNS_RESOLUTION_TIMEOUT_MS = 3_000;
const DNS_JSON_ENDPOINT = 'https://cloudflare-dns.com/dns-query';

type ResolveHostname = (hostname: string) => Promise<string[]>;

function isIpLiteral(hostname: string): boolean {
  return hostname.includes(':') || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function ipv4Parts(value: string): [number, number, number, number] | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(part => Number(part));
  if (nums.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return nums as [number, number, number, number];
}

function ipv4FromMappedIpv6(value: string): string | null {
  const dotted = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const dottedAddress = dotted?.[1];
  if (dottedAddress && ipv4Parts(dottedAddress)) return dottedAddress;

  const hex = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;
  const hi = Number.parseInt(hex[1]!, 16);
  const lo = Number.parseInt(hex[2]!, 16);
  if (!Number.isInteger(hi) || !Number.isInteger(lo) || hi < 0 || hi > 0xffff || lo < 0 || lo > 0xffff) {
    return null;
  }
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

// Parse an IPv6 literal (compressed or expanded, any case, optional trailing
// dotted IPv4) into exactly eight 16-bit hextets, or null when it is not a
// syntactically valid IPv6 address.
function ipv6ToHextets(value: string): number[] | null {
  if (typeof value !== 'string' || !value.includes(':')) return null;
  if ((value.match(/::/g) || []).length > 1) return null;

  const parseSide = (side: string): number[] | null => {
    if (side === '') return [];
    const tokens = side.split(':');
    const hextets: number[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token.includes('.')) {
        if (i !== tokens.length - 1) return null;
        const parts = ipv4Parts(token);
        if (!parts) return null;
        hextets.push((parts[0] << 8) | parts[1]);
        hextets.push((parts[2] << 8) | parts[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(token)) return null;
        hextets.push(Number.parseInt(token, 16));
      }
    }
    return hextets;
  };

  const compressionIndex = value.indexOf('::');
  if (compressionIndex === -1) {
    const groups = parseSide(value);
    if (!groups || groups.length !== 8) return null;
    return groups;
  }

  const head = parseSide(value.slice(0, compressionIndex));
  const tail = parseSide(value.slice(compressionIndex + 2));
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array(missing).fill(0), ...tail];
}

// When the IPv6 address embeds an IPv4 (NAT64 64:ff9b::/96, IPv4-compatible
// ::/96, 6to4 2002::/16, or IPv4-mapped ::ffff:0:0/96), return the embedded
// IPv4 in dotted form so it can be run through the IPv4 blocklist. Otherwise
// null.
function embeddedIpv4FromIpv6(hextets: number[]): string | null {
  const [h0, h1, h2, h3, h4, h5, h6, h7] = hextets as [
    number, number, number, number, number, number, number, number,
  ];
  const toDotted = (hi: number, lo: number): string =>
    `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

  // IPv4-mapped ::ffff:0:0/96 (covers both ::ffff:1.2.3.4 and ::ffff:hhhh:hhhh)
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0xffff) {
    return toDotted(h6, h7);
  }
  // NAT64 64:ff9b::/96
  if (h0 === 0x0064 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    return toDotted(h6, h7);
  }
  // 6to4 2002::/16 — the 32 bits after 2002: are the embedded IPv4
  if (h0 === 0x2002) {
    return toDotted(h1, h2);
  }
  // IPv4-compatible ::/96 (::a.b.c.d / ::hhhh:hhhh); :: and ::1 fall through to
  // the a===0 rule below, which blocks them either way.
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    return toDotted(h6, h7);
  }
  return null;
}

function ipv4FromIpv6(value: string): string | null {
  const hextets = ipv6ToHextets(value);
  if (hextets) {
    const embedded = embeddedIpv4FromIpv6(hextets);
    if (embedded) return embedded;
  }
  return ipv4FromMappedIpv6(value);
}

export function isBlockedNotificationResolvedAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const ipv6Hextets = ipv6ToHextets(normalized);
  const mappedIpv4 = ipv4FromIpv6(normalized);
  const addr = mappedIpv4 ?? normalized;

  if (ipv6Hextets) {
    const [h0, h1, h2, h3] = ipv6Hextets;
    // RFC 8215 local-use NAT64 prefix 64:ff9b:1::/48.
    if (h0 === 0x0064 && h1 === 0xff9b && h2 === 0x0001) return true;
    // RFC 6666 discard-only prefix 100::/64.
    if (h0 === 0x0100 && h1 === 0 && h2 === 0 && h3 === 0) return true;
  }

  if (addr === '::' || addr === '::1') return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(addr)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(addr)) return true;
  if (/^fe[c-f][0-9a-f]:/i.test(addr)) return true;
  if (/^ff[0-9a-f]{2}:/i.test(addr)) return true;
  if (/^2001:0?db8:/i.test(addr)) return true;

  const parts = ipv4Parts(addr);
  if (!parts) return false;

  const [a, b, c] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

export function blockedNotificationWebhookUrlReason(rawUrl: string): string | null {
  // Explicit, before the URL parse: '' and whitespace would already fail
  // `new URL`, but the guarantee that no blank envelope passes belongs in the
  // validator, not in each call site's condition (#7207) — and the dedicated
  // message beats 'not a valid URL' for an empty field.
  if (!rawUrl || !rawUrl.trim()) {
    return 'Webhook URL must not be empty';
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'Webhook URL is not a valid URL';
  }

  if (parsed.protocol !== 'https:') {
    return 'Webhook URL must use HTTPS';
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_METADATA_HOSTNAMES.has(hostname)) {
    return 'Webhook URL must not point to a metadata endpoint';
  }

  if (isBlockedNotificationResolvedAddress(hostname)) {
    return 'Webhook URL must not point to a private/local address';
  }

  return null;
}

async function resolveDnsJson(hostname: string, recordType: 'A' | 'AAAA'): Promise<string[]> {
  const url = new URL(DNS_JSON_ENDPOINT);
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', recordType);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/dns-json',
      'User-Agent': 'WorldMonitor-Notification-Webhooks/1.0',
    },
    signal: AbortSignal.timeout(DNS_RESOLUTION_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`DNS ${recordType} lookup failed: HTTP ${response.status}`);
  const data = await response.json() as { Status?: number; Answer?: Array<{ type?: number; data?: string }> };
  if (data.Status !== 0) throw new Error(`DNS ${recordType} lookup failed: status ${data.Status}`);
  const expectedType = recordType === 'A' ? 1 : 28;
  return (data.Answer ?? [])
    .filter(answer => answer.type === expectedType && typeof answer.data === 'string')
    .map(answer => answer.data!);
}

async function defaultResolveHostname(hostname: string): Promise<string[]> {
  const records = await Promise.all([
    resolveDnsJson(hostname, 'A'),
    resolveDnsJson(hostname, 'AAAA'),
  ]);
  return records.flat();
}

/**
 * Fail fast at registration when the webhook hostname currently resolves to a
 * private or reserved address. Delivery repeats this check (and pins its
 * connection) because DNS can change after registration.
 */
export async function assertNotificationWebhookRegistrationUrlSafe(
  rawUrl: string,
  resolveHostname: ResolveHostname = defaultResolveHostname,
): Promise<void> {
  const staticError = blockedNotificationWebhookUrlReason(rawUrl);
  if (staticError) throw new Error(staticError);

  const hostname = new URL(rawUrl).hostname.toLowerCase();
  if (isIpLiteral(hostname)) return;
  let resolvedAddresses: string[];
  try {
    resolvedAddresses = await resolveHostname(hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Webhook URL DNS resolution failed: ${message}`);
  }
  if (!resolvedAddresses.length) throw new Error('Webhook URL DNS resolution returned no addresses');
  if (resolvedAddresses.some(isBlockedNotificationResolvedAddress)) {
    throw new Error('Webhook URL must not point to a private/local address');
  }
}

```

### Core Architecture Module: `api/mcp/utils.ts`
```
// Edge-safe utility helpers shared across the MCP modules.

// Edge-safe UTF-8 byte counter. Uses `TextEncoder` (Web Platform, available
// unconditionally on Vercel edge) rather than `text.length` (UTF-16 code
// units — undercounts emoji / CJK / accented content) or `Buffer.byteLength`
// (Node intrinsic — not reliably shimmed in every edge runtime).
//
// Used by BOTH JMESPath gates AND `scripts/measure-jmespath-savings.mjs`
// so the runtime contract and the reported PR numbers operate on the same
// byte definition. Exported for the measurement script.
export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

const MAX_JSON_RPC_ID_BYTES = 256;

/** Normalize a caller-controlled JSON-RPC id to the bounded echo-safe shape. */
export function safeJsonRpcId(value: unknown): string | number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.length > MAX_JSON_RPC_ID_BYTES) return null;
  return utf8ByteLength(value) <= MAX_JSON_RPC_ID_BYTES ? value : null;
}

// ---------------------------------------------------------------------------
// tools/list description compression (v1.5.0)
//
// `tools/list` is the largest fixed per-session input-token cost. v1.4.0's
// catalog is ~41.8 KB UTF-8; ~8 KB of that is tool-level `description`
// prose. The first sentence of a tool description carries nearly all the
// selection signal — the long tail is rarely load-bearing. Compress the
// top-level `description` to first-sentence-or-cap; route LLMs that want
// full text to the new `describe_tool` RPC (added in U3 below).
//
// PROPERTY descriptions are NOT compressed in v1 — audit found 53% of
// them encode contract details (defaults, optional flags, "currently
// supported" lists, examples) where naive compression would regress
// correctness. Deferred to a future PR with a per-property hand-audit.
//
// Both compress + describe_tool surfaces go through `buildPublicTool`
// (added in U2) so there's a single source of truth for the public shape.
// ---------------------------------------------------------------------------

// Compress a description string to at most `maxBytes` UTF-8 bytes.
// - If the text already fits, returns it unchanged (identity).
// - Otherwise, extracts the first sentence (terminated by `. ! ?` followed
//   by whitespace or end-of-string) and truncates to the byte cap.
// - If no sentence boundary exists, falls back to plain byte truncation.
// - Never cuts inside a UTF-8 codepoint (uses TextEncoder bytewise walk).
//
// Pure, no I/O. Pure function; idempotent.
export function compressDescription(text: string, maxBytes: number): string {
  if (typeof text !== 'string' || text.length === 0) return text;
  if (utf8ByteLength(text) <= maxBytes) return text;
  // First-sentence extraction. The /(?:\s|$)/ tail prevents `e.g.` / `i.e.`
  // mis-splits when the abbreviation is mid-sentence (followed by ` ` not
  // `<EOL>`), though it does still split on a leading `e.g. ...` — that
  // edge case is documented in U1 test scenarios. Tool descriptions in
  // TOOL_REGISTRY don't start with abbreviations, audited at write-time.
  const sentenceMatch = text.match(/^[\s\S]+?[.!?](?:\s|$)/);
  const candidate = sentenceMatch ? sentenceMatch[0].trim() : text;
  if (utf8ByteLength(candidate) <= maxBytes) return candidate;
  // Byte-truncate without splitting a codepoint mid-cut. TextEncoder
  // produces one byte per UTF-8 byte; walk codepoints forward and stop
  // when adding the next would exceed maxBytes.
  const encoder = new TextEncoder();
  let out = '';
  let used = 0;
  for (const ch of candidate) {
    const chBytes = encoder.encode(ch).length;
    if (used + chBytes > maxBytes) break;
    out += ch;
    used += chBytes;
  }
  return out;
}

```

### Core Architecture Module: `api/scorecard/v1/[rpc].ts`
```
export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { scorecardHandler } from '../../../server/worldmonitor/scorecard/v1/handler';
import { createScorecardServiceRoutes } from '../../../src/generated/server/worldmonitor/scorecard/v1/service_server';

export default createDomainGateway(
  createScorecardServiceRoutes(scorecardHandler, serverOptions),
);

```

### Core Architecture Module: `api/v2/shipping/webhooks/[subscriberId].ts`
```
/**
 * GET /api/v2/shipping/webhooks/{subscriberId} — Status read for a single
 * webhook. Preserved on the legacy path-param URL shape because sebuf does
 * not currently support path-parameter RPC paths; tracked for eventual
 * migration under #3207.
 */

export const config = { runtime: 'edge' };

// @ts-expect-error — JS module, no declaration file
import { getHeaderApiKey, USER_API_KEY_GATEWAY_VALIDATION_ERROR, validateApiKey } from '../../../_api-key.js';
// @ts-expect-error — JS module, no declaration file
import { getCorsHeaders } from '../../../_cors.js';
import { renderBillingVerificationDenial } from '../../../../server/_shared/entitlement-check';
import { validateUserApiKey } from '../../../../server/_shared/user-api-key';
import { checkFailClosedScopedIpRateLimit } from '../../../../server/_shared/rate-limit';
import { resolvePremiumCallerIdentity } from '../../../../server/_shared/premium-check';
import { getCachedJson } from '../../../../server/_shared/redis';
import {
  webhookKey,
  callerFingerprint,
  type WebhookRecord,
} from '../../../../server/worldmonitor/shipping/v2/webhook-shared';

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    ...getCorsHeaders(req),
    'Cache-Control': 'private, no-store',
    'CDN-Cache-Control': 'no-store',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const apiKeyResult = await validateApiKey(req, { forceKey: true });
  if (apiKeyResult.error === USER_API_KEY_GATEWAY_VALIDATION_ERROR) {
    const validationGuard = await checkFailClosedScopedIpRateLimit(
      req, 'user-api-key:pre-auth-validation', 600, '60 s', cors,
    );
    if (validationGuard) return validationGuard;
    const credential = getHeaderApiKey(req);
    let userKey;
    try {
      userKey = credential ? await validateUserApiKey(credential) : null;
    } catch {
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!userKey) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    apiKeyResult.valid = true;
    apiKeyResult.credential = credential;
  }
  if (apiKeyResult.required && !apiKeyResult.valid) {
    return new Response(JSON.stringify({ error: apiKeyResult.error ?? 'API key required' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const identity = await resolvePremiumCallerIdentity(req);
  if (!identity.isPremium) {
    if (identity.billingDenial) return renderBillingVerificationDenial(identity.billingDenial, cors);
    return new Response(JSON.stringify({ error: 'PRO subscription required' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/');
  const subscriberId = parts[parts.length - 1];
  if (!subscriberId || !subscriberId.startsWith('wh_')) {
    return new Response(JSON.stringify({ error: 'Webhook not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const record = (await getCachedJson(webhookKey(subscriberId)).catch(() => null)) as WebhookRecord | null;
  if (!record) {
    return new Response(JSON.stringify({ error: 'Webhook not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const ownerHash = await callerFingerprint(req, apiKeyResult.credential);
  if (record.ownerTag !== ownerHash) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      subscriberId: record.subscriberId,
      callbackUrl: record.callbackUrl,
      chokepointIds: record.chokepointIds,
      alertThreshold: record.alertThreshold,
      createdAt: record.createdAt,
      active: record.active,
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
}

```

### Core Architecture Module: `api/v2/shipping/webhooks/[subscriberId]/[action].ts`
```
/**
 * POST /api/v2/shipping/webhooks/{subscriberId}/rotate-secret
 * POST /api/v2/shipping/webhooks/{subscriberId}/reactivate
 *
 * Preserved on the legacy path-param URL shape because sebuf does not
 * currently support path-parameter RPC paths; tracked for eventual
 * migration under #3207.
 */

export const config = { runtime: 'edge' };

// @ts-expect-error — JS module, no declaration file
import { getHeaderApiKey, USER_API_KEY_GATEWAY_VALIDATION_ERROR, validateApiKey } from '../../../../_api-key.js';
// @ts-expect-error — JS module, no declaration file
import { getCorsHeaders } from '../../../../_cors.js';
import { renderBillingVerificationDenial } from '../../../../../server/_shared/entitlement-check';
import { validateUserApiKey } from '../../../../../server/_shared/user-api-key';
import { checkFailClosedScopedIpRateLimit } from '../../../../../server/_shared/rate-limit';
import { resolvePremiumCallerIdentity } from '../../../../../server/_shared/premium-check';
import { getCachedJson, runRedisTransaction } from '../../../../../server/_shared/redis';
import {
  WEBHOOK_TTL,
  webhookKey,
  ownerIndexKey,
  callerFingerprint,
  generateSecret,
  type WebhookRecord,
} from '../../../../../server/worldmonitor/shipping/v2/webhook-shared';

export default async function handler(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const apiKeyResult = await validateApiKey(req, { forceKey: true });
  if (apiKeyResult.error === USER_API_KEY_GATEWAY_VALIDATION_ERROR) {
    const validationGuard = await checkFailClosedScopedIpRateLimit(
      req, 'user-api-key:pre-auth-validation', 600, '60 s', cors,
    );
    if (validationGuard) return validationGuard;
    const credential = getHeaderApiKey(req);
    let userKey;
    try {
      userKey = credential ? await validateUserApiKey(credential) : null;
    } catch {
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!userKey) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    apiKeyResult.valid = true;
    apiKeyResult.credential = credential;
  }
  if (apiKeyResult.required && !apiKeyResult.valid) {
    return new Response(JSON.stringify({ error: apiKeyResult.error ?? 'API key required' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const identity = await resolvePremiumCallerIdentity(req);
  if (!identity.isPremium) {
    if (identity.billingDenial) return renderBillingVerificationDenial(identity.billingDenial, cors);
    return new Response(JSON.stringify({ error: 'PRO subscription required' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/');
  const action = parts[parts.length - 1];
  const subscriberId = parts[parts.length - 2];

  if (!subscriberId || !subscriberId.startsWith('wh_')) {
    return new Response(JSON.stringify({ error: 'Webhook not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (action !== 'rotate-secret' && action !== 'reactivate') {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const record = (await getCachedJson(webhookKey(subscriberId)).catch(() => null)) as WebhookRecord | null;
  if (!record) {
    return new Response(JSON.stringify({ error: 'Webhook not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const ownerHash = await callerFingerprint(req, apiKeyResult.credential);
  if (record.ownerTag !== ownerHash) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (action === 'rotate-secret') {
    const newSecret = await generateSecret();
    const stored = await persistWebhook(subscriberId, { ...record, secret: newSecret }, record.ownerTag);
    if (!stored) {
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ subscriberId, secret: newSecret, rotatedAt: new Date().toISOString() }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // action === 'reactivate'
  const stored = await persistWebhook(subscriberId, { ...record, active: true }, record.ownerTag);
  if (!stored) {
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ subscriberId, active: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// One MULTI/EXEC, not a pipeline: a pipeline could apply SET and then fail
// SADD/EXPIRE, answering 503 while Redis already holds a rotated secret the
// caller never saw. A command rejected at queue time aborts the whole EXEC.
async function persistWebhook(subscriberId: string, record: WebhookRecord, ownerTag: string): Promise<boolean> {
  const results = await runRedisTransaction([
    ['SET', webhookKey(subscriberId), JSON.stringify(record), 'EX', String(WEBHOOK_TTL)],
    ['SADD', ownerIndexKey(ownerTag), subscriberId],
    ['EXPIRE', ownerIndexKey(ownerTag), String(WEBHOOK_TTL)],
  ]);
  return Array.isArray(results)
    && results.length === 3
    && results.every((result) => result && !result.error)
    && results[0]?.result === 'OK'
    && [0, 1, '0', '1'].includes(results[1]?.result as number | string)
    && (results[2]?.result === 1 || results[2]?.result === '1');
}

```

### Core Architecture Module: `cli/src/core.mjs`
```
// Pure, dependency-free logic for the WorldMonitor CLI: argument parsing,
// request planning, and output formatting. Nothing here touches the network or
// the process — every export is unit-testable in isolation, and the thin
// network/IO wrapper lives in ./run.mjs.
//
// The CLI is MCP-first. The MCP server (https://worldmonitor.app/mcp) is the
// live, documented agent surface: `tools/list` is public. `get_sources` is the
// only data tool callable without a key; other `tools/call` operations use a
// user API key. A small REST escape hatch (`health`, `get <path>`) and an
// OpenAPI listing (`list`) round it out for host-relative and self-hosted use.

export const VERSION = '0.1.3';

// Cloudflare's WAF challenges generic library User-Agents (node, curl,
// python-requests, empty) on the API edge, so we always identify ourselves.
export const USER_AGENT = `worldmonitor-cli/${VERSION} (+https://worldmonitor.app)`;

export const DEFAULT_BASE_URL = 'https://api.worldmonitor.app';
export const DEFAULT_MCP_URL = 'https://worldmonitor.app/mcp';
export const DEFAULT_SPEC_URL = 'https://worldmonitor.app/openapi.json';

// Header the API accepts for a user-issued key (alias: X-Api-Key).
export const API_KEY_HEADER = 'X-WorldMonitor-Key';

// JSON-RPC error code the MCP server returns when a call needs authentication.
export const MCP_AUTH_ERROR_CODE = -32001;

// Shown on any auth failure (MCP -32001 or a REST 401) so the fix is always one
// hint away, whichever surface the user hit.
export const AUTH_HINT =
  'Hint: this call needs a key — pass --api-key or set WORLDMONITOR_API_KEY (get one at https://worldmonitor.app/pro).';

// Thrown for bad invocations so run.mjs can exit with a distinct status (2) and
// print usage rather than a stack trace.
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

// Ergonomic shortcuts over the highest-traffic MCP tools. Every other tool is
// reachable via `call <tool>`, so this table stays small. `args` maps positional
// arguments onto named tool arguments; anything else (`--key value`) is merged
// into the tool's arguments too, which is how `--limit`, `--jmespath`,
// `--country`, etc. flow through with no per-tool wiring.
export const CURATED_COMMANDS = {
  world: { tool: 'get_world_brief', args: [], summary: 'Live global situation brief.' },
  country: {
    tool: 'get_country_brief',
    args: [{ name: 'country_code', required: true }],
    summary: 'AI strategic brief for a country (ISO 3166-1 alpha-2 code).',
  },
  risk: {
    tool: 'get_country_risk',
    args: [{ name: 'country_code', required: true }],
    summary: 'Country risk / resilience scores (ISO 3166-1 alpha-2 code).',
  },
  markets: { tool: 'get_market_data', args: [], summary: 'Equities, commodities, crypto and FX quotes.' },
  conflicts: {
    tool: 'get_conflict_events',
    args: [],
    summary: 'Recent conflict events (--country, --min_fatalities, --limit).',
  },
  cyber: {
    tool: 'get_cyber_threats',
    args: [],
    summary: 'Cyber-threat indicators (--min_severity, --threat_type, --country).',
  },
  news: {
    tool: 'get_news_intelligence',
    args: [],
    summary: 'Classified news intelligence (--topic, --country, --alerts_only).',
  },
  disasters: {
    tool: 'get_natural_disasters',
    args: [],
    summary: 'Earthquakes, fires and storms (--dataset, --active_only, --min_magnitude).',
  },
  sanctions: {
    tool: 'get_sanctions_data',
    args: [],
    summary: 'Sanctions designations (--country, --entity_type, --query).',
  },
  forecasts: {
    tool: 'get_forecast_predictions',
    args: [],
    summary: 'Scenario forecasts (--domain, --region).',
  },
  maritime: {
    tool: 'get_maritime_activity',
    args: [{ name: 'country_code', required: true }],
    summary: 'Maritime / port activity for a country (ISO 3166-1 alpha-2 code).',
  },
};

// Flags that consume the following token as a value, mapped to their canonical
// option key. Anything else beginning with `--` is treated as an API/tool
// parameter.
const VALUE_FLAGS = new Map([
  ['api-key', 'apiKey'],
  ['apikey', 'apiKey'],
  ['key', 'apiKey'],
  ['base-url', 'baseUrl'],
  ['mcp-url', 'mcpUrl'],
  ['spec-url', 'specUrl'],
  ['args', 'args'],
  ['arg-json', 'args'],
  ['timeout', 'timeout'],
]);

const BOOL_FLAGS = new Map([
  ['raw', 'raw'],
  ['compact', 'compact'],
  ['help', 'help'],
  ['h', 'help'],
  ['version', 'version'],
  ['v', 'version'],
]);

function isFlag(token) {
  if (token.startsWith('--')) return true;
  // single-dash short flag (-h, -v) but not a negative number (-5, -1.2)
  return token.length === 2 && token[0] === '-' && !/[0-9]/.test(token[1]);
}

// Split argv into { command, positionals, options, params }. `options` holds
// recognised global flags; `params` holds every other `--key value` pair and
// becomes the request's tool arguments (MCP) or query string (REST). This is
// what makes `worldmonitor conflicts --country IR --limit 5` work with no
// per-command wiring.
export function parseArgs(argv) {
  const options = {};
  const params = {};
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!isFlag(token)) {
      positionals.push(token);
      continue;
    }

    let name = token.replace(/^--?/, '');
    let inlineValue;
    const eq = name.indexOf('=');
    if (eq !== -1) {
      inlineValue = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    const key = name.toLowerCase();

    if (BOOL_FLAGS.has(key)) {
      options[BOOL_FLAGS.get(key)] = inlineValue === undefined ? true : inlineValue !== 'false';
      continue;
    }
    if (VALUE_FLAGS.has(key)) {
      options[VALUE_FLAGS.get(key)] = inlineValue !== undefined ? inlineValue : argv[++i];
      continue;
    }
    // Unknown flag → an API/tool parameter. A bare flag with no value is
    // recorded as boolean true.
    if (inlineValue !== undefined) params[name] = inlineValue;
    else if (i + 1 < argv.length && !isFlag(argv[i + 1])) params[name] = argv[++i];
    else params[name] = true;
  }

  const command = positionals.shift();
  return { command, positionals, options, params };
}

// Read defaults from the environment so keys and hosts don't have to be passed
// on every call.
export function resolveConfig(env = {}) {
  return {
    apiKey: env.WORLDMONITOR_API_KEY || env.WM_API_KEY,
    baseUrl: env.WORLDMONITOR_BASE_URL,
    mcpUrl: env.WORLDMONITOR_MCP_URL,
    specUrl: env.WORLDMONITOR_SPEC_URL,
  };
}

function trimTrailingSlash(url) {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end--;
  return url.slice(0, end);
}

function baseHeaders(apiKey) {
  const headers = { 'user-agent': USER_AGENT };
  if (apiKey) headers[API_KEY_HEADER] = apiKey;
  return headers;
}

// Tool/query arguments: an explicit --args JSON object wins; otherwise the
// collected --key value params, with bare boolean flags kept as true.
function collectArgs(parsed) {
  if (parsed.options.args !== undefined) {
    try {
      return JSON.parse(parsed.options.args);
    } catch (err) {
      throw new UsageError(`--args must be valid JSON: ${err.message}`);
    }
  }
  const args = {};
  for (const [k, v] of Object.entries(parsed.params)) args[k] = v === true ? true : String(v);
  return args;
}

function mcpPlan(method, rpcParams, options, config, extra = {}) {
  const mcpUrl = options.mcpUrl || config.mcpUrl || DEFAULT_MCP_URL;
  const apiKey = options.apiKey || config.apiKey;
  const rpc = { jsonrpc: '2.0', id: 1, method };
  if (rpcParams !== undefined) rpc.params = rpcParams;
  return {
    kind: 'mcp',
    url: mcpUrl,
    method: 'POST',
    headers: {
      ...baseHeaders(apiKey),
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(rpc),
    rpc,
    ...extra,
  };
}

function restPlan(path, params, options, config) {
  const baseUrl = trimTrailingSlash(options.baseUrl || config.baseUrl || DEFAULT_BASE_URL);
  const apiKey = options.apiKey || config.apiKey;
  const url = new URL(baseUrl + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v === true ? 'true' : String(v));
  return {
    kind: 'rest',
    url: url.toString(),
    method: 'GET',
    headers: { ...baseHeaders(apiKey), accept: 'application/json' },
  };
}

// Turn a parsed invocation into a concrete, executable plan. Returns one of:
//   { kind: 'mcp',  url, method, headers, body, rpc, needsKey? }
//   { kind: 'rest', url, method, headers }
//   { kind: 'list', specUrl, service }
// Throws UsageError for malformed input.
export function planRequest(parsed, config = {}) {
  const { command, positionals, options, params } = parsed;

  if (command === 'list' || command === 'endpoints') {
    return {
      kind: 'list',
      specUrl: options.specUrl || config.specUrl || DEFAULT_SPEC_URL,
      service: positionals[0],
    };
  }

  if (command === 'health') {
    return restPlan('/api/health', {}, options, config);
  }
  if (command === 'get') {
    const path = positionals[0];
    if (!path || !path.startsWith('/')) {
      throw new UsageError('`get` needs an API path, e.g. `worldmonitor get /api/health`');
    }
    return restPlan(path, params, options, config);
  }

  if (command === 'tools') return mcpPlan('tools/list', undefined, options, config);
  if (command === 'prompts') return mcpPlan('prompts/list', undefined, options, config);
  if (command === 'resources') return mcpPlan('resources/list', undefined, options, config);

  if (command === 'call') {
    const tool = positionals[0];
    if (!tool) {
      throw new UsageError(
        '`call` needs a tool name, e.g. `worldmonitor call get_country_risk --country_code IR`',
      );
    }
    return mcpPlan('tools/call', { name: tool, arguments: collectArgs(parsed) }, o
```

### Core Architecture Module: `consumer-prices-core/src/acquisition/exa.ts`
```
import Exa from 'exa-js';
import type { AcquisitionProvider, ExtractResult, ExtractSchema, FetchOptions, FetchResult, SearchOptions, SearchResult } from './types.js';

export class ExaProvider implements AcquisitionProvider {
  readonly name = 'exa' as const;

  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.exa.ai';
  private client: Exa;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new Exa(apiKey);
  }

  async fetch(url: string, _opts: FetchOptions = {}): Promise<FetchResult> {
    const result = await this.client.getContents([url], {
      text: { maxCharacters: 100_000 },
      highlights: { numSentences: 5, highlightsPerUrl: 3 },
    });

    const item = result.results[0];
    if (!item) throw new Error(`Exa returned no content for ${url}`);

    return {
      url,
      html: item.text ?? '',
      markdown: item.text ?? '',
      statusCode: 200,
      provider: this.name,
      fetchedAt: new Date(),
      metadata: { highlights: item.highlights },
    };
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const result = await this.request<{
      results?: Array<{
        url: string;
        title?: string;
        text?: string;
        highlights?: string[];
        score?: number;
        publishedDate?: string;
      }>;
    }>('/search', {
      query,
      numResults: opts.numResults ?? 10,
      type: opts.type ?? 'neural',
      includeDomains: opts.includeDomains,
      startPublishedDate: opts.startPublishedDate,
      useAutoprompt: true,
    }, opts.timeout);

    return (result.results ?? []).map((r) => ({
      url: r.url,
      title: r.title ?? '',
      text: r.text,
      highlights: r.highlights,
      score: r.score,
      publishedDate: r.publishedDate,
    }));
  }

  async extract<T = Record<string, unknown>>(
    url: string,
    schema: ExtractSchema,
    opts: FetchOptions = {},
  ): Promise<ExtractResult<T>> {
    const prompt = `${schema.prompt ? `${schema.prompt} ` : ''}Extract the following fields from this product page: ${Object.entries(schema.fields)
      .map(([k, v]) => `${k} (${v.type}): ${v.description}`)
      .join(', ')}`;
    const outputSchema = {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(schema.fields).map(([key, field]) => [
          key,
          // Exa's /contents validator accepts only a SCALAR `type`. The JSON
          // Schema `type: [T, 'null']` union form is rejected outright with
          // HTTP 400 INVALID_REQUEST_BODY, which silently disabled every
          // nullable extraction (#6182). Express nullability with `anyOf`,
          // which Exa accepts and which returns a genuine null price.
          field.nullable
            ? { anyOf: [{ type: field.type }, { type: 'null' }], description: field.description }
            : { type: field.type, description: field.description },
        ]),
      ),
      required: Object.entries(schema.fields)
        .filter(([, field]) => field.required !== false)
        .map(([key]) => key),
      additionalProperties: false,
    };

    // exa-js does not expose an AbortSignal for getContents, so use the API
    // directly here to keep the opt-in fallback genuinely bounded.
    // `text` rides along in the same call as ground truth for the caller's
    // on-page price verification (price-evidence.ts) — same request, no
    // second fetch.
    const result = await this.request<{ results?: Array<{ summary?: unknown; text?: unknown }> }>('/contents', {
      urls: [url],
      summary: { query: prompt, schema: outputSchema },
      text: { maxCharacters: 30_000 },
    }, opts.timeout);
    const item = result.results?.[0];
    if (!item) throw new Error(`Exa returned no content for ${url}`);
    const data = parseStructuredSummary<T>(item.summary);
    if (data === null) throw new Error(`Exa returned malformed structured summary for ${url}`);

    return {
      url,
      data,
      provider: this.name,
      fetchedAt: new Date(),
      ...(typeof item.text === 'string' && item.text.trim() ? { pageContent: item.text } : {}),
    };
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.search('test', { numResults: 1 });
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(endpoint: string, body: Record<string, unknown>, timeout = 30_000): Promise<T> {
    const response = await globalThis.fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'worldmonitor-consumer-prices/1.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Exa ${endpoint.slice(1)} failed HTTP ${response.status}: ${detail.slice(0, 120)}`);
    }

    return (await response.json()) as T;
  }
}

function parseStructuredSummary<T>(summary: unknown): T | null {
  if (summary && typeof summary === 'object') return summary as T;
  if (typeof summary !== 'string') return null;

  const trimmed = summary.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

```

### Core Architecture Module: `consumer-prices-core/src/acquisition/firecrawl.ts`
```
import type { AcquisitionProvider, ExtractResult, ExtractSchema, FetchOptions, FetchResult, SearchOptions, SearchResult } from './types.js';

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    html?: string;
    markdown?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data?: Array<{ url: string; title: string; description?: string; markdown?: string }>;
}

interface FirecrawlExtractResponse {
  success: boolean;
  data?: {
    extract?: Record<string, unknown>;
    markdown?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
}

/** Transport headroom added to a server-side render budget. */
export const ABORT_HEADROOM_MS = 5_000;

/**
 * Client abort deadline for an extraction call.
 *
 * Must be strictly greater than the render budget sent in the request body:
 * the client clock starts before the request leaves the process and also
 * covers DNS, TLS, Firecrawl's queueing and the response transfer, so with
 * equal deadlines the client always wins. A page that uses its full render
 * allowance would then be aborted before its successful response could
 * arrive, Firecrawl's own timeout error would be unreachable, and two such
 * pages open the caller's per-scrape Firecrawl cooldown.
 */
export function extractAbortMs(timeoutMs?: number): number {
  return (timeoutMs ?? 30_000) + ABORT_HEADROOM_MS;
}

export class FirecrawlProvider implements AcquisitionProvider {
  readonly name = 'firecrawl' as const;

  private readonly baseUrl = 'https://api.firecrawl.dev/v1';

  constructor(private readonly apiKey: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'worldmonitor-consumer-prices/1.0',
    };
  }

  async fetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
    const resp = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        url,
        formats: ['html', 'markdown'],
        waitFor: opts.waitForSelector ? 2000 : 0,
        timeout: opts.timeout ?? 30_000,
        headers: opts.headers,
      }),
      signal: AbortSignal.timeout((opts.timeout ?? 30_000) + 5_000),
    });

    if (!resp.ok) throw new Error(`Firecrawl scrape failed: HTTP ${resp.status}`);

    const data = (await resp.json()) as FirecrawlScrapeResponse;
    if (!data.success || !data.data) {
      throw new Error(`Firecrawl error: ${data.error ?? 'unknown'}`);
    }

    return {
      url,
      html: data.data.html ?? '',
      markdown: data.data.markdown ?? '',
      statusCode: 200,
      provider: this.name,
      fetchedAt: new Date(),
      metadata: data.data.metadata,
    };
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const resp = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        query,
        limit: opts.numResults ?? 10,
        includeDomains: opts.includeDomains,
        scrapeOptions: { formats: ['markdown'] },
      }),
      // Same bound as fetch/extract: a wedged provider connection must not
      // eat the whole run budget for one retailer.
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) throw new Error(`Firecrawl search failed: HTTP ${resp.status}`);

    const data = (await resp.json()) as FirecrawlSearchResponse;
    return (data.data ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      text: r.description ?? r.markdown,
    }));
  }

  async extract<T = Record<string, unknown>>(
    url: string,
    schema: ExtractSchema,
    opts: FetchOptions = {},
  ): Promise<ExtractResult<T>> {
    // Nullable is encoded DIFFERENTLY here than in ExaProvider.extract, and the
    // divergence is deliberate — do not "unify" these without re-testing both
    // providers live. Firecrawl accepts the JSON Schema `type: [T,'null']`
    // union (verified: HTTP 200, extract returned). Exa's /contents validator
    // rejects an array `type` outright with HTTP 400 INVALID_REQUEST_BODY, so
    // it must use `anyOf` instead (#6182 — that mismatch silently disabled
    // every Exa extraction call and, after two failures, the whole fallback).
    const jsonSchema: Record<string, unknown> = {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(schema.fields).map(([k, v]) => [
          k,
          { type: v.nullable ? [v.type, 'null'] : v.type, description: v.description },
        ]),
      ),
      ...(Object.values(schema.fields).some((field) => field.required !== undefined)
        ? { required: Object.entries(schema.fields).filter(([, field]) => field.required !== false).map(([key]) => key) }
        : {}),
    };

    const resp = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        url,
        // markdown rides along in the same render so the caller can verify an
        // extracted price actually appears on the page (price-evidence.ts).
        formats: ['extract', 'markdown'],
        extract: { schema: jsonSchema, ...(schema.prompt ? { prompt: schema.prompt } : {}) },
        timeout: opts.timeout ?? 30_000,
        // Late-hydrating storefronts capture as a breadcrumb shell without a
        // settle delay; the abort deadline below must absorb it too.
        ...(opts.waitFor ? { waitFor: opts.waitFor } : {}),
      }),
      signal: AbortSignal.timeout(extractAbortMs(opts.timeout) + (opts.waitFor ?? 0)),
    });

    if (!resp.ok) throw new Error(`Firecrawl extract failed: HTTP ${resp.status}`);

    const data = (await resp.json()) as FirecrawlExtractResponse;
    // Throw ONLY for a provider-side failure (quota exhausted, rate limited,
    // bad request) — those are transport conditions the caller's cooldown
    // should count. A successful call that simply found nothing to extract is
    // a PAGE-level outcome: return empty so the caller records `missing-price`
    // and moves to the next candidate URL without accruing an outage streak.
    // Conflating the two lets two ordinary no-product pages disable Firecrawl
    // for the rest of the scrape, on every retailer, not just opted-in ones.
    if (!data.success) {
      throw new Error(`Firecrawl extract error: ${data.error ?? 'unknown'}`);
    }

    return {
      url,
      data: (data.data?.extract ?? {}) as T,
      provider: this.name,
      fetchedAt: new Date(),
      ...(typeof data.data?.markdown === 'string' && data.data.markdown.trim()
        ? { pageContent: data.data.markdown }
        : {}),
    };
  }

  async validate(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ url: 'https://example.com', formats: ['markdown'] }),
        signal: AbortSignal.timeout(10_000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }
}

```

### Core Architecture Module: `consumer-prices-core/src/acquisition/p0.ts`
```
/**
 * Parallel P0 acquisition provider.
 * P0 is a high-throughput scraping API that handles JS rendering,
 * anti-bot, and proxy rotation. Compatible with its REST API.
 */
import type { AcquisitionProvider, FetchOptions, FetchResult, SearchOptions, SearchResult } from './types.js';

interface P0ScrapeResponse {
  success: boolean;
  html?: string;
  markdown?: string;
  statusCode?: number;
  error?: string;
}

interface P0SearchResponse {
  results?: Array<{ url: string; title: string; snippet?: string }>;
}

export class P0Provider implements AcquisitionProvider {
  readonly name = 'p0' as const;

  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = 'https://api.parallelai.dev/v1',
  ) {
    this.baseUrl = baseUrl;
  }

  private headers() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async fetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
    const resp = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        url,
        render_js: true,
        wait_for: opts.waitForSelector,
        timeout: Math.floor((opts.timeout ?? 30_000) / 1_000),
        output_format: 'html',
        premium_proxy: true,
      }),
      signal: AbortSignal.timeout((opts.timeout ?? 30_000) + 10_000),
    });

    if (!resp.ok) throw new Error(`P0 scrape failed: HTTP ${resp.status}`);

    const data = (await resp.json()) as P0ScrapeResponse;
    if (!data.success && !data.html) {
      throw new Error(`P0 error: ${data.error ?? 'no content'}`);
    }

    return {
      url,
      html: data.html ?? '',
      markdown: data.markdown,
      statusCode: data.statusCode ?? 200,
      provider: this.name,
      fetchedAt: new Date(),
    };
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const resp = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        query,
        num_results: opts.numResults ?? 10,
        include_domains: opts.includeDomains,
      }),
      // Same bound as the other provider calls (see firecrawl.search).
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) throw new Error(`P0 search failed: HTTP ${resp.status}`);

    const data = (await resp.json()) as P0SearchResponse;
    return (data.results ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      text: r.snippet,
    }));
  }

  async validate(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/health`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5_000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }
}

```

### Core Architecture Module: `consumer-prices-core/src/acquisition/playwright.ts`
```
import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { AcquisitionProvider, FetchOptions, FetchResult, SearchOptions, SearchResult } from './types.js';

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class PlaywrightProvider implements AcquisitionProvider {
  readonly name = 'playwright' as const;

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  private async getContext(): Promise<BrowserContext> {
    if (!this.browser) {
      // Honor the Dockerfile-provided apt Chromium; without this the env var
      // is dead and Playwright silently downloads its own browser instead.
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
      this.browser = await chromium.launch({ headless: true, executablePath });
    }
    if (!this.context) {
      this.context = await this.browser.newContext({
        userAgent: DEFAULT_UA,
        locale: 'en-US',
        viewport: { width: 1280, height: 900 },
        extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
      });
    }
    return this.context;
  }

  async fetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
    const ctx = await this.getContext();
    const page = await ctx.newPage();

    const timeout = opts.timeout ?? 30_000;

    try {
      if (opts.headers) {
        await page.setExtraHTTPHeaders(opts.headers);
      }

      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

      if (opts.waitForSelector) {
        await page.waitForSelector(opts.waitForSelector, { timeout: 10_000 }).catch(() => {});
      }

      const html = await page.content();
      const statusCode = response?.status() ?? 200;

      return { url, html, statusCode, provider: this.name, fetchedAt: new Date() };
    } finally {
      await page.close();
    }
  }

  async search(_query: string, _opts?: SearchOptions): Promise<SearchResult[]> {
    throw new Error('PlaywrightProvider does not support search mode. Use Exa instead.');
  }

  async validate(): Promise<boolean> {
    try {
      await this.getContext();
      return true;
    } catch {
      return false;
    }
  }

  async teardown(): Promise<void> {
    const timeout = new Promise<void>(r => setTimeout(r, 5000));
    await Promise.race([
      Promise.allSettled([this.context?.close(), this.browser?.close()]),
      timeout,
    ]);
    this.context = null;
    this.browser = null;
  }
}

```

### Core Architecture Module: `consumer-prices-core/src/acquisition/registry.ts`
```
import { ExaProvider } from './exa.js';
import { FirecrawlProvider } from './firecrawl.js';
import { P0Provider } from './p0.js';
import { PlaywrightProvider } from './playwright.js';
import type { AcquisitionConfig, AcquisitionProvider, AcquisitionProviderName, FetchOptions, FetchResult } from './types.js';

const _providers = new Map<AcquisitionProviderName, AcquisitionProvider>();

export function initProviders(env: Record<string, string | undefined>) {
  _providers.set('playwright', new PlaywrightProvider());

  if (env.EXA_API_KEY) {
    _providers.set('exa', new ExaProvider(env.EXA_API_KEY));
  }
  if (env.FIRECRAWL_API_KEY) {
    _providers.set('firecrawl', new FirecrawlProvider(env.FIRECRAWL_API_KEY));
  }
  if (env.P0_API_KEY) {
    _providers.set('p0', new P0Provider(env.P0_API_KEY, env.P0_BASE_URL));
  }
}

export function getProvider(name: AcquisitionProviderName): AcquisitionProvider {
  const p = _providers.get(name);
  if (!p) throw new Error(`Acquisition provider '${name}' is not configured. Set the required API key env var.`);
  return p;
}

export async function teardownAll(): Promise<void> {
  for (const p of _providers.values()) {
    await p.teardown?.();
  }
  _providers.clear();
}

/**
 * Fetch a URL using the provider chain defined in config.
 * Tries primary provider first; on failure, tries fallback.
 */
export async function fetchWithFallback(
  url: string,
  config: AcquisitionConfig,
  opts?: FetchOptions,
): Promise<FetchResult> {
  const primary = getProvider(config.provider);
  const mergedOpts = { ...config.options, ...opts };

  try {
    return await primary.fetch(url, mergedOpts);
  } catch (err) {
    if (!config.fallback) throw err;

    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[acquisition] ${config.provider} failed for ${url}: ${msg}. Falling back to ${config.fallback}.`);

    const fallback = getProvider(config.fallback);
    return fallback.fetch(url, mergedOpts);
  }
}

```

### Core Architecture Module: `consumer-prices-core/src/acquisition/types.ts`
```
export type AcquisitionProviderName = 'playwright' | 'exa' | 'firecrawl' | 'p0';

export interface FetchOptions {
  waitForSelector?: string;
  /** Extra render settle time (ms) before capture — for storefronts whose
   * product data hydrates late and otherwise captures as an empty shell
   * (Carrefour MAF domains, #6182). Firecrawl only; other providers ignore it. */
  waitFor?: number;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  userAgent?: string;
}

export interface SearchOptions {
  numResults?: number;
  includeDomains?: string[];
  startPublishedDate?: string;
  type?: 'keyword' | 'neural';
  timeout?: number;
}

export interface ExtractSchema {
  fields: Record<
    string,
    {
      description: string;
      type: 'string' | 'number' | 'boolean' | 'array';
      required?: boolean;
      nullable?: boolean;
    }
  >;
  prompt?: string;
}

export interface FetchResult {
  url: string;
  html: string;
  markdown?: string;
  statusCode: number;
  provider: AcquisitionProviderName;
  fetchedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  url: string;
  title: string;
  text?: string;
  highlights?: string[];
  score?: number;
  publishedDate?: string;
}

export interface ExtractResult<T = Record<string, unknown>> {
  url: string;
  data: T;
  provider: AcquisitionProviderName;
  fetchedAt: Date;
  /** Rendered page content (markdown/text) captured by the SAME provider call
   * that produced `data`, when the provider can return it. Callers use it as
   * ground truth to verify an extracted price actually appears on the page
   * (price-evidence.ts, #6182). Absent = verification cannot run. */
  pageContent?: string;
}

export interface AcquisitionProvider {
  readonly name: AcquisitionProviderName;

  /** Fetch a URL, returning HTML content. */
  fetch(url: string, opts?: FetchOptions): Promise<FetchResult>;

  /** Search for pages matching a query (Exa primary, others may not support). */
  search?(query: string, opts?: SearchOptions): Promise<SearchResult[]>;

  /** Extract structured data from a URL using a schema hint. */
  extract?<T = Record<string, unknown>>(url: string, schema: ExtractSchema, opts?: FetchOptions): Promise<ExtractResult<T>>;

  /** Validate provider is configured and reachable. */
  validate(): Promise<boolean>;

  /** Clean up resources (close browser, etc.) */
  teardown?(): Promise<void>;
}

export interface AcquisitionConfig {
  /** Primary acquisition provider. */
  provider: AcquisitionProviderName;
  /** Fallback provider if primary fails. */
  fallback?: AcquisitionProviderName;
  /** Provider-specific options. */
  options?: FetchOptions;
  /** Use search mode instead of direct URL fetch (Exa only). */
  searchMode?: boolean;
  /** Query template for search mode: use {category}, {product}, {market} tokens. */
  searchQueryTemplate?: string;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8620** (2026-09-24): **fix(conflict): HAPI conflictEventsTotal still double counts civilian targeting**
  *Symptoms*: Found while documenting the #8583 fix. #8589 stopped `conflictFatalities` and `conflictPoliticalViolenceEvents` from adding civilian targeting on top of political violence. `conflictEventsTotal` was not changed. `scripts/_conflict-hapi.mjs:376` adds every row's events (`aggregate.eventsTotal += events`) before branching on `event_type`. That includes `civilian_targeting` rows, which HDX HAPI documents as a non-exclusive subset of political violence (0 of 468 country-periods had more civilian targeting than political violence during the #5994 discovery). The published total is therefore political violence + civilian targeting + demonstrations. That double counts civilian targeting, the same defect as #8583.  The field is public. It is in the `conflict/v1` humanitarian summary proto (`src/generated/.../service_server.ts:78`) and retained by `api/_humanitarian-retention.js:5`. The existing test fixture expects 23 from 12 political violence + 4 civilian targeting + 7 demonstrations.  **Acceptance criteria** - [ ] `conflictEventsTotal` counts political violence plus demonstrations, never civilian targeting on top of political violence. Otherwise document it as a per-category sum and rename or describe it so no consumer reads it as a count of distinct events. - [ ] The fixture test pins the corrected total (19, not 23, for that fixture).  Related: #8583, #8589.

- **Issue #8585** (2026-09-24): **fix(conflict): UCDP-vs-ACLED dedupe resolves disagreement by deleting the UCDP event**
  *Symptoms*: Found during the #5994 discovery (2026-09-24).  `src/services/conflict/ucdp-dedupe.ts:44-68` (`isDuplicatedByAcled`) drops a UCDP event when an ACLED event lies within 7 days and 50 km with deaths within 2x. That is the shipped definition of "resolve disagreement by overwriting". #6419 and #5994 require the opposite: preserve both claims with attribution.  It is dormant today only because `conflict:acled:v1:all:0:0` holds GDELT-backed rows with no coordinates or fatalities. It activates the moment real ACLED data returns.  **Acceptance criteria** - [ ] Overlapping UCDP and ACLED events are both kept with source attribution. Display-level grouping is fine, deletion is not. - [ ] A test proves an overlapping pair keeps both events.  Related: #5994, #6419 step 4.

- **Issue #8584** (2026-09-24): **fix(conflict): HAPI seeder keeps only the newest reference period, so no month overlaps UCDP**
  *Symptoms*: Found during the #5994 discovery (2026-09-24).  `scripts/_conflict-hapi.mjs:34` fetches from `previousMonthStart`. The aggregation at `:350-375` then resets the aggregate whenever a newer `referencePeriod` appears and skips older rows, so only the newest month survives. Redis holds September for HAPI, while `conflict:ucdp-events:v1` holds August. No month is ever held by both sources, so no cross-source comparison is possible, and a user sees each source's number for a different month on unlinked surfaces.  **Acceptance criteria** - [ ] The previous complete reference period is retained per country alongside the newest one. One extra key or field per country is enough. - [ ] Every published value carries its reference period, so consumers never compare different months.  Needed by #5994 (#6419 step 4).
  **Post-Mortem & Fix Analysis**:
  > Verified in production (read-only Redis GET, 2026-09-24 08:58 UTC). This is the first write by the fixed seeder, at 08:46:13 UTC. All **41 of 41** required countries now carry `previousCompleteSummary`, and every one is for 2026-08, the month UCDP's current candidate release covers. So the two sources can be compared for August.  **Caveat.** In this run `summary` and `previousCompleteSummary` are the same August period. The HDX snapshot timed out (`HDX_TIMEOUT`, `sourceState: degraded`) and the HAPI API fallback returned nothing newer than August. The previous run, from the HDX snapshot, had September as the newest period. The dashboard's HAPI figures are therefore one month older than an hour ago until HDX responds again. That is a transient freshness drop from the timeout, not this fix. The 16:47 local (12:47 UTC) check re-reads it.
  > Update: HDX recovered at 11:46 UTC, and `summary` is back to September 2026. `previousCompleteSummary` now carries August separately. For Ukraine that is September 1,969 and August 4,011, and 4,011 exactly matches the HDX August political-violence figure. The one-month freshness drop from the 08:46 timeout has cleared.

- **Issue #8583** (2026-09-24): **fix(conflict): HAPI conflictFatalities double counts civilian targeting**
  *Symptoms*: Found during the #5994 discovery (2026-09-24).  `scripts/_conflict-hapi.mjs:400` publishes `conflictFatalities: aggregate.fatalitiesPV + aggregate.fatalitiesCT`. The `:399` event count has the same shape.  The HDX HAPI documentation says the political violence, civilian targeting and demonstration categories "are not mutually exclusive" (hdx-hapi.readthedocs.io, coordination and context). In all 468 country-periods pulled from HDX, civilian targeting never exceeded political violence in events or fatalities: 0 of 468. Civilian targeting is a subset, so summing counts it twice.  **Impact.** The August 2026 total is 18,279 against 14,191 political-violence fatalities, 29% high. Saudi Arabia's September summary in Redis (`conflict:humanitarian:v1:SA`) reads 146, which is 73 + 73, exactly double.  **Acceptance criteria** - [ ] `conflictFatalities` and `conflictPoliticalViolenceEvents` use political violence only, or publish the categories separately. They must never publish the sum. - [ ] A test uses an HDX-shaped fixture where civilian targeting is a subset, and asserts no double count. - [ ] The published field description matches.  Blocks #5994 (#6419 step 4).
  **Post-Mortem & Fix Analysis**:
  > Verified in production (read-only Redis GET, 2026-09-24 08:58 UTC). The first write by the fixed seeder landed at 08:46:13 UTC (`seed-meta:conflict:humanitarian` fetchedAt 08:48:53 UTC).  The double count is gone. Compared with the HDX August 2026 breakdown pulled during #5994: - `conflict:humanitarian:v1:SA`: `conflictPoliticalViolenceEvents` is **8**. HDX has 8 political-violence and 2 civilian-targeting events, so the old sum would have been 10. - `conflict:humanitarian:v1:UA`: `conflictFatalities` is **3,940**. HDX has 4,011 political-violence and 464 civilian-targeting deaths, so the old sum would have been about 4,475. The 71-death gap to 4,011 is the source channel (see below), not a double count.  The exact September values from the report (SA 146 to 73, UA 2,130 to 1,969) are **not testable yet**. This run's HDX snapshot timed out (`snapshotFailureReason: HDX_TIMEOUT`, `sourceState: degraded`) and the seeder fell back to the HAPI API, which only returned periods up to August.
  > Update: the September values are now verified too. HDX recovered at 11:46 UTC (`sourceChannel: hdx-snapshot`). `conflict:humanitarian:v1:SA` September `conflictFatalities` is **73** (was 146 = 73 + 73). `conflict:humanitarian:v1:UA` September is **1,969** (was 2,130).

- **Issue #8582** (2026-09-24): **fix(conflict): UCDP seeder cap drops half of a month's deaths, including monthly country aggregates**
  *Symptoms*: Found during the #5994 discovery (2026-09-24), read-only against production Redis.  `scripts/seed-ucdp-events.mjs:32` caps the payload at 2,000 rows, and `:296` calls `capWithAnnualFloor` (`scripts/shared/ucdp-candidate.cjs:128-142`), which keeps the newest candidate rows. The August 2026 candidate release has 1,774 rows, of which Redis `conflict:ucdp-events:v1` holds 1,500.  The 274 dropped rows are dated 2026-08-01 to 2026-08-05 and carry 5,698 of 11,118 August deaths (51%). The largest is UCDP's Ukraine monthly aggregate, dated 08-01 to 08-31 with 5,017 deaths. UCDP dates such aggregates to the period start, so newest-first sorting evicts them first.  **Impact.** Ukraine August reads 524 in Redis against 5,648 in the release. The UCDP panel total, `get_conflict_events`, CII (`server/worldmonitor/intelligence/v1/get-risk-scores.ts:489`) and CRI (`server/worldmonitor/resilience/v1/_dimension-scorers.ts:1644`) all sum from the truncated payload.  Separately, the payload holds only December 2025 (the 500-row annual floor) and August 2026. January to July 2026 are absent, because only the newest candidate release is merged (`ucdp-candidate.cjs:75-77`).  **Acceptance criteria** - [ ] No candidate-release row is dropped while the cap has room for annual-floor rows. Alternatively, the cap is sized to the largest observed candidate release plus the floor. - [ ] Monthly aggregate rows (period start to period end) survive truncation. - [ ] A test pins a candidate release larger than 
  **Post-Mortem & Fix Analysis**:
  > Verified in production (read-only Redis GET, 2026-09-24 12:58 UTC). The first UCDP write by the fixed code landed at 12:03:37 UTC (`seed-meta:conflict:ucdp-events`, 2,306 records).  - `conflict:ucdp-events:v1` holds **2,306** events (was 2,000), about 775 KB. - All **1,774** August 2026 rows are present, carrying **11,118** deaths. The earliest August row is **2026-08-01** (was 08-05). - Ukraine August has **297** rows and **5,648** deaths (was 524), including the 5,017-death monthly aggregate.  The bootstrap projection `conflict:ucdp-events-bootstrap:v1` is **55,798 bytes**, with no `dedupeIndex` and `totalEvents` 2,306, after #8594. So it stays well under the `ucdpEvents` budget.

- **Issue #8572** (2026-09-24): **fix(tech-events): an upstream feed outage empties the Tech Events panel with no alert**
  *Symptoms*: ## Problem  The Tech Events panel reads `research:tech-events:v1` (`server/worldmonitor/research/v1/list-tech-events.ts:28`). If both upstream feeds (Techmeme ICS and dev.events RSS) fail, no alert fires. Today the panel falls back to curated events only. After 2026-12-07 it will go empty.  ## Why nothing alerts  1. **The seeder refreshes the cache and meta even when no upstream data arrived.** `scripts/seed-research.mjs:380` writes the mirror when `events.length > 0`. Line 260 always adds future curated conferences, so the check passes when both feeds are down. The write refreshes `seed-meta:research:tech-events:seeder`, so the key stays fresh and the result is cached for 8h.    The handler already refuses this payload. `fetchWidestTechEvents` (`list-tech-events.ts:470-500`) returns `null` unless at least one event has `source !== 'curated'`, following the Seed-Owned Key contract in CONCEPTS.md. The seeder does not apply the same check. 2. **The meta key is not on the alerting surface.** #8542 registered `seed-meta:research:tech-events:seeder` in `api/seed-health.js:216`. That endpoint requires an operator key and nothing alerts on it. `seed-freshness-monitor.yml` runs `scripts/check-seed-freshness.mjs`, which reads only `/api/health?compact=1`, and `api/health.js` has no entry for this key. `researchArxivHnTrending` (`api/health.js:1143`) alerts only when the whole `seed-research` process dies, not when the tech-events fetch fails. 3. **The curated list expires in December.

- **Issue #8559** (2026-09-23): **seed-gdelt-intel GRACEFUL·CHRONIC: 5s readSeedSnapshot timeout on the ~3.9MB materializer-state key times out every run's first attempt**
  *Symptoms*: Found by the Railway seeder diagnosis on 2026-09-23 (deployment `8f83aa66-2364-4b79-aad1-50838536ae57`).  **Evidence.** Across the 8 cron runs in that deployment's log (16:50–18:31 UTC), every run's first fetch attempt failed with:  ``` Retry 1/3 in 1000ms: Redis snapshot read returned invalid JSON (HTTP 200) (cause: The operation was aborted due to timeout) ```  3 runs needed a second retry, and the 18:31 run used all 4 attempts and exited 75 (`=== Failed gracefully ===`), which fired a Deploy Crashed alert. Each retry also repeats the whole fetch, GDELT downloads included.  **Cause.** `readSeedSnapshot` (`scripts/_seed-utils.mjs`) applies a fixed `AbortSignal.timeout(5_000)` that covers the response **body**. `gdelt:bulk:materializer-state:v1` is 3,915,335 bytes (`STRLEN`, 2026-09-23). The headers arrive in about 220 ms, but the body takes 0.8–2.6 s from a laptop and more than 5 s from Railway on the first attempt. The label "invalid JSON" is misleading: `resp.json()` threw because the body read hit the timeout.  **Fix.** Add a `timeoutMs` option to `readSeedSnapshot` (default stays 5s), and have the materializer read its snapshots with 30s. The worst case, 4 attempts × 30s plus backoff (about 127s), stays under the 240s fetch deadline.

- **Issue #8479** (2026-09-22): **fix(seed-budget): seeder retries are bounded by attempt count while the bundle runner kills by wall clock**
  *Symptoms*: #8429 fixed one instance of a general mismatch. This issue tracks the class.  **A seeder's retry loops are bounded by attempt count. The bundle runner kills by wall clock. Nothing reconciles the two.** When the attempt budget outlasts the section timeout, the runner SIGTERMs the seeder mid-retry and whatever the seeder would have done next (a fallback source, a graceful last-good TTL extension, a degraded publish) never runs.  That is exactly how `seed-bundle-market-backup` crashed on 2026-09-20 (#8426). #8429 fixed it for the two CoinGecko seeders by giving that one retry path a wall-clock budget and gating the arithmetic in CI. The underlying mismatch is untouched everywhere else.  ## Verified mechanism  All line numbers read from `origin/main` at `d00f7356d`.  `scripts/_seed-utils.mjs:901` exports `withRetry(fn, maxRetries = 3, delayMs = 1000)`. It takes an attempt count and a base delay. **There is no deadline, budget, or signal parameter.** The loop at `:903` is `for (let attempt = 0; attempt <= maxRetries; attempt++)`, so the default is 4 executions.  `runSeed` calls it at `:2624` as `withRetry(() => fetchFn({ runStartedAtMs: startMs }))`, with **one argument**. So every `runSeed` seeder whose `fetchFn` throws runs its entire fetch up to 4 times, with 1s, 2s and 4s between. This only applies when `fetchFn` throws; it short-circuits on `err.nonRetryable` and never re-runs a `fetchFn` that degrades internally and returns a partial payload. Corroborated independently by an

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

### Incident Patch 1: `f4641424` (2026-10-05)
**Commit Message**: fix(gateway): drain handler side channels from the request the handler received (#8864)

* fix(gateway): drain handler side channels from the request the handler received

#8418 started handing handlers a principal-stamped clone of the request
(withTrustedRateLimitPrincipal), but the gateway kept draining the
response-header, retryable and status-override side channels from the
pre-stamp request. Those channels are keyed by Request identity, so for
every caller with a resolved rate-limit principal (Pro sessions, user API
keys) the gateway silently dropped them: run-scenario answered 200 with no
Location header instead of 202, handler headers such as Retry-After were
lost, and an in-band retryable error was stored as a completed idempotent
response instead of releasing the lock.

The existing suites drive the public no-auth leads path, where no clone is
made, and the async-jobs source pin matched the drain call literally, so
both stayed green.

* chore(ci): owner-trusted head for codegen validation

Reviewed f27ea0e1e. Pinned make generate (buf 1.64.0, sebuf v0.11.1)
in a clean env over origin/main 9e8b2f650 + this PR's diff produced
no generated drift, so this empty commit only cre

**File**: `server/__tests__/gateway-side-channel-principal.test.ts` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+// @vitest-environment node
+
+/**
+ * Handler side channels for authenticated callers (server/_shared/response-headers.ts
+ * -> server/gateway.ts). Once auth resolves a rate-limit principal, the gateway
+ * hands the handler a clone stamped with that principal (withTrustedRateLimitPrincipal).
+ * Every side channel is a WeakMap/WeakSet keyed by the Request object the handler
+ * wrote on, so the gateway must drain them from that clone. The sibling suites
+ * (gateway-status-override, gateway-idempotency) drive the public no-auth leads
+ * path, where no principal is stamped and the clone never exists.
+ */
+
+import { beforeEach, describe, expect, test, vi } from "vitest";
+
+const runRedisPipeline = vi.fn();
+vi.mock("../_shared/redis", async (importActual) => {
+  const actual = await importActual<typeof import("../_shared/redis")>();
+  return {
+    ...actual,
+    runRedisPipeline: (...a: unknown[]) => runRedisPipeline(...a),
+  };
+});
+
+const checkRateLimit = vi.fn();
+const checkEndpointRateLimit = vi.fn();
+vi.mock("../_shared/rate-limit", async (importActual) => {
+  const actual = await importActual<typeof import("../_shared/rate-limit")>();
+  return {
+    ...actual,
+    checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
+    checkEndpointRateLimit: (...a: unknown[]) => checkEndpointRateLimit(...a),
+  };
+});
+
+const checkEntitlementDetailed = vi.fn();
+const getEntitlements = vi.fn();
+vi.mock("../_shared/entitlement-check", async (importActual) => {
+  const actual =
+    await importActual<typeof import("../_shared/entitlement-check")>();
+  return {
+    ...actual,
+    checkEntitlementDetailed: (...a: unknown[]) =>
+      checkEntitlementDetailed(...a),
+    getEntitlements: (...a: unknown[]) => getEntitlements(...a),
+  };
+});
+
+const resolveClerkSession = vi.fn();
+vi.mock("../_shared/auth-session", () => ({
+  resolveClerkSession: (...a: unknown[]) => resolveClerkSession(...a),
+}));
+
+const validateApiKey = vi.fn();
+vi.mock("../../api/_api-key.js", async (importActual) => ({
+  ...(await importActual<Record<string, unknown>>()),
+  USER_API_KEY_GATEWAY_VALIDATION_ERROR:
+    "User API key requires gateway validation",
+  validateApiKey: (...a: unknown[]) => validateApiKey(...a),
+}));
+
+const deliverUsageEvents = vi.fn();
+vi.mock("../_shared/usage", async (importActual) => {
+  const actual = await importActual<typeof import("../_shared/usage")>();
+  return {
+    ...actual,
+    deliverUsageEvents: (...a: unknown[]) => deliverUsageEvents(...a),
+  };
+});
+
+import { createDomainGateway } from "../gateway";
+import {
+  markRetryableResponse,
+  setResponseHeader,
+  setSuccessStatusOverride,
+} from "../_shared/response-headers";
+import { IDEMPOTENCY_HEADER } from "../_shared/idempotency";
+import { TRUSTED_RATE_LIMIT_PRINCIPAL_HEADER } from "../_shared/rate-limit";
+import {
+  createScenarioServiceRoutes,
+  type RunScenarioResponse,
+  type ScenarioServiceHandler,
+} from "../../src/generated/server/worldmonitor/scenario/v1/service_server";
+
+const RUN_PATH = "/api/scenario/v1/run-scenario";
+const STATUS_URL =
+  "/api/scenario/v1/get-scenario-status?jobId=scenario%3A1717200000000%3Aabcd1234";
+const ctx = { waitUntil: () => {} };
+
+const ACCEPTED: RunScenarioResponse = {
+  jobId: "scenario:1717200000000:abcd1234",
+  status: "pending",
+  statusUrl: STATUS_URL,
+};
+
+const runScenario = vi.fn<ScenarioServiceHandler["runScenario"]>();
+const scenarioHandler = {
+  runScenario: (...a: Parameters<ScenarioServiceHandler["runScenario"]>) =>
+    runScenario(...a),
+} as unknown as ScenarioServiceHandler;
+
+// The generated route, so the handler writes on ctx.request exactly as the
+// production run-scenario handler does.
+function makeGateway() {
+  return createDomainGateway(createScenarioServiceRoutes(scenarioHandler));
+}
+
+function post(headers: Record<string, string> = {}): Request {
+  return new Request(`https://www.worldmonitor.app${RUN_PATH}`, {
+    method: "POST",
+    headers: {
+      Authorization: "Bearer pro",
+      "Content-Type": "application/json",
+      "cf-connecting-ip": "203.0.113.7",
+      ...headers,
+    },
+    body: JSON.stringify({ scenarioId: "hormuz-closure", iso2: "US" }),
+  });
+}
+
+beforeEach(() => {
+  runRedisPipeline.mockReset().mockResolvedValue([]);
+  checkRateLimit.mockReset().mockResolvedValue(null);
+  checkEndpointRateLimit.mockReset().mockResolvedValue(null);
+  const entitlements = {
+    planKey: "pro",
+    features: { tier: 1, planLimits: { dashboardAiCallsPerDay: 50 } },
+    validUntil: Date.now() + 60_000,
+  };
+  resolveClerkSession
+    .mockReset()
+    .mockResolvedValue({ userId: "user_pro", orgId: null, role: "pro" });
+  checkEntitlementDetailed
+    .mockReset()
+    .mockResolvedValue({ response: null, entitlements });
+  getEntitlements.mockReset().mockResolvedValue(entitlements);
+  validateApiKey
+    .mockReset()
+    .mockResolvedValue({
+      valid: false,
+      
```

**File**: `server/gateway.ts` (modified, +9/-4)
```diff
@@ -2444,19 +2444,24 @@ export function createDomainGateway(
       });
     }
 
-    // Merge CORS + handler side-channel headers into response
+    // Merge CORS + handler side-channel headers into response.
+    // Every side channel below is keyed by the Request object the handler
+    // wrote it on, which is requestForHandler: a stamped principal makes it
+    // a clone, so draining the pre-stamp request would silently drop every
+    // header, retryable marker and status override set by an authenticated
+    // caller's handler.
     const mergedHeaders = new Headers(response.headers);
     for (const [key, value] of Object.entries(corsHeaders)) {
       mergedHeaders.set(key, value);
     }
-    const extraHeaders = drainResponseHeaders(request);
+    const extraHeaders = drainResponseHeaders(requestForHandler);
     if (extraHeaders) {
       for (const [key, value] of Object.entries(extraHeaders)) {
         mergedHeaders.set(key, value);
       }
     }
     appendDeprecationPolicyLink(mergedHeaders);
-    const retryableResponse = drainRetryableResponse(request);
+    const retryableResponse = drainRetryableResponse(requestForHandler);
     attachRequiredBboxDiagnosticHeaders(mergedHeaders, pathname, requiredBboxDiagnostic);
 
     // Handler side-channel status override (setSuccessStatusOverride): applied
@@ -2465,7 +2470,7 @@ export function createDomainGateway(
     // thrown ApiError statuses always win. GET success flows are excluded:
     // the ETag/304 + CDN-cache path below assumes 200. Always drained so a
     // set-but-unapplied override can't leak state.
-    const statusOverride = drainSuccessStatusOverride(request);
+    const statusOverride = drainSuccessStatusOverride(requestForHandler);
     const finalStatus =
       statusOverride !== undefined && request.method === 'POST' && response.status === 200
         ? statusOverride
```

**File**: `tests/openapi-async-jobs-contract.test.mjs` (modified, +4/-1)
```diff
@@ -84,7 +84,10 @@ describe('OpenAPI async-job pattern contract (RunScenario 202)', () => {
     assert.match(handler, /setResponseHeader\(ctx\.request,\s*'Location'/, 'run-scenario.ts must set the Location header');
     // …and the gateway drains + applies it (POST-200 only).
     const gateway = readFileSync(resolve(root, 'server/gateway.ts'), 'utf8');
-    assert.match(gateway, /drainSuccessStatusOverride\(request\)/, 'gateway.ts must drain the status override');
+    // The handler writes on the principal-stamped clone it was given, so the
+    // drain must read that same object (gateway-side-channel-principal.test.ts
+    // proves the runtime behaviour for an authenticated caller).
+    assert.match(gateway, /drainSuccessStatusOverride\(requestForHandler\)/, 'gateway.ts must drain the status override from the request the handler received');
     // Location must be CORS-exposed or browser agents cannot read the poll URL.
     const cors = readFileSync(resolve(root, 'server/cors.ts'), 'utf8');
     assert.match(cors, /'Location',/, 'cors.ts EXPOSED_HEADERS must include Location');
```

---

### Incident Patch 2: `9e8b2f65` (2026-10-05)
**Commit Message**: fix(plugin): disclose retained Country Brief digest coverage (#8858)

* test(plugin): reproduce Country Brief projection and replacement failures

* test(plugin): require refreshed Country Brief resource identity

* fix(plugin): retain projected Country Brief evidence

* test(plugin): expose retained Country Brief digest disclosure gap

* fix(plugin): disclose retained Country Brief news digest coverage

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Elie Habib <[REDACTED_EMAIL]>

**File**: `api/mcp/constants.ts` (modified, +1/-1)
```diff
@@ -269,7 +269,7 @@ export const SERVER_NAME = 'worldmonitor';
 //   - MCP Apps interactive-dashboard fleet: four new ui:// app-shell resources
 //     joining the v1.11.0 country-risk widget —
 //       * ui://worldmonitor/world-brief-v2.html      (get_world_brief)
-//       * ui://worldmonitor/country-brief-v2.html (get_country_brief)
+//       * ui://worldmonitor/country-brief-v3.html (get_country_brief)
 //       * ui://worldmonitor/market-radar.html      (get_market_data)
 //       * ui://worldmonitor/chokepoint-monitor.html (get_chokepoint_status)
 //     Each is linked from its backing tool via `_meta.ui.resourceUri` (+ the
```

**File**: `api/mcp/ui/country-brief-app.ts` (modified, +31/-0)
```diff
@@ -25,6 +25,7 @@ import { buildAppHtml } from './shell';
 const STYLES = `
   .lens { display: inline-block; margin: 4px 0 0; font-size: 11px; color: var(--muted); }
   .lens b { color: var(--fg); font-weight: 600; }
+  .grounding-notice { margin: 12px 0 0; padding: 10px; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
   .brief { margin: 14px 0 4px; }
   .brief .para { margin: 0 0 10px; font-size: 14px; line-height: 1.6; }
   .section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
@@ -48,6 +49,7 @@ const BODY = `
   <div class="lens" id="lens" style="display:none"></div>
   <div class="empty" id="empty">Waiting for country-brief data…</div>
   <div id="card" style="display:none">
+    <div class="grounding-notice" id="grounding-notice" role="note" style="display:none"></div>
     <div class="brief" id="brief"></div>
     <div class="section" id="src-sec" style="display:none">
       <div class="sec-label">Sources</div>
@@ -67,6 +69,35 @@ const RENDER = `
     q("empty").style.display = "none";
     q("card").style.display = "block";
 
+    var groundingNotice = q("grounding-notice");
+    groundingNotice.textContent = "";
+    groundingNotice.style.display = "none";
+    var coverage = data.digestCoverage;
+    if (coverage && typeof coverage === "object" && !Array.isArray(coverage) &&
+        (coverage.servedStale === true || coverage.state === "stale")) {
+      var notice = "The news digest is retained, not live. Current news grounding is not confirmed.";
+      var age = coverage.staleAgeSeconds;
+      if (typeof age === "number" && Number.isFinite(age) && age > 0) {
+        var amount = age < 60 ? Math.max(1, Math.round(age)) : Math.round(age / 60);
+        var unit = age < 60 ? "second" : "minute";
+        notice += " Reported snapshot age: " + amount + " " + unit + (amount === 1 ? "" : "s") + ".";
+      } else {
+        notice += " Snapshot age is unknown.";
+      }
+      var attempt = typeof coverage.attemptedAt === "string" ? coverage.attemptedAt.slice(0, 80) : "";
+      var attemptDate = attempt ? new Date(attempt) : null;
+      if (attemptDate && !isNaN(attemptDate.getTime())) {
+        var utcAttempt = attemptDate.toISOString();
+        if (attempt === utcAttempt || attempt === utcAttempt.replace(".000Z", "Z")) {
+          notice += " Last refresh attempt: " + utcAttempt + ".";
+        }
+      }
+      var reason = typeof coverage.staleReason === "string" ? coverage.staleReason.slice(0, 240) : "";
+      if (reason) notice += " Reason: " + reason;
+      groundingNotice.textContent = notice;
+      groundingNotice.style.display = "block";
+    }
+
     var name = collapseWs(data.countryName) || countryName(data.countryCode || data.country_code);
     setText("title", name ? name + " Brief" : "Country Brief");
 
```

**File**: `api/mcp/ui/registry.ts` (modified, +4/-3)
```diff
@@ -43,7 +43,8 @@ export const COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk-v2.html';
 const LEGACY_COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk.html';
 export const WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief-v2.html';
 const LEGACY_WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief.html';
-export const COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief-v2.html';
+export const COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief-v3.html';
+const PREVIOUS_COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief-v2.html';
 const LEGACY_COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief.html';
 export const MARKET_RADAR_UI_URI = 'ui://worldmonitor/market-radar-v3.html';
 export const CHOKEPOINT_MONITOR_UI_URI = 'ui://worldmonitor/chokepoint-monitor-v2.html';
@@ -180,7 +181,7 @@ export const UI_RESOURCE_REGISTRY: UiResourceDef[] = [
 const UI_RESOURCE_BY_URI = new Map(UI_RESOURCE_REGISTRY.map((r) => [r.uri, r]));
 
 export function isUiResourceUri(uri: string): boolean {
-  return uri === LEGACY_COUNTRY_BRIEF_UI_URI || uri === LEGACY_COUNTRY_RISK_UI_URI || uri === LEGACY_WORLD_BRIEF_UI_URI || uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
+  return uri === PREVIOUS_COUNTRY_BRIEF_UI_URI || uri === LEGACY_COUNTRY_BRIEF_UI_URI || uri === LEGACY_COUNTRY_RISK_UI_URI || uri === LEGACY_WORLD_BRIEF_UI_URI || uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
 }
 
 // resources/list public shape — {uri, name, description, mimeType} plus the
@@ -216,7 +217,7 @@ export async function buildUiResourceRead(
   if (uri === NEWS_DASHBOARD_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI) return readNewsDashboard(id, corsHeaders, uri);
   const canonicalUri = uri === LEGACY_COUNTRY_RISK_UI_URI ? COUNTRY_RISK_UI_URI
     : uri === LEGACY_WORLD_BRIEF_UI_URI ? WORLD_BRIEF_UI_URI
-    : uri === LEGACY_COUNTRY_BRIEF_UI_URI ? COUNTRY_BRIEF_UI_URI
+    : (uri === PREVIOUS_COUNTRY_BRIEF_UI_URI || uri === LEGACY_COUNTRY_BRIEF_UI_URI) ? COUNTRY_BRIEF_UI_URI
     : uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI ? CHOKEPOINT_MONITOR_UI_URI
     : uri === LEGACY_NEWS_INTELLIGENCE_UI_URI ? NEWS_INTELLIGENCE_UI_URI
     : uri === LEGACY_CONFLICT_EVENTS_UI_URI ? CONFLICT_EVENTS_UI_URI
```

**File**: `docs/mcp-apps.mdx` (modified, +2/-2)
```diff
@@ -37,7 +37,7 @@ Three discovery signals must stay aligned:
 |---|---|---|---|
 | `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | Country Risk (interactive) | Composite Instability Index score, component breakdown, travel advisory, and sanctions exposure. |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | World Brief (interactive) | Precomputed citation-grounded global brief, grounding headlines, and source feed articles. |
-| `ui://worldmonitor/country-brief-v2.html` | `get_country_brief` | Country Brief (interactive) | Per-country intelligence brief, analytical framework lens, and grounding sources. |
+| `ui://worldmonitor/country-brief-v3.html` | `get_country_brief` | Country Brief (interactive) | Per-country intelligence brief, analytical framework lens, and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Market Radar (interactive) | Fear & Greed plus all loaded quote rows, asset names and expandable intraday charts from the same snapshot. |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | Chokepoint Monitor (interactive) | Per-chokepoint transit summaries, week-over-week change, tanker split, and risk-level badge. |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | News Intelligence (interactive) | AI-classified top stories with category, alert flag, country, source provenance, snapshot status and explicit loaded/sample counts. |
@@ -48,7 +48,7 @@ Three discovery signals must stay aligned:
 | `ui://worldmonitor/news-dashboard-v3.html` | `open_news_dashboard` | WorldMonitor news and maps | Dashboard news panels, current event markers, filters and country selection. |
 | `ui://worldmonitor/country-view-v3.html` | `open_country_brief` | WorldMonitor country view | Shared country sections, topics, evidence and exports with host-authorized reads. |
 
-The compact Country Brief view accepts the original response and supported object projections. Replacing a result clears prior paragraphs, evidence, source links and generation time. Hosts advertise `country-brief-v2.html`; the original `country-brief.html` remains a private read alias for older installed metadata until those hosts refresh their resource discovery. Ordinary country asks still open the full country view.
+The compact Country Brief view accepts the original response and supported object projections. Retained news digest coverage shows a neutral notice without claiming that the assessment used retained grounding. Reported snapshot age and a valid UTC refresh-attempt time appear only when supplied. Missing or malformed coverage makes no freshness claim. Replacing a result clears prior paragraphs, evidence, source links, generation time and retained notice. Hosts advertise `country-brief-v3.html`; `country-brief-v2.html` and the original `country-brief.html` remain private read aliases until older installed metadata is retired. Ordinary country asks still open the full country view.
 
 Country Risk v2 preserves supplied original and projected objects, including nested CII components and upstream availability. Missing or malformed advisory values remain unknown; an explicit empty native string still means no advisory. Result replacement clears prior risk details. The original `ui://worldmonitor/country-risk.html` remains a private read alias for installed metadata and can be removed when that metadata is retired.
 
```

**File**: `docs/mcp-overview.mdx` (modified, +2/-2)
```diff
@@ -511,7 +511,7 @@ The server supports [MCP Apps](https://modelcontextprotocol.io/extensions/apps/b
 |-----------------|-------------|---------|
 | `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | CII score, unrest/conflict/security/news component breakdown, travel-advisory level, and OFAC sanctions exposure. |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | The precomputed, citation-grounded global intelligence brief as readable paragraphs, plus grounding headlines and source articles. |
-| `ui://worldmonitor/country-brief-v2.html` | `get_country_brief` | The AI-synthesised per-country brief as paragraphs, with the analytical framework lens and grounding sources. |
+| `ui://worldmonitor/country-brief-v3.html` | `get_country_brief` | The AI-synthesised per-country brief as paragraphs, with the analytical framework lens and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed plus all loaded equity, commodity, crypto, Gulf and sector quotes, asset names and expandable intraday charts. |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | Per-chokepoint rolling transit summaries (today's count, week-over-week change, tanker split) with a risk-level badge. |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | AI-classified top stories with category, alert flag, country, and source. |
@@ -528,7 +528,7 @@ All UI resources share `mimeType: text/html;profile=mcp-app`.
 
 `resources/read` on a `ui://` URI returns an HTML view. Unlike the data resources, a `ui://` read is **public and quota-exempt** — the template carries no data and spends no upstream data call, so a host can preload it (and an agent-readiness scanner can fetch it) without credentials and without touching the Pro daily cap. Statically bundled widgets are self-contained. The news, country and market views load their current JavaScript and CSS from `https://www.worldmonitor.app`, as permitted by their resource metadata. All views communicate with the host over the standard MCP Apps `postMessage` bridge (`ui/initialize` → `ui/notifications/tool-result` → `ui/notifications/size-changed`).
 
-The compact Country Brief view accepts the original response and supported object projections. Replacing a result clears prior paragraphs, evidence, source links and generation time. Hosts advertise `country-brief-v2.html`; the original `country-brief.html` remains a private read alias for older installed metadata until those hosts refresh their resource discovery. Ordinary country asks still open the full country view.
+The compact Country Brief view accepts the original response and supported object projections. Retained news digest coverage shows a neutral notice without claiming that the assessment used retained grounding. Reported snapshot age and a valid UTC refresh-attempt time appear only when supplied. Missing or malformed coverage makes no freshness claim. Replacing a result clears prior paragraphs, evidence, source links, generation time and retained notice. Hosts advertise `country-brief-v3.html`; `country-brief-v2.html` and the original `country-brief.html` remain private read aliases until older installed metadata is retired. Ordinary country asks still open the full country view.
 
 For the full MCP Apps contract — host flow, security posture, per-widget inventory, source files, and docs-stat drift checks — see [MCP Apps](/mcp-apps).
 
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +2/-2)
```diff
@@ -37,7 +37,7 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 |---|---|---|---|
 | `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | 国家风险（交互式） | 综合不稳定指数评分、组成部分细分、旅行建议和制裁风险敞口。 |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | 世界简报（交互式） | AI 摘要的全球简报、支撑性头条新闻和信息源文章。 |
-| `ui://worldmonitor/country-brief-v2.html` | `get_country_brief` | 国家简报（交互式） | 按国家划分的情报简报、分析框架视角和支撑来源。 |
+| `ui://worldmonitor/country-brief-v3.html` | `get_country_brief` | 国家简报（交互式） | 按国家划分的情报简报、分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | 市场雷达（交互式） | 恐惧贪婪综合指数，以及股票、大宗商品、加密货币、海湾地区和行业报价表，附带带符号、颜色编码的涨跌。 |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | 咽喉要道监视器（交互式） | 按咽喉要道划分的通行摘要、周环比变化、油轮构成和风险等级徽章。 |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | 新闻情报（交互式） | AI 分类的头条报道，附带类别、警报标记、国家、来源背景、快照状态，以及明确的已加载或样本数量。 |
@@ -46,7 +46,7 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 | `ui://worldmonitor/prediction-markets-v3.html` | `get_prediction_markets` | 预测市场（交互式） | 按类别（地缘政治、科技、金融）分组的事件合约赔率，每个市场附带一个概率条。完整响应投影和摘要样本保留已加载的合约及快照信息。缺失或无效的类别会明确标记为不可用或未包含；未知的新鲜度也会明确显示。 |
 | `ui://worldmonitor/forecasts-v3.html` | `get_forecast_predictions` | 预测（交互式） | 以概率卡片形式呈现的 AI 生成的地缘政治和经济预测（标题、领域、地区）。 |
 
-精简国家简报视图支持原始响应和受支持的对象投影。替换结果会清除之前的段落、证据、来源链接和生成时间。宿主声明 `country-brief-v2.html`；原始 `country-brief.html` 作为旧版已安装元数据的私有读取别名保留，直到这些宿主刷新资源发现。普通国家请求仍打开完整国家视图。
+精简国家简报视图支持原始响应和受支持的对象投影。保留的新闻摘要覆盖信息会显示中性提示，不声称评估使用了保留的支撑材料。仅在响应提供时显示报告的快照年龄和有效的 UTC 刷新尝试时间。缺失或格式错误的覆盖信息不作新鲜度声明。替换结果会清除之前的段落、证据、来源链接、生成时间和保留摘要提示。宿主声明 `country-brief-v3.html`；`country-brief-v2.html` 和原始 `country-brief.html` 作为私有读取别名保留，直到旧版已安装元数据退役。普通国家请求仍打开完整国家视图。
 
 原始的 `ui://worldmonitor/prediction-markets.html` 和之前的 `ui://worldmonitor/prediction-markets-v2.html` 仍作为未列出的读取别名。刷新已安装连接的元数据并打开新卡片后才能加载 v3。已有的缓存卡片仍使用旧 HTML。省略合约数据的投影无法恢复被省略的详情。返回的空类别不能证明上游交易平台的完整覆盖。
 
```

**File**: `docs/zh/mcp-overview.mdx` (modified, +2/-2)
```diff
@@ -485,7 +485,7 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 |-----------------|-------------|---------|
 | `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | CII 评分、动荡/冲突/安全/新闻组成部分分解、旅行警示级别，以及 OFAC 制裁敞口。 |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | 以可读段落呈现的预计算、有引用依据的全球情报简报，外加支撑性头条和来源文章。 |
-| `ui://worldmonitor/country-brief-v2.html` | `get_country_brief` | 以段落呈现的 AI 合成各国简报，附带分析框架视角和支撑来源。 |
+| `ui://worldmonitor/country-brief-v3.html` | `get_country_brief` | 以段落呈现的 AI 合成各国简报，附带分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed 综合指标，外加各资产类别的报价表（股票、大宗商品、加密货币、海湾、板块），带有带符号、色彩编码的涨跌。 |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | 各咽喉要道的滚动过境摘要（今日计数、周环比变化、油轮占比），并带有风险级别标记。 |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | AI 分类的热门报道，带有类别、警报标记、国家和来源。 |
@@ -500,7 +500,7 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 
 对 `ui://` URI 的 `resources/read` 返回 HTML 视图。与数据资源不同，`ui://` 读取是**公开且豁免配额的** —— 该模板不承载数据，也不产生上游数据调用，因此宿主可以在无凭据、不触及 Pro 每日上限的情况下预加载它（agent 就绪性扫描器也可以获取它）。静态打包的组件是自包含的。新闻、国家和市场视图会根据资源元数据许可，从 `https://www.worldmonitor.app` 加载当前 JavaScript 和 CSS。所有视图都通过标准的 MCP Apps `postMessage` 桥（`ui/initialize` → `ui/notifications/tool-result` → `ui/notifications/size-changed`）与宿主通信。
 
-精简国家简报视图支持原始响应和受支持的对象投影。替换结果会清除之前的段落、证据、来源链接和生成时间。宿主声明 `country-brief-v2.html`；原始 `country-brief.html` 作为旧版已安装元数据的私有读取别名保留，直到这些宿主刷新资源发现。普通国家请求仍打开完整国家视图。
+精简国家简报视图支持原始响应和受支持的对象投影。保留的新闻摘要覆盖信息会显示中性提示，不声称评估使用了保留的支撑材料。仅在响应提供时显示报告的快照年龄和有效的 UTC 刷新尝试时间。缺失或格式错误的覆盖信息不作新鲜度声明。替换结果会清除之前的段落、证据、来源链接、生成时间和保留摘要提示。宿主声明 `country-brief-v3.html`；`country-brief-v2.html` 和原始 `country-brief.html` 作为私有读取别名保留，直到旧版已安装元数据退役。普通国家请求仍打开完整国家视图。
 
 有关完整的 MCP Apps 契约 —— 宿主流程、安全态势、各小部件清单、源文件以及 docs-stat 漂移检查 —— 请参阅 [MCP Apps](/zh/mcp-apps)。
 
```

**File**: `public/.well-known/mcp/server-card.json` (modified, +2/-2)
```diff
@@ -747,7 +747,7 @@
       "uiResources": [
         "ui://worldmonitor/country-risk-v2.html",
         "ui://worldmonitor/world-brief-v2.html",
-        "ui://worldmonitor/country-brief-v2.html",
+        "ui://worldmonitor/country-brief-v3.html",
         "ui://worldmonitor/market-radar-v3.html",
         "ui://worldmonitor/chokepoint-monitor-v2.html",
         "ui://worldmonitor/news-intelligence-v2.html",
@@ -758,7 +758,7 @@
         "ui://worldmonitor/news-dashboard-v3.html",
         "ui://worldmonitor/country-view-v3.html"
       ],
-      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk-v2.html, get_world_brief → world-brief-v2.html, get_country_brief → country-brief-v2.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor-v2.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
+      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk-v2.html, get_world_brief → world-brief-v2.html, get_country_brief → country-brief-v3.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor-v2.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
     }
   },
   "features": {
```

---

### Incident Patch 3: `d3b955e4` (2026-10-05)
**Commit Message**: fix(plugin): resolve news categories against loaded identities (#8857)

* test(plugin): cover loaded news category identity and refusal

* fix(plugin): resolve category identity against loaded news

* test: cover category removal during pending hazard load

* test: match existing Fires layer control label

* fix: revalidate news category after hazard loading

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Elie Habib <[REDACTED_EMAIL]>

**File**: `e2e/plugin-news-metering.spec.ts` (modified, +196/-8)
```diff
@@ -8,10 +8,10 @@ test.use({ serviceWorkers: 'block' });
 type HostCall = { name: string; arguments: Record<string, unknown> };
 type ViewReceipt = { applied?: boolean; view?: { renderer?: string; source?: string; map_layers?: string[] }; center: { lat: number; lon: number } | null; map: { zoom: number }; renderer?: { mode: string }; viewport?: { settled: boolean; interruptedBy: string } };
 type NewsInteraction = { kind: string; link: string; title: string; source: string; displayLabel: string };
-type NewsContext = { latestInteraction?: NewsInteraction | null; view: Record<string, unknown>; categoryLabel?: string };
-async function installNewsHost(page: Page, deniedInitially = false, serverTools = true, fixture: boolean | string[] = false, modelContext = true, observeCamera = false) {
+type NewsContext = { applied?: boolean; reason?: string; latestInteraction?: NewsInteraction | null; view: Record<string, unknown>; categoryLabel?: string; center?: { lat: number; lon: number } | null; map?: { zoom: number } };
+async function installNewsHost(page: Page, deniedInitially = false, serverTools = true, fixture: boolean | string[] = false, modelContext = true, observeCamera = false, initialView: Record<string, unknown> = { map_layers: ['natural'] }) {
   const selectionFixture = fixture === true;
-  const categoryIds = Array.isArray(fixture) ? fixture : ['world'];
+  let categoryIds = Array.isArray(fixture) ? fixture : ['world'];
   const calls: HostCall[] = [];
   const contexts: NewsContext[] = [];
   const methods: string[] = [];
@@ -94,23 +94,23 @@ async function installNewsHost(page: Page, deniedInitially = false, serverTools
   });
   await page.goto('/news-host-test');
   const html = buildPluginShell({ origin: 'https://www.worldmonitor.app', entry: 'plugin.html', root: 'pluginRoot' });
-  await page.evaluate(html => {
+  await page.evaluate(({ html, initialView }) => {
     const frame = document.querySelector('iframe')!;
     const host = (window as unknown as { newsHost: (method: string, params: object) => Promise<object> }).newsHost;
     window.addEventListener('message', async event => {
       if (event.source !== frame.contentWindow || event.data?.jsonrpc !== '2.0' || !event.data.id || !event.data.method) return;
       const result = await host(event.data.method, event.data.params);
       frame.contentWindow!.postMessage({ jsonrpc: '2.0', id: event.data.id, result }, '*');
       if (event.data.method === 'ui/initialize') {
-        const args = { map_layers: ['natural'] };
+        const args = initialView;
         frame.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: args } }, '*');
         const result = await host('tools/call', { name: 'open_news_dashboard', arguments: args });
         frame.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result }, '*');
       }
     });
     frame.srcdoc = html.replace('<head>', `<head><base href="${location.origin}/">`);
-  }, html);
-  return { calls, contexts, methods, viewReceipts, get snapshot() { return snapshot; }, removeSecondArticle: () => { articles = [article]; }, get units() { return units; }, get viewUpdates() { return viewUpdates; }, deny: () => { denied = true; }, delayRefresh: () => { delayRefresh = true; }, releaseRefresh, delayHazards: () => { delayHazards = true; }, releaseHazards, failHazards: () => { failHazards = true; }, recoverHazards: () => { failHazards = false; } };
+  }, { html, initialView });
+  return { calls, contexts, methods, viewReceipts, get snapshot() { return snapshot; }, setCategories: (keys: string[]) => { categoryIds = keys; }, removeSecondArticle: () => { articles = [article]; }, get units() { return units; }, get viewUpdates() { return viewUpdates; }, deny: () => { denied = true; }, delayRefresh: () => { delayRefresh = true; }, releaseRefresh, delayHazards: () => { delayHazards = true; }, releaseHazards, failHazards: () => { failHazards = true; }, recoverHazards: () => { failHazards = false; } };
 }
 
 async function newsAction(page: Page, name: string, args: object) {
@@ -130,7 +130,7 @@ async function newsAction(page: Page, name: string, args: object) {
 async function useSvgNewsMap(page: Page) {
   await page.addInitScript(() => {
     const original = HTMLCanvasElement.prototype.getContext;
-    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
+    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
       if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
       return Reflect.apply(original, this, [type, ...args]);
     } as typeof original;
@@ -281,6 +281,194 @@ test('an older failed hydration cannot clear a newer loaded article interaction'
   expect(host.calls.map(call => call.name)).toEqual(['open_news_dashboard', 'get_natural_disasters', 'open_news_dashboard', 'get_n
```

**File**: `src/plugin-main.ts` (modified, +49/-4)
```diff
@@ -22,9 +22,22 @@ import { LAYER_REGISTRY } from '@/config/map-layer-definitions';
 import { loadPluginHazardSnapshot, type PluginHazardSnapshot } from '@/services/plugin-map-snapshot';
 import { newsPanelAdmissionSchema, type NewsPanelAdmission } from '../shared/panel-admission';
 
+function resolveNewsCategory(requested: string, keys: string[]): { category: string } | { reason: 'unknown_category' | 'ambiguous_category' } {
+  if (keys.includes(requested)) return { category: requested };
+  const normalized = requested.trim().toLowerCase();
+  const matches = keys.filter(key => key.trim().toLowerCase() === normalized || (DEFAULT_PANELS[key]?.name ?? key).trim().toLowerCase() === normalized);
+  return matches.length === 1 ? { category: matches[0]! } : { reason: matches.length ? 'ambiguous_category' : 'unknown_category' };
+}
+
 function mountPlugin(): void {
   const panels = new Map<string, NewsPanel>();
   const status = document.getElementById('pluginStatus')!;
+  const categoryNotice = document.createElement('div');
+  categoryNotice.id = 'pluginCategoryNotice';
+  categoryNotice.setAttribute('role', 'status');
+  categoryNotice.style.padding = '8px';
+  categoryNotice.hidden = true;
+  status.after(categoryNotice);
   const usageNotice = document.getElementById('pluginUsage')!;
   let admission: NewsPanelAdmission | undefined;
   let hostView: unknown;
@@ -128,10 +141,20 @@ function mountPlugin(): void {
     return refreshing;
   }
 
+  function loadedCategoryKeys(): string[] {
+    return Object.entries(digest?.categories ?? {}).filter(([, bucket]) => bucket && Array.isArray(bucket.items)).map(([key]) => key);
+  }
+
   function renderDigest(): void {
     if (!digest) return;
+    const categories = loadedCategoryKeys();
+    if (view.category && !categories.includes(view.category)) {
+      categoryNotice.textContent = `The selected news category "${visibleCategoryLabel()}" is no longer loaded. Showing All news panels.`;
+      categoryNotice.hidden = false;
+      view = { ...view, category: undefined };
+    }
     for (const [category, panel] of panels) {
-      if (!(category in digest.categories)) { panel.destroy(); panel.getElement().remove(); panels.delete(category); }
+      if (!categories.includes(category)) { panel.destroy(); panel.getElement().remove(); panels.delete(category); }
     }
     const locations: Parameters<MapContainer['setNewsLocations']>[0] = [];
     news = [];
@@ -185,7 +208,7 @@ function mountPlugin(): void {
     visibleMarkers = locations;
     map.setNewsLocations(locations);
     updateSelect(sourceSelect, [...new Set(news.map(item => item.source))].sort(), view.source ?? '', 'All sources');
-    updateSelect(categorySelect, Object.keys(digest.categories), view.category ?? '', 'All news panels');
+    updateSelect(categorySelect, categories, view.category ?? '', 'All news panels');
     search.registerSource('news', news.map(item => ({ id: item.link, title: item.title, subtitle: item.source, data: item })));
     status.textContent = !Object.keys(digest.categories).length ? 'No news is available.' : digest.coverage?.servedStale ? 'Showing cached news.' : digest.coverage?.state === 'partial' ? 'Some news sources are unavailable.' : '';
   }
@@ -195,20 +218,36 @@ function mountPlugin(): void {
     select.value = value;
   }
 
+  function refuseNewsCategory(requestedCategory: string, reason: 'unknown_category' | 'ambiguous_category'): object {
+    categoryNotice.textContent = reason === 'ambiguous_category'
+      ? `The news category "${requestedCategory}" matches more than one loaded panel. Select a news category from the list. The current view has been kept.`
+      : `The news category "${requestedCategory}" is not loaded. Select a news category from the list. The current view has been kept.`;
+    categoryNotice.hidden = false;
+    const receipt = { applied: false, reason, requestedCategory, view, categoryLabel: visibleCategoryLabel(), latestInteraction, center: map.getCenter(), map: map.getState() };
+    publishContext(receipt);
+    return receipt;
+  }
+
   async function applyView(input: unknown, options: { reset?: boolean; keepCurrentView?: boolean; reloadLayers?: boolean; generation?: number } = {}): Promise<object> {
     const next = pluginNewsViewSchema.parse(input);
     const operation = viewQueue.then(() => {
       const desired = options.keepCurrentView ? { ...view } : { ...next };
       if (options.reloadLayers && desired.map_layers === undefined) desired.map_layers = view.map_layers ?? [];
-      return updateView(desired, options.reset ?? false, options.generation);
+      return updateView(desired, options.reset ?? false, options.generation, Boolean(options.reset || (!options.keepCurrentView && next.category !== undefined)));
     });
     viewQueue = operation.catch(() => {});
     return operation;
   }
 
-  async function updateView(next: PluginNewsView, reset: boolean, generation?: number): Promise<object> {
+  async function updateVi
```

---

### Incident Patch 4: `3f962d57` (2026-10-05)
**Commit Message**: fix(plugin): restore projected Country Brief content (#8854)

* test(plugin): reproduce Country Brief projection and replacement failures

* test(plugin): require refreshed Country Brief resource identity

* fix(plugin): retain projected Country Brief evidence

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Elie Habib <[REDACTED_EMAIL]>

**File**: `api/mcp/constants.ts` (modified, +1/-1)
```diff
@@ -269,7 +269,7 @@ export const SERVER_NAME = 'worldmonitor';
 //   - MCP Apps interactive-dashboard fleet: four new ui:// app-shell resources
 //     joining the v1.11.0 country-risk widget —
 //       * ui://worldmonitor/world-brief-v2.html      (get_world_brief)
-//       * ui://worldmonitor/country-brief.html    (get_country_brief)
+//       * ui://worldmonitor/country-brief-v2.html (get_country_brief)
 //       * ui://worldmonitor/market-radar.html      (get_market_data)
 //       * ui://worldmonitor/chokepoint-monitor.html (get_chokepoint_status)
 //     Each is linked from its backing tool via `_meta.ui.resourceUri` (+ the
```

**File**: `api/mcp/ui/country-brief-app.ts` (modified, +2/-1)
```diff
@@ -62,7 +62,8 @@ const BODY = `
 `;
 
 const RENDER = `
-    if (!data || typeof data !== "object") return;
+    if (data && typeof data === "object" && Object.prototype.hasOwnProperty.call(data, "projection")) data = data.projection;
+    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
     q("empty").style.display = "none";
     q("card").style.display = "block";
 
```

**File**: `api/mcp/ui/registry.ts` (modified, +4/-2)
```diff
@@ -43,7 +43,8 @@ export const COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk-v2.html';
 const LEGACY_COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk.html';
 export const WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief-v2.html';
 const LEGACY_WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief.html';
-export const COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief.html';
+export const COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief-v2.html';
+const LEGACY_COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief.html';
 export const MARKET_RADAR_UI_URI = 'ui://worldmonitor/market-radar-v3.html';
 export const CHOKEPOINT_MONITOR_UI_URI = 'ui://worldmonitor/chokepoint-monitor-v2.html';
 const LEGACY_CHOKEPOINT_MONITOR_UI_URI = 'ui://worldmonitor/chokepoint-monitor.html';
@@ -179,7 +180,7 @@ export const UI_RESOURCE_REGISTRY: UiResourceDef[] = [
 const UI_RESOURCE_BY_URI = new Map(UI_RESOURCE_REGISTRY.map((r) => [r.uri, r]));
 
 export function isUiResourceUri(uri: string): boolean {
-  return uri === LEGACY_COUNTRY_RISK_UI_URI || uri === LEGACY_WORLD_BRIEF_UI_URI || uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
+  return uri === LEGACY_COUNTRY_BRIEF_UI_URI || uri === LEGACY_COUNTRY_RISK_UI_URI || uri === LEGACY_WORLD_BRIEF_UI_URI || uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
 }
 
 // resources/list public shape — {uri, name, description, mimeType} plus the
@@ -215,6 +216,7 @@ export async function buildUiResourceRead(
   if (uri === NEWS_DASHBOARD_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI) return readNewsDashboard(id, corsHeaders, uri);
   const canonicalUri = uri === LEGACY_COUNTRY_RISK_UI_URI ? COUNTRY_RISK_UI_URI
     : uri === LEGACY_WORLD_BRIEF_UI_URI ? WORLD_BRIEF_UI_URI
+    : uri === LEGACY_COUNTRY_BRIEF_UI_URI ? COUNTRY_BRIEF_UI_URI
     : uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI ? CHOKEPOINT_MONITOR_UI_URI
     : uri === LEGACY_NEWS_INTELLIGENCE_UI_URI ? NEWS_INTELLIGENCE_UI_URI
     : uri === LEGACY_CONFLICT_EVENTS_UI_URI ? CONFLICT_EVENTS_UI_URI
```

**File**: `api/mcp/ui/shell.ts` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ function renderBridgeTail(appName: string): string {
         var result = msg.params && msg.params.result ? msg.params.result : msg.params;
         showPanelUsage(result);
         var data = extractToolData(result);
-        if (data) safeRender(data);
+        safeRender(data);
         break;
       }
       case "ui/notifications/tool-input":
```

**File**: `docs/mcp-apps.mdx` (modified, +3/-1)
```diff
@@ -37,7 +37,7 @@ Three discovery signals must stay aligned:
 |---|---|---|---|
 | `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | Country Risk (interactive) | Composite Instability Index score, component breakdown, travel advisory, and sanctions exposure. |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | World Brief (interactive) | Precomputed citation-grounded global brief, grounding headlines, and source feed articles. |
-| `ui://worldmonitor/country-brief.html` | `get_country_brief` | Country Brief (interactive) | Per-country intelligence brief, analytical framework lens, and grounding sources. |
+| `ui://worldmonitor/country-brief-v2.html` | `get_country_brief` | Country Brief (interactive) | Per-country intelligence brief, analytical framework lens, and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Market Radar (interactive) | Fear & Greed plus all loaded quote rows, asset names and expandable intraday charts from the same snapshot. |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | Chokepoint Monitor (interactive) | Per-chokepoint transit summaries, week-over-week change, tanker split, and risk-level badge. |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | News Intelligence (interactive) | AI-classified top stories with category, alert flag, country, source provenance, snapshot status and explicit loaded/sample counts. |
@@ -48,6 +48,8 @@ Three discovery signals must stay aligned:
 | `ui://worldmonitor/news-dashboard-v3.html` | `open_news_dashboard` | WorldMonitor news and maps | Dashboard news panels, current event markers, filters and country selection. |
 | `ui://worldmonitor/country-view-v3.html` | `open_country_brief` | WorldMonitor country view | Shared country sections, topics, evidence and exports with host-authorized reads. |
 
+The compact Country Brief view accepts the original response and supported object projections. Replacing a result clears prior paragraphs, evidence, source links and generation time. Hosts advertise `country-brief-v2.html`; the original `country-brief.html` remains a private read alias for older installed metadata until those hosts refresh their resource discovery. Ordinary country asks still open the full country view.
+
 Country Risk v2 preserves supplied original and projected objects, including nested CII components and upstream availability. Missing or malformed advisory values remain unknown; an explicit empty native string still means no advisory. Result replacement clears prior risk details. The original `ui://worldmonitor/country-risk.html` remains a private read alias for installed metadata and can be removed when that metadata is retired.
 
 The original `ui://worldmonitor/prediction-markets.html` and previous `ui://worldmonitor/prediction-markets-v2.html` remain private read aliases. Refresh installed connection metadata and open a new card to load v3. An existing cached card keeps its old HTML. Projections that omit the contract data cannot restore omitted details. Empty returned categories do not prove complete coverage of upstream venues.
```

**File**: `docs/mcp-overview.mdx` (modified, +3/-1)
```diff
@@ -511,7 +511,7 @@ The server supports [MCP Apps](https://modelcontextprotocol.io/extensions/apps/b
 |-----------------|-------------|---------|
 | `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | CII score, unrest/conflict/security/news component breakdown, travel-advisory level, and OFAC sanctions exposure. |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | The precomputed, citation-grounded global intelligence brief as readable paragraphs, plus grounding headlines and source articles. |
-| `ui://worldmonitor/country-brief.html` | `get_country_brief` | The AI-synthesised per-country brief as paragraphs, with the analytical framework lens and grounding sources. |
+| `ui://worldmonitor/country-brief-v2.html` | `get_country_brief` | The AI-synthesised per-country brief as paragraphs, with the analytical framework lens and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed plus all loaded equity, commodity, crypto, Gulf and sector quotes, asset names and expandable intraday charts. |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | Per-chokepoint rolling transit summaries (today's count, week-over-week change, tanker split) with a risk-level badge. |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | AI-classified top stories with category, alert flag, country, and source. |
@@ -528,6 +528,8 @@ All UI resources share `mimeType: text/html;profile=mcp-app`.
 
 `resources/read` on a `ui://` URI returns an HTML view. Unlike the data resources, a `ui://` read is **public and quota-exempt** — the template carries no data and spends no upstream data call, so a host can preload it (and an agent-readiness scanner can fetch it) without credentials and without touching the Pro daily cap. Statically bundled widgets are self-contained. The news, country and market views load their current JavaScript and CSS from `https://www.worldmonitor.app`, as permitted by their resource metadata. All views communicate with the host over the standard MCP Apps `postMessage` bridge (`ui/initialize` → `ui/notifications/tool-result` → `ui/notifications/size-changed`).
 
+The compact Country Brief view accepts the original response and supported object projections. Replacing a result clears prior paragraphs, evidence, source links and generation time. Hosts advertise `country-brief-v2.html`; the original `country-brief.html` remains a private read alias for older installed metadata until those hosts refresh their resource discovery. Ordinary country asks still open the full country view.
+
 For the full MCP Apps contract — host flow, security posture, per-widget inventory, source files, and docs-stat drift checks — see [MCP Apps](/mcp-apps).
 
 ## JSON-RPC example
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +3/-1)
```diff
@@ -37,7 +37,7 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 |---|---|---|---|
 | `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | 国家风险（交互式） | 综合不稳定指数评分、组成部分细分、旅行建议和制裁风险敞口。 |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | 世界简报（交互式） | AI 摘要的全球简报、支撑性头条新闻和信息源文章。 |
-| `ui://worldmonitor/country-brief.html` | `get_country_brief` | 国家简报（交互式） | 按国家划分的情报简报、分析框架视角和支撑来源。 |
+| `ui://worldmonitor/country-brief-v2.html` | `get_country_brief` | 国家简报（交互式） | 按国家划分的情报简报、分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | 市场雷达（交互式） | 恐惧贪婪综合指数，以及股票、大宗商品、加密货币、海湾地区和行业报价表，附带带符号、颜色编码的涨跌。 |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | 咽喉要道监视器（交互式） | 按咽喉要道划分的通行摘要、周环比变化、油轮构成和风险等级徽章。 |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | 新闻情报（交互式） | AI 分类的头条报道，附带类别、警报标记、国家、来源背景、快照状态，以及明确的已加载或样本数量。 |
@@ -46,6 +46,8 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 | `ui://worldmonitor/prediction-markets-v3.html` | `get_prediction_markets` | 预测市场（交互式） | 按类别（地缘政治、科技、金融）分组的事件合约赔率，每个市场附带一个概率条。完整响应投影和摘要样本保留已加载的合约及快照信息。缺失或无效的类别会明确标记为不可用或未包含；未知的新鲜度也会明确显示。 |
 | `ui://worldmonitor/forecasts-v3.html` | `get_forecast_predictions` | 预测（交互式） | 以概率卡片形式呈现的 AI 生成的地缘政治和经济预测（标题、领域、地区）。 |
 
+精简国家简报视图支持原始响应和受支持的对象投影。替换结果会清除之前的段落、证据、来源链接和生成时间。宿主声明 `country-brief-v2.html`；原始 `country-brief.html` 作为旧版已安装元数据的私有读取别名保留，直到这些宿主刷新资源发现。普通国家请求仍打开完整国家视图。
+
 原始的 `ui://worldmonitor/prediction-markets.html` 和之前的 `ui://worldmonitor/prediction-markets-v2.html` 仍作为未列出的读取别名。刷新已安装连接的元数据并打开新卡片后才能加载 v3。已有的缓存卡片仍使用旧 HTML。省略合约数据的投影无法恢复被省略的详情。返回的空类别不能证明上游交易平台的完整覆盖。
 
 国家风险 v2 保留原始对象和投影对象中的字段，包括嵌套的 CII 组成部分和上游可用状态。缺失或格式错误的旅行警示值仍为未知；原生响应中的空字符串仍表示无旅行警示。替换结果会清除之前的风险详情。原来的 `ui://worldmonitor/country-risk.html` 保留为已安装元数据的私有读取别名，在旧元数据退役后即可移除。
```

**File**: `docs/zh/mcp-overview.mdx` (modified, +3/-1)
```diff
@@ -485,7 +485,7 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 |-----------------|-------------|---------|
 | `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | CII 评分、动荡/冲突/安全/新闻组成部分分解、旅行警示级别，以及 OFAC 制裁敞口。 |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | 以可读段落呈现的预计算、有引用依据的全球情报简报，外加支撑性头条和来源文章。 |
-| `ui://worldmonitor/country-brief.html` | `get_country_brief` | 以段落呈现的 AI 合成各国简报，附带分析框架视角和支撑来源。 |
+| `ui://worldmonitor/country-brief-v2.html` | `get_country_brief` | 以段落呈现的 AI 合成各国简报，附带分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed 综合指标，外加各资产类别的报价表（股票、大宗商品、加密货币、海湾、板块），带有带符号、色彩编码的涨跌。 |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | 各咽喉要道的滚动过境摘要（今日计数、周环比变化、油轮占比），并带有风险级别标记。 |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | AI 分类的热门报道，带有类别、警报标记、国家和来源。 |
@@ -500,6 +500,8 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 
 对 `ui://` URI 的 `resources/read` 返回 HTML 视图。与数据资源不同，`ui://` 读取是**公开且豁免配额的** —— 该模板不承载数据，也不产生上游数据调用，因此宿主可以在无凭据、不触及 Pro 每日上限的情况下预加载它（agent 就绪性扫描器也可以获取它）。静态打包的组件是自包含的。新闻、国家和市场视图会根据资源元数据许可，从 `https://www.worldmonitor.app` 加载当前 JavaScript 和 CSS。所有视图都通过标准的 MCP Apps `postMessage` 桥（`ui/initialize` → `ui/notifications/tool-result` → `ui/notifications/size-changed`）与宿主通信。
 
+精简国家简报视图支持原始响应和受支持的对象投影。替换结果会清除之前的段落、证据、来源链接和生成时间。宿主声明 `country-brief-v2.html`；原始 `country-brief.html` 作为旧版已安装元数据的私有读取别名保留，直到这些宿主刷新资源发现。普通国家请求仍打开完整国家视图。
+
 有关完整的 MCP Apps 契约 —— 宿主流程、安全态势、各小部件清单、源文件以及 docs-stat 漂移检查 —— 请参阅 [MCP Apps](/zh/mcp-apps)。
 
 ## JSON-RPC 示例
```

---

### Incident Patch 5: `72901375` (2026-10-05)
**Commit Message**: fix(mcp): reuse one allocation for direct country requests (#8853)

* test(mcp): cover curated market panel admission

* feat(mcp): admit curated market panels once per opening

* test(mcp): cover uppercase panel refresh UUIDs

* fix(mcp): canonicalize panel refresh UUID case

* docs(mcp): describe curated market panel accounting

* test(mcp): reproduce missing market receipt usage metadata

* fix(mcp): preserve current usage on authorized market receipt results

* test(mcp): keep ordinary quota probes on a non-panel tool

* test(mcp): preserve ordinary quota lifecycle coverage

* test: reproduce prediction panel accounting and receipt failures

* fix: share paid prediction panel allocation across filters and reads

* test: reproduce unavailable prediction replay and pin bounded output

* fix: keep unavailable prediction snapshots retryable

* test: reject unknown prediction replay envelopes

* fix: preserve unknown prediction envelopes as retryable

* docs(mcp): describe prediction panel reuse and refresh

* docs(mcp): align prediction parameter table with schema

* test(mcp): reproduce selected prediction cache masking source health

* fix(mcp): retain prediction source health be

**File**: `api/mcp/_country-direct-snapshot.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import { z } from 'zod';
+
+const clockSchema = z.union([z.number().finite().nonnegative(), z.string().min(1)]);
+const provenanceSchema = z.object({
+    risk: z.string(), type: z.string(), riskDeclared: z.boolean(), typeDeclared: z.boolean(),
+    riskReviewed: z.boolean(), typeReviewed: z.boolean(), knownBiases: z.array(z.string()),
+    stateAffiliated: z.string().optional(), note: z.string().optional(),
+}).passthrough();
+const sourceSchema = z.object({
+  title: z.string(), source: z.string(), url: z.string(), publishedAt: z.string().optional(),
+  sourceProvenance: provenanceSchema.optional(),
+}).passthrough();
+const evidenceSchema = z.object({
+  id: z.string(), kind: z.string(), label: z.string(), value: z.string(),
+  factText: z.string(), asOf: z.string(), url: z.string(),
+}).passthrough();
+const groundingSchema = z.object({
+  title: z.string(), source: z.string(), url: z.string().optional(), publishedAt: z.string().optional(),
+  corroborationCount: z.number().finite(), mentionCount: z.number().finite().optional(), storyPhase: z.string().optional(),
+  corroboration: z.object({ state: z.enum(['unknown', 'single-publisher', 'tier4-only', 'corroborated']), publishers: z.number().finite().nullable() }).passthrough(),
+  sourceProvenance: provenanceSchema.optional(),
+  publishers: z.array(z.object({
+    name: z.string(), tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(), labels: z.array(z.string()), labelsUnlisted: z.number().finite(),
+  }).passthrough()).optional(), publishersUnlisted: z.number().finite().optional(),
+}).passthrough();
+const briefSchema = z.object({
+  countryCode: z.string(), countryName: z.string(), brief: z.string().trim().min(1), model: z.string(), generatedAt: clockSchema,
+  sources: z.array(sourceSchema), evidence: z.array(evidenceSchema).optional(), groundingStories: z.array(groundingSchema),
+  digestCoverage: z.object({ state: z.literal('complete'), servedStale: z.literal(false), staleReason: z.string().optional(), staleAgeSeconds: z.number().finite().optional(), attemptedAt: z.string().optional() }).passthrough(),
+}).passthrough();
+const ciiSchema = z.object({
+  region: z.string(), combinedScore: z.number().finite(), staticBaseline: z.number().finite(), dynamicScore: z.number().finite(), trend: z.string(),
+  components: z.object({ ciiContribution: z.number().finite(), geoConvergence: z.number().finite(), militaryActivity: z.number().finite(), newsActivity: z.number().finite() }).passthrough(),
+  computedAt: z.number().finite().nonnegative(), methodologyVersion: z.string().optional(), eventMultiplier: z.number().finite().optional(), advisoryLevel: z.string().optional(), advisoryProvenance: z.string().optional(),
+}).passthrough();
+const riskSchema = z.object({
+  countryCode: z.string(), countryName: z.string(), advisoryLevel: z.string(), sanctionsActive: z.boolean(), sanctionsCount: z.number().finite(),
+  fetchedAt: z.number().finite().nonnegative(), upstreamUnavailable: z.literal(false), cii: ciiSchema.nullable().optional(),
+}).passthrough();
+
+export function isCountryDirectOriginalReusable(name: 'get_country_brief' | 'get_country_risk', value: unknown, country: string, now: number): boolean {
+  if (value && typeof value === 'object' && ('panelRequest' in value || 'usage' in value)) return false;
+  if (name === 'get_country_brief') {
+    const parsed = briefSchema.safeParse(value);
+    if (!parsed.success) return false;
+    const original = parsed.data;
+    const generated = typeof original.generatedAt === 'number' ? original.generatedAt : Date.parse(original.generatedAt);
+    return original.countryCode === country && Number.isFinite(generated) && generated >= 0 && generated <= now
+      && !original.digestCoverage.staleReason
+      && !['stale', 'degraded', 'upstreamUnavailable', 'unavailable', 'partial', 'rateLimited'].some(flag => original[flag] === true)
+      && !original.error && !['error', 'partial', 'stale', 'unavailable'].some(status => original.status === status);
+  }
+  const parsed = riskSchema.safeParse(value);
+  return parsed.success && parsed.data.countryCode === country
+    && (!parsed.data.cii || parsed.data.cii.region === country);
+}
```

**File**: `api/mcp/dispatch.ts` (modified, +22/-3)
```diff
@@ -1,3 +1,4 @@
+import { countryBriefDirectViewSchema, countryRiskDirectViewSchema, normalizeCountryDirectRead } from '../../shared/country-brief-host';
 import { buildAttributionRider, mergeAttributionRider } from '../../shared/attribution-rider';
 import { readExistsFlags, readJsonFromUpstash, readRawJsonFromUpstash, redisPipeline } from '../_upstash-json.js';
 // @ts-expect-error — Edge-safe JS envelope mirror.
@@ -483,6 +484,24 @@ export async function dispatchToolsCall(
   const callArguments = Object.fromEntries(Object.entries(p.arguments ?? {}).filter(([key]) => key !== 'panel_request'));
   let sourceArguments = callArguments;
   try {
+    if (tool.name === 'get_country_brief' || tool.name === 'get_country_risk') {
+      if (!dedicatedPanel && ('refresh' in callArguments || 'request_id' in callArguments)) throw new PanelRequestError('Country refresh controls require a paid panel allowance.', 'invalid');
+      if (dedicatedPanel) {
+        const { summary: _summary, jmespath: _projection, ...view } = callArguments;
+        const parsed = (tool.name === 'get_country_brief' ? countryBriefDirectViewSchema : countryRiskDirectViewSchema).safeParse(view);
+        if (!parsed.success) throw new PanelRequestError('Supply valid country arguments and a request_id for refresh.', 'invalid');
+        const { refresh, request_id, ...filters } = parsed.data;
+        const normalized = normalizeCountryDirectRead(tool.name, filters);
+        if (!normalized) throw new PanelRequestError('Supply a recognized country and analysis.', 'invalid');
+        sourceArguments = normalized;
+        if (suppliedPanel !== undefined && refresh) throw new PanelRequestError('Refresh the country without a reader token.', 'invalid');
+        if (suppliedPanel === undefined) {
+          panelRequest = await admitCountryPanel(context, budget, deps.redisPipeline, { country_code: normalized.country_code, refresh, ...(request_id ? { request_id } : {}) });
+          panelUsage = panelRequest.usage;
+          panelRead = await authorizePanelRead(context, deps.redisPipeline, tool.name, normalized, panelRequest.token);
+        }
+      }
+    }
     if (tool.name === 'get_world_brief') {
       if (!dedicatedPanel && ('refresh' in callArguments || 'request_id' in callArguments)) throw new PanelRequestError('World Brief refresh controls require a paid panel allowance.', 'invalid');
       if (dedicatedPanel) {
@@ -618,7 +637,7 @@ export async function dispatchToolsCall(
       if (limited) return limited;
     }
     await panelRead?.reserveUncachedRead();
-    if ((tool.name === 'get_world_brief' || tool.name === 'get_market_data' || tool.name === 'get_prediction_markets' || tool.name === 'get_conflict_events' || tool.name === 'get_natural_disasters' || tool.name === 'get_news_intelligence' || tool.name === 'get_chokepoint_status') && suppliedPanel !== undefined && panelRead
+    if ((tool.name === 'get_country_brief' || tool.name === 'get_country_risk' || tool.name === 'get_world_brief' || tool.name === 'get_market_data' || tool.name === 'get_prediction_markets' || tool.name === 'get_conflict_events' || tool.name === 'get_natural_disasters' || tool.name === 'get_news_intelligence' || tool.name === 'get_chokepoint_status') && suppliedPanel !== undefined && panelRead
       && (context.kind === 'pro' || context.kind === 'user_key')) {
       const allowance = await readDailyAllowance(context.userId, deps.redisPipeline, budget);
       if (allowance && allowance.used > 0) panelUsage = { ...allowance, unit: 'requests' };
@@ -741,7 +760,7 @@ export async function dispatchToolsCall(
       execution.panelRequest = panelRequest;
       if (panelRead?.panel === 'forecasts') execution.panelScope = 'forecasts';
       if (tool._execute) result = await tool._execute(
-        callArguments,
+        dedicatedPanel && (tool.name === 'get_country_brief' || tool.name === 'get_country_risk') ? sourceArguments : callArguments,
         execution.downstreamOrigin,
         context,
         execution,
@@ -770,7 +789,7 @@ export async function dispatchToolsCall(
       const data = (result as { data: Record<string, unknown> }).data;
       result = { ...result, data: tool._summarize ? tool._summarize(data) : summarizeData(data) };
     }
-    if (tool.name === 'get_world_brief' && panelRequest && result && typeof result === 'object') result = { ...result, panelRequest };
+    if ((tool.name === 'get_world_brief' || tool.name === 'get_country_brief' || tool.name === 'get_country_risk') && panelRequest && result && typeof result === 'object') result = { ...result, panelRequest };
     if (tool.name === 'get_forecast_predictions' && panelRequest && result && typeof result === 'object') result = { ...result, panelRequest };
     if (tool.name === 'open_news_dashboard' && panelRequest && result && typeof result === 'object') {
       const parsed = parseNewsDashboardRequest(callArguments);
```

**File**: `api/mcp/panel-requests.ts` (modified, +15/-6)
```diff
@@ -1,6 +1,7 @@
+import { isCountryDirectOriginalReusable } from './_country-direct-snapshot';
 import { countryActivityQueries } from '../../shared/country-activity-query';
 import { z } from 'zod';
-import { countryReaderSchema, COUNTRY_READERS, countryViewSchema, type PanelAdmission } from '../../shared/country-brief-host';
+import { countryReaderSchema, COUNTRY_READERS, countryViewSchema, normalizeCountryDirectRead, type PanelAdmission } from '../../shared/country-brief-host';
 import { resolveCountryCode } from '../../shared/country-code-resolve';
 import { chokepointPanelReadSchema, chokepointPanelViewSchema, conflictPanelReadSchema, conflictPanelViewSchema, disasterPanelReadSchema, disasterPanelViewSchema, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelReadSchema, newsIntelligencePanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, worldBriefPanelReadSchema, worldBriefPanelViewSchema, type ChokepointPanelAdmission, type ConflictPanelAdmission, type DisasterPanelAdmission, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsIntelligencePanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission, type WorldBriefPanelAdmission } from '../../shared/panel-admission';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
@@ -191,9 +192,14 @@ function checkReadScope(name: string, args: Record<string, unknown>, country: st
     if (name !== 'get_natural_disasters' || !snapshot.safeParse(args).success) throw new PanelRequestError('Panel request only covers dashboard news and bounded map snapshots.', 'invalid');
     return;
   }
-  if (name === 'get_country_brief' || name === 'get_country_coverage') {
+  if (name === 'get_country_brief' || name === 'get_country_risk') {
+    const normalized = normalizeCountryDirectRead(name, args);
+    if (!normalized || normalized.country_code !== country) throw new PanelRequestError('Panel request does not cover this country or analysis.', 'invalid');
+    return;
+  }
+  if (name === 'get_country_coverage') {
     const allowed = z.object({ country_code: z.string() }).strict().safeParse(args);
-    if (!allowed.success || resolveCountryCode(allowed.data.country_code) !== country) throw new PanelRequestError('Panel request does not cover this country or analysis.', 'invalid');
+    if (!allowed.success || resolveCountryCode(allowed.data.country_code) !== country) throw new PanelRequestError('Panel request does not cover this country.', 'invalid');
     return;
   }
   if (name !== 'get_country_brief_section') throw new PanelRequestError('Panel request does not cover this tool.', 'invalid');
@@ -249,7 +255,7 @@ export async function authorizePanelRead(context: McpAuthContext, pipeline: Pipe
           ? disasterPanelReadSchema.parse(args)
           : scope.panel === 'forecasts' && name === 'get_forecast_predictions'
             ? forecastPanelReadSchema.parse(args)
-            : args;
+            : (name === 'get_country_brief' || name === 'get_country_risk') ? normalizeCountryDirectRead(name, args)! : args;
   const digest = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([name, canonicalArguments(cacheArguments)])));
   const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
   const cacheKey = `${key}:data:${hash}`;
@@ -261,8 +267,10 @@ export async function authorizePanelRead(context: McpAuthContext, pipeline: Pipe
     const raw = results[1]?.result;
     if (typeof raw === 'string' && encoder.encode(raw).length <= cacheBudget) {
       let parsed: unknown;
-      try { parsed = JSON.parse(raw); } catch (error) { if (name !== 'get_natural_disasters' && name !== 'get_news_intelligence' && name !== 'get_chokepoint_status' && name !== 'get_world_brief') throw error; }
-      if (name === 'get_world_brief') {
+      try { parsed = JSON.parse(raw); } catch (error) { if (name !== 'get_natural_disasters' && name !== 'get_news_intelligence' && name !== 'get_chokepoint_status' && name !== 'get_world_brief' && name !== 'get_country_brief' && name !== 'get_country_risk') throw error; }
+      if (name === 'get_country_brief' || name === 'get_country_risk') {
+        if (isCountryDirectOriginalReusable(name, parsed, scope.panel, Date.now())) cached = parsed;
+      } else if (name === 'get_world_brief') {
         cached = readWorldBriefCache(parsed, Date.now(), scope.expires);
       } else if (name === 'get_chokepoint_status') {
         if (validChokepointCache(parsed, args, Date.now(), scope.expires)) cached = parsed.value;
@@ -328,6 +336,7 @@ export async function authorizePanelRead(context: McpAuthContext, pipeline: Pipe
     },
     save: async (value: unknown) => {
       if (name === 'get_world_brief' || name === 'get_natural_disasters' || name === 'get_news_intelligence' || name === 'get_chokepoint_status') return;
+      if ((name === 'get_co
```

**File**: `api/mcp/registry/rpc-tools.ts` (modified, +7/-2)
```diff
@@ -1510,11 +1510,13 @@ export const RPC_TOOLS: ToolDef[] = [
     // Two downstream fetches (brief + news digest for grounding).
     _weight: 3,
     _outputBudgetBytes: 65536,
-    description: 'Text-only AI assessment, one section of the country brief. Use open_country_brief for ordinary country brief requests, the embedded country interface and topic navigation. Produces an LLM-analyzed geopolitical and economic assessment for the given country. Supports analytical frameworks for structured lenses. Returns groundingStories alongside sources: the digest articles used to ground the brief, each with corroborationCount, corroboration, mentionCount, and lifecycle storyPhase, so an agent can weigh how well-corroborated the underlying reporting is; corroboration.state (single-publisher, tier4-only, corroborated, unknown) describes coverage, not accuracy. When the news digest is serving retained (stale) content, that grounding is DROPPED and the brief is generated without it; pass allow_stale=true to ground on the retained snapshot instead. Either way the digestCoverage block reports what the grounding was.',
+    description: 'Text-only AI assessment, one section of the country brief. Use open_country_brief for ordinary country brief requests, the embedded country interface and topic navigation. Produces an LLM-analyzed geopolitical and economic assessment for the given country. Supports analytical frameworks for structured lenses. Returns groundingStories alongside sources: the digest articles used to ground the brief, each with corroborationCount, corroboration, mentionCount, and lifecycle storyPhase, so an agent can weigh how well-corroborated the underlying reporting is; corroboration.state (single-publisher, tier4-only, corroborated, unknown) describes coverage, not accuracy. When the news digest is serving retained (stale) content, that grounding is DROPPED and the brief is generated without it; pass allow_stale=true to ground on the retained snapshot instead. Either way the digestCoverage block reports what the grounding was. A paid opening shares the existing country allocation with brief, risk and full-panel reads. Healthy originals replay before presentation; incomplete or retained sources remain retryable under the same allocation.',
     inputSchema: {
       type: 'object',
       properties: {
         panel_request: { type: 'string', maxLength: 160, description: 'Server-issued country-panel request token, supplied by the embedded view.' },
+        refresh: { type: 'boolean', description: 'For a paid MCP allowance, start a new country allocation and reread loaded sources. Requires request_id and no panel_request. Does not force AI generation.' },
+        request_id: { type: 'string', format: 'uuid', description: 'Required UUID for an explicit paid refresh. Retrying the same UUID reuses that allocation.' },
         country_code: { type: 'string', description: 'ISO 3166-1 alpha-2 code (e.g. "IQ"), alpha-3 code ("IRQ"), or English country name ("Iraq")' },
         framework: { type: 'string', description: 'Optional analytical framework instructions to shape the analysis lens (e.g. Ray Dalio debt cycle, PMESII-PT)' },
         allow_stale: { type: 'boolean', description: 'Ground the brief on a retained (stale) news digest when the live rebuild has failed. Defaults to false, which drops the stale grounding and returns an ungrounded brief rather than failing; time-sensitive automated decisions should leave this disabled. Retained content is at most six hours old.' },
@@ -1751,10 +1753,13 @@ export const RPC_TOOLS: ToolDef[] = [
   {
     name: 'get_country_risk',
     _outputBudgetBytes: 262144,
-    description: 'Structured risk intelligence for a specific country: the Composite Instability Index at cii.combinedScore (0-100), its four contributing components under cii.components, the government travel-advisory level, and OFAC sanctions exposure as sanctionsActive plus sanctionsCount. Fast Redis read — no LLM. Use for quantitative risk screening or to answer "how risky is X right now?" Check upstreamUnavailable first: when it is true at least one required upstream read failed, the whole response was withheld, and the zeroed fields mean UNKNOWN, not calm.',
+    description: 'Structured risk intelligence for a specific country: the Composite Instability Index at cii.combinedScore (0-100), its four contributing components under cii.components, the government travel-advisory level, and OFAC sanctions exposure as sanctionsActive plus sanctionsCount. Fast Redis read — no LLM. Use for quantitative risk screening or to answer "how risky is X right now?" Check upstreamUnavailable first: when it is true at least one required upstream read failed, the whole response was withheld, and the zeroed fields mean UNKNOWN, not calm. A paid opening shares the existing country allocation with brief and full-panel reads. Healthy route-specific loaded originals replay before presentation; upstream failures remain retry
```

**File**: `docs/mcp-apps.mdx` (modified, +8/-0)
```diff
@@ -175,3 +175,11 @@ On Pro and Pro Business, `get_world_brief` opens one signed `world-brief` alloca
 Use `panelRequest.token` as `panel_request` only for this tool. Explicit `refresh: true` requires a UUID `request_id` and no reader token; the same UUID retries that allocation. Authorized receipt reads query current usage without reserving another allocation. Unknown usage omits the numeric notice. API allowances retain per-tool billing, and free accounts retain the existing subscription denial.
 
 Valid content aged 60 minutes to less than three hours remains available with `stale: true` but is not retained for fresh replay. Failed, missing, malformed and expired originals can retry under the same allocation. The 64-read bound counts uncached tool executions. Acquisition uses the existing authenticated bootstrap gateway path; it adds no provider call or producer-health transport. The private wrapped cache remains 512 KiB and tool output remains 64 KiB.
+
+### Direct country brief and risk reads
+
+On Pro and Pro Business, `get_country_brief` and `get_country_risk` share the same country allocation as `open_country_brief`. Country aliases resolve to one ISO2 identity. Repeated reads and analytical framework variants share that allocation. Accepted originals replay separately for each tool and effective analysis before JMESPath presentation. A first bare risk read is not a replay of the full panel's differently shaped risk section.
+
+Use the returned `panelRequest.token` as `panel_request` for authorized reads of that country. Explicit `refresh: true` requires a UUID `request_id` and no reader token. It starts one new country allocation; the same UUID retries that allocation. Refresh rereads the sources but does not force AI generation or bypass the backend's six-hour brief cache. API and free-account calls retain their ordinary behavior and reject these paid refresh controls.
+
+The brief preserves the effective first 2,000 framework characters and exact `allow_stale: true` opt-in. Incomplete, retained or malformed grounding remains retryable under the same allocation. Risk reuse preserves genuine untracked and unknown values. The CII timestamp does not attest current advisory or sanctions freshness. The 64-read bound counts uncached tool executions, including each distinct analysis. Authorized receipt reads query the current daily counter without another allocation; unknown usage omits the numeric notice.
```

**File**: `docs/mcp-overview.mdx` (modified, +2/-2)
```diff
@@ -271,7 +271,7 @@ For per-tool parameters, freshness budgets, timeouts, and concrete `curl` exampl
 | Tool | Description |
 |------|-------------|
 | `get_conflict_events` | Active UCDP/Iran conflicts, unrest w/ geo-coords, country risk scores. |
-| `get_country_risk` | CII score 0-100, component breakdown, travel advisory, OFAC exposure per country. Fast, no LLM. |
+| `get_country_risk` | CII score 0-100, component breakdown, travel advisory and OFAC exposure. Paid reads share the country's panel allocation and replay accepted originals. No LLM. |
 | `get_military_posture` | Theater posture + military risk scores. |
 | `get_cyber_threats` | URLhaus/Feodotracker malware IOCs, CISA KEV catalog, active C2 infra. |
 | `get_sanctions_data` | OFAC SDN entities + sanctions pressure scores by country. |
@@ -352,7 +352,7 @@ Every record's `title`, `summary` and `sourceUrl` are verbatim third-party feed
 | Tool | Description | Cost |
 |------|-------------|------|
 | `get_world_brief` | Precomputed citation-grounded world intel brief from the same `news:insights:v1` snapshot used by the dashboard. `geo_context` is retained for compatibility and does not refocus the seeded snapshot. | Cache |
-| `get_country_brief` | Per-country geopolitical + economic assessment with structured source links. Supports analytical frameworks. | LLM |
+| `get_country_brief` | Per-country assessment with source links and analytical frameworks. Paid variants share the country's panel allocation; incomplete grounding remains retryable. | LLM |
 | `analyze_situation` | Ad-hoc geopolitical deduction from a query + context. Returns confidence + supporting signals. | LLM |
 | `generate_forecasts` | Fresh probability estimates (bypasses cache). | LLM |
 | `get_forecast_predictions` | Cached forecasts; paid interactive openings return a compact list and signed case admission. | Cache |
```

**File**: `docs/mcp-tools-reference.mdx` (modified, +11/-4)
```diff
@@ -1143,11 +1143,14 @@ Structured risk intelligence for a specific country: the Composite Instability I
 
 | Name | Type | Required | Description |
 |------|------|---------:|-------------|
-| `country_code` | string | **yes** | ISO 3166-1 alpha-2 country code, e.g. "RU", "IR", "CN", "UA" |
+| `country_code` | string | **yes** | ISO2, ISO3 or English country name, e.g. "RU", "RUS", "Russia" |
+| `panel_request` | string | no | Server-issued same-country receipt for authorized paid reads |
+| `refresh` | boolean | no | Paid-only new country allocation; requires a UUID and no receipt |
+| `request_id` | string (UUID) | no | Required for refresh; the same UUID retries that allocation |
 
 - **API endpoints:** `GET /api/intelligence/v1/get-country-risk`
 - **Access:** `subscription` — requires a Pro subscription. RPC tool: no `summary` argument (use `jmespath` to trim the response).
-- **Kind:** live RPC — proxies a fetch to the WorldMonitor API on each call. Edge-runtime timeout: **8.0s**.
+- **Kind:** live RPC on an uncached execution. Accepted paid originals replay within the same-country admission. Edge-runtime timeout: **8.0s**. CII time does not prove advisory or sanctions freshness.
 
 <CodeGroup>
 
@@ -1300,11 +1303,15 @@ AI-generated per-country intelligence brief. Produces an LLM-analyzed geopolitic
 | Name | Type | Required | Description |
 |------|------|---------:|-------------|
 | `country_code` | string | **yes** | ISO 3166-1 alpha-2 country code, e.g. "US", "DE", "CN", "IR" |
-| `framework` | string | no | Optional analytical framework instructions to shape the analysis lens (e.g. Ray Dalio debt cycle, PMESII-PT) |
+| `framework` | string | no | Optional analysis lens; the first 2,000 characters are effective, without trimming |
+| `allow_stale` | boolean | no | Exact true opts into retained grounding; default false drops it |
+| `panel_request` | string | no | Server-issued same-country receipt for authorized paid reads |
+| `refresh` | boolean | no | Paid-only new country allocation; requires a UUID and no receipt; does not force AI generation |
+| `request_id` | string (UUID) | no | Required for refresh; the same UUID retries that allocation |
 
 - **API endpoints:** `GET /api/intelligence/v1/get-country-intel-brief`
 - **Access:** `subscription` — requires a Pro subscription. RPC tool: no `summary` argument (use `jmespath` to trim the response).
-- **Kind:** live RPC — proxies a fetch to the WorldMonitor API on each call. Worst-case total budget **~24s** (2s context-digest fetch + 22s brief generation, sequential).
+- **Kind:** live RPC on an uncached execution. Accepted paid originals replay per country and effective analysis within the shared country admission. Incomplete or retained grounding remains retryable. Worst-case total budget **~24s** (2s context-digest fetch + 22s brief generation, sequential). Explicit refresh does not bypass the backend's six-hour brief cache. API weights and free-account denial remain unchanged.
 - **Sources:** returns a bounded `sources` array with original article links from the digest items used to ground the country context. URLs are copied from feed data, not generated by the LLM.
 - **Corroboration:** returns a separate `groundingStories` array for the digest articles used as grounding, each with `corroborationCount` (distinct outlets carrying the story at digest time), `mentionCount`, and lifecycle `storyPhase`. It is independent of `sources`, which may instead carry the server-side grounding set, and is empty when the digest read failed. Cite from `sources`; use `groundingStories` to weigh how well-reported the underlying claims are.
 
```

**File**: `docs/usage-rate-limits.mdx` (modified, +3/-1)
```diff
@@ -82,7 +82,9 @@ For `get_market_data` and `get_prediction_markets`, `refresh: true` with a new U
 
 Prediction filters reuse the prediction admission across category, source, query, and limit changes. Identical canonical filters replay successful original results. Each new uncached filter executes the fixed bootstrap and freshness reads. The 64-execution bound counts tool executions, not Redis commands. Paid prediction calls validate filters before reservation. API and free calls retain existing filter coercion and reject paid refresh controls. Fresh valid filtered-empty results can replay. Stale, malformed, unavailable, and unknown observations remain retryable without refunding the opening. An authorized explicit prediction receipt read also queries the current daily counter without a new allocation. An unavailable or unconfirmed counter omits the numeric notice while preserving loaded contracts.
 
-**Refresh country**, **Refresh news** and **Refresh map data** each start one new request and reload that view’s observations. News refresh includes selected hazard layers. Layer toggles, country topic tabs and local news filters reuse loaded data. **New AI assessment** starts a new request for the assessment. Requested news summaries and translations are separate AI requests, each costing one unit. Other standalone data tools still cost one unit each. Custom text-assessment frameworks use standalone billing.
+**Refresh country**, **Refresh news** and **Refresh map data** each start one new request and reload that view’s observations. News refresh includes selected hazard layers. Layer toggles, country topic tabs and local news filters reuse loaded data. **New AI assessment** starts a new request for the assessment. Requested news summaries and translations are separate AI requests, each costing one unit. Other standalone data tools still cost one unit each.
+
+Direct `get_country_brief` and `get_country_risk` calls share the existing same-country allocation, including analytical framework variants. Accepted originals replay per tool and effective analysis. Unknown, incomplete, retained or failed source results remain retryable. `refresh: true` requires a UUID `request_id` and no `panel_request`; a new UUID starts one country allocation and the same UUID retries it. This refresh rereads the sources but does not force brief generation or bypass its six-hour backend cache. The 64-read ceiling and ordinary API weights remain unchanged.
 
 All twelve embedded views show remaining requests and the local reset time from their latest observed paid request. Single-result widgets receive usage metadata with their tool result; composite views receive it with their admission. Settings and the account-allowance resource read the same daily counter. Reuse cannot extend an admission past expiry or bypass a subscription denial. An admitted request remains charged after an upstream failure.
 
```

---

### Incident Patch 6: `39c97cb4` (2026-10-05)
**Commit Message**: fix(plugin): retain projected Country Risk details (#8850)

* test(plugin): reproduce compact Country Risk projection failures

* fix(plugin): preserve projected Country Risk and clear replaced verdicts

* test(plugin): align Country Risk discovery with advertised v2

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Elie Habib <[REDACTED_EMAIL]>

**File**: `api/mcp/constants.ts` (modified, +1/-1)
```diff
@@ -210,7 +210,7 @@ export const SERVER_NAME = 'worldmonitor';
 //     bump records it in the audit trail; rollback is git revert.
 // Bumped 1.10.0 → 1.11.0 (2026-07-04) reflecting:
 //   - MCP Apps support (extension `io.modelcontextprotocol/ui`, spec
-//     2026-01-26). Adds a `ui://worldmonitor/country-risk.html` app-shell
+//     2026-01-26). Adds a country-risk app-shell (current `ui://worldmonitor/country-risk-v2.html`)
 //     resource (mimeType `text/html;profile=mcp-app`, served via
 //     resources/list + resources/read) and links it from the
 //     `get_country_risk` tool via `_meta.ui.resourceUri` (+ the deprecated
```

**File**: `api/mcp/ui/country-risk-app.ts` (modified, +4/-2)
```diff
@@ -178,6 +178,7 @@ export const COUNTRY_RISK_APP_HTML = `<!DOCTYPE html>
   // GetCountryRiskResponse.advisory_level is a plain string ("do-not-travel",
   // "reconsider", "caution", …), empty when no advisory applies.
   function describeAdvisory(level) {
+    if (typeof level !== "string") return "—";
     var text = cleanText(level, 64).replace(/[-_]+/g, " ");
     return text === "" ? "None" : text;
   }
@@ -222,7 +223,8 @@ export const COUNTRY_RISK_APP_HTML = `<!DOCTYPE html>
   ];
 
   function render(data) {
-    if (!data || typeof data !== "object") return;
+    if (data && typeof data === "object" && Object.prototype.hasOwnProperty.call(data, "projection")) data = data.projection;
+    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
     document.getElementById("empty").style.display = "none";
     document.getElementById("card").style.display = "block";
 
@@ -360,7 +362,7 @@ export const COUNTRY_RISK_APP_HTML = `<!DOCTYPE html>
         var result = msg.params && msg.params.result ? msg.params.result : msg.params;
         showPanelUsage(result);
         var data = extractToolData(result);
-        if (data) render(data);
+        render(data);
         break;
       }
       case "ui/notifications/tool-input":
```

**File**: `api/mcp/ui/registry.ts` (modified, +5/-3)
```diff
@@ -39,7 +39,8 @@ export const UI_RESOURCE_MIME_TYPE = SHELL_UI_MIME_TYPE;
 // Canonical ui:// URIs for each app shell. Each is imported by its backing tool
 // def as the single-source-of-truth `_uiResourceUri`, so the tool linkage and
 // the registered resource can never drift.
-export const COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk.html';
+export const COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk-v2.html';
+const LEGACY_COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk.html';
 export const WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief-v2.html';
 const LEGACY_WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief.html';
 export const COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief.html';
@@ -178,7 +179,7 @@ export const UI_RESOURCE_REGISTRY: UiResourceDef[] = [
 const UI_RESOURCE_BY_URI = new Map(UI_RESOURCE_REGISTRY.map((r) => [r.uri, r]));
 
 export function isUiResourceUri(uri: string): boolean {
-  return uri === LEGACY_WORLD_BRIEF_UI_URI || uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
+  return uri === LEGACY_COUNTRY_RISK_UI_URI || uri === LEGACY_WORLD_BRIEF_UI_URI || uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
 }
 
 // resources/list public shape — {uri, name, description, mimeType} plus the
@@ -212,7 +213,8 @@ export async function buildUiResourceRead(
   if (uri === MARKET_RADAR_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI) return readMarketRadar(id, corsHeaders, uri);
   if (uri === COUNTRY_VIEW_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI) return readCountryView(id, corsHeaders, uri);
   if (uri === NEWS_DASHBOARD_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI) return readNewsDashboard(id, corsHeaders, uri);
-  const canonicalUri = uri === LEGACY_WORLD_BRIEF_UI_URI ? WORLD_BRIEF_UI_URI
+  const canonicalUri = uri === LEGACY_COUNTRY_RISK_UI_URI ? COUNTRY_RISK_UI_URI
+    : uri === LEGACY_WORLD_BRIEF_UI_URI ? WORLD_BRIEF_UI_URI
     : uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI ? CHOKEPOINT_MONITOR_UI_URI
     : uri === LEGACY_NEWS_INTELLIGENCE_UI_URI ? NEWS_INTELLIGENCE_UI_URI
     : uri === LEGACY_CONFLICT_EVENTS_UI_URI ? CONFLICT_EVENTS_UI_URI
```

**File**: `docs/mcp-apps.mdx` (modified, +3/-1)
```diff
@@ -35,7 +35,7 @@ Three discovery signals must stay aligned:
 
 | UI resource URI | Linked tool | App | Renders |
 |---|---|---|---|
-| `ui://worldmonitor/country-risk.html` | `get_country_risk` | Country Risk (interactive) | Composite Instability Index score, component breakdown, travel advisory, and sanctions exposure. |
+| `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | Country Risk (interactive) | Composite Instability Index score, component breakdown, travel advisory, and sanctions exposure. |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | World Brief (interactive) | Precomputed citation-grounded global brief, grounding headlines, and source feed articles. |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | Country Brief (interactive) | Per-country intelligence brief, analytical framework lens, and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Market Radar (interactive) | Fear & Greed plus all loaded quote rows, asset names and expandable intraday charts from the same snapshot. |
@@ -48,6 +48,8 @@ Three discovery signals must stay aligned:
 | `ui://worldmonitor/news-dashboard-v3.html` | `open_news_dashboard` | WorldMonitor news and maps | Dashboard news panels, current event markers, filters and country selection. |
 | `ui://worldmonitor/country-view-v3.html` | `open_country_brief` | WorldMonitor country view | Shared country sections, topics, evidence and exports with host-authorized reads. |
 
+Country Risk v2 preserves supplied original and projected objects, including nested CII components and upstream availability. Missing or malformed advisory values remain unknown; an explicit empty native string still means no advisory. Result replacement clears prior risk details. The original `ui://worldmonitor/country-risk.html` remains a private read alias for installed metadata and can be removed when that metadata is retired.
+
 The original `ui://worldmonitor/prediction-markets.html` and previous `ui://worldmonitor/prediction-markets-v2.html` remain private read aliases. Refresh installed connection metadata and open a new card to load v3. An existing cached card keeps its old HTML. Projections that omit the contract data cannot restore omitted details. Empty returned categories do not prove complete coverage of upstream venues.
 
 ## Runtime Flow
```

**File**: `docs/mcp-overview.mdx` (modified, +3/-1)
```diff
@@ -509,7 +509,7 @@ The server supports [MCP Apps](https://modelcontextprotocol.io/extensions/apps/b
 
 | UI resource URI | Linked tool | Renders |
 |-----------------|-------------|---------|
-| `ui://worldmonitor/country-risk.html` | `get_country_risk` | CII score, unrest/conflict/security/news component breakdown, travel-advisory level, and OFAC sanctions exposure. |
+| `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | CII score, unrest/conflict/security/news component breakdown, travel-advisory level, and OFAC sanctions exposure. |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | The precomputed, citation-grounded global intelligence brief as readable paragraphs, plus grounding headlines and source articles. |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | The AI-synthesised per-country brief as paragraphs, with the analytical framework lens and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed plus all loaded equity, commodity, crypto, Gulf and sector quotes, asset names and expandable intraday charts. |
@@ -522,6 +522,8 @@ The server supports [MCP Apps](https://modelcontextprotocol.io/extensions/apps/b
 | `ui://worldmonitor/news-dashboard-v3.html` | `open_news_dashboard` | Dashboard news panels and interactive map. |
 | `ui://worldmonitor/country-view-v3.html` | `open_country_brief` | Shared country sections, topics, evidence and exports. |
 
+Country Risk v2 preserves supplied original and projected objects, including nested CII components and upstream availability. Missing or malformed advisory values remain unknown; an explicit empty native string still means no advisory. Result replacement clears prior risk details. The original `ui://worldmonitor/country-risk.html` remains a private read alias for installed metadata and can be removed when that metadata is retired.
+
 All UI resources share `mimeType: text/html;profile=mcp-app`.
 
 `resources/read` on a `ui://` URI returns an HTML view. Unlike the data resources, a `ui://` read is **public and quota-exempt** — the template carries no data and spends no upstream data call, so a host can preload it (and an agent-readiness scanner can fetch it) without credentials and without touching the Pro daily cap. Statically bundled widgets are self-contained. The news, country and market views load their current JavaScript and CSS from `https://www.worldmonitor.app`, as permitted by their resource metadata. All views communicate with the host over the standard MCP Apps `postMessage` bridge (`ui/initialize` → `ui/notifications/tool-result` → `ui/notifications/size-changed`).
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +3/-1)
```diff
@@ -35,7 +35,7 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 
 | UI 资源 URI | 关联工具 | 应用 | 渲染内容 |
 |---|---|---|---|
-| `ui://worldmonitor/country-risk.html` | `get_country_risk` | 国家风险（交互式） | 综合不稳定指数评分、组成部分细分、旅行建议和制裁风险敞口。 |
+| `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | 国家风险（交互式） | 综合不稳定指数评分、组成部分细分、旅行建议和制裁风险敞口。 |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | 世界简报（交互式） | AI 摘要的全球简报、支撑性头条新闻和信息源文章。 |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | 国家简报（交互式） | 按国家划分的情报简报、分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | 市场雷达（交互式） | 恐惧贪婪综合指数，以及股票、大宗商品、加密货币、海湾地区和行业报价表，附带带符号、颜色编码的涨跌。 |
@@ -48,6 +48,8 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 
 原始的 `ui://worldmonitor/prediction-markets.html` 和之前的 `ui://worldmonitor/prediction-markets-v2.html` 仍作为未列出的读取别名。刷新已安装连接的元数据并打开新卡片后才能加载 v3。已有的缓存卡片仍使用旧 HTML。省略合约数据的投影无法恢复被省略的详情。返回的空类别不能证明上游交易平台的完整覆盖。
 
+国家风险 v2 保留原始对象和投影对象中的字段，包括嵌套的 CII 组成部分和上游可用状态。缺失或格式错误的旅行警示值仍为未知；原生响应中的空字符串仍表示无旅行警示。替换结果会清除之前的风险详情。原来的 `ui://worldmonitor/country-risk.html` 保留为已安装元数据的私有读取别名，在旧元数据退役后即可移除。
+
 ## 运行时流程
 
 1. 宿主对 `https://worldmonitor.app/mcp` 调用 `initialize`。
```

**File**: `docs/zh/mcp-overview.mdx` (modified, +3/-1)
```diff
@@ -483,7 +483,7 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 
 | UI 资源 URI | 关联工具 | 渲染内容 |
 |-----------------|-------------|---------|
-| `ui://worldmonitor/country-risk.html` | `get_country_risk` | CII 评分、动荡/冲突/安全/新闻组成部分分解、旅行警示级别，以及 OFAC 制裁敞口。 |
+| `ui://worldmonitor/country-risk-v2.html` | `get_country_risk` | CII 评分、动荡/冲突/安全/新闻组成部分分解、旅行警示级别，以及 OFAC 制裁敞口。 |
 | `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | 以可读段落呈现的预计算、有引用依据的全球情报简报，外加支撑性头条和来源文章。 |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | 以段落呈现的 AI 合成各国简报，附带分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed 综合指标，外加各资产类别的报价表（股票、大宗商品、加密货币、海湾、板块），带有带符号、色彩编码的涨跌。 |
@@ -494,6 +494,8 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 | `ui://worldmonitor/prediction-markets-v3.html` | `get_prediction_markets` | 按类别（地缘政治、科技、金融）分组的活跃事件合约赔率，每个市场带有一个概率条。完整响应投影和摘要样本保留已加载的合约及快照信息。缺失或无效的类别会明确标记为不可用或未包含；未知的新鲜度也会明确显示。 |
 | `ui://worldmonitor/forecasts-v3.html` | `get_forecast_predictions` | 已加载的预测卡片支持按领域和区域进行本地筛选；原始案例证据可通过同一签名的面板准入读取。 |
 
+国家风险 v2 保留原始对象和投影对象中的字段，包括嵌套的 CII 组成部分和上游可用状态。缺失或格式错误的旅行警示值仍为未知；原生响应中的空字符串仍表示无旅行警示。替换结果会清除之前的风险详情。原来的 `ui://worldmonitor/country-risk.html` 保留为已安装元数据的私有读取别名，在旧元数据退役后即可移除。
+
 所有 UI 资源共享 `mimeType: text/html;profile=mcp-app`。
 
 对 `ui://` URI 的 `resources/read` 返回 HTML 视图。与数据资源不同，`ui://` 读取是**公开且豁免配额的** —— 该模板不承载数据，也不产生上游数据调用，因此宿主可以在无凭据、不触及 Pro 每日上限的情况下预加载它（agent 就绪性扫描器也可以获取它）。静态打包的组件是自包含的。新闻、国家和市场视图会根据资源元数据许可，从 `https://www.worldmonitor.app` 加载当前 JavaScript 和 CSS。所有视图都通过标准的 MCP Apps `postMessage` 桥（`ui/initialize` → `ui/notifications/tool-result` → `ui/notifications/size-changed`）与宿主通信。
```

**File**: `public/.well-known/mcp/server-card.json` (modified, +2/-2)
```diff
@@ -738,7 +738,7 @@
       "specVersion": "2026-01-26",
       "uiResourceMimeType": "text/html;profile=mcp-app",
       "uiResources": [
-        "ui://worldmonitor/country-risk.html",
+        "ui://worldmonitor/country-risk-v2.html",
         "ui://worldmonitor/world-brief-v2.html",
         "ui://worldmonitor/country-brief.html",
         "ui://worldmonitor/market-radar-v3.html",
@@ -751,7 +751,7 @@
         "ui://worldmonitor/news-dashboard-v3.html",
         "ui://worldmonitor/country-view-v3.html"
       ],
-      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk.html, get_world_brief → world-brief-v2.html, get_country_brief → country-brief.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor-v2.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
+      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk-v2.html, get_world_brief → world-brief-v2.html, get_country_brief → country-brief.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor-v2.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
     }
   },
   "features": {
```

---

### Incident Patch 7: `8415bff1` (2026-10-05)
**Commit Message**: fix(plugin): reuse World Brief panel allocations (#8849)

* test(mcp): cover curated market panel admission

* feat(mcp): admit curated market panels once per opening

* test(mcp): cover uppercase panel refresh UUIDs

* fix(mcp): canonicalize panel refresh UUID case

* docs(mcp): describe curated market panel accounting

* test(mcp): reproduce missing market receipt usage metadata

* fix(mcp): preserve current usage on authorized market receipt results

* test(mcp): keep ordinary quota probes on a non-panel tool

* test(mcp): preserve ordinary quota lifecycle coverage

* test: reproduce prediction panel accounting and receipt failures

* fix: share paid prediction panel allocation across filters and reads

* test: reproduce unavailable prediction replay and pin bounded output

* fix: keep unavailable prediction snapshots retryable

* test: reject unknown prediction replay envelopes

* fix: preserve unknown prediction envelopes as retryable

* docs(mcp): describe prediction panel reuse and refresh

* docs(mcp): align prediction parameter table with schema

* test(mcp): reproduce selected prediction cache masking source health

* fix(mcp): retain prediction source health before filte

**File**: `api/mcp/_world-brief-snapshot.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { z } from 'zod';
+import { INSIGHTS_MAX_AGE_MS } from '../../shared/insights-snapshot.js';
+
+const publisherSchema = z.object({
+  name: z.string(), tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
+  labels: z.array(z.string()).max(4), labelsUnlisted: z.number().finite(),
+}).strict();
+const storySchema = z.object({
+  title: z.string(), sourceCount: z.number().finite().optional(), uniqueSourceCount: z.number().finite().optional(),
+  corroborationSourceCount: z.number().finite().optional(), entityCorroboration: z.boolean().optional(),
+  sourceTier: z.number().finite().optional(), sources: z.array(z.string()).max(12).optional(),
+  corroboration: z.object({ state: z.enum(['unknown', 'single-publisher', 'tier4-only', 'corroborated']), publishers: z.number().finite().nullable() }).strict(),
+  publishers: z.array(publisherSchema).max(8), publishersUnlisted: z.number().finite(),
+}).strict();
+const worldBriefOriginalSchema = z.object({
+  brief: z.string().min(1), summary: z.string(), headlines: z.array(z.string()).min(1).max(12),
+  topStories: z.array(storySchema).min(1).max(12), provider: z.string(), model: z.string(),
+  generatedAt: z.string(), stale: z.boolean(), ageMinutes: z.number().finite(),
+  sources: z.array(z.object({ title: z.string(), source: z.string(), url: z.string(), publishedAt: z.string().optional() }).strict()).min(1).max(12),
+}).strict();
+export type WorldBriefOriginal = z.infer<typeof worldBriefOriginalSchema>;
+type WorldBriefCache = { value: WorldBriefOriginal; reuseUntil: number };
+
+export function worldBriefReuseUntil(value: unknown, now: number): number | null {
+  if (!worldBriefOriginalSchema.safeParse(value).success) return null;
+  const original = value as WorldBriefOriginal;
+  const generatedAt = Date.parse(original.generatedAt);
+  if (!Number.isFinite(generatedAt) || generatedAt > now || now >= generatedAt + INSIGHTS_MAX_AGE_MS
+    || original.stale || original.summary !== original.brief
+    || original.topStories.length !== original.headlines.length
+    || original.topStories.some((story, i) => story.title !== original.headlines[i])
+    || !original.sources.some(source => source.url !== '')) return null;
+  return generatedAt + INSIGHTS_MAX_AGE_MS;
+}
+
+export function readWorldBriefCache(value: unknown, now: number, expires: number): WorldBriefOriginal | undefined {
+  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2
+    || !('value' in value) || !('reuseUntil' in value)) return undefined;
+  const wrapper = value as WorldBriefCache;
+  const deadline = worldBriefReuseUntil(wrapper.value, now);
+  if (deadline === null || !Number.isFinite(wrapper.reuseUntil) || wrapper.reuseUntil <= now
+    || wrapper.reuseUntil > deadline || wrapper.reuseUntil > expires) return undefined;
+  return { ...wrapper.value, ageMinutes: Math.max(0, Math.round((now - Date.parse(wrapper.value.generatedAt)) / 60000)) };
+}
```

**File**: `api/mcp/dispatch.ts` (modified, +22/-4)
```diff
@@ -21,9 +21,9 @@ import { mcpErrorFingerprint } from './error-fingerprint';
 import { argBool, summarizeData } from './filters';
 import { evaluateFreshness } from './freshness';
 import { applyJmespath } from './jmespath';
-import { admitChokepointPanel, admitConflictPanel, admitCountryPanel, admitDisasterPanel, admitForecastPanel, admitMarketPanel, admitNewsIntelligencePanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
+import { admitChokepointPanel, admitConflictPanel, admitCountryPanel, admitDisasterPanel, admitForecastPanel, admitMarketPanel, admitNewsIntelligencePanel, admitNewsPanel, admitPredictionPanel, admitWorldBriefPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
-import { chokepointPanelViewSchema, conflictPanelViewSchema, disasterPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
+import { chokepointPanelViewSchema, conflictPanelViewSchema, disasterPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelViewSchema, predictionPanelViewSchema, worldBriefPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
 import { isSharedRestCounter, readDailyAllowance, reserveQuota, resolveDailyLimit, type McpBudget } from './quota';
 import { reserveFreeAccountAllowance } from './free-account-allowance';
 import { buildMcpStructuredDenial, type McpDenial } from './upgrade';
@@ -483,6 +483,22 @@ export async function dispatchToolsCall(
   const callArguments = Object.fromEntries(Object.entries(p.arguments ?? {}).filter(([key]) => key !== 'panel_request'));
   let sourceArguments = callArguments;
   try {
+    if (tool.name === 'get_world_brief') {
+      if (!dedicatedPanel && ('refresh' in callArguments || 'request_id' in callArguments)) throw new PanelRequestError('World Brief refresh controls require a paid panel allowance.', 'invalid');
+      if (dedicatedPanel) {
+        const { summary: _summary, jmespath: _projection, ...view } = callArguments;
+        const parsed = worldBriefPanelViewSchema.safeParse(view);
+        if (!parsed.success) throw new PanelRequestError('Supply valid World Brief arguments and a request_id for refresh.', 'invalid');
+        const { refresh, request_id: _requestId, ...filters } = parsed.data;
+        sourceArguments = filters;
+        if (suppliedPanel !== undefined && refresh) throw new PanelRequestError('Refresh the World Brief without a reader token.', 'invalid');
+        if (suppliedPanel === undefined) {
+          panelRequest = await admitWorldBriefPanel(context, budget, deps.redisPipeline, parsed.data);
+          panelUsage = panelRequest.usage;
+          panelRead = await authorizePanelRead(context, deps.redisPipeline, tool.name, filters, panelRequest.token);
+        }
+      }
+    }
     if (tool.name === 'get_chokepoint_status') {
       if (!dedicatedPanel && ('refresh' in callArguments || 'request_id' in callArguments)) throw new PanelRequestError('Chokepoint refresh controls require a paid panel allowance.', 'invalid');
       if (dedicatedPanel) {
@@ -602,7 +618,7 @@ export async function dispatchToolsCall(
       if (limited) return limited;
     }
     await panelRead?.reserveUncachedRead();
-    if ((tool.name === 'get_market_data' || tool.name === 'get_prediction_markets' || tool.name === 'get_conflict_events' || tool.name === 'get_natural_disasters' || tool.name === 'get_news_intelligence' || tool.name === 'get_chokepoint_status') && suppliedPanel !== undefined && panelRead
+    if ((tool.name === 'get_world_brief' || tool.name === 'get_market_data' || tool.name === 'get_prediction_markets' || tool.name === 'get_conflict_events' || tool.name === 'get_natural_disasters' || tool.name === 'get_news_intelligence' || tool.name === 'get_chokepoint_status') && suppliedPanel !== undefined && panelRead
       && (context.kind === 'pro' || context.kind === 'user_key')) {
       const allowance = await readDailyAllowance(context.userId, deps.redisPipeline, budget);
       if (allowance && allowance.used > 0) panelUsage = { ...allowance, unit: 'requests' };
@@ -738,7 +754,8 @@ export async function dispatchToolsCall(
       }
     }
     if (panelRead && panelRead.cached === undefined) {
-      if (chokepointRead) await panelRead.saveChokepoints(chokepointRead);
+      if (tool.name === 'get_world_brief') await panelRead.saveWorldBrief(result);
+      else if (chokepointRead) await panelRead.saveChokepoints(chokepointRead);
       else if (intelligenceRead) await panelRead.saveNewsIntelligence(intelligenceRead);
       else if (disasterRead) await panelRead.saveNaturalDisasters(disasterRead);
       else if (tool.name === 'open_news_dashboar
```

**File**: `api/mcp/panel-requests.ts` (modified, +36/-9)
```diff
@@ -2,12 +2,13 @@ import { countryActivityQueries } from '../../shared/country-activity-query';
 import { z } from 'zod';
 import { countryReaderSchema, COUNTRY_READERS, countryViewSchema, type PanelAdmission } from '../../shared/country-brief-host';
 import { resolveCountryCode } from '../../shared/country-code-resolve';
-import { chokepointPanelReadSchema, chokepointPanelViewSchema, conflictPanelReadSchema, conflictPanelViewSchema, disasterPanelReadSchema, disasterPanelViewSchema, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelReadSchema, newsIntelligencePanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ChokepointPanelAdmission, type ConflictPanelAdmission, type DisasterPanelAdmission, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsIntelligencePanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
+import { chokepointPanelReadSchema, chokepointPanelViewSchema, conflictPanelReadSchema, conflictPanelViewSchema, disasterPanelReadSchema, disasterPanelViewSchema, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelReadSchema, newsIntelligencePanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, worldBriefPanelReadSchema, worldBriefPanelViewSchema, type ChokepointPanelAdmission, type ConflictPanelAdmission, type DisasterPanelAdmission, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsIntelligencePanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission, type WorldBriefPanelAdmission } from '../../shared/panel-admission';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
 import { forecastTheaterReadSchema, reusableForecastTheaterResult } from '../../shared/forecast-theaters';
 import { iso2ToComtradeReporterCode, iso2ToUnCode } from '../../shared/country-numeric-codes';
 import { PANEL_REQUEST_READ_SCRIPT, PANEL_REQUEST_RESERVE_SCRIPT } from '../../shared/panel-request-scripts.mjs';
 import { dailyCounterKey, dailyQuotaFloorKey, envPrefix, PRO_DAILY_QUOTA_TTL_SECONDS } from '../../server/_shared/pro-mcp-token';
+import { readWorldBriefCache, worldBriefReuseUntil } from './_world-brief-snapshot';
 import { chokepointCacheIdentity, validChokepointCache, type ChokepointPanelRead } from './_chokepoint-snapshot';
 import { validNewsIntelligenceCache, type NewsIntelligencePanelRead } from './_news-intelligence-snapshot';
 import type { NaturalDisastersPanelRead } from './_natural-disasters-reuse';
@@ -21,7 +22,7 @@ const MAX_CACHED_BYTES = 524288;
 const encoder = new TextEncoder();
 
 type PanelScope = { panel: string; window: string; expires: number };
-export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission | DisasterPanelAdmission | NewsIntelligencePanelAdmission | ChokepointPanelAdmission;
+export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission | DisasterPanelAdmission | NewsIntelligencePanelAdmission | ChokepointPanelAdmission | WorldBriefPanelAdmission;
 export class PanelRequestError extends Error {
   constructor(message: string, public code: 'invalid' | 'quota' | 'reads' | 'backend', public limit?: number, public retryAfter?: number) {
     super(message);
@@ -33,8 +34,8 @@ function userId(context: McpAuthContext): string {
   if (context.kind !== 'pro' && context.kind !== 'user_key') throw new PanelRequestError('A paid user-bound connection is required.', 'invalid');
   return context.userId;
 }
-function panelFamily(panel: string): 'country' | 'chokepoints' | 'news-intelligence' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' | 'disasters' {
-  return panel === 'chokepoints' || panel === 'news-intelligence' || panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' || panel === 'disasters' ? panel : 'country';
+function panelFamily(panel: string): 'country' | 'world-brief' | 'chokepoints' | 'news-intelligence' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' | 'disasters' {
+  return panel === 'world-brief' || panel === 'chokepoints' || panel === 'news-intelligence' || panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' || panel === 'disasters' ? panel : 'country';
 }
 function panelKey(owner: string, scope: PanelScope): string {
   return `${dailyCounterKey(owner, new Date(scope.expires - 1))}:${panelFamily(scope.panel)}:${scope.panel}:${scope.window}`;
@@ -103,6 +104,12 @@ export async function admitNewsIntelligencePanel(context: McpAuthContext, budget
   return { ...await admi
```

**File**: `api/mcp/registry/rpc-tools.ts` (modified, +4/-1)
```diff
@@ -1392,11 +1392,14 @@ export const RPC_TOOLS: ToolDef[] = [
   {
     name: 'get_world_brief',
     _outputBudgetBytes: 65536,
-    description: 'Citation-grounded world intelligence brief from the same precomputed news:insights:v1 snapshot used by the dashboard. The insights seeder applies corroboration, citation, and hallucination gates before publishing; this tool reads that accepted result without a request-time LLM call. The optional geo_context field is retained for client compatibility and does not alter the seeded global snapshot. Each headline is paired with an index-aligned topStories entry carrying the story corroboration evidence published by its snapshot: uniqueSourceCount (distinct outlets), corroborationSourceCount, entityCorroboration, sourceTier, the outlet names themselves, corroboration, and the publishers roster with each publisher\'s declared tier, both derived from those outlet names; corroboration.state (single-publisher, tier4-only, corroborated, unknown) describes coverage, not accuracy. Legacy snapshots omit corroboration fields they did not publish. When the seeder has not published inside the 60-minute freshness window the last-known-good snapshot is served rather than failing, flagged by stale:true with ageMinutes — the content is unchanged and still fully gated, so weigh its age rather than discarding it. Serving is capped at 3h old; past that, and for a snapshot that is absent or broken rather than merely old, the source is reported unavailable.',
+    description: 'Citation-grounded world intelligence brief from the same precomputed news:insights:v1 snapshot used by the dashboard. The insights seeder applies corroboration, citation, and hallucination gates before publishing; this tool reads that accepted result without a request-time LLM call. The optional geo_context field is retained for client compatibility and does not alter the seeded global snapshot. Each headline is paired with an index-aligned topStories entry carrying the story corroboration evidence published by its snapshot: uniqueSourceCount (distinct outlets), corroborationSourceCount, entityCorroboration, sourceTier, the outlet names themselves, corroboration, and the publishers roster with each publisher\'s declared tier, both derived from those outlet names; corroboration.state (single-publisher, tier4-only, corroborated, unknown) describes coverage, not accuracy. Legacy snapshots omit corroboration fields they did not publish. When the seeder has not published inside the 60-minute freshness window the last-known-good snapshot is served rather than failing, flagged by stale:true with ageMinutes — the content is unchanged and still fully gated, so weigh its age rather than discarding it. Serving is capped at 3h old; past that, and for a snapshot that is absent or broken rather than merely old, the source is reported unavailable. Paid MCP openings consume one request allocation; healthy loaded reuse and ignored geo_context changes reuse it. API allowances retain ordinary per-tool billing.',
     inputSchema: {
       type: 'object',
       properties: {
         geo_context: { type: 'string', description: 'Deprecated compatibility field; the precomputed global snapshot is not regenerated or refocused per request.' },
+        refresh: { type: 'boolean', description: 'Paid MCP panel only. Explicit refresh starts one new request allocation; requires request_id.' },
+        request_id: { type: 'string', description: 'UUID for a paid explicit refresh. Retrying the same UUID reuses its allocation.' },
+        panel_request: { type: 'string', description: 'Signed paid World Brief receipt for loaded reads. Do not combine with refresh.' },
       },
       required: [],
     },
```

**File**: `docs/mcp-apps.mdx` (modified, +8/-0)
```diff
@@ -165,3 +165,11 @@ On Pro and Pro Business, `get_chokepoint_status` opens one signed `chokepoints`
 Use the returned `panelRequest.token` as `panel_request` only for this tool. Explicit `refresh: true` requires a UUID `request_id` and no reader token; the same UUID retries that allocation. Authorized receipt reads report current usage without reserving another allocation; unknown usage omits the numeric notice. API and free-account calls retain per-tool accounting and reject these paid controls.
 
 An uncached execution uses the existing six dataset GETs, six metadata GETs and one activation EXISTS command. The 64-read admission bound counts tool executions, not those 13 Redis commands. Reuse checks selected source shapes, availability, publication clocks and CN/HK critical content age, both after lookup and before cache storage. Partial, malformed, unassessed or expired originals are not cached as complete. Reference-year baselines and modeled flow publication dates do not prove current metered oil or fresh underlying history. The private wrapped cache remains 512 KiB; tool output remains 128 KiB. This admission change does not add website details, histories, warnings or provider reads.
+
+### World Brief panel admission
+
+On Pro and Pro Business, `get_world_brief` opens one signed `world-brief` allocation. Repeated questions, compatibility `geo_context` changes and JMESPath views share that allocation. The RPC ignores `summary`; it does not summarize the brief. Reuse retains the accepted original prose, evidence and citation order before presentation. It ends at the earlier of admission expiry and `generatedAt` plus 60 minutes; replay recomputes the content age. This is a retained accepted generation, not an attestation that the latest producer attempt succeeded.
+
+Use `panelRequest.token` as `panel_request` only for this tool. Explicit `refresh: true` requires a UUID `request_id` and no reader token; the same UUID retries that allocation. Authorized receipt reads query current usage without reserving another allocation. Unknown usage omits the numeric notice. API allowances retain per-tool billing, and free accounts retain the existing subscription denial.
+
+Valid content aged 60 minutes to less than three hours remains available with `stale: true` but is not retained for fresh replay. Failed, missing, malformed and expired originals can retry under the same allocation. The 64-read bound counts uncached tool executions. Acquisition uses the existing authenticated bootstrap gateway path; it adds no provider call or producer-health transport. The private wrapped cache remains 512 KiB and tool output remains 64 KiB.
```

**File**: `docs/mcp-overview.mdx` (modified, +8/-0)
```diff
@@ -635,3 +635,11 @@ On Pro and Pro Business, `get_chokepoint_status` opens one signed `chokepoints`
 Use the returned `panelRequest.token` as `panel_request` only for this tool. Explicit `refresh: true` requires a UUID `request_id` and no reader token; the same UUID retries that allocation. Authorized receipt reads report current usage without reserving another allocation; unknown usage omits the numeric notice. API and free-account calls retain per-tool accounting and reject these paid controls.
 
 An uncached execution uses the existing six dataset GETs, six metadata GETs and one activation EXISTS command. The 64-read admission bound counts tool executions, not those 13 Redis commands. Reuse checks selected source shapes, availability, publication clocks and CN/HK critical content age, both after lookup and before cache storage. Partial, malformed, unassessed or expired originals are not cached as complete. Reference-year baselines and modeled flow publication dates do not prove current metered oil or fresh underlying history. The private wrapped cache remains 512 KiB; tool output remains 128 KiB. This admission change does not add website details, histories, warnings or provider reads.
+
+### World Brief panel admission
+
+On Pro and Pro Business, `get_world_brief` opens one signed `world-brief` allocation. Repeated questions, compatibility `geo_context` changes and JMESPath views share that allocation. The RPC ignores `summary`; it does not summarize the brief. Reuse retains the accepted original prose, evidence and citation order before presentation. It ends at the earlier of admission expiry and `generatedAt` plus 60 minutes; replay recomputes the content age. This is a retained accepted generation, not an attestation that the latest producer attempt succeeded.
+
+Use `panelRequest.token` as `panel_request` only for this tool. Explicit `refresh: true` requires a UUID `request_id` and no reader token; the same UUID retries that allocation. Authorized receipt reads query current usage without reserving another allocation. Unknown usage omits the numeric notice. API allowances retain per-tool billing, and free accounts retain the existing subscription denial.
+
+Valid content aged 60 minutes to less than three hours remains available with `stale: true` but is not retained for fresh replay. Failed, missing, malformed and expired originals can retry under the same allocation. The 64-read bound counts uncached tool executions. Acquisition uses the existing authenticated bootstrap gateway path; it adds no provider call or producer-health transport. The private wrapped cache remains 512 KiB and tool output remains 64 KiB.
```

**File**: `docs/mcp-tools-reference.mdx` (modified, +4/-1)
```diff
@@ -2664,10 +2664,13 @@ Citation-grounded world intelligence brief from the same precomputed `news:insig
 | Name | Type | Required | Description |
 |------|------|---------:|-------------|
 | `geo_context` | string | no | Deprecated compatibility field; the precomputed global snapshot is not regenerated or refocused per request. |
+| `refresh` | boolean | no | Paid MCP panel only. Explicit refresh starts one new request allocation; requires request_id. |
+| `request_id` | string | no | UUID for a paid explicit refresh. Retrying the same UUID reuses its allocation. |
+| `panel_request` | string | no | Signed paid World Brief receipt for loaded reads. Do not combine with refresh. |
 
 - **API endpoints:** `GET /api/infrastructure/v1/get-bootstrap-data` (called with `?keys=insights`) — authenticated gateway read of the same `news:insights:v1` payload used by the dashboard.
 - **Access:** `subscription` — requires a Pro subscription. RPC tool: no `summary` argument (use `jmespath` to trim the response).
-- **Kind:** cache-backed RPC — returns the latest accepted seeder snapshot and fails closed when it is missing, stale, or degraded. No request-time LLM call.
+- **Kind:** cache-backed RPC. A paid opening uses one World Brief allocation; healthy repeat and JMESPath calls reuse the accepted original within its source and admission deadlines. Valid last-known-good content under three hours remains serveable with its stale notice, but stale content is retryable rather than cached for fresh replay. Missing, broken or older content is unavailable. No request-time LLM call. API allowances retain ordinary per-tool billing; free accounts retain the subscription denial.
 - **Sources:** returns the bounded `worldBriefSources` array published with the seeded payload in producer order. URLs are copied from explicit source records, not generated at MCP execution time; empty URL fallbacks are retained so citation indexes cannot shift.
 - **Corroboration:** each entry in `headlines` has an index-aligned entry in `topStories` (`topStories[i]` describes `headlines[i]`) carrying `sourceCount`, `uniqueSourceCount`, `corroborationSourceCount`, `entityCorroboration`, `sourceTier`, and the contributing outlet names in `sources` (capped at 12). All of it is published by the insights seeder, so nothing is computed per request. Note that this per-story `sources` is a list of outlet names, unlike the tool's top-level `sources`, which carries citation records. `memberTitles` is deliberately not returned here — it is available on `get_news_intelligence`, which has a larger output budget.
 
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +8/-0)
```diff
@@ -156,3 +156,11 @@ docs-stat 门禁从 `api/mcp/ui/registry.ts` 和工具注册表派生应用清
 返回的 `panelRequest.token` 作为 `panel_request` 仅授权此工具。显式 `refresh: true` 需要 UUID `request_id`，并省略读取凭据；同一 UUID 的重试复用该额度。已授权凭据读取会查询当前用量，不再分配额度；用量未知时不显示数字。API 和免费账户保持逐工具计费，并拒绝这些付费控制参数。
 
 每次未缓存执行仍使用六个数据 GET、六个元数据 GET 和一个激活 EXISTS 命令。64 次读取限制按工具执行计数，不按这 13 个 Redis 命令计数。复用在缓存查询后和保存前验证所选来源形状、可用性、发布时间以及 CN/HK 关键内容时效。部分、格式错误、未经评估或过期的原始数据不会作为完整数据缓存。基准参考年份和建模流量发布时间不能证明当前实测油流或底层历史的新鲜度。私有封装缓存仍为 512 KiB，工具输出仍为 128 KiB。此额度修改不增加网站详情、历史、警告或提供商读取。
+
+### 世界简报面板额度
+
+在 Pro 和 Pro Business 中，`get_world_brief` 打开一次签名的 `world-brief` 面板只消耗一个额度。重复提问、兼容参数 `geo_context` 的变化和 JMESPath 视图共享该额度。RPC 忽略 `summary`，不会据此压缩简报。复用保留展示处理前的已接受原文、证据和引用顺序。复用期限取面板授权期限与 `generatedAt` 加 60 分钟的最早值，读取时重新计算内容年龄。这表示保留已接受的生成版本，不证明生产程序的最新尝试成功。
+
+返回的 `panelRequest.token` 作为 `panel_request` 仅授权此工具。显式 `refresh: true` 需要 UUID `request_id`，并省略读取凭据；同一 UUID 的重试复用该额度。已授权凭据读取查询当前用量，不再分配额度；用量未知时不显示数字。API 保持逐工具计费，免费账户保持现有订阅拒绝行为。
+
+有效内容生成后 60 分钟至不足三小时仍可返回，并标记 `stale: true`，但不会作为新鲜快照缓存复用。失败、缺失、格式错误或过期的原始数据可在同一额度内重试。64 次读取限制按未缓存工具执行计数。获取仍使用现有已认证 bootstrap 网关路径，不增加提供商调用或生产健康状态传输。私有封装缓存仍为 512 KiB，工具输出仍为 64 KiB。
```

---

### Incident Patch 8: `dde6bfdd` (2026-10-05)
**Commit Message**: fix(plugin): restore projected World Brief content (#8848)

* test(plugin): reproduce World Brief projection evidence loss

* test(plugin): clear replaced World Brief stale evidence

* fix(plugin): retain World Brief projected evidence

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Elie Habib <[REDACTED_EMAIL]>

**File**: `api/mcp/constants.ts` (modified, +1/-1)
```diff
@@ -268,7 +268,7 @@ export const SERVER_NAME = 'worldmonitor';
 // Bumped 1.13.0 → 1.14.0 (2026-07-08) reflecting:
 //   - MCP Apps interactive-dashboard fleet: four new ui:// app-shell resources
 //     joining the v1.11.0 country-risk widget —
-//       * ui://worldmonitor/world-brief.html      (get_world_brief)
+//       * ui://worldmonitor/world-brief-v2.html      (get_world_brief)
 //       * ui://worldmonitor/country-brief.html    (get_country_brief)
 //       * ui://worldmonitor/market-radar.html      (get_market_data)
 //       * ui://worldmonitor/chokepoint-monitor.html (get_chokepoint_status)
```

**File**: `api/mcp/ui/registry.ts` (modified, +5/-3)
```diff
@@ -40,7 +40,8 @@ export const UI_RESOURCE_MIME_TYPE = SHELL_UI_MIME_TYPE;
 // def as the single-source-of-truth `_uiResourceUri`, so the tool linkage and
 // the registered resource can never drift.
 export const COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk.html';
-export const WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief.html';
+export const WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief-v2.html';
+const LEGACY_WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief.html';
 export const COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief.html';
 export const MARKET_RADAR_UI_URI = 'ui://worldmonitor/market-radar-v3.html';
 export const CHOKEPOINT_MONITOR_UI_URI = 'ui://worldmonitor/chokepoint-monitor-v2.html';
@@ -177,7 +178,7 @@ export const UI_RESOURCE_REGISTRY: UiResourceDef[] = [
 const UI_RESOURCE_BY_URI = new Map(UI_RESOURCE_REGISTRY.map((r) => [r.uri, r]));
 
 export function isUiResourceUri(uri: string): boolean {
-  return uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
+  return uri === LEGACY_WORLD_BRIEF_UI_URI || uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
 }
 
 // resources/list public shape — {uri, name, description, mimeType} plus the
@@ -211,7 +212,8 @@ export async function buildUiResourceRead(
   if (uri === MARKET_RADAR_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI) return readMarketRadar(id, corsHeaders, uri);
   if (uri === COUNTRY_VIEW_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI) return readCountryView(id, corsHeaders, uri);
   if (uri === NEWS_DASHBOARD_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI) return readNewsDashboard(id, corsHeaders, uri);
-  const canonicalUri = uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI ? CHOKEPOINT_MONITOR_UI_URI
+  const canonicalUri = uri === LEGACY_WORLD_BRIEF_UI_URI ? WORLD_BRIEF_UI_URI
+    : uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI ? CHOKEPOINT_MONITOR_UI_URI
     : uri === LEGACY_NEWS_INTELLIGENCE_UI_URI ? NEWS_INTELLIGENCE_UI_URI
     : uri === LEGACY_CONFLICT_EVENTS_UI_URI ? CONFLICT_EVENTS_UI_URI
     : uri === LEGACY_NATURAL_DISASTERS_UI_URI ? NATURAL_DISASTERS_UI_URI
```

**File**: `api/mcp/ui/world-brief-app.ts` (modified, +3/-2)
```diff
@@ -59,7 +59,8 @@ const BODY = `
 `;
 
 const RENDER = `
-    if (!data || typeof data !== "object") return;
+    if (data && typeof data === "object" && Object.prototype.hasOwnProperty.call(data, "projection")) data = data.projection;
+    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
     var brief = typeof data.brief === "string" && data.brief ? data.brief
       : (typeof data.summary === "string" ? data.summary : "");
     q("empty").style.display = "none";
@@ -112,12 +113,12 @@ const RENDER = `
     // otherwise an old brief is presented identically to a current one and the
     // labelling this rests on reaches the agent but never the human.
     var staleEl = q("stale-note");
+    staleEl.textContent = "";
     if (data.stale === true) {
       var age = typeof data.ageMinutes === "number" && isFinite(data.ageMinutes) ? Math.round(data.ageMinutes) : null;
       var howOld = age == null ? "" :
         age < 60 ? age + " minutes old" :
         Math.floor(age / 60) + "h " + (age % 60) + "m old";
-      staleEl.textContent = "";
       var lead = document.createElement("b");
       lead.textContent = "Stale brief";
       staleEl.appendChild(lead);
```

**File**: `docs/mcp-apps.mdx` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ Three discovery signals must stay aligned:
 | UI resource URI | Linked tool | App | Renders |
 |---|---|---|---|
 | `ui://worldmonitor/country-risk.html` | `get_country_risk` | Country Risk (interactive) | Composite Instability Index score, component breakdown, travel advisory, and sanctions exposure. |
-| `ui://worldmonitor/world-brief.html` | `get_world_brief` | World Brief (interactive) | Precomputed citation-grounded global brief, grounding headlines, and source feed articles. |
+| `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | World Brief (interactive) | Precomputed citation-grounded global brief, grounding headlines, and source feed articles. |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | Country Brief (interactive) | Per-country intelligence brief, analytical framework lens, and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Market Radar (interactive) | Fear & Greed plus all loaded quote rows, asset names and expandable intraday charts from the same snapshot. |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | Chokepoint Monitor (interactive) | Per-chokepoint transit summaries, week-over-week change, tanker split, and risk-level badge. |
```

**File**: `docs/mcp-overview.mdx` (modified, +1/-1)
```diff
@@ -510,7 +510,7 @@ The server supports [MCP Apps](https://modelcontextprotocol.io/extensions/apps/b
 | UI resource URI | Linked tool | Renders |
 |-----------------|-------------|---------|
 | `ui://worldmonitor/country-risk.html` | `get_country_risk` | CII score, unrest/conflict/security/news component breakdown, travel-advisory level, and OFAC sanctions exposure. |
-| `ui://worldmonitor/world-brief.html` | `get_world_brief` | The precomputed, citation-grounded global intelligence brief as readable paragraphs, plus grounding headlines and source articles. |
+| `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | The precomputed, citation-grounded global intelligence brief as readable paragraphs, plus grounding headlines and source articles. |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | The AI-synthesised per-country brief as paragraphs, with the analytical framework lens and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed plus all loaded equity, commodity, crypto, Gulf and sector quotes, asset names and expandable intraday charts. |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | Per-chokepoint rolling transit summaries (today's count, week-over-week change, tanker split) with a risk-level badge. |
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 | UI 资源 URI | 关联工具 | 应用 | 渲染内容 |
 |---|---|---|---|
 | `ui://worldmonitor/country-risk.html` | `get_country_risk` | 国家风险（交互式） | 综合不稳定指数评分、组成部分细分、旅行建议和制裁风险敞口。 |
-| `ui://worldmonitor/world-brief.html` | `get_world_brief` | 世界简报（交互式） | AI 摘要的全球简报、支撑性头条新闻和信息源文章。 |
+| `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | 世界简报（交互式） | AI 摘要的全球简报、支撑性头条新闻和信息源文章。 |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | 国家简报（交互式） | 按国家划分的情报简报、分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | 市场雷达（交互式） | 恐惧贪婪综合指数，以及股票、大宗商品、加密货币、海湾地区和行业报价表，附带带符号、颜色编码的涨跌。 |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | 咽喉要道监视器（交互式） | 按咽喉要道划分的通行摘要、周环比变化、油轮构成和风险等级徽章。 |
```

**File**: `docs/zh/mcp-overview.mdx` (modified, +1/-1)
```diff
@@ -484,7 +484,7 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 | UI 资源 URI | 关联工具 | 渲染内容 |
 |-----------------|-------------|---------|
 | `ui://worldmonitor/country-risk.html` | `get_country_risk` | CII 评分、动荡/冲突/安全/新闻组成部分分解、旅行警示级别，以及 OFAC 制裁敞口。 |
-| `ui://worldmonitor/world-brief.html` | `get_world_brief` | 以可读段落呈现的预计算、有引用依据的全球情报简报，外加支撑性头条和来源文章。 |
+| `ui://worldmonitor/world-brief-v2.html` | `get_world_brief` | 以可读段落呈现的预计算、有引用依据的全球情报简报，外加支撑性头条和来源文章。 |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | 以段落呈现的 AI 合成各国简报，附带分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed 综合指标，外加各资产类别的报价表（股票、大宗商品、加密货币、海湾、板块），带有带符号、色彩编码的涨跌。 |
 | `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | 各咽喉要道的滚动过境摘要（今日计数、周环比变化、油轮占比），并带有风险级别标记。 |
```

**File**: `public/.well-known/mcp/server-card.json` (modified, +2/-2)
```diff
@@ -739,7 +739,7 @@
       "uiResourceMimeType": "text/html;profile=mcp-app",
       "uiResources": [
         "ui://worldmonitor/country-risk.html",
-        "ui://worldmonitor/world-brief.html",
+        "ui://worldmonitor/world-brief-v2.html",
         "ui://worldmonitor/country-brief.html",
         "ui://worldmonitor/market-radar-v3.html",
         "ui://worldmonitor/chokepoint-monitor-v2.html",
@@ -751,7 +751,7 @@
         "ui://worldmonitor/news-dashboard-v3.html",
         "ui://worldmonitor/country-view-v3.html"
       ],
-      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk.html, get_world_brief → world-brief.html, get_country_brief → country-brief.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor-v2.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
+      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk.html, get_world_brief → world-brief-v2.html, get_country_brief → country-brief.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor-v2.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
     }
   },
   "features": {
```

---

### Incident Patch 9: `dbbc122a` (2026-10-05)
**Commit Message**: fix(plugin): reuse Chokepoint panel allocations (#8846)

* test(mcp): cover curated market panel admission

* feat(mcp): admit curated market panels once per opening

* test(mcp): cover uppercase panel refresh UUIDs

* fix(mcp): canonicalize panel refresh UUID case

* docs(mcp): describe curated market panel accounting

* test(mcp): reproduce missing market receipt usage metadata

* fix(mcp): preserve current usage on authorized market receipt results

* test(mcp): keep ordinary quota probes on a non-panel tool

* test(mcp): preserve ordinary quota lifecycle coverage

* test: reproduce prediction panel accounting and receipt failures

* fix: share paid prediction panel allocation across filters and reads

* test: reproduce unavailable prediction replay and pin bounded output

* fix: keep unavailable prediction snapshots retryable

* test: reject unknown prediction replay envelopes

* fix: preserve unknown prediction envelopes as retryable

* docs(mcp): describe prediction panel reuse and refresh

* docs(mcp): align prediction parameter table with schema

* test(mcp): reproduce selected prediction cache masking source health

* fix(mcp): retain prediction source health before filter

**File**: `api/mcp/_chokepoint-snapshot.ts` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+import { CHOKEPOINT_THREAT_LEVELS } from '../../shared/chokepoint-threat-levels.js';
+import { narrowFlowSource } from '../../server/_shared/flow-source';
+import { argStr, argStrList, ciIncludes, pickMapKeysLike } from './filters';
+// @ts-expect-error — shared Edge-safe JavaScript content contract.
+import { buildContentFreshnessAssessment } from '../_content-freshness.js';
+
+export type ChokepointPanelRead = { value: unknown; reuseUntil: number | null };
+export const CHOKEPOINT_DATASETS = ['transit-summaries', 'chokepoint_transits', '_countries', 'chokepoint-baselines', 'ref', 'chokepoint-flows'] as const;
+const MAX_AGE_MS = [30, 30, 2160, 60 * 24 * 400, 60 * 24 * 14, 720].map(minutes => minutes * 60_000);
+const BASELINE_IDS = ['hormuz', 'malacca', 'suez', 'babelm', 'danish', 'turkish', 'panama'];
+const FLOW_IDS = ['hormuz_strait', 'malacca_strait', 'suez', 'bab_el_mandeb', 'dover_strait', 'bosphorus', 'panama'];
+const TRANSIT_NAMES = ['Strait of Hormuz', 'Suez Canal', 'Malacca Strait', 'Bab el-Mandeb Strait', 'Panama Canal', 'Taiwan Strait', 'South China Sea', 'Black Sea', 'Cape of Good Hope', 'Gibraltar Strait', 'Bosporus Strait', 'Korea Strait', 'Dover Strait', 'Kerch Strait', 'Lombok Strait'];
+const CONTENT_REQUIREMENT = { countries: ['CN', 'HK'], budgetMinutes: 10 * 24 * 60 };
+
+function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
+function clock(value: unknown, now: number): number | null {
+  const stamp = typeof value === 'string' ? Date.parse(value) : value;
+  return typeof stamp === 'number' && Number.isSafeInteger(stamp) && stamp > 0 && stamp <= now ? stamp : null;
+}
+function failed(value: Record<string, unknown>): boolean {
+  return Boolean(value.error) || ['error', 'degraded', 'unavailable', 'processing', 'failed'].includes(String(value.status)) || ['stale', 'degraded', 'unavailable', 'upstreamUnavailable', 'rateLimited', 'fallback'].some(key => value[key] === true)
+    || value.dataAvailable === false || ['errorCode', 'skipReason', 'errorReason'].some(key => typeof value[key] === 'string' && value[key] !== '')
+    || value.sourceState !== undefined && value.sourceState !== 'ok'
+    || ['failedSources', 'failedDatasets'].some(key => Array.isArray(value[key]) && value[key].length > 0);
+}
+function nonnegative(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
+function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { return Object.keys(value).length === keys.length && keys.every(key => key in value); }
+function selectedRows(value: Record<string, unknown>, params: Record<string, unknown>): Record<string, unknown> {
+  return pickMapKeysLike(value, argStr(params.chokepoint)) as Record<string, unknown>;
+}
+
+export function chokepointCacheIdentity(params: Record<string, unknown>): { dataset: string[]; chokepoint: string } {
+  const requested = argStrList(params.dataset);
+  const known = CHOKEPOINT_DATASETS.filter(label => requested.includes(label));
+  return { dataset: [...(known.length ? known : CHOKEPOINT_DATASETS)], chokepoint: argStr(params.chokepoint) };
+}
+
+function sourceCount(data: Record<string, unknown>, index: number): number | null {
+  const bucket = data[CHOKEPOINT_DATASETS[index]!];
+  if (index === 2) return Array.isArray(bucket) ? bucket.length : null;
+  if (!record(bucket)) return null;
+  if (index === 0) return record(bucket.summaries) ? Object.values(bucket.summaries).filter(row => record(row) && row.dataAvailable === true).length : null;
+  if (index === 1) return record(bucket.transits) ? Object.keys(bucket.transits).length : null;
+  if (index === 3) return Array.isArray(bucket.chokepoints) ? bucket.chokepoints.length : null;
+  return Object.keys(bucket).length;
+}
+
+function validSource(data: Record<string, unknown>, index: number, params: Record<string, unknown>): boolean {
+  const bucket = data[CHOKEPOINT_DATASETS[index]!];
+  if (index === 2) return Array.isArray(bucket) && bucket.length >= 174 && new Set(bucket).size === bucket.length && bucket.every(code => typeof code === 'string' && /^[A-Z]{2}$/.test(code)) && ['CN', 'HK'].every(code => bucket.includes(code));
+  if (!record(bucket) || failed(bucket)) return false;
+  if (index === 0 || index === 1) {
+    const rows = bucket[index === 0 ? 'summaries' : 'transits'];
+    if (!record(rows) || !exactKeys(rows, index === 0 ? Object.keys(CHOKEPOINT_THREAT_LEVELS) : TRANSIT_NAMES)) return false;
+    return Object.values(selectedRows(rows, params)).every(row => record(row) && !failed(row)
+      && (index === 0 ? row.dataAvailable === true && ['todayTotal', 'todayTanker', 'todayCargo', 'todayOther'].every(field => nonnegative(row[field]))
+        && row.todayTotal === Number(row.todayTanker) + Number(row.todayCargo) + Number(row.todayOther)
+        : row.available === true && ['total', 'tanke
```

**File**: `api/mcp/dispatch.ts` (modified, +57/-17)
```diff
@@ -2,6 +2,7 @@ import { buildAttributionRider, mergeAttributionRider } from '../../shared/attri
 import { readExistsFlags, readJsonFromUpstash, readRawJsonFromUpstash, redisPipeline } from '../_upstash-json.js';
 // @ts-expect-error — Edge-safe JS envelope mirror.
 import { unwrapEnvelope } from '../_seed-envelope.js';
+import { chokepointCacheIdentity, chokepointSourcePolicy, type ChokepointPanelRead } from './_chokepoint-snapshot';
 import { newsIntelligenceFreshness, newsIntelligenceReuseUntil, type NewsIntelligencePanelRead } from './_news-intelligence-snapshot';
 import { resolveCountryFilter } from './_country-args';
 import { filterNaturalDisastersPanelData, naturalDisastersReuseUntil, type NaturalDisastersPanelRead } from './_natural-disasters-reuse';
@@ -20,9 +21,9 @@ import { mcpErrorFingerprint } from './error-fingerprint';
 import { argBool, summarizeData } from './filters';
 import { evaluateFreshness } from './freshness';
 import { applyJmespath } from './jmespath';
-import { admitConflictPanel, admitCountryPanel, admitDisasterPanel, admitForecastPanel, admitMarketPanel, admitNewsIntelligencePanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
+import { admitChokepointPanel, admitConflictPanel, admitCountryPanel, admitDisasterPanel, admitForecastPanel, admitMarketPanel, admitNewsIntelligencePanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
-import { conflictPanelViewSchema, disasterPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
+import { chokepointPanelViewSchema, conflictPanelViewSchema, disasterPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
 import { isSharedRestCounter, readDailyAllowance, reserveQuota, resolveDailyLimit, type McpBudget } from './quota';
 import { reserveFreeAccountAllowance } from './free-account-allowance';
 import { buildMcpStructuredDenial, type McpDenial } from './upgrade';
@@ -85,7 +86,12 @@ export async function executeNewsIntelligencePanelRead(): Promise<NewsIntelligen
   return executeCacheTool(tool, {}, undefined, 'news-intelligence');
 }
 
-type CachePanelDomain = 'natural-disasters' | 'news-intelligence';
+export async function executeChokepointPanelRead(params: Record<string, unknown>): Promise<ChokepointPanelRead> {
+  const tool = TOOL_REGISTRY.find(tool => tool.name === 'get_chokepoint_status')! as CacheToolDef;
+  return executeCacheTool(tool, params, undefined, 'chokepoints');
+}
+
+type CachePanelDomain = 'natural-disasters' | 'news-intelligence' | 'chokepoints';
 
 async function executeCacheTool(
   tool: CacheToolDef,
@@ -140,9 +146,9 @@ async function executeCacheTool(
   // closed exactly as for an unreadable activation marker; `freshnessUnknown`
   // is what tells the caller the verdict rests on a read that failed.
   const metas = metaOutcomes.map((r) => (r.ok ? r.value : null));
-  const freshnessUnknown = metaOutcomes.some((r) => !r.ok);
+  let freshnessUnknown = metaOutcomes.some((r) => !r.ok);
   const labels = tool._cacheKeys.map((key) => cacheKeyLabel(tool, key));
-  const unreadable = labels.filter((_, i) => !dataReads[i]!.ok);
+  let unreadable = labels.filter((_, i) => !dataReads[i]!.ok);
   // Three-valued on purpose: only a marker we actually read and found ABSENT
   // earns the deployment-order grace. An unreadable marker stays out of the
   // map, so evaluateFreshness evaluates the block and fails closed rather than
@@ -157,7 +163,7 @@ async function executeCacheTool(
   // told its CALLER nothing — `stale: true` looked the same whether the marker
   // was unreadable, the producer regressed, or the grace window closed. One
   // boolean drives both the alarm and the wire field so they cannot drift.
-  const activationUnknown = activationKeys.length > 0
+  let activationUnknown = activationKeys.length > 0
     && activationStates.size !== activationKeys.length;
   if (activationUnknown) {
     captureSilentError(new Error('mcp activation marker read failed'), {
@@ -171,7 +177,7 @@ async function executeCacheTool(
   // still live, or MCP briefly disagrees with the health surfaces at the exact
   // instant the deadline passes. `now` stays injectable as a test seam.
   const evaluatedAt = now ?? Date.now();
-  const { cached_at, stale, contentFreshnessPendingUntil } = evaluateFreshness(
+  let { cached_at, stale, contentFreshnessPendingUntil } = evaluateFreshness(
     freshnessChecks,
     metas,
     evaluatedAt,
@@ -218,10 +224,23 @@ async function executeCacheTool(
     });
   }
 
-  const data
```

**File**: `api/mcp/panel-requests.ts` (modified, +34/-9)
```diff
@@ -2,12 +2,13 @@ import { countryActivityQueries } from '../../shared/country-activity-query';
 import { z } from 'zod';
 import { countryReaderSchema, COUNTRY_READERS, countryViewSchema, type PanelAdmission } from '../../shared/country-brief-host';
 import { resolveCountryCode } from '../../shared/country-code-resolve';
-import { conflictPanelReadSchema, conflictPanelViewSchema, disasterPanelReadSchema, disasterPanelViewSchema, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelReadSchema, newsIntelligencePanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ConflictPanelAdmission, type DisasterPanelAdmission, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsIntelligencePanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
+import { chokepointPanelReadSchema, chokepointPanelViewSchema, conflictPanelReadSchema, conflictPanelViewSchema, disasterPanelReadSchema, disasterPanelViewSchema, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelReadSchema, newsIntelligencePanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ChokepointPanelAdmission, type ConflictPanelAdmission, type DisasterPanelAdmission, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsIntelligencePanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
 import { forecastTheaterReadSchema, reusableForecastTheaterResult } from '../../shared/forecast-theaters';
 import { iso2ToComtradeReporterCode, iso2ToUnCode } from '../../shared/country-numeric-codes';
 import { PANEL_REQUEST_READ_SCRIPT, PANEL_REQUEST_RESERVE_SCRIPT } from '../../shared/panel-request-scripts.mjs';
 import { dailyCounterKey, dailyQuotaFloorKey, envPrefix, PRO_DAILY_QUOTA_TTL_SECONDS } from '../../server/_shared/pro-mcp-token';
+import { chokepointCacheIdentity, validChokepointCache, type ChokepointPanelRead } from './_chokepoint-snapshot';
 import { validNewsIntelligenceCache, type NewsIntelligencePanelRead } from './_news-intelligence-snapshot';
 import type { NaturalDisastersPanelRead } from './_natural-disasters-reuse';
 import { conflictPanelReuseUntil, isConflictPanelSnapshotCacheable } from './registry/cache-tools';
@@ -20,7 +21,7 @@ const MAX_CACHED_BYTES = 524288;
 const encoder = new TextEncoder();
 
 type PanelScope = { panel: string; window: string; expires: number };
-export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission | DisasterPanelAdmission | NewsIntelligencePanelAdmission;
+export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission | DisasterPanelAdmission | NewsIntelligencePanelAdmission | ChokepointPanelAdmission;
 export class PanelRequestError extends Error {
   constructor(message: string, public code: 'invalid' | 'quota' | 'reads' | 'backend', public limit?: number, public retryAfter?: number) {
     super(message);
@@ -32,8 +33,8 @@ function userId(context: McpAuthContext): string {
   if (context.kind !== 'pro' && context.kind !== 'user_key') throw new PanelRequestError('A paid user-bound connection is required.', 'invalid');
   return context.userId;
 }
-function panelFamily(panel: string): 'country' | 'news-intelligence' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' | 'disasters' {
-  return panel === 'news-intelligence' || panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' || panel === 'disasters' ? panel : 'country';
+function panelFamily(panel: string): 'country' | 'chokepoints' | 'news-intelligence' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' | 'disasters' {
+  return panel === 'chokepoints' || panel === 'news-intelligence' || panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' || panel === 'disasters' ? panel : 'country';
 }
 function panelKey(owner: string, scope: PanelScope): string {
   return `${dailyCounterKey(owner, new Date(scope.expires - 1))}:${panelFamily(scope.panel)}:${scope.panel}:${scope.window}`;
@@ -102,6 +103,12 @@ export async function admitNewsIntelligencePanel(context: McpAuthContext, budget
   return { ...await admitPanel(context, budget, pipeline, 'news-intelligence', parsed.data, now), panel: 'news-intelligence' };
 }
 
+export async function admitChokepointPanel(context: McpAuthContext, budget: McpBudget | undefined, pipeline: PipelineFn, args: Record<string, unknown>, now = Date.now()): Promise<Chokep
```

**File**: `api/mcp/registry/cache-tools.ts` (modified, +4/-1)
```diff
@@ -2746,10 +2746,13 @@ export const CACHE_TOOLS: ToolDef[] = [
   {
     name: 'get_chokepoint_status',
     _outputBudgetBytes: 131072,
-    description: 'Live maritime chokepoint status: per-chokepoint vessel transit counts (10-min cadence), rolling transit summaries, per-port activity, plus static reference data (chokepoint geometry, canonical 13-chokepoint registry) and flow aggregates. Covers Suez, Hormuz, Malacca, Bab-el-Mandeb, Panama, etc.',
+    description: 'Live maritime chokepoint status: per-chokepoint vessel transit counts (10-min cadence), rolling transit summaries, per-port activity, plus static reference data (chokepoint geometry, canonical 13-chokepoint registry) and flow aggregates. Covers Suez, Hormuz, Malacca, Bab-el-Mandeb, Panama, etc. Paid openings use one signed chokepoint panel allocation; repeated views reuse complete requested source subsets while partial sources remain retryable. Different source subsets may reacquire data under the same allocation. Explicit refresh requires a request_id UUID and spends one new allocation; same-UUID retry is idempotent. API/free accounts retain per-tool accounting.',
     inputSchema: {
       type: 'object',
       properties: {
+        panel_request: { type: 'string', description: 'Signed owner-bound chokepoint reader token from a paid opening. Covers only this tool and its existing filters; cannot be combined with refresh.' },
+        refresh: { type: 'boolean', description: 'Paid allowance only: explicitly request a new panel allocation. Supply a request_id UUID.' },
+        request_id: { type: 'string', description: 'UUID for an explicit paid refresh; retry the same UUID to reuse that allocation.' },
         chokepoint: {
           type: 'string',
           description: 'Filter to one chokepoint — matches by case-insensitive substring across the differing identifiers used by each dataset (e.g. "hormuz" matches "hormuz_strait", "Strait of Hormuz").',
```

**File**: `docs/mcp-apps.mdx` (modified, +8/-0)
```diff
@@ -157,3 +157,11 @@ The docs-stat gate derives the app inventory from `api/mcp/ui/registry.ts` and t
 On Pro and Pro Business, `get_news_intelligence` opens one News Intelligence allocation. Repeated opens, filters, `summary` and JMESPath views reuse the same complete original within the admission window. The returned `panelRequest.token` is a closed `panel_request` for this tool only; news and country receipts cannot authorize it. Explicit refresh uses `refresh: true`, a UUID `request_id`, and no reader token. The same UUID retries that allocation. Authorized receipt reads query current usage without a new allocation; unknown usage omits the numeric notice. API and free-account calls retain ordinary per-tool charging and reject these paid controls.
 
 Reuse uses the existing four dataset GETs and three metadata GETs. It expires at the earliest of the 30/45/60-minute metadata deadlines, the shared 60-minute Insights generation limit, the assessed GDELT content-age deadline, and admission expiry. Advisory publication time is validated, but this source graph has no independent advisory freshness assessment. Missing, degraded, malformed, old, future or unassessed sources remain retryable. Paid reads expose proven stale generation through `stale` and unassessed clocks through `freshnessUnknown`; source values remain intact. The cross-source producer permits an observed empty signal list; empty Insights and advisory bootstrap lists are not reusable. The 64-read limit counts uncached tool executions, not individual Redis GETs. This does not prove complete provider coverage.
+
+### Chokepoint panel admission
+
+On Pro and Pro Business, `get_chokepoint_status` opens one signed `chokepoints` allocation. Repeated filters, `summary` and JMESPath views share that allocation. Complete effective requested source subsets reuse their uncapped originals; changing the normalized dataset subset or chokepoint selector can reacquire sources under the same allocation. Unknown-only dataset selectors use the full bundle. A keyed filter with no match retains the original map, so it cannot manufacture complete empty coverage. Sparse AIS, unavailable today counts and partial modeled flows remain visible and retryable.
+
+Use the returned `panelRequest.token` as `panel_request` only for this tool. Explicit `refresh: true` requires a UUID `request_id` and no reader token; the same UUID retries that allocation. Authorized receipt reads report current usage without reserving another allocation; unknown usage omits the numeric notice. API and free-account calls retain per-tool accounting and reject these paid controls.
+
+An uncached execution uses the existing six dataset GETs, six metadata GETs and one activation EXISTS command. The 64-read admission bound counts tool executions, not those 13 Redis commands. Reuse checks selected source shapes, availability, publication clocks and CN/HK critical content age, both after lookup and before cache storage. Partial, malformed, unassessed or expired originals are not cached as complete. Reference-year baselines and modeled flow publication dates do not prove current metered oil or fresh underlying history. The private wrapped cache remains 512 KiB; tool output remains 128 KiB. This admission change does not add website details, histories, warnings or provider reads.
```

**File**: `docs/mcp-overview.mdx` (modified, +8/-0)
```diff
@@ -627,3 +627,11 @@ Each uncached execution reads three fixed data keys and the existing seismology
 On Pro and Pro Business, `get_news_intelligence` opens one News Intelligence allocation. Repeated opens, filters, `summary` and JMESPath views reuse the same complete original within the admission window. The returned `panelRequest.token` is a closed `panel_request` for this tool only; news and country receipts cannot authorize it. Explicit refresh uses `refresh: true`, a UUID `request_id`, and no reader token. The same UUID retries that allocation. Authorized receipt reads query current usage without a new allocation; unknown usage omits the numeric notice. API and free-account calls retain ordinary per-tool charging and reject these paid controls.
 
 Reuse uses the existing four dataset GETs and three metadata GETs. It expires at the earliest of the 30/45/60-minute metadata deadlines, the shared 60-minute Insights generation limit, the assessed GDELT content-age deadline, and admission expiry. Advisory publication time is validated, but this source graph has no independent advisory freshness assessment. Missing, degraded, malformed, old, future or unassessed sources remain retryable. Paid reads expose proven stale generation through `stale` and unassessed clocks through `freshnessUnknown`; source values remain intact. The cross-source producer permits an observed empty signal list; empty Insights and advisory bootstrap lists are not reusable. The 64-read limit counts uncached tool executions, not individual Redis GETs. This does not prove complete provider coverage.
+
+### Chokepoint panel admission
+
+On Pro and Pro Business, `get_chokepoint_status` opens one signed `chokepoints` allocation. Repeated filters, `summary` and JMESPath views share that allocation. Complete effective requested source subsets reuse their uncapped originals; changing the normalized dataset subset or chokepoint selector can reacquire sources under the same allocation. Unknown-only dataset selectors use the full bundle. A keyed filter with no match retains the original map, so it cannot manufacture complete empty coverage. Sparse AIS, unavailable today counts and partial modeled flows remain visible and retryable.
+
+Use the returned `panelRequest.token` as `panel_request` only for this tool. Explicit `refresh: true` requires a UUID `request_id` and no reader token; the same UUID retries that allocation. Authorized receipt reads report current usage without reserving another allocation; unknown usage omits the numeric notice. API and free-account calls retain per-tool accounting and reject these paid controls.
+
+An uncached execution uses the existing six dataset GETs, six metadata GETs and one activation EXISTS command. The 64-read admission bound counts tool executions, not those 13 Redis commands. Reuse checks selected source shapes, availability, publication clocks and CN/HK critical content age, both after lookup and before cache storage. Partial, malformed, unassessed or expired originals are not cached as complete. Reference-year baselines and modeled flow publication dates do not prove current metered oil or fresh underlying history. The private wrapped cache remains 512 KiB; tool output remains 128 KiB. This admission change does not add website details, histories, warnings or provider reads.
```

**File**: `docs/mcp-tools-reference.mdx` (modified, +11/-0)
```diff
@@ -1954,6 +1954,9 @@ Live maritime chokepoint status: per-chokepoint vessel transit counts (10-min ca
 
 | Name | Type | Description |
 |------|------|-------------|
+| `panel_request` | string | Signed owner-bound chokepoint reader token from a paid opening. Covers only this tool and its existing filters; cannot be combined with refresh. |
+| `refresh` | boolean | Paid allowance only: explicitly request a new panel allocation. Supply a request_id UUID. |
+| `request_id` | string | UUID for an explicit paid refresh; retry the same UUID to reuse that allocation. |
 | `chokepoint` | string | Filter to one chokepoint — matches by case-insensitive substring across the differing identifiers used by each dataset (e.g. "hormuz" matches "hormuz_strait", "Strait of Hormuz"). |
 | `dataset` | `array<string: transit-summaries / chokepoint_transits / _countries / chokepoint-baselines / ref / chokepoint-flows>` | Restrict the response to one or more sub-datasets. Omit for the full bundle. |
 | `limit` | number | Cap the chokepoint-baselines list and the _countries ISO2 index to at most this many items (default 30, pass 0 for no cap). Keyed-object maps (transit-summaries, chokepoint_transits, ref, chokepoint-flows) are intentionally not capped — use the `chokepoint` filter instead. |
@@ -1979,6 +1982,14 @@ curl -s https://worldmonitor.app/mcp \
 
 </CodeGroup>
 
+**Chokepoint panel admission.**
+
+On Pro and Pro Business, `get_chokepoint_status` opens one signed `chokepoints` allocation. Repeated filters, `summary` and JMESPath views share that allocation. Complete effective requested source subsets reuse their uncapped originals; changing the normalized dataset subset or chokepoint selector can reacquire sources under the same allocation. Unknown-only dataset selectors use the full bundle. A keyed filter with no match retains the original map, so it cannot manufacture complete empty coverage. Sparse AIS, unavailable today counts and partial modeled flows remain visible and retryable.
+
+Use the returned `panelRequest.token` as `panel_request` only for this tool. Explicit `refresh: true` requires a UUID `request_id` and no reader token; the same UUID retries that allocation. Authorized receipt reads report current usage without reserving another allocation; unknown usage omits the numeric notice. API and free-account calls retain per-tool accounting and reject these paid controls.
+
+An uncached execution uses the existing six dataset GETs, six metadata GETs and one activation EXISTS command. The 64-read admission bound counts tool executions, not those 13 Redis commands. Reuse checks selected source shapes, availability, publication clocks and CN/HK critical content age, both after lookup and before cache storage. Partial, malformed, unassessed or expired originals are not cached as complete. Reference-year baselines and modeled flow publication dates do not prove current metered oil or fresh underlying history. The private wrapped cache remains 512 KiB; tool output remains 128 KiB. This admission change does not add website details, histories, warnings or provider reads.
+
 ### `get_supply_vulnerabilities`
 
 Returns the reviewed commodity-vulnerability portfolio for one country. Every row includes an absolute score and band when minimum evidence exists, component detail, coverage, stale reasons, source provenance, and `methodologyVersion`. A missing score is unknown, not zero.
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +8/-0)
```diff
@@ -148,3 +148,11 @@ docs-stat 门禁从 `api/mcp/ui/registry.ts` 和工具注册表派生应用清
 在 Pro 和 Pro Business 中，`get_news_intelligence` 打开一次 News Intelligence 面板只消耗一个额度。重复打开、筛选、`summary` 和 JMESPath 视图在授权窗口内复用同一完整原始快照。返回的 `panelRequest.token` 作为 `panel_request` 仅授权此工具；新闻和国家面板凭据不能授权它。显式刷新需设置 `refresh: true`，提供 UUID `request_id`，并省略读取凭据。重试同一 UUID 复用该额度。已授权凭据读取会查询当前用量，不再分配额度；用量未知时不显示数字。API 和免费账户保持逐工具计费，并拒绝这些付费控制参数。
 
 复用仍使用现有四个数据 GET 和三个元数据 GET。有效期取 30/45/60 分钟元数据期限、共享的 60 分钟 Insights 生成期限、已评估的 GDELT 内容年龄期限及面板授权期限的最早值。公告发布时间会验证，但此读取图没有独立的公告新鲜度评估。缺失、降级、格式错误、过期、未来或未评估的来源可以重试。付费读取通过 `stale` 表示已证实的生成时间过期，通过 `freshnessUnknown` 表示未评估的时钟；原始来源值保持不变。跨源生产程序允许已观察的空信号列表；空 Insights 和公告引导列表不可复用。64 次读取上限计算未缓存的工具执行次数，不是单个 Redis GET 次数。这不证明所有提供方的完整覆盖。
+
+### 咽喉要道面板额度
+
+在 Pro 和 Pro Business 中，`get_chokepoint_status` 打开一次签名的 `chokepoints` 面板只消耗一个额度。重复筛选、`summary` 和 JMESPath 视图共享该额度。实际请求的来源子集完整时复用未截断的原始数据；规范化数据集子集或咽喉筛选变化时，可在同一额度内重新获取来源。仅含未知名称的数据集选择器使用完整数据包。键控筛选未匹配时保留原映射，不能制造完整空覆盖。稀疏 AIS、不可用的今日计数和部分建模流量保持可见且可重试。
+
+返回的 `panelRequest.token` 作为 `panel_request` 仅授权此工具。显式 `refresh: true` 需要 UUID `request_id`，并省略读取凭据；同一 UUID 的重试复用该额度。已授权凭据读取会查询当前用量，不再分配额度；用量未知时不显示数字。API 和免费账户保持逐工具计费，并拒绝这些付费控制参数。
+
+每次未缓存执行仍使用六个数据 GET、六个元数据 GET 和一个激活 EXISTS 命令。64 次读取限制按工具执行计数，不按这 13 个 Redis 命令计数。复用在缓存查询后和保存前验证所选来源形状、可用性、发布时间以及 CN/HK 关键内容时效。部分、格式错误、未经评估或过期的原始数据不会作为完整数据缓存。基准参考年份和建模流量发布时间不能证明当前实测油流或底层历史的新鲜度。私有封装缓存仍为 512 KiB，工具输出仍为 128 KiB。此额度修改不增加网站详情、历史、警告或提供商读取。
```

---

### Incident Patch 10: `43be28f5` (2026-10-05)
**Commit Message**: fix(plugin): restore projected Chokepoint records (#8845)

* test(mcp): reproduce chokepoint projected result loss

* fix(mcp): preserve projected chokepoint monitor data

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Elie Habib <[REDACTED_EMAIL]>

**File**: `api/mcp/ui/chokepoint-monitor-app.ts` (modified, +15/-6)
```diff
@@ -43,7 +43,10 @@ const BODY = `
 
 const RENDER = `
     if (!data || typeof data !== "object") return;
-    var d = data.data && typeof data.data === "object" ? data.data : data;
+    var value = Object.prototype.hasOwnProperty.call(data, "projection") ? data.projection : data;
+    var envelope = value && typeof value === "object" && !Array.isArray(value) ? value : {};
+    var d = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
+      ? envelope.data : envelope;
     q("empty").style.display = "none";
     q("card").style.display = "block";
 
@@ -72,11 +75,17 @@ const RENDER = `
     var host = q("rows");
     host.textContent = "";
     var count = 0;
-    if (summaries && typeof summaries === "object") {
+    var keySummary = summaries && typeof summaries === "object" && Array.isArray(summaries.sample_keys);
+    if (keySummary) {
+      var reported = summaries.count;
+      var knownCount = typeof reported === "number" && Number.isFinite(reported) && Number.isInteger(reported) && reported >= summaries.sample_keys.length;
+      host.appendChild(el("div", "empty", (knownCount ? "Summary reports " + reported + " chokepoints." : "Summary count is unavailable.") +
+        " Transit records are not loaded."));
+    } else if (summaries && typeof summaries === "object" && !Array.isArray(summaries)) {
       var keys = Object.keys(summaries);
       for (var i = 0; i < keys.length && count < 20; i++) {
         var s = summaries[keys[i]];
-        if (!s || typeof s !== "object") continue;
+        if (!s || typeof s !== "object" || Array.isArray(s)) continue;
         var historyMissing = s.dataAvailable === false;
         var row = el("div", "crow");
         var head = el("div", "crow-head");
@@ -105,10 +114,10 @@ const RENDER = `
         count++;
       }
     }
-    if (!count) host.appendChild(el("div", "empty", "No chokepoint transit data available."));
+    if (!count && !keySummary) host.appendChild(el("div", "empty", "No chokepoint transit data available."));
 
-    q("foot").textContent = data.cached_at
-      ? "Snapshot: " + collapseWs(data.cached_at) + (data.stale ? " (stale)" : "")
+    q("foot").textContent = envelope.cached_at
+      ? "Snapshot: " + collapseWs(envelope.cached_at) + (envelope.stale ? " (stale)" : "")
       : "";
 `;
 
```

**File**: `api/mcp/ui/registry.ts` (modified, +5/-3)
```diff
@@ -43,7 +43,8 @@ export const COUNTRY_RISK_UI_URI = 'ui://worldmonitor/country-risk.html';
 export const WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief.html';
 export const COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief.html';
 export const MARKET_RADAR_UI_URI = 'ui://worldmonitor/market-radar-v3.html';
-export const CHOKEPOINT_MONITOR_UI_URI = 'ui://worldmonitor/chokepoint-monitor.html';
+export const CHOKEPOINT_MONITOR_UI_URI = 'ui://worldmonitor/chokepoint-monitor-v2.html';
+const LEGACY_CHOKEPOINT_MONITOR_UI_URI = 'ui://worldmonitor/chokepoint-monitor.html';
 export const NEWS_INTELLIGENCE_UI_URI = 'ui://worldmonitor/news-intelligence-v2.html';
 const LEGACY_NEWS_INTELLIGENCE_UI_URI = 'ui://worldmonitor/news-intelligence.html';
 export const CONFLICT_EVENTS_UI_URI = 'ui://worldmonitor/conflict-events-v2.html';
@@ -176,7 +177,7 @@ export const UI_RESOURCE_REGISTRY: UiResourceDef[] = [
 const UI_RESOURCE_BY_URI = new Map(UI_RESOURCE_REGISTRY.map((r) => [r.uri, r]));
 
 export function isUiResourceUri(uri: string): boolean {
-  return uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
+  return uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI || uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
 }
 
 // resources/list public shape — {uri, name, description, mimeType} plus the
@@ -210,7 +211,8 @@ export async function buildUiResourceRead(
   if (uri === MARKET_RADAR_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI) return readMarketRadar(id, corsHeaders, uri);
   if (uri === COUNTRY_VIEW_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI) return readCountryView(id, corsHeaders, uri);
   if (uri === NEWS_DASHBOARD_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI) return readNewsDashboard(id, corsHeaders, uri);
-  const canonicalUri = uri === LEGACY_NEWS_INTELLIGENCE_UI_URI ? NEWS_INTELLIGENCE_UI_URI
+  const canonicalUri = uri === LEGACY_CHOKEPOINT_MONITOR_UI_URI ? CHOKEPOINT_MONITOR_UI_URI
+    : uri === LEGACY_NEWS_INTELLIGENCE_UI_URI ? NEWS_INTELLIGENCE_UI_URI
     : uri === LEGACY_CONFLICT_EVENTS_UI_URI ? CONFLICT_EVENTS_UI_URI
     : uri === LEGACY_NATURAL_DISASTERS_UI_URI ? NATURAL_DISASTERS_UI_URI
     : (uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI) ? PREDICTION_MARKETS_UI_URI
```

**File**: `docs/mcp-apps.mdx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ Three discovery signals must stay aligned:
 | `ui://worldmonitor/world-brief.html` | `get_world_brief` | World Brief (interactive) | Precomputed citation-grounded global brief, grounding headlines, and source feed articles. |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | Country Brief (interactive) | Per-country intelligence brief, analytical framework lens, and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Market Radar (interactive) | Fear & Greed plus all loaded quote rows, asset names and expandable intraday charts from the same snapshot. |
-| `ui://worldmonitor/chokepoint-monitor.html` | `get_chokepoint_status` | Chokepoint Monitor (interactive) | Per-chokepoint transit summaries, week-over-week change, tanker split, and risk-level badge. |
+| `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | Chokepoint Monitor (interactive) | Per-chokepoint transit summaries, week-over-week change, tanker split, and risk-level badge. |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | News Intelligence (interactive) | AI-classified top stories with category, alert flag, country, source provenance, snapshot status and explicit loaded/sample counts. |
 | `ui://worldmonitor/conflict-events-v2.html` | `get_conflict_events` | Conflict Events (interactive) | Active armed-conflict events (belligerents, violence type, country, fatalities, date) from UCDP. |
 | `ui://worldmonitor/natural-disasters-v2.html` | `get_natural_disasters` | Natural Disasters (interactive) | Recent M4.5+ earthquakes (USGS and Earthquakes Canada / NRCan: magnitude, place, time, source) and active wildfires (NASA FIRMS), grouped. |
```

**File**: `docs/mcp-overview.mdx` (modified, +1/-1)
```diff
@@ -513,7 +513,7 @@ The server supports [MCP Apps](https://modelcontextprotocol.io/extensions/apps/b
 | `ui://worldmonitor/world-brief.html` | `get_world_brief` | The precomputed, citation-grounded global intelligence brief as readable paragraphs, plus grounding headlines and source articles. |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | The AI-synthesised per-country brief as paragraphs, with the analytical framework lens and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed plus all loaded equity, commodity, crypto, Gulf and sector quotes, asset names and expandable intraday charts. |
-| `ui://worldmonitor/chokepoint-monitor.html` | `get_chokepoint_status` | Per-chokepoint rolling transit summaries (today's count, week-over-week change, tanker split) with a risk-level badge. |
+| `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | Per-chokepoint rolling transit summaries (today's count, week-over-week change, tanker split) with a risk-level badge. |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | AI-classified top stories with category, alert flag, country, and source. |
 | `ui://worldmonitor/conflict-events-v2.html` | `get_conflict_events` | Active armed-conflict events (belligerents, violence type, country, fatalities, date) from the UCDP feed. |
 | `ui://worldmonitor/natural-disasters-v2.html` | `get_natural_disasters` | Recent M4.5+ earthquakes (USGS and Earthquakes Canada / NRCan: magnitude, place, time, source) and active wildfires (NASA FIRMS), grouped. |
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 | `ui://worldmonitor/world-brief.html` | `get_world_brief` | 世界简报（交互式） | AI 摘要的全球简报、支撑性头条新闻和信息源文章。 |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | 国家简报（交互式） | 按国家划分的情报简报、分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | 市场雷达（交互式） | 恐惧贪婪综合指数，以及股票、大宗商品、加密货币、海湾地区和行业报价表，附带带符号、颜色编码的涨跌。 |
-| `ui://worldmonitor/chokepoint-monitor.html` | `get_chokepoint_status` | 咽喉要道监视器（交互式） | 按咽喉要道划分的通行摘要、周环比变化、油轮构成和风险等级徽章。 |
+| `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | 咽喉要道监视器（交互式） | 按咽喉要道划分的通行摘要、周环比变化、油轮构成和风险等级徽章。 |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | 新闻情报（交互式） | AI 分类的头条报道，附带类别、警报标记、国家、来源背景、快照状态，以及明确的已加载或样本数量。 |
 | `ui://worldmonitor/conflict-events-v2.html` | `get_conflict_events` | 冲突事件（交互式） | 来自 UCDP 的活跃武装冲突事件（交战方、暴力类型、国家、死亡人数、日期）。 |
 | `ui://worldmonitor/natural-disasters-v2.html` | `get_natural_disasters` | 自然灾害（交互式） | 近期 M4.5+ 地震（USGS 与加拿大地震局 / NRCan：震级、地点、时间、来源）和活跃野火（NASA FIRMS），分组展示。 |
```

**File**: `docs/zh/mcp-overview.mdx` (modified, +1/-1)
```diff
@@ -487,7 +487,7 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 | `ui://worldmonitor/world-brief.html` | `get_world_brief` | 以可读段落呈现的预计算、有引用依据的全球情报简报，外加支撑性头条和来源文章。 |
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | 以段落呈现的 AI 合成各国简报，附带分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed 综合指标，外加各资产类别的报价表（股票、大宗商品、加密货币、海湾、板块），带有带符号、色彩编码的涨跌。 |
-| `ui://worldmonitor/chokepoint-monitor.html` | `get_chokepoint_status` | 各咽喉要道的滚动过境摘要（今日计数、周环比变化、油轮占比），并带有风险级别标记。 |
+| `ui://worldmonitor/chokepoint-monitor-v2.html` | `get_chokepoint_status` | 各咽喉要道的滚动过境摘要（今日计数、周环比变化、油轮占比），并带有风险级别标记。 |
 | `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | AI 分类的热门报道，带有类别、警报标记、国家和来源。 |
 | `ui://worldmonitor/conflict-events-v2.html` | `get_conflict_events` | 来自 UCDP 源的活跃武装冲突事件（交战方、暴力类型、国家、伤亡、日期）。 |
 | `ui://worldmonitor/natural-disasters-v2.html` | `get_natural_disasters` | 近期地震（USGS 震级、地点、时间）和活跃野火（NASA FIRMS），分组显示。 |
```

**File**: `public/.well-known/mcp/server-card.json` (modified, +2/-2)
```diff
@@ -742,7 +742,7 @@
         "ui://worldmonitor/world-brief.html",
         "ui://worldmonitor/country-brief.html",
         "ui://worldmonitor/market-radar-v3.html",
-        "ui://worldmonitor/chokepoint-monitor.html",
+        "ui://worldmonitor/chokepoint-monitor-v2.html",
         "ui://worldmonitor/news-intelligence-v2.html",
         "ui://worldmonitor/conflict-events-v2.html",
         "ui://worldmonitor/natural-disasters-v2.html",
@@ -751,7 +751,7 @@
         "ui://worldmonitor/news-dashboard-v3.html",
         "ui://worldmonitor/country-view-v3.html"
       ],
-      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk.html, get_world_brief → world-brief.html, get_country_brief → country-brief.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
+      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk.html, get_world_brief → world-brief.html, get_country_brief → country-brief.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor-v2.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
     }
   },
   "features": {
```

**File**: `public/mcp-server.md` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ World Monitor supports MCP Apps (`io.modelcontextprotocol/ui`) with interactive
 - `ui://worldmonitor/world-brief.html`
 - `ui://worldmonitor/country-brief.html`
 - `ui://worldmonitor/market-radar-v3.html`
-- `ui://worldmonitor/chokepoint-monitor.html`
+- `ui://worldmonitor/chokepoint-monitor-v2.html`
 - `ui://worldmonitor/news-intelligence-v2.html`
 - `ui://worldmonitor/conflict-events-v2.html`
 - `ui://worldmonitor/natural-disasters-v2.html`
```

---

### Incident Patch 11: `c77485da` (2026-10-05)
**Commit Message**: fix(plugin): reuse News Intelligence under one panel allocation (#8844)

* test(mcp): cover curated market panel admission

* feat(mcp): admit curated market panels once per opening

* test(mcp): cover uppercase panel refresh UUIDs

* fix(mcp): canonicalize panel refresh UUID case

* docs(mcp): describe curated market panel accounting

* test(mcp): reproduce missing market receipt usage metadata

* fix(mcp): preserve current usage on authorized market receipt results

* test(mcp): keep ordinary quota probes on a non-panel tool

* test(mcp): preserve ordinary quota lifecycle coverage

* test: reproduce prediction panel accounting and receipt failures

* fix: share paid prediction panel allocation across filters and reads

* test: reproduce unavailable prediction replay and pin bounded output

* fix: keep unavailable prediction snapshots retryable

* test: reject unknown prediction replay envelopes

* fix: preserve unknown prediction envelopes as retryable

* docs(mcp): describe prediction panel reuse and refresh

* docs(mcp): align prediction parameter table with schema

* test(mcp): reproduce selected prediction cache masking source health

* fix(mcp): retain prediction source heal

**File**: `api/mcp/_news-intelligence-snapshot.ts` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+import { insightsSnapshotRejection, INSIGHTS_MAX_AGE_MS } from '../../shared/insights-snapshot.js';
+import { normalizeAdvisorySnapshot, normalizeGdeltTopicSnapshot } from '../../shared/intelligence-snapshots.js';
+// @ts-expect-error — existing Edge-safe JavaScript module has no declaration.
+import { assessContentAge } from '../_content-age.js';
+
+export type NewsIntelligencePanelRead = { value: unknown; reuseUntil: number | null };
+const SOURCE_MAX_AGE_MS = [30, 45, 60].map(minutes => minutes * 60_000);
+
+function record(value: unknown): value is Record<string, unknown> {
+  return value !== null && typeof value === 'object' && !Array.isArray(value);
+}
+function clock(value: unknown, now: number): number | null {
+  const stamp = typeof value === 'string' ? Date.parse(value) : value;
+  return typeof stamp === 'number' && Number.isSafeInteger(stamp) && stamp > 0 && stamp <= now ? stamp : null;
+}
+function failed(value: Record<string, unknown>): boolean {
+  return Boolean(value.error) || value.status === 'error' || ['unavailable', 'upstreamUnavailable', 'degraded', 'stale', 'rateLimited', 'fallback'].some(key => value[key] === true)
+    || value.dataAvailable === false
+    || ['error', 'errorCode', 'errorReason', 'skipReason'].some(key => typeof value[key] === 'string' && value[key] !== '')
+    || value.sourceState !== undefined && value.sourceState !== 'ok'
+    || Array.isArray(value.failedSources) && value.failedSources.length > 0;
+}
+
+export function validNewsIntelligenceOriginal(data: unknown, now: number): data is Record<string, unknown> {
+  if (!record(data)) return false;
+  const insights = data.insights;
+  const gdelt = data['gdelt-intel'];
+  const signals = data['cross-source-signals'];
+  const advisories = data['advisories-bootstrap'];
+  if (![insights, gdelt, signals, advisories].every(value => record(value) && !failed(value))) return false;
+  if (!record(insights) || insights.status !== 'ok' || insightsSnapshotRejection(insights, now) !== null
+    || !(insights.topStories as unknown[]).every(story => record(story) && typeof story.primaryTitle === 'string' && story.primaryTitle.trim() !== '' && typeof story.primarySource === 'string' && story.primarySource.trim() !== '')) return false;
+  const normalizedGdelt = normalizeGdeltTopicSnapshot(gdelt);
+  if (!normalizedGdelt || !record(gdelt)
+    || normalizedGdelt.topics.some((topic: { articles: unknown[] }, index: number) => topic.articles.length !== (gdelt.topics as { articles: unknown[] }[])[index]!.articles.length)) return false;
+  if (!record(signals) || !Array.isArray(signals.signals) || !signals.signals.every(record) || clock(signals.evaluatedAt, now) === null) return false;
+  const normalizedAdvisories = normalizeAdvisorySnapshot(advisories);
+  return !!normalizedAdvisories && record(advisories) && normalizedAdvisories.advisories.length > 0
+    && normalizedAdvisories.advisories.length === (advisories.advisories as unknown[]).length
+    && clock(advisories.fetchedAt, now) !== null;
+}
+
+export function newsIntelligenceFreshness(data: Record<string, unknown>, seeds: unknown[], metas: unknown[], now: number): { stale: boolean; freshnessUnknown: boolean } {
+  const rejection = insightsSnapshotRejection(data.insights, now);
+  let stale = rejection === 'stale-snapshot';
+  let freshnessUnknown = rejection !== null && rejection !== 'stale-snapshot';
+  const content = assessContentAge(metas[1], now);
+  if (!content || !Number.isFinite(content.maxContentAgeMin) || content.maxContentAgeMin <= 0 || clock(content.newestItemAt, now) === null) freshnessUnknown = true;
+  else stale ||= content.contentStale;
+  for (const meta of metas) {
+    if (!record(meta) || clock(meta.fetchedAt, now) === null) freshnessUnknown = true;
+    if (record(meta) && failed(meta)) stale = true;
+  }
+  for (const [label, field] of [['cross-source-signals', 'evaluatedAt'], ['advisories-bootstrap', 'fetchedAt']] as const) {
+    const bucket = data[label];
+    if (!record(bucket) || clock(bucket[field], now) === null) freshnessUnknown = true;
+  }
+  const signals = data['cross-source-signals'];
+  const evaluatedAt = record(signals) ? clock(signals.evaluatedAt, now) : null;
+  if (evaluatedAt !== null) stale ||= now >= evaluatedAt + SOURCE_MAX_AGE_MS[2]!;
+  for (const [index, seed] of seeds.entries()) {
+    if (seed === null || seed === undefined) continue;
+    if (!record(seed)) { freshnessUnknown = true; continue; }
+    if (seed.state === 'ERROR' || failed(seed)
+      || typeof seed.errorReason === 'string' && seed.errorReason !== ''
+      || Array.isArray(seed.failedDatasets) && seed.failedDatasets.length > 0) stale = true;
+    else if (!['OK', 'OK_ZERO'].includes(String(seed.state))) freshnessUnknown = true;
+    const publishedAt = clock(seed.fetchedAt, now);
+    if (publishedAt === null) freshnessUnknown = true;
+    else if (SOURCE_MAX_AGE_MS[index] !== undefined) stale ||= now >= publishedAt + SOURCE_MAX_A
```

**File**: `api/mcp/dispatch.ts` (modified, +62/-14)
```diff
@@ -2,6 +2,8 @@ import { buildAttributionRider, mergeAttributionRider } from '../../shared/attri
 import { readExistsFlags, readJsonFromUpstash, readRawJsonFromUpstash, redisPipeline } from '../_upstash-json.js';
 // @ts-expect-error — Edge-safe JS envelope mirror.
 import { unwrapEnvelope } from '../_seed-envelope.js';
+import { newsIntelligenceFreshness, newsIntelligenceReuseUntil, type NewsIntelligencePanelRead } from './_news-intelligence-snapshot';
+import { resolveCountryFilter } from './_country-args';
 import { filterNaturalDisastersPanelData, naturalDisastersReuseUntil, type NaturalDisastersPanelRead } from './_natural-disasters-reuse';
 import { isAppOwnedRedisKey } from '../_redis-key-ownership.js';
 // @ts-expect-error — JS module, no declaration file
@@ -18,9 +20,9 @@ import { mcpErrorFingerprint } from './error-fingerprint';
 import { argBool, summarizeData } from './filters';
 import { evaluateFreshness } from './freshness';
 import { applyJmespath } from './jmespath';
-import { admitConflictPanel, admitCountryPanel, admitDisasterPanel, admitForecastPanel, admitMarketPanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
+import { admitConflictPanel, admitCountryPanel, admitDisasterPanel, admitForecastPanel, admitMarketPanel, admitNewsIntelligencePanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
-import { conflictPanelViewSchema, disasterPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
+import { conflictPanelViewSchema, disasterPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
 import { isSharedRestCounter, readDailyAllowance, reserveQuota, resolveDailyLimit, type McpBudget } from './quota';
 import { reserveFreeAccountAllowance } from './free-account-allowance';
 import { buildMcpStructuredDenial, type McpDenial } from './upgrade';
@@ -78,11 +80,18 @@ export async function executeNaturalDisastersPanelRead(params: Record<string, un
   return executeCacheTool(tool, params, undefined, 'natural-disasters');
 }
 
+export async function executeNewsIntelligencePanelRead(): Promise<NewsIntelligencePanelRead> {
+  const tool = TOOL_REGISTRY.find(tool => tool.name === 'get_news_intelligence')! as CacheToolDef;
+  return executeCacheTool(tool, {}, undefined, 'news-intelligence');
+}
+
+type CachePanelDomain = 'natural-disasters' | 'news-intelligence';
+
 async function executeCacheTool(
   tool: CacheToolDef,
   params: Record<string, unknown>,
   now?: number,
-  panel?: 'natural-disasters',
+  panel?: CachePanelDomain,
   execution?: McpToolExecutionContext,
 ): Promise<{ value: CacheToolValue; reuseUntil: number | null }> {
   // Per-key namespace decision (#7674): most _cacheKeys / freshness keys are
@@ -97,7 +106,7 @@ async function executeCacheTool(
   // key failed the whole tool as a raw TimeoutError (WORLDMONITOR-176/ZM/137),
   // while folding the failure into null would read an unreadable seed-meta as
   // "never seeded" and an unreadable data key as an empty section.
-  const reads = tool._cacheKeys.map((k) => settleRead((panel === 'natural-disasters' ? readRawJsonFromUpstash : readJsonFromUpstash)(k, 3_000, !isAppOwnedRedisKey(k))));
+  const reads = tool._cacheKeys.map((k) => settleRead((panel !== undefined ? readRawJsonFromUpstash : readJsonFromUpstash)(k, 3_000, !isAppOwnedRedisKey(k))));
   const freshnessChecks = tool._freshnessChecks;
   const metaReads = freshnessChecks.map((check) => settleRead(readJsonFromUpstash(check.key, 3_000, !isAppOwnedRedisKey(check.key))));
   // #6080 deployment-order grace. Only checks declaring a content contract pay
@@ -126,7 +135,7 @@ async function executeCacheTool(
     activationRead,
   ]);
   const unwrapped: Array<{ _seed: unknown; data: unknown }> = dataReads.map(r => unwrapEnvelope(r.ok ? r.value : null));
-  const results = dataReads.map((r, index) => (r.ok ? panel === 'natural-disasters' ? unwrapped[index]!.data : r.value : null));
+  const results = dataReads.map((r, index) => (r.ok ? panel !== undefined ? unwrapped[index]!.data : r.value : null));
   // An unreadable seed-meta enters evaluateFreshness as null, so `stale` fails
   // closed exactly as for an unreadable activation marker; `freshnessUnknown`
   // is what tells the caller the verdict rests on a read that failed.
@@ -214,7 +223,7 @@ async function executeCacheTool(
 
   const reuseUntil = panel === 'natural-disasters'
     ? naturalDisastersReuseUntil(data, Object.fromEntries(labels.map((label, index) => [label, unwrapped[index]!._seed])), metas[0], params, evaluatedAt)
-    : nu
```

**File**: `api/mcp/panel-requests.ts` (modified, +34/-9)
```diff
@@ -2,12 +2,13 @@ import { countryActivityQueries } from '../../shared/country-activity-query';
 import { z } from 'zod';
 import { countryReaderSchema, COUNTRY_READERS, countryViewSchema, type PanelAdmission } from '../../shared/country-brief-host';
 import { resolveCountryCode } from '../../shared/country-code-resolve';
-import { conflictPanelReadSchema, conflictPanelViewSchema, disasterPanelReadSchema, disasterPanelViewSchema, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ConflictPanelAdmission, type DisasterPanelAdmission, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
+import { conflictPanelReadSchema, conflictPanelViewSchema, disasterPanelReadSchema, disasterPanelViewSchema, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, newsIntelligencePanelReadSchema, newsIntelligencePanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ConflictPanelAdmission, type DisasterPanelAdmission, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsIntelligencePanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
 import { forecastTheaterReadSchema, reusableForecastTheaterResult } from '../../shared/forecast-theaters';
 import { iso2ToComtradeReporterCode, iso2ToUnCode } from '../../shared/country-numeric-codes';
 import { PANEL_REQUEST_READ_SCRIPT, PANEL_REQUEST_RESERVE_SCRIPT } from '../../shared/panel-request-scripts.mjs';
 import { dailyCounterKey, dailyQuotaFloorKey, envPrefix, PRO_DAILY_QUOTA_TTL_SECONDS } from '../../server/_shared/pro-mcp-token';
+import { validNewsIntelligenceCache, type NewsIntelligencePanelRead } from './_news-intelligence-snapshot';
 import type { NaturalDisastersPanelRead } from './_natural-disasters-reuse';
 import { conflictPanelReuseUntil, isConflictPanelSnapshotCacheable } from './registry/cache-tools';
 import { resolveDailyLimit, type McpBudget } from './quota';
@@ -19,7 +20,7 @@ const MAX_CACHED_BYTES = 524288;
 const encoder = new TextEncoder();
 
 type PanelScope = { panel: string; window: string; expires: number };
-export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission | DisasterPanelAdmission;
+export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission | DisasterPanelAdmission | NewsIntelligencePanelAdmission;
 export class PanelRequestError extends Error {
   constructor(message: string, public code: 'invalid' | 'quota' | 'reads' | 'backend', public limit?: number, public retryAfter?: number) {
     super(message);
@@ -31,8 +32,8 @@ function userId(context: McpAuthContext): string {
   if (context.kind !== 'pro' && context.kind !== 'user_key') throw new PanelRequestError('A paid user-bound connection is required.', 'invalid');
   return context.userId;
 }
-function panelFamily(panel: string): 'country' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' | 'disasters' {
-  return panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' || panel === 'disasters' ? panel : 'country';
+function panelFamily(panel: string): 'country' | 'news-intelligence' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' | 'disasters' {
+  return panel === 'news-intelligence' || panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' || panel === 'disasters' ? panel : 'country';
 }
 function panelKey(owner: string, scope: PanelScope): string {
   return `${dailyCounterKey(owner, new Date(scope.expires - 1))}:${panelFamily(scope.panel)}:${scope.panel}:${scope.window}`;
@@ -95,6 +96,12 @@ export async function admitDisasterPanel(context: McpAuthContext, budget: McpBud
   return { ...await admitPanel(context, budget, pipeline, 'disasters', parsed.data, now), panel: 'disasters' };
 }
 
+export async function admitNewsIntelligencePanel(context: McpAuthContext, budget: McpBudget | undefined, pipeline: PipelineFn, args: Record<string, unknown>, now = Date.now()): Promise<NewsIntelligencePanelAdmission> {
+  const parsed = newsIntelligencePanelViewSchema.safeParse(args);
+  if (!parsed.success) throw new PanelRequestError('Supply valid news intelligence filters and a request_id for refresh.', 'invalid');
+  return { ...await admitPanel(context, budget, pipeline, 'news-intelligence', parsed.data, now), panel: 'news-intelligence' };
+}
+
 async function admitPanel(context: McpAuthCon
```

**File**: `api/mcp/registry/cache-tools.ts` (modified, +4/-1)
```diff
@@ -1118,10 +1118,13 @@ export const CACHE_TOOLS: ToolDef[] = [
     name: 'get_news_intelligence',
     _uiResourceUri: NEWS_INTELLIGENCE_UI_URI,
     _outputBudgetBytes: 131072,
-    description: 'AI-classified geopolitical threat news summaries, GDELT intelligence signals, cross-source signals including physical-premium regime transitions, and security advisories from WorldMonitor\'s intelligence layer. Each top story carries full corroboration metadata — uniqueSourceCount, corroborationSourceCount, entityCorroboration, sourceTier, the contributing outlet names, every clustered headline, credibilityScore (0-100 source reliability, distinct from importance), corroboration, and the publishers roster with each publisher\'s declared tier; corroboration.state (single-publisher, tier4-only, corroborated, unknown) describes coverage, not accuracy.',
+    description: 'AI-classified geopolitical threat news summaries, GDELT intelligence signals, cross-source signals including physical-premium regime transitions, and security advisories from WorldMonitor\'s intelligence layer. Each top story carries full corroboration metadata — uniqueSourceCount, corroborationSourceCount, entityCorroboration, sourceTier, the contributing outlet names, every clustered headline, credibilityScore (0-100 source reliability, distinct from importance), corroboration, and the publishers roster with each publisher\'s declared tier; corroboration.state (single-publisher, tier4-only, corroborated, unknown) describes coverage, not accuracy. Paid News Intelligence panels charge one opening allocation; repeat and filters reuse a closed source-bounded admission.',
     inputSchema: {
       type: 'object',
       properties: {
+        panel_request: { type: 'string', maxLength: 160, description: 'Server-issued closed News Intelligence panel token. Omit for a paid opening; repeat and filters reuse its original source snapshot.' },
+        refresh: { type: 'boolean', description: 'Paid panel only. Explicitly open a new allocation without panel_request and with a UUID request_id.' },
+        request_id: { type: 'string', format: 'uuid', description: 'Refresh identity. Retrying the same UUID reuses that allocation.' },
         topic: {
           type: 'string',
           enum: ['conflict', 'economy', 'cyber', 'nuclear', 'intelligence', 'maritime'],
```

**File**: `docs/mcp-apps.mdx` (modified, +6/-0)
```diff
@@ -151,3 +151,9 @@ The docs-stat gate derives the app inventory from `api/mcp/ui/registry.ts` and t
 | `api/mcp/handler.ts` | Public `ui://` read promotion, `resources/list`, `resources/read`, and `initialize` capability advertisement. |
 | `public/.well-known/mcp/server-card.json` | Static pre-connection discovery metadata for scanners and agents. |
 | `scripts/docs-stats.mjs` | Drift guard for docs, server-card metadata, navigation, and app inventory. |
+
+### News Intelligence panel admission
+
+On Pro and Pro Business, `get_news_intelligence` opens one News Intelligence allocation. Repeated opens, filters, `summary` and JMESPath views reuse the same complete original within the admission window. The returned `panelRequest.token` is a closed `panel_request` for this tool only; news and country receipts cannot authorize it. Explicit refresh uses `refresh: true`, a UUID `request_id`, and no reader token. The same UUID retries that allocation. Authorized receipt reads query current usage without a new allocation; unknown usage omits the numeric notice. API and free-account calls retain ordinary per-tool charging and reject these paid controls.
+
+Reuse uses the existing four dataset GETs and three metadata GETs. It expires at the earliest of the 30/45/60-minute metadata deadlines, the shared 60-minute Insights generation limit, the assessed GDELT content-age deadline, and admission expiry. Advisory publication time is validated, but this source graph has no independent advisory freshness assessment. Missing, degraded, malformed, old, future or unassessed sources remain retryable. Paid reads expose proven stale generation through `stale` and unassessed clocks through `freshnessUnknown`; source values remain intact. The cross-source producer permits an observed empty signal list; empty Insights and advisory bootstrap lists are not reusable. The 64-read limit counts uncached tool executions, not individual Redis GETs. This does not prove complete provider coverage.
```

**File**: `docs/mcp-overview.mdx` (modified, +6/-0)
```diff
@@ -621,3 +621,9 @@ Triage from the outside in: HTTP status → JSON-RPC code → soft envelope. The
 On Pro and Pro Business, `get_natural_disasters` opens one Natural Disasters allocation. Repeated opens and dataset, magnitude, activity and limit filters reuse that admission within five minutes. Use its returned `panelRequest.token` as `panel_request` for bounded reads. Explicit refresh needs `refresh: true`, a UUID `request_id`, and no reader token; the same UUID retries the refresh allocation. API and free-account callers keep ordinary per-tool charging and existing filter coercions, and reject the paid refresh controls.
 
 Each uncached execution reads three fixed data keys and the existing seismology metadata key as one logical read within the 64-read admission. Exact successful filtered originals replay before summary or JMESPath only until the earliest observable source or EONET retention deadline. A new filter or unavailable, malformed, known degraded or unknown-clock observation can reread under the same allocation. Blocked regional source decisions remain readable but uncached, including zero-request preflight decisions. This does not establish complete provider coverage. The existing news token still permits only its exact hazard dataset list and limits 100, 20 or 1; it cannot use standalone magnitude or activity filters. Source data and internal deadlines do not add public metadata fields. Confirmed current usage accompanies authorized reads; an unknown counter omits the numeric notice.
+
+### News Intelligence panel admission
+
+On Pro and Pro Business, `get_news_intelligence` opens one News Intelligence allocation. Repeated opens, filters, `summary` and JMESPath views reuse the same complete original within the admission window. The returned `panelRequest.token` is a closed `panel_request` for this tool only; news and country receipts cannot authorize it. Explicit refresh uses `refresh: true`, a UUID `request_id`, and no reader token. The same UUID retries that allocation. Authorized receipt reads query current usage without a new allocation; unknown usage omits the numeric notice. API and free-account calls retain ordinary per-tool charging and reject these paid controls.
+
+Reuse uses the existing four dataset GETs and three metadata GETs. It expires at the earliest of the 30/45/60-minute metadata deadlines, the shared 60-minute Insights generation limit, the assessed GDELT content-age deadline, and admission expiry. Advisory publication time is validated, but this source graph has no independent advisory freshness assessment. Missing, degraded, malformed, old, future or unassessed sources remain retryable. Paid reads expose proven stale generation through `stale` and unassessed clocks through `freshnessUnknown`; source values remain intact. The cross-source producer permits an observed empty signal list; empty Insights and advisory bootstrap lists are not reusable. The 64-read limit counts uncached tool executions, not individual Redis GETs. This does not prove complete provider coverage.
```

**File**: `docs/mcp-tools-reference.mdx` (modified, +7/-0)
```diff
@@ -1331,6 +1331,9 @@ AI-classified geopolitical threat news summaries, GDELT intelligence signals, cr
 
 | Name | Type | Description |
 |------|------|-------------|
+| `panel_request` | string | Server-issued closed News Intelligence panel token. Omit for a paid opening; repeat and filters reuse its original source snapshot. |
+| `refresh` | boolean | Paid panel only. Explicitly open a new allocation without panel_request and with a UUID request_id. |
+| `request_id` | string | Refresh identity. Retrying the same UUID reuses that allocation. |
 | `topic` | string: conflict / economy / cyber / nuclear / intelligence / maritime | Filter GDELT intelligence to a single topic. |
 | `category` | string | Filter top news stories to one category (e.g. "conflict", "economy"; fallback is "general"). |
 | `country` | string | Filter top stories and travel advisories to one ISO 3166-1 alpha-2 country code (case-insensitive). Country names and alpha-3 codes are accepted; unresolved inputs return Invalid params. |
@@ -1345,6 +1348,10 @@ AI-classified geopolitical threat news summaries, GDELT intelligence signals, cr
 - **Corroboration:** every top story carries `uniqueSourceCount`, `corroborationSourceCount`, `entityCorroboration`, `sourceTier`, the contributing outlet names in `sources`, and every clustered headline in `memberTitles`, alongside `lastUpdated`, `upstreamImportanceScore`, `effectiveImportanceScore`, and `credibilityScore` (0-100 source reliability, distinct from importance; state-controlled media is capped at 40).
 - **Freshness budget:** per slice — news insights **30 min**, GDELT intel **45 min**, cross-source signals **60 min**. The single `stale` flag ORs every check, so it flips as soon as any one slice exceeds its own budget.
 
+On Pro and Pro Business, `get_news_intelligence` opens one News Intelligence allocation. Repeated opens, filters, `summary` and JMESPath views reuse the same complete original within the admission window. The returned `panelRequest.token` is a closed `panel_request` for this tool only; news and country receipts cannot authorize it. Explicit refresh uses `refresh: true`, a UUID `request_id`, and no reader token. The same UUID retries that allocation. Authorized receipt reads query current usage without a new allocation; unknown usage omits the numeric notice. API and free-account calls retain ordinary per-tool charging and reject these paid controls.
+
+Reuse uses the existing four dataset GETs and three metadata GETs. It expires at the earliest of the 30/45/60-minute metadata deadlines, the shared 60-minute Insights generation limit, the assessed GDELT content-age deadline, and admission expiry. Advisory publication time is validated, but this source graph has no independent advisory freshness assessment. Missing, degraded, malformed, old, future or unassessed sources remain retryable. Paid reads expose proven stale generation through `stale` and unassessed clocks through `freshnessUnknown`; source values remain intact. The cross-source producer permits an observed empty signal list; empty Insights and advisory bootstrap lists are not reusable. The 64-read limit counts uncached tool executions, not individual Redis GETs. This does not prove complete provider coverage.
+
 <CodeGroup>
 
 ```bash curl
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +6/-0)
```diff
@@ -142,3 +142,9 @@ docs-stat 门禁从 `api/mcp/ui/registry.ts` 和工具注册表派生应用清
 | `api/mcp/handler.ts` | 公开 `ui://` 读取提升、`resources/list`、`resources/read` 以及 `initialize` 能力声明。 |
 | `public/.well-known/mcp/server-card.json` | 供扫描器和智能体使用的静态预连接发现元数据。 |
 | `scripts/docs-stats.mjs` | 针对文档、服务器卡片元数据、导航和应用清单的漂移守护。 |
+
+### News Intelligence 面板额度
+
+在 Pro 和 Pro Business 中，`get_news_intelligence` 打开一次 News Intelligence 面板只消耗一个额度。重复打开、筛选、`summary` 和 JMESPath 视图在授权窗口内复用同一完整原始快照。返回的 `panelRequest.token` 作为 `panel_request` 仅授权此工具；新闻和国家面板凭据不能授权它。显式刷新需设置 `refresh: true`，提供 UUID `request_id`，并省略读取凭据。重试同一 UUID 复用该额度。已授权凭据读取会查询当前用量，不再分配额度；用量未知时不显示数字。API 和免费账户保持逐工具计费，并拒绝这些付费控制参数。
+
+复用仍使用现有四个数据 GET 和三个元数据 GET。有效期取 30/45/60 分钟元数据期限、共享的 60 分钟 Insights 生成期限、已评估的 GDELT 内容年龄期限及面板授权期限的最早值。公告发布时间会验证，但此读取图没有独立的公告新鲜度评估。缺失、降级、格式错误、过期、未来或未评估的来源可以重试。付费读取通过 `stale` 表示已证实的生成时间过期，通过 `freshnessUnknown` 表示未评估的时钟；原始来源值保持不变。跨源生产程序允许已观察的空信号列表；空 Insights 和公告引导列表不可复用。64 次读取上限计算未缓存的工具执行次数，不是单个 Redis GET 次数。这不证明所有提供方的完整覆盖。
```

---

### Incident Patch 12: `8dd2d0bd` (2026-10-05)
**Commit Message**: fix(api): stop publishing country-located items at 0,0 (#8862)

* fix(api): stop publishing country-located items at 0,0

Three datasets handed API and MCP callers 0,0 positions:

- Disease outbreaks: items a source locates only by country got 0,0 (33 of
  50 placeholders on 2026-10-05). They now carry the country centroid; 0,0
  remains only for items with no known country, as the proto now documents.
- Climate disasters: ReliefWeb rows used a bounding-box table without small
  states, so Cabo Verde floods sat at 0,0. Positions now come from a
  centroid table generated from the country boundaries (239 countries).
- PizzINT: the upstream sends no lat/lng, so every venue was 0,0. The pin
  is in the Google Maps place URL it sends as `address`; both the relay and
  seed-conflict-intel now read it.

scripts/build-country-centroids.mjs regenerates the table; a test runs its
--check and holds every point inside its country's bounding box.

Claude-Session: https://claude.ai/code/session_01ASXvhmUFnTrArL9i4ppfU5

* docs(solutions): coordinate fallback to zero publishes Null Island

Claude-Session: https://claude.ai/code/session_01ASXvhmUFnTrArL9i4ppfU5

* fix(api): address review on cent

**File**: `Dockerfile.relay` (modified, +1/-0)
```diff
@@ -115,6 +115,7 @@ COPY scripts/shared/market-seed-universe.cjs ./scripts/shared/market-seed-univer
 # logic importable/testable for ais-relay.cjs. Missing it = startup crash.
 COPY scripts/shared/closed-market-equity-maintenance.cjs ./scripts/shared/closed-market-equity-maintenance.cjs
 COPY scripts/shared/pizzint-history.cjs ./scripts/shared/pizzint-history.cjs
+COPY scripts/shared/pizzint-location.cjs ./scripts/shared/pizzint-location.cjs
 # ucdp-candidate.cjs carries the GED Candidate discovery/merge shared with
 # scripts/seed-ucdp-events.mjs. Missing it = ERR_MODULE_NOT_FOUND at relay
 # startup (the require is top-level in the UCDP section).
```

**File**: `docs/api/HealthService.openapi.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"components":{"schemas":{"AirQualityAlert":{"properties":{"aqi":{"format":"int32","type":"integer"},"city":{"type":"string"},"countryCode":{"type":"string"},"lat":{"format":"double","type":"number"},"lng":{"format":"double","type":"number"},"measuredAt":{"description":"Warning: Values \u003e 2^53 may lose precision in JavaScript","format":"int64","type":"integer"},"pm25":{"format":"double","type":"number"},"pollutant":{"type":"string"},"riskLevel":{"type":"string"},"source":{"type":"string"}},"type":"object"},"BillingVerificationError":{"description":"Returned with HTTP 503 when paid access cannot be confirmed right now: the billing provider is re-verifying a recently expired subscription, or the entitlement backend is unreachable. Retryable — honor Retry-After.","properties":{"code":{"description":"Machine-readable billing-verification state, mirrored in the X-Billing-Verification response header.","enum":["renewal_verification_pending","renewal_verification_failed","entitlement_verification_unavailable"],"type":"string"},"error":{"description":"Human-readable billing-verification failure reason.","type":"string"},"requiredTier":{"description":"Minimum entitlement tier required for this endpoint, when the denial came from a tier gate.","format":"int32","type":"integer"}},"required":["error","code"],"type":"object"},"DiseaseOutbreakItem":{"description":"DiseaseOutbreakItem represents a single disease outbreak event.","properties":{"alertLevel":{"description":"Alert level: \"watch\" | \"warning\" | \"alert\".","type":"string"},"cases":{"description":"Case count if reported by source (0 = unknown).","format":"int32","type":"integer"},"countryCode":{"description":"ISO2 country code when known.","type":"string"},"disease":{"description":"Disease or outbreak name.","type":"string"},"id":{"description":"Unique identifier (URL-derived).","type":"string"},"lat":{"description":"Precise latitude from source (overrides country centroid on map when non-zero).","format":"double","type":"number"},"lng":{"description":"Precise longitude from source (overrides country centroid on map when non-zero).","format":"double","type":"number"},"location":{"description":"Affected country or region.","type":"string"},"publishedAt":{"description":"Unix epoch milliseconds when published.. Warning: Values \u003e 2^53 may lose precision in JavaScript","format":"int64","type":"integer"},"sourceName":{"description":"Source name (e.g., \"WHO\", \"ProMED\", \"HealthMap\").","type":"string"},"sourceUrl":{"description":"Source URL.","type":"string"},"summary":{"description":"Short description from the source.","type":"string"}},"type":"object"},"Error":{"description":"Error is returned when a handler encounters an error. It contains a simple error message that the developer can customize.","properties":{"message":{"description":"Error message (e.g., 'user not found', 'database connection failed')","type":"string"}},"type":"object"},"FieldViolation":{"description":"FieldViolation describes a single validation error for a specific field.","properties":{"description":{"description":"Human-readable description of the validation violation (e.g., 'must be a valid email address', 'required field missing')","type":"string"},"field":{"description":"The field path that failed validation (e.g., 'user.email' for nested fields). For header validation, this will be the header name (e.g., 'X-API-Key')","type":"string"}},"required":["field","description"],"type":"object"},"ForbiddenError":{"description":"Returned when a PRO-gated endpoint denies access because the caller has no resolved authenticated user, entitlements cannot be verified, or the caller lacks the required entitlement tier.","properties":{"code":{"description":"Machine-readable denial code, present when the 403 is a billing-provider-confirmed subscription lapse (mirrored in the X-Billing-Verification response header).","enum":["subscription_lapsed"],"type":"string"},"currentTier":{"description":"Caller entitlement tier when known.","format":"int32","type":"integer"},"error":{"description":"Human-readable entitlement failure reason.","type":"string"},"planKey":{"description":"Caller plan key when known.","type":"string"},"requiredTier":{"description":"Minimum entitlement tier required for this endpoint.","format":"int32","type":"integer"}},"required":["error"],"type":"object"},"GatewayError":{"description":"Returned by gateway infrastructure errors before an RPC handler runs, such as origin, routing, method, authentication, or quota checks.","properties":{"error":{"description":"Gateway error reason or structured gateway failure details.","oneOf":[{"type":"string"},{"additionalProperties":true,"type":"object"}]}},"required":["error"],"type":"object"},"InvalidRequestBodyError":{"description":"Returned when a JSON POST request body is empty or malformed.","properties":{"message":{"description":"Invalid request body","type":"string"}},"required":["message"],"type":"object"},"JmespathP
```

**File**: `docs/api/HealthService.openapi.yaml` (modified, +6/-2)
```diff
@@ -436,11 +436,15 @@ components:
                 lat:
                     type: number
                     format: double
-                    description: Precise latitude from source (overrides country centroid on map when non-zero).
+                    description: |-
+                        Latitude: the source's point when it gives one, otherwise the centroid of country_code.
+                         0 with lng 0 means the item has no known location.
                 lng:
                     type: number
                     format: double
-                    description: Precise longitude from source (overrides country centroid on map when non-zero).
+                    description: |-
+                        Longitude: the source's point when it gives one, otherwise the centroid of country_code.
+                         0 with lat 0 means the item has no known location.
                 cases:
                     type: integer
                     format: int32
```

**File**: `docs/api/worldmonitor.openapi.yaml` (modified, +6/-2)
```diff
@@ -44432,11 +44432,15 @@ components:
                 lat:
                     type: number
                     format: double
-                    description: Precise latitude from source (overrides country centroid on map when non-zero).
+                    description: |-
+                        Latitude: the source's point when it gives one, otherwise the centroid of country_code.
+                         0 with lng 0 means the item has no known location.
                 lng:
                     type: number
                     format: double
-                    description: Precise longitude from source (overrides country centroid on map when non-zero).
+                    description: |-
+                        Longitude: the source's point when it gives one, otherwise the centroid of country_code.
+                         0 with lat 0 means the item has no known location.
                 cases:
                     type: integer
                     format: int32
```

**File**: `docs/solutions/logic-errors/coordinate-fallback-to-zero-publishes-null-island-or-hides-the-item.md` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+---
+module: seeders
+date: 2026-10-05
+problem_type: logic_error
+component: background_job
+severity: high
+symptoms:
+  - "Map tooltip 'Portland International (PDX) — Normal operations' on a dot in the Gulf of Guinea, south of Nigeria"
+  - "23 FAA-only US airports stacked on one 0,0 dot, including LAX and PHL ground stops"
+  - "22 of 26 Cloudflare Radar traffic anomalies never drawn: the map filters 0,0, so they silently vanished"
+  - "API/MCP callers receive lat 0 / lng 0 for disease outbreaks, a Cabo Verde flood and every PizzINT venue"
+root_cause: logic_error
+resolution_type: code_fix
+related_components: [service_object, testing_framework]
+tags: [null-island, coordinates, placeholder, country-centroid, map-layer, redis-sweep, seeder, dockerfile-relay, watch-patterns]
+---
+
+# A coordinate fallback to 0 publishes Null Island or hides the item
+
+## Problem
+
+Several seeders wrote `lat ?? 0` / `coords ? coords[0] : 0` when a source row had no position. 0,0 is a real point (the sea south of Ghana and Nigeria), so the item was either drawn there or, where a map layer filters 0,0, dropped from the map. API and MCP callers received 0,0 as if it were a real position either way.
+
+## Symptoms
+
+- `aviation:delays-bootstrap:v2`: 24 of 106 alerts at 0,0. The seeder's FAA-only registry rows had no `lat`/`lon`. `seedFaaDelays` hard-coded `{ latitude: 0, longitude: 0 }`, and `buildFillerRegistry` let the coordinate-less seeder row override `src/config/airports.ts`.
+- `cf:radar:traffic-anomalies:v1`: 22 of 26 anomalies at 0,0. AS-type anomalies carry their country on `asnDetails.location`, not `locationDetails`, and `COUNTRY_COORDS` lacked 23 countries. The same table also made outages and DDoS targets in those countries get *skipped*.
+- `health:disease-outbreaks:v1`: 50 of 124 at 0,0. 33 of them had a `countryCode`; the browser map hid the problem by falling back to a centroid, but the API did not.
+- `climate:disasters:v1`: a Cabo Verde flood at 0,0 (`country-bboxes.json` has no small island states).
+- PizzINT: every venue at 0,0. The upstream sends no `lat`/`lng`; the pin is inside the Google Maps URL it sends as `address`.
+
+## What Didn't Work
+
+- **Fixing the reported dot alone.** PDX was only the marker drawn on top of 23 stacked airports. The full scope only showed up after scanning every dataset.
+- **Calling the read-only bootstrap API for the sweep.** It returned 401 without a key. Reading Redis directly was simpler and covered datasets that aren't in bootstrap.
+- **GETting all 379k Redis keys.** Too expensive. SCAN the key names, collapse them into families (ids, hashes and dates replaced), then GET 2 samples per family (~31k reads).
+- **Running only the targeted test suites.** They passed, but `npm run test:data` found 5 contract failures. Adding a `require('./shared/pizzint-location.cjs')` to `ais-relay.cjs` needs a `COPY` line in `Dockerfile.relay` (caught by `tests/dockerfile-relay-imports.test.mjs`) and the new file in `scripts/railway-services.json` `watchPatterns` for each service that loads it (caught by `tests/railway-watch-path-audit.test.mjs`). Without the COPY line, the relay crashes at boot.
+- **An `isMain` guard so the radar seeder could be imported by tests.** It broke `cloudflare-radar-companion-publication.test.mjs`, which imports the seeder and expects `runSeed` to run on import. The pure helpers moved to `scripts/lib/radar-country-coords.mjs` instead.
+
+## Solution
+
+- **Airports (#8859):** added coordinates to every FAA-only row in `scripts/seed-aviation.mjs`. FAA alerts are now built by the exported `buildFaaAlerts`, which uses `meta.lat`/`meta.lon`.
+- **Radar (#8860):** `mapTrafficAnomaly` falls back to `asnDetails.location.code`, and the 23 missing centroids were added. A test holds `COUNTRY_COORDS` to `scripts/shared/country-bboxes.json`.
+- **Disease, climate, PizzINT (#8862):**
+  - `scripts/data/country-centroids.json` (239 countries) is generated by `scripts/build-country-centroids.mjs` from `public/data/countries.geojson`, with `countries-50m.json` for the 83 small states the geojson leaves without geometry. Run it with `--check` to detect drift.
+  - Each point is the centroid of the polygon that holds the capital, otherwise the largest polygon; it moves to an interior point when a concave shape puts the centroid outside.
+  - Disease and climate rows without a source point use `countryCentroid(code)`. 0,0 remains only when the country is unknown, and the proto comment says so.
+  - PizzINT venues use `pizzintVenuePoint`, which reads `!3d<lat>!4d<lng>` and falls back to `@lat,lng`.
+
+```js
+// before
+lat: item._lat ?? 0,
+// after: the source point, else the country centroid, else explicitly unlocated
+...(item._lat != null && item._lng != null
+  ? { lat: item._lat, lng: item._lng }
+  : countryCentroid(countryCode) ?? { lat: 0, lng: 0 }),
+```
+
+## Why This Works
+
+Most of these placeholders were not caused by missing data. The 
```

**File**: `proto/worldmonitor/health/v1/list_disease_outbreaks.proto` (modified, +4/-2)
```diff
@@ -24,9 +24,11 @@ message DiseaseOutbreakItem {
   int64 published_at = 8 [(sebuf.http.int64_encoding) = INT64_ENCODING_NUMBER];
   // Source name (e.g., "WHO", "ProMED", "HealthMap").
   string source_name = 9;
-  // Precise latitude from source (overrides country centroid on map when non-zero).
+  // Latitude: the source's point when it gives one, otherwise the centroid of country_code.
+  // 0 with lng 0 means the item has no known location.
   double lat = 10;
-  // Precise longitude from source (overrides country centroid on map when non-zero).
+  // Longitude: the source's point when it gives one, otherwise the centroid of country_code.
+  // 0 with lat 0 means the item has no known location.
   double lng = 11;
   // Case count if reported by source (0 = unknown).
   int32 cases = 12;
```

**File**: `public/llms.txt` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ Reach for World Monitor when a task needs live, correlated, machine-readable glo
 
 - [MCP server (recommended)](https://worldmonitor.app/mcp): Streamable HTTP; issue `tools/list` for the live inventory. Auth: OAuth2 (`scope=mcp`) or an API key header `X-WorldMonitor-Key: wm_<40-hex>`. See the [server card](https://worldmonitor.app/.well-known/mcp/server-card.json), [official MCP registry](https://registry.modelcontextprotocol.io/), [Smithery](https://smithery.ai/servers/worldmonitor/wm-mcp), and [mcp.so](https://mcp.so/server/world-monitor).
 - [Docs MCP server card](https://www.worldmonitor.app/.well-known/mcp/docs-server-card.json): public Streamable HTTP search and retrieval over the documentation. Use it for "how do I…" questions about the platform; use the product MCP above for live data.
-- [REST API guide](https://www.worldmonitor.app/openapi.md): API key required. Send the `X-WorldMonitor-Key` header. The contract is the [OpenAPI specification](https://www.worldmonitor.app/openapi.yaml), which is 2,990,829 bytes. Use the [sandbox index](https://www.worldmonitor.app/sandbox/index.json) for key-free examples. <!-- // pragma: allowlist secret -->
+- [REST API guide](https://www.worldmonitor.app/openapi.md): API key required. Send the `X-WorldMonitor-Key` header. The contract is the [OpenAPI specification](https://www.worldmonitor.app/openapi.yaml), which is 2,991,051 bytes. Use the [sandbox index](https://www.worldmonitor.app/sandbox/index.json) for key-free examples. <!-- // pragma: allowlist secret -->
 - [worldmonitor CLI](https://www.worldmonitor.app/docs/cli): `npx worldmonitor tools` lists every tool (public, no key); `npm install -g worldmonitor` installs the command. `worldmonitor call get_sources` needs no key; pass `--api-key` for every other data tool.
 - [SDK guide](https://www.worldmonitor.app/docs/sdks): official zero-dependency clients for Python ([PyPI](https://pypi.org/project/worldmonitor-sdk/)), Ruby ([RubyGems](https://rubygems.org/gems/worldmonitor)), Go ([pkg.go.dev](https://pkg.go.dev/github.com/koala73/worldmonitor/sdk/go)), and JavaScript via the npm package.
 - [Agent Skills discovery manifest](https://worldmonitor.app/.well-known/agent-skills/index.json): install with `npx skills add koala73/worldmonitor`; see the [skills.sh listing](https://skills.sh/koala73/worldmonitor).
```

**File**: `scripts/_disease-outbreaks-helpers.mjs` (modified, +5/-2)
```diff
@@ -18,6 +18,7 @@
 
 import { extractCountryCode } from './shared/geo-extract.mjs';
 import { decodeHtmlEntities } from './_html-entities.mjs';
+import { countryCentroid } from './lib/country-centroid.mjs';
 
 // WHO DON uses multi-word or hyphenated country names that the bigram scanner misses.
 // These override extractCountryCode for exact substring matches (checked first, case-insensitive).
@@ -257,8 +258,10 @@ export function mapItem(item) {
     sourceUrl: item.link,
     publishedAt: item.publishedMs,
     sourceName: item.sourceName,
-    lat: item._lat ?? 0,
-    lng: item._lng ?? 0,
+    // No source point: the country's centroid. 0,0 only when the country is unknown.
+    ...(item._lat != null && item._lng != null
+      ? { lat: item._lat, lng: item._lng }
+      : countryCentroid(countryCode) ?? { lat: 0, lng: 0 }),
     cases: item._cases || 0,
     // PRE-PUBLISH HELPERS — see header comment.
     _publishedAtIsSynthetic: item._publishedAtIsSynthetic === true,
```

---

### Incident Patch 13: `c5b956a1` (2026-10-05)
**Commit Message**: fix(plugin): restore projected News Intelligence stories (#8843)

* test(mcp): reproduce News Intelligence projection loss

* fix(mcp): render accepted News Intelligence projections

* fix(mcp): derive advertised app resources from registry inventory

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Elie Habib <[REDACTED_EMAIL]>

**File**: `api/mcp/ui/news-intelligence-app.ts` (modified, +24/-6)
```diff
@@ -44,12 +44,16 @@ const BODY = `
 
 const RENDER = `
     if (!data || typeof data !== "object") return;
-    var d = data.data && typeof data.data === "object" ? data.data : data;
+    var value = Object.prototype.hasOwnProperty.call(data, "projection") ? data.projection : data;
+    var envelope = value && typeof value === "object" && !Array.isArray(value) ? value : {};
+    var d = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
+      ? envelope.data : envelope;
     q("empty").style.display = "none";
     q("card").style.display = "block";
 
     var ins = d.insights && typeof d.insights === "object" ? d.insights : null;
-    var storyState = listState(ins && ins.topStories);
+    var sourceStories = ins && ins.topStories;
+    var storyState = listState(sourceStories);
     var stories = storyState.items;
     var host = q("list");
     host.textContent = "";
@@ -71,15 +75,29 @@ const RENDER = `
       if (src) row.appendChild(el("div", "story-src", src + (provenanceSummary ? " • " + provenanceSummary : "")));
       host.appendChild(row);
     }
-    if (!host.childNodes.length) {
+    var shown = host.childNodes.length;
+    if (!shown) {
       host.appendChild(el("div", "empty", storyState.available
         ? "No news stories available."
         : "News intelligence is temporarily unavailable."));
     }
 
-    q("foot").textContent = data.cached_at
-      ? "Snapshot: " + collapseWs(data.cached_at) + (data.stale ? " (stale)" : "")
-      : "";
+    var footParts = [];
+    if (storyState.available) {
+      if (Array.isArray(sourceStories)) {
+        footParts.push("Showing " + shown + " of " + stories.length + " loaded stories.");
+      } else {
+        var total = sourceStories.count;
+        var knownTotal = typeof total === "number" && Number.isFinite(total) && Number.isInteger(total) && total >= stories.length;
+        footParts.push("Showing " + shown + " sampled stories" +
+          (knownTotal ? " of " + total + " reported stories." : "; total unavailable.") +
+          (knownTotal ? (total > stories.length ? " Full list is not loaded." : " Sample contains all reported stories.")
+            : " Full list coverage is unavailable."));
+      }
+    }
+    if (ins && ins.status === "degraded") footParts.push("Source reports degraded news intelligence.");
+    if (envelope.cached_at) footParts.push("Snapshot: " + collapseWs(envelope.cached_at) + (envelope.stale ? " (stale)" : ""));
+    q("foot").textContent = footParts.join(" ");
 `;
 
 export const NEWS_INTELLIGENCE_APP_HTML = buildAppHtml({
```

**File**: `api/mcp/ui/registry.ts` (modified, +5/-3)
```diff
@@ -44,7 +44,8 @@ export const WORLD_BRIEF_UI_URI = 'ui://worldmonitor/world-brief.html';
 export const COUNTRY_BRIEF_UI_URI = 'ui://worldmonitor/country-brief.html';
 export const MARKET_RADAR_UI_URI = 'ui://worldmonitor/market-radar-v3.html';
 export const CHOKEPOINT_MONITOR_UI_URI = 'ui://worldmonitor/chokepoint-monitor.html';
-export const NEWS_INTELLIGENCE_UI_URI = 'ui://worldmonitor/news-intelligence.html';
+export const NEWS_INTELLIGENCE_UI_URI = 'ui://worldmonitor/news-intelligence-v2.html';
+const LEGACY_NEWS_INTELLIGENCE_UI_URI = 'ui://worldmonitor/news-intelligence.html';
 export const CONFLICT_EVENTS_UI_URI = 'ui://worldmonitor/conflict-events-v2.html';
 const LEGACY_CONFLICT_EVENTS_UI_URI = 'ui://worldmonitor/conflict-events.html';
 export const NATURAL_DISASTERS_UI_URI = 'ui://worldmonitor/natural-disasters-v2.html';
@@ -175,7 +176,7 @@ export const UI_RESOURCE_REGISTRY: UiResourceDef[] = [
 const UI_RESOURCE_BY_URI = new Map(UI_RESOURCE_REGISTRY.map((r) => [r.uri, r]));
 
 export function isUiResourceUri(uri: string): boolean {
-  return uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
+  return uri === LEGACY_NEWS_INTELLIGENCE_UI_URI || uri === LEGACY_CONFLICT_EVENTS_UI_URI || uri === LEGACY_NATURAL_DISASTERS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI || uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI || uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI || uri === COUNTRY_VIEW_UI_URI || uri === NEWS_DASHBOARD_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI || UI_RESOURCE_BY_URI.has(uri);
 }
 
 // resources/list public shape — {uri, name, description, mimeType} plus the
@@ -209,7 +210,8 @@ export async function buildUiResourceRead(
   if (uri === MARKET_RADAR_UI_URI || uri === PREVIOUS_MARKET_RADAR_UI_URI || uri === LEGACY_MARKET_RADAR_UI_URI) return readMarketRadar(id, corsHeaders, uri);
   if (uri === COUNTRY_VIEW_UI_URI || uri === PREVIOUS_COUNTRY_VIEW_UI_URI || uri === LEGACY_COUNTRY_VIEW_UI_URI) return readCountryView(id, corsHeaders, uri);
   if (uri === NEWS_DASHBOARD_UI_URI || uri === PREVIOUS_NEWS_DASHBOARD_UI_URI || uri === LEGACY_NEWS_DASHBOARD_UI_URI) return readNewsDashboard(id, corsHeaders, uri);
-  const canonicalUri = uri === LEGACY_CONFLICT_EVENTS_UI_URI ? CONFLICT_EVENTS_UI_URI
+  const canonicalUri = uri === LEGACY_NEWS_INTELLIGENCE_UI_URI ? NEWS_INTELLIGENCE_UI_URI
+    : uri === LEGACY_CONFLICT_EVENTS_UI_URI ? CONFLICT_EVENTS_UI_URI
     : uri === LEGACY_NATURAL_DISASTERS_UI_URI ? NATURAL_DISASTERS_UI_URI
     : (uri === LEGACY_PREDICTION_MARKETS_UI_URI || uri === PREVIOUS_PREDICTION_MARKETS_UI_URI) ? PREDICTION_MARKETS_UI_URI
     : uri === LEGACY_FORECASTS_UI_URI || uri === PREVIOUS_FORECASTS_UI_URI ? FORECASTS_UI_URI
```

**File**: `docs/mcp-apps.mdx` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ Three discovery signals must stay aligned:
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | Country Brief (interactive) | Per-country intelligence brief, analytical framework lens, and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Market Radar (interactive) | Fear & Greed plus all loaded quote rows, asset names and expandable intraday charts from the same snapshot. |
 | `ui://worldmonitor/chokepoint-monitor.html` | `get_chokepoint_status` | Chokepoint Monitor (interactive) | Per-chokepoint transit summaries, week-over-week change, tanker split, and risk-level badge. |
-| `ui://worldmonitor/news-intelligence.html` | `get_news_intelligence` | News Intelligence (interactive) | AI-classified top stories with category, alert flag, country, and source. |
+| `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | News Intelligence (interactive) | AI-classified top stories with category, alert flag, country, source provenance, snapshot status and explicit loaded/sample counts. |
 | `ui://worldmonitor/conflict-events-v2.html` | `get_conflict_events` | Conflict Events (interactive) | Active armed-conflict events (belligerents, violence type, country, fatalities, date) from UCDP. |
 | `ui://worldmonitor/natural-disasters-v2.html` | `get_natural_disasters` | Natural Disasters (interactive) | Recent M4.5+ earthquakes (USGS and Earthquakes Canada / NRCan: magnitude, place, time, source) and active wildfires (NASA FIRMS), grouped. |
 | `ui://worldmonitor/prediction-markets-v3.html` | `get_prediction_markets` | Prediction Markets (interactive) | Event-contract odds grouped by category (geopolitical, tech, finance) with a probability bar per market. Full-envelope projections and summary samples retain the loaded contracts and snapshot metadata. Missing or malformed categories and unknown freshness remain explicit. |
```

**File**: `docs/mcp-overview.mdx` (modified, +1/-1)
```diff
@@ -514,7 +514,7 @@ The server supports [MCP Apps](https://modelcontextprotocol.io/extensions/apps/b
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | The AI-synthesised per-country brief as paragraphs, with the analytical framework lens and grounding sources. |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed plus all loaded equity, commodity, crypto, Gulf and sector quotes, asset names and expandable intraday charts. |
 | `ui://worldmonitor/chokepoint-monitor.html` | `get_chokepoint_status` | Per-chokepoint rolling transit summaries (today's count, week-over-week change, tanker split) with a risk-level badge. |
-| `ui://worldmonitor/news-intelligence.html` | `get_news_intelligence` | AI-classified top stories with category, alert flag, country, and source. |
+| `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | AI-classified top stories with category, alert flag, country, and source. |
 | `ui://worldmonitor/conflict-events-v2.html` | `get_conflict_events` | Active armed-conflict events (belligerents, violence type, country, fatalities, date) from the UCDP feed. |
 | `ui://worldmonitor/natural-disasters-v2.html` | `get_natural_disasters` | Recent M4.5+ earthquakes (USGS and Earthquakes Canada / NRCan: magnitude, place, time, source) and active wildfires (NASA FIRMS), grouped. |
 | `ui://worldmonitor/prediction-markets-v3.html` | `get_prediction_markets` | Active event-contract odds grouped by category (geopolitical, tech, finance) with a probability bar per market. Full-envelope projections and summary samples preserve loaded contracts and snapshot metadata. Missing or malformed categories and unknown freshness remain explicit. |
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ MCP Apps 在托管工具调用后，把 WorldMonitor UI 渲染到 MCP 宿主内
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | 国家简报（交互式） | 按国家划分的情报简报、分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | 市场雷达（交互式） | 恐惧贪婪综合指数，以及股票、大宗商品、加密货币、海湾地区和行业报价表，附带带符号、颜色编码的涨跌。 |
 | `ui://worldmonitor/chokepoint-monitor.html` | `get_chokepoint_status` | 咽喉要道监视器（交互式） | 按咽喉要道划分的通行摘要、周环比变化、油轮构成和风险等级徽章。 |
-| `ui://worldmonitor/news-intelligence.html` | `get_news_intelligence` | 新闻情报（交互式） | AI 分类的头条报道，附带类别、警报标记、国家和来源。 |
+| `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | 新闻情报（交互式） | AI 分类的头条报道，附带类别、警报标记、国家、来源背景、快照状态，以及明确的已加载或样本数量。 |
 | `ui://worldmonitor/conflict-events-v2.html` | `get_conflict_events` | 冲突事件（交互式） | 来自 UCDP 的活跃武装冲突事件（交战方、暴力类型、国家、死亡人数、日期）。 |
 | `ui://worldmonitor/natural-disasters-v2.html` | `get_natural_disasters` | 自然灾害（交互式） | 近期 M4.5+ 地震（USGS 与加拿大地震局 / NRCan：震级、地点、时间、来源）和活跃野火（NASA FIRMS），分组展示。 |
 | `ui://worldmonitor/prediction-markets-v3.html` | `get_prediction_markets` | 预测市场（交互式） | 按类别（地缘政治、科技、金融）分组的事件合约赔率，每个市场附带一个概率条。完整响应投影和摘要样本保留已加载的合约及快照信息。缺失或无效的类别会明确标记为不可用或未包含；未知的新鲜度也会明确显示。 |
```

**File**: `docs/zh/mcp-overview.mdx` (modified, +1/-1)
```diff
@@ -488,7 +488,7 @@ npx @modelcontextprotocol/inspector https://worldmonitor.app/mcp
 | `ui://worldmonitor/country-brief.html` | `get_country_brief` | 以段落呈现的 AI 合成各国简报，附带分析框架视角和支撑来源。 |
 | `ui://worldmonitor/market-radar-v3.html` | `get_market_data` | Fear & Greed 综合指标，外加各资产类别的报价表（股票、大宗商品、加密货币、海湾、板块），带有带符号、色彩编码的涨跌。 |
 | `ui://worldmonitor/chokepoint-monitor.html` | `get_chokepoint_status` | 各咽喉要道的滚动过境摘要（今日计数、周环比变化、油轮占比），并带有风险级别标记。 |
-| `ui://worldmonitor/news-intelligence.html` | `get_news_intelligence` | AI 分类的热门报道，带有类别、警报标记、国家和来源。 |
+| `ui://worldmonitor/news-intelligence-v2.html` | `get_news_intelligence` | AI 分类的热门报道，带有类别、警报标记、国家和来源。 |
 | `ui://worldmonitor/conflict-events-v2.html` | `get_conflict_events` | 来自 UCDP 源的活跃武装冲突事件（交战方、暴力类型、国家、伤亡、日期）。 |
 | `ui://worldmonitor/natural-disasters-v2.html` | `get_natural_disasters` | 近期地震（USGS 震级、地点、时间）和活跃野火（NASA FIRMS），分组显示。 |
 | `ui://worldmonitor/prediction-markets-v3.html` | `get_prediction_markets` | 按类别（地缘政治、科技、金融）分组的活跃事件合约赔率，每个市场带有一个概率条。完整响应投影和摘要样本保留已加载的合约及快照信息。缺失或无效的类别会明确标记为不可用或未包含；未知的新鲜度也会明确显示。 |
```

**File**: `public/.well-known/mcp/server-card.json` (modified, +2/-2)
```diff
@@ -743,15 +743,15 @@
         "ui://worldmonitor/country-brief.html",
         "ui://worldmonitor/market-radar-v3.html",
         "ui://worldmonitor/chokepoint-monitor.html",
-        "ui://worldmonitor/news-intelligence.html",
+        "ui://worldmonitor/news-intelligence-v2.html",
         "ui://worldmonitor/conflict-events-v2.html",
         "ui://worldmonitor/natural-disasters-v2.html",
         "ui://worldmonitor/prediction-markets-v3.html",
         "ui://worldmonitor/forecasts-v3.html",
         "ui://worldmonitor/news-dashboard-v3.html",
         "ui://worldmonitor/country-view-v3.html"
       ],
-      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk.html, get_world_brief → world-brief.html, get_country_brief → country-brief.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor.html, get_news_intelligence → news-intelligence.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
+      "note": "MCP Apps support: tools with an interactive surface carry `_meta.ui.resourceUri` (get_country_risk → country-risk.html, get_world_brief → world-brief.html, get_country_brief → country-brief.html, get_market_data → market-radar-v3.html, get_chokepoint_status → chokepoint-monitor.html, get_news_intelligence → news-intelligence-v2.html, get_conflict_events → conflict-events-v2.html, get_natural_disasters → natural-disasters-v2.html, get_prediction_markets → prediction-markets-v3.html, get_forecast_predictions → forecasts-v3.html, open_news_dashboard → news-dashboard-v3.html, open_country_brief → country-view-v3.html). Issue `resources/list` to enumerate ui:// app shells and `resources/read` to fetch them — ui:// reads are public + quota-exempt (static, data-free templates); live data reaches the shell via host postMessage after a normal tools/call."
     }
   },
   "features": {
```

**File**: `public/mcp-server.md` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ World Monitor supports MCP Apps (`io.modelcontextprotocol/ui`) with interactive
 - `ui://worldmonitor/country-brief.html`
 - `ui://worldmonitor/market-radar-v3.html`
 - `ui://worldmonitor/chokepoint-monitor.html`
-- `ui://worldmonitor/news-intelligence.html`
+- `ui://worldmonitor/news-intelligence-v2.html`
 - `ui://worldmonitor/conflict-events-v2.html`
 - `ui://worldmonitor/natural-disasters-v2.html`
 - `ui://worldmonitor/prediction-markets-v3.html`
```

---

### Incident Patch 14: `6f1bbcbf` (2026-10-05)
**Commit Message**: fix(plugin): share disaster panel allocation within source deadlines (#8841)

* test(mcp): cover curated market panel admission

* feat(mcp): admit curated market panels once per opening

* test(mcp): cover uppercase panel refresh UUIDs

* fix(mcp): canonicalize panel refresh UUID case

* docs(mcp): describe curated market panel accounting

* test(mcp): reproduce missing market receipt usage metadata

* fix(mcp): preserve current usage on authorized market receipt results

* test(mcp): keep ordinary quota probes on a non-panel tool

* test(mcp): preserve ordinary quota lifecycle coverage

* test: reproduce prediction panel accounting and receipt failures

* fix: share paid prediction panel allocation across filters and reads

* test: reproduce unavailable prediction replay and pin bounded output

* fix: keep unavailable prediction snapshots retryable

* test: reject unknown prediction replay envelopes

* fix: preserve unknown prediction envelopes as retryable

* docs(mcp): describe prediction panel reuse and refresh

* docs(mcp): align prediction parameter table with schema

* test(mcp): reproduce selected prediction cache masking source health

* fix(mcp): retain prediction source

**File**: `api/mcp/_natural-disasters-reuse.ts` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+import { argBool, argNum, argStrList, capNested, selectDatasets } from './filters';
+import { DEFAULT_LIST_LIMIT } from './constants';
+import { projectNaturalEventsRetention } from '../_natural-events-dashboard.js';
+
+export type NaturalDisastersPanelRead = { value: unknown; reuseUntil: number | null };
+
+const SOURCES = {
+  earthquakes: { label: 'earthquakes', list: 'earthquakes', lifetime: 30 * 60_000 },
+  wildfires: { label: 'fires', list: 'fireDetections', lifetime: 7_200_000 },
+  other: { label: 'events', list: 'events', lifetime: 540 * 60_000 },
+} as const;
+
+function record(value: unknown): value is Record<string, unknown> {
+  return value !== null && typeof value === 'object' && !Array.isArray(value);
+}
+function clock(value: unknown, now: number): number | null {
+  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= now ? value : null;
+}
+function failed(value: Record<string, unknown>): boolean {
+  return ['unavailable', 'upstreamUnavailable', 'degraded', 'stale', 'rateLimited'].some(key => value[key] === true)
+    || value.dataAvailable === false
+    || ['error', 'errorCode', 'skipReason'].some(key => typeof value[key] === 'string' && value[key] !== '');
+}
+function validRows(value: unknown): value is Record<string, unknown>[] {
+  return Array.isArray(value) && value.every(record);
+}
+
+export function naturalDisastersReuseUntil(
+  data: Record<string, unknown>, seeds: Record<string, unknown>, seismologyMeta: unknown,
+  args: Record<string, unknown>, now: number,
+): number | null {
+  if (!record(seismologyMeta) || failed(seismologyMeta)
+    || seismologyMeta.sourceState !== undefined && seismologyMeta.sourceState !== 'ok'
+    || Array.isArray(seismologyMeta.failedSources) && seismologyMeta.failedSources.length > 0) return null;
+  const metaClock = clock(seismologyMeta.fetchedAt, now);
+  if (metaClock === null) return null;
+  let deadline = metaClock + SOURCES.earthquakes.lifetime;
+  const requested = argStrList(args.dataset);
+  for (const dataset of requested.length ? requested : Object.keys(SOURCES)) {
+    const source = SOURCES[dataset as keyof typeof SOURCES];
+    if (!source) return null;
+    const bucket = data[source.label];
+    if (!record(bucket) || !validRows(bucket[source.list]) || failed(bucket)) return null;
+    const seed = seeds[source.label];
+    const clocks: number[] = [];
+    if (seed !== null && seed !== undefined) {
+      if (!record(seed) || !['OK', 'OK_ZERO'].includes(String(seed.state))
+        || Array.isArray(seed.failedDatasets) && seed.failedDatasets.length > 0
+        || typeof seed.errorReason === 'string' && seed.errorReason !== '') return null;
+      const published = clock(seed.fetchedAt, now);
+      if (published === null) return null;
+      clocks.push(published);
+    }
+    if ('fetchedAt' in bucket) {
+      const observed = clock(bucket.fetchedAt, now);
+      if (observed === null) return null;
+      clocks.push(observed);
+    }
+    if (!clocks.length) return null;
+    deadline = Math.min(deadline, ...clocks.map(value => value + source.lifetime));
+    if (dataset === 'wildfires') {
+      if (['_firmsState', '_cwfisState', '_bcState'].some(key => key in bucket && bucket[key] !== 'ok')
+        || bucket._firmsPartial === true
+        || ['_firmsErrorCode', '_cwfisErrorCode', '_bcErrorCode'].some(key => bucket[key] !== undefined && bucket[key] !== null && bucket[key] !== '')
+        || typeof bucket._firmsFailedCalls === 'number' && bucket._firmsFailedCalls > 0) return null;
+    }
+    if (dataset === 'other') {
+      for (const key of ['westernPacific', 'hkoWarnings']) {
+        const region = bucket[key];
+        if (region !== undefined && (!record(region) || failed(region)
+          || Array.isArray(region.sourceDecisions) && region.sourceDecisions.some(decision => !record(decision) || decision.status !== 'accepted'))) return null;
+      }
+      if ('eonetRetention' in bucket) {
+        const retention = bucket.eonetRetention;
+        if (!record(retention) || typeof retention.retainedUntil !== 'number' || !Number.isSafeInteger(retention.retainedUntil) || retention.retainedUntil <= 0
+          || !Array.isArray(retention.eventIndexes)
+          || retention.eventIndexes.some(index => !Number.isInteger(index) || index < 0 || index >= (bucket.events as unknown[]).length)
+          || new Set(retention.eventIndexes).size !== retention.eventIndexes.length) return null;
+        if (retention.eventIndexes.length) deadline = Math.min(deadline, retention.retainedUntil);
+      }
+    }
+  }
+  return deadline > now ? deadline : null;
+}
+
+export function filterNaturalDisastersPanelData(data: Record<string, unknown>, args: Record<string, unknown>): Record<string, unknown> {
+  const magnitude = argNum(args.min_magnitude);
+  const limit = argNum(args.limit) ?? DEFAULT_LIST_LIMIT;
+  if (record(data.events) && Array.isArray(data.events.events)) data
```

**File**: `api/mcp/dispatch.ts` (modified, +69/-21)
```diff
@@ -1,5 +1,8 @@
 import { buildAttributionRider, mergeAttributionRider } from '../../shared/attribution-rider';
-import { readExistsFlags, readJsonFromUpstash, redisPipeline } from '../_upstash-json.js';
+import { readExistsFlags, readJsonFromUpstash, readRawJsonFromUpstash, redisPipeline } from '../_upstash-json.js';
+// @ts-expect-error — Edge-safe JS envelope mirror.
+import { unwrapEnvelope } from '../_seed-envelope.js';
+import { filterNaturalDisastersPanelData, naturalDisastersReuseUntil, type NaturalDisastersPanelRead } from './_natural-disasters-reuse';
 import { isAppOwnedRedisKey } from '../_redis-key-ownership.js';
 // @ts-expect-error — JS module, no declaration file
 import { captureSilentError } from '../_sentry-edge.js';
@@ -15,9 +18,9 @@ import { mcpErrorFingerprint } from './error-fingerprint';
 import { argBool, summarizeData } from './filters';
 import { evaluateFreshness } from './freshness';
 import { applyJmespath } from './jmespath';
-import { admitConflictPanel, admitCountryPanel, admitForecastPanel, admitMarketPanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
+import { admitConflictPanel, admitCountryPanel, admitDisasterPanel, admitForecastPanel, admitMarketPanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
-import { conflictPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
+import { conflictPanelViewSchema, disasterPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
 import { isSharedRestCounter, readDailyAllowance, reserveQuota, resolveDailyLimit, type McpBudget } from './quota';
 import { reserveFreeAccountAllowance } from './free-account-allowance';
 import { buildMcpStructuredDenial, type McpDenial } from './upgrade';
@@ -46,6 +49,17 @@ import { isPhysicalDivergenceContractError as isMcpStoredContractError } from '.
 // ---------------------------------------------------------------------------
 // Tool execution (cache tools — no _execute)
 // ---------------------------------------------------------------------------
+type CacheToolValue = {
+  conflict_source?: ConflictSourceObservation;
+  cached_at: string | null;
+  stale: boolean;
+  activationUnknown?: true;
+  freshnessUnknown?: true;
+  unreadable?: string[];
+  contentFreshnessPendingUntil?: string;
+  data: Record<string, unknown>;
+};
+
 // Exported as a test seam (like `evaluateFreshness`) so the `_postFilter`
 // throw/fall-back path can be exercised directly — it can't be triggered
 // through the public handler for unexpected programming errors. Country
@@ -55,16 +69,22 @@ export async function executeTool(
   params: Record<string, unknown> = {},
   now?: number,
   execution?: McpToolExecutionContext,
-): Promise<{
-  conflict_source?: ConflictSourceObservation;
-  cached_at: string | null;
-  stale: boolean;
-  activationUnknown?: true;
-  freshnessUnknown?: true;
-  unreadable?: string[];
-  contentFreshnessPendingUntil?: string;
-  data: Record<string, unknown>;
-}> {
+): Promise<CacheToolValue> {
+  return (await executeCacheTool(tool, params, now, undefined, execution)).value;
+}
+
+export async function executeNaturalDisastersPanelRead(params: Record<string, unknown>): Promise<NaturalDisastersPanelRead> {
+  const tool = TOOL_REGISTRY.find(tool => tool.name === 'get_natural_disasters')! as CacheToolDef;
+  return executeCacheTool(tool, params, undefined, 'natural-disasters');
+}
+
+async function executeCacheTool(
+  tool: CacheToolDef,
+  params: Record<string, unknown>,
+  now?: number,
+  panel?: 'natural-disasters',
+  execution?: McpToolExecutionContext,
+): Promise<{ value: CacheToolValue; reuseUntil: number | null }> {
   // Per-key namespace decision (#7674): most _cacheKeys / freshness keys are
   // written by the Railway seeder fleet and are read raw; the route-owned
   // exceptions (temporal anomalies snapshot + its stamp) ride the deployment
@@ -77,7 +97,7 @@ export async function executeTool(
   // key failed the whole tool as a raw TimeoutError (WORLDMONITOR-176/ZM/137),
   // while folding the failure into null would read an unreadable seed-meta as
   // "never seeded" and an unreadable data key as an empty section.
-  const reads = tool._cacheKeys.map((k) => settleRead(readJsonFromUpstash(k, 3_000, !isAppOwnedRedisKey(k))));
+  const reads = tool._cacheKeys.map((k) => settleRead((panel === 'natural-disasters' ? readRawJsonFromUpstash : readJsonFromUpstash)(k, 3_000, !isAppOwnedRedisKey(k))));
   const freshnessChecks = tool._freshnessChecks;
   const metaReads = freshnessChecks.map((check) => settleRead(readJsonFromUpstas
```

**File**: `api/mcp/panel-requests.ts` (modified, +55/-10)
```diff
@@ -2,12 +2,13 @@ import { countryActivityQueries } from '../../shared/country-activity-query';
 import { z } from 'zod';
 import { countryReaderSchema, COUNTRY_READERS, countryViewSchema, type PanelAdmission } from '../../shared/country-brief-host';
 import { resolveCountryCode } from '../../shared/country-code-resolve';
-import { conflictPanelReadSchema, conflictPanelViewSchema, type ConflictPanelAdmission, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
+import { conflictPanelReadSchema, conflictPanelViewSchema, disasterPanelReadSchema, disasterPanelViewSchema, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ConflictPanelAdmission, type DisasterPanelAdmission, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
 import { forecastTheaterReadSchema, reusableForecastTheaterResult } from '../../shared/forecast-theaters';
 import { iso2ToComtradeReporterCode, iso2ToUnCode } from '../../shared/country-numeric-codes';
 import { PANEL_REQUEST_READ_SCRIPT, PANEL_REQUEST_RESERVE_SCRIPT } from '../../shared/panel-request-scripts.mjs';
 import { dailyCounterKey, dailyQuotaFloorKey, envPrefix, PRO_DAILY_QUOTA_TTL_SECONDS } from '../../server/_shared/pro-mcp-token';
+import type { NaturalDisastersPanelRead } from './_natural-disasters-reuse';
 import { conflictPanelReuseUntil, isConflictPanelSnapshotCacheable } from './registry/cache-tools';
 import { resolveDailyLimit, type McpBudget } from './quota';
 import type { McpAuthContext, PipelineFn } from './types';
@@ -18,7 +19,7 @@ const MAX_CACHED_BYTES = 524288;
 const encoder = new TextEncoder();
 
 type PanelScope = { panel: string; window: string; expires: number };
-export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission;
+export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission | DisasterPanelAdmission;
 export class PanelRequestError extends Error {
   constructor(message: string, public code: 'invalid' | 'quota' | 'reads' | 'backend', public limit?: number, public retryAfter?: number) {
     super(message);
@@ -30,8 +31,8 @@ function userId(context: McpAuthContext): string {
   if (context.kind !== 'pro' && context.kind !== 'user_key') throw new PanelRequestError('A paid user-bound connection is required.', 'invalid');
   return context.userId;
 }
-function panelFamily(panel: string): 'country' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' {
-  return panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' ? panel : 'country';
+function panelFamily(panel: string): 'country' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' | 'disasters' {
+  return panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' || panel === 'disasters' ? panel : 'country';
 }
 function panelKey(owner: string, scope: PanelScope): string {
   return `${dailyCounterKey(owner, new Date(scope.expires - 1))}:${panelFamily(scope.panel)}:${scope.panel}:${scope.window}`;
@@ -88,6 +89,12 @@ export async function admitConflictPanel(context: McpAuthContext, budget: McpBud
   return { ...await admitPanel(context, budget, pipeline, 'conflicts', parsed.data, now), panel: 'conflicts' };
 }
 
+export async function admitDisasterPanel(context: McpAuthContext, budget: McpBudget | undefined, pipeline: PipelineFn, args: Record<string, unknown>, now = Date.now()): Promise<DisasterPanelAdmission> {
+  const parsed = disasterPanelViewSchema.safeParse(args);
+  if (!parsed.success) throw new PanelRequestError('Supply valid disaster filters and a request_id for refresh.', 'invalid');
+  return { ...await admitPanel(context, budget, pipeline, 'disasters', parsed.data, now), panel: 'disasters' };
+}
+
 async function admitPanel(context: McpAuthContext, budget: McpBudget | undefined, pipeline: PipelineFn, country: string, request: { refresh: boolean; request_id?: string }, now: number) {
   if (budget?.allowance === 'api') throw new PanelRequestError('API allowances use per-tool billing.', 'invalid');
   const owner = userId(context);
@@ -120,6 +127,10 @@ async function admitPanel(context: McpAuthContext, budget: McpBudget | undefined
 }
 
 function checkReadScope(name: s
```

**File**: `api/mcp/registry/cache-tools.ts` (modified, +4/-2)
```diff
@@ -1282,11 +1282,13 @@ export const CACHE_TOOLS: ToolDef[] = [
     name: 'get_natural_disasters',
     _uiResourceUri: NATURAL_DISASTERS_UI_URI,
     _outputBudgetBytes: 131072,
-    description: 'Recent M4.5+ earthquakes (USGS and Earthquakes Canada / NRCan), active wildfires (NASA FIRMS), and natural hazard events. Includes magnitude, location, source, and threat severity.',
+    description: 'Recent M4.5+ earthquakes (USGS and Earthquakes Canada / NRCan), active wildfires (NASA FIRMS), and natural hazard events. Pro panels charge one allocation per opening; repeated views reuse the admission. Snapshot reuse is bounded by source clocks and known health, not complete provider coverage.',
     inputSchema: {
       type: 'object',
       properties: {
-        panel_request: { type: 'string', maxLength: 160, description: 'Server-issued news dashboard request token for its bounded internal map snapshots.' },
+        panel_request: { type: 'string', maxLength: 160, description: 'Server-issued Natural Disasters panel token, or the existing news token for its exact bounded map reads. Omit for an ordinary paid opening; a news token cannot widen its map scope.' },
+        refresh: { type: 'boolean', description: 'Paid standalone panel only. Explicitly open one new allocation. Omit panel_request and supply a UUID request_id.' },
+        request_id: { type: 'string', format: 'uuid', description: 'Paid standalone refresh identity. Retrying the same UUID reuses that allocation.' },
         dataset: {
           type: 'array',
           items: { type: 'string', enum: ['earthquakes', 'wildfires', 'other'] },
```

**File**: `docs/mcp-apps.mdx` (modified, +6/-0)
```diff
@@ -105,6 +105,12 @@ Each admission permits up to 64 uncached tool executions, with separate 64-per-m
 
 Optional `conflict_source.ucdp` copies only correctly typed `fetchedAt`, `candidateVersion`, `candidateComplete` and `annualFailedPages` from already-read UCDP metadata. Missing fields stay absent. Known partial, missing, malformed, stale or incompatible observations remain retryable under the receipt. Usable collections still honor their filters when another source is degraded. The observation does not establish atomic publication, complete unrest-provider coverage or independent CII/Iran freshness.
 
+## Natural Disasters Accounting
+
+On Pro and Pro Business, `get_natural_disasters` opens one Natural Disasters allocation. Repeated opens and dataset, magnitude, activity and limit filters reuse that admission within five minutes. Use its returned `panelRequest.token` as `panel_request` for bounded reads. Explicit refresh needs `refresh: true`, a UUID `request_id`, and no reader token; the same UUID retries the refresh allocation. API and free-account callers keep ordinary per-tool charging and existing filter coercions, and reject the paid refresh controls.
+
+Each uncached execution reads three fixed data keys and the existing seismology metadata key as one logical read within the 64-read admission. Exact successful filtered originals replay before summary or JMESPath only until the earliest observable source or EONET retention deadline. A new filter or unavailable, malformed, known degraded or unknown-clock observation can reread under the same allocation. Blocked regional source decisions remain readable but uncached, including zero-request preflight decisions. This does not establish complete provider coverage. The existing news token still permits only its exact hazard dataset list and limits 100, 20 or 1; it cannot use standalone magnitude or activity filters. Source data and internal deadlines do not add public metadata fields. Confirmed current usage accompanies authorized reads; an unknown counter omits the numeric notice.
+
 ## View Security
 
 The app shells are deliberately static and narrow:
```

**File**: `docs/mcp-overview.mdx` (modified, +7/-0)
```diff
@@ -614,3 +614,10 @@ Triage from the outside in: HTTP status → JSON-RPC code → soft envelope. The
 - [Authentication overview](/authentication) — browser vs bearer vs OAuth
 - [API Reference](/api-reference) — the same data via REST
 - [Pro features](https://www.worldmonitor.app/pro)
+
+
+## Natural Disasters Panel Requests
+
+On Pro and Pro Business, `get_natural_disasters` opens one Natural Disasters allocation. Repeated opens and dataset, magnitude, activity and limit filters reuse that admission within five minutes. Use its returned `panelRequest.token` as `panel_request` for bounded reads. Explicit refresh needs `refresh: true`, a UUID `request_id`, and no reader token; the same UUID retries the refresh allocation. API and free-account callers keep ordinary per-tool charging and existing filter coercions, and reject the paid refresh controls.
+
+Each uncached execution reads three fixed data keys and the existing seismology metadata key as one logical read within the 64-read admission. Exact successful filtered originals replay before summary or JMESPath only until the earliest observable source or EONET retention deadline. A new filter or unavailable, malformed, known degraded or unknown-clock observation can reread under the same allocation. Blocked regional source decisions remain readable but uncached, including zero-request preflight decisions. This does not establish complete provider coverage. The existing news token still permits only its exact hazard dataset list and limits 100, 20 or 1; it cannot use standalone magnitude or activity filters. Source data and internal deadlines do not add public metadata fields. Confirmed current usage accompanies authorized reads; an unknown counter omits the numeric notice.
```

**File**: `docs/mcp-tools-reference.mdx` (modified, +7/-1)
```diff
@@ -2470,7 +2470,9 @@ Recent M4.5+ earthquakes (USGS and Earthquakes Canada / NRCan), active wildfires
 
 | Name | Type | Description |
 |------|------|-------------|
-| `panel_request` | string | Server-issued news dashboard request token for its bounded internal map snapshots. |
+| `panel_request` | string | Server-issued Natural Disasters panel token, or the existing news token for its exact bounded map reads. Omit for an ordinary paid opening; a news token cannot widen its map scope. |
+| `refresh` | boolean | Paid standalone panel only. Explicitly open one new allocation. Omit panel_request and supply a UUID request_id. |
+| `request_id` | string | Paid standalone refresh identity. Retrying the same UUID reuses that allocation. |
 | `dataset` | `array<string: earthquakes / wildfires / other>` | Restrict to one or more hazard datasets (earthquakes / wildfires / other natural events). Omit for all. |
 | `min_magnitude` | number | Drop earthquakes and natural events below this magnitude. |
 | `active_only` | boolean | Keep only natural events that are still active (not closed). |
@@ -2496,6 +2498,10 @@ curl -s https://worldmonitor.app/mcp \
 
 </CodeGroup>
 
+On Pro and Pro Business, `get_natural_disasters` opens one Natural Disasters allocation. Repeated opens and dataset, magnitude, activity and limit filters reuse that admission within five minutes. Use its returned `panelRequest.token` as `panel_request` for bounded reads. Explicit refresh needs `refresh: true`, a UUID `request_id`, and no reader token; the same UUID retries the refresh allocation. API and free-account callers keep ordinary per-tool charging and existing filter coercions, and reject the paid refresh controls.
+
+Each uncached execution reads three fixed data keys and the existing seismology metadata key as one logical read within the 64-read admission. Exact successful filtered originals replay before summary or JMESPath only until the earliest observable source or EONET retention deadline. A new filter or unavailable, malformed, known degraded or unknown-clock observation can reread under the same allocation. Blocked regional source decisions remain readable but uncached, including zero-request preflight decisions. This does not establish complete provider coverage. The existing news token still permits only its exact hazard dataset list and limits 100, 20 or 1; it cannot use standalone magnitude or activity filters. Source data and internal deadlines do not add public metadata fields. Confirmed current usage accompanies authorized reads; an unknown counter omits the numeric notice.
+
 ### `get_radiation_data`
 
 Radiation observation levels from global monitoring stations. Flags anomalous readings that may indicate nuclear incidents.
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +6/-0)
```diff
@@ -95,6 +95,12 @@ View -> Host: ui/notifications/size-changed
 
 可选的 `conflict_source.ucdp` 仅复制已读取 UCDP 元数据中类型正确的 `fetchedAt`、`candidateVersion`、`candidateComplete` 和 `annualFailedPages`，缺失字段保持缺失。已知不完整、缺失、格式错误、过期或不兼容的数据不作为成功缓存，可使用原凭据重试。其他来源降级时，可用列表仍按请求筛选。该观察不能证明原子发布、所有动荡提供方的完整覆盖或 CII/伊朗数据的独立新鲜度。
 
+## 自然灾害计量
+
+在 Pro 与 Pro Business 上，`get_natural_disasters` 首次打开扣一次自然灾害面板额度。重复打开及数据集、震级、活动状态和数量筛选在五分钟内复用该分配。使用返回的 `panelRequest.token` 作为 `panel_request` 进行受限读取。显式刷新需提供 `refresh: true` 和 UUID 格式的 `request_id`，且不携带读取凭据；同一 UUID 的重试复用刷新额度。API 与免费账户调用保留普通按工具计费及现有参数转换，不接受付费刷新控制。
+
+每次未缓存执行读取三个固定数据键及已存在的地震元数据键，作为 64 次读取预算中的一次工具执行。相同筛选的成功原始结果在摘要或 JMESPath 呈现之前回放，但不得超过最早可观察的来源时效或 EONET 保留期限。新筛选或不可用、格式错误、已知降级、时间未知的数据可在同一分配内重新读取。区域来源的阻止决策保持可读但不缓存，包括未发出请求的预检决策。该策略不证明所有提供方覆盖完整。已有新闻凭据仍仅允许其固定灾害数据集列表及数量 100、20 或 1，不能使用独立面板的震级或活动筛选。内部来源时间和复用期限不会添加公开元数据字段。授权读取返回已确认的当前使用量；计数未知时省略数字通知。
+
 ## 视图安全
 
 应用外壳被刻意设计得静态且受限：
```

---

### Incident Patch 15: `224c847f` (2026-10-05)
**Commit Message**: fix(plugin): share conflict panel allocation and expire stale replay (#8840)

* test(mcp): cover curated market panel admission

* feat(mcp): admit curated market panels once per opening

* test(mcp): cover uppercase panel refresh UUIDs

* fix(mcp): canonicalize panel refresh UUID case

* docs(mcp): describe curated market panel accounting

* test(mcp): reproduce missing market receipt usage metadata

* fix(mcp): preserve current usage on authorized market receipt results

* test(mcp): keep ordinary quota probes on a non-panel tool

* test(mcp): preserve ordinary quota lifecycle coverage

* test: reproduce prediction panel accounting and receipt failures

* fix: share paid prediction panel allocation across filters and reads

* test: reproduce unavailable prediction replay and pin bounded output

* fix: keep unavailable prediction snapshots retryable

* test: reject unknown prediction replay envelopes

* fix: preserve unknown prediction envelopes as retryable

* docs(mcp): describe prediction panel reuse and refresh

* docs(mcp): align prediction parameter table with schema

* test(mcp): reproduce selected prediction cache masking source health

* fix(mcp): retain prediction source

**File**: `api/mcp/dispatch.ts` (modified, +33/-6)
```diff
@@ -15,12 +15,13 @@ import { mcpErrorFingerprint } from './error-fingerprint';
 import { argBool, summarizeData } from './filters';
 import { evaluateFreshness } from './freshness';
 import { applyJmespath } from './jmespath';
-import { admitCountryPanel, admitForecastPanel, admitMarketPanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
+import { admitConflictPanel, admitCountryPanel, admitForecastPanel, admitMarketPanel, admitNewsPanel, admitPredictionPanel, authorizePanelRead, PANEL_READ_LIMIT, PanelRequestError, type PaidPanelAdmission } from './panel-requests';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
-import { forecastPanelReadSchema, marketPanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
+import { conflictPanelViewSchema, forecastPanelReadSchema, marketPanelViewSchema, predictionPanelViewSchema, type PanelUsage } from '../../shared/panel-admission';
 import { isSharedRestCounter, readDailyAllowance, reserveQuota, resolveDailyLimit, type McpBudget } from './quota';
 import { reserveFreeAccountAllowance } from './free-account-allowance';
 import { buildMcpStructuredDenial, type McpDenial } from './upgrade';
+import { filterConflictPanelEvents, presentConflictEvents, projectConflictSourceObservation } from './registry/cache-tools';
 import { isQuotaExemptMetadataTool, toolAccess, toolWeight, TOOL_REGISTRY } from './registry/index';
 import { rpcError, rpcOk, withMcpNoStore } from './rpc';
 import { McpSourceUnavailableError } from './source-unavailable';
@@ -32,6 +33,7 @@ import {
 } from './telemetry';
 import type {
   CacheToolDef,
+  ConflictSourceObservation,
   McpAuthContext,
   McpHandlerDeps,
   McpToolExecutionContext,
@@ -54,6 +56,7 @@ export async function executeTool(
   now?: number,
   execution?: McpToolExecutionContext,
 ): Promise<{
+  conflict_source?: ConflictSourceObservation;
   cached_at: string | null;
   stale: boolean;
   activationUnknown?: true;
@@ -229,6 +232,7 @@ export async function executeTool(
   if (argBool(params.summary)) result = tool._summarize ? tool._summarize(result) : summarizeData(result);
 
   return {
+    ...(tool.name === 'get_conflict_events' ? { conflict_source: projectConflictSourceObservation(metas[freshnessChecks.findIndex(check => check.key === 'seed-meta:conflict:ucdp-events')]) } : {}),
     cached_at,
     stale,
     ...(activationUnknown ? { activationUnknown: true } : {}),
@@ -409,6 +413,22 @@ export async function dispatchToolsCall(
   const callArguments = Object.fromEntries(Object.entries(p.arguments ?? {}).filter(([key]) => key !== 'panel_request'));
   let sourceArguments = callArguments;
   try {
+    if (tool.name === 'get_conflict_events') {
+      if (!dedicatedPanel && ('refresh' in callArguments || 'request_id' in callArguments)) throw new PanelRequestError('Conflict refresh controls require a paid panel allowance.', 'invalid');
+      if (dedicatedPanel) {
+        const { summary: _summary, jmespath: _projection, ...view } = callArguments;
+        const parsed = conflictPanelViewSchema.safeParse(view);
+        if (!parsed.success) throw new PanelRequestError('Supply valid conflict filters and a request_id for refresh.', 'invalid');
+        const { refresh, request_id: _requestId, ...filters } = parsed.data;
+        sourceArguments = filters;
+        if (suppliedPanel !== undefined && refresh) throw new PanelRequestError('Refresh the conflict panel without a reader token.', 'invalid');
+        if (suppliedPanel === undefined) {
+          panelRequest = await admitConflictPanel(context, budget, deps.redisPipeline, parsed.data);
+          panelUsage = panelRequest.usage;
+          panelRead = await authorizePanelRead(context, deps.redisPipeline, tool.name, filters, panelRequest.token);
+        }
+      }
+    }
     if (tool.name === 'get_prediction_markets') {
       if (!dedicatedPanel && ('refresh' in callArguments || 'request_id' in callArguments)) throw new PanelRequestError('Prediction refresh controls require a paid panel allowance.', 'invalid');
       if (dedicatedPanel) {
@@ -463,7 +483,7 @@ export async function dispatchToolsCall(
       if (limited) return limited;
     }
     await panelRead?.reserveUncachedRead();
-    if ((tool.name === 'get_market_data' || tool.name === 'get_prediction_markets') && suppliedPanel !== undefined && panelRead
+    if ((tool.name === 'get_market_data' || tool.name === 'get_prediction_markets' || tool.name === 'get_conflict_events') && suppliedPanel !== undefined && panelRead
       && (context.kind === 'pro' || context.kind === 'user_key')) {
       const allowance = await readDailyAllowance(context.userId, deps.redisPipeline, budget);
       if (allowance && allowance.used > 0) panelUsage = { ...allowance, unit: 'requests' };
@@ -579,7 +599,12 @@ export async function dispatchToolsCall(
         co
```

**File**: `api/mcp/panel-requests.ts` (modified, +35/-10)
```diff
@@ -2,12 +2,13 @@ import { countryActivityQueries } from '../../shared/country-activity-query';
 import { z } from 'zod';
 import { countryReaderSchema, COUNTRY_READERS, countryViewSchema, type PanelAdmission } from '../../shared/country-brief-host';
 import { resolveCountryCode } from '../../shared/country-code-resolve';
-import { forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
+import { conflictPanelReadSchema, conflictPanelViewSchema, type ConflictPanelAdmission, forecastCaseReadSchema, forecastPanelReadSchema, forecastPanelViewSchema, marketPanelReadSchema, marketPanelViewSchema, predictionPanelReadSchema, predictionPanelViewSchema, type ForecastPanelAdmission, type MarketPanelAdmission, type NewsPanelAdmission, type PredictionPanelAdmission } from '../../shared/panel-admission';
 import { parseNewsDashboardRequest } from '../../shared/plugin-news-view';
 import { forecastTheaterReadSchema, reusableForecastTheaterResult } from '../../shared/forecast-theaters';
 import { iso2ToComtradeReporterCode, iso2ToUnCode } from '../../shared/country-numeric-codes';
 import { PANEL_REQUEST_READ_SCRIPT, PANEL_REQUEST_RESERVE_SCRIPT } from '../../shared/panel-request-scripts.mjs';
 import { dailyCounterKey, dailyQuotaFloorKey, envPrefix, PRO_DAILY_QUOTA_TTL_SECONDS } from '../../server/_shared/pro-mcp-token';
+import { conflictPanelReuseUntil, isConflictPanelSnapshotCacheable } from './registry/cache-tools';
 import { resolveDailyLimit, type McpBudget } from './quota';
 import type { McpAuthContext, PipelineFn } from './types';
 
@@ -17,7 +18,7 @@ const MAX_CACHED_BYTES = 524288;
 const encoder = new TextEncoder();
 
 type PanelScope = { panel: string; window: string; expires: number };
-export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission;
+export type PaidPanelAdmission = PanelAdmission | NewsPanelAdmission | ForecastPanelAdmission | MarketPanelAdmission | PredictionPanelAdmission | ConflictPanelAdmission;
 export class PanelRequestError extends Error {
   constructor(message: string, public code: 'invalid' | 'quota' | 'reads' | 'backend', public limit?: number, public retryAfter?: number) {
     super(message);
@@ -29,8 +30,8 @@ function userId(context: McpAuthContext): string {
   if (context.kind !== 'pro' && context.kind !== 'user_key') throw new PanelRequestError('A paid user-bound connection is required.', 'invalid');
   return context.userId;
 }
-function panelFamily(panel: string): 'country' | 'news' | 'forecasts' | 'markets' | 'predictions' {
-  return panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' ? panel : 'country';
+function panelFamily(panel: string): 'country' | 'news' | 'forecasts' | 'markets' | 'predictions' | 'conflicts' {
+  return panel === 'news' || panel === 'forecasts' || panel === 'markets' || panel === 'predictions' || panel === 'conflicts' ? panel : 'country';
 }
 function panelKey(owner: string, scope: PanelScope): string {
   return `${dailyCounterKey(owner, new Date(scope.expires - 1))}:${panelFamily(scope.panel)}:${scope.panel}:${scope.window}`;
@@ -81,6 +82,12 @@ export async function admitPredictionPanel(context: McpAuthContext, budget: McpB
   return { ...await admitPanel(context, budget, pipeline, 'predictions', parsed.data, now), panel: 'predictions' };
 }
 
+export async function admitConflictPanel(context: McpAuthContext, budget: McpBudget | undefined, pipeline: PipelineFn, args: Record<string, unknown>, now = Date.now()): Promise<ConflictPanelAdmission> {
+  const parsed = conflictPanelViewSchema.safeParse(args);
+  if (!parsed.success) throw new PanelRequestError('Supply valid conflict filters and a request_id for refresh.', 'invalid');
+  return { ...await admitPanel(context, budget, pipeline, 'conflicts', parsed.data, now), panel: 'conflicts' };
+}
+
 async function admitPanel(context: McpAuthContext, budget: McpBudget | undefined, pipeline: PipelineFn, country: string, request: { refresh: boolean; request_id?: string }, now: number) {
   if (budget?.allowance === 'api') throw new PanelRequestError('API allowances use per-tool billing.', 'invalid');
   const owner = userId(context);
@@ -113,6 +120,10 @@ async function admitPanel(context: McpAuthContext, budget: McpBudget | undefined
 }
 
 function checkReadScope(name: string, args: Record<string, unknown>, country: string): void {
+  if (country === 'conflicts') {
+    if (name !== 'get_conflict_events' || !conflictPanelReadSchema.safeParse(args).success) throw new PanelRequestError('Panel request only covers conflict events.', 'invalid');
+    return;
+  }
   if (country === 'predictions') {
     if (name !== 'get_predi
```

**File**: `api/mcp/registry/cache-tools.ts` (modified, +167/-76)
```diff
@@ -59,7 +59,7 @@ import {
 } from '../filters';
 import { resolveCountryFilter } from '../_country-args';
 import { RpcValidationError } from '../billing-denial';
-import type { ToolDef } from '../types';
+import type { ConflictSourceObservation, FreshnessCheck, ToolDef } from '../types';
 import { forecastCaseReadSchema, forecastPanelAdmissionSchema } from '../../../shared/panel-admission';
 
 import { utf8ByteLength } from '../utils';
@@ -115,6 +115,11 @@ const IRAN_EVENTS_ENABLED = (process.env.IRAN_EVENTS_ENABLED ?? 'false').toLower
 const CONFLICT_EVENTS_OUTPUT_BUDGET_BYTES = 128 * 1024;
 const CONFLICT_EVENTS_DATA_BUDGET_BYTES = CONFLICT_EVENTS_OUTPUT_BUDGET_BYTES - 1024;
 const CONFLICT_EVENT_LISTS = ['ucdp-events', 'iran-events', 'events'] as const;
+const CONFLICT_EVENTS_FRESHNESS_CHECKS: [FreshnessCheck, ...FreshnessCheck[]] = [
+  { key: 'seed-meta:conflict:ucdp-events', maxStaleMin: 30 },
+  { key: 'seed-meta:unrest:events', maxStaleMin: 120 },
+];
+const CONFLICT_PANEL_COLLECTIONS: [string, string][] = [['ucdp-events', 'events'], ['events', 'events'], ['scores', 'ciiScores'], ...(IRAN_EVENTS_ENABLED ? [['iran-events', 'events'] as [string, string]] : [])];
 const CROSS_SOURCE_SIGNAL_TYPES = [
   'CROSS_SOURCE_SIGNAL_TYPE_COMPOSITE_ESCALATION',
   'CROSS_SOURCE_SIGNAL_TYPE_THERMAL_SPIKE',
@@ -204,6 +209,92 @@ function fitConflictEventsToBudget(data: Record<string, unknown>): void {
   }
 }
 
+function conflictRecord(value: unknown): value is Record<string, unknown> {
+  return value !== null && typeof value === 'object' && !Array.isArray(value);
+}
+
+function isConflictSourceDataUsable(data: Record<string, unknown>): boolean {
+  if (['partial', 'stale', 'unavailable', 'upstreamUnavailable', 'degraded'].some(flag => data[flag] === true)) return false;
+  return CONFLICT_PANEL_COLLECTIONS.every(([label, field]) => {
+    const bucket = data[label];
+    if (!conflictRecord(bucket)) return false;
+    const rows = bucket[field];
+    return Array.isArray(rows) && rows.every(conflictRecord)
+      && !['partial', 'stale', 'unavailable', 'upstreamUnavailable', 'rateLimited', 'degraded'].some(flag => bucket[flag] === true)
+      && !(typeof bucket.error === 'string' && bucket.error !== '');
+  });
+}
+
+export function isConflictPanelSnapshotCacheable(value: unknown): boolean {
+  if (!conflictRecord(value) || value.stale !== false || value.freshnessUnknown === true
+    || typeof value.cached_at !== 'string' || !Number.isFinite(Date.parse(value.cached_at))
+    || Array.isArray(value.unreadable) && value.unreadable.length
+    || !conflictRecord(value.data) || !isConflictSourceDataUsable(value.data)) return false;
+  const source = value.conflict_source;
+  if (!conflictRecord(source) || !conflictRecord(source.ucdp)) return false;
+  const meta = source.ucdp;
+  const ucdp = value.data['ucdp-events'] as Record<string, unknown>;
+  return typeof meta.fetchedAt === 'number' && Number.isFinite(meta.fetchedAt) && meta.fetchedAt > 0
+    && meta.candidateComplete === true && meta.annualFailedPages === 0
+    && typeof meta.candidateVersion === 'string' && meta.candidateVersion.trim() !== '' && !meta.candidateVersion.includes('+partial')
+    && meta.candidateVersion === ucdp.candidateVersion
+    && (ucdp.candidateComplete === undefined || ucdp.candidateComplete === true)
+    && (ucdp.annualFailedPages === undefined || ucdp.annualFailedPages === 0);
+}
+
+export function conflictPanelReuseUntil(value: unknown, now = Date.now()): number | null {
+  if (!conflictRecord(value) || !isConflictPanelSnapshotCacheable(value)) return null;
+  const cachedAt = Date.parse(value.cached_at as string);
+  const source = value.conflict_source as ConflictSourceObservation;
+  if (cachedAt > now || (source.ucdp.fetchedAt ?? Number.POSITIVE_INFINITY) > now) return null;
+  const deadline = cachedAt + Math.min(...CONFLICT_EVENTS_FRESHNESS_CHECKS.map(check => check.maxStaleMin)) * 60_000;
+  return deadline > now ? deadline : null;
+}
+
+export function projectConflictSourceObservation(value: unknown): ConflictSourceObservation {
+  const ucdp: ConflictSourceObservation['ucdp'] = {};
+  if (conflictRecord(value)) {
+    if (typeof value.fetchedAt === 'number' && Number.isFinite(value.fetchedAt) && value.fetchedAt > 0) ucdp.fetchedAt = value.fetchedAt;
+    if (typeof value.candidateVersion === 'string' || value.candidateVersion === null) ucdp.candidateVersion = value.candidateVersion;
+    if (typeof value.candidateComplete === 'boolean') ucdp.candidateComplete = value.candidateComplete;
+    if (Number.isSafeInteger(value.annualFailedPages) && (value.annualFailedPages as number) >= 0) ucdp.annualFailedPages = value.annualFailedPages as number;
+  }
+  return { ucdp };
+}
+
+function filterConflictEvents(data: Record<string, unknown>, params: Record<string, unknown>): Record<string, unknown> {
+  const country = argStr(params.country);
+  const minFatal = argNum(params.min_fatalities);
+  const limit = argNum(params.lim
```

**File**: `api/mcp/types.ts` (modified, +9/-0)
```diff
@@ -44,6 +44,15 @@ export type McpInboundHostClass =
   | 'vercel_preview'
   | 'other';
 
+export type ConflictSourceObservation = {
+  ucdp: {
+    fetchedAt?: number;
+    candidateVersion?: string | null;
+    candidateComplete?: boolean;
+    annualFailedPages?: number;
+  };
+};
+
 export interface McpToolExecutionContext {
   panelRequest?: import('./panel-requests').PaidPanelAdmission;
   panelScope?: 'forecasts';
```

**File**: `docs/mcp-apps.mdx` (modified, +8/-0)
```diff
@@ -97,6 +97,14 @@ The reader shares the opening allocation and its 64 uncached-read budget. Comple
 
 All methods still count toward the 60/minute per-key, per-user, or anonymous-IP rate limiter.
 
+## Conflict Events Accounting
+
+On Pro and Pro Business, `get_conflict_events` opens one paid Conflict Events allocation. Country, fatality and limit filters and repeated opens reuse it within five minutes. Use the returned `panelRequest.token` as `panel_request` for bounded reads. Set `refresh: true` with a UUID `request_id` and omit `panel_request` for one new allocation; the same UUID retries it. API and free-account calls keep ordinary per-tool billing and reject these paid controls.
+
+Each admission permits up to 64 uncached tool executions, with separate 64-per-minute uncached and cached-replay limits. One uncached execution reads five fixed Redis keys, or six when Iran events are enabled; these reads do not each spend an allocation. Identical successful filtered originals replay before summary or JMESPath presentation. An authorized receipt read includes current usage when confirmed; unknown usage omits the numeric notice.
+
+Optional `conflict_source.ucdp` copies only correctly typed `fetchedAt`, `candidateVersion`, `candidateComplete` and `annualFailedPages` from already-read UCDP metadata. Missing fields stay absent. Known partial, missing, malformed, stale or incompatible observations remain retryable under the receipt. Usable collections still honor their filters when another source is degraded. The observation does not establish atomic publication, complete unrest-provider coverage or independent CII/Iran freshness.
+
 ## View Security
 
 The app shells are deliberately static and narrow:
```

**File**: `docs/mcp-overview.mdx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ Looking for tools that operate the dashboard already open in a Chrome tab? See [
 OAuth is not needed for `get_sources`: it is the sole credential-free, daily-quota-free data tool. Anonymous calls use a separate fail-closed limit of 10 requests/minute/IP. Other data tools require a user-bound credential. Tools marked `free-account` (direct cache reads) can use the small confirmed-free allowance; tools marked `subscription` (everything with server-side execute logic — live fetches, plus a few local-compute tools) require Pro.
 </Info>
 
-All paid tiers share the same MCP server and tool inventory, but they are metered two different ways. **Pro and Pro Business** have no REST allowance, so their MCP requests use a dedicated daily counter of **50** and **250** units per UTC day. A standalone data call costs one unit. A country brief, news dashboard, curated market panel, or prediction panel costs one unit including its authorized internal reads. Curated market and prediction filters and repeated opens reuse their respective admissions within five minutes. An explicit refresh with a new UUID costs one new unit. See [Paid embedded-panel requests](/usage-rate-limits#paid-embedded-panel-requests). **API Starter and API Business** carry no separate MCP allowance. Their MCP calls draw on the same daily budget as their REST requests (1,000 and 10,000/day), charged at a per-tool weight of 1 for a cached read, 2 for a live downstream fetch, 3 for `get_country_brief`, and 5 for `get_airspace` (up to four downstream requests across the dateline). Both the OAuth and `wm_…` doors resolve the same budget, so the credential you use does not change the cap. Enterprise OAuth can be unlimited, and only legacy operator keys explicitly allowlisted by the deployment skip the daily reservation. Every authenticated context also passes a per-minute burst limiter, set by plan: **60 requests/minute** on Pro, Pro Business and API Starter, **300** on API Business, **1,000** on Enterprise. `get_sources` and the metadata helper `describe_tool` are exempt from the daily quota. Full weight table: [MCP calls against an API plan](/usage-rate-limits#mcp-calls-against-an-api-plan).
+All paid tiers share the same MCP server and tool inventory, but they are metered two different ways. **Pro and Pro Business** have no REST allowance, so their MCP requests use a dedicated daily counter of **50** and **250** units per UTC day. A standalone data call costs one unit. A country brief, news dashboard, curated market panel, prediction panel, or Conflict Events panel costs one unit including its authorized internal reads. Curated market, prediction and Conflict Events filters and repeated opens reuse their respective admissions within five minutes. An explicit refresh with a new UUID costs one new unit; the same UUID retries that allocation. An authorized Conflict Events receipt read also queries current usage without another allocation, and unknown usage omits the numeric notice. See [Paid embedded-panel requests](/usage-rate-limits#paid-embedded-panel-requests). **API Starter and API Business** carry no separate MCP allowance. Their MCP calls draw on the same daily budget as their REST requests (1,000 and 10,000/day), charged at a per-tool weight of 1 for a cached read, 2 for a live downstream fetch, 3 for `get_country_brief`, and 5 for `get_airspace` (up to four downstream requests across the dateline). Both the OAuth and `wm_…` doors resolve the same budget, so the credential you use does not change the cap. Enterprise OAuth can be unlimited, and only legacy operator keys explicitly allowlisted by the deployment skip the daily reservation. Every authenticated context also passes a per-minute burst limiter, set by plan: **60 requests/minute** on Pro, Pro Business and API Starter, **300** on API Business, **1,000** on Enterprise. `get_sources` and the metadata helper `describe_tool` are exempt from the daily quota. Full weight table: [MCP calls against an API plan](/usage-rate-limits#mcp-calls-against-an-api-plan).
 
 Pro subscribers can connect Claude Desktop / Cursor / claude.ai without ever pasting an API key — see [Pro sign-in flow](#pro-sign-in-flow) below. API Starter+ holders may continue to paste a `wm_…` key on the consent page (the original flow), or use the same OAuth path as Pro.
 
```

**File**: `docs/mcp-tools-reference.mdx` (modified, +6/-0)
```diff
@@ -1042,9 +1042,15 @@ Active armed conflict events (UCDP, Iran), unrest events with geo-coordinates, a
 | `country` | string | Filter to one country — matches the country name on conflict/unrest events and the ISO 3166-1 alpha-2 region code on risk scores (case-insensitive). |
 | `min_fatalities` | number | Drop events below this fatality count (UCDP deathsBest / unrest fatalities). |
 | `limit` | number | Cap each event list to at most this many items (default 30, pass 0 for no cap). |
+| `panel_request` | string | Paid conflict panel receipt for bounded internal filtered reads without another daily allocation. |
+| `refresh` | boolean | Request one new paid conflict panel allocation. Requires request_id and no panel_request. |
+| `request_id` | string | Retry identity for an explicit paid refresh. Reuse the ID to avoid another allocation. |
 
 - **API endpoints:** `GET /api/conflict/v1/list-iran-events`, `GET /api/conflict/v1/list-ucdp-events`, `GET /api/unrest/v1/list-unrest-events`
 - **Access:** `free-account` — callable by any signed-in account; free accounts spend the daily free allowance, Pro calls spend the daily quota. Accepts the universal `summary` argument.
+- **Paid panel accounting:** Pro and Pro Business spend one allocation for an opening. Canonical filters and repeated opens share the Conflict Events admission within five minutes. Each admission permits up to 64 uncached tool executions, with separate 64-per-minute uncached and successful cached-replay limits. Each execution reads five fixed Redis keys, or six with Iran enabled; these reads do not each spend an allocation.
+- **Reuse and refresh:** Successful filtered originals replay before summary or JMESPath presentation. Explicit refresh with a new UUID spends one new allocation; the same UUID retries it. An authorized receipt read queries current usage without reserving another unit. Unknown counters preserve data and omit the numeric notice. Paid calls reject unknown arguments and non-finite numeric filters before reservation. Ordinary API and free calls retain existing filter coercion and reject paid receipts or refresh controls.
+- **Source observation and recovery:** Optional `conflict_source.ucdp` preserves only correctly typed `fetchedAt`, `candidateVersion`, `candidateComplete` and `annualFailedPages` from already-read metadata. Missing fields stay absent. Known partial, missing, malformed, stale or incompatible observations remain retryable. Usable collections still honor their filters. Data and metadata are not an atomic snapshot; the observation does not prove complete unrest-provider coverage or independent CII/Iran freshness.
 - **Kind:** cache read — sub-second response from Redis bootstrap cache.
 - **Freshness budget:** per slice — UCDP conflict events **30 min**, unrest events **2 h**. The single `stale` flag ORs both checks, so it flips as soon as either slice exceeds its own budget.
 
```

**File**: `docs/zh/mcp-apps.mdx` (modified, +8/-0)
```diff
@@ -87,6 +87,14 @@ View -> Host: ui/notifications/size-changed
 
 所有方法仍计入每密钥、每用户或匿名 IP 每分钟 60 次的速率限制器。
 
+## 冲突事件计量
+
+在 Pro 与 Pro Business 上，`get_conflict_events` 的首次打开扣一次冲突事件面板额度。国家、死亡人数和数量筛选及重复打开在五分钟内复用该分配。使用返回的 `panelRequest.token` 作为 `panel_request` 进行受限读取。显式刷新需设置 `refresh: true`，提供 UUID 格式的 `request_id`，并省略 `panel_request`；刷新扣一次新额度，同一 UUID 的重试复用该分配。API 和免费账户调用保留普通按工具计费，不接受这些付费控制。
+
+每份分配最多允许 64 次未缓存工具执行，未缓存执行与已确认缓存回放分别限制为每分钟 64 次。每次未缓存执行读取五个固定 Redis 键，启用伊朗事件时为六个；各键读取不会分别扣面板额度。相同筛选的成功原始结果在摘要或 JMESPath 呈现之前回放。授权凭据读取在使用量已确认时返回当前通知，使用量未知时省略数字通知。
+
+可选的 `conflict_source.ucdp` 仅复制已读取 UCDP 元数据中类型正确的 `fetchedAt`、`candidateVersion`、`candidateComplete` 和 `annualFailedPages`，缺失字段保持缺失。已知不完整、缺失、格式错误、过期或不兼容的数据不作为成功缓存，可使用原凭据重试。其他来源降级时，可用列表仍按请求筛选。该观察不能证明原子发布、所有动荡提供方的完整覆盖或 CII/伊朗数据的独立新鲜度。
+
 ## 视图安全
 
 应用外壳被刻意设计得静态且受限：
```

#### Recent Merged Pull Requests:
- **PR #8864** (2026-10-05): fix(gateway): drain handler side channels from the request the handler received (@Yigtwxx)
- **PR #8862** (2026-10-05): fix(api): stop publishing country-located items at 0,0 (@koala73)
- **PR #8861** (2026-10-05): fix(map): apply the time-range selector to every dated layer (@koala73)
- **PR #8860** (2026-10-05): fix(outages): place every Cloudflare Radar anomaly on the map (@koala73)
- **PR #8859** (2026-10-05): fix(aviation): place FAA-only airports at their real coordinates (@koala73)
- **PR #8858** (2026-10-05): fix(plugin): disclose retained Country Brief digest coverage (@koala73)
- **PR #8857** (2026-10-05): fix(plugin): resolve news categories against loaded identities (@koala73)
- **PR #8856** (2026-10-05): feat(mcp): expose protected account allowance status (@koala73)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

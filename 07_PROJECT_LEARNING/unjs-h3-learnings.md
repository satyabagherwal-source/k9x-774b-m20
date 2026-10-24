> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/unjs-h3-learnings.md`  
> **Source**: github ([https://github.com/unjs/h3](https://github.com/unjs/h3))  
> **Source Version**: `f0e17808`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-24T19:50:13.222Z  
> **Learning ID**: `learn-github-h3js-h3`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): h3js/h3

> **Canonical Artifact**: `07_PROJECT_LEARNING/unjs-h3-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/unjs/h3](https://github.com/unjs/h3))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-24T19:50:11.361Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `h3js/h3`
- **Description**: ⚡️ Minimal H(TTP) framework built for high performance and portability 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5470 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/_entries/service-worker.ts`
```
import type { ServerOptions, Server } from "srvx";
import type { H3 } from "../h3.ts";
import { serve as srvxServe } from "srvx/service-worker";
import { freezeApp } from "./_common.ts";

// Main exports
export * from "../index.ts";

/**
 * Serve the H3 app.
 */
export function serve(app: H3, options?: Omit<ServerOptions, "fetch">): Server {
  freezeApp(app);
  return srvxServe({ fetch: app.fetch, ...options }) as Server;
}

```

### Core Architecture Module: `src/rules/handlers/_utils.ts`
```
import { HTTPError } from "../../error.ts";
import type { H3Event } from "../../event.ts";
import { getURLPathname, joinURL, withoutBase } from "../../utils/internal/path.ts";
import { decodedPath, isPathInScope, isPathInServedScope } from "../internal/scope.ts";
import type { ProxyRuleOptions, RedirectRuleOptions } from "../types.ts";
import { interpolateSplat, parseSplatTemplate } from "./_splat.ts";

/**
 * Per-request resolver for a `redirect`/`proxy` rule target, produced once per
 * handler by {@link prepareRuleTarget}.
 */
export type RuleTargetResolver = (event: H3Event) => string;

/**
 * Per-request resolver for the tail a `/**` rule key matched: the request path
 * with the rule's own base stripped, always `/`-prefixed. Throws 400 when the
 * path cannot be faithfully stripped (see {@link prepareTailResolver}).
 */
type TailResolver = (event: H3Event) => string;

// Matches a leading run of path separators, in every form h3's
// `resolveDotSegments` decodes to `/` — collapsed so a base-less wildcard
// target can't be read downstream as a protocol-relative `//host` URL.
const LEADING_SEPARATOR_RUN_RE = /^(?:[/\\]|%(?:25)*(?:2f|5c))+/i;

// Any rou3 pattern syntax that can make a prefix segment dynamic: `:param`,
// `*`, and the regex/partial/escaped forms (`(`, `\`). Deliberately over-broad
// — a segment wrongly treated as dynamic still resolves to the request's own
// (literally matched) segment; only the stricter literal-prefix comparison is
// traded away.
const DYNAMIC_PATTERN_RE = /[:*()\\]/;

// A prefix segment matching a variable number of path segments: a catch-all
// (`**`, `**:rest`) or a modifier param (`:x?` 0-1, `:x*` 0-n, `:x+` 1-n).
const VARIABLE_WIDTH_SEGMENT_RE = /^\*\*|^:.*[?*+]$/;

/**
 * Prepare a redirect or proxy target resolver. Wildcard tails and query strings
 * are forwarded while canonical scope checks prevent traversal.
 */
export function prepareRuleTarget(
  options: RedirectRuleOptions | ProxyRuleOptions | undefined,
): RuleTargetResolver | undefined {
  const target = options?.to;
  if (!target) {
    return;
  }
  const base = options?.base;

  if (target.endsWith("/**")) {
    const baseTarget = target.slice(0, -3);
    // Target's own base path (`to` minus `/**`), used to scope-check the final forwarded target below.
    const baseTargetPath = targetBasePath(baseTarget);
    const resolveTail = prepareTailResolver(base);
    return (event) => {
      // The query rides along with the tail: `stripBase` treats `?` as a segment
      // boundary, so `GET /old?q=1` under base `/old` joins as `/new/?q=1`.
      const resolved = joinURL(baseTarget, resolveTail(event) + event.url.search);
      assertTargetInScope(resolved, baseTargetPath);
      return resolved;
    };
  }

  // A `**` anywhere else in the target — a query value (`/new?from=**`), a
  // mid-path segment (`/new/**/edit`) — interpolates the same matched tail
  // through the same scope checks. Only a rule key ending in `/**` has a tail
  // to capture, and `base` is set exactly then; without one the `**` is left
  // literal, as it always has been.
  const template = base === undefined ? undefined : parseSplatTemplate(target);
  if (template) {
    // Everything ahead of the first placeholder is config-authored text: it
    // fixes the target's own base path, and its origin.
    const prefix = template.literals[0]!;
    const baseTargetPath = targetBasePath(prefix);
    const resolveTail = prepareTailResolver(base);
    return (event) => {
      // Drop the tail's leading `/`: a path placeholder is written with its own
      // separator (`/new/**/edit`), and a value placeholder wants none at all.
      const resolved = interpolateSplat(template, resolveTail(event).slice(1));
      assertTargetInScope(resolved, baseTargetPath);
      assertTargetOrigin(resolved, prefix, event.url);
      return appendSearch(resolved, event.url.search);
    };
  }

  return (event) => appendSearch(target, event.url.search);
}

/**
 * Resolver for the request tail under `base`, the rule key minus its `/**`.
 *
 * `base` is *pattern* text, so it may carry rou3 dynamic segments that can
 * never equal a request path literally; those are stripped by segment count
 * instead. Anything that cannot be stripped faithfully throws 400 rather than
 * forwarding a mis-stripped path.
 */
function prepareTailResolver(base: string | undefined): TailResolver {
  // Segment count of a dynamic pattern prefix (0 = use `base` literally).
  const baseSegments = base && DYNAMIC_PATTERN_RE.test(base) ? patternSegmentCount(base) : 0;
  return (event) => {
    const rawPath = event.url.pathname;
    // Effective base for this request: the literal prefix, or the path's own
    // leading segments when the prefix is dynamic.
    let scopeBase = base;
    if (baseSegments) {
      scopeBase = leadingSegments(rawPath, baseSegments);
      if (scopeBase === undefined) {
        // Fewer segments than the pattern prefix (unreachable through rou3,
        // reachable through the matcher's canonical readings) — fail closed.
        throw new HTTPError({ status: 400 });
      }
    }
    if (!scopeBase) {
      // Only the leading position can leak as a protocol-relative `//host` URL;
      // interior separators stay opaque and are forwarded verbatim.
      return rawPath.replace(LEADING_SEPARATOR_RUN_RE, "/");
    }
    // Fail closed if the raw path doesn't literally sit under `scopeBase` (e.g. an
    // encoded separator or dot-segment makes it canonical-only under base) —
    // it can't be faithfully stripped, so don't forward it unstripped.
    // A derived base satisfies the literal test by construction; `isPathInScope`
    // carries the weight there, rejecting a path whose canonical readings
    // disagree with the raw segments the base was taken from.
    if (!isLiterallyInScope(rawPath, scopeBase)) {
      // The rule can also have matched through the matcher's *decoded*
      // reading — a pattern spelled `/a b/**` covers a `/a%20b/...`
      // request — and there the raw path never literally starts with the
      // pattern prefix. Strip the request's own leading segments instead
      // (the by-count strip the dynamic-prefix branch already uses; decoding
      // never adds or removes a separator, so the counts line up), gated on
      // the decoded reading being in scope so a path that genuinely escapes
      // still fails closed. The forwarded remainder keeps its raw bytes.
      // The base itself may keep escapes (`/%7Bq%7D`, rou3 syntax spelled
      // literally), so the decoded path is held against the decoded base.
      const decoded = decodedPath(rawPath);
      const derived =
        decoded === rawPath || !isLiterallyInScope(decoded, decodedPath(scopeBase))
          ? undefined
          : leadingSegments(rawPath, countSegments(scopeBase));
      if (derived === undefined) {
        throw new HTTPError({ status: 400 });
      }
      scopeBase = derived;
    }
    return withoutBase(rawPath, scopeBase);
  };
}

/** A target's own base path: its pathname, without a trailing slash. */
function targetBasePath(prefix: string): string {
  const path = getURLPathname(prefix);
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Append the request's query to `target`, ahead of any `#fragment`. */
function appendSearch(target: string, search: string): string {
  if (!search) {
    return target;
  }
  // Split off any `#fragment` so appended query params land before it, not inside it.
  const hashIndex = target.indexOf("#");
  const targetBase = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const targetHash = hashIndex === -1 ? "" : target.slice(hashIndex);
  const joiner = targetBase.includes("?")
    ? targetBase.endsWith("?") || targetBase.endsWith("&")
      ? ""
      : "&"
    : "?";
  return targetBase + joiner + search.slice(1) + targetHash;
}

/**
 * Re-check scope on the final resolved target, not just the incoming path:
 * `joinURL` collapses empty segments that may have shielded a `..` pre-join, so
 * a `..%2f` can still escape the target's own base post-join — and an
 * interpolated tail lands inside the target rather than after it.
 */
function assertTargetInScope(resolved: string, baseTargetPath: string): void {
  if (!isFinalTargetInScope(getURLPathname(resolved), baseTargetPath)) {
    throw new HTTPError({ status: 400 });
  }
}

/**
 * Reject a resolved target whose origin is not the one the template's own
 * literal prefix resolves to.
 *
 * A trailing `to: ".../**"` appends strictly after the target's path, so the
 * tail can never reach the destination host. An interpolated placeholder
 * splices *into* the target, where the tail can carry a `scheme:` or a `//`,
 * and where an empty tail can collapse two literal separators into a
 * protocol-relative `//host`. Neither is visible to {@link isFinalTargetInScope},
 * which is handed a pathname the authority has already been parsed out of.
 *
 * This asks the URL parser rather than re-deriving the authority lexically:
 * the two disagree in enough spellings (`http:///h`, `https:/h`, `/\h`, all of
 * which a browser reads as host `h`) that a lexical check is the wrong tool.
 * A reading that does not parse at all fails closed.
 */
function assertTargetOrigin(resolved: string, prefix: string, url: URL): void {
  let expected: URL;
  let actual: URL;
  try {
    expected = new URL(prefix, url);
    actual = new URL(resolved, url);
  } catch {
    throw new HTTPError({ status: 400 });
  }
  // `origin` is `"null"` for every non-special scheme, so compare the protocol
  // too — `mailto:`, `javascript:` and friends must not swap for one another.
  if (expected.origin !== actual.origin || expected.protocol !== actual.protocol) {
    throw new HTTPError({ status: 400 });
  }
}

/**
 * Scope check for the **final joined** target path against the target's own
 * base path — the root-aware counterpart of {@link isPathInScope}.
 *
 * With a base 
```

### Core Architecture Module: `src/types/_utils.ts`
```
export type MaybePromise<T = unknown> = T | Promise<T>;

```

### Core Architecture Module: `src/utils/auth.ts`
```
import { getEventContext, HTTPError } from "../index.ts";

import type { H3EventContext, HTTPEvent, Middleware } from "../index.ts";
import { randomJitter, timingSafeEqual } from "./internal/auth.ts";

type _BasicAuthOptions = {
  /**
   * Validate username for basic auth.
   */
  username: string;

  /***
   * Simple password for basic auth.
   */
  password: string;

  /**
   * Custom validation function for basic auth.
   *
   * When provided, the built-in non-empty check is skipped and this function
   * receives the decoded `username`/`password` as-is, including empty strings
   * (RFC 7617 permits an empty user-id and/or password). It must return `false`
   * to reject empty or otherwise invalid credentials.
   */
  validate: (username: string, password: string) => boolean | Promise<boolean>;

  /**
   * Realm for the basic auth challenge.
   *
   * Defaults to "auth".
   */
  realm: string;
};

export type BasicAuthOptions = Partial<_BasicAuthOptions> &
  ({ validate: _BasicAuthOptions["validate"] } | { password: _BasicAuthOptions["password"] });

/**
 * Apply basic authentication for current request.
 *
 * @example
 * import { defineHandler, requireBasicAuth } from "h3";
 * export default defineHandler(async (event) => {
 *   await requireBasicAuth(event, { password: "test" });
 *   return `Hello, ${event.context.basicAuth.username}!`;
 * });
 */
export async function requireBasicAuth(event: HTTPEvent, opts: BasicAuthOptions): Promise<true> {
  if (!opts.validate && !opts.password) {
    throw new HTTPError({
      message: "Either 'password' or 'validate' option must be provided",
      status: 500,
    });
  }

  const realm = opts?.realm ?? "auth";

  const authHeader = event.req.headers.get("authorization");
  if (!authHeader) {
    throw await authFailed(event, realm);
  }
  // RFC 9110: credentials = auth-scheme [ 1*SP token68 ]; allow one or more spaces.
  const b64auth = /^basic +(.+)$/i.exec(authHeader)?.[1];
  if (!b64auth) {
    throw await authFailed(event, realm);
  }
  let authDecoded: string;
  try {
    authDecoded = atob(b64auth);
  } catch {
    throw await authFailed(event, realm);
  }
  try {
    // RFC 7617: modern clients send credentials as UTF-8 (charset="UTF-8").
    authDecoded = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(authDecoded, (c) => c.charCodeAt(0)),
    );
  } catch {
    // Not valid UTF-8: keep the Latin-1 interpretation for legacy clients.
  }
  const colonIndex = authDecoded.indexOf(":");
  if (colonIndex === -1) {
    // RFC 7617: credentials must be "user-id ":" password"; reject if missing.
    throw await authFailed(event, realm);
  }
  const username = authDecoded.slice(0, colonIndex);
  const password = authDecoded.slice(colonIndex + 1);
  // RFC 7617 allows empty user-id/password; only enforce non-empty when no
  // custom validate function is provided (i.e. plain username/password check).
  if (!opts.validate && (!username || !password)) {
    throw await authFailed(event, realm);
  }

  // Evaluate all comparisons unconditionally so failure timing does not
  // distinguish an unknown user from a wrong password.
  const usernameOk = !opts.username || timingSafeEqual(username, opts.username);
  const passwordOk = !opts.password || timingSafeEqual(password, opts.password);
  const validateOk = !opts.validate || (await opts.validate(username, password));
  if (!usernameOk || !passwordOk || !validateOk) {
    throw await authFailed(event, realm);
  }

  const context = getEventContext<H3EventContext>(event);
  context.basicAuth = { username, password, realm };

  return true;
}

/**
 * Create a basic authentication middleware.
 *
 * @example
 * import { H3, serve, basicAuth } from "h3";
 * const auth = basicAuth({ password: "test" });
 * app.get("/", (event) => `Hello ${event.context.basicAuth?.username}!`, [auth]);
 * serve(app, { port: 3000 });
 */
export function basicAuth(opts: BasicAuthOptions): Middleware {
  return async (event, next) => {
    await requireBasicAuth(event, opts);
    return next();
  };
}

async function authFailed(event: HTTPEvent, realm: string) {
  // Jitter every 401 path uniformly so response timing does not distinguish a
  // malformed/absent header from a well-formed but wrong credential.
  await randomJitter();
  return new HTTPError({
    status: 401,
    statusText: "Authentication required",
    headers: {
      "www-authenticate": `Basic realm="${quoteRealm(realm)}", charset="UTF-8"`,
    },
  });
}

/**
 * Sanitize a realm into an RFC 9110 §5.6.4 quoted-string body.
 *
 * Drops characters outside the qdtext/obs-text charset (control chars and
 * non-Latin-1 code points that would throw when set as a header value) and
 * escapes DQUOTE and backslash as quoted-pairs.
 */
function quoteRealm(realm: string): string {
  return realm.replace(/[^\t\x20-\x7E\x80-\xFF]/g, "").replace(/["\\]/g, "\\$&");
}

```

### Core Architecture Module: `src/utils/base.ts`
```
import type {
  EventHandler,
  EventHandlerRequest,
  HTTPHandler,
  ResolvedRequest,
} from "../types/handler.ts";
import { toEventHandler } from "../handler.ts";
import { HTTPError } from "../error.ts";
import { hasEmptySegmentAfterBase, withoutBase, withoutTrailingSlash } from "./internal/path.ts";

/**
 * Returns a new event handler that removes the base url of the event before calling the original handler.
 *
 * @example
 * const api = new H3()
 *  .get("/", () => "Hello API!");
 * const app = new H3()
 *  .use("/api/**", withBase("/api", api.handler));
 *
 * @param base The base path to prefix.
 * @param handler The event handler to use with the adapted path.
 */
export function withBase<_RequestT extends EventHandlerRequest = EventHandlerRequest>(
  base: string,
  input: HTTPHandler<_RequestT>,
): EventHandler<ResolvedRequest<_RequestT>> {
  base = withoutTrailingSlash(base);

  const handler = toEventHandler(input);
  if (!handler) {
    throw new Error("Invalid handler", { cause: input });
  }

  return async function _handlerWithBase(event) {
    const _pathBefore = event.url.pathname || "/";
    if (base !== "/" && hasEmptySegmentAfterBase(_pathBefore, base)) {
      throw new HTTPError({ status: 404 });
    }
    event.url.pathname = withoutBase(event.url.pathname || "/", base);
    try {
      return await handler(event);
    } finally {
      event.url.pathname = _pathBefore;
    }
  };
}

```

### Core Architecture Module: `src/utils/body.ts`
```
import { type ErrorDetails, HTTPError } from "../error.ts";
import { type OnValidateError, validateData } from "./internal/validate.ts";
import { parseURLEncodedBody, parseFormData } from "./internal/body.ts";
import { limitRequestBody } from "srvx/body-limit";

import type { ServerRequest } from "srvx";
import type { HTTPEvent } from "../event.ts";
import type { InferEventInput } from "../types/handler.ts";
import type { ValidateResult } from "./internal/validate.ts";
import type { StandardSchemaV1, FailureResult, InferOutput } from "./internal/standard-schema.ts";

export interface ReadBodyOptions {
  /**
   * Force a parser instead of inferring it from the request `Content-Type`.
   *
   * - `"json"` (default): parse as JSON.
   * - `"text"`: return the raw string body.
   * - `"urlencoded"`: parse as `application/x-www-form-urlencoded`.
   * - `"formData"`: parse as `multipart/form-data` (or url-encoded) form data.
   */
  type?: "json" | "text" | "urlencoded" | "formData";
}

/**
 * Reads request body and tries to parse using JSON.parse or URLSearchParams.
 *
 * By default the body is parsed as JSON (falling back to URL-encoded parsing
 * when the `Content-Type` is `application/x-www-form-urlencoded`). Other body
 * types, such as `multipart/form-data`, must be opted into explicitly via
 * `options.type` and are never auto-detected from the request headers.
 *
 * @example
 * app.post("/", async (event) => {
 *   const body = await readBody(event);
 * });
 * @example
 * app.post("/upload", async (event) => {
 *   const body = await readBody(event, { type: "formData" });
 * });
 *
 * @param event H3 event passed by h3 handler
 * @param options Parsing options. Set `type` to force a parser instead of
 *   inferring it from the request `Content-Type`.
 *
 * @return {*} The `Object`, `Array`, `String`, `Number`, `Boolean`, or `null` value corresponding to the request body
 */
export async function readBody<
  T,
  _Event extends HTTPEvent = HTTPEvent,
  _T = InferEventInput<"body", _Event, T>,
>(event: _Event, options?: ReadBodyOptions): Promise<undefined | _T> {
  // Media types are case-insensitive (RFC 9110, section 8.3.1).
  const contentType = (event.req.headers.get("content-type") || "").toLowerCase();
  const type = options?.type;

  // `formData` (multipart or url-encoded) is strictly opt-in: unlike JSON it
  // is never auto-detected from the `Content-Type` header, so an untrusted
  // request cannot push readBody into (potentially expensive) multipart
  // parsing without the handler explicitly asking for it. See #875.
  if (type === "formData") {
    let form: FormData;
    try {
      form = await event.req.formData();
    } catch (error) {
      // Keep a real `HTTPError` (e.g. the `413` from an aborted body-limit
      // stream) instead of masking it as a generic `400 Invalid form data body`.
      if (HTTPError.isError(error)) {
        throw error;
      }
      throw new HTTPError({
        status: 400,
        statusText: "Bad Request",
        message: "Invalid form data body",
      });
    }
    return parseFormData(form) as _T;
  }

  const text = await event.req.text();

  // Text is returned verbatim, including an empty body as `""`.
  if (type === "text") {
    return text as _T;
  }

  if (!text) {
    return undefined;
  }

  if (
    type === "urlencoded" ||
    (!type && contentType.startsWith("application/x-www-form-urlencoded"))
  ) {
    return parseURLEncodedBody(text) as _T;
  }

  // Default, and explicit `type: "json"`.
  try {
    return JSON.parse(text) as _T;
  } catch {
    throw new HTTPError({
      status: 400,
      statusText: "Bad Request",
      message: "Invalid JSON body",
    });
  }
}

export async function readValidatedBody<Event extends HTTPEvent, S extends StandardSchemaV1>(
  event: Event,
  validate: S,
  options?: ReadBodyOptions & { onError?: (result: FailureResult) => ErrorDetails },
): Promise<InferOutput<S>>;
export async function readValidatedBody<
  Event extends HTTPEvent,
  OutputT,
  InputT = InferEventInput<"body", Event, OutputT>,
>(
  event: Event,
  validate: (data: InputT) => ValidateResult<OutputT> | Promise<ValidateResult<OutputT>>,
  options?: ReadBodyOptions & {
    onError?: () => ErrorDetails;
  },
): Promise<OutputT>;
/**
 * Tries to read the request body via `readBody`, then uses the provided validation schema or function and either throws a validation error or returns the result.
 *
 * You can use a simple function to validate the body or use a Standard-Schema compatible library like `zod` to define a schema.
 *
 * @example
 * function validateBody(body: any) {
 *   return typeof body === "object" && body !== null;
 * }
 *
 * app.post("/", async (event) => {
 *   const body = await readValidatedBody(event, validateBody);
 * });
 * @example
 * import { z } from "zod";
 *
 * const objectSchema = z.object({
 *   name: z.string().min(3).max(20),
 *   age: z.number({ coerce: true }).positive().int(),
 * });
 *
 * app.post("/", async (event) => {
 *   const body = await readValidatedBody(event, objectSchema);
 * });
 * @example
 * import * as v from "valibot";
 *
 * app.post("/", async (event) => {
 *   const body = await readValidatedBody(
 *     event,
 *     v.object({
 *       name: v.pipe(v.string(), v.minLength(3), v.maxLength(20)),
 *       age: v.pipe(v.number(), v.integer(), v.minValue(1)),
 *     }),
 *     {
 *       onError: ({ issues }) => ({
 *         statusText: "Custom validation error",
 *         message: v.summarize(issues),
 *       }),
 *     },
 *   );
 * });
 *
 * @param event The HTTPEvent passed by the handler.
 * @param validate The function to use for body validation. It will be called passing the read request body. If the result is not false, the parsed body will be returned.
 * @param options Optional options. If provided, the `onError` function will be called with the validation issues if validation fails.
 * @throws If the validation function returns `false` or throws, a validation error will be thrown.
 * @return {*} The `Object`, `Array`, `String`, `Number`, `Boolean`, or `null` value corresponding to the request JSON body.
 * @see {readBody}
 */
export async function readValidatedBody(
  event: HTTPEvent,
  validate: any,
  options?: ReadBodyOptions & {
    onError?: OnValidateError;
  },
): Promise<any> {
  const _body = await readBody(event, options);
  return validateData(_body, validate, options);
}

/**
 * Asserts that the request body size is within the specified limit.
 *
 * The limit is enforced **as the body is read**, not by pre-buffering: the
 * request is wrapped by srvx's `limitRequestBody`, which counts bytes as they
 * flow and aborts with a `413` {@link HTTPError} the moment the running total
 * exceeds `limit` (the error is injected via `createError`). This preserves the
 * byte-accurate guarantee (a lying-small `Content-Length` is still caught
 * mid-stream) without holding the body in memory or blocking streaming handlers.
 *
 * An honest `Content-Length` that already exceeds the limit is rejected up-front
 * with a `413`, and a request carrying both `Content-Length` and
 * `Transfer-Encoding` is rejected with a `400` (request smuggling, RFC 7230).
 *
 * Because enforcement is tied to consumption, an overflow on a chunked /
 * unknown-length body surfaces when the handler reads the body rather than as a
 * pre-handler `413`, and a body the handler never reads is never counted.
 *
 * @example
 * app.post("/", async (event) => {
 *   assertBodySize(event, 10 * 1024 * 1024); // 10MB
 *   const data = await event.req.formData();
 * });
 *
 * @param event HTTP event
 * @param limit Body size limit in bytes
 */
export function assertBodySize(event: HTTPEvent, limit: number): void {
  const req = event.req;
  if (!req.body) {
    return;
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    // A message carrying both `Content-Length` and `Transfer-Encoding` is a
    // request smuggling vector and must be rejected.
    // https://datatracker.ietf.org/doc/html/rfc7230#section-3.3.2
    if (req.headers.get("transfer-encoding")) {
      throw new HTTPError({ status: 400 });
    }
    // Fail-fast: reject an honest oversized `Content-Length` before the handler
    // runs, without touching the body stream.
    if (+contentLength > limit) {
      throw bodyTooLargeError(limit);
    }
  }

  // Swap in srvx's size-limiting proxy: it enforces the limit as the body is read
  // (throwing our own `HTTPError` via `createError`, so body readers and the error
  // pipeline treat it as a handled `413` with no extra mapping) while passing
  // headers, url, and runtime augmentation through to `req`.
  (event as { req: ServerRequest }).req = limitRequestBody(req, limit, {
    createError: () => bodyTooLargeError(limit),
  });
}

function bodyTooLargeError(limit: number): HTTPError {
  return new HTTPError({
    status: 413,
    statusText: "Request Entity Too Large",
    message: `Request body size exceeds the limit of ${limit} bytes`,
  });
}

```

### Core Architecture Module: `src/utils/cache.ts`
```
import type { H3Event } from "../event.ts";
import { isCacheMatch } from "./internal/cache.ts";
import {
  detachStagedHeaders,
  getStagedHeader,
  reattachStagedHeaders,
  withStagedHeaders,
} from "./internal/staged-headers.ts";

export interface CacheConditions {
  modifiedTime?: string | Date;
  maxAge?: number;
  etag?: string;
  cacheControls?: string[];
  /**
   * `If-None-Match` to evaluate instead of the request header. A cache layer
   * that narrows the request it forwards holds the only copy of the validator.
   */
  ifNoneMatch?: string;
  /** `If-Modified-Since` to evaluate instead of the request header. */
  ifModifiedSince?: string;
}

// Match a whole comma-separated Cache-Control directive (optionally with an
// `=value`), anchored to the start of an entry or a comma so we don't match a
// substring like `x-private` or a quoted value such as `no-cache="private"`.
// Entries may bundle multiple directives (e.g. "max-age=60, private"), which is
// why anchoring only to `^` would miss them.
const RE_PRIVATE = /(?:^|,)\s*(?:private|no-store)(?:\s*=|\s*,|\s*$)/i;
const RE_PUBLIC = /(?:^|,)\s*public(?:\s*=|\s*,|\s*$)/i;

/**
 * Check request caching headers (`If-None-Match`, `If-Modified-Since`) and add caching headers (Last-Modified, ETag, Cache-Control).
 *
 * Note: `public` is added by default, but never alongside a caller-supplied `private`/`no-store` directive, so passing `cacheControls: ["private"]` no longer produces a contradictory `public, private`.
 * @returns `true` when cache headers are matching. When `true` is returned, no response should be sent anymore
 */
export function handleCacheHeaders(event: H3Event, opts: CacheConditions): boolean {
  const cacheControls = [...(opts.cacheControls || [])];
  const joined = cacheControls.join(",");

  // A response is private when the caller opts into `private` or `no-store`;
  // shared-cache directives (`public`, `s-maxage`) must not be added for it.
  const isPrivate = RE_PRIVATE.test(joined);

  // Default to `public` for shared caches, but never alongside an explicit
  // visibility directive — that would produce contradictory pairs like
  // `public, private` for authenticated/personalized responses.
  if (!isPrivate && !RE_PUBLIC.test(joined)) {
    cacheControls.unshift("public");
  }

  if (opts.maxAge !== undefined) {
    cacheControls.push(`max-age=${+opts.maxAge}`);
    // `s-maxage` only applies to shared caches; omit it for private responses.
    if (!isPrivate) {
      cacheControls.push(`s-maxage=${+opts.maxAge}`);
    }
  }

  if (opts.etag) {
    event.res.headers.set("etag", opts.etag);
  }

  let lastModified: Date | undefined;
  if (opts.modifiedTime) {
    lastModified = new Date(opts.modifiedTime);
    lastModified.setMilliseconds(0);
    event.res.headers.set("last-modified", lastModified.toUTCString());
  }

  event.res.headers.set("cache-control", cacheControls.join(", "));

  if (
    isCacheMatch(event.req.headers, {
      etag: opts.etag,
      lastModified,
      ifNoneMatch: opts.ifNoneMatch,
      ifModifiedSince: opts.ifModifiedSince,
    })
  ) {
    event.res.status = 304;
    return true;
  }

  return false;
}

/**
 * Wrap a cached handler so headers staged on `event.res` before it runs (for example by global middleware) never enter its cache entry.
 *
 * A cache miss usually renders the handler result with `toResponse(value, event)`, which merges staged headers into the stored response, so later hits would replay one user's headers to everyone. The wrapper takes them off the event for the cached dispatch and merges them onto each successful response, hit or miss; error responses (4xx/5xx) don't receive them, as in h3. When the handler returns something other than a `Response`, they are put back on the event instead.
 *
 * A staged header wins over the same header set by the handler, so a miss looks the same as a hit.
 *
 * Headers that decide whether a response may be stored stay visible to the cache: a staged `Cache-Control` and every staged `Vary` name except `origin`. A response that middleware marked `private`/`no-store`, or that varies on a request header the cache isn't keyed on, is therefore not stored. A staged `private`/`no-store` `Cache-Control` is also sent to the client in place of the one the cached handler sets, so a CDN in front of the app doesn't store it either. A `Vary: Origin` is isolated, because the CORS headers it declares are staged per request as well.
 *
 * Properties of the wrapped handler (such as ocache's `invalidate`, `expire` and `resolveKeys`) are copied to the returned handler.
 *
 * @example
 * import { handleCacheHeaders, toResponse, withCacheIsolation } from "h3";
 * import { defineCachedHandler } from "ocache";
 *
 * const cached = withCacheIsolation(
 *   defineCachedHandler(() => "hello", {
 *     maxAge: 60,
 *     toResponse: (value, event) => toResponse(value, event),
 *     handleCacheHeaders: (event, conditions) => handleCacheHeaders(event, conditions),
 *   }),
 * );
 * app.get("/cached", cached);
 *
 * @param handler The cached event handler to wrap.
 */
export function withCacheIsolation<T extends (event: H3Event) => unknown>(handler: T): T {
  async function _handlerWithCacheIsolation(event: H3Event) {
    const cacheControl = getStagedHeader(event, "cache-control");
    const privateCacheControl =
      cacheControl !== null && RE_PRIVATE.test(cacheControl) ? cacheControl : undefined;
    const staged = detachStagedHeaders(event);
    let res: unknown;
    try {
      res = await handler(event);
    } catch (error) {
      if (staged) {
        reattachStagedHeaders(event, staged);
      }
      throw error;
    }
    if (privateCacheControl) {
      // The cached dispatch's `handleCacheHeaders` replaces it with `public`;
      // a shared cache in front of the app must still see it as private.
      event.res.headers.set("cache-control", privateCacheControl);
    }
    if (!staged) {
      return res;
    }
    if (res instanceof Response) {
      return withStagedHeaders(res, staged);
    }
    reattachStagedHeaders(event, staged);
    return res;
  }
  return Object.assign(_handlerWithCacheIsolation, handler) as unknown as T;
}

```

### Core Architecture Module: `src/utils/cookie.ts`
```
import type { CookieSerializeOptions } from "cookie-es";
import type { H3Event, HTTPEvent } from "../event.ts";
import { parseCookie, serializeCookie, parseSetCookie } from "cookie-es";
import { validateData } from "./internal/validate.ts";
import type { StandardSchemaV1, FailureResult, InferOutput } from "./internal/standard-schema.ts";
import type { ValidateResult, OnValidateError } from "./internal/validate.ts";
import type { ErrorDetails } from "../error.ts";
import { HTTPError } from "../error.ts";

const CHUNKED_COOKIE = "__chunked__";

// The limit is approximately 4KB, but may vary by browser and server. We leave some room to be safe.
const CHUNKS_MAX_LENGTH = 4000;

/**
 * Parse the request to get HTTP Cookie header string and returning an object of all cookie name-value pairs.
 * @param event {HTTPEvent} H3 event or req passed by h3 handler
 * @returns Object of cookie name-value pairs
 * ```ts
 * const cookies = parseCookies(event)
 * ```
 */
export function parseCookies(event: HTTPEvent): Record<string, string | undefined> {
  return parseCookie(event.req.headers.get("cookie") || "");
}

/**
 * Get and validate all cookies using a Standard Schema or custom validator.
 *
 * @example
 * app.get("/", async (event) => {
 *   const cookies = await getValidatedCookies(event, z.object({
 *     session: z.string(),
 *     theme: z.enum(["light", "dark"]).optional(),
 *   }));
 * });
 */
export function getValidatedCookies<Event extends HTTPEvent, S extends StandardSchemaV1<any, any>>(
  event: Event,
  validate: S,
  options?: { onError?: (result: FailureResult) => ErrorDetails },
): Promise<InferOutput<S>>;
export function getValidatedCookies<Event extends HTTPEvent, OutputT>(
  event: Event,
  validate: (
    data: Record<string, string | undefined>,
  ) => ValidateResult<OutputT> | Promise<ValidateResult<OutputT>>,
  options?: { onError?: () => ErrorDetails },
): Promise<OutputT>;
export function getValidatedCookies(
  event: HTTPEvent,
  validate: any,
  options?: { onError?: OnValidateError },
): Promise<any> {
  const cookies = parseCookies(event);
  return validateData(cookies, validate, options);
}

/**
 * Get a cookie value by name.
 * @param event {HTTPEvent} H3 event or req passed by h3 handler
 * @param name Name of the cookie to get
 * @returns {*} Value of the cookie (String or undefined)
 * ```ts
 * const authorization = getCookie(request, 'Authorization')
 * ```
 */
export function getCookie(event: HTTPEvent, name: string): string | undefined {
  return parseCookies(event)[name];
}

/**
 * Set a cookie value by name.
 * @param event {H3Event} H3 event or res passed by h3 handler
 * @param name Name of the cookie to set
 * @param value Value of the cookie to set
 * @param options {CookieSerializeOptions} Options for serializing the cookie
 * ```ts
 * setCookie(res, 'Authorization', '1234567')
 * ```
 */
export function setCookie(
  event: H3Event,
  name: string,
  value: string,
  options?: CookieSerializeOptions,
): void {
  // Serialize cookie
  const { encode, stringify, ...attrs } = options ?? {};
  const newCookie = serializeCookie({ name, value, path: "/", ...attrs }, { encode, stringify });

  // Check and add only not any other set-cookie headers already set
  const currentCookies = event.res.headers.getSetCookie();
  if (currentCookies.length === 0) {
    event.res.headers.set("set-cookie", newCookie);
    return;
  }

  // Fast path: no existing cookie shares the same name, simply append
  const namePrefix = `${name}=`;
  if (!currentCookies.some((cookie) => cookie.startsWith(namePrefix))) {
    event.res.headers.append("set-cookie", newCookie);
    return;
  }

  // Merge and deduplicate unique set-cookie headers
  const newCookieKey = _getDistinctCookieKey(name, options || {});
  event.res.headers.delete("set-cookie");
  for (const cookie of currentCookies) {
    const parsed = parseSetCookie(cookie);
    // `parseSetCookie` returns `undefined` for cookies it cannot understand (oversized
    // name+value, prototype-conflicting names). Fall back to the same name-only check
    // used by the fast path above, so unrelated cookies are kept instead of dropped.
    const isReplaced = parsed
      ? _getDistinctCookieKey(cookie.split("=")?.[0], parsed) === newCookieKey
      : cookie.startsWith(namePrefix);
    if (isReplaced) {
      continue;
    }
    event.res.headers.append("set-cookie", cookie);
  }
  event.res.headers.append("set-cookie", newCookie);
}

/**
 * Remove a cookie by name.
 * @param event {H3Event} H3 event or res passed by h3 handler
 * @param name Name of the cookie to delete
 * @param serializeOptions {CookieSerializeOptions} Cookie options
 * ```ts
 * deleteCookie(res, 'SessionId')
 * ```
 */
export function deleteCookie(
  event: H3Event,
  name: string,
  serializeOptions?: CookieSerializeOptions,
): void {
  setCookie(event, name, "", {
    ...serializeOptions,
    maxAge: 0,
  });
}

/**
 * Get a chunked cookie value by name. Will join chunks together.
 * @param event {HTTPEvent} { req: Request }
 * @param name Name of the cookie to get
 * @returns {*} Value of the cookie (String or undefined)
 * ```ts
 * const session = getChunkedCookie(event, 'Session')
 * ```
 */
export function getChunkedCookie(event: HTTPEvent, name: string): string | undefined {
  const cookies = parseCookies(event);
  const mainCookie = cookies[name];
  if (!mainCookie || !mainCookie.startsWith(CHUNKED_COOKIE)) {
    return mainCookie;
  }

  const chunksCount = getChunkedCookieCount(mainCookie);
  if (chunksCount === 0) {
    return undefined;
  }

  const chunks = [];
  for (let i = 1; i <= chunksCount; i++) {
    const chunk = cookies[chunkCookieName(name, i)];
    if (!chunk) {
      return undefined;
    }
    chunks.push(chunk);
  }

  return chunks.join("");
}

/**
 * Set a cookie value by name. Chunked cookies will be created as needed.
 * @param event {H3Event} H3 event or res passed by h3 handler
 * @param name Name of the cookie to set
 * @param value Value of the cookie to set
 * @param options {CookieSerializeOptions} Options for serializing the cookie
 * ```ts
 * setCookie(res, 'Session', '<session data>')
 * ```
 */
export function setChunkedCookie(
  event: H3Event,
  name: string,
  value: string,
  options?: CookieSerializeOptions & { chunkMaxLength?: number },
): void {
  const chunkMaxLength = options?.chunkMaxLength || CHUNKS_MAX_LENGTH;
  const chunks = splitCookieValue(value, chunkMaxLength, options?.encode || encodeURIComponent);
  if (!chunks) {
    throw new HTTPError({
      status: 500,
      message: `Cannot set chunked cookie "${name}": a single character does not fit in chunkMaxLength (${chunkMaxLength}) once encoded.`,
    });
  }
  const chunkCount = chunks.length;

  // Reject values that would need more chunks than the reader (`getChunkedCookie`)
  // supports. Beyond this the reader returns `undefined`, so the write would be
  // silently unreadable (data loss) and would emit more Set-Cookie headers than
  // browsers accept.
  if (chunkCount > MAX_CHUNKED_COOKIE_COUNT) {
    throw new HTTPError({
      status: 500,
      message: `Cannot set chunked cookie "${name}": value needs more than ${MAX_CHUNKED_COOKIE_COUNT} chunks.`,
    });
  }

  // delete any prior left over chunks if the cookie is updated
  const previousCookie = getCookie(event, name);
  if (previousCookie?.startsWith(CHUNKED_COOKIE)) {
    const previousChunkCount = getChunkedCookieCount(previousCookie);
    // Number of chunk cookies (`name.N`) written for the new value. Values that
    // fit in a single cookie are stored unchunked, so no chunks are written.
    const newChunkCount = chunkCount <= 1 ? 0 : chunkCount;
    for (let i = newChunkCount + 1; i <= previousChunkCount; i++) {
      deleteCookie(event, chunkCookieName(name, i), options);
    }
  }

  if (chunkCount <= 1) {
    // If the value is small enough, just set it as a normal cookie
    setCookie(event, name, value, options);
    return;
  }

  // If the value is too large, we need to chunk it
  const mainCookieValue = `${CHUNKED_COOKIE}${chunkCount}`;
  setCookie(event, name, mainCookieValue, options);

  for (let i = 1; i <= chunkCount; i++) {
    setCookie(event, chunkCookieName(name, i), chunks[i - 1]!, options);
  }
}

/**
 * Remove a set of chunked cookies by name.
 * @param event {H3Event} H3 event or res passed by h3 handler
 * @param name Name of the cookie to delete
 * @param serializeOptions {CookieSerializeOptions} Cookie options
 * ```ts
 * deleteCookie(res, 'Session')
 * ```
 */
export function deleteChunkedCookie(
  event: H3Event,
  name: string,
  serializeOptions?: CookieSerializeOptions,
): void {
  const mainCookie = getCookie(event, name);
  deleteCookie(event, name, serializeOptions);

  const chunksCount = getChunkedCookieCount(mainCookie);
  if (chunksCount >= 0) {
    for (let i = 0; i < chunksCount; i++) {
      deleteCookie(event, chunkCookieName(name, i + 1), serializeOptions);
    }
  }
}

/**
 * Cookies are unique by "cookie-name, domain-value, and path-value".
 * Partitioned (CHIPS) cookies live in a separate jar, so `partitioned` is part of the identity too.
 *
 * @see https://httpwg.org/specs/rfc6265.html#rfc.section.4.1.2
 * @see https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies
 */
function _getDistinctCookieKey(
  name: string,
  options: { domain?: string; path?: string; partitioned?: boolean },
) {
  // Domain is case-insensitive and a leading "." is ignored (RFC 6265).
  const domain = (options.domain || "").replace(/^\./, "").toLowerCase();
  return [name, domain, options.path || "/", options.partitioned ? "1" : "0"].join(";");
}

// Maximum number of chunks allowed for chunked cookies.
// 100 chunks × ~4KB = ~400KB, far beyond any practical cookie size.
const MAX_CHUNKED_COOKIE_COUNT = 100;

function getChunkedCookieCount(cookie: string | undefined): number {
  if (!cookie?.startsWith(CHUNKED_COOKIE)) {
    return Number.NaN;
  }

```

### Core Architecture Module: `src/utils/cors.ts`
```
import type { H3Event, HTTPEvent } from "../event.ts";
import { noContent } from "./response.ts";
import {
  createAllowHeaderHeaders,
  createCredentialsHeaders,
  createExposeHeaders,
  createMaxAgeHeader,
  createMethodsHeaders,
  createOriginHeaders,
  resolveCorsOptions,
} from "./internal/cors.ts";
import type { HTTPResponse } from "../response.ts";

export { isCorsOriginAllowed } from "./internal/cors.ts";

export interface CorsOptions {
  /**
   * This determines the value of the "access-control-allow-origin" response header.
   * If "*", it can be used to allow all origins.
   * If an array of strings or regular expressions, it can be used with origin matching.
   * If a custom function, it's used to validate the origin. It takes the origin as an argument and returns `true` if allowed.
   *
   * **Security:** Regular-expression entries are tested against the full origin
   * string **unanchored** (via `RegExp.prototype.test`). A pattern like
   * `/example\.com/` therefore also matches `https://example.com.evil.test` and
   * `https://notexample.com`. Always **anchor** (`^`…`$`) and **escape** literal
   * dots in regex origins — e.g. `/^https:\/\/([a-z0-9-]+\.)?example\.com$/` to
   * allow `example.com` and one optional subdomain label (use `(…\.)*` for
   * arbitrary depth), or `/^https?:\/\/example\.com$/` for an exact host. Prefer
   * plain string entries (matched by exact equality) when
   * you don't need pattern matching.
   *
   * Avoid `"null"` together with `credentials: true`. Sandboxed iframes, `data:`/`file:` documents,
   * and other opaque origins all send `Origin: null`, so allowing it with credentials would share
   * them across untrusted contexts.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin
   * @default "*"
   */
  origin?: "*" | "null" | (string | RegExp)[] | ((origin: string) => boolean);

  /**
   * This determines the value of the "access-control-allow-methods" response header of a preflight request.
   *
   * The default `"*"` permits any method (including non-safelisted ones like `QUERY`).
   * When using an explicit allowlist, remember that `QUERY` is **not** a CORS-safelisted
   * method, so browsers preflight it — include `"QUERY"` in the array to allow it.
   *
   * When `credentials` is enabled, browsers treat `"*"` as a literal method name — in that
   * case the requested method is reflected back instead of sending a literal `*`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods
   * @default "*"
   * @example ["GET", "HEAD", "PUT", "POST", "QUERY"]
   */
  methods?: "*" | string[];

  /**
   * This determines the value of the "access-control-allow-headers" response header of a preflight request.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers
   * @default "*"
   */
  allowHeaders?: "*" | string[];

  /**
   * This determines the value of the "access-control-expose-headers" response header.
   *
   * When `credentials` is enabled, browsers treat `"*"` as a literal header name — in that
   * case the header is omitted; list the headers explicitly to expose them.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers
   * @default "*"
   */
  exposeHeaders?: "*" | string[];

  /**
   * This determines the value of the "access-control-allow-credentials" response header.
   * When request with credentials, the options that `origin`, `methods`, `exposeHeaders` and `allowHeaders` should not be set "*".
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials
   * @see https://fetch.spec.whatwg.org/#cors-protocol-and-credentials
   * @default false
   */
  credentials?: boolean;

  /**
   * This determines the value of the "access-control-max-age" response header of a preflight request.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
   * @default false
   */
  maxAge?: string | false;

  /**
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers
   */
  preflight?: {
    statusCode?: number;
  };
}

/**
 * Check if the incoming request is a CORS preflight request.
 */
export function isPreflightRequest(event: HTTPEvent): boolean {
  const origin = event.req.headers.get("origin");
  const accessControlRequestMethod = event.req.headers.get("access-control-request-method");

  return event.req.method === "OPTIONS" && !!origin && !!accessControlRequestMethod;
}

/**
 * Append CORS preflight headers to the response.
 */
export function appendCorsPreflightHeaders(event: H3Event, options: CorsOptions): void {
  const headerGroups = [
    createOriginHeaders(event, options),
    createCredentialsHeaders(options),
    createMethodsHeaders(event, options),
    createAllowHeaderHeaders(event, options),
    createMaxAgeHeader(options),
  ];
  // Several groups can independently emit a `vary` key. Plain spread would keep
  // only the last one — merge them so none is lost.
  const headers: Record<string, string> = Object.assign({}, ...headerGroups);
  const varyValues = headerGroups.map((group) => group.vary).filter(Boolean);
  if (varyValues.length > 0) {
    headers.vary = varyValues.join(", ");
  }
  setCorsHeaders(event, headers);
}

/**
 * Append CORS headers to the response.
 */
export function appendCorsHeaders(event: H3Event, options: CorsOptions): void {
  const headers = {
    ...createOriginHeaders(event, options),
    ...createCredentialsHeaders(options),
    ...createExposeHeaders(options),
  };
  setCorsHeaders(event, headers);
}

/**
 * Apply CORS response headers.
 *
 * CORS headers are single-valued, so use `.set` to avoid invalid duplicated
 * values (e.g. `*, *`) when CORS is applied more than once (middleware + handler).
 * The `vary` header is legitimately multi-valued and is appended instead.
 */
function setCorsHeaders(event: H3Event, headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    if (key === "vary") {
      event.res.headers.append(key, value);
      event.res.errHeaders.append(key, value);
    } else {
      event.res.headers.set(key, value);
      event.res.errHeaders.set(key, value);
    }
  }
}

/**
 * Handle CORS for the incoming request.
 *
 * If the incoming request is a CORS preflight request, it will append the CORS preflight headers and send a 204 response.
 *
 * If return value is not `false`, the request is handled and no further action is needed.
 *
 * @example
 * const app = new H3();
 * app.all("/", async (event) => {
 *   const corsRes = handleCors(event, {
 *     origin: "*",
 *     preflight: {
 *       statusCode: 204,
 *     },
 *     methods: "*",
 *   });
 *   if (corsRes !== false) {
 *     return corsRes;
 *   }
 *   // Your code here
 * });
 */
export function handleCors(event: H3Event, options: CorsOptions): false | HTTPResponse {
  const _options = resolveCorsOptions(options);
  if (isPreflightRequest(event)) {
    appendCorsPreflightHeaders(event, _options);
    return noContent(_options.preflight.statusCode);
  }
  appendCorsHeaders(event, _options);
  return false;
}

```

### Core Architecture Module: `src/utils/event-stream.ts`
```
import type { H3Event } from "../event.ts";
import { HTTPResponse } from "../response.ts";
import { onDispose } from "./internal/dispose.ts";
import {
  eventStreamHeaders,
  setEventStreamHeaders,
  formatEventStreamComment,
  formatEventStreamMessage,
  formatEventStreamMessages,
} from "./internal/event-stream.ts";

const _noop = () => {};

/**
 * Options for the {@link EventStream} constructor.
 *
 * Currently empty — reserved for future configuration.
 */
export interface EventStreamOptions {}

/**
 * See https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#fields
 */
export interface EventStreamMessage {
  id?: string;
  event?: string;
  retry?: number;
  data: string;
}

/**
 * A helper class for [server sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format)
 *
 * Extends {@link HTTPResponse} so it can be returned directly from a handler
 * (`return eventStream`) — `toResponse` already renders any `HTTPResponse` as
 * the response, streaming the readable side with the SSE headers below.
 *
 * @example
 *
 * ```ts
 * import { EventStream } from "h3";
 *
 * app.get("/sse", (event) => {
 *   const eventStream = new EventStream(event);
 *
 *   // Send a message every second
 *   const interval = setInterval(async () => {
 *     await eventStream.push("Hello world");
 *   }, 1000);
 *
 *   // cleanup the interval when the connection is terminated
 *   eventStream.onClosed(() => clearInterval(interval));
 *
 *   return eventStream;
 * });
 * ```
 */
export class EventStream extends HTTPResponse {
  private readonly _event: H3Event;
  private readonly _transformStream: TransformStream;
  private readonly _writer: WritableStreamDefaultWriter;
  private readonly _encoder: TextEncoder = new TextEncoder();

  private readonly _closeCallbacks: (() => any)[] = [];

  private _writerIsClosed = false;
  private _paused = false;
  private _unsentData: undefined | string;
  private _disposed = false;
  private _closing: Promise<void> | undefined;

  private get _isClosed(): boolean {
    return this._writerIsClosed || this._disposed;
  }

  constructor(event: H3Event, _opts: EventStreamOptions = {}) {
    // The transform stream must exist before `super()` so the readable side can
    // be handed to HTTPResponse as the body; a field initializer would run after
    // super() and replace it with a different stream, orphaning that body.
    const transformStream = new TransformStream();
    super(transformStream.readable, { status: 200, headers: eventStreamHeaders(event) });
    this._event = event;
    this._transformStream = transformStream;
    this._writer = transformStream.writable.getWriter();
    // `closed` rejects when the readable side is cancelled (client disconnect)
    // and resolves on a graceful `close()`. Both mean the stream is over.
    this._writer.closed.catch(_noop).finally(() => {
      this._writerIsClosed = true;
      this._disposed = true;
      for (const cb of this._closeCallbacks.splice(0)) {
        _invokeCloseCallback(cb);
      }
    });
    // End-of-event covers every runtime: normal end, client disconnect, and
    // a stream that is created but never `send()`-ed (the response completed
    // without it) all converge here.
    onDispose(this._event, () => {
      // Nobody ever read the stream (never sent, body dropped for HEAD, ...).
      // A fresh TransformStream is backpressured, so a pending write would
      // never resolve and `close()` would wait behind it forever. Cancelling
      // the unread side rejects pending writes and settles `writer.closed`,
      // exactly like a client disconnect. (`writer.abort()` would not: it
      // waits for the in-flight write first.)
      if (!this._isClosed && !this._transformStream.readable.locked) {
        return this._transformStream.readable.cancel().catch(_noop);
      }
      return this.close();
    });
  }

  /**
   * Publish new event(s) for the client
   */
  async push(message: string): Promise<void>;
  async push(message: string[]): Promise<void>;
  async push(message: EventStreamMessage): Promise<void>;
  async push(message: EventStreamMessage[]): Promise<void>;
  async push(message: EventStreamMessage | EventStreamMessage[] | string | string[]) {
    if (typeof message === "string") {
      await this._sendEvent({ data: message });
      return;
    }
    if (Array.isArray(message)) {
      if (message.length === 0) {
        return;
      }
      if (typeof message[0] === "string") {
        const msgs: EventStreamMessage[] = [];
        for (const item of message as string[]) {
          msgs.push({ data: item });
        }
        await this._sendEvents(msgs);
        return;
      }
      await this._sendEvents(message as EventStreamMessage[]);
      return;
    }
    await this._sendEvent(message);
  }

  async pushComment(comment: string): Promise<void> {
    if (this._isClosed) {
      return;
    }
    if (this._paused && !this._unsentData) {
      this._unsentData = formatEventStreamComment(comment);
      return;
    }
    if (this._paused) {
      this._unsentData += formatEventStreamComment(comment);
      return;
    }
    await this._writer.write(this._encoder.encode(formatEventStreamComment(comment))).catch(() => {
      this._writerIsClosed = true;
    });
  }

  private async _sendEvent(message: EventStreamMessage) {
    if (this._isClosed) {
      return;
    }
    if (this._paused && !this._unsentData) {
      this._unsentData = formatEventStreamMessage(message);
      return;
    }
    if (this._paused) {
      this._unsentData += formatEventStreamMessage(message);
      return;
    }
    await this._writer.write(this._encoder.encode(formatEventStreamMessage(message))).catch(() => {
      this._writerIsClosed = true;
    });
  }

  private async _sendEvents(messages: EventStreamMessage[]) {
    if (this._isClosed) {
      return;
    }
    const payload = formatEventStreamMessages(messages);
    if (this._paused && !this._unsentData) {
      this._unsentData = payload;
      return;
    }
    if (this._paused) {
      this._unsentData += payload;
      return;
    }

    await this._writer.write(this._encoder.encode(payload)).catch(() => {
      this._writerIsClosed = true;
    });
  }

  pause(): void {
    this._paused = true;
  }

  get isPaused(): boolean {
    return this._paused;
  }

  async resume(): Promise<void> {
    this._paused = false;
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this._isClosed) {
      return;
    }
    if (this._unsentData?.length) {
      const data = this._unsentData;
      // Detach this batch before yielding: another flush or paused push may run
      // while the writer is waiting for the client to read.
      this._unsentData = undefined;
      await this._writer.write(this._encoder.encode(data)).catch(() => {
        this._writerIsClosed = true;
      });
    }
  }

  /**
   * Close the stream and the connection if the stream is being sent to the client
   */
  close(): Promise<void> {
    return (this._closing ??= this._close());
  }

  private async _close(): Promise<void> {
    if (this._disposed) {
      return;
    }
    if (!this._isClosed) {
      // Data buffered while paused is still owed to the client. `flush()`
      // short-circuits once closed, so this is the last chance to send it.
      // A paused push can land while the flush is waiting on backpressure,
      // so loop until nothing is buffered before queueing the close.
      do {
        this._paused = false;
        await this.flush();
      } while (!this._isClosed && this._unsentData?.length);
      try {
        await this._writer.close();
      } catch {
        // Ignore
      }
    }
    this._disposed = true;
  }

  /**
   * Triggers callback when the stream is closed, either by calling the
   * `close()` method or when the client disconnects.
   */
  onClosed(cb: () => any): void {
    if (this._writerIsClosed) {
      queueMicrotask(() => _invokeCloseCallback(cb));
      return;
    }
    this._closeCallbacks.push(cb);
  }

  /**
   * Return the readable side of the stream, staging the SSE headers on the event.
   *
   * @deprecated Return the stream itself instead (`return eventStream`) — it
   * carries the same headers via {@link HTTPResponse}. Kept for compatibility
   * with the `return eventStream.send()` pattern.
   */
  async send(): Promise<BodyInit> {
    setEventStreamHeaders(this._event);
    this._event.res.status = 200;
    return this._transformStream.readable;
  }
}

// Close callbacks are user code: never let a sync throw or a rejected async
// callback escape (the documented `onClosed` example is async).
function _invokeCloseCallback(cb: () => any): void {
  try {
    const res = cb();
    if (res instanceof Promise) {
      res.catch(_noop);
    }
  } catch {
    // Ignore
  }
}

export function isEventStream(input: unknown): input is EventStream {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  return input instanceof EventStream;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1545** (2026-09-07): **fix: `HTTPHandler` with `EventHandler<any, any>` type shape causes typescript eslint error**
  *Symptoms*: ### Environment  h3@2.0.1-rc.30  ### Reproduction  https://stackblitz.com/edit/unjs-h3-pqkunrof?file=server.ts  ### Describe the bug  A [recent change](https://github.com/h3js/h3/commit/69ec3c73bc2b2f5086023a5fb3e7bd9a201b0f00#diff-d78b1387942039c256ea6ebde5c7c623105390c7972d3dcfaaf8c10a0f620ad1R8) to the `HTTPHandler` type now explicitly passes `any` to type generic parameters, causing the shape to raise `typescript-eslint` errors for strictness (specifically the `@typescript-eslint/no-unsafe-argument` rule).  The specific use case flagging this rule is a common case of passing an event handler `event` to another internal H3 function:  ```ts import { H3, proxyRequest } from 'h3';  const app = new H3(); //                                   ⌄ H3Event<EventHandlerRequest> expected app.get('/', (event) => proxyRequest(event, '/test')); //            ^ H3Event<any> passed  export default app; ```  ESLint output:  ```shell > lint > eslint   /home/projects/unjs-h3-pqkunrof/server.ts   5:38  error  Unsafe argument of type `H3Event<any>` assigned to a parameter of type `H3Event<EventHandlerRequest>`  @typescript-eslint/no-unsafe-argument  ✖ 1 problem (1 error, 0 warnings) ```  ### Additional context  Wondering if the explicit `any` being passed can be omitted entirely, or if this is something needed, the issue can be closed with wontfix and I can disable this lint rule in my projects.  Thanks!  ### Logs  ```sh  ```

- **Issue #1510** (2026-07-24): **[v2] Regression: Response sended before first stream payload**
  *Symptoms*: ### Environment  - h3: 2.0.1-rc.25 - node: 24.18.0  ### Reproduction  ## v2.0.1-rc.25 (Broken status/headers)  ```tsx import { H3, serve } from "h3";  const app = new H3().get("/", async (event) => {   return ReadableStream.from((async function* () {     event.res.status = 201;     event.res.headers.set("hello", "world");      yield "Hello World";   })()) });  serve(app, { port: 3000 }); ```  ## v1.15.11 (Working status/headers)  ```ts import { setResponseHeader, setResponseStatus } from "h3"; import { createApp, defineEventHandler, sendStream, toNodeListener } from "h3"; import { createServer } from "http";  const app = createApp(); app.use("/", defineEventHandler(async (event) => {   return ReadableStream.from((async function* () {     setResponseStatus(event, 201);     setResponseHeader(event, "hello", "world");      yield "Hello World";   })()) }));  createServer(toNodeListener(app)).listen(3000) ```  ### Describe the bug  h3 v1 waited with sending the response until the first async stream payload. This allowed setting response status codes and headers from within a stream (as long as it was part of the first payload). In h3 v2 you must set response status codes and headers before returning the stream. Response changes made while async rendering the first stream payload are now ignored. This makes it impossible to set response status/headers depending on async data within stream based frameworks such as SolidStart.  ### Additional context  Related: solidjs/solid-start#222
  **Post-Mortem & Fix Analysis**:
  > I will check it might be a fundumental difference when we migrated to web apis.  btw any reason you are not using h3 [`iterable`](https://h3.dev/utils/response#iterableiterable) util? to send reponse
  > Thank you 🙂. No special reason, I didn't know `iterable` existed 😅

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

### Incident Patch 1: `f90f4c8e` (2026-10-22)
**Commit Message**: fix(rules): let `HTTPError.headers` opt out of `headers` rule on errors (#1613)

**File**: `src/rules/handlers/headers.ts` (modified, +31/-8)
```diff
@@ -1,27 +1,50 @@
+import type { HTTPError } from "../../error.ts";
+import type { H3Event } from "../../event.ts";
 import type { RuleHandler } from "../types.ts";
 
 // order: -1. Sets headers after `next()` so they win even when an inner rule
 // (e.g. `cache`) short-circuits and overwrites headers like `cache-control` (h3js/h3-rules#5).
 //
-// `finally`, not a plain post-`next()` loop: a downstream throw unwinds past the
-// `await`, and the rule's headers must still apply to the resulting error
+// Applied on both the return and the throw path: a downstream throw unwinds past
+// the `await`, and the rule's headers must still apply to the resulting error
 // response. Both header bags are set for the same reason — `prepareResponse`
 // serves `event.res.errHeaders` (not `event.res.headers`) for status >= 400, so
 // a `headers`-only bag vanishes on every 4xx/5xx (mirrors h3's own
 // `setCorsHeaders`, `src/utils/cors.ts`).
+//
+// An `HTTPError` (thrown or returned) that carries one of the rule's keys in its
+// own `headers` keeps it: that is the handler explicitly opting its error response
+// out (e.g. `cache-control: no-store` on a 404 under an immutable asset rule,
+// h3js/h3#1612). `errHeaders` would otherwise win over `error.headers`.
 export const headers: RuleHandler<"headers"> = {
   order: -1,
   handler: (m) => {
     const entries = Object.entries(m.options || {});
     return async function headersRouteRule(event, next) {
+      let result: unknown;
       try {
-        return await next();
-      } finally {
-        for (const [key, value] of entries) {
-          event.res.headers.set(key, value);
-          event.res.errHeaders.set(key, value);
-        }
+        result = await next();
+      } catch (error) {
+        setRuleHeaders(event, entries, error);
+        throw error;
       }
+      setRuleHeaders(event, entries, result);
+      return result;
     };
   },
 };
+
+function setRuleHeaders(event: H3Event, entries: [string, string][], outcome: unknown): void {
+  // Inlined `HTTPError.isError`: importing `HTTPError` would pull `error.ts` into
+  // every `headers`-only bundle (test/rules/treeshake.test.ts budget).
+  const own =
+    outcome instanceof Error && outcome.name === "HTTPError" && (outcome as HTTPError).status > 99
+      ? (outcome as HTTPError).headers
+      : undefined;
+  for (const [key, value] of entries) {
+    event.res.headers.set(key, value);
+    if (!own?.has(key)) {
+      event.res.errHeaders.set(key, value);
+    }
+  }
+}
```

**File**: `test/rules/rules.test.ts` (modified, +135/-1)
```diff
@@ -1,4 +1,4 @@
-import { H3 } from "../../src/index.ts";
+import { H3, HTTPError, appendCorsHeaders } from "../../src/index.ts";
 import { describe, expect, it } from "vitest";
 import { routeRules } from "../../src/rules/middleware.ts";
 import { canonicalPath, isPathInScope } from "../../src/rules/internal/scope.ts";
@@ -75,6 +75,140 @@ describe("headers rule on error responses", () => {
     expect(res.status).toBe(500);
     expect(res.headers.get("x-rule")).toBe("1");
   });
+
+  // h3js/h3#1612: an error carrying the header in its own `headers` opts its
+  // response out of that rule header (e.g. keep an immutable `cache-control` off a 404).
+  const CACHE_RULES: Record<string, RouteRuleConfig> = {
+    "/build/**": {
+      headers: { "cache-control": "public, max-age=31536000, immutable", "x-rule": "1" },
+    },
+  };
+  const IMMUTABLE = "public, max-age=31536000, immutable";
+
+  it("yields to a thrown HTTPError's own header", async () => {
+    const app = createApp(CACHE_RULES);
+    app.get("/build/**", () => {
+      throw new HTTPError({ status: 404, headers: { "Cache-Control": "no-store" } });
+    });
+    const res = await app.fetch(new Request("http://test/build/missing.js"));
+    expect(res.status).toBe(404);
+    expect(res.headers.get("cache-control")).toBe("no-store");
+    expect(res.headers.get("x-rule")).toBe("1");
+  });
+
+  it("yields to a returned HTTPError's own header", async () => {
+    const app = createApp(CACHE_RULES);
+    app.get(
+      "/build/**",
+      () => new HTTPError({ status: 404, headers: { "cache-control": "no-store" } }),
+    );
+    const res = await app.fetch(new Request("http://test/build/missing.js"));
+    expect(res.status).toBe(404);
+    expect(res.headers.get("cache-control")).toBe("no-store");
+    expect(res.headers.get("x-rule")).toBe("1");
+  });
+
+  it("yields to an HTTPError header from inner middleware, with onError", async () => {
+    const app = new H3({ onError: () => {} });
+    app.use(routeRules(CACHE_RULES));
+    app.use(() => {
+      throw new HTTPError({ status: 404, headers: { "cache-control": "no-store" } });
+    });
+    const res = await app.fetch(new Request("http://test/build/missing.js"));
+    expect(res.status).toBe(404);
+    expect(res.headers.get("cache-control")).toBe("no-store");
+  });
+
+  it("still wins over errHeaders staged inside the rule", async () => {
+    // CORS helpers and appends write errHeaders too, so it is not an opt-out signal.
+    const app = createApp({
+      "/build/**": {
+        headers: { "access-control-allow-origin": "https://rule.com", vary: "x-rule" },
+      },
+    });
+    app.use((event) => {
+      appendCorsHeaders(event, { origin: "*" });
+      event.res.errHeaders.append("vary", "accept-encoding");
+    });
+    app.get("/build/**", () => {
+      throw new HTTPError({ status: 404 });
+    });
+    const res = await app.fetch(new Request("http://test/build/missing.js"));
+    expect(res.status).toBe(404);
+    expect(res.headers.get("access-control-allow-origin")).toBe("https://rule.com");
+    expect(res.headers.get("vary")).toBe("x-rule");
+  });
+
+  it("still wins over a returned error Response's own header", async () => {
+    // e.g. an upstream 404 passed through by `proxy`: not an h3-level opt-out.
+    const app = createApp(CACHE_RULES);
+    app.get(
+      "/build/**",
+      () => new Response("nope", { status: 404, headers: { "cache-control": "max-age=60" } }),
+    );
+    const res = await app.fetch(new Request("http://test/build/missing.js"));
+    expect(res.status).toBe(404);
+    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
+  });
+
+  it("still wins over errHeaders staged outside the rule", async () => {
+    const app = new H3();
+    app.use((event) => {
+      event.res.errHeaders.set("cache-control", "outer");
+    });
+    app.use(routeRules(CACHE_RULES));
+    app.get("/build/**", () => {
+      throw new HTTPError({ status: 404 });
+    });
+    const res = await app.fetch(new Request("http://test/build/missing.js"));
+    expect(res.status).toBe(404);
+    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
+  });
+
+  it("still wins over cors-staged errHeaders", async () => {
+    // `cors` (order -3) stages `vary: origin` into errHeaders before this rule runs.
+    const app = createApp({
+      "/api/**": { cors: { origin: ["https://a.com"] }, headers: { vary: "x-rule" } },
+    });
+    app.get("/api/x", () => {
+      throw new HTTPError({ status: 404 });
+    });
+    const res = await app.fetch(
+      new Request("http://test/api/x", { headers: { origin: "https://a.com" } }),
+    );
+    expect(res.status).toBe(404);
+    expect(res.headers.get("access-control-allow-origin")).toBe("https://a.com");
+    expect(res.headers.get("vary")).toBe("x-rule");
+  });
+
+  it("stacked rules: outer wins, and both yield to an HTTPError header", async () => {
+    const app = new H3();
+    app.use(routeRules({ "/build/**": { 
```

---

### Incident Patch 2: `1326e74d` (2026-10-20)
**Commit Message**: fix: keep middleware-staged headers out of handler-level caches (#1608)

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ src/
 │   ├── json-rpc.ts       # defineJsonRpcHandler, defineJsonRpcWebSocketHandler
 │   ├── event-stream.ts   # createEventStream (SSE)
 │   ├── static.ts         # serveStatic
-│   ├── cache.ts          # handleCacheHeaders
+│   ├── cache.ts          # handleCacheHeaders, withCacheIsolation
 │   ├── middleware.ts      # onRequest, onResponse, onError, bodyLimit
 │   ├── route.ts          # defineRoute
 │   ├── base.ts           # withBase
```

**File**: `docs/2.utils/1.request.md` (modified, +27/-0)
```diff
@@ -162,6 +162,33 @@ Check request caching headers (`If-None-Match`, `If-Modified-Since`) and add cac
 
 Note: `public` is added by default, but never alongside a caller-supplied `private`/`no-store` directive, so passing `cacheControls: ["private"]` no longer produces a contradictory `public, private`.
 
+### `withCacheIsolation(handler)`
+
+Wrap a cached handler so headers staged on `event.res` before it runs (for example by global middleware) never enter its cache entry.
+
+A cache miss usually renders the handler result with `toResponse(value, event)`, which merges staged headers into the stored response, so later hits would replay one user's headers to everyone. The wrapper takes them off the event for the cached dispatch and merges them onto each successful response, hit or miss; error responses (4xx/5xx) don't receive them, as in h3. When the handler returns something other than a `Response`, they are put back on the event instead.
+
+A staged header wins over the same header set by the handler, so a miss looks the same as a hit.
+
+Headers that decide whether a response may be stored stay visible to the cache: a staged `Cache-Control` and every staged `Vary` name except `origin`. A response that middleware marked `private`/`no-store`, or that varies on a request header the cache isn't keyed on, is therefore not stored. A staged `private`/`no-store` `Cache-Control` is also sent to the client in place of the one the cached handler sets, so a CDN in front of the app doesn't store it either. A `Vary: Origin` is isolated, because the CORS headers it declares are staged per request as well.
+
+Properties of the wrapped handler (such as ocache's `invalidate`, `expire` and `resolveKeys`) are copied to the returned handler.
+
+**Example:**
+
+```ts
+import { handleCacheHeaders, toResponse, withCacheIsolation } from "h3";
+import { defineCachedHandler } from "ocache";
+const cached = withCacheIsolation(
+  defineCachedHandler(() => "hello", {
+    maxAge: 60,
+    toResponse: (value, event) => toResponse(value, event),
+    handleCacheHeaders: (event, conditions) => handleCacheHeaders(event, conditions),
+  }),
+);
+app.get("/cached", cached);
+```
+
 <!-- /automd -->
 
 ## More Request Utils
```

**File**: `src/index.ts` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ export { sanitizeStatusCode, sanitizeStatusMessage } from "./utils/sanitize.ts";
 
 // Cache
 
-export { type CacheConditions, handleCacheHeaders } from "./utils/cache.ts";
+export { type CacheConditions, handleCacheHeaders, withCacheIsolation } from "./utils/cache.ts";
 
 // Path
 
```

**File**: `src/rules/cache.ts` (modified, +4/-118)
```diff
@@ -1,8 +1,7 @@
 import { defineHandler } from "../handler.ts";
 import { HTTPError } from "../error.ts";
 import { HTTPResponse, toResponse } from "../response.ts";
-import { handleCacheHeaders } from "../utils/cache.ts";
-import { kEventRes, kEventResHeaders } from "../event.ts";
+import { handleCacheHeaders, withCacheIsolation } from "../utils/cache.ts";
 import type { H3Event } from "../event.ts";
 import type { EventHandler } from "../types/handler.ts";
 import type { ServerRequest } from "srvx";
@@ -77,7 +76,7 @@ function withoutVaryOrigin(vary: string): string | undefined {
  * an undeclared `Vary` name is not cacheable, and keying by origin instead
  * would give every origin its own copy of the same body.
  *
- * With `routeRules()` as global middleware {@link detachStagedHeaders} already
+ * With `routeRules()` as global middleware {@link withCacheIsolation} already
  * keeps the rule's headers out; as route middleware the `cors` rule runs again
  * inside the cached dispatch and stages them where `toResponse` sees them.
  */
@@ -137,104 +136,6 @@ function moveVolatileHeaders(res: Response, event: H3Event): Response {
   return res;
 }
 
-// Matches a `*` entry of a comma-separated `Vary` list.
-const RE_VARY_WILDCARD = /(?:^|,)\s*\*\s*(?:,|$)/;
-
-/**
- * Take the headers earlier middleware staged on `event.res` out of the event,
- * so the `toResponse` of a cache miss cannot merge them into the shared entry
- * (h3js/h3#1605). They are per-request and go back onto every response, hit
- * or miss, through {@link withStagedHeaders}.
- *
- * `Cache-Control` and a wildcard `Vary` stay staged: they decide whether the
- * response may be stored at all, and ocache only sees them in the entry. A
- * middleware staging `private` for an authenticated request must keep that
- * response out of the shared cache, not just off the wire.
- *
- * They stay out of the event rather than being restored onto it: an `swr`
- * revalidation keeps running the handler on this event after the stale
- * response is returned. Error headers are left alone, since an error status
- * is never stored.
- */
-function detachStagedHeaders(event: H3Event): Headers | undefined {
-  const res = (event as any)[kEventRes];
-  const staged: Headers | undefined = res?.[kEventResHeaders];
-  if (!staged) {
-    return;
-  }
-  const kept = new Headers();
-  const cacheControl = staged.get("cache-control");
-  if (cacheControl !== null) {
-    kept.set("cache-control", cacheControl);
-    staged.delete("cache-control");
-  }
-  const vary = staged.get("vary");
-  if (vary !== null && RE_VARY_WILDCARD.test(vary)) {
-    kept.set("vary", vary);
-    staged.delete("vary");
-  }
-  res[kEventResHeaders] = kept.keys().next().done ? undefined : kept;
-  return staged.keys().next().done ? undefined : staged;
-}
-
-/**
- * Merge `source` into `target` the way h3 merges staged headers into a
- * response, except that `Vary` lists are joined: the entry's own `Vary`
- * declares its cache key and must not be replaced by a staged one.
- */
-function mergeStagedHeaders(target: Headers, source: Headers): void {
-  for (const [name, value] of source) {
-    if (name === "set-cookie") {
-      target.append(name, value);
-    } else if (name === "vary" && target.has("vary")) {
-      appendVary(target, value);
-    } else {
-      target.set(name, value);
-    }
-  }
-}
-
-function appendVary(headers: Headers, value: string): void {
-  const names = headers
-    .get("vary")!
-    .split(",")
-    .map((name) => name.trim());
-  const known = new Set(names.map((name) => name.toLowerCase()));
-  for (const name of value.split(",")) {
-    const trimmed = name.trim();
-    if (trimmed && !known.has(trimmed.toLowerCase())) {
-      known.add(trimmed.toLowerCase());
-      names.push(trimmed);
-    }
-  }
-  headers.set("vary", names.filter(Boolean).join(", "));
-}
-
-/**
- * Apply detached staged headers to the response the cache returned. Headers
- * staged during the dispatch (`handleCacheHeaders`, moved volatile headers)
- * are still on `event.res` and are merged over these by h3 as usual. Like h3,
- * success headers never reach an error response.
- */
-function withStagedHeaders(res: Response, staged: Headers): Response {
-  if (res.status >= 400) {
-    return res;
-  }
-  const headers = new Headers(res.headers);
-  mergeStagedHeaders(headers, staged);
-  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
-}
-
-/** Put detached headers back under whatever was staged since, for h3 to render. */
-function reattachStagedHeaders(event: H3Event, staged: Headers): void {
-  const res = event.res as any;
-  const after: Headers | undefined = res[kEventResHeaders];
-  if (after) {
-    mergeStagedHeaders(staged, after);
-  }
-  res[kEventResHeaders] = staged;
-}
-
 /**
  * Requests ocache never reads or writes an entry for (`isBypassedMethod`): it
  * runs the handler live and returns, so the rule has nothing to cont
```

**File**: `src/utils/cache.ts` (modified, +64/-0)
```diff
@@ -1,5 +1,11 @@
 import type { H3Event } from "../event.ts";
 import { isCacheMatch } from "./internal/cache.ts";
+import {
+  detachStagedHeaders,
+  getStagedHeader,
+  reattachStagedHeaders,
+  withStagedHeaders,
+} from "./internal/staged-headers.ts";
 
 export interface CacheConditions {
   modifiedTime?: string | Date;
@@ -79,3 +85,61 @@ export function handleCacheHeaders(event: H3Event, opts: CacheConditions): boole
 
   return false;
 }
+
+/**
+ * Wrap a cached handler so headers staged on `event.res` before it runs (for example by global middleware) never enter its cache entry.
+ *
+ * A cache miss usually renders the handler result with `toResponse(value, event)`, which merges staged headers into the stored response, so later hits would replay one user's headers to everyone. The wrapper takes them off the event for the cached dispatch and merges them onto each successful response, hit or miss; error responses (4xx/5xx) don't receive them, as in h3. When the handler returns something other than a `Response`, they are put back on the event instead.
+ *
+ * A staged header wins over the same header set by the handler, so a miss looks the same as a hit.
+ *
+ * Headers that decide whether a response may be stored stay visible to the cache: a staged `Cache-Control` and every staged `Vary` name except `origin`. A response that middleware marked `private`/`no-store`, or that varies on a request header the cache isn't keyed on, is therefore not stored. A staged `private`/`no-store` `Cache-Control` is also sent to the client in place of the one the cached handler sets, so a CDN in front of the app doesn't store it either. A `Vary: Origin` is isolated, because the CORS headers it declares are staged per request as well.
+ *
+ * Properties of the wrapped handler (such as ocache's `invalidate`, `expire` and `resolveKeys`) are copied to the returned handler.
+ *
+ * @example
+ * import { handleCacheHeaders, toResponse, withCacheIsolation } from "h3";
+ * import { defineCachedHandler } from "ocache";
+ *
+ * const cached = withCacheIsolation(
+ *   defineCachedHandler(() => "hello", {
+ *     maxAge: 60,
+ *     toResponse: (value, event) => toResponse(value, event),
+ *     handleCacheHeaders: (event, conditions) => handleCacheHeaders(event, conditions),
+ *   }),
+ * );
+ * app.get("/cached", cached);
+ *
+ * @param handler The cached event handler to wrap.
+ */
+export function withCacheIsolation<T extends (event: H3Event) => unknown>(handler: T): T {
+  async function _handlerWithCacheIsolation(event: H3Event) {
+    const cacheControl = getStagedHeader(event, "cache-control");
+    const privateCacheControl =
+      cacheControl !== null && RE_PRIVATE.test(cacheControl) ? cacheControl : undefined;
+    const staged = detachStagedHeaders(event);
+    let res: unknown;
+    try {
+      res = await handler(event);
+    } catch (error) {
+      if (staged) {
+        reattachStagedHeaders(event, staged);
+      }
+      throw error;
+    }
+    if (privateCacheControl) {
+      // The cached dispatch's `handleCacheHeaders` replaces it with `public`;
+      // a shared cache in front of the app must still see it as private.
+      event.res.headers.set("cache-control", privateCacheControl);
+    }
+    if (!staged) {
+      return res;
+    }
+    if (res instanceof Response) {
+      return withStagedHeaders(res, staged);
+    }
+    reattachStagedHeaders(event, staged);
+    return res;
+  }
+  return Object.assign(_handlerWithCacheIsolation, handler) as unknown as T;
+}
```

**File**: `src/utils/internal/staged-headers.ts` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import { kEventRes, kEventResHeaders } from "../../event.ts";
+import type { H3Event } from "../../event.ts";
+
+/** Read a header staged on `event.res` without creating the response. */
+export function getStagedHeader(event: H3Event, name: string): string | null {
+  return (event as any)[kEventRes]?.[kEventResHeaders]?.get(name) ?? null;
+}
+
+/**
+ * Take the headers earlier middleware staged on `event.res` out of the event,
+ * so the `toResponse` of a cache miss cannot merge them into the shared entry
+ * (h3js/h3#1605). They are per-request and go back onto every response, hit
+ * or miss, through {@link withStagedHeaders}.
+ *
+ * `Cache-Control` and `Vary` names other than `origin` stay staged: they
+ * decide whether the response may be stored at all, and the cache only sees
+ * them in the entry. A middleware staging `private` for an authenticated
+ * request must keep that response out of the shared cache, not just off the
+ * wire.
+ *
+ * They stay out of the event rather than being restored onto it: an `swr`
+ * revalidation keeps running the handler on this event after the stale
+ * response is returned. Error headers are left alone, since an error status
+ * is never stored.
+ */
+export function detachStagedHeaders(event: H3Event): Headers | undefined {
+  const res = (event as any)[kEventRes];
+  const staged: Headers | undefined = res?.[kEventResHeaders];
+  if (!staged) {
+    return;
+  }
+  const kept = new Headers();
+  const cacheControl = staged.get("cache-control");
+  if (cacheControl !== null) {
+    kept.set("cache-control", cacheControl);
+    staged.delete("cache-control");
+  }
+  const vary = staged.get("vary");
+  if (vary !== null) {
+    // Only `origin` is detached: it declares the per-request CORS headers that
+    // are detached with it. Any other name may select what the handler renders
+    // (e.g. middleware reading `accept-language` into the context), so the
+    // cache must see it and refuse to store an entry it isn't keyed on.
+    const names = vary
+      .split(",")
+      .map((name) => name.trim())
+      .filter(Boolean);
+    const rest = names.filter((name) => name.toLowerCase() !== "origin");
+    if (rest.length > 0) {
+      kept.set("vary", rest.join(", "));
+    }
+    if (rest.length === names.length) {
+      staged.delete("vary");
+    } else {
+      staged.set("vary", "origin");
+    }
+  }
+  res[kEventResHeaders] = kept.keys().next().done ? undefined : kept;
+  return staged.keys().next().done ? undefined : staged;
+}
+
+/**
+ * Apply detached staged headers to the response the cache returned. Headers
+ * staged during the dispatch (`handleCacheHeaders`, ...) are still on
+ * `event.res` and are merged over these by h3 as usual. Like h3, success
+ * headers never reach an error response.
+ */
+export function withStagedHeaders(res: Response, staged: Headers): Response {
+  if (res.status >= 400) {
+    return res;
+  }
+  const headers = new Headers(res.headers);
+  mergeStagedHeaders(headers, staged);
+  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
+}
+
+/** Put detached headers back under whatever was staged since, for h3 to render. */
+export function reattachStagedHeaders(event: H3Event, staged: Headers): void {
+  const res = event.res as any;
+  const after: Headers | undefined = res[kEventResHeaders];
+  if (after) {
+    mergeStagedHeaders(staged, after);
+  }
+  res[kEventResHeaders] = staged;
+}
+
+/**
+ * Merge `source` into `target` the way h3 merges staged headers into a
+ * response, except that `Vary` lists are joined: the entry's own `Vary`
+ * declares its cache key and must not be replaced by a staged one.
+ */
+function mergeStagedHeaders(target: Headers, source: Headers): void {
+  for (const [name, value] of source) {
+    if (name === "set-cookie") {
+      target.append(name, value);
+    } else if (name === "vary" && target.has("vary")) {
+      appendVary(target, value);
+    } else {
+      target.set(name, value);
+    }
+  }
+}
+
+function appendVary(headers: Headers, value: string): void {
+  const names = headers
+    .get("vary")!
+    .split(",")
+    .map((name) => name.trim());
+  const known = new Set(names.map((name) => name.toLowerCase()));
+  for (const name of value.split(",")) {
+    const trimmed = name.trim();
+    if (trimmed && !known.has(trimmed.toLowerCase())) {
+      known.add(trimmed.toLowerCase());
+      names.push(trimmed);
+    }
+  }
+  headers.set("vary", names.filter(Boolean).join(", "));
+}
```

**File**: `test/cache.test.ts` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+import { createMemoryStorage, defineCachedHandler } from "ocache";
+import {
+  HTTPError,
+  defineHandler,
+  handleCacheHeaders,
+  toResponse,
+  withCacheIsolation,
+} from "../src/index.ts";
+import { H3Event } from "../src/index.ts";
+import { describeMatrix } from "./_setup.ts";
+
+describeMatrix("withCacheIsolation", (t, { it, expect }) => {
+  // A handler-level cache the way frameworks such as Nitro build one (h3js/h3#1607).
+  const createCached = (handler: (event: H3Event) => unknown, opts?: { varies?: string[] }) =>
+    withCacheIsolation(
+      defineCachedHandler(handler, {
+        storage: createMemoryStorage(),
+        maxAge: 60,
+        ...opts,
+        toResponse: (value, event) => toResponse(value, event as H3Event),
+        handleCacheHeaders: (event, conditions) => handleCacheHeaders(event as H3Event, conditions),
+      }),
+    );
+
+  it("keeps middleware-staged headers out of the cache entry", async () => {
+    const cached = createCached(() => "hello");
+    t.app.use((event) => {
+      const echo = event.req.headers.get("x-echo");
+      if (echo) event.res.headers.set("x-echo", echo);
+    });
+    t.app.get(
+      "/cached",
+      defineHandler((event) => cached(event)),
+    );
+
+    const miss = await t.fetch("/cached", { headers: { "x-echo": "a" } });
+    expect(miss.headers.get("x-echo")).toBe("a");
+    expect(await miss.text()).toBe("hello");
+
+    const hit = await t.fetch("/cached");
+    expect(hit.headers.get("x-echo")).toBeNull();
+    expect(await hit.text()).toBe("hello");
+
+    const other = await t.fetch("/cached", { headers: { "x-echo": "b" } });
+    expect(other.headers.get("x-echo")).toBe("b");
+  });
+
+  it("keeps middleware-staged cookies out of the cache entry", async () => {
+    const cached = createCached(() => "hello");
+    t.app.use((event) => {
+      const user = event.req.headers.get("x-user");
+      if (user) event.res.headers.append("set-cookie", `user=${user}`);
+    });
+    t.app.get("/cached", cached);
+
+    const miss = await t.fetch("/cached", { headers: { "x-user": "alice" } });
+    expect(miss.headers.get("set-cookie")).toBe("user=alice");
+    const hit = await t.fetch("/cached");
+    expect(hit.headers.get("set-cookie")).toBeNull();
+  });
+
+  it("still caches a route behind middleware that stages `vary: origin`", async () => {
+    let calls = 0;
+    const cached = createCached(() => `hello ${++calls}`);
+    t.app.use((event) => {
+      event.res.headers.set("vary", "origin");
+    });
+    t.app.get("/cached", cached);
+
+    const first = await t.fetch("/cached");
+    expect(await first.text()).toBe("hello 1");
+    expect(first.headers.get("vary")).toBe("origin");
+    const second = await t.fetch("/cached");
+    expect(await second.text()).toBe("hello 1");
+    expect(second.headers.get("vary")).toBe("origin");
+  });
+
+  it("does not store a response that varies on a header the cache isn't keyed on", async () => {
+    const cached = createCached((event) => `hello in ${event.context.lang}`);
+    t.app.use((event) => {
+      event.context.lang = event.req.headers.get("accept-language") ?? "en";
+      event.res.headers.set("vary", "origin, accept-language");
+    });
+    t.app.get("/cached", cached);
+
+    const en = await t.fetch("/cached", { headers: { "accept-language": "en" } });
+    expect(await en.text()).toBe("hello in en");
+    const fr = await t.fetch("/cached", { headers: { "accept-language": "fr" } });
+    expect(await fr.text()).toBe("hello in fr");
+    expect(fr.headers.get("vary")).toBe("accept-language, origin");
+  });
+
+  it("caches per value of a staged `Vary` the cache is keyed on", async () => {
+    let calls = 0;
+    const cached = createCached((event) => `hello in ${event.context.lang} (${++calls})`, {
+      varies: ["accept-language"],
+    });
+    t.app.use((event) => {
+      event.context.lang = event.req.headers.get("accept-language") ?? "en";
+      event.res.headers.set("vary", "accept-language");
+    });
+    t.app.get("/cached", cached);
+
+    const fetchLang = async (lang: string) =>
+      (await t.fetch("/cached", { headers: { "accept-language": lang } })).text();
+    expect(await fetchLang("en")).toBe("hello in en (1)");
+    expect(await fetchLang("fr")).toBe("hello in fr (2)");
+    expect(await fetchLang("en")).toBe("hello in en (1)");
+  });
+
+  it("keeps the cached handler's own methods", async () => {
+    let calls = 0;
+    let url = "";
+    const cached = createCached((event) => {
+      url = event.req.url;
+      return `hello ${++calls}`;
+    });
+    t.app.get("/cached", cached);
+
+    expect(await (await t.fetch("/cached")).text()).toBe("hello 1");
+    expect(await (await t.fetch("/cached")).text()).toBe("hello 1");
+    expect(typeof cached.expire).toBe("function");
+    expect(typeof cached.resolveKeys).toBe("function");
+    await cached.invalidate(new H3Event(new Request(url)));
+    expect(await (await t.fetch
```

**File**: `test/rules/cache.test.ts` (modified, +22/-0)
```diff
@@ -753,6 +753,28 @@ describe("cache rule (ocache-backed, h3/rules/cache)", () => {
     }
   });
 
+  it("never stores a response behind middleware staging a non-`origin` `Vary`", async () => {
+    // Middleware that picks the rendered language from a request header the
+    // rule isn't keyed on must keep the cache from storing one language for all.
+    const app = new H3();
+    app.use((event) => {
+      event.context.lang = event.req.headers.get("accept-language") ?? "en";
+      event.res.headers.set("vary", "accept-language");
+    });
+    app.use(routeRules({ "/cached-lang": { cache: { maxAge: 60 } } }, { handlers: { cache } }));
+    app.get("/cached-lang", (event) => `hello in ${event.context.lang}`);
+
+    const en = await app.fetch(
+      new Request("http://localhost/cached-lang", { headers: { "accept-language": "en" } }),
+    );
+    expect(await en.text()).toBe("hello in en");
+    const fr = await app.fetch(
+      new Request("http://localhost/cached-lang", { headers: { "accept-language": "fr" } }),
+    );
+    expect(await fr.text()).toBe("hello in fr");
+    expect(fr.headers.get("vary")).toMatch(/accept-language/i);
+  });
+
   it("never stores a response middleware staged as `private`", async () => {
     // An auth middleware marks a personalized response private. Detaching that
     // `cache-control` with the other staged headers would store Alice's body
```

---

### Incident Patch 3: `d6588158` (2026-10-20)
**Commit Message**: fix(rules): keep middleware-staged headers out of `cache` entries (#1606)

**File**: `src/rules/cache.ts` (modified, +120/-1)
```diff
@@ -2,6 +2,7 @@ import { defineHandler } from "../handler.ts";
 import { HTTPError } from "../error.ts";
 import { HTTPResponse, toResponse } from "../response.ts";
 import { handleCacheHeaders } from "../utils/cache.ts";
+import { kEventRes, kEventResHeaders } from "../event.ts";
 import type { H3Event } from "../event.ts";
 import type { EventHandler } from "../types/handler.ts";
 import type { ServerRequest } from "srvx";
@@ -75,6 +76,10 @@ function withoutVaryOrigin(vary: string): string | undefined {
  * Left in place it would only make ocache refuse to store the entry at all —
  * an undeclared `Vary` name is not cacheable, and keying by origin instead
  * would give every origin its own copy of the same body.
+ *
+ * With `routeRules()` as global middleware {@link detachStagedHeaders} already
+ * keeps the rule's headers out; as route middleware the `cors` rule runs again
+ * inside the cached dispatch and stages them where `toResponse` sees them.
  */
 function moveVolatileHeaders(res: Response, event: H3Event): Response {
   if (event.req.method !== "GET" && event.req.method !== "HEAD") {
@@ -132,6 +137,104 @@ function moveVolatileHeaders(res: Response, event: H3Event): Response {
   return res;
 }
 
+// Matches a `*` entry of a comma-separated `Vary` list.
+const RE_VARY_WILDCARD = /(?:^|,)\s*\*\s*(?:,|$)/;
+
+/**
+ * Take the headers earlier middleware staged on `event.res` out of the event,
+ * so the `toResponse` of a cache miss cannot merge them into the shared entry
+ * (h3js/h3#1605). They are per-request and go back onto every response, hit
+ * or miss, through {@link withStagedHeaders}.
+ *
+ * `Cache-Control` and a wildcard `Vary` stay staged: they decide whether the
+ * response may be stored at all, and ocache only sees them in the entry. A
+ * middleware staging `private` for an authenticated request must keep that
+ * response out of the shared cache, not just off the wire.
+ *
+ * They stay out of the event rather than being restored onto it: an `swr`
+ * revalidation keeps running the handler on this event after the stale
+ * response is returned. Error headers are left alone, since an error status
+ * is never stored.
+ */
+function detachStagedHeaders(event: H3Event): Headers | undefined {
+  const res = (event as any)[kEventRes];
+  const staged: Headers | undefined = res?.[kEventResHeaders];
+  if (!staged) {
+    return;
+  }
+  const kept = new Headers();
+  const cacheControl = staged.get("cache-control");
+  if (cacheControl !== null) {
+    kept.set("cache-control", cacheControl);
+    staged.delete("cache-control");
+  }
+  const vary = staged.get("vary");
+  if (vary !== null && RE_VARY_WILDCARD.test(vary)) {
+    kept.set("vary", vary);
+    staged.delete("vary");
+  }
+  res[kEventResHeaders] = kept.keys().next().done ? undefined : kept;
+  return staged.keys().next().done ? undefined : staged;
+}
+
+/**
+ * Merge `source` into `target` the way h3 merges staged headers into a
+ * response, except that `Vary` lists are joined: the entry's own `Vary`
+ * declares its cache key and must not be replaced by a staged one.
+ */
+function mergeStagedHeaders(target: Headers, source: Headers): void {
+  for (const [name, value] of source) {
+    if (name === "set-cookie") {
+      target.append(name, value);
+    } else if (name === "vary" && target.has("vary")) {
+      appendVary(target, value);
+    } else {
+      target.set(name, value);
+    }
+  }
+}
+
+function appendVary(headers: Headers, value: string): void {
+  const names = headers
+    .get("vary")!
+    .split(",")
+    .map((name) => name.trim());
+  const known = new Set(names.map((name) => name.toLowerCase()));
+  for (const name of value.split(",")) {
+    const trimmed = name.trim();
+    if (trimmed && !known.has(trimmed.toLowerCase())) {
+      known.add(trimmed.toLowerCase());
+      names.push(trimmed);
+    }
+  }
+  headers.set("vary", names.filter(Boolean).join(", "));
+}
+
+/**
+ * Apply detached staged headers to the response the cache returned. Headers
+ * staged during the dispatch (`handleCacheHeaders`, moved volatile headers)
+ * are still on `event.res` and are merged over these by h3 as usual. Like h3,
+ * success headers never reach an error response.
+ */
+function withStagedHeaders(res: Response, staged: Headers): Response {
+  if (res.status >= 400) {
+    return res;
+  }
+  const headers = new Headers(res.headers);
+  mergeStagedHeaders(headers, staged);
+  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
+}
+
+/** Put detached headers back under whatever was staged since, for h3 to render. */
+function reattachStagedHeaders(event: H3Event, staged: Headers): void {
+  const res = event.res as any;
+  const after: Headers | undefined = res[kEventResHeaders];
+  if (after) {
+    mergeStagedHeaders(staged, after);
+  }
+  res[kEventResHeaders] = staged;
+}
+
 /**
  * Requests ocache never reads or writes an entry for (`isBypassedMethod`): it
  * run
```

**File**: `test/rules/cache.test.ts` (modified, +114/-1)
```diff
@@ -1,4 +1,4 @@
-import { H3, defineHandler, setCookie } from "../../src/index.ts";
+import { H3, HTTPError, defineHandler, setCookie } from "../../src/index.ts";
 import type { EventHandler } from "../../src/index.ts";
 import { describe, expect, it, vi } from "vitest";
 import { routeRules } from "../../src/rules/middleware.ts";
@@ -702,6 +702,119 @@ describe("cache rule (ocache-backed, h3/rules/cache)", () => {
     expect(calls).toBe(1);
   });
 
+  it("keeps headers staged by earlier middleware out of the entry (#1605)", async () => {
+    let calls = 0;
+    const app = new H3();
+    app.use((event) => {
+      const user = event.url.searchParams.get("user");
+      if (user) event.res.headers.set("x-user", user);
+    });
+    app.use(routeRules({ "/cached": { cache: { maxAge: 60 } } }, { handlers: { cache } }));
+    app.get("/cached", () => ({ calls: ++calls }));
+
+    const miss = await app.fetch(new Request("http://localhost/cached?user=alice"));
+    expect(miss.headers.get("x-cache")).toBe("MISS");
+    expect(miss.headers.get("x-user")).toBe("alice");
+
+    const hit = await app.fetch(new Request("http://localhost/cached"));
+    expect(hit.headers.get("x-cache")).toBe("HIT");
+    expect(await hit.json()).toEqual({ calls: 1 });
+    expect(hit.headers.get("x-user")).toBeNull();
+
+    // Merged back onto hits too.
+    const bob = await app.fetch(new Request("http://localhost/cached?user=bob"));
+    expect(bob.headers.get("x-cache")).toBe("HIT");
+    expect(bob.headers.get("x-user")).toBe("bob");
+  });
+
+  it("caches a route behind middleware that stages `vary: origin` (#1605)", async () => {
+    let calls = 0;
+    const app = new H3();
+    app.use((event) => {
+      event.res.headers.set("vary", "origin");
+    });
+    app.use(
+      routeRules(
+        { "/cached-vary": { cache: { maxAge: 60, varies: ["accept-language"] } } },
+        { handlers: { cache } },
+      ),
+    );
+    app.get("/cached-vary", () => ({ calls: ++calls }));
+
+    const first = await app.fetch(new Request("http://localhost/cached-vary"));
+    expect(first.headers.get("x-cache")).toBe("MISS");
+    const second = await app.fetch(new Request("http://localhost/cached-vary"));
+    expect(second.headers.get("x-cache")).toBe("HIT");
+    expect(await second.json()).toEqual({ calls: 1 });
+    // The staged `Vary` joins the entry's own instead of replacing it.
+    for (const res of [first, second]) {
+      expect(res.headers.get("vary")).toMatch(/origin/i);
+      expect(res.headers.get("vary")).toMatch(/accept-language/i);
+    }
+  });
+
+  it("never stores a response middleware staged as `private`", async () => {
+    // An auth middleware marks a personalized response private. Detaching that
+    // `cache-control` with the other staged headers would store Alice's body
+    // and serve it to the next anonymous request.
+    const app = new H3();
+    app.use((event) => {
+      const user = event.url.searchParams.get("user");
+      if (user) {
+        event.context.user = user;
+        event.res.headers.set("cache-control", "private, no-store");
+      }
+    });
+    app.use(routeRules({ "/cached-private": { cache: { maxAge: 60 } } }, { handlers: { cache } }));
+    app.get("/cached-private", (event) => ({ user: event.context.user ?? null }));
+
+    const alice = await app.fetch(new Request("http://localhost/cached-private?user=alice"));
+    expect(alice.headers.get("cache-control")).toBe("private, no-store");
+    expect(await alice.json()).toEqual({ user: "alice" });
+
+    const anon = await app.fetch(new Request("http://localhost/cached-private"));
+    expect(anon.headers.get("x-cache")).toBe("MISS");
+    expect(await anon.json()).toEqual({ user: null });
+  });
+
+  it("caches a `cors` + `cache` route with `routeRules()` as route middleware", async () => {
+    // The `cors` rule runs again inside the cached dispatch here, staging its
+    // `Vary: Origin` where the miss's `toResponse` merges it into the entry.
+    let calls = 0;
+    const app = new H3();
+    app.get("/cached-route-cors/:id", () => ({ calls: ++calls }), {
+      middleware: [
+        routeRules(
+          { "/cached-route-cors/**": { cors: { origin: "*" }, cache: { maxAge: 60 } } },
+          { handlers: { cache } },
+        ),
+      ],
+    });
+
+    const req = (origin: string) =>
+      app.fetch(new Request("http://localhost/cached-route-cors/a", { headers: { origin } }));
+    const first = await req("https://a.com");
+    expect(first.headers.get("x-cache")).toBe("MISS");
+    const second = await req("https://b.com");
+    expect(second.headers.get("x-cache")).toBe("HIT");
+    expect(await second.json()).toEqual({ calls: 1 });
+  });
+
+  it("keeps middleware-staged error headers when the cached handler throws", async () => {
+    const app = new H3();
+    app.use((event) => {
+      event.res.errHeaders.set("x-request-id", "abc");
+    });
+    app.use(routeRules({ "/cached-throw": { cache: { maxAg
```

#### Recent Merged Pull Requests:
- **PR #1614** (closed): fix(rules): keep `errHeaders` a handler staged for its own error response (@sarankumar1325)
- **PR #1613** (2026-10-22): fix(rules): let `HTTPError.headers` opt out of `headers` rule on errors (@pi0x)
- **PR #1608** (2026-10-20): fix: keep middleware-staged headers out of handler-level caches (@pi0x)
- **PR #1606** (2026-10-20): fix(rules): keep middleware-staged headers out of `cache` entries (@pi0x)
- **PR #1604** (closed): chore: remove `CLAUDE.md` (@iiio2)
- **PR #1602** (2026-10-18): build: remove bundled docs and open h3.dev from `h3 docs` (@pi0x)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. rules): let `HTTPError.headers` opt out of `headers` rule on errors (#1613)

**RULE**:
When implementing operations in `src/rules/handlers/headers.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in h3js/h3. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f90f4c8e`: rules): let `HTTPError.headers` opt out of `headers` rule on errors (#1613). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/rules/handlers/headers.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import type { HTTPError } from "../../error.ts";
import type { H3Event } from "../../event.ts";
// Applied on both the return and the throw path: a downstream throw unwinds past
// the `await`, and the rule's headers must still apply to the resulting error
//
// An `HTTPError` (thrown or returned) that carries one of the rule's keys in its
// own `headers` keeps it: that is the handler explicitly opting its error response
// out (e.g. `cache-control: no-store` on a 404 under an immutable asset rule,
// h3js/h3#1612). `errHeaders` would otherwise win over `error.headers`.
      let result: unknown;
        result = await next();
      } catch (error) {
        setRuleHeaders(event, entries, error);
        throw error;
      setRuleHeaders(event, entries, result);
      return result;

function setRuleHeaders(event: H3Event, entries: [string, string][], outcome: unknown): void {
  // Inlined `HTTPError.isError`: importing `HTTPError` would pull `error.ts` into
  // every `headers`-only bundle (test/rules/treeshake.test.ts budget).
  const own =
    outcome instanceof Error && outcome.name === "HTTPError" && (outcome as HTTPError).status > 99
      ? (outcome as HTTPError).headers
  
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// `finally`, not a plain post-`next()` loop: a downstream throw unwinds past the
// `await`, and the rule's headers must still apply to the resulting error
        return await next();
      } finally {
        for (const [key, value] of entries) {
          event.res.headers.set(key, value);
          event.res.errHeaders.set(key, value);
        }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f90f4c8e` are properly handled with clean fallback behavior.

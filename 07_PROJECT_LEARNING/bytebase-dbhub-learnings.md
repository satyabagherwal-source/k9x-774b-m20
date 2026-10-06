# Forensic Learning Record (Deep Inspection): bytebase/dbhub

> **Canonical Artifact**: `07_PROJECT_LEARNING/bytebase-dbhub-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bytebase/dbhub](https://github.com/bytebase/dbhub))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:01:59.263Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bytebase/dbhub`
- **Description**: Token conscious database MCP server for Postgres, MySQL, SQL Server, Oracle, MariaDB, SQLite.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3604 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `frontend/src/hooks/use-mobile.ts`
```
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

```

### Core Architecture Module: `frontend/src/lib/utils.ts`
```
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// crypto.randomUUID is only exposed in secure contexts (HTTPS or localhost),
// so fall back to building a v4 UUID from getRandomValues when the workbench
// is served over plain HTTP from a remote host.
export function generateId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

```

### Core Architecture Module: `src/connectors/health-check-utils.ts`
```
/**
 * Shared helpers for connector getHealthCheck() implementations.
 */

/** Converts a possibly-null/undefined driver value to a number, preserving null. */
export function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * Computes a cache/buffer hit-ratio percentage (0-100, rounded to 2 decimals)
 * from logical vs physical read counts. Returns null when there's no data
 * yet (zero or non-finite logical reads). Clamped to [0, 100]: the two
 * counters are read via separate, non-atomic queries, so physicalReads can
 * momentarily exceed logicalReads under concurrent load and would otherwise
 * produce a nonsensical negative (or >100) ratio.
 */
export function computeHitRatioPct(logicalReads: number, physicalReads: number): number | null {
  if (!Number.isFinite(logicalReads) || !Number.isFinite(physicalReads) || logicalReads === 0) {
    return null;
  }
  const pct = Math.round(((logicalReads - physicalReads) / logicalReads) * 10000) / 100;
  return Math.min(100, Math.max(0, pct));
}

```

### Core Architecture Module: `src/utils/allowed-keywords.ts`
```
import { ConnectorType } from "../connectors/interface.js";
import { stripCommentsAndStrings } from "./sql-parser.js";

/**
 * List of allowed keywords for SQL queries
 * Not only SELECT queries are allowed,
 * but also other queries that are not destructive
 */
export const allowedKeywords: Record<ConnectorType, string[]> = {
  postgres: ["select", "with", "explain", "show"],
  mysql: ["select", "with", "explain", "show", "describe", "desc"],
  mariadb: ["select", "with", "explain", "show", "describe", "desc"],
  sqlite: ["select", "with", "explain", "pragma"],
  // SQL Server has no native EXPLAIN statement; the connector translates a
  // leading `EXPLAIN` into a SET SHOWPLAN_XML request (see SQLServerConnector).
  sqlserver: ["select", "with", "explain"],
  // Oracle's native form is `EXPLAIN PLAN FOR <stmt>`; the connector accepts
  // both that and a bare `EXPLAIN <stmt>` and reads the plan back through
  // DBMS_XPLAN (see OracleConnector.explainQuery). EXPLAIN PLAN only parses
  // the statement, it never executes it.
  oracle: ["select", "with", "explain"],
};

/**
 * Keywords that indicate data-modifying operations.
 * Used to detect DML/DDL hidden inside CTEs or other constructs.
 */
const mutatingKeywords = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "truncate",
  "merge",
  "grant",
  "revoke",
  "rename",
];

/** Base pattern: matches any mutating keyword as a whole word */
const mutatingPattern = new RegExp(
  `\\b(?:${mutatingKeywords.join("|")})\\b`,
  "i",
);

/**
 * Extended pattern for dialects that support REPLACE INTO (MySQL/MariaDB/SQLite).
 * Only matches `REPLACE INTO` (with optional LOW_PRIORITY/DELAYED), not
 * REPLACE() function calls or identifiers named `replace`.
 */
const mutatingPatternWithReplace = new RegExp(
  `\\b(?:${mutatingKeywords.join("|")}|replace\\s+(?:(?:low_priority|delayed)\\s+)?into)\\b`,
  "i",
);

/**
 * T-SQL dynamic SQL primitives that can run arbitrary (including mutating)
 * statements.
 * - EXEC/EXECUTE: direct dynamic SQL execution
 * - sp_executesql: system proc for parameterized dynamic SQL (callable without
 *   EXEC as the first statement in a batch)
 * - xp_cmdshell: OS command execution
 *
 * Shared with the SQL Server connector's read-only backstop
 * (see executeReadOnly in src/connectors/sqlserver/index.ts), which re-checks
 * these because its rollback guard is application-level rather than
 * engine-enforced. Keep this list as the single source of truth: adding a
 * keyword here must tighten both the classifier and the backstop.
 */
export const sqlServerDynamicSqlKeywords = [
  "execute",
  "exec",
  "sp_executesql",
  "xp_cmdshell",
] as const;

/** Matches any SQL Server dynamic SQL primitive as a whole word */
export const sqlServerDynamicSqlPattern = new RegExp(
  `\\b(?:${sqlServerDynamicSqlKeywords.join("|")})\\b`,
  "i",
);

/**
 * T-SQL pass-through / ad-hoc data source table functions. Unlike the dynamic
 * SQL primitives above, these appear as ordinary table sources inside a plain
 * SELECT, so both read-only layers miss them:
 * - The classifier cannot see the payload, because OPENQUERY carries it as a
 *   string literal that stripCommentsAndStrings deliberately removes.
 * - The rollback backstop cannot contain it, because the work executes on the
 *   remote/ad-hoc source rather than in the local transaction.
 *
 * OPENROWSET additionally reads server-side files in its BULK form
 * (`OPENROWSET(BULK N'C:\...', SINGLE_CLOB)`), which exfiltrates data without
 * writing anything.
 *
 * Shared with executeReadOnly in src/connectors/sqlserver/index.ts on the same
 * single-source-of-truth basis as sqlServerDynamicSqlKeywords.
 */
export const sqlServerPassThroughKeywords = [
  "openquery",
  "openrowset",
  "opendatasource",
] as const;

/**
 * Matches a pass-through data source in call position. The trailing `\s*\(` is
 * required so an ordinary column named `openquery` still classifies as
 * read-only — only the invocation form is a bypass.
 */
export const sqlServerPassThroughPattern = new RegExp(
  `\\b(?:${sqlServerPassThroughKeywords.join("|")})\\s*\\(`,
  "i",
);

/**
 * Functions callable from a plain SELECT that reach beyond ordinary data
 * access and are NOT contained by a read-only transaction, because they are
 * gated by privilege rather than transaction mode. Matched in call position
 * (trailing `(`) on the comment/string-stripped SQL, so a column or table
 * named `load_file` still classifies as read-only. Per dialect:
 * - MySQL/MariaDB: LOAD_FILE reads server-side files (FILE privilege);
 *   GET_LOCK / RELEASE_LOCK / RELEASE_ALL_LOCKS take or release server-wide
 *   advisory locks (a session side effect).
 * - PostgreSQL: pg_read_file / pg_read_binary_file / pg_ls_dir read the
 *   server filesystem (pg_read_server_files role; default_transaction_read_only
 *   does not apply).
 * - SQL Server: OPENQUERY / OPENROWSET / OPENDATASOURCE run on a
 *   remote/ad-hoc source outside the local read-only transaction
 *   (sqlServerPassThroughKeywords, reused here as the single source of truth).
 *
 * - Oracle: the UTL_* / DBMS_* packages callable from a plain SELECT that
 *   reach the network or filesystem (UTL_HTTP, UTL_TCP, UTL_SMTP, UTL_INADDR,
 *   UTL_FILE, DBMS_LDAP) or run arbitrary code (DBMS_SQL, DBMS_SCHEDULER,
 *   DBMS_JAVA, DBMS_LOB.FILEOPEN & co), matched on the package prefix in
 *   member-access position (`utl_http.request(`), see escapeHatchCallSuffix.
 *
 * This is a best-effort guardrail: name matching is bypassable (quoted
 * identifiers, executable version comments), so least-privilege database
 * accounts remain the security boundary. See issue #377.
 *
 * NOTE: SQL Server's dynamic-SQL primitives (EXEC / sp_executesql /
 * xp_cmdshell) are NOT here — they are statement-leading forms, not
 * call-position functions, and already fail the first-keyword allow-list in
 * isReadOnlySQL. They classify as admin via sqlServerDynamicSqlPattern.
 */
export const escapeHatchFunctionKeywords: Partial<Record<ConnectorType, readonly string[]>> = {
  mysql: ["load_file", "get_lock", "release_lock", "release_all_locks"],
  mariadb: ["load_file", "get_lock", "release_lock", "release_all_locks"],
  postgres: ["pg_read_file", "pg_read_binary_file", "pg_ls_dir"],
  sqlserver: sqlServerPassThroughKeywords,
  // Oracle packages a SELECT can call to reach outside the database, matched
  // as `package.member(` (see escapeHatchCallSuffix).
  oracle: [
    "utl_http",
    "utl_tcp",
    "utl_smtp",
    "utl_inaddr",
    "utl_file",
    "dbms_ldap",
    "dbms_sql",
    "dbms_scheduler",
    "dbms_java",
    "dbms_lob",
    "dbms_xslprocessor",
    "dbms_advisor",
  ],
};

/**
 * What must follow an escape-hatch keyword for it to count as an invocation.
 * Functions are matched in call position (`name(`); Oracle's entries are
 * packages, invoked through a member call (`package.member(`). Either way a
 * column, table or alias merely named after the keyword, or a qualified
 * column reference like `dbms_sql.foo`, still classifies as read-only.
 */
const escapeHatchCallSuffix: Partial<Record<ConnectorType, string>> = {
  oracle: "\\s*\\.\\s*[a-z_][a-z0-9_$#]*\\s*\\(",
};
const DEFAULT_CALL_SUFFIX = "\\s*\\(";

const escapeHatchFunctionPatterns: Partial<Record<ConnectorType, RegExp>> = Object.fromEntries(
  Object.entries(escapeHatchFunctionKeywords).map(([type, keywords]) => [
    type,
    new RegExp(
      `\\b(?:${keywords.join("|")})${escapeHatchCallSuffix[type as ConnectorType] ?? DEFAULT_CALL_SUFFIX}`,
      "i"
    ),
  ])
);

/**
 * Whether (comment/string-stripped) SQL invokes one of the dialect's
 * escape-hatch functions in call position.
 */
export function hasEscapeHatchFunction(
  strippedSQL: string,
  connectorType: ConnectorType | string
): boolean {
  const pattern = escapeHatchFunctionPatterns[connectorType as ConnectorType];
  return pattern !== undefined && pattern.test(strippedSQL);
}

/**
 * Extended pattern for SQL Server: base mutating keywords plus the dynamic SQL
 * primitives above.
 */
const mutatingPatternSqlServer = new RegExp(
  `\\b(?:${[...mutatingKeywords, ...sqlServerDynamicSqlKeywords].join("|")})\\b`,
  "i",
);

/** Per-dialect mutating keyword pattern */
const mutatingPatterns: Record<ConnectorType, RegExp> = {
  postgres: mutatingPattern,
  mysql: mutatingPatternWithReplace,
  mariadb: mutatingPatternWithReplace,
  sqlite: mutatingPatternWithReplace,
  sqlserver: mutatingPatternSqlServer,
  oracle: mutatingPattern,
};

/**
 * Whether (comment/string-stripped) SQL contains a data-modifying keyword.
 * Shared by the read-only classifier's CTE check and the row limiter, so both
 * agree on what counts as a write hidden inside a WITH. Falls back to the
 * dialect-independent keyword set when no connector type is given.
 */
export function hasMutatingKeyword(
  strippedSQL: string,
  connectorType?: ConnectorType | string
): boolean {
  return (mutatingPatterns[connectorType as ConnectorType] ?? mutatingPattern).test(strippedSQL);
}

const selectIntoPattern = /\bselect\b[\s\S]+\binto\b/i;

/**
 * SQLite read-only introspection pragmas that legitimately take a parenthesized
 * argument (a table/index name) and return rows without mutating state. Any other
 * pragma using the parenthesized form is a setter (e.g. `PRAGMA user_version(1)`,
 * `PRAGMA query_only(0)`), which SQLite treats identically to the `= value` form.
 */
const sqliteReadOnlyArgPragmas = new Set([
  "table_info",
  "index_info",
  "index_list",
  "foreign_key_list",
]);

/** Matches `PRAGMA [schema.]name(` to extract the pragma name of the parenthesized form. */
const sqlitePragmaParenPattern = /^pragma\s+(?:[a-z0-9_]+\.)?([a-z0-9_]+)\s*\(/;

/** Matches EXPLAIN ANALYZE (or parenthesized form), excluding disabled forms (false/off/0) */
const explainAnalyzePattern =
  /^explain\s+(?:\([^)]*\banalyze\b(?!\s*(?:=\s*)?(?:false|off|0)\b)[^)]*\)|\banalyze\b(?!\s*(?:=\s*)?(?:false|off|0)\b)(?:\s+verbose\
```

### Core Architecture Module: `src/utils/auth-token.ts`
```
import { timingSafeEqual } from "node:crypto";

/**
 * Result of validating an HTTP request's `Authorization` header against the
 * configured bearer token allow-list.
 */
export type AuthTokenValidation =
  | { ok: true }
  | { ok: false; status: 401; message: string };

const BEARER_PREFIX = "Bearer ";

/**
 * Constant-time string equality. `timingSafeEqual` throws on unequal-length
 * buffers, so unequal lengths are rejected up front — this leaks only the
 * length of the configured token, not which bytes matched, which is the same
 * trade-off `timingSafeEqual` itself makes.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Bearer token auth for the HTTP transport (issue #66): "anyone with the
 * server URL can access the database." An empty `tokens` list means auth is
 * disabled — configuring a token is itself the opt-in (see
 * `resolveAuthTokens()` in `src/config/env.ts`), so there is no separate
 * "--require-auth" flag to forget to set.
 *
 * This intentionally stops at a shared-secret allow-list rather than
 * implementing the MCP spec's full OAuth 2.1 resource-server model (RFC 9728
 * protected-resource metadata, authorization-server discovery, dynamic client
 * registration, PKCE). That machinery solves multi-tenant identity
 * federation; DBHub's actual gap is coarser — "is this request from someone
 * who has the secret," not "who is this user and what scopes do they have."
 */
export function validateAuthToken(
  authorizationHeader: string | undefined,
  tokens: string[]
): AuthTokenValidation {
  if (tokens.length === 0) return { ok: true };

  if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
    return {
      ok: false,
      status: 401,
      message: "Missing or malformed Authorization header. Expected: Bearer <token>",
    };
  }

  const presented = authorizationHeader.slice(BEARER_PREFIX.length);
  const matches = tokens.some((token) => constantTimeEqual(presented, token));
  if (!matches) {
    return { ok: false, status: 401, message: "Invalid bearer token" };
  }

  return { ok: true };
}

```

### Core Architecture Module: `src/utils/aws-rds-signer.ts`
```
import { isDriverNotInstalled } from "./module-loader.js";

export interface RdsAuthTokenParams {
  hostname: string;
  port: number;
  username: string;
  region: string;
  profile?: string;
}

/**
 * Generate an AWS RDS IAM auth token for database authentication.
 * Uses the named shared-config profile when provided; otherwise the AWS SDK
 * default credential provider chain.
 *
 * Both providers are created with `ignoreCache: true`. The SDK caches the
 * contents of `~/.aws/credentials` and `~/.aws/config` in a module-level map
 * for the lifetime of the process, so a long-running DBHub would otherwise keep
 * signing with the credentials it read at startup and never notice that the
 * files were rotated externally (e.g. refreshed STS credentials). Tokens are
 * regenerated every ~14 minutes, so the extra file read is negligible.
 */
export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<string> {
  let Signer: typeof import("@aws-sdk/rds-signer")["Signer"];
  try {
    ({ Signer } = await import("@aws-sdk/rds-signer"));
  } catch (error) {
    if (isDriverNotInstalled(error, "@aws-sdk/rds-signer")) {
      throw new Error(
        'AWS IAM authentication requires the "@aws-sdk/rds-signer" package. Install it with: pnpm add @aws-sdk/rds-signer'
      );
    }
    throw error;
  }

  const signerConfig: ConstructorParameters<typeof Signer>[0] = {
    hostname: params.hostname,
    port: params.port,
    username: params.username,
    region: params.region,
  };

  const { fromIni, fromNodeProviderChain } = await import("@aws-sdk/credential-providers");
  signerConfig.credentials = params.profile
    ? fromIni({ profile: params.profile, ignoreCache: true })
    : fromNodeProviderChain({ ignoreCache: true });

  const signer = new Signer(signerConfig);

  return signer.getAuthToken();
}

```

### Core Architecture Module: `src/utils/client-identifier.ts`
```
/**
 * Client Identifier Utility
 * Extracts client information from MCP request context
 */

/**
 * Extract client identifier from request context
 * Returns User-Agent for HTTP transport, "stdio" for STDIO transport
 *
 * @param ctx - The context passed by MCP SDK to tool handlers
 * @returns Client identifier string (User-Agent or "stdio")
 */
export function getClientIdentifier(ctx: any): string {
  // MCP SDK v2 exposes the HTTP request as a Web Standard Request at ctx.http.req
  // (undefined on stdio transport)
  const userAgent = ctx?.http?.req?.headers.get("user-agent");
  if (userAgent) {
    return userAgent;
  }

  // Default for STDIO mode
  return "stdio";
}

```

### Core Architecture Module: `src/utils/config-watcher.ts`
```
import fs from "fs";
import { loadTomlConfig, resolveTomlConfigPath } from "../config/toml-loader.js";
import { ConnectorManager } from "../connectors/manager.js";
import { initializeToolRegistry } from "../tools/registry.js";
import type { SourceConfig, ToolConfig } from "../types/config.js";

const DEBOUNCE_MS = 500;

interface ConfigWatcherOptions {
  connectorManager: ConnectorManager;
  initialTools?: ToolConfig[];
}

/**
 * Watch the TOML configuration file for changes and reload sources automatically.
 * Only applicable when using TOML-based configuration.
 *
 * NOTE: In STDIO transport mode, the MCP server's tool list is registered once at
 * startup. Hot reload updates the underlying database connections and tool registry,
 * but STDIO clients won't see added/removed tools until a full server restart.
 * HTTP transport creates a fresh server per request, so tool changes take effect immediately.
 */
export function startConfigWatcher(options: ConfigWatcherOptions): (() => void) | null {
  const { connectorManager, initialTools } = options;
  const configPath = resolveTomlConfigPath();
  if (!configPath) {
    return null;
  }

  let debounceTimer: NodeJS.Timeout | null = null;
  let isReloading = false;
  let reloadPending = false;

  // Track last known-good config for rollback (sources + tools)
  let lastGoodSources: SourceConfig[] = connectorManager.getAllSourceConfigs();
  let lastGoodTools: ToolConfig[] | undefined = initialTools;

  const scheduleReload = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(reload, DEBOUNCE_MS);
  };

  const reload = async () => {
    if (isReloading) {
      reloadPending = true;
      return;
    }
    isReloading = true;
    reloadPending = false;

    try {
      console.error(`\nDetected change in ${configPath}, reloading configuration...`);

      // Parse and validate new config — if this throws, keep existing connections
      const newConfig = loadTomlConfig();
      if (!newConfig) {
        console.error("Config reload: failed to load TOML config, keeping existing connections.");
        return;
      }

      // Save current config for rollback
      const oldSources = lastGoodSources;
      const oldTools = lastGoodTools;

      // Disconnect all existing sources
      await connectorManager.disconnect();

      try {
        // Reconnect with new sources
        await connectorManager.connectWithSources(newConfig.sources);

        // Re-initialize tool registry with new config
        initializeToolRegistry({
          sources: newConfig.sources,
          tools: newConfig.tools,
        });

        // Update last known-good config
        lastGoodSources = newConfig.sources;
        lastGoodTools = newConfig.tools;

        console.error("Configuration reloaded successfully.");
      } catch (connectError) {
        console.error("Failed to connect with new config, rolling back:", connectError);
        // Clean up any partial connections before rollback
        try { await connectorManager.disconnect(); } catch { /* best effort */ }
        try {
          await connectorManager.connectWithSources(oldSources);
          initializeToolRegistry({ sources: oldSources, tools: oldTools });
          console.error("Rolled back to previous configuration.");
        } catch (rollbackError) {
          console.error("Rollback also failed, server has no active connections:", rollbackError);
        }
      }
    } catch (error) {
      console.error("Config reload failed, keeping existing connections:", error);
    } finally {
      isReloading = false;
      if (reloadPending) {
        reloadPending = false;
        scheduleReload();
      }
    }
  };

  const watcher = fs.watch(configPath, (eventType) => {
    if (eventType === "change") {
      scheduleReload();
    }
  });
  watcher.unref?.();
  watcher.on("error", (err) => {
    console.error("Config file watcher error:", err);
  });

  console.error(`Watching ${configPath} for changes (hot reload enabled)`);

  // Return cleanup function
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    watcher.close();
  };
}

```

### Core Architecture Module: `src/utils/cross-origin.ts`
```
import os from "node:os";

/**
 * Result of validating an HTTP request's Host (and Origin) headers against
 * the configured allow-list.
 */
export type OriginValidation =
  | { ok: true }
  | { ok: false; status: 400 | 403; message: string };

/**
 * DNS-rebinding defense for the HTTP transport.
 *
 * The previous implementation only checked that the request's `Origin`
 * hostname equalled its `Host` hostname. That is self-consistency between two
 * attacker-controlled values, not a trust decision: after DNS rebinding a
 * malicious page issues requests where *both* headers carry the attacker's
 * hostname, so the equality check passes and the browser reaches `/mcp`
 * (GHSA-fm8p-53ww-hf6w, GHSA-fp99-xwp4-hv8q, GHSA-qvg2-3c48-77mx).
 *
 * The real fix is to validate the `Host` header against an explicit allow-list
 * of hostnames the operator actually serves on — loopback by default. A
 * rebound `Host: evil.attacker.test` is not on that list and is rejected
 * regardless of what `Origin` says. The check runs even when `Origin` is
 * absent, because a rebound *same-origin* POST (the page and `/mcp` share the
 * attacker hostname) may omit `Origin` entirely.
 *
 * WHATWG URL parsing is used for both headers so IPv6 bracket notation
 * (e.g. `[::1]:8080`) is handled correctly — a naive `split(':')[0]` on the
 * Host header yields `"["` for IPv6 literals.
 */

// Characters that must not appear in a Host header per RFC 3986's host/port
// grammar.  `new URL("http://" + host)` is lax — `evil.com/foo` silently
// parses to hostname `evil.com` with path `/foo`, and `evil.com@localhost`
// parses to hostname `localhost` with `evil.com` treated as userinfo.
// Either case would let a crafted Host header slip past the allow-list.
const INVALID_HOST_CHARS = /[\s/\\@?#]/;

// Loopback hostnames are always allowed: this is the default, safe-by-design
// access path for a developer-workstation MCP server. `[::1]` is bracketed to
// match the canonical form `new URL().hostname` produces for IPv6 literals.
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// Sentinel entry that disables Host/Origin validation entirely. For operators
// who deliberately expose DBHub on a network behind their own auth/proxy and
// accept the risk.
export const ALLOW_ANY_HOST = "*";

/**
 * Normalize a host entry (from config or a bind address) to the canonical,
 * lower-cased, port-stripped hostname that `new URL().hostname` yields, so it
 * can be compared against parsed request headers. IPv6 literals must be
 * bracketed (e.g. `[::1]`). Returns `null` for empty/unparseable input, or the
 * `ALLOW_ANY_HOST` sentinel passed straight through.
 */
function normalizeHost(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === ALLOW_ANY_HOST) return ALLOW_ANY_HOST;
  // Mirror the Host-header validation: reject crafted authority strings such as
  // "evil.com/foo" or "evil.com@localhost" that URL parsing would otherwise
  // silently normalize to an unintended hostname (e.g. an operator typo
  // broadening the allow-list).
  if (INVALID_HOST_CHARS.test(trimmed)) return null;
  try {
    const hostname = new URL(`http://${trimmed}`).hostname.toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

/**
 * Collect the machine's own hostname and external (non-loopback) interface IP
 * addresses. Used to auto-allow clients that reach DBHub by IP or machine name
 * when bound to a wildcard address, so the common network-access case works
 * without `--allowed-hosts`.
 *
 * This is safe against DNS rebinding: a rebound request carries the *attacker's*
 * hostname in `Host` (the name in the browser's URL bar), never the victim
 * machine's own IP or name, so these entries can never match an attack. A
 * direct cross-origin fetch to one of these IPs still carries a foreign
 * `Origin` and is rejected by the Origin check.
 */
export function getSelfHosts(): string[] {
  const hosts: string[] = [];

  try {
    const hostname = os.hostname().trim();
    if (hostname) hosts.push(hostname);
  } catch {
    // hostname unavailable — skip
  }

  let interfaces: ReturnType<typeof os.networkInterfaces> = {};
  try {
    interfaces = os.networkInterfaces();
  } catch {
    // interface enumeration unavailable — skip
  }

  for (const addrs of Object.values(interfaces)) {
    for (const addr of addrs ?? []) {
      // Loopback is already on the list; skip internal addresses.
      if (!addr.address || addr.internal) continue;

      // Node reports family as the string "IPv6" (or the number 6 on newer
      // releases); handle both.
      const isIPv6 = addr.family === "IPv6" || (addr.family as unknown) === 6;
      if (isIPv6) {
        const bare = addr.address.split("%")[0]; // drop zone id, e.g. fe80::1%en0
        // Link-local addresses need a zone id to be routable and just add
        // noise to the allow-list — skip them.
        if (bare.toLowerCase().startsWith("fe80")) continue;
        hosts.push(`[${bare}]`);
      } else {
        hosts.push(addr.address);
      }
    }
  }

  return hosts;
}

/**
 * Build the set of hostnames the HTTP transport will accept in the `Host`
 * header. Always includes loopback. When bound to a concrete (non-wildcard)
 * address, that address is added. When bound to a wildcard (0.0.0.0 / ::), the
 * machine's own hostname/IPs (`selfHosts`) are added so network clients work
 * without extra config. Operator-configured hosts are always added. A single
 * `*` entry anywhere disables the check (returns a set containing only `*`).
 */
export function buildAllowedHosts(
  configured: string[] = [],
  bindHost?: string,
  selfHosts: string[] = []
): Set<string> {
  const normalizedConfigured = configured
    .map(normalizeHost)
    .filter((h): h is string => h !== null);

  if (normalizedConfigured.includes(ALLOW_ANY_HOST)) {
    return new Set([ALLOW_ANY_HOST]);
  }

  const hosts = new Set<string>();
  for (const h of LOOPBACK_HOSTS) {
    const normalized = normalizeHost(h);
    if (normalized) hosts.add(normalized);
  }

  const normalizedBind = bindHost ? normalizeHost(bindHost) : null;
  // Wildcard binds (0.0.0.0 / ::) are not real hostnames a client targets.
  const bindIsWildcard =
    !normalizedBind || normalizedBind === "0.0.0.0" || normalizedBind === "[::]";

  if (normalizedBind && !bindIsWildcard) {
    hosts.add(normalizedBind);
  }

  // Self hostnames/IPs are only reachable — and thus only relevant — when bound
  // to a wildcard address; a concrete bind already contributed its one address.
  if (bindIsWildcard) {
    for (const h of selfHosts) {
      const normalized = normalizeHost(h);
      if (normalized) hosts.add(normalized);
    }
  }

  for (const h of normalizedConfigured) hosts.add(h);

  return hosts;
}

/**
 * Validate a request's `Host` (and `Origin`, when present) against the
 * allow-list. The `Host` check is the DNS-rebinding defense and always runs;
 * the `Origin` check additionally guards the CORS reflection so an arbitrary
 * origin is never echoed back into `Access-Control-Allow-Origin`.
 */
export function validateOrigin(
  originHeader: string | undefined,
  hostHeader: string | undefined,
  allowedHosts: Set<string>
): OriginValidation {
  const allowAny = allowedHosts.has(ALLOW_ANY_HOST);

  // 1. Validate the Host header (the rebinding defense — runs unconditionally).
  const trimmedHost = (hostHeader ?? "").trim();
  if (!trimmedHost || INVALID_HOST_CHARS.test(trimmedHost)) {
    return { ok: false, status: 400, message: "Malformed Host header" };
  }

  let hostname: string;
  try {
    hostname = new URL(`http://${trimmedHost}`).hostname.toLowerCase();
  } catch {
    return { ok: false, status: 400, message: "Malformed Host header" };
  }
  if (!hostname) {
    return { ok: false, status: 400, message: "Malformed Host header" };
  }

  if (!allowAny && !allowedHosts.has(hostname)) {
    return {
      ok: false,
      status: 403,
      message:
        `Host '${hostname}' is not allowed. Only loopback is permitted by default; ` +
        `set --allowed-hosts (or DBHUB_ALLOWED_HOSTS) to serve other hostnames. ` +
        `This protects against DNS rebinding.`,
    };
  }

  // 2. Origin is only sent by browsers on cross-origin fetches; non-browser
  //    MCP clients omit it. When present it must also be an allowed host so we
  //    never reflect an untrusted origin in the CORS response.
  if (originHeader === undefined) return { ok: true };

  const trimmedOrigin = originHeader.trim();
  if (!trimmedOrigin) {
    return { ok: false, status: 400, message: "Malformed Origin header" };
  }

  let originHostname: string;
  try {
    originHostname = new URL(trimmedOrigin).hostname.toLowerCase();
  } catch {
    return { ok: false, status: 400, message: "Malformed Origin header" };
  }
  if (!originHostname) {
    return { ok: false, status: 400, message: "Malformed Origin header" };
  }

  if (!allowAny && !allowedHosts.has(originHostname)) {
    return {
      ok: false,
      status: 403,
      message: `Origin '${originHostname}' is not allowed`,
    };
  }

  return { ok: true };
}

```

### Core Architecture Module: `src/utils/dsn-database.ts`
```
import { obfuscateDSNPassword } from "./dsn-obfuscate.js";

/**
 * Raised when a DSN omits the database component for a connector that requires
 * one. Distinct from a generic parse failure so DSN parsers can rethrow it
 * unchanged instead of burying it under "Failed to parse ... DSN:".
 */
export class MissingDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingDatabaseError";
  }
}

/**
 * Reject a DSN that names no database.
 *
 * MySQL/MariaDB can connect without a default database, but DBHub does not
 * support it: `USE other_db` cannot switch databases (it is not a read-only
 * allowed keyword, and each query checks a connection out of the pool and
 * releases it, so the change would not persist), unqualified SQL fails with
 * "No database selected", and schema discovery would fan out across every
 * database on the server. Multi-database setups belong in a TOML config with
 * one source per database.
 *
 * @param database  Database component extracted from the DSN (may be empty)
 * @param dsn       Original DSN, used to build an obfuscated error message
 * @param label     Human-readable connector name, e.g. "MySQL"
 */
export function requireDatabaseInDSN(database: string, dsn: string, label: string): void {
  if (database) {
    return;
  }

  throw new MissingDatabaseError(
    `${label} DSN must name a database.\n` +
      `Provided: ${obfuscateDSNPassword(dsn)}\n` +
      `Add the database to the DSN, e.g. ...:3306/mydb\n` +
      `To work with several databases, define one [[sources]] entry per ` +
      `database in a TOML config file: https://dbhub.ai/config/toml`
  );
}

```

### Core Architecture Module: `src/utils/dsn-obfuscate.ts`
```
import type { SSHTunnelConfig } from '../types/ssh.js';
import type { ConnectorType } from '../connectors/interface.js';
import { SafeURL } from './safe-url.js';

/**
 * Parsed connection information from a DSN string
 * Used to populate SourceConfig fields when DSN is provided
 */
export interface ParsedConnectionInfo {
  type?: ConnectorType;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
}

/**
 * Parse connection information from a DSN string
 * Extracts host, port, database, user, and type without exposing password
 *
 * @param dsn - Database connection string
 * @returns Parsed connection info or null if parsing fails
 */
export function parseConnectionInfoFromDSN(dsn: string): ParsedConnectionInfo | null {
  if (!dsn) {
    return null;
  }

  try {
    const type = getDatabaseTypeFromDSN(dsn);
    if (typeof type === 'undefined') {
      return null;
    }

    // Handle SQLite specially - it only has a database path
    if (type === 'sqlite') {
      // SQLite DSN format: sqlite:///path
      const prefix = 'sqlite:///';
      if (dsn.length > prefix.length) {
        const rawPath = dsn.substring(prefix.length);
        // Add leading '/' for Unix absolute paths only
        // Don't add '/' for:
        // - Memory database: starts with ':'
        // - Relative paths: starts with '.' or '~'
        // - Windows absolute: second char is ':' (e.g., C:/path)
        const firstChar = rawPath[0];
        const isWindowsDrive = rawPath.length > 1 && rawPath[1] === ':';
        const isSpecialPath = firstChar === ':' || firstChar === '.' || firstChar === '~' || isWindowsDrive;
        return {
          type,
          database: isSpecialPath ? rawPath : '/' + rawPath,
        };
      }
      return { type };
    }

    // Parse other database DSNs using SafeURL
    const url = new SafeURL(dsn);

    const info: ParsedConnectionInfo = { type };

    if (url.hostname) {
      info.host = url.hostname;
    }

    if (url.port) {
      info.port = parseInt(url.port, 10);
    }

    if (url.pathname && url.pathname.length > 1) {
      // Remove leading '/' from pathname
      info.database = url.pathname.substring(1);
    }

    if (url.username) {
      info.user = url.username;
    }

    return info;
  } catch {
    // If parsing fails, return null
    return null;
  }
}

/**
 * Placeholder returned in place of a DSN that could not be parsed.
 * Unparseable input (e.g. a scheme-less "user:pass@host/db") may still carry a
 * password, so the original string is never echoed back.
 */
export const REDACTED_DSN = '<redacted DSN>';

/**
 * Obfuscates the password in a DSN string for logging purposes.
 * Fails closed: if the DSN cannot be parsed, returns REDACTED_DSN rather than
 * the original string.
 * @param dsn The original DSN string
 * @returns DSN string with password replaced by asterisks
 */
export function obfuscateDSNPassword(dsn: string): string {
  if (!dsn) {
    return dsn;
  }

  try {
    const type = getDatabaseTypeFromDSN(dsn);

    // SQLite has no password to obfuscate
    if (type === 'sqlite') {
      return dsn;
    }

    // Parse DSN using SafeURL
    const url = new SafeURL(dsn);

    // A DSN whose authority lacks an '@' (e.g. "postgres://user:secret/db")
    // parses with "user" as the host and "secret" as the port. A real port is
    // always numeric, so treat anything else as unparseable rather than
    // echoing what is likely a credential.
    if (url.port && !/^\d+$/.test(url.port)) {
      return REDACTED_DSN;
    }

    // No password to obfuscate
    if (!url.password) {
      return dsn;
    }

    // Reconstruct DSN with obfuscated password
    const obfuscatedPassword = '*'.repeat(Math.min(url.password.length, 8));
    const protocol = dsn.split(':')[0];

    let result;
    if (url.username) {
      result = `${protocol}://${url.username}:${obfuscatedPassword}@${url.hostname}`;
    } else {
      result = `${protocol}://${obfuscatedPassword}@${url.hostname}`;
    }
    if (url.port) {
      result += `:${url.port}`;
    }
    result += url.pathname;

    // Preserve query parameters
    if (url.searchParams.size > 0) {
      const params: string[] = [];
      url.forEachSearchParam((value, key) => {
        params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
      result += `?${params.join('&')}`;
    }

    return result;
  } catch {
    // Fail closed: an unparseable DSN may still contain a password
    return REDACTED_DSN;
  }
}

/**
 * Obfuscates sensitive information in SSH configuration for logging
 * @param config The SSH tunnel configuration
 * @returns SSH config with sensitive data replaced by asterisks
 */
export function obfuscateSSHConfig(config: SSHTunnelConfig): Partial<SSHTunnelConfig> {
  const obfuscated: Partial<SSHTunnelConfig> = {
    host: config.host,
    port: config.port,
    username: config.username,
  };
  
  if (config.password) {
    obfuscated.password = '*'.repeat(8);
  }
  
  if (config.privateKey) {
    obfuscated.privateKey = config.privateKey; // Keep path as-is
  }
  
  if (config.passphrase) {
    obfuscated.passphrase = '*'.repeat(8);
  }
  
  return obfuscated;
}

/**
 * Extracts the database type from a DSN string
 * @param dsn The DSN string to analyze
 * @returns The database type or undefined if cannot be determined
 */
export function getDatabaseTypeFromDSN(dsn: string): ConnectorType | undefined {
  if (!dsn) {
    return undefined;
  }

  const protocol = dsn.split(':')[0];
  return protocolToConnectorType(protocol);
}

/**
 * Maps a protocol string to a ConnectorType
 */
function protocolToConnectorType(protocol: string): ConnectorType | undefined {
  const mapping: Record<string, ConnectorType> = {
    'postgres': 'postgres',
    'postgresql': 'postgres',
    'mysql': 'mysql',
    'mariadb': 'mariadb',
    'sqlserver': 'sqlserver',
    'sqlite': 'sqlite',
    'oracle': 'oracle'
  };
  return mapping[protocol];
}

/**
 * Get the default port for a database type
 * @param type The database connector type
 * @returns The default port or undefined for SQLite
 */
export function getDefaultPortForType(type: ConnectorType): number | undefined {
  const ports: Record<ConnectorType, number | undefined> = {
    'postgres': 5432,
    'mysql': 3306,
    'mariadb': 3306,
    'sqlserver': 1433,
    'oracle': 1521,
    'sqlite': undefined,
  };
  return ports[type];
}
```

### Core Architecture Module: `src/utils/error-classifier.ts`
```
import type { ConnectorType } from "../connectors/interface.js";

/**
 * Distinct error codes for connection/access failures, so an MCP client can
 * tell "the source is down / mis-credentialed" (restore access) from "your
 * query is wrong" (fix the SQL). Anything not matched here is left to the
 * caller's existing generic error path.
 */
export type ConnectionErrorCode = "SOURCE_UNREACHABLE" | "AUTH_FAILED" | "TUNNEL_FAILED";

/**
 * Property set on errors thrown while establishing an SSH tunnel, so the
 * classifier can distinguish TUNNEL_FAILED from a plain network failure
 * without parsing message text. Set in ConnectorManager.connectSource.
 */
export const TUNNEL_ERROR_MARKER = "__dbhubSSHTunnelError";

// Node socket-level codes that mean "could not reach / lost the source".
// Timeout (ETIMEDOUT) is folded in here: refused vs timed-out differ at the
// TCP level but call for the same remediation.
const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNRESET",
]);

// Driver-specific "could not reach the source" codes, for drivers that wrap
// the socket failure instead of surfacing the errno.
const NETWORK_CODES_BY_TYPE: Partial<Record<ConnectorType, ReadonlySet<string>>> = {
  // NJS-503: "connection to host ... could not be established" (Thin mode)
  oracle: new Set(["NJS-503"]),
};

// Per-connector authentication failure signals. Keyed by code or errno.
const AUTH_CODES: Record<ConnectorType, ReadonlyArray<string | number>> = {
  postgres: ["28P01", "28000"],
  mysql: ["ER_ACCESS_DENIED_ERROR", 1045, 1698],
  mariadb: ["ER_ACCESS_DENIED_ERROR", 1045, 1698],
  sqlserver: ["ELOGIN"],
  // ORA-01017: invalid username/password; ORA-28000: account locked
  oracle: ["ORA-01017", "ORA-28000"],
  sqlite: [], // no network/auth layer
};

function unreachableMessage(sourceId: string): string {
  return `Source '${sourceId}' is unreachable. ` +
    `Verify the database is running and reachable (host, port, network), then retry.`;
}

function authMessage(sourceId: string): string {
  return `Authentication failed for source '${sourceId}'. ` +
    `Verify the credentials/access for this source are valid, then retry.`;
}

function tunnelMessage(sourceId: string): string {
  return `SSH tunnel for source '${sourceId}' failed to establish. ` +
    `Verify SSH host/credentials and bastion reachability, then retry.`;
}

/**
 * Classify a thrown error from a connect attempt or query into a connection
 * failure category. Returns null when the error is not a recognized
 * connection/access failure (caller should fall back to its generic handling).
 * Pure; never throws.
 */
export function classifyConnectionError(
  error: unknown,
  connectorType: ConnectorType,
  sourceId: string
): { code: ConnectionErrorCode; message: string } | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const err = error as Record<string, unknown>;

  // Tunnel marker wins over the underlying network code.
  if (err[TUNNEL_ERROR_MARKER] === true) {
    return { code: "TUNNEL_FAILED", message: tunnelMessage(sourceId) };
  }

  const code = err.code;
  if (
    typeof code === "string" &&
    (NETWORK_CODES.has(code) || NETWORK_CODES_BY_TYPE[connectorType]?.has(code))
  ) {
    return { code: "SOURCE_UNREACHABLE", message: unreachableMessage(sourceId) };
  }

  const authCodes = AUTH_CODES[connectorType];
  const errno = err.errno;
  if (
    (typeof code === "string" && authCodes.includes(code)) ||
    (typeof errno === "number" && authCodes.includes(errno))
  ) {
    return { code: "AUTH_FAILED", message: authMessage(sourceId) };
  }

  return null;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #323** (2026-06-09): **`search_objects` leaks tables from all databases in MySQL/MariaDB when schema is unspecified**
  *Symptoms*: ## Description  When using the `search_objects` tool with `object_type="table"` (or `"view"`) without specifying a `schema` parameter, the results include tables/views from **all databases** on the MySQL/MariaDB instance, not just the database configured in the DSN.  ## Why this matters for MCP clients  MCP clients (e.g. Claude Desktop, Cursor) only see the tool description and its parameters. They **cannot see the DSN or configuration file** — they have no way to know which database was configured. This means:  1. The AI **cannot** specify the correct `schema` because it doesn't know which one the user configured. 2. Calling `search_objects(object_type="schema")` to discover schemas returns **all databases** on the server, not just the configured one — further misleading the AI. 3. The AI may end up querying or referencing tables from databases the user never intended to expose.  ## Expected behavior  When a DSN specifies a database name (e.g. `mysql://user:pass@host:3306/mydb`), `search_objects` without a `schema` parameter should **default to the configured database only**. Explicit `schema` parameter can still be used to target other databases if the caller intends to.  In other words: **the default scope should match the DSN configuration, not the entire server instance.**  ## Root Cause  In `searchTables()` / `searchViews()` (`src/tools/search-objects.ts`), when no `schema` filter is provided, it falls back to `connector.getSchemas()` to enumerate schemas to search.  Th
  **Post-Mortem & Fix Analysis**:
  > I considered fixing this myself but decided against it. The database name (schema) can originate from multiple configuration sources — DSN string, TOML config file, environment variables, or command-line arguments — and each connector parses it differently. I wasn't confident I could cover all cases without potentially breaking multi-database TOML configurations or other existing behavior. I'll leave the fix to maintainers who have a deeper understanding of the configuration layer.
  > ## Update: Further investigation findings  Did some more digging into the configuration and call chain, here's what I found:  1. All config paths (TOML, env vars, CLI) eventually build a DSN string and parse through SafeURL — so the `database` is always available at the connector level.  2. The issue traces back to the template pattern in `src/tools/search-objects.ts` — when no `schema` param is provided, the code calls `getSchemas()` to get a list, then iterates with `getTables(schemaName)` for each one:  ```typescript // src/tools/search-objects.ts (repeated at lines 169-177, 274-282, 373-381, 462-470, 531-539) let schemasToSearch: string[]; if (schemaFilter) {   schemasToSearch = [schemaFilter]; } else {   schemasToSearch = await connector.getSchemas();  // Returns all databases in MySQL/MariaDB }  for (const schemaName of schemasToSearch) {   const tables = await connector.getTables(schemaName);  // Explicit schema → connector default never runs   // ... } ```  For MySQL/MariaDB, `

- **Issue #303** (2026-04-07): **Cannot find module '@azure/core-client'**
  *Symptoms*: When trying to run the dbhub via ` npx -y @bytebase/dbhub`, I encounter the following error:  ``` Skipping PostgreSQL connector: driver package "pg" not installed. Fatal error: Error: Cannot find module '@azure/core-client' Require stack: - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/client/identityClient.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/msal/nodeFlows/msalClient.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/credentials/clientCertificateCredential.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/credentials/environmentCredential.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/credentials/defaultAzureCredentialFunctions.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/credentials/defaultAzureCredential.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/index.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/tedious/lib/connection.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/tedious/lib/tedious.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/mssql/lib/tedious/connection-pool.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/mssql/lib/tedious/index.js     at Module._resolveFilename (node:internal/modules/cjs/loader:1421:15)     at defaultResolveImpl (node

- **Issue #287** (2026-03-28): **@bytebase/dbhub crashes on startup with "Dynamic require of 'fs' is not supported" on Node 20**
  *Symptoms*:  When running @bytebase/dbhub (all versions up to and including 0.20.0) via npx on Node.js 20, the process immediately crashes with the following fatal error before accepting any MCP connections:                                                                                                                     ```   Fatal error: Error: Dynamic require of "fs" is not supported          at file://.../@bytebase/dbhub/dist/chunk-WWAWV7DQ.js:15:9                                                           at node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3/lib/database.js       at file://.../@bytebase/dbhub/dist/sqlite-5LT56F5B.js:712:14           ```                                                                                                                                                              Root Cause:                                                                                                                                                                                                                             better-sqlite3 is a CommonJS native addon that uses synchronous require("fs") internally. The @bytebase/dbhub       bundle is compiled as ESM (dist/index.js is ESM). When the ESM bundle tries to load better-sqlite3 at startup,   Node 20's ESM loader rejects the dynamic require() call because dynamic require() of built-in Node modules (like    "fs") is not allowed inside ESM module scope.                                               
  **Post-Mortem & Fix Analysis**:
  > Fatal error: Error: Dynamic require of "events" is not supported     at file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/chunk-WWAWV7DQ.js:15:9     at node_modules/.pnpm/pg@8.16.0/node_modules/pg/lib/client.js (file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/postgres-JB3LPXGR.js:3716:24)     at __require2 (file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/chunk-WWAWV7DQ.js:21:50)     at node_modules/.pnpm/pg@8.16.0/node_modules/pg/lib/index.js (file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/postgres-JB3LPXGR.js:5022:19)     at __require2 (file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/chunk-WWAWV7DQ.js:21:50)     at file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/postgres-JB3LPXGR.js:5080:26     at ModuleJob.run (node:internal/modules/esm/module_job:430:25)     at async onImport.t
  > Happens on node v24 as well as 20
  > v22 也出现同样问题

- **Issue #280** (2026-03-27): **dbhub MCP process does not exit on Windows after client closes (stdio transport, launched via npx)**
  *Symptoms*: ### Summary  When using `@bytebase/dbhub` as an MCP server on Windows with `--transport stdio`, the dbhub process tree remains alive after the MCP client closes.  In my case the client is the Codex desktop app on Windows. Other MCP servers launched the same way from the same client, such as `chrome-devtools-mcp` and `@upstash/context7-mcp`, exit correctly when the client is closed. Only dbhub remains running.  This looks like a process leak or an issue handling stdio disconnect / shutdown on Windows.  ---  ### Environment  - OS: Windows 10 - Client: OpenAI Codex desktop app - DBHub MCP launch method: `npx -y @bytebase/dbhub@latest --transport stdio --config <path-to-config>` - Node.js installed locally - MCP transport: `stdio`  ---  ### Expected behavior  After the MCP client exits (or the stdio connection is closed), the dbhub process should exit automatically.  ---  ### Actual behavior  After closing Codex, the dbhub process tree remains alive.  Observed process tree:  - `node.exe` running `npx-cli.js -y @bytebase/dbhub@latest ...` - `cmd.exe /d /s /c dbhub --transport stdio --config ...` - child `node` process running `@bytebase/dbhub/dist/...`  Example:  ```powershell Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'codex' } | Select-Object ProcessId, ParentProcessId, CommandLine  ProcessId ParentProcessId CommandLine --------- --------------- -----------     37628           21580 "C:\Program Files\WindowsApps\OpenAI.Codex_26.313.5234.0_x64__2p2nqsd0c76g0\ap

- **Issue #279** (2026-03-24): **DBHub MCP loses precision for MySQL BIGINT values**
  *Symptoms*: ### Problem  DBHub MCP loses precision when returning large MySQL `BIGINT` values in JSON.  This makes primary keys and related IDs unreliable when they are larger than the JavaScript safe integer range.  ### Reproduction  Run a query that returns 19-digit integer values, for example:  ```sql SELECT id, related_id FROM some_table; ```  Example actual database values: ``` text 2033735037361704962 2033732940612358146 2033732769774161921 ``` DBHub returns values like: ```json [   { "id": 2033735037361705000, "related_id": 2033732940532666400 },   { "id": 2033732940612358100, "related_id": 2033732940532666400 },   { "id": 2033732769774162000, "related_id": 2033732769715441700 } ] ``` ### Expected BIGINT values should be returned exactly, without precision loss.  ### Likely Cause Large MySQL integers appear to be serialized as JavaScript number, which cannot safely represent values beyond Number.MAX_SAFE_INTEGER.

- **Issue #97** (2025-09-29): **Issue with multiple cursor projects open**
  *Symptoms*: **Title:** `dbhub-mssql-stdio` does not allow multiple open cursor instances – only first retains access  **Description:** When attempting to use multiple open cursors with `dbhub-mssql-stdio`, only the first cursor instance retains access to the database. Subsequent cursor instances fail to interact as expected, making it impossible to work with multiple concurrent cursors.  **Steps to Reproduce:**  1. Open a connection via `dbhub-mssql-stdio`. 2. Initialize a cursor and successfully execute queries. 3. Open a second cursor on the same connection. 4. Attempt to execute queries with the second cursor.  **Expected Behavior:** Each open cursor instance should have independent access to the connection, allowing concurrent queries/operations without interference.  **Actual Behavior:** Only the first cursor retains access. Subsequent cursors either fail silently or cannot execute queries.  **Impact:** This limitation prevents applications from managing multiple concurrent queries via cursors, reducing usability in multi-query workflows.  **Environment:**  * `dbhub-mssql-stdio` version: latest * OS: Windows 10 and 11 * SQL Server version: MSSQL  **Additional Context:** If this is a design limitation, documentation should clarify cursor constraints. If unintended, it may require internal state handling fixes to allow multiple concurrent cursor access. 
  **Post-Mortem & Fix Analysis**:
  > I haven't been able to reproduce the issue. Could you please paste the related code?
  > BTW, have you tried to run multiple dbhub instead sharding the same dbhub with multiple cursor instance?
  > this seems to be stable thanks!

- **Issue #14** (2025-04-23): **Azure SQL Database error**
  *Symptoms*: Hey, i am trying to run the docker on windows and trying to connect to an azure sql database using the sqlserver:// dsn but i keep getting this error: ``` Connecting with DSN: sqlserver://sql_db_user:db_user_password@db_server.database.windows.net:1433/db DSN source: command line argument Fatal error: ConnectionError: Login failed for user 'sql_db_user'.     at /app/node_modules/.pnpm/mssql@11.0.1/node_modules/mssql/lib/tedious/connection-pool.js:85:17     at Connection.onConnect (/app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/connection.js:849:9)     at Object.onceWrapper (node:events:633:26)     at Connection.emit (node:events:518:28)     at Connection.emit (/app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/connection.js:970:18)     at /app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/connection.js:2369:18     at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {   code: 'ELOGIN',   originalError: ConnectionError: Login failed for user 'sql_db_user'.       at Login7TokenHandler.onErrorMessage (/app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/token/handler.js:186:19)       at Readable.<anonymous> (/app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/token/token-stream-parser.js:19:33)       at Readable.emit (node:events:518:28)       at addChunk (node:internal/streams/readable:561:12)       at readableAddChunkPushObjectMode (node:internal/streams/readable:538:3)       at Readabl
  **Post-Mortem & Fix Analysis**:
  > I am experiencing an identical issue. However, If I don't pass through the dbname and only server, then the connection works, the only issue afterwards is to figure out how to traverse available DB's in sqlserver.   2025-04-08 14:32:17.302 [info] cker: Starting new stdio process with command: docker run -i --rm bytebase/dbhub --transport stdio --dsn sqlserver://user******:pass*********@*********.database.windows.net:1433 2025-04-08 14:32:19.973 [info] cker: Successfully connected to stdio server 2025-04-08 14:32:19.973 [info] cker: Storing stdio client 2025-04-08 14:32:19.973 [info] cker: Successfully reloaded client 2025-04-08 14:32:19.974 [info] cker: Handling ListOfferings action 2025-04-08 14:32:19.974 [info] cker: Listing offerings 2025-04-08 14:32:19.974 [info] cker: getOrCreateClient for stdio server.  process.platform: win32 isElectron: true 2025-04-08 14:32:19.975 [info] cker: Reusing existing stdio client 2025-04-08 14:32:19.975 [info] cker: Connected to stdio server, fetchin
  > Fix encrypt conversion in https://github.com/bytebase/dbhub/commit/b2984d312193a8a03692e318880c317eeaa90fc3

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

### Incident Patch 1: `4ddb26e7` (2026-10-02)
**Commit Message**: fix(sqlserver): support verify-full TLS mode (#443)

* fix(sqlserver): support verify-full TLS mode

Enable certificate and hostname verification when sslmode=verify-full is explicit. Accept the mode in TOML, document Node trust configuration, and add focused parser and configuration tests. Preserve existing defaults and parsing behavior.

* fix(sqlserver): reject invalid and duplicate sslmode values

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -176,7 +176,7 @@ outside TOML and follow the same order:
   - SQL Server (NTLM): `sqlserver://user:password@localhost:1433/dbname?authentication=ntlm&domain=MYDOMAIN`
   - Oracle: `oracle://user:password@localhost:1521/FREEPDB1` (path is the service name; `?sid=ORCL` for a SID; `sslmode=require`/`verify-full` switch to TCPS)
   - SQLite: `sqlite:///path/to/database.db` or `sqlite:///:memory:`
-- SSL modes: `sslmode=disable` (no SSL), `sslmode=require` (SSL without cert verification), `sslmode=verify-ca` (PostgreSQL only, CA verification), `sslmode=verify-full` (PostgreSQL and Oracle, CA + hostname verification). Use `sslrootcert` to specify CA certificate path for verify modes. PostgreSQL client certificate auth: `sslcert` + `sslkey` (PEM, unencrypted, both required; `sslmode` must be `require`, `verify-ca` or `verify-full` — `disable` or unset is rejected) in the DSN or TOML source.
+- SSL modes: `sslmode=disable` (no SSL), `sslmode=require` (SSL without cert verification), `sslmode=verify-ca` (PostgreSQL only, CA verification), `sslmode=verify-full` (PostgreSQL, SQL Server and Oracle, CA + hostname verification). On PostgreSQL, use `sslrootcert` to specify CA certificate path for verify modes. PostgreSQL client certificate auth: `sslcert` + `sslkey` (PEM, unencrypted, both required; `sslmode` must be `require`, `verify-ca` or `verify-full` — `disable` or unset is rejected) in the DSN or TOML source.
 
 ## Testing Approach
 
```

**File**: `dbhub.toml.example` (modified, +5/-3)
```diff
@@ -190,7 +190,7 @@ dsn = "postgres://postgres:postgres@localhost:5432/myapp"
 # user = "sa"
 # password = "YourStrong@Passw0rd"
 # instanceName = "SQLEXPRESS"  # Optional: for named instances
-# sslmode = "disable"          # Optional: "disable" or "require"
+# sslmode = "disable"          # Optional: "disable", "require" or "verify-full"
 
 # SQL Server with Windows/NTLM authentication (DSN format)
 # [[sources]]
@@ -423,10 +423,12 @@ dsn = "postgres://postgres:postgres@localhost:5432/myapp"
 #   sslmode = "disable"      # No SSL
 #   sslmode = "require"      # SSL without certificate verification
 #   sslmode = "verify-ca"    # SSL with CA certificate verification (PostgreSQL only)
-#   sslmode = "verify-full"  # SSL with CA + hostname verification (PostgreSQL only)
-#   sslrootcert = "~/.ssl/ca.pem"  # CA certificate path (requires verify-ca or verify-full)
+#   sslmode = "verify-full"  # SSL with CA + hostname verification (PostgreSQL, SQL Server, Oracle)
+#   sslrootcert = "~/.ssl/ca.pem"  # CA certificate path (PostgreSQL only; requires verify-ca or verify-full)
 #   sslcert = "~/.ssl/client.crt"  # PEM client certificate (PostgreSQL only; set with sslkey, needs sslmode require/verify-*)
 #   sslkey = "~/.ssl/client.key"   # Unencrypted PEM private key for sslcert (PostgreSQL only)
+#   SQL Server verify-full uses Node's trust roots; set NODE_EXTRA_CA_CERTS
+#   to a PEM CA bundle before process startup if an additional CA is needed.
 #
 # SQL Server Authentication:
 #   authentication = "ntlm"                              # Windows/NTLM auth (requires domain)
```

**File**: `docs/config/command-line.mdx` (modified, +3/-3)
```diff
@@ -268,14 +268,14 @@ This page covers command-line flags and environment variables. For TOML configur
   | PostgreSQL |     ✅    |     ✅    |      ✅     |      ✅      | Certificate verification |
   | MySQL      |     ✅    |     ✅    |      ❌     |      ❌      | Certificate verification |
   | MariaDB    |     ✅    |     ✅    |      ❌     |      ❌      | Certificate verification |
-  | SQL Server |     ✅    |     ✅    |      ❌     |      ❌      | Certificate verification |
+  | SQL Server |     ✅    |     ✅    |      ❌     |      ✅      | Certificate verification |
   | Oracle     |     ✅    |     ✅    |      ❌     |      ✅      | Plain TCP (`tcps://` only with `require`/`verify-full`) |
   | SQLite     |     ❌    |     ❌    |      ❌     |      ❌      | N/A (file-based) |
 
   - `sslmode=disable`: All SSL/TLS encryption is turned off. Data is transmitted in plaintext.
   - `sslmode=require`: Connection is encrypted, but the server's certificate is not verified.
   - `sslmode=verify-ca`: SSL with CA certificate verification, but no hostname check. **PostgreSQL only.** Use `sslrootcert` to specify the CA certificate path.
-  - `sslmode=verify-full`: SSL with CA certificate and hostname verification. **PostgreSQL and Oracle.** On PostgreSQL use `sslrootcert` to specify the CA certificate path; on Oracle the server certificate is validated against the system trust store.
+  - `sslmode=verify-full`: SSL with CA certificate and hostname verification. **PostgreSQL, SQL Server, and Oracle.** On PostgreSQL use `sslrootcert` to specify the CA certificate path. SQL Server uses Node's configured trust roots; set `NODE_EXTRA_CA_CERTS` to a PEM CA bundle before process startup if an additional CA is needed. Oracle uses the system trust store.
 
   <Note>
   Unlike libpq, DBHub does not upgrade `sslmode=require` to `verify-ca` when `sslrootcert` is present: that combination is rejected at startup, so set `sslmode=verify-ca` explicitly. libpq's `allow` and `prefer` modes are not supported for PostgreSQL either; use `require` (or a verify mode) instead.
@@ -437,4 +437,4 @@ npx @bytebase/dbhub@latest --dsn "..." \
 | `--ssh-password` | `SSH_PASSWORD` | string | SSH password |
 | `--ssh-key` | `SSH_KEY` | string | Path to SSH private key or base64-encoded key |
 | `--ssh-passphrase` | `SSH_PASSPHRASE` | string | SSH key passphrase |
-| `--ssh-proxy-jump` | `SSH_PROXY_JUMP` | string | ProxyJump hosts |
\ No newline at end of file
+| `--ssh-proxy-jump` | `SSH_PROXY_JUMP` | string | ProxyJump hosts |
```

**File**: `docs/config/toml.mdx` (modified, +4/-2)
```diff
@@ -363,9 +363,11 @@ Sources define database connections. Each source represents a database that DBHu
   - `disable` - No SSL/TLS encryption. Data is transmitted in plaintext.
   - `require` - SSL/TLS encryption enabled, but server certificate is not verified.
   - `verify-ca` - SSL with CA certificate verification (no hostname check). **PostgreSQL only.**
-  - `verify-full` - SSL with CA certificate and hostname verification. **PostgreSQL and Oracle.**
+  - `verify-full` - SSL with CA certificate and hostname verification. **PostgreSQL, SQL Server, and Oracle.**
 
-  Supported databases: PostgreSQL, MySQL, MariaDB, SQL Server, Oracle (not applicable to SQLite). `verify-ca` is PostgreSQL only; `verify-full` is supported on PostgreSQL and Oracle (Oracle validates the server certificate against the system trust store, and `sslrootcert` is PostgreSQL only).
+  Supported databases: PostgreSQL, MySQL, MariaDB, SQL Server, Oracle (not applicable to SQLite). `verify-ca` is PostgreSQL only; `verify-full` is supported on PostgreSQL, SQL Server and Oracle (Oracle validates the server certificate against the system trust store, and `sslrootcert` is PostgreSQL only).
+
+  SQL Server `verify-full` uses Node's trust roots. Set `NODE_EXTRA_CA_CERTS` to a PEM CA bundle before process startup if an additional CA is needed.
 
   ```toml
   # Basic SSL (all network databases)
```

**File**: `src/config/__tests__/toml-loader.test.ts` (modified, +75/-0)
```diff
@@ -2,6 +2,7 @@ import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
 import { loadTomlConfig, buildDSNFromSource, interpolateEnvVars } from '../toml-loader.js';
 import type { SourceConfig } from '../../types/config.js';
 import { SQLiteConnector } from '../../connectors/sqlite/index.js';
+import { SQLServerConnector } from '../../connectors/sqlserver/index.js';
 import fs from 'fs';
 import path from 'path';
 import os from 'os';
@@ -525,6 +526,80 @@ dsn = "postgres://user:pass@localhost:5432/testdb"
     });
 
     describe('sslmode validation', () => {
+      it('should preserve a matching encoded SQL Server sslmode', async () => {
+        const dsn = 'sqlserver://user:pass@localhost:1433/db?%73slmode=verify%2Dfull';
+        fs.writeFileSync(path.join(tempDir, 'dbhub.toml'), `
+[[sources]]
+id = "test_db"
+dsn = "${dsn}"
+sslmode = "verify-full"
+`);
+
+        const result = loadTomlConfig();
+        const builtDSN = buildDSNFromSource(result!.sources[0]);
+        expect(builtDSN).toBe(dsn);
+        const config = await new SQLServerConnector().dsnParser.parse(builtDSN);
+        expect(config.options?.encrypt).toBe(true);
+        expect(config.options?.trustServerCertificate).toBe(false);
+      });
+
+      it('should reject a conflicting encoded SQL Server sslmode without reflecting the input', () => {
+        fs.writeFileSync(path.join(tempDir, 'dbhub.toml'), `
+[[sources]]
+id = "test_db"
+dsn = "sqlserver://user:pass@localhost:1433/db?%73slmode=disable"
+sslmode = "verify-full"
+`);
+
+        expect(() => loadTomlConfig()).toThrow(new Error(
+          `Failed to load TOML configuration from ${path.join(tempDir, 'dbhub.toml')}: ` +
+          'Conflicting SQL Server sslmode. Set sslmode in only one place, or make the two values match.'
+        ));
+      });
+
+      it.each(['disable', 'verify-full', ''])(
+        'should reject duplicate SQL Server modes after TOML processing (%j)',
+        async (trailingMode) => {
+          const dsn = `sqlserver://user:pass@localhost:1433/db?sslmode=verify-full&sslmode=${trailingMode}`;
+          fs.writeFileSync(path.join(tempDir, 'dbhub.toml'), `
+[[sources]]
+id = "test_db"
+dsn = "${dsn}"
+sslmode = "verify-full"
+`);
+
+          const result = loadTomlConfig();
+          const builtDSN = buildDSNFromSource(result!.sources[0]);
+          expect(result?.sources[0].sslmode).toBe('verify-full');
+          expect(builtDSN).toBe(dsn);
+          await expect(new SQLServerConnector().dsnParser.parse(builtDSN)).rejects.toMatchObject({
+            message: 'Failed to parse SQL Server DSN: Invalid sslmode. Specify exactly one value: disable, require, verify-full',
+          });
+        }
+      );
+
+      it('should accept and propagate sslmode=verify-full for SQL Server', () => {
+        const tomlContent = `
+[[sources]]
+id = "test_db"
+type = "sqlserver"
+host = "localhost"
+database = "db"
+user = "user"
+password = "pass"
+sslmode = "verify-full"
+`;
+        fs.writeFileSync(path.join(tempDir, 'dbhub.toml'), tomlContent);
+
+        const result = loadTomlConfig();
+
+        expect(result).toBeTruthy();
+        expect(result?.sources[0].sslmode).toBe('verify-full');
+        expect(buildDSNFromSource(result!.sources[0])).toBe(
+          'sqlserver://user:pass@localhost:1433/db?sslmode=verify-full'
+        );
+      });
+
       it.each(['disable', 'require', 'verify-ca', 'verify-full'])(
         'should accept sslmode = %j for PostgreSQL',
         (sslmode) => {
```

**File**: `src/config/toml-loader.ts` (modified, +10/-2)
```diff
@@ -239,6 +239,10 @@ function getRawDSNQueryParam(dsn: string, key: string): string | null {
   if (queryStart === -1) {
     return null;
   }
+  // Match SQL Server's decoded sslmode keys so merging cannot invent a duplicate.
+  if (key === "sslmode" && dsn.startsWith("sqlserver://")) {
+    return new URLSearchParams(dsn.substring(queryStart + 1)).get(key);
+  }
   for (const pair of dsn.substring(queryStart + 1).split("&")) {
     if (pair === "") {
       continue;
@@ -386,6 +390,9 @@ function validateDSNFieldConflicts(source: SourceConfig, configPath: string): vo
   // still treated as present and a conflicting field is rejected.
   const dsnSslmode = getRawDSNQueryParam(source.dsn!, "sslmode");
   if (source.sslmode && dsnSslmode !== null && dsnSslmode !== source.sslmode) {
+    if (source.type === "sqlserver") {
+      throw new Error("Conflicting SQL Server sslmode. Set sslmode in only one place, or make the two values match.");
+    }
     conflict("sslmode", source.sslmode, dsnSslmode);
   }
 
@@ -577,10 +584,11 @@ function validateSourceConfig(source: SourceConfig, configPath: string): void {
       );
     }
 
-    // verify-ca is PostgreSQL-only; Oracle's TCPS also offers verify-full
-    // (server certificate DN matched against the host).
+    // verify-ca is PostgreSQL-only; SQL Server and Oracle also support
+    // verify-full for server certificate and hostname verification.
     const verifyModesByType: Record<string, string[]> = {
       postgres: ["verify-ca", "verify-full"],
+      sqlserver: ["verify-full"],
       oracle: ["verify-full"],
     };
     if (
```

**File**: `src/connectors/__tests__/dsn-parser.test.ts` (modified, +63/-0)
```diff
@@ -384,6 +384,69 @@ describe('DSN Parser - SQL Server SSL/TLS Configuration', () => {
     expect(config.options?.encrypt).toBe(false);
     expect(config.options?.trustServerCertificate).toBe(false);
   });
+
+  it('should parse sslmode=verify-full correctly', async () => {
+    const parser = new SQLServerConnector().dsnParser;
+    const config = await parser.parse('sqlserver://user:pass@localhost:1433/db?sslmode=verify-full');
+
+    expect(config.options?.encrypt).toBe(true);
+    expect(config.options?.trustServerCertificate).toBe(false);
+  });
+
+  it.each([
+    'sslmode=verify_ful',
+    'sslmode=verify-ca',
+    'sslmode=%20',
+    'sslmode',
+    'sslmode=',
+    'sslmode=verify-full=extra',
+    'sslmode=verify%3Dfull',
+    'sslmode=%',
+    'sslmode=%C3%28',
+    '%73slmode=',
+    '%73slmode=verify_ful',
+    'sslmode=verify-full&sslmode=verify-full',
+    'sslmode=verify-full&sslmode=disable',
+    'sslmode=verify_ful&sslmode=disable',
+    'sslmode=verify-full&sslmode=',
+    'sslmode=&sslmode=verify-full',
+    'sslmode=verify-full&%73slmode=disable',
+    '%73slmode=verify%2Dfull&sslmode=disable',
+  ])('should reject invalid sslmode query %s with a fixed error', async (query) => {
+    const parser = new SQLServerConnector().dsnParser;
+
+    await expect(
+      parser.parse(`sqlserver://user:pass@localhost:1433/db?${query}`)
+    ).rejects.toMatchObject({
+      message: 'Failed to parse SQL Server DSN: Invalid sslmode. Specify exactly one value: disable, require, verify-full',
+    });
+  });
+
+  it.each([
+    ['p@ss#word:&=+', 'p@ss#word:&=+'],
+    ['p%3Fsslmode%3Ddisable%26sslmode%3Dverify_ful', 'p?sslmode=disable&sslmode=verify_ful'],
+  ])('should preserve password %s with an encoded sslmode', async (password, decodedPassword) => {
+    const parser = new SQLServerConnector().dsnParser;
+    const config = await parser.parse(
+      `sqlserver://user%40domain:${password}@localhost:1433/db?%73slmode=verify%2Dfull&instanceName=ENV1`,
+      { connectionTimeoutSeconds: 15, queryTimeoutSeconds: 30 }
+    );
+
+    expect(config).toMatchObject({
+      user: 'user@domain',
+      password: decodedPassword,
+      server: 'localhost',
+      port: 1433,
+      database: 'db',
+      options: {
+        encrypt: true,
+        trustServerCertificate: false,
+        instanceName: 'ENV1',
+        connectTimeout: 15000,
+        requestTimeout: 30000,
+      },
+    });
+  });
 });
 
 describe('DSN Parser - SQL Server NTLM Authentication', () => {
```

**File**: `src/connectors/sqlserver/index.ts` (modified, +12/-3)
```diff
@@ -46,18 +46,24 @@ export class SQLServerDSNParser implements DSNParser {
     }
 
     try {
+      // Inspect the same raw query as SafeURL before it drops empty/malformed
+      // pairs or collapses duplicates. Decode query keys as well as values.
+      const queryStart = dsn.indexOf("?");
+      const sslmodes = new URLSearchParams(queryStart === -1 ? "" : dsn.substring(queryStart + 1)).getAll("sslmode");
+      if (sslmodes.length > 1 || (sslmodes.length === 1 && !["disable", "require", "verify-full"].includes(sslmodes[0]))) {
+        throw new Error("Invalid sslmode. Specify exactly one value: disable, require, verify-full");
+      }
+
       // Use the SafeURL helper to parse DSNs with special characters
       const url = new SafeURL(dsn);
       
       // Parse additional options from query parameters
-      const options: Record<string, any> = {};
+      const options: Record<string, any> = { sslmode: sslmodes[0] };
       
       // Process query parameters
       url.forEachSearchParam((value, key) => {
         if (key === "authentication") {
           options.authentication = value;
-        } else if (key === "sslmode") {
-          options.sslmode = value;
         } else if (key === "instanceName") {
           options.instanceName = value;
         } else if (key === "domain") {
@@ -81,6 +87,9 @@ export class SQLServerDSNParser implements DSNParser {
         } else if (options.sslmode === "require") {
           options.encrypt = true;
           options.trustServerCertificate = true;
+        } else if (options.sslmode === "verify-full") {
+          options.encrypt = true;
+          options.trustServerCertificate = false;
         }
         // Default behavior (certificate verification) is handled by the default values below
       }
```

---

### Incident Patch 2: `4f31da05` (2026-10-02)
**Commit Message**: fix(config): reject empty TOML sslmode before DSN fallback (#451)

**File**: `src/config/__tests__/toml-loader.test.ts` (modified, +17/-0)
```diff
@@ -29,6 +29,7 @@ describe('TOML Configuration Tests', () => {
       // Ignore cleanup errors
     }
     process.argv = originalArgv;
+    vi.unstubAllEnvs();
   });
 
   describe('loadTomlConfig', () => {
@@ -562,6 +563,22 @@ sslmode = "invalid"
         expect(() => loadTomlConfig()).toThrow("invalid sslmode 'invalid'");
       });
 
+      it.each([
+        ['literal', '', 'disable'],
+        ['environment', '${TEST_SSLMODE}', 'require'],
+      ])('should reject an empty %s sslmode before DSN fallback', (_name, sslmode, dsnSslmode) => {
+        vi.stubEnv('TEST_SSLMODE', '');
+        const tomlContent = `
+[[sources]]
+id = "test_db"
+dsn = "postgres://fakeuser:fakepass@localhost:5432/testdb?sslmode=${dsnSslmode}"
+sslmode = "${sslmode}"
+`;
+        fs.writeFileSync(path.join(tempDir, 'dbhub.toml'), tomlContent);
+
+        expect(() => loadTomlConfig()).toThrow("invalid sslmode ''");
+      });
+
       it('should throw error when DSN sslmode conflicts with sslmode field', () => {
         const tomlContent = `
 [[sources]]
```

**File**: `src/config/toml-loader.ts` (modified, +1/-1)
```diff
@@ -899,7 +899,7 @@ function processSourceConfigs(
       try {
         const url = new SafeURL(processed.dsn);
         const dsnSslmode = url.getSearchParam("sslmode");
-        if (!processed.sslmode && dsnSslmode) {
+        if (processed.sslmode === undefined && dsnSslmode) {
           processed.sslmode = dsnSslmode as SourceConfig["sslmode"];
         }
         for (const field of ["sslrootcert", "sslcert", "sslkey"] as const) {
```

---

### Incident Patch 3: `ca14e7a8` (2026-09-21)
**Commit Message**: fix: reload AWS credentials from disk on every RDS IAM token refresh (#438)

The AWS SDK caches the contents of ~/.aws/credentials and ~/.aws/config
in a module-level map for the lifetime of the process. DBHub regenerates
the RDS IAM auth token every ~14 minutes with a fresh fromIni() call, but
that call hits the cache, so credentials rotated externally (e.g. refreshed
STS credentials written by a sidecar) were never picked up and auth
eventually failed with "PAM authentication failed" until restart.

Pass ignoreCache: true to fromIni() and, when no aws_profile is set, to an
explicit fromNodeProviderChain() so the default chain's ini step also
re-reads the files.

Fixes #437


Claude-Session: https://claude.ai/code/session_01FyVzpWXWC2fW5FK3PjtNXJ

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/utils/__tests__/aws-rds-signer.test.ts` (modified, +12/-1)
```diff
@@ -7,6 +7,7 @@ const signerMocks = vi.hoisted(() => ({
 }));
 const credentialProviderMocks = vi.hoisted(() => ({
   fromIni: vi.fn(),
+  fromNodeProviderChain: vi.fn(),
 }));
 
 vi.mock('@aws-sdk/rds-signer', () => {
@@ -25,6 +26,7 @@ vi.mock('@aws-sdk/rds-signer', () => {
 
 vi.mock('@aws-sdk/credential-providers', () => ({
   fromIni: credentialProviderMocks.fromIni,
+  fromNodeProviderChain: credentialProviderMocks.fromNodeProviderChain,
 }));
 
 describe('generateRdsAuthToken', () => {
@@ -47,7 +49,9 @@ describe('generateRdsAuthToken', () => {
 
     expect(credentialProviderMocks.fromIni).toHaveBeenCalledWith({
       profile: 'ngqa',
+      ignoreCache: true,
     });
+    expect(credentialProviderMocks.fromNodeProviderChain).not.toHaveBeenCalled();
     expect(signerMocks.constructor).toHaveBeenCalledWith({
       hostname: 'mydb.abc123.us-east-1.rds.amazonaws.com',
       port: 5432,
@@ -57,7 +61,9 @@ describe('generateRdsAuthToken', () => {
     });
   });
 
-  it('should create signer with expected params and return token', async () => {
+  it('should use the default provider chain with the file cache disabled when no profile is set', async () => {
+    const chainCredentials = vi.fn();
+    credentialProviderMocks.fromNodeProviderChain.mockReturnValue(chainCredentials);
     signerMocks.getAuthToken.mockResolvedValue('iam-token');
 
     const token = await generateRdsAuthToken({
@@ -67,11 +73,16 @@ describe('generateRdsAuthToken', () => {
       region: 'eu-west-1',
     });
 
+    expect(credentialProviderMocks.fromNodeProviderChain).toHaveBeenCalledWith({
+      ignoreCache: true,
+    });
+    expect(credentialProviderMocks.fromIni).not.toHaveBeenCalled();
     expect(signerMocks.constructor).toHaveBeenCalledWith({
       hostname: 'mydb.abc123.eu-west-1.rds.amazonaws.com',
       port: 3306,
       username: 'dbuser@example.com',
       region: 'eu-west-1',
+      credentials: chainCredentials,
     });
     expect(signerMocks.getAuthToken).toHaveBeenCalledTimes(1);
     expect(token).toBe('iam-token');
```

**File**: `src/utils/aws-rds-signer.ts` (modified, +12/-5)
```diff
@@ -11,7 +11,14 @@ export interface RdsAuthTokenParams {
 /**
  * Generate an AWS RDS IAM auth token for database authentication.
  * Uses the named shared-config profile when provided; otherwise the AWS SDK
- * uses its default credential provider chain.
+ * default credential provider chain.
+ *
+ * Both providers are created with `ignoreCache: true`. The SDK caches the
+ * contents of `~/.aws/credentials` and `~/.aws/config` in a module-level map
+ * for the lifetime of the process, so a long-running DBHub would otherwise keep
+ * signing with the credentials it read at startup and never notice that the
+ * files were rotated externally (e.g. refreshed STS credentials). Tokens are
+ * regenerated every ~14 minutes, so the extra file read is negligible.
  */
 export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<string> {
   let Signer: typeof import("@aws-sdk/rds-signer")["Signer"];
@@ -33,10 +40,10 @@ export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<
     region: params.region,
   };
 
-  if (params.profile) {
-    const { fromIni } = await import("@aws-sdk/credential-providers");
-    signerConfig.credentials = fromIni({ profile: params.profile });
-  }
+  const { fromIni, fromNodeProviderChain } = await import("@aws-sdk/credential-providers");
+  signerConfig.credentials = params.profile
+    ? fromIni({ profile: params.profile, ignoreCache: true })
+    : fromNodeProviderChain({ ignoreCache: true });
 
   const signer = new Signer(signerConfig);
 
```

---

### Incident Patch 4: `9a0fe437` (2026-09-21)
**Commit Message**: fix: reload AWS credentials from disk on every RDS IAM token refresh

The AWS SDK caches the contents of ~/.aws/credentials and ~/.aws/config
in a module-level map for the lifetime of the process. DBHub regenerates
the RDS IAM auth token every ~14 minutes with a fresh fromIni() call, but
that call hits the cache, so credentials rotated externally (e.g. refreshed
STS credentials written by a sidecar) were never picked up and auth
eventually failed with "PAM authentication failed" until restart.

Pass ignoreCache: true to fromIni() and, when no aws_profile is set, to an
explicit fromNodeProviderChain() so the default chain's ini step also
re-reads the files.

Fixes #437

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01FyVzpWXWC2fW5FK3PjtNXJ

**File**: `src/utils/__tests__/aws-rds-signer.test.ts` (modified, +12/-1)
```diff
@@ -7,6 +7,7 @@ const signerMocks = vi.hoisted(() => ({
 }));
 const credentialProviderMocks = vi.hoisted(() => ({
   fromIni: vi.fn(),
+  fromNodeProviderChain: vi.fn(),
 }));
 
 vi.mock('@aws-sdk/rds-signer', () => {
@@ -25,6 +26,7 @@ vi.mock('@aws-sdk/rds-signer', () => {
 
 vi.mock('@aws-sdk/credential-providers', () => ({
   fromIni: credentialProviderMocks.fromIni,
+  fromNodeProviderChain: credentialProviderMocks.fromNodeProviderChain,
 }));
 
 describe('generateRdsAuthToken', () => {
@@ -47,7 +49,9 @@ describe('generateRdsAuthToken', () => {
 
     expect(credentialProviderMocks.fromIni).toHaveBeenCalledWith({
       profile: 'ngqa',
+      ignoreCache: true,
     });
+    expect(credentialProviderMocks.fromNodeProviderChain).not.toHaveBeenCalled();
     expect(signerMocks.constructor).toHaveBeenCalledWith({
       hostname: 'mydb.abc123.us-east-1.rds.amazonaws.com',
       port: 5432,
@@ -57,7 +61,9 @@ describe('generateRdsAuthToken', () => {
     });
   });
 
-  it('should create signer with expected params and return token', async () => {
+  it('should use the default provider chain with the file cache disabled when no profile is set', async () => {
+    const chainCredentials = vi.fn();
+    credentialProviderMocks.fromNodeProviderChain.mockReturnValue(chainCredentials);
     signerMocks.getAuthToken.mockResolvedValue('iam-token');
 
     const token = await generateRdsAuthToken({
@@ -67,11 +73,16 @@ describe('generateRdsAuthToken', () => {
       region: 'eu-west-1',
     });
 
+    expect(credentialProviderMocks.fromNodeProviderChain).toHaveBeenCalledWith({
+      ignoreCache: true,
+    });
+    expect(credentialProviderMocks.fromIni).not.toHaveBeenCalled();
     expect(signerMocks.constructor).toHaveBeenCalledWith({
       hostname: 'mydb.abc123.eu-west-1.rds.amazonaws.com',
       port: 3306,
       username: 'dbuser@example.com',
       region: 'eu-west-1',
+      credentials: chainCredentials,
     });
     expect(signerMocks.getAuthToken).toHaveBeenCalledTimes(1);
     expect(token).toBe('iam-token');
```

**File**: `src/utils/aws-rds-signer.ts` (modified, +12/-5)
```diff
@@ -11,7 +11,14 @@ export interface RdsAuthTokenParams {
 /**
  * Generate an AWS RDS IAM auth token for database authentication.
  * Uses the named shared-config profile when provided; otherwise the AWS SDK
- * uses its default credential provider chain.
+ * default credential provider chain.
+ *
+ * Both providers are created with `ignoreCache: true`. The SDK caches the
+ * contents of `~/.aws/credentials` and `~/.aws/config` in a module-level map
+ * for the lifetime of the process, so a long-running DBHub would otherwise keep
+ * signing with the credentials it read at startup and never notice that the
+ * files were rotated externally (e.g. refreshed STS credentials). Tokens are
+ * regenerated every ~14 minutes, so the extra file read is negligible.
  */
 export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<string> {
   let Signer: typeof import("@aws-sdk/rds-signer")["Signer"];
@@ -33,10 +40,10 @@ export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<
     region: params.region,
   };
 
-  if (params.profile) {
-    const { fromIni } = await import("@aws-sdk/credential-providers");
-    signerConfig.credentials = fromIni({ profile: params.profile });
-  }
+  const { fromIni, fromNodeProviderChain } = await import("@aws-sdk/credential-providers");
+  signerConfig.credentials = params.profile
+    ? fromIni({ profile: params.profile, ignoreCache: true })
+    : fromNodeProviderChain({ ignoreCache: true });
 
   const signer = new Signer(signerConfig);
 
```

---

### Incident Patch 5: `8cbf8798` (2026-09-19)
**Commit Message**: fix: keep server.json description within the MCP Registry's 100-char limit

Adding Oracle pushed the description to 103 characters and the
registry rejected the 1.3.0 publish (HTTP 422, "expected length <=
100"); npm had already published. Shorten to 94 characters in
server.json and package.json, and add a consistency test so the limit
is checked in CI rather than discovered post-merge by the release job.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_0189BHv585xi8iqEp9JvmgKY

**File**: `package.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "name": "dbhub",
   "version": "1.3.0",
   "mcpName": "io.github.bytebase/dbhub",
-  "description": "Minimal, token-efficient Database MCP Server for PostgreSQL, MySQL, SQL Server, Oracle, SQLite, MariaDB",
+  "description": "Token-efficient database MCP server for PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, SQLite",
   "repository": {
     "type": "git",
     "url": "https://github.com/bytebase/dbhub.git"
```

**File**: `server.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
   "name": "io.github.bytebase/dbhub",
   "title": "DBHub",
-  "description": "Minimal, token-efficient Database MCP Server for PostgreSQL, MySQL, SQL Server, Oracle, SQLite, MariaDB",
+  "description": "Token-efficient database MCP server for PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, SQLite",
   "repository": {
     "url": "https://github.com/bytebase/dbhub",
     "source": "github"
```

**File**: `src/__tests__/plugin-consistency.test.ts` (modified, +8/-0)
```diff
@@ -38,6 +38,14 @@ describe("Claude Code plugin consistency", () => {
     expect(mcp.mcpServers.dbhub.args).toContain(`@bytebase/dbhub@${pkg.version}`);
   });
 
+  it("server.json description fits the MCP Registry's 100-character limit", () => {
+    // The registry rejects the publish (HTTP 422) when the description is
+    // longer than 100 characters, which is only discovered post-merge when
+    // the release workflow runs.
+    const server = readJson("server.json");
+    expect(server.description.length).toBeLessThanOrEqual(100);
+  });
+
   it("server.json version matches package.json", () => {
     const server = readJson("server.json");
     expect(server.version).toBe(pkg.version);
```

---

### Incident Patch 6: `54255bd8` (2026-09-19)
**Commit Message**: fix: never echo a raw DSN in redaction fallbacks or the invalid-DSN error (#431)

* fix: never echo a raw DSN in redaction fallbacks or the invalid-DSN error

resolveSourceConfigs() interpolated the raw DSN into the "Invalid DSN
format" error, so a scheme-less value such as user:secret@host/db printed
its password to stderr at startup. redactDSN() and obfuscateDSNPassword()
also returned the original string whenever parsing failed, leaking the
same way through connector-manager startup logs and the missing-database
error.

obfuscateDSNPassword() now fails closed and returns a constant
"<redacted DSN>" placeholder when the DSN cannot be parsed. redactDSN()
delegates to it instead of using the native URL parser plus a regex
fallback, and the invalid-DSN error goes through redactDSN(). Tests cover
scheme-less input and passwords containing "@" and "#".

Fixes #430

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01NkRzQr9wiSyESV8F8j8ja9

* fix: withhold DSNs whose authority parses a credential into the port

SafeURL only treats the authority as credentials when it contains an
'@'. Without one, "postgres://user:secret/db" parses as hos

**File**: `src/config/__tests__/env.test.ts` (modified, +44/-1)
```diff
@@ -2,7 +2,7 @@ import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
 import fs from 'fs';
 import os from 'os';
 import path from 'path';
-import { buildDSNFromEnvParams, resolveDSN, resolveHost, resolveId } from '../env.js';
+import { buildDSNFromEnvParams, redactDSN, resolveDSN, resolveHost, resolveId } from '../env.js';
 import { loadTomlConfig } from '../toml-loader.js';
 
 // Mock toml-loader to prevent it from loading dbhub.toml during tests
@@ -353,6 +353,49 @@ describe('Environment Configuration Tests', () => {
       expect(result!.sources[0].type).toBe('postgres');
       expect(result!.sources[0].dsn).toBe('postgres://user:my@pass:word@localhost:5432/testdb');
     });
+
+    it('should not leak the password when the DSN is malformed', async () => {
+      // A scheme-less DSN fails SafeURL parsing; the resulting fatal error is
+      // printed to stderr, so the raw value must never be interpolated into it.
+      process.argv = ['node', 'script.js', '--dsn=user:hunter2@localhost/db'];
+
+      const { resolveSourceConfigs } = await import('../env.js');
+      let message = '';
+      try {
+        await resolveSourceConfigs();
+      } catch (error) {
+        message = (error as Error).message;
+      }
+
+      expect(message).toMatch(/Invalid DSN format/);
+      expect(message).toContain('<redacted DSN>');
+      expect(message).not.toContain('hunter2');
+    });
+  });
+
+  describe('redactDSN', () => {
+    it('should replace the password with asterisks', () => {
+      const result = redactDSN('postgres://user:hunter2@localhost:5432/db');
+      expect(result).not.toContain('hunter2');
+      expect(result).toMatch(/^postgres:\/\/user:\*+@localhost:5432\/db$/);
+    });
+
+    it('should redact passwords containing @ or #', () => {
+      for (const password of ['p@ss', 'pa#ss', 'p@s#s@']) {
+        const result = redactDSN(`postgres://user:${password}@localhost:5432/db`);
+        expect(result).not.toContain(password);
+        expect(result).toMatch(/^postgres:\/\/user:\*+@localhost:5432\/db$/);
+      }
+    });
+
+    it('should fail closed on a scheme-less DSN', () => {
+      const result = redactDSN('user:hunter2@localhost/db');
+      expect(result).toBe('<redacted DSN>');
+    });
+
+    it('should leave SQLite DSNs untouched', () => {
+      expect(redactDSN('sqlite:///path/to/db.sqlite')).toBe('sqlite:///path/to/db.sqlite');
+    });
   });
 
   describe('resolveId', () => {
```

**File**: `src/config/env.ts` (modified, +5/-18)
```diff
@@ -7,7 +7,7 @@ import type { SSHTunnelConfig } from "../types/ssh.js";
 import { parseSSHConfig, looksLikeSSHAlias, getDefaultSSHConfigPath } from "../utils/ssh-config-parser.js";
 import type { SourceConfig } from "../types/config.js";
 import { loadTomlConfig } from "./toml-loader.js";
-import { parseConnectionInfoFromDSN } from "../utils/dsn-obfuscate.js";
+import { obfuscateDSNPassword, parseConnectionInfoFromDSN } from "../utils/dsn-obfuscate.js";
 import { SafeURL } from "../utils/safe-url.js";
 
 // Create __dirname equivalent for ES modules
@@ -509,26 +509,13 @@ function splitTokenList(value: string): string[] {
 
 /**
  * Redact sensitive information from a DSN string
- * Replaces the password with asterisks
+ * Replaces the password with asterisks; returns a constant placeholder if the
+ * DSN cannot be parsed, so a malformed DSN never leaks its password.
  * @param dsn - The DSN string to redact
  * @returns The sanitized DSN string
  */
 export function redactDSN(dsn: string): string {
-  try {
-    // Create a URL object to parse the DSN
-    const url = new URL(dsn);
-
-    // Replace the password with asterisks
-    if (url.password) {
-      url.password = "*******";
-    }
-
-    // Return the sanitized DSN
-    return url.toString();
-  } catch (error) {
-    // If parsing fails, do basic redaction with regex
-    return dsn.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
-  }
+  return obfuscateDSNPassword(dsn);
 }
 
 /**
@@ -763,7 +750,7 @@ export async function resolveSourceConfigs(): Promise<{ sources: SourceConfig[];
       dsnUrl = new SafeURL(dsnResult.dsn);
     } catch (error) {
       throw new Error(
-        `Invalid DSN format: ${dsnResult.dsn}. Expected format: protocol://[user[:password]@]host[:port]/database`
+        `Invalid DSN format: ${redactDSN(dsnResult.dsn)}. Expected format: protocol://[user[:password]@]host[:port]/database`
       );
     }
 
```

**File**: `src/utils/__tests__/dsn-obfuscate.test.ts` (modified, +39/-0)
```diff
@@ -1,6 +1,7 @@
 import { describe, it, expect } from 'vitest';
 import {
   obfuscateDSNPassword,
+  REDACTED_DSN,
   obfuscateSSHConfig,
   getDatabaseTypeFromDSN,
   parseConnectionInfoFromDSN,
@@ -78,6 +79,44 @@ describe('DSN Obfuscation Utilities', () => {
       expect(result).toBe('postgres://user:*****@localhost:5432/db');
       expect(result).not.toContain('ss@');
     });
+
+    it('should obfuscate the whole password when it contains a #', () => {
+      const dsn = 'postgres://user:pa#ss@localhost:5432/db';
+      const result = obfuscateDSNPassword(dsn);
+
+      expect(result).toBe('postgres://user:*****@localhost:5432/db');
+      expect(result).not.toContain('pa#ss');
+    });
+
+    it('should fail closed on a scheme-less DSN instead of echoing it', () => {
+      // SafeURL rejects input without "://", so nothing can be parsed out of
+      // it — but it may still carry a password, so the original must not
+      // be returned.
+      const dsn = 'user:hunter2@localhost/db';
+      const result = obfuscateDSNPassword(dsn);
+
+      expect(result).toBe(REDACTED_DSN);
+      expect(result).not.toContain('hunter2');
+    });
+
+    it('should fail closed when the authority has no @ and a credential lands in the port', () => {
+      // "user:secret" without a host parses as host "user", port "secret",
+      // so there is no password field to mask — the whole string must be
+      // withheld instead.
+      for (const dsn of ['postgres://user:secret/db', 'postgres://user:secret?sslmode=require']) {
+        const result = obfuscateDSNPassword(dsn);
+
+        expect(result).toBe(REDACTED_DSN);
+        expect(result).not.toContain('secret');
+      }
+    });
+
+    it('should still obfuscate a DSN with an unknown scheme', () => {
+      const dsn = 'oracle://user:hunter2@localhost:1521/db';
+      const result = obfuscateDSNPassword(dsn);
+
+      expect(result).toBe('oracle://user:*******@localhost:1521/db');
+    });
   });
 
   describe('obfuscateSSHConfig', () => {
```

**File**: `src/utils/dsn-obfuscate.ts` (modified, +20/-3)
```diff
@@ -84,7 +84,16 @@ export function parseConnectionInfoFromDSN(dsn: string): ParsedConnectionInfo |
 }
 
 /**
- * Obfuscates the password in a DSN string for logging purposes
+ * Placeholder returned in place of a DSN that could not be parsed.
+ * Unparseable input (e.g. a scheme-less "user:pass@host/db") may still carry a
+ * password, so the original string is never echoed back.
+ */
+export const REDACTED_DSN = '<redacted DSN>';
+
+/**
+ * Obfuscates the password in a DSN string for logging purposes.
+ * Fails closed: if the DSN cannot be parsed, returns REDACTED_DSN rather than
+ * the original string.
  * @param dsn The original DSN string
  * @returns DSN string with password replaced by asterisks
  */
@@ -104,6 +113,14 @@ export function obfuscateDSNPassword(dsn: string): string {
     // Parse DSN using SafeURL
     const url = new SafeURL(dsn);
 
+    // A DSN whose authority lacks an '@' (e.g. "postgres://user:secret/db")
+    // parses with "user" as the host and "secret" as the port. A real port is
+    // always numeric, so treat anything else as unparseable rather than
+    // echoing what is likely a credential.
+    if (url.port && !/^\d+$/.test(url.port)) {
+      return REDACTED_DSN;
+    }
+
     // No password to obfuscate
     if (!url.password) {
       return dsn;
@@ -135,8 +152,8 @@ export function obfuscateDSNPassword(dsn: string): string {
 
     return result;
   } catch {
-    // If parsing fails, return original DSN
-    return dsn;
+    // Fail closed: an unparseable DSN may still contain a password
+    return REDACTED_DSN;
   }
 }
 
```

---

### Incident Patch 7: `80b87cb7` (2026-09-18)
**Commit Message**: docs: fix Docker Compose example Postgres user and bump image to 18

The Compose snippet's DSN logs in as role `user`, but the database
service never set POSTGRES_USER, so the official image created
`postgres` instead and the connection failed with "role user does not
exist". Set POSTGRES_USER to match the DSN, add ?sslmode=disable to
align with the docker run examples on the same page, and bump the image
to postgres:18-alpine (no volume is mounted, so the PG18 data path
change does not apply).

Fixes #428

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_014B59SV2cafS1ptCTyBxGey

**File**: `docs/installation.mdx` (modified, +3/-2)
```diff
@@ -118,13 +118,14 @@ The [Claude Code Plugin](/claude-code-plugin) registers the DBHub MCP server in
           - --port
           - "8080"
           - --dsn
-          - "postgres://user:password@database:5432/dbname"
+          - "postgres://user:password@database:5432/dbname?sslmode=disable"
         depends_on:
           - database
 
       database:
-        image: postgres:15-alpine
+        image: postgres:18-alpine
         environment:
+          POSTGRES_USER: user
           POSTGRES_PASSWORD: password
           POSTGRES_DB: dbname
     ```
```

---

### Incident Patch 8: `2a0f0657` (2026-09-18)
**Commit Message**: fix: apply max_rows to comment-prefixed and CTE queries (#429)

* fix: apply max_rows to comment-prefixed and CTE queries

isSelectQuery classified on the raw text, so any statement not opening
with a bare SELECT (a leading `--` or `/* */` comment, a WITH ... SELECT
CTE, a parenthesised set operation) got no LIMIT at all, while the
read-only classifier strips comments first and let those statements
through. Classify on the comment-blanked text and treat a leading WITH
as row-returning unless it embeds a data-modifying CTE, reusing the
read-only classifier's mutating-keyword heuristic.

Enabling CTEs exposed that every LIMIT/TOP helper matched the first
clause found textually, which on a CTE is the inner one: the CTE's own
LIMIT would be tightened and the statement left uncapped. The helpers
now scan with the existing parenthesis-depth tracking and reason only
about the statement's own clause, which also fixes the same hole for
plain subqueries and keeps the truncation probe from mistaking a nested
LIMIT/TOP for a user cap already within max_rows. On SQL Server, TOP
lands on the statement's own SELECT, and a leading CTE stays outside
the derived table when a set operation forces the

**File**: `src/connectors/__tests__/mysql.integration.test.ts` (modified, +16/-18)
```diff
@@ -396,24 +396,22 @@ describe('MySQL Connector Integration Tests', () => {
       expect(result.resultSets[0].rows[0]).toHaveProperty('total');
     });
 
-    it('should not apply maxRows to CTE queries (WITH clause)', async () => {
-      // Test that maxRows is not applied to CTE queries (WITH clause)
-      try {
-        const result = await mysqlTest.connector.executeSQL(`
-          WITH user_summary AS (
-            SELECT name, age FROM users WHERE age IS NOT NULL
-          )
-          SELECT * FROM user_summary ORDER BY age
-        `, { maxRows: 2 });
-        
-        // Should return all rows since WITH queries are not limited
-        expect(result.resultSets[0].rows.length).toBeGreaterThan(2);
-        expect(result.resultSets[0].rows[0]).toHaveProperty('name');
-        expect(result.resultSets[0].rows[0]).toHaveProperty('age');
-      } catch (error) {
-        // Some MySQL versions might not support CTE, that's okay
-        console.log('CTE not supported in this MySQL version, skipping test');
-      }
+    it('should apply maxRows to CTE queries (WITH clause)', async () => {
+      // A CTE is the ordinary shape of an analytical query, so leaving it
+      // uncapped left max_rows silently inert for most real queries.
+      // No try/catch: the test container runs MySQL 8, which supports CTEs,
+      // and a catch-all would swallow the assertions too.
+      const result = await mysqlTest.connector.executeSQL(`
+        WITH user_summary AS (
+          SELECT name, age FROM users WHERE age IS NOT NULL
+        )
+        SELECT * FROM user_summary ORDER BY age
+      `, { maxRows: 2 });
+
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
+      expect(result.resultSets[0].rows[0]).toHaveProperty('name');
+      expect(result.resultSets[0].rows[0]).toHaveProperty('age');
     });
 
     it('should handle maxRows with multiple SELECT statements', async () => {
```

**File**: `src/connectors/__tests__/postgres.integration.test.ts` (modified, +47/-4)
```diff
@@ -580,21 +580,64 @@ describe('PostgreSQL Connector Integration Tests', () => {
       expect(result.resultSets[0].rows[0]).toHaveProperty('total');
     });
 
-    it('should not apply maxRows to CTE queries (WITH clause)', async () => {
-      // Test that maxRows is not applied to CTE queries (WITH clause)
+    it('should apply maxRows to CTE queries (WITH clause)', async () => {
+      // A CTE is the ordinary shape of an analytical query, so leaving it
+      // uncapped left max_rows silently inert for most real queries.
       const result = await postgresTest.connector.executeSQL(`
         WITH user_summary AS (
           SELECT name, age FROM users WHERE age IS NOT NULL
         )
         SELECT * FROM user_summary ORDER BY age
       `, { maxRows: 2 });
       
-      // Should return all rows since WITH queries are not limited anymore
-      expect(result.resultSets[0].rows.length).toBeGreaterThan(2);
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
       expect(result.resultSets[0].rows[0]).toHaveProperty('name');
       expect(result.resultSets[0].rows[0]).toHaveProperty('age');
     });
 
+    it('should apply maxRows to a query introduced by a comment', async () => {
+      const result = await postgresTest.connector.executeSQL(
+        '-- dbhub attribution tag\nSELECT name FROM users ORDER BY name',
+        { maxRows: 2 }
+      );
+
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
+    });
+
+    it("should cap the statement itself rather than tightening a CTE's own LIMIT", async () => {
+      // The inner LIMIT caps only the CTE; the statement can still return more
+      // rows than that, so it needs a cap of its own.
+      const result = await postgresTest.connector.executeSQL(`
+        WITH first_three AS (
+          SELECT name FROM users ORDER BY name LIMIT 3
+        )
+        SELECT * FROM first_three
+      `, { maxRows: 2 });
+
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
+    });
+
+    it('should not apply maxRows to a data-modifying CTE', async () => {
+      const result = await postgresTest.connector.executeSQL(`
+        WITH inserted AS (
+          INSERT INTO users (name, email, age)
+          VALUES ('dm1', 'dm1@dm.com', 41), ('dm2', 'dm2@dm.com', 42), ('dm3', 'dm3@dm.com', 43)
+          RETURNING id, name
+        )
+        SELECT * FROM inserted
+      `, { maxRows: 2 });
+
+      // A LIMIT here would cap the rows handed back while all three rows were
+      // still written: a cap that isn't one.
+      expect(result.resultSets[0].rows).toHaveLength(3);
+      expect(result.resultSets[0].truncated).toBeFalsy();
+
+      await postgresTest.connector.executeSQL("DELETE FROM users WHERE email LIKE '%@dm.com'", {});
+    });
+
     it('should handle maxRows in multi-statement execution with transactions', async () => {
       // Test maxRows with multiple statements where some are SELECT
       const result = await postgresTest.connector.executeSQL(`
```

**File**: `src/connectors/__tests__/sqlite.integration.test.ts` (modified, +17/-4)
```diff
@@ -440,17 +440,30 @@ describe('SQLite Connector Integration Tests', () => {
       expect(result.resultSets[0].rows[0]).toHaveProperty('total');
     });
 
-    it('should not apply maxRows to CTE queries (WITH clause)', async () => {
-      // Test that maxRows is not applied to CTE queries (WITH clause)
+    it('should return rows and apply maxRows to a query introduced by a comment', async () => {
+      // SQLite picks all() vs run() by leading keyword; a leading comment
+      // used to send a SELECT down the run() path and discard its rows.
+      const result = await sqliteTest.connector.executeSQL(
+        '-- dbhub attribution tag\nSELECT name FROM users ORDER BY name',
+        { maxRows: 2 }
+      );
+
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
+    });
+
+    it('should apply maxRows to CTE queries (WITH clause)', async () => {
+      // A CTE is the ordinary shape of an analytical query, so leaving it
+      // uncapped left max_rows silently inert for most real queries.
       const result = await sqliteTest.connector.executeSQL(`
         WITH user_summary AS (
           SELECT name, age FROM users WHERE age IS NOT NULL
         )
         SELECT * FROM user_summary ORDER BY age
       `, { maxRows: 2 });
       
-      // Should return all rows since WITH queries are not limited anymore
-      expect(result.resultSets[0].rows.length).toBeGreaterThan(2);
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
       expect(result.resultSets[0].rows[0]).toHaveProperty('name');
       expect(result.resultSets[0].rows[0]).toHaveProperty('age');
     });
```

**File**: `src/connectors/mariadb/index.ts` (modified, +1/-1)
```diff
@@ -671,7 +671,7 @@ export class MariaDBConnector implements Connector {
           let probes: boolean[] = [];
           if (options.maxRows) {
             const rewrites = statements.map(statement =>
-              SQLRowLimiter.applyMaxRowsWithTruncationProbe(statement, options.maxRows)
+              SQLRowLimiter.applyMaxRowsWithTruncationProbe(statement, options.maxRows, "mariadb")
             );
             probes = rewrites.map(rewrite => rewrite.probeApplied);
 
```

**File**: `src/connectors/mysql/index.ts` (modified, +1/-1)
```diff
@@ -687,7 +687,7 @@ export class MySQLConnector implements Connector {
           let probes: boolean[] = [];
           if (options.maxRows) {
             const rewrites = statements.map(statement =>
-              SQLRowLimiter.applyMaxRowsWithTruncationProbe(statement, options.maxRows)
+              SQLRowLimiter.applyMaxRowsWithTruncationProbe(statement, options.maxRows, "mysql")
             );
             probes = rewrites.map(rewrite => rewrite.probeApplied);
 
```

**File**: `src/connectors/postgres/index.ts` (modified, +8/-6)
```diff
@@ -712,9 +712,10 @@ export class PostgresConnector implements Connector {
       if (statements.length === 1) {
         // Single statement - apply maxRows (with a truncation probe row) if applicable
         const { sql: processedStatement, probeApplied } = SQLRowLimiter.applyMaxRowsWithTruncationProbe(
-          statements[0],
-          options.maxRows
-        );
+            statements[0],
+            options.maxRows,
+            "postgres"
+          );
 
         // Engine-level read-only enforcement: when the tool is read-only, run the
         // statement inside a READ ONLY transaction so the database itself rejects any
@@ -780,9 +781,10 @@ export class PostgresConnector implements Connector {
           for (let statement of statements) {
             // Apply maxRows limit (with a truncation probe row) to SELECT queries if specified
             const { sql: processedStatement, probeApplied } = SQLRowLimiter.applyMaxRowsWithTruncationProbe(
-              statement,
-              options.maxRows
-            );
+            statement,
+            options.maxRows,
+            "postgres"
+          );
 
             const result = await client.query(processedStatement);
             const resultSet: SQLResultSet = {
```

**File**: `src/connectors/sqlite/index.ts` (modified, +26/-23)
```diff
@@ -26,7 +26,7 @@ import { quoteIdentifier } from "../../utils/identifier-quoter.js";
 import { SafeURL } from "../../utils/safe-url.js";
 import { obfuscateDSNPassword } from "../../utils/dsn-obfuscate.js";
 import { SQLRowLimiter } from "../../utils/sql-row-limiter.js";
-import { splitSQLStatements } from "../../utils/sql-parser.js";
+import { splitSQLStatements, stripCommentsAndStrings } from "../../utils/sql-parser.js";
 import { closeQuietly } from "../../utils/resource-cleanup.js";
 
 /**
@@ -457,6 +457,25 @@ export class SQLiteConnector implements Connector {
   }
 
 
+  /**
+   * Whether a statement returns rows (and so must run via `all()` rather than
+   * `run()`). Classified on the comment/string-stripped text so a leading
+   * attribution comment cannot hide a SELECT, matching the row limiter and the
+   * read-only classifier.
+   */
+  private returnsRows(statement: string): boolean {
+    const stripped = stripCommentsAndStrings(statement, "sqlite").toLowerCase().trim();
+    return stripped.startsWith('select') ||
+           stripped.startsWith('with') ||
+           stripped.startsWith('explain') ||
+           stripped.startsWith('analyze') ||
+           (stripped.startsWith('pragma') &&
+            (stripped.includes('table_info') ||
+             stripped.includes('index_info') ||
+             stripped.includes('index_list') ||
+             stripped.includes('foreign_key_list')));
+  }
+
   async executeSQL(sql: string, options: ExecuteOptions, parameters?: any[]): Promise<SQLResult> {
     if (!this.db) {
       throw new Error("Not connected to SQLite database");
@@ -478,24 +497,16 @@ export class SQLiteConnector implements Connector {
       if (statements.length === 1) {
         // Single statement - determine if it returns data
         let processedStatement = statements[0];
-        const trimmedStatement = statements[0].toLowerCase().trim();
-        const isReadStatement = trimmedStatement.startsWith('select') ||
-                               trimmedStatement.startsWith('with') ||
-                               trimmedStatement.startsWith('explain') ||
-                               trimmedStatement.startsWith('analyze') ||
-                               (trimmedStatement.startsWith('pragma') &&
-                                (trimmedStatement.includes('table_info') ||
-                                 trimmedStatement.includes('index_info') ||
-                                 trimmedStatement.includes('index_list') ||
-                                 trimmedStatement.includes('foreign_key_list')));
+        const isReadStatement = this.returnsRows(statements[0]);
 
         // Apply maxRows limit (with a truncation probe row) to SELECT queries
         // if specified (not PRAGMA/ANALYZE)
         let probeApplied = false;
         if (options.maxRows) {
           const rewrite = SQLRowLimiter.applyMaxRowsWithTruncationProbe(
             processedStatement,
-            options.maxRows
+            options.maxRows,
+            "sqlite"
           );
           processedStatement = rewrite.sql;
           probeApplied = rewrite.probeApplied;
@@ -537,16 +548,7 @@ export class SQLiteConnector implements Connector {
 
         // Separate read and write operations
         for (const statement of statements) {
-          const trimmedStatement = statement.toLowerCase().trim();
-          if (trimmedStatement.startsWith('select') ||
-              trimmedStatement.startsWith('with') ||
-              trimmedStatement.startsWith('explain') ||
-              trimmedStatement.startsWith('analyze') ||
-              (trimmedStatement.startsWith('pragma') &&
-               (trimmedStatement.includes('table_info') ||
-                trimmedStatement.includes('index_info') ||
-                trimmedStatement.includes('index_list') ||
-                trimmedStatement.includes('foreign_key_list')))) {
+          if (this.returnsRows(statement)) {
             readStatements.push(statement);
           } else {
             writeStatements.push(statement);
@@ -577,7 +579,8 @@ export class SQLiteConnector implements Connector {
           // Apply maxRows limit (with a truncation probe row) to SELECT queries if specified
           const { sql: processedStatement, probeApplied } = SQLRowLimiter.applyMaxRowsWithTruncationProbe(
             statement,
-            options.maxRows
+            options.maxRows,
+            "sqlite"
           );
           const rows = this.prepare(processedStatement).all();
           const resultSet: SQLResultSet = { sql: statement, rows, rowCount: rows.length };
```

**File**: `src/utils/__tests__/sql-row-limiter.test.ts` (modified, +235/-0)
```diff
@@ -155,6 +155,241 @@ describe("SQLRowLimiter", () => {
     });
   });
 
+  describe("applyMaxRows - leading comments", () => {
+    // A query introduced by a comment (an attribution tag, say) is still a
+    // SELECT. Classifying on the raw text made max_rows silently inert for
+    // every one of them.
+    it("caps a query introduced by a -- line comment", () => {
+      const sql = "-- dbhub agent query\nSELECT * FROM users";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "-- dbhub agent query\nSELECT * FROM users\nLIMIT 100"
+      );
+    });
+
+    it("caps a query introduced by a block comment", () => {
+      const sql = "/* tag: report */ SELECT * FROM users";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "/* tag: report */ SELECT * FROM users\nLIMIT 100"
+      );
+    });
+
+    it("caps a query introduced by several mixed leading comments", () => {
+      const sql = "-- one\n/* two */\n-- three\nSELECT * FROM users";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "-- one\n/* two */\n-- three\nSELECT * FROM users\nLIMIT 100"
+      );
+    });
+
+    it("leaves the caller's comment text untouched", () => {
+      // The comment is load-bearing for query attribution, so only the
+      // classification sees the blanked form; the SQL sent to the server
+      // keeps it verbatim.
+      const sql = "/* app=dbhub; user='bob' */\nSELECT * FROM users";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toContain("/* app=dbhub; user='bob' */");
+    });
+
+    it("still leaves a non-SELECT hidden behind a comment alone", () => {
+      const sql = "-- looks harmless\nUPDATE users SET active = true";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(sql);
+    });
+
+    it("ignores a keyword that only appears inside the comment", () => {
+      const sql = "/* select nothing */ UPDATE users SET active = true";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(sql);
+    });
+  });
+
+  describe("applyMaxRows - CTEs", () => {
+    it("caps a WITH ... SELECT query", () => {
+      const sql = "WITH recent AS (SELECT * FROM orders) SELECT * FROM recent";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "WITH recent AS (SELECT * FROM orders) SELECT * FROM recent\nLIMIT 100"
+      );
+    });
+
+    it("appends its own LIMIT instead of tightening a CTE's inner LIMIT", () => {
+      // The CTE's LIMIT caps only the CTE; the statement can still return far
+      // more rows than that (here via the join), so it needs a cap of its own.
+      const sql =
+        "WITH recent AS (SELECT * FROM orders LIMIT 5) SELECT * FROM recent JOIN big ON true";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "WITH recent AS (SELECT * FROM orders LIMIT 5) SELECT * FROM recent JOIN big ON true\nLIMIT 100"
+      );
+    });
+
+    it("tightens the statement's own LIMIT on a CTE query", () => {
+      const sql = "WITH recent AS (SELECT * FROM orders LIMIT 5) SELECT * FROM recent LIMIT 500";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "WITH recent AS (SELECT * FROM orders LIMIT 5) SELECT * FROM recent LIMIT 100"
+      );
+    });
+
+    it("wraps a CTE query whose own LIMIT is parameterized", () => {
+      const sql = "WITH recent AS (SELECT * FROM orders) SELECT * FROM recent LIMIT $1";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "SELECT * FROM (WITH recent AS (SELECT * FROM orders) SELECT * FROM recent LIMIT $1\n) AS subq LIMIT 100"
+      );
+    });
+
+    it.each([
+      ["DELETE", "WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d"],
+      ["INSERT", "WITH i AS (INSERT INTO t SELECT * FROM s RETURNING *) SELECT * FROM i"],
+      ["UPDATE", "WITH u AS (UPDATE t SET a = 1 RETURNING *) SELECT * FROM u"],
+    ])("does not cap a data-modifying CTE (%s)", (_label, sql) => {
+      // A LIMIT here would cap the rows handed back while the write still runs
+      // in full: a cap that isn't one.
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(sql);
+    });
+  });
+
+  describe("applyMaxRows - set operations and nesting", () => {
+    it("caps a parenthesised set operation", () => {
+      const sql = "(SELECT id FROM a) UNION (SELECT id FROM b)";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "(SELECT id FROM a) UNION (SELECT id FROM b)\nLIMIT 100"
+      );
+    });
+
+    it("keeps appending a trailing LIMIT to a bare UNION ALL, which binds to the whole set operation", () => {
+      const sql = "SELECT id FROM a UNION ALL SELECT id FROM b";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "SELECT id FROM a UNION ALL SELECT id FROM b\nLIMIT 100"
+      );
+    });
+
+    it("appends its own LIMIT instead of tightening a subquery's LIMIT", () => {
+      const sql = "SELECT * FROM (SELECT * FROM t LIMIT 5) s";
+      expect(SQLRowLimiter.applyMaxRows(sql, 100)).toBe(
+        "SELECT * FROM (SELECT * FRO
```

---

### Incident Patch 9: `6a62a634` (2026-09-15)
**Commit Message**: Fix: close the SSH tunnel when a source's database connection fails

connectSource stored the tunnel before connecting the database. When that
connect failed, the tunnel stayed open and in sshTunnels, and each retry
(lazy connection, or a source handed back for reconnection after a failed
IAM refresh) opened a new tunnel and orphaned the previous one's SSH
clients and local listener. Close and drop the tunnel created in the
failed attempt before rethrowing.

Also assert in the IAM refresh test that no timer is left armed after a
failed refresh, which is what distinguishes the fixed behavior from the
old guard-and-re-arm loop.

Addresses review feedback on #425.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_013UHUe6p1FxKHamwpDjyfoM

**File**: `src/connectors/__tests__/manager.test.ts` (modified, +46/-2)
```diff
@@ -293,14 +293,58 @@ describe("ConnectorManager IAM refresh recovery", () => {
     await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS);
     expect(mocks.generateRdsAuthToken).toHaveBeenCalledTimes(2);
 
-    // No further ticks: reconnection is driven by the next tool call, not a timer that
-    // would otherwise fire every 14 minutes and return at the guard.
+    // The timer must not be re-armed for a source that is no longer connected. (The
+    // previous implementation re-armed here and then returned at the guard on every
+    // later tick, so the token call count alone cannot tell the two apart.)
+    expect(vi.getTimerCount()).toBe(0);
+
+    // No further ticks: reconnection is driven by the next tool call.
     await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS * 3);
     expect(mocks.generateRdsAuthToken).toHaveBeenCalledTimes(2);
 
     await manager.disconnect();
   });
 
+  it("should close the SSH tunnel when the database connection fails so a retry does not leak it", async () => {
+    const instances = stubConnectorRegistry();
+    mocks.looksLikeSSHAlias.mockReturnValue(false);
+    const establishSpy = vi
+      .spyOn(SSHTunnel.prototype, "establish")
+      .mockResolvedValue({ localPort: 55555, targetHost: "db.internal", targetPort: 5432 });
+    const closeSpy = vi.spyOn(SSHTunnel.prototype, "close").mockResolvedValue(undefined);
+    const prototype = ConnectorRegistry.getConnectorForDSN("postgres://x") as any;
+    const originalClone = prototype.clone;
+    prototype.clone = () => {
+      const instance = originalClone();
+      instance.connect.mockRejectedValue(new Error("password authentication failed"));
+      return instance;
+    };
+
+    const manager = new ConnectorManager();
+    const source: SourceConfig = {
+      id: "pg_ssh",
+      type: "postgres",
+      dsn: "postgres://user:pass@db.internal:5432/mydb",
+      ssh_host: "bastion.example.com",
+      ssh_user: "ubuntu",
+      ssh_password: "secret",
+      lazy: true,
+    };
+    await manager.connectWithSources([source]);
+
+    await expect(manager.ensureConnected("pg_ssh")).rejects.toThrow("password authentication failed");
+    expect(establishSpy).toHaveBeenCalledTimes(1);
+    expect(closeSpy).toHaveBeenCalledTimes(1);
+    expect((manager as any).sshTunnels.size).toBe(0);
+
+    // A retry opens exactly one new tunnel and, on failure, closes that one too.
+    await expect(manager.ensureConnected("pg_ssh")).rejects.toThrow("password authentication failed");
+    expect(establishSpy).toHaveBeenCalledTimes(2);
+    expect(closeSpy).toHaveBeenCalledTimes(2);
+    expect((manager as any).sshTunnels.size).toBe(0);
+    expect(instances).toHaveLength(2);
+  });
+
   it("should not list a source as available when it can neither serve nor reconnect", () => {
     const manager = new ConnectorManager();
     (manager as any).sourceIds = ["alive", "dead"];
```

**File**: `src/connectors/manager.ts` (modified, +19/-3)
```diff
@@ -148,6 +148,7 @@ export class ConnectorManager {
 
     // Setup SSH tunnel if needed
     let actualDSN = dsn;
+    let tunnel: SSHTunnel | undefined;
     if (source.ssh_host) {
       const sshConfigPath = getDefaultSSHConfigPath();
       // If ssh_host looks like an SSH config alias, resolve from ~/.ssh/config
@@ -208,7 +209,7 @@ export class ConnectorManager {
       const targetPort = parseInt(url.port) || this.getDefaultPort(dsn);
 
       // Create and establish SSH tunnel
-      const tunnel = new SSHTunnel();
+      tunnel = new SSHTunnel();
       let tunnelInfo: SSHTunnelInfo;
       try {
         tunnelInfo = await tunnel.establish(sshConfig, {
@@ -281,8 +282,23 @@ export class ConnectorManager {
       config.collation = source.collation;
     }
 
-    // Connect to the database with config and optional init script
-    await connector.connect(actualDSN, source.init_script, config);
+    // Connect to the database with config and optional init script. If this fails,
+    // close the tunnel established for this attempt: the source may be retried (lazy
+    // connection or a failed IAM refresh), and each retry would otherwise open a new
+    // tunnel and orphan this one's SSH clients and local listener.
+    try {
+      await connector.connect(actualDSN, source.init_script, config);
+    } catch (error) {
+      if (tunnel) {
+        this.sshTunnels.delete(sourceId);
+        try {
+          await tunnel.close();
+        } catch (closeError) {
+          console.error(`Error closing SSH tunnel for source '${sourceId}':`, closeError);
+        }
+      }
+      throw error;
+    }
 
     // Store connector
     this.connectors.set(sourceId, connector);
```

---

### Incident Patch 10: `efe096d0` (2026-09-15)
**Commit Message**: Fix: make a failed AWS IAM refresh recoverable instead of losing the source (#425)

refreshIamSourceConnection tore down a source's connector before
reconnecting. When the reconnect threw (an expired SSO session is the
common trigger), the connector was gone, the refresh guard skipped every
later tick, and each tool call failed with "Source 'x' not found.
Available sources: ..., x, ..." until the process restarted.

- On a failed reconnect, hand the source back to lazySources so the next
  tool call retries the connection (and surfaces the real error while
  credentials are still bad).
- Re-arm the refresh timer only while the source is still connected; a
  successful reconnect re-arms it via connectSource.
- Derive the "Available sources" list in error messages from sources
  that are connected or registered for lazy connection, so a source that
  cannot serve a query is not reported as available.

Closes #424


Claude-Session: https://claude.ai/code/session_013UHUe6p1FxKHamwpDjyfoM

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `src/connectors/__tests__/manager.test.ts` (modified, +118/-1)
```diff
@@ -1,5 +1,6 @@
-import { beforeEach, describe, expect, it, vi } from "vitest";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import { ConnectorManager } from "../manager.js";
+import { ConnectorRegistry } from "../interface.js";
 import { SSHTunnel } from "../../utils/ssh-tunnel.js";
 import type { SourceConfig } from "../../types/config.js";
 import { homedir } from "os";
@@ -194,3 +195,119 @@ describe("ConnectorManager IAM DSN rewrite", () => {
     expect(dsn).not.toContain("sslmode=disable");
   });
 });
+
+describe("ConnectorManager IAM refresh recovery", () => {
+  const AWS_IAM_TOKEN_REFRESH_MS = 14 * 60 * 1000;
+
+  function makeIamSource(): SourceConfig {
+    return {
+      id: "mysql_iam",
+      type: "mysql",
+      dsn: "mysql://dbuser:ignored@mydb.abc123.eu-west-1.rds.amazonaws.com:3306/mydb",
+      aws_iam_auth: true,
+      aws_region: "eu-west-1",
+    };
+  }
+
+  function stubConnectorRegistry() {
+    const instances: Array<{ connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
+    const prototype = {
+      id: "mysql",
+      clone: () => {
+        const instance = {
+          id: "mysql",
+          connect: vi.fn().mockResolvedValue(undefined),
+          disconnect: vi.fn().mockResolvedValue(undefined),
+        };
+        instances.push(instance);
+        return instance;
+      },
+    };
+    vi.spyOn(ConnectorRegistry, "getConnectorForDSN").mockReturnValue(prototype as any);
+    return instances;
+  }
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    vi.useFakeTimers();
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+    vi.restoreAllMocks();
+  });
+
+  it("should recover a source whose IAM refresh failed once credentials are valid again", async () => {
+    const instances = stubConnectorRegistry();
+    mocks.generateRdsAuthToken.mockResolvedValueOnce("token-1");
+
+    const manager = new ConnectorManager();
+    await manager.connectWithSources([makeIamSource()]);
+    expect(instances).toHaveLength(1);
+    expect(manager.getConnector("mysql_iam")).toBe(instances[0]);
+
+    // Refresh tick fires while the SSO session is expired: minting the token throws.
+    mocks.generateRdsAuthToken.mockRejectedValueOnce(new Error("SSO session expired"));
+    await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS);
+    expect(instances[0].disconnect).toHaveBeenCalledTimes(1);
+    expect(mocks.generateRdsAuthToken).toHaveBeenCalledTimes(2);
+
+    // The source stays known and is still listed as available, because a tool call
+    // will retry the connection. Before the fix this threw "Source 'mysql_iam' not
+    // found. Available sources: mysql_iam" and there was no way back.
+    expect(manager.getSourceIds()).toEqual(["mysql_iam"]);
+
+    // Still broken: the next tool call surfaces the real cause, not "not found".
+    mocks.generateRdsAuthToken.mockRejectedValueOnce(new Error("SSO session expired"));
+    await expect(manager.ensureConnected("mysql_iam")).rejects.toThrow("SSO session expired");
+
+    // User re-authenticates: the next tool call reconnects transparently.
+    mocks.generateRdsAuthToken.mockResolvedValueOnce("token-2");
+    await manager.ensureConnected("mysql_iam");
+    expect(instances).toHaveLength(2);
+    expect(manager.getConnector("mysql_iam")).toBe(instances[1]);
+    expect(instances[1].connect).toHaveBeenCalledWith(
+      expect.stringContaining("token-2"),
+      undefined,
+      expect.any(Object)
+    );
+
+    // Refresh rotation resumes for the recovered connection.
+    mocks.generateRdsAuthToken.mockResolvedValueOnce("token-3");
+    await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS);
+    expect(instances).toHaveLength(3);
+    expect(instances[1].disconnect).toHaveBeenCalledTimes(1);
+    expect(manager.getConnector("mysql_iam")).toBe(instances[2]);
+
+    await manager.disconnect();
+  });
+
+  it("should stop re-arming the refresh timer for a source that is no longer connected", async () => {
+    stubConnectorRegistry();
+    mocks.generateRdsAuthToken.mockResolvedValueOnce("token-1");
+
+    const manager = new ConnectorManager();
+    await manager.connectWithSources([makeIamSource()]);
+
+    mocks.generateRdsAuthToken.mockRejectedValueOnce(new Error("SSO session expired"));
+    await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS);
+    expect(mocks.generateRdsAuthToken).toHaveBeenCalledTimes(2);
+
+    // No further ticks: reconnection is driven by the next tool call, not a timer that
+    // would otherwise fire every 14 minutes and return at the guard.
+    await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS * 3);
+    expect(mocks.generateRdsAuthToken).toHaveBeenCalledTimes(2);
+
+    await manager.disconnect();
+  });
+
+  it("should not list a source as available when it can neither serve nor reconnect", () => {
+    const manager = new ConnectorManager();
+    (manager as any).sourceIds = ["alive", "dead"];
+    (mana
```

**File**: `src/connectors/manager.ts` (modified, +26/-5)
```diff
@@ -97,7 +97,7 @@ export class ConnectorManager {
     if (!lazySource) {
       if (sourceId) {
         throw new Error(
-          `Source '${sourceId}' not found. Available sources: ${this.sourceIds.join(", ")}`
+          `Source '${sourceId}' not found. Available sources: ${this.getAvailableSourceIds().join(", ")}`
         );
       } else {
         throw new Error("No sources configured. Call connectWithSources() first.");
@@ -352,7 +352,7 @@ export class ConnectorManager {
     if (!connector) {
       if (sourceId) {
         throw new Error(
-          `Source '${sourceId}' not found. Available sources: ${this.sourceIds.join(", ")}`
+          `Source '${sourceId}' not found. Available sources: ${this.getAvailableSourceIds().join(", ")}`
         );
       } else {
         throw new Error("No sources connected. Call connectWithSources() first.");
@@ -396,6 +396,15 @@ export class ConnectorManager {
     return [...this.sourceIds];
   }
 
+  /**
+   * Source IDs that can actually serve a request: connected, or registered for
+   * lazy (re)connection on first use. Used for error messages so a source that
+   * is neither is not reported as available.
+   */
+  private getAvailableSourceIds(): string[] {
+    return this.sourceIds.filter(id => this.connectors.has(id) || this.lazySources.has(id));
+  }
+
   /** Get all available source IDs */
   static getAvailableSourceIds(): string[] {
     if (!managerInstance) {
@@ -481,8 +490,10 @@ export class ConnectorManager {
           error
         );
       } finally {
-        // Continue rotating as long as source remains configured and not shutting down.
-        if (!this.isDisconnecting && this.sourceConfigs.has(sourceId)) {
+        // Continue rotating only while the source is still connected and not shutting
+        // down. A source whose refresh failed has been handed back to lazySources, and
+        // its next successful connectSource() re-arms the timer.
+        if (!this.isDisconnecting && this.connectors.has(sourceId)) {
           this.scheduleIamRefresh(source);
         }
       }
@@ -515,7 +526,17 @@ export class ConnectorManager {
       return;
     }
 
-    await this.connectSource(source);
+    try {
+      await this.connectSource(source);
+    } catch (error) {
+      // The old connector is already gone. Register the source for lazy reconnection so
+      // the next tool call retries (e.g. after the user re-authenticates) instead of
+      // failing forever with "Source not found".
+      if (!this.isDisconnecting && this.sourceConfigs.has(sourceId)) {
+        this.lazySources.set(sourceId, source);
+      }
+      throw error;
+    }
   }
 
   /**
```

---

### Incident Patch 11: `0fd4c7a3` (2026-09-14)
**Commit Message**: fix(postgres,mariadb): attach pool 'error' listeners so a dropped idle connection no longer crashes the process (#423)

pg-pool re-emits an idle client's error (server restart, failover,
idle-timeout close) as an 'error' event on the pool. The PostgreSQL
connector never attached a listener, so Node reported an unhandled
'error' event and exited the whole DBHub process. Over stdio, MCP
clients do not restart the server, so the database tools were gone
until the user reconnected manually.

The mariadb pool has the same shape: it keeps `minimumIdle`
connections (default: connectionLimit) open in the background and
emits 'error' on the pool when a background reconnect attempt fails,
e.g. while the server is restarting.

Both pools have already discarded or will retry the affected
connection by the time the event fires, so the listener only logs the
error (with the source id) and lets the next query pick up a fresh
connection.

Tests: a new unit test drives each connector with an EventEmitter-based
fake pool, where emit('error') throws exactly as it would without a
listener, and asserts the connector survives and logs. Existing fake
pools gain an `on` stub.

Fixes #422


Claude-Session:

**File**: `src/connectors/__tests__/connect-failure-cleanup.test.ts` (modified, +2/-0)
```diff
@@ -84,6 +84,7 @@ describe("connect() failure cleanup", () => {
     mariadbCreatePool.mockReturnValue({
       query: vi.fn().mockRejectedValue(PROBE_FAILURE),
       end,
+      on: vi.fn(),
     });
 
     const connector = new MariaDBConnector();
@@ -98,6 +99,7 @@ describe("connect() failure cleanup", () => {
     pgPoolCtor.mockReturnValue({
       connect: vi.fn().mockRejectedValue(PROBE_FAILURE),
       end,
+      on: vi.fn(),
     });
 
     const connector = new PostgresConnector();
```

**File**: `src/connectors/__tests__/pool-error-listener.test.ts` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
+import { EventEmitter } from "events";
+
+/**
+ * Pools must carry an 'error' listener (bytebase/dbhub#422).
+ *
+ * pg-pool re-emits an idle client's error (server restart, failover,
+ * idle-timeout close) as an 'error' event on the pool, and the mariadb pool
+ * emits 'error' when a background reconnect attempt fails. An EventEmitter
+ * with no 'error' listener throws on emit, which Node reports as an
+ * unhandled 'error' event and exits the process. Over stdio, MCP clients do
+ * not restart the server, so the crash takes the database tools away until
+ * the user reconnects manually.
+ *
+ * The fake pools below are real EventEmitters, so `emit("error")` throws
+ * exactly like the drivers' pools would if the connector forgot the listener.
+ */
+
+class FakePgPool extends EventEmitter {
+  connect = vi.fn().mockResolvedValue({ release: vi.fn() });
+  end = vi.fn().mockResolvedValue(undefined);
+}
+
+class FakeMariadbPool extends EventEmitter {
+  query = vi.fn().mockResolvedValue([{ version: "11.4.0-MariaDB" }]);
+  end = vi.fn().mockResolvedValue(undefined);
+}
+
+let pgPool: FakePgPool;
+let mariadbPool: FakeMariadbPool;
+
+vi.mock("pg", () => ({
+  default: {
+    Pool: function (this: any) {
+      return pgPool;
+    },
+  },
+}));
+
+vi.mock("mariadb", () => ({
+  createPool: () => mariadbPool,
+}));
+
+const { PostgresConnector } = await import("../postgres/index.js");
+const { MariaDBConnector } = await import("../mariadb/index.js");
+
+const IDLE_DROP = new Error("terminating connection due to administrator command");
+
+const spyConsoleError = () => vi.spyOn(console, "error").mockImplementation(() => {});
+
+describe("pool 'error' listener", () => {
+  let consoleError: ReturnType<typeof spyConsoleError>;
+
+  beforeEach(() => {
+    pgPool = new FakePgPool();
+    mariadbPool = new FakeMariadbPool();
+    consoleError = spyConsoleError();
+  });
+
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it("an unlistened pool would crash the process (sanity check of the fake)", () => {
+    expect(() => pgPool.emit("error", IDLE_DROP)).toThrow(IDLE_DROP);
+  });
+
+  it("PostgreSQL survives an idle connection being dropped", async () => {
+    const connector = new PostgresConnector();
+    await connector.connect("postgres://u:p@localhost:5432/db");
+
+    expect(pgPool.listenerCount("error")).toBe(1);
+    // Mirrors pg-pool's idleListener: the client is already purged, then the
+    // pool re-emits. With no listener this emit would throw.
+    expect(() => pgPool.emit("error", IDLE_DROP, {})).not.toThrow();
+
+    expect(consoleError).toHaveBeenCalledTimes(1);
+    expect(consoleError.mock.calls[0].join(" ")).toContain("PostgreSQL pool");
+    expect(consoleError.mock.calls[0].join(" ")).toContain(IDLE_DROP.message);
+
+    await connector.disconnect();
+  });
+
+  it("PostgreSQL log line names the source", async () => {
+    const connector = new PostgresConnector();
+    (connector as any).sourceId = "prod_pg";
+    await connector.connect("postgres://u:p@localhost:5432/db");
+
+    pgPool.emit("error", IDLE_DROP, {});
+    expect(consoleError.mock.calls[0][0]).toContain('source "prod_pg"');
+  });
+
+  it("MariaDB survives a background reconnect failure", async () => {
+    const connector = new MariaDBConnector();
+    await connector.connect("mariadb://u:p@localhost:3306/db");
+
+    expect(mariadbPool.listenerCount("error")).toBe(1);
+    const reconnectFailure = new Error("Pool fails to create connection: ECONNREFUSED");
+    expect(() => mariadbPool.emit("error", reconnectFailure)).not.toThrow();
+
+    expect(consoleError).toHaveBeenCalledTimes(1);
+    expect(consoleError.mock.calls[0].join(" ")).toContain("MariaDB pool");
+    expect(consoleError.mock.calls[0].join(" ")).toContain(reconnectFailure.message);
+
+    await connector.disconnect();
+  });
+
+  it("does not stack listeners across reconnects of the same connector", async () => {
+    const connector = new PostgresConnector();
+    await connector.connect("postgres://u:p@localhost:5432/db");
+    await connector.disconnect();
+
+    // A fresh pool per connect(): the listener is attached to the new pool.
+    pgPool = new FakePgPool();
+    await connector.connect("postgres://u:p@localhost:5432/db");
+    expect(pgPool.listenerCount("error")).toBe(1);
+  });
+});
```

**File**: `src/connectors/__tests__/readonly-transaction-strategy.test.ts` (modified, +2/-0)
```diff
@@ -53,6 +53,8 @@ function makeFakePool(version: string, wrapResults: (rows: any[]) => any) {
     query: vi.fn(async () => wrapResults([{ version }])),
     getConnection: vi.fn(async () => conn),
     end: vi.fn(),
+    // Connectors attach a pool 'error' listener at connect time.
+    on: vi.fn(),
   };
   return { pool, conn, statements };
 }
```

**File**: `src/connectors/mariadb/index.ts` (modified, +14/-0)
```diff
@@ -162,6 +162,20 @@ export class MariaDBConnector implements Connector {
 
       this.pool = mariadb.createPool(connectionConfig);
 
+      // The mariadb pool keeps `minimumIdle` connections open in the background
+      // (defaults to connectionLimit) and emits an 'error' event on the pool when
+      // one of those background reconnect attempts fails, e.g. while the server
+      // is restarting. Without a listener Node treats it as unhandled and exits
+      // the whole process. The pool retries with backoff on its own, so logging
+      // is all that is needed here. The typings omit this event, but the runtime
+      // Pool is an EventEmitter.
+      (this.pool as unknown as NodeJS.EventEmitter).on("error", (err: Error) => {
+        console.error(
+          `MariaDB pool (source "${this.sourceId}"): background connection error, pool will retry:`,
+          err.message
+        );
+      });
+
       // Test the connection and detect the server flavor in the same round trip.
       const rows = await this.pool.query("SELECT VERSION() AS version");
       this.supportsReadOnlyTransaction = !isTiDBVersion(rows?.[0]?.version);
```

**File**: `src/connectors/postgres/index.ts` (modified, +12/-0)
```diff
@@ -206,6 +206,18 @@ export class PostgresConnector implements Connector {
 
       this.pool = new Pool(poolConfig);
 
+      // pg-pool re-emits an idle client's error (server restart, failover,
+      // idle-timeout close) as an 'error' event on the pool. Without a listener
+      // Node treats it as unhandled and exits the whole process. The client has
+      // already been purged from the pool by the time this fires, so logging is
+      // all that is needed; the next query checks out a fresh connection.
+      this.pool.on("error", (err: Error) => {
+        console.error(
+          `PostgreSQL pool (source "${this.sourceId}"): idle connection dropped, will reconnect on next query:`,
+          err.message
+        );
+      });
+
       // Test the connection
       const client = await this.pool.connect();
       client.release();
```

---

### Incident Patch 12: `cca7b67d` (2026-09-08)
**Commit Message**: fix(postgres): include foreign tables in getTables so search_objects can discover them (#419)

Postgres reports foreign tables (postgres_fdw, file_fdw, ...) in
information_schema.tables with table_type = 'FOREIGN', so the
'BASE TABLE' filter hid them from search_objects even though every
per-table detail query (columns, comment, row count, tableExists)
already handled them. Widen the filter to include 'FOREIGN'.

Also let getTableIndexes see partitioned tables (relkind 'p'), which
carry their own index entries since PG11 but were filtered out.

Adds integration coverage using a handler-less FDW so the foreign
table can be enumerated and described without a remote server.

Closes #418


Claude-Session: https://claude.ai/code/session_01Yc1YYa3jHCEW7FDxC66R9Z

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `src/connectors/__tests__/postgres.integration.test.ts` (modified, +37/-0)
```diff
@@ -173,6 +173,21 @@ class PostgreSQLIntegrationTest extends IntegrationTestBase<PostgreSQLTestContai
     `, {});
     await connector.executeSQL(`COMMENT ON VIEW active_users IS 'Users aged 25 or older'`, {});
 
+    // Create a foreign table (for foreign table discovery tests, #418). A
+    // handler-less FDW is enough: the catalog entries exist and can be
+    // enumerated/described, the table just can't be scanned.
+    await connector.executeSQL('CREATE FOREIGN DATA WRAPPER dummy_fdw', {});
+    await connector.executeSQL('CREATE SERVER IF NOT EXISTS dummy_server FOREIGN DATA WRAPPER dummy_fdw', {});
+    await connector.executeSQL(`
+      CREATE FOREIGN TABLE IF NOT EXISTS remote_users (
+        id INTEGER,
+        name VARCHAR(100),
+        email VARCHAR(100),
+        age INTEGER
+      ) SERVER dummy_server
+    `, {});
+    await connector.executeSQL(`COMMENT ON FOREIGN TABLE remote_users IS 'Users on a remote server'`, {});
+
     // Create test stored procedures using SQL language to avoid dollar quoting
     await connector.executeSQL(`
       CREATE OR REPLACE FUNCTION get_user_count()
@@ -346,6 +361,28 @@ describe('PostgreSQL Connector Integration Tests', () => {
       expect(comment).toBe('Users aged 25 or older');
     });
 
+    it('should list foreign tables as tables, not views', async () => {
+      const tables = await postgresTest.connector.getTables();
+      expect(tables).toContain('remote_users');
+
+      const views = await postgresTest.connector.getViews();
+      expect(views).not.toContain('remote_users');
+
+      expect(await postgresTest.connector.tableExists('remote_users')).toBe(true);
+    });
+
+    it('should describe foreign tables like regular tables', async () => {
+      const columns = await postgresTest.connector.getTableSchema('remote_users');
+      expect(columns.map((c) => c.column_name)).toEqual(['id', 'name', 'email', 'age']);
+
+      const comment = await postgresTest.connector.getTableComment!('remote_users');
+      expect(comment).toBe('Users on a remote server');
+
+      // Foreign tables cannot have indexes; this must return empty rather than throw.
+      const indexes = await postgresTest.connector.getTableIndexes('remote_users');
+      expect(indexes).toEqual([]);
+    });
+
     it('should report connection pool state and buffer cache hit ratio via getHealthCheck', async () => {
       const health = await postgresTest.connector.getHealthCheck!();
 
```

**File**: `src/connectors/__tests__/shared/integration-test-base.ts` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ export abstract class IntegrationTestBase<TContainer extends TestContainer> {
 
       it('should list views without overlapping tables', async () => {
         // Verifies getViews() is wired and its query executes against the real
-        // database. getTables() (BASE TABLE only) and getViews() must be disjoint.
+        // database. getTables() (tables, never views) and getViews() must be disjoint.
         const tables = await this.connector.getTables();
         const views = await this.connector.getViews();
         expect(Array.isArray(views)).toBe(true);
```

**File**: `src/connectors/postgres/index.ts` (modified, +5/-2)
```diff
@@ -259,12 +259,15 @@ export class PostgresConnector implements Connector {
       // Use the configured default schema (from search_path config, defaults to 'public')
       const schemaToUse = schema || this.defaultSchema;
 
+      // 'FOREIGN' covers foreign tables (postgres_fdw, file_fdw, ...). They are
+      // queryable like base tables and information_schema.columns already
+      // describes them, so they must be discoverable here too (#418).
       const result = await client.query(
         `
         SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
-        AND table_type = 'BASE TABLE'
+        AND table_type IN ('BASE TABLE', 'FOREIGN')
         ORDER BY table_name
       `,
         [schemaToUse]
@@ -358,7 +361,7 @@ export class PostgresConnector implements Connector {
           AND i.oid = ix.indexrelid
           AND a.attrelid = t.oid
           AND a.attnum = ANY(ix.indkey)
-          AND t.relkind = 'r'
+          AND t.relkind IN ('r','p')
           AND t.relname = $1
           AND ns.oid = t.relnamespace
           AND ns.nspname = $2
```

---

### Incident Patch 13: `43e33c5c` (2026-09-02)
**Commit Message**: fix(postgres): return date/timestamp values verbatim instead of host-local Dates (#417)

pg-types parses `timestamp without time zone` and `date` with the
multi-argument Date constructor, i.e. in the DBHub host's local timezone.
The JSON serializer then renders that Date via toISOString(), so a stored
`2026-01-01 12:00:00` came back as `2026-01-01T18:00:00.000Z` on a host in
America/Chicago, with the host offset baked in, a misleading `Z` suffix,
and microseconds truncated.

Register string passthrough parsers for date, timestamp, timestamptz and
their array types on DBHub's pool via `PoolConfig.types`, scoped to the
pool rather than the process-wide `pg.types` registry. Values now render
as the text psql would show.

Fixes #416


Claude-Session: https://claude.ai/code/session_01EL7QBrNvJJvVHaDvmC9MZL

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `src/connectors/__tests__/postgres-type-parsers.test.ts` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+import { describe, it, expect } from 'vitest';
+import pg from 'pg';
+import { postgresTypeParsers, VERBATIM_DATE_TIME_OIDS } from '../postgres/type-parsers.js';
+
+const OID_DATE = 1082;
+const OID_TIMESTAMP = 1114;
+const OID_TIMESTAMPTZ = 1184;
+const OID_TIME = 1083;
+const OID_INT4 = 23;
+const OID_TIMESTAMP_ARRAY = 1115;
+
+// Regression test for https://github.com/bytebase/dbhub/issues/416:
+// `timestamp without time zone` and `date` values were parsed into JavaScript
+// Dates in the host's local timezone, so the JSON output was shifted by the
+// host's UTC offset. The parsers below are pure functions, so the behavior can
+// be checked without a database.
+describe('PostgreSQL date/time type parsers', () => {
+  it('returns timestamp without time zone verbatim, including microseconds', () => {
+    const parse = postgresTypeParsers.getTypeParser(OID_TIMESTAMP, 'text');
+    expect(parse('2026-01-01 12:00:00')).toBe('2026-01-01 12:00:00');
+    expect(parse('2026-01-01 12:00:00.123456')).toBe('2026-01-01 12:00:00.123456');
+  });
+
+  it('returns date verbatim instead of a host-local midnight instant', () => {
+    const parse = postgresTypeParsers.getTypeParser(OID_DATE, 'text');
+    expect(parse('2026-01-01')).toBe('2026-01-01');
+  });
+
+  it('returns timestamp with time zone verbatim, preserving the session offset', () => {
+    const parse = postgresTypeParsers.getTypeParser(OID_TIMESTAMPTZ, 'text');
+    expect(parse('2026-01-01 12:00:00+00')).toBe('2026-01-01 12:00:00+00');
+  });
+
+  it('returns array element text verbatim for timestamp[]', () => {
+    const parse = postgresTypeParsers.getTypeParser(OID_TIMESTAMP_ARRAY, 'text');
+    expect(parse('{"2026-01-01 12:00:00"}')).toBe('{"2026-01-01 12:00:00"}');
+  });
+
+  it('is independent of the host timezone', () => {
+    const originalTz = process.env.TZ;
+    process.env.TZ = 'America/Chicago';
+    try {
+      const parse = postgresTypeParsers.getTypeParser(OID_TIMESTAMP, 'text');
+      // JSON.stringify is what the response formatter applies to row values.
+      expect(JSON.stringify(parse('2026-01-01 12:00:00'))).toBe('"2026-01-01 12:00:00"');
+    } finally {
+      if (originalTz === undefined) delete process.env.TZ;
+      else process.env.TZ = originalTz;
+    }
+  });
+
+  it('defaults to the text format when none is given', () => {
+    const parse = postgresTypeParsers.getTypeParser(OID_TIMESTAMP);
+    expect(parse('2026-01-01 12:00:00')).toBe('2026-01-01 12:00:00');
+  });
+
+  it('delegates every other type to the default pg-types parsers', () => {
+    expect(postgresTypeParsers.getTypeParser(OID_INT4, 'text')('42')).toBe(42);
+    expect(postgresTypeParsers.getTypeParser(OID_TIME, 'text')('12:00:00.123456')).toBe('12:00:00.123456');
+    expect(postgresTypeParsers.getTypeParser(OID_INT4, 'binary')).toBe(pg.types.getTypeParser(OID_INT4, 'binary'));
+  });
+
+  it('does not mutate the process-wide pg.types registry', () => {
+    for (const oid of VERBATIM_DATE_TIME_OIDS) {
+      expect(pg.types.getTypeParser(oid, 'text')).not.toBe(postgresTypeParsers.getTypeParser(oid, 'text'));
+    }
+    expect(pg.types.getTypeParser(OID_TIMESTAMP, 'text')('2026-01-01 12:00:00')).toBeInstanceOf(Date);
+  });
+});
```

**File**: `src/connectors/__tests__/postgres.integration.test.ts` (modified, +19/-0)
```diff
@@ -322,6 +322,25 @@ describe('PostgreSQL Connector Integration Tests', () => {
       expect(result.resultSets[0].rows[0].array_val).toBeDefined();
     });
 
+    it('should return date/timestamp values verbatim, not shifted by the host timezone', async () => {
+      // Regression test for https://github.com/bytebase/dbhub/issues/416
+      const result = await postgresTest.connector.executeSQL(
+        `SELECT
+           '2026-01-01 12:00:00.123456'::timestamp AS naive,
+           '2026-01-01 12:00:00+00'::timestamptz AS aware,
+           '2026-01-01'::date AS day,
+           ARRAY['2026-01-01 12:00:00'::timestamp] AS naive_arr`,
+        {}
+      );
+
+      const row = result.resultSets[0].rows[0];
+      expect(row.naive).toBe('2026-01-01 12:00:00.123456');
+      expect(row.day).toBe('2026-01-01');
+      expect(typeof row.aware).toBe('string');
+      expect(row.aware).toMatch(/^2026-01-01 /);
+      expect(row.naive_arr).toBe('{"2026-01-01 12:00:00"}');
+    });
+
     it('should return comment for views via getTableComment', async () => {
       const comment = await postgresTest.connector.getTableComment!('active_users');
       expect(comment).toBe('Users aged 25 or older');
```

**File**: `src/connectors/postgres/index.ts` (modified, +5/-0)
```diff
@@ -24,6 +24,7 @@ import { SQLRowLimiter } from "../../utils/sql-row-limiter.js";
 import { quoteIdentifier } from "../../utils/identifier-quoter.js";
 import { splitSQLStatements } from "../../utils/sql-parser.js";
 import { FailedToReadCertificate } from "./failed-to-read-certificate.js";
+import { postgresTypeParsers } from "./type-parsers.js";
 import { closeQuietly } from "../../utils/resource-cleanup.js";
 
 const POSTGRES_CLIENT_QUERY_TIMEOUT_GRACE_MS = 5_000;
@@ -182,6 +183,10 @@ export class PostgresConnector implements Connector {
     try {
       const poolConfig = await this.dsnParser.parse(dsn, config);
 
+      // Return date/timestamp values as the server's verbatim text so they are
+      // not shifted by the host's local timezone (see type-parsers.ts).
+      poolConfig.types = postgresTypeParsers;
+
       // SDK-level readonly enforcement: Set default_transaction_read_only for the entire connection
       if (config?.readonly) {
         poolConfig.options = (poolConfig.options || '') + ' -c default_transaction_read_only=on';
```

**File**: `src/connectors/postgres/type-parsers.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import pg from "pg";
+
+/**
+ * PostgreSQL type OIDs whose values DBHub returns as the server's verbatim
+ * text instead of letting node-postgres convert them to JavaScript Dates.
+ *
+ * pg-types parses `timestamp without time zone` and `date` with the
+ * multi-argument Date constructor, i.e. in the DBHub host's local timezone.
+ * The JSON serializer then renders that Date via toISOString(), so a stored
+ * wall-clock value of `2026-01-01 12:00:00` comes back as
+ * `2026-01-01T18:00:00.000Z` on a host running in America/Chicago: the host
+ * offset is baked into the output, a `Z` suffix makes it look authoritative,
+ * and sub-millisecond precision is dropped. `timestamptz` is parsed via
+ * Date.UTC and so was never shifted, but it is included here so all three
+ * date/time types render consistently as the text psql would show.
+ *
+ * See https://github.com/bytebase/dbhub/issues/416
+ */
+export const VERBATIM_DATE_TIME_OIDS: ReadonlySet<number> = new Set([
+  1082, // date
+  1114, // timestamp without time zone
+  1184, // timestamp with time zone
+  1182, // date[]
+  1115, // timestamp[]
+  1185, // timestamptz[]
+]);
+
+const passthrough = (value: string): string => value;
+
+/**
+ * Type parser configuration for the connection pool. Scoped to DBHub's pool
+ * via `PoolConfig.types` rather than mutating the process-wide `pg.types`
+ * registry, so other consumers of node-postgres in the same process keep the
+ * default behavior.
+ */
+export const postgresTypeParsers: pg.CustomTypesConfig = {
+  getTypeParser(oid: number, format?: "text" | "binary"): any {
+    if (VERBATIM_DATE_TIME_OIDS.has(oid) && (format === undefined || format === "text")) {
+      return passthrough;
+    }
+    return pg.types.getTypeParser(oid, format as any);
+  },
+};
```

---

### Incident Patch 14: `c3630043` (2026-09-02)
**Commit Message**: fix(postgres): enforce query timeout on server (#415)

**File**: `src/connectors/__tests__/dsn-parser.test.ts` (modified, +12/-0)
```diff
@@ -99,6 +99,18 @@ describe('DSN Parser - PostgreSQL SSL Modes', () => {
   });
 });
 
+describe('DSN Parser - PostgreSQL query timeout', () => {
+  it('configures a server-side statement timeout before the client fallback', async () => {
+    const parser = new PostgresConnector().dsnParser;
+    const config = await parser.parse('postgres://user:pass@localhost:5432/db', {
+      queryTimeoutSeconds: 30,
+    });
+
+    expect(config.statement_timeout).toBe(30_000);
+    expect(config.query_timeout).toBe(35_000);
+  });
+});
+
 describe('DSN Parser - AWS IAM Authentication', () => {
   describe('MySQL', () => {
     const connector = new MySQLConnector();
```

**File**: `src/connectors/__tests__/postgres.integration.test.ts` (modified, +60/-1)
```diff
@@ -214,6 +214,65 @@ describe('PostgreSQL Connector Integration Tests', () => {
   postgresTest.createErrorHandlingTests();
   postgresTest.createSSLTests();
   describe('PostgreSQL-specific Features', () => {
+    it('should cancel a timed-out query on the PostgreSQL server', async () => {
+      const timedConnector = new PostgresConnector();
+      const observer = new PostgresConnector();
+      const probe = 'dbhub_query_timeout_probe';
+
+      const runningProbeCount = async (): Promise<number> => {
+        const result = await observer.executeSQL(
+          `SELECT count(*)::int AS count
+           FROM pg_stat_activity
+           WHERE state = 'active'
+             AND query LIKE '%${probe}%'
+             AND query NOT LIKE '%pg_stat_activity%'`,
+          {}
+        );
+        return result.resultSets[0].rows[0].count;
+      };
+
+      const waitFor = async (
+        predicate: () => Promise<boolean>,
+        timeoutMs: number
+      ): Promise<boolean> => {
+        const deadline = Date.now() + timeoutMs;
+        while (Date.now() < deadline) {
+          if (await predicate()) return true;
+          await new Promise((resolve) => setTimeout(resolve, 50));
+        }
+        return false;
+      };
+
+      try {
+        await timedConnector.connect(postgresTest.connectionString, undefined, {
+          queryTimeoutSeconds: 1,
+        });
+        await observer.connect(postgresTest.connectionString);
+
+        const query = timedConnector.executeSQL(
+          `SELECT pg_sleep(10), '${probe}'`,
+          { readonly: true }
+        );
+        const settled = query.then(
+          () => null,
+          (error) => error as NodeJS.ErrnoException
+        );
+
+        expect(await waitFor(async () => (await runningProbeCount()) === 1, 5_000)).toBe(true);
+
+        const error = await settled;
+        expect(error).toBeInstanceOf(Error);
+        expect(error?.code).toBe('57014');
+        expect(await waitFor(async () => (await runningProbeCount()) === 0, 2_000)).toBe(true);
+
+        const after = await timedConnector.executeSQL('SELECT 1 AS ok', { readonly: true });
+        expect(after.resultSets[0].rows[0].ok).toBe(1);
+      } finally {
+        await timedConnector.disconnect();
+        await observer.disconnect();
+      }
+    }, 20_000);
+
     it('should execute multiple statements with transaction support', async () => {
       const result = await postgresTest.connector.executeSQL(`
         INSERT INTO users (name, email, age) VALUES ('Multi User 1', 'multi1@example.com', 30);
@@ -756,4 +815,4 @@ describe('PostgreSQL Connector Integration Tests', () => {
       }
     });
   });
-});
\ No newline at end of file
+});
```

**File**: `src/connectors/postgres/index.ts` (modified, +9/-3)
```diff
@@ -26,6 +26,8 @@ import { splitSQLStatements } from "../../utils/sql-parser.js";
 import { FailedToReadCertificate } from "./failed-to-read-certificate.js";
 import { closeQuietly } from "../../utils/resource-cleanup.js";
 
+const POSTGRES_CLIENT_QUERY_TIMEOUT_GRACE_MS = 5_000;
+
 /**
  * PostgreSQL DSN Parser
  * Handles DSN strings like: postgres://user:password@localhost:5432/dbname?sslmode=disable
@@ -113,10 +115,14 @@ class PostgresDSNParser implements DSNParser {
         poolConfig.connectionTimeoutMillis = connectionTimeoutSeconds * 1000;
       }
 
-      // Apply query timeout if specified (client-side timeout)
+      // Apply the configured limit on the server so a timed-out statement does
+      // not keep running after DBHub stops waiting for it. Retain the client-side
+      // timeout as a fallback, with enough grace for PostgreSQL's cancellation
+      // response to arrive first.
       if (queryTimeoutSeconds !== undefined) {
-        // pg library expects query_timeout in milliseconds
-        poolConfig.query_timeout = queryTimeoutSeconds * 1000;
+        const queryTimeoutMs = queryTimeoutSeconds * 1000;
+        poolConfig.statement_timeout = queryTimeoutMs;
+        poolConfig.query_timeout = queryTimeoutMs + POSTGRES_CLIENT_QUERY_TIMEOUT_GRACE_MS;
       }
 
       return poolConfig;
```

---

### Incident Patch 15: `08d98b30` (2026-09-01)
**Commit Message**: fix(frontend): make workbench Run work over non-localhost HTTP (#414)

crypto.randomUUID is only exposed in secure contexts (HTTPS or
localhost), so opening the workbench by IP from a remote machine made
every query fail with "crypto.randomUUID is not a function". Route the
three id call sites through a generateId helper that falls back to
building a v4 UUID from crypto.getRandomValues, which is available in
insecure contexts.

Fixes #413


Claude-Session: https://claude.ai/code/session_01CeoyVWAJhRngvgvQvN7jVx

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `frontend/src/api/tools.ts` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import { ApiError } from './errors';
+import { generateId } from '../lib/utils';
 
 export interface QueryResult {
   /** Source text of the statement that produced this result, when known. */
@@ -62,7 +63,7 @@ export async function executeTool(
     },
     body: JSON.stringify({
       jsonrpc: '2.0',
-      id: crypto.randomUUID(),
+      id: generateId(),
       method: 'tools/call',
       params: {
         name: toolName,
```

**File**: `frontend/src/components/views/ToolDetailView.tsx` (modified, +3/-2)
```diff
@@ -3,6 +3,7 @@ import { useParams, Navigate, useSearchParams } from 'react-router-dom';
 import { fetchSource } from '../../api/sources';
 import { executeTool, type QueryResult } from '../../api/tools';
 import { ApiError } from '../../api/errors';
+import { generateId } from '../../lib/utils';
 import type { Tool } from '../../types/datasource';
 import { SqlEditor, ParameterForm, RunButton, ResultsTabs, type ResultTab, type SqlEditorHandle } from '../tool';
 import LockIcon from '../icons/LockIcon';
@@ -230,7 +231,7 @@ export default function ToolDetailView() {
       // collapsed into a single tab - only the first tab's time reflects the
       // whole batch's duration, since the others didn't wait separately.
       const newTabs: ResultTab[] = queryResults.map((result, index) => ({
-        id: crypto.randomUUID(),
+        id: generateId(),
         // Offset timestamps so tabs from the same run sort stably and get distinct ids/keys.
         timestamp: new Date(timestamp.getTime() + index),
         result,
@@ -244,7 +245,7 @@ export default function ToolDetailView() {
       setActiveTabId(newTabs[0].id);
     } catch (err) {
       const errorTab: ResultTab = {
-        id: crypto.randomUUID(),
+        id: generateId(),
         timestamp: new Date(),
         result: null,
         error: err instanceof Error ? err.message : 'Query failed',
```

**File**: `frontend/src/lib/utils.ts` (modified, +14/-0)
```diff
@@ -4,3 +4,17 @@ import { twMerge } from 'tailwind-merge'
 export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs))
 }
+
+// crypto.randomUUID is only exposed in secure contexts (HTTPS or localhost),
+// so fall back to building a v4 UUID from getRandomValues when the workbench
+// is served over plain HTTP from a remote host.
+export function generateId(): string {
+  if (typeof crypto.randomUUID === 'function') {
+    return crypto.randomUUID()
+  }
+  const bytes = crypto.getRandomValues(new Uint8Array(16))
+  bytes[6] = (bytes[6] & 0x0f) | 0x40
+  bytes[8] = (bytes[8] & 0x3f) | 0x80
+  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
+  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
+}
```

#### Recent Merged Pull Requests:
- **PR #451** (2026-10-02): fix(config): reject empty TOML sslmode before DSN fallback (@tsiakoulias)
- **PR #447** (2026-10-01): docs: point CLAUDE.md at src/connectors/interface.ts (@roli-lpci)
- **PR #444** (closed): fix: cap the row count of LIMIT offset, count instead of its offset (@serhiizghama)
- **PR #443** (2026-10-02): fix(sqlserver): support verify-full TLS mode (@tsiakoulias)
- **PR #442** (2026-09-28): Reject sslrootcert and unknown sslmode values in PostgreSQL DSNs (@tianzhou)
- **PR #441** (2026-09-28): Support sslcert/sslkey client certificate authentication for PostgreSQL (@tianzhou)
- **PR #440** (2026-09-28): Add glama.json to enable claiming the Glama listing (@adela-bytebase)
- **PR #438** (2026-09-21): fix: reload AWS credentials from disk on every RDS IAM token refresh (@tianzhou)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

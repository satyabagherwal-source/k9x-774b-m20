# Forensic Learning Record (Deep Inspection): firecrawl/firecrawl

> **Canonical Artifact**: `07_PROJECT_LEARNING/firecrawl-firecrawl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/firecrawl/firecrawl](https://github.com/firecrawl/firecrawl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:14:04.990Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `firecrawl/firecrawl`
- **Description**: Supercharge your AI agents with data from the web and beyond. Building the library for superintelligence. 🔥
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 188843 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/api/native/src/utils.rs`
```
use napi::bindgen_prelude::*;

pub fn to_napi_err<E: std::fmt::Display>(error: E) -> Error {
  Error::new(Status::GenericFailure, error.to_string())
}

```

### Core Architecture Module: `apps/api/native/wasi-worker-browser.mjs`
```
import { instantiateNapiModuleSync, MessageHandler, WASI } from '@napi-rs/wasm-runtime'

const handler = new MessageHandler({
  onLoad({ wasmModule, wasmMemory }) {
    const wasi = new WASI({
      print: function () {
        // eslint-disable-next-line no-console
        console.log.apply(console, arguments)
      },
      printErr: function() {
        // eslint-disable-next-line no-console
        console.error.apply(console, arguments)
      },
    })
    return instantiateNapiModuleSync(wasmModule, {
      childThread: true,
      wasi,
      overwriteImports(importObject) {
        importObject.env = {
          ...importObject.env,
          ...importObject.napi,
          ...importObject.emnapi,
          memory: wasmMemory,
        }
      },
    })
  },
})

globalThis.onmessage = function (e) {
  handler.handle(e)
}

```

### Core Architecture Module: `apps/api/src/controllers/v0/admin/check-fire-engine.ts`
```
import { logger } from "../../../lib/logger";
import { config } from "../../../config";
import { Request, Response } from "express";

export async function checkFireEngine(req: Request, res: Response) {
  try {
    if (!config.FIRE_ENGINE_BETA_URL) {
      logger.warn("Fire engine beta URL not configured");
      return res.status(500).json({
        success: false,
        error: "Fire engine beta URL not configured",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const urls = [
      "https://firecrawl-test-site.vercel.app",
      "https://example.com",
    ];
    let lastError: any = null;

    for (const url of urls) {
      try {
        const response = await fetch(`${config.FIRE_ENGINE_BETA_URL}/scrape`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Disable-Cache": "true",
          },
          body: JSON.stringify({
            url,
            engine: "chrome-cdp",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const responseData = await response.json();
          return res.status(200).json({
            data: responseData,
          });
        }
        lastError = `Fire engine returned status ${response.status}`;
      } catch (error) {
        if (error.name === "AbortError") {
          return res.status(504).json({
            success: false,
            error: "Request timed out after 30 seconds",
          });
        }
        lastError = error;
      }
    }

    // If we get here, all retries failed
    logger.error("An error occurred while checking fire-engine", {
      module: "admin",
      method: "checkFireEngine",
      error: lastError,
    });
    return res.status(500).json({
      success: false,
      error: "Internal server error - all retry attempts failed",
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

```

### Core Architecture Module: `apps/api/src/controllers/v0/admin/concurrency-queue-backfill.ts`
```
import { logger as _logger } from "../../../lib/logger";
import { Request, Response } from "express";
import { reconcileConcurrencyQueue } from "../../../lib/concurrency-queue-reconciler";

export async function concurrencyQueueBackfillController(
  req: Request,
  res: Response,
) {
  const logger = _logger.child({
    module: "concurrencyQueueBackfillController",
  });

  logger.info("Starting concurrency queue backfill");

  const teamId =
    typeof req.query.teamId === "string"
      ? (req.query.teamId as string)
      : undefined;
  const summary = await reconcileConcurrencyQueue({
    teamId,
    logger,
  });

  logger.info("Finished backfilling all teams", summary);

  res.json({ ok: true, ...summary });
}

```

### Core Architecture Module: `apps/api/src/controllers/v0/admin/index-queue-prometheus.ts`
```
import type { Request, Response } from "express";
import {
  getIndexInsertQueueLength,
  getOMCEQueueLength,
} from "../../../services";
import { getWebhookInsertQueueLength } from "../../../services/webhook";

export async function indexQueuePrometheus(req: Request, res: Response) {
  const queueLength = await getIndexInsertQueueLength();
  const webhookQueueLength = await getWebhookInsertQueueLength();
  const omceQueueLength = await getOMCEQueueLength();
  res.setHeader("Content-Type", "text/plain");
  res.send(`\
# HELP firecrawl_index_queue_length The number of items in the index insert queue
# TYPE firecrawl_index_queue_length gauge
firecrawl_index_queue_length ${queueLength}
firecrawl_webhook_queue_length ${webhookQueueLength}
firecrawl_omce_queue_length ${omceQueueLength}
`);
}

```

### Core Architecture Module: `apps/api/src/controllers/v1/concurrency-check.ts`
```
import {
  ConcurrencyCheckParams,
  ConcurrencyCheckResponse,
  RequestWithAuth,
} from "./types";
import { Response } from "express";
import { getCombinedTeamActiveCount } from "../../services/worker/nuq-router";
import { getEffectiveConcurrencyLimit } from "../../lib/concurrency-limit";

// Basically just middleware and error wrapping
export async function concurrencyCheckController(
  req: RequestWithAuth<ConcurrencyCheckParams, undefined, undefined>,
  res: Response<ConcurrencyCheckResponse>,
) {
  const activeJobsOfTeam = await getCombinedTeamActiveCount(req.auth.team_id);

  return res.status(200).json({
    success: true,
    concurrency: activeJobsOfTeam,
    maxConcurrency: await getEffectiveConcurrencyLimit(
      req.auth.team_id,
      // acuc is optional on the v1 request; null is the same org-less answer
      // the limit already gave when it could not name one.
      req.acuc?.org_id ?? null,
    ),
  });
}

```

### Core Architecture Module: `apps/api/src/controllers/v1/queue-status.ts`
```
import { RequestWithAuth } from "./types";
import { Response } from "express";
import { redisEvictConnection } from "../../services/redis";
import { isFdbTeam } from "../../services/worker/nuq-router";
import {
  nuqFdbHealthCheck,
  scrapeQueueFdb,
  withFdbTimeout,
} from "../../services/worker/nuq-fdb";
import { logger } from "../../lib/logger";
import {
  cleanOldConcurrencyLimitedJobs,
  cleanOldConcurrencyLimitEntries,
  getConcurrencyLimitActiveJobsCount,
  getConcurrencyQueueJobsCount,
  getEffectiveConcurrencyLimit,
} from "../../lib/concurrency-limit";

type QueueStatusResponse = {
  success: boolean;
  jobsInQueue: number;
  activeJobsInQueue: number;
  waitingJobsInQueue: number;
  maxConcurrency: number;
  mostRecentSuccess: string | null;
};

const FDB_OPTIONAL_COUNT_TIMEOUT_MS = 500;

export async function queueStatusController(
  req: RequestWithAuth<{}, undefined, QueueStatusResponse>,
  res: Response<QueueStatusResponse>,
) {
  await cleanOldConcurrencyLimitEntries(req.auth.team_id);
  let activeJobsOfTeam = await getConcurrencyLimitActiveJobsCount(
    req.auth.team_id,
  );
  await cleanOldConcurrencyLimitedJobs(req.auth.team_id);
  let queuedJobsOfTeam = await getConcurrencyQueueJobsCount(req.auth.team_id);

  // during the FDB migration a team can have load on both ledgers
  if (await isFdbTeam(req.auth.team_id)) {
    try {
      if (await nuqFdbHealthCheck(FDB_OPTIONAL_COUNT_TIMEOUT_MS)) {
        const [fdbActive, fdbPending] = await Promise.all([
          withFdbTimeout(
            scrapeQueueFdb.getTeamActiveCount(req.auth.team_id),
            FDB_OPTIONAL_COUNT_TIMEOUT_MS,
          ),
          withFdbTimeout(
            scrapeQueueFdb.getTeamPendingCount(req.auth.team_id),
            FDB_OPTIONAL_COUNT_TIMEOUT_MS,
          ),
        ]);
        activeJobsOfTeam += fdbActive;
        queuedJobsOfTeam += fdbPending;
      }
    } catch (error) {
      logger.warn("Failed to read FDB queue counts, falling back to Redis", {
        module: "queue-status",
        version: "v1",
        error,
      });
    }
  }

  // most-recent-success is written by the scrape worker via redisEvictConnection
  // (REDIS_EVICT_URL), which is a different instance from getRedisConnection()
  // (REDIS_URL). Read it from the same connection it is written to.
  const mostRecentSuccess = await redisEvictConnection.get(
    "most-recent-success:" + req.auth.team_id,
  );

  return res.status(200).json({
    success: true,

    jobsInQueue: activeJobsOfTeam + queuedJobsOfTeam,
    activeJobsInQueue: activeJobsOfTeam,
    waitingJobsInQueue: queuedJobsOfTeam,
    maxConcurrency: await getEffectiveConcurrencyLimit(
      req.auth.team_id,
      req.acuc?.org_id ?? null,
    ),

    mostRecentSuccess: mostRecentSuccess
      ? new Date(mostRecentSuccess).toISOString()
      : null,
  });
}

```

### Core Architecture Module: `apps/api/src/controllers/v2/concurrency-check.ts`
```
import {
  ConcurrencyCheckParams,
  ConcurrencyCheckResponse,
  RequestWithAuth,
} from "./types";
import { Response } from "express";
import { getCombinedTeamActiveCount } from "../../services/worker/nuq-router";
import { getEffectiveConcurrencyLimit } from "../../lib/concurrency-limit";

// Basically just middleware and error wrapping
export async function concurrencyCheckController(
  req: RequestWithAuth<ConcurrencyCheckParams, undefined, undefined>,
  res: Response<ConcurrencyCheckResponse>,
) {
  if (!req.acuc) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  const activeJobsOfTeam = await getCombinedTeamActiveCount(req.auth.team_id);

  return res.status(200).json({
    success: true,
    concurrency: activeJobsOfTeam,
    maxConcurrency: await getEffectiveConcurrencyLimit(
      req.auth.team_id,
      req.acuc.org_id,
    ),
  });
}

```

### Core Architecture Module: `apps/api/src/controllers/v2/queue-status.ts`
```
import { RequestWithAuth } from "./types";
import { Response } from "express";
import { redisEvictConnection } from "../../services/redis";
import { isFdbTeam } from "../../services/worker/nuq-router";
import {
  nuqFdbHealthCheck,
  scrapeQueueFdb,
  withFdbTimeout,
} from "../../services/worker/nuq-fdb";
import { logger } from "../../lib/logger";
import {
  cleanOldConcurrencyLimitedJobs,
  cleanOldConcurrencyLimitEntries,
  getConcurrencyLimitActiveJobsCount,
  getConcurrencyQueueJobsCount,
  getEffectiveConcurrencyLimit,
} from "../../lib/concurrency-limit";

type QueueStatusResponse = {
  success: boolean;
  jobsInQueue: number;
  activeJobsInQueue: number;
  waitingJobsInQueue: number;
  maxConcurrency: number;
  mostRecentSuccess: string | null;
};

const FDB_OPTIONAL_COUNT_TIMEOUT_MS = 500;

export async function queueStatusController(
  req: RequestWithAuth<{}, undefined, QueueStatusResponse>,
  res: Response<QueueStatusResponse>,
) {
  await cleanOldConcurrencyLimitEntries(req.auth.team_id);
  let activeJobsOfTeam = await getConcurrencyLimitActiveJobsCount(
    req.auth.team_id,
  );
  await cleanOldConcurrencyLimitedJobs(req.auth.team_id);
  let queuedJobsOfTeam = await getConcurrencyQueueJobsCount(req.auth.team_id);

  // during the FDB migration a team can have load on both ledgers
  if (await isFdbTeam(req.auth.team_id)) {
    try {
      if (await nuqFdbHealthCheck(FDB_OPTIONAL_COUNT_TIMEOUT_MS)) {
        const [fdbActive, fdbPending] = await Promise.all([
          withFdbTimeout(
            scrapeQueueFdb.getTeamActiveCount(req.auth.team_id),
            FDB_OPTIONAL_COUNT_TIMEOUT_MS,
          ),
          withFdbTimeout(
            scrapeQueueFdb.getTeamPendingCount(req.auth.team_id),
            FDB_OPTIONAL_COUNT_TIMEOUT_MS,
          ),
        ]);
        activeJobsOfTeam += fdbActive;
        queuedJobsOfTeam += fdbPending;
      }
    } catch (error) {
      logger.warn("Failed to read FDB queue counts, falling back to Redis", {
        module: "queue-status",
        version: "v2",
        error,
      });
    }
  }

  // most-recent-success is written by the scrape worker via redisEvictConnection
  // (REDIS_EVICT_URL), which is a different instance from getRedisConnection()
  // (REDIS_URL). Read it from the same connection it is written to.
  const mostRecentSuccess = await redisEvictConnection.get(
    "most-recent-success:" + req.auth.team_id,
  );

  return res.status(200).json({
    success: true,

    jobsInQueue: activeJobsOfTeam + queuedJobsOfTeam,
    activeJobsInQueue: activeJobsOfTeam,
    waitingJobsInQueue: queuedJobsOfTeam,
    maxConcurrency: await getEffectiveConcurrencyLimit(
      req.auth.team_id,
      req.acuc?.org_id ?? null,
    ),

    mostRecentSuccess: mostRecentSuccess
      ? new Date(mostRecentSuccess).toISOString()
      : null,
  });
}

```

### Core Architecture Module: `apps/api/src/lib/api-key-concurrency.ts`
```
import { eq } from "drizzle-orm";
import { dbRr } from "../db/connection";
import * as schema from "../db/schema";
import { getValue, setValue } from "../services/redis";
import { logger } from "./logger";

// Propagation delay for edits to api_keys.concurrency.
const LIMIT_CACHE_TTL_SECONDS = 60;

const limitCacheKey = (apiKeyId: number) => `api-key-concurrency:${apiKeyId}`;

/**
 * Returns the API-key-scoped concurrency limit (api_keys.concurrency), or
 * null when the key has no limit of its own. Cached for a minute per key.
 *
 * Fails open (null): unlike the IP allowlist this is a throttle, not a
 * security boundary, and a transient DB/cache error must not stall enqueues.
 */
export async function getApiKeyConcurrencyLimit(
  apiKeyId: number,
): Promise<number | null> {
  const cacheKey = limitCacheKey(apiKeyId);

  try {
    const cached = await getValue(cacheKey);
    if (cached !== null) {
      // only the explicit negative-cache sentinel means "no limit"; anything
      // else malformed is a cache miss so a corrupted entry cannot silently
      // disable the key's gate
      if (cached === "none") return null;
      const parsed = Number(cached);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
      logger.warn("Ignoring malformed API key concurrency cache entry", {
        apiKeyId,
      });
    }
  } catch (error) {
    logger.warn("Failed to read API key concurrency cache", {
      apiKeyId,
      error,
    });
  }

  let limit: number | null = null;
  try {
    const [row] = await dbRr
      .select({ concurrency: schema.api_keys.concurrency })
      .from(schema.api_keys)
      .where(eq(schema.api_keys.id, apiKeyId))
      .limit(1);
    limit =
      typeof row?.concurrency === "number" && row.concurrency > 0
        ? row.concurrency
        : null;
  } catch (error) {
    logger.warn("Failed to load API key concurrency limit", {
      apiKeyId,
      error,
    });
    return null;
  }

  try {
    // "none" is a cached negative so unlimited keys skip the DB read too
    await setValue(cacheKey, String(limit ?? "none"), LIMIT_CACHE_TTL_SECONDS);
  } catch (error) {
    logger.warn("Failed to cache API key concurrency limit", {
      apiKeyId,
      error,
    });
  }

  return limit;
}

```

### Core Architecture Module: `apps/api/src/lib/browser-lifecycle.ts`
```
import { z } from "zod";
import { recordRequestCredits } from "./request-credits-store";
import { upsertBrowserProfile } from "./browser-sessions";
import { v7 as uuidv7 } from "uuid";
import { config } from "../config";
import { RequestWithAuth } from "../controllers/v2/types";
import {
  createHangarBrowser,
  getHangarBrowser,
  stopHangarBrowser,
  HangarBrowser,
  HangarError,
} from "./hangar";
import {
  insertBrowserSession,
  completeBrowserSessionSettlement,
  markBrowserSessionUsedPrompt,
  settleBrowserSessionOnce,
  withLockedBrowserSession,
  didBrowserSessionUsePrompt,
  listUnsettledHangarSessions,
  BrowserSessionRow,
} from "./browser-sessions";
import {
  calculateBrowserSessionCredits,
  BROWSER_CREDITS_PER_HOUR,
  INTERACT_CREDITS_PER_HOUR,
} from "./browser-billing";
import {
  getEffectiveConcurrencyLimit,
  HOBBY_CONCURRENCY_LIMIT,
} from "./concurrency-limit";
import {
  reserveExternalSlot,
  mirrorExternalSlotRelease,
} from "../services/worker/nuq-router";
import { autumnService } from "../services/autumn/autumn.service";
import { billTeam } from "../services/billing/credit_billing";
import { orgIdForTeam } from "./team-org";
import { logRequest } from "../services/logging/log_job";
import { externalRequestId } from "./external-request-id";
import {
  updateKeylessBrowserCredits,
  logKeylessCreditUsage,
  KEYLESS_FREE_TIER_LIMIT_MESSAGE,
} from "./keyless";
import { logger as rootLogger } from "./logger";
import { getScrapeZDR } from "./zdr-helpers";
import { withZeroDataRetention } from "./otel-tracer";
import { redlock } from "../services/redlock";
import { redisRateLimitClient } from "../services/rate-limiter";

const logger = rootLogger;

export class BrowserSessionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "BrowserSessionError";
  }
}

/** Returns the effective session policy and rejects disallowed ZDR requests. */
export function getBrowserZDR(
  req: RequestWithAuth<any, any, any>,
  session?: BrowserSessionRow,
  inherited = false,
): boolean {
  const mode = getScrapeZDR(req.acuc?.flags);
  if (
    req.body?.zeroDataRetention === true &&
    mode === "disabled" &&
    !session?.zero_data_retention &&
    !inherited
  ) {
    throw new BrowserSessionError(
      403,
      "Zero Data Retention is not enabled for your team.",
    );
  }
  const enabled =
    mode === "forced" ||
    req.body?.zeroDataRetention === true ||
    inherited ||
    session?.zero_data_retention === true;
  // A running browser may already have recorded or saved customer content.
  if (enabled && session && !session.zero_data_retention) {
    throw new BrowserSessionError(
      409,
      "Create a new ZDR browser session to continue.",
    );
  }
  return enabled;
}

export function browserSessionLinks(session: BrowserSessionRow) {
  return {
    cdpUrl: session.cdp_url,
    liveViewUrl: session.cdp_path ?? "",
    interactiveLiveViewUrl: session.cdp_interactive_path ?? "",
  };
}

/**
 * The 403 every browser entry point returns when the request sent an interop
 * secret that is wrong, or null. Reads the flag authMiddleware set from the
 * raw request, since interact's body parse drops `__agentInterop`.
 */
export function invalidAgentInteropError(
  req: RequestWithAuth<any, any, any>,
): BrowserSessionError | null {
  return req.auth.agentInterop === "invalid"
    ? new BrowserSessionError(403, "Invalid agent interop.")
    : null;
}

export async function createBrowserSession(
  req: RequestWithAuth<any, any, any>,
  options: {
    ttl: number;
    activityTtl: number;
    streamWebView: boolean;
    recordSession: boolean;
    zeroDataRetention?: boolean;
    profile?: { name: string; saveChanges: boolean };
    scrapeId?: string;
    shouldBill?: boolean;
    requestId?: string;
    initialize?: (browserId: string) => Promise<void>;
  },
) {
  const zeroDataRetention =
    getBrowserZDR(req) || options.zeroDataRetention === true;
  if (zeroDataRetention && (options.recordSession || options.profile)) {
    throw new BrowserSessionError(
      400,
      "Recordings and saved profiles are not supported with Zero Data Retention.",
    );
  }
  return withZeroDataRetention(zeroDataRetention, () =>
    createBrowserSessionInternal(req, options, zeroDataRetention),
  );
}

async function createBrowserSessionInternal(
  req: RequestWithAuth<any, any, any>,
  options: Parameters<typeof createBrowserSession>[1],
  zeroDataRetention: boolean,
) {
  const logger = rootLogger.child({ zeroDataRetention });
  if (!config.HANGAR_URL)
    throw new HangarError(
      503,
      "Browser feature is not configured (HANGAR_URL is missing).",
    );
  const invalidInterop = invalidAgentInteropError(req);
  if (invalidInterop) throw invalidInterop;
  const shouldBill = options.shouldBill ?? true;
  const estimatedCredits = shouldBill
    ? calculateBrowserSessionCredits(options.ttl * 1000)
    : 0;
  const teamLimit = await getEffectiveConcurrencyLimit(
    req.auth.team_id,
    req.acuc?.org_id ?? null,
  );
  // An agent run opens browsers against the team's own slots, so a free team
  // (2) is throttled by its own agent. Floor trusted agent traffic at hobby,
  // as the rate limiter does; plans at or above hobby are unchanged.
  const limit =
    req.auth.agentInterop === "trusted"
      ? Math.max(teamLimit, HOBBY_CONCURRENCY_LIMIT)
      : teamLimit;
  if (shouldBill && req.acuc?.org_id) {
    const credit = await autumnService.checkCredits({
      teamId: req.auth.team_id,
      orgId: req.acuc.org_id,
      value: estimatedCredits,
      properties: {
        source: "browserCreate",
        path: req.path,
        apiKeyId: req.acuc?.api_key_id ?? null,
      },
    });
    if (credit !== null && !credit.allowed)
      throw new BrowserSessionError(
        402,
        `Insufficient credits for a ${options.ttl}s browser session (requires ~${estimatedCredits} credits).`,
      );
  }
  const id = uuidv7();
  let browserId: string | undefined;
  try {
    if (
      !(await reserveExternalSlot(
        req.auth.team_id,
        id,
        (options.ttl + 300) * 1000,
        limit,
      ))
    )
      throw new BrowserSessionError(
        429,
        `You have reached the maximum number of concurrent jobs (${limit}).`,
      );
    if (
      !(await updateKeylessBrowserCredits(
        req.auth.team_id,
        id,
        estimatedCredits,
      ))
    )
      throw new BrowserSessionError(429, KEYLESS_FREE_TIER_LIMIT_MESSAGE);
    const browser = await createHangarBrowser(id, req.auth.team_id, options);
    browserId = browser.id;
    if (options.initialize) await options.initialize(browser.id);
    if (!options.requestId)
      await logRequest({
        id,
        kind: options.scrapeId ? "interact" : "browser",
        api_version: "v2",
        external_request_id: externalRequestId(req),
        team_id: req.auth.team_id,
        target_hint: "Browser session",
        origin: req.body?.origin ?? "api",
        integration: req.body?.integration ?? null,
        zeroDataRetention,
        api_key_id: req.acuc?.api_key_id ?? null,
      });
    const session = await insertBrowserSession({
      id,
      team_id: req.auth.team_id,
      request_id: options.requestId ?? id,
      zero_data_retention: zeroDataRetention,
      should_bill: shouldBill,
      scrape_id: options.scrapeId,
      browser_id: browser.id,
      workspace_id: "",
      context_id: zeroDataRetention ? "" : (browser.playlist_url ?? ""),
      cdp_url: browser.cdp_url,
      cdp_path: browser.view_url ?? "",
      cdp_interactive_path: browser.control_url ?? "",
      stream_web_view: options.streamWebView,
      status: "active",
      ttl_total: options.ttl,
      ttl_without_activity: options.activityTtl,
      credits_used: null,
      profile_name: options.profile?.name ?? null,
    });
    return {
      session,
      expiresAt:
        browser.max_expires_at === null
          ? undefined
          : new Date(browser.max_expires_at * 1000).toISOString(),
    };
  } catch (error) {
    if (browserId) await stopHangarBrowser(browserId).catch(() => {});
    await mirrorExternalSlotRelease(req.auth.team_id, id).catch(error =>
      logger.error("Failed to release browser reservation", {
        sessionId: id,
        error,
      }),
    );
    await updateKeylessBrowserCredits(req.auth.team_id, id, 0, true).catch(
      error =>
        logger.error("Failed to refund browser reservation", {
          sessionId: id,
          error,
        }),
    );
    throw error;
  }
}

export async function settleBrowserSession(
  session: BrowserSessionRow,
  browser: HangarBrowser,
) {
  return withZeroDataRetention(session.zero_data_retention, () =>
    settleBrowserSessionInternal(session, browser),
  );
}

async function settleBrowserSessionInternal(
  session: BrowserSessionRow,
  browser: HangarBrowser,
) {
  const logger = rootLogger.child({
    zeroDataRetention: session.zero_data_retention,
  });
  if (browser.status !== "stopped" && browser.status !== "failed") return;
  if (
    !Number.isFinite(browser.ended_at) ||
    !Number.isFinite(browser.created_at) ||
    browser.ended_at! < browser.created_at
  )
    throw new HangarError(
      502,
      "Hangar did not return a valid session duration.",
    );
  if (
    session.profile_name &&
    browser.profile_saved_at &&
    z.uuid().safeParse(session.team_id).success
  ) {
    const savedAt = new Date(browser.profile_saved_at * 1000).toISOString();
    await upsertBrowserProfile({
      teamId: session.team_id,
      name: session.profile_name,
      savedAt,
      sizeBytes: undefined,
    });
  }
  const sessionDurationMs = (browser.ended_at! - browser.created_at) * 1000;
  // The prompt flag is read under the row lock so a concurrent prompt cannot
  // change the rate after it is recorded.
  let usedPrompt = false;
  const { creditsBilled, newlySettled } = await settleBrowserSessi
```

### Core Architecture Module: `apps/api/src/lib/concurrency-limit.ts`
```
import { getRedisConnection } from "../services/queue-service";
import { getCrawl, StoredCrawl } from "./crawl-redis";
import { logger } from "./logger";
import { abTestJob } from "../services/ab-test";
import { scrapeQueue, type NuQJob } from "../services/worker/nuq";
export { QueueFullError } from "./queue-full-error";
export {
  getTeamQueueLimit,
  MAX_BACKLOG_TIMEOUT_MS,
  getConcurrencyLimitActiveJobsCount,
  pushConcurrencyLimitActiveJob,
  removeConcurrencyLimitActiveJob,
} from "./concurrency-redis";
import {
  getTeamQueueLimit,
  MAX_BACKLOG_TIMEOUT_MS,
  constructConcurrencyLimitKey,
  pushConcurrencyLimitActiveJob,
  removeConcurrencyLimitActiveJob,
} from "./concurrency-redis";
import { autumnService } from "../services/autumn/autumn.service";
import { orgIdForTeam } from "./team-org";
import { reportPipelineError } from "./redis-pipeline";

// Fallback when Autumn can't give us a concurrency value.
const DEFAULT_CONCURRENCY_LIMIT = 2;

/**
 * CONCURRENCY granted by the Autumn `hobby` plan (firecrawl-web
 * autumn.config.ts). Pairs with HOBBY_RATE_LIMIT_MULTIPLIER in
 * services/rate-limiter.ts; change both if the hobby plan changes.
 */
export const HOBBY_CONCURRENCY_LIMIT = 5;

/**
 * Returns the team's effective concurrency limit from Autumn's CONCURRENCY
 * balance. Autumn is authoritative; when the entity is missing we fall back to
 * the low default of 2. When Autumn errors, getConcurrencyLimit already returns
 * a high fail-open value, so that carries through here.
 */
export async function getEffectiveConcurrencyLimit(
  teamId: string,
  /** The team's org, from the ACUC the caller already holds. Required so a
   * caller cannot silently omit it and take the high fail-open limit; pass
   * null only when the team genuinely has no org. */
  orgId: string | null,
): Promise<number> {
  const autumnValue = await autumnService.getConcurrencyLimit(teamId, orgId);
  return autumnValue ?? DEFAULT_CONCURRENCY_LIMIT;
}

const constructKey = constructConcurrencyLimitKey;
const constructQueueKey = (team_id: string) =>
  "concurrency-limit-queue:" + team_id;

const constructJobKey = (jobId: string) => "cq-job:" + jobId;

const constructCrawlKey = (crawl_id: string) =>
  "crawl-concurrency-limiter:" + crawl_id;

export async function cleanOldConcurrencyLimitEntries(
  team_id: string,
  now: number = Date.now(),
) {
  await getRedisConnection().zremrangebyscore(
    constructKey(team_id),
    -Infinity,
    now,
  );
}

export async function getConcurrencyLimitActiveJobs(
  team_id: string,
  now: number = Date.now(),
): Promise<string[]> {
  return await getRedisConnection().zrangebyscore(
    constructKey(team_id),
    now,
    Infinity,
  );
}

export async function removeConcurrencyLimitedJobs(
  team_id: string,
  job_ids: string[],
) {
  if (job_ids.length === 0) return;
  const redis = getRedisConnection();
  const queueKey = constructQueueKey(team_id);
  const chunkSize = 1000;
  for (let i = 0; i < job_ids.length; i += chunkSize) {
    const chunk = job_ids.slice(i, i + chunkSize);
    const pipeline = redis.pipeline();
    pipeline.zrem(queueKey, ...chunk);
    for (const id of chunk) {
      pipeline.del(constructJobKey(id));
    }
    // Do not throw on command errors: cancel has already been recorded on
    // the crawl, and the stale entries self-expire via their PX timeout.
    // But never let the failure pass silently.
    reportPipelineError(await pipeline.exec(), logger, {
      module: "concurrency-limit",
      method: "removeConcurrencyLimitedJobs",
      teamId: team_id,
      jobCount: chunk.length,
    });
  }
}

type ConcurrencyLimitedJob = {
  id: string;
  data: any;
  priority: number;
  listenable: boolean;
};

export async function cleanOldConcurrencyLimitedJobs(
  team_id: string,
  now: number = Date.now(),
) {
  await getRedisConnection().zremrangebyscore(
    constructQueueKey(team_id),
    -Infinity,
    now,
  );
}

export async function pushConcurrencyLimitedJob(
  team_id: string,
  job: ConcurrencyLimitedJob,
  timeout: number,
  now: number = Date.now(),
) {
  await pushConcurrencyLimitedJobs(team_id, [{ job, timeout }], now);
}

export async function pushConcurrencyLimitedJobs(
  team_id: string,
  jobs: { job: ConcurrencyLimitedJob; timeout: number }[],
  now: number = Date.now(),
) {
  if (jobs.length === 0) {
    return;
  }

  const queueKey = constructQueueKey(team_id);
  const redis = getRedisConnection();
  const pipeline = redis.pipeline();
  const zaddArgs: (string | number)[] = [];

  for (const { job, timeout } of jobs) {
    const cappedTimeout = Number.isFinite(timeout)
      ? Math.min(timeout, MAX_BACKLOG_TIMEOUT_MS)
      : MAX_BACKLOG_TIMEOUT_MS;
    pipeline.set(
      constructJobKey(job.id),
      JSON.stringify(job),
      "PX",
      cappedTimeout,
    );
    zaddArgs.push(now + cappedTimeout, job.id);
  }

  pipeline.zadd(queueKey, ...zaddArgs);
  pipeline.sadd("concurrency-limit-queues", queueKey);
  // Do not throw on command errors: the jobs are already durable in the
  // NuQ backlog, and the concurrency-queue reconciler requeues anything
  // missing from this derived Redis index on its next run. But never let
  // the failure pass silently.
  reportPipelineError(await pipeline.exec(), logger, {
    module: "concurrency-limit",
    method: "pushConcurrencyLimitedJobs",
    teamId: team_id,
    jobCount: jobs.length,
  });
}

export async function getConcurrencyLimitedJobs(team_id: string) {
  return new Set(
    await getRedisConnection().zrange(constructQueueKey(team_id), 0, -1),
  );
}

export async function getConcurrencyQueueJobsCount(
  team_id: string,
): Promise<number> {
  return await getRedisConnection().zcount(
    constructQueueKey(team_id),
    Date.now(),
    Infinity,
  );
}

async function cleanOldCrawlConcurrencyLimitEntries(
  crawl_id: string,
  now: number = Date.now(),
) {
  await getRedisConnection().zremrangebyscore(
    constructCrawlKey(crawl_id),
    -Infinity,
    now,
  );
}

export async function getCrawlConcurrencyLimitActiveJobs(
  crawl_id: string,
  now: number = Date.now(),
): Promise<string[]> {
  return await getRedisConnection().zrangebyscore(
    constructCrawlKey(crawl_id),
    now,
    Infinity,
  );
}

export async function pushCrawlConcurrencyLimitActiveJob(
  crawl_id: string,
  id: string,
  timeout: number,
  now: number = Date.now(),
) {
  await getRedisConnection().zadd(
    constructCrawlKey(crawl_id),
    now + timeout,
    id,
  );
}

export async function removeCrawlConcurrencyLimitActiveJob(
  crawl_id: string,
  id: string,
) {
  await getRedisConnection().zrem(constructCrawlKey(crawl_id), id);
}

/**
 * Grabs the next job from the team's concurrency limit queue. Handles crawl concurrency limits.
 *
 * This function may only be called once the outer code has verified that the team has not reached its concurrency limit.
 *
 * @param teamId
 * @returns A job that can be run, or null if there are no more jobs to run.
 */
export async function getNextConcurrentJob(teamId: string): Promise<{
  job: ConcurrencyLimitedJob;
  timeout: number;
} | null> {
  const crawlCache = new Map<string, StoredCrawl>();
  const queueKey = constructQueueKey(teamId);
  const redis = getRedisConnection();
  const now = Date.now();

  // Jobs we popped but can't run due to crawl concurrency limits.
  // We'll re-add them at the end so other callers can try them later.
  const crawlBlocked: { member: string; score: number; jobData: string }[] = [];

  try {
    while (true) {
      // ZPOPMIN atomically removes and returns the lowest-scored member.
      // No two workers can ever get the same entry.
      const result = await redis.zpopmin(queueKey);
      if (!result || result.length === 0) return null;

      const [member, scoreStr] = result as [string, string];
      const score = parseFloat(scoreStr);

      // Expired entry - discard
      if (score < now) {
        await redis.del(constructJobKey(member));
        continue;
      }

      const jobData = await redis.get(constructJobKey(member));
      if (jobData === null) {
        // Job key TTL expired - orphaned sorted set entry, already removed by zpopmin
        continue;
      }

      const job: ConcurrencyLimitedJob = JSON.parse(jobData);

      // Check crawl concurrency limit
      if (job.data.crawl_id) {
        const sc =
          crawlCache.get(job.data.crawl_id) ??
          (await getCrawl(job.data.crawl_id));
        if (sc !== null) {
          crawlCache.set(job.data.crawl_id, sc);
        }

        const maxCrawlConcurrency =
          sc === null
            ? null
            : typeof sc.crawlerOptions?.delay === "number" &&
                sc.crawlerOptions.delay > 0
              ? 1
              : (sc.maxConcurrency ?? null);

        if (maxCrawlConcurrency !== null) {
          const currentActiveConcurrency = (
            await getCrawlConcurrencyLimitActiveJobs(job.data.crawl_id)
          ).length;
          if (currentActiveConcurrency >= maxCrawlConcurrency) {
            // Crawl is at its limit - hold this job aside to re-add later
            crawlBlocked.push({ member, score, jobData });
            continue;
          }
        }
      }

      // We got a valid, eligible job
      await redis.del(constructJobKey(member));
      logger.debug("Removed job from concurrency limit queue", {
        teamId,
        jobId: job.id,
        zeroDataRetention: job.data?.zeroDataRetention,
      });
      return { job, timeout: Infinity };
    }
  } finally {
    // Re-add crawl-blocked jobs so they can be picked up later
    if (crawlBlocked.length > 0) {
      const zaddArgs: (string | number)[] = [];
      for (const { member, score } of crawlBlocked) {
        zaddArgs.push(score, member);
      }
      await redis.zadd(queueKey, ...zaddArgs);
    }
  }
}

/**
 * Called when a job associated with a concurrency queue is done.
 *
 * @param job The BullMQ job that is done.
 */
export async function concurrentJobDon
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4938** (2026-10-04): **https://github.com/firecrawl/firecrawl/issues/new/choose[Bug]**
  *Symptoms*: **Describe the Bug** Provide a clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the issue: 1. Configure the environment or settings with '...' 2. Run the command '...' 3. Observe the error or unexpected output at '...' 4. Log output/error message  **Expected Behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots or copies of the command line output to help explain the issue.  **Environment (please complete the following information):** - OS: [e.g. macOS, Linux, Windows] - Deployment Type: [Cloud (firecrawl.dev) / Self-hosted] - Firecrawl Version: [e.g. 1.2.3] - Node.js Version: [e.g. 14.x]  **Logs** If applicable, include detailed logs to help understand the problem.  **Additional Context** Add any other context about the problem here, such as configuration specifics, network conditions, data volumes, etc. 

- **Issue #4595** (2026-09-16): **[Bug] Self-hosted /v1/scrape always times out — scrape jobs appear not to be processed**
  *Symptoms*: **Describe the Bug**  Self-hosted Firecrawl's `POST /v1/scrape` consistently times out, even when scraping `https://example.com`.  The API and Playwright service are reachable and can access the target URL successfully, but `/v1/scrape` creates a scrape job and then waits until it fails with `Request timed out`.  Increasing the request timeout does not resolve the issue.  **To Reproduce**  Steps to reproduce the issue:  1. Clone/build Firecrawl from the repository and start the Docker Compose stack. 2. Ensure the `api`, `playwright-service`, `redis`, `rabbitmq`, and `nuq-postgres` services are running. 3. Run:  ```bash curl --max-time 180 \   -X POST http://127.0.0.1:3002/v1/scrape \   -H 'Content-Type: application/json' \   -d '{"url":"https://example.com","formats":["markdown"]}' ```  4. Observe:  ```json {"success":false,"error":"Request timed out"} ```  Relevant API log output:  ```text NO FLY PROCESS GROUP Web scraper queue created Extraction queue created Index queue created ... Worker 9 started Worker 9 listening on port 3002 ... Scrape 4916c985-61f8-4634-afcb-a935e5bfd1d9 starting ... Error in scrapeController: Error: Job wait {"jobId":"4916c985-61f8-4634-afcb-a935e5bfd1d9","scrapeId":"4916c985-61f8-4634-afcb-a935e5bfd1d9"} ```  **Expected Behavior**  `POST /v1/scrape` should successfully process the scrape job and return the Markdown content for `https://example.com`.  **Screenshots**  Not applicable. Command-line output and logs are included above.  **Environment (p
  **Post-Mortem & Fix Analysis**:
  > ---  Thanks for the extra detail. I haven't been able to reproduce this yet — on a locally-built Docker Compose stack, POST /v1/scrape for example.com succeeds for me:  curl --max-time 180 -X POST http://127.0.0.1:3002/v1/scrape \   -H 'Content-Type: application/json' \   -d '{"url":"https://example.com","formats":["markdown"]}'  {"success":true,"data":{"markdown":"Example Domain\n==============\n\nThis domain is for use in documentation examples without needing permission. Avoid use in operations.\n\n[Learn more](https://iana.org/domains/example)","metadata":{"language":"en","viewport":"width=device-width, initial-scale=1","title":"Example Domain","favicon":"data:,","scrapeId":"01a08b7f-a36e-77a9-af69-a3fbf909d496","sourceURL":"https://example.com","url":"https://example.com","statusCode":200,"contentType":"text/html","proxyUsed":"basic","creditsUsed":1,"concurrencyLimited":false}}}  All five services are up (api, playwright-service, redis, rabbitmq, nuq-postgres), and docker exec <ap

- **Issue #4315** (2026-08-18): **[Bug] `allowExternalLinks` rejects external links that redirect**
  *Symptoms*: **Describe the Bug**  When crawling with `allowExternalLinks: true`, a discovered external URL is rejected with `CRAWL_DENIAL / EXTERNAL_LINK` if it redirects.  The external link is found, but its redirect chain is not followed and the page is omitted from the crawl results.  **To Reproduce**  1. Install the JavaScript SDK and configure `FIRECRAWL_API_KEY`:  ```bash pnpm add @mendable/firecrawl-js@4.31.1 ```  2. Save this as `repro.mjs`:  ```js import Firecrawl from '@mendable/firecrawl-js'; import { setTimeout as delay } from 'node:timers/promises';  const firecrawl = new Firecrawl({   apiKey: process.env.FIRECRAWL_API_KEY });  const { id } = await firecrawl.startCrawl('https://example.org/', {   limit: 2,   maxDiscoveryDepth: 1,   allowExternalLinks: true,   sitemap: 'skip',   scrapeOptions: {     formats: ['markdown']   } });  let status;  do {   await delay(2_000);   status = await firecrawl.getCrawlStatus(id); } while (status.status === 'scraping');  console.log('Job ID:', id); console.log(JSON.stringify(status, null, 2)); console.log(JSON.stringify(await firecrawl.getCrawlErrors(id), null, 2)); ```  3. Run:  ```bash node --env-file=.env repro.mjs ```  4. The crawl completes with only `https://example.org/`. Its external link is returned as a crawl denial:  ```json {   "errors": [     {       "url": "https://iana.org/domains/example",       "code": "CRAWL_DENIAL",       "error": "EXTERNAL_LINK"     }   ],   "robotsBlocked": [] } ```  The external URL has a normal redirec
  **Post-Mortem & Fix Analysis**:
  > @Chadha93 The bug is still present when an admitted external link redirects to a different registrable domain. Using Firecrawl Cloud API v2 with `@mendable/firecrawl-js@4.35.0`, I crawled `https://www.gov.uk/government/publications/national-model-design-code` with a`llowExternalLinks: true`. The page links to `legacy cpni.gov.uk/xyz` content, which redirects to its replacement on `npsa.gov.uk/xyz`. Firecrawl rejects these URLs with `CRAWL_DENIAL / EXTERNAL_LINK` instead of following the redirect and scraping the final content page. Job ID: `01a03aaf-7745-75bb-9ed0-2471c57a2e8e`. PR #4323 fixed redirects within the same registrable domain, but cross-domain redirects remain affected. Because external links are explicitly enabled and the destination is a content page rather than a homepage, I would expect Firecrawl to follow the redirect and scrape the final page once.  ### Why is this a bug?  With `allowExternalLinks: true`, Firecrawl should scrape discovered external pages once and foll

- **Issue #4104** (2026-07-23): **[Bug]  docker-compose.yaml: REDIS_RATE_LIMIT_URL is interpolated from the wrong variable, so setting it has no effect**
  *Symptoms*: ## Describe the Bug  In `docker-compose.yaml`, the shared environment block interpolates `REDIS_RATE_LIMIT_URL` from the wrong variable:  ```yaml x-common-env: &common-env   REDIS_URL: ${REDIS_URL:-redis://redis:6379}   REDIS_RATE_LIMIT_URL: ${REDIS_URL:-redis://redis:6379} # Should interpolate REDIS_RATE_LIMIT_URL ```  `REDIS_RATE_LIMIT_URL` is documented in `.env.example` as a separately configurable setting, and the API reads it as an independent configuration value in:  * `apps/api/src/services/rate-limiter.ts` * `apps/api/src/services/redlock.ts` * `apps/api/src/services/redis.ts` (where it also serves as the fallback for `REDIS_EVICT_URL`)  However, when running via Docker Compose, any value provided for `REDIS_RATE_LIMIT_URL` is silently ignored. The container always receives whatever `REDIS_URL` resolves to.  ---  ## To Reproduce  1. In `.env`, set:     ```env    REDIS_RATE_LIMIT_URL=redis://my-rate-limit-redis:6379    ```     Leave `REDIS_URL` unset (or set it to a different value).  2. Run:     ```bash    docker compose config    ```  3. Observe that the `api` service environment contains:     ```yaml    REDIS_RATE_LIMIT_URL: redis://redis:6379    ```     (or the value of `REDIS_URL`) instead of the configured `REDIS_RATE_LIMIT_URL`.  4. Start the application. The rate limiter Redis client, Redlock, and the `REDIS_EVICT_URL` fallback all connect to the `REDIS_URL` instance instead of the configured rate-limit Redis instance.  ---  ## Expected Behavior  Setting `REDI
  **Post-Mortem & Fix Analysis**:
  > Hi @shwetd19, great catch on this bug! I would love to work on a fix for this. Could you please assign this issue to me? 

- **Issue #3935** (2026-10-01): **[Bug] Support PgUp/PgDn for ingestion numeric inputs**
  *Symptoms*: **Describe the Bug** PgUp and PgDn do not work as expected in the ingestion UI numeric input fields. When focused on fields like Limit or Max depth, pressing these keys does not adjust the numeric value.  **To Reproduce**  1. Open the ingestion UI. 2. Open Advanced Options. 3. Focus the Limit input, or in V0 focus Max depth. 4. Press PgUp or PgDn  **Expected Behavior** PgUp should increase the focused numeric input value, and PgDn should decrease it without going below 0.  **Screenshots**  <img width="1362" height="817" alt="Image" src="https://github.com/user-attachments/assets/de1b4836-89fb-4714-b276-e8883ad9704a" />  <img width="1483" height="832" alt="Image" src="https://github.com/user-attachments/assets/5bba1feb-e108-43e1-82a7-35b83d841a8b" />  **Environment (please complete the following information):**  - OS: Windows - Deployment Type: Local ingestion UI development environment - Firecrawl Version: local monorepo checkout - Node.js Version: not specified  **Logs** If applicable, include detailed logs to help understand the problem.  **Additional Context** This affects:  - V0: Limit, Max depth - V1: Limit

- **Issue #3887** (2026-07-27): **[Bug] "Join our community" link in README points to docs instead of community**
  *Symptoms*: ## Describe the Bug  In the GitHub README, under the **"Why Firecrawl?"** section, the **"join our community"** link points to the Firecrawl documentation instead of the community/Discord page.  ## Steps to Reproduce  1. Open the Firecrawl GitHub README. 2. Navigate to the **"Why Firecrawl?"** section. 3. Click the **"join our community"** link. 4. Notice that it redirects to `docs.firecrawl.dev` instead of the community or Discord page.  ## Expected Behavior  The **"join our community"** link should direct users to the Firecrawl community (e.g. Discord or the official community page).  ## Actual Behavior  The link redirects to the Firecrawl documentation instead.  ## Environment  - OS: macOS - Browser: Chrome (optional) - Firecrawl Version: N/A (README issue)  ## Additional Context  N/A  <img width="1440" height="900" alt="Image" src="https://github.com/user-attachments/assets/1a42eeca-7920-42c4-9ef1-a1e65da461ca" />
  **Post-Mortem & Fix Analysis**:
  > Nice catch! Fixed in #4016 — the link now points to the Discord community (`https://discord.gg/firecrawl`) instead of the repo.

- **Issue #3876** (2026-06-25): **[Bug] serpapi-python contains malicious code and it is a non-existing package now**
  *Symptoms*: **Describe the Bug** The example code examples/gpt-4.1-company-researcher/requirements.txt:3 contains a non existing package serpapi-python  **To Reproduce**  Install dependencies will hit error.  https://osv.dev/vulnerability/MAL-2026-702  **Expected Behavior** This is an old example maybe just remove it  
  **Post-Mortem & Fix Analysis**:
  > Thanks!

- **Issue #3857** (2026-06-23): **[Bug]**
  *Symptoms*: **Describe the Bug** Provide a clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the issue: 1. Configure the environment or settings with '...' 2. Run the command '...' 3. Observe the error or unexpected output at '...' 4. Log output/error message  **Expected Behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots or copies of the command line output to help explain the issue.  **Environment (please complete the following information):** - OS: [e.g. macOS, Linux, Windows] - Deployment Type: [Cloud (firecrawl.dev) / Self-hosted] - Firecrawl Version: [e.g. 1.2.3] - Node.js Version: [e.g. 14.x]  **Logs** If applicable, include detailed logs to help understand the problem.  **Additional Context** Add any other context about the problem here, such as configuration specifics, network conditions, data volumes, etc.

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

### Incident Patch 1: `d0fbd993` (2026-10-05)
**Commit Message**: fix(security): resolve pnpm audit failures (#4947)

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>

**File**: `apps/api/audit-ci.jsonc` (modified, +8/-1)
```diff
@@ -16,6 +16,13 @@
         "GHSA-mwp4-54f8-5fhr",
         "GHSA-rpw4-54j3-4h4q",
         "GHSA-j6r3-76f7-8jcv",
-        "GHSA-h3mg-xc3c-68pw"
+        "GHSA-h3mg-xc3c-68pw",
+        // GHSA-vfj7-8cjw-p6xm (braces):
+        // Latest published braces is 3.0.3; advisory range is <=3.0.3 and
+        // no 3.0.4+ exists on npm. Same-major knip 5.x still resolves
+        // 3.0.3 via fast-glob/micromatch. Cannot override to a
+        // non-existent version. Owner: team-engineering-reviewers.
+        // Tracking: create internal ticket. Expires: 2026-10-17.
+        "GHSA-vfj7-8cjw-p6xm"
     ]
 }
```

**File**: `apps/js-sdk/firecrawl/audit-ci.jsonc` (modified, +10/-1)
```diff
@@ -1,4 +1,13 @@
 {
     "$schema": "https://github.com/IBM/audit-ci/raw/main/docs/schema.json",
-    "low": true
+    "low": true,
+    "allowlist": [
+        // GHSA-vfj7-8cjw-p6xm (braces):
+        // Latest published braces is 3.0.3; advisory range is <=3.0.3 and
+        // no 3.0.4+ exists on npm. Same-major jest 30.x still resolves
+        // 3.0.3 via micromatch. Cannot override to a non-existent version.
+        // Owner: team-engineering-reviewers. Tracking: create internal ticket.
+        // Expires: 2026-10-17.
+        "GHSA-vfj7-8cjw-p6xm"
+    ]
 }
```

**File**: `apps/test-site/pnpm-lock.yaml` (modified, +5/-4)
```diff
@@ -20,6 +20,7 @@ overrides:
   esbuild@>=0.17.0 <0.28.1: 0.28.1
   svgo@>=4.0.0 <4.1.0: 4.1.0
   sharp@<0.35.4: 0.35.4
+  http-cache-semantics@>=4.0.0 <5.0.0: 4.3.0
 
 importers:
 
@@ -1093,8 +1094,8 @@ packages:
   html-void-elements@3.0.0:
     resolution: {integrity: sha512-bEqo66MRXsUGxWHV5IP0PUiAWwoEjba4VCzg0LjFJBpchPaTfyfCKTG6bc5F8ucKec3q5y6qOdGyYTSBEvhCrg==}
 
-  http-cache-semantics@4.2.0:
-    resolution: {integrity: sha512-dTxcvPXqPvXBQpq5dUr6mEMJX4oIEFv6bwom3FDwKRDsuIjjJGANqhBuoAn9c1RQJIdAKav33ED65E2ys+87QQ==}
+  http-cache-semantics@4.3.0:
+    resolution: {integrity: sha512-M5t5LlJpS1UHMjvwRQVdFHvPISGeLAxNcrWuJkeGh0KxsqCHZ1O3NXZU/8x7cD0BDcGW8kapxMKTvwlqrNkHkA==}
 
   inline-style-parser@0.2.7:
     resolution: {integrity: sha512-Nb2ctOyNR8DqQoR0OwRG95uNWIC0C1lCgf5Naz5H6Ji72KZ8OcFZLz2P5sNgwlyoJ8Yif11oMuYs5pBQa86csA==}
@@ -2554,7 +2555,7 @@ snapshots:
       get-tsconfig: 5.0.0-beta.4
       github-slugger: 2.0.0
       html-escaper: 3.0.3
-      http-cache-semantics: 4.2.0
+      http-cache-semantics: 4.3.0
       js-yaml: 4.3.2
       jsonc-parser: 3.3.1
       magic-string: 1.2.3
@@ -3005,7 +3006,7 @@ snapshots:
 
   html-void-elements@3.0.0: {}
 
-  http-cache-semantics@4.2.0: {}
+  http-cache-semantics@4.3.0: {}
 
   inline-style-parser@0.2.7: {}
 
```

**File**: `apps/test-site/pnpm-workspace.yaml` (modified, +3/-0)
```diff
@@ -21,3 +21,6 @@ overrides:
   "esbuild@>=0.17.0 <0.28.1": "0.28.1"
   "svgo@>=4.0.0 <4.1.0": "4.1.0"
   "sharp@<0.35.4": "0.35.4"
+  # GHSA-ch52-4w7c-c8xp: pin the 4.x line only. Exact 4.3.0 cannot
+  # resolve to 5.x.
+  "http-cache-semantics@>=4.0.0 <5.0.0": "4.3.0"
```

**File**: `apps/test-suite/audit-ci.jsonc` (modified, +8/-1)
```diff
@@ -8,6 +8,13 @@
         // Do not override across majors without compatibility approval.
         // Owner: team-engineering-reviewers. Tracking: create internal ticket.
         // Expires: 2026-10-08.
-        "GHSA-8cw4-87c7-c6xx"
+        "GHSA-8cw4-87c7-c6xx",
+        // GHSA-vfj7-8cjw-p6xm (braces):
+        // Latest published braces is 3.0.3; advisory range is <=3.0.3 and
+        // no 3.0.4+ exists on npm. artillery 2.x still resolves 3.0.3 via
+        // chokidar 3.x. Cannot override to a non-existent version.
+        // Owner: team-engineering-reviewers. Tracking: create internal ticket.
+        // Expires: 2026-10-17.
+        "GHSA-vfj7-8cjw-p6xm"
     ]
 }
```

**File**: `apps/test-suite/pnpm-lock.yaml` (modified, +5/-4)
```diff
@@ -28,6 +28,7 @@ overrides:
   '@grpc/grpc-js@>=1.14.0 <2.0.0': 1.14.5
   '@opentelemetry/core@>=2.0.0 <2.8.0': 2.8.0
   fflate@<0.8.2: 0.8.3
+  http-cache-semantics@>=4.0.0 <5.0.0: 4.3.0
 
 importers:
 
@@ -1224,8 +1225,8 @@ packages:
   htmlparser2@10.1.0:
     resolution: {integrity: sha512-VTZkM9GWRAtEpveh7MSF6SjjrpNVNNVJfFup7xTY3UpFtm67foy9HDVXneLtFVt4pMz5kZtgNcvCniNFb1hlEQ==}
 
-  http-cache-semantics@4.2.0:
-    resolution: {integrity: sha512-dTxcvPXqPvXBQpq5dUr6mEMJX4oIEFv6bwom3FDwKRDsuIjjJGANqhBuoAn9c1RQJIdAKav33ED65E2ys+87QQ==}
+  http-cache-semantics@4.3.0:
+    resolution: {integrity: sha512-M5t5LlJpS1UHMjvwRQVdFHvPISGeLAxNcrWuJkeGh0KxsqCHZ1O3NXZU/8x7cD0BDcGW8kapxMKTvwlqrNkHkA==}
 
   http-proxy-agent@7.0.2:
     resolution: {integrity: sha512-T1gkAiYYDWYx3V5Bmyu7HcfcvL7mUrTWiM6yOfa3PIphViJ/gFPbvidQ+veqSOHci/PxBcDabeUNCzpOODJZig==}
@@ -3006,7 +3007,7 @@ snapshots:
     dependencies:
       '@types/http-cache-semantics': 4.2.0
       get-stream: 9.0.1
-      http-cache-semantics: 4.2.0
+      http-cache-semantics: 4.3.0
       keyv: 5.6.0
       mimic-response: 4.0.0
       normalize-url: 8.1.1
@@ -3448,7 +3449,7 @@ snapshots:
       domutils: 3.2.2
       entities: 7.0.1
 
-  http-cache-semantics@4.2.0: {}
+  http-cache-semantics@4.3.0: {}
 
   http-proxy-agent@7.0.2:
     dependencies:
```

**File**: `apps/test-suite/pnpm-workspace.yaml` (modified, +3/-0)
```diff
@@ -34,3 +34,6 @@ overrides:
   "@grpc/grpc-js@>=1.14.0 <2.0.0": "1.14.5"
   "@opentelemetry/core@>=2.0.0 <2.8.0": "2.8.0"
   "fflate@<0.8.2": "0.8.3"
+  # GHSA-ch52-4w7c-c8xp: pin the 4.x line only. Exact 4.3.0 cannot
+  # resolve to 5.x.
+  "http-cache-semantics@>=4.0.0 <5.0.0": "4.3.0"
```

**File**: `apps/ui/ingestion-ui/audit-ci.jsonc` (modified, +10/-1)
```diff
@@ -1,4 +1,13 @@
 {
     "$schema": "https://github.com/IBM/audit-ci/raw/main/docs/schema.json",
-    "low": true
+    "low": true,
+    "allowlist": [
+        // GHSA-vfj7-8cjw-p6xm (braces):
+        // Latest published braces is 3.0.3; advisory range is <=3.0.3 and
+        // no 3.0.4+ exists on npm. Same-major tailwindcss 3.x still
+        // resolves 3.0.3 via chokidar/micromatch. Cannot override to a
+        // non-existent version. Owner: team-engineering-reviewers.
+        // Tracking: create internal ticket. Expires: 2026-10-17.
+        "GHSA-vfj7-8cjw-p6xm"
+    ]
 }
\ No newline at end of file
```

---

### Incident Patch 2: `2a1f075f` (2026-10-02)
**Commit Message**: fix(elixir-sdk): keep hand-written code when regenerating from the OpenAPI spec (#4920)

* fix(elixir-sdk): keep hand-written code when regenerating from the OpenAPI spec

* fix(elixir-sdk): save openapi.json only after a successful, changed regeneration

**File**: `.github/workflows/publish-elixir-sdk.yml` (modified, +3/-0)
```diff
@@ -36,6 +36,9 @@ jobs:
       - name: Regenerate from OpenAPI spec
         run: mix run generate.exs
 
+      - name: Test regenerated code
+        run: mix test
+
       - name: Check for changes
         id: check_changes
         run: |
```

**File**: `apps/elixir-sdk/README.md` (modified, +11/-3)
```diff
@@ -112,7 +112,7 @@ response = Firecrawl.scrape_and_extract_from_url!(url: "https://example.com")
 
 ## Regenerating from the OpenAPI Spec
 
-The entire client is auto-generated from the Firecrawl OpenAPI specification. To regenerate after spec changes:
+The client is generated from the Firecrawl OpenAPI specification. To regenerate after spec changes:
 
 ```bash
 mix run generate.exs
@@ -121,13 +121,21 @@ mix run generate.exs
 This will:
 
 1. Fetch the latest OpenAPI JSON from GitHub
-2. Generate all API wrapper functions in `lib/firecrawl.ex`
+2. Generate all API wrapper functions in `lib/firecrawl.ex` and, if the code changed, save the spec it came from as `openapi.json`
 3. Bump the version in `mix.exs` using semver (only if the generated code changed):
    - **Major** bump if public functions were removed (breaking change)
    - **Minor** bump if new public functions were added
    - **Patch** bump for any other changes (signatures, docs, etc.)
 
-Re-running when nothing changed is a no-op — the version is not bumped.
+Re-running when nothing changed is a no-op, and the version is not bumped.
+
+To regenerate without the network, from the vendored spec:
+
+```bash
+FIRECRAWL_OPENAPI_SPEC=openapi.json mix run generate.exs
+```
+
+Hand-written functions live between the `BEGIN HAND-WRITTEN` and `END HAND-WRITTEN` markers in `lib/firecrawl.ex`. The generator copies that region verbatim and skips the spec routes listed in `@hand_written_routes`, so edit code there rather than in generated functions. `mix test` fails if `lib/firecrawl.ex` differs from what the generator produces from `openapi.json`.
 
 ## License
 
```

**File**: `apps/elixir-sdk/generate.exs` (modified, +147/-118)
```diff
@@ -2,17 +2,20 @@
 # generate.exs — Auto-generates the Firecrawl Elixir SDK from the OpenAPI spec.
 #
 # Usage:
-#   mix run generate.exs
+#   mix run generate.exs                                    # fetch the latest spec
+#   FIRECRAWL_OPENAPI_SPEC=openapi.json mix run generate.exs  # offline, from the vendored copy
 #
 # This script:
 # 1. Fetches the Firecrawl v2 OpenAPI JSON spec
 # 2. Parses all endpoints and generates Elixir wrapper functions with NimbleOptions validation
-# 3. Writes lib/firecrawl.ex
-# 4. Bumps the patch version in mix.exs if the generated code changed
+# 3. If the code changed, writes lib/firecrawl.ex (keeping its HAND-WRITTEN region
+#    verbatim) and saves the spec it came from as openapi.json
+# 4. Bumps the version in mix.exs if the generated code changed
 
 defmodule Firecrawl.Generator do
   @openapi_url "https://raw.githubusercontent.com/firecrawl/firecrawl-docs/main/api-reference/v2-openapi.json"
   @output_file "lib/firecrawl.ex"
+  @spec_file "openapi.json"
   @mix_file "mix.exs"
 
   # Operations to exclude from the generated client.
@@ -23,29 +26,50 @@ defmodule Firecrawl.Generator do
     "getHistoricalTokenUsage"
   ])
 
-  # Routes emitted by hand-written template code instead of the spec, so a
-  # spec entry for them never generates a second, untyped definition.
-  @hand_written_routes MapSet.new([{"get", "/parse/formats"}])
+  # Routes implemented in the HAND-WRITTEN region of lib/firecrawl.ex, so a spec
+  # entry for them never generates a second definition.
+  @hand_written_routes MapSet.new([
+    {"get", "/parse/formats"},
+    {"get", "/agent/{jobId}/trace"},
+    {"get", "/search/research/papers"},
+    {"get", "/search/research/papers/{id}"},
+    {"get", "/search/research/papers/{id}/similar"},
+    {"get", "/search/research/github"},
+    {"post", "/monitor"},
+    {"get", "/monitor"},
+    {"get", "/monitor/{monitorId}"},
+    {"patch", "/monitor/{monitorId}"},
+    {"delete", "/monitor/{monitorId}"},
+    {"post", "/monitor/{monitorId}/run"},
+    {"get", "/monitor/{monitorId}/checks"},
+    {"get", "/monitor/{monitorId}/checks/{checkId}"}
+  ])
+
+  @hand_written_begin "  # --- BEGIN HAND-WRITTEN ---"
+  @hand_written_end "  # --- END HAND-WRITTEN ---"
+
+  # NimbleOptions types that deliberately differ from what the spec implies,
+  # keyed by {function name, JSON property}.
+  @type_overrides %{
+    {"start_agent", "effort"} => ~S|{:in, ["low", "medium", "high"]}|
+  }
 
   # The method key becomes the Req function name in generated code, a position
   # no escaping can protect, so anything else stops generation outright.
   @http_methods ~w(get post put patch delete head options)
 
   def run do
     IO.puts("Fetching OpenAPI spec...")
-    {:ok, spec} = fetch_spec()
+    {:ok, raw_spec} = fetch_spec()
+    spec = Jason.decode!(raw_spec)
 
-    IO.puts("Generating client code...")
-    code = generate_module(spec)
+    old_code = File.read!(@output_file)
 
-    old_code =
-      if File.exists?(@output_file) do
-        File.read!(@output_file)
-      else
-        ""
-      end
+    IO.puts("Generating client code...")
+    code = generate_module(spec, hand_written_region(old_code))
 
     if code != old_code do
+      File.write!(@spec_file, raw_spec)
       File.write!(@output_file, code)
       IO.puts("Wrote #{@output_file}")
 
@@ -62,17 +86,15 @@ defmodule Firecrawl.Generator do
     # Set FIRECRAWL_OPENAPI_SPEC to a local file to generate without the network.
     case System.get_env("FIRECRAWL_OPENAPI_SPEC") do
       nil -> fetch_remote_spec()
-      path -> {:ok, path |> File.read!() |> Jason.decode!()}
+      path -> {:ok, File.read!(path)}
     end
   end
 
+  # The body is kept raw so openapi.json stays byte-identical to the published spec.
   defp fetch_remote_spec do
-    case Req.get(@openapi_url) do
-      {:ok, %Req.Response{status: 200, body: body}} when is_map(body) ->
-        {:ok, body}
-
+    case Req.get(@openapi_url, decode_body: false) do
       {:ok, %Req.Response{status: 200, body: body}} when is_binary(body) ->
-        {:ok, Jason.decode!(body)}
+        {:ok, body}
 
       {:ok, %Req.Response{status: status}} ->
         {:error, "HTTP #{status}"}
@@ -86,7 +108,15 @@ defmodule Firecrawl.Generator do
   # Module template
   # ---------------------------------------------------------------------------
 
-  def generate_module(spec) do
+  # Returns the HAND-WRITTEN region of `source`, markers included.
+  def hand_written_region(source) do
+    case String.split(source, [@hand_written_begin, @hand_written_end]) do
+      [_before, inner, _after] -> @hand_written_begin <> inner <> @hand_written_end
+      _ -> raise "#{@output_file} must contain exactly one HAND-WRITTEN region"
+    end
+  end
+
+  def generate_module(spec, hand_written) do
     base_url =
       case get_in(spec, ["servers"]) do
         [%{"url" => url} | _] -> url
@@ -119,11 +149,20 @@ defmodule Firecrawl.Generator do
       |> Enum.map(&generate_
```

**File**: `apps/elixir-sdk/test/generator_test.exs` (modified, +64/-7)
```diff
@@ -160,8 +160,22 @@ defmodule Firecrawl.GeneratorTest do
     end
   end
 
-  describe "get_parse_formats" do
-    test "is emitted once even when the spec declares GET /parse/formats" do
+  describe "regeneration" do
+    @lib_path Path.expand("../lib/firecrawl.ex", __DIR__)
+    @spec_path Path.expand("../openapi.json", __DIR__)
+
+    defp hand_written, do: @lib_path |> File.read!() |> Firecrawl.Generator.hand_written_region()
+
+    test "lib/firecrawl.ex is exactly what generate.exs produces from openapi.json" do
+      spec = @spec_path |> File.read!() |> Jason.decode!()
+      lib = File.read!(@lib_path)
+
+      assert Firecrawl.Generator.generate_module(spec, hand_written()) == lib,
+             "lib/firecrawl.ex drifted from the generator. Edit generate.exs or the " <>
+               "HAND-WRITTEN region, then run: FIRECRAWL_OPENAPI_SPEC=openapi.json mix run generate.exs"
+    end
+
+    test "get_parse_formats is emitted once even when the spec declares GET /parse/formats" do
       spec = %{
         "paths" => %{
           "/parse/formats" => %{
@@ -170,17 +184,60 @@ defmodule Firecrawl.GeneratorTest do
         }
       }
 
-      code = Firecrawl.Generator.generate_module(spec)
+      code = Firecrawl.Generator.generate_module(spec, hand_written())
 
       assert length(Regex.scan(~r/^  def get_parse_formats\(/m, code)) == 1
       assert length(Regex.scan(~r/^  def get_parse_formats!\(/m, code)) == 1
     end
 
-    test "lib/firecrawl.ex carries the generator's hand-written block verbatim" do
-      lib = File.read!(Path.expand("../lib/firecrawl.ex", __DIR__))
-      block = Firecrawl.Generator.parse_formats_code()
+    test "a spec operation that clashes with the HAND-WRITTEN region stops generation" do
+      spec = %{
+        "paths" => %{
+          "/agent/{jobId}/trace-v2" => %{
+            "get" => %{
+              "operationId" => "getAgentTrace",
+              "parameters" => [%{"name" => "jobId", "in" => "path"}]
+            }
+          }
+        }
+      }
+
+      assert_raise RuntimeError, ~r/clash with the HAND-WRITTEN region: get_agent_trace/, fn ->
+        Firecrawl.Generator.generate_module(spec, hand_written())
+      end
+    end
 
-      assert String.contains?(lib, block)
+    test "$ref path parameters become interpolations, never literal holes" do
+      spec = %{
+        "components" => %{"parameters" => %{"ThingId" => %{"name" => "thingId", "in" => "path"}}},
+        "paths" => %{
+          "/things/{thingId}" => %{
+            "get" => %{
+              "operationId" => "getThing",
+              "parameters" => [%{"$ref" => "#/components/parameters/ThingId"}]
+            }
+          }
+        }
+      }
+
+      code = Firecrawl.Generator.generate_module(spec, hand_written())
+
+      assert code =~ ~S|def get_thing(thing_id, opts \\ []) do|
+      assert code =~ ~S|url: "/things/#{thing_id}"|
+    end
+
+    test "a path parameter the spec never declares stops generation" do
+      spec = %{"paths" => %{"/things/{thingId}" => %{"get" => %{"operationId" => "getThing"}}}}
+
+      assert_raise ArgumentError, ~r/unresolved path parameter/, fn ->
+        Firecrawl.Generator.generate_module(spec, hand_written())
+      end
+    end
+
+    test "a lib without a HAND-WRITTEN region is refused" do
+      assert_raise RuntimeError, ~r/exactly one HAND-WRITTEN region/, fn ->
+        Firecrawl.Generator.hand_written_region("defmodule Firecrawl do\nend\n")
+      end
     end
   end
 end
```

---

### Incident Patch 3: `fa74c805` (2026-10-02)
**Commit Message**: fix(js-sdk): guard optional params when resolving origin in v1 methods (#4921)

**File**: `apps/js-sdk/firecrawl/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@mendable/firecrawl-js",
-  "version": "4.42.3",
+  "version": "4.42.4",
   "description": "JavaScript SDK for the Firecrawl API: web scraping, crawling, web search, and scientific literature search over a research paper index of PubMed, bioRxiv, medRxiv and arXiv abstracts",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `apps/js-sdk/firecrawl/src/__tests__/unit/v1/optional-params.test.ts` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
+import axios from "axios";
+import FirecrawlApp from "../../../v1";
+
+const API_URL = "https://api.firecrawl.dev";
+
+class FakeWebSocket {
+  onopen: unknown = null;
+  onmessage: unknown = null;
+  onerror: unknown = null;
+  onclose: unknown = null;
+  close() {}
+}
+
+describe("v1 methods work without params", () => {
+  let app: FirecrawlApp;
+  let posts: Array<{ url: string; data: any }>;
+  const originalWebSocket = (globalThis as any).WebSocket;
+
+  beforeEach(() => {
+    app = new FirecrawlApp({ apiKey: "fc-test", apiUrl: API_URL });
+    posts = [];
+    jest.spyOn(axios, "post").mockImplementation(async (url: string, data?: any) => {
+      posts.push({ url, data });
+      return { status: 200, data: { success: true, id: "job-1", data: [], links: [] } };
+    });
+    jest.spyOn(axios, "get").mockImplementation(async () => ({
+      status: 200,
+      data: { success: true, status: "completed", data: [{ markdown: "ok" }] },
+    }));
+    (globalThis as any).WebSocket = FakeWebSocket;
+  });
+
+  afterEach(() => {
+    jest.restoreAllMocks();
+    (globalThis as any).WebSocket = originalWebSocket;
+  });
+
+  const cases: Array<[string, string, (app: any) => Promise<unknown>]> = [
+    ["scrapeUrl", "/v1/scrape", app => app.scrapeUrl("https://example.com")],
+    ["search", "/v1/search", app => app.search("firecrawl")],
+    ["crawlUrl", "/v1/crawl", app => app.crawlUrl("https://example.com")],
+    ["asyncCrawlUrl", "/v1/crawl", app => app.asyncCrawlUrl("https://example.com")],
+    ["crawlUrlAndWatch", "/v1/crawl", app => app.crawlUrlAndWatch("https://example.com")],
+    ["mapUrl", "/v1/map", app => app.mapUrl("https://example.com")],
+    ["batchScrapeUrls", "/v1/batch/scrape", app => app.batchScrapeUrls(["https://example.com"])],
+    ["asyncBatchScrapeUrls", "/v1/batch/scrape", app => app.asyncBatchScrapeUrls(["https://example.com"])],
+    ["batchScrapeUrlsAndWatch", "/v1/batch/scrape", app => app.batchScrapeUrlsAndWatch(["https://example.com"])],
+    ["extract", "/v1/extract", app => app.extract(["https://example.com"])],
+    ["asyncExtract", "/v1/extract", app => app.asyncExtract(["https://example.com"])],
+    ["deepResearch", "/v1/deep-research", app => app.deepResearch("firecrawl")],
+    ["asyncDeepResearch", "/v1/deep-research", app => app.asyncDeepResearch("firecrawl")],
+    ["__deepResearch", "/v1/deep-research", app => app.__deepResearch("firecrawl")],
+    ["__asyncDeepResearch", "/v1/deep-research", app => app.__asyncDeepResearch("firecrawl")],
+    ["generateLLMsText", "/v1/llmstxt", app => app.generateLLMsText("https://example.com")],
+    ["asyncGenerateLLMsText", "/v1/llmstxt", app => app.asyncGenerateLLMsText("https://example.com")],
+  ];
+
+  test.each(cases)("%s sends the default origin", async (_method, path, call) => {
+    await expect(call(app)).resolves.toBeDefined();
+    expect(posts).toHaveLength(1);
+    expect(posts[0].url).toBe(`${API_URL}${path}`);
+    expect(posts[0].data.origin).toBe(`js-sdk@${app.version}`);
+  });
+
+  test("an mcp origin passed in params is still forwarded", async () => {
+    await app.batchScrapeUrls(["https://example.com"], { origin: "mcp-server" } as any);
+    expect(posts[0].data.origin).toBe("mcp-server");
+  });
+});
```

**File**: `apps/js-sdk/firecrawl/src/v1/index.ts` (modified, +12/-12)
```diff
@@ -726,7 +726,7 @@ export default class FirecrawlApp {
       "Content-Type": "application/json",
       Authorization: `Bearer ${this.apiKey}`,
     } as AxiosRequestHeaders;
-    let jsonData: any = { url, ...params, origin: typeof (params as any).origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
+    let jsonData: any = { url, ...params, origin: typeof (params as any)?.origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
     if (jsonData?.extract?.schema) {
       jsonData = {
         ...jsonData,
@@ -793,7 +793,7 @@ export default class FirecrawlApp {
       lang: params?.lang ?? "en",
       country: params?.country ?? "us",
       location: params?.location,
-      origin: typeof (params as any).origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}`,
+      origin: typeof (params as any)?.origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}`,
       timeout: params?.timeout ?? 60000,
       scrapeOptions: params?.scrapeOptions ?? { formats: [] },
     };
@@ -857,7 +857,7 @@ export default class FirecrawlApp {
     idempotencyKey?: string
   ): Promise<CrawlStatusResponse | ErrorResponse> {
     const headers = this.prepareHeaders(idempotencyKey);
-    let jsonData: any = { url, ...params, origin: typeof (params as any).origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
+    let jsonData: any = { url, ...params, origin: typeof (params as any)?.origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
     try {
       const response: AxiosResponse = await this.postRequest(
         this.apiUrl + `/v1/crawl`,
@@ -886,7 +886,7 @@ export default class FirecrawlApp {
     idempotencyKey?: string
   ): Promise<CrawlResponse | ErrorResponse> {
     const headers = this.prepareHeaders(idempotencyKey);
-    let jsonData: any = { url, ...params, origin: typeof (params as any).origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
+    let jsonData: any = { url, ...params, origin: typeof (params as any)?.origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
     try {
       const response: AxiosResponse = await this.postRequest(
         this.apiUrl + `/v1/crawl`,
@@ -1062,7 +1062,7 @@ export default class FirecrawlApp {
    */
   async mapUrl(url: string, params?: MapParams): Promise<MapResponse | ErrorResponse> {
     const headers = this.prepareHeaders();
-    let jsonData: any = { url, ...params, origin: typeof (params as any).origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
+    let jsonData: any = { url, ...params, origin: typeof (params as any)?.origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
 
     try {
       const response: AxiosResponse = await this.postRequest(
@@ -1101,7 +1101,7 @@ export default class FirecrawlApp {
     maxConcurrency?: number,
   ): Promise<BatchScrapeStatusResponse | ErrorResponse> {
     const headers = this.prepareHeaders(idempotencyKey);
-    let jsonData: any = { urls, webhook, ignoreInvalidURLs, maxConcurrency, ...params, origin: typeof (params as any).origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
+    let jsonData: any = { urls, webhook, ignoreInvalidURLs, maxConcurrency, ...params, origin: typeof (params as any)?.origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
     if (jsonData?.extract?.schema) {
       jsonData = {
         ...jsonData,
@@ -1150,7 +1150,7 @@ export default class FirecrawlApp {
     ignoreInvalidURLs?: boolean,
   ): Promise<BatchScrapeResponse | ErrorResponse> {
     const headers = this.prepareHeaders(idempotencyKey);
-    let jsonData: any = { urls, webhook, ignoreInvalidURLs, ...params, origin: typeof (params as any).origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
+    let jsonData: any = { urls, webhook, ignoreInvalidURLs, ...params, origin: typeof (params as any)?.origin === "string" && (params as any).origin.includes("mcp") ? (params as any).origin : `js-sdk@${this.version}` };
     try {
       const response: AxiosResponse = await this.postRequest(
         this.apiUrl + `/v1/batch/scrape`,
@@ -1314,7 +1314,7 @@ export default class FirecrawlApp {
     try {
       const response: AxiosResponse = await this.postRequest(
         this.apiUrl + `/v1/extract`,
-        { ...jsonData, schema: jsonSchema, origin: ty
```

---

### Incident Patch 4: `0be5955a` (2026-10-02)
**Commit Message**: fix(python-sdk): poll /v1/batch/scrape/{id} in v1 batch_scrape_urls (#4919)

**File**: `apps/python-sdk/firecrawl/__init__.py` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@
     V1ChangeTrackingOptions,
 )
 
-__version__ = "4.46.1"
+__version__ = "4.46.2"
 
 # Define the logger for the Firecrawl project
 logger: logging.Logger = logging.getLogger("firecrawl")
```

**File**: `apps/python-sdk/firecrawl/__tests__/unit/test_v1_batch_scrape_polling.py` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+"""v1 batch_scrape_urls must poll the batch scrape status endpoint; crawl_url keeps polling crawl status."""
+
+import asyncio
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import pytest
+
+from firecrawl.v1.client import (
+    AsyncV1FirecrawlApp,
+    V1BatchScrapeStatusResponse,
+    V1CrawlStatusResponse,
+    V1FirecrawlApp,
+)
+
+API_URL = "https://api.firecrawl.dev"
+
+
+def _page(status, markdown=None, next_url=None):
+    page = {"success": True, "status": status, "completed": 2, "total": 2,
+            "creditsUsed": 2, "expiresAt": "2026-10-01T00:00:00Z",
+            "data": [{"markdown": markdown}] if markdown else []}
+    if next_url:
+        page["next"] = next_url
+    return page
+
+
+def _pages(path):
+    return [
+        _page("scraping"),
+        _page("completed", "a", f"https://evil.example.com{path}?skip=1"),
+        _page("completed", "b"),
+    ]
+
+
+def _expected_urls(path):
+    return [f"{API_URL}{path}", f"{API_URL}{path}", f"{API_URL}{path}?skip=1"]
+
+
+SYNC_JOBS = [
+    ("batch_scrape_urls", lambda app: app.batch_scrape_urls(["https://example.com"]), "/v1/batch/scrape/job-id", V1BatchScrapeStatusResponse),
+    ("crawl_url", lambda app: app.crawl_url("https://example.com"), "/v1/crawl/job-id", V1CrawlStatusResponse),
+]
+
+
+@pytest.mark.parametrize("name, call, path, response_type", SYNC_JOBS, ids=[j[0] for j in SYNC_JOBS])
+def test_sync_waiter_polls_matching_status_endpoint(name, call, path, response_type):
+    app = V1FirecrawlApp(api_key="fc-test-key", api_url=API_URL)
+    start = MagicMock(status_code=200, json=MagicMock(return_value={"success": True, "id": "job-id"}))
+    polls = [MagicMock(status_code=200, json=MagicMock(return_value=p)) for p in _pages(path)]
+
+    with patch("firecrawl.v1.client.requests.post", return_value=start), \
+         patch("firecrawl.v1.client.requests.get", side_effect=polls) as get, \
+         patch("firecrawl.v1.client.time.sleep"):
+        result = call(app)
+
+    assert [c.args[0] for c in get.call_args_list] == _expected_urls(path)
+    assert type(result) is response_type
+    assert [d.markdown for d in result.data] == ["a", "b"]
+
+
+def test_sync_batch_scrape_failure_mentions_batch_scrape():
+    app = V1FirecrawlApp(api_key="fc-test-key", api_url=API_URL)
+    start = MagicMock(status_code=200, json=MagicMock(return_value={"success": True, "id": "job-id"}))
+    failed = MagicMock(status_code=200, json=MagicMock(return_value=_page("failed")))
+
+    with patch("firecrawl.v1.client.requests.post", return_value=start), \
+         patch("firecrawl.v1.client.requests.get", return_value=failed):
+        with pytest.raises(Exception, match="Batch scrape job failed"):
+            app.batch_scrape_urls(["https://example.com"])
+
+
+ASYNC_JOBS = [
+    ("batch_scrape_urls", lambda app: app.batch_scrape_urls(["https://example.com"]), "/v1/batch/scrape/job-id", V1BatchScrapeStatusResponse),
+    ("crawl_url", lambda app: app.crawl_url("https://example.com"), "/v1/crawl/job-id", V1CrawlStatusResponse),
+]
+
+
+@pytest.mark.parametrize("name, call, path, response_type", ASYNC_JOBS, ids=[j[0] for j in ASYNC_JOBS])
+def test_async_waiter_polls_matching_status_endpoint(name, call, path, response_type):
+    app = AsyncV1FirecrawlApp(api_key="fc-test-key", api_url=API_URL)
+    app._async_post_request = AsyncMock(return_value={"success": True, "id": "job-id"})
+    app._async_get_request = AsyncMock(side_effect=_pages(path))
+
+    with patch("firecrawl.v1.client.asyncio.sleep", new=AsyncMock()):
+        result = asyncio.run(call(app))
+
+    assert [c.args[0] for c in app._async_get_request.await_args_list] == _expected_urls(path)
+    assert type(result) is response_type
+    assert [d.markdown for d in result.data] == ["a", "b"]
+
+
+def test_async_batch_scrape_failure_mentions_batch_scrape():
+    app = AsyncV1FirecrawlApp(api_key="fc-test-key", api_url=API_URL)
+    app._async_post_request = AsyncMock(return_value={"success": True, "id": "job-id"})
+    app._async_get_request = AsyncMock(return_value=_page("failed"))
+
+    with pytest.raises(Exception, match="Batch scrape job failed"):
+        asyncio.run(app.batch_scrape_urls(["https://example.com"]))
```

**File**: `apps/python-sdk/firecrawl/v1/client.py` (modified, +36/-23)
```diff
@@ -1579,7 +1579,7 @@ def batch_scrape_urls(
                 id = response.json().get('id')
             except:
                 raise Exception(f'Failed to parse Firecrawl response as JSON.')
-            return self._monitor_job_status(id, headers, poll_interval)
+            return self._monitor_job_status(id, headers, poll_interval, 'batch_scrape')
         else:
             self._handle_error(response, 'start batch scrape job')
 
@@ -2511,24 +2511,29 @@ def _monitor_job_status(
             self,
             id: str,
             headers: Dict[str, str],
-            poll_interval: int) -> V1CrawlStatusResponse:
+            poll_interval: int,
+            job_type: Literal["crawl", "batch_scrape"] = "crawl") -> Union[V1CrawlStatusResponse, V1BatchScrapeStatusResponse]:
         """
-        Monitor the status of a crawl job until completion.
+        Monitor the status of a crawl or batch scrape job until completion.
 
         Args:
-            id (str): The ID of the crawl job.
+            id (str): The ID of the job.
             headers (Dict[str, str]): The headers to include in the status check requests.
             poll_interval (int): Seconds between status checks.
+            job_type (str): "crawl" or "batch_scrape"; selects the status endpoint and response type.
 
         Returns:
-            CrawlStatusResponse: The crawl results if the job is completed successfully.
+            V1CrawlStatusResponse or V1BatchScrapeStatusResponse: The job results if the job is completed successfully.
 
         Raises:
             Exception: If the job fails or an error occurs during status checks.
         """
-        while True:
-            api_url = f'{self.api_url}/v1/crawl/{id}'
+        is_batch = job_type == "batch_scrape"
+        api_url = f'{self.api_url}/v1/batch/scrape/{id}' if is_batch else f'{self.api_url}/v1/crawl/{id}'
+        label = 'Batch scrape' if is_batch else 'Crawl'
+        response_model = V1BatchScrapeStatusResponse if is_batch else V1CrawlStatusResponse
 
+        while True:
             status_response = self._get_request(api_url, headers)
             if status_response.status_code == 200:
                 try:
@@ -2538,7 +2543,7 @@ def _monitor_job_status(
                 if status_data['status'] == 'completed':
                     if 'data' in status_data:
                         data = status_data['data']
-                        while 'next' in status_data:
+                        while status_data.get('next'):
                             if len(status_data['data']) == 0:
                                 break
                             status_response = self._get_request(pin_to_api_origin(self.api_url, status_data['next']), headers)
@@ -2548,16 +2553,16 @@ def _monitor_job_status(
                                 raise Exception(f'Failed to parse Firecrawl response as JSON.')
                             data.extend(status_data.get('data', []))
                         status_data['data'] = data
-                        return V1CrawlStatusResponse(**status_data)
+                        return response_model(**status_data)
                     else:
-                        raise Exception('Crawl job completed but no data was returned')
+                        raise Exception(f'{label} job completed but no data was returned')
                 elif status_data['status'] in ['active', 'paused', 'pending', 'queued', 'waiting', 'scraping']:
                     poll_interval=max(poll_interval,2)
                     time.sleep(poll_interval)  # Wait for the specified interval before checking again
                 else:
-                    raise Exception(f'Crawl job failed or was stopped. Status: {status_data["status"]}')
+                    raise Exception(f'{label} job failed or was stopped. Status: {status_data["status"]}')
             else:
-                self._handle_error(status_response, 'check crawl status')
+                self._handle_error(status_response, f'check {label.lower()} status')
 
     def _handle_error(
             self,
@@ -3885,7 +3890,7 @@ async def batch_scrape_urls(
                 id = response.get('id')
             except:
                 raise Exception(f'Failed to parse Firecrawl response as JSON.')
-            return await self._async_monitor_job_status(id, headers, poll_interval)
+            return await self._async_monitor_job_status(id, headers, poll_interval, 'batch_scrape')
         else:
             self._handle_error(response, 'start batch scrape job')
 
@@ -4330,26 +4335,34 @@ async def check_crawl_status(self, id: str) -> V1CrawlStatusResponse:
 
         return response
 
-    async def _async_monitor_job_status(self, id: str, headers: Dict[str, str], poll_interval: int = 2) -> V1CrawlStatusResponse:
+    async def _async_monitor_job_status(
+            self,
+            id: str,
+            headers: Dict[str, str],
+            poll_interval: int = 2,
+            job_type: Literal["crawl",
```

---

### Incident Patch 5: `7bf45055` (2026-10-02)
**Commit Message**: fix(js-sdk): poll the batch scrape status endpoint in v1 batchScrapeUrls (#4918)

**File**: `apps/js-sdk/firecrawl/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@mendable/firecrawl-js",
-  "version": "4.42.2",
+  "version": "4.42.3",
   "description": "JavaScript SDK for the Firecrawl API: web scraping, crawling, web search, and scientific literature search over a research paper index of PubMed, bioRxiv, medRxiv and arXiv abstracts",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `apps/js-sdk/firecrawl/src/__tests__/unit/v1/batch-scrape-poll.test.ts` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import { describe, test, expect, jest, afterEach, beforeEach } from "@jest/globals";
+import axios from "axios";
+import FirecrawlApp from "../../../v1";
+
+const API_URL = "https://api.firecrawl.dev";
+const API_KEY = "fc-test";
+
+const scrapingPage = () => ({ success: true, status: "scraping", total: 2, completed: 0, data: [] });
+const completedPage = (next: string) => ({
+  success: true,
+  status: "completed",
+  total: 2,
+  completed: 2,
+  expiresAt: "2030-01-01T00:00:00Z",
+  data: [{ markdown: "a" }],
+  next,
+});
+const lastPage = () => ({ success: true, status: "completed", data: [{ markdown: "b" }] });
+
+function mockPoll(path: string, nextOrigin = API_URL) {
+  const sent: string[] = [];
+  let polls = 0;
+  jest.spyOn(axios, "get").mockImplementation(async (url: string) => {
+    sent.push(url);
+    if (new URL(url).searchParams.has("skip")) return { status: 200, data: lastPage() };
+    polls++;
+    return { status: 200, data: polls === 1 ? scrapingPage() : completedPage(`${nextOrigin}${path}?skip=1`) };
+  });
+  return sent;
+}
+
+describe("v1 batch scrape waits on the batch scrape status endpoint", () => {
+  const app = new FirecrawlApp({ apiKey: API_KEY, apiUrl: API_URL });
+
+  beforeEach(() => {
+    jest.spyOn(global, "setTimeout").mockImplementation(((fn: () => void) => {
+      fn();
+      return 0;
+    }) as any);
+  });
+
+  afterEach(() => {
+    jest.restoreAllMocks();
+  });
+
+  test("batchScrapeUrls polls /v1/batch/scrape/{id} and follows pinned next pages", async () => {
+    const post = jest.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { success: true, id: "abc" } });
+    const path = "/v1/batch/scrape/abc";
+    const sent = mockPoll(path, "https://evil.example");
+
+    const res: any = await app.batchScrapeUrls(["https://example.com", "https://example.org"], {});
+
+    expect(post.mock.calls[0][0]).toBe(`${API_URL}/v1/batch/scrape`);
+    expect(sent).toEqual([`${API_URL}${path}`, `${API_URL}${path}`, `${API_URL}${path}?skip=1`]);
+    expect(sent.some(url => url.includes("/v1/crawl/"))).toBe(false);
+    expect(res.status).toBe("completed");
+    expect(res.data).toHaveLength(2);
+  });
+
+  test("batchScrapeUrls reports batch scrape failures as batch scrape errors", async () => {
+    jest.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { success: true, id: "abc" } });
+    const sent: string[] = [];
+    jest.spyOn(axios, "get").mockImplementation(async (url: string) => {
+      sent.push(url);
+      return { status: 200, data: { success: true, status: "failed", data: [] } };
+    });
+
+    await expect(app.batchScrapeUrls(["https://example.com"], {})).rejects.toThrow("Batch scrape job failed or was stopped");
+    expect(sent.every(url => url === `${API_URL}/v1/batch/scrape/abc`)).toBe(true);
+  });
+
+  test("monitorJobStatus still polls /v1/crawl/{id} by default", async () => {
+    const path = "/v1/crawl/abc";
+    const sent = mockPoll(path);
+
+    const res: any = await app.monitorJobStatus("abc", app.prepareHeaders(), 0);
+
+    expect(sent).toEqual([`${API_URL}${path}`, `${API_URL}${path}`, `${API_URL}${path}?skip=1`]);
+    expect(res.data).toHaveLength(2);
+  });
+
+  test("monitorJobStatus polls /v1/batch/scrape/{id} for batch jobs", async () => {
+    const path = "/v1/batch/scrape/abc";
+    const sent = mockPoll(path);
+
+    const res: any = await app.monitorJobStatus("abc", app.prepareHeaders(), 0, "batch");
+
+    expect(sent).toEqual([`${API_URL}${path}`, `${API_URL}${path}`, `${API_URL}${path}?skip=1`]);
+    expect(res.data).toHaveLength(2);
+  });
+});
```

**File**: `apps/js-sdk/firecrawl/src/v1/index.ts` (modified, +12/-9)
```diff
@@ -1128,7 +1128,7 @@ export default class FirecrawlApp {
       );
       if (response.status === 200) {
         const id: string = response.data.id;
-        return this.monitorJobStatus(id, headers, pollInterval);
+        return this.monitorJobStatus(id, headers, pollInterval, "batch");
       } else {
         this.handleError(response, "start batch scrape job");
       }
@@ -1484,26 +1484,29 @@ export default class FirecrawlApp {
   }
 
   /**
-   * Monitors the status of a crawl job until completion or failure.
-   * @param id - The ID of the crawl operation.
+   * Monitors the status of a crawl or batch scrape job until completion or failure.
+   * @param id - The ID of the crawl or batch scrape operation.
    * @param headers - The headers for the request.
    * @param checkInterval - Interval in seconds for job status checks.
-   * @param checkUrl - Optional URL to check the status (used for v1 API)
+   * @param jobType - Which status endpoint to poll. Defaults to `"crawl"`.
    * @returns The final job status or data.
    */
   async monitorJobStatus(
     id: string,
     headers: AxiosRequestHeaders,
-    checkInterval: number
+    checkInterval: number,
+    jobType: "crawl" | "batch" = "crawl"
   ): Promise<CrawlStatusResponse | ErrorResponse> {
+    const statusPath = jobType === "batch" ? "batch/scrape" : "crawl";
+    const jobLabel = jobType === "batch" ? "Batch scrape" : "Crawl";
     let failedTries = 0;
     let networkRetries = 0;
     const maxNetworkRetries = 3;
     
     while (true) {
       try {
         let statusResponse: AxiosResponse = await this.getRequest(
-          `${this.apiUrl}/v1/crawl/${id}`,
+          `${this.apiUrl}/v1/${statusPath}/${id}`,
           headers
         );
         
@@ -1526,7 +1529,7 @@ export default class FirecrawlApp {
               statusData.data = data;
               return statusData;
             } else {
-              throw new FirecrawlError("Crawl job completed but no data was returned", 500);
+              throw new FirecrawlError(`${jobLabel} job completed but no data was returned`, 500);
             }
           } else if (
             ["active", "paused", "pending", "queued", "waiting", "scraping"].includes(statusData.status)
@@ -1537,14 +1540,14 @@ export default class FirecrawlApp {
             );
           } else {
             throw new FirecrawlError(
-              `Crawl job failed or was stopped. Status: ${statusData.status}`,
+              `${jobLabel} job failed or was stopped. Status: ${statusData.status}`,
               500
             );
           }
         } else {
           failedTries++;
           if (failedTries >= 3) {
-            this.handleError(statusResponse, "check crawl status");
+            this.handleError(statusResponse, `check ${jobLabel.toLowerCase()} status`);
           }
         }
       } catch (error: any) {
```

---

### Incident Patch 6: `cdc1e47f` (2026-10-02)
**Commit Message**: js-sdk: fix stale unit tests and run the full unit suite in CI (#4917)

* js-sdk: fix stale unit tests and run the full unit suite in CI

* js-sdk: use fake timers in v1 monitorJobStatus retry test

**File**: `.github/workflows/test-js-sdk.yml` (modified, +2/-4)
```diff
@@ -32,11 +32,9 @@ jobs:
       - name: Install dependencies
         run: pnpm install --frozen-lockfile
         working-directory: ./apps/js-sdk/firecrawl
-      - name: Run selected unit tests
-        run: pnpm exec jest --verbose src/__tests__/unit/v1/next-url-pinning.test.ts src/__tests__/unit/v2/next-url-pinning.test.ts src/__tests__/unit/v2/parse-formats.unit.test.ts
+      - name: Run unit tests
+        run: pnpm run test:unit
         working-directory: ./apps/js-sdk/firecrawl
-        env:
-          NODE_OPTIONS: --experimental-vm-modules
 
   test:
     name: Run tests
```

**File**: `apps/js-sdk/firecrawl/package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "build-and-publish": "pnpm run build && pnpm publish --access public",
     "publish-beta": "pnpm run build && pnpm publish --access public --tag beta",
     "test": "NODE_OPTIONS=--experimental-vm-modules jest --verbose src/__tests__/e2e/v2/*.test.ts --detectOpenHandles",
-    "test:unit": "NODE_OPTIONS=--experimental-vm-modules jest --verbose src/__tests__/unit/v2/*.test.ts"
+    "test:unit": "NODE_OPTIONS=--experimental-vm-modules jest --verbose src/__tests__/unit"
   },
   "repository": {
     "type": "git",
```

**File**: `apps/js-sdk/firecrawl/src/__tests__/unit/v1/monitor-job-status-retry.test.ts` (modified, +84/-131)
```diff
@@ -1,154 +1,107 @@
-import FirecrawlApp from '../../../index';
+import FirecrawlApp from '../../../v1';
 import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
 
+const successResponse = {
+  status: 200,
+  data: { status: 'completed', data: [{ url: 'test.com', markdown: 'test' }] },
+};
+
+function networkError(message: string, code: string) {
+  return Object.assign(new Error(message), { code });
+}
+
+function httpError(message: string, status: number) {
+  return Object.assign(new Error(message), { response: { status, data: { error: message } } });
+}
+
 describe('monitorJobStatus retry logic', () => {
   let app: FirecrawlApp;
-  let originalConsoleWarn: typeof console.warn;
-  
+  let delays: number[];
+
   beforeEach(() => {
     app = new FirecrawlApp({ apiKey: 'test-key', apiUrl: 'https://test.com' });
-    originalConsoleWarn = console.warn;
-    console.warn = jest.fn();
+    delays = [];
+    jest.useFakeTimers();
+    const fakeSetTimeout = globalThis.setTimeout;
+    jest.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
+      delays.push(ms ?? 0);
+      return fakeSetTimeout(fn, ms);
+    }) as any);
   });
 
   afterEach(() => {
-    console.warn = originalConsoleWarn;
-    jest.clearAllMocks();
+    jest.restoreAllMocks();
+    jest.useRealTimers();
   });
 
-  test('should retry on socket hang up error', async () => {
-    const socketHangUpError = new Error('socket hang up') as any;
-    socketHangUpError.code = 'ECONNRESET';
-    
-    const successResponse = {
-      status: 200,
-      data: { status: 'completed', data: [{ url: 'test.com', markdown: 'test' }] }
-    };
-
-    const originalGetRequest = app.getRequest;
-    let callCount = 0;
-    
-    app.getRequest = async function(url: string, headers: any) {
-      callCount++;
-      if (callCount === 1) {
-        throw socketHangUpError;
-      }
-      return successResponse;
-    };
-
-    const result = await app.monitorJobStatus('test-id', {}, 1);
-    
-    expect(callCount).toBe(2);
+  function failFirst(n: number, error: Error, statuses: string[] = []) {
+    let calls = 0;
+    app.getRequest = (async () => {
+      calls++;
+      if (calls <= n) throw error;
+      const status = statuses.shift();
+      return status ? { status: 200, data: { status } } : successResponse;
+    }) as any;
+    return () => calls;
+  }
+
+  async function monitor() {
+    const result = app.monitorJobStatus('test-id', {} as any, 1);
+    result.catch(() => {});
+    await jest.runAllTimersAsync();
+    return result;
+  }
+
+  test.each([
+    ['socket hang up', networkError('socket hang up', 'ECONNRESET')],
+    ['ETIMEDOUT', networkError('timeout', 'ETIMEDOUT')],
+    ['HTTP 408', httpError('Request timeout', 408)],
+    ['HTTP 504', httpError('Gateway timeout', 504)],
+  ])('retries once after a %s error and returns the job data', async (_label, error) => {
+    const calls = failFirst(1, error);
+
+    const result = await monitor();
+
+    expect(calls()).toBe(2);
     expect(result).toEqual(successResponse.data);
-    expect(console.warn).toHaveBeenCalledWith(
-      expect.stringContaining('Network error during job status check (attempt 1/3): socket hang up')
-    );
+    expect(delays).toEqual([1000]);
   });
 
-  test('should retry on ETIMEDOUT error', async () => {
-    const timeoutError = new Error('timeout') as any;
-    timeoutError.code = 'ETIMEDOUT';
-    
-    const successResponse = {
-      status: 200,
-      data: { status: 'completed', data: [{ url: 'test.com', markdown: 'test' }] }
-    };
-
-    const originalGetRequest = app.getRequest;
-    let callCount = 0;
-    
-    app.getRequest = async function(url: string, headers: any) {
-      callCount++;
-      if (callCount === 1) {
-        throw timeoutError;
-      }
-      return successResponse;
-    };
-
-    const result = await app.monitorJobStatus('test-id', {}, 1);
-    
-    expect(callCount).toBe(2);
+  test('uses exponential backoff between retries', async () => {
+    const calls = failFirst(2, networkError('socket hang up', 'ECONNRESET'));
+
+    const result = await monitor();
+
+    expect(calls()).toBe(3);
     expect(result).toEqual(successResponse.data);
+    expect(delays).toEqual([1000, 2000]);
   });
 
-  test('should fail after max retries exceeded', async () => {
-    const socketHangUpError = new Error('socket hang up') as any;
-    socketHangUpError.code = 'ECONNRESET';
-    
-    app.getRequest = async function(url: string, headers: any) {
-      throw socketHangUpError;
-    };
-
-    await expect(app.monitorJobStatus('test-id', {}, 1)).rejects.toThrow('socket hang up');
-    
-    expect(console.warn).toHaveBeenCalledTimes(3);
-  }, 15000);
-
-  test('should not retry on non-retryable errors', async () => {
-    const authError = new Error('Unauthorized') as any;
-    authError.response = { status: 401, data: { error: 'Unauthorized' } };
-    
-    app.getRequest = a
```

**File**: `apps/js-sdk/firecrawl/src/__tests__/unit/v2/scrape.unit.test.ts` (modified, +55/-6)
```diff
@@ -1,11 +1,60 @@
-/**
- * Minimal unit test for v2 scrape (no mocking; sanity check payload path)
- */
+import { describe, test, expect } from "@jest/globals";
+import axios, { type AxiosAdapter } from "axios";
 import { FirecrawlClient } from "../../../v2/client";
 
+const API_URL = "https://api.firecrawl.dev";
+
+function makeClient(apiKey: string) {
+  const client = new FirecrawlClient({ apiKey, apiUrl: API_URL });
+  const sent: Array<{ method?: string; url: string; authorization: unknown; body: unknown }> = [];
+  const adapter: AxiosAdapter = async config => {
+    sent.push({
+      method: config.method,
+      url: axios.getUri(config),
+      authorization: config.headers.Authorization,
+      body: JSON.parse(config.data),
+    });
+    return {
+      data: { success: true, data: { markdown: "# hello" } },
+      status: 200,
+      statusText: "OK",
+      headers: {},
+      config,
+    };
+  };
+  (client as any).http.instance.defaults.adapter = adapter;
+  return { client, sent };
+}
+
 describe("v2.scrape unit", () => {
-  test("constructor requires apiKey", () => {
-    expect(() => new FirecrawlClient({ apiKey: "", apiUrl: "https://api.firecrawl.dev" })).toThrow();
+  test("constructs without an API key and scrapes keyless, without an Authorization header", async () => {
+    const { client, sent } = makeClient("");
+    const doc = await client.scrape(" https://example.com ", { formats: ["markdown"] });
+
+    expect(doc.markdown).toBe("# hello");
+    expect(sent).toHaveLength(1);
+    expect(sent[0]!.method).toBe("post");
+    expect(sent[0]!.url).toBe(`${API_URL}/v2/scrape`);
+    expect(sent[0]!.authorization).toBeUndefined();
+    expect(sent[0]!.body).toEqual({
+      url: "https://example.com",
+      formats: ["markdown"],
+      origin: expect.stringMatching(/^js-sdk@/),
+    });
   });
-});
 
+  test("sends the API key as a bearer token when one is set", async () => {
+    const { client, sent } = makeClient("fc-test");
+    await client.scrape("https://example.com");
+
+    expect(sent).toHaveLength(1);
+    expect(sent[0]!.authorization).toBe("Bearer fc-test");
+  });
+
+  test("rejects an empty URL before sending a request", async () => {
+    const { client, sent } = makeClient("fc-test");
+
+    await expect(client.scrape("  ")).rejects.toThrow("URL cannot be empty");
+    expect(sent).toHaveLength(0);
+  });
+});
```

---

### Incident Patch 7: `28bbead4` (2026-10-01)
**Commit Message**: fix(api): a job id that is not a UUIDv7 is not found, not a Bigtable outage (#4892)

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `apps/api/src/lib/bigtable-row-key.ts` (modified, +9/-0)
```diff
@@ -3,6 +3,15 @@ import crypto from "crypto";
 const UUID_V7 =
   /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 
+/**
+ * Whether `id` could name a row at all. Every Bigtable job row is keyed by a
+ * UUIDv7, so any other id has no row to find: callers answer "not found"
+ * without a read, rather than treating the key error as an outage.
+ */
+export function isUuidV7Id(id: string): boolean {
+  return UUID_V7.test(id);
+}
+
 export function saltedUuidV7RowKey(id: string): string {
   if (!UUID_V7.test(id)) {
     throw new Error(`Expected a UUIDv7 row id, received ${id}`);
```

**File**: `apps/api/src/lib/operational-job-access.test.ts` (modified, +8/-0)
```diff
@@ -88,6 +88,14 @@ describe("operational job access", () => {
     await expect(getScrapeJobAccess(JOB_ID)).resolves.toBeNull();
   });
 
+  it("answers not found for an id that is not a UUIDv7, without reading", async () => {
+    await expect(
+      getScrapeJobAccess("817f931c-89b5-472d-977c-b7061ac3ce1c"),
+    ).resolves.toBeNull();
+    await expect(getCrawlJobAccess("not-a-uuid")).resolves.toBeNull();
+    expect(readApiJobAccess).not.toHaveBeenCalled();
+  });
+
   it("rethrows a failed Bigtable read instead of reporting a missing job", async () => {
     readApiJobAccess.mockRejectedValue(new Error("Bigtable unavailable"));
     await expect(getScrapeJobAccess(JOB_ID)).rejects.toThrow(
```

**File**: `apps/api/src/lib/operational-job-access.ts` (modified, +3/-0)
```diff
@@ -1,3 +1,4 @@
+import { isUuidV7Id } from "./bigtable-row-key";
 import { logger } from "./logger";
 import {
   readApiJobAccess,
@@ -24,6 +25,8 @@ async function resolveOperationalJobAccess(params: {
   id: string;
   kinds: readonly ApiJobKind[];
 }): Promise<OperationalJobAccess | null> {
+  // An id that is not a UUIDv7 names no row: not found, not an outage.
+  if (!isUuidV7Id(params.id)) return null;
   let access: ApiJobAccess | null;
   try {
     access = await readApiJobAccess(params.id);
```

---

### Incident Patch 8: `58d5eef5` (2026-10-01)
**Commit Message**: fix(monitors): reserve credits for previously seen PDF pages (#4889)

* fix(monitors): reserve credits for previously seen PDF pages

* fix(monitors): address credit reservation review findings

**File**: `apps/api/src/__tests__/snips/v2/monitor.test.ts` (modified, +57/-0)
```diff
@@ -3,6 +3,7 @@ import {
   describeIf,
   ALLOW_TEST_SUITE_WEBSITE,
   TEST_SELF_HOST,
+  TEST_SUITE_WEBSITE,
 } from "../lib";
 import {
   idmux,
@@ -31,6 +32,62 @@ describeIf(ALLOW_TEST_SUITE_WEBSITE && !TEST_SELF_HOST)("/v2/monitor", () => {
     });
   }, 10000);
 
+  it(
+    "reserves the known PDF page cost before a repeat monitor run",
+    async () => {
+      const create = await monitorCreateRaw(
+        {
+          name: "PDF reservation monitor",
+          schedule: { cron: "0 * * * *", timezone: "UTC" },
+          targets: [
+            {
+              type: "scrape",
+              urls: [
+                `${TEST_SUITE_WEBSITE}/example-long.pdf?testId=${crypto.randomUUID()}`,
+              ],
+              scrapeOptions: { formats: ["markdown"] },
+            },
+          ],
+          notification: { email: { enabled: false } },
+        },
+        identity,
+      );
+      expect(create.statusCode).toBe(200);
+      const monitorId = create.body.data.id;
+      const runToCompletion = async () => {
+        const run = await monitorRunRaw(monitorId, identity);
+        expect(run.statusCode).toBe(200);
+        let check: any;
+        for (let i = 0; i < 90; i++) {
+          const raw = await monitorCheckRaw(monitorId, run.body.id, identity);
+          expect(raw.statusCode).toBe(200);
+          check = raw.body.data;
+          if (
+            ["completed", "partial", "failed", "skipped_no_credits"].includes(
+              check.status,
+            )
+          )
+            break;
+          await new Promise(resolve => setTimeout(resolve, 1000));
+        }
+        expect(check.status).toBe("completed");
+        return check;
+      };
+      try {
+        const first = await runToCompletion();
+        expect(first.estimatedCredits).toBe(1);
+        expect(first.actualCredits).toBeGreaterThan(1);
+        const second = await runToCompletion();
+        expect(second.estimatedCredits).toBe(first.actualCredits);
+        expect(second.reservedCredits).toBe(first.actualCredits);
+        expect(second.actualCredits).toBe(first.actualCredits);
+      } finally {
+        await monitorDeleteRaw(monitorId, identity);
+      }
+    },
+    3 * scrapeTimeout,
+  );
+
   it("creates, lists, gets, pauses, and deletes a monitor", async () => {
     const create = await monitorCreateRaw(
       {
```

**File**: `apps/api/src/services/monitoring/runner.finalization.test.ts` (modified, +27/-0)
```diff
@@ -169,6 +169,33 @@ describe("monitor check finalization ownership", () => {
     }) as any);
   });
 
+  it("requests the persisted credit estimate and skips the check when its hold is denied", async () => {
+    current.status = "queued";
+    current.autumn_lock_id = null;
+    current.estimated_credits = 1009;
+    vi.mocked(autumnService.lockCredits).mockResolvedValue({
+      status: "denied",
+    });
+    await processMonitorCheckJob({
+      checkId: current.id,
+      monitorId: monitor.id,
+      teamId: monitor.team_id,
+    });
+    expect(autumnService.lockCredits).toHaveBeenCalledWith(
+      expect.objectContaining({
+        value: 1009,
+        lockId: "monitor_check-1",
+      }),
+    );
+    expect(current).toMatchObject({
+      status: "skipped_no_credits",
+      actual_credits: 0,
+      billing_status: "not_applicable",
+    });
+    expect(autumnService.finalizeCreditsLock).not.toHaveBeenCalled();
+    expect(bill).not.toHaveBeenCalled();
+  });
+
   it("settles and schedules a completed check once when another batch retained its running snapshot", async () => {
     await reconcileRunningMonitorChecks();
     await reconcileRunningMonitorChecks();
```

**File**: `apps/api/src/services/monitoring/store.reservation.test.ts` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+import { PgDialect } from "drizzle-orm/pg-core";
+
+const { select, replicaSelect, where, insert, values } = vi.hoisted(() => {
+  const where = vi.fn();
+  const select = vi.fn(() => ({ from: () => ({ where }) }));
+  const replicaSelect = vi.fn(() => ({
+    from: () => ({ where: async () => [] }),
+  }));
+  const values = vi.fn((row: Record<string, unknown>) => ({
+    returning: async () => [row],
+  }));
+  const insert = vi.fn(() => ({ values }));
+  return { select, replicaSelect, where, insert, values };
+});
+
+vi.mock("../../db/connection", () => ({
+  db: { select, insert },
+  dbRr: { select: replicaSelect },
+}));
+vi.mock("../../db/rpc", () => ({ monitoringClaimDueMonitors: vi.fn() }));
+
+import { createMonitorCheck } from "./store";
+import type { MonitorRow } from "./types";
+
+const monitor = {
+  id: "22222222-2222-4222-8222-222222222222",
+  team_id: "11111111-1111-4111-8111-111111111111",
+  targets: [
+    {
+      id: "pdf-target",
+      type: "scrape",
+      urls: ["https://example.com/report.pdf"],
+    },
+  ],
+  goal: "Watch for changes",
+  judge_enabled: true,
+} as MonitorRow;
+
+beforeEach(() => {
+  vi.clearAllMocks();
+  where.mockResolvedValue([]);
+});
+
+describe("monitor check credit reservation", () => {
+  it("reserves primary PDF history even when the replica has not received it", async () => {
+    where.mockResolvedValue([
+      {
+        target_id: "pdf-target",
+        url: "https://example.com/report.pdf",
+        metadata: { numPages: 100, creditsUsed: 1 },
+      },
+    ]);
+    const check = await createMonitorCheck({ monitor, trigger: "scheduled" });
+    expect(select).toHaveBeenCalledTimes(1);
+    expect(replicaSelect).not.toHaveBeenCalled();
+    expect(check.estimated_credits).toBe(101);
+    expect(values).toHaveBeenCalledWith(
+      expect.objectContaining({
+        monitor_id: monitor.id,
+        estimated_credits: 101,
+      }),
+    );
+
+    // Successful, active pages from this monitor/team/current target only.
+    const predicate = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
+    expect(predicate.sql).toContain('"monitor_pages"."monitor_id" =');
+    expect(predicate.sql).toContain('"monitor_pages"."team_id" =');
+    expect(predicate.sql).toContain('"monitor_pages"."is_removed" =');
+    expect(predicate.sql).toContain('"monitor_pages"."last_status" in');
+    expect(predicate.params).toEqual([
+      monitor.id,
+      monitor.team_id,
+      "pdf-target",
+      false,
+      "new",
+      "changed",
+      "same",
+    ]);
+  });
+
+  it("uses the ordinary estimate on a first run with no saved pages", async () => {
+    const check = await createMonitorCheck({ monitor, trigger: "manual" });
+    expect(select).toHaveBeenCalledTimes(1);
+    expect(where).toHaveBeenCalledTimes(1);
+    expect(replicaSelect).not.toHaveBeenCalled();
+    expect(check.estimated_credits).toBe(2);
+  });
+
+  it("does not start a check with an understated estimate when history cannot be read", async () => {
+    where.mockRejectedValue(new Error("database unavailable"));
+    await expect(
+      createMonitorCheck({ monitor, trigger: "scheduled" }),
+    ).rejects.toThrow(
+      "Failed to read previous monitor pages for credit reservation",
+    );
+    expect(insert).not.toHaveBeenCalled();
+  });
+
+  it("does not read PDF history when parsing is disabled", async () => {
+    const unparsed = {
+      ...monitor,
+      targets: [
+        {
+          ...monitor.targets[0],
+          scrapeOptions: { parsers: [] },
+        },
+      ],
+    } as MonitorRow;
+    expect(
+      (await createMonitorCheck({ monitor: unparsed, trigger: "manual" }))
+        .estimated_credits,
+    ).toBe(2);
+    expect(select).not.toHaveBeenCalled();
+  });
+
+  it("keeps search monitors on their flat estimate without reading PDF history", async () => {
+    const search = {
+      ...monitor,
+      targets: [
+        {
+          id: "search-target",
+          type: "search",
+          queries: ["docs"],
+          maxResults: 10,
+          depth: "raw",
+        },
+      ],
+    } as MonitorRow;
+    expect(
+      (await createMonitorCheck({ monitor: search, trigger: "manual" }))
+        .estimated_credits,
+    ).toBe(2);
+    expect(select).not.toHaveBeenCalled();
+  });
+});
```

**File**: `apps/api/src/services/monitoring/store.test.ts` (modified, +109/-0)
```diff
@@ -12,6 +12,115 @@ import type { MonitorTarget } from "./types";
 import { config } from "../../config";
 
 describe("monitoring store credit helpers", () => {
+  describe("reserving credits using previous PDF results", () => {
+    const target: MonitorTarget = {
+      id: "crawl-target",
+      type: "crawl",
+      url: "https://example.com",
+      crawlOptions: { limit: 69 },
+      scrapeOptions: {},
+    };
+    const page = (
+      numPages: unknown,
+      url = "https://example.com/document.pdf",
+    ) => ({
+      target_id: target.id,
+      url,
+      metadata: { numPages },
+    });
+
+    it("covers the 905 PDF pages from the parked 943-credit monitor run", () => {
+      const pdfPageCounts = [
+        2, 103, 22, 328, 50, 2, 133, 84, 60, 1, 3, 3, 55, 4, 5, 2, 2, 3, 2, 2,
+        1, 1, 1, 2, 10, 1, 2, 2, 2, 1, 9, 2, 2, 3,
+      ];
+      // 69 URL credits + 69 judge allowance + 871 additional PDF pages.
+      expect(estimateMonitorCreditsPerRun([target], true)).toBe(138);
+      expect(
+        estimateMonitorCreditsPerRun(
+          [target],
+          true,
+          pdfPageCounts.map(n => page(n)),
+        ),
+      ).toBe(1009);
+    });
+
+    it("keeps the current option costs and allowance for undiscovered URLs", () => {
+      const jsonTarget = {
+        ...target,
+        scrapeOptions: { formats: [{ type: "json" }] },
+      } as MonitorTarget;
+      expect(
+        estimateMonitorCreditsPerRun([jsonTarget], true, [page(100)]),
+      ).toBe(69 * 6 + 99);
+    });
+
+    it("ignores saved pages for removed targets and removed scrape URLs", () => {
+      const scrape: MonitorTarget = {
+        id: target.id,
+        type: "scrape",
+        urls: ["https://example.com/current.pdf"],
+        scrapeOptions: {},
+      };
+      expect(
+        estimateMonitorCreditsPerRun([scrape], false, [
+          page(100),
+          { ...page(200, scrape.urls[0]), target_id: "old-target" },
+          page(10, scrape.urls[0]),
+        ]),
+      ).toBe(10);
+    });
+
+    it("respects the current PDF maxPages limit", () => {
+      const capped = {
+        ...target,
+        scrapeOptions: { parsers: [{ type: "pdf", maxPages: 5 }] },
+      } as MonitorTarget;
+      expect(estimateMonitorCreditsPerRun([capped], false, [page(100)])).toBe(
+        73,
+      );
+    });
+
+    it("does not reserve PDF costs when parsing is disabled", () => {
+      const unparsed = {
+        ...target,
+        scrapeOptions: { parsers: [] },
+      } as MonitorTarget;
+      expect(estimateMonitorCreditsPerRun([unparsed], true, [page(100)])).toBe(
+        138,
+      );
+    });
+
+    it("caps historical PDF URLs to a reduced crawl limit conservatively", () => {
+      const smaller = {
+        ...target,
+        crawlOptions: { limit: 1 },
+      } as MonitorTarget;
+      expect(
+        estimateMonitorCreditsPerRun([smaller], true, [page(10), page(100)]),
+      ).toBe(101);
+    });
+
+    it("includes redaction costs for each additional PDF page", () => {
+      const redacted = {
+        ...target,
+        scrapeOptions: { redactPII: true },
+      } as MonitorTarget;
+      expect(estimateMonitorCreditsPerRun([redacted], false, [page(10)])).toBe(
+        69 + 9 * 5,
+      );
+    });
+
+    it.each([null, undefined, "100", NaN, Infinity, -1, 0, 1.5])(
+      "preserves the baseline for invalid or missing historical page count %s",
+      numPages => {
+        expect(
+          estimateMonitorCreditsPerRun([target], true, [page(numPages)]),
+        ).toBe(138);
+      },
+    );
+  });
+
   it("estimates goal-enabled scrape monitors from scrape option costs", () => {
     const targets: MonitorTarget[] = [
       {
```

**File**: `apps/api/src/services/monitoring/store.ts` (modified, +90/-3)
```diff
@@ -1,11 +1,21 @@
 import { createHash } from "crypto";
 import { v7 as uuidv7 } from "uuid";
-import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
+import {
+  and,
+  asc,
+  count,
+  desc,
+  eq,
+  inArray,
+  isNull,
+  ne,
+  sql,
+} from "drizzle-orm";
 import { db, dbRr } from "../../db/connection";
 import * as schema from "../../db/schema";
 import { monitoringClaimDueMonitors } from "../../db/rpc";
 import { config } from "../../config";
-import { shouldParsePDF } from "../../controllers/v2/types";
+import { getPDFMaxPages, shouldParsePDF } from "../../controllers/v2/types";
 import { isXTwitterUrl } from "../../scraper/scrapeURL/engines/x-twitter/url";
 import {
   getNextMonitorRunAt,
@@ -236,6 +246,9 @@ function estimateTargetPageCount(target: MonitorTarget): number {
 export function estimateMonitorCreditsPerRun(
   targets: MonitorTarget[],
   judgeEnabled: boolean = false,
+  previousPages: Array<
+    Pick<MonitorPageRow, "target_id" | "url" | "metadata">
+  > = [],
 ): number {
   const baseCredits = targets.reduce(
     (sum, target) => sum + estimateTargetBaseCredits(target, judgeEnabled),
@@ -251,7 +264,45 @@ export function estimateMonitorCreditsPerRun(
         0,
       )
     : 0;
-  return baseCredits + judgeCredits;
+  // The base estimate counts URLs, but a PDF bills per document page. Keep
+  // the allowance for new URLs and add the extra pages we already know about.
+  const pdfCredits = targets.reduce((sum, target) => {
+    if (
+      target.type === "search" ||
+      !shouldParsePDF(target.scrapeOptions?.parsers as any)
+    ) {
+      return sum;
+    }
+    const maxPages = getPDFMaxPages(target.scrapeOptions?.parsers as any);
+    const urls = target.type === "scrape" ? new Set(target.urls) : null;
+    const extraPages = previousPages
+      .filter(
+        page => page.target_id === target.id && (!urls || urls.has(page.url)),
+      )
+      .map(page => {
+        const numPages = (page.metadata as MonitorCreditMetadata | null)
+          ?.numPages;
+        if (
+          typeof numPages !== "number" ||
+          !Number.isSafeInteger(numPages) ||
+          numPages <= 1
+        ) {
+          return 0;
+        }
+        return Math.max(0, Math.min(numPages, maxPages ?? numPages) - 1);
+      })
+      .sort((a, b) => b - a)
+      .slice(0, estimateTargetPageCount(target));
+    const creditsPerExtraPage = 1 + (target.scrapeOptions?.redactPII ? 4 : 0);
+    return (
+      sum +
+      extraPages.reduce(
+        (total, pages) => total + pages * creditsPerExtraPage,
+        0,
+      )
+    );
+  }, 0);
+  return baseCredits + judgeCredits + pdfCredits;
 }
 
 export function calculateMonitorCheckActualCreditsFromPages(
@@ -637,9 +688,45 @@ export async function createMonitorCheck(params: {
   scheduledFor?: string | null;
   status?: MonitorCheckRow["status"];
 }): Promise<MonitorCheckRow> {
+  const pdfTargetIds = params.monitor.targets
+    .filter(
+      target =>
+        target.type !== "search" &&
+        shouldParsePDF(target.scrapeOptions?.parsers as any),
+    )
+    .map(target => target.id);
+  const previousPages = pdfTargetIds.length
+    ? await run(
+        () =>
+          // This decides how much balance is held: a lagging replica can hide
+          // pages saved by the previous run and under-reserve known PDF costs.
+          db
+            .select({
+              target_id: schema.monitor_pages.target_id,
+              url: schema.monitor_pages.url,
+              metadata: schema.monitor_pages.metadata,
+            })
+            .from(schema.monitor_pages)
+            .where(
+              and(
+                eq(schema.monitor_pages.monitor_id, params.monitor.id),
+                eq(schema.monitor_pages.team_id, params.monitor.team_id),
+                inArray(schema.monitor_pages.target_id, pdfTargetIds),
+                eq(schema.monitor_pages.is_removed, false),
+                inArray(schema.monitor_pages.last_status, [
+                  "new",
+                  "changed",
+                  "same",
+                ]),
+              ),
+            ),
+        "Failed to read previous monitor pages for credit reservation",
+      )
+    : [];
   const estimated = estimateMonitorCreditsPerRun(
     params.monitor.targets,
     Boolean(params.monitor.judge_enabled) && Boolean(params.monitor.goal),
+    previousPages,
   );
   const [data] = await run(
     () =>
```

---

### Incident Patch 9: `45226206` (2026-09-30)
**Commit Message**: fix(branding): run the in-page branding scan once per page (#4884)

* fix(branding): run the in-page branding scan once per page

The branding script's entry file called extractBrandDesign() when the
bundle loaded, and the wrapper in brandingScript.ts called it again to
return the result, so every branding scrape ran the whole DOM and style
scan twice and threw the first result away. Remove the self-call; the
wrapper's call is the one whose result is used.

A new test runs the bundled script in jsdom and checks it scans the page
once (it saw two scans before this change).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(branding): check the single scan returns a real extraction

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/api/src/__tests__/lib/branding/branding-script-runs-once.test.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import { describe, it, expect } from "vitest";
+import { JSDOM } from "jsdom";
+
+import { getBrandingScript } from "../../../scraper/scrapeURL/engines/fire-engine/brandingScript";
+
+describe("bundled branding script", () => {
+  it("scans the page once and returns the result", () => {
+    const dom = new JSDOM(
+      `<html><head><title>Acme | Home</title><script src="/app.js"></script></head>
+       <body><header><a href="/"><img alt="Acme logo" src="/logo.svg"></a></header>
+       <h1>Acme</h1><p>Hello</p><button>Get started</button></body></html>`,
+      { runScripts: "outside-only", url: "https://acme.test/" },
+    );
+    const window = dom.window as any;
+
+    // Framework detection reads the page's script tags once per scan.
+    let scans = 0;
+    const querySelectorAll = window.Document.prototype.querySelectorAll;
+    window.Document.prototype.querySelectorAll = function (selector: string) {
+      if (selector === "script[src]") scans++;
+      return querySelectorAll.call(this, selector);
+    };
+
+    const result = window.eval(getBrandingScript());
+
+    expect(scans).toBe(1);
+    // A real extraction, not just an object: the brand comes from the title,
+    // and the scan recorded no errors.
+    expect(result?.branding?.brandName).toBe("Acme");
+    expect(result?.branding?.errors).toBeUndefined();
+  });
+});
```

**File**: `apps/api/src/scraper/scrapeURL/engines/fire-engine/branding-script/index.ts` (modified, +0/-5)
```diff
@@ -65,8 +65,3 @@ export const extractBrandDesign = (): BrandingResult => {
     },
   };
 };
-
-// Auto-execute when loaded in browser context (IIFE pattern)
-(function __extractBrandDesign() {
-  return extractBrandDesign();
-})();
```

---

### Incident Patch 10: `76abc3e5` (2026-09-30)
**Commit Message**: fix(branding): stop returning internal fields in the branding response (#4883)

* fix(branding): stop returning internal fields in the branding response

Only four of the internal `__` keys were removed for normal teams; the LLM
reasoning and metadata (`__llm_logo_reasoning`, `__llm_button_reasoning`,
`__llm_metadata`) were returned to everyone. Remove every `__` key unless
branding debugging is on for the team (DEBUG_BRANDING or the debugBranding
team flag), which keeps getting all of them.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(branding): check the stripped branding response still has real content

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/api/src/__tests__/snips/v2/scrape-branding.test.ts` (modified, +25/-0)
```diff
@@ -148,6 +148,31 @@ describe("Branding with Jev", () => {
   );
 });
 
+describe("Branding response", () => {
+  concurrentIf(TEST_PRODUCTION)(
+    "returns no internal fields to teams that aren't debugging branding",
+    async () => {
+      const response = await scrape(
+        {
+          url: "https://firecrawl-test-site.vercel.app/",
+          formats: ["branding"],
+          timeout: scrapeTimeout,
+        },
+        identity,
+      );
+
+      expect(response.branding).toBeDefined();
+      // Still a real extraction, not an empty object.
+      expect(response.branding?.logo).toContain("firecrawl");
+      expect(response.branding?.colors?.primary).toMatch(/^#[0-9A-F]{6}$/);
+      expect(
+        Object.keys(response.branding!).filter(key => key.startsWith("__")),
+      ).toEqual([]);
+    },
+    scrapeTimeout,
+  );
+});
+
 const PDF_URL = "https://www.orimi.com/pdf-test.pdf";
 
 describe("Branding on pages it can't run on", () => {
```

**File**: `apps/api/src/lib/branding/transformer.ts` (modified, +5/-4)
```diff
@@ -457,11 +457,12 @@ export async function brandingTransformer(
     });
   }
 
+  // Every `__` key (page snapshots, logo candidates, LLM reasoning and
+  // metadata) is internal; only teams debugging branding get them back.
   if (!isDebugBrandingEnabled(meta)) {
-    delete (brandingProfile as any).__button_snapshots;
-    delete (brandingProfile as any).__input_snapshots;
-    delete (brandingProfile as any).__logo_candidates;
-    delete (brandingProfile as any).__framework_hints;
+    for (const key of Object.keys(brandingProfile)) {
+      if (key.startsWith("__")) delete (brandingProfile as any)[key];
+    }
   }
 
   if (brandName) {
```

---

### Incident Patch 11: `ae63ff03` (2026-09-30)
**Commit Message**: fix(api): send FirePDF pages_estimate only when it is a positive count (#4885)

fire-pdf accepts only a positive integer for options.pages_estimate. When
the router has no page count it passed 0, which fire-pdf answers with
400 invalid_pages_estimate. The field is now omitted in that case, and
fire-pdf counts the pages itself, as it already does for inline submits
without an estimate.

POST /jobs 400s now go through failAsync as http_400 with fire-pdf's
validation code, so they are counted in
firecrawl_fire_pdf_async_fallback_total alongside the other async exits.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/api/src/scraper/scrapeURL/engines/pdf/__tests__/firePDFAsyncDeadline.test.ts` (modified, +110/-0)
```diff
@@ -15,6 +15,7 @@ import {
 } from "../fire-pdf/async";
 import {
   firePdfAsyncAbandonedTotal,
+  firePdfAsyncFallbackTotal,
   firePdfAsyncSubmit503Total,
   firePdfAsyncSubmitRetriesTotal,
 } from "../fire-pdf/metrics";
@@ -262,6 +263,115 @@ describe("scrapePDFWithFirePDFAsync — deadline and submit lifecycle", () => {
     ).toBe(before + 1);
   });
 
+  it.each([
+    ["a zero page count", 0],
+    ["no estimate at all", undefined],
+  ])(
+    "omits pages_estimate on an inline submit with %s so fire-pdf counts pages itself",
+    async (_name, pagesProcessed) => {
+      const { fetchImpl, calls } = makeFetchFromSequence([
+        {
+          matchUrl: /\/jobs$/,
+          matchMethod: "POST",
+          response: {
+            status: 200,
+            body: { scrape_id: "scrape-id-test", status: "done", lane: "fast" },
+          },
+        },
+        {
+          matchUrl: /\/jobs\/scrape-id-test\/result$/,
+          matchMethod: "GET",
+          response: {
+            status: 200,
+            body: { markdown: "ok", pages_processed: 3 },
+          },
+        },
+      ]);
+
+      const result = await scrapePDFWithFirePDFAsync(
+        makeMeta(),
+        "BASE64",
+        undefined,
+        pagesProcessed,
+        undefined,
+        { fetchImpl, fallbackImpl: vi.fn(), sleepImpl: noopSleep },
+      );
+
+      expect(result.markdown).toBe("ok");
+      const options = (calls[0].body as { options?: Record<string, unknown> })
+        .options;
+      expect(options).not.toHaveProperty("pages_estimate");
+    },
+  );
+
+  it("sends a positive page count as pages_estimate", async () => {
+    const { fetchImpl, calls } = makeFetchFromSequence([
+      {
+        matchUrl: /\/jobs$/,
+        matchMethod: "POST",
+        response: {
+          status: 200,
+          body: { scrape_id: "scrape-id-test", status: "done", lane: "fast" },
+        },
+      },
+      {
+        matchUrl: /\/jobs\/scrape-id-test\/result$/,
+        matchMethod: "GET",
+        response: { status: 200, body: { markdown: "ok", pages_processed: 7 } },
+      },
+    ]);
+
+    await scrapePDFWithFirePDFAsync(
+      makeMeta(),
+      "BASE64",
+      undefined,
+      7,
+      undefined,
+      { fetchImpl, fallbackImpl: vi.fn(), sleepImpl: noopSleep },
+    );
+
+    expect(
+      (calls[0].body as { options: Record<string, unknown> }).options
+        .pages_estimate,
+    ).toBe(7);
+  });
+
+  it("counts a submit 400 as an async fallback and keeps fire-pdf's code", async () => {
+    const before = await counterValue(firePdfAsyncFallbackTotal, {
+      reason: "http_400",
+    });
+    const { fetchImpl, calls } = makeFetchFromSequence([
+      {
+        matchUrl: /\/jobs$/,
+        matchMethod: "POST",
+        response: {
+          status: 400,
+          body: {
+            error: "invalid_pages_estimate",
+            message: "options.pages_estimate must be a positive integer",
+          },
+        },
+      },
+    ]);
+
+    const error = await scrapePDFWithFirePDFAsync(
+      makeMeta(),
+      "BASE64",
+      undefined,
+      undefined,
+      undefined,
+      { fetchImpl, fallbackImpl: vi.fn(), sleepImpl: noopSleep },
+    ).catch(e => e);
+
+    expect(error).toBeInstanceOf(FirePdfAsyncFailure);
+    expect(error.reason).toBe("http_400");
+    expect(error.extra.code).toBe("invalid_pages_estimate");
+    expect(calls).toHaveLength(1);
+    expect(
+      await counterValue(firePdfAsyncFallbackTotal, { reason: "http_400" }),
+    ).toBe(before + 1);
+  });
+
   it("does not retry fire-pdf's own 503 codes", async () => {
     const before = await counterValue(firePdfAsyncSubmit503Total, {
       code: "admission_rejected",
```

**File**: `apps/api/src/scraper/scrapeURL/engines/pdf/fire-pdf/metrics.ts` (modified, +1/-0)
```diff
@@ -87,6 +87,7 @@ export type SubmitRetryTrigger =
 export type AbandonedPhase = "submit" | "poll" | "result";
 
 export type FallbackReason =
+  | "http_400"
   | "http_401"
   | "http_404"
   | "http_410"
```

**File**: `apps/api/src/scraper/scrapeURL/engines/pdf/fire-pdf/submit.ts` (modified, +7/-1)
```diff
@@ -254,7 +254,13 @@ export async function submitJob(args: SubmitArgs): Promise<SubmitOutcome> {
         body: json,
       },
     );
-    throw new Error("fire-pdf async POST /jobs validation error");
+    // Counted like every other exit from the async path, with fire-pdf's
+    // validation code, so 400s appear in the fallback metric.
+    const code =
+      typeof (json as { error?: unknown } | null)?.error === "string"
+        ? (json as { error: string }).error
+        : "unattributed";
+    failAsync(meta, "http_400", { code });
   }
 
   if (status !== 200 && status !== 202) {
```

**File**: `apps/api/src/scraper/scrapeURL/engines/pdf/fire-pdf/utils.ts` (modified, +9/-3)
```diff
@@ -160,9 +160,15 @@ export function buildFirePdfJobOptions(args: {
   pageMarkers: boolean;
 }): Record<string, unknown> {
   return {
-    ...(args.pagesProcessed !== undefined && {
-      pages_estimate: args.pagesProcessed,
-    }),
+    // fire-pdf accepts only a positive integer here. When the router has no
+    // page count (0), the field is left out and fire-pdf counts the pages
+    // itself on inline submits. By-reference submits require a positive
+    // count and check for one before they get here.
+    ...(args.pagesProcessed !== undefined &&
+      Number.isInteger(args.pagesProcessed) &&
+      args.pagesProcessed > 0 && {
+        pages_estimate: args.pagesProcessed,
+      }),
     ...(args.maxPages !== undefined && { max_pages: args.maxPages }),
     ...(args.mode !== undefined && { mode: args.mode }),
     ...(args.includePageMarkdown && { include_page_markdown: true }),
```

---

### Incident Patch 12: `bd83f5d8` (2026-09-30)
**Commit Message**: fix(branding): skip branding on PDFs, documents and images instead of failing the scrape (#4882)

When a page turns out to be a PDF, document or image, branding can't run and
the scrape used to fail with BrandingNotSupportedError, losing the other
formats too (common in crawls with branding on). If the request asked for
other formats, the scrape now drops branding, keeps going, and returns the
rest with a "Branding was skipped: ..." warning. Branding-only requests
still fail with the same error. Self-hosted instances, where branding can
never run, get the same partial result instead of a failure.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/api/src/__tests__/snips/v2/scrape-branding.test.ts` (modified, +73/-2)
```diff
@@ -2,8 +2,21 @@ import {
   type CostTrackingCall,
   getCostTrackingCalls,
 } from "../cost-tracking-helpers";
-import { concurrentIf, HAS_AI, TEST_PRODUCTION } from "../lib";
-import { scrape, scrapeTimeout, idmux, Identity } from "./lib";
+import {
+  ALLOW_TEST_SUITE_WEBSITE,
+  concurrentIf,
+  HAS_AI,
+  TEST_PRODUCTION,
+  TEST_SELF_HOST,
+  TEST_SUITE_WEBSITE,
+} from "../lib";
+import {
+  scrape,
+  scrapeTimeout,
+  scrapeWithFailure,
+  idmux,
+  Identity,
+} from "./lib";
 
 let identity: Identity;
 
@@ -135,6 +148,64 @@ describe("Branding with Jev", () => {
   );
 });
 
+const PDF_URL = "https://www.orimi.com/pdf-test.pdf";
+
+describe("Branding on pages it can't run on", () => {
+  concurrentIf(TEST_PRODUCTION)(
+    "keeps the other formats and warns when the page is a PDF",
+    async () => {
+      const response = await scrape(
+        {
+          url: PDF_URL,
+          formats: ["markdown", "branding"],
+          timeout: scrapeTimeout,
+        },
+        identity,
+      );
+
+      expect(response.markdown?.length).toBeGreaterThan(0);
+      expect(response.branding).toBeUndefined();
+      expect(response.warning).toContain("Branding was skipped");
+    },
+    scrapeTimeout,
+  );
+
+  concurrentIf(TEST_PRODUCTION)(
+    "still fails a branding-only request for a PDF",
+    async () => {
+      const response = await scrapeWithFailure(
+        { url: PDF_URL, formats: ["branding"], timeout: scrapeTimeout },
+        identity,
+      );
+
+      expect(response.error).toContain(
+        "Branding extraction is only supported for HTML web pages",
+      );
+    },
+    scrapeTimeout,
+  );
+
+  // Self-hosted has no fire-engine, so branding can never run there.
+  concurrentIf(TEST_SELF_HOST && ALLOW_TEST_SUITE_WEBSITE)(
+    "keeps the other formats when branding can't run self-hosted",
+    async () => {
+      const response = await scrape(
+        {
+          url: TEST_SUITE_WEBSITE,
+          formats: ["markdown", "branding"],
+          timeout: scrapeTimeout,
+        },
+        identity,
+      );
+
+      expect(response.markdown?.length).toBeGreaterThan(0);
+      expect(response.branding).toBeUndefined();
+      expect(response.warning).toContain("Branding was skipped");
+    },
+    scrapeTimeout,
+  );
+});
+
 // TODO: fix this test
 // Need to run on fire-engine
 describe.skip("Branding extraction", () => {
```

**File**: `apps/api/src/scraper/scrapeURL/index.ts` (modified, +30/-0)
```diff
@@ -1477,6 +1477,7 @@ export async function scrapeURL(
 
       try {
         let result: ScrapeUrlResponse;
+        let brandingSkippedReason: string | undefined;
         while (true) {
           try {
             result = await scrapeURLLoop(meta);
@@ -1625,12 +1626,41 @@ export async function scrapeURL(
                   [...meta.featureFlags].filter(x => x !== "document"),
                 );
               }
+            } else if (
+              error instanceof BrandingNotSupportedError &&
+              meta.options.formats.some(f => f.type !== "branding")
+            ) {
+              // The page turned out to be a PDF, document or image. Keep the
+              // other requested formats instead of failing the whole scrape;
+              // branding is dropped with a warning. Branding-only requests
+              // still fail with the error.
+              retryTracker.record("feature_removal", error);
+              meta.logger.info("Skipping branding for a non-HTML page", {
+                reason: error.message,
+              });
+              brandingSkippedReason = error.message;
+              meta.featureFlags = new Set(
+                [...meta.featureFlags].filter(x => x !== "branding"),
+              );
+              meta.options = {
+                ...meta.options,
+                formats: meta.options.formats.filter(
+                  f => f.type !== "branding",
+                ),
+              };
             } else {
               throw error;
             }
           }
         }
 
+        if (brandingSkippedReason && result.success) {
+          const warning = `Branding was skipped: ${brandingSkippedReason}`;
+          result.document.warning = result.document.warning
+            ? `${result.document.warning} ${warning}`
+            : warning;
+        }
+
         // Threat protection: if the scrape ended up on a different URL than
         // requested (redirect), re-check the destination URL. This closes the
         // "clean URL redirects to a blocked URL" bypass vector — including
```

---

### Incident Patch 13: `e58f33e3` (2026-09-30)
**Commit Message**: fix(x-twitter): look up the requested handle directly on profile scrapes (#4873)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/api/src/__tests__/snips/cost-tracking-helpers.ts` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import { eq } from "drizzle-orm";
+import { db } from "../../db/connection";
+import * as schema from "../../db/schema";
+
+export type CostTrackingCall = {
+  model: string;
+  cost: number;
+  metadata: Record<string, unknown>;
+  tokens?: { input: number; output: number };
+};
+
+// The scrape row is written when the job finishes; give the insert a moment.
+export async function getCostTrackingCalls(
+  scrapeId: string,
+): Promise<CostTrackingCall[]> {
+  for (let attempt = 0; attempt < 10; attempt++) {
+    const rows = await db
+      .select({ cost_tracking: schema.scrapes.cost_tracking })
+      .from(schema.scrapes)
+      .where(eq(schema.scrapes.id, scrapeId))
+      .limit(1);
+    if (rows.length === 1) {
+      const costTracking = rows[0].cost_tracking as {
+        calls?: CostTrackingCall[];
+      } | null;
+      return costTracking?.calls ?? [];
+    }
+    await new Promise(resolve => setTimeout(resolve, 1000));
+  }
+  throw new Error(`No scrapes row for ${scrapeId}`);
+}
```

**File**: `apps/api/src/__tests__/snips/lib.ts` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ export const TEST_PRODUCTION = !TEST_SELF_HOST;
 // TODO: do we want to run AI tests when users run this command locally? It may lead to increased spending for them, depending on configuration
 export const HAS_AI = !!(config.OPENAI_API_KEY || config.OLLAMA_BASE_URL);
 export const HAS_FIREWORKS = !!process.env.FIREWORKS_API_KEY;
+export const HAS_XAI = !!config.XAI_API_KEY;
 export const HAS_FIRE_ENGINE = !!config.FIRE_ENGINE_BETA_URL;
 export const HAS_PLAYWRIGHT = !!config.PLAYWRIGHT_MICROSERVICE_URL;
 export const HAS_PROXY = !!config.PROXY_SERVER;
```

**File**: `apps/api/src/__tests__/snips/v2/scrape-branding.test.ts` (modified, +4/-31)
```diff
@@ -1,6 +1,7 @@
-import { eq } from "drizzle-orm";
-import { db } from "../../../db/connection";
-import * as schema from "../../../db/schema";
+import {
+  type CostTrackingCall,
+  getCostTrackingCalls,
+} from "../cost-tracking-helpers";
 import { concurrentIf, HAS_AI, TEST_PRODUCTION } from "../lib";
 import { scrape, scrapeTimeout, idmux, Identity } from "./lib";
 
@@ -38,34 +39,6 @@ describe("Branding declared-logo fallback", () => {
   );
 });
 
-type CostTrackingCall = {
-  model: string;
-  cost: number;
-  metadata: Record<string, unknown>;
-  tokens?: { input: number; output: number };
-};
-
-// The scrape row is written when the job finishes; give the insert a moment.
-async function getCostTrackingCalls(
-  scrapeId: string,
-): Promise<CostTrackingCall[]> {
-  for (let attempt = 0; attempt < 10; attempt++) {
-    const rows = await db
-      .select({ cost_tracking: schema.scrapes.cost_tracking })
-      .from(schema.scrapes)
-      .where(eq(schema.scrapes.id, scrapeId))
-      .limit(1);
-    if (rows.length === 1) {
-      const costTracking = rows[0].cost_tracking as {
-        calls?: CostTrackingCall[];
-      } | null;
-      return costTracking?.calls ?? [];
-    }
-    await new Promise(resolve => setTimeout(resolve, 1000));
-  }
-  throw new Error(`No scrapes row for ${scrapeId}`);
-}
-
 const isBrandingCall = (call: CostTrackingCall) =>
   call.metadata?.module === "branding" &&
   call.metadata?.method === "enhanceBrandingWithLLM";
```

**File**: `apps/api/src/__tests__/snips/v2/scrape-x-twitter.test.ts` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { getCostTrackingCalls } from "../cost-tracking-helpers";
+import { concurrentIf, HAS_XAI, TEST_PRODUCTION } from "../lib";
+import { scrape, scrapeTimeout, idmux, Identity } from "./lib";
+
+let identity: Identity;
+
+beforeAll(async () => {
+  identity = await idmux({
+    name: "scrape-x-twitter",
+    concurrency: 100,
+    credits: 1000000,
+  });
+}, 10000 + scrapeTimeout);
+
+// X/Twitter scrapes go through xAI's X Search, which bills per profile and
+// post fetched.
+describe("X/Twitter profile scrape", () => {
+  concurrentIf(TEST_PRODUCTION && HAS_XAI)(
+    "returns the profile and its latest posts from a single profile lookup",
+    async () => {
+      const response = await scrape(
+        { url: "https://x.com/NASA", timeout: scrapeTimeout },
+        identity,
+      );
+
+      expect(response.markdown).toMatch(/^# .+ \(@NASA\)$/im);
+      expect(response.markdown).toContain("## Latest Posts");
+      expect(response.markdown).toContain("### 1. Post");
+
+      const calls = await getCostTrackingCalls(response.metadata.scrapeId!);
+      const profileCalls = calls.filter(
+        call => call.metadata?.method === "xTwitter/profile",
+      );
+      expect(profileCalls).toHaveLength(1);
+      expect(profileCalls[0].metadata.xSearchProfiles).toBeLessThanOrEqual(1);
+    },
+    scrapeTimeout + 15000,
+  );
+
+  concurrentIf(TEST_PRODUCTION && HAS_XAI)(
+    "does not substitute another account for a nonexistent handle",
+    async () => {
+      // Letters and digits only, so the handle survives markdown escaping.
+      const handle = `fcnx${Math.random().toString(36).slice(2, 12)}`;
+      const response = await scrape(
+        { url: `https://x.com/${handle}`, timeout: scrapeTimeout },
+        identity,
+      );
+
+      expect(response.markdown).toMatch(
+        new RegExp(`^# .+ \\(@(unknown|${handle})\\)$`, "im"),
+      );
+      expect(response.markdown).toContain(
+        "No recent top-level posts were returned.",
+      );
+      expect(response.markdown).not.toContain("### 1. Post");
+    },
+    scrapeTimeout + 15000,
+  );
+});
```

**File**: `apps/api/src/scraper/scrapeURL/engines/x-twitter/index.test.ts` (modified, +118/-0)
```diff
@@ -72,6 +72,22 @@ function grokReturns(
   });
 }
 
+// Captures the call options the engine sends to the model.
+function grokCapturesCall(output: unknown) {
+  const calls: any[] = [];
+  grokReturns(output);
+  const doGenerate = grok.doGenerate;
+  grok.doGenerate = async (options: any) => {
+    calls.push(options);
+    return doGenerate(options);
+  };
+  return calls;
+}
+
+function promptText(options: any): string {
+  return JSON.stringify(options.prompt);
+}
+
 function makeMeta(url: string, zeroDataRetention = false): Meta {
   const logger = { info: () => {}, warn: () => {}, error: () => {} };
   return {
@@ -84,6 +100,108 @@ function makeMeta(url: string, zeroDataRetention = false): Meta {
   } as unknown as Meta;
 }
 
+describe("x-twitter engine X Search requests", () => {
+  it("asks the profile lookup for the one exact handle and top-level posts only", async () => {
+    const calls = grokCapturesCall({ username: "firecrawl", latestPosts: [] });
+
+    await scrapeURLWithXTwitter(makeMeta("https://x.com/firecrawl"));
+
+    expect(calls).toHaveLength(1);
+    expect(calls[0].tools).toEqual([
+      expect.objectContaining({ id: "xai.x_search", args: {} }),
+    ]);
+    const prompt = promptText(calls[0]);
+    expect(prompt).toContain(
+      'single user search for \\"firecrawl\\" that returns only 1 result',
+    );
+    expect(prompt).toContain("do not search for other or similarly named");
+    expect(prompt).toContain("rather than another account's data");
+    expect(prompt).toContain('\\"from:firecrawl -filter:replies\\"');
+  });
+
+  it("drops a profile that belongs to a different account", async () => {
+    grokReturns({
+      displayName: "Firecrawl Fan Club",
+      username: "@firecrawlfans",
+      followers: 12,
+      latestPosts: [{ text: "Not from @firecrawl." }],
+    });
+    const meta = makeMeta("https://x.com/firecrawl");
+    const warn = vi.fn();
+    meta.logger.warn = warn;
+
+    const result = await scrapeURLWithXTwitter(meta);
+
+    expect(warn).toHaveBeenCalledTimes(1);
+    expect(warn).toHaveBeenCalledWith(expect.any(String), {
+      requestedHandle: "firecrawl",
+      returnedUsername: "firecrawlfans",
+    });
+
+    expect(result.markdown).toContain("# @unknown (@unknown)");
+    expect(result.markdown).toContain(
+      "No recent top-level posts were returned.",
+    );
+    expect(result.markdown).not.toContain("firecrawlfans");
+    expect(result.markdown).not.toContain("Fan Club");
+  });
+
+  it("drops profile data that comes back without a username", async () => {
+    grokReturns({
+      displayName: "Firecrawl Fan Club",
+      username: null,
+      bio: "Unofficial.",
+      latestPosts: [{ text: "Not from @firecrawl." }],
+    });
+    const meta = makeMeta("https://x.com/firecrawl");
+    const warn = vi.fn();
+    meta.logger.warn = warn;
+
+    const result = await scrapeURLWithXTwitter(meta);
+
+    expect(warn).not.toHaveBeenCalled();
+    expect(result.markdown).toContain("# @unknown (@unknown)");
+    expect(result.markdown).not.toContain("Fan Club");
+    expect(result.markdown).not.toContain("Unofficial.");
+    expect(result.markdown).not.toContain("### 1. Post");
+  });
+
+  it("keeps a profile whose username differs from the handle only in case", async () => {
+    grokReturns({
+      displayName: "Firecrawl",
+      username: "@FireCrawl",
+      latestPosts: [{ text: "Turn websites into LLM-ready data." }],
+    });
+
+    const result = await scrapeURLWithXTwitter(
+      makeMeta("https://x.com/firecrawl"),
+    );
+
+    expect(result.markdown).toContain("# Firecrawl (@FireCrawl)");
+    expect(result.markdown).toContain("> Turn websites into LLM-ready data.");
+  });
+
+  it("restricts the post lookup to the author's handle", async () => {
+    const calls = grokCapturesCall({ authorUsername: "firecrawl", text: "Hi" });
+
+    await scrapeURLWithXTwitter(
+      makeMeta("https://x.com/firecrawl/status/1234567890123"),
+    );
+
+    expect(calls).toHaveLength(1);
+    expect(calls[0].tools).toEqual([
+      expect.objectContaining({
+        id: "xai.x_search",
+        args: {
+          allowedXHandles: ["firecrawl"],
+          enableVideoUnderstanding: true,
+          enableImageUnderstanding: true,
+        },
+      }),
+    ]);
+  });
+});
+
 // grok-4-1-fast-non-reasoning at $0.20 / $0.50 per 1M input / output tokens.
 const tokenCost = (3000 * 0.2 + 400 * 0.5) / 1_000_000;
 
```

**File**: `apps/api/src/scraper/scrapeURL/engines/x-twitter/index.ts` (modified, +22/-2)
```diff
@@ -463,11 +463,31 @@ async function fetchProfile(
     }),
     abortSignal: meta.abort.asSignal(),
     experimental_telemetry: xTwitterTelemetry("xTwitter/profile", meta),
-    prompt: `Give me current public X/Twitter profile details for @${xUrl.handle}: display name, username, profile picture URL, bio, follower count, verification status, and profile URL. Also return exactly the 5 latest posts authored by @${xUrl.handle} that are top-level posts, not replies or comments. Include fewer posts only if fewer public non-reply posts are available. Use the current public X data available to x_search.`,
+    // xAI bills every profile a user search returns, and the model otherwise
+    // often asks for 3 candidates. Pin the lookup to the one exact handle, and
+    // filter replies in the search so they aren't fetched and then dropped.
+    prompt: `Give me current public X/Twitter profile details for @${xUrl.handle}: display name, username, profile picture URL, bio, follower count, verification status, and profile URL. Look up this exact username directly with a single user search for "${xUrl.handle}" that returns only 1 result; do not search for other or similarly named accounts. If no account has the username ${xUrl.handle} (ignoring case), return null for every profile field and no posts rather than another account's data. Also return exactly the 5 latest posts authored by @${xUrl.handle} that are top-level posts, not replies or comments, found with a single latest-posts search for "from:${xUrl.handle} -filter:replies" limited to 5 results. Include fewer posts only if fewer public non-reply posts are available. Use the current public X data available to x_search.`,
   });
   recordGrokCost(meta, "xTwitter/profile", result);
 
-  return result.output as XTwitterProfileData;
+  const profile = result.output as XTwitterProfileData;
+  // A user search can still surface a similarly named account; never pass it
+  // off as the requested one. Without a username nothing ties the data to the
+  // requested account either, so that case is dropped too (it is the normal
+  // result for a handle that doesn't exist, so it isn't worth a warning).
+  const username = stripAt(profile.username);
+  if (!username) {
+    return {};
+  }
+  if (username.toLowerCase() !== xUrl.handle.toLowerCase()) {
+    meta.logger.warn("X/Twitter profile lookup returned a different account", {
+      requestedHandle: xUrl.handle,
+      returnedUsername: username,
+    });
+    return {};
+  }
+
+  return profile;
 }
 
 async function fetchPost(
```

---

### Incident Patch 14: `1a94fb05` (2026-09-30)
**Commit Message**: fix(deps): bump rand, rustls-webpki, and axios to clear Dependabot alerts (#4876)

**File**: `apps/rust-sdk/Cargo.lock` (modified, +4/-4)
```diff
@@ -1028,9 +1028,9 @@ checksum = "f8dcc9c7d52a811697d2151c701e0d08956f92b0e24136cf4cf27b57a6a0d9bf"
 
 [[package]]
 name = "rand"
-version = "0.9.2"
+version = "0.9.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6db2770f06117d490610c7488547d543617b21bfa07796d7a12f6f1bd53850d1"
+checksum = "7ec095654a25171c2124e9e3393a930bddbffdc939556c914957a4c3e0a87166"
 dependencies = [
  "rand_chacha",
  "rand_core",
@@ -1212,9 +1212,9 @@ dependencies = [
 
 [[package]]
 name = "rustls-webpki"
-version = "0.103.4"
+version = "0.103.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0a17884ae0c1b773f1ccd2bd4a8c72f16da897310a98b0e84bf349ad5ead92fc"
+checksum = "f3c3cf1d8b1e7d4927e2d154c3fcb02979afb9939629c62cd9048d4f07b60ac2"
 dependencies = [
  "ring",
  "rustls-pki-types",
```

**File**: `examples/scrape_and_analyze_airbnb_data_e2b/package-lock.json` (modified, +51/-8)
```diff
@@ -528,6 +528,18 @@
         "node": ">=6.5"
       }
     },
+    "node_modules/agent-base": {
+      "version": "6.0.2",
+      "resolved": "https://registry.npmjs.org/agent-base/-/agent-base-6.0.2.tgz",
+      "integrity": "sha512-RZNwNclF7+MS/8bDg70amg32dyeZGZxiDuQmZxKLAlQjr3jGyLx+4Kkk58UO7D2QdgFIQCovuSuZESne6RG6XQ==",
+      "license": "MIT",
+      "dependencies": {
+        "debug": "4"
+      },
+      "engines": {
+        "node": ">= 6.0.0"
+      }
+    },
     "node_modules/agentkeepalive": {
       "version": "4.5.0",
       "resolved": "https://registry.npmjs.org/agentkeepalive/-/agentkeepalive-4.5.0.tgz",
@@ -545,13 +557,14 @@
       "integrity": "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q=="
     },
     "node_modules/axios": {
-      "version": "1.15.2",
-      "resolved": "https://registry.npmjs.org/axios/-/axios-1.15.2.tgz",
-      "integrity": "sha512-wLrXxPtcrPTsNlJmKjkPnNPK2Ihe0hn0wGSaTEiHRPxwjvJwT3hKmXF4dpqxmPO9SoNb2FsYXj/xEo0gHN+D5A==",
+      "version": "1.18.0",
+      "resolved": "https://registry.npmjs.org/axios/-/axios-1.18.0.tgz",
+      "integrity": "sha512-E32NzpYKp++W7XRe52rHiXV2ehxmh3wbdgO7MHeFM+vqxLBYHzt0ElkiImtOBxtOmyp0yoC8C6uESVV84Y2/hw==",
       "license": "MIT",
       "dependencies": {
-        "follow-redirects": "^1.15.11",
+        "follow-redirects": "^1.16.0",
         "form-data": "^4.0.5",
+        "https-proxy-agent": "^5.0.1",
         "proxy-from-env": "^2.1.0"
       }
     },
@@ -634,6 +647,23 @@
         "node": ">= 0.8"
       }
     },
+    "node_modules/debug": {
+      "version": "4.4.3",
+      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.3.tgz",
+      "integrity": "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==",
+      "license": "MIT",
+      "dependencies": {
+        "ms": "^2.1.3"
+      },
+      "engines": {
+        "node": ">=6.0"
+      },
+      "peerDependenciesMeta": {
+        "supports-color": {
+          "optional": true
+        }
+      }
+    },
     "node_modules/delayed-stream": {
       "version": "1.0.0",
       "resolved": "https://registry.npmjs.org/delayed-stream/-/delayed-stream-1.0.0.tgz",
@@ -786,12 +816,12 @@
       }
     },
     "node_modules/firecrawl": {
-      "version": "4.25.0",
-      "resolved": "https://registry.npmjs.org/firecrawl/-/firecrawl-4.25.0.tgz",
-      "integrity": "sha512-vw5C+GHIIM+kopSD/WiiSkd/68vLetFVr12z4lsGIeLFjn7dRZFTOJeqY/M6F2vmqDay1ivmXCLAlvmGRTKL+A==",
+      "version": "4.42.1",
+      "resolved": "https://registry.npmjs.org/firecrawl/-/firecrawl-4.42.1.tgz",
+      "integrity": "sha512-YlUDnjp8UhergCdj5cpUqN1N+/p8zdPM4NrbU/b0nrteuA4m6uIXTCU3Mrrh77NqLh38nSFiw/UDbiCrHmZKgA==",
       "license": "MIT",
       "dependencies": {
-        "axios": "1.15.2",
+        "axios": "1.18.0",
         "typescript-event-target": "^1.1.1",
         "zod": "^3.23.8",
         "zod-to-json-schema": "^3.23.0"
@@ -984,6 +1014,19 @@
         "node": ">= 0.4"
       }
     },
+    "node_modules/https-proxy-agent": {
+      "version": "5.0.1",
+      "resolved": "https://registry.npmjs.org/https-proxy-agent/-/https-proxy-agent-5.0.1.tgz",
+      "integrity": "sha512-dFcAjpTQFgoLMzC2VwU+C/CbS7uRL0lWmxDITmqm7C+7F0Odmj6s9l6alZc6AELXhrnggM2CeWSXHGOdX2YtwA==",
+      "license": "MIT",
+      "dependencies": {
+        "agent-base": "6",
+        "debug": "4"
+      },
+      "engines": {
+        "node": ">= 6"
+      }
+    },
     "node_modules/humanize-ms": {
       "version": "1.2.1",
       "resolved": "https://registry.npmjs.org/humanize-ms/-/humanize-ms-1.2.1.tgz",
```

---

### Incident Patch 15: `a1667ae4` (2026-09-30)
**Commit Message**: fix(api): carry the caller's external request id on v2 batch scrape charges (#4872)

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `apps/api/src/controllers/v2/batch-scrape.ts` (modified, +6/-3)
```diff
@@ -140,9 +140,12 @@ export async function batchScrapeController(
   }
 
   const id = req.body.appendToId ?? uuidv7();
-  const billing: BillingMetadata = req.body.__agentInterop
-    ? { endpoint: "agent" as const, jobId: id }
-    : { endpoint: "batch_scrape" as const, jobId: id };
+  const billing: BillingMetadata = {
+    ...(req.body.__agentInterop
+      ? { endpoint: "agent" as const, jobId: id }
+      : { endpoint: "batch_scrape" as const, jobId: id }),
+    externalRequestId: externalRequestId(req),
+  };
   const logger = _logger.child({
     crawlId: id,
     batchScrapeId: id,
```

#### Recent Merged Pull Requests:
- **PR #4949** (2026-10-05): api: read team flag overrides through auth_chunk_2 (@claude[bot])
- **PR #4947** (2026-10-05): fix(security): resolve pnpm audit failures from 2026-10-05 audit (@cursor[bot])
- **PR #4936** (2026-10-05): Point unsupported-site error at contact-sales page (@claude[bot])
- **PR #4931** (2026-10-03): Align README with the library for superintelligence tagline (@ericciarla)
- **PR #4928** (2026-10-03): In-app notifications for monitor changes and dashboard crawls (@nickscamara)
- **PR #4926** (2026-10-02): ci(elixir-sdk): open regen PRs with a GitHub App token (@mogery)
- **PR #4922** (2026-10-02): chore(elixir-sdk): regenerate from OpenAPI spec (v1.11.3) (@github-actions[bot])
- **PR #4921** (2026-10-02): fix(js-sdk): v1 methods crash when called without params (@mogery)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

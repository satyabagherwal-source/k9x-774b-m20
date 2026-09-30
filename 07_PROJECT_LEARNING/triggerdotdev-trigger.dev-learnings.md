# Forensic Learning Record (Deep Inspection): triggerdotdev/trigger.dev

> **Canonical Artifact**: `07_PROJECT_LEARNING/triggerdotdev-trigger.dev-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:14:12.347Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `triggerdotdev/trigger.dev`
- **Description**: Trigger.dev – build and deploy durable AI agents and workflows
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16443 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/supervisor/src/backpressure/backpressureMetrics.ts`
```
import { Counter, Gauge, type Registry } from "prom-client";

/** Prometheus metrics for dequeue backpressure. */
export class BackpressureMetrics {
  /** 1 while backpressure is engaged (computed signal, set even in dry-run). */
  readonly engaged: Gauge<string>;
  /** 1 when running in dry-run (gates inert). */
  readonly dryRun: Gauge<string>;
  /** Dequeue attempts the gate skipped - or would have, in dry-run (labelled). */
  readonly skipsTotal: Counter<string>;
  /** Verdict source reads that failed (threw). */
  readonly readFailuresTotal: Counter<string>;

  constructor(opts: { register: Registry; prefix?: string }) {
    const prefix = opts.prefix ?? "supervisor_backpressure";

    this.engaged = new Gauge({
      name: `${prefix}_engaged`,
      help: "1 while dequeue backpressure is engaged (computed signal, regardless of dry-run)",
      registers: [opts.register],
    });

    this.dryRun = new Gauge({
      name: `${prefix}_dry_run`,
      help: "1 when dequeue backpressure is in dry-run mode (gates inert)",
      registers: [opts.register],
    });

    this.skipsTotal = new Counter({
      name: `${prefix}_skipped_dequeues_total`,
      help: "Dequeue attempts skipped by backpressure (or would be, in dry-run)",
      labelNames: ["dry_run"],
      registers: [opts.register],
    });

    this.readFailuresTotal = new Counter({
      name: `${prefix}_read_failures_total`,
      help: "Verdict source reads that threw",
      registers: [opts.register],
    });
  }
}

```

### Core Architecture Module: `apps/supervisor/src/backpressure/backpressureMonitor.ts`
```
import type { BackpressureMetrics } from "./backpressureMetrics.js";

interface BackpressureLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export type BackpressureVerdict = {
  engaged: boolean;
  /** Epoch ms the verdict was produced. Used for consumer-side staleness fail-open. */
  ts?: number;
};

/**
 * Source of the current backpressure verdict. `read()` returns `null` when the source
 * answered but there is no verdict - the monitor treats that as "not engaged"
 * (fail-open). A thrown error is different: the read itself failed, so the monitor
 * keeps the previous verdict until it ages past `maxVerdictAgeMs`.
 */
export interface BackpressureSignalSource {
  read(): Promise<BackpressureVerdict | null>;
}

export type BackpressureMonitorOptions = {
  enabled: boolean;
  source: BackpressureSignalSource;
  refreshIntervalMs?: number;
  /**
   * If set, an engaged verdict older than this is released (fail-open), bounding how
   * long a dead source can hold the brake. Reads that fail keep the last verdict, so
   * this doubles as the grace window for riding out a transient source outage.
   */
  maxVerdictAgeMs?: number;
  /**
   * If set, after backpressure releases the dequeue gate stays partially engaged
   * for this long, skipping a linearly-decaying fraction of attempts so the
   * aggregate dequeue rate ramps from ~0 to full instead of snapping to full and
   * re-flooding a freshly-recovered cluster. 0/unset = instant resume.
   */
  rampMs?: number;
  /** Injectable RNG for the resume ramp; defaults to Math.random. */
  random?: () => number;
  /**
   * When true, the gates are inert (never skip dequeues, never freeze scale-up).
   * computeEngaged() still reflects the real signal so it can be observed.
   */
  dryRun?: boolean;
  logger?: BackpressureLogger;
  metrics?: BackpressureMetrics;
};

const DEFAULT_REFRESH_INTERVAL_MS = 1000;

export class BackpressureMonitor {
  private verdict: BackpressureVerdict | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private refreshInFlight = false;
  private wasEngaged = false;
  private releasedAt?: number;
  private readFailing = false;

  constructor(private readonly opts: BackpressureMonitorOptions) {
    this.opts.metrics?.dryRun.set(this.opts.dryRun ? 1 : 0);
  }

  start(): void {
    if (!this.opts.enabled) {
      return;
    }

    void this.refreshTick();
    this.timer = setInterval(
      () => void this.refreshTick(),
      this.opts.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS
    );
  }

  /** Skip a tick if the previous refresh is still in flight, so slow/hung reads can't stack. */
  private async refreshTick(): Promise<void> {
    if (this.refreshInFlight) {
      return;
    }
    this.refreshInFlight = true;
    try {
      await this.refresh();
    } finally {
      this.refreshInFlight = false;
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Raw hard backpressure state: true while the (fresh) verdict says engaged,
   * ignoring dry-run. Used for observability/metrics so the real signal is
   * visible even when the gates are inert.
   */
  computeEngaged(): boolean {
    const verdict = this.verdict;
    if (verdict?.engaged !== true) {
      return false;
    }

    // When staleness enforcement is on, an engaged verdict must carry a fresh
    // timestamp. A missing or stale ts can't be trusted (a dead producer could
    // otherwise pin the brake forever), so fail open.
    const maxAge = this.opts.maxVerdictAgeMs;
    if (maxAge !== undefined) {
      if (verdict.ts === undefined || Date.now() - verdict.ts > maxAge) {
        return false;
      }
    }

    return true;
  }

  /**
   * Effective hard state: the signal for freezing consumer-pool scale-up. Inert
   * (false) in dry-run. Hot-path read, no I/O.
   */
  isEngaged(): boolean {
    return this.opts.dryRun ? false : this.computeEngaged();
  }

  /** Hot-path read: synchronous, never performs I/O. Inert (false) in dry-run. */
  shouldSkipDequeue(): boolean {
    const wouldSkip = this.computeShouldSkip();
    if (wouldSkip) {
      this.opts.metrics?.skipsTotal.inc({ dry_run: this.opts.dryRun ? "true" : "false" });
    }
    return this.opts.dryRun ? false : wouldSkip;
  }

  private computeShouldSkip(): boolean {
    if (this.computeEngaged()) {
      return true;
    }

    // Post-release ramp: skip a linearly-decaying fraction of attempts so the
    // aggregate dequeue rate climbs back to full over rampMs rather than snapping.
    const rampMs = this.opts.rampMs;
    if (rampMs && this.releasedAt !== undefined) {
      const elapsed = Date.now() - this.releasedAt;
      if (elapsed < rampMs) {
        const skipProbability = 1 - elapsed / rampMs;
        return (this.opts.random ?? Math.random)() < skipProbability;
      }
    }

    return false;
  }

  private async refresh(): Promise<void> {
    let next: BackpressureVerdict | null = null;
    let readError: unknown;
    try {
      next = await this.opts.source.read();
    } catch (error) {
      readError = error;
    }

    if (readError === undefined) {
      this.verdict = next; // an explicit null means "no pressure", so honour it
      this.readFailing = false;
    } else {
      const held = this.opts.maxVerdictAgeMs !== undefined;
      if (!held) {
        this.verdict = null; // unbounded hold could pin the brake forever
      }
      this.opts.metrics?.readFailuresTotal.inc();
      if (!this.readFailing) {
        this.readFailing = true; // log once per outage, not once per tick
        this.opts.logger?.error("backpressure read failed", {
          reason: String(readError),
          heldPreviousVerdict: held,
          engaged: this.computeEngaged(),
        });
      }
    }

    // Track the engaged→released transition to anchor the resume ramp. Use the
    // staleness-aware state so a stale verdict doesn't pin wasEngaged / the gauge.
    const nowEngaged = this.computeEngaged();
    this.opts.metrics?.engaged.set(nowEngaged ? 1 : 0);

    if (nowEngaged !== this.wasEngaged) {
      this.opts.logger?.info("backpressure verdict changed", {
        engaged: nowEngaged,
        dryRun: !!this.opts.dryRun,
      });
    }
    if (this.wasEngaged && !nowEngaged) {
      this.releasedAt = Date.now();
    }
    this.wasEngaged = nowEngaged;
  }
}

```

### Core Architecture Module: `apps/supervisor/src/backpressure/k8sPodCountSignalSource.ts`
```
import type { BackpressureSignalSource, BackpressureVerdict } from "./backpressureMonitor.js";

export type K8sPodCountSignalSourceOptions = {
  fetchPodCount: () => Promise<number>;
  engageThreshold: number;
  releaseThreshold: number;
  reportPodCount?: (count: number) => void;
};

// Engage/release with hysteresis so a count hovering near the line doesn't flap.
export class K8sPodCountSignalSource implements BackpressureSignalSource {
  private engaged = false;

  constructor(private readonly opts: K8sPodCountSignalSourceOptions) {}

  async read(): Promise<BackpressureVerdict> {
    const count = await this.opts.fetchPodCount();
    this.opts.reportPodCount?.(count);

    if (this.engaged) {
      if (count < this.opts.releaseThreshold) {
        this.engaged = false;
      }
    } else if (count >= this.opts.engageThreshold) {
      this.engaged = true;
    }

    return { engaged: this.engaged, ts: Date.now() };
  }
}

```

### Core Architecture Module: `apps/supervisor/src/backpressure/redisBackpressureSignalSource.ts`
```
import type { Redis } from "ioredis";
import { z } from "zod";
import type { BackpressureSignalSource, BackpressureVerdict } from "./backpressureMonitor.js";

const VerdictSchema = z.object({
  engaged: z.boolean(),
  ts: z.number().optional(),
});

/** Reads the backpressure verdict from a Redis key written by the cluster-side aggregator. */
export class RedisBackpressureSignalSource implements BackpressureSignalSource {
  constructor(
    private readonly redis: Redis,
    private readonly key: string
  ) {}

  async read(): Promise<BackpressureVerdict | null> {
    const raw = await this.redis.get(this.key);
    if (raw === null) {
      return null;
    }

    // A malformed or wrong-shaped value is treated as unknown (null) so the
    // monitor fails open rather than acting on garbage.
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return null;
    }

    const parsed = VerdictSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  }
}

```

### Core Architecture Module: `apps/supervisor/src/clients/kubernetes.ts`
```
import * as k8s from "@kubernetes/client-node";
import type { Informer, KubernetesObject, ListPromise } from "@kubernetes/client-node";
import { assertExhaustive } from "@trigger.dev/core/utils";
import { SimpleStructuredLogger } from "@trigger.dev/core/v3/utils/structuredLogger";

const RUNTIME_ENV = process.env.KUBERNETES_PORT ? "kubernetes" : "local";

const logger = new SimpleStructuredLogger("kubernetes-client");

export function createK8sApi() {
  const kubeConfig = getKubeConfig();

  function makeInformer<T extends KubernetesObject>(
    path: string,
    listPromiseFn: ListPromise<T>,
    labelSelector?: string,
    fieldSelector?: string
  ): Informer<T> {
    return k8s.makeInformer(kubeConfig, path, listPromiseFn, labelSelector, fieldSelector);
  }

  const api = {
    core: kubeConfig.makeApiClient(k8s.CoreV1Api),
    batch: kubeConfig.makeApiClient(k8s.BatchV1Api),
    apps: kubeConfig.makeApiClient(k8s.AppsV1Api),
    custom: kubeConfig.makeApiClient(k8s.CustomObjectsApi),
    // Patching needs a content type the generated clients do not offer.
    objects: k8s.KubernetesObjectApi.makeApiClient(kubeConfig),
    makeInformer,
  };

  return api;
}

export type K8sApi = ReturnType<typeof createK8sApi>;

function getKubeConfig() {
  logger.debug("getKubeConfig()", { RUNTIME_ENV });

  const kubeConfig = new k8s.KubeConfig();

  switch (RUNTIME_ENV) {
    case "local":
      kubeConfig.loadFromDefault();
      break;
    case "kubernetes":
      kubeConfig.loadFromCluster();
      break;
    default:
      assertExhaustive(RUNTIME_ENV);
  }

  return kubeConfig;
}

export { k8s };

/**
 * createPodCountFetcher sizes a namespace's pod collection with a single `limit=1`
 * list: one pod transferred, no informer, no watch cache.
 *
 * This is an ESTIMATE, not an exact count. Kubernetes documents `remainingItemCount`
 * as intended for estimating collection size and reserves the right not to set it or
 * make it exact. Counting exactly would mean paginating the whole collection, which is
 * what this deliberately avoids. Treat the value as a tight estimate from a quorum read
 * at request time, and set thresholds with that in mind.
 *
 * Two request-shape constraints, both load-bearing. A label or field selector makes
 * the apiserver omit `remainingItemCount` entirely, and setting `resourceVersion`
 * serves a cached count instead of a quorum read - so neither is passed.
 */
export function createPodCountFetcher(
  api: K8sApi,
  namespace: string,
  timeoutMs: number
): () => Promise<number> {
  const serverTimeoutSeconds = Math.max(1, Math.floor(timeoutMs / 1000));
  let pending: Promise<unknown> | undefined;

  return async () => {
    if (pending) {
      throw new Error("pod count list still in flight from a previous tick");
    }

    const request = api.core.listNamespacedPod({
      namespace,
      limit: 1,
      timeoutSeconds: serverTimeoutSeconds,
    });

    pending = request
      .catch(() => {})
      .finally(() => {
        pending = undefined;
      });

    return podCountFromList(await withTimeout(request, timeoutMs, "pod count list"));
  };
}

/**
 * podCountFromList turns a `limit=1` pod list into a population estimate.
 *
 * `remainingItemCount` is only set when the list is truncated, so `_continue` is the
 * truncation signal: absent means the returned page is the whole collection and its
 * length is exact. When truncated the total leans on `remainingItemCount`, which is
 * documented as an estimate - so the result is an estimate too. Truncated without a
 * usable count is unknowable, so it throws rather than returning a low number the
 * caller would act on.
 */
export function podCountFromList(list: {
  items: unknown[];
  metadata?: { _continue?: string; remainingItemCount?: number };
}): number {
  if (!list.metadata?._continue) {
    return list.items.length;
  }

  const remaining = list.metadata.remainingItemCount;
  if (typeof remaining !== "number" || !Number.isFinite(remaining) || remaining < 0) {
    throw new Error("pod list truncated but remainingItemCount absent or invalid");
  }

  return list.items.length + remaining;
}

/**
 * withTimeout rejects if `promise` outlives `timeoutMs`, so a hung request cannot
 * freeze the caller. It cannot cancel: the k8s client threads no AbortSignal through to
 * fetch, so an abandoned request keeps running. Callers must therefore also bound the
 * request server-side (`timeoutSeconds`) and refuse to start a second one while the
 * first is pending, or a blackholed connection accumulates one socket per attempt.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    timer.unref();
  });

  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

```

### Core Architecture Module: `apps/supervisor/src/clients/responseSchemas.ts`
```
import type { AnyZodSchema } from "@trigger.dev/core/v3";
import {
  WorkerApiConnectResponseBody,
  WorkerApiContinueRunExecutionRequestBody,
  WorkerApiDequeueResponseBody,
  WorkerApiHeartbeatResponseBody,
  WorkerApiRunAttemptCompleteResponseBody,
  WorkerApiRunHeartbeatResponseBody,
  WorkerApiRunLatestSnapshotResponseBody,
  WorkerApiRunSnapshotsSinceResponseBody,
  WorkerApiSuspendRunResponseBody,
} from "@trigger.dev/core/v3/workers";
import { z } from "zod";

const responseSchemas = [
  WorkerApiConnectResponseBody,
  WorkerApiContinueRunExecutionRequestBody,
  WorkerApiDequeueResponseBody,
  WorkerApiHeartbeatResponseBody,
  WorkerApiRunAttemptCompleteResponseBody,
  WorkerApiRunHeartbeatResponseBody,
  WorkerApiRunLatestSnapshotResponseBody,
  WorkerApiRunSnapshotsSinceResponseBody,
  WorkerApiSuspendRunResponseBody,
];

const compiledSchemas = new Map<AnyZodSchema, AnyZodSchema>(
  responseSchemas.map((schema) => [schema, z.compile(schema)])
);

export function resolveResponseSchema<T extends AnyZodSchema>(schema: T): T {
  return (compiledSchemas.get(schema) as T | undefined) ?? schema;
}

```

### Core Architecture Module: `apps/supervisor/src/env.ts`
```
import { randomUUID } from "crypto";
import { env as stdEnv } from "std-env";
import { z } from "zod";
import {
  AdditionalEnvVars,
  BoolEnv,
  NodeLabelValue,
  OrgPlacementOverrides,
  Tolerations,
} from "./envUtil.js";

export const Env = z
  .object({
    // This will come from `spec.nodeName` in k8s
    TRIGGER_WORKER_INSTANCE_NAME: z.string().default(randomUUID()),
    TRIGGER_WORKER_HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().default(30),

    // Opt-in, dev-only: stream this process's logs over a local telnet/TCP socket on this port.
    SUPERVISOR_TELNET_LOGS_PORT: z.coerce.number().optional(),

    // Required settings
    TRIGGER_API_URL: z.string().url(),
    TRIGGER_WORKER_TOKEN: z.string().min(1), // accepts file:// path to read from a file
    MANAGED_WORKER_SECRET: z.string(),

    // Deployment token: sign a token into TRIGGER_DEPLOYMENT_ID at pod creation and verify it on
    // inbound workload calls. "disabled" = off; "log" = mint + verify + metrics only; "enforce" =
    // also reject invalid tokens.
    WORKLOAD_TOKEN_SECRET: z.string().optional(),
    WORKLOAD_TOKEN_ENFORCEMENT: z.enum(["disabled", "log", "enforce"]).default("disabled"),
    DELETE_CHECKPOINTS_ON_COMPLETION: BoolEnv.default(false), // irreversible; enable per cluster
    // Absolute expiry for minted deployment tokens. Deterministic (no wall-clock issued-at) so every
    // pod of a deployment carries an identical token; bump before this date. Must outlive any run.
    WORKLOAD_TOKEN_EXP: z.string().datetime().default("2032-01-01T00:00:00.000Z"),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url(), // set on the runners

    // Workload API settings (coordinator mode) - the workload API is what the run controller connects to
    TRIGGER_WORKLOAD_API_ENABLED: BoolEnv.default(true),
    TRIGGER_WORKLOAD_API_PROTOCOL: z
      .string()
      .transform((s) => z.enum(["http", "https"]).parse(s.toLowerCase()))
      .default("http"),
    TRIGGER_WORKLOAD_API_DOMAIN: z.string().optional(), // If unset, will use orchestrator-specific default
    TRIGGER_WORKLOAD_API_HOST_INTERNAL: z.string().default("0.0.0.0"),
    TRIGGER_WORKLOAD_API_PORT_INTERNAL: z.coerce.number().default(8020), // This is the port the workload API listens on
    TRIGGER_WORKLOAD_API_PORT_EXTERNAL: z.coerce.number().default(8020), // This is the exposed port passed to the run controller

    // Runner settings
    RUNNER_HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().optional(),
    RUNNER_SNAPSHOT_POLL_INTERVAL_SECONDS: z.coerce.number().optional(),
    RUNNER_ADDITIONAL_ENV_VARS: AdditionalEnvVars, // optional (csv)
    RUNNER_PRETTY_LOGS: BoolEnv.default(false),

    // Dequeue settings (provider mode)
    TRIGGER_DEQUEUE_ENABLED: BoolEnv.default(true),
    // Which worker-queue class this supervisor fleet serves. "default" pulls the
    // region queue (standard/agent runs); "scheduled" pulls the dedicated
    // scheduled-lineage queue. Run a separate fleet per class for isolation.
    TRIGGER_WORKER_QUEUE_CLASS: z.enum(["default", "scheduled"]).default("default"),
    TRIGGER_DEQUEUE_INTERVAL_MS: z.coerce.number().int().default(250),
    TRIGGER_DEQUEUE_IDLE_INTERVAL_MS: z.coerce.number().int().default(1000),
    TRIGGER_DEQUEUE_MAX_RUN_COUNT: z.coerce.number().int().default(1),
    TRIGGER_DEQUEUE_MIN_CONSUMER_COUNT: z.coerce.number().int().default(1),
    TRIGGER_DEQUEUE_MAX_CONSUMER_COUNT: z.coerce.number().int().default(10),
    TRIGGER_DEQUEUE_SCALING_STRATEGY: z.enum(["none", "smooth", "aggressive"]).default("none"),
    TRIGGER_DEQUEUE_SCALING_UP_COOLDOWN_MS: z.coerce.number().int().default(5000), // 5 seconds
    TRIGGER_DEQUEUE_SCALING_DOWN_COOLDOWN_MS: z.coerce.number().int().default(30000), // 30 seconds
    TRIGGER_DEQUEUE_SCALING_TARGET_RATIO: z.coerce.number().default(1.0), // Target ratio of queue items to consumers (1.0 = 1 item per consumer)
    TRIGGER_DEQUEUE_SCALING_EWMA_ALPHA: z.coerce.number().min(0).max(1).default(0.3), // Smooths queue length measurements (0=historical, 1=current)
    TRIGGER_DEQUEUE_SCALING_BATCH_WINDOW_MS: z.coerce.number().int().positive().default(1000), // Batch window for metrics processing (ms)
    TRIGGER_DEQUEUE_SCALING_DAMPING_FACTOR: z.coerce.number().min(0).max(1).default(0.7), // Smooths consumer count changes after EWMA (0=no scaling, 1=immediate)

    // Dequeue backpressure - off by default. When enabled, the supervisor reads a
    // verdict from Redis (written by the cluster-side aggregator) and pauses dequeues
    // while the worker cluster can't schedule pods. Disabled = total no-op: no Redis
    // client is created, no reads happen, and the dequeue loop is unaffected.
    TRIGGER_DEQUEUE_BACKPRESSURE_ENABLED: BoolEnv.default(false),
    // Safety default: even when enabled, backpressure only logs what it would do.
    // Set to false to actually skip dequeues / freeze scale-up.
    TRIGGER_DEQUEUE_BACKPRESSURE_DRY_RUN: BoolEnv.default(true),
    TRIGGER_DEQUEUE_BACKPRESSURE_REDIS_KEY: z.string().default("engine:dequeue:backpressure"),
    TRIGGER_DEQUEUE_BACKPRESSURE_REFRESH_MS: z.coerce.number().int().positive().default(1000),
    TRIGGER_DEQUEUE_BACKPRESSURE_RAMP_MS: z.coerce.number().int().min(0).default(30_000), // Resume ramp window after release; 0 = instant resume

    TRIGGER_DEQUEUE_BACKPRESSURE_MAX_VERDICT_AGE_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(120_000), // Grace window: held verdict older than this → fail-open
    TRIGGER_DEQUEUE_BACKPRESSURE_REDIS_HOST: z.string().optional(),
    TRIGGER_DEQUEUE_BACKPRESSURE_REDIS_PORT: z.coerce.number().int().optional(),
    TRIGGER_DEQUEUE_BACKPRESSURE_REDIS_USERNAME: z.string().optional(),
    TRIGGER_DEQUEUE_BACKPRESSURE_REDIS_PASSWORD: z.string().optional(),
    TRIGGER_DEQUEUE_BACKPRESSURE_REDIS_TLS_DISABLED: BoolEnv.default(false),
    TRIGGER_DEQUEUE_BACKPRESSURE_POD_COUNT_ENABLED: BoolEnv.default(false),
    TRIGGER_DEQUEUE_BACKPRESSURE_POD_COUNT_DRY_RUN: BoolEnv.default(true),
    TRIGGER_DEQUEUE_BACKPRESSURE_POD_COUNT_ENGAGE: z.coerce
      .number()
      .int()
      .positive()
      .default(10_000),
    TRIGGER_DEQUEUE_BACKPRESSURE_POD_COUNT_RELEASE: z.coerce
      .number()
      .int()
      .positive()
      .default(5_000),
    TRIGGER_DEQUEUE_BACKPRESSURE_POD_COUNT_REFRESH_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(5_000),
    // Hard timeout on the apiserver /metrics scrape. A hung request would otherwise
    // never settle and freeze the monitor's refresh loop (fail-open silently).
    TRIGGER_DEQUEUE_BACKPRESSURE_POD_COUNT_SCRAPE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10_000),

    // Optional services
    TRIGGER_WARM_START_URL: z.string().optional(),
    TRIGGER_WARM_START_DISPATCH_URL: z.string().optional(),
    TRIGGER_CHECKPOINT_URL: z.string().optional(),
    TRIGGER_METADATA_URL: z.string().optional(),

    // Warm-start delivery verification: after a warm-start hit, probe the
    // platform and cold-start the run if no runner acted on the dispatch
    TRIGGER_WARM_START_VERIFY_ENABLED: BoolEnv.default(false),
    TRIGGER_WARM_START_VERIFY_DELAY_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(10_000),

    // Used by the resource monitor
    RESOURCE_MONITOR_ENABLED: BoolEnv.default(false),
    RESOURCE_MONITOR_OVERRIDE_CPU_TOTAL: z.coerce.number().optional(),
    RESOURCE_MONITOR_OVERRIDE_MEMORY_TOTAL_GB: z.coerce.number().optional(),

    // Docker settings
    DOCKER_API_VERSION: z.string().optional(),
    DOCKER_PLATFORM: z.string().optional(), // e.g. linux/amd64, linux/arm64
    DOCKER_STRIP_IMAGE_DIGEST: BoolEnv.default(true),
    DOCKER_REGISTRY_USERNAME: z.string().optional(),
    DOCKER_REGISTRY_PASSWORD: z.string().optional(),
    DOCKER_REGISTRY_URL: z.string().optional(), // e.g. https://index.docker.io/v1
    DOCKER_ENFORCE_MACHINE_PRESETS: BoolEnv.default(true),
    DOCKER_A
```

### Core Architecture Module: `apps/supervisor/src/envUtil.ts`
```
import { z } from "zod";
import { SimpleStructuredLogger } from "@trigger.dev/core/v3/utils/structuredLogger";

const logger = new SimpleStructuredLogger("env-util");

const baseBoolEnv = z.preprocess((val) => {
  if (typeof val !== "string") {
    return val;
  }

  return ["true", "1"].includes(val.toLowerCase().trim());
}, z.boolean());

// Create a type-safe version that only accepts boolean defaults
export const BoolEnv = baseBoolEnv as Omit<typeof baseBoolEnv, "default"> & {
  default: (value: boolean) => z.ZodDefault<typeof baseBoolEnv>;
};

const QUALIFIED_NAME = /^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/;
const DNS_SUBDOMAIN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const LABEL_VALUE = /^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$/;
const QUALIFIED_NAME_MAX = 63;
const DNS_SUBDOMAIN_MAX = 253;
const LABEL_VALUE_MAX = 63;

/**
 * isLabelValue mirrors the Kubernetes label value rules. Empty is valid upstream.
 */
function isLabelValue(value: string): boolean {
  return value.length <= LABEL_VALUE_MAX && LABEL_VALUE.test(value);
}

/**
 * isQualifiedName mirrors the Kubernetes qualified name rules used for taint and
 * label keys: an optional DNS subdomain prefix before the slash, then the name.
 * The two halves have different length limits and different case rules, so a
 * single pattern with one overall bound gets both ends wrong.
 */
function isQualifiedName(key: string): boolean {
  const slashIdx = key.indexOf("/");

  if (slashIdx === -1) {
    return key.length <= QUALIFIED_NAME_MAX && QUALIFIED_NAME.test(key);
  }

  const prefix = key.slice(0, slashIdx);
  const name = key.slice(slashIdx + 1);

  return (
    prefix.length <= DNS_SUBDOMAIN_MAX &&
    DNS_SUBDOMAIN.test(prefix) &&
    name.length <= QUALIFIED_NAME_MAX &&
    QUALIFIED_NAME.test(name)
  );
}

/**
 * A node label value. Trimmed because Kubernetes rejects surrounding whitespace
 * outright, so a padded value fails every pod create. Deliberately no `min(1)`:
 * empty is the off-switch, and the Helm chart ships empty by default.
 */
export const NodeLabelValue = z.string().trim().refine(isLabelValue, {
  message:
    "Must be a Kubernetes label value: alphanumeric, with dashes, underscores and dots inside, at most 63 characters",
});

/**
 * Comma-separated pod tolerations in the format `key=value:effect`, or `key:effect`
 * for the Exists operator. Keys and values are checked against the Kubernetes
 * naming rules here so a typo fails at startup, rather than 422ing every single
 * pod create with the cause buried in an API server message.
 */
export const Tolerations = z.string().transform((val, ctx) => {
  return val
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const colonIdx = entry.lastIndexOf(":");
      if (colonIdx === -1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid toleration format (missing effect): "${entry}"`,
        });
        return z.NEVER;
      }

      const effect = entry.slice(colonIdx + 1).trim();
      const validEffects = ["NoSchedule", "NoExecute", "PreferNoSchedule"];
      if (!validEffects.includes(effect)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid toleration effect "${effect}" in "${entry}". Must be one of: ${validEffects.join(
            ", "
          )}`,
        });
        return z.NEVER;
      }

      const keyValue = entry.slice(0, colonIdx);
      const eqIdx = keyValue.indexOf("=");
      const key = (eqIdx === -1 ? keyValue : keyValue.slice(0, eqIdx)).trim();

      if (!key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid toleration format (empty key): "${entry}"`,
        });
        return z.NEVER;
      }

      if (!isQualifiedName(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid toleration key "${key}" in "${entry}". Must be a Kubernetes taint key, optionally prefixed with a DNS subdomain.`,
        });
        return z.NEVER;
      }

      if (eqIdx === -1) {
        return { key, operator: "Exists" as const, effect };
      }

      const value = keyValue.slice(eqIdx + 1).trim();
      if (!value) {
        logger.warn(
          'Toleration has an empty value, so it matches only a taint whose value is also empty. Drop the "=" to tolerate any value of this key.',
          { entry, key }
        );
      }

      if (!isLabelValue(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid toleration value "${value}" in "${entry}". Must be a Kubernetes label value: alphanumeric, with dashes, underscores and dots inside.`,
        });
        return z.NEVER;
      }

      return {
        key,
        operator: "Equal" as const,
        value,
        effect,
      };
    });
});

/**
 * Scalar values are coerced: YAML/JSON easily produce `true` or `3` where a label
 * value is meant, and Kubernetes label values are always strings. An empty value
 * is rejected rather than passed through - as a selector it matches only nodes
 * carrying a literal empty-valued label, which pins the org to nothing.
 */
const NodeSelector = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .transform((selector, ctx) => {
    const result: Record<string, string> = {};

    for (const [rawKey, rawValue] of Object.entries(selector)) {
      const key = rawKey.trim();
      const value = String(rawValue).trim();

      if (!isQualifiedName(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid node selector key "${rawKey}". Must be a Kubernetes label key, optionally prefixed with a DNS subdomain.`,
        });
        continue;
      }

      if (!value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Empty node selector value for key "${key}". Remove the key instead of blanking the value.`,
        });
        continue;
      }

      if (!isLabelValue(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid node selector value "${value}" for key "${key}". Must be a Kubernetes label value: alphanumeric, with dashes, underscores and dots inside, at most 63 characters.`,
        });
        continue;
      }

      result[key] = value;
    }

    return result;
  });

/**
 * Per-organization placement overrides for run pods, as JSON keyed by the
 * internal org id (the `org` label on run pods):
 * `{"<orgId>": {"nodeSelector": {"<key>": "<value>"}, "tolerations": "<csv>"}}`.
 * Tolerations use the same CSV format as `Tolerations`, or an array of such
 * entries. Everything is validated at startup for the same reason as
 * tolerations above: a typo would otherwise reject every pod create for that
 * org, with the cause buried in API errors. A blank value means no overrides.
 */
export const OrgPlacementOverrides = z
  .string()
  .optional()
  .transform((val, ctx) => {
    if (val === undefined || val.trim() === "") {
      return undefined;
    }

    try {
      return JSON.parse(val) as unknown;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid org placement overrides: not valid JSON",
      });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .record(
        z
          .string()
          .min(1)
          .refine((key) => key === key.trim() && key.trim().length > 0, {
            message:
              "Org override keys must not be blank or padded with whitespace; the lookup is exact",
          }),
        z
          .object({
            nodeSelector: NodeSelector.optional(),
            tolerations: z
              .union([z.string(), z.array(z.string())])
              .transform((val) => (Array.isArray(val) ? val.join(",") : val))
              .pipe(Tolerations)
              .optional(),
          })
     
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1414** (2025-04-23): **[TRI-3871] The new alerts modal doesn't work if you have a Slack connection that is revoked/expired**
  *Symptoms*: ## Problem  If you try and add a new alert when you have already connected a Slack account that has been revoked/expired the page won't load and will error out. This means it's impossible to add new alerts (of any kind) until the relevant row from the `OrganizationIntegration` table has been removed.  ## Reproduce  1. Add a new alert using Slack ![CleanShot 2024-10-16 at 11 59 13@2x](https://github.com/user-attachments/assets/504fd5c3-f3b2-48ac-8186-87f75404c83a)  2. After it is added, revoke access to your Slack. https://slack.com/intl/en-gb/help/articles/360003125231-Remove-apps-and-customised-integrations-from-your-workspace  3. Delete the original alert and try add a new one. You should see an error and be unable to do it.    <sub>[TRI-3871](https://linear.app/triggerdotdev/issue/TRI-3871/the-new-alerts-modal-doesnt-work-if-you-have-a-slack-connection-that)</sub>

- **Issue #1411** (2024-10-17): **[TRI-3867] Updating lots of environment variables at once fails with a transaction timeout**
  *Symptoms*: When we bulk upsert environment variables we wrap the entire thing in a database transaction. If there are a lot of env vars (e.g. more than 100) then the transaction can timeout.  You can see in the current code that the transaction is wrapped around the for loop: https://github.com/triggerdotdev/trigger.dev/blob/feb4fcdac675aa6c18fde4b0a96e87abc80102e2/apps/webapp/app/v3/environmentVariables/environmentVariablesRepository.server.ts#L138  Instead we should move that transaction inside the for loop. We still need the transaction so we always create all the resources for each env var and don't leave any of them dangling.  <sub>[TRI-3867](https://linear.app/triggerdotdev/issue/TRI-3867/updating-lots-of-environment-variables-at-once-fails-with-a)</sub>
  **Post-Mortem & Fix Analysis**:
  > hey @matt-aitken working in this issue
  > @matt-aitken Checkout this #1413  

- **Issue #1066** (2024-05-15): **[TRI-2392] bug: When selecting an environment from the dropdown, it's not listed correctly in the table blank state**
  *Symptoms*: ### Provide environment information  Seen on Test cloud  ### Describe the bug  When selecting an environment from the dropdown, it's not listed correctly in the table blank state  ### Reproduction repo  Seen on Test cloud  ### To reproduce  On the Runs page, select an environment from the filters that has no runs.  ![CleanShot 2024-04-26 at 11 55 12](https://uploads.linear.app/80a884b1-f84c-49d6-91db-07a391663d20/768fa0a8-5e2b-428e-bff5-3aefcff84847/92e56b36-db6c-4aba-b0d7-f6eb0b82f936?signature=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRoIjoiLzgwYTg4NGIxLWY4NGMtNDlkNi05MWRiLTA3YTM5MTY2M2QyMC83NjhmYTBhOC01ZTJiLTQyOGUtYmZmNS0zYWVmY2ZmODQ4NDcvOTJlNTZiMzYtZGI2Yy00YWJhLWIwZDctZjZlYjBiODJmOTM2IiwiaWF0IjoxNzE0MTI4OTUyLCJleHAiOjE3MTQyMTUzNTJ9.ilVVUypjBk0qxQwi_g8oqdKdOTEi101N-9fPZjEODiU)  ### Additional information  *No response*  <sub>From [SyncLinear.com](https://synclinear.com) | [TRI-2392](https://linear.app/triggerdotdev/issue/TRI-2392/bug-when-selecting-an-environment-from-the-dropdown-its-not-listed)</sub>
  **Post-Mortem & Fix Analysis**:
  > @samejr do you have this image still? It's gone
  > @samejr actually can you verify this is still a bug
  > This has been resolved with the new filters feature.

- **Issue #670** (2025-04-01): **[TRI-1434] bug: Running `npx @trigger.dev/cli@latest init` spews npm WARN logs**
  *Symptoms*: ### Provide environment information  ``` System:     OS: macOS 13.6     CPU: (12) arm64 Apple M2 Max     Memory: 11.77 GB / 64.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 20.8.0 - ~/.pkgx/nodejs.org/v20.8.0/bin/node     npm: 10.1.0 - ~/.pkgx/npmjs.com/v10.1.0/bin/npm   Managers:     pip3: 23.2.1 - ~/.pkgx/pip.pypa.io/v23.2.1/bin/pip3     RubyGems: 3.0.3.1 - /usr/bin/gem   Utilities:     Make: 3.81 - /usr/bin/make     GCC: 15.0.0 - /usr/bin/gcc     Git: 2.42.0 - /Users/mfts/.pkgx/git-scm.org/v2.42.0/bin/git     Clang: 15.0.0 - /usr/bin/clang     Curl: 8.3.0 - /Users/mfts/.pkgx/curl.se/v8.3.0/bin/curl   Servers:     Apache: 2.4.56 - /usr/sbin/apachectl   Virtualization:     Docker: 24.0.6 - /usr/local/bin/docker   IDEs:     VSCode: 1.83.1 - /usr/local/bin/code     Vim: 9.0 - /usr/bin/vim     Xcode: /undefined - /usr/bin/xcodebuild   Languages:     Bash: 3.2.57 - /bin/bash     Perl: 5.38.0 - /Users/mfts/.pkgx/perl.org/v5.38.0/bin/perl     Python: 3.11.6 - /Users/mfts/.pkgx/pipenv.pypa.io/v2023.9.1/bin/python     Python3: 3.11.6 - /Users/mfts/.pkgx/python.org/v3.11.6/bin/python3     Ruby: 2.6.10 - /usr/bin/ruby   Databases:     PostgreSQL: 15.3 - /Applications/Postgres.app/Contents/Versions/latest/bin/postgres     SQLite: 3.39.2 - /Users/mfts/.pkgx/sqlite.org/v3.43.1/bin/sqlite3   Browsers:     Chrome: 118.0.5993.88     Safari: 16.6 ```  node 20.8.0 / npm 10.1.0  ### Describe the bug  ```sh $ npx @trigger.dev/cli@latest init -k t
  **Post-Mortem & Fix Analysis**:
  > v2 is deprecated as of Jan 31 2025

- **Issue #645** (2023-10-31): **bug: `AirtableFieldSet` does not expose type matching Airtable Formula fields with error**
  *Symptoms*: ### Provide environment information  ❯ npx envinfo --system --binaries    System:     OS: macOS 13.5     CPU: (8) x64 Intel(R) Core(TM) i7-1068NG7 CPU @ 2.30GHz     Memory: 34.34 MB / 32.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 20.8.0 - ~/.volta/tools/image/node/20.8.0/bin/node     npm: 10.1.0 - ~/.volta/tools/image/node/20.8.0/bin/npm     pnpm: 8.7.6 - ~/.volta/bin/pnpm     Watchman: 2023.09.04.00 - /usr/local/bin/watchman  ### Describe the bug  `AirtableFieldSet` does not expose correct type for Airtable Formula fields with errors.  When creating a type/interface to represent an Airtable record with formulas - if the formula inside Airtable has errors, this cannot be typed through `@trigger.dev/airtable`.  E.g.:   ```ts type FormulaFieldType = string; type FormulaFieldErrorType  = { error: string; };  export interface MyTable extends AirtableFieldSet {     ID: number;     MyFormulaField: FormulaFieldType | FormulaFieldErrorType } ```  Gives: ``` TS2411: Property  MyFormulaField  of type  string | FormulaFieldErrorType  is not assignable to  string  index type string | number | boolean | Collaborator | Collaborator[] | string[] | Attachment[] | undefined ```  The actual response data looks like this from within Trigger.dev: ```json [   {     "id": "recXXX",     "fields": {       "ID": 1,       "ValidFormulaField": "Some value",       "InvalidFormulaField": {         "error": "#ERROR!"       },       ...     }  
  **Post-Mortem & Fix Analysis**:
  > @martinse do you happed to know if the official Airtable Node SDK supports this?   We're just wrapping their SDK and it's possible we've done something incorrect with the types we pass to their generic function.
  > Looking at the types from the official Airtable SDK I see the similar type def:  ```ts export interface FieldSet {     [key: string]: undefined | string | number | boolean | Collaborator | ReadonlyArray<Collaborator> | ReadonlyArray<string> | ReadonlyArray<Attachment>; } ```  Also reading their documentation at https://airtable.com/developers/web/api/field-model#formula it might be that they haven't defined the type correctly:  ``` Cell format (read only)  string | number ```  I can't find any reference to this error object that I get back in their documentation. I was thinking perhaps Trigger.dev defined their own types due to the custom type in `@trigger.dev/airtable` but it seems as it just mirrors the official SDK type.
  > Just did some testing and you would have to extend that error type further, e.g. due to division by zero:  ```ts type FormulaFieldErrorType = { error: string } | { specialValue: "Infinity" | "NaN" }; ```  As you verified, types are indeed incorrect in the official SDK.  Sadly, I can't recommend opening an issue in [their repo](https://github.com/Airtable/airtable.js). It seems largely unmaintained. There are still valid open issues from 5 years back that haven't received any attention.  I don't see a way to fix this nicely from our end - we'll likely have to resort to `// @ts-ignore` in a few places.

- **Issue #641** (2023-10-20): **bug: pagination error in job-run page**
  *Symptoms*: ### Provide environment information  System:     OS: macOS 13.4.1     CPU: (10) arm64 Apple M1 Pro     Memory: 66.91 MB / 16.00 GB     Shell: 5.9 - /bin/zsh Binaries:     Node: 18.15.0 - ~/.nvm/versions/node/v18.15.0/bin/node     npm: 9.6.4 - ~/.nvm/versions/node/v18.15.0/bin/npm     pnpm: 7.18.1 - ~/.nvm/versions/node/v18.15.0/bin/pnpm  ### Describe the bug  Pagination in the Job Runs page doesn't work as expected.  When we navigate between the pages using `next` and `prev`, and finally end up on the initial page, it still shows the `prev` button. This shouldn't be shown since it is the first page of the run list. Also, when this `prev` button is clicked, it shows a page with just the first run item and no more `prev`/`next` buttons to navigate.  https://github.com/triggerdotdev/trigger.dev/assets/132386067/5711f1c2-6fda-4d92-8521-27cb27f5bc10   ### Reproduction repo  none  ### To reproduce  1. Create a job with more than 20 job runs. 2. Go to the job run page and navigate between the pages.  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @hmacr I've experienced this as well. It'd be great to fix it
  > @matt-aitken Cool! I just created a PR 😊

- **Issue #611** (2023-10-13): **[TRI-1397] bug: intervalTriggers of >10 mins don't ever start in Staging/Prod**
  *Symptoms*: ### Provide environment information  Only Prod and Staging  ### Describe the bug  - The `RecurringEndpointIndexService` automatically indexes all STAGING and PROD environments every 10 mins.  - If an `intervalTrigger` hasn't fired yet, it seems to be rescheduling the first time it fires. - This means if the `intervalTrigger` interval is long enough, it will never fire the first event and then start working.  Note that this doesn't seem to be impacting schedules that have already fired in that environment.  ### Reproduction repo  -  ### To reproduce  1. Create an `intervalTrigger` with a value greater than 600 seconds.  2. Use the PROD or STAGING environments (you could use ngrok/Cloudflare) and just point it locally using the environments page. 3. Wait, it'll never fire because the first time will keep getting pushed back by the `RecurringEndpointIndexService` every 10 mins.  ### Additional information  _No response_  <sub>[TRI-1397](https://linear.app/triggerdotdev/issue/TRI-1397/bug-intervaltriggers-of-10-mins-dont-ever-start-in-stagingprod)</sub>
  **Post-Mortem & Fix Analysis**:
  > @ericallam also worth noting that when we forced that one to start using the Graphile job, it's not sticking to the schedule.  Should be every 30 mins but isn't ![CleanShot 2023-10-12 at 12 32 48](https://github.com/triggerdotdev/trigger.dev/assets/10635986/5369ab7f-15a9-4fe5-8173-3e0f75aca9fa) 

- **Issue #599** (2025-04-01): **[TRI-1392] yarn dlx @trigger.dev/cli@latest init fails**
  *Symptoms*: It seems to have an issue with the mock-fs package. This package needs to be in dependencies because of how we've setup some of the tests.  ## To reproduce  Run `yarn dlx @trigger.dev/cli@latest init` in a blank Next.js project.  NOTE: this is only an issue with Yarn.  You'll see this output:  ``` yarn dlx @trigger.dev/cli@latest init ➤ YN0000: ┌ Resolution step ➤ YN0032: │ fsevents@npm:2.3.3: Implicit dependencies on node-gyp are discouraged ➤ YN0000: └ Completed in 5s 870ms ➤ YN0000: ┌ Fetch step ➤ YN0000: └ Completed ➤ YN0000: ┌ Link step ➤ YN0000: │ ESM support for PnP uses the experimental loader API and is therefore experimental ➤ YN0007: │ ngrok@npm:5.0.0-beta.2 must be built because it never has been before or the last one failed ➤ YN0000: └ Completed in 0s 919ms ➤ YN0000: Done with warnings in 6s 937ms  /Users/matt/.yarn/berry/cache/mock-fs-npm-5.2.0-5103a7b507-8.zip/node_modules/mock-fs/lib/readfilecontext.js:43   const origRead = prototype.read;                              ^  TypeError: Cannot read properties of undefined (reading 'read')     at exports.patchReadFileContext (/Users/matt/.yarn/berry/cache/mock-fs-npm-5.2.0-5103a7b507-8.zip/node_modules/mock-fs/lib/readfilecontext.js:43:30)     at Object.<anonymous> (/Users/matt/.yarn/berry/cache/mock-fs-npm-5.2.0-5103a7b507-8.zip/node_modules/mock-fs/lib/index.js:57:1)     at Module._compile (node:internal/modules/cjs/loader:1165:14)     at Object.Module._extensions..js (node:internal/modules/cjs/loader:1219:10)   
  **Post-Mortem & Fix Analysis**:
  > can I take up this issue? Thanks
  > @matt-aitken  I tried  npx @trigger.dev/cli@latest init and  pnpm dlx @trigger.dev/cli@latest init both worked fine for me without any issues. But while running yarn dlx @trigger.dev/cli@latest init I am facing different issue dlx Command not found.   So is this only reproducible with yarn dlx ?
  > Yes, this is only an issue with yarn @RamK777-stack 

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

### Incident Patch 1: `e82eca1b` (2026-09-30)
**Commit Message**: fix(webapp): preserve log search batches with invalid JSON escapes

Prevent log search batches from being lost when a message contains an
invalid JSON escape. Search inserts now use the same lenient escape
setting as source inserts and share the existing bounded
sanitize/row-skip recovery, so an unrepairable row does not discard its
neighbors.

Drop counters start at zero for each reason, and recovered batches count
only skipped rows as dropped.

Mono-RevId: 353071db24c77a392baaa7cb96340f6ab64d8e3e

**File**: `apps/webapp/app/v3/eventRepository/clickhouseEventRepository.server.ts` (modified, +50/-19)
```diff
@@ -71,6 +71,7 @@ import type {
   TraceEventOptions,
   TraceSummary,
 } from "./eventRepository.types";
+import { insertLogsSearchRows } from "./insertLogsSearchRows.server";
 import {
   insertWithBadRowSkip,
   type JsonParseRecoveryOutcome,
@@ -233,6 +234,19 @@ export class ClickhouseEventRepository implements IEventRepository {
       "logs_search.dual_write.rows_dropped",
       { unit: "rows" }
     );
+    for (const reason of [
+      "limiter_full",
+      "shutdown",
+      "source_recovered",
+      "mapping_failed",
+      "insert_failed",
+      "parse_failed",
+    ]) {
+      this._logsSearchRowsDroppedCounter.add(0, {
+        ...this._logsSearchMetricAttributes,
+        reason,
+      });
+    }
     this._logsSearchBatchesCounter = meter.createCounter("logs_search.dual_write.batches", {
       unit: "batches",
     });
@@ -575,34 +589,51 @@ export class ClickhouseEventRepository implements IEventRepository {
 
   async #insertLogsSearchRows(flushId: string, rows: TaskEventSearchV2Input[]): Promise<void> {
     const startedAt = Date.now();
-    let lastError: { clickhouseErrorType?: string } | undefined;
+    let lastError: unknown;
 
     for (let attempt = 1; attempt <= 2; attempt++) {
-      const [error] = await this._logsSearchClickhouse.taskEventsSearch.insert(rows, {
-        params: {
-          clickhouse_settings: {
-            async_insert: 0,
-            insert_deduplication_token: flushId,
-          },
-        },
-      });
-
-      if (!error) {
-        this._logsSearchRowsLandedCounter.add(rows.length, this._logsSearchMetricAttributes);
+      try {
+        const outcome = await insertLogsSearchRows(
+          this._logsSearchClickhouse.taskEventsSearch.insert,
+          flushId,
+          rows,
+          logger
+        );
+        const dropped = outcome.kind === "recovered" ? outcome.rowsDropped : 0;
+        if (dropped > 0) {
+          this._logsSearchRowsDroppedCounter.add(dropped, {
+            ...this._logsSearchMetricAttributes,
+            reason: "parse_failed",
+          });
+        }
+        if (outcome.kind !== "recovered" || outcome.rowsDroppedExact) {
+          this._logsSearchRowsLandedCounter.add(
+            rows.length - dropped,
+            this._logsSearchMetricAttributes
+          );
+        }
         this._logsSearchBatchesCounter.add(1, {
           ...this._logsSearchMetricAttributes,
-          outcome: attempt === 1 ? "ok" : "retried_ok",
+          outcome: landedNothing(outcome, rows.length)
+            ? "failed"
+            : outcome.kind === "recovered"
+              ? outcome.rowsDroppedExact
+                ? "recovered"
+                : "recovered_unknown"
+              : attempt === 1 && outcome.kind === "inserted"
+                ? "ok"
+                : "retried_ok",
         });
         this._logsSearchFlushDurationHistogram.record(
           Date.now() - startedAt,
           this._logsSearchMetricAttributes
         );
         return;
-      }
-
-      lastError = error;
-      if (attempt === 1) {
-        await new Promise((resolve) => setTimeout(resolve, 500));
+      } catch (error) {
+        lastError = error;
+        if (attempt === 1) {
+          await new Promise((resolve) => setTimeout(resolve, 500));
+        }
       }
     }
 
@@ -621,7 +652,7 @@ export class ClickhouseEventRepository implements IEventRepository {
     logger.error("Logs search dual-write insert failed", {
       flushId,
       rows: rows.length,
-      clickhouseErrorType: lastError?.clickhouseErrorType,
+      error: lastError,
     });
   }
 
```

**File**: `apps/webapp/app/v3/eventRepository/insertLogsSearchRows.server.ts` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import type { ClickHouse, ClickHouseSettings, TaskEventSearchV2Input } from "@internal/clickhouse";
+import {
+  insertWithBadRowSkip,
+  isClickHouseJsonParseError,
+  type JsonParseRecoveryLogger,
+} from "./sanitizeRowsOnParseError.server";
+
+export function insertLogsSearchRows(
+  insertRows: ClickHouse["taskEventsSearch"]["insert"],
+  flushId: string,
+  rows: TaskEventSearchV2Input[],
+  logger: JsonParseRecoveryLogger
+) {
+  const insert = async (batch: TaskEventSearchV2Input[], settings?: ClickHouseSettings) => {
+    const [error, result] = await insertRows(batch, {
+      params: {
+        clickhouse_settings: {
+          async_insert: 0,
+          insert_deduplication_token: flushId,
+          ...settings,
+        },
+      },
+    });
+    if (error) throw error;
+    return result;
+  };
+
+  return insertWithBadRowSkip({
+    rows,
+    contextLabel: "task_events_search_v2",
+    logger,
+    logContext: { flushId },
+    hasMaterializedViews: false,
+    isParseError: (error) =>
+      isClickHouseJsonParseError(error) ||
+      (typeof error === "object" &&
+        error !== null &&
+        "clickhouseErrorType" in error &&
+        error.clickhouseErrorType === "CANNOT_PARSE_ESCAPE_SEQUENCE"),
+    insert: (batch) => insert(batch),
+    insertAllowingBadRows: (batch) =>
+      insert(batch, {
+        input_format_parallel_parsing: 0,
+        input_format_allow_errors_num: String(batch.length),
+        input_format_allow_errors_ratio: 1,
+      }),
+  });
+}
```

**File**: `apps/webapp/app/v3/eventRepository/sanitizeRowsOnParseError.server.ts` (modified, +12/-5)
```diff
@@ -435,12 +435,13 @@ export async function insertWithLimitedStrip<T extends object>(params: {
  */
 async function tryInsertAllowingBadRows<T extends object>(
   insertAllowingBadRows: (rows: T[]) => Promise<unknown>,
-  rows: T[]
+  rows: T[],
+  isParseError: (error: unknown) => boolean = isClickHouseJsonParseError
 ): Promise<[unknown, undefined] | [undefined, unknown]> {
   try {
     return [undefined, await insertAllowingBadRows(rows)];
   } catch (error) {
-    if (!isClickHouseJsonParseError(error)) throw error;
+    if (!isParseError(error)) throw error;
     return [error, undefined];
   }
 }
@@ -565,14 +566,16 @@ export async function insertWithBadRowSkip<T extends object>(params: {
   insert: (rows: T[]) => Promise<unknown>;
   insertAllowingBadRows: (rows: T[]) => Promise<unknown>;
   hasMaterializedViews?: boolean;
+  isParseError?: (error: unknown) => boolean;
 }): Promise<JsonParseRecoveryOutcome> {
   const { rows, contextLabel, logger, logContext, insert, insertAllowingBadRows } = params;
   const hasMaterializedViews = params.hasMaterializedViews ?? true;
+  const isParseError = params.isParseError ?? isClickHouseJsonParseError;
 
   try {
     return { kind: "inserted", insertResult: await insert(rows) };
   } catch (firstError) {
-    if (!isClickHouseJsonParseError(firstError)) throw firstError;
+    if (!isParseError(firstError)) throw firstError;
 
     const firstMessage = errorMessage(firstError);
     const { rowsTouched, fieldsSanitized } = sanitizeRows(rows);
@@ -590,11 +593,15 @@ export async function insertWithBadRowSkip<T extends object>(params: {
       try {
         return { kind: "sanitized", insertResult: await insert(rows) };
       } catch (retryError) {
-        if (!isClickHouseJsonParseError(retryError)) throw retryError;
+        if (!isParseError(retryError)) throw retryError;
       }
     }
 
-    const [skipError, insertResult] = await tryInsertAllowingBadRows(insertAllowingBadRows, rows);
+    const [skipError, insertResult] = await tryInsertAllowingBadRows(
+      insertAllowingBadRows,
+      rows,
+      isParseError
+    );
 
     if (skipError) {
       return wholeBatchDropped({
```

**File**: `apps/webapp/test/clickhouseEventRepositoryDualWrite.test.ts` (modified, +79/-2)
```diff
@@ -1,11 +1,22 @@
-import { ClickHouse, type TaskEventV2Input } from "@internal/clickhouse";
+import {
+  ClickHouse,
+  TASK_EVENT_SEARCH_V2_INSERT_COLUMNS,
+  toTaskEventSearchV2Row,
+  type TaskEventSearchV2Input,
+  type TaskEventV2Input,
+} from "@internal/clickhouse";
 import { clickhouseTest } from "@internal/testcontainers";
 import { describe, expect, vi } from "vitest";
 import { z } from "zod";
 import {
   ClickhouseEventRepository,
   logsSearchRolloutSelectedRowCount,
 } from "~/v3/eventRepository/clickhouseEventRepository.server";
+import { insertLogsSearchRows } from "~/v3/eventRepository/insertLogsSearchRows.server";
+import {
+  INVALID_UTF16_SENTINEL,
+  insertWithBadRowSkip,
+} from "~/v3/eventRepository/sanitizeRowsOnParseError.server";
 import { latestMetrics, metricSum } from "./otlpMetrics.helpers";
 import { createInMemoryMetrics } from "./utils/tracing";
 
@@ -86,7 +97,10 @@ describe("ClickhouseEventRepository logs search dual writer", () => {
 
       try {
         const allowedEvents = Array.from({ length: 1_000 }, (_, index) =>
-          event({ span_id: `span_allowed_${index}` })
+          event({
+            span_id: `span_allowed_${index}`,
+            message: index === 500 ? "broken \uD800 escape" : "source write survives",
+          })
         );
         (repository as any).addToBatch([
           ...allowedEvents,
@@ -127,6 +141,63 @@ describe("ClickhouseEventRepository logs search dual writer", () => {
     60_000
   );
 
+  clickhouseTest(
+    "recovers a strict search insert without losing neighboring rows",
+    async ({ clickhouseContainer }) => {
+      const clickhouse = new ClickHouse({
+        url: clickhouseContainer.getConnectionUrl(),
+        logLevel: "error",
+      });
+      const strictInsert = clickhouse.writer.insertUnsafe<TaskEventSearchV2Input>({
+        name: "strict-search-insert",
+        table: "trigger_dev.task_events_search_v2",
+        columns: TASK_EVENT_SEARCH_V2_INSERT_COLUMNS,
+        settings: { input_format_json_throw_on_bad_escape_sequence: 1 },
+      });
+      const rows = ["clean prefix", "broken \uD800 escape", "clean suffix"].map((message, index) =>
+        toTaskEventSearchV2Row(event({ message, span_id: `span_${index}` }), new Date())
+      );
+      const readMessages = clickhouse.reader.query({
+        name: "read-recovered-search-messages",
+        query: `SELECT message FROM trigger_dev.task_events_search_v2
+          WHERE environment_id = {environmentId: String} ORDER BY span_id`,
+        params: z.object({ environmentId: z.string() }),
+        schema: z.object({ message: z.string() }),
+      });
+
+      try {
+        const [error] = await strictInsert(rows);
+        expect(error?.clickhouseErrorType).toBe("CANNOT_PARSE_ESCAPE_SEQUENCE");
+        const insert = async (batch: TaskEventSearchV2Input[]) => {
+          const [insertError, result] = await strictInsert(batch);
+          if (insertError) throw insertError;
+          return result;
+        };
+        await expect(
+          insertWithBadRowSkip({
+            rows,
+            contextLabel: "default-recovery",
+            logger: console,
+            insert,
+            insertAllowingBadRows: insert,
+          })
+        ).rejects.toMatchObject({ clickhouseErrorType: "CANNOT_PARSE_ESCAPE_SEQUENCE" });
+        const outcome = await insertLogsSearchRows(strictInsert, "strict-recovery", rows, console);
+        expect(outcome.kind).toBe("sanitized");
+        const [queryError, messages] = await readMessages({ environmentId: "env_dual_write_test" });
+        expect(queryError).toBeNull();
+        expect(messages).toEqual([
+          { message: "clean prefix" },
+          { message: INVALID_UTF16_SENTINEL },
+          { message: "clean suffix" },
+        ]);
+      } finally {
+        await clickhouse.close();
+      }
+    },
+    60_000
+  );
+
   clickhouseTest(
     "records mapping failures as dropped search rows",
     async ({ clickhou
```

**File**: `apps/webapp/test/sanitizeRowsOnParseError.test.ts` (modified, +12/-0)
```diff
@@ -74,6 +74,18 @@ describe("isClickHouseJsonParseError", () => {
     expect(isClickHouseJsonParseError(err)).toBe(true);
   });
 
+  it("does not classify escape errors as native JSON parse errors", () => {
+    expect(
+      isClickHouseJsonParseError({ type: "CANNOT_PARSE_ESCAPE_SEQUENCE", message: "bad escape" })
+    ).toBe(false);
+    expect(
+      isClickHouseJsonParseError({
+        clickhouseErrorType: "CANNOT_PARSE_ESCAPE_SEQUENCE",
+        message: "bad escape",
+      })
+    ).toBe(false);
+  });
+
   it("returns false for unrelated errors", () => {
     expect(isClickHouseJsonParseError(new Error("Connection refused"))).toBe(false);
     expect(
```

---

### Incident Patch 2: `84dd4a4c` (2026-09-30)
**Commit Message**: fix(webapp): load billing on instances served on a private origin

An instance served on a private origin can now tell it is part of the managed cloud from its public dashboard origin (`PUBLIC_APP_ORIGIN`). It loads billing data, limits and usage like the public dashboard. Instances that don't set it behave exactly as before.

Mono-RevId: 17579507956cb9ce357519cf65f32bdd8586e5fc

**File**: `apps/webapp/app/env.server.ts` (modified, +1/-0)
```diff
@@ -403,6 +403,7 @@ const EnvironmentSchema = z
     LOGIN_ORIGIN: z.string().default("http://localhost:3030"),
     LOGIN_RATE_LIMITS_ENABLED: BoolEnv.default(true),
     APP_ORIGIN: z.string().default("http://localhost:3030"),
+    PUBLIC_APP_ORIGIN: z.url().optional(),
     // Extra exact origins (comma separated) added to the document `img-src` CSP,
     // e.g. an SSO host serving profile images. Wildcards are refused.
     CSP_IMG_SRC_ALLOWLIST: z.string().optional(),
```

**File**: `apps/webapp/app/features.server.ts` (modified, +6/-3)
```diff
@@ -7,11 +7,14 @@ export type TriggerFeatures = {
   queueMetricsQueryTables: boolean;
 };
 
+const MANAGED_CLOUD_HOSTS = ["cloud.trigger.dev", "test-cloud.trigger.dev", "internal.trigger.dev"];
+
+const publicAppHost = env.PUBLIC_APP_ORIGIN ? new URL(env.PUBLIC_APP_ORIGIN).host : undefined;
+
 function isManagedCloud(host: string): boolean {
   return (
-    host === "cloud.trigger.dev" ||
-    host === "test-cloud.trigger.dev" ||
-    host === "internal.trigger.dev" ||
+    MANAGED_CLOUD_HOSTS.includes(host) ||
+    (publicAppHost !== undefined && MANAGED_CLOUD_HOSTS.includes(publicAppHost)) ||
     process.env.CLOUD_ENV === "development"
   );
 }
```

**File**: `apps/webapp/app/services/platform.v3.server.ts` (modified, +4/-0)
```diff
@@ -1284,6 +1284,10 @@ export function isCloud(): boolean {
     return true;
   }
 
+  if (env.PUBLIC_APP_ORIGIN && acceptableHosts.includes(env.PUBLIC_APP_ORIGIN)) {
+    return true;
+  }
+
   if (process.env.CLOUD_ENV === "development" && process.env.NODE_ENV === "development") {
     return true;
   }
```

---

### Incident Patch 3: `5ae0adfb` (2026-09-29)
**Commit Message**: fix(webapp): require permission to manage private connections

Mono-RevId: 8711c9639a3d9afa5857a418af147ca88df5014f

**File**: `apps/webapp/app/routes/_app.orgs.$organizationSlug.settings.private-connections._index/route.tsx` (modified, +90/-46)
```diff
@@ -5,7 +5,7 @@ import {
   TrashIcon,
 } from "@heroicons/react/20/solid";
 import { Form, useRevalidator } from "@remix-run/react";
-import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/server-runtime";
+import { json, type LoaderFunctionArgs } from "@remix-run/server-runtime";
 import { tryCatch } from "@trigger.dev/core/utils";
 import type { PrivateLinkConnectionStatus } from "@trigger.dev/platform";
 import { useMemo, useState } from "react";
@@ -20,8 +20,11 @@ import { Header2 } from "~/components/primitives/Headers";
 import { NavBar, PageAccessories, PageTitle } from "~/components/primitives/PageHeader";
 import { Paragraph } from "~/components/primitives/Paragraph";
 import { prisma } from "~/db.server";
+import { rbac } from "~/services/rbac.server";
 import { useInterval } from "~/hooks/useInterval";
 import { redirectWithErrorMessage, redirectWithSuccessMessage } from "~/models/message.server";
+import { resolveOrgIdFromSlug } from "~/models/organization.server";
+import { dashboardAction } from "~/services/routeBuilders/dashboardBuilder";
 import { logger } from "~/services/logger.server";
 import { deletePrivateLink, getPrivateLinks } from "~/services/platform.v3.server";
 import { requireUserId } from "~/services/session.server";
@@ -54,6 +57,13 @@ export async function loader({ params, request }: LoaderFunctionArgs) {
     throw new Response(null, { status: 404, statusText: "Organization not found" });
   }
 
+  const sessionAuth = await rbac.authenticateSession(request, {
+    userId,
+    organizationId: organization.id,
+  });
+  const canManageConnections =
+    sessionAuth.ok && sessionAuth.ability.can("write", { type: "privateConnections" });
+
   const [error, connections] = await tryCatch(getPrivateLinks(organization.id));
   if (error) {
     logger.error("Error loading private link connections", {
@@ -65,52 +75,63 @@ export async function loader({ params, request }: LoaderFunctionArgs) {
   return typedjson({
     connections: connections?.connections ?? [],
     organizationId: organization.id,
+    canManageConnections,
   });
 }
 
-export const action = async ({ request, params }: ActionFunctionArgs) => {
-  const userId = await requireUserId(request);
-  const { organizationSlug } = OrganizationParamsSchema.parse(params);
+export const action = dashboardAction(
+  {
+    params: OrganizationParamsSchema,
+    context: async (params) => {
+      const organizationId = await resolveOrgIdFromSlug(params.organizationSlug);
+      return organizationId ? { organizationId } : {};
+    },
+    authorization: { action: "write", resource: { type: "privateConnections" } },
+  },
+  async ({ request, params }) => {
+    const userId = await requireUserId(request);
+    const { organizationSlug } = params;
 
-  if (request.method !== "DELETE" && request.method !== "POST") {
-    return json({ error: "Method not allowed" }, { status: 405 });
-  }
+    if (request.method !== "DELETE" && request.method !== "POST") {
+      return json({ error: "Method not allowed" }, { status: 405 });
+    }
 
-  const formData = await request.formData();
-  const connectionId = formData.get("connectionId");
-  const intent = formData.get("intent");
+    const formData = await request.formData();
+    const connectionId = formData.get("connectionId");
+    const intent = formData.get("intent");
 
-  if (intent !== "delete" || typeof connectionId !== "string") {
-    return json({ error: "Invalid request" }, { status: 400 });
-  }
+    if (intent !== "delete" || typeof connectionId !== "string") {
+      return json({ error: "Invalid request" }, { status: 400 });
+    }
 
-  const organization = await prisma.organization.findFirst({
-    where: { slug: organizationSlug, members: { some: { userId } } },
-  });
+    const organization = await prisma.organization.findFirst({
+      where: { slug: organizationSlug, members: { some: { userId } } },
+    });
 
-  if (!organization) {
-    return redirectW
```

**File**: `apps/webapp/app/routes/_app.orgs.$organizationSlug.settings.private-connections.new/route.tsx` (modified, +87/-54)
```diff
@@ -1,7 +1,7 @@
 import { getFormProps, getInputProps, getSelectProps, useForm } from "@conform-to/react";
 import { parseWithZod } from "@conform-to/zod/v4";
 import { Form, useActionData, useParams } from "@remix-run/react";
-import { json, type ActionFunction, type LoaderFunctionArgs } from "@remix-run/server-runtime";
+import { json, type LoaderFunctionArgs } from "@remix-run/server-runtime";
 import { tryCatch } from "@trigger.dev/core/utils";
 import { useState } from "react";
 import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
@@ -12,6 +12,7 @@ import {
   PageContainer,
 } from "~/components/layout/AppLayout";
 import { Button, LinkButton } from "~/components/primitives/Buttons";
+import { PermissionDenied } from "~/components/PermissionDenied";
 import { ClipboardField } from "~/components/primitives/ClipboardField";
 import { Fieldset } from "~/components/primitives/Fieldset";
 import { FormButtons } from "~/components/primitives/FormButtons";
@@ -27,8 +28,11 @@ import { prisma } from "~/db.server";
 import { env } from "~/env.server";
 import { canAccessPrivateConnections } from "~/v3/canAccessPrivateConnections.server";
 import { redirectWithErrorMessage, redirectWithSuccessMessage } from "~/models/message.server";
+import { resolveOrgIdFromSlug } from "~/models/organization.server";
+import { dashboardAction } from "~/services/routeBuilders/dashboardBuilder";
 import type { CreatePrivateLinkConnectionBody } from "@trigger.dev/platform";
 import { createPrivateLink, getPrivateLinkRegions } from "~/services/platform.v3.server";
+import { rbac } from "~/services/rbac.server";
 import { requireUserId } from "~/services/session.server";
 import {
   docsPath,
@@ -69,6 +73,13 @@ export async function loader({ params, request }: LoaderFunctionArgs) {
     throw new Response(null, { status: 404, statusText: "Organization not found" });
   }
 
+  const sessionAuth = await rbac.authenticateSession(request, {
+    userId,
+    organizationId: organization.id,
+  });
+  const canManageConnections =
+    sessionAuth.ok && sessionAuth.ability.can("write", { type: "privateConnections" });
+
   const [_error, regions] = await tryCatch(getPrivateLinkRegions(organization.id));
 
   const awsAccountIds = env.PRIVATE_CONNECTIONS_AWS_ACCOUNT_IDS?.split(",").filter(Boolean) ?? [];
@@ -77,6 +88,7 @@ export async function loader({ params, request }: LoaderFunctionArgs) {
     availableRegions: regions?.availableRegions ?? ["us-east-1", "eu-central-1"],
     activeRegions: regions?.activeRegions ?? [],
     awsAccountIds,
+    canManageConnections,
   });
 }
 
@@ -92,66 +104,76 @@ const schema = z.object({
   targetRegion: z.string().min(1, "Region is required"),
 });
 
-export const action: ActionFunction = async ({ request, params }) => {
-  const userId = await requireUserId(request);
-  const { organizationSlug } = OrganizationParamsSchema.parse(params);
-
-  const formData = await request.formData();
-  const submission = parseWithZod(formData, { schema });
-
-  if (submission.status !== "success") {
-    return json(submission.reply());
-  }
-
-  const organization = await prisma.organization.findFirst({
-    where: { slug: organizationSlug, members: { some: { userId } } },
-  });
-
-  if (!organization) {
-    return redirectWithErrorMessage(
-      v3PrivateConnectionsPath({ slug: organizationSlug }),
-      request,
-      "Organization not found"
+export const action = dashboardAction(
+  {
+    params: OrganizationParamsSchema,
+    context: async (params) => {
+      const organizationId = await resolveOrgIdFromSlug(params.organizationSlug);
+      return organizationId ? { organizationId } : {};
+    },
+    authorization: { action: "write", resource: { type: "privateConnections" } },
+  },
+  async ({ request, params }) => {
+    const userId = await requireUserId(request);
+    const { organizationSlug } = params;
+
+    const formData = await request.formData();
+    const submission = parseWithZod(
```

---

### Incident Patch 4: `174b64fb` (2026-09-29)
**Commit Message**: fix(webapp): scope API key permissions to the organization

Use the target project's role when checking access to environment API
keys.

Mono-RevId: 05828afe9b804a3060fb5b15b4a62460ee98acf3

**File**: `apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.apikeys/route.tsx` (modified, +3/-0)
```diff
@@ -74,6 +74,7 @@ import {
   validateCreateApiKeyPreset,
   type ApiKeyPreset,
 } from "~/services/apiKeyPresetValidation.server";
+import { resolveProjectAuthScope } from "~/services/projectAuthScope.server";
 import { rbac } from "~/services/rbac.server";
 import { dashboardAction, dashboardLoader } from "~/services/routeBuilders/dashboardBuilder";
 import { cn } from "~/utils/cn";
@@ -133,6 +134,7 @@ export const loader = dashboardLoader(
   {
     params: EnvironmentParamSchema,
     searchParams: ApiKeySearchParams,
+    context: (params) => resolveProjectAuthScope(params.organizationSlug, params.projectParam),
   },
   async ({ params, searchParams, user, ability }) => {
     try {
@@ -184,6 +186,7 @@ export const loader = dashboardLoader(
 export const action = dashboardAction(
   {
     params: EnvironmentParamSchema,
+    context: (params) => resolveProjectAuthScope(params.organizationSlug, params.projectParam),
     // The environment tier is only known after resolving the route params,
     // so write:apiKeys is enforced in the handler before any mutation.
   },
```

---

### Incident Patch 5: `f1987fe5` (2026-09-29)
**Commit Message**: fix(webapp): sanitize concurrency settings errors

Mono-RevId: 690b507e07bc08ac72d665353d7f4d86807cc462

**File**: `apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.concurrency-limits/route.tsx` (modified, +27/-8)
```diff
@@ -62,6 +62,7 @@ import {
   getSelfServePurchaseBlockReason,
 } from "~/services/platform.v3.server";
 import { textLinkClassName } from "~/components/primitives/TextLink";
+import { logger } from "~/services/logger.server";
 import { rbac } from "~/services/rbac.server";
 import { requireUserId } from "~/services/session.server";
 import { cn } from "~/utils/cn";
@@ -81,6 +82,9 @@ import { pageMeta } from "~/utils/pageTitle";
 
 export const meta = pageMeta("Manage concurrency");
 
+const LOAD_ERROR_MESSAGE = "Unable to load concurrency settings. Please try again.";
+const SAVE_ERROR_MESSAGE = "Unable to save concurrency settings. Please try again.";
+
 export const loader = async ({ request, params }: LoaderFunctionArgs) => {
   const userId = await requireUserId(request);
   const {
@@ -113,9 +117,14 @@ export const loader = async ({ request, params }: LoaderFunctionArgs) => {
   );
 
   if (error) {
+    logger.error("Failed to load concurrency settings", {
+      error,
+      organizationId: project.organizationId,
+      projectId: project.id,
+    });
     throw new Response(undefined, {
-      status: 400,
-      statusText: error.message,
+      status: 500,
+      statusText: LOAD_ERROR_MESSAGE,
     });
   }
 
@@ -201,12 +210,16 @@ export const action = async ({ request, params }: ActionFunctionArgs) => {
     );
 
     if (error) {
+      logger.error("Failed to allocate concurrency", {
+        error,
+        organizationId: project.organizationId,
+        projectId: project.id,
+      });
       return json(
         submission.reply({
-          fieldErrors: {
-            environments: [error instanceof Error ? error.message : "Unknown error"],
-          },
-        })
+          fieldErrors: { environments: [SAVE_ERROR_MESSAGE] },
+        }),
+        { status: 500 }
       );
     }
 
@@ -250,10 +263,16 @@ export const action = async ({ request, params }: ActionFunctionArgs) => {
   );
 
   if (error) {
+    logger.error("Failed to update concurrency add-on", {
+      error,
+      organizationId: project.organizationId,
+      projectId: project.id,
+    });
     return json(
       submission.reply({
-        fieldErrors: { amount: [error instanceof Error ? error.message : "Unknown error"] },
-      })
+        fieldErrors: { amount: [SAVE_ERROR_MESSAGE] },
+      }),
+      { status: 500 }
     );
   }
 
```

---

### Incident Patch 6: `1e9372f0` (2026-09-29)
**Commit Message**: fix(webapp): cast concurrency limits in allocation query

Mono-RevId: 91cf6369dd693fc72a235b7c59cb238e61210231

**File**: `apps/webapp/app/v3/services/allocateConcurrency.server.ts` (modified, +1/-1)
```diff
@@ -363,7 +363,7 @@ async function computeOrgExtraAllocatedConcurrency(
   }
 
   const limitCases = Prisma.join(
-    typeLimits.map((entry) => Prisma.sql`WHEN ${entry.type}::text THEN ${entry.limit}`),
+    typeLimits.map((entry) => Prisma.sql`WHEN ${entry.type}::text THEN ${entry.limit}::integer`),
     " "
   );
   const countableTypes = Prisma.join(typeLimits.map((entry) => entry.type));
```

**File**: `apps/webapp/test/allocateConcurrency.test.ts` (modified, +16/-1)
```diff
@@ -1,4 +1,4 @@
-import { postgresTest } from "@internal/testcontainers";
+import { postgresBlipTest, postgresTest } from "@internal/testcontainers";
 import type { PrismaClient } from "@trigger.dev/database";
 import { describe, expect, vi } from "vitest";
 import { ManageConcurrencyPresenter } from "~/presenters/v3/ManageConcurrencyPresenter.server";
@@ -176,6 +176,21 @@ describe("AllocateConcurrencyService", () => {
     }
   );
 
+  postgresBlipTest("allocates with the production database adapter", async ({ prisma }) => {
+    const { organization, project, environments } = await seedProjectWithEnvironments(prisma, 1);
+    getCurrentPlanMock.mockResolvedValue(planWithPurchasedConcurrency(10));
+
+    const service = new AllocateConcurrencyService(prisma);
+    const result = await service.call({
+      userId: "user_1",
+      projectId: project.id,
+      organizationId: organization.id,
+      environments: [{ id: environments[0].id, amount: 1 }],
+    });
+
+    expect(result).toEqual({ success: true });
+  });
+
   postgresTest(
     "rejects an allocation that exceeds the unallocated pool and syncs nothing",
     async ({ prisma }) => {
```

---

### Incident Patch 7: `2b1dd89e` (2026-09-29)
**Commit Message**: fix(webapp): authorize batch parent runs before attaching waitpoints

Mono-RevId: c69d1cf0ad5e5d77b4c00aa3c5c59f6542dea4ce

**File**: `.server-changes/batch-parent-environment.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+area: webapp
+type: fix
+---
+
+Reject batch-and-wait requests when the parent run belongs to another environment
```

**File**: `apps/webapp/app/runEngine/services/batchTrigger.server.ts` (modified, +17/-7)
```diff
@@ -7,7 +7,7 @@ import {
   parsePacket,
   TaskRunErrorCodes,
 } from "@trigger.dev/core/v3";
-import { BatchId, RunId } from "@trigger.dev/core/v3/isomorphic";
+import { BatchId } from "@trigger.dev/core/v3/isomorphic";
 import { type BatchTaskRun, Prisma } from "@trigger.dev/database";
 import { Evt } from "evt";
 import { z } from "zod";
@@ -28,6 +28,7 @@ import type { RunEngine } from "../../v3/runEngine.server";
 import { ServiceValidationError, WithRunEngine } from "../../v3/services/baseService.server";
 import { TriggerTaskService } from "../../v3/services/triggerTask.server";
 import { startActiveSpan } from "../../v3/tracer.server";
+import { resolveBatchParentRun } from "./resolveBatchParentRun.server";
 import { TriggerFailedTaskService } from "./triggerFailedTask.server";
 
 const PROCESSING_BATCH_SIZE = 50;
@@ -90,6 +91,13 @@ export class RunEngineBatchTriggerService extends WithRunEngine {
         "call()",
         environment,
         async (span) => {
+          const parentRunInternalId = await resolveBatchParentRun({
+            runStore: this._engine.runStore,
+            environmentId: environment.id,
+            parentRunId: body.parentRunId,
+            resumeParentOnCompletion: body.resumeParentOnCompletion,
+          });
+
           const { friendlyId } = await mintBatchFriendlyId({
             environment: {
               organizationId: environment.organizationId,
@@ -112,7 +120,8 @@ export class RunEngineBatchTriggerService extends WithRunEngine {
             payloadPacket,
             environment,
             body,
-            options
+            options,
+            parentRunInternalId
           );
 
           if (!batch) {
@@ -165,7 +174,8 @@ export class RunEngineBatchTriggerService extends WithRunEngine {
     payloadPacket: IOPacket,
     environment: AuthenticatedEnvironment,
     body: BatchTriggerTaskV2RequestBody,
-    options: BatchTriggerTaskServiceOptions = {}
+    options: BatchTriggerTaskServiceOptions = {},
+    parentRunInternalId?: string
   ) {
     // BatchTaskRun.runtimeEnvironmentId no longer has an FK into RuntimeEnvironment;
     // validate env existence app-side (covers both create arms below).
@@ -187,9 +197,9 @@ export class RunEngineBatchTriggerService extends WithRunEngine {
 
       this.onBatchTaskRunCreated.post(batch);
 
-      if (body.parentRunId && body.resumeParentOnCompletion) {
+      if (parentRunInternalId) {
         await this._engine.blockRunWithCreatedBatch({
-          runId: RunId.fromFriendlyId(body.parentRunId),
+          runId: parentRunInternalId,
           batchId: batch.id,
           environmentId: environment.id,
           projectId: environment.projectId,
@@ -278,9 +288,9 @@ export class RunEngineBatchTriggerService extends WithRunEngine {
 
       this.onBatchTaskRunCreated.post(batch);
 
-      if (body.parentRunId && body.resumeParentOnCompletion) {
+      if (parentRunInternalId) {
         await this._engine.blockRunWithCreatedBatch({
-          runId: RunId.fromFriendlyId(body.parentRunId),
+          runId: parentRunInternalId,
           batchId: batch.id,
           environmentId: environment.id,
           projectId: environment.projectId,
```

**File**: `apps/webapp/app/runEngine/services/createBatch.server.ts` (modified, +10/-3)
```diff
@@ -1,6 +1,5 @@
 import type { InitializeBatchOptions } from "@internal/run-engine";
 import { type CreateBatchRequestBody, type CreateBatchResponse } from "@trigger.dev/core/v3";
-import { RunId } from "@trigger.dev/core/v3/isomorphic";
 import { type BatchTaskRun, Prisma } from "@trigger.dev/database";
 import { Evt } from "evt";
 import { prisma, type PrismaClientOrTransaction } from "~/db.server";
@@ -14,6 +13,7 @@ import { ServiceValidationError, WithRunEngine } from "../../v3/services/baseSer
 import { BatchRateLimitExceededError, getBatchLimits } from "../concerns/batchLimits.server";
 import { DefaultQueueManager } from "../concerns/queues.server";
 import { DefaultTriggerTaskValidator } from "../validators/triggerTaskValidator";
+import { resolveBatchParentRun } from "./resolveBatchParentRun.server";
 
 export type CreateBatchServiceOptions = {
   triggerVersion?: string;
@@ -101,6 +101,13 @@ export class CreateBatchService extends WithRunEngine {
           // Note: Queue size limits are validated per-queue when batch items are processed,
           // since we don't know which queues items will go to until they're streamed.
 
+          const parentRunInternalId = await resolveBatchParentRun({
+            runStore: this._engine.runStore,
+            environmentId: environment.id,
+            parentRunId: body.parentRunId,
+            resumeParentOnCompletion: body.resumeParentOnCompletion,
+          });
+
           // BatchTaskRun.runtimeEnvironmentId no longer has an FK into RuntimeEnvironment;
           // validate env existence app-side (passthrough when split is off).
           await controlPlaneResolver.assertEnvExists(environment.id);
@@ -125,14 +132,14 @@ export class CreateBatchService extends WithRunEngine {
           await batchStreamGrants.mint(environment.id, friendlyId);
 
           // Block parent run if this is a batchTriggerAndWait
-          if (body.parentRunId && body.resumeParentOnCompletion) {
+          if (parentRunInternalId) {
             await this._engine.scheduleExpireBatch({
               batchId: batch.id,
               availableAt: new Date(Date.now() + env.BATCH_SEAL_TIMEOUT_MS),
             });
 
             await this._engine.blockRunWithCreatedBatch({
-              runId: RunId.fromFriendlyId(body.parentRunId),
+              runId: parentRunInternalId,
               batchId: batch.id,
               environmentId: environment.id,
               projectId: environment.projectId,
```

**File**: `apps/webapp/app/runEngine/services/resolveBatchParentRun.server.test.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import type { RunStore } from "@internal/run-store";
+import { describe, expect, it, vi } from "vitest";
+import type { ServiceValidationError } from "../../v3/services/baseService.server";
+import { resolveBatchParentRun } from "./resolveBatchParentRun.server";
+
+type BatchParentRunStore = Pick<RunStore, "findRun" | "findRunOnPrimary">;
+
+function createRunStore({ replicaRun, primaryRun }: { replicaRun?: object; primaryRun?: object }) {
+  return {
+    findRun: vi.fn().mockResolvedValue(replicaRun ?? null),
+    findRunOnPrimary: vi.fn().mockResolvedValue(primaryRun ?? null),
+  } as unknown as BatchParentRunStore;
+}
+
+describe("resolveBatchParentRun", () => {
+  it("does not resolve an unused parent run", async () => {
+    const runStore = createRunStore({});
+
+    await expect(
+      resolveBatchParentRun({
+        runStore,
+        environmentId: "env_1",
+        parentRunId: "run_parent",
+        resumeParentOnCompletion: false,
+      })
+    ).resolves.toBeUndefined();
+
+    expect(runStore.findRun).not.toHaveBeenCalled();
+  });
+
+  it("returns a parent run from the calling environment", async () => {
+    const runStore = createRunStore({ replicaRun: { id: "parent" } });
+
+    await expect(
+      resolveBatchParentRun({
+        runStore,
+        environmentId: "env_1",
+        parentRunId: "run_parent",
+        resumeParentOnCompletion: true,
+      })
+    ).resolves.toBe("parent");
+
+    expect(runStore.findRun).toHaveBeenCalledWith(
+      { id: "parent", runtimeEnvironmentId: "env_1" },
+      { select: { id: true } }
+    );
+    expect(runStore.findRunOnPrimary).not.toHaveBeenCalled();
+  });
+
+  it("falls back to the owning primary", async () => {
+    const runStore = createRunStore({ primaryRun: { id: "parent" } });
+
+    await expect(
+      resolveBatchParentRun({
+        runStore,
+        environmentId: "env_1",
+        parentRunId: "run_parent",
+        resumeParentOnCompletion: true,
+      })
+    ).resolves.toBe("parent");
+
+    expect(runStore.findRunOnPrimary).toHaveBeenCalledWith(
+      { id: "parent", runtimeEnvironmentId: "env_1" },
+      { select: { id: true } }
+    );
+  });
+
+  it("rejects a parent outside the calling environment", async () => {
+    const runStore = createRunStore({});
+
+    const result = resolveBatchParentRun({
+      runStore,
+      environmentId: "env_1",
+      parentRunId: "run_foreign",
+      resumeParentOnCompletion: true,
+    });
+
+    await expect(result).rejects.toMatchObject<ServiceValidationError>({
+      message: "Parent run not found in the calling environment",
+      status: 404,
+    });
+  });
+});
```

**File**: `apps/webapp/app/runEngine/services/resolveBatchParentRun.server.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import type { RunStore } from "@internal/run-store";
+import { RunId } from "@trigger.dev/core/v3/isomorphic";
+import { ServiceValidationError } from "../../v3/services/baseService.server";
+
+type BatchParentRunStore = Pick<RunStore, "findRun" | "findRunOnPrimary">;
+
+export async function resolveBatchParentRun({
+  runStore,
+  environmentId,
+  parentRunId,
+  resumeParentOnCompletion,
+}: {
+  runStore: BatchParentRunStore;
+  environmentId: string;
+  parentRunId?: string;
+  resumeParentOnCompletion?: boolean;
+}): Promise<string | undefined> {
+  if (!parentRunId || !resumeParentOnCompletion) {
+    return;
+  }
+
+  const runId = RunId.fromFriendlyId(parentRunId);
+  const where = { id: runId, runtimeEnvironmentId: environmentId };
+  const args = { select: { id: true } } as const;
+
+  const parentRun =
+    (await runStore.findRun(where, args)) ?? (await runStore.findRunOnPrimary(where, args));
+
+  if (!parentRun) {
+    throw new ServiceValidationError("Parent run not found in the calling environment", 404);
+  }
+
+  return parentRun.id;
+}
```

---

### Incident Patch 8: `07374a9d` (2026-09-28)
**Commit Message**: fix(webapp): fail /healthcheck when the OTLP worker pool has no healthy workers

When `OTEL_TRANSFORM_WORKER_POOL_ENABLED` is on and the transform worker
pool exists with zero alive workers, `/healthcheck` now returns 500 so
orchestrators replace the instance. A pool that has not been created yet
(it is created lazily on the first ingest request) still reports
healthy, and instances without the flag are unaffected.

Mono-RevId: 7aa36226e4c2507f5d79604fc1563951830955eb

**File**: `apps/webapp/app/routes/healthcheck.tsx` (modified, +6/-0)
```diff
@@ -2,6 +2,7 @@ import { prisma } from "~/db.server";
 import type { LoaderFunction } from "@remix-run/node";
 import { env } from "~/env.server";
 import { rbac } from "~/services/rbac.server";
+import { isOtlpWorkerPoolHealthy } from "~/v3/otlpWorkerPool.server";
 
 export const loader: LoaderFunction = async ({ request }) => {
   try {
@@ -13,6 +14,11 @@ export const loader: LoaderFunction = async ({ request }) => {
     // not be silently bypassed by the DB-disabled flag.
     await rbac.isUsingPlugin();
 
+    if (env.OTEL_TRANSFORM_WORKER_POOL_ENABLED && !isOtlpWorkerPoolHealthy()) {
+      console.log("healthcheck ❌ otlp worker pool has no alive workers");
+      return new Response("ERROR", { status: 500 });
+    }
+
     if (env.HEALTHCHECK_DATABASE_DISABLED === "1") {
       return new Response("OK");
     }
```

**File**: `apps/webapp/app/v3/otlpWorkerPool.server.ts` (modified, +13/-1)
```diff
@@ -471,6 +471,10 @@ export class OtlpWorkerPool {
     return this.queue.length;
   }
 
+  get aliveWorkers() {
+    return this.workers.length;
+  }
+
   // Stop taking new work, let in-flight tasks finish (bounded), then terminate every worker.
   // Terminated workers fire "exit", but reap() no-ops on an already-removed worker, and the
   // isShuttingDown guard stops any pending respawn, so shutdown is quiet.
@@ -506,6 +510,8 @@ export class OtlpWorkerPool {
   }
 }
 
+let currentPool: OtlpWorkerPool | undefined;
+
 export function getOtlpWorkerPool(
   size: number,
   pricingModels: unknown[],
@@ -514,7 +520,7 @@ export function getOtlpWorkerPool(
 ): OtlpWorkerPool {
   // singleton() stores on globalThis so the pool (and its worker threads) survive Remix HMR in dev
   // rather than leaking an orphaned pool + workers on every reload.
-  return singleton("otlpWorkerPool", () => {
+  currentPool = singleton("otlpWorkerPool", () => {
     const resolvedPath = workerPath ?? path.join(process.cwd(), "build", "otlpTransformWorker.cjs");
     const created = new OtlpWorkerPool(size, resolvedPath, pricingModels, meter);
     // Drain + terminate workers on shutdown so they aren't force-killed mid-task (which would
@@ -523,4 +529,10 @@ export function getOtlpWorkerPool(
     signalsEmitter.on("SIGINT", () => void created.shutdown());
     return created;
   });
+  return currentPool;
+}
+
+// The pool is created lazily by the first ingest request, so "no pool yet" must count as healthy.
+export function isOtlpWorkerPoolHealthy(pool = currentPool): boolean {
+  return pool === undefined || pool.aliveWorkers > 0;
 }
```

**File**: `apps/webapp/test/fixtures/otlpExitWorker.cjs` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+// Worker that dies immediately, for OtlpWorkerPool health tests.
+process.exit(1);
```

**File**: `apps/webapp/test/otlpWorkerPoolHealth.test.ts` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { fileURLToPath } from "node:url";
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { isOtlpWorkerPoolHealthy, OtlpWorkerPool } from "~/v3/otlpWorkerPool.server";
+
+const echoWorker = fileURLToPath(new URL("./fixtures/otlpEchoWorker.cjs", import.meta.url));
+const exitWorker = fileURLToPath(new URL("./fixtures/otlpExitWorker.cjs", import.meta.url));
+
+const config = { spanAttributeValueLengthLimit: 8192, defaultEventStore: "clickhouse" };
+
+describe("isOtlpWorkerPoolHealthy", () => {
+  let pool: OtlpWorkerPool | undefined;
+
+  afterEach(async () => {
+    await pool?.shutdown();
+    pool = undefined;
+  });
+
+  it("is healthy before the pool has been created", () => {
+    expect(isOtlpWorkerPoolHealthy()).toBe(true);
+  });
+
+  it("is healthy while the pool has alive workers", async () => {
+    pool = new OtlpWorkerPool(2, echoWorker, []);
+
+    await pool.runTransform("traces", new Uint8Array([1]), config);
+
+    expect(pool.aliveWorkers).toBe(2);
+    expect(isOtlpWorkerPoolHealthy(pool)).toBe(true);
+  });
+
+  it("is unhealthy once every worker has died", async () => {
+    const dying = new OtlpWorkerPool(1, exitWorker, []);
+    pool = dying;
+
+    await vi.waitFor(
+      () => {
+        expect(dying.aliveWorkers).toBe(0);
+        expect(isOtlpWorkerPoolHealthy(dying)).toBe(false);
+      },
+      { timeout: 5000, interval: 20 }
+    );
+  });
+
+  it("is unhealthy after shutdown", async () => {
+    pool = new OtlpWorkerPool(1, echoWorker, []);
+
+    await pool.shutdown();
+
+    expect(pool.aliveWorkers).toBe(0);
+    expect(isOtlpWorkerPoolHealthy(pool)).toBe(false);
+  });
+});
```

---

### Incident Patch 9: `cbf42157` (2026-09-28)
**Commit Message**: fix(webapp): stop the OTLP ingest worker pool reaping healthy workers when queued batches time out

## Summary

Under a burst of telemetry, the OpenTelemetry ingest worker pool could
terminate its own healthy workers and then keep terminating every
replacement, leaving a server rejecting every OTLP batch until the
process was restarted. Batches that wait too long in the queue are now
dropped individually, workers are only terminated when they are
genuinely stuck on a single batch, and every worker termination is
logged.

## Root cause

The pool starts a task's timeout when the batch is enqueued, but the
timeout handler treated any dispatched task as evidence of a stuck
worker. When queue wait alone exceeded the budget, the first timer to
fire belonged to a batch a healthy worker was actively computing, so
that worker was terminated. Each replacement worker was handed the
oldest queued batch, whose timer was already about to fire, and was
terminated moments later. With respawn backoff at its cap the pool sat
at zero workers indefinitely, and the termination path logged nothing.

## Fix

- Track when a task is dispatched. On timeout the caller is still
rejected, but the worker is onl

**File**: `.server-changes/otlp-worker-pool-stale-task-reap.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+area: webapp
+type: fix
+---
+
+Fixed a bug where a burst of telemetry could leave OpenTelemetry ingest rejecting every batch for a long time. Batches that wait too long are now dropped individually instead of restarting the processing workers, so ingest recovers as soon as the burst passes.
```

**File**: `apps/webapp/app/v3/otlpWorkerPool.server.ts` (modified, +199/-22)
```diff
@@ -1,5 +1,6 @@
 import { Worker } from "node:worker_threads";
 import path from "node:path";
+import { performance } from "node:perf_hooks";
 import {
   getMeter,
   type Counter,
@@ -31,15 +32,40 @@ type Task = {
   // Wall-clock stamp at enqueue; the task-duration histogram measures enqueue -> terminal state
   // (queue wait + worker compute), so the gap from the worker-reported compute time is queue wait.
   enqueuedAt: number;
+  /** Monotonic stamps (performance.now) drive every deadline decision so a wall-clock step can't shed or reap. */
+  enqueuedAtMono: number;
+  dispatchedAtMono?: number;
 };
 
 type ReapReason = "error" | "exit" | "timeout";
 
+export type ReapEvent = {
+  reason: ReapReason;
+  taskAgeMs?: number;
+  sinceDispatchMs?: number;
+  queueDepth: number;
+  aliveWorkers: number;
+};
+
+export type OtlpWorkerPoolOptions = {
+  taskTimeoutMs?: number;
+  respawnBaseMs?: number;
+  respawnMaxMs?: number;
+  /**
+   * Observer for every reap, carrying the same fields as the warn log. It must not affect pool
+   * liveness: it runs after the worker is terminated and the respawn is scheduled, and any
+   * exception it throws or promise it rejects is logged and swallowed.
+   */
+  onReap?: (event: ReapEvent) => void | Promise<void>;
+};
+
 const TASK_TIMEOUT_MS = 30_000;
 const MAX_QUEUE_DEPTH = 2_000;
 const RESPAWN_BASE_MS = 500;
 const RESPAWN_MAX_MS = 30_000;
 const SHUTDOWN_DRAIN_MS = 5_000;
+const STALE_FLOOR_MAX_MS = 1_000;
+const SHED_LOG_INTERVAL_MS = 1_000;
 
 // Hand-rolled worker_threads pool: one in-flight task per worker so CPU-bound transforms run
 // fully in parallel. The main thread stays the only DB reader and broadcasts pricing to workers.
@@ -48,11 +74,21 @@ export class OtlpWorkerPool {
   private readonly idle: Worker[] = [];
   private readonly queue: number[] = [];
   private readonly tasks = new Map<number, Task>();
-  private readonly busyByWorker = new Map<Worker, number>();
+  private readonly busyByWorker = new Map<Worker, Task>();
+  private readonly computeTimers = new Map<Worker, NodeJS.Timeout>();
   private nextId = 1;
   private consecutiveFailures = 0;
   private isShuttingDown = false;
   private latestPricingModels: unknown[];
+  private readonly taskTimeoutMs: number;
+  private readonly respawnBaseMs: number;
+  private readonly respawnMaxMs: number;
+  private readonly staleFloorMs: number;
+  private readonly onReap?: (event: ReapEvent) => void | Promise<void>;
+  private shedInWindow = 0;
+  private shedWindowStartMono = 0;
+  private lastShedMono = 0;
+  private shedFlushTimer?: NodeJS.Timeout;
 
   // Pre-allocated per-kind {kind} attribute objects so the per-task record path never allocates.
   private readonly _kindAttrs: Record<TransformKind, { kind: TransformKind }> = {
@@ -69,9 +105,15 @@ export class OtlpWorkerPool {
     private readonly size: number,
     private readonly workerPath: string,
     pricingModels: unknown[],
-    meter?: Meter
+    meter?: Meter,
+    options?: OtlpWorkerPoolOptions
   ) {
     this.latestPricingModels = pricingModels;
+    this.taskTimeoutMs = options?.taskTimeoutMs ?? TASK_TIMEOUT_MS;
+    this.respawnBaseMs = options?.respawnBaseMs ?? RESPAWN_BASE_MS;
+    this.respawnMaxMs = options?.respawnMaxMs ?? RESPAWN_MAX_MS;
+    this.staleFloorMs = Math.min(STALE_FLOOR_MAX_MS, this.taskTimeoutMs / 10);
+    this.onReap = options?.onReap;
     this.#setupOtelMetrics(meter);
     for (let i = 0; i < size; i++) this.spawn();
     logger.info("OtlpWorkerPool started", { size, workerPath });
@@ -131,6 +173,15 @@ export class OtlpWorkerPool {
     }
   }
 
+  /**
+   * A task that already timed out for its caller recorded its outcome and duration then; its
+   * compute time only becomes known when the worker finally replies, and skipping it would drop
+   * exactly the slow samples from the compute histogram.
+   */
+  #recordLateCompute(task: Task, computeMs: number): void {
+    this._computeDurationHistogram?.record(computeMs, 
```

**File**: `apps/webapp/test/fixtures/otlpHangWorker.cjs` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+/**
+ * Real worker that never replies, to exercise the pool's stuck-worker reap path.
+ */
+const { parentPort } = require("node:worker_threads");
+
+parentPort.on("message", () => {});
```

**File**: `apps/webapp/test/fixtures/otlpSlowWorker.cjs` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+/**
+ * Real worker that takes a fixed wall-clock time per task, so pool tests can drive queue wait past
+ * the task deadline while the worker itself stays healthy. Delay comes from
+ * OTLP_SLOW_WORKER_DELAY_MS (default 100). When OTLP_SLOW_WORKER_HANG_AFTER is set the worker
+ * answers that many tasks and then never replies again, to model a worker that wedges mid-run.
+ */
+const { parentPort } = require("node:worker_threads");
+
+const delayMs = Number(process.env.OTLP_SLOW_WORKER_DELAY_MS ?? 100);
+const hangAfter = process.env.OTLP_SLOW_WORKER_HANG_AFTER
+  ? Number(process.env.OTLP_SLOW_WORKER_HANG_AFTER)
+  : Infinity;
+let answered = 0;
+
+parentPort.on("message", (message) => {
+  if (message && message.type === "pricing") return;
+  if (answered >= hangAfter) return;
+  answered++;
+  setTimeout(() => {
+    parentPort.postMessage({ id: message.id, ok: true, result: { rows: [] }, computeMs: delayMs });
+  }, delayMs);
+});
```

**File**: `apps/webapp/test/otlpWorkerPoolTimeout.test.ts` (added, +292/-0)
```diff
@@ -0,0 +1,292 @@
+import { fileURLToPath } from "node:url";
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { OtlpWorkerPool, type ReapEvent } from "~/v3/otlpWorkerPool.server";
+import { createInMemoryMetrics } from "./utils/tracing";
+import { gaugeValue, histogramCount, latestMetrics, metricSum } from "./otlpMetrics.helpers";
+
+const slowWorker = fileURLToPath(new URL("./fixtures/otlpSlowWorker.cjs", import.meta.url));
+const hangWorker = fileURLToPath(new URL("./fixtures/otlpHangWorker.cjs", import.meta.url));
+
+const config = { spanAttributeValueLengthLimit: 8192, defaultEventStore: "clickhouse" };
+const payload = () => new Uint8Array([1, 2, 3, 4]);
+
+const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
+
+describe("OtlpWorkerPool task timeouts", () => {
+  const cleanups: Array<() => Promise<void>> = [];
+
+  afterEach(async () => {
+    for (const cleanup of cleanups.splice(0)) {
+      await cleanup();
+    }
+    delete process.env.OTLP_SLOW_WORKER_DELAY_MS;
+    delete process.env.OTLP_SLOW_WORKER_HANG_AFTER;
+  });
+
+  it("keeps a healthy worker alive when queued tasks exceed their deadline under overload", async () => {
+    const taskTimeoutMs = 500;
+    const computeMs = 20;
+    const arrivalIntervalMs = 10;
+    const runMs = 3000;
+    process.env.OTLP_SLOW_WORKER_DELAY_MS = String(computeMs);
+
+    const metrics = createInMemoryMetrics();
+    const pool = new OtlpWorkerPool(1, slowWorker, [], metrics.meter, {
+      taskTimeoutMs,
+      respawnBaseMs: 50,
+      respawnMaxMs: 200,
+    });
+    cleanups.push(async () => {
+      await pool.shutdown();
+      await metrics.shutdown();
+    });
+
+    let resolved = 0;
+    let rejected = 0;
+    const pending: Promise<unknown>[] = [];
+    const aliveSamples: Array<number | undefined> = [];
+    const okSamples: number[] = [];
+
+    const startedAt = Date.now();
+    const enqueue = setInterval(() => {
+      const p = pool
+        .runTransform("traces", payload(), config)
+        .then(() => resolved++)
+        .catch(() => rejected++);
+      pending.push(p);
+    }, arrivalIntervalMs);
+
+    let lastSampleAt = startedAt;
+    while (Date.now() - startedAt < runMs) {
+      await sleep(25);
+      if (Date.now() - startedAt >= 1000 && Date.now() - lastSampleAt >= 200) {
+        lastSampleAt = Date.now();
+        const rm = await latestMetrics(metrics);
+        aliveSamples.push(gaugeValue(rm, "ingest.worker_pool.workers", { state: "alive" }));
+        okSamples.push(metricSum(rm, "ingest.worker_pool.tasks", { outcome: "ok" }));
+      }
+    }
+    clearInterval(enqueue);
+    await Promise.all(pending);
+
+    const rm = await latestMetrics(metrics);
+    const summary = {
+      resolved,
+      rejected,
+      respawnsTimeout: metricSum(rm, "ingest.worker_pool.respawns", { reason: "timeout" }),
+      respawnsError: metricSum(rm, "ingest.worker_pool.respawns", { reason: "error" }),
+      respawnsExit: metricSum(rm, "ingest.worker_pool.respawns", { reason: "exit" }),
+      crash: metricSum(rm, "ingest.worker_pool.tasks", { outcome: "crash" }),
+      ok: metricSum(rm, "ingest.worker_pool.tasks", { outcome: "ok" }),
+      timeout: metricSum(rm, "ingest.worker_pool.tasks", { outcome: "timeout" }),
+      stale: metricSum(rm, "ingest.worker_pool.tasks", { outcome: "stale" }),
+      aliveSamples,
+      okSamples,
+    };
+    console.log("overload summary", JSON.stringify(summary));
+
+    expect(summary.timeout + summary.stale).toBeGreaterThan(0);
+    expect(rejected).toBeGreaterThan(0);
+
+    expect(summary.respawnsTimeout).toBe(0);
+    expect(summary.respawnsError).toBe(0);
+    expect(summary.respawnsExit).toBe(0);
+    expect(summary.crash).toBe(0);
+    expect(aliveSamples.length).toBeGreaterThan(0);
+    expect(aliveSamples.every((alive) => alive === 1)).toBe(true);
+    expect(summary.ok).toBeGreaterThanOrEqual(50);
+    expect(summary.ok).toBeGreaterThan(okSamples[0]!);
+

```

---

### Incident Patch 10: `a3f3fc09` (2026-09-28)
**Commit Message**: fix: simplify onboarding questions

Simplify project creation by removing optional onboarding questions.

Mono-RevId: a04b3112a96c1dcf6d20aaf9892339f026e1f3e7

**File**: `.server-changes/simplify-onboarding-questions.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+area: webapp
+type: improvement
+---
+
+Creating a project now asks only for its name.
```

**File**: `apps/webapp/app/components/onboarding/TechnologyPicker.tsx` (removed, +0/-386)
```diff
@@ -1,386 +0,0 @@
-import * as Ariakit from "@ariakit/react";
-import {
-  XMarkIcon,
-  PlusIcon,
-  CubeIcon,
-  MagnifyingGlassIcon,
-  ChevronDownIcon,
-} from "@heroicons/react/20/solid";
-import { useCallback, useMemo, useRef, useState } from "react";
-import { CheckboxIndicator } from "~/components/primitives/CheckboxIndicator";
-import { cn } from "~/utils/cn";
-import { matchSorter } from "match-sorter";
-import { ShortcutKey } from "~/components/primitives/ShortcutKey";
-
-const pillColors = [
-  "bg-green-800/40 border-green-600/50",
-  "bg-teal-800/40 border-teal-600/50",
-  "bg-blue-800/40 border-blue-600/50",
-  "bg-indigo-800/40 border-indigo-600/50",
-  "bg-violet-800/40 border-violet-600/50",
-  "bg-purple-800/40 border-purple-600/50",
-  "bg-fuchsia-800/40 border-fuchsia-600/50",
-  "bg-pink-800/40 border-pink-600/50",
-  "bg-rose-800/40 border-rose-600/50",
-  "bg-orange-800/40 border-orange-600/50",
-  "bg-amber-800/40 border-amber-600/50",
-  "bg-yellow-800/40 border-yellow-600/50",
-  "bg-lime-800/40 border-lime-600/50",
-  "bg-emerald-800/40 border-emerald-600/50",
-  "bg-cyan-800/40 border-cyan-600/50",
-  "bg-sky-800/40 border-sky-600/50",
-];
-
-function getPillColor(value: string): string {
-  let hash = 0;
-  for (let i = 0; i < value.length; i++) {
-    hash = (hash << 5) - hash + value.charCodeAt(i);
-    hash |= 0;
-  }
-  return pillColors[Math.abs(hash) % pillColors.length];
-}
-
-const TECHNOLOGY_OPTIONS = [
-  "Airflow",
-  "Angular",
-  "Anthropic",
-  "Astro",
-  "Auth0",
-  "AWS",
-  "AWS SQS",
-  "Azure",
-  "BigQuery",
-  "BullMQ",
-  "Bun",
-  "Cassandra",
-  "Celery",
-  "ClickHouse",
-  "Clerk",
-  "Cloudflare",
-  "CockroachDB",
-  "Cohere",
-  "Convex",
-  "Databricks",
-  "Datadog",
-  "DeepSeek",
-  "Deno",
-  "DigitalOcean",
-  "Django",
-  "Docker",
-  "Drizzle",
-  "DynamoDB",
-  "Elasticsearch",
-  "Electron",
-  "Elevenlabs",
-  "Expo",
-  "Express",
-  "FastAPI",
-  "Fastify",
-  "Firebase",
-  "Flask",
-  "Fly.io",
-  "Gatsby",
-  "GCP",
-  "Go",
-  "Google Cloud Tasks",
-  "Google Gemini",
-  "GraphQL",
-  "Groq",
-  "Heroku",
-  "Hono",
-  "htmx",
-  "Hugging Face",
-  "Inngest",
-  "Kafka",
-  "Kubernetes",
-  "LangChain",
-  "Laravel",
-  "LlamaIndex",
-  "MariaDB",
-  "Midjourney",
-  "Mistral",
-  "MongoDB",
-  "Mongoose",
-  "MySQL",
-  "Neo4j",
-  "Neon",
-  "Nest.js",
-  "Netlify",
-  "Next.js",
-  "Node.js",
-  "Nuxt",
-  "Ollama",
-  "OpenAI",
-  "Perplexity",
-  "PHP",
-  "Pinecone",
-  "PlanetScale",
-  "Python",
-  "PostHog",
-  "PostgreSQL",
-  "Prisma",
-  "Pulumi",
-  "RabbitMQ",
-  "Railway",
-  "React",
-  "React Native",
-  "Redis",
-  "Redshift",
-  "Remix",
-  "Render",
-  "Replicate",
-  "Resend",
-  "Ruby on Rails",
-  "Rust",
-  "SendGrid",
-  "Sentry",
-  "Sidekiq",
-  "Snowflake",
-  "Solid.js",
-  "Spring Boot",
-  "SQLite",
-  "Stability AI",
-  "Stripe",
-  "Supabase",
-  "Svelte",
-  "SvelteKit",
-  "Tailwind CSS",
-  "Temporal",
-  "Terraform",
-  "Together AI",
-  "tRPC",
-  "Turso",
-  "Twilio",
-  "TypeORM",
-  "Upstash",
-  "Vercel",
-  "Vercel AI SDK",
-  "Vite",
-  "Vue",
-  "Weaviate",
-] as const;
-
-type TechnologyPickerProps = {
-  value: string[];
-  onChange: (value: string[]) => void;
-  customValues: string[];
-  onCustomValuesChange: (values: string[]) => void;
-};
-
-export function TechnologyPicker({
-  value,
-  onChange,
-  customValues,
-  onCustomValuesChange,
-}: TechnologyPickerProps) {
-  const [open, setOpen] = useState(false);
-  const [searchValue, setSearchValue] = useState("");
-  const [otherInputValue, setOtherInputValue] = useState("");
-  const [showOtherInput, setShowOtherInput] = useState(false);
-  const otherInputRef = useRef<HTMLInputElement>(null);
-
-  const allSelected = useMemo(() => [...value, ...customValues], [value, customValues]);
-
-  const filteredOptions = useMemo(() => {
-    if (!searchValue) return TECHNOLOGY_OPTIONS;
-    return matchSorter([...TECHNOLOGY_OPTIONS], searchValue);
-  }, [sea
```

**File**: `apps/webapp/app/routes/_app.orgs.$organizationSlug_.projects.new/route.tsx` (modified, +1/-248)
```diff
@@ -1,22 +1,19 @@
 import { getFormProps, getInputProps, useForm } from "@conform-to/react";
 import { parseWithZod } from "@conform-to/zod/v4";
-import { CommandLineIcon, FolderIcon } from "@heroicons/react/20/solid";
+import { FolderIcon } from "@heroicons/react/20/solid";
 import {
   json,
   redirectDocument,
   type ActionFunction,
   type LoaderFunctionArgs,
 } from "@remix-run/node";
 import { Form, useActionData, useNavigation } from "@remix-run/react";
-import type { Prisma } from "@trigger.dev/database";
-import React, { useEffect, useState } from "react";
 import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
 import invariant from "tiny-invariant";
 import { z } from "zod";
 import { BackgroundWrapper } from "~/components/BackgroundWrapper";
 import { Feedback } from "~/components/Feedback";
 import { AppContainer, MainCenteredContainer } from "~/components/layout/AppLayout";
-import { TechnologyPicker } from "~/components/onboarding/TechnologyPicker";
 import { Button, LinkButton } from "~/components/primitives/Buttons";
 import { Callout } from "~/components/primitives/Callout";
 import { Fieldset } from "~/components/primitives/Fieldset";
@@ -26,7 +23,6 @@ import { FormTitle } from "~/components/primitives/FormTitle";
 import { Input } from "~/components/primitives/Input";
 import { InputGroup } from "~/components/primitives/InputGroup";
 import { Label } from "~/components/primitives/Label";
-import { Select, SelectItem } from "~/components/primitives/Select";
 
 import { prisma } from "~/db.server";
 import { featuresForRequest } from "~/features.server";
@@ -45,82 +41,6 @@ import { pageMeta } from "~/utils/pageTitle";
 
 export const meta = pageMeta("New project");
 
-const WORKING_ON_OTHER = "Other/not sure yet";
-const GOALS_OTHER = "Other/not sure yet";
-
-const workingOnOptions = [
-  "AI agent",
-  "Media processing pipeline",
-  "Media generation with AI",
-  "Event-driven workflow",
-  "Realtime streaming",
-  "Internal tool or background job",
-  WORKING_ON_OTHER,
-] as const;
-
-const goalOptions = [
-  "Ship a production workflow",
-  "Prototype or explore",
-  "Migrate an existing system",
-  "Learn how Trigger works",
-  "Evaluate against alternatives",
-  GOALS_OTHER,
-] as const;
-
-function shuffleArray<T>(arr: T[]): T[] {
-  const shuffled = [...arr];
-  for (let i = shuffled.length - 1; i > 0; i--) {
-    const j = Math.floor(Math.random() * (i + 1));
-    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
-  }
-  return shuffled;
-}
-
-function renderMultiSelectValue(value: string[]) {
-  if (value.length === 0) return;
-
-  return (
-    <span className="flex min-w-0 items-center text-text-bright">
-      <span className="truncate">{value.slice(0, 2).join(", ")}</span>
-      {value.length > 2 && <span className="ml-1 flex-none">+{value.length - 2} more</span>}
-    </span>
-  );
-}
-
-function MultiSelectField({
-  value,
-  setValue,
-  items,
-  icon,
-}: {
-  value: string[];
-  setValue: (value: string[]) => void;
-  items: string[];
-  icon: React.ReactNode;
-}) {
-  return (
-    <Select<string[], string>
-      value={value}
-      setValue={setValue}
-      placeholder="Select some options"
-      variant="secondary/small"
-      dropdownIcon
-      icon={icon}
-      items={items}
-      className="h-8 min-w-0 border-0 bg-background-hover pl-2 text-sm text-text-dimmed ring-border-bright transition hover:bg-secondary hover:text-text-dimmed hover:ring-1"
-      text={renderMultiSelectValue}
-    >
-      {(items) =>
-        items.map((item) => (
-          <SelectItem key={item} value={item} checkPosition="left">
-            <span className="text-text-bright">{item}</span>
-          </SelectItem>
-        ))
-      }
-    </Select>
-  );
-}
-
 export async function loader({ params, request }: LoaderFunctionArgs) {
   const userId = await requireUserId(request);
   const { organizationSlug } = OrganizationParamsSchema.parse(params);
@@ -171,14 +91,6 @@ 
```

#### Recent Merged Pull Requests:
- **PR #4987** (closed): fix(webapp): recognize object-store 404 by status code for missing transcripts (@mahenoorsalat)
- **PR #4985** (2026-09-28): fix(ci): switch MinIO tests to Chainguard images (@carderne)
- **PR #4980** (2026-09-28): fix(core): accept IPC acks for void callbacks under zod 4.4+ (@NERLOE)
- **PR #4978** (closed): fix(webapp): clarify Node 21 deployment banner (@carderne)
- **PR #4973** (2026-09-22): chore: release v4.6.4 (@github-actions[bot])
- **PR #4972** (2026-09-22): fix(core): use zod/v4 for the snapshot route schema so warm starts work on zod 3 projects (@d-cs)
- **PR #4970** (closed): fix(webapp): display imperative schedules without active worker deployments (#3209) (@kaiizer777)
- **PR #4969** (closed): fix(webapp): clear idempotency key and re-trigger dead runs in batchT… (@kaiizer777)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

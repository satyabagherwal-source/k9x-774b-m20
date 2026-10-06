# Forensic Learning Record (Deep Inspection): triggerdotdev/trigger.dev

> **Canonical Artifact**: `07_PROJECT_LEARNING/triggerdotdev-trigger.dev-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:42:49.414Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `triggerdotdev/trigger.dev`
- **Description**: Trigger.dev – build and deploy durable AI agents and workflows
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16478 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
          .strict()
      )
      .optional()
  );

export const AdditionalEnvVars = z.preprocess((val) => {
  if (typeof val !== "string") {
    return val;
  }

  if (!val) {
    return undefined;
  }

  try {
    const result = val.split(",").reduce(
      (acc, pair) => {
        const [key, value] = pair.split("=");
        if (!key || !value) {
          return acc;
        }
        acc[key.trim()] = value.trim();
        return acc;
      },
      {} as Record<string, string>
    );

    // Return undefined if no valid key-value pairs were found
    return Object.keys(result).length === 0 ? undefined : result;
  } catch (error) {
    logger.warn("Failed to parse additional env vars", { error, val });
    return undefined;
  }
}, z.record(z.string(), z.string()).optional());

```

### Core Architecture Module: `apps/supervisor/src/services/dequeueDrain.ts`
```
import type { SupervisorSession } from "@trigger.dev/core/v3/workers";
import type { SimpleStructuredLogger } from "@trigger.dev/core/v3/utils/structuredLogger";

/**
 * Lets a shutdown wait for the session's dequeue requests and the message handlers
 * they start. The session's stop waits for neither: a request in flight still emits
 * its messages, and the emit does not await the handlers.
 */
export class DequeueDrain {
  private readonly pending = new Set<Promise<unknown>>();
  private stopped = false;

  constructor(
    session: SupervisorSession,
    private readonly logger: SimpleStructuredLogger
  ) {
    const client = session.httpClient;
    const dequeue = client.dequeue.bind(client);
    client.dequeue = (...args) => {
      // A consumer stopped while awaiting its pre-dequeue check still makes the request.
      if (this.stopped) {
        return Promise.resolve({ success: true as const, data: [] });
      }
      return this.track(dequeue(...args));
    };
  }

  /**
   * Wraps an async listener so `stop` waits for each call of it. Tracking handles
   * its rejection, which would otherwise crash the process, so it is logged here.
   */
  tracked<A extends unknown[]>(fn: (...args: A) => Promise<void>): (...args: A) => Promise<void> {
    return (...args) => {
      const call = fn(...args);
      call.catch((error: unknown) =>
        this.logger.error("Dequeued message handler failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return this.track(call);
    };
  }

  /** Admits no more dequeues and resolves once the requests and handlers in flight settle. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.pending.size > 0) {
      // Logged first: anything still pending when the shutdown times out is lost.
      this.logger.log("Draining dequeues in flight", { inFlight: this.pending.size });
    }
    // A request that settles here starts its handlers before the next check.
    while (this.pending.size > 0) {
      await Promise.allSettled(this.pending);
    }
  }

  private track<T>(promise: Promise<T>): Promise<T> {
    this.pending.add(promise);
    const remove = () => this.pending.delete(promise);
    promise.then(remove, remove);
    return promise;
  }
}

```

### Core Architecture Module: `apps/supervisor/src/util.ts`
```
import { isMacOS, isWindows } from "std-env";

export function normalizeDockerHostUrl(url: string) {
  const $url = new URL(url);

  if ($url.hostname === "localhost") {
    $url.hostname = getDockerHostDomain();
  }

  return $url.toString();
}

export function getDockerHostDomain() {
  return isMacOS || isWindows ? "host.docker.internal" : "localhost";
}

/** Extract the W3C traceparent string from an untyped trace context record */
export function extractTraceparent(traceContext?: Record<string, unknown>): string | undefined {
  if (
    traceContext &&
    "traceparent" in traceContext &&
    typeof traceContext.traceparent === "string"
  ) {
    return traceContext.traceparent;
  }
  return undefined;
}

export function getRunnerId(runId: string, attemptNumber?: number) {
  const parts = ["runner", runId.replace("run_", "")];

  if (attemptNumber && attemptNumber > 1) {
    parts.push(`attempt-${attemptNumber}`);
  }

  return parts.join("-");
}

/** Derive a unique runnerId for a restore cycle using the checkpoint suffix */
export function getRestoreRunnerId(runFriendlyId: string, checkpointId: string) {
  const runIdShort = runFriendlyId.replace("run_", "");
  const checkpointSuffix = checkpointId.slice(-8);
  return `runner-${runIdShort}-${checkpointSuffix}`;
}

```

### Core Architecture Module: `apps/supervisor/src/wideEvents/state.ts`
```
/**
 * Per-event accumulator backing a single wide event. The supervisor emits one
 * flat-keyed JSON line per natural unit of work (dequeue iteration, HTTP
 * request, socket lifecycle event). Optional fields are omitted on emit so
 * events stay compact.
 */
export type State = {
  /**
   * Wall-clock time the event began, as an ISO-8601 string. Emitted as
   * `start_time` so log collection orders events by when work started rather
   * than by the collector's ingestion time.
   */
  startTime?: string;

  // Cross-stack correlation.
  requestId: string;
  traceId: string;
  /**
   * Raw inbound W3C `traceparent`, preserved verbatim so outbound calls can
   * propagate the same trace context without losing the parent span-id.
   * Empty when no inbound traceparent was set.
   */
  traceparent: string;

  // Service identity (set by `newState` from Env).
  service: string;
  version?: string;
  commitSha?: string;
  region?: string;
  nodeId?: string;

  /**
   * Operation discriminator. Dotted `noun.verb` (e.g. `instance.create`,
   * `snapshot.dispatch`). Low cardinality - bounded set per service, not
   * unbounded. Empty allowed during construction but expected to be set
   * before emit.
   */
  op: string;

  /**
   * Event shape. `inbound` for received requests, `outbound` for outgoing
   * calls, `event` for ambient occurrences with no meaningful duration,
   * `scheduled` for timer-driven work. Empty allowed; omitted from emit
   * when empty.
   */
  kind: string;

  // Caller-attached opaque metadata, flattened to `meta.<key>` on emit.
  meta: Record<string, string>;

  // Per-phase outcomes, in completion order.
  phases: PhaseRecord[];

  // Top-level outcome (set after the wrapped operation returns).
  ok: boolean;
  statusCode: number;
  durationMs: number;
  error?: ErrorInfo;

  // Free-form ad-hoc additions (route, method, did_warm_start, ...).
  extras: Record<string, unknown>;
};

/**
 * Single named phase outcome. Retries collapse into `attempts > 1` with the
 * last error reflected in errorCode/errorMsg.
 */
export type PhaseRecord = {
  name: string;
  durationMs: number;
  ok: boolean;
  attempts: number;
  errorCode?: string;
  errorMsg?: string;
  sub?: Record<string, number>;
};

/** Top-level error summary for a failed operation. */
type ErrorInfo = {
  code: string;
  message: string;
  /** Coarse classification - "client" | "upstream" | "internal" | "timeout". */
  kind: string;
};

```

### Core Architecture Module: `apps/supervisor/src/workerToken.ts`
```
import { readFileSync } from "fs";
import { env } from "./env.js";

export function getWorkerToken() {
  if (!env.TRIGGER_WORKER_TOKEN.startsWith("file://")) {
    return env.TRIGGER_WORKER_TOKEN;
  }

  const tokenPath = env.TRIGGER_WORKER_TOKEN.replace("file://", "");

  console.debug(
    JSON.stringify({
      message: "🔑 Reading worker token from file",
      tokenPath,
    })
  );

  try {
    const token = readFileSync(tokenPath, "utf8").trim();
    return token;
  } catch (error) {
    console.error(`Failed to read worker token from file: ${tokenPath}`, error);
    throw new Error(
      `Unable to read worker token from file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

```

### Core Architecture Module: `apps/webapp/app/assets/icons/ConcurrencyIcon.tsx`
```
export function ConcurrencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="3.75" cy="3.75" r="2.25" fill="currentColor" />
      <circle cx="9" cy="3.75" r="2.25" fill="currentColor" />
      <circle cx="14.25" cy="3.75" r="2.25" fill="currentColor" />
      <circle cx="3.75" cy="9" r="2.25" fill="currentColor" />
      <circle cx="9" cy="9" r="2.25" fill="currentColor" />
      <circle cx="9" cy="14.25" r="1.75" stroke="currentColor" />
      <circle cx="14.25" cy="9" r="2.25" fill="currentColor" />
    </svg>
  );
}

```

### Core Architecture Module: `apps/webapp/app/assets/icons/QueuesIcon.tsx`
```
export function QueuesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="10" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <line
        x1="5"
        y1="7"
        x2="19"
        y2="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="7"
        y1="4"
        x2="17"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

```

### Core Architecture Module: `apps/webapp/app/assets/icons/WebhookIcon.tsx`
```
export function WebhookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="7" r="1.75" fill="currentColor" />
      <circle cx="7" cy="16" r="1.75" fill="currentColor" />
      <circle cx="17" cy="16" r="1.75" fill="currentColor" />
      <path
        d="M16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 8.14562 8.48161 9.17875 9.25341 9.90798C9.65459 10.287 9.83991 10.8882 9.57187 11.3706L8.94292 12.5027L7 16M12 7L13.9429 10.4973L14.571 11.6278C14.8394 12.1109 15.4487 12.2704 15.9833 12.1304C16.3079 12.0453 16.6487 12 17 12C19.2091 12 21 13.7909 21 16C21 18.2091 19.2091 20 17 20C16.2949 20 15.6323 19.8175 15.0571 19.4973M17 16H12C11.4477 16 11.0128 16.4547 10.8766 16.9899C10.4361 18.7202 8.86748 20 7 20C4.79086 20 3 18.2091 3 16C3 14.496 3.83007 13.1859 5.05708 12.5027"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

```

### Core Architecture Module: `apps/webapp/app/clientBeforeFirstRender.ts`
```
/**
 * Runs once on the client, synchronously, before React hydrates the app.
 * Reserved for housekeeping that must happen before any component mounts.
 */
export function clientBeforeFirstRender() {
  cleanupLegacyResizablePanelStorage();
}

/**
 * Earlier versions of the resizable panel library wrote a per-session
 * localStorage entry for every PanelGroup, including ones without an
 * `autosaveId`. The keys look like `panel-group-react-aria<n>-:<rid>:`
 * and accumulate without bound across sessions until they exhaust the
 * ~5 MB origin quota and break subsequent `setItem` calls.
 *
 * The library no longer behaves this way, but existing users still carry
 * the residue. Evict it (plus the orphaned `panel-run-parent-v2` key from
 * the v2→v3 autosaveId bump) once on load.
 */
function cleanupLegacyResizablePanelStorage() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith("panel-group-react-aria") || key === "panel-run-parent-v2")) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // localStorage may be disabled (private browsing, security policy)
  }
}

```

### Core Architecture Module: `apps/webapp/app/components/BlankStatePanels.tsx`
```
import { DeploymentOnboardingFrame } from "./deployments/DeploymentOnboardingFrame";
import {
  BeakerIcon,
  BellAlertIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
} from "@heroicons/react/20/solid";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import { AIChatIcon } from "~/assets/icons/AIChatIcon";
import { AIPenIcon } from "~/assets/icons/AIPenIcon";
import { AISparkleIcon } from "~/assets/icons/AISparkleIcon";
import { BranchEnvironmentIconSmall } from "~/assets/icons/EnvironmentIcons";
import { WaitpointTokenIcon } from "~/assets/icons/WaitpointTokenIcon";
import openBulkActionsPanel from "~/assets/images/open-bulk-actions-panel.png";
import selectRunsIndividually from "~/assets/images/select-runs-individually.png";
import selectRunsUsingFilters from "~/assets/images/select-runs-using-filters.png";
import { useEnvironment } from "~/hooks/useEnvironment";
import { useFeatures } from "~/hooks/useFeatures";
import { useOrganization } from "~/hooks/useOrganizations";
import { useProject } from "~/hooks/useProject";
import { type MinimumEnvironment } from "~/presenters/SelectBestEnvironmentPresenter.server";
import { type BranchableEnvironmentToken } from "~/utils/branchableEnvironment";
import { NewBranchPanel } from "~/routes/resources.branches.create";
import { GitHubSettingsPanel } from "~/routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.github";
import { deployNowPath } from "~/routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.deploy-now";
import { VercelAtomicDeploymentNotice } from "~/components/deployments/VercelAtomicDeploymentNotice";
import { GitHubDeploymentOnboardingPanel } from "~/components/deployments/GitHubDeploymentOnboardingPanel";
import { type DeploymentEventStream } from "~/hooks/useOnboardingDeploymentLogs";
import { type WorkerDeploymentStatus } from "@trigger.dev/database";
import {
  docsPath,
  v3BillingPath,
  v3CreateBulkActionPath,
  v3DeploymentPath,
  v3DeploymentsPath,
  v3EnvironmentPath,
  v3NewProjectAlertPath,
} from "~/utils/pathBuilder";
import { AskAgentButton } from "./dashboard-agent/AskAgentButton";
import { CodeBlock } from "./code/CodeBlock";
import { useDevPresence } from "./DevPresence";
import { InlineCode } from "./code/InlineCode";
import { environmentFullTitle, EnvironmentIcon } from "./environments/EnvironmentLabel";
import { Feedback } from "./Feedback";
import { EnvironmentSelector } from "./navigation/EnvironmentSelector";
import { Button, LinkButton } from "./primitives/Buttons";
import { ClientTabsContent } from "./primitives/ClientTabs";
import { Header1 } from "./primitives/Headers";
import { InfoPanel } from "./primitives/InfoPanel";
import { Paragraph } from "./primitives/Paragraph";
import { SpinnerWhite } from "./primitives/Spinner";
import { StepNumber } from "./primitives/StepNumber";
import { TextLink } from "./primitives/TextLink";
import { useToast } from "./primitives/Toast";
import { SimpleTooltip } from "./primitives/Tooltip";
import { SettingsRow } from "./primitives/SettingsLayout";
import {
  InitAgentPromptV3,
  InitCommandV3,
  PackageManagerProvider,
  TriggerDeployStep,
  TriggerDevStepV3,
} from "./SetupCommands";
import { StepContentContainer } from "./StepContentContainer";

/**
 * What the agent is asked when it's opened from a deployment setup panel. The panel is the docs
 * answer; the agent is for the part the docs can't answer — this project, this environment.
 */
const ASK_AGENT_DEPLOY_PROMPT =
  "I'm trying to deploy my tasks to this environment. Walk me through it and tell me if anything about this project or environment is going to get in the way.";

/** The docs links the deployment panels offer to anyone without the agent. */
function DeployDocsLinks() {
  return (
    <>
      <SimpleTooltip
        asChild
        tabbable
        button={
          // Span wrapper: LinkButton drops the pointer-event props Radix injects via asChild, so
          // the tooltip trigger has to be a plain element (same pattern as FavoritePageButton).
          <span className="flex">
            <LinkButton
              variant="small-menu-item"
              LeadingIcon={BookOpenIcon}
              leadingIconClassName="text-blue-500"
              to={docsPath("deployment/overview")}
              aria-label="Deploy docs"
            />
          </span>
        }
        content="Deploy docs"
      />
      <SimpleTooltip
        asChild
        tabbable
        button={
          <span className="flex">
            <LinkButton
              variant="small-menu-item"
              LeadingIcon={QuestionMarkCircleIcon}
              leadingIconClassName="text-blue-500"
              to={docsPath("troubleshooting#deployment")}
              aria-label="Troubleshooting docs"
            />
          </span>
        }
        content="Troubleshooting docs"
      />
    </>
  );
}

export function HasNoTasksDev({
  initializedAt,
  enhanced = false,
}: {
  initializedAt: Date | string | null;
  enhanced?: boolean;
}) {
  const { isConnected } = useDevPresence();
  const initialized = !!initializedAt;
  const devConnected = isConnected === true;
  const complete = <CheckIcon className="size-5 text-success" aria-label="Complete" />;

  return (
    <PackageManagerProvider>
      <div>
        <div className="mb-6 flex items-center justify-between border-b">
          <Header1 spacing>Get set up in 2 minutes</Header1>
          <div className="flex items-center gap-2">
            <Feedback
              button={
                <Button variant="minimal/small" LeadingIcon={ChatBubbleLeftRightIcon}>
                  I'm stuck!
                </Button>
              }
              defaultValue="help"
            />
          </div>
        </div>
        {!initialized && (
          <>
            <div className="flex flex-col gap-4 rounded-md border border-indigo-400/20 bg-indigo-800/10 p-4 sm:flex-row sm:items-center">
              <span className="flex size-9 shrink-0 items-center justify-center self-start rounded-md bg-indigo-500/15 text-indigo-400">
                <AISparkleIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <Paragraph className="text-text-bright">Set it up with your AI agent</Paragraph>
                <Paragraph variant="small" className="text-text-dimmed">
                  Copy a ready-to-paste prompt for Claude Code, Cursor, or any coding agent. It
                  includes your project reference.
                </Paragraph>
              </div>
              <div className="shrink-0 sm:ml-4">
                <InitAgentPromptV3 />
              </div>
            </div>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-grid-bright" />
              <span className="text-xs uppercase tracking-wide text-text-dimmed">
                or set it up yourself
              </span>
              <div className="h-px flex-1 bg-grid-bright" />
            </div>
          </>
        )}
        {enhanced ? (
          <div>
            <SettingsRow
              bordered={false}
              title={initialized ? "Project initialized" : "Initialize your project"}
              description={
                initialized ? (
                  <>
                    Your project is initialized. Your tasks live in the{" "}
                    <InlineCode variant="extra-small">trigger</InlineCode> directory.
                  </>
                ) : (
                  <>
                    Run this in an existing project. You'll notice a new folder called{" "}
                    <InlineCode variant="extra-small">trigger</InlineCode> with a few example tasks
                    to help you get started.
                  </>
                )
              }
              action={initialized ? complete : undefined}
            />
            {!initialized && <InitCommandV3 />}
            <SettingsRow
              className="border-t border-grid-dimmed"
              bordered={false}
              title={devConnected ? "Dev server connected" : "Start the dev server"}
              description={
                devConnected
                  ? "Your dev server is connected. Your tasks will appear here automatically as soon as they register."
                  : "Keep this running while you develop. Once your tasks register, this page updates automatically."
              }
              action={devConnected ? complete : undefined}
            />
            {!devConnected && <TriggerDevStepV3 />}
          </div>
        ) : (
          <>
            <StepNumber
              stepNumber="1"
              title={initialized ? "Project initialized" : "Initialize your project"}
              complete={initialized}
            />
            <StepContentContainer>
              {initialized ? (
                <Paragraph>
                  Your project is initialized. Your tasks live in the{" "}
                  <InlineCode variant="small">trigger</InlineCode> directory.
                </Paragraph>
              ) : (
                <>
                  <InitCommandV3 />
                  <Paragraph spacing>
                    Run this in an existing project. You'll notice a new folder called{" "}
                    <InlineCode variant="small">trigger</InlineCode> with a few example tasks to
                    help you get started.
                  </Paragraph>
                </>
              )}
            </StepContentContainer>
            <StepNumber
              stepNumber="2"
              title={devConnected ? "Dev server connected" : "Start the dev server"}
              complete={devConnected}
            />
            <StepContentContainer>
              {devConnected ? (
                <Paragraph>
                  Your dev server i
```

### Core Architecture Module: `apps/webapp/app/components/admin/backOffice/WebhookLimitsSection.server.ts`
```
import { Prisma } from "@trigger.dev/database";
import { z } from "zod";
import { prisma } from "~/db.server";
import { logger } from "~/services/logger.server";
import { WEBHOOK_LIMITS_INTENT } from "./WebhookLimitsSection";

const OptionalLimit = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().min(1).max(2_147_483_647).optional()
);

const SetWebhookLimitsSchema = z.object({
  intent: z.literal(WEBHOOK_LIMITS_INTENT),
  maxWaitersPerEnvironment: OptionalLimit,
  maxWaitersPerEndpoint: OptionalLimit,
  concurrency: OptionalLimit,
});

export type WebhookLimitsActionResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string[] | undefined> };

export async function handleWebhookLimitsAction(
  formData: FormData,
  orgId: string,
  adminUserId: string
): Promise<WebhookLimitsActionResult> {
  const submission = SetWebhookLimitsSchema.safeParse(Object.fromEntries(formData));
  if (!submission.success) {
    return { ok: false, errors: submission.error.flatten().fieldErrors };
  }

  const existing = await prisma.organization.findFirst({
    where: { id: orgId },
    select: { webhookLimitsConfig: true },
  });
  if (!existing) {
    throw new Response(null, { status: 404 });
  }

  const { intent: _intent, ...values } = submission.data;
  const next = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  );

  await prisma.organization.update({
    where: { id: orgId },
    data: { webhookLimitsConfig: Object.keys(next).length > 0 ? next : Prisma.DbNull },
  });

  logger.info("admin.backOffice.webhookLimits", {
    adminUserId,
    orgId,
    previous: existing.webhookLimitsConfig,
    next,
  });

  return { ok: true };
}

```

### Core Architecture Module: `apps/webapp/app/components/admin/backOffice/WebhookLimitsSection.tsx`
```
import { Form } from "@remix-run/react";
import { useEffect, useState } from "react";
import { Button } from "~/components/primitives/Buttons";
import { FormError } from "~/components/primitives/FormError";
import { Header2 } from "~/components/primitives/Headers";
import { Hint } from "~/components/primitives/Hint";
import { Input } from "~/components/primitives/Input";
import { Label } from "~/components/primitives/Label";
import { Paragraph } from "~/components/primitives/Paragraph";
import * as Property from "~/components/primitives/PropertyTable";
import type { WebhookLimits, WebhookLimitsConfig } from "~/v3/webhookLimits";

export const WEBHOOK_LIMITS_INTENT = "set-webhook-limits";
export const WEBHOOK_LIMITS_SAVED_VALUE = "webhook-limits";

type FieldErrors = Record<string, string[] | undefined> | null;

const FIELDS: Array<{ key: keyof WebhookLimits; label: string; hint: string }> = [
  {
    key: "maxWaitersPerEnvironment",
    label: "Waiters per environment",
    hint: "Live webhook waiters one environment can hold across all its endpoints.",
  },
  {
    key: "maxWaitersPerEndpoint",
    label: "Waiters per endpoint",
    hint: "Live waiters on one endpoint, which is also the most one delivery can resume.",
  },
  {
    key: "concurrency",
    label: "Processing concurrency",
    hint: "Webhook jobs one environment can have in flight at once.",
  },
];

type Props = {
  limits: WebhookLimits;
  overrides: WebhookLimitsConfig;
  errors: FieldErrors;
  savedJustNow: boolean;
  isSubmitting: boolean;
};

export function WebhookLimitsSection({
  limits,
  overrides,
  errors,
  savedJustNow,
  isSubmitting,
}: Props) {
  const hasFieldErrors = !!errors && Object.keys(errors).length > 0;
  const fieldError = (field: string) =>
    errors && field in errors ? errors[field]?.[0] : undefined;

  const [isEditing, setIsEditing] = useState(hasFieldErrors);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- This effect intentionally synchronizes local state after an external or lifecycle change.
    if (hasFieldErrors) setIsEditing(true);
  }, [hasFieldErrors]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- This effect intentionally synchronizes local state after an external or lifecycle change.
    if (savedJustNow && !hasFieldErrors) setIsEditing(false);
  }, [savedJustNow, hasFieldErrors]);

  return (
    <section className="flex flex-col gap-3 rounded-md border border-grid-bright bg-background-bright p-4">
      <div className="flex items-center justify-between">
        <Header2>Webhook limits</Header2>
        {!isEditing && (
          <Button
            variant="tertiary/small"
            onClick={() => setIsEditing(true)}
            disabled={isSubmitting}
          >
            Edit
          </Button>
        )}
      </div>
      <Paragraph variant="small" className="text-text-dimmed">
        Set by the org's plan. A blank field uses the system default.
      </Paragraph>

      {savedJustNow && (
        <div className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2">
          <Paragraph variant="small" className="text-green-500">
            Saved.
          </Paragraph>
        </div>
      )}

      {!isEditing ? (
        <Property.Table>
          {FIELDS.map((field) => (
            <Property.Item key={field.key}>
              <Property.Label>{field.label}</Property.Label>
              <Property.Value>
                {limits[field.key].toLocaleString()}
                <span className="text-text-dimmed">
                  {overrides[field.key] !== undefined ? " (org)" : " (default)"}
                </span>
              </Property.Value>
            </Property.Item>
          ))}
        </Property.Table>
      ) : (
        <Form method="post" className="flex flex-col gap-3 pt-2">
          <input type="hidden" name="intent" value={WEBHOOK_LIMITS_INTENT} />
          {FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <Label>{field.label}</Label>
              <Input
                name={field.key}
                type="number"
                min={1}
                defaultValue={overrides[field.key]?.toString() ?? ""}
                placeholder={`Default: ${limits[field.key].toLocaleString()}`}
              />
              <Hint>{field.hint}</Hint>
              <FormError>{fieldError(field.key)}</FormError>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary/medium" disabled={isSubmitting}>
              Save
            </Button>
            <Button
              type="button"
              variant="tertiary/medium"
              onClick={() => setIsEditing(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </Form>
      )}
    </section>
  );
}

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

### Incident Patch 1: `eb04c319` (2026-10-05)
**Commit Message**: fix(supervisor): replace a requeued cold start's Runner instead of failing every redelivery on it

Supervisor: when a run is requeued after its Runner never started, replace the stale Runner instead of retrying into a name conflict until it expires.
Mono-RevId: e402081626e486d4ac4b25b173e65fe2d477802f

**File**: `apps/supervisor/src/workloadManager/runCrd.test.ts` (modified, +120/-6)
```diff
@@ -516,6 +516,126 @@ describe("run-crd carries every shared create-option or excludes it on purpose",
   });
 });
 
+describe("RunCrdWorkloadManager.create", () => {
+  const manager = () =>
+    new RunCrdWorkloadManager({
+      workloadApiProtocol: "http",
+      workloadApiPort: 8020,
+      namespace: "v4-runs",
+      runtime: "microvm",
+    });
+
+  beforeEach(() => {
+    createRunner.mockReset();
+    createRunner.mockResolvedValue({ metadata: { uid: "uid-created" } });
+    getRunner.mockReset();
+    deleteRunner.mockReset();
+    deleteRunner.mockResolvedValue({});
+  });
+
+  // createOptions() is dequeued at 03:00:00, so the default is an earlier delivery.
+  const inTheWay = (snapshotFriendlyID: string, dequeuedAt?: string) => ({
+    metadata: { name: "runner-abc123", uid: "uid-existing" },
+    spec: {
+      bootstrap: {
+        runFriendlyID: "run_abc123",
+        snapshotFriendlyID,
+        dequeuedAt: dequeuedAt ?? "2026-08-27T02:59:00.000Z",
+      },
+    },
+  });
+
+  // The platform requeued an earlier delivery that never started the attempt.
+  it("replaces a Runner an earlier delivery left, guarded by its uid", async () => {
+    createRunner
+      .mockRejectedValueOnce({ code: 409 })
+      .mockResolvedValueOnce({ metadata: { uid: "uid-recreated" } });
+    getRunner.mockResolvedValue(inTheWay("snapshot_earlier"));
+
+    await manager().create(createOptions());
+
+    expect(deleteRunner).toHaveBeenCalledWith(
+      expect.objectContaining({
+        name: "runner-abc123",
+        body: { preconditions: { uid: "uid-existing" } },
+      })
+    );
+    expect(createRunner).toHaveBeenCalledTimes(2);
+  });
+
+  // The first create found the old Runner's Secret, which the collector takes with it.
+  it("gives the replacement a token Secret of its own", async () => {
+    createRunner
+      .mockRejectedValueOnce({ code: 409 })
+      .mockResolvedValueOnce({ metadata: { uid: "uid-recreated" } });
+    getRunner.mockResolvedValue(inTheWay("snapshot_earlier"));
+    createSecret.mockReset();
+    createSecret.mockResolvedValue({ metadata: { uid: "uid-secret" } });
+    patchObject.mockResolvedValue({});
+
+    await manager().create(createOptions({ deploymentToken: "tok" }));
+
+    const [first, second] = createRunner.mock.calls.map(
+      ([{ body }]) => body.spec.deployment.token.name
+    );
+    expect(second).not.toBe(first);
+  });
+
+  it("leaves a Runner this delivery already made", async () => {
+    createRunner.mockRejectedValueOnce({ code: 409 });
+    getRunner.mockResolvedValue(inTheWay("snapshot_abc"));
+
+    await manager().create(createOptions());
+
+    expect(deleteRunner).not.toHaveBeenCalled();
+    expect(createRunner).toHaveBeenCalledTimes(1);
+  });
+
+  // A delivery held up past the requeue must not remove the one that followed it.
+  it.each([
+    ["a later delivery", "2026-08-27T03:01:00.000Z"],
+    ["a delivery dequeued at the same time", "2026-08-27T03:00:00.000Z"],
+    ["a delivery of unknown order", ""],
+  ])("leaves a Runner from %s and fails as stale", async (_, dequeuedAt) => {
+    createRunner.mockRejectedValueOnce({ code: 409 });
+    getRunner.mockResolvedValue(inTheWay("snapshot_later", dequeuedAt));
+
+    await expect(manager().create(createOptions())).rejects.toThrow("stale");
+    expect(deleteRunner).not.toHaveBeenCalled();
+    expect(createRunner).toHaveBeenCalledTimes(1);
+  });
+
+  // Another delivery of this snapshot made the replacement in the gap.
+  it("accepts a replacement for this snapshot that another delivery made first", async () => {
+    createRunner.mockRejectedValue({ code: 409 });
+    getRunner
+      .mockResolvedValueOnce(inTheWay("snapshot_earlier"))
+      .mockResolvedValueOnce(inTheWay("snapshot_abc", "2026-08-27T03:00:00.000Z"));
+
+    await manager().create(createOptions());
+
+    expect(createRunner).toHaveBeenCalledTimes(2);
+  });
+
+  it("replaces it only once per delivery", async () => {
+    createRunner.mockRejectedValue({ code: 409 });
+    getRunner.mockResolvedValue(inTheWay("snapshot_earlier"));
+
+    await expect(manager().create(createOptions())).rejects.toThrow("still in the way");
+    expect(createRunner).toHaveBeenCalledTimes(2);
+  });
+
+  it("creates again when the Runner went between the create and the read", async () => {
+    createRunner.mockRejectedValueOnce({ code: 409 });
+    getRunner.mockRejectedValue({ code: 404 });
+
+    await manager().create(createOptions());
+
+    expect(deleteRunner).not.toHaveBeenCalled();
+    expect(createRunner).toHaveBeenCalledTimes(2);
+  });
+});
+
 describe("RunCrdWorkloadManager.restore", () => {
   const checkpoint = { id: "checkpoint_abc", location: "node-a/6f1c2a9e-snap" };
 
@@ -709,12 +829,6 @@ describe("RunCrdWorkloadManager.restore", () => {
     expect(createRunner).toHaveBeenCalledTimes(2);
   });
 
-  it("still fails a cold start that finds a Runner in the way", async () => {
-    createRunner.mockRejectedValue({ co
```

**File**: `apps/supervisor/src/workloadManager/runCrd.ts` (modified, +64/-10)
```diff
@@ -339,11 +339,16 @@ export class RunCrdWorkloadManager implements WorkloadManager, RunnerSnapshotter
     return outcome ? { ...outcome, createdAt: createdAtOf(runner), uid: uidOf(runner) } : timedOut;
   }
 
+  /** Deletes a failed resume so its redelivery can create it again. */
+  async deleteRestoreRunner(runnerId: string, uid: string): Promise<void> {
+    await this.deleteRunner(runnerId, uid);
+  }
+
   /**
-   * Deletes a failed resume so its redelivery can create it again. Preconditioned
-   * on uid, so a Runner that already replaced it is left alone; one already gone is fine.
+   * Preconditioned on uid, so a Runner that already replaced this one is left
+   * alone; one already gone is fine.
    */
-  async deleteRestoreRunner(runnerId: string, uid: string): Promise<void> {
+  private async deleteRunner(runnerId: string, uid: string): Promise<void> {
     try {
       await this.k8s.custom.deleteNamespacedCustomObject({
         group: GROUP,
@@ -378,8 +383,54 @@ export class RunCrdWorkloadManager implements WorkloadManager, RunnerSnapshotter
     return this.runtime === "microvm" && checkpoint.type === "COMPUTE";
   }
 
+  /**
+   * A cold start's Runner is named for its attempt, so one already in the way is
+   * another delivery of this attempt. One for this snapshot is this delivery's
+   * own create, made again. One dequeued before this delivery is one the
+   * platform has since requeued (it never started the attempt), which can't
+   * start it now, so it is replaced, once and guarded by its uid. Left in place,
+   * it failed every redelivery's create until the operator's terminal TTL took
+   * it. One dequeued after this delivery is newer, and this delivery is the
+   * stale one.
+   */
   async create(opts: WorkloadManagerCreateOptions) {
-    await this.createRunner(opts, getRunnerId(opts.runFriendlyId, opts.nextAttemptNumber));
+    const runnerId = getRunnerId(opts.runFriendlyId, opts.nextAttemptNumber);
+    if (await this.createRunner(opts, runnerId)) {
+      return;
+    }
+    try {
+      const existing = (await this.getRunner(runnerId)) as RunnerBootstrapSpec | null;
+      const bootstrap = existing?.spec?.bootstrap;
+      if (bootstrap?.snapshotFriendlyID === opts.snapshotFriendlyId) {
+        return;
+      }
+      // Unknown order counts as newer: only a Runner shown to be older is deleted.
+      if (!(Date.parse(bootstrap?.dequeuedAt ?? "") < opts.dequeuedAt.getTime())) {
+        throw new Error(
+          `Runner ${runnerId} belongs to a delivery dequeued after this one, which is stale`
+        );
+      }
+      const uid = uidOf(existing);
+      if (!uid) {
+        throw new Error(`Runner ${runnerId} is in the way, with no uid to guard its delete`);
+      }
+      await this.deleteRunner(runnerId, uid);
+    } catch (err: unknown) {
+      // Deleted between the create and the read.
+      if (statusCodeOf(err) !== 404) {
+        throw err;
+      }
+    }
+    // A Secret of its own: the one this create found is the deleted Runner's, and
+    // the collector takes it.
+    if (await this.createRunner(opts, runnerId, undefined, true)) {
+      return;
+    }
+    // Another delivery of this snapshot may have made it in the gap.
+    const raced = (await this.getRunner(runnerId)) as RunnerBootstrapSpec | null;
+    if (raced?.spec?.bootstrap?.snapshotFriendlyID !== opts.snapshotFriendlyId) {
+      throw new Error(`Runner ${runnerId} is still in the way after replacing it`);
+    }
   }
 
   /**
@@ -462,13 +513,14 @@ export class RunCrdWorkloadManager implements WorkloadManager, RunnerSnapshotter
     }
   }
 
-  /** Returns false when a resume's Runner was already there. */
+  /** Returns false when the Runner was already there. */
   private async createRunner(
     opts: WorkloadManagerCreateOptions,
     runnerId: string,
-    restore?: RunnerRestore
+    restore?: RunnerRestore,
+    replacing = false
   ): Promise<{ uid?: string } | false> {
-    const token = await this.ensureRunnerToken(opts, runnerId, !!restore);
+    const token = await this.ensureRunnerToken(opts, runnerId, !!restore || replacing);
 
     const body = runnerBodyFor(opts, {
       name: runnerId,
@@ -495,8 +547,8 @@ export class RunCrdWorkloadManager implements WorkloadManager, RunnerSnapshotter
       await this.releaseRunnerToken(token, err);
       // A resume's name carries the checkpoint, so the Runner in the way is this
       // resume, still restoring or held terminal for the operator's TTL. A cold
-      // start's carries the attempt, so its 409 is an earlier terminal Runner.
-      if (restore && statusCodeOf(err) === 409) {
+      // start's carries the attempt: create sorts out which delivery made it.
+      if (statusCodeOf(err) === 409) {
         return false;
       }
       this.logger.error("[RunCrdWorkloadManager] Create failed", { runnerId, rawError: err });
@@ -971,7 +1023,9 @@ export type UnwatchedRestoreFailure = {
 };
 
 type RunnerBootstrapSpec = {

```

---

### Incident Patch 2: `e39f4452` (2026-10-05)
**Commit Message**: feat(supervisor): stop gracefully on SIGTERM, send the snapshot route with restore reports, keep the failed-pod informer alive

The supervisor now shuts down gracefully on SIGTERM, and its Kubernetes
pod watcher recovers from API errors instead of stopping.

Mono-RevId: a87068c3ab16ad9d6955fcdfd69e33c8251e9e75

**File**: `apps/supervisor/package.json` (modified, +2/-1)
```diff
@@ -29,6 +29,7 @@
   },
   "devDependencies": {
     "@internal/testcontainers": "workspace:*",
-    "@types/dockerode": "^3.3.33"
+    "@types/dockerode": "^3.3.33",
+    "socket.io-client": "4.7.5"
   }
 }
```

**File**: `apps/supervisor/src/clients/kubernetes.ts` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 import * as k8s from "@kubernetes/client-node";
-import type { Informer, KubernetesObject, ListPromise, ObjectCache } from "@kubernetes/client-node";
+import type { KubernetesObject, ListPromise } from "@kubernetes/client-node";
 import { assertExhaustive } from "@trigger.dev/core/utils";
 import { SimpleStructuredLogger } from "@trigger.dev/core/v3/utils/structuredLogger";
 
@@ -15,15 +15,15 @@ export function createK8sApi() {
     listPromiseFn: ListPromise<T>,
     labelSelector?: string,
     fieldSelector?: string
-  ): Informer<T> & ObjectCache<T> {
+  ): k8s.ListWatch<T> {
     // The client's informer is a ListWatch, which is also the cache it keeps.
     return k8s.makeInformer(
       kubeConfig,
       path,
       listPromiseFn,
       labelSelector,
       fieldSelector
-    ) as Informer<T> & ObjectCache<T>;
+    ) as k8s.ListWatch<T>;
   }
 
   const api = {
```

**File**: `apps/supervisor/src/clients/reconnectingInformer.ts` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+import { setTimeout as sleep } from "node:timers/promises";
+import type { KubernetesObject, ListPromise, ListWatch } from "@kubernetes/client-node";
+import type { SimpleStructuredLogger } from "@trigger.dev/core/v3/utils/structuredLogger";
+
+const MAX_RECONNECT_BACKOFF_MS = 30_000;
+
+type ReconnectingInformerOptions<T extends KubernetesObject> = {
+  /** Used in log fields, to tell informers apart. */
+  name: string;
+  logger: SimpleStructuredLogger;
+  reconnectIntervalMs: number;
+  list: ListPromise<T>;
+  /** Builds the informer around the list it is given, which wraps `list`. */
+  makeInformer: (list: ListPromise<T>) => ListWatch<T>;
+  /** Called for every error the informer raises, before any reconnect. */
+  onError?: (err: unknown) => void;
+};
+
+/**
+ * An informer that reconnects with a capped backoff until a start succeeds, for
+ * as long as it runs. The client's own error handling gives up after one failure.
+ */
+export class ReconnectingInformer<T extends KubernetesObject> {
+  readonly informer: ListWatch<T>;
+  private readonly name: string;
+  private readonly logger: SimpleStructuredLogger;
+  private readonly reconnectIntervalMs: number;
+  private readonly listFn: ListPromise<T>;
+  private readonly onErrorHook?: (err: unknown) => void;
+  private running = false;
+  private reconnecting = false;
+  private erroredDuringReconnect = false;
+  private starting = false;
+  private ownListPending = false;
+
+  constructor(opts: ReconnectingInformerOptions<T>) {
+    this.name = opts.name;
+    this.logger = opts.logger;
+    this.reconnectIntervalMs = opts.reconnectIntervalMs;
+    this.listFn = opts.list;
+    this.onErrorHook = opts.onError;
+    this.informer = opts.makeInformer(() => this.list());
+    this.informer.on("error", (err?: unknown) => void this.onError(err));
+  }
+
+  get isRunning(): boolean {
+    return this.running;
+  }
+
+  /** Rejects when the first list fails, so the caller learns the informer never started. */
+  async start() {
+    if (this.running) {
+      return;
+    }
+    this.running = true;
+    await this.startInformer();
+  }
+
+  async stop() {
+    if (!this.running) {
+      return;
+    }
+    this.running = false;
+    await this.informer.stop();
+  }
+
+  /**
+   * The client relists on its own after a 410 and leaves that list's rejection
+   * unhandled, so a failure there becomes a reconnect and the abandoned relist
+   * never settles. An empty list instead would delete every cached object. Only
+   * a start's own list rejects into the start: a 410 on the watch that start
+   * opens relists inside it too, and nothing awaits that one.
+   */
+  private async list() {
+    const ownList = this.starting && this.ownListPending;
+    this.ownListPending = false;
+    try {
+      return await this.listFn();
+    } catch (err: unknown) {
+      if (ownList) {
+        throw err;
+      }
+      void this.onError(err);
+      return new Promise<never>(() => {});
+    }
+  }
+
+  private async startInformer() {
+    this.starting = true;
+    // A start lists first only when it has no resourceVersion to watch from.
+    this.ownListPending = !this.informer.latestResourceVersion();
+    try {
+      await this.informer.start();
+    } finally {
+      this.starting = false;
+    }
+    // A stop during the list still lets the client open its watch afterwards.
+    if (!this.running) {
+      await this.informer.stop();
+    }
+  }
+
+  /**
+   * Retries until a start ends with no error raised during it. A watch that
+   * fails to connect raises its error inside the start, which still resolves.
+   */
+  private async onError(err: unknown) {
+    if (!this.running) {
+      return;
+    }
+    this.onErrorHook?.(err);
+    if (this.reconnecting) {
+      this.erroredDuringReconnect = true;
+      return;
+    }
+    this.reconnecting = true;
+    this.logger.error("Informer watch failed, reconnecting", {
+      informer: this.name,
+      error: messageOf(err),
+    });
+    let delayMs = this.reconnectIntervalMs;
+    try {
+      do {
+        await sleep(delayMs);
+        if (!this.running) {
+          return;
+        }
+        this.erroredDuringReconnect = false;
+        try {
+          await this.startInformer();
+        } catch (reconnectErr: unknown) {
+          this.erroredDuringReconnect = true;
+          this.logger.error("Informer reconnect failed", {
+            informer: this.name,
+            error: messageOf(reconnectErr),
+          });
+        }
+        delayMs = Math.min(
+          delayMs * 2,
+          Math.max(this.reconnectIntervalMs, MAX_RECONNECT_BACKOFF_MS)
+        );
+      } while (this.running && this.erroredDuringReconnect);
+    } finally {
+      this.reconnecting = false;
+    }
+  }
+}
+
+function messageOf(err: unknown): string {
+  return err instanceof Error ? err.message : String(err);
+}
```

**File**: `apps/supervisor/src/env.ts` (modified, +4/-0)
```diff
@@ -19,6 +19,10 @@ export const Env = z
     // Opt-in, dev-only: stream this process's logs over a local telnet/TCP socket on this port.
     SUPERVISOR_TELNET_LOGS_PORT: z.coerce.number().optional(),
 
+    // How long a SIGTERM or SIGINT waits for a clean stop before exiting anyway. Keep it below
+    // the pod's terminationGracePeriodSeconds, so the exit is this process's and not a SIGKILL.
+    SUPERVISOR_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
+
     // Required settings
     TRIGGER_API_URL: z.string().url(),
     TRIGGER_WORKER_TOKEN: z.string().min(1), // accepts file:// path to read from a file
```

**File**: `apps/supervisor/src/index.ts` (modified, +54/-112)
```diff
@@ -21,24 +21,24 @@ import { KubernetesWorkloadManager } from "./workloadManager/kubernetes.js";
 import {
   RunCrdWorkloadManager,
   RunnerRestoreInformer,
-  restoreHeartbeat,
   settleRestoreFailure,
-  type RestoreRunner,
-  type RestoreWatchResult,
 } from "./workloadManager/runCrd.js";
+import { RestoreWatcher, type RestoreFailure } from "./services/restoreWatcher.js";
 import { DockerWorkloadManager } from "./workloadManager/docker.js";
 import { ComputeWorkloadManager } from "./workloadManager/compute.js";
 import {
   HttpServer,
   CheckpointClient,
   isKubernetesEnvironment,
 } from "@trigger.dev/core/v3/serverOnly";
+import { installShutdown } from "./shutdown.js";
 import { createK8sApi, createPodCountFetcher } from "./clients/kubernetes.js";
 import { resolveResponseSchema } from "./clients/responseSchemas.js";
 import { collectDefaultMetrics, Counter, Gauge, Histogram } from "prom-client";
 import { register } from "./metrics.js";
 import { PodCleaner } from "./services/podCleaner.js";
 import { FailedPodHandler } from "./services/failedPodHandler.js";
+import { DequeueDrain } from "./services/dequeueDrain.js";
 import { getWorkerToken } from "./workerToken.js";
 import { mintDeploymentToken } from "./workloadToken.js";
 import { OtlpTraceService } from "./services/otlpTraceService.js";
@@ -88,46 +88,24 @@ const outboundRequestDuration = new Histogram({
   registers: [register],
 });
 
-const restoreWatchesInFlight = new Gauge({
-  name: "supervisor_restore_watches_in_flight",
-  help: "Restore Runners the supervisor is waiting on to start or fail.",
-  registers: [register],
-});
-
-const restoreOutcomesTotal = new Counter({
-  name: "supervisor_restore_outcomes_total",
-  help: "Restore watches ended, by outcome and reason: the operator's failure reason, or Timeout, RunnerGone or ReadFailed from the watch itself.",
-  labelNames: ["outcome", "reason"],
-  registers: [register],
-});
-
-const restoreDuration = new Histogram({
-  name: "supervisor_restore_duration_seconds",
-  help: "Time from a restore Runner's creation to the supervisor seeing it Running or Failed.",
-  labelNames: ["outcome"],
-  buckets: [1, 2.5, 5, 10, 20, 30, 60, 120, 300, 600, 900],
-  registers: [register],
-});
-
 const restoreReportsTotal = new Counter({
   name: "supervisor_restore_reports_total",
   help: "Failed restores reported to the platform, by outcome (requeue or fail) and result: ok, conflict when the run had already moved on, or error.",
   labelNames: ["outcome", "result"],
   registers: [register],
 });
 
-/** `uid` is the Runner the watch is bound to; `abort` ends a watch a newer Runner replaced. */
-type WatchedRestore = { uid?: string; snapshotFriendlyId: string; abort: AbortController };
-
 class ManagedSupervisor {
   private readonly workerSession: SupervisorSession;
+  private readonly dequeueDrain: DequeueDrain;
   private readonly metricsServer?: HttpServer;
   private readonly workloadServer: WorkloadServer;
   private readonly workloadManager: WorkloadManager;
   private readonly workloadManagerBackend: "compute" | "kubernetes" | "run-crd" | "docker";
   private readonly computeManager?: ComputeWorkloadManager;
   private readonly runCrdManager?: RunCrdWorkloadManager;
   private readonly restoreInformer?: RunnerRestoreInformer;
+  private readonly restoreWatcher?: RestoreWatcher;
   private readonly logger = new SimpleStructuredLogger("managed-supervisor");
   private readonly resourceMonitor: ResourceMonitor;
   private readonly checkpointClient?: CheckpointClient;
@@ -137,8 +115,6 @@ class ManagedSupervisor {
   private readonly failedPodHandler?: FailedPodHandler;
   private readonly tracing?: OtlpTraceService;
   private readonly backpressureMonitors: BackpressureMonitor[] = [];
-  /** Restore Runners being watched, each with the latest snapshot dequeued for it. */
-  private readonly watchedRestores = new Map<string, WatchedRestore>();
   private readonly backpressureRedis?: Redis;
 
   private readonly isKubernetes = isKubernetesEnvironment(env.KUBERNETES_FORCE_ENABLED);
@@ -246,12 +222,10 @@ class ManagedSupervisor {
       ) {
         this.restoreInformer = new RunnerRestoreInformer({
           namespace: env.KUBERNETES_NAMESPACE,
-          onUnwatchedFailure: ({ runFriendlyId, snapshotFriendlyId, runnerId, outcome }) =>
-            void this.reportRestoreFailure(runFriendlyId, snapshotFriendlyId, runnerId, outcome),
+          onUnwatchedFailure: (failure) => void this.restoreWatcher?.report(failure),
           onUnwatchedRestore: ({ runnerId, uid, runFriendlyId, snapshotFriendlyId }) => {
-            if (this.runCrdManager && runFriendlyId && snapshotFriendlyId) {
-              void this.watchRestore(
-                this.runCrdManager,
+            if (runFriendlyId && snapshotFriendlyId) {
+              void this.restoreWatcher?.watch(
                 { runFriendlyId, snapshotFriendlyId },
                 { runnerId, uid }
               );
@@ -273,6 +247,14 @@ clas
```

**File**: `apps/supervisor/src/services/dequeueDrain.test.ts` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+import type { SimpleStructuredLogger } from "@trigger.dev/core/v3/utils/structuredLogger";
+import { createServer, type Server } from "node:http";
+import type { AddressInfo } from "node:net";
+import { SupervisorSession } from "@trigger.dev/core/v3/workers";
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { z } from "zod";
+import { DequeueDrain } from "./dequeueDrain.js";
+
+const logger = {
+  log: vi.fn(),
+  error: vi.fn(),
+  warn: vi.fn(),
+  info: vi.fn(),
+  debug: vi.fn(),
+} as unknown as SimpleStructuredLogger;
+
+function deferred<T = void>() {
+  let resolve!: (value: T) => void;
+  const promise = new Promise<T>((r) => (resolve = r));
+  return { promise, resolve };
+}
+
+/** A platform API whose dequeue responses are held until the test releases them. */
+async function startPlatform() {
+  const dequeues: Array<(messages: unknown[]) => void> = [];
+  const requested = deferred();
+  const server = createServer((req, res) => {
+    const reply = (body: unknown) => {
+      res.writeHead(200, { "content-type": "application/json" });
+      res.end(JSON.stringify(body));
+    };
+    if (req.url?.endsWith("/connect")) {
+      reply({ ok: true, workerGroup: { type: "MANAGED", name: "test" } });
+    } else if (req.url?.endsWith("/dequeue")) {
+      dequeues.push(reply);
+      requested.resolve();
+    } else {
+      reply({ ok: true });
+    }
+  });
+  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
+  const { port } = server.address() as AddressInfo;
+  return { server, url: `http://127.0.0.1:${port}`, dequeues, requested: requested.promise };
+}
+
+let platform: Server | undefined;
+let session: SupervisorSession | undefined;
+
+afterEach(async () => {
+  await session?.stop();
+  session = undefined;
+  platform?.closeAllConnections();
+  await new Promise((resolve) => platform?.close(resolve));
+  platform = undefined;
+});
+
+function newSession(apiUrl: string, preDequeue?: () => Promise<{ skipDequeue?: boolean }>) {
+  return new SupervisorSession({
+    apiUrl,
+    workerToken: "test-token",
+    instanceName: "test",
+    heartbeatIntervalSeconds: 60,
+    dequeueIntervalMs: 10,
+    dequeueIdleIntervalMs: 10,
+    runNotificationsEnabled: false,
+    scaling: { strategy: "none", maxConsumerCount: 1 },
+    preDequeue,
+    // The drain cares when messages arrive, not what they hold.
+    resolveResponseSchema: <T>(_schema: T) => z.any() as unknown as T,
+  });
+}
+
+const isSettled = (promise: Promise<unknown>) =>
+  Promise.race([promise.then(() => true), new Promise((r) => setTimeout(() => r(false), 50))]);
+
+describe("DequeueDrain", () => {
+  it("waits for a dequeue in flight and the handler its message starts", async () => {
+    const api = await startPlatform();
+    platform = api.server;
+    session = newSession(api.url);
+    const drain = new DequeueDrain(session, logger);
+
+    const handled: string[] = [];
+    const create = deferred();
+    session.on(
+      "runQueueMessage",
+      drain.tracked(async ({ message }) => {
+        handled.push((message as unknown as { id: string }).id);
+        await create.promise;
+      })
+    );
+
+    await session.start();
+    await api.requested;
+
+    await session.stop();
+    const drained = drain.stop();
+    expect(await isSettled(drained)).toBe(false);
+
+    api.dequeues[0]!([{ id: "message_1" }]);
+    await expect.poll(() => handled).toEqual(["message_1"]);
+    expect(await isSettled(drained)).toBe(false);
+
+    create.resolve();
+    await drained;
+  });
+
+  // Tracking handles the rejection, which would otherwise have crashed the process.
+  it("logs a handler that fails, and still drains", async () => {
+    const api = await startPlatform();
+    platform = api.server;
+    session = newSession(api.url);
+    const drain = new DequeueDrain(session, logger);
+
+    const handler = drain.tracked(async () => {
+      throw new Error("boom");
+    });
+    await expect(handler()).rejects.toThrow("boom");
+    await drain.stop();
+
+    expect(logger.error).toHaveBeenCalledWith("Dequeued message handler failed", { error: "boom" });
+  });
+
+  it("makes no request for a consumer stopped during its pre-dequeue check", async () => {
+    const api = await startPlatform();
+    platform = api.server;
+    const checking = deferred();
+    const check = deferred<{ skipDequeue?: boolean }>();
+    session = newSession(api.url, () => {
+      checking.resolve();
+      return check.promise;
+    });
+    const drain = new DequeueDrain(session, logger);
+
+    await session.start();
+    await checking.promise;
+
+    await session.stop();
+    await drain.stop();
+    check.resolve({});
+
+    expect(await isSettled(api.requested)).toBe(false);
+    expect(api.dequeues).toHaveLength(0);
+  });
+});
```

**File**: `apps/supervisor/src/services/dequeueDrain.ts` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+import type { SupervisorSession } from "@trigger.dev/core/v3/workers";
+import type { SimpleStructuredLogger } from "@trigger.dev/core/v3/utils/structuredLogger";
+
+/**
+ * Lets a shutdown wait for the session's dequeue requests and the message handlers
+ * they start. The session's stop waits for neither: a request in flight still emits
+ * its messages, and the emit does not await the handlers.
+ */
+export class DequeueDrain {
+  private readonly pending = new Set<Promise<unknown>>();
+  private stopped = false;
+
+  constructor(
+    session: SupervisorSession,
+    private readonly logger: SimpleStructuredLogger
+  ) {
+    const client = session.httpClient;
+    const dequeue = client.dequeue.bind(client);
+    client.dequeue = (...args) => {
+      // A consumer stopped while awaiting its pre-dequeue check still makes the request.
+      if (this.stopped) {
+        return Promise.resolve({ success: true as const, data: [] });
+      }
+      return this.track(dequeue(...args));
+    };
+  }
+
+  /**
+   * Wraps an async listener so `stop` waits for each call of it. Tracking handles
+   * its rejection, which would otherwise crash the process, so it is logged here.
+   */
+  tracked<A extends unknown[]>(fn: (...args: A) => Promise<void>): (...args: A) => Promise<void> {
+    return (...args) => {
+      const call = fn(...args);
+      call.catch((error: unknown) =>
+        this.logger.error("Dequeued message handler failed", {
+          error: error instanceof Error ? error.message : String(error),
+        })
+      );
+      return this.track(call);
+    };
+  }
+
+  /** Admits no more dequeues and resolves once the requests and handlers in flight settle. */
+  async stop(): Promise<void> {
+    this.stopped = true;
+    if (this.pending.size > 0) {
+      // Logged first: anything still pending when the shutdown times out is lost.
+      this.logger.log("Draining dequeues in flight", { inFlight: this.pending.size });
+    }
+    // A request that settles here starts its handlers before the next check.
+    while (this.pending.size > 0) {
+      await Promise.allSettled(this.pending);
+    }
+  }
+
+  private track<T>(promise: Promise<T>): Promise<T> {
+    this.pending.add(promise);
+    const remove = () => this.pending.delete(promise);
+    promise.then(remove, remove);
+    return promise;
+  }
+}
```

**File**: `apps/supervisor/src/services/failedPodHandler.reconnect.test.ts` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+import { describe, expect, it, vi } from "vitest";
+import {
+  ListWatch,
+  type KubernetesObject,
+  type ListPromise,
+  type Watch,
+} from "@kubernetes/client-node";
+import { Registry } from "prom-client";
+import type { K8sApi } from "../clients/kubernetes.js";
+import { FailedPodHandler } from "./failedPodHandler.js";
+
+describe("FailedPodHandler reconnects", () => {
+  type WatchCall = {
+    query: Record<string, string>;
+    callback: (phase: string, obj: unknown) => void;
+    done: (err: unknown) => void;
+  };
+
+  /** The client's own ListWatch over a fake Watch, which can fail to connect as the real one does. */
+  function setup(connects: Array<"ok" | "fail" | "gone"> = []) {
+    const calls: WatchCall[] = [];
+    const aborts: number[] = [];
+    const watch = {
+      watch: vi.fn(
+        async (
+          _path: string,
+          query: Record<string, string>,
+          callback: WatchCall["callback"],
+          done: WatchCall["done"]
+        ) => {
+          calls.push({ query, callback, done });
+          const index = calls.length - 1;
+          // The real Watch calls done with its fetch error before returning.
+          const connect = connects.shift();
+          if (connect === "fail") {
+            done(new Error("connect ECONNREFUSED"));
+          }
+          if (connect === "gone") {
+            done(Object.assign(new Error("Gone"), { statusCode: 410 }));
+          }
+          return { abort: () => aborts.push(index) };
+        }
+      ),
+    };
+    const listNamespacedPod = vi.fn();
+    const deleteNamespacedPod = vi.fn(async () => ({}));
+    const handler = new FailedPodHandler({
+      namespace: "v4-runs",
+      reconnectIntervalMs: 1,
+      register: new Registry(),
+      k8s: {
+        makeInformer: (path: string, listFn: ListPromise<KubernetesObject>, selector?: string) =>
+          new ListWatch(path, watch as unknown as Watch, listFn, false, selector),
+        core: { listNamespacedPod, deleteNamespacedPod },
+      } as unknown as K8sApi,
+    });
+    return { calls, aborts, handler, listNamespacedPod, deleteNamespacedPod };
+  }
+
+  function failedPod(name: string, resourceVersion = "2") {
+    return {
+      metadata: { name, namespace: "v4-runs", uid: `uid-${name}`, resourceVersion },
+      status: { phase: "Failed" },
+    };
+  }
+
+  const emptyList = (resourceVersion: string) => ({ items: [], metadata: { resourceVersion } });
+
+  // The client relists inside the start when the watch it opens answers 410, and
+  // nothing awaits that list: its failure must become a reconnect, not a crash.
+  it("reconnects when a start's watch is gone and its relist fails", async () => {
+    const { calls, handler, listNamespacedPod, deleteNamespacedPod } = setup(["ok", "gone", "ok"]);
+    // The reconnect has a resourceVersion, so its only list is the relist the 410 starts.
+    listNamespacedPod
+      .mockResolvedValueOnce(emptyList("1"))
+      .mockRejectedValueOnce(new Error("list 503"))
+      .mockResolvedValue(emptyList("3"));
+    await handler.start();
+
+    calls[0]!.done(new Error("stream reset"));
+    await vi.waitFor(() => expect(calls).toHaveLength(3));
+    calls[2]!.callback("ADDED", failedPod("pod-a"));
+
+    await vi.waitFor(() =>
+      expect(deleteNamespacedPod).toHaveBeenCalledWith({ name: "pod-a", namespace: "v4-runs" })
+    );
+    await handler.stop();
+  });
+
+  it("closes the watch a start opens after it was stopped", async () => {
+    const { calls, aborts, handler, listNamespacedPod } = setup();
+    let listed!: (list: unknown) => void;
+    listNamespacedPod.mockReturnValueOnce(new Promise((resolve) => (listed = resolve)));
+    const started = handler.start();
+    await vi.waitFor(() => expect(listNamespacedPod).toHaveBeenCalled());
+
+    await handler.stop();
+    listed(emptyList("1"));
+    await started;
+
+    expect(calls).toHaveLength(1);
+    expect(aborts).toContain(0);
+  });
+
+  it("keeps reconnecting while the watch fails to connect", async () => {
+    const { calls, handler, listNamespacedPod, deleteNamespacedPod } = setup([
+      "ok",
+      "fail",
+      "fail",
+      "ok",
+    ]);
+    listNamespacedPod.mockResolvedValue(emptyList("1"));
+    await handler.start();
+
+    calls[0]!.done(new Error("stream reset"));
+    await vi.waitFor(() => expect(calls).toHaveLength(4));
+    calls[3]!.callback("ADDED", failedPod("pod-a"));
+
+    await vi.waitFor(() =>
+      expect(deleteNamespacedPod).toHaveBeenCalledWith({ name: "pod-a", namespace: "v4-runs" })
+    );
+    await handler.stop();
+  });
+
+  it("keeps reconnecting while the list fails", async () => {
+    const { calls, handler, listNamespacedPod } = setup();
+    listNamespacedPod
+      .mockResolvedValueOnce(emptyList("1"))
+      .mockRejectedValueOnce({ code: 503 })
+      .mockRejectedValueOnce({ code: 503 })
+      .mockResolvedValue(emptyList("5"));
+    await handler.start();
+
+    // A w
```

---

### Incident Patch 3: `e3f7812d` (2026-10-05)
**Commit Message**: chore(deps): update brace-expansion

Mono-RevId: 86d44825dca4c41deb80a30fd0a4df8f92ee0d0a

**File**: `package.json` (modified, +2/-2)
```diff
@@ -143,8 +143,8 @@
       "js-cookie@<3.0.8": "3.0.8",
       "tmp@<0.2.7": "0.2.7",
       "brace-expansion@<1.1.18": "1.1.18",
-      "brace-expansion@>=2 <2.1.4": "2.1.4",
-      "brace-expansion@>=5 <5.0.9": "5.0.9",
+      "brace-expansion@>=2 <2.1.7": "^2.1.7",
+      "brace-expansion@>=5 <5.0.12": "^5.0.12",
       "mermaid@>=11 <11.16.1": "^11.16.1",
       "@jsonhero/json-infer-types>ip-address": "^10.3.1",
       "express-rate-limit>ip-address": "^10.3.1",
```

**File**: `pnpm-lock.yaml` (modified, +13/-13)
```diff
@@ -58,8 +58,8 @@ overrides:
   js-cookie@<3.0.8: 3.0.8
   tmp@<0.2.7: 0.2.7
   brace-expansion@<1.1.18: 1.1.18
-  brace-expansion@>=2 <2.1.4: 2.1.4
-  brace-expansion@>=5 <5.0.9: 5.0.9
+  brace-expansion@>=2 <2.1.7: ^2.1.7
+  brace-expansion@>=5 <5.0.12: ^5.0.12
   mermaid@>=11 <11.16.1: ^11.16.1
   '@jsonhero/json-infer-types>ip-address': ^10.3.1
   express-rate-limit>ip-address: ^10.3.1
@@ -9059,11 +9059,11 @@ packages:
   bowser@2.12.1:
     resolution: {integrity: sha512-z4rE2Gxh7tvshQ4hluIT7XcFrgLIQaw9X3A+kTTRdovCz5PMukm/0QC/BKSYPj3omF5Qfypn9O/c5kgpmvYUCw==}
 
-  brace-expansion@2.1.4:
-    resolution: {integrity: sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==}
+  brace-expansion@2.1.7:
+    resolution: {integrity: sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==}
 
-  brace-expansion@5.0.9:
-    resolution: {integrity: sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==}
+  brace-expansion@5.0.12:
+    resolution: {integrity: sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==}
     engines: {node: 20 || >=22}
 
   braces@3.0.3:
@@ -23613,11 +23613,11 @@ snapshots:
 
   bowser@2.12.1: {}
 
-  brace-expansion@2.1.4:
+  brace-expansion@2.1.7:
     dependencies:
       balanced-match: 1.0.2
 
-  brace-expansion@5.0.9:
+  brace-expansion@5.0.12:
     dependencies:
       balanced-match: 4.0.4
 
@@ -27570,23 +27570,23 @@ snapshots:
 
   minimatch@10.0.1:
     dependencies:
-      brace-expansion: 2.1.4
+      brace-expansion: 2.1.7
 
   minimatch@10.2.5:
     dependencies:
-      brace-expansion: 5.0.9
+      brace-expansion: 5.0.12
 
   minimatch@5.1.6:
     dependencies:
-      brace-expansion: 2.1.4
+      brace-expansion: 2.1.7
 
   minimatch@9.0.1:
     dependencies:
-      brace-expansion: 2.1.4
+      brace-expansion: 2.1.7
 
   minimatch@9.0.5:
     dependencies:
-      brace-expansion: 2.1.4
+      brace-expansion: 2.1.7
 
   minimist-options@4.1.0:
     dependencies:
```

---

### Incident Patch 4: `2fd34263` (2026-10-05)
**Commit Message**: fix(webhooks): give session deliveries the whd_ delivery id and the provider's id

A webhook delivery routed to an agent session now carries both ids on
its envelope:

```ts
onAction: async ({ action }) => {
  action.deliveryId; // "whd_...": the delivery in the dashboard and deliveries API, new on a replay
  action.externalDeliveryId; // the provider's id, e.g. Stripe's "evt_...", the same across replays
},
```

`deliveryId` previously held the provider's id. It now matches the id
`webhook()` tasks, waiters and the deliveries API use.

Mono-RevId: bc4eb9c3b90fc4b3fe15e3084d637819467a24f7

**File**: `apps/webapp/app/v3/webhookEngine.server.ts` (modified, +19/-2)
```diff
@@ -197,6 +197,7 @@ function createWebhookEngine() {
       source,
       headers,
       deliveryId,
+      externalDeliveryId,
       partId,
       endpoint,
       triggerConfigTemplate,
@@ -243,13 +244,29 @@ function createWebhookEngine() {
             ? {
                 chatId: externalId,
                 trigger: "submit-message",
-                channelEvent: { connectorId, event, source, headers, deliveryId, endpoint },
+                channelEvent: {
+                  connectorId,
+                  event,
+                  source,
+                  headers,
+                  deliveryId,
+                  externalDeliveryId,
+                  endpoint,
+                },
               }
             : {
                 chatId: externalId,
                 trigger: "action",
                 actionSource: "webhook",
-                action: { type: actionType, event, source, headers, deliveryId, endpoint },
+                action: {
+                  type: actionType,
+                  event,
+                  source,
+                  headers,
+                  deliveryId,
+                  externalDeliveryId,
+                  endpoint,
+                },
               };
         const part = JSON.stringify({ kind: "message", payload });
 
```

**File**: `internal-packages/webhook-engine/src/engine/fanout.test.ts` (modified, +2/-1)
```diff
@@ -239,7 +239,8 @@ containerTestWithIsolatedRedisNoClickhouse(
         targetId: "agent-x:order-events",
         externalId: "cus_1",
         actionType: "order.event",
-        deliveryId: "evt_fan_1",
+        deliveryId: delivery.friendlyId,
+        externalDeliveryId: "evt_fan_1",
         partId: `${deliveryId}:agent-x:order-events`,
         endpoint: endpointContext,
       });
```

**File**: `internal-packages/webhook-engine/src/engine/index.ts` (modified, +2/-1)
```diff
@@ -1903,7 +1903,8 @@ export class WebhookEngine {
       event: delivery.parsedEvent,
       source: endpoint.source,
       headers: (delivery.headers as Record<string, string> | null) ?? {},
-      deliveryId: delivery.externalDeliveryId,
+      deliveryId: delivery.friendlyId,
+      externalDeliveryId: delivery.externalDeliveryId,
       triggerConfigTemplate: target.triggerConfigTemplate,
       idempotencyKey: delivery.idempotencyKey,
       isSessionStart: this.#evaluateSessionStart(target.startOn, delivery, endpoint),
```

**File**: `internal-packages/webhook-engine/src/engine/ingest.test.ts` (modified, +3/-2)
```diff
@@ -855,9 +855,10 @@ containerTestWithIsolatedRedisNoClickhouse(
       expect(calls[0]?.taskIdentifier).toBe("agent-x");
       expect(calls[0]?.actionType).toBe("order.event");
       expect((calls[0]!.event as { id: string }).id).toBe(eventId);
-      expect(calls[0]?.deliveryId).toBe(eventId);
-
       const d = await prisma.webhookDelivery.findFirst({ where: { id: result.deliveryId } });
+      expect(calls[0]?.deliveryId).toBe(d?.friendlyId);
+      expect(calls[0]?.deliveryId).toMatch(/^whd_/);
+      expect(calls[0]?.externalDeliveryId).toBe(eventId);
       expect(d?.runId).toBe("srun_1"); // the session's run, from the port
     } finally {
       await engine.quit();
```

**File**: `internal-packages/webhook-engine/src/engine/types.ts` (modified, +4/-1)
```diff
@@ -216,7 +216,10 @@ export type DeliverWebhookToSessionParams = {
   event: unknown; // delivery.parsedEvent
   source: string; // provider tag
   headers: Record<string, string>;
-  deliveryId: string; // externalDeliveryId, surfaced on the envelope
+  /** The delivery's friendly id (`whd_`): new on a replay, the same across retries of one delivery. */
+  deliveryId: string;
+  /** The provider's id for the delivery (e.g. Stripe's `evt_`), the same across replays. */
+  externalDeliveryId: string;
   triggerConfigTemplate?: Record<string, unknown>;
   idempotencyKey: string;
   // Evaluated startOn: true (default) allows creating a new session; false means resume-only, so a
```

---

### Incident Patch 5: `dba857b4` (2026-10-05)
**Commit Message**: fix(run-engine): resolve the snapshot route when a stalled dequeue is requeued

Fix a stalled run occasionally not being requeued correctly when its
snapshots are stored in Redis.

Mono-RevId: 10d1c8f9d75d4cbd42475a46b68a1ec40831c7d4

**File**: `internal-packages/run-engine/src/engine/index.ts` (modified, +8/-0)
```diff
@@ -2912,6 +2912,13 @@ export class RunEngine {
             throw new Error(`Run ${runId} not found`);
           }
 
+          // The heartbeat payload carries no route, so resolve it durably for the QUEUED snapshot.
+          const snapshotRoute = await this.runAttemptSystem.effectiveRoute(
+            runId,
+            latestSnapshot.organizationId,
+            undefined
+          );
+
           //it will automatically be requeued X times depending on the queue retry settings
           const { wasRequeued } = await this.runAttemptSystem.tryNackAndRequeue({
             run,
@@ -2929,6 +2936,7 @@ export class RunEngine {
               code: "TASK_RUN_DEQUEUED_MAX_RETRIES",
               message: `Trying to create an attempt failed multiple times, exceeding how many times we retry.`,
             },
+            snapshotRoute,
             tx: prisma,
           });
 
```

**File**: `internal-packages/run-engine/src/engine/systems/runAttemptSystem.ts` (modified, +7/-7)
```diff
@@ -697,7 +697,7 @@ export class RunAttemptSystem {
   // residency ONCE (forceDurable) so the transition still lands in the run's true store instead of
   // taking the never-enrolled Postgres shortcut. Fails closed (throws) when residency cannot be
   // confirmed. Callers place this AFTER their no-op early exits so a no-op does no durable read.
-  async #effectiveRoute(
+  public async effectiveRoute(
     runId: string,
     organizationId: string,
     route: SnapshotRouteWire | undefined
@@ -802,8 +802,8 @@ export class RunAttemptSystem {
           span.setAttribute("completionStatus", completion.ok);
           span.setAttribute("runId", runId);
 
-          // Resolve the route the terminal snapshot honors (carried, else durable). See #effectiveRoute.
-          const effectiveRoute = await this.#effectiveRoute(
+          // Resolve the route the terminal snapshot honors (carried, else durable). See effectiveRoute.
+          const effectiveRoute = await this.effectiveRoute(
             runId,
             latestSnapshot.organizationId,
             snapshotRoute
@@ -1013,8 +1013,8 @@ export class RunAttemptSystem {
           span.setAttribute("completionStatus", completion.ok);
 
           // The route every transition this failure path writes (retry, requeue, fail, cancel) honors.
-          // Carried, else resolved durably; see #effectiveRoute. Resolved after the no-op exit above.
-          const effectiveRoute = await this.#effectiveRoute(
+          // Carried, else resolved durably; see effectiveRoute. Resolved after the no-op exit above.
+          const effectiveRoute = await this.effectiveRoute(
             runId,
             latestSnapshot.organizationId,
             snapshotRoute
@@ -1533,7 +1533,7 @@ export class RunAttemptSystem {
 
       switch (outcome) {
         case "requeue": {
-          const effectiveRoute = await this.#effectiveRoute(
+          const effectiveRoute = await this.effectiveRoute(
             runId,
             latestSnapshot.organizationId,
             snapshotRoute
@@ -1688,7 +1688,7 @@ export class RunAttemptSystem {
         // store instead of the never-enrolled Postgres shortcut. Placed AFTER the no-transition early
         // exits (already FINISHED, PENDING_CANCEL without finalize) so a no-op cancel does no durable
         // read; fails closed (throws) when durable residency cannot be confirmed.
-        const effectiveRoute = await this.#effectiveRoute(
+        const effectiveRoute = await this.effectiveRoute(
           runId,
           latestSnapshot.organizationId,
           snapshotRoute
```

**File**: `internal-packages/run-engine/src/engine/tests/stalledPendingExecutingRoute.test.ts` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+// A stalled PENDING_EXECUTING snapshot must be requeued into a redis-primary run's durable residency. The
+// heartbeat payload carries no route, so on an undefined-dial engine the requeue's QUEUED snapshot would
+// otherwise take the Postgres shortcut and leave the MemoryDB head at PENDING_EXECUTING. Real infra.
+import { assertNonNullable, containerTest } from "@internal/testcontainers";
+import {
+  PostgresRunStore,
+  RedisSnapshotStore,
+  SnapshotResidencyResolver,
+  TaskRunExecutionSnapshotStore,
+  type SnapshotStoreDial,
+} from "@internal/run-store";
+import { trace } from "@internal/tracing";
+import { setTimeout } from "node:timers/promises";
+import { expect } from "vitest";
+import { RunEngine } from "../index.js";
+import { createCompletedWaitpointResolver } from "../systems/completedWaitpointResolver.js";
+import { setupAuthenticatedEnvironment, setupBackgroundWorker } from "./setup.js";
+
+vi.setConfig({ testTimeout: 90_000 });
+
+const ROUTE = "logical:1";
+const PENDING_EXECUTING_TIMEOUT_MS = 500;
+const machines = {
+  defaultMachine: "small-1x",
+  machines: {
+    "small-1x": { name: "small-1x" as const, cpu: 0.5, memory: 0.5, centsPerMs: 0.0001 },
+  },
+  baseCostInCents: 0.0001,
+};
+
+function makeEngine(
+  prisma: any,
+  redisOptions: any,
+  snapshotStore: RedisSnapshotStore,
+  dial: () => SnapshotStoreDial | undefined,
+  workerEnabled: boolean
+) {
+  const delegate = new PostgresRunStore({ prisma, readOnlyPrisma: prisma });
+  const store = new TaskRunExecutionSnapshotStore(delegate, {
+    store: snapshotStore,
+    mode: "redis-only",
+    resolveDial: dial,
+    residencyResolver: new SnapshotResidencyResolver({
+      store: snapshotStore,
+      taskRunExists: async (id: string) => (await prisma.taskRun.count({ where: { id } })) > 0,
+    }),
+    resolveCompletedWaitpoints: createCompletedWaitpointResolver(delegate),
+    logicalRunStoreRoute: ROUTE,
+  });
+  return new RunEngine({
+    prisma,
+    store,
+    worker: workerEnabled
+      ? { redis: redisOptions, workers: 1, tasksPerWorker: 10, pollIntervalMs: 100 }
+      : { redis: redisOptions, disabled: true },
+    queue: {
+      redis: redisOptions,
+      retryOptions: { maxTimeoutInMs: 50 },
+      masterQueueConsumersDisabled: true,
+      processWorkerQueueDebounceMs: 50,
+    },
+    runLock: { redis: redisOptions },
+    machines,
+    heartbeatTimeoutsMs: { PENDING_EXECUTING: PENDING_EXECUTING_TIMEOUT_MS },
+    tracer: trace.getTracer("test", "0.0.0"),
+  });
+}
+
+describe("handleStalledSnapshot honors durable residency for a stalled PENDING_EXECUTING run", () => {
+  containerTest(
+    "a dial=undefined engine requeues a redis-primary run into its MemoryDB head",
+    async ({ prisma, redisOptions }) => {
+      const env = await setupAuthenticatedEnvironment(prisma, "PRODUCTION");
+      const snapshotStore = new RedisSnapshotStore({ redisOptions, completedTtlMs: 60_000 });
+      const producer = makeEngine(prisma, redisOptions, snapshotStore, () => "redis-only", false);
+      const consumer = makeEngine(prisma, redisOptions, snapshotStore, () => undefined, true);
+
+      try {
+        await setupBackgroundWorker(producer, env, "test-task");
+
+        async function dequeueOnConsumer() {
+          for (let i = 0; i < 25; i++) {
+            await producer.runQueue.processMasterQueueForEnvironment(env.id, 5);
+            const dequeued = await consumer.dequeueFromWorkerQueue({
+              consumerId: "stall_consumer",
+              workerQueue: "main",
+            });
+            if (dequeued.length > 0) return dequeued[0];
+            await setTimeout(300);
+          }
+          throw new Error("run never reached the worker queue");
+        }
+
+        const run = await producer.trigger(
+          {
+            number: 1,
+            friendlyId: "run_stallroute",
+            environment: env,
+            taskIdentifier: "test-task",
+            payload: "{}",
+            payloadType: "application/json",
+            context: {},
+            traceContext: {},
+            traceId: "t-stall",
+            spanId: "s-stall",
+            workerQueue: "main",
+            queue: "task/test-task",
+            isTest: false,
+            tags: [],
+            delayUntil: new Date(Date.now() + 60_000),
+          },
+          prisma
+        );
+        const runId = run.id;
+
+        await prisma.taskRun.update({
+          where: { id: runId },
+          data: { delayUntil: null, queueTimestamp: new Date() },
+        });
+        const runRow = await prisma.taskRun.findFirstOrThrow({ where: { id: runId } });
+        await producer.enqueueSystem.enqueueRun({ run: runRow, env, enableFastPath: true });
+
+        const first = await dequeueOnConsumer();
+        assertNonNullable(first);
+        expect(first.snapshotRoute?.residency).toBe("redis-primary");
+        expect(first.snapshot.executionStatus).toBe("PENDING_EXECUTING");
+
+        let late
```

---

### Incident Patch 6: `64c3ba13` (2026-10-05)
**Commit Message**: fix(sdk): stop a chat.agent turn without an error chunk

Stopping a `chat.agent` turn whose `run()` returns a `streamText` result no longer sends an `error` chunk saying "An unexpected error occurred". This was a regression in 4.7.x. The turn ends quietly again and the run stays alive for the next message.

Mono-RevId: 63cdf4e7ac05e7f2019b878c9bfeaf5e992f09cb

**File**: `.changeset/chat-agent-stop-no-error.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@trigger.dev/sdk": patch
+---
+
+Stopping a `chat.agent` turn whose `run()` returns a `streamText` result no longer sends an `error` chunk with "An unexpected error occurred". The turn ends quietly again and the run stays alive for the next message.
```

**File**: `packages/trigger-sdk/src/v3/ai.ts` (modified, +7/-2)
```diff
@@ -9308,8 +9308,13 @@ function chatAgent<
                       );
                     }
                   } catch (error) {
-                    // Handle AbortError from streamText gracefully
-                    if (error instanceof Error && error.name === "AbortError") {
+                    // A stop aborts with a string reason, which the managed pipe
+                    // rethrows as-is. Match the reason itself so a real failure
+                    // after a stop is still reported.
+                    if (
+                      (error instanceof Error && error.name === "AbortError") ||
+                      (combinedSignal.aborted && error === combinedSignal.reason)
+                    ) {
                       if (runSignal.aborted) {
                         return "exit"; // Full run cancellation — exit
                       }
```

**File**: `packages/trigger-sdk/test/chat-agent-stop.test.ts` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+// Import the test harness FIRST — this installs the resource catalog so
+// `chat.agent()` calls below register their task functions correctly.
+import { mockChatAgent } from "../src/v3/test/index.js";
+
+import { describe, expect, it } from "vitest";
+import type { UIMessage } from "ai";
+import { simulateReadableStream, streamText } from "ai";
+import { MockLanguageModelV3 } from "ai/test";
+import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
+import { chat } from "../src/v3/ai.js";
+
+function userMessage(text: string, id: string): UIMessage {
+  return { id, role: "user", parts: [{ type: "text", text }] };
+}
+
+function slowModel() {
+  const chunks: LanguageModelV3StreamPart[] = [
+    { type: "text-start", id: "t1" },
+    ...["one", " two", " three", " four"].map((delta) => ({
+      type: "text-delta" as const,
+      id: "t1",
+      delta,
+    })),
+    { type: "text-end", id: "t1" },
+    {
+      type: "finish",
+      finishReason: { unified: "stop", raw: "stop" },
+      usage: {
+        inputTokens: { total: 5, noCache: 5, cacheRead: undefined, cacheWrite: undefined },
+        outputTokens: { total: 5, text: 5, reasoning: undefined },
+      },
+    },
+  ];
+  return new MockLanguageModelV3({
+    doStream: async () => ({
+      stream: simulateReadableStream({ chunks, initialDelayInMs: 0, chunkDelayInMs: 200 }),
+    }),
+  });
+}
+
+async function waitFor(check: () => boolean, timeoutMs = 5_000) {
+  const deadline = Date.now() + timeoutMs;
+  while (!check()) {
+    if (Date.now() > deadline) throw new Error("waitFor timed out");
+    await new Promise((resolve) => setTimeout(resolve, 10));
+  }
+}
+
+describe("chat.agent stop", () => {
+  it("ends a returned streamText turn without an error chunk and keeps the run alive", async () => {
+    const agent = chat.agent({
+      id: "stop.returned-stream-text",
+      run: async ({ messages, signal }) =>
+        streamText({
+          ...chat.toStreamTextOptions(),
+          model: slowModel(),
+          messages,
+          abortSignal: signal,
+        }),
+    });
+
+    const harness = mockChatAgent(agent, { chatId: "stop-returned" });
+    try {
+      const stopped = harness.sendMessage(userMessage("hi", "u-1"));
+      await waitFor(() => harness.allChunks.some((c) => c.type === "text-delta"));
+      await harness.sendStop();
+      const { chunks } = await stopped;
+
+      expect(chunks.filter((c) => c.type === "error")).toEqual([]);
+
+      const next = await harness.sendMessage(userMessage("again", "u-2"));
+      expect(next.chunks.filter((c) => c.type === "error")).toEqual([]);
+      expect(next.chunks.some((c) => c.type === "finish")).toBe(true);
+    } finally {
+      await harness.close();
+    }
+  });
+
+  it("still reports a real error that run() throws after a stop", async () => {
+    let runStarted = false;
+    const agent = chat.agent({
+      id: "stop.error-after-stop",
+      run: async ({ signal }) => {
+        runStarted = true;
+        if (!signal.aborted) {
+          await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
+        }
+        throw new Error("db write failed");
+      },
+    });
+
+    const harness = mockChatAgent(agent, { chatId: "stop-error-after" });
+    try {
+      const turn = harness.sendMessage(userMessage("hi", "u-1"));
+      await waitFor(() => runStarted);
+      await harness.sendStop();
+      const { chunks } = await turn;
+
+      expect(chunks.filter((c) => c.type === "error")).toEqual([
+        { type: "error", errorText: "db write failed" },
+      ]);
+    } finally {
+      await harness.close();
+    }
+  });
+});
```

---

### Incident Patch 7: `35f380fe` (2026-10-05)
**Commit Message**: fix(webapp): require session-write and task-trigger access

Session creation requires both session-write and task-trigger
permissions. Cached sessions are checked against their stored task
before refreshing their configuration or starting a run. The API key
scope preview now displays session and tagged-run access.

Mono-RevId: a138ef996f92a325c335c061f1b46e7f67bbca4a

**File**: `.server-changes/session-create-permissions.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+area: webapp
+type: breaking
+---
+
+Creating or resuming a session with `POST /api/v1/sessions` now requires both session-write and task-trigger permissions. Scoped keys and public tokens must grant `write:sessions` (or access to the target session) and permission to trigger its task.
```

**File**: `apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.apikeys/route.tsx` (modified, +15/-1)
```diff
@@ -889,7 +889,16 @@ const API_KEY_EXPIRATIONS = [
   { value: "never", label: "Never" },
 ];
 
-type CapId = "tasks" | "runs" | "batches" | "queues" | "deployments" | "branches" | "envvars";
+type CapId =
+  | "tasks"
+  | "runs"
+  | "batches"
+  | "queues"
+  | "sessions"
+  | "tags"
+  | "deployments"
+  | "branches"
+  | "envvars";
 
 // Capability rows shown in the scope pane, in a fixed order so two presets read
 // as a diff of the same list rather than a reshuffled one.
@@ -898,6 +907,8 @@ const SCOPE_CAPABILITIES: [CapId, string][] = [
   ["runs", "Runs"],
   ["batches", "Batches"],
   ["queues", "Queues"],
+  ["sessions", "Sessions (all tasks)"],
+  ["tags", "Tagged runs"],
   ["deployments", "Deployments"],
   ["branches", "Preview branches"],
   ["envvars", "Environment variables"],
@@ -934,6 +945,9 @@ const SCOPE_CAPABILITY_BY_SCOPE: Record<string, [CapId, number]> = {
   "write:batch": ["batches", 2],
   "read:queues": ["queues", 1],
   "write:queues": ["queues", 2],
+  "read:sessions": ["sessions", 1],
+  "write:sessions": ["sessions", 2],
+  "read:tags": ["tags", 1],
   "read:deployments": ["deployments", 1],
   "write:deployments": ["deployments", 2],
   "write:branches": ["branches", 3],
```

**File**: `apps/webapp/app/routes/api.v1.sessions.ts` (modified, +52/-22)
```diff
@@ -7,7 +7,7 @@ import {
   type SessionItem,
   type SessionStatus,
 } from "@trigger.dev/core/v3";
-import type { Session } from "@trigger.dev/database";
+import type { Prisma, Session } from "@trigger.dev/database";
 import { $replica, prisma, type PrismaClient } from "~/db.server";
 import { clickhouseFactory } from "~/services/clickhouse/clickhouseFactoryInstance.server";
 import { logger } from "~/services/logger.server";
@@ -32,7 +32,10 @@ import {
   createLoaderApiRoute,
   everyResource,
 } from "~/services/routeBuilders/apiBuilder.server";
-import { recordSessionCreateAuthorization } from "~/services/sessionAuthorizationTelemetry.server";
+import {
+  recordSessionCreateAuthorization,
+  sessionCreateAuthorizationOutcome,
+} from "~/services/sessionAuthorizationTelemetry.server";
 import { ServiceValidationError } from "~/v3/services/common.server";
 import { runStore } from "~/v3/runStore.server";
 
@@ -148,26 +151,15 @@ const { action } = createActionApiRoute(
     // browser uses thereafter against `.in/append`, `.out` SSE,
     // `end-and-continue`, etc.
     //
-    // JWT is allowed when the caller holds an explicit `write:sessions` /
-    // `admin` super-scope plus a `tasks:<taskIdentifier>` scope — gates
-    // server-side surfaces like the cli-v3 MCP from creating sessions on
-    // behalf of the developer without weakening the browser model.
+    // Creating a session requires session-write AND task-trigger permissions.
     allowJWT: true,
     authorization: {
-      // Per-task scoping via `body.taskIdentifier` (action-route resource
-      // callbacks receive the parsed body as the 4th arg — see
-      // `apiBuilder.server.ts:710`). A JWT scoped only to `write:tasks:foo`
-      // can only create sessions whose `taskIdentifier` is `"foo"`.
-      //
-      // Multi-key resource: pre-RBAC this route had a `superScopes:
-      // ["write:sessions", "admin"]` whitelist; post-RBAC the equivalent
-      // is the `{ type: "sessions" }` element below — a `write:sessions`
-      // JWT (no id) matches it directly, deliberately bypassing the
-      // per-task check exactly as before. `admin` / `write:all` bypass
-      // via the JWT ability's wildcard branches.
-      action: "write",
-      resource: (_params, _searchParams, _headers, body) =>
-        anyResource([{ type: "tasks", id: body.taskIdentifier }, { type: "sessions" }]),
+      // Session-write is checked below after resolving alternate session IDs.
+      action: "trigger",
+      resource: (_params, _searchParams, _headers, body) => ({
+        type: "tasks",
+        id: body.taskIdentifier,
+      }),
     },
     corsStrategy: "all",
   },
@@ -182,8 +174,25 @@ const { action } = createActionApiRoute(
         );
       }
 
-      // Idempotent on (env, externalId): two concurrent POSTs converge to the same row, and
-      // `triggerConfig` is refreshed on the cached path so a redeployed config reaches the next run.
+      const sessionIds = body.externalId ? [body.externalId] : [];
+      if (body.externalId && !ability.can("write", { type: "sessions", id: body.externalId })) {
+        const existing = await prisma.session.findFirst({
+          where: {
+            runtimeEnvironmentId: authentication.environment.id,
+            externalId: body.externalId,
+          },
+          select: { friendlyId: true },
+        });
+        if (existing) sessionIds.push(existing.friendlyId);
+      }
+      if (
+        sessionCreateAuthorizationOutcome(ability, body.taskIdentifier, sessionIds) !==
+        "both_allowed"
+      ) {
+        return json({ error: "Unauthorized" }, { status: 403 });
+      }
+
+      // Defer cached config changes until the stored task has been authorized.
       const { session, isCached } = await findOrCreateSession({
         environment: authentication.environment,
         externalId: body.externalId,
@@ -193,6 +202,7 @@ const { action } = createActionApiRoute(
         tags: body.tags,
         metadata: body.metadata as Record<string, unknown> | undefined,
         expiresAt: body.expiresAt,
+        refreshTriggerConfig: false,
       });
 
       // Reject create on a closed session. The upsert path will return
@@ -220,6 +230,26 @@ const { action } = createActionApiRoute(
       }
 
       recordSessionCreateAuthorization(ability, session, request, authentication.environment);
+      if (
+        sessionCreateAuthorizationOutcome(
+          ability,
+          session.taskIdentifier,
+          [session.friendlyId, session.externalId].filter((id): id is string => !!id)
+        ) !== "both_allowed"
+      ) {
+        return json({ error: "Unauthorized" }, { status: 403 });
+      }
+
+      if (isCached) {
+        Object.assign(
+          session,
+          await prisma.session.update({
+            where: { id: session.id },
+            data: { triggerConfig: body.triggerConfig as unknown as Prisma.InputJsonValue },
+            select: { triggerConfig: true, updatedAt:
```

**File**: `apps/webapp/app/services/sessionAuthorizationTelemetry.server.test.ts` (modified, +16/-0)
```diff
@@ -29,6 +29,22 @@ describe("session creation authorization observation", () => {
     ).toBe(expected);
   });
 
+  it.each(["chat-1", "session_123"])(
+    "requires a matching task even with write access to session %s",
+    (sessionId) => {
+      const ability = withActionAliases(
+        buildJwtAbility([`write:sessions:${sessionId}`, "trigger:tasks:chat"])
+      );
+      expect(sessionCreateAuthorizationOutcome(ability, "chat", [sessionId])).toBe("both_allowed");
+      expect(sessionCreateAuthorizationOutcome(ability, "other", [sessionId])).toBe(
+        "missing_task_trigger"
+      );
+      expect(sessionCreateAuthorizationOutcome(ability, "chat", ["other-session"])).toBe(
+        "missing_session_write"
+      );
+    }
+  );
+
   it("attributes only would-deny events without exporting the credential or task", async () => {
     const exporter = new InMemorySpanExporter();
     const provider = new BasicTracerProvider({
```

**File**: `apps/webapp/app/services/sessionAuthorizationTelemetry.server.ts` (modified, +14/-4)
```diff
@@ -13,8 +13,14 @@ const checks = singleton("sessionCreateAuthorizationChecks", () =>
   })
 );
 
-export function sessionCreateAuthorizationOutcome(ability: RbacAbility, taskIdentifier: string) {
-  const sessionWrite = ability.can("write", { type: "sessions" });
+export function sessionCreateAuthorizationOutcome(
+  ability: RbacAbility,
+  taskIdentifier: string,
+  sessionIds: string[] = []
+) {
+  const sessionWrite =
+    ability.can("write", { type: "sessions" }) ||
+    sessionIds.some((id) => ability.can("write", { type: "sessions", id }));
   const taskTrigger = ability.can("trigger", { type: "tasks", id: taskIdentifier });
 
   if (sessionWrite && taskTrigger) return "both_allowed";
@@ -24,7 +30,7 @@ export function sessionCreateAuthorizationOutcome(ability: RbacAbility, taskIden
 
 export function recordSessionCreateAuthorization(
   ability: RbacAbility,
-  session: { taskIdentifier: string },
+  session: { taskIdentifier: string; friendlyId?: string; externalId?: string | null },
   request: Request,
   environment: Pick<AuthenticatedEnvironment, "id" | "organizationId" | "projectId" | "type">
 ) {
@@ -42,7 +48,11 @@ export function recordSessionCreateAuthorization(
         : "unknown";
 
   try {
-    const outcome = sessionCreateAuthorizationOutcome(ability, session.taskIdentifier);
+    const outcome = sessionCreateAuthorizationOutcome(
+      ability,
+      session.taskIdentifier,
+      [session.friendlyId, session.externalId].filter((id): id is string => !!id)
+    );
     checks.add(1, { credential_kind: credentialKind, outcome });
     if (outcome === "both_allowed") return;
 
```

**File**: `apps/webapp/test/auth-api.e2e.full.test.ts` (modified, +57/-10)
```diff
@@ -2555,12 +2555,11 @@ describe("API", () => {
 
     // ---- Create session: POST /api/v1/sessions
     //
-    // Resource: [{ type: "tasks", id: body.taskIdentifier }, { type: "sessions" }]
-    // Old superScopes: ["write:sessions", "admin"]
+    // Session-write AND permission to trigger the requested and resolved tasks.
     describe("Create session — POST /api/v1/sessions", () => {
       const path = "/api/v1/sessions";
 
-      const post = async (jwt: string, taskIdentifier: string) =>
+      const post = async (jwt: string, taskIdentifier: string, externalId?: string) =>
         getTestServer().webapp.fetch(path, {
           method: "POST",
           headers: {
@@ -2570,6 +2569,7 @@ describe("API", () => {
           body: JSON.stringify({
             type: "chat.agent",
             taskIdentifier,
+            externalId,
             triggerConfig: { basePayload: {} },
           }),
         });
@@ -2581,15 +2581,11 @@ describe("API", () => {
           expirationTime: "15m",
         });
 
-      it("write:tasks:foo matching body: auth passes", async () => {
+      it("write:tasks:foo without session-write: 403", async () => {
         const seed = await seedTestEnvironment(getTestServer().prisma);
         const jwt = await mintJwt(seed.apiKey, seed.environment.id, ["write:tasks:foo"]);
         const res = await post(jwt, "foo");
-        // Body validation / handler can fail later (404 if task is
-        // missing, 400 for invalid body) — we only care that auth
-        // didn't reject.
-        expect(res.status).not.toBe(401);
-        expect(res.status).not.toBe(403);
+        expect(res.status).toBe(403);
       });
 
       it("write:tasks:bar mismatching body: 403", async () => {
@@ -2599,14 +2595,65 @@ describe("API", () => {
         expect(res.status).toBe(403);
       });
 
-      it("write:sessions: auth passes (was a superScope)", async () => {
+      it("write:sessions without task-trigger: 403", async () => {
         const seed = await seedTestEnvironment(getTestServer().prisma);
         const jwt = await mintJwt(seed.apiKey, seed.environment.id, ["write:sessions"]);
         const res = await post(jwt, "foo");
+        expect(res.status).toBe(403);
+      });
+
+      it("session-write and matching task-trigger: auth passes", async () => {
+        const seed = await seedTestEnvironment(getTestServer().prisma);
+        const jwt = await mintJwt(seed.apiKey, seed.environment.id, [
+          "write:sessions",
+          "trigger:tasks:foo",
+        ]);
+        const res = await post(jwt, "foo");
         expect(res.status).not.toBe(401);
         expect(res.status).not.toBe(403);
       });
 
+      it.each(["foo", "other-task"])(
+        "accepts a cached session's friendly-ID grant only with access to its task %s",
+        async (taskIdentifier) => {
+          const server = getTestServer();
+          const seed = await seedTestEnvironment(server.prisma);
+          const session = await seedTestApiSession(server.prisma, seed.environment, {
+            taskIdentifier,
+          });
+          const jwt = await mintJwt(seed.apiKey, seed.environment.id, [
+            `write:sessions:${session.friendlyId}`,
+            "trigger:tasks:foo",
+          ]);
+          const res = await post(jwt, "foo", session.externalId!);
+          if (taskIdentifier === "foo") {
+            expect(res.status).not.toBe(401);
+            expect(res.status).not.toBe(403);
+          } else {
+            expect(res.status).toBe(403);
+            const unchanged = await server.prisma.session.findFirst({ where: { id: session.id } });
+            expect(unchanged?.triggerConfig).toEqual(session.triggerConfig);
+          }
+        }
+      );
+
+      it("checks the cached task before changing its config or triggering it", async () => {
+        const server = getTestServer();
+        const seed = await seedTestEnvironment(server.prisma);
+        const session = await seedTestApiSession(server.prisma, seed.environment, {
+          taskIdentifier: "other-task",
+        });
+        const jwt = await mintJwt(seed.apiKey, seed.environment.id, [
+          "write:sessions",
+          "trigger:tasks:foo",
+        ]);
+        const res = await post(jwt, "foo", session.externalId!);
+        expect(res.status).toBe(403);
+        const unchanged = await server.prisma.session.findFirst({ where: { id: session.id } });
+        expect(unchanged?.triggerConfig).toEqual(session.triggerConfig);
+        expect(unchanged?.currentRunId).toBe(session.currentRunId);
+      });
+
       it("write:all: auth passes", async () => {
         const seed = await seedTestEnvironment(getTestServer().prisma);
         const jwt = await mintJwt(seed.apiKey, seed.environment.id, ["write:all"]);
```

---

### Incident Patch 8: `cd518683` (2026-10-05)
**Commit Message**: test(dashboard-agent): fix flaky phase duration comparison

## Summary

Stop the duration-format equivalence test from comparing independently
generated observation timestamps. All other timeline fields remain
covered by the equality assertion.

Verified: all 49 tests in tool-curation.test.ts pass.
Mono-RevId: c679c63a9555eaf894d86aa6522026ec3584f3a9

**File**: `internal-packages/dashboard-agent/src/tool-curation.test.ts` (modified, +5/-1)
```diff
@@ -823,7 +823,11 @@ describe("derivePhases", () => {
       },
     };
 
-    expect(derivePhases(agentTrace, run, "agent")).toEqual(derivePhases(trace, run, "legacy"));
+    const agentTimeline = derivePhases(agentTrace, run, "agent")!;
+    const legacyTimeline = derivePhases(trace, run, "legacy")!;
+
+    // Each call stamps its own observation time, independent of the duration format.
+    expect(agentTimeline).toEqual({ ...legacyTimeline, asOf: agentTimeline.asOf });
   });
 
   it("flags truncation when the phase cap itself dropped spans", () => {
```

---

### Incident Patch 9: `25317cfa` (2026-10-05)
**Commit Message**: fix(webapp): reject unsupported deployment runtimes with a 400

Deployments with an unsupported `runtime` now fail with a 400 that names
the supported runtimes, instead of a generic 500.

Mono-RevId: 82fda1dd3e8d4d224323d828c99f06470e469cac

**File**: `.server-changes/invalid-runtime-400.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+area: webapp
+type: fix
+---
+
+Deployments with an unsupported `runtime` now fail with a 400 that names the supported runtimes, instead of a generic 500
```

**File**: `apps/webapp/app/v3/services/initializeDeployment.server.ts` (modified, +12/-1)
```diff
@@ -1,4 +1,5 @@
 import {
+  type BuildRuntime,
   type BuildServerMetadata,
   type InitializeDeploymentRequestBody,
   type ExternalBuildData,
@@ -62,6 +63,16 @@ export class InitializeDeploymentService extends BaseService {
     options?: { cliVersion?: string }
   ): Promise<InitializeDeploymentResult> {
     return this.traceWithEnv("call", environment, async (span) => {
+      let runtime: BuildRuntime;
+      try {
+        runtime = resolveBuildRuntime(payload.runtime);
+      } catch (error) {
+        throw new ServiceValidationError(
+          error instanceof Error ? error.message : String(error),
+          400
+        );
+      }
+
       if (payload.externalId) {
         span.setAttribute("externalId", payload.externalId);
       }
@@ -388,7 +399,7 @@ export class InitializeDeploymentService extends BaseService {
             git: payload.gitMeta ?? undefined,
             commitSHA: payload.gitMeta?.commitSha ?? undefined,
             externalId: payload.externalId,
-            runtime: resolveBuildRuntime(payload.runtime),
+            runtime,
             cliVersion: options?.cliVersion,
             triggeredVia: payload.triggeredVia ?? undefined,
             startedAt: initialStatus === "BUILDING" ? new Date() : undefined,
```

---

### Incident Patch 10: `f8669e78` (2026-10-04)
**Commit Message**: fix(run-engine): keep the cancel reason when finalizing an executing run

Mono-RevId: 7d7a39b64f16278f6014f95e6c1d1596125898bf

**File**: `.server-changes/preserve-cancel-reason-on-finalize.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+area: webapp
+type: fix
+---
+
+Preserve the cancellation reason when a run that was executing is finalized, instead of replacing it with the default text.
```

**File**: `internal-packages/run-engine/src/engine/systems/runAttemptSystem.ts` (modified, +26/-17)
```diff
@@ -11,13 +11,13 @@ import {
 import type { RedisOptions } from "@internal/redis";
 import { startSpan, type Counter } from "@internal/tracing";
 import { tryCatch } from "@trigger.dev/core/utils";
+import { sanitizeError } from "@trigger.dev/core/v3";
 import type {
   CompleteRunAttemptResult,
   ExecutionResult,
   MachinePreset,
   MachinePresetName,
   TaskRunContext,
-  TaskRunError,
   TaskRunExecution,
   TaskRunExecutionDeployment,
   TaskRunExecutionOrganization,
@@ -28,7 +28,7 @@ import type {
   TaskRunInternalError,
   TaskRunSuccessfulExecutionResult,
 } from "@trigger.dev/core/v3/schemas";
-import { FlushedRunMetadata, GitMeta } from "@trigger.dev/core/v3/schemas";
+import { FlushedRunMetadata, GitMeta, TaskRunError } from "@trigger.dev/core/v3/schemas";
 import {
   extractIdempotencyKeyScope,
   getUserProvidedIdempotencyKey,
@@ -1479,7 +1479,6 @@ export class RunAttemptSystem {
     tx?: PrismaClientOrTransaction;
   }): Promise<ExecutionResult & { alreadyFinished: boolean }> {
     const prisma = tx ?? this.$.prisma;
-    reason = reason ?? "Canceled by user";
 
     return startSpan(this.$.tracer, "cancelRun", async (span) => {
       return this.$.runLock.lock("cancelRun", [runId], async () => {
@@ -1523,22 +1522,20 @@ export class RunAttemptSystem {
           snapshotRoute
         );
 
-        //set the run to cancelled immediately
-        const error: TaskRunError = {
-          type: "STRING_ERROR",
-          raw: reason,
-        };
+        const reuseStoredReason =
+          reason === undefined && latestSnapshot.executionStatus === "PENDING_CANCEL";
 
         // Calculate updated usage if we have attempt duration data
         let usageUpdate: { usageDurationMs: number; costInCents: number } | undefined;
-        if (attemptDurationMs !== undefined) {
+        if (attemptDurationMs !== undefined || reuseStoredReason) {
           const currentRun = await this.$.runStore.findRunOnPrimary(
             { id: runId },
             {
               select: {
                 usageDurationMs: true,
                 costInCents: true,
                 machinePreset: true,
+                error: true,
               },
             }
           );
@@ -1547,16 +1544,28 @@ export class RunAttemptSystem {
             throw new ServiceValidationError("Run not found", 404);
           }
 
-          usageUpdate = this.#calculateUpdatedUsage({
-            runId,
-            currentUsageDurationMs: currentRun.usageDurationMs,
-            currentCostInCents: currentRun.costInCents,
-            attemptDurationMs,
-            machinePresetName: currentRun.machinePreset,
-            environmentType: latestSnapshot.environmentType,
-          });
+          if (reuseStoredReason) {
+            const storedError = TaskRunError.safeParse(currentRun.error);
+            if (storedError.success && storedError.data.type === "STRING_ERROR") {
+              reason = storedError.data.raw;
+            }
+          }
+
+          if (attemptDurationMs !== undefined) {
+            usageUpdate = this.#calculateUpdatedUsage({
+              runId,
+              currentUsageDurationMs: currentRun.usageDurationMs,
+              currentCostInCents: currentRun.costInCents,
+              attemptDurationMs,
+              machinePresetName: currentRun.machinePreset,
+              environmentType: latestSnapshot.environmentType,
+            });
+          }
         }
 
+        reason ??= "Canceled by user";
+        const error = sanitizeError({ type: "STRING_ERROR", raw: reason });
+
         await this.#scheduleFinalizationGuard(runId);
 
         const run = await this.$.runStore.cancelRun(
```

**File**: `internal-packages/run-engine/src/engine/tests/cancelling.test.ts` (modified, +156/-0)
```diff
@@ -446,5 +446,161 @@ describe("RunEngine cancelling", () => {
     }
   });
 
+  containerTest(
+    "Finalizing a cancelled executing run keeps the cancel reason",
+    async ({ prisma, redisOptions }) => {
+      const authenticatedEnvironment = await setupAuthenticatedEnvironment(prisma, "PRODUCTION");
+      const engine = createCancellingTestEngine(prisma, redisOptions);
+
+      try {
+        const parentTask = "parent-task";
+        const childTask = "child-task";
+        await setupBackgroundWorker(engine, authenticatedEnvironment, [parentTask, childTask]);
+
+        const parentRun = await triggerAndStart(engine, authenticatedEnvironment, {
+          friendlyId: "run_p1234",
+          taskIdentifier: parentTask,
+        });
+        const childRun = await triggerAndStart(engine, authenticatedEnvironment, {
+          friendlyId: "run_c1234",
+          taskIdentifier: childTask,
+          resumeParentOnCompletion: true,
+          parentTaskRunId: parentRun.id,
+        });
+
+        const cancelledEvents: EventBusEventArgs<"runCancelled">[0][] = [];
+        engine.eventBus.on("runCancelled", (event) => {
+          cancelledEvents.push(event);
+        });
+
+        const reason = "support: test reason";
+        const pending = await engine.cancelRun({ runId: childRun.id, reason });
+        expect(pending.snapshot.executionStatus).toBe("PENDING_CANCEL");
+
+        const pendingRun = await prisma.taskRun.findUniqueOrThrow({ where: { id: childRun.id } });
+        expect(pendingRun.error).toEqual({ type: "STRING_ERROR", raw: reason });
+
+        const finalized = await engine.cancelRun({ runId: childRun.id, finalizeRun: true });
+        expect(finalized.snapshot.executionStatus).toBe("FINISHED");
+
+        const finalRun = await prisma.taskRun.findUniqueOrThrow({ where: { id: childRun.id } });
+        expect(finalRun.status).toBe("CANCELED");
+        expect(finalRun.error).toEqual({ type: "STRING_ERROR", raw: reason });
+
+        expect(cancelledEvents).toHaveLength(1);
+        expect(cancelledEvents[0].run.error).toEqual({ type: "STRING_ERROR", raw: reason });
+
+        const parentWaitpoint = await prisma.waitpoint.findFirstOrThrow({
+          where: { completedByTaskRunId: childRun.id },
+        });
+        expect(parentWaitpoint.outputIsError).toBe(true);
+        expect(JSON.parse(parentWaitpoint.output!)).toEqual({ type: "STRING_ERROR", raw: reason });
+      } finally {
+        await engine.quit();
+      }
+    }
+  );
+
+  containerTest(
+    "Cancelling an executing run without a reason uses the default text",
+    async ({ prisma, redisOptions }) => {
+      const authenticatedEnvironment = await setupAuthenticatedEnvironment(prisma, "PRODUCTION");
+      const engine = createCancellingTestEngine(prisma, redisOptions);
+
+      try {
+        const taskIdentifier = "test-task";
+        await setupBackgroundWorker(engine, authenticatedEnvironment, taskIdentifier);
+
+        const run = await triggerAndStart(engine, authenticatedEnvironment, {
+          friendlyId: "run_1234",
+          taskIdentifier,
+        });
+
+        const pending = await engine.cancelRun({ runId: run.id });
+        expect(pending.snapshot.executionStatus).toBe("PENDING_CANCEL");
+
+        const finalized = await engine.cancelRun({ runId: run.id, finalizeRun: true });
+        expect(finalized.snapshot.executionStatus).toBe("FINISHED");
+
+        const finalRun = await prisma.taskRun.findUniqueOrThrow({ where: { id: run.id } });
+        expect(finalRun.status).toBe("CANCELED");
+        expect(finalRun.error).toEqual({ type: "STRING_ERROR", raw: "Canceled by user" });
+      } finally {
+        await engine.quit();
+      }
+    }
+  );
+
   //todo bulk cancelling runs
 });
+
+function createCancellingTestEngine(
+  prisma: ConstructorParameters<typeof RunEngine>[0]["prisma"],
+  redisOptions: ConstructorParameters<typeof RunEngine>[0]["runLock"]["redis"]
+) {
+  return new RunEngine({
+    prisma,
+    worker: { redis: redisOptions, workers: 1, tasksPerWorker: 10, pollIntervalMs: 100 },
+    queue: {
+      redis: redisOptions,
+      masterQueueConsumersDisabled: true,
+      processWorkerQueueDebounceMs: 50,
+    },
+    runLock: { redis: redisOptions },
+    machines: {
+      defaultMachine: "small-1x",
+      machines: {
+        "small-1x": { name: "small-1x" as const, cpu: 0.5, memory: 0.5, centsPerMs: 0.0001 },
+      },
+      baseCostInCents: 0.0001,
+    },
+    tracer: trace.getTracer("test", "0.0.0"),
+  });
+}
+
+async function triggerAndStart(
+  engine: RunEngine,
+  environment: Awaited<ReturnType<typeof setupAuthenticatedEnvironment>>,
+  options: {
+    friendlyId: string;
+    taskIdentifier: string;
+    resumeParentOnCompletion?: boolean;
+    parentTaskRunId?: string;
+  }
+) {
+  const run = await engine.trigger(
+    {
+      number: 1,
+      friendlyId: options.friendlyId,
+      environment,
+      taskIdentifier: options.taskIdentifier,
+      payloa
```

---

### Incident Patch 11: `876130e3` (2026-10-04)
**Commit Message**: fix(run-engine): repair short replica reads of completed waitpoints

Mono-RevId: 09dc0eb6741c9fc65417c0538f6b2499c5a8d286

**File**: `.server-changes/fix-stuck-run-after-wait-completes.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+area: webapp
+type: fix
+---
+
+Fix a rare case where a run could stay stuck executing after the child run or wait it was waiting on had completed.
```

**File**: `internal-packages/run-engine/src/engine/systems/executionSnapshotSystem.ts` (modified, +9/-1)
```diff
@@ -415,7 +415,15 @@ export async function getExecutionSnapshotsSince(
   }
 
   // Step 4: Fetch waitpoints in chunks to avoid NAPI string conversion limits
-  const waitpoints = await fetchWaitpointsInChunks(readClient, waitpointIds, runStore, runId);
+  let waitpoints = await fetchWaitpointsInChunks(readClient, waitpointIds, runStore, runId);
+
+  if (repairClient && readClient !== repairClient && waitpoints.length < waitpointIds.length) {
+    const fetchedIds = new Set(waitpoints.map((w) => w.id));
+    const missingIds = waitpointIds.filter((id) => !fetchedIds.has(id));
+    waitpoints = waitpoints.concat(
+      await fetchWaitpointsInChunks(repairClient, missingIds, runStore, runId)
+    );
+  }
 
   // Step 5: Build enhanced snapshots - only latest gets waitpoints, others get empty arrays
   // The runner only uses completedWaitpoints from the latest snapshot anyway
```

**File**: `internal-packages/run-engine/src/engine/tests/getSnapshotsSince.test.ts` (modified, +100/-1)
```diff
@@ -3,7 +3,7 @@ import { trace } from "@internal/tracing";
 import { generateFriendlyId } from "@trigger.dev/core/v3/isomorphic";
 import { setTimeout } from "node:timers/promises";
 import { describe, expect } from "vitest";
-import type { PrismaClient } from "@trigger.dev/database";
+import type { PrismaClient, Waitpoint } from "@trigger.dev/database";
 import { RunEngine } from "../index.js";
 import { getExecutionSnapshotsSince } from "../systems/executionSnapshotSystem.js";
 import { copySnapshotsToReplica, createTestMetricsMeter } from "./helpers/replicaTestHelpers.js";
@@ -12,6 +12,24 @@ import { setupAuthenticatedEnvironment, setupBackgroundWorker } from "./setup.js
 
 vi.setConfig({ testTimeout: 120_000 });
 
+function interceptWaitpointFindMany(
+  client: PrismaClient,
+  onFindMany: (requestedIds: string[], rows: Waitpoint[]) => Waitpoint[]
+): PrismaClient {
+  return new Proxy(client, {
+    get(target, prop) {
+      if (prop === "waitpoint") {
+        return {
+          findMany: async (args: { where: { id: { in: string[] } } }) =>
+            onFindMany(args.where.id.in, await target.waitpoint.findMany(args)),
+        };
+      }
+      const value = (target as Record<string | symbol, unknown>)[prop];
+      return typeof value === "function" ? value.bind(target) : value;
+    },
+  }) as unknown as PrismaClient;
+}
+
 describe("RunEngine getSnapshotsSince", () => {
   containerTest(
     "returns empty array when querying from latest snapshot",
@@ -1588,4 +1606,85 @@ describe("RunEngine getSnapshotsSince", () => {
       expect(latest.completedWaitpoints.map((w) => w.id)).toEqual([waitpointId]);
     }
   );
+
+  containerTest(
+    "fetches only the waitpoints missing on the replica reader from the primary",
+    async ({ prisma }) => {
+      const authenticatedEnvironment = await setupAuthenticatedEnvironment(prisma, "PRODUCTION");
+      const scenario = await setupTestScenario(prisma, authenticatedEnvironment, {
+        totalWaitpoints: 3,
+        outputSizeKB: 1,
+        snapshotConfigs: [
+          { status: "RUN_CREATED", completedWaitpointCount: 0 },
+          { status: "EXECUTING_WITH_WAITPOINTS", completedWaitpointCount: 0 },
+          { status: "EXECUTING", completedWaitpointCount: 3 },
+        ],
+      });
+      const waitpointIds = scenario.waitpoints.map((w) => w.id);
+      const latestSnapshot = scenario.snapshots[scenario.snapshots.length - 1];
+      await prisma.taskRunExecutionSnapshot.update({
+        where: { id: latestSnapshot.id },
+        data: { completedWaitpointOrder: [] },
+      });
+
+      const missingOnReplicaId = waitpointIds[0];
+      const laggingReader = interceptWaitpointFindMany(prisma, (_ids, rows) =>
+        rows.filter((w) => w.id !== missingOnReplicaId)
+      );
+      const primaryRequests: string[][] = [];
+      const primary = interceptWaitpointFindMany(prisma, (ids, rows) => {
+        primaryRequests.push([...new Set(ids)]);
+        return rows;
+      });
+
+      const result = await getExecutionSnapshotsSince(
+        laggingReader,
+        scenario.run.id,
+        scenario.snapshots[0].id,
+        undefined,
+        primary
+      );
+
+      const latest = result[result.length - 1];
+      expect(latest.completedWaitpoints.map((w) => w.id).sort()).toEqual([...waitpointIds].sort());
+      expect(primaryRequests).toEqual([[missingOnReplicaId]]);
+    }
+  );
+
+  containerTest(
+    "does not read waitpoints from the primary when the replica reader has them all",
+    async ({ prisma }) => {
+      const authenticatedEnvironment = await setupAuthenticatedEnvironment(prisma, "PRODUCTION");
+      const scenario = await setupTestScenario(prisma, authenticatedEnvironment, {
+        totalWaitpoints: 2,
+        outputSizeKB: 1,
+        snapshotConfigs: [
+          { status: "RUN_CREATED", completedWaitpointCount: 0 },
+          { status: "EXECUTING_WITH_WAITPOINTS", completedWaitpointCount: 0 },
+          { status: "EXECUTING", completedWaitpointCount: 2 },
+        ],
+      });
+      const waitpointIds = scenario.waitpoints.map((w) => w.id);
+
+      let primaryWaitpointReads = 0;
+      const primary = interceptWaitpointFindMany(prisma, (_ids, rows) => {
+        primaryWaitpointReads++;
+        return rows;
+      });
+
+      const result = await getExecutionSnapshotsSince(
+        prisma,
+        scenario.run.id,
+        scenario.snapshots[0].id,
+        undefined,
+        primary
+      );
+
+      const latest = result[result.length - 1];
+      expect([...new Set(latest.completedWaitpoints.map((w) => w.id))].sort()).toEqual(
+        [...waitpointIds].sort()
+      );
+      expect(primaryWaitpointReads).toBe(0);
+    }
+  );
 });
```

---

### Incident Patch 12: `0c45a0a4` (2026-10-04)
**Commit Message**: fix(webapp,cli): accept an endpoint's declared id on every webhook endpoint route

Every webhook endpoint route now takes either the endpoint's declared id
(the `id` given to `webhooks.endpoint.define`) or its `wh_` id. Before,
only creating a waiter accepted the declared id; getting, enabling,
disabling and setting or rotating an endpoint's secret needed the `wh_`
id.

```bash
curl -X PUT https://api.trigger.dev/api/v1/webhooks/endpoints/payments/secret \
  -H "Authorization: Bearer $TRIGGER_SECRET_KEY" \
  -d '{"secret": "whsec_..."}'
```

A declared id names the endpoint's declared instance in the environment
the key belongs to. Declared ids can no longer start with `wh_`, which
is reserved for generated ids: `trigger dev` and deploys fail with a
clear error for an endpoint declared as `wh_orders`.

Mono-RevId: a3e8dde7e794525cb86651b16d65001b75eccdbd

**File**: `apps/webapp/app/presenters/v3/ApiWebhookEndpointPresenter.server.ts` (modified, +3/-3)
```diff
@@ -1,4 +1,5 @@
 import { type WebhookEndpointDetailObject, type WebhookEndpointObject } from "@trigger.dev/core/v3";
+import { webhookEndpointLookup } from "~/v3/webhookEndpointLookup";
 import {
   type Prisma,
   type RuntimeEnvironment,
@@ -85,12 +86,11 @@ export class ApiWebhookEndpointListPresenter extends BasePresenter {
 class ApiWebhookEndpointPresenter extends BasePresenter {
   public async call(
     environment: ApiAuthenticationResultSuccess["environment"],
-    endpointFriendlyId: string
+    endpointId: string
   ): Promise<WebhookEndpointDetailObject | undefined> {
     return this.trace("call", async () => {
       const endpoint = await webhookReplica.webhookEndpoint.findFirst({
-        // friendlyId is globally unique; scope to the env so a foreign id 404s.
-        where: { friendlyId: endpointFriendlyId, runtimeEnvironmentId: environment.id },
+        where: webhookEndpointLookup(environment.id, endpointId),
         select: { ...endpointSelect, ...webhookSetupPromptSelect },
       });
       if (!endpoint) return undefined;
```

**File**: `apps/webapp/app/routes/api.v1.webhooks.endpoints.$endpointId.disable.ts` (modified, +3/-2)
```diff
@@ -2,6 +2,7 @@ import { json } from "@remix-run/server-runtime";
 import { z } from "zod";
 import { webhookPrisma } from "~/db.server";
 import { findWebhookEndpointResource } from "~/presenters/v3/ApiWebhookEndpointPresenter.server";
+import { webhookEndpointLookup } from "~/v3/webhookEndpointLookup";
 import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
 
 const ParamsSchema = z.object({ endpointId: z.string() });
@@ -18,7 +19,7 @@ const { action, loader } = createActionApiRoute(
   async ({ params, authentication }) => {
     const env = authentication.environment;
     const endpoint = await webhookPrisma.webhookEndpoint.findFirst({
-      where: { friendlyId: params.endpointId, runtimeEnvironmentId: env.id },
+      where: webhookEndpointLookup(env.id, params.endpointId),
     });
     if (!endpoint) return json({ error: "Not found" }, { status: 404 });
 
@@ -27,7 +28,7 @@ const { action, loader } = createActionApiRoute(
       data: { status: "INACTIVE", manuallyDeactivatedAt: new Date() },
     });
 
-    return json(await findWebhookEndpointResource(authentication, params.endpointId));
+    return json(await findWebhookEndpointResource(authentication, endpoint.friendlyId));
   }
 );
 
```

**File**: `apps/webapp/app/routes/api.v1.webhooks.endpoints.$endpointId.enable.ts` (modified, +3/-2)
```diff
@@ -2,6 +2,7 @@ import { json } from "@remix-run/server-runtime";
 import { z } from "zod";
 import { webhookPrisma } from "~/db.server";
 import { findWebhookEndpointResource } from "~/presenters/v3/ApiWebhookEndpointPresenter.server";
+import { webhookEndpointLookup } from "~/v3/webhookEndpointLookup";
 import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
 
 const ParamsSchema = z.object({ endpointId: z.string() });
@@ -18,7 +19,7 @@ const { action, loader } = createActionApiRoute(
   async ({ params, authentication }) => {
     const env = authentication.environment;
     const endpoint = await webhookPrisma.webhookEndpoint.findFirst({
-      where: { friendlyId: params.endpointId, runtimeEnvironmentId: env.id },
+      where: webhookEndpointLookup(env.id, params.endpointId),
     });
     if (!endpoint) return json({ error: "Not found" }, { status: 404 });
 
@@ -27,7 +28,7 @@ const { action, loader } = createActionApiRoute(
       data: { status: "ACTIVE", manuallyDeactivatedAt: null },
     });
 
-    return json(await findWebhookEndpointResource(authentication, params.endpointId));
+    return json(await findWebhookEndpointResource(authentication, endpoint.friendlyId));
   }
 );
 
```

**File**: `apps/webapp/app/routes/api.v1.webhooks.endpoints.$endpointId.rotate-secret.ts` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 import { json } from "@remix-run/server-runtime";
 import { z } from "zod";
 import { webhookPrisma } from "~/db.server";
+import { webhookEndpointLookup } from "~/v3/webhookEndpointLookup";
 import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
 import { generateWebhookSigningSecret } from "~/v3/webhookSigningSecret.server";
 
@@ -18,7 +19,7 @@ const { action, loader } = createActionApiRoute(
   },
   async ({ params, authentication }) => {
     const endpoint = await webhookPrisma.webhookEndpoint.findFirst({
-      where: { friendlyId: params.endpointId, runtimeEnvironmentId: authentication.environment.id },
+      where: webhookEndpointLookup(authentication.environment.id, params.endpointId),
       select: { id: true, friendlyId: true, verifierArtifact: true },
     });
     if (!endpoint) return json({ error: "Not found" }, { status: 404 });
```

**File**: `apps/webapp/app/routes/api.v1.webhooks.endpoints.$endpointId.secret.ts` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@ import { json } from "@remix-run/server-runtime";
 import { SetWebhookEndpointSecretRequestBody } from "@trigger.dev/core/v3";
 import { z } from "zod";
 import { webhookPrisma } from "~/db.server";
+import { webhookEndpointLookup } from "~/v3/webhookEndpointLookup";
 import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
 import { storeWebhookSigningSecret } from "~/v3/webhookSigningSecret.server";
 
@@ -18,7 +19,7 @@ const { action, loader } = createActionApiRoute(
   },
   async ({ params, body, authentication }) => {
     const endpoint = await webhookPrisma.webhookEndpoint.findFirst({
-      where: { friendlyId: params.endpointId, runtimeEnvironmentId: authentication.environment.id },
+      where: webhookEndpointLookup(authentication.environment.id, params.endpointId),
       select: { id: true, friendlyId: true, verifierArtifact: true },
     });
     if (!endpoint) return json({ error: "Not found" }, { status: 404 });
```

**File**: `apps/webapp/app/v3/services/createBackgroundWorker.server.ts` (modified, +7/-0)
```diff
@@ -16,6 +16,7 @@ import { FilterParseError, parseFilter } from "@internal/webhook-engine";
 import {
   BackgroundWorkerId,
   WebhookEndpointId,
+  isWebhookEndpointFriendlyId,
   stringifyDuration,
 } from "@trigger.dev/core/v3/isomorphic";
 import { randomBytes } from "node:crypto";
@@ -1193,6 +1194,12 @@ export async function syncDeclarativeWebhooks(
     }
     endpointIds.add(endpoint.id);
 
+    if (isWebhookEndpointFriendlyId(endpoint.id)) {
+      throw new ServiceValidationError(
+        `Webhook endpoint id "${endpoint.id}" can't start with "wh_": that prefix is reserved for the ids Trigger.dev generates`
+      );
+    }
+
     if (
       "config" in endpoint.verifierArtifact &&
       endpoint.verifierArtifact.config.scheme === "url-secret" &&
```

**File**: `apps/webapp/app/v3/webhookEndpointLookup.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { isWebhookEndpointFriendlyId } from "@trigger.dev/core/v3/isomorphic";
+
+/**
+ * Finds an endpoint by either of its ids in an environment: its `wh_` id, or its declared id (the
+ * `id` passed to `webhooks.endpoint.define`), which names the declared, non-tenant instance. Declared
+ * ids can't start with `wh_`, so the prefix decides which unique key is looked up. Scoped to the
+ * environment so another environment's id doesn't resolve.
+ */
+export function webhookEndpointLookup(environmentId: string, endpointId: string) {
+  return isWebhookEndpointFriendlyId(endpointId)
+    ? { runtimeEnvironmentId: environmentId, friendlyId: endpointId }
+    : {
+        runtimeEnvironmentId: environmentId,
+        declaredId: endpointId,
+        endpointTenantId: "",
+        endpointExternalRef: "",
+      };
+}
```

**File**: `apps/webapp/test/syncDeclarativeWebhooks.test.ts` (modified, +18/-0)
```diff
@@ -373,6 +373,24 @@ describe("syncDeclarativeWebhooks shared endpoints", () => {
     }
   );
 
+  containerTest("an endpoint declared with a wh_ id fails the deploy", async ({ prisma }) => {
+    const { project, environment } = await seedProjectWithEnv(prisma);
+    const worker = await seedWorkerWithTask(prisma, project, environment, "orders");
+
+    await expect(
+      syncDeclarativeWebhooks(
+        declaredWebhook("wh_orders", "orders"),
+        worker,
+        asEnv(environment),
+        prisma,
+        prisma
+      )
+    ).rejects.toThrow(/Webhook endpoint id "wh_orders" can't start with "wh_"/);
+    expect(
+      await prisma.webhookEndpoint.count({ where: { runtimeEnvironmentId: environment.id } })
+    ).toBe(0);
+  });
+
   containerTest("a subscriber naming an unknown endpoint fails the deploy", async ({ prisma }) => {
     const { project, environment } = await seedProjectWithEnv(prisma);
     const worker = await seedWorkerWithTask(prisma, project, environment, "orders");
```

---

### Incident Patch 13: `e3882c4b` (2026-10-04)
**Commit Message**: fix(webapp): keep session tags on one row in the sessions list

The sessions list now shows a session's tags on one row, the same as the
runs list, instead of wrapping them onto several lines and growing the
row.

Mono-RevId: fa044489406a355c2b252d46f15d2df699314aaa

**File**: `apps/webapp/app/components/sessions/v1/SessionsTable.tsx` (modified, +2/-2)
```diff
@@ -159,9 +159,9 @@ export function SessionsTable({
                     </span>
                   )}
                 </TableCell>
-                <TableCell to={sessionPath}>
+                <TableCell to={sessionPath} actionClassName="py-1" className="pr-16">
                   {session.tags.length > 0 ? (
-                    <div className="flex flex-wrap gap-1">
+                    <div className="flex gap-1">
                       {session.tags.map((tag) => (
                         <RunTag key={tag} tag={tag} />
                       ))}
```

---

### Incident Patch 14: `cd735648` (2026-10-02)
**Commit Message**: Fix Preview branches pagination alignment

Keep pagination at the far right of the Preview branches toolbar, after
the New branch or purchase button.

Mono-RevId: aac17b393f142086cd94b41bd7ed7da93126dd89

**File**: `apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.branches/route.tsx` (modified, +5/-5)
```diff
@@ -318,11 +318,6 @@ export default function Page() {
                 )}
               </BranchFilters>
               <div className="flex shrink-0 items-center gap-1.5">
-                <PaginationControls
-                  currentPage={currentPage}
-                  totalPages={totalPages}
-                  showPageNumbers={false}
-                />
                 {limits.isAtLimit ? (
                   <UpgradePanel
                     limits={limits}
@@ -356,6 +351,11 @@ export default function Page() {
                     env="preview"
                   />
                 )}
+                <PaginationControls
+                  currentPage={currentPage}
+                  totalPages={totalPages}
+                  showPageNumbers={false}
+                />
               </div>
             </div>
           )}
```

---

### Incident Patch 15: `4a94982a` (2026-10-02)
**Commit Message**: fix(cli): send MCP feedback to the Cloud analytics project

Fixes `submit_feedback` sending reports to the wrong analytics project.
No change to the tool itself or to what it sends.

Mono-RevId: eb0722ee8651cbd59f3991c8579636ecdba7102d

**File**: `.changeset/mcp-feedback-project.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"trigger.dev": patch
+---
+
+Reports filed with the `submit_feedback` MCP tool now reach the Trigger.dev team. They were being sent, but not somewhere anyone was reading.
```

**File**: `packages/cli-v3/src/consts.ts` (modified, +4/-2)
```diff
@@ -2,6 +2,8 @@ export const COMMAND_NAME = "trigger.dev";
 export const CLOUD_WEB_URL = "https://cloud.trigger.dev";
 export const CLOUD_API_URL = "https://api.trigger.dev";
 
-// Write-only project key, the same one the dashboard already ships to every browser.
-export const POSTHOG_PROJECT_KEY = "phc_LFH7kJiGhdIlnO22hTAKgHpaKhpM8gkzWAFvHmf5vfS";
+// Write-only project key for the Cloud analytics project. Not the default in the webapp's
+// env schema - that one is the self-hosted fallback, and reports sent with it land in the
+// self-hosters project instead.
+export const POSTHOG_PROJECT_KEY = "phc_9aSDbJCaDUMdZdHxxMPTvcj7A9fsl3mCgM1RBPmPsl7";
 export const POSTHOG_INGEST_HOST = "https://eu.i.posthog.com";
```

#### Recent Merged Pull Requests:
- **PR #5001** (closed): docs: add TrueProxies to the Puppeteer proxying list (@trueproxies)
- **PR #4998** (closed): Repo Sync (@motherskitchenblr2)
- **PR #4996** (2026-10-02): chore: release v4.7.2 (@github-actions[bot])
- **PR #4994** (2026-10-02): chore: release v4.7.1 (@github-actions[bot])
- **PR #4993** (closed):  fix(webapp): allow divisors of 60 for API_RATE_LIMIT_METRICS_BUCKET_SECONDS  (@StackedByAdit)
- **PR #4991** (closed): docs: use @supabase/server in Supabase database operations guide (@mrprkr)
- **PR #4987** (closed): fix(webapp): recognize object-store 404 by status code for missing transcripts (@mahenoorsalat)
- **PR #4985** (2026-09-28): fix(ci): switch MinIO tests to Chainguard images (@carderne)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

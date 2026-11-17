# Verification Protocol: Verification Protocol: Empirical Defect Shield for materializeinc-materialize-learnings

<!-- PROVENANCE_START
{
  "source_repository": "materializeinc-materialize-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:50:20.835Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-materializeinc-materialize-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [materializeinc-materialize-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:50:20.835Z`  
> **Learning ID**: `LEARN-EVO-materializeinc-materialize-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `materializeinc-materialize-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/materializeinc-materialize-learnings.md`  
> **Source**: github ([https://github.com/MaterializeInc/materialize](https://github.com/MaterializeInc/materialize))  
> **Source Version**: `3d7977fc`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T03:50:14.284Z  
> **Learning ID**: `learn-github-materializeinc-materialize`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): MaterializeInc/materialize

> **Canonical Artifact**: `07_PROJECT_LEARNING/materializeinc-materialize-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MaterializeInc/materialize](https://github.com/MaterializeInc/materialize))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T03:50:14.279Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MaterializeInc/materialize`
- **Description**: The live data layer for apps and AI agents. Create up-to-the-second views into your business, just using SQL
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 6405 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ci/deploy/deploy_util.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

from materialize import MZ_ROOT, cargo


def rust_version() -> str:
    rust_version = cargo.Workspace(MZ_ROOT).rust_version
    assert rust_version is not None, "workspace missing rust version configuration"
    return rust_version

```

### Core Architecture Module: `ci/deploy_mz-debug/deploy_util.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

import os

from materialize.mz_version import MzDebugVersion

TAG = os.environ["BUILDKITE_TAG"]
MZ_DEBUG_VERSION = MzDebugVersion.parse(TAG)
MZ_DEBUG_VERSION_STR = f"v{MZ_DEBUG_VERSION.str_without_prefix()}"

```

### Core Architecture Module: `ci/deploy_mz-deploy/deploy_util.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

import os

from materialize.mz_version import MzDeployVersion

TAG = os.environ["BUILDKITE_TAG"]
MZ_DEPLOY_VERSION = MzDeployVersion.parse(TAG)
MZ_DEPLOY_VERSION_STR = f"v{MZ_DEPLOY_VERSION.str_without_prefix()}"

```

### Core Architecture Module: `ci/deploy_mz/deploy_util.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

import os

from materialize.mz_version import MzCliVersion

APT_BUCKET = "materialize-apt"
TAG = os.environ["BUILDKITE_TAG"]
MZ_CLI_VERSION = MzCliVersion.parse(TAG)

```

### Core Architecture Module: `console/src/api/materialize/cluster/createClusterReplicaStatement.ts`
```
// Copyright Materialize, Inc. and contributors. All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

import { sql } from "kysely";

import { escapedLiteral as lit } from "~/api/materialize";

export default function createClusterReplicaStatement(values: {
  clusterName: string;
  name: string;
  size: string;
}) {
  return sql`CREATE CLUSTER REPLICA ${sql.id(values.clusterName)}.${sql.id(
    values.name,
  )} SIZE = ${lit(values.size)}
`;
}

```

### Core Architecture Module: `console/src/api/materialize/cluster/replicaUtilization.ts`
```
// Copyright Materialize, Inc. and contributors. All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

import { QueryKey } from "@tanstack/react-query";
import { InferResult, sql } from "kysely";

import { executeSqlV2, queryBuilder } from "~/api/materialize";

/**
 * The most recent utilization sample per replica, from the same `_3h` view the
 * cluster detail charts read, so both surfaces show the same number.
 *
 * NOTE: fractions, not percentages. The hour bound leaves a replica with no
 * recent sample blank rather than hours stale.
 */
export function buildReplicaUtilizationQuery({
  includeSwap = false,
}: {
  /**
   * Select `swapPercent`, swap's share of the heap limit as the cluster page's
   * memory chart stacks it, or null for a size whose heap limit is only its
   * RAM. Its columns need mz >= 26.44.
   */
  includeSwap?: boolean;
} = {}) {
  return queryBuilder
    .selectFrom("mz_console_cluster_utilization_overview_3h")
    .distinctOn("replica_id")
    .where(sql<boolean>`mz_now() <= occurred_at + INTERVAL '1 hour'`)
    .select([
      "replica_id as replicaId",
      "cpu_percent as cpuPercent",
      "memory_percent as memoryPercent",
      "disk_percent as diskPercent",
      "heap_percent as heapPercent",
    ])
    .$if(includeSwap, (qb) =>
      qb.select(
        sql<number | null>`CASE WHEN heap_limit_percent > 1
          THEN swap_of_ram_percent / heap_limit_percent END`.as("swapPercent"),
      ),
    )
    .orderBy("replica_id")
    .orderBy("occurred_at", "desc");
}

export type ReplicaUtilization = InferResult<
  ReturnType<typeof buildReplicaUtilizationQuery>
>[0];

/** Fetches the latest utilization sample for every replica in the environment. */
export async function fetchReplicaUtilization({
  params,
  queryKey,
  requestOptions,
}: {
  params: Parameters<typeof buildReplicaUtilizationQuery>[0];
  queryKey: QueryKey;
  requestOptions?: RequestInit;
}) {
  const compiledQuery = buildReplicaUtilizationQuery(params).compile();
  return executeSqlV2({ queries: compiledQuery, queryKey, requestOptions });
}

```

### Core Architecture Module: `console/src/api/materialize/cluster/replicaUtilizationBinning.ts`
```
// Copyright Materialize, Inc. and contributors. All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

import * as Sentry from "@sentry/react";
import { flatGroup, greatest } from "d3";

import {
  DataPoint,
  OfflineEvent as ChartOfflineEvent,
  ReplicaData,
} from "~/platform/clusters/ClusterOverview/types";

export type OfflineEvent = {
  replicaId: string;
  occurredAt: string;
  status: string;
  reason: string | null;
};

/**
 * A replica's worst-process swap and heap limit, as fractions of one process's
 * RAM, taken from the bucket's max-heap sample.
 */
export type MemoryBreakdown = {
  swapOfRamPercent: number | null;
  /** Where RAM plus swap runs out. 1.0 means the size has no swap. */
  heapLimitPercent: number | null;
};

export type Bucket = {
  size: string | null;
  bucketStart: Date;
  replicaId: string;
  bucketEnd: Date;
  name: string;
  // The cluster ID of the replica's current blue-green deployment
  currentDeploymentClusterId: string;
  // The cluster ID of the replica. If the cluster was dropped,
  // this will be different from currentDeploymentClusterId
  clusterId: string;
  maxMemory: {
    percent: number | null;
    occurredAt: Date;
  };
  maxDisk: {
    percent: number | null;
    occurredAt: Date;
  };
  maxCpu: {
    percent: number | null;
    occurredAt: Date;
  };
  maxHeap: {
    percent: number | null;
    occurredAt: Date;
  };
  maxMemoryAndDisk: {
    memoryPercent: number | null;
    diskPercent: number | null;
    percent: number | null;
    occurredAt: Date;
  };
  /** Absent unless the query selected the swap columns. */
  memoryBreakdown?: MemoryBreakdown;

  offlineEvents: OfflineEvent[] | null;
};

export interface UtilizationSample {
  replicaId: string;
  clusterId: string | null;
  size: string | null;
  name: string | null;
  occurredAt: Date;
  cpuPercent: number | null;
  memoryPercent: number | null;
  diskPercent: number | null;
  heapPercent: number | null;
  memoryAndDiskPercent: number | null;
  swapOfRamPercent?: number | null;
  heapLimitPercent?: number | null;
}

/** A (replica, bucket) rollup, matching the binned `_overview*` views' output. */
export interface UtilizationBucketRow {
  bucketStart: Date;
  bucketEnd: Date;
  replicaId: string;
  clusterId: string | null;
  size: string | null;
  name: string | null;
  maxMemoryPercent: number | null;
  maxMemoryAt: Date;
  maxDiskPercent: number | null;
  maxDiskAt: Date;
  maxCpuPercent: number | null;
  maxCpuAt: Date;
  maxHeapPercent: number | null;
  maxHeapAt: Date;
  maxMemoryAndDiskPercent: number | null;
  maxMemoryAndDiskMemoryPercent: number | null;
  maxMemoryAndDiskDiskPercent: number | null;
  maxMemoryAndDiskAt: Date;
  offlineEvents: OfflineEvent[] | null;
  swapOfRamPercent?: number | null;
  heapLimitPercent?: number | null;
}

/**
 * Raw row from the binned 24h SUBSCRIBE, where the date columns arrive as ISO
 * strings rather than `Date`s.
 */
export type BinnedSubscribeRow = Omit<
  UtilizationBucketRow,
  | "bucketStart"
  | "bucketEnd"
  | "maxMemoryAt"
  | "maxDiskAt"
  | "maxCpuAt"
  | "maxHeapAt"
  | "maxMemoryAndDiskAt"
> & {
  bucketStart: string;
  bucketEnd: string;
  maxMemoryAt: string;
  maxDiskAt: string;
  maxCpuAt: string;
  maxHeapAt: string;
  maxMemoryAndDiskAt: string;
};

/** Parse a binned 24h SUBSCRIBE row's string dates into a `UtilizationBucketRow`. */
export function parseBinnedSubscribeRow(
  raw: BinnedSubscribeRow,
): UtilizationBucketRow {
  return {
    ...raw,
    bucketStart: new Date(raw.bucketStart),
    bucketEnd: new Date(raw.bucketEnd),
    maxMemoryAt: new Date(raw.maxMemoryAt),
    maxDiskAt: new Date(raw.maxDiskAt),
    maxCpuAt: new Date(raw.maxCpuAt),
    maxHeapAt: new Date(raw.maxHeapAt),
    maxMemoryAndDiskAt: new Date(raw.maxMemoryAndDiskAt),
  };
}

/** argmax over samples by a metric, treating null as the lowest value. */
export function maxByMetric(
  samples: UtilizationSample[],
  metric: (s: UtilizationSample) => number | null,
): UtilizationSample {
  return (
    greatest(samples, (s) => metric(s) ?? Number.NEGATIVE_INFINITY) ??
    samples[0]
  );
}

/**
 * Bins raw samples into per-(replica, bucket) maxima, client-side. Buckets are
 * epoch-aligned to match the SQL `date_bin` 1970 origin. Offline events aren't in
 * the un-binned base, so they are null here.
 */
export function rebucketUtilizationSamples(
  samples: UtilizationSample[],
  bucketSizeMs: number,
  startDateMs: number,
): UtilizationBucketRow[] {
  const bucketStartOf = (s: UtilizationSample) =>
    Math.floor(s.occurredAt.getTime() / bucketSizeMs) * bucketSizeMs;

  // The 3h base covers more than shorter windows (e.g. "Last hour"); clip to the
  // requested window so the chart doesn't show extra history.
  const inWindow = samples.filter((s) => s.occurredAt.getTime() >= startDateMs);

  const rows = flatGroup(inWindow, (s) => s.replicaId, bucketStartOf).map(
    ([replicaId, bucketStartMs, group]): UtilizationBucketRow => {
      const first = group[0];
      const cpu = maxByMetric(group, (s) => s.cpuPercent);
      const memory = maxByMetric(group, (s) => s.memoryPercent);
      const disk = maxByMetric(group, (s) => s.diskPercent);
      const heap = maxByMetric(group, (s) => s.heapPercent);
      const memoryAndDisk = maxByMetric(group, (s) => s.memoryAndDiskPercent);
      return {
        bucketStart: new Date(bucketStartMs),
        bucketEnd: new Date(bucketStartMs + bucketSizeMs),
        replicaId,
        clusterId: first.clusterId,
        size: first.size,
        name: first.name,
        maxMemoryPercent: memory.memoryPercent,
        maxMemoryAt: memory.occurredAt,
        maxDiskPercent: disk.diskPercent,
        maxDiskAt: disk.occurredAt,
        maxCpuPercent: cpu.cpuPercent,
        maxCpuAt: cpu.occurredAt,
        maxHeapPercent: heap.heapPercent,
        maxHeapAt: heap.occurredAt,
        maxMemoryAndDiskPercent: memoryAndDisk.memoryAndDiskPercent,
        maxMemoryAndDiskMemoryPercent: memoryAndDisk.memoryPercent,
        maxMemoryAndDiskDiskPercent: memoryAndDisk.diskPercent,
        maxMemoryAndDiskAt: memoryAndDisk.occurredAt,
        offlineEvents: null,
        // Take swap from the max-heap sample, as the binned views do.
        swapOfRamPercent: heap.swapOfRamPercent,
        heapLimitPercent: heap.heapLimitPercent,
      };
    },
  );

  rows.sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());
  return rows;
}

/**
 * Attach offline events to their (replica, bucket) rows. The un-binned 3h base
 * carries no status columns, so the <=3h tier fetches events separately and
 * merges them here. Events with no matching bucket are dropped, like the
 * binned views' LEFT JOIN from the metrics-derived buckets.
 */
export function attachOfflineEvents(
  rows: UtilizationBucketRow[],
  events: OfflineEvent[],
  bucketSizeMs: number,
): UtilizationBucketRow[] {
  if (events.length === 0) return rows;
  const eventsByBucket = new Map<string, OfflineEvent[]>();
  for (const event of events) {
    const bucketStartMs =
      Math.floor(new Date(event.occurredAt).getTime() / bucketSizeMs) *
      bucketSizeMs;
    const key = `${event.replicaId} ${bucketStartMs}`;
    const bucketEvents = eventsByBucket.get(key) ?? [];
    bucketEvents.push(event);
    eventsByBucket.set(key, bucketEvents);
  }
  return rows.map((row) => {
    const bucketEvents = eventsByBucket.get(
      `${row.replicaId} ${row.bucketStart.getTime()}`,
    );
    return bucketEvents ? { ...row, offlineEvents: bucketEvents } : row;
  });
}

/**
 * Group per-(replica, bucket) rows into `Bucket[]` by replica, tracking the
 * overall min/max bounds. `resolveCurrentDeployment` maps a past cluster id to its
 * current blue-green deployment; omitted, it defaults to the row's own `clusterId`.
 */
export function bucketRowsToBucketsByReplicaId(
  rows: UtilizationBucketRow[],
  resolveCurrentDeployment?: (clusterId: string) => string | undefined,
): {
  bucketsByReplicaId: Record<string, Bucket[]>;
  minBucketStartMs: number;
  maxBucketEndMs: number;
} {
  const bucketsByReplicaId: Record<string, Bucket[]> = {};

  let minBucketStartMs = Number.POSITIVE_INFINITY;
  let maxBucketEndMs = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    minBucketStartMs = Math.min(minBucketStartMs, row.bucketStart.getTime());
    maxBucketEndMs = Math.max(maxBucketEndMs, row.bucketEnd.getTime());

    const {
      replicaId,
      size,
      bucketStart,
      bucketEnd,
      name,
      clusterId,
      offlineEvents,
    } = row;

    const buckets = bucketsByReplicaId[replicaId];

    if (name === null || clusterId === null) {
      const err = new Error(
        `Expected name: ${name} and clusterId: ${clusterId} to be defined`,
      );

      Sentry.captureException(err);
      throw err;
    }

    const currentDeploymentClusterId =
      resolveCurrentDeployment?.(clusterId) ?? clusterId;

    const newBucket: Bucket = {
      size,
      bucketStart,
      bucketEnd,
      offlineEvents,
      name,
      currentDeploymentClusterId,
      clusterId,
      replicaId,
      maxMemory: {
        percent: row.maxMemoryPercent,
        occurredAt: row.maxMemoryAt,
      },
      maxDisk: {
        percent: row.maxDiskPercent,
        occurredAt: row.maxDiskAt,
      },
      maxCpu: {
        percent: row.maxCpuPercent,
        occurredAt: row.maxCpuAt,
      },
      maxHeap: {
        percent: row.maxHeapPercent ?? null,
        occurredAt: row.maxHeapAt ?? new Date(),
      },
      maxMemoryAndDisk: {
        percent: row.maxMemoryAndDiskPercent,
        memoryPercent: row.maxMemoryAndDiskMemoryPercent,
        diskPercent: row.maxMemoryAndDiskDiskPercent,
        occurredAt: row.maxMemoryAndDiskAt,
      },

```

### Core Architecture Module: `console/src/api/materialize/cluster/replicaUtilizationHistory.ts`
```
// Copyright Materialize, Inc. and contributors. All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

import { QueryKey } from "@tanstack/react-query";
import { sql } from "kysely";

import { executeSqlV2, queryBuilder } from "~/api/materialize";
import { buildSubscribeQuery } from "~/api/materialize/buildSubscribeQuery";

import {
  expandClusterLineage,
  fetchClusterDeploymentLineage,
} from "./clusterDeploymentLineage";
import {
  bucketRowsToBucketsByReplicaId,
  UtilizationBucketRow,
} from "./replicaUtilizationBinning";

// Re-exported for existing importers of these data types.
export type { Bucket, OfflineEvent } from "./replicaUtilizationBinning";

export type ReplicaUtilizationHistoryParameters = {
  // Filter per cluster
  clusterIds?: string[];
  // Filter per replica
  replicaId?: string;
  // Start date of the history. The history will start from the earliest bucket.
  startDate: string;
  // End date of the history. The history will end at the latest bucket.
  endDate?: string;
  // Size of the time buckets in milliseconds
  bucketSizeMs: number;

  // Whether to use the console cluster utilization overview view (14d/1h).
  shouldUseConsoleClusterUtilizationOverviewView?: boolean;
  // Select the swap columns, which need mz >= 26.44.
  includeMemoryBreakdown?: boolean;
};
// We have an equivalent query in `builtin.rs` in MaterializeInc/materialize.
// This query should be kept in sync with `mz_console_cluster_utilization_overview`.
export function buildReplicaUtilizationHistoryQuery({
  clusterIds,
  replicaId,
  startDate,
  endDate,
  bucketSizeMs,
  includeMemoryBreakdown = false,
}: ReplicaUtilizationHistoryParameters) {
  const bucketSizeMsSqlStr = sql.raw(`${bucketSizeMs}`);
  const startDateLit = sql.lit(startDate);
  const endDateLit = sql.lit(startDate);

  const dateBinOrigin = sql.lit("1970-01-01");

  let query = queryBuilder
    .with("replica_history", (qb) => {
      let history = qb
        .selectFrom("mz_cluster_replica_history")
        .select(["replica_id", "cluster_id", "size"]);
      // We need to union the current set of cluster replicas since mz_cluster_replica_history doesn't account for system clusters
      let current = qb
        .selectFrom("mz_cluster_replicas")
        .select(["id as replica_id", "cluster_id", "size"]);
      // Push the cluster filter into both UNION branches up front. Otherwise it
      // only enters at the final join and the optimizer can't push it into the
      // shared `replica_utilization_history_binned` CTE, so the metrics
      // aggregate and all five Top-1 passes run over the whole fleet and only
      // the last step discards other clusters. Filtering here scopes the heavy
      // work to the requested cluster(s).
      if (clusterIds !== undefined && clusterIds.length > 0) {
        history = history.where("cluster_id", "in", clusterIds);
        current = current.where("cluster_id", "in", clusterIds);
      }
      return history.union(current);
    })
    .with("replica_name_history", (qb) =>
      qb
        .selectFrom("mz_cluster_replica_name_history")
        .select((eb) => [
          "id",
          "new_name as name",
          sql<Date>`COALESCE(${eb.ref("occurred_at")}, TIMESTAMP ${dateBinOrigin})`.as(
            "occurred_at",
          ),
        ]),
    )
    // NOTE(SangJunBak): We do not have ideal handling for
    // multiprocess clusters (i.e., 6400cc+ clusters at the time of writing) in
    // the Console. Specifically, we merge metrics across processes as if they were on a single machine.
    // Ideally it would return data for each process in
    // the replica separately, but the downstream consumers (e.g., the replica
    // graphs) are not yet equipped to handle that.
    // A better fix should be handled here (https://github.com/MaterializeInc/console/issues/1041)
    .with("replica_metrics_history", (qb) =>
      qb
        .selectFrom("replica_history as r")
        .innerJoin("mz_cluster_replica_sizes as s", "r.size", "s.size")
        .innerJoin(
          "mz_cluster_replica_metrics_history as m",
          "m.replica_id",
          "r.replica_id",
        )
        .select([
          "m.occurred_at",
          "m.replica_id",
          "r.size",
          sql<
            number | null
          >`(SUM(m.cpu_nano_cores::float8) / (NULLIF(s.cpu_nano_cores, 0) * s.processes))`.as(
            "cpu_percent",
          ),
          sql<
            number | null
          >`(SUM(m.memory_bytes::float8) / (NULLIF(s.memory_bytes, 0) * s.processes))`.as(
            "memory_percent",
          ),
          sql<
            number | null
          >`(SUM(m.disk_bytes::float8) / (NULLIF(s.disk_bytes, 0) * s.processes))`.as(
            "disk_percent",
          ),
          sql<number | null>`SUM(m.disk_bytes::float8)`.as("disk_bytes"),
          sql<number | null>`SUM(m.memory_bytes::float8)`.as("memory_bytes"),
          sql<number | null>`s.disk_bytes * s.processes`.as("total_disk_bytes"),
          sql<number>`s.memory_bytes * s.processes`.as("total_memory_bytes"),
          sql<number | null>`MAX(m.heap_bytes::float8)`.as("heap_bytes"),
          sql<number | null>`MAX(m.heap_limit)`.as("heap_limit"),
          // heap_limit is NULL when clusterd isn't launched with --heap-limit
          // (e.g. the emulator's process orchestrator). Fall back to the
          // size-based memory percent so the chart still renders.
          sql<number | null>`COALESCE(
            MAX(m.heap_bytes::float8 / NULLIF(m.heap_limit, 0)),
            SUM(m.memory_bytes::float8) / (NULLIF(s.memory_bytes, 0) * s.processes)
          )`.as("heap_percent"),
        ])
        // Mirrors `CONSOLE_MEMORY_SHARES_SQL` in the builtin views.
        .$if(includeMemoryBreakdown, (metrics) =>
          metrics.select([
            sql<
              number | null
            >`MAX(m.swap_bytes::float8) / NULLIF(s.memory_bytes, 0)`.as(
              "swap_of_ram_percent",
            ),
            sql<
              number | null
            >`MAX(m.heap_limit::float8) / NULLIF(s.memory_bytes, 0)`.as(
              "heap_limit_percent",
            ),
          ]),
        )
        .groupBy([
          "m.occurred_at",
          "m.replica_id",
          "r.size",
          "s.cpu_nano_cores",
          "s.memory_bytes",
          "s.disk_bytes",
          "s.processes",
        ]),
    )
    .with("replica_utilization_history_binned", (qb) => {
      // Read the per-sample rollup directly. replica_metrics_history is already
      // derived from replica_history, so joining replica_history here would be
      // redundant and could fan out if a replica ever had two sizes.
      let cte = qb
        .selectFrom("replica_metrics_history as m")
        .select([
          "m.occurred_at",
          "m.replica_id",
          "m.cpu_percent",
          "m.memory_percent",
          "m.memory_bytes",
          "m.disk_percent",
          "m.disk_bytes",
          "m.total_disk_bytes",
          "m.total_memory_bytes",
          "m.heap_bytes",
          "m.heap_percent",
          "m.size",
          sql<Date>`date_bin(
              '${bucketSizeMsSqlStr} MILLISECONDS',
              occurred_at,
              TIMESTAMP ${dateBinOrigin}
            )`.as("bucket_start"),
        ])
        .$if(includeMemoryBreakdown, (binned) =>
          binned.select(["m.swap_of_ram_percent", "m.heap_limit_percent"]),
        )
        .where(
          "occurred_at",
          ">=",
          sql<Date>`
            date_bin(
              '${bucketSizeMsSqlStr} MILLISECONDS',
              TIMESTAMP ${startDateLit},
              TIMESTAMP ${dateBinOrigin}
            )`,
        );
      if (endDate) {
        cte = cte.where(
          (eb) =>
            sql<Date>`${eb.ref("occurred_at")} + INTERVAL '${bucketSizeMsSqlStr} MILLISECONDS'`,
          "<=",
          sql<Date>`
            date_bin(
              '${bucketSizeMsSqlStr} MILLISECONDS',
              TIMESTAMP ${endDateLit},
              TIMESTAMP ${dateBinOrigin}
            )`,
        );
      }
      return cte;
    })
    // For each (replica, bucket), take the (replica, bucket) with the highest memory
    .with("max_memory", (qb) =>
      /**
       * This is a TOP k=1 optimization using DISTINCT ON https://materialize.com/docs/transform-data/patterns/top-k/.
       */
      qb
        .selectFrom("replica_utilization_history_binned")
        .distinctOn(["bucket_start", "replica_id"])
        .select(["bucket_start", "replica_id", "memory_percent", "occurred_at"])
        .orderBy("bucket_start")
        .orderBy("replica_id")
        .orderBy((oeb) => sql`COALESCE(${oeb.ref("memory_bytes")}, 0)`, "desc"),
    )
    // For each (replica, bucket), take the (replica, bucket) with the highest disk
    .with("max_disk", (qb) =>
      qb
        .selectFrom("replica_utilization_history_binned")
        .distinctOn(["bucket_start", "replica_id"])
        .select(["bucket_start", "replica_id", "disk_percent", "occurred_at"])
        .orderBy("bucket_start")
        .orderBy("replica_id")
        .orderBy((oeb) => sql`COALESCE(${oeb.ref("disk_bytes")}, 0)`, "desc"),
    )
    // For each (replica, bucket), take the (replica, bucket) with the highest cpu
    .with("max_cpu", (qb) =>
      qb
        .selectFrom("replica_utilization_history_binned")
        .distinctOn(["bucket_start", "replica_id"])
        .select(["bucket_start", "replica_id", "cpu_percent", "occurred_at"])
        .orderBy("bucket_start")
        .orderBy("replica_id")
        .orderBy((oeb) => sql`COALESCE(${oeb.ref("cpu_percent")}, 0)`, "desc"),
    )
    // For each (replica, bucket), take the (replica, bucket) with the highest heap
    .with("max_heap", (qb) =>
```

### Core Architecture Module: `console/src/api/materialize/cluster/replicasWithUtilization.ts`
```
// Copyright Materialize, Inc. and contributors. All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

import { QueryKey } from "@tanstack/react-query";
import { InferResult, sql } from "kysely";

import { extractEnvironmentVersion } from "~/api/buildQueryKeySchema";
import { executeSqlV2, queryBuilder } from "~/api/materialize";
import {
  buildLatestClusterReplicaUtilizationTable,
  getOwners,
} from "~/api/materialize/expressionBuilders";

export function buildClusterReplicasWithUtilizationQuery(
  clusterId: string,
  environmentVersion?: string,
) {
  return queryBuilder
    .selectFrom("mz_cluster_replicas as cr")
    .innerJoin(getOwners().as("owners"), "owners.id", "cr.owner_id")
    .innerJoin("mz_clusters as c", "c.id", "cr.cluster_id")
    .innerJoin("mz_cluster_replica_sizes as crs", "crs.size", "cr.size")
    .innerJoin(
      buildLatestClusterReplicaUtilizationTable(
        clusterId,
        environmentVersion,
      ).as("cru"),
      "cr.id",
      "cru.replica_id",
    )
    .select([
      "cr.id",
      "cr.name",
      "c.name as clusterName",
      "cr.size",
      "cr.disk",
      "cru.cpu_percent as cpuPercent",
      "cru.disk_percent as diskPercent",
      "cru.heap_percent as memoryUtilizationPercent",
      "c.managed",
      "owners.isOwner",
      sql<string>`(crs.disk_bytes * crs.processes)::text`.as("diskBytes"),
    ])
    .where("c.id", "=", clusterId)
    .orderBy("cr.id");
}

export type ClusterReplicaWithUtilizaton = InferResult<
  ReturnType<typeof buildClusterReplicasWithUtilizationQuery>
>[0];

export type ClusterReplicasWithUtilizationParams = {
  clusterId: string;
};

/**
 * Fetches replicas with utilization for a given cluster.
 */
export async function fetchClusterReplicasWithUtilization(
  params: ClusterReplicasWithUtilizationParams,
  queryKey: QueryKey,
  requestOptions?: RequestInit,
) {
  const compiledQuery = buildClusterReplicasWithUtilizationQuery(
    params.clusterId,
    extractEnvironmentVersion(queryKey),
  ).compile();
  return executeSqlV2({
    queries: compiledQuery,
    queryKey: queryKey,
    requestOptions,
  });
}

```

### Core Architecture Module: `console/src/api/materialize/cluster/workerCpu.ts`
```
// Copyright Materialize, Inc. and contributors. All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

import { RawBuilder, sql } from "kysely";

import { queryBuilder } from "~/api/materialize";
import { buildSubscribeQuery } from "~/api/materialize/buildSubscribeQuery";

// These read a replica's introspection relations, so they must run in
// a session pinned to that replica (`cluster` and `cluster_replica`). They then
// run on that cluster, not on `mz_catalog_server`.
//
// A dataflow's root operator (an address of length one) accounts for all the
// time spent in the regions and operators it contains, so summing roots counts
// each nanosecond once. Summing every operator would count it once per level
// of nesting.

/** The unit the subscribes round elapsed time down to, in nanoseconds. */
export const ELAPSED_UNIT_NS = 10_000_000;

// Every dataflow's counter grows each second, idle or not, so unrounded these
// send an update per dataflow and worker each second. In 10 ms units an idle
// dataflow's value stops changing and the subscribe sends nothing for it:
// measured 22 rows/s unrounded against 1.2 on an idle 11-dataflow, 2-worker
// replica. A difference of two values is then off by under 10 ms per
// dataflow, 0.02% of a core over the minute a measurement spans at least, and
// a dataflow that runs under 10 ms in all reads as idle. 100 ms would be 2% of
// what two workers 5% busy spend in a minute.
const roundedElapsedNs = (elapsedNs: RawBuilder<unknown>) =>
  sql<
    number | null
  >`(floor(${elapsedNs} / ${sql.lit(ELAPSED_UNIT_NS)}) * ${sql.lit(ELAPSED_UNIT_NS)})::float8`;

const dataflowIdOfRoot = sql`${sql.ref("a.address")}[1]`;
const isRootOperator = sql<boolean>`list_length(${sql.ref("a.address")}) = 1`;

/** One dataflow's cumulative time on one worker. */
export interface DataflowWorkerCpuRow {
  dataflowId: string;
  workerId: number;
  elapsedNs: number;
}

/** An object a dataflow maintains. */
export interface DataflowExportRow {
  objectId: string;
  dataflowId: string;
  /** The connection id of a subscribe's session, or null for other exports. */
  connectionId: number | null;
  /** The dataflow's name, for a transient (`t`) export. */
  dataflowName: string | null;
}

/** A row of `buildWorkerCpuSubscribe`. */
export type WorkerCpuRow =
  | ({ kind: "elapsed" } & DataflowWorkerCpuRow & {
        objectId: null;
        connectionId: null;
        dataflowName: null;
      })
  | ({ kind: "export" } & DataflowExportRow & {
        workerId: null;
        elapsedNs: null;
      });

/** Each dataflow's cumulative time on each worker, in 10 ms units. */
export function buildDataflowElapsedQuery() {
  // NOTE: roots are filtered before counting, joined on the full key of both
  // relations' indexes. Counting through `mz_scheduling_elapsed_per_worker`
  // keeps a count per operator and worker in the subscribe's dataflow:
  // measured 94 against 13 ms/s of CPU per worker, and 92 against 0.7 MB, on
  // 500 dataflows over 8 workers.
  return queryBuilder
    .selectFrom("mz_scheduling_elapsed_raw as r")
    .innerJoin("mz_dataflow_addresses_per_worker as a", (join) =>
      join.onRef("a.id", "=", "r.id").onRef("a.worker_id", "=", "r.worker_id"),
    )
    .where(isRootOperator)
    .groupBy([dataflowIdOfRoot, "r.worker_id"])
    .select([
      sql<WorkerCpuRow["kind"]>`'elapsed'`.as("kind"),
      sql<string>`${dataflowIdOfRoot}::text`.as("dataflowId"),
      sql<number | null>`${sql.ref("r.worker_id")}::int4`.as("workerId"),
      roundedElapsedNs(sql`count(*)`).as("elapsedNs"),
      sql<string | null>`NULL::text`.as("objectId"),
      sql<number | null>`NULL::uint4`.as("connectionId"),
      sql<string | null>`NULL::text`.as("dataflowName"),
    ]);
}

/**
 * What each dataflow maintains: user objects (`u` ids) and transient
 * dataflows (`t` ids), named so a caller can tell a session's queries and
 * subscribes from the coordinator's own. System dataflows still count toward
 * each worker's total, but have nothing to name.
 */
export function buildDataflowExportsQuery() {
  // NOTE: names are joined per worker, on the full key of the operators'
  // index. Through `mz_dataflows`, which keeps worker 0, the subscribe
  // arranges every operator's name.
  const transientNames = queryBuilder
    .selectFrom("mz_compute_exports_per_worker as xw")
    .innerJoin("mz_dataflow_addresses_per_worker as a", (join) =>
      join
        .onRef("a.worker_id", "=", "xw.worker_id")
        .on(sql<boolean>`${dataflowIdOfRoot} = ${sql.ref("xw.dataflow_id")}`)
        .on(isRootOperator),
    )
    .innerJoin("mz_dataflow_operators_per_worker as o", (join) =>
      join.onRef("o.id", "=", "a.id").onRef("o.worker_id", "=", "a.worker_id"),
    )
    .where("xw.export_id", "like", "t%")
    .select(["xw.export_id as exportId", "o.name"])
    .distinct();
  return queryBuilder
    .selectFrom("mz_compute_exports as x")
    .leftJoin("mz_subscriptions as s", "s.id", "x.export_id")
    .leftJoin("mz_sessions as ss", "ss.id", "s.session_id")
    .leftJoin(transientNames.as("n"), "n.exportId", "x.export_id")
    .where((eb) =>
      eb.or([eb("x.export_id", "like", "u%"), eb("x.export_id", "like", "t%")]),
    )
    .select([
      sql<WorkerCpuRow["kind"]>`'export'`.as("kind"),
      sql<string>`${sql.ref("x.dataflow_id")}::text`.as("dataflowId"),
      sql<number | null>`NULL::int4`.as("workerId"),
      sql<number | null>`NULL::float8`.as("elapsedNs"),
      sql<string | null>`${sql.ref("x.export_id")}`.as("objectId"),
      sql<number | null>`${sql.ref("ss.connection_id")}`.as("connectionId"),
      sql<string | null>`${sql.ref("n.name")}`.as("dataflowName"),
    ]);
}

/**
 * Each dataflow's time on each worker and what each dataflow maintains, in
 * one subscribe that ends on its own once its frontier passes `upToMs`, so a
 * client that stops reading without closing it stops costing the replica.
 */
export function buildWorkerCpuSubscribe(upToMs: number) {
  return buildSubscribeQuery<WorkerCpuRow>(
    buildDataflowElapsedQuery().unionAll(buildDataflowExportsQuery()),
    {
      upsertKey: ["kind", "dataflowId", "workerId", "objectId"],
      upToMs,
    },
  );
}

/** A `buildWorkerCpuSubscribe` row's upsert key. */
export const workerCpuRowKey = (row: WorkerCpuRow) =>
  `${row.kind}|${row.dataflowId}|${row.workerId}|${row.objectId}`;

/** `buildWorkerCpuSubscribe`'s rows, split by kind. */
export function splitWorkerCpuRows(rows: WorkerCpuRow[]) {
  const dataflows: DataflowWorkerCpuRow[] = [];
  const exports: DataflowExportRow[] = [];
  for (const row of rows) {
    if (row.kind === "elapsed") {
      const { dataflowId, workerId, elapsedNs } = row;
      dataflows.push({ dataflowId, workerId, elapsedNs });
    } else {
      const { objectId, dataflowId, connectionId, dataflowName } = row;
      exports.push({ objectId, dataflowId, connectionId, dataflowName });
    }
  }
  return { dataflows, exports };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #40829** (2026-11-16): **set S3 client pooling to "gcs" (instead of off) by default**
  *Symptoms*: The S3 client pooling for GCS (via S3-compatible API) has been in use for a while. It seems good enough to turn on by default for anyone else using GCS for Persist's blob storage.

- **Issue #40827** (2026-11-16): **doc: SQL Server guide for dropping the capture instance's key constraint**
  *Symptoms*: ### Motivation  [EDU-118](https://linear.app/materializeinc/issue/EDU-118). The SQL Server "Handle upstream schema changes" guide covered column add/drop but not constraint changes. The Postgres and MySQL guides already have a constraint section.  ### Description  - `sql-server/source-versioning.md`: new "Handle upstream constraint changes" section. It covers what is ignored, notes that `EXCLUDE CONSTRAINTS` options are unsupported for SQL Server, and gives the safe order for dropping the key the capture instance uses: new capture instance with `@index_name`, re-create the table, drop the old table, disable the old capture instance, then drop the constraint. - `upstream-schema-change-behavior.html` (SQL Server branch): link to the new section.  ### Verification  Not run live, because Docker wasn't available. The SQL Server behavior matches `test/sql-server-cdc/constraints.td` (`ref_unique`, `superseded` cases). `EXCLUDE CONSTRAINTS` being rejected matches `src/sql/src/pure.rs`.  --- _Generated by [Claude Code](https://claude.ai/code/session_016DcnmqzpzTKxjUGp8g9Qvj)_

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

### Incident Patch 1: `5001e904` (2026-11-16)
**Commit Message**: persist: build txn-wal batches without hollow runs (#40654)

Problem:
With persist_batch_max_runs >= 2 and a finite persist_batch_max_run_len,
the batch builder compacts runs as it writes
them and spills long runs into hollow runs (RunPart::Many).

The txn-wal rewrites every table batch to its commit timestamp. But
HollowBatch::rewrite_ts can't reach the parts inside a hollow run, so it
is possible to panic based on this

Solution:

Introduce a builder (WriteHandle::rewritable_builder) for batches whose
timestamps will be rewritten.

It sets the run length limit to unbounded, so its batches never contain
hollow runs, eliminating the condition.

txn-wal's commit batch, COPY FROM STDIN,
oneshot COPY FROM, and TimestamplessUpdateBuilder use it. Other batches,
e.g. MV sinks, keep spilling.

rewrite_ts now rejects a hollow run during validation, before mutating
the
batch, and returns an error instead of panicking. However, upstream may
still panic on the error.

Testing:
- a unit test shows a plain builder batch holds a hollow run and fails
to rewrite
- a rewritable_builder batch can rewrite and reads back at the new
timestamp.
- testdrive repros the issue

Note:
A bigger solution would

**File**: `src/adapter/src/coord/sequencer/inner/copy_from.rs` (modified, +2/-2)
```diff
@@ -556,7 +556,7 @@ impl Coordinator {
         // re-timestamp it during commit.
         let lower = mz_repr::Timestamp::MIN;
         let upper = Antichain::from_elem(lower.step_forward());
-        let mut batch_builder = write_handle.builder(Antichain::from_elem(lower));
+        let mut batch_builder = write_handle.rewritable_builder(Antichain::from_elem(lower));
         let mut row_count: u64 = 0;
         let mut row_count_in_batch: u64 = 0;
         let mut batch_bytes: usize = 0;
@@ -650,7 +650,7 @@ impl Coordinator {
                 })?;
                 proto_batches.push(batch.into_transmittable_batch());
 
-                batch_builder = write_handle.builder(Antichain::from_elem(lower));
+                batch_builder = write_handle.rewritable_builder(Antichain::from_elem(lower));
                 row_count_in_batch = 0;
                 batch_bytes = 0;
             }
```

**File**: `src/persist-client/src/batch.rs` (modified, +59/-0)
```diff
@@ -1997,6 +1997,65 @@ mod tests {
         assert_eq!(actual, expected);
     }
 
+    // One update per part and a max run len of 2 make in-builder compaction spill hollow runs.
+    #[mz_ore::test(tokio::test)]
+    #[cfg_attr(miri, ignore)] // too slow
+    async fn rewrite_ts_compacted_user_batch() {
+        let cache = PersistClientCache::new_no_metrics();
+        cache.cfg.set_config(&BLOB_TARGET_SIZE, 0);
+        cache.cfg.set_config(&MAX_RUNS, 2);
+        cache.cfg.set_config(&MAX_RUN_LEN, 2);
+        cache.cfg.set_config(&INLINE_WRITES_SINGLE_MAX_BYTES, 0);
+        cache.cfg.set_config(&INLINE_WRITES_TOTAL_MAX_BYTES, 0);
+        let client = cache
+            .open(PersistLocation::new_in_mem())
+            .await
+            .expect("client construction failed");
+        let (mut write, read) = client
+            .expect_open::<String, (), u64, i64>(ShardId::new())
+            .await;
+        let keys: Vec<String> = (0..10).map(|i| format!("{i:02}")).collect();
+        let has_hollow_run = |batch: &Batch<String, (), u64, i64>| {
+            batch
+                .batch
+                .parts
+                .iter()
+                .any(|p| matches!(p, RunPart::Many(_)))
+        };
+
+        // A plain builder spills, so the rewrite fails.
+        let mut builder = write.builder(Antichain::from_elem(0));
+        for k in &keys {
+            builder.add(k, &(), &0, &1).await.unwrap();
+        }
+        let mut batch = builder.finish(Antichain::from_elem(1)).await.unwrap();
+        assert!(has_hollow_run(&batch), "{:?}", batch.batch.parts);
+        assert!(
+            batch
+                .rewrite_ts(&Antichain::from_elem(2), Antichain::from_elem(3))
+                .is_err()
+        );
+        batch.delete().await;
+
+        let mut builder = write.rewritable_builder(Antichain::from_elem(0));
+        for k in &keys {
+            builder.add(k, &(), &0, &1).await.unwrap();
+        }
+        let mut batch = builder.finish(Antichain::from_elem(1)).await.unwrap();
+        assert!(!has_hollow_run(&batch), "{:?}", batch.batch.parts);
+
+        batch
+            .rewrite_ts(&Antichain::from_elem(2), Antichain::from_elem(3))
+            .unwrap();
+        write
+            .expect_compare_and_append_batch(&mut [&mut batch], 0, 3)
+            .await;
+
+        let (actual, _) = read.expect_listen(0).await.read_until(&3).await;
+        let expected: Vec<_> = keys.into_iter().map(|k| ((k, ()), 2, 1)).collect();
+        assert_eq!(actual, expected);
+    }
+
     #[mz_ore::test(tokio::test)]
     #[cfg_attr(miri, ignore)] // unsupported operation: returning ready events from epoll_wait is not yet implemented
     async fn structured_lowers() {
```

**File**: `src/persist-client/src/internal/state.rs` (modified, +33/-17)
```diff
@@ -1194,37 +1194,34 @@ impl<T: Timestamp + TotalOrder> HollowBatch<T> {
                 [T::minimum()],
             ));
         }
-        for part in self.parts.iter() {
-            let Some(ts_rewrite) = part.ts_rewrite() else {
-                continue;
+        let mut parts = Vec::with_capacity(self.parts.len());
+        for part in self.parts.iter_mut() {
+            // A hollow run's parts live in a separate blob this rewrite can't edit.
+            // `WriteHandle::rewritable_builder` never makes one.
+            let RunPart::Single(part) = &mut *part else {
+                return Err(format!("unexpected rewrite of a hollow run: {part:?}"));
             };
-            if PartialOrder::less_than(frontier, ts_rewrite) {
+            if let Some(ts_rewrite) = part.ts_rewrite()
+                && PartialOrder::less_than(frontier, ts_rewrite)
+            {
                 return Err(format!(
                     "rewrite frontier {:?} < batch rewrite {:?}",
                     frontier.elements(),
                     ts_rewrite.elements(),
                 ));
             }
+            parts.push(part);
         }
 
         self.desc = Description::new(
             self.desc.lower().clone(),
             new_upper,
             self.desc.since().clone(),
         );
-        for part in &mut self.parts {
+        for part in parts {
             match part {
-                RunPart::Single(BatchPart::Hollow(part)) => {
-                    part.ts_rewrite = Some(frontier.clone())
-                }
-                RunPart::Single(BatchPart::Inline { ts_rewrite, .. }) => {
-                    *ts_rewrite = Some(frontier.clone())
-                }
-                RunPart::Many(runs) => {
-                    // Currently unreachable: we only apply rewrites to user batches, and we don't
-                    // ever generate runs of >1 part for those.
-                    panic!("unexpected rewrite of a hollow runs ref: {runs:?}");
-                }
+                BatchPart::Hollow(part) => part.ts_rewrite = Some(frontier.clone()),
+                BatchPart::Inline { ts_rewrite, .. } => *ts_rewrite = Some(frontier.clone()),
             }
         }
         Ok(())
@@ -2991,7 +2988,7 @@ pub(crate) mod tests {
     use mz_build_info::DUMMY_BUILD_INFO;
     use mz_dyncfg::ConfigUpdates;
     use mz_ore::now::SYSTEM_TIME;
-    use mz_ore::{assert_none, assert_ok};
+    use mz_ore::{assert_err, assert_none, assert_ok};
     use mz_proto::RustType;
     use proptest::prelude::*;
     use proptest::strategy::ValueTree;
@@ -3353,6 +3350,25 @@ pub(crate) mod tests {
         )
     }
 
+    #[mz_ore::test]
+    fn rewrite_ts_hollow_run() {
+        let mut batch = hollow(0u64, 1, &["a"], 2);
+        batch.parts.push(RunPart::Many(HollowRunRef {
+            key: PartialBatchKey("b".to_owned()),
+            hollow_bytes: 0,
+            max_part_bytes: 0,
+            key_lower: vec![],
+            structured_key_lower: None,
+            diffs_sum: None,
+            _phantom_data: PhantomData,
+        }));
+        let before = batch.clone();
+
+        let res = batch.rewrite_ts(&Antichain::from_elem(2), Antichain::from_elem(3));
+        assert_err!(res);
+        assert_eq!(batch, before);
+    }
+
     #[mz_ore::test]
     fn downgrade_since() {
         let mut state = TypedState::<(), (), u64, i64>::new(
```

**File**: `src/persist-client/src/write.rs` (modified, +20/-0)
```diff
@@ -882,6 +882,26 @@ where
         )
     }
 
+    /// Like [Self::builder], but for batches that go through [Batch::rewrite_ts], e.g. txn-wal
+    /// commits. These never contain hollow runs, whose parts the rewrite can't reach.
+    pub fn rewritable_builder(&self, lower: Antichain<T>) -> BatchBuilder<K, V, T, D> {
+        let mut compact_cfg = CompactConfig::new(&self.cfg, self.shard_id());
+        // Never spill a run into a hollow run.
+        compact_cfg.batch.run_length_limit = usize::MAX;
+        Self::builder_inner(
+            &self.cfg,
+            compact_cfg,
+            Arc::clone(&self.metrics),
+            Arc::clone(&self.machine.applier.shard_metrics),
+            &self.metrics.user,
+            Arc::clone(&self.isolated_runtime),
+            Arc::clone(&self.blob),
+            self.shard_id(),
+            self.write_schemas.clone(),
+            lower,
+        )
+    }
+
     /// Implementation of [Self::builder], so that we can share the
     /// implementation in `PersistClient`.
     pub(crate) fn builder_inner(
```

**File**: `src/storage-client/src/client.rs` (modified, +1/-1)
```diff
@@ -560,7 +560,7 @@ where
     /// with the provided [`WriteHandle`].
     pub fn new(handle: &WriteHandle<K, V, Timestamp, D>) -> Self {
         let initial_ts = Timestamp::MIN;
-        let builder = handle.builder(Antichain::from_elem(initial_ts));
+        let builder = handle.rewritable_builder(Antichain::from_elem(initial_ts));
         TimestamplessUpdateBuilder {
             builder,
             initial_ts,
```

**File**: `src/storage-operators/src/oneshot_source.rs` (modified, +1/-1)
```diff
@@ -597,7 +597,7 @@ where
         let lower = mz_repr::Timestamp::MIN;
         let upper = Antichain::from_elem(lower.step_forward());
 
-        let mut batch_builder = write_handle.builder(Antichain::from_elem(lower));
+        let mut batch_builder = write_handle.rewritable_builder(Antichain::from_elem(lower));
 
         while let Some(event) = rows_handle.next().await {
             let AsyncEvent::Data(_, row_batch) = event else {
```

**File**: `src/txn-wal/src/txn_write.rs` (modified, +2/-1)
```diff
@@ -181,7 +181,8 @@ where
 
                         // Form batches for any Row data.
                         if !updates.writes.is_empty() {
-                            let mut batch = data_write.builder(Antichain::from_elem(T::minimum()));
+                            let mut batch =
+                                data_write.rewritable_builder(Antichain::from_elem(T::minimum()));
                             for (k, v, d) in updates.writes.iter() {
                                 batch.add(k, v, &commit_ts, d).await.expect("valid usage");
                             }
```

**File**: `test/testdrive/persist-rewrite-ts-hollow-run.td` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+# Copyright Materialize, Inc. and contributors. All rights reserved.
+#
+# Use of this software is governed by the Business Source License
+# included in the LICENSE file at the root of this repository.
+#
+# As of the Change Date specified in that file, in accordance with
+# the Business Source License, use of this software will be governed
+# by the Apache License, Version 2.0.
+
+# PER-152: with in-builder compaction on and a small max run len, a large
+# INSERT used to panic environmentd when txn-wal rewrote its timestamps.
+
+$ postgres-execute connection=mz_system
+ALTER SYSTEM SET persist_batch_max_runs = 2
+ALTER SYSTEM SET persist_batch_max_run_len = 2
+ALTER SYSTEM SET persist_blob_target_size = 1024
+
+> CREATE TABLE t (a int, b text)
+
+> INSERT INTO t SELECT x, repeat('x', 100) FROM generate_series(1, 5000) AS x
+
+> SELECT count(*), sum(a) FROM t
+5000 12502500
+
+$ postgres-execute connection=mz_system
+ALTER SYSTEM RESET persist_batch_max_runs
+ALTER SYSTEM RESET persist_batch_max_run_len
+ALTER SYSTEM RESET persist_blob_target_size
```

---

### Incident Patch 2: `d53b3074` (2026-11-16)
**Commit Message**: doc: SQL Server guide for dropping the capture instance's key constraint (#40827)

### Motivation

[EDU-118](https://linear.app/materializeinc/issue/EDU-118). The SQL
Server "Handle upstream schema changes" guide covered column add/drop
but not constraint changes. The Postgres and MySQL guides already have a
constraint section.

### Description

- `sql-server/source-versioning.md`: new "Handle upstream constraint
changes" section. It covers what is ignored, notes that `EXCLUDE
CONSTRAINTS` options are unsupported for SQL Server, and gives the safe
order for dropping the key the capture instance uses: new capture
instance with `@index_name`, re-create the table, drop the old table,
disable the old capture instance, then drop the constraint.
- `upstream-schema-change-behavior.html` (SQL Server branch): link to
the new section.

### Verification

Not run live, because Docker wasn't available. The SQL Server behavior
matches `test/sql-server-cdc/constraints.td` (`ref_unique`, `superseded`
cases). `EXCLUDE CONSTRAINTS` being rejected matches
`src/sql/src/pure.rs`.

---
_Generated by [Claude
Code](https://claude.ai/code/session_016DcnmqzpzTKxjUGp8g9Qvj)_

---------

Co-authored-by: Claud

**File**: `doc/user/content/ingest-data/sql-server/source-versioning.md` (modified, +135/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 title: "Handle upstream schema changes"
-description: "How to add a column, or drop a column, from your source SQL Server database, without any downtime in Materialize"
+description: "How to add a column, drop a column, or change the key constraint of a table in your source SQL Server database, without any downtime in Materialize"
 
 menu:
   main:
@@ -19,6 +19,8 @@ table schema changes seamlessly, specifically:
 
 - Adding a column in the upstream database.
 - Dropping a column in the upstream database.
+- Dropping the `PRIMARY KEY` or `UNIQUE` constraint that the capture instance
+  uses.
 
 This guide walks you through how to handle these changes without any downtime in Materialize.
 
@@ -235,6 +237,138 @@ Materialize. However, the drop affects `v2.t1` and `v2.matview` from our earlier
 examples. When the user attempts to read from either, Materialize will report an
 error that the source table schema has been altered.
 
+## Handle upstream constraint changes
+
+Materialize ignores foreign key and `CHECK` constraints, and adding a `PRIMARY
+KEY` or `UNIQUE` constraint does not affect ingestion. Materialize records as a
+key only the `PRIMARY KEY` or `UNIQUE` constraint that the capture instance
+uses to identify rows (see [Unique keys](/ingest-data/sql-server/#unique-keys)).
+For tables created in v26.49 or later, dropping any other `PRIMARY KEY` or
+`UNIQUE` constraint does not affect ingestion either.
+
+{{< warning >}}
+Tables created in Materialize before v26.49 record every `PRIMARY KEY` and
+`UNIQUE` constraint that existed when the table was created. Dropping one of
+those upstream is not detected and leaves the table with a key that SQL Server
+no longer enforces, and queries that rely on the key can return wrong results.
+Before dropping such a constraint, re-create the table in Materialize.
+{{< /warning >}}
+
+{{< note >}}
+SQL Server sources do not support the `EXCLUDE CONSTRAINTS`, `EXCLUDE ALL NOT
+NULL CONSTRAINTS`, or `EXCLUDE ALL CONSTRAINTS` options. Adding or removing a
+`NOT NULL` constraint requires an upstream `ALTER COLUMN`, which puts the
+table into an error state. Re-create the table in Materialize afterwards.
+{{< /note >}}
+
+To drop the constraint that the capture instance uses, move the capture
+instance to a different unique index first. This example uses a table `t2`
+whose capture instance `dbo_t2` uses the primary key `t2_pkey`, and which also
+has a `UNIQUE` constraint `t2_email_key`:
+
+```sql
+CREATE TABLE t2 (
+    id INT NOT NULL CONSTRAINT t2_pkey PRIMARY KEY,
+    email NVARCHAR(255) NOT NULL CONSTRAINT t2_email_key UNIQUE
+);
+
+EXEC sys.sp_cdc_enable_table
+  @source_schema = 'dbo',
+  @source_name = 't2',
+  @role_name = 'materialize_role',
+  @capture_instance = 'dbo_t2',
+  @supports_net_changes = 0;
+GO -- The GO terminator may be unsupported or unnecessary for your client.
+```
+
+```mzsql
+CREATE TABLE v1.t2
+    FROM SOURCE my_source(REFERENCE dbo.t2);
+```
+
+### A. Create a capture instance on a different index
+
+In your upstream SQL Server database, create a new capture instance that uses
+`t2_email_key` through
+[`@index_name`](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sys-sp-cdc-enable-table-transact-sql#----index_name):
+
+```sql
+EXEC sys.sp_cdc_enable_table
+  @source_schema = 'dbo',
+  @source_name = 't2',
+  @role_name = 'materialize_role',
+  @capture_instance = 'dbo_t2_v2', -- MUST BE SPECIFIED
+  @index_name = 't2_email_key',
+  @supports_net_changes = 0;
+GO -- The GO terminator may be unsupported or unnecessary for your client.
+```
+
+SQL Server allows at most two capture instances per table. If the table already
+has two, [disable the one that is not in
+use](#disable-unused-capture-instance) first.
+
+If the table has no other `PRIMARY KEY` or `UNIQUE` constraint, add one first,
+on columns that are `NOT NULL`. SQL Server does not accept a `UNIQUE`
+constraint over nullable columns as a capture instance index. If `@index_name` names an index created with `CREATE UNIQUE INDEX`, the new
+Materialize table has no key.
+
+{{< warning >}}
+From this point on, SQL Server no longer prevents dropping `t2_pkey`. Dropping
+it before you complete step C leaves `v1.t2` with a key that SQL Server no
+longer enforces, and queries that rely on the key can return wrong results.
+{{< /warning >}}
+
+### B. Create a new table from the source in Materialize
+
+Re-create the table in a new schema. Materialize uses the most [recently created
+capture instance](/ingest-data/sql-server/#capture-instance-selection), so
+`v4.t2` records `t2_email_key` as its key:
+
+```mzsql
+CREATE SCHEMA v4;
+
+CREATE TABLE v4.t2
+    FROM SOURCE my_source(REFERENCE dbo.t2);
+```
+
+{{< note >}}
+
+{{% include-headless "/headless/source-versioning-snapshotting-note" %}}
+
+{{< /note >}}
+
+Queries over `v4.t2` can no longer rely on `t2_pkey` as a key, so their plans
+can differ from those over `v1.t2`. Before mov
```

**File**: `doc/user/layouts/shortcodes/upstream-schema-change-behavior.html` (modified, +4/-4)
```diff
@@ -91,10 +91,10 @@
 If you then drop the constraint, the Materialize table keeps a key that SQL
 Server no longer enforces, and queries that rely on the key can return wrong
 results. To change the key of a table, create the new capture instance,
-[re-create the table in
-Materialize](/ingest-data/sql-server/source-versioning/#c-create-a-new-table-from-the-source-in-materialize)
-so that it ingests from the new capture instance, and only then drop the old
-constraint upstream.
+re-create the table in Materialize so that it ingests from the new capture
+instance, and only then drop the old constraint upstream. See [Handle upstream
+constraint
+changes](/ingest-data/sql-server/source-versioning/#handle-upstream-constraint-changes).
 
 Tables created in Materialize before v26.49 record every `PRIMARY KEY` and
 `UNIQUE` constraint that existed when the table was created. Dropping one of
```

---

### Incident Patch 3: `f5a26b13` (2026-11-16)
**Commit Message**: docs: add guide for serving during source stalls (#40527)

Supersedes #40376 (same commit plus one on top), addressing its 5 review
comments. Closes:
[EDU-110](https://linear.app/materializeinc/issue/EDU-110)

- Explain read and write frontiers in plain terms.
- Add a diagram of two sources' frontiers: overlap when healthy, no
common timestamp once one stalls
(`static/images/serve-results/source-stall-frontiers.svg`).
- Reword the matrix row to "Reads an indexed view or materialized view
which joins the stalled and healthy sources".
- Remove the `EXPLAIN TIMESTAMP` paragraph.
- Rename the heading to "How to join across sources and serve stale".

Hugo isn't available in the session, so the site wasn't built. I
rendered the SVG in Chromium to check it.

---
_Generated by [Claude
Code](https://claude.ai/code/session_016DcnmtmEWizM6P5CH8w88r)_

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `doc/user/content/serve-results/source-stalls.md` (added, +182/-0)
```diff
@@ -0,0 +1,182 @@
+---
+title: "Serve results during source stalls"
+description: "Which queries Materialize keeps serving while an upstream source is stalled or errored, and how to design for availability during upstream outages."
+menu:
+  main:
+    name: "Serve during source stalls"
+    parent: serve-results
+    identifier: 'serve-results-source-stalls'
+    weight: 16
+---
+
+When an upstream system becomes unavailable, for example a Kafka broker outage,
+a database restart, or an ingestion cluster with no replicas, the affected
+source stops ingesting. Your application does not have to stop reading. In many
+cases, Materialize keeps serving results from the last data it ingested.
+
+Whether a query keeps serving depends on the session's [isolation
+level](/serve-results/isolation-level/) and on which inputs the query reads.
+This guide covers how to design your queries so that they keep serving through
+an upstream outage, and how to fail fast when they can't.
+
+## Understand stalls and errors
+
+### Stalls and errors
+
+A source that stops ingesting is in one of two situations. Use
+[`mz_source_statuses`](/sql/system-catalog/mz_internal/#mz_source_statuses) to
+check its status, and see [Understand the lifecycle of a
+source](/ingest-data/lifecycle-of-a-source/) for what each status means.
+
+| Situation | Status | Examples | Recovery |
+|-----------|--------|----------|----------|
+| **Stall** | `paused`, or `stalled` with a retryable error | Upstream unreachable, no replica running the source | Resumes on its own once the cause clears |
+| **Definite error** | `stalled`, with an error that says the source or table must be dropped and recreated | Dropped publication, incompatible upstream schema change | [Recreate the affected objects](/ingest-data/lifecycle-of-a-source/#which-stalls-clear-on-their-own) |
+
+A source can also stop ingesting without changing its status, for example when
+the upstream connection hangs. Check whether its write frontier still advances
+in [`mz_frontiers`](/sql/system-catalog/mz_internal/#mz_frontiers).
+
+### What happens to timestamps
+
+Materialize serves every query at a single timestamp. Each collection, whether
+a source table, index, or materialized view, tracks two frontiers:
+
+- The **write frontier** is how far the collection's data is complete. All
+  changes before it are known, and new data arrives at or after it.
+- The **read frontier** is the earliest timestamp the collection can still
+  answer. Materialize compacts older history, so it moves forward over time.
+
+A collection can answer queries at timestamps between its read frontier and its
+write frontier. While a source ingests, both frontiers keep advancing.
+
+- **During a stall**, the write frontier freezes at the last timestamp the
+  source ingested. The data up to that timestamp stays intact and readable.
+- **After a definite error**, the error is written into the collection, and the
+  collection closes. Every read of it at or after the error's timestamp
+  returns the error, at every isolation level. None of the patterns in this
+  guide apply. Recreate the affected objects instead.
+
+The rest of this guide is about stalls.
+
+### How a stall affects queries
+
+A query can only be served at a timestamp that every one of its inputs can
+answer. When source A stalls, its write frontier freezes, while the read
+frontier of a healthy source B keeps advancing. Once B's read frontier moves
+past A's frozen write frontier, no timestamp works for both, and a query that
+reads A and B together blocks until A resumes.
+
+For example, a query that joins source A and source B must find a timestamp
+that both sources can answer:
+
+![Timelines of the read and write frontiers of two sources, healthy and with source A stalled](/images/serve-results/source-stall-frontiers.svg)
+
+The isolation level adds its own constraint. Under **strict serializable** (the
+default), a query must read at a timestamp at least as late as any result
+Materialize has already served. That timestamp keeps advancing during a stall,
+so any query that reads stalled data blocks. For a guarantee that a query sees
+everything available upstream, see [real-time
+recency](/serve-results/isolation-level/#real-time-recency). Under **serializable**, a query can read at an earlier timestamp,
+so a query whose inputs all stalled together serves results as of the stall.
+
+Blocked queries wait. They do not error, and they complete once the source
+resumes.
+
+## Behavior by query shape and isolation level
+
+| Query shape | Serializable | Strict serializable | Bounded staleness |
+|-------------|--------------|---------------------|-------------------|
+| Reads only healthy inputs | Serves | Serves | Serves |
+| Reads only the stalled source's tables, or indexes and views over them | Serves stale | Blocks | Serves stale, then errors once the stall exceeds the bound |
+| Reads an indexed view or materialized view which joins the stalled
```

**File**: `doc/user/content/serve-results/troubleshooting/unresponsive-queries.md` (modified, +3/-0)
```diff
@@ -86,6 +86,9 @@ WHERE id LIKE 'u%'
 
 A source in the result isn't ingesting data. The `error` column shows why.
 
+While a source is stalled, some queries can still serve results as of the
+stall. See [Serve results during source stalls](/serve-results/source-stalls/).
+
 ### Check for hydrating objects
 
 ```mzsql
```

**File**: `doc/user/static/images/serve-results/source-stall-frontiers.svg` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="760" height="400" viewBox="0 0 760 400" font-family="Inter, Helvetica, Arial, sans-serif" font-size="13">
+  <defs>
+    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
+      <path d="M0,0 L10,5 L0,10 Z" fill="#555"/>
+    </marker>
+  </defs>
+  <rect width="760" height="400" fill="#ffffff"/>
+
+  <!-- Panel 1: both sources healthy -->
+  <text x="20" y="30" font-size="15" font-weight="600" fill="#1a1a1a">Both sources healthy: the query serves</text>
+  <rect x="260" y="48" width="300" height="120" fill="#e3f4ea"/>
+  <text x="130" y="85" fill="#1a1a1a">Source A</text>
+  <rect x="200" y="70" width="360" height="24" rx="4" fill="#7f56d9"/>
+  <text x="130" y="135" fill="#1a1a1a">Source B</text>
+  <rect x="260" y="120" width="340" height="24" rx="4" fill="#3b82f6"/>
+  <text x="200" y="64" text-anchor="middle" fill="#555" font-size="11">read</text>
+  <text x="560" y="64" text-anchor="middle" fill="#555" font-size="11">write</text>
+  <text x="260" y="114" text-anchor="middle" fill="#555" font-size="11">read</text>
+  <text x="600" y="114" text-anchor="middle" fill="#555" font-size="11">write</text>
+  <line x1="540" y1="48" x2="540" y2="168" stroke="#15803d" stroke-width="2" stroke-dasharray="5,3"/>
+  <text x="410" y="162" text-anchor="middle" fill="#15803d" font-size="12">timestamps both sources can answer</text>
+  <text x="545" y="182" fill="#15803d" font-size="12">query timestamp</text>
+
+  <!-- Panel 2: source A stalled -->
+  <text x="20" y="225" font-size="15" font-weight="600" fill="#1a1a1a">Source A stalled: the query blocks</text>
+  <rect x="380" y="258" width="60" height="82" fill="#fde8e8"/>
+  <text x="130" y="275" fill="#1a1a1a">Source A</text>
+  <rect x="200" y="260" width="180" height="24" rx="4" fill="#7f56d9"/>
+  <text x="130" y="325" fill="#1a1a1a">Source B</text>
+  <rect x="440" y="310" width="280" height="24" rx="4" fill="#3b82f6"/>
+  <text x="200" y="254" text-anchor="middle" fill="#555" font-size="11">read</text>
+  <text x="380" y="254" text-anchor="middle" fill="#b42318" font-size="11">write (frozen)</text>
+  <text x="440" y="304" text-anchor="middle" fill="#555" font-size="11">read</text>
+  <text x="720" y="304" text-anchor="middle" fill="#555" font-size="11">write</text>
+  <text x="410" y="362" text-anchor="middle" fill="#b42318" font-size="12">no common timestamp</text>
+
+  <!-- Time axis -->
+  <line x1="130" y1="385" x2="740" y2="385" stroke="#555" stroke-width="1.5" marker-end="url(#arrow)"/>
+  <text x="130" y="378" fill="#555" font-size="12">time</text>
+</svg>
```

#### Recent Merged Pull Requests:
- **PR #40829** (2026-11-16): set S3 client pooling to "gcs" (instead of off) by default (@ublubu)
- **PR #40827** (2026-11-16): doc: SQL Server guide for dropping the capture instance's key constraint (@maheshwarip)
- **PR #40826** (2026-11-16): doc: warn that usage on a secret exposes its value (@jasonhernandez)
- **PR #40824** (2026-11-16): test/terraform: drop the gcp service account key fallback (@jasonhernandez)
- **PR #40823** (2026-11-16): ci: move workflows off pull_request_target (@Alphadelta14)
- **PR #40803** (2026-11-16): dbt-materialize: quote the cluster name in drop_cluster (@bobbyiliev)

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

## X. persist: build txn-wal batches without hollow runs

**RULE**:
When implementing operations in `src/adapter/src/coord/sequencer/inner/copy_from.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MaterializeInc/materialize. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5001e904`: persist: build txn-wal batches without hollow runs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/adapter/src/coord/sequencer/inner/copy_from.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        let mut batch_builder = write_handle.rewritable_builder(Antichain::from_elem(lower));
                batch_builder = write_handle.rewritable_builder(Antichain::from_elem(lower));
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        let mut batch_builder = write_handle.builder(Antichain::from_elem(lower));
                batch_builder = write_handle.builder(Antichain::from_elem(lower));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5001e904` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

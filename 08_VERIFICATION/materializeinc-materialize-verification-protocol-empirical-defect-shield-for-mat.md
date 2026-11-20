# Verification Protocol: Verification Protocol: Empirical Defect Shield for MaterializeInc/materialize

<!-- PROVENANCE_START
{
  "source_repository": "MaterializeInc/materialize",
  "source_url": "https://github.com/MaterializeInc/materialize",
  "source_version": "116bffc3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T01:20:34.488Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-materializeinc-materialize",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MaterializeInc/materialize](https://github.com/MaterializeInc/materialize) (Revision: `116bffc3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T01:20:34.488Z`  
> **Learning ID**: `learn-github-materializeinc-materialize`


## 1. Scope & Verification Target
- **Target Repository**: `MaterializeInc/materialize` (Commit: `116bffc3`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): MaterializeInc/materialize

> **Canonical Artifact**: `07_PROJECT_LEARNING/materializeinc-materialize-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MaterializeInc/materialize](https://github.com/MaterializeInc/materialize))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T01:20:33.181Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MaterializeInc/materialize`
- **Description**: The live data layer for apps and AI agents. Create up-to-the-second views into your business, just using SQL
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 6407 stars

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
- **Issue #40933** (2026-11-19): **ci: Nightly fixes (2026-11-19)**
  *Symptoms*: Based on https://buildkite.com/materialize/nightly/builds/18794  Exposed by https://github.com/MaterializeInc/materialize/pull/40890  Test run: https://buildkite.com/materialize/nightly/builds/18800 (edit: green)

- **Issue #40932** (2026-11-19): **workload-anonymize: rename query policy names in cluster options**
  *Symptoms*: SHOW CREATE CLUSTER renders a managed cluster's attached query policy as a string literal (QUERY POLICY = '<name>'). CREATE/ALTER CLUSTER literals are preserved as configuration, so the policy name survived bin/mz-workload-anonymize verbatim, and the verification pass did not notice because it blanks string literals before scanning for identifiers.  Treat the option value as an object reference: the helper collects and renames it consistently with query policy names in captured statements, and the verification pass checks it like an identifier.  Follow-up to #38762  Closes: [QAR-294](https://linear.app/materializeinc/issue/QAR-294)

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

### Incident Patch 1: `6b3569ab` (2026-11-19)
**Commit Message**: workload-replay: Confirm performance regressions (#40841)

Require the same metric to regress in two fresh reference/current pairs.
Alternative to https://github.com/MaterializeInc/materialize/pull/38712

Closes: [QAR-153](https://linear.app/materializeinc/issue/QAR-153)

Test run: https://buildkite.com/materialize/nightly/builds/18765

**File**: `misc/python/materialize/workload_replay/executor.py` (modified, +59/-72)
```diff
@@ -314,9 +314,9 @@ def benchmark(
     When `compare_against` is set, an older reference version is run first and
     its stats are compared against the current version. Otherwise only the
     current version is run, which still exercises that the workload replays
-    without crashing.
+    without crashing. A performance failure must repeat for the same metric in
+    a fresh reference/current pair. Query errors are not retried.
     """
-    import random
 
     services = [
         "materialized",
@@ -348,22 +348,19 @@ def benchmark(
 
     print_workload_stats(file, workload)
 
-    stats_old = None
-    old_version = None
-    if compare_against:
-        tag = resolve_tag(compare_against)
-        print(f"-- Running against materialized:{tag} (reference)")
+    def run(image: str | None) -> tuple[dict[str, Any], str]:
+        print(f"-- Running against {image or 'current materialized'}")
         random.seed(seed)
         with c.override(
             Materialized(
-                image=f"{image_registry()}/materialized:{tag}",
+                image=image,
                 cluster_replica_size=cluster_replica_sizes,
                 ports=[6875, 6874, 6876, 6877, 6878, 6880, 6881, 26257],
                 environment_extra=["MZ_NO_BUILTIN_CONSOLE=0"],
                 additional_system_parameter_defaults=additional_system_parameter_defaults,
             )
         ):
-            stats_old = test(
+            stats = test(
                 c,
                 workload,
                 file,
@@ -379,82 +376,72 @@ def benchmark(
                 True,
                 max_concurrent_queries,
             )
-            old_version = c.query_mz_version()
+            version = c.query_mz_version()
         try:
             c.kill(*services)
         except:
             pass
         c.rm(*services, destroy_volumes=True)
         c.rm_volumes("mzdata")
-    print("-- Running against current materialized")
-    random.seed(seed)
-    with c.override(
-        Materialized(
-            image=None,
-            cluster_replica_size=cluster_replica_sizes,
-            ports=[6875, 6874, 6876, 6877, 6878, 6880, 6881, 26257],
-            environment_extra=["MZ_NO_BUILTIN_CONSOLE=0"],
-            additional_system_parameter_defaults=additional_system_parameter_defaults,
-        )
-    ):
-        stats_new = test(
-            c,
-            workload,
-            file,
-            factor_initial_data,
-            factor_ingestions,
-            factor_queries,
-            runtime,
-            verbose,
-            True,
-            True,
-            early_initial_data,
-            True,
-            True,
-            max_concurrent_queries,
-        )
-        new_version = c.query_mz_version()
-    try:
-        c.kill(*services)
-    except:
-        pass
-    c.rm(*services, destroy_volumes=True)
-    c.rm_volumes("mzdata")
-    filename = posixpath.relpath(file, LOCATION)
+        return stats, version
 
-    if stats_old is None or old_version is None:
+    if not compare_against:
+        _, new_version = run(None)
         print(f"-- Ran {new_version} without a reference version to compare against")
         return
 
-    print(f"-- Comparing {old_version} against {new_version}")
-    plot_docker_stats_compare(
-        stats_old=stats_old,
-        stats_new=stats_new,
-        file=filename,
-        old_version=old_version,
-        new_version=new_version,
-    )
-    failures: list[TestFailureDetails] = []
-    failures.extend(compare_table(filename, stats_old, stats_new))
-
-    if "errors" in stats_old["queries"]:
-        new_errors = []
-        for error, occurrences in stats_new["queries"]["errors"].items():
-            if error in stats_old["queries"]["errors"]:
-                continue
+    tag = resolve_tag(compare_against)
+    if tag is None:
+        raise ValueError(f"Could not resolve reference {compare_against}")
+    filename = posixpath.relpath(file, LOCATION)
+    pending: set[str] = set()
+    tables = []
+    # A fast baseline can also produce a false regression, so rerun both versions.
+    for attempt in range(1, 3):
+        stats_old, old_version = run(f"{image_registry()}/materialized:{tag}")
+        stats_new, new_version = run(None)
+        print(f"-- Comparing {old_version} against {new_version}, attempt {attempt}")
+        plot_docker_stats_compare(
+            stats_old=stats_old,
+            stats_new=stats_new,
+            file=f"{filename}_attempt_{attempt}",
+            old_version=old_version,
+            new_version=new_version,
+        )
+        table, regressions = compare_table(stats_old, stats_new)
+        tables.append(f"Attempt {attempt}\n{table}")
+        details = "\n\n".join(tables)
+
+        new_errors = [
+            f"{error} in queries: {occurrences}"
+            for error, occurrences in stats_new["queries"].get("errors", {}).items()
+            if error not in stats_old["queries"].get("errors", {})
      
```

**File**: `misc/python/materialize/workload_replay/stats.py` (modified, +6/-19)
```diff
@@ -26,7 +26,6 @@
 import numpy
 
 from materialize import MZ_ROOT, buildkite
-from materialize.mzcompose.test_result import TestFailureDetails
 
 # Byte parsing utilities
 
@@ -391,9 +390,9 @@ def fmt_pct(delta: float) -> str:
 
 
 def compare_table(
-    filename: str, stats_old: dict[str, Any], stats_new: dict[str, Any]
-) -> list[TestFailureDetails]:
-    """Generate a comparison table and check for regressions."""
+    stats_old: dict[str, Any], stats_new: dict[str, Any]
+) -> tuple[str, set[str]]:
+    """Return a comparison table and the metrics exceeding their thresholds."""
     rows = []
     if "object_creation" in stats_old:
         rows.append(
@@ -480,21 +479,19 @@ def compare_table(
             ]
         )
 
-    failures: list[TestFailureDetails] = []
-
     output_lines = [
         f"{'METRIC':<24} | {'OLD':^12} | {'NEW':^12} | {'CHANGE':^9} | {'THRESHOLD':^9} | {'REGRESSION?':^12}",
         "-" * 92,
     ]
 
-    regressed = False
+    regressions = set()
     for name, old, new, threshold in rows:
         delta = pct_change(old, new)
 
         if threshold is None:
             flag = ""
         elif new > old * threshold:
-            regressed = True
+            regressions.add(name)
             flag = "!!YES!!"
         else:
             flag = "no"
@@ -509,14 +506,4 @@ def compare_table(
             f"{threshold_field:>9} | "
             f"{flag:^12}"
         )
-    if regressed:
-        failures.append(
-            TestFailureDetails(
-                message=f"Workload {filename} regressed",
-                details="\n".join(output_lines),
-                test_class_name_override=filename,
-            )
-        )
-
-    print("\n".join(output_lines))
-    return failures
+    return "\n".join(output_lines), regressions
```

---

### Incident Patch 2: `b097a5f4` (2026-11-19)
**Commit Message**: ci: Nightly fixes (2026-11-19) (#40933)

Based on https://buildkite.com/materialize/nightly/builds/18794

Exposed by https://github.com/MaterializeInc/materialize/pull/40890

Test run: https://buildkite.com/materialize/nightly/builds/18800 (edit:
green)

**File**: `test/terraform/mzcompose.py` (modified, +11/-19)
```diff
@@ -23,7 +23,7 @@
 import tempfile
 import threading
 import time
-from collections.abc import Sequence
+from collections.abc import MutableMapping, Sequence
 from pathlib import Path
 from textwrap import dedent
 from typing import IO
@@ -205,6 +205,13 @@ def testdrive(no_reset: bool, use_https: bool = True) -> Testdrive:
     )
 
 
+def pass_license_key(env: MutableMapping[str, str]) -> None:
+    """Hands the CI license key to the Terraform invocations run with `env`."""
+    license_key = os.getenv("MZ_CI_LICENSE_KEY", "")
+    if license_key:
+        env["TF_VAR_license_key"] = license_key
+
+
 def get_tag(tag: str | None) -> str:
     return tag or ci_util.dev_docker_tag()
 
@@ -810,12 +817,7 @@ def setup(
                 f"orchestratord_version={get_tag(orchestratord_tag or tag)}",
             ]
 
-        license_key = os.getenv("MZ_CI_LICENSE_KEY", "")
-        if license_key:
-            self.base_vars += [
-                "-var",
-                f"license_key={license_key}",
-            ]
+        pass_license_key(os.environ)
 
         if prefix == PREFIX_AWS_PERSISTENT:
             delete_after = "2099-12-31T00:00:00Z"
@@ -1453,12 +1455,7 @@ def workflow_gcp_temporary(c: Composition, parser: WorkflowArgumentParser) -> No
                 f"orchestratord_version={get_tag(tag)}",
             ]
 
-        license_key = os.getenv("MZ_CI_LICENSE_KEY", "")
-        if license_key:
-            vars += [
-                "-var",
-                f"license_key={license_key}",
-            ]
+        pass_license_key(os.environ)
 
         vars += [
             "-var",
@@ -1679,12 +1676,7 @@ def workflow_azure_temporary(c: Composition, parser: WorkflowArgumentParser) ->
                 f"orchestratord_version={get_tag(tag)}",
             ]
 
-        license_key = os.getenv("MZ_CI_LICENSE_KEY", "")
-        if license_key:
-            vars += [
-                "-var",
-                f"license_key={license_key}",
-            ]
+        pass_license_key(venv_env)
 
         vars += [
             "-var",
```

---

### Incident Patch 3: `71e76bb8` (2026-11-19)
**Commit Message**: ci: Nightly fixes (2026-11-18) (#40893)

Based on https://buildkite.com/materialize/nightly/builds/18771

SLT: Follow-up to #38762

mz-deploy: Merge skew between #38762 & #38834

Test run: https://buildkite.com/materialize/nightly/builds/18785 (edit:
green)

**File**: `deny.toml` (modified, +6/-0)
```diff
@@ -309,6 +309,12 @@ ignore = [
     "RUSTSEC-2024-0436",
     # Bincode is unmaintained, the team considers version 1.3.3 a complete version of bincode that is not in need of any updates.
     "RUSTSEC-2025-0141",
+    # chrono is unmaintained with no patched release. Arrow and postgres-types
+    # still depend on it.
+    "RUSTSEC-2026-0543",
+    # humantime is unmaintained with no patched release. console-subscriber
+    # still depends on it.
+    "RUSTSEC-2026-0542",
     # Allows private key leakage through timing information
     # rsa is required through iceberg-storage-opendal
     "RUSTSEC-2023-0071",
```

**File**: `misc/python/materialize/cli/ci_annotate_errors.py` (modified, +20/-1)
```diff
@@ -133,6 +133,8 @@
     | Assertion\ `.*'\ failed\.
     | Invalid\ data\ in\ source\ errors,\ saw\ retractions
     | \+\+\+\ Expected\ builds\ to\ be\ available,\ the\ build\ probably\ failed
+    # cargo-deny advisories
+    | ^error\[(?:vulnerability|unmaintained|unsound|notice|yanked)\]:[^\n]*(?:\n(?!error\[|warning\[)[^\n]+)*
     )
     .* $
     """,
@@ -491,7 +493,24 @@ def main() -> int:
 
     if args.buildkite_log_until:
         # Unlike output the caller captures, Buildkite's log has secrets redacted.
-        args.log_files.insert(0, write_buildkite_log(args.buildkite_log_until))
+        try:
+            args.log_files.insert(0, write_buildkite_log(args.buildkite_log_until))
+        except Exception as e:
+            if not args.test_result:
+                raise
+            print(f"Could not retrieve the Buildkite job log: {e}", file=sys.stderr)
+            add_annotation_raw(
+                style="error",
+                markdown=(
+                    f'<a href="#{html.escape(os.environ["BUILDKITE_JOB_ID"])}">'
+                    f"{html.escape(get_suite_name())}</a> failed "
+                    f"(exit status {args.test_result}).\n\n"
+                    "Could not retrieve the job log for error analysis:\n"
+                    f"<pre>{html.escape(str(e))}</pre>\n"
+                    "See the linked job for the command output."
+                ),
+            )
+            return args.test_result
 
     test_analytics_config = create_test_analytics_config_with_hostname(
         args.cloud_hostname
```

**File**: `test/mz-deploy/mzcompose.py` (modified, +0/-2)
```diff
@@ -1336,8 +1336,6 @@ def workflow_avro_record_type(c: Composition, parser: WorkflowArgumentParser) ->
         # What a version 1 lock file holds for this column: the pseudo-type
         # token, with no way to rebuild the record. It has to load, and
         # reconstruction has to say what to do about it.
-        # The container-created file can be owned by root, so replace it.
-        types_lock.unlink()
         types_lock.write_text(
             'version = 1\n\n[[table]]\nname = "app.ingest.ledger_entry"\ncolumns = [\n'
             '    { name = "record", type = "record", nullable = true },\n]\n'
```

**File**: `test/sqllogictest/query_policy.slt` (modified, +6/-0)
```diff
@@ -223,12 +223,18 @@ DETAIL: Query policy "no_dataflows" rule "fast_only" applies to this query on cl
 HINT: Run EXPLAIN to inspect the query plan. Create an index that serves the query on this cluster, or use a cluster whose query policy permits this plan.
 
 # Diagnostics remain available even when their introspection queries need dataflows.
+statement ok
+SET cluster_replica = r1;
+
 statement ok
 EXPLAIN ANALYZE CLUSTER MEMORY;
 
 statement ok
 EXPLAIN ANALYZE MEMORY FOR MATERIALIZED VIEW unindexed;
 
+statement ok
+RESET cluster_replica;
+
 # A persist fast-path read does not build a temporary dataflow.
 query II rowsort
 SELECT * FROM unindexed LIMIT 10;
```

#### Recent Merged Pull Requests:
- **PR #40933** (2026-11-19): ci: Nightly fixes (2026-11-19) (@def-)
- **PR #40932** (2026-11-19): workload-anonymize: rename query policy names in cluster options (@def-)
- **PR #40930** (2026-11-19): storage: Decode bzip2 with libbz2-rs-sys instead of C libbz2 (@jasonhernandez)
- **PR #40929** (2026-11-19): docs: release notes for v26.50.2, v26.49.2, v26.44.2 and v26.41.3 (@bosconi)
- **PR #40924** (2026-11-19): release: mark v26.51, v26.50 as released (@materialize-bot)
- **PR #40922** (2026-11-19): compute: give MV sink correction chunks their own compression floor (@DAlperin)

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

## X. workload-replay: Confirm performance regressions

**RULE**:
When implementing operations in `misc/python/materialize/workload_replay/executor.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MaterializeInc/materialize. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6b3569ab`: workload-replay: Confirm performance regressions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `misc/python/materialize/workload_replay/executor.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    without crashing. A performance failure must repeat for the same metric in
    a fresh reference/current pair. Query errors are not retried.
    def run(image: str | None) -> tuple[dict[str, Any], str]:
        print(f"-- Running against {image or 'current materialized'}")
                image=image,
            stats = test(
            version = c.query_mz_version()
        return stats, version
    if not compare_against:
        _, new_version = run(None)
    tag = resolve_tag(compare_against)
    if tag is None:
        raise ValueError(f"Could not resolve reference {compare_against}")
    filename = posixpath.relpath(file, LOCATION)
    pending: set[str] = set()
    tables = []
    # A fast baseline can also produce a false regression, so rerun both versions.
    for attempt in range(1, 3):
        stats_old, old_version = run(f"{image_registry()}/materialized:{tag}")
        stats_new, new_version = run(None)
        print(f"-- Comparing {old_version} against {new_version}, attempt {attempt}")
        plot_docker_stats_compare(
            stats_old=stats_old,
            stats_new=stats_new,
            file=f"{filename}_attempt_{attempt}",
            old_version=old_
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    without crashing.
    import random
    stats_old = None
    old_version = None
    if compare_against:
        tag = resolve_tag(compare_against)
        print(f"-- Running against materialized:{tag} (reference)")
                image=f"{image_registry()}/materialized:{tag}",
            stats_old = test(
            old_version = c.query_mz_version()
    print("-- Running against current materialized")
    random.seed(seed)
    with c.override(
        Materialized(
            image=None,
            cluster_replica_size=cluster_replica_sizes,
            ports=[6875, 6874, 6876, 6877, 6878, 6880, 6881, 26257],
            environment_extra=["MZ_NO_BUILTIN_CONSOLE=0"],
            additional_system_parameter_defaults=additional_system_parameter_defaults,
        )
    ):
        stats_new = test(
            c,
            workload,
            file,
            factor_initial_data,
            factor_ingestions,
            factor_queries,
            runtime,
            verbose,
            True,
            True,
            early_initial_data,
            True,
            True,
            max_concurrent_queries,
        )
        new_version = c.query_mz_version()
  
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6b3569ab` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

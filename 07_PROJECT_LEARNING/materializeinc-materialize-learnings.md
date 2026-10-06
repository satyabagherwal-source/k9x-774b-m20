# Forensic Learning Record (Deep Inspection): MaterializeInc/materialize

> **Canonical Artifact**: `07_PROJECT_LEARNING/materializeinc-materialize-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MaterializeInc/materialize](https://github.com/MaterializeInc/materialize))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:06:28.162Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MaterializeInc/materialize`
- **Description**: The live data layer for apps and AI agents. Create up-to-the-second views into your business, just using SQL
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 6376 stars

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
export function buildReplicaUtilizationQuery() {
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
    .orderBy("replica_id")
    .orderBy("occurred_at", "desc");
}

export type ReplicaUtilization = InferResult<
  ReturnType<typeof buildReplicaUtilizationQuery>
>[0];

/** Fetches the latest utilization sample for every replica in the environment. */
export async function fetchReplicaUtilization({
  queryKey,
  requestOptions,
}: {
  queryKey: QueryKey;
  requestOptions?: RequestInit;
}) {
  const compiledQuery = buildReplicaUtilizationQuery().compile();
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

import { OfflineEvent as ChartOfflineEvent } from "~/platform/clusters/ClusterOverview/types";

export type OfflineEvent = {
  replicaId: string;
  occurredAt: string;
  status: string;
  reason: string | null;
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
 * current blue-green deployment; omitted (the SUBSCRIBE path resolves lineage in
 * SQL) it defaults to the row's own `clusterId`.
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

    const newBucket = {
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
    };

    if (buckets) {
      buckets.push(newBucket);
    } else {
      bucketsByReplicaId[replicaId] = [newBucket];
    }
  }

  return {
    minBucketStartMs,
    maxBucketEndMs,
    bucketsByReplicaId,
  };
}

/**
 * Shape `bucketsByReplicaId` into the chart's per-replica series plus the flat
 * offline-event list, clamping the axis to the data bounds. Shared by the
 * polling and SUBSCRIBE paths so both render identically.
 */
export function toReplicaUtilizationGraphData(
  data: {
    bucketsByReplicaId: Record<string, Bucket[]>;
    minBucketStartMs: number;
    maxBucketEndMs: number;
  },
  startDate: Date,
  endDate: Date,
) {
  const graphData = Object.entries(data.bucketsByReplicaId).map(
 
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

import { fetchClusterDeploymentLineage } from "./clusterDeploymentLineage";
import {
  attachOfflineEvents,
  bucketRowsToBucketsByReplicaId,
  rebucketUtilizationSamples,
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
  // Finer indexed-view tiers for shorter windows. "unbinned3h" reads the un-binned
  // 3h base and bins client-side; "overview24h" reads the 24h/5min binned view.
  // Unset (and `shouldUse...` false) falls back to the ad-hoc whole-fleet query.
  utilizationView?: "unbinned3h" | "overview24h";
};
// We have an equivalent query in `builtin.rs` in MaterializeInc/materialize.
// This query should be kept in sync with `mz_console_cluster_utilization_overview`.
export function buildReplicaUtilizationHistoryQuery({
  clusterIds,
  replicaId,
  startDate,
  endDate,
  bucketSizeMs,
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
      qb
        .selectFrom("replica_utilization_history_binned")
        .distinctOn(["bucket_start", "replica_id"])
        .select(["bucket_start", "replica_id", "heap_percent", "occurred_at"])
        .orderBy("bucket_start")
        .orderBy("replica_id")
        .orderBy((oeb) => sql`COALESCE(${oeb.ref("heap_bytes")}, 0)`, "desc"),
    )
    // For each (replica, bucket), take the (replica, bucket)
    // with the highest combined me
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

### Core Architecture Module: `console/src/api/materialize/query-history/statementLoggingMaxSampleRate.ts`
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

export const buildStatementLoggingMaxSampleRateQuery = () => {
  return sql<{
    statement_logging_max_sample_rate: string;
  }>`SHOW statement_logging_max_sample_rate`;
};

/**
 * Fetches the system-wide cap on the statement logging sample rate. The effective rate is
 * `min(session statement_logging_sample_rate, this)`, so a value of `0` means statement
 * logging is off for everyone and query history can never have rows.
 *
 * Returns `null` if the variable could not be read as a number.
 */
export default async function fetchStatementLoggingMaxSampleRate({
  queryKey,
  requestOptions,
}: {
  queryKey: QueryKey;
  requestOptions: RequestInit;
}) {
  const compiledQuery =
    buildStatementLoggingMaxSampleRateQuery().compile(queryBuilder);

  const response = await executeSqlV2({
    queries: compiledQuery,
    queryKey,
    requestOptions,
  });

  const rate = parseFloat(response.rows[0]?.statement_logging_max_sample_rate);

  return Number.isFinite(rate) ? rate : null;
}

```

### Core Architecture Module: `console/src/api/materialize/roles/roleUtils.ts`
```
// Copyright Materialize, Inc. and contributors. All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

export type RoleGrantError = {
  description: string;
  error: { errorMessage: string };
};

export type RoleGrantSuccess = {
  description: string;
};

export function getErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown error";
}

export function processResults<T>(
  results: PromiseSettledResult<unknown>[],
  items: T[],
  getDescription: (item: T) => string,
): {
  succeeded: RoleGrantSuccess[];
  failed: RoleGrantError[];
} {
  const succeeded: RoleGrantSuccess[] = [];
  const failed: RoleGrantError[] = [];

  results.forEach((result, i) => {
    const description = getDescription(items[i]);

    if (result.status === "fulfilled") {
      succeeded.push({ description });
    } else {
      failed.push({
        description,
        error: { errorMessage: getErrorMessage(result.reason) },
      });
    }
  });

  return { succeeded, failed };
}

```

### Core Architecture Module: `console/src/api/materialize/source/createKafkaSourceStatement.ts`
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

import {
  buildFullyQualifiedObjectName,
  escapedLiteral as lit,
} from "~/api/materialize";
import { Cluster } from "~/api/materialize/cluster/useConnectorClusters";
import { Connection } from "~/api/materialize/connection/useConnections";

export interface CreateKafkaSourceParameters {
  name: string;
  connection: Connection;
  databaseName: string;
  schemaName: string;
  cluster: Cluster;
  topic: string;
  keyFormat: KafkaFormat;
  valueFormat: KafkaFormat;
  formatConnection: Connection | null;
  envelope: KafkaEnvelope;
}

export const formatOptions = [
  { id: "avro" as const, name: "Avro" },
  { id: "protobuf" as const, name: "Protobuf" },
  { id: "json" as const, name: "JSON" },
  { id: "text" as const, name: "Text" },
  { id: "bytes" as const, name: "Bytes" },
];

export type KafkaFormat = (typeof formatOptions)[number]["id"];

export const ENVELOPE_OPTIONS = [
  { id: "none" as const, name: "None" },
  { id: "upsert" as const, name: "Upsert" },
  { id: "debezium" as const, name: "Debezium" },
];

export type KafkaEnvelope = (typeof ENVELOPE_OPTIONS)[number]["id"];

// Envelope options given by https://materialize.com/docs/sql/create-source/kafka/#supported-formats
export const ENVELOPE_OPTIONS_BY_FORMAT = {
  avro: ENVELOPE_OPTIONS,
  protobuf: [ENVELOPE_OPTIONS[0], ENVELOPE_OPTIONS[1]],
  json: [ENVELOPE_OPTIONS[0], ENVELOPE_OPTIONS[1]],
  text: [ENVELOPE_OPTIONS[0], ENVELOPE_OPTIONS[1]],
  bytes: [ENVELOPE_OPTIONS[0], ENVELOPE_OPTIONS[1]],
};

function createFormatSpecStatement(
  format: KafkaFormat,
  formatConnection: Connection | null,
) {
  let formatSpec = sql``;

  // These explicit checks are here to prevent sql inject, because formats comes from
  // user input and it's not quoted, so we can't easily escape it.
  if (!formatOptions.map((o) => o.id).includes(format)) {
    throw new Error(`Invalid format ${format} specified`);
  }
  if (format === "avro" || format === "protobuf") {
    if (!formatConnection) {
      throw new Error("Format must have a schema registry connection.");
    }
    formatSpec = sql` USING CONFLUENT SCHEMA REGISTRY CONNECTION ${buildFullyQualifiedObjectName(
      formatConnection,
    )}`;
  }

  return sql`FORMAT ${sql.raw(format.toUpperCase())}${formatSpec}`;
}

const createKafkaSourceStatement = (params: CreateKafkaSourceParameters) => {
  if (!params.cluster) {
    throw new Error("You must specify cluster");
  }

  const name = buildFullyQualifiedObjectName(params);
  const connectionName = buildFullyQualifiedObjectName(params.connection);

  return sql`
CREATE SOURCE ${name}
IN CLUSTER ${sql.id(params.cluster?.name)}
FROM KAFKA CONNECTION ${connectionName} (TOPIC ${lit(params.topic)})
KEY ${createFormatSpecStatement(params.keyFormat, params.formatConnection)}
VALUE ${createFormatSpecStatement(params.valueFormat, params.formatConnection)}
ENVELOPE ${sql.raw(params.envelope.toUpperCase())};`;
};

export default createKafkaSourceStatement;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39554** (2026-10-05): **adapter: Allow replication-factor changes during reconfiguration**
  *Symptoms*: Fixes https://linear.app/materializeinc/issue/SQL-753/graceful-reconfiguration-of-a-managed-cluster-from-replication-factor  Allow ALTER CLUSTER to change REPLICATION FACTOR during a graceful reconfiguration. Explicit changes update the pending target while preserving unspecified dimensions and, without WITH (WAIT ...), the existing deadline. RF-only changes can also carry WITH (WAIT ...): it updates the timeout and action during reconfiguration, and has no effect on standalone RF updates.  Operators can scale a stuck reconfiguration to zero or cancel it by restoring the original configuration, including when the cluster started at RF0. Target baseline credits are validated at ALTER time, without charging for temporary overlap. No controller changes are needed.  Extend cluster-controller testdrive coverage for RF-only increases and decreases, changes equal to the realized RF, RF-only forced cutover, credit limits, cancellation back to RF0, and RF0 finalization at the pending size. Sqllogictest covers standalone RF changes ignoring WAIT.  The cause of the original readiness stall remains undiagnosed. This change removes the RF restriction and cancellation trap.  Documentation: https://preview.materialize.com/materialize/39554/sql/alter-cluster/
  **Post-Mortem & Fix Analysis**:
  > Addressed the credit check and cleanup feedback. The reshape path now validates the target baseline using its pending size and RF, excluding temporary overlap. Cancellation still bypasses this check. Extended testdrive coverage for synchronous rejection, an exact-budget target despite live overlap, and cancellation after lowering credit limits. Removed the stale folding contract, shape terminology, and parallel-workload error ignore.  Leaving RF-only WITH (WAIT ...) out to keep this change scoped, as discussed with Aljoscha. CatalogCluster does not expose reconfiguration state to the planner. Supporting the conditional form would require extending that interface and handling a reconfiguration settling between planning and execution. Restating SIZE remains the supported way to steer the deadline.  Workspace Clippy passes with warnings denied. Rust/Python formatting and focused Python lint pass. SQL execution is still blocked by missing Docker Compose, and full formatting/lint checks sti
  > ## QA LLM Review  ### 1. MEDIUM -- New ALTER-time credit check blocks cost-reducing reshapes in an over-budget environment  `src/adapter/src/coord/sequencer/inner/cluster.rs:556`  The credit check added to `reshape_alter_cluster_managed` runs for every non-cancel target, including ones that cost less than the realized configuration. In an environment already above `max_credit_consumption_rate`, a downsize or credit-neutral reshape now fails at ALTER time. Before this PR, a forced cut-over (`ON TIMEOUT 'COMMIT'`) could still apply it, so operators lose the one graceful way to shrink a cluster under a lowered limit.  <details> <summary>Details</summary>  The check passes `others` (all user replicas except this cluster) as the current amount and `target.size × target.replication_factor` as the new amount. That amount is positive for any RF > 0, so the ALTER fails whenever `others + target > limit`, even when the target is smaller than the realized set.  The controller's own accounting is 
  > Implemented the simpler RF-only WAIT semantics after discussion with Aljoscha: WAIT updates the timeout/action when reconfiguration is active and is ignored for standalone RF updates. This supersedes my earlier decision to leave RF-only WAIT out. No planner catalog interface or new execution coordination was needed.  Added standalone zero-timeout ROLLBACK coverage in sqllogictest and changed the wedged-resize test to force cutover with an RF-only statement. Documented both behaviors.  Workspace Clippy passes with warnings denied, and Rust/Python formatting passed. The sqllogictest build was killed with exit 137 before tests executed. Testdrive remains blocked by missing Docker Compose. Full formatting/lint still lack buf and shellcheck, and the docs preview could not run without Hugo.

- **Issue #39551** (2026-10-05): **secrets-cli: move secrets reader loading to mz-secrets-loader**
  *Symptoms*: `mz-controller` only needs `SecretsReaderCliArgs` and `to_flags()` to pass secrets flags to replicas, but `mz-secrets-cli` also built the reader and so pulled in `mz-orchestrator-kubernetes`, `mz-aws-secrets-controller` and `mz-orchestrator-process`. This moves `load()` into a new `mz-secrets-loader` crate as a free function, leaving `mz-secrets-cli` with only the clap args and a single `clap` dependency. `clusterd` and `catalog-debug`, the two callers of `load()`, now depend on `mz-secrets-loader`. The controller no longer reaches any of the three secrets backends, so changes to them no longer rebuild the controller or crates that reached them only through it.  Found by `bin/crate-cuts` (#39447).  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thanks for the review!

- **Issue #39549** (2026-10-05): **build: pin jemalloc's page size to 4 KiB on aarch64 Linux**
  *Symptoms*: ## Summary  Pin jemalloc's allocator page to 4 KiB for `aarch64-unknown-linux-gnu` builds by setting `AARCH64_UNKNOWN_LINUX_GNU_JEMALLOC_SYS_WITH_LG_PAGE = "12"` in `.cargo/config.toml`.  [#39339](https://github.com/MaterializeInc/materialize/pull/39339) bumped tikv-jemalloc-sys from 0.6.1 (jemalloc 5.3.0) to 0.7.1 (jemalloc 5.3.1). jemalloc 5.3.1 changed its default allocator page on aarch64 Linux from the build host's page to 64 KiB ([facebook/jemalloc#34](https://github.com/facebook/jemalloc/pull/34)). Neither #39339 nor the tikv-jemallocator [0.7.0 release notes](https://github.com/tikv/jemallocator/releases/tag/0.7.0) mention it, and I found no discussion of it in code, issues or Slack.  @antiguru confirmed on this PR that the move to 64 KiB was [not a deliberate choice](https://github.com/MaterializeInc/materialize/pull/39549#issuecomment-5988777173). Every production and staging environmentd and clusterd pod runs on arm64 nodes, so rc.3 runs with a 64 KiB allocator page on 4 KiB-page kernels.  The effect is a step in `jemalloc_active` minus `jemalloc_allocated` in every Materialize process. This PR restores the 4 KiB page that v26.44.0 and earlier had on aarch64, and keeps everything else in jemalloc 5.3.1.  ## What was observed  The v26.45.0-rc.3 sign-off sweeps on staging and the production canaries flagged `jemalloc_active` rising while `jemalloc_allocated` stayed flat or fell, from process start, in environmentd and clusterd:  - environmentd on the us-east-1 canari
  **Post-Mortem & Fix Analysis**:
  > Moving to 64kb page size was not a deliberate choice. It might be interesting for compute workloads, but our kernel currently only supports 4kb pages, so we still have to pay the kernel overhead, even if the allocator works in larger pages. This change wasn't obvious from the changelog, kudos to you for spotting it.

- **Issue #39546** (2026-10-05): **build(deps-dev): bump pg from 8.23.0 to 8.23.1 in /test/lang/js**
  *Symptoms*: Bumps [pg](https://github.com/brianc/node-postgres/tree/HEAD/packages/pg) from 8.23.0 to 8.23.1. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md">pg's changelog</a>.</em></p> <blockquote> <p>All major and minor releases are briefly explained below.</p> <p>For richer information consult the commit log on github with referenced pull requests.</p> <p>We do not include break-fix version release in this file.</p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/brianc/node-postgres/commit/0980cefebe0ae461da8883703be049fe13ca96cf"><code>0980cef</code></a> Publish</li> <li><a href="https://github.com/brianc/node-postgres/commit/2759b2ccf70535d425688dca8a6aec79de49c1ea"><code>2759b2c</code></a> fix(pg): run a named statement with an empty text more than once (<a href="https://github.com/brianc/node-postgres/tree/HEAD/packages/pg/issues/3781">#3781</a>)</li> <li><a href="https://github.com/brianc/node-postgres/commit/7feb7dfd70a9f7e5718ab186c80d2658067ce4af"><code>7feb7df</code></a> fix(pg): expose detail and hint on errors from the native client (<a href="https://github.com/brianc/node-postgres/tree/HEAD/packages/pg/issues/3780">#3780</a>)</li> <li><a href="https://github.com/brianc/node-postgres/commit/9683053c1eac7f4a1f8910df0d7abdb5f0cb25a7"><code>9683053</code></a> fix(pg): do not treat Sync as connection ending (<a href="https://github.com/brianc

- **Issue #39545** (2026-10-05): **build(deps): bump aws-sdk-s3 from 1.150.0 to 1.151.0**
  *Symptoms*: Bumps [aws-sdk-s3](https://github.com/awslabs/aws-sdk-rust) from 1.150.0 to 1.151.0. <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/awslabs/aws-sdk-rust/commits">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=aws-sdk-s3&package-manager=cargo&previous-version=1.150.0&new-version=1.151.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for t

- **Issue #39544** (2026-10-05): **build(deps): bump aws-smithy-runtime-api from 1.18.0 to 1.19.0**
  *Symptoms*: Bumps [aws-smithy-runtime-api](https://github.com/smithy-lang/smithy-rs) from 1.18.0 to 1.19.0. <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/smithy-lang/smithy-rs/commits">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=aws-smithy-runtime-api&package-manager=cargo&previous-version=1.18.0&new-version=1.19.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this minor version` will close this PR and stop Dependabot c

- **Issue #39541** (2026-10-05): **build(deps): bump rustls-platform-verifier from 0.7.0 to 0.7.1 in the simple2 group across 1 directory**
  *Symptoms*: Bumps the simple2 group with 1 update in the / directory: [rustls-platform-verifier](https://github.com/rustls/rustls-platform-verifier).  Updates `rustls-platform-verifier` from 0.7.0 to 0.7.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/rustls/rustls-platform-verifier/releases">rustls-platform-verifier's releases</a>.</em></p> <blockquote> <h2>0.7.1</h2> <h2>About</h2> <p>This version contains Windows and Android bugfixes, but its headline feature is a migration to an improved distribution strategy for the Android component of the crate, which must be included by Gradle for Android application/library builds. If you don't build for Android, no need to worry these changes don't affect you. But if you do, please continue reading to understand the required migration steps and benefits. <code>0.7.1</code> requires the Android migration to be performed once manually.</p> <h2>Android Revocation</h2> <p>The biggest improvement to functionality in this release is proper support for revocation on Android. As OCSP moves to deprecation, more CAs are exclusively using CRLs to distribute revocation data. Previously this failed to work on Android without workarounds since by default the network fetches for this were blocked. As of <code>0.2.0</code> of <code>rustls-platform-verifier-android</code>, this works again as expected. We now bundle an Android App manifest with the library, which Android Studio merges into the main manifest of the ap

- **Issue #39540** (2026-10-05): **build(deps): bump the simple group across 1 directory with 5 updates**
  *Symptoms*: Bumps the simple group with 5 updates in the /console directory:  | Package | From | To | | --- | --- | --- | | [@materializeinc/sql-lexer](https://github.com/MaterializeInc/materialize) | `26.43.0` | `26.44.1` | | [@materializeinc/sql-pretty](https://github.com/MaterializeInc/materialize) | `26.43.0` | `26.44.1` | | [@types/jsonwebtoken](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/jsonwebtoken) | `9.0.7` | `9.0.10` | | [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | `5.11.1` | `5.11.2` | | [pg](https://github.com/brianc/node-postgres/tree/HEAD/packages/pg) | `8.23.0` | `8.23.1` |   Updates `@materializeinc/sql-lexer` from 26.43.0 to 26.44.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/MaterializeInc/materialize/releases">@​materializeinc/sql-lexer's releases</a>.</em></p> <blockquote> <h2>v26.44.1</h2> <p>See the <a href="https://materialize.com/docs/releases/#v26441">release notes</a> for what changed in this release.</p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/MaterializeInc/materialize/commit/b1687ca00df84d295fc479ee099c5a554aeb7338"><code>b1687ca</code></a> release: bump to version v26.44.1</li> <li><a href="https://github.com/MaterializeInc/materialize/commit/341649d7c03578291e842958fc96ea287f0a35ae"><code>341649d</code></a> balancerd: build the upstream TLS connector once instead of per connection (#...</li> <li><a 

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

### Incident Patch 1: `625898ed` (2026-10-05)
**Commit Message**: lint-cargo: accept a workspace root, require workspace dependencies (#39511)

### Motivation

Cloud adopted `[workspace.dependencies]` in MaterializeInc/cloud#13568
and currently carries its own copy of `check_workspace_dependencies`.
Review asked to reuse the Materialize lint directly, the way cloud
already runs `gen-lints` from the submodule. `lint-cargo` always checks
`MZ_ROOT` and runs every lint, including the cargo-fuzz ones that only
apply here.

The lint also only flagged inline versions for crates already in
`[workspace.dependencies]`, so a new external dependency could still be
added inline.

### Description

Add `--root` to check another Cargo workspace and `--lint` (repeatable)
to run a subset of the lints. `Workspace` now records its root, and the
fuzz lints read paths from it instead of `MZ_ROOT`. Without arguments,
the script runs the same lints as before.

`check_workspace_dependencies` now flags every dependency that is
neither a path dependency nor declared with `workspace = true`,
including target-specific tables, which it previously skipped. The
remaining inline dependencies, `hyper-tls`, `core_affinity`, and
`security-framework`, move to `[workspace.dependencie

**File**: `Cargo.toml` (modified, +3/-0)
```diff
@@ -332,6 +332,7 @@ columnation = "0.1.2"
 compact_bytes = "0.2.1"
 compile-time-run = "0.2.12"
 console-subscriber = "0.5.0"
+core_affinity = "0.8.3"
 crc32fast = "1.5.0"
 criterion = { version = "0.8.2", features = ["async_tokio", "html_reports"] }
 crossbeam = "0.8.4"
@@ -383,6 +384,7 @@ httparse = "1.8.0"
 humantime = "2.4.0"
 hyper = { version = "1.11.1", features = ["http1", "server"] }
 hyper-openssl = { version = "0.10.2", features = ["client-legacy", "tokio"] }
+hyper-tls = "0.6.0"
 hyper-util = "0.1.20"
 iceberg = "0.10.1"
 iceberg-catalog-rest = "0.10.1"
@@ -491,6 +493,7 @@ ryu = "1.0.23"
 schemars = { version = "1.2.1", features = ["uuid1"] }
 scopeguard = "1.2.0"
 seahash = "4.1.0"
+security-framework = "3.7.0"
 segment = { version = "0.2.6", default-features = false, features = ["native-tls-vendored"] }
 semver = "1.0.28"
 sentry = { version = "0.49.1", default-features = false, features = ["backtrace", "contexts", "debug-images", "reqwest", "rustls"] }
```

**File**: `misc/python/materialize/cargo.py` (modified, +13/-0)
```diff
@@ -43,6 +43,9 @@ class Crate:
         path_dev_dependencies: The dev dependencies which are declared using
             paths.
         path_dependencies: The dependencies which are declared using paths.
+        non_workspace_deps: The dependencies which are declared neither using
+            paths nor with `workspace = true`, including target-specific ones,
+            mapped to the sections that declare them.
         rust_version: The minimum Rust version declared in the crate, if any.
         bins: The names of all binaries in the crate.
         examples: The names of all examples in the crate.
@@ -76,6 +79,14 @@ def __init__(self, root: Path, path: Path):
                         pass
                     else:
                         self.non_workspace_deps.setdefault(name, []).append(dep_type)
+        for target, target_config in config.get("target", {}).items():
+            for dep_type in ("build-dependencies", "dev-dependencies", "dependencies"):
+                for name, c in target_config.get(dep_type, {}).items():
+                    if isinstance(c, dict) and ("path" in c or c.get("workspace")):
+                        continue
+                    self.non_workspace_deps.setdefault(name, []).append(
+                        f"target.'{target}'.{dep_type}"
+                    )
         self.rust_version: str | None = None
         try:
             self.rust_version = str(config["package"]["rust-version"])
@@ -142,10 +153,12 @@ class Workspace:
         root: The path to the root of the workspace.
 
     Attributes:
+        root: The path to the root of the workspace.
         crates: A mapping from name to crate definition.
     """
 
     def __init__(self, root: Path):
+        self.root = root
         with open(root / "Cargo.toml") as f:
             config = toml.load(f)
 
```

**File**: `misc/python/materialize/cli/lint-cargo.py` (modified, +46/-22)
```diff
@@ -9,8 +9,11 @@
 
 """Check our set of Cargo.toml files for issues"""
 
+import argparse
 import os
 import sys
+from collections.abc import Callable
+from pathlib import Path
 from pprint import pprint
 
 import toml
@@ -66,23 +69,24 @@ def check_default_members(workspace: Workspace) -> bool:
 
 
 def check_workspace_dependencies(workspace: Workspace) -> bool:
-    """Checks that crates use workspace dependencies instead of specifying
-    versions inline when a workspace dependency is available."""
+    """Checks that crates declare every dependency that is not a path
+    dependency with `workspace = true`, so that its version and source live in
+    the root `[workspace.dependencies]`."""
 
     success = True
     for name, crate in sorted(workspace.crates.items()):
         for dep, dep_types in crate.non_workspace_deps.items():
-            if dep in workspace.workspace_dependencies:
-                print(
-                    f"{name}: {dep} should use `workspace = true` "
-                    f"(found in {', '.join(dep_types)})",
-                    file=sys.stderr,
-                )
-                success = False
+            print(
+                f"{name}: {dep} should use `workspace = true` "
+                f"(found in {', '.join(dep_types)})",
+                file=sys.stderr,
+            )
+            success = False
     if not success:
         print(
-            '\nhint: replace `dep = "version"` with `dep.workspace = true` '
-            "or `dep = { workspace = true, ... }` for the above dependencies",
+            "\nhint: declare the above dependencies in `[workspace.dependencies]` "
+            'of the root Cargo.toml if missing, and replace `dep = "version"` '
+            "with `dep.workspace = true` or `dep = { workspace = true, ... }`",
             file=sys.stderr,
         )
     return success
@@ -115,7 +119,7 @@ def version_req(spec: object) -> str | None:
         for name, spec in workspace.workspace_dependencies.items()
     }
 
-    fuzz_workspace = MZ_ROOT / "test" / "cargo-fuzz"
+    fuzz_workspace = workspace.root / "test" / "cargo-fuzz"
     with open(fuzz_workspace / "Cargo.toml") as f:
         members = toml.load(f)["workspace"]["members"]
 
@@ -160,9 +164,9 @@ def check_fuzz_patches_mirror_root(workspace: Workspace) -> bool:
     # would warn that they are unused, so the fuzz workspace leaves them out.
     OMITTED = {"duckdb", "postgres_array"}
 
-    with open(MZ_ROOT / "Cargo.toml") as f:
+    with open(workspace.root / "Cargo.toml") as f:
         root_patches = toml.load(f).get("patch", {}).get("crates-io", {})
-    with open(MZ_ROOT / "test" / "cargo-fuzz" / "Cargo.toml") as f:
+    with open(workspace.root / "test" / "cargo-fuzz" / "Cargo.toml") as f:
         fuzz_patches = toml.load(f).get("patch", {}).get("crates-io", {})
 
     success = True
@@ -199,15 +203,35 @@ def check_fuzz_patches_mirror_root(workspace: Workspace) -> bool:
     return success
 
 
+LINTS: dict[str, Callable[[Workspace], bool]] = {
+    "rust-versions": check_rust_versions,
+    "default-members": check_default_members,
+    "workspace-dependencies": check_workspace_dependencies,
+    "fuzz-versions-mirror-root": check_fuzz_versions_mirror_root,
+    "fuzz-patches-mirror-root": check_fuzz_patches_mirror_root,
+}
+
+
 def main() -> None:
-    workspace = Workspace(MZ_ROOT)
-    lints = [
-        check_rust_versions,
-        check_default_members,
-        check_workspace_dependencies,
-        check_fuzz_versions_mirror_root,
-        check_fuzz_patches_mirror_root,
-    ]
+    parser = argparse.ArgumentParser(
+        prog="lint-cargo", description="Check Cargo.toml files for issues."
+    )
+    parser.add_argument(
+        "--root",
+        type=Path,
+        default=MZ_ROOT,
+        help="root of the Cargo workspace to check (default: the Materialize repository)",
+    )
+    parser.add_argument(
+        "--lint",
+        action="append",
+        choices=LINTS.keys(),
+        help="run only this lint; repeat to run several (default: all)",
+    )
+    args = parser.parse_args()
+
+    workspace = Workspace(args.root)
+    lints = [LINTS[name] for name in args.lint or LINTS]
     # Run every lint, then combine. `success and lint(...)` would short-circuit
     # and skip the remaining lints after the first failure, under-reporting.
     success = all([lint(workspace) for lint in lints])
```

**File**: `src/compute/Cargo.toml` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ tracing.workspace = true
 uuid = { workspace = true, features = ["serde", "v4"] }
 
 [target.'cfg(not(target_os = "macos"))'.dependencies]
-core_affinity = "0.8.3"
+core_affinity.workspace = true
 
 [dev-dependencies]
 criterion.workspace = true
```

**File**: `src/environmentd/Cargo.toml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ http-body-util.workspace = true
 humantime.workspace = true
 hyper.workspace = true
 hyper-openssl.workspace = true
-hyper-tls = "0.6.0"
+hyper-tls.workspace = true
 hyper-util.workspace = true
 include_dir.workspace = true
 ipnet.workspace = true
```

**File**: `src/mz/Cargo.toml` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ assert_cmd.workspace = true
 tempfile.workspace = true
 
 [target.'cfg(target_os = "macos")'.dependencies]
-security-framework = "3.7.0"
+security-framework.workspace = true
 
 [package.metadata.deb]
 name = "materialize-cli"
```

**File**: `src/ore/Cargo.toml` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ tracing-opentelemetry = { workspace = true, optional = true }
 tonic = { workspace = true, optional = true }
 tokio-native-tls = { workspace = true, optional = true }
 native-tls = { workspace = true, optional = true }
-hyper-tls = { version = "0.6.0", optional = true }
+hyper-tls = { workspace = true, optional = true }
 hyper-util = { workspace = true, optional = true }
 opentelemetry = { workspace = true, optional = true }
 opentelemetry-otlp = { workspace = true, optional = true }
```

---

### Incident Patch 2: `0d7375c8` (2026-10-05)
**Commit Message**: build(deps-dev): bump the typescript-and-eslint group across 1 directory with 3 updates (#39536)

Bumps the typescript-and-eslint group with 3 updates in the /console
directory:
[@tanstack/eslint-plugin-query](https://github.com/TanStack/query/tree/HEAD/packages/eslint-plugin-query),
[globals](https://github.com/sindresorhus/globals) and
[typescript-eslint](https://github.com/typescript-eslint/typescript-eslint/tree/HEAD/packages/typescript-eslint).

Updates `@tanstack/eslint-plugin-query` from 5.103.2 to 5.104.0
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/TanStack/query/releases">@​tanstack/eslint-plugin-query's
releases</a>.</em></p>
<blockquote>
<h2><code>@​tanstack/eslint-plugin-query</code><a
href="https://github.com/5"><code>@​5</code></a>.104.0</h2>
<h3>Minor Changes</h3>
<ul>
<li><a
href="https://redirect.github.com/TanStack/query/pull/11650">#11650</a>
<a
href="https://github.com/TanStack/query/commit/5279b05211223dd719803ca22a9d1fa46c98638e"><code>5279b05</code></a>
- Build projects with Vite 8</li>
</ul>
<h2><code>@​tanstack/eslint-plugin-query</code><a
href="https://github.com/5"><code>@​5</code></a>.103.3</h2>
<p>No change

**File**: `console/package.json` (modified, +3/-3)
```diff
@@ -132,7 +132,7 @@
     "@sentry/vite-plugin": "^5.4.0",
     "@storybook/react-vite": "^10",
     "@svgr/babel-plugin-transform-svg-component": "^8.0.0",
-    "@tanstack/eslint-plugin-query": "^5.103.2",
+    "@tanstack/eslint-plugin-query": "^5.104.0",
     "@testing-library/dom": "^10.4.2",
     "@testing-library/jest-dom": "^6.9.1",
     "@testing-library/react": "^16.3.3",
@@ -166,7 +166,7 @@
     "eslint-plugin-simple-import-sort": "^14.0.0",
     "eslint-plugin-unicorn": "^76.0.0",
     "fast-xml-parser": "^5.11.2",
-    "globals": "^17.12.0",
+    "globals": "^17.13.0",
     "intersection-observer": "^0.12.2",
     "jotai-devtools": "^0.10.1",
     "jsdom": "^29.1.1",
@@ -185,7 +185,7 @@
     "storybook": "^10",
     "terser": "^5.51.2",
     "tsx": "^4.23.15",
-    "typescript-eslint": "^8.70.1",
+    "typescript-eslint": "^8.71.0",
     "typescript-eslint-language-service": "^5.0.5",
     "vite": "^8.3.1",
     "vite-bundle-analyzer": "^1.3.9",
```

**File**: `console/yarn.lock` (modified, +88/-81)
```diff
@@ -4686,18 +4686,18 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@tanstack/eslint-plugin-query@npm:^5.103.2":
-  version: 5.103.2
-  resolution: "@tanstack/eslint-plugin-query@npm:5.103.2"
+"@tanstack/eslint-plugin-query@npm:^5.104.0":
+  version: 5.104.0
+  resolution: "@tanstack/eslint-plugin-query@npm:5.104.0"
   dependencies:
-    "@typescript-eslint/utils": "npm:^8.58.1"
+    "@typescript-eslint/utils": "npm:^8.70.1"
   peerDependencies:
     eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
     typescript: ^5.6.0 || ^6.0.0 || ^7.0.0
   peerDependenciesMeta:
     typescript:
       optional: true
-  checksum: 10c0/df07fac8dbb4ff4925682ae228af45167d2ec3d14ecee2104ce2fb5bb2571c5341c4bf66fc075ca4e55e2e67bc5e6b326ae20260f32465b415f56f3621e4935f
+  checksum: 10c0/df1bcaa7654b628887ac6fff42cc9ea3507027f281173b9b0d06cb29c0fea24729ac91f1a134882ee89d151443b20ce3665af3a18666dd3dce6704e88737b1dc
   languageName: node
   linkType: hard
 
@@ -5708,138 +5708,138 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@typescript-eslint/eslint-plugin@npm:8.70.1":
-  version: 8.70.1
-  resolution: "@typescript-eslint/eslint-plugin@npm:8.70.1"
+"@typescript-eslint/eslint-plugin@npm:8.71.0":
+  version: 8.71.0
+  resolution: "@typescript-eslint/eslint-plugin@npm:8.71.0"
   dependencies:
     "@eslint-community/regexpp": "npm:^4.12.2"
-    "@typescript-eslint/scope-manager": "npm:8.70.1"
-    "@typescript-eslint/type-utils": "npm:8.70.1"
-    "@typescript-eslint/utils": "npm:8.70.1"
-    "@typescript-eslint/visitor-keys": "npm:8.70.1"
+    "@typescript-eslint/scope-manager": "npm:8.71.0"
+    "@typescript-eslint/type-utils": "npm:8.71.0"
+    "@typescript-eslint/utils": "npm:8.71.0"
+    "@typescript-eslint/visitor-keys": "npm:8.71.0"
     ignore: "npm:^7.0.5"
     natural-compare: "npm:^1.4.0"
     ts-api-utils: "npm:^2.5.0"
   peerDependencies:
-    "@typescript-eslint/parser": ^8.70.1
+    "@typescript-eslint/parser": ^8.71.0
     eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
     typescript: ">=4.8.4 <6.1.0"
-  checksum: 10c0/6d703bd93dd65ad8bea35dfc7d79a69c0ecbcb7725e289028446673978fc2064993e1c6479dc70c06e1b776cea1a79fce17092cca337183cdd9f93c44f79f27a
+  checksum: 10c0/cd93b29b572c002a45c335e1eff02522c05c25ec96ce7a88be1e42866e13ac73cf53c4f03b5aad2e6355b32004a4b57ce132a185232719bc38b906a6c38d2b74
   languageName: node
   linkType: hard
 
-"@typescript-eslint/parser@npm:8.70.1":
-  version: 8.70.1
-  resolution: "@typescript-eslint/parser@npm:8.70.1"
+"@typescript-eslint/parser@npm:8.71.0":
+  version: 8.71.0
+  resolution: "@typescript-eslint/parser@npm:8.71.0"
   dependencies:
-    "@typescript-eslint/scope-manager": "npm:8.70.1"
-    "@typescript-eslint/types": "npm:8.70.1"
-    "@typescript-eslint/typescript-estree": "npm:8.70.1"
-    "@typescript-eslint/visitor-keys": "npm:8.70.1"
+    "@typescript-eslint/scope-manager": "npm:8.71.0"
+    "@typescript-eslint/types": "npm:8.71.0"
+    "@typescript-eslint/typescript-estree": "npm:8.71.0"
+    "@typescript-eslint/visitor-keys": "npm:8.71.0"
     debug: "npm:^4.4.3"
   peerDependencies:
     eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
     typescript: ">=4.8.4 <6.1.0"
-  checksum: 10c0/892025824f25e64ced093dc25a4ae1b6a03b1cdf8bbb00637914bd4fd640887bdc3fcf585f2eadb260677d329690c7e837aedc3680d5532f8277fd30e451bc30
+  checksum: 10c0/d83a47bfe23642365950863f3e1b2ec2fc7c31bd695f4692b49d10f35db68f7fe9762784102b712d17da5beb9a27d286013eede60ecc6540ee41d21fed3e2a10
   languageName: node
   linkType: hard
 
-"@typescript-eslint/project-service@npm:8.70.1":
-  version: 8.70.1
-  resolution: "@typescript-eslint/project-service@npm:8.70.1"
+"@typescript-eslint/project-service@npm:8.71.0":
+  version: 8.71.0
+  resolution: "@typescript-eslint/project-service@npm:8.71.0"
   dependencies:
-    "@typescript-eslint/tsconfig-utils": "npm:^8.70.1"
-    "@typescript-eslint/types": "npm:^8.70.1"
+    "@typescript-eslint/tsconfig-utils": "npm:^8.71.0"
+    "@typescript-eslint/types": "npm:^8.71.0"
     debug: "npm:^4.4.3"
   peerDependencies:
     typescript: ">=4.8.4 <6.1.0"
-  checksum: 10c0/3f168d3dd18fd63718e0758c6e4f28741640c2dc38f18a46c9f2276bdc8a6e0927bfcd1f0cf40e01b6c2e3c2eac179ff6ed916c5ad539e284fb66511066e1425
+  checksum: 10c0/6d8eef9287393b807bb6b7f3f29c44540c9722650155aa0ee8eec1c466bc7c7831353a2db3fd4ba843da34c3db26fd495b80a1809a7e053b22e4e094a8189e6c
   languageName: node
   linkType: hard
 
-"@typescript-eslint/scope-manager@npm:8.70.1":
-  version: 8.70.1
-  resolution: "@typescript-eslint/scope-manager@npm:8.70.1"
+"@typescript-eslint/scope-manager@npm:8.71.0":
+  version: 8.71.0
+  resolution: "@typescript-eslint/scope-manager@npm:8.71.0"
   dependencies:
-    "@typescript-eslint/types": "npm:8.70.1"
-    "@typescript-eslint/visitor-keys": "npm:8.70.1"
-  checksum: 10c0/979ef0a6119ffd7045dc0e7e14c9e9a12c135a83554962ff4b33acab7bfdabda3631e8c6818ef5fc6c9b1d21d381f61e593a1bd8c92019333926447a27aaca21
+    "@typescript-eslint/types": "npm:8.71.0"
+    "@typescript-eslint/visitor-keys": 
```

---

### Incident Patch 3: `e9b70134` (2026-10-05)
**Commit Message**: build(deps): bump aws-sdk-s3 from 1.150.0 to 1.151.0 (#39545)

Bumps [aws-sdk-s3](https://github.com/awslabs/aws-sdk-rust) from 1.150.0
to 1.151.0.
<details>
<summary>Commits</summary>
<ul>
<li>See full diff in <a
href="https://github.com/awslabs/aws-sdk-rust/commits">compare
view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility
score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=aws-sdk-s3&package-manager=cargo&previous-version=1.150.0&new-version=1.151.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

Dependabot will resolve any conflicts with this PR as long as you don't
alter it yourself. You can also trigger a rebase manually by commenting
`@dependabot rebase`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:
- `@dependabot rebase` will rebase this PR
- `@dependabot recreate` will recreate this PR, overwriting any edits
that have been made to it
- `@dependabot show <dependency name> ig

**File**: `Cargo.lock` (modified, +3/-3)
```diff
@@ -998,9 +998,9 @@ dependencies = [
 
 [[package]]
 name = "aws-sdk-s3"
-version = "1.150.0"
+version = "1.151.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2fecaa77c862fa1e9d636d54fa06e0049a19a4f071b0d72ea1b9086887d09359"
+checksum = "c82d4b41fe41bfca3c9e1de55645d9a525868ef5ce5e14cee9499ccaf1fc7225"
 dependencies = [
  "arc-swap",
  "aws-credential-types",
@@ -13215,7 +13215,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd"
 dependencies = [
  "fastrand",
- "getrandom 0.4.3",
+ "getrandom 0.3.3",
  "once_cell",
  "rustix 1.1.4",
  "windows-sys 0.59.0",
```

---

### Incident Patch 4: `6c5f4074` (2026-10-05)
**Commit Message**: build(deps): bump distroless/cc-debian13 from `f525a9a` to `984d31d` in /misc/images/distroless-prod-base (#39491)

> [!WARNING]
> Cooldown could not be applied because no publication date was
available from the registry.
>

Bumps distroless/cc-debian13 from `f525a9a` to `984d31d`.


[![Dependabot compatibility
score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=distroless/cc-debian13&package-manager=docker&previous-version=debug-nonroot&new-version=debug-nonroot)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

Dependabot will resolve any conflicts with this PR as long as you don't
alter it yourself. You can also trigger a rebase manually by commenting
`@dependabot rebase`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:
- `@dependabot rebase` will rebase this PR
- `@dependabot recreate` will recreate this PR, overwriting any edits
that have been made to it
- `@dependabot show <dependency name> ignore co

**File**: `misc/images/distroless-prod-base/Dockerfile` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ RUN groupadd --system --gid=999 materialize \
 # `debug-nonroot` adds a busybox shell (`/busybox/sh`), kept intentionally so
 # entrypoint.sh and `kubectl exec` keep working. A later step can drop to the
 # shell-less variant. The digest pin is bumped by dependabot.
-FROM gcr.io/distroless/cc-debian13:debug-nonroot@sha256:f525a9a37aed3e8a848f46cfe055999782d66ed797e9e2886928c8caaaa4fc52
+FROM gcr.io/distroless/cc-debian13:debug-nonroot@sha256:984d31d4bd6e71bb9469353d93e73c68f7b3c17142b2aec45f2a960489095b22
 
 # Ensure any Rust binaries that crash print a backtrace.
 ENV RUST_BACKTRACE=1
```

---

### Incident Patch 5: `1329ec61` (2026-10-05)
**Commit Message**: build(deps): bump the terraform group across 5 directories with 21 updates (#39490)

Bumps the terraform group with 17 updates in the
/test/terraform/aws-persistent directory:

| Package | From | To |
| --- | --- | --- |
|
[aws_lbc::materialize-terraform-self-managed](https://github.com/MaterializeInc/materialize-terraform-self-managed)
| `13.12.1` | `14.0.0` |
|
[base_node_group::materialize-terraform-self-managed](https://github.com/MaterializeInc/materialize-terraform-self-managed)
| `13.12.1` | `14.0.0` |
|
[cert_manager::materialize-terraform-self-managed](https://github.com/MaterializeInc/materialize-terraform-self-managed)
| `13.12.1` | `14.0.0` |
|
[coredns::materialize-terraform-self-managed](https://github.com/MaterializeInc/materialize-terraform-self-managed)
| `13.12.1` | `14.0.0` |
|
[database::materialize-terraform-self-managed](https://github.com/MaterializeInc/materialize-terraform-self-managed)
| `13.12.1` | `14.0.0` |
|
[ec2nodeclass_generic::materialize-terraform-self-managed](https://github.com/MaterializeInc/materialize-terraform-self-managed)
| `13.12.1` | `14.0.0` |
|
[ec2nodeclass_materialize::materialize-terraform-self-managed](https://github.com/Materializ

**File**: `test/terraform/aws-persistent/main.tf` (modified, +17/-17)
```diff
@@ -15,7 +15,7 @@ resource "random_password" "db_password" {
 
 # 1. Create network infrastructure
 module "networking" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/networking?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/networking?ref=v14.0.0"
 
   name_prefix          = var.name_prefix
   vpc_cidr             = "10.0.0.0/16"
@@ -28,7 +28,7 @@ module "networking" {
 
 # 2. Create EKS cluster
 module "eks" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks?ref=v14.0.0"
 
   name_prefix                              = var.name_prefix
   cluster_version                          = "1.32"
@@ -50,7 +50,7 @@ module "eks" {
 # nodes cannot become Ready without one, so it must be installed before any
 # node group.
 module "vpc_cni" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/vpc-cni?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/vpc-cni?ref=v14.0.0"
 
   name_prefix       = var.name_prefix
   oidc_provider_arn = module.eks.oidc_provider_arn
@@ -74,7 +74,7 @@ module "vpc_cni" {
 }
 
 module "base_node_group" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks-node-group?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks-node-group?ref=v14.0.0"
 
   cluster_name                      = module.eks.cluster_name
   aws_region                        = var.aws_region
@@ -102,7 +102,7 @@ module "base_node_group" {
 # v21 clusters do not bootstrap CoreDNS either, so the deployment, its service
 # account and the kube-dns Service are created here.
 module "coredns" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/coredns?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/coredns?ref=v14.0.0"
 
   node_selector                      = local.base_node_labels
   disable_default_coredns_autoscaler = false
@@ -121,7 +121,7 @@ module "coredns" {
 }
 
 module "karpenter" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter?ref=v14.0.0"
 
   name_prefix             = var.name_prefix
   cluster_name            = module.eks.cluster_name
@@ -140,7 +140,7 @@ module "karpenter" {
 
 # Create a generic nodeclass and nodepool for system workloads
 module "ec2nodeclass_generic" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v14.0.0"
 
   name               = local.nodeclass_name_generic
   ami_selector_terms = local.ami_selector_terms
@@ -158,7 +158,7 @@ module "ec2nodeclass_generic" {
 }
 
 module "nodepool_generic" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v14.0.0"
 
   name            = local.nodeclass_name_generic
   nodeclass_name  = local.nodeclass_name_generic
@@ -175,7 +175,7 @@ module "nodepool_generic" {
 
 # Create a dedicated nodeclass and nodepool for Materialize pods
 module "ec2nodeclass_materialize" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v14.0.0"
 
   name               = local.nodeclass_name_materialize
   ami_selector_terms = local.ami_selector_terms
@@ -192,7 +192,7 @@ module "ec2nodeclass_materialize" {
 }
 
 module "nodepool_materialize" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v14.0.0"
 
   name            = local.nodeclass_name_materialize
   nodeclass_name  = local.nodeclass_name_materialize
@@ -210,7 +210,7 @@ module "nodepool_materialize" {
 
 # 3. Install AWS Load Balancer Controller
 module "aws_lbc" {
-  source = "git::https://githu
```

**File**: `test/terraform/aws-temporary/main.tf` (modified, +17/-17)
```diff
@@ -15,7 +15,7 @@ resource "random_password" "db_password" {
 
 # 1. Create network infrastructure
 module "networking" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/networking?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/networking?ref=v14.0.0"
 
   name_prefix          = var.name_prefix
   vpc_cidr             = "10.0.0.0/16"
@@ -28,7 +28,7 @@ module "networking" {
 
 # 2. Create EKS cluster
 module "eks" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks?ref=v14.0.0"
 
   name_prefix                              = var.name_prefix
   cluster_version                          = "1.34"
@@ -50,7 +50,7 @@ module "eks" {
 # nodes cannot become Ready without one, so it must be installed before any
 # node group.
 module "vpc_cni" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/vpc-cni?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/vpc-cni?ref=v14.0.0"
 
   name_prefix       = var.name_prefix
   oidc_provider_arn = module.eks.oidc_provider_arn
@@ -74,7 +74,7 @@ module "vpc_cni" {
 }
 
 module "base_node_group" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks-node-group?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks-node-group?ref=v14.0.0"
 
   cluster_name                      = module.eks.cluster_name
   aws_region                        = var.aws_region
@@ -102,7 +102,7 @@ module "base_node_group" {
 # v21 clusters do not bootstrap CoreDNS either, so the deployment, its service
 # account and the kube-dns Service are created here.
 module "coredns" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/coredns?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/coredns?ref=v14.0.0"
 
   node_selector                      = local.base_node_labels
   disable_default_coredns_autoscaler = false
@@ -121,7 +121,7 @@ module "coredns" {
 }
 
 module "karpenter" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter?ref=v14.0.0"
 
   name_prefix             = var.name_prefix
   cluster_name            = module.eks.cluster_name
@@ -140,7 +140,7 @@ module "karpenter" {
 
 # Create a generic nodeclass and nodepool for system workloads
 module "ec2nodeclass_generic" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v14.0.0"
 
   name               = local.nodeclass_name_generic
   ami_selector_terms = local.ami_selector_terms
@@ -158,7 +158,7 @@ module "ec2nodeclass_generic" {
 }
 
 module "nodepool_generic" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v14.0.0"
 
   name            = local.nodeclass_name_generic
   nodeclass_name  = local.nodeclass_name_generic
@@ -175,7 +175,7 @@ module "nodepool_generic" {
 
 # Create a dedicated nodeclass and nodepool for Materialize pods
 module "ec2nodeclass_materialize" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v14.0.0"
 
   name               = local.nodeclass_name_materialize
   ami_selector_terms = local.ami_selector_terms
@@ -192,7 +192,7 @@ module "ec2nodeclass_materialize" {
 }
 
 module "nodepool_materialize" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v14.0.0"
 
   name            = local.nodeclass_name_materialize
   nodeclass_name  = local.nodeclass_name_materialize
@@ -210,7 +210,7 @@ module "nodepool_materialize" {
 
 # 3. Install AWS Load Balancer Controller
 module "aws_lbc" {
-  source = "git::https://githu
```

**File**: `test/terraform/aws-upgrade/main.tf` (modified, +17/-17)
```diff
@@ -15,7 +15,7 @@ resource "random_password" "db_password" {
 
 # 1. Create network infrastructure
 module "networking" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/networking?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/networking?ref=v14.0.0"
 
   name_prefix          = var.name_prefix
   vpc_cidr             = "10.0.0.0/16"
@@ -28,7 +28,7 @@ module "networking" {
 
 # 2. Create EKS cluster
 module "eks" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks?ref=v14.0.0"
 
   name_prefix                              = var.name_prefix
   cluster_version                          = "1.34"
@@ -50,7 +50,7 @@ module "eks" {
 # nodes cannot become Ready without one, so it must be installed before any
 # node group.
 module "vpc_cni" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/vpc-cni?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/vpc-cni?ref=v14.0.0"
 
   name_prefix       = var.name_prefix
   oidc_provider_arn = module.eks.oidc_provider_arn
@@ -74,7 +74,7 @@ module "vpc_cni" {
 }
 
 module "base_node_group" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks-node-group?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/eks-node-group?ref=v14.0.0"
 
   cluster_name                      = module.eks.cluster_name
   aws_region                        = var.aws_region
@@ -102,7 +102,7 @@ module "base_node_group" {
 # v21 clusters do not bootstrap CoreDNS either, so the deployment, its service
 # account and the kube-dns Service are created here.
 module "coredns" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/coredns?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/coredns?ref=v14.0.0"
 
   node_selector                      = local.base_node_labels
   disable_default_coredns_autoscaler = false
@@ -121,7 +121,7 @@ module "coredns" {
 }
 
 module "karpenter" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter?ref=v14.0.0"
 
   name_prefix             = var.name_prefix
   cluster_name            = module.eks.cluster_name
@@ -140,7 +140,7 @@ module "karpenter" {
 
 # Create a generic nodeclass and nodepool for system workloads
 module "ec2nodeclass_generic" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v14.0.0"
 
   name               = local.nodeclass_name_generic
   ami_selector_terms = local.ami_selector_terms
@@ -158,7 +158,7 @@ module "ec2nodeclass_generic" {
 }
 
 module "nodepool_generic" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v14.0.0"
 
   name            = local.nodeclass_name_generic
   nodeclass_name  = local.nodeclass_name_generic
@@ -175,7 +175,7 @@ module "nodepool_generic" {
 
 # Create a dedicated nodeclass and nodepool for Materialize pods
 module "ec2nodeclass_materialize" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-ec2nodeclass?ref=v14.0.0"
 
   name               = local.nodeclass_name_materialize
   ami_selector_terms = local.ami_selector_terms
@@ -192,7 +192,7 @@ module "ec2nodeclass_materialize" {
 }
 
 module "nodepool_materialize" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//aws/modules/karpenter-nodepool?ref=v14.0.0"
 
   name            = local.nodeclass_name_materialize
   nodeclass_name  = local.nodeclass_name_materialize
@@ -210,7 +210,7 @@ module "nodepool_materialize" {
 
 # 3. Install AWS Load Balancer Controller
 module "aws_lbc" {
-  source = "git::https://githu
```

**File**: `test/terraform/azure-temporary/main.tf` (modified, +9/-9)
```diff
@@ -102,7 +102,7 @@ resource "azurerm_resource_group" "materialize" {
 
 # 2. Create networking infrastructure
 module "networking" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/networking?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/networking?ref=v14.0.0"
 
   resource_group_name                = azurerm_resource_group.materialize.name
   location                           = var.location
@@ -120,7 +120,7 @@ module "networking" {
 
 # 3. Create AKS cluster with default node pool
 module "aks" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/aks?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/aks?ref=v14.0.0"
 
   resource_group_name = azurerm_resource_group.materialize.name
   kubernetes_version  = local.aks_config.kubernetes_version
@@ -153,7 +153,7 @@ module "aks" {
 
 # 3.1 Create Materialize-dedicated node pool with taints
 module "materialize_nodepool" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/nodepool?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/nodepool?ref=v14.0.0"
 
   prefix     = var.name_prefix
   cluster_id = module.aks.cluster_id
@@ -183,7 +183,7 @@ module "materialize_nodepool" {
 
 # 4. Create PostgreSQL database
 module "database" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/database?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/database?ref=v14.0.0"
 
   depends_on = [module.networking]
 
@@ -218,7 +218,7 @@ module "database" {
 
 # 5. Create Azure Blob Storage
 module "storage" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/storage?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/storage?ref=v14.0.0"
 
   resource_group_name            = azurerm_resource_group.materialize.name
   location                       = var.location
@@ -240,7 +240,7 @@ module "storage" {
 
 # 6. Install cert-manager for TLS
 module "cert_manager" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/cert-manager?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/cert-manager?ref=v14.0.0"
 
   node_selector = local.generic_node_labels
 
@@ -250,7 +250,7 @@ module "cert_manager" {
 }
 
 module "self_signed_cluster_issuer" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/self-signed-cluster-issuer?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/self-signed-cluster-issuer?ref=v14.0.0"
 
   name_prefix = var.name_prefix
 
@@ -261,7 +261,7 @@ module "self_signed_cluster_issuer" {
 
 # 7. Install Materialize Operator
 module "operator" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/operator?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//azure/modules/operator?ref=v14.0.0"
 
   name_prefix = var.name_prefix
   location    = var.location
@@ -301,7 +301,7 @@ module "operator" {
 
 # 8. Deploy Materialize instance
 module "materialize_instance" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/materialize-instance?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/materialize-instance?ref=v14.0.0"
 
   instance_name        = local.materialize_instance_name
   instance_namespace   = local.materialize_instance_namespace
```

**File**: `test/terraform/gcp-temporary/main.tf` (modified, +10/-10)
```diff
@@ -99,7 +99,7 @@ locals {
 
 # 1. Configure networking infrastructure including VPC, subnets, and CIDR blocks
 module "networking" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/networking?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/networking?ref=v14.0.0"
 
   project_id = var.project_id
   region     = var.region
@@ -110,7 +110,7 @@ module "networking" {
 
 # 2. Set up Google Kubernetes Engine (GKE) cluster
 module "gke" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/gke?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/gke?ref=v14.0.0"
 
   depends_on = [module.networking]
 
@@ -127,7 +127,7 @@ module "gke" {
 
 # 2.1 Create generic node pool for system workloads
 module "generic_nodepool" {
-  source     = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/nodepool?ref=v13.12.1"
+  source     = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/nodepool?ref=v14.0.0"
   depends_on = [module.gke]
 
   prefix                = "${var.name_prefix}-generic"
@@ -147,7 +147,7 @@ module "generic_nodepool" {
 
 # 2.2 Create Materialize-dedicated node pool with taints
 module "materialize_nodepool" {
-  source     = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/nodepool?ref=v13.12.1"
+  source     = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/nodepool?ref=v14.0.0"
   depends_on = [module.gke]
 
   prefix                = "${var.name_prefix}-mz"
@@ -170,7 +170,7 @@ module "materialize_nodepool" {
 
 # 3. Set up PostgreSQL database instance for Materialize metadata storage
 module "database" {
-  source     = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/database?ref=v13.12.1"
+  source     = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/database?ref=v14.0.0"
   depends_on = [module.networking]
 
   databases = [local.database_config.database]
@@ -191,7 +191,7 @@ module "database" {
 
 # 4. Create Google Cloud Storage bucket for Materialize persistent data storage
 module "storage" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/storage?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/storage?ref=v14.0.0"
 
   project_id      = var.project_id
   region          = var.region
@@ -205,7 +205,7 @@ module "storage" {
 
 # 5. Install cert-manager for SSL certificate management and create cluster issuer
 module "cert_manager" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/cert-manager?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/cert-manager?ref=v14.0.0"
 
   node_selector = local.generic_node_labels
 
@@ -216,7 +216,7 @@ module "cert_manager" {
 }
 
 module "self_signed_cluster_issuer" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/self-signed-cluster-issuer?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/self-signed-cluster-issuer?ref=v14.0.0"
 
   name_prefix = var.name_prefix
 
@@ -227,7 +227,7 @@ module "self_signed_cluster_issuer" {
 
 # 6. Install Materialize Kubernetes operator for managing Materialize instances
 module "operator" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/operator?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//gcp/modules/operator?ref=v14.0.0"
 
   name_prefix = var.name_prefix
   region      = var.region
@@ -259,7 +259,7 @@ module "operator" {
 
 # 7. Deploy Materialize instance with configured backend connections
 module "materialize_instance" {
-  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/materialize-instance?ref=v13.12.1"
+  source = "git::https://github.com/MaterializeInc/materialize-terraform-self-managed.git//kubernetes/modules/materialize-instance?ref=v14.0.0"
 
   instance_name        = local.materialize_instance_name
   instance_namespace   = local.materialize_instance_namespace
```

---

### Incident Patch 6: `261df097` (2026-10-05)
**Commit Message**: build(deps): bump the simple group across 1 directory with 3 updates (#39530)

Bumps the simple group with 3 updates in the /ci/builder directory:
[boto3](https://github.com/boto/boto3),
[cryptography](https://github.com/pyca/cryptography) and
[pyjwt](https://github.com/jpadilla/pyjwt).

Updates `boto3` from 1.43.103 to 1.43.107
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/boto/boto3/commit/402e09ca457c8b8ea37097e32dcf2de7c612bb2f"><code>402e09c</code></a>
Merge branch 'release-1.43.107'</li>
<li><a
href="https://github.com/boto/boto3/commit/4d321645cb78851589720fec5d08c6f8cf64c9b4"><code>4d32164</code></a>
Bumping version to 1.43.107</li>
<li><a
href="https://github.com/boto/boto3/commit/e6738b9bfc67ceb6f9eb8792a10eac83b283b959"><code>e6738b9</code></a>
Add changelog entries from botocore</li>
<li><a
href="https://github.com/boto/boto3/commit/c2a321bb8a8513706b906703fc9945e6de62e400"><code>c2a321b</code></a>
Bump <a
href="https://github.com/astral-sh/ruff-pre-commit">https://github.com/astral-sh/ruff-pre-commit</a>
(<a
href="https://redirect.github.com/boto/boto3/issues/4855">#4855</a>)</li>
<li><a
href="https://github.com/boto/boto3/commit/88630f82cb4

**File**: `ci/builder/requirements.txt` (modified, +3/-3)
```diff
@@ -15,9 +15,9 @@ aiohttp==3.14.3
 black==26.3.1
 # Pulls in dependencies that make launchdarkly/cloud tests fail, keep for now
 boto3-stubs[ec2,iam,kinesis,s3,sqs,ssm,sts,s3tables]==1.41.5
-boto3==1.43.103
+boto3==1.43.107
 click==8.1.3
-cryptography==50.0.1
+cryptography==50.0.2
 colored==2.3.2
 docker==7.2.0
 ec2instanceconnectcli==1.0.3
@@ -54,7 +54,7 @@ psycopg==3.3.3
 psycopg-binary==3.3.3
 pydantic==2.12.5
 pyelftools==0.33
-pyjwt==2.15.0
+pyjwt==2.15.1
 PyMySQL==1.2.3
 pytest==9.0.3
 pytest-split==0.11.0
```

---

### Incident Patch 7: `a5f06b3c` (2026-10-05)
**Commit Message**: build(deps-dev): bump the storybook group in /console with 2 updates (#39537)

Bumps the storybook group in /console with 2 updates:
[@storybook/react-vite](https://github.com/storybookjs/storybook/tree/HEAD/code/frameworks/react-vite)
and
[storybook](https://github.com/storybookjs/storybook/tree/HEAD/code/core).

Updates `@storybook/react-vite` from 10.6.0 to 10.6.1
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/storybookjs/storybook/releases">@​storybook/react-vite's
releases</a>.</em></p>
<blockquote>
<h2>v10.6.1</h2>
<h2>10.6.1</h2>
<ul>
<li>Addon A11y: Fix vision simulator color filters in Firefox - <a
href="https://redirect.github.com/storybookjs/storybook/pull/36153">#36153</a>,
thanks <a
href="https://github.com/ghengeveld"><code>@​ghengeveld</code></a>!</li>
<li>Addon Vitest: Support Vitest 5 browser tests - <a
href="https://redirect.github.com/storybookjs/storybook/pull/36270">#36270</a>,
thanks <a
href="https://github.com/valentinpalkovic"><code>@​valentinpalkovic</code></a>!</li>
<li>CLI: Fix vitest ERESOLVE on fresh Next.js apps. - <a
href="https://redirect.github.com/storybookjs/storybook/pull/36310">#36310</a>,
thanks <a
hr

**File**: `console/yarn.lock` (modified, +25/-25)
```diff
@@ -4407,15 +4407,15 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@storybook/builder-vite@npm:10.6.0":
-  version: 10.6.0
-  resolution: "@storybook/builder-vite@npm:10.6.0"
+"@storybook/builder-vite@npm:10.6.1":
+  version: 10.6.1
+  resolution: "@storybook/builder-vite@npm:10.6.1"
   dependencies:
     ts-dedent: "npm:^2.0.0"
   peerDependencies:
-    storybook: ^10.6.0
+    storybook: ^10.6.1
     vite: ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0
-  checksum: 10c0/805235893bfa740b129ecc97f01d07652dc789aba0f861056d39a27102625a2a0483ef18195ea54f61530e0eef1fa8ffe35b84a94a895660b5183938c5a056e4
+  checksum: 10c0/01c39c3ca6068d261f2134a4a3024d2b572ba3da7a44700176a53511cb3488830810e9af7ccee116cd7bd4c30d92813c3c6c74cce1d95dcb1cd4b40a313dedbc
   languageName: node
   linkType: hard
 
@@ -4435,32 +4435,32 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@storybook/react-dom-shim@npm:10.6.0":
-  version: 10.6.0
-  resolution: "@storybook/react-dom-shim@npm:10.6.0"
+"@storybook/react-dom-shim@npm:10.6.1":
+  version: 10.6.1
+  resolution: "@storybook/react-dom-shim@npm:10.6.1"
   peerDependencies:
     "@types/react": ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
     "@types/react-dom": ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
     react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
     react-dom: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
-    storybook: ^10.6.0
+    storybook: ^10.6.1
   peerDependenciesMeta:
     "@types/react":
       optional: true
     "@types/react-dom":
       optional: true
-  checksum: 10c0/293217a39908db99cd8881c885468d0b34c32e2a6815fa2969e30621cf141d7f18a0094855d525f53c5da51630b2e2f3b491d322d5d4d78ddb5bf2e420945e1e
+  checksum: 10c0/37c5109962fa7ada74d14e4377a1c5405b31557c49b4832e1a9ac233952d42be8ead39a60af94d5904825c73b70d05652a62cf5a79a44e2c607de26054cdc895
   languageName: node
   linkType: hard
 
 "@storybook/react-vite@npm:^10":
-  version: 10.6.0
-  resolution: "@storybook/react-vite@npm:10.6.0"
+  version: 10.6.1
+  resolution: "@storybook/react-vite@npm:10.6.1"
   dependencies:
     "@joshwooding/vite-plugin-react-docgen-typescript": "npm:^0.7.0"
     "@rollup/pluginutils": "npm:^5.0.2"
-    "@storybook/builder-vite": "npm:10.6.0"
-    "@storybook/react": "npm:10.6.0"
+    "@storybook/builder-vite": "npm:10.6.1"
+    "@storybook/react": "npm:10.6.1"
     empathic: "npm:^2.0.0"
     magic-string: "npm:^1.1.0"
     react-docgen: "npm:^8.0.2"
@@ -4469,30 +4469,30 @@ __metadata:
   peerDependencies:
     react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
     react-dom: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
-    storybook: ^10.6.0
+    storybook: ^10.6.1
     typescript: ">= 4.9.x"
     vite: ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0
   peerDependenciesMeta:
     typescript:
       optional: true
-  checksum: 10c0/3ce81bbb96f08952ee846cbdc2c1f35c48ec3ed30ffc144b36858437abe9dbafad46e3ca6461f38c7d7f75e42796848684927fe6f70fefb763b60db480421c9d
+  checksum: 10c0/23a39d94932d7c28ef847ebaafe59b07bdf94b58c623694c54c7c52b9bb8e6164030fc29bd6d64dffe80f64f4448adb1eecba538aa50e7b4a094c5164f7ef283
   languageName: node
   linkType: hard
 
-"@storybook/react@npm:10.6.0":
-  version: 10.6.0
-  resolution: "@storybook/react@npm:10.6.0"
+"@storybook/react@npm:10.6.1":
+  version: 10.6.1
+  resolution: "@storybook/react@npm:10.6.1"
   dependencies:
     "@storybook/global": "npm:^5.0.0"
-    "@storybook/react-dom-shim": "npm:10.6.0"
+    "@storybook/react-dom-shim": "npm:10.6.1"
     react-docgen: "npm:^8.0.2"
     react-docgen-typescript: "npm:^2.2.2"
   peerDependencies:
     "@types/react": ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
     "@types/react-dom": ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
     react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
     react-dom: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
-    storybook: ^10.6.0
+    storybook: ^10.6.1
     typescript: ">= 4.9.x"
   peerDependenciesMeta:
     "@types/react":
@@ -4501,7 +4501,7 @@ __metadata:
       optional: true
     typescript:
       optional: true
-  checksum: 10c0/36c2c60a35d7715f461c306706cc6bd35c2fc725c7fca28a8143b52c3f347a19cda9cc025e413080b746793f994c605c3a5682e0d652246b1b23bf69f8247bdd
+  checksum: 10c0/50d8e92320e1a6130b53aed8fbaf9378d6a3a1d1483ceb74f52dd6c775596111040978640e740b246c40b5499597a7e70bbd1b2a4c64946856cc8c4559df1f75
   languageName: node
   linkType: hard
 
@@ -14689,8 +14689,8 @@ __metadata:
   linkType: hard
 
 "storybook@npm:^10":
-  version: 10.6.0
-  resolution: "storybook@npm:10.6.0"
+  version: 10.6.1
+  resolution: "storybook@npm:10.6.1"
   dependencies:
     "@storybook/global": "npm:^5.0.0"
     "@storybook/icons": "npm:^2.0.2"
@@ -14722,7 +14722,7 @@ __metadata:
       optional: true
   bin:
     storybook: ./dist/bin/dispatcher.js
-  checksum: 10c0/ffd7a513b088e206232c0206229fe05893c8c78e5e4a3b40647326111b608d79851f3b8f986616b6b585979d3a10c6c3081c0cd86a752329e2af309632bd7e3a
+  checksum: 10c0/fb95ae0e08f8db68d8564bfcbaf3fbeae87f49dbb6c9cb83d18573bbb51d2c58adf18f92dc8f6bf58fed433ed3c27bcb2b483c7
```

---

### Incident Patch 8: `fd6344c4` (2026-10-05)
**Commit Message**: build(deps): bump the tanstack-query group in /console with 2 updates (#39538)

Bumps the tanstack-query group in /console with 2 updates:
[@tanstack/react-query](https://github.com/TanStack/query/tree/HEAD/packages/react-query)
and
[@tanstack/react-query-devtools](https://github.com/TanStack/query/tree/HEAD/packages/react-query-devtools).

Updates `@tanstack/react-query` from 5.103.2 to 5.104.0
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/TanStack/query/releases">@​tanstack/react-query's
releases</a>.</em></p>
<blockquote>
<h2><code>@​tanstack/react-query-devtools</code><a
href="https://github.com/5"><code>@​5</code></a>.104.0</h2>
<h3>Minor Changes</h3>
<ul>
<li><a
href="https://redirect.github.com/TanStack/query/pull/11650">#11650</a>
<a
href="https://github.com/TanStack/query/commit/5279b05211223dd719803ca22a9d1fa46c98638e"><code>5279b05</code></a>
- Build projects with Vite 8</li>
</ul>
<h3>Patch Changes</h3>
<ul>
<li>Updated dependencies [<a
href="https://github.com/TanStack/query/commit/5279b05211223dd719803ca22a9d1fa46c98638e"><code>5279b05</code></a>]:
<ul>
<li><code>@​tanstack/query-devtools</code><a
href="https://github.com/5

**File**: `console/package.json` (modified, +2/-2)
```diff
@@ -59,8 +59,8 @@
     "@stripe/stripe-js": "^9.17.0",
     "@tanstack/db": "0.9.2",
     "@tanstack/react-db": "0.4.1",
-    "@tanstack/react-query": "^5.103.2",
-    "@tanstack/react-query-devtools": "^5.103.2",
+    "@tanstack/react-query": "^5.104.0",
+    "@tanstack/react-query-devtools": "^5.104.0",
     "@tanstack/react-table": "^8.21.3",
     "@types/d3": "^7.4.3",
     "@types/d3-graphviz": "^2.6.10",
```

**File**: `console/yarn.lock` (modified, +39/-39)
```diff
@@ -3135,7 +3135,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@kobalte/core@npm:^0.13.4":
+"@kobalte/core@npm:^0.13.14":
   version: 0.13.14
   resolution: "@kobalte/core@npm:0.13.14"
   dependencies:
@@ -4261,7 +4261,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@solid-primitives/keyed@npm:^1.2.0, @solid-primitives/keyed@npm:^1.2.2":
+"@solid-primitives/keyed@npm:^1.2.0, @solid-primitives/keyed@npm:^1.5.3":
   version: 1.5.3
   resolution: "@solid-primitives/keyed@npm:1.5.3"
   peerDependencies:
@@ -4317,7 +4317,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@solid-primitives/resize-observer@npm:^2.0.26":
+"@solid-primitives/resize-observer@npm:^2.0.26, @solid-primitives/resize-observer@npm:^2.2.0":
   version: 2.2.0
   resolution: "@solid-primitives/resize-observer@npm:2.2.0"
   dependencies:
@@ -4701,12 +4701,12 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@tanstack/match-sorter-utils@npm:^8.19.4":
-  version: 8.19.4
-  resolution: "@tanstack/match-sorter-utils@npm:8.19.4"
+"@tanstack/match-sorter-utils@npm:^9.1.2":
+  version: 9.1.2
+  resolution: "@tanstack/match-sorter-utils@npm:9.1.2"
   dependencies:
     remove-accents: "npm:0.5.0"
-  checksum: 10c0/935022e3d639f19472131d289f3e1202253ff34301717c337e9bac0eeae6a0bd56450ed8ae2f7eb7ac9dfefa7ceaa7d126d8c5441021968b4a9eabc3ac4f8ba1
+  checksum: 10c0/38d7211d816cffd3411ada08bf5dea086c1eed9baf4e016c2f2c58bd65148e8f143acf0a567bfcd7077b5b247d0f65a8ea80b3edd6c59bbdb8e3cde40885ddf6
   languageName: node
   linkType: hard
 
@@ -4717,29 +4717,29 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@tanstack/query-core@npm:5.103.2":
-  version: 5.103.2
-  resolution: "@tanstack/query-core@npm:5.103.2"
-  checksum: 10c0/52362dd214a487b2194728a79c7fd1bd7af1831f21928030866a8ad28877eaec050e7215a6f3b3a0c4fdf601644ae8edb652e4cef7270f6f82d7371d2bbe9f41
+"@tanstack/query-core@npm:5.104.0":
+  version: 5.104.0
+  resolution: "@tanstack/query-core@npm:5.104.0"
+  checksum: 10c0/e080454f308dc41bf0e52e46aac455af3112f454519d369740aacaec4d260a3bfddde569204908ff7a6e1b1b84f8e065e0ac1375555e2bc1b023d398c0b44f96
   languageName: node
   linkType: hard
 
-"@tanstack/query-devtools@npm:5.103.2":
-  version: 5.103.2
-  resolution: "@tanstack/query-devtools@npm:5.103.2"
+"@tanstack/query-devtools@npm:5.104.0":
+  version: 5.104.0
+  resolution: "@tanstack/query-devtools@npm:5.104.0"
   dependencies:
-    "@kobalte/core": "npm:^0.13.4"
-    "@solid-primitives/keyed": "npm:^1.2.2"
-    "@solid-primitives/resize-observer": "npm:^2.0.26"
+    "@kobalte/core": "npm:^0.13.14"
+    "@solid-primitives/keyed": "npm:^1.5.3"
+    "@solid-primitives/resize-observer": "npm:^2.2.0"
     "@solid-primitives/storage": "npm:^1.3.11"
-    "@tanstack/match-sorter-utils": "npm:^8.19.4"
-    "@tanstack/query-core": "npm:5.103.2"
+    "@tanstack/match-sorter-utils": "npm:^9.1.2"
+    "@tanstack/query-core": "npm:5.104.0"
     clsx: "npm:^2.1.1"
-    goober: "npm:^2.1.16"
-    solid-js: "npm:^1.9.7"
+    goober: "npm:^2.1.19"
+    solid-js: "npm:^1.9.15"
     solid-transition-group: "npm:^0.2.3"
-    superjson: "npm:^2.2.2"
-  checksum: 10c0/df4c65d1cfa2412917b6ded353f3a0dda4b963b8b391c76bf8d9c897c206a33ef85f2ad2417f100ab3d68f4d76791d8d364c1f15b52339b6eeb7ae63c6cc4ab8
+    superjson: "npm:^2.2.6"
+  checksum: 10c0/6c7e3e9676bef4b4f35181f9da0ca34bbc4cae480c4c0d9cb31de2835e2cab058d4a92305e7f8c375d9f8960fb87a5848830830749bb8570e6475be9e4cb4f09
   languageName: node
   linkType: hard
 
@@ -4755,27 +4755,27 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@tanstack/react-query-devtools@npm:^5.103.2":
-  version: 5.103.2
-  resolution: "@tanstack/react-query-devtools@npm:5.103.2"
+"@tanstack/react-query-devtools@npm:^5.104.0":
+  version: 5.104.0
+  resolution: "@tanstack/react-query-devtools@npm:5.104.0"
   dependencies:
-    "@tanstack/query-devtools": "npm:5.103.2"
+    "@tanstack/query-devtools": "npm:5.104.0"
   peerDependencies:
-    "@tanstack/react-query": ^5.103.2
+    "@tanstack/react-query": ^5.104.0
     "@types/react": ^18 || ^19
     react: ^18 || ^19
-  checksum: 10c0/88551fdf67e5f98d206cad609d6e9a02f067942c9c84ced19e82a9149c58070f63740c108792c3381eed9e5357e4b6ff2e751c1e6ce0697eba596afdfcb87811
+  checksum: 10c0/2fb3e8988d34c3709b0c439b2b768d96f4435d04021f1fb2c5fa458a51c3a7525fb97204f25916a14ade4435216760a6a92fa81a3c91df0457f41a6e79e9a439
   languageName: node
   linkType: hard
 
-"@tanstack/react-query@npm:^5.103.2":
-  version: 5.103.2
-  resolution: "@tanstack/react-query@npm:5.103.2"
+"@tanstack/react-query@npm:^5.104.0":
+  version: 5.104.0
+  resolution: "@tanstack/react-query@npm:5.104.0"
   dependencies:
-    "@tanstack/query-core": "npm:5.103.2"
+    "@tanstack/query-core": "npm:5.104.0"
   peerDependencies:
     react: ^18 || ^19
-  checksum: 10c0/7845c13af6761c00141ef6025c4ee385bff8f16e053f8583ba1b95db47a2c1df9764a751080981226658f45487881933517d24813f47c98238b8dbdd6acee80a
+  checksum: 10c0/efcf6328c95847c99e4b41c6
```

---

### Incident Patch 9: `d33be798` (2026-10-05)
**Commit Message**: build(deps): bump the simple group across 1 directory with 5 updates (#39540)

Bumps the simple group with 5 updates in the /console directory:

| Package | From | To |
| --- | --- | --- |
|
[@materializeinc/sql-lexer](https://github.com/MaterializeInc/materialize)
| `26.43.0` | `26.44.1` |
|
[@materializeinc/sql-pretty](https://github.com/MaterializeInc/materialize)
| `26.43.0` | `26.44.1` |
|
[@types/jsonwebtoken](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/jsonwebtoken)
| `9.0.7` | `9.0.10` |
|
[fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)
| `5.11.1` | `5.11.2` |
| [pg](https://github.com/brianc/node-postgres/tree/HEAD/packages/pg) |
`8.23.0` | `8.23.1` |


Updates `@materializeinc/sql-lexer` from 26.43.0 to 26.44.1
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/MaterializeInc/materialize/releases">@​materializeinc/sql-lexer's
releases</a>.</em></p>
<blockquote>
<h2>v26.44.1</h2>
<p>See the <a
href="https://materialize.com/docs/releases/#v26441">release notes</a>
for what changed in this release.</p>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https:

**File**: `console/package.json` (modified, +4/-4)
```diff
@@ -50,8 +50,8 @@
     "@juggle/resize-observer": "^3.4.0",
     "@lezer/common": "^1.5.3",
     "@lezer/highlight": "^1.2.4",
-    "@materializeinc/sql-lexer": "^26.43.0",
-    "@materializeinc/sql-pretty": "^26.43.0",
+    "@materializeinc/sql-lexer": "^26.44.1",
+    "@materializeinc/sql-pretty": "^26.44.1",
     "@rehookify/datepicker": "^6.6.8",
     "@segment/analytics-next": "^1.84.3",
     "@sentry/react": "^10.45.0",
@@ -165,7 +165,7 @@
     "eslint-plugin-react-refresh": "^0.5.7",
     "eslint-plugin-simple-import-sort": "^14.0.0",
     "eslint-plugin-unicorn": "^76.0.0",
-    "fast-xml-parser": "^5.11.1",
+    "fast-xml-parser": "^5.11.2",
     "globals": "^17.12.0",
     "intersection-observer": "^0.12.2",
     "jotai-devtools": "^0.10.1",
@@ -178,7 +178,7 @@
     "msw": "^2.6.4",
     "openapi-typescript": "^7.13.0",
     "p-retry": "^4.6.1",
-    "pg": "^8.23.0",
+    "pg": "^8.23.1",
     "picocolors": "^1.1.1",
     "prettier": "^3.9.9",
     "react-refresh": "^0.19.0",
```

**File**: `console/yarn.lock` (modified, +44/-43)
```diff
@@ -3270,17 +3270,17 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@materializeinc/sql-lexer@npm:^26.43.0":
-  version: 26.43.0
-  resolution: "@materializeinc/sql-lexer@npm:26.43.0"
-  checksum: 10c0/29c38990195b6ca4bb6e5e1ce8f7521443723fbee6b81d65b43785a2de3b9e12b1152fff8324f491e0a23becc1da8ce8c2a9f66d6e8c043034c4e419a78fab78
+"@materializeinc/sql-lexer@npm:^26.44.1":
+  version: 26.44.1
+  resolution: "@materializeinc/sql-lexer@npm:26.44.1"
+  checksum: 10c0/bb8edb4625354ec8670557700e46b57ccd0d4b65dc952e9f88e0b27206312d1399942729896316b233307075a56664f79c1980ee19f8b1e49aaf54674b0e7d41
   languageName: node
   linkType: hard
 
-"@materializeinc/sql-pretty@npm:^26.43.0":
-  version: 26.43.0
-  resolution: "@materializeinc/sql-pretty@npm:26.43.0"
-  checksum: 10c0/1d44444f0d6976bbdb250695a8b287ab1ae163ae0965dafe5f3e6f61bec69106b2da82056fafd9912f398c10d8593d3c799005f6af63e4a05734b01c954bd5a9
+"@materializeinc/sql-pretty@npm:^26.44.1":
+  version: 26.44.1
+  resolution: "@materializeinc/sql-pretty@npm:26.44.1"
+  checksum: 10c0/9e356ec7210d29543f2bad77cbdcb5770e309c40c11db2e6f8046d768aef1fd8e989b8eccab5483739eae75bdff8652f4f37caf008c69b09bf7673e0599722d7
   languageName: node
   linkType: hard
 
@@ -3317,10 +3317,10 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@nodable/entities@npm:^3.0.0":
-  version: 3.0.0
-  resolution: "@nodable/entities@npm:3.0.0"
-  checksum: 10c0/5e57422ce08d9f83a7ad09d8f90953e2e63b3274c3f941bf7ddf64f290473e70d47acbd6c8b9e60169c2a8c5c2424c4131bdd99b937792413f55a4a146f76658
+"@nodable/entities@npm:^3.0.1":
+  version: 3.1.0
+  resolution: "@nodable/entities@npm:3.1.0"
+  checksum: 10c0/a1a2a081949a72da17846dc44962dc95a2bf5268867407fc4f6b686acda4dc5e9fd85f0398999969309b9f7fe0fbe85947a91c1ddac47eba8f9b58224c36f6fb
   languageName: node
   linkType: hard
 
@@ -5446,11 +5446,12 @@ __metadata:
   linkType: hard
 
 "@types/jsonwebtoken@npm:^9":
-  version: 9.0.7
-  resolution: "@types/jsonwebtoken@npm:9.0.7"
+  version: 9.0.10
+  resolution: "@types/jsonwebtoken@npm:9.0.10"
   dependencies:
+    "@types/ms": "npm:*"
     "@types/node": "npm:*"
-  checksum: 10c0/e1cd0e48fcae21b1d4378887a23453bd7212b480a131b11bcda2cdeb0687d03c9646ee5ba592e04cfaf76f7cc80f179950e627cdb3ebc90a5923bce49a35631a
+  checksum: 10c0/0688ac8fb75f809201cb7e18a12b9d80ce539cb9dd27e1b01e11807cb1a337059e899b8ee3abc3f2c9417f02e363a3069d9eab9ef9724b1da1f0e10713514f94
   languageName: node
   linkType: hard
 
@@ -9311,19 +9312,19 @@ __metadata:
   languageName: node
   linkType: hard
 
-"fast-xml-parser@npm:^5.11.1":
-  version: 5.11.1
-  resolution: "fast-xml-parser@npm:5.11.1"
+"fast-xml-parser@npm:^5.11.2":
+  version: 5.11.2
+  resolution: "fast-xml-parser@npm:5.11.2"
   dependencies:
-    "@nodable/entities": "npm:^3.0.0"
+    "@nodable/entities": "npm:^3.0.1"
     fast-xml-builder: "npm:^1.2.0"
     is-unsafe: "npm:^2.0.0"
     path-expression-matcher: "npm:^1.6.2"
     strnum: "npm:^2.4.2"
     xml-naming: "npm:^0.3.0"
   bin:
     fxparser: src/cli/cli.js
-  checksum: 10c0/04a1cf600130c4fc146e9f5bcb0a0e88354c5b9725debfa849f9028afd90b77a3e4c9339a3a7f5d22d749b74ac78567428eb1385679319fabf4d6f03065248d6
+  checksum: 10c0/8e8f947b150c0ecc97fb2a7298faa3e9d3e6720a7773446f17bbadf6f6ef4aff5c3e6ef9b6df81dc9b0abe9480bbcbe13b2ce4b1a27098de31e9190681116312
   languageName: node
   linkType: hard
 
@@ -11783,8 +11784,8 @@ __metadata:
     "@juggle/resize-observer": "npm:^3.4.0"
     "@lezer/common": "npm:^1.5.3"
     "@lezer/highlight": "npm:^1.2.4"
-    "@materializeinc/sql-lexer": "npm:^26.43.0"
-    "@materializeinc/sql-pretty": "npm:^26.43.0"
+    "@materializeinc/sql-lexer": "npm:^26.44.1"
+    "@materializeinc/sql-pretty": "npm:^26.44.1"
     "@playwright/test": "npm:^1.63.0"
     "@rehookify/datepicker": "npm:^6.6.8"
     "@rolldown/plugin-babel": "npm:^0.2.4"
@@ -11858,7 +11859,7 @@ __metadata:
     eslint-plugin-simple-import-sort: "npm:^14.0.0"
     eslint-plugin-unicorn: "npm:^76.0.0"
     fast-deep-equal: "npm:^3.1.3"
-    fast-xml-parser: "npm:^5.11.1"
+    fast-xml-parser: "npm:^5.11.2"
     framer-motion: "npm:^12.38.0"
     globals: "npm:^17.12.0"
     intersection-observer: "npm:^0.12.2"
@@ -11882,7 +11883,7 @@ __metadata:
     openapi-typescript: "npm:^7.13.0"
     p-retry: "npm:^4.6.1"
     papaparse: "npm:^5.7.0"
-    pg: "npm:^8.23.0"
+    pg: "npm:^8.23.1"
     pg-error-enum: "npm:^2.0.1"
     picocolors: "npm:^1.1.1"
     popper-max-size-modifier: "npm:^0.2.0"
@@ -12953,17 +12954,17 @@ __metadata:
   languageName: node
   linkType: hard
 
-"pg-cloudflare@npm:^1.4.0":
-  version: 1.4.0
-  resolution: "pg-cloudflare@npm:1.4.0"
-  checksum: 10c0/553764d00055052648393cda53c1feb065991d6f9fbfdeb56cf8396c5b33377ab2897aaf5dc9cd3933d09023a1f01e8b1ca755431dcf5fd71c92ea277e2888f1
+"pg-cloudflare@npm:^1.4.1":
+  version: 1.4.1
+  resolution: "pg-cloudflare@npm:1.4.1"
+  checksum: 10c0/32e62c987073472e81c0dc218f850b1212b4e2c1f35d50433d87d054fe268f549ebaf8fc6c1227ab24c12b318f3e3a2a191ffbdfb2daa30b39
```

---

### Incident Patch 10: `0687a15b` (2026-10-05)
**Commit Message**: build(deps): bump rustls-platform-verifier from 0.7.0 to 0.7.1 in the simple2 group across 1 directory (#39541)

Bumps the simple2 group with 1 update in the / directory:
[rustls-platform-verifier](https://github.com/rustls/rustls-platform-verifier).

Updates `rustls-platform-verifier` from 0.7.0 to 0.7.1
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/rustls/rustls-platform-verifier/releases">rustls-platform-verifier's
releases</a>.</em></p>
<blockquote>
<h2>0.7.1</h2>
<h2>About</h2>
<p>This version contains Windows and Android bugfixes, but its headline
feature is a migration to an improved distribution strategy for the
Android component of the crate, which must be included by Gradle for
Android application/library builds. If you don't build for Android, no
need to worry these changes don't affect you. But if you do, please
continue reading to understand the required migration steps and
benefits. <code>0.7.1</code> requires the Android migration to be
performed once manually.</p>
<h2>Android Revocation</h2>
<p>The biggest improvement to functionality in this release is proper
support for revocation on Android. As OCSP moves to deprecatio

**File**: `Cargo.lock` (modified, +9/-9)
```diff
@@ -5048,7 +5048,7 @@ checksum = "3640c1c38b8e4e43584d8df18be5fc6b0aa314ce6ebf51b53313d4306cca8e46"
 dependencies = [
  "hermit-abi",
  "libc",
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -11206,7 +11206,7 @@ dependencies = [
  "once_cell",
  "socket2",
  "tracing",
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -12029,7 +12029,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.12.1",
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -12072,9 +12072,9 @@ dependencies = [
 
 [[package]]
 name = "rustls-platform-verifier"
-version = "0.7.0"
+version = "0.7.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "26d1e2536ce4f35f4846aa13bff16bd0ff40157cdb14cc056c7b14ba41233ba0"
+checksum = "1167586491e2b18b8bfbb293e8180ec17c201c4f076d7cb3070ca964e7598f98"
 dependencies = [
  "core-foundation 0.10.1",
  "core-foundation-sys",
@@ -12088,14 +12088,14 @@ dependencies = [
  "security-framework",
  "security-framework-sys",
  "webpki-root-certs",
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
 name = "rustls-platform-verifier-android"
-version = "0.1.1"
+version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f87165f0995f63a9fbeea62b64d10b4d9d8e78ec6d7d51fb2125fda7bb36788f"
+checksum = "eec689c0bc40ff2458a5977b6619cb718087084a18e02a131c599b62d05e1a5f"
 
 [[package]]
 name = "rustls-webpki"
@@ -13218,7 +13218,7 @@ dependencies = [
  "getrandom 0.4.3",
  "once_cell",
  "rustix 1.1.4",
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
```

---

### Incident Patch 11: `97b3398d` (2026-10-05)
**Commit Message**: build(deps): bump aws-smithy-runtime-api from 1.18.0 to 1.19.0 (#39544)

Bumps [aws-smithy-runtime-api](https://github.com/smithy-lang/smithy-rs)
from 1.18.0 to 1.19.0.
<details>
<summary>Commits</summary>
<ul>
<li>See full diff in <a
href="https://github.com/smithy-lang/smithy-rs/commits">compare
view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility
score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=aws-smithy-runtime-api&package-manager=cargo&previous-version=1.18.0&new-version=1.19.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

Dependabot will resolve any conflicts with this PR as long as you don't
alter it yourself. You can also trigger a rebase manually by commenting
`@dependabot rebase`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:
- `@dependabot rebase` will rebase this PR
- `@dependabot recreate` will recreate this PR, overwriting any edits
that have been made to it
- `@depe

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1339,9 +1339,9 @@ dependencies = [
 
 [[package]]
 name = "aws-smithy-runtime-api"
-version = "1.18.0"
+version = "1.19.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9bb0deb40a69de59f7809251cfe1ab16de135f42c49d222d1202b4d0ce19720f"
+checksum = "c0730c16f91124c6a2abb4932c77e299288b3dd9f967ea2e9ec48cc6731e87a4"
 dependencies = [
  "aws-smithy-async",
  "aws-smithy-runtime-api-macros",
```

---

### Incident Patch 12: `8d08de61` (2026-10-05)
**Commit Message**: build(deps-dev): bump pg from 8.23.0 to 8.23.1 in /test/lang/js (#39546)

Bumps
[pg](https://github.com/brianc/node-postgres/tree/HEAD/packages/pg) from
8.23.0 to 8.23.1.
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md">pg's
changelog</a>.</em></p>
<blockquote>
<p>All major and minor releases are briefly explained below.</p>
<p>For richer information consult the commit log on github with
referenced pull requests.</p>
<p>We do not include break-fix version release in this file.</p>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/brianc/node-postgres/commit/0980cefebe0ae461da8883703be049fe13ca96cf"><code>0980cef</code></a>
Publish</li>
<li><a
href="https://github.com/brianc/node-postgres/commit/2759b2ccf70535d425688dca8a6aec79de49c1ea"><code>2759b2c</code></a>
fix(pg): run a named statement with an empty text more than once (<a
href="https://github.com/brianc/node-postgres/tree/HEAD/packages/pg/issues/3781">#3781</a>)</li>
<li><a
href="https://github.com/brianc/node-postgres/commit/7feb7dfd70a9f7e5718ab186c80d2658067ce4af"><code>7feb7df</code></a>
fi

**File**: `test/lang/js/package.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
     "@types/pg": "^8.23.1",
     "babel-jest": "^27.0.0",
     "jest": "^27.0.0",
-    "pg": "^8.23.0",
+    "pg": "^8.23.1",
     "pg-query-stream": "^4.5.3",
     "prettier": "^2.0.4"
   },
```

**File**: `test/lang/js/yarn.lock` (modified, +19/-19)
```diff
@@ -2951,15 +2951,15 @@ path-parse@^1.0.7:
   resolved "https://registry.yarnpkg.com/path-parse/-/path-parse-1.0.7.tgz#fbc114b60ca42b30d9daf5858e4bd68bbedb6735"
   integrity sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==
 
-pg-cloudflare@^1.4.0:
-  version "1.4.0"
-  resolved "https://registry.yarnpkg.com/pg-cloudflare/-/pg-cloudflare-1.4.0.tgz#4b4c20e6d8ae531d400730f4804571a8d62f1497"
-  integrity sha512-Vo7z/6rrQYxpNRylp4Tlob2elzbh+N/MOQbxFVWCxS7oEx6jF53GTJFxK2WWpKuBRkmiin4Mt+xofFDjx09R0A==
+pg-cloudflare@^1.4.1:
+  version "1.4.1"
+  resolved "https://registry.yarnpkg.com/pg-cloudflare/-/pg-cloudflare-1.4.1.tgz#0fc904c9a8b3ca3a4f71e16bcc9171224ecbb2a8"
+  integrity sha512-6PQbsFWZcp9EmJEwy5cGQ2La+AMWpP46lgbb8X+U/XsHIUweYDNCpeuKck5RxL2MdVFi7krbbEi5nX4Zh7JhrQ==
 
-pg-connection-string@^2.14.0:
-  version "2.14.0"
-  resolved "https://registry.yarnpkg.com/pg-connection-string/-/pg-connection-string-2.14.0.tgz#abc26ee4f37c56c0f3ae0fcf0b0653cc4e1c0fd9"
-  integrity sha512-XwWDGcLRGCXAR8F/AM5bG7Q+A3Wm2s6QeEjlOKZLlH3UYcguiqCWKyWXVag5TLTIjR7oOJUY8kcADaZgWPyLeg==
+pg-connection-string@^2.14.1:
+  version "2.14.1"
+  resolved "https://registry.yarnpkg.com/pg-connection-string/-/pg-connection-string-2.14.1.tgz#d9529fe2497c0cac8a9f5f6f059679c52f1bd964"
+  integrity sha512-qR3kGNPBLpCNtz0evbKA0Y/MRFXwSSdT+pTJvYp/bXTcReZbvX1kzF0IyTc1QnxqF7AZbOeBhNL8R5mYQZV/MA==
 
 pg-cursor@^2.15.3:
   version "2.15.3"
@@ -2976,10 +2976,10 @@ pg-pool@^3.14.0:
   resolved "https://registry.yarnpkg.com/pg-pool/-/pg-pool-3.14.0.tgz#f35ae4eb846780cad71af24099b3edfa9781ad90"
   integrity sha512-gKtPkFdQPU3DksooVLi9LsjZxrsBUZIpa+7aVx+LV5pNh0KzP4Zleud2po+ConrxbuXGBJ6Hfer6hdgpIBpBaw==
 
-pg-protocol@*, pg-protocol@^1.16.0:
-  version "1.16.0"
-  resolved "https://registry.yarnpkg.com/pg-protocol/-/pg-protocol-1.16.0.tgz#cffb008826561ee9770a8a15dc21f269d731b305"
-  integrity sha512-sILXutLVjCLjcDuOmvhX5e2Z4cS5qG/6Bu3VkpFwdf/633ElGLpEh9bgmuI5I4sqKqkifQiGyiCcx1HdtrK7tg==
+pg-protocol@*, pg-protocol@^1.16.1:
+  version "1.16.1"
+  resolved "https://registry.yarnpkg.com/pg-protocol/-/pg-protocol-1.16.1.tgz#87a3951b57002682d63166c029859bd834e64bf1"
+  integrity sha512-p9VOFMiHB/ZbJATetbg+99PxssTVSQRnyuPSQ67mN1+1KBOjZaZ83ZQzltnxPhJwSsC3nwVjJ10DVJlerbFzLg==
 
 pg-query-stream@^4.5.3:
   version "4.10.3"
@@ -2999,18 +2999,18 @@ pg-types@2.2.0, pg-types@^2.2.0:
     postgres-date "~1.0.4"
     postgres-interval "^1.1.0"
 
-pg@^8.23.0:
-  version "8.23.0"
-  resolved "https://registry.yarnpkg.com/pg/-/pg-8.23.0.tgz#5c2026d32bd0cb4fbd9196bac1ecf5ae66607180"
-  integrity sha512-Ip2EQCngowJLGOfCwkFhPXU7/ljlhn6Rxlmy4XYfL2Y+vyRM59+8uR2xqRWKdYmbXmxCFOAmKxBuSUCdF34qLg==
+pg@^8.23.1:
+  version "8.23.1"
+  resolved "https://registry.yarnpkg.com/pg/-/pg-8.23.1.tgz#e4848051a04aa2f968fd5671d075f89e5e7918b9"
+  integrity sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==
   dependencies:
-    pg-connection-string "^2.14.0"
+    pg-connection-string "^2.14.1"
     pg-pool "^3.14.0"
-    pg-protocol "^1.16.0"
+    pg-protocol "^1.16.1"
     pg-types "2.2.0"
     pgpass "1.0.5"
   optionalDependencies:
-    pg-cloudflare "^1.4.0"
+    pg-cloudflare "^1.4.1"
 
 pgpass@1.0.5:
   version "1.0.5"
```

---

### Incident Patch 13: `77ed59a6` (2026-10-05)
**Commit Message**: build: pin jemalloc's page size to 4 KiB on aarch64 Linux (#39549)

## Summary

Pin jemalloc's allocator page to 4 KiB for `aarch64-unknown-linux-gnu`
builds by setting `AARCH64_UNKNOWN_LINUX_GNU_JEMALLOC_SYS_WITH_LG_PAGE =
"12"` in `.cargo/config.toml`.

[#39339](https://github.com/MaterializeInc/materialize/pull/39339)
bumped tikv-jemalloc-sys from 0.6.1 (jemalloc 5.3.0) to 0.7.1 (jemalloc
5.3.1). jemalloc 5.3.1 changed its default allocator page on aarch64
Linux from the build host's page to 64 KiB
([facebook/jemalloc#34](https://github.com/facebook/jemalloc/pull/34)).
Neither #39339 nor the tikv-jemallocator [0.7.0 release
notes](https://github.com/tikv/jemallocator/releases/tag/0.7.0) mention
it, and I found no discussion of it in code, issues or Slack.

@antiguru confirmed on this PR that the move to 64 KiB was [not a
deliberate
choice](https://github.com/MaterializeInc/materialize/pull/39549#issuecomment-5988777173).
Every production and staging environmentd and clusterd pod runs on arm64
nodes, so rc.3 runs with a 64 KiB allocator page on 4 KiB-page kernels.

The effect is a step in `jemalloc_active` minus `jemalloc_allocated` in
every Materialize process. This PR restores 

**File**: `.cargo/config.toml` (modified, +9/-0)
```diff
@@ -50,3 +50,12 @@ rustflags = ["--cfg=tokio_unstable"]
 
 [env]
 DUCKDB_DOWNLOAD_LIB = "1"
+# jemalloc 5.3.1 defaults to a 64 KiB allocator page on aarch64 Linux. The
+# nodes we run on use 4 KiB kernel pages, and a 64 KiB allocator page makes
+# every slab at least 64 KiB, which leaves hundreds of MiB of active but unused
+# memory in each process and makes every heap-profiling sample occupy a 64 KiB
+# page. Pin the page to 4 KiB. A binary built this way aborts at startup on a
+# kernel with larger pages ("Unsupported system page size").
+#
+# See: https://github.com/facebook/jemalloc/pull/34
+AARCH64_UNKNOWN_LINUX_GNU_JEMALLOC_SYS_WITH_LG_PAGE = "12"
```

---

### Incident Patch 14: `13f99fe0` (2026-10-02)
**Commit Message**: revert tower-http to 0.6 (#39500)

### Motivation

we have a bunch of dependencies which are still stuck on 0.6, and
tower-http includes a bunch of traits/trait bounds which make having
multiple versions available pretty difficult to manage.

### Verification

seems to compile fine

**File**: `Cargo.lock` (modified, +17/-37)
```diff
@@ -1724,7 +1724,7 @@ dependencies = [
  "bitflags 2.13.2",
  "cexpr",
  "clang-sys",
- "itertools 0.13.0",
+ "itertools 0.10.5",
  "proc-macro2",
  "quote",
  "regex",
@@ -3337,7 +3337,7 @@ dependencies = [
  "libc",
  "option-ext",
  "redox_users",
- "windows-sys 0.61.1",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -5029,7 +5029,7 @@ checksum = "3640c1c38b8e4e43584d8df18be5fc6b0aa314ce6ebf51b53313d4306cca8e46"
 dependencies = [
  "hermit-abi",
  "libc",
- "windows-sys 0.61.1",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -5389,7 +5389,7 @@ dependencies = [
  "tokio",
  "tokio-util",
  "tower 0.5.3",
- "tower-http 0.6.11",
+ "tower-http",
  "tracing",
 ]
 
@@ -7216,7 +7216,7 @@ dependencies = [
  "tokio-postgres",
  "tokio-stream",
  "tower 0.5.3",
- "tower-http 0.7.1",
+ "tower-http",
  "tower-sessions",
  "tracing",
  "tracing-capture",
@@ -7406,7 +7406,7 @@ dependencies = [
  "serde_json",
  "tokio",
  "tower 0.5.3",
- "tower-http 0.7.1",
+ "tower-http",
  "tracing",
  "tracing-subscriber",
 ]
@@ -7755,7 +7755,7 @@ dependencies = [
  "sha2 0.11.0",
  "thiserror 2.0.21",
  "tokio",
- "tower-http 0.7.1",
+ "tower-http",
  "tracing",
  "uuid",
 ]
@@ -8654,7 +8654,7 @@ dependencies = [
  "tokio",
  "tokio-postgres",
  "tokio-stream",
- "tower-http 0.7.1",
+ "tower-http",
  "tracing",
  "uuid",
  "walkdir",
@@ -11190,7 +11190,7 @@ dependencies = [
  "once_cell",
  "socket2",
  "tracing",
- "windows-sys 0.61.1",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -11662,7 +11662,7 @@ dependencies = [
  "tokio",
  "tokio-native-tls",
  "tower 0.5.3",
- "tower-http 0.6.11",
+ "tower-http",
  "tower-service",
  "url",
  "wasm-bindgen",
@@ -11708,7 +11708,7 @@ dependencies = [
  "tokio-rustls",
  "tokio-util",
  "tower 0.5.3",
- "tower-http 0.6.11",
+ "tower-http",
  "tower-service",
  "url",
  "wasm-bindgen",
@@ -12013,7 +12013,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.12.1",
- "windows-sys 0.61.1",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -12072,7 +12072,7 @@ dependencies = [
  "security-framework",
  "security-framework-sys",
  "webpki-root-certs",
- "windows-sys 0.61.1",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -13202,7 +13202,7 @@ dependencies = [
  "getrandom 0.4.3",
  "once_cell",
  "rustix 1.1.4",
- "windows-sys 0.61.1",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -13221,7 +13221,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "230a1b821ccbd75b185820a1f1ff7b14d21da1e442e22c0863ea5f08771a8874"
 dependencies = [
  "rustix 1.1.4",
- "windows-sys 0.61.1",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -13841,45 +13841,25 @@ name = "tower-http"
 version = "0.6.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4cfcf7e2740e6fc6d4d688b4ef00650406bb94adf4731e43c096c3a19fe40840"
-dependencies = [
- "base64 0.22.1",
- "bitflags 2.13.2",
- "bytes",
- "futures-util",
- "http 1.5.0",
- "http-body",
- "mime",
- "pin-project-lite",
- "tower 0.5.3",
- "tower-layer",
- "tower-service",
- "tracing",
- "url",
-]
-
-[[package]]
-name = "tower-http"
-version = "0.7.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "08a05a66a4fdd61cbbe0a1d755ffe0ca6aba159dd4820936a0ff8a8278245b9c"
 dependencies = [
  "async-compression",
  "base64 0.22.1",
  "bitflags 2.13.2",
  "bytes",
  "futures-core",
+ "futures-util",
  "http 1.5.0",
  "http-body",
  "http-body-util",
  "mime",
- "percent-encoding",
  "pin-project-lite",
  "tokio",
  "tokio-util",
  "tower 0.5.3",
  "tower-layer",
  "tower-service",
  "tracing",
+ "url",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -544,7 +544,7 @@ tonic = { version = "0.14.6", features = ["gzip", "transport"] }
 tonic-prost = "0.14.6"
 tonic-prost-build = "0.14.6"
 tower = { version = "0.5.3", features = ["balance", "buffer", "filter", "limit", "load-shed", "retry", "timeout", "util"] }
-tower-http = { version = "0.7.1", features = ["auth", "cors", "decompression-br", "decompression-deflate", "decompression-gzip", "decompression-zstd", "map-response-body", "trace", "util"] }
+tower-http = { version = "0.6.11", features = ["auth", "cors", "decompression-br", "decompression-deflate", "decompression-gzip", "decompression-zstd", "map-response-body", "trace", "util"] }
 tower-lsp = { version = "0.20.0", features = ["proposed"] }
 tower-sessions = "0.15.0"
 tower-sessions-memory-store = "0.14.0"
```

**File**: `deny.toml` (modified, +0/-2)
```diff
@@ -83,8 +83,6 @@ skip = [
     { name = "itertools", version = "0.14.0" },
     # Used by pprof
     { name = "nix", version = "0.26.4" },
-    # kube-client and reqwest still pull 0.6.
-    { name = "tower-http", version = "0.6.11" },
     # tokio-tungstenite still pulls 0.29.
     { name = "tungstenite", version = "0.29.0" },
     # libduckdb-sys still pulls 6.
```

---

### Incident Patch 15: `08e493ee` (2026-10-02)
**Commit Message**: docs: fix the cluster filter and the memory comparison in the sizing guide (#39487)

Fixes to the hydration sizing guide
(`doc/user/content/clusters/sizing.md`): two errors in its example
queries, plus the edits that keep the rest of the page consistent with
them.

- **Cluster filter.** The three example queries filtered on
`mz_cluster_replica_history.cluster_name`, which holds the cluster's
name when each replica was created. Replicas created before a rename or
`SWAP` dropped out: on a production cluster that had been swapped, the
step 3 query returned only a temporary replica and none of the cluster's
own episodes. The queries now filter on the current name in
`mz_clusters`, and the "Rows outlive what they name" bullet explains
why.
- **Memory comparison.** `peak_memory` counts memory only, so on a
replica that spills to disk it sits at the size's memory and says
little. Step 3 now reports the peak heap (memory plus disk) next to the
size's heap limit, both per process. On that cluster's replica this
reads 105 GB of 106 GB, where `peak_memory` alone showed 15 GB.
- **Consistency.** Where disk is swap (Materialize Cloud, Self-Managed
defaults), `peak_disk_bytes` is the kernel's sw

**File**: `doc/user/content/clusters/sizing.md` (modified, +45/-37)
```diff
@@ -10,7 +10,7 @@ menu:
 ---
 
 A cluster's [size](/sql/create-cluster/#available-sizes) defines the CPU,
-memory, and scratch disk available to every replica. On Materialize Cloud, this
+memory, and disk available to every replica. On Materialize Cloud, this
 determines the [cost](/materialize-cloud/billing/#compute) of the cluster.
 Clusters should be provisioned for peak resource usage, to ensure that they can
 handle the load placed on them. For most clusters, peak resource usage happens
@@ -34,8 +34,8 @@ This guide assumes you are running Materialize v26.42 or later. v26.42 added
 improvements to allow you to track peak resource usage during hydration.
 
 {{< note >}}
-**Multi-process replicas.** `peak_memory_bytes` is a single process's
-high-water mark, not the replica's. On a multi-process size it does not capture
+**Multi-process replicas.** The recorded peaks are a single process's
+high-water marks, not the replica's. On a multi-process size they do not capture
 the replica's true peak, and no way to combine the per-process marks into one is
 established. This guide assumes a single-process size.
 {{< /note >}}
@@ -82,29 +82,31 @@ SELECT
     h.started_at,
     h.finished_at - h.started_at AS hydration_time,
     h.object_count,
-    pg_size_pretty(h.peak_memory_bytes) AS peak_memory,
-    pg_size_pretty(h.peak_disk_bytes) AS peak_disk
+    pg_size_pretty(h.peak_memory_bytes + coalesce(h.peak_disk_bytes, 0)) AS peak_heap,
+    pg_size_pretty(s.memory_bytes + coalesce(s.disk_bytes, 0)) AS heap_limit
 FROM mz_internal.mz_replica_hydration_history AS h
 JOIN mz_internal.mz_cluster_replica_history AS rh ON rh.replica_id = h.replica_id
-WHERE rh.cluster_name = 'analytics'
+JOIN mz_catalog.mz_clusters AS c ON c.id = rh.cluster_id
+JOIN mz_catalog.mz_cluster_replica_sizes AS s ON s.size = rh.size
+WHERE c.name = 'analytics'
 ORDER BY h.started_at DESC;
 ```
 
 ```none
- replica | size  |          started_at           | hydration_time | object_count | peak_memory | peak_disk
----------+-------+-------------------------------+----------------+--------------+-------------+-----------
- r1      | 400cc | 2026-09-08 09:12:04.117841+00 | 00:04:11.83    |           41 | 11 GB       | 2438 MB
+ replica | size  |          started_at           | hydration_time | object_count | peak_heap | heap_limit
+---------+-------+-------------------------------+----------------+--------------+-----------+------------
+ r1      | 400cc | 2026-09-08 09:12:04.117841+00 | 00:04:11.83    |           41 | 13 GB     | 152 GB
 (1 row)
 ```
 
-`peak_memory` is the highest memory any process on the replica reached, from
-process start through the moment the episode was recorded. For sizing that is
-the useful direction: it bounds the hydration peak rather than under-reporting
-it.
-
-Compare `peak_memory` against the replica sizes in
-[`mz_catalog.mz_cluster_replica_sizes`](/sql/system-catalog/mz_catalog/#mz_cluster_replica_sizes), and use this to
-determine the ideal cluster size. Both figures are per process.
+`peak_heap` adds a process's memory and disk high-water marks
+(`peak_memory_bytes` and `peak_disk_bytes`). Both marks cover the process's
+whole life up to the moment the episode was recorded. A page moved back from
+disk to memory also counts in both marks. As a result, `peak_heap` can run
+higher than the hydration itself needed, which errs on the safe side for
+sizing. `heap_limit` is the memory plus disk the size provides, from
+[`mz_catalog.mz_cluster_replica_sizes`](/sql/system-catalog/mz_catalog/#mz_cluster_replica_sizes).
+Both figures are per process. Compare them to determine the ideal cluster size.
 
 To find which object dominated the episode, read the per-object table,
 [`mz_internal.mz_object_hydration_history`](/sql/system-catalog/mz_internal/#mz_object_hydration_history).
@@ -122,7 +124,8 @@ FROM mz_internal.mz_object_hydration_history AS h
 JOIN mz_internal.mz_object_global_ids AS g ON g.global_id = h.object_id
 JOIN mz_catalog.mz_objects AS o ON o.id = g.id
 JOIN mz_internal.mz_cluster_replica_history AS rh ON rh.replica_id = h.replica_id
-WHERE rh.cluster_name = 'analytics'
+JOIN mz_catalog.mz_clusters AS c ON c.id = rh.cluster_id
+WHERE c.name = 'analytics'
 ORDER BY hydration_time DESC
 LIMIT 5;
 ```
@@ -161,10 +164,10 @@ measurement you need to confirm the new size. Re-run the query from [step
 3](#read-what-the-last-hydration-needed) once the new replica is hydrated:
 
 ```none
- replica | size  |          started_at           | hydration_time | object_count | peak_memory | peak_disk
----------+-------+-------------------------------+----------------+--------------+-------------+-----------
- r2      | 100cc | 2026-09-08 10:41:22.913044+00 | 00:12:37.42    |           41 | 12 GB       | 4310 MB
- r1      | 400cc | 2026-09-08 09:12:04.117841+00 | 00:04:11.83    |           41 | 11 GB       | 2438 MB
+ replica | size  |          started_at           | hydration_time | object_count | peak_heap | heap_limit
```

#### Recent Merged Pull Requests:
- **PR #39554** (2026-10-05): adapter: Allow replication-factor changes during reconfiguration (@aljoscha)
- **PR #39551** (2026-10-05): secrets-cli: move secrets reader loading to mz-secrets-loader (@antiguru)
- **PR #39549** (2026-10-05): build: pin jemalloc's page size to 4 KiB on aarch64 Linux (@bosconi)
- **PR #39546** (2026-10-05): build(deps-dev): bump pg from 8.23.0 to 8.23.1 in /test/lang/js (@dependabot[bot])
- **PR #39545** (2026-10-05): build(deps): bump aws-sdk-s3 from 1.150.0 to 1.151.0 (@dependabot[bot])
- **PR #39544** (2026-10-05): build(deps): bump aws-smithy-runtime-api from 1.18.0 to 1.19.0 (@dependabot[bot])
- **PR #39541** (2026-10-05): build(deps): bump rustls-platform-verifier from 0.7.0 to 0.7.1 in the simple2 group across 1 directory (@dependabot[bot])
- **PR #39540** (2026-10-05): build(deps): bump the simple group across 1 directory with 5 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

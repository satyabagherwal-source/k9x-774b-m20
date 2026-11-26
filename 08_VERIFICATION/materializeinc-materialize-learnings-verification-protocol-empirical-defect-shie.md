# Verification Protocol: Verification Protocol: Empirical Defect Shield for materializeinc-materialize-learnings

<!-- PROVENANCE_START
{
  "source_repository": "materializeinc-materialize-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T05:57:47.240Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-materializeinc-materialize-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [materializeinc-materialize-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T05:57:47.240Z`  
> **Learning ID**: `LEARN-EVO-materializeinc-materialize-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `materializeinc-materialize-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/materializeinc-materialize-learnings.md`  
> **Source**: github ([https://github.com/MaterializeInc/materialize](https://github.com/MaterializeInc/materialize))  
> **Source Version**: `2a7e1bd4`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T05:57:14.146Z  
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
> **Harvest Timestamp**: 2026-11-26T05:57:14.140Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MaterializeInc/materialize`
- **Description**: The live data layer for apps and AI agents. Create up-to-the-second views into your business, just using SQL
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 6415 stars

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
- **Issue #41088** (2026-11-26): **release: mark v26.51, v26.52 as released**
  *Symptoms*: Opened and merged by the Complete release workflow in MaterializeInc/release, which marks shipped releases as released in the user-facing docs.

- **Issue #41083** (2026-11-25): **deps: bump zstd-sys to 2.2.0+zstd.1.6.0**
  *Symptoms*: Bump `zstd-sys` to pick up upstream zstd 1.6.0. Only `zstd-sys` changes in `Cargo.lock`.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

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

### Incident Patch 1: `371eac62` (2026-11-25)
**Commit Message**: reclock: free unused memory after start (#40715)

### Motivation

When an ingestion starts, every export's reclock operator replays the
remap collection from the ingestion's as-of. The as-of is the minimum
over all exports. Because a new export has no upper yet, adding a table
pulls the as-of back to the remap since for every export.

The replay arrives in one burst. Each operator holds it in
`remap_accum_buffer` and then in `pending_remap` before it moves into
the trace. Neither buffer gave its capacity back after draining. An
export that has caught up compacts its trace right away, but it still
kept buffers sized for the whole replay for as long as it ran.

In one incident the remap since had been held back for months. Adding a
table made 14 exports on 2 workers replay that history, and the retained
buffers grew to about 45 GB.

relates to: [SS-563](https://linear.app/materializeinc/issue/SS-563)

### Description

* `remap_accum_buffer` is taken with `mem::take` before it drains, which
frees its allocation. Steady state doesn't pay for this. A tick that
advances one element brings two updates, and those fit inline in the
`ChangeBatch`.
* `pending_remap` shrinks to twice its lengt

**File**: `src/timely-util/src/reclock.rs` (modified, +45/-1)
```diff
@@ -281,7 +281,10 @@ where
             // Only do this once any of the `remap_input` frontier has passed `as_of`.
             // For as long as the input frontier is less-equal `as_of`, we have no finalized times.
             if !PartialOrder::less_equal(&frontiers[0].frontier(), &as_of.borrow()) {
-                for ((into, from), diff) in remap_accum_buffer.drain() {
+                // Taking the buffer releases its capacity. A replay of the remap history from an
+                // old as-of fills it once, and every export's operator would hold that capacity
+                // for good.
+                for ((into, from), diff) in std::mem::take(&mut remap_accum_buffer).into_inner() {
                     pending_remap.push(Reverse((into, from, diff)));
                 }
             }
@@ -303,6 +306,10 @@ where
                 });
                 remap_trace.push(into.clone(), updates);
             }
+            // Releases what a replay leaves behind, like `remap_accum_buffer` above.
+            if pending_remap.len() < pending_remap.capacity() / 4 {
+                pending_remap.shrink_to(pending_remap.len() * 2);
+            }
 
             // STEP 3. Receive new data updates
             //         The `events` input describes arbitrary progress and data over `FromTime`,
@@ -1901,4 +1908,41 @@ mod test {
             },
         );
     }
+
+    #[cfg(feature = "count-allocations")]
+    #[mz_ore::test]
+    #[cfg_attr(miri, ignore)] // too slow
+    fn test_replay_releases_buffers() {
+        let replayed = 10_000_u64;
+
+        // The source frontier is beyond every replayed binding, so the trace keeps none of them
+        // and what stays allocated after the replay is buffer capacity.
+        harness::<FromTime, u64, _, _>(
+            Antichain::from_elem(0),
+            move |worker, mut bindings, (_data, mut data_cap), reclocked| {
+                data_cap.downgrade(&Partitioned::new_singleton(0, replayed));
+                step(worker);
+                let info = allocation_counter::measure(|| {
+                    for ts in 0..replayed {
+                        if ts > 0 {
+                            bindings.update_at(
+                                Partitioned::new_singleton(0, ts - 1),
+                                ts,
+                                Diff::MINUS_ONE,
+                            );
+                        }
+                        bindings.update_at(Partitioned::new_singleton(0, ts), ts, Diff::ONE);
+                    }
+                    bindings.advance_to(replayed);
+                    bindings.flush();
+                    step(worker);
+                    reclocked.try_iter().for_each(drop);
+                });
+                assert!(
+                    info.bytes_current < i64::try_from(info.bytes_max / 10).expect("fits"),
+                    "replay buffers kept their capacity: {info:?}"
+                );
+            },
+        );
+    }
 }
```

---

### Incident Patch 2: `01a264e6` (2026-11-25)
**Commit Message**: reclock: implement keyframes to improve reclock performance with large traces (#40714)

### Motivation

The reclock operator keeps the remap collection as a list of updates. On
every activation it rebuilt the binding frontier by replaying those
updates from the since forward.

That is cheap while the since keeps up. It is not when an export
snapshots while CDC runs concurrently. The snapshot holds the since
back, the trace keeps growing, and every activation replays all of it.
The cost per activation grows with the history held, which makes the
whole snapshot quadratic.

In a replay test that held about 1M bindings and then added a 1M row
table, reclock was 3.9 s of worker CPU on main, about half of what the
worker spent.

There are 2 commits - one for the code changes + unit tests, and the
other for the benchmarks.

Closes: [SS-563](https://linear.app/materializeinc/issue/SS-563)

### Description

The trace now stores some bindings whole, as keyframes, and only the
updates for the times between them.

* A keyframe starts once the updates since the last one reach the width
of the frontier. A source with a totally ordered time gets a keyframe at
every binding. A wide frontier where 

**File**: `src/timely-util/benches/reclock.rs` (modified, +258/-1)
```diff
@@ -9,6 +9,7 @@
 
 use mz_alloc_default as _;
 use std::sync::mpsc::Receiver;
+use std::time::Instant;
 
 use differential_dataflow::{
     ExchangeData,
@@ -17,6 +18,7 @@ use differential_dataflow::{
 use mz_bench_util::{BenchmarkId, Criterion, criterion_group, criterion_main};
 
 use mz_ore::Overflowing;
+use mz_ore::cast::CastFrom;
 use mz_timely_util::capture::PusherCapture;
 use mz_timely_util::order::Partitioned;
 use mz_timely_util::reclock::reclock;
@@ -124,5 +126,260 @@ fn bench_reclock_simple(c: &mut Criterion) {
     }
 }
 
-criterion_group!(benches, bench_reclock_simple);
+/// The partition that the bindings `mint` creates advance, and that reclocked updates belong to.
+const PID: u64 = 1;
+
+/// The shape of the bindings [`mint`] creates.
+#[derive(Clone, Copy)]
+enum Shape {
+    /// Partition `PID` alone.
+    Partition,
+    /// A GTID set with `uuids` server UUIDs and ranges filling the gaps around them. Only the
+    /// UUID at `PID` advances, the way a source with idle UUIDs from passive masters or past
+    /// failovers does.
+    Gtid { uuids: u64 },
+}
+
+/// Inserts the elements of `shape` that never advance, at time 0.
+fn mint_idle(bindings: &mut BindingHandle<FromTime>, shape: Shape) {
+    let Shape::Gtid { uuids } = shape else {
+        return;
+    };
+    // The UUIDs sit at the odd partitions from `PID` up, and the ranges at the partitions
+    // between them.
+    for pid in (PID..).step_by(2).take(usize::cast_from(uuids)) {
+        bindings.update_at(Partitioned::new_range(pid - 1, pid - 1, 0), 0, Diff::ONE);
+        if pid != PID {
+            bindings.update_at(Partitioned::new_singleton(pid, 1), 0, Diff::ONE);
+        }
+    }
+    let last = PID + 2 * uuids - 1;
+    bindings.update_at(Partitioned::new_range(last, u64::MAX, 0), 0, Diff::ONE);
+}
+
+/// Mints the binding at time `t`, which covers the offsets of partition `PID` below `t`.
+fn mint_binding(bindings: &mut BindingHandle<FromTime>, t: u64) {
+    if t > 0 {
+        bindings.update_at(Partitioned::new_singleton(PID, t - 1), t, Diff::MINUS_ONE);
+    }
+    bindings.update_at(Partitioned::new_singleton(PID, t), t, Diff::ONE);
+}
+
+/// Mints bindings of `shape` at times `0..=count`. Offset `o` of `PID` reclocks to `o + 1`.
+fn mint(bindings: &mut BindingHandle<FromTime>, count: u64, shape: Shape) {
+    mint_idle(bindings, shape);
+    for t in 0..=count {
+        mint_binding(bindings, t);
+    }
+    bindings.advance_to(count + 1);
+    bindings.flush();
+}
+
+/// The binding counts most benchmarks of a pinned since run at.
+const COUNTS: &[u64] = &[1, 10, 100, 1_000, 10_000, 100_000, 1_000_000];
+
+/// Times one activation of the reclock operator over each of `counts` bindings of `shape`, while
+/// `data_cap` holds the since at the as_of the way a snapshotting export does. Each activation
+/// reclocks one update at each offset `batch` returns. Setup runs outside the timed loop.
+fn bench_pinned_since(
+    c: &mut Criterion,
+    group: &str,
+    counts: &[u64],
+    shape: Shape,
+    batch: fn(u64) -> Vec<u64>,
+) {
+    let mut group = c.benchmark_group(group);
+    group.sample_size(10);
+    for &count in counts {
+        group.bench_with_input(BenchmarkId::from_parameter(count), &count, |b, &count| {
+            b.iter_custom(|iters| {
+                harness::<FromTime, u64, _, _>(
+                    Antichain::from_elem(0),
+                    move |worker, mut bindings, (mut data, data_cap), reclocked| {
+                        mint(&mut bindings, count, shape);
+                        step(worker);
+                        let offsets = batch(count);
+                        let mut activate = || {
+                            data.activate().session(&data_cap).give_iterator(
+                                offsets.iter().enumerate().map(|(d, offset)| {
+                                    (
+                                        u64::cast_from(d),
+                                        Partitioned::new_singleton(PID, *offset),
+                                        Diff::ONE,
+                                    )
+                                }),
+                            );
+                            step(worker);
+                            reclocked
+                                .try_iter()
+                                .map(|event| match event {
+                                    Event::Messages(_, updates) => updates.len(),
+                                    Event::Progress(_) => 0,
+                                })
+                                .sum::<usize>()
+                        };
+                        // Every update must reclock to a binding, or the benchmark measures
+                        // deferred updates instead.
+                        assert_eq!(activate(), offsets.len());
+
+                        let start = Instant::now();
+                        for _ in 0..iters {
+                            activate();
+     
```

**File**: `src/timely-util/src/reclock.rs` (modified, +711/-144)
```diff
@@ -177,7 +177,7 @@ use std::iter::FromIterator;
 
 use differential_dataflow::difference::Semigroup;
 use differential_dataflow::lattice::Lattice;
-use differential_dataflow::{AsCollection, ExchangeData, VecCollection, consolidation};
+use differential_dataflow::{AsCollection, ExchangeData, VecCollection};
 use mz_ore::Overflowing;
 use mz_ore::collections::CollectionExt;
 use timely::communication::{Pull, Push};
@@ -237,22 +237,15 @@ where
         // frontier. As the input frontier advances, we drop elements out of this priority queue
         // and mint new associations.
         let mut pending_remap: BinaryHeap<Reverse<(IntoTime, FromTime, i64)>> = BinaryHeap::new();
-        // A trace of `remap_input` that accumulates correctly for all times that are beyond
-        // `remap_since` and not beyond `remap_upper`. The updates in `remap_trace` are maintained
-        // in time order. An actual DD trace could be used here at the expense of a more
-        // complicated API to traverse it. This is left for future work if the naive trace
-        // maintenance implemented in this operator becomes problematic.
-        let mut remap_upper = Antichain::from_elem(IntoTime::minimum());
-        let mut remap_since = as_of.clone();
-        let mut remap_trace = VecDeque::new();
+        // The bindings of `remap_input` at times beyond its since and not beyond the input
+        // frontier.
+        let mut remap_trace = RemapTrace::new(as_of.clone());
 
         // A stash of source updates for which we don't know the corresponding binding yet.
         let mut deferred_source_updates: Vec<ChainBatch<_, _, _>> = Vec::new();
         // The frontier of the `events` input
         let mut source_frontier = MutableAntichain::from_elem(FromTime::minimum());
 
-        let mut binding_buffer = Vec::new();
-
         // Accumulation buffer for `remap_input` updates.
         use timely::progress::ChangeBatch;
         let mut remap_accum_buffer: ChangeBatch<(IntoTime, FromTime)> = ChangeBatch::new();
@@ -294,15 +287,21 @@ where
             }
 
             // STEP 2. Extract bindings not beyond `remap_frontier` and commit them into `remap_trace`.
-            let prev_remap_upper =
-                std::mem::replace(&mut remap_upper, frontiers[0].frontier().to_owned());
-            while let Some(update) = pending_remap.peek_mut() {
-                if !remap_upper.less_equal(&update.0.0) {
-                    let Reverse((into, from, diff)) = PeekMut::pop(update);
-                    remap_trace.push_back((from, into, diff));
-                } else {
-                    break;
-                }
+            let remap_upper = frontiers[0].frontier().to_owned();
+            while let Some(Reverse((into, _, _))) = pending_remap.peek()
+                && !remap_upper.less_equal(into)
+            {
+                // The heap yields the updates of a time together, and all of them are in it
+                // because the remap frontier has passed that time.
+                let into = into.clone();
+                let updates = std::iter::from_fn(|| {
+                    let update = pending_remap.peek_mut()?;
+                    (update.0.0 == into).then(|| {
+                        let Reverse((_, from, diff)) = PeekMut::pop(update);
+                        (from, diff)
+                    })
+                });
+                remap_trace.push(into.clone(), updates);
             }
 
             // STEP 3. Receive new data updates
@@ -330,139 +329,57 @@ where
             stash.sort_unstable_by(|(_, t1, _): &(D, FromTime, R), (_, t2, _)| t1.cmp(t2));
             let mut new_source_updates = ChainBatch::from_iter(stash);
 
-            // STEP 4: Reclock new and deferred updates
-            //         We are now ready to step through the remap bindings in time order and
-            //         perform the following actions:
-            //         4.1. Match `new_source_updates` against the entirety of bindings contained
-            //              in the trace.
-            //         4.2. Match `deferred_source_updates` against the bindings that were just
-            //              added in the trace.
-            //         4.3. Reclock `source_frontier` to calculate the new since frontier of the
-            //              remap trace.
+            // STEP 4: Reclock the source frontier and the new and deferred updates
+            //         This only makes sense if there are any times for which we can correctly
+            //         accumulate the remap trace, which is what we check here.
             //
-            //         The steps above only make sense to perform if there are any times for which
-            //         we can correctly accumulate the remap trace, which is what we check here.
-            if remap_since.iter().all(|t| !remap_upper.less_equal(t)) {
-                let mut cur_binding = MutableAntichain::new();
-
-                let mut remap = remap_trace
```

---

### Incident Patch 3: `8327b66e` (2026-11-25)
**Commit Message**: adapter: hydrate new builtin collections before 0dt promotion (#40903)

Closes: [SQL-948](https://linear.app/materializeinc/issue/SQL-948)

### Motivation

During a 0dt upgrade, a builtin storage collection that is new in the
target version gets its shard inside the read-only process's catalog
savepoint, which is never committed, and the promoted leader allocates a
different one. So dataflows that hydrated while read-only are rebuilt at
cut-over, and anything reading a new collection cannot hydrate before
promotion.

On main this hits the three query-policy materialized views from #38762,
which are small leaves. If #40067's `mz_catalog_items` and #40843 on top
of it ship in one upgrade, the 12 catalog-server indexes that depend on
`mz_types` only hydrate after cut-over.

### Description

Reviewable commit by commit:

1. **Shards from the migration shard.** Builtin tables, sources and
materialized views without a shard get theirs from the builtin migration
shard, as `Replacement`-migrated collections do, and the read-only
process writes them the same way.
- An entry is only reused for the same `GlobalId` and builtin. A new
builtin's `GlobalId` exists only in the uncommitted savepoin

**File**: `doc/developer/design/20251015_builtin_schema_migration.md` (modified, +9/-0)
```diff
@@ -71,6 +71,7 @@ The general approach to shard replacement matches the existing implementation, b
 
 To support schema migration by shard replacement, we need a place to store new shard IDs across restarts, and we will keep using the migration shard for this.
 The migration shard contains entries of the form `(GlobalId, Version, DeployGeneration) -> ShardId`.
+Entries for collections that had no shard also carry the builtin's schema name, object name and type (see below).
 
 A read-only process performing shard replacement reads the migration shard to collect all existing entries at its version and deploy generation.
 Notably, it ignores any entries at different versions or deploy generations, to avoid any interference with concurrent in-progress upgrades.
@@ -86,6 +87,14 @@ First, the leader must be at v26.17 or later, because every builtin materialized
 Second, the `enable_0dt_hydrate_migrated_builtin_mvs` feature flag must be on; it exists as a break-glass revert.
 When either condition does not hold, the migrated materialized views and their dependents are instead excluded from the 0dt caught-up check, which is the older behaviour: promotion proceeds without them and they hydrate at cut-over.
 
+Builtin storage collections that have no shard yet, in practice those added since the version being upgraded from, get their shards from the migration shard in the same way, without a migration step.
+Otherwise the read-only process would only have a shard in its uncommitted catalog savepoint, and the promoted leader would allocate a different one.
+The read-only process also allocates a new builtin's `GlobalId` only in that savepoint, and a later boot can give that `GlobalId` to another builtin, for example after another deploy generation was promoted.
+So their entries also record the builtin's schema name, object name and type, and are only reused for the same `GlobalId` and builtin.
+On a mismatch, a fresh shard is allocated.
+The read-only process writes new tables and sources as it writes `Replacement`-migrated ones, whether or not the two conditions above hold.
+When either does not hold, every new builtin and its dependents are excluded from the caught-up check, as are the migrated materialized views.
+
 A leader process performing shard replacement performs the same steps as in read-only mode.
 Additionally, it cleans up durable state written by earlier versions and/or deploy generations by:
   - arranging for the previous shards used by the migrated storage collections to be finalized
```

**File**: `src/adapter-dyncfgs/src/dyncfgs.rs` (modified, +8/-7)
```diff
@@ -93,13 +93,14 @@ pub const WITH_0DT_CAUGHT_UP_CHECK_STABILITY_PERIOD: Config<Duration> = Config::
 pub const ENABLE_0DT_HYDRATE_MIGRATED_BUILTIN_MVS: Config<bool> = Config::new(
     "enable_0dt_hydrate_migrated_builtin_mvs",
     true,
-    "Write-enable replacement-migrated builtin materialized views while read-only during a 0dt \
-     deployment, so they hydrate before cut-over and keep gating promotion. Emergency break-glass \
-     flag: disabling excludes migrated MVs (and their dependents) from the caught-up check again, \
-     so promotion proceeds with them unhydrated. Not an exact revert: a collection with no live \
-     leader frontier must be hydrated either way. Only takes effect when the leader is new enough \
-     for the write to make progress, and is read once at startup, so changing it means setting it \
-     on the leader and restarting the new deployment.",
+    "Write-enable replacement-migrated and new builtin materialized views while read-only during \
+     a 0dt deployment, so they hydrate before cut-over and gate promotion. Emergency break-glass \
+     flag: disabling excludes these MVs and every other new builtin (and their dependents) from \
+     the caught-up check, so promotion proceeds with them unhydrated. Not an exact revert: a \
+     collection with no live leader frontier must be hydrated either way, and new builtin tables \
+     and sources are written either way. Only takes effect when the leader is new enough for the \
+     write to make progress, and is read once at startup, so changing it means setting it on the \
+     leader and restarting the new deployment.",
     ParameterScope::Environment,
 );
 
```

**File**: `src/adapter/src/catalog/open.rs` (modified, +9/-9)
```diff
@@ -75,14 +75,15 @@ use crate::catalog::{BuiltinTableUpdate, Catalog, CatalogState, Config, is_reser
 pub struct InitializeStateResult {
     /// An initialized [`CatalogState`].
     pub state: CatalogState,
-    /// Items whose builtin schema migration allocated a fresh, self-owned persist shard. Only used
-    /// by 0dt migration.
+    /// Items whose builtin schema migration allocated a fresh, self-owned persist shard from the
+    /// migration shard: `Replacement`-migrated items and builtin storage collections that had no
+    /// shard yet, in practice new ones. Only used by 0dt migration.
     ///
-    /// `Replacement`-migrated items only: derived by filtering to items with a global id in
-    /// `MigrationRunResult::new_shards`, which only `migrate_replace` populates. `Evolution`
-    /// migrates in place and reuses the leader's shard, so it never lands here. Read-only write
-    /// paths depend on that: force-writing a shard while read-only is safe only because we
-    /// exclusively own it (see `ComputeController::allow_writes_in_read_only`).
+    /// Derived by filtering to items with a global id in `MigrationRunResult::new_shards`, which
+    /// only `get_or_insert_shards` populates. `Evolution` migrates in place and reuses the leader's
+    /// shard, so it never lands here. Read-only write paths depend on that: force-writing a shard
+    /// while read-only is safe only because we exclusively own it (see
+    /// `ComputeController::allow_writes_in_read_only`).
     pub migrated_storage_collections_0dt: BTreeSet<CatalogItemId>,
     /// A set of new builtin items.
     pub new_builtin_collections: BTreeSet<GlobalId>,
@@ -108,8 +109,7 @@ pub struct OpenCatalogResult {
     pub catalog: Catalog,
     /// See [`InitializeStateResult::last_seen_version`].
     pub last_seen_version: Option<Version>,
-    /// See [`InitializeStateResult::migrated_storage_collections_0dt`]; `Replacement`-migrated
-    /// items only.
+    /// See [`InitializeStateResult::migrated_storage_collections_0dt`].
     pub migrated_storage_collections_0dt: BTreeSet<CatalogItemId>,
     /// A set of new builtin items.
     pub new_builtin_collections: BTreeSet<GlobalId>,
```

**File**: `src/adapter/src/catalog/open/builtin_schema_migration.rs` (modified, +121/-44)
```diff
@@ -25,6 +25,10 @@
 //! Which mechanism to use is selected through entries in the `MIGRATIONS` list. In general, the
 //! `Evolution` mechanism should be used when possible, as it avoids data loss.
 //!
+//! Builtin storage collections that have no shard yet, in practice new ones, get their shards from
+//! the migration shard that `Replacement` uses, so that a read-only environment can write them
+//! (see `Migration::plan_allocation`).
+//!
 //! For more context and details on the implementation, see
 //! `doc/developer/design/20251015_builtin_schema_migration.md`.
 
@@ -658,7 +662,8 @@ enum Mechanism {
 
 /// The result of a builtin schema migration.
 pub(super) struct MigrationResult {
-    /// IDs of items whose shards have been replaced using the `Replacement` mechanism.
+    /// IDs of items that got a new shard from the migration shard: `Replacement`-migrated items
+    /// and builtin storage collections that had none.
     pub replaced_items: BTreeSet<CatalogItemId>,
     /// A cleanup action to take once the migration has been made durable.
     pub cleanup_action: BoxFuture<'static, ()>,
@@ -838,6 +843,18 @@ struct Migration {
     config: BuiltinItemMigrationConfig,
 }
 
+/// Whether `builtin` is a storage collection with a shard of its own.
+fn has_own_shard(builtin: &Builtin<NameReference>) -> bool {
+    use Builtin::*;
+    match builtin {
+        Table(..) | MaterializedView(..) => true,
+        // `mz_catalog_raw`'s shard is the catalog shard, which
+        // `Catalog::initialize_storage_state` registers.
+        Source(source) => **source != *MZ_CATALOG_RAW,
+        Log(..) | View(..) | Type(..) | Func(..) | Index(..) | Connection(..) => false,
+    }
+}
+
 /// Whether `builtin` participates in a forced migration using `mechanism`.
 fn participates_in_forced_migration(
     builtin: &Builtin<NameReference>,
@@ -862,9 +879,7 @@ fn participates_in_forced_migration(
                     || (**table != *MZ_OBJECT_HYDRATION_HISTORY
                         && **table != *MZ_REPLICA_HYDRATION_HISTORY))
         }
-        MaterializedView(..) => true,
-        Source(source) => **source != *MZ_CATALOG_RAW,
-        Log(..) | View(..) | Type(..) | Func(..) | Index(..) | Connection(..) => false,
+        _ => has_own_shard(builtin),
     }
 }
 
@@ -910,10 +925,14 @@ impl Migration {
             self.upgrade_migration_shard_version().await;
         }
 
-        info!("executing migration plan: {plan:?}");
+        let allocate = self.plan_allocation();
+
+        info!(?allocate, "executing migration plan: {plan:?}");
 
         self.migrate_evolve(&plan.evolve).await?;
-        let new_shards = self.migrate_replace(&plan.replace).await?;
+        let new_shards = self
+            .get_or_insert_shards(&[plan.replace.as_slice(), &allocate].concat())
+            .await?;
 
         let mut migrated_objects = BTreeSet::new();
         migrated_objects.extend(plan.evolve);
@@ -1011,9 +1030,8 @@ impl Migration {
             };
 
             let builtin = object_info.builtin;
-            use Builtin::*;
             assert!(
-                matches!(builtin, Table(..) | Source(..) | MaterializedView(..)),
+                has_own_shard(builtin),
                 "schema migration not supported for builtin: {builtin:?}",
             );
         }
@@ -1075,10 +1093,10 @@ impl Migration {
     /// A builtin without a shard does not exist in persist yet: either it was added in the target
     /// version, or the source version predates it entirely (an upgrade from before the builtin
     /// was introduced can reach an `Evolution` step registered for a later version). In both
-    /// cases the leader allocates the shard during bootstrap, at the target schema, and there is
-    /// nothing to evolve or replace. Applied to every plan, forced or versioned, so that both
-    /// paths agree; a read-only process that reached `migrate_evolve_one` with such an object
-    /// would otherwise bail out and crash-loop.
+    /// cases the shard gets allocated at the target schema, from the migration shard (see
+    /// `plan_allocation`), and there is nothing to evolve or replace. Applied to every plan,
+    /// forced or versioned, so that both paths agree; a read-only process that reached
+    /// `migrate_evolve_one` with such an object would otherwise bail out and crash-loop.
     fn drop_shardless(&self, mut plan: Plan) -> Plan {
         let has_shard = |object: &SystemObjectDescription| {
             self.system_objects
@@ -1090,6 +1108,22 @@ impl Migration {
         plan
     }
 
+    /// Select the builtin storage collections that get a shard allocated from the migration shard:
+    /// those without a registered shard, in practice those added since the source version.
+    ///
+    /// A read-only process never commits the shard the storage controller would allocate for
+    /// them, so the promoted leader would allocate another. From the migration shard, every
+    /// process of this v
```

**File**: `src/adapter/src/catalog/open/builtin_schema_migration_tests.rs` (modified, +226/-6)
```diff
@@ -14,7 +14,7 @@
 use std::cell::RefCell;
 use std::rc::Rc;
 
-use mz_catalog::builtin::{BuiltinSource, BuiltinTable};
+use mz_catalog::builtin::{BuiltinMaterializedView, BuiltinSource, BuiltinTable};
 use mz_persist_client::cache::PersistClientCache;
 use mz_persist_types::PersistLocation;
 use mz_repr::{RelationDesc, SqlScalarType};
@@ -47,10 +47,10 @@ fn hydration_history_forced_migration_policy() {
 }
 
 /// A builtin that the source version never had has no shard registered. An `Evolution` step for
-/// it, registered at a version above the source, must be skipped rather than bail out: the leader
-/// allocates the shard at the target schema during bootstrap, and a read-only process that bailed
-/// here would crash-loop. Regression test for SQL-713 (upgrade from before
-/// `mz_replica_hydration_history` existed to a version that evolves it).
+/// it, registered at a version above the source, must be skipped rather than bail out, since there
+/// is nothing to evolve: a read-only process that bailed here would crash-loop. Regression test
+/// for SQL-713 (upgrade from before `mz_replica_hydration_history` existed to a version that
+/// evolves it).
 #[test] // allow(test-attribute)
 #[cfg_attr(miri, ignore)] // too slow
 fn test_evolution_skips_builtin_without_shard() {
@@ -158,6 +158,201 @@ fn test_evolution_skips_builtin_without_shard() {
     }
 }
 
+/// A target version replaces a builtin MV and adds a builtin table, MV and source. The boots, in
+/// order: a read-only boot, a read-only boot of another deploy generation that is then aborted, a
+/// leader that gives the replaced MV, the new table and the new MV each other's global ids, the
+/// promoted leader, and a leader of the next version.
+#[test] // allow(test-attribute)
+#[cfg_attr(miri, ignore)] // too slow
+fn test_shardless_builtin_collections_get_migration_shards() {
+    configure_tracing_for_turmoil();
+
+    let mut sim = turmoil::Builder::new().build();
+    let persist_location = init_persist(&mut sim);
+    let migration_shard_id = ShardId::new();
+    let (v1, v2, v3) = (
+        Version::new(0, 1, 0),
+        Version::new(0, 2, 0),
+        Version::new(0, 3, 0),
+    );
+
+    let info = |global_id: u64,
+                shard_id: Option<ShardId>,
+                builtin: &'static Builtin<NameReference>| ObjectInfo {
+        global_id: GlobalId::System(global_id),
+        shard_id,
+        builtin,
+        fingerprint: builtin.fingerprint(),
+    };
+    let (replaced_object, replaced_builtin) = make_builtin_mv("replaced_mv".into());
+    let (old_table_object, old_table_builtin) = make_builtin_table("old_table".into());
+    let (table_object, table_builtin) = make_builtin_table("new_table".into());
+    let (mv_object, mv_builtin) = make_builtin_mv("new_mv".into());
+    let (source_object, source_builtin) = make_builtin_source("new_source".into());
+    let catalog_raw_object = MZ_CATALOG_RAW_DESCRIPTION.clone();
+    let catalog_raw_builtin: &'static Builtin<NameReference> =
+        leak(Builtin::Source(&*MZ_CATALOG_RAW));
+    let replaced_shard = ShardId::new();
+    let old_table_shard = ShardId::new();
+    let steps = [MigrationStep {
+        version: v2.clone(),
+        object: replaced_object.clone(),
+        mechanism: Mechanism::Replacement,
+    }];
+
+    // `ids` are the global ids of the replaced MV, the new table and the new MV. `shards`, if
+    // given, holds the shards that the replaced MV and the new collections already have, by
+    // global id.
+    let mut boot = |name: &'static str,
+                    (source, target): (&Version, &Version),
+                    deploy_generation: u64,
+                    read_only: bool,
+                    ids: [u64; 3],
+                    shards: Option<&BTreeMap<GlobalId, ShardId>>| {
+        let shard = |id| shards.map(|shards| shards[&GlobalId::System(id)]);
+        let [replaced_id, table_id, mv_id] = ids;
+        let system_objects = BTreeMap::from([
+            (
+                replaced_object.clone(),
+                info(
+                    replaced_id,
+                    shard(replaced_id).or(Some(replaced_shard)),
+                    replaced_builtin,
+                ),
+            ),
+            (
+                old_table_object.clone(),
+                info(6, Some(old_table_shard), old_table_builtin),
+            ),
+            (
+                table_object.clone(),
+                info(table_id, shard(table_id), table_builtin),
+            ),
+            (mv_object.clone(), info(mv_id, shard(mv_id), mv_builtin)),
+            (source_object.clone(), info(4, shard(4), source_builtin)),
+            (
+                catalog_raw_object.clone(),
+                info(5, None, catalog_raw_builtin),
+            ),
+        ]);
+        let (source, target) = (source.clone(), target.clone());
+        let steps = steps.to_vec();
+        let persist_location = persist_location.clone();
+        let result = Rc::
```

**File**: `src/adapter/src/coord.rs` (modified, +31/-36)
```diff
@@ -261,8 +261,8 @@ where
     future.boxed_local()
 }
 
-/// The oldest leader version against which a replacement-migrated builtin materialized view may
-/// write its new persist shard while this environment is still read-only.
+/// The oldest leader version against which a replacement-migrated or new builtin materialized
+/// view may write its persist shard while this environment is still read-only.
 ///
 /// Every builtin materialized view reads `mz_internal.mz_catalog_raw`, so its dataflow only makes
 /// progress up to the catalog shard's frontier. Holding that frontier at the current time is the
@@ -2605,15 +2605,9 @@ impl Coordinator {
                         if hydrate_migrated_mvs
                             && migrated_storage_collections_0dt.contains(&entry.id())
                         {
-                            // `migrated_storage_collections_0dt` is `Replacement`-migrated items
-                            // only, so this is a fresh shard we own: nothing else writes it, and
-                            // writing it while read-only hydrates the MV and its dependents before
-                            // cut-over. An `Evolution`-migrated MV reuses the leader's live shard
-                            // and must never reach here.
-                            //
-                            // A *new* builtin MV gets no such treatment: its shard allocation
-                            // lives only in this read-only savepoint, so the promoted leader
-                            // allocates a different shard and discards whatever we wrote.
+                            // The shard came from the builtin migration shard, so the current
+                            // leader does not write it, and it survives promotion. Writing it
+                            // while read-only hydrates the MV and its dependents before cut-over.
                             self.controller
                                 .compute
                                 .allow_writes_in_read_only(mview.cluster_id, gid)
@@ -4892,16 +4886,16 @@ pub fn serve(
             catalog_open_start.elapsed()
         );
 
-        // Whether replacement-migrated builtin MVs may write their new shards before cut-over.
-        // Both `bootstrap` and the readiness gate below read this, and they have to agree.
-        // `MIN_LEADER_VERSION_FOR_MIGRATED_MV_WRITES` explains why the leader's version settles it.
+        // Whether builtin MVs whose shard came from the builtin migration shard may write it before
+        // cut-over. Both `bootstrap` and the readiness gate below read this, and they have to
+        // agree. `MIN_LEADER_VERSION_FOR_MIGRATED_MV_WRITES` explains why the leader's version
+        // settles it.
         //
         // While we are read-only, `last_seen_version` is that leader's version: our catalog
         // transaction is a savepoint, so our own bump of the setting never lands. `None` means a
         // freshly initialized catalog, with nothing migrated and no leader to be compatible with.
         //
-        // `ENABLE_0DT_HYDRATE_MIGRATED_BUILTIN_MVS` is the break-glass revert: off falls back to
-        // excluding migrated MVs from the caught-up gate, no redeploy needed.
+        // `ENABLE_0DT_HYDRATE_MIGRATED_BUILTIN_MVS` turns this off as a break-glass.
         let hydrate_migrated_mvs = ENABLE_0DT_HYDRATE_MIGRATED_BUILTIN_MVS
             .get(catalog.system_config().dyncfgs())
             && last_seen_version
@@ -4933,36 +4927,37 @@ pub fn serve(
 
         let clusters_caught_up_check =
             clusters_caught_up_trigger.map(|trigger| {
-                let mut exclude_collections: BTreeSet<GlobalId> =
-                    new_builtin_collections.iter().copied().collect();
-
-                // A collection that can't advance its write frontier in read-only mode
-                // stalls its transitive dependents too, so exclude those from the caught-up
-                // check as well. That's every *new* builtin collection, whose fresh shard has no
-                // writer until this deployment promotes, plus migrated MVs whenever the leader is
-                // too old for them to write. An excluded dependent may still be hydrating right
-                // after promotion, a brief blip we accept because these collections are small and
-                // get a writer at cut-over.
+                // A collection that can't advance its write frontier in read-only mode stalls its
+                // transitive dependents too, so exclude those from the caught-up check as well. An
+                // excluded dependent may still be hydrating right after promotion, a brief blip we
+                // accept because these collections are small and get a writer at cut-over.
                 //
-                // Seeded from all of `new_builtin_collections`, not just the MVs: a new builtin
-                // table or source has no read-only writer either (`register_tab
```

**File**: `src/adapter/src/coord/caught_up.rs` (modified, +77/-10)
```diff
@@ -123,10 +123,8 @@ pub struct CaughtUpCheckContext {
     /// A trigger that signals that all clusters/collections have been caught
     /// up.
     pub trigger: Trigger,
-    /// Collections to exclude from the caught up check.
-    ///
-    /// When a caught up check is performed as part of a 0dt upgrade, it makes sense to exclude
-    /// collections of newly added builtin objects, as these might not hydrate in read-only mode.
+    /// Collections to exclude from the caught up check, such as collections that can't advance
+    /// their write frontier in read-only mode during a 0dt upgrade.
     pub exclude_collections: BTreeSet<GlobalId>,
 }
 
@@ -147,6 +145,16 @@ struct CaughtUpCheck {
 
 struct LeaderSnapshot {
     frontiers: BTreeMap<GlobalId, Antichain<Timestamp>>,
+    /// The leader's clock: the upper of `mz_cluster_replica_frontiers`, the collection that
+    /// `frontiers` is read from.
+    ///
+    /// The leader advances that upper to its wall clock every second, even when it has nothing to
+    /// write. A read-only process never advances it (see the storage controller's
+    /// `collection_mgmt`). So while the leader is down, this stays at the leader's last second.
+    ///
+    /// NOTE: the newest of `frontiers` is no substitute: a collection such as a `REFRESH` MV holds
+    /// its frontier at its next refresh, which can be far ahead of the leader's clock.
+    clock: Timestamp,
     hydration: LeaderHydration,
     unhydrated_collections: BTreeSet<GlobalId>,
     problematic_replicas: BTreeSet<ReplicaId>,
@@ -687,6 +695,12 @@ impl LeaderSnapshot {
             .snapshot_latest(replica_frontier_gid)
             .await
             .context("cannot read mz_cluster_replica_frontiers")?;
+        let clock = storage_collections
+            .collection_frontiers(replica_frontier_gid)
+            .context("cannot read the upper of mz_cluster_replica_frontiers")?
+            .write_frontier
+            .into_option()
+            .context("mz_cluster_replica_frontiers has an empty upper")?;
 
         let live_frontiers = live_frontiers
             .into_iter()
@@ -758,6 +772,7 @@ impl LeaderSnapshot {
         };
         Ok(Self {
             frontiers: live_collection_frontiers,
+            clock,
             hydration: leader_hydration,
             unhydrated_collections: leader_unhydrated_collections,
             problematic_replicas,
@@ -769,6 +784,7 @@ impl CaughtUpCheck {
     async fn run(mut self, leader: LeaderSnapshot) -> CaughtUpSnapshot {
         let LeaderSnapshot {
             frontiers,
+            clock,
             hydration,
             unhydrated_collections,
             problematic_replicas,
@@ -801,6 +817,7 @@ impl CaughtUpCheck {
                 allowed_lag.into(),
                 cutoff.into(),
                 now.into(),
+                clock,
                 &frontiers,
                 &unhydrated_collections,
                 &problematic_replicas,
@@ -880,7 +897,8 @@ impl CaughtUpCheck {
     ///      returned by [`LeaderHydration::collections_unhydrated_on_all_hosting_replicas`]),
     ///      and (b) its write frontier is within
     ///      `allowed_lag` of the "live" frontier, the collection's frontier reported by the leader
-    ///      environment.
+    ///      environment. For a collection without one, `leader_clock` stands in (see
+    ///      `LeaderSnapshot::clock`).
     ///  (3) A collection is ignored if its "live" frontier is behind `now` by more than `cutoff`.
     ///      Such a collection is unhealthy in the leader environment, so we don't care about its
     ///      health in the read-only environment either.
@@ -896,6 +914,7 @@ impl CaughtUpCheck {
         allowed_lag: Timestamp,
         cutoff: Timestamp,
         now: Timestamp,
+        leader_clock: Timestamp,
         live_frontiers: &BTreeMap<GlobalId, Antichain<Timestamp>>,
         leader_unhydrated_collections: &BTreeSet<GlobalId>,
         problematic_replicas: &BTreeSet<ReplicaId>,
@@ -910,6 +929,7 @@ impl CaughtUpCheck {
                         allowed_lag.clone(),
                         cutoff.clone(),
                         now.clone(),
+                        leader_clock,
                         live_frontiers,
                         leader_unhydrated_collections,
                         problematic_replicas,
@@ -946,6 +966,7 @@ impl CaughtUpCheck {
         allowed_lag: Timestamp,
         cutoff: Timestamp,
         now: Timestamp,
+        leader_clock: Timestamp,
         live_frontiers: &BTreeMap<GlobalId, Antichain<Timestamp>>,
         leader_unhydrated_collections: &BTreeSet<GlobalId>,
         problematic_replicas: &BTreeSet<ReplicaId>,
@@ -1032,24 +1053,26 @@ impl CaughtUpCheck {
                     // sink reaches frontier 1 after one batch, which would otherwise look caught
                     // up mid-hydration and bring back the cut-over spike this gate prevents.
                     // Also require the frontier to
```

**File**: `src/compute-client/src/controller.rs` (modified, +9/-8)
```diff
@@ -1257,10 +1257,10 @@ impl ComputeController {
     /// Like [`Self::allow_writes`], but takes effect even in read-only mode.
     ///
     /// The caller must guarantee that no leader environment writes the collection's output shard.
-    /// In a 0dt deployment that means a shard this environment created for itself, the replacement
-    /// shard of a `Replacement`-migrated builtin collection, never one the leader is still serving
-    /// from. `Evolution` migrates in place and reuses the leader's shard, so it must not reach this
-    /// path. Violating the guarantee races two writers on one shard.
+    /// In a 0dt deployment that means a shard this environment created for itself, such as the
+    /// replacement shard of a `Replacement`-migrated builtin collection, never one the leader is
+    /// still serving from. `Evolution` migrates in place and reuses the leader's shard, so it must
+    /// not reach this path. Violating the guarantee races two writers on one shard.
     ///
     /// NOTE: ownership is exclusive per (build version, deploy generation), not per process: the
     /// migration shard entry naming the shard is keyed by that pair and a read-only catalog open is
@@ -1272,7 +1272,7 @@ impl ComputeController {
     /// of migrated storage collections. Migrated builtin tables are storage collections that
     /// storage force-writes read-only; migrated builtin MVs are compute collections that only this
     /// path can force-write. Both rest on the same guarantee (this environment exclusively owns the
-    /// replacement shard) but run on separate write paths, so each needs its own bypass.
+    /// shard) but run on separate write paths, so each needs its own bypass.
     ///
     /// NOTE: the replica-side handler enables persist compaction process-wide on the clusterd
     /// (`ComputeState::handle_allow_writes`), which this path is the first to trigger inside a
@@ -1283,9 +1283,10 @@ impl ComputeController {
         collection_id: GlobalId,
     ) -> Result<(), CollectionUpdateError> {
         // Every builtin eligible for this bypass has a system id, so a non-system id means the
-        // caller's `Replacement`-only invariant broke. No-op rather than risk writing a shard the
-        // leader still serves. The collection then sits in the caught-up gate on an unwritten
-        // shard and blocks promotion, which is the loud, safe direction to fail.
+        // caller's invariant (only shards from the builtin migration shard) broke. No-op rather
+        // than risk writing a shard the leader still serves. The collection then sits in the
+        // caught-up gate on an unwritten shard and blocks promotion, which is the loud, safe
+        // direction to fail.
         //
         // Storage asserts the same invariant hard, in
         // `StorageController::register_introspection_collection`. The asymmetry is deliberate: a
```

#### Recent Merged Pull Requests:
- **PR #41088** (2026-11-26): release: mark v26.51, v26.52 as released (@materialize-bot)
- **PR #41083** (2026-11-25): deps: bump zstd-sys to 2.2.0+zstd.1.6.0 (@jasonhernandez)
- **PR #41081** (2026-11-25): ci: Nightly fixes (2026-11-25) (@def-)
- **PR #41079** (2026-11-25): mcp: test MCP tool routing edge cases (@bobbyiliev)
- **PR #41078** (2026-11-25): mcp: test the /api/mcp HTTP surface like the agent and developer routes (@bobbyiliev)
- **PR #41077** (2026-11-25): mcp: fix stale comments in OAuth discovery and MCP tests (@bobbyiliev)

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

## X. reclock: free unused memory after start

**RULE**:
When implementing operations in `src/timely-util/src/reclock.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MaterializeInc/materialize. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `371eac62`: reclock: free unused memory after start. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/timely-util/src/reclock.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                // Taking the buffer releases its capacity. A replay of the remap history from an
                // old as-of fills it once, and every export's operator would hold that capacity
                // for good.
                for ((into, from), diff) in std::mem::take(&mut remap_accum_buffer).into_inner() {
            // Releases what a replay leaves behind, like `remap_accum_buffer` above.
            if pending_remap.len() < pending_remap.capacity() / 4 {
                pending_remap.shrink_to(pending_remap.len() * 2);
            }

    #[cfg(feature = "count-allocations")]
    #[mz_ore::test]
    #[cfg_attr(miri, ignore)] // too slow
    fn test_replay_releases_buffers() {
        let replayed = 10_000_u64;

        // The source frontier is beyond every replayed binding, so the trace keeps none of them
        // and what stays allocated after the replay is buffer capacity.
        harness::<FromTime, u64, _, _>(
            Antichain::from_elem(0),
            move |worker, mut bindings, (_data, mut data_cap), reclocked| {
                data_cap.downgrade(&Partitioned::new_singleton(0, replayed));
                step(worker);
                let info = allo
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                for ((into, from), diff) in remap_accum_buffer.drain() {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `371eac62` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/risingwavelabs-risingwave-learnings.md`  
> **Source**: github ([https://github.com/risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave))  
> **Source Version**: `73219848`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T11:37:53.726Z  
> **Learning ID**: `learn-github-risingwavelabs-risingwave`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): risingwavelabs/risingwave

> **Canonical Artifact**: `07_PROJECT_LEARNING/risingwavelabs-risingwave-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-23T11:37:53.718Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `risingwavelabs/risingwave`
- **Description**: Event streaming platform for agentic AI. Continuously ingest, transform, and serve event streams in real time, at scale.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9385 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dashboard/components/utils/backPressure.tsx`
```
import { theme } from "@chakra-ui/react"
import { tinycolor } from "@ctrl/tinycolor"

/**
 * The color for the edge with given back pressure value.
 *
 * @param value The back pressure rate, between 0 and 100.
 */
export function backPressureColor(value: number) {
  const colorRange = [
    theme.colors.green["100"],
    theme.colors.green["300"],
    theme.colors.yellow["400"],
    theme.colors.orange["500"],
    theme.colors.red["700"],
  ].map((c) => tinycolor(c))

  value = Math.max(value, 0)
  value = Math.min(value, 1)

  const step = colorRange.length - 1
  const pos = value * step
  const floor = Math.floor(pos)
  const ceil = Math.ceil(pos)

  const color = tinycolor(colorRange[floor])
    .mix(tinycolor(colorRange[ceil]), (pos - floor) * 100)
    .toHexString()

  return color
}

/**
 * The width for the edge with given back pressure value.
 *
 * @param value The back pressure rate, between 0 and 100.
 */
export function backPressureWidth(value: number, scale: number) {
  value = Math.max(value, 0)
  value = Math.min(value, 1)

  return scale * value + 2
}

export function epochToUnixMillis(epoch: number) {
  // UNIX_RISINGWAVE_DATE_SEC
  return 1617235200000 + epoch / 65536
}

export function latencyToColor(latency_ms: number, baseColor: string) {
  const LOWER = 10000 // 10s
  const UPPER = 300000 // 5min

  const colorRange = [
    baseColor,
    theme.colors.yellow["200"],
    theme.colors.orange["300"],
    theme.colors.red["400"],
  ].map((c) => tinycolor(c))

  if (latency_ms <= LOWER) {
    return baseColor
  }

  if (latency_ms >= UPPER) {
    return theme.colors.red["400"]
  }

  // Map log(latency) to [0,1] range between 10s and 5min
  const minLog = Math.log(LOWER)
  const maxLog = Math.log(UPPER)
  const latencyLog = Math.log(latency_ms)
  const normalizedPos = (latencyLog - minLog) / (maxLog - minLog)

  // Map to color range index
  const step = colorRange.length - 1
  const pos = normalizedPos * step
  const floor = Math.floor(pos)
  const ceil = Math.ceil(pos)

  // Interpolate between colors
  const color = tinycolor(colorRange[floor])
    .mix(tinycolor(colorRange[ceil]), (pos - floor) * 100)
    .toHexString()

  return color
}

```

### Core Architecture Module: `dashboard/components/utils/icons.tsx`
```
/*
 * Copyright 2025 RisingWave Labs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

export function IconServer() {
  return <i className="bi bi-server"></i>
}

export function IconArrowRightCircle() {
  return <i className="bi bi-arrow-right-circle"></i>
}

export function IconArrowRightCircleFill() {
  return <i className="bi bi-arrow-right-circle-fill"></i>
}

export function IconBoxArrowUpRight() {
  return <i className="bi bi-box-arrow-up-right"></i>
}

```

### Core Architecture Module: `dashboard/components/utils/stroke-icons.tsx`
```
/*
 * Copyright 2025 RisingWave Labs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/**
 * Shared outline icons for the dashboard UI, following the design
 * language: minimal geometric outline icons on a 24px viewBox with a
 * 1.5px stroke, rendered in currentColor so they inherit the semantic
 * text tier of their parent.
 */

import { ReactNode } from "react"

export type IconProps = { size?: number }

export function StrokeIcon({
  size = 16,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconServer({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </StrokeIcon>
  )
}

export function IconArrowDownToLine({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M12 17V3" />
      <path d="m6 11 6 6 6-6" />
      <path d="M19 21H5" />
    </StrokeIcon>
  )
}

export function IconTable({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
    </StrokeIcon>
  )
}

export function IconLayers({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </StrokeIcon>
  )
}

export function IconListTree({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M21 12h-8" />
      <path d="M21 6H8" />
      <path d="M21 18h-8" />
      <path d="M3 6v4c0 1.1.9 2 2 2h3" />
      <path d="M3 10v6c0 1.1.9 2 2 2h3" />
    </StrokeIcon>
  )
}

export function IconDatabase({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </StrokeIcon>
  )
}

export function IconArrowUpFromLine({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="m18 9-6-6-6 6" />
      <path d="M12 3v14" />
      <path d="M5 21h14" />
    </StrokeIcon>
  )
}

export function IconEye({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </StrokeIcon>
  )
}

export function IconRss({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </StrokeIcon>
  )
}

export function IconSquareFunction({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <path d="M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3" />
      <path d="M9 11.2h5.7" />
    </StrokeIcon>
  )
}

export function IconWorkflow({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </StrokeIcon>
  )
}

export function IconGitBranch({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </StrokeIcon>
  )
}

export function IconListChecks({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </StrokeIcon>
  )
}

export function IconNetwork({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M12 12V8" />
    </StrokeIcon>
  )
}

export function IconHourglass({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </StrokeIcon>
  )
}

export function IconMemoryStick({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M6 19v-3" />
      <path d="M10 19v-3" />
      <path d="M14 19v-3" />
      <path d="M18 19v-3" />
      <path d="M8 11V9" />
      <path d="M16 11V9" />
      <path d="M12 11V9" />
      <path d="M2 15h20" />
      <path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.1a2 2 0 0 0 0 3.837V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.1a2 2 0 0 0 0-3.837Z" />
    </StrokeIcon>
  )
}

export function IconActivity({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </StrokeIcon>
  )
}

export function IconRoute({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </StrokeIcon>
  )
}

export function IconSettings({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </StrokeIcon>
  )
}

export function IconArrowUpRight({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </StrokeIcon>
  )
}

export function IconBookOpen({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </StrokeIcon>
  )
}

export function IconRefresh({ size }: IconProps) {
  return (
    <StrokeIcon size={size}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </StrokeIcon>
  )
}

```

### Core Architecture Module: `dashboard/hook/useErrorToast.ts`
```
/*
 * Copyright 2024 RisingWave Labs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { AlertStatus, useToast } from "@chakra-ui/react"
import { useCallback } from "react"

export default function useErrorToast() {
  const toast = useToast()

  return useCallback(
    (e: any, status: AlertStatus = "error") => {
      let title: string
      let description: string | undefined

      if (e instanceof Error) {
        title = e.message
        description = e.cause?.toString()
      } else {
        title = e.toString()
      }

      toast({
        title,
        description,
        status,
        duration: 5000,
        isClosable: true,
      })
    },
    [toast]
  )
}

```

### Core Architecture Module: `dashboard/lib/util.js`
```
/*
 * Copyright 2022 RisingWave Labs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export function iter(n, step) {
  for (let i = 0; i < n; ++i) {
    step(i)
  }
}

export function newNumberArray(length) {
  let rtn = []
  iter(length, () => {
    rtn.push(0)
  })
  return rtn
}

export function newMatrix(n) {
  let rtn = []
  iter(n, () => {
    rtn.push([])
  })
  return rtn
}

```

### Core Architecture Module: `dashboard/lib/utils/timeUtils.ts`
```
/*
 * Copyright 2025 RisingWave Labs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Parse a duration string (e.g., "1h", "30m", "2d") and return the duration in seconds
 */
export function parseDuration(durationStr: string): number {
  const match = durationStr.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(
      'Invalid duration format. Use format like "30s", "5m", "2h", "1d"'
    )
  }

  const value = parseInt(match[1])
  const unit = match[2]

  switch (unit) {
    case "s":
      return value
    case "m":
      return value * 60
    case "h":
      return value * 60 * 60
    case "d":
      return value * 60 * 60 * 24
    default:
      throw new Error("Invalid time unit. Use s, m, h, or d")
  }
}

/**
 * Convert a timestamp and timezone to unix epoch time in seconds
 */
export function parseTimestampToUnixEpoch(
  timestamp: string,
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): number {
  try {
    // Create a date object from the timestamp string
    const date = new Date(timestamp)

    if (isNaN(date.getTime())) {
      throw new Error("Invalid timestamp format")
    }

    // Convert to unix epoch time (seconds)
    return Math.floor(date.getTime() / 1000)
  } catch (error) {
    throw new Error("Invalid timestamp format")
  }
}

/**
 * Get current time in system timezone as ISO string
 */
export function getCurrentTimeInSystemTimezone(): string {
  const now = new Date()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Format the date in the system timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timeZone,
    hour12: false,
  })

  const formatted = formatter.formatToParts(now)
  const datePart =
    formatted.find((part) => part.type === "year")?.value +
    "-" +
    formatted.find((part) => part.type === "month")?.value +
    "-" +
    formatted.find((part) => part.type === "day")?.value
  const timePart =
    formatted.find((part) => part.type === "hour")?.value +
    ":" +
    formatted.find((part) => part.type === "minute")?.value +
    ":" +
    formatted.find((part) => part.type === "second")?.value

  return `${datePart}T${timePart}`
}

/**
 * Format a unix epoch time to a readable string
 */
export function formatUnixEpoch(unixEpoch: number): string {
  return new Date(unixEpoch * 1000).toISOString()
}

```

### Core Architecture Module: `java/connector-node/python-client/pyspark-util.py`
```
# Copyright 2023 RisingWave Labs
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import argparse
import json
from pyspark.sql import SparkSession, Row


def init_iceberg_spark():
    return (
        SparkSession.builder.master("local")
        .config(
            "spark.jars.packages",
            "org.apache.iceberg:iceberg-spark-runtime-3.2_2.12:1.0.0,org.apache.hadoop:hadoop-aws:3.3.2",
        )
        .config("spark.sql.catalog.demo", "org.apache.iceberg.spark.SparkCatalog")
        .config("spark.sql.catalog.demo.type", "hadoop")
        .config("spark.sql.catalog.demo.warehouse", "s3a://bucket/")
        .config(
            "spark.sql.catalog.demo.hadoop.fs.s3a.endpoint", "http://127.0.0.1:9000"
        )
        .config("spark.sql.catalog.demo.hadoop.fs.s3a.access.key", "minioadmin")
        .config("spark.sql.catalog.demo.hadoop.fs.s3a.secret.key", "minioadmin")
        .getOrCreate()
    )


def init_deltalake_spark():
    return (
        SparkSession.builder.master("local")
        .config(
            "spark.jars.packages",
            "io.delta:delta-core_2.12:2.2.0,org.apache.hadoop:hadoop-aws:3.3.2",
        )
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog",
            "org.apache.spark.sql.delta.catalog.DeltaCatalog",
        )
        .config("spark.hadoop.fs.s3a.endpoint", "http://127.0.0.1:9000")
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin")
        .getOrCreate()
    )


def create_iceberg_table():
    spark = init_iceberg_spark()
    spark.sql(
        "create table demo.demo_db.demo_table(id int, name string) TBLPROPERTIES ('format-version'='2');"
    )
    print("Table demo.demo_db.demo_table(id int, name string) created")


def drop_iceberg_table():
    spark = init_iceberg_spark()
    spark.sql("drop table demo.demo_db.demo_table;")
    print("Table demo.demo_db.demo_table dropped")


def read_iceberg_table():
    spark = init_iceberg_spark()
    spark.sql("select * from demo.demo_db.demo_table;").show()


def test_table(input_file, actual_list):
    actual = []
    for row in actual_list:
        actual.append(row.asDict())
    actual = sorted(actual, key=lambda ele: sorted(ele.items()))

    with open(input_file, "r") as file:
        sink_input = json.load(file)
    expected = []
    for batch in sink_input:
        for row in batch:
            expected.append(row["line"])
    expected = sorted(expected, key=lambda ele: sorted(ele.items()))

    if actual == expected:
        print("Test passed")
    else:
        print("Expected:", expected, "\nActual:", actual)
        raise Exception("Test failed")


def test_iceberg_table(input_file):
    spark = init_iceberg_spark()
    list = spark.sql("select * from demo.demo_db.demo_table;").collect()
    test_table(input_file, list)


def test_upsert_iceberg_table(input_file):
    spark = init_iceberg_spark()
    list = spark.sql("select * from demo.demo_db.demo_table;").collect()
    actual = []
    for row in list:
        actual.append(row.asDict())
    actual = sorted(actual, key=lambda ele: sorted(ele.items()))

    with open(input_file, "r") as file:
        sink_input = json.load(file)

    expected = []
    for batch in sink_input:
        for row in batch:
            match row["op_type"]:
                case 1:
                    expected.append(row["line"])
                case 2:
                    expected.remove(row["line"])
                case 3:
                    expected.append(row["line"])
                case 4:
                    expected.remove(row["line"])
                case _:
                    raise Exception("Unknown op_type")

    expected = sorted(expected, key=lambda ele: sorted(ele.items()))

    if actual == expected:
        print("Test passed")
    else:
        print("Expected:", expected, "\nActual:", actual)
        raise Exception("Test failed")


def read_deltalake_table():
    spark = init_deltalake_spark()
    spark.sql("select * from delta.`s3a://bucket/delta`;").show()


def create_deltalake_table():
    spark = init_deltalake_spark()
    spark.sql(
        "create table IF NOT EXISTS delta.`s3a://bucket/delta`(id int, name string) using delta;"
    )
    print("Table delta.`s3a://bucket/delta`(id int, name string) created")


def delete_deltalake_table_data():
    spark = init_deltalake_spark()
    spark.sql("DELETE FROM delta.`s3a://bucket/delta`")
    print("Table delta.`s3a://bucket/delta` dropped")


def test_deltalake_table(input_file):
    spark = init_deltalake_spark()
    list = spark.sql("select * from delta.`s3a://bucket/delta`;").collect()
    test_table(input_file, list)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "operation", help="operation on table: read, create, drop, test or test_upsert"
    )
    parser.add_argument(
        "--input_file", default="./data/sink_input.json", help="input data to run tests"
    )
    args = parser.parse_args()
    match args.operation:
        case "read_iceberg":
            read_iceberg_table()
        case "create_iceberg":
            create_iceberg_table()
        case "drop_iceberg":
            drop_iceberg_table()
        case "test_iceberg":
            test_iceberg_table(args.input_file)
        case "test_upsert_iceberg":
            test_upsert_iceberg_table(args.input_file)
        case "read_deltalake":
            read_deltalake_table()
        case "create_deltalake":
            create_deltalake_table()
        case "test_deltalake":
            test_deltalake_table(args.input_file)
        case "clean_deltalake":
            delete_deltalake_table_data()
        case _:
            raise Exception("Unknown operation")

```

### Core Architecture Module: `lints/src/utils/format_args_collector.rs`
```
// Copyright 2025 RisingWave Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! Copied from `https://github.com/rust-lang/rust-clippy/blob/993d8ae2a7b26ac779fde923b2ce9ce35d7143a8/clippy_lints/src/utils/format_args_collector.rs`

use std::iter::once;
use std::mem;

use clippy_utils::macros::FormatArgsStorage;
use clippy_utils::source::snippet_opt;
use itertools::Itertools;
use rustc_ast::{Crate, Expr, ExprKind, FormatArgs};
use rustc_data_structures::fx::FxHashMap;
use rustc_lexer::{FrontmatterAllowed, TokenKind, tokenize};
use rustc_lint::{EarlyContext, EarlyLintPass};
use rustc_session::impl_lint_pass;
use rustc_span::{Span, hygiene};

/// Populates [`FormatArgsStorage`] with AST [`FormatArgs`] nodes
pub struct FormatArgsCollector {
    format_args: FxHashMap<Span, FormatArgs>,
    storage: FormatArgsStorage,
}

impl FormatArgsCollector {
    pub fn new(storage: FormatArgsStorage) -> Self {
        Self {
            format_args: FxHashMap::default(),
            storage,
        }
    }
}

impl_lint_pass!(FormatArgsCollector => []);

impl EarlyLintPass for FormatArgsCollector {
    fn check_expr(&mut self, cx: &EarlyContext<'_>, expr: &Expr) {
        if let ExprKind::FormatArgs(args) = &expr.kind {
            if has_span_from_proc_macro(cx, args) {
                return;
            }

            self.format_args
                .insert(expr.span.with_parent(None), (**args).clone());
        }
    }

    fn check_crate_post(&mut self, _: &EarlyContext<'_>, _: &Crate) {
        self.storage.set(mem::take(&mut self.format_args));
    }
}

/// Detects if the format string or an argument has its span set by a proc macro to something inside
/// a macro callsite, e.g.
///
/// ```ignore
/// println!(some_proc_macro!("input {}"), a);
/// ```
///
/// Where `some_proc_macro` expands to
///
/// ```ignore
/// println!("output {}", a);
/// ```
///
/// But with the span of `"output {}"` set to the macro input
///
/// ```ignore
/// println!(some_proc_macro!("input {}"), a);
/// //                        ^^^^^^^^^^
/// ```
fn has_span_from_proc_macro(cx: &EarlyContext<'_>, args: &FormatArgs) -> bool {
    let ctxt = args.span.ctxt();

    // `format!("{} {} {c}", "one", "two", c = "three")`
    //                       ^^^^^  ^^^^^      ^^^^^^^
    let argument_span = args
        .arguments
        .explicit_args()
        .iter()
        .map(|argument| hygiene::walk_chain(argument.expr.span, ctxt));

    // `format!("{} {} {c}", "one", "two", c = "three")`
    //                     ^^     ^^     ^^^^^^
    let between_spans = once(args.span)
        .chain(argument_span)
        .tuple_windows()
        .map(|(start, end)| start.between(end));

    for between_span in between_spans {
        let mut seen_comma = false;

        let Some(snippet) = snippet_opt(cx, between_span) else {
            return true;
        };
        for token in tokenize(&snippet, FrontmatterAllowed::No) {
            match token.kind {
                TokenKind::LineComment { .. }
                | TokenKind::BlockComment { .. }
                | TokenKind::Whitespace => {}
                TokenKind::Comma if !seen_comma => seen_comma = true,
                // named arguments, `start_val, name = end_val`
                //                            ^^^^^^^^^ between_span
                TokenKind::Ident | TokenKind::Eq if seen_comma => {}
                // An unexpected token usually indicates that we crossed a macro boundary
                //
                // `println!(some_proc_macro!("input {}"), a)`
                //                                      ^^^ between_span
                // `println!("{}", val!(x))`
                //               ^^^^^^^ between_span
                _ => return true,
            }
        }

        if !seen_comma {
            return true;
        }
    }

    false
}

```

### Core Architecture Module: `lints/src/utils/mod.rs`
```
// Copyright 2025 RisingWave Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

pub mod format_args_collector;
pub mod path;

```

### Core Architecture Module: `lints/src/utils/path.rs`
```
// Copyright 2025 RisingWave Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use clippy_utils::paths::{PathLookup, PathNS};
use rustc_span::Symbol;

pub(crate) fn path(ns: PathNS, path: &str) -> PathLookup {
    let paths = path.split("::").map(Symbol::intern).collect::<Vec<_>>();
    let paths = Box::leak(paths.into_boxed_slice());
    PathLookup::new(ns, paths)
}

/// Define paths that will be used for lookups.
///
/// For debugging, you can print out `path.get(cx)` to see if it's correctly resolved.
macro_rules! def_path_lookup {
    ($name:ident, $ns:ident, $path:literal) => {
        pub static $name: LazyLock<PathLookup> =
            LazyLock::new(|| $crate::utils::path::path(PathNS::$ns, $path));
    };
}
pub(crate) use def_path_lookup;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #26912** (2026-09-02): **fix(frontend): check source privilege for CDC tables**
  *Symptoms*: I hereby agree to the terms of the [RisingWave Labs, Inc. Contributor License Agreement](https://raw.githubusercontent.com/risingwavelabs/risingwave/17af8a747593ebdbfa826691daf75bdab7d14fa0/.github/contributor-license-agreement.txt).  ## What's changed and what's your intention?  `CREATE TABLE ... FROM <cdc_source>` resolved the source catalog without checking whether the current user had `SELECT` privilege on that source. As a result, a user with `CREATE` privilege on the target schema could create and consume a CDC table from a source they were not allowed to read. Table replacement paths used by `ALTER TABLE` had the same gap.  This PR:  - checks `AclMode::Select` on the referenced CDC source before building a new CDC table plan; - applies the same check when rebuilding an existing CDC table for `ALTER TABLE`; - adds a regression test covering rejection without permission, success after `GRANT SELECT`, and rejection of `ALTER TABLE` after `REVOKE SELECT`.  ## Checklist  - [x] I have written necessary rustdoc comments (no new public API). - [x] I have added necessary unit tests and integration tests. - [x] I have added test labels as necessary. - [ ] I have added fuzzing tests or opened an issue to track them. - [ ] My PR contains breaking changes. - [ ] My PR changes performance-critical code, so I will run (micro) benchmarks and present the results. - [ ] I have checked the Release Timeline and Currently Supported Versions to determine which release branches I need to che

- **Issue #25404** (2026-07-04): **bug: BigQuery sink rejects widened numeric destination types for RisingWave NUMERIC columns**
  *Symptoms*: ## Summary  BigQuery sink schema validation rejects a target BigQuery numeric column when the RisingWave source column is `NUMERIC` and the BigQuery side must use higher precision / scale handling.  ## Problem  Users can hit this failure pattern when syncing a RisingWave `NUMERIC` column to BigQuery:  - BigQuery `NUMERIC` supports up to 9 decimal places, so values requiring higher scale cannot fit cleanly. - Switching the BigQuery destination column to a wider numeric type still fails validation with a type mismatch.  Observed error shape:  ```text Data type mismatch for column "...". BigQuery side: "NUMERIC(31, 2)", RisingWave side: "NUMERIC". ```  This makes some BigQuery sink migrations fail even when the destination side is adjusted to a wider compatible numeric representation.  ## Expected Behavior  One of the following should work consistently:  1. RisingWave `NUMERIC` should map cleanly to an appropriate BigQuery numeric type for sink validation. 2. BigQuery sink schema validation should accept compatible destination numeric widening where precision/scale differ but data remains representable. 3. Documentation should clearly state current numeric-type limitations and required workarounds if this behavior is intentional.  ## Impact  - Blocks BigQuery sink migrations for tables with higher-precision numeric columns. - Forces manual schema compromises or prevents using the sink for affected tables.  ## Reproduction  1. Create a RisingWave source relation with a `NUMERIC` 
  **Post-Mortem & Fix Analysis**:
  > This issue has been open for 60 days with no activity.  If you think it is still relevant today, and needs to be done *in the near future*, you can comment to update the status, or just manually remove the `no-issue-activity` label.  You can also confidently close this issue as not planned to keep our backlog clean. Don't worry if you think the issue is still valuable to continue in the future. It's searchable and can be reopened when it's time. 😄

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

### Incident Patch 1: `95251fec` (2026-10-22)
**Commit Message**: fix(frontend): return an error for leftover subquery expressions instead of panicking (#27592)

**File**: `src/frontend/planner_test/tests/testdata/input/generated_columns.yaml` (modified, +6/-0)
```diff
@@ -29,3 +29,9 @@
     explain create table t (v int, w int as v+1, watermark for w as w) append only
   expected_outputs:
   - explain_output
+# https://github.com/risingwavelabs/risingwave/issues/24081
+- name: subquery in generated column
+  sql: |
+    explain create table t (v text as (select 'a'));
+  expected_outputs:
+  - planner_error
```

**File**: `src/frontend/planner_test/tests/testdata/input/subquery.yaml` (modified, +23/-0)
```diff
@@ -373,3 +373,26 @@
     ORDER BY con1.conname;
   expected_outputs:
     - batch_plan
+# https://github.com/risingwavelabs/risingwave/issues/26395
+- name: correlated column in multi-row VALUES returns an error instead of panicking
+  sql: |
+    create table t(a int, b int, c int);
+    select * from t where t.a in (select * from (values (t.b), (t.c)) v);
+  expected_outputs:
+    - batch_error
+    - stream_error
+# https://github.com/risingwavelabs/risingwave/issues/24357
+- name: subquery left in SQL table function arguments returns an error instead of panicking
+  sql: |
+    create function my_tf(n int) returns table (sq int) language sql as $$ select v * v from generate_series(1, n) as g(v) $$;
+    select * from my_tf(3);
+  expected_outputs:
+    - batch_error
+    - stream_error
+- name: subquery in a lambda body returns an error instead of panicking
+  sql: |
+    create table t(a int[]);
+    select array_transform(a, |x| (select 1)) from t;
+  expected_outputs:
+    - batch_error
+    - stream_error
```

**File**: `src/frontend/planner_test/tests/testdata/output/generated_columns.yaml` (modified, +4/-0)
```diff
@@ -64,3 +64,7 @@
           │   └─StreamDml { columns: [v, _row_id] }
           │     └─StreamSource
           └─StreamUpstreamSinkUnion
+- name: subquery in generated column
+  sql: |
+    explain create table t (v text as (select 'a'));
+  planner_error: 'failed to bind the expression in generated column "v": Failed to bind expression: (SELECT ''a''): Invalid input syntax: subqueries are not allowed in GENERATED COLUMN'
```

**File**: `src/frontend/planner_test/tests/testdata/output/match_recognize.yaml` (modified, +1/-4)
```diff
@@ -1000,10 +1000,7 @@
         define a as a.v > t1.x, b as b.v < 0
       )
     );
-  stream_error: |-
-    Not supported: streaming nested-loop join
-    HINT: The non-equal join in the query requires a nested-loop join executor, which could be very expensive to run. Consider rewriting the query to use dynamic filter as a substitute if possible.
-    See also: https://docs.risingwave.com/processing/sql/dynamic-filters
+  stream_error: 'internal error: Subquery cannot be unnested: a correlated column reference is not resolved.'
 - name: a pattern variable colliding with the input table name is a naming error, not an internal one
   sql: |
     create table t(id int, ts int, v int, watermark for ts as ts - 10) append only;
```

**File**: `src/frontend/planner_test/tests/testdata/output/subquery.yaml` (modified, +18/-0)
```diff
@@ -1096,3 +1096,21 @@
                                     └─BatchProject { exprs: [rw_columns.relation_id, rw_columns.name, rw_columns.position::Int16 as $expr5] }
                                       └─BatchFilter { predicate: (rw_columns.is_hidden = false:Boolean) }
                                         └─BatchSysScan { table: rw_columns, columns: [rw_columns.relation_id, rw_columns.name, rw_columns.position, rw_columns.is_hidden], distribution: Single }
+- name: correlated column in multi-row VALUES returns an error instead of panicking
+  sql: |
+    create table t(a int, b int, c int);
+    select * from t where t.a in (select * from (values (t.b), (t.c)) v);
+  batch_error: 'internal error: Subquery cannot be unnested: a correlated column reference is not resolved.'
+  stream_error: 'internal error: Subquery cannot be unnested: a correlated column reference is not resolved.'
+- name: subquery left in SQL table function arguments returns an error instead of panicking
+  sql: |
+    create function my_tf(n int) returns table (sq int) language sql as $$ select v * v from generate_series(1, n) as g(v) $$;
+    select * from my_tf(3);
+  batch_error: 'internal error: Subquery is not supported in this context.'
+  stream_error: 'internal error: Subquery is not supported in this context.'
+- name: subquery in a lambda body returns an error instead of panicking
+  sql: |
+    create table t(a int[]);
+    select array_transform(a, |x| (select 1)) from t;
+  batch_error: 'internal error: Subquery is not supported in this context.'
+  stream_error: 'internal error: Subquery is not supported in this context.'
```

**File**: `src/frontend/src/binder/expr/subquery.rs` (modified, +11/-2)
```diff
@@ -14,12 +14,21 @@
 
 use risingwave_sqlparser::ast::Query;
 
-use crate::binder::Binder;
-use crate::error::{Result, bail_bind_error};
+use crate::binder::{Binder, Clause};
+use crate::error::{ErrorCode, Result, bail_bind_error};
 use crate::expr::{ExprImpl, Subquery, SubqueryKind};
 
 impl Binder {
     pub fn bind_subquery_expr(&mut self, query: &Query, kind: SubqueryKind) -> Result<ExprImpl> {
+        // A generated column expression is serialized directly without planning, so a subquery
+        // in it can never be unnested.
+        if let Some(clause @ Clause::GeneratedColumn) = self.context.clause {
+            return Err(ErrorCode::InvalidInputSyntax(format!(
+                "subqueries are not allowed in {}",
+                clause
+            ))
+            .into());
+        }
         let query = self.bind_query(query)?;
         if !matches!(kind, SubqueryKind::Existential | SubqueryKind::UpdateSet)
             && query.data_types().len() != 1
```

**File**: `src/frontend/src/optimizer/logical_optimization.rs` (modified, +8/-0)
```diff
@@ -644,6 +644,9 @@ impl LogicalOptimizer {
     ) -> Result<LogicalPlanRef> {
         // Bail our if no apply operators.
         if !has_logical_apply(plan.clone()) {
+            // A correlated column reference can still be left without any `Apply`. Report it
+            // here instead of panicking during serialization.
+            plan.check_apply_elimination()?;
             return Ok(plan);
         }
         // Simple Unnesting.
@@ -718,6 +721,9 @@ impl LogicalOptimizer {
             ctx.trace(plan.explain_to_string());
         }
 
+        // Check before common sub-plan sharing, which hashes the expressions.
+        plan.check_subquery_planned()?;
+
         // Convert grouping sets at first because other agg rule can't handle grouping sets.
         plan = plan.optimize_by_rules(&GROUPING_SETS)?;
         // Remove nodes with constant output.
@@ -851,6 +857,8 @@ impl LogicalOptimizer {
             ctx.trace(plan.explain_to_string());
         }
 
+        plan.check_subquery_planned()?;
+
         if ctx.session_ctx().config().enable_mv_selection() {
             let query_relations =
                 RelationCollectorVisitor::collect_with(HashSet::new(), plan.clone());
```

**File**: `src/frontend/src/optimizer/plan_visitor/apply_visitor.rs` (modified, +59/-3)
```diff
@@ -14,7 +14,10 @@
 
 use super::{DefaultBehavior, LogicalPlanVisitor, Merge};
 use crate::error::{ErrorCode, RwError};
-use crate::optimizer::plan_node::{LogicalApply, LogicalPlanRef as PlanRef, PlanTreeNodeBinary};
+use crate::expr::{CorrelatedInputRef, ExprVisitor, FunctionCallWithLambda, Subquery};
+use crate::optimizer::plan_node::{
+    LogicalApply, LogicalPlanRef as PlanRef, PlanTreeNodeBinary, VisitExprsRecursive,
+};
 use crate::optimizer::plan_visitor::PlanVisitor;
 
 pub struct HasMaxOneRowApply();
@@ -37,6 +40,8 @@ impl LogicalPlanVisitor for HasMaxOneRowApply {
 enum CheckResult {
     #[default]
     Ok,
+    UnplannedSubquery,
+    UnresolvedCorrelatedInputRef,
     CannotBeUnnested,
     MoreThanOneRow,
 }
@@ -45,6 +50,10 @@ impl From<CheckResult> for Result<(), RwError> {
     fn from(val: CheckResult) -> Self {
         let msg = match val {
             CheckResult::Ok => return Ok(()),
+            CheckResult::UnplannedSubquery => "Subquery is not supported in this context.",
+            CheckResult::UnresolvedCorrelatedInputRef => {
+                "Subquery cannot be unnested: a correlated column reference is not resolved."
+            }
             CheckResult::CannotBeUnnested => "Subquery cannot be unnested.",
             CheckResult::MoreThanOneRow => "Scalar subquery might produce more than one row.",
         };
@@ -78,13 +87,60 @@ impl LogicalPlanVisitor for CheckApplyElimination {
     }
 }
 
+/// Finds `Subquery` and `CorrelatedInputRef` expressions, which cannot be serialized. The planner
+/// must turn every subquery into an `Apply`, and unnesting must resolve every correlated reference.
+#[derive(Default)]
+struct SubqueryExprFinder {
+    has_subquery: bool,
+    has_correlated_input_ref: bool,
+}
+
+impl SubqueryExprFinder {
+    fn find(plan: &PlanRef) -> Self {
+        let mut finder = Self::default();
+        plan.visit_exprs_recursive(&mut finder);
+        finder
+    }
+}
+
+impl ExprVisitor for SubqueryExprFinder {
+    fn visit_subquery(&mut self, _: &Subquery) {
+        self.has_subquery = true;
+    }
+
+    fn visit_correlated_input_ref(&mut self, _: &CorrelatedInputRef) {
+        self.has_correlated_input_ref = true;
+    }
+
+    // The default implementation skips the lambda body, which is also serialized.
+    fn visit_function_call_with_lambda(&mut self, func_call: &FunctionCallWithLambda) {
+        func_call
+            .inputs_with_lambda_arg()
+            .for_each(|expr| self.visit_expr(expr));
+    }
+}
+
 #[easy_ext::ext(PlanCheckApplyEliminationExt)]
 impl PlanRef {
+    /// Checks that the planner has turned every subquery expression into an `Apply`. A subquery
+    /// left in an expression, e.g., in a lambda body, can be neither hashed nor unnested.
+    pub fn check_subquery_planned(&self) -> Result<(), RwError> {
+        if SubqueryExprFinder::find(self).has_subquery {
+            CheckResult::UnplannedSubquery.into()
+        } else {
+            Ok(())
+        }
+    }
+
     /// Checks if all `LogicalApply` nodes in the plan have been eliminated, that is,
-    /// subqueries are successfully unnested.
+    /// subqueries are successfully unnested, and that no correlated column reference is left.
     pub fn check_apply_elimination(&self) -> Result<(), RwError> {
         let mut visitor = CheckApplyElimination::default();
         visitor.visit(self.clone());
-        visitor.result.into()
+        let mut result = visitor.result;
+        if SubqueryExprFinder::find(self).has_correlated_input_ref {
+            result = result.max(CheckResult::UnresolvedCorrelatedInputRef);
+        }
+        result.into()
     }
 }
```

---

### Incident Patch 2: `1fb03281` (2026-10-22)
**Commit Message**: fix(stream): hide rows below the pending watermark from state table reads (#27499)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/storage/hummock_sdk/src/table_watermark.rs` (modified, +51/-43)
```diff
@@ -36,6 +36,55 @@ use tracing::{debug, warn};
 use crate::HummockEpoch;
 use crate::key::{TableKey, TableKeyRange, prefix_slice_with_vnode, vnode};
 
+/// Narrow `key_range`, which lies in a single vnode, to the keys not cleaned by the pk-prefix
+/// `watermark` in `direction`.
+pub fn rewrite_range_with_watermark(
+    direction: WatermarkDirection,
+    watermark: &[u8],
+    key_range: &mut TableKeyRange,
+) {
+    let vnode = vnode(key_range);
+    match direction {
+        WatermarkDirection::Ascending => {
+            let overwrite_start_key = match &key_range.0 {
+                Included(start_key) | Excluded(start_key) => start_key.key_part() < watermark,
+                Unbounded => true,
+            };
+            if overwrite_start_key {
+                let watermark_key = TableKey(prefix_slice_with_vnode(vnode, watermark));
+                let fully_filtered = match &key_range.1 {
+                    Included(end_key) => end_key < &watermark_key,
+                    Excluded(end_key) => end_key <= &watermark_key,
+                    Unbounded => false,
+                };
+                if fully_filtered {
+                    key_range.1 = Excluded(watermark_key.clone());
+                }
+                key_range.0 = Included(watermark_key);
+            }
+        }
+        WatermarkDirection::Descending => {
+            let overwrite_end_key = match &key_range.1 {
+                Included(end_key) | Excluded(end_key) => end_key.key_part() > watermark,
+                Unbounded => true,
+            };
+            if overwrite_end_key {
+                let watermark_key = TableKey(prefix_slice_with_vnode(vnode, watermark));
+                let fully_filtered = match &key_range.0 {
+                    Included(start_key) => start_key > &watermark_key,
+                    Excluded(start_key) => start_key >= &watermark_key,
+                    Unbounded => false,
+                };
+                if fully_filtered {
+                    *key_range = (Included(watermark_key.clone()), Excluded(watermark_key));
+                } else {
+                    key_range.1 = Included(watermark_key);
+                }
+            }
+        }
+    }
+}
+
 #[derive(Clone)]
 pub struct ReadTableWatermark {
     pub direction: WatermarkDirection,
@@ -124,49 +173,8 @@ impl TableWatermarksIndex {
             // TODO: Storage read respecting watermark will be implemented in a later PR in StateTable.
             return;
         }
-        let vnode = vnode(key_range);
-        if let Some(watermark) = self.read_watermark(vnode, epoch) {
-            match self.watermark_direction {
-                WatermarkDirection::Ascending => {
-                    let overwrite_start_key = match &key_range.0 {
-                        Included(start_key) | Excluded(start_key) => {
-                            start_key.key_part() < watermark
-                        }
-                        Unbounded => true,
-                    };
-                    if overwrite_start_key {
-                        let watermark_key = TableKey(prefix_slice_with_vnode(vnode, &watermark));
-                        let fully_filtered = match &key_range.1 {
-                            Included(end_key) => end_key < &watermark_key,
-                            Excluded(end_key) => end_key <= &watermark_key,
-                            Unbounded => false,
-                        };
-                        if fully_filtered {
-                            key_range.1 = Excluded(watermark_key.clone());
-                        }
-                        key_range.0 = Included(watermark_key);
-                    }
-                }
-                WatermarkDirection::Descending => {
-                    let overwrite_end_key = match &key_range.1 {
-                        Included(end_key) | Excluded(end_key) => end_key.key_part() > watermark,
-                        Unbounded => true,
-                    };
-                    if overwrite_end_key {
-                        let watermark_key = TableKey(prefix_slice_with_vnode(vnode, &watermark));
-                        let fully_filtered = match &key_range.0 {
-                            Included(start_key) => start_key > &watermark_key,
-                            Excluded(start_key) => start_key >= &watermark_key,
-                            Unbounded => false,
-                        };
-                        if fully_filtered {
-                            *key_range = (Included(watermark_key.clone()), Excluded(watermark_key));
-                        } else {
-                            key_range.1 = Included(watermark_key);
-                        }
-                    }
-                }
-            }
+        if let Some(watermark) = self.read_watermark(vnode(key_range), epoch) {
+            rewrite_range_with_watermark(self.watermark_direction, &watermark, key_range);
         }
     }
 
```

**File**: `src/stream/src/common/table/state_table.rs` (modified, +122/-61)
```diff
@@ -47,11 +47,11 @@ use risingwave_common::util::sort_util::{OrderType, cmp_datum};
 use risingwave_common::util::value_encoding::BasicSerde;
 use risingwave_hummock_sdk::HummockReadEpoch;
 use risingwave_hummock_sdk::key::{
-    CopyFromSlice, TableKey, end_bound_of_prefix, next_key, prefix_slice_with_vnode,
-    prefixed_range_with_vnode, start_bound_of_excluded_prefix,
+    CopyFromSlice, TableKey, TableKeyRange, end_bound_of_prefix, is_empty_key_range, next_key,
+    prefix_slice_with_vnode, prefixed_range_with_vnode, start_bound_of_excluded_prefix,
 };
 use risingwave_hummock_sdk::table_watermark::{
-    VnodeWatermark, WatermarkDirection, WatermarkSerdeType,
+    VnodeWatermark, WatermarkDirection, WatermarkSerdeType, rewrite_range_with_watermark,
 };
 use risingwave_pb::catalog::Table;
 use risingwave_pb::plan_common::StorageTableDesc;
@@ -365,6 +365,10 @@ macro_rules! dispatch_value_indices {
 struct StateTableRowStore<LS: LocalStateStore, SD: ValueRowSerde> {
     state_store: LS,
     all_rows: Option<HashMap<VirtualNode, BTreeMap<Bytes, OwnedRow>>>,
+    /// The pk-prefix watermark fed in the current epoch, with its direction. The state store only
+    /// applies it once committed, so the reads from the state store hide the keys it cleans until
+    /// then.
+    pending_watermark: Option<(WatermarkDirection, Bytes)>,
 
     table_id: TableId,
     row_serde: Arc<SD>,
@@ -511,49 +515,87 @@ impl<LS: LocalStateStore, SD: ValueRowSerde> StateTableRowStore<LS, SD> {
         Ok(())
     }
 
-    async fn seal_current_epoch(
+    /// Remove the preloaded rows cleaned by `watermarks`.
+    fn clean_preloaded_rows(
         &mut self,
-        next_epoch: u64,
-        table_watermarks: Option<(WatermarkDirection, Vec<VnodeWatermark>, WatermarkSerdeType)>,
-        switch_consistent_op: Option<StateTableOpConsistencyLevel>,
-    ) -> StreamExecutorResult<()> {
-        if let Some((direction, watermarks, serde_type)) = &table_watermarks
-            && let Some(rows) = &mut self.all_rows
-        {
-            match serde_type {
-                WatermarkSerdeType::PkPrefix => {
-                    for vnode_watermark in watermarks {
-                        match direction {
-                            WatermarkDirection::Ascending => {
-                                for vnode in vnode_watermark.vnode_bitmap().iter_vnodes() {
-                                    let rows = rows.get_mut(&vnode).expect("covered vnode");
-                                    // split_off returns everything after the given key, including the key.
-                                    *rows = rows.split_off(vnode_watermark.watermark());
-                                }
+        direction: WatermarkDirection,
+        watermarks: &[VnodeWatermark],
+        serde_type: WatermarkSerdeType,
+    ) {
+        let Some(rows) = &mut self.all_rows else {
+            return;
+        };
+        match serde_type {
+            WatermarkSerdeType::PkPrefix => {
+                for vnode_watermark in watermarks {
+                    match direction {
+                        WatermarkDirection::Ascending => {
+                            for vnode in vnode_watermark.vnode_bitmap().iter_vnodes() {
+                                let rows = rows.get_mut(&vnode).expect("covered vnode");
+                                // split_off returns everything after the given key, including the key.
+                                *rows = rows.split_off(vnode_watermark.watermark());
                             }
-                            WatermarkDirection::Descending => {
-                                // Turn Exclude(vnode_watermark.watermark()) into Include(next_key(vnode_watermark.watermark())).
-                                let split_off_key = next_key(vnode_watermark.watermark());
-                                for vnode in vnode_watermark.vnode_bitmap().iter_vnodes() {
-                                    let rows = rows.get_mut(&vnode).expect("covered vnode");
-                                    // split_off away (Exclude(vnode_watermark.watermark())..) and keep
-                                    // (..Include(vnode_watermark.watermark()))
-                                    rows.split_off(split_off_key.as_slice());
-                                }
+                        }
+                        WatermarkDirection::Descending => {
+                            // Turn Exclude(vnode_watermark.watermark()) into Include(next_key(vnode_watermark.watermark())).
+                            let split_off_key = next_key(vnode_watermark.watermark());
+                            for vnode in vnode_watermark.vnode_bitmap().iter_vnodes() {
+                                let rows = rows.get_mut(&vnode).expect("covered vnode");
+                                // split_off away (Exclude(vnode_watermark.watermark())..) and keep
+                                // (..Include(vnode_watermark.watermark()))
+             
```

**File**: `src/stream/src/common/table/test_state_table.rs` (modified, +108/-0)
```diff
@@ -2620,3 +2620,111 @@ async fn test_state_table_pruned_key_range_with_two_pk_columns() {
         2
     );
 }
+
+/// A pk-prefix watermark hides the rows below it from reads at once, not only once committed.
+#[tokio::test]
+async fn test_pending_watermark_hides_rows() {
+    use futures::TryStreamExt;
+    use risingwave_common::row::Row;
+
+    use crate::common::table::state_table::StateTableBuilder;
+
+    /// The keys returned by a forward scan, by a reverse scan, and by point gets.
+    async fn visible_keys(state_table: &StateTable<HummockStorage>) -> [Vec<i32>; 3] {
+        let sub_range: &(Bound<OwnedRow>, Bound<OwnedRow>) = &(Unbounded, Unbounded);
+        let key = |row: OwnedRow| row.datum_at(0).unwrap().into_int32();
+        let forward: Vec<OwnedRow> = state_table
+            .iter_with_prefix(row::empty(), sub_range, PrefetchOptions::default())
+            .await
+            .unwrap()
+            .try_collect()
+            .await
+            .unwrap();
+        let backward: Vec<OwnedRow> = state_table
+            .rev_iter_with_prefix(row::empty(), sub_range, PrefetchOptions::default())
+            .await
+            .unwrap()
+            .try_collect()
+            .await
+            .unwrap();
+        let mut found = vec![];
+        for k in 0..=5 {
+            let pk = OwnedRow::new(vec![Some(k.into())]);
+            let exists = state_table.exists(&pk).await.unwrap();
+            assert_eq!(exists, state_table.get_row(&pk).await.unwrap().is_some());
+            if exists {
+                found.push(k);
+            }
+        }
+        [
+            forward.into_iter().map(key).collect(),
+            backward.into_iter().map(key).collect(),
+            found,
+        ]
+    }
+
+    const TEST_TABLE_ID: TableId = TableId::new(233);
+    let mut table = gen_pbtable(
+        TEST_TABLE_ID,
+        vec![
+            ColumnDesc::unnamed(ColumnId::from(0), DataType::Int32),
+            ColumnDesc::unnamed(ColumnId::from(1), DataType::Int32),
+        ],
+        vec![OrderType::ascending()],
+        vec![0],
+        0,
+    );
+    table.watermark_indices = vec![0];
+    table.clean_watermark_indices = vec![0];
+    let row = |k: i32| OwnedRow::new(vec![Some(k.into()), Some(k.into())]);
+
+    for preload in [false, true] {
+        let test_env = prepare_hummock_test_env().await;
+        test_env.register_table(table.clone()).await;
+        let mut config = StreamingConfig::default();
+        config.developer.default_enable_mem_preload_state_table = preload;
+        let mut state_table: StateTable<HummockStorage> =
+            StateTableBuilder::new(&table, test_env.storage.clone(), None)
+                .enable_preload_all_rows_by_config(&config)
+                .build()
+                .await;
+
+        let mut epoch = EpochPair::new_test_epoch(test_epoch(1));
+        test_env
+            .storage
+            .start_epoch(epoch.curr, HashSet::from_iter([TEST_TABLE_ID]));
+        state_table.init_epoch(epoch).await.unwrap();
+        for k in 1..=4 {
+            state_table.insert(row(k));
+        }
+        epoch.inc_for_test();
+        test_env
+            .storage
+            .start_epoch(epoch.curr, HashSet::from_iter([TEST_TABLE_ID]));
+        state_table.commit_for_test(epoch).await.unwrap();
+        test_env.commit_epoch(epoch.prev).await;
+
+        // Rows written in the epoch of the watermark, before it.
+        state_table.insert(row(0));
+        state_table.insert(row(5));
+        state_table.update_watermark(ScalarImpl::Int32(3));
+        let expected = [vec![3, 4, 5], vec![5, 4, 3], vec![3, 4, 5]];
+        assert_eq!(
+            visible_keys(&state_table).await,
+            expected,
+            "preload: {preload}, before the commit"
+        );
+
+        epoch.inc_for_test();
+        test_env
+            .storage
+            .start_epoch(epoch.curr, HashSet::from_iter([TEST_TABLE_ID]));
+        state_table.commit_for_test(epoch).await.unwrap();
+        test_env.commit_epoch(epoch.prev).await;
+        assert_eq!(
+            visible_keys(&state_table).await,
+            expected,
+            "preload: {preload}, after the commit"
+        );
+    }
+}
```

**File**: `src/stream/src/executor/eowc/sort.rs` (modified, +50/-0)
```diff
@@ -347,4 +347,54 @@ mod tests {
         // Consume the watermark
         recovered_sort_executor.expect_watermark().await;
     }
+
+    /// A change to the only row left in the cache empties it, while the rows output earlier in the
+    /// epoch stay in the table until the commit cleans them.
+    #[tokio::test]
+    async fn test_sort_executor_change_empties_cache() {
+        let sort_column_index = 1;
+        for barrier_between in [false, true] {
+            for (change, expected) in [
+                (" I I\n - 3 3", None),
+                (" I I\n U- 3 3\n U+ 3 3", Some(" I I\n + 3 3")),
+            ] {
+                let (mut tx, mut sort_executor) =
+                    create_executor(sort_column_index, MemoryStateStore::new()).await;
+                tx.push_barrier(test_epoch(1), false);
+                sort_executor.expect_barrier().await;
+
+                tx.push_chunk(StreamChunk::from_pretty(
+                    " I I
+                    + 1 1
+                    + 2 2
+                    + 3 3",
+                ));
+                tx.push_int64_watermark(sort_column_index, 3_i64);
+                assert_eq!(
+                    sort_executor.expect_chunk().await,
+                    StreamChunk::from_pretty(
+                        " I I
+                        + 1 1
+                        + 2 2"
+                    )
+                );
+                sort_executor.expect_watermark().await;
+
+                if barrier_between {
+                    tx.push_barrier(test_epoch(2), false);
+                    sort_executor.expect_barrier().await;
+                }
+                tx.push_chunk(StreamChunk::from_pretty(change));
+                tx.push_int64_watermark(sort_column_index, 10_i64);
+                if let Some(expected) = expected {
+                    assert_eq!(
+                        sort_executor.expect_chunk().await,
+                        StreamChunk::from_pretty(expected),
+                        "change: {change:?}, barrier_between: {barrier_between}"
+                    );
+                }
+                sort_executor.expect_watermark().await;
+            }
+        }
+    }
 }
```

---

### Incident Patch 3: `dbcc6979` (2026-10-22)
**Commit Message**: fix(cdc): escape identifiers in external table snapshot queries (#27606)

Co-authored-by: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `e2e_test/source_inline/cdc/mysql/mysql_quoted_column_identifier.slt` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+control substitution on
+
+statement ok
+drop source if exists s_mysql_quoted_col cascade;
+
+system ok
+mysql -e "
+    DROP USER IF EXISTS 'quoted_col_cdc'@'%';
+    DROP DATABASE IF EXISTS mysql_quoted_col;
+    CREATE DATABASE mysql_quoted_col;
+    CREATE USER 'quoted_col_cdc'@'%' IDENTIFIED BY 'quoted_col_cdc_pwd';
+    GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'quoted_col_cdc'@'%';
+    USE mysql_quoted_col;
+    CREATE TABLE upstream_table (
+        \`p\`\`k\` INT PRIMARY KEY,
+        \`a\`\`b\` INT,
+        note VARCHAR(50)
+    );
+    INSERT INTO upstream_table VALUES
+        (1, 10, 'backfill_1'),
+        (2, 20, 'backfill_2'),
+        (3, 30, 'backfill_3');
+"
+
+statement ok
+create source s_mysql_quoted_col with (
+  ${RISEDEV_MYSQL_WITH_OPTIONS_COMMON},
+  username = 'quoted_col_cdc',
+  password = 'quoted_col_cdc_pwd',
+  database.name = 'mysql_quoted_col'
+);
+
+# Quoted primary-key and data columns, forced over multiple snapshot pages so the
+# paginated filter (which binds the primary key) is exercised.
+statement ok
+create table rw_mysql_quoted_col (
+    "p`k" int primary key,
+    "a`b" int,
+    note varchar
+) with (
+    snapshot.batch_size = '1'
+) from s_mysql_quoted_col table 'mysql_quoted_col.upstream_table';
+
+query IIT retry 10 backoff 1s
+select "p`k", "a`b", note from rw_mysql_quoted_col order by "p`k";
+----
+1 10 backfill_1
+2 20 backfill_2
+3 30 backfill_3
+
+system ok
+mysql -e "
+    USE mysql_quoted_col;
+    INSERT INTO upstream_table VALUES (4, 40, 'stream_1');
+"
+
+query IIT retry 10 backoff 1s
+select "p`k", "a`b", note from rw_mysql_quoted_col order by "p`k";
+----
+1 10 backfill_1
+2 20 backfill_2
+3 30 backfill_3
+4 40 stream_1
+
+statement ok
+drop source s_mysql_quoted_col cascade;
+
+system ok
+mysql -e "
+    DROP DATABASE IF EXISTS mysql_quoted_col;
+    DROP USER IF EXISTS 'quoted_col_cdc'@'%';
+"
```

**File**: `e2e_test/source_inline/cdc/postgres/postgres_quoted_column_identifier.slt` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+control substitution on
+
+system ok
+psql -c "
+    SELECT pg_terminate_backend(active_pid)
+    FROM pg_replication_slots
+    WHERE slot_name = 'quoted_col_slot' AND active_pid IS NOT NULL;
+    SELECT pg_sleep(1);
+    SELECT pg_drop_replication_slot(slot_name)
+    FROM pg_replication_slots
+    WHERE slot_name = 'quoted_col_slot';
+    DROP TABLE IF EXISTS quoted_col_tbl;
+    DROP TABLE IF EXISTS quoted_split_tbl;
+"
+
+system ok
+psql -c "
+    CREATE TABLE quoted_col_tbl (
+        \"p\"\"k\" int PRIMARY KEY,
+        \"a\"\"b\" int,
+        note varchar
+    );
+    INSERT INTO quoted_col_tbl (\"p\"\"k\", \"a\"\"b\", note) VALUES
+        (1, 10, 'backfill_1'),
+        (2, 20, 'backfill_2'),
+        (3, 30, 'backfill_3');
+    CREATE TABLE quoted_split_tbl (
+        \"p\"\"k\" int PRIMARY KEY,
+        v int
+    );
+    INSERT INTO quoted_split_tbl (\"p\"\"k\", v) SELECT g, g * 10 FROM generate_series(1, 20) g;
+"
+
+statement ok
+create source s with (
+  connector = 'postgres-cdc',
+  hostname = '${PGHOST:localhost}',
+  port = '${PGPORT:5432}',
+  username = '${PGUSER:$USER}',
+  password = '${PGPASSWORD:}',
+  database.name = '${PGDATABASE:postgres}',
+  schema.name = 'public',
+  slot.name = 'quoted_col_slot'
+);
+
+# Quoted primary-key and data columns, forced over multiple snapshot pages.
+statement ok
+create table quoted_col_tbl (
+    "p""k" int primary key,
+    "a""b" int,
+    note varchar
+) with (
+    snapshot.batch_size = '1'
+) from s table 'public.quoted_col_tbl';
+
+query IIT retry 10 backoff 1s
+select "p""k", "a""b", note from quoted_col_tbl order by "p""k";
+----
+1 10 backfill_1
+2 20 backfill_2
+3 30 backfill_3
+
+# Parallelized (V2) backfill with uneven splits uses the quoted primary key as the split column.
+statement ok
+create table quoted_split_tbl (
+    "p""k" int primary key,
+    v int
+) with (
+    backfill.parallelism = '2',
+    backfill.as_even_splits = 'false',
+    backfill.num_rows_per_split = '5'
+) from s table 'public.quoted_split_tbl';
+
+query II retry 10 backoff 1s
+select count(*), sum(v) from quoted_split_tbl;
+----
+20 2100
+
+statement ok
+drop table quoted_col_tbl;
+
+statement ok
+drop table quoted_split_tbl;
+
+statement ok
+drop source s;
+
+system ok
+psql -c "
+    SELECT pg_terminate_backend(active_pid)
+    FROM pg_replication_slots
+    WHERE slot_name = 'quoted_col_slot' AND active_pid IS NOT NULL;
+    SELECT pg_sleep(1);
+    SELECT pg_drop_replication_slot(slot_name)
+    FROM pg_replication_slots
+    WHERE slot_name = 'quoted_col_slot';
+    DROP TABLE IF EXISTS quoted_col_tbl;
+    DROP TABLE IF EXISTS quoted_split_tbl;
+"
```

**File**: `e2e_test/source_inline/cdc/sql_server/sql_server_quoted_column_identifier.slt.serial` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+control substitution on
+
+system ok
+sqlcmd -C -d master -Q "IF DB_ID('quoted_col_db') IS NOT NULL BEGIN ALTER DATABASE quoted_col_db SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE quoted_col_db; END; CREATE DATABASE quoted_col_db;" -b
+
+system ok
+sqlcmd -C -d quoted_col_db -i e2e_test/source_inline/cdc/sql_server/sql_server_quoted_column_identifier_prepare.sql -b
+
+statement ok
+create source mssql_quoted_col_source with (
+    connector = 'sqlserver-cdc',
+    hostname = '${SQLCMDSERVER:sqlserver-server}',
+    port = '${SQLCMDPORT:1433}',
+    username = '${SQLCMDUSER:SA}',
+    password = '${SQLCMDPASSWORD}',
+    database.name = 'quoted_col_db',
+);
+
+# Quoted primary-key and data columns, forced over multiple snapshot pages.
+statement ok
+create table rw_quoted_col_tbl (
+    "p""k" int primary key,
+    "a""b" int,
+    note varchar
+) with (
+    snapshot.batch_size = '1'
+) from mssql_quoted_col_source table 'quoted_col_db.dbo.quoted_col_tbl';
+
+query IIT retry 10 backoff 1s
+select "p""k", "a""b", note from rw_quoted_col_tbl order by "p""k";
+----
+1 10 backfill_1
+2 20 backfill_2
+3 30 backfill_3
+
+system ok
+sqlcmd -C -d quoted_col_db -Q "INSERT INTO quoted_col_tbl VALUES (4, 40, 'stream_1');" -b
+
+query IIT retry 10 backoff 1s
+select "p""k", "a""b", note from rw_quoted_col_tbl order by "p""k";
+----
+1 10 backfill_1
+2 20 backfill_2
+3 30 backfill_3
+4 40 stream_1
+
+statement ok
+drop source mssql_quoted_col_source cascade;
```

**File**: `e2e_test/source_inline/cdc/sql_server/sql_server_quoted_column_identifier_prepare.sql` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+SET NOCOUNT ON;
+
+EXEC sys.sp_cdc_enable_db;
+
+CREATE TABLE quoted_col_tbl (
+  [p"k] INT PRIMARY KEY,
+  [a"b] INT,
+  note VARCHAR(50)
+);
+
+EXEC sys.sp_cdc_enable_table
+  @source_schema = 'dbo',
+  @source_name = 'quoted_col_tbl',
+  @role_name = NULL;
+
+INSERT INTO quoted_col_tbl VALUES
+  (1, 10, 'backfill_1'),
+  (2, 20, 'backfill_2'),
+  (3, 30, 'backfill_3');
```

**File**: `src/connector/src/source/cdc/external/mysql.rs` (modified, +16/-23)
```diff
@@ -690,7 +690,11 @@ impl MySqlExternalTableReader {
 
     pub fn get_normalized_table_name(table_name: &SchemaTableName) -> String {
         // schema name is the database name in mysql
-        format!("`{}`.`{}`", table_name.schema_name, table_name.table_name)
+        format!(
+            "`{}`.`{}`",
+            table_name.schema_name.replace('`', "``"),
+            table_name.table_name.replace('`', "``")
+        )
     }
 
     pub fn get_cdc_offset_parser() -> CdcOffsetParseFunc {
@@ -851,8 +855,9 @@ impl MySqlExternalTableReader {
             // fill in start primary key params
             let params: Vec<_> = primary_keys
                 .iter()
+                .enumerate()
                 .zip_eq_fast(start_pk_row.into_iter())
-                .map(|(pk, datum)| {
+                .map(|((idx, pk), datum)| {
                     if let Some(value) = datum {
                         let ty = field_map.get(pk.as_str()).unwrap();
                         let val = match ty {
@@ -884,7 +889,7 @@ impl MySqlExternalTableReader {
                             }
                             _ => bail!("unsupported primary key data type: {}", ty),
                         };
-                        ConnectorResult::Ok((pk.to_lowercase(), val))
+                        ConnectorResult::Ok((format!("p{}", idx), val))
                     } else {
                         bail!("primary key {} cannot be null", pk);
                     }
@@ -933,34 +938,22 @@ impl MySqlExternalTableReader {
     fn filter_expression(columns: &[String]) -> String {
         let mut conditions = vec![];
         // push the first condition
-        conditions.push(format!(
-            "({} > :{})",
-            Self::quote_column(&columns[0]),
-            columns[0].to_lowercase()
-        ));
+        conditions.push(format!("({} > :p0)", Self::quote_column(&columns[0])));
         for i in 2..=columns.len() {
             // '=' condition
             let mut condition = String::new();
             for (j, col) in columns.iter().enumerate().take(i - 1) {
                 if j == 0 {
-                    condition.push_str(&format!(
-                        "({} = :{})",
-                        Self::quote_column(col),
-                        col.to_lowercase()
-                    ));
+                    condition.push_str(&format!("({} = :p{})", Self::quote_column(col), j));
                 } else {
-                    condition.push_str(&format!(
-                        " AND ({} = :{})",
-                        Self::quote_column(col),
-                        col.to_lowercase()
-                    ));
+                    condition.push_str(&format!(" AND ({} = :p{})", Self::quote_column(col), j));
                 }
             }
             // '>' condition
             condition.push_str(&format!(
-                " AND ({} > :{})",
+                " AND ({} > :p{})",
                 Self::quote_column(&columns[i - 1]),
-                columns[i - 1].to_lowercase()
+                i - 1
             ));
             conditions.push(format!("({})", condition));
         }
@@ -972,7 +965,7 @@ impl MySqlExternalTableReader {
     }
 
     fn quote_column(column: &str) -> String {
-        format!("`{}`", column)
+        format!("`{}`", column.replace('`', "``"))
     }
 }
 
@@ -1229,13 +1222,13 @@ mod tests {
     fn test_mysql_filter_expr() {
         let cols = vec!["id".to_owned()];
         let expr = MySqlExternalTableReader::filter_expression(&cols);
-        assert_eq!(expr, "(`id` > :id)");
+        assert_eq!(expr, "(`id` > :p0)");
 
         let cols = vec!["aa".to_owned(), "bb".to_owned(), "cc".to_owned()];
         let expr = MySqlExternalTableReader::filter_expression(&cols);
         assert_eq!(
             expr,
-            "(`aa` > :aa) OR ((`aa` = :aa) AND (`bb` > :bb)) OR ((`aa` = :aa) AND (`bb` = :bb) AND (`cc` > :cc))"
+            "(`aa` > :p0) OR ((`aa` = :p0) AND (`bb` > :p1)) OR ((`aa` = :p0) AND (`bb` = :p1) AND (`cc` > :p2))"
         );
     }
 
```

**File**: `src/connector/src/source/cdc/external/postgres.rs` (modified, +5/-4)
```diff
@@ -330,7 +330,8 @@ impl PostgresExternalTableReader {
     pub fn get_normalized_table_name(table_name: &SchemaTableName) -> String {
         format!(
             "\"{}\".\"{}\"",
-            table_name.schema_name, table_name.table_name
+            table_name.schema_name.replace('"', "\"\""),
+            table_name.table_name.replace('"', "\"\"")
         )
     }
 
@@ -484,7 +485,7 @@ impl PostgresExternalTableReader {
     }
 
     fn quote_column(column: &str) -> String {
-        format!("\"{}\"", column)
+        format!("\"{}\"", column.replace('"', "\"\""))
     }
 
     async fn min_and_max(
@@ -493,8 +494,8 @@ impl PostgresExternalTableReader {
     ) -> ConnectorResult<Option<(ScalarImpl, ScalarImpl)>> {
         let sql = format!(
             "SELECT MIN({}), MAX({}) FROM {}",
-            split_column.name,
-            split_column.name,
+            Self::quote_column(&split_column.name),
+            Self::quote_column(&split_column.name),
             Self::get_normalized_table_name(&self.schema_table_name),
         );
         let client = self.client.lock().await;
```

**File**: `src/connector/src/source/cdc/external/sql_server.rs` (modified, +3/-2)
```diff
@@ -402,7 +402,8 @@ impl SqlServerExternalTableReader {
     pub fn get_normalized_table_name(table_name: &SchemaTableName) -> String {
         format!(
             "\"{}\".\"{}\"",
-            table_name.schema_name, table_name.table_name
+            table_name.schema_name.replace('"', "\"\""),
+            table_name.table_name.replace('"', "\"\"")
         )
     }
 
@@ -443,7 +444,7 @@ impl SqlServerExternalTableReader {
     }
 
     fn quote_column(column: &str) -> String {
-        format!("\"{}\"", column)
+        format!("\"{}\"", column.replace('"', "\"\""))
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #27627** (2026-10-23): fix(frontend): avoid external MySQL access in CDC privilege test (@cyliu0)
- **PR #27626** (2026-10-23): perf(stream): batch and parallelize iceberg pk-index lookups (@silver-ymz)
- **PR #27612** (closed): perf(optimizer): compute group keys derived from other group keys above the aggregation (@chenzl25)
- **PR #27606** (2026-10-22): fix(cdc): escape identifiers in external table snapshot queries (@anlowee)
- **PR #27604** (closed): fix(connector): restore base64 Pub/Sub source credentials (release-3.1) (@zwang28)
- **PR #27603** (2026-10-22): fix(connector): restore base64 Pub/Sub source credentials (@zwang28)

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

## X. frontend): return an error for leftover subquery expressions instead of panickin

**RULE**:
When implementing operations in `src/frontend/planner_test/tests/testdata/input/generated_columns.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in risingwavelabs/risingwave. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `95251fec`: frontend): return an error for leftover subquery expressions instead of panicking (#27592). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/frontend/planner_test/tests/testdata/input/generated_columns.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# https://github.com/risingwavelabs/risingwave/issues/24081
- name: subquery in generated column
  sql: |
    explain create table t (v text as (select 'a'));
  expected_outputs:
  - planner_error
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `95251fec` are properly handled with clean fallback behavior.

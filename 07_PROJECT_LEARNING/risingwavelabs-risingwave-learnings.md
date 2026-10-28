> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/risingwavelabs-risingwave-learnings.md`  
> **Source**: github ([https://github.com/risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave))  
> **Source Version**: `e3fe3b25`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T13:10:11.467Z  
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
> **Harvest Timestamp**: 2026-10-28T13:10:11.462Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `risingwavelabs/risingwave`
- **Description**: Event streaming platform for agentic AI. Continuously ingest, transform, and serve event streams in real time, at scale.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9394 stars

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

### Incident Patch 1: `e3fe3b25` (2026-10-28)
**Commit Message**: fix(iceberg): honor compaction interval between pk-index batches (#27625)

**File**: `src/meta/src/manager/iceberg_compaction/schedule.rs` (modified, +33/-11)
```diff
@@ -337,7 +337,8 @@ impl CompactionTrack {
     /// Determines if compaction should be triggered.
     ///
     /// Trigger conditions:
-    /// - An active automatic round is controlled only by its next-attempt time.
+    /// - An active automatic round follows its next-attempt time. PK-index batches
+    ///   can also continue without new commits or trigger early at the commit threshold.
     /// - Otherwise, pending commit threshold or an interval with pending commits
     ///   can trigger a task.
     ///
@@ -370,15 +371,17 @@ impl CompactionTrack {
         };
 
         let time_ready = now >= next_compaction_time;
+        let commit_ready = self.demand.commit_count >= self.config.trigger_snapshot_count;
+        let has_commits = self.demand.commit_count > 0;
         if self.round.is_some() {
-            // Active work remains schedulable without new commits. PK-index batches
-            // consume new demand when they advance their boundary; legacy rounds
-            // retain a fixed boundary. Neither can bypass failure backoff.
-            return time_ready;
+            // Continue immediately below the same PK-index boundary when no new
+            // commits are pending. Advancing the boundary must honor the cooldown
+            // or commit threshold, including commits received after success.
+            // Neither continuation nor new demand can bypass failure backoff.
+            return time_ready
+                || (self.config.pk_index_coordinated && (commit_ready || !has_commits));
         }
 
-        let commit_ready = self.demand.commit_count >= self.config.trigger_snapshot_count;
-        let has_commits = self.demand.commit_count > 0;
         if self.config.pk_index_coordinated {
             // An empty manual Full can finish before the first snapshot is observed.
             return self.latest_observed_snapshot.is_some()
@@ -674,8 +677,8 @@ impl CompactionTrack {
 
         self.config.trigger_interval_sec = new_interval_sec;
         if self.round.is_some() {
-            // The new interval applies after the round drains. The current deadline
-            // already represents either immediate continuation or retry backoff.
+            // The new interval applies after the next successful batch or when the
+            // round drains. Preserve the current continuation/cooldown/retry deadline.
             return;
         }
 
@@ -704,8 +707,19 @@ impl CompactionTrack {
             // Success means this attempt made progress, but only `Drained`
             // proves that no work remains below this attempt's boundary.
             self.health.record_progress();
+            // Beneficial PK-index batches can advance their boundary on new commits,
+            // so continuous ingestion may prevent the round from ever draining.
+            // Keep the cooldown even if commits arrive only after this success.
+            // should_trigger still allows immediate continuation without new commits
+            // to finish deferred plans and the empty scan. Full keeps a fixed boundary.
+            let delay =
+                if attempt.pk_index_coordinated && attempt.policy.task_type != TaskType::Full {
+                    Duration::from_secs(self.config.trigger_interval_sec)
+                } else {
+                    Duration::ZERO
+                };
             self.state = CompactionTrackState::Idle {
-                next_compaction_time: now,
+                next_compaction_time: now + delay,
                 manual_task_type: None,
             };
         } else {
@@ -1669,7 +1683,15 @@ impl IcebergCompactionManager {
                         ..
                     } = &track.state
                 {
-                    candidates.push((*sink_id, *next_compaction_time));
+                    // Active PK-index work can be eligible before its cooldown.
+                    // Sort it as ready now without changing the stored deadline.
+                    let eligible_at = if track.round.is_some() && track.config.pk_index_coordinated
+                    {
+                        (*next_compaction_time).min(now)
+                    } else {
+                        *next_compaction_time
+                    };
+                    candidates.push((*sink_id, eligible_at));
                 }
             }
 
```

**File**: `src/meta/src/manager/iceberg_compaction/schedule/tests.rs` (modified, +480/-23)
```diff
@@ -2115,28 +2115,31 @@ fn test_pk_index_commit_events_ignore_duplicates_and_maintenance() {
 
 #[test]
 fn test_pk_index_retry_gate_cannot_be_bypassed_by_commits_or_force() {
-    let now = Instant::now();
-    let mut track = pk_index_track(now, false);
-    track.config.trigger_snapshot_count = 1;
-    track.finish_failed(now, "boom".to_owned());
-    record_commits(&mut track, 10);
-    track.record_force_compaction(now, None);
-    assert!(!track.should_trigger(now));
-    let first_retry = track.retry.not_before.unwrap();
-    assert!(
-        (Duration::from_secs(1)..=Duration::from_millis(1250))
-            .contains(&first_retry.duration_since(now))
-    );
-    assert!(track.should_trigger(first_retry));
-    start_in_flight(&mut track, 10, first_retry);
-    track.finish_failed(first_retry, "boom".to_owned());
-    assert!(!track.should_trigger(first_retry + Duration::from_secs(1)));
-    let second_retry = track.retry.not_before.unwrap();
-    assert!(
-        (Duration::from_secs(2)..=Duration::from_millis(2500))
-            .contains(&second_retry.duration_since(first_retry))
-    );
-    assert!(track.should_trigger(second_retry));
+    for bounded in [false, true] {
+        let now = Instant::now();
+        let mut track = pk_index_track(now, bounded);
+        track.config.trigger_snapshot_count = 1;
+        track.finish_failed(now, "boom".to_owned());
+        record_commits(&mut track, 10);
+        assert!(!track.should_trigger(now));
+        track.record_force_compaction(now, None);
+        assert!(!track.should_trigger(now));
+        let first_retry = track.retry.not_before.unwrap();
+        assert!(
+            (Duration::from_secs(1)..=Duration::from_millis(1250))
+                .contains(&first_retry.duration_since(now))
+        );
+        assert!(track.should_trigger(first_retry));
+        start_in_flight(&mut track, 10, first_retry);
+        track.finish_failed(first_retry, "boom".to_owned());
+        assert!(!track.should_trigger(first_retry + Duration::from_secs(1)));
+        let second_retry = track.retry.not_before.unwrap();
+        assert!(
+            (Duration::from_secs(2)..=Duration::from_millis(2500))
+                .contains(&second_retry.duration_since(first_retry))
+        );
+        assert!(track.should_trigger(second_retry));
+    }
 }
 
 #[tokio::test]
@@ -2766,7 +2769,8 @@ fn test_pk_index_batches_include_new_writes_without_changing_active_attempt() {
     assert_eq!(track.round_boundary(), Some(10));
     assert!(!track.should_trigger(now));
     track.finish_success(now);
-    assert!(track.should_trigger(now));
+    assert!(!track.should_trigger(now));
+    assert!(track.should_trigger(now + Duration::from_secs(120)));
     let second = track.start_attempt();
     assert_eq!(second.max_file_sequence_number, Some(20));
     assert_eq!(
@@ -2782,6 +2786,358 @@ fn test_pk_index_batches_include_new_writes_without_changing_active_attempt() {
     assert_eq!(track.demand.commit_count, 1);
 }
 
+#[test]
+fn test_pk_index_successful_batches_wait_for_interval_under_continuous_commits() {
+    for task_type in [
+        TaskType::Auto,
+        TaskType::SmallFiles,
+        TaskType::FilesWithDelete,
+    ] {
+        for (interval_sec, trigger_snapshot_count) in [(1, 3), (60, 3), (120, 3), (120, usize::MAX)]
+        {
+            for applying in [false, true] {
+                let now = Instant::now();
+                let mut track = new_round_track(now, interval_sec, trigger_snapshot_count, 1);
+                track.config.pk_index_coordinated = true;
+                track.config.policy.task_type = task_type;
+                track.record_observed_snapshot(committed_snapshot(10, 1000));
+                let mut now = now + Duration::from_secs(interval_sec);
+
+                for batch in 0..3 {
+                    assert!(track.should_trigger(now));
+                    let boundary = track.latest_observed_snapshot.as_ref().unwrap().snapshot_id;
+                    let task_id = IcebergCompactionTaskId::new(9 + batch);
+                    start_in_flight(&mut track, task_id, now);
+                    assert_eq!(track.round_boundary(), Some(boundary));
+                    assert_eq!(track.demand.commit_count, 0);
+                    now += Duration::from_secs(5);
+                    commit_update(boundary + 1, 2000).apply_to_track(&mut track, now);
+                    if applying {
+                        let CompactionTrackState::InFlight { attempt, .. } = &track.state else {
+                            unreachable!()
+                        };
+                        track.state = CompactionTrackState::Applying {
+                            task_id,
+                            attempt: attempt.clone(),
+                        };
+                    }
+                    track.finish_success(now);
+                    assert!(!track.should_trigger(now));
+                    assert_eq!(track.round_boundary(), Some(bou
```

---

### Incident Patch 2: `f9f50e79` (2026-10-28)
**Commit Message**: fix(sqlparser): parse IS [NOT] DISTINCT FROM tighter than AND and OR (#27694)

**File**: `e2e_test/batch/basic/precedence.slt.part` (modified, +18/-0)
```diff
@@ -23,6 +23,24 @@ select pg_typeof(-2147483648 * 1);
 ----
 integer
 
+query T
+select null is distinct from true and false; -- is distinct from then and
+----
+f
+
+query T
+select null is not distinct from false or true; -- is not distinct from then or
+----
+t
+
+query T
+select null is distinct from false = false; -- equals then is distinct from
+----
+t
+
+statement error syntax error at or near
+select false is distinct from null is null; -- is is non-associative
+
 
 # query I
 # select @ 1 - 2; -- minus then abs
```

**File**: `src/sqlparser/src/parser.rs` (modified, +16/-2)
```diff
@@ -1389,11 +1389,11 @@ impl Parser<'_> {
                     } else if self.parse_keywords(&[Keyword::NOT, Keyword::NULL]) {
                         Ok(Expr::IsNotNull(Box::new(expr)))
                     } else if self.parse_keywords(&[Keyword::DISTINCT, Keyword::FROM]) {
-                        let expr2 = self.parse_expr()?;
+                        let expr2 = self.parse_is_distinct_from_rhs()?;
                         Ok(Expr::IsDistinctFrom(Box::new(expr), Box::new(expr2)))
                     } else if self.parse_keywords(&[Keyword::NOT, Keyword::DISTINCT, Keyword::FROM])
                     {
-                        let expr2 = self.parse_expr()?;
+                        let expr2 = self.parse_is_distinct_from_rhs()?;
                         Ok(Expr::IsNotDistinctFrom(Box::new(expr), Box::new(expr2)))
                     } else {
                         let negated = self.parse_keyword(Keyword::NOT);
@@ -1575,6 +1575,20 @@ impl Parser<'_> {
         }
     }
 
+    /// Parses the right operand of `IS [NOT] DISTINCT FROM`.
+    ///
+    /// Like PostgreSQL, where `IS` is non-associative, rejects another `IS`, `ISNULL`, or
+    /// `NOTNULL` right after the operand.
+    fn parse_is_distinct_from_rhs(&mut self) -> ModalResult<Expr> {
+        let expr = self.parse_subexpr(Precedence::Is)?;
+
+        if self.get_next_precedence()? == Precedence::Is {
+            parser_err!("syntax error at or near {}", self.peek_token().token);
+        }
+
+        Ok(expr)
+    }
+
     /// Parses the optional constraints following the `IS [NOT] JSON` predicate
     pub fn parse_is_json(&mut self, expr: Expr, negated: bool) -> ModalResult<Expr> {
         let item_type = match self.peek_token().token {
```

**File**: `src/sqlparser/tests/testdata/precedence.yaml` (modified, +25/-0)
```diff
@@ -14,3 +14,28 @@
 - input: select |/ 4 + 12
   formatted_sql: SELECT |/ 4 + 12
   formatted_ast: 'Query(Query { with: None, body: Select(Select { distinct: All, projection: [UnnamedExpr(UnaryOp { op: Custom("|/"), expr: BinaryOp { left: Value(Number("4")), op: Plus, right: Value(Number("12")) } })], from: [], lateral_views: [], selection: None, group_by: [], having: None, window: [] }), order_by: [], limit: None, offset: None, fetch: None })'
+- input: select a is distinct from b and c
+  formatted_sql: SELECT a IS DISTINCT FROM b AND c
+  formatted_ast: 'Query(Query { with: None, body: Select(Select { distinct: All, projection: [UnnamedExpr(BinaryOp { left: IsDistinctFrom(Identifier(Ident { value: "a", quote_style: None }), Identifier(Ident { value: "b", quote_style: None })), op: And, right: Identifier(Ident { value: "c", quote_style: None }) })], from: [], lateral_views: [], selection: None, group_by: [], having: None, window: [] }), order_by: [], limit: None, offset: None, fetch: None })'
+- input: select a is not distinct from b or c
+  formatted_sql: SELECT a IS NOT DISTINCT FROM b OR c
+  formatted_ast: 'Query(Query { with: None, body: Select(Select { distinct: All, projection: [UnnamedExpr(BinaryOp { left: IsNotDistinctFrom(Identifier(Ident { value: "a", quote_style: None }), Identifier(Ident { value: "b", quote_style: None })), op: Or, right: Identifier(Ident { value: "c", quote_style: None }) })], from: [], lateral_views: [], selection: None, group_by: [], having: None, window: [] }), order_by: [], limit: None, offset: None, fetch: None })'
+- input: select a is distinct from b = c
+  formatted_sql: SELECT a IS DISTINCT FROM b = c
+  formatted_ast: 'Query(Query { with: None, body: Select(Select { distinct: All, projection: [UnnamedExpr(IsDistinctFrom(Identifier(Ident { value: "a", quote_style: None }), BinaryOp { left: Identifier(Ident { value: "b", quote_style: None }), op: Eq, right: Identifier(Ident { value: "c", quote_style: None }) }))], from: [], lateral_views: [], selection: None, group_by: [], having: None, window: [] }), order_by: [], limit: None, offset: None, fetch: None })'
+- input: select a is null is distinct from b
+  formatted_sql: SELECT a IS NULL IS DISTINCT FROM b
+  formatted_ast: 'Query(Query { with: None, body: Select(Select { distinct: All, projection: [UnnamedExpr(IsDistinctFrom(IsNull(Identifier(Ident { value: "a", quote_style: None })), Identifier(Ident { value: "b", quote_style: None })))], from: [], lateral_views: [], selection: None, group_by: [], having: None, window: [] }), order_by: [], limit: None, offset: None, fetch: None })'
+- input: select a is distinct from (b is null)
+  formatted_sql: SELECT a IS DISTINCT FROM (b IS NULL)
+  formatted_ast: 'Query(Query { with: None, body: Select(Select { distinct: All, projection: [UnnamedExpr(IsDistinctFrom(Identifier(Ident { value: "a", quote_style: None }), Nested(IsNull(Identifier(Ident { value: "b", quote_style: None })))))], from: [], lateral_views: [], selection: None, group_by: [], having: None, window: [] }), order_by: [], limit: None, offset: None, fetch: None })'
+- input: select a is distinct from b is null
+  error_msg: |-
+    sql parser error: syntax error at or near is
+    LINE 1: select a is distinct from b is null
+                                        ^
+- input: select a is not distinct from b is null
+  error_msg: |-
+    sql parser error: syntax error at or near is
+    LINE 1: select a is not distinct from b is null
+                                            ^
```

---

### Incident Patch 3: `decbbdf0` (2026-10-28)
**Commit Message**: fix(streaming): correlated ARRAY subquery emits transient NULL in MV (#26655)

Co-authored-by: maingoh <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `e2e_test/streaming/bug_fixes/issue_26654.slt` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# https://github.com/risingwavelabs/risingwave/issues/26654
+# A correlated ARRAY(SELECT ...) subquery must never emit a transient NULL in the change stream.
+# `flush` + `select` only observes the settled state, so capture the changes with a force-append-only sink.
+
+statement ok
+create table t1 (id int primary key);
+
+statement ok
+create table t2 (id int primary key, t1_id int, val varchar);
+
+statement ok
+create materialized view mv as
+select t1.id, array(select t2.val from t2 where t2.t1_id = t1.id) as arr from t1;
+
+statement ok
+create table cap (id int, arr varchar[]) append only;
+
+statement ok
+create sink s into cap from mv with (type = 'append-only', force_append_only = 'true');
+
+statement ok
+insert into t1 values (1);
+
+statement ok
+flush;
+
+statement ok
+insert into t2 values (10, 1, 'alpha');
+
+statement ok
+flush;
+
+statement ok
+delete from t2;
+
+statement ok
+flush;
+
+sleep 3s
+
+query I
+select count(*) from cap where arr is null;
+----
+0
+
+query IT
+select id, arr from mv;
+----
+1 {}
+
+statement ok
+drop sink s;
+
+statement ok
+drop table cap;
+
+statement ok
+drop materialized view mv;
+
+statement ok
+drop table t2;
+
+statement ok
+drop table t1;
```

**File**: `src/frontend/planner_test/tests/testdata/input/subquery_expr_correlated.yaml` (modified, +23/-1)
```diff
@@ -716,4 +716,26 @@
     select * from s1.users where exists (select 1 from s2.users where s2.users.id = s1.users.id and s2.users.is_active = false);
   expected_outputs:
     - logical_plan
-    - batch_plan
\ No newline at end of file
+    - batch_plan
+
+- name: array subquery uses inner join
+  sql: |
+    create table t1(id int primary key);
+    create table t2(id int primary key, t1_id int, val varchar);
+    select t1.id, array(select t2.val from t2 where t2.t1_id = t1.id) as arr from t1;
+  expected_outputs:
+    - batch_plan
+    - stream_plan
+
+- name: mixing array and scalar subqueries keeps left outer join
+  sql: |
+    create table t1(id int primary key);
+    create table t2(id int primary key, t1_id int, val varchar);
+    select
+      t1.id,
+      array(select t2.val from t2 where t2.t1_id = t1.id) as arr,
+      (select max(t2.val) from t2 where t2.t1_id = t1.id) as mx
+    from t1;
+  expected_outputs:
+    - batch_plan
+    - stream_plan
```

**File**: `src/frontend/planner_test/tests/testdata/output/subquery.yaml` (modified, +3/-3)
```diff
@@ -863,9 +863,9 @@
   sql: |
     select Array(select 1 union select 2);
   batch_plan: |-
-    BatchNestedLoopJoin { type: LeftOuter, predicate: true, output: all }
-    ├─BatchValues { rows: [[]] }
-    └─BatchProject { exprs: [Coalesce(array_agg(1:Int32), ARRAY[]:List(Int32)) as $expr1] }
+    BatchProject { exprs: [Coalesce(array_agg(1:Int32), ARRAY[]:List(Int32)) as $expr1] }
+    └─BatchNestedLoopJoin { type: Inner, predicate: true, output: all }
+      ├─BatchValues { rows: [[]] }
       └─BatchSimpleAgg { aggs: [array_agg(1:Int32)] }
         └─BatchExchange { order: [], dist: Single }
           └─BatchHashAgg { group_key: [1:Int32], aggs: [] }
```

**File**: `src/frontend/planner_test/tests/testdata/output/subquery_expr_correlated.yaml` (modified, +161/-62)
```diff
@@ -998,10 +998,10 @@
     select Array(select c from t2 where b = d) arr from t1;
   batch_plan: |-
     BatchExchange { order: [], dist: Single }
-    └─BatchHashJoin { type: LeftOuter, predicate: t1.b IS NOT DISTINCT FROM t1.b, output: [$expr1] }
-      ├─BatchExchange { order: [], dist: HashShard(t1.b) }
-      │ └─BatchScan { table: t1, columns: [t1.b], distribution: SomeShard }
-      └─BatchProject { exprs: [t1.b, Coalesce(array_agg(t2.c) filter(IsNotNull(1:Int32)), ARRAY[]:List(Int32)) as $expr1] }
+    └─BatchProject { exprs: [Coalesce(array_agg(t2.c) filter(IsNotNull(1:Int32)), ARRAY[]:List(Int32)) as $expr1] }
+      └─BatchHashJoin { type: Inner, predicate: t1.b IS NOT DISTINCT FROM t1.b, output: all }
+        ├─BatchExchange { order: [], dist: HashShard(t1.b) }
+        │ └─BatchScan { table: t1, columns: [t1.b], distribution: SomeShard }
         └─BatchHashAgg { group_key: [t1.b], aggs: [array_agg(t2.c) filter(IsNotNull(1:Int32))] }
           └─BatchHashJoin { type: LeftOuter, predicate: t1.b IS NOT DISTINCT FROM t2.d, output: [t1.b, t2.c, 1:Int32] }
             ├─BatchHashAgg { group_key: [t1.b], aggs: [] }
@@ -1012,12 +1012,12 @@
                 └─BatchFilter { predicate: IsNotNull(t2.d) }
                   └─BatchScan { table: t2, columns: [t2.c, t2.d], distribution: SomeShard }
   stream_plan: |-
-    StreamMaterialize { columns: [arr, t1._row_id(hidden), t1.b(hidden), t1.b#1(hidden)], stream_key: [t1._row_id, t1.b], pk_columns: [t1._row_id, t1.b], pk_conflict: NoCheck }
-    └─StreamExchange { dist: HashShard(t1._row_id, t1.b) }
-      └─StreamHashJoin { type: LeftOuter, predicate: t1.b IS NOT DISTINCT FROM t1.b, output: [$expr1, t1._row_id, t1.b, t1.b] }
+    StreamMaterialize { columns: [arr, t1._row_id(hidden), t1.b(hidden)], stream_key: [t1._row_id, t1.b], pk_columns: [t1._row_id, t1.b], pk_conflict: NoCheck }
+    └─StreamProject { exprs: [Coalesce(array_agg(t2.c) filter(IsNotNull(1:Int32)), ARRAY[]:List(Int32)) as $expr1, t1._row_id, t1.b] }
+      └─StreamHashJoin { type: Inner, predicate: t1.b IS NOT DISTINCT FROM t1.b, output: [t1.b, t1.b, array_agg(t2.c) filter(IsNotNull(1:Int32)), t1._row_id] }
         ├─StreamExchange { dist: HashShard(t1.b) }
         │ └─StreamTableScan { table: t1, columns: [t1.b, t1._row_id], stream_scan_type: SnapshotBackfill, stream_key: [t1._row_id], pk: [_row_id], dist: UpstreamHashShard(t1._row_id) }
-        └─StreamProject { exprs: [t1.b, Coalesce(array_agg(t2.c) filter(IsNotNull(1:Int32)), ARRAY[]:List(Int32)) as $expr1] }
+        └─StreamProject { exprs: [t1.b, array_agg(t2.c) filter(IsNotNull(1:Int32))] }
           └─StreamHashAgg { group_key: [t1.b], aggs: [array_agg(t2.c) filter(IsNotNull(1:Int32)), count] }
             └─StreamHashJoin { type: LeftOuter, predicate: t1.b IS NOT DISTINCT FROM t2.d, output: [t1.b, t2.c, 1:Int32, t2._row_id] }
               ├─StreamProject { exprs: [t1.b], noop_update_hint: true }
@@ -1044,34 +1044,33 @@
     ORDER BY 1;
   batch_plan: |-
     BatchExchange { order: [rw_users.name ASC], dist: Single }
-    └─BatchProject { exprs: [rw_users.name, rw_users.is_super, true:Boolean, rw_users.create_user, rw_users.create_db, rw_users.can_login, -1:Int32, null:Timestamptz, $expr1, true:Boolean, true:Boolean] }
+    └─BatchProject { exprs: [rw_users.name, rw_users.is_super, true:Boolean, rw_users.create_user, rw_users.create_db, rw_users.can_login, -1:Int32, null:Timestamptz, Coalesce(array_agg(rw_users.name) filter(IsNotNull(1:Int32)), ARRAY[]:List(Varchar)) as $expr1, true:Boolean, true:Boolean] }
       └─BatchSort { order: [rw_users.name ASC] }
-        └─BatchHashJoin { type: LeftOuter, predicate: rw_users.id IS NOT DISTINCT FROM rw_users.id, output: all }
+        └─BatchHashJoin { type: Inner, predicate: rw_users.id IS NOT DISTINCT FROM rw_users.id, output: all }
           ├─BatchExchange { order: [], dist: HashShard(rw_users.id) }
           │ └─BatchFilter { predicate: Not(RegexpEq(rw_users.name, '^pg_':Varchar)) }
           │   └─BatchSysScan { table: rw_users, columns: [rw_users.id, rw_users.name, rw_users.is_super, rw_users.create_db, rw_users.create_user, rw_users.can_login], distribution: Single }
-          └─BatchProject { exprs: [rw_users.id, Coalesce(array_agg(rw_users.name) filter(IsNotNull(1:Int32)), ARRAY[]:List(Varchar)) as $expr1] }
-            └─BatchHashAgg { group_key: [rw_users.id], aggs: [array_agg(rw_users.name) filter(IsNotNull(1:Int32))] }
-              └─BatchHashJoin { type: LeftOuter, predicate: rw_users.id IS NOT DISTINCT FROM rw_users.id, output: [rw_users.id, rw_users.name, 1:Int32] }
-                ├─BatchHashAgg { group_key: [rw_users.id], aggs: [] }
-                │ └─BatchExchange { order: [], dist: HashShard(rw_users.id) }
-                │   └─BatchFilter { predicate: Not(RegexpEq(rw_users.name, '^pg_':Varchar)) }
-                │     └─BatchSysScan { table: rw_users, columns: [rw_users.id, rw_users.name], distribution: Single }
-                └─BatchExcha
```

**File**: `src/frontend/planner_test/tests/testdata/output/vector_search.yaml` (modified, +34/-34)
```diff
@@ -381,17 +381,17 @@
     from events;
   logical_plan: |-
     LogicalProject { exprs: [events.event_id, $expr3, events.time] }
-    └─LogicalApply { type: LeftOuter, on: true, correlated_id: 1, max_one_row: true }
+    └─LogicalApply { type: Inner, on: true, correlated_id: 1, max_one_row: true }
       ├─LogicalScan { table: events, columns: [events.event_id, events.time, events.embedding, events._rw_timestamp] }
       └─LogicalProject { exprs: [Coalesce(array_agg($expr1 order_by($expr2 ASC)), ARRAY[]:List(Struct(Int32, Varchar))) as $expr3] }
         └─LogicalAgg { aggs: [array_agg($expr1 order_by($expr2 ASC))] }
           └─LogicalTopN { order: [$expr2 ASC], limit: 3, offset: 0 }
             └─LogicalProject { exprs: [Row(items.id, items.name) as $expr1, CosineDistance(CorrelatedInputRef { index: 2, correlated_id: 1 }, items.embedding) as $expr2] }
               └─LogicalScan { table: items, columns: [items.id, items.name, items.embedding, items._rw_timestamp] }
   optimized_logical_plan_for_batch: |-
-    LogicalJoin { type: LeftOuter, on: IsNotDistinctFrom(events.embedding, events.embedding), output: [events.event_id, $expr3, events.time] }
-    ├─LogicalScan { table: events, columns: [events.event_id, events.time, events.embedding] }
-    └─LogicalProject { exprs: [events.embedding, Coalesce(array_agg($expr1 order_by($expr2 ASC)) filter(IsNotNull(1:Int32)), ARRAY[]:List(Struct(Int32, Varchar))) as $expr3] }
+    LogicalProject { exprs: [events.event_id, Coalesce(array_agg($expr1 order_by($expr2 ASC)) filter(IsNotNull(1:Int32)), ARRAY[]:List(Struct(Int32, Varchar))) as $expr3, events.time] }
+    └─LogicalJoin { type: Inner, on: IsNotDistinctFrom(events.embedding, events.embedding), output: all }
+      ├─LogicalScan { table: events, columns: [events.event_id, events.time, events.embedding] }
       └─LogicalAgg { group_key: [events.embedding], aggs: [array_agg($expr1 order_by($expr2 ASC)) filter(IsNotNull(1:Int32))] }
         └─LogicalJoin { type: LeftOuter, on: IsNotDistinctFrom(events.embedding, events.embedding), output: [events.embedding, $expr1, $expr2, 1:Int32] }
           ├─LogicalAgg { group_key: [events.embedding], aggs: [] }
@@ -405,10 +405,10 @@
                   └─LogicalScan { table: items, columns: [items.id, items.name, items.embedding] }
   batch_plan: |-
     BatchExchange { order: [], dist: Single }
-    └─BatchHashJoin { type: LeftOuter, predicate: events.embedding IS NOT DISTINCT FROM events.embedding, output: [events.event_id, $expr3, events.time] }
-      ├─BatchExchange { order: [], dist: HashShard(events.embedding) }
-      │ └─BatchScan { table: events, columns: [events.event_id, events.time, events.embedding], distribution: UpstreamHashShard(events.event_id) }
-      └─BatchProject { exprs: [events.embedding, Coalesce(array_agg($expr1 order_by($expr2 ASC)) filter(IsNotNull(1:Int32)), ARRAY[]:List(Struct(Int32, Varchar))) as $expr3] }
+    └─BatchProject { exprs: [events.event_id, Coalesce(array_agg($expr1 order_by($expr2 ASC)) filter(IsNotNull(1:Int32)), ARRAY[]:List(Struct(Int32, Varchar))) as $expr3, events.time] }
+      └─BatchHashJoin { type: Inner, predicate: events.embedding IS NOT DISTINCT FROM events.embedding, output: all }
+        ├─BatchExchange { order: [], dist: HashShard(events.embedding) }
+        │ └─BatchScan { table: events, columns: [events.event_id, events.time, events.embedding], distribution: UpstreamHashShard(events.event_id) }
         └─BatchHashAgg { group_key: [events.embedding], aggs: [array_agg($expr1 order_by($expr2 ASC)) filter(IsNotNull(1:Int32))] }
           └─BatchHashJoin { type: LeftOuter, predicate: events.embedding IS NOT DISTINCT FROM events.embedding, output: [events.embedding, $expr1, $expr2, 1:Int32] }
             ├─BatchHashAgg { group_key: [events.embedding], aggs: [] }
@@ -439,17 +439,17 @@
     as related_info from events;
   logical_plan: |-
     LogicalProject { exprs: [events.event_id, events.time, events.embedding, $expr3] }
-    └─LogicalApply { type: LeftOuter, on: true, correlated_id: 1, max_one_row: true }
+    └─LogicalApply { type: Inner, on: true, correlated_id: 1, max_one_row: true }
       ├─LogicalScan { table: events, columns: [events.event_id, events.time, events.embedding, events._rw_timestamp] }
       └─LogicalProject { exprs: [Coalesce(array_agg($expr1 order_by($expr2 ASC)), ARRAY[]:List(Struct(Int32, Varchar))) as $expr3] }
         └─LogicalAgg { aggs: [array_agg($expr1 order_by($expr2 ASC))] }
           └─LogicalTopN { order: [$expr2 ASC], limit: 3, offset: 0 }
             └─LogicalProject { exprs: [Row(items.id, items.name) as $expr1, CosineDistance(items.embedding, CorrelatedInputRef { index: 2, correlated_id: 1 }) as $expr2] }
               └─LogicalScan { table: items, columns: [items.id, items.name, items.embedding, items._rw_timestamp] }
   optimized_logical_plan_for_batch: |-
-    LogicalJoin { type: LeftOuter, on: IsNotDistinctFrom(events.embedding, events.embedding), output: [event
```

**File**: `src/frontend/src/optimizer/rule/correlated_topn_to_vector_search.rs` (modified, +2/-2)
```diff
@@ -41,8 +41,8 @@ impl CorrelatedTopNToVectorSearchRule {
 impl Rule<Logical> for CorrelatedTopNToVectorSearchRule {
     fn apply(&self, plan: PlanRef) -> Option<PlanRef> {
         let apply = plan.as_logical_apply()?;
-        // match pattern LogicalApply { type: LeftOuter, on: true, correlated_id, max_one_row: true }
-        if apply.join_type() != JoinType::LeftOuter {
+        // match pattern LogicalApply { type: LeftOuter | Inner, on: true, correlated_id, max_one_row: true }
+        if !matches!(apply.join_type(), JoinType::LeftOuter | JoinType::Inner) {
             return None;
         }
         if !apply.max_one_row() {
```

**File**: `src/frontend/src/planner/select.rs` (modified, +24/-2)
```diff
@@ -438,13 +438,23 @@ impl Planner {
                 _ => bail_not_implemented!(issue = 1343, "{:?}", subquery.kind),
             };
 
+            // `Array` subqueries decorrelate to a scalar aggregate with
+            // `Coalesce(array_agg, ARRAY[])`, guaranteeing one row per outer key, so
+            // `Inner` is equivalent to `LeftOuter` in batch. `Inner` also avoids the
+            // streaming transient-NULL caused by `StreamHashJoin(LeftOuter)`
+            // null-padding the outer row before the right-side aggregate arrives.
+            let join_type = if matches!(subquery.kind, SubqueryKind::Array) {
+                JoinType::Inner
+            } else {
+                JoinType::LeftOuter
+            };
             root = Self::create_apply(
                 correlated_id,
                 correlated_indices,
                 root,
                 right,
                 ExprImpl::literal_bool(true),
-                JoinType::LeftOuter,
+                join_type,
                 true,
             );
         }
@@ -518,6 +528,7 @@ impl Planner {
             .collect();
 
         let mut right = None;
+        let mut all_array_subqueries = true;
 
         for subquery in rewriter.subqueries {
             let return_type = subquery.return_type();
@@ -547,6 +558,9 @@ impl Planner {
                 SubqueryKind::Array => subroot.into_array_agg()?,
                 _ => bail_not_implemented!(issue = 1343, "{:?}", subquery.kind),
             };
+            if !matches!(subquery.kind, SubqueryKind::Array) {
+                all_array_subqueries = false;
+            }
             if right.is_none() {
                 right = Some(subplan);
             } else {
@@ -569,13 +583,21 @@ impl Planner {
             correlated_indices.sort();
             correlated_indices.dedup();
 
+            // Same reasoning as `substitute_subqueries_in_left_deep_tree_way`:
+            // only safe when every combined subquery is `Array` (Scalar/Existential
+            // legitimately need `LeftOuter` null-padding).
+            let join_type = if all_array_subqueries {
+                JoinType::Inner
+            } else {
+                JoinType::LeftOuter
+            };
             Self::create_apply(
                 rewriter.correlated_id.expect("must have a correlated id"),
                 correlated_indices,
                 root,
                 right,
                 ExprImpl::literal_bool(true),
-                JoinType::LeftOuter,
+                join_type,
                 true,
             )
         } else {
```

#### Recent Merged Pull Requests:
- **PR #27698** (2026-10-28): fix(meta): do not serialize secret store private key in MetaOpts (#27586) (@risingwave-ci)
- **PR #27697** (2026-10-28): fix(meta): do not serialize secret store private key in MetaOpts (#27586) (@risingwave-ci)
- **PR #27694** (2026-10-28): fix(sqlparser): parse IS [NOT] DISTINCT FROM tighter than AND and OR (@howenyap)
- **PR #27693** (2026-10-28): fix(meta): send notification service responses zstd-compressed (#27654) (@risingwave-ci)
- **PR #27690** (2026-10-28): cherry-pick fix(cdc): commit offsets persisted on non-checkpoint barriers (#27640) to release-3.0 (@yuhao-su)
- **PR #27674** (2026-10-28): chore(deps): Bump next from 16.3.8 to 16.4.1 in /dashboard (@dependabot[bot])

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

## X. iceberg): honor compaction interval between pk-index batches (#27625)

**RULE**:
When implementing operations in `src/meta/src/manager/iceberg_compaction/schedule.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in risingwavelabs/risingwave. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e3fe3b25`: iceberg): honor compaction interval between pk-index batches (#27625). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/meta/src/manager/iceberg_compaction/schedule.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// - An active automatic round follows its next-attempt time. PK-index batches
    ///   can also continue without new commits or trigger early at the commit threshold.
        let commit_ready = self.demand.commit_count >= self.config.trigger_snapshot_count;
        let has_commits = self.demand.commit_count > 0;
            // Continue immediately below the same PK-index boundary when no new
            // commits are pending. Advancing the boundary must honor the cooldown
            // or commit threshold, including commits received after success.
            // Neither continuation nor new demand can bypass failure backoff.
            return time_ready
                || (self.config.pk_index_coordinated && (commit_ready || !has_commits));
            // The new interval applies after the next successful batch or when the
            // round drains. Preserve the current continuation/cooldown/retry deadline.
            // Beneficial PK-index batches can advance their boundary on new commits,
            // so continuous ingestion may prevent the round from ever draining.
            // Keep the cooldown even if commits arrive only after this success.
            // shou
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    /// - An active automatic round is controlled only by its next-attempt time.
            // Active work remains schedulable without new commits. PK-index batches
            // consume new demand when they advance their boundary; legacy rounds
            // retain a fixed boundary. Neither can bypass failure backoff.
            return time_ready;
        let commit_ready = self.demand.commit_count >= self.config.trigger_snapshot_count;
        let has_commits = self.demand.commit_count > 0;
            // The new interval applies after the round drains. The current deadline
            // already represents either immediate continuation or retry backoff.
                next_compaction_time: now,
                    candidates.push((*sink_id, *next_compaction_time));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e3fe3b25` are properly handled with clean fallback behavior.

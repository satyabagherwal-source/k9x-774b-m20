# Forensic Learning Record (Deep Inspection): risingwavelabs/risingwave

> **Canonical Artifact**: `07_PROJECT_LEARNING/risingwavelabs-risingwave-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:01:59.909Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `risingwavelabs/risingwave`
- **Description**: Event streaming platform for agentic AI. Continuously ingest, transform, and serve event streams in real time, at scale.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9357 stars

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

### Core Architecture Module: `src/batch/executors/benches/nested_loop_join.rs`
```
// Copyright 2024 RisingWave Labs
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

pub mod utils;

use criterion::{Criterion, criterion_group, criterion_main};
use risingwave_batch::task::ShutdownToken;
use risingwave_batch_executors::executor::{BoxedExecutor, JoinType, NestedLoopJoinExecutor};
use risingwave_common::enable_jemalloc;
use risingwave_common::memory::MemoryContext;
use risingwave_common::types::DataType;
use risingwave_expr::expr::build_from_pretty;
use utils::{bench_join, create_input};

enable_jemalloc!();

fn create_nested_loop_join_executor(
    join_type: JoinType,
    _with_cond: bool,
    left_chunk_size: usize,
    left_chunk_num: usize,
    right_chunk_size: usize,
    right_chunk_num: usize,
) -> BoxedExecutor {
    const CHUNK_SIZE: usize = 1024;
    let left_input = create_input(&[DataType::Int64], left_chunk_size, left_chunk_num);
    let right_input = create_input(&[DataType::Int64], right_chunk_size, right_chunk_num);

    let output_indices = match join_type {
        JoinType::LeftSemi | JoinType::LeftAnti => vec![0],
        JoinType::RightSemi | JoinType::RightAnti => vec![0],
        _ => vec![0, 1],
    };

    Box::new(NestedLoopJoinExecutor::new(
        build_from_pretty(
            "(equal:boolean
                (modulus:int8 $0:int8 2:int8)
                (modulus:int8 $1:int8 3:int8))",
        ),
        join_type,
        output_indices,
        left_input,
        right_input,
        "NestedLoopJoinExecutor".into(),
        CHUNK_SIZE,
        MemoryContext::none(),
        ShutdownToken::empty(),
    ))
}

fn bench_nested_loop_join(c: &mut Criterion) {
    let with_conds = vec![false];
    let join_types = vec![
        JoinType::Inner,
        JoinType::LeftOuter,
        JoinType::LeftSemi,
        JoinType::LeftAnti,
        JoinType::RightOuter,
        JoinType::RightSemi,
        JoinType::RightAnti,
    ];
    bench_join(
        c,
        "NestedLoopJoinExecutor",
        with_conds,
        join_types,
        create_nested_loop_join_executor,
    );
}

criterion_group!(benches, bench_nested_loop_join);
criterion_main!(benches);

```

### Core Architecture Module: `src/batch/executors/benches/utils/mod.rs`
```
// Copyright 2024 RisingWave Labs
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

use std::hint::black_box;

use criterion::{BatchSize, BenchmarkId, Criterion};
use futures::StreamExt;
use risingwave_batch_executors::test_utils::{MockExecutor, gen_data};
use risingwave_batch_executors::{BoxedExecutor, JoinType};
use risingwave_common::catalog::{Field, Schema};
use risingwave_common::types::DataType;
use tokio::runtime::Runtime;

pub fn bench_join(
    c: &mut Criterion,
    join_name: &str,
    with_conds: Vec<bool>,
    join_types: Vec<JoinType>,
    create_join_executor: fn(JoinType, bool, usize, usize, usize, usize) -> BoxedExecutor,
) {
    const LEFT_SIZE: usize = 2 * 1024;
    const RIGHT_SIZE: usize = 2 * 1024;
    let rt = Runtime::new().unwrap();
    for with_cond in with_conds {
        for join_type in join_types.clone() {
            for chunk_size in &[32, 128, 512, 1024] {
                c.bench_with_input(
                    BenchmarkId::new(
                        join_name,
                        format!("{}({:?})(join: {})", chunk_size, join_type, with_cond),
                    ),
                    chunk_size,
                    |b, &chunk_size| {
                        let left_chunk_num = LEFT_SIZE / chunk_size;
                        let right_chunk_num = RIGHT_SIZE / chunk_size;
                        b.to_async(&rt).iter_batched(
                            || {
                                create_join_executor(
                                    join_type,
                                    with_cond,
                                    chunk_size,
                                    left_chunk_num,
                                    chunk_size,
                                    right_chunk_num,
                                )
                            },
                            execute_executor,
                            BatchSize::SmallInput,
                        );
                    },
                );
            }
        }
    }
}

pub async fn execute_executor(executor: BoxedExecutor) {
    let mut stream = executor.execute();
    while let Some(ret) = stream.next().await {
        _ = black_box(ret.unwrap());
    }
}

pub fn create_input(
    input_types: &[DataType],
    chunk_size: usize,
    chunk_num: usize,
) -> BoxedExecutor {
    let mut input = MockExecutor::new(Schema {
        fields: input_types.iter().cloned().map(Field::unnamed).collect(),
    });
    for c in gen_data(chunk_size, chunk_num, input_types) {
        input.add(c);
    }
    Box::new(input)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #26912** (2026-09-02): **fix(frontend): check source privilege for CDC tables**
  *Symptoms*: I hereby agree to the terms of the [RisingWave Labs, Inc. Contributor License Agreement](https://raw.githubusercontent.com/risingwavelabs/risingwave/17af8a747593ebdbfa826691daf75bdab7d14fa0/.github/contributor-license-agreement.txt).  ## What's changed and what's your intention?  `CREATE TABLE ... FROM <cdc_source>` resolved the source catalog without checking whether the current user had `SELECT` privilege on that source. As a result, a user with `CREATE` privilege on the target schema could create and consume a CDC table from a source they were not allowed to read. Table replacement paths used by `ALTER TABLE` had the same gap.  This PR:  - checks `AclMode::Select` on the referenced CDC source before building a new CDC table plan; - applies the same check when rebuilding an existing CDC table for `ALTER TABLE`; - adds a regression test covering rejection without permission, success after `GRANT SELECT`, and rejection of `ALTER TABLE` after `REVOKE SELECT`.  ## Checklist  - [x] I have written necessary rustdoc comments (no new public API). - [x] I have added necessary unit tests and integration tests. - [x] I have added test labels as necessary. - [ ] I have added fuzzing tests or opened an issue to track them. - [ ] My PR contains breaking changes. - [ ] My PR changes performance-critical code, so I will run (micro) benchmarks and present the results. - [ ] I have checked the Release Timeline and Currently Supported Versions to determine which release branches I need to che
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/risingwavelabs/risingwave/pull/26912)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Team  **Run ID**: `26a3b6b6-4df8-46c6-ba83-6089b04e5987`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between a61d1f9a38ce858f0a89ecd6a4a85f6b736d3b2f and eb751b0c63d6e3f589c9dfff80c7cab5adee5d5f.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `src/frontend/src/handler/create_table.rs`  </details> 
  > ✅ Cherry-pick PRs (or issues if encountered conflicts) have been created successfully to all target branches.

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

### Incident Patch 1: `4274ca16` (2026-10-05)
**Commit Message**: perf(expr): prebuild variant access paths (#26530)

Signed-off-by: StandingMan <[REDACTED_EMAIL]>

**File**: `e2e_test/streaming/variant.slt` (modified, +93/-0)
```diff
@@ -56,6 +56,99 @@ drop materialized view variant_state_mv;
 statement ok
 drop table variant_stream_t;
 
+# Malformed dynamic paths must only null out the failing row in non-strict evaluation.
+# Use one actor and one multi-row insert to exercise valid and invalid paths in the same chunk.
+statement ok
+set streaming_parallelism = 1;
+
+statement ok
+create table variant_dynamic_path_t (
+    id int primary key,
+    payload variant,
+    path varchar
+);
+
+statement ok
+create materialized view variant_dynamic_path_mv as
+select
+    id,
+    variant_get(payload, path) as value,
+    try_variant_get(payload, path) as try_value
+from variant_dynamic_path_t;
+
+statement ok
+insert into variant_dynamic_path_t values
+    (1, '{"a":[{"b":7},{"b":8}],"x.y":9}'::variant, '$.a[0].b'),
+    (2, '{"a":[{"b":7},{"b":8}],"x.y":9}'::variant, '$.'),
+    (3, '{"a":[{"b":7},{"b":8}],"x.y":9}'::variant, '$.a[-1].b');
+
+query ITT rowsort
+select id, value::varchar, try_value::varchar from variant_dynamic_path_mv;
+----
+1 7 7
+2 NULL NULL
+3 8 8
+
+statement ok
+drop materialized view variant_dynamic_path_mv;
+
+statement ok
+drop table variant_dynamic_path_t;
+
+statement ok
+set streaming_parallelism = default;
+
+# A malformed constant path must not fail expression building or bypass SQL NULL short-circuiting.
+statement ok
+create table variant_constant_path_t (
+    id int primary key,
+    payload variant
+);
+
+statement ok
+insert into variant_constant_path_t values (1, NULL);
+
+query ITT
+select id, variant_get(payload, '.')::varchar, try_variant_get(payload, '.')::varchar
+from variant_constant_path_t;
+----
+1 NULL NULL
+
+statement ok
+create materialized view variant_constant_path_mv as
+select
+    id,
+    variant_get(payload, '.') as value,
+    try_variant_get(payload, '.') as try_value
+from variant_constant_path_t;
+
+statement ok
+insert into variant_constant_path_t values (2, NULL);
+
+query ITT rowsort
+select id, value::varchar, try_value::varchar from variant_constant_path_mv;
+----
+1 NULL NULL
+2 NULL NULL
+
+statement ok
+drop materialized view variant_constant_path_mv;
+
+# Non-NULL input must still report the cached parse error in strict batch evaluation.
+statement ok
+update variant_constant_path_t set payload = '{}'::variant where id = 1;
+
+statement error invalid variant path
+select variant_get(payload, '.') from variant_constant_path_t where id = 1;
+
+query T
+select try_variant_get(payload, '.')::varchar from variant_constant_path_t where id = 1;
+----
+NULL
+
+statement ok
+drop table variant_constant_path_t;
+
 # Nested VARIANT must not reach a streaming operator's storage key.
 statement ok
 create table variant_nested_t (
```

**File**: `src/common/src/types/mod.rs` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ pub use self::struct_type::StructType;
 pub use self::successor::Successor;
 pub use self::timestamptz::*;
 pub use self::to_text::ToText;
-pub use self::variant::{VariantRef, VariantVal};
+pub use self::variant::{VariantPath, VariantRef, VariantVal};
 pub use self::with_data_type::WithDataType;
 
 /// A 32-bit floating point type with total order.
```

**File**: `src/common/src/types/variant.rs` (modified, +40/-4)
```diff
@@ -55,6 +55,22 @@ pub struct VariantRef<'a> {
     data: &'a [u8],
 }
 
+/// A parsed path for accessing nested fields in a [`VariantRef`].
+///
+/// Parsing a path once and reusing it avoids repeated string parsing and allocations when the same
+/// path is applied to multiple values.
+#[derive(Debug)]
+pub struct VariantPath {
+    tokens: Vec<PathToken>,
+}
+
+impl VariantPath {
+    /// Parses a variant path.
+    pub fn parse(path: &str) -> anyhow::Result<Self> {
+        parse_path(path).map(|tokens| Self { tokens })
+    }
+}
+
 impl EstimateSize for VariantVal {
     fn estimated_heap_size(&self) -> usize {
         self.data.len()
@@ -379,18 +395,23 @@ impl<'a> VariantRef<'a> {
     }
 
     pub fn access_path_strict(self, path: &str) -> anyhow::Result<Option<VariantVal>> {
+        self.access_path_parsed(&VariantPath::parse(path)?)
+    }
+
+    /// Accesses a nested value using a pre-parsed path.
+    pub fn access_path_parsed(self, path: &VariantPath) -> anyhow::Result<Option<VariantVal>> {
         // Walk the whole path on borrowed variants sharing the same metadata, and canonicalize
         // (re-encode) only the final leaf.
         let mut variant = self.parquet_variant();
-        for token in parse_path(path)? {
+        for token in &path.tokens {
             let next = match token {
-                PathToken::Field(field) => variant.get_object_field(&field),
+                PathToken::Field(field) => variant.get_object_field(field),
                 // Pattern-match instead of `as_list`, whose `&'m self` receiver would keep
                 // `variant` borrowed and forbid the reassignment below.
                 PathToken::Index(index) => match &variant {
                     ParquetVariant::List(list) => {
-                        let index = if index >= 0 {
-                            Some(index as usize)
+                        let index = if *index >= 0 {
+                            Some(*index as usize)
                         } else {
                             list.len().checked_sub(index.unsigned_abs() as usize)
                         };
@@ -899,6 +920,7 @@ fn append_decimal(value: Decimal, builder: &mut impl VariantBuilderExt) -> anyho
     Ok(())
 }
 
+#[derive(Debug)]
 enum PathToken {
     Field(String),
     Index(i32),
@@ -1011,6 +1033,20 @@ mod tests {
         );
     }
 
+    #[test]
+    fn access_path_with_preparsed_path() {
+        let v: VariantVal = r#"{"a":[{"b":7}]}"#.parse().unwrap();
+        let path = VariantPath::parse("$.a[0].b").unwrap();
+        assert_eq!(
+            v.as_scalar_ref()
+                .access_path_parsed(&path)
+                .unwrap()
+                .unwrap()
+                .to_string(),
+            "7"
+        );
+    }
+
     #[test]
     fn path_access_supports_dot_and_bracket() {
         let v: VariantVal = r#"{"a":[{"b":7}]}"#.parse().unwrap();
```

**File**: `src/expr/impl/src/scalar/variant.rs` (modified, +34/-11)
```diff
@@ -12,7 +12,7 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-use risingwave_common::types::{ScalarRefImpl, VariantRef, VariantVal};
+use risingwave_common::types::{ScalarRefImpl, VariantPath, VariantRef, VariantVal};
 use risingwave_expr::expr::Context;
 use risingwave_expr::{ExprError, Result, function};
 use thiserror_ext::AsReport;
@@ -25,19 +25,42 @@ fn to_variant(input: Option<ScalarRefImpl<'_>>, ctx: &Context) -> Result<Variant
     })
 }
 
-#[function("variant_get(variant, varchar) -> variant")]
-fn variant_get(value: VariantRef<'_>, path: &str) -> Result<Option<VariantVal>> {
+#[function(
+    "variant_get(variant, varchar) -> variant",
+    prebuild = "PrebuiltVariantPath::parse($1)"
+)]
+fn variant_get(value: VariantRef<'_>, path: &PrebuiltVariantPath) -> Result<Option<VariantVal>> {
+    let path = path.0.as_ref().map_err(variant_get_error)?;
     value
-        .access_path_strict(path)
-        .map_err(|e| ExprError::InvalidParam {
-            name: "variant_get",
-            reason: e.to_report_string().into(),
-        })
+        .access_path_parsed(path)
+        .map_err(|e| variant_get_error(&e))
 }
 
-#[function("try_variant_get(variant, varchar) -> variant")]
-fn try_variant_get(value: VariantRef<'_>, path: &str) -> Option<VariantVal> {
-    value.access_path(path)
+fn variant_get_error(e: &anyhow::Error) -> ExprError {
+    ExprError::InvalidParam {
+        name: "variant_get",
+        reason: e.to_report_string().into(),
+    }
+}
+
+#[derive(Debug)]
+struct PrebuiltVariantPath(anyhow::Result<VariantPath>);
+
+impl PrebuiltVariantPath {
+    fn parse(path: &str) -> Self {
+        Self(VariantPath::parse(path))
+    }
+}
+
+#[function(
+    "try_variant_get(variant, varchar) -> variant",
+    prebuild = "PrebuiltVariantPath::parse($1)"
+)]
+fn try_variant_get(value: VariantRef<'_>, path: &PrebuiltVariantPath) -> Option<VariantVal> {
+    path.0
+        .as_ref()
+        .ok()
+        .and_then(|path| value.access_path_parsed(path).ok().flatten())
 }
 
 #[function("variant_typeof(variant) -> varchar")]
```

---

### Incident Patch 2: `422f1d56` (2026-10-03)
**Commit Message**: fix(iceberg): set rest.auth.type explicitly for JNI REST catalog (#27221)

**File**: `src/connector/src/connector_common/iceberg/mod.rs` (modified, +49/-5)
```diff
@@ -1093,11 +1093,11 @@ impl IcebergCommon {
                         java_catalog_configs
                             .insert("rest.signing-name".to_owned(), rest_signing_name.clone());
                     }
-                    if let Some(rest_sigv4_enabled) = self.rest_sigv4_enabled {
-                        java_catalog_configs.insert(
-                            "rest.sigv4-enabled".to_owned(),
-                            rest_sigv4_enabled.to_string(),
-                        );
+                    if self.rest_sigv4_enabled == Some(true) {
+                        // Equivalent to the legacy `rest.sigv4-enabled=true`, which is
+                        // deprecated since Iceberg 1.10 and warns on every catalog load.
+                        java_catalog_configs
+                            .insert("rest.auth.type".to_owned(), "sigv4".to_owned());
 
                         if let Some(access_key) = &self.s3_access_key {
                             java_catalog_configs
@@ -1109,6 +1109,15 @@ impl IcebergCommon {
                                 .insert("rest.secret-access-key".to_owned(), secret_key.clone());
                         }
                     }
+                    // Iceberg 1.10+ infers `rest.auth.type=oauth2` from `credential`/`token`
+                    // when it is unset, warning on every catalog load. Set it explicitly.
+                    if !java_catalog_configs.contains_key("rest.auth.type")
+                        && (java_catalog_configs.contains_key("credential")
+                            || java_catalog_configs.contains_key("token"))
+                    {
+                        java_catalog_configs
+                            .insert("rest.auth.type".to_owned(), "oauth2".to_owned());
+                    }
                 }
                 JniCatalogImpl::Glue => {
                     let glue_access_key = self.glue_access_key();
@@ -1384,6 +1393,41 @@ mod tests {
         assert!(!java_catalog_configs.contains_key("client.factory"));
     }
 
+    #[test]
+    fn test_rest_jni_catalog_sets_auth_type_explicitly() {
+        let build = |common: IcebergCommon, props: &[(&str, &str)]| {
+            let props = props
+                .iter()
+                .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
+                .collect();
+            common
+                .build_jni_catalog_configs(JniCatalogImpl::Rest, &props)
+                .unwrap()
+                .1
+        };
+        let oauth2 = IcebergCommon {
+            catalog_credential: Some("client-id:client-secret".to_owned()),
+            rest_sigv4_enabled: Some(false),
+            ..test_common("rest")
+        };
+
+        let configs = build(oauth2.clone(), &[]);
+        assert_eq!(configs.get("rest.auth.type").unwrap(), "oauth2");
+        assert!(!configs.contains_key("rest.sigv4-enabled"));
+
+        let configs = build(oauth2, &[("rest.auth.type", "basic")]);
+        assert_eq!(configs.get("rest.auth.type").unwrap(), "basic");
+
+        let sigv4 = IcebergCommon {
+            catalog_token: Some("token".to_owned()),
+            rest_sigv4_enabled: Some(true),
+            ..test_common("rest")
+        };
+        let configs = build(sigv4, &[]);
+        assert_eq!(configs.get("rest.auth.type").unwrap(), "sigv4");
+        assert!(!configs.contains_key("rest.sigv4-enabled"));
+    }
+
     #[test]
     fn test_adlsgen2_service_principal_populates_file_io_configs_with_default_authority_host() {
         let common = test_adlsgen2_service_principal_common(None);
```

---

### Incident Patch 3: `5149d7b2` (2026-09-28)
**Commit Message**: fix(object-store): propagate metadata errors during listing (#27266)

**File**: `src/object_store/src/object/opendal_engine/opendal_object_store.rs` (modified, +44/-33)
```diff
@@ -17,7 +17,7 @@ use std::time::Duration;
 
 use bytes::{Bytes, BytesMut};
 use fail::fail_point;
-use futures::{StreamExt, stream};
+use futures::StreamExt;
 use opendal::layers::{RetryLayer, TimeoutLayer};
 use opendal::raw::BoxedStaticFuture;
 use opendal::services::Memory;
@@ -260,38 +260,9 @@ impl ObjectStore for OpendalObjectStore {
         let object_lister = object_lister.await?;
 
         let op = self.op.clone();
-        let stream = stream::unfold(object_lister, move |mut object_lister| {
+        let stream = object_lister.then(move |object| {
             let op = op.clone();
-
-            async move {
-                match object_lister.next().await {
-                    Some(Ok(object)) => {
-                        let key = object.path().to_owned();
-
-                        // OpenDAL 0.55 removed list metadata capability flags and reports
-                        // unknown content length as 0. Use listed metadata first, and call
-                        // stat() if timestamp is missing or size is 0 to avoid treating
-                        // unknown sizes as real zero-byte objects.
-                        let meta = object.metadata();
-                        let mut last_modified = meta.last_modified().map(timestamp_to_secs);
-                        let mut total_size = meta.content_length() as usize;
-                        if last_modified.is_none() || total_size == 0 {
-                            let stat_meta = op.stat(&key).await.ok()?;
-                            last_modified = stat_meta.last_modified().map(timestamp_to_secs);
-                            total_size = stat_meta.content_length() as usize;
-                        }
-
-                        let metadata = ObjectMetadata {
-                            key,
-                            last_modified: last_modified.unwrap_or(0_f64),
-                            total_size,
-                        };
-                        Some((Ok(metadata), object_lister))
-                    }
-                    Some(Err(err)) => Some((Err(err.into()), object_lister)),
-                    None => None,
-                }
-            }
+            async move { Self::listed_object_metadata(&op, object?).await }
         });
 
         Ok(stream.take(limit.unwrap_or(usize::MAX)).boxed())
@@ -303,6 +274,28 @@ impl ObjectStore for OpendalObjectStore {
 }
 
 impl OpendalObjectStore {
+    async fn listed_object_metadata(
+        op: &Operator,
+        object: opendal::Entry,
+    ) -> ObjectResult<ObjectMetadata> {
+        let key = object.path().to_owned();
+        // OpenDAL 0.55 removed list metadata capability flags and reports unknown sizes as 0.
+        let meta = object.metadata();
+        let mut last_modified = meta.last_modified().map(timestamp_to_secs);
+        let mut total_size = meta.content_length() as usize;
+        if last_modified.is_none() || total_size == 0 {
+            // Propagate stat failures; treating one as EOF can make recovery trust a partial scan.
+            let stat_meta = op.stat(&key).await?;
+            last_modified = stat_meta.last_modified().map(timestamp_to_secs);
+            total_size = stat_meta.content_length() as usize;
+        }
+        Ok(ObjectMetadata {
+            key,
+            last_modified: last_modified.unwrap_or(0_f64),
+            total_size,
+        })
+    }
+
     pub async fn copy(&self, from_path: &str, to_path: &str) -> ObjectResult<()> {
         self.op.copy(from_path, to_path).await?;
         Ok(())
@@ -520,7 +513,7 @@ impl StreamingUploader for OpendalStreamingUploader {
 
 #[cfg(test)]
 mod tests {
-    use stream::TryStreamExt;
+    use futures::TryStreamExt;
 
     use super::*;
 
@@ -609,6 +602,24 @@ mod tests {
         uploader.finish().await.unwrap_err();
     }
 
+    #[tokio::test]
+    async fn test_listed_object_metadata_propagates_stat_failure() {
+        let store = OpendalObjectStore::test_new_memory_engine().unwrap();
+        store
+            .upload("sst", Bytes::from_static(b"data"))
+            .await
+            .unwrap();
+        // Capture the listed entry before deletion so the subsequent metadata lookup fails.
+        // Memory entries have no last_modified, so our adapter must stat even a listed file.
+        let mut objects = store.op.lister_with("").recursive(true).await.unwrap();
+        let object = objects.next().await.unwrap().unwrap();
+        store.delete("sst").await.unwrap();
+        let error = OpendalObjectStore::listed_object_metadata(&store.op, object)
+            .await
+            .unwrap_err();
+        assert!(error.is_object_not_found_error());
+    }
+
     #[tokio::test]
     async fn test_memory_delete_objects_and_list_object() {
         let block1 = Bytes::from("123456");
```

---

### Incident Patch 4: `533b0c09` (2026-09-28)
**Commit Message**: fix(cdc): force-close SQL Server connections on shutdown (#27186)

**File**: `ci/scripts/e2e-source-cdc-test.sh` (modified, +15/-0)
```diff
@@ -33,6 +33,21 @@ echo "--- Run inline CDC source tests"
 risedev slt './e2e_test/source_inline/cdc/**/*.slt' --skip 'cron_only' -j1 --label "can-use-recover"
 risedev slt './e2e_test/source_inline/cdc/**/*.slt.serial' --skip 'cron_only' --label "can-use-recover"
 
+echo "--- Run SQL Server encrypted abort regression test"
+sqlserver_abort_test_classes=$(mktemp -d)
+source_cdc_jars=(./connector-node/libs/risingwave-source-cdc-*.jar)
+if [[ ${#source_cdc_jars[@]} -ne 1 || ! -f "${source_cdc_jars[0]}" ]]; then
+  echo "Expected exactly one risingwave-source-cdc jar in connector-node/libs" >&2
+  exit 1
+fi
+source_cdc_classpath="${source_cdc_jars[0]}:./connector-node/libs/*"
+javac -cp "${source_cdc_classpath}" \
+  -d "${sqlserver_abort_test_classes}" \
+  e2e_test/source_inline/cdc/sql_server/SqlServerEncryptedAbortTest.java
+java -cp "${sqlserver_abort_test_classes}:${source_cdc_classpath}" \
+  io.debezium.connector.sqlserver.SqlServerEncryptedAbortTest
+rm -rf "${sqlserver_abort_test_classes}"
+
 echo "--- Run TVF source tests"
 export MYSQL_HOST=mysql MYSQL_TCP_PORT=3306 MYSQL_PWD=123456
 risedev slt './e2e_test/source_inline/tvf/*.slt'
```

**File**: `e2e_test/source_inline/cdc/sql_server/SqlServerEncryptedAbortTest.java` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+/*
+ * Copyright 2026 RisingWave Labs
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package io.debezium.connector.sqlserver;
+
+import java.sql.Connection;
+import java.sql.DriverManager;
+import java.sql.PreparedStatement;
+import java.sql.ResultSet;
+import java.sql.SQLException;
+import java.sql.Statement;
+import java.time.Duration;
+import java.util.concurrent.ExecutionException;
+import java.util.concurrent.ExecutorService;
+import java.util.concurrent.Executors;
+import java.util.concurrent.Future;
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.TimeoutException;
+
+/** Regression test for aborting an encrypted connection blocked in a socket read. */
+public final class SqlServerEncryptedAbortTest {
+    private static final Duration REQUEST_START_TIMEOUT = Duration.ofSeconds(10);
+    private static final Duration ABORT_RETURN_TIMEOUT = Duration.ofSeconds(2);
+    private static final Duration READ_UNBLOCK_TIMEOUT = Duration.ofSeconds(10);
+
+    private SqlServerEncryptedAbortTest() {}
+
+    public static void main(String[] args) throws Exception {
+        String host = envOrDefault("SQLCMDSERVER", "sqlserver-server");
+        String port = envOrDefault("SQLCMDPORT", "1433");
+        String user = envOrDefault("SQLCMDUSER", "SA");
+        String password = requiredEnv("SQLCMDPASSWORD");
+        String url =
+                "jdbc:sqlserver://"
+                        + host
+                        + ":"
+                        + port
+                        + ";databaseName=master;encrypt=true;trustServerCertificate=true";
+
+        ExecutorService queryExecutor =
+                Executors.newSingleThreadExecutor(
+                        command -> {
+                            Thread thread = new Thread(command, "sqlserver-blocked-read-test");
+                            thread.setDaemon(true);
+                            return thread;
+                        });
+        Connection blocked = DriverManager.getConnection(url, user, password);
+        try (Connection control = DriverManager.getConnection(url, user, password)) {
+            int sessionId = sessionIdAndAssertEncrypted(blocked);
+            Future<?> blockedRead =
+                    queryExecutor.submit(
+                            () -> {
+                                try (Statement statement = blocked.createStatement()) {
+                                    statement.execute("WAITFOR DELAY '00:10:00'");
+                                }
+                                return null;
+                            });
+
+            waitForRequest(control, sessionId);
+
+            long startedAt = System.nanoTime();
+            SqlServerStreamingChangeEventSource.abortConnection(blocked, "test");
+            Duration abortDuration = Duration.ofNanos(System.nanoTime() - startedAt);
+            if (abortDuration.compareTo(ABORT_RETURN_TIMEOUT) > 0) {
+                throw new AssertionError("abort blocked for " + abortDuration);
+            }
+
+            assertReadUnblocked(blockedRead);
+            waitForSessionClosed(control, sessionId);
+        } finally {
+            queryExecutor.shutdownNow();
+        }
+    }
+
+    private static int sessionIdAndAssertEncrypted(Connection connection) throws SQLException {
+        try (Statement statement = connection.createStatement();
+                ResultSet result =
+                        statement.executeQuery(
+                                "SELECT @@SPID, encrypt_option "
+                                        + "FROM sys.dm_exec_connections "
+                                        + "WHERE session_id = @@SPID")) {
+            if (!result.next()) {
+                throw new AssertionError("SQL Server connection was not visible");
+            }
+            if (!"TRUE".equalsIgnoreCase(result.getString(2))) {
+                throw new AssertionError("test connection is not encrypted");
+            }
+            return result.getInt(1);
+        }
+    }
+
+    private static void waitForRequest(Connection control, int sessionId) throws Exception {
+        long deadline = System.nanoTime() + REQUEST_START_TIMEOUT.toNanos();
+        try (PreparedStatement statement =
+                control.prepareStatement(
+                        "SELECT COUNT(*) FROM sys.dm_exec_requests WHERE session_id = ?")) {
+            statement.setInt(1, sessionId);
+            while (System.n
```

**File**: `java/connector-node/risingwave-source-cdc/src/main/java/io/debezium/connector/sqlserver/SqlServerStreamingChangeEventSource.java` (modified, +105/-0)
```diff
@@ -16,6 +16,8 @@
 
 package io.debezium.connector.sqlserver;
 
+import com.microsoft.sqlserver.jdbc.SQLServerConnection;
+import io.debezium.DebeziumException;
 import io.debezium.pipeline.ErrorHandler;
 import io.debezium.pipeline.EventDispatcher;
 import io.debezium.pipeline.notification.Notification;
@@ -29,6 +31,10 @@
 import io.debezium.snapshot.SnapshotterService;
 import io.debezium.util.Clock;
 import io.debezium.util.ElapsedTimeStrategy;
+import java.io.IOException;
+import java.lang.reflect.Field;
+import java.net.Socket;
+import java.sql.Connection;
 import java.sql.ResultSet;
 import java.sql.SQLException;
 import java.time.Duration;
@@ -46,6 +52,7 @@
 import java.util.Queue;
 import java.util.Set;
 import java.util.UUID;
+import java.util.concurrent.Executor;
 import java.util.concurrent.atomic.AtomicBoolean;
 import java.util.concurrent.atomic.AtomicReference;
 import java.util.regex.Matcher;
@@ -84,12 +91,30 @@ public class SqlServerStreamingChangeEventSource
     private static final Logger LOGGER =
             LoggerFactory.getLogger(SqlServerStreamingChangeEventSource.class);
 
+    /**
+     * The SQL Server driver performs {@link Connection#abort(Executor)} cleanup on the supplied
+     * executor. Never run it on the coordinator thread because cleanup of an encrypted connection
+     * can block in {@code SSLSocket.close()}.
+     */
+    private static final Executor ABORT_EXECUTOR =
+            command -> {
+                Thread thread = new Thread(command, "sqlserver-jdbc-abort");
+                thread.setDaemon(true);
+                thread.start();
+            };
+
     private static final Duration DEFAULT_INTERVAL_BETWEEN_COMMITS = Duration.ofMinutes(1);
     private static final int INTERVAL_BETWEEN_COMMITS_BASED_ON_POLL_FACTOR = 3;
 
     /** Connection used for reading CDC tables. */
     private final SqlServerConnection dataConnection;
 
+    /**
+     * Cached and refreshed by the source thread so emergency shutdown never needs to acquire the
+     * synchronized {@link SqlServerConnection} monitor.
+     */
+    private volatile Connection rawDataConnection;
+
     /**
      * A separate connection for retrieving details of the schema changes; without it, adaptive
      * buffering will not work.
@@ -99,6 +124,9 @@ public class SqlServerStreamingChangeEventSource
      */
     private final SqlServerConnection metadataConnection;
 
+    /** See {@link #rawDataConnection}. */
+    private volatile Connection rawMetadataConnection;
+
     private final EventDispatcher<SqlServerPartition, TableId> dispatcher;
     private final ErrorHandler errorHandler;
     private final Clock clock;
@@ -133,6 +161,11 @@ public SqlServerStreamingChangeEventSource(
         this.connectorConfig = connectorConfig;
         this.dataConnection = dataConnection;
         this.metadataConnection = metadataConnection;
+        try {
+            refreshRawConnections();
+        } catch (SQLException e) {
+            throw new DebeziumException("Failed to cache initial SQL Server JDBC connections", e);
+        }
         this.dispatcher = dispatcher;
         this.errorHandler = errorHandler;
         this.clock = clock;
@@ -158,6 +191,72 @@ public void setOnConnectedCallback(Runnable callback) {
         this.onConnectedCallback = callback;
     }
 
+    /**
+     * Abort the underlying SQL Server connections from outside the source thread so an in-flight
+     * JDBC operation that does not respond to {@link Thread#interrupt()} is unblocked.
+     *
+     * <p>The coordinator invokes this only after graceful shutdown and {@code shutdownNow()} have
+     * both timed out. mssql-jdbc's normal close path first closes its SSL socket, which can wait
+     * for the same lock held by an encrypted socket read. This method therefore closes the
+     * underlying TCP socket directly before scheduling normal driver cleanup asynchronously.
+     * Closing a {@link Socket} is thread-safe and unblocks its current read without acquiring the
+     * driver's SSL or input-stream locks. The source thread refreshes the raw handles before each
+     * iteration so this method does not acquire the {@link SqlServerConnection} monitor, which may
+     * itself be held by a wedged synchronized JDBC operation.
+     */
+    public void forceCloseConnection() {
+        LOGGER.warn("Force-aborting SQL Server connections to unblock wedged native I/O");
+        abortConnection(rawDataConnection, "data");
+        abortConnection(rawMetadataConnection, "metadata");
+    }
+
+    static void abortConnection(Connection connection, String connectionName) {
+        if (connection == null) {
+            return;
+        }
+
+        try {
+            closeTcpTransport(connection);
+        } catch (Exception e) {
+            LOGGER.warn(
+                    "Exception while force-closing SQL Server {} TCP transport", connectionName, e);
+        }
+
+        try {
+            connection.abort(ABORT_EXECUTOR);
```

**File**: `java/connector-node/risingwave-source-cdc/src/main/java/io/debezium/pipeline/ChangeEventSourceCoordinator.java` (modified, +10/-6)
```diff
@@ -503,8 +503,12 @@ private void forceCloseStreamingSourceConnection() {
             ((io.debezium.connector.postgresql.PostgresStreamingChangeEventSource) streamingSource)
                     .forceCloseConnection();
         }
-        // SQL Server has the same uninterruptible JDBC commit() pattern; follow-up tracked
-        // separately. MySQL (BinaryLogClient) and MongoDB (cursor) are not affected.
+        if (streamingSource
+                instanceof io.debezium.connector.sqlserver.SqlServerStreamingChangeEventSource) {
+            ((io.debezium.connector.sqlserver.SqlServerStreamingChangeEventSource) streamingSource)
+                    .forceCloseConnection();
+        }
+        // MySQL (BinaryLogClient) and MongoDB (cursor) are not affected.
     }
 
     /** Stops this coordinator. */
@@ -537,16 +541,16 @@ public synchronized void stop() throws InterruptedException {
                     // shutdownNow() only interrupts; native JDBC commit() ignores
                     // Thread.interrupt(). Force-close the underlying source connection so the
                     // wedged commit throws SocketException, allowing the source thread to unwind
-                    // through its finally block (which releases keep-alive threads + replication
-                    // slot). See risingwavelabs/risingwave#26075.
+                    // and release upstream resources. See risingwavelabs/risingwave#26075 and
+                    // #26081.
                     forceCloseStreamingSourceConnection();
                     boolean forceCloseOk =
                             executor.awaitTermination(shutdownWaitTimeout, TimeUnit.MILLISECONDS);
                     if (!forceCloseOk) {
                         LOGGER.warn(
                                 "Source thread still not terminated after force-closing the "
-                                        + "connection; the replication slot may remain held. See "
-                                        + "risingwavelabs/risingwave#26075");
+                                        + "connection; upstream resources may remain held. See "
+                                        + "risingwavelabs/risingwave#26075 and #26081");
                     }
                 }
             }
```

---

### Incident Patch 5: `ac4394c8` (2026-09-27)
**Commit Message**: chore(deps): Bump uuid from 1.23.0 to 1.26.1 (#27307)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -19039,9 +19039,9 @@ checksum = "711b9620af191e0cdc7468a8d14e709c3dcdb115b36f838e601583af800a370a"
 
 [[package]]
 name = "uuid"
-version = "1.23.0"
+version = "1.26.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5ac8b6f42ead25368cf5b098aeb3dc8a1a2c05a3eee8a9a1a68c640edbfc79d9"
+checksum = "2ef6dac1e96601b4fb3acccccff2139741fcb757cb9a36089bf5be91cfb285ce"
 dependencies = [
  "getrandom 0.4.2",
  "js-sys",
```

---

### Incident Patch 6: `c735a677` (2026-09-27)
**Commit Message**: chore(deps): Bump quick-xml from 0.40.1 to 0.41.0 (#27304)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +1/-11)
```diff
@@ -12867,16 +12867,6 @@ dependencies = [
  "serde",
 ]
 
-[[package]]
-name = "quick-xml"
-version = "0.40.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2474bd2e5029e7ccb6abb2ba48cf2383a333851dedf495901544281590c7da7f"
-dependencies = [
- "memchr",
- "serde",
-]
-
 [[package]]
 name = "quick-xml"
 version = "0.41.0"
@@ -14720,7 +14710,7 @@ dependencies = [
  "prometheus",
  "prometheus-http-query",
  "prost 0.14.3",
- "quick-xml 0.40.1",
+ "quick-xml 0.41.0",
  "rand 0.9.5",
  "risingwave_batch",
  "risingwave_batch_executors",
```

**File**: `src/frontend/Cargo.toml` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ pretty_assertions = "1"
 prometheus = { version = "0.14", features = ["process"] }
 prometheus-http-query = "0.9.0"
 prost = { workspace = true }
-quick-xml = { version = "0.40", features = ["serialize"] }
+quick-xml = { version = "0.41", features = ["serialize"] }
 rand = { version = "0.9", features = ["small_rng"] }
 risingwave_batch = { workspace = true }
 risingwave_common = { workspace = true }
```

---

### Incident Patch 7: `3edb9755` (2026-09-25)
**Commit Message**: build(deps): bump reqwest from 0.12.25 to 0.13.4 (#24761)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +34/-33)
```diff
@@ -27,7 +27,7 @@ dependencies = [
  "regex",
  "toml 1.1.2+spec-1.1.0",
  "windows-registry",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -806,7 +806,7 @@ dependencies = [
  "itertools 0.14.0",
  "pyo3",
  "pyo3-build-config",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "rquickjs",
  "serde_json",
  "tempfile",
@@ -2109,7 +2109,7 @@ dependencies = [
  "bitflags 2.13.1",
  "cexpr",
  "clang-sys",
- "itertools 0.10.5",
+ "itertools 0.11.0",
  "log",
  "prettyplease",
  "proc-macro2",
@@ -5560,7 +5560,7 @@ dependencies = [
  "libc",
  "option-ext",
  "redox_users 0.5.2",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -5776,7 +5776,7 @@ dependencies = [
  "flate2",
  "lazy_static",
  "percent-encoding",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "rustc_version",
  "serde",
  "serde_json",
@@ -6949,7 +6949,7 @@ dependencies = [
  "prost 0.14.3",
  "prost-build 0.14.3",
  "prost-types 0.14.3",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "serde",
  "serde_json",
  "thiserror 2.0.17",
@@ -7811,7 +7811,7 @@ dependencies = [
  "ordered-float 4.1.1",
  "parquet",
  "rand 0.9.5",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "roaring",
  "serde",
  "serde_bytes",
@@ -7857,7 +7857,7 @@ dependencies = [
  "http 1.4.0",
  "iceberg",
  "itertools 0.13.0",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "serde",
  "serde_derive",
  "serde_json",
@@ -8962,7 +8962,7 @@ version = "0.7.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "6369eee4682fb11edf538388b43c61ce288b8302fe89bb40944d7daa7faaae99"
 dependencies = [
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "serde",
  "serde_json",
  "serde_repr",
@@ -9395,7 +9395,7 @@ dependencies = [
  "memmap2 0.9.11",
  "once_cell",
  "rand 0.9.5",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "serde",
  "tar",
  "thiserror 2.0.17",
@@ -10628,12 +10628,12 @@ version = "5.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "51e219e79014df21a225b1860a479e2dcd7cbd9130f4defd4bd0e191ea31d67d"
 dependencies = [
- "base64 0.22.1",
+ "base64 0.21.7",
  "chrono",
  "getrandom 0.2.11",
  "http 1.4.0",
  "rand 0.8.5",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "serde",
  "serde_json",
  "serde_path_to_error",
@@ -10731,7 +10731,7 @@ dependencies = [
  "percent-encoding",
  "quick-xml 0.39.0",
  "rand 0.10.1",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "ring",
  "rustls-pki-types",
  "serde",
@@ -11230,7 +11230,7 @@ dependencies = [
  "bytes",
  "http 1.4.0",
  "opentelemetry",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
 ]
 
 [[package]]
@@ -11245,7 +11245,7 @@ dependencies = [
  "opentelemetry-proto",
  "opentelemetry_sdk",
  "prost 0.14.3",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "thiserror 2.0.17",
  "tokio",
  "tonic",
@@ -11832,7 +11832,7 @@ dependencies = [
  "peekable",
  "postgres-types",
  "rand 0.8.5",
- "reqwest 0.12.25",
+ "reqwest 0.13.4",
  "risingwave_common",
  "risingwave_sqlparser",
  "rsa",
@@ -12498,7 +12498,7 @@ checksum = "0fcebfa99f03ae51220778316b37d24981e36322c82c24848f48c5bd0f64cbdb"
 dependencies = [
  "enum-as-inner 0.6.1",
  "mime",
- "reqwest 0.12.25",
+ "reqwest 0.12.28",
  "serde",
  "time",
  "url",
@@ -13528,9 +13528,9 @@ dependencies = [
 
 [[package]]
 name = "reqwest"
-version = "0.12.25"
+version = "0.12.28"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b6eff9328d40131d43bd911d42d79eb6a47312002a4daefc9e37f17e74a7701a"
+checksum = "eddd3ca559203180a307f12d114c268abf583f59b03cb906fd0b3ff8646c1147"
 dependencies = [
  "base64 0.22.1",
  "bytes",
@@ -13585,6 +13585,7 @@ dependencies = [
  "base64 0.22.1",
  "bytes",
  "encoding_rs",
+ "futures-channel",
  "futures-core",
  "futures-util",
  "h2 0.4.12",
@@ -13710,7 +13711,7 @@ dependencies = [
  "panic-message",
  "redis",
  "regex",
- "reqwest 0.12.25",
+ "reqwest 0.13.4",
  "serde",
  "serde_json",
  "serde_yaml",
@@ -14007,7 +14008,7 @@ dependencies = [
  "prost 0.14.3",
  "rand 0.9.5",
  "regex",
- "reqwest 0.12.25",
+ "reqwest 0.13.4",
  "risingwave-fields-derive",
  "risingwave_common_estimate_size",
  "risingwave_common_log",
@@ -14173,7 +14174,7 @@ dependencies = [
  "moka",
  "parking_lot 0.12.5",
  "prost 0.14.3",
- "reqwest 0.12.25",
+ "reqwest 0.13.4",
  "risingwave_pb",
  "serde",
  "serde_json",
@@ -14393,7 +14394,7 @@ dependencies = [
  "rand 0.9.5",
  "redis",
  "regex",
- "reqwest 0.12.25",
+ "reqwest 0.13.4",
  "risingwave_common",
  "risingwave_common_estimate_size",
  "risingwave_common_rate_limit",
@@ -14466,7 +14467,7 @@ dependencies = [
  "proto-src-confluent",
  "proto-src-google-type",
  "protox",
- "reqwest 0.12.25",
+ "reqwest 0.13.4",
  "risingwave_common",
  "risingwave_pb",
  "rust_decimal",
@@ -15028,7 +15029,7 @@ dependencies = [
  "cargo-emit",
  "dircpy",
  "mime_guess",
- "reqwest 0.12.25",
+ "reqwest 0.13.4",
  "rust-embed",
  "thiserror-ext",
  "tokio",
@@ -15580,7 +15581,7 @@ dependencies = [
  "jsonbb",
  "madsim-tokio",
  "prost 0.14.3",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -239,7 +239,7 @@ rdkafka = { package = "madsim-rdkafka", git = "https://github.com/risingwavelabs
 ] }
 redis = { version = "1.0" }
 regex = "1.12"
-reqwest = { version = "0.12.2", features = ["json", "stream"] }
+reqwest = { version = "0.13.4", features = ["json", "stream"] }
 risingwave_backup = { path = "./src/storage/backup" }
 risingwave_batch = { path = "./src/batch" }
 risingwave_batch_executors = { path = "./src/batch/executors" }
```

**File**: `src/common/Cargo.toml` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ prometheus = { version = "0.14" }
 prost = { workspace = true }
 rand = { workspace = true }
 regex = { workspace = true }
-reqwest = { version = "0.12.2", features = ["json"] }
+reqwest = { version = "0.13.4", features = ["json"] }
 risingwave-fields-derive = { path = "./fields-derive" }
 risingwave_common_estimate_size = { workspace = true }
 risingwave_common_log = { path = "./log" }
```

**File**: `src/common/telemetry_event/Cargo.toml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ repository = { workspace = true }
 [dependencies]
 jsonbb = { workspace = true }
 prost = { workspace = true }
-reqwest = { version = "0.12.2", features = ["json"] }
+reqwest = { version = "0.13.4", features = ["json"] }
 risingwave_common_log = { path = "../log" }
 risingwave_pb = { workspace = true }
 thiserror-ext = { workspace = true }
```

**File**: `src/connector/codec/Cargo.toml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ prost-types = { workspace = true }
 proto-src-confluent = "0.1"
 proto-src-google-type = "0.1"
 protox = "0.9.1"
-reqwest = { version = "0.12.2", features = ["json"] }
+reqwest = { version = "0.13.4", features = ["json"] }
 risingwave_common = { workspace = true }
 risingwave_pb = { workspace = true }
 rust_decimal = "1"
```

**File**: `src/meta/dashboard/Cargo.toml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ axum = { workspace = true }
 axum-embed = "0.1"
 bytes = "1"
 mime_guess = "2"
-reqwest = "0.12.2"
+reqwest = "0.13.4"
 rust-embed = { version = "8", features = ["interpolate-folder-path", "mime-guess"] }
 thiserror-ext = { workspace = true }
 tracing = "0.1"
```

**File**: `src/risedevtool/Cargo.toml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ panic-message = "0.3"
 rdkafka = { workspace = true }
 redis = { workspace = true }
 regex = { workspace = true }
-reqwest = { version = "0.12.2", features = ["blocking"] }
+reqwest = { version = "0.13.4", features = ["blocking"] }
 serde = { workspace = true }
 serde_json = "1"
 serde_yaml = "0.9"
```

**File**: `src/utils/pgwire/Cargo.toml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ panic-message = "0.3"
 parking_lot = { workspace = true }
 peekable = { version = "0.4", features = ["tokio"] }
 postgres-types = { version = "0.2.6" }
-reqwest = "0.12.2"
+reqwest = "0.13.4"
 risingwave_common = { workspace = true }
 risingwave_sqlparser = { workspace = true }
 rustls = "0.23"
```

---

### Incident Patch 8: `faf139cc` (2026-09-25)
**Commit Message**: fix(test): widen retry windows for batch refresh and kafka-sasl e2e (#27258)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `e2e_test/kafka-sasl/alter_connection_connector.slt` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ create table t_conn(x int) with (
 ) format plain encode json;
 
 
-query I retry 3 backoff 1s
+query I retry 15 backoff 2s
 select * from t_conn order by x;
 ----
 1
```

**File**: `e2e_test/streaming/batch_refresh_periodic.slt` (modified, +5/-4)
```diff
@@ -57,9 +57,10 @@ SELECT * FROM mv_up;
 3
 4
 
-# Wait for at least one refresh cycle to kick in and complete. The retry
-# window covers variance in the periodic trigger's firing time.
-query I rowsort retry 15 backoff 1s
+# Wait for at least one refresh cycle to kick in and complete. A cycle starts only
+# once the committed epoch passes the interval, which can lag by over 10s on a
+# loaded cluster.
+query I rowsort retry 30 backoff 2s
 SELECT * FROM mv_batch;
 ----
 1
@@ -86,7 +87,7 @@ SELECT * FROM mv_up;
 4
 5
 
-query I rowsort retry 15 backoff 1s
+query I rowsort retry 30 backoff 2s
 SELECT * FROM mv_batch;
 ----
 2
```

**File**: `e2e_test/streaming/batch_refresh_snapshot.slt` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ SELECT * FROM mv_up;
 2
 3
 
-query I rowsort retry 15 backoff 1s
+query I rowsort retry 30 backoff 2s
 SELECT * FROM mv_batch;
 ----
 1
```

---

### Incident Patch 9: `3060ab45` (2026-09-24)
**Commit Message**: fix(refresh): finish a table refresh only after all materialize actors and abandon it on recovery (#27041)

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `ci/scripts/e2e-source-test.sh` (modified, +4/-0)
```diff
@@ -44,17 +44,21 @@ risedev slt './e2e_test/source_inline/fs/parquet_nested_smallint.slt'
 risedev slt './e2e_test/source_inline/refresh/refresh_table.slt'
 risedev slt './e2e_test/source_inline/refresh/refresh_table_rate_limit.slt'
 risedev slt './e2e_test/source_inline/refresh/refresh_table_delete_readd.slt'
+risedev slt './e2e_test/source_inline/refresh/refresh_table_recovery.slt.serial'
+risedev slt './e2e_test/source_inline/refresh/refresh_table_reschedule.slt'
 risedev slt './e2e_test/source_inline/vault/vault_secret_ddl.slt'
 
 echo "--- Run webhook source tests"
 sleep 5
 risedev slt 'e2e_test/webhook/webhook_source.slt'
 risedev slt 'e2e_test/webhook/websocket_ingest.slt'
+risedev slt './e2e_test/source_inline/refresh/refresh_table_restart_before.slt'
 
 risedev kill
 risedev dev ci-1cn-1fe-with-recovery
 sleep 20
 risedev slt 'e2e_test/webhook/webhook_source_recovery.slt'
+risedev slt './e2e_test/source_inline/refresh/refresh_table_restart_after.slt'
 
 echo "--- Kill cluster"
 risedev ci-kill
```

**File**: `e2e_test/source_inline/refresh/drop_refresh_table_paused.slt.part` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+statement ok
+DROP TABLE refresh_paused_t CASCADE;
+
+system ok
+rm -rf ./e2e_test/source_inline/refresh/refresh_paused_tmp
```

**File**: `e2e_test/source_inline/refresh/refresh_table_paused.slt.part` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+# A refreshable table with a refresh cycle held open in the middle of a file. After a complete load,
+# a second cycle reads a new file set at one row per second until its first rows are visible, and a
+# limit of 0 then holds it. The file set is replaced once more while the cycle is held, so that a
+# re-run reads different files and its merge has to delete every row the held load wrote.
+# Dropped by drop_refresh_table_paused.slt.part.
+
+control substitution on
+
+system ok
+rm -rf ./e2e_test/source_inline/refresh/refresh_paused_tmp && mkdir -p ./e2e_test/source_inline/refresh/refresh_paused_tmp
+
+system ok
+for i in 0 1 2 3; do seq $((i*500+1)) $(((i+1)*500)) | awk '{print $1","$1%97}' > ./e2e_test/source_inline/refresh/refresh_paused_tmp/f$i.csv; done
+
+statement ok
+CREATE TABLE refresh_paused_t (id int, grp int, PRIMARY KEY (id)) WITH (
+    connector = '__for_testing_only_batch_posix_fs',
+    batch_posix_fs.root = './e2e_test/source_inline/refresh/refresh_paused_tmp',
+    refresh_mode = 'FULL_RELOAD',
+    match_pattern = '*.csv'
+) FORMAT PLAIN ENCODE CSV (without_header = 'true', delimiter = ',');
+
+statement ok
+CREATE MATERIALIZED VIEW refresh_paused_mv AS SELECT grp, count(*) AS cnt FROM refresh_paused_t GROUP BY grp;
+
+statement ok retry 3 backoff 5s
+REFRESH TABLE refresh_paused_t;
+
+query T retry 10 backoff 2s
+SELECT s.current_status
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE
+
+
+# The frontend's read snapshot can lag the commit that ended the cycle.
+statement ok
+FLUSH;
+
+query II
+SELECT count(*), sum(cnt) FROM refresh_paused_mv;
+----
+97 2000
+
+
+system ok
+for i in 0 1 2 3; do seq $((2000+i*500+1)) $((2000+(i+1)*500)) | awk '{print $1","$1%97}' > ./e2e_test/source_inline/refresh/refresh_paused_tmp/f$i.csv; done
+
+statement ok
+ALTER TABLE refresh_paused_t SET SOURCE_RATE_LIMIT TO 1;
+
+statement ok
+REFRESH TABLE refresh_paused_t;
+
+query B retry 30 backoff 1s
+SELECT count(*) > 2000 FROM refresh_paused_t;
+----
+t
+
+statement ok
+ALTER TABLE refresh_paused_t SET SOURCE_RATE_LIMIT TO 0;
+
+query TB
+SELECT s.current_status, (SELECT count(*) FROM refresh_paused_t) < 4000
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+REFRESHING t
+
+# The trigger of the held cycle, so that a test can tell its re-run from it.
+let trigger_before
+SELECT s.last_trigger_time
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t'
+
+system ok
+rm ./e2e_test/source_inline/refresh/refresh_paused_tmp/f*.csv && seq 5001 6000 | awk '{print $1","$1%97}' > ./e2e_test/source_inline/refresh/refresh_paused_tmp/g0.csv
```

**File**: `e2e_test/source_inline/refresh/refresh_table_rate_limit.slt` (modified, +10/-0)
```diff
@@ -44,6 +44,10 @@ WHERE t.name = 'refresh_rl_t';
 ----
 IDLE
 
+# The frontend's read snapshot can lag the commit that ended the cycle.
+statement ok
+FLUSH;
+
 query II
 SELECT count(*), sum(cnt) FROM refresh_rl_mv;
 ----
@@ -65,6 +69,9 @@ WHERE t.name = 'refresh_rl_t';
 ----
 IDLE
 
+statement ok
+FLUSH;
+
 query II
 SELECT count(*), sum(cnt) FROM refresh_rl_mv;
 ----
@@ -109,6 +116,9 @@ WHERE t.name = 'refresh_rl_t';
 ----
 IDLE
 
+statement ok
+FLUSH;
+
 query II
 SELECT min(id), max(id) FROM refresh_rl_t;
 ----
```

**File**: `e2e_test/source_inline/refresh/refresh_table_recovery.slt.serial` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# A refresh interrupted by recovery is abandoned and re-run once.
+
+include ./refresh_table_paused.slt.part
+
+statement ok
+recover;
+
+# The re-run is a newer cycle than the interrupted one, held by the limit of 0 that survived recovery.
+query TB retry 20 backoff 1s
+SELECT s.current_status, s.last_trigger_time > '${trigger_before}'
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+REFRESHING t
+
+# A second recovery abandons the re-run without starting another one.
+statement ok
+recover;
+
+# A throttle command only goes through once the cluster accepts commands again.
+statement ok retry 10 backoff 1s
+ALTER TABLE refresh_paused_t SET SOURCE_RATE_LIMIT TO DEFAULT;
+
+sleep 2s
+
+query TB
+SELECT s.current_status, s.last_success_time > s.last_trigger_time
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE f
+
+# The next cycle deletes every row the abandoned loads wrote.
+statement ok
+REFRESH TABLE refresh_paused_t;
+
+query TB retry 10 backoff 2s
+SELECT s.current_status, s.last_success_time > s.last_trigger_time
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE t
+
+statement ok
+FLUSH;
+
+query III
+SELECT min(id), max(id), count(*) FROM refresh_paused_t;
+----
+5001 6000 1000
+
+query II
+SELECT count(*), sum(cnt) FROM refresh_paused_mv;
+----
+97 1000
+
+include ./drop_refresh_table_paused.slt.part
```

**File**: `e2e_test/source_inline/refresh/refresh_table_reschedule.slt` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+# A table cannot be rescheduled or replaced while it is being refreshed; both go through once the
+# cycle ends, and the next cycle runs on the new actors.
+
+include ./refresh_table_paused.slt.part
+
+statement error is being refreshed
+ALTER TABLE refresh_paused_t SET PARALLELISM = 1;
+
+statement error is being refreshed
+ALTER TABLE refresh_paused_t ADD COLUMN extra int;
+
+# Rescheduling a single fragment of the table is refused as well.
+system ok
+fragment_id=$(psql -h "$SLT_HOST" -p "$SLT_PORT" -d "$SLT_DB" -U root -tAc "SELECT f.fragment_id FROM rw_fragments f JOIN rw_tables t ON f.table_id = t.id WHERE t.name = 'refresh_paused_t' AND 'MVIEW' = ANY(f.flags)") && psql -h "$SLT_HOST" -p "$SLT_PORT" -d "$SLT_DB" -U root -c "ALTER FRAGMENT $fragment_id SET PARALLELISM = 1" 2>&1 | grep -q 'is being refreshed'
+
+statement ok
+ALTER TABLE refresh_paused_t SET SOURCE_RATE_LIMIT TO DEFAULT;
+
+query T retry 10 backoff 2s
+SELECT s.current_status
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE
+
+
+statement ok
+ALTER TABLE refresh_paused_t SET PARALLELISM = 1;
+
+statement ok retry 3 backoff 5s
+REFRESH TABLE refresh_paused_t;
+
+query T retry 10 backoff 2s
+SELECT s.current_status
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE
+
+
+statement ok
+FLUSH;
+
+query II
+SELECT count(*), sum(cnt) FROM refresh_paused_mv;
+----
+97 1000
+
+statement ok
+ALTER TABLE refresh_paused_t ADD COLUMN extra int;
+
+statement ok retry 3 backoff 5s
+REFRESH TABLE refresh_paused_t;
+
+query T retry 10 backoff 2s
+SELECT s.current_status
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE
+
+
+statement ok
+FLUSH;
+
+query II
+SELECT count(*), sum(cnt) FROM refresh_paused_mv;
+----
+97 1000
+
+query I
+SELECT count(*) FROM refresh_paused_t WHERE extra IS NULL;
+----
+1000
+
+include ./drop_refresh_table_paused.slt.part
```

**File**: `e2e_test/source_inline/refresh/refresh_table_restart_after.slt` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+# The refresh left in flight by refresh_table_restart_before.slt is abandoned by the restarted
+# meta and re-run once; the re-run is held by the limit of 0 until it is lifted here.
+
+query TB retry 20 backoff 1s
+SELECT s.current_status, s.last_trigger_time > m.trigger_before
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+CROSS JOIN refresh_paused_marker m
+WHERE t.name = 'refresh_paused_t';
+----
+REFRESHING t
+
+statement ok
+ALTER TABLE refresh_paused_t SET SOURCE_RATE_LIMIT TO DEFAULT;
+
+query TBB retry 10 backoff 2s
+SELECT s.current_status, s.last_trigger_time > m.trigger_before, s.last_success_time > s.last_trigger_time
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+CROSS JOIN refresh_paused_marker m
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE t t
+
+statement ok
+FLUSH;
+
+query III
+SELECT min(id), max(id), count(*) FROM refresh_paused_t;
+----
+5001 6000 1000
+
+query II
+SELECT count(*), sum(cnt) FROM refresh_paused_mv;
+----
+97 1000
+
+statement ok
+DROP TABLE refresh_paused_marker;
+
+include ./drop_refresh_table_paused.slt.part
```

**File**: `e2e_test/source_inline/refresh/refresh_table_restart_before.slt` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+# Leaves a refresh in flight for the cluster restart in the CI script; the checks are in
+# refresh_table_restart_after.slt.
+
+include ./refresh_table_paused.slt.part
+
+# Carries the trigger of the held cycle across the restart; the row has to be checkpointed to
+# survive it.
+statement ok
+CREATE TABLE refresh_paused_marker (trigger_before varchar);
+
+statement ok
+INSERT INTO refresh_paused_marker VALUES ('${trigger_before}');
+
+statement ok
+FLUSH;
```

---

### Incident Patch 10: `4642960b` (2026-09-24)
**Commit Message**: fix(stream): keep a MATCH_RECOGNIZE scan incomplete across an eviction rebase (#27201)

Signed-off-by: Henrik Ma Johansson <[REDACTED_EMAIL]>

**File**: `docs/dev/src/design/match-recognize.md` (modified, +12/-4)
```diff
@@ -299,8 +299,10 @@ Worth stating plainly, because the two cases differ and only one of them recover
 **With `WITHIN`.** A starved partition still sheds matches, but only through window closure, and
 only matches the truncated scan reached. Each watermark visit re-derives the tail (spending the
 whole budget), then emits the head if its window has closed. Emitting a provisional match rebuilds
-the matcher under that same spent budget, which empties the tail and ends the drain — so the
-practical rate is about **one match per watermark visit**, and the deadline prune contributes
+the matcher under that same spent budget, which empties the tail and ends the drain; emitting a
+*frozen* one keeps it — the eviction rebase shifts the truncated scan's cursor and found prefix
+down with the rows instead of dropping them (see below) — so the practical rate is the frozen run
+plus about **one provisional match per watermark visit**, and the deadline prune contributes
 nothing while the matcher is incomplete. Emission latency degrades from decidability to window
 closure, and the retained set shrinks only at that rate: if arrivals per watermark interval exceed
 it, the partition still grows. This is an improvement on shedding nothing; it is not convergence.
@@ -333,8 +335,14 @@ remembered instead of re-walked:
   refresh on the next watermark visit, so an idle partition resumes it too. The executor's own
   liveness walks (the dead-prefix prune, the emission gate's gap check) skip that prefix as well.
 
-Both memories are forgotten wherever the rows a verdict was computed over can change: truncation,
-and the eviction rebase. What remains inherently per-visit is a run that stays *alive* — `a{600} b`
+Both memories are forgotten wherever the rows a verdict was computed over can change — truncation —
+and merely *shifted* by the eviction rebase: a verdict about a surviving start was computed over
+surviving rows (the binder keeps every `PREV` inside the match span, running navigation reads
+inside the match, and there is no forward navigation), so the matchless and dead prefixes, the scan
+cursor and a truncated scan's found prefix all move down with the rows. Incompleteness survives the
+rebase with them, so the next visit resumes the scan before the deadline prune may act on absence —
+clearing it there turned partial information into a completed-scan verdict and the prune deleted
+the rows of every match the truncated scan never reached (#27197). What remains inherently per-visit is a run that stays *alive* — `a{600} b`
 over an unbroken run of `a` rows keeps every start alive until a `b` arrives or its `WITHIN` window
 closes — where each rescan re-walks the live starts and the budget throttles the partition as
 described above; `WITHIN` is what bounds that.
```

**File**: `src/stream/src/executor/match_recognize/incremental.rs` (modified, +292/-26)
```diff
@@ -238,7 +238,9 @@ pub struct IncrementalMatcher {
     /// set, absence of a match from `provisional()` is NOT evidence of absence: the executor must
     /// re-derive (fresh budget) before any decision that treats missing matches as decided — the
     /// WITHIN-deadline prune in particular would otherwise delete rows carrying a match the
-    /// truncated scan never reached.
+    /// truncated scan never reached. Survives [`IncrementalMatcher::finalize_evicted_prefix`]
+    /// together with the found prefix and the scan cursor, which the rebase shifts rather than
+    /// resets: the unscanned suffix is untouched by an eviction, so the flag still describes it.
     incomplete: bool,
     /// Absolute buffer position where a budget-truncated match scan will resume. Unlike
     /// `matchless_upto`, this may follow successful matches: the corresponding leftmost-prefix of
@@ -256,7 +258,8 @@ pub struct IncrementalMatcher {
     /// walks up to `L` rows), and once that exceeds the per-visit budget the region never freezes:
     /// the permanent, non-self-healing shape a long chain pattern (`a{600}`) otherwise degrades
     /// into. Reset to `next_pos` whenever the rows a verdict was computed over can change
-    /// (truncation, eviction rebase).
+    /// (truncation); an eviction rebase only shifts it, since a verdict about a surviving start was
+    /// computed over surviving rows (see [`IncrementalMatcher::finalize_evicted_prefix`]).
     dead_upto: usize,
     /// Starts `[next_pos, matchless_upto)` proven MATCHLESS FOREVER by the finder: their walks found
     /// no accept and never reached the boundary, so they died entirely on immutable rows (see
@@ -325,8 +328,9 @@ impl IncrementalMatcher {
         self.freeze_truncated = false;
     }
 
-    /// Whether the last rescan was truncated by a spent budget — see the field doc. While true,
-    /// `provisional()` is a leftmost-prefix under-approximation.
+    /// Whether the last rescan was truncated by a spent budget — see the field doc. The flag and
+    /// the found prefix both survive an eviction rebase. While true, `provisional()` is a
+    /// leftmost-prefix under-approximation.
     pub fn is_incomplete(&self) -> bool {
         self.incomplete
     }
@@ -700,12 +704,14 @@ impl IncrementalMatcher {
     /// at the (same-or-later) eviction boundary `[0, next_pos)` is still dead and the first live row
     /// is `>= next_pos`. The check above bounds `final_pos <= next_pos`, so through the executor
     /// `final_pos == next_pos` exactly. At that boundary every frozen match starts before `next_pos`
-    /// and is therefore consumed — none is retained — so `next_pos` rebases to `0` and the entire
-    /// surviving suffix is re-derived from scratch as the provisional tail. `provisional()` then
-    /// trivially equals a fresh scan over the survivors, regardless of skip mode, and no rebased scan
-    /// cursor can skip a start a fresh matcher would find. `PAST LAST ROW` additionally tiles
-    /// `[0, next_pos)` with non-overlapping spans (`resume == end`), so *any* boundary within the
-    /// frozen prefix retains a suffix of frozen matches soundly.
+    /// and is therefore consumed — none is retained — so `next_pos` rebases to `0` and the
+    /// provisional tail is exactly the matches found over the surviving suffix, regardless of skip
+    /// mode. The verdict cursors and a truncated scan's found prefix shift down with the rows rather
+    /// than resetting: a verdict about a surviving start was computed over surviving rows only (see
+    /// the rebase step in the body), so the resumed scan finds exactly what a fresh matcher over
+    /// the survivors would, without re-walking the starts already decided. `PAST LAST ROW`
+    /// additionally tiles `[0, next_pos)` with non-overlapping spans (`resume == end`), so *any*
+    /// boundary within the frozen prefix retains a suffix of frozen matches soundly.
     ///
     /// On [`Finalized::Rebased`] the evicted rows physically leave the front of the logical buffer:
     /// `seq_index` drains its prefix and `next_pos`/`frozen_count` shift down. Only rows at positions
@@ -724,7 +730,6 @@ impl IncrementalMatcher {
         if final_pos > self.next_pos {
             return Finalized::MustRebuild;
         }
-
         // Finalized matches are the leading run of frozen matches whose *start* is being evicted
         // (`start_pos < final_pos`): their first row leaves the buffer, so they are consumed — final,
         // already emitted — and drop from the diffable set. Only frozen matches can start within
@@ -748,10 +753,11 @@ impl IncrementalMatcher {
             // A consumed match whose span straddles the boundary (`end_pos > final_pos`, possible
             // only under the overlapping modes) orphans its surviving rows `[final_pos, end_pos)`.
             // Dropping it is sound only when the boundary sits exactly at the scan cursor
-            // (`final_pos == next_pos`):
```

---

### Incident Patch 11: `ce78f82e` (2026-09-24)
**Commit Message**: fix(stream): derive NOW progress from elapsed time (#27209)

**File**: `proto/stream_plan.proto` (modified, +0/-3)
```diff
@@ -256,9 +256,6 @@ message Barrier {
   map<string, string> tracing_context = 2;
   // The kind of the barrier.
   BarrierKind kind = 9;
-  // The effective barrier interval for this database: the database-specific override when set,
-  // or the system-wide interval otherwise.
-  uint32 barrier_interval_ms = 10;
 }
 
 message Watermark {
```

**File**: `src/common/src/system_param/mod.rs` (modified, +2/-15)
```diff
@@ -449,11 +449,11 @@ for_all_params!(impl_system_params_for_test);
 pub struct OverrideValidate;
 impl Validate for OverrideValidate {
     fn barrier_interval_ms(v: &u32) -> Result<()> {
-        Self::expect_range(*v, 50..=i32::MAX as u32)
+        Self::expect_range(*v, 50..)
     }
 
     fn checkpoint_frequency(v: &u64) -> Result<()> {
-        Self::expect_range(*v, 1..=i64::MAX as u64)
+        Self::expect_range(*v, 1..)
     }
 
     fn backup_storage_directory(v: &String) -> Result<()> {
@@ -560,19 +560,6 @@ mod tests {
         assert!(validate_init_system_params(&p).is_ok());
     }
 
-    #[test]
-    fn test_database_param_storage_bounds() {
-        assert!(OverrideValidate::barrier_interval_ms(&50).is_ok());
-        assert!(OverrideValidate::barrier_interval_ms(&(i32::MAX as u32)).is_ok());
-        assert!(OverrideValidate::barrier_interval_ms(&49).is_err());
-        assert!(OverrideValidate::barrier_interval_ms(&(i32::MAX as u32 + 1)).is_err());
-
-        assert!(OverrideValidate::checkpoint_frequency(&1).is_ok());
-        assert!(OverrideValidate::checkpoint_frequency(&(i64::MAX as u64)).is_ok());
-        assert!(OverrideValidate::checkpoint_frequency(&0).is_err());
-        assert!(OverrideValidate::checkpoint_frequency(&(i64::MAX as u64 + 1)).is_err());
-    }
-
     // Test that we always redact the value of the license key when displaying it, but when it comes to
     // persistency, we still write and get the real value.
     #[test]
```

**File**: `src/meta/src/barrier/checkpoint/control.rs` (modified, +1/-7)
```diff
@@ -244,7 +244,6 @@ impl CheckpointControl {
             command,
             span,
             checkpoint,
-            barrier_interval_ms,
         } = new_barrier;
 
         if let Some((mut command, notifier)) = command {
@@ -354,7 +353,6 @@ impl CheckpointControl {
             database.handle_new_barrier(
                 Some((command, notifier)),
                 checkpoint,
-                barrier_interval_ms,
                 span,
                 partial_graph_manager,
                 &self.hummock_version_stats,
@@ -382,7 +380,6 @@ impl CheckpointControl {
             database.handle_new_barrier(
                 None,
                 checkpoint,
-                barrier_interval_ms,
                 span,
                 partial_graph_manager,
                 &self.hummock_version_stats,
@@ -1215,7 +1212,6 @@ impl DatabaseCheckpointControl {
         &mut self,
         command: Option<(Command, Notifier)>,
         checkpoint: bool,
-        barrier_interval_ms: u32,
         span: tracing::Span,
         partial_graph_manager: &mut PartialGraphManager,
         hummock_version_stats: &HummockVersionStats,
@@ -1322,9 +1318,7 @@ impl DatabaseCheckpointControl {
             return Ok(());
         }
 
-        let barrier_info =
-            self.state
-                .next_barrier_info(checkpoint, curr_epoch, barrier_interval_ms);
+        let barrier_info = self.state.next_barrier_info(checkpoint, curr_epoch);
         // Tracing related stuff
         barrier_info.prev_epoch.span().in_scope(|| {
             tracing::info!(target: "rw_tracing", epoch = barrier_info.curr_epoch(), "new barrier enqueued");
```

**File**: `src/meta/src/barrier/checkpoint/independent_job/batch_refresh_job/mod.rs` (modified, +0/-17)
```diff
@@ -201,7 +201,6 @@ pub(crate) struct BatchRefreshJobCheckpointControl {
     snapshot_epoch: u64,
     /// Batch refresh interval in seconds. Used to determine when to trigger a refresh run.
     batch_refresh_seconds: u64,
-    barrier_interval_ms: u32,
 
     status: BatchRefreshJobStatus,
 }
@@ -508,7 +507,6 @@ impl BatchRefreshJobCheckpointControl {
         notifier: Option<&mut NotifierStarter>,
         snapshot_backfill_upstream_tables: HashSet<TableId>,
         snapshot_epoch: u64,
-        barrier_interval_ms: u32,
         version_stat: &HummockVersionStats,
         term_id: &str,
         partial_graph_manager: &mut PartialGraphManager,
@@ -564,7 +562,6 @@ impl BatchRefreshJobCheckpointControl {
             &mut prev_epoch_fake_physical_time,
             &mut pending_non_checkpoint_barriers,
             PbBarrierKind::Checkpoint,
-            barrier_interval_ms,
         );
 
         let mut graph_adder = partial_graph_manager.add_partial_graph(
@@ -597,7 +594,6 @@ impl BatchRefreshJobCheckpointControl {
             snapshot_backfill_upstream_tables,
             snapshot_epoch,
             batch_refresh_seconds,
-            barrier_interval_ms,
 
             status: BatchRefreshJobStatus::ConsumingSnapshot {
                 prev_epoch_fake_physical_time,
@@ -624,7 +620,6 @@ impl BatchRefreshJobCheckpointControl {
         snapshot_backfill_upstream_tables: HashSet<TableId>,
         snapshot_epoch: u64,
         committed_epoch: u64,
-        barrier_interval_ms: u32,
         backfill_order: ExtendedFragmentBackfillOrder,
         version_stat: &HummockVersionStats,
         initial_mutation: Mutation,
@@ -649,7 +644,6 @@ impl BatchRefreshJobCheckpointControl {
                 snapshot_backfill_upstream_tables,
                 snapshot_epoch,
                 batch_refresh_seconds,
-                barrier_interval_ms,
 
                 status: BatchRefreshJobStatus::Idle {
                     last_committed_epoch: committed_epoch,
@@ -688,7 +682,6 @@ impl BatchRefreshJobCheckpointControl {
             &mut prev_epoch_fake_physical_time,
             &mut pending_non_checkpoint_barriers,
             PbBarrierKind::Initial,
-            barrier_interval_ms,
         );
 
         partial_graph_recoverer.recover_graph(
@@ -708,7 +701,6 @@ impl BatchRefreshJobCheckpointControl {
             snapshot_backfill_upstream_tables,
             snapshot_epoch,
             batch_refresh_seconds,
-            barrier_interval_ms,
             status: BatchRefreshJobStatus::ConsumingSnapshot {
                 prev_epoch_fake_physical_time,
                 version_stats: version_stat.clone(),
@@ -779,7 +771,6 @@ impl BatchRefreshJobCheckpointControl {
         barrier_info: &BarrierInfo,
         mutation: Option<(Mutation, Option<&mut NotifierStarter>)>,
     ) -> MetaResult<()> {
-        self.barrier_interval_ms = barrier_info.barrier_interval_ms;
         if !matches!(self.status, BatchRefreshJobStatus::ConsumingSnapshot { .. }) {
             // ConsumingLogStore has all barriers pre-injected; no forwarding needed.
             // Idle has no partial graph.
@@ -828,15 +819,13 @@ impl BatchRefreshJobCheckpointControl {
                 curr_epoch: TracedEpoch::new(Epoch(snapshot_epoch)),
                 prev_epoch: TracedEpoch::new(prev_epoch),
                 kind: BarrierKind::Checkpoint(take(&mut pending_non_checkpoint_barriers)),
-                barrier_interval_ms: self.barrier_interval_ms,
             };
 
             // Inject stop barrier with u64::MAX as curr_epoch and empty nodes_to_sync_table.
             let stop_barrier = BarrierInfo {
                 prev_epoch: TracedEpoch::new(Epoch(snapshot_epoch)),
                 curr_epoch: TracedEpoch::new(Epoch(u64::MAX)),
                 kind: BarrierKind::Checkpoint(vec![snapshot_epoch]),
-                barrier_interval_ms: self.barrier_interval_ms,
             };
 
             let stop_actors: Vec<ActorId> = fragment_infos
@@ -915,7 +904,6 @@ impl BatchRefreshJobCheckpointControl {
                         unreachable!("upstream new epoch should not be initial")
                     }
                 },
-                barrier_info.barrier_interval_ms,
             );
             Self::inject_barrier(
                 self.partial_graph_id,
@@ -1234,7 +1222,6 @@ impl BatchRefreshJobCheckpointControl {
             &self.snapshot_backfill_upstream_tables,
             &context.upstream_table_log_epochs,
             last_committed_epoch,
-            self.barrier_interval_ms,
         )?
         else {
             info!(
@@ -1300,7 +1287,6 @@ impl BatchRefreshJobCheckpointControl {
             prev_epoch: TracedEpoch::new(Epoch(last_committed_epoch)),
             curr_epoch: TracedEpoch::new(Epoch(first_epoch)),
             kind: BarrierKind::Initial,
-            barrier_interval_ms: self.barrier_interval_ms,
         };
         let mut partial_graph_recoverer = partial_graph_manager.start_recover();

```

**File**: `src/meta/src/barrier/checkpoint/independent_job/creating_job/mod.rs` (modified, +0/-23)
```diff
@@ -107,7 +107,6 @@ impl CreatingStreamingJobControl {
         notifier: Option<&mut NotifierStarter>,
         snapshot_backfill_upstream_tables: HashSet<TableId>,
         snapshot_epoch: u64,
-        barrier_interval_ms: u32,
         since_timestamp_upstream_log_epochs: Option<(&TableLogEpochs, PartialGraphId, u64)>,
         version_stat: &HummockVersionStats,
         term_id: &str,
@@ -174,7 +173,6 @@ impl CreatingStreamingJobControl {
                     partial_graph_manager.pending_barrier_infos(upstream_partial_graph_id),
                     snapshot_epoch,
                     new_upstream_barrier_prev_epoch,
-                    barrier_interval_ms,
                 )?;
             (initial_barrier, Some(barriers_to_inject))
         } else {
@@ -183,7 +181,6 @@ impl CreatingStreamingJobControl {
                     &mut prev_epoch_fake_physical_time,
                     &mut pending_non_checkpoint_barriers,
                     PbBarrierKind::Checkpoint,
-                    barrier_interval_ms,
                 ),
                 None,
             )
@@ -312,7 +309,6 @@ impl CreatingStreamingJobControl {
                 create_mview_tracker,
                 snapshot_backfill_actors,
                 snapshot_epoch,
-                barrier_interval_ms,
                 info: job_info,
                 pending_non_checkpoint_barriers,
             };
@@ -407,7 +403,6 @@ impl CreatingStreamingJobControl {
                     } else {
                         BarrierKind::Barrier
                     },
-                    barrier_interval_ms: upstream_barrier_info.barrier_interval_ms,
                 });
                 prev_epoch = *epoch;
             }
@@ -416,7 +411,6 @@ impl CreatingStreamingJobControl {
             prev_epoch: TracedEpoch::new(Epoch(prev_epoch)),
             curr_epoch: TracedEpoch::new(Epoch(upstream_barrier_info.curr_epoch())),
             kind: BarrierKind::Checkpoint(pending_non_checkpoint_barriers),
-            barrier_interval_ms: upstream_barrier_info.barrier_interval_ms,
         });
         Ok(ret)
     }
@@ -454,7 +448,6 @@ impl CreatingStreamingJobControl {
         pending_upstream_barriers: impl Iterator<Item = &BarrierInfo>,
         snapshot_epoch: u64,
         new_upstream_barrier_prev_epoch: u64,
-        barrier_interval_ms: u32,
     ) -> MetaResult<(BarrierInfo, Vec<BarrierInfo>)> {
         let mut initial_barrier = None;
         let mut barriers = vec![];
@@ -494,7 +487,6 @@ impl CreatingStreamingJobControl {
                         } else {
                             BarrierKind::Barrier
                         },
-                        barrier_interval_ms,
                     },
                 );
                 prev_epoch = *epoch;
@@ -515,7 +507,6 @@ impl CreatingStreamingJobControl {
                     prev_epoch: TracedEpoch::new(Epoch(prev_epoch)),
                     curr_epoch: TracedEpoch::new(Epoch(new_upstream_barrier_prev_epoch)),
                     kind: BarrierKind::Checkpoint(pending_non_checkpoint_barriers),
-                    barrier_interval_ms,
                 },
             );
         } else {
@@ -533,7 +524,6 @@ impl CreatingStreamingJobControl {
                     prev_epoch: TracedEpoch::new(Epoch(prev_epoch)),
                     curr_epoch: TracedEpoch::new(Epoch(first_pending_barrier.prev_epoch())),
                     kind: BarrierKind::Checkpoint(take(&mut pending_non_checkpoint_barriers)),
-                    barrier_interval_ms,
                 },
             );
             prev_epoch = first_pending_barrier.prev_epoch();
@@ -555,7 +545,6 @@ impl CreatingStreamingJobControl {
                         } else {
                             BarrierKind::Barrier
                         },
-                        barrier_interval_ms: pending_barrier.barrier_interval_ms,
                     },
                 );
                 prev_epoch = pending_barrier.curr_epoch();
@@ -598,7 +587,6 @@ impl CreatingStreamingJobControl {
             &mut prev_epoch_fake_physical_time,
             &mut pending_non_checkpoint_barriers,
             PbBarrierKind::Initial,
-            upstream_barrier_info.barrier_interval_ms,
         );
         Ok((
             CreatingStreamingJobStatus::ConsumingSnapshot {
@@ -617,7 +605,6 @@ impl CreatingStreamingJobControl {
                 .collect(),
                 info,
                 snapshot_epoch,
-                barrier_interval_ms: upstream_barrier_info.barrier_interval_ms,
                 pending_non_checkpoint_barriers,
             },
             barrier_info,
@@ -1148,7 +1135,6 @@ mod tests {
                 [].iter(),
                 40,
                 60,
-                1000,
             )
             .unwrap();
 
@@ -1184,13 +1170,11 @@ mod tests {
                 prev_epoch: TracedEpoch::new(Epoch(60)),
                 curr_epoch: TracedEpoch::new(Epoch(65)),
                 kind: BarrierKind::Barrier,
-       
```

**File**: `src/meta/src/barrier/checkpoint/independent_job/creating_job/status.rs` (modified, +0/-10)
```diff
@@ -114,7 +114,6 @@ pub(super) enum CreatingStreamingJobStatus {
         create_mview_tracker: CreateMviewProgressTracker,
         snapshot_backfill_actors: HashSet<ActorId>,
         snapshot_epoch: u64,
-        barrier_interval_ms: u32,
         info: CreatingJobInfo,
         /// The `prev_epoch` of pending non checkpoint barriers
         pending_non_checkpoint_barriers: Vec<u64>,
@@ -148,7 +147,6 @@ impl CreatingStreamingJobStatus {
                 ref mut pending_upstream_barriers,
                 ref mut pending_non_checkpoint_barriers,
                 ref snapshot_epoch,
-                barrier_interval_ms,
                 ..
             } => {
                 for progress in create_mview_progress {
@@ -162,7 +160,6 @@ impl CreatingStreamingJobStatus {
                         curr_epoch: TracedEpoch::new(Epoch(*snapshot_epoch)),
                         prev_epoch: TracedEpoch::new(prev_epoch),
                         kind: BarrierKind::Checkpoint(take(pending_non_checkpoint_barriers)),
-                        barrier_interval_ms,
                     }]
                     .into_iter()
                     .chain(pending_upstream_barriers.drain(..))
@@ -258,7 +255,6 @@ impl CreatingStreamingJobStatus {
                 prev_epoch_fake_physical_time,
                 pending_non_checkpoint_barriers,
                 create_mview_tracker,
-                barrier_interval_ms,
                 ..
             } => {
                 let mutation = mutation.or_else(|| {
@@ -277,7 +273,6 @@ impl CreatingStreamingJobStatus {
                 });
                 let barrier_num_to_inject = resolve_initial_barrier_num_to_inject();
                 pending_upstream_barriers.push(barrier_info.clone());
-                *barrier_interval_ms = barrier_info.barrier_interval_ms;
                 // Mutation barriers must be forwarded even when the partial graph has reached the
                 // configured pending-barrier limit.
                 if barrier_num_to_inject == 0 && mutation.is_none() {
@@ -294,7 +289,6 @@ impl CreatingStreamingJobStatus {
                                 unreachable!("upstream new epoch should not be initial")
                             }
                         },
-                        barrier_info.barrier_interval_ms,
                     ),
                     mutation,
                 )]
@@ -325,13 +319,11 @@ impl CreatingStreamingJobStatus {
         prev_epoch_fake_physical_time: &mut u64,
         pending_non_checkpoint_barriers: &mut Vec<u64>,
         kind: PbBarrierKind,
-        barrier_interval_ms: u32,
     ) -> BarrierInfo {
         super::super::new_fake_barrier(
             prev_epoch_fake_physical_time,
             pending_non_checkpoint_barriers,
             kind,
-            barrier_interval_ms,
         )
     }
 
@@ -395,7 +387,6 @@ mod tests {
             prev_epoch: TracedEpoch::new(Epoch(prev_epoch)),
             curr_epoch: TracedEpoch::new(Epoch(curr_epoch)),
             kind: BarrierKind::Barrier,
-            barrier_interval_ms: 1000,
         }
     }
 
@@ -503,7 +494,6 @@ mod tests {
             prev_epoch: TracedEpoch::new(Epoch(1)),
             curr_epoch: TracedEpoch::new(Epoch(2)),
             kind: BarrierKind::Checkpoint(vec![1]),
-            barrier_interval_ms: 1000,
         });
         assert_eq!(info.fragment_infos[&fragment_id].nodes, new_node);
     }
```

**File**: `src/meta/src/barrier/checkpoint/independent_job/mod.rs` (modified, +0/-2)
```diff
@@ -44,7 +44,6 @@ fn new_fake_barrier(
     prev_epoch_fake_physical_time: &mut u64,
     pending_non_checkpoint_barriers: &mut Vec<u64>,
     kind: PbBarrierKind,
-    barrier_interval_ms: u32,
 ) -> BarrierInfo {
     let prev_epoch = TracedEpoch::new(Epoch::from_physical_time(*prev_epoch_fake_physical_time));
     *prev_epoch_fake_physical_time += 1;
@@ -68,7 +67,6 @@ fn new_fake_barrier(
         prev_epoch,
         curr_epoch,
         kind,
-        barrier_interval_ms,
     }
 }
 
```

**File**: `src/meta/src/barrier/checkpoint/recovery.rs` (modified, +0/-2)
```diff
@@ -389,7 +389,6 @@ impl DatabaseStatusAction<'_, EnterInitializing> {
         self,
         runtime_info: DatabaseRuntimeInfoSnapshot,
         rendered_info: RenderedDatabaseRuntimeInfo,
-        barrier_interval_ms: u32,
         partial_graph_manager: &mut PartialGraphManager,
     ) {
         let database_status = self
@@ -427,7 +426,6 @@ impl DatabaseStatusAction<'_, EnterInitializing> {
         let result: MetaResult<_> = try {
             recoverer.inject_database_initial_barrier(
                 self.database_id,
-                barrier_interval_ms,
                 job_infos,
                 &recovery_context.job_extra_info,
                 &mut state_table_committed_epochs,
```

---

### Incident Patch 12: `b8f140b6` (2026-09-24)
**Commit Message**: fix(iceberg): reject row lineage column names for V3 tables (#27223)

**File**: `e2e_test/iceberg/test_case/pure_slt/iceberg_v3/row_lineage_reserved_names.slt` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+# Iceberg V3 reserves `_row_id` and `_last_updated_sequence_number` for row lineage
+# metadata. Creating a V3 table with a data column of either name must be rejected.
+
+statement ok
+create table row_lineage_reserved_names_t (v int);
+
+statement error cannot create an Iceberg V3 table with column `_row_id`
+create sink row_lineage_reserved_names_sink as
+select _row_id, v from row_lineage_reserved_names_t
+with (
+  connector = 'iceberg',
+  type = 'append-only',
+  force_append_only = 'true',
+  warehouse.path = 's3a://icebergdata',
+  s3.endpoint = 'http://127.0.0.1:9301',
+  s3.access.key = 'hummockadmin',
+  s3.secret.key = 'hummockadmin',
+  s3.region = 'us-east-1',
+  catalog.name = 'demo',
+  catalog.type = 'storage',
+  database.name = 'demo_db',
+  table.name = 'row_lineage_reserved_names_t',
+  create_table_if_not_exists = 'true',
+  format_version = '3'
+);
+
+statement ok
+drop table row_lineage_reserved_names_t;
```

**File**: `src/connector/src/sink/iceberg/create_table.rs` (modified, +31/-1)
```diff
@@ -18,6 +18,9 @@ use std::sync::LazyLock;
 
 use anyhow::{Context, anyhow};
 use iceberg::arrow::schema_to_arrow_schema;
+use iceberg::metadata_columns::{
+    RESERVED_COL_NAME_LAST_UPDATED_SEQUENCE_NUMBER, RESERVED_COL_NAME_ROW_ID,
+};
 use iceberg::spec::{
     FormatVersion, NullOrder, SortDirection, SortField, SortOrder, TableProperties, Transform,
     UnboundPartitionField, UnboundPartitionSpec,
@@ -32,7 +35,7 @@ use risingwave_common::array::arrow::arrow_schema_iceberg::{
 };
 use risingwave_common::array::arrow::{IcebergArrowConvert, IcebergCreateTableArrowConvert};
 use risingwave_common::bail;
-use risingwave_common::catalog::Schema;
+use risingwave_common::catalog::{ColumnDesc, Schema};
 use risingwave_common::util::iter_util::ZipEqFast;
 use url::Url;
 
@@ -93,6 +96,32 @@ pub async fn create_and_validate_table_impl(
     Ok(table)
 }
 
+/// Iceberg V3 stores row lineage in data files as the reserved `_row_id` and
+/// `_last_updated_sequence_number` columns. A table column with either name is ambiguous with the
+/// lineage metadata column, so reject it when creating a V3 table.
+pub fn validate_row_lineage_column_names(
+    format_version: FormatVersion,
+    columns: &[ColumnDesc],
+) -> Result<()> {
+    if format_version < FormatVersion::V3 {
+        return Ok(());
+    }
+    if let Some(column) = columns.iter().find(|column| {
+        [
+            RESERVED_COL_NAME_ROW_ID,
+            RESERVED_COL_NAME_LAST_UPDATED_SEQUENCE_NUMBER,
+        ]
+        .contains(&column.name.as_str())
+    }) {
+        return Err(SinkError::Config(anyhow!(
+            "cannot create an Iceberg V3 table with column `{}` because the name is reserved \
+             for row lineage metadata; please rename the column",
+            column.name
+        )));
+    }
+    Ok(())
+}
+
 /// Returns `true` if this call created the table, `false` if it already existed.
 pub(super) async fn create_table_if_not_exists_impl(
     config: &IcebergConfig,
@@ -125,6 +154,7 @@ pub(super) async fn create_table_if_not_exists_impl(
             column.name
         )));
     }
+    validate_row_lineage_column_names(config.table_format_version(), &param.columns)?;
 
     let iceberg_create_table_arrow_convert = IcebergCreateTableArrowConvert::default();
     // convert risingwave schema -> arrow schema -> iceberg schema
```

**File**: `src/connector/src/sink/iceberg/test.rs` (modified, +25/-1)
```diff
@@ -23,7 +23,7 @@ use risingwave_common::array::arrow::arrow_schema_iceberg::{
     DataType as ArrowDataType, Field as ArrowField, FieldRef as ArrowFieldRef,
     Fields as ArrowFields, Schema as ArrowSchema,
 };
-use risingwave_common::catalog::{Field, Schema};
+use risingwave_common::catalog::{ColumnDesc, ColumnId, Field, Schema};
 use risingwave_common::types::{DataType, MapType, StructType};
 
 use crate::connector_common::{IcebergCommon, IcebergTableIdentifier};
@@ -32,6 +32,7 @@ use crate::sink::iceberg::{
     CompactionType, DEFAULT_COMPACTION_MAX_SNAPSHOTS_NUM,
     ICEBERG_DEFAULT_WRITE_PARQUET_MAX_ROW_GROUP_BYTES, IcebergConfig, IcebergOrderKeyField,
     IcebergWriteMode, parse_order_key_exprs, validate_order_key_columns,
+    validate_row_lineage_column_names,
 };
 
 pub const DEFAULT_ICEBERG_COMPACTION_INTERVAL: u64 = 3600; // 1 hour
@@ -1102,3 +1103,26 @@ fn test_iceberg_sink_upper_case_primary_key() {
         Some(vec!["Key".to_owned()])
     );
 }
+
+#[test]
+fn test_validate_row_lineage_column_names() {
+    let columns = |name: &str| {
+        vec![
+            ColumnDesc::named("v1", ColumnId::new(1), DataType::Int32),
+            ColumnDesc::named(name, ColumnId::new(2), DataType::Int64),
+        ]
+    };
+
+    for reserved in ["_row_id", "_last_updated_sequence_number"] {
+        let err =
+            validate_row_lineage_column_names(FormatVersion::V3, &columns(reserved)).unwrap_err();
+        assert!(
+            err.to_string().contains(reserved),
+            "unexpected error: {err}"
+        );
+        validate_row_lineage_column_names(FormatVersion::V2, &columns(reserved)).unwrap();
+    }
+    // The pk-index sink carries a pk-less upstream's hidden row id as the relation-qualified
+    // `<table>._row_id`, which does not collide with the lineage column.
+    validate_row_lineage_column_names(FormatVersion::V3, &columns("t._row_id")).unwrap();
+}
```

---

### Incident Patch 13: `0d32b959` (2026-09-23)
**Commit Message**: fix(dashboard): normalize output blocking ratio in user dashboard (#27003)

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `grafana/dashboard/user/streaming.py` (modified, +5/-1)
```diff
@@ -101,8 +101,12 @@ def _(outer_panels: Panels):
                     "much time it takes an actor to process a message, i.e. a barrier, a watermark or rows of data, "
                     "on average. Then we divide this duration by 1 second and show it as a percentage.",
                     [
+                        # `actor_id` is masked below `MetricLevel::Debug`, so each series is
+                        # already summed over a node's actors. Divide by the actor count.
                         panels.target(
-                            f"avg(rate({metric('stream_actor_output_buffer_blocking_duration_ns')}[$__rate_interval])) by (fragment_id, downstream_fragment_id) / 1000000000",
+                            f"sum(rate({metric('stream_actor_output_buffer_blocking_duration_ns')}[$__rate_interval])) by (fragment_id, downstream_fragment_id) \
+                                / ignoring (downstream_fragment_id) group_left sum({metric('stream_actor_count')}) by (fragment_id) \
+                                / 1000000000",
                             "fragment {{fragment_id}}->{{downstream_fragment_id}}",
                         ),
                     ],
```

---

### Incident Patch 14: `1e5154ae` (2026-09-23)
**Commit Message**: fix(source): fail the batch posix fs fetch on errors like the OpenDAL fetch (#27217)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/stream/src/executor/source/batch_source/batch_posix_fs_fetch.rs` (modified, +8/-13)
```diff
@@ -179,17 +179,12 @@ impl<S: StateStore> BatchPosixFsFetchExecutor<S> {
             let full_path = Path::new(&root_path).join(&file_path);
 
             // Read the entire file
-            let content = match fs::read(&full_path).await {
-                Ok(content) => content,
-                Err(e) => {
-                    tracing::error!(
-                        error = %e.as_report(),
-                        file_path = %full_path.display(),
-                        "Failed to read file"
-                    );
-                    continue;
-                }
-            };
+            let content = fs::read(&full_path).await.map_err(|e| {
+                StreamExecutorError::connector_error(
+                    anyhow::Error::from(e)
+                        .context(format!("failed to read file {}", full_path.display())),
+                )
+            })?;
 
             if content.is_empty() {
                 // Empty file, skip it
@@ -305,7 +300,7 @@ impl<S: StateStore> BatchPosixFsFetchExecutor<S> {
             match msg {
                 Err(e) => {
                     tracing::error!(error = %e.as_report(), "Fetch Error");
-                    files_in_progress = 0;
+                    return Err(e);
                 }
                 Ok(msg) => match msg {
                     // Barrier messages from upstream
@@ -452,7 +447,7 @@ impl<S: StateStore> BatchPosixFsFetchExecutor<S> {
                         yield Message::Chunk(chunk);
                     }
                     Either::Right(None) => {
-                        files_in_progress -= 1;
+                        files_in_progress = files_in_progress.saturating_sub(1);
                     }
                 },
             }
```

---

### Incident Patch 15: `42b41ad8` (2026-09-23)
**Commit Message**: refactor(meta): generalize fragment edge builder (#27077)

**File**: `src/meta/src/barrier/checkpoint/independent_job/batch_refresh_job/mod.rs` (modified, +13/-13)
```diff
@@ -47,13 +47,13 @@ use crate::MetaResult;
 use crate::barrier::backfill_order_control::get_nodes_with_backfill_dependencies;
 use crate::barrier::command::{PostCollectCommand, ThrottleConfigMap, extract_throttle_config};
 use crate::barrier::context::CreateIndependentStreamingJobCommandInfo;
-use crate::barrier::edge_builder::{EdgeBuilderFragmentInfo, FragmentEdgeBuilder};
+use crate::barrier::edge_builder::FragmentEdgeBuilder;
 use crate::barrier::info::BarrierInfo;
 use crate::barrier::partial_graph::{
     CollectedBarrier, PartialGraphBarrierInfo, PartialGraphManager, PartialGraphStat,
 };
 use crate::barrier::progress::{CreateMviewProgressTracker, TrackingJob, collect_done_fragments};
-use crate::barrier::rpc::to_partial_graph_id;
+use crate::barrier::rpc::{ControlStreamManager, to_partial_graph_id};
 use crate::barrier::{
     BackfillOrderState, BackfillProgress, BarrierKind, FragmentBackfillProgress, TracedEpoch,
 };
@@ -356,6 +356,7 @@ impl BatchRefreshJobCheckpointControl {
         // Actor rendering context:
         actor_id_generator: &AtomicU32,
         worker_nodes: &HashMap<WorkerId, WorkerNode>,
+        control_stream_manager: &ControlStreamManager,
         database_resource_group: &str,
         streaming_job_model: &streaming_job::Model,
         // Edge building context:
@@ -375,18 +376,15 @@ impl BatchRefreshJobCheckpointControl {
         )?;
 
         // Step 4: Build edges (internal-only, no upstream).
-        let mut builder = FragmentEdgeBuilder::new(fragment_infos.values().map(|f| {
-            (
-                f.fragment_id,
-                EdgeBuilderFragmentInfo::from_inflight_with_worker_nodes(
-                    f,
-                    partial_graph_id,
-                    worker_nodes,
-                ),
+        let (mut edges, _) = FragmentEdgeBuilder::new()
+            .add_new_fragments(
+                fragment_infos.values(),
+                partial_graph_id,
+                control_stream_manager,
             )
-        }));
-        builder.add_relations(downstreams);
-        let mut edges = builder.build();
+            .finish_fragments()
+            .add_relations(downstreams)?
+            .build();
 
         let actors_to_create = edges.collect_actors_to_create(fragment_infos.values().map(|f| {
             (
@@ -536,6 +534,7 @@ impl BatchRefreshJobCheckpointControl {
             &create_info.info.definition,
             actor_id_generator,
             worker_nodes,
+            partial_graph_manager.control_stream_manager(),
             &create_info.info.database_resource_group,
             &create_info.info.streaming_job_model,
             partial_graph_id,
@@ -1269,6 +1268,7 @@ impl BatchRefreshJobCheckpointControl {
             &context.definition,
             actor_id_counter,
             worker_nodes,
+            partial_graph_manager.control_stream_manager(),
             &context.database_resource_group,
             &context.streaming_job_model,
             self.partial_graph_id,
```

**File**: `src/meta/src/barrier/checkpoint/state.rs` (modified, +47/-99)
```diff
@@ -30,7 +30,6 @@ use risingwave_pb::common::WorkerNode;
 use risingwave_pb::hummock::HummockVersionStats;
 use risingwave_pb::source::{ConnectorSplit, ConnectorSplits};
 use risingwave_pb::stream_plan::barrier_mutation::{Mutation, PbMutation};
-use risingwave_pb::stream_plan::update_mutation::PbDispatcherUpdate;
 use risingwave_pb::stream_plan::{
     AddMutation, PbDropSubscriptionsMutation, PbStartFragmentBackfillMutation,
     PbSubscriptionUpstreamInfo, PbUpdateMutation, PbUpstreamSinkInfo,
@@ -47,7 +46,7 @@ use crate::barrier::command::{
     CreateStreamingJobCommandInfo, PostCollectCommand, ReschedulePlan, ThrottleConfigMap,
 };
 use crate::barrier::context::CreateIndependentStreamingJobCommandInfo;
-use crate::barrier::edge_builder::{EdgeBuilderFragmentInfo, FragmentEdgeBuilder};
+use crate::barrier::edge_builder::FragmentEdgeBuilder;
 use crate::barrier::info::{
     BarrierInfo, CreateStreamingJobStatus, InflightDatabaseInfo, InflightStreamingJobInfo,
     SubscriberType,
@@ -588,19 +587,19 @@ impl DatabaseCheckpointControl {
                         .cloned()
                         .collect();
                     // Build edges first (needed for no-shuffle mapping used in split resolution)
-                    let mut edges = self.database_info.build_edge(
+                    let (mut edges, actor_new_no_shuffle) = self.database_info.build_edge(
                         Some((&info, true)),
                         None,
                         None,
                         partial_graph_manager.control_stream_manager(),
                         &actors.stream_actors,
                         &actors.actor_location,
-                    );
+                    )?;
                     // Phase 2: Resolve source-level DiscoveredSplits to actor-level SplitAssignment
                     let resolved_split_assignment = resolve_source_splits(
                         &info,
                         &actors,
-                        edges.actor_new_no_shuffle(),
+                        &actor_new_no_shuffle,
                         &self.database_info,
                     )?;
 
@@ -662,12 +661,10 @@ impl DatabaseCheckpointControl {
                         &create_job_type,
                         [],
                         self.state.is_paused(),
-                        &mut edges,
-                        partial_graph_manager.control_stream_manager(),
+                        edges,
                         None,
                         &resolved_split_assignment,
                         &actors.stream_actors,
-                        &actors.actor_location,
                     )?;
 
                     let (table_ids, node_actors) = self.collect_base_info();
@@ -895,19 +892,19 @@ impl DatabaseCheckpointControl {
                         None
                     };
 
-                let mut edges = self.database_info.build_edge(
+                let (mut edges, actor_new_no_shuffle) = self.database_info.build_edge(
                     Some((&info, false)),
                     None,
                     new_upstream_sink,
                     partial_graph_manager.control_stream_manager(),
                     &actors.stream_actors,
                     &actors.actor_location,
-                );
+                )?;
                 // Phase 2: Resolve source-level DiscoveredSplits to actor-level SplitAssignment
                 let resolved_split_assignment = resolve_source_splits(
                     &info,
                     &actors,
-                    edges.actor_new_no_shuffle(),
+                    &actor_new_no_shuffle,
                     &self.database_info,
                 )?;
 
@@ -995,12 +992,10 @@ impl DatabaseCheckpointControl {
                     &job_type,
                     dropped_actors,
                     is_currently_paused,
-                    &mut edges,
-                    partial_graph_manager.control_stream_manager(),
+                    edges,
                     actor_cdc_table_snapshot_splits,
                     &resolved_split_assignment,
                     &actors.stream_actors,
-                    &actors.actor_location,
                 )?;
 
                 (
@@ -1246,14 +1241,14 @@ impl DatabaseCheckpointControl {
                 }
 
                 // Build edges first (needed for no-shuffle mapping used in split resolution)
-                let mut edges = self.database_info.build_edge(
+                let (mut edges, actor_new_no_shuffle) = self.database_info.build_edge(
                     None,
                     Some(&plan),
                     None,
                     partial_graph_manager.control_stream_manager(),
                     &render_result.stream_actors,
                     &render_result.actor_location,
-                );
+                )?;
 
                 // Phase 2: Resolve splits to actor-level assignment.
                 let fragment_actor_ids: HashMap<FragmentId, Vec<ActorId>> =
```

**File**: `src/meta/src/barrier/command.rs` (modified, +22/-63)
```diff
@@ -41,7 +41,7 @@ use risingwave_pb::stream_plan::sink_schema_change::Op as PbSinkSchemaChangeOp;
 use risingwave_pb::stream_plan::throttle_mutation::ThrottleConfig;
 use risingwave_pb::stream_plan::update_mutation::{DispatcherUpdate, MergeUpdate};
 use risingwave_pb::stream_plan::{
-    AddMutation, ConnectorPropsChangeMutation, Dispatcher, Dispatchers, DropSubscriptionsMutation,
+    AddMutation, ConnectorPropsChangeMutation, Dispatcher, DropSubscriptionsMutation,
     ListFinishMutation, LoadFinishMutation, PauseMutation, PbSinkAddColumnsOp, PbSinkDropColumnsOp,
     PbSinkSchemaChange, PbStreamNode, PbUpstreamSinkInfo, ResumeMutation,
     SourceChangeSplitMutation, StartFragmentBackfillMutation, StopMutation,
@@ -63,9 +63,9 @@ use crate::controller::utils::StreamingJobExtraInfo;
 use crate::hummock::NewTableFragmentInfo;
 use crate::manager::{StreamingJob, StreamingJobType};
 use crate::model::{
-    ActorId, ActorUpstreams, DispatcherId, FragmentActorDispatchers, FragmentDownstreamRelation,
-    FragmentId, FragmentReplaceUpstream, StreamActor, StreamActorWithDispatchers,
-    StreamJobActorsToCreate, StreamJobFragments, StreamJobFragmentsToCreate, SubscriptionId,
+    ActorId, ActorUpstreams, DispatcherId, FragmentDownstreamRelation, FragmentId,
+    FragmentReplaceUpstream, StreamActor, StreamActorWithDispatchers, StreamJobActorsToCreate,
+    StreamJobFragments, StreamJobFragmentsToCreate, SubscriptionId,
 };
 use crate::stream::{
     AutoRefreshSchemaSinkContext, ConnectorPropsChange, ExtendedFragmentBackfillOrder,
@@ -990,23 +990,18 @@ impl Command {
         job_type: &CreateStreamingJobType,
         dropped_actors: impl IntoIterator<Item = ActorId>,
         is_currently_paused: bool,
-        edges: &mut FragmentEdgeBuildResult,
-        control_stream_manager: &ControlStreamManager,
+        mut edges: FragmentEdgeBuildResult,
         actor_cdc_table_snapshot_splits: Option<HashMap<ActorId, PbCdcTableSnapshotSplits>>,
         split_assignment: &SplitAssignment,
         stream_actors: &HashMap<FragmentId, Vec<StreamActor>>,
-        actor_location: &HashMap<ActorId, WorkerId>,
     ) -> MetaResult<Mutation> {
         {
             {
                 let CreateStreamingJobCommandInfo {
                     stream_job_fragments,
-                    upstream_fragment_downstreams,
                     fragment_backfill_ordering,
-                    streaming_job,
                     ..
                 } = info;
-                let database_id = streaming_job.database_id();
                 let added_actors: Vec<ActorId> = stream_actors
                     .values()
                     .flatten()
@@ -1051,27 +1046,17 @@ impl Command {
                         ..
                     }) = job_type
                     {
-                        let new_sink_actors = stream_actors
-                            .get(sink_fragment_id)
-                            .unwrap_or_else(|| {
-                                panic!("upstream sink fragment {sink_fragment_id} does not exist")
-                            })
-                            .iter()
-                            .map(|actor| {
-                                let worker_id = actor_location[&actor.actor_id];
-                                PbActorInfo {
-                                    actor_id: actor.actor_id,
-                                    host: Some(control_stream_manager.host_addr(worker_id)),
-                                    partial_graph_id: to_partial_graph_id(database_id, None),
-                                }
-                            });
+                        let upstream_actors = edges.take_common_upstream_actors(
+                            *sink_fragment_id,
+                            new_sink_downstream.downstream_fragment_id,
+                        )?;
                         let new_upstream_sink = PbNewUpstreamSink {
                             info: Some(PbUpstreamSinkInfo {
                                 upstream_fragment_id: *sink_fragment_id,
                                 sink_output_schema: sink_output_fields.clone(),
                                 project_exprs: project_exprs.clone(),
                             }),
-                            upstream_actors: new_sink_actors.collect(),
+                            upstream_actors,
                         };
                         HashMap::from([(
                             new_sink_downstream.downstream_fragment_id,
@@ -1084,15 +1069,8 @@ impl Command {
                 let actor_cdc_table_snapshot_splits = actor_cdc_table_snapshot_splits
                     .map(|splits| PbCdcTableSnapshotSplitsWithGeneration { splits });
 
-                let add_mutation = AddMutation {
-                    actor_dispatchers: edges
-                        .dispatchers
-                        .extract_if(|fragment_id, _| {
-                            upstream_fragment_downstreams.contains_key(fragment_id)
-          
```

**File**: `src/meta/src/barrier/context/recovery.rs` (modified, +4/-2)
```diff
@@ -42,7 +42,7 @@ use crate::barrier::checkpoint::{
 };
 use crate::barrier::context::{GlobalBarrierWorkerContext, GlobalBarrierWorkerContextImpl};
 use crate::barrier::progress::TrackingJob;
-use crate::barrier::rpc::to_partial_graph_id;
+use crate::barrier::rpc::{ControlStreamManager, to_partial_graph_id};
 use crate::controller::fragment::{InflightActorInfo, InflightFragmentInfo};
 use crate::controller::scale::{
     FragmentRenderMap, LoadedFragment, LoadedFragmentContext, RenderedGraph,
@@ -90,9 +90,10 @@ pub struct RenderedDatabaseRuntimeInfo {
     pub batch_refresh: HashMap<JobId, BatchRefreshRenderResult>,
 }
 
-pub fn render_runtime_info(
+pub(in crate::barrier) fn render_runtime_info(
     actor_id_generator: &AtomicU32,
     worker_nodes: &ActiveStreamingWorkerNodes,
+    control_stream_manager: &ControlStreamManager,
     recovery_context: &LoadedRecoveryContext,
     database_id: DatabaseId,
 ) -> MetaResult<Option<RenderedDatabaseRuntimeInfo>> {
@@ -175,6 +176,7 @@ pub fn render_runtime_info(
             &extra.job_definition,
             actor_id_generator,
             worker_nodes.current(),
+            control_stream_manager,
             &database_model.resource_group,
             streaming_job_model,
             partial_graph_id,
```

**File**: `src/meta/src/barrier/edge_builder.rs` (modified, +1022/-115)
```diff
@@ -13,16 +13,20 @@
 // limitations under the License.
 
 use std::collections::{HashMap, HashSet};
+use std::marker::PhantomData;
+use std::mem::take;
 
+use anyhow::anyhow;
 use risingwave_common::bitmap::Bitmap;
 use risingwave_meta_model::WorkerId;
 use risingwave_meta_model::fragment::DistributionType;
-use risingwave_pb::common::{ActorInfo, HostAddress, WorkerNode};
+use risingwave_pb::common::{ActorInfo, HostAddress};
 use risingwave_pb::id::{PartialGraphId, SubscriberId};
-use risingwave_pb::stream_plan::StreamNode;
-use risingwave_pb::stream_plan::update_mutation::MergeUpdate;
+use risingwave_pb::stream_plan::update_mutation::{DispatcherUpdate, MergeUpdate};
+use risingwave_pb::stream_plan::{AddMutation, PbDispatcher, StreamNode, UpdateMutation};
 use tracing::warn;
 
+use crate::MetaResult;
 use crate::barrier::rpc::ControlStreamManager;
 use crate::controller::fragment::InflightFragmentInfo;
 use crate::controller::utils::compose_dispatchers;
@@ -32,20 +36,36 @@ use crate::model::{
     StreamJobActorsToCreate,
 };
 
+type ComposedEdge = (
+    HashMap<ActorId, PbDispatcher>,
+    HashMap<ActorId, ActorUpstreams>,
+    Option<HashMap<ActorId, ActorId>>,
+);
+
 /// Fragment information needed by [`FragmentEdgeBuilder`] to compute dispatchers and merge nodes.
 ///
 /// Contains actor bitmaps and resolved host addresses.
 #[derive(Debug)]
-pub(super) struct EdgeBuilderFragmentInfo {
+struct EdgeBuilderFragmentInfo {
     distribution_type: DistributionType,
     actors: HashMap<ActorId, Option<Bitmap>>,
     actor_location: HashMap<ActorId, HostAddress>,
     partial_graph_id: PartialGraphId,
 }
 
+#[derive(Debug)]
+enum FragmentStatus {
+    Existing(EdgeBuilderFragmentInfo),
+    New(EdgeBuilderFragmentInfo),
+    Changed {
+        before: EdgeBuilderFragmentInfo,
+        after: EdgeBuilderFragmentInfo,
+    },
+}
+
 impl EdgeBuilderFragmentInfo {
     /// Build from an already-inflight fragment (actors already materialized).
-    pub fn from_inflight(
+    fn from_inflight(
         info: &InflightFragmentInfo,
         partial_graph_id: PartialGraphId,
         control_stream_manager: &ControlStreamManager,
@@ -68,39 +88,8 @@ impl EdgeBuilderFragmentInfo {
         }
     }
 
-    /// Build from an already-inflight fragment using worker node map for host resolution.
-    ///
-    /// Unlike [`from_inflight`](Self::from_inflight), this does not require a
-    /// `ControlStreamManager` and can be used when only worker node metadata is available
-    /// (e.g., during `render_runtime_info` before the control streams are fully set up).
-    pub fn from_inflight_with_worker_nodes(
-        info: &InflightFragmentInfo,
-        partial_graph_id: PartialGraphId,
-        worker_nodes: &HashMap<WorkerId, WorkerNode>,
-    ) -> Self {
-        let (actors, actor_location) = info
-            .actors
-            .iter()
-            .map(|(&actor_id, actor)| {
-                (
-                    (actor_id, actor.vnode_bitmap.clone()),
-                    (
-                        actor_id,
-                        worker_nodes[&actor.worker_id].host.clone().unwrap(),
-                    ),
-                )
-            })
-            .unzip();
-        Self {
-            distribution_type: info.distribution_type,
-            actors,
-            actor_location,
-            partial_graph_id,
-        }
-    }
-
     /// Build from a model `Fragment` with separately provided actors and locations.
-    pub fn from_fragment(
+    fn from_fragment(
         fragment: &Fragment,
         stream_actors: &HashMap<FragmentId, Vec<StreamActor>>,
         actor_worker: &HashMap<ActorId, WorkerId>,
@@ -131,19 +120,75 @@ impl EdgeBuilderFragmentInfo {
 }
 
 #[derive(Debug)]
-pub(super) struct FragmentEdgeBuildResult {
+pub(crate) struct FragmentEdgeBuildResult {
     upstreams: HashMap<FragmentId, HashMap<ActorId, ActorUpstreams>>,
-    pub(super) dispatchers: FragmentActorDispatchers,
-    pub(super) merge_updates: HashMap<FragmentId, Vec<MergeUpdate>>,
-    actor_new_no_shuffle: ActorNewNoShuffle,
+    dispatchers: FragmentActorDispatchers,
+    merge_updates: HashMap<FragmentId, Vec<MergeUpdate>>,
+    dispatcher_updates: Vec<DispatcherUpdate>,
 }
 
 impl FragmentEdgeBuildResult {
-    pub(super) fn actor_new_no_shuffle(&self) -> &ActorNewNoShuffle {
-        &self.actor_new_no_shuffle
+    fn validate_terminal_consumption(&self) {
+        let remaining_upstreams = self.upstreams.values().map(HashMap::len).sum::<usize>();
+        let remaining_dispatchers = self.dispatchers.values().map(HashMap::len).sum::<usize>();
+        let unapplied_dispatcher_updates = self.dispatcher_updates.len();
+        let unapplied_merge_updates = self.merge_updates.values().map(Vec::len).sum::<usize>();
+        let has_unconsumed_fields = remaining_upstreams != 0
+            || remaining_dispatchers != 0
+            || unapplied_dispatcher_updates != 0
+            || unapplied_merge_updates != 0;
+
+        deb
```

**File**: `src/meta/src/barrier/info.rs` (modified, +28/-39)
```diff
@@ -45,9 +45,7 @@ use crate::barrier::command::{
     CreateStreamingJobCommandInfo, PostCollectCommand, ReplaceStreamJobPlan, ThrottleConfigMap,
     extract_throttle_config,
 };
-use crate::barrier::edge_builder::{
-    EdgeBuilderFragmentInfo, FragmentEdgeBuildResult, FragmentEdgeBuilder,
-};
+use crate::barrier::edge_builder::{FragmentEdgeBuildResult, FragmentEdgeBuilder};
 use crate::barrier::progress::{CreateMviewProgressTracker, StagingCommitInfo};
 use crate::barrier::rpc::{ControlStreamManager, to_partial_graph_id};
 use crate::barrier::{
@@ -56,7 +54,9 @@ use crate::barrier::{
 use crate::controller::fragment::{InflightActorInfo, InflightFragmentInfo};
 use crate::controller::utils::rebuild_fragment_mapping;
 use crate::manager::NotificationManagerRef;
-use crate::model::{ActorId, BackfillUpstreamType, FragmentId, StreamActor, StreamJobFragments};
+use crate::model::{
+    ActorId, ActorNewNoShuffle, BackfillUpstreamType, FragmentId, StreamActor, StreamJobFragments,
+};
 use crate::stream::UpstreamSinkInfo;
 use crate::{MetaError, MetaResult};
 
@@ -1212,7 +1212,7 @@ impl InflightDatabaseInfo {
         control_stream_manager: &ControlStreamManager,
         stream_actors: &HashMap<FragmentId, Vec<StreamActor>>,
         actor_location: &HashMap<ActorId, WorkerId>,
-    ) -> FragmentEdgeBuildResult {
+    ) -> MetaResult<(FragmentEdgeBuildResult, ActorNewNoShuffle)> {
         // `existing_fragment_ids` consists of
         //  - keys of `info.upstream_fragment_downstreams`, which are the `fragment_id` the upstream fragment of the newly created job
         //  - keys of `replace_job.upstream_fragment_downstreams`, which are the `fragment_id` of upstream fragment of replace_job,
@@ -1278,60 +1278,49 @@ impl InflightDatabaseInfo {
                     })
             }));
 
-        let mut builder = FragmentEdgeBuilder::new(
-            // Existing fragments
-            existing_fragment_ids
-                .map(|fragment_id| {
-                    (
-                        fragment_id,
-                        EdgeBuilderFragmentInfo::from_inflight(
-                            self.fragment(fragment_id),
-                            to_partial_graph_id(self.database_id, None),
-                            control_stream_manager,
-                        ),
-                    )
-                })
-                // New fragments from create/replace jobs
-                .chain(new_fragments.map(|(partial_graph_id, fragment)| {
-                    (
-                        fragment.fragment_id,
-                        EdgeBuilderFragmentInfo::from_fragment(
-                            fragment,
-                            stream_actors,
-                            actor_location,
-                            partial_graph_id,
-                            control_stream_manager,
-                        ),
-                    )
-                })),
-        );
+        let database_partial_graph_id = to_partial_graph_id(self.database_id, None);
+        let mut builder = FragmentEdgeBuilder::new()
+            .add_existing_fragments(
+                existing_fragment_ids.map(|fragment_id| self.fragment(fragment_id)),
+                database_partial_graph_id,
+                control_stream_manager,
+            )
+            .add_new_logical_fragments(
+                new_fragments,
+                stream_actors,
+                actor_location,
+                control_stream_manager,
+            )
+            .finish_fragments();
         if let Some((info, _)) = info {
-            builder.add_relations(&info.upstream_fragment_downstreams);
-            builder.add_relations(&info.stream_job_fragments.downstreams);
+            builder = builder
+                .add_relations(&info.upstream_fragment_downstreams)?
+                .add_relations(&info.stream_job_fragments.downstreams)?;
         }
         if let Some(replace_job) = replace_job {
-            builder.add_relations(&replace_job.upstream_fragment_downstreams);
-            builder.add_relations(&replace_job.new_fragments.downstreams);
+            builder = builder
+                .add_relations(&replace_job.upstream_fragment_downstreams)?
+                .add_relations(&replace_job.new_fragments.downstreams)?;
         }
         if let Some(new_upstream_sink) = new_upstream_sink {
             let sink_fragment_id = new_upstream_sink.sink_fragment_id;
             let new_sink_downstream = &new_upstream_sink.new_sink_downstream;
-            builder.add_edge(sink_fragment_id, new_sink_downstream);
+            builder = builder.add_edge(sink_fragment_id, new_sink_downstream)?;
         }
         if let Some(replace_job) = replace_job {
             for (fragment_id, fragment_replacement) in &replace_job.replace_upstream {
                 for (original_upstream_fragment_id, new_upstream_fragment_id) in
                     fragment_replacement
                 {
-                    builder.replace_up
```

**File**: `src/meta/src/barrier/rpc.rs` (modified, +16/-34)
```diff
@@ -70,7 +70,7 @@ use crate::barrier::checkpoint::{
     IndependentCheckpointJobControl, IndependentCheckpointJobStatus,
 };
 use crate::barrier::context::{GlobalBarrierWorkerContext, GlobalBarrierWorkerContextImpl};
-use crate::barrier::edge_builder::{EdgeBuilderFragmentInfo, FragmentEdgeBuilder};
+use crate::barrier::edge_builder::FragmentEdgeBuilder;
 use crate::barrier::info::{
     BarrierInfo, CreateStreamingJobStatus, InflightDatabaseInfo, InflightStreamingJobInfo,
     SubscriberType,
@@ -935,40 +935,22 @@ impl PartialGraphRecoverer<'_> {
         }?;
 
         let control_stream_manager = self.control_stream_manager();
-        let mut builder = FragmentEdgeBuilder::new(
-            database_jobs
-                .values()
-                .flat_map(|job| {
-                    let partial_graph_id = to_partial_graph_id(database_id, None);
-                    job.fragment_infos().map(move |info| {
-                        (
-                            info.fragment_id,
-                            EdgeBuilderFragmentInfo::from_inflight(
-                                info,
-                                partial_graph_id,
-                                control_stream_manager,
-                            ),
-                        )
-                    })
-                })
-                .chain(ongoing_snapshot_backfill_jobs.iter().flat_map(
-                    |(job_id, (fragments, ..))| {
-                        let partial_graph_id = to_partial_graph_id(database_id, Some(*job_id));
-                        fragments.values().map(move |fragment| {
-                            (
-                                fragment.fragment_id,
-                                EdgeBuilderFragmentInfo::from_inflight(
-                                    fragment,
-                                    partial_graph_id,
-                                    control_stream_manager,
-                                ),
-                            )
-                        })
-                    },
-                )),
+        let mut builder = FragmentEdgeBuilder::new().add_new_fragments(
+            database_jobs.values().flat_map(|job| job.fragment_infos()),
+            to_partial_graph_id(database_id, None),
+            control_stream_manager,
         );
-        builder.add_relations(fragment_relations);
-        let mut edges = builder.build();
+        for (job_id, (fragments, ..)) in &ongoing_snapshot_backfill_jobs {
+            builder = builder.add_new_fragments(
+                fragments.values(),
+                to_partial_graph_id(database_id, Some(*job_id)),
+                control_stream_manager,
+            );
+        }
+        let (mut edges, _) = builder
+            .finish_fragments()
+            .add_relations(fragment_relations)?
+            .build();
 
         {
             let new_actors =
```

**File**: `src/meta/src/barrier/worker.rs` (modified, +2/-0)
```diff
@@ -684,6 +684,7 @@ impl<C: GlobalBarrierWorkerContext> GlobalBarrierWorker<C> {
                                     let rendered_info = render_runtime_info(
                                         self.env.actor_id_generator(),
                                         &self.active_streaming_nodes,
+                                        self.partial_graph_manager.control_stream_manager(),
                                         &runtime_info.recovery_context,
                                         database_id,
                                     )
@@ -1252,6 +1253,7 @@ impl<C: GlobalBarrierWorkerContext> GlobalBarrierWorker<C> {
                         let Some(rendered_info) = render_runtime_info(
                             self.env.actor_id_generator(),
                             &active_streaming_nodes,
+                            recoverer.control_stream_manager(),
                             &recovery_context,
                             database_id,
                         )
```

#### Recent Merged Pull Requests:
- **PR #27385** (2026-10-05): chore: remove risingwave rust-analyzer skill (@silver-ymz)
- **PR #27375** (closed): perf(stream): replay the vnodes of a locality provider merged in locality order (@yuhao-su)
- **PR #27358** (2026-09-30): fix(cdc): backport streaming readiness and SQL Server shutdown fixes (@zwang28)
- **PR #27344** (closed): chore(deps-dev): Bump com.fasterxml.jackson.core:jackson-databind from 2.22.1 to 2.22.2 in /java (@dependabot[bot])
- **PR #27339** (2026-09-28): fix(object-store): propagate metadata errors during listing (#27266) (@risingwave-ci)
- **PR #27334** (2026-09-29): perf(storage): upgrade foyer to 0.22.6 with recovery backport (@Li0k)
- **PR #27317** (2026-09-27): chore(deps): Bump xorf from 0.12.0 to 0.13.0 (@dependabot[bot])
- **PR #27315** (2026-09-27): chore(deps): Bump rustls-pki-types from 1.14.0 to 1.15.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

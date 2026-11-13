# Verification Protocol: Verification Protocol: Empirical Defect Shield for risingwavelabs-risingwave-learnings

<!-- PROVENANCE_START
{
  "source_repository": "risingwavelabs-risingwave-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:44:03.084Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-risingwavelabs-risingwave-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [risingwavelabs-risingwave-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:44:03.084Z`  
> **Learning ID**: `LEARN-REEXTRACT-risingwavelabs-risingwave-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `risingwavelabs-risingwave-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/risingwavelabs-risingwave-learnings.md`  
> **Source**: github ([https://github.com/risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave))  
> **Source Version**: `26236216`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T18:03:48.492Z  
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
> **Harvest Timestamp**: 2026-11-11T18:03:48.487Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `risingwavelabs/risingwave`
- **Description**: Event streaming platform for agentic AI. Continuously ingest, transform, and serve event streams in real time, at scale.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9410 stars

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

### Incident Patch 1: `c4837fda` (2026-11-09)
**Commit Message**: fix(frontend): reject invalid rate limit in WITH options instead of panicking (#27900)

**File**: `e2e_test/ddl/throttle.slt` (modified, +7/-0)
```diff
@@ -15,6 +15,13 @@ create materialized view mv1 with (backfill_rate_limit = 1000, backfill_rate_lim
 statement error unexpected options in WITH clause
 create materialized view mv1 with (backfill_rate_limit = 1000, unknown_field = 2000) as select * from t1;
 
+# create with invalid backfill_rate_limit
+statement error `backfill_rate_limit` must be a non-negative integer, but got `abc`
+create materialized view mv1 with (backfill_rate_limit = 'abc') as select * from t1;
+
+statement error `backfill_rate_limit` must be a non-negative integer, but got `-1`
+create materialized view mv1 with (backfill_rate_limit = '-1') as select * from t1;
+
 statement ok
 create materialized view mv1 with (backfill_rate_limit = 1000) as select * from t1;
 
```

**File**: `src/frontend/planner_test/src/lib.rs` (modified, +1/-1)
```diff
@@ -440,7 +440,7 @@ impl TestCase {
                     let context = OptimizerContext::new(
                         HandlerArgs::new(session.clone(), &stmt, sql.clone())?,
                         explain_options,
-                    );
+                    )?;
                     let ret = self.apply_query(&stmt, context.into())?;
                     if do_check_result {
                         check_result(self, &ret)?;
```

**File**: `src/frontend/src/handler/create_index.rs` (modified, +1/-1)
```diff
@@ -712,7 +712,7 @@ pub async fn handle_create_index(
             return Ok(resp);
         }
 
-        let context = OptimizerContext::from_handler_args(handler_args);
+        let context = OptimizerContext::from_handler_args(handler_args)?;
         let (plan, index_table, index) = gen_create_index_plan(
             &session,
             context.into(),
```

**File**: `src/frontend/src/handler/create_mv.rs` (modified, +5/-5)
```diff
@@ -257,9 +257,9 @@ pub(crate) fn resolve_streaming_job_resource_type(
     Ok(resource_type)
 }
 
-fn get_with_options(handler_args: HandlerArgs) -> WithOptions {
-    let context = OptimizerContext::from_handler_args(handler_args);
-    context.with_options().clone()
+fn get_with_options(handler_args: HandlerArgs) -> Result<WithOptions> {
+    let context = OptimizerContext::from_handler_args(handler_args)?;
+    Ok(context.with_options().clone())
 }
 
 pub async fn handle_create_mv_bound(
@@ -355,7 +355,7 @@ pub(crate) fn gen_create_mv_graph(
     streaming_job_resource_type::ResourceType,
     Option<u64>,
 )> {
-    let mut with_options = get_with_options(handler_args.clone());
+    let mut with_options = get_with_options(handler_args.clone())?;
     let refresh_interval_sec = with_options.refresh_interval_sec()?;
     with_options.remove(MV_REFRESH_INTERVAL_SEC_KEY);
     let resource_type =
@@ -369,7 +369,7 @@ pub(crate) fn gen_create_mv_graph(
         ))));
     }
 
-    let context = OptimizerContext::from_handler_args(handler_args);
+    let context = OptimizerContext::from_handler_args(handler_args)?;
     let has_order_by = !query.order.is_empty();
     if has_order_by {
         context.warn_to_user(r#"The ORDER BY clause in the CREATE MATERIALIZED VIEW statement does not guarantee that the rows selected out of this materialized view is returned in this order.
```

**File**: `src/frontend/src/handler/create_sink.rs` (modified, +2/-2)
```diff
@@ -219,9 +219,9 @@ pub async fn gen_sink_plan(
     let partition_info = get_partition_compute_info(&resolved_with_options).await?;
 
     let context = if let Some(explain_options) = explain_options {
-        OptimizerContext::new(handler_args.clone(), explain_options)
+        OptimizerContext::new(handler_args.clone(), explain_options)?
     } else {
-        OptimizerContext::from_handler_args(handler_args.clone())
+        OptimizerContext::from_handler_args(handler_args.clone())?
     };
     let is_auto_schema_change = resolved_with_options
         .get(AUTO_SCHEMA_CHANGE_KEY)
```

**File**: `src/frontend/src/handler/create_source.rs` (modified, +2/-2)
```diff
@@ -1221,7 +1221,7 @@ pub async fn handle_create_source(
         return handle_create_cdc_table_source(handler_args, stmt).await;
     }
 
-    let overwrite_options = OverwriteOptions::new(&mut handler_args);
+    let overwrite_options = OverwriteOptions::new(&mut handler_args)?;
 
     if handler_args.with_options.is_empty() {
         return Err(RwError::from(InvalidInputSyntax(
@@ -1556,7 +1556,7 @@ pub(super) fn generate_stream_graph_for_source(
     handler_args: HandlerArgs,
     source_catalog: SourceCatalog,
 ) -> Result<PbStreamFragmentGraph> {
-    let context = OptimizerContext::from_handler_args(handler_args);
+    let context = OptimizerContext::from_handler_args(handler_args)?;
     let source_node = LogicalSource::with_catalog(
         Rc::new(source_catalog),
         SourceNodeKind::CreateSharedSource,
```

**File**: `src/frontend/src/handler/create_subscription.rs` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ pub async fn handle_create_subscription(
         return Ok(resp);
     };
     let subscription_catalog = {
-        let context = Rc::new(OptimizerContext::from_handler_args(handle_args));
+        let context = Rc::new(OptimizerContext::from_handler_args(handle_args)?);
         create_subscription_catalog(&session, context, stmt)?
     };
 
```

**File**: `src/frontend/src/handler/create_table.rs` (modified, +7/-7)
```diff
@@ -516,7 +516,7 @@ pub(crate) async fn gen_create_table_plan_with_source(
     )
     .await?;
 
-    let overwrite_options = OverwriteOptions::new(&mut handler_args);
+    let overwrite_options = OverwriteOptions::new(&mut handler_args)?;
     let rate_limit = overwrite_options.source_rate_limit;
     let source = bind_create_source_or_table_with_connector(
         handler_args.clone(),
@@ -538,7 +538,7 @@ pub(crate) async fn gen_create_table_plan_with_source(
     )
     .await?;
 
-    let context = OptimizerContext::new(handler_args, explain_options);
+    let context = OptimizerContext::new(handler_args, explain_options)?;
 
     let (plan, table) = gen_table_plan_with_source(
         context.into(),
@@ -1056,7 +1056,7 @@ pub(super) async fn handle_create_table_plan(
             None,
         ),
         (None, None) => {
-            let context = OptimizerContext::new(handler_args, explain_options);
+            let context = OptimizerContext::new(handler_args, explain_options)?;
             let (plan, table) = gen_create_table_plan(
                 context,
                 table_name.clone(),
@@ -1150,7 +1150,7 @@ pub(super) async fn handle_create_table_plan(
             reject_pk_filtered_by_debezium_column_filter(&pk_names, &cdc_with_options)?;
 
             let context: OptimizerContextRef =
-                OptimizerContext::new(handler_args, explain_options).into();
+                OptimizerContext::new(handler_args, explain_options)?.into();
             let shared_source_id = source.id;
             let (plan, table) = gen_create_table_plan_for_cdc_table(
                 context,
@@ -1704,7 +1704,7 @@ pub async fn create_iceberg_engine_table(
     source_handler_args.with_options =
         WithOptions::new(source_with, Default::default(), connection_ref);
 
-    let overwrite_options = OverwriteOptions::new(&mut source_handler_args);
+    let overwrite_options = OverwriteOptions::new(&mut source_handler_args)?;
     let format_encode = create_source_stmt.format_encode.into_v2_with_warning();
     let (with_properties, refresh_mode) =
         bind_connector_props(&source_handler_args, &format_encode, true)?;
@@ -1934,7 +1934,7 @@ pub async fn generate_stream_graph_for_replace_table(
             TableJobType::General,
         ),
         (None, None) => {
-            let context = OptimizerContext::from_handler_args(handler_args);
+            let context = OptimizerContext::from_handler_args(handler_args)?;
             let (plan, table) = gen_create_table_plan(
                 context,
                 table_name,
@@ -1977,7 +1977,7 @@ pub async fn generate_stream_graph_for_replace_table(
             reject_pk_filtered_by_debezium_column_filter(&pk_names, &cdc_with_options)?;
 
             let context: OptimizerContextRef =
-                OptimizerContext::new(handler_args, ExplainOptions::default()).into();
+                OptimizerContext::new(handler_args, ExplainOptions::default())?.into();
             let (plan, table) = gen_create_table_plan_for_cdc_table(
                 context,
                 source,
```

---

### Incident Patch 2: `0609c3aa` (2026-11-10)
**Commit Message**: fix(iceberg): let sink coordinator start before pending schema change is committed (#27906)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/connector/src/connector_common/iceberg/mock_catalog.rs` (modified, +44/-2)
```diff
@@ -41,7 +41,7 @@ mod test_tables {
         UnboundPartitionSpec,
     };
     use iceberg::table::Table;
-    use iceberg::{NamespaceIdent, Runtime, TableIdent};
+    use iceberg::{NamespaceIdent, Runtime, TableCommit, TableIdent};
     use parking_lot::Mutex;
 
     use super::MockCatalog;
@@ -97,6 +97,18 @@ mod test_tables {
             TABLES.lock().contains_key(ident) || matches!(ident.name(), "updates_v2" | "updates_v3")
         }
 
+        /// Apply a commit to a registered table. Returns the commit back if the table is not
+        /// registered.
+        pub(super) fn update_test_table(
+            commit: TableCommit,
+        ) -> Result<iceberg::Result<Table>, Box<TableCommit>> {
+            let mut tables = TABLES.lock();
+            let Some(table) = tables.get_mut(commit.identifier()) else {
+                return Err(Box::new(commit));
+            };
+            Ok(apply_commit(table, commit))
+        }
+
         pub(super) fn updates_table(name: &str, version: FormatVersion) -> Table {
             let schema = Schema::builder()
                 .with_fields(vec![
@@ -132,6 +144,30 @@ mod test_tables {
                 .unwrap()
         }
     }
+
+    fn apply_commit(table: &mut Table, mut commit: TableCommit) -> iceberg::Result<Table> {
+        for requirement in commit.take_requirements() {
+            requirement.check(Some(table.metadata()))?;
+        }
+        let mut metadata_builder = table
+            .metadata()
+            .clone()
+            .into_builder(table.metadata_location().map(str::to_owned));
+        for update in commit.take_updates() {
+            metadata_builder = update.apply(metadata_builder)?;
+        }
+        let mut builder = Table::builder()
+            .identifier(table.identifier().clone())
+            .file_io(table.file_io().clone())
+            .runtime(Runtime::try_current().unwrap())
+            .metadata(metadata_builder.build()?.metadata);
+        if let Some(location) = table.metadata_location() {
+            builder = builder.metadata_location(location);
+        }
+        let updated = builder.build()?;
+        *table = updated.clone();
+        Ok(updated)
+    }
 }
 
 /// A mock catalog for Iceberg planner and executor tests.
@@ -364,7 +400,13 @@ impl CatalogV2 for MockCatalog {
     }
 
     /// Update a table to the catalog.
-    async fn update_table(&self, _commit: TableCommit) -> iceberg::Result<Table> {
+    async fn update_table(&self, commit: TableCommit) -> iceberg::Result<Table> {
+        #[cfg(any(test, feature = "test"))]
+        let commit = match Self::update_test_table(commit) {
+            Ok(result) => return result,
+            Err(commit) => *commit,
+        };
+        let _ = commit;
         todo!()
     }
 
```

**File**: `src/connector/src/sink/iceberg/create_table.rs` (modified, +22/-7)
```diff
@@ -65,6 +65,28 @@ impl IcebergOrderKeyField {
 pub async fn create_and_validate_table_impl(
     config: &IcebergConfig,
     param: &SinkParam,
+) -> Result<Table> {
+    let table = create_and_load_table_impl(config, param).await?;
+
+    let sink_schema = param.schema();
+    let iceberg_arrow_schema = schema_to_arrow_schema(table.metadata().current_schema())
+        .map_err(|err| SinkError::Iceberg(anyhow!(err)))?;
+
+    try_matches_arrow_schema(&sink_schema, &iceberg_arrow_schema)
+        .map_err(|err| SinkError::Iceberg(anyhow!(err)))?;
+
+    Ok(table)
+}
+
+/// Creates the table if configured, loads it, and checks table properties that do not depend on
+/// its current schema.
+///
+/// Unlike [`create_and_validate_table_impl`], this does not require the current Iceberg schema to
+/// match `param`. During recovery, a durably recorded sink schema change may still need to be
+/// committed before the two schemas match again.
+pub async fn create_and_load_table_impl(
+    config: &IcebergConfig,
+    param: &SinkParam,
 ) -> Result<Table> {
     if config.create_table_if_not_exists {
         create_table_if_not_exists_impl(config, param).await?;
@@ -86,13 +108,6 @@ pub async fn create_and_validate_table_impl(
         }
     }
 
-    let sink_schema = param.schema();
-    let iceberg_arrow_schema = schema_to_arrow_schema(table.metadata().current_schema())
-        .map_err(|err| SinkError::Iceberg(anyhow!(err)))?;
-
-    try_matches_arrow_schema(&sink_schema, &iceberg_arrow_schema)
-        .map_err(|err| SinkError::Iceberg(anyhow!(err)))?;
-
     Ok(table)
 }
 
```

**File**: `src/connector/src/sink/iceberg/mod.rs` (modified, +9/-1)
```diff
@@ -152,6 +152,10 @@ impl IcebergSink {
         create_and_validate_table_impl(&self.config, &self.param).await
     }
 
+    async fn create_and_load_table(&self) -> Result<Table> {
+        create_and_load_table_impl(&self.config, &self.param).await
+    }
+
     /// Returns `true` if this call created the table, `false` if it already existed.
     pub async fn create_table_if_not_exists(&self) -> Result<bool> {
         create_table_if_not_exists_impl(&self.config, &self.param).await
@@ -424,7 +428,11 @@ impl Sink for IcebergSink {
         iceberg_compact_stat_sender: Option<UnboundedSender<IcebergSinkCompactionUpdate>>,
     ) -> Result<SinkCommitCoordinator> {
         let catalog = self.config.create_catalog().await?;
-        let table = self.create_and_validate_table().await?;
+        // Do not require the current Iceberg schema to match `self.param` here. During recovery,
+        // `self.param` may already include a sink schema change that is still pending in the meta
+        // store. The coordinator commits that change before it starts writer handles, and writers
+        // validate the table schema against their own params in `begin_epoch`.
+        let table = self.create_and_load_table().await?;
         let coordinator = IcebergSinkCommitter {
             catalog,
             table,
```

**File**: `src/connector/src/sink/iceberg/test.rs` (modified, +214/-0)
```diff
@@ -1253,3 +1253,217 @@ fn test_validate_row_lineage_column_names() {
     // `<table>._row_id`, which does not collide with the lineage column.
     validate_row_lineage_column_names(FormatVersion::V3, &columns("t._row_id")).unwrap();
 }
+
+// Iceberg tables require a native Tokio runtime, which madsim does not provide.
+#[cfg(not(madsim))]
+mod coordinator_recovery {
+    use std::collections::HashMap;
+
+    use iceberg::io::FileIO;
+    use iceberg::spec::{
+        FormatVersion, NestedField, PrimitiveType, Schema as IcebergSchema, SortOrder,
+        TableMetadataBuilder, Type, UnboundPartitionSpec,
+    };
+    use iceberg::table::Table;
+    use iceberg::{NamespaceIdent, Runtime, TableIdent};
+    use risingwave_common::catalog::{ColumnDesc, ColumnId, Field};
+    use risingwave_common::id::SinkId;
+    use risingwave_common::types::DataType;
+    use risingwave_pb::plan_common::PbField;
+    use risingwave_pb::stream_plan::sink_schema_change::Op as PbSinkSchemaChangeOp;
+    use risingwave_pb::stream_plan::{PbSinkAddColumnsOp, PbSinkSchemaChange};
+    use thiserror_ext::AsReport;
+
+    use crate::connector_common::mock_catalog::{MockCatalog, MockTableGuard};
+    use crate::sink::boxed::BoxTwoPhaseCoordinator;
+    use crate::sink::catalog::SinkType;
+    use crate::sink::iceberg::{IcebergConfig, IcebergSink, create_and_validate_table_impl};
+    use crate::sink::{Sink, SinkCommitCoordinator, SinkParam};
+
+    const NAMESPACE: &str = "mock_namespace";
+
+    fn register_table(fields: &[(i32, &str, PrimitiveType)]) -> (String, MockTableGuard) {
+        let name = format!("coordinator_recovery_{}", uuid::Uuid::new_v4().simple());
+        let schema = IcebergSchema::builder()
+            .with_fields(fields.iter().map(|(id, field_name, ty)| {
+                NestedField::optional(*id, *field_name, Type::Primitive(ty.clone())).into()
+            }))
+            .build()
+            .unwrap();
+        let metadata = TableMetadataBuilder::new(
+            schema,
+            UnboundPartitionSpec::builder().build(),
+            SortOrder::unsorted_order(),
+            format!("memory://{name}"),
+            FormatVersion::V2,
+            HashMap::new(),
+        )
+        .unwrap()
+        .build()
+        .unwrap()
+        .metadata;
+        let table = Table::builder()
+            .identifier(TableIdent::new(
+                NamespaceIdent::new(NAMESPACE.to_owned()),
+                name.clone(),
+            ))
+            .file_io(FileIO::new_with_memory())
+            .runtime(Runtime::try_current().unwrap())
+            .metadata(metadata)
+            .build()
+            .unwrap();
+        let guard = MockCatalog::register(table);
+        (name, guard)
+    }
+
+    fn sink_param(table_name: &str, columns: &[(&str, DataType)]) -> SinkParam {
+        SinkParam {
+            sink_id: SinkId::from(1u32),
+            sink_name: "test_sink".to_owned(),
+            properties: [
+                ("connector", "iceberg"),
+                ("type", "append-only"),
+                ("catalog.type", "mock"),
+                ("database.name", NAMESPACE),
+                ("table.name", table_name),
+            ]
+            .into_iter()
+            .map(|(k, v)| (k.to_owned(), v.to_owned()))
+            .collect(),
+            columns: columns
+                .iter()
+                .enumerate()
+                .map(|(i, (name, ty))| {
+                    ColumnDesc::named(*name, ColumnId::new(i as i32 + 1), ty.clone())
+                })
+                .collect(),
+            downstream_pk: None,
+            sink_type: SinkType::AppendOnly,
+            ignore_delete: false,
+            format_desc: None,
+            db_name: "test_db".to_owned(),
+            sink_from_name: "test_table".to_owned(),
+        }
+    }
+
+    fn pb_fields(columns: &[(&str, DataType)]) -> Vec<PbField> {
+        columns
+            .iter()
+            .map(|(name, ty)| Field::with_name(ty.clone(), *name).to_prost())
+            .collect()
+    }
+
+    fn add_columns_change(
+        original: &[(&str, DataType)],
+        added: &[(&str, DataType)],
+    ) -> PbSinkSchemaChange {
+        PbSinkSchemaChange {
+            original_schema: pb_fields(original),
+            op: Some(PbSinkSchemaChangeOp::AddColumns(PbSinkAddColumnsOp {
+                fields: pb_fields(added),
+            })),
+        }
+    }
+
+    async fn new_two_phase_coordinator(param: &SinkParam) -> BoxTwoPhaseCoordinator {
+        let sink = IcebergSink::try_from(param.clone()).unwrap();
+        match sink.new_coordinator(None).await.unwrap() {
+            SinkCommitCoordinator::TwoPhase(coordinator) => coordinator,
+            SinkCommitCoordinator::SinglePhase(_) => {
+                panic!("an exactly-once iceberg sink should use a two-phase coordinator")
+            }
+        }
+    }
+
+    /// After a sink schema change is persisted and the replace job is finished, recovery builds t
```

**File**: `src/meta/src/manager/sink_coordination/manager.rs` (modified, +148/-0)
```diff
@@ -2102,6 +2102,154 @@ mod tests {
         assert_eq!(rows[0].3, None);
     }
 
+    /// After a replace job finishes, recovery builds the coordinator from writers that already have
+    /// the new schema, while the schema change can still be pending in the meta store. The pending
+    /// change must be committed before any writer receives its start response, because writers
+    /// validate the sink table against their new schema once they start.
+    #[tokio::test]
+    async fn test_recovered_schema_change_committed_before_writer_start() {
+        let db = prepare_db_backend().await;
+
+        let param = SinkParam {
+            sink_id: SinkId::from(1),
+            sink_name: "test".into(),
+            properties: Default::default(),
+            columns: vec![],
+            downstream_pk: None,
+            sink_type: SinkType::AppendOnly,
+            ignore_delete: false,
+            format_desc: None,
+            db_name: "test".into(),
+            sink_from_name: "test".into(),
+        };
+
+        let epoch1 = 233;
+        let metadata = vec![1u8, 2u8];
+        let schema_change = PbSinkSchemaChange {
+            original_schema: vec![PbField {
+                data_type: Some(PbDataType {
+                    type_name: PbTypeName::Int32 as i32,
+                    ..Default::default()
+                }),
+                name: "col_v1".into(),
+            }],
+            op: Some(SinkSchemachangeOp::AddColumns(PbSinkAddColumnsOp {
+                fields: vec![PbField {
+                    data_type: Some(PbDataType {
+                        type_name: PbTypeName::Varchar as i32,
+                        ..Default::default()
+                    }),
+                    name: "new_col".into(),
+                }],
+            })),
+        };
+        crate::manager::exactly_once_util::persist_pre_commit_metadata(
+            &db,
+            param.sink_id,
+            epoch1,
+            Some(metadata.clone()),
+            Some(&schema_change),
+        )
+        .await
+        .unwrap();
+
+        let all_vnode = (0..VirtualNode::COUNT_FOR_TEST).collect_vec();
+        let mut builder = BitmapBuilder::zeroed(VirtualNode::COUNT_FOR_TEST);
+        for i in all_vnode {
+            builder.set(i, true);
+        }
+        let vnode = builder.finish();
+
+        // Keep the sender alive so that the coordinator keeps waiting for new committed epochs.
+        let epoch_sender = Arc::new(tokio::sync::Mutex::new(None));
+        let mock_subscriber: SinkCommittedEpochSubscriber = Arc::new(move |_sink_id: SinkId| {
+            let (sender, receiver) = unbounded_channel();
+            let epoch_sender = epoch_sender.clone();
+            async move {
+                *epoch_sender.lock().await = Some(sender);
+                Ok((epoch1, receiver))
+            }
+            .boxed()
+        });
+
+        let commits = Arc::new(std::sync::Mutex::new(vec![]));
+        let (manager, (_join_handle, _stop_tx)) =
+            SinkCoordinatorManager::start_worker_with_spawn_worker({
+                let db = db.clone();
+                let commits = commits.clone();
+                move |param, new_writer_rx| {
+                    let db = db.clone();
+                    let metadata = metadata.clone();
+                    let schema_change = schema_change.clone();
+                    let data_commits = commits.clone();
+                    let schema_change_commits = commits.clone();
+                    tokio::spawn({
+                        let subscriber = mock_subscriber.clone();
+                        async move {
+                            CoordinatorWorker::execute_coordinator(
+                                db,
+                                param,
+                                new_writer_rx,
+                                MockTwoPhaseCoordinator::new_coordinator(
+                                    move |_epoch, _metadata_list, _schema_change| {
+                                        Err(SinkError::Coordinator(anyhow!(
+                                            "pre_commit should not be called for a recovered pending epoch"
+                                        )))
+                                    },
+                                    move |epoch, commit_metadata| {
+                                        assert_eq!(epoch, epoch1);
+                                        assert_eq!(commit_metadata, metadata);
+                                        data_commits.lock().unwrap().push("data");
+                                        Ok(())
+                                    },
+                                    move |epoch, committed_schema_change| {
+                                        assert_eq!(epoch, epoch1);
+                                        assert_eq!(committed_schema_change, schema_change);
+                                        let mut commits = schema_change_commits.lock().unwrap();
+           
```

---

### Incident Patch 3: `6c08b672` (2026-11-11)
**Commit Message**: fix(stream): emit plain deletes and inserts for update pairs in delta join lookup (#27932)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/stream/src/executor/lookup/impl_.rs` (modified, +6/-1)
```diff
@@ -318,10 +318,15 @@ impl<S: StateStore, SD: ValueRowSerde> LookupExecutor<S, SD> {
                     );
 
                     for (op, row) in ops.iter().zip_eq_debug(chunk.rows()) {
+                        // A `U-`/`U+` pair can match many arrangement rows, which would be
+                        // emitted as `U-` x N followed by `U+` x N. Downstream expects every
+                        // `U-` to be directly followed by its `U+`, so emit plain `-`/`+`
+                        // instead, as the hash join does.
+                        let op = op.normalize_update();
                         for matched_row in self.lookup_one_row(&row, &metrics).await? {
                             tracing::debug!(target: "events::stream::lookup::put", "{:?} {:?}", row, matched_row);
 
-                            if let Some(chunk) = builder.append_row(*op, row, &matched_row) {
+                            if let Some(chunk) = builder.append_row(op, row, &matched_row) {
                                 yield Message::Chunk(chunk);
                             }
                         }
```

**File**: `src/stream/src/executor/lookup/tests.rs` (modified, +90/-11)
```diff
@@ -145,21 +145,26 @@ async fn create_arrangement<S: StateStore>(table_id: TableId, store: S) -> Execu
 /// | -  | 6     | 1    | 3       |
 /// | b  |       |      | 3 -> 4  |
 fn create_source() -> Executor {
+    create_source_with_chunks(
+        StreamChunk::from_pretty(
+            " I I
+            + 6 1",
+        ),
+        StreamChunk::from_pretty(
+            " I I
+            - 6 1",
+        ),
+    )
+}
+
+/// Create a test source with the same schema as [`create_source`], which yields `chunk1` in
+/// epoch 2 and `chunk2` in epoch 3.
+fn create_source_with_chunks(chunk1: StreamChunk, chunk2: StreamChunk) -> Executor {
     let columns = [
         ColumnDesc::named("join_column", 1.into(), DataType::Int64),
         ColumnDesc::named("rowid_column", 2.into(), DataType::Int64),
     ];
 
-    // Prepare source chunks.
-    let chunk1 = StreamChunk::from_pretty(
-        " I I
-        + 6 1",
-    );
-    let chunk2 = StreamChunk::from_pretty(
-        " I I
-        - 6 1",
-    );
-
     // Prepare stream executors.
     let schema = Schema::new(
         columns
@@ -183,7 +188,13 @@ async fn next_msg(buffer: &mut Vec<Message>, executor: &mut BoxedMessageStream)
 }
 
 fn check_chunk_eq(chunk1: &StreamChunk, chunk2: &StreamChunk) {
-    assert_eq!(format!("{:?}", chunk1), format!("{:?}", chunk2));
+    // The non-alternate `Debug` of `StreamChunk` only prints the cardinality, so compare the
+    // pretty-printed ops and rows instead. Rows matching the same join key come out of a hash set
+    // in the lookup cache, so their order is not deterministic; sort before comparing.
+    assert_eq!(
+        chunk1.clone().sort_rows().to_pretty().to_string(),
+        chunk2.clone().sort_rows().to_pretty().to_string()
+    );
 }
 
 fn create_storage_table_desc(table_id: TableId) -> risingwave_pb::plan_common::StorageTableDesc {
@@ -364,3 +375,71 @@ async fn test_lookup_last_epoch() {
     );
     check_chunk_eq(chunk2, &expected_chunk2);
 }
+
+/// An update pair on the stream side that matches several arrangement rows must not be emitted as
+/// `U-` x N followed by `U+` x N, since downstream (e.g. the hash dispatcher) requires each `U-` to
+/// be directly followed by its `U+`. It is emitted as plain deletes and inserts instead.
+#[tokio::test]
+async fn test_lookup_update_matches_multiple_rows() {
+    let table_id = TableId::new(1);
+    let store = prepare_hummock_store(table_id).await;
+    let arrangement = create_arrangement(table_id, store.clone()).await;
+    let stream = create_source_with_chunks(
+        StreamChunk::from_pretty(
+            " I I
+            + 6 1",
+        ),
+        StreamChunk::from_pretty(
+            "  I I
+            U- 6 1
+            U+ 6 2",
+        ),
+    );
+    let info = ExecutorInfo::for_test(
+        Schema::new(vec![
+            Field::with_name(DataType::Int64, "join_column"),
+            Field::with_name(DataType::Int64, "rowid_column"),
+            Field::with_name(DataType::Int64, "rowid_column"),
+            Field::with_name(DataType::Int64, "join_column"),
+        ]),
+        vec![1, 2],
+        "LookupExecutor".to_owned(),
+        0,
+    );
+    let lookup_executor = Box::new(LookupExecutor::new(LookupExecutorParams {
+        ctx: ActorContext::for_test(0),
+        info,
+        arrangement,
+        stream,
+        arrangement_col_descs: arrangement_col_descs(),
+        arrangement_order_rules: arrangement_col_arrange_rules_join_key(),
+        use_current_epoch: true,
+        stream_join_key_indices: vec![0],
+        arrange_join_key_indices: vec![1],
+        column_mapping: vec![2, 3, 0, 1],
+        state_table: create_replicated_state_table(store, table_id).await,
+        watermark_epoch: Arc::new(AtomicU64::new(0)),
+        chunk_size: 1024,
+    }));
+    let mut lookup_executor = lookup_executor.execute();
+
+    let mut msgs = vec![];
+    for _ in 0..5 {
+        next_msg(&mut msgs, &mut lookup_executor).await;
+    }
+
+    assert_matches!(msgs[0], Message::Barrier(_));
+    assert_matches!(msgs[2], Message::Barrier(_));
+    assert_matches!(msgs[4], Message::Barrier(_));
+
+    // In epoch 3, join key 6 matches rows 2334 and 2335 of the arrangement.
+    let chunk2 = msgs[3].as_chunk().unwrap();
+    let expected_chunk2 = StreamChunk::from_pretty(
+        "    I I I I
+        - 2334 6 6 1
+        - 2335 6 6 1
+        + 2334 6 6 2
+        + 2335 6 6 2",
+    );
+    check_chunk_eq(chunk2, &expected_chunk2);
+}
```

#### Recent Merged Pull Requests:
- **PR #27948** (2026-11-11): cherry-pick: fix(meta): keep periodic barrier timer and checkpoint counter untouched by discarded commands (release-3.0) (@anlowee)
- **PR #27939** (2026-11-11): feat(sink): make Turbopuffer sink a premium feature (@hzxa21)
- **PR #27938** (closed): Keep barrier timing and checkpoint state unchanged for discarded commands (@Copilot)
- **PR #27932** (2026-11-11): fix(stream): emit plain deletes and inserts for update pairs in delta join lookup (@chenzl25)
- **PR #27931** (closed): ci: enable parallel rustc frontend in ci-dev (@chenzl25)
- **PR #27929** (2026-11-10): perf(storage): binary search SST table boundaries (@Li0k)

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

## X. frontend): reject invalid rate limit in WITH options instead of panicking (#2790

**RULE**:
When implementing operations in `e2e_test/ddl/throttle.slt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in risingwavelabs/risingwave. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c4837fda`: frontend): reject invalid rate limit in WITH options instead of panicking (#27900). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `e2e_test/ddl/throttle.slt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# create with invalid backfill_rate_limit
statement error `backfill_rate_limit` must be a non-negative integer, but got `abc`
create materialized view mv1 with (backfill_rate_limit = 'abc') as select * from t1;

statement error `backfill_rate_limit` must be a non-negative integer, but got `-1`
create materialized view mv1 with (backfill_rate_limit = '-1') as select * from t1;

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c4837fda` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ekmas-neobrutalism-components-learnings.md`  
> **Source**: github ([https://github.com/ekmas/neobrutalism-components](https://github.com/ekmas/neobrutalism-components))  
> **Source Version**: `3306a802`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T01:16:19.071Z  
> **Learning ID**: `learn-github-ekmas-neobrutalism-components`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ekmas/neobrutalism-components

> **Canonical Artifact**: `07_PROJECT_LEARNING/ekmas-neobrutalism-components-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ekmas/neobrutalism-components](https://github.com/ekmas/neobrutalism-components))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T01:16:18.871Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ekmas/neobrutalism-components`
- **Description**: A collection of neobrutalism-styled Tailwind components.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5608 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/examples/ui/attachment/states.tsx`
```
import { AlertCircleIcon, FileTextIcon, UploadIcon, XIcon } from "lucide-react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Spinner } from "@/components/ui/spinner"

export default function AttachmentStatesDemo() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <Attachment state="idle" className="w-full">
        <AttachmentMedia>
          <UploadIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>Drop a file</AttachmentTitle>
          <AttachmentDescription>Waiting for a file</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
      <Attachment state="uploading" className="w-full">
        <AttachmentMedia>
          <Spinner />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>quarterly-report.pdf</AttachmentTitle>
          <AttachmentDescription>Uploading · 45%</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Cancel">
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
      <Attachment state="error" className="w-full">
        <AttachmentMedia>
          <AlertCircleIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>large-video.mp4</AttachmentTitle>
          <AttachmentDescription>File is too large</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Remove">
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
      <Attachment state="done" className="w-full">
        <AttachmentMedia>
          <FileTextIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>notes.md</AttachmentTitle>
          <AttachmentDescription>Markdown · 12 KB</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Remove">
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </div>
  )
}

```

### Core Architecture Module: `src/examples/ui/checkbox/invalid-state.tsx`
```
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"

export default function CheckboxInvalidStateDemo() {
  return (
    <FieldGroup className="mx-auto w-56">
      <Field orientation="horizontal" data-invalid>
        <Checkbox
          id="terms-checkbox-invalid"
          name="terms-checkbox-invalid"
          aria-invalid
        />
        <FieldLabel htmlFor="terms-checkbox-invalid">
          Accept terms and conditions
        </FieldLabel>
      </Field>
    </FieldGroup>
  )
}

```

### Core Architecture Module: `src/hooks/use-mobile.ts`
```
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

```

### Core Architecture Module: `src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function addSpaces(name: string) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2")
}

export function transformToSlug(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "-")
}

export function transformToName(input: string): string {
  return input
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function transformToPascalCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("")
}

```

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  plugins: [
    "prettier-plugin-tailwindcss",
    "@ianvs/prettier-plugin-sort-imports",
  ],
  semi: false,
  endOfLine: "lf",
  singleQuote: false,
  trailingComma: "all",
  tabWidth: 2,
  importOrder: [
    "<THIRD_PARTY_MODULES>",
    "",
    "^(react/(.*)$)|^(react$)",
    "^(next/(.*)$)|^(next$)",
    "",
    "^@/data/(.*)$",
    "",
    "^@/layouts/(.*)$",
    "^@/components/(.*)$",
    "",
    "^@/app/(.*)$",
    "",
    "^@/lib/(.*)$",
    "",
    "^[./]",
  ],
}

```

### Core Architecture Module: `next.config.mjs`
```
import createMDX from "@next/mdx"

const withMDX = createMDX({
  extension: /\.mdx?$/,
})

/** @type {import('next').NextConfig} */
const nextConfig = withMDX({
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  async redirects() {
    return [
      {
        source: "/docs/migrating-from-v3",
        destination: "/docs/migrating-to-base-ui",
        permanent: true,
      },
      {
        source: "/components/:slug*",
        destination: "/docs/:slug*",
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://eu.i.posthog.com/decide",
      },
    ]
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
})

const isDev = process.argv.indexOf("dev") !== -1
const isBuild = process.argv.indexOf("build") !== -1
if (!process.env.VELITE_STARTED && (isDev || isBuild)) {
  process.env.VELITE_STARTED = "1"
  const { build } = await import("velite")
  await build({ watch: isDev, clean: !isDev })
}

export default nextConfig

```

### Core Architecture Module: `postcss.config.js`
```
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}

```

### Core Architecture Module: `src/app/charts/examples.tsx`
```
import { ChartExample, charts } from "@/data/charts"

import { Pre } from "@/components/app/pre"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function Examples() {
  return (
    <div>
      <div className="grid flex-1 gap-12">
        <h2 className="sr-only">Examples</h2>
        <div
          id="examples"
          className="grid flex-1 scroll-mt-20 items-start gap-10 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:gap-10"
        >
          {[
            charts.find((chart) => chart.name === "ChartAreaStacked"),
            charts.find((chart) => chart.name === "ChartBarMultiple"),
            charts.find((chart) => chart.name === "ChartPieDonutText"),
          ].map((chart) => {
            if (!chart) return null
            return (
              <ChartComponent chart={chart} key={chart.name}>
                <chart.component />
              </ChartComponent>
            )
          })}
        </div>
        <div
          id="area-chart"
          className="grid flex-1 scroll-mt-20 items-start gap-10 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:gap-10"
        >
          {[
            charts.find((chart) => chart.name === "ChartAreaDefault"),
            charts.find((chart) => chart.name === "ChartAreaLinear"),
            charts.find((chart) => chart.name === "ChartAreaStep"),
            charts.find((chart) => chart.name === "ChartAreaStackedExpand"),
            charts.find((chart) => chart.name === "ChartAreaLegend"),
            charts.find((chart) => chart.name === "ChartAreaIcons"),
            charts.find((chart) => chart.name === "ChartAreaAxes"),
          ].map((chart) => {
            if (!chart) return null
            return (
              <ChartComponent chart={chart} key={chart.name}>
                <chart.component />
              </ChartComponent>
            )
          })}
          <div className="md:col-span-2 lg:col-span-3">
            {(() => {
              const chart = charts.find(
                (chart) => chart.name === "ChartAreaInteractive",
              )
              if (!chart) return null
              return (
                <ChartComponent chart={chart} key={chart.name}>
                  <chart.component />
                </ChartComponent>
              )
            })()}
          </div>
        </div>
        <div
          id="bar-chart"
          className="grid flex-1 scroll-mt-20 items-start gap-10 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:gap-10"
        >
          {[
            charts.find((chart) => chart.name === "ChartBarDefault"),
            charts.find((chart) => chart.name === "ChartBarHorizontal"),
            charts.find((chart) => chart.name === "ChartBarMultiple"),
            charts.find((chart) => chart.name === "ChartBarLabel"),
            charts.find((chart) => chart.name === "ChartBarLabelCustom"),
            charts.find((chart) => chart.name === "ChartBarMixed"),
            charts.find((chart) => chart.name === "ChartBarStacked"),
            charts.find((chart) => chart.name === "ChartBarActive"),
            charts.find((chart) => chart.name === "ChartBarNegative"),
          ].map((chart) => {
            if (!chart) return null
            return (
              <ChartComponent chart={chart} key={chart.name}>
                <chart.component />
              </ChartComponent>
            )
          })}
          <div className="md:col-span-2 lg:col-span-3">
            {(() => {
              const chart = charts.find(
                (chart) => chart.name === "ChartBarInteractive",
              )
              if (!chart) return null
              return (
                <ChartComponent chart={chart} key={chart.name}>
                  <chart.component />
                </ChartComponent>
              )
            })()}
          </div>
        </div>
        <div
          id="line-chart"
          className="grid flex-1 scroll-mt-20 items-start gap-10 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:gap-10"
        >
          {[
            charts.find((chart) => chart.name === "ChartLineDefault"),
            charts.find((chart) => chart.name === "ChartLineLinear"),
            charts.find((chart) => chart.name === "ChartLineStep"),
            charts.find((chart) => chart.name === "ChartLineMultiple"),
            charts.find((chart) => chart.name === "ChartLineDots"),
            charts.find((chart) => chart.name === "ChartLineDotsCustom"),
            charts.find((chart) => chart.name === "ChartLineDotsColors"),
            charts.find((chart) => chart.name === "ChartLineLabel"),
            charts.find((chart) => chart.name === "ChartLineLabelCustom"),
          ].map((chart) => {
            if (!chart) return null
            return (
              <ChartComponent chart={chart} key={chart.name}>
                <chart.component />
              </ChartComponent>
            )
          })}
          <div className="md:col-span-2 lg:col-span-3">
            {(() => {
              const chart = charts.find(
                (chart) => chart.name === "ChartLineInteractive",
              )
              if (!chart) return null
              return (
                <ChartComponent chart={chart} key={chart.name}>
                  <chart.component />
                </ChartComponent>
              )
            })()}
          </div>
        </div>
        <div
          id="pie-chart"
          className="grid flex-1 scroll-mt-20 items-start gap-10 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:gap-10"
        >
          {[
            charts.find((chart) => chart.name === "ChartPieSimple"),
            charts.find((chart) => chart.name === "ChartPieLabel"),
            charts.find((chart) => chart.name === "ChartPieLabelCustom"),
            charts.find((chart) => chart.name === "ChartPieLabelList"),
            charts.find((chart) => chart.name === "ChartPieLegend"),
            charts.find((chart) => chart.name === "ChartPieDonut"),
            charts.find((chart) => chart.name === "ChartPieDonutActive"),
            charts.find((chart) => chart.name === "ChartPieDonutText"),
            charts.find((chart) => chart.name === "ChartPieStacked"),
          ].map((chart) => {
            if (!chart) return null
            return (
              <ChartComponent chart={chart} key={chart.name}>
                <chart.component />
              </ChartComponent>
            )
          })}
        </div>
        <div
          id="tooltip"
          className="chart-wrapper grid flex-1 scroll-mt-20 items-start gap-10 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:gap-10"
        >
          {[
            charts.find((chart) => chart.name === "ChartTooltipDefault"),
            charts.find((chart) => chart.name === "ChartTooltipIndicatorLine"),
            charts.find((chart) => chart.name === "ChartTooltipIndicatorNone"),
            charts.find((chart) => chart.name === "ChartTooltipLabelCustom"),
            charts.find((chart) => chart.name === "ChartTooltipLabelFormatter"),
            charts.find((chart) => chart.name === "ChartTooltipLabelNone"),
            charts.find((chart) => chart.name === "ChartTooltipFormatter"),
            charts.find((chart) => chart.name === "ChartTooltipIcons"),
            charts.find((chart) => chart.name === "ChartTooltipAdvanced"),
          ].map((chart) => {
            if (!chart) return null
            return (
              <ChartComponent chart={chart} key={chart.name}>
                <chart.component />
              </ChartComponent>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const ChartComponent = ({
  children,
  chart,
}: {
  children: React.ReactNode
  chart: ChartExample
}) => {
  const { code, name } = chart
  return (
    <div>
      {children}
      <Dialog>
        <DialogTrigger render={<Button className="mt-5 w-full" />}>
          Copy
        </DialogTrigger>
        <DialogContent className="max-w-full">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
          </DialogHeader>
          <Pre
            wrapperClassName="w-full max-w-full text-white overflow-x-auto"
            __rawstring__={code}
          >
            {code}
          </Pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}

```

### Core Architecture Module: `src/app/charts/page.tsx`
```
import { Metadata } from "next"
import Link from "next/link"

import {
  PageDescription,
  PageHeader,
  PageHeading,
  PageWrapper,
} from "@/components/app/page"

import Examples from "./examples"

export const metadata: Metadata = {
  title: "Charts",
  description:
    "Beautiful charts. Built using Recharts. Copy and paste into your apps.",
}

export default function Page() {
  return (
    <PageWrapper>
      <PageHeader>
        <PageHeading>Charts</PageHeading>

        <PageDescription>
          Beautiful charts. Built using Recharts. Copy and paste into your apps.{" "}
          <br />
          Visit{" "}
          <Link className="underline" href="/docs/chart">
            charts docs
          </Link>{" "}
          for more info.
        </PageDescription>
      </PageHeader>

      <Examples />
    </PageWrapper>
  )
}

```

### Core Architecture Module: `src/app/layout.tsx`
```
import "@/styling/globals.css"

import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"

import Navbar from "@/components/app/navbar"
import ScrollToTop from "@/components/app/scroll-to-top"
import SetStylingPref from "@/components/app/set-styling-pref"

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-dm-sans",
})

export const metadata: Metadata = {
  title: {
    default:
      "Neobrutalism components - Start making neobrutalism layouts today",
    template: `%s - Neobrutalism components`,
  },
  description:
    "A collection of neobrutalism-styled components based on shadcn/ui.",
  keywords: [
    "neobrutalism",
    "neobrutalism components",
    "neobrutalism tailwind",
    "react neobrutalism",
    "react tailwind components",
    "shadcn components",
    "shadcn neobrutalism",
  ],
  authors: [{ name: "Samuel Breznjak", url: "https://github.com/ekmas" }],
  openGraph: {
    type: "website",
    description:
      "A collection of neobrutalism-styled components based on shadcn/ui.",
    images: ["https://www.neobrutalism.dev/preview.png"],
    url: "https://www.neobrutalism.dev/",
    title: "Neobrutalism components",
  },
  metadataBase: new URL("https://www.neobrutalism.dev/"),
  twitter: {
    card: "summary_large_image",
    title: "Neobrutalism components - Start making neobrutalism layouts",
    description:
      "A collection of neobrutalism-styled components based on shadcn/ui.",
    images: ["https://www.neobrutalism.dev/preview.png"],
    creator: "@samuelbreznjak",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html className={`${dmSans.variable} scroll-smooth`} lang="en">
      <body className="isolate">
        <Navbar />
        {children}
        <SetStylingPref />
        <ScrollToTop />
      </body>
    </html>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #117** (2026-09-14): **Base UI**
  *Symptoms*: Huge update: - added base ui - removed dark mode - added duotone color palettes - other qol changes
  **Post-Mortem & Fix Analysis**:
  > [vc]: #02aA+JLh6y84mIKoursTIsLt3PM3Yucf8hYoIid3DXQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJuZW9icnV0YWxpc20tY29tcG9uZW50cyIsInByb2plY3RJZCI6InByal9rUDNnaHNBYUxxQ0dGQzlaaGNoRXNCT0NzNjV0IiwidjAiOmZhbHNlLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoibmVvYnJ1dGFsaXNtLWNvbXBvbmVudHMtZ2l0LWJhc2UtdWktc2FtdWVsYnJlem5qYWtzLXByb2plY3RzLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3NhbXVlbGJyZXpuamFrcy1wcm9qZWN0cy9uZW9icnV0YWxpc20tY29tcG9uZW50cy83VUF3UzhtckNKSHlaQ1Jlb3FaU2NCaXlUcUJmIiwicHJldmlld1VybCI6Im5lb2JydXRhbGlzbS1jb21wb25lbnRzLWdpdC1iYXNlLXVpLXNhbXVlbGJyZXpuamFrcy1wcm9qZWN0cy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwicm9vdERpcmVjdG9yeSI6bnVsbH1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1la21hcyZyZXBvPW5lb2JydXRhbGlzbS1jb21wb25lbnRzJnByPTExNyJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://verce

- **Issue #116** (2026-08-02): **added sidebar promo link**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #ft8dAgv+dA4GWsGvHVA5LyfDjwMVry40xe+zhUz8i7s=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJuZW9icnV0YWxpc20tY29tcG9uZW50cyIsInByb2plY3RJZCI6InByal9rUDNnaHNBYUxxQ0dGQzlaaGNoRXNCT0NzNjV0IiwidjAiOmZhbHNlLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoibmVvYnJ1dGFsaXNtLWNvbXBvbmVudHMtZ2l0LXNpZC01Y2ZkMzktc2FtdWVsYnJlem5qYWtzLXByb2plY3RzLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3NhbXVlbGJyZXpuamFrcy1wcm9qZWN0cy9uZW9icnV0YWxpc20tY29tcG9uZW50cy8zR3g5U2NHV3VGajNXRzF6Mk1wTmtyQnp2eHFUIiwicHJldmlld1VybCI6Im5lb2JydXRhbGlzbS1jb21wb25lbnRzLWdpdC1zaWQtNWNmZDM5LXNhbXVlbGJyZXpuamFrcy1wcm9qZWN0cy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1la21hcyZyZXBvPW5lb2JydXRhbGlzbS1jb21wb25lbnRzJnByPTExNiJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-

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

### Incident Patch 1: `3306a802` (2026-09-14)
**Commit Message**: Merge pull request #117 from ekmas/base-ui

Base UI

**File**: `README.md` (modified, +0/-3)
```diff
@@ -1,6 +1,3 @@
-# no longer maintained
-read [this](https://github.com/ekmas/neobrutalism-components/discussions/100) for more info
-
 # Neobrutalism components
 
 <img src="public/preview.png" alt="preview">
```

**File**: `next.config.mjs` (modified, +5/-0)
```diff
@@ -9,6 +9,11 @@ const nextConfig = withMDX({
   pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
   async redirects() {
     return [
+      {
+        source: "/docs/migrating-from-v3",
+        destination: "/docs/migrating-to-base-ui",
+        permanent: true,
+      },
       {
         source: "/components/:slug*",
         destination: "/docs/:slug*",
```

**File**: `package.json` (modified, +18/-42)
```diff
@@ -14,82 +14,58 @@
     "format:check": "prettier --check \"**/*.{ts,tsx,js}\""
   },
   "dependencies": {
+    "@base-ui/react": "^1.8.0",
     "@devnomic/marquee": "^1.0.2",
     "@hookform/resolvers": "^3.3.4",
     "@ianvs/prettier-plugin-sort-imports": "^4.2.1",
     "@mdx-js/loader": "^3.1.0",
     "@mdx-js/react": "^3.1.0",
     "@next/mdx": "^15.2.1",
-    "@radix-ui/react-accordion": "^1.2.3",
-    "@radix-ui/react-alert-dialog": "^1.1.6",
-    "@radix-ui/react-avatar": "^1.1.3",
-    "@radix-ui/react-checkbox": "^1.1.4",
-    "@radix-ui/react-collapsible": "^1.1.3",
-    "@radix-ui/react-context-menu": "^2.2.6",
-    "@radix-ui/react-dialog": "^1.1.6",
-    "@radix-ui/react-dropdown-menu": "^2.1.6",
-    "@radix-ui/react-hover-card": "^1.1.6",
-    "@radix-ui/react-label": "^2.1.2",
-    "@radix-ui/react-menubar": "^1.1.6",
-    "@radix-ui/react-navigation-menu": "^1.2.5",
-    "@radix-ui/react-popover": "^1.1.6",
-    "@radix-ui/react-progress": "^1.1.2",
-    "@radix-ui/react-radio-group": "^1.2.3",
-    "@radix-ui/react-scroll-area": "^1.2.3",
-    "@radix-ui/react-select": "^2.1.6",
-    "@radix-ui/react-slider": "^1.2.3",
-    "@radix-ui/react-slot": "^1.1.2",
-    "@radix-ui/react-switch": "^1.1.3",
-    "@radix-ui/react-tabs": "^1.1.3",
-    "@radix-ui/react-toast": "^1.2.6",
-    "@radix-ui/react-tooltip": "^1.1.8",
+    "@shadcn/react": "^0.3.1",
     "@shikijs/compat": "^2.5.0",
     "@stefanprobst/rehype-extract-toc": "^2.2.1",
-    "@tailwindcss/postcss": "^4.0.9",
+    "@tailwindcss/postcss": "^4.3.3",
     "@tailwindcss/typography": "^0.5.11",
-    "@tanstack/react-table": "^8.15.3",
+    "@tanstack/react-table": "^9.2.4",
     "@types/mdx": "^2.0.13",
     "@types/node": "20.4.5",
     "@types/react": "19.0.10",
     "@types/react-dom": "19.0.4",
-    "class-variance-authority": "^0.7.0",
+    "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
-    "cmdk": "^1.0.4",
-    "date-fns": "^3.6.0",
-    "embla-carousel-react": "^8.0.0",
+    "cmdk": "^1.1.1",
+    "date-fns": "^4.4.0",
+    "embla-carousel-react": "^8.6.0",
     "eslint": "8.45.0",
     "eslint-config-next": "15.2.0",
     "eslint-config-prettier": "^8.8.0",
     "fs": "^0.0.1-security",
-    "input-otp": "^1.2.4",
-    "lucide-react": "^0.477.0",
+    "input-otp": "^1.5.0",
+    "lucide-react": "^1.42.0",
     "next": "15.2.8",
-    "next-themes": "^0.3.0",
     "path": "^0.12.7",
     "postcss": "8.4.27",
     "prettier": "^3.4.2",
     "prettier-plugin-tailwindcss": "^0.6.11",
     "react": "19.0.0",
-    "react-day-picker": "^8.10.0",
+    "react-day-picker": "^9.14.0",
     "react-dom": "19.0.0",
-    "react-hook-form": "^7.51.2",
-    "react-resizable-panels": "^2.0.16",
-    "recharts": "^2.15.3",
+    "react-hook-form": "^7.87.0",
+    "react-resizable-panels": "^4.12.4",
+    "recharts": "^3.10.1",
     "rehype-pretty-code": "^0.14.0",
     "rehype-slug": "^6.0.0",
     "remark-code-import": "^1.2.0",
     "shadcn": "2.3.0",
     "shiki": "^1.29.2",
-    "sonner": "^2.0.1",
-    "tailwind-merge": "^3.0.2",
-    "tailwindcss": "4.0.9",
+    "tailwind-merge": "^3.6.0",
+    "tailwindcss": "4.3.3",
     "tsx": "^4.19.2",
-    "tw-animate-css": "^1.2.5",
+    "tw-animate-css": "^1.4.0",
     "typescript": "5.1.6",
     "unist-util-visit": "^5.0.0",
-    "vaul": "^0.9.0",
     "velite": "^0.2.2",
-    "zod": "^3.22.4"
+    "zod": "^3.25.76"
   },
   "overrides": {
     "react-is": "19.0.0"
```

**File**: `public/r/accordion.json` (modified, +2/-2)
```diff
@@ -4,12 +4,12 @@
   "type": "registry:ui",
   "title": "Accordion",
   "dependencies": [
-    "@radix-ui/react-accordion"
+    "@base-ui/react"
   ],
   "files": [
     {
       "path": "src/components/ui/accordion.tsx",
-      "content": "\"use client\"\r\n\r\nimport * as AccordionPrimitive from \"@radix-ui/react-accordion\"\r\nimport { ChevronDown } from \"lucide-react\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nfunction Accordion({\r\n  ...props\r\n}: React.ComponentProps<typeof AccordionPrimitive.Root>) {\r\n  return <AccordionPrimitive.Root data-slot=\"accordion\" {...props} />\r\n}\r\n\r\nfunction AccordionItem({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AccordionPrimitive.Item>) {\r\n  return (\r\n    <AccordionPrimitive.Item\r\n      data-slot=\"accordion-item\"\r\n      className={cn(\r\n        \"rounded-base overflow-hidden border-2 border-b border-border shadow-shadow\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AccordionTrigger({\r\n  className,\r\n  children,\r\n  ...props\r\n}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {\r\n  return (\r\n    <AccordionPrimitive.Header className=\"flex\">\r\n      <AccordionPrimitive.Trigger\r\n        data-slot=\"accordion-trigger\"\r\n        className={cn(\r\n          \"flex flex-1 items-center justify-between text-left text-base text-main-foreground border-border focus-visible:ring-[3px] bg-main p-4 font-heading transition-all [&[data-state=open]>svg]:rotate-180 data-[state=open]:rounded-b-none data-[state=open]:border-b-2 disabled:pointer-events-none disabled:opacity-50\",\r\n          className,\r\n        )}\r\n        {...props}\r\n      >\r\n        {children}\r\n        <ChevronDown className=\"pointer-events-none size-5 shrink-0 transition-transform duration-200\" />\r\n      </AccordionPrimitive.Trigger>\r\n    </AccordionPrimitive.Header>\r\n  )\r\n}\r\n\r\nfunction AccordionContent({\r\n  className,\r\n  children,\r\n  ...props\r\n}: React.ComponentProps<typeof AccordionPrimitive.Content>) {\r\n  return (\r\n    <AccordionPrimitive.Content\r\n      data-slot=\"accordion-content\"\r\n      className=\"overflow-hidden rounded-b-base bg-secondary-background text-sm font-base transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down\"\r\n      {...props}\r\n    >\r\n      <div className={cn(\"p-4\", className)}>{children}</div>\r\n    </AccordionPrimitive.Content>\r\n  )\r\n}\r\n\r\nAccordionContent.displayName = AccordionPrimitive.Content.displayName\r\n\r\nexport { Accordion, AccordionItem, AccordionTrigger, AccordionContent }\r\n",
+      "content": "\"use client\"\n\nimport { Accordion as AccordionPrimitive } from \"@base-ui/react/accordion\"\nimport { ChevronDown } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Accordion({\n  ...props\n}: React.ComponentProps<typeof AccordionPrimitive.Root>) {\n  return <AccordionPrimitive.Root data-slot=\"accordion\" {...props} />\n}\n\nfunction AccordionItem({\n  className,\n  ...props\n}: React.ComponentProps<typeof AccordionPrimitive.Item>) {\n  return (\n    <AccordionPrimitive.Item\n      data-slot=\"accordion-item\"\n      className={cn(\n        \"rounded-base overflow-hidden border-2 border-b border-border shadow-shadow\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AccordionTrigger({\n  className,\n  children,\n  ...props\n}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {\n  return (\n    <AccordionPrimitive.Header className=\"flex\">\n      <AccordionPrimitive.Trigger\n        data-slot=\"accordion-trigger\"\n        className={cn(\n          \"flex flex-1 items-center justify-between text-left text-base text-main-foreground border-border focus-visible:ring-[3px] bg-main p-4 font-heading transition-all [&[data-panel-open]>svg]:rotate-180 data-panel-open:rounded-b-none data-panel-open:border-b-2 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50\",\n          className,\n        )}\n        {...props}\n      >\n        {children}\n        <ChevronDown className=\"pointer-events-none size-5 shrink-0 transition-transform duration-200\" />\n      </AccordionPrimitive.Trigger>\n    </AccordionPrimitive.Header>\n  )\n}\n\nfunction AccordionContent({\n  className,\n  children,\n  ...props\n}: React.ComponentProps<typeof AccordionPrimitive.Panel>) {\n  return (\n    <AccordionPrimitive.Panel\n      data-slot=\"accordion-content\"\n      className=\"h-(--accordion-panel-height) overflow-hidden rounded-b-base bg-secondary-background text-sm font-base transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0\"\n      {...props}\n    >\n      <div className={cn(\"p-4\", className)}>{children}</div>\n    </AccordionPrimitive.Panel>\n  )\n}\n\nexport { Ac
```

**File**: `public/r/alert-dialog.json` (modified, +2/-2)
```diff
@@ -4,15 +4,15 @@
   "type": "registry:ui",
   "title": "Alert dialog",
   "dependencies": [
-    "@radix-ui/react-alert-dialog"
+    "@base-ui/react"
   ],
   "registryDependencies": [
     "https://neobrutalism.dev/r/nbutton.json"
   ],
   "files": [
     {
       "path": "src/components/ui/alert-dialog.tsx",
-      "content": "\"use client\"\r\n\r\nimport * as AlertDialogPrimitive from \"@radix-ui/react-alert-dialog\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { buttonVariants } from \"@/components/ui/button\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nfunction AlertDialog({\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {\r\n  return <AlertDialogPrimitive.Root data-slot=\"alert-dialog\" {...props} />\r\n}\r\n\r\nfunction AlertDialogTrigger({\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {\r\n  return (\r\n    <AlertDialogPrimitive.Trigger data-slot=\"alert-dialog-trigger\" {...props} />\r\n  )\r\n}\r\n\r\nfunction AlertDialogPortal({\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {\r\n  return (\r\n    <AlertDialogPrimitive.Portal data-slot=\"alert-dialog-portal\" {...props} />\r\n  )\r\n}\r\n\r\nfunction AlertDialogOverlay({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {\r\n  return (\r\n    <AlertDialogPrimitive.Overlay\r\n      data-slot=\"alert-dialog-overlay\"\r\n      className={cn(\r\n        \"fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AlertDialogContent({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {\r\n  return (\r\n    <AlertDialogPortal>\r\n      <AlertDialogOverlay />\r\n      <AlertDialogPrimitive.Content\r\n        data-slot=\"alert-dialog-content\"\r\n        className={cn(\r\n          \"bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-base border-2 border-border p-6 shadow-shadow duration-200 sm:max-w-lg\",\r\n          className,\r\n        )}\r\n        {...props}\r\n      />\r\n    </AlertDialogPortal>\r\n  )\r\n}\r\n\r\nfunction AlertDialogHeader({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"alert-dialog-header\"\r\n      className={cn(\"flex flex-col gap-2 text-center sm:text-left\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AlertDialogFooter({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"alert-dialog-footer\"\r\n      className={cn(\r\n        \"flex flex-col-reverse gap-3 sm:flex-row sm:justify-end\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AlertDialogTitle({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {\r\n  return (\r\n    <AlertDialogPrimitive.Title\r\n      data-slot=\"alert-dialog-title\"\r\n      className={cn(\"text-lg font-heading\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AlertDialogDescription({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {\r\n  return (\r\n    <AlertDialogPrimitive.Description\r\n      data-slot=\"alert-dialog-description\"\r\n      className={cn(\"text-sm font-base text-foreground\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AlertDialogAction({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {\r\n  return (\r\n    <AlertDialogPrimitive.Action\r\n      className={cn(buttonVariants(), className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AlertDialogCancel({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {\r\n  return (\r\n    <AlertDialogPrimitive.Cancel\r\n      className={cn(buttonVariants({ variant: \"neutral\" }), className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nexport {\r\n  AlertDialog,\r\n  AlertDialogPortal,\r\n  AlertDialogOverlay,\r\n  AlertDialogTrigger,\r\n  AlertDialogContent,\r\n  AlertDialogHeader,\r\n  AlertDialogFooter,\r\n  AlertDialogTitle,\r\n  AlertDialogDescription,\r\n  AlertDialogAction,\r\n  AlertDialogCancel,\r\n}\r\n",
+      "content": "\"use client\"\n\nimport { AlertDialog as AlertDialogPrimitive } from \"@base-ui/react/alert-dialog\"\nimport { type VariantProps } from \"class-variance-authority\"\n\nimport * as React from \"react\"\n\nimport { buttonVariants }
```

**File**: `public/r/alert.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "files": [
     {
       "path": "src/components/ui/alert.tsx",
-      "content": "import { cva, type VariantProps } from \"class-variance-authority\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nconst alertVariants = cva(\r\n  \"relative w-full rounded-base border-2 border-border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current shadow-shadow\",\r\n  {\r\n    variants: {\r\n      variant: {\r\n        default: \"bg-main text-main-foreground\",\r\n        destructive: \"bg-black text-white\",\r\n      },\r\n    },\r\n    defaultVariants: {\r\n      variant: \"default\",\r\n    },\r\n  },\r\n)\r\n\r\nfunction Alert({\r\n  className,\r\n  variant,\r\n  ...props\r\n}: React.ComponentProps<\"div\"> & VariantProps<typeof alertVariants>) {\r\n  return (\r\n    <div\r\n      data-slot=\"alert\"\r\n      role=\"alert\"\r\n      className={cn(alertVariants({ variant }), className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AlertTitle({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"alert-title\"\r\n      className={cn(\r\n        \"col-start-2 line-clamp-1 min-h-4 font-heading tracking-tight\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AlertDescription({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"alert-description\"\r\n      className={cn(\r\n        \"col-start-2 grid justify-items-start gap-1 text-sm font-base [&_p]:leading-relaxed\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nexport { Alert, AlertTitle, AlertDescription }\r\n",
+      "content": "import { cva, type VariantProps } from \"class-variance-authority\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst alertVariants = cva(\n  \"relative w-full rounded-base border-2 border-border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current shadow-shadow\",\n  {\n    variants: {\n      variant: {\n        default: \"bg-background text-foreground\",\n        destructive: \"bg-black text-white\",\n      },\n    },\n    defaultVariants: {\n      variant: \"default\",\n    },\n  },\n)\n\nfunction Alert({\n  className,\n  variant,\n  ...props\n}: React.ComponentProps<\"div\"> & VariantProps<typeof alertVariants>) {\n  return (\n    <div\n      data-slot=\"alert\"\n      role=\"alert\"\n      className={cn(alertVariants({ variant }), className)}\n      {...props}\n    />\n  )\n}\n\nfunction AlertTitle({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"alert-title\"\n      className={cn(\n        \"col-start-2 line-clamp-1 min-h-4 font-heading tracking-tight\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AlertDescription({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"alert-description\"\n      className={cn(\n        \"col-start-2 grid justify-items-start gap-1 text-sm font-base [&_p]:leading-relaxed\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport { Alert, AlertTitle, AlertDescription }\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/attachment.json` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+{
+  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
+  "name": "attachment",
+  "type": "registry:ui",
+  "title": "Attachment",
+  "dependencies": [
+    "@base-ui/react",
+    "class-variance-authority"
+  ],
+  "registryDependencies": [
+    "https://neobrutalism.dev/r/nbutton.json"
+  ],
+  "files": [
+    {
+      "path": "src/components/ui/attachment.tsx",
+      "content": "\"use client\"\n\nimport { mergeProps } from \"@base-ui/react/merge-props\"\nimport { useRender } from \"@base-ui/react/use-render\"\nimport { cva, type VariantProps } from \"class-variance-authority\"\n\nimport * as React from \"react\"\n\nimport { Button } from \"@/components/ui/button\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst attachmentVariants = cva(\n  \"group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-base border-2 border-border bg-background text-foreground font-base transition-colors focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2 has-[>a,>button]:hover:bg-secondary-background data-[state=error]:bg-black data-[state=error]:text-white data-[state=idle]:border-dashed\",\n  {\n    variants: {\n      size: {\n        default:\n          \"gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2\",\n        sm: \"gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5\",\n        xs: \"gap-1.5 text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1\",\n      },\n      orientation: {\n        horizontal: \"min-w-40 items-center\",\n        vertical: \"w-24 flex-col has-data-[slot=attachment-content]:w-30\",\n      },\n    },\n  },\n)\n\nfunction Attachment({\n  className,\n  state = \"done\",\n  size = \"default\",\n  orientation = \"horizontal\",\n  ...props\n}: React.ComponentProps<\"div\"> &\n  VariantProps<typeof attachmentVariants> & {\n    state?: \"idle\" | \"uploading\" | \"processing\" | \"error\" | \"done\"\n  }) {\n  return (\n    <div\n      data-slot=\"attachment\"\n      data-state={state}\n      data-size={size}\n      data-orientation={orientation}\n      className={cn(attachmentVariants({ size, orientation }), className)}\n      {...props}\n    />\n  )\n}\n\nconst attachmentMediaVariants = cva(\n  \"relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-base border-2 border-border bg-secondary-background text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[state=error]/attachment:text-black group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5\",\n  {\n    variants: {\n      variant: {\n        icon: \"\",\n        image:\n          \"opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover\",\n      },\n    },\n    defaultVariants: {\n      variant: \"icon\",\n    },\n  },\n)\n\nfunction AttachmentMedia({\n  className,\n  variant = \"icon\",\n  ...props\n}: React.ComponentProps<\"div\"> & VariantProps<typeof attachmentMediaVariants>) {\n  return (\n    <div\n      data-slot=\"attachment-media\"\n      data-variant={variant}\n      className={cn(attachmentMediaVariants({ variant }), className)}\n      {...props}\n    />\n  )\n}\n\nfunction AttachmentContent({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"attachment-content\"\n      className={cn(\n        \"max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AttachmentTitle({\n  className,\n  ...props\n}: React.ComponentProps<\"span\">) {\n  return (\n    <span\n      data-slot=\"attachment-title\"\n      className={cn(\n        \"block max-w-full min-w-0 truncate font-heading group-data-[state=processing]/attachment:animate-pulse group-data-[state=uploading]/attachment:animate-pulse\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AttachmentDescription({\n  className,\n  ...props\n}: React.ComponentProps<\"span\">) {\n  return (\n    <span\n      data-slot=\"attachment-description\"\n      className={cn(\n        \"mt-0.5 block min-w-0 truncate text-xs text-foreground group-data-[state=error]/attachment:text-white\",\n        \"max-w-full\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AttachmentActions({\n  className,\n  ...props\n}: Re
```

**File**: `public/r/avatar.json` (modified, +2/-2)
```diff
@@ -4,12 +4,12 @@
   "type": "registry:ui",
   "title": "Avatar",
   "dependencies": [
-    "@radix-ui/react-avatar"
+    "@base-ui/react"
   ],
   "files": [
     {
       "path": "src/components/ui/avatar.tsx",
-      "content": "\"use client\"\r\n\r\nimport * as AvatarPrimitive from \"@radix-ui/react-avatar\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nfunction Avatar({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AvatarPrimitive.Root>) {\r\n  return (\r\n    <AvatarPrimitive.Root\r\n      data-slot=\"avatar\"\r\n      className={cn(\r\n        \"relative flex size-10 shrink-0 overflow-hidden rounded-full outline-2 outline-border\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AvatarImage({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AvatarPrimitive.Image>) {\r\n  return (\r\n    <AvatarPrimitive.Image\r\n      data-slot=\"avatar-image\"\r\n      className={cn(\"aspect-square size-full\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction AvatarFallback({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {\r\n  return (\r\n    <AvatarPrimitive.Fallback\r\n      data-slot=\"avatar-fallback\"\r\n      className={cn(\r\n        \"flex size-full items-center justify-center rounded-full bg-secondary-background text-foreground font-base\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nexport { Avatar, AvatarImage, AvatarFallback }\r\n",
+      "content": "\"use client\"\n\nimport { Avatar as AvatarPrimitive } from \"@base-ui/react/avatar\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst avatarSizes = {\n  sm: \"size-8\",\n  default: \"size-10\",\n  lg: \"size-12\",\n}\n\nfunction Avatar({\n  className,\n  size = \"default\",\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Root> & {\n  size?: \"default\" | \"sm\" | \"lg\"\n}) {\n  return (\n    <AvatarPrimitive.Root\n      data-slot=\"avatar\"\n      data-size={size}\n      className={cn(\n        \"group/avatar relative flex shrink-0 rounded-full outline-2 outline-border\",\n        avatarSizes[size],\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarImage({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Image>) {\n  return (\n    <AvatarPrimitive.Image\n      data-slot=\"avatar-image\"\n      className={cn(\"aspect-square size-full rounded-full\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarFallback({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {\n  return (\n    <AvatarPrimitive.Fallback\n      data-slot=\"avatar-fallback\"\n      className={cn(\n        \"flex size-full items-center justify-center rounded-full bg-secondary-background text-foreground font-base group-data-[size=sm]/avatar:text-xs group-data-[size=lg]/avatar:text-lg\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarBadge({ className, ...props }: React.ComponentProps<\"span\">) {\n  return (\n    <span\n      data-slot=\"avatar-badge\"\n      className={cn(\n        \"absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full border-2 border-border bg-main text-main-foreground select-none [&>svg]:shrink-0\",\n        \"group-data-[size=sm]/avatar:size-3 group-data-[size=sm]/avatar:[&>svg]:hidden\",\n        \"group-data-[size=default]/avatar:size-4 group-data-[size=default]/avatar:[&>svg]:size-2\",\n        \"group-data-[size=lg]/avatar:size-5 group-data-[size=lg]/avatar:[&>svg]:size-2.5\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarGroup({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"avatar-group\"\n      className={cn(\"group/avatar-group flex -space-x-2\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarGroupCount({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"avatar-group-count\"\n      className={cn(\n        \"relative flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-background text-sm font-base text-foreground outline-2 outline-border [&>svg]:size-4\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport {\n  Avatar,\n  AvatarImage,\n  AvatarFallback,\n  AvatarBadge,\n  AvatarGroup,\n  AvatarGroupCount,\n}\n",
       "type": "registry:ui"
     }
   ]
```

---

### Incident Patch 2: `4a8f2c9e` (2026-09-12)
**Commit Message**: Add link to old documentation in migration guide

**File**: `src/markdown/docs/migrating-to-base-ui.mdx` (modified, +4/-0)
```diff
@@ -13,6 +13,10 @@ description: Learn how to migrate your components from Radix UI to Base UI.
 
 Visit <Link href="/docs/changelog">changelog</Link> to see all the changes.
 
+## Old docs
+
+If you want to see the old docs, they are hosted on <a target="_blank" href="https://old.neobrutalism.dev">old.neobrutalism.dev</a>.
+
 <Warning className="mt-8 mb-4" description="Radix UI and Base UI can live side by side, so you can migrate one component at a time. Only the components that you re-install from this site change." />
 
 ## 1. Install Base UI
```

---

### Incident Patch 3: `462e424c` (2026-09-10)
**Commit Message**: ui: descriptions and labels at full contrast

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `public/r/field.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   "files": [
     {
       "path": "src/components/ui/field.tsx",
-      "content": "\"use client\"\n\nimport { cva, type VariantProps } from \"class-variance-authority\"\n\nimport * as React from \"react\"\n\nimport { Label } from \"@/components/ui/label\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction FieldSet({ className, ...props }: React.ComponentProps<\"fieldset\">) {\n  return (\n    <fieldset\n      data-slot=\"field-set\"\n      className={cn(\n        \"flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction FieldLegend({\n  className,\n  variant = \"legend\",\n  ...props\n}: React.ComponentProps<\"legend\"> & { variant?: \"legend\" | \"label\" }) {\n  return (\n    <legend\n      data-slot=\"field-legend\"\n      data-variant={variant}\n      className={cn(\n        \"mb-1.5 font-heading data-[variant=label]:text-sm data-[variant=legend]:text-base\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction FieldGroup({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"field-group\"\n      className={cn(\n        \"group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nconst fieldVariants = cva(\n  \"group/field flex w-full gap-2 font-base data-[invalid=true]:text-red-500\",\n  {\n    variants: {\n      orientation: {\n        vertical: \"flex-col *:w-full [&>.sr-only]:w-auto\",\n        horizontal:\n          \"flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px\",\n        responsive:\n          \"flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px\",\n      },\n    },\n    defaultVariants: {\n      orientation: \"vertical\",\n    },\n  },\n)\n\nfunction Field({\n  className,\n  orientation = \"vertical\",\n  ...props\n}: React.ComponentProps<\"div\"> & VariantProps<typeof fieldVariants>) {\n  return (\n    <div\n      role=\"group\"\n      data-slot=\"field\"\n      data-orientation={orientation}\n      className={cn(fieldVariants({ orientation }), className)}\n      {...props}\n    />\n  )\n}\n\nfunction FieldContent({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"field-content\"\n      className={cn(\n        \"group/field-content flex flex-1 flex-col gap-0.5 leading-snug\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction FieldLabel({\n  className,\n  ...props\n}: React.ComponentProps<typeof Label>) {\n  return (\n    <Label\n      data-slot=\"field-label\"\n      className={cn(\n        \"group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=field]]:rounded-base has-[>[data-slot=field]]:border-2 has-[>[data-slot=field]]:border-border has-[>[data-slot=field]]:bg-secondary-background has-[>[data-slot=field]]:has-data-checked:bg-main has-[>[data-slot=field]]:has-data-checked:text-main-foreground has-[>[data-slot=field]]:has-[:focus-visible]:ring-2 has-[>[data-slot=field]]:has-[:focus-visible]:ring-black has-[>[data-slot=field]]:has-[:focus-visible]:ring-offset-2 *:data-[slot=field]:p-2.5\",\n        \"has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction FieldTitle({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"field-label\"\n      className={cn(\n        \"flex w-fit items-center gap-2 text-sm font-heading group-data-[disabled=true]/field:opacity-50\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction FieldDescription({ className, ...props }: React.ComponentProps<\"p\">) {\n  return (\n    <p\n      data-slot=\"field-description\"\n      className={cn(\n        \"text-left text-sm leading-normal font-base text-foreground/70 group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5\",\n        \"last:mt-0 nth-last-2:-mt-1\",\n        \"[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-foreground\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction FieldSeparator({\n  children,\n  className,\n  ...props\n}: React.ComponentProps<\"div\"> & {\n  children?: React.ReactNode\n}) {\n  return (\n    <div\n      data-slot=\"field-separator\"\n      data-content={!!children}\n      className={cn(\n        
```

**File**: `public/r/message.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "files": [
     {
       "path": "src/components/ui/message.tsx",
-      "content": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction MessageGroup({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-group\"\n      className={cn(\"flex min-w-0 flex-col gap-2\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction Message({\n  className,\n  align = \"start\",\n  ...props\n}: React.ComponentProps<\"div\"> & { align?: \"start\" | \"end\" }) {\n  return (\n    <div\n      data-slot=\"message\"\n      data-align={align}\n      className={cn(\n        \"group/message relative flex w-full min-w-0 gap-2 text-sm font-base data-[align=end]:flex-row-reverse\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MessageAvatar({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-avatar\"\n      className={cn(\n        \"flex size-10 shrink-0 items-center justify-center self-start overflow-hidden rounded-full border-2 border-border bg-background [&_[data-slot=avatar]]:size-full [&_[data-slot=avatar]]:outline-0 [&_[data-slot=avatar-fallback]]:bg-background\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MessageContent({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-content\"\n      className={cn(\n        \"flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MessageHeader({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-header\"\n      className={cn(\n        \"flex max-w-full min-w-0 items-center px-3 text-xs font-base text-foreground/70 group-has-data-[variant=ghost]/message:px-0\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MessageFooter({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-footer\"\n      className={cn(\n        \"flex max-w-full min-w-0 items-center px-3 text-xs font-base text-foreground/70 group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport {\n  MessageGroup,\n  Message,\n  MessageAvatar,\n  MessageContent,\n  MessageFooter,\n  MessageHeader,\n}\n",
+      "content": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction MessageGroup({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-group\"\n      className={cn(\"flex min-w-0 flex-col gap-2\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction Message({\n  className,\n  align = \"start\",\n  ...props\n}: React.ComponentProps<\"div\"> & { align?: \"start\" | \"end\" }) {\n  return (\n    <div\n      data-slot=\"message\"\n      data-align={align}\n      className={cn(\n        \"group/message relative flex w-full min-w-0 gap-2 text-sm font-base data-[align=end]:flex-row-reverse\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MessageAvatar({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-avatar\"\n      className={cn(\n        \"flex size-10 shrink-0 items-center justify-center self-start overflow-hidden rounded-full border-2 border-border bg-background [&_[data-slot=avatar]]:size-full [&_[data-slot=avatar]]:outline-0 [&_[data-slot=avatar-fallback]]:bg-background\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MessageContent({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-content\"\n      className={cn(\n        \"flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MessageHeader({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-header\"\n      className={cn(\n        \"flex max-w-full min-w-0 items-center px-3 text-xs font-base text-foreground group-has-data-[variant=ghost]/message:px-0\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MessageFooter({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"message-footer\"\n      className={cn(\n        \"flex max-w-full min-w-0 items-center px-3 text-xs font-base text-foreground group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport {\n  MessageGroup,\n  Message,\n  MessageAvatar,\n  MessageContent,\n  MessageFooter,\
```

**File**: `public/r/select.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   "files": [
     {
       "path": "src/components/ui/select.tsx",
-      "content": "\"use client\"\n\nimport { Select as SelectPrimitive } from \"@base-ui/react/select\"\nimport { Check, ChevronDown, ChevronUp } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Select = SelectPrimitive.Root\n\nfunction SelectGroup({\n  ...props\n}: React.ComponentProps<typeof SelectPrimitive.Group>) {\n  return <SelectPrimitive.Group data-slot=\"select-group\" {...props} />\n}\n\nfunction SelectValue({\n  className,\n  ...props\n}: React.ComponentProps<typeof SelectPrimitive.Value>) {\n  return (\n    <SelectPrimitive.Value\n      data-slot=\"select-value\"\n      className={cn(\"flex flex-1 items-center gap-2 text-left\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction SelectTrigger({\n  className,\n  children,\n  ...props\n}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {\n  return (\n    <SelectPrimitive.Trigger\n      data-slot=\"select-trigger\"\n      className={cn(\n        \"flex h-10 w-full items-center justify-between rounded-base border-2 border-border bg-main gap-2 px-3 py-2 text-sm font-base text-main-foreground ring-offset-white placeholder:text-foreground/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus:outline-hidden focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",\n        className,\n      )}\n      {...props}\n    >\n      {children}\n      <SelectPrimitive.Icon render={<ChevronDown className=\"size-4\" />} />\n    </SelectPrimitive.Trigger>\n  )\n}\n\nfunction SelectScrollUpButton({\n  className,\n  ...props\n}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {\n  return (\n    <SelectPrimitive.ScrollUpArrow\n      data-slot=\"select-scroll-up\"\n      className={cn(\n        \"top-0 z-10 flex w-full cursor-default items-center justify-center bg-background py-1 font-base text-foreground\",\n        className,\n      )}\n      {...props}\n    >\n      <ChevronUp className=\"size-4\" />\n    </SelectPrimitive.ScrollUpArrow>\n  )\n}\n\nfunction SelectScrollDownButton({\n  className,\n  ...props\n}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {\n  return (\n    <SelectPrimitive.ScrollDownArrow\n      data-slot=\"select-scroll-down\"\n      className={cn(\n        \"bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-background py-1 font-base text-foreground\",\n        className,\n      )}\n      {...props}\n    >\n      <ChevronDown className=\"size-4\" />\n    </SelectPrimitive.ScrollDownArrow>\n  )\n}\n\nfunction SelectContent({\n  className,\n  children,\n  side = \"bottom\",\n  sideOffset = 4,\n  align = \"center\",\n  alignOffset = 0,\n  alignItemWithTrigger = false,\n  ...props\n}: React.ComponentProps<typeof SelectPrimitive.Popup> &\n  Pick<\n    React.ComponentProps<typeof SelectPrimitive.Positioner>,\n    \"align\" | \"alignOffset\" | \"side\" | \"sideOffset\" | \"alignItemWithTrigger\"\n  >) {\n  return (\n    <SelectPrimitive.Portal>\n      <SelectPrimitive.Positioner\n        side={side}\n        sideOffset={sideOffset}\n        align={align}\n        alignOffset={alignOffset}\n        alignItemWithTrigger={alignItemWithTrigger}\n        className=\"isolate z-50\"\n      >\n        <SelectPrimitive.Popup\n          data-slot=\"select-content\"\n          className={cn(\n            \"relative z-50 max-h-[min(24rem,var(--available-height))] min-w-(--anchor-width) overflow-x-hidden overflow-y-auto rounded-base border-2 border-border bg-background text-foreground outline-none origin-(--transform-origin) data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2\",\n            className,\n          )}\n          {...props}\n        >\n          <SelectScrollUpButton />\n          <SelectPrimitive.List data-slot=\"select-list\" className=\"p-1\">\n            {children}\n          </SelectPrimitive.List>\n          <SelectScrollDownButton />\n        </SelectPrimitive.Popup>\n      </SelectPrimitive.Positioner>\n    </SelectPrimitive.Portal>\n  )\n}\n\nfunction SelectLabel({\n  className,\n  ...props\n}: React.ComponentProps<typeof SelectPrimitive.GroupLabel>) {\n  return (\n    <SelectPrimitive.GroupLabel\n      data-slot=\"select-label\"\n      class
```

**File**: `src/components/ui/field.tsx` (modified, +2/-2)
```diff
@@ -134,7 +134,7 @@ function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
     <p
       data-slot="field-description"
       className={cn(
-        "text-left text-sm leading-normal font-base text-foreground/70 group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
+        "text-left text-sm leading-normal font-base text-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
         "last:mt-0 nth-last-2:-mt-1",
         "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-foreground",
         className,
@@ -168,7 +168,7 @@ function FieldSeparator({
       />
       {children && (
         <span
-          className="relative mx-auto block w-fit bg-background px-2 font-base text-foreground/70"
+          className="relative mx-auto block w-fit bg-background px-2 font-base text-foreground"
           data-slot="field-separator-content"
         >
           {children}
```

**File**: `src/components/ui/message.tsx` (modified, +2/-2)
```diff
@@ -61,7 +61,7 @@ function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
     <div
       data-slot="message-header"
       className={cn(
-        "flex max-w-full min-w-0 items-center px-3 text-xs font-base text-foreground/70 group-has-data-[variant=ghost]/message:px-0",
+        "flex max-w-full min-w-0 items-center px-3 text-xs font-base text-foreground group-has-data-[variant=ghost]/message:px-0",
         className,
       )}
       {...props}
@@ -74,7 +74,7 @@ function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
     <div
       data-slot="message-footer"
       className={cn(
-        "flex max-w-full min-w-0 items-center px-3 text-xs font-base text-foreground/70 group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
+        "flex max-w-full min-w-0 items-center px-3 text-xs font-base text-foreground group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
         className,
       )}
       {...props}
```

**File**: `src/components/ui/select.tsx` (modified, +1/-1)
```diff
@@ -135,7 +135,7 @@ function SelectLabel({
     <SelectPrimitive.GroupLabel
       data-slot="select-label"
       className={cn(
-        "border-2 border-transparent py-1.5 pr-8 pl-2 text-sm font-base text-foreground/80",
+        "border-2 border-transparent py-1.5 pr-8 pl-2 text-sm font-base text-foreground",
         className,
       )}
       {...props}
```

#### Recent Merged Pull Requests:
- **PR #117** (2026-09-14): Base UI (@ekmas)
- **PR #116** (2026-08-02): added sidebar promo link (@ekmas)
- **PR #115** (closed): Add MemeChef to showcase (@C-o-d-e-C-o-w-b-o-y)
- **PR #114** (2026-05-10): Fix React Server Components CVE vulnerabilities (@vercel[bot])
- **PR #113** (closed): feat(calendar): add captionLayout dropdown support (@ELHart05)
- **PR #109** (closed): feat(docs/cli): save preferred cli command (@BombayV)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

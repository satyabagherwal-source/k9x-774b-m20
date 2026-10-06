# Forensic Learning Record (Deep Inspection): ekmas/neobrutalism-components

> **Canonical Artifact**: `07_PROJECT_LEARNING/ekmas-neobrutalism-components-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ekmas/neobrutalism-components](https://github.com/ekmas/neobrutalism-components))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:44:15.950Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ekmas/neobrutalism-components`
- **Description**: A collection of neobrutalism-styled Tailwind components.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5583 stars

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

### Core Architecture Module: `src/app/not-found.tsx`
```
import { ArrowUpRight } from "lucide-react"

import Link from "next/link"

export default function NotFound() {
  return (
    <div className="text-foreground max-h-[100dvh] h-[100dvh] portrait:max-h-[100dvh] portrait:h-[100dvh] w-full flex items-center justify-center bg-background prose-headings:font-heading prose-h1:md:text-5xl prose-h1:text-3xl">
      <div className="flex flex-col items-center text-center max-w-(--breakpoint-xl) px-5">
        <h1 className="leading-normal">404 Not Found</h1>

        <p className="leading-snug font-base sm:mt-[30px] sm:mb-[40px] my-9 2xl:text-3xl xl:text-2xl lg:text-2xl w-full md:text-2xl sm:text-xl text-xl">
          Could not find requested resource.
        </p>

        <Link
          className="flex items-center font-base gap-2.5 w-max text-main-foreground rounded-base border-2 border-border bg-main md:px-10 px-4 md:py-3 py-2 md:text-[22px] text-base shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
          href={"/"}
        >
          Return home
          <ArrowUpRight className="md:size-[30px] size-5" />
        </Link>
      </div>
    </div>
  )
}

```

### Core Architecture Module: `src/app/page.tsx`
```
import { ArrowUpRight } from "lucide-react"

import Link from "next/link"

import COMPONENTS from "@/data/components"

import StarField from "@/components/app/landing/star-field"
import Star32 from "@/components/stars/s32"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-background px-5 font-base text-foreground [@media(max-height:640px)]:pt-[70px] bg-[linear-gradient(to_right,#80808033_1px,transparent_1px),linear-gradient(to_bottom,#80808033_1px,transparent_1px)] bg-[size:70px_70px]">
      <StarField className="[@media(max-height:640px)]:top-[70px]" />

      <div className="relative flex w-full max-w-[820px] flex-col items-center text-center">
        <h1 className="font-heading text-3xl leading-tight sm:text-[40px] md:text-5xl xl:text-6xl">
          Build bold{" "}
          <span className="inline-flex items-center gap-2 whitespace-nowrap align-baseline sm:gap-3">
            <Star32
              aria-hidden
              color="var(--chart-4)"
              stroke="var(--border)"
              strokeWidth={5}
              className="size-[0.8em] shrink-0"
            />
            <span className="text-chart-4 [paint-order:stroke_fill] [-webkit-text-stroke:3px_var(--border)] md:[-webkit-text-stroke:5px_var(--border)]">
              neobrutalism
            </span>
            <Star32
              aria-hidden
              color="var(--chart-4)"
              stroke="var(--border)"
              strokeWidth={5}
              className="size-[0.8em] shrink-0"
            />
          </span>{" "}
          layouts in minutes.
        </h1>

        <p className="mt-6 max-w-[680px] text-lg leading-snug sm:text-xl md:mt-8 md:text-2xl">
          {COMPONENTS.length} components, charts and star shapes for React and
          Tailwind v4. Built on shadcn/ui and Base UI. Pick a palette and start
          shipping.
        </p>

        <Button
          size="lg"
          className="mt-8 h-12 gap-3 px-7 text-lg md:mt-10 md:h-14 md:px-9 md:text-xl"
          nativeButton={false}
          render={<Link href="/docs" />}
        >
          Get started
          <ArrowUpRight className="size-6! md:size-7!" />
        </Button>
      </div>
    </main>
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

- **Issue #115** (2026-09-11): **Add MemeChef to showcase**
  *Symptoms*: Hey, I used neobrutalism components on [MemeChef](https://memechef.ai/) and wanted to submit it for the showcase page.  Thanks for building this library.
  **Post-Mortem & Fix Analysis**:
  > @C-o-d-e-C-o-w-b-o-y is attempting to deploy a commit to the **samuelbreznjak's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=samuelbreznjak's%20projects&slug=samuelbreznjaks-projects&teamId=team_TqMelTG21eA3LFHaZIryK7GV&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22847aa87074b2c07c98d1a4e0c8a209dd72d95593%22%7D%2C%22id%22%3A%22QmVCnW1JcA4RNyw8stR7LgDM5dRQPi6qkeCBwVK5rPzFtv%22%2C%22org%22%3A%22ekmas%22%2C%22prId%22%3A115%2C%22repo%22%3A%22neobrutalism-components%22%7D).  
  > hi @ekmas would really appreciate a review 🙏  This is the `#1` component library ever tbh
  > Showcase page will be hidden on the site for a while because there is a new launch coming, and most of the old projects are obsolete. When the time comes to bring back the showcase page, I will include this. 

- **Issue #114** (2026-05-10): **Fix React Server Components CVE vulnerabilities**
  *Symptoms*: > [!IMPORTANT] > This is an automatic PR generated by Vercel to help you with patching efforts. We can't guarantee it's comprehensive, and it may contain mistakes. Please review our [guidance](https://vercel.link/additional-checks) before merging these changes.  A critical remote code execution (RCE) vulnerability in React Server Components, impacting frameworks such as Next.js, was identified in the project [neobrutalism-components](https://vercel.com/samuelbreznjaks-projects/neobrutalism-components). The vulnerability enables unauthenticated RCE on the server via insecure deserialization in the React Flight protocol.  This issue is tracked under:  - GitHub Security Advisory: [GHSA-9qr9-h5gf-34mp](https://github.com/vercel/next.js/security/advisories/GHSA-9qr9-h5gf-34mp) - React Advisory: [CVE-2025-55182](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components) - Next.js Advisory: [CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478)  This automated pull request upgrades the affected React and Next.js packages to patched versions that fully remediate the issue.  [More Info](https://vercel.link/cve-2025-55182-automated-pr) | security@vercel.com   
  **Post-Mortem & Fix Analysis**:
  > [vc]: #mI+qloi3GVmFO0ZuSKAGt9B4WOp3EVOFpKRM1AOfweU=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJuZW9icnV0YWxpc20tY29tcG9uZW50cyIsInByb2plY3RJZCI6InByal9rUDNnaHNBYUxxQ0dGQzlaaGNoRXNCT0NzNjV0IiwidjAiOmZhbHNlLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vc2FtdWVsYnJlem5qYWtzLXByb2plY3RzL25lb2JydXRhbGlzbS1jb21wb25lbnRzL0ZXVGJhaTFWV1Y4SzhvNVBFdVNpQlhRdHVkUEciLCJwcmV2aWV3VXJsIjoibmVvYnJ1dGFsaXNtLWNvbXBvbmVudHMtZ2l0LXZlci1lYzIyY2Qtc2FtdWVsYnJlem5qYWtzLXByb2plY3RzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoibmVvYnJ1dGFsaXNtLWNvbXBvbmVudHMtZ2l0LXZlci1lYzIyY2Qtc2FtdWVsYnJlem5qYWtzLXByb2plY3RzLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6bnVsbH1dfQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [neobrutalism-components]

- **Issue #113** (2026-09-11): **feat(calendar): add captionLayout dropdown support**
  *Symptoms*: This PR enhances the `Calendar` component by adding support for a dropdown month/year selector, improving its flexibility and user experience. It introduces new styles and logic for dropdown-based captions, updates documentation and example usage, and integrates the new dropdown demo into the component explorer. PS: this PR is related to an issue reported here (https://github.com/ekmas/neobrutalism-components/issues/106)  **Calendar component improvements:**  - I added support for the prop `captionLayout` so it can accept the value `captionLayout="dropdown"` and `captionLayout="dropdown-buttons"` in the `Calendar` component, in which this will allow the users to select the month and year via dropdown menus rather that doing that manually for so long. This includes new classNames and styling for dropdown elements, and the addition of the `ChevronDown` icon. - I have also updated the `Calendar` component's props and class logic to handle the new dropdown caption layouts, including accessibility and visual improvements.  **Examples and documentation:**  - I Added a new example component `CalendarDropdownDemo` demonstrating the dropdown caption layout, and registered it in the component explorer + the markdown documentation was updated to ensure a preview and code sample of the dropdown month/year.  **Registry update:**  - Updated the UI registry to reflect the new `Calendar` component implementation and example.
  **Post-Mortem & Fix Analysis**:
  > @ELHart05 is attempting to deploy a commit to the **samuelbreznjak's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=samuelbreznjak's%20projects&slug=samuelbreznjaks-projects&teamId=team_TqMelTG21eA3LFHaZIryK7GV&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2264cf516d387f44a4702e1fc776e5afcb54fd7db1%22%7D%2C%22id%22%3A%22QmVEC1jpytmaothkrhgE1GDfp2vELhY2RUMYamDEyD6eKT%22%2C%22org%22%3A%22ekmas%22%2C%22prId%22%3A113%2C%22repo%22%3A%22neobrutalism-components%22%7D).  
  > This will be included with the new launch of neobrutalism.dev, coming in a few days :) Thanks for your effort anyway

- **Issue #111** (2026-09-14): **Accessibility: icon buttons missing aria-labels, carousel controls, color contrast with neobrutalist style**
  *Symptoms*: Hi! This is a fantastic collection of neobrutalism components. Since component libraries are used across many projects, getting accessibility right here has a multiplier effect. I found some areas for improvement.  ## Issues Found  ### 1. Icon-only buttons missing accessible names Several icon buttons in the component demos lack `aria-label` attributes. For example, the toggle button has `aria-label="Toggle"` which is too generic — it should describe what it toggles (WCAG 4.1.2).  **Fix:** Each icon button should have a descriptive `aria-label` (e.g., `aria-label="Toggle dark mode"`, `aria-label="Close dialog"`).  ### 2. Carousel/slider controls lack position announcements The carousel components should announce the current slide position to screen readers (e.g., "Slide 1 of 5"). The navigation buttons ("Previous slide", "Next slide") should also communicate the change via `aria-live` regions (WCAG 4.1.2).  ### 3. Collapsible/accordion missing state announcements Accordion triggers should use `aria-expanded` to communicate whether content is expanded or collapsed. The controlled content should be linked via `aria-controls` (WCAG 4.1.2).  ### 4. Color contrast with neobrutalist style The bold borders and flat colors of neobrutalism can actually be great for accessibility, but some combinations (particularly light text on colored backgrounds) may not meet WCAG AA contrast ratio of 4.5:1. Worth auditing the color combinations (WCAG 1.4.3).  ### 5. No skip navigation on the docs 
  **Post-Mortem & Fix Analysis**:
  > @ryuno2525  If you want, I can help you with this 
  > fixed with new update :-)

- **Issue #110** (2026-09-11): **Error while downloading the card component**
  *Symptoms*: Apparently I was working on a project where i need to download the card component. Used: ``` bunx --bun shadcn@latest add https://neobrutalism.dev/r/card.json ```  <img width="1197" height="779" alt="Image" src="https://github.com/user-attachments/assets/eef2f825-4236-4e54-b767-bc4b4ae096ad" />
  **Post-Mortem & Fix Analysis**:
  > A lot of time has passed since you posted this, so I guess you managed to resolve this. Please let me know if you need help 

- **Issue #109** (2026-09-11): **feat(docs/cli): save preferred cli command**
  *Symptoms*: Saves and applies the preferred cli by saving it to localStorage. This way, you can just copy and paste the command instead of clicking on your cli every single time.
  **Post-Mortem & Fix Analysis**:
  > @BombayV is attempting to deploy a commit to the **samuelbreznjak's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=samuelbreznjak's%20projects&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%221437112ab46ff3f897a4817dae865419980fb0cb%22%7D%2C%22id%22%3A%22QmW8LXJWZbjrWu3ithqTgWRMYYi6B6QHCeXAkEVN6udzdV%22%2C%22org%22%3A%22ekmas%22%2C%22prId%22%3A109%2C%22repo%22%3A%22neobrutalism-components%22%7D).  
  > The logic for shadcn cli tabs is changed in the meantime, and this won't work. Thanks for your efforts anyway

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

---

### Incident Patch 4: `6f61d2c6` (2026-09-10)
**Commit Message**: ui: parts and sizes the new examples need

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `public/r/alert-dialog.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   "files": [
     {
       "path": "src/components/ui/alert-dialog.tsx",
-      "content": "\"use client\"\n\nimport { AlertDialog as AlertDialogPrimitive } from \"@base-ui/react/alert-dialog\"\n\nimport * as React from \"react\"\n\nimport { buttonVariants } from \"@/components/ui/button\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction AlertDialog({\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {\n  return <AlertDialogPrimitive.Root data-slot=\"alert-dialog\" {...props} />\n}\n\nfunction AlertDialogTrigger({\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {\n  return (\n    <AlertDialogPrimitive.Trigger data-slot=\"alert-dialog-trigger\" {...props} />\n  )\n}\n\nfunction AlertDialogPortal({\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {\n  return (\n    <AlertDialogPrimitive.Portal data-slot=\"alert-dialog-portal\" {...props} />\n  )\n}\n\nfunction AlertDialogOverlay({\n  className,\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Backdrop>) {\n  return (\n    <AlertDialogPrimitive.Backdrop\n      data-slot=\"alert-dialog-overlay\"\n      className={cn(\n        \"fixed inset-0 z-50 bg-overlay duration-200 fill-mode-forwards data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AlertDialogContent({\n  className,\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Popup>) {\n  return (\n    <AlertDialogPortal>\n      <AlertDialogOverlay />\n      <AlertDialogPrimitive.Popup\n        data-slot=\"alert-dialog-content\"\n        className={cn(\n          \"bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-base border-2 border-border p-6 shadow-shadow duration-200 outline-none sm:max-w-lg\",\n          className,\n        )}\n        {...props}\n      />\n    </AlertDialogPortal>\n  )\n}\n\nfunction AlertDialogHeader({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"alert-dialog-header\"\n      className={cn(\"flex flex-col gap-2 text-center sm:text-left\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AlertDialogFooter({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"alert-dialog-footer\"\n      className={cn(\n        \"flex flex-col-reverse gap-3 sm:flex-row sm:justify-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AlertDialogTitle({\n  className,\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {\n  return (\n    <AlertDialogPrimitive.Title\n      data-slot=\"alert-dialog-title\"\n      className={cn(\"text-lg font-heading\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AlertDialogDescription({\n  className,\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {\n  return (\n    <AlertDialogPrimitive.Description\n      data-slot=\"alert-dialog-description\"\n      className={cn(\"text-sm font-base text-foreground\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AlertDialogAction({\n  className,\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Close>) {\n  return (\n    <AlertDialogPrimitive.Close\n      data-slot=\"alert-dialog-action\"\n      className={cn(buttonVariants(), className)}\n      {...props}\n    />\n  )\n}\n\nfunction AlertDialogCancel({\n  className,\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Close>) {\n  return (\n    <AlertDialogPrimitive.Close\n      data-slot=\"alert-dialog-cancel\"\n      className={cn(buttonVariants({ variant: \"neutral\" }), className)}\n      {...props}\n    />\n  )\n}\n\nexport {\n  AlertDialog,\n  AlertDialogPortal,\n  AlertDialogOverlay,\n  AlertDialogTrigger,\n  AlertDialogContent,\n  AlertDialogHeader,\n  AlertDialogFooter,\n  AlertDialogTitle,\n  AlertDialogDescription,\n  AlertDialogAction,\n  AlertDialogCancel,\n}\n",
+      "content": "\"use client\"\n\nimport { AlertDialog as AlertDialogPrimitive } from \"@base-ui/react/alert-dialog\"\nimport { type VariantProps } from \"class-variance-authority\"\n\nimport * as React from \"react\"\n\nimport { buttonVariants } from \"@/components/ui/button\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction AlertDialog({\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {\n  return <AlertDialogPrimitive.Root data-slot=\"alert-dialog\" {...props} />\n}\n\nfunction AlertDialogTrigger({\n  ...props\n}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {\n  return (\n    <AlertDialogPrimitive.Trigger data-slot=\"alert-dialog-trigger\" {...props} />\n  )\n}\n\nfunction AlertDi
```

**File**: `public/r/avatar.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   "files": [
     {
       "path": "src/components/ui/avatar.tsx",
-      "content": "\"use client\"\n\nimport { Avatar as AvatarPrimitive } from \"@base-ui/react/avatar\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Avatar({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Root>) {\n  return (\n    <AvatarPrimitive.Root\n      data-slot=\"avatar\"\n      className={cn(\n        \"relative flex size-10 shrink-0 overflow-hidden rounded-full outline-2 outline-border\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarImage({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Image>) {\n  return (\n    <AvatarPrimitive.Image\n      data-slot=\"avatar-image\"\n      className={cn(\"aspect-square size-full\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarFallback({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {\n  return (\n    <AvatarPrimitive.Fallback\n      data-slot=\"avatar-fallback\"\n      className={cn(\n        \"flex size-full items-center justify-center rounded-full bg-secondary-background text-foreground font-base\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport { Avatar, AvatarImage, AvatarFallback }\n",
+      "content": "\"use client\"\n\nimport { Avatar as AvatarPrimitive } from \"@base-ui/react/avatar\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst avatarSizes = {\n  sm: \"size-8\",\n  default: \"size-10\",\n  lg: \"size-12\",\n}\n\nfunction Avatar({\n  className,\n  size = \"default\",\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Root> & {\n  size?: \"default\" | \"sm\" | \"lg\"\n}) {\n  return (\n    <AvatarPrimitive.Root\n      data-slot=\"avatar\"\n      data-size={size}\n      className={cn(\n        \"group/avatar relative flex shrink-0 rounded-full outline-2 outline-border\",\n        avatarSizes[size],\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarImage({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Image>) {\n  return (\n    <AvatarPrimitive.Image\n      data-slot=\"avatar-image\"\n      className={cn(\"aspect-square size-full rounded-full\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarFallback({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {\n  return (\n    <AvatarPrimitive.Fallback\n      data-slot=\"avatar-fallback\"\n      className={cn(\n        \"flex size-full items-center justify-center rounded-full bg-secondary-background text-foreground font-base group-data-[size=sm]/avatar:text-xs group-data-[size=lg]/avatar:text-lg\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarBadge({ className, ...props }: React.ComponentProps<\"span\">) {\n  return (\n    <span\n      data-slot=\"avatar-badge\"\n      className={cn(\n        \"absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full border-2 border-border bg-main text-main-foreground select-none [&>svg]:shrink-0\",\n        \"group-data-[size=sm]/avatar:size-3 group-data-[size=sm]/avatar:[&>svg]:hidden\",\n        \"group-data-[size=default]/avatar:size-4 group-data-[size=default]/avatar:[&>svg]:size-2\",\n        \"group-data-[size=lg]/avatar:size-5 group-data-[size=lg]/avatar:[&>svg]:size-2.5\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarGroup({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"avatar-group\"\n      className={cn(\"group/avatar-group flex -space-x-2\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarGroupCount({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"avatar-group-count\"\n      className={cn(\n        \"relative flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-background text-sm font-base text-foreground outline-2 outline-border [&>svg]:size-4\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport {\n  Avatar,\n  AvatarImage,\n  AvatarFallback,\n  AvatarBadge,\n  AvatarGroup,\n  AvatarGroupCount,\n}\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/card.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "files": [
     {
       "path": "src/components/ui/card.tsx",
-      "content": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Card({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card\"\n      className={cn(\n        \"rounded-base flex flex-col shadow-shadow border-2 gap-6 py-6 border-border bg-background text-foreground font-base\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardHeader({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-header\"\n      className={cn(\n        \"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-[data-slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardTitle({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-title\"\n      className={cn(\"font-heading leading-none\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardDescription({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-description\"\n      className={cn(\"text-sm font-base\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardAction({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-action\"\n      className={cn(\n        \"col-start-2 row-span-2 row-start-1 self-start justify-self-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardContent({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-content\"\n      className={cn(\"px-6\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardFooter({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-footer\"\n      className={cn(\"flex items-center px-6 [.border-t]:pt-6\", className)}\n      {...props}\n    />\n  )\n}\n\nexport {\n  Card,\n  CardHeader,\n  CardFooter,\n  CardTitle,\n  CardDescription,\n  CardContent,\n  CardAction,\n}\n",
+      "content": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Card({\n  className,\n  size = \"default\",\n  ...props\n}: React.ComponentProps<\"div\"> & { size?: \"default\" | \"sm\" }) {\n  return (\n    <div\n      data-slot=\"card\"\n      data-size={size}\n      className={cn(\n        \"group/card rounded-base flex flex-col shadow-shadow border-2 gap-(--card-spacing) py-(--card-spacing) border-border bg-background text-foreground font-base [--card-spacing:--spacing(6)] data-[size=sm]:[--card-spacing:--spacing(4)]\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardHeader({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-header\"\n      className={cn(\n        \"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-(--card-spacing)\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardTitle({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-title\"\n      className={cn(\"font-heading leading-none\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardDescription({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-description\"\n      className={cn(\"text-sm font-base\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardAction({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-action\"\n      className={cn(\n        \"col-start-2 row-span-2 row-start-1 self-start justify-self-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardContent({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-content\"\n      className={cn(\"px-(--card-spacing)\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardFooter({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-footer\"\n      className={cn(\n        \"flex items-center px-(--card-spacing) [.border-t]:pt-(--card-spacing)\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport {\n  Card,\n  CardHeader,\n  CardFooter,\n  CardTitle,\n  CardDescription,\n  CardContent,\n  CardAction,\n}\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/checkbox.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   "files": [
     {
       "path": "src/components/ui/checkbox.tsx",
-      "content": "\"use client\"\n\nimport { Checkbox as CheckboxPrimitive } from \"@base-ui/react/checkbox\"\nimport { Check } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Checkbox({\n  className,\n  ...props\n}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {\n  return (\n    <CheckboxPrimitive.Root\n      data-slot=\"checkbox\"\n      className={cn(\n        \"peer flex size-4 shrink-0 items-center justify-center outline-2 outline-border ring-offset-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:bg-main data-checked:text-white data-indeterminate:bg-main data-indeterminate:text-white\",\n        className,\n      )}\n      {...props}\n    >\n      <CheckboxPrimitive.Indicator\n        data-slot=\"checkbox-indicator\"\n        className={cn(\"flex items-center justify-center text-current\")}\n      >\n        <Check className=\"size-4 text-main-foreground\" />\n      </CheckboxPrimitive.Indicator>\n    </CheckboxPrimitive.Root>\n  )\n}\n\nexport { Checkbox }\n",
+      "content": "\"use client\"\n\nimport { Checkbox as CheckboxPrimitive } from \"@base-ui/react/checkbox\"\nimport { Check } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Checkbox({\n  className,\n  ...props\n}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {\n  return (\n    <CheckboxPrimitive.Root\n      data-slot=\"checkbox\"\n      className={cn(\n        \"peer flex size-4 shrink-0 items-center justify-center outline-2 outline-border ring-offset-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:bg-main data-checked:text-white data-indeterminate:bg-main data-indeterminate:text-white aria-invalid:outline-red-500\",\n        className,\n      )}\n      {...props}\n    >\n      <CheckboxPrimitive.Indicator\n        data-slot=\"checkbox-indicator\"\n        className={cn(\"flex items-center justify-center text-current\")}\n      >\n        <Check className=\"size-4 text-main-foreground\" />\n      </CheckboxPrimitive.Indicator>\n    </CheckboxPrimitive.Root>\n  )\n}\n\nexport { Checkbox }\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/context-menu.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   "files": [
     {
       "path": "src/components/ui/context-menu.tsx",
-      "content": "\"use client\"\n\nimport { ContextMenu as ContextMenuPrimitive } from \"@base-ui/react/context-menu\"\nimport { Check, ChevronRight, Circle } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\n// Base UI's GroupLabel must live inside a Group or RadioGroup. Track that so a\n// standalone label (like Radix allowed) still renders instead of throwing.\nconst ContextMenuGroupContext = React.createContext(false)\n\nfunction ContextMenu({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {\n  return <ContextMenuPrimitive.Root data-slot=\"context-menu\" {...props} />\n}\n\nfunction ContextMenuTrigger({\n  className,\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {\n  return (\n    <ContextMenuPrimitive.Trigger\n      data-slot=\"context-menu-trigger\"\n      className={cn(\"select-none\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction ContextMenuGroup({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {\n  return (\n    <ContextMenuGroupContext.Provider value={true}>\n      <ContextMenuPrimitive.Group data-slot=\"context-menu-group\" {...props} />\n    </ContextMenuGroupContext.Provider>\n  )\n}\n\nfunction ContextMenuPortal({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {\n  return (\n    <ContextMenuPrimitive.Portal data-slot=\"context-menu-portal\" {...props} />\n  )\n}\n\nfunction ContextMenuSub({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuRoot>) {\n  return (\n    <ContextMenuPrimitive.SubmenuRoot data-slot=\"context-menu-sub\" {...props} />\n  )\n}\n\nfunction ContextMenuRadioGroup({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {\n  return (\n    <ContextMenuGroupContext.Provider value={true}>\n      <ContextMenuPrimitive.RadioGroup\n        data-slot=\"context-menu-radio-group\"\n        {...props}\n      />\n    </ContextMenuGroupContext.Provider>\n  )\n}\n\nfunction ContextMenuSubTrigger({\n  className,\n  inset,\n  children,\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuTrigger> & {\n  inset?: boolean\n}) {\n  return (\n    <ContextMenuPrimitive.SubmenuTrigger\n      data-slot=\"context-menu-sub-trigger\"\n      data-inset={inset}\n      className={cn(\n        \"flex cursor-default select-none items-center rounded-base border-2 border-transparent px-2 py-1.5 text-sm font-base outline-hidden data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 hover:bg-main hover:text-main-foreground hover:border-border focus:bg-main focus:text-main-foreground focus:border-border data-highlighted:bg-main data-highlighted:text-main-foreground data-highlighted:border-border data-popup-open:bg-main data-popup-open:text-main-foreground data-popup-open:border-border\",\n        className,\n      )}\n      {...props}\n    >\n      {children}\n      <ChevronRight className=\"ml-auto\" />\n    </ContextMenuPrimitive.SubmenuTrigger>\n  )\n}\n\nconst contextMenuPopupClassName =\n  \"z-50 min-w-[8rem] overflow-hidden rounded-base border-2 border-border bg-background p-1 font-base text-foreground outline-none origin-(--transform-origin) data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2\"\n\nfunction ContextMenuSubContent({\n  className,\n  align,\n  alignOffset,\n  side,\n  sideOffset,\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Popup> &\n  Pick<\n    React.ComponentProps<typeof ContextMenuPrimitive.Positioner>,\n    \"align\" | \"alignOffset\" | \"side\" | \"sideOffset\"\n  >) {\n  return (\n    <ContextMenuPrimitive.Portal>\n      <ContextMenuPrimitive.Positioner\n        className=\"isolate z-50 outline-none\"\n        align={align}\n        alignOffset={alignOffset}\n        side={side}\n        sideOffset={sideOffset}\n      >\n        <ContextMenuPrimitive.Popup\n          data-slot=\"context-menu-sub-content\"\n          className={cn(contextMenuPopupClassName, className)}\n          {...props}\n        />\n      </ContextMenuPrimitive.Positioner>\n    </ContextMenuPrimitive.Portal>\n  )\n}\n\nfunction ContextMenuContent({\n  className,\n  align,\n  alignOffset,\n  side,\n  sideOffset,\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Popup> &\n  Pick<\n    React.ComponentProps<typeof ContextMenuPrimitive.Positioner>,\n    \"align\" | \"alignOffset\" | \"side\" | \"sideOffset\"\n  >) {\n  return (\n    <ContextMenuPrimitive.Portal>\n      <ContextMenuPrimitive.Positioner\
```

**File**: `public/r/input-otp.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   "files": [
     {
       "path": "src/components/ui/input-otp.tsx",
-      "content": "\"use client\"\n\nimport { OTPInput, OTPInputContext } from \"input-otp\"\nimport { Dot } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction InputOTP({\n  className,\n  containerClassName,\n  ...props\n}: React.ComponentProps<typeof OTPInput> & {\n  containerClassName?: string\n}) {\n  return (\n    <OTPInput\n      data-slot=\"input-otp\"\n      containerClassName={cn(\n        \"flex items-center gap-2 has-disabled:opacity-50\",\n        containerClassName,\n      )}\n      className={cn(\"disabled:cursor-not-allowed\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction InputOTPGroup({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"input-otp-group\"\n      className={cn(\"flex items-center\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction InputOTPSlot({\n  index,\n  className,\n  ...props\n}: React.ComponentProps<\"div\"> & { index: number }) {\n  const inputOTPContext = React.useContext(OTPInputContext)\n  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}\n\n  return (\n    <div\n      data-slot=\"input-otp-slot\"\n      data-active={isActive}\n      className={cn(\n        \"relative flex size-10 items-center justify-center border-y-2 border-r-2 border-border bg-secondary-background text-sm font-base text-foreground first:rounded-l-base first:border-l-2 last:rounded-r-base transition-all\",\n        isActive && \"z-10 ring-1 ring-ring\",\n        className,\n      )}\n      {...props}\n    >\n      {char}\n      {hasFakeCaret && (\n        <div className=\"pointer-events-none absolute inset-0 flex items-center justify-center\">\n          <div className=\"h-4 w-px animate-caret-blink bg-current duration-1000\" />\n        </div>\n      )}\n    </div>\n  )\n}\n\nfunction InputOTPSeparator({ ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div data-slot=\"input-otp-separator\" role=\"separator\" {...props}>\n      <Dot className=\"size-4\" />\n    </div>\n  )\n}\n\nexport { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }\n",
+      "content": "\"use client\"\n\nimport { OTPInput, OTPInputContext } from \"input-otp\"\nimport { Dot } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction InputOTP({\n  className,\n  containerClassName,\n  ...props\n}: React.ComponentProps<typeof OTPInput> & {\n  containerClassName?: string\n}) {\n  return (\n    <OTPInput\n      data-slot=\"input-otp\"\n      containerClassName={cn(\n        \"flex items-center gap-2 has-disabled:opacity-50\",\n        containerClassName,\n      )}\n      className={cn(\"disabled:cursor-not-allowed\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction InputOTPGroup({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"input-otp-group\"\n      className={cn(\"flex items-center\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction InputOTPSlot({\n  index,\n  className,\n  ...props\n}: React.ComponentProps<\"div\"> & { index: number }) {\n  const inputOTPContext = React.useContext(OTPInputContext)\n  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}\n\n  return (\n    <div\n      data-slot=\"input-otp-slot\"\n      data-active={isActive}\n      className={cn(\n        \"relative flex size-10 items-center justify-center border-y-2 border-r-2 border-border bg-secondary-background text-sm font-base text-foreground first:rounded-l-base first:border-l-2 last:rounded-r-base transition-all aria-invalid:border-red-500 aria-invalid:ring-red-500\",\n        isActive && \"z-10 ring-1 ring-ring\",\n        className,\n      )}\n      {...props}\n    >\n      {char}\n      {hasFakeCaret && (\n        <div className=\"pointer-events-none absolute inset-0 flex items-center justify-center\">\n          <div className=\"h-4 w-px animate-caret-blink bg-current duration-1000\" />\n        </div>\n      )}\n    </div>\n  )\n}\n\nfunction InputOTPSeparator({ ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div data-slot=\"input-otp-separator\" role=\"separator\" {...props}>\n      <Dot className=\"size-4\" />\n    </div>\n  )\n}\n\nexport { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/menubar.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   "files": [
     {
       "path": "src/components/ui/menubar.tsx",
-      "content": "\"use client\"\n\nimport { Menu as MenuPrimitive } from \"@base-ui/react/menu\"\nimport { Menubar as MenubarPrimitive } from \"@base-ui/react/menubar\"\nimport { Check, ChevronRight, Circle } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\n// Base UI's GroupLabel must live inside a Group or RadioGroup. Track that so a\n// standalone label (like Radix allowed) still renders instead of throwing.\nconst MenubarGroupContext = React.createContext(false)\n\nfunction Menubar({\n  className,\n  ...props\n}: React.ComponentProps<typeof MenubarPrimitive>) {\n  return (\n    <MenubarPrimitive\n      data-slot=\"menubar\"\n      className={cn(\n        \"flex h-11 items-center space-x-1 rounded-base border-2 border-border bg-background p-1 font-base\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction MenubarMenu({\n  ...props\n}: React.ComponentProps<typeof MenuPrimitive.Root>) {\n  return <MenuPrimitive.Root data-slot=\"menubar-menu\" {...props} />\n}\n\nfunction MenubarTrigger({\n  className,\n  ...props\n}: React.ComponentProps<typeof MenuPrimitive.Trigger>) {\n  return (\n    <MenuPrimitive.Trigger\n      data-slot=\"menubar-trigger\"\n      className={cn(\n        \"flex cursor-default select-none items-center text-foreground rounded-base px-3 py-1.5 text-sm border-2 border-transparent font-heading outline-none hover:bg-main hover:text-main-foreground hover:border-border focus:bg-main focus:text-main-foreground focus:border-border data-highlighted:bg-main data-highlighted:text-main-foreground data-highlighted:border-border data-popup-open:bg-main data-popup-open:text-main-foreground data-popup-open:border-border\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nconst menubarPopupClassName =\n  \"z-50 min-w-[12rem] overflow-hidden rounded-base border-2 border-border bg-background p-1 text-foreground outline-none origin-(--transform-origin) data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2\"\n\nfunction MenubarContent({\n  className,\n  align = \"start\",\n  alignOffset = -4,\n  side = \"bottom\",\n  sideOffset = 8,\n  ...props\n}: React.ComponentProps<typeof MenuPrimitive.Popup> &\n  Pick<\n    React.ComponentProps<typeof MenuPrimitive.Positioner>,\n    \"align\" | \"alignOffset\" | \"side\" | \"sideOffset\"\n  >) {\n  return (\n    <MenuPrimitive.Portal>\n      <MenuPrimitive.Positioner\n        className=\"isolate z-50 outline-none\"\n        align={align}\n        alignOffset={alignOffset}\n        side={side}\n        sideOffset={sideOffset}\n      >\n        <MenuPrimitive.Popup\n          data-slot=\"menubar-content\"\n          className={cn(menubarPopupClassName, className)}\n          {...props}\n        />\n      </MenuPrimitive.Positioner>\n    </MenuPrimitive.Portal>\n  )\n}\n\nfunction MenubarGroup({\n  ...props\n}: React.ComponentProps<typeof MenuPrimitive.Group>) {\n  return (\n    <MenubarGroupContext.Provider value={true}>\n      <MenuPrimitive.Group data-slot=\"menubar-group\" {...props} />\n    </MenubarGroupContext.Provider>\n  )\n}\n\nfunction MenubarPortal({\n  ...props\n}: React.ComponentProps<typeof MenuPrimitive.Portal>) {\n  return <MenuPrimitive.Portal data-slot=\"menubar-portal\" {...props} />\n}\n\nfunction MenubarSub({\n  ...props\n}: React.ComponentProps<typeof MenuPrimitive.SubmenuRoot>) {\n  return <MenuPrimitive.SubmenuRoot data-slot=\"menubar-sub\" {...props} />\n}\n\nfunction MenubarRadioGroup({\n  ...props\n}: React.ComponentProps<typeof MenuPrimitive.RadioGroup>) {\n  return (\n    <MenubarGroupContext.Provider value={true}>\n      <MenuPrimitive.RadioGroup data-slot=\"menubar-radio-group\" {...props} />\n    </MenubarGroupContext.Provider>\n  )\n}\n\nfunction MenubarItem({\n  className,\n  inset,\n  ...props\n}: React.ComponentProps<typeof MenuPrimitive.Item> & {\n  inset?: boolean\n}) {\n  return (\n    <MenuPrimitive.Item\n      data-slot=\"menubar-item\"\n      data-inset={inset}\n      className={cn(\n        \"relative flex cursor-default select-none items-center rounded-base border-2 border-transparent px-2 py-1.5 text-sm font-base outline-hidden hover:bg-main hover:text-main-foreground hover:border-border focus:bg-main focus:text-main-foreground focus:border-border data-highlighted:bg-main data-highlighted:text-main-foreground data-highlighted:border-border data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",\n        className,\n      )}\n   
```

**File**: `public/r/ncard.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "files": [
     {
       "path": "src/components/ui/card.tsx",
-      "content": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Card({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card\"\n      className={cn(\n        \"rounded-base flex flex-col shadow-shadow border-2 gap-6 py-6 border-border bg-background text-foreground font-base\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardHeader({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-header\"\n      className={cn(\n        \"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-[data-slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardTitle({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-title\"\n      className={cn(\"font-heading leading-none\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardDescription({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-description\"\n      className={cn(\"text-sm font-base\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardAction({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-action\"\n      className={cn(\n        \"col-start-2 row-span-2 row-start-1 self-start justify-self-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardContent({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-content\"\n      className={cn(\"px-6\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardFooter({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-footer\"\n      className={cn(\"flex items-center px-6 [.border-t]:pt-6\", className)}\n      {...props}\n    />\n  )\n}\n\nexport {\n  Card,\n  CardHeader,\n  CardFooter,\n  CardTitle,\n  CardDescription,\n  CardContent,\n  CardAction,\n}\n",
+      "content": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Card({\n  className,\n  size = \"default\",\n  ...props\n}: React.ComponentProps<\"div\"> & { size?: \"default\" | \"sm\" }) {\n  return (\n    <div\n      data-slot=\"card\"\n      data-size={size}\n      className={cn(\n        \"group/card rounded-base flex flex-col shadow-shadow border-2 gap-(--card-spacing) py-(--card-spacing) border-border bg-background text-foreground font-base [--card-spacing:--spacing(6)] data-[size=sm]:[--card-spacing:--spacing(4)]\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardHeader({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-header\"\n      className={cn(\n        \"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-(--card-spacing)\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardTitle({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-title\"\n      className={cn(\"font-heading leading-none\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardDescription({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-description\"\n      className={cn(\"text-sm font-base\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardAction({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-action\"\n      className={cn(\n        \"col-start-2 row-span-2 row-start-1 self-start justify-self-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardContent({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-content\"\n      className={cn(\"px-(--card-spacing)\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardFooter({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-footer\"\n      className={cn(\n        \"flex items-center px-(--card-spacing) [.border-t]:pt-(--card-spacing)\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport {\n  Card,\n  CardHeader,\n  CardFooter,\n  CardTitle,\n  CardDescription,\n  CardContent,\n  CardAction,\n}\n",
       "type": "registry:ui"
     }
   ]
```

---

### Incident Patch 5: `16a6c74c` (2026-09-08)
**Commit Message**: rebuild registry

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `public/r/calendar.json` (modified, +3/-3)
```diff
@@ -4,16 +4,16 @@
   "type": "registry:ui",
   "title": "Calendar",
   "dependencies": [
-    "react-day-picker@8.10.1",
-    "date-fns"
+    "react-day-picker@^9",
+    "date-fns@^4"
   ],
   "registryDependencies": [
     "https://neobrutalism.dev/r/nbutton.json"
   ],
   "files": [
     {
       "path": "src/components/ui/calendar.tsx",
-      "content": "\"use client\"\r\n\r\nimport { ChevronLeft, ChevronRight } from \"lucide-react\"\r\nimport { DayPicker } from \"react-day-picker\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { buttonVariants } from \"@/components/ui/button\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nexport type CalendarProps = React.ComponentProps<typeof DayPicker>\r\n\r\nfunction Calendar({\r\n  className,\r\n  classNames,\r\n  showOutsideDays = true,\r\n  ...props\r\n}: CalendarProps) {\r\n  return (\r\n    <DayPicker\r\n      showOutsideDays={showOutsideDays}\r\n      className={cn(\r\n        \"rounded-base! border-2 border-border bg-main p-3 font-heading shadow-shadow\",\r\n        className,\r\n      )}\r\n      classNames={{\r\n        months: \"flex flex-col sm:flex-row gap-2\",\r\n        month: \"flex flex-col gap-4\",\r\n        caption:\r\n          \"flex justify-center pt-1 relative items-center w-full text-main-foreground\",\r\n        caption_label: \"text-sm font-heading\",\r\n        nav: \"gap-1 flex items-center\",\r\n        nav_button: cn(\r\n          buttonVariants({ variant: \"noShadow\" }),\r\n          \"size-7 bg-transparent p-0\",\r\n        ),\r\n        nav_button_previous: \"absolute left-1\",\r\n        nav_button_next: \"absolute right-1\",\r\n        table: \"w-full border-collapse space-y-1\",\r\n        head_row: \"flex\",\r\n        head_cell:\r\n          \"text-main-foreground rounded-base w-9 font-base text-[0.8rem]\",\r\n        row: \"flex w-full mt-2\",\r\n        cell: cn(\r\n          \"relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-black/50 [&:has([aria-selected])]:text-white! [&:has([aria-selected].day-range-end)]:rounded-r-base\",\r\n          props.mode === \"range\"\r\n            ? \"[&:has(>.day-range-end)]:rounded-r-base [&:has(>.day-range-start)]:rounded-l-base [&:has([aria-selected])]:bg-black/50! first:[&:has([aria-selected])]:rounded-l-base last:[&:has([aria-selected])]:rounded-r-base\"\r\n            : \"[&:has([aria-selected])]:rounded-base [&:has([aria-selected])]:bg-black/50\",\r\n        ),\r\n        day: cn(\r\n          buttonVariants({ variant: \"noShadow\" }),\r\n          \"size-9 p-0 font-base aria-selected:opacity-100\",\r\n        ),\r\n        day_range_start:\r\n          \"day-range-start aria-selected:bg-black! aria-selected:text-white rounded-base\",\r\n        day_range_end:\r\n          \"day-range-end aria-selected:bg-black! aria-selected:text-white rounded-base\",\r\n        day_selected: \"bg-black! text-white! rounded-base\",\r\n        day_today: \"bg-secondary-background text-foreground!\",\r\n        day_outside:\r\n          \"day-outside text-main-foreground opacity-50 aria-selected:bg-none\",\r\n        day_disabled: \"text-main-foreground opacity-50 rounded-base\",\r\n        day_range_middle: \"aria-selected:bg-black/50! aria-selected:text-white\",\r\n        day_hidden: \"invisible\",\r\n        ...classNames,\r\n      }}\r\n      components={{\r\n        IconLeft: ({ className, ...props }) => (\r\n          <ChevronLeft className={cn(\"size-4\", className)} {...props} />\r\n        ),\r\n        IconRight: ({ className, ...props }) => (\r\n          <ChevronRight className={cn(\"size-4\", className)} {...props} />\r\n        ),\r\n      }}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\nCalendar.displayName = \"Calendar\"\r\n\r\nexport { Calendar }\r\n",
+      "content": "\"use client\"\n\nimport { ChevronDown, ChevronLeft, ChevronRight } from \"lucide-react\"\nimport {\n  DayPicker,\n  getDefaultClassNames,\n  type DayButton,\n} from \"react-day-picker\"\n\nimport * as React from \"react\"\n\nimport { buttonVariants } from \"@/components/ui/button\"\n\nimport { cn } from \"@/lib/utils\"\n\nexport type CalendarProps = React.ComponentProps<typeof DayPicker>\n\nfunction Calendar({\n  className,\n  classNames,\n  showOutsideDays = true,\n  captionLayout = \"label\",\n  formatters,\n  components,\n  ...props\n}: CalendarProps) {\n  const defaultClassNames = getDefaultClassNames()\n\n  return (\n    <DayPicker\n      showOutsideDays={showOutsideDays}\n      className={cn(\n        \"group/calendar rounded-base border-2 border-border bg-background p-3 font-heading text-foreground shadow-shadow\",\n        className,\n      )}\n      captionLayout={captionLayout}\n      formatters={{\n        formatMonthDropdown: (date) =>\n          date.toLocaleString(\"default\", { month: \"short\" }),\n        ...formatters,\n      }}\n      classNames={{\n        root: cn(\"w-fit\", defaultClassNames.root),\n        months: cn(\n          \"rela
```

**File**: `public/r/card.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "files": [
     {
       "path": "src/components/ui/card.tsx",
-      "content": "import * as React from \"react\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nfunction Card({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"card\"\r\n      className={cn(\r\n        \"rounded-base flex flex-col shadow-shadow border-2 gap-6 py-6 border-border bg-background text-foreground font-base\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction CardHeader({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"card-header\"\r\n      className={cn(\r\n        \"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-[data-slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction CardTitle({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"card-title\"\r\n      className={cn(\"font-heading leading-none\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction CardDescription({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"card-description\"\r\n      className={cn(\"text-sm font-base\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction CardAction({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"card-action\"\r\n      className={cn(\r\n        \"col-start-2 row-span-2 row-start-1 self-start justify-self-end\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction CardContent({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"card-content\"\r\n      className={cn(\"px-6\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction CardFooter({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  return (\r\n    <div\r\n      data-slot=\"card-footer\"\r\n      className={cn(\"flex items-center px-6 [.border-t]:pt-6\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nexport {\r\n  Card,\r\n  CardHeader,\r\n  CardFooter,\r\n  CardTitle,\r\n  CardDescription,\r\n  CardContent,\r\n  CardAction,\r\n}\r\n",
+      "content": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Card({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card\"\n      className={cn(\n        \"rounded-base flex flex-col shadow-shadow border-2 gap-6 py-6 border-border bg-background text-foreground font-base\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardHeader({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-header\"\n      className={cn(\n        \"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-[data-slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardTitle({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-title\"\n      className={cn(\"font-heading leading-none\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardDescription({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-description\"\n      className={cn(\"text-sm font-base\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardAction({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-action\"\n      className={cn(\n        \"col-start-2 row-span-2 row-start-1 self-start justify-self-end\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CardContent({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-content\"\n      className={cn(\"px-6\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CardFooter({ className, ...props }: React.ComponentProps<\"div\">) {\n  return (\n    <div\n      data-slot=\"card-footer\"\n      className={cn(\"flex items-center px-6 [.border-t]:pt-6\", className)}\n      {...props}\n    />\n  )\n}\n\nexport {\n  Card,\n  CardHeader,\n  CardFooter,\n  CardTitle,\n  CardDescription,\n  CardContent,\n  CardAction,\n}\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/carousel.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   "files": [
     {
       "path": "src/components/ui/carousel.tsx",
-      "content": "\"use client\"\r\n\r\nimport useEmblaCarousel, {\r\n  type UseEmblaCarouselType,\r\n} from \"embla-carousel-react\"\r\nimport { ArrowLeft, ArrowRight } from \"lucide-react\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { Button } from \"@/components/ui/button\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\ntype CarouselApi = UseEmblaCarouselType[1]\r\ntype UseCarouselParameters = Parameters<typeof useEmblaCarousel>\r\ntype CarouselOptions = UseCarouselParameters[0]\r\ntype CarouselPlugin = UseCarouselParameters[1]\r\n\r\ntype CarouselProps = {\r\n  opts?: CarouselOptions\r\n  plugins?: CarouselPlugin\r\n  orientation?: \"horizontal\" | \"vertical\"\r\n  setApi?: (api: CarouselApi) => void\r\n}\r\n\r\ntype CarouselContextProps = {\r\n  carouselRef: ReturnType<typeof useEmblaCarousel>[0]\r\n  api: ReturnType<typeof useEmblaCarousel>[1]\r\n  scrollPrev: () => void\r\n  scrollNext: () => void\r\n  canScrollPrev: boolean\r\n  canScrollNext: boolean\r\n  plugins?: CarouselPlugin\r\n} & CarouselProps\r\n\r\nconst CarouselContext = React.createContext<CarouselContextProps | null>(null)\r\n\r\nfunction useCarousel() {\r\n  const context = React.useContext(CarouselContext)\r\n\r\n  if (!context) {\r\n    throw new Error(\"useCarousel must be used within a <Carousel />\")\r\n  }\r\n\r\n  return context\r\n}\r\n\r\nfunction Carousel({\r\n  orientation = \"horizontal\",\r\n  opts,\r\n  setApi,\r\n  plugins,\r\n  className,\r\n  children,\r\n  ...props\r\n}: React.ComponentProps<\"div\"> & CarouselProps) {\r\n  const [carouselRef, api] = useEmblaCarousel(\r\n    {\r\n      ...opts,\r\n      axis: orientation === \"horizontal\" ? \"x\" : \"y\",\r\n    },\r\n    plugins,\r\n  )\r\n  const [canScrollPrev, setCanScrollPrev] = React.useState(false)\r\n  const [canScrollNext, setCanScrollNext] = React.useState(false)\r\n\r\n  const onSelect = React.useCallback((api: CarouselApi) => {\r\n    if (!api) {\r\n      return\r\n    }\r\n\r\n    setCanScrollPrev(api.canScrollPrev())\r\n    setCanScrollNext(api.canScrollNext())\r\n  }, [])\r\n\r\n  const scrollPrev = React.useCallback(() => {\r\n    api?.scrollPrev()\r\n  }, [api])\r\n\r\n  const scrollNext = React.useCallback(() => {\r\n    api?.scrollNext()\r\n  }, [api])\r\n\r\n  const handleKeyDown = React.useCallback(\r\n    (event: React.KeyboardEvent<HTMLDivElement>) => {\r\n      if (event.key === \"ArrowLeft\") {\r\n        event.preventDefault()\r\n        scrollPrev()\r\n      } else if (event.key === \"ArrowRight\") {\r\n        event.preventDefault()\r\n        scrollNext()\r\n      }\r\n    },\r\n    [scrollPrev, scrollNext],\r\n  )\r\n\r\n  React.useEffect(() => {\r\n    if (!api || !setApi) {\r\n      return\r\n    }\r\n\r\n    setApi(api)\r\n  }, [api, setApi])\r\n\r\n  React.useEffect(() => {\r\n    if (!api) {\r\n      return\r\n    }\r\n\r\n    onSelect(api)\r\n    api.on(\"reInit\", onSelect)\r\n    api.on(\"select\", onSelect)\r\n\r\n    return () => {\r\n      api?.off(\"select\", onSelect)\r\n    }\r\n  }, [api, onSelect])\r\n\r\n  return (\r\n    <CarouselContext.Provider\r\n      value={{\r\n        carouselRef,\r\n        api: api,\r\n        opts,\r\n        orientation:\r\n          orientation || (opts?.axis === \"y\" ? \"vertical\" : \"horizontal\"),\r\n        scrollPrev,\r\n        scrollNext,\r\n        canScrollPrev,\r\n        canScrollNext,\r\n      }}\r\n    >\r\n      <div\r\n        onKeyDownCapture={handleKeyDown}\r\n        className={cn(\"relative\", className)}\r\n        role=\"region\"\r\n        aria-roledescription=\"carousel\"\r\n        data-slot=\"carousel\"\r\n        {...props}\r\n      >\r\n        {children}\r\n      </div>\r\n    </CarouselContext.Provider>\r\n  )\r\n}\r\n\r\nfunction CarouselContent({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  const { carouselRef, orientation } = useCarousel()\r\n\r\n  return (\r\n    <div\r\n      ref={carouselRef}\r\n      className=\"overflow-hidden\"\r\n      data-slot=\"carousel-content\"\r\n    >\r\n      <div\r\n        className={cn(\r\n          \"flex\",\r\n          orientation === \"horizontal\" ? \"-ml-4\" : \"-mt-4 flex-col\",\r\n          className,\r\n        )}\r\n        {...props}\r\n      />\r\n    </div>\r\n  )\r\n}\r\n\r\nfunction CarouselItem({ className, ...props }: React.ComponentProps<\"div\">) {\r\n  const { orientation } = useCarousel()\r\n\r\n  return (\r\n    <div\r\n      data-slot=\"carousel-item\"\r\n      role=\"group\"\r\n      aria-roledescription=\"slide\"\r\n      className={cn(\r\n        \"min-w-0 shrink-0 grow-0 basis-full\",\r\n        orientation === \"horizontal\" ? \"pl-4\" : \"pt-4\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction CarouselPrevious({\r\n  className,\r\n  variant = \"noShadow\",\r\n  size = \"icon\",\r\n  ...props\r\n}: React.ComponentProps<typeof Button>) {
```

**File**: `public/r/chart.json` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@
   "type": "registry:ui",
   "title": "Chart",
   "dependencies": [
-    "recharts",
+    "recharts@^3",
     "lucide-react"
   ],
   "registryDependencies": [
@@ -13,7 +13,7 @@
   "files": [
     {
       "path": "src/components/ui/chart.tsx",
-      "content": "\"use client\"\n\nimport * as RechartsPrimitive from \"recharts\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\n// Format: { THEME_NAME: CSS_SELECTOR }\nconst THEMES = { light: \"\" } as const\n\nexport type ChartConfig = {\n  [k in string]: {\n    label?: React.ReactNode\n    icon?: React.ComponentType\n  } & (\n    | { color?: string; theme?: never }\n    | { color?: never; theme: Record<keyof typeof THEMES, string> }\n  )\n}\n\ntype ChartContextProps = {\n  config: ChartConfig\n}\n\nconst ChartContext = React.createContext<ChartContextProps | null>(null)\n\nfunction useChart() {\n  const context = React.useContext(ChartContext)\n\n  if (!context) {\n    throw new Error(\"useChart must be used within a <ChartContainer />\")\n  }\n\n  return context\n}\n\nfunction ChartContainer({\n  id,\n  className,\n  children,\n  config,\n  ...props\n}: React.ComponentProps<\"div\"> & {\n  config: ChartConfig\n  children: React.ComponentProps<\n    typeof RechartsPrimitive.ResponsiveContainer\n  >[\"children\"]\n}) {\n  const uniqueId = React.useId()\n  const chartId = `chart-${id || uniqueId.replace(/:/g, \"\")}`\n\n  return (\n    <ChartContext.Provider value={{ config }}>\n      <div\n        data-slot=\"chart\"\n        data-chart={chartId}\n        className={cn(\n          \"[&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-[#80808080] [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[#80808080] [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-black [&_.recharts-polar-grid_[stroke='#ccc' [&_.recharts-reference-line_[stroke='#ccc']]:stroke-black [&_.recharts-reference-line_[stroke='#ccc' flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-border [&_.recharts-surface]:outline-hidden\",\n          \"[&_.recharts-layer_path]:[fill-opacity:1] [&_.recharts-layer_path]:[stroke-width:2] [&_.recharts-layer_path]:[stroke:var(--color-border)]\",\n          className,\n        )}\n        {...props}\n      >\n        <ChartStyle id={chartId} config={config} />\n        <RechartsPrimitive.ResponsiveContainer>\n          {children}\n        </RechartsPrimitive.ResponsiveContainer>\n      </div>\n    </ChartContext.Provider>\n  )\n}\n\nconst ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {\n  const colorConfig = Object.entries(config).filter(\n    ([, config]) => config.theme || config.color,\n  )\n\n  if (!colorConfig.length) {\n    return null\n  }\n\n  return (\n    <style\n      dangerouslySetInnerHTML={{\n        __html: Object.entries(THEMES)\n          .map(\n            ([theme, prefix]) => `\n${prefix} [data-chart=${id}] {\n${colorConfig\n  .map(([key, itemConfig]) => {\n    const color =\n      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||\n      itemConfig.color\n    return color ? `  --color-${key}: ${color};` : null\n  })\n  .join(\"\\n\")}\n}\n`,\n          )\n          .join(\"\\n\"),\n      }}\n    />\n  )\n}\n\nconst ChartTooltip = RechartsPrimitive.Tooltip\n\nfunction ChartTooltipContent({\n  active,\n  payload,\n  className,\n  indicator = \"dot\",\n  hideLabel = false,\n  hideIndicator = false,\n  label,\n  labelFormatter,\n  labelClassName,\n  formatter,\n  color,\n  nameKey,\n  labelKey,\n}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &\n  React.ComponentProps<\"div\"> & {\n    hideLabel?: boolean\n    hideIndicator?: boolean\n    indicator?: \"line\" | \"dot\" | \"dashed\"\n    nameKey?: string\n    labelKey?: string\n  }) {\n  const { config } = useChart()\n\n  const tooltipLabel = React.useMemo(() => {\n    if (hideLabel || !payload?.length) {\n      return null\n    }\n\n    const [item] = payload\n    const key = `${labelKey || item?.dataKey || item?.name || \"value\"}`\n    const itemConfig = getPayloadConfigFromPayload(config, item, key)\n    const value =\n      !labelKey && typeof label === \"string\"\n        ? config[label as keyof typeof config]?.label || label\n        : itemConfig?.label\n\n    if (labelFormatter) {\n      return (\n        <div className={cn(\"font-heading\", labelClassName)}>\n          {labelFormatter(value, payload)}\n        </div>\n      )\n    }\n\n    if (!value) {\n      return null\n    }\n\n    return <div className={cn(\"font-base\", labelClassName)}>{value}</div>\n  }, [\n    label,\n    labelFormatter,\n    payload,\n    hideLabel,\n    labelClassName,\n    config,\n    labelKey,\n  ])\n\n  if (!active || !payload?.length) {\n    return null\n  }\n\n  const nestLabel = payload.length === 1 && indicator !== \"dot\"\n\n  return (\n
```

**File**: `public/r/command.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   "files": [
     {
       "path": "src/components/ui/command.tsx",
-      "content": "\"use client\"\n\nimport { Command as CommandPrimitive } from \"cmdk\"\nimport { Search } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport {\n  Dialog,\n  DialogContent,\n  DialogDescription,\n  DialogHeader,\n  DialogTitle,\n} from \"@/components/ui/dialog\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Command({\n  className,\n  ...props\n}: React.ComponentProps<typeof CommandPrimitive>) {\n  return (\n    <CommandPrimitive\n      data-slot=\"command\"\n      className={cn(\n        \"flex h-full w-full flex-col overflow-hidden rounded-[0px] border-2 border-border bg-main font-base text-main-foreground\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CommandDialog({\n  title = \"Command Palette\",\n  description = \"Search for a command to run...\",\n  children,\n  ...props\n}: Omit<React.ComponentProps<typeof Dialog>, \"children\"> & {\n  title?: string\n  description?: string\n  children: React.ReactNode\n}) {\n  return (\n    <Dialog {...props}>\n      <DialogHeader className=\"sr-only\">\n        <DialogTitle>{title}</DialogTitle>\n        <DialogDescription>{description}</DialogDescription>\n      </DialogHeader>\n      <DialogContent className=\"overflow-hidden p-0 rounded-[0px]! shadow-shadow border-0\">\n        <Command className=\"**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-heading [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5\">\n          {children}\n        </Command>\n      </DialogContent>\n    </Dialog>\n  )\n}\n\nfunction CommandInput({\n  className,\n  ...props\n}: React.ComponentProps<typeof CommandPrimitive.Input>) {\n  return (\n    <div\n      data-slot=\"command-input-wrapper\"\n      className=\"flex h-9 gap-2 items-center border-b-2 border-border px-3\"\n    >\n      <Search className=\"size-4 shrink-0\" />\n      <CommandPrimitive.Input\n        data-slot=\"command-input\"\n        className={cn(\n          \"flex h-10 w-full rounded-base bg-transparent py-3 text-sm outline-hidden placeholder:text-main-foreground placeholder:opacity-50 disabled:cursor-not-allowed disabled:opacity-50\",\n          className,\n        )}\n        {...props}\n      />\n    </div>\n  )\n}\n\nfunction CommandList({\n  className,\n  ...props\n}: React.ComponentProps<typeof CommandPrimitive.List>) {\n  return (\n    <CommandPrimitive.List\n      data-slot=\"command-list\"\n      className={cn(\n        \"max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CommandEmpty({\n  className,\n  ...props\n}: React.ComponentProps<typeof CommandPrimitive.Empty>) {\n  return (\n    <CommandPrimitive.Empty\n      data-slot=\"command-empty\"\n      className={cn(\"py-6 text-center text-sm\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CommandGroup({\n  className,\n  ...props\n}: React.ComponentProps<typeof CommandPrimitive.Group>) {\n  return (\n    <CommandPrimitive.Group\n      data-slot=\"command-group\"\n      className={cn(\n        \"text-main-foreground overflow-hidden p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-base [&_[cmdk-group-heading]]:font-heading\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CommandSeparator({\n  className,\n  ...props\n}: React.ComponentProps<typeof CommandPrimitive.Separator>) {\n  return (\n    <CommandPrimitive.Separator\n      data-slot=\"command-separator\"\n      className={cn(\"-mx-1 h-0.5 bg-border\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction CommandItem({\n  className,\n  ...props\n}: React.ComponentProps<typeof CommandPrimitive.Item>) {\n  return (\n    <CommandPrimitive.Item\n      data-slot=\"command-item\"\n      className={cn(\n        \"relative flex cursor-default select-none items-center rounded-base px-2 py-1.5 gap-2 text-sm text-main-foreground outline-border outline-0 aria-selected:outline-2 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction CommandShortcut({\n  className,\n  ...props\n}: React.ComponentProps<\"span\">) {\n  return (\n    <span\n      data-slot=\"command-shortcut\"\n      className={cn(\n        \"ml-auto text-xs tracking-widest text-main-foreground\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport {\n  Command,\n  CommandDialog,\n  CommandInput,\n  CommandList,\n  CommandEmpty,\n  CommandGroup,\n  CommandItem,\n  CommandShortcut,\n  CommandSeparator,
```

**File**: `public/r/context-menu.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   "files": [
     {
       "path": "src/components/ui/context-menu.tsx",
-      "content": "\"use client\"\n\nimport { ContextMenu as ContextMenuPrimitive } from \"@base-ui/react/context-menu\"\nimport { Check, ChevronRight, Circle } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\n// Base UI's GroupLabel must live inside a Group or RadioGroup. Track that so a\n// standalone label (like Radix allowed) still renders instead of throwing.\nconst ContextMenuGroupContext = React.createContext(false)\n\nfunction ContextMenu({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {\n  return <ContextMenuPrimitive.Root data-slot=\"context-menu\" {...props} />\n}\n\nfunction ContextMenuTrigger({\n  className,\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {\n  return (\n    <ContextMenuPrimitive.Trigger\n      data-slot=\"context-menu-trigger\"\n      className={cn(\"select-none\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction ContextMenuGroup({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {\n  return (\n    <ContextMenuGroupContext.Provider value={true}>\n      <ContextMenuPrimitive.Group data-slot=\"context-menu-group\" {...props} />\n    </ContextMenuGroupContext.Provider>\n  )\n}\n\nfunction ContextMenuPortal({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {\n  return (\n    <ContextMenuPrimitive.Portal data-slot=\"context-menu-portal\" {...props} />\n  )\n}\n\nfunction ContextMenuSub({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuRoot>) {\n  return (\n    <ContextMenuPrimitive.SubmenuRoot data-slot=\"context-menu-sub\" {...props} />\n  )\n}\n\nfunction ContextMenuRadioGroup({\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {\n  return (\n    <ContextMenuGroupContext.Provider value={true}>\n      <ContextMenuPrimitive.RadioGroup\n        data-slot=\"context-menu-radio-group\"\n        {...props}\n      />\n    </ContextMenuGroupContext.Provider>\n  )\n}\n\nfunction ContextMenuSubTrigger({\n  className,\n  inset,\n  children,\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuTrigger> & {\n  inset?: boolean\n}) {\n  return (\n    <ContextMenuPrimitive.SubmenuTrigger\n      data-slot=\"context-menu-sub-trigger\"\n      data-inset={inset}\n      className={cn(\n        \"flex cursor-default select-none items-center rounded-base border-2 border-transparent bg-main px-2 py-1.5 text-sm font-base text-main-foreground outline-hidden data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus:border-border data-highlighted:border-border data-popup-open:border-border\",\n        className,\n      )}\n      {...props}\n    >\n      {children}\n      <ChevronRight className=\"ml-auto\" />\n    </ContextMenuPrimitive.SubmenuTrigger>\n  )\n}\n\nconst contextMenuPopupClassName =\n  \"z-50 min-w-[8rem] overflow-hidden rounded-base border-2 border-border bg-main p-1 font-base text-main-foreground outline-none origin-(--transform-origin) data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2\"\n\nfunction ContextMenuSubContent({\n  className,\n  align,\n  alignOffset,\n  side,\n  sideOffset,\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Popup> &\n  Pick<\n    React.ComponentProps<typeof ContextMenuPrimitive.Positioner>,\n    \"align\" | \"alignOffset\" | \"side\" | \"sideOffset\"\n  >) {\n  return (\n    <ContextMenuPrimitive.Portal>\n      <ContextMenuPrimitive.Positioner\n        className=\"isolate z-50 outline-none\"\n        align={align}\n        alignOffset={alignOffset}\n        side={side}\n        sideOffset={sideOffset}\n      >\n        <ContextMenuPrimitive.Popup\n          data-slot=\"context-menu-sub-content\"\n          className={cn(contextMenuPopupClassName, className)}\n          {...props}\n        />\n      </ContextMenuPrimitive.Positioner>\n    </ContextMenuPrimitive.Portal>\n  )\n}\n\nfunction ContextMenuContent({\n  className,\n  align,\n  alignOffset,\n  side,\n  sideOffset,\n  ...props\n}: React.ComponentProps<typeof ContextMenuPrimitive.Popup> &\n  Pick<\n    React.ComponentProps<typeof ContextMenuPrimitive.Positioner>,\n    \"align\" | \"alignOffset\" | \"side\" | \"sideOffset\"\n  >) {\n  return (\n    <ContextMenuPrimitive.Portal>\n      <ContextMenuPrimitive.Positioner\n        className=\"isolate z-50 outline-none\"\n        align={align}\n        alignOffset={alignOffset}\n        side={side}\n        sideOffset={sideOffset}\n      >\n        <ContextMenuPrimiti
```

**File**: `public/r/hover-card.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   "files": [
     {
       "path": "src/components/ui/hover-card.tsx",
-      "content": "\"use client\"\n\nimport { PreviewCard as HoverCardPrimitive } from \"@base-ui/react/preview-card\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction HoverCard({\n  ...props\n}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {\n  return <HoverCardPrimitive.Root data-slot=\"hover-card\" {...props} />\n}\n\nfunction HoverCardTrigger({\n  ...props\n}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {\n  return (\n    <HoverCardPrimitive.Trigger data-slot=\"hover-card-trigger\" {...props} />\n  )\n}\n\nfunction HoverCardContent({\n  className,\n  align = \"center\",\n  alignOffset = 0,\n  side = \"bottom\",\n  sideOffset = 4,\n  ...props\n}: React.ComponentProps<typeof HoverCardPrimitive.Popup> &\n  Pick<\n    React.ComponentProps<typeof HoverCardPrimitive.Positioner>,\n    \"align\" | \"alignOffset\" | \"side\" | \"sideOffset\"\n  >) {\n  return (\n    <HoverCardPrimitive.Portal>\n      <HoverCardPrimitive.Positioner\n        align={align}\n        alignOffset={alignOffset}\n        side={side}\n        sideOffset={sideOffset}\n        className=\"isolate z-50\"\n      >\n        <HoverCardPrimitive.Popup\n          data-slot=\"hover-card-content\"\n          className={cn(\n            \"z-50 w-64 rounded-base border-2 border-border bg-main p-4 font-base text-main-foreground outline-none origin-(--transform-origin) data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2\",\n            className,\n          )}\n          {...props}\n        />\n      </HoverCardPrimitive.Positioner>\n    </HoverCardPrimitive.Portal>\n  )\n}\n\nexport { HoverCard, HoverCardTrigger, HoverCardContent }\n",
+      "content": "\"use client\"\n\nimport { PreviewCard as HoverCardPrimitive } from \"@base-ui/react/preview-card\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction HoverCard({\n  ...props\n}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {\n  return <HoverCardPrimitive.Root data-slot=\"hover-card\" {...props} />\n}\n\nfunction HoverCardTrigger({\n  ...props\n}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {\n  return (\n    <HoverCardPrimitive.Trigger data-slot=\"hover-card-trigger\" {...props} />\n  )\n}\n\nfunction HoverCardContent({\n  className,\n  align = \"center\",\n  alignOffset = 0,\n  side = \"bottom\",\n  sideOffset = 4,\n  ...props\n}: React.ComponentProps<typeof HoverCardPrimitive.Popup> &\n  Pick<\n    React.ComponentProps<typeof HoverCardPrimitive.Positioner>,\n    \"align\" | \"alignOffset\" | \"side\" | \"sideOffset\"\n  >) {\n  return (\n    <HoverCardPrimitive.Portal>\n      <HoverCardPrimitive.Positioner\n        align={align}\n        alignOffset={alignOffset}\n        side={side}\n        sideOffset={sideOffset}\n        className=\"isolate z-50\"\n      >\n        <HoverCardPrimitive.Popup\n          data-slot=\"hover-card-content\"\n          className={cn(\n            \"z-50 w-64 rounded-base border-2 border-border bg-background p-4 font-base text-foreground outline-none origin-(--transform-origin) data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2\",\n            className,\n          )}\n          {...props}\n        />\n      </HoverCardPrimitive.Positioner>\n    </HoverCardPrimitive.Portal>\n  )\n}\n\nexport { HoverCard, HoverCardTrigger, HoverCardContent }\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/image-card.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "files": [
     {
       "path": "src/components/ui/image-card.tsx",
-      "content": "import { cn } from \"@/lib/utils\"\r\n\r\ntype Props = {\r\n  imageUrl: string\r\n  caption: string\r\n  className?: string\r\n}\r\n\r\nexport default function ImageCard({ imageUrl, caption, className }: Props) {\r\n  return (\r\n    <figure\r\n      className={cn(\r\n        \"w-[250px] overflow-hidden rounded-base border-2 border-border bg-main font-base shadow-shadow\",\r\n        className,\r\n      )}\r\n    >\r\n      <img className=\"w-full aspect-4/3\" src={imageUrl} alt=\"image\" />\r\n      <figcaption className=\"border-t-2 text-main-foreground border-border p-4\">\r\n        {caption}\r\n      </figcaption>\r\n    </figure>\r\n  )\r\n}\r\n",
+      "content": "import { cn } from \"@/lib/utils\"\n\ntype Props = {\n  imageUrl: string\n  caption: string\n  className?: string\n}\n\nexport default function ImageCard({ imageUrl, caption, className }: Props) {\n  return (\n    <figure\n      className={cn(\n        \"w-[250px] overflow-hidden rounded-base border-2 border-border bg-background font-base shadow-shadow\",\n        className,\n      )}\n    >\n      <img className=\"w-full aspect-4/3\" src={imageUrl} alt=\"image\" />\n      <figcaption className=\"border-t-2 text-foreground border-border p-4\">\n        {caption}\n      </figcaption>\n    </figure>\n  )\n}\n",
       "type": "registry:ui"
     }
   ]
```

---

### Incident Patch 6: `8d9a748c` (2026-09-08)
**Commit Message**: fix charts page layout after client navigation

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/styling/marquee.css` (modified, +27/-78)
```diff
@@ -1,33 +1,13 @@
-button,
-[type="button"],
-[type="reset"],
-[type="submit"] {
-  -webkit-appearance: button;
-}
-:-moz-focusring {
-  outline: auto;
-}
-:-moz-ui-invalid {
-  box-shadow: none;
-}
-progress {
-  vertical-align: baseline;
-}
-::-webkit-inner-spin-button,
-::-webkit-outer-spin-button {
-  height: auto;
-}
-[type="search"] {
-  -webkit-appearance: textfield;
-  outline-offset: -2px;
-}
-::-webkit-search-decoration {
-  -webkit-appearance: none;
-}
-::-webkit-file-upload-button {
-  -webkit-appearance: button;
-  font: inherit;
-}
+/*
+ * Styles for the @devnomic/marquee component used on the home page.
+ *
+ * The library's own stylesheet ships unlayered copies of generic Tailwind
+ * utilities (.flex-col, .overflow-hidden, ...) which override the real
+ * utilities on every page this file is loaded on. Only the marquee-specific
+ * rules are kept here, scoped to the marquee's own elements. Generic classes
+ * the library applies (flex, flex-row, flex-col, shrink-0, overflow-hidden)
+ * come from Tailwind.
+ */
 
 @keyframes marquee-left {
   from {
@@ -37,9 +17,7 @@ progress {
     transform: translateX(calc(-100% - var(--gap)));
   }
 }
-.animate-marquee-left {
-  animation: marquee-left var(--duration, 100s) linear infinite;
-}
+
 @keyframes marquee-up {
   from {
     transform: translateY(0);
@@ -48,60 +26,31 @@ progress {
     transform: translateY(calc(-100% - var(--gap)));
   }
 }
-.animate-marquee-up {
-  animation: marquee-up var(--duration, 40s) linear infinite;
-}
-.flex-row {
-  flex-direction: row;
-}
-.flex-col {
-  flex-direction: column;
+
+/* Outer container: `group flex gap-[1rem] overflow-hidden` */
+.group.overflow-hidden.gap-\[1rem\] {
+  gap: var(--gap, 20px);
 }
-.justify-around {
+
+/* Scrolling rows: `flex justify-around gap-[1rem] [--gap:1rem] shrink-0` */
+.animate-marquee-left,
+.animate-marquee-up {
   justify-content: space-around;
-}
-.gap-\[1rem\] {
-  gap: 20px;
+  gap: var(--gap, 20px);
 }
 
-.overflow-hidden {
-  overflow: hidden;
-}
-@keyframes enter {
-  from {
-    opacity: var(--tw-enter-opacity, 1);
-    transform: translate3d(
-        var(--tw-enter-translate-x, 0),
-        var(--tw-enter-translate-y, 0),
-        0
-      )
-      scale3d(
-        var(--tw-enter-scale, 1),
-        var(--tw-enter-scale, 1),
-        var(--tw-enter-scale, 1)
-      )
-      rotate(var(--tw-enter-rotate, 0));
-  }
+.animate-marquee-left {
+  animation: marquee-left var(--duration, 100s) linear infinite;
 }
-@keyframes exit {
-  to {
-    opacity: var(--tw-exit-opacity, 1);
-    transform: translate3d(
-        var(--tw-exit-translate-x, 0),
-        var(--tw-exit-translate-y, 0),
-        0
-      )
-      scale3d(
-        var(--tw-exit-scale, 1),
-        var(--tw-exit-scale, 1),
-        var(--tw-exit-scale, 1)
-      )
-      rotate(var(--tw-exit-rotate, 0));
-  }
+
+.animate-marquee-up {
+  animation: marquee-up var(--duration, 40s) linear infinite;
 }
+
 .direction-reverse {
   animation-direction: reverse;
 }
+
 .\[--gap\:1rem\] {
   --gap: 20px;
 }
```

---

### Incident Patch 7: `1d19a669` (2026-09-08)
**Commit Message**: Rebuild registry

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

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
+      "content": "\"use client\"\n\nimport { AlertDialog as AlertDialogPrimitive } from \"@base-ui/react/alert-dialog\"\n\nimport * as React from \"react\"\n\nimport { buttonVariants } from \"@/components/ui/button\"\n\nimport { cn } from \"@/lib/u
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
+      "content": "\"use client\"\n\nimport { Avatar as AvatarPrimitive } from \"@base-ui/react/avatar\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Avatar({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Root>) {\n  return (\n    <AvatarPrimitive.Root\n      data-slot=\"avatar\"\n      className={cn(\n        \"relative flex size-10 shrink-0 overflow-hidden rounded-full outline-2 outline-border\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarImage({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Image>) {\n  return (\n    <AvatarPrimitive.Image\n      data-slot=\"avatar-image\"\n      className={cn(\"aspect-square size-full\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction AvatarFallback({\n  className,\n  ...props\n}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {\n  return (\n    <AvatarPrimitive.Fallback\n      data-slot=\"avatar-fallback\"\n      className={cn(\n        \"flex size-full items-center justify-center rounded-full bg-secondary-background text-foreground font-base\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nexport { Avatar, AvatarImage, AvatarFallback }\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/badge.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "files": [
     {
       "path": "src/components/ui/badge.tsx",
-      "content": "import { Slot } from \"@radix-ui/react-slot\"\r\nimport { cva, type VariantProps } from \"class-variance-authority\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nconst badgeVariants = cva(\r\n  \"inline-flex items-center justify-center rounded-base border-2 border-border px-2.5 py-0.5 text-xs font-base w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] overflow-hidden\",\r\n  {\r\n    variants: {\r\n      variant: {\r\n        default: \"bg-main text-main-foreground\",\r\n        neutral: \"bg-secondary-background text-foreground\",\r\n      },\r\n    },\r\n    defaultVariants: {\r\n      variant: \"default\",\r\n    },\r\n  },\r\n)\r\n\r\nfunction Badge({\r\n  className,\r\n  variant,\r\n  asChild = false,\r\n  ...props\r\n}: React.ComponentProps<\"span\"> &\r\n  VariantProps<typeof badgeVariants> & {\r\n    asChild?: boolean\r\n  }) {\r\n  const Comp = asChild ? Slot : \"span\"\r\n\r\n  return (\r\n    <Comp\r\n      data-slot=\"badge\"\r\n      className={cn(badgeVariants({ variant }), className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nexport { Badge, badgeVariants }\r\n",
+      "content": "\"use client\"\n\nimport { mergeProps } from \"@base-ui/react/merge-props\"\nimport { useRender } from \"@base-ui/react/use-render\"\nimport { cva, type VariantProps } from \"class-variance-authority\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst badgeVariants = cva(\n  \"inline-flex items-center justify-center rounded-base border-2 border-border px-2.5 py-0.5 text-xs font-base w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] overflow-hidden\",\n  {\n    variants: {\n      variant: {\n        default: \"bg-background text-foreground\",\n        neutral: \"bg-secondary-background text-foreground\",\n      },\n    },\n    defaultVariants: {\n      variant: \"default\",\n    },\n  },\n)\n\nfunction Badge({\n  className,\n  variant,\n  render,\n  ...props\n}: useRender.ComponentProps<\"span\"> & VariantProps<typeof badgeVariants>) {\n  return useRender({\n    defaultTagName: \"span\",\n    render,\n    props: mergeProps<\"span\">(\n      {\n        className: cn(badgeVariants({ variant }), className),\n      },\n      props,\n    ),\n    state: {\n      slot: \"badge\",\n      variant: variant ?? \"default\",\n    },\n  })\n}\n\nexport { Badge, badgeVariants }\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/breadcrumb.json` (modified, +2/-2)
```diff
@@ -4,12 +4,12 @@
   "type": "registry:ui",
   "title": "Breadcrumb",
   "dependencies": [
-    "@radix-ui/react-slot"
+    "@base-ui/react"
   ],
   "files": [
     {
       "path": "src/components/ui/breadcrumb.tsx",
-      "content": "import { Slot } from \"@radix-ui/react-slot\"\r\nimport { ChevronRight, MoreHorizontal } from \"lucide-react\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nfunction Breadcrumb({ ...props }: React.ComponentProps<\"nav\">) {\r\n  return <nav data-slot=\"breadcrumb\" aria-label=\"breadcrumb\" {...props} />\r\n}\r\n\r\nfunction BreadcrumbList({ className, ...props }: React.ComponentProps<\"ol\">) {\r\n  return (\r\n    <ol\r\n      data-slot=\"breadcrumb-list\"\r\n      className={cn(\r\n        \"flex flex-wrap items-center gap-1.5 text-sm font-base break-words text-foreground sm:gap-2.5\",\r\n        className,\r\n      )}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction BreadcrumbItem({ className, ...props }: React.ComponentProps<\"li\">) {\r\n  return (\r\n    <li\r\n      data-slot=\"breadcrumb-item\"\r\n      className={cn(\"inline-flex items-center gap-1.5\", className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction BreadcrumbLink({\r\n  asChild,\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<\"a\"> & {\r\n  asChild?: boolean\r\n}) {\r\n  const Comp = asChild ? Slot : \"a\"\r\n\r\n  return (\r\n    <Comp data-slot=\"breadcrumb-link\" className={cn(className)} {...props} />\r\n  )\r\n}\r\n\r\nfunction BreadcrumbPage({ className, ...props }: React.ComponentProps<\"span\">) {\r\n  return (\r\n    <span\r\n      data-slot=\"breadcrumb-page\"\r\n      role=\"link\"\r\n      aria-disabled=\"true\"\r\n      aria-current=\"page\"\r\n      className={cn(className)}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nfunction BreadcrumbSeparator({\r\n  children,\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<\"li\">) {\r\n  return (\r\n    <li\r\n      data-slot=\"breadcrumb-separator\"\r\n      role=\"presentation\"\r\n      aria-hidden=\"true\"\r\n      className={cn(\"[&>svg]:size-3.5\", className)}\r\n      {...props}\r\n    >\r\n      {children ?? <ChevronRight />}\r\n    </li>\r\n  )\r\n}\r\n\r\nfunction BreadcrumbEllipsis({\r\n  className,\r\n  ...props\r\n}: React.ComponentProps<\"span\">) {\r\n  return (\r\n    <span\r\n      data-slot=\"breadcrumb-ellipsis\"\r\n      role=\"presentation\"\r\n      aria-hidden=\"true\"\r\n      className={cn(\"flex size-9 items-center justify-center\", className)}\r\n      {...props}\r\n    >\r\n      <MoreHorizontal className=\"size-4\" />\r\n      <span className=\"sr-only\">More</span>\r\n    </span>\r\n  )\r\n}\r\n\r\nexport {\r\n  Breadcrumb,\r\n  BreadcrumbList,\r\n  BreadcrumbItem,\r\n  BreadcrumbLink,\r\n  BreadcrumbPage,\r\n  BreadcrumbSeparator,\r\n  BreadcrumbEllipsis,\r\n}\r\n",
+      "content": "\"use client\"\n\nimport { mergeProps } from \"@base-ui/react/merge-props\"\nimport { useRender } from \"@base-ui/react/use-render\"\nimport { ChevronRight, MoreHorizontal } from \"lucide-react\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction Breadcrumb({ ...props }: React.ComponentProps<\"nav\">) {\n  return <nav data-slot=\"breadcrumb\" aria-label=\"breadcrumb\" {...props} />\n}\n\nfunction BreadcrumbList({ className, ...props }: React.ComponentProps<\"ol\">) {\n  return (\n    <ol\n      data-slot=\"breadcrumb-list\"\n      className={cn(\n        \"flex flex-wrap items-center gap-1.5 text-sm font-base break-words text-foreground sm:gap-2.5\",\n        className,\n      )}\n      {...props}\n    />\n  )\n}\n\nfunction BreadcrumbItem({ className, ...props }: React.ComponentProps<\"li\">) {\n  return (\n    <li\n      data-slot=\"breadcrumb-item\"\n      className={cn(\"inline-flex items-center gap-1.5\", className)}\n      {...props}\n    />\n  )\n}\n\nfunction BreadcrumbLink({\n  className,\n  render,\n  ...props\n}: useRender.ComponentProps<\"a\">) {\n  return useRender({\n    defaultTagName: \"a\",\n    render,\n    props: mergeProps<\"a\">({ className: cn(className) }, props),\n    state: {\n      slot: \"breadcrumb-link\",\n    },\n  })\n}\n\nfunction BreadcrumbPage({ className, ...props }: React.ComponentProps<\"span\">) {\n  return (\n    <span\n      data-slot=\"breadcrumb-page\"\n      role=\"link\"\n      aria-disabled=\"true\"\n      aria-current=\"page\"\n      className={cn(className)}\n      {...props}\n    />\n  )\n}\n\nfunction BreadcrumbSeparator({\n  children,\n  className,\n  ...props\n}: React.ComponentProps<\"li\">) {\n  return (\n    <li\n      data-slot=\"breadcrumb-separator\"\n      role=\"presentation\"\n      aria-hidden=\"true\"\n      className={cn(\"[&>svg]:size-3.5\", className)}\n      {...props}\n    >\n      {children ?? <ChevronRight />}\n    </li>\n  )\n}\n\nfunction BreadcrumbEllipsis({\n  className,\n  ...props\n}: React.ComponentProps<\"span\">) {\n  return (\n    <span\n   
```

**File**: `public/r/button.json` (modified, +2/-2)
```diff
@@ -4,12 +4,12 @@
   "type": "registry:ui",
   "title": "Button",
   "dependencies": [
-    "@radix-ui/react-slot"
+    "@base-ui/react"
   ],
   "files": [
     {
       "path": "src/components/ui/button.tsx",
-      "content": "import { Slot } from \"@radix-ui/react-slot\"\r\nimport { cva, type VariantProps } from \"class-variance-authority\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\nconst buttonVariants = cva(\r\n  \"inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base ring-offset-white transition-all gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50\",\r\n  {\r\n    variants: {\r\n      variant: {\r\n        default:\r\n          \"text-main-foreground bg-main border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none\",\r\n        noShadow: \"text-main-foreground bg-main border-2 border-border\",\r\n        neutral:\r\n          \"bg-secondary-background text-foreground border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none\",\r\n        reverse:\r\n          \"text-main-foreground bg-main border-2 border-border hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow\",\r\n      },\r\n      size: {\r\n        default: \"h-10 px-4 py-2\",\r\n        sm: \"h-9 px-3\",\r\n        lg: \"h-11 px-8\",\r\n        icon: \"size-10\",\r\n      },\r\n    },\r\n    defaultVariants: {\r\n      variant: \"default\",\r\n      size: \"default\",\r\n    },\r\n  },\r\n)\r\n\r\nfunction Button({\r\n  className,\r\n  variant,\r\n  size,\r\n  asChild = false,\r\n  ...props\r\n}: React.ComponentProps<\"button\"> &\r\n  VariantProps<typeof buttonVariants> & {\r\n    asChild?: boolean\r\n  }) {\r\n  const Comp = asChild ? Slot : \"button\"\r\n\r\n  return (\r\n    <Comp\r\n      data-slot=\"button\"\r\n      className={cn(buttonVariants({ variant, size, className }))}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nexport { Button, buttonVariants }\r\n",
+      "content": "import { Button as ButtonPrimitive } from \"@base-ui/react/button\"\nimport { cva, type VariantProps } from \"class-variance-authority\"\n\nimport * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst buttonVariants = cva(\n  \"inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base ring-offset-white transition-all gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50\",\n  {\n    variants: {\n      variant: {\n        default:\n          \"text-main-foreground bg-main border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none\",\n        noShadow: \"text-main-foreground bg-main border-2 border-border\",\n        neutral:\n          \"bg-secondary-background text-foreground border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none\",\n        reverse:\n          \"text-main-foreground bg-main border-2 border-border hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow\",\n      },\n      size: {\n        default: \"h-10 px-4 py-2\",\n        sm: \"h-9 px-3\",\n        lg: \"h-11 px-8\",\n        icon: \"size-10\",\n      },\n    },\n    defaultVariants: {\n      variant: \"default\",\n      size: \"default\",\n    },\n  },\n)\n\nfunction Button({\n  className,\n  variant,\n  size,\n  ...props\n}: React.ComponentProps<typeof ButtonPrimitive> &\n  VariantProps<typeof buttonVariants>) {\n  return (\n    <ButtonPrimitive\n      data-slot=\"button\"\n      className={cn(buttonVariants({ variant, size, className }))}\n      {...props}\n    />\n  )\n}\n\nexport { Button, buttonVariants }\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `public/r/chart.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
   "files": [
     {
       "path": "src/components/ui/chart.tsx",
-      "content": "\"use client\"\r\n\r\nimport * as RechartsPrimitive from \"recharts\"\r\n\r\nimport * as React from \"react\"\r\n\r\nimport { cn } from \"@/lib/utils\"\r\n\r\n// Format: { THEME_NAME: CSS_SELECTOR }\r\nconst THEMES = { light: \"\", dark: \".dark\" } as const\r\n\r\nexport type ChartConfig = {\r\n  [k in string]: {\r\n    label?: React.ReactNode\r\n    icon?: React.ComponentType\r\n  } & (\r\n    | { color?: string; theme?: never }\r\n    | { color?: never; theme: Record<keyof typeof THEMES, string> }\r\n  )\r\n}\r\n\r\ntype ChartContextProps = {\r\n  config: ChartConfig\r\n}\r\n\r\nconst ChartContext = React.createContext<ChartContextProps | null>(null)\r\n\r\nfunction useChart() {\r\n  const context = React.useContext(ChartContext)\r\n\r\n  if (!context) {\r\n    throw new Error(\"useChart must be used within a <ChartContainer />\")\r\n  }\r\n\r\n  return context\r\n}\r\n\r\nfunction ChartContainer({\r\n  id,\r\n  className,\r\n  children,\r\n  config,\r\n  ...props\r\n}: React.ComponentProps<\"div\"> & {\r\n  config: ChartConfig\r\n  children: React.ComponentProps<\r\n    typeof RechartsPrimitive.ResponsiveContainer\r\n  >[\"children\"]\r\n}) {\r\n  const uniqueId = React.useId()\r\n  const chartId = `chart-${id || uniqueId.replace(/:/g, \"\")}`\r\n\r\n  return (\r\n    <ChartContext.Provider value={{ config }}>\r\n      <div\r\n        data-slot=\"chart\"\r\n        data-chart={chartId}\r\n        className={cn(\r\n          \"[&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-[#80808080] [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[#80808080] [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-black [&_.recharts-polar-grid_[stroke='#ccc']]:dark:stroke-white [&_.recharts-reference-line_[stroke='#ccc']]:stroke-black [&_.recharts-reference-line_[stroke='#ccc']]:dark:stroke-white flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-border [&_.recharts-surface]:outline-hidden\",\r\n          \"[&_.recharts-layer_path]:[fill-opacity:1] [&_.recharts-layer_path]:[stroke-width:2] [&_.recharts-layer_path]:[stroke:var(--color-border)]\",\r\n          className,\r\n        )}\r\n        {...props}\r\n      >\r\n        <ChartStyle id={chartId} config={config} />\r\n        <RechartsPrimitive.ResponsiveContainer>\r\n          {children}\r\n        </RechartsPrimitive.ResponsiveContainer>\r\n      </div>\r\n    </ChartContext.Provider>\r\n  )\r\n}\r\n\r\nconst ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {\r\n  const colorConfig = Object.entries(config).filter(\r\n    ([, config]) => config.theme || config.color,\r\n  )\r\n\r\n  if (!colorConfig.length) {\r\n    return null\r\n  }\r\n\r\n  return (\r\n    <style\r\n      dangerouslySetInnerHTML={{\r\n        __html: Object.entries(THEMES)\r\n          .map(\r\n            ([theme, prefix]) => `\r\n${prefix} [data-chart=${id}] {\r\n${colorConfig\r\n  .map(([key, itemConfig]) => {\r\n    const color =\r\n      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||\r\n      itemConfig.color\r\n    return color ? `  --color-${key}: ${color};` : null\r\n  })\r\n  .join(\"\\n\")}\r\n}\r\n`,\r\n          )\r\n          .join(\"\\n\"),\r\n      }}\r\n    />\r\n  )\r\n}\r\n\r\nconst ChartTooltip = RechartsPrimitive.Tooltip\r\n\r\nfunction ChartTooltipContent({\r\n  active,\r\n  payload,\r\n  className,\r\n  indicator = \"dot\",\r\n  hideLabel = false,\r\n  hideIndicator = false,\r\n  label,\r\n  labelFormatter,\r\n  labelClassName,\r\n  formatter,\r\n  color,\r\n  nameKey,\r\n  labelKey,\r\n}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &\r\n  React.ComponentProps<\"div\"> & {\r\n    hideLabel?: boolean\r\n    hideIndicator?: boolean\r\n    indicator?: \"line\" | \"dot\" | \"dashed\"\r\n    nameKey?: string\r\n    labelKey?: string\r\n  }) {\r\n  const { config } = useChart()\r\n\r\n  const tooltipLabel = React.useMemo(() => {\r\n    if (hideLabel || !payload?.length) {\r\n      return null\r\n    }\r\n\r\n    const [item] = payload\r\n    const key = `${labelKey || item?.dataKey || item?.name || \"value\"}`\r\n    const itemConfig = getPayloadConfigFromPayload(config, item, key)\r\n    const value =\r\n      !labelKey && typeof label === \"string\"\r\n        ? config[label as keyof typeof config]?.label || label\r\n        : itemConfig?.label\r\n\r\n    if (labelFormatter) {\r\n      return (\r\n        <div className={cn(\"font-heading\", labelClassName)}>\r\n          {labelFormatter(value, payload)}\r\n        </div>\r\n      )\r\n    }\r\n\r\n    if (!value) {\r\n      return null\r\n    }\r\n\r\n    return <div className={cn(\"font-base\", labelClassName)}>{value}</div>\r\n  }, [\r\n    label,\r\n    labelFormatter,\r\n    payload,\r\n    hideLab
```

---

### Incident Patch 8: `b062466a` (2026-09-08)
**Commit Message**: Add Base UI migration guide and update docs

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/markdown/components/accordion.mdx` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ import {
 ```
 
 ```tsx
-<Accordion type="single" collapsible className="w-full max-w-xl">
+<Accordion className="w-full max-w-xl">
   <AccordionItem value="item-1">
     <AccordionTrigger>Is it accessible?</AccordionTrigger>
     <AccordionContent>
```

**File**: `src/markdown/components/alert-dialog.mdx` (modified, +1/-3)
```diff
@@ -35,9 +35,7 @@ import { Button } from '@/components/ui/button'
 
 ```tsx
 <AlertDialog>
-  <AlertDialogTrigger asChild>
-    <Button>Open</Button>
-  </AlertDialogTrigger>
+  <AlertDialogTrigger render={<Button />}>Open</AlertDialogTrigger>
   <AlertDialogContent>
     <AlertDialogHeader>
       <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
```

**File**: `src/markdown/components/collapsible.mdx` (modified, +7/-13)
```diff
@@ -42,29 +42,23 @@ const [isOpen, setIsOpen] = React.useState(false)
   onOpenChange={setIsOpen}
   className="w-[350px] space-y-2"
 >
-  <div className="rounded-base flex items-center justify-between space-x-4 border-2 border-border text-main-foreground bg-main px-4 py-2">
+  <div className="rounded-base flex items-center justify-between space-x-4 border-2 border-border text-foreground bg-background px-4 py-2">
     <h4 className="text-sm font-heading">
       @peduarte starred 3 repositories
     </h4>
-    <CollapsibleTrigger asChild>
-      <Button
-        variant="noShadow"
-        size="sm"
-        className="w-9 bg-secondary-background text-foreground p-0"
-      >
+    <CollapsibleTrigger render={<Button variant="noShadow" size="sm" className="w-9 bg-secondary-background text-foreground p-0" />}>
         <ChevronsUpDown className="size-4" />
         <span className="sr-only">Toggle</span>
-      </Button>
-    </CollapsibleTrigger>
+      </CollapsibleTrigger>
   </div>
-  <div className="rounded-base border-2 border-border bg-main px-4 py-3 font-mono font-base text-main-foreground text-sm">
+  <div className="rounded-base border-2 border-border bg-background px-4 py-3 font-mono font-base text-foreground text-sm">
     @radix-ui/primitives
   </div>
-  <CollapsibleContent className="space-y-2 text-main-foreground font-base">
-    <div className="rounded-base border-2 border-border bg-main px-4 py-3 font-mono text-sm">
+  <CollapsibleContent className="space-y-2 text-foreground font-base">
+    <div className="rounded-base border-2 border-border bg-background px-4 py-3 font-mono text-sm">
       @radix-ui/colors
     </div>
-    <div className="rounded-base border-2 border-border bg-main px-4 py-3 font-mono text-sm">
+    <div className="rounded-base border-2 border-border bg-background px-4 py-3 font-mono text-sm">
       @stitches/react
     </div>
   </CollapsibleContent>
```

**File**: `src/markdown/components/date-picker.mdx` (modified, +2/-7)
```diff
@@ -38,15 +38,10 @@ const [date, setDate] = React.useState<Date>()
 
 ```tsx
 <Popover>
-  <PopoverTrigger asChild>
-    <Button
-      variant="noShadow"
-      className="w-[280px] justify-start text-left font-base"
-    >
+  <PopoverTrigger render={<Button variant="noShadow" className="w-[280px] justify-start text-left font-base" />}>
       <CalendarIcon />
       {date ? format(date, "PPP") : <span>Pick a date</span>}
-    </Button>
-  </PopoverTrigger>
+    </PopoverTrigger>
   <PopoverContent className="w-auto border-0! p-0">
     <Calendar
       mode="single"
```

**File**: `src/markdown/components/dialog.mdx` (modified, +2/-6)
```diff
@@ -37,9 +37,7 @@ import { Label } from "@/components/ui/label"
 ```tsx
 <Dialog>
   <form>
-    <DialogTrigger asChild>
-      <Button>Edit Profile</Button>
-    </DialogTrigger>
+    <DialogTrigger render={<Button />}>Edit Profile</DialogTrigger>
     <DialogContent className="sm:max-w-[425px]">
       <DialogHeader>
         <DialogTitle>Edit profile</DialogTitle>
@@ -59,9 +57,7 @@ import { Label } from "@/components/ui/label"
         </div>
       </div>
       <DialogFooter>
-        <DialogClose asChild>
-          <Button variant="neutral">Cancel</Button>
-        </DialogClose>
+        <DialogClose render={<Button variant="neutral" />}>Cancel</DialogClose>
         <Button type="submit">Save changes</Button>
       </DialogFooter>
     </DialogContent>
```

**File**: `src/markdown/components/drawer.mdx` (modified, +4/-8)
```diff
@@ -34,22 +34,18 @@ import {
 
 ```tsx
 <Drawer>
-  <DrawerTrigger asChild>
-    <Button>Open</Button>
-  </DrawerTrigger>
+  <DrawerTrigger render={<Button />}>Open</DrawerTrigger>
   <DrawerContent>
     <div className="mx-auto w-[300px]">
       <DrawerHeader>
         <DrawerTitle>Are you absolutely sure?</DrawerTitle>
         <DrawerDescription>This action cannot be undone.</DrawerDescription>
       </DrawerHeader>
       <DrawerFooter className="grid grid-cols-2">
-        <Button example="noShadow">Submit</Button>
-        <DrawerClose asChild>
-          <Button className="bg-secondary-background text-foreground" example="noShadow">
+        <Button variant="noShadow">Submit</Button>
+        <DrawerClose render={<Button className="bg-secondary-background text-foreground" variant="noShadow" />}>
             Cancel
-          </Button>
-        </DrawerClose>
+          </DrawerClose>
       </DrawerFooter>
     </div>
   </DrawerContent>
```

**File**: `src/markdown/components/dropdown-menu.mdx` (modified, +161/-166)
```diff
@@ -1,167 +1,162 @@
----
-title: Dropdown Menu
-description: Displays a menu to the user — such as a set of actions or functions.
-shadcnDocsLink: https://ui.shadcn.com/docs/components/dropdown-menu
----
-
-<ComponentPreview component="dropdown-menu">
-  ```tsx file=<rootDir>/src/examples/ui/dropdown-menu/index.tsx
-  ```
-</ComponentPreview>
-
-## Installation
-
-<Installation component="dropdown-menu">
-  ```tsx file=<rootDir>/src/components/ui/dropdown-menu.tsx
-  ```
-</Installation>
-
-## Usage
-
-```ts
-import {
-  Cloud,
-  CreditCard,
-  Github,
-  Keyboard,
-  LifeBuoy,
-  LogOut,
-  Mail,
-  MessageSquare,
-  Plus,
-  PlusCircle,
-  Settings,
-  User,
-  UserPlus,
-  Users,
-} from 'lucide-react'
-
-import React from 'react'
-
-import { Button } from '@/components/ui/button'
-import {
-  DropdownMenu,
-  DropdownMenuContent,
-  DropdownMenuGroup,
-  DropdownMenuItem,
-  DropdownMenuLabel,
-  DropdownMenuPortal,
-  DropdownMenuSeparator,
-  DropdownMenuShortcut,
-  DropdownMenuSub,
-  DropdownMenuSubContent,
-  DropdownMenuSubTrigger,
-  DropdownMenuTrigger,
-} from '@/components/ui/dropdown-menu'
-```
-
-```tsx
-<DropdownMenu>
-  <DropdownMenuTrigger asChild>
-    <Button example={'noShadow'}>Open</Button>
-  </DropdownMenuTrigger>
-  <DropdownMenuContent className="w-56">
-    <DropdownMenuLabel>My Account</DropdownMenuLabel>
-    <DropdownMenuSeparator />
-    <DropdownMenuGroup>
-      <DropdownMenuItem>
-        <User />
-        <span>Profile</span>
-        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
-      </DropdownMenuItem>
-      <DropdownMenuItem>
-        <CreditCard />
-        <span>Billing</span>
-        <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
-      </DropdownMenuItem>
-      <DropdownMenuItem>
-        <Settings />
-        <span>Settings</span>
-        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
-      </DropdownMenuItem>
-      <DropdownMenuItem>
-        <Keyboard />
-        <span>Keyboard shortcuts</span>
-        <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
-      </DropdownMenuItem>
-    </DropdownMenuGroup>
-    <DropdownMenuSeparator />
-    <DropdownMenuGroup>
-      <DropdownMenuItem>
-        <Users />
-        <span>Team</span>
-      </DropdownMenuItem>
-      <DropdownMenuSub>
-        <DropdownMenuSubTrigger>
-          <UserPlus />
-          <span>Invite users</span>
-        </DropdownMenuSubTrigger>
-        <DropdownMenuPortal>
-          <DropdownMenuSubContent>
-            <DropdownMenuItem>
-              <Mail />
-              <span>Email</span>
-            </DropdownMenuItem>
-            <DropdownMenuItem>
-              <MessageSquare />
-              <span>Message</span>
-            </DropdownMenuItem>
-            <DropdownMenuSeparator />
-            <DropdownMenuItem>
-              <PlusCircle />
-              <span>More...</span>
-            </DropdownMenuItem>
-          </DropdownMenuSubContent>
-        </DropdownMenuPortal>
-      </DropdownMenuSub>
-      <DropdownMenuItem>
-        <Plus />
-        <span>New Team</span>
-        <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
-      </DropdownMenuItem>
-    </DropdownMenuGroup>
-    <DropdownMenuSeparator />
-    <DropdownMenuItem>
-      <Github />
-      <span>GitHub</span>
-    </DropdownMenuItem>
-    <DropdownMenuItem>
-      <LifeBuoy />
-      <span>Support</span>
-    </DropdownMenuItem>
-    <DropdownMenuItem disabled>
-      <Cloud />
-      <span>API</span>
-    </DropdownMenuItem>
-    <DropdownMenuSeparator />
-    <DropdownMenuItem>
-      <LogOut />
-      <span>Log out</span>
-      <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
-    </DropdownMenuItem>
-  </DropdownMenuContent>
-</DropdownMenu>
-```
-
-## Examples
-
-### Default
-
-<ComponentPreview component="dropdown-menu">
-  ```tsx file=<rootDir>/src/examples/ui/dropdown-menu/index.tsx
-  ```
-</ComponentPreview>
-
-### Checkboxes
-
-<ComponentPreview component="dropdown-menu" example="checkboxes">
-  ```tsx file=<rootDir>/src/examples/ui/dropdown-menu/checkboxes.tsx
-  ```
-</ComponentPreview>
-
-### Radio Group
-
-<ComponentPreview component="dropdown-menu" example="radio">
-  ```tsx file=<rootDir>/src/examples/ui/dropdown-menu/radio.tsx
-  ```
+---
+title: Dropdown Menu
+description: Displays a menu to the user — such as a set of actions or functions.
+shadcnDocsLink: https://ui.shadcn.com/docs/components/dropdown-menu
+---
+
+<ComponentPreview component="dropdown-menu">
+  ```tsx file=<rootDir>/src/examples/ui/dropdown-menu/index.tsx
+  ```
+</ComponentPreview>
+
+## Installation
+
+<Installation component="dropdown-menu">
+  ```tsx file=<rootDir>/src/components/ui/dropdown-menu.tsx
+  ```
+</Installation>
+
+## Usage
+
+```ts
+import {
+  Cloud,
+  CreditCard,
+  Github,
+  Keyboard,
+  LifeBuoy,
+  LogOut,
+  Mail,
+  MessageSquare,
+  Plus,
+  PlusCircle,
+  Settings,
+  User,
+  UserPlus,
+  Users,
+} from 'lucide-react'
+
+import React from 
```

**File**: `src/markdown/components/hover-card.mdx` (modified, +1/-3)
```diff
@@ -29,9 +29,7 @@ import {
 
 ```tsx
 <HoverCard>
-  <HoverCardTrigger asChild>
-    <Button example="noShadow">Hover</Button>
-  </HoverCardTrigger>
+  <HoverCardTrigger render={<Button variant="noShadow" />}>Hover</HoverCardTrigger>
   <HoverCardContent>
     The React Framework – created and maintained by @vercel.
   </HoverCardContent>
```

---

### Incident Patch 9: `100f580c` (2026-09-08)
**Commit Message**: Update site pages for Base UI and remove sonner

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

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

**File**: `src/app/charts/examples.tsx` (modified, +2/-2)
```diff
@@ -202,8 +202,8 @@ const ChartComponent = ({
     <div>
       {children}
       <Dialog>
-        <DialogTrigger asChild>
-          <Button className="mt-5 w-full">Copy</Button>
+        <DialogTrigger render={<Button className="mt-5 w-full" />}>
+          Copy
         </DialogTrigger>
         <DialogContent className="max-w-full">
           <DialogHeader>
```

**File**: `src/app/docs/[[...slug]]/page.tsx` (modified, +2/-2)
```diff
@@ -118,7 +118,7 @@ export default async function DocPage(props: DocPageProps) {
               )}
               {shadcnDocsLink && (
                 <a href={shadcnDocsLink} target="_blank">
-                  <Badge className="gap-2">
+                  <Badge variant="neutral" className="gap-2">
                     shadcn/ui docs
                     <ExternalLink />
                   </Badge>
@@ -143,7 +143,7 @@ export default async function DocPage(props: DocPageProps) {
                 <a
                   href="https://8bit.cnlibs.com/"
                   target="_blank"
-                  className="mt-4 block w-full rounded-base border-2 border-border bg-black px-3 py-1.5 text-center text-sm font-base text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
+                  className="mt-4 block w-full rounded-base border-2 border-border bg-black px-3 py-1.5 text-center text-sm font-base text-white transition-opacity hover:opacity-90"
                 >
                   Visit
                 </a>
```

**File**: `src/app/layout.tsx` (modified, +7/-16)
```diff
@@ -6,8 +6,6 @@ import { DM_Sans } from "next/font/google"
 import Navbar from "@/components/app/navbar"
 import ScrollToTop from "@/components/app/scroll-to-top"
 import SetStylingPref from "@/components/app/set-styling-pref"
-import { ThemeProvider } from "@/components/app/theme-provider"
-import { Toaster } from "@/components/ui/sonner"
 
 const dmSans = DM_Sans({
   subsets: ["latin"],
@@ -58,20 +56,13 @@ export default function RootLayout({
   children: React.ReactNode
 }) {
   return (
-    <html className="scroll-smooth" suppressHydrationWarning lang="en">
-      <body className={dmSans.className}>
-          <ThemeProvider
-            attribute="class"
-            defaultTheme="light"
-            disableTransitionOnChange
-          >
-            <Navbar />
-            {children}
-            <SetStylingPref />
-            <ScrollToTop />
-            <Toaster />
-          </ThemeProvider>
+    <html className="scroll-smooth" lang="en">
+      <body className={`${dmSans.className} isolate`}>
+        <Navbar />
+        {children}
+        <SetStylingPref />
+        <ScrollToTop />
       </body>
     </html>
   )
-}
\ No newline at end of file
+}
```

**File**: `src/app/page.tsx` (modified, +10/-14)
```diff
@@ -44,17 +44,17 @@ export default function Home() {
           <div className="flex flex-col items-center text-center">
             <h1 className="leading-normal">
               Get started with creating <br />{" "}
-              <span className="relative px-2 sm:mr-2 mr-0 md:[&_svg]:size-[45px] sm:[&_svg]:size-7 bg-main/50 rounded-base border-2 border-border/40 dark:border-border/70">
+              <span className="relative px-2 sm:mr-2 mr-0 md:[&_svg]:size-[45px] sm:[&_svg]:size-7 bg-main/50 rounded-base border-2 border-border/40">
                 neobrutalism
                 <Star9
                   className="absolute sm:block hidden md:-bottom-4 md:-right-5 -bottom-2.5 -right-2.5"
                   color="var(--main)"
-                  pathClassName="stroke-5 dark:stroke-3.5 stroke-black dark:stroke-black/70"
+                  pathClassName="stroke-5 stroke-black"
                 />
                 <Star9
                   className="absolute sm:block hidden md:-top-4 md:-left-5 -top-2.5 -left-2.5"
                   color="var(--main)"
-                  pathClassName="stroke-5 dark:stroke-3.5 stroke-black dark:stroke-black/70"
+                  pathClassName="stroke-5 stroke-black"
                 />
               </span>{" "}
               layouts.
@@ -112,7 +112,7 @@ export default function Home() {
               utility classes, enabling swift and straightforward styling.
             </p>
           </section>
-          <section className="border-b-4 border-border md:text-main-foreground md:dark:text-main-foreground md:bg-main text-main-foreground dark:text-foreground 2xl:p-14 2xl:py-16 xl:p-10 xl:py-10 lg:p-8 lg:py-10 p-5 py-7 bg-background">
+          <section className="border-b-4 border-border md:text-main-foreground md:bg-main text-main-foreground 2xl:p-14 2xl:py-16 xl:p-10 xl:py-10 lg:p-8 lg:py-10 p-5 py-7 bg-background">
             <div className="flex items-center sm:gap-6 gap-4 sm:mb-6 mb-4">
               <div className="xl:size-[70px] lg:size-[55px] sm:size-12 size-10 flex items-center justify-center">
                 <OpenSourceIcon />
@@ -126,7 +126,7 @@ export default function Home() {
               collaboration and allowing widespread adoption and modification.
             </p>
           </section>
-          <section className="md:border-r-4 md:border-b-0 border-border bg-main dark:text-main-foreground 2xl:p-14 2xl:py-16 xl:p-10 xl:py-10 lg:p-8 lg:py-10 p-5 py-7 border-b-4">
+          <section className="md:border-r-4 md:border-b-0 border-border bg-main 2xl:p-14 2xl:py-16 xl:p-10 xl:py-10 lg:p-8 lg:py-10 p-5 py-7 border-b-4">
             <div className="flex items-center sm:gap-6 gap-4 sm:mb-6 mb-4">
               <div className="xl:size-[70px] lg:size-[55px] sm:size-12 size-10 flex items-center justify-center">
                 <ShadcnIcon />
@@ -231,18 +231,14 @@ export default function Home() {
           </h2>
 
           <div className="mx-auto not-prose grid w-[700px] max-w-full px-5">
-            <Accordion
-              className="text-base sm:text-lg"
-              type="single"
-              collapsible
-            >
+            <Accordion className="text-base sm:text-lg">
               <AccordionItem className="mb-2" value="item-2">
                 <AccordionTrigger className="text-left">
                   Are these components accessible?
                 </AccordionTrigger>
                 <AccordionContent className="text-sm sm:text-base">
                   Most of the components are based on shadcn/ui, which means
-                  they are accessible because under the hood they use radix-ui
+                  they are accessible because under the hood they use Base UI
                   which is fully accessible.
                 </AccordionContent>
               </AccordionItem>
@@ -313,7 +309,7 @@ export default function Home() {
           </h2>
 
           <Link
-            className="flex items-center gap-2.5 w-max text-foreground rounded-base border-2 border-border bg-background dark:bg-secondary-background md:px-10 px-4 md:py-3 py-2 md:text-[22px] text-base shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
+            className="flex items-center gap-2.5 w-max text-foreground rounded-base border-2 border-border bg-background md:px-10 px-4 md:py-3 py-2 md:text-[22px] text-base shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
             href={"/docs"}
           >
             Read the docs
@@ -397,7 +393,7 @@ const OpenSourceIcon = () => (
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 768" fill="none">
     <path
       d="M400 10C615.398 10 790 184.585 790 399.958C790 557.315 696.772 692.954 562.483 754.562L468.604 510.384C505.457 487.481 530 446.609 530 399.958C530 328.161 471.802 269.971 400 269.971C328.198 269.971 270 328.161 270 399.958C270 446.619 294.587 487.487 331.438 510.419L
```

**File**: `src/app/stars/copy-btn.tsx` (modified, +9/-9)
```diff
@@ -24,15 +24,15 @@ export default function CopyBtn({ code }: { code: string }) {
 
   return (
     <Tooltip>
-      <TooltipTrigger asChild>
-        <Button onClick={handleCopy} variant="noShadow">
-          Copy
-          {copied ? (
-            <Check className="size-[18px]" />
-          ) : (
-            <Copy className="size-[18px]" />
-          )}
-        </Button>
+      <TooltipTrigger
+        render={<Button onClick={handleCopy} variant="noShadow" />}
+      >
+        Copy
+        {copied ? (
+          <Check className="size-[18px]" />
+        ) : (
+          <Copy className="size-[18px]" />
+        )}
       </TooltipTrigger>
       <TooltipContent>
         <p>Copy to clipboard</p>
```

**File**: `src/app/stars/shadcn-btn.tsx` (modified, +5/-5)
```diff
@@ -24,11 +24,11 @@ export default function ShadcnBtn({ command }: { command: string }) {
 
   return (
     <Tooltip>
-      <TooltipTrigger asChild>
-        <Button onClick={handleCopy} variant="noShadow">
-          Copy
-          {copied ? <Check className="size-[18px]" /> : <ShadcnIcon />}
-        </Button>
+      <TooltipTrigger
+        render={<Button onClick={handleCopy} variant="noShadow" />}
+      >
+        Copy
+        {copied ? <Check className="size-[18px]" /> : <ShadcnIcon />}
       </TooltipTrigger>
       <TooltipContent>
         <p>Copy Shadcn CLI command</p>
```

**File**: `src/app/stars/stars-grid.tsx` (modified, +7/-3)
```diff
@@ -23,7 +23,7 @@ export default function StarsGrid() {
     "pnpm dlx shadcn@latest add https://neobrutalism.dev/r/",
   )
 
-  const handleChange = (pkg: string) => {
+  const handleChange = (pkg: string | null) => {
     const command = "shadcn@latest add https://neobrutalism.dev/r/"
 
     if (pkg === "pnpm") {
@@ -40,7 +40,11 @@ export default function StarsGrid() {
   return (
     <>
       <div className="mb-5 flex justify-end">
-        <Select onValueChange={handleChange} defaultValue="pnpm">
+        <Select
+          onValueChange={handleChange}
+          defaultValue="pnpm"
+          items={{ pnpm: "Pnpm", npm: "Npm", yarn: "Yarn", bun: "Bun" }}
+        >
           <SelectTrigger className="w-[150px]">
             <SelectValue placeholder="Pnpm" />
           </SelectTrigger>
@@ -70,7 +74,7 @@ export default function StarsGrid() {
               <h4 className="font-heading">Star {i + 1}</h4>
 
               <div className="flex items-center gap-2">
-                <TooltipProvider delayDuration={0}>
+                <TooltipProvider delay={0}>
                   <ShadcnBtn command={command + `s${i + 1}.json`} />
                   <CopyBtn code={star.code} />
                 </TooltipProvider>
```

---

### Incident Patch 10: `89860559` (2026-09-08)
**Commit Message**: Update component examples for Base UI

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/data/components.ts` (modified, +0/-22)
```diff
@@ -75,14 +75,6 @@ import SliderDemo from "@/examples/ui/slider"
 import SliderControlled from "@/examples/ui/slider/controlled"
 import TwoThumbsSliderDemo from "@/examples/ui/slider/two-thumbs"
 import VerticalSliderDemo from "@/examples/ui/slider/vertical"
-import SonnerDemo from "@/examples/ui/sonner"
-import SonnerActionDemo from "@/examples/ui/sonner/action"
-import SonnerCancelDemo from "@/examples/ui/sonner/cancel"
-import SonnerErrorDemo from "@/examples/ui/sonner/error"
-import SonnerInfoDemo from "@/examples/ui/sonner/info"
-import SonnerPromiseDemo from "@/examples/ui/sonner/promise"
-import SonnerSuccessDemo from "@/examples/ui/sonner/success"
-import SonnerWarningDemo from "@/examples/ui/sonner/warning"
 import SwitchDemo from "@/examples/ui/switch"
 import TableDemo from "@/examples/ui/table"
 import TabsDemo from "@/examples/ui/tabs"
@@ -338,20 +330,6 @@ const COMPONENTS: Component[] = [
       controlled: SliderControlled,
     },
   },
-  {
-    name: "Sonner",
-    exampleComponent: SonnerDemo,
-    examples: {
-      default: SonnerDemo,
-      success: SonnerSuccessDemo,
-      info: SonnerInfoDemo,
-      warning: SonnerWarningDemo,
-      error: SonnerErrorDemo,
-      action: SonnerActionDemo,
-      cancel: SonnerCancelDemo,
-      promise: SonnerPromiseDemo,
-    },
-  },
   {
     name: "Switch",
     exampleComponent: SwitchDemo,
```

**File**: `src/examples/ui/accordion.tsx` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import {
 
 export default function AccordionDemo() {
   return (
-    <Accordion type="single" collapsible className="w-full max-w-xl">
+    <Accordion className="w-full max-w-xl">
       <AccordionItem value="item-1">
         <AccordionTrigger>Is it accessible?</AccordionTrigger>
         <AccordionContent>
```

**File**: `src/examples/ui/alert-dialog.tsx` (modified, +1/-3)
```diff
@@ -14,9 +14,7 @@ import { Button } from "@/components/ui/button"
 export default function AlertDialogDemo() {
   return (
     <AlertDialog>
-      <AlertDialogTrigger asChild>
-        <Button>Open</Button>
-      </AlertDialogTrigger>
+      <AlertDialogTrigger render={<Button />}>Open</AlertDialogTrigger>
       <AlertDialogContent>
         <AlertDialogHeader>
           <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
```

**File**: `src/examples/ui/carousel.tsx` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ export default function CarouselDemo() {
           {Array.from({ length: 5 }).map((_, index) => (
             <CarouselItem key={index}>
               <div className="p-[10px]">
-                <Card className="shadow-none p-0 bg-main text-main-foreground">
+                <Card className="shadow-none p-0 bg-background text-foreground">
                   <CardContent className="flex aspect-square items-center justify-center p-4">
                     <span className="text-3xl font-base">{index + 1}</span>
                   </CardContent>
```

**File**: `src/examples/ui/chart/chart-area-interactive.tsx` (modified, +9/-1)
```diff
@@ -163,7 +163,15 @@ export default function ChartAreaInteractive() {
             Showing total visitors for the last 3 months
           </CardDescription>
         </div>
-        <Select value={timeRange} onValueChange={setTimeRange}>
+        <Select
+          value={timeRange}
+          onValueChange={(value) => value && setTimeRange(value)}
+          items={{
+            "90d": "Last 3 months",
+            "30d": "Last 30 days",
+            "7d": "Last 7 days",
+          }}
+        >
           <SelectTrigger
             className="w-[160px] sm:ml-auto"
             aria-label="Select a value"
```

**File**: `src/examples/ui/chart/chart-line-default.tsx` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ export default function ChartLineDefault() {
       </CardHeader>
       <CardContent>
         <ChartContainer
-          className="[&_.recharts-layer_path]:stroke-black [&_.recharts-layer_path]:dark:stroke-white"
+          className="[&_.recharts-layer_path]:stroke-black"
           config={chartConfig}
         >
           <LineChart
```

**File**: `src/examples/ui/chart/chart-line-dots-colors.tsx` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ export default function ChartLineDotsColors() {
       </CardHeader>
       <CardContent>
         <ChartContainer
-          className="[&_.recharts-layer_path]:stroke-black [&_.recharts-layer_path]:dark:stroke-white"
+          className="[&_.recharts-layer_path]:stroke-black"
           config={chartConfig}
         >
           <LineChart
```

**File**: `src/examples/ui/chart/chart-line-dots-custom.tsx` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ export default function ChartLineDotsCustom() {
       </CardHeader>
       <CardContent>
         <ChartContainer
-          className="[&_.recharts-layer_path]:stroke-black [&_.recharts-layer_path]:dark:stroke-white"
+          className="[&_.recharts-layer_path]:stroke-black"
           config={chartConfig}
         >
           <LineChart
```

---

### Incident Patch 11: `565962af` (2026-09-08)
**Commit Message**: Rewrite ui components on Base UI

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/components/ui/accordion.tsx` (modified, +6/-8)
```diff
@@ -1,6 +1,6 @@
 "use client"
 
-import * as AccordionPrimitive from "@radix-ui/react-accordion"
+import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
 import { ChevronDown } from "lucide-react"
 
 import * as React from "react"
@@ -39,7 +39,7 @@ function AccordionTrigger({
       <AccordionPrimitive.Trigger
         data-slot="accordion-trigger"
         className={cn(
-          "flex flex-1 items-center justify-between text-left text-base text-main-foreground border-border focus-visible:ring-[3px] bg-main p-4 font-heading transition-all [&[data-state=open]>svg]:rotate-180 data-[state=open]:rounded-b-none data-[state=open]:border-b-2 disabled:pointer-events-none disabled:opacity-50",
+          "flex flex-1 items-center justify-between text-left text-base text-main-foreground border-border focus-visible:ring-[3px] bg-main p-4 font-heading transition-all [&[data-panel-open]>svg]:rotate-180 data-panel-open:rounded-b-none data-panel-open:border-b-2 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50",
           className,
         )}
         {...props}
@@ -55,18 +55,16 @@ function AccordionContent({
   className,
   children,
   ...props
-}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
+}: React.ComponentProps<typeof AccordionPrimitive.Panel>) {
   return (
-    <AccordionPrimitive.Content
+    <AccordionPrimitive.Panel
       data-slot="accordion-content"
-      className="overflow-hidden rounded-b-base bg-secondary-background text-sm font-base transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
+      className="h-(--accordion-panel-height) overflow-hidden rounded-b-base bg-secondary-background text-sm font-base transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0"
       {...props}
     >
       <div className={cn("p-4", className)}>{children}</div>
-    </AccordionPrimitive.Content>
+    </AccordionPrimitive.Panel>
   )
 }
 
-AccordionContent.displayName = AccordionPrimitive.Content.displayName
-
 export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
```

**File**: `src/components/ui/alert-dialog.tsx` (modified, +13/-11)
```diff
@@ -1,6 +1,6 @@
 "use client"
 
-import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
+import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
 
 import * as React from "react"
 
@@ -33,12 +33,12 @@ function AlertDialogPortal({
 function AlertDialogOverlay({
   className,
   ...props
-}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
+}: React.ComponentProps<typeof AlertDialogPrimitive.Backdrop>) {
   return (
-    <AlertDialogPrimitive.Overlay
+    <AlertDialogPrimitive.Backdrop
       data-slot="alert-dialog-overlay"
       className={cn(
-        "fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
+        "fixed inset-0 z-50 bg-overlay duration-200 fill-mode-forwards data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
         className,
       )}
       {...props}
@@ -49,14 +49,14 @@ function AlertDialogOverlay({
 function AlertDialogContent({
   className,
   ...props
-}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
+}: React.ComponentProps<typeof AlertDialogPrimitive.Popup>) {
   return (
     <AlertDialogPortal>
       <AlertDialogOverlay />
-      <AlertDialogPrimitive.Content
+      <AlertDialogPrimitive.Popup
         data-slot="alert-dialog-content"
         className={cn(
-          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-base border-2 border-border p-6 shadow-shadow duration-200 sm:max-w-lg",
+          "bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-base border-2 border-border p-6 shadow-shadow duration-200 outline-none sm:max-w-lg",
           className,
         )}
         {...props}
@@ -123,9 +123,10 @@ function AlertDialogDescription({
 function AlertDialogAction({
   className,
   ...props
-}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
+}: React.ComponentProps<typeof AlertDialogPrimitive.Close>) {
   return (
-    <AlertDialogPrimitive.Action
+    <AlertDialogPrimitive.Close
+      data-slot="alert-dialog-action"
       className={cn(buttonVariants(), className)}
       {...props}
     />
@@ -135,9 +136,10 @@ function AlertDialogAction({
 function AlertDialogCancel({
   className,
   ...props
-}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
+}: React.ComponentProps<typeof AlertDialogPrimitive.Close>) {
   return (
-    <AlertDialogPrimitive.Cancel
+    <AlertDialogPrimitive.Close
+      data-slot="alert-dialog-cancel"
       className={cn(buttonVariants({ variant: "neutral" }), className)}
       {...props}
     />
```

**File**: `src/components/ui/alert.tsx` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ const alertVariants = cva(
   {
     variants: {
       variant: {
-        default: "bg-main text-main-foreground",
+        default: "bg-background text-foreground",
         destructive: "bg-black text-white",
       },
     },
```

**File**: `src/components/ui/avatar.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 "use client"
 
-import * as AvatarPrimitive from "@radix-ui/react-avatar"
+import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
 
 import * as React from "react"
 
```

**File**: `src/components/ui/badge.tsx` (modified, +21/-16)
```diff
@@ -1,4 +1,7 @@
-import { Slot } from "@radix-ui/react-slot"
+"use client"
+
+import { mergeProps } from "@base-ui/react/merge-props"
+import { useRender } from "@base-ui/react/use-render"
 import { cva, type VariantProps } from "class-variance-authority"
 
 import * as React from "react"
@@ -10,7 +13,7 @@ const badgeVariants = cva(
   {
     variants: {
       variant: {
-        default: "bg-main text-main-foreground",
+        default: "bg-background text-foreground",
         neutral: "bg-secondary-background text-foreground",
       },
     },
@@ -23,21 +26,23 @@ const badgeVariants = cva(
 function Badge({
   className,
   variant,
-  asChild = false,
+  render,
   ...props
-}: React.ComponentProps<"span"> &
-  VariantProps<typeof badgeVariants> & {
-    asChild?: boolean
-  }) {
-  const Comp = asChild ? Slot : "span"
-
-  return (
-    <Comp
-      data-slot="badge"
-      className={cn(badgeVariants({ variant }), className)}
-      {...props}
-    />
-  )
+}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
+  return useRender({
+    defaultTagName: "span",
+    render,
+    props: mergeProps<"span">(
+      {
+        className: cn(badgeVariants({ variant }), className),
+      },
+      props,
+    ),
+    state: {
+      slot: "badge",
+      variant: variant ?? "default",
+    },
+  })
 }
 
 export { Badge, badgeVariants }
```

**File**: `src/components/ui/breadcrumb.tsx` (modified, +14/-10)
```diff
@@ -1,4 +1,7 @@
-import { Slot } from "@radix-ui/react-slot"
+"use client"
+
+import { mergeProps } from "@base-ui/react/merge-props"
+import { useRender } from "@base-ui/react/use-render"
 import { ChevronRight, MoreHorizontal } from "lucide-react"
 
 import * as React from "react"
@@ -33,17 +36,18 @@ function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
 }
 
 function BreadcrumbLink({
-  asChild,
   className,
+  render,
   ...props
-}: React.ComponentProps<"a"> & {
-  asChild?: boolean
-}) {
-  const Comp = asChild ? Slot : "a"
-
-  return (
-    <Comp data-slot="breadcrumb-link" className={cn(className)} {...props} />
-  )
+}: useRender.ComponentProps<"a">) {
+  return useRender({
+    defaultTagName: "a",
+    render,
+    props: mergeProps<"a">({ className: cn(className) }, props),
+    state: {
+      slot: "breadcrumb-link",
+    },
+  })
 }
 
 function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
```

**File**: `src/components/ui/button.tsx` (modified, +5/-10)
```diff
@@ -1,12 +1,12 @@
-import { Slot } from "@radix-ui/react-slot"
+import { Button as ButtonPrimitive } from "@base-ui/react/button"
 import { cva, type VariantProps } from "class-variance-authority"
 
 import * as React from "react"
 
 import { cn } from "@/lib/utils"
 
 const buttonVariants = cva(
-  "inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base ring-offset-white transition-all gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
+  "inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base ring-offset-white transition-all gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50",
   {
     variants: {
       variant: {
@@ -36,16 +36,11 @@ function Button({
   className,
   variant,
   size,
-  asChild = false,
   ...props
-}: React.ComponentProps<"button"> &
-  VariantProps<typeof buttonVariants> & {
-    asChild?: boolean
-  }) {
-  const Comp = asChild ? Slot : "button"
-
+}: React.ComponentProps<typeof ButtonPrimitive> &
+  VariantProps<typeof buttonVariants>) {
   return (
-    <Comp
+    <ButtonPrimitive
       data-slot="button"
       className={cn(buttonVariants({ variant, size, className }))}
       {...props}
```

**File**: `src/components/ui/calendar.tsx` (modified, +17/-16)
```diff
@@ -21,47 +21,48 @@ function Calendar({
     <DayPicker
       showOutsideDays={showOutsideDays}
       className={cn(
-        "rounded-base! border-2 border-border bg-main p-3 font-heading shadow-shadow",
+        "rounded-base! border-2 border-border bg-background p-3 font-heading shadow-shadow",
         className,
       )}
       classNames={{
         months: "flex flex-col sm:flex-row gap-2",
         month: "flex flex-col gap-4",
         caption:
-          "flex justify-center pt-1 relative items-center w-full text-main-foreground",
+          "flex justify-center pt-1 relative items-center w-full text-foreground",
         caption_label: "text-sm font-heading",
         nav: "gap-1 flex items-center",
         nav_button: cn(
           buttonVariants({ variant: "noShadow" }),
-          "size-7 bg-transparent p-0",
+          "size-7 bg-secondary-background p-0 text-foreground",
         ),
         nav_button_previous: "absolute left-1",
         nav_button_next: "absolute right-1",
         table: "w-full border-collapse space-y-1",
         head_row: "flex",
-        head_cell:
-          "text-main-foreground rounded-base w-9 font-base text-[0.8rem]",
+        head_cell: "text-foreground rounded-base w-9 font-base text-[0.8rem]",
         row: "flex w-full mt-2",
         cell: cn(
-          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-black/50 [&:has([aria-selected])]:text-white! [&:has([aria-selected].day-range-end)]:rounded-r-base",
+          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-main/50 [&:has([aria-selected])]:text-main-foreground! [&:has([aria-selected].day-range-end)]:rounded-r-base",
           props.mode === "range"
-            ? "[&:has(>.day-range-end)]:rounded-r-base [&:has(>.day-range-start)]:rounded-l-base [&:has([aria-selected])]:bg-black/50! first:[&:has([aria-selected])]:rounded-l-base last:[&:has([aria-selected])]:rounded-r-base"
-            : "[&:has([aria-selected])]:rounded-base [&:has([aria-selected])]:bg-black/50",
+            ? "[&:has(>.day-range-end)]:rounded-r-base [&:has(>.day-range-start)]:rounded-l-base [&:has([aria-selected])]:bg-main/50! first:[&:has([aria-selected])]:rounded-l-base last:[&:has([aria-selected])]:rounded-r-base"
+            : "[&:has([aria-selected])]:rounded-base [&:has([aria-selected])]:bg-main/50",
         ),
         day: cn(
           buttonVariants({ variant: "noShadow" }),
-          "size-9 p-0 font-base aria-selected:opacity-100",
+          "size-9 bg-secondary-background p-0 font-base text-foreground aria-selected:opacity-100",
         ),
         day_range_start:
-          "day-range-start aria-selected:bg-black! aria-selected:text-white rounded-base",
+          "day-range-start aria-selected:bg-main! aria-selected:text-main-foreground! rounded-base",
         day_range_end:
-          "day-range-end aria-selected:bg-black! aria-selected:text-white rounded-base",
-        day_selected: "bg-black! text-white! rounded-base",
-        day_today: "bg-secondary-background text-foreground!",
+          "day-range-end aria-selected:bg-main! aria-selected:text-main-foreground! rounded-base",
+        day_selected: "bg-main! text-main-foreground! rounded-base",
+        day_today:
+          "bg-transparent! text-foreground! aria-selected:bg-main! aria-selected:text-main-foreground!",
         day_outside:
-          "day-outside text-main-foreground opacity-50 aria-selected:bg-none",
-        day_disabled: "text-main-foreground opacity-50 rounded-base",
-        day_range_middle: "aria-selected:bg-black/50! aria-selected:text-white",
+          "day-outside text-foreground opacity-50 aria-selected:bg-none",
+        day_disabled: "text-foreground opacity-50 rounded-base",
+        day_range_middle:
+          "aria-selected:bg-main/50! aria-selected:text-main-foreground!",
         day_hidden: "invisible",
         ...classNames,
       }}
```

---

### Incident Patch 12: `be6e0e25` (2026-09-08)
**Commit Message**: Swap Radix packages for Base UI

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +1/-26)
```diff
@@ -14,35 +14,13 @@
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
     "@shikijs/compat": "^2.5.0",
     "@stefanprobst/rehype-extract-toc": "^2.2.1",
     "@tailwindcss/postcss": "^4.0.9",
@@ -64,7 +42,6 @@
     "input-otp": "^1.2.4",
     "lucide-react": "^0.477.0",
     "next": "15.2.8",
-    "next-themes": "^0.3.0",
     "path": "^0.12.7",
     "postcss": "8.4.27",
     "prettier": "^3.4.2",
@@ -80,14 +57,12 @@
     "remark-code-import": "^1.2.0",
     "shadcn": "2.3.0",
     "shiki": "^1.29.2",
-    "sonner": "^2.0.1",
     "tailwind-merge": "^3.0.2",
     "tailwindcss": "4.0.9",
     "tsx": "^4.19.2",
     "tw-animate-css": "^1.2.5",
     "typescript": "5.1.6",
     "unist-util-visit": "^5.0.0",
-    "vaul": "^0.9.0",
     "velite": "^0.2.2",
     "zod": "^3.22.4"
   },
```

**File**: `pnpm-lock.yaml` (modified, +130/-1042)
```diff
@@ -8,6 +8,9 @@ importers:
 
   .:
     dependencies:
+      '@base-ui/react':
+        specifier: ^1.8.0
+        version: 1.8.0(@types/react@19.0.10)(date-fns@3.6.0)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@devnomic/marquee':
         specifier: ^1.0.2
         version: 1.0.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
@@ -26,75 +29,6 @@ importers:
       '@next/mdx':
         specifier: ^15.2.1
         version: 15.2.1(@mdx-js/loader@3.1.0(acorn@8.14.0))(@mdx-js/react@3.1.0(@types/react@19.0.10)(react@19.0.0))
-      '@radix-ui/react-accordion':
-        specifier: ^1.2.3
-        version: 1.2.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-alert-dialog':
-        specifier: ^1.1.6
-        version: 1.1.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-avatar':
-        specifier: ^1.1.3
-        version: 1.1.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-checkbox':
-        specifier: ^1.1.4
-        version: 1.1.4(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-collapsible':
-        specifier: ^1.1.3
-        version: 1.1.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-context-menu':
-        specifier: ^2.2.6
-        version: 2.2.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-dialog':
-        specifier: ^1.1.6
-        version: 1.1.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-dropdown-menu':
-        specifier: ^2.1.6
-        version: 2.1.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-hover-card':
-        specifier: ^1.1.6
-        version: 1.1.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-label':
-        specifier: ^2.1.2
-        version: 2.1.2(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-menubar':
-        specifier: ^1.1.6
-        version: 1.1.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-navigation-menu':
-        specifier: ^1.2.5
-        version: 1.2.5(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-popover':
-        specifier: ^1.1.6
-        version: 1.1.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-progress':
-        specifier: ^1.1.2
-        version: 1.1.2(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-radio-group':
-        specifier: ^1.2.3
-        version: 1.2.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-scroll-area':
-        specifier: ^1.2.3
-        version: 1.2.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-select':
-        specifier: ^2.1.6
-        version: 2.1.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-slider':
-        specifier: ^1.2.3
-        version: 1.2.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-slot':
-        specifier: ^1.1.2
-        version: 1.1.2(@types/react@19.0.10)(react@19.0.0)
-      '@radix-ui/react-switch':
-        specifier: ^1.1.3
-        version: 1.1.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-tabs':
-        specifier: ^1.1.3
-        version: 1.1.3(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-toast':
-        specifier: ^1.2.6
-        version: 1.2.6(@types/react-dom@19.0.4(@types/react@19.0.10))(@types/react@19.0.10)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-tooltip':
-        spec
```

**File**: `public/r/sonner.json` (removed, +0/-17)
```diff
@@ -1,17 +0,0 @@
-{
-  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
-  "name": "sonner",
-  "type": "registry:ui",
-  "title": "Sonner",
-  "dependencies": [
-    "sonner",
-    "next-themes"
-  ],
-  "files": [
-    {
-      "path": "src/components/ui/sonner.tsx",
-      "content": "\"use client\"\r\n\r\nimport { useTheme } from \"next-themes\"\r\nimport { Toaster as Sonner, ToasterProps } from \"sonner\"\r\n\r\nconst Toaster = ({ ...props }: ToasterProps) => {\r\n  const { theme = \"system\" } = useTheme()\r\n\r\n  return (\r\n    <Sonner\r\n      theme={theme as ToasterProps[\"theme\"]}\r\n      style={{ fontFamily: \"inherit\", overflowWrap: \"anywhere\" }}\r\n      toastOptions={{\r\n        unstyled: true,\r\n        classNames: {\r\n          toast:\r\n            \"bg-background text-foreground border-border border-2 font-heading shadow-shadow rounded-base text-[13px] flex items-center gap-2.5 p-4 w-[356px] [&:has(button)]:justify-between\",\r\n          description: \"font-base\",\r\n          actionButton:\r\n            \"font-base border-2 text-[12px] h-6 px-2 bg-main text-main-foreground border-border rounded-base shrink-0\",\r\n          cancelButton:\r\n            \"font-base border-2 text-[12px] h-6 px-2 bg-secondary-background text-foreground border-border rounded-base shrink-0\",\r\n          error: \"bg-black text-white\",\r\n          loading:\r\n            \"[&[data-sonner-toast]_[data-icon]]:flex [&[data-sonner-toast]_[data-icon]]:size-4 [&[data-sonner-toast]_[data-icon]]:relative [&[data-sonner-toast]_[data-icon]]:justify-start [&[data-sonner-toast]_[data-icon]]:items-center [&[data-sonner-toast]_[data-icon]]:flex-shrink-0\",\r\n        },\r\n      }}\r\n      {...props}\r\n    />\r\n  )\r\n}\r\n\r\nexport { Toaster }\r\n",
-      "type": "registry:ui"
-    }
-  ]
-}
\ No newline at end of file
```

**File**: `src/components/ui/sonner.tsx` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-"use client"
-
-import { useTheme } from "next-themes"
-import { Toaster as Sonner, ToasterProps } from "sonner"
-
-const Toaster = ({ ...props }: ToasterProps) => {
-  const { theme = "system" } = useTheme()
-
-  return (
-    <Sonner
-      theme={theme as ToasterProps["theme"]}
-      style={{ fontFamily: "inherit", overflowWrap: "anywhere" }}
-      toastOptions={{
-        unstyled: true,
-        classNames: {
-          toast:
-            "bg-background text-foreground border-border border-2 font-heading shadow-shadow rounded-base text-[13px] flex items-center gap-2.5 p-4 w-[356px] [&:has(button)]:justify-between",
-          description: "font-base",
-          actionButton:
-            "font-base border-2 text-[12px] h-6 px-2 bg-main text-main-foreground border-border rounded-base shrink-0",
-          cancelButton:
-            "font-base border-2 text-[12px] h-6 px-2 bg-secondary-background text-foreground border-border rounded-base shrink-0",
-          error: "bg-black text-white",
-          loading:
-            "[&[data-sonner-toast]_[data-icon]]:flex [&[data-sonner-toast]_[data-icon]]:size-4 [&[data-sonner-toast]_[data-icon]]:relative [&[data-sonner-toast]_[data-icon]]:justify-start [&[data-sonner-toast]_[data-icon]]:items-center [&[data-sonner-toast]_[data-icon]]:flex-shrink-0",
-        },
-      }}
-      {...props}
-    />
-  )
-}
-
-export { Toaster }
```

**File**: `src/markdown/components/sonner.mdx` (removed, +0/-99)
```diff
@@ -1,99 +0,0 @@
----
-title: Sonner
-description: An opinionated toast component for React.
-shadcnDocsLink: https://ui.shadcn.com/docs/components/sonner
----
-
-<ComponentPreview component="sonner">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/index.tsx
-  ```
-</ComponentPreview>
-
-## Installation
-
-<Installation component="sonner">
-  ```tsx file=<rootDir>/src/components/ui/sonner.tsx
-  ```
-</Installation>
-
-## Usage
-
-```ts
-import { toast } from "sonner"
-
-import { Button } from "@/components/ui/button"
-```
-
-```tsx
-<Button
-  onClick={() =>
-    toast("Event has been created", {
-      description: "Sunday, December 03, 2023 at 9:00 AM",
-      action: {
-        label: "Undo",
-        onClick: () => console.log("Undo"),
-      },
-    })
-  }
->
-  Show Toast
-</Button>
-```
-
-## Examples
-
-### Default
-
-<ComponentPreview component="sonner" example="default">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/index.tsx
-  ```
-</ComponentPreview>
-
-### Success
-
-<ComponentPreview component="sonner" example="success">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/success.tsx
-  ```
-</ComponentPreview>
-
-### Info
-
-<ComponentPreview component="sonner" example="info">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/info.tsx
-  ```
-</ComponentPreview>
-
-### Warning
-
-<ComponentPreview component="sonner" example="warning">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/warning.tsx
-  ```
-</ComponentPreview>
-
-### Error
-
-<ComponentPreview component="sonner" example="error">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/error.tsx
-  ```
-</ComponentPreview>
-
-### Action
-
-<ComponentPreview component="sonner" example="action">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/action.tsx
-  ```
-</ComponentPreview>
-
-### Cancel
-
-<ComponentPreview component="sonner" example="cancel">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/cancel.tsx
-  ```
-</ComponentPreview>
-
-### Promise
-
-<ComponentPreview component="sonner" example="promise">
-  ```tsx file=<rootDir>/src/examples/ui/sonner/promise.tsx
-  ```
-</ComponentPreview>
\ No newline at end of file
```

**File**: `src/markdown/docs/migrating-from-v3.mdx` (removed, +0/-174)
```diff
@@ -1,174 +0,0 @@
----
-title: Migrating from V3
-description: Learn how to migrate from v3 to v4.
----
-
-## What's new?
-
-- The CLI now initializes projects with Tailwind v4. You can find v3 components <a target="_blank" href="https://v3.neobrutalism.dev/">here</a>.
-- All components are updated for Tailwind v4 and React 19.
-- Removed utility class components.
-
-Visit <Link href="/docs/changelog">changelog</Link> to see all the changes.
-
-## 1. Follow the Tailwind v4 Upgrade Guide
-
-- Upgrade to Tailwind v4 by following the official <a target="_blank" href="https://tailwindcss.com/docs/upgrade-guide">upgrade guide</a>
-- Use the `@tailwindcss/upgrade` @next codemod to remove deprecated utility classes and update tailwind config.
-
-## 2. Upgrade your dependencies
-
-### Upgrade React dependencies
-
-If you're using Next.js, you can upgrade React and React DOM to the latest version by running the following command:
-
-<br />
-
-```bash
-npx @next/codemod@canary upgrade latest
-```
-
-Visit <a target="_blank" href="https://nextjs.org/docs/app/building-your-application/upgrading/version-15">Next.js upgrade guide</a> for more info.
-
-Otherwise, you can upgrade React and React DOM to the latest version by running the following command:
-
-<br />
-
-```bash
-pnpm up react react-dom --latest
-```
-
-### Upgrade other dependencies
-
-```bash
-pnpm up "@radix-ui/*" cmdk lucide-react recharts tailwind-merge clsx --latest
-```
-
-## 3. Deprecate tailwindcss-animate
-
-We've deprecated `tailwindcss-animate` in favor of `tw-animate-css`, so you'll have to install `tw-animate-css` and remove `tailwindcss-animate` from your project.
-
-<br />
-
-```bash
-pnpm add tw-animate-css
-```
-
-```bash
-pnpm remove tailwindcss-animate
-```
-
-## 4. Update styling
-
-Delete the tailwind config file and paste <Link target='_blank' href='/styling'>desired styling</Link> to your `globals.css` file.
-
-
-## 5. Set cssVariables to true inside components.json if you haven't already
-
-## 5. Install v4 components
-
-Install new components like you would usually do.
-
-## 6. Update old styling (page styling not components)
-
-These are new variable names:
-
-<br />
-
-<Table>
-  <TableHeader>
-    <TableRow>
-      <TableHead>Old variable name</TableHead>
-      <TableHead>New variable name</TableHead>
-      <TableHead>Description</TableHead>
-    </TableRow>
-  </TableHeader>
-  <TableBody>
-    <TableRow>
-      <TableCell>bg</TableCell>
-      <TableCell>background</TableCell>
-      <TableCell>Background color</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>bw</TableCell>
-      <TableCell>secondary-background</TableCell>
-      <TableCell>Secondary background color</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>text </TableCell>
-      <TableCell>foreground</TableCell>
-      <TableCell>Text color</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>mtext</TableCell>
-      <TableCell>main-foreground</TableCell>
-      <TableCell>Text color when background is set to main</TableCell>
-    </TableRow>
-  </TableBody>
-</Table>
-
-### Utility class styling upgrade
-
-<Table>
-  <TableHeader>
-    <TableRow>
-      <TableHead>Old styling classes</TableHead>
-      <TableHead>New styling classes</TableHead>
-    </TableRow>
-  </TableHeader>
-  <TableBody>
-    <TableRow>
-      <TableCell>bg-bg dark:bg-darkBg</TableCell>
-      <TableCell>bg-background</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>bg-white dark:bg-secondaryBlack</TableCell>
-      <TableCell>bg-secondary-background</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>border-border dark:border-darkBorder</TableCell>
-      <TableCell>border-border</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>shadow-light dark:shadow-dark</TableCell>
-      <TableCell>shadow-shadow</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>text-text dark:text-darkText</TableCell>
-      <TableCell>text-foreground</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>text-text</TableCell>
-      <TableCell>text-main-foreground</TableCell>
-    </TableRow>
-  </TableBody>
-</Table>
-
-### CSS Variables classes styling upgrade
-
-<Table>
-  <TableHeader>
-    <TableRow>
-      <TableHead>Old styling classes</TableHead>
-      <TableHead>New styling classes</TableHead>
-    </TableRow>
-  </TableHeader>
-  <TableBody>
-    <TableRow>
-      <TableCell>bg-bg</TableCell>
-      <TableCell>bg-background</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>bg-bw</TableCell>
-      <TableCell>bg-secondary-background</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>text-text</TableCell>
-      <TableCell>text-foreground</TableCell>
-    </TableRow>
-    <TableRow>
-      <TableCell>text-mtext</TableCell>
-      <TableCell>text-main-foreground</TableCell>
-    </TableRow>
-  </TableBody>
-</Table>
```

---

### Incident Patch 13: `e5a0e9ab` (2026-05-10)
**Commit Message**: Fix React Server Components CVE vulnerabilities

Updated dependencies to fix Next.js and React CVE vulnerabilities.

The fix-react2shell-next tool automatically updated the following packages to their secure versions:
- next
- react-server-dom-webpack
- react-server-dom-parcel  
- react-server-dom-turbopack

All package.json files have been scanned and vulnerable versions have been patched to the correct fixed versions based on the official React advisory.

Co-authored-by: Vercel <vercel[bot]@users.noreply.github.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@
     "fs": "^0.0.1-security",
     "input-otp": "^1.2.4",
     "lucide-react": "^0.477.0",
-    "next": "15.2.0",
+    "next": "15.2.8",
     "next-themes": "^0.3.0",
     "path": "^0.12.7",
     "postcss": "8.4.27",
```

**File**: `pnpm-lock.yaml` (modified, +44/-42)
```diff
@@ -156,8 +156,8 @@ importers:
         specifier: ^0.477.0
         version: 0.477.0(react@19.0.0)
       next:
-        specifier: 15.2.0
-        version: 15.2.0(@babel/core@7.26.9)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        specifier: 15.2.8
+        version: 15.2.8(@babel/core@7.26.9)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       next-themes:
         specifier: ^0.3.0
         version: 0.3.0(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
@@ -876,8 +876,8 @@ packages:
       '@types/react': '>=16'
       react: '>=16'
 
-  '@next/env@15.2.0':
-    resolution: {integrity: sha512-eMgJu1RBXxxqqnuRJQh5RozhskoNUDHBFybvi+Z+yK9qzKeG7dadhv/Vp1YooSZmCnegf7JxWuapV77necLZNA==}
+  '@next/env@15.2.8':
+    resolution: {integrity: sha512-TaEsAki14R7BlgywA05t2PFYfwZiNlGUHyIQHVyloXX3y+Dm0HUITe5YwTkjtuOQuDhuuLotNEad4VtnmE11Uw==}
 
   '@next/eslint-plugin-next@15.2.0':
     resolution: {integrity: sha512-jHFUG2OwmAuOASqq253RAEG/5BYcPHn27p1NoWZDCf4OdvdK0yRYWX92YKkL+Mk2s+GyJrmd/GATlL5b2IySpw==}
@@ -893,50 +893,50 @@ packages:
       '@mdx-js/react':
         optional: true
 
-  '@next/swc-darwin-arm64@15.2.0':
-    resolution: {integrity: sha512-rlp22GZwNJjFCyL7h5wz9vtpBVuCt3ZYjFWpEPBGzG712/uL1bbSkS675rVAUCRZ4hjoTJ26Q7IKhr5DfJrHDA==}
+  '@next/swc-darwin-arm64@15.2.5':
+    resolution: {integrity: sha512-4OimvVlFTbgzPdA0kh8A1ih6FN9pQkL4nPXGqemEYgk+e7eQhsst/p35siNNqA49eQA6bvKZ1ASsDtu9gtXuog==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [darwin]
 
-  '@next/swc-darwin-x64@15.2.0':
-    resolution: {integrity: sha512-DiU85EqSHogCz80+sgsx90/ecygfCSGl5P3b4XDRVZpgujBm5lp4ts7YaHru7eVTyZMjHInzKr+w0/7+qDrvMA==}
+  '@next/swc-darwin-x64@15.2.5':
+    resolution: {integrity: sha512-ohzRaE9YbGt1ctE0um+UGYIDkkOxHV44kEcHzLqQigoRLaiMtZzGrA11AJh2Lu0lv51XeiY1ZkUvkThjkVNBMA==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [darwin]
 
-  '@next/swc-linux-arm64-gnu@15.2.0':
-    resolution: {integrity: sha512-VnpoMaGukiNWVxeqKHwi8MN47yKGyki5q+7ql/7p/3ifuU2341i/gDwGK1rivk0pVYbdv5D8z63uu9yMw0QhpQ==}
+  '@next/swc-linux-arm64-gnu@15.2.5':
+    resolution: {integrity: sha512-FMSdxSUt5bVXqqOoZCc/Seg4LQep9w/fXTazr/EkpXW2Eu4IFI9FD7zBDlID8TJIybmvKk7mhd9s+2XWxz4flA==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
 
-  '@next/swc-linux-arm64-musl@15.2.0':
-    resolution: {integrity: sha512-ka97/ssYE5nPH4Qs+8bd8RlYeNeUVBhcnsNUmFM6VWEob4jfN9FTr0NBhXVi1XEJpj3cMfgSRW+LdE3SUZbPrw==}
+  '@next/swc-linux-arm64-musl@15.2.5':
+    resolution: {integrity: sha512-4ZNKmuEiW5hRKkGp2HWwZ+JrvK4DQLgf8YDaqtZyn7NYdl0cHfatvlnLFSWUayx9yFAUagIgRGRk8pFxS8Qniw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
 
-  '@next/swc-linux-x64-gnu@15.2.0':
-    resolution: {integrity: sha512-zY1JduE4B3q0k2ZCE+DAF/1efjTXUsKP+VXRtrt/rJCTgDlUyyryx7aOgYXNc1d8gobys/Lof9P9ze8IyRDn7Q==}
+  '@next/swc-linux-x64-gnu@15.2.5':
+    resolution: {integrity: sha512-bE6lHQ9GXIf3gCDE53u2pTl99RPZW5V1GLHSRMJ5l/oB/MT+cohu9uwnCK7QUph2xIOu2a6+27kL0REa/kqwZw==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
 
-  '@next/swc-linux-x64-musl@15.2.0':
-    resolution: {integrity: sha512-QqvLZpurBD46RhaVaVBepkVQzh8xtlUN00RlG4Iq1sBheNugamUNPuZEH1r9X1YGQo1KqAe1iiShF0acva3jHQ==}
+  '@next/swc-linux-x64-musl@15.2.5':
+    resolution: {integrity: sha512-y7EeQuSkQbTAkCEQnJXm1asRUuGSWAchGJ3c+Qtxh8LVjXleZast8Mn/rL7tZOm7o35QeIpIcid6ufG7EVTTcA==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
 
-  '@next/swc-win32-arm64-msvc@15.2.0':
-    resolution: {integrity: sha512-ODZ0r9WMyylTHAN6pLtvUtQlGXBL9voljv6ujSlcsjOxhtXPI1Ag6AhZK0SE8hEpR1374WZZ5w33ChpJd5fsjw==}
+  '@next/swc-win32-arm64-msvc@15.2.5':
+    resolution: {integrity: sha512-gQMz0yA8/dskZM2Xyiq2FRShxSrsJNha40Ob/M2n2+JGRrZ0JwTVjLdvtN6vCxuq4ByhOd4a9qEf60hApNR2gQ==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [win32]
 
-  '@next/swc-win32-x64-msvc@15.2.0':
-    resolution: {integrity: sha512-8+4Z3Z7xa13NdUuUAcpVNA6o76lNPniBd9Xbo02bwXQXnZgFvEopwY2at5+z7yHl47X9qbZpvwatZ2BRo3EdZw==}
+  '@next/swc-win32-x64-msvc@15.2.5':
+    resolution: {integrity: sha512-tBDNVUcI7U03+3oMvJ11zrtVin5p0NctiuKmTGyaTIEAVj9Q77xukLXGXRnWxKRIIdFG4OTA2rUVGZDYOwgmAA==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [win32]
@@ -1815,6 +1815,7 @@ packages:
 
   '@ungap/structured-clone@1.3.0':
     resolution: {integrity: sha512-WmoN8qaIAo7WTYWbAZuG8PYEhn5fkz7dZrqTBZ7dtt//lL2Gwms1IcnQ5yHqjDfX8Ft5j4YzDM23f87zBfDe9g==}
+    deprecated: Potential CWE-502 - Update to 1.3.1 or higher
 
   acorn-jsx@5.3.2:
     resolution: {integrity: sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ==}
@@ -2614,7 +2615,7 @@ packages:
 
   glob@7.2.3:
     resolution: {integrity: sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q==}
-    deprecated: Glob versions prior to v9 are no longer supported
+    deprecated: Old versions of glob are not supported, and contain widely publicized security vulnerabilit
```

---

### Incident Patch 14: `55a0e8d9` (2025-04-07)
**Commit Message**: data-table docs hotfix

**File**: `src/markdown/components/data-table.mdx` (modified, +6/-4)
```diff
@@ -11,10 +11,12 @@ shadcnDocsLink: https://ui.shadcn.com/docs/components/data-table
 
 ## Installation
 
-<Installation component="data-table">
-  ```tsx file=<rootDir>/src/components/ui/data-table.tsx
-  ```
-</Installation>
+You'll have to go to <a target="_blank" href="https://ui.shadcn.com/docs/components/data-table">shadcn-ui docs</a> for this component and follow the instructions there. When you're done, you can copy the data-table component and paste it in inside your project:
+
+<br />
+
+```tsx file=<rootDir>/src/components/ui/data-table.tsx
+```
 
 ## Usage
 
```

#### Recent Merged Pull Requests:
- **PR #117** (2026-09-14): Base UI (@ekmas)
- **PR #116** (2026-08-02): added sidebar promo link (@ekmas)
- **PR #115** (closed): Add MemeChef to showcase (@C-o-d-e-C-o-w-b-o-y)
- **PR #114** (2026-05-10): Fix React Server Components CVE vulnerabilities (@vercel[bot])
- **PR #113** (closed): feat(calendar): add captionLayout dropdown support (@ELHart05)
- **PR #109** (closed): feat(docs/cli): save preferred cli command (@BombayV)
- **PR #102** (closed): Add show case (@RoamMoon)
- **PR #101** (2025-07-21): added jukebox to showcase (@ekmas)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

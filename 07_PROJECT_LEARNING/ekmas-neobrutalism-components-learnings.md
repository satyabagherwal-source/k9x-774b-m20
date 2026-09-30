# Forensic Learning Record (Deep Inspection): ekmas/neobrutalism-components

> **Canonical Artifact**: `07_PROJECT_LEARNING/ekmas-neobrutalism-components-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ekmas/neobrutalism-components](https://github.com/ekmas/neobrutalism-components))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:33:38.255Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ekmas/neobrutalism-components`
- **Description**: A collection of neobrutalism-styled Tailwind components.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5565 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
        <DialogTrigger render={<Button className="mt-5 w-full" />}
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

### Incident Patch 1: `8d9a748c` (2026-09-08)
**Commit Message**: fix charts page layout after client navigation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

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

### Incident Patch 2: `e5a0e9ab` (2026-05-10)
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
-    resolution: {integrity: sha512-8+4Z3Z7xa13NdUuUAcpVNA6o76lNPniBd9Xbo02bwXQXnZgFvEopwY2at5+z7yHl47X9qbZpvw
```

---

### Incident Patch 3: `55a0e8d9` (2025-04-07)
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

# Forensic Learning Record (Deep Inspection): danielpetho/fancy

> **Canonical Artifact**: `07_PROJECT_LEARNING/danielpetho-fancy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/danielpetho/fancy](https://github.com/danielpetho/fancy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:27:23.114Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `danielpetho/fancy`
- **Description**: 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3210 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `next.config.js`
```
const withMDX = require("@next/mdx")()

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  async redirects() {
    return [
      {
        source: "/docs",
        destination: "/docs/introduction",
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        port: "",
        hostname: "musicbrainz.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "fancycomponents.b-cdn.net",
        port: "",
        pathname: "/**",
      }
    ],
  },
}

module.exports = withMDX(nextConfig)

```

### Core Architecture Module: `postcss.config.mjs`
```
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config

```

### Core Architecture Module: `src/app/api/[...slug]/route.ts`
```
import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string[] } | undefined> }
) {
  const params = await props.params;
  try {
    // Check if params and slug exist
    if (!params?.slug) {
      return new NextResponse("Not Found", { status: 404 })
    }
    
    // Check if the request is for a markdown file
    const lastSegment = params.slug[params.slug.length - 1]
    if (!lastSegment.endsWith(".md")) {
      return new NextResponse("Not Found", { status: 404 })
    }
    
    // Remove .md extension to get the actual slug
    const actualSlug = [...params.slug]
    actualSlug[actualSlug.length - 1] = lastSegment.replace(".md", "")
    
    // Construct path to pre-generated markdown file
    const markdownPath = path.join(
      process.cwd(), 
      "public", 
      "docs", 
      ...actualSlug
    ) + ".md"
    
    // Check if file exists
    if (!fs.existsSync(markdownPath)) {
      return new NextResponse("Documentation not found", { status: 404 })
    }
    
    // Read and serve the pre-generated markdown
    const markdown = fs.readFileSync(markdownPath, "utf8")
    
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${actualSlug.join("-")}.md"`
      }
    })
    
  } catch (error) {
    console.error("Error serving markdown:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
```

### Core Architecture Module: `src/app/api/revalidate/route.ts`
```
import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const secret = requestHeaders.get("x-vercel-reval-key")

  if (secret !== process.env.CONTENTFUL_REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 })
  }

  revalidateTag("components", "max")

  return NextResponse.json({ revalidated: true, now: Date.now() })
}

```

### Core Architecture Module: `src/app/components/layout.tsx`
```
import { docsConfig } from "@/config/docs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { DocsSidebarNav } from "@/components/sidebar-nav"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full">
      <Header />
      <div>
        <div className="items-start lg:grid lg:grid-cols-[340px_minmax(0,1fr)] ">
          <aside className="sticky top-0 pb-4 z-30 hidden h-[calc(100vh-6rem)] w-full shrink-0 lg:block pt-4 pl-4 ">
            <div className="rounded-2xl bg-background h-full border-border border">
              <ScrollArea className="h-full">
                <DocsSidebarNav items={docsConfig} />
              </ScrollArea>
            </div>
          </aside>

          <div className="p-4">{children}</div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

```

### Core Architecture Module: `src/app/components/page.tsx`
```
import { getAllComponents } from "@/lib/get-components"
import ComponentCard from "@/components/component-card"

export default function Page() {
  const components = getAllComponents()

  return (
    <main className="flex-1 justify-center w-full">
      <div className="rounded-2xl bg-background py-6 lg:gap-10 lg:py-6 border-border border p-6">
        <h1 className="text-4xl font-bold mb-8 font-calendas">Components</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {components.map((component) => (
            <ComponentCard key={component.name} component={component} />
          ))}
        </div>
      </div>
    </main>
  )
}

```

### Core Architecture Module: `src/app/layout.tsx`
```
import type { Metadata } from "next"

import "./globals.css"

import { siteConfig } from "@/config/site"
import { ThemeProvider } from "@/components/theme-provider"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(siteConfig.url),
  description: siteConfig.description,
  keywords: [
    "React",
    "Typescript",
    "Tailwind CSS",
    "Microinteractions",
    "Motion",
    "Creative developers",
  ],
  authors: [
    {
      name: "Daniel Petho",
      url: "https://danielpetho.com",
    },
  ],
  creator: "danielpetho",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@nonzeroexitcode",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: `/site.webmanifest`,
}
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* <script src="https://unpkg.com/react-scan/dist/auto.global.js"/> */}
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="dbbf9969-1099-440a-8dcd-84616691e48a"
        ></script>
      </head>
      <body
        className={`font-overused-grotesk bg-background antialiased flex items-center justify-center w-full text-foreground [font-synthesis-weight:none]`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="h-full w-full max-w-(--breakpoint-2xl) flex flex-col items-center justify-center">
            {children}
          </main>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}

```

### Core Architecture Module: `src/app/not-found.tsx`
```
"use client"

import { useRef } from "react"
import Link from "next/link"
import Screensaver from "@/fancy/components/blocks/screensaver"

export default function NotFound() {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className="w-screen px-12 h-screen bg-background overflow-hidden flex items-center justify-center relative"
      ref={containerRef}
    >
      <div className="flex flex-col items-center justify-center z-30 space-y-8">
        <h1 className="text-3xl md:text-6xl font-overused-grotesk ">
          page not found
        </h1>

        <button
          className="text-sm sm:text-base md:text-lg tracking-tight text-white bg-black px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg md:rounded-2xl shadow-2xl hover:scale-105 transition-all duration-300 ease-out"
        >
          <Link href="/docs/introduction">
            Back to docs <span className="font-serif ml-1">→</span>
          </Link>
        </button>
      </div>

      {[...Array(12)].map((_, i) => (
        <Screensaver
          key={i}
          speed={1}
          startPosition={{ x:  10 + i * 1, y: 10 + i * 1 }} // Offset each element's starting position slightly
          startAngle={215} // Keep same angle for all elements
          containerRef={containerRef}
         
        >
          <span
            className="text-[160px] sm:text-[200px] md:text-[240px] lg:text-[300px] font-bold text-black [-webkit-text-stroke-width:2px] sm:[-webkit-text-stroke-width:2.5px] md:[-webkit-text-stroke-width:3px]  lg:[-webkit-text-stroke-width:4px] [-webkit-text-stroke-color:white] align-text-top"
          >
            404
          </span>
        </Screensaver>
      ))}
    </div>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #43** (2025-06-09): **fix sitemap.xml**
  *Symptoms*: it returns 404
  **Post-Mortem & Fix Analysis**:
  > should be fixed [37cbceb](https://github.com/danielpetho/fancy/commit/37cbcebdc8f63490e0fda7f35e012a587750da7d)

- **Issue #38** (2025-06-01): **Copy button of install component is wrongly aligned**
  *Symptoms*: It happens when the command is less than 2 lines  ![Image](https://github.com/user-attachments/assets/e0b069b3-51c1-448a-a423-f811be711575)
  **Post-Mortem & Fix Analysis**:
  > should be good w/ #49

- **Issue #37** (2025-06-06): **Mobile Nav bottom unreachable**
  *Symptoms*: especially bad on iOS:  ![Image](https://github.com/user-attachments/assets/5bb4492c-57e1-4247-9fb2-13239743ff04)
  **Post-Mortem & Fix Analysis**:
  > fixed w/ latest merge

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

### Incident Patch 1: `f7e728f9` (2025-11-10)
**Commit Message**: Merge pull request #63 from danielpetho/feat/fix-ui-issues

Add some focus states and remove double nested buttons and links

**File**: `src/app/docs/[[...slug]]/page.tsx` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ export default async function DocPage(props: DocPageProps) {
       {doc.toc && (
         <div className="hidden text-base xl:block sticky top-4 pt-0 pb-4 h-[calc(100vh-8rem)] pl-4">
           <div className="bg-background rounded-2xl border">
-            <ScrollArea className="pb-10 p-6">
+            <ScrollArea className="">
               <DashboardTableOfContents toc={toc} />
             </ScrollArea>
           </div>
```

**File**: `src/app/globals.css` (modified, +47/-0)
```diff
@@ -241,6 +241,47 @@
   }
 }
 
+@utility focus-outline {
+  position: relative;
+  
+  &::after {
+    content: '';
+    position: absolute;
+    inset: 0 -0.5rem;
+    inset-block: -0.25rem;
+    border: 2px solid transparent;
+    border-radius: 0.75rem;
+    pointer-events: none;
+    transform: scale(0.95);
+    opacity: 0;
+    /* transition: transform 200ms ease-out, opacity 200ms ease-out, border-color 200ms ease-out; */
+  }
+  
+  &:focus-visible {
+    outline: none;
+    
+    &::after {
+      border-color: var(--focus-outline-color, var(--color-primary-blue));
+      transform: scale(1);
+      opacity: 1;
+    }
+  }
+}
+
+@utility focus-ring {
+  outline: 2px solid transparent;
+  outline-offset: 2px;
+  /* transition: outline-color 200ms ease-out, outline-offset 200ms ease-out; */
+  
+  &:focus-visible {
+    outline-color: var(--focus-ring-color, var(--color-primary-blue));
+  }
+}
+
+@utility focus-primary {
+  @apply focus-outline [--focus-outline-color:var(--color-primary-blue)];
+}
+
 /*
   The default border color has changed to `currentColor` in Tailwind CSS v4,
   so we've added these compatibility styles to make sure everything still
@@ -366,6 +407,12 @@
     @apply border-border;
   }
 
+  *:focus-visible {
+    outline: 2px solid var(--color-primary-blue);
+    border-radius: 0.5rem;
+    outline-offset: 2px;
+  }
+
   body {
     @apply bg-background text-foreground;
   }
```

**File**: `src/components/component-card.tsx` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ export default function ComponentCard({ component }: ComponentCardProps) {
     >
       <Link
         href={`/docs/components/${component.category}/${component.name}`}
-        className="group relative aspect-video rounded-xl overflow-hidden border block"
+        className="group relative aspect-video rounded-xl overflow-hidden border block focus-ring"
       >
         {/* Thumbnail Image */}
         <Image
```

**File**: `src/components/component-preview.tsx` (modified, +5/-5)
```diff
@@ -113,7 +113,7 @@ export function ComponentPreview({
     <div
       data-algolia-ignore
       className={cn(
-        "group relative flex flex-col h-full w-full ",
+        "relative flex flex-col h-full w-full ",
         className
       )}
       {...props}
@@ -123,21 +123,21 @@ export function ComponentPreview({
           <TabsList className="w-full justify-start rounded-none p-0 h-9 bg-transparent space-x-3 px-3">
             <TabsTrigger
               value="preview"
-              className="relative text-base rounded-none border-b-transparent bg-transparent px-0 font-semibold text-muted-foreground shadow-none transition-colors duration-300 ease-out hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent"
+              className="relative text-base border-b-transparent bg-transparent px-0 font-semibold text-muted-foreground shadow-none transition-colors duration-300 ease-out hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue rounded-lg"
             >
               Demo
             </TabsTrigger>
             <TabsTrigger
               value="code"
-              className="relative text-base rounded-none border-b-transparent bg-transparent px-0 font-semibold text-muted-foreground shadow-none transition-colors duration-300 ease-out hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent"
+              className="relative text-base border-b-transparent bg-transparent px-0 font-semibold text-muted-foreground shadow-none transition-colors duration-300 ease-out hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue rounded-lg"
             >
               Code
             </TabsTrigger>
           </TabsList>
         </div>
         <TabsContent
           value="preview"
-          className="border border-black-500 flex rounded-2xl"
+          className="border border-black-500 flex rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
         >
           <div className="w-full flex items-center justify-center rounded-2xl min-h-[530px] overflow-hidden relative max-h-[530px]">
             {/* <div className="absolute top-4 right-4 rounded-full border">
@@ -159,7 +159,7 @@ export function ComponentPreview({
                         <Button
                           variant="outline"
                           size="sm"
-                          className="h-8 items-center flex justify-center"
+                          className="h-8 items-center flex justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
                         >
                           <Repeat className="mr-2 h-4 w-4" />
                           Remix
```

**File**: `src/components/copy-button.tsx` (modified, +4/-2)
```diff
@@ -4,9 +4,11 @@ import React, { useState, useRef } from 'react';
 import { Copy } from 'lucide-react';
 import { Button } from "@/components/ui/button";
 import { motion, TargetAndTransition, Variants } from 'motion/react';
+import { cn } from '@/lib/utils';
 
 interface CopyButtonProps {
   onCopy: () => Promise<void> | void;
+  className?: string;
 }
 
 const copyIconVariants: Variants = {
@@ -65,7 +67,7 @@ const checkPathVariants: Variants = {
 
 const MotionButton = motion.create(Button);
 
-export const CopyButton: React.FC<CopyButtonProps> = ({ onCopy }) => {
+export const CopyButton: React.FC<CopyButtonProps> = ({ onCopy, className }) => {
   const [status, setStatus] = useState<"idle" | "copying" | "copied">("idle");
   const [backgroundState, setBackgroundState] = useState<"hidden" | "entering" | "centered" | "leaving">("hidden");
   const [entryDirection, setEntryDirection] = useState({ x: 0, y: 0 });
@@ -190,7 +192,7 @@ export const CopyButton: React.FC<CopyButtonProps> = ({ onCopy }) => {
         onMouseLeave={handleMouseLeave}
         variant="ghost"
         size="icon"
-        className="relative text-muted-foreground cursor-pointer w-8 h-8 hover:text-white hover:scale-105 duration-300 transition ease-out hover:bg-transparent bg-none"
+        className={cn("relative text-muted-foreground cursor-pointer w-8 h-8 hover:text-white hover:scale-105 duration-300 transition-[scale,color,background-color,opacity] ease-out hover:bg-transparent bg-none focus:outline-none! focus-visible:ring-2! focus-visible:ring-offset-0! focus-visible:ring-white!", className)}
         aria-label="Copy code"
         whileTap={{ scale: 0.9 }}
         transition={{ type: "spring", stiffness: 400, damping: 30 }}
```

---

### Incident Patch 2: `dc24be84` (2025-10-17)
**Commit Message**: tab fixes

**File**: `src/components/landing/hero-images.tsx` (modified, +26/-11)
```diff
@@ -44,24 +44,30 @@ export function HeroImages({ allComps }: { allComps: Component[] }) {
         depth={0.5}
         className="top-[15%] left-[2%] md:top-[25%] md:left-[5%] "
       >
-        <Link href={`${preLink}/blocks/image-trail`}>
+        <Link 
+          href={`${preLink}/blocks/image-trail`}
+          className="-rotate-[3deg] inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={imageTrail.thumbnail.url}
             videoSrc={imageTrail.demo.url}
-            className="w-16 h-12 sm:w-24 sm:h-16 md:w-28 md:h-20 lg:w-32 lg:h-24 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform -rotate-[3deg] shadow-2xl rounded-xl"
+            className="w-16 h-12 sm:w-24 sm:h-16 md:w-28 md:h-20 lg:w-32 lg:h-24 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
             delay={0.5}
           />
         </Link>
       </FloatingElement>
       <FloatingElement
         depth={1}
-        className="top-[0%] left-[8%] md:top-[6%] md:left-[11%] "
+        className="top-[0%] left-[8%] md:top-[6%] md:left-[11%]"
       >
-        <Link href={`${preLink}/text/text-highlighter`}>
+        <Link 
+          href={`${preLink}/text/text-highlighter`}
+          className="inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={textHighlighter.thumbnail.url}
             videoSrc={textHighlighter.demo.url}
-            className="w-40 h-28 sm:w-48 sm:h-36 md:w-56 md:h-44 lg:w-60 lg:h-48 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform -rotate-12 shadow-2xl rounded-xl"
+            className="w-40 h-28 sm:w-48 sm:h-36 md:w-56 md:h-44 lg:w-60 lg:h-48 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
             delay={0.7}
           />
         </Link>
@@ -71,11 +77,14 @@ export function HeroImages({ allComps }: { allComps: Component[] }) {
         depth={4}
         className="top-[90%] left-[6%] md:top-[80%] md:left-[8%]"
       >
-        <Link href={`${preLink}/text/gravity`}>
+        <Link 
+          href={`${preLink}/text/gravity`}
+          className="-rotate-[4deg] inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={gravity.thumbnail.url}
             videoSrc={gravity.demo.url}
-            className="w-40 h-40 sm:w-48 sm:h-48 md:w-60 md:h-60 lg:w-64 lg:h-64 object-cover -rotate-[4deg] hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
+            className="w-40 h-40 sm:w-48 sm:h-48 md:w-60 md:h-60 lg:w-64 lg:h-64 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
             delay={0.9}
           />
         </Link>
@@ -84,11 +93,14 @@ export function HeroImages({ allComps }: { allComps: Component[] }) {
         depth={2}
         className="top-[0%] left-[87%] md:top-[2%] md:left-[83%]"
       >
-        <Link href={`${preLink}/blocks/css-box`}>
+        <Link 
+          href={`${preLink}/blocks/css-box`}
+          className="rotate-[6deg] inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={cssBox.thumbnail.url}
             videoSrc={cssBox.demo.url}
-            className="w-40 h-36 sm:w-48 sm:h-44 md:w-60 md:h-52 lg:w-64 lg:h-56 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rotate-[6deg] rounded-xl"
+            className="w-40 h-36 sm:w-48 sm:h-44 md:w-60 md:h-52 lg:w-64 lg:h-56 object-cover hover:scale-105 durati
```

**File**: `src/components/landing/landing-hero.tsx` (modified, +13/-11)
```diff
@@ -8,9 +8,11 @@ import TextRotate from "@/fancy/components/text/text-rotate"
 
 import { HeroImages } from "./hero-images"
 
+const MotionLink = motion.create(Link)
+
 export function LandingHero({ allComps }: { allComps: Component[] | null }) {
   return (
-    <section className="w-full h-screen overflow-hidden md:overflow-visible flex flex-col items-center justify-center relative">
+    <section className="w-full h-screen overflow-hidden md:overflow-clip overscroll-none flex flex-col items-center justify-center relative">
 
       {allComps && <HeroImages allComps={allComps} />}
 
@@ -68,8 +70,9 @@ export function LandingHero({ allComps }: { allComps: Component[] | null }) {
         </motion.p>
 
         <div className="flex flex-row justify-center space-x-4 items-center mt-10 sm:mt-16 md:mt-20 lg:mt-20 text-xs">
-          <motion.button
-            className="w-28 sm:w-32 md:w-36 lg:w-40 sm:text-base md:text-lg lg:text-xl font-medium tracking-tight text-background bg-foreground px-3 py-1.5 sm:px-4 sm:py-2 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg md:rounded-xl z-20 shadow-2xl whitespace-nowrap cursor-pointer"
+          <MotionLink
+            href="/docs/introduction"
+            className="w-28 sm:w-32 md:w-36 lg:w-40 sm:text-base md:text-lg lg:text-xl font-medium tracking-tight text-background bg-foreground px-3 py-1.5 sm:px-4 sm:py-2 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg md:rounded-xl z-20 shadow-2xl whitespace-nowrap cursor-pointer inline-block text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground"
             animate={{ opacity: 1, y: 0 }}
             initial={{ opacity: 0, y: 20 }}
             transition={{
@@ -86,12 +89,11 @@ export function LandingHero({ allComps }: { allComps: Component[] | null }) {
               transition: { type: "spring", damping: 30, stiffness: 400 },
             }}
           >
-            <Link href="/docs/introduction">
-              Check docs <span className="font-serif ml-1">→</span>
-            </Link>
-          </motion.button>
-          <motion.button
-            className="w-28 sm:w-32 md:w-36 lg:w-40 sm:text-base md:text-lg lg:text-xl font-medium tracking-tight text-white bg-blue dark:bg-blue-500 px-3 py-1.5 sm:px-4 sm:py-2 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg md:rounded-xl z-20 shadow-2xl whitespace-nowrap cursor-pointer" 
+            Check docs <span className="font-serif ml-1">→</span>
+          </MotionLink>
+          <MotionLink
+            href="https://github.com/danielpetho/fancy"
+            className="w-28 sm:w-32 md:w-36 lg:w-40 sm:text-base md:text-lg lg:text-xl font-medium tracking-tight text-white bg-blue dark:bg-blue-500 px-3 py-1.5 sm:px-4 sm:py-2 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg md:rounded-xl z-20 shadow-2xl whitespace-nowrap cursor-pointer inline-block text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
             animate={{ opacity: 1, y: 0 }}
             initial={{ opacity: 0, y: 20 }}
             transition={{
@@ -108,8 +110,8 @@ export function LandingHero({ allComps }: { allComps: Component[] | null }) {
               transition: { type: "spring", damping: 30, stiffness: 400 },
             }}
           >
-            <Link href="https://github.com/danielpetho/fancy">★ on GitHub</Link>
-          </motion.button>
+            ★ on GitHub
+          </MotionLink>
         </div>
       </div>
     </section>
```

**File**: `src/fancy/components/text/letter-3d-swap.tsx` (modified, +21/-10)
```diff
@@ -19,23 +19,34 @@ const splitIntoCharacters = (text: string): string[] => {
   return Array.from(text)
 }
 
-// handy function  to extract text from children
-const extractTextFromChildren = (children: React.ReactNode): string => {
+// handy function to extract text from children
+const extractTextFromChildren = (children: React.ReactNode): string | undefined => {
+  // Handle null/undefined
+  if (children == null) return ""
+
+  // Handle string
   if (typeof children === "string") return children
 
+  // Handle number
+  if (typeof children === "number") return String(children)
+
+  // Handle arrays (including fragments)
+  if (Array.isArray(children)) {
+    return children.map(extractTextFromChildren).join("")
+  }
+
+  // Handle React elements
   if (React.isValidElement(children)) {
     const props = (children as React.ReactElement).props
     const childText = (props as any).children as React.ReactNode
-    if (typeof childText === "string") return childText
-    if (React.isValidElement(childText)) {
+
+    // Recursively extract text from children
+    if (childText != null) {
       return extractTextFromChildren(childText)
     }
-  }
 
-  throw new Error(
-    "Letter3DSwap: Children must be a string or a React element containing a string. " +
-      "Complex nested structures are not supported."
-  )
+    return ""
+  }
 }
 
 /**
@@ -146,7 +157,7 @@ const Letter3DSwap = ({
 
   // Splitting the text into animation segments
   const characters = useMemo(() => {
-    const t = text.split(" ")
+    const t = text?.split(" ") ?? []
     const result = t.map((word: string, i: number) => ({
       characters: splitIntoCharacters(word),
       needsSpace: i !== t.length - 1,
```

**File**: `src/fancy/components/text/scroll-and-swap-text.tsx` (modified, +19/-8)
```diff
@@ -5,22 +5,33 @@ import { motion, useScroll, useTransform, useSpring } from "motion/react"
 import { cn } from "@/lib/utils"
 
 // handy function to extract text from children
-const extractTextFromChildren = (children: React.ReactNode): string => {
+const extractTextFromChildren = (children: React.ReactNode): string | undefined => {
+  // Handle null/undefined
+  if (children == null) return ""
+
+  // Handle string
   if (typeof children === "string") return children
 
+  // Handle number
+  if (typeof children === "number") return String(children)
+
+  // Handle arrays (including fragments)
+  if (Array.isArray(children)) {
+    return children.map(extractTextFromChildren).join("")
+  }
+
+  // Handle React elements
   if (React.isValidElement(children)) {
     const props = (children as React.ReactElement).props
     const childText = (props as any).children as React.ReactNode
-    if (typeof childText === "string") return childText
-    if (React.isValidElement(childText)) {
+
+    // Recursively extract text from children
+    if (childText != null) {
       return extractTextFromChildren(childText)
     }
-  }
 
-  throw new Error(
-    "ScrollAndSwapText: Children must be a string or a React element containing a string. " +
-      "Complex nested structures are not supported."
-  )
+    return ""
+  }
 }
 
 interface ScrollAndSwapTextProps {
```

---

### Incident Patch 3: `8a412bb0` (2025-10-13)
**Commit Message**: fix(registry): update import regex for transform

**File**: `src/scripts/build-registry-sources.ts` (modified, +13/-6)
```diff
@@ -38,19 +38,26 @@ function getSourceContent(filePath: string): string {
   }
 }
 
-  // Transform @/fancy/components imports to @/components/fancy/... 
+  // Transform @/fancy/components and @/fancy/examples imports to @/components/fancy/... 
   // so it will work with open in v0
 function transformImportPaths(content: string): string {
   let newContent = content
   
-  // Match import statements with @/fancy/components
+  // Match import statements with @/fancy/components or @/fancy/examples
   // Handles patterns like:
   // - import Foo from "@/fancy/components/text/bar"
-  // - import { Bar } from '@/fancy/components/blocks/baz'
-  const importRegex = /import\s+([^"'\n]+?)\s+from\s+['"]@\/fancy\/components(\/[^'"]*)?['"]/g
+  // - import { Bar } from '@/fancy/examples/blocks/baz'
+  // - Multi-line imports like:
+  //   import Foo, { 
+  //     Bar, 
+  //     Baz 
+  //   } from "@/fancy/components/something"
+  const importRegex = /import\s+([\s\S]+?)\s+from\s+['"]@\/fancy\/(components|examples)(\/[^'"]*)?['"]/g
   
-  newContent = newContent.replace(importRegex, (match, importPart, subPath) => {
-    // Transform: @/fancy/components/text/something -> @/components/fancy/text/something
+  newContent = newContent.replace(importRegex, (match, importPart, type, subPath) => {
+    // Transform: 
+    // - @/fancy/components/text/something -> @/components/fancy/text/something
+    // - @/fancy/examples/carousel/demo -> @/components/fancy/carousel/demo
     const newPath = subPath ? `@/components/fancy${subPath}` : '@/components/fancy'
     return `import ${importPart} from "${newPath}"`
   })
```

---

### Incident Patch 4: `0b20246e` (2025-10-13)
**Commit Message**: fix(registry): include all deps for demos in registry

**File**: `src/scripts/build-registry-index.ts` (modified, +2/-2)
```diff
@@ -329,8 +329,8 @@ function generateRegistryItem(
             : "registry:ui",
     files,
     author: getAuthor(name, type),
-    ...(componentDeps.length > 0 && {
-      registryDependencies: componentDeps,
+    ...(registryDependencies.length > 0 && {
+      registryDependencies: registryDependencies,
     }),
     ...(externalDeps.size > 0 || additionalConfig?.devDependencies
       ? {
```

**File**: `src/scripts/build-registry-sources.ts` (modified, +15/-3)
```diff
@@ -332,10 +332,22 @@ function processRegistryItem(name: string, item: any): any {
         return
       }
 
-      // Handle local references
+      // Handle local references (hooks, utils, components)
       const possibleName = importPath.split("/").pop() || ""
-      const registry = JSON.parse(fs.readFileSync(registryJsonPath, "utf-8"))
-      if (registry[possibleName] && possibleName !== name) {
+      
+      // Read and parse registry with schema format support
+      const registryData = JSON.parse(fs.readFileSync(registryJsonPath, "utf-8"))
+      let registryMap: any
+      if (registryData.items) {
+        registryMap = {}
+        registryData.items.forEach((item: any) => {
+          registryMap[item.name] = item
+        })
+      } else {
+        registryMap = registryData
+      }
+      
+      if (registryMap[possibleName] && possibleName !== name) {
         registryDeps.add(`https://fancycomponents.dev/r/${possibleName}.json`)
       }
     })
```

---

### Incident Patch 5: `f4e92ce4` (2025-10-13)
**Commit Message**: fix(registry): make iomports work with v0

**File**: `src/scripts/build-registry-sources.ts` (modified, +23/-0)
```diff
@@ -38,6 +38,26 @@ function getSourceContent(filePath: string): string {
   }
 }
 
+  // Transform @/fancy/components imports to @/components/fancy/... 
+  // so it will work with open in v0
+function transformImportPaths(content: string): string {
+  let newContent = content
+  
+  // Match import statements with @/fancy/components
+  // Handles patterns like:
+  // - import Foo from "@/fancy/components/text/bar"
+  // - import { Bar } from '@/fancy/components/blocks/baz'
+  const importRegex = /import\s+([^"'\n]+?)\s+from\s+['"]@\/fancy\/components(\/[^'"]*)?['"]/g
+  
+  newContent = newContent.replace(importRegex, (match, importPart, subPath) => {
+    // Transform: @/fancy/components/text/something -> @/components/fancy/text/something
+    const newPath = subPath ? `@/components/fancy${subPath}` : '@/components/fancy'
+    return `import ${importPart} from "${newPath}"`
+  })
+  
+  return newContent
+}
+
 function resolveColorInContent(content: string): string {
   const colorMappings = {
     "primary-red": "#ff5941",
@@ -134,6 +154,9 @@ function processItemFiles(registryItem: any): any[] {
 
     let content = getSourceContent(sourceFilePath)
 
+    // Apply import path transformations to all content
+    content = transformImportPaths(content)
+
     // Add appropriate extension for the path
     let extension =
       file.type === "registry:ui" || file.type === "registry:block"
```

---

### Incident Patch 6: `e28ede77` (2025-10-13)
**Commit Message**: fix copying

**File**: `src/components/copy-page-menu.tsx` (modified, +11/-3)
```diff
@@ -91,9 +91,16 @@ export function CopyPageMenu({ title, content, currentUrl }: CopyPageMenuProps)
     setStatus("copying")
     
     try {
-      // Create markdown content optimized for LLMs
-      const markdownContent = `# ${title}\n\n${content}\n\n---\n\nSource: ${currentUrl}`
-      await copyToClipboard(markdownContent)
+      const url = new URL(currentUrl)
+      const markdownPath = `${url.pathname}.md`
+      const response = await fetch(markdownPath)
+      
+      if (!response.ok) {
+        throw new Error(`Failed to fetch markdown: ${response.statusText}`)
+      }
+      
+      const fullMarkdownContent = await response.text()
+      await copyToClipboard(fullMarkdownContent)
       
       setTimeout(() => {
         setStatus("copied")
@@ -103,6 +110,7 @@ export function CopyPageMenu({ title, content, currentUrl }: CopyPageMenuProps)
         setStatus("idle")
       }, 2000)
     } catch (error) {
+      console.error("Failed to copy markdown:", error)
       setStatus("idle")
     }
   }
```

---

### Incident Patch 7: `52bdedb8` (2025-10-12)
**Commit Message**: fix(components): more type fix

**File**: `src/fancy/components/text/letter-3d-swap.tsx` (modified, +4/-3)
```diff
@@ -24,7 +24,8 @@ const extractTextFromChildren = (children: React.ReactNode): string => {
   if (typeof children === "string") return children
 
   if (React.isValidElement(children)) {
-    const childText = children.props.children
+    const props = (children as React.ReactElement).props
+    const childText = (props as any).children as React.ReactNode
     if (typeof childText === "string") return childText
     if (React.isValidElement(childText)) {
       return extractTextFromChildren(childText)
@@ -309,7 +310,7 @@ const CharBox = ({
       }}
     >
       {/* Front face */}
-      <div
+      <span
         className={cn("relative backface-hidden h-[1lh]", frontFaceClassName)}
         style={{
           transform: `${
@@ -322,7 +323,7 @@ const CharBox = ({
         }}
       >
         {char}
-      </div>
+      </span>
 
       {/* Second face - positioned based on rotation direction */}
       <span
```

**File**: `src/fancy/components/text/scroll-and-swap-text.tsx` (modified, +2/-1)
```diff
@@ -9,7 +9,8 @@ const extractTextFromChildren = (children: React.ReactNode): string => {
   if (typeof children === "string") return children
 
   if (React.isValidElement(children)) {
-    const childText = children.props.children
+    const props = (children as React.ReactElement).props
+    const childText = (props as any).children as React.ReactNode
     if (typeof childText === "string") return childText
     if (React.isValidElement(childText)) {
       return extractTextFromChildren(childText)
```

---

### Incident Patch 8: `99a99194` (2025-10-12)
**Commit Message**: fix type errors

**File**: `src/app/docs/[[...slug]]/page.tsx` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ export const runtime = "nodejs"
 export const dynamic = "force-static"
 
 export async function generateMetadata(props: DocPageProps): Promise<Metadata> {
-  const params = await props.params;
+  const params = await props.params
   const doc = await getDocFromParams({ params })
 
   if (!doc) {
@@ -98,7 +98,7 @@ export function generateStaticParams() {
 }
 
 export default async function DocPage(props: DocPageProps) {
-  const params = await props.params;
+  const params = await props.params
   const doc = await getDocFromParams({ params })
 
   const toc = doc.toc
```

**File**: `src/app/not-found.tsx` (modified, +0/-3)
```diff
@@ -2,9 +2,6 @@
 
 import { useRef } from "react"
 import Link from "next/link"
-import { motion } from "motion/react"
-
-import { cn } from "@/lib/utils"
 import Screensaver from "@/fancy/components/blocks/screensaver"
 
 export default function NotFound() {
```

**File**: `src/lib/get-docs.ts` (modified, +2/-2)
```diff
@@ -3,13 +3,13 @@ import path from "node:path"
 import { mdxComponents } from "@/mdx-components"
 import { compileMDX } from "next-mdx-remote/rsc"
 
-import { Doc, DocPageProps } from "@/types/types"
+import { Doc } from "@/types/types"
 
 import { getTableOfContents } from "./toc"
 
 export const CONTENT_DIRECTORY = "/src/content/docs/"
 
-export async function getDocFromParams({ params }: DocPageProps): Promise<Doc> {
+export async function getDocFromParams({ params }: { params: { slug: string[] } }): Promise<Doc> {
   const source = fs.readFileSync(
     path.join(process.cwd(), CONTENT_DIRECTORY, params.slug.join("/")) + ".mdx",
     "utf8"
```

**File**: `src/types/types.ts` (modified, +2/-2)
```diff
@@ -22,9 +22,9 @@ export type NpmCommands = {
 }
 
 export interface DocPageProps {
-  params: {
+  params: Promise<{
     slug: string[]
-  }
+  }>
 }
 
 // CMS data
```

---

### Incident Patch 9: `5de966bd` (2025-10-12)
**Commit Message**: fix: do not use pnpm

**File**: `package-lock.json` (modified, +1/-1)
```diff
@@ -31,8 +31,8 @@
         "lucide-react": "^0.545.0",
         "matter-js": "^0.20.0",
         "mdast-util-toc": "^7.1.0",
-        "next": "15.5.3",
         "motion": "^12.23.24",
+        "next": "15.5.3",
         "next-mdx-remote": "^5.0.0",
         "next-themes": "^0.4.4",
         "poly-decomp": "^0.3.0",
```

---

### Incident Patch 10: `688e9c27` (2025-10-12)
**Commit Message**: fix(components): import

**File**: `src/fancy/examples/physics/elastic-line-demo.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 "use client"
 
-import { motion } from "motion/react"
+import { motion, Variants } from "motion/react"
 
 import ElasticLine from "@/fancy/components/physics/elastic-line"
 
```

#### Recent Merged Pull Requests:
- **PR #67** (2026-03-12): docs: Add shadcn init and @fancy registry to installation docs (@TMname1)
- **PR #64** (2026-01-09): Feat: Add responsivity to the Marquee along svg path comp (@danielpetho)
- **PR #63** (2025-11-10): Feat/fix UI issues (@danielpetho)
- **PR #61** (2025-10-12): migrating to nextjs v.15 (@mehrdadrafiee)
- **PR #57** (2025-07-11): Feat/md docs (@danielpetho)
- **PR #56** (2025-07-04): Feat/box carousel (@danielpetho)
- **PR #55** (2025-06-16): Feat/rework demos (@danielpetho)
- **PR #53** (2025-06-12): Add docsearch from algolia (@danielpetho)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

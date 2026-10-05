# Forensic Learning Record (Deep Inspection): JCodesMore/ai-website-cloner-template

> **Canonical Artifact**: `07_PROJECT_LEARNING/jcodesmore-ai-website-cloner-template-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/JCodesMore/ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:07:26.869Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `JCodesMore/ai-website-cloner-template`
- **Description**: Clone any website with one command using AI coding agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 35505 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.mjs`
```
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

```

### Core Architecture Module: `next.config.ts`
```
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
};

export default nextConfig;

```

### Core Architecture Module: `postcss.config.mjs`
```
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;

```

### Core Architecture Module: `src/app/layout.tsx`
```
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Website Clone",
  description: "Pixel-perfect website clone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

```

### Core Architecture Module: `src/app/page.tsx`
```
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">
        Clone target not yet built. Run <code className="font-mono text-foreground">/clone-website</code> to start.
      </p>
    </main>
  );
}

```

### Core Architecture Module: `src/components/ui/button.tsx`
```
"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

```

### Core Architecture Module: `src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #66** (2026-08-10): **[Bug]: Pages Overwritten**
  *Symptoms*: ### Description  When I clone the new pages via new links, the previous pages are removed.  ### Steps to Reproduce  - /clone-website https://example.com/page-a - Waiting for finishing page-a. - /clone-website https://example.com/page-b https://example.com/page-c - Waiting for finishing page-b page-c.  ### Expected Behavior  Page A, B, C exist.  ### Actual Behavior  Page B, C exist, page A is removed.  ### Target URL  https://code.claude.com/docs/en/how-claude-code-works  ### Operating System  Linux  ### Node.js Version  22.22.2  ### Claude Code Version  _No response_  ### Additional Context  _No response_

- **Issue #27** (2026-04-14): **[Bug]: Does not work as described**
  *Symptoms*: ### Description  Using claude code opus 4.6, chrome, and everything as described/advised Tried to clone a quasi static (rather simple) web site It only cloned the home page and quite badly : wrong fonts, missing items, wrong colors on some items etc  Basically it comes back down to tens of interactive corrections to ask claude code by visually comparing the original and cloned site.  I do not see the usefulness of this repository honestly as it does not help nor automate cloning  ### Steps to Reproduce  as described in this repo  ### Expected Behavior  cloning a web site in at most a few prompts at most  ### Actual Behavior  you do not obtain a better cloned web site versus just asking claude code to scrape and copy a web site with a single prompt  ### Target URL  _No response_  ### Operating System  Windows  ### Node.js Version  v22.12.0  ### Claude Code Version  2.1.97 (Claude Code)  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for your feedback.

- **Issue #22** (2026-08-08): **Bug: 'claude --chrome' skill fails to load after npm audit fix**
  *Symptoms*: ### Description  A fresh installation of the project reports 2 vulnerabilities (1 moderate, 1 high) after running npm install. While executing npm audit fix resolves these security warnings, it introduces a regression where the claude --chrome command fails to load the associated skill. It seems that the automated update of dependencies via the audit fix breaks the core functionality of the browser automation or the skill-loading mechanism.  ### Steps to Reproduce  Clone the repository: git clone https://github.com/JCodesMore/ai-website-cloner-template.git  Navigate to the project folder: cd ai-website-cloner-template  Install dependencies: npm install (Note the 2 vulnerabilities reported).  Apply the security fix: npm audit fix  Attempt to run the specific command: claude --chrome  Observe the error: The "skill" fails to load or the process hangs/crashes.  ### Expected Behavior  After running npm audit fix, all security vulnerabilities should be resolved without breaking existing features. The claude --chrome command should initialize the browser environment and load the designated "skill" successfully, allowing the user to proceed with website cloning or AI interactions.  ### Actual Behavior  The security vulnerabilities are fixed, but the claude --chrome functionality is compromised. Specifically, the "skill" fails to load or the process terminates unexpectedly. This suggests that the dependency updates performed by npm audit fix are incompatible with the current implement

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

### Incident Patch 1: `0fc4dca3` (2026-09-20)
**Commit Message**: fix(security): patch dependencies with exact Next.js pins (#119)

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Security
+- Update Next.js and eslint-config-next to 16.3.5 with exact version pins, and refresh vulnerable transitive dependencies. Thanks to @atahan150 for the report in [#117](https://github.com/JCodesMore/ai-website-cloner-template/issues/117) and proposed fix in [#118](https://github.com/JCodesMore/ai-website-cloner-template/pull/118).
+
 ## [0.5.0] - 2026-09-17
 
 ### Added
```

**File**: `package-lock.json` (modified, +235/-218)
```diff
@@ -13,7 +13,7 @@
         "class-variance-authority": "^0.7.1",
         "clsx": "^2.1.1",
         "lucide-react": "^1.6.0",
-        "next": "16.3.0",
+        "next": "16.3.5",
         "react": "19.2.4",
         "react-dom": "19.2.4",
         "shadcn": "^4.1.0",
@@ -26,7 +26,7 @@
         "@types/react": "^19",
         "@types/react-dom": "^19",
         "eslint": "^9",
-        "eslint-config-next": "16.3.0",
+        "eslint-config-next": "16.3.5",
         "tailwindcss": "^4",
         "typescript": "^5"
       },
@@ -939,29 +939,43 @@
       }
     },
     "node_modules/@humanfs/core": {
-      "version": "0.19.1",
-      "resolved": "https://registry.npmjs.org/@humanfs/core/-/core-0.19.1.tgz",
-      "integrity": "sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==",
+      "version": "0.19.2",
+      "resolved": "https://registry.npmjs.org/@humanfs/core/-/core-0.19.2.tgz",
+      "integrity": "sha512-UhXNm+CFMWcbChXywFwkmhqjs3PRCmcSa/hfBgLIb7oQ5HNb1wS0icWsGtSAUNgefHeI+eBrA8I1fxmbHsGdvA==",
       "dev": true,
       "license": "Apache-2.0",
+      "dependencies": {
+        "@humanfs/types": "^0.15.0"
+      },
       "engines": {
         "node": ">=18.18.0"
       }
     },
     "node_modules/@humanfs/node": {
-      "version": "0.16.7",
-      "resolved": "https://registry.npmjs.org/@humanfs/node/-/node-0.16.7.tgz",
-      "integrity": "sha512-/zUx+yOsIrG4Y43Eh2peDeKCxlRt/gET6aHfaKpuq267qXdYDFViVHfMaLyygZOnl0kGWxFIgsBy8QFuTLUXEQ==",
+      "version": "0.16.8",
+      "resolved": "https://registry.npmjs.org/@humanfs/node/-/node-0.16.8.tgz",
+      "integrity": "sha512-gE1eQNZ3R++kTzFUpdGlpmy8kDZD/MLyHqDwqjkVQI0JMdI1D51sy1H958PNXYkM2rAac7e5/CnIKZrHtPh3BQ==",
       "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
-        "@humanfs/core": "^0.19.1",
+        "@humanfs/core": "^0.19.2",
+        "@humanfs/types": "^0.15.0",
         "@humanwhocodes/retry": "^0.4.0"
       },
       "engines": {
         "node": ">=18.18.0"
       }
     },
+    "node_modules/@humanfs/types": {
+      "version": "0.15.0",
+      "resolved": "https://registry.npmjs.org/@humanfs/types/-/types-0.15.0.tgz",
+      "integrity": "sha512-ZZ1w0aoQkwuUuC7Yf+7sdeaNfqQiiLcSRbfI08oAxqLtpXQr9AIVX7Ay7HLDuiLYAaFPu8oBYNq/QIi9URHJ3Q==",
+      "dev": true,
+      "license": "Apache-2.0",
+      "engines": {
+        "node": ">=18.18.0"
+      }
+    },
     "node_modules/@humanwhocodes/module-importer": {
       "version": "1.0.1",
       "resolved": "https://registry.npmjs.org/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz",
@@ -1001,9 +1015,9 @@
       }
     },
     "node_modules/@img/sharp-darwin-arm64": {
-      "version": "0.35.3",
-      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.3.tgz",
-      "integrity": "sha512-RMnFX7YQsMoh7lWfcM4NEHHymBX/rLuKNPVM84XE9ONPcaSCDgE7CHIHpSgPcO2xcRthgBy1HfNO319mwhIAkg==",
+      "version": "0.35.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.4.tgz",
+      "integrity": "sha512-Uhfl4V4lhP2nbUVF9+hyH1+luj86f1gUFeo8ALYxFoULoU+G87D43BfeMP8XHsk9boxAnCY/bf2EHwhA7MuGsA==",
       "cpu": [
         "arm64"
       ],
@@ -1019,13 +1033,13 @@
         "url": "https://opencollective.com/libvips"
       },
       "optionalDependencies": {
-        "@img/sharp-libvips-darwin-arm64": "1.3.2"
+        "@img/sharp-libvips-darwin-arm64": "1.3.3"
       }
     },
     "node_modules/@img/sharp-darwin-x64": {
-      "version": "0.35.3",
-      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.3.tgz",
-      "integrity": "sha512-Xo+5uFBtLN0BKqieTxiFzFPQAUlBbbH5iBKyRX/z1JrbnYsHTfKJnUfL8+p2TPXr1pXqao4eeL4Rl144uDpK9w==",
+      "version": "0.35.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.4.tgz",
+      "integrity": "sha512-hWniXY3bG5qKpkKrAwPe4y+VTPmf086YQAnkxWh7uA1YrlRo
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -39,7 +39,7 @@
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
     "lucide-react": "^1.6.0",
-    "next": "16.3.0",
+    "next": "16.3.5",
     "react": "19.2.4",
     "react-dom": "19.2.4",
     "shadcn": "^4.1.0",
@@ -52,7 +52,7 @@
     "@types/react": "^19",
     "@types/react-dom": "^19",
     "eslint": "^9",
-    "eslint-config-next": "16.3.0",
+    "eslint-config-next": "16.3.5",
     "tailwindcss": "^4",
     "typescript": "^5"
   }
```

---

### Incident Patch 2: `61b363a1` (2026-08-10)
**Commit Message**: fix: preserve pages across clone runs

**File**: `.amazonq/cli-agents/clone-website.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "clone-website",
-  "description": "Reverse-engineer and clone any website as a pixel-perfect replica",
-  "prompt": "\n# Clone Website\n\nYou are about to reverse-engineer and rebuild **the target URL provided by the user** as pixel-perfect clones.\n\nWhen multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).\n\nThis is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.\n\n## Scope Defaults\n\nThe target is whatever page `the target URL provided by the user` resolves to. Clone exactly what's visible at that URL. Unless the user specifies otherwise, use these defaults:\n\n- **Fidelity level:** Pixel-perfect — exact match in colors, spacing, typography, animations\n- **In scope:** Visual layout and styling, component structure and interactions, responsive design, mock data for demo purposes\n- **Out of scope:** Real backend / database, authentication, real-time features, SEO optimization, accessibility audit\n- **Customization:** None — pure emulation\n\nIf the user provides additional instructions (specific fidelity level, customizations, extra context), honor those over the defaults.\n\n## Pre-Flight\n\n1. **Browser automation is required.** Check for available browser MCP tools (Chrome MCP, Playwright MCP, Browserbase MCP, Puppeteer MCP, etc.). Use whichever is available — if multiple exist, prefer Chrome MCP. If none are detected, ask the user which browser tool they have and how to connect it. This skill cannot work without browser automation.\n2. Parse `the target URL provided by the user` as one or more URLs. Normalize and validate each URL; if any are invalid, ask the user to correct them before proceeding. For each valid URL, verify it is accessible via your browser MCP tool.\n3. Verify the base project builds: `npm run build`. The Next.js + shadcn/ui + Tailwind v4 scaffold should already be in place. If not, tell the user to set it up first.\n4. Create the output directories if they don't exist: `docs/research/`, `docs/research/components/`, `docs/design-references/`, `scripts/`. For multiple clones, also prepare per-site folders like `docs/research/<hostname>/` and `docs/design-references/<hostname>/`.\n5. When working with multiple sites in one command, optionally confirm whether to run them in parallel (recommended, if resources allow) or sequentially to avoid overload.\n\n## Guiding Principles\n\nThese are the truths that separate a successful clone from a \"close enough\" mess. Internalize them — they should inform every decision you make.\n\n### 1. Completeness Beats Speed\n\nEvery builder agent must receive **everything** it needs to do its job perfectly: screenshot, exact CSS values, downloaded assets with local paths, real text content, component structure. If a builder has to guess anything — a color, a font size, a padding value — you have failed at extraction. Take the extra minute to extract one more property rather than shipping an incomplete brief.\n\n### 2. Small Tasks, Perfect Results\n\nWhen an agent gets \"build the entire features section,\" it glosses over details — it approximates spacing, guesses font sizes, and produces something \"close enough\" but clearly wrong. When it gets a single focused component with exact CSS values, it nails it every time.\n\nLook at each section and judge its complexity. A simple banner with a heading and a button? One agent. A complex section with 3 different card variants, each with unique hover states and internal layouts? One agent per card variant plus one for the section
```

**File**: `.augment/commands/clone-website.md` (modified, +69/-36)
```diff
@@ -1,6 +1,6 @@
 ---
-description: "Reverse-engineer and clone any website as a pixel-perfect replica"
-argument-hint: "<url>"
+description: "Reverse-engineer and clone one or more websites as pixel-perfect replicas"
+argument-hint: "<url1> [<url2> ...]"
 ---
 <!-- AUTO-GENERATED from .claude/skills/clone-website/SKILL.md — do not edit directly.
      Run `node scripts/sync-skills.mjs` to regenerate. -->
@@ -10,7 +10,7 @@ argument-hint: "<url>"
 
 You are about to reverse-engineer and rebuild **$ARGUMENTS** as pixel-perfect clones.
 
-When multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).
+When multiple URLs are provided, preserve every pathname as a distinct route and isolate each target's research, screenshots, components, and assets. URLs that differ only by query string or fragment share a pathname, so resolve their route and state behavior explicitly in the output plan. Parallelize page work only after the shared foundation and output plan are fixed so concurrent builders cannot overwrite one another.
 
 This is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.
 
@@ -25,13 +25,41 @@ The target is whatever page `$ARGUMENTS` resolves to. Clone exactly what's visib
 
 If the user provides additional instructions (specific fidelity level, customizations, extra context), honor those over the defaults.
 
+## Output Isolation and Route Preservation
+
+Treat every target URL as durable project output, not as permission to replace whatever was built previously.
+
+Choose an `<app-root>` before extraction. For a single application, `<app-root>` is the repository root (`.`). If different origins need separate applications, require the user to provide or approve a prepared Next.js project root for each origin; verify each root builds independently, and never write one origin's output into another root.
+
+Then assign each target:
+
+- A collision-resistant `<site-key>`: a readable origin slug (including a non-default port) plus the first 8 lowercase hex characters of SHA-256 over the normalized origin.
+- A collision-resistant `<page-key>`: a segment-preserving readable pathname slug plus the first 8 lowercase hex characters of SHA-256 over the normalized pathname and any stateful query/fragment; use `root-<hash>` for `/`. Never rely on lossy character replacement alone.
+- An artifact root: `<app-root>/docs/research/<site-key>/<page-key>/`.
+- A screenshot root: `<app-root>/docs/design-references/<site-key>/<page-key>/`.
+- A component root: `<app-root>/src/components/sites/<site-key>/<page-key>/`, with genuinely shared same-site components under `<app-root>/src/components/sites/<site-key>/shared/`.
+- An asset root: `<app-root>/public/sites/<site-key>/<page-key>/`, with genuinely shared same-site assets under `<app-root>/public/sites/<site-key>/shared/`.
+- A Next.js route file.
+
+All paths in the remaining phases are relative to that target's `<app-root>`. Before writing, verify that every planned route, artifact root, screenshot root, component root, asset root, and downloader filename is unique or is an explicitly approved shared location.
+
+Routing defaults:
+
+- For the first single-URL clone in an untouched template, the existing scaffold at `src/app/page.tsx` may be replaced so the clone remains available at `/`.
+- For multiple URLs from the same origin, or any later clone added to a project that already contains cloned/user-authored pages, preserve the normalized source pathname as its App Router URL (for example, `/docs/intro` becomes `<app-root>/src/app/
```

**File**: `.claude/skills/clone-website/SKILL.md` (modified, +67/-34)
```diff
@@ -9,7 +9,7 @@ user-invocable: true
 
 You are about to reverse-engineer and rebuild **$ARGUMENTS** as pixel-perfect clones.
 
-When multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).
+When multiple URLs are provided, preserve every pathname as a distinct route and isolate each target's research, screenshots, components, and assets. URLs that differ only by query string or fragment share a pathname, so resolve their route and state behavior explicitly in the output plan. Parallelize page work only after the shared foundation and output plan are fixed so concurrent builders cannot overwrite one another.
 
 This is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.
 
@@ -24,13 +24,41 @@ The target is whatever page `$ARGUMENTS` resolves to. Clone exactly what's visib
 
 If the user provides additional instructions (specific fidelity level, customizations, extra context), honor those over the defaults.
 
+## Output Isolation and Route Preservation
+
+Treat every target URL as durable project output, not as permission to replace whatever was built previously.
+
+Choose an `<app-root>` before extraction. For a single application, `<app-root>` is the repository root (`.`). If different origins need separate applications, require the user to provide or approve a prepared Next.js project root for each origin; verify each root builds independently, and never write one origin's output into another root.
+
+Then assign each target:
+
+- A collision-resistant `<site-key>`: a readable origin slug (including a non-default port) plus the first 8 lowercase hex characters of SHA-256 over the normalized origin.
+- A collision-resistant `<page-key>`: a segment-preserving readable pathname slug plus the first 8 lowercase hex characters of SHA-256 over the normalized pathname and any stateful query/fragment; use `root-<hash>` for `/`. Never rely on lossy character replacement alone.
+- An artifact root: `<app-root>/docs/research/<site-key>/<page-key>/`.
+- A screenshot root: `<app-root>/docs/design-references/<site-key>/<page-key>/`.
+- A component root: `<app-root>/src/components/sites/<site-key>/<page-key>/`, with genuinely shared same-site components under `<app-root>/src/components/sites/<site-key>/shared/`.
+- An asset root: `<app-root>/public/sites/<site-key>/<page-key>/`, with genuinely shared same-site assets under `<app-root>/public/sites/<site-key>/shared/`.
+- A Next.js route file.
+
+All paths in the remaining phases are relative to that target's `<app-root>`. Before writing, verify that every planned route, artifact root, screenshot root, component root, asset root, and downloader filename is unique or is an explicitly approved shared location.
+
+Routing defaults:
+
+- For the first single-URL clone in an untouched template, the existing scaffold at `src/app/page.tsx` may be replaced so the clone remains available at `/`.
+- For multiple URLs from the same origin, or any later clone added to a project that already contains cloned/user-authored pages, preserve the normalized source pathname as its App Router URL (for example, `/docs/intro` becomes `<app-root>/src/app/docs/intro/page.tsx`). Encode filesystem segment names that would invoke App Router syntax: escape a leading `_` or `@`, and literal parentheses or square brackets, with percent-encoded folder spellings rather than creating private folders, slots, route groups, or dynamic segments. Verify the built route resolves at the exact normalized URL before completion.
+- Inspect every existing `src/app/**/page.tsx` be
```

**File**: `.cline/skills/clone-website/SKILL.md` (modified, +71/-38)
```diff
@@ -1,19 +1,19 @@
 ---
 name: clone-website
-description: "Reverse-engineer and clone any website as a pixel-perfect replica"
+description: "Reverse-engineer and clone one or more websites as pixel-perfect replicas"
 ---
 
 # Clone Website
 
-You are about to reverse-engineer and rebuild **the target URL provided by the user** as pixel-perfect clones.
+You are about to reverse-engineer and rebuild **the target URL or URLs provided by the user** as pixel-perfect clones.
 
-When multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).
+When multiple URLs are provided, preserve every pathname as a distinct route and isolate each target's research, screenshots, components, and assets. URLs that differ only by query string or fragment share a pathname, so resolve their route and state behavior explicitly in the output plan. Parallelize page work only after the shared foundation and output plan are fixed so concurrent builders cannot overwrite one another.
 
 This is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.
 
 ## Scope Defaults
 
-The target is whatever page `the target URL provided by the user` resolves to. Clone exactly what's visible at that URL. Unless the user specifies otherwise, use these defaults:
+The target is whatever page `the target URL or URLs provided by the user` resolves to. Clone exactly what's visible at that URL. Unless the user specifies otherwise, use these defaults:
 
 - **Fidelity level:** Pixel-perfect — exact match in colors, spacing, typography, animations
 - **In scope:** Visual layout and styling, component structure and interactions, responsive design, mock data for demo purposes
@@ -22,13 +22,41 @@ The target is whatever page `the target URL provided by the user` resolves to. C
 
 If the user provides additional instructions (specific fidelity level, customizations, extra context), honor those over the defaults.
 
+## Output Isolation and Route Preservation
+
+Treat every target URL as durable project output, not as permission to replace whatever was built previously.
+
+Choose an `<app-root>` before extraction. For a single application, `<app-root>` is the repository root (`.`). If different origins need separate applications, require the user to provide or approve a prepared Next.js project root for each origin; verify each root builds independently, and never write one origin's output into another root.
+
+Then assign each target:
+
+- A collision-resistant `<site-key>`: a readable origin slug (including a non-default port) plus the first 8 lowercase hex characters of SHA-256 over the normalized origin.
+- A collision-resistant `<page-key>`: a segment-preserving readable pathname slug plus the first 8 lowercase hex characters of SHA-256 over the normalized pathname and any stateful query/fragment; use `root-<hash>` for `/`. Never rely on lossy character replacement alone.
+- An artifact root: `<app-root>/docs/research/<site-key>/<page-key>/`.
+- A screenshot root: `<app-root>/docs/design-references/<site-key>/<page-key>/`.
+- A component root: `<app-root>/src/components/sites/<site-key>/<page-key>/`, with genuinely shared same-site components under `<app-root>/src/components/sites/<site-key>/shared/`.
+- An asset root: `<app-root>/public/sites/<site-key>/<page-key>/`, with genuinely shared same-site assets under `<app-root>/public/sites/<site-key>/shared/`.
+- A Next.js route file.
+
+All paths in the remaining phases are relative to that target's `<app-root>`. Before writing, verify that every planned route, artifact root, screensh
```

**File**: `.codex/skills/clone-website/SKILL.md` (modified, +67/-34)
```diff
@@ -9,7 +9,7 @@ user-invocable: true
 
 You are about to reverse-engineer and rebuild **$ARGUMENTS** as pixel-perfect clones.
 
-When multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).
+When multiple URLs are provided, preserve every pathname as a distinct route and isolate each target's research, screenshots, components, and assets. URLs that differ only by query string or fragment share a pathname, so resolve their route and state behavior explicitly in the output plan. Parallelize page work only after the shared foundation and output plan are fixed so concurrent builders cannot overwrite one another.
 
 This is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.
 
@@ -24,13 +24,41 @@ The target is whatever page `$ARGUMENTS` resolves to. Clone exactly what's visib
 
 If the user provides additional instructions (specific fidelity level, customizations, extra context), honor those over the defaults.
 
+## Output Isolation and Route Preservation
+
+Treat every target URL as durable project output, not as permission to replace whatever was built previously.
+
+Choose an `<app-root>` before extraction. For a single application, `<app-root>` is the repository root (`.`). If different origins need separate applications, require the user to provide or approve a prepared Next.js project root for each origin; verify each root builds independently, and never write one origin's output into another root.
+
+Then assign each target:
+
+- A collision-resistant `<site-key>`: a readable origin slug (including a non-default port) plus the first 8 lowercase hex characters of SHA-256 over the normalized origin.
+- A collision-resistant `<page-key>`: a segment-preserving readable pathname slug plus the first 8 lowercase hex characters of SHA-256 over the normalized pathname and any stateful query/fragment; use `root-<hash>` for `/`. Never rely on lossy character replacement alone.
+- An artifact root: `<app-root>/docs/research/<site-key>/<page-key>/`.
+- A screenshot root: `<app-root>/docs/design-references/<site-key>/<page-key>/`.
+- A component root: `<app-root>/src/components/sites/<site-key>/<page-key>/`, with genuinely shared same-site components under `<app-root>/src/components/sites/<site-key>/shared/`.
+- An asset root: `<app-root>/public/sites/<site-key>/<page-key>/`, with genuinely shared same-site assets under `<app-root>/public/sites/<site-key>/shared/`.
+- A Next.js route file.
+
+All paths in the remaining phases are relative to that target's `<app-root>`. Before writing, verify that every planned route, artifact root, screenshot root, component root, asset root, and downloader filename is unique or is an explicitly approved shared location.
+
+Routing defaults:
+
+- For the first single-URL clone in an untouched template, the existing scaffold at `src/app/page.tsx` may be replaced so the clone remains available at `/`.
+- For multiple URLs from the same origin, or any later clone added to a project that already contains cloned/user-authored pages, preserve the normalized source pathname as its App Router URL (for example, `/docs/intro` becomes `<app-root>/src/app/docs/intro/page.tsx`). Encode filesystem segment names that would invoke App Router syntax: escape a leading `_` or `@`, and literal parentheses or square brackets, with percent-encoded folder spellings rather than creating private folders, slots, route groups, or dynamic segments. Verify the built route resolves at the exact normalized URL before completion.
+- Inspect every existing `src/app/**/page.tsx` be
```

---

### Incident Patch 3: `1726b55f` (2026-08-10)
**Commit Message**: fix: complete Cline and Roo skill support

**File**: `.cline/skills/clone-website/SKILL.md` (added, +471/-0)
```diff
@@ -0,0 +1,471 @@
+---
+name: clone-website
+description: "Reverse-engineer and clone any website as a pixel-perfect replica"
+---
+
+# Clone Website
+
+You are about to reverse-engineer and rebuild **the target URL provided by the user** as pixel-perfect clones.
+
+When multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).
+
+This is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.
+
+## Scope Defaults
+
+The target is whatever page `the target URL provided by the user` resolves to. Clone exactly what's visible at that URL. Unless the user specifies otherwise, use these defaults:
+
+- **Fidelity level:** Pixel-perfect — exact match in colors, spacing, typography, animations
+- **In scope:** Visual layout and styling, component structure and interactions, responsive design, mock data for demo purposes
+- **Out of scope:** Real backend / database, authentication, real-time features, SEO optimization, accessibility audit
+- **Customization:** None — pure emulation
+
+If the user provides additional instructions (specific fidelity level, customizations, extra context), honor those over the defaults.
+
+## Pre-Flight
+
+1. **Browser automation is required.** Check for available browser MCP tools (Chrome MCP, Playwright MCP, Browserbase MCP, Puppeteer MCP, etc.). Use whichever is available — if multiple exist, prefer Chrome MCP. If none are detected, ask the user which browser tool they have and how to connect it. This skill cannot work without browser automation.
+2. Parse `the target URL provided by the user` as one or more URLs. Normalize and validate each URL; if any are invalid, ask the user to correct them before proceeding. For each valid URL, verify it is accessible via your browser MCP tool.
+3. Verify the base project builds: `npm run build`. The Next.js + shadcn/ui + Tailwind v4 scaffold should already be in place. If not, tell the user to set it up first.
+4. Create the output directories if they don't exist: `docs/research/`, `docs/research/components/`, `docs/design-references/`, `scripts/`. For multiple clones, also prepare per-site folders like `docs/research/<hostname>/` and `docs/design-references/<hostname>/`.
+5. When working with multiple sites in one command, optionally confirm whether to run them in parallel (recommended, if resources allow) or sequentially to avoid overload.
+
+## Guiding Principles
+
+These are the truths that separate a successful clone from a "close enough" mess. Internalize them — they should inform every decision you make.
+
+### 1. Completeness Beats Speed
+
+Every builder agent must receive **everything** it needs to do its job perfectly: screenshot, exact CSS values, downloaded assets with local paths, real text content, component structure. If a builder has to guess anything — a color, a font size, a padding value — you have failed at extraction. Take the extra minute to extract one more property rather than shipping an incomplete brief.
+
+### 2. Small Tasks, Perfect Results
+
+When an agent gets "build the entire features section," it glosses over details — it approximates spacing, guesses font sizes, and produces something "close enough" but clearly wrong. When it gets a single focused component with exact CSS values, it nails it every time.
+
+Look at each section and judge its complexity. A simple banner with a heading and a button? One agent. A complex section with 3 different card variants, each with unique hover states and internal layouts? One agent per card variant plus one for the section wrapper. When in doub
```

**File**: `.roo/commands/clone-website.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+description: "Reverse-engineer and clone any website as a pixel-perfect replica"
+argument-hint: "<url1> [<url2> ...]"
+---
+<!-- AUTO-GENERATED from .claude/skills/clone-website/SKILL.md — do not edit directly.
+     Run `node scripts/sync-skills.mjs` to regenerate. -->
+
+Use the `clone-website` skill for the target URL or URLs provided by the user. Load that skill and follow its workflow exactly.
```

**File**: `.roo/skills/clone-website/SKILL.md` (added, +471/-0)
```diff
@@ -0,0 +1,471 @@
+---
+name: clone-website
+description: "Reverse-engineer and clone any website as a pixel-perfect replica"
+---
+
+# Clone Website
+
+You are about to reverse-engineer and rebuild **the target URL provided by the user** as pixel-perfect clones.
+
+When multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).
+
+This is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.
+
+## Scope Defaults
+
+The target is whatever page `the target URL provided by the user` resolves to. Clone exactly what's visible at that URL. Unless the user specifies otherwise, use these defaults:
+
+- **Fidelity level:** Pixel-perfect — exact match in colors, spacing, typography, animations
+- **In scope:** Visual layout and styling, component structure and interactions, responsive design, mock data for demo purposes
+- **Out of scope:** Real backend / database, authentication, real-time features, SEO optimization, accessibility audit
+- **Customization:** None — pure emulation
+
+If the user provides additional instructions (specific fidelity level, customizations, extra context), honor those over the defaults.
+
+## Pre-Flight
+
+1. **Browser automation is required.** Check for available browser MCP tools (Chrome MCP, Playwright MCP, Browserbase MCP, Puppeteer MCP, etc.). Use whichever is available — if multiple exist, prefer Chrome MCP. If none are detected, ask the user which browser tool they have and how to connect it. This skill cannot work without browser automation.
+2. Parse `the target URL provided by the user` as one or more URLs. Normalize and validate each URL; if any are invalid, ask the user to correct them before proceeding. For each valid URL, verify it is accessible via your browser MCP tool.
+3. Verify the base project builds: `npm run build`. The Next.js + shadcn/ui + Tailwind v4 scaffold should already be in place. If not, tell the user to set it up first.
+4. Create the output directories if they don't exist: `docs/research/`, `docs/research/components/`, `docs/design-references/`, `scripts/`. For multiple clones, also prepare per-site folders like `docs/research/<hostname>/` and `docs/design-references/<hostname>/`.
+5. When working with multiple sites in one command, optionally confirm whether to run them in parallel (recommended, if resources allow) or sequentially to avoid overload.
+
+## Guiding Principles
+
+These are the truths that separate a successful clone from a "close enough" mess. Internalize them — they should inform every decision you make.
+
+### 1. Completeness Beats Speed
+
+Every builder agent must receive **everything** it needs to do its job perfectly: screenshot, exact CSS values, downloaded assets with local paths, real text content, component structure. If a builder has to guess anything — a color, a font size, a padding value — you have failed at extraction. Take the extra minute to extract one more property rather than shipping an incomplete brief.
+
+### 2. Small Tasks, Perfect Results
+
+When an agent gets "build the entire features section," it glosses over details — it approximates spacing, guesses font sizes, and produces something "close enough" but clearly wrong. When it gets a single focused component with exact CSS values, it nails it every time.
+
+Look at each section and judge its complexity. A simple banner with a heading and a button? One agent. A complex section with 3 different card variants, each with unique hover states and internal layouts? One agent per card variant plus one for the section wrapper. When in doub
```

**File**: `README.ja.md` (modified, +4/-2)
```diff
@@ -69,7 +69,7 @@ AI コーディングエージェントに URL を渡すだけで、ウェブサ
    ```
 6. **カスタマイズする**（任意）— 基本のクローンが構築された後、必要に応じて変更します
 
-> 別のエージェントを使用しますか？プロジェクトの手順については `AGENTS.md` を開いてください。ほとんどのエージェントはこのファイルを自動的に読み込みます。
+> ほとんどの対応クライアントでは `/clone-website` を直接実行できます。自然言語による依頼でスキルを起動するクライアントでは、`clone-website ワークフローを使って <対象URL> をクローンして` と入力してください。プロジェクトの指示は `AGENTS.md` にあります。
 
 ## 対応プラットフォーム
 
@@ -88,7 +88,6 @@ AI コーディングエージェントに URL を渡すだけで、ウェブサ
 | [Continue](https://continue.dev/)                             | 対応                  |
 | [Amazon Q](https://aws.amazon.com/q/developer/)               | 対応                  |
 | [Augment Code](https://www.augmentcode.com/)                  | 対応                  |
-| [Aider](https://aider.chat/)                                  | 対応                  |
 
 ## 前提条件
 
@@ -156,6 +155,9 @@ scripts/
   sync-agent-rules.sh  # エージェント指示ファイルを再生成
   sync-skills.mjs      # 全プラットフォーム向けに /clone-website を再生成
 .kiro/skills/          # 生成された Kiro ワークスペーススキル
+.cline/skills/         # 生成された Cline ワークスペーススキル
+.roo/skills/           # 生成された Roo Code ワークスペーススキル
+.roo/commands/         # 生成された Roo Code スラッシュコマンド
 AGENTS.md           # エージェント指示（唯一の参照元）
 CLAUDE.md           # Claude Code 設定（AGENTS.md を読み込み）
 GEMINI.md           # Gemini CLI 設定（AGENTS.md を読み込み）
```

**File**: `README.md` (modified, +4/-2)
```diff
@@ -69,7 +69,7 @@ Give your AI coding agent a URL and watch it recreate the website as a clean Nex
    ```
 6. **Customize** (optional) — after the base clone is built, modify as needed
 
-> Using a different agent? Open `AGENTS.md` for project instructions — most agents pick it up automatically.
+> Most supported clients expose `/clone-website` directly. If your client activates skills from natural-language requests, enter `Clone <target-url> using the clone-website workflow`. Project instructions are in `AGENTS.md`.
 
 ## Supported Platforms
 
@@ -88,7 +88,6 @@ Give your AI coding agent a URL and watch it recreate the website as a clean Nex
 | [Continue](https://continue.dev/)                             | Supported                  |
 | [Amazon Q](https://aws.amazon.com/q/developer/)               | Supported                  |
 | [Augment Code](https://www.augmentcode.com/)                  | Supported                  |
-| [Aider](https://aider.chat/)                                  | Supported                  |
 
 ## Prerequisites
 
@@ -156,6 +155,9 @@ scripts/
   sync-agent-rules.sh  # Regenerate agent instruction files
   sync-skills.mjs      # Regenerate /clone-website for all platforms
 .kiro/skills/          # Generated Kiro workspace skill
+.cline/skills/         # Generated Cline workspace skill
+.roo/skills/           # Generated Roo Code workspace skill
+.roo/commands/         # Generated Roo Code slash command
 AGENTS.md           # Agent instructions (single source of truth)
 CLAUDE.md           # Claude Code config (imports AGENTS.md)
 GEMINI.md           # Gemini CLI config (imports AGENTS.md)
```

---

### Incident Patch 4: `78db3b99` (2026-08-10)
**Commit Message**: docs: add a security policy

**File**: `SECURITY.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Security Policy
+
+## Supported versions
+
+This project is a template rather than a versioned library. Security fixes are
+applied to the latest version of the `master` branch.
+
+Projects created from this template do not receive fixes automatically. Their
+maintainers are responsible for reviewing relevant changes and updating their
+own copies.
+
+## Reporting a vulnerability
+
+Please do not disclose vulnerability details in a public issue, pull request,
+discussion, or Discord message.
+
+Use GitHub's private
+[Report a vulnerability](https://github.com/JCodesMore/ai-website-cloner-template/security/advisories/new)
+form instead. Include, when available:
+
+- A clear description of the vulnerability and its potential impact
+- The affected files, dependencies, configuration, or commit
+- Steps to reproduce the issue or a minimal proof of concept
+- Any suggested mitigation or fix
+
+We will acknowledge the report as soon as practical, investigate it, and
+coordinate with you before any public disclosure.
+
+If the private form is unavailable, you may use the
+[Discord community](https://discord.gg/hrTSX5yTpB) only to ask a maintainer for
+a private contact method. Do not post vulnerability details there.
+
+## Scope
+
+Security reports may cover:
+
+- Code and dependencies shipped on the `master` branch
+- Helper and synchronization scripts under `scripts/`
+- Repository configuration or defaults that could make generated projects
+  insecure
+- AI-agent instructions that introduce a concrete security vulnerability
+
+Generated website code, third-party services, vulnerabilities in unrelated
+websites, and automated audit output without a demonstrated impact on this
+template are outside this project's security scope.
+
+## Responsible use
+
+This template is intended for authorized development, migration, recovery, and
+learning. See [Not Intended For](README.md#not-intended-for) for prohibited
+uses. Reports about abuse or copied content should not include sensitive
+security details in public channels.
```

---

### Incident Patch 5: `8d5575ea` (2026-08-08)
**Commit Message**: fix: refresh Next.js and vulnerable dependencies (#88)

* Update Next.js and refresh vulnerable dependencies

* Sync Next.js 16.3 agent rules

* Prefer established secure Hono adapter

**File**: `.amazonq/rules/project.md` (modified, +5/-1)
```diff
@@ -2,9 +2,13 @@
      Run `bash scripts/sync-agent-rules.sh` to regenerate. -->
 
 <!-- BEGIN:nextjs-agent-rules -->
+
 # This is NOT the Next.js you know
 
-This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
+This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.
+
+This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
+
 <!-- END:nextjs-agent-rules -->
 
 # Website Reverse-Engineer Template
```

**File**: `.clinerules` (modified, +5/-1)
```diff
@@ -2,9 +2,13 @@
      Run `bash scripts/sync-agent-rules.sh` to regenerate. -->
 
 <!-- BEGIN:nextjs-agent-rules -->
+
 # This is NOT the Next.js you know
 
-This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
+This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.
+
+This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
+
 <!-- END:nextjs-agent-rules -->
 
 # Website Reverse-Engineer Template
```

**File**: `.continue/rules/project.md` (modified, +5/-1)
```diff
@@ -6,9 +6,13 @@ description: Project conventions for AI Website Clone Template
 alwaysApply: true
 ---
 <!-- BEGIN:nextjs-agent-rules -->
+
 # This is NOT the Next.js you know
 
-This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
+This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.
+
+This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
+
 <!-- END:nextjs-agent-rules -->
 
 # Website Reverse-Engineer Template
```

**File**: `.github/copilot-instructions.md` (modified, +5/-1)
```diff
@@ -2,9 +2,13 @@
      Run `bash scripts/sync-agent-rules.sh` to regenerate. -->
 
 <!-- BEGIN:nextjs-agent-rules -->
+
 # This is NOT the Next.js you know
 
-This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
+This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.
+
+This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
+
 <!-- END:nextjs-agent-rules -->
 
 # Website Reverse-Engineer Template
```

**File**: `AGENTS.md` (modified, +5/-1)
```diff
@@ -1,7 +1,11 @@
 <!-- BEGIN:nextjs-agent-rules -->
+
 # This is NOT the Next.js you know
 
-This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
+This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.
+
+This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
+
 <!-- END:nextjs-agent-rules -->
 
 # Website Reverse-Engineer Template
```

---

### Incident Patch 6: `2b4584d1` (2026-06-01)
**Commit Message**: fix: resolve gemini CLI validation errors by adding name field and flattening prompt key (#44)

**File**: `.gemini/commands/clone-website.toml` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@
 # Run `node scripts/sync-skills.mjs` to regenerate.
 
 description = "Reverse-engineer and clone any website as a pixel-perfect replica"
+name = "clone-website"
 
-[prompt]
-text = '''
+prompt = '''
 
 # Clone Website
 
```

**File**: `scripts/sync-skills.mjs` (modified, +3/-2)
```diff
@@ -71,8 +71,9 @@ write(
   '.gemini/commands/clone-website.toml',
   `# AUTO-GENERATED from .claude/skills/clone-website/SKILL.md\n` +
     `# Run \`node scripts/sync-skills.mjs\` to regenerate.\n\n` +
-    `description = "${shortDesc}"\n\n` +
-    `[prompt]\ntext = '''\n${geminiBody}\n'''\n`
+    `description = "${shortDesc}"\n` +
+    `name = "clone-website"\n\n` +
+    `prompt = '''\n${geminiBody}\n'''\n`
 );
 
 // 6. OpenCode — markdown + YAML frontmatter, $ARGUMENTS works natively
```

---

### Incident Patch 7: `db7a80de` (2026-03-26)
**Commit Message**: Fix typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# AI Website Clone Template
+# AI Website Cloner Template
 
 A reusable template for reverse-engineering any website and rebuilding it as a pixel-perfect clone using [Claude Code](https://docs.anthropic.com/en/docs/claude-code).
 
```

#### Recent Merged Pull Requests:
- **PR #120** (2026-09-27): docs: recommend Opus 5.5 and refresh Star History chart (@JCodesMore)
- **PR #119** (2026-09-20): fix(security): patch dependencies while retaining exact Next.js pins (@JCodesMore)
- **PR #118** (closed): fix(security): bump Next.js to 16.3.5 and patch all npm audit advisories (0 vulnerabilities) (@atahan150)
- **PR #116** (2026-09-17): docs: simplify Quick Start and keep one README (@JCodesMore)
- **PR #115** (2026-09-17): refactor: centralize skills for four supported agents (@JCodesMore)
- **PR #114** (2026-09-17): chore: remove expired sponsor integrations (@JCodesMore)
- **PR #113** (closed): feat: add website cloner parity spine v0.5.1 (@Borekobama)
- **PR #112** (closed): Fix/slide verify component (@jumardi2635-commits)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

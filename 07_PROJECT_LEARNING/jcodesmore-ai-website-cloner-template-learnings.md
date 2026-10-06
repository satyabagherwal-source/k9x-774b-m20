# Forensic Learning Record (Deep Inspection): JCodesMore/ai-website-cloner-template

> **Canonical Artifact**: `07_PROJECT_LEARNING/jcodesmore-ai-website-cloner-template-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/JCodesMore/ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:53:06.665Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `JCodesMore/ai-website-cloner-template`
- **Description**: Clone any website with one command using AI coding agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 35926 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

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

### Incident Patch 1: `ee3f5a2f` (2026-10-05)
**Commit Message**: fix: count the README token badge in CI (#125)

The hosted gittokens count for this repository stopped refreshing and still reports the v0.4.0 size. Run the same counter (gittokens, pinned) on each push to master and publish its shields endpoint JSON to a single-file badges branch.

**File**: `.github/workflows/token-badge.yml` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+name: Token badge
+
+on:
+  push:
+    branches:
+      - master
+  workflow_dispatch:
+
+concurrency:
+  group: token-badge
+  cancel-in-progress: true
+
+jobs:
+  count:
+    runs-on: ubuntu-latest
+    timeout-minutes: 10
+    permissions:
+      contents: read
+    outputs:
+      badge: ${{ steps.count.outputs.badge }}
+
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v7
+        with:
+          path: repo
+          persist-credentials: false
+
+      - name: Checkout gittokens
+        uses: actions/checkout@v7
+        with:
+          repository: rsamf/gittokens
+          ref: 9081a2f2cc17055ab6a442ee74d8b35b2bc1ff7d
+          path: gittokens
+          persist-credentials: false
+
+      - name: Setup Python
+        uses: actions/setup-python@v7
+        with:
+          python-version: "3.12"
+
+      - name: Install counter
+        run: pip install --quiet gitingest==0.3.1 tiktoken httpx
+
+      - name: Count tokens
+        id: count
+        env:
+          COUNT_PATH: repo
+          DRY_RUN: "true"
+        run: echo "badge=$(python gittokens/action/count_and_publish.py | jq -c .)" >> "$GITHUB_OUTPUT"
+
+  publish:
+    needs: count
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    permissions:
+      contents: write
+
+    steps:
+      - name: Publish badge JSON to the badges branch
+        env:
+          BADGE: ${{ needs.count.outputs.badge }}
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          test -n "$BADGE"
+          git init -q badge
+          cd badge
+          printf '%s\n' "$BADGE" > token-badge.json
+          git add token-badge.json
+          git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -q -m "Update token badge"
+          git push --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" HEAD:refs/heads/badges
```

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+- Count the README token badge in CI so it reflects the current default branch instead of a stale hosted count.
+
 ## [0.6.1] - 2026-10-05
 
 ### Changed
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ Give your AI coding agent a URL and watch it recreate the website as a clean Nex
 
 [Quick Start](#quick-start) · [Watch Demo](#demo) · [Supported Platforms](#supported-platforms)
 
-<a href="https://github.com/JCodesMore/ai-website-cloner-template/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a> <a href="https://github.com/JCodesMore/ai-website-cloner-template"><img src="https://img.shields.io/github/stars/JCodesMore/ai-website-cloner-template?style=flat" alt="Stars" /></a> <img src="https://img.shields.io/endpoint?url=https://gittokens.rsamf.com/badge/JCodesMore/ai-website-cloner-template" alt="tokens" />
+<a href="https://github.com/JCodesMore/ai-website-cloner-template/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a> <a href="https://github.com/JCodesMore/ai-website-cloner-template"><img src="https://img.shields.io/github/stars/JCodesMore/ai-website-cloner-template?style=flat" alt="Stars" /></a> <img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/JCodesMore/ai-website-cloner-template/badges/token-badge.json" alt="tokens" />
 
   <a href="https://trendshift.io/repositories/24302?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-24302" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/24302" alt="JCodesMore%2Fai-website-cloner-template | Trendshift" width="250" height="55" /></a> <a href="https://www.star-history.com/jcodesmore/ai-website-cloner-template/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template&amp;theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template" /><img alt="Star History Global Rank" src="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template" width="216" height="55" /></picture></a>
 
```

---

### Incident Patch 2: `cb2cc054` (2026-10-05)
**Commit Message**: docs: generalize cloning guidance around observed rules (#124)

Treat each observation as a sample of a rule: read declared values and vary width, height, input, and state. Use the source's actual files, build shared components from every observed state, and detect page-wide behavior such as smooth scrolling instead of defaulting to native scroll.

**File**: `.agents/skills/clone-website/SKILL.md` (modified, +5/-3)
```diff
@@ -26,17 +26,19 @@ Existing clones are useful starting points: compare them with the current source
 
 Inspect the whole page at desktop and mobile widths. Scroll top to bottom to load lazy media and reveal sticky/pinned scenes. Then exercise menus, tabs, accordions, carousels, hover states, and primary links. Distinguish changes driven by **scroll, click, hover, or time**; a click imitation of a scroll-driven section is a different product.
 
+Treat each observation as one sample of a **rule**. Read declared values (computed styles, CSS variables, a library's live options) rather than inferring them from one rendering, and vary viewport width (including wider than the design), viewport height, input, and state until you know what drives each change. Drive the page with the inputs visitors use (wheel, touch, keyboard, pointer); scripted scrolling bypasses behavior attached to them, such as smooth scrolling.
+
 Save source screenshots labeled with viewport, scroll position, and interaction state. Capture alternate-state content/assets. Keep one compact page brief: section order, typography, layout measurements, asset mapping, and interactions. Add section briefs only when they help independent builders.
 
 Read [the inspection reference](references/inspection-guide.md) for extraction and state comparison. For **Framer-generated pages, sticky scenes, reveal animations, or animated media**, read [Framer and motion](references/framer-and-motion.md).
 
-Use actual fonts, text, images, SVGs, and video. Measure important geometry/computed styles. Inspect layered images and media elements before rebuilding a visual as HTML. Track source URL → local asset path and verify content type/dimensions: a `.png` URL may return AVIF.
+Use the source's real text and the files it actually loads: fonts, images, SVGs, and video. A same-named substitute from another provider or icon set has different metrics or shapes. Measure important geometry/computed styles. Inspect layered images and media elements before rebuilding a visual as HTML. Track source URL → local asset path and verify content type/dimensions: a `.png` URL may return AVIF.
 
 Finish when every section and meaningful state has enough evidence to build, with unavailable details identified. A large DOM dump does not replace looking at the page.
 
 ## 3. Build a complete first pass
 
-Establish fonts, page width, colors, shared navigation, assets, and routes first. Reuse fitting components. Prefer CSS for layout/simple motion and an animation library when source behavior needs it.
+Establish fonts, page width, colors, assets, routes, page-wide behavior, and shared components first. Build each shared component with every observed state (hover, focus, breakpoints) so builders reuse it as-is. Reuse fitting components. Prefer CSS for layout/simple motion and an animation library when source behavior needs it.
 
 Build coherent sections with real content. Delegate independent pages/sections after shared files have an owner. Give builders screenshots, relevant measurements/state notes, asset paths, destination files, and a concrete finish line. A concise brief with precise file references is enough; no fixed agent count or per-component paperwork is required.
 
@@ -46,7 +48,7 @@ Run the appropriate project check after an integrated slice. Finish this pass wh
 
 ## 4. Compare, repair, repeat
 
-Open source/local pages at the **same viewport, scroll position, and state**. Let fonts, media, and reveal animations settle. Review the whole page on desktop/mobile; inspect intermediate widths where the layout changes. A side-by-side montage locates drift; full-size sections establish detail.
+Open source/local pages at the **same viewport, scroll position, and state**. Let fonts, media, and reveal animations settle. Review the whole page wherever step 2 found a rule changing, plus a viewport wider than the design; judge scroll and pointer behavior with real input. A side-by-side montage locates drift; full-size sections establish detail.
 
 Fix the largest visible differences first: geometry, missing sections/layers, typography/wrapping, asset crop, then spacing and motion. Recheck affected views. Compare animated regions in initial, active, and settled states, including reverse scroll when relevant.
 
```

**File**: `.agents/skills/clone-website/references/framer-and-motion.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ Rebuild semantic components/data. Deployment scripts and minified wrappers are e
 
 Observe both directions and mobile. A pinned scene needs scroll distance and release behavior, not just sticky positioning. An animated visual may be a video: use actual media when available.
 
-Match measurable easing/duration. Clean up animation loops with component lifecycle. Use native scroll unless source smoothing behavior needs reproduction.
+Match measurable easing/duration. Clean up animation loops with component lifecycle. Framer's smooth scrolling is Lenis: a `lenis` class on `html` or a `window.lenis` global exposes the options to reproduce.
 
 ## Verify the experience
 
```

**File**: `.agents/skills/clone-website/references/inspection-guide.md` (modified, +3/-1)
```diff
@@ -6,7 +6,7 @@ Capture evidence that changes the build: layout, content, assets, and states. On
 
 Record section order, max-width, gutters, column proportions, and sticky/fixed layers. Measure heading/body family, weight, size, line height, and letter spacing. Match the actual font before adjusting widths to repair wrapping.
 
-Inspect desktop/mobile, then narrow around observed layout transitions. Record stacking, navigation/menu changes, type reflow, and different crops/assets. A scaled desktop screenshot is not a mobile reference.
+Sweep width from mobile to beyond the desktop design, narrowing around each transition; max-width caps only show on wider screens. Record stacking, navigation/menu changes, type reflow, and different crops/assets. A scaled desktop screenshot is not a mobile reference.
 
 Capture whole-page evidence after visiting lazy/reveal sections, plus full-size hero and interaction views. Fonts or entry motion can make early screenshots misleading.
 
@@ -30,6 +30,8 @@ Record trigger → visible result. Scroll before clicking so pinned scenes are n
 
 Measure important before/after styles using the browser's supported DOM evaluation. For a selector observed on the page, useful fields are textContent, getBoundingClientRect(), and computed font, letterSpacing, color, background, gap, padding, borderRadius, position, transform, and transition.
 
+Page-wide scripts (smooth scrolling, snapping, cursor followers, page transitions) change every interaction. Identify them from root classes, globals, and loaded scripts, and record their options.
+
 Evaluation environments differ: read-only DOM snapshots may omit APIs such as `document.fonts`. Use asset metadata or developer inspection for missing measurements rather than inferring values from an unsupported API.
 
 ## Handoff and comparison
```

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Changed
+- Generalize cloning guidance: treat each observation as a sample of a rule found by varying width, height, input, and state; use the source's actual files; and build shared components from every observed state.
+
 ## [0.6.0] - 2026-10-05
 
 ### Changed
```

---

### Incident Patch 3: `0fc4dca3` (2026-09-20)
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
+      "integrity": "sha512-hWniXY3bG5qKpkKrAwPe4y+VTPmf086YQAnkxWh7uA1YrlRouWGa0M0Mxj3ZjnXFkv7/TD1bTy9lGUK26vRvWw==",
       "cpu": [
         "x64"
       ],
@@ -1041,20 +1055,20 @@
         "url": "https://opencollective.com/libvips"
       },
       "optionalDependencies": {
-        "@img/sharp-libvips-darwin-x64": "1.3.2"
+        "@img/sharp-libvips-darwin-x64": "1.3.3"
       }
     },
     "node_modules/@img/sharp-freebsd-wasm32": {
-      "version": "0.35.3",
-      "resolved": "https://registry.npmjs.org/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.3.tgz",
-      "integrity": "sha512-lUxcqWIj2wMQ9BrwNjngcr1gWUr5xgaGThBRqPPalIC2n67Cqj1uPh8NnA/ZhAg8hUbKl+kVHKwgUIwe6ZYPrg==",
+      "version": "0.35.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.4.tgz",
+      "integrity": "sha512-lIsKw/BU+kjB4eZjxrYrZmwOJYi3Ajrv66iAlBmUPyKc3HpnloevB1g3wxGD9P/5BbQ1brBGl65VRRrCvQDEqA==",
       "license": "Apache-2.0",
       "optional": true,
       "os": [
         "freebsd"
       ],
       "dependenc
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

### Incident Patch 4: `c09cf67a` (2026-09-17)
**Commit Message**: docs: simplify Quick Start and keep one README (#116)

* docs: simplify Quick Start for agent-led setup

* docs: keep a single English README

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -8,11 +8,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ## [Unreleased]
 
 ### Changed
+- Simplified Quick Start with a copyable agent setup prompt, a template button, and one cloning command example
 - Consolidated Claude Code, Codex, Cursor, and OpenCode support around one canonical Agent Skill in `.agents/skills/clone-website/`
 - Reduced the Claude Code integration to a thin command bridge that forwards arguments to the canonical skill without creating a duplicate skill in other agents
 - Moved the website inspection guide into the canonical skill's on-demand references
 
 ### Removed
+- Japanese and Simplified Chinese READMEs; the English README is the single maintained entry point
+- Redundant workflow diagrams from the READMEs
 - Generated skill and instruction copies for unsupported or redundant agent platforms
 - The agent-rule and skill synchronization scripts and their generated-file CI gate
 
```

**File**: `README.ja.md` (removed, +0/-180)
```diff
@@ -1,180 +0,0 @@
-<div align="center">
-
-# AI ウェブサイトクローンテンプレート
-
-### 1つのコマンドで、あらゆるウェブサイトをクローン
-
-AI コーディングエージェントに URL を渡すだけで、ウェブサイトをクリーンな Next.js アプリとして再現できます。
-
-**最良の結果を得るには [Claude Code](https://docs.anthropic.com/en/docs/claude-code) + Opus 5 を推奨します。Codex、Cursor、OpenCode にも対応しています。**
-
-[![Use this template](https://img.shields.io/badge/Use_this_template-Create_your_copy-2ea44f?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JCodesMore/ai-website-cloner-template/generate) [![Discord](https://img.shields.io/badge/Join_the_community-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/hrTSX5yTpB)
-
-[クイックスタート](#クイックスタート) · [デモを見る](#デモ) · [対応プラットフォーム](#対応プラットフォーム)
-
-<a href="https://github.com/JCodesMore/ai-website-cloner-template/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a> <a href="https://github.com/JCodesMore/ai-website-cloner-template"><img src="https://img.shields.io/github/stars/JCodesMore/ai-website-cloner-template?style=flat" alt="Stars" /></a> <img src="https://img.shields.io/endpoint?url=https://gittokens.rsamf.com/badge/JCodesMore/ai-website-cloner-template" alt="tokens" />
-
-  <a href="https://trendshift.io/repositories/24302?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-24302" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/24302" alt="JCodesMore%2Fai-website-cloner-template | Trendshift" width="250" height="55" /></a> <a href="https://www.star-history.com/jcodesmore/ai-website-cloner-template/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template&amp;theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template" /><img alt="Star History 世界ランキング" src="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template" width="216" height="55" /></picture></a>
-
-</div>
-
----
-
-## デモ
-
-[![デモを見る](docs/design-references/comparison.png)](https://youtu.be/O669pVZ_qr0)
-
-> 上の画像をクリックすると、YouTube でデモ全編を視聴できます。
-
-## クイックスタート
-
-> **重要：** まず GitHub の **Use this template** ボタンを使用して、自分用のコピーを作成してください。ウェブサイトプロジェクトのためにこのテンプレートリポジトリを直接クローンしたり、生成したウェブサイトのプルリクエストをこのリポジトリに作成したりしないでください。
-
-1. **このテンプレートから自分のリポジトリを作成する**
-
-   このプロジェクトの GitHub ページで **Use this template**、続いて **Create a new repository** をクリックします。
-
-   新しいリポジトリに名前を付け、公開または非公開を選択してから **Create repository** をクリックします。GitHub に **Include all branches** オプションが表示された場合は、オフのままでかまいません。
-
-   これにより、独立した自分専用のプロジェクトが作成されるため、ウェブサイトへの変更はメインテンプレートに戻されず、自分のアカウント内に保持されます。
-
-2. **新しいリポジトリを自分のコンピューターで開く**
-
-   GitHub がコピーを作成したら、その新しいリポジトリを開きます。**Code** をクリックし、好みのコーディングツールで新しいリポジトリを開くかクローンします。
-
-   ターミナルを使用する場合、コマンドは次のようになります。
-
-   ```bash
-   git clone https://github.com/YOUR-USERNAME/YOUR-NEW-REPOSITORY.git
-   cd YOUR-NEW-REPOSITORY
-   ```
-
-3. **依存関係をインストールする**
-   ```bash
-   npm install
-   ```
-4. **AI エージェントを起動する** — Claude Code を推奨：
-   ```bash
-   claude --chrome
-   ```
-5. **各エージェントの方法でスキルを実行する**：
-
-   - Claude Code または Cursor：`/clone-website <target-url1> [<target-url2> ...]`
-   - Codex：`$clone-website <target-url1> [<target-url2> ...]`
-   - OpenCode：`clone-website スキルを使って <対象URL> をクローンして`
-
-6. **カスタマイズする**（任意）— 基本のクローンが構築された後、必要に応じて変更します
-
-> ワークフローはテンプレートに含まれています。スキルの追加インストールや同期コマンドは不要です。プロジェクトの指示は `AGENTS.md` にあります。
-
-## 対応プラットフォーム
-
-| エージェント                                                  | 状態                  |
-| ------------------------------------------------------------- | --------------------- |
-| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | **推奨** — Opus 5     |
-| [Codex CLI](https://github.com/openai/codex)                  | 対応                  |
-| [OpenCode](https://opencode.ai/)                              | 対応                  |
-| [Cursor](https://cursor.com/)                                 | 対応                  |
-
-## 前提条件
-
-- [Node.js](https://nodejs.org/) 24 以降
-- AI コーディングエージェント（[対応プラットフォーム](#対応プラットフォーム)を参照）
-
-## 技術スタック
-
-- **Next.js 16** — App Router、React 19、TypeScript strict
-- **shadcn/ui** — Radix プリミティブ + Tailwind CSS v4
-- **Tailwind CSS v4** — oklch デザイントークン
-- **Lucide React** — デフォルトのアイコン（クローン作成時に抽出した SVG に置き換えられます）
-
-## 仕組み
-
-`/clone-website` スキルは、複数フェーズのパイプラインを実行します。
-
-```mermaid
-flowchart LR
-    P1["1. 調査"] --> P2["2. 基盤構築"]
-    P2 --> P3["3. コンポーネント仕様"]
-    P3 --> P4["4. 並列ビルド"]
-    P4 --> P5["5. 統合と QA"]
-```
-
-1. **調査** — スクリーンショット、デザイントークンの抽出、インタラクションの網羅的な確認（スクロール、クリック、ホバー、レスポンシブ）
-2. **基盤構築** — フォント、色、グローバル設定を更新し、すべてのアセットをダウンロード
-3. **コンポーネント仕様** — 正確に算出された CSS 値、状態、動作、コンテンツを含む詳細な仕様ファイルを `docs/research/components/` に作成
-4. **並列ビルド** — セクションまたはコンポーネントごとに 1 つずつ、git worktree 内でビルダーエージェントを実行
-5. **統合と QA** — worktree をマージしてページを接続し、元のサイトとのビジュアル差分を確認
-
-各ビルダーエージェントには、正確な `getComputedStyle()` の値、
```

**File**: `README.md` (modified, +18/-39)
```diff
@@ -28,44 +28,33 @@ Give your AI coding agent a URL and watch it recreate the website as a clean Nex
 
 ## Quick Start
 
-> **Important:** Start by making your own copy with GitHub's **Use this template** button. Do not clone this template repository directly for your website project, and do not open pull requests here with your generated website.
+### 1. Set up your project
 
-1. **Create your own repository from this template**
+**Recommended: ask your agent.** Paste this into Codex, Claude Code, or your coding agent:
 
-   On the GitHub page for this project, click **Use this template**, then click **Create a new repository**.
-
-   Give your new repository a name, choose whether it should be public or private, then click **Create repository**. If GitHub shows an **Include all branches** option, you can leave it off.
-
-   This gives you your own separate project to work in, so your website changes stay in your account instead of coming back to the main template.
-
-2. **Open your new repository on your computer**
+```text
+Set up https://github.com/JCodesMore/ai-website-cloner-template
+as a standalone project in a new folder on my computer.
+Ask me where to put it. Clone the repository, remove its origin remote,
+install dependencies, and run npm run check. Leave it ready for me
+to clone a website.
+```
 
-   After GitHub creates your copy, open that new repository. Click **Code** and open or clone your new repository with your preferred coding tool.
+**Or create your own GitHub repository:**
 
-   If you use the terminal, the command will look like this:
+[![Use this template](https://img.shields.io/badge/Use_this_template-Create_your_copy-2ea44f?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JCodesMore/ai-website-cloner-template/generate)
 
-   ```bash
-   git clone https://github.com/YOUR-USERNAME/YOUR-NEW-REPOSITORY.git
-   cd YOUR-NEW-REPOSITORY
-   ```
+Give it a name and click **Create repository**. Then give your agent the new repository's link and ask it to clone it onto your computer, install dependencies, and run `npm run check`.
 
-3. **Install dependencies**
-   ```bash
-   npm install
-   ```
-4. **Start your AI agent** — Claude Code recommended:
-   ```bash
-   claude --chrome
-   ```
-5. **Run the skill** using your agent's native invocation:
+### 2. Clone a website
 
-   - Claude Code or Cursor: `/clone-website <target-url1> [<target-url2> ...]`
-   - Codex: `$clone-website <target-url1> [<target-url2> ...]`
-   - OpenCode: `Clone <target-url> using the clone-website skill`
+Open the project in your agent with browser access enabled. In Claude Code or Cursor, run:
 
-6. **Customize** (optional) — after the base clone is built, modify as needed
+```text
+/clone-website https://example.com
+```
 
-> The workflow ships with the template. No separate skill installation or synchronization command is required. Project instructions are in `AGENTS.md`.
+Replace the URL with the website you want to recreate. Once it's built, ask your agent for any changes you want.
 
 ## Supported Platforms
 
@@ -92,14 +81,6 @@ Give your AI coding agent a URL and watch it recreate the website as a clean Nex
 
 The `/clone-website` skill runs a multi-phase pipeline:
 
-```mermaid
-flowchart LR
-    P1["1. Reconnaissance"] --> P2["2. Foundation"]
-    P2 --> P3["3. Component Specs"]
-    P3 --> P4["4. Parallel Build"]
-    P4 --> P5["5. Assembly and QA"]
-```
-
 1. **Reconnaissance** — screenshots, design token extraction, interaction sweep (scroll, click, hover, responsive)
 2. **Foundation** — updates fonts, colors, globals, downloads all assets
 3. **Component Specs** — writes detailed spec files (`docs/research/components/`) with exact computed CSS values, states, behaviors, and content
@@ -177,5 +158,3 @@ Edit the canonical skill directly. There are no generated platform copies or syn
 ## License
 
 MIT
-
-<sub>Translations: <a href="README.ja.md">日本語</a> · <a href="README.zh-CN.md">Simplified Chinese</a></sub>
```

**File**: `README.zh-CN.md` (removed, +0/-180)
```diff
@@ -1,180 +0,0 @@
-<div align="center">
-
-# AI Website Cloner Template 中文版
-
-### 一条命令，克隆任意网站
-
-只需给你的 AI 编程代理一个 URL，它就会将该网站重新构建成一个简洁的 Next.js 应用。
-
-**推荐使用 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) + Opus 5 以获得最佳效果，同时支持 Codex、Cursor 和 OpenCode。**
-
-[![Use this template](https://img.shields.io/badge/Use_this_template-Create_your_copy-2ea44f?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JCodesMore/ai-website-cloner-template/generate) [![Discord](https://img.shields.io/badge/Join_the_community-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/hrTSX5yTpB)
-
-[快速开始](#快速开始) · [观看演示](#演示) · [支持的平台](#支持的平台)
-
-<a href="https://github.com/JCodesMore/ai-website-cloner-template/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a> <a href="https://github.com/JCodesMore/ai-website-cloner-template"><img src="https://img.shields.io/github/stars/JCodesMore/ai-website-cloner-template?style=flat" alt="Stars" /></a> <img src="https://img.shields.io/endpoint?url=https://gittokens.rsamf.com/badge/JCodesMore/ai-website-cloner-template" alt="tokens" />
-
-  <a href="https://trendshift.io/repositories/24302?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-24302" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/24302" alt="JCodesMore%2Fai-website-cloner-template | Trendshift" width="250" height="55" /></a> <a href="https://www.star-history.com/jcodesmore/ai-website-cloner-template/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template&amp;theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template" /><img alt="Star History 全球排名" src="https://api.star-history.com/badge?repo=JCodesMore/ai-website-cloner-template" width="216" height="55" /></picture></a>
-
-</div>
-
----
-
-## 演示
-
-[![观看演示](docs/design-references/comparison.png)](https://youtu.be/O669pVZ_qr0)
-
-> 点击上方图片即可在 YouTube 观看完整演示。
-
-## 快速开始
-
-> **重要提示：** 请先使用 GitHub 的 **Use this template** 按钮创建自己的副本。不要直接克隆本模板仓库用于你的实际网站项目，也不要在此提交你生成的网站代码。
-
-1. **从模板创建自己的仓库**
-
-   在本项目的 GitHub 页面点击 **Use this template**，然后点击 **Create a new repository**。
-
-   为新仓库命名，选择公开或私有，再点击 **Create repository**。如果出现 **Include all branches** 选项，可保持关闭。
-
-   这样你就能拥有一个独立的项目空间，你的网站修改会保留在你自己的账号下，而不会回到模板仓库。
-
-2. **在本地打开新仓库**
-
-   GitHub 创建副本后，打开该仓库。点击 **Code**，用你喜欢的工具打开或克隆。
-
-   如果使用终端，命令大致如下：
-
-   ```bash
-   git clone https://github.com/YOUR-USERNAME/YOUR-NEW-REPOSITORY.git
-   cd YOUR-NEW-REPOSITORY
-   ```
-
-3. **安装依赖**
-   ```bash
-   npm install
-   ```
-4. **启动你的 AI 代理** — 推荐使用 Claude Code：
-   ```bash
-   claude --chrome
-   ```
-5. **使用对应代理的原生方式运行技能**：
-
-   - Claude Code 或 Cursor：`/clone-website <目标网址1> [<目标网址2> ...]`
-   - Codex：`$clone-website <目标网址1> [<目标网址2> ...]`
-   - OpenCode：`使用 clone-website 技能克隆 <目标网址>`
-
-6. **按需定制**（可选） — 基础克隆完成后，可进一步修改。
-
-> 工作流已随模板提供，无需单独安装技能或运行同步命令。项目指令位于 `AGENTS.md`。
-
-## 支持的平台
-
-| 代理                                                          | 状态                        |
-| ------------------------------------------------------------- | --------------------------- |
-| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | **推荐** — Opus 5           |
-| [Codex CLI](https://github.com/openai/codex)                  | 已支持                      |
-| [OpenCode](https://opencode.ai/)                              | 已支持                      |
-| [Cursor](https://cursor.com/)                                 | 已支持                      |
-
-## 前置要求
-
-- [Node.js](https://nodejs.org/) 24+
-- 一个 AI 编程代理（见[支持的平台](#支持的平台)）
-
-## 技术栈
-
-- **Next.js 16** — App Router、React 19、TypeScript strict
-- **shadcn/ui** — Radix 基础组件 + Tailwind CSS v4
-- **Tailwind CSS v4** — oklch 设计 token
-- **Lucide React** — 默认图标（克隆过程中会替换为提取的 SVG）
-
-## 工作原理
-
-`/clone-website` 指令会运行一个多阶段流水线：
-
-```mermaid
-flowchart LR
-    P1["1. 侦察"] --> P2["2. 基础搭建"]
-    P2 --> P3["3. 组件规格"]
-    P3 --> P4["4. 并行构建"]
-    P4 --> P5["5. 组装与 QA"]
-```
-
-1. **侦察（Reconnaissance）** — 截图、提取设计 token、扫描交互行为（滚动、点击、悬停、响应式）
-2. **基础搭建（Foundation）** — 更新字体、颜色、全局样式，下载全部资源
-3. **组件规格（Component Specs）** — 编写详细的规格文件（`docs/research/components/`），包含精确的计算 CSS 值、状态、行为和内容
-4. **并行构建（Parallel Build）** — 在 git worktree 中分派构建器代理，每个代理负责一个区块或组件
-5. **组装与 QA（Assembly & QA）** — 合并 worktree、拼接页面、与原站进行视觉对比
-
-每个构建器代理都会收到完整的组件规格内联说明 —— 精确的 `getComputedStyle()` 值、交互模型、多状态内容、响应式断点、资源路径，无需猜测。
-
-## 使用场景
-
-- **平台迁移** — 将你自己拥有的 WordPress / Webflow / Squarespace 站点重建为现代 Next.js 代码库
-- **源码丢失** — 站点仍在线上，但仓库丢失、开发者离职或技术栈过时，用现代格式把代码拿回来
-- **学习研究** — 通过真实代码拆解生产站点如何实现特定布局、动画和响应式行为
-
-## 不适用于
-
-- **钓鱼或冒充** — 本项目严禁用于欺骗、冒充或任何违法活动。
-- **将他人设计据为己有** — 徽标、品牌资产和原始文案均归其所有者所有。
-- **违反服务条款** — 部分站点明确禁止抓取或复制，请先确认相关规定。
-
-## 项目结构
-
-```
-src/
-  app/              # Next.js 路
```

---

### Incident Patch 5: `61b363a1` (2026-08-10)
**Commit Message**: fix: preserve pages across clone runs

**File**: `.amazonq/cli-agents/clone-website.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "clone-website",
-  "description": "Reverse-engineer and clone any website as a pixel-perfect replica",
-  "prompt": "\n# Clone Website\n\nYou are about to reverse-engineer and rebuild **the target URL provided by the user** as pixel-perfect clones.\n\nWhen multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).\n\nThis is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.\n\n## Scope Defaults\n\nThe target is whatever page `the target URL provided by the user` resolves to. Clone exactly what's visible at that URL. Unless the user specifies otherwise, use these defaults:\n\n- **Fidelity level:** Pixel-perfect — exact match in colors, spacing, typography, animations\n- **In scope:** Visual layout and styling, component structure and interactions, responsive design, mock data for demo purposes\n- **Out of scope:** Real backend / database, authentication, real-time features, SEO optimization, accessibility audit\n- **Customization:** None — pure emulation\n\nIf the user provides additional instructions (specific fidelity level, customizations, extra context), honor those over the defaults.\n\n## Pre-Flight\n\n1. **Browser automation is required.** Check for available browser MCP tools (Chrome MCP, Playwright MCP, Browserbase MCP, Puppeteer MCP, etc.). Use whichever is available — if multiple exist, prefer Chrome MCP. If none are detected, ask the user which browser tool they have and how to connect it. This skill cannot work without browser automation.\n2. Parse `the target URL provided by the user` as one or more URLs. Normalize and validate each URL; if any are invalid, ask the user to correct them before proceeding. For each valid URL, verify it is accessible via your browser MCP tool.\n3. Verify the base project builds: `npm run build`. The Next.js + shadcn/ui + Tailwind v4 scaffold should already be in place. If not, tell the user to set it up first.\n4. Create the output directories if they don't exist: `docs/research/`, `docs/research/components/`, `docs/design-references/`, `scripts/`. For multiple clones, also prepare per-site folders like `docs/research/<hostname>/` and `docs/design-references/<hostname>/`.\n5. When working with multiple sites in one command, optionally confirm whether to run them in parallel (recommended, if resources allow) or sequentially to avoid overload.\n\n## Guiding Principles\n\nThese are the truths that separate a successful clone from a \"close enough\" mess. Internalize them — they should inform every decision you make.\n\n### 1. Completeness Beats Speed\n\nEvery builder agent must receive **everything** it needs to do its job perfectly: screenshot, exact CSS values, downloaded assets with local paths, real text content, component structure. If a builder has to guess anything — a color, a font size, a padding value — you have failed at extraction. Take the extra minute to extract one more property rather than shipping an incomplete brief.\n\n### 2. Small Tasks, Perfect Results\n\nWhen an agent gets \"build the entire features section,\" it glosses over details — it approximates spacing, guesses font sizes, and produces something \"close enough\" but clearly wrong. When it gets a single focused component with exact CSS values, it nails it every time.\n\nLook at each section and judge its complexity. A simple banner with a heading and a button? One agent. A complex section with 3 different card variants, each with unique hover states and internal layouts? One agent per card variant plus one for the section wrapper. When in doubt, make it smaller.\n\n**Complexity budget rule:** If a builder prompt exceeds ~150 lines of spec content, the section is too complex for one agent. Break it into smaller pieces. This is a mechanical check — don't override it with \"but it's all related.\"\n\n### 3. Real Content, Real Assets\n\nExtract the actual text, images, videos, and SVGs from the live site. This is a clone, not a mockup. Use `element.textContent`, download every `<img>` and `<video>`, extract inline `<svg>` elements as React components. The only time you generate content is when something is clearly server-generated and unique per session.\n\n**Layered assets matter.** A section that looks like one image is often multiple layers — a background watercolor/gradient, a foreground UI mockup PNG, an overlay icon. Inspect each container's full DOM tree and enumerate ALL `<img>` elements and background images within it, including absolutely-positioned overlays. Missing an overlay image makes the cl
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
+- For multiple URLs from the same origin, or any later clone added to a project that already contains cloned/user-authored pages, preserve the normalized source pathname as its App Router URL (for example, `/docs/intro` becomes `<app-root>/src/app/docs/intro/page.tsx`). Encode filesystem segment names that would invoke App Router syntax: escape a leading `_` or `@`, and literal parentheses or square brackets, with percent-encoded folder spellings rather than creating private folders, slots, route groups, or dynamic segments. Verify the built route resolves at the exact normalized URL before completion.
+- Inspect every existing `src/app/**/page.tsx` before writing. Never delete or replace a non-scaffold route, component tree, research folder, screenshot, or asset namespace unless the user explicitly approves that exact replacement.
+- If the planned route already exists, stop and ask whether to update that route, choose another route, or skip it.
+- URLs from different origins may require incompatible fonts, global CSS, layouts, and metadata. Before modifying files, ask whether the user wants separate prepared application roots (recommended) or an intentionally combined multi-site app with route-scoped styling. Do not create an 
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
+- Inspect every existing `src/app/**/page.tsx` before writing. Never delete or replace a non-scaffold route, component tree, research folder, screenshot, or asset namespace unless the user explicitly approves that exact replacement.
+- If the planned route already exists, stop and ask whether to update that route, choose another route, or skip it.
+- URLs from different origins may require incompatible fonts, global CSS, layouts, and metadata. Before modifying files, ask whether the user wants separate prepared application roots (recommended) or an intentionally combined multi-site app with route-scoped styling. Do not create an unapproved monorepo or silently mix global foundations.
+
 ## Pre-Flight
 
 1. **Browser automation is required.** Check for available browser MCP tools (Chrome MCP, Playwright MCP, Browserbase MCP, Puppeteer MCP, etc.). Use whichever is available — if multiple exist, prefer Chrome MCP. If none are detected, ask the user which browser tool they have and how to connect it. This skill cannot work without browse
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
+All paths in the remaining phases are relative to that target's `<app-root>`. Before writing, verify that every planned route, artifact root, screenshot root, component root, asset root, and downloader filename is unique or is an explicitly approved shared location.
+
+Routing defaults:
+
+- For the first single-URL clone in an untouched template, the existing scaffold at `src/app/page.tsx` may be replaced so the clone remains available at `/`.
+- For multiple URLs from the same origin, or any later clone added to a project that already contains cloned/user-authored pages, preserve the normalized source pathname as its App Router URL (for example, `/docs/intro` becomes `<app-root>/src/app/docs/intro/page.tsx`). Encode filesystem segment names that would invoke App Router syntax: escape a leading `_` or `@`, and literal parentheses or square brackets, with percent-encoded folder spellings rather than creating private folders, slots, route groups, or dynamic segments. Verify the built route resolves at the exact normalized URL before completion.
+- Inspect every existing `src/app/**/page.tsx` before writing. Never delete or replace a 
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
+- Inspect every existing `src/app/**/page.tsx` before writing. Never delete or replace a non-scaffold route, component tree, research folder, screenshot, or asset namespace unless the user explicitly approves that exact replacement.
+- If the planned route already exists, stop and ask whether to update that route, choose another route, or skip it.
+- URLs from different origins may require incompatible fonts, global CSS, layouts, and metadata. Before modifying files, ask whether the user wants separate prepared application roots (recommended) or an intentionally combined multi-site app with route-scoped styling. Do not create an unapproved monorepo or silently mix global foundations.
+
 ## Pre-Flight
 
 1. **Browser automation is required.** Check for available browser MCP tools (Chrome MCP, Playwright MCP, Browserbase MCP, Puppeteer MCP, etc.). Use whichever is available — if multiple exist, prefer Chrome MCP. If none are detected, ask the user which browser tool they have and how to connect it. This skill cannot work without browse
```

**File**: `.continue/commands/clone-website.md` (modified, +68/-35)
```diff
@@ -1,6 +1,6 @@
 ---
 name: clone-website
-description: "Reverse-engineer and clone any website as a pixel-perfect replica"
+description: "Reverse-engineer and clone one or more websites as pixel-perfect replicas"
 invokable: true
 ---
 <!-- AUTO-GENERATED from .claude/skills/clone-website/SKILL.md — do not edit directly.
@@ -11,7 +11,7 @@ invokable: true
 
 You are about to reverse-engineer and rebuild **$ARGUMENTS** as pixel-perfect clones.
 
-When multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).
+When multiple URLs are provided, preserve every pathname as a distinct route and isolate each target's research, screenshots, components, and assets. URLs that differ only by query string or fragment share a pathname, so resolve their route and state behavior explicitly in the output plan. Parallelize page work only after the shared foundation and output plan are fixed so concurrent builders cannot overwrite one another.
 
 This is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.
 
@@ -26,13 +26,41 @@ The target is whatever page `$ARGUMENTS` resolves to. Clone exactly what's visib
 
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
+- Inspect every existing `src/app/**/page.tsx` before writing. Never delete or replace a non-scaffold route, component tree, research folder, screenshot, or asset namespace unless the user explicitly approves that exact replacement.
+- If the planned route already exists, stop and ask whether to update that route, choose another route, or skip it.
+- URLs from different origins may require incompatible fonts, global CSS, layouts, and metadata. Before modifying files, ask whether the user wants separate prepared application roots (recommended) or an intentionally combined multi-site app with route-scoped styling. Do not create an unapproved monorepo or silently mix global foundations.
+
 ## Pre-Flight
 
 1. **Browser au
```

**File**: `.cursor/commands/clone-website.md` (modified, +70/-37)
```diff
@@ -4,15 +4,15 @@
 
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
@@ -21,13 +21,41 @@ The target is whatever page `the target URL provided by the user` resolves to. C
 
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
+- Inspect every existing `src/app/**/page.tsx` before writing. Never delete or replace a non-scaffold route, component tree, research folder, screenshot, or asset namespace unless the user explicitly approves that exact replacement.
+- If the planned route already exists, stop and ask whethe
```

**File**: `.gemini/commands/clone-website.toml` (modified, +68/-35)
```diff
@@ -1,7 +1,7 @@
 # AUTO-GENERATED from .claude/skills/clone-website/SKILL.md
 # Run `node scripts/sync-skills.mjs` to regenerate.
 
-description = "Reverse-engineer and clone any website as a pixel-perfect replica"
+description = "Reverse-engineer and clone one or more websites as pixel-perfect replicas"
 name = "clone-website"
 
 prompt = '''
@@ -10,7 +10,7 @@ prompt = '''
 
 You are about to reverse-engineer and rebuild **{{args}}** as pixel-perfect clones.
 
-When multiple URLs are provided, process them independently and in parallel where possible, while keeping each site's extraction artifacts isolated in dedicated folders (for example, `docs/research/<hostname>/`).
+When multiple URLs are provided, preserve every pathname as a distinct route and isolate each target's research, screenshots, components, and assets. URLs that differ only by query string or fragment share a pathname, so resolve their route and state behavior explicitly in the output plan. Parallelize page work only after the shared foundation and output plan are fixed so concurrent builders cannot overwrite one another.
 
 This is not a two-phase process (inspect then build). You are a **foreman walking the job site** — as you inspect each section of the page, you write a detailed specification to a file, then hand that file to a specialist builder agent with everything they need. Extraction and construction happen in parallel, but extraction is meticulous and produces auditable artifacts.
 
@@ -25,13 +25,41 @@ The target is whatever page `{{args}}` resolves to. Clone exactly what's visible
 
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
+- Inspect every existing `src/app/**/page.tsx` before writing. Never delete or replace a non-scaffold route, component tree, research folder, screenshot, or asset namespace unless the user explicitly approves that exact replacement.
+- If the planned route already exists, stop and ask whether to update that route, choose another route, or skip it.
+- URLs from different origins may require incompatible fonts, global CSS, layouts, and metadata. Before modifying files, ask whether the user wants separate prepared application roots (recommended) or an intentionally combined multi-site app with route-scoped styling. Do not create an unapproved monorepo or silently mix global foundations.
+
 ## Pre-Flight
 
```

---

### Incident Patch 6: `1726b55f` (2026-08-10)
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
+Look at each section and judge its complexity. A simple banner with a heading and a button? One agent. A complex section with 3 different card variants, each with unique hover states and internal layouts? One agent per card variant plus one for the section wrapper. When in doubt, make it smaller.
+
+**Complexity budget rule:** If a builder prompt exceeds ~150 lines of spec content, the section is too complex for one agent. Break it into smaller pieces. This is a mechanical check — don't override it with "but it's all related."
+
+### 3. Real Content, Real Assets
+
+Extract the actual text, images, videos, and SVGs from the live site. This is a clone, not a mockup. Use `element.textContent`, download every `<img>` and `<video>`, extract inline `<svg>` elements as React components. The only time you generate content is when something is clearly server-generated and unique per session.
+
+**Layered assets matter.** A section that looks like one image is often multiple layers — a background watercolor/gradient, a foreground UI mockup PNG, an overlay icon. Inspect each container's full DOM tree and enumerate ALL `<img>` elements and background images within it, including absolutely-positioned overlays. Missing an overlay image makes the clone look empty even if t
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
+Look at each section and judge its complexity. A simple banner with a heading and a button? One agent. A complex section with 3 different card variants, each with unique hover states and internal layouts? One agent per card variant plus one for the section wrapper. When in doubt, make it smaller.
+
+**Complexity budget rule:** If a builder prompt exceeds ~150 lines of spec content, the section is too complex for one agent. Break it into smaller pieces. This is a mechanical check — don't override it with "but it's all related."
+
+### 3. Real Content, Real Assets
+
+Extract the actual text, images, videos, and SVGs from the live site. This is a clone, not a mockup. Use `element.textContent`, download every `<img>` and `<video>`, extract inline `<svg>` elements as React components. The only time you generate content is when something is clearly server-generated and unique per session.
+
+**Layered assets matter.** A section that looks like one image is often multiple layers — a background watercolor/gradient, a foreground UI mockup PNG, an overlay icon. Inspect each container's full DOM tree and enumerate ALL `<img>` elements and background images within it, including absolutely-positioned overlays. Missing an overlay image makes the clone look empty even if t
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

**File**: `README.zh-CN.md` (modified, +4/-2)
```diff
@@ -69,7 +69,7 @@
    ```
 6. **按需定制**（可选） — 基础克隆完成后，可进一步修改。
 
-> 使用其他 AI 代理？打开 `AGENTS.md` 查看项目指令 — 大多数代理会自动读取。
+> 大多数受支持的客户端都可以直接调用 `/clone-website`。如果你的客户端通过自然语言请求激活技能，请输入 `使用 clone-website 工作流克隆 <目标网址>`。项目指令位于 `AGENTS.md`。
 
 ## 支持的平台
 
@@ -88,7 +88,6 @@
 | [Continue](https://continue.dev/)                             | 已支持                      |
 | [Amazon Q](https://aws.amazon.com/q/developer/)               | 已支持                      |
 | [Augment Code](https://www.augmentcode.com/)                  | 已支持                      |
-| [Aider](https://aider.chat/)                                  | 已支持                      |
 
 ## 前置要求
 
@@ -156,6 +155,9 @@ scripts/
   sync-agent-rules.sh  # 重新生成各代理指令文件
   sync-skills.mjs      # 为所有平台重新生成 /clone-website 指令
 .kiro/skills/          # 生成的 Kiro 工作区技能
+.cline/skills/         # 生成的 Cline 工作区技能
+.roo/skills/           # 生成的 Roo Code 工作区技能
+.roo/commands/         # 生成的 Roo Code 斜杠命令
 AGENTS.md           # 代理指令（单一事实来源）
 CLAUDE.md           # Claude Code 配置（引用 AGENTS.md）
 GEMINI.md           # Gemini CLI 配置（引用 AGENTS.md）
```

**File**: `scripts/sync-skills.mjs` (modified, +24/-8)
```diff
@@ -48,6 +48,9 @@ const HEADER =
 
 const noArgs = (text) => text.replace(/\$ARGUMENTS/g, 'the target URL provided by the user');
 
+const agentSkill = (text) =>
+  `---\nname: clone-website\ndescription: "${shortDesc}"\n---\n${noArgs(text)}`;
+
 // --- Generate ---
 
 console.log('Syncing clone-website skill to all platforms...');
@@ -62,13 +65,26 @@ write('.github/skills/clone-website/SKILL.md', raw);
 // 3. Kiro — same SKILL.md format and $ARGUMENTS syntax
 write('.kiro/skills/clone-website/SKILL.md', raw);
 
-// 4. Cursor — plain markdown, no argument substitution support
+// 4. Cline — Agent Skills format without Claude-only frontmatter/placeholders
+write('.cline/skills/clone-website/SKILL.md', agentSkill(body));
+
+// 5. Roo Code — standards-compliant Agent Skill plus a slash-command entry point
+write('.roo/skills/clone-website/SKILL.md', agentSkill(body));
+write(
+  '.roo/commands/clone-website.md',
+  `---\ndescription: "${shortDesc}"\nargument-hint: "<url1> [<url2> ...]"\n---\n` +
+    HEADER +
+    'Use the `clone-website` skill for the target URL or URLs provided by the user. ' +
+    'Load that skill and follow its workflow exactly.\n'
+);
+
+// 6. Cursor — plain markdown, no argument substitution support
 write('.cursor/commands/clone-website.md', HEADER + noArgs(body));
 
-// 5. Windsurf — markdown workflow
+// 7. Windsurf — markdown workflow
 write('.windsurf/workflows/clone-website.md', HEADER + noArgs(body));
 
-// 6. Gemini CLI — TOML format, {{args}} for arguments
+// 8. Gemini CLI — TOML format, {{args}} for arguments
 const geminiBody = body.replace(/\$ARGUMENTS/g, '{{args}}');
 write(
   '.gemini/commands/clone-website.toml',
@@ -79,25 +95,25 @@ write(
     `prompt = '''\n${geminiBody}\n'''\n`
 );
 
-// 7. OpenCode — markdown + YAML frontmatter, $ARGUMENTS works natively
+// 9. OpenCode — markdown + YAML frontmatter, $ARGUMENTS works natively
 write(
   '.opencode/commands/clone-website.md',
   `---\ndescription: "${shortDesc}"\n---\n${HEADER}${body}`
 );
 
-// 8. Augment Code — markdown + YAML frontmatter
+// 10. Augment Code — markdown + YAML frontmatter
 write(
   '.augment/commands/clone-website.md',
   `---\ndescription: "${shortDesc}"\nargument-hint: "<url>"\n---\n${HEADER}${body}`
 );
 
-// 9. Continue — prompt file with invokable: true
+// 11. Continue — prompt file with invokable: true
 write(
   '.continue/commands/clone-website.md',
   `---\nname: clone-website\ndescription: "${shortDesc}"\ninvokable: true\n---\n${HEADER}${body}`
 );
 
-// 10. Amazon Q — JSON agent definition
+// 12. Amazon Q — JSON agent definition
 write(
   '.amazonq/cli-agents/clone-website.json',
   JSON.stringify(
@@ -112,4 +128,4 @@ write(
   ) + '\n'
 );
 
-console.log('\nDone! 10 platform command files generated from source skill.');
+console.log('\nDone! 13 platform command/skill files generated from source skill.');
```

---

### Incident Patch 7: `78db3b99` (2026-08-10)
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

### Incident Patch 8: `f0de14d2` (2026-08-10)
**Commit Message**: docs: refine contribution guidance

**File**: `CONTRIBUTING.md` (modified, +6/-6)
```diff
@@ -11,7 +11,7 @@ Thanks for your interest in improving the **AI Website Cloner Template**! This g
 - **Fix bugs** in the Next.js scaffold or the sync scripts
 - **Improve documentation** — the README, `AGENTS.md`, or the inspection guides under `docs/research/`
 
-Browse the [open issues](https://github.com/JCodesMore/ai-website-cloner-template/issues) for something to pick up. For larger changes, open an issue first so we can align on the approach before you build.
+Browse the [open issues](https://github.com/JCodesMore/ai-website-cloner-template/issues) for something to pick up. For substantial or potentially breaking changes, consider opening an issue first so we can align on the approach before significant work begins.
 
 ## Development setup
 
@@ -20,7 +20,7 @@ Browse the [open issues](https://github.com/JCodesMore/ai-website-cloner-templat
 ```bash
 git clone https://github.com/YOUR-USERNAME/ai-website-cloner-template.git
 cd ai-website-cloner-template
-npm install
+npm ci
 ```
 
 Before opening a PR, make sure the project is green:
@@ -31,22 +31,22 @@ npm run check   # lint + typecheck + build
 
 ## Source-of-truth files & the sync scripts
 
-This is the most important thing to know. Two files power *all* platform support, and their platform-specific copies are **generated** — never edit a generated file directly.
+This is the most important thing to know. Two source files generate the platform-specific project instructions and `/clone-website` skill copies. Edit the source files rather than their generated copies.
 
 | What                   | Edit this (source of truth)             | Then run                           |
 | ---------------------- | --------------------------------------- | ---------------------------------- |
 | Project instructions   | `AGENTS.md`                             | `bash scripts/sync-agent-rules.sh` |
 | `/clone-website` skill | `.claude/skills/clone-website/SKILL.md` | `node scripts/sync-skills.mjs`     |
 
-After editing a source file, run the matching sync command and commit the regenerated files along with your change. CI verifies that the generated files are in sync — if you forget to regenerate, the build will fail with a reminder.
+After editing a source file, run the matching sync command and commit the regenerated files along with your change. CI verifies that the generated files are in sync — if you forget to regenerate, CI will fail with a reminder.
 
 ## Submitting a pull request
 
 1. **Fork** the repo and create a branch off `master` (e.g. `fix/skill-hover-extraction` or `docs/clarify-setup`).
 2. Make your change. If you touched a source-of-truth file, **run the relevant sync script** (see above).
 3. Run `npm run check` and make sure it passes.
-4. Write a clear commit message. This repo uses [Conventional Commits](https://www.conventionalcommits.org/) — e.g. `fix:`, `feat:`, `docs:`, `chore:`, `ci:`.
-5. Open a PR against `master`, fill out the PR template, and link the issue it addresses (`Closes #123`).
+4. Write a clear commit message that describes the change. Prefixes such as `fix:`, `feat:`, or `docs:` are welcome but not required.
+5. Open a PR against `master`, fill out the PR template, and link a relevant issue when one exists (for example, `Closes #123`).
 6. Keep PRs focused — one logical change per PR is much easier to review and merge.
 
 ## Questions
```

---

### Incident Patch 9: `73de2589` (2026-06-24)
**Commit Message**: docs: add a CONTRIBUTING guide

There's no contributor guide yet, so a couple of repo-specific things are
easy to miss: this is a template (so generated websites shouldn't be PR'd
here), and AGENTS.md / the clone-website SKILL.md are the source of truth -
their platform copies are generated and need to be regenerated with the
sync scripts.

Adds a short CONTRIBUTING.md covering ways to help, dev setup, the sync
workflow, and PR conventions. Nothing new invented - it just writes down
what's already in the README and AGENTS.md.

**File**: `CONTRIBUTING.md` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+# Contributing
+
+Thanks for your interest in improving the **AI Website Cloner Template**! This guide covers how to contribute to the template itself.
+
+> **Note:** This repository is a *template*. If you just want to clone a website, don't open a PR here — click **Use this template** to make your own copy and work there (see the [README](README.md#quick-start)). Pull requests should improve the template: the `/clone-website` skill, agent platform support, the scaffold, or the docs.
+
+## Ways to contribute
+
+- **Improve the `/clone-website` skill** — sharper extraction, better prompts, new behaviors to detect
+- **Add or fix agent platform support** — new coding agents, or fixes to existing generated configs
+- **Fix bugs** in the Next.js scaffold or the sync scripts
+- **Improve documentation** — the README, `AGENTS.md`, or the inspection guides under `docs/research/`
+
+Browse the [open issues](https://github.com/JCodesMore/ai-website-cloner-template/issues) for something to pick up. For larger changes, open an issue first so we can align on the approach before you build.
+
+## Development setup
+
+**Prerequisites:** [Node.js](https://nodejs.org/) 24+.
+
+```bash
+git clone https://github.com/YOUR-USERNAME/ai-website-cloner-template.git
+cd ai-website-cloner-template
+npm install
+```
+
+Before opening a PR, make sure the project is green:
+
+```bash
+npm run check   # lint + typecheck + build
+```
+
+## Source-of-truth files & the sync scripts
+
+This is the most important thing to know. Two files power *all* platform support, and their platform-specific copies are **generated** — never edit a generated file directly.
+
+| What                   | Edit this (source of truth)             | Then run                           |
+| ---------------------- | --------------------------------------- | ---------------------------------- |
+| Project instructions   | `AGENTS.md`                             | `bash scripts/sync-agent-rules.sh` |
+| `/clone-website` skill | `.claude/skills/clone-website/SKILL.md` | `node scripts/sync-skills.mjs`     |
+
+After editing a source file, run the matching sync command and commit the regenerated files along with your change. CI verifies that the generated files are in sync — if you forget to regenerate, the build will fail with a reminder.
+
+## Submitting a pull request
+
+1. **Fork** the repo and create a branch off `master` (e.g. `fix/skill-hover-extraction` or `docs/clarify-setup`).
+2. Make your change. If you touched a source-of-truth file, **run the relevant sync script** (see above).
+3. Run `npm run check` and make sure it passes.
+4. Write a clear commit message. This repo uses [Conventional Commits](https://www.conventionalcommits.org/) — e.g. `fix:`, `feat:`, `docs:`, `chore:`, `ci:`.
+5. Open a PR against `master`, fill out the PR template, and link the issue it addresses (`Closes #123`).
+6. Keep PRs focused — one logical change per PR is much easier to review and merge.
+
+## Questions
+
+Ask in the [Discord community](https://discord.gg/hrTSX5yTpB) — happy to help you get started.
```

---

### Incident Patch 10: `8d5575ea` (2026-08-08)
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

**File**: `package-lock.json` (modified, +547/-368)
```diff
@@ -13,7 +13,7 @@
         "class-variance-authority": "^0.7.1",
         "clsx": "^2.1.1",
         "lucide-react": "^1.6.0",
-        "next": "16.2.1",
+        "next": "16.3.0",
         "react": "19.2.4",
         "react-dom": "19.2.4",
         "shadcn": "^4.1.0",
@@ -26,7 +26,7 @@
         "@types/react": "^19",
         "@types/react-dom": "^19",
         "eslint": "^9",
-        "eslint-config-next": "16.2.1",
+        "eslint-config-next": "16.3.0",
         "tailwindcss": "^4",
         "typescript": "^5"
       },
@@ -48,12 +48,12 @@
       }
     },
     "node_modules/@babel/code-frame": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.0.tgz",
-      "integrity": "sha512-9NhCeYjq9+3uxgdtp20LSiJXJvN0FeCtNGpJxuMFZ1Kv3cWUNb6DOhJwUvcVCzKGR66cw4njwM6hrJLqgOwbcw==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
+      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
       "license": "MIT",
       "dependencies": {
-        "@babel/helper-validator-identifier": "^7.28.5",
+        "@babel/helper-validator-identifier": "^7.29.7",
         "js-tokens": "^4.0.0",
         "picocolors": "^1.1.1"
       },
@@ -62,29 +62,29 @@
       }
     },
     "node_modules/@babel/compat-data": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.0.tgz",
-      "integrity": "sha512-T1NCJqT/j9+cn8fvkt7jtwbLBfLC/1y1c7NtCeXFRgzGTsafi68MRv8yzkYSapBnFA6L3U2VSc02ciDzoAJhJg==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
+      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/core": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.0.tgz",
-      "integrity": "sha512-CGOfOJqWjg2qW/Mb6zNsDm+u5vFQ8DxXfbM09z69p5Z6+mE1ikP2jUXw+j42Pf1XTYED2Rni5f95npYeuwMDQA==",
-      "license": "MIT",
-      "dependencies": {
-        "@babel/code-frame": "^7.29.0",
-        "@babel/generator": "^7.29.0",
-        "@babel/helper-compilation-targets": "^7.28.6",
-        "@babel/helper-module-transforms": "^7.28.6",
-        "@babel/helpers": "^7.28.6",
-        "@babel/parser": "^7.29.0",
-        "@babel/template": "^7.28.6",
-        "@babel/traverse": "^7.29.0",
-        "@babel/types": "^7.29.0",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.7.tgz",
+      "integrity": "sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/code-frame": "^7.29.7",
+        "@babel/generator": "^7.29.7",
+        "@babel/helper-compilation-targets": "^7.29.7",
+        "@babel/helper-module-transforms": "^7.29.7",
+        "@babel/helpers": "^7.29.7",
+        "@babel/parser": "^7.29.7",
+        "@babel/template": "^7.29.7",
+        "@babel/traverse": "^7.29.7",
+        "@babel/types": "^7.29.7",
         "@jridgewell/remapping": "^2.3.5",
         "convert-source-map": "^2.0.0",
         "debug": "^4.1.0",
@@ -101,13 +101,13 @@
       }
     },
     "node_modules/@babel/generator": {
-      "version": "7.29.1",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.1.tgz",
-      "integrity": "sha512-qsaF+9Qcm2Qv8SRIMMscAvG4O3lJ0F1GuMo5HR/Bp02LopNgnZBC/EkbevHFeGs4ls/oPz9v+Bsmzbkbe+0dUw==",
+      "version": "7.29.8",
+      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.8.tgz",
+      "integrity": "sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==",
       "license": "MIT",
       "dependencies": {
-        "@babel/parser": "^7.29.0",
-        "@babel/types": "^7.29.0",
+        "@babel/parser": "^7.29.8",
+        "@babel/types": "^7.29.8",
         "@jridgewell/gen-mapping": "^0.3.12",
         "@jridgewell/trace-mapping": "^0.3.28",
         "jsesc": "^3.0.2"
@@ -129,13 +129,13 @@
       }
     },
     "node_modules/@babel/helper-compilation-targets": {
-      "version": "7.28.6",
-      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.28.6.tgz",
-      "integrity": "sha512-JYtls3hqi15fcx5GaSNL7SCTJ2MNmjrkHXg4FSpOA/grxK8KwyZ5bubHsCq8FXCkua6xhuaaBit+3b7+VZRfcA==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.29.7.tgz",
+      "integrity": "sha512-wem6WaBj4NaVYVdNhLPPVacES6ZJ+KBBfSkTMD3YZxbP3rm3Di85tJU5ljaUNhaOynt+Aj0xruhYuzQBt8n71g==",
       "license": "MIT",
       "dependencies": {
-      
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -39,7 +39,7 @@
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
     "lucide-react": "^1.6.0",
-    "next": "16.2.1",
+    "next": "16.3.0",
     "react": "19.2.4",
     "react-dom": "19.2.4",
     "shadcn": "^4.1.0",
@@ -52,7 +52,7 @@
     "@types/react": "^19",
     "@types/react-dom": "^19",
     "eslint": "^9",
-    "eslint-config-next": "16.2.1",
+    "eslint-config-next": "16.3.0",
     "tailwindcss": "^4",
     "typescript": "^5"
   }
```

---

### Incident Patch 11: `2b4584d1` (2026-06-01)
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

### Incident Patch 12: `16ca6653` (2026-03-30)
**Commit Message**: add Docker support with multi-stage production builds and development configuration

Maintainer follow-up aligned the Docker defaults with the repo baseline and fixed the Compose usage details.

Co-Authored-By: Avisek <[REDACTED_EMAIL]>
Co-Authored-By: Oz <[REDACTED_EMAIL]>

**File**: `.dockerignore` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# Dependencies (reinstalled inside Docker)
+node_modules
+pnpm-debug.log*
+npm-debug.log*
+yarn-debug.log*
+
+# Build output
+.next
+out
+build
+dist
+
+# Git
+.git
+.gitignore
+
+# Environment files (pass via docker-compose env_file or runtime env vars)
+.env
+.env.local
+.env.*.local
+
+# Editor / OS
+.vscode
+.idea
+.DS_Store
+Thumbs.db
+*.swp
+*.swo
+
+# Agent / AI tool configs (not needed at runtime)
+.claude
+.codex
+.cursor
+.windsurf
+.gemini
+.continue
+.amazonq
+.augment
+.opencode
+.aider.conf.yml
+.clinerules
+.windsurfrules
+AGENTS.md
+CLAUDE.md
+GEMINI.md
+
+# Docs / research (large, not needed at runtime)
+docs
+scripts
+
+# Docker files themselves (no need to copy into image)
+Dockerfile
+docker-compose.yml
+.dockerignore
+
+# Misc
+*.tsbuildinfo
+README.md
+CHANGELOG.md
+LICENSE
```

**File**: `Dockerfile` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+# SRC https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
+
+# ============================================
+# Stage 1: Dependencies Installation Stage
+# ============================================
+
+# IMPORTANT: Node.js Version Maintenance
+# This Dockerfile defaults to Node.js 20.20.2-slim to match the repo's Node 20 baseline used in CI and local development.
+# To ensure security and compatibility, update the NODE_VERSION ARG when the project's Node baseline changes.
+ARG NODE_VERSION=20.20.2-slim
+
+FROM node:${NODE_VERSION} AS dependencies
+
+# Set working directory
+WORKDIR /app
+
+# Copy package-related files first to leverage Docker's caching mechanism
+COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
+
+# Install project dependencies with frozen lockfile for reproducible builds
+RUN --mount=type=cache,target=/root/.npm \
+  --mount=type=cache,target=/usr/local/share/.cache/yarn \
+  --mount=type=cache,target=/root/.local/share/pnpm/store \
+  if [ -f package-lock.json ]; then \
+  npm ci --no-audit --no-fund; \
+  elif [ -f yarn.lock ]; then \
+  corepack enable yarn && yarn install --frozen-lockfile --production=false; \
+  elif [ -f pnpm-lock.yaml ]; then \
+  corepack enable pnpm && pnpm install --frozen-lockfile; \
+  else \
+  echo "No lockfile found." && exit 1; \
+  fi
+
+# ============================================
+# Stage 2: Build Next.js application in standalone mode
+# ============================================
+
+FROM node:${NODE_VERSION} AS builder
+
+# Set working directory
+WORKDIR /app
+
+# Copy project dependencies from dependencies stage
+COPY --from=dependencies /app/node_modules ./node_modules
+
+# Copy application source code
+COPY . .
+
+ENV NODE_ENV=production
+
+# Next.js collects completely anonymous telemetry data about general usage.
+# Learn more here: https://nextjs.org/telemetry
+# Uncomment the following line in case you want to disable telemetry during the build.
+# ENV NEXT_TELEMETRY_DISABLED=1
+
+# Build Next.js application
+# If you want to speed up Docker rebuilds, you can cache the build artifacts
+# by adding: --mount=type=cache,target=/app/.next/cache
+# This caches the .next/cache directory across builds, but it also prevents
+# .next/cache/fetch-cache from being included in the final image, meaning
+# cached fetch responses from the build won't be available at runtime.
+RUN if [ -f package-lock.json ]; then \
+  npm run build; \
+  elif [ -f yarn.lock ]; then \
+  corepack enable yarn && yarn build; \
+  elif [ -f pnpm-lock.yaml ]; then \
+  corepack enable pnpm && pnpm build; \
+  else \
+  echo "No lockfile found." && exit 1; \
+  fi
+
+# ============================================
+# Stage 3: Run Next.js application
+# ============================================
+
+FROM node:${NODE_VERSION} AS runner
+
+# Set working directory
+WORKDIR /app
+
+# Set production environment variables
+ENV NODE_ENV=production
+ENV PORT=3000
+ENV HOSTNAME="0.0.0.0"
+
+# Next.js collects completely anonymous telemetry data about general usage.
+# Learn more here: https://nextjs.org/telemetry
+# Uncomment the following line in case you want to disable telemetry during the run time.
+# ENV NEXT_TELEMETRY_DISABLED=1
+
+# Copy production assets
+COPY --from=builder --chown=node:node /app/public ./public
+
+# Set the correct permission for prerender cache
+RUN mkdir .next
+RUN chown node:node .next
+
+# Automatically leverage output traces to reduce image size
+# https://nextjs.org/docs/advanced-features/output-file-tracing
+COPY --from=builder --chown=node:node /app/.next/standalone ./
+COPY --from=builder --chown=node:node /app/.next/static ./.next/static
+
+# If you want to persist the fetch cache generated during the build so that
+# cached responses are available immediately on startup, uncomment this line:
+# COPY --from=builder --chown=node:node /app/.next/cache ./.next/cache
+
+# Switch to non-root user for security best practices
+USER node
+
+# Expose port 3000 to allow HTTP traffic
+EXPOSE 3000
+
+# Start Next.js standalone server
+CMD ["node", "server.js"]
\ No newline at end of file
```

**File**: `Dockerfile.dev` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+FROM node:20-alpine
+
+WORKDIR /app
+
+COPY package.json package-lock.json ./
+RUN npm install
+
+# Source files are mounted as a volume at runtime for hot reload
+
+EXPOSE 3000
+
+ENV NODE_ENV=development
+ENV NEXT_TELEMETRY_DISABLED=1
+
+CMD ["npm", "run", "dev"]
```

**File**: `README.md` (modified, +25/-19)
```diff
@@ -37,24 +37,23 @@ Point it at a URL, run `/clone-website`, and your AI agent will inspect the site
 
 > Using a different agent? Open `AGENTS.md` for project instructions — most agents pick it up automatically.
 
-
 ## Supported Platforms
 
-| Agent | Status |
-|-------|--------|
+| Agent                                                         | Status                     |
+| ------------------------------------------------------------- | -------------------------- |
 | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | **Recommended** — Opus 4.6 |
-| [Codex CLI](https://github.com/openai/codex) | Supported |
-| [OpenCode](https://opencode.ai/) | Supported |
-| [GitHub Copilot](https://github.com/features/copilot) | Supported |
-| [Cursor](https://cursor.com/) | Supported |
-| [Windsurf](https://codeium.com/windsurf) | Supported |
-| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Supported |
-| [Cline](https://github.com/cline/cline) | Supported |
-| [Roo Code](https://github.com/RooCodeInc/Roo-Code) | Supported |
-| [Continue](https://continue.dev/) | Supported |
-| [Amazon Q](https://aws.amazon.com/q/developer/) | Supported |
-| [Augment Code](https://www.augmentcode.com/) | Supported |
-| [Aider](https://aider.chat/) | Supported |
+| [Codex CLI](https://github.com/openai/codex)                  | Supported                  |
+| [OpenCode](https://opencode.ai/)                              | Supported                  |
+| [GitHub Copilot](https://github.com/features/copilot)         | Supported                  |
+| [Cursor](https://cursor.com/)                                 | Supported                  |
+| [Windsurf](https://codeium.com/windsurf)                      | Supported                  |
+| [Gemini CLI](https://github.com/google-gemini/gemini-cli)     | Supported                  |
+| [Cline](https://github.com/cline/cline)                       | Supported                  |
+| [Roo Code](https://github.com/RooCodeInc/Roo-Code)            | Supported                  |
+| [Continue](https://continue.dev/)                             | Supported                  |
+| [Amazon Q](https://aws.amazon.com/q/developer/)               | Supported                  |
+| [Augment Code](https://www.augmentcode.com/)                  | Supported                  |
+| [Aider](https://aider.chat/)                                  | Supported                  |
 
 ## Prerequisites
 
@@ -128,14 +127,21 @@ npm run typecheck # TypeScript check
 npm run check  # Run lint + typecheck + build
 ```
 
+### If using docker
+
+```bash
+docker compose up app --build # build and run the app
+docker compose up dev --build # run the app in dev mode on port 3001
+```
+
 ## Updating for Other Platforms
 
 Two source-of-truth files power all platform support. Edit the source, then run the sync script:
 
-| What | Source of truth | Sync command |
-|------|----------------|--------------|
-| Project instructions | `AGENTS.md` | `bash scripts/sync-agent-rules.sh` |
-| `/clone-website` skill | `.claude/skills/clone-website/SKILL.md` | `node scripts/sync-skills.mjs` |
+| What                   | Source of truth                         | Sync command                       |
+| ---------------------- | --------------------------------------- | ---------------------------------- |
+| Project instructions   | `AGENTS.md`                             | `bash scripts/sync-agent-rules.sh` |
+| `/clone-website` skill | `.claude/skills/clone-website/SKILL.md` | `node scripts/sync-skills.mjs`     |
 
 Each script regenerates the platform-specific copies automatically. Agents that read the source files natively need no regeneration.
 
```

**File**: `docker-compose.yml` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+services:
+  app:
+    build:
+      context: .
+      dockerfile: Dockerfile
+      target: runner
+    image: ai-website-cloner:latest
+    container_name: ai-website-cloner
+    restart: unless-stopped
+    ports:
+      - "${PORT:-3000}:3000"
+    environment:
+      - NODE_ENV=production
+      - NEXT_TELEMETRY_DISABLED=1
+    env_file:
+      - path: .env.local
+        required: false
+      - path: .env
+        required: false
+    healthcheck:
+      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"]
+      interval: 30s
+      timeout: 10s
+      retries: 3
+      start_period: 10s
+
+  dev:
+    build:
+      context: .
+      dockerfile: Dockerfile.dev
+    image: ai-website-cloner:dev
+    container_name: ai-website-cloner-dev
+    restart: unless-stopped
+    ports:
+      - "${DEV_PORT:-3001}:3000"
+    environment:
+      - NODE_ENV=development
+      - NEXT_TELEMETRY_DISABLED=1
+    env_file:
+      - path: .env.local
+        required: false
+      - path: .env
+        required: false
+    volumes:
+      - .:/app
+      - /app/node_modules
+      - /app/.next
+    healthcheck:
+      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"]
+      interval: 30s
+      timeout: 10s
+      retries: 3
+      start_period: 15s
```

**File**: `next.config.ts` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@ import type { NextConfig } from "next";
 
 const nextConfig: NextConfig = {
   /* config options here */
+  output: "standalone",
 };
 
 export default nextConfig;
```

---

### Incident Patch 13: `7f020275` (2026-03-30)
**Commit Message**: Update package-lock.json to reflect project name change to 'ai-website-clone-template' and version bump to 0.2.0. Added MIT license and specified Node.js engine requirement of version 20 or higher.

**File**: `package-lock.json` (modified, +8/-4)
```diff
@@ -1,12 +1,13 @@
 {
-  "name": "clone",
-  "version": "0.1.0",
+  "name": "ai-website-clone-template",
+  "version": "0.2.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
-      "name": "clone",
-      "version": "0.1.0",
+      "name": "ai-website-clone-template",
+      "version": "0.2.0",
+      "license": "MIT",
       "dependencies": {
         "@base-ui/react": "^1.3.0",
         "class-variance-authority": "^0.7.1",
@@ -28,6 +29,9 @@
         "eslint-config-next": "16.2.1",
         "tailwindcss": "^4",
         "typescript": "^5"
+      },
+      "engines": {
+        "node": ">=20"
       }
     },
     "node_modules/@alloc/quick-lru": {
```

---

### Incident Patch 14: `85a75133` (2026-03-30)
**Commit Message**: Update project description in package.json and README.md for clarity and modernity. Added use cases and limitations to README for better user guidance.

**File**: `README.md` (modified, +14/-1)
```diff
@@ -2,7 +2,7 @@
 
 <a href="https://github.com/JCodesMore/ai-website-cloner-template/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a> <a href="https://github.com/JCodesMore/ai-website-cloner-template/stargazers"><img src="https://img.shields.io/github/stars/JCodesMore/ai-website-cloner-template?style=flat" alt="Stars" /></a> <a href="https://discord.gg/hrTSX5yTpB"><img src="https://img.shields.io/discord/1400896964597383279?label=discord" alt="Discord" /></a>
 
-A reusable template for reverse-engineering any website and rebuilding it as a pixel-perfect clone using AI coding agents. **Recommended: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with Opus 4.6 for best results** — but works with a variety of AI coding agents.
+A reusable template for reverse-engineering any website into a clean, typed Next.js codebase using AI coding agents. **Recommended: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with Opus 4.6 for best results** — but works with a variety of AI coding agents.
 
 Point it at a URL, run `/clone-website`, and your AI agent will inspect the site, extract design tokens and assets, write component specs, and dispatch parallel builders to reconstruct every section.
 
@@ -78,6 +78,19 @@ The `/clone-website` skill runs a multi-phase pipeline:
 
 Each builder agent receives the full component specification inline — exact `getComputedStyle()` values, interaction models, multi-state content, responsive breakpoints, and asset paths. No guessing.
 
+## Use Cases
+
+- **Platform migration** — rebuild a site you own from WordPress/Webflow/Squarespace into a modern Next.js codebase
+- **Lost source code** — your site is live but the repo is gone, the developer left, or the stack is legacy. Get the code back in a modern format
+- **"Make it look like this"** — client sends a reference site. Use it as a visual starting point to build theirs faster instead of starting from a blank page.
+- **Learning** — deconstruct how production sites achieve specific layouts, animations, and responsive behavior by working with real code
+
+## Not Intended For
+
+- **Phishing or impersonation** — this project must not be used for deceptive purposes, impersonation, or any activity that breaks the law.
+- **Passing off someone's design as your own** — logos, brand assets, and original copy belong to their owners.
+- **Violating terms of service** — some sites explicitly prohibit scraping or reproduction. Check first.
+
 ## Project Structure
 
 ```
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "name": "ai-website-clone-template",
   "version": "0.2.0",
   "private": true,
-  "description": "A reusable template for reverse-engineering any website and rebuilding it as a pixel-perfect clone using AI coding agents",
+  "description": "Clone any website into a clean, modern Next.js codebase using AI coding agents",
   "author": "JCodesMore",
   "license": "MIT",
   "repository": {
```

---

### Incident Patch 15: `db7a80de` (2026-03-26)
**Commit Message**: Fix typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# AI Website Clone Template
+# AI Website Cloner Template
 
 A reusable template for reverse-engineering any website and rebuilding it as a pixel-perfect clone using [Claude Code](https://docs.anthropic.com/en/docs/claude-code).
 
```

#### Recent Merged Pull Requests:
- **PR #125** (2026-10-05): fix: count the README token badge in CI (@JCodesMore)
- **PR #124** (2026-10-05): docs: generalize cloning guidance around observed rules (@JCodesMore)
- **PR #123** (2026-10-05): Improve shared website cloning workflow (@JCodesMore)
- **PR #120** (2026-09-27): docs: recommend Opus 5.5 and refresh Star History chart (@JCodesMore)
- **PR #119** (2026-09-20): fix(security): patch dependencies while retaining exact Next.js pins (@JCodesMore)
- **PR #118** (closed): fix(security): bump Next.js to 16.3.5 and patch all npm audit advisories (0 vulnerabilities) (@atahan150)
- **PR #116** (2026-09-17): docs: simplify Quick Start and keep one README (@JCodesMore)
- **PR #115** (2026-09-17): refactor: centralize skills for four supported agents (@JCodesMore)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

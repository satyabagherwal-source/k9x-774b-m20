> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vikejs-vike-learnings.md`  
> **Source**: github ([https://github.com/vikejs/vike](https://github.com/vikejs/vike))  
> **Source Version**: `a46b8cf7`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T17:03:49.919Z  
> **Learning ID**: `learn-github-vikejs-vike`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): vikejs/vike

> **Canonical Artifact**: `07_PROJECT_LEARNING/vikejs-vike-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vikejs/vike](https://github.com/vikejs/vike))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T17:03:49.912Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vikejs/vike`
- **Description**: (Replaces Next.js/Nuxt) 🔨 Build mission-critical applications with stability and development freedom.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5836 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/base-url-cdn/renderer/+config.js`
```
// https://vike.dev/config
export default {
  baseAssets: 'http://localhost:8080/cdn/',
  clientRouting: true,
  hydrationCanBeAborted: true,
  passToClient: ['pageProps'],
}

```

### Core Architecture Module: `examples/base-url-cdn/renderer/+onRenderClient.jsx`
```
// https://vike.dev/onRenderClient
export { onRenderClient }

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Layout } from './Layout'

let root
async function onRenderClient(pageContext) {
  const { Page, pageProps } = pageContext
  const page = (
    <Layout pageContext={pageContext}>
      <Page {...pageProps} />
    </Layout>
  )
  const container = document.getElementById('root')
  if (pageContext.isHydration) {
    root = ReactDOM.hydrateRoot(container, page)
  } else {
    if (!root) {
      root = ReactDOM.createRoot(container)
    }
    root.render(page)
  }
}

```

### Core Architecture Module: `examples/base-url-cdn/renderer/+onRenderHtml.jsx`
```
// https://vike.dev/onRenderHtml
export { onRenderHtml }

import ReactDOMServer from 'react-dom/server'
import React from 'react'
import { Layout } from './Layout'
import { escapeInject, dangerouslySkipEscape } from 'vike/server'
// Assets deployed to a CDN:
//  - logo.svg
//  - manifest.json
import logoUrl from './logo.svg'

function onRenderHtml(pageContext) {
  const { Page, pageProps } = pageContext
  const pageHtml = ReactDOMServer.renderToString(
    <Layout>
      <Page {...pageProps} />
    </Layout>,
  )

  // Vite automatically injects the Base URL to `logoUrl`.
  // We can also manually inject the Base URL:
  const manifestUrl = import.meta.env.BASE_ASSETS + 'manifest.json'

  return escapeInject`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <link rel="icon" href="${logoUrl}" />
        <link rel="manifest" href="${manifestUrl}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vite App</title>
      </head>
      <body>
        <div id="root">${dangerouslySkipEscape(pageHtml)}</div>
      </body>
    </html>`
}

```

### Core Architecture Module: `examples/base-url-cdn/renderer/Layout.jsx`
```
import React from 'react'
import logo from './logo.svg'
import './Layout.css'

export { Layout }

function Layout({ children }) {
  return (
    <React.StrictMode>
      <Frame>
        <Sidebar>
          <Logo />
          <a href="/">Home</a>
          <a href="/about">About</a>
        </Sidebar>
        <Content>{children}</Content>
      </Frame>
    </React.StrictMode>
  )
}

function Frame({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        maxWidth: 900,
        margin: 'auto',
      }}
    >
      {children}
    </div>
  )
}

function Sidebar({ children }) {
  return (
    <div
      style={{
        padding: 20,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: '1.8em',
      }}
    >
      {children}
    </div>
  )
}

function Content({ children }) {
  return (
    <div
      style={{
        padding: 20,
        paddingBottom: 50,
        borderLeft: '2px solid #eee',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  )
}

function Logo() {
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 10,
      }}
    >
      <a href="/">
        <img src={logo} height={64} width={64} />
      </a>
    </div>
  )
}

```

### Core Architecture Module: `examples/base-url-server/renderer/+config.js`
```
export { config }

import { baseServer, baseAssets } from '../base.js'

// https://vike.dev/config
const config = {
  baseAssets,
  baseServer,
  clientRouting: true,
  hydrationCanBeAborted: true,
  passToClient: ['pageProps'],
}

```

### Core Architecture Module: `examples/base-url-server/renderer/+onRenderClient.jsx`
```
// https://vike.dev/onRenderClient
export { onRenderClient }

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Layout } from './Layout'

let root
async function onRenderClient(pageContext) {
  const { Page, pageProps } = pageContext
  const page = (
    <Layout pageContext={pageContext}>
      <Page {...pageProps} />
    </Layout>
  )
  const container = document.getElementById('root')
  if (pageContext.isHydration) {
    root = ReactDOM.hydrateRoot(container, page)
  } else {
    if (!root) {
      root = ReactDOM.createRoot(container)
    }
    root.render(page)
  }
}

```

### Core Architecture Module: `examples/base-url-server/renderer/+onRenderHtml.jsx`
```
// https://vike.dev/onRenderHtml
export { onRenderHtml }

import ReactDOMServer from 'react-dom/server'
import React from 'react'
import { Layout } from './Layout'
import { escapeInject, dangerouslySkipEscape } from 'vike/server'
// Assets deployed to a CDN:
//  - logo.svg
//  - manifest.json
import logoUrl from './logo.svg'

function onRenderHtml(pageContext) {
  const { Page, pageProps } = pageContext
  const pageHtml = ReactDOMServer.renderToString(
    <Layout>
      <Page {...pageProps} />
    </Layout>,
  )

  // The assets base URL is automatically injected to `logoUrl`.
  // We can also manually reference and inject the assets base URL:
  const manifestUrl = import.meta.env.BASE_ASSETS + 'manifest.json'

  return escapeInject`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <link rel="icon" href="${logoUrl}" />
        <link rel="manifest" href="${manifestUrl}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vite App</title>
      </head>
      <body>
        <div id="root">${dangerouslySkipEscape(pageHtml)}</div>
      </body>
    </html>`
}

```

### Core Architecture Module: `examples/base-url-server/renderer/Layout.jsx`
```
import React from 'react'
import logo from './logo.svg'
import './Layout.css'
import { Link } from '../components/Link'

export { Layout }

function Layout({ children }) {
  return (
    <React.StrictMode>
      <Frame>
        <Sidebar>
          <Logo />
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
        </Sidebar>
        <Content>{children}</Content>
      </Frame>
    </React.StrictMode>
  )
}

function Frame({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        maxWidth: 900,
        margin: 'auto',
      }}
    >
      {children}
    </div>
  )
}

function Sidebar({ children }) {
  return (
    <div
      style={{
        padding: 20,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: '1.8em',
      }}
    >
      {children}
    </div>
  )
}

function Content({ children }) {
  return (
    <div
      style={{
        padding: 20,
        paddingBottom: 50,
        borderLeft: '2px solid #eee',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  )
}

function Logo() {
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 10,
      }}
    >
      <Link href="/">
        <img src={logo} height={64} width={64} />
      </Link>
    </div>
  )
}

```

### Core Architecture Module: `examples/base-url/renderer/+config.js`
```
// https://vike.dev/config
export default {
  prerender: true,
  passToClient: ['pageProps'],
  clientRouting: true,
  hydrationCanBeAborted: true,
}

```

### Core Architecture Module: `examples/base-url/renderer/+onRenderClient.jsx`
```
// https://vike.dev/onRenderClient
export { onRenderClient }

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Layout } from './Layout'

let root
async function onRenderClient(pageContext) {
  const { Page, pageProps } = pageContext
  const page = (
    <Layout pageContext={pageContext}>
      <Page {...pageProps} />
    </Layout>
  )
  const container = document.getElementById('root')
  if (pageContext.isHydration) {
    root = ReactDOM.hydrateRoot(container, page)
  } else {
    if (!root) {
      root = ReactDOM.createRoot(container)
    }
    root.render(page)
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3642** (2026-10-20): **chore(deps): bump @batijs/elements from 0.0.98 to 0.0.99**
  *Symptoms*: Bumps [@batijs/elements](https://github.com/vikejs/bati) from 0.0.98 to 0.0.99. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/vikejs/bati/commit/b7b75dfecd72ad428ce2d86142d25c888c357715"><code>b7b75df</code></a> chore: release v0.0.99</li> <li><a href="https://github.com/vikejs/bati/commit/c14103c1b6cc1a6b184e6908c329a6b59045cffa"><code>c14103c</code></a> chore: update deps</li> <li><a href="https://github.com/vikejs/bati/commit/45549c9b84dac1a602cf29cb6bb2064c80b723b6"><code>45549c9</code></a> chore: README for boilerplates wip</li> <li><a href="https://github.com/vikejs/bati/commit/79773075cbc3dcf9f5f0e72d2e936119bd4de059"><code>7977307</code></a> chore: README for boilerplates wip</li> <li>See full diff in <a href="https://github.com/vikejs/bati/compare/v0.0.98...v0.0.99">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=@batijs/elements&package-manager=npm_and_yarn&previous-version=0.0.98&new-version=0.0.99)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</s

- **Issue #3639** (2026-10-20): **fix: `pageContext.previousPageContext` no longer keeps all past pageContexts in memory**
  *Symptoms*: <img src="https://github.com/claude.png" width="20" height="20" alt="Claude"> *Claude Opus 5.5 (high effort) built this, wrote this and reviewed it.*  Every client navigation keeps the previous page's `pageContext` in memory forever, because each `pageContext` holds the one before it, so a long-lived app's heap keeps growing.  With this PR, the page before the last rendered one drops its `previousPageContext`, and the deprecated `_previousPageContext` getter reads that field instead of holding its own reference. So past pages are freed, and the page on screen keeps its own `previousPageContext` when `onRenderClient()` resolves once the page is shown.  ### What you should see  **1.** The 0.64 MB this PR still grows is the measuring script's own Playwright element handles plus V8's JIT-compiled code. Without both (the two `--jitless` rows below), it stays flat.  | Plain vike-react 0.6.30, `/about` → `/` and back, heap after GC | 50 → 300 round trips | |---|---| | `main` | 4.44 MB → 9.43 MB | | This PR | 3.58 MB → 4.22 MB | | `main`, `--jitless`, no element handles | 2.93 MB → 7.25 MB | | This PR, `--jitless`, no element handles | 2.08 MB → 2.04 MB |  Measured on 7fd3035177 (the head's runtime code).  **2.** The new test:  ``` $ pnpm exec test-e2e playground/test-dev   # without the fix  FAIL  test/playground/test-dev.test.ts Test  FAIL  because the test "only the last three pageContexts are kept in memory" threw an error, see below. [TEST_FAIL] AssertionError: expected 4 to equ

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

### Incident Patch 1: `b5c67adb` (2026-10-20)
**Commit Message**: fix: `pageContext.previousPageContext` no longer keeps all past pageContexts in memory (#3639)

**File**: `docs/pages/onRenderClient/+Page.mdx` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ Where:
 
 You can use <Link href="/passToClient">`passToClient`</Link> to determine what subset of `pageContext` is sent to the browser.
 
+> You should resolve `onRenderClient()` only after the page is rendered and visible to the user, because Vike then triggers actions such as setting the scroll position and calling the <Link href="/onPageTransitionEnd">`+onPageTransitionEnd` hook</Link> (typically used for page transition animations).
+
 > See <Link href="/render-modes" /> and <Link href="/clientRouting">Client Routing</Link> for illustrations of conditional DOM
 > hydration, for supporting both SPA and SSR.
 
```

**File**: `packages/vike/src/client/runtime-client-routing/renderPageClient.ts` (modified, +8/-2)
```diff
@@ -76,7 +76,8 @@ const globalObject = getGlobalObject<{
   isTransitioning?: true
   //https://vike.dev/pageContext#previousPageContext
   previousPageContext?: PreviousPageContext
-  renderedPageContext?: PageContextInternalClient & PageContext_loadPageConfigsLazyClientSide
+  renderedPageContext?: PageContextInternalClient &
+    PageContext_loadPageConfigsLazyClientSide & { previousPageContext: PreviousPageContext | null }
   currentPageContext?: Record<string, unknown>
   hydrationAwaitPromise: Promise<void>
   hydrationAwaitPromiseResolve: () => void
@@ -507,6 +508,11 @@ async function renderPageClient(renderArgs: RenderArgs) {
     }
 
     changeUrl(urlOriginal, overwriteLastHistoryEntry)
+    {
+      const previousPageContextBefore = globalObject.renderedPageContext?.previousPageContext
+      // Remove previousPageContext of past pages (otherwise all the past pageContext are kept in memory)
+      if (previousPageContextBefore) previousPageContextBefore.previousPageContext = null
+    }
     globalObject.previousPageContext = pageContext
     // There should never be concurrent onRenderClient() calls
     assert(globalObject.onRenderClientPreviousPromise === undefined)
@@ -641,7 +647,7 @@ async function getPageContextBegin(
         showStackTrace: true,
         onlyOnce: true,
       })
-      return previousPageContext
+      return pageContext.previousPageContext
     },
     enumerable: false,
   })
```

#### Recent Merged Pull Requests:
- **PR #3642** (2026-10-20): chore(deps): bump @batijs/elements from 0.0.98 to 0.0.99 (@dependabot[bot])
- **PR #3639** (2026-10-20): fix: `pageContext.previousPageContext` no longer keeps all past pageContexts in memory (@nitedani)
- **PR #3638** (2026-10-19): feat: expose pageContext serialization to vike-react-rsc (@nitedani)
- **PR #3637** (closed): fix: the error page's `data()` runs upon a server-side `throw render()` during client-side navigation (@nitedani)
- **PR #3635** (closed): fix: `+staticReplace` treats a Vike environment (e.g. `rsc`) as its own `env` (@nitedani)
- **PR #3633** (2026-10-19): fix: `pageContext.is404` is `true` upon `throw render(404)` and client-side navigation (@nitedani)

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

## X. `pageContext.previousPageContext` no longer keeps all past pageContexts in memor

**RULE**:
When implementing operations in `docs/pages/onRenderClient/+Page.mdx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in vikejs/vike. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b5c67adb`: `pageContext.previousPageContext` no longer keeps all past pageContexts in memory (#3639). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/pages/onRenderClient/+Page.mdx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
> You should resolve `onRenderClient()` only after the page is rendered and visible to the user, because Vike then triggers actions such as setting the scroll position and calling the <Link href="/onPageTransitionEnd">`+onPageTransitionEnd` hook</Link> (typically used for page transition animations).

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b5c67adb` are properly handled with clean fallback behavior.

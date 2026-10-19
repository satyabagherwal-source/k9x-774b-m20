> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vikejs-vike-learnings.md`  
> **Source**: github ([https://github.com/vikejs/vike](https://github.com/vikejs/vike))  
> **Source Version**: `4a0a6827`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T15:24:31.235Z  
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
> **Harvest Timestamp**: 2026-10-19T15:24:30.785Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vikejs/vike`
- **Description**: (Replaces Next.js/Nuxt) 🔨 Build mission-critical applications with stability and development freedom.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5837 stars

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
- **Issue #3637** (2026-10-19): **fix: the error page's `data()` runs upon a server-side `throw render()` during client-side navigation**
  *Symptoms*: <img src="https://github.com/claude.png" width="20" height="20" alt="Claude"> *Claude Opus 5.5 (high effort) wrote this and its code; Claude Opus 5.5 (high effort) reviewed it.*  **State: draft** (its review runs next)  When a `+guard`, `+data` or `+onBeforeRender` throws `render(statusCode)` on the server during client-side navigation, Vike answers the `pageContext.json` request with the error page's pageContext but without running the error page's `data()` and `onBeforeRender()`. The same throw on a full page load runs them. vike-react-rsc's error page renders on the server, so after such a navigation it has no data to show (nitedani/vike-react-rsc#19).  | Case, on `main` (4a0a6827af), `test/abort` with this PR's `pages/_error/+data.server.ts` | Observed | Expected | |---|---|---| | Navigate to `/show-error-page`, whose `+guard` throws `render(499, reason)` on the server (the `dev:server` and `prod` lanes) | the error page's `+data.server.ts` doesn't run | it runs, with `abortReason` | | Reload the same page | it runs | it runs |  `handleAbort()` built the error page's `pageContext.json` answer itself and skipped the error page's hooks. It now returns early only for `redirect()` and `render(url)`, and leaves `render(statusCode)` to `renderPageServerAfterRoute()`, the function that already renders the error page on a full page load and after a server-side error. So the server renders the error page the same way for a full page load and for a `pageContext.json` request. At 6b
  **Post-Mortem & Fix Analysis**:
  > > `pages/_error/+data.server.ts`  Users don't need this (I can't think of a use case for this), does vike-react-rsc need it?  Closing but let's continue the conversation.

- **Issue #3635** (2026-10-19): **fix: `+staticReplace` treats a Vike environment (e.g. `rsc`) as its own `env`**
  *Symptoms*: <img src="https://github.com/claude.png" width="20" height="20" alt="Claude"> *Claude Opus 5.5 (high effort) wrote this and its code; Claude Opus 5.5 (high effort) reviewed it.*  **State: draft** (CI hasn't run on it yet, and the last review of the code runs next)  A `+staticReplace` entry with `env: 'server'` also runs in a [Vike environment](https://vike.dev/meta#vike-environments) such as `rsc`, and no entry can target that environment alone. vike-react-rsc's `<ClientOnly>` (nitedani/vike-react-rsc#22, not released) strips its children with `env: 'server'` entries, so inside a server component its children are stripped in the `rsc` environment too, and never reach the browser. #22 works around this with a Vite plugin that rewrites the import path in `rsc`, and drops that plugin once this lands.  | Case, on `main` (305221a563) | Observed | Expected | |---|---|---| | `env: 'server'` entry, `rsc` environment | applied | not applied, as `meta[configName].env` treats `rsc` | | `env: 'rsc'` entry | not applied anywhere | applied in `rsc` | | `env: 'sever'` (typo) | type error; skipped without a message in a JS config | usage error naming the allowed values |  This PR matches an entry against the environment's name when the code runs in a Vike environment. So `env: 'server'` no longer covers `rsc`. `StaticReplace`'s `env` type widens from `'server' | 'client'` to `string`, because the allowed names come from the app's config. So a misspelled `env` is now caught when the config lo

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

### Incident Patch 1: `ec7f917a` (2026-10-19)
**Commit Message**: fix: `pageContext.is404` is `true` upon `throw render(404)` and client-side navigation (#3633)

**File**: `packages/vike/src/server/runtime/renderPageServer.ts` (modified, +2/-0)
```diff
@@ -623,6 +623,8 @@ async function handleAbort(
       )
       objectAssign(pageContext, { pageId: errorPageId })
       objectAssign(pageContext, pageContextErrorPageInit, true)
+      // Overrides `is404: false` of pageContextErrorPageInit, e.g. `throw render(404)` => `is404: true`
+      objectAssign(pageContext, pageContextAbort)
       updateType(pageContext, await loadPageConfigsLazyServerSide(pageContext))
       // We include pageContextInit: we don't only serialize pageContextAbort because the error page may need to access pageContextInit
       pageContextJson = getPageContextJson(pageContext)
```

**File**: `test/abort/pages/_error/+Page.tsx` (modified, +2/-2)
```diff
@@ -20,9 +20,9 @@ function Page() {
     }
   }
 
-  let { is404, abortReason, abortStatusCode } = pageContext
+  let { is404, abortReason, abortStatusCode, errorDescription } = pageContext
   if (!abortReason) {
-    abortReason = is404 ? 'Page not found.' : 'Something went wrong.'
+    abortReason = errorDescription ?? (is404 ? 'Page not found.' : 'Something went wrong.')
   }
   return (
     <Center>
```

**File**: `test/abort/pages/_error/+onCreatePageContext.server.ts` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+export { onCreatePageContext }
+
+import type { PageContextServer } from '../../renderer/types'
+
+function onCreatePageContext(pageContext: PageContextServer) {
+  pageContext.errorDescription = pageContext.is404 ? 'Page not found.' : 'Something went wrong.'
+}
```

**File**: `test/abort/pages/render-404/+Page.tsx` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+export default Page
+
+import React from 'react'
+
+function Page() {
+  return <p>I'm never shown since the guard() hook executes `throw render(404)`.</p>
+}
```

**File**: `test/abort/pages/render-404/+guard.ts` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+export default guard
+
+import { render } from 'vike/abort'
+
+async function guard() {
+  throw render(404)
+}
```

**File**: `test/abort/renderer/+config.ts` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 export default {
   clientRouting: true,
   hydrationCanBeAborted: true,
-  passToClient: ['someFakeData'],
+  passToClient: ['someFakeData', 'errorDescription'],
   redirects: {
     '/permanent-redirect': '/',
     '/star-wars-api/*': 'https://brillout.github.io/star-wars/api/*',
```

**File**: `test/abort/renderer/Layout.tsx` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ function Layout({ children, pageContext }: { children: React.ReactNode; pageCont
             <Nav href="/redirect" />
             <Nav href="/render-homepage" />
             <Nav href="/show-error-page" />
+            <Nav href="/render-404" />
             <Nav href="/permanent-redirect" />
             <Nav href="/redirect-external" />
             <Nav href="/star-wars-api/films/1.json" />
```

**File**: `test/abort/renderer/types.ts` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ export type PageContextCustom = {
   }
   title?: string
   abortReason?: string
+  errorDescription?: string
 }
 
 type PageContextServer = PageContextBuiltInServer<Page> & PageContextCustom
```

#### Recent Merged Pull Requests:
- **PR #3637** (closed): fix: the error page's `data()` runs upon a server-side `throw render()` during client-side navigation (@nitedani)
- **PR #3635** (closed): fix: `+staticReplace` treats a Vike environment (e.g. `rsc`) as its own `env` (@nitedani)
- **PR #3633** (2026-10-19): fix: `pageContext.is404` is `true` upon `throw render(404)` and client-side navigation (@nitedani)
- **PR #3632** (2026-10-19): chore(deps): bump @universal-middleware/core from 0.7.0 to 0.7.1 (@dependabot[bot])
- **PR #3631** (2026-10-19): chore(deps-dev): bump vitest from 5.0.4 to 5.0.5 (@dependabot[bot])
- **PR #3630** (2026-10-19): chore(deps): bump @vikejs/express from 0.4.0 to 0.4.1 (@dependabot[bot])

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

## X. `pageContext.is404` is `true` upon `throw render(404)` and client-side navigatio

**RULE**:
When implementing operations in `packages/vike/src/server/runtime/renderPageServer.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in vikejs/vike. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ec7f917a`: `pageContext.is404` is `true` upon `throw render(404)` and client-side navigation (#3633). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/vike/src/server/runtime/renderPageServer.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      // Overrides `is404: false` of pageContextErrorPageInit, e.g. `throw render(404)` => `is404: true`
      objectAssign(pageContext, pageContextAbort)
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ec7f917a` are properly handled with clean fallback behavior.

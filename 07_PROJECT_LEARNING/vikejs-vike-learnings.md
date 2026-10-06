# Forensic Learning Record (Deep Inspection): vikejs/vike

> **Canonical Artifact**: `07_PROJECT_LEARNING/vikejs-vike-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vikejs/vike](https://github.com/vikejs/vike))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:49:27.560Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vikejs/vike`
- **Description**: (Replaces Next.js/Nuxt) 🔨 Build mission-critical applications with stability and development freedom.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5832 stars

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

### Core Architecture Module: `examples/base-url/renderer/+onRenderHtml.jsx`
```
// https://vike.dev/onRenderHtml
export { onRenderHtml }

import ReactDOMServer from 'react-dom/server'
import React from 'react'
import { Layout } from './Layout'
import { escapeInject, dangerouslySkipEscape } from 'vike/server'
// Vite automatically injects the Base URL to `logoUrl`.
import logoUrl from './logo.svg'

function onRenderHtml(pageContext) {
  const { Page, pageProps } = pageContext
  const pageHtml = ReactDOMServer.renderToString(
    <Layout>
      <Page {...pageProps} />
    </Layout>,
  )

  // For assets living `public/`, we need to manually inject the Base URL:
  const manifestUrl = normalize(import.meta.env.BASE_URL + '/manifest.json')

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

function normalize(url) {
  return '/' + url.split('/').filter(Boolean).join('/')
}

```

### Core Architecture Module: `examples/base-url/renderer/Layout.jsx`
```
import React from 'react'
import { Link } from '../components/Link'
import logo from './logo.svg'
import './Layout.css'

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3573** (2026-10-05): **chore(deps): bump @universal-middleware/node from 0.2.2 to 0.2.3**
  *Symptoms*: Bumps [@universal-middleware/node](https://github.com/magne4000/universal-middleware) from 0.2.2 to 0.2.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/magne4000/universal-middleware/releases">@​universal-middleware/node's releases</a>.</em></p> <blockquote> <h2><code>@​universal-middleware/node</code><a href="https://github.com/0"><code>@​0</code></a>.2.3</h2> <h3>Patch Changes</h3> <ul> <li>d763a15: fix(node): cancel the body instead of logging when the client left before the response was sent</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/magne4000/universal-middleware/commit/6ecf21b73ab231ab9e042f79c06ccfe1113418b1"><code>6ecf21b</code></a> Version Packages (<a href="https://redirect.github.com/magne4000/universal-middleware/issues/339">#339</a>)</li> <li><a href="https://github.com/magne4000/universal-middleware/commit/d763a15a8a65fa4f38f0d16f715be7c38461443a"><code>d763a15</code></a> fix(node): cancel the body instead of logging when the client left before the...</li> <li><a href="https://github.com/magne4000/universal-middleware/commit/a841ec8ec2f291b2eed6e6b44318aed0554c7142"><code>a841ec8</code></a> chore: upgrade release workflow</li> <li><a href="https://github.com/magne4000/universal-middleware/commit/cb65977cde349ab6561568b86ca2103a67e6757a"><code>cb65977</code></a> chore(deps): update dependency vercel to v60 (<a href="https://redirect.github.com/magne400

- **Issue #3572** (2026-10-05): **chore(deps-dev): bump vitest from 5.0.2 to 5.0.3**
  *Symptoms*: Bumps [vitest](https://github.com/vitest-dev/vitest/tree/HEAD/packages/vitest) from 5.0.2 to 5.0.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/vitest-dev/vitest/releases">vitest's releases</a>.</em></p> <blockquote> <h2>v5.0.3</h2> <h3>   🐞 Bug Fixes</h3> <ul> <li>Isolate <code>result.status</code> between <code>repeats</code> runs  -  by <a href="https://github.com/hi-ogawa"><code>@​hi-ogawa</code></a>, <strong>Hiroshi Ogawa</strong> and <strong>Codex (GPT-6)</strong> in <a href="https://redirect.github.com/vitest-dev/vitest/issues/11218">vitest-dev/vitest#11218</a> <a href="https://github.com/vitest-dev/vitest/commit/5dbebe9e3"><!-- raw HTML omitted -->(5dbeb)<!-- raw HTML omitted --></a></li> <li>Don't print an interceptor warning in browser mode  -  by <a href="https://github.com/sheremet-va"><code>@​sheremet-va</code></a> in <a href="https://redirect.github.com/vitest-dev/vitest/issues/11377">vitest-dev/vitest#11377</a> <a href="https://github.com/vitest-dev/vitest/commit/15cc006aa"><!-- raw HTML omitted -->(15cc0)<!-- raw HTML omitted --></a></li> <li>Don't retry when <code>test.fails</code> expectedly failed  -  by <a href="https://github.com/hi-ogawa"><code>@​hi-ogawa</code></a>, <strong>Hiroshi Ogawa</strong> and <strong>Codex (GPT-6)</strong> in <a href="https://redirect.github.com/vitest-dev/vitest/issues/11219">vitest-dev/vitest#11219</a> <a href="https://github.com/vitest-dev/vitest/commit/b24585f08"><!-- raw HTML 

- **Issue #3571** (2026-10-02): **test: fix flaky history.pushState() test**
  *Symptoms*: Fixes the flaky failure in https://github.com/vikejs/vike/actions/runs/37012502678 (`Unit Tests E2E - Win - Node.js 20`, `test/playground/test-dev.test.ts`):  ``` AssertionError: expected 'http://localhost:3000/' to equal 'http://localhost:3000/markdown'     at expectUrl (../utils.ts:45:3)     at pages/pushState/e2e-test.ts:40:5 ```  ## Cause  The test clicks `/markdown` and then immediately clicks `/pushState`. In the failing run the second click landed 26ms after the first, while the `/markdown` navigation was still fetching `/markdown/index.pageContext.json`. The `/pushState` navigation made the `/markdown` one outdated, and `renderPageClient()` returns before `changeUrl()` for an outdated render. So `/markdown` never got a history entry, and the two `goBack()` calls later landed on `/` instead of `/markdown`.  This is intended Vike behavior. The test was the problem.  ## Fix  Add a `navigate()` helper that clicks the link and then waits for `window._vike.fullyRenderedUrl` to match the target URL before the next step.  ## Validation  - `test/playground/test-dev.test.ts`: 3 local runs, all passed - `test/playground/test-preview.test.ts`: passed - Prettier: clean  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01H4GcyFNmqddPoiJQJSUusr  --- _Generated by [Claude Code](https://claude.ai/code/session_01H4GcyFNmqddPoiJQJSUusr)_

- **Issue #3570** (2026-10-02): **test: fix flaky vike-react-zustand counter test**
  *Symptoms*: Fixes the flaky failure in https://github.com/vikejs/vike/actions/runs/36927889501/job/110589694000:  ``` AssertionError: expected 'Counter 6567' to equal 'Counter 6523' ```  ## Cause  `testCounter()` in `test/vike-react-zustand/.testRun.ts` clicked the button repeatedly inside `autoRetry()` until the text matched `currentValue + 1`. That loop assumes a click either has no effect (not hydrated yet) or shows up immediately. If a click goes through but the text is read before React re-renders, the loop clicks again. Then the counter is past the target and can never match it. In the CI log, 51 clicks went through and the counter ended up 45 past the target.  ## Fix  Wait for hydration (`window._vike.fullyRenderedUrl`, which is set after `onRenderClient()` resolves), click once, then `autoRetry()` only the assertion.  ## Validation  - `test/vike-react-zustand/.test-dev.test.ts`: 5 local runs, all passed - `test/vike-react-zustand/.test-preview.test.ts`: passed - Prettier: clean  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01H4GcyFNmqddPoiJQJSUusr  --- _Generated by [Claude Code](https://claude.ai/code/session_01H4GcyFNmqddPoiJQJSUusr)_

- **Issue #3569** (2026-10-02): **test: wait for the response log in the `pageContext.content` stream-error test**
  *Symptoms*: <img src="https://github.com/claude.png" width="20" height="20" align="left" alt="Claude"> **Claude:** The playground test `pageContext.content: stream error before the first chunk` checks the server's `HTTP response … 500` log right after the client reads the response. The server can log it a moment later, so on Windows it failed (vikejs/vike#3568's [Windows job](https://github.com/vikejs/vike/actions/runs/36999922025/job/110815084465): "The following log is expected but it wasn't logged"). It now waits for the log with `autoRetry()`, like `dynamic-import-file-env/e2e-test.ts` does.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #3568** (2026-10-02): **minor refactor: replace `client: 'if-client-routing'` with a `clientRoutingOnly` modifier**
  *Symptoms*: <img src="https://github.com/claude.png" width="20" height="20" align="left" alt="Claude"> **Claude:** `client` held either a boolean or the string `'if-client-routing'`, which only Vike sets internally (`route`, `guard`, `onBeforeRoute`, `iKnowThePerformanceRisksOfAsyncRouteFunctions`). This splits the two facts: `client` says where the value loads, and a `clientRoutingOnly` modifier says when, like `production` does.  | | `main` | this PR | | --- | --- | --- | | Built-in `guard` | `env: { server: true, client: 'if-client-routing' }` | `env: { server: true, client: true, clientRoutingOnly: true }` | | `ConfigEnv['client']` | `boolean \| 'if-client-routing'` | `boolean` |  Users can't set either (`getConfigEnvValue()` only accepts a boolean `client` and no other keys), so nothing changes for them. A `.server.js`, `.client.js` or `.shared.js` file still decides the environments on its own, as before.  It lets vikejs/vike#3550's environment index signature be `boolean | undefined`, without `'if-client-routing'` in it.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > Nice, thanks Dani

- **Issue #3567** (2026-10-02): **chore(deps-dev): bump @brillout/test-e2e from 0.6.23 to 0.6.24**
  *Symptoms*: Bumps [@brillout/test-e2e](https://github.com/brillout/test-e2e) from 0.6.23 to 0.6.24. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/brillout/test-e2e/blob/main/CHANGELOG.md">@​brillout/test-e2e's changelog</a>.</em></p> <blockquote> <h2><a href="https://github.com/brillout/test-e2e/compare/v0.6.23...v0.6.24">0.6.24</a> (2026-09-28)</h2> <h3>Bug Fixes</h3> <ul> <li>replace esbuild with Rolldown (<a href="https://redirect.github.com/brillout/test-e2e/issues/2">#2</a>) (<a href="https://github.com/brillout/test-e2e/commit/e20ae338e17c1d2527a5bcee66fb07d7b2e98cce">e20ae33</a>)</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/brillout/test-e2e/commit/0dd8fde617911fd584eb6c0473c08fa0cde89fb7"><code>0dd8fde</code></a> release: v0.6.24</li> <li><a href="https://github.com/brillout/test-e2e/commit/20f37b0db5a129315104c825cccf2c3bd715c51b"><code>20f37b0</code></a> update release-me</li> <li><a href="https://github.com/brillout/test-e2e/commit/e20ae338e17c1d2527a5bcee66fb07d7b2e98cce"><code>e20ae33</code></a> fix: replace esbuild with Rolldown (<a href="https://redirect.github.com/brillout/test-e2e/issues/2">#2</a>)</li> <li><a href="https://github.com/brillout/test-e2e/commit/09417c5d8fd1a1c20bf32aabd6de9ea849e037d9"><code>09417c5</code></a> pnpm approve</li> <li><a href="https://github.com/brillout/test-e2e/commit/920cdc7188ccec190b954035e338a7232b331276"><code>920cdc7</code></a> ch

- **Issue #3566** (2026-10-02): **chore(deps): bump @universal-deploy/vite from 0.1.13 to 0.1.14**
  *Symptoms*: Bumps [@universal-deploy/vite](https://github.com/photon-js/universal-deploy) from 0.1.13 to 0.1.14. <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/photon-js/universal-deploy/commits">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=@universal-deploy/vite&package-manager=npm_and_yarn&previous-version=0.1.13&new-version=0.1.14)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this minor version` will close this PR and 

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

### Incident Patch 1: `444a84f9` (2026-10-02)
**Commit Message**: test: fix flaky history.pushState() test (#3571)

**File**: `test/playground/pages/pushState/e2e-test.ts` (modified, +9/-3)
```diff
@@ -8,10 +8,10 @@ function testHistoryPushState() {
     // Timestamp component works as expected
     await page.goto(getServerUrl() + '/')
     await testCounter()
-    await page.click('a[href="/pushState"]')
+    await navigate('/pushState')
     const timestamp1 = await getTimestamp()
-    await page.click('a[href="/markdown"]')
-    await page.click('a[href="/pushState"]')
+    await navigate('/markdown')
+    await navigate('/pushState')
     const timestamp2 = await getTimestampNewerThan(timestamp1)
 
     // Calling history.pushState() doesn't trigger a re-render, thus timestamp doesn't change
@@ -49,6 +49,12 @@ function testHistoryPushState() {
 
   return
 
+  // Await navigation end: clicking a link while the previous navigation is still ongoing aborts it, and the aborted navigation doesn't add a history entry
+  async function navigate(url: string) {
+    await page.click(`a[href="${url}"]`)
+    await page.waitForFunction((url) => (window as any)._vike.fullyRenderedUrl === url, url)
+  }
+
   // The page is re-rendered asynchronously: the old DOM (with the old timestamp) can still be shown
   async function getTimestampNewerThan(timestampPrevious: number) {
     let timestamp!: number
```

---

### Incident Patch 2: `68fb6d0b` (2026-10-02)
**Commit Message**: test: fix flaky vike-react-zustand counter test (#3570)

**File**: `test/vike-react-zustand/.testRun.ts` (modified, +4/-3)
```diff
@@ -116,11 +116,12 @@ async function testCounter(currentValue?: number) {
     { timeout: 5 * 1000 },
   )
   const valueNew = currentValue! + 1
-  // autoRetry() in case page isn't hydrated yet
+  // Await hydration — clicking repeatedly until the value changes is flaky: a click can land while the previous one is still being processed, overshooting `valueNew`.
+  await page.waitForFunction(() => !!(window as any)._vike?.fullyRenderedUrl)
+  const btn = page.locator('button', { hasText: 'Counter' })
+  await btn.click()
   await autoRetry(
     async () => {
-      const btn = page.locator('button', { hasText: 'Counter' })
-      await btn.click()
       expect(await btn.textContent()).toBe(`Counter ${valueNew}`)
     },
     { timeout: 5 * 1000 },
```

---

### Incident Patch 3: `b2c0d520` (2026-10-01)
**Commit Message**: fix: pre-render after all Vite environments are built (#3564)

**File**: `packages/vike/src/node/vite/plugins/build/pluginBuildApp.ts` (modified, +17/-22)
```diff
@@ -1,7 +1,7 @@
 export { pluginBuildApp }
 
 import { runPrerender_forceExit } from '../../../prerender/runPrerenderEntry.js'
-import type { Environment, InlineConfig, Plugin, ResolvedConfig } from 'vite'
+import type { InlineConfig, Plugin, ResolvedConfig } from 'vite'
 import { resolveOutDir } from '../../shared/getOutDirs.js'
 import { assert, assertWarning } from '../../../../utils/assert.js'
 import { onSetupBuild } from '../../../../utils/assertSetup.js'
@@ -13,9 +13,7 @@ import pc from '@brillout/picocolors'
 import { getVikeConfigInternal } from '../../shared/resolveVikeConfigInternal.js'
 import { isVikeCliOrApi } from '../../../../shared-server-node/api-context.js'
 import { handleAssetsManifest, handleAssetsManifest_assertUsageCssTarget } from './handleAssetsManifest.js'
-import { isViteServerSide_onlySsrEnv } from '../../shared/isViteServerSide.js'
 import { runPrerenderFromAutoRun } from '../../../prerender/runPrerenderEntry.js'
-import { getManifestFilePathRelative } from '../../shared/getManifestFilePathRelative.js'
 import { logErrorServer } from '../../../../server/runtime/logErrorServer.js'
 import '../../assertEnvVite.js'
 
@@ -25,7 +23,6 @@ const globalObject = getGlobalObject('build/pluginBuildApp.ts', {
 
 function pluginBuildApp(): Plugin[] {
   let config: ResolvedConfig
-  let alreadyBuilt = false
   return [
     {
       name: 'vike:build:pluginBuildApp:pre',
@@ -38,18 +35,10 @@ function pluginBuildApp(): Plugin[] {
             builder: {
               // Can be overridden by another plugin e.g vike-vercel https://github.com/vikejs/vike/pull/2184#issuecomment-2659425195
               async buildApp(builder) {
-                if (alreadyBuilt) return
-                alreadyBuilt = true
                 assert(builder.environments.client)
                 assert(builder.environments.ssr)
                 await builder.build(builder.environments.client)
                 await builder.build(builder.environments.ssr)
-
-                if (isPrerenderForceExit()) {
-                  await builder.buildApp()
-                  runPrerender_forceExit()
-                  assert(false)
-                }
               },
             },
           }
@@ -93,8 +82,14 @@ function pluginBuildApp(): Plugin[] {
           await abortViteBuildSsr()
         },
       },
-      // TO-DO/eventually: stop using this writeBundle() hack and, instead, use the buildApp() implementation above.
-      // - Could it cause issues if a tool uses the writeBundle() hack together with getVikeConfig() ?
+      // Pre-render after all builds, e.g. after @vitejs/plugin-rsc moved its `rsc` build back into dist/server/
+      // - Before the `order: 'post'` buildApp() hooks of non-`enforce: 'pre'` plugins, e.g. vite-plugin-vercel copies dist/client/
+      buildApp: {
+        order: 'post',
+        async handler(builder) {
+          await triggerPrerendering(builder.config)
+        },
+      },
       writeBundle: {
         /* We can't use this because it breaks Vite's logging. TO-DO/eventually: try again with latest Vite version.
         sequential: true,
@@ -104,7 +99,6 @@ function pluginBuildApp(): Plugin[] {
           try {
             handleAssetsManifest_assertUsageCssTarget(config, this.environment)
             await handleAssetsManifest(config, this.environment, options, bundle)
-            await triggerPrerendering(config, this.environment, bundle)
           } catch (err) {
             // We use try-catch also because:
             // - Vite/Rollup swallows errors thrown inside the writeBundle() hook. (It doesn't swallow errors thrown inside the first writeBundle() hook while building the client-side, but it does swallow errors thrown inside the second writeBundle() while building the server-side triggered after Vike calls Vite's `build()` API.)
@@ -119,6 +113,13 @@ function pluginBuildApp(): Plugin[] {
       name: 'vike:build:pluginBuildApp:autoFullBuild:post',
       apply: 'build',
       enforce: 'post',
+      // After the buildApp() hooks of other plugins, e.g. vite-plugin-vercel
+      buildApp: {
+        order: 'post',
+        async handler() {
+          if (isPrerenderForceExit()) runPrerender_forceExit()
+        },
+      },
       closeBundle: {
         sequential: true,
         order: 'post',
@@ -130,15 +131,9 @@ function pluginBuildApp(): Plugin[] {
   ]
 }
 
-async function triggerPrerendering(config: ResolvedConfig, viteEnv: Environment, bundle: Record<string, unknown>) {
+async function triggerPrerendering(config: ResolvedConfig) {
   const vikeConfig = await getVikeConfigInternal()
-  if (!isViteServerSide_onlySsrEnv(config, viteEnv)) return
   if (isDisabled(vikeConfig)) return
-  // Workaround for @vitejs/plugin-legacy
-  //  - The legacy plugin triggers its own Rollup build for the client-side.
-  //  - The legacy plugin doesn't generate a manifest => we can use that to detect the legacy plugin build.
-  //  - Issue & reproduction: https://github.com/vikejs/vi
```

**File**: `test/playground/vite.config.ts` (modified, +6/-2)
```diff
@@ -35,8 +35,12 @@ async function testPlugin(): Promise<PluginOption> {
       vike = getVikeConfig(config as any)
       testVikeConfig(vike)
     },
-    closeBundle() {
-      testPrerenderSettings(vike)
+    // After Vike's pre-rendering
+    buildApp: {
+      order: 'post',
+      async handler() {
+        testPrerenderSettings(vike)
+      },
     },
   }
 }
```

---

### Incident Patch 4: `5fb3117d` (2026-10-01)
**Commit Message**: fix: require Vite 7.1 or above (#3565)

BREAKING CHANGE: Update Vite 7.1 or above

**File**: `examples/auth/package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "typescript": "^7.0.2",
     "vike": "0.4.267",
     "vike-react": "^0.6.29",
-    "vite": "^6.3.2"
+    "vite": "^7.3.1"
   },
   "type": "module"
 }
```

**File**: `examples/base-url-cdn/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
     "express": "^5.2.1",
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
-    "vite": "^6.3.2",
+    "vite": "^7.3.1",
     "vike": "0.4.267"
   },
   "type": "module"
```

**File**: `examples/base-url-server/package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
     "vike": "0.4.267",
-    "vite": "^6.3.2"
+    "vite": "^7.3.1"
   },
   "type": "module"
 }
```

**File**: `examples/base-url/package.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
     "vike": "0.4.267",
-    "vite": "^6.3.2"
+    "vite": "^7.3.1"
   },
   "type": "module"
 }
```

**File**: `examples/custom-preload/package.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
     "vike": "0.4.267",
-    "vite": "^6.3.2"
+    "vite": "^7.3.1"
   },
   "type": "module"
 }
```

**File**: `examples/file-structure-domain-driven/package.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
     "vike": "0.4.267",
-    "vite": "^6.3.2"
+    "vite": "^7.3.1"
   },
   "type": "module"
 }
```

**File**: `examples/html-fragments/package.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "dependencies": {
     "typescript": "^7.0.2",
     "vike": "0.4.267",
-    "vite": "^6.3.2"
+    "vite": "^7.3.1"
   },
   "type": "module"
 }
```

**File**: `examples/i18n/package.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
     "vike": "0.4.267",
-    "vite": "^6.3.2"
+    "vite": "^7.3.1"
   },
   "type": "module"
 }
```

---

### Incident Patch 5: `255c953c` (2026-10-01)
**Commit Message**: fix: check each environment's build input for HTML entries (#3561)

**File**: `packages/vike/src/node/vite/plugins/build/pluginBuildConfig.ts` (modified, +4/-4)
```diff
@@ -12,7 +12,7 @@ import { unique } from '../../../../utils/unique.js'
 import { objectMap } from '../../../../utils/objectMap.js'
 import { getVikeConfigInternal } from '../../shared/resolveVikeConfigInternal.js'
 import { findPageFiles } from '../../shared/findPageFiles.js'
-import type { ResolvedConfig, Plugin } from 'vite'
+import type { ResolvedConfig, Plugin, Rollup } from 'vite'
 import { generateVirtualFileId } from '../../../../shared-server-node/virtualFileId.js'
 import type { PageConfigBuildTime } from '../../../../types/PageConfig.js'
 import type { FileType } from '../../../../shared-server-client/getPageFiles/fileTypes.js'
@@ -41,12 +41,12 @@ function pluginBuildConfig(): Plugin[] {
         async handler(config) {
           handleAssetsManifest_alignCssTarget(config)
           onSetupBuild()
-          assertRollupInput(config)
           const entriesClient = await getEntries(config, false)
           const entriesServer = await getEntries(config, true)
           for (const [envName, envConfig] of Object.entries(config.environments)) {
             const entries = isViteServerSide_configEnvironment(envName, envConfig) ? entriesServer : entriesClient
             assert(Object.keys(entries).length > 0)
+            assertRollupInput(envConfig.build.rollupOptions.input)
             envConfig.build.rollupOptions.input = injectRollupInputs(entries, envConfig.build.rollupOptions.input)
           }
           addLogHook()
@@ -250,8 +250,8 @@ function addLogHook() {
   })
 }
 
-function assertRollupInput(config: ResolvedConfig): void {
-  const userInputs = normalizeRollupInput(config.build.rollupOptions.input)
+function assertRollupInput(input: Rollup.InputOption | undefined): void {
+  const userInputs = normalizeRollupInput(input)
   const htmlInputs = Object.values(userInputs).filter((entry) => entry.endsWith('.html') || entry.endsWith('.htm'))
   const htmlInput = htmlInputs[0]
   assertUsage(
```

**File**: `packages/vike/src/node/vite/plugins/pluginCommon.ts` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ function pluginCommon(vikeVitePluginOptions: unknown): Plugin[] {
           overrideViteDefaultSsrExternal(config)
           //*/
           workaroundCI(config)
-          assertRollupInput(config)
+          assertRollupInput(config.build.rollupOptions.input)
           assertResolveAlias(config)
           temp_supportOldInterface(config)
           await emitServerEntryOnlyIfNeeded(config)
```

---

### Incident Patch 6: `732a6e54` (2026-10-01)
**Commit Message**: fix: name build.assetsDir in its empty-string error (#3562)

**File**: `packages/vike/src/node/vite/shared/getAssetsDir.ts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import '../assertEnvVite.js'
 
 function getAssetsDir(build: { assetsDir: string }) {
   let { assetsDir } = build
-  assertUsage(assetsDir, `${assetsDir} cannot be an empty string`)
+  assertUsage(assetsDir, "Vite's build.assetsDir cannot be an empty string")
   assetsDir = assetsDir.split(/\/|\\/).filter(Boolean).join('/')
   return assetsDir
 }
```

---

### Incident Patch 7: `69fb85b2` (2026-10-01)
**Commit Message**: fix: don't add a trailing slash to URLs with a file extension (#3560)

**File**: `docs/pages/url-normalization/+Page.mdx` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ You can configure whether URLs are normalized and whether URLs should end with a
 import type { Config } from 'vike/types'
 
 export default {
-  // Make URLs end with a trailing slash.
+  // Make URLs end with a trailing slash, except URLs with a known file extension (e.g. /feed.atom).
   // For example: /some//path -> /some/path/
   trailingSlash: true,
 
```

**File**: `packages/vike/src/server/runtime/renderPageServer/createHttpResponse.ts` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ import type { HtmlRender } from './html/renderHtml.js'
 import type { StreamReadableWeb } from './html/stream.js'
 import { getErrorPageId, isErrorPage } from '../../../shared-server-client/error-page.js'
 import type { Content, RenderHook } from './execHookOnRenderHtml.js'
-import { getContentTypeFromUrl } from './getContentTypeFromUrl.js'
+import { getContentTypeFromUrl } from '../../../utils/getContentTypeFromUrl.js'
 import type {
   RedirectStatusCode,
   AbortStatusCode,
@@ -84,7 +84,7 @@ function createHttpResponsePageContent(
   const statusCode = getStatusCode(pageContext)
   const headers = resolveHeadersResponseFinal(pageContext, statusCode)
   if (!headers.some(([k]) => k.toLowerCase() === 'content-type')) {
-    headers.push(['Content-Type', getContentTypeFromUrl(pageContext.urlOriginal)])
+    headers.push(['Content-Type', getContentTypeFromUrl(pageContext.urlOriginal) ?? 'application/octet-stream'])
   }
   return createHttpResponseCommon(statusCode, headers, content, [], renderHook)
 }
```

**File**: `packages/vike/src/utils/getContentTypeFromUrl.ts` (renamed, +7/-5)
```diff
@@ -1,7 +1,9 @@
 export { getContentTypeFromUrl }
 
-import { parseUrl } from '../../../utils/parseUrl.js'
-import '../../assertEnvServer.js'
+import { parseUrl } from './parseUrl.js'
+import { assertIsNotBrowser } from './assertIsNotBrowser.js'
+
+assertIsNotBrowser()
 
 const contentTypes = new Map(
   Object.entries({
@@ -32,12 +34,12 @@ const contentTypes = new Map(
   }),
 )
 
-// Default Content-Type of `pageContext.content`, see https://vike.dev/pageContext#content
-function getContentTypeFromUrl(url: string): string {
+// Content-Type of the URL's file extension, or `null` if unknown, see https://vike.dev/pageContext#content
+function getContentTypeFromUrl(url: string): string | null {
   const { pathname } = parseUrl(url, '/')
   // Last non-empty segment, see https://vike.dev/url-normalization
   const fileName = pathname.split('/').filter(Boolean).pop() ?? ''
   const i = fileName.lastIndexOf('.')
   const fileExtension = i > 0 ? fileName.slice(i + 1).toLowerCase() : null
-  return (fileExtension && contentTypes.get(fileExtension)) || 'application/octet-stream'
+  return (fileExtension && contentTypes.get(fileExtension)) || null
 }
```

**File**: `packages/vike/src/utils/parseUrl-extras.spec.ts` (modified, +6/-0)
```diff
@@ -26,6 +26,12 @@ describe('normalizeUrlPathname()', () => {
     // Works as usual
     expect(normalizeUrlPathname('/foo/', false, '/foo')).toBe('/foo')
   })
+  it('file URL with trailingSlash', () => {
+    expect(normalizeUrlPathname('/feed.atom', true, '/')).toBe(null)
+    expect(normalizeUrlPathname('/feed.atom/', true, '/')).toBe('/feed.atom')
+    // Not a known file extension
+    expect(normalizeUrlPathname('/v1.2', true, '/')).toBe('/v1.2/')
+  })
   function n(urlOriginal: string) {
     return normalizeUrlPathname(urlOriginal, false, '/')
   }
```

**File**: `packages/vike/src/utils/parseUrl-extras.ts` (modified, +3/-0)
```diff
@@ -11,6 +11,7 @@ import { assertUrlComponents, createUrlFromComponents, isBaseServer, parseUrl }
 import { assert } from './assert.js'
 import { slice } from './slice.js'
 import { assertIsNotBrowser } from './assertIsNotBrowser.js'
+import { getContentTypeFromUrl } from './getContentTypeFromUrl.js'
 assertIsNotBrowser()
 
 function prependBase(url: string, baseServer: string): string {
@@ -70,6 +71,8 @@ function normalizeUrlPathname(urlOriginal: string, trailingSlash: boolean, baseS
     if (urlPathnameNormalized === '/') {
       return urlPathnameNormalized
     }
+    // A file URL such as /feed.atom doesn't get a trailing slash
+    if (getContentTypeFromUrl(urlPathnameNormalized)) trailingSlash = false
     // If the Base URL has a trailing slash, then Vite (as of vite@5.0.0-beta.19) expects the root URL to also have a trailing slash, see https://github.com/vikejs/vike/issues/1258#issuecomment-1812226260
     if (baseServer.endsWith('/') && baseServer !== '/' && normalize(baseServer) === urlPathnameNormalized) {
       trailingSlash = true
```

---

### Incident Patch 8: `24ac6b5e` (2026-10-01)
**Commit Message**: fix: propagate stream cancellation (#3556)

**File**: `packages/vike/src/server/runtime/renderPageServer/html/stream.spec.ts` (modified, +138/-1)
```diff
@@ -1,5 +1,14 @@
-import { awaitFirstChunk, streamReadableWebToBytes } from './stream.js'
+import {
+  awaitFirstChunk,
+  pipeToStreamWritableNode,
+  processStream,
+  stampPipe,
+  streamReadableWebToBytes,
+  type StreamPipeNode,
+  type StreamPipeWeb,
+} from './stream.js'
 import { expect, describe, it } from 'vitest'
+import { Readable, Writable } from 'node:stream'
 
 describe('streamReadableWebToBytes', () => {
   it('concatenates the chunks without decoding them', async () => {
@@ -78,3 +87,131 @@ describe('awaitFirstChunk', () => {
     expect(reason).toBe('Some reason')
   })
 })
+
+const opts = { onErrorWhileStreaming() {} }
+const sleep = (ms?: number) => new Promise((r) => setTimeout(r, ms))
+
+describe('processStream', () => {
+  it('cancels the original Web stream', async () => {
+    let reason: unknown
+    const stream = new ReadableStream<Uint8Array>({
+      start(controller) {
+        controller.enqueue(new Uint8Array([1]))
+      },
+      cancel(r) {
+        reason = r
+      },
+    })
+    const streamWrapper = (await processStream(stream, opts)) as ReadableStream
+    await streamWrapper.cancel('Some reason')
+    expect(reason).toBe('Some reason')
+  })
+
+  it("cancels react-streaming's Web stream", async () => {
+    let cancelled = false
+    const readable = new ReadableStream({
+      start(c) {
+        c.enqueue(new Uint8Array([1]))
+      },
+      cancel() {
+        cancelled = true
+      },
+    })
+    const streamReactStreaming = { readable, pipe: null, injectToStream() {}, hasStreamEnded: () => false }
+    const streamWrapper = (await processStream(streamReactStreaming as never, opts)) as ReadableStream
+    await streamWrapper.cancel()
+    expect(cancelled).toBe(true)
+  })
+})
+
+describe('the response', () => {
+  const response = () => new Writable({ write: (_chunk, _encoding, callback) => callback() })
+
+  it('stops the source if the response is already closed', async () => {
+    const [closedResponse1, closedResponse2] = [response().destroy(), response().destroy()]
+    await sleep() // Let them emit 'close'
+    let cancelled = false
+    const stream = new ReadableStream({
+      start(controller) {
+        controller.enqueue(new Uint8Array([1]))
+      },
+      cancel() {
+        cancelled = true
+      },
+    })
+    pipeToStreamWritableNode(await processStream(stream, opts), closedResponse1)
+    let closed = false
+    const pipe: StreamPipeNode = (writable) => {
+      writable.write('a')
+      writable.on('close', () => (closed = true))
+    }
+    stampPipe(pipe, 'node-stream')
+    ;((await processStream(pipe, opts)) as StreamPipeNode)(closedResponse2)
+    await sleep(10)
+    expect({ cancelled, closed }).toEqual({ cancelled: true, closed: true })
+  })
+
+  it('stops every kind of source when the response closes early', async () => {
+    const stopped: string[] = []
+    const readableWeb = new ReadableStream({
+      async pull(controller) {
+        await sleep()
+        controller.enqueue(new Uint8Array([1]))
+      },
+      cancel: () => void stopped.push('readable web'),
+    })
+    const readable = new Readable({ read() {} })
+    readable.push('a')
+    readable.on('close', () => stopped.push('readable'))
+    const pipeNode: StreamPipeNode = (writable) => {
+      writable.write('a')
+      writable.on('close', () => stopped.push('pipe node'))
+    }
+    stampPipe(pipeNode, 'node-stream')
+    const pipeWeb: StreamPipeWeb = (writable) => {
+      const writer = writable.getWriter()
+      writer.write(new Uint8Array([1]))
+      writer.closed.catch(() => stopped.push('pipe web'))
+    }
+    stampPipe(pipeWeb, 'web-stream')
+    const responses = [response(), response(), response()] as const
+    pipeToStreamWritableNode(await processStream(readableWeb, opts), responses[0])
+    pipeToStreamWritableNode(await processStream(readable, opts), responses[1])
+    ;((await processStream(pipeNode, opts)) as StreamPipeNode)(responses[2])
+    const { readable: responseWeb, writable } = new TransformStream()
+    ;((await processStream(pipeWeb, opts)) as StreamPipeWeb)(writable)
+    await sleep(10)
+    responses.forEach((res) => res.destroy())
+    await responseWeb.cancel()
+    await sleep(10)
+    expect(stopped.sort()).toEqual(['pipe node', 'pipe web', 'readable', 'readable web'])
+  })
+
+  it('is destroyed if the stream closes before its end', async () => {
+    const readable = new Readable({ read() {} })
+    readable.push('a')
+    const res = response()
+    pipeToStreamWritableNode(readable, res)
+    await sleep(10)
+    readable.destroy()
+    await sleep(10)
+    expect(res.destroyed).toBe(true)
+  })
+
+  it('is destroyed if the stream errors', async () => {
+    let pulls = 0
+    const stream = new ReadableStream({
+      pull(controller) {
+        if (pulls++ === 0) controller.enqueue(new Uint8Array([1]))
+        else controller.error(new Error('Some error'))
+      },
+    })
+    const res = response()
+   
```

**File**: `packages/vike/src/server/runtime/renderPageServer/html/stream.ts` (modified, +28/-33)
```diff
@@ -142,8 +142,6 @@ async function streamReadableWebToBytes(readableWeb: ReadableStream): Promise<Ui
   }
   return bytes
 }
-// The Web Readable wrapper of processStream() doesn't support cancel()
-const streamsCancelable = new WeakSet<ReadableStream>()
 // Resolves after the first chunk (rejects if the stream errors before), then reads on demand
 async function awaitFirstChunk(
   stream: StreamReadableWeb,
@@ -172,7 +170,6 @@ async function awaitFirstChunk(
       return reader.cancel(reason)
     },
   })
-  streamsCancelable.add(streamStarted)
   return streamStarted
 }
 async function stringToStreamReadableNode(str: string | Uint8Array): Promise<StreamReadableNode> {
@@ -265,7 +262,7 @@ async function getStreamReadableNode(htmlRender: HtmlRender | Uint8Array): Promi
   if (isStreamReadableNode(htmlRender)) {
     return htmlRender
   }
-  if (isStreamReadableWeb(htmlRender) && streamsCancelable.has(htmlRender)) {
+  if (isStreamReadableWeb(htmlRender)) {
     return streamReadableWebToStreamReadableNode(htmlRender)
   }
   return null
@@ -317,25 +314,20 @@ function pipeToStreamWritableNode(htmlRender: HtmlRender | Uint8Array, writable:
     streamPipeNode(writable)
     return true
   }
-  if (isStreamReadableNode(htmlRender)) {
-    htmlRender.pipe(writable)
-    return true
-  }
   if (isStreamPipeNode(htmlRender)) {
     const streamPipeNode = getStreamPipeNode(htmlRender)
     assert(streamPipeNode)
     streamPipeNode(writable)
     return true
   }
-  if (isStreamReadableWeb(htmlRender)) {
-    streamReadableWebToStreamReadableNode(htmlRender).then(async (s) => {
-      if (streamsCancelable.has(htmlRender)) {
-        const { pipeline } = await loadStreamNodeModule()
-        // Unlike pipe(), pipeline() destroys the readable (and thus cancels the stream) if the writable closes early, and the writable if the stream errors
-        pipeline(s, writable, () => {})
-      } else {
-        s.pipe(writable)
-      }
+  if (isStreamReadableNode(htmlRender) || isStreamReadableWeb(htmlRender)) {
+    getStreamReadableNode(htmlRender).then(async (readable) => {
+      assert(readable)
+      const { pipeline } = await loadStreamNodeModule()
+      // pipeline() throws if the writable is already destroyed (e.g. the client left before the first chunk)
+      if (writable.destroyed) return readable.destroy()
+      // Unlike pipe(), pipeline() destroys the readable if the writable closes early, and the writable if the readable errors or closes before its end
+      pipeline(readable, writable, () => {})
     })
     return true
   }
@@ -560,6 +552,9 @@ async function createStreamWrapper({
     const pipeProxy: StreamPipeNode = (writable_: StreamWritableNode) => {
       writableOriginal = writable_
       debug('original Node.js Writable received')
+      // Let the source know when the response closes early (no-op once it has ended)
+      if (writableOriginal.destroyed) writableProxy.destroy()
+      else writableOriginal.on('close', () => writableProxy.destroy())
       onReadyToWrite()
       if (hasEnded) {
         // onReadyToWrite() already wrote everything; we can close the stream right away
@@ -629,6 +624,8 @@ async function createStreamWrapper({
     const pipeProxy: StreamPipeWeb = (writableOriginal: StreamWritableWeb) => {
       writerOriginal = writableOriginal.getWriter()
       debug('original Web Writable received')
+      // Let the source know when the response closes early
+      writerOriginal.closed.catch((err) => readerProxy?.cancel(err))
       ;(async () => {
         // CloudFlare Workers does not implement `ready` property
         //  - https://github.com/vuejs/vue-next/issues/4287
@@ -645,7 +642,7 @@ async function createStreamWrapper({
     stampPipe(pipeProxy, 'web-stream')
     const writeChunk = (chunk: unknown) => {
       assert(writerOriginal)
-      writerOriginal.write(encodeForWebStream(chunk))
+      writerOriginal.write(encodeForWebStream(chunk)).catch(() => {})
       debugWithChunk('data written (Web Writable)', chunk)
     }
     // Web Streams have compression built-in
@@ -657,11 +654,12 @@ async function createStreamWrapper({
     const endStream = () => {
       hasEnded = true
       if (writerOriginal) {
-        writerOriginal.close()
+        writerOriginal.close().catch(() => {})
       }
     }
 
     let writableProxy: WritableStream<unknown>
+    let readerProxy: undefined | ReadableStreamDefaultReader
     if (typeof ReadableStream !== 'function') {
       writableProxy = new WritableStream({
         write(chunk) {
@@ -679,7 +677,8 @@ async function createStreamWrapper({
     } else {
       const { readable, writable } = new TransformStream()
       writableProxy = writable
-      handleReadableWeb(readable, {
+      readerProxy = readable.getReader()
+      handleReadableWeb(readerProxy, {
         onData,
         onError(err) {
           onError(err)
@@ -701,7 +700,7 @@ async function createStreamWrapper({
   if (isStreamReadableWeb(streamOrig
```

---

### Incident Patch 9: `b0601482` (2026-10-01)
**Commit Message**: fix: don't set Vike's entry file names on other server environments (#3559)

**File**: `packages/vike/src/node/vite/plugins/build/pluginDistFileNames.ts` (modified, +9/-3)
```diff
@@ -32,7 +32,7 @@ function pluginDistFileNames(): Plugin[] {
             const { build } = envConfig
             copyRollupOutputs(build)
             const isServerSide = isViteServerSide_configEnvironment(envName, envConfig)
-            setFileNames(config, build, isServerSide)
+            setFileNames(config, build, isServerSide, envName)
             disableCSSBundling(config, build)
           })
         },
@@ -41,11 +41,17 @@ function pluginDistFileNames(): Plugin[] {
   ]
 }
 
-function setFileNames(config: ResolvedConfig, build: ResolvedBuildEnvironmentOptions, isServerSide: boolean) {
+function setFileNames(
+  config: ResolvedConfig,
+  build: ResolvedBuildEnvironmentOptions,
+  isServerSide: boolean,
+  envName: string,
+) {
   const rollupOutputs = getRollupOutputs(build)
   // We need to support multiple outputs: @vite/plugin-legacy adds an output, see https://github.com/vikejs/vike/issues/477#issuecomment-1406434802
   rollupOutputs.forEach((rollupOutput) => {
-    if (!('entryFileNames' in rollupOutput)) {
+    // Server environments other than `ssr` keep their own entry file names, e.g. @vitejs/plugin-rsc imports its `rsc` entry as `index.js`
+    if (!('entryFileNames' in rollupOutput) && (!isServerSide || envName === 'ssr')) {
       rollupOutput.entryFileNames = (chunkInfo) => getEntryFileName(chunkInfo, config, build, isServerSide, true)
     }
     if (!('chunkFileNames' in rollupOutput)) {
```

---

### Incident Patch 10: `033cb69d` (2026-09-30)
**Commit Message**: fix: preserve cookies on redirects and client-side navigation (#3552)

**File**: `docs/pages/renderPage/+Page.mdx` (modified, +5/-1)
```diff
@@ -73,7 +73,11 @@ async function startServer() {
     const pageContext = await renderPage(pageContextInit)
 
     const { body, statusCode, headers } = pageContext.httpResponse
-    headers.forEach(([name, value]) => res.setHeader(name, value))
+    headers.forEach(([name, value]) => {
+      // There can be several Set-Cookie headers: res.setHeader() would only keep the last one
+      if (name.toLowerCase() === 'set-cookie') res.appendHeader(name, value)
+      else res.setHeader(name, value)
+    })
     res.status(statusCode).send(body)
   })
 
```

**File**: `packages/vike/src/node/vite/shared/addSsrMiddleware.ts` (modified, +12/-1)
```diff
@@ -2,6 +2,7 @@ export { addSsrMiddleware }
 
 import { type PageContextInitInternal, renderPageServer } from '../../../server/runtime/renderPageServer.js'
 import type { ResolvedConfig, ViteDevServer } from 'vite'
+import type { ServerResponse } from 'node:http'
 import { assertWarning } from '../../../utils/assert.js'
 import pc from '@brillout/picocolors'
 import '../assertEnvVite.js'
@@ -63,8 +64,18 @@ function addSsrMiddleware(
     }
 
     const { httpResponse } = pageContext
-    httpResponse.headers.forEach(([name, value]) => res.setHeader(name, value))
+    setHeadersWithMultipleCookies(res, httpResponse.headers)
     res.statusCode = httpResponse.statusCode
     httpResponse.pipe(res)
   })
 }
+
+// A response can have several Set-Cookie headers: res.setHeader() would only keep the last one
+function setHeadersWithMultipleCookies(res: ServerResponse, headers: [string, string][]) {
+  const cookies: string[] = []
+  headers.forEach(([name, value]) => {
+    if (name.toLowerCase() === 'set-cookie') cookies.push(value)
+    else res.setHeader(name, value)
+  })
+  if (cookies.length > 0) res.setHeader('set-cookie', cookies)
+}
```

**File**: `packages/vike/src/server/runtime/renderPageServer.ts` (modified, +3/-2)
```diff
@@ -341,7 +341,8 @@ async function renderPageServerEntryRecursive_onError(
       const handled = await handleAbort(
         errErrorPage,
         pageContextBegin,
-        pageContextNominalPageBegin,
+        // The error page is the page that aborted
+        pageContextErrorPageInit,
         requestId,
         pageContextErrorPageInit,
         globalContext,
@@ -685,7 +686,7 @@ async function handleAbort(
     } else {
       pageContextSerialized = getPageContextClientSerializedAbort(pageContextAbort, false)
     }
-    const httpResponse = await createHttpResponsePageJson(pageContextSerialized)
+    const httpResponse = await createHttpResponsePageJson(pageContextSerialized, pageContext)
     objectAssign(pageContext, { httpResponse })
     return { pageContextReturn: pageContext }
   }
```

**File**: `packages/vike/src/server/runtime/renderPageServer/createHttpResponse.ts` (modified, +28/-11)
```diff
@@ -15,13 +15,22 @@ import { assert, assertWarning } from '../../../utils/assert.js'
 import type { HtmlRender } from './html/renderHtml.js'
 import { getErrorPageId, isErrorPage } from '../../../shared-server-client/error-page.js'
 import type { RenderHook } from './execHookOnRenderHtml.js'
-import type { RedirectStatusCode, AbortStatusCode, UrlRedirect } from '../../../shared-server-client/route/abort.js'
+import type {
+  RedirectStatusCode,
+  AbortStatusCode,
+  UrlRedirect,
+  PageContextAborted,
+} from '../../../shared-server-client/route/abort.js'
 import { getHttpResponseBody, getHttpResponseBodyStreamHandlers, HttpResponseBody } from './getHttpResponseBody.js'
 import { getEarlyHints, type EarlyHint } from './getEarlyHints.js'
 import { assertNoInfiniteHttpRedirect } from './createHttpResponse/assertNoInfiniteHttpRedirect.js'
 import type { PageContextBegin } from '../renderPageServer.js'
 import type { GlobalContextServerInternal } from '../globalContext.js'
-import { resolveHeadersResponseFinal } from './headersResponse.js'
+import {
+  getHeadersSetCookieAborted,
+  resolveHeadersResponseFinal,
+  resolveHeadersResponseSetCookie,
+} from './headersResponse.js'
 import { stringify } from '@brillout/json-serializer/stringify'
 import '../../assertEnvServer.js'
 
@@ -53,6 +62,7 @@ async function createHttpResponsePage(
     _globalContext: GlobalContextServerInternal
     abortStatusCode?: AbortStatusCode
     headersResponse?: Headers
+    pageContextsAborted: PageContextAborted[]
   },
 ): Promise<HttpResponse> {
   let statusCode: StatusCode | undefined = pageContext.abortStatusCode
@@ -109,6 +119,7 @@ function createHttpResponseBaseIsMissing(urlOriginal: string, baseServer: string
 }
 function createHttpResponseErrorFallback(pageContext: {
   _globalContext: GlobalContextServerInternal
+  pageContextsAborted: PageContextAborted[]
 }) {
   const reason = (() => {
     const errorPageId = getErrorPageId(
@@ -121,27 +132,33 @@ function createHttpResponseErrorFallback(pageContext: {
       return 'no error page (https://vike.dev/error-page) is defined, make sure to create one' as const
     }
   })()
-  return createHttpResponseError_(reason)
+  // Cookies set before `throw redirect()` or `throw render()` are kept
+  return createHttpResponseError_(reason, getHeadersSetCookieAborted(pageContext))
 }
 function createHttpResponseErrorFallback_noGlobalContext() {
-  return createHttpResponseError_('no error page (https://vike.dev/error-page) could be rendered')
+  return createHttpResponseError_('no error page (https://vike.dev/error-page) could be rendered', [])
 }
-function createHttpResponseError_(reason: string): HttpResponse {
+function createHttpResponseError_(reason: string, headers: ResponseHeaders): HttpResponse {
   const httpResponse = createHttpResponse(
     500,
     contentTypeHtml,
-    [],
+    headers,
     getHtmlFallback('<p>An error occurred.</p>', `${htmlFallbackLog} Vike returned this HTML because ${reason}.`),
   )
   return httpResponse
 }
-function createHttpResponseErrorFallbackJson() {
-  const httpResponse = createHttpResponse(500, contentTypeJson, [], stringify({ serverSideError: true }))
+function createHttpResponseErrorFallbackJson(pageContext: { pageContextsAborted: PageContextAborted[] }) {
+  const headers = getHeadersSetCookieAborted(pageContext)
+  const httpResponse = createHttpResponse(500, contentTypeJson, headers, stringify({ serverSideError: true }))
   return httpResponse
 }
 
-async function createHttpResponsePageJson(pageContextSerialized: string) {
-  const httpResponse = createHttpResponse(200, contentTypeJson, [], pageContextSerialized, [], null)
+async function createHttpResponsePageJson(
+  pageContextSerialized: string,
+  pageContext: { headersResponse?: Headers; pageContextsAborted: PageContextAborted[] },
+) {
+  const headers = resolveHeadersResponseSetCookie(pageContext)
+  const httpResponse = createHttpResponse(200, contentTypeJson, headers, pageContextSerialized, [], null)
   return httpResponse
 }
 
@@ -150,7 +167,7 @@ function createHttpResponseRedirect({ url, statusCode }: UrlRedirect, pageContex
   assert(url)
   assert(statusCode)
   assert(300 <= statusCode && statusCode <= 399)
-  const headers: ResponseHeaders = [['Location', url]]
+  const headers: ResponseHeaders = [['Location', url], ...resolveHeadersResponseSetCookie(pageContextInit)]
   return createHttpResponse(
     statusCode,
     contentTypeHtml,
```

**File**: `packages/vike/src/server/runtime/renderPageServer/handleErrorWithoutErrorPage.ts` (modified, +3/-1)
```diff
@@ -7,6 +7,7 @@ import { createHttpResponseErrorFallback, createHttpResponseErrorFallbackJson }
 import pc from '@brillout/picocolors'
 import type { GetPageAssets } from './getPageAssets.js'
 import type { PageContextCreatedServer } from './createPageContextServer.js'
+import type { PageContextAborted } from '../../../shared-server-client/route/abort.js'
 import '../../assertEnvServer.js'
 
 // When the user hasn't defined _error.page.js
@@ -17,6 +18,7 @@ function handleErrorWithoutErrorPage<
     pageId: null
     _globalContext: GlobalContextServerInternal
     urlOriginal: string
+    pageContextsAborted: PageContextAborted[]
   },
 >(pageContext: PageContext) {
   assert(pageContext.pageId === null)
@@ -34,7 +36,7 @@ function handleErrorWithoutErrorPage<
   } else {
     const __getPageAssets: GetPageAssets = async () => []
     objectAssign(pageContext, { __getPageAssets })
-    const httpResponse = createHttpResponseErrorFallbackJson()
+    const httpResponse = createHttpResponseErrorFallbackJson(pageContext)
     objectAssign(pageContext, { httpResponse })
     return pageContext
   }
```

**File**: `packages/vike/src/server/runtime/renderPageServer/headersResponse.ts` (modified, +29/-7)
```diff
@@ -1,32 +1,54 @@
 export { resolveHeadersResponseEarly }
 export { resolveHeadersResponseFinal }
+export { resolveHeadersResponseSetCookie }
+export { getHeadersSetCookieAborted }
 
 import { addCspResponseHeader, PageContextCspNonce } from './csp.js'
 import { isCallable } from '../../../utils/isCallable.js'
 import { cacheControlDisable, getCacheControl } from './getCacheControl.js'
 import type { PageContextAfterPageEntryLoaded } from './loadPageConfigsLazyServerSide.js'
 import { getPageContextPublicServer } from './getPageContextPublicServer.js'
+import type { PageContextAborted } from '../../../shared-server-client/route/abort.js'
 import '../../assertEnvServer.js'
 
-function resolveHeadersResponseFinal(
-  pageContext: {
-    headersResponse?: Headers
-  },
-  statusCode: number,
-) {
+type PageContextHeadersResponse = {
+  headersResponse?: Headers
+  pageContextsAborted: PageContextAborted[]
+}
+
+// Headers of HTML page responses
+function resolveHeadersResponseFinal(pageContext: PageContextHeadersResponse, statusCode: number) {
   const headersResponse = pageContext.headersResponse || new Headers()
 
   // 5xx error pages are temporary and shouldn't be cached.
   // This overrides any previously set Cache-Control value.
   if (statusCode >= 500) headersResponse.set('Cache-Control', cacheControlDisable)
 
-  const headers: [string, string][] = []
+  const headers = getHeadersSetCookieAborted(pageContext)
   headersResponse.forEach((value, key) => {
     headers.push([key, value])
   })
   return headers
 }
 
+// Headers of `pageContext.json` and redirect responses: only `Set-Cookie` applies to them, the other headers (e.g. `Cache-Control` and `Content-Security-Policy`) are about the HTML page.
+function resolveHeadersResponseSetCookie(pageContext: PageContextHeadersResponse) {
+  const headersResponse = pageContext.headersResponse || new Headers()
+  const headers = getHeadersSetCookieAborted(pageContext)
+  headersResponse.getSetCookie().forEach((value) => {
+    headers.push(['set-cookie', value])
+  })
+  return headers
+}
+
+// Cookies set before `throw redirect()` or `throw render()` are kept. They're sent first, so that a cookie set again later wins.
+function getHeadersSetCookieAborted(pageContext: { pageContextsAborted: PageContextAborted[] }) {
+  return pageContext.pageContextsAborted.flatMap((pageContextAborted) => {
+    const { headersResponse } = pageContextAborted as { headersResponse?: Headers }
+    return (headersResponse?.getSetCookie() ?? []).map((value): [string, string] => ['set-cookie', value])
+  })
+}
+
 async function resolveHeadersResponseEarly(pageContext: PageContextAfterPageEntryLoaded & PageContextCspNonce) {
   const headersResponse = await resolveHeadersResponseConfig(pageContext)
   if (!headersResponse.get('Cache-Control')) {
```

**File**: `packages/vike/src/server/runtime/renderPageServer/renderPageServerAfterRoute.ts` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ async function renderPageServerAfterRoute<
       objectAssign(pageContext, { [isServerSideError]: true })
     }
     const pageContextSerialized: string = getPageContextClientSerialized(pageContext, false)
-    const httpResponse = await createHttpResponsePageJson(pageContextSerialized)
+    const httpResponse = await createHttpResponsePageJson(pageContextSerialized, pageContext)
     objectAssign(pageContext, { httpResponse })
     return pageContext
   }
```

---

### Incident Patch 11: `774e3ca6` (2026-09-30)
**Commit Message**: fix: support Vite's `builder.sharedConfigBuild: true` (#3546)

**File**: `packages/vike/package.json` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@
     "@brillout/import": "^0.2.6",
     "@brillout/json-serializer": "^0.5.25",
     "@brillout/picocolors": "^1.0.31",
-    "@brillout/vite-plugin-server-entry": "^0.7.21",
+    "@brillout/vite-plugin-server-entry": "^0.7.22",
     "@universal-deploy/store": "^0.2.2",
     "@universal-deploy/vite": "^0.1.13",
     "@universal-middleware/core": "^0.4.18",
```

**File**: `packages/vike/src/node/vite/plugins/build/handleAssetsManifest.ts` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ async function fixServerAssets(
 }
 async function copyAssets(filesToMove: string[], filesToRemove: string[], config: ResolvedConfig) {
   const { outDirClient, outDirServer } = getOutDirs(config, undefined)
-  const assetsDir = getAssetsDir(config)
+  const assetsDir = getAssetsDir(config.environments.ssr!.build)
   const assetsDirServer = path.posix.join(outDirServer, assetsDir)
   if (!filesToMove.length && !filesToRemove.length && !existsSync(assetsDirServer)) return
   assert(existsSync(assetsDirServer))
```

**File**: `packages/vike/src/node/vite/plugins/build/pluginBuildConfig.ts` (modified, +21/-9)
```diff
@@ -21,7 +21,7 @@ import { prependEntriesDir } from '../../../../shared-server-node/prependEntries
 import { getFilePathResolved, getFilePathUnresolved } from '../../shared/getFilePath.js'
 import type { FilePath } from '../../../../types/FilePath.js'
 import { getConfigValueBuildTime } from '../../../../shared-server-client/page-configs/getConfigValueBuildTime.js'
-import { isViteServerSide_viteEnvOptional } from '../../shared/isViteServerSide.js'
+import { isViteServerSide_configEnvironment } from '../../shared/isViteServerSide.js'
 import {
   handleAssetsManifest_assertUsageCssCodeSplit,
   handleAssetsManifest_getBuildConfig,
@@ -42,9 +42,13 @@ function pluginBuildConfig(): Plugin[] {
           handleAssetsManifest_alignCssTarget(config)
           onSetupBuild()
           assertRollupInput(config)
-          const entries = await getEntries(config)
-          assert(Object.keys(entries).length > 0)
-          config.build.rollupOptions.input = injectRollupInputs(entries, config)
+          const entriesClient = await getEntries(config, false)
+          const entriesServer = await getEntries(config, true)
+          for (const [envName, envConfig] of Object.entries(config.environments)) {
+            const entries = isViteServerSide_configEnvironment(envName, envConfig) ? entriesServer : entriesClient
+            assert(Object.keys(entries).length > 0)
+            envConfig.build.rollupOptions.input = injectRollupInputs(entries, envConfig.build.rollupOptions.input)
+          }
           addLogHook()
           handleAssetsManifest_assertUsageCssCodeSplit(config)
         },
@@ -66,16 +70,20 @@ function pluginBuildConfig(): Plugin[] {
   ]
 }
 
-async function getEntries(config: ResolvedConfig): Promise<Record<string, string>> {
+async function getEntries(config: ResolvedConfig, isServerSide: boolean): Promise<Record<string, string>> {
   const vikeConfig = await getVikeConfigInternal()
   const { _pageConfigs: pageConfigs } = vikeConfig
   // TO-DO/next-major-release: remove
-  const pageFileEntries = await getPageFileEntries(config, resolveIncludeAssetsImportedByServer(vikeConfig.config))
+  const pageFileEntries = await getPageFileEntries(
+    config,
+    resolveIncludeAssetsImportedByServer(vikeConfig.config),
+    isServerSide,
+  )
   assertUsage(
     Object.keys(pageFileEntries).length !== 0 || pageConfigs.length !== 0,
     'At least one page should be defined, see https://vike.dev/add',
   )
-  if (isViteServerSide_viteEnvOptional(config)) {
+  if (isServerSide) {
     const pageEntries = getPageEntries(pageConfigs)
     const entries = {
       ...pageFileEntries,
@@ -148,8 +156,12 @@ function analyzeClientEntries(pageConfigs: PageConfigBuildTime[], config: Resolv
 
 // Ensure Rollup creates entries for each page file, see https://github.com/vikejs/vike/issues/350
 // (Otherwise the page files may be missing in the client manifest.json)
-async function getPageFileEntries(config: ResolvedConfig, includeAssetsImportedByServer: boolean) {
-  const isForClientSide = !isViteServerSide_viteEnvOptional(config)
+async function getPageFileEntries(
+  config: ResolvedConfig,
+  includeAssetsImportedByServer: boolean,
+  isServerSide: boolean,
+) {
+  const isForClientSide = !isServerSide
   const fileTypes: FileType[] = isForClientSide ? ['.page', '.page.client'] : ['.page', '.page.server']
   if (isForClientSide && includeAssetsImportedByServer) {
     fileTypes.push('.page.server')
```

**File**: `packages/vike/src/node/vite/plugins/build/pluginDistFileNames.ts` (modified, +82/-53)
```diff
@@ -10,12 +10,13 @@ import { isCallable } from '../../../../utils/isCallable.js'
 import { assertPosixPath } from '../../../../utils/path.js'
 import path from 'node:path'
 import crypto from 'node:crypto'
-import type { Plugin, ResolvedConfig, Rollup } from 'vite'
+import type { Plugin, ResolvedBuildEnvironmentOptions, ResolvedConfig, Rollup } from 'vite'
 import type { OutputOptions as RolldownOutputOptions } from 'rolldown'
 import { getAssetsDir } from '../../shared/getAssetsDir.js'
 import { assertModuleId, getFilePathToShowToUserModule } from '../../shared/getFilePath.js'
 import '../../assertEnvVite.js'
 import { isVite8OrAbove } from '../../shared/isVite8OrAbove.js'
+import { isViteServerSide_configEnvironment } from '../../shared/isViteServerSide.js'
 type PreRenderedChunk = Rollup.PreRenderedChunk
 type PreRenderedAsset = Rollup.PreRenderedAsset
 
@@ -27,49 +28,71 @@ function pluginDistFileNames(): Plugin[] {
       enforce: 'post',
       configResolved: {
         handler(config) {
-          const rollupOutputs = getRollupOutputs(config)
-          // We need to support multiple outputs: @vite/plugin-legacy adds an output, see https://github.com/vikejs/vike/issues/477#issuecomment-1406434802
-          rollupOutputs.forEach((rollupOutput) => {
-            if (!('entryFileNames' in rollupOutput)) {
-              rollupOutput.entryFileNames = (chunkInfo) => getEntryFileName(chunkInfo, config, true)
-            }
-            if (!('chunkFileNames' in rollupOutput)) {
-              rollupOutput.chunkFileNames = (chunkInfo) => getChunkFileName(chunkInfo, config)
-            }
-            if (!('assetFileNames' in rollupOutput)) {
-              rollupOutput.assetFileNames = (chunkInfo) => getAssetFileName(chunkInfo, config)
-
-              // Sometimes applied twice => avoid assertUsage() error below
-              // - I don't know why it can be applied twice for the same config. It happened when there was multiple Vike instances installed with one instance being a link to ~/code/vike/packages/vike/
-              ;(rollupOutput.assetFileNames as any).isTheOneSetByVike = true
-              assert((rollupOutput.assetFileNames as any).isTheOneSetByVike)
-            } else {
-              // If a user needs this:
-              //  - assertUsage() that the naming provided by the user ends with `.[hash][extname]`
-              //    - It's needed for getHash() of handleAssetsManifest()
-              //    - Asset URLs should always contain a hash: it's paramount for caching assets.
-              //    - If rollupOutput.assetFileNames is a function then use a wrapper function to apply the assertUsage()
-              assertUsage(
-                (rollupOutput.assetFileNames as any).isTheOneSetByVike,
-                "Setting Vite's configuration build.rollupOptions.output.assetFileNames is currently forbidden. Reach out if you need to use it.",
-              )
-            }
+          Object.entries(config.environments).forEach(([envName, envConfig]) => {
+            const { build } = envConfig
+            copyRollupOutputs(build)
+            const isServerSide = isViteServerSide_configEnvironment(envName, envConfig)
+            setFileNames(config, build, isServerSide)
+            disableCSSBundling(config, build)
           })
-
-          disableCSSBundling(config)
         },
       },
     },
   ]
 }
 
+function setFileNames(config: ResolvedConfig, build: ResolvedBuildEnvironmentOptions, isServerSide: boolean) {
+  const rollupOutputs = getRollupOutputs(build)
+  // We need to support multiple outputs: @vite/plugin-legacy adds an output, see https://github.com/vikejs/vike/issues/477#issuecomment-1406434802
+  rollupOutputs.forEach((rollupOutput) => {
+    if (!('entryFileNames' in rollupOutput)) {
+      rollupOutput.entryFileNames = (chunkInfo) => getEntryFileName(chunkInfo, config, build, isServerSide, true)
+    }
+    if (!('chunkFileNames' in rollupOutput)) {
+      rollupOutput.chunkFileNames = (chunkInfo) => getChunkFileName(chunkInfo, build, isServerSide)
+    }
+    if (!('assetFileNames' in rollupOutput)) {
+      rollupOutput.assetFileNames = (chunkInfo) => getAssetFileName(chunkInfo, config, build)
+
+      // Sometimes applied twice => avoid assertUsage() error below
+      // - I don't know why it can be applied twice for the same config. It happened when there was multiple Vike instances installed with one instance being a link to ~/code/vike/packages/vike/
+      ;(rollupOutput.assetFileNames as any).isTheOneSetByVike = true
+      assert((rollupOutput.assetFileNames as any).isTheOneSetByVike)
+    } else {
+      // If a user needs this:
+      //  - assertUsage() that the naming provided by the user ends with `.[hash][extname]`
+      //    - It's needed for getHash() of handleAssetsManifest()
+      //    - Asset URLs should always contain a hash: it's paramount for caching assets.
+      //    - If rollupOutput.assetFileNames is a function then use a wrapp
```

**File**: `packages/vike/src/node/vite/plugins/build/pluginSuppressRollupWarning.ts` (modified, +14/-12)
```diff
@@ -14,20 +14,22 @@ function pluginSuppressRollupWarning(): Plugin[] {
       enforce: 'post',
       configResolved: {
         async handler(config) {
-          const onWarnOriginal = config.build.rollupOptions.onwarn
-          config.build.rollupOptions.onwarn = function (warning, warn) {
-            // Suppress
-            if (suppressUnusedImport(warning)) return
-            if (suppressEmptyBundle(warning)) return
-            if (suppressUseClientDirective(warning)) return
+          Object.values(config.environments).forEach(({ build }) => {
+            const onWarnOriginal = build.rollupOptions.onwarn
+            build.rollupOptions.onwarn = function (warning, warn) {
+              // Suppress
+              if (suppressUnusedImport(warning)) return
+              if (suppressEmptyBundle(warning)) return
+              if (suppressUseClientDirective(warning)) return
 
-            // Pass through
-            if (onWarnOriginal) {
-              onWarnOriginal.apply(this, arguments as any)
-            } else {
-              warn(warning)
+              // Pass through
+              if (onWarnOriginal) {
+                onWarnOriginal.apply(this, arguments as any)
+              } else {
+                warn(warning)
+              }
             }
-          }
+          })
         },
       },
     },
```

**File**: `packages/vike/src/node/vite/shared/getAssetsDir.ts` (modified, +2/-3)
```diff
@@ -1,11 +1,10 @@
 export { getAssetsDir }
 
-import type { ResolvedConfig } from 'vite'
 import { assertUsage } from '../../../utils/assert.js'
 import '../assertEnvVite.js'
 
-function getAssetsDir(config: ResolvedConfig) {
-  let { assetsDir } = config.build
+function getAssetsDir(build: { assetsDir: string }) {
+  let { assetsDir } = build
   assertUsage(assetsDir, `${assetsDir} cannot be an empty string`)
   assetsDir = assetsDir.split(/\/|\\/).filter(Boolean).join('/')
   return assetsDir
```

**File**: `packages/vike/src/utils/injectRollupInputs.ts` (modified, +3/-3)
```diff
@@ -1,15 +1,15 @@
 export { injectRollupInputs }
 export { normalizeRollupInput }
 
-import type { ResolvedConfig, Rollup } from 'vite'
+import type { Rollup } from 'vite'
 import { assert } from './assert.js'
 import { isObject } from './isObject.js'
 import { isArray } from './isArray.js'
 type InputOption = Rollup.InputOption
 type InputsMap = Record<string, string>
 
-function injectRollupInputs(inputsNew: InputsMap, config: ResolvedConfig): InputsMap {
-  const inputsCurrent = normalizeRollupInput(config.build.rollupOptions.input)
+function injectRollupInputs(inputsNew: InputsMap, inputCurrent: InputOption | undefined): InputsMap {
+  const inputsCurrent = normalizeRollupInput(inputCurrent)
   const input = {
     ...inputsNew,
     ...inputsCurrent,
```

**File**: `pnpm-lock.yaml` (modified, +11/-19)
```diff
@@ -843,8 +843,8 @@ importers:
         specifier: ^1.0.31
         version: 1.0.31
       '@brillout/vite-plugin-server-entry':
-        specifier: ^0.7.21
-        version: 0.7.21
+        specifier: ^0.7.22
+        version: 0.7.22
       '@universal-deploy/store':
         specifier: ^0.2.2
         version: 0.2.2(srvx@0.12.5)
@@ -2603,11 +2603,8 @@ packages:
     peerDependencies:
       typescript: '>=4.0.0'
 
-  '@brillout/vite-plugin-server-entry@0.7.18':
-    resolution: {integrity: sha512-j3neG+vaIZ2AbP2/vGgaIyJwrFIxlK3xd3Ey2EGBswCvAGeI4QSSfXGbb7R3b3H8223PgTTsWOZuZH0Y8Ope2w==}
-
-  '@brillout/vite-plugin-server-entry@0.7.21':
-    resolution: {integrity: sha512-HfCYkB/S3/vivuqZaatsV+H1RZGOSBA/ZOfosWbBHIZJnpoXj4hGNld/Qinr34qW9HQpOf0UA95pCmkJGFAIzw==}
+  '@brillout/vite-plugin-server-entry@0.7.22':
+    resolution: {integrity: sha512-83BZjKoD95Cn4kLMYGUx9By17Y9n1aQYNXzLjh4teZtNP8eDfXrSjHS028nPAW1nkTTkMc+sDtzsL/0JGnY48g==}
 
   '@bytecodealliance/preview2-shim@0.17.6':
     resolution: {integrity: sha512-n3cM88gTen5980UOBAD6xDcNNL3ocTK8keab21bpx1ONdA+ARj7uD1qoFxOWCyKlkpSi195FH+GeAut7Oc6zZw==}
@@ -8966,12 +8963,7 @@ snapshots:
       source-map-support: 0.5.21
       typescript: 7.0.2
 
-  '@brillout/vite-plugin-server-entry@0.7.18':
-    dependencies:
-      '@brillout/import': 0.2.6
-      '@brillout/picocolors': 1.0.31
-
-  '@brillout/vite-plugin-server-entry@0.7.21':
+  '@brillout/vite-plugin-server-entry@0.7.22':
     dependencies:
       '@brillout/import': 0.2.6
       '@brillout/picocolors': 1.0.31
@@ -9868,7 +9860,7 @@ snapshots:
 
   '@photonjs/core@0.1.22(@hattip/core@0.0.49)(@types/express@5.0.6)(srvx@0.12.5)(vite@7.3.1(@types/node@24.10.2)(jiti@2.6.1)(lightningcss@1.32.0)(terser@5.38.1)(tsx@4.20.6))':
     dependencies:
-      '@brillout/vite-plugin-server-entry': 0.7.21
+      '@brillout/vite-plugin-server-entry': 0.7.22
       '@universal-middleware/cloudflare': 0.4.12(@hattip/core@0.0.49)(@types/express@5.0.6)(srvx@0.12.5)
       '@universal-middleware/compress': 0.2.36
       '@universal-middleware/core': 0.4.18(@hattip/core@0.0.49)(@types/express@5.0.6)(hono@4.10.4)(srvx@0.12.5)
@@ -14612,7 +14604,7 @@ snapshots:
       '@brillout/import': 0.2.6
       '@brillout/json-serializer': 0.5.25
       '@brillout/picocolors': 1.0.31
-      '@brillout/vite-plugin-server-entry': 0.7.21
+      '@brillout/vite-plugin-server-entry': 0.7.22
       crossws: 0.4.12(srvx@0.12.5)
       es-module-lexer: 1.7.0
       magic-string: 0.30.21
@@ -14632,7 +14624,7 @@ snapshots:
       '@brillout/import': 0.2.6
       '@brillout/json-serializer': 0.5.25
       '@brillout/picocolors': 1.0.31
-      '@brillout/vite-plugin-server-entry': 0.7.21
+      '@brillout/vite-plugin-server-entry': 0.7.22
       crossws: 0.4.12(srvx@0.12.5)
       es-module-lexer: 1.7.0
       magic-string: 0.30.21
@@ -14652,7 +14644,7 @@ snapshots:
       '@brillout/import': 0.2.6
       '@brillout/json-serializer': 0.5.25
       '@brillout/picocolors': 1.0.31
-      '@brillout/vite-plugin-server-entry': 0.7.21
+      '@brillout/vite-plugin-server-entry': 0.7.22
       crossws: 0.4.12(srvx@0.12.5)
       es-module-lexer: 1.7.0
       magic-string: 0.30.21
@@ -14971,7 +14963,7 @@ snapshots:
   vike-photon@0.1.26(opyy2sjn7zkbv5qy6vtkiuqqne):
     dependencies:
       '@brillout/picocolors': 1.0.31
-      '@brillout/vite-plugin-server-entry': 0.7.18
+      '@brillout/vite-plugin-server-entry': 0.7.22
       '@photonjs/core': 0.1.22(@hattip/core@0.0.49)(@types/express@5.0.6)(srvx@0.12.5)(vite@7.3.1(@types/node@24.10.2)(jiti@2.6.1)(lightningcss@1.32.0)(terser@5.38.1)(tsx@4.20.6))
       '@photonjs/runtime': 0.1.17(@emnapi/core@1.10.0)(@emnapi/runtime@1.10.0)(@hattip/core@0.0.49)(@types/express@5.0.6)(rollup@4.43.0)(srvx@0.12.5)(vite@7.3.1(@types/node@24.10.2)(jiti@2.6.1)(lightningcss@1.32.0)(terser@5.38.1)(tsx@4.20.6))
       '@universal-middleware/compress': 0.2.36
@@ -15031,7 +15023,7 @@ snapshots:
   vike-server@1.0.25(@hattip/core@0.0.49)(@types/express@5.0.6)(srvx@0.12.5)(vike@packages+vike)(vite@7.3.1(@types/node@24.10.2)(jiti@2.6.1)(lightningcss@1.32.0)(terser@5.38.1)(tsx@4.20.6)):
     dependencies:
       '@brillout/picocolors': 1.0.31
-      '@brillout/vite-plugin-server-entry': 0.7.18
+      '@brillout/vite-plugin-server-entry': 0.7.22
       '@universal-middleware/compress': 0.2.36
       '@universal-middleware/core': 0.4.18(@hattip/core@0.0.49)(@types/express@5.0.6)(hono@4.10.4)(srvx@0.12.5)
       '@universal-middleware/elysia': 0.4.8(@hattip/core@0.0.49)(@types/express@5.0.6)(srvx@0.12.5)
```

---

### Incident Patch 12: `1f85b01b` (2026-09-29)
**Commit Message**: fix: always pass the public pageContext object to users (#3543)

BREAKING CHANGE: `pageContext.pageProps.is404` removed, use `pageContext.is404` instead

**File**: `packages/vike/src/client/runtime-client-routing/renderPageClient.ts` (modified, +6/-4)
```diff
@@ -458,7 +458,7 @@ async function renderPageClient(renderArgs: RenderArgs) {
     logAbort(err, !import.meta.env.DEV, pageContext)
     const pageContextAbort = errAbort._pageContextAbort
 
-    addNewPageContextAborted(pageContextsAborted, pageContext, pageContextAbort)
+    addNewPageContextAborted(pageContextsAborted, pageContext, pageContextAbort, getPageContextPublicClientMinimal)
 
     // throw render('/some-url')
     if (pageContextAbort._urlRewrite) {
@@ -619,7 +619,9 @@ async function getPageContextBegin(
     isFirstRender: boolean
   },
 ) {
-  const previousPageContext = globalObject.previousPageContext ?? null
+  const previousPageContext = globalObject.previousPageContext
+    ? getPageContextPublicClient(globalObject.previousPageContext)
+    : null
   const pageContext = await createPageContextClient(urlOriginal)
   objectAssign(pageContext, {
     isBackwardNavigation,
@@ -721,7 +723,7 @@ function getRenderCount(): number {
 }
 
 function getKeepScrollPositionSetting(
-  pageContext: PageContextConfig & PageContextRouted & Record<string, unknown>,
+  pageContext: PageContextPublicClient & PageContextRouted,
 ): false | string | string[] {
   const c = pageContext.from.configsStandard.keepScrollPosition
   if (!c) return false
@@ -730,7 +732,7 @@ function getKeepScrollPositionSetting(
   assert(configDefinedAt)
   const routeParameterList = getRouteStringParameterList(configDefinedAt)
   if (isCallable(val))
-    val = val(pageContext, {
+    val = val(getPageContextPublicClient(pageContext), {
       configDefinedAt: c.definedAt,
       /* We don't pass routeParameterList because it's useless: the user knows the parameter list.
       routeParameterList
```

**File**: `packages/vike/src/node/prerender/runPrerender.ts` (modified, +25/-5)
```diff
@@ -67,6 +67,8 @@ import {
 import { getOutDirsAllFromRootNormalized } from '../vite/shared/getOutDirs.js'
 import fs from 'node:fs'
 import { getPublicProxy } from '../../shared-server-client/getPublicProxy.js'
+import { getPageContextPublicServer } from '../../server/runtime/renderPageServer/getPageContextPublicServer.js'
+import { isObject } from '../../utils/isObject.js'
 import { getStaticRedirectsForPrerender } from '../../server/runtime/renderPageServer/resolveRedirects.js'
 import { updateType } from '../../utils/updateType.js'
 const docLink = 'https://vike.dev/i18n#pre-rendering'
@@ -780,6 +782,7 @@ async function callOnPrerenderStartHook(
   let result: unknown = await execHookSingleWithoutPageContext(onPrerenderStartHook, globalContext, () =>
     hookFn(prerenderContextPublic),
   )
+  prerenderContext.pageContexts = prerenderContext.pageContexts.map(getPageContextOriginal)
 
   // Before applying result
   prerenderContext.pageContexts.forEach((pageContext) => {
@@ -823,7 +826,7 @@ async function callOnPrerenderStartHook(
       hasProp(result.prerenderContext, 'pageContexts', 'array'),
     rightUsage,
   )
-  prerenderContext.pageContexts = result.prerenderContext.pageContexts as PageContext[]
+  prerenderContext.pageContexts = (result.prerenderContext.pageContexts as PageContext[]).map(getPageContextOriginal)
 
   prerenderContext.pageContexts.forEach((pageContext: { urlOriginal?: string; url?: string }) => {
     // TO-DO/next-major-release: remove
@@ -995,7 +998,7 @@ async function write(
   })
 
   if (onPagePrerender) {
-    await onPagePrerender(pageContext)
+    await onPagePrerender(getPageContextPublicPrerendered(pageContext))
   } else {
     const { promises } = await import('node:fs')
     const { writeFile, mkdir } = promises
@@ -1172,16 +1175,33 @@ function getPrerenderContextPublic(prerenderContext: PrerenderContext): Prerende
     })
   }
 
-  // Required because of https://vike.dev/i18n#pre-rendering
-  // - Thus, we have to let users access the original pageContext object => we cannot use ES proxies and we cannot use getPageContextPublicShared()
-  prerenderContext.pageContexts.forEach((pageContext) => {
+  prerenderContext.pageContexts = prerenderContext.pageContexts.map((pageContext) => {
+    // Required because of https://vike.dev/i18n#pre-rendering
+    // - Users copy pageContext, e.g. `{ ...pageContext, locale }`, and Vike renders the copies => the copies need to be original objects
     changeEnumerable(pageContext, '_isOriginalObject', true)
+    return getPageContextPublicServer(pageContext)
+  })
+  prerenderContext.output.forEach((file) => {
+    file.pageContext = getPageContextPublicPrerendered(file.pageContext)
   })
 
   const prerenderContextPublic = getPublicProxy(prerenderContext, 'prerenderContext')
   return prerenderContextPublic
 }
 
+// The user may return the public pageContext objects passed to +onPrerenderStart
+function getPageContextOriginal(pageContext: PageContext): PageContext {
+  const obj: unknown = pageContext
+  if (isObject(obj) && obj._isProxyObject) return obj._originalObject as PageContext
+  return pageContext
+}
+
+function getPageContextPublicPrerendered(pageContext: PageContextPrerendered): PageContextPrerendered {
+  // Pre-rendered redirects don't have any real pageContext object, but only a plain object `{ urlOriginal, pageId: null, is404: false, isRedirect: true }` which we cannot pass to getPageContextPublicServer() as it only accepts real pageContext objects (it asserts pageContext._isOriginalObject)
+  if (pageContext.isRedirect) return pageContext
+  return getPageContextPublicServer(pageContext as PageContext)
+}
+
 async function prerenderRedirects(
   globalContext: GlobalContextServerInternal,
   onComplete: (htmlFile: HtmlFile) => Promise<void>,
```

**File**: `packages/vike/src/server/runtime/renderPageServer.ts` (modified, +13/-2)
```diff
@@ -45,6 +45,7 @@ import {
   type GlobalContextServerInternal,
 } from './globalContext.js'
 import { handlePageContextRequestUrl } from './renderPageServer/handlePageContextRequestUrl.js'
+import { getPageContextPublicServer } from './renderPageServer/getPageContextPublicServer.js'
 import {
   type HttpResponse,
   createHttpResponse404,
@@ -124,7 +125,12 @@ async function renderPageServer<PageContextUserAdded extends {}, PageContextInit
 
   checkType<PageContextAfterRender>(pageContextFinish)
   assertPageContextFinish(pageContextFinish)
-  return pageContextFinish as any
+  return getPageContextReturn(pageContextFinish) as any
+}
+
+function getPageContextReturn(pageContextFinish: PageContextAfterRender) {
+  if (!hasProp(pageContextFinish, '_globalContext', 'object')) return pageContextFinish
+  return getPageContextPublicServer(pageContextFinish)
 }
 
 async function renderPageServerEntryOnceBegin(
@@ -646,7 +652,12 @@ async function handleAbort(
   const pageContextAbort = errAbort._pageContextAbort
   assert(pageContextAbort)
 
-  addNewPageContextAborted(pageContextBegin.pageContextsAborted, pageContextNominalPageBegin, pageContextAbort)
+  addNewPageContextAborted(
+    pageContextBegin.pageContextsAborted,
+    pageContextNominalPageBegin,
+    pageContextAbort,
+    getPageContextPublicServer,
+  )
 
   const pageContext = fork(pageContextBegin)
   const pageContextAddendumAbort = getPageContextAddendumAbort(pageContextBegin.pageContextsAborted)
```

**File**: `packages/vike/src/server/runtime/renderPageServer/execHookOnError.ts` (modified, +2/-2)
```diff
@@ -33,8 +33,8 @@ function execHookOnError(
   const hooks = getHooksFromPageConfigGlobalCumulative<unknown>(globalContext._pageConfigGlobal, 'onError')
   for (const hook of hooks) {
     try {
-      execHookSingleSync(hook, globalContext, pageContext, getPageContextPublicServer, () =>
-        hook.hookFn(err, pageContext),
+      execHookSingleSync(hook, globalContext, pageContext, getPageContextPublicServer, (pageContextPublic) =>
+        hook.hookFn(err, pageContextPublic),
       )
     } catch (hookErr) {
       console.error(hookErr)
```

**File**: `packages/vike/src/server/runtime/renderPageServer/html/serializeContext.ts` (modified, +0/-2)
```diff
@@ -11,7 +11,6 @@ import { getPropAccessNotation } from '../../../../utils/getPropAccessNotation.j
 import { assert, assertUsage, assertWarning } from '../../../../utils/assert.js'
 import { hasProp } from '../../../../utils/hasProp.js'
 import { isErrorPage } from '../../../../shared-server-client/error-page.js'
-import { addIs404ToPageProps } from '../../../../shared-server-client/addIs404ToPageProps.js'
 import pc from '@brillout/picocolors'
 import { NOT_SERIALIZABLE } from '../../../../shared-server-client/NOT_SERIALIZABLE.js'
 import type { UrlRedirect } from '../../../../shared-server-client/route/abort.js'
@@ -184,7 +183,6 @@ function getPassToClientPageContext(pageContext: {
   let passToClient = [...pageContext._passToClient, ...passToClientBuiltInPageContext]
   if (isErrorPage(pageContext.pageId, pageContext._globalContext._pageConfigs)) {
     assert(hasProp(pageContext, 'is404', 'boolean'))
-    addIs404ToPageProps(pageContext)
     passToClient.push(...pageToClientBuiltInPageContextError)
   }
   passToClient = unique(passToClient)
```

**File**: `packages/vike/src/shared-server-client/addIs404ToPageProps.ts` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-export { addIs404ToPageProps }
-
-import { assertWarning } from '../utils/assert.js'
-import { isObject } from '../utils/isObject.js'
-
-function addIs404ToPageProps(pageContext: Record<string, unknown>) {
-  addIs404(pageContext)
-}
-
-function addIs404(pageContext: Record<string, unknown>) {
-  if (pageContext.is404 === undefined || pageContext.is404 === null) return
-  const pageProps = pageContext.pageProps || {}
-  if (!isObject(pageProps)) {
-    assertWarning(false, 'pageContext.pageProps should be an object', { showStackTrace: true, onlyOnce: true })
-    return
-  }
-  pageProps.is404 = pageProps.is404 || pageContext.is404
-  pageContext.pageProps = pageProps
-}
```

**File**: `packages/vike/src/shared-server-client/getPageContextPublicShared.ts` (modified, +0/-3)
```diff
@@ -5,7 +5,6 @@ export type { PageContextPublicMinimum }
 import { assert, assertWarning } from '../utils/assert.js'
 import { compareString } from '../utils/compareString.js'
 import { isPropertyGetter } from '../utils/isPropertyGetter.js'
-import { addIs404ToPageProps } from './addIs404ToPageProps.js'
 import { getGlobalContextPublicShared } from './getGlobalContextPublicShared.js'
 import { getPublicProxy } from './getPublicProxy.js'
 import type { PageContextCreated } from './createPageContextShared.js'
@@ -17,8 +16,6 @@ function getPageContextPublicShared<PageContext extends PageContextPublicMinimum
   assert(!(pageContext as Record<string, unknown>).globalContext) // pageContext.globalContext should only be available to users — Vike itself should use pageContext._globalContext instead
   assert(pageContext._isOriginalObject) // ensure we preserve the original object reference
 
-  addIs404ToPageProps(pageContext)
-
   // TO-DO/next-major-release: remove
   if (!('_pageId' in pageContext)) {
     Object.defineProperty(pageContext, '_pageId', {
```

**File**: `packages/vike/src/shared-server-client/hooks/execHook.ts` (modified, +3/-3)
```diff
@@ -120,11 +120,11 @@ function execHookSingleSync<PageContext extends PageContextExecHook>(
   globalContext: GlobalContextPublicMinimum,
   pageContext: PageContext | null,
   getPageContextPublic: (pageContext: PageContext) => PageContext,
-  hookFnCaller?: () => unknown,
+  hookFnCaller?: (pageContextPublic: PageContext | null) => unknown,
 ) {
   const pageContextPublic = pageContext && getPageContextPublic(pageContext)
-  hookFnCaller ??= () => hook.hookFn(pageContextPublic!)
-  const hookReturn = execHookBase(hookFnCaller, hook, globalContext, pageContextPublic)
+  const call = hookFnCaller ? () => hookFnCaller(pageContextPublic) : () => hook.hookFn(pageContextPublic!)
+  const hookReturn = execHookBase(call, hook, globalContext, pageContextPublic)
   return { hookReturn }
 }
 
```

---

### Incident Patch 13: `3bf584b9` (2026-09-29)
**Commit Message**: fix: don't hang `vike dev` when a `+vite` plugin has cyclic objects (#3548)

Co-authored-by: Romuald Brillout <[REDACTED_EMAIL]>

**File**: `packages/vike/src/utils/deepEqual.spec.ts` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import { describe, expect, it } from 'vitest'
+import { deepEqual } from './deepEqual.js'
+
+describe('deepEqual()', () => {
+  it('compares cyclic objects, e.g. Vite plugins', () => {
+    const getPlugin = (name: string) => {
+      const manager: Record<string, unknown> = {}
+      manager.self = manager
+      return { name, api: { manager } }
+    }
+    const plugin = getPlugin('a')
+    expect(deepEqual(plugin, plugin)).toBe(true)
+    expect(deepEqual(plugin, getPlugin('a'))).toBe(true)
+    expect(deepEqual(plugin, getPlugin('b'))).toBe(false)
+  })
+})
```

**File**: `packages/vike/src/utils/deepEqual.ts` (modified, +21/-8)
```diff
@@ -1,9 +1,22 @@
-// https://stackoverflow.com/questions/201183/how-to-determine-equality-for-two-javascript-objects/32922084#32922084
-export function deepEqual(x: any, y: any): boolean {
-  const ok = Object.keys,
-    tx = typeof x,
-    ty = typeof y
-  return x && y && tx === 'object' && tx === ty
-    ? ok(x).length === ok(y).length && ok(x).every((key) => deepEqual(x[key], y[key]))
-    : x === y
+export { deepEqual }
+
+import { assertIsNotBrowser } from './assertIsNotBrowser.js'
+// If client-side needs it then use a more minimal version to save client-side KBs:
+// https://github.com/vikejs/vike/blob/165d572a5994ccd0e56e43fe2993b1cef117ee7f/packages/vike/src/utils/deepEqual.ts
+assertIsNotBrowser()
+
+function deepEqual(x: any, y: any): boolean {
+  return deepEqualCyclic(x, y, new Map())
+}
+
+// Supports cyclic objects, e.g. Vite plugins
+function deepEqualCyclic(x: any, y: any, seen: Map<object, Set<object>>): boolean {
+  if (x === y) return true
+  if (!x || !y || typeof x !== 'object' || typeof y !== 'object') return false
+  // A pair seen before is either being compared higher up (a cycle) or already found equal
+  const seenY = seen.get(x) ?? new Set<object>()
+  if (seenY.has(y)) return true
+  seen.set(x, seenY.add(y))
+  const keys = Object.keys(x)
+  return keys.length === Object.keys(y).length && keys.every((key) => deepEqualCyclic(x[key], y[key], seen))
 }
```

---

### Incident Patch 14: `0e4a2843` (2026-09-29)
**Commit Message**: fix: don't reject Vite CLI options (#3544)

Co-authored-by: Romuald Brillout <[REDACTED_EMAIL]>

**File**: `packages/vike/src/node/vite/shared/isViteCli.ts` (modified, +79/-89)
```diff
@@ -3,6 +3,8 @@ export { getViteCliArgs }
 export { getViteBuildCliArgs }
 export { getViteCliCommand }
 
+// Copied from Vite's CLI
+
 import { assert } from '../../../utils/assert.js'
 import { isObject } from '../../../utils/isObject.js'
 import { isToolCli } from '../../../utils/isToolCli.js'
@@ -20,52 +22,24 @@ type ConfigFromCli = { root: undefined | string; configFile: undefined | string
   }
 
 type ViteCommand = 'dev' | 'build' | 'optimize' | 'preview'
-function getViteCliCommand(): ViteCommand | null {
-  if (!isViteCli()) return null
-
-  let command: ViteCommand | undefined
-  const setCommand = (cmd: ViteCommand) => {
-    assert(command === undefined)
-    command = cmd
+type ViteCli = { command: ViteCommand; root: string | undefined; options: Record<string, unknown> }
+function parseViteCli(): ViteCli {
+  let viteCli: ViteCli | undefined
+  const onCommand = (command: ViteCommand) => (root: unknown, options: unknown) => {
+    assert(viteCli === undefined)
+    assert(root === undefined || typeof root === 'string')
+    assert(isObject(options))
+    // Same as Vite: duplicated options => the last value wins
+    for (const [key, value] of Object.entries(options)) {
+      if (Array.isArray(value)) options[key] = value[value.length - 1]
+    }
+    assert(options.config === undefined || typeof options.config === 'string')
+    viteCli = { command, root, options }
   }
 
-  // Copied & adapted from Vite
-  // https://github.com/vitejs/vite/blob/d3e7eeefa91e1992f47694d16fe4dbe708c4d80e/packages/vite/src/node/cli.ts#L186-L188
-  const cli = cac(desc)
-  // dev
-  cli
-    .command('[root]', desc)
-    .alias('serve')
-    .alias('dev')
-    .action(() => {
-      setCommand('dev')
-    })
-  // build
-  cli.command('build [root]', desc).action(() => {
-    setCommand('build')
-  })
-  // optimize
-  cli.command('optimize [root]', desc).action(() => {
-    setCommand('optimize')
-  })
-  // preview
-  cli.command('preview [root]', desc).action(() => {
-    setCommand('preview')
-  })
-
-  cli.parse()
-  assert(command)
-
-  return command
-}
-
-function getViteBuildCliArgs(): null | ConfigFromCli {
-  if (!isViteCli()) return null
-
-  // Copied & adapted from Vite
+  // We need to declare all Vite's options, otherwise cac consumes the next argument as the value of boolean options (e.g. `vite build --emptyOutDir some-root`).
   const cli = cac(desc)
   // Common configs
-  // https://github.com/vitejs/vite/blob/d3e7eeefa91e1992f47694d16fe4dbe708c4d80e/packages/vite/src/node/cli.ts#L169-L182
   cli
     .option('-c, --config <file>', desc)
     .option('--base <path>', desc)
@@ -75,47 +49,86 @@ function getViteBuildCliArgs(): null | ConfigFromCli {
     .option('-d, --debug [feat]', desc)
     .option('-f, --filter <filter>', desc)
     .option('-m, --mode <mode>', desc)
-  // Build configs
-  // https://github.com/vitejs/vite/blob/d3e7eeefa91e1992f47694d16fe4dbe708c4d80e/packages/vite/src/node/cli.ts#L286-L322
+  // dev
+  cli
+    .command('[root]', desc)
+    .alias('serve')
+    .alias('dev')
+    .option('--host [host]', desc)
+    .option('--port <port>', desc)
+    .option('--open [path]', desc)
+    .option('--cors', desc)
+    .option('--strictPort', desc)
+    .option('--force', desc)
+    .option('--experimentalBundle', desc)
+    // Options that this copy doesn't declare (e.g. added by newer Vite versions) are still validated by Vite's own CLI, which throws `Unknown option` for options Vite doesn't know
+    .allowUnknownOptions()
+    .action(onCommand('dev'))
+  // build
   cli
     .command('build [root]', desc)
     .option('--target <target>', desc)
     .option('--outDir <dir>', desc)
     .option('--assetsDir <dir>', desc)
     .option('--assetsInlineLimit <number>', desc)
     .option('--ssr [entry]', desc)
-    .option('--sourcemap', desc)
+    .option('--sourcemap [output]', desc)
     .option('--minify [minifier]', desc)
     .option('--manifest [name]', desc)
     .option('--ssrManifest [name]', desc)
     .option('--emptyOutDir', desc)
     .option('-w, --watch', desc)
     .option('--app', desc)
-    .action((root: unknown, options: unknown) => {
-      assert(isObject(options))
-      assert(root === undefined || typeof root === 'string')
-      assert(options.config === undefined || typeof options.config === 'string')
-      // https://github.com/vitejs/vite/blob/d3e7eeefa91e1992f47694d16fe4dbe708c4d80e/packages/vite/src/node/cli.ts#L331-L346
-      const buildOptions = cleanGlobalCLIOptions(cleanBuilderCLIOptions(options))
-      configFromCli = {
-        root,
-        base: options.base,
-        mode: options.mode,
-        configFile: options.config,
-        configLoader: options.configLoader,
-        logLevel: options.logLevel,
-        clearScreen: options.clearScreen,
-        build: buildOptions,
-        ...(options.app ? { builder: {} } : {}),
-      }
-    })
+    .allowUnknownOptions()
+    .action(onCommand('build'))
+  // optimize
+  cli.command('opti
```

---

### Incident Patch 15: `f29653b4` (2026-09-29)
**Commit Message**: fix: don't mistake other plugins' virtual modules for Vike page entries (#3545)

**File**: `packages/vike/src/node/vite/plugins/build/handleAssetsManifest.ts` (modified, +4/-1)
```diff
@@ -220,7 +220,10 @@ function getPageId(key: string) {
   // to:
   //   virtual:vike:page-entry:client:/pages/index
   // (This seems to be needed only for vitest tests that use Vite's build() API with an inline config.)
-  key = key.substring(key.indexOf('virtual:vike'))
+  const prefix = key.split('virtual:vike')[0]!
+  // Skip virtual modules wrapping a Vike virtual module, e.g. virtual:vite-rsc/client-references/group/facade:virtual:vike:page-entry:client:/pages/index
+  if (prefix && !prefix.endsWith('/')) return null
+  key = key.substring(prefix.length)
   const result = parseVirtualFileId(key)
   return result && result.type === 'page-entry' ? result.pageId : null
 }
```

#### Recent Merged Pull Requests:
- **PR #3573** (2026-10-05): chore(deps): bump @universal-middleware/node from 0.2.2 to 0.2.3 (@dependabot[bot])
- **PR #3572** (2026-10-05): chore(deps-dev): bump vitest from 5.0.2 to 5.0.3 (@dependabot[bot])
- **PR #3571** (2026-10-02): test: fix flaky history.pushState() test (@brillout)
- **PR #3570** (2026-10-02): test: fix flaky vike-react-zustand counter test (@brillout)
- **PR #3569** (2026-10-02): test: wait for the response log in the `pageContext.content` stream-error test (@nitedani)
- **PR #3568** (2026-10-02): minor refactor: replace `client: 'if-client-routing'` with a `clientRoutingOnly` modifier (@nitedani)
- **PR #3567** (2026-10-02): chore(deps-dev): bump @brillout/test-e2e from 0.6.23 to 0.6.24 (@dependabot[bot])
- **PR #3566** (2026-10-02): chore(deps): bump @universal-deploy/vite from 0.1.13 to 0.1.14 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

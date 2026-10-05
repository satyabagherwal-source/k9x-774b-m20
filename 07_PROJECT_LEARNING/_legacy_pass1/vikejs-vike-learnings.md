# Forensic Learning Record (Deep Inspection): vikejs/vike

> **Canonical Artifact**: `07_PROJECT_LEARNING/vikejs-vike-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vikejs/vike](https://github.com/vikejs/vike))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:19:16.061Z  
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

### Core Architecture Module: `examples/auth/components/Button.tsx`
```
export { Button }

import React, { useEffect, useState } from 'react'

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  let [disabled, setDisabled] = useState(true)
  useEffect(() => {
    setDisabled(false)
  })
  return <button type="button" disabled={disabled} {...props} />
}

```

### Core Architecture Module: `examples/auth/components/Counter.tsx`
```
export { Counter }

import React, { useState } from 'react'
import { Button } from './Button'

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <Button type="button" onClick={() => setCount((count) => count + 1)}>
      Counter {count}
    </Button>
  )
}

```

### Core Architecture Module: `examples/auth/layouts/LayoutDefault.tsx`
```
export default LayoutDefault

import React from 'react'
import './LayoutDefault.css'
import { reload } from 'vike/client/router'
import { usePageContext } from 'vike-react/usePageContext'
import { Button } from '../components/Button'

function LayoutDefault({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      <Sidebar>
        <Links />
        <UserInfo />
      </Sidebar>
      <Content>{children}</Content>
    </Layout>
  )
}

function Links() {
  return (
    <>
      <a className="navitem" href="/">
        Home
      </a>
      <a className="navitem" href="/admin">
        Admin Panel
      </a>
      <a className="navitem" href="/account">
        Account
      </a>
    </>
  )
}

function UserInfo() {
  const pageContext = usePageContext()
  const { userFullName } = pageContext
  let content
  if (!userFullName) {
    content = (
      <>
        You are logged out.
        <br />
        {/*
        <a className="navitem" href="/login">
          <b>Login</b>
        </a>
        */}
      </>
    )
  } else {
    content = (
      <>
        Logged as <b>{userFullName}</b>
        <br />
        <Button onClick={logout}>Logout</Button>
      </>
    )
  }
  return (
    <div style={{ textAlign: 'center', fontSize: '0.92em', border: '1px solid black', padding: 10, marginTop: 10 }}>
      {content}
    </div>
  )
}
async function logout() {
  await fetch('/_auth/logout', { method: 'POST' })
  await reload()
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        maxWidth: 1000,
        margin: 'auto',
      }}
    >
      {children}
    </div>
  )
}

function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 20,
        paddingTop: 42,
        minWidth: 300,
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

function Content({ children }: { children: React.ReactNode }) {
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

```

### Core Architecture Module: `examples/auth/pages/+Layout.ts`
```
export { default } from '../layouts/LayoutDefault'

```

### Core Architecture Module: `examples/auth/pages/+config.ts`
```
import type { Config } from 'vike/types'
import vikeReact from 'vike-react/config'

export default {
  passToClient: ['userFullName'],
  extends: vikeReact,
} satisfies Config

```

### Core Architecture Module: `examples/auth/pages/+onCreatePageContext.server.ts`
```
export { onCreatePageContext }

import type { PageContextServer } from 'vike/types'

function onCreatePageContext(pageContext: PageContextServer) {
  const { req } = pageContext
  const { user } = req
  const userFullName = user?.fullName
  pageContext.user = user
  pageContext.userFullName = userFullName
}

```

### Core Architecture Module: `examples/auth/pages/PageContext.ts`
```
// https://vike.dev/pageContext#typescript
declare global {
  namespace Vike {
    interface PageContext {
      req?: any
      userFullName?: string
      user?: {
        isAdmin: boolean
      }
    }
  }
}

// Tell TypeScript that this file isn't an ambient module
export {}

```

### Core Architecture Module: `examples/auth/pages/_error/+Page.tsx`
```
export default Page

import React from 'react'
import { usePageContext } from 'vike-react/usePageContext'
import { Counter } from '../../components/Counter'

function Page() {
  const pageContext = usePageContext()

  // Message shown to the user
  let msg
  let title

  // Handle `throw render(403, { notAdmin: true })`
  if (pageContext.abortReason?.notAdmin) {
    msg = "You cannot access this page because you aren't an administrator."
    title = 'Unauthorized'
  }

  // Fallback error message
  if (!msg) {
    msg = pageContext.is404 ? "This page doesn't exist." : 'Something went wrong. Try again (later).'
    title = pageContext.is404 ? "Doesn't exist" : 'Error'
  }

  return (
    <>
      <h1>{title}</h1>
      <p>{msg}</p>
      <p>
        This page is hydrated: <Counter />
      </p>
    </>
  )
}

// https://vike.dev/pageContext#typescript
declare global {
  namespace Vike {
    interface PageContext {
      abortReason?: {
        notAdmin?: true
      }
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3552** (2026-09-30): **fix: preserve cookies on redirects and client-side navigation**
  *Symptoms*: Cookies set with `pageContext.headersResponse` were lost on client-side navigation and redirects, including after `throw redirect()` or `throw render()`. This PR sends `Set-Cookie` with `.pageContext.json` and redirect responses, preserves cookies set before those calls, and makes Vike's dev/preview server send multiple cookies. Other headers retain their existing behavior, including last-value replacement in the server writer. The `/renderPage` example now sends every `Set-Cookie`.  Production HTTP requests in `test/abort`, comparing `main`'s runtime (`1f85b01be6`) with this PR's runtime and the same added test pages:  | Request | Status on both | `Set-Cookie` count on `main` | This PR | |---|---|---|---| | `/redirect-with-cookie` | `302`, `Location: /` | 0 | 2 | | `/redirect-with-cookie/index.pageContext.json` | `200` | 0 | 2 | | `/data-with-cookie` | `200` | 1 | 1 | | `/data-with-cookie/index.pageContext.json` | `200` | 0 | 1 |  The guard sets two cookies; `data()` sets one.  `test/abort` passes in `dev`, `dev:server`, `preview`, and `prod`. It covers HTTP and browser redirects, client-side `data()` navigation, cookies before `throw render('/')` and `throw render(403)`, and an error page that redirects or falls back to Vike's generic error page. Against `main`, the client redirect/data tests fail because browser cookies are missing; the rewrite/status tests fail at their HTTP cookie assertions. Selectively reverting the server writers loses the first cookie, reverting the 
  **Post-Mortem & Fix Analysis**:
  > @brillout Ready for review, CI is green. This fixes cookies lost on redirects and client-side navigation, and reproduces without RSC. 
  > I think we don't have to mention this in the docs?
  > Reminder: let's remove the tests right before squash-merging

- **Issue #3549** (2026-09-29): **minor refactoring**
  *Symptoms*: 

- **Issue #3548** (2026-09-29): **fix: don't hang `vike dev` when a `+vite` plugin has cyclic objects**
  *Symptoms*: When a `+vite` config holds a Vite plugin with a cyclic object, adding a page or editing a config file while `vike dev` runs throws `RangeError: Maximum call stack size exceeded`, and requests then hang. `hasViteConfigChanged()` compares the old and new `+vite` values with `deepEqual()`, which recursed forever into cycles, so Vike's config never settled. It's now `deepEqualServer()`: it returns early for identical values and stops at a pair it is already comparing; the rest of the object still decides the result. It's server-only (`assertIsNotBrowser()`); no client-side code compares with it.  A real plugin with such a cycle is `@vitejs/plugin-rsc` (`plugins[9].api.manager.serverReferences.manager`); this showed up with a Vike extension whose `+vite` includes plugin-rsc.  ## What you should see  Setup: a copy of `examples/react-minimal` plus a `pages/+vite.js` whose plugin has a cycle, shaped like plugin-rsc's:  ```js const manager = { serverReferences: {} } manager.serverReferences.manager = manager export default { plugins: [{ name: 'plugin-with-cycle', api: { manager } }] } ```  **1.** Add `pages/probe/+Page.jsx` while `vike dev` runs, then request `/probe`.  | `main` | this PR | |---|---| | <pre>[vike][config] created /pages/probe/+Page.jsx<br>RangeError: Maximum call stack size exceeded<br>    at deepEqual (…/dist/utils/deepEqual.js:2:26)<br>[vike][request-3] HTTP request  → /probe<br>[vike][Warning] Promise hasn't resolved after 25 seconds</pre>`GET /probe` got no respo
  **Post-Mortem & Fix Analysis**:
  > **Review round:** a fresh-context Claude Opus subagent, not a model from another company. Codex (`model: gpt-6-astra`) was tried first but failed with "Your workspace is out of credits".  **Verdict: PASS, no findings.** What it checked:  - **Gates:** it re-ran `build`, `vitest --project unit` (218 tests), `format:check` and `lint`. All exited 0. - **Reverting the fix:** with `deepEqual.ts` restored to `main`, the new spec fails with the `RangeError`. In the dev app, `/probe` and `/about` (after editing `+vite.js`) hang again. - **With the fix:**   - `/probe` returns 200.   - Editing only a comment in `+vite.js` serves 200 without a restart.   - Renaming the plugin still logs `server restarted`. - **Edge cases it probed:**   - The same cycle shape with a different value is unequal.   - A 1-cycle and an equivalent 2-cycle are equal.   - Shared sub-objects compare equal or unequal correctly.   - Arrays behave as before. - **Other callers:** `crawlFiles.ts`, `optimizeDeps.ts`, `serializeCo
  > Let's have two versions, one lightweight for the client-side (e.g. the `main` one), and your proposed for the server-side.  Two files: utils/deepEqual{Client,Server}.ts — don't forget to assert the env.  Refer to this PR in the server one.
  > Rationale: keep client-side KBs minimal (add a comment).

- **Issue #3546** (2026-09-30): **fix: support Vite's `builder.sharedConfigBuild: true`**
  *Symptoms*: `vike build` fails when Vite's `builder.sharedConfigBuild: true` is set, and `@vitejs/plugin-rsc` sets it with its default builder. The error is `Could not resolve entry module "index.html"`.  Vike wrote its Rollup inputs, dist file names / `manualChunks` and `onwarn` to the root `config.build` in `configResolved`. By default, Vite resolves the config once per environment, and the root `build` shares its `rollupOptions` with that environment's `build`, so this worked. With `sharedConfigBuild` the config is resolved once, and no environment builds from the root `build`.  Vike now applies these settings to each `config.environments[name].build`, according to the environment's side (client/server). The same goes for the ssr environment's `assetsDir` when moving server assets.  Refs #3500.  ## What you should see  **1.** `test/abort`, `vike build` with `VITE_CONFIG={builder:{sharedConfigBuild:true}}`:  | Setup | Result | |---|---| | `main` (at the time, `9bf5b92348`) | `Could not resolve entry module "index.html"` | | inputs fixed only (`0ddb8476a5`, with the server-entry fix) | builds, but with Vite's default file names, and `/` and `/about` each have **two** stylesheet links, because the server-CSS dedupe relies on Vike's `.[hash].` naming | | this PR | same `dist/` as its build without `sharedConfigBuild`; `/` and `/about` each have one stylesheet link |  **2.** Default builds (without `sharedConfigBuild`) compared with `main` (`3bf584b990`) across all 47 apps in `test/` and `
  **Post-Mortem & Fix Analysis**:
  > **Review round:** `gpt-6-astra` (OpenAI Codex), charter-based, with gates and build probes on Vite 6.3/7.3/8.0.  - **CHANGES-REQUESTED → both fixed.**   - 9ff6143095: two environments could have *different* output arrays that share the same output object. The array check missed that, so the ssr build got client file names and failed, even without `sharedConfigBuild`. Each output object is now copied individually.   - 81a76b83ec: with `environments.ssr.build.assetsDir` set in shared mode, `copyAssets()` looked in the root's assets dir and failed its existence check. It now reads the ssr environment's `assetsDir`. That is what non-shared mode already used, since there the root `build` is the ssr build.   - Codex's own probes rerun after the fixes: arrays, legacy plugin, worker, lib, CSS and `assetsDir`, in both modes: all exit 0. - Confirmed by the reviewer: reverting brings back the `index.html` failure. `abort` and `react-full` shared output is byte-identical to `main`'s normal output.
  > This is labeled as a draft — ping me once you want me to review it.
  > @brillout ready for review. The six items under "Left to you" are yours to decide. 

- **Issue #3545** (2026-09-29): **fix: don't mistake other plugins' virtual modules for Vike page entries**
  *Symptoms*: A Vike app using `@vitejs/plugin-rsc` failed to build with an internal Vike assertion (`[vike][Bug]` in `addServerAssets()`). `getPageId()` looked for `virtual:vike` anywhere in a Vite manifest key. So plugin-rsc's client-reference facade, whose ID wraps a Vike page entry, was read as that page's entry, and two manifest entries claimed the same page. `getPageId()` now accepts only keys where `virtual:vike` comes right at the start or right after a path prefix (`../../`, `../api/`).  Refs #3500  ## What you should see  **1.** The manifest key that plugin-rsc 0.5.32 emits in the client manifest of the vike-react-rsc example app (Vite 8.2):  ``` virtual:vite-rsc/client-references/group/facade:virtual:vike:page-entry:rsc:/src/pages/client ```  **2.** Building that app:  | `getPageId()` | `vike build` | |---|---| | `main` (matches `virtual:vike` anywhere) | `[vike][Bug] You stumbled upon a Vike bug.` at `addServerAssets (handleAssetsManifest.js)` | | This PR | all 5 stages built, exit 0 |  This only happens with a plugin that wraps Vike's page-entry IDs; for plain Vike apps nothing changes. The first version rejected any prefix containing `:`, which would have silently dropped server CSS for a cwd like `../tools:api/`. The review round caught that, and the rule is now "empty, or ends with `/`". The unit spec was removed as requested.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  
  **Post-Mortem & Fix Analysis**:
  > **Review round** (one round, per the review charter; correctness, security, bloat)  Reviewer: `gpt-6-astra` (OpenAI Codex CLI v0.156.0), running the gates and probes itself.  - **CHANGES-REQUESTED → fixed in e4c1175e5b.** The first rule (`prefix.includes(':')`) rejected valid path prefixes. With cwd in a sibling directory named `tools:api`, Vite 7.3.1 emitted `../tools:api/virtual:vike:page-entry:client:/pages/index`, and the page lost its server CSS association. The rule is now "prefix is empty or ends with `/`", and that key is in the spec. - Gates reproduced by the reviewer: `pnpm run build`, unit suite (40 files / 219 tests), `pnpm run lint`, `biome ci`, all exit 0. Reverting the fix brings back the wrapper test failure and the duplicate-page assertion. Removing the `../` normalization separately fails the ancestor-prefix test, so it's still needed. - UNKNOWN to the reviewer: the full vike-react-rsc build (Vite 8.2 + plugin-rsc) wasn't reproduced independently. The exact `:rsc:` ke
  > Let's remove the test then feel free to squash & merge.

- **Issue #3544** (2026-09-29): **fix: don't reject Vite CLI options**
  *Symptoms*: With Vike installed, the Vite CLI rejected Vite's command options: `vite --port 3001`, `vite -c vite.config.dev.ts` and `vite build --outDir dist2` all failed with `CACError: Unknown option` (`--help` and `--version` still worked, because Vite handles them before loading the config). Vike re-parses the Vite CLI with `cac` in three places. `getViteBuildCliArgs()` declared Vite's global and build options, `getViteCliArgs()` declared only `-c`, and `getViteCliCommand()`, which runs whenever the Vite CLI loads Vike, declared none, so cac rejected any option it didn't know. The three now share one parser, `parseViteCli()`, which declares Vite's options for each command: the existing build list, plus dev, optimize and preview. It also lets through options added by newer Vite versions.  Fixes #3133  ## What you should see  **1.** Run in `test/abort`, with Vite 6.3.5:  | Command | `main` | This PR | |---|---|---| | `vite build --outDir dist2 --minify false` | `CACError: Unknown option --outDir` | exit 0, writes `dist2/` and no `dist/` | | `vite -c vite.config.ts --port 3999 --strictPort --mode development` | `CACError: Unknown option -c` | dev server on port 3999, HTTP 200 | | `vite build --emptyOutDir $PWD --outDir dist3 --minify false` | `CACError: Unknown option --emptyOutDir` | exit 0, writes `dist3/` |  **2.** The dev server from row 2, started with `-c`, `--port 3999`, `--strictPort` and `--mode development`:  ![test/abort served by `vite -c vite.config.ts --port 3999 --strictP
  **Post-Mortem & Fix Analysis**:
  > **Review round** (one round, per the review charter; correctness, security, bloat)  Reviewer: `gpt-6-astra` (OpenAI Codex CLI v0.156.0), read-only on the diff, running the gates itself.  - **CHANGES-REQUESTED → fixed in 29a5b03c4f.** An undeclared boolean option placed before `[root]` swallowed it (`vite build --emptyOutDir /path/to/app …` hit Vike's root-mismatch assertion). Vite's boolean options are now declared in the parsers that read positionals, and the spec covers that case. - Gates reproduced by the reviewer: `pnpm run build`, unit suite (40 files / 220 tests at the time), `pnpm run lint`, `biome ci`, all exit 0. Reverting `isViteCli.ts` makes the spec fail with `Unknown option` for `-c`, `--outDir` and `--port`. - Security: no endpoint, auth, or command-execution surface; CLI argument parsing only.  **Refactor pass** (same reviewer, rating only): no production refactor worth the churn. Applied in 46ab06935c: the comment example `--force` (not a Vite `build` option) was reword
  > > the Vite CLI rejects **every** Vite option  That isn't supposed to happen and, actually, there is already code to support Vite options, see for example:  https://github.com/vikejs/vike/blob/9bf5b923485f1227f0f1dd55ebd210b8ff58544c/packages/vike/src/node/vite/shared/isViteCli.ts#L73-L73  It seems like this PR re-implements a feature that is already implemented?
  > The option list you linked only exists in `getViteBuildCliArgs()`. The two other cac parsers in that file don't have it: `getViteCliCommand()` (called by `getViteContext()` whenever the Vite CLI loads Vike) declares no options, and `getViteCliArgs()` (added in #3278) declares only `-c`. They're the ones that throw, which is why even `vite -c x.ts` or `vite --port 3001` fails, not just `vite build --outDir`.  I reworked the PR along your point, so nothing is duplicated anymore: the three getters now share one parser, `parseViteCli()`, which declares Vite's options for every command. That's your existing build list, plus the dev, optimize and preview options copied from Vite's `cli.ts`. `.allowUnknownOptions()` stays so that options added by newer Vite versions don't throw.  

- **Issue #3543** (2026-09-29): **fix: always pass the public pageContext object to users**
  *Symptoms*: Follow-up of #3536 (#3535). A few more places gave users Vike's internal `pageContext` object instead of the public one, so `pageContext.globalContext` (and the global context properties that are otherwise available directly on `pageContext`) was `undefined` there, even though the types promise `PageContextServer`/`PageContextClient`. They're now all consistent.  ## Breaking change  `pageContext.pageProps.is404` is removed (`addIs404ToPageProps()`): it's a leftover from Vike's old design. Use `pageContext.is404` instead. `test-deprecated-design/vue-full`'s error page is migrated accordingly.  For the changelog, the squash commit needs this footer (squash merges here usually keep only the title):  ``` BREAKING CHANGE: `pageContext.pageProps.is404` removed, use `pageContext.is404` instead ```  ## Changes  | Where users get a `pageContext` | Before | Fix | | --- | --- | --- | | `+onError(error, pageContext)` | raw: `execHookOnError()` built the public object for `+onHookCall` but called the hook with the raw one | `execHookSingleSync()`'s `hookFnCaller` now receives the public `pageContext` | | `+keepScrollPosition` as a function | raw (for both the next and the previous page) | `getPageContextPublicClient()` | | `pageContext.previousPageContext` (client) | raw previous object | `getPageContextPublicClient()`. Internal code keeps using `globalObject.previousPageContext` (raw). | | `pageContext.pageContextsAborted[]` (server and client) | raw aborted objects | `addNewPageContextA
  **Post-Mortem & Fix Analysis**:
  > **Spellcheck** failed on 25ccda3 ([run](https://github.com/vikejs/vike/actions/runs/36626874149/job/109606004978)) while installing `typos`, before anything was spellchecked.  The failure didn't come from this PR: - `typos-rs-npm`'s postinstall fetches the binary's release info from the GitHub API. - The job's output (empty stdout, `ELIFECYCLE Command failed with exit code 1`) is what you get when that request fails. - The workflow doesn't pass a token, so the request is unauthenticated and subject to GitHub's per-IP rate limit. From my sandbox it gets a 429. - `typos` 1.33.1 with the same config finds no typos on this commit. - The re-run passed, and CI is green.  No fix exists yet. The patch below (not part of this PR) would make the request authenticated, because `typos-rs-npm` passes `GITHUB_TOKEN` to the download:  ```yaml # .github/workflows/spellcheck.yml       - run: pnpm run spellcheck:check         env:           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} ```  --- _Generated b

- **Issue #3542** (2026-09-29): **test: fix flaky HMR test in testRunClassic()**
  *Symptoms*: Fixes a flaky `HMR` test in `testRunClassic()`, e.g. [this failure](https://github.com/vikejs/vike/actions/runs/36508602393/job/109215575446?pr=3539) in `examples/vue-minimal/.test-dev.test.ts`.  In that run, the first edit (`Welcome` → `Wilkommen`) triggered an HMR update. `editFileRevert()` then ran a few milliseconds later, and Vite never logged a second `hmr update`: its watcher missed the revert, so the page stayed on `Wilkommen` until the test timed out.  This adds `await sleepBeforeEditFile()` before both `editFile()` and `editFileRevert()`. That's the existing helper for this race, already used in `test/playground` and `examples/render-modes`.  `examples/vue-minimal/.test-dev.test.ts` and `examples/react-minimal/.test-dev.test.ts` pass locally with the change.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01RVXnKs6wCXqP8zq9zoA7e1  --- _Generated by [Claude Code](https://claude.ai/code/session_01RVXnKs6wCXqP8zq9zoA7e1)_

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

### Incident Patch 1: `033cb69d` (2026-09-30)
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
+  const httpResponse = createHttpResponse(200, contentTypeJson, headers, pageContextSerialize
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

---

### Incident Patch 2: `774e3ca6` (2026-09-30)
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
+      rollupOutput.chunkFileNa
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

---

### Incident Patch 3: `1f85b01b` (2026-09-29)
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

---

### Incident Patch 4: `3bf584b9` (2026-09-29)
**Commit Message**: fix: don't hang `vike dev` when a `+vite` plugin has cyclic objects (#3548)

Co-authored-by: Romuald Brillout <git@brillout.com>

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

### Incident Patch 5: `0e4a2843` (2026-09-29)
**Commit Message**: fix: don't reject Vite CLI options (#3544)

Co-authored-by: Romuald Brillout <git@brillout.com>

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
     .option('--ssrManifest [name
```

---

### Incident Patch 6: `f29653b4` (2026-09-29)
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

---

### Incident Patch 7: `9bf5b923` (2026-09-29)
**Commit Message**: test: fix flaky HMR test by sleeping before editing files (#3542)

**File**: `test/utils.ts` (modified, +2/-0)
```diff
@@ -156,13 +156,15 @@ function testRunClassic(
       const org = 'Welcome'
       const mod = 'Wilkommen'
       expect(await page.textContent('h1')).toBe(org)
+      await sleepBeforeEditFile()
       editFile(testHmr || `./pages/index/+Page.${isVue ? 'vue' : 'tsx'}`, (s) => s.replace(org, mod))
       await autoRetry(
         async () => {
           expect(await page.textContent('h1')).toBe(mod)
         },
         { timeout: 5000 },
       )
+      await sleepBeforeEditFile()
       editFileRevert()
       await autoRetry(
         async () => {
```

---

### Incident Patch 8: `ca12fbbe` (2026-09-28)
**Commit Message**: test: fix flaky hook-override and pushState e2e tests (#3537)

**File**: `test/hook-override/test.ts` (modified, +7/-1)
```diff
@@ -1,7 +1,7 @@
 export { testRun as test }
 
 import { run, page, test, expect, getServerUrl, fetchHtml, expectLog, autoRetry } from '@brillout/test-e2e'
-import { ensureWasClientSideRouted, expectPageContextJsonRequest, testCounter } from '../utils'
+import { ensureWasClientSideRouted, expectPageContextJsonRequest, expectUrl, testCounter } from '../utils'
 
 function testRun(cmd: 'pnpm run dev' | 'pnpm run preview') {
   run(cmd)
@@ -53,6 +53,8 @@ function testRun(cmd: 'pnpm run dev' | 'pnpm run preview') {
       // because neither data() nor onBeforeRender() are server-only
       const done = expectPageContextJsonRequest(false)
       await page.click('a[href="/page-4"]')
+      // Wait for the navigation to finish: Vike changes the URL only after the pageContext JSON request (if any)
+      await expectUrl('/page-4')
       await testCounter(1)
       await ensureWasClientSideRouted('/pages/index')
       done()
@@ -61,6 +63,7 @@ function testRun(cmd: 'pnpm run dev' | 'pnpm run preview') {
       // because both data() and onBeforeRender() are server-only
       const done = expectPageContextJsonRequest(true)
       await page.click('a[href="/page-3"]')
+      await expectUrl('/page-3')
       await testCounter(2)
       await ensureWasClientSideRouted('/pages/index')
       done()
@@ -69,6 +72,7 @@ function testRun(cmd: 'pnpm run dev' | 'pnpm run preview') {
       // because both data() and onBeforeRender() are server-only, even though they are both null
       const done = expectPageContextJsonRequest(true)
       await page.click('a[href="/page-2"]')
+      await expectUrl('/page-2')
       await testCounter(3)
       await ensureWasClientSideRouted('/pages/index')
       done()
@@ -77,6 +81,7 @@ function testRun(cmd: 'pnpm run dev' | 'pnpm run preview') {
       // because both data() and onBeforeRender() are server-only
       const done = expectPageContextJsonRequest(true)
       await page.click('a[href="/"]')
+      await expectUrl('/')
       await testCounter(4)
       await ensureWasClientSideRouted('/pages/index')
       done()
@@ -91,6 +96,7 @@ function testRun(cmd: 'pnpm run dev' | 'pnpm run preview') {
     {
       const done = expectPageContextJsonRequest(false)
       await page.click('a[href="/page-4"]')
+      await expectUrl('/page-4')
       await testCounter(5)
       await ensureWasClientSideRouted('/pages/index')
       done()
```

**File**: `test/playground/pages/pushState/e2e-test.ts` (modified, +12/-6)
```diff
@@ -12,9 +12,7 @@ function testHistoryPushState() {
     const timestamp1 = await getTimestamp()
     await page.click('a[href="/markdown"]')
     await page.click('a[href="/pushState"]')
-    const timestamp2 = await getTimestamp()
-    expect(timestamp2 !== timestamp1).toBe(true)
-    expect(timestamp2 > timestamp1).toBe(true)
+    const timestamp2 = await getTimestampNewerThan(timestamp1)
 
     // Calling history.pushState() doesn't trigger a re-render, thus timestamp doesn't change
     await expectUrl('/pushState')
@@ -42,9 +40,7 @@ function testHistoryPushState() {
     await expectUrl('/markdown')
     await page.goForward()
     await expectUrl('/pushState')
-    await sleep(100)
-    const timestamp6 = await getTimestamp()
-    expect(timestamp6 > timestamp2).toBe(true)
+    const timestamp6 = await getTimestampNewerThan(timestamp2)
     await page.goForward()
     await expectUrl('/pushState?query')
     const timestamp7 = await getTimestamp()
@@ -53,6 +49,16 @@ function testHistoryPushState() {
 
   return
 
+  // The page is re-rendered asynchronously: the old DOM (with the old timestamp) can still be shown
+  async function getTimestampNewerThan(timestampPrevious: number) {
+    let timestamp!: number
+    await autoRetry(async () => {
+      timestamp = await getTimestamp()
+      expect(timestamp > timestampPrevious).toBe(true)
+    })
+    return timestamp
+  }
+
   async function getTimestamp() {
     let timestampStr: string
     await autoRetry(async () => {
```

---

### Incident Patch 9: `b0055353` (2026-09-28)
**Commit Message**: fix: pass public pageContext to +headersResponse and +csp.nonce (fix #3535) (#3536)

**File**: `packages/vike/src/server/runtime/renderPageServer/csp.ts` (modified, +4/-2)
```diff
@@ -6,11 +6,13 @@ export type { PageContextCspNonce }
 import { import_ } from '@brillout/import'
 import { assert } from '../../../utils/assert.js'
 import type { PageContextConfig } from '../../../shared-server-client/getPageFiles.js'
+import type { PageContextPublicMinimum } from '../../../shared-server-client/getPageContextPublicShared.js'
 import type { PageContextServer } from '../../../types/PageContext.js'
+import { getPageContextPublicServer } from './getPageContextPublicServer.js'
 import '../../assertEnvServer.js'
 
 async function resolvePageContextCspNone(
-  pageContext: PageContextConfig & Partial<PageContextCspNonce>,
+  pageContext: PageContextConfig & PageContextPublicMinimum & Partial<PageContextCspNonce>,
 ): Promise<null | { cspNonce: string | null }> {
   if (pageContext.cspNonce) return null // already set by user e.g. `renderPage({ cspNonce: '123456789' })`
 
@@ -21,7 +23,7 @@ async function resolvePageContextCspNone(
     if (csp.nonce === true) {
       pageContextAddendum.cspNonce = await generateNonce()
     } else {
-      pageContextAddendum.cspNonce = await csp.nonce(pageContext as any)
+      pageContextAddendum.cspNonce = await csp.nonce(getPageContextPublicServer(pageContext) as any)
     }
   }
 
```

**File**: `packages/vike/src/server/runtime/renderPageServer/headersResponse.ts` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@ import { addCspResponseHeader, PageContextCspNonce } from './csp.js'
 import { isCallable } from '../../../utils/isCallable.js'
 import { cacheControlDisable, getCacheControl } from './getCacheControl.js'
 import type { PageContextAfterPageEntryLoaded } from './loadPageConfigsLazyServerSide.js'
+import { getPageContextPublicServer } from './getPageContextPublicServer.js'
 import '../../assertEnvServer.js'
 
 function resolveHeadersResponseFinal(
@@ -46,7 +47,7 @@ async function resolveHeadersResponseConfig(pageContext: PageContextAfterPageEnt
       async (headers: HeadersInit | ((arg0: any) => HeadersInit | PromiseLike<HeadersInit>)) => {
         let headersInit: HeadersInit
         if (isCallable(headers)) {
-          headersInit = await headers(pageContext as any)
+          headersInit = await headers(getPageContextPublicServer(pageContext))
         } else {
           headersInit = headers
         }
```

---

### Incident Patch 10: `1c4e816f` (2026-09-28)
**Commit Message**: fix: replace esbuild with Rolldown for transpiling config files (#3528)

**File**: `docs/pages/path-aliases/+Page.mdx` (modified, +1/-1)
```diff
@@ -103,4 +103,4 @@ See also:
 
 To make path aliases work in config files, such as  `+config.js` and `vite.config.js`, define them at `tsconfig.json` or `package.json` (defining them in `vite.config.js` doesn't work for config files).
 
-> Config files are transpiled by [esbuild](https://esbuild.github.io) instead of Vite — esbuild supports path aliases defined over `tsconfig.json` and `package.json` (esbuild doesn't know about `vite.config.js`).
+> Config files are transpiled by [Rolldown](https://rolldown.rs) instead of Vite — Rolldown supports path aliases defined over `tsconfig.json` and `package.json` (Rolldown doesn't know about `vite.config.js`).
```

**File**: `packages/vike/package.json` (modified, +1/-2)
```diff
@@ -135,10 +135,10 @@
     "cac": "^6.0.0",
     "convert-route": "^1.1.1",
     "es-module-lexer": "^1.0.0",
-    "esbuild": ">=0.19.0",
     "json5": "^2.0.0",
     "magic-string": "^1.4.2",
     "picomatch": "^4.0.7",
+    "rolldown": ">=1.0.0",
     "semver": "^7.8.5",
     "sirv": "^3.0.2",
     "source-map-support": "^0.5.0",
@@ -269,7 +269,6 @@
     "@types/source-map-support": "^0.5.10",
     "react-streaming": "^0.4.20",
     "rimraf": "^6.1.3",
-    "rolldown": "1.0.0-rc.17",
     "typescript": "^7.0.2",
     "vite": "^7.2.6"
   },
```

**File**: `packages/vike/src/node/vite/shared/resolveVikeConfigInternal/pointerImports.ts` (modified, +15/-6)
```diff
@@ -1,6 +1,7 @@
 export { transformPointerImports }
 export { parsePointerImportData }
 export { assertPointerImportPath }
+export { pointerImportAttributeSuffix }
 export type { PointerImportData }
 
 // Playground: https://github.com/brillout/acorn-playground
@@ -13,12 +14,9 @@ export type { PointerImportData }
 //   - Isn't stage 4 yet: https://github.com/tc39/proposal-import-attributes
 // - Using a import path suffix such as `import { Layout } from './Layout?real` breaks TypeScript, and TypeScript isn't working on supporting query params: https://github.com/microsoft/TypeScript/issues/10988#issuecomment-867135453
 // - Node.js >=21 supports import attributes: https://nodejs.org/api/esm.html#import-attributes
-// - Esbuid supports
-//   - Blocker: https://github.com/evanw/esbuild/issues/3646
-//     - Ugly hack to make it work: https://github.com/brillout/esbuild-playground/tree/experiment/import-attribute
-//   - Discussion with esbuild maintainer: https://github.com/evanw/esbuild/issues/3384
+// - Rolldown doesn't pass import attributes to plugins => we parse import attributes ourselves and mark the import path with pointerImportAttributeSuffix, see transpileFile()
 // - Using a magic comment `// @vike-real-import` is probably a bad idea:
-//   - Esbuild removes comments: https://github.com/evanw/esbuild/issues/1439#issuecomment-877656182
+//   - Bundlers usually remove comments, e.g. esbuild: https://github.com/evanw/esbuild/issues/1439#issuecomment-877656182
 //   - Using source maps to track these magic comments is brittle (source maps can easily break)
 
 import { parseSync } from '@babel/core'
@@ -30,6 +28,12 @@ import pc from '@brillout/picocolors'
 import { parseImportString, isImportString, serializeImportString } from '../importString.js'
 import '../../assertEnvVite.js'
 
+// Appended to the import path of imports with the import attribute `with { type: 'vike:pointer' }`, see transpileFile()
+const pointerImportAttributeSuffix = '?vike:pointer'
+function removePointerImportAttributeSuffix(str: string) {
+  return str.split(pointerImportAttributeSuffix).join('')
+}
+
 function transformPointerImports(
   code: string,
   pointerImports:
@@ -66,6 +70,7 @@ function transformPointerImports(
     const importStatementCode = code.slice(start, end)
 
     // Pointer import without importing any value, e.g. `import './some.css'` => we remove it (it doesn't have any effect).
+    // - Rolldown transforms unused imports `import { unused } from './some.js'` into `import './some.js'`
 
     let constDeclaration = ''
     node.specifiers.forEach((specifier) => {
@@ -84,7 +89,11 @@ function transformPointerImports(
         }
         return importLocalName
       })()
-      const importString = serializePointerImportData({ importPath, exportName, importStringWasGenerated: true })
+      const importString = serializePointerImportData({
+        importPath: removePointerImportAttributeSuffix(importPath),
+        exportName,
+        importStringWasGenerated: true,
+      })
       constDeclaration += `const ${importLocalName} = '${importString}';`
     })
 
```

**File**: `packages/vike/src/node/vite/shared/resolveVikeConfigInternal/transpileAndExecuteFile.spec.ts` (modified, +55/-9)
```diff
@@ -11,6 +11,7 @@ import {
 import { getFilePathResolved } from '../getFilePath.js'
 import { stripAnsi } from '../../../../utils/colorsServer.js'
 import { toPosixPath } from '../../../../utils/path.js'
+import * as isScriptFile from '../../../../utils/isScriptFile.js'
 
 const zeroWidthSpace = '​'
 
@@ -37,7 +38,7 @@ beforeAll(() => {
     'components/Layout.jsx': 'export const Layout = ({ children }) => <div>{children}</div>',
     'components/style.css': 'body { color: red }',
     'components/Page.ts': "export const Page = 'Page'",
-    'components/legacy.cjs': "module.exports = { sep: '/' }",
+    'components/legacy.cjs': "const path = require('node:path')\nmodule.exports = { sep: path.posix.sep }",
   })
 })
 afterAll(() => {
@@ -164,6 +165,8 @@ describe('transpileAndExecuteFile()', () => {
         'export const getTitle = () => title',
       ].join('\n'),
       'pages/samePath/+config.ts': [
+        // Non-ASCII characters before the imports (the import paths are modified based on their position)
+        '// Café 🚀',
         "import { Page } from '../../components/pageAndTitle.ts' with { type: 'vike:pointer' }",
         "import { title } from '../../components/pageAndTitle.ts'",
         'export default { Page, title }',
@@ -208,6 +211,25 @@ describe('transpileAndExecuteFile()', () => {
     expect(dependencies).toEqual(['/components/legacy.cjs', '/pages/transpilation/+config.ts', '/utils/helper.ts'])
   })
 
+  it('warnings', async () => {
+    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
+    try {
+      writeFiles({
+        'pages/warnings/+config.ts': ["const two = eval('1 + 1')", 'export default { two }'].join('\n'),
+      })
+      const { fileExports } = await load('/pages/warnings/+config.ts')
+      expect(fileExports.default).toEqual({ two: 2 })
+      // Rolldown's warnings are printed
+      expect(warn).toHaveBeenCalledOnce()
+      const msg = stripAnsi(String(warn.mock.calls[0]![0]))
+      expect(msg).toContain('pages/warnings/+config.ts')
+      expect(msg).toContain('[EVAL]')
+      expect(msg).toContain('Use of direct `eval` function is strongly discouraged')
+    } finally {
+      warn.mockRestore()
+    }
+  })
+
   it('build errors', async () => {
     writeFiles({
       'pages/unresolvedAlias/+config.ts': [
@@ -238,33 +260,37 @@ describe('transpileAndExecuteFile()', () => {
     {
       const { errMsgFormatted } = await getBuildErr('/pages/unresolvedAlias/+config.ts')
       expect(errMsgFormatted).toContain('Failed to transpile /pages/unresolvedAlias/+config.ts because:')
-      expect(errMsgFormatted).toContain('Could not resolve "#root/renderer/onRenderHtml_typo"')
+      expect(errMsgFormatted).toContain("Could not resolve '#root/renderer/onRenderHtml_typo'")
       expect(errMsgFormatted).toContain("import { onRenderHtml } from '#root/renderer/onRenderHtml_typo'")
     }
     {
-      const { errMsgFormatted } = await getBuildErr('/pages/unresolvedNpmPackage/+config.ts')
+      const { errMsgFormatted, err } = await getBuildErr('/pages/unresolvedNpmPackage/+config.ts')
       expect(errMsgFormatted).toContain('Failed to transpile /pages/unresolvedNpmPackage/+config.ts because:')
-      expect(errMsgFormatted).toContain('Could not resolve "not-installed-npm-package"')
+      expect(errMsgFormatted).toContain("Could not resolve 'not-installed-npm-package'")
+      expect(errMsgFormatted).not.toContain('treating it as an external dependency')
+      // The error message is printed only once upon `$ vike build`
+      expect(inspect(err).split('UNRESOLVED_IMPORT').length - 1).toBe(1)
     }
     for (const [page, importPath] of [
       ['unresolvedPointerImport', './Page_typo.ts'],
       ['unresolvedPointerImportNpmPackage', 'not-installed-npm-package'],
     ] as const) {
-      const { errMsgFormatted } = await getBuildErr(`/pages/${page}/+config.ts`)
+      const { errMsgFormatted, err } = await getBuildErr(`/pages/${page}/+config.ts`)
       expect(errM
```

**File**: `packages/vike/src/node/vite/shared/resolveVikeConfigInternal/transpileAndExecuteFile.ts` (modified, +261/-170)
```diff
@@ -5,17 +5,16 @@ export { isTemporaryBuildFile }
 export type { VikeTranspileCache }
 
 import {
-  build,
-  type BuildResult,
+  rolldown,
   type Plugin,
-  formatMessages,
-  type Message,
-  version,
-  type PluginBuild,
-  type OnResolveArgs,
-  type ResolveResult,
-  type OnResolveResult,
-} from 'esbuild'
+  type PluginContext,
+  type PluginContextResolveOptions,
+  type RolldownBuild,
+  type RolldownLog,
+  type RolldownOutput,
+  VERSION,
+} from 'rolldown'
+import { parseAst } from 'rolldown/parseAst'
 import fs from 'node:fs'
 import path from 'node:path'
 import crypto from 'node:crypto'
@@ -33,19 +32,19 @@ import { isPlainJavaScriptFile, isPlainScriptFile } from '../../../../utils/isSc
 import { isVitest } from '../../../../utils/isVitest.js'
 import { assertImportIsNpmPackage, isImportNpmPackageOrPathAlias } from '../../../../utils/parseNpmPackage.js'
 import { assertPosixPath, toPosixPath } from '../../../../utils/path.js'
-import { requireResolveOptionalDir } from '../../../../utils/requireResolve.js'
-import { transformPointerImports } from './pointerImports.js'
+import { pointerImportAttributeSuffix, transformPointerImports } from './pointerImports.js'
 import sourceMapSupport from 'source-map-support'
 import type { FilePathResolved } from '../../../../types/FilePath.js'
 import { getFilePathAbsoluteUserRootDir } from '../getFilePath.js'
+import { getMagicString } from '../getMagicString.js'
 import '../../assertEnvVite.js'
 
 assertIsNotProductionRuntime()
 installSourceMapSupport()
 const debug = createDebug('vike:pointer-imports')
 const debugResolve = createDebug('vike:transpile-resolve')
 const debugConfig = createDebug('vike:config')
-if (debugResolve.isActivated) debugResolve('esbuild version', version)
+if (debugResolve.isActivated) debugResolve('rolldown version', VERSION)
 
 type FileExports = { fileExports: Record<string, unknown> }
 
@@ -159,158 +158,192 @@ async function transpileFile(
   const entryFileDir = path.posix.dirname(entryFilePath)
 
   const pointerImports: Record<string, boolean> = {}
+  const unresolvedImports: RolldownLog[] = []
+
   const plugins: Plugin[] = [
     // Determine whether an import should be:
     //  - A pointer import
     //  - Externalized
     {
-      name: 'vike-esbuild',
-      setup(build) {
-        // https://github.com/brillout/esbuild-playground
-        build.onResolve({ filter: /.*/ }, async (args) => {
-          if (args.kind !== 'import-statement') return
-
-          // Avoid infinite loop: https://github.com/evanw/esbuild/issues/3095#issuecomment-1546916366
-          if (args.pluginData?.[useEsbuildResolver]) return
-
-          const importPathOriginal = args.path
-          const isPointerImportAttribute = args.with?.['type'] === 'vike:pointer'
-
-          const resolved = await resolveImport(build, args, userRootDir)
-
-          if (resolved.errors && resolved.errors.length > 0) {
-            /* We could do the following to let Node.js throw the error, but we don't because the error shown by esbuild is prettier: the Node.js error refers to the transpiled [build-f7i251e0iwnw]+config.ts.mjs whereas esbuild refers to the source +config.ts file.
-            pointerImports[args.path] = false
-            return { external: true }
-            */
-            // Let esbuild throw the error
-            cleanEsbuildErrors(resolved.errors)
-            return resolved
-          }
-
-          assert(resolved.path)
-
-          // Built-in modules e.g. node:fs
-          // - esbuild externalizes only built-in modules and HTTP URLs (which Node.js can't import anyway): resolveImport() skips Vike's plugin and we don't use esbuild's `external` option.
-          if (resolved.external) {
-            const isPointerImport = false
-            pointerImports[args.path] = isPointerImport
-            if (debug.isActivated) debug('onResolve() [built-in module]', { args, resolved })
-            return resolved
-          }
-
-          const importP
```

#### Recent Merged Pull Requests:
- **PR #3552** (2026-09-30): fix: preserve cookies on redirects and client-side navigation (@nitedani)
- **PR #3549** (2026-09-29): minor refactoring (@brillout)
- **PR #3548** (2026-09-29): fix: don't hang `vike dev` when a `+vite` plugin has cyclic objects (@nitedani)
- **PR #3546** (2026-09-30): fix: support Vite's `builder.sharedConfigBuild: true` (@nitedani)
- **PR #3545** (2026-09-29): fix: don't mistake other plugins' virtual modules for Vike page entries (@nitedani)
- **PR #3544** (2026-09-29): fix: don't reject Vite CLI options (@nitedani)
- **PR #3543** (2026-09-29): fix: always pass the public pageContext object to users (@brillout)
- **PR #3542** (2026-09-29): test: fix flaky HMR test in testRunClassic() (@brillout)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

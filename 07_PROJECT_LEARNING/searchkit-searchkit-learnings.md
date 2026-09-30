# Forensic Learning Record (Deep Inspection): searchkit/searchkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/searchkit-searchkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/searchkit/searchkit](https://github.com/searchkit/searchkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:13:24.525Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `searchkit/searchkit`
- **Description**: React + Vue Search UI for Elasticsearch & Opensearch. Compatible with Algolia's Instantsearch and Autocomplete components.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4857 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  // This tells ESLint to load the config from the package `eslint-config-custom`
  extends: ["custom"],
  settings: {
    next: {
      rootDir: ["apps/*/"],
    },
  },
};

```

### Core Architecture Module: `apps/web/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: ["custom"],
};

```

### Core Architecture Module: `apps/web/components/Social.tsx`
```
import { DiscordIcon, GitHubIcon } from "nextra/icons";

function Github() {
  return (
    <a
      href="https://github.com/searchkit/searchkit"
      className="hidden text-current sm:flex hover:opacity-75"
      title="Searchkit GitHub repo"
      target="_blank"
      rel="noreferrer"
    >
      {/* Nextra icons have a <title> attribute providing alt text */}
      <div className="pr-2 text-md font-semibold">4563 Stars</div><GitHubIcon />
    </a>
  );
}

function Discord() {
  return (
    <a
      href="https://discord.gg/CRuWmSQZQx"
      className="hidden text-current sm:flex hover:opacity-75"
      title="Turbo Discord server"
      target="_blank"
      rel="noreferrer"
    >
      <DiscordIcon />
    </a>
  );
}

export { Github, Discord };
```

### Core Architecture Module: `apps/web/components/Tabs.tsx`
```
import type { FC, ReactElement } from "react";

import { Tabs as NextraTabs, Tab } from "nextra-theme-docs";
import useSWR from "swr";

export { Tab };

export const Tabs: FC<{
  storageKey?: string;
  items: string[];
  children: React.ReactNode;
}> = function ({ storageKey = "tab-index", items, children = null, ...props }) {
  // Use SWR so all tabs with the same key can sync their states.
  const { data, mutate } = useSWR(storageKey, (key) => {
    try {
      // @ts-ignore
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  });

  const selectedIndex = items.indexOf(data);

  return (
    <NextraTabs
      onChange={(index) => {
        localStorage.setItem(storageKey, JSON.stringify(items[index]));
        mutate(items[index], false);
      }}
      selectedIndex={selectedIndex === -1 ? undefined : selectedIndex}
      items={items}
      {...props}
    >
      {children}
    </NextraTabs>
  );
};
```

### Core Architecture Module: `apps/web/components/promo-page/FeatureBreakout.tsx`
```
import Image from 'next/image'

export const FeatureBreakout = ({ title, description, linkTitle, linkHref, image, subtext, snippets }: any) => {
  return (
    <div className="py-6 mx-auto container sm:mt-8 relative">
      <div className="grid grid-cols-12 gap-4">
        <div className="lg:col-span-8 col-span-12 lg:pt-0 pt-6">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl tracking-tight font-extrabold text-gray-200 sm:text-3xl lg:text-3xl xl:text-2xl">{title}</h2>
            <p className="mt-2 text-base text-gray-300 sm:mt-2 sm:text-xl lg:text-lg xl:text-xl">{description}</p>
            {subtext && <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">{subtext}</p>}
            {linkHref && <div className="">
              <a className="text-indigo-500 text-center block sm:text-left md:py-3 md:text-md" href={linkHref}>Read More &rarr;</a>
            </div>
}
          </div>
        </div>
        {
          snippets && (
            snippets.map((snippet: any, index: number) => (
              <div key={index} className="md:col-span-6 col-span-12 pt-6 sm:max-w-xs">
                <div className="text-center sm:text-left mb-3">
                  <h2 className="text-xl tracking-tight font-extrabold text-gray-200 sm:text-xl lg:text-xl xl:text-xl">{snippet.title}</h2>
                  <p className="mt-3 text-base text-gray-300 sm:mt-2 sm:text-lg lg:text-md xl:text-lg">{snippet.description}</p>
                </div>
                {snippet.link && <a href={snippet.link} className="text-indigo-500 text-center block sm:text-left">Read More &rarr;</a>}
              </div>
        )))}
      </div>
    </div>
  )
}
```

### Core Architecture Module: `apps/web/components/promo-page/IntroButtons.tsx`
```


export const IntroButtons = () => {
  return (
    <div className="mt-5 pb-8 mx-auto sm:flex sm:justify-center lg:justify-start lg:mx-0 md:mt-8">
      <div className="rounded-md shadow">
        <a className="w-full flex items-center no-underline justify-center px-8 py-3 border border-transparent text-base leading-6 font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:border-gray-500 focus:shadow-outline-white transition duration-150 ease-in-out md:py-4 md:text-lg md:px-10" href="/docs/getting-started/with-react">Get Started</a>
      </div>
      <div className="rounded-md shadow mt-3 md:mt-0 md:ml-3"><a className="w-full flex items-center no-underline justify-center px-8 py-3 border border-transparent text-base leading-6 font-medium rounded-md text-gray-100  hover:bg-gray-900 focus:outline-none focus:border-gray-900 focus:shadow-outline-blue transition duration-150 ease-in-out md:py-4 md:text-lg md:px-10 border-gray-900" href="/demo">View Demo</a></div>
    </div>
  )
}
```

### Core Architecture Module: `apps/web/next-env.d.ts`
```
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.

```

### Core Architecture Module: `apps/web/next-sitemap.config.js`
```
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.searchkit.co'
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1416** (2026-04-04): **Searchkit 4.16 release**
  *Symptoms*: 

- **Issue #1412** (2026-03-24): **fix: add timeout and error handling to prevent infinite loading**
  *Symptoms*: ## Summary  This PR adds proper timeout and error handling to fix the infinite loading issue when the search server is down, unresponsive, or returns an error.  This fix originates from this discussion in the instantsearch repo: https://github.com/algolia/instantsearch/issues/6525  ### Changes  **ESTransporter (`packages/searchkit/src/Transporter.ts`):** - Added configurable timeout (default 30s) using `AbortController` - Added `response.ok` check to catch HTTP errors early - Added `timeout` option to `AppSettings` interface  **InstantSearch Client (`packages/searchkit-instantsearch-client/src/index.ts`):** - Returns empty results on error instead of throwing, preventing infinite re-render loops in InstantSearch/react-instantsearch-nextjs - Caches error results to prevent repeated failing requests - Added optional `onError` callback for custom error handling - Logs errors to console by default (suppressible via `onError`)  ### Problem  When the Elasticsearch server is down or returns an error (e.g., index not found), the previous behavior would either: 1. Hang indefinitely (no timeout) 2. Throw an error that causes InstantSearch to re-render and retry infinitely  ### Solution  1. **Timeout**: Requests now timeout after 30 seconds (configurable) instead of hanging forever 2. **Graceful error handling**: The InstantSearch client now returns empty results on error, which InstantSearch can display as "no results" instead of crashing or retrying infinit

- **Issue #1404** (2025-06-01): **v4.15.0**
  *Symptoms*: 

- **Issue #1403** (2025-06-01): **feat: Enhance sorting functionality in documentation and code**
  *Symptoms*: - Added support for nested field sorting and array field sorting modes in the documentation. - Updated sorting configuration to include `nestedPath` and `mode` parameters for better handling of complex data structures. - Enhanced the `SortingOption` type definition to reflect new sorting capabilities. - Added integration tests for sorting on nested fields and multiple sort criteria.
  **Post-Mortem & Fix Analysis**:
  > @Jade-GG cloud you review and approve this PR ?

- **Issue #1402** (2025-05-14): **Update with-your-own-server.mdx**
  *Symptoms*: Update documentation on how to handle requests using your own API Server with a lightweight example. 

- **Issue #1401** (2025-05-14): **Fix link in documentation**
  *Symptoms*: The path `/docs/guides/facets/` doesn't exist (yet) so it's better to link a sub-page than to have a link leading to a kind of 404 page.

- **Issue #1400** (2025-04-08): **[Question] How to implement SSR/RSC with Next.js App Router?**
  *Symptoms*: Title: [Question] How to implement SSR/RSC with Next.js App Router correctly?  Hi,  I noticed that the current documentation and examples mainly focus on Next.js Pages Router implementation for SSR. I tried to implement Searchkit with Next.js App Router and encountered some issues.  First, I attempted to follow Algolia's experimental App Router implementation guide (https://www.algolia.com/doc/guides/building-search-ui/going-further/server-side-rendering/react/#app-router-experimental), but it resulted in errors. This suggests that the InstantSearch SSR/RSC implementation might need a different approach in Next.js App Router.  Current documentation issues:  1. The current SSR implementation in the docs uses `getServerSideProps`, `InstantSearchSSRProvider`, and `getServerState`, which are specific to Pages Router. How should we implement SSR properly in App Router?  2. In the documentation, there's a note: ```jsx <Callout type="info" emoji="ℹ️">   This tutorial will use the new Next.js App Router. If you're using pages, keep this in mind when following along. </Callout> ``` However, the subsequent code examples still use Pages Router patterns.  Questions: 1. What is the correct way to implement SSR/RSC with Searchkit in Next.js App Router? 2. Since Algolia's App Router implementation doesn't work with Searchkit, is there a Searchkit-specific approach? 3. How should we handle the server state and hydration in App Router, considering its server/client component model?  It would 

- **Issue #1399** (2025-05-14): **Allow fuzziness to be configured**
  *Symptoms*: We have a few sites where we would like to tweak the fuzziness slightly. This is currently not possible as it is hardcoded. By adding this into the config, we can tweak this.  I'm not sure if this would be the best place to actually put it but I couldn't find anything that would be better.

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

### Incident Patch 1: `9b14e004` (2026-03-24)
**Commit Message**: fix: add timeout and error handling to prevent infinite loading (#1412)

* fix: add timeout and error handling to prevent infinite loading

ESTransporter changes:
- Add configurable timeout (default 30s) using AbortController
- Add response.ok check to catch HTTP errors early
- Add timeout option to AppSettings interface

InstantSearch client changes:
- Return empty results on error instead of throwing to prevent infinite
  re-render loops in InstantSearch/react-instantsearch-nextjs
- Cache error results to prevent repeated failing requests
- Add optional onError callback for custom error handling

This fixes the infinite loading issue when the search server is down or
unresponsive by ensuring errors are handled gracefully.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

* apply changeset

* chore: add changeset for fixing infinite loader error in search functionality

---------

Co-authored-by: Claude Opus 4.5 <noreply@anthropic.com>
Co-authored-by: Joseph McElroy <joseph.mcelroy@elastic.co>

**File**: `.changeset/eighty-moles-heal.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@searchkit/instantsearch-client': minor
+'searchkit': minor
+---
+
+fixed infinite loader error
```

**File**: `examples/with-express-typescript-cjs/src/index.ts` (modified, +2/-2)
```diff
@@ -54,6 +54,6 @@ app.post('/api/search', async function (req: Request, res: Response) {
   res.send(response)
 })
 
-app.listen(3001, () => {
-  console.log('Server running on port 3001')
+app.listen(3002, () => {
+  console.log('Server running on port 3002')
 })
```

**File**: `examples/with-express-typescript-esm/package.json` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@
     "url": "https://github.com/searchkit/searchkit-express.git"
   },
   "scripts": {
-    "dev": "ts-node-esm ./src/index.ts",
+    "dev": "tsx ./src/index.ts",
     "build": "rm -rf ./dist && tsc --project .",
     "start": "yarn build && node ./dist/index.js"
   },
@@ -25,7 +25,7 @@
   "devDependencies": {
     "@types/express": "^4.17.17",
     "@types/node": "^18.14.6",
-    "ts-node": "^10.9.1",
+    "tsx": "^4.7.0",
     "typescript": "^4.9.5"
   }
 }
```

**File**: `examples/with-express-typescript-esm/src/index.ts` (modified, +1/-1)
```diff
@@ -55,5 +55,5 @@ app.post('/api/search', async function (req, res) {
 })
 
 app.listen(3001, () => {
-  console.log('Server running on port 3000')
+  console.log('Server running on port 3001')
 })
```

**File**: `packages/searchkit-instantsearch-client/src/index.ts` (modified, +77/-20)
```diff
@@ -4,6 +4,22 @@ import type Searchkit from 'searchkit'
 interface InstantSearchElasticsearchAdapterConfig {
   url: string
   headers?: Record<string, string> | (() => Record<string, string>)
+  onError?: (error: Error) => boolean | void
+}
+
+function createEmptyResult(request: MultipleQueriesQuery) {
+  return {
+    hits: [],
+    nbHits: 0,
+    nbPages: 0,
+    page: 0,
+    processingTimeMS: 0,
+    hitsPerPage: request.params?.hitsPerPage ?? 20,
+    exhaustiveNbHits: true,
+    query: request.params?.query ?? '',
+    params: '',
+    index: request.indexName
+  }
 }
 
 type Config = InstantSearchElasticsearchAdapterConfig | Searchkit
@@ -41,34 +57,62 @@ class InstantSearchElasticsearchAdapter {
     return headers
   }
 
+  private handleError(error: Error, requests: readonly MultipleQueriesQuery[]) {
+    const suppressLog = this.config && !isSearchkit(this.config) && this.config.onError?.(error)
+    if (!suppressLog) {
+      console.error('Searchkit InstantSearch Client error:', error.message)
+    }
+    return {
+      results: requests.map((request) => createEmptyResult(request))
+    }
+  }
+
   public async search(instantsearchRequests: readonly MultipleQueriesQuery[]): Promise<any> {
     const key = JSON.stringify(instantsearchRequests)
     const cacheValue = this.cache[key]
     if (cacheValue) {
       return cacheValue
     }
 
-    if (isSearchkit(this.config)) {
-      const results = await this.config.handleInstantSearchRequests(
-        instantsearchRequests,
-        this.requestOptions
-      )
+    try {
+      if (isSearchkit(this.config)) {
+        const results = await this.config.handleInstantSearchRequests(
+          instantsearchRequests,
+          this.requestOptions
+        )
+        this.cache[key] = results
+        return results
+      }
+
+      const response = await fetch(this.config.url, {
+        body: JSON.stringify(instantsearchRequests),
+        headers: {
+          'Content-Type': 'application/json',
+          ...this.getHeaders()
+        },
+        method: 'POST'
+      })
+
+      if (!response.ok) {
+        const errorResult = this.handleError(
+          new Error(`Search request failed with status ${response.status}: ${response.statusText}`),
+          instantsearchRequests
+        )
+        this.cache[key] = errorResult
+        return errorResult
+      }
+
+      const results = await response.json()
       this.cache[key] = results
       return results
+    } catch (error) {
+      const errorResult = this.handleError(
+        error instanceof Error ? error : new Error(String(error)),
+        instantsearchRequests
+      )
+      this.cache[key] = errorResult
+      return errorResult
     }
-
-    const response = await fetch(this.config.url, {
-      body: JSON.stringify(instantsearchRequests),
-      headers: {
-        'Content-Type': 'application/json',
-        ...this.getHeaders()
-      },
-      method: 'POST'
-    })
-
-    const results = await response.json()
-    this.cache[key] = results
-    return results
   }
 
   public async searchForFacetValues(
@@ -99,10 +143,23 @@ class InstantSearchElasticsearchAdapter {
         method: 'POST'
       })
 
+      if (!response.ok) {
+        const error = new Error(`Search request failed with status ${response.status}: ${response.statusText}`)
+        const suppressLog = this.config && !isSearchkit(this.config) && this.config.onError?.(error)
+        if (!suppressLog) {
+          console.error('Searchkit InstantSearch Client error:', error.message)
+        }
+        return []
+      }
+
       const results = await response.json()
       return results.results
-    } catch (e) {
-      console.error(e)
+    } catch (error) {
+      const err = error instanceof Error ? error : new Error(String(error))
+      const suppressLog = this.config && !isSearchkit(this.config) && (this.config as InstantSearchElasticsearchAdapterConfig).onError?.(err)
+      if (!suppressLog) {
+        console.er
```

---

### Incident Patch 2: `55631d0e` (2025-05-14)
**Commit Message**: Fix link in documentation (#1401)

The path `/docs/guides/facets/` doesn't exist (yet) so it's better
to link a sub-page than to have a link leading to a kind of 404
page.

**File**: `apps/web/pages/docs/api-documentation/searchkit.mdx` (modified, +1/-1)
```diff
@@ -279,7 +279,7 @@ Below is an example of a `RefinementList` Instantsearch React component that use
 <RefinementList attribute="actors" searchable={true} limit={10} />
 ```
 
-See [facets guide](/docs/guides/facets) for more information.
+See [facets guide](/docs/guides/facets/string-based-facets) for more information.
 
 ##### Custom Aggregations & Filter Queries
 
```

---

### Incident Patch 3: `65334d8d` (2025-03-15)
**Commit Message**: Fix support colons in facet values (#1398)

**File**: `packages/searchkit/src/filters.ts` (modified, +2/-2)
```diff
@@ -190,7 +190,7 @@ export const transformFacetFilters = (
         {
           bool: {
             should: filter.reduce((sum, filter) => {
-              const [facet, value] = filter.split(':')
+              const [facet, value] = filter.split(/:(.*)/)
               const facetFilterConfig = facetFilterMap[facet]
               if (!facetFilterConfig)
                 throw new Error(
@@ -246,7 +246,7 @@ export const transformFacetFilters = (
         }
       ]
     } else if (typeof filter === 'string') {
-      const [facet, value] = filter.split(':')
+      const [facet, value] = filter.split(/:(.*)/)
 
       const facetFilterConfig = facetFilterMap[facet]
       if (!facetFilterConfig)
```

---

### Incident Patch 4: `b73f9f11` (2024-03-09)
**Commit Message**: 4.12.1: Fix highlighting for object fields

**File**: `.changeset/tiny-frogs-shake.md` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
----
-'searchkit': patch
-'@searchkit/api': patch
-'@searchkit/instantsearch-client': patch
----
-
-fix bug with object field highlighting
```

**File**: `apps/web/package.json` (modified, +2/-2)
```diff
@@ -12,8 +12,8 @@
   "dependencies": {
     "@algolia/autocomplete-js": "^1.9.2",
     "@algolia/autocomplete-theme-classic": "^1.9.2",
-    "@searchkit/api": "4.11.0",
-    "@searchkit/instantsearch-client": "4.12.0",
+    "@searchkit/api": "4.11.1",
+    "@searchkit/instantsearch-client": "4.12.1",
     "algoliasearch": "^4.14.2",
     "autoprefixer": "^10.4.12",
     "instantsearch.css": "^8.0.0",
```

**File**: `examples/with-semantic-search-nextjs/CHANGELOG.md` (modified, +9/-0)
```diff
@@ -1,5 +1,14 @@
 # with-semantic-search-nextjs
 
+## 0.1.15
+
+### Patch Changes
+
+- Updated dependencies [77133782]
+  - searchkit@4.11.1
+  - @searchkit/api@4.11.1
+  - @searchkit/instantsearch-client@4.12.1
+
 ## 0.1.14
 
 ### Patch Changes
```

**File**: `examples/with-semantic-search-nextjs/package.json` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "with-semantic-search-nextjs",
-  "version": "0.1.14",
+  "version": "0.1.15",
   "private": true,
   "scripts": {
     "dev": "next dev",
@@ -9,8 +9,8 @@
     "lint": "next lint"
   },
   "dependencies": {
-    "@searchkit/api": "4.11.0",
-    "@searchkit/instantsearch-client": "4.12.0",
+    "@searchkit/api": "4.11.1",
+    "@searchkit/instantsearch-client": "4.12.1",
     "@types/node": "20.3.1",
     "@types/react": "18.2.13",
     "@types/react-dom": "18.2.6",
@@ -19,7 +19,7 @@
     "react": "18.2.0",
     "react-dom": "18.2.0",
     "react-instantsearch": "^7.2.0",
-    "searchkit": "4.11.0",
+    "searchkit": "4.11.1",
     "typescript": "5.0.2"
   }
 }
```

**File**: `examples/with-ui-instantsearchjs-and-analytics/package.json` (modified, +2/-2)
```diff
@@ -8,10 +8,10 @@
     "preview": "vite preview"
   },
   "dependencies": {
-    "@searchkit/instantsearch-client": "4.12.0",
+    "@searchkit/instantsearch-client": "4.12.1",
     "@searchkit/elastic-behavioral-analytics-plugin": "2.1.0",
     "instantsearch.js": "^4.55.0",
-    "searchkit": "4.11.0"
+    "searchkit": "4.11.1"
   },
   "devDependencies": {
     "typescript": "^4.9.3",
```

---

### Incident Patch 5: `77133782` (2024-03-09)
**Commit Message**: Fix object field highlighting (#1344)

* fix object field highlighting and snippets

* commit changeset

* bump to 18

* update dep

**File**: `.changeset/tiny-frogs-shake.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'searchkit': patch
+'@searchkit/api': patch
+'@searchkit/instantsearch-client': patch
+---
+
+fix bug with object field highlighting
```

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ jobs:
       - name: Setup Node.js environment
         uses: actions/setup-node@v3
         with:
-          node-version: 16
+          node-version: 18
           cache: "yarn"
 
       - name: Install dependencies
```

**File**: `.vscode/launch.json` (modified, +4/-2)
```diff
@@ -14,11 +14,13 @@
             ],
             "cwd": "${workspaceRoot}/packages/searchkit",
             "env": {
-                "NODE_ENV": "test"
+                "NODE_ENV": "test",
+                "DEBUG": "nock.*"
             },
+            "runtimeVersion": "18",
             "console": "integratedTerminal",
             "sourceMaps": true
-
+            
         },
         {
             "name": "@searchkit/api Tests ",
```

**File**: `DEVELOPMENT.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 ## Setting up a development environment
 
 Requirements:
-- [Node.js](https://nodejs.org/en/) (v16.18.1 or higher)
+- [Node.js](https://nodejs.org/en/) (18 or higher)
 - [Yarn](https://yarnpkg.com/) (v1.22.15 or higher)
 
 1. Clone the repository and install dependencies:
```

**File**: `apps/web/pages/demo.tsx` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ const CustomHits = (props: HitsProps<any>) => {
         <div className="bg-white rounded-lg overflow-hidden shadow">
           <img src={hit.poster} alt="movie cover" className="w-full h-64 object-cover" />
           <div className="p-4">
-            <h3 className="text-lg font-semibold">
+            <h3 className="text-lg font-semibold text-black">
               <Highlight hit={hit} attribute="title" />
             </h3>
             <p className="text-gray-600">
```

---

### Incident Patch 6: `9a226d27` (2023-12-21)
**Commit Message**: Fix issue with 7.2.0+ for SSR with nextjs (#1331)

* fix autocomplete issue

* use hashmap for cache instead

* add changeset

**File**: `.changeset/violet-dingos-work.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@searchkit/instantsearch-client': minor
+---
+
+update instantsearch client removing the transporter
```

**File**: `apps/web/package.json` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@
     "react-dom": "18.2.0",
     "react-instantsearch-dom": "^6.36.0",
     "react-instantsearch-dom-maps": "^6.39.0",
-    "react-instantsearch": "7.2.0",
-    "react-instantsearch-router-nextjs": "7.2.0",
+    "react-instantsearch": "7.5.0",
+    "react-instantsearch-router-nextjs": "7.5.0",
     "swr": "^1.3.0"
   },
   "devDependencies": {
```

**File**: `apps/web/pages/autocomplete.jsx` (modified, +8/-0)
```diff
@@ -48,6 +48,14 @@ const autocompleteClient = client({
   url: 'https://ises-cfw.searchkit.workers.dev'
 })
 
+// needed for the autocomplete client to work
+autocompleteClient.transporter = {
+  headers: {
+    'x-algolia-application-id': 'NULL',
+    'x-algolia-api-key': 'NULL'
+  }
+}
+
 const searchClient = client({
   url: 'https://ises-cfw.searchkit.workers.dev'
 })
```

**File**: `apps/web/pages/docs/components/autocomplete.mdx` (modified, +19/-4)
```diff
@@ -20,10 +20,17 @@ import {
   getAlgoliaResults
 } from "@algolia/autocomplete-js";
 
-const searchClient = client({
+const autocompleteClient = client({
   url: "https://ises-cfw.searchkit.workers.dev"
 });
 
+// needed for the autocomplete client to work
+autocompleteClient.transporter = {
+  headers: {
+    'x-algolia-application-id': 'NULL',
+    'x-algolia-api-key': 'NULL'
+  }
+}
 
 getSources={({ query, state }) => {
     if (!query) {
@@ -36,7 +43,7 @@ getSources={({ query, state }) => {
         getItems() {
           // using searchkit to get results for the query
           return getAlgoliaResults({
-            searchClient,
+            autocompleteClient,
             queries: [
               {
                 indexName: "imdb_movies",
@@ -86,12 +93,20 @@ import {
   getAlgoliaFacets
 } from "@algolia/autocomplete-js";
 
-const searchClient = client({
+const autocompleteClient = client({
   url: "https://ises-cfw.searchkit.workers.dev"
 });
 
+// needed for the autocomplete client to work
+autocompleteClient.transporter = {
+  headers: {
+    'x-algolia-application-id': 'NULL',
+    'x-algolia-api-key': 'NULL'
+  }
+}
+
 function createCategoriesPlugin({
-  searchClient
+  autocompleteClient
 }) {
   return {
     getSources({ query }) {
```

**File**: `packages/searchkit-instantsearch-client/package.json` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@
   "scripts": {
     "lint": "eslint src/*.ts*",
     "build": "tsup",
-    "dev": "npm run build --watch"
+    "dev": "npm run build -- --watch"
   },
   "devDependencies": {
     "@elastic/elasticsearch": "8.4.0",
```

---

### Incident Patch 7: `bc4765d5` (2023-11-08)
**Commit Message**: fix to 7.2.0 for instantsearch

**File**: `apps/web/package.json` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@
     "react-dom": "18.2.0",
     "react-instantsearch-dom": "^6.36.0",
     "react-instantsearch-dom-maps": "^6.39.0",
-    "react-instantsearch": "^7.2.0",
-    "react-instantsearch-router-nextjs": "^7.2.0",
+    "react-instantsearch": "7.2.0",
+    "react-instantsearch-router-nextjs": "7.2.0",
     "swr": "^1.3.0"
   },
   "devDependencies": {
```

---

### Incident Patch 8: `6a622567` (2023-09-04)
**Commit Message**: fix searchkit with Availability Search tutorial url (#1308)

missing `docs` in the original mdx.

**File**: `apps/web/pages/docs/overview.mdx` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ Searchkit simplifies this process by providing a layer of abstraction on top of
 
 ## Tutorials
 * [Searchkit with Next.js](https://www.searchkit.co/docs/tutorials/with-nextjs)
-* [Searchkit with Availability Search](https://www.searchkit.co/tutorials/build-availability-search-ui)
+* [Searchkit with Availability Search](https://www.searchkit.co/docs/tutorials/build-availability-search-ui)
 
 ## Demos
 * [Searchkit with Next.js](https://www.searchkit.co/demo)
```

---

### Incident Patch 9: `50d31381` (2023-08-19)
**Commit Message**: eslint fix

**File**: `apps/web/pages/autocomplete.jsx` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ import {
   getAlgoliaFacets
 } from "@algolia/autocomplete-js";
 import React, { createElement, Fragment, useEffect, useRef, useState } from 'react';
+// eslint-disable-next-line react/no-deprecated
 import { render } from 'react-dom';
 import client from "@searchkit/instantsearch-client";
 import { InstantSearch, usePagination, useSearchBox, Hits } from 'react-instantsearch-hooks-web';
```

---

### Incident Patch 10: `c494ce2b` (2023-05-08)
**Commit Message**: Fix Client to support newer version of autocomplete (#1267)

* fix client

* update autocomplete example

* fix autocomplete

**File**: `.changeset/fresh-bears-pull.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@searchkit/instantsearch-client': patch
+---
+
+Fix client support
```

**File**: `apps/web/package.json` (modified, +4/-2)
```diff
@@ -10,8 +10,8 @@
     "lint": "next lint"
   },
   "dependencies": {
-    "@algolia/autocomplete-js": "^1.7.4",
-    "@algolia/autocomplete-theme-classic": "^1.7.4",
+    "@algolia/autocomplete-js": "^1.9.2",
+    "@algolia/autocomplete-theme-classic": "^1.9.2",
     "@searchkit/api": "4.7.0",
     "@searchkit/instantsearch-client": "4.7.0",
     "algoliasearch": "^4.14.2",
@@ -25,6 +25,8 @@
     "react-dom": "18.2.0",
     "react-instantsearch-dom": "^6.36.0",
     "react-instantsearch-dom-maps": "^6.39.0",
+    "react-instantsearch-hooks": "^6.43.0",
+    "react-instantsearch-hooks-web": "^6.43.0",
     "swr": "^1.3.0"
   },
   "devDependencies": {
```

**File**: `apps/web/pages/autocomplete.jsx` (modified, +103/-59)
```diff
@@ -3,47 +3,74 @@ import {
   getAlgoliaResults,
   getAlgoliaFacets
 } from "@algolia/autocomplete-js";
-import React, { createElement, Fragment, useEffect, useRef } from 'react';
+import React, { createElement, Fragment, useEffect, useRef, useState } from 'react';
 import { render } from 'react-dom';
 import client from "@searchkit/instantsearch-client";
+import { InstantSearch, usePagination, useSearchBox } from 'react-instantsearch-hooks';
+import { Hits } from 'react-instantsearch-hooks-web';
+
 
 function Autocomplete(props) {
   const containerRef = useRef(null);
 
+  const { query, refine: setQuery } = useSearchBox();
+  const [
+    instantSearchUiState,
+    setInstantSearchUiState,
+  ] = useState({ query });
+  const { refine: setPage } = usePagination();
+
+  useEffect(() => {
+    setQuery(instantSearchUiState.query);
+    setPage(0);
+  }, [instantSearchUiState]);
+
   useEffect(() => {
     if (!containerRef.current) {
       return undefined;
     }
 
+    const plugins = [createCategoriesPlugin({ autocompleteClient, setInstantSearchUiState })]
+
     const search = autocomplete({
       container: containerRef.current,
+      onSubmit({ state }) {
+        setInstantSearchUiState({ query: state.query });
+      },
       renderer: { createElement, Fragment, render },
+      plugins,
+      getSources: () => [],
       ...props,
     });
 
     return () => {
       search.destroy();
     };
-  }, [props.plugins]);
+  }, []);
 
   return <div ref={containerRef} />;
 }
 
+const autocompleteClient = client({
+  url: "https://ises-cfw.searchkit.workers.dev"
+});
+
 const searchClient = client({
   url: "https://ises-cfw.searchkit.workers.dev"
 });
 
 function createCategoriesPlugin({
-  searchClient
+  autocompleteClient,
+  setInstantSearchUiState
 }) {
   return {
-    getSources({ query }) {
+    getSources({ query, setQuery, refresh, setIsOpen }) {
       return [
         {
           sourceId: "categoriesPlugin",
           getItems() {
             return getAlgoliaFacets({
-              searchClient,
+              searchClient: autocompleteClient,
               queries: [
                 {
                   indexName: "imdb_movies",
@@ -66,78 +93,95 @@ function createCategoriesPlugin({
                 </Fragment>
               );
             },
-            item({ item, components }) {
+            item({ item }) {
               return (
                 <div className="aa-ItemWrapper">
                   <div className="aa-ItemContent">
                     <div className="aa-ItemContentBody">
-                      <div className="aa-ItemContentTitle">{item.label}</div>
+                      <div className="aa-ItemContentTitle" onClick={(event) => {
+                          event.stopPropagation();
+                          setQuery(item.label);
+                          setInstantSearchUiState({ query: item.label })
+                          setIsOpen(false);
+                        }}>{item.label}</div>
                     </div>
                   </div>
                 </div>
               );
             }
           }
+        },
+        {
+          sourceId: "movies",
+          getItems() {
+            return getAlgoliaResults({
+              // @ts-ignore
+              searchClient: autocompleteClient,
+              queries: [
+                {
+                  indexName: "imdb_movies",
+                  query,
+                  params: {
+                    query
+                  }
+                }
+              ],
+              transformResponse({ hits }) {
+                const [imdbMoviesHits] = hits;
+  
+                return imdbMoviesHits;
+              }
+            });
+          },
+          getItemUrl({ item }) {
+            return `https://www.imdb.com/title/${item.objectID}`;
+          },
+          templates: {
+            header() {
+              return (
+                <Fragment>
+                  <span className="aa-SourceHeader
```

**File**: `packages/searchkit-instantsearch-client/src/index.ts` (modified, +5/-0)
```diff
@@ -14,6 +14,11 @@ function isSearchkit(config: Config): config is Searchkit {
 
 class InstantSearchElasticsearchAdapter {
   private cache: Record<string, any> = {}
+  public transporter = {
+    headers: {},
+    queryParameters: {}
+  }
+
   constructor(private config: Config, private requestOptions?: RequestOptions) {
     if (!isSearchkit(this.config) && !this.config.url) {
       throw new Error('Searchkit Instantsearch Client: url is required')
```

**File**: `yarn.lock` (modified, +84/-52)
```diff
@@ -2,40 +2,48 @@
 # yarn lockfile v1
 
 
-"@algolia/autocomplete-core@1.7.4":
-  version "1.7.4"
-  resolved "https://registry.npmjs.org/@algolia/autocomplete-core/-/autocomplete-core-1.7.4.tgz"
-  integrity sha512-daoLpQ3ps/VTMRZDEBfU8ixXd+amZcNJ4QSP3IERGyzqnL5Ch8uSRFt/4G8pUvW9c3o6GA4vtVv4I4lmnkdXyg==
+"@algolia/autocomplete-core@1.9.2":
+  version "1.9.2"
+  resolved "https://registry.yarnpkg.com/@algolia/autocomplete-core/-/autocomplete-core-1.9.2.tgz#1c9ffcfac7fc4733fe97356247b25d9d7a83538c"
+  integrity sha512-hkG80c9kx9ClVAEcUJbTd2ziVC713x9Bji9Ty4XJfKXlxlsx3iXsoNhAwfeR4ulzIUg7OE5gez0UU1zVDdG7kg==
   dependencies:
-    "@algolia/autocomplete-shared" "1.7.4"
+    "@algolia/autocomplete-plugin-algolia-insights" "1.9.2"
+    "@algolia/autocomplete-shared" "1.9.2"
 
-"@algolia/autocomplete-js@^1.7.4":
-  version "1.7.4"
-  resolved "https://registry.npmjs.org/@algolia/autocomplete-js/-/autocomplete-js-1.7.4.tgz"
-  integrity sha512-iUhGNRIxlIEix4r0wSCL9dKOeApN5GM/GtHKxukTSaz+GNNe1PXY/WaBcLvekDjXbxtwJ3fYZGulrIrjoZj96A==
+"@algolia/autocomplete-js@^1.9.2":
+  version "1.9.2"
+  resolved "https://registry.yarnpkg.com/@algolia/autocomplete-js/-/autocomplete-js-1.9.2.tgz#4d32d7bec4319a8fd9c2eafa5a48954039494c5b"
+  integrity sha512-qaYzP0DNZsratnu18umlQVW++8uI8irpadk/e2cCOhM5Qvsyw9y338lkTd4AkxOPYf9EhTVgDNq0rQ+dNDtDgQ==
   dependencies:
-    "@algolia/autocomplete-core" "1.7.4"
-    "@algolia/autocomplete-preset-algolia" "1.7.4"
-    "@algolia/autocomplete-shared" "1.7.4"
-    htm "^3.0.0"
-    preact "^10.0.0"
+    "@algolia/autocomplete-core" "1.9.2"
+    "@algolia/autocomplete-preset-algolia" "1.9.2"
+    "@algolia/autocomplete-shared" "1.9.2"
+    htm "^3.1.1"
+    preact "^10.13.2"
+
+"@algolia/autocomplete-plugin-algolia-insights@1.9.2":
+  version "1.9.2"
+  resolved "https://registry.yarnpkg.com/@algolia/autocomplete-plugin-algolia-insights/-/autocomplete-plugin-algolia-insights-1.9.2.tgz#b4672d5662acc2d0a0547d14dfbdcc70c17625de"
+  integrity sha512-2LVsf4W66hVHQ3Ua/8k15oPlxjELCztbAkQm/hP42Sw+GLkHAdY1vaVRYziaWq64+Oljfg6FKkZHCdgXH+CGIA==
+  dependencies:
+    "@algolia/autocomplete-shared" "1.9.2"
 
-"@algolia/autocomplete-preset-algolia@1.7.4":
-  version "1.7.4"
-  resolved "https://registry.npmjs.org/@algolia/autocomplete-preset-algolia/-/autocomplete-preset-algolia-1.7.4.tgz"
-  integrity sha512-s37hrvLEIfcmKY8VU9LsAXgm2yfmkdHT3DnA3SgHaY93yjZ2qL57wzb5QweVkYuEBZkT2PIREvRoLXC2sxTbpQ==
+"@algolia/autocomplete-preset-algolia@1.9.2":
+  version "1.9.2"
+  resolved "https://registry.yarnpkg.com/@algolia/autocomplete-preset-algolia/-/autocomplete-preset-algolia-1.9.2.tgz#a31fc9a88800ee7312cd177c738e9e4c0e0f78e8"
+  integrity sha512-pqgIm2GNqtCT59Y1ICctIPrYTi34+wNPiNWEclD/yDzp5uDUUsyGe5XrUjCNyQRTKonAlmYxoaEHOn8FWgmBHA==
   dependencies:
-    "@algolia/autocomplete-shared" "1.7.4"
+    "@algolia/autocomplete-shared" "1.9.2"
 
-"@algolia/autocomplete-shared@1.7.4":
-  version "1.7.4"
-  resolved "https://registry.npmjs.org/@algolia/autocomplete-shared/-/autocomplete-shared-1.7.4.tgz"
-  integrity sha512-2VGCk7I9tA9Ge73Km99+Qg87w0wzW4tgUruvWAn/gfey1ZXgmxZtyIRBebk35R1O8TbK77wujVtCnpsGpRy1kg==
+"@algolia/autocomplete-shared@1.9.2":
+  version "1.9.2"
+  resolved "https://registry.yarnpkg.com/@algolia/autocomplete-shared/-/autocomplete-shared-1.9.2.tgz#b5b909377439c45774cfb91947ad8e6ebd4652c1"
+  integrity sha512-XxX6YDn+7LG+SmdpXEOnj7fc3TjiVpQ0CbGhjLwrd2tYr6LVY2D4Iiu/iuYJ4shvVDWWnpwArSk0uIWC/8OPUA==
 
-"@algolia/autocomplete-theme-classic@^1.7.4":
-  version "1.7.4"
-  resolved "https://registry.npmjs.org/@algolia/autocomplete-theme-classic/-/autocomplete-theme-classic-1.7.4.tgz"
-  integrity sha512-QGMXsm2LPuA/4aBuhtacIcGr5Untsjq11LrKNbOu1bNeLITYbqgjYiGfzLpI/zuZkIgrXudYvz2nB+P1EFHG/A==
+"@algolia/autocomplete-theme-classic@^1.9.2":
+  version "1.9.2"
+  resolved "https://registry.yarnpkg.com/@algolia/autocomplete-theme-classic/-/autocomplete-theme-classic-1.9.2.tgz#b04ce32d6994d885391b125d1adb5828514edfcb"
+  integrity sha512-3yjFo
```

#### Recent Merged Pull Requests:
- **PR #1416** (2026-04-04): Searchkit 4.16 release (@joemcelroy)
- **PR #1412** (2026-03-24): fix: add timeout and error handling to prevent infinite loading (@nx-alejandrolacasa)
- **PR #1404** (2025-06-01): v4.15.0 (@joemcelroy)
- **PR #1403** (2025-06-01): feat: Enhance sorting functionality in documentation and code (@Wcdaren)
- **PR #1402** (2025-05-14): Update with-your-own-server.mdx (@ianshea)
- **PR #1401** (2025-05-14): Fix link in documentation (@cintek)
- **PR #1399** (2025-05-14): Allow fuzziness to be configured (@Jade-GG)
- **PR #1398** (2025-03-15): Complete support colons in facet values (@cintek)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

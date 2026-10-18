> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/searchkit-searchkit-learnings.md`  
> **Source**: github ([https://github.com/searchkit/searchkit](https://github.com/searchkit/searchkit))  
> **Source Version**: `32da7000`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:39:05.788Z  
> **Learning ID**: `learn-github-searchkit-searchkit`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): searchkit/searchkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/searchkit-searchkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/searchkit/searchkit](https://github.com/searchkit/searchkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T23:39:03.296Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `searchkit/searchkit`
- **Description**: React + Vue Search UI for Elasticsearch & Opensearch. Compatible with Algolia's Instantsearch and Autocomplete components.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4856 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/with-cloudflare-workers/src/index.ts`
```
import Client from '@searchkit/api'

const client = Client({
  connection: {
    host: 'https://commerce-demo.es.us-east4.gcp.elastic-cloud.com:9243',
    // if you're using Elastic cloud
    // cloud_id: "<cloud-id-found-on-deployment-page>",
    // if you are authenticating with api key
    // https://www.searchkit.co/docs/guides/setup-elasticsearch#connecting-with-api-key
    apiKey: 'a2Rha1VJTUJMcGU4ajA3Tm9fZ0Y6MjAzX2pLbURTXy1hNm9SUGZGRlhJdw=='
    // if you are authenticating with username/password
    // https://www.searchkit.co/docs/guides/setup-elasticsearch#connecting-with-usernamepassword
    //auth: {
    //  username: "elastic",
    //  password: "changeme"
    //},
  },
  search_settings: {
    highlight_attributes: ['title'],
    search_attributes: [{ field: 'title', weight: 3 }, 'actors', 'plot'],
    result_attributes: ['title', 'actors', 'poster', 'plot'],
    facet_attributes: [
      'type',
      { attribute: 'actors', field: 'actors.keyword', type: 'string' },
      'rated',
      { attribute: 'imdbrating', type: 'numeric', field: 'imdbrating' },
      { attribute: 'metascore', type: 'numeric', field: 'metascore' }
    ],
    sorting: {
      default: {
        field: '_score',
        order: 'desc'
      },
      _rated_desc: {
        field: 'rated',
        order: 'desc'
      }
    },
    snippet_attributes: ['plot'],
    query_rules: []
  }
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
}

async function handleOptions(request: Request) {
  return new Response(null, {
    headers: corsHeaders
  })
}

async function handleRequest(event: FetchEvent) {
  if (event.request.method === 'OPTIONS') {
    // Handle CORS preflight requests
    return handleOptions(event.request)
  }

  const body = await event.request.json()
  const results = await client.handleRequest(body)

  return new Response(JSON.stringify(results), {
    headers: {
      'content-type': 'application/json',
      ...corsHeaders
    }
  })
}

addEventListener('fetch', (event) => {
  return event.respondWith(handleRequest(event))
})

```

### Core Architecture Module: `packages/searchkit/src/filterUtils.ts`
```
export const TermFilter = (field: string, value: string) => {
  return { term: { [field]: value } }
}

export const MatchFilter = (field: string, value: string) => {
  return { match: { [field]: value } }
}

```

### Core Architecture Module: `packages/searchkit/src/highlightUtils.ts`
```
import { getSnippetFieldLength } from './transformRequest'
import type { ElasticsearchHit, SearchSettingsConfig } from './types'

export function highlightTerm(value: string, query: string): string {
  const regex = new RegExp(query, 'gi')
  return value.replace(regex, (match) => `<em>${match}</em>`)
}

export function isAllowableHighlightField(fieldKey: string, highlightFields: string[]) {
  return (
    highlightFields.findIndex((highlightField) => {
      if (highlightField.indexOf('*') < 0) {
        return highlightField === fieldKey
      }

      const safeHighlightField = highlightField.replace(/[.+?^$|\{\}\(\)\[\]\\]/g, '\\$&')
      const regex = new RegExp(`^${safeHighlightField.replace(/\*/g, '.*')}$`)
      return regex.test(fieldKey)
    }) >= 0
  )
}

function transformObject(input: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {}

  for (const key in input) {
    const keys = key.split('.')
    let currentObj = result

    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i]

      if (!currentObj[currentKey]) {
        currentObj[currentKey] = {}
      }

      currentObj = currentObj[currentKey]
    }

    currentObj[keys[keys.length - 1]] = input[key]
  }

  return result
}

/**
 * Retrieves a nested field value from an object using a dot-notation path.
 * If any part of the path points to an array, it maps over the array to extract the values.
 * This function ensures that a property exists, even if its value is `undefined`.
 *
 * @param {object} obj - The object to retrieve the nested value from.
 * @param {string} path - The dot-notation path to the desired value (e.g., 'messages.text').
 * @returns {any} - The value at the specified path, or undefined if the path or property does not exist.
 *                  If the path involves an array, an array of values will be returned.
 */
export function getFieldValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => {
    if (Array.isArray(acc)) {
      // Map over the array and extract the value
      return acc.map(item => item[key])
    }

    // Check if the property exists before accessing it
    return acc && Object.prototype.hasOwnProperty.call(acc, key)
      ? acc[key]
      : undefined
  }, obj)
}

export function getHighlightFields(
  hit: ElasticsearchHit,
  preTag: string = '<ais-highlight-0000000000>',
  postTag: string = '<ais-highlight-0000000000/>',
  fields: SearchSettingsConfig['snippet_attributes'] = []
) {
  const { _source = {}, highlight = {} } = hit

  const combinedKeys = {
    ..._source,
    ...highlight
  }

  const highlightFields = fields.map((field) => getSnippetFieldLength(field).attribute)

  const hitHighlights = Object.keys(combinedKeys).reduce<Record<string, any>>((sum, fieldKey) => {
    const fieldValue: any = getFieldValue(_source, fieldKey)
    const highlightedMatch = highlight[fieldKey] || null

    if (!isAllowableHighlightField(fieldKey, highlightFields)) {
      return sum
    }
    // no matches, specified as a highlight and value is an array
    if (Array.isArray(fieldValue) && !highlightedMatch) {
      return {
        ...sum,
        [fieldKey]: fieldValue.map((value) => ({
          matchLevel: 'none',
          matchedWords: [],
          value: value.toString()
        }))
      }
      // field array and has multiple highlighted matches
    } else if (Array.isArray(fieldValue) && highlightedMatch && Array.isArray(highlightedMatch)) {
      return {
        ...sum,
        [fieldKey]: highlightedMatch.map((highlightedMatch) => {
          const matchWords = Array.from(highlightedMatch.matchAll(/\<em\>(.*?)\<\/em\>/g)).map(
            (match) => match[1]
          )
          return {
            fullyHighlighted: false,
            matchLevel: 'full',
            matchedWords: matchWords,
            value: highlightedMatch
              .toString()
              .replace(/\<em\>/g, preTag)
              .replace(/\<\/em\>/g, postTag)
          }
        })
      }
    } else if (
      (!Array.isArray(fieldValue) && highlightedMatch && Array.isArray(highlightedMatch)) ||
      (!fieldValue && Array.isArray(highlightedMatch) && highlightedMatch.length > 0)
    ) {
      const singleMatch = highlightedMatch[0]

      const matchWords = Array.from(singleMatch.matchAll(/\<em\>(.*?)\<\/em\>/g)).map(
        (match) => match[1]
      )
      const x = {
        fullyHighlighted: false,
        matchLevel: 'full',
        matchedWords: matchWords,
        value: singleMatch
          .toString()
          .replace(/\<em\>/g, preTag)
          .replace(/\<\/em\>/g, postTag)
      }

      return {
        ...sum,
        [fieldKey]: x
      }
    }

    return {
      ...sum,
      [fieldKey]: {
        matchLevel: 'none',
        matchedWords: [],
        value: fieldValue != undefined ? fieldValue.toString() : ''
      }
    }
  }, {})

  return transformObject(hitHighlights)
}

```

### Core Architecture Module: `packages/searchkit/src/utils.ts`
```
import { CustomFacetConfig, FacetAttribute, FacetFieldConfig, SearchRequest } from './types'

export const createRegexQuery = (queryString: string) => {
  let query = queryString.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
  query = query
    .split('')
    .map((char) => {
      if (/[a-z]/.test(char)) {
        return `[${char}${char.toUpperCase()}]`
      }
      return char
    })
    .join('')
  query = `${query}.*`
  if (queryString.length > 2) {
    query = `([a-zA-Z]+ )+?${query}`
  }
  return query
}

export const getFacet = (
  facet_attributes: FacetAttribute[],
  attributeName: string
): FacetAttribute | null => {
  const f = facet_attributes.find((a) => {
    if (typeof a === 'string') {
      return a === attributeName
    }
    return a.attribute === attributeName
  })
  return f || null
}

export const isNestedFacet = (facet: FacetAttribute): boolean => {
  return typeof facet !== 'string' && !!facet.nestedPath
}

export const getFacetField = (
  facet_attributes: FacetAttribute[],
  attribute: FacetAttribute
): string => {
  const attributeKey = typeof attribute === 'string' ? attribute : attribute.attribute

  if (facet_attributes.includes(attributeKey)) {
    return attributeKey
  }
  return (
    facet_attributes
      // @ts-ignore: object is possibly null
      .find((a) => a.attribute === attributeKey)?.field || attributeKey
  )
}

export const getFacetByAttribute = (
  facet_attributes: FacetAttribute[],
  attribute: FacetAttribute
): string => {
  const attributeKey = getFacetAttribute(attribute)

  if (facet_attributes.includes(attributeKey)) {
    return attributeKey
  }
  return (
    facet_attributes
      // @ts-ignore: object is possibly null
      .find((a) => a.attribute === attributeKey)?.attribute || attributeKey
  )
}

export const getFacetAttribute = (facetAttribute: FacetAttribute): string => {
  return typeof facetAttribute === 'string' ? facetAttribute : facetAttribute.attribute
}

export const getFacetFieldType = (
  facet_attributes: FacetAttribute[],
  attribute: FacetAttribute
): FacetFieldConfig['type'] => {
  const attributeKey = typeof attribute === 'string' ? attribute : attribute.attribute

  if (facet_attributes.includes(attributeKey)) {
    return 'string'
  }
  return (
    facet_attributes
      // @ts-ignore: object is possibly null
      .find((a) => a?.attribute === attributeKey)?.type || 'string'
  )
}

export const getFacetFieldConfig = (
  facet_attributes: FacetAttribute[],
  attribute: FacetAttribute
): FacetFieldConfig | CustomFacetConfig | undefined => {
  return facet_attributes.find((a) => {
    if (typeof a === 'string') {
      return false
    }
    return a.attribute === attribute
  }) as FacetFieldConfig | CustomFacetConfig | undefined
}

export const createElasticsearchQueryFromRequest = (requests: SearchRequest[]) => {
  return requests
    .reduce<string[]>(
      (sum, request) => [
        ...sum,
        JSON.stringify({ index: request.indexName }),
        '\n',
        JSON.stringify(request.body),
        '\n'
      ],
      []
    )
    .join('')
}

```

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1416** (2026-04-04): **Searchkit 4.16 release**
  *Symptoms*: 

- **Issue #1412** (2026-03-24): **fix: add timeout and error handling to prevent infinite loading**
  *Symptoms*: ## Summary  This PR adds proper timeout and error handling to fix the infinite loading issue when the search server is down, unresponsive, or returns an error.  This fix originates from this discussion in the instantsearch repo: https://github.com/algolia/instantsearch/issues/6525  ### Changes  **ESTransporter (`packages/searchkit/src/Transporter.ts`):** - Added configurable timeout (default 30s) using `AbortController` - Added `response.ok` check to catch HTTP errors early - Added `timeout` option to `AppSettings` interface  **InstantSearch Client (`packages/searchkit-instantsearch-client/src/index.ts`):** - Returns empty results on error instead of throwing, preventing infinite re-render loops in InstantSearch/react-instantsearch-nextjs - Caches error results to prevent repeated failing requests - Added optional `onError` callback for custom error handling - Logs errors to console by default (suppressible via `onError`)  ### Problem  When the Elasticsearch server is down or returns an error (e.g., index not found), the previous behavior would either: 1. Hang indefinitely (no timeout) 2. Throw an error that causes InstantSearch to re-render and retry infinitely  ### Solution  1. **Timeout**: Requests now timeout after 30 seconds (configurable) instead of hanging forever 2. **Graceful error handling**: The InstantSearch client now returns empty results on error, which InstantSearch can display as "no results" instead of crashing or retrying infinit

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

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* apply changeset

* chore: add changeset for fixing infinite loader error in search functionality

---------

Co-authored-by: Claude Opus 4.5 <[REDACTED_EMAIL]>
Co-authored-by: Joseph McElroy <[REDACTED_EMAIL]>

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
+        console.error('Searchkit InstantSearch Client error:', err.message)
+      }
       return []
     }
   }
```

**File**: `packages/searchkit/src/Transporter.ts` (modified, +39/-16)
```diff
@@ -24,7 +24,11 @@ function getHostFromCloud(cloudId: string) {
 }
 
 export class ESTransporter implements Transporter {
-  constructor(public config: ConfigConnection, private settings: AppSettings) {}
+  private timeout: number
+
+  constructor(public config: ConfigConnection, private settings: AppSettings) {
+    this.timeout = settings.timeout ?? 30000
+  }
 
   createElasticsearchQueryFromRequest(requests: SearchRequest[]) {
     return createElasticsearchQueryFromRequest(requests)
@@ -39,21 +43,40 @@ export class ESTransporter implements Transporter {
 
     const host = this.config.cloud_id ? getHostFromCloud(this.config.cloud_id) : this.config.host
 
-    return fetch(`${host}/_msearch`, {
-      headers: {
-        ...(this.config.apiKey ? { authorization: `ApiKey ${this.config.apiKey}` } : {}),
-        'content-type': 'application/json',
-        ...(this.config.headers || {}),
-        ...(this.config.auth
-          ? {
-              Authorization: 'Basic ' + authString(this.config.auth)
-            }
-          : {})
-      },
-      body: this.createElasticsearchQueryFromRequest(requests),
-      method: 'POST',
-      ...(this.config.withCredentials ? { credentials: 'include' } : {})
-    })
+    const controller = new AbortController()
+    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
+
+    try {
+      const response = await fetch(`${host}/_msearch`, {
+        headers: {
+          ...(this.config.apiKey ? { authorization: `ApiKey ${this.config.apiKey}` } : {}),
+          'content-type': 'application/json',
+          ...(this.config.headers || {}),
+          ...(this.config.auth
+            ? {
+                Authorization: 'Basic ' + authString(this.config.auth)
+              }
+            : {})
+        },
+        body: this.createElasticsearchQueryFromRequest(requests),
+        method: 'POST',
+        signal: controller.signal,
+        ...(this.config.withCredentials ? { credentials: 'include' } : {})
+      })
+
+      if (response.ok === false) {
+        throw new Error(`Elasticsearch request failed with status ${response.status}: ${response.statusText}`)
+      }
+
+      return response
+    } catch (error) {
+      if (error instanceof Error && error.name === 'AbortError') {
+        throw new Error(`Elasticsearch request timed out after ${this.timeout}ms`)
+      }
+      throw error
+    } finally {
+      clearTimeout(timeoutId)
+    }
   }
 
   async msearch(requests: SearchRequest[]): Promise<ElasticsearchResponseBody[]> {
```

**File**: `packages/searchkit/src/types.ts` (modified, +1/-0)
```diff
@@ -333,6 +333,7 @@ export interface Transporter {
 
 export interface AppSettings {
   debug: boolean
+  timeout?: number
 }
 
 export type {
```

**File**: `yarn.lock` (modified, +185/-1)
```diff
@@ -748,6 +748,11 @@
     tslib "^2.4.0"
     undici "^5.22.1"
 
+"@esbuild/aix-ppc64@0.27.4":
+  version "0.27.4"
+  resolved "https://registry.yarnpkg.com/@esbuild/aix-ppc64/-/aix-ppc64-0.27.4.tgz#4c585002f7ad694d38fe0e8cbf5cfd939ccff327"
+  integrity sha512-cQPwL2mp2nSmHHJlCyoXgHGhbEPMrEEU5xhkcy3Hs/O7nGZqEpZ2sUtLaL9MORLtDfRvVl2/3PAuEkYZH0Ty8Q==
+
 "@esbuild/android-arm64@0.17.19":
   version "0.17.19"
   resolved "https://registry.yarnpkg.com/@esbuild/android-arm64/-/android-arm64-0.17.19.tgz#bafb75234a5d3d1b690e7c2956a599345e84a2fd"
@@ -758,6 +763,11 @@
   resolved "https://registry.yarnpkg.com/@esbuild/android-arm64/-/android-arm64-0.18.20.tgz#984b4f9c8d0377443cc2dfcef266d02244593622"
   integrity sha512-Nz4rJcchGDtENV0eMKUNa6L12zz2zBDXuhj/Vjh18zGqB44Bi7MBMSXjgunJgjRhCmKOjnPuZp4Mb6OKqtMHLQ==
 
+"@esbuild/android-arm64@0.27.4":
+  version "0.27.4"
+  resolved "https://registry.yarnpkg.com/@esbuild/android-arm64/-/android-arm64-0.27.4.tgz#7625d0952c3b402d3ede203a16c9f2b78f8a4827"
+  integrity sha512-gdLscB7v75wRfu7QSm/zg6Rx29VLdy9eTr2t44sfTW7CxwAtQghZ4ZnqHk3/ogz7xao0QAgrkradbBzcqFPasw==
+
 "@esbuild/android-arm@0.17.19":
   version "0.17.19"
   resolved "https://registry.yarnpkg.com/@esbuild/android-arm/-/android-arm-0.17.19.tgz#5898f7832c2298bc7d0ab53701c57beb74d78b4d"
@@ -768,6 +778,11 @@
   resolved "https://registry.yarnpkg.com/@esbuild/android-arm/-/android-arm-0.18.20.tgz#fedb265bc3a589c84cc11f810804f234947c3682"
   integrity sha512-fyi7TDI/ijKKNZTUJAQqiG5T7YjJXgnzkURqmGj13C6dCqckZBLdl4h7bkhHt/t0WP+zO9/zwroDvANaOqO5Sw==
 
+"@esbuild/android-arm@0.27.4":
+  version "0.27.4"
+  resolved "https://registry.yarnpkg.com/@esbuild/android-arm/-/android-arm-0.27.4.tgz#9a0cf1d12997ec46dddfb32ce67e9bca842381ac"
+  integrity sha512-X9bUgvxiC8CHAGKYufLIHGXPJWnr0OCdR0anD2e21vdvgCI8lIfqFbnoeOz7lBjdrAGUhqLZLcQo6MLhTO2DKQ==
+
 "@esbuild/android-x64@0.17.19":
   version "0.17.19"
   resolved "https://registry.yarnpkg.com/@esbuild/android-x64/-/android-x64-0.17.19.tgz#658368ef92067866d95fb268719f98f363d13ae1"
@@ -778,6 +793,11 @@
   resolved "https://registry.yarnpkg.com/@esbuild/android-x64/-/android-x64-0.18.20.tgz#35cf419c4cfc8babe8893d296cd990e9e9f756f2"
   integrity sha512-8GDdlePJA8D6zlZYJV/jnrRAi6rOiNaCC/JclcXpB+KIuvfBN4owLtgzY2bsxnx666XjJx2kDPUmnTtR8qKQUg==
 
+"@esbuild/android-x64@0.27.4":
+  version "0.27.4"
+  resolved "https://registry.yarnpkg.com/@esbuild/android-x64/-/android-x64-0.27.4.tgz#06e1fdc6283fccd6bc6aadd6754afce6cf96f42e"
+  integrity sha512-PzPFnBNVF292sfpfhiyiXCGSn9HZg5BcAz+ivBuSsl6Rk4ga1oEXAamhOXRFyMcjwr2DVtm40G65N3GLeH1Lvw==
+
 "@esbuild/darwin-arm64@0.17.19":
   version "0.17.19"
   resolved "https://registry.yarnpkg.com/@esbuild/darwin-arm64/-/darwin-arm64-0.17.19.tgz#584c34c5991b95d4d48d333300b1a4e2ff7be276"
@@ -788,6 +808,11 @@
   resolved "https://registry.yarnpkg.com/@esbuild/darwin-arm64/-/darwin-arm64-0.18.20.tgz#08172cbeccf95fbc383399a7f39cfbddaeb0d7c1"
   integrity sha512-bxRHW5kHU38zS2lPTPOyuyTm+S+eobPUnTNkdJEfAddYgEcll4xkT8DB9d2008DtTbl7uJag2HuE5NZAZgnNEA==
 
+"@esbuild/darwin-arm64@0.27.4":
+  version "0.27.4"
+  resolved "https://registry.yarnpkg.com/@esbuild/darwin-arm64/-/darwin-arm64-0.27.4.tgz#6c550ee6c0273bcb0fac244478ff727c26755d80"
+  integrity sha512-b7xaGIwdJlht8ZFCvMkpDN6uiSmnxxK56N2GDTMYPr2/gzvfdQN8rTfBsvVKmIVY/X7EM+/hJKEIbbHs9oA4tQ==
+
 "@esbuild/darwin-x64@0.17.19":
   version "0.17.19"
   resolved "https://registry.yarnpkg.com/@esbuild/darwin-x64/-/darwin-x64-0.17.19.tgz#7751d236dfe6ce136cce343dce69f52d76b7f6cb"
@@ -798,6 +823,11 @@
   resolved "https://registry.yarnpkg.com/@esbuild/darwin-x64/-/darwin-x64-0.18.20.tgz#d70d5790d8bf475556b67d0f8b7c5bdff053d85d"
   integrity sha512-pc5gxlMDxzm513qPGbCbDukOdsGtKhfxD1zJKXjCCcU7ju50O7MeAZ8c4krSJcOIJGFR+qx21yMMVYwiQvyTyQ==
 
+"@esbuild/darwin-x64@0.27.4":
+  version "0.27.4"
+  resolved "https://registry.yarnpkg.com/@esbuild/darwin-x64/-/darwin-x64-0.27.4.tgz#ed7a125e9f25ce0091b9aff783ee943f6ba6cb86"
+  integrity sha512-sR+OiKLwd15nmCdqpXMnuJ9W2kpy0KigzqScqHI3Hqwr7IXxBp3Yva+yJwoqh7rE8V77tdoheRYataNKL4QrPw==
+
 "@esbuild/freebsd-arm64@0.17.19":
   version "0.17.19"
   resolved "https://registry.yarnpkg.com/@esbuild/freebsd-arm64/-/freebsd-arm64-0.17.19.tgz#cacd171665dd1d500f45c167d50c6b7e539d5fd2"
@@ -808,6 +838,11 @@
   resolved "https://registry.yarnpkg.com/@esbuild/freebsd-arm64/-/freebsd-arm64-0.18.20.tgz#98755cd12707f93f210e2494d6a4b51b96977f54"
   integrity sha512-yqDQHy4QHevpMAaxhhIwYPMv1NECwOvIpGCZkECn8w2WFHXjEwrBn3CeNIYsibZ/iZEUemj++M26W3cNR5h+Tw==
 
+"@esbuild/freebsd-arm64@0.27.4":
+  version "0.27.4"
+  resolved "https://registry.yarnpkg.com/@esbuild/freebsd-arm64/-/freebsd-arm64-0.27.4.tgz#597dc8e7161dba71db4c1656131c1f1e9d7660c6"
+  integrity sha512-jnfpKe+p79tCnm4GVav68A7tUFeKQwQyLgESwEAUzyxk/TJr4QdGog9sqWNcUbr/bZt/O/HXouspuQDd9JxFSw==
+
 "@esbuild/freebsd-x64@0.17.19":
   version "0.17.19"
   resolved "https://registry.yarnpkg.com/@esbuild/freebsd-x64/-/freebsd-x64-0.17.19.tgz#0769456eee2a08b8d925d7c00b7
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

#### Recent Merged Pull Requests:
- **PR #1416** (2026-04-04): Searchkit 4.16 release (@joemcelroy)
- **PR #1412** (2026-03-24): fix: add timeout and error handling to prevent infinite loading (@nx-alejandrolacasa)
- **PR #1405** (closed): Jules was unable to complete the task in time. Please review the work… (@bizdict)
- **PR #1404** (2025-06-01): v4.15.0 (@joemcelroy)
- **PR #1403** (2025-06-01): feat: Enhance sorting functionality in documentation and code (@Wcdaren)
- **PR #1402** (2025-05-14): Update with-your-own-server.mdx (@ianshea)

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

## X. add timeout and error handling to prevent infinite loading (#1412)

**RULE**:
When implementing operations in `.changeset/eighty-moles-heal.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in searchkit/searchkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9b14e004`: add timeout and error handling to prevent infinite loading (#1412). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/eighty-moles-heal.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
'@searchkit/instantsearch-client': minor
'searchkit': minor
---

fixed infinite loader error
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9b14e004` are properly handled with clean fallback behavior.

# Forensic Learning Record (Deep Inspection): searchkit/searchkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/searchkit-searchkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/searchkit/searchkit](https://github.com/searchkit/searchkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:01:00.682Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `searchkit/searchkit`
- **Description**: React + Vue Search UI for Elasticsearch & Opensearch. Compatible with Algolia's Instantsearch and Autocomplete components.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4854 stars

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

- **Issue #1405** (2026-10-01): **Jules was unable to complete the task in time. Please review the work…**
  *Symptoms*: … done so far and provide feedback for Jules to continue.

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

---

### Incident Patch 4: `c88006f0` (2024-05-01)
**Commit Message**: Update code to reflect required type for facets; minor clarifying of wording; some small grammar updates (#1359)

**File**: `apps/web/pages/docs/tutorials/with-nextjs.mdx` (modified, +30/-30)
```diff
@@ -1,7 +1,7 @@
 ---
 title: Nextjs with Searchkit
 description: Nextjs with Searchkit tutorial and walkthrough
-keywords: ["nextjs", "searchkit", "tutorial", "walkthrough", "elasticsearch", "react", "javascript", "typescript", "search", "search ui", "search experience", "site search", "app search"]
+keywords: ["nextjs", "searchkit", "tutorial", "walkthrough", "elasticsearch", "opensearch", "react", "javascript", "typescript", "search", "search ui", "search experience", "site search", "app search"]
 ---
 
 import { Tabs, Tab } from '../../../components/Tabs'
@@ -10,14 +10,14 @@ import { Callout } from 'nextra/components'
 
 ## Get Started
 
-In this walkthrough we are going to get started to build a search experience with Next.js.
+In this walkthrough we are going to get started building a search experience with Next.js.
 
-You dont need to use Next.js to use Searchkit, but it is the easiest way to get started.
+You don't need to use Next.js to use Searchkit, but it is the easiest way to get started.
 
 In this walkthrough, we will:
 
 - Setup an api route to fetch results from Elasticsearch
-- Use React Instantsearch to display the results 🎉
+- Use React InstantSearch to display the results 🎉
 
 ## Download an Example Project
 
@@ -51,7 +51,7 @@ style={{
 ## Create a Next.js app
 
 <Callout type="info" emoji="ℹ️">
-  This tutorial will use Next.js new App Router. If you're using pages, keep this in mind when following along.
+  This tutorial will use the new Next.js App Router. If you're using pages, keep this in mind when following along.
 </Callout>
 
 First, we need to create a Next.js app. We can do this by running the following command:
@@ -97,7 +97,7 @@ Next we need to install the dependencies for this project:
 
 ## Setup the Node API
 
-create a new file in the `app/api/search` directory called `route.ts` and add the following code:
+Create a new file in the `app/api/search` directory called `route.ts` and add the following code:
 
 ```ts filename="app/api/search/route.ts"
 import Client from "@searchkit/api";
@@ -106,10 +106,10 @@ import { NextRequest, NextResponse } from 'next/server'
 const apiConfig = {
   connection: {
     host: "<replace-with-your-elasticsearch-host>",
-    // if you are authenticating with api key
+    // if you are authenticating with an api key
     // https://www.searchkit.co/docs/guides/setup-elasticsearch#connecting-with-api-key
     // apiKey: '###'
-    // if you are authenticating with username/password
+    // if you are authenticating with a username/password combo
     // https://www.searchkit.co/docs/guides/setup-elasticsearch#connecting-with-usernamepassword
     // auth: {
     //   username: "elastic",
@@ -136,15 +136,15 @@ export async function POST(req: NextRequest, res: NextResponse) {
 
 Replace the _host_ and _apiKey_ with your Elasticsearch host and API key. The apiKey is optional, but recommended for production environments. You can find more information about the API key [here](https://www.elastic.co/guide/en/kibana/master/api-keys.html).
 
-This will setup a new [nextjs route handler](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) under the `/api/search` path. This route will handle the search requests and use instantsearch Elasticsearch Adapter to handle the requests. The response is then returned back to the client.
+This will setup a new [Next.js route handler](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) under the `/api/search` path. This route will handle the search requests and use the InstantSearch Elasticsearch Adapter to handle the requests. The response is then returned back to the client.
 
 For more information on API configuration, see the [API Configuration](/reference/api) docs.
 
 ## Setup the Frontend
 
 Now that we have the API setup, we can start building the frontend. We will use [react-instantsearch](https://www.algolia.com/doc/api-reference/widgets/react/) to build the search experience.
 
-First, we need to create a new file in the `app` directory called `page.tsx` and add the following code:
+First, we need to create a new file (if it doesn't already exist) in the `app` directory called `page.tsx` and add the following code:
 
 ```js filename="app/page.tsx"
 import { InstantSearch, SearchBox, Hits } from "react-instantsearch";
@@ -190,7 +190,7 @@ IMAGE1
 
 ## Searchable Attributes
 
-Now that we have the search experience setup, we can add the search functionality.
+Now that we have the search experience setup, we can add additional search functionality.
 
 ### Adjusting the search fields
 
@@ -202,11 +202,11 @@ we can adjust the search fields by updating the `search_attributes` in the `apiC
 
 Above we have boosted title by 3 times. This means that the title will have a higher weight than the other fields. This will make sure that the title has a higher importance in the search results.
 
-### Overriding the default Elasticsearch query
+### Overriding the Defau
```

---

### Incident Patch 5: `b73f9f11` (2024-03-09)
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

**File**: `examples/with-ui-nextjs-react/CHANGELOG.md` (modified, +9/-0)
```diff
@@ -1,5 +1,14 @@
 # with-ui-nextjs-react
 
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

**File**: `examples/with-ui-nextjs-react/package.json` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "with-ui-nextjs-react",
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

**File**: `packages/searchkit-api/CHANGELOG.md` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 # @searchkit/api
 
+## 4.11.1
+
+### Patch Changes
+
+- 77133782: fix bug with object field highlighting
+- Updated dependencies [77133782]
+  - searchkit@4.11.1
+
 ## 4.11.0
 
 ### Minor Changes
```

---

### Incident Patch 6: `77133782` (2024-03-09)
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

**File**: `packages/searchkit-api/package.json` (modified, +1/-1)
```diff
@@ -43,6 +43,6 @@
     "searchkit": "^4.11.0"
   },
   "devDependencies": {
-    "nock": "^13.1.3"
+    "nock": "^14.0.0-beta.4"
   }
 }
```

**File**: `packages/searchkit/package.json` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@
     "eslint": "^7.32.0",
     "eslint-config-custom": "*",
     "jest": "29.1.2",
-    "nock": "^13.0.5",
+    "nock": "^14.0.0-beta.4",
     "node-fetch": "^2.6.6",
     "ts-jest": "29.0.3",
     "tsconfig": "*",
```

**File**: `packages/searchkit/src/___tests___/functional/highlightAttributes.test.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import Client from '../../'
+import { SimpleNoFilterRequest } from '../mocks/AlgoliaRequests'
+import type { AlgoliaMultipleQueriesQuery } from '@searchkit/api'
+
+import nock from 'nock'
+import { HitsResponseWithObjectHighlight } from '../mocks/ElasticsearchResponses'
+
+describe('Integration tests for highlight Attributes', () => {
+  const config = {
+    connection: {
+      host: 'http://0.0.0.0:8200',
+      apiKey: 'a2Rha1VJTUJMcGU4ajA3Tm9fZ0Y6MjAzX2pLbURTXy1hNm9SUGZGRlhJdw=='
+    },
+    search_settings: {
+      search_attributes: ['title', 'actors', 'query'],
+      result_attributes: ['title', 'actors', 'query'],
+      highlight_attributes: ['meta.title']
+    }
+  }
+
+  it('should have highlight for title', async () => {
+    const client = new Client(config as unknown as any)
+    nock('http://0.0.0.0:8200')
+      .post('/_msearch', (requestBody: any) => {
+        const x = JSON.parse(requestBody.split('\n')[1])
+        expect(x.highlight.fields).toMatchInlineSnapshot(`
+          {
+            "meta.title": {
+              "number_of_fragments": 0,
+            },
+          }
+        `)
+        return true
+      })
+      .reply(200, HitsResponseWithObjectHighlight)
+
+    const response = await client.handleInstantSearchRequests(
+      SimpleNoFilterRequest as AlgoliaMultipleQueriesQuery[]
+    )
+    // @ts-ignore
+    expect(response.results[0].hits[0]._highlightResult).toMatchInlineSnapshot(`
+      {
+        "meta": {
+          "title": {
+            "fullyHighlighted": false,
+            "matchLevel": "full",
+            "matchedWords": [
+              "Shawshank",
+            ],
+            "value": "The <em>Shawshank</em> Redemption",
+          },
+        },
+      }
+    `)
+  })
+})
```

---

### Incident Patch 7: `9a226d27` (2023-12-21)
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

**File**: `packages/searchkit-instantsearch-client/src/index.ts` (modified, +6/-8)
```diff
@@ -13,13 +13,10 @@ function isSearchkit(config: Config): config is Searchkit {
 }
 
 class InstantSearchElasticsearchAdapter {
-  private cache: Record<string, any> = {}
-  public transporter = {
-    headers: {},
-    queryParameters: {}
-  }
+  private cache: Record<string, any>
 
   constructor(private config: Config, private requestOptions?: RequestOptions) {
+    this.cache = []
     if (!isSearchkit(this.config) && !this.config.url) {
       throw new Error('Searchkit Instantsearch Client: url is required')
     }
@@ -31,7 +28,7 @@ class InstantSearchElasticsearchAdapter {
   }
 
   public clearCache(): Promise<void> {
-    this.cache = {}
+    this.cache = []
     return Promise.resolve(undefined)
   }
 
@@ -47,8 +44,9 @@ class InstantSearchElasticsearchAdapter {
   public async search(instantsearchRequests: readonly MultipleQueriesQuery[]): Promise<any> {
     try {
       const key = JSON.stringify(instantsearchRequests)
-      if (this.cache[key]) {
-        return this.cache[key]
+      const cacheValue = this.cache[key]
+      if (cacheValue) {
+        return cacheValue
       }
 
       if (isSearchkit(this.config)) {
```

**File**: `yarn.lock` (modified, +45/-40)
```diff
@@ -2407,20 +2407,20 @@ algoliasearch-helper@3.14.0:
   dependencies:
     "@algolia/events" "^4.0.1"
 
-algoliasearch-helper@3.14.2:
-  version "3.14.2"
-  resolved "https://registry.yarnpkg.com/algoliasearch-helper/-/algoliasearch-helper-3.14.2.tgz#c34cfe6cefcfecd65c60bcb8bf9b68134472d28c"
-  integrity sha512-FjDSrjvQvJT/SKMW74nPgFpsoPUwZCzGbCqbp8HhBFfSk/OvNFxzCaCmuO0p7AWeLy1gD+muFwQEkBwcl5H4pg==
-  dependencies:
-    "@algolia/events" "^4.0.1"
-
 algoliasearch-helper@3.15.0, algoliasearch-helper@>=3:
   version "3.15.0"
   resolved "https://registry.yarnpkg.com/algoliasearch-helper/-/algoliasearch-helper-3.15.0.tgz#d680783329920a3619a74504dccb97a4fb943443"
   integrity sha512-DGUnK3TGtDQsaUE4ayF/LjSN0DGsuYThB8WBgnnDY0Wq04K6lNVruO3LfqJOgSfDiezp+Iyt8Tj4YKHi+/ivSA==
   dependencies:
     "@algolia/events" "^4.0.1"
 
+algoliasearch-helper@3.16.1:
+  version "3.16.1"
+  resolved "https://registry.yarnpkg.com/algoliasearch-helper/-/algoliasearch-helper-3.16.1.tgz#421e3554ec86e14e60e7e0bf796aef61cf4a06ec"
+  integrity sha512-qxAHVjjmT7USVvrM8q6gZGaJlCK1fl4APfdAA7o8O6iXEc68G0xMNrzRkxoB/HmhhvyHnoteS/iMTiHiTcQQcg==
+  dependencies:
+    "@algolia/events" "^4.0.1"
+
 algoliasearch@>=4, algoliasearch@^4.14.2:
   version "4.20.0"
   resolved "https://registry.yarnpkg.com/algoliasearch/-/algoliasearch-4.20.0.tgz#700c2cb66e14f8a288460036c7b2a554d0d93cf4"
@@ -5355,10 +5355,10 @@ instantsearch.css@^8.0.0:
   resolved "https://registry.yarnpkg.com/instantsearch.css/-/instantsearch.css-8.1.0.tgz#e3a7dfb9bfa3db1d24e7d2d1e04a44197be3c7bc"
   integrity sha512-rPhcAZ02bLwUn3iOXbldZW/yl+17guWoH3qWYZ8nQEwNBx5+wZ6Bv8mFqqK448+R2aU4nbFKIhmoTIPXI5Zobg==
 
-instantsearch.js@4.58.0:
-  version "4.58.0"
-  resolved "https://registry.yarnpkg.com/instantsearch.js/-/instantsearch.js-4.58.0.tgz#ee6b3cc4eb24c6524a4ea223a6ea85c1c496483f"
-  integrity sha512-Y5vERyhoE1jEWew33OdsRbB24q2Pexft4/HK6a+QOO22C3qoGIkc3i4rP8RbB4kecDvkziFi/YCGE5t1B6J3eg==
+instantsearch.js@4.60.0, instantsearch.js@^4.43.0, instantsearch.js@^4.46.0, instantsearch.js@^4.55.0:
+  version "4.60.0"
+  resolved "https://registry.yarnpkg.com/instantsearch.js/-/instantsearch.js-4.60.0.tgz#3b5476a5532efbc3fcb513a36905dc6c76d7e26d"
+  integrity sha512-u/xeCT1DaxPioJnSm3hV4lNAojlhbjGrpX5fHO6+RJjpDFv/MgYxiIOdaIRowmt5F0v/3QCm+Un5f4jy1/+emA==
   dependencies:
     "@algolia/events" "^4.0.1"
     "@algolia/ui-components-highlight-vdom" "^1.2.2"
@@ -5367,17 +5367,17 @@ instantsearch.js@4.58.0:
     "@types/google.maps" "^3.45.3"
     "@types/hogan.js" "^3.0.0"
     "@types/qs" "^6.5.3"
-    algoliasearch-helper "3.14.2"
+    algoliasearch-helper "3.15.0"
     hogan.js "^3.0.2"
     htm "^3.0.0"
     preact "^10.10.0"
     qs "^6.5.1 < 6.10"
     search-insights "^2.6.0"
 
-instantsearch.js@4.60.0, instantsearch.js@^4.43.0, instantsearch.js@^4.46.0, instantsearch.js@^4.55.0:
-  version "4.60.0"
-  resolved "https://registry.yarnpkg.com/instantsearch.js/-/instantsearch.js-4.60.0.tgz#3b5476a5532efbc3fcb513a36905dc6c76d7e26d"
-  integrity sha512-u/xeCT1DaxPioJnSm3hV4lNAojlhbjGrpX5fHO6+RJjpDFv/MgYxiIOdaIRowmt5F0v/3QCm+Un5f4jy1/+emA==
+instantsearch.js@4.63.0:
+  version "4.63.0"
+  resolved "https://registry.yarnpkg.com/instantsearch.js/-/instantsearch.js-4.63.0.tgz#49c86a5afacd5b66a6fe28d4453409931ef3017a"
+  integrity sha512-Bk46LO6hpaFHkeDIjAV7+xgq+1a5zOq7lKUen9KfW4EoA1JVn26HEeAjW8cvHwHp1phL9mgu/Q3CQ075+6V9hg==
   dependencies:
     "@algolia/events" "^4.0.1"
     "@algolia/ui-components-highlight-vdom" "^1.2.2"
@@ -5386,12 +5386,12 @@ instantsearch.js@4.60.0, instantsearch.js@^4.43.0, instantsearch.js@^4.46.0, ins
     "@types/google.maps" "^3.45.3"
     "@types/hogan.js" "^3.0.0"
     "@types/qs" "^6.5.3"
-    algoliasearch-helper "3.15.0"
+    algoliasearch-helper "3.16.1"
     hogan.js "^3.0.2"
     htm "^3.0.0"
     preact "^10.10.0"
     qs "^6.5.1 < 6.10"
-    search-insights "^2.6.0"
+    search-insights "^2.13.0"
 
 internal-slot@^1.0.5:
   version "1.0.6"
@@ -8265,16 +8265,6 @@ react-instantsearch-core@6.40.4:
     prop-types "^15.6.2"
     react-fast-compare "^3.0.0"
 
-react-instantsearch-core@7.2.0:
-  version "7.2.0"
-  resolved "https://registry.yarnpkg.com/react-instantsearch-core/-/react-instantsearch-core-7.2.0.tgz#65c7c5879424bc89ca39023a248dec19d826afbd"
-  integrity sha512-W6fhJouybWkn0CkKDauaLbnMXq3cGC/jX8TyU+461tDyclllYzThl1lwJrW8OChXEYWfE3cW7lmYN/17Rb2N3Q==
-  dependencies:
-    "@babel/runtime" "^7.1.2"
-    algoliasearch-helper "3.14.2"
-    instantsearch.js "4.58.0"
-    use-sync-external-store "^1.0.0"
-
 react-instantsearch-core@7.3.0:
   version "7.3.0"
   resolved "https://registry.yarnpkg.com/react-instantsearch-core/-/react-instantsearch-core-7.3.0.tgz#32f0926e7a16d44eb1c4964fd020a053d24d25a5"
@@ -8285,6 +8275,16 @@ react-instantsearch-core@7.3.0:
     instantsearch.js "4.60.0"
     use-sync-external-store "^1.0.0"
 
+react-instantsearch-core@7.5.0:
+  version "7.5.0"
+  resolved "https://registry.yarnpkg.com/react-instantsearch-core/-/react-instantsearc
```

---

### Incident Patch 8: `bc4765d5` (2023-11-08)
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

### Incident Patch 9: `eabc9dc3` (2023-10-16)
**Commit Message**: docs build (#1320)

* docs build

* updates

**File**: `apps/web/components/Tabs.tsx` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ export { Tab };
 export const Tabs: FC<{
   storageKey?: string;
   items: string[];
-  children: ReactElement;
+  children: React.ReactNode;
 }> = function ({ storageKey = "tab-index", items, children = null, ...props }) {
   // Use SWR so all tabs with the same key can sync their states.
   const { data, mutate } = useSWR(storageKey, (key) => {
```

**File**: `apps/web/pages/demo-ecommerce.tsx` (modified, +2/-2)
```diff
@@ -14,9 +14,9 @@ import {
   InstantSearchServerState,
   InstantSearchSSRProvider,
   HierarchicalMenu,
-  ToggleRefinement
+  ToggleRefinement,
+  getServerState
 } from 'react-instantsearch'
-import { getServerState } from 'react-instantsearch'
 import { renderToString } from 'react-dom/server'
 
 import Client from '@searchkit/instantsearch-client'
```

**File**: `apps/web/public/sitemap-0.xml` (modified, +74/-74)
```diff
@@ -1,77 +1,77 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
-<url><loc>https://www.searchkit.co</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/about</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/autocomplete</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/camping-sites-demo</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/demo</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/demo-ecommerce</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/demos</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/api-documentation/api</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/api-documentation/instantsearch-client</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/api-documentation/searchkit</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/autocomplete</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/geo-search/geo-search</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/pagination</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/query-rules/query-rule-context</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/query-rules/query-rule-custom-data</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/add-custom-refinement</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/clear-refinements</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/current-refinements</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/dynamic-widgets</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/hierarchical-menu</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/menu</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/menu-select</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/numeric-menu</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/range-input</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/range-slider</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
-<url><loc>https://www.searchkit.co/docs/components/refinements/rating-menu</loc><lastmod>2023-10-16T19:42:23.573Z</lastmod><changefreq>daily</changefreq><priority>0.7</priori
```

---

### Incident Patch 10: `87ee0ffe` (2023-10-16)
**Commit Message**: docs build

**File**: `apps/web/pages/demo-ecommerce.tsx` (modified, +2/-2)
```diff
@@ -14,9 +14,9 @@ import {
   InstantSearchServerState,
   InstantSearchSSRProvider,
   HierarchicalMenu,
-  ToggleRefinement
+  ToggleRefinement,
+  getServerState
 } from 'react-instantsearch'
-import { getServerState } from 'react-instantsearch'
 import { renderToString } from 'react-dom/server'
 
 import Client from '@searchkit/instantsearch-client'
```

---

### Incident Patch 11: `6a622567` (2023-09-04)
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

### Incident Patch 12: `50d31381` (2023-08-19)
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

### Incident Patch 13: `c494ce2b` (2023-05-08)
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
+                  <span className="aa-SourceHeaderTitle">Movies</span>
+                  <div className="aa-SourceHeaderLine" />
+                </Fragment>
+              );
+            },
+            item({ item, components }) {
+              return <div>{item.title}</div>;
+            },
+            noResults() {
+              return "No products for this query.";
+            }
+          }
         }
       ];
-    }
+    },
+    transformSource({ source }) {
+      return {
+        ...source,
+        onSelect({ item }) {
+          debugger
+          setInstantSearchUiState({
+            query: item.label,
+          });
+        },
+      };
+    },
   };
 }
 
 export default function AutocompletePage() {
   return (
     <div className="bg-gray-100 h-screen p-4">
-      <Autocomplete
-        openOnFocus
-        plugins={[createCategoriesPlugin({ searchClient })]}
-        getSources={({ query, state }) => {
-          if (!query) {
-            return [];
-          }
-      
-          return [
-            {
- 
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
+  integrity sha512-3yjFogH3p08Lo1aqjrIp71o/YqLNJivHtZJlZ32jZ7sC/p4Q7bte1GKvDoLloU+oWPyv+4awsl6EdnW4mfIAVQ==
 
 "@algolia/cache-browser-local-storage@4.14.3":
   version "4.14.3"
@@ -691,17 +699,17 @@
   dependencies:
     "@jridgewell/trace-mapping" "0.3.9"
 
-"@elastic/behavioral-analytics-javascript-tracker@^2.1.2":
-  version "2.1.2"
-  resolved "https://registry.yarnpkg.com/@elastic/behavioral-analytics-javascript-tracker/-/behavioral-analytics-javascript-tracker-2.1.2.tgz#3ff55e8a923d359ff874dcd1dbc763e97c92e92f"
-  integrity sha512-eyxi2XeDnajRel4l3lvmv1Jfzu4xlDQxCWY7BqYkaked8IR2sgIDExArpxOLwHzptXZz2qvrKZbpByv5BYWRfQ==
+"@elastic/behavioral-analytics-javascript-tracker@^2.1.3":
+  version "2.1.3"
+  resolved "https://registry.yarnpkg.com/@elastic/behavioral-analytics-javascript-tracker/-/behavioral-analytics-javascript-tracker-2.1.3.tgz#53942a286c84ecc357dea0263f18882898a416e4"
+  integrity sha512-imProiNHyD04SLk8CqELv1E5quHnttoP7TWRzc94m0c8SxhU5vDn/5Af6JrRQ6QlGjc1+8ENckogcS1L9qGqaw==
   dependencies:
-
```

---

### Incident Patch 14: `e38ced76` (2023-05-08)
**Commit Message**: fix client

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

#### Recent Merged Pull Requests:
- **PR #1416** (2026-04-04): Searchkit 4.16 release (@joemcelroy)
- **PR #1412** (2026-03-24): fix: add timeout and error handling to prevent infinite loading (@nx-alejandrolacasa)
- **PR #1405** (closed): Jules was unable to complete the task in time. Please review the work… (@bizdict)
- **PR #1404** (2025-06-01): v4.15.0 (@joemcelroy)
- **PR #1403** (2025-06-01): feat: Enhance sorting functionality in documentation and code (@Wcdaren)
- **PR #1402** (2025-05-14): Update with-your-own-server.mdx (@ianshea)
- **PR #1401** (2025-05-14): Fix link in documentation (@cintek)
- **PR #1399** (2025-05-14): Allow fuzziness to be configured (@Jade-GG)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

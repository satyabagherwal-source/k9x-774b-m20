# Forensic Learning Record (Deep Inspection): vercel/swr

> **Canonical Artifact**: `07_PROJECT_LEARNING/vercel-swr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vercel/swr](https://github.com/vercel/swr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:28:04.259Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vercel/swr`
- **Description**: React Hooks for Data Fetching
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 32494 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/api-hooks/hooks/use-projects.js`
```
import useSWR from 'swr'

import fetch from '../libs/fetch'

export default function useProjects() {
  return useSWR('/api/data', fetch)
}


```

### Core Architecture Module: `examples/api-hooks/hooks/use-repository.js`
```
import useSWR from 'swr'

import fetch from '../libs/fetch'

export default function useRepository(id) {
  return useSWR('/api/data?id=' + id, fetch)
}

```

### Core Architecture Module: `examples/api-hooks/libs/fetch.js`
```
export default async function fetcher(...args) {
  const res = await fetch(...args)
  return res.json()
}

```

### Core Architecture Module: `examples/api-hooks/pages/[user]/[repo].js`
```
import Link from 'next/link'
import useRepository from '../../hooks/use-repository'

export default function Repo() {
  const id = typeof window !== 'undefined' ? window.location.pathname.slice(1) : ''
  const { data } = useRepository(id)

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>{id}</h1>
      {
        data ? <div>
          <p>forks: {data.forks_count}</p>
          <p>stars: {data.stargazers_count}</p>
          <p>watchers: {data.watchers}</p>
        </div> : 'loading...'
      }
      <br />
      <br />
      <Link href="/">Back</Link>
    </div>
  )
}

```

### Core Architecture Module: `examples/api-hooks/pages/api/data.js`
```
const projects = [
  'facebook/flipper', 'vuejs/vuepress', 'rust-lang/rust', 'vercel/next.js'
]

export default (req, res) => {
  if (req.query.id) {
    // a slow endpoint for getting repo data
    fetch(`https://api.github.com/repos/${req.query.id}`)
      .then(resp => resp.json())
      .then(data => {
        setTimeout(() => {
          res.json(data)
        }, 2000)
      })

    return
  }
  setTimeout(() => {
    res.json(projects)
  }, 2000)
}

```

### Core Architecture Module: `examples/api-hooks/pages/index.js`
```
import Link from 'next/link'
import useProjects from '../hooks/use-projects'

export default function Index() {
  const { data } = useProjects()

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Trending Projects</h1>
      <div>
      {
        data ? data.map(project =>
          <p key={project}><Link href='/[user]/[repo]' as={`/${project}`}>{project}</Link></p>
        ) : 'loading...'
      }
      </div>
    </div>
  )
}

```

### Core Architecture Module: `examples/autocomplete-suggestions/libs/fetcher.js`
```
export default async function fetcher(...args) {
  const res = await fetch(...args)
  return res.json()
}

```

### Core Architecture Module: `examples/autocomplete-suggestions/pages/api/suggestions.js`
```
const countries = [
  "United States",
  "Canada",
  "United Kingdom",
  "Argentina",
  "Australia",
  "Austria",
  "Belgium",
  "Brazil",
  "Chile",
  "China",
  "Colombia",
  "Croatia",
  "Denmark",
  "Dominican Republic",
  "Egypt",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hong Kong",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Jordan",
  "Kuwait",
  "Lebanon",
  "Malaysia",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Panama",
  "Peru",
  "Philippines",
  "Poland",
  "Russia",
  "Saudi Arabia",
  "Serbia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Thailand",
  "Turkey",
  "United Arab Emirates",
  "Venezuela",
  "Portugal",
  "Luxembourg",
  "Bulgaria",
  "Czech Republic",
  "Slovenia",
  "Iceland",
  "Slovakia",
  "Lithuania",
  "Trinidad and Tobago",
  "Bangladesh",
  "Sri Lanka",
  "Kenya",
  "Hungary",
  "Morocco",
  "Cyprus",
  "Jamaica",
  "Ecuador",
  "Romania",
  "Bolivia",
  "Guatemala",
  "Costa Rica",
  "Qatar",
  "El Salvador",
  "Honduras",
  "Nicaragua",
  "Paraguay",
  "Uruguay",
  "Puerto Rico",
  "Bosnia and Herzegovina",
  "Palestinian Authority",
  "Tunisia",
  "Bahrain",
  "Vietnam",
  "Ghana",
  "Mauritius",
  "Ukraine",
  "Malta",
  "Bahamas",
  "Maldives",
  "Oman",
  "Macedonia",
  "Latvia",
  "Estonia",
  "Iraq",
  "Algeria",
  "Albania",
  "Nepal",
  "Macau",
  "Montenegro",
  "Senegal",
  "Georgia",
  "Brunei",
  "Uganda",
  "Guadeloupe",
  "Barbados",
  "Azerbaijan",
  "Tanzania",
  "Libya",
  "Martinique",
  "Cameroon",
  "Botswana",
  "Ethiopia",
  "Kazakhstan",
  "Namibia",
  "Netherlands Antilles",
  "Madagascar",
  "New Caledonia",
  "Moldova",
  "Fiji",
  "Belarus",
  "Jersey",
  "Guam",
  "Yemen",
  "Zambia",
  "Isle Of Man",
  "Haiti",
  "Cambodia",
  "Aruba",
  "French Polynesia",
  "Afghanistan",
  "Bermuda",
  "Guyana",
  "Armenia",
  "Malawi",
  "Antigua and Barbuda",
  "Rwanda",
  "Guernsey",
  "Gambia",
  "Faroe Islands",
  "St. Lucia",
  "Cayman Islands",
  "Benin",
  "Andorra",
  "Grenada",
  "US Virgin Islands",
  "Belize",
  "Saint Vincent and the Grenadines",
  "Mongolia",
  "Mozambique",
  "Mali",
  "Angola",
  "French Guiana",
  "Uzbekistan",
  "Djibouti",
  "Burkina Faso",
  "Monaco",
  "Togo",
  "Greenland",
  "Gabon",
  "Gibraltar",
  "Republic of the Congo",
  "Kyrgyzstan",
  "Papua New Guinea",
  "Bhutan",
  "Saint Kitts and Nevis",
  "Swaziland",
  "Lesotho",
  "Laos",
  "Liechtenstein",
  "Northern Mariana Islands",
  "Suriname",
  "Seychelles",
  "British Virgin Islands",
  "Turks and Caicos Islands",
  "Dominica",
  "Mauritania",
  "Aland Islands",
  "San Marino",
  "Sierra Leone",
  "Niger",
  "Democratic Republic of the Congo",
  "Anguilla",
  "Mayotte",
  "Cape Verde",
  "Guinea",
  "Turkmenistan",
  "Burundi",
  "Tajikistan",
  "Vanuatu",
  "Solomon Islands",
  "Eritrea",
  "Samoa",
  "American Samoa",
  "Falkland Islands",
  "Equatorial Guinea",
  "Tonga",
  "Comoros",
  "Palau",
  "Federated States of Micronesia",
  "Central African Republic",
  "Somalia",
  "Marshall Islands",
  "Vatican City",
  "Chad",
  "Kiribati",
  "Sao Tome and Principe",
  "Tuvalu",
  "Nauru",
  "Réunion",
  "Cuba",
  "Cote d'Ivoire",
  "Timor Leste",
  "North Korea",
  "Iran",
  "Liberia",
  "Myanmar",
  "Oman",
  "Saint Lucia",
  "Syria",
  "Sudan"
]

export default function suggestions(req, res) {
  const results = countries
    .filter(country => country.toLowerCase().startsWith(req.query.value))

  res.json(results);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4221** (2026-02-27): **isLoading stuck on true when updating cache with revalidate false**
  *Symptoms*: # Bug report  ## Description / Observed Behavior When updating to version 2.4.0 we noticed updating the cache with the revalidate option set to false causes `isLoading` to be stuck true.  ## Expected Behavior Expected it to behave as it does in 2.3.8 where updating the cache works and does not result in a stuck loading state.  ## Repro Steps / Code Example  In version 2.4.0  https://stackblitz.com/edit/vitejs-vite-j44f8kf9?file=src%2FApp.jsx  In version 2.3.8 https://stackblitz.com/edit/vitejs-vite-k9t9rvsg?file=src%2FApp.jsx  ## Additional Context  SWR version.  2.4.0  
  **Post-Mortem & Fix Analysis**:
  > Yep, noticed the same thing, isLoading and isValidating getting stuck since 2.4.0. I have temporarily reverted to version 2.3.8.

- **Issue #4207** (2026-01-19): **When using `useSWRImmutable`, there were multiple repeated requests to the interface during the global configuration of `refreshInterval`l**
  *Symptoms*: # Bug report  ## Description / Observed Behavior  When the `refreshInterval`parameter is explicitly customized in the global configuration, `useSWRImmutable` continues to refresh the request data in the background. This behavior raises uncertainty regarding whether it constitutes a bug or reflects a potential misunderstanding of the intended usage of the `useSWRImmutable` hook.  <img width="1078" height="749" alt="Image" src="https://github.com/user-attachments/assets/d8ef1dfc-8ae4-434f-a954-7726e19ab017" />  <img width="1307" height="858" alt="Image" src="https://github.com/user-attachments/assets/07609a3b-d3b9-4aa8-9643-36feeb1b8be4" />  ## Expected Behavior  When using the `refershInterval` configuration and simultaneously applying `useSWRImmutable`, interface data will not be automatically requested at regular intervals  ## Repro Steps / Code Example  https://codesandbox.io/p/sandbox/pkzpml  ## Additional Context  SWR version. 2.3.8 Add any other context about the problem here.  

- **Issue #4155** (2025-08-11): **encounter "Fallback data is required when using Suspense in SSR." in suspense mode with 2.3.5**
  *Symptoms*: # Bug report  sw 2.3.5 cause LobeChat build failed while 2.3.4 not.  ```  ⚠ Using edge runtime on a page currently disables static generation for that page    Generating static pages (0/377) ...    Generating static pages (94/377)     Generating static pages (188/377)     Generating static pages (282/377)  Error occurred prerendering page "/en-US__0__dark/chat". Read more: https://nextjs.org/docs/messages/prerender-error Error: Fallback data is required when using Suspense in SSR.     at useSWRHandler (/vercel/path0/.next/server/chunks/30323.js:209816:19)     at /vercel/path0/.next/server/chunks/30323.js:281382:16     at useSWRArgs (/vercel/path0/.next/server/chunks/30323.js:281404:16)     at useFetchPluginStore (/vercel/path0/.next/server/chunks/24346.js:59621:92)     at useControls (/vercel/path0/.next/server/app/[variants]/(main)/chat/(workspace)/page.js:13895:5)     at /vercel/path0/.next/server/app/[variants]/(main)/chat/(workspace)/page.js:42509:85     at nF (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:76:46843)     at nH (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:76:48618)     at nH (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:76:64107)     at nW (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:76:67762) Export encountered an error on /[variants]/(main)/chat/(workspace)/page: /en-US__0__dark/chat, exiting the build.  

- **Issue #3030** (2024-11-25): **unstable_serialize doesn't work with NextJS edge runtime**
  *Symptoms*: # Bug report  ## Description / Observed Behavior When calling `unstable_serialize` from a server component that uses the NextJS **edge runtime** with an array or object key, the key is not serialized properly.  As an example, the code below logs `1~` to the console:  ```javascript export const runtime = 'edge'  export default function Home() {   const key = ['test']   console.log(unstable_serialize(key))    return "Hello" } ```  ## Expected Behavior I would expect the behavior in **edge runtime** to match the **NodeJS runtime**, with `@"test",` logged to the console (example code below)  ```javascript export default function Home() {   const key = ['test']   console.log(unstable_serialize(key))    return "Hello" } ```  ## Additional Context ### Debugging I've done some digging, and the problem seems to originate from the `stableHash` function in the file: https://github.com/vercel/swr/blob/v2.2.5/src/_internal/utils/hash.ts.  - Line 40 (`if (constructor == Array) {`) and Line 48 (`if (constructor == OBJECT) {`) don't return true for arrays/objects when using the edge runtime.  Further testing reveals that although `key.constructor` doesn't equal `Array` in the **edge runtime**, `key instanceof Array` returns true (same applies to objects).  A possible solution could be to change:  - Line 40 to `if (arg instanceof Array) {` - Line 48 to `if (arg instanceof OBJECT) {`  This works in both the **edge runtime** and **NodeJS runtime**, but
  **Post-Mortem & Fix Analysis**:
  > ## Follow-up  Having done a bit more testing, the reason for using `.constructor` rather than `instanceof` is because types like `new Set` are subclasses of `object`, and using `instanceof` would cause subclasses of `object` to be serialized as objects rather than being added to the weak map.  So my new suggested solution is to use `Object.getPrototypeOf` — which seems to work in the edge runtime. I'm still unclear why `.constructor` doesn't work in the edge runtime, though.  Here are some examples:  ```javascript console.log({}.constructor == Object) // false console.log([].constructor == Array) // false  console.log({} instanceof Object) // true console.log([] instanceof Array) // true console.log(new Set([1, 2]) instanceof Object) // true (we want this to be false so it's not serialized as an object)  console.log(Object.getPrototypeOf({}) == Object.prototype) // true console.log(Object.getPrototypeOf([]) == Array.prototype) // true console.log(Object.getPrototypeOf
  > Thanks for your awesome reproduction ❤️   The `instanceof` works because `edge-runtime` uses proxy to patch the behavior https://github.com/vercel/edge-runtime/blob/d6cb77fba517c2e55b9c0353b43f5f2d50c466a2/packages/vm/src/edge-vm.ts#L120  > I'm still unclear why .constructor doesn't work in the edge runtime, though.  the reason why the constructor of `[]` is not `globalThis.Array` is because https://github.com/vercel/next.js/issues/38184#issuecomment-1172212418

- **Issue #2849** (2025-12-02): **React Hook Order Error with Multiple useSWR Hooks in Next.js with Suspense**
  *Symptoms*: # Bug report  ## Description / Observed Behavior In a Next.js project using SWR with Suspense, an issue arises when more than two `useSWR` hooks are used within a single component. The errors encountered are:   - Warning: React has detected a change in the order of Hooks called by ComponentExample. This will lead to bugs and errors if not fixed. - Uncaught Error: Update hook called on initial render. This is likely a bug in React. Please file an issue.  The issue occurs in `Component.tsx`, where three fetch operations are initiated using `useSWR` with `suspense: true`. The intention is to perform three separate data fetches with delays and console log the outputs.  ```typescript "use client";  import useSWR from "swr";  const fetchWithDelay = async (url: string) => {   const delay = parseInt(url) * 1000;   await new Promise((resolve) => setTimeout(() => resolve(url), delay));   return url; };  export const ComponentExample: React.FC = () => {   const { data: dataAfter1 } = useSWR("1", fetchWithDelay, {     suspense: true,   });   console.log(dataAfter1);    const { data: dataAfter2 } = useSWR("2", fetchWithDelay, {     suspense: true,   });   console.log(dataAfter2);    const { data: dataAfter3 } = useSWR("3", fetchWithDelay, {     suspense: true,   });   console.log(dataAfter3);    return (     <main>       <p>Page loaded!</p>     </main>   ); }; ```  ## Expected Behavior  The expectation is that using multiple `useSWR` hooks in
  **Post-Mortem & Fix Analysis**:
  > Same problem here! Appreciate a quick fix
  > duplicate of #2702
  > For future readers: note that #2702 was [closed in favor](https://github.com/vercel/swr/issues/2702#issuecomment-1862305338) of this issue.

- **Issue #2702** (2023-12-19): **Updating from 2.1.5 to 2.2.0 causes issue with hooks order in next.js app router**
  *Symptoms*: # Bug report  ## Description / Observed Behavior  After updating from 2.1.5 to 2.2.0 I start seeing the following error: ``` [Error] Warning: React has detected a change in the order of Hooks called by DashboardLayout. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://reactjs.org/link/rules-of-hooks     Previous render            Next render    ------------------------------------------------------ 1. useContext                 useContext 2. useRef                     useRef 3. useRef                     useRef 4. useRef                     useRef 5. useRef                     useRef 6. useRef                     useRef 7. useRef                     useRef 8. useMemo                    useMemo 9. useCallback                useCallback 10. useSyncExternalStore      useSyncExternalStore 11. useRef                    useRef 12. useCallback               useCallback 13. useCallback               useCallback 14. useLayoutEffect           useLayoutEffect 15. useLayoutEffect           useLayoutEffect 16. useLayoutEffect           useLayoutEffect 17. useDebugValue             useDebugValue 18. undefined                 useContext    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  DashboardLayout NoSSR Suspense LoadableComponent InnerLayoutRouter Component@ RedirectBoundary NotFoundBoundary LoadingBoundary ErrorBoundary Component@ ScrollAndFocusHandler RenderFromTemplateContext Oute
  **Post-Mortem & Fix Analysis**:
  > I encountered the same problem. As I modify other parts of the code (removing useMemo), this issue appears and disappears like a ghost, making it difficult for me to organize a minimal reproducible code. I will try again when I have time.
  > `dynamic` is a very old code with no maintenance for a long time. I think you should use `React.lazy` with `Suspense` to replace it
  > > `dynamic` is a very old code with no maintenance for a long time. I think you should use `React.lazy` with `Suspense` to replace it  In my case, I didn't use dynamic but still encountered the problem of hook order, so I suspect this may not be related to dynamic. 

- **Issue #2580** (2023-04-25): **`useSWRMutation` throw an error `useSWR is not a function` in Server-Side-Rendering**
  *Symptoms*: # Bug report  ## Description / Observed Behavior  `useSWRMutation` will throw an error "Uncaught TypeError: useSWR is not a function" when used in SSR.  ## Expected Behavior  No error should be thrown.  ## Repro Steps / Code Example  ```bash $ node Welcome to Node.js v16.16.0. Type ".help" for more information. > const useSWRMutation = require('swr/mutation').default; useSWRMutation('test', () => Promise.resolve([])); Uncaught TypeError: useSWR is not a function     at Object.default (/Users/qiqiboy/develop/swr/node_modules/swr/_internal/dist/index.js:722:16) >  ```  ## Additional Context  Version: 2.1.4  
  **Post-Mortem & Fix Analysis**:
  > Agree I don't think 2.4.1 is ready yet. Looking at: https://codesandbox.io/s/swr-infinite-xv8q7u?file=/src/App.js it fails as well.  My useSwrInfinite function fails too.
  > I get the same error in JEST testing context of a next.js app. Downgrading to 2.1.3 fixes it.  NodeJS V18 with Next 13.3.0 & JEST 29.5.0  ![2023-04-25 at 11 20](https://user-images.githubusercontent.com/10775702/234232762-6d38f354-1dee-4250-b8ad-d210a18bb9b5.png)  
  > Landed a fix in v2.1.5, can you try bumping to that version to see if it fixes your issue? Thanks

- **Issue #2548** (2023-04-07): **useSWRSubscription key doesnt deconstruct array**
  *Symptoms*: # Bug report  ## Description / Observed Behavior When using an array key the key that is passed to the subscribe function is a string and not an array  ## Expected Behavior I expect it to be deconstructed similar to is shown under "Usage" here https://swr.vercel.app/docs/subscription  ## Repro Steps / Code Example  ```   const key = "a key";   const { data } = useSWRSubscription(["key", key], (passedKey, { next }) => {     passedKey === '@"key","a key",' // returns true     return () => {};   }); ```  https://codesandbox.io/s/relaxed-silence-h556kz?file=/src/App.js  ## Additional Context 2.1.2 
  **Post-Mortem & Fix Analysis**:
  > we should pass original key here instead of serialized key https://github.com/vercel/swr/blob/bad51f61bf54166abcb0f2a424eafda88157a6ab/subscription/index.ts#L67
  > I would like to take this issue
  > By the way Could we pass `originKey` in `onError/onSuccess` callback? Now it accepts **only** serialized key, it's terrible.  @Zheaoli @promer94

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

### Incident Patch 1: `57a71f71` (2026-09-14)
**Commit Message**: Chore: Fix X handle link (#4334)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ library to handle that part.
 
 This library is created by the team behind [Next.js](https://nextjs.org), with contributions from our community:
 
-- Shu Ding ([@shuding\_](https://x.com/shuding_)) - [Vercel](https://vercel.com)
+- Shu Ding ([@shuding\_](https://x.com/shuding)) - [Vercel](https://vercel.com)
 - Jiachi Liu ([@huozhi](https://x.com/huozhi)) - [Vercel](https://vercel.com)
 - Guillermo Rauch ([@rauchg](https://x.com/rauchg)) - [Vercel](https://vercel.com)
 - Joe Haddad ([@timer150](https://x.com/timer150)) - [Vercel](https://vercel.com)
```

---

### Incident Patch 2: `9e8b1c9d` (2026-08-12)
**Commit Message**: fix: clean up completed subscription state (#4310)

Closes #4261

## Summary

- Remove the final subscriber's stale ref-count and disposer entries
from the cache-bound Maps.
- Add a regression test covering deduplication, disposal, and a fresh
remount.

## Verification

local verification not run; relying on upstream CI

The worktree has no installed `node_modules`, so the repository's Jest
command cannot run locally.

**File**: `src/subscription/index.ts` (modified, +5/-0)
```diff
@@ -90,6 +90,11 @@ export const subscription = (<Data = any, Error = any>(useSWRNext: SWRHook) =>
         if (!count) {
           const dispose = disposers.get(subscriptionKey)
           dispose?.()
+
+          // Remove both entries, so the internal states only retain the
+          // subscription keys that currently have active subscribers.
+          subscriptions.delete(subscriptionKey)
+          disposers.delete(subscriptionKey)
         }
       }
     }, [subscriptionKey])
```

**File**: `test/use-swr-subscription.test.tsx` (modified, +48/-0)
```diff
@@ -321,4 +321,52 @@ describe('useSWRSubscription', () => {
       'The `subscribe` function must return a function to unsubscribe.'
     )
   })
+
+  it('should clean up the subscription state after the last subscriber unmounts', async () => {
+    const swrKey = createKey()
+
+    let subscribeCount = 0
+    let disposeCount = 0
+
+    function subscribe(key, { next }) {
+      ++subscribeCount
+      next(undefined, key)
+      return () => {
+        ++disposeCount
+      }
+    }
+
+    function Sub() {
+      useSWRSubscription(swrKey, subscribe)
+      useSWRSubscription(swrKey, subscribe)
+      useSWRSubscription(swrKey, subscribe)
+      return null
+    }
+
+    function Page() {
+      const [mounted, setMounted] = useState(true)
+      return (
+        <>
+          <button onClick={() => setMounted(v => !v)}>toggle</button>
+          {mounted ? <Sub /> : null}
+        </>
+      )
+    }
+
+    renderWithConfig(<Page />)
+    await act(() => sleep(10))
+
+    // Multiple hooks with the same key share a single subscription.
+    expect(subscribeCount).toBe(1)
+    expect(disposeCount).toBe(0)
+
+    // Unmounting the last subscriber disposes the subscription.
+    fireEvent.click(screen.getByText('toggle'))
+    expect(disposeCount).toBe(1)
+
+    // The state is fully cleaned up, so remounting starts fresh.
+    fireEvent.click(screen.getByText('toggle'))
+    expect(subscribeCount).toBe(2)
+    expect(disposeCount).toBe(1)
+  })
 })
```

---

### Incident Patch 3: `a33fba73` (2026-08-10)
**Commit Message**: fix: revalidate suspense cacheData on remount (#4312)

## Problem

When `suspense: true` is set and `cacheData` is present for the key,
current implementation does not revalidate on unmount/remount even when
`revalidateIfStale: true` is set, preventing automatic client-side mount
revalidation indefinitely when both options are used.

This PR restores the normal `revalidateOnMount` / `revalidateIfStale`
behavior after the server-loaded value has entered the SWR cache.

> Context: In our app, we rely on automatic remount revalidation on SPA
navigation to achieve MPA-like refetch behavior so that we only have to
cal `mutate()` keys within the same page for UI consistency. We still
want to skip initial duplicate fetches but need remount re-validations
to achieve this behavior.

## Summary

- Skip `cacheData` revalidation only for the render where no cached data
exists
- Extend the RSC preload E2E to cover unmounting and remounting
behaviors with suspense: true
## Behavior

| Scenario | Browser fetches |
| --- | ---: |
| Initial Suspense render with an empty SWR cache and `cacheData` | 0 |
| Later remount with cached data and default options | 1 |
| Later remount with `revalidateIfStale

**File**: `src/index/use-swr.ts` (modified, +6/-2)
```diff
@@ -286,8 +286,10 @@ export const useSWRHandler = <Data = any, Error = any>(
         // If `revalidateOnMount` is set, we take the value directly.
         if (isInitialMount && !isUndefined(revalidateOnMount))
           return revalidateOnMount
-        if (suspense && hasCacheData) return false
         const data = !isUndefined(fallback) ? fallback : snapshot.data
+        // cacheData is consumed during the initial Suspense render. Once data
+        // is cached, fall through to the normal mount revalidation policy.
+        if (suspense && hasCacheData && isUndefined(data)) return false
         if (suspense) return isUndefined(data) || revalidateIfStale
         return isUndefined(data) || revalidateIfStale
       })()
@@ -448,7 +450,9 @@ export const useSWRHandler = <Data = any, Error = any>(
     // If `revalidateOnMount` is set, we take the value directly.
     if (isInitialMount && !isUndefined(revalidateOnMount))
       return revalidateOnMount
-    if (suspense && hasCacheData) return false
+    // cacheData satisfies the initial Suspense render without a duplicate
+    // request. Cached data on a later mount follows revalidateIfStale.
+    if (suspense && hasCacheData && hasKeyButNoData) return false
     // Under suspense mode, it will always fetch on render if there is no
     // stale data so no need to revalidate immediately mount it again.
     // If data exists, only revalidate if `revalidateIfStale` is true.
```

**File**: `test/e2e/promise-scenarios.test.ts` (modified, +11/-2)
```diff
@@ -71,17 +71,26 @@ test.describe('promise scenarios', () => {
     ).toHaveCount(0)
     expect(clientFetcherCalls).toBe(0)
 
-    await page.getByTestId('revalidate').click()
+    await page.getByTestId('toggle-mounted').click()
+    await expect(page.getByTestId('data')).toHaveCount(0)
+    await page.getByTestId('toggle-mounted').click()
 
     await expect.poll(() => clientFetcherCalls).toBe(1)
     await expect(page.getByTestId('data')).toHaveText(
       'data:CLIENT_FETCHER_RESULT_AFTER_TRIGGER'
     )
+
+    await page.getByTestId('revalidate').click()
+
+    await expect.poll(() => clientFetcherCalls).toBe(2)
+    await expect(page.getByTestId('data')).toHaveText(
+      'data:CLIENT_FETCHER_RESULT_AFTER_TRIGGER'
+    )
     await expect(page.getByTestId('cache')).toHaveText(
       'cache:CLIENT_FETCHER_RESULT_AFTER_TRIGGER'
     )
     await expect(page.getByTestId('client-fetches')).toHaveText(
-      'client fetches:1'
+      'client fetches:2'
     )
   })
 
```

**File**: `test/e2e/site/app/rsc-unstable-preload/client.tsx` (modified, +12/-3)
```diff
@@ -30,6 +30,7 @@ function ClientData({
 
 export function ClientRoot({ cacheData }: { cacheData: CacheData<string> }) {
   const [clientFetches, setClientFetches] = useState(0)
+  const [mounted, setMounted] = useState(true)
   const fetcher = useCallback(async () => {
     ;(
       window as typeof window & {
@@ -42,9 +43,17 @@ export function ClientRoot({ cacheData }: { cacheData: CacheData<string> }) {
 
   return (
     <SWRConfig value={{ cacheData }}>
-      <Suspense fallback={<div data-testid="fallback">loading</div>}>
-        <ClientData fetcher={fetcher} clientFetches={clientFetches} />
-      </Suspense>
+      <button
+        data-testid="toggle-mounted"
+        onClick={() => setMounted(current => !current)}
+      >
+        {mounted ? 'unmount' : 'mount'}
+      </button>
+      {mounted && (
+        <Suspense fallback={<div data-testid="fallback">loading</div>}>
+          <ClientData fetcher={fetcher} clientFetches={clientFetches} />
+        </Suspense>
+      )}
     </SWRConfig>
   )
 }
```

**File**: `test/use-swr-config.test.tsx` (modified, +122/-0)
```diff
@@ -11,6 +11,35 @@ import {
   sleep
 } from './utils'
 
+function renderSuspenseCacheData({
+  key,
+  fetcher,
+  revalidateIfStale,
+  revalidateOnMount
+}: {
+  key: string
+  fetcher: () => Promise<string>
+  revalidateIfStale?: boolean
+  revalidateOnMount?: boolean
+}) {
+  function Page() {
+    const { data } = useSWR(key, fetcher, {
+      suspense: true,
+      ...(revalidateIfStale === undefined ? {} : { revalidateIfStale }),
+      ...(revalidateOnMount === undefined ? {} : { revalidateOnMount })
+    })
+    return <div>data:{data}</div>
+  }
+
+  return renderWithGlobalCache(
+    <SWRConfig value={{ cacheData: { [key]: 'server data' } }}>
+      <Suspense fallback={<div>loading</div>}>
+        <Page />
+      </Suspense>
+    </SWRConfig>
+  )
+}
+
 describe('useSWR - configs', () => {
   it('should read the config fallback from the context', async () => {
     let value = 0
@@ -155,6 +184,99 @@ describe('useSWR - configs', () => {
     }
   )
 
+  itShouldSkipForReactCanary(
+    'should revalidate on remount after suspense consumes cacheData',
+    async () => {
+      const key = createKey()
+      const clientFetcher = jest.fn(() => createResponse('client data'))
+
+      const firstRender = renderSuspenseCacheData({
+        key,
+        fetcher: clientFetcher
+      })
+
+      screen.getByText('data:server data')
+      await act(() => sleep(50))
+      expect(clientFetcher).not.toHaveBeenCalled()
+
+      firstRender.unmount()
+      renderSuspenseCacheData({ key, fetcher: clientFetcher })
+
+      await screen.findByText('data:client data')
+      expect(clientFetcher).toHaveBeenCalledTimes(1)
+    }
+  )
+
+  itShouldSkipForReactCanary(
+    'should respect revalidateIfStale after suspense consumes cacheData',
+    async () => {
+      const key = createKey()
+      const clientFetcher = jest.fn(() => createResponse('client data'))
+
+      const firstRender = renderSuspenseCacheData({
+        key,
+        fetcher: clientFetcher,
+        revalidateIfStale: false
+      })
+
+      screen.getByText('data:server data')
+      firstRender.unmount()
+      renderSuspenseCacheData({
+        key,
+        fetcher: clientFetcher,
+        revalidateIfStale: false
+      })
+
+      await act(() => sleep(50))
+      screen.getByText('data:server data')
+      expect(clientFetcher).not.toHaveBeenCalled()
+    }
+  )
+
+  itShouldSkipForReactCanary(
+    'should respect revalidateOnMount false after suspense consumes cacheData',
+    async () => {
+      const key = createKey()
+      const clientFetcher = jest.fn(() => createResponse('client data'))
+
+      const firstRender = renderSuspenseCacheData({
+        key,
+        fetcher: clientFetcher,
+        revalidateOnMount: false
+      })
+
+      screen.getByText('data:server data')
+      firstRender.unmount()
+      renderSuspenseCacheData({
+        key,
+        fetcher: clientFetcher,
+        revalidateOnMount: false
+      })
+
+      await act(() => sleep(50))
+      screen.getByText('data:server data')
+      expect(clientFetcher).not.toHaveBeenCalled()
+    }
+  )
+
+  itShouldSkipForReactCanary(
+    'should respect revalidateOnMount true when suspense consumes cacheData',
+    async () => {
+      const key = createKey()
+      const clientFetcher = jest.fn(() => createResponse('client data'))
+
+      renderSuspenseCacheData({
+        key,
+        fetcher: clientFetcher,
+        revalidateOnMount: true
+      })
+
+      screen.getByText('data:server data')
+      await screen.findByText('data:client data')
+      expect(clientFetcher).toHaveBeenCalledTimes(1)
+    }
+  )
+
   itShouldSkipForReactCanary(
     'should not expose the cacheData record on later revalidation',
     async () => {
```

---

### Incident Patch 4: `ad7b276a` (2026-08-07)
**Commit Message**: fix: hydrate cacheData for hooks without a fetcher (#4293)

## Summary

Hydrate request-scoped `cacheData` into SWR's cache for `useSWR(key,
null)` without treating hydration as revalidation.

- Support plain, promised, and rejected `cacheData` values.
- Keep each key one-shot per request-scoped `cacheData` object.
- Share consumption state across fetcher, fetcherless, and Suspense
paths.
- Avoid client fetching, validation state, retries, and revalidation
callbacks during hydration.

## Problem

Default-mode `cacheData` was consumed inside `revalidate`. A hook
without a fetcher never enters that path, so `useSWR(key, null)`
remained undefined and the server-loaded value was never written into
SWR's cache.

Tracking consumption only by serialized key also cannot distinguish a
fresh request-scoped `cacheData` object from an already-consumed one.
Promised values additionally need protection from key changes and newer
local mutations.

## Solution

After React commits, a fetcherless hook resolves its matching
`cacheData` value and writes the resulting data or error into the
external cache. The commit proceeds only while:

- the hook still owns the same key;
- no newer mutation has sta

**File**: `src/index/use-swr.ts` (modified, +98/-7)
```diff
@@ -35,7 +35,8 @@ import type {
   SWRHook,
   RevalidateEvent,
   StateDependencies,
-  GlobalState
+  GlobalState,
+  CacheData
 } from '../_internal'
 
 const use =
@@ -76,6 +77,60 @@ const use =
 
 const WITH_DEDUPE = { dedupe: true }
 
+type ConsumedCacheData = WeakMap<CacheData, Set<string>>
+
+const isCacheDataConsumed = (
+  consumedCacheData: ConsumedCacheData,
+  cacheData: CacheData | undefined,
+  key: string
+) => (cacheData ? consumedCacheData.get(cacheData)?.has(key) === true : false)
+
+const markCacheDataConsumed = (
+  consumedCacheData: ConsumedCacheData,
+  cacheData: CacheData | undefined,
+  key: string
+) => {
+  if (!cacheData) return
+
+  let consumedKeys = consumedCacheData.get(cacheData)
+  if (!consumedKeys) {
+    consumedKeys = new Set()
+    consumedCacheData.set(cacheData, consumedKeys)
+  }
+  consumedKeys.add(key)
+}
+
+const commitCacheData = <Data>({
+  value,
+  getCacheData,
+  canCommit,
+  setCache
+}: {
+  value: CacheData<Data>[string]
+  getCacheData: () => Data | undefined
+  canCommit: () => boolean
+  setCache: (
+    state: { data: Data; error: undefined } | { error: unknown }
+  ) => void
+}) => {
+  const commit = (
+    state: { data: Data; error: undefined } | { error: unknown }
+  ) => {
+    if (canCommit() && isUndefined(getCacheData())) {
+      setCache(state)
+    }
+  }
+
+  Promise.resolve(value).then(
+    data => {
+      commit({ data, error: UNDEFINED })
+    },
+    error => {
+      commit({ error })
+    }
+  )
+}
+
 type DefinitelyTruthy<T> = false extends T
   ? never
   : 0 extends T
@@ -185,7 +240,8 @@ export const useSWRHandler = <Data = any, Error = any>(
       ? UNDEFINED
       : config.fallback[key]
     : fallbackData
-  const configCacheData = !key ? UNDEFINED : config.cacheData?.[key]
+  const serverCacheData = config.cacheData
+  const configCacheData = !key ? UNDEFINED : serverCacheData?.[key]
   const req = key ? PRELOAD[key] : UNDEFINED
   // `cacheData` is request-scoped data provided by a Server Component through
   // `SWRConfig`'s context. It's only used when there's no in-flight client
@@ -319,11 +375,17 @@ export const useSWRHandler = <Data = any, Error = any>(
 
   // Use a ref to store previously returned data. Use the initial data as its initial value.
   const laggyDataRef = useRef(data)
-  const rscPreloadConsumedRef = useRef(false)
+  const consumedCacheDataRef = useRef<ConsumedCacheData | undefined>(UNDEFINED)
+  let consumedCacheData = consumedCacheDataRef.current
+  if (!consumedCacheData) {
+    consumedCacheData = new WeakMap()
+    consumedCacheDataRef.current = consumedCacheData
+  }
   const preloadCacheRef = useRef<{
     data: Data | undefined
     _k: Key
     key: string
+    cacheData?: CacheData
   } | null>(null)
 
   let returnedData = keepPreviousData
@@ -430,7 +492,7 @@ export const useSWRHandler = <Data = any, Error = any>(
       const shouldStartNewRequest = !FETCH[key] || !opts.dedupe
       const shouldUseRSCPreload =
         hasCacheData &&
-        !rscPreloadConsumedRef.current &&
+        !isCacheDataConsumed(consumedCacheData, serverCacheData, key) &&
         !isUndefined(preloadedData) &&
         isUndefined(getCache().data)
 
@@ -495,7 +557,7 @@ export const useSWRHandler = <Data = any, Error = any>(
           // Start the request and save the timestamp.
           // Key must be truthy if entering here.
           if (shouldUseRSCPreload) {
-            rscPreloadConsumedRef.current = true
+            markCacheDataConsumed(consumedCacheData, serverCacheData, key)
           }
           FETCH[key] = [
             shouldUseRSCPreload
@@ -671,6 +733,7 @@ export const useSWRHandler = <Data = any, Error = any>(
     if (!preloaded) return
 
     preloadCacheRef.current = null
+    markCacheDataConsumed(consumedCacheData, preloaded.cacheData, preloaded.key)
     if (isUndefined(getCache().data)) {
       setCache({ data: preloaded.data, error: UNDEFINED, _k: preloaded._k })
     }
@@ -690,6 +753,30 @@ 
```

**File**: `test/e2e/promise-scenarios.test.ts` (modified, +27/-0)
```diff
@@ -127,6 +127,33 @@ test.describe('promise scenarios', () => {
     )
   })
 
+  test('hydrates preload cacheData without revalidating a fetcherless hook', async ({
+    page
+  }) => {
+    let clientFetcherCalls = 0
+    await page.exposeFunction('__SWR_RSC_CLIENT_FETCHER_CALLED__', () => {
+      clientFetcherCalls += 1
+    })
+
+    await page.goto('./rsc-unstable-preload-no-suspense?fetcher=none', {
+      waitUntil: 'commit'
+    })
+
+    await expect(page.getByTestId('data')).toHaveText(
+      'data:SWR_RSC_PRELOAD_NO_SUSPENSE_MARKER_20260621'
+    )
+    await expect(page.getByTestId('cache')).toHaveText(
+      'cache:SWR_RSC_PRELOAD_NO_SUSPENSE_MARKER_20260621'
+    )
+    await expect(page.getByTestId('loading')).toHaveText('loading:false')
+    await expect(page.getByTestId('validating')).toHaveText('validating:false')
+    await expect(page.getByTestId('successes')).toHaveText('successes:0')
+    await expect(page.getByTestId('client-fetches')).toHaveText(
+      'client fetches:0'
+    )
+    expect(clientFetcherCalls).toBe(0)
+  })
+
   test('does not leak preloaded cacheData across requests', async ({
     request
   }) => {
```

**File**: `test/e2e/site/app/rsc-unstable-preload-no-suspense/client.tsx` (modified, +24/-5)
```diff
@@ -7,10 +7,12 @@ import { key } from './key'
 
 function ClientData({
   fetcher,
-  clientFetches
+  clientFetches,
+  successes
 }: {
-  fetcher: () => Promise<string>
+  fetcher: (() => Promise<string>) | null
   clientFetches: number
+  successes: number
 }) {
   const { cache } = useSWRConfig()
   const { data, isLoading, isValidating, mutate } = useSWR(key, fetcher)
@@ -23,15 +25,23 @@ function ClientData({
       <div data-testid="validating">validating:{`${isValidating}`}</div>
       <div data-testid="cache">cache:{cachedData}</div>
       <div data-testid="client-fetches">client fetches:{clientFetches}</div>
+      <div data-testid="successes">successes:{successes}</div>
       <button data-testid="revalidate" onClick={() => void mutate()}>
         revalidate
       </button>
     </>
   )
 }
 
-export function ClientRoot({ cacheData }: { cacheData: CacheData<string> }) {
+export function ClientRoot({
+  cacheData,
+  withFetcher = true
+}: {
+  cacheData: CacheData<string>
+  withFetcher?: boolean
+}) {
   const [clientFetches, setClientFetches] = useState(0)
+  const [successes, setSuccesses] = useState(0)
   const fetcher = useCallback(async () => {
     ;(
       window as typeof window & {
@@ -43,8 +53,17 @@ export function ClientRoot({ cacheData }: { cacheData: CacheData<string> }) {
   }, [])
 
   return (
-    <SWRConfig value={{ cacheData }}>
-      <ClientData fetcher={fetcher} clientFetches={clientFetches} />
+    <SWRConfig
+      value={{
+        cacheData,
+        onSuccess: () => setSuccesses(count => count + 1)
+      }}
+    >
+      <ClientData
+        fetcher={withFetcher ? fetcher : null}
+        clientFetches={clientFetches}
+        successes={successes}
+      />
     </SWRConfig>
   )
 }
```

**File**: `test/e2e/site/app/rsc-unstable-preload-no-suspense/page.tsx` (modified, +7/-2)
```diff
@@ -10,13 +10,18 @@ async function getServerData() {
   return 'SWR_RSC_PRELOAD_NO_SUSPENSE_MARKER_20260621'
 }
 
-export default async function Page() {
+export default async function Page({
+  searchParams
+}: {
+  searchParams: Promise<{ fetcher?: string }>
+}) {
   // Opt into dynamic rendering so each request preloads fresh server data.
   await connection()
 
   // Runtime resolves the react-server export; this app's type checker still
   // reads the default client preload signature.
   const cacheData = preload(key, getServerData) as unknown as CacheData<string>
+  const { fetcher } = await searchParams
 
-  return <ClientRoot cacheData={cacheData} />
+  return <ClientRoot cacheData={cacheData} withFetcher={fetcher !== 'none'} />
 }
```

**File**: `test/use-swr-config.test.tsx` (modified, +269/-0)
```diff
@@ -209,6 +209,275 @@ describe('useSWR - configs', () => {
     expect(clientFetcher).toHaveBeenCalledTimes(0)
   })
 
+  it('should provide cacheData to hooks without a fetcher', async () => {
+    const key = createKey()
+    const cacheData = { [key]: 'server data' }
+    const onSuccess = jest.fn()
+
+    function Page() {
+      const { data, isValidating } = useSWR<string>(key, null)
+      return (
+        <div>
+          data:{data}:{String(isValidating)}
+        </div>
+      )
+    }
+
+    renderWithGlobalCache(
+      <SWRConfig value={{ cacheData, onSuccess }}>
+        <Page />
+      </SWRConfig>
+    )
+
+    await screen.findByText('data:server data:false')
+    expect(onSuccess).not.toHaveBeenCalled()
+  })
+
+  it('should provide promised cacheData to hooks without a fetcher', async () => {
+    const key = createKey()
+    const cacheData = { [key]: createResponse('server data') }
+
+    function Page() {
+      const { data } = useSWR<string>(key, null)
+      return <div>data:{data}</div>
+    }
+
+    renderWithGlobalCache(
+      <SWRConfig value={{ cacheData }}>
+        <Page />
+      </SWRConfig>
+    )
+
+    await screen.findByText('data:server data')
+  })
+
+  it('should write rejected cacheData to the error state for hooks without a fetcher', async () => {
+    const key = createKey()
+    const cacheData = { [key]: Promise.reject(new Error('server error')) }
+
+    function Page() {
+      const { error } = useSWR<string>(key, null)
+      return <div>error:{error?.message}</div>
+    }
+
+    renderWithGlobalCache(
+      <SWRConfig value={{ cacheData }}>
+        <Page />
+      </SWRConfig>
+    )
+
+    await screen.findByText('error:server error')
+  })
+
+  it('should consume cacheData after switching to a new key for hooks without a fetcher', async () => {
+    const keyA = createKey()
+    const keyB = createKey()
+    const cacheData = { [keyA]: 'a data', [keyB]: 'b data' }
+
+    function Page() {
+      const [useB, setUseB] = useState(false)
+      const { data } = useSWR<string>(useB ? keyB : keyA, null)
+      return <button onClick={() => setUseB(true)}>data:{data}</button>
+    }
+
+    renderWithGlobalCache(
+      <SWRConfig value={{ cacheData }}>
+        <Page />
+      </SWRConfig>
+    )
+
+    await screen.findByText('data:a data')
+    fireEvent.click(screen.getByRole('button'))
+    await screen.findByText('data:b data')
+  })
+
+  it('should not reseed cacheData after the cache entry is cleared', async () => {
+    const key = createKey()
+    const cacheData = { [key]: 'server data' }
+
+    function Page() {
+      const { data, mutate } = useSWR<string>(key, null)
+      return (
+        <button onClick={() => mutate(undefined, { revalidate: false })}>
+          data:{String(data)}
+        </button>
+      )
+    }
+
+    renderWithGlobalCache(
+      <SWRConfig value={{ cacheData }}>
+        <Page />
+      </SWRConfig>
+    )
+
+    await screen.findByText('data:server data')
+    fireEvent.click(screen.getByRole('button'))
+    await screen.findByText('data:undefined')
+    await act(() => sleep(50))
+    screen.getByText('data:undefined')
+  })
+
+  it('should not reuse cacheData after adding a fetcher', async () => {
+    const key = createKey()
+    const cacheData = { [key]: 'server data' }
+    const clientFetcher = jest.fn(() => createResponse('client data'))
+
+    function Page() {
+      const [hasFetcher, setHasFetcher] = useState(false)
+      const { data, mutate } = useSWR<string>(
+        key,
+        hasFetcher ? clientFetcher : null
+      )
+      return (
+        <>
+          <div>data:{String(data)}</div>
+          <button onClick={() => mutate(undefined, { revalidate: false })}>
+            clear
+          </button>
+          <button onClick={() => setHasFetcher(true)}>
+            fetcher:{hasFetcher ? 'on' : 'off'}
+          </button>
+          <button onClick={() => mutate()}>revalidate</button>
+        </>
+      )
+   
```

---

### Incident Patch 5: `574daf30` (2026-06-27)
**Commit Message**: fix: point _internal react-server export at existing file (#4272)

fix: point swr _internal react-server export at existing file

**File**: `package.json` (modified, +2/-1)
```diff
@@ -70,7 +70,7 @@
       }
     },
     "./_internal": {
-      "react-server": "./dist/_internal/react-server.mjs",
+      "react-server": "./dist/_internal/index.react-server.mjs",
       "import": {
         "types": "./dist/_internal/index.d.mts",
         "default": "./dist/_internal/index.mjs"
@@ -178,3 +178,4 @@
     "use-sync-external-store": "^1.6.0"
   }
 }
+
```

---

### Incident Patch 6: `c39d701f` (2026-05-10)
**Commit Message**: fix: guard against double-unsubscribe removing wrong subscriber in cache.ts (#4252)

fix: guard against double-unsubscribe removing wrong subscriber

When the unsubscribe function returned by `subscribe` was called more
than once, `subs.indexOf(callback)` returned -1, causing
`subs.splice(-1, 1)` to silently remove the last subscriber in the
array instead of doing nothing.

Fix by checking `index >= 0` before mutating the array, using the same
O(1) swap-and-pop pattern already used in `subscribe-key.ts`.

Signed-off-by: tomohiro86 <supersonic.dps@gmail.com>
Co-authored-by: Tomohiro Yamada <tomohiro.yamada@TomohironoMacBook-Air.local>

**File**: `src/_internal/utils/cache.ts` (modified, +8/-1)
```diff
@@ -56,7 +56,14 @@ export const initCache = <Data = any>(
       subscriptions[key] = subs
 
       subs.push(callback)
-      return () => subs.splice(subs.indexOf(callback), 1)
+      return () => {
+        const index = subs.indexOf(callback)
+        if (index >= 0) {
+          // O(1): swap with the last element and pop
+          subs[index] = subs[subs.length - 1]
+          subs.pop()
+        }
+      }
     }
     const setter = (key: string, value: any, prev: any) => {
       provider.set(key, value)
```

---

### Incident Patch 7: `46f3954a` (2026-04-17)
**Commit Message**: Security: Update axios versions in the examples (#4243)

Update axios versions in the examples

Fixes: VULN-7906
Fixes: VULN-7907

**File**: `examples/axios-typescript/package.json` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
   "main": "index.js",
   "license": "MIT",
   "dependencies": {
-    "axios": "0.23.0",
+    "axios": "1.15.0",
     "next": "latest",
     "react": "latest",
     "react-dom": "latest",
```

**File**: `examples/axios/package.json` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
   "main": "index.js",
   "license": "MIT",
   "dependencies": {
-    "axios": "0.27.2",
+    "axios": "1.15.0",
     "next": "latest",
     "react": "latest",
     "react-dom": "latest",
```

---

### Incident Patch 8: `825092b6` (2026-02-27)
**Commit Message**: fix: Fix #4221 (#4223)

fix #4221

**File**: `src/index/use-swr.ts` (modified, +4/-2)
```diff
@@ -376,11 +376,13 @@ export const useSWRHandler = <Data = any, Error = any>(
     return isUndefined(data) || revalidateIfStale
   })()
 
+  const defaultValidatingState = isInitialMount && shouldDoInitialRevalidation
+
   const isValidating = isUndefined(cached.isValidating)
-    ? shouldDoInitialRevalidation
+    ? defaultValidatingState
     : cached.isValidating
   const isLoading = isUndefined(cached.isLoading)
-    ? shouldDoInitialRevalidation
+    ? defaultValidatingState
     : cached.isLoading
 
   // The revalidation function is a carefully crafted wrapper of the original
```

**File**: `test/use-swr-local-mutation.test.tsx` (modified, +33/-0)
```diff
@@ -791,6 +791,39 @@ describe('useSWR - local mutation', () => {
     screen.getByText('false')
   })
 
+  it('isLoading and isValidating should be false when revalidate is set to false', async () => {
+    const key = createKey()
+    function Page() {
+      const { data, isLoading, isValidating, mutate } = useSWR(
+        key,
+        () => 'data',
+        {
+          fallbackData: 'fallback',
+          revalidateOnMount: false,
+          revalidateOnFocus: false
+        }
+      )
+      return (
+        <div>
+          <p>data: {data}</p>
+          <p>isLoading: {isLoading.toString()}</p>
+          <p>isValidating: {isValidating.toString()}</p>
+          <button onClick={() => mutate('fallback1', { revalidate: false })}>
+            mutate
+          </button>
+        </div>
+      )
+    }
+    renderWithConfig(<Page />)
+    screen.getByText('data: fallback')
+    screen.getByText('isLoading: false')
+    screen.getByText('isValidating: false')
+    fireEvent.click(screen.getByText('mutate'))
+    await screen.findByText('data: fallback1')
+    screen.getByText('isLoading: false')
+    screen.getByText('isValidating: false')
+  })
+
   it('bound mutate should always use the latest key', async () => {
     const key = createKey()
     const fetcher = jest.fn(() => 'data')
```

---

### Incident Patch 9: `f8647706` (2026-01-30)
**Commit Message**: fix: Ensure preload runs only on client (#4213)

**File**: `src/_internal/utils/preload.ts` (modified, +6/-0)
```diff
@@ -10,6 +10,7 @@ import { cache } from './config'
 import { SWRGlobalState } from './global-state'
 import { isUndefined } from './shared'
 import { INFINITE_PREFIX } from '../constants'
+import { IS_SERVER } from './env'
 // Basically same as Fetcher but without Conditional Fetching
 type PreloadFetcher<
   Data = unknown,
@@ -28,6 +29,11 @@ export const preload = <
   key_: SWRKey,
   fetcher: Fetcher
 ): ReturnType<Fetcher> => {
+  // preload should be a no-op on the server
+  if (IS_SERVER) {
+    return undefined as ReturnType<Fetcher>
+  }
+
   const [key, fnArg] = serialize(key_)
   const [, , , PRELOAD] = SWRGlobalState.get(cache) as GlobalState
 
```

**File**: `test/use-swr-server.test.tsx` (modified, +26/-0)
```diff
@@ -14,6 +14,32 @@ async function withServer(runner: () => Promise<void>) {
 }
 
 describe('useSWR - SSR', () => {
+  describe('preload on server', () => {
+    beforeAll(() => {
+      // @ts-expect-error
+      global.window.Deno = '1'
+    })
+
+    afterAll(() => {
+      // @ts-expect-error
+      delete global.window.Deno
+    })
+
+    it('should be a no-op on the server', async () => {
+      await withServer(async () => {
+        const { preload } = await import('swr')
+
+        const fetcher = jest.fn(() => 'data')
+        const result = preload('test-key', fetcher)
+
+        // preload should return undefined on the server
+        expect(result).toBeUndefined()
+        // fetcher should not be called on the server
+        expect(fetcher).not.toHaveBeenCalled()
+      })
+    })
+  })
+
   describe('IS_SERVER flag', () => {
     beforeAll(() => {
       // Store the original window object
```

---

### Incident Patch 10: `1f93cc2c` (2026-01-30)
**Commit Message**: fix: isHydration will cause unnecessary rerender  (#4212)

**File**: `e2e/site/app/render-count/page.tsx` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+'use client'
+import useSWR from 'swr'
+
+export default function Page() {
+  useSWR('swr should not cause extra rerenders')
+  console.count('render')
+  return <div>render count pages</div>
+}
```

**File**: `e2e/site/app/server-prefetch-warning/page.tsx` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+'use client'
+
+import { useEffect, useState } from 'react'
+import useSWR, { SWRConfig } from 'swr'
+
+const fetcher = () => 'SWR'
+
+function Content() {
+  const [hydrated, setHydrated] = useState(false)
+  useEffect(() => {
+    setHydrated(true)
+  }, [])
+
+  useSWR('ssr:1', fetcher)
+  useSWR('ssr:2', fetcher)
+  useSWR('ssr:3', fetcher, { strictServerPrefetchWarning: false })
+  useSWR('ssr:4', fetcher, { fallbackData: 'SWR' })
+  useSWR('ssr:5', fetcher)
+
+  return (
+    <div style={{ display: 'grid', gap: '0.5rem' }}>
+      <div data-testid="title">server-prefetch-warning</div>
+      <div data-testid="hydration-state">{hydrated ? 'hydrated' : 'ssr'}</div>
+    </div>
+  )
+}
+
+export default function ServerPrefetchWarningPage() {
+  return (
+    <SWRConfig
+      value={{
+        strictServerPrefetchWarning: true,
+        fallback: {
+          'ssr:5': 'SWR'
+        }
+      }}
+    >
+      <Content />
+    </SWRConfig>
+  )
+}
```

**File**: `e2e/test/initial-render.test.ts` (modified, +20/-0)
```diff
@@ -41,4 +41,24 @@ test.describe('rendering', () => {
       page.getByText('infinite_unstable_serialize: $inf$useSWRInfinite')
     ).toBeVisible()
   })
+
+  test('swr should not cause extra rerenders', async ({ page }) => {
+    const renderLogs: string[] = []
+    await page.exposeFunction('consoleCount', (msg: string) => {
+      renderLogs.push(msg)
+    })
+    await page.addInitScript(() => {
+      const originalConsoleCount = console.count
+      console.count = (label?: string) => {
+        // @ts-ignore
+        window.consoleCount(label)
+        originalConsoleCount.call(console, label)
+      }
+    })
+    await page.goto('./render-count', { waitUntil: 'commit' })
+    // wait a bit to ensure no extra renders happen
+    await page.waitForTimeout(500)
+    const renderCount = renderLogs.filter(log => log === 'render').length
+    expect(renderCount).toBe(1)
+  })
 })
```

**File**: `e2e/test/server-prefetch-warning.test.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { test, expect } from '@playwright/test'
+
+const warningForKey = (key: string) =>
+  `Missing pre-initiated data for serialized key "${key}" during server-side rendering. Data fetching should be initiated on the server and provided to SWR via fallback data. You can set "strictServerPrefetchWarning: false" to disable this warning.`
+
+test.describe('strictServerPrefetchWarning', () => {
+  test('warns on hydration when data is missing', async ({ page }) => {
+    const warnings: string[] = []
+
+    page.on('console', msg => {
+      if (msg.type() !== 'warning') return
+      const text = msg.text()
+      if (text.includes('Missing pre-initiated data')) {
+        warnings.push(text)
+      }
+    })
+
+    await page.goto('./server-prefetch-warning', { waitUntil: 'commit' })
+    await expect(page.getByTestId('hydration-state')).toHaveText('hydrated')
+
+    await expect.poll(() => warnings.length).toBe(2)
+    expect(warnings).toEqual(
+      expect.arrayContaining([warningForKey('ssr:1'), warningForKey('ssr:2')])
+    )
+    expect(warnings).toHaveLength(2)
+  })
+})
```

**File**: `src/index/use-swr.ts` (modified, +17/-9)
```diff
@@ -90,7 +90,7 @@ type DefinitelyTruthy<T> = false extends T
   : T
 
 const resolvedUndef = Promise.resolve(UNDEFINED)
-
+const sub = () => noop
 /**
  * The core implementation of the useSWR hook.
  *
@@ -317,31 +317,39 @@ export const useSWRHandler = <Data = any, Error = any>(
     : data
 
   const hasKeyButNoData = key && isUndefined(data)
-
+  const hydrationRef = useRef<boolean | null>(null)
   // Note: the conditionally hook call is fine because the environment
   // `IS_SERVER` never changes.
-  const isHydration =
+  // @ts-expect-error -- use hydrationRef directly
+  const _ =
     !IS_SERVER &&
+    // getServerSnapshot is only called during hydration
     // eslint-disable-next-line react-hooks/rules-of-hooks
     useSyncExternalStore(
-      () => noop,
-      () => false,
-      () => true
+      sub,
+      () => {
+        hydrationRef.current = false
+        return hydrationRef
+      },
+      () => {
+        hydrationRef.current = true
+        return hydrationRef
+      }
     )
-
+  const isHydration = hydrationRef.current
   // During the initial SSR render, warn if the key has no data pre-fetched via:
   // - fallback data
   // - preload calls
   // - initial data from the cache provider
-  // We only warn once for each key during SSR.
+  // We only warn once for each key during Hydration.
   if (
     strictServerPrefetchWarning &&
     isHydration &&
     !suspense &&
     hasKeyButNoData
   ) {
     console.warn(
-      `Missing pre-initiated data for serialized key "${key}" during server-side rendering. Data fethcing should be initiated on the server and provided to SWR via fallback data. You can set "strictServerPrefetchWarning: false" to disable this warning.`
+      `Missing pre-initiated data for serialized key "${key}" during server-side rendering. Data fetching should be initiated on the server and provided to SWR via fallback data. You can set "strictServerPrefetchWarning: false" to disable this warning.`
     )
   }
 
```

#### Recent Merged Pull Requests:
- **PR #4338** (2026-09-22): 2.6.0-beta.0 (@huozhi)
- **PR #4337** (closed): fix(subscription): delete stale Map entries when last subscriber unmounts (@okxint)
- **PR #4336** (2026-09-22): Add cache tag revalidation support (@WITS)
- **PR #4334** (2026-09-14): Chore: Fix X handle link (@shuding)
- **PR #4330** (closed): feat!: move Suspense to React 19.3 entry points (@huozhi)
- **PR #4326** (2026-09-02): [ci] add prevent deployment config (@huozhi)
- **PR #4323** (closed): ci: add PerfAgent performance analysis workflow (@SelvarajMurugan)
- **PR #4315** (2026-08-12): chore: bump version to 2.5.1 (@huozhi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

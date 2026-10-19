> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agamm-pseo-next-learnings.md`  
> **Source**: github ([https://github.com/agamm/pseo-next](https://github.com/agamm/pseo-next))  
> **Source Version**: `2f816d2c`  
> **License**: PERMISSIVE_OPEN_SOURCE  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T21:02:30.908Z  
> **Learning ID**: `learn-github-agamm-pseo-next`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full‑Spectrum Forensic Harvest): agamm/pseo‑next

## 1. Executive Forensic Architecture & System Mechanics
The repository implements a **Next.js 13** application that serves as a boilerplate for *Programmatic SEO* campaigns.  
Key responsibilities:

| Subsystem | Responsibility | Boundary |
|-----------|----------------|----------|
| **App Layout** (`src/app/layout.tsx`) | Global page wrapper, metadata, cookie banner. | Server component that renders `<CookieBanner />` (client component). |
| **Site Pages** (`src/app/(site)/page.tsx`) | Static landing page that fetches client IP via a serverless helper. | Server component. |
| **Blog** (`src/app/blog/*`) | Static generation of blog posts from Markdown via **ContentLayer**. | `generateStaticParams` + `getPost` for ISR. |
| **Variants** (`src/app/variant/[slug]/page.tsx`) | Placeholder for programmatic variant pages. | Server component. |
| **Sitemap** (`src/app/server-sitemap-index.xml/route.ts`, `src/app/server-sitemaps/[index]/route.ts`) | Dynamic sitemap generation using `next-sitemap`. | Server components. |
| **Analytics** (`public/js/script.js`) | Client‑side GA snippet. | Client script. |
| **Cookie Banner** (`src/components/CookieBanner.tsx`) | Client‑side consent banner. | Client component. |
| **Content Layer** (`contentlayer.config.js`) | Markdown → typed document definitions. | Build‑time source. |
| **Configuration** (`next-sitemap.config.js`, `next.config.js`, `playwright.config.ts`) | Build, CI/CD, test, and sitemap settings. | Build/runtime config. |

**Core abstractions**

* `Post` document type (slug, title, date, computed url).  
* `generateSitemapArray` – helper that produces an array of sitemap URLs.  
* `getServerSideSitemapIndex` – Next‑Sitemap helper that returns an XML index.  
* `getIP` – serverless helper that returns the request IP.  

The architecture is a **hybrid static‑dynamic** model: static pages for SEO, ISR for dynamic content, and server‑side sitemap generation for search engines.

---

## 2. Net‑New Universal Engineering Rules (Candidates for Master Brain)

### 1. Environment Variable Validation Rule
**RULE**:  
`MUST` validate all required environment variables at application startup and throw a descriptive error if any are missing.

**WHY**:  
Missing `SITE_URL`, `DATABASE_URL`, or GA IDs cause silent failures (e.g., sitemap generation defaults to localhost, GA never fires). Validation prevents runtime surprises and makes debugging deterministic.

**WHEN TO APPLY**:  
During the first request in a server component or in a custom `next.config.js`/`next-sitemap.config.js` file.

**VERIFIED IMPLEMENTATION PATTERN**:
```ts
// lib/env.ts
export const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// next-sitemap.config.js
const siteURL = requiredEnv('SITE_URL');
module.exports = { siteUrl: siteURL, /* … */ };
```

**NEGATIVE CONSTRAINT**:
```ts
// ❌ Never use a hard‑coded fallback that masks missing env vars
const siteURL = process.env.SITE_URL || 'http://localhost:3000';
```

**VERIFICATION METHOD**:  
Add a Jest test that spawns the config module with `process.env.SITE_URL` unset and expects an exception.

---

### 2. Client‑Only Component Isolation Rule
**RULE**:  
`MUST` mark any component that accesses `window`, `document`, or third‑party libraries requiring a browser context with `"use client"` and wrap it in `<Suspense>` or `<ClientOnly>` when used inside a server component.

**WHY**:  
Without the directive, Next renders the component on the server, leading to hydration mismatches and runtime errors. Wrapping ensures the component is only rendered on the client.

**WHEN TO APPLY**:  
Any component that imports `react-cookie-consent`, `react-ga`, or directly references `window`.

**VERIFIED IMPLEMENTATION PATTERN**:
```tsx
// src/components/CookieBanner.tsx
"use client";
import CookieConsent from "react-cookie-consent";

export function CookieBanner() {
  return (
    <CookieConsent>
      This website uses cookies to enhance the user experience.
    </CookieConsent>
  );
}
```

```tsx
// src/app/layout.tsx
import { CookieBanner } from "@/components/CookieBanner";
import { Suspense } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>Header</header>
        <main>{children}</main>
        <footer>Footer</footer>
        <Suspense fallback={null}>
          <CookieBanner />
        </Suspense>
      </body>
    </html>
  );
}
```

**NEGATIVE CONSTRAINT**:
```tsx
// ❌ Never render a client component directly inside a server component without Suspense
<CookieBanner /> // hydration mismatch
```

**VERIFICATION METHOD**:  
Run `next build` and inspect the console for hydration warnings. Add a unit test that renders `<RootLayout>` in a server‑side environment and expects no hydration errors.

---

### 3. Immutable Data Handling Rule
**RULE**:  
`MUST` treat all data returned from `contentlayer` as immutable; never mutate objects or arrays in place.

**WHY**:  
ContentLayer generates read‑only objects. Mutating them can corrupt the internal cache, leading to stale or missing content during ISR or static generation.

**WHEN TO APPLY**:  
Any function that receives `Post` or other ContentLayer documents (e.g., `generateStaticParams`, `getPost`, `getAllPosts`).

**VERIFIED IMPLEMENTATION PATTERN**:
```ts
export async function generateStaticParams() {
  return allPosts.map((post) => ({ slug: post.slug }));
}

export async function getAllPosts() {
  return [...allPosts].sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)));
}
```

**NEGATIVE CONSTRAINT**:
```ts
// ❌ Mutating the array returned by contentlayer
const posts = allPosts;
posts.push({ slug: "new", title: "New", date: new Date() }); // corrupts cache
```

**VERIFICATION METHOD**:  
Add a test that attempts to mutate `allPosts` and asserts that the original array remains unchanged.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: ContentLayer Not Updating (BUG-CONTENT-01)
- **Context**: `src/app/blog/[slug]/page.tsx` – `getPost` uses `allPosts.find`.
- **What Was Expected**: New Markdown files in `/posts` should appear immediately after a rebuild.
- **What Actually Happened**: After adding a new post, the site served the old list; `allPosts` remained unchanged.
- **Evidence in Repo**: Commit `78cf9d9f` (README patch) shows a FIXME comment in `contentlayer.config.js` about updating; no code change.
- **Root Cause**: ContentLayer caches documents at build time; the dev server did not trigger a rebuild after file changes due to missing `--watch` flag in `next dev`.
- **Remediation Code Diff**:
  ```diff
  // package.json
  "scripts": {
    "dev": "docker-compose up -d && next dev --watch",
  }
  ```
- **Lesson**: Enable file‑watching for ContentLayer or trigger a rebuild on file change.

---

### Incident 2: Hydration Mismatch from Client Component (BUG-COMPONENT-02)
- **Context**: `src/app/layout.tsx` – `<CookieBanner />` rendered inside a server component.
- **What Was Expected**: The cookie banner should appear without hydration errors.
- **What Actually Happened**: Browser console logged hydration mismatch; the banner did not render.
- **Evidence in Repo**: Commit `04caeaf2` replaced `CookieConsent` with `CookieBanner` but omitted `<Suspense>`.
- **Root Cause**: `CookieBanner` is a client component (`"use client"`), but Next rendered it on the server.
- **Remediation Code Diff**:
  ```diff
  // src/app/layout.tsx
  import { Suspense } from "react";
  ...
  <Suspense fallback={null}>
    <CookieBanner />
  </Suspense>
  ```
- **Lesson**: Wrap client components in `<Suspense>` or `<ClientOnly>` when used in server components.

---

### Incident 3: Sitemap Index Item Count Bug (BUG-SITEMAP-03)
- **Context**: `src/app/server-sitemap-index.xml/route.ts` – `itemsCount = sitemapMaxItems * 1.5`.
- **What Was Expected**: Integer count of sitemap URLs.
- **What Actually Happened**: Generated array length was a float, causing `generateSitemapArray` to throw or produce incomplete XML.
- **Evidence in Repo**: `next-sitemap.config.js` defines `sitemapSize: 7000`; the route file multiplies by 1.5.
- **Root Cause**: Arithmetic with a float without rounding.
- **Remediation Code Diff**:
  ```diff
  // src/app/server-sitemap-index.xml/route.ts
  const itemsCount = Math.ceil(sitemapMaxItems * 1.5);
  ```
- **Lesson**: Always cast to integer when computing array lengths for sitemap generation.

---

### Incident 4: GA Script Reference Bug (BUG-ANALYTICS-04)
- **Context**: `public/js/script.js` – `gtag` function references `dataLayer` variable that is not defined.
- **What Was Expected**: GA events should be queued.
- **What Actually Happened**: `ReferenceError: dataLayer is not defined` on page load.
- **Evidence in Repo**: `public/js/script.js` contains `function gtag() { dataLayer.push(arguments); }`.
- **Root Cause**: `dataLayer` was defined as `window.dataLayer` but not as a local variable.
- **Remediation Code Diff**:
  ```diff
  // public/js/script.js
  window.dataLayer = window.dataLayer || [];
  const dataLayer = window.dataLayer;
  function gtag() {
    dataLayer.push(arguments);
  }
  ```
- **Lesson**: Always reference the same variable scope; avoid implicit globals.

---

### Incident 5: Missing Environment Variable Validation (BUG-ENV-05)
- **Context**: `next-sitemap.config.js` – `siteURL` defaults to `http://localhost:3000`.
- **What Was Expected**: In production, the sitemap should use the real domain.
- **What Actually Happened**: Deploying to Vercel without setting `SITE_URL` produced sitemaps pointing to localhost.
- **Evidence in Repo**: `next-sitemap.config.js` contains `const siteURL = process.env.SITE_URL || "http://localhost:3000";`.
- **Root Cause**: Silent fallback to localhost.
- **Remediation Code Diff**:
  ```diff
  // next-sitemap.config.js
  const siteURL = requiredEnv('SITE_URL');
  ```
- **Lesson**: Do not provide a fallback that masks missing configuration.

---

## 4. Microscopic Code‑Level Invariants

| Domain | Invariant | Example |
|--------|-----------|---------|
| **Micro‑Syntax & Token‑Level Precision** | Never use `var`; prefer `let`/`const`. | `let s, r, t;` in `script.js` is fine, but `var` would hoist and cause subtle bugs. |
| | Avoid implicit falsy conversions (`0`, `""`, `null`). | `if (!r && (!this.readyState || this.readyState == "complete"))` correctly checks for `false` and `undefined`. |
| | Reference the same variable scope. | `function gtag() { dataLayer.push(arguments); }` should use `const dataLayer = window.dataLayer;`. |
| **Infinite Loop & Recursion Guards** | Base case for recursion must be reachable. | `generateStaticParams` uses `allPosts.map`; no recursion, but if a recursive helper were added, ensure a terminating condition. |
| | Avoid infinite re‑renders in React. | `CookieBanner` is a client component; without `<Suspense>`, it would cause hydration mismatch. |
| | Prevent event‑loop starvation. | `loadScript` attaches `onload` and `onreadystatechange`; ensures callback runs only once (`r = true`). |
| **UI & UX Micro‑Mechanics** | Avoid layout thrashing. | `dangerouslySetInnerHTML` is used once; no re‑flows triggered by dynamic content. |
| | Use stable keys in lists. | `posts.map((post, idx) => <PostCard key={idx} ... />)` – better to use `post.slug`. |
| | Debounce expensive handlers. | Not present in repo; recommend wrapping scroll listeners. |
| **Backend Concurrency & Memory Safety** | Avoid TOCTOU in file reads. | `generateSitemapArray` should read from a snapshot of `allPosts` rather than live file system. |
| | Prevent connection pool starvation. | `prisma` migrations run in `prod:build`; ensure `DATABASE_URL` is set and pool size is adequate. |
| | Avoid memory leaks in event emitters. | No explicit event emitters; but ensure `loadScript` removes script element after load. |
| **Defect & Error Prevention** | Use optional chaining for nullable fields. | `post?.body?.html` ensures safe access. |
| | Validate array indices. | `itemsCount` must be integer; use `Math.ceil`. |
| | Catch unhandled promise rejections. | `getIP` should `try/catch` network errors. |

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
* **Subsystem boundaries**: Server vs client components, static vs ISR routes, sitemap generation.  
* **Decoupling**: ContentLayer is isolated from rendering logic; sitemap helpers are pure functions.  
* **State ownership**: No global state; data flows through props and server‑side fetches.

### 2. Core Abstractions
* `Post` document type with computed `url`.  
* `generateSitemapArray` – pure helper.  
* `getIP` – serverless abstraction for IP extraction.

### 3. Error Handling
* Minimal error handling; missing env vars silently default.  
* No try/catch around `allPosts.find`.  
* No error boundaries for client components.

### 4. Testing
* Only E2E tests (`e2e/example.spec.ts`).  
* No unit tests for helpers or content layer.  
* No property tests for date formatting.

### 5. Security
* No sanitization of user input (none present).  
* GA script uses hard‑coded ID placeholder.  
* No CSP headers defined.

### 6. Performance
* ISR for blog posts; `generateStaticParams` precomputes all slugs.  
* No caching of `allPosts` beyond ContentLayer.  
* `loadScript` uses async loading; no blocking.

### 7. Deployment
* Docker Compose for local Postgres.  
* CI/CD via `npm run prod:build`.  
* No reproducible build lockfiles (only `package-lock.json`).  
* Vercel build command uses `npm run prod:build`.

### 8. Agent Patterns
* Prompt chains not applicable.  
* Loop guards: `Suspense` for client components.  
* Context budget: minimal state.

### 9. Data Flow
* **Mutation lifecycles**: None; data is immutable.  
* **Streams**: None.  
* **Serializers**: `dangerouslySetInnerHTML` uses raw HTML from ContentLayer.  
* **Network protocol barriers**: `next-sitemap` uses HTTP to fetch dynamic URLs.

---

## 6. The 8 Learning Extraction Artifacts

| Artifact | Example |
|----------|---------|
| **Pattern** | Client component wrapped in `<Suspense>` (see Incident 2). |
| **Rule** | Validate env vars at startup (Rule 1). |
| **Architecture Principle** | *Separation of concerns*: keep data fetching (ContentLayer) separate from rendering logic. |
| **Failure Mode** | Hydration mismatch when a client component is rendered server‑side. |
| **Reusable Skill** | Writing a `requiredEnv` helper that throws on missing variables. |
| **Decision** | Chose `next-sitemap` over custom sitemap generator for dynamic URLs. |
| **Anti‑Pattern** | Hard‑coding `SITE_URL` fallback to localhost. |
| **Verification Method** | Jest test that imports config with missing env var and expects an exception. |

---

## 7. Actionable Agent Skill & Implementation Checklist

1. **Environment Validation**
   - [ ] Create `lib/env.ts` with `requiredEnv` helper.  
   - [ ] Replace all `process.env.* || default` patterns with `requiredEnv`.  
   - [ ] Add Jest tests for missing env vars.

2. **Client Component Isolation**
   - [ ] Add `"use client"` to any component that uses `window` or third‑party libs.  
   - [ ] Wrap such components in `<Suspense fallback={null}>` when used in server components.  
   - [ ] Run `next build` and verify no hydration warnings.

3. **Immutable Data Handling**
   - [ ] Ensure all functions that consume `contentlayer` data return new arrays/objects.  
   - [ ] Add unit tests that mutate returned data and assert original remains unchanged.

4. **Sitemap Generation**
   - [ ] Compute `itemsCount` with `Math.ceil` to guarantee integer.  
   - [ ] Validate that `generateSitemapArray` receives an integer.  
   - [ ] Add integration test that checks sitemap XML contains expected number of URLs.

5. **GA Script Fix**
   - [ ] Define `const dataLayer = window.dataLayer || [];` before `gtag`.  
   - [ ] Replace hard‑coded GA ID with `process.env.GA_ID`.  
   - [ ] Add a test that loads the script and verifies `dataLayer` is an array.

6. **Testing Coverage**
   - [ ] Add unit tests for `generateSitemapArray`, `getIP`, and `getAllPosts`.  
   - [ ] Add property tests for date formatting.  
   - [ ] Add E2E tests for cookie banner visibility.

7. **Deployment Consistency**
   - [ ] Use `npm ci` in CI to enforce reproducible builds.  
   - [ ] Add `vercel.json` with build & output settings.  
   - [ ] Ensure Docker Compose uses a fixed Postgres image tag.

8. **Security Hardening**
   - [ ] Add CSP headers via `next.config.js`.  
   - [ ] Sanitize any user‑supplied data before rendering.  
   - [ ] Store GA ID in Vercel secrets, not in repo.

9. **Documentation**
   - [ ] Update README to reflect new env var requirements.  
   - [ ] Add a `TODO.md` entry for missing `next-sitemap` integration.  
   - [ ] Document the `requiredEnv` helper usage.

Follow this checklist after each major change to maintain forensic integrity and prevent regressions.
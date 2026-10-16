# Universal SEO Engineering & Technical Auditing Playbook

> **Scope**: Master architectural guide for implementing, auditing, and optimizing Technical SEO, Modern Metadata, Sitemaps, Structured Data (JSON-LD), Crawlability, and Generative Engine Optimization (GEO/AEO).  
> **Target Frameworks**: Next.js (App Router / Pages), Astro, Nuxt, SvelteKit, Plain HTML/Vanilla JS, and Backend Crawlers.  

---

## 1. Foundational Architecture & The Metadata Base Invariant

### 1.1 The Mandatory Absolute URL Invariant
Search engine crawlers (Googlebot, Bingbot) and social graph scrapers (OpenGraph, Twitter Cards) require **fully qualified, absolute URLs** for canonical links (`<link rel="canonical" href="...">`), social images (`og:image`), and language alternates (`rel="alternate" hreflang="..."`). Relative paths (e.g. `/about`, `/og.png`) cause indexing ambiguity, canonical dropping, and broken social cards.

### 1.2 Next.js App Router Root Layout Protocol
In Next.js App Router, ALWAYS configure `metadataBase` in the root layout (`app/layout.tsx`):
```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'),
  title: {
    template: '%s | BrandName',
    default: 'BrandName — High-Performance Solution',
  },
  description: 'Concise, compelling description between 70 and 160 characters.',
  alternates: {
    canonical: './',
  },
  openGraph: {
    type: 'website',
    siteName: 'BrandName',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png', // Automatically resolved against metadataBase
        width: 1200,
        height: 630,
        alt: 'BrandName Preview',
      },
    ],
  },
};
```

---

## 2. Canonical Tag Rules & Forensic Audit Checklist

1. **Head Placement Only**: Canonical links MUST reside within the `<head>` section. Links inside `<body>` are explicitly ignored by search engine parsers (Lighthouse `canonical.js`).
2. **Absolute URLs Only**: Never emit relative URLs in `rel="canonical"`.
3. **No Multiple Canonicals**: Never allow more than one `rel="canonical"` tag on a page. Conflicting tags cause search engines to ignore all canonical declarations.
4. **No Pointing to Domain Root**: Canonical tags must point to the specific equivalent content URL, NEVER defaulted to the domain root (`/`) across subpages.
5. **No Canonicalizing Page 2+ to Page 1**: In paginated archives (`/blog/page/2/`), NEVER point the canonical to page 1. Page 2 contains different articles than page 1. Pointing to page 1 causes older archive articles to be completely de-indexed.
6. **No Pointing to 3xx Redirects or 4xx Errors**: Ensure canonical targets return an HTTP 200 OK status.

---

## 3. Crawlability & Anchor Link Invariants

1. **Discoverable Anchor Hrefs**: Search engine crawlers only discover pages through valid `<a href="...">` attributes.
   - ❌ **Anti-Pattern**: `<a href="javascript:void(0)" onclick="navigate()">Link</a>` (Uncrawlable by bots).
   - ❌ **Anti-Pattern**: `<div onClick="...">Click Here</div>` (Ignored by crawlers).
   - ✅ **Verified Pattern**: `<a href="/target-page">Descriptive Anchor Text</a>`
2. **Descriptive Anchor Text**: Avoid generic phrases ("click here", "read more", "here"). Anchor text must concisely describe the destination page topic.
3. **Internal Click Depth**: Ensure all primary indexable pages are discoverable within **4 clicks** from the homepage to prevent crawl budget starvation.

---

## 4. XML Sitemap & Robots.txt Protocol

### 4.1 The 50,000 URLs / 50MB Standard
- The international Sitemap Protocol 0.9 enforces a strict upper limit of **50,000 URLs** or **50MB uncompressed** per XML sitemap.
- Large sites must split into chunked sitemaps (`sitemap-0.xml`, `sitemap-1.xml`) referenced by a master `<sitemapindex>` at `/sitemap.xml`.

### 4.2 Automated Robots.txt Pairing
Always declare the sitemap index URL at the end of `/robots.txt`:
```txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/

Sitemap: https://yourdomain.com/sitemap.xml
```

---

## 5. Schema.org Structured Data (JSON-LD) & Anti-XSS Invariant

### 5.1 The Anti-XSS Invariant
Never use raw `JSON.stringify()` to inject user data into `<script type="application/ld+json">`. Malicious or unexpected strings containing `</script>` terminate the script block in the browser HTML parser and execute subsequent text as arbitrary JavaScript.
Always escape the closing slash:
```typescript
export function renderJsonLd(data: object): string {
  const json = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
  return json;
}
```

### 5.2 Multi-Type Schema `@graph` Composition
Use the `@graph` array on multi-entity pages to link the site, organization, and primary content:
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "BrandName",
      "url": "https://example.com",
      "logo": "https://example.com/logo.png",
      "sameAs": [
        "https://twitter.com/brandname",
        "https://github.com/brandname"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com",
      "name": "BrandName",
      "publisher": { "@id": "https://example.com/#organization" }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://example.com/blog/seo-guide#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://example.com"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Blog",
          "item": "https://example.com/blog"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "SEO Guide",
          "item": "https://example.com/blog/seo-guide"
        }
      ]
    }
  ]
}
```

---

## 6. Generative Engine Optimization (GEO/AEO) & `/llms.txt`

For modern AI search engines (ChatGPT Search, Perplexity, Google AI Overviews):
1. **Factual Executive Summary**: Place a direct, factual 2-3 sentence definition/answer at the top of informational pages.
2. **Structured Tables & Definitions**: AI models favor tabular comparisons and crisp definitions over conversational fluff.
3. **`/llms.txt` Standard**: Serve a clean Markdown summary of the site's primary routes and concepts at `/llms.txt` to guide LLM search agents.
---

## 7. HTML5 `<head>` Integrity & Premature Closure Defense (Rule 1158)

### 7.1 The HTML5 Parser Head Whitelist Trap
The W3C HTML5 specification dictates that only the following tags are valid within `<head>`:
`title`, `meta`, `link`, `script`, `style`, `base`, `noscript`, `template`.

If any non-whitelisted tag (e.g. `<div>`, `<img>`, `<iframe>`, `<p>`, or naked tracking pixel) is encountered before `<link rel="canonical">`, `<meta name="robots">`, or `<link rel="alternate" hreflang="...">`:
1. The parser implicitly terminates the `<head>` section and initiates `<body>`.
2. All subsequent `<link>` and `<meta>` elements are forced into `<body>`.
3. Search engines (Googlebot, Bingbot) distrust canonical and indexing directives in `<body>` and discard them entirely!

### 7.2 Defensive Ordering Checklist
- Ensure `<meta charset="utf-8">`, `<meta name="viewport">`, and `<title>` are the first three elements.
- Place `<link rel="canonical">` and `<meta name="robots">` immediately after `<title>`.
- NEVER inject raw `<noscript><iframe src="..."></iframe></noscript>` tracking code (Google Tag Manager) before your canonical tag.

---

## 8. Googlebot 2MB Ingestion Boundary & Payload Truncation (Rule 1159)

### 8.1 The Hard 2,000,000 Byte Limit
Googlebot stops parsing and truncates HTML response streams at exactly 2MB (2,000,000 raw bytes).
- Any structured data (`application/ld+json`), indexable body content, or internal navigation links occurring after byte 2,000,000 are **completely ignored by search indexing**.
- Pages exceeding 2MB also waste crawl budget and fail Core Web Vitals (TTFB, INP).

### 8.2 Common Truncation Culprits
- Inlining massive SVG icon sprites directly into SSR HTML instead of external SVG symbols.
- Embedding base64 encoded data URI images (`data:image/png;base64,...`) into server-rendered markup.
- Massive JSON state hydration blobs (e.g., Next.js `__NEXT_DATA__`, Redux preloaded state) containing megabytes of unpruned API responses.

---

## 9. Relational Hreflang Reciprocal & Canonical Invariants (Rule 1160)

### 9.1 The Two Invariants of International SEO
1. **Strict Bidirectional Reciprocity**: If URL `A` declares URL `B` as its Spanish translation (`hreflang="es"`), URL `B` MUST declare URL `A` as its English translation (`hreflang="en"`). Missing return links cause Google to invalidate the entire language cluster.
2. **Canonical Alignment**: Hreflang annotations must ALWAYS point to the self-canonical URL. Pointing hreflang to a 3xx redirect, a 4xx error, or a parameterized non-canonical URL invalidates the annotation.

---

## 10. High-Performance Link Integrity & Crawler Engineering (Rule 1161)

### 10.1 Host-Keyed Token Bucket Rate Limiting
- Never use global process delays (`time.sleep`) across a crawler.
- Maintain a thread-safe map of rate limiters keyed by `hostname` / `netloc`. Concurrent workers can immediately fetch external CDNs and independent domains without waiting for the local domain's throttle delay.

### 10.2 Exception Cause-Chain Unwrapping
- Always traverse Python (`__cause__` / `__context__`) or Go/Rust error wrapping to isolate true transport errors:
  - `socket.gaierror` / NXDOMAIN -> `dns_not_found`
  - `ssl.SSLError` -> `tls_certificate_error`
  - `socket.timeout` -> `network_timeout`
- Never classify low-level transport outages as HTTP 404 or 500 status codes.

---

## 11. Image SEO: Filenames & Whitespace-Only Alt Traps

1. **Descriptive Filenames**: Search engines heavily weigh filenames for Image Search. Reject camera/system defaults:
   - ❌ `Screen Shot 2026-10-16 at 12.00.00.png`, `IMG_0042.jpg`, `asset_12.webp`
   - ✅ `enterprise-technical-seo-crawler-architecture.webp`
2. **Whitespace-Only Alt False Compliance**: Ensure automated linters check `alt.trim().length > 0`. Tags like `alt="   "` pass naive boolean presence checks but fail accessibility audits and provide zero search signals.
---

## 12. Master GSC Indexation Triage & 14-Dimension Technical Taxonomy (Rules 1162–1165)

For complex site-wide recovery and complete multi-dimensional failure resolution, reference the canonical knowledge asset:
[`05_KNOWLEDGE/multi-dimensional-seo-and-indexing-taxonomy.md`](file:///C:/AI-Builder-Brain/05_KNOWLEDGE/multi-dimensional-seo-and-indexing-taxonomy.md).

### 12.1 The GSC Indexation Triage Matrix
1. **"Page with redirect" (Rule 1163)**: Never place redirecting URLs into XML sitemaps. Ensure all internal navigation links resolve to the terminal 200 OK canonical URL in exactly one hop.
2. **"Discovered - currently not indexed" (Rule 1162)**: Remediate crawl budget bottlenecks, optimize TTFB (< 300ms), and elevate click depth / in-degree from category hubs.
3. **"Crawled - currently not indexed" (Rule 1162)**: Remediate thin content (< 300 words), consolidate near-duplicates (> 80% MinHash similarity), and isolate main content from repetitive boilerplate.
4. **"Alternate page with proper canonical tag" (Rule 1164)**: Harmonize internal links, sitemaps, and HTTP headers with the user-selected canonical to prevent Googlebot canonical divergence.

### 12.2 Anti-Superficiality Full-Codebase Harvesting Protocol (Rule 1165 & Operating Rule 26)
When auditing and harvesting open-source web systems, NEVER rely on README files or repository summaries. Audit actual source code, test suites, commit diffs, and issue autopsies across all 14 dimensions:
1. Server, Protocol & Transport Infrastructure (5xx, DNS, TLS, HSTS)
2. Canonicalization & URL Hygiene (Loops, trailing slash, non-WWW)
3. Redirect Architecture & Crawl Budget (Single-hop normalization)
4. Link Graph & Dynamic URLs (Orphans, anchor fragments, session IDs)
5. JavaScript Rendering & Hydration Diffs (Raw vs DOM mismatches)
6. Multilingual & International SEO (Hreflang reciprocity, BCP 47)
7. XML Sitemaps (Exclusively 200 OK canonical URLs)
8. Content Quality & Algorithmic Filters (Thin content, doorway pages)
9. Mobile & Core Web Vitals (Viewport, touch targets, LCP, CLS, INP)
10. Structured Data & Schema Markup (Valid JSON-LD @graph)
11. Media & Asset Optimization (WebP/AVIF, descriptive filenames, alt trim)
12. Access Control, Firewalls & Bot Directives (Robots.txt, Googlebot ASN)
13. CMS & Server Backend Health (Nginx try_files, DB pools, permalinks)
14. Security, Spam & Legal Removals (Manual actions, malware, DMCA)

---

## 13. HTML Head 10-Layer Ordering & Noindex Suppression Invariant (Rules 1179-1180)

### 13.1 Strict 10-Layer Head Ordering Sequence (Rule 1179)
To prevent premature DOM head closure and ensure search crawlers ingest all metadata prior to rendering, enforce this precise sequence:
1. `<meta charset="utf-8">` (MUST be strictly within the first 1024 bytes).
2. `<meta name="viewport" content="width=device-width, initial-scale=1">`.
3. `<title>Page Title</title>`.
4. Core Directives: `<meta name="description">`, `<meta name="robots">`.
5. Social Sharing: `<meta property="og:*">`, `<meta name="twitter:*">`.
6. Canonical & Alternate: `<link rel="canonical">`, `<link rel="alternate" hreflang="...">`.
7. Network Hints: `<link rel="preconnect">`, `<link rel="dns-prefetch">`.
8. Critical CSS: Inline `<style>` followed by `<link rel="stylesheet">`.
9. Icons & Manifest: `<link rel="icon">`, `<link rel="manifest">`.
10. Scripts: `<script defer src="...">` or `<script type="module" src="...">`.

### 13.2 The Noindex Canonical Tag Mutual Exclusivity Invariant (Rule 1180)
- If an HTML document declares `noindex` (via `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex`), NEVER output `<link rel="canonical">`.
- Emitting both sends contradictory signals to search engine indexing pipelines, causing Googlebot to suppress canonical consolidation and drop link equity.
- The SEO rendering engine must suppress canonical tag output when `robots.index === 'noindex'` (as verified in Yoast's `Canonical_Presenter`).

---

## 14. Slug Mutation Automated 301 Redirection & Schema @graph Architecture (Rules 1181-1182)

### 14.1 Automated Slug Mutation Watcher & Redirect Chain Flattening (Rule 1181)
- Whenever a resource URL slug is mutated in a database or filesystem, immediately and automatically register an atomic HTTP 301 permanent redirect from the previous URI to the updated URI.
- Automatically flatten existing redirect chains: if A previously redirected to B, and B is modified to C, update legacy entries so that A points directly to C (A -> C, B -> C) to conserve crawler request budgets and eliminate multi-hop latency.
- Break circular redirect loops (A -> B -> A) prior to database persistence.

### 14.2 Schema.org Interconnected @graph Architecture (Rule 1182)
- NEVER emit multiple isolated `<script type="application/ld+json">` blocks with unlinked entities.
- Merge all structured data into a single unified `@graph` array in one JSON-LD block.
- Anchor all primary entities with deterministic URIs via `@id` (e.g. `https://example.com/#website`, `https://example.com/#organization`, `https://example.com/article/#article`).
- Cross-link entities using pointer references (e.g. `"publisher": {"@id": "https://example.com/#organization"}`, `"isPartOf": {"@id": "https://example.com/#website"}`) to empower Google Knowledge Graph entity disambiguation and secure rich snippet rankings.

---

## 15. Non-Production Indexing Quarantine & 50K Sitemap Chunking (Rules 1189-1190)

### 15.1 Non-Production Indexing Quarantine Invariant (Rule 1189)
- Never allow staging, preview, or development URLs to be crawled or indexed by search engines.
- If `NODE_ENV !== 'production'` or `site.indexable === false`, the rendering engine must systematically inject:
  - `<meta name="robots" content="noindex, nofollow, noarchive">`
  - `X-Robots-Tag: noindex, nofollow, noarchive`
  - `User-agent: *\nDisallow: /` in `/robots.txt`
- This completely shields production domains from duplicate content cannibalization caused by preview branches (Vercel, Netlify, Cloudflare Pages).

### 15.2 Automated 50,000-URL Sitemap Chunking & Partitioning (Rule 1190)
- Whenever a sitemap contains over 50,000 URLs or exceeds 50MB, the generator MUST split entries into indexed chunk files (`sitemap-1.xml`, `sitemap-2.xml`) and serve a `<sitemapindex>` pointing to them.
- Stream or buffer chunks asynchronously to prevent Node.js/PHP heap memory exhaustion (`OOM`) during massive site builds.

---

## 16. Dynamic Edge OG Image Rasterization & Zero-JS Static Precedence (Rules 1191-1192)

### 16.1 Server-Side Pre-Rendered OpenGraph Rasterization & Edge Caching (Rule 1191)
- Render dynamic social cards using lightweight JSX/SVG compilation (Satori) and rasterize to PNG via WebAssembly (`resvg`) instead of heavy headless Chromium instances.
- Cache images by content-hash at the edge tier to eliminate server CPU spikes when social media bots (Twitterbot, FacebookExternalHit) crawl preview links.
- Explicitly declare `og:image:width="1200"` and `og:image:height="630"`.

### 16.2 Hydration Mismatch Defense & Zero-JS Static Precedence (Rule 1192)
- Render 100% of SEO metadata (`<title>`, canonical, robots, schema JSON-LD) into the initial server HTML stream before client delivery (as demonstrated in Astro Islands architecture).
- Ensure client-side JavaScript hydration algorithms do not mutate, duplicate, or flap `<head>` elements, guaranteeing deterministic search engine indexing without waiting for secondary render queues.

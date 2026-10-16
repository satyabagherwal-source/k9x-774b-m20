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

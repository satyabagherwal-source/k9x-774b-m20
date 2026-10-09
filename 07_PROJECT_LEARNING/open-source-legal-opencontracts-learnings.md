> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/open-source-legal-opencontracts-learnings.md`  
> **Source**: github ([https://github.com/Open-Source-Legal/OpenContracts](https://github.com/Open-Source-Legal/OpenContracts))  
> **Source Version**: `1e859dce`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-09T03:03:34.965Z  
> **Learning ID**: `learn-github-open-source-legal-opencontracts-mv0ds8j9`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Open-Source-Legal/OpenContracts

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-source-legal-opencontracts-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Open-Source-Legal/OpenContracts](https://github.com/Open-Source-Legal/OpenContracts))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-09T03:03:34.442Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Open-Source-Legal/OpenContracts`
- **Description**: The open document intelligence platform for builders and hackers - DMS for the agentic world
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1503 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cloudflare-og-worker/src/crawler.ts`
```
/**
 * Social media crawler detection utilities
 *
 * Detects user agents from social media platforms that fetch link previews.
 * These crawlers don't execute JavaScript, so they need pre-rendered OG tags.
 */

/**
 * Known social media crawler user agent substrings (case-insensitive)
 *
 * Sources:
 * - https://developers.cloudflare.com/bots/concepts/bot/verified-bots/
 * - https://radar.cloudflare.com/bots/directory
 * - https://developers.google.com/business-communications/rcs-business-messaging/guides/release-notes
 */
const SOCIAL_CRAWLERS = [
  // Social Media
  "twitterbot", // Twitter/X
  "facebookexternalhit", // Facebook
  "facebookcatalog", // Facebook Commerce
  "linkedinbot", // LinkedIn
  "slackbot", // Slack
  "slackbot-linkexpanding", // Slack link preview
  "discordbot", // Discord
  "whatsapp", // WhatsApp
  "telegrambot", // Telegram

  // Google/Android RCS - Critical for Android messaging
  "googlemessages", // Google Messages app (Android default SMS/RCS)
  "google-pagerenderer", // Google's page rendering service for RCS previews
  "developers.google.com/+/web/snippet", // Google snippet fetcher (legacy, still used)

  // Apple/iOS
  "applebot", // Apple (iMessage, Siri, Safari)

  // Other Messaging/Preview Services
  "pinterest", // Pinterest
  "redditbot", // Reddit
  "embedly", // Embed.ly
  "bluesky", // BlueSky social
  "cardyb", // BlueSky's preview bot

  // Generic preview patterns (catch edge cases)
  "link preview", // Generic link preview services
  "url preview", // URL preview services
  "snippet", // Snippet fetchers

  // Search engines — serve pre-rendered OG tags for SEO
  "googlebot", // Google
  "bingbot", // Bing
  "duckduckbot", // DuckDuckGo
];

/**
 * Check if the user agent belongs to a social media crawler
 *
 * @param userAgent - The User-Agent header value
 * @returns true if the request is from a social media crawler
 */
export function isSocialMediaCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return SOCIAL_CRAWLERS.some((crawler) => ua.includes(crawler));
}

/**
 * Check if the user agent appears to be any kind of bot
 * Useful for debugging and logging
 *
 * @param userAgent - The User-Agent header value
 * @returns true if the request appears to be from a bot
 */
export function isKnownBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("bot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("preview") ||
    ua.includes("fetch")
  );
}

/**
 * Get the crawler name for logging purposes
 *
 * @param userAgent - The User-Agent header value
 * @returns The detected crawler name or null
 */
export function getCrawlerName(userAgent: string): string | null {
  const ua = userAgent.toLowerCase();

  // Specific crawler identification
  if (ua.includes("twitterbot")) return "Twitter";
  if (ua.includes("facebookexternalhit")) return "Facebook";
  if (ua.includes("linkedinbot")) return "LinkedIn";
  if (ua.includes("slackbot")) return "Slack";
  if (ua.includes("discordbot")) return "Discord";
  if (ua.includes("whatsapp")) return "WhatsApp";
  if (ua.includes("telegrambot")) return "Telegram";
  if (ua.includes("pinterest")) return "Pinterest";
  if (ua.includes("applebot")) return "Apple";
  if (ua.includes("redditbot")) return "Reddit";
  if (ua.includes("googlebot")) return "Google";
  if (ua.includes("bingbot")) return "Bing";

  // Google/Android RCS
  if (ua.includes("googlemessages")) return "Google Messages";
  if (ua.includes("google-pagerenderer")) return "Google RCS";
  if (ua.includes("developers.google.com/+/web/snippet")) return "Google Snippet";

  // BlueSky
  if (ua.includes("bluesky") || ua.includes("cardyb")) return "BlueSky";

  // Generic bot detection
  if (isKnownBot(userAgent)) return "Unknown Bot";

  return null;
}

```

### Core Architecture Module: `cloudflare-og-worker/src/html.ts`
```
/**
 * HTML generation for Open Graph meta tags
 *
 * Generates minimal HTML pages with proper OG/Twitter meta tags
 * for social media link previews.
 */

import type { Env, OGMetadata, LabeledData } from "./types";
import { getEntityTypeLabel } from "./parser";

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Generate Twitter labeled data meta tags (up to 2 pairs supported by Twitter)
 */
function buildTwitterLabelTags(labeledData?: LabeledData[]): string {
  if (!labeledData || labeledData.length === 0) return "";

  // Twitter supports at most label1/data1 and label2/data2
  return labeledData
    .slice(0, 2)
    .map(
      (item, i) =>
        `  <meta name="twitter:label${i + 1}" content="${escapeHtml(item.label)}">\n` +
        `  <meta name="twitter:data${i + 1}" content="${escapeHtml(item.value)}">`
    )
    .join("\n");
}

/**
 * Generate HTML with Open Graph meta tags for entity preview
 *
 * @param metadata - Entity metadata
 * @param canonicalUrl - Canonical URL for the entity
 * @param env - Worker environment bindings
 * @returns HTML string with OG meta tags
 */
export function generateOGHtml(
  metadata: OGMetadata,
  canonicalUrl: string,
  env: Env
): string {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(truncate(metadata.description, 200));
  const image = metadata.image || `${env.OG_IMAGE_BASE}/default-og.png`;
  const siteName = "cite";

  // Build full title with entity type badge
  const typeLabel = getEntityTypeLabel(metadata.type);
  const fullTitle = typeLabel ? `${title} | ${typeLabel}` : title;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${fullTitle} - ${siteName}</title>

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${fullTitle}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="en_US">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}">
  <meta name="twitter:title" content="${fullTitle}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta name="twitter:image:alt" content="${fullTitle}">
${buildTwitterLabelTags(metadata.labeledData)}

  <!-- Additional SEO -->
  <meta name="description" content="${description}">
  <meta name="author" content="${escapeHtml(metadata.creatorName)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">

  <!-- Redirect to actual page -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">

  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }
    .card {
      background: rgba(255, 255, 255, 0.95);
      color: #333;
      padding: 2rem;
      border-radius: 12px;
      max-width: 600px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }
    .badge {
      display: inline-block;
      background: #667eea;
      color: #fff;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      line-height: 1.3;
    }
    .description {
      color: #666;
      margin: 0 0 1.5rem;
      line-height: 1.5;
    }
    .author {
      font-size: 0.875rem;
      color: #888;
      margin-bottom: 1rem;
    }
    a {
      display: inline-block;
      background: #667eea;
      color: #fff;
      text-decoration: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 500;
      transition: background 0.2s, transform 0.2s;
    }
    a:hover {
      background: #5a6fd6;
      transform: translateY(-1px);
    }
    .spinner {
      margin-top: 1rem;
      font-size: 0.875rem;
      color: #888;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">${escapeHtml(typeLabel)}</span>
    <h1>${title}</h1>
    <p class="description">${description}</p>
    <p class="author">by ${escapeHtml(metadata.creatorName)}</p>
    <a href="${escapeHtml(canonicalUrl)}">View on cite.opensource.legal</a>
    <p class="spinner pulse">Redirecting...</p>
  </div>
  <noscript>
    <style>.spinner { display: none; }</style>
  </noscript>
</body>
</html>`;
}

/**
 * Generate generic/fallback OG HTML when entity is not found or private
 *
 * @param canonicalUrl - The requested URL
 * @param env - Worker environment bindings
 * @returns HTML string with generic OG meta tags
 */
export function generateGenericOGHtml(canonicalUrl: string, env: Env): string {
  const siteName = "cite";
  const title = "cite — the citation layer for agentic workflows";
  const description =
    "cite turns a repository of documents into an open citation graph that humans and AI agents can read, reason over, and contribute back to.";
  const image = `${env.OG_IMAGE_BASE}/default-og.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${siteName}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <!-- Redirect -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(canonicalUrl)}">${title}</a>...</p>
</body>
</html>`;
}

```

### Core Architecture Module: `cloudflare-og-worker/src/index.ts`
```
/**
 * cite Social Media Preview Worker
 *
 * This Cloudflare Worker intercepts requests from social media crawlers
 * and returns HTML with Open Graph meta tags for rich link previews.
 *
 * For regular browser requests, the worker passes through to the origin
 * (the React SPA).
 *
 * @see docs/architecture/social-media-previews.md
 */

import type { Env } from "./types";
import { isSocialMediaCrawler, getCrawlerName } from "./crawler";
import { parseRoute, isDeepLinkUrl } from "./parser";
import { fetchOGMetadata } from "./metadata";
import { generateOGHtml, generateGenericOGHtml } from "./html";

/**
 * Pass request through to origin without re-invoking the worker.
 * Uses a header flag to prevent infinite loops in route-based deployments.
 */
async function passToOrigin(request: Request): Promise<Response> {
  // Check if already processed to prevent infinite loops
  if (request.headers.get("X-OG-Worker-Pass")) {
    // This shouldn't happen with proper Cloudflare routing, but safety first
    return new Response("Loop detected", { status: 500 });
  }

  // Create new request with pass-through header
  const headers = new Headers(request.headers);
  headers.set("X-OG-Worker-Pass", "true");

  const originRequest = new Request(request.url, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: request.redirect,
  });

  return fetch(originRequest);
}

export default {
  /**
   * Handle incoming requests
   *
   * Flow:
   * 1. Check if request is from a social media crawler
   * 2. If not crawler, pass through to origin (React SPA)
   * 3. If crawler, check if URL is a deep-link
   * 4. If deep-link, fetch metadata and return OG HTML
   * 5. If not deep-link or private entity, return generic OG HTML
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";

    // Check for pass-through header to prevent infinite loops
    if (request.headers.get("X-OG-Worker-Pass")) {
      return fetch(request);
    }

    // Log ALL requests for debugging (helps identify unknown crawlers)
    const crawlerName = getCrawlerName(userAgent);
    const isCrawler = isSocialMediaCrawler(userAgent);
    console.log(JSON.stringify({
      event: "request",
      path: url.pathname,
      userAgent: userAgent.substring(0, 200),
      isCrawler,
      crawlerName,
      timestamp: new Date().toISOString(),
    }));

    // Only intercept for social media crawlers
    if (!isSocialMediaCrawler(userAgent)) {
      // Pass through to origin (React SPA)
      return passToOrigin(request);
    }

    // Check if this is a deep-link URL we should handle
    const route = parseRoute(url.pathname);

    if (!route) {
      // Not a recognized deep-link pattern
      // Return generic OG for crawlers on non-deep-link pages
      if (isStaticPage(url.pathname)) {
        return generateGenericResponse(url, env);
      }
      // Pass through for other URLs
      return passToOrigin(request);
    }

    try {
      // Fetch metadata from backend API
      const metadata = await fetchOGMetadata(route, env);

      if (!metadata) {
        // Entity not found or not public
        // Return generic OG HTML instead of error
        console.log(`No public metadata found for ${url.pathname}`);
        return generateGenericResponse(url, env);
      }

      // Generate and return OG HTML
      const html = generateOGHtml(metadata, url.href, env);

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          // Cache successful responses for 1 hour
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
          // Allow crawlers to cache
          "X-Robots-Tag": "index, follow",
          // Indicate this is a crawler response
          "X-OG-Worker": "true",
        },
      });
    } catch (error) {
      console.error("OG Worker error:", error);

      // On error, return generic OG HTML rather than failing
      return generateGenericResponse(url, env);
    }
  },
};

/**
 * Check if the pathname is a static marketing/info page
 */
function isStaticPage(pathname: string): boolean {
  const staticPages = [
    "/",
    "/about",
    "/features",
    "/pricing",
    "/docs",
    "/login",
    "/signup",
    "/register",
  ];
  return staticPages.includes(pathname) || pathname.startsWith("/docs/");
}

/**
 * Generate a generic OG response for fallback cases
 */
function generateGenericResponse(url: URL, env: Env): Response {
  const html = generateGenericOGHtml(url.href, env);

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      // Cache generic responses for 24 hours
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "X-Robots-Tag": "index, follow",
      "X-OG-Worker": "true",
      "X-OG-Fallback": "true",
    },
  });
}

// Export types for testing
export type { Env };

```

### Core Architecture Module: `cloudflare-og-worker/src/metadata.ts`
```
/**
 * GraphQL metadata fetching for OG previews
 *
 * Fetches minimal metadata from the cite backend API
 * for generating Open Graph tags. Only returns data for public entities.
 */

import type {
  Env,
  EntityType,
  ParsedRoute,
  OGMetadata,
  LabeledData,
  GraphQLResponse,
  OGCorpusData,
  OGDocumentData,
  OGThreadData,
  OGExtractData,
} from "./types";

/**
 * GraphQL query definitions for each entity type
 */
const QUERIES: Record<EntityType, string> = {
  corpus: `
    query OGCorpus($userSlug: String!, $corpusSlug: String!) {
      ogCorpusMetadata(userSlug: $userSlug, corpusSlug: $corpusSlug) {
        title
        description
        iconUrl
        documentCount
        creatorName
        isPublic
      }
    }
  `,

  document: `
    query OGDocument($userSlug: String!, $documentSlug: String!) {
      ogDocumentMetadata(userSlug: $userSlug, documentSlug: $documentSlug) {
        title
        description
        iconUrl
        corpusTitle
        creatorName
        isPublic
      }
    }
  `,

  document_in_corpus: `
    query OGDocumentInCorpus($userSlug: String!, $corpusSlug: String!, $documentSlug: String!) {
      ogDocumentInCorpusMetadata(
        userSlug: $userSlug
        corpusSlug: $corpusSlug
        documentSlug: $documentSlug
      ) {
        title
        description
        iconUrl
        corpusTitle
        corpusDescription
        creatorName
        isPublic
      }
    }
  `,

  thread: `
    query OGThread($userSlug: String!, $corpusSlug: String!, $threadId: String!) {
      ogThreadMetadata(userSlug: $userSlug, corpusSlug: $corpusSlug, threadId: $threadId) {
        title
        corpusTitle
        messageCount
        creatorName
        isPublic
      }
    }
  `,

  extract: `
    query OGExtract($extractId: String!) {
      ogExtractMetadata(extractId: $extractId) {
        name
        corpusTitle
        fieldsetName
        creatorName
        isPublic
      }
    }
  `,
};

/**
 * Build GraphQL variables from parsed route
 */
function buildVariables(route: ParsedRoute): Record<string, string> {
  const vars: Record<string, string> = {};

  if (route.userSlug) vars.userSlug = route.userSlug;
  if (route.corpusSlug) vars.corpusSlug = route.corpusSlug;
  if (route.documentSlug) vars.documentSlug = route.documentSlug;
  if (route.extractId) vars.extractId = route.extractId;
  if (route.threadId) vars.threadId = route.threadId;

  return vars;
}

/**
 * Fetch OG metadata from the backend API
 *
 * @param route - Parsed route information
 * @param env - Worker environment bindings
 * @returns OG metadata or null if entity not found/not public
 */
export async function fetchOGMetadata(
  route: ParsedRoute,
  env: Env
): Promise<OGMetadata | null> {
  const query = QUERIES[route.type];
  if (!query) {
    console.error(`No query defined for entity type: ${route.type}`);
    return null;
  }

  const variables = buildVariables(route);

  try {
    const response = await fetch(`${env.API_URL}/graphql/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // No auth header - these are public queries
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      console.error(`GraphQL request failed with status ${response.status}`);
      return null;
    }

    const json = (await response.json()) as GraphQLResponse;

    if (json.errors && json.errors.length > 0) {
      console.error("GraphQL errors:", json.errors);
      return null;
    }

    return extractMetadata(route.type, json.data, env);
  } catch (error) {
    console.error("Failed to fetch OG metadata:", error);
    return null;
  }
}

/**
 * Build a pluralized document count string (e.g. "1 document", "5 documents")
 */
function formatDocCount(count: number): string {
  return `${count} document${count !== 1 ? "s" : ""}`;
}

/**
 * Compose a corpus description that leads with the user-provided description
 * and appends the document count for additional context.
 */
function composeCorpusDescription(
  userDescription: string | undefined | null,
  documentCount: number
): string {
  const docCountStr = formatDocCount(documentCount);
  const desc = userDescription?.trim();
  if (desc) {
    return `${desc} \u2014 ${docCountStr}`;
  }
  return `A corpus with ${docCountStr}`;
}

/**
 * Compose a document-in-corpus description that provides corpus context
 * when the document itself lacks a description.
 */
function composeDocInCorpusDescription(
  docDescription: string | undefined | null,
  corpusTitle: string | undefined | null,
  corpusDescription: string | undefined | null
): string {
  const docDesc = docDescription?.trim();
  const corpusDesc = corpusDescription?.trim();

  if (docDesc) {
    // Document has its own description; append corpus context
    if (corpusTitle) {
      return `${docDesc} \u2014 from ${corpusTitle}`;
    }
    return docDesc;
  }

  // No document description — use corpus context
  if (corpusTitle && corpusDesc) {
    return `From ${corpusTitle}: ${corpusDesc}`;
  }
  if (corpusTitle) {
    return `Document in ${corpusTitle}`;
  }
  return "Document on cite.opensource.legal";
}

/**
 * Extract and normalize metadata from GraphQL response
 */
function extractMetadata(
  type: EntityType,
  data: unknown,
  env: Env
): OGMetadata | null {
  switch (type) {
    case "corpus": {
      const corpus = (data as OGCorpusData).ogCorpusMetadata;
      if (!corpus || !corpus.isPublic) return null;

      const labeledData: LabeledData[] = [
        { label: "Documents", value: formatDocCount(corpus.documentCount) },
        { label: "Author", value: corpus.creatorName },
      ];

      return {
        title: corpus.title,
        description: composeCorpusDescription(
          corpus.description,
          corpus.documentCount
        ),
        image: corpus.iconUrl || `${env.OG_IMAGE_BASE}/corpus-og.png`,
        type,
        entityName: corpus.title,
        creatorName: corpus.creatorName,
        documentCount: corpus.documentCount,
        labeledData,
      };
    }

    case "document": {
      const doc = (data as OGDocumentData).ogDocumentMetadata;
      if (!doc || !doc.isPublic) return null;

      const labeledData: LabeledData[] = [
        { label: "Author", value: doc.creatorName },
      ];
      if (doc.corpusTitle) {
        labeledData.unshift({ label: "Corpus", value: doc.corpusTitle });
      }

      return {
        title: doc.title,
        description: doc.description || "Document on cite.opensource.legal",
        image: doc.iconUrl || `${env.OG_IMAGE_BASE}/document-og.png`,
        type,
        entityName: doc.title,
        creatorName: doc.creatorName,
        corpusTitle: doc.corpusTitle || undefined,
        labeledData,
      };
    }

    case "document_in_corpus": {
      // Uses same response type as document
      const doc = (
        data as { ogDocumentInCorpusMetadata: OGDocumentData["ogDocumentMetadata"] }
      ).ogDocumentInCorpusMetadata;
      if (!doc || !doc.isPublic) return null;

      const labeledData: LabeledData[] = [
        { label: "Author", value: doc.creatorName },
      ];
      if (doc.corpusTitle) {
        labeledData.unshift({ label: "Corpus", value: doc.corpusTitle });
      }

      return {
        title: doc.title,
        description: composeDocInCorpusDescription(
          doc.description,
          doc.corpusTitle,
          doc.corpusDescription
        ),
        image: doc.iconUrl || `${env.OG_IMAGE_BASE}/document-og.png`,
        type,
        entityName: doc.title,
        creatorName: doc.creatorName,
        corpusTitle: doc.corpusTitle || undefined,
        labeledData,
      };
    }

    case "thread": {
      const thread = (data as OGThreadData).ogThreadMetadata;
      if (!thread || !thread.isPublic) return null;

      const messageStr = `${thread.messageCount} message${thread.messageCount !== 1 ? "s" : ""}`;
      const labeledData: LabeledData[] = [
        { label: "Corpus", value: thread.corpusTitle },
        { label: "Messages", value: messageStr },
      ];

      return {
        title: thread.title || "Discussion",
        description: `Discussion in ${thread.corpusTitle} \u2014 ${messageStr}`,
        image: `${env.OG_IMAGE_BASE}/discussion-og.png`,
        type,
        entityName: thread.title || "Discussion",
        creatorName: thread.creatorName,
        corpusTitle: thread.corpusTitle,
        labeledData,
      };
    }

    case "extract": {
      const extract = (data as OGExtractData).ogExtractMetadata;
      if (!extract || !extract.isPublic) return null;

      const labeledData: LabeledData[] = [
        { label: "Fieldset", value: extract.fieldsetName },
        { label: "Corpus", value: extract.corpusTitle },
      ];

      return {
        title: extract.name,
        description: `Data extraction using ${extract.fieldsetName} on ${extract.corpusTitle}`,
        image: `${env.OG_IMAGE_BASE}/extract-og.png`,
        type,
        entityName: extract.name,
        creatorName: extract.creatorName,
        corpusTitle: extract.corpusTitle,
        labeledData,
      };
    }

    default:
      return null;
  }
}

```

### Core Architecture Module: `cloudflare-og-worker/src/parser.ts`
```
/**
 * URL route parser for cite deep-links
 *
 * Parses URL pathnames to extract entity information for OG metadata fetching.
 * Supports all deep-link patterns defined in docs/architecture/deep-linking.md
 */

import type { EntityType, ParsedRoute } from "./types";

/**
 * Route pattern definitions
 * Order matters - more specific patterns should be checked first
 */
const ROUTE_PATTERNS: Array<{
  pattern: RegExp;
  type: EntityType;
  extract: (match: RegExpMatchArray) => Partial<ParsedRoute>;
}> = [
  // Thread: /c/{userSlug}/{corpusSlug}/discussions/{threadId}
  {
    pattern: /^\/c\/([^\/]+)\/([^\/]+)\/discussions\/([^\/]+)$/,
    type: "thread",
    extract: (match) => ({
      userSlug: match[1],
      corpusSlug: match[2],
      threadId: match[3],
    }),
  },

  // Corpus: /c/{userSlug}/{corpusSlug}
  {
    pattern: /^\/c\/([^\/]+)\/([^\/]+)$/,
    type: "corpus",
    extract: (match) => ({
      userSlug: match[1],
      corpusSlug: match[2],
    }),
  },

  // Document in corpus: /d/{userSlug}/{corpusSlug}/{documentSlug}
  {
    pattern: /^\/d\/([^\/]+)\/([^\/]+)\/([^\/]+)$/,
    type: "document_in_corpus",
    extract: (match) => ({
      userSlug: match[1],
      corpusSlug: match[2],
      documentSlug: match[3],
    }),
  },

  // Standalone document: /d/{userSlug}/{documentSlug}
  {
    pattern: /^\/d\/([^\/]+)\/([^\/]+)$/,
    type: "document",
    extract: (match) => ({
      userSlug: match[1],
      documentSlug: match[2],
    }),
  },

  // Extract: /e/{userSlug}/{extractId}
  {
    pattern: /^\/e\/([^\/]+)\/([^\/]+)$/,
    type: "extract",
    extract: (match) => ({
      userSlug: match[1],
      extractId: match[2],
    }),
  },
];

/**
 * Parse a URL pathname to extract deep-link route information
 *
 * @param pathname - The URL pathname (e.g., "/c/john/legal-contracts")
 * @returns Parsed route information or null if not a recognized deep-link
 *
 * @example
 * parseRoute('/c/john/legal-contracts')
 * // { type: 'corpus', userSlug: 'john', corpusSlug: 'legal-contracts' }
 *
 * @example
 * parseRoute('/d/john/legal-contracts/my-document')
 * // { type: 'document_in_corpus', userSlug: 'john', corpusSlug: 'legal-contracts', documentSlug: 'my-document' }
 */
export function parseRoute(pathname: string): ParsedRoute | null {
  // Normalize pathname: remove trailing slash, handle encoded characters
  let normalizedPath: string;
  try {
    normalizedPath = decodeURIComponent(pathname.replace(/\/$/, ""));
  } catch {
    // decodeURIComponent throws on malformed URLs (e.g., invalid percent encoding)
    // Return null to trigger fallback behavior
    return null;
  }

  for (const { pattern, type, extract } of ROUTE_PATTERNS) {
    const match = normalizedPath.match(pattern);
    if (match) {
      return {
        type,
        userSlug: "", // Will be overwritten by extract
        ...extract(match),
      } as ParsedRoute;
    }
  }

  return null;
}

/**
 * Check if a pathname matches any deep-link pattern
 *
 * @param pathname - The URL pathname to check
 * @returns true if the pathname is a deep-link URL
 */
export function isDeepLinkUrl(pathname: string): boolean {
  return parseRoute(pathname) !== null;
}

/**
 * Build a canonical URL from parsed route information
 *
 * @param route - Parsed route information
 * @param baseUrl - Base URL of the site
 * @returns Canonical URL string
 */
export function buildCanonicalUrl(route: ParsedRoute, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");

  switch (route.type) {
    case "corpus":
      return `${base}/c/${route.userSlug}/${route.corpusSlug}`;

    case "thread":
      return `${base}/c/${route.userSlug}/${route.corpusSlug}/discussions/${route.threadId}`;

    case "document":
      return `${base}/d/${route.userSlug}/${route.documentSlug}`;

    case "document_in_corpus":
      return `${base}/d/${route.userSlug}/${route.corpusSlug}/${route.documentSlug}`;

    case "extract":
      return `${base}/e/${route.userSlug}/${route.extractId}`;

    default:
      return base;
  }
}

/**
 * Get a human-readable type label for an entity type
 *
 * @param type - Entity type
 * @returns Human-readable label
 */
export function getEntityTypeLabel(type: EntityType): string {
  const labels: Record<EntityType, string> = {
    corpus: "Corpus",
    document: "Document",
    document_in_corpus: "Document",
    thread: "Discussion",
    extract: "Data Extract",
  };
  return labels[type] || "Resource";
}

```

### Core Architecture Module: `cloudflare-og-worker/src/types.ts`
```
/**
 * TypeScript types for cite OG Preview Worker
 */

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  /** Base URL of the cite site */
  SITE_URL: string;
  /** Backend API URL for GraphQL queries */
  API_URL: string;
  /** Base URL for static OG preview images */
  OG_IMAGE_BASE: string;
}

/**
 * Entity types that support deep-linking
 */
export type EntityType =
  | "corpus"
  | "document"
  | "document_in_corpus"
  | "extract"
  | "thread";

/**
 * Parsed route information from URL pathname
 */
export interface ParsedRoute {
  type: EntityType;
  userSlug: string;
  corpusSlug?: string;
  documentSlug?: string;
  extractId?: string;
  threadId?: string;
}

/**
 * Labeled data pair for Twitter structured card previews
 */
export interface LabeledData {
  label: string;
  value: string;
}

/**
 * Open Graph metadata for social media previews
 */
export interface OGMetadata {
  title: string;
  description: string;
  image: string | null;
  type: EntityType;
  entityName: string;
  creatorName: string;
  documentCount?: number;
  corpusTitle?: string;
  /** Structured key-value pairs for Twitter summary cards */
  labeledData?: LabeledData[];
}

/**
 * GraphQL response structure
 */
export interface GraphQLResponse<T = Record<string, unknown>> {
  data: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

/**
 * OG Corpus metadata from GraphQL
 */
export interface OGCorpusData {
  ogCorpusMetadata: {
    title: string;
    description: string;
    iconUrl: string | null;
    documentCount: number;
    creatorName: string;
    isPublic: boolean;
  } | null;
}

/**
 * OG Document metadata from GraphQL
 */
export interface OGDocumentData {
  ogDocumentMetadata: {
    title: string;
    description: string;
    iconUrl: string | null;
    corpusTitle: string | null;
    corpusDescription: string | null;
    creatorName: string;
    isPublic: boolean;
  } | null;
}

/**
 * OG Thread metadata from GraphQL
 */
export interface OGThreadData {
  ogThreadMetadata: {
    title: string;
    corpusTitle: string;
    messageCount: number;
    creatorName: string;
    isPublic: boolean;
  } | null;
}

/**
 * OG Extract metadata from GraphQL
 */
export interface OGExtractData {
  ogExtractMetadata: {
    name: string;
    corpusTitle: string;
    fieldsetName: string;
    creatorName: string;
    isPublic: boolean;
  } | null;
}

```

### Core Architecture Module: `config/graphql/_util.py`
```
"""Shared runtime helpers for generated strawberry modules."""

from enum import Enum
from typing import Any

import strawberry


def strip_unset(kwargs: dict) -> dict:
    """Drop UNSET args (graphene omitted absent kwargs) and unwrap enums."""
    out = {}
    for k, v in kwargs.items():
        if v is strawberry.UNSET:
            continue
        if isinstance(v, Enum):
            v = v.value
        out[k] = v
    return out


def coerce_str(value: Any):
    """graphene String coercion (str() on anything non-null)."""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


def coerce_enum(enum_cls, value: Any):
    if value is None or value == "":
        return None
    if isinstance(value, enum_cls):
        return value
    return enum_cls(value)

```

### Core Architecture Module: `config/graphql/core/__init__.py`
```
"""Strawberry GraphQL core framework for OpenContracts.

This package reproduces, on top of strawberry-graphql, the graphene /
graphene-django runtime semantics the OpenContracts schema was built
against — relay global IDs, countable connections with graphene-django's
slicing + ``offset`` argument, django-filter FilterSet-backed connection
arguments, the ``GenericScalar`` / ``JSONString`` scalars, and the
permission-annotation fields (``myPermissions`` / ``isPublished`` /
``objectSharedWith``).

The wire contract (query shapes, type names, argument names, cursor
format) is pinned by ``opencontractserver/tests/test_schema_parity.py``
against the golden SDL captured from the graphene schema at migration
time (``config/graphql/schema.graphql``).
"""

from config.graphql.core.auth import (  # noqa: F401
    PermissionDenied,
    login_required,
    staff_member_required,
    superuser_required,
    user_passes_test,
)
from config.graphql.core.scalars import (  # noqa: F401
    BigInt,
    GenericScalar,
    JSONString,
)

```

### Core Architecture Module: `config/graphql/core/auth.py`
```
"""Resolver auth decorators (replacement for ``graphql_jwt.decorators``).

The decorators operate on graphene-signature resolver callables
``f(root, info, **kwargs)`` — the calling convention every ported
resolver body keeps — and read the Django ``HttpRequest`` from
``info.context`` exactly like the graphene stack did. Error messages
match ``graphql_jwt.exceptions`` so GraphQL error payloads observed by
clients (and asserted by tests) are unchanged.
"""

from __future__ import annotations

from functools import wraps
from typing import Any, Callable

from config.jwt_auth.exceptions import JSONWebTokenError, PermissionDenied  # noqa: F401


def user_passes_test(
    test_func: Callable[[Any], bool], exc: type[Exception] = PermissionDenied
) -> Callable:
    """Decorator factory mirroring ``graphql_jwt.decorators.user_passes_test``.

    Works on resolvers with the graphene calling convention
    ``f(root, info, **kwargs)`` where ``info.context`` is the request.
    """

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(root: Any, info: Any, *args: Any, **kwargs: Any) -> Any:
            if test_func(info.context.user):
                return f(root, info, *args, **kwargs)
            raise exc()

        return wrapper

    return decorator


login_required = user_passes_test(lambda u: u.is_authenticated)
staff_member_required = user_passes_test(lambda u: u.is_staff)
superuser_required = user_passes_test(lambda u: u.is_superuser)

```

### Core Architecture Module: `config/graphql/core/filtering.py`
```
"""django-filter FilterSet ↔ GraphQL argument-name mapping.

graphene derived connection argument names from django-filter filter names
via ``graphene.utils.str_converters.to_camel_case`` (which camel-cases
around *single* underscores while preserving a ``__`` boundary as ``_`` +
TitleCase — e.g. ``annotation_label__text__contains`` →
``annotationLabel_TextContains``). The strawberry schema keeps the same
wire names; this module reproduces the conversion so resolvers can map
GraphQL argument names back to filter names.
"""

from __future__ import annotations

import binascii
import itertools
from functools import lru_cache

from django import forms
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _
from django_filters import Filter, MultipleChoiceFilter
from django_filters.filterset import (
    FILTER_FOR_DBFIELD_DEFAULTS,
    BaseFilterSet,
    FilterSet,
)

from opencontractserver.utils.ids import from_global_id


def to_camel_case(snake_str: str) -> str:
    """graphene.utils.str_converters.to_camel_case — exact port."""
    components = snake_str.split("_")
    return components[0] + "".join(x.capitalize() if x else "_" for x in components[1:])


@lru_cache(maxsize=None)
def filterset_arg_names(filterset_class: type) -> tuple[tuple[str, str], ...]:
    """(filter_name, graphql_arg_name) pairs for a FilterSet class."""
    return tuple(
        (name, to_camel_case(name))
        for name in filterset_class.base_filters  # type: ignore[attr-defined]
    )


# --------------------------------------------------------------------------- #
# graphene-django FilterSet wrapping (ports of                                #
# graphene_django.filter.filterset + .filters.global_id_filter + forms)       #
# --------------------------------------------------------------------------- #


class GlobalIDFormField(forms.Field):
    default_error_messages = {"invalid": _("Invalid ID specified.")}

    def clean(self, value):
        if not value and not self.required:
            return None

        try:
            _type, _id = from_global_id(value)
        except (TypeError, ValueError, UnicodeDecodeError, binascii.Error):
            raise ValidationError(self.error_messages["invalid"])

        try:
            forms.CharField().clean(_id)
            forms.CharField().clean(_type)
        except ValidationError:
            raise ValidationError(self.error_messages["invalid"])

        return value


class GlobalIDMultipleChoiceField(forms.MultipleChoiceField):
    default_error_messages = {
        "invalid_choice": _("One of the specified IDs was invalid (%(value)s)."),
        "invalid_list": _("Enter a list of values."),
    }

    def valid_value(self, value):
        # Clean will raise a validation error if there is a problem
        GlobalIDFormField().clean(value)
        return True


class GlobalIDFilter(Filter):
    """Filter for a Relay global ID — decodes to the primary key."""

    field_class = GlobalIDFormField

    def filter(self, qs, value):
        _id = None
        if value is not None:
            _, _id = from_global_id(value)
        return super().filter(qs, _id)


class GlobalIDMultipleChoiceFilter(MultipleChoiceFilter):
    field_class = GlobalIDMultipleChoiceField

    def filter(self, qs, value):
        gids = [from_global_id(v)[1] for v in value]
        return super().filter(qs, gids)


FILTER_SET_OVERRIDES = {
    models.AutoField: {"filter_class": GlobalIDFilter},
    models.OneToOneField: {"filter_class": GlobalIDFilter},
    models.ForeignKey: {"filter_class": GlobalIDFilter},
    models.ManyToManyField: {"filter_class": GlobalIDMultipleChoiceFilter},
    models.ManyToOneRel: {"filter_class": GlobalIDMultipleChoiceFilter},
    models.ManyToManyRel: {"filter_class": GlobalIDMultipleChoiceFilter},
}


class GrapheneFilterSetMixin(BaseFilterSet):
    """BaseFilterSet with default overrides to handle relay global IDs."""

    FILTER_DEFAULTS = dict(
        itertools.chain(
            FILTER_FOR_DBFIELD_DEFAULTS.items(), FILTER_SET_OVERRIDES.items()
        )
    )


@lru_cache(maxsize=None)
def setup_filterset(filterset_class: type) -> type:
    """Wrap a provided FilterSet with the relay global-ID overrides."""
    return type(
        f"Graphene{filterset_class.__name__}",
        (filterset_class, GrapheneFilterSetMixin),
        {},
    )


def filterset_factory(model: type, fields: dict) -> type:
    """Create a FilterSet for ``model`` from a graphene-django
    ``filter_fields`` mapping (port of ``custom_filterset_factory``)."""
    meta_class = type("Meta", (object,), {"model": model, "fields": fields})
    return type(
        f"{model._meta.object_name}FilterSet",  # type: ignore[attr-defined]
        (FilterSet, GrapheneFilterSetMixin),
        {"Meta": meta_class},
    )

```

### Core Architecture Module: `config/graphql/core/mutations.py`
```
"""DRF-serializer-backed mutation implementations.

Faithful ports of ``config.graphql.base.DRFMutation.mutate`` and
``config.graphql.base.DRFDeletion.mutate`` operating on strawberry payload
classes. Generated mutation resolvers call these with the values that were
previously declared on the graphene ``IOSettings`` inner class.
"""

from __future__ import annotations

import logging
import traceback
from collections.abc import Sequence
from typing import Any, cast

from django.db.models import Model
from rest_framework import serializers

from config.graphql.core.auth import PermissionDenied
from config.ratelimit.decorators import graphql_ratelimit
from config.ratelimit.rates import RateLimits
from opencontractserver.shared.services.base import BaseService
from opencontractserver.types.enums import PermissionTypes
from opencontractserver.utils.ids import from_global_id, to_global_id
from opencontractserver.utils.permissioning import set_permissions_for_obj_to_user

logger = logging.getLogger(__name__)


def format_validation_error(ve: serializers.ValidationError) -> str:
    """Port of ``DRFMutation.format_validation_error``."""
    if isinstance(ve.detail, dict):
        errors = "; ".join(
            f"{field}: {', '.join(str(e) for e in errs)}"
            for field, errs in ve.detail.items()
        )
    elif isinstance(ve.detail, list):
        errors = "; ".join(str(e) for e in ve.detail)
    else:
        errors = str(ve.detail)
    return f"Mutation failed due to error: {errors}"


def _require_login(info: Any) -> None:
    if not info.context.user.is_authenticated:
        raise PermissionDenied()


def drf_mutation(
    *,
    payload_cls: type,
    model: type,
    serializer: type,
    type_name: str,
    pk_fields: Sequence[str] = (),
    lookup_field: str = "id",
    root: Any = None,
    info: Any = None,
    kwargs: dict[str, Any],
) -> Any:
    """Port of ``DRFMutation.mutate`` (create/update via DRF serializer)."""
    _require_login(info)
    # ``group="mutate"`` keeps DRF-routed mutations in the SAME fixed-window
    # rate bucket as every hand-ported ``mutate`` resolver. Without it the
    # decorator derives the group from ``func.__name__`` — here a ``lambda``,
    # i.e. ``"<lambda>"`` — splitting these off into a separate counter and
    # roughly doubling a user's combined write budget. Matches the graphene
    # baseline, where all mutations shared the one ``"mutate"`` group.
    _ratelimited = graphql_ratelimit(rate=RateLimits.WRITE_MEDIUM, group="mutate")(
        lambda _root, _info, **kw: _drf_mutation_body(
            payload_cls=payload_cls,
            model=model,
            serializer=serializer,
            type_name=type_name,
            pk_fields=pk_fields,
            lookup_field=lookup_field,
            info=_info,
            kwargs=kw,
        )
    )
    return _ratelimited(root, info, **kwargs)


def _drf_mutation_body(
    *,
    payload_cls: type,
    model: type,
    serializer: type,
    type_name: str,
    pk_fields: Sequence[str],
    lookup_field: str,
    info: Any,
    kwargs: dict[str, Any],
) -> Any:
    ok = False
    obj_id = None

    try:
        if not info.context.user:
            raise ValueError("No user in this request...")

        # Ownership grants management permissions. Editing a shared object
        # must never turn an UPDATE grantee into its owner.
        is_update = lookup_field in kwargs
        if is_update:
            kwargs.pop("creator", None)
            kwargs.pop("creator_id", None)
        else:
            kwargs["creator"] = info.context.user.id

        for pk_field in pk_fields:
            if pk_field in kwargs:
                raw_value = kwargs[pk_field]
                if raw_value is None:
                    continue
                if isinstance(raw_value, list):
                    kwargs[pk_field] = [
                        from_global_id(global_id)[1] for global_id in raw_value
                    ]
                else:
                    kwargs[pk_field] = from_global_id(raw_value)[1]

                # A writable parent is not authority to attach someone else's
                # private label set or label (and expose its intrinsic fields).
                # Categories are install-wide vocabulary, not private data.
                if pk_field in {"label_set", "annotation_label"}:
                    related_model = (
                        cast(type[Model], model)._meta.get_field(pk_field).related_model
                    )
                    if (
                        BaseService.get_or_none(
                            related_model,
                            kwargs[pk_field],
                            info.context.user,
                            request=info.context,
                        )
                        is None
                    ):
                        raise serializers.ValidationError(
                            {pk_field: "Resource not found or access denied."}
                        )

        if is_update:
            lookup_pk = from_global_id(kwargs[lookup_field])[1]
            obj = BaseService.get_or_none(
                model, lookup_pk, info.context.user, request=info.context
            )
            if obj is None:
                raise model.DoesNotExist(  # type: ignore[attr-defined]
                    f"{model.__name__} matching query does not exist."
                )

            if hasattr(obj, "user_lock") and obj.user_lock is not None:
                if info.context.user.id != obj.user_lock_id:
                    raise PermissionError(
                        "Specified object is locked by another user. Cannot be "
                        "updated / edited."
                    )

            if hasattr(obj, "backend_lock") and obj.backend_lock:
                raise PermissionError(
                    "This object has been locked by the backend for processing. "
                    "You cannot edit it at the moment."
                )

            permission_error = BaseService.require_permission(
                obj,
                info.context.user,
                PermissionTypes.UPDATE,
                request=info.context,
                error_message="You do not have permission to modify this object",
            )
            if permission_error:
                raise PermissionError(permission_error)

            obj_serializer = serializer(obj, data=kwargs, partial=True)
            obj_serializer.is_valid(raise_exception=True)
            obj_serializer.save()
            ok = True
            message = "Success"
            obj_id = to_global_id(type_name, obj.id)

        else:
            obj_serializer = serializer(data=kwargs)
            obj_serializer.is_valid(raise_exception=True)
            obj = obj_serializer.save()

            set_permissions_for_obj_to_user(
                info.context.user,
                obj,
                [PermissionTypes.CRUD],
                is_new=True,
                request=info.context,
            )

            ok = True
            message = "Success"
            obj_id = to_global_id(type_name, obj.id)

    except serializers.ValidationError as ve:
        logger.warning(f"Validation error in mutation: {ve.detail}")
        message = format_validation_error(ve)

    except Exception:
        logger.error(traceback.format_exc())
        message = "Mutation failed due to an internal error."

    return payload_cls(ok=ok, message=message, obj_id=obj_id)


def drf_deletion(
    *,
    payload_cls: type,
    model: type,
    lookup_field: str = "id",
    root: Any = None,
    info: Any = None,
    kwargs: dict[str, Any],
) -> Any:
    """Port of ``DRFDeletion.mutate`` — errors intentionally propagate raw."""
    _require_login(info)
    # See ``drf_mutation``: pin the shared ``"mutate"`` rate bucket rather than
    # inheriting the lambda's ``"<lambda>"`` group.
    _ratelimited = graphql_ratelimit(rate=RateLimits.WRITE_LIGHT, group="mutate")(
        lambda _root, _info, **kw: _drf_deletion_body(
            payload_cls=payload_cls,
            model=model,
            lookup_field=lookup_field,
            info=_info,
            kwargs=kw,
        )
    )
    return _ratelimited(root, info, **kwargs)


def _drf_deletion_body(
    *,
    payload_cls: type,
    model: type,
    lookup_field: str,
    info: Any,
    kwargs: dict[str, Any],
) -> Any:
    lookup_value = kwargs.get(lookup_field)
    if lookup_value is None:
        raise ValueError(
            f"'{lookup_field}' is required to identify the object to delete."
        )
    pk = from_global_id(lookup_value)[1]
    obj = BaseService.get_or_none(model, pk, info.context.user, request=info.context)
    if obj is None:
        raise model.DoesNotExist(  # type: ignore[attr-defined]
            f"{model.__name__} matching query does not exist."
        )

    if hasattr(obj, "user_lock") and obj.user_lock is not None:
        if info.context.user.id != obj.user_lock_id:
            raise PermissionError(
                "Specified object is locked by another user. Cannot be " "deleted."
            )

    permission_error = BaseService.require_permission(
        obj,
        info.context.user,
        PermissionTypes.DELETE,
        request=info.context,
        error_message=(
            "You do not have sufficient permissions to delete requested object"
        ),
    )
    if permission_error:
        raise PermissionError(permission_error)

    obj.delete()
    return payload_cls(ok=True, message="Success!")

```

### Core Architecture Module: `config/graphql/core/permissions.py`
```
"""Permission-annotation field resolvers (``myPermissions`` /
``isPublished`` / ``objectSharedWith``).

Faithful port of
``config.graphql.permissioning.permission_annotator.mixins
.AnnotatePermissionsForReadMixin`` — the resolvers operate on the Django
model instance (the GraphQL root object) and keep the same per-request
caching contract the graphene middleware provided: the per-model
permission map is memoised on ``info.context.permission_annotations``.
Under graphene that map was eagerly populated by
``PermissionAnnotatingMiddleware`` on every resolved model field; here it
is populated lazily on first use, which preserves observable behaviour
(same data, same query count for requests that read these fields) without
a per-field middleware.
"""

from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction

from config.graphql.permissioning.permission_annotator.middleware import (
    get_permissions_for_user_on_model_in_app,
)
from opencontractserver.shared.grant_cache import GrantSnapshot
from opencontractserver.shared.prefetch_attrs import (
    permission_prefetch,
)
from opencontractserver.utils.permissioning import get_users_permissions_for_obj

User = get_user_model()

logger = logging.getLogger(__name__)

# Sentinel cached when ``User.get_anonymous()`` raises, so subsequent calls in
# the same request short-circuit instead of retrying the failing lookup N times.
_ANON_USER_LOOKUP_FAILED: int = -1


def get_anonymous_user_id(info: Any) -> int | None:
    """Return the django-guardian anonymous-user pk, cached on the request."""
    cached = getattr(info.context, "_anon_user_id", None)
    if cached == _ANON_USER_LOOKUP_FAILED:
        return None
    if cached is not None:
        return cached
    try:
        anon_id = User.get_anonymous().id  # type: ignore[attr-defined]
    except Exception:
        try:
            info.context._anon_user_id = _ANON_USER_LOOKUP_FAILED
        except AttributeError:
            # Frozen/immutable context (some tests) — skip the memo.
            pass
        return None
    try:
        info.context._anon_user_id = anon_id
    except AttributeError:
        # Frozen/immutable context (some tests) — skip the memo.
        pass
    return anon_id


def _permission_annotations(info: Any) -> dict[str, Any]:
    """The per-request actor/model permission-metadata cache.

    graphene's ``PermissionAnnotatingMiddleware`` created this attribute on
    the request; the strawberry stack creates it lazily here.
    """
    annotations = getattr(info.context, "permission_annotations", None)
    if annotations is None:
        annotations = {}
        try:
            info.context.permission_annotations = annotations
        except AttributeError:
            # Frozen/immutable context — fall back to an uncached dict.
            pass
    return annotations


def _annotations_for_model(info: Any, instance: Any) -> dict[str, Any]:
    """Memoise actor/model metadata using the shared grant-snapshot lifetime."""
    model_name = instance._meta.model_name
    app_label = instance._meta.app_label
    user = getattr(info.context, "user", None)
    key = f"{app_label}.{model_name}:{getattr(user, 'id', None)}"
    annotations = _permission_annotations(info)
    connection = transaction.get_connection(instance._state.db)
    cached = annotations.get(key)
    if cached is None or not cached[0].valid(connection):
        snapshot = GrantSnapshot(connection, user_id=getattr(user, "id", None))
        metadata = get_permissions_for_user_on_model_in_app(app_label, model_name, user)
        annotations[key] = snapshot, metadata
    return annotations[key][1]


def resolve_my_permissions(instance: Any, info: Any) -> list[str]:
    """Port of ``AnnotatePermissionsForReadMixin.resolve_my_permissions``."""
    anon_id = get_anonymous_user_id(info)
    context = info.context
    user = None

    if context is not None and hasattr(context, "user"):
        user = context.user
        if anon_id is not None and user.id == anon_id:
            return []

    model_name = instance._meta.model_name

    # Pre-computed permissions from the query optimizer (Annotation,
    # Relationship, DocumentRelationship).
    if model_name in [
        "annotation",
        "relationship",
        "documentrelationship",
    ] and hasattr(instance, "_can_read"):
        permissions: set[str] = set()
        if getattr(instance, "_can_read", False):
            permissions.add(f"read_{model_name}")
        if getattr(instance, "_can_create", False):
            permissions.add(f"create_{model_name}")
        if getattr(instance, "_can_update", False):
            permissions.add(f"update_{model_name}")
        if getattr(instance, "_can_delete", False):
            permissions.add(f"remove_{model_name}")
        if getattr(instance, "_can_comment", False):
            permissions.add(f"comment_{model_name}")
        if getattr(instance, "_can_publish", False):
            permissions.add(f"publish_{model_name}")
        return list(permissions)

    # Guardian-less models (creator-based, e.g. AnnotationLabel).
    if user is not None and not hasattr(
        instance, f"{model_name}userobjectpermission_set"
    ):
        return list(get_users_permissions_for_obj(user, instance))

    permissions = set()

    if instance.is_public:
        permissions.add(f"read_{model_name}")

    try:
        if user:
            try:
                model_permissions = _annotations_for_model(info, instance)

                this_user_group_ids = model_permissions.get("this_user_group_ids", [])
                this_model_permission_id_map = model_permissions.get(
                    "this_model_permission_id_map", {}
                )
                # ``get_permissions_for_user_on_model_in_app`` returns this
                # flag under ``"can_publish"`` — the ``"can_publish_model_type"``
                # key it was read under here never existed, permanently
                # dead-ending the ``publish_{model_name}`` grant below.
                # Pre-existing since the graphene era (see
                # config.graphql.permissioning.permission_annotator.mixins,
                # same typo), not a migration regression; fixed here since
                # the migration is the first place with test coverage
                # exercising this branch.
                can_publish_model_type = model_permissions.get("can_publish", False)

                # Prefer per-user prefetch (set by _apply_document_prefetches);
                # ``.filter()`` on the related manager bypasses the cache.
                this_user_perms = permission_prefetch(instance, user.id)
                if this_user_perms is None:
                    this_user_perms = getattr(
                        instance, f"{model_name}userobjectpermission_set"
                    ).filter(user_id=user.id)

                this_users_group_perms = permission_prefetch(
                    instance, user.id, groups=True
                )
                if this_users_group_perms is None:
                    this_users_group_perms = getattr(
                        instance, f"{model_name}groupobjectpermission_set"
                    ).filter(group_id__in=this_user_group_ids)

                for rows, source in (
                    (this_user_perms, "this_user_perm"),
                    (this_users_group_perms, "this_users_group_perms"),
                ):
                    for perm in rows:
                        try:
                            permissions.add(
                                this_model_permission_id_map[perm.permission_id]
                            )
                        except Exception as e:
                            logger.warning(
                                f"resolve_my_permissions() - Error trying to add "
                                f"{source} to model_permission_id_map: {e}"
                            )

                if can_publish_model_type:
                    permissions.add(f"publish_{model_name}")

            except Exception as e:
                logger.error(
                    f"resolve_my_permissions() - Error getting my_permissions: {e}"
                )
    except Exception as e:
        logger.error(
            f"resolve_my_permissions() - unexpected failure in outer try/except: {e}"
        )

    return list(permissions)


def resolve_object_shared_with(instance: Any, info: Any) -> list[dict[str, Any]]:
    """Port of ``AnnotatePermissionsForReadMixin.resolve_object_shared_with``.

    NOTE: the graphene implementation looked up
    ``permission_annotations.get("this_model_permission_id_map", {})`` on the
    *outer* per-model map (keyed by ``app.model``), so the id→codename map was
    always empty and any actually-shared object raised ``KeyError`` inside the
    loop. That quirk is preserved deliberately — fixing it here would change
    observable API behaviour relative to the graphene baseline.
    """
    values: list[dict[str, Any]] = []
    anon_id = get_anonymous_user_id(info)
    context = info.context

    if context is not None and hasattr(context, "user"):
        user = context.user
        if anon_id is not None and user.id == anon_id:
            return []

    model_name = instance._meta.model_name
    if not hasattr(instance, f"{model_name}userobjectpermission_set"):
        return []

    try:
        # Ensure the per-model annotation exists (the graphene middleware
        # populated it for every resolved model field).
        _annotations_for_model(info, instance)
        permission_annotations = context.permission_annotations
        this_model_permission_id_map = permission_annotations.get(
            "this_model_permission_id_map", {}
        )
        user_permission_map: dict[int, dict[str, Any]] = {}
        this_user_perms = getattr(instance, f"{model_n
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2200** (2026-07-25): **Deep research report double-renders and cite spans self-quote (regression from citation fixes)**
  *Symptoms*: ## Regression introduced by the citation-pipeline fixes (#2192/#2193)  Verified on a post-merge run (ResearchReport 8, same 192-doc SEC corpus/task used to validate #2180–#2189):  1. **The composed report renders twice.** `## Executive Summary` appears 2×: the full report is emitted first with inline `<cite ids="...">` spans, then — after a stub `## Sources` line reading "(All claims above are cited inline...)" — the ENTIRE report renders again in footnote form with `<...>` bracket markers and a real footnote table. Reads like an intermediate representation escaping into the final document.  2. **Cite spans self-quote.** Every `<cite ids="...">...</cite>` span's inner text is a verbatim copy of the claim sentence it decorates — not source text. This is what re-doubles each bullet inside the first rendering (the successor of the old #2183 sentence-doubling), and it means the quotation-verification path from #2193 has nothing real to check against the cited annotations.  Predecessor issue #2183 is closed; this is the new shape of the problem after the fix. Fix direction: emit exactly one rendering (the footnote form), and make the cite-span content either empty (pure marker) or actual quoted source text that #2193's guard then verifies. 

- **Issue #2189** (2026-07-24): **Deep research fabricates quotations when steered to quote cited passages**
  *Symptoms*: ## Problem — severity above the other deep-research citation issues  When steered to quote the passages it cites ("every footnote must anchor the exact passage — quote that passage"), the deep-research agent produced **fabricated quotations**: quotation-marked strings that do not occur anywhere in the corpus, attached to real (and even well-placed) annotation anchors.  Live evidence (ResearchReport 6, 192-doc SEC corpus): exact-substring search across every document's text layer for the report's six quoted strings returned **0 matches for all six**, e.g.:  - "Prices for these raw materials can be volatile" — 0 docs - "We do not generally hedge our raw material purchases" — 0 docs - "On fixed-price contracts, we take the risk of cost overruns, **including those due to increases in raw material costs**" — 0 docs (real text: "when we enter into fixed-price contracts with some of our customers, we take the risk of cost overruns" — the tail is invented) - "We are subject to risks from changes in U.S. and foreign government trade policies, including **tariffs, quotas**..." — 0 docs  The same run followed the other citation rules well (no header anchors, no forced cite on prompt-derived background, MAE clause pinned exactly) — which makes the fabricated quotes MORE dangerous: the report *looks* rigorously cited.  Baseline: the previous run (ResearchReport 4) with no quote-steering paraphrased honestly and fabricated nothing. So the failure is specifically "quote on demand" → synthes
  **Post-Mortem & Fix Analysis**:
  > Fix verification (post-merge run on the same corpus/task, ResearchReport 8): **works for its target** — the report contains zero quotation-marked source strings and nothing fabricated-as-quote; the run-6 failure mode is gone. Residual channel to be aware of: over-attributed *paraphrase* — e.g. the fixed-price claim gains the tail 'including increased prices for raw materials such as aluminum and copper', which no filing says, presented under 'filings confirm'. The verbatim guard can't see unquoted text, so the fabrication pressure moved into paraphrase. Possibly worth a claim-support check at finalize (does the cited span's context entail the sentence?), which would also address the anchor-reuse residue noted on #2180.

- **Issue #2183** (2026-07-24): **Deep research report duplicates every finding sentence**
  *Symptoms*: ## Problem  Deep-research report prose duplicates nearly every substantive sentence: each bullet renders the finding text immediately followed by a restatement of the same sentence (the citation-carrying variant), e.g.:  > ...vulnerable to tariff-driven price increases.TCFIII SPACECO HOLDINGS LLC's S-1 filing discloses that its primary raw materials include metals and alloys such as aluminum and copper, which directly connects...[^2][^3]  Observed throughout ResearchReport 4 (all five sections affected; note also the missing space at the join). Looks like the composer concatenates `finding.summary` + `finding.cited_text` (or the salvage/finalize path stitches both fields) without deduplication.  ## Why it matters  Doubles report length, reads as a bug, and buries the citations.  ## Suggested direction  Inspect the report-composition path in `opencontractserver/tasks/research_tasks.py` (finalize/salvage composition from recorded findings) and render one sentence per finding — the cited variant — or dedupe near-identical adjacent sentences at composition time. 
  **Post-Mortem & Fix Analysis**:
  > Post-fix regression check (ResearchReport 8): sentence-level duplication is replaced by something larger — the composed report now contains the ENTIRE report twice ('## Executive Summary' appears 2x): first rendering with inline <cite ids="..."> spans, then a second full rendering in footnote form with <...> brackets, concatenated after a '## Sources' stub. Also: every <cite> span's inner text is a verbatim copy of its own claim sentence (self-citation), which is what doubles each bullet in the first rendering. Looks like the new cite-span pipeline emits an intermediate rendering plus the final one.

- **Issue #2182** (2026-07-24): **Deep research forces corpus anchors onto prompt-derived claims**
  *Symptoms*: ## Problem  Claims derived from the research **prompt/task description** (not from corpus documents) get decorated with weak corpus anchors instead of being left uncited.  Observed (ResearchReport 4): the "Event Overview" section — facts about a July 20, 2026 tariff proclamation, supplied entirely by the research prompt — is footnoted to a `"Sanctions"` representation inside an unrelated underwriting-agreement exhibit dated *before* the event. The anchor cannot support the sentence; it appears the agent felt obliged to attach some retrieved annotation to every finding.  ## Why it matters  One unsupportive footnote poisons trust in the other six. Uncited context is honest; miscited context is not.  ## Suggested direction  - Agent instruction: findings that restate the task/event context should carry **no** citation; citations are only for claims grounded in retrieved passages. - Optionally, `record_finding` could accept an explicit `source: task_context` marker so the composer renders these as uncited background rather than forcing a footnote. 
  **Post-Mortem & Fix Analysis**:
  > Fix verification (ResearchReport 8): **partial**. The pure salvage-monologue and 'Sanctions'-style dead anchor are gone, but the Event-and-Relevance sentence — whose facts come entirely from the task prompt — is still cite-decorated ([^1][^2] aluminum/copper mentions + [^3], an entity-name span in an unrelated underwriting exhibit). The blended phrasing ('event creates risks for the company, given its supply chains') makes it slip the background/uncited rule.

- **Issue #1873** (2026-06-20): **Investigate: South-Carolina corpus import produced no extracted text layer (get_document_text returns total_chars=0)**
  *Symptoms*: ## Summary  Every document in the public **South-Carolina** corpus returns an empty text layer via the MCP `get_document_text` tool (`total_chars: 0`, `text: ""`) even though the documents have annotations, embeddings, and surface correctly in `search_corpus`. This is **isolated to the South-Carolina corpus** — all other public corpuses return substantial text. The fix is not in application code (the read path is correct); the corpus needs (re-)ingestion / text extraction, and we should understand why the import skipped it.  ## Evidence (live MCP, 2026-05-31)  `get_document_text` first-doc sample per public corpus:  | Corpus | total_chars | result | |---|---|---| | DGCL-New | 807,814 | ✅ | | No-24-413 (Dept of Education) | 4,345 / 14,123 / 136,790 | ✅ | | No-25-332 (Trump v. Slaughter) | 21,297 / 59,690 / 168,169 | ✅ | | New-Import-5 (SpaceX S-1) | 1,608,674 | ✅ | | **South-Carolina** | **0** (every doc) | ❌ |  Confirmed corpus-wide for SC: sampled regulations chapters and Code-of-Laws titles at offsets 0 and 600 — all `total_chars=0`, across page counts 4–153. Meanwhile the same SC docs return 72+ annotations and rank in semantic search, so embeddings + annotations were created but the **flat extracted-text artifact (`Document.txt_extract_file`) was not** (or is empty).  `get_document_text` (`opencontractserver/mcp/tools.py:167-178`) reads `document.txt_extract_file`; an empty/absent file yields `total_chars=0`. The tool is behaving correctly — this is an **ingest/data** gap
  **Post-Mortem & Fix Analysis**:
  > Long since resolved 

- **Issue #1872** (2026-06-01): **Production: agent-discovery endpoints (/llms.txt, /llms-full.txt, /.well-known/mcp.json) shadowed by SPA shell**
  *Symptoms*: ## Summary  On the live deployment (`https://cite.opensource.legal`), the agent-discovery endpoints all return the **React SPA `index.html` shell** instead of the Django discovery views. This breaks automated MCP/LLM discovery — an agent that follows the advertised breadcrumbs gets HTML, not instructions.  ## Evidence (live, 2026-05-31)  | Endpoint | Expected | Actual | |---|---|---| | `/llms.txt` | LLM instructions (text/plain) | `index.html` — **7998 bytes** | | `/llms-full.txt` | Full tool reference | `index.html` — **7998 bytes** | | `/.well-known/mcp.json` | MCP server discovery JSON | `index.html` — **7998 bytes** |  All three are **byte-identical** to `GET /` (7998 bytes).  ``` $ curl -s https://cite.opensource.legal/ | wc -c            # 7998 $ curl -s https://cite.opensource.legal/llms.txt | wc -c     # 7998 $ curl -s https://cite.opensource.legal/.well-known/mcp.json | wc -c  # 7998 ```  The served `index.html` itself advertises these links: ```html <link rel="alternate" type="text/plain" href="/llms.txt" ...> <link rel="alternate" type="application/json" href="/.well-known/mcp.json" ...> ``` plus a schema.org `ConsumeAction` pointing at `/mcp/`. So an agent follows the pointer and lands on HTML.  ## Scope / what works  - The Django backend discovery views are **healthy and deployed** — `GET /api/search/?q=contract` returns real backend JSON. - The MCP JSON-RPC endpoint `POST /mcp/` works correctly (initialize, tools/list, tool calls all fine). - So this is **not** 
  **Post-Mortem & Fix Analysis**:
  > Agent-discovery via `/llms.txt` and `/.well-known/ai-plugin.json` is becoming essential for legal AI tools — great to see `cite` thinking about this.  **From building a legal AI workspace with MCP orchestration:**  The `/llms.txt` format is still settling, but for legal platforms, I'd suggest extending it with:  1. **Jurisdiction coverage metadata** — `cite` handles multiple US state corpora. The discovery doc should declare which jurisdictions are available so agents can route queries correctly. Something like:    ```    ## Available Corpora    - South Carolina ( statutes, case_law )    - [more states...]    ```  2. **Citation format declaration** — Let agents know what citation style the platform returns (Bluebook, neutral citation, etc.) so they can present results correctly.  3. **Rate limits and attribution** — Legal data providers often require attribution. Including this in `llms.txt` helps agent builders comply automatically.  **For the `.well-known/mcp` endpoint:** If you're e
  > Confirmed: this is a deployment/routing issue, not a backend bug.  The discovery views are correct and live — Django serves all of these at the application root: `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/.well-known/mcp.json`, and `/.well-known/oauth-protected-resource` (including the path-based variant).  When any of them returns the SPA `index.html` shell, it means the request is being intercepted by the frontend/SPA catch-all before it reaches the Django backend — so there is nothing to fix in `opencontractserver/discovery/`.  The resolution belongs in the deployment's routing layer: a production deployment must explicitly route these root-level paths to the Django backend (the same way `/api/`, `/graphql/`, and `/mcp/` are routed) rather than letting them fall through to the SPA fallback. Once routed correctly, the acceptance checks (`text/plain` for `/llms.txt`, `application/json` with `mcpServers` for `/.well-known/mcp.json`) pass with no application change.
  > see above (deploy fix for demo inbound)

- **Issue #1594** (2026-05-09): **Security: corpus-less ModerationAction objects bypass authorization in resolve_moderation_action**
  *Symptoms*: ## Summary  `ConversationQueryMixin.resolve_moderation_action` in `config/graphql/conversation_queries.py` does not authorize access to `ModerationAction` records that are not associated with a corpus.  ## Location  `config/graphql/conversation_queries.py` — `resolve_moderation_action` (around lines 466–505)  ```python @login_required def resolve_moderation_action(self, info, id) -> Any:     user = info.context.user     pk = from_global_id(id)[1]      try:         action = ModerationAction.objects.select_related(             "conversation",             "conversation__chat_with_corpus",             "message",             "moderator",         ).get(pk=pk)          if not user.is_superuser:             corpus = (                 action.conversation.chat_with_corpus                 if action.conversation                 else None             )             if corpus:                 is_owner = corpus.creator == user                 is_moderator = corpus.moderators.filter(user=user).exists()                 if not is_owner and not is_moderator:                     return None          return action  # ← reached when corpus is None for any authenticated non-superuser     except ModerationAction.DoesNotExist:         return None ```  ## Issue  When a `ModerationAction` has no associated corpus (e.g., the action's conversation has `chat_with_corpus = None`, or the action has no conversation at all), the `if corpus:` guard is skipped and the action is returned to **any authenticated us
  **Post-Mortem & Fix Analysis**:
  > ## 🔧 Solution Proposal  I've analyzed this issue and developed a complete solution. Here's the summary:   --- 📄 **Full solution document:** See attached analysis ⏱️ **Estimated effort:** ~2-3 hours 🔒 **Security impact:** None  I'm available to implement this fix. Please let me know if you'd like me to submit a PR.

- **Issue #1515** (2026-05-04): **PipelineSettings.get_parser_kwargs does not merge encrypted_secrets into parser kwargs**
  *Symptoms*: ## Summary  `PipelineSettings.get_parser_kwargs()` (`opencontractserver/documents/models.py:1260`) returns `parser_kwargs[parser_class_path]` verbatim and never merges in the decrypted `encrypted_secrets`. Any parser whose API key/credential is stored only in `encrypted_secrets` (the documented secure location) is invoked with the placeholder value from `parser_kwargs` (commonly `api_key=""`) and fails.  This is both a correctness bug and a secure-by-design problem: the schema invites users to put secrets in `encrypted_secrets`, but the runtime path ignores them, pushing operators to copy plaintext secrets into `parser_kwargs` (stored unencrypted, returned by GraphQL, more likely to leak in logs).  ## Reproduction  `PipelineSettings` row with:  - `parser_kwargs["...LlamaParseParser"]["api_key"] = ""` - `get_secrets()["...LlamaParseParser"]["api_key"]` → real key (encrypted at rest)  Worker log (`opencontractserver.tasks.doc_tasks.ingest_doc`):  ``` Resolved parser kwargs for '...LlamaParseParser': {'api_key': '***', ..., 'extract_layout': True} LlamaParseParser - Parsing doc N ... with effective kwargs: {'api_key': '***', ...} ERROR LlamaParse API key not configured. Set LLAMAPARSE_API_KEY or LLAMA_CLOUD_API_KEY environment variable. DocumentParsingError: Parser LlamaParseParser returned None for document N ```  The `api_key='***'` line is misleading — `redact_sensitive_kwargs` masks the empty string the same way it would mask a real key. The parser receives empty `api_key`, 

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

### Incident Patch 1: `bd776e4c` (2026-09-24)
**Commit Message**: Merge pull request #2401 from Open-Source-Legal/claude/pr-2277-ci-cd-fix-kjchmh

Use identity checks for type comparisons; drop mutable default in run_post_processors

**File**: `changelog.d/2277-lint-type-identity.fixed.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+- **Mutable default argument in `run_post_processors`** (`opencontractserver/pipeline/utils.py::run_post_processors`): `input_kwargs` defaulted to a shared `{}` (ruff B006). It now defaults to `None` and is normalised per call, matching the sibling `run_enrichers`. No caller-visible behavior change; regression test in `test_pipeline_utils.py::test_run_post_processors_forwards_input_kwargs_per_call`.
+- **Type comparisons by identity in the tool schema builder** (`opencontractserver/llms/tools/tool_factory.py::CoreTool.parameters`): annotation → JSON-schema dispatch compared type objects with `==` (ruff E721); now uses `is`. Covered by `test_core_tool_factory.py::test_builtin_annotations_map_to_json_schema_types`. Originally proposed in #2277.
```

**File**: `opencontractserver/llms/tools/tool_factory.py` (modified, +5/-5)
```diff
@@ -180,15 +180,15 @@ def parameters(self) -> dict[str, Any]:
 
             # Try to infer type from annotation
             if param.annotation != inspect.Parameter.empty:
-                if param.annotation == int:
+                if param.annotation is int:
                     param_info["type"] = "integer"
-                elif param.annotation == float:
+                elif param.annotation is float:
                     param_info["type"] = "number"
-                elif param.annotation == bool:
+                elif param.annotation is bool:
                     param_info["type"] = "boolean"
-                elif param.annotation == list:
+                elif param.annotation is list:
                     param_info["type"] = "array"
-                elif param.annotation == dict:
+                elif param.annotation is dict:
                     param_info["type"] = "object"
 
             properties[param_name] = param_info
```

**File**: `opencontractserver/pipeline/utils.py` (modified, +5/-2)
```diff
@@ -444,7 +444,7 @@ def run_post_processors(
     processor_paths: list[str],
     zip_bytes: bytes,
     export_data: OpenContractsExportDataJsonPythonType,
-    input_kwargs: dict[str, Any] = {},
+    input_kwargs: Optional[dict[str, Any]] = None,
 ) -> tuple[bytes, OpenContractsExportDataJsonPythonType]:
     """
     Load and run post-processors in sequence.
@@ -453,6 +453,8 @@ def run_post_processors(
         processor_paths: List of fully qualified Python paths to post-processor classes
         zip_bytes: The raw bytes of the zip file being created
         export_data: The export data dictionary that will be serialized to data.json
+        input_kwargs: Optional kwargs forwarded to every post-processor's
+            ``process_export`` call.
 
     Returns:
         Tuple containing:
@@ -461,6 +463,7 @@ def run_post_processors(
     """
     current_zip_bytes = zip_bytes
     current_export_data = export_data
+    kwargs = input_kwargs or {}
 
     for path in processor_paths:
         try:
@@ -474,7 +477,7 @@ def run_post_processors(
             processor = processor_class()
             logger.info(f"Running post-processor: {processor.title}")
             current_zip_bytes, current_export_data = processor.process_export(
-                current_zip_bytes, current_export_data, **input_kwargs
+                current_zip_bytes, current_export_data, **kwargs
             )
             logger.debug(f"Completed post-processor: {processor.title}")
         except Exception as e:
```

**File**: `opencontractserver/tests/test_core_tool_factory.py` (modified, +30/-0)
```diff
@@ -95,6 +95,36 @@ def test_from_function_auto_metadata(self):
         # Required list should contain only the positional parameter ``a``
         self.assertListEqual(schema["required"], ["a"])
 
+    def test_builtin_annotations_map_to_json_schema_types(self):
+        """Each builtin annotation maps to its JSON-schema type; others default to string."""
+
+        def typed_function(
+            i: int,
+            f: float,
+            flag: bool,
+            items: list,
+            mapping: dict,
+            generic: list[str],
+            untyped,
+        ):
+            """Exercise every annotation branch."""
+
+        props = CoreTool.from_function(typed_function).parameters["properties"]
+        self.assertEqual(
+            {name: spec["type"] for name, spec in props.items()},
+            {
+                "i": "integer",
+                "f": "number",
+                "flag": "boolean",
+                "items": "array",
+                "mapping": "object",
+                # Parameterised generics are not the bare builtin and fall
+                # through to the default.
+                "generic": "string",
+                "untyped": "string",
+            },
+        )
+
     def test_missing_docstring_fallback_description(self):
         """If a function lacks a docstring the description should fall back to a generic value."""
         tool = CoreTool.from_function(function_without_docstring)
```

**File**: `opencontractserver/tests/test_pipeline_utils.py` (modified, +43/-0)
```diff
@@ -5,6 +5,7 @@
 import sys
 import unittest
 from typing import Any, ClassVar, cast
+from unittest.mock import patch
 
 from django.test import TestCase, override_settings
 
@@ -539,6 +540,48 @@ def test_run_post_processors(self):
                 cast(OpenContractsExportDataJsonPythonType, test_export_data),
             )
 
+    def test_run_post_processors_forwards_input_kwargs_per_call(self):
+        """
+        ``input_kwargs`` reach each post-processor, and the default is a fresh
+        empty mapping on every call rather than one shared mutable default.
+        """
+        from opencontractserver.pipeline.base.post_processor import (
+            BasePostProcessor,
+        )
+
+        received: list[dict[str, Any]] = []
+
+        class RecordingPostProcessor(BasePostProcessor):
+            title = "Recording PostProcessor"
+            description = "Records the kwargs it is called with."
+            author = "Test Author"
+            dependencies: ClassVar[list[str]] = []
+            supported_file_types: ClassVar[list[FileTypeEnum]] = [FileTypeEnum.PDF]
+
+            def _process_export_impl(self, zip_bytes, export_data, **all_kwargs):
+                received.append(dict(all_kwargs))
+                # Mutating the received kwargs must not reach the next call.
+                all_kwargs["leaked"] = True
+                return zip_bytes, export_data
+
+        self.assertIsNone(
+            inspect.signature(run_post_processors).parameters["input_kwargs"].default
+        )
+
+        export_data = cast(OpenContractsExportDataJsonPythonType, {})
+        with patch(
+            "opencontractserver.pipeline.utils.get_component_by_name",
+            return_value=RecordingPostProcessor,
+        ):
+            run_post_processors(
+                ["recording.Processor"], b"zip", export_data, {"redact": "yes"}
+            )
+            run_post_processors(["recording.Processor"], b"zip", export_data)
+
+        self.assertEqual(received[0].get("redact"), "yes")
+        self.assertNotIn("redact", received[1])
+        self.assertNotIn("leaked", received[1])
+
     def test_get_all_post_processors(self):
         """
         Test get_all_post_processors function to ensure it returns all post-processor classes.
```

---

### Incident Patch 2: `ee5aa548` (2026-09-23)
**Commit Message**: chore(deps): update openai requirement from <4,>=3.13.0 to >=3.16.2,<4

Updates the requirements on [openai](https://github.com/openai/openai-python) to permit the latest version.
- [Release notes](https://github.com/openai/openai-python/releases)
- [Changelog](https://github.com/openai/openai-python/blob/main/CHANGELOG.md)
- [Commits](https://github.com/openai/openai-python/compare/v3.13.0...v3.16.2)

---
updated-dependencies:
- dependency-name: openai
  dependency-version: 3.16.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `requirements/base.txt` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ drf-extra-fields==3.7.0  # https://github.com/Hipo/drf-extra-fields
 pypdf>=6.18.1,<7  # https://github.com/py-pdf/pypdf
 plasmapdf==0.1.3  # https://github.com/Jsv4/plasmapdf
 pdf2image>=1.17.0
-openai>=3.13.0,<4  # https://github.com/openai/openai-python (pydantic-ai 1.x requires >=2.11.0)
+openai>=3.16.2,<4  # https://github.com/openai/openai-python (pydantic-ai 1.x requires >=2.11.0)
 # Bumping pydantic-ai is a deliberate decision: this codebase relies on the
 # precedence rule that ``instructions=`` (not ``system_prompt=``) is the only
 # way to deliver a system instruction when ``message_history`` is non-empty
```

---

### Incident Patch 3: `254f685d` (2026-09-23)
**Commit Message**: chore(deps): update pypdf requirement from <7,>=6.18.1 to >=6.19.0,<7

Updates the requirements on [pypdf](https://github.com/py-pdf/pypdf) to permit the latest version.
- [Release notes](https://github.com/py-pdf/pypdf/releases)
- [Changelog](https://github.com/py-pdf/pypdf/blob/main/CHANGELOG.md)
- [Commits](https://github.com/py-pdf/pypdf/compare/6.18.1...6.19.0)

---
updated-dependencies:
- dependency-name: pypdf
  dependency-version: 6.19.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `requirements/base.txt` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ drf-extra-fields==3.7.0  # https://github.com/Hipo/drf-extra-fields
 
 # Doc Analysis (NLP dependencies, placeholder) - WARNING, these are all in same environment... not ideal.
 # ------------------------------------------------------------------------------
-pypdf>=6.18.1,<7  # https://github.com/py-pdf/pypdf
+pypdf>=6.19.0,<7  # https://github.com/py-pdf/pypdf
 plasmapdf==0.1.3  # https://github.com/Jsv4/plasmapdf
 pdf2image>=1.17.0
 openai>=3.13.0,<4  # https://github.com/openai/openai-python (pydantic-ai 1.x requires >=2.11.0)
```

---

### Incident Patch 4: `ef97ab14` (2026-09-23)
**Commit Message**: Merge pull request #2396 from Open-Source-Legal/dependabot/github_actions/docker/build-push-action-7.4.0

chore(deps): bump docker/build-push-action from 7.3.0 to 7.4.0

**File**: `.github/workflows/docker-build-release.yml` (modified, +2/-2)
```diff
@@ -102,7 +102,7 @@ jobs:
       # makes the contract explicit and resilient to future runner changes.
       - name: Build Django image (load locally for size budget gate)
         if: matrix.image == 'django'
-        uses: docker/build-push-action@v7.3.0
+        uses: docker/build-push-action@v7.4.0
         with:
           context: ${{ matrix.context }}
           file: ${{ matrix.dockerfile }}
@@ -162,7 +162,7 @@ jobs:
       # combined build-and-push path stays — no `load` involved.
       - name: Build and push non-Django image
         if: matrix.image != 'django'
-        uses: docker/build-push-action@v7.3.0
+        uses: docker/build-push-action@v7.4.0
         with:
           context: ${{ matrix.context }}
           file: ${{ matrix.dockerfile }}
```

**File**: `.github/workflows/production-release.yml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ jobs:
         df -h /
     - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069
     - name: Build image before authenticating to Google Cloud
-      uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a
+      uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc
       with:
         context: ${{ matrix.context }}
         file: ${{ matrix.dockerfile }}
```

---

### Incident Patch 5: `181d1a3a` (2026-09-23)
**Commit Message**: Merge pull request #2399 from Open-Source-Legal/dependabot/github_actions/docker/setup-buildx-action-4.4.1

chore(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1

**File**: `.github/workflows/backend.yml` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ jobs:
           echo "$ci_env"
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v4.3.0
+        uses: docker/setup-buildx-action@v4.4.1
 
       # Use the ghcr.io registry as the buildx layer-cache backend instead of
       # the GitHub Actions cache (``type=gha``). The registry cache is portable:
```

**File**: `.github/workflows/docker-build-release.yml` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ jobs:
           echo "short=$(git rev-parse --short=7 HEAD)" >> "$GITHUB_OUTPUT"
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v4.3.0
+        uses: docker/setup-buildx-action@v4.4.1
 
       - name: Log in to GitHub Container Registry
         uses: docker/login-action@v4.6.0
```

**File**: `.github/workflows/production-release.yml` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ jobs:
       run: |
         sudo rm -rf /usr/local/lib/android /usr/share/dotnet /opt/ghc /opt/hostedtoolcache/CodeQL
         df -h /
-    - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
+    - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069
     - name: Build image before authenticating to Google Cloud
       uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a
       with:
```

---

### Incident Patch 6: `20afdf09` (2026-09-21)
**Commit Message**: chore(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.3.0 to 4.4.1.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/v4.3.0...v4.4.1)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.4.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/backend.yml` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ jobs:
           echo "$ci_env"
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v4.3.0
+        uses: docker/setup-buildx-action@v4.4.1
 
       # Use the ghcr.io registry as the buildx layer-cache backend instead of
       # the GitHub Actions cache (``type=gha``). The registry cache is portable:
```

**File**: `.github/workflows/docker-build-release.yml` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ jobs:
           echo "short=$(git rev-parse --short=7 HEAD)" >> "$GITHUB_OUTPUT"
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v4.3.0
+        uses: docker/setup-buildx-action@v4.4.1
 
       - name: Log in to GitHub Container Registry
         uses: docker/login-action@v4.6.0
```

**File**: `.github/workflows/production-release.yml` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ jobs:
       run: |
         sudo rm -rf /usr/local/lib/android /usr/share/dotnet /opt/ghc /opt/hostedtoolcache/CodeQL
         df -h /
-    - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
+    - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069
     - name: Build image before authenticating to Google Cloud
       uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a
       with:
```

---

### Incident Patch 7: `8a1c98d7` (2026-09-18)
**Commit Message**: chore(deps): bump docker/build-push-action from 7.3.0 to 7.4.0

Bumps [docker/build-push-action](https://github.com/docker/build-push-action) from 7.3.0 to 7.4.0.
- [Release notes](https://github.com/docker/build-push-action/releases)
- [Commits](https://github.com/docker/build-push-action/compare/v7.3.0...v7.4.0)

---
updated-dependencies:
- dependency-name: docker/build-push-action
  dependency-version: 7.4.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/docker-build-release.yml` (modified, +2/-2)
```diff
@@ -102,7 +102,7 @@ jobs:
       # makes the contract explicit and resilient to future runner changes.
       - name: Build Django image (load locally for size budget gate)
         if: matrix.image == 'django'
-        uses: docker/build-push-action@v7.3.0
+        uses: docker/build-push-action@v7.4.0
         with:
           context: ${{ matrix.context }}
           file: ${{ matrix.dockerfile }}
@@ -162,7 +162,7 @@ jobs:
       # combined build-and-push path stays — no `load` involved.
       - name: Build and push non-Django image
         if: matrix.image != 'django'
-        uses: docker/build-push-action@v7.3.0
+        uses: docker/build-push-action@v7.4.0
         with:
           context: ${{ matrix.context }}
           file: ${{ matrix.dockerfile }}
```

**File**: `.github/workflows/production-release.yml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ jobs:
         df -h /
     - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
     - name: Build image before authenticating to Google Cloud
-      uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a
+      uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc
       with:
         context: ${{ matrix.context }}
         file: ${{ matrix.dockerfile }}
```

---

### Incident Patch 8: `18dbb894` (2026-09-17)
**Commit Message**: chore(deps): update pypdf requirement from <7,>=6.16.2 to >=6.18.1,<7

Updates the requirements on [pypdf](https://github.com/py-pdf/pypdf) to permit the latest version.
- [Release notes](https://github.com/py-pdf/pypdf/releases)
- [Changelog](https://github.com/py-pdf/pypdf/blob/main/CHANGELOG.md)
- [Commits](https://github.com/py-pdf/pypdf/compare/6.16.2...6.18.1)

---
updated-dependencies:
- dependency-name: pypdf
  dependency-version: 6.18.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `requirements/base.txt` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ drf-extra-fields==3.7.0  # https://github.com/Hipo/drf-extra-fields
 
 # Doc Analysis (NLP dependencies, placeholder) - WARNING, these are all in same environment... not ideal.
 # ------------------------------------------------------------------------------
-pypdf>=6.16.2,<7  # https://github.com/py-pdf/pypdf
+pypdf>=6.18.1,<7  # https://github.com/py-pdf/pypdf
 plasmapdf==0.1.3  # https://github.com/Jsv4/plasmapdf
 pdf2image>=1.17.0
 openai>=3.13.0,<4  # https://github.com/openai/openai-python (pydantic-ai 1.x requires >=2.11.0)
```

---

### Incident Patch 9: `439e898d` (2026-09-17)
**Commit Message**: Merge pull request #2390 from Open-Source-Legal/fix/self-service-automation-tokens

Allow self-service automation tokens without cross-user issuance

**File**: `changelog.d/self-service-automation-tokens.security.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Automation credential minting and rotation now issue tokens only for the signed-in account, including for administrators. Non-admins can manage their own tokens with explicit scopes and corpuses they created; global admin scopes and unrestricted corpus access remain unavailable. Administrators retain credential inspection and revocation oversight.
```

**File**: `config/graphql/automation_credential_api.py` (modified, +5/-5)
```diff
@@ -1,4 +1,4 @@
-"""Admin-only credential DTOs; no model/Node or secret-hash traversal."""
+"""Credential management DTOs; no model/Node or secret-hash traversal."""
 
 from contextlib import contextmanager
 from datetime import datetime
@@ -102,8 +102,8 @@ def q_credential(info: strawberry.Info, id: UUID) -> AutomationCredentialMetadat
 
 
 def q_scopes(info: strawberry.Info) -> list[str]:
-    with _management(info):
-        return [scope.value for scope in credentials.Scope]
+    with _management(info) as actor:
+        return credentials.management_scopes(actor)
 
 
 def q_choices(
@@ -128,15 +128,15 @@ def q_choices(
 
 def m_mint(
     info: strawberry.Info,
-    user_id: strawberry.ID,
     name: str,
     scopes: list[str],
+    user_id: strawberry.ID | None = None,
     corpus_ids: list[strawberry.ID] | None = None,
     all_corpuses: bool = False,
     expires_days: int = AUTOMATION_CREDENTIAL_DEFAULT_DAYS,
 ) -> AutomationCredentialSecret:
     with _management(info) as actor:
-        credential, token = credentials.mint_for_admin(
+        credential, token = credentials.mint_for_user(
             actor,
             user_id=user_id,
             name=name,
```

**File**: `config/graphql/schema.graphql` (modified, +1/-1)
```diff
@@ -8216,7 +8216,7 @@ enum LabelType {
 }
 
 type Mutation {
-  mintAutomationCredential(userId: ID!, name: String!, scopes: [String!]!, corpusIds: [ID!] = null, allCorpuses: Boolean! = false, expiresDays: Int! = 30): AutomationCredentialSecret!
+  mintAutomationCredential(name: String!, scopes: [String!]!, userId: ID = null, corpusIds: [ID!] = null, allCorpuses: Boolean! = false, expiresDays: Int! = 30): AutomationCredentialSecret!
   rotateAutomationCredential(id: UUID!): AutomationCredentialSecret!
   revokeAutomationCredential(id: UUID!): AutomationCredentialMetadata!
   """Create a new agent configuration (admin/corpus owner only)."""
```

**File**: `docs/guides/automation-credentials.md` (modified, +28/-11)
```diff
@@ -10,12 +10,22 @@ endpoints; those retain their existing authentication contracts.
 
 ## Provision and manage
 
-Active superusers can use **Admin Settings → Automation Credentials**
-(`/admin/automation-credentials`) to list, inspect, mint, rotate and revoke
-credentials, including ones created by the CLI. Search for an existing active
-principal by name or stable user ID, choose explicit scopes and corpuses (or
-explicitly allow all corpuses), and set a positive lifetime (default: 30 days).
-The scope picker and CLI use the same server-side `Scope` catalog.
+Active users can use **Automation Credentials** in their user menu
+(`/automation-credentials`) to mint, inspect, rotate and revoke their own
+credentials, including ones created by the CLI. Tokens always belong to the
+signed-in account; admins cannot mint or rotate tokens for someone else.
+
+Non-admins must select one or more corpuses they created. Shared and public
+corpuses owned by others are excluded, and only `corpus:read`,
+`corpus:configure`, `corpus:publish`, `document:import` and `ingestion:repair`
+are offered. Unrestricted corpus access, corpus creation and global admin
+scopes are unavailable. Normal operation permissions still apply.
+
+Superusers retain all scopes and may select any corpuses or explicitly allow
+all corpuses for their own tokens. They can also list, inspect and revoke other
+users' credentials for oversight. **Admin Settings → Automation Credentials**
+and the old `/admin/automation-credentials` URL lead to the same page.
+All UI-issued credentials have a positive lifetime (default: 30 days).
 
 Mint/rotate show the token in a one-time copy/dismiss dialog. Dismissing,
 leaving the page or signing out clears it; it is not written to Apollo cache,
@@ -25,12 +35,16 @@ Rotation and revocation require confirmation in the credential detail dialog.
 The authenticated GraphQL API exposes `automationCredentials(limit:, offset:)`,
 `automationCredential(id:)`, `automationCredentialScopes` and the paginated
 `automationCredentialChoices(kind:, search:, limit:, offset:)` selector
-(`kind` is `principal` or `corpus`). Pages default to 20 and are capped at 100.
+(`kind: "corpus"` is filtered to the caller’s permitted choices; the legacy
+`kind: "principal"` selector returns only the caller). Pages default to 20
+and are capped at 100.
 Writes are `mintAutomationCredential`, `rotateAutomationCredential` and
 `revokeAutomationCredential`; only mint/rotate return a `token`. Credential IDs
-are UUIDs; principal and corpus IDs are stable database IDs. These operations
-require an active superuser login; **automation tokens cannot manage credentials**,
-even when their principal is a superuser. Management responses use `no-store`.
+are UUIDs; principal and corpus IDs are stable database IDs. Mint binds the
+caller automatically. Its optional legacy `userId` argument is accepted only
+when it matches that caller's database ID. These operations require an active
+interactive login; **automation tokens cannot manage credentials**, even when
+their principal is a superuser. Management responses use `no-store`.
 
 An operator with access to `manage.py` can bind a credential to an **existing
 active user**. Choose a dedicated service user and grant its corpus permissions
@@ -54,7 +68,7 @@ and rotate emit JSON containing a new `token` exactly once. Store it securely;
 inspect returns metadata only, never the token or its hash. Only SHA-256 hashes
 of random 256-bit secrets are persisted. Audit events identify credentials and
 actors by ID, without authorization headers or secret prefixes. Lifecycle audit
-events record the acting administrator as `actor_id` separately from the bound
+events record the signed-in user as `actor_id` separately from the bound
 `principal_id`; CLI operations have no application actor (`actor_id=None`).
 
 ## Capability boundaries
@@ -154,6 +168,9 @@ expiry and deactivation reject subsequent requests. Rotation atomically replaces
 the secret without changing the credential ID, scopes, corpus restrictions or
 expiry. The old secret stops authenticating immediately after commit. Rotation
 cannot revive an expired or revoked credential; mint a new one instead.
+Interactive rotation also rechecks the caller's current role and corpus
+ownership. If a previous admin or CLI credential exceeds a non-admin's current
+self-service limits, they can revoke it and mint a restricted replacement.
 
 Chunked uploads belong to both the actor and credential ID. Only that credential
 (including its rotated secret) can send parts, inspect status or complete the
```

**File**: `frontend/src/App.tsx` (modified, +4/-0)
```diff
@@ -370,6 +370,10 @@ export const App = () => {
           <Route path="/admin/settings" element={<GlobalSettingsPanel />} />
           <Route
             path="/admin/automation-credentials"
+            element={<Navigate to="/automation-credentials" replace />}
+          />
+          <Route
+            path="/automation-credentials"
             element={<AutomationCredentialManagement />}
           />
           <Route path="/admin/agents" element={<GlobalAgentManagement />} />
```

**File**: `frontend/src/components/admin/AutomationCredentialManagement.test.tsx` (modified, +62/-14)
```diff
@@ -21,7 +21,11 @@ import { backendUserObj } from "../../graphql/cache";
 import { AutomationCredentialManagement } from "./AutomationCredentialManagement";
 import { GlobalSettingsPanel } from "./GlobalSettingsPanel";
 
-const admin = { id: "1", email: "admin@example.test", isSuperuser: true };
+const admin = {
+  id: btoa("UserType:7"),
+  email: "admin@example.test",
+  isSuperuser: true,
+};
 const cliCredential = {
   id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
   name: "CLI importer",
@@ -41,6 +45,7 @@ function setup({
   failMutation = false,
   failRotate = false,
   detailStatus = "active",
+  ownerId = "7",
 } = {}) {
   let revoked = false;
   const requests = vi.fn((operation: Operation) => {
@@ -68,6 +73,7 @@ function setup({
         return {
           automationCredential: {
             ...cliCredential,
+            userId: ownerId,
             status: revoked ? "revoked" : detailStatus,
           },
         };
@@ -135,9 +141,6 @@ function setup({
 
 async function fillMint() {
   await userEvent.click(screen.getByRole("button", { name: "New credential" }));
-  await userEvent.click(
-    await screen.findByRole("radio", { name: "service (ID 7)" })
-  );
   await userEvent.type(screen.getByLabelText("Name"), "Nightly import");
   await userEvent.click(
     await screen.findByRole("checkbox", { name: "corpus:read" })
@@ -162,14 +165,14 @@ afterEach(() => {
   vi.restoreAllMocks();
 });
 
-describe("Automation credential administration", () => {
+describe("Automation credential management", () => {
   it("links the page from admin settings", async () => {
     render(
       <MemoryRouter>
         <Routes>
           <Route path="/" element={<GlobalSettingsPanel />} />
           <Route
-            path="/admin/automation-credentials"
+            path="/automation-credentials"
             element={<p>Credential management destination</p>}
           />
         </Routes>
@@ -181,24 +184,70 @@ describe("Automation credential administration", () => {
     expect(screen.getByText("Credential management destination")).toBeVisible();
   });
 
-  it("does not load management data for anonymous or non-superuser visitors", () => {
+  it("does not load management data for anonymous visitors", () => {
     backendUserObj(null);
     const { requests } = setup();
-    expect(screen.getByRole("alert")).toHaveTextContent(
-      "superuser login is required"
-    );
-    act(() => {
-      backendUserObj({ ...admin, isSuperuser: false });
-    });
+    expect(screen.getByRole("alert")).toHaveTextContent("login is required");
     expect(
       screen.queryByRole("button", { name: "New credential" })
     ).not.toBeInTheDocument();
     expect(requests).not.toHaveBeenCalled();
   });
 
+  it("lets regular users mint for their account without admin controls", async () => {
+    backendUserObj({ ...admin, isSuperuser: false });
+    const { requests } = setup();
+    await fillMint();
+    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
+    expect(
+      screen.queryByText("Allow all corpuses (including future corpuses)")
+    ).not.toBeInTheDocument();
+    expect(
+      screen.queryByRole("link", { name: "Back to admin settings" })
+    ).not.toBeInTheDocument();
+    await userEvent.click(
+      screen.getByRole("button", { name: "Mint credential" })
+    );
+    expect(await screen.findByText(issuedToken)).toBeVisible();
+    expect(
+      requests.mock.calls.find(
+        ([op]) => op.operationName === "MintAutomationCredential"
+      )?.[0].variables
+    ).toEqual({
+      name: "Nightly import",
+      scopes: ["corpus:read"],
+      corpusIds: ["42"],
+      allCorpuses: false,
+      expiresDays: 30,
+    });
+  });
+
+  it("lets admins revoke another user's credential without offering rotation", async () => {
+    setup({ ownerId: "8" });
+    await userEvent.click(
+      await screen.findByRole("button", { name: "Inspect CLI importer" })
+    );
+    const dialog = await screen.findByRole("dialog");
+    expect(
+      within(dialog).queryByRole("button", { name: "Rotate" })
+    ).not.toBeInTheDocument();
+    await userEvent.click(
+      within(dialog).getByRole("button", { name: "Revoke" })
+    );
+    await userEvent.click(
+      within(dialog).getByRole("button", { name: "Confirm revoke" })
+    );
+    expect(await screen.findByText("revoked")).toBeVisible();
+    expect(screen.queryByText(issuedToken)).not.toBeInTheDocument();
+  });
+
   it("requires explicit inputs and keeps a minted token only until dismissed", async () => {
     const { requests, client, unmount } = setup();
     await fillMint();
+    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
+    expect(
+      requests.mock.calls.some(([op]) => op.variables.kind === "principal")
+    ).toBe(false);
     const mint = screen.getByRole("button", { name: "Mint credential" });
     const days = screen.getByLabelText("Expires in days");
     expect(days).toHaveValue(30);
@@ -227,7 +276,
```

**File**: `frontend/src/components/admin/AutomationCredentialManagement.tsx` (modified, +47/-44)
```diff
@@ -21,6 +21,7 @@ import {
   TABLET_BREAKPOINT,
 } from "../../assets/configurations/constants";
 import { backendUserObj } from "../../graphql/cache";
+import { decodeRelayPk } from "../../utils/userDisplay";
 import {
   AutomationCredential,
   GET_AUTOMATION_CREDENTIALS,
@@ -112,11 +113,9 @@ function PageButtons({
 }
 
 function ChoicePicker({
-  kind,
   selected,
   onChange,
 }: {
-  kind: "principal" | "corpus";
   selected: Choice[];
   onChange: (choices: Choice[]) => void;
 }) {
@@ -125,17 +124,15 @@ function ChoicePicker({
   const { data, loading, error } = useQuery<{
     automationCredentialChoices: ChoicePage;
   }>(GET_AUTOMATION_CHOICES, {
-    variables: { kind, search, offset },
+    variables: { kind: "corpus", search, offset },
     fetchPolicy: "no-cache",
   });
   const page = data?.automationCredentialChoices;
   return (
     <fieldset>
-      <legend>
-        {kind === "principal" ? "Active principal" : "Allowed corpuses"}
-      </legend>
+      <legend>Allowed corpuses</legend>
       <Input
-        aria-label={`Search ${kind}`}
+        aria-label="Search corpus"
         placeholder="Search by name or ID"
         value={search}
         onChange={(e) => {
@@ -153,14 +150,12 @@ function ChoicePicker({
       {page?.items.map((choice) => (
         <label key={choice.id}>
           <input
-            type={kind === "principal" ? "radio" : "checkbox"}
-            name={kind}
+            type="checkbox"
+            name="corpus"
             checked={selected.some((c) => c.id === choice.id)}
             onChange={(e) =>
               onChange(
-                kind === "principal"
-                  ? [choice]
-                  : e.target.checked
+                e.target.checked
                   ? [...selected, choice]
                   : selected.filter((c) => c.id !== choice.id)
               )
@@ -183,12 +178,13 @@ function ChoicePicker({
 
 function MintForm({
   busy,
+  isSuperuser,
   onMint,
 }: {
   busy: boolean;
+  isSuperuser: boolean;
   onMint: (variables: Record<string, unknown>) => void;
 }) {
-  const [principal, setPrincipal] = useState<Choice[]>([]);
   const [corpuses, setCorpuses] = useState<Choice[]>([]);
   const [name, setName] = useState("");
   const [scopes, setScopes] = useState<string[]>([]);
@@ -199,7 +195,6 @@ function MintForm({
     { fetchPolicy: "no-cache" }
   );
   const valid =
-    principal.length === 1 &&
     name.trim() &&
     scopes.length > 0 &&
     (allCorpuses || corpuses.length > 0) &&
@@ -211,7 +206,6 @@ function MintForm({
         e.preventDefault();
         if (valid && !busy)
           onMint({
-            userId: principal[0].id,
             name,
             scopes,
             corpusIds: allCorpuses ? null : corpuses.map((c) => c.id),
@@ -220,11 +214,7 @@ function MintForm({
           });
       }}
     >
-      <ChoicePicker
-        kind="principal"
-        selected={principal}
-        onChange={setPrincipal}
-      />
+      <p>This credential will use your account’s permissions.</p>
       <FormField>
         <label htmlFor="credential-name">Name</label>
         <Input
@@ -255,20 +245,20 @@ function MintForm({
           </label>
         ))}
       </fieldset>
-      <label>
-        <input
-          type="checkbox"
-          checked={allCorpuses}
-          onChange={(e) => setAllCorpuses(e.target.checked)}
-        />
-        Allow all corpuses (including future corpuses)
-      </label>
+      {isSuperuser ? (
+        <label>
+          <input
+            type="checkbox"
+            checked={allCorpuses}
+            onChange={(e) => setAllCorpuses(e.target.checked)}
+          />
+          Allow all corpuses (including future corpuses)
+        </label>
+      ) : (
+        <p>Select one or more corpuses you created.</p>
+      )}
       {!allCorpuses && (
-        <ChoicePicker
-          kind="corpus"
-          selected={corpuses}
-          onChange={setCorpuses}
-        />
+        <ChoicePicker selected={corpuses} onChange={setCorpuses} />
       )}
       <FormField>
         <label htmlFor="credential-days">Expires in days</label>
@@ -289,7 +279,13 @@ function MintForm({
   );
 }
 
-function CredentialAdmin() {
+function CredentialManager({
+  userId,
+  isSuperuser,
+}: {
+  userId: string;
+  isSuperuser: boolean;
+}) {
   const client = useApolloClient();
   const [offset, setOffset] = useState(0);
   const [showMint, setShowMint] = useState(false);
@@ -378,7 +374,7 @@ function CredentialAdmin() {
 
   return (
     <Container>
-      <Link to="/admin/settings">Back to admin settings</Link>
+      {isSuperuser && <Link to="/admin/settings">Back to admin settings</Link>}
       <h1>Automation credentials</h1>
       <p>
         Access is limited by scopes, corpus restrictions and the principal’s
@@ -394,6 +390,7 @@ function CredentialAdmin() {
         <CardSegment>
           <MintForm
             busy={busy}
+            isSuperuser={isSuperuser}
             onMi
```

**File**: `frontend/src/components/admin/GlobalSettingsPanel.tsx` (modified, +2/-2)
```diff
@@ -227,10 +227,10 @@ const settingsItems: SettingItem[] = [
     id: "automation-credentials",
     title: "Automation Credentials",
     description:
-      "Mint, inspect, rotate and revoke scoped credentials for existing users.",
+      "Create credentials for your account and oversee credential revocation.",
     icon: KeyRound,
     gradient: `linear-gradient(135deg, ${OS_LEGAL_COLORS.accent} 0%, ${OS_LEGAL_COLORS.accentHover} 100%)`,
-    route: "/admin/automation-credentials",
+    route: "/automation-credentials",
   },
   {
     id: "badges",
```

---

### Incident Patch 10: `5281661d` (2026-09-16)
**Commit Message**: Merge pull request #2380 from Open-Source-Legal/fix/codeql-exception-exposure

Prevent exception detail exposure in worker and readiness APIs

**File**: `changelog.d/codeql-exception-exposure.security.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Prevent exception details from leaking through worker upload conflicts, ingestion-run responses and persisted policy failures, document readiness diagnostics, and authority-section validation (CodeQL alerts #90–#103). `utils/public_errors.py::PublicError` restricts domain errors to fixed public codes; `worker_uploads/serializers.py` logs section-validation details server-side and returns a generic HTTP 400 message.
```

**File**: `docs/upload_methods/worker_uploads.md` (modified, +10/-0)
```diff
@@ -54,6 +54,16 @@ queue:
 
 All endpoints require the `Authorization: WorkerKey <token>` header.
 
+Upload conflicts, ingestion-run policy failures, and readiness diagnostics expose
+allowlisted public codes via `utils/public_errors.py::PublicError.public_code`.
+Unrecognized domain exception messages become `upload_conflict`, `run_policy_error`,
+or `readiness_unavailable`; existing codes and HTTP statuses are preserved.
+Readiness responses use `document_processing_failed` for a nonempty
+`processing_error`, keeping saved parser exception details out of responses.
+Invalid authority-section specifications return HTTP 400 with
+`Invalid authority section specification.`; detailed validation exceptions are
+recorded only in server logs.
+
 ### Upload Request
 
 The upload is a `multipart/form-data` POST with two fields:
```

**File**: `opencontractserver/constants/readiness.py` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@
 
 DEFAULT_PAGE_SIZE = 20
 MAX_PAGE_SIZE = 100
-MAX_ERROR_LENGTH = 1000
 MAX_TEXT_BYTES = 16 * 1024 * 1024
 REPAIR_BATCH_SIZE = 100
 REPAIR_SOFT_TIME_LIMIT = 9 * 60
```

**File**: `opencontractserver/documents/readiness.py` (modified, +23/-7)
```diff
@@ -14,7 +14,6 @@
 
 from opencontractserver.annotations.models import Annotation
 from opencontractserver.constants.readiness import (
-    MAX_ERROR_LENGTH,
     MAX_TEXT_BYTES,
     REPAIR_TIMEOUT,
 )
@@ -36,13 +35,27 @@
     embedding_configuration,
     valid_embeddings,
 )
+from opencontractserver.utils.public_errors import PublicError
 
 logger = logging.getLogger(__name__)
 
 
-class ReadinessUnavailable(ValueError):
+class ReadinessUnavailable(PublicError):
     """An intentional, safe diagnostic code for readiness callers."""
 
+    default_code = "readiness_unavailable"
+    public_codes = frozenset(
+        {
+            "document_deleted",
+            "embedder_configuration_unavailable",
+            "embedder_unavailable",
+            "invalid_embedder",
+            "text_artifact_exceeds_status_limit",
+            "text_artifact_missing",
+            "unsupported_dimension",
+        }
+    )
+
 
 def effective_embedder(corpus=None, *, path=None):
     pipeline = PipelineSettings.get_instance(use_cache=False)
@@ -156,7 +169,9 @@ def assess_documents(documents, corpus):
     try:
         embedder = effective_embedder(corpus)
     except ReadinessUnavailable as exc:
-        return [unavailable(document, corpus, str(exc)) for document in documents]
+        return [
+            unavailable(document, corpus, exc.public_code) for document in documents
+        ]
     results = []
     for document in documents:
         try:
@@ -177,9 +192,10 @@ def assess_document(document, corpus=None, *, embedder=None):
         "generation": None,
         "reasons": [],
         "processing_status": document.processing_status,
-        "processing_error": " ".join(document.processing_error.split())[
-            :MAX_ERROR_LENGTH
-        ],
+        # Stored parser errors can contain paths, credentials and tracebacks.
+        "processing_error": (
+            "document_processing_failed" if document.processing_error else ""
+        ),
         "required_stages": [
             "parsing",
             "annotations",
@@ -261,7 +277,7 @@ def assess_document(document, corpus=None, *, embedder=None):
         )
         result["state"] = "unavailable"
         if isinstance(exc, ReadinessUnavailable):
-            reason = str(exc)
+            reason = exc.public_code
         elif isinstance(exc, FileNotFoundError):
             reason = "text_artifact_missing"
         elif isinstance(exc, UnicodeError):
```

**File**: `opencontractserver/tests/test_ingestion_readiness.py` (modified, +79/-3)
```diff
@@ -1,9 +1,11 @@
 """Readiness checks stored artifacts; repair reuses inference without parsing."""
 
+from collections.abc import Callable
 from concurrent.futures import ThreadPoolExecutor
 from pathlib import Path
 from tempfile import TemporaryDirectory
 from threading import Barrier, Event
+from typing import Any
 from unittest.mock import patch
 
 from django.contrib.auth import get_user_model
@@ -106,6 +108,82 @@ def repair(self, doc=None):
 
 
 class ReadinessTests(ReadinessFixtures, TestCase):
+    def readiness_requests(self) -> list[tuple[Callable[..., Any], str, int]]:
+        client = APIClient()
+        client.force_authenticate(self.user)
+        account = WorkerAccount.create_with_user(
+            name="diagnostic-worker", creator=self.user
+        )
+        token, key = CorpusAccessToken.create_token(
+            worker_account=account, corpus=self.corpus
+        )
+        receipt = WorkerDocumentUpload.objects.create(
+            corpus=self.corpus,
+            corpus_access_token=token,
+            worker_account=account,
+            result_document=self.doc,
+            status="COMPLETED",
+        )
+        worker = APIClient()
+        worker.credentials(HTTP_AUTHORIZATION=f"WorkerKey {key}")
+        return [
+            (client.get, f"/api/readiness/documents/{self.doc.pk}/", 200),
+            (client.post, f"/api/readiness/documents/{self.doc.pk}/", 202),
+            (client.get, f"/api/readiness/corpuses/{self.corpus.pk}/", 200),
+            (worker.get, f"/api/readiness/worker/{receipt.pk}/", 200),
+            (worker.post, f"/api/readiness/worker/{receipt.pk}/", 202),
+            (worker.get, "/api/readiness/worker/", 200),
+        ]
+
+    def test_readiness_endpoints_only_return_public_diagnostic_codes(self):
+        sensitive = "embedder credential=secret at /private/embedder.py:42"
+        cases = self.readiness_requests()
+        for failure_point in ("effective_embedder", "document_has_text"):
+            for message, code in (
+                (sensitive, "readiness_unavailable"),
+                ("embedder_unavailable", "embedder_unavailable"),
+            ):
+                with patch(
+                    f"opencontractserver.documents.readiness.{failure_point}",
+                    side_effect=ReadinessUnavailable(message),
+                ):
+                    for request, url, status in cases:
+                        with self.subTest(
+                            failure_point=failure_point,
+                            message=message,
+                            url=url,
+                            method=request.__name__,
+                        ):
+                            response = request(url)
+                            self.assertEqual(response.status_code, status)
+                            payload = response.json()
+                            observations = payload.get("documents", [payload])
+                            self.assertEqual(len(observations), 1)
+                            self.assertEqual(observations[0]["state"], "unavailable")
+                            self.assertEqual(observations[0]["reasons"], [code])
+                            self.assertNotIn(sensitive, response.content.decode())
+
+    def test_readiness_endpoints_do_not_expose_saved_parser_errors(self):
+        sensitive = "parser credential=secret\nTraceback at /private/parser.py:42"
+        cases = self.readiness_requests()
+        for error, code in ((sensitive, "document_processing_failed"), ("", "")):
+            self.doc.processing_status = "failed"
+            self.doc.processing_error = error
+            self.doc.save(update_fields=["processing_status", "processing_error"])
+            for request, url, status in cases:
+                with self.subTest(error=error, url=url, method=request.__name__):
+                    response = request(url)
+                    self.assertEqual(response.status_code, status)
+                    payload = response.json()
+                    observations = payload.get("documents", [payload])
+                    self.assertEqual(len(observations), 1)
+                    self.assertEqual(observations[0]["state"], "failed")
+                    self.assertEqual(observations[0]["processing_error"], code)
+                    self.assertNotIn("credential=secret", response.content.decode())
+                    self.assertNotIn("/private/parser.py", response.content.decode())
+            self.doc.refresh_from_db()
+            self.assertEqual(self.doc.processing_error, error)
+
     def test_nonserializable_settings_allow_unverified_embeddings(self):
         from opencontractserver.tasks.embeddings_task import (
             calculate_embedding_for_doc_text,
@@ -421,9 +499,7 @@ def test_failed_parsing_remains_failed_even_with_complete_vectors(self):
         self.doc.save(update_fields=["processing_status", "processing_error"])
         result = assess_document(self.doc, self.corp
```

**File**: `opencontractserver/tests/test_ingestion_run_budget.py` (modified, +115/-0)
```diff
@@ -147,6 +147,93 @@ def assert_totals(self, run, *, accounted, reserved):
         self.assertEqual(run.reserved_usd, Decimal(reserved))
         self.assertLessEqual(run.accounted_usd + run.reserved_usd, run.ceiling_usd)
 
+    def test_run_endpoints_only_return_public_policy_codes(self):
+        sensitive = "provider credential=secret at /private/provider.py:42"
+        payload = {"ceiling_usd": "0", "preparations": [PREPARATION]}
+        for message, code, status in (
+            (sensitive, "run_policy_error", 400),
+            ("invalid_money", "invalid_money", 400),
+            ("run_identity_conflict", "run_identity_conflict", 409),
+        ):
+            with self.subTest(message=message), patch(
+                "opencontractserver.worker_uploads.run_views.create_run",
+                side_effect=RunPolicyError(message),
+            ):
+                response = self.api_client.post(
+                    "/api/worker-uploads/runs/", payload, format="json"
+                )
+                self.assertEqual(response.status_code, status)
+                self.assertEqual(response.json(), {"error": code})
+
+        run = self.new_run()
+        for message, code in (
+            (sensitive, "run_policy_error"),
+            ("run_cancelled", "run_cancelled"),
+        ):
+            with self.subTest(message=message), patch(
+                "opencontractserver.worker_uploads.run_views.control_run",
+                side_effect=RunPolicyError(message),
+            ):
+                response = self.api_client.post(
+                    f"/api/worker-uploads/runs/{run.pk}/",
+                    {"action": "resume"},
+                    format="json",
+                )
+                self.assertEqual(response.status_code, 409)
+                self.assertEqual(response.json(), {"error": code})
+
+    def test_policy_exception_details_do_not_reach_persisted_reports(self):
+        sensitive = "provider credential=secret at /private/provider.py:42"
+        for phase in ("admission", "execution", "publication", "provider"):
+            with self.subTest(phase=phase):
+                run = self.new_run()
+                if phase == "admission":
+                    with patch(
+                        "opencontractserver.worker_uploads.run_services.validate_execution",
+                        side_effect=RunPolicyError(sensitive),
+                    ):
+                        self.assertTrue(route_embedding(self.document(run)))
+                else:
+                    _, reservation = self.reserve(run)
+                    targets = {
+                        "execution": "opencontractserver.worker_uploads.run_services.validate_execution",
+                        "publication": "opencontractserver.documents.models.Document.add_embedding",
+                        "provider": (
+                            "opencontractserver.pipeline.embedders.openai_embedder."
+                            "OpenAIEmbedder.embed_text_accounted"
+                        ),
+                    }
+                    with patch.object(
+                        OpenAIEmbedder,
+                        "embed_text_accounted",
+                        return_value=([0.25] * 384, 2),
+                    ), patch(targets[phase], side_effect=RunPolicyError(sensitive)):
+                        execute_reservation(reservation.pk)
+
+                # Exercise all three report responses, including an idempotent
+                # create replay of a run which already has a persisted failure.
+                url = f"/api/worker-uploads/runs/{run.pk}/"
+                responses = [
+                    self.api_client.get(url),
+                    self.api_client.post(url, {"action": "pause"}, format="json"),
+                    self.api_client.post(
+                        "/api/worker-uploads/runs/",
+                        {
+                            "id": str(run.pk),
+                            "ceiling_usd": "0.000004",
+                            "preparations": [PREPARATION],
+                            "embedding_mode": "server",
+                        },
+                        format="json",
+                    ),
+                ]
+                self.assertEqual([r.status_code for r in responses], [200, 200, 201])
+                for response in responses:
+                    self.assertEqual(response.json()["last_error"], "run_policy_error")
+                    self.assertNotIn(sensitive, response.content.decode())
+                self.assertTrue(run.events.filter(code="run_policy_error").exists())
+                self.assertNotIn(sensitive, run.operations.get().error_code)
+
     def test_exact_boundary_fits_and_next_byte_waits_without_a_reservation(self):
         run = self.new_run()
         self.reserve(run)
@@ -968,6 +1055,34 @@ def test_report_pages_all_operations_with_their_reservations(self):
         self.assertEqual(Decimal(run_report(run)["reserved_usd"]
```

**File**: `opencontractserver/tests/test_worker_authority_sections.py` (modified, +21/-1)
```diff
@@ -104,10 +104,30 @@ def test_post_invalid_section_spec_is_rejected_400(self, mock_nudge):
         payload = _make_payload(sections=[{"key": "hr:119-1", "heading": "no text"}])
         response = self.client_api.post(ENDPOINT, payload, format="json")
         assert response.status_code == 400
-        assert "sections[0]" in str(response.data)
+        assert response.json() == {
+            "non_field_errors": ["Invalid authority section specification."]
+        }
         assert not WorkerAuthoritySectionBatch.objects.exists()
         mock_nudge.assert_not_called()
 
+    def test_section_validation_does_not_expose_exception_details(self):
+        sensitive = "parser credential=secret at /private/parser.py:42"
+        with patch(
+            "opencontractserver.enrichment.authorities.parse_section_spec",
+            side_effect=ValueError(sensitive),
+        ), self.assertLogs(
+            "opencontractserver.worker_uploads.serializers", level="WARNING"
+        ) as logs:
+            response = self.client_api.post(ENDPOINT, _make_payload(), format="json")
+        self.assertEqual(response.status_code, 400)
+        self.assertEqual(
+            response.json(),
+            {"non_field_errors": ["Invalid authority section specification."]},
+        )
+        self.assertNotIn(sensitive, response.content.decode())
+        self.assertIn(sensitive, "\n".join(logs.output))
+        self.assertFalse(WorkerAuthoritySectionBatch.objects.exists())
+
     @patch(
         "opencontractserver.worker_uploads.views.process_pending_section_batches.apply_async"
     )
```

**File**: `opencontractserver/tests/test_worker_upload_recovery.py` (modified, +25/-0)
```diff
@@ -22,13 +22,15 @@
     WorkerAccount,
     WorkerDocumentUpload,
 )
+from opencontractserver.worker_uploads.run_policy import RunPolicyError
 from opencontractserver.worker_uploads.tasks import (
     _fail_upload,
     _process_single_upload,
     process_pending_uploads,
     recover_stalled_uploads,
 )
 from opencontractserver.worker_uploads.upload_recovery import (
+    UploadConflict,
     _admission_lock,
     stage_upload,
 )
@@ -90,6 +92,29 @@ def claim(self, upload):
         )
         return fence
 
+    def test_upload_and_retry_do_not_expose_exception_details(self):
+        sensitive = "storage credential=secret at /private/storage.py:42"
+        for error, code in (
+            (RunPolicyError(sensitive), "run_policy_error"),
+            (UploadConflict(sensitive), "upload_conflict"),
+        ):
+            with self.subTest(error=type(error).__name__), patch(
+                "opencontractserver.worker_uploads.views.stage_upload",
+                side_effect=error,
+            ):
+                response = self.post()
+                self.assertEqual(response.status_code, 409)
+                self.assertEqual(response.json(), {"error": code})
+        with patch(
+            "opencontractserver.worker_uploads.views.retry_upload",
+            side_effect=UploadConflict(sensitive),
+        ):
+            response = self.client.post(
+                f"/api/worker-uploads/documents/{uuid4()}/retry/"
+            )
+        self.assertEqual(response.status_code, 409)
+        self.assertEqual(response.json(), {"error": "upload_conflict"})
+
     def test_concurrent_posts_and_lost_response_return_one_receipt_and_document(self):
         barrier = Barrier(2)
 
```

---

### Incident Patch 11: `2cf60dca` (2026-09-16)
**Commit Message**: Merge pull request #2379 from Open-Source-Legal/fix/auth0-callback-initialization

Fix Auth0 login callbacks being discarded during startup

**File**: `changelog.d/auth0-callback-initialization.fixed.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+- Fix Auth0 login silently returning to the signed-out home page by delaying
+  application mounting in `frontend/src/utils/Auth0ProviderWithHistory.tsx`
+  until the SDK consumes OAuth callback parameters and the router commits the
+  return path. This prevents routing effects from discarding both successful
+  and failed callbacks; regression tests exercise the real SDK and router.
```

**File**: `docs/configuration/authentication.md` (modified, +18/-0)
```diff
@@ -454,6 +454,24 @@ asynchronously within a few seconds of first login.
 
 ## Troubleshooting
 
+### Frontend login returns home without signing in or showing an error
+
+An existing Auth0 SSO session can skip the login form; that alone is normal.
+The application must still consume the callback and validate the token with
+the backend.
+
+If `?code=...&state=...` disappears without an Auth0 `/oauth/token` request,
+the frontend router may be rewriting the URL before the SDK initializes.
+`Auth0ProviderWithHistory` must delay mounting the application until SDK
+initialization and callback navigation finish. Rebuild and redeploy the frontend
+with that fix; changing cookie consent or the API audience does not fix this race.
+See the [callback regression procedure](../test_scripts/auth0-callback-routing.md).
+
+If the token exchange succeeds, inspect the subsequent GraphQL `GetMe` response.
+`me: null` means the backend did not accept the session; check Django's Auth0 logs
+and ensure its `AUTH0_DOMAIN` and `AUTH0_API_AUDIENCE` match the frontend's domain
+and audience. The API audience is an identifier and need not equal the API host.
+
 ### "Missing Refresh Token" error
 
 **Symptom**: After authenticating, the browser console or a toast shows
```

**File**: `docs/frontend/auth_flow.md` (modified, +7/-2)
```diff
@@ -16,8 +16,13 @@ JWT backends never create sessions; their `get_user` shares
 would behave the same. Disabling an account removes its authenticated access on
 the next request; public access and other valid credentials are unaffected.
 
-1. `AuthGate` waits for the SDK's `isLoading` state to settle. In local-password
-   deployments it instead reads a candidate JWT from sessionStorage.
+1. `Auth0ProviderWithHistory` keeps the application unmounted until the SDK
+   finishes initializing and React Router commits callback cleanup. Child effects
+   run before parent effects: mounting `App` earlier lets its route manager strip
+   OAuth `code`/`state` before the SDK reads them. Waiting for the router also
+   prevents a stale callback location from overwriting the login return path.
+   `AuthGate` then obtains a candidate access token. In local-password deployments
+   it instead reads a candidate JWT from sessionStorage.
 2. AuthGate clears the old Apollo store before publishing credentials.
 3. `useBackendSession` sends a `GET_ME` request with that credential and
    `fetchPolicy: "no-cache"`. A stored token or SDK profile alone does not grant
```

**File**: `docs/test_scripts/auth0-callback-routing.md` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+# Test: Auth0 callbacks survive frontend initialization
+
+## Purpose
+
+Verify that `Auth0ProviderWithHistory` lets the SDK consume an OAuth callback
+before application routing effects run, preserves the login return path, and
+surfaces failed callbacks.
+
+## Prerequisites
+
+- An Auth0-enabled frontend with its origin allowed in Auth0's callback settings.
+- Browser developer tools with **Preserve log** enabled in the Network tab.
+- For the automated regression: installed frontend dependencies.
+
+## Steps
+
+1. Open the frontend in a fresh browser context and click **Login**. Auth0's
+   `/authorize` request should lead to Universal Login. With an existing SSO
+   session, Auth0 may immediately return to the application instead.
+2. Complete login, starting from `/documents` to exercise the return path.
+   Observe the callback containing `code` and `state`. Before application URL
+   synchronization runs, the SDK should send an authorization-code exchange to
+   Auth0's `/oauth/token` endpoint.
+3. Confirm that callback parameters disappear, the browser returns to
+   `/documents`, and GraphQL `GetMe` runs with an Authorization header. A non-null
+   backend identity should enable signed-in navigation. Do not copy access tokens,
+   authorization codes, or complete token responses into logs or issue reports.
+4. In a separate disposable browser context, visit
+   `/?error=access_denied&error_description=Callback+diagnostic&state=diagnostic`.
+   The app should display **Sign-in could not be completed. Please try again.**,
+   clean the callback URL, and allow anonymous browsing and a new login attempt.
+5. Run the automated regression, which uses the real React SDK and router with
+   a simulated token endpoint and backend:
+
+   ```bash
+   cd frontend
+   ./node_modules/.bin/vitest run src/utils/Auth0ProviderWithHistory.test.tsx
+   ```
+
+## Expected results
+
+Both successful and failed callbacks are consumed before application effects
+can rewrite their query parameters. Backend validation still determines whether
+the user is signed in. Ordinary anonymous startup completes without a token
+exchange or error.
+
+Before the fix, the regression's code exchange never starts and its OAuth error
+never appears. The production bundle `index-BpSUWDBR.js` was also observed
+rewriting a synthetic error callback to `/?selectedOnly=true` and then `/`
+without displaying an authentication error; its fresh-browser login redirect
+successfully reached Auth0 Universal Login. No production account was used.
+
+## Cleanup
+
+Close the disposable browser contexts. Automated tests use synthetic credentials
+and do not contact Auth0 or the production backend.
```

**File**: `frontend/src/utils/Auth0ProviderWithHistory.test.tsx` (added, +243/-0)
```diff
@@ -0,0 +1,243 @@
+import React from "react";
+import { webcrypto } from "node:crypto";
+import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
+import { useAuth0 } from "@auth0/auth0-react";
+import { BrowserRouter } from "react-router-dom";
+import {
+  ApolloClient,
+  ApolloProvider,
+  ApolloLink,
+  InMemoryCache,
+  Observable,
+} from "@apollo/client";
+import { screen } from "@testing-library/react";
+import { toast } from "react-toastify";
+import { Auth0ProviderWithHistory } from "./Auth0ProviderWithHistory";
+import { CentralRouteManager } from "../routing/CentralRouteManager";
+import { AuthGate } from "../components/auth/AuthGate";
+import { useAuthenticated } from "../hooks/useAuthenticated";
+import { authLink } from "../graphql/authLink";
+import { authInitCompleteVar, authStatusVar } from "../graphql/cache";
+import { clearAuthSession } from "./authSession";
+import { navigationCircuitBreaker } from "./navigationCircuitBreaker";
+import { act, cleanup, renderHook, waitFor } from "../test-utils/renderHook";
+
+vi.mock("react-toastify", () => ({
+  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
+}));
+vi.mock("../components/widgets/ModernLoadingDisplay", () => ({
+  ModernLoadingDisplay: () => <div>Initializing OpenContracts</div>,
+}));
+
+const identity = { sub: "auth0|alice", name: "Alice" };
+const tokenRequest = vi.fn<typeof fetch>();
+const audience = "https://api.example.test";
+
+function storeTransaction() {
+  sessionStorage.setItem(
+    "a0.spajs.txs.callback-test",
+    JSON.stringify({
+      nonce: "test-nonce",
+      code_verifier: "test-code-verifier",
+      state: "oauth-state",
+      scope: "openid profile email offline_access",
+      audience,
+      redirect_uri: window.location.origin,
+      appState: { returnTo: "/documents" },
+    })
+  );
+}
+
+function tokenResponse() {
+  const now = Math.floor(Date.now() / 1000);
+  const encode = (value: object) =>
+    btoa(JSON.stringify(value))
+      .replace(/\+/g, "-")
+      .replace(/\//g, "_")
+      .replace(/=+$/, "");
+  const idToken = [
+    encode({ alg: "RS256", typ: "JWT" }),
+    encode({
+      ...identity,
+      iss: "https://example.auth0.com/",
+      aud: "callback-test",
+      iat: now,
+      exp: now + 3600,
+      nonce: "test-nonce",
+    }),
+    "test-signature",
+  ].join(".");
+  return new Response(
+    JSON.stringify({
+      access_token: "access-token",
+      refresh_token: "refresh-token",
+      id_token: idToken,
+      token_type: "Bearer",
+      expires_in: 3600,
+    }),
+    { status: 200, headers: { "Content-Type": "application/json" } }
+  );
+}
+const me = {
+  id: "alice",
+  email: "alice@example.test",
+  username: "alice",
+  slug: "alice",
+  name: "Alice",
+  firstName: "Alice",
+  lastName: "",
+  phone: "",
+  isSuperuser: false,
+  isUsageCapped: false,
+  canImportCorpus: false,
+  isProfilePublic: false,
+  profileHeadline: "",
+  profileAboutMarkdown: "",
+  profileLinksMarkdown: "",
+};
+
+function SessionStatus() {
+  const { error } = useAuth0();
+  const authenticated = useAuthenticated();
+  return (
+    <div>
+      {error && <span>{error.message}</span>}
+      {authenticated ? "Signed in" : "Signed out"}
+    </div>
+  );
+}
+
+function setup() {
+  const requested = vi.fn();
+  const client = new ApolloClient({
+    cache: new InMemoryCache(),
+    link: ApolloLink.from([
+      authLink,
+      new ApolloLink(
+        (operation) =>
+          new Observable((observer) => {
+            requested(operation.getContext().headers?.Authorization);
+            observer.next({ data: { me } });
+            observer.complete();
+          })
+      ),
+    ]),
+  });
+  // Keep the real SDK provider, BrowserRouter and route manager: mocking
+  // useAuth0 or navigation hides the child-before-parent effect ordering.
+  const view = renderHook(() => null, {
+    wrapper: () => (
+      <BrowserRouter>
+        <Auth0ProviderWithHistory
+          domain="example.auth0.com"
+          clientId="callback-test"
+          useRefreshTokens
+          useRefreshTokensFallback
+          authorizationParams={{
+            redirect_uri: window.location.origin,
+            audience,
+          }}
+        >
+          <ApolloProvider client={client}>
+            <CentralRouteManager />
+            <AuthGate useAuth0 audience={audience}>
+              <SessionStatus />
+            </AuthGate>
+          </ApolloProvider>
+        </Auth0ProviderWithHistory>
+      </BrowserRouter>
+    ),
+  });
+  return { ...view, requested };
+}
+
+beforeEach(async () => {
+  vi.clearAllMocks();
+  vi.stubGlobal("crypto", webcrypto);
+  vi.stubGlobal("fetch", tokenRequest);
+  tokenRequest.mockReset();
+  tokenRequest.mockRejectedValue(new Error("Unexpected token request"));
+  sessionStorage.clear();
+  for (const cookie of document.cookie.split(";")) {
+    document.cookie = `${cookie.split("=")[0].trim()}=; Max-Age=0; Path=/`;
+  }
+  clear
```

**File**: `frontend/src/utils/Auth0ProviderWithHistory.tsx` (modified, +33/-14)
```diff
@@ -4,31 +4,51 @@ import {
   useAuth0,
 } from "@auth0/auth0-react";
 import React, { useEffect } from "react";
-import { useNavigate } from "react-router-dom";
+import { useLocation, useNavigate } from "react-router-dom";
 import { safeReturnTo } from "./authRedirect";
+import { ModernLoadingDisplay } from "../components/widgets/ModernLoadingDisplay";
 
 interface Props extends Omit<Auth0ProviderOptions, "onRedirectCallback"> {
   children: React.ReactNode;
 }
 
-function CallbackErrorCleanup() {
+function Auth0InitializationBoundary({
+  children,
+}: {
+  children: React.ReactNode;
+}) {
   const { error, isLoading } = useAuth0();
   const navigate = useNavigate();
+  const location = useLocation();
+  const params = new URLSearchParams(location.search);
+  const hasCallbackParams = Boolean(
+    params.get("state") && (params.get("code") || params.get("error"))
+  );
   useEffect(() => {
-    if (isLoading || !error) return;
-    const params = new URLSearchParams(window.location.search);
-    if (params.has("state") && (params.has("code") || params.has("error"))) {
+    if (!isLoading && error && hasCallbackParams) {
       navigate(
-        safeReturnTo(
-          window.location.pathname +
-            window.location.search +
-            window.location.hash
-        ),
+        safeReturnTo(location.pathname + location.search + location.hash),
         { replace: true }
       );
     }
-  }, [error, isLoading, navigate]);
-  return null;
+  }, [error, isLoading, hasCallbackParams, location, navigate]);
+  // Child effects run before the provider's initialization effect. Keep the
+  // entire app unmounted until the SDK has consumed code/state (or an OAuth
+  // error); otherwise route and mobile-display effects can rewrite the URL
+  // before the SDK recognizes the callback. AuthGate inside App runs too late
+  // to protect routing effects outside that gate. Also wait for the router to
+  // commit callback cleanup: its navigation can lag the SDK's state update,
+  // leaving new children with a stale callback location and return path.
+  if (isLoading || hasCallbackParams) {
+    return (
+      <ModernLoadingDisplay
+        type="auth"
+        message="Initializing OpenContracts"
+        size="large"
+      />
+    );
+  }
+  return <>{children}</>;
 }
 
 export const Auth0ProviderWithHistory: React.FC<Props> = ({
@@ -47,8 +67,7 @@ export const Auth0ProviderWithHistory: React.FC<Props> = ({
       onRedirectCallback={onRedirectCallback}
       cacheLocation="memory"
     >
-      <CallbackErrorCleanup />
-      {children}
+      <Auth0InitializationBoundary>{children}</Auth0InitializationBoundary>
     </Auth0Provider>
   );
 };
```

---

### Incident Patch 12: `ff441757` (2026-09-16)
**Commit Message**: Fix Auth0 callbacks being discarded during frontend startup

**File**: `changelog.d/auth0-callback-initialization.fixed.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+- Fix Auth0 login silently returning to the signed-out home page by delaying
+  application mounting in `frontend/src/utils/Auth0ProviderWithHistory.tsx`
+  until the SDK consumes OAuth callback parameters and the router commits the
+  return path. This prevents routing effects from discarding both successful
+  and failed callbacks; regression tests exercise the real SDK and router.
```

**File**: `docs/configuration/authentication.md` (modified, +18/-0)
```diff
@@ -454,6 +454,24 @@ asynchronously within a few seconds of first login.
 
 ## Troubleshooting
 
+### Frontend login returns home without signing in or showing an error
+
+An existing Auth0 SSO session can skip the login form; that alone is normal.
+The application must still consume the callback and validate the token with
+the backend.
+
+If `?code=...&state=...` disappears without an Auth0 `/oauth/token` request,
+the frontend router may be rewriting the URL before the SDK initializes.
+`Auth0ProviderWithHistory` must delay mounting the application until SDK
+initialization and callback navigation finish. Rebuild and redeploy the frontend
+with that fix; changing cookie consent or the API audience does not fix this race.
+See the [callback regression procedure](../test_scripts/auth0-callback-routing.md).
+
+If the token exchange succeeds, inspect the subsequent GraphQL `GetMe` response.
+`me: null` means the backend did not accept the session; check Django's Auth0 logs
+and ensure its `AUTH0_DOMAIN` and `AUTH0_API_AUDIENCE` match the frontend's domain
+and audience. The API audience is an identifier and need not equal the API host.
+
 ### "Missing Refresh Token" error
 
 **Symptom**: After authenticating, the browser console or a toast shows
```

**File**: `docs/frontend/auth_flow.md` (modified, +7/-2)
```diff
@@ -16,8 +16,13 @@ JWT backends never create sessions; their `get_user` shares
 would behave the same. Disabling an account removes its authenticated access on
 the next request; public access and other valid credentials are unaffected.
 
-1. `AuthGate` waits for the SDK's `isLoading` state to settle. In local-password
-   deployments it instead reads a candidate JWT from sessionStorage.
+1. `Auth0ProviderWithHistory` keeps the application unmounted until the SDK
+   finishes initializing and React Router commits callback cleanup. Child effects
+   run before parent effects: mounting `App` earlier lets its route manager strip
+   OAuth `code`/`state` before the SDK reads them. Waiting for the router also
+   prevents a stale callback location from overwriting the login return path.
+   `AuthGate` then obtains a candidate access token. In local-password deployments
+   it instead reads a candidate JWT from sessionStorage.
 2. AuthGate clears the old Apollo store before publishing credentials.
 3. `useBackendSession` sends a `GET_ME` request with that credential and
    `fetchPolicy: "no-cache"`. A stored token or SDK profile alone does not grant
```

**File**: `docs/test_scripts/auth0-callback-routing.md` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+# Test: Auth0 callbacks survive frontend initialization
+
+## Purpose
+
+Verify that `Auth0ProviderWithHistory` lets the SDK consume an OAuth callback
+before application routing effects run, preserves the login return path, and
+surfaces failed callbacks.
+
+## Prerequisites
+
+- An Auth0-enabled frontend with its origin allowed in Auth0's callback settings.
+- Browser developer tools with **Preserve log** enabled in the Network tab.
+- For the automated regression: installed frontend dependencies.
+
+## Steps
+
+1. Open the frontend in a fresh browser context and click **Login**. Auth0's
+   `/authorize` request should lead to Universal Login. With an existing SSO
+   session, Auth0 may immediately return to the application instead.
+2. Complete login, starting from `/documents` to exercise the return path.
+   Observe the callback containing `code` and `state`. Before application URL
+   synchronization runs, the SDK should send an authorization-code exchange to
+   Auth0's `/oauth/token` endpoint.
+3. Confirm that callback parameters disappear, the browser returns to
+   `/documents`, and GraphQL `GetMe` runs with an Authorization header. A non-null
+   backend identity should enable signed-in navigation. Do not copy access tokens,
+   authorization codes, or complete token responses into logs or issue reports.
+4. In a separate disposable browser context, visit
+   `/?error=access_denied&error_description=Callback+diagnostic&state=diagnostic`.
+   The app should display **Sign-in could not be completed. Please try again.**,
+   clean the callback URL, and allow anonymous browsing and a new login attempt.
+5. Run the automated regression, which uses the real React SDK and router with
+   a simulated token endpoint and backend:
+
+   ```bash
+   cd frontend
+   ./node_modules/.bin/vitest run src/utils/Auth0ProviderWithHistory.test.tsx
+   ```
+
+## Expected results
+
+Both successful and failed callbacks are consumed before application effects
+can rewrite their query parameters. Backend validation still determines whether
+the user is signed in. Ordinary anonymous startup completes without a token
+exchange or error.
+
+Before the fix, the regression's code exchange never starts and its OAuth error
+never appears. The production bundle `index-BpSUWDBR.js` was also observed
+rewriting a synthetic error callback to `/?selectedOnly=true` and then `/`
+without displaying an authentication error; its fresh-browser login redirect
+successfully reached Auth0 Universal Login. No production account was used.
+
+## Cleanup
+
+Close the disposable browser contexts. Automated tests use synthetic credentials
+and do not contact Auth0 or the production backend.
```

**File**: `frontend/src/utils/Auth0ProviderWithHistory.test.tsx` (added, +243/-0)
```diff
@@ -0,0 +1,243 @@
+import React from "react";
+import { webcrypto } from "node:crypto";
+import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
+import { useAuth0 } from "@auth0/auth0-react";
+import { BrowserRouter } from "react-router-dom";
+import {
+  ApolloClient,
+  ApolloProvider,
+  ApolloLink,
+  InMemoryCache,
+  Observable,
+} from "@apollo/client";
+import { screen } from "@testing-library/react";
+import { toast } from "react-toastify";
+import { Auth0ProviderWithHistory } from "./Auth0ProviderWithHistory";
+import { CentralRouteManager } from "../routing/CentralRouteManager";
+import { AuthGate } from "../components/auth/AuthGate";
+import { useAuthenticated } from "../hooks/useAuthenticated";
+import { authLink } from "../graphql/authLink";
+import { authInitCompleteVar, authStatusVar } from "../graphql/cache";
+import { clearAuthSession } from "./authSession";
+import { navigationCircuitBreaker } from "./navigationCircuitBreaker";
+import { act, cleanup, renderHook, waitFor } from "../test-utils/renderHook";
+
+vi.mock("react-toastify", () => ({
+  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
+}));
+vi.mock("../components/widgets/ModernLoadingDisplay", () => ({
+  ModernLoadingDisplay: () => <div>Initializing OpenContracts</div>,
+}));
+
+const identity = { sub: "auth0|alice", name: "Alice" };
+const tokenRequest = vi.fn<typeof fetch>();
+const audience = "https://api.example.test";
+
+function storeTransaction() {
+  sessionStorage.setItem(
+    "a0.spajs.txs.callback-test",
+    JSON.stringify({
+      nonce: "test-nonce",
+      code_verifier: "test-code-verifier",
+      state: "oauth-state",
+      scope: "openid profile email offline_access",
+      audience,
+      redirect_uri: window.location.origin,
+      appState: { returnTo: "/documents" },
+    })
+  );
+}
+
+function tokenResponse() {
+  const now = Math.floor(Date.now() / 1000);
+  const encode = (value: object) =>
+    btoa(JSON.stringify(value))
+      .replace(/\+/g, "-")
+      .replace(/\//g, "_")
+      .replace(/=+$/, "");
+  const idToken = [
+    encode({ alg: "RS256", typ: "JWT" }),
+    encode({
+      ...identity,
+      iss: "https://example.auth0.com/",
+      aud: "callback-test",
+      iat: now,
+      exp: now + 3600,
+      nonce: "test-nonce",
+    }),
+    "test-signature",
+  ].join(".");
+  return new Response(
+    JSON.stringify({
+      access_token: "access-token",
+      refresh_token: "refresh-token",
+      id_token: idToken,
+      token_type: "Bearer",
+      expires_in: 3600,
+    }),
+    { status: 200, headers: { "Content-Type": "application/json" } }
+  );
+}
+const me = {
+  id: "alice",
+  email: "alice@example.test",
+  username: "alice",
+  slug: "alice",
+  name: "Alice",
+  firstName: "Alice",
+  lastName: "",
+  phone: "",
+  isSuperuser: false,
+  isUsageCapped: false,
+  canImportCorpus: false,
+  isProfilePublic: false,
+  profileHeadline: "",
+  profileAboutMarkdown: "",
+  profileLinksMarkdown: "",
+};
+
+function SessionStatus() {
+  const { error } = useAuth0();
+  const authenticated = useAuthenticated();
+  return (
+    <div>
+      {error && <span>{error.message}</span>}
+      {authenticated ? "Signed in" : "Signed out"}
+    </div>
+  );
+}
+
+function setup() {
+  const requested = vi.fn();
+  const client = new ApolloClient({
+    cache: new InMemoryCache(),
+    link: ApolloLink.from([
+      authLink,
+      new ApolloLink(
+        (operation) =>
+          new Observable((observer) => {
+            requested(operation.getContext().headers?.Authorization);
+            observer.next({ data: { me } });
+            observer.complete();
+          })
+      ),
+    ]),
+  });
+  // Keep the real SDK provider, BrowserRouter and route manager: mocking
+  // useAuth0 or navigation hides the child-before-parent effect ordering.
+  const view = renderHook(() => null, {
+    wrapper: () => (
+      <BrowserRouter>
+        <Auth0ProviderWithHistory
+          domain="example.auth0.com"
+          clientId="callback-test"
+          useRefreshTokens
+          useRefreshTokensFallback
+          authorizationParams={{
+            redirect_uri: window.location.origin,
+            audience,
+          }}
+        >
+          <ApolloProvider client={client}>
+            <CentralRouteManager />
+            <AuthGate useAuth0 audience={audience}>
+              <SessionStatus />
+            </AuthGate>
+          </ApolloProvider>
+        </Auth0ProviderWithHistory>
+      </BrowserRouter>
+    ),
+  });
+  return { ...view, requested };
+}
+
+beforeEach(async () => {
+  vi.clearAllMocks();
+  vi.stubGlobal("crypto", webcrypto);
+  vi.stubGlobal("fetch", tokenRequest);
+  tokenRequest.mockReset();
+  tokenRequest.mockRejectedValue(new Error("Unexpected token request"));
+  sessionStorage.clear();
+  for (const cookie of document.cookie.split(";")) {
+    document.cookie = `${cookie.split("=")[0].trim()}=; Max-Age=0; Path=/`;
+  }
+  clear
```

**File**: `frontend/src/utils/Auth0ProviderWithHistory.tsx` (modified, +33/-14)
```diff
@@ -4,31 +4,51 @@ import {
   useAuth0,
 } from "@auth0/auth0-react";
 import React, { useEffect } from "react";
-import { useNavigate } from "react-router-dom";
+import { useLocation, useNavigate } from "react-router-dom";
 import { safeReturnTo } from "./authRedirect";
+import { ModernLoadingDisplay } from "../components/widgets/ModernLoadingDisplay";
 
 interface Props extends Omit<Auth0ProviderOptions, "onRedirectCallback"> {
   children: React.ReactNode;
 }
 
-function CallbackErrorCleanup() {
+function Auth0InitializationBoundary({
+  children,
+}: {
+  children: React.ReactNode;
+}) {
   const { error, isLoading } = useAuth0();
   const navigate = useNavigate();
+  const location = useLocation();
+  const params = new URLSearchParams(location.search);
+  const hasCallbackParams = Boolean(
+    params.get("state") && (params.get("code") || params.get("error"))
+  );
   useEffect(() => {
-    if (isLoading || !error) return;
-    const params = new URLSearchParams(window.location.search);
-    if (params.has("state") && (params.has("code") || params.has("error"))) {
+    if (!isLoading && error && hasCallbackParams) {
       navigate(
-        safeReturnTo(
-          window.location.pathname +
-            window.location.search +
-            window.location.hash
-        ),
+        safeReturnTo(location.pathname + location.search + location.hash),
         { replace: true }
       );
     }
-  }, [error, isLoading, navigate]);
-  return null;
+  }, [error, isLoading, hasCallbackParams, location, navigate]);
+  // Child effects run before the provider's initialization effect. Keep the
+  // entire app unmounted until the SDK has consumed code/state (or an OAuth
+  // error); otherwise route and mobile-display effects can rewrite the URL
+  // before the SDK recognizes the callback. AuthGate inside App runs too late
+  // to protect routing effects outside that gate. Also wait for the router to
+  // commit callback cleanup: its navigation can lag the SDK's state update,
+  // leaving new children with a stale callback location and return path.
+  if (isLoading || hasCallbackParams) {
+    return (
+      <ModernLoadingDisplay
+        type="auth"
+        message="Initializing OpenContracts"
+        size="large"
+      />
+    );
+  }
+  return <>{children}</>;
 }
 
 export const Auth0ProviderWithHistory: React.FC<Props> = ({
@@ -47,8 +67,7 @@ export const Auth0ProviderWithHistory: React.FC<Props> = ({
       onRedirectCallback={onRedirectCallback}
       cacheLocation="memory"
     >
-      <CallbackErrorCleanup />
-      {children}
+      <Auth0InitializationBoundary>{children}</Auth0InitializationBoundary>
     </Auth0Provider>
   );
 };
```

---

### Incident Patch 13: `59f08356` (2026-09-16)
**Commit Message**: Merge pull request #2378 from Open-Source-Legal/fix/sentence-transformer-ingestion-budget

Support sentence-transformer embeddings in budgeted ingestion

**File**: `changelog.d/sentence-transformer-ingestion-budget.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Support the shipped sentence-transformer service in policy-bound ingestion with explicit zero-provider-fee configuration through pipeline settings, pinned model identity, bounded requests, and existing retry and readiness checks. Infrastructure costs remain outside ingestion budgets.
```

**File**: `docs/upload_methods/ingestion_run_policy.md` (modified, +56/-6)
```diff
@@ -23,19 +23,19 @@ Two modes are available:
 | Mode | Server processing |
 | --- | --- |
 | `prepared` (default) | Store prepared artifacts and any supplied vectors; no server provider calls. |
-| `server` | Store prepared artifacts and generate missing text embeddings through the priced, first-party OpenAI adapter. |
+| `server` | Store prepared artifacts and generate missing text embeddings through the priced OpenAI adapter or explicitly declared self-hosted sentence service. |
 
 Both modes suppress server parsing, conversion, thumbnails, multimodal fallback,
-and automatic corpus actions. Custom endpoints, unknown providers, and unknown
-prices cannot be admitted. The effective corpus/default provider, model,
+and automatic corpus actions. Custom OpenAI endpoints, unknown providers, and
+undeclared pricing cannot be admitted. The effective corpus/default provider, model,
 dimension, non-secret configuration fingerprint, adapter contract version, and
 configured pricing are checked at admission and
 again before each request. Changed configuration pauses execution; restoring the
 approved configuration permits resume. The fingerprint includes operator-supplied
 `EMBEDDING_MODEL_REVISIONS`; bump that revision when a model changes in place.
 Changing the policy requires a new run. Generated vectors retain this fingerprint
 for readiness checks; unverified or stale vectors do not skip budgeted generation.
-The adapter version is `OpenAIEmbedder.accounting_version`; changes to its request
+The adapter version is the provider's `accounting_version`; changes to its request
 or accounting contract must bump that version. Formatting and comment edits do
 not invalidate an approved run.
 
@@ -56,7 +56,50 @@ is retained. This is not a cap on the entire deployment's invoice.
 
 ## Operator pricing
 
-For `server` mode, configure `INGESTION_RUN_PRICING` as a JSON environment value
+### Self-hosted sentence service
+
+Select the built-in `MicroserviceEmbedder` as the corpus or default embedder.
+In its pipeline settings GUI (or the existing `updatePipelineSettings` mutation),
+set `embedding_model_revision` to an identifier for the deployed model and immutable
+revision, such as `multi-qa-MiniLM-L6-cos-v1@<revision>`, and set the boolean
+`no_external_provider_fees` to `true` only when the service incurs no external
+provider fees. Keep the existing service URL and authentication configuration.
+No pricing environment variable or infrastructure configuration change is required. An existing
+`EMBEDDING_MODEL_REVISIONS` entry is accepted when the component revision is unset.
+
+For example, the `componentSettings` input to `updatePipelineSettings` can include
+the following entry (retain any other configured non-secret options; credentials
+continue to use `updateComponentSecrets`):
+
+```json
+{
+  "opencontractserver.pipeline.embedders.sent_transformer_microservice.MicroserviceEmbedder": {
+    "embeddings_microservice_url": "http://vector-embedder:8000",
+    "embedding_model_revision": "multi-qa-MiniLM-L6-cos-v1@pinned-revision",
+    "no_external_provider_fees": true
+  }
+}
+```
+
+The service has a fixed 384-dimensional output contract. The run pins its model
+identity, configuration fingerprint, endpoint fingerprint and adapter version;
+update the revision setting whenever the deployed model changes in place.
+The configured identity is an operator declaration, not remote model attestation.
+Credentials and raw endpoints are not included in run reports. Billing settings
+do not change vector identity, and unset new settings preserve legacy fingerprints.
+
+This adapter reserves and settles **zero provider fees**, so a zero USD ceiling
+is valid in `server` mode. `accounted_tokens: 0` denotes zero billable provider
+tokens, not measured inference token usage. **Infrastructure costs remain excluded**;
+this setting does not imply free computation. Each attempt sends one bounded text
+request (at most 30,000 characters, 30-second timeout), without HTTP retries or
+redirects. The same persisted attempts, explicit retry limit and readiness checks
+apply as for paid embeddings. Missing declarations, configuration changes, invalid
+vectors and request failures fail closed; no paid-provider fallback is allowed.
+
+### OpenAI
+
+For OpenAI `server` mode, configure `INGESTION_RUN_PRICING` as a JSON environment value
 with `version` and `openai_usd_per_million_tokens`. The latter maps each permitted
 OpenAI embedding model name to its positive USD rate, expressed as a decimal
 string. Set an operator-maintained version whenever prices change. No rates are
@@ -97,10 +140,17 @@ python scripts/remote_ingest/oc_remote_ingest.py run-status
 ```
 
 For server text embeddings, use `--no-embeddings --run-embedding-mode server`
-with `run-create`, supply a positive `--run-budget-usd`, and retain
+with `run-create`, supply `--run-budget-usd` (zero is valid for the declared
+self-hosted service; OpenAI requires enough allowance fo
```

**File**: `opencontractserver/constants/embeddings.py` (modified, +4/-1)
```diff
@@ -1,11 +1,14 @@
-# Constants for embedding models used by the OpenAI embedder pipeline component.
+# Constants for supported text embedding providers and their accounting contracts.
 
 OPENAI_EMBEDDER_PATH = (
     "opencontractserver.pipeline.embedders.openai_embedder.OpenAIEmbedder"
 )
 OPENAI_API_BASE_URL = "https://api.openai.com/v1"
 # Bump when the bounded adapter's request or usage-accounting contract changes.
 OPENAI_ACCOUNTED_EMBEDDING_VERSION = "openai-text-embedding-v1"
+MICROSERVICE_EMBEDDER_PATH = "opencontractserver.pipeline.embedders.sent_transformer_microservice.MicroserviceEmbedder"
+MICROSERVICE_ACCOUNTED_EMBEDDING_VERSION = "self-hosted-text-embedding-v1"
+MICROSERVICE_MODEL_REVISION_PATTERN = r"[A-Za-z0-9_.:/@-]{1,200}"
 
 OPENAI_MODEL_DIMENSIONS: dict[str, int] = {
     "text-embedding-3-small": 1536,
```

**File**: `opencontractserver/pipeline/embedders/sent_transformer_microservice.py` (modified, +62/-0)
```diff
@@ -1,4 +1,5 @@
 import logging
+import re
 import threading
 from dataclasses import dataclass, field
 from typing import Any, Optional
@@ -11,6 +12,11 @@
     EMBEDDER_BATCH_REQUEST_TIMEOUT_SECONDS,
     EMBEDDER_SINGLE_REQUEST_TIMEOUT_SECONDS,
     MICROSERVICE_EMBEDDER_MAX_BATCH_SIZE,
+    OPENAI_EMBEDDER_MAX_INPUT_CHARS,
+)
+from opencontractserver.constants.embeddings import (
+    MICROSERVICE_ACCOUNTED_EMBEDDING_VERSION,
+    MICROSERVICE_MODEL_REVISION_PATTERN,
 )
 from opencontractserver.pipeline.base.embedder import BaseEmbedder
 from opencontractserver.pipeline.base.exceptions import (
@@ -116,6 +122,7 @@ class MicroserviceEmbedder(BaseEmbedder):
     description = "Generates embeddings using a vector embeddings microservice."
     author = "OpenContracts Team"
     dependencies = ["numpy", "requests"]
+    accounting_version = MICROSERVICE_ACCOUNTED_EMBEDDING_VERSION
     vector_size = 384  # Default embedding size
     supported_file_types = [
         FileTypeEnum.PDF,
@@ -172,6 +179,37 @@ class Settings:
                 )
             },
         )
+        embedding_model_revision: str = field(
+            default="",
+            metadata={
+                "pipeline_setting": PipelineSetting(
+                    setting_type=SettingType.OPTIONAL,
+                    description=(
+                        "Deployed model and immutable revision (model@revision). "
+                        "Required for policy-bound ingestion; update when the model changes."
+                    ),
+                    validation=lambda value: isinstance(value, str)
+                    and (
+                        not value
+                        or re.fullmatch(MICROSERVICE_MODEL_REVISION_PATTERN, value)
+                        is not None
+                    ),
+                )
+            },
+        )
+        no_external_provider_fees: bool = field(
+            default=False,
+            metadata={
+                "pipeline_setting": PipelineSetting(
+                    setting_type=SettingType.OPTIONAL,
+                    description=(
+                        "Operator confirms this self-hosted service has no external "
+                        "provider fees. Infrastructure costs are excluded from run budgets."
+                    ),
+                    validation=lambda value: type(value) is bool,
+                )
+            },
+        )
 
     def __init__(self, **kwargs):
         """Initialize MicroserviceEmbedder with settings from PipelineSettings."""
@@ -213,6 +251,30 @@ def _get_service_config(self, all_kwargs: dict) -> tuple[str, dict]:
 
         return service_url, headers
 
+    def embed_text_accounted(self, text: str) -> tuple[list[float], int]:
+        """One bounded request for an explicitly approved self-hosted run.
+
+        Zero denotes billable provider tokens, not measured inference usage.
+        Infrastructure is outside the run budget. The run owns every retry;
+        neither the ordinary retrying session nor redirects may repeat a POST.
+        """
+        service_url, headers = self._get_service_config(self.get_component_settings())
+        with requests.Session() as session:
+            session.mount("http://", HTTPAdapter(max_retries=0))
+            session.mount("https://", HTTPAdapter(max_retries=0))
+            response = session.post(
+                f"{service_url.rstrip('/')}/embeddings",
+                json={"text": text[:OPENAI_EMBEDDER_MAX_INPUT_CHARS]},
+                headers=headers,
+                timeout=EMBEDDER_SINGLE_REQUEST_TIMEOUT_SECONDS,
+                allow_redirects=False,
+            )
+            if response.status_code != 200:
+                # Never expose a provider response, endpoint or credential.
+                raise ValueError("embedding_request_failed")
+            vector = normalize_embedding_vector(embedding_values(response.json()))
+        return vector, 0
+
     def _embed_text_impl(self, text: str, **all_kwargs) -> Optional[list[float]]:
         """
         Generate embeddings from text using the microservice.
```

**File**: `opencontractserver/tests/test_ingestion_run_microservice.py` (added, +412/-0)
```diff
@@ -0,0 +1,412 @@
+"""Policy-bound self-hosted embeddings use normal readiness and retry machinery."""
+
+import hashlib
+import json
+from types import SimpleNamespace
+from unittest.mock import MagicMock, patch
+from uuid import uuid4
+
+import requests
+from django.contrib.auth import get_user_model
+from django.core.files.base import ContentFile
+from django.test import SimpleTestCase, TransactionTestCase, override_settings
+from django.utils import timezone
+from rest_framework.test import APIClient
+
+from config.graphql.schema import schema
+from config.graphql.testing import Client
+from opencontractserver.annotations.models import Embedding, LabelSet
+from opencontractserver.constants.document_processing import (
+    EMBEDDER_SINGLE_REQUEST_TIMEOUT_SECONDS,
+    OPENAI_EMBEDDER_MAX_INPUT_CHARS,
+)
+from opencontractserver.constants.embeddings import MICROSERVICE_EMBEDDER_PATH as MICRO
+from opencontractserver.corpuses.models import Corpus
+from opencontractserver.documents.models import Document, PipelineSettings
+from opencontractserver.documents.readiness import assess_document, effective_embedder
+from opencontractserver.pipeline.embedders.sent_transformer_microservice import (
+    MicroserviceEmbedder,
+)
+from opencontractserver.tests.test_ingestion_run_budget import PREPARATION
+from opencontractserver.tests.test_worker_uploads import (
+    _make_fake_pdf,
+    _structural_metadata,
+)
+from opencontractserver.utils.embedding_identity import embedding_configuration
+from opencontractserver.worker_uploads.models import (
+    CorpusAccessToken,
+    UploadStatus,
+    WorkerAccount,
+)
+from opencontractserver.worker_uploads.run_models import (
+    IngestionReservation,
+    IngestionRun,
+)
+from opencontractserver.worker_uploads.run_policy import RunPolicyError
+from opencontractserver.worker_uploads.run_services import (
+    control_run,
+    create_run,
+    execute_reservation,
+    route_embedding,
+    run_report,
+)
+from opencontractserver.worker_uploads.tasks import _process_single_upload
+from opencontractserver.worker_uploads.upload_recovery import stage_upload
+
+SERVICE_SETTINGS = {
+    "embeddings_microservice_url": "https://embedder.invalid",
+    "vector_embedder_api_key": "private-service-key",
+    "embedding_model_revision": "multi-qa-MiniLM-L6-cos-v1@immutable-revision",
+    "no_external_provider_fees": True,
+}
+
+
+@override_settings(INGESTION_RUN_PRICING={}, EMBEDDING_MODEL_REVISIONS={})
+class MicroserviceIngestionRunTests(TransactionTestCase):
+    def setUp(self):
+        nudge = patch("opencontractserver.worker_uploads.run_services._nudge")
+        nudge.start()
+        self.addCleanup(nudge.stop)
+        self.user = get_user_model().objects.create_superuser(
+            "sentence-owner", "sentence@example.com", "pw"
+        )
+        account = WorkerAccount.create_with_user(
+            name="Sentence worker", creator=self.user
+        )
+        self.pipeline = PipelineSettings.get_instance(use_cache=False)
+        self.pipeline.default_embedder = MICRO
+        self.pipeline.component_settings = {MICRO: dict(SERVICE_SETTINGS)}
+        self.pipeline.save()
+        self.addCleanup(PipelineSettings.clear_cache)
+        self.corpus = Corpus.objects.create(
+            title="Sentence corpus",
+            creator=self.user,
+            label_set=LabelSet.objects.create(title="Labels", creator=self.user),
+        )
+        self.token, self.key = CorpusAccessToken.create_token(
+            worker_account=account, corpus=self.corpus
+        )
+        self.assertEqual(self.corpus.preferred_embedder, MICRO)
+
+    def test_public_settings_and_run_apis_enable_default_service_with_zero_ceiling(
+        self,
+    ):
+        client = Client(schema, context_value=SimpleNamespace(user=self.user))
+        mutation = """
+            mutation Configure($componentSettings: GenericScalar, $embedder: String) {
+                updatePipelineSettings(
+                    componentSettings: $componentSettings, defaultEmbedder: $embedder
+                ) { ok message }
+            }
+        """
+        config = {
+            key: value
+            for key, value in SERVICE_SETTINGS.items()
+            if key != "vector_embedder_api_key"
+        }
+        result = client.execute(
+            mutation,
+            variables={"componentSettings": {MICRO: config}, "embedder": MICRO},
+        )
+        self.assertIsNone(result.get("errors"), result)
+        self.assertTrue(result["data"]["updatePipelineSettings"]["ok"], result)
+        # Corpus.save normally snapshots the default; an unset preference must
+        # also resolve through the application-configured default at run creation.
+        Corpus.objects.filter(pk=self.corpus.pk).update(preferred_embedder="")
+        self.corpus.refresh_from_db()
+        api = APIClient()
+        api.credentials(HTTP_AUTHORIZATION=f"WorkerKey {self.key}")
+        response = api.post(
+            "/
```

**File**: `opencontractserver/utils/embedding_identity.py` (modified, +10/-2)
```diff
@@ -7,14 +7,16 @@
 
 from django.conf import settings
 
+from opencontractserver.constants.embeddings import MICROSERVICE_EMBEDDER_PATH
+
 logger = logging.getLogger(__name__)
 
 
 def embedding_configuration(embedder) -> str:
     """Hash model, dimension and non-secret settings; never expose credentials.
 
-    Operators must bump EMBEDDING_MODEL_REVISIONS when a service changes its
-    model in place without changing its URL or component settings.
+    Operators must update the component's model revision or
+    EMBEDDING_MODEL_REVISIONS when a service changes its model in place.
     """
     path = f"{type(embedder).__module__}.{type(embedder).__name__}"
     config = embedder.get_component_settings()
@@ -31,6 +33,12 @@ def embedding_configuration(embedder) -> str:
             word in key.lower() for word in ("key", "token", "secret", "password")
         )
     }
+    if path == MICROSERVICE_EMBEDDER_PATH:
+        # Billing does not alter vectors. Preserve legacy identities until the
+        # operator supplies the newly supported model revision setting.
+        config.pop("no_external_provider_fees", None)
+        if not config.get("embedding_model_revision"):
+            config.pop("embedding_model_revision", None)
     payload = [
         path,
         embedder.vector_size,
```

**File**: `opencontractserver/worker_uploads/run_policy.py` (modified, +85/-27)
```diff
@@ -1,15 +1,16 @@
 """Versioned, secret-free policy for the supported bounded processing adapter.
 
-Only first-party OpenAI text embeddings currently expose bounded input and
-accounted usage. Unpriced/custom providers, parsing, multimodal fallbacks and
-automatic corpus actions are deliberately unavailable to policy-bound runs.
+First-party OpenAI and explicitly declared self-hosted sentence embeddings expose
+bounded input and accounted provider fees. Unpriced/custom providers, parsing,
+multimodal fallbacks and automatic corpus actions are unavailable to bound runs.
 External worker preparation and infrastructure costs are explicitly excluded.
 """
 
 import hashlib
 import json
 import re
 from decimal import ROUND_CEILING, Decimal, InvalidOperation
+from urllib.parse import urlsplit
 
 from django.conf import settings
 
@@ -18,6 +19,8 @@
     OPENAI_EMBEDDER_MAX_INPUT_CHARS,
 )
 from opencontractserver.constants.embeddings import (
+    MICROSERVICE_EMBEDDER_PATH,
+    MICROSERVICE_MODEL_REVISION_PATTERN,
     OPENAI_API_BASE_URL,
     OPENAI_EMBEDDER_PATH,
     OPENAI_MODEL_DIMENSIONS,
@@ -30,6 +33,9 @@
 )
 from opencontractserver.documents.models import PipelineSettings
 from opencontractserver.pipeline.embedders.openai_embedder import OpenAIEmbedder
+from opencontractserver.pipeline.embedders.sent_transformer_microservice import (
+    MicroserviceEmbedder,
+)
 from opencontractserver.pipeline.utils import get_component_by_name
 from opencontractserver.utils.embedding_identity import embedding_configuration
 
@@ -67,28 +73,63 @@ def resolve_provider(corpus):
     pipeline = PipelineSettings.get_instance(use_cache=False)
     corpus.refresh_from_db(fields=["preferred_embedder"])
     path = corpus.preferred_embedder or pipeline.get_default_embedder()
-    if path != OPENAI_EMBEDDER_PATH or not pipeline.is_component_enabled(path):
+    supported: dict[str, type[OpenAIEmbedder] | type[MicroserviceEmbedder]] = {
+        OPENAI_EMBEDDER_PATH: OpenAIEmbedder,
+        MICROSERVICE_EMBEDDER_PATH: MicroserviceEmbedder,
+    }
+    if path not in supported or not pipeline.is_component_enabled(path):
         raise RunPolicyError("unbounded_provider")
     try:
         cls = get_component_by_name(path)
-        if cls is not OpenAIEmbedder:
+        if cls is not supported[path]:
             raise RunPolicyError("unbounded_provider")
-        provider = OpenAIEmbedder(
+        provider = supported[path](
             component_settings=pipeline.get_full_component_settings(path)
         )
-        config = provider._effective_settings
-        model = config.openai_embedding_model
-        base_url = config.openai_api_base_url
-        if model not in OPENAI_MODEL_DIMENSIONS or base_url not in (
-            "",
-            OPENAI_API_BASE_URL,
-        ):
-            raise RunPolicyError("unbounded_provider")
-        if (
-            provider.vector_size not in SUPPORTED_DIMENSIONS
-            or provider.vector_size > OPENAI_MODEL_DIMENSIONS[model]
-        ):
+        if provider.vector_size not in SUPPORTED_DIMENSIONS:
             raise RunPolicyError("unsupported_embedding_dimension")
+        if isinstance(provider, OpenAIEmbedder):
+            config = provider._effective_settings
+            model = config.openai_embedding_model
+            if (
+                model not in OPENAI_MODEL_DIMENSIONS
+                or config.openai_api_base_url
+                not in (
+                    "",
+                    OPENAI_API_BASE_URL,
+                )
+            ):
+                raise RunPolicyError("unbounded_provider")
+            if provider.vector_size > OPENAI_MODEL_DIMENSIONS[model]:
+                raise RunPolicyError("unsupported_embedding_dimension")
+            endpoint = OPENAI_API_BASE_URL
+        else:
+            service_config = provider.settings
+            if not isinstance(service_config, MicroserviceEmbedder.Settings):
+                raise RunPolicyError("provider_configuration_unavailable")
+            if service_config.no_external_provider_fees is not True:
+                raise RunPolicyError("unknown_pricing")
+            # Configure through the pipeline settings GUI/API. The existing
+            # deployment revision setting remains a backwards-compatible fallback.
+            model = service_config.embedding_model_revision or getattr(
+                settings, "EMBEDDING_MODEL_REVISIONS", {}
+            ).get(path, "")
+            if not isinstance(model, str) or not re.fullmatch(
+                MICROSERVICE_MODEL_REVISION_PATTERN, model
+            ):
+                raise RunPolicyError("provider_model_revision_required")
+            url = service_config.embeddings_microservice_url
+            parsed = urlsplit(url)
+            if (
+                parsed.scheme not in ("http", "https")
+                or not parsed.hostname
+                or parsed.username is not None
+                or parsed.password is not None
+       
```

---

### Incident Patch 14: `bc122446` (2026-09-15)
**Commit Message**: chore(deps): update openai requirement from <4,>=3.8.0 to >=3.13.0,<4

Updates the requirements on [openai](https://github.com/openai/openai-python) to permit the latest version.
- [Release notes](https://github.com/openai/openai-python/releases)
- [Changelog](https://github.com/openai/openai-python/blob/main/CHANGELOG.md)
- [Commits](https://github.com/openai/openai-python/compare/v3.8.0...v3.13.0)

---
updated-dependencies:
- dependency-name: openai
  dependency-version: 3.13.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `requirements/base.txt` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ drf-extra-fields==3.7.0  # https://github.com/Hipo/drf-extra-fields
 pypdf>=6.16.2,<7  # https://github.com/py-pdf/pypdf
 plasmapdf==0.1.3  # https://github.com/Jsv4/plasmapdf
 pdf2image>=1.17.0
-openai>=3.8.0,<4  # https://github.com/openai/openai-python (pydantic-ai 1.x requires >=2.11.0)
+openai>=3.13.0,<4  # https://github.com/openai/openai-python (pydantic-ai 1.x requires >=2.11.0)
 # Bumping pydantic-ai is a deliberate decision: this codebase relies on the
 # precedence rule that ``instructions=`` (not ``system_prompt=``) is the only
 # way to deliver a system instruction when ``message_history`` is non-empty
```

---

### Incident Patch 15: `a8900c5c` (2026-09-15)
**Commit Message**: Merge pull request #2372 from Open-Source-Legal/fix/2220-unchanged-import-relationships

Preserve relationships through unchanged document imports

**File**: `changelog.d/2220-incremental-relationships.fixed.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+- Preserve relationship endpoints on unchanged documents during incremental
+  corpus imports (#2220). `utils.importing.recover_annotation_id_map` matches
+  incoming anchors to existing annotations without parsing or duplicating them;
+  `tasks.import_tasks_v2` includes those IDs in relationship fan-in and logs
+  unresolved endpoints.
```

**File**: `docs/development/2026-06-06-v2-import-reingest-remap.md` (modified, +9/-0)
```diff
@@ -326,6 +326,15 @@ chunked across rows keyed by `import_run_id` without changing the fan-in contrac
 
 ### 6.4 Lifecycle & exactly-once finalization
 
+Unchanged targeted imports also contribute a populated `DONE` id-map.
+`utils.importing.recover_annotation_id_map` matches the incoming annotation's
+label, text, location, and metadata against readable annotations on the same
+document and corpus. It also runs the existing anchorer against
+the stored PAWLs/text layer; it does not parse source bytes or create annotations.
+This works when a new archive renumbers export-local IDs or changes import mode.
+Missing or ambiguous
+matches remain unmapped, and `_import_v2_relationships` logs any lost endpoints.
+
 1. **Enumerate (in `_import_corpus`, reingest mode):**
    - Mint `import_run_id = uuid4()` once for the import.
    - If `relationships_data` is non-empty, create
```

**File**: `opencontractserver/tasks/import_tasks_v2.py` (modified, +38/-16)
```diff
@@ -68,6 +68,7 @@
     create_document_from_export_data,
     import_doc_annotations,
     prepare_import_labels,
+    recover_annotation_id_map,
 )
 from opencontractserver.utils.packaging import (
     unpack_corpus_from_export,
@@ -694,30 +695,27 @@ def _import_document_with_annotations(
                     # annotations on the same Document.
                     corpus_doc.backend_lock = False
                     corpus_doc.save(update_fields=["backend_lock", "modified"])
-                    # Still record the run's terminal row before returning.
-                    # ``_reingest_document_with_deferred_remap`` does this for
-                    # the converged documents it handles; this sibling branch —
-                    # reached when reingest was requested but the source is not
-                    # reingestable (e.g. a markdown/text pack member) and the
-                    # document matched an existing one by canonical_key — used
-                    # to return early without one. That left the document
-                    # invisible to ``finalize_corpus_import_relationships``:
-                    # the corpus-level coordination row could not reach DONE on
-                    # its account and ``expected_doc_count`` undercounted.
-                    # (The id_map is empty here for the same reason it is in
-                    # the converged path — see issue #2220, which tracks
-                    # relationship endpoints landing on unchanged documents.)
+                    annot_id_map = recover_annotation_id_map(
+                        doc_data=doc_data,
+                        corpus_doc=corpus_doc,
+                        corpus_obj=corpus_obj,
+                        user=user_obj,
+                        label_lookup=label_lookup,
+                        include_structural=True,
+                    )
+                    # Include the unchanged member in relationship fan-in
+                    # without dispatching a parser chain.
                     if import_run_id is not None:
                         PendingDocumentAnnotations.objects.create(
                             document=corpus_doc,
                             corpus=corpus_obj,
                             creator=user_obj,
                             ingestion_run_id=import_run_id,
                             payload={},
-                            id_map={},
+                            id_map={str(k): v for k, v in annot_id_map.items()},
                             status=PendingDocumentAnnotations.Status.DONE,
                         )
-                    return corpus_doc, {}
+                    return corpus_doc, annot_id_map
                 doc_obj = corpus_doc
             else:
                 # Create standalone document using shared helper
@@ -912,13 +910,21 @@ def _reingest_document_with_deferred_remap(
                 # enumerated document.  Recording DONE here lets the corpus-level
                 # coordination row reach DONE even when every source byte and
                 # every annotation payload is unchanged.
+                annot_id_map = recover_annotation_id_map(
+                    doc_data=doc_data,
+                    corpus_doc=corpus_doc,
+                    corpus_obj=corpus_obj,
+                    user=user_obj,
+                    label_lookup=label_lookup,
+                    include_structural=False,
+                )
                 PendingDocumentAnnotations.objects.create(
                     document=corpus_doc,
                     corpus=corpus_obj,
                     creator=user_obj,
                     ingestion_run_id=import_run_id,
                     payload={},
-                    id_map={},
+                    id_map={str(k): v for k, v in annot_id_map.items()},
                     status=PendingDocumentAnnotations.Status.DONE,
                 )
 
@@ -1476,6 +1482,22 @@ def _import_v2_relationships(
             if (new_id := annot_id_map.get(str(old_id))) is not None
         ]
 
+        missing_sources = len(rel_data.get("source_annotation_ids", [])) - len(
+            source_ids
+        )
+        missing_targets = len(rel_data.get("target_annotation_ids", [])) - len(
+            target_ids
+        )
+        if missing_sources or missing_targets:
+            logger.warning(
+                "Relationship '%s' in corpus %s lost %s source and %s target "
+                "endpoint(s): no imported annotation mapping",
+                label_text,
+                corpus_obj.pk,
+                missing_sources,
+                missing_targets,
+            )
+
         if source_ids and target_ids:
             # Get document from first source annotation
             first_source_annot = Annotation.objects.get(id=source_ids[0])
```

**File**: `opencontractserver/tests/test_incremental_import_relationships.py` (added, +385/-0)
```diff
@@ -0,0 +1,385 @@
+"""Incremental imports must resolve both sides of a cross-document edge."""
+
+import io
+import json
+import uuid
+import zipfile
+
+from django.contrib.auth import get_user_model
+from django.core.files.base import ContentFile
+from django.test import TestCase
+from django.utils import timezone
+
+from opencontractserver.annotations.models import (
+    RELATIONSHIP_LABEL,
+    TOKEN_LABEL,
+    Annotation,
+    AnnotationLabel,
+    LabelSet,
+    Relationship,
+)
+from opencontractserver.corpuses.models import Corpus
+from opencontractserver.documents.models import (
+    DocumentPath,
+    PendingCorpusImport,
+    PendingDocumentAnnotations,
+)
+from opencontractserver.tasks.doc_tasks import (
+    finalize_corpus_import_relationships,
+    remap_pending_annotations,
+)
+from opencontractserver.tasks.import_tasks_v2 import _import_document_with_annotations
+from opencontractserver.tests.test_import_v2_reingest_remap import _PAWLS_V1
+from opencontractserver.utils.importing import import_annotations
+
+
+class IncrementalRelationshipImportTests(TestCase):
+    def setUp(self):
+        self.user = get_user_model().objects.create_user(username="pack-importer")
+        labelset = LabelSet.objects.create(title="Pack labels", creator=self.user)
+        self.label = AnnotationLabel.objects.create(
+            text="CLAUSE", label_type=TOKEN_LABEL, creator=self.user
+        )
+        self.rel_label = AnnotationLabel.objects.create(
+            text="references", label_type=RELATIONSHIP_LABEL, creator=self.user
+        )
+        labelset.annotation_labels.add(self.label, self.rel_label)
+        self.corpus = Corpus.objects.create(
+            title="Target pack", creator=self.user, label_set=labelset
+        )
+        self.labels = {"clause-label": self.label}
+        self.a, self.ann_a = self._seed("a.txt", "Tenant pays rent.", "pays rent")
+        self.b, self.ann_b = self._seed(
+            "b.txt", "Landlord insures property.", "insures property"
+        )
+
+    def _annotation(self, export_id, content, phrase):
+        start = content.index(phrase)
+        return {
+            "id": export_id,
+            "annotationLabel": "clause-label",
+            "rawText": phrase,
+            "page": 0,
+            "annotation_json": {
+                "start": start,
+                "end": start + len(phrase),
+                "text": phrase,
+            },
+        }
+
+    def _seed(self, filename, content, phrase, source=None):
+        doc, _, _ = self.corpus.import_content(
+            content=source if source is not None else content.encode(),
+            user=self.user,
+            filename=filename,
+            path=f"/{filename}",
+            title=filename,
+            file_type="text/plain",
+            processing_started=timezone.now(),
+        )
+        doc.txt_extract_file.save("text.txt", ContentFile(content.encode()))
+        ids = import_annotations(
+            user_id=self.user.pk,
+            doc_obj=doc,
+            corpus_obj=self.corpus,
+            annotations_data=[self._annotation("old-id", content, phrase)],
+            label_lookup=self.labels,
+            dispatch_embeddings=False,
+        )
+        return doc, Annotation.objects.get(pk=ids["old-id"])
+
+    def _refresh(
+        self,
+        doc,
+        content,
+        phrase,
+        export_id,
+        run_id,
+        *,
+        reingest=True,
+        source=None,
+        annotation=None,
+    ):
+        data = {
+            "title": doc.title,
+            "content": content,
+            "file_type": doc.file_type,
+            "pawls_file_content": [],
+            "labelled_text": [
+                annotation or self._annotation(export_id, content, phrase)
+            ],
+        }
+        buffer = io.BytesIO()
+        with zipfile.ZipFile(buffer, "w") as archive:
+            archive.writestr(
+                doc.title, source if source is not None else content.encode()
+            )
+        buffer.seek(0)
+        with zipfile.ZipFile(buffer) as archive:
+            imported, ids = _import_document_with_annotations(
+                doc_filename=doc.title,
+                doc_data=data,
+                import_zip=archive,
+                user_obj=self.user,
+                corpus_obj=self.corpus,
+                label_lookup=self.labels,
+                doc_label_lookup={},
+                reingest_and_remap=reingest,
+                import_run_id=run_id,
+                identity_target_path=DocumentPath.objects.get(
+                    document=doc, corpus=self.corpus, is_current=True
+                ),
+            )
+        self.assertIsNotNone(imported)
+        return imported, ids
+
+    def _finalize(self, run_id, source_id, target_id):
+        coordination = PendingCorpusImport.objects.create(
+            import_run_id=run_id,
+            corpus=self.corpus,
+            creator=self.user,
+            expected_doc_count
```

**File**: `opencontractserver/utils/importing.py` (modified, +109/-1)
```diff
@@ -13,6 +13,7 @@
     from opencontractserver.documents.models import Document
 
 from config.graphql.annotation_serializers import AnnotationLabelSerializer
+from opencontractserver.annotations.compact_json import compact_annotation_json
 from opencontractserver.annotations.models import (
     DOC_TYPE_LABEL,
     RELATIONSHIP_LABEL,
@@ -26,7 +27,10 @@
     OpenContractsRelationshipPythonType,
 )
 from opencontractserver.types.enums import PermissionTypes
-from opencontractserver.utils.compact_pawls import compact_pawls_pages
+from opencontractserver.utils.compact_pawls import (
+    compact_pawls_pages,
+    expand_pawls_pages,
+)
 from opencontractserver.utils.permissioning import set_permissions_for_obj_to_user
 
 logger = logging.getLogger(__name__)
@@ -560,6 +564,110 @@ def create_document_from_export_data(
     return doc_obj
 
 
+def recover_annotation_id_map(
+    *,
+    doc_data: Mapping[str, Any],
+    corpus_doc,
+    corpus_obj,
+    user,
+    label_lookup: dict[str, AnnotationLabel],
+    include_structural: bool,
+) -> dict[str | int, int]:
+    """Match an unchanged document's incoming anchors to its existing annotations.
+
+    Export IDs are archive-local, so replaying an older run's map can bind an
+    endpoint to the wrong annotation. Match both exported locations and anchors
+    rebuilt from retained layers: an earlier import may have used a different
+    mode. Never create or guess an annotation when a match is missing or ambiguous.
+    """
+    from opencontractserver.annotations.services import AnnotationService
+    from opencontractserver.utils.annotation_anchoring import anchor_annotations
+
+    annotations = [
+        annotation
+        for annotation in doc_data.get("labelled_text", [])
+        if include_structural or not annotation.get("structural")
+    ]
+    if not annotations:
+        return {}
+    pawls = []
+    content = ""
+    try:
+        if corpus_doc.pawls_parse_file:
+            with corpus_doc.pawls_parse_file.open("rb") as source:
+                pawls = expand_pawls_pages(json.load(source))
+        if corpus_doc.txt_extract_file:
+            with corpus_doc.txt_extract_file.open("rb") as source:
+                content = source.read().decode("utf-8")
+    except (OSError, ValueError):
+        logger.warning(
+            "Cannot read stored annotation layers for unchanged document %s; "
+            "only exact exported locations can be recovered",
+            corpus_doc.pk,
+            exc_info=True,
+        )
+    else:
+        anchored, _report = anchor_annotations(
+            annotations,
+            is_pdf=(corpus_doc.file_type or "").lower() == "application/pdf",
+            pawls=pawls,
+            content=content,
+        )
+        # Switching import modes must not discard the prior layer's endpoints.
+        annotations = annotations + anchored
+
+    candidates: dict[tuple[Any, ...], list[Annotation]] = {}
+    for existing in AnnotationService.get_corpus_annotations(
+        corpus_obj.pk, user
+    ).filter(document=corpus_doc):
+        key = (
+            existing.annotation_label_id,
+            existing.raw_text,
+            existing.page,
+            existing.structural,
+        )
+        candidates.setdefault(key, []).append(existing)
+
+    matches_by_id: dict[str | int, set[int]] = {}
+    for annotation in annotations:
+        label = label_lookup.get(str(annotation.get("annotationLabel")))
+        old_id = annotation.get("id")
+        if label is None or old_id is None:
+            continue
+        key = (
+            label.pk,
+            annotation.get("rawText"),
+            annotation.get("page", 1),
+            annotation.get("structural", False),
+        )
+        location = compact_annotation_json(annotation.get("annotation_json"))
+        matches_by_id.setdefault(old_id, set()).update(
+            item.pk
+            for item in candidates.get(key, [])
+            if compact_annotation_json(item.json) == location
+            and item.annotation_type
+            == (annotation.get("annotation_type") or TOKEN_LABEL)
+            and item.long_description == annotation.get("long_description")
+            and item.content_modalities == annotation.get("content_modalities", [])
+            and item.link_url == (annotation.get("link_url") or None)
+            # V2/V3 exports omit data; absent sidecars cannot identify a mismatch.
+            and ("data" not in annotation or item.data == (annotation["data"] or None))
+        )
+    recovered: dict[str | int, int] = {}
+    for old_id, matches in matches_by_id.items():
+        if len(matches) == 1:
+            recovered[old_id] = next(iter(matches))
+        else:
+            logger.warning(
+                "Cannot recover annotation %s on unchanged document %s: "
+                "%s matching annotations",
+                old_id,
+                corpus_doc.pk,
+                len(matches),
+            )
+    return recove
```

#### Recent Merged Pull Requests:
- **PR #2406** (2026-09-24): chore(deps): bump posthog from 7.53.0 to 7.58.0 (@dependabot[bot])
- **PR #2405** (2026-09-24): chore(deps): update openai requirement from <4,>=3.13.0 to >=3.16.2,<4 (@dependabot[bot])
- **PR #2404** (2026-09-24): chore(deps): update pypdf requirement from <7,>=6.18.1 to >=6.19.0,<7 (@dependabot[bot])
- **PR #2403** (2026-09-24): Bulk embeddings pool for ingest (remediates #2282) (@JSv4)
- **PR #2402** (2026-09-24): Carry annotations and relationships onto new versions, flagged until reviewed (@JSv4)
- **PR #2401** (2026-09-24): Use identity checks for type comparisons; drop mutable default in run_post_processors (@JSv4)
- **PR #2399** (2026-09-23): chore(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1 (@dependabot[bot])
- **PR #2398** (2026-09-23): Review fixes for #2391: cross-corpus historical reads, unactionable review state, CI (@JSv4)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): megh-bari/pattern-craft

> **Canonical Artifact**: `07_PROJECT_LEARNING/megh-bari-pattern-craft-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/megh-bari/pattern-craft](https://github.com/megh-bari/pattern-craft))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:27:51.349Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `megh-bari/pattern-craft`
- **Description**: Professional-grade background patterns and gradients for your websites and apps. Easily copy and paste into your next project. Crafted with modern CSS and Tailwind for seamless integration.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3084 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.mjs`
```
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;

```

### Core Architecture Module: `next.config.ts`
```
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

```

### Core Architecture Module: `postcss.config.mjs`
```
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;

```

### Core Architecture Module: `src/app/layout.tsx`
```
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import type React from "react";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/providers/theme-provider";
import {
  defaultMetadata,
  defaultViewport,
} from "@/lib/metadata";

import "./globals.css";

export const metadata: Metadata = defaultMetadata;
export const viewport: Viewport = defaultViewport;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.className} bg-background text-foreground antialiased min-h-screen flex items-center justify-center`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
            <Analytics />
            <SpeedInsights />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

```

### Core Architecture Module: `src/app/not-found.tsx`
```
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </Button>
      </div>
    </div>
  );
}

```

### Core Architecture Module: `src/app/page.tsx`
```
import type { Metadata } from "next";

import HomePage from "@/components/home/home-page";
import { createPageMetadata, siteConfig } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: siteConfig.title,
  description: siteConfig.description,
  path: "/",
});

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      url: `${siteConfig.url}/`,
      name: siteConfig.name,
      description: siteConfig.description,
      inLanguage: "en-US",
      publisher: {
        "@id": `${siteConfig.url}/#organization`,
      },
    },
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: `${siteConfig.url}/`,
      sameAs: [siteConfig.creator.url, "https://x.com/meghtrix"],
    },
    {
      "@type": "WebApplication",
      "@id": `${siteConfig.url}/#application`,
      name: siteConfig.name,
      url: `${siteConfig.url}/`,
      description: siteConfig.description,
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "Web Design Tool",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser",
      inLanguage: "en-US",
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: 0,
        priceCurrency: "USD",
      },
      author: {
        "@type": "Person",
        name: siteConfig.creator.name,
        url: siteConfig.creator.url,
      },
      featureList: [
        "250+ CSS and Tailwind background patterns",
        "Live pattern previews",
        "Copy-ready CSS and Tailwind snippets",
      ],
      image: `${siteConfig.url}${siteConfig.ogImage}`,
      screenshot: [1, 2, 3].map(
        (number) => `${siteConfig.url}/snapshots/screenshot-${number}.png`,
      ),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <HomePage />
    </>
  );
}

```

### Core Architecture Module: `src/app/robots.ts`
```
import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}

```

### Core Architecture Module: `src/app/sitemap.ts`
```
import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteConfig.url}/`,
      changeFrequency: "weekly",
      priority: 1,
      images: [`${siteConfig.url}${siteConfig.ogImage}`],
    },
  ];
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #146** (2026-09-02): **feat: add beach effect pattern**
  *Symptoms*: Add new gradient effect like beach.  <img width="1578" height="1084" alt="beach-d" src="https://github.com/user-attachments/assets/cd7a4aac-a73c-4cc6-85eb-4e5d57556273" />  <img width="612" height="1084" alt="beach-m" src="https://github.com/user-attachments/assets/55e5dc5a-37aa-43c8-9fe0-109e010bdf8e" />   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Added a new “Beach” effects pattern featuring a beige base with layered beach and sunset gradients.   * Included ready-to-use JSX code for applying the pattern.   * Marked the pattern as “New” in the pattern collection.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > @orvek is attempting to deploy a commit to the **patterncraft-team** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=patterncraft-team&slug=patterncraft-team&teamId=team_LyWhHHyM68vbciMRml91VmfF&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22d36a8d515d507381447871fa41ea511e90defb44%22%7D%2C%22id%22%3A%22QmamV3dF72hfbN6CrXyfbttCRCL8oVPhqgnS68JHhtY8hA%22%2C%22org%22%3A%22megh-bari%22%2C%22prId%22%3A146%2C%22repo%22%3A%22pattern-craft%22%7D).  
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/megh-bari/pattern-craft/pull/146)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `b1df16f7-91d2-4c1f-86e0-ccee6776d617`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between d4c442f72b27d36567148265880ad7f293e5b926 and d36a8d515d507381447871fa41ea511e90defb44.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `src/data/patterns.ts`  </details>  **Included review a

- **Issue #145** (2026-08-17): **fix: update star history chart to working host**
  *Symptoms*: The star history chart in the README is currently broken because the old host can no longer render it reliably due to GitHub stargazer API restrictions. This PR points the chart and its link to a working host so the chart displays correctly again.  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Updated the README’s Star History links and chart sources to use the new hosting domain.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > @Dessalines39394 is attempting to deploy a commit to the **patterncraft-team** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=patterncraft-team&slug=patterncraft-team&teamId=team_LyWhHHyM68vbciMRml91VmfF&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%228c4d4914f80e406613c0e4aa34ff7e9115db55d3%22%7D%2C%22id%22%3A%22QmYKd7vQck3CavraRH2jWtb8HvVp5tXvMi4QCUrPBW73mp%22%2C%22org%22%3A%22megh-bari%22%2C%22prId%22%3A145%2C%22repo%22%3A%22pattern-craft%22%7D).  
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/megh-bari/pattern-craft/pull/145?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `0d69a8fb-4b14-40e0-83da-0c36ea5062f3`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 70c35693ae3b3ac70687d684abb33b1992e1240f and 8c4d4914f80e406613c0e4aa34ff7e9115db55d3.  </details>  <details> <summary>📒 Files selected for processin
  > Thenkss bro :)

- **Issue #144** (2026-07-08): **feat: add sponsored placement for Shadcn Studio**
  *Symptoms*: ## Summary - Adds Shadcn Studio as a sponsored ambassador in the hero sponsor section, following the guidelines   ## Test plan - [x] Open the homepage and verify the sponsor row shows shadcnstudio.com - [x] Click the Shadcn Studio sponsor link and verify it opens `shadcnstudio.com` with UTM params - [x] Toggle between light and dark hero patterns and confirm the logo renders correctly in both themes - [x] Check mobile layout — logo and text stack properly on small screens    Thank you so much @ajaypatelaj  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Updated the sponsor banner with new partner content and refreshed branding, including light/dark display variations and improved external link handling.  * **Chores**   * Switched the site’s public URLs to the new `patterncraft.store` domain across the app, README, sitemap, robots file, and SEO metadata so visitors and search engines see the updated address.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > [vc]: #IGYsUiy18bTqMyTV1M7SiXQkQlOom5MuKImb4mnBork=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJwYXR0ZXJuLWNyYWZ0IiwicHJvamVjdElkIjoicHJqX0dodWVVT1FzQmlTRlpBSkt2RHNLWlFpM0pXWWYiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJwYXR0ZXJuLWNyYWZ0LWdpdC1mZWF0LXNoYWRjbi1zdHVkaW8tc3BvbnNvci1tZWdoYmFyaS52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9tZWdoYmFyaS9wYXR0ZXJuLWNyYWZ0LzRxbmlkUlY0bjRScnM4UUJiY29rNWFHcEZYWHUiLCJwcmV2aWV3VXJsIjoicGF0dGVybi1jcmFmdC1naXQtZmVhdC1zaGFkY24tc3R1ZGlvLXNwb25zb3ItbWVnaGJhcmkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [pattern-craft](https://vercel.com/meghbari/pattern-craft) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https:/
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/megh-bari/pattern-craft/pull/144?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  Updates all references from patterncraft.fun to patterncraft.store across funding config, README, sitemap config, robots.txt, sitemap.xml, and app layout metadata/JSON-LD structured data. Separately, replaces the Tal by Grapevine sponsor banner with a new Shadcn Studio sponsor banner in the sponsors component.  ### Changes  **Domain URL migration**  |Layer / File(s)|Summary| |---|---| |**Config and static SEO files** <br> `.github/FUNDING.yml`, `next-sitemap.config.js`, `public/robots.txt`, `public/sitem

- **Issue #141** (2026-09-15): **feat: add subtle white heart grid texture**
  *Symptoms*: Title: feat: add minimalist white heart grid pattern  Description: Added a delicate, sophisticated heart-shaped dot grid designed for white background contexts.  Key Features:  Micro Detail: Each heart is a "tiny spec" (8px wide) to read as a subtle dot from a distance, revealing the heart detail only upon closer inspection.  Minimalist Spacing: Features a wide (24px) grid pattern, ensuring high "negative space" and keeping the aesthetic clean and airy.  Subtle Opacity: Uses low 0.07 opacity grey (rgba(0, 0, 0, 0.07)) to ensure the texture doesn't fight with content or seem like heavy noise.  Perfectly suited for a polished hero section or custom stationery-feel landing pages.  <img width="1916" height="895" alt="image" src="https://github.com/user-attachments/assets/d81e2adc-fe22-4ab1-8f47-94dfef62c884" /> <img width="565" height="833" alt="image" src="https://github.com/user-attachments/assets/51f984fd-5ba3-4e01-82f2-7cfbe19d27b2" />   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  - **New Features**   - Added a heart-themed geometric grid pattern with a white background and subtle repeating heart texture.   - Included a ready-to-use JSX example for the new pattern.   - The pattern is available as a separate selectable design option and uses consistent sizing for a clean, repeatable appearance.   - Existing pattern options remain available alongside the new heart design. <!-- end of auto-generated commen
  **Post-Mortem & Fix Analysis**:
  > @OMEE-Y is attempting to deploy a commit to the **patterncraft-team** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=patterncraft-team&slug=patterncraft-team&teamId=team_LyWhHHyM68vbciMRml91VmfF&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%222e5015f4ba6e5c305b004924e434d5622e3aaea5%22%7D%2C%22id%22%3A%22QmQfsqNca6cFkxvGbKeSyk5aHg8dsBYiUdLZhy6aMb7JZU%22%2C%22org%22%3A%22megh-bari%22%2C%22prId%22%3A141%2C%22repo%22%3A%22pattern-craft%22%7D).  
  > Hi @megh-bari please review this pr 
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/megh-bari/pattern-craft/pull/141#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/megh-bari/pattern-craft/pull/141#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `f1b9808a-5ffd-46fe-84b8-a0e43204284d`  </details>  <d

- **Issue #140** (2026-03-28): **fix: update ShadcnCraft link and improve SVG rendering in Sponsors co…**
  *Symptoms*: …mponent
  **Post-Mortem & Fix Analysis**:
  > [vc]: #Z+CAtxWMWJlRVkcfBc6ZqzqCqwW7T7Z/6+zyYeHi49E=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJwYXR0ZXJuLWNyYWZ0IiwicHJvamVjdElkIjoicHJqX0dodWVVT1FzQmlTRlpBSkt2RHNLWlFpM0pXWWYiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWVnaGJhcmkvcGF0dGVybi1jcmFmdC9GTEdnRVM2NWhMSkxTVDNYc1B0N1IzMktKa1Z1IiwicHJldmlld1VybCI6InBhdHRlcm4tY3JhZnQtZ2l0LXNoYWRjbmNyYWZ0LXN2Zy11cGRhdGUtbWVnaGJhcmkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJwYXR0ZXJuLWNyYWZ0LWdpdC1zaGFkY25jcmFmdC1zdmctdXBkYXRlLW1lZ2hiYXJpLnZlcmNlbC5hcHAifSwidjAiOmZhbHNlfV19 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [pattern-craft](https://vercel.com/meghbari/pattern-craft) | ![Ready](https://vercel.com/static/status/ready.svg)

- **Issue #138** (2026-03-16): **chore: Tal by Grapevine sponsor logo**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #/kxGbGz23Ust/VhKaV7K7fVPY4KdKwx1/FjNfVlXTuM=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJwYXR0ZXJuLWNyYWZ0IiwicHJvamVjdElkIjoicHJqX0dodWVVT1FzQmlTRlpBSkt2RHNLWlFpM0pXWWYiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicGF0dGVybi1jcmFmdC1naXQtYmFja2VkLWJ5LXRhbC1wYXR0ZXJuY3JhZnQtdGVhbS52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9tZWdoYmFyaS9wYXR0ZXJuLWNyYWZ0Lzh2eGFaNlY2bnhmODd0anBkZ0hHbXZOVEpVY2MiLCJwcmV2aWV3VXJsIjoicGF0dGVybi1jcmFmdC1naXQtYmFja2VkLWJ5LXRhbC1wYXR0ZXJuY3JhZnQtdGVhbS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwidjAiOmZhbHNlfV19 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [pattern-craft](https://vercel.com/meghbari/pattern-craft) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/

- **Issue #135** (2026-01-11): **fix: remove stray backticks typo in Hero component stats section**
  *Symptoms*: ## Description  This PR fixes a typo in the Hero component where stray backticks (``) were present in the stats section, causing incorrect rendering of the "CSS & Tailwind" text.  ## Changes Made  - Removed stray backticks from line 226 in `src/components/home/hero.tsx` - Fixed the rendering of the "CSS & Tailwind" stat in the Hero component stats section  ## Location  - **File**: `src/components/home/hero.tsx` - **Line**: 226 - **Component**: Hero stats section <img width="3360" height="1642" alt="image" src="https://github.com/user-attachments/assets/017b5017-7f91-4aaa-9305-a7b726d489c8" />  ## Before  <div className="text-center">``   <div>CSS</div>   <div>& Tailwind</div> </div>  <img width="3360" height="1642" alt="image" src="https://github.com/user-attachments/assets/ad5c189f-e7ac-4201-b196-82a0dc6271c6" />  
  **Post-Mortem & Fix Analysis**:
  > @jawad-ul-hassan is attempting to deploy a commit to the **patterncraft-team** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=patterncraft-team&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%225142a841750c2736b56d96dc1b1c1a2b5470b763%22%7D%2C%22id%22%3A%22QmP3BmeQZYiCN2PsnxGMimhkNFCGzwUtEFZcvnyChENREj%22%2C%22org%22%3A%22megh-bari%22%2C%22prId%22%3A135%2C%22repo%22%3A%22pattern-craft%22%7D).  

- **Issue #134** (2026-01-07): **fix: cta buttton width in mobile screen**
  *Symptoms*: fix the cta button width in mobile screeen, make it w-full and sm:w-auto
  **Post-Mortem & Fix Analysis**:
  > [vc]: #SxNr/xruICqSQtxXSAoznjAP8NfRs0+wuJfGvJYYBUQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJwYXR0ZXJuLWNyYWZ0IiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL21lZ2hiYXJpL3BhdHRlcm4tY3JhZnQvNjFTUDJBTERRNlE1QkM3eEZkMUVnbzN6bjR2ZCIsInByZXZpZXdVcmwiOiJwYXR0ZXJuLWNyYWZ0LWdpdC1maXgtY3RhLWJ1dHRvbi1wYXR0ZXJuY3JhZnQtdGVhbS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dfQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Review | Updated (UTC) | | :--- | :----- | :------ | :------ | | [pattern-craft](https://vercel.com/meghbari/pattern-craft) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/meghbari/pattern-craft/61SP2ALDQ6Q5BC7xFd1Ego3zn4vd) | [Preview](https://pattern-craft-git-fix-cta-button-patterncraft-team.vercel.app) | Jan 7, 2026 7:34pm |  

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

### Incident Patch 1: `d4c442f7` (2026-08-17)
**Commit Message**: Merge pull request #145 from Dessalines39394/fix/star-history-chart

fix: update star history chart to working host

**File**: `README.md` (modified, +4/-4)
```diff
@@ -408,11 +408,11 @@ If you like this project, consider giving it a ⭐️ on GitHub and sharing it w
 
 ## Star History
 
-<a href="https://www.star-history.com/#megh-bari/pattern-craft&Date">
+<a href="https://star-history.dera.page/#megh-bari/pattern-craft&type=Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=megh-bari/pattern-craft&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=megh-bari/pattern-craft&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=megh-bari/pattern-craft&type=Date" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=megh-bari/pattern-craft&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=megh-bari/pattern-craft&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=megh-bari/pattern-craft&type=Date" />
  </picture>
 </a>
 
```

---

### Incident Patch 2: `8c4d4914` (2026-08-17)
**Commit Message**: fix: use working star history chart host

The current star history chart is broken due to GitHub stargazer API restrictions. Switch the README star history chart and link to a working host so the chart renders again.

**File**: `README.md` (modified, +4/-4)
```diff
@@ -408,11 +408,11 @@ If you like this project, consider giving it a ⭐️ on GitHub and sharing it w
 
 ## Star History
 
-<a href="https://www.star-history.com/#megh-bari/pattern-craft&Date">
+<a href="https://star-history.dera.page/#megh-bari/pattern-craft&type=Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=megh-bari/pattern-craft&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=megh-bari/pattern-craft&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=megh-bari/pattern-craft&type=Date" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=megh-bari/pattern-craft&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=megh-bari/pattern-craft&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=megh-bari/pattern-craft&type=Date" />
  </picture>
 </a>
 
```

---

### Incident Patch 3: `5e0e551b` (2026-03-28)
**Commit Message**: fix: correct spelling of ShadcnCraft in Sponsors component

**File**: `src/components/sponsors/sponsors.tsx` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ function Sponsors({ theme }: SponsorsProps) {
  ${isPatternDark ? "text-gray-300 group-hover:text-white" : "text-gray-600 group-hover:text-gray-900"
                     }`}>
                     <span className=" leading-none font-semibold  flex justify-items-start">
-                        shadcraft
+                    shadcncraft
                     </span>
                     <span className={`text-xs sm:text-sm leading-none transition-colors duration-300 ${isPatternDark ? "text-gray-400 group-hover:text-gray-300" : "text-gray-500 group-hover:text-gray-700"
                         }`}>
```

---

### Incident Patch 4: `e720db80` (2026-03-28)
**Commit Message**: fix: update ShadcnCraft link and improve SVG rendering in Sponsors component

**File**: `package-lock.json` (modified, +62/-62)
```diff
@@ -445,9 +445,9 @@
       }
     },
     "node_modules/@eslint/config-array/node_modules/brace-expansion": {
-      "version": "5.0.4",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.4.tgz",
-      "integrity": "sha512-h+DEnpVvxmfVefa4jFbCf5HdH5YMDXRsmKflpf1pILZWRFlTbJpxeU55nJl4Smt5HQaGzg1o6RHFPJaOqnmBDg==",
+      "version": "5.0.5",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.5.tgz",
+      "integrity": "sha512-VZznLgtwhn+Mact9tfiwx64fA9erHH/MCXEUfB/0bX/6Fz6ny5EGTXYltMocqg4xFAQZtnO3DHWWXi8RiuN7cQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -1167,9 +1167,9 @@
       }
     },
     "node_modules/@next/env": {
-      "version": "16.1.6",
-      "resolved": "https://registry.npmjs.org/@next/env/-/env-16.1.6.tgz",
-      "integrity": "sha512-N1ySLuZjnAtN3kFnwhAwPvZah8RJxKasD7x1f8shFqhncnWZn4JMfg37diLNuoHsLAlrDfM3g4mawVdtAG8XLQ==",
+      "version": "16.2.1",
+      "resolved": "https://registry.npmjs.org/@next/env/-/env-16.2.1.tgz",
+      "integrity": "sha512-n8P/HCkIWW+gVal2Z8XqXJ6aB3J0tuM29OcHpCsobWlChH/SITBs1DFBk/HajgrwDkqqBXPbuUuzgDvUekREPg==",
       "license": "MIT"
     },
     "node_modules/@next/eslint-plugin-next": {
@@ -1183,9 +1183,9 @@
       }
     },
     "node_modules/@next/swc-darwin-arm64": {
-      "version": "16.1.6",
-      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.1.6.tgz",
-      "integrity": "sha512-wTzYulosJr/6nFnqGW7FrG3jfUUlEf8UjGA0/pyypJl42ExdVgC6xJgcXQ+V8QFn6niSG2Pb8+MIG1mZr2vczw==",
+      "version": "16.2.1",
+      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.2.1.tgz",
+      "integrity": "sha512-BwZ8w8YTaSEr2HIuXLMLxIdElNMPvY9fLqb20LX9A9OMGtJilhHLbCL3ggyd0TwjmMcTxi0XXt+ur1vWUoxj2Q==",
       "cpu": [
         "arm64"
       ],
@@ -1199,9 +1199,9 @@
       }
     },
     "node_modules/@next/swc-darwin-x64": {
-      "version": "16.1.6",
-      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.1.6.tgz",
-      "integrity": "sha512-BLFPYPDO+MNJsiDWbeVzqvYd4NyuRrEYVB5k2N3JfWncuHAy2IVwMAOlVQDFjj+krkWzhY2apvmekMkfQR0CUQ==",
+      "version": "16.2.1",
+      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.2.1.tgz",
+      "integrity": "sha512-/vrcE6iQSJq3uL3VGVHiXeaKbn8Es10DGTGRJnRZlkNQQk3kaNtAJg8Y6xuAlrx/6INKVjkfi5rY0iEXorZ6uA==",
       "cpu": [
         "x64"
       ],
@@ -1215,9 +1215,9 @@
       }
     },
     "node_modules/@next/swc-linux-arm64-gnu": {
-      "version": "16.1.6",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.1.6.tgz",
-      "integrity": "sha512-OJYkCd5pj/QloBvoEcJ2XiMnlJkRv9idWA/j0ugSuA34gMT6f5b7vOiCQHVRpvStoZUknhl6/UxOXL4OwtdaBw==",
+      "version": "16.2.1",
+      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.2.1.tgz",
+      "integrity": "sha512-uLn+0BK+C31LTVbQ/QU+UaVrV0rRSJQ8RfniQAHPghDdgE+SlroYqcmFnO5iNjNfVWCyKZHYrs3Nl0mUzWxbBw==",
       "cpu": [
         "arm64"
       ],
@@ -1231,9 +1231,9 @@
       }
     },
     "node_modules/@next/swc-linux-arm64-musl": {
-      "version": "16.1.6",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.1.6.tgz",
-      "integrity": "sha512-S4J2v+8tT3NIO9u2q+S0G5KdvNDjXfAv06OhfOzNDaBn5rw84DGXWndOEB7d5/x852A20sW1M56vhC/tRVbccQ==",
+      "version": "16.2.1",
+      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.2.1.tgz",
+      "integrity": "sha512-ssKq6iMRnHdnycGp9hCuGnXJZ0YPr4/wNwrfE5DbmvEcgl9+yv97/Kq3TPVDfYome1SW5geciLB9aiEqKXQjlQ==",
       "cpu": [
         "arm64"
       ],
@@ -1247,9 +1247,9 @@
       }
     },
     "node_modules/@next/swc-linux-x64-gnu": {
-      "version": "16.1.6",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.1.6.tgz",
```

**File**: `src/components/sponsors/sponsors.tsx` (modified, +20/-8)
```diff
@@ -102,9 +102,9 @@ function Sponsors({ theme }: SponsorsProps) {
             {/* Dot Separator */}
             <DotSeparator theme={theme} />
             {/* ShadcnCraft Sponsor */}
-            {/* Huge thanks to ShadcnCraft for supporting PatternCraft.fun! Explore their blocks at: https://shadcraft.com/ */}
+            {/* Huge thanks to ShadcnCraft for supporting PatternCraft.fun! Explore their blocks at: https://shadcncraft.com/ */}
             <a
-                href="https://shadcraft.com/"
+                href="https://shadcncraft.com"
                 target="_blank"
                 className="
   flex flex-col items-center text-center
@@ -114,11 +114,23 @@ function Sponsors({ theme }: SponsorsProps) {
 "
 
             >
-                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="20"
+                <svg
+                    width="20"
                     height="30"
-                    className={`transition-all duration-300 ${isPatternDark ? "fill-white group-hover:fill-gray-100" : "fill-black group-hover:fill-gray-800"
-                        }`}
-                ><path d="M 0 200 C 0 89.542969 89.542969 0 200 0 C 310.457031 0 400 89.542969 400 200 C 400 310.457031 310.457031 400 200 400 C 89.542969 400 0 310.457031 0 200 Z M 0 200" fill="white"></path><path d="M 154.226562 198.65625 C 160.011719 192.871094 169.382812 192.871094 175.167969 198.65625 C 180.949219 204.441406 180.949219 213.804688 175.167969 219.589844 L 117.78125 276.976562 C 111.996094 282.761719 102.609375 282.773438 96.824219 276.988281 C 91.042969 271.203125 91.054688 261.828125 96.835938 256.042969 Z M 227.558594 226.816406 C 233.320312 221.007812 242.695312 220.960938 248.503906 226.722656 C 254.3125 232.484375 254.34375 241.859375 248.582031 247.667969 L 219.550781 276.941406 L 218.425781 277.976562 C 212.628906 282.738281 204.050781 282.429688 198.605469 277.03125 C 193.164062 271.632812 192.785156 263.054688 197.503906 257.214844 L 198.515625 256.089844 Z M 261.566406 191.140625 C 267.351562 185.359375 276.726562 185.359375 282.511719 191.140625 C 288.296875 196.925781 288.296875 206.300781 282.511719 212.085938 L 281.957031 212.648438 L 280.832031 213.671875 C 275.015625 218.414062 266.4375 218.070312 261.015625 212.648438 C 255.589844 207.226562 255.25 198.648438 259.992188 192.832031 L 261.015625 191.703125 Z M 212.820312 142.027344 C 218.667969 136.308594 228.042969 136.410156 233.761719 142.257812 C 239.484375 148.105469 239.378906 157.480469 233.53125 163.199219 L 211.667969 184.59375 L 210.542969 185.605469 C 204.671875 190.285156 196.089844 189.847656 190.726562 184.363281 C 185.363281 178.882812 185.117188 170.300781 189.921875 164.53125 L 190.957031 163.417969 Z M 246.964844 105.765625 C 252.746094 99.984375 262.121094 99.988281 267.910156 105.765625 C 273.695312 111.550781 273.695312 120.925781 267.910156 126.710938 L 267.324219 127.296875 L 266.207031 128.320312 C 260.390625 133.066406 251.8125 132.71875 246.390625 127.296875 C 240.96875 121.875 240.613281 113.296875 245.355469 107.480469 L 246.390625 106.351562 Z M 246.964844 105.765625" fill="black"></path></svg>
+                    viewBox="0 0 119 115"
+                    fill="none"
+                    xmlns="http://www.w3.org/2000/svg"
+                    className={`h-[30px] w-5 shrink-0 transition-colors duration-300 ${isPatternDark ? "text-white group-hover:text-gray-100" : "text-primary group-hover:text-primary/90"}`}
+                >
+                    <path
+                        d="M118.521 4.3256V35.5564H45.0468L25.149 69.0019C24.3704 70.3169 22.9603 71.1128 21.429 71.1128H4.3256C1.93787 71.1128 0 69.175 0 66.7872V35.5564H41.8718L59.2434 6.34133C61.5792 2.40503 65.8183 0 70.3948 0H114.196C116.584 0 118.521 1.93787 118.521 4.3256Z"
+                        fill="currentColor"
+                    />
+                    <path
+                        d="M0 110.674V79.4436H73.4746L93.3724 45.9981C94.151 44.6831 95.5611 
```

---

### Incident Patch 5: `17a4d3c7` (2026-01-11)
**Commit Message**: Merge pull request #135 from jawad-ul-hassan/fix/hero-typo-remove-backticks

fix: remove stray backticks typo in Hero component stats section

**File**: `src/components/home/hero.tsx` (modified, +1/-1)
```diff
@@ -223,7 +223,7 @@ export default function Hero({ theme }: HeroProps) {
               Free
             </div>
           </div>
-          <div className="text-center">``
+          <div className="text-center">
             <div
               className={`text-xl sm:text-2xl font-bold transition-colors duration-300 ${isPatternDark ? "text-white" : ""
                 }`}
```

---

### Incident Patch 6: `5142a841` (2026-01-08)
**Commit Message**: fix: correct closing tag in Hero component

**File**: `src/components/home/hero.tsx` (modified, +1/-1)
```diff
@@ -223,7 +223,7 @@ export default function Hero({ theme }: HeroProps) {
               Free
             </div>
           </div>
-          <div className="text-center">``
+          <div className="text-center">
             <div
               className={`text-xl sm:text-2xl font-bold transition-colors duration-300 ${isPatternDark ? "text-white" : ""
                 }`}
```

---

### Incident Patch 7: `a57980f1` (2026-01-08)
**Commit Message**: fix: sponsor typo fixed

**File**: `src/components/sponsors/sponsors.tsx` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ function Sponsors({ theme }: SponsorsProps) {
  ${isPatternDark ? "text-gray-300 group-hover:text-white" : "text-gray-600 group-hover:text-gray-900"
                     }`}>
                     <span className=" leading-none font-semibold  flex justify-items-start">
-                        shadcncraft
+                        shadcraft
                     </span>
                     <span className={`text-xs sm:text-sm leading-none transition-colors duration-300 ${isPatternDark ? "text-gray-400 group-hover:text-gray-300" : "text-gray-500 group-hover:text-gray-700"
                         }`}>
```

---

### Incident Patch 8: `4f15a3e0` (2026-01-07)
**Commit Message**: Merge pull request #134 from megh-bari/fix-cta-button

fix: cta buttton width in mobile screen

**File**: `src/components/home/hero.tsx` (modified, +6/-6)
```diff
@@ -151,10 +151,10 @@ export default function Hero({ theme }: HeroProps) {
         </div>
 
         {/* CTA buttons */}
-        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
+        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
           <Button
             size="lg"
-            className={`cursor-pointer gap-2 px-4 sm:px-8 py-3 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 flex-1 sm:flex-none ${isPatternDark
+            className={`cursor-pointer gap-2 px-4 sm:px-8 py-3 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 flex-1 sm:flex-none w-full sm:w-auto ${isPatternDark
               ? "bg-white text-black hover:bg-gray-100"
               : "bg-slate-950 hover:bg-slate-900 dark:bg-white dark:text-black dark:hover:bg-gray-100"
               }`}
@@ -167,7 +167,7 @@ export default function Hero({ theme }: HeroProps) {
           </Button>
           <Button
             size="lg"
-            className={`cursor-pointer gap-2 px-4 sm:px-8 py-3 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 flex-1 sm:flex-none ${isPatternDark
+            className={`cursor-pointer gap-2 px-4 sm:px-8 py-3 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 flex-1 sm:flex-none w-full sm:w-auto ${isPatternDark
               ? "bg-slate-950 text-white hover:bg-slate-900"
               : "bg-white text-black hover:bg-gray-100"
               }`}
@@ -181,8 +181,8 @@ export default function Hero({ theme }: HeroProps) {
 
         {/* Sponsors Attribution */}
         <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-8 sm:mt-10 mx-auto px-4 sm:px-0 text-center sm:text-left">
-  <Sponsors theme={theme} />
-</div>
+          <Sponsors theme={theme} />
+        </div>
 
         <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 mt-8 sm:mt-10 mx-auto px-4 sm:px-0">
           <CarbonAd />
@@ -223,7 +223,7 @@ export default function Hero({ theme }: HeroProps) {
               Free
             </div>
           </div>
-          <div className="text-center">
+          <div className="text-center">``
             <div
               className={`text-xl sm:text-2xl font-bold transition-colors duration-300 ${isPatternDark ? "text-white" : ""
                 }`}
```

---

### Incident Patch 9: `e8735573` (2026-01-07)
**Commit Message**: fix: cta buttton width in mobile screen

**File**: `src/components/home/hero.tsx` (modified, +6/-6)
```diff
@@ -151,10 +151,10 @@ export default function Hero({ theme }: HeroProps) {
         </div>
 
         {/* CTA buttons */}
-        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
+        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
           <Button
             size="lg"
-            className={`cursor-pointer gap-2 px-4 sm:px-8 py-3 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 flex-1 sm:flex-none ${isPatternDark
+            className={`cursor-pointer gap-2 px-4 sm:px-8 py-3 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 flex-1 sm:flex-none w-full sm:w-auto ${isPatternDark
               ? "bg-white text-black hover:bg-gray-100"
               : "bg-slate-950 hover:bg-slate-900 dark:bg-white dark:text-black dark:hover:bg-gray-100"
               }`}
@@ -167,7 +167,7 @@ export default function Hero({ theme }: HeroProps) {
           </Button>
           <Button
             size="lg"
-            className={`cursor-pointer gap-2 px-4 sm:px-8 py-3 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 flex-1 sm:flex-none ${isPatternDark
+            className={`cursor-pointer gap-2 px-4 sm:px-8 py-3 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 flex-1 sm:flex-none w-full sm:w-auto ${isPatternDark
               ? "bg-slate-950 text-white hover:bg-slate-900"
               : "bg-white text-black hover:bg-gray-100"
               }`}
@@ -181,8 +181,8 @@ export default function Hero({ theme }: HeroProps) {
 
         {/* Sponsors Attribution */}
         <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-8 sm:mt-10 mx-auto px-4 sm:px-0 text-center sm:text-left">
-  <Sponsors theme={theme} />
-</div>
+          <Sponsors theme={theme} />
+        </div>
 
         <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 mt-8 sm:mt-10 mx-auto px-4 sm:px-0">
           <CarbonAd />
@@ -223,7 +223,7 @@ export default function Hero({ theme }: HeroProps) {
               Free
             </div>
           </div>
-          <div className="text-center">
+          <div className="text-center">``
             <div
               className={`text-xl sm:text-2xl font-bold transition-colors duration-300 ${isPatternDark ? "text-white" : ""
                 }`}
```

---

### Incident Patch 10: `24d032fa` (2025-12-07)
**Commit Message**: fix:react2shell-next issue

**File**: `package-lock.json` (modified, +40/-40)
```diff
@@ -16,7 +16,7 @@
         "clsx": "^2.1.1",
         "geist": "^1.4.2",
         "lucide-react": "^0.513.0",
-        "next": "15.3.3",
+        "next": "15.3.6",
         "next-sitemap": "^4.2.3",
         "next-themes": "^0.4.6",
         "react": "^19.0.0",
@@ -800,9 +800,9 @@
       }
     },
     "node_modules/@next/env": {
-      "version": "15.3.3",
-      "resolved": "https://registry.npmjs.org/@next/env/-/env-15.3.3.tgz",
-      "integrity": "sha512-OdiMrzCl2Xi0VTjiQQUK0Xh7bJHnOuET2s+3V+Y40WJBAXrJeGA3f+I8MZJ/YQ3mVGi5XGR1L66oFlgqXhQ4Vw==",
+      "version": "15.3.6",
+      "resolved": "https://registry.npmjs.org/@next/env/-/env-15.3.6.tgz",
+      "integrity": "sha512-/cK+QPcfRbDZxmI/uckT4lu9pHCfRIPBLqy88MhE+7Vg5hKrEYc333Ae76dn/cw2FBP2bR/GoK/4DU+U7by/Nw==",
       "license": "MIT"
     },
     "node_modules/@next/eslint-plugin-next": {
@@ -816,9 +816,9 @@
       }
     },
     "node_modules/@next/swc-darwin-arm64": {
-      "version": "15.3.3",
-      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-15.3.3.tgz",
-      "integrity": "sha512-WRJERLuH+O3oYB4yZNVahSVFmtxRNjNF1I1c34tYMoJb0Pve+7/RaLAJJizyYiFhjYNGHRAE1Ri2Fd23zgDqhg==",
+      "version": "15.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-15.3.5.tgz",
+      "integrity": "sha512-lM/8tilIsqBq+2nq9kbTW19vfwFve0NR7MxfkuSUbRSgXlMQoJYg+31+++XwKVSXk4uT23G2eF/7BRIKdn8t8w==",
       "cpu": [
         "arm64"
       ],
@@ -832,9 +832,9 @@
       }
     },
     "node_modules/@next/swc-darwin-x64": {
-      "version": "15.3.3",
-      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-15.3.3.tgz",
-      "integrity": "sha512-XHdzH/yBc55lu78k/XwtuFR/ZXUTcflpRXcsu0nKmF45U96jt1tsOZhVrn5YH+paw66zOANpOnFQ9i6/j+UYvw==",
+      "version": "15.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-15.3.5.tgz",
+      "integrity": "sha512-WhwegPQJ5IfoUNZUVsI9TRAlKpjGVK0tpJTL6KeiC4cux9774NYE9Wu/iCfIkL/5J8rPAkqZpG7n+EfiAfidXA==",
       "cpu": [
         "x64"
       ],
@@ -848,9 +848,9 @@
       }
     },
     "node_modules/@next/swc-linux-arm64-gnu": {
-      "version": "15.3.3",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-15.3.3.tgz",
-      "integrity": "sha512-VZ3sYL2LXB8znNGcjhocikEkag/8xiLgnvQts41tq6i+wql63SMS1Q6N8RVXHw5pEUjiof+II3HkDd7GFcgkzw==",
+      "version": "15.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-15.3.5.tgz",
+      "integrity": "sha512-LVD6uMOZ7XePg3KWYdGuzuvVboxujGjbcuP2jsPAN3MnLdLoZUXKRc6ixxfs03RH7qBdEHCZjyLP/jBdCJVRJQ==",
       "cpu": [
         "arm64"
       ],
@@ -864,9 +864,9 @@
       }
     },
     "node_modules/@next/swc-linux-arm64-musl": {
-      "version": "15.3.3",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-15.3.3.tgz",
-      "integrity": "sha512-h6Y1fLU4RWAp1HPNJWDYBQ+e3G7sLckyBXhmH9ajn8l/RSMnhbuPBV/fXmy3muMcVwoJdHL+UtzRzs0nXOf9SA==",
+      "version": "15.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-15.3.5.tgz",
+      "integrity": "sha512-k8aVScYZ++BnS2P69ClK7v4nOu702jcF9AIHKu6llhHEtBSmM2zkPGl9yoqbSU/657IIIb0QHpdxEr0iW9z53A==",
       "cpu": [
         "arm64"
       ],
@@ -880,9 +880,9 @@
       }
     },
     "node_modules/@next/swc-linux-x64-gnu": {
-      "version": "15.3.3",
-      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-15.3.3.tgz",
-      "integrity": "sha512-jJ8HRiF3N8Zw6hGlytCj5BiHyG/K+fnTKVDEKvUCyiQ/0r5tgwO7OgaRiOjjRoIx2vwLR+Rz8hQoPrnmFbJdfw==",
+      "version": "15.3.5",
+      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-15.3.5.tgz",
+      "integrity": "sha512-2xYU0DI9DGN/bAHzVwADid22ba5d/xrbrQlr2U+/Q5WkFUzeL0TDR963BdrtLS/4bMmKZGptLeg6282H/S2i8A==",
       "cpu": [
         "x64"
      
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "clsx": "^2.1.1",
     "geist": "^1.4.2",
     "lucide-react": "^0.513.0",
-    "next": "15.3.3",
+    "next": "15.3.6",
     "next-sitemap": "^4.2.3",
     "next-themes": "^0.4.6",
     "react": "^19.0.0",
```

#### Recent Merged Pull Requests:
- **PR #146** (2026-09-02): feat: add beach effect pattern (@orvek)
- **PR #145** (2026-08-17): fix: update star history chart to working host (@Dessalines39394)
- **PR #144** (2026-07-08): feat: add sponsored placement for Shadcn Studio (@megh-bari)
- **PR #141** (closed): feat: add subtle white heart grid texture (@OMEE-Y)
- **PR #140** (2026-03-28): fix: update ShadcnCraft link and improve SVG rendering in Sponsors co… (@megh-bari)
- **PR #138** (2026-03-16): chore: Tal by Grapevine sponsor logo (@megh-bari)
- **PR #135** (2026-01-11): fix: remove stray backticks typo in Hero component stats section (@jawad-ul-hassan)
- **PR #134** (2026-01-07): fix: cta buttton width in mobile screen (@megh-bari)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

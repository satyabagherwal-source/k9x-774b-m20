# Forensic Learning Record (Deep Inspection): zarf-dev/zarf

> **Canonical Artifact**: `07_PROJECT_LEARNING/zarf-dev-zarf-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zarf-dev/zarf](https://github.com/zarf-dev/zarf))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:30.816Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zarf-dev/zarf`
- **Description**: The Airgap Native Package Manager for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2060 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `main.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package main is the entrypoint for the Zarf binary.
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/zarf-dev/zarf/src/cmd"
	"github.com/zarf-dev/zarf/src/config"
)

func main() {
	// This ensures `./zarf` actions call the current Zarf binary over the system Zarf binary
	config.ActionsUseSystemZarf = false
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		first := true
		for {
			<-signalCh
			if first {
				first = false
				cancel()
				continue
			}
			os.Exit(1)
		}
	}()

	if err := cmd.Execute(ctx); err != nil {
		os.Exit(1)
	}
}

```

### Core Architecture Module: `site/astro.config.ts`
```
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightSidebarTopics from "starlight-sidebar-topics";
import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import remarkGemoji from "remark-gemoji";
import { remarkLinkRewrite } from "./src/plugins/remark-link-rewrite.ts";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION_SLUG } from "./src/lib/version.ts";

const docsDir = fileURLToPath(new URL("./src/content/docs/", import.meta.url));

// Archived versions staged by build-versions.mjs; absent in plain/dev builds.
let versions: { ref: string; slug: string }[] = [];
try {
  const raw = readFileSync(new URL("./versions.json", import.meta.url), "utf8");
  versions = JSON.parse(raw).versions ?? [];
} catch {}

// Top-level docs sections (dirs + single pages, excluding staged version subtrees).
// Drives both link-rewrite eligibility and the per-version sidebars below.
const sections = readdirSync(docsDir, { withFileTypes: true })
  .filter((e) => !(e.isDirectory() && VERSION_SLUG.test(e.name)))
  .map((e) => e.name.replace(/\.mdx?$/, ""))
  .filter((name) => name !== "index");

function hasPage(slug: string, page: string): boolean {
  const rel = slug ? `${slug}/${page}` : page;
  return existsSync(path.join(docsDir, `${rel}.mdx`)) || existsSync(path.join(docsDir, `${rel}.md`));
}

// Build a Starlight sidebar for one docs version. `slug` is "" for the current
// checkout (Latest) or a version slug (e.g. "0-76") for an archived subtree.
// Sections missing from an older version are skipped so autogenerate never
// points at a non-existent directory.
function buildSidebar(slug: string): any[] {
  const base = slug ? `/${slug}` : "";
  const rel = (p: string) => (slug ? `${slug}/${p}` : p);
  const hasDir = (d: string) => existsSync(path.join(docsDir, rel(d)));

  const items: any[] = [{ label: "Overview", link: `${base}/` }];

  const dirGroup = (label: string, d: string, opts: { collapsed?: boolean; innerCollapsed?: boolean } = {}) => {
    if (!hasDir(d)) return;
    const autogenerate: { directory: string; collapsed?: boolean } = { directory: rel(d) };
    if (opts.innerCollapsed) autogenerate.collapsed = true;
    items.push({ label, items: [{ autogenerate }], ...(opts.collapsed ? { collapsed: true } : {}) });
  };
  const pageLink = (label: string, p: string) => {
    if (hasPage(slug, p)) items.push({ label, link: `${base}/${p}` });
  };

  dirGroup("Start Here", "getting-started");
  dirGroup("CLI Commands", "commands", { collapsed: true });
  dirGroup("Best Practices", "best-practices", { collapsed: true });
  dirGroup("Reference", "ref", { collapsed: true, innerCollapsed: true });
  dirGroup("Tutorials", "tutorials", { collapsed: true });
  dirGroup("Schema", "schema", { collapsed: true });
  pageLink("FAQ", "faq");
  pageLink("Roadmap", "roadmap");
  pageLink("Support", "support");
  dirGroup("Contribute", "contribute", { collapsed: true });
  return items;
}

// One topic per version. The topic dropdown (see src/components/Sidebar.astro)
// doubles as the version switcher, and each topic scopes the sidebar to its
// version's subtree.
const topics = [
  { id: "latest", label: "Latest", link: "/", items: buildSidebar("") },
  ...versions.map((v) => ({ id: v.slug, label: v.ref, link: `/${v.slug}/`, items: buildSidebar(v.slug) })),
];

// Associate pages that aren't in any sidebar (404, sidebar-hidden pages) with a topic.
function unlistedPages(slug: string): string[] {
  const base = slug ? `/${slug}` : "";
  const pages = slug ? [] : ["/404"];

  if (hasPage(slug, "schema/v1beta1-package")) {
    pages.push(`${base}/schema/v1beta1-package`);
  }

  return pages;
}

const topicsOption: Record<string, string[]> = {
  latest: unlistedPages(""),
  ...Object.fromEntries(versions.map((version) => [version.slug, unlistedPages(version.slug)])),
};

// https://astro.build/config
export default defineConfig({
  redirects: {
    "/docs/zarf-overview": "/",
  },
  markdown: {
    processor: unified({
      gfm: true,
      remarkPlugins: [
        remarkGemoji,
        [remarkLinkRewrite, { srcDir: docsDir, sections }],
      ],
      rehypePlugins: [
        rehypeHeadingIds,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "wrap",
            properties: { ariaHidden: true, tabIndex: -1, class: "heading-link" },
          },
        ],
      ],
    }),
  },
  integrations: [
    starlight({
      title: "Zarf",
      // We render our own heading anchors (rehype-autolink-headings); disable
      // Starlight's to avoid duplicates. TODO: switch to native Starlight links.
      markdown: { headingLinks: false },
      head: [
        {
          tag: "script",
          content: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','G-N1XZ8ZXCWL');`,
        },
      ],
      components: {
        SkipLink: "./src/components/SkipLink.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
        Sidebar: "./src/components/Sidebar.astro",
        Search: "./src/components/Search.astro",
        MarkdownContent: "./src/components/MarkdownContent.astro",
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/zarf-dev/zarf' },
        { icon: 'slack', label: 'Slack', href: 'https://kubernetes.slack.com/archives/C03B6BJAUJ3' },
      ],
      favicon: "/favicon.svg",
      editLink: {
        baseUrl: "https://github.com/zarf-dev/zarf/edit/main/site",
      },
      logo: {
        src: "./src/assets/zarf-logo-header.svg",
        replacesTitle: true,
      },
      customCss: [
        "./src/styles/custom.css",
        "@fontsource/source-code-pro/400.css",
      ],
      lastUpdated: true,
      plugins: [starlightSidebarTopics(topics, { topics: topicsOption })],
    }),
  ],
});

```

### Core Architecture Module: `site/hack/copy-examples.js`
```
import { promises as fs } from "fs";
import path from "path";
import yaml from "yaml";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repo = "https://github.com/zarf-dev/zarf";

// Generate `ref/Examples` docs from a checkout's `examples/` directory. The
// orchestrator (build-versions.mjs) calls this per archived version with that
// tag's examples and ref; the default args generate the current checkout's.
export async function generateExamples({
  examplesDir = path.join(__dirname, "../../examples"),
  dstDir = path.join(__dirname, "../src/content/docs/ref/Examples"),
  ref = "main",
} = {}) {
  await fs.rm(dstDir, { recursive: true, force: true });
  await fs.mkdir(dstDir, { recursive: true });

  const dirs = await fs.readdir(examplesDir);
  const examples = [];
  for (const dir of dirs) {
    let content;
    try {
      content = await fs.readFile(path.join(examplesDir, dir, "zarf.yaml"), "utf-8");
    } catch {
      continue;
    }
    const parsed = yaml.parse(content);
    const readmeFile = parsed.documentation?.readme;
    if (!readmeFile) {
      continue;
    }
    const readmePath = path.join(examplesDir, dir, readmeFile);
    try {
      await fs.access(readmePath);
    } catch {
      continue;
    }
    const readme = (await fs.readFile(readmePath, "utf-8")).trim();
    examples.push(dir);
    const link = new URL(`${repo}/edit/${ref}/examples/${dir}/${readmeFile}`).toString();
    const fm = `---
title: "${dir}"
editURL: "${link}"
description: "${parsed.description || ""}"
tableOfContents: false
---

:::note

To view the full example, as well as its dependencies, please visit [examples/${dir}](${repo}/tree/${ref}/examples/${dir}).

:::
`;

    const pkg = content.trim();

    const final = `${fm}
${readme}

## zarf.yaml

\`\`\`yaml
${pkg}
\`\`\`
`.trim();

    await fs.writeFile(path.join(dstDir, `${dir}.mdx`), final + "\n");
  }

  const index = `---
title: "Overview"
description: "Examples of \`zarf.yaml\` configurations"
tableOfContents: false
---

import { LinkCard, CardGrid } from '@astrojs/starlight/components';

<CardGrid>
  ${examples.map((e) => `<LinkCard title="${e}" href="/ref/examples/${e}/" />`).join("\n")}
</CardGrid>
`;

  await fs.writeFile(path.join(dstDir, `index.mdx`), index + "\n");
}

// CLI entry: generate the current checkout's examples (used by prebuild/predev).
if (import.meta.url === `file://${process.argv[1]}`) {
  await generateExamples().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

```

### Core Architecture Module: `site/src/content.config.ts`
```
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};

```

### Core Architecture Module: `site/src/env.d.ts`
```
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

```

### Core Architecture Module: `site/src/lib/schema.ts`
```
// Loads a Zarf JSON schema for the shared schema components. Two independent axes
// select the asset, both staged under
// `src/assets/versioned-assets/<docsSlug>/schema/<apiVersion>.json` by prebuild
// (the current checkout, as `latest/`) and build-versions.mjs (each archived
// release, as `<slug>/`):
//   - Docs version: the page URL's leading `vN-N` slug; any other path is `latest`.
//   - API version: the `apiVersion` prop; omitted, it defaults to v1alpha1.

const schemas = import.meta.glob<{ default: Record<string, any> }>(
  "../assets/versioned-assets/**/schema/*.json",
);

const VERSION_SLUG = /^v\d+-\d+$/;
const DEFAULT_API = "v1alpha1";

export async function loadSchema(
  pathname: string,
  apiVersion: string = DEFAULT_API,
): Promise<Record<string, any>> {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  const docsSlug = VERSION_SLUG.test(segment) ? segment : "latest";
  const loader =
    schemas[`../assets/versioned-assets/${docsSlug}/schema/${apiVersion}.json`] ??
    schemas[`../assets/versioned-assets/latest/schema/${DEFAULT_API}.json`];
  if (!loader) {
    throw new Error(`No schema asset for "${docsSlug}/${apiVersion}" (is prebuild staged?)`);
  }
  return (await loader()).default;
}

```

### Core Architecture Module: `site/src/lib/version.ts`
```
/** Matches an archived-version slug segment, e.g. "v0-76". */
export const VERSION_SLUG = /^v\d+-\d+$/;

/** Filter value used for the current (unversioned) docs checkout. */
export const LATEST = "current";

/** Resolve the docs version from a URL path, falling back to the current checkout. */
export function versionFromPath(pathname: string): string {
  return pathname.split("/").find((s) => VERSION_SLUG.test(s)) ?? LATEST;
}

```

### Core Architecture Module: `site/src/plugins/remark-link-rewrite.ts`
```
// Remark plugin for archived docs staged under a version subtree
// (`src/content/docs/<slug>/`). It does two things for those pages only — Latest
// pages (no version slug) are left untouched:
//
//   1. Prefixes root-absolute internal links into known sections with the
//      version slug, e.g. `/commands/zarf` → `/v0-76/commands/zarf`.
//   2. Normalizes relative paths that escape the version subtree (shared assets
//      in `src/assets`, repo-root files, `examples/`). Nesting content one level
//      deeper shifts these up by one, so an escaping `../…` gains one `../`.
//
// Context is derived from `file.path` at render time, so it works for both the
// staged tree (versioned build) and the live tree (dev).

import { visit } from "unist-util-visit";
import path from "node:path";
import type { Root } from "mdast";
import type { VFile } from "vfile";

const VERSION_SLUG = /^v\d+-\d+$/;

interface Options {
  /** Absolute path to `src/content/docs/`. */
  srcDir: string;
  /** Top-level content sections eligible for prefixing (dir/page names). */
  sections: string[];
}

/**
 * Prefix `url` with `prefix` when it is a root-absolute link into a known
 * section. Leaves external, protocol-relative, already-versioned, and
 * non-section links unchanged.
 */
export function rewriteUrl(url: string, prefix: string, sections: Set<string>): string {
  if (!url.startsWith("/") || url.startsWith("//")) return url;
  const segment = url.slice(1).split(/[/#?]/, 1)[0];
  if (VERSION_SLUG.test(segment)) return url;
  if (!sections.has(segment)) return url;
  return prefix + url;
}

/**
 * Add one `../` to a relative specifier when it resolves outside `versionRoot`,
 * compensating for the extra directory level of a staged version subtree.
 * Query/hash suffixes (e.g. `?raw`) are preserved.
 */
export function fixEscapingRelative(spec: string, fileDir: string, versionRoot: string): string {
  if (!spec.startsWith(".")) return spec;
  const target = path.resolve(fileDir, spec.split(/[?#]/, 1)[0]);
  const escapes = target !== versionRoot && !target.startsWith(versionRoot + path.sep);
  return escapes ? "../" + spec : spec;
}

export function rewriteVersionedAssetImport(spec: string, versionSlug: string): string | null {
  const match = spec.match(/^(?:\.\.\/)+(examples|packages)\/(.+\?raw)$/);
  if (!match) return null;

  const [, sourceKind, sourcePath] = match;
  return `/src/assets/versioned-assets/${versionSlug}/${sourceKind}/${sourcePath}`;
}

const SOURCE_NODES = new Set([
  "ImportDeclaration",
  "ImportExpression",
  "ExportAllDeclaration",
  "ExportNamedDeclaration",
]);

// Walk an ESTree, applying `fix` to the specifier of every static or dynamic
// import/export. MDX compiles from the ESTree, so this is the source of truth
// for `import x from "..."` and `import("...")` (e.g. <ExampleYAML src={...} />).
function fixEstreeSources(node: any, fix: (spec: string) => string): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) fixEstreeSources(child, fix);
    return;
  }
  const source = node.source;
  if (SOURCE_NODES.has(node.type) && source && typeof source.value === "string") {
    const fixed = fix(source.value);
    if (fixed !== source.value) {
      source.value = fixed;
      source.raw = JSON.stringify(fixed);
    }
  }
  for (const key of Object.keys(node)) {
    if (key !== "type") fixEstreeSources(node[key], fix);
  }
}

export function remarkLinkRewrite(options: Options) {
  const { srcDir } = options;
  const sections = new Set(options.sections);

  return (tree: Root, file: VFile) => {
    if (!file.path) return;
    const rel = path.relative(srcDir, file.path);
    if (rel.startsWith("..")) return;

    const versionSlug = rel.split(path.sep)[0];
    if (!VERSION_SLUG.test(versionSlug)) return;
    const prefix = `/${versionSlug}`;
    const versionRoot = path.join(srcDir, versionSlug);
    const fileDir = path.dirname(file.path);

    const fixRelative = (spec: string) =>
      rewriteVersionedAssetImport(spec, versionSlug) ?? fixEscapingRelative(spec, fileDir, versionRoot);
    const fixUrl = (url: string) => (url.startsWith("/") ? rewriteUrl(url, prefix, sections) : fixRelative(url));

    // Markdown links, link reference definitions, and images.
    visit(tree, ["link", "definition"], (node: any) => {
      node.url = fixUrl(node.url);
    });
    visit(tree, "image", (node: any) => {
      node.url = fixRelative(node.url);
    });

    // Raw HTML anchors/images embedded in Markdown.
    visit(tree, "html", (node: any) => {
      node.value = node.value.replace(
        /((?:href|src)=")([^"]*)/g,
        (_match: string, attr: string, url: string) => attr + fixUrl(url),
      );
    });

    // JSX props in MDX: string `href`/`src` (e.g. <LinkCard href="/ref/..." />)
    // and expression values carrying imports (e.g. <ExampleYAML src={import(...)} />).
    visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node: any) => {
      for (const attr of node.attributes ?? []) {
        if (attr.type !== "mdxJsxAttribute") continue;
        if ((attr.name === "href" || attr.name === "src") && typeof attr.value === "string") {
          attr.value = fixUrl(attr.value);
        } else if (attr.value?.data?.estree) {
          fixEstreeSources(attr.value.data.estree, fixRelative);
        }
      }
    });

    // Static/dynamic imports in ESM blocks and `{…}` expressions. MDX compiles
    // from the ESTree, not the node's source text, so mutate that.
    visit(tree, ["mdxjsEsm", "mdxFlowExpression", "mdxTextExpression"], (node: any) => {
      if (node.data?.estree) fixEstreeSources(node.data.estree, fixRelative);
    });
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5420** (2026-09-29): **chore(deps-dev): bump undici from 7.29.0 to 7.30.0 in /site**
  *Symptoms*: Bumps [undici](https://github.com/nodejs/undici) from 7.29.0 to 7.30.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/nodejs/undici/releases">undici's releases</a>.</em></p> <blockquote> <h2>v7.30.0</h2> <h2>What's Changed</h2> <ul> <li>[Backport v7.x] fix: selectively re-enable SIMD for ppc64 by <a href="https://github.com/github-actions"><code>@​github-actions</code></a>[bot] in <a href="https://redirect.github.com/nodejs/undici/pull/5794">nodejs/undici#5794</a></li> <li>Backport upgrade diagnostics lifecycle fixes to v7.x by <a href="https://github.com/BridgeAR"><code>@​BridgeAR</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5783">nodejs/undici#5783</a></li> <li>[Backport v7.x] fix: honor backpressure in decompression interceptor by <a href="https://github.com/mcollina"><code>@​mcollina</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5837">nodejs/undici#5837</a></li> <li>fix: close rejected HTTP/2 WebSocket streams on v7.x by <a href="https://github.com/mcollina"><code>@​mcollina</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5876">nodejs/undici#5876</a></li> <li>test(fetch): make pull-dont-push exceed any socket buffer by <a href="https://github.com/mcollina"><code>@​mcollina</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5889">nodejs/undici#5889</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/nodejs/undici/
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | ba6d10d581fcd4e6ec66800d37851f2c9f1a4ccb | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abc1b76cd98de000825377f | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5420--zarf-docs.netlify.app](https://deploy-preview-5420--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU0MjAtLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.kf3FkpUD5wSSl_FvY2bneUTXjeLFEnGgULwfM0on5Fw)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5420--zarf-docs.netlify.app) --> _To e

- **Issue #5417** (2026-09-29): **feat!: disable artifact server by default**
  *Symptoms*: ## Description  Turns the artifact server off by default unless the feature flag `--features=artifact-server=true` is on  ## Related Issue  Relates to #5005   ## Checklist before merging  - [ ] Test, docs, adr added or updated as needed - [ ] [Contributor Guide Steps](https://github.com/zarf-dev/zarf/blob/main/CONTRIBUTING.md#developer-workflow) followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* canceled.   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 7e2d5314837e0c56ae6b5bb2d453beb3864cccc7 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abc0fd45dfc3e00086d6a04 |
  > ## [Codecov](https://app.codecov.io/gh/zarf-dev/zarf/pull/5417?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) Report :x: Patch coverage is `70.00000%` with `3 lines` in your changes missing coverage. Please review.  | [Files with missing lines](https://app.codecov.io/gh/zarf-dev/zarf/pull/5417?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) | Patch % | Lines | |---|---|---| | [src/pkg/packager/deploy.go](https://app.codecov.io/gh/zarf-dev/zarf/pull/5417?src=pr&el=tree&filepath=src%2Fpkg%2Fpackager%2Fdeploy.go&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev#diff-c3JjL3BrZy9wYWNrYWdlci9kZXBsb3kuZ28=) | 0.00% | [2 Missing and 1 partial :warning: ](https://app.codecov.io/gh/zarf-dev/zarf/pull/5417?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=commen

- **Issue #5416** (2026-09-30): **Inspect one component’s Helm values before building a package**
  *Symptoms*: ### Is your feature request related to a problem? Please describe.  I use `zarf dev inspect values-files` to check Helm values while developing a package, before building it. My package has two components that use the same upstream Helm chart. The command prints values for both components, but labels each document only with the chart name, so the output does not clearly identify which values belong to which component.  `zarf package inspect values-files` supports component selection, but using it requires building the package first.  ### Describe the behavior you'd like  - **Given** a source package definition with multiple components using the same chart - **When** I run `zarf dev inspect values-files --components=<component-name>` - **Then** I see the values for charts in that component only, without building a package  The option should use the same component selection syntax as `zarf package inspect values-files`.  ### Describe alternatives you've considered  I can build the package and use `zarf package inspect values-files --components`, but that adds a build step to each values check. Reading the unfiltered dev output is ambiguous when both components use the same chart name.  ### Additional context  Addressed by PR #5413. 

- **Issue #5413** (2026-09-30): **feat(dev): add --components flag to dev inspect values-files**
  *Symptoms*: ## Description  ### Change  Add `--components` to `zarf dev inspect values-files`, matching the component selection available when inspecting a built package.  The flag selects which components’ charts are rendered and displayed. Zarf still resolves and validates the full source package, and values templates retain the full package context. An unknown selection returns a clear error.  Added command tests, a CLI E2E check, and the generated command reference.  ### Motivation  I use `zarf dev inspect values-files` to check Helm values before building a package. My package has two components that use the same upstream helm chart, so the unfiltered output gives both values documents the same chart label. Selecting a component makes it clear which values belong to which component.  ## Related Issue  Fixes #5416  ## Validation  - `go test ./src/cmd -run '^TestDevInspectValuesFiles$' -count=1` — passed - `go test ./src/pkg/packager -run '^TestInspectDefinitionResources$' -count=1` — passed - `go test ./src/test/e2e/ -run 'TestUseCLI/zarf_dev_inspect_values-files' -count=1 -failfast` — passed - `make docs-and-schema` on Linux — passed - `make lint-go` — fails on 10 `SA1019` deprecation findings in unchanged files  ## Checklist before merging  - [x] Tests and docs updated; no ADR needed - [x] Contributor guide steps followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 337c03b5ba25d4a1eb82373455cdf9e23590d5b5 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abbf12b7282c30008408603 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5413--zarf-docs.netlify.app](https://deploy-preview-5413--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU0MTMtLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.h4W4gSsNHp47s62GRiuXZyHxKjPAE96rSgu9saYmJQA)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5413--zarf-docs.netlify.app) --> _To e
  > **Scope note:** This PR applies `--components` after Zarf loads and validates the source package. It limits which charts are rendered and shown, while keeping the full package context for values templates. As a result, an unavailable remote import in an unselected component can still cause inspection to fail.  Filtering before remote imports would require changes to the loader and decisions about imported values and validation. I treated that as a separate change. Please let me know if you expect `--components` to skip unrelated imports as part of this PR.
  > ## [Codecov](https://app.codecov.io/gh/zarf-dev/zarf/pull/5413?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) Report :x: Patch coverage is `76.92308%` with `3 lines` in your changes missing coverage. Please review.  | [Files with missing lines](https://app.codecov.io/gh/zarf-dev/zarf/pull/5413?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) | Patch % | Lines | |---|---|---| | [src/pkg/packager/inspect.go](https://app.codecov.io/gh/zarf-dev/zarf/pull/5413?src=pr&el=tree&filepath=src%2Fpkg%2Fpackager%2Finspect.go&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev#diff-c3JjL3BrZy9wYWNrYWdlci9pbnNwZWN0Lmdv) | 72.72% | [2 Missing and 1 partial :warning: ](https://app.codecov.io/gh/zarf-dev/zarf/pull/5413?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=com

- **Issue #5411** (2026-09-29): **feat!: migrate SignBlobOptions to a pointer**
  *Symptoms*: ## Description  As previously discussed, migrating `SignBlobOptions` to a pointer and removing the `Keyless` field to align with `SignManfiestOptions`.   `SignBlobOptions` remains a standard object on publish as this was already deprecated and only ever supported keypair from the CLI.   ## Related Issue  Fixes #5410  ## Checklist before merging  - [x] Test, docs, adr added or updated as needed - [x] [Contributor Guide Steps](https://github.com/zarf-dev/zarf/blob/main/CONTRIBUTING.md#developer-workflow) followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 3f9b07739e4b19805ff058dcf5e382cfbb8d2ea3 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abae7cad0ebe000083d132a | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5411--zarf-docs.netlify.app](https://deploy-preview-5411--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU0MTEtLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.ihvg6U00IjPEJk0SkqkCwMny21O67YT6CKIW3bX5Tlc)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5411--zarf-docs.netlify.app) --> _To e
  > ## [Codecov](https://app.codecov.io/gh/zarf-dev/zarf/pull/5411?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) Report :x: Patch coverage is `56.25000%` with `21 lines` in your changes missing coverage. Please review.  | [Files with missing lines](https://app.codecov.io/gh/zarf-dev/zarf/pull/5411?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) | Patch % | Lines | |---|---|---| | [src/pkg/packager/assemble/assemble.go](https://app.codecov.io/gh/zarf-dev/zarf/pull/5411?src=pr&el=tree&filepath=src%2Fpkg%2Fpackager%2Fassemble%2Fassemble.go&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev#diff-c3JjL3BrZy9wYWNrYWdlci9hc3NlbWJsZS9hc3NlbWJsZS5nbw==) | 50.00% | [7 Missing and 4 partials :warning: ](https://app.codecov.io/gh/zarf-dev/zarf/pull/5411?src=pr&el=tree&utm_medium=re

- **Issue #5410** (2026-09-29): **Convert SigningBlobOptions to a pointer**
  *Symptoms*: ### Describe what should be investigated or refactored  In #5380 we discussed migrating `SignManifestOptions` to a pointer and removing the keyless field as a mechanism for communicating signing behaviors. `nil` meaning no signing action.   The API surface for migrating is small but dispersed and it was agreed to isolate the change. This captures migrating to a pointer and the required updates.  ### Additional context  For publish we have already deprecated a non-pointer field. I think it is reasonable to retain that as-is given that publish has only ever truly allowed a keypair.  

- **Issue #5409** (2026-09-28): **docs: remove sbom viewer**
  *Symptoms*: ## Description  Removes the sbom viewer from the docs  ## Related Issue  Relates to #5046   ## Checklist before merging  - [ ] Test, docs, adr added or updated as needed - [ ] [Contributor Guide Steps](https://github.com/zarf-dev/zarf/blob/main/CONTRIBUTING.md#developer-workflow) followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 1dd6b34b185765e796dcf7cace7dac58398da3f5 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abacfbfa797bd00088edfe0 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5409--zarf-docs.netlify.app](https://deploy-preview-5409--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU0MDktLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.h_k-F3VqVgksul2CNuaX9iu_Zqa0tRXHDyDD2Dehl_M)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5409--zarf-docs.netlify.app) --> _To e
  > ## [Codecov](https://app.codecov.io/gh/zarf-dev/zarf/pull/5409?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) Report :white_check_mark: All modified and coverable lines are covered by tests. [see 1 file with indirect coverage changes](https://app.codecov.io/gh/zarf-dev/zarf/pull/5409/indirect-changes?src=pr&el=tree-more&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) <details><summary> :rocket: New features to boost your workflow: </summary>  - :snowflake: [Test Analytics](https://docs.codecov.com/docs/test-analytics): Detect flaky tests, report on failures, and find test suite problems. - :package: [JS Bundle Analysis](https://docs.codecov.com/docs/javascript-bundle-analysis): Save yourself from yourself by tracking and limiting bundle sizes in JS merges. </details>

- **Issue #5407** (2026-09-28): **fix(assemble): cleanup temporary directory on error**
  *Symptoms*: ## Description  This change adds cleaning up the temporary directory during assembly, given an error, which previously would have orphaned the current state of the contents of that build directory.  Noticed this when toying with the implications of errors on actions. A successful AssemblePackage caller owns pkgLayout and must call Cleanup() after final use. Failed AssemblePackage calls return no usable layout, so AssemblePackage itself must remove buildPath.  ## Related Issue  No associated issue.  ## Checklist before merging  - [x] Test, docs, adr added or updated as needed - [x] [Contributor Guide Steps](https://github.com/zarf-dev/zarf/blob/main/CONTRIBUTING.md#developer-workflow) followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* canceled.   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 9b6c9f109ad311dafaacb2d04b92c60613fbf0a9 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abacb59e414e20008b57e2e |
  > ## [Codecov](https://app.codecov.io/gh/zarf-dev/zarf/pull/5407?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) Report :white_check_mark: All modified and coverable lines are covered by tests.  | [Files with missing lines](https://app.codecov.io/gh/zarf-dev/zarf/pull/5407?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) | Coverage Δ | | |---|---|---| | [src/pkg/packager/assemble/assemble.go](https://app.codecov.io/gh/zarf-dev/zarf/pull/5407?src=pr&el=tree&filepath=src%2Fpkg%2Fpackager%2Fassemble%2Fassemble.go&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev#diff-c3JjL3BrZy9wYWNrYWdlci9hc3NlbWJsZS9hc3NlbWJsZS5nbw==) | `51.76% <100.00%> (+0.22%)` | :arrow_up: |  ... and [2 files with indirect coverage changes](https://app.codecov.io/gh/zarf-dev/zarf/pull/5407/indirect-c

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

### Incident Patch 1: `1653ca22` (2026-09-30)
**Commit Message**: fix!: remove images and repositories from package secret during connected deploys (#5402)

Signed-off-by: Austin Abro <austinabro321@gmail.com>

**File**: `src/cmd/crane.go` (modified, +3/-0)
```diff
@@ -387,6 +387,9 @@ func doPruneImagesForPackages(ctx context.Context, options []crane.Option, s *st
 	// Determine which image digests are currently used by Zarf packages
 	pkgImages := map[string]bool{}
 	for _, depPkg := range zarfPackages {
+		if depPkg.GetPackageConnectivity() == state.PackageConnectivityConnected {
+			continue
+		}
 		deployedComponents := map[string]bool{}
 		for _, depComponent := range depPkg.DeployedComponents {
 			deployedComponents[depComponent.Name] = true
```

**File**: `src/cmd/crane_test.go` (modified, +36/-0)
```diff
@@ -10,13 +10,49 @@ import (
 	"fmt"
 	"testing"
 
+	"github.com/google/go-containerregistry/pkg/crane"
 	"github.com/opencontainers/go-digest"
 	specs "github.com/opencontainers/image-spec/specs-go"
 	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
 	"github.com/stretchr/testify/require"
+	"github.com/zarf-dev/zarf/src/api/v1alpha1"
+	"github.com/zarf-dev/zarf/src/pkg/state"
 	"github.com/zarf-dev/zarf/src/test/testutil"
+	"oras.land/oras-go/v2/errdef"
 )
 
+func TestRegistryPruneSkipsConnectedDeploys(t *testing.T) {
+	ctx := testutil.TestContext(t)
+	address := testutil.SetupInMemoryRegistryDynamic(ctx, t)
+	options := []crane.Option{crane.Insecure}
+
+	keptDigest := testutil.PushImage(ctx, t, address+"/library/kept", "latest")
+	unusedDigest := testutil.PushImage(ctx, t, address+"/library/unused", "latest")
+
+	packages := []state.DeployedPackage{
+		{
+			PackageConnectivity: state.PackageConnectivityConnected,
+			Data: v1alpha1.ZarfPackage{Components: []v1alpha1.ZarfComponent{
+				{Name: "connected", Images: []string{"docker.io/library/connected:latest"}},
+			}},
+			DeployedComponents: []state.DeployedComponent{{Name: "connected"}},
+		},
+		{
+			Data: v1alpha1.ZarfPackage{Components: []v1alpha1.ZarfComponent{
+				{Name: "airgap", Images: []string{"docker.io/library/kept:latest"}},
+			}},
+			DeployedComponents: []state.DeployedComponent{{Name: "airgap"}},
+		},
+	}
+
+	require.NoError(t, doPruneImagesForPackages(ctx, options, &state.State{}, packages, address, true, false))
+	kept, err := testutil.NewRepo(t, address+"/library/kept").Resolve(ctx, "latest")
+	require.NoError(t, err)
+	require.Equal(t, keptDigest, kept.Digest.String())
+	_, err = testutil.NewRepo(t, address+"/library/unused").Resolve(ctx, unusedDigest)
+	require.ErrorIs(t, err, errdef.ErrNotFound)
+}
+
 func TestRegistryCopyPlatform(t *testing.T) {
 	ctx := context.Background()
 
```

**File**: `src/cmd/package.go` (modified, +10/-3)
```diff
@@ -565,7 +565,7 @@ func deploy(ctx context.Context, pkgLayout *layout.PackageLayout, opts packager.
 			return nil, err
 		}
 	}
-	err := confirmDeploy(ctx, pkgLayout, setVariables, opts.IsInteractive)
+	err := confirmDeploy(ctx, pkgLayout, setVariables, opts.IsInteractive, opts.Connected)
 	if err != nil {
 		return nil, err
 	}
@@ -589,11 +589,18 @@ func deploy(ctx context.Context, pkgLayout *layout.PackageLayout, opts packager.
 	return result.DeployedComponents, nil
 }
 
-func confirmDeploy(ctx context.Context, pkgLayout *layout.PackageLayout, setVariables map[string]string, isInteractive bool) (err error) {
+func confirmDeploy(ctx context.Context, pkgLayout *layout.PackageLayout, setVariables map[string]string, isInteractive bool, connected bool) (err error) {
 	l := logger.From(ctx)
 	pkg := pkgLayout.Definition()
 
-	displayPackage, err := packageForDisplay(pkg)
+	displayPkg := pkg
+	// Operate on temp package so IsSbomAble still works
+	if connected || pkg.Metadata.YOLO {
+		displayPkg.Components = slices.Clone(pkg.Components)
+		displayPkg.RemoveImages()
+		displayPkg.RemoveRepositories()
+	}
+	displayPackage, err := packageForDisplay(displayPkg)
 	if err != nil {
 		return err
 	}
```

**File**: `src/pkg/packager/deploy.go` (modified, +6/-2)
```diff
@@ -156,6 +156,10 @@ func Deploy(ctx context.Context, pkgLayout *layout.PackageLayout, opts DeployOpt
 	if err := pkgLayout.Filter(filters.ByLocalOS(runtime.GOOS)); err != nil {
 		return DeployResult{}, err
 	}
+	if opts.Connected {
+		pkgLayout.RemoveImages()
+		pkgLayout.RemoveRepositories()
+	}
 	pkg = pkgLayout.Definition()
 
 	variableConfig, err := getPopulatedVariableConfig(ctx, pkg, opts.SetVariables, opts.IsInteractive)
@@ -490,10 +494,10 @@ func (d *deployer) deployComponent(ctx context.Context, pkgLayout *layout.Packag
 
 	l.Info("deploying component", "name", component.Name)
 
-	hasImages := len(component.GetImages()) > 0 && !noImgPush && !opts.Connected
+	hasImages := len(component.GetImages()) > 0 && !noImgPush
 	hasCharts := len(component.Charts) > 0
 	hasManifests := len(component.Manifests) > 0
-	hasRepos := len(component.Repositories) > 0 && !opts.Connected
+	hasRepos := len(component.Repositories) > 0
 	hasFiles := len(component.Files) > 0
 
 	onDeploy := component.Actions.OnDeploy
```

**File**: `src/test/e2e/47_connected_deploy_test.go` (modified, +6/-0)
```diff
@@ -29,6 +29,8 @@ func TestConnectedDeploy(t *testing.T) {
 
 	stdOut, stdErr, err = e2e.Zarf(t, "package", "deploy", pkgPath, "--connected", "--confirm")
 	require.NoError(t, err, stdOut, stdErr)
+	require.NotContains(t, stdOut, "images:", "deployment preview should omit images that will not be pushed")
+	require.Contains(t, stdErr, "does NOT contain an SBOM", "deployment preview should still report package SBOM availability")
 
 	// Verify the deployment does not have a mutated pod
 	c, err := cluster.New(t.Context())
@@ -43,6 +45,10 @@ func TestConnectedDeploy(t *testing.T) {
 	deployedPkg, err := c.GetDeployedPackage(t.Context(), "connected-deploy")
 	require.NoError(t, err)
 	require.Equal(t, state.PackageConnectivityConnected, deployedPkg.GetPackageConnectivity(), "package secret should record connected deploy mode")
+	pkg, err := deployedPkg.Definition()
+	require.NoError(t, err)
+	require.Len(t, pkg.Components, 1)
+	require.Empty(t, pkg.Components[0].Images, "deployed definition should omit images that were not pushed")
 
 	stdOut, stdErr, err = e2e.Zarf(t, "package", "remove", "connected-deploy", "--confirm")
 	require.NoError(t, err, stdOut, stdErr)
```

---

### Incident Patch 2: `7be076ab` (2026-09-30)
**Commit Message**: fix(helm)!: only label pod templates of built-in workload kinds (#5360)

Signed-off-by: Igor de Beijer <71566757+idebeijer@users.noreply.github.com>

**File**: `src/internal/packager/helm/post-render.go` (modified, +73/-22)
```diff
@@ -196,8 +196,8 @@ func (r *renderer) editHelmResources(ctx context.Context, resources []releaseuti
 				labels = map[string]string{}
 			}
 			obj.SetLabels(r.setPackageLabels(labels))
-			// Add the package label to pod templates (for Deployments, StatefulSets, etc.)
-			if err := r.addLabelsToNestedPath(obj, []string{"spec", "template", "metadata", "labels"}); err != nil {
+			// Add the package label to the pod template of anything that has one
+			if err := r.addPodTemplateLabels(obj); err != nil {
 				return fmt.Errorf("failed to add labels to pod template: %w", err)
 			}
 			// In connected or YOLO mode, add agent ignore labels so the webhook doesn't mutate resources
@@ -321,23 +321,77 @@ func flattenListResource(obj *unstructured.Unstructured, addResource func(*unstr
 	})
 }
 
-// addLabelsToNestedPath adds package labels to a nested path in an unstructured object
-func (r *renderer) addLabelsToNestedPath(obj *unstructured.Unstructured, path []string) error {
-	// Check if the nested path exists and get the labels
-	templateLabels, found, err := unstructured.NestedStringMap(obj.Object, path...)
-	if err != nil {
-		return err
-	} else if !found {
-		// Path doesn't exist, nothing to do
+// podTemplateKinds maps the kubernetes kinds that create pods to where their pod template keeps its
+// labels. Only these are labeled: anything may sit at spec.template on a custom resource, and a chart
+// that wants one labeled can set zarf.dev/package={{ .Pkg.Metadata.Name }} itself.
+var podTemplateKinds = map[schema.GroupKind][]string{
+	{Group: "apps", Kind: "Deployment"}:        {"spec", "template", "metadata", "labels"},
+	{Group: "apps", Kind: "StatefulSet"}:       {"spec", "template", "metadata", "labels"},
+	{Group: "apps", Kind: "DaemonSet"}:         {"spec", "template", "metadata", "labels"},
+	{Group: "apps", Kind: "ReplicaSet"}:        {"spec", "template", "metadata", "labels"},
+	{Group: "batch", Kind: "Job"}:              {"spec", "template", "metadata", "labels"},
+	{Group: "batch", Kind: "CronJob"}:          {"spec", "jobTemplate", "spec", "template", "metadata", "labels"},
+	{Group: "", Kind: "ReplicationController"}: {"spec", "template", "metadata", "labels"},
+}
+
+// addPodTemplateLabels adds the package labels to the pod template of a workload resource
+func (r *renderer) addPodTemplateLabels(obj *unstructured.Unstructured) error {
+	path, createsPods := podTemplateKinds[obj.GroupVersionKind().GroupKind()]
+	if !createsPods {
+		return nil
+	}
+	labels, found := ensureLabelsAt(obj, path)
+	if !found {
+		// nothing shaped like a pod template, so nothing to label
 		return nil
 	}
-	if templateLabels == nil {
-		templateLabels = map[string]string{}
+	return unstructured.SetNestedStringMap(obj.Object, r.setPackageLabels(labels), path...)
+}
+
+// objectMetaTail counts the trailing metadata and labels segments every label path ends in, as in
+// spec.template.metadata.labels.
+const objectMetaTail = 2
+
+// ensureLabelsAt returns the label map at path, creating it when the manifest left it out or wrote
+// it as null. Finding none is an answer, not an error: anything may sit at spec.template, and a
+// malformed resource is the API server's to report, not zarf's to fail a deploy over.
+func ensureLabelsAt(obj *unstructured.Unstructured, path []string) (map[string]string, bool) {
+	if len(path) < objectMetaTail {
+		return nil, false
+	}
+	// the route down has to exist already, since writing it in would invent a pod template the
+	// chart never asked for; the ObjectMeta and labels at the end are optional, so those are created
+	parentPath, metaPath := path[:len(path)-objectMetaTail], path[len(path)-objectMetaTail:]
+
+	parent := obj.Object
+	for _, field := range parentPath {
+		nested, isMap := parent[field].(map[string]interface{})
+		if !isMap {
+			return nil, false
+		}
+		parent = nested
+	}
+	for _, field := range metaPath {
+		nested, isMap := parent[field].(map[string]interface{})
+		if !isMap {
+			i
```

**File**: `src/internal/packager/helm/post-render_test.go` (modified, +394/-0)
```diff
@@ -245,6 +245,24 @@ func TestAddAgentIgnoreLabels(t *testing.T) {
 			}},
 			expectLabel: true,
 		},
+		{
+			name: "Deployment with pod template labels written as null",
+			obj: &unstructured.Unstructured{Object: map[string]interface{}{
+				"apiVersion": "apps/v1",
+				"kind":       "Deployment",
+				"metadata": map[string]interface{}{
+					"name": "null-template-labels",
+				},
+				"spec": map[string]interface{}{
+					"template": map[string]interface{}{
+						"metadata": map[string]interface{}{
+							"labels": nil,
+						},
+					},
+				},
+			}},
+			expectLabel: true,
+		},
 		{
 			name: "ArgoCD repository secret gets label",
 			obj: &unstructured.Unstructured{Object: map[string]interface{}{
@@ -758,6 +776,382 @@ items:
 	require.Equal(t, "ignore", templateLabels["zarf.dev/agent"])
 }
 
+func TestEditHelmResourcesPodTemplateLabels(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name     string
+		manifest string
+		expected map[string]string
+		path     []string
+	}{
+		{
+			name: "pod template labels written as null",
+			manifest: `apiVersion: batch/v1
+kind: Job
+metadata:
+  name: null-template-labels
+spec:
+  template:
+    metadata:
+      labels: null
+`,
+			expected: map[string]string{"zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "pod template with no labels of its own",
+			manifest: `apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: no-template-labels
+spec:
+  template:
+    metadata: {}
+`,
+			expected: map[string]string{"zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "pod template labels are kept",
+			manifest: `apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: with-template-labels
+spec:
+  template:
+    metadata:
+      labels:
+        app: mine
+`,
+			expected: map[string]string{"app": "mine", "zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "pod template metadata written as null",
+			manifest: `apiVersion: batch/v1
+kind: Job
+metadata:
+  name: null-template-metadata
+spec:
+  template:
+    metadata: null
+    spec:
+      restartPolicy: Never
+      containers:
+        - name: main
+          image: busybox
+`,
+			expected: map[string]string{"zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "replicationcontroller pod template",
+			manifest: `apiVersion: v1
+kind: ReplicationController
+metadata:
+  name: rc
+spec:
+  template:
+    metadata:
+      labels:
+        app: mine
+`,
+			expected: map[string]string{"app": "mine", "zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "cronjob keeps its pod template a level deeper",
+			manifest: `apiVersion: batch/v1
+kind: CronJob
+metadata:
+  name: nested-template
+spec:
+  schedule: "* * * * *"
+  jobTemplate:
+    spec:
+      template:
+        metadata:
+          labels:
+            app: mine
+`,
+			expected: map[string]string{"app": "mine", "zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "jobTemplate", "spec", "template", "metadata", "labels"},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+
+			docs := renderManifest(t, newTestRenderer(), tt.manifest)
+			require.Len(t, docs, 1)
+			labels, found, err := unstructured.NestedStringMap(docs[0].Object, tt.path...)
+			require.NoError(t, err)
+			require.True(t, found)
+			require.Equal(t, tt.expected, labels)
+		})
+	}
+}
+
+func TestEditHelmResourcesWithoutAPodTemplateToLabel(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name     string
+		manifest string
+	}{
+		{
+			name: "pod template written as null",
+			manifest: `apiVersion: batch/v1
+kind: Job
+metadata:
+  name: null-template
+spec:
+  template: null
+`,
+		},
+
```

---

### Incident Patch 3: `379379a2` (2026-09-30)
**Commit Message**: fix: replace github.com/defenseunicorns/pkg with local versions (#5324)

Signed-off-by: Maciej Szulik <maciej@defenseunicorns.com>

**File**: `go.mod` (modified, +0/-2)
```diff
@@ -16,8 +16,6 @@ require (
 	github.com/anchore/stereoscope v0.3.1
 	github.com/anchore/syft v1.51.1
 	github.com/avast/retry-go/v4 v4.7.0
-	github.com/defenseunicorns/pkg/helpers/v2 v2.0.4
-	github.com/defenseunicorns/pkg/oci v1.3.2
 	github.com/derailed/k9s v0.51.0
 	github.com/distribution/distribution/v3 v3.1.1
 	github.com/distribution/reference v0.6.0
```

**File**: `go.sum` (modified, +0/-4)
```diff
@@ -557,10 +557,6 @@ github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.1 h1:5RVFMOWjMyRy8cARdy79nAmgYw3h
 github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.1/go.mod h1:ZXNYxsqcloTdSy/rNShjYzMhyjf0LaoftYK0p+A3h40=
 github.com/defenseunicorns/gojsonschema v0.0.0-20231116163348-e00f069122d6 h1:gwevOZ0fxT2nzM9hrtdPbsiOHjFqDRIYMzJHba3/G6Q=
 github.com/defenseunicorns/gojsonschema v0.0.0-20231116163348-e00f069122d6/go.mod h1:StKLYMmPj1R5yIs6CK49EkcW1TvUYuw5Vri+LRk7Dy8=
-github.com/defenseunicorns/pkg/helpers/v2 v2.0.4 h1:niBIdhRUpJghWthzJJq/SKr/dYQHW9Mn97UJT5I/2SI=
-github.com/defenseunicorns/pkg/helpers/v2 v2.0.4/go.mod h1:7demM0eE/+nMqPT7PCKgO9/KVUmRSyi9UpDzb0KfYDM=
-github.com/defenseunicorns/pkg/oci v1.3.2 h1:7Ph4DRwcccwGPKrEGDPZTkY4VJaJ1qqZVNmr3G1Hup0=
-github.com/defenseunicorns/pkg/oci v1.3.2/go.mod h1:iXzZXG7jNjkOIt5MqQp12iZH3c762zP0AOVwKTGhNhY=
 github.com/deitch/magic v0.0.0-20240306090643-c67ab88f10cb h1:4W/2rQ3wzEimF5s+J6OY3ODiQtJZ5W1sForSgogVXkY=
 github.com/deitch/magic v0.0.0-20240306090643-c67ab88f10cb/go.mod h1:B3tI9iGHi4imdLi4Asdha1Sc6feLMTfPLXh9IUYmysk=
 github.com/depcheck-test/depcheck-test v0.0.0-20220607135614-199033aaa936 h1:foGzavPWwtoyBvjWyKJYDYsyzy+23iBV7NKTwdk+LRY=
```

**File**: `src/cmd/component.go` (modified, +1/-1)
```diff
@@ -9,11 +9,11 @@ import (
 	"path"
 	"strings"
 
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	"github.com/spf13/cobra"
 	"github.com/spf13/viper"
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/pkg/component"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/signing"
 	"oras.land/oras-go/v2/registry"
```

**File**: `src/cmd/connect.go` (modified, +1/-1)
```diff
@@ -9,8 +9,8 @@ import (
 	"fmt"
 	"strings"
 
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	"github.com/spf13/cobra"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/pkg/cluster"
```

**File**: `src/cmd/destroy.go` (modified, +1/-1)
```diff
@@ -11,11 +11,11 @@ import (
 	"os"
 	"regexp"
 
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	"github.com/zarf-dev/zarf/src/config"
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/internal/packager/helm"
 	"github.com/zarf-dev/zarf/src/pkg/cluster"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/utils/exec"
 
```

---

### Incident Patch 4: `d07690ec` (2026-09-28)
**Commit Message**: fix(assemble): cleanup temporary directory on error (#5407)

Signed-off-by: Brandt Keller <brandt.keller@defenseunicorns.com>

**File**: `src/pkg/packager/assemble/assemble.go` (modified, +5/-0)
```diff
@@ -116,6 +116,11 @@ func AssemblePackage(ctx context.Context, resolvedPackage *load.ResolvedPackage,
 	if err != nil {
 		return nil, err
 	}
+	defer func() {
+		if err != nil {
+			err = errors.Join(err, os.RemoveAll(buildPath))
+		}
+	}()
 	for _, component := range pkg.Components {
 		err := assemblePackageComponent(ctx, component, resolvedPackage.Resources, buildPath, opts.CachePath, opts.RemoteOptions)
 		if err != nil {
```

**File**: `src/pkg/packager/assemble/assemble_test.go` (modified, +40/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"github.com/zarf-dev/zarf/src/api/convert"
 	"github.com/zarf-dev/zarf/src/api/v1alpha1"
 	"github.com/zarf-dev/zarf/src/api/v1beta1"
+	"github.com/zarf-dev/zarf/src/config"
 	"github.com/zarf-dev/zarf/src/internal/pkgcfg"
 	"github.com/zarf-dev/zarf/src/pkg/images"
 	"github.com/zarf-dev/zarf/src/pkg/packager/layout"
@@ -558,6 +559,45 @@ components:
 	}
 }
 
+func TestAssemblePackageCleansStagingDirectoryOnSuccessActionFailure(t *testing.T) {
+	// This test configures a process-global temporary directory.
+	tempDirectory := t.TempDir()
+	originalTempDirectory := config.CommonOptions.TempDirectory
+	config.CommonOptions.TempDirectory = tempDirectory
+	t.Cleanup(func() {
+		config.CommonOptions.TempDirectory = originalTempDirectory
+	})
+
+	ctx := testutil.TestContext(t)
+	sourcePath, err := filepath.Abs(filepath.Join("testdata", "zarf-package", "data.txt"))
+	require.NoError(t, err)
+	dir := t.TempDir()
+	definition := fmt.Sprintf(`apiVersion: zarf.dev/v1beta1
+kind: ZarfPackageConfig
+metadata:
+  name: create-actions
+components:
+  - name: component
+    files:
+      - source: %q
+        destination: data.txt
+    actions:
+      onCreate:
+        onSuccess:
+          - cmd: exit 1
+`, sourcePath)
+	require.NoError(t, os.WriteFile(filepath.Join(dir, layout.ZarfYAML), []byte(definition), 0o600))
+
+	loaded, err := load.Package(ctx, dir, load.PackageOptions{})
+	require.NoError(t, err)
+	_, err = AssemblePackage(ctx, loaded, AssembleOptions{SkipSBOM: true})
+	require.ErrorContains(t, err, "unable to run component success action")
+
+	entries, err := os.ReadDir(tempDirectory)
+	require.NoError(t, err)
+	require.Empty(t, entries)
+}
+
 func TestAssemblePackageWritesResolvedValues(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 5: `dd7301bd` (2026-09-28)
**Commit Message**: fix(create): run OnSuccess and OnFailure actions during create (#5406)

Signed-off-by: Austin Abro <austinabro321@gmail.com>

**File**: `src/pkg/packager/assemble/assemble.go` (modified, +13/-1)
```diff
@@ -362,6 +362,19 @@ func assemblePackageComponent(ctx context.Context, component api.Component, reso
 	if err != nil {
 		return err
 	}
+	onCreate := component.Actions.OnCreate
+	defer func() {
+		if err == nil {
+			if successErr := actions.Run(ctx, packagePath, onCreate.OnSuccess, actions.RunOptions{DefaultConfig: onCreate.Defaults}); successErr != nil {
+				err = fmt.Errorf("unable to run component success action: %w", successErr)
+			}
+		}
+		if err != nil {
+			if failureErr := actions.Run(ctx, packagePath, onCreate.OnFailure, actions.RunOptions{DefaultConfig: onCreate.Defaults}); failureErr != nil {
+				err = errors.Join(err, fmt.Errorf("unable to run component failure action: %w", failureErr))
+			}
+		}
+	}()
 	tmpBuildPath, err := utils.MakeTempDir(config.CommonOptions.TempDirectory)
 	if err != nil {
 		return err
@@ -375,7 +388,6 @@ func assemblePackageComponent(ctx context.Context, component api.Component, reso
 		return err
 	}
 
-	onCreate := component.Actions.OnCreate
 	if err := actions.Run(ctx, packagePath, onCreate.Before, actions.RunOptions{DefaultConfig: onCreate.Defaults}); err != nil {
 		return fmt.Errorf("unable to run component before action: %w", err)
 	}
```

**File**: `src/pkg/packager/assemble/assemble_test.go` (modified, +84/-0)
```diff
@@ -474,6 +474,90 @@ func writePackageToDisk(t *testing.T, pkg v1alpha1.ZarfPackage, dir string) {
 	require.NoError(t, err)
 }
 
+func TestAssemblePackageOnCreateOutcomeActions(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name        string
+		before      string
+		onSuccess   string
+		wantError   string
+		wantBefore  bool
+		wantSuccess bool
+		wantFailure bool
+	}{
+		{
+			name:        "successful creation",
+			before:      "echo before > before.txt",
+			onSuccess:   "echo success > success.txt",
+			wantBefore:  true,
+			wantSuccess: true,
+		},
+		{
+			name:        "failed before action",
+			before:      "exit 1",
+			onSuccess:   "echo success > success.txt",
+			wantError:   "unable to run component before action",
+			wantFailure: true,
+		},
+		{
+			name:        "failed success action",
+			before:      "echo before > before.txt",
+			onSuccess:   "exit 1",
+			wantError:   "unable to run component success action",
+			wantBefore:  true,
+			wantFailure: true,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			ctx := testutil.TestContext(t)
+			dir := t.TempDir()
+			definition := fmt.Sprintf(`apiVersion: zarf.dev/v1beta1
+kind: ZarfPackageConfig
+metadata:
+  name: create-actions
+components:
+  - name: component
+    actions:
+      onCreate:
+        before:
+          - cmd: %q
+        onSuccess:
+          - cmd: %q
+        onFailure:
+          - cmd: echo failure > failure.txt
+`, tt.before, tt.onSuccess)
+			require.NoError(t, os.WriteFile(filepath.Join(dir, layout.ZarfYAML), []byte(definition), 0o600))
+
+			loaded, err := load.Package(ctx, dir, load.PackageOptions{})
+			require.NoError(t, err)
+			pkgLayout, err := AssemblePackage(ctx, loaded, AssembleOptions{SkipSBOM: true})
+			if tt.wantError != "" {
+				require.ErrorContains(t, err, tt.wantError)
+			} else {
+				require.NoError(t, err)
+				t.Cleanup(func() { require.NoError(t, pkgLayout.Cleanup()) })
+			}
+
+			for name, want := range map[string]bool{
+				"before.txt":  tt.wantBefore,
+				"success.txt": tt.wantSuccess,
+				"failure.txt": tt.wantFailure,
+			} {
+				path := filepath.Join(dir, name)
+				if want {
+					require.FileExists(t, path)
+				} else {
+					require.NoFileExists(t, path)
+				}
+			}
+		})
+	}
+}
+
 func TestAssemblePackageWritesResolvedValues(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 6: `c18603a9` (2026-09-25)
**Commit Message**: fix(init): propagate secret updates on init mode changes (#5398)

Signed-off-by: Brandt Keller <brandt.keller@defenseunicorns.com>

**File**: `src/pkg/cluster/secrets.go` (modified, +6/-0)
```diff
@@ -5,6 +5,7 @@
 package cluster
 
 import (
+	"bytes"
 	"context"
 	"encoding/base64"
 	"encoding/json"
@@ -142,6 +143,11 @@ func (c *Cluster) UpdateZarfManagedImageSecrets(ctx context.Context, s *state.St
 		if err != nil {
 			return err
 		}
+		// Avoid writes when the credentials already match the target registry state.
+		if currentRegistrySecret.Type == corev1.SecretTypeDockerConfigJson &&
+			bytes.Equal(currentRegistrySecret.Data[".dockerconfigjson"], newRegistrySecret.Data[".dockerconfigjson"]) {
+			continue
+		}
 		l.Info("applying Zarf managed registry secret for namespace", "name", namespace.Name)
 		_, err = c.Clientset.CoreV1().Secrets(*newRegistrySecret.Namespace).Apply(ctx, newRegistrySecret, metav1.ApplyOptions{Force: true, FieldManager: FieldManagerName})
 		if err != nil {
```

**File**: `src/pkg/cluster/secrets_test.go` (modified, +53/-0)
```diff
@@ -207,3 +207,56 @@ func TestUpdateZarfManagedSecrets(t *testing.T) {
 		})
 	}
 }
+
+func TestUpdateZarfManagedImageSecrets_SkipsCurrentSecret(t *testing.T) {
+	ctx := testutil.TestContext(t)
+	clientset := fake.NewClientset()
+	c := &Cluster{Clientset: clientset}
+
+	namespace := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test"}}
+	_, err := clientset.CoreV1().Namespaces().Create(ctx, namespace, metav1.CreateOptions{})
+	require.NoError(t, err)
+
+	svc := &corev1.Service{
+		ObjectMeta: metav1.ObjectMeta{Name: "good-service", Namespace: namespace.Name},
+		Spec: corev1.ServiceSpec{
+			Type: corev1.ServiceTypeNodePort,
+			Ports: []corev1.ServicePort{{
+				NodePort: 30001,
+				Port:     3333,
+			}},
+			ClusterIP: "10.11.12.13",
+		},
+	}
+	_, err = clientset.CoreV1().Services(namespace.Name).Create(ctx, svc, metav1.CreateOptions{})
+	require.NoError(t, err)
+
+	s := &state.State{
+		RegistryInfo: state.RegistryInfo{
+			PullUsername: "pull-user",
+			PullPassword: "pull-password",
+			Address:      "127.0.0.1:30001",
+		},
+	}
+	desiredRegistrySecret, err := c.GenerateRegistryPullCreds(ctx, namespace.Name, config.ZarfImagePullSecretName, s.RegistryInfo)
+	require.NoError(t, err)
+	currentRegistrySecret := &corev1.Secret{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      config.ZarfImagePullSecretName,
+			Namespace: namespace.Name,
+			Labels: map[string]string{
+				state.ZarfManagedByLabel: "zarf",
+			},
+		},
+		Type: corev1.SecretTypeDockerConfigJson,
+		Data: desiredRegistrySecret.Data,
+	}
+	_, err = clientset.CoreV1().Secrets(namespace.Name).Create(ctx, currentRegistrySecret, metav1.CreateOptions{})
+	require.NoError(t, err)
+
+	actionsBefore := len(clientset.Actions())
+	require.NoError(t, c.UpdateZarfManagedImageSecrets(ctx, s))
+	for _, action := range clientset.Actions()[actionsBefore:] {
+		require.NotEqual(t, "patch", action.GetVerb())
+	}
+}
```

**File**: `src/pkg/packager/deploy.go` (modified, +5/-0)
```diff
@@ -459,6 +459,11 @@ func (d *deployer) deployInitComponent(ctx context.Context, pkgLayout *layout.Pa
 	if err != nil {
 		return nil, err
 	}
+	if isRegistry && d.s.RegistryInfo.IsInternal() {
+		if err := d.c.UpdateZarfManagedImageSecrets(ctx, d.s); err != nil {
+			return nil, fmt.Errorf("unable to reconcile Zarf-managed image pull secrets: %w", err)
+		}
+	}
 
 	// Do cleanup for when we inject the seed registry during initialization
 	if isSeedRegistry && d.s.RegistryInfo.RegistryMode == state.RegistryModeNodePort {
```

---

### Incident Patch 7: `7b7a4480` (2026-09-24)
**Commit Message**: docs: fix tagline (#5392)

Signed-off-by: Austin Abro <austinabro321@gmail.com>

**File**: `.goreleaser.yaml` (modified, +2/-2)
```diff
@@ -107,7 +107,7 @@ brews:
 
     commit_msg_template: "build(release): upgrade {{ .ProjectName }} to {{ .Tag }}"
     homepage: "https://zarf.dev/"
-    description: "The Airgap Native Packager Manager for Kubernetes"
+    description: "The Airgap Native Package Manager for Kubernetes"
 
   # NOTE: We are using .Version instead of .Tag because homebrew has weird semver parsing rules and won't be able to
   #       install versioned releases that has a `v` character before the version number.
@@ -125,4 +125,4 @@ brews:
           name: homebrew-tap
     commit_msg_template: "build(release): {{ .ProjectName }}@{{ .Tag }}"
     homepage: "https://zarf.dev/"
-    description: "The Airgap Native Packager Manager for Kubernetes"
+    description: "The Airgap Native Package Manager for Kubernetes"
```

**File**: `site/src/content/docs/commands/zarf.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ tableOfContents: false
 
 ## zarf
 
-The Airgap Native Packager Manager for Kubernetes
+The Airgap Native Package Manager for Kubernetes
 
 ### Synopsis
 
```

**File**: `site/src/content/docs/commands/zarf_completion.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ See each sub-command's help for details on how to use the generated script.
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 * [zarf completion bash](/commands/zarf_completion_bash/)	 - Generate the autocompletion script for bash
 * [zarf completion fish](/commands/zarf_completion_fish/)	 - Generate the autocompletion script for fish
 * [zarf completion powershell](/commands/zarf_completion_powershell/)	 - Generate the autocompletion script for powershell
```

**File**: `site/src/content/docs/commands/zarf_connect.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ zarf connect { REGISTRY | GIT | connect-name } [flags]
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 * [zarf connect list](/commands/zarf_connect_list/)	 - Lists all available connection shortcuts
 * [zarf connect resource](/commands/zarf_connect_resource/)	 - Connect to a service or pod in the cluster
 
```

**File**: `site/src/content/docs/commands/zarf_destroy.md` (modified, +1/-1)
```diff
@@ -48,5 +48,5 @@ zarf destroy --confirm [flags]
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 
```

---

### Incident Patch 8: `1f7bbc9f` (2026-09-18)
**Commit Message**: fix(helm): handle charts that render resources inside list kinds (#5344)

Signed-off-by: Igor de Beijer <71566757+idebeijer@users.noreply.github.com>

**File**: `src/internal/packager/helm/post-render.go` (modified, +58/-0)
```diff
@@ -183,6 +183,10 @@ func (r *renderer) shouldAddAgentIgnoreLabels() bool {
 
 func (r *renderer) editHelmResources(ctx context.Context, resources []releaseutil.Manifest, finalManifestsOutput *bytes.Buffer) error {
 	l := logger.From(ctx)
+	resources, err := flattenHelmResources(resources)
+	if err != nil {
+		return err
+	}
 	for _, resource := range resources {
 		// parse to unstructured to have access to more data than just the name
 		newContent, rawData, err := processManifestContent(resource.Content, func(obj *unstructured.Unstructured) error {
@@ -263,6 +267,60 @@ func (r *renderer) editHelmResources(ctx context.Context, resources []releaseuti
 	return nil
 }
 
+// flattenHelmResources replaces every list document with the resources it holds, so that the rest
+// of the post renderer only ever sees one resource per manifest.
+// A list is a wrapper rather than a resource: its metadata is a ListMeta, which has no labels
+// field, so a label written there is rejected by the API server, and everything zarf keys off the
+// kind of a document misses what the list holds. Helm flattens a list into its items before
+// applying it anyway, so the items are what ends up in the cluster either way.
+func flattenHelmResources(resources []releaseutil.Manifest) ([]releaseutil.Manifest, error) {
+	flattened := make([]releaseutil.Manifest, 0, len(resources))
+	for _, resource := range resources {
+		_, rawData, err := processManifestContent(resource.Content, nil)
+		if err != nil {
+			return nil, err
+		}
+		// IsList is the check helm's resource builder uses to decide what to flatten, so zarf and
+		// helm agree on which documents hold more than one resource
+		if len(rawData.Object) == 0 || !rawData.IsList() {
+			flattened = append(flattened, resource)
+			continue
+		}
+		err = flattenListResource(rawData, func(obj *unstructured.Unstructured) error {
+			content, err := yaml.Marshal(obj.Object)
+			if err != nil {
+				return fmt.Errorf("failed to marshal list item: %w", err)
+			}
+			// the item inherits the manifest name zarf writes its own source comment from. helm
+			// tracks the original file with an annotation it puts on the wrapper, which the item
+			// does not carry, so helm files these under a generated name of its own
+			item := resource
+			item.Content = string(content)
+			flattened = append(flattened, item)
+			return nil
+		})
+		if err != nil {
+			return nil, fmt.Errorf("failed to flatten %s: %w", rawData.GetKind(), err)
+		}
+	}
+	return flattened, nil
+}
+
+// flattenListResource calls addResource once for every resource a document holds, walking a list
+// that holds lists all the way down
+func flattenListResource(obj *unstructured.Unstructured, addResource func(*unstructured.Unstructured) error) error {
+	if !obj.IsList() {
+		return addResource(obj)
+	}
+	return obj.EachListItem(func(item runtime.Object) error {
+		listItem, ok := item.(*unstructured.Unstructured)
+		if !ok {
+			return fmt.Errorf("unexpected item of type %T in %s", item, obj.GetKind())
+		}
+		return flattenListResource(listItem, addResource)
+	})
+}
+
 // addLabelsToNestedPath adds package labels to a nested path in an unstructured object
 func (r *renderer) addLabelsToNestedPath(obj *unstructured.Unstructured, path []string) error {
 	// Check if the nested path exists and get the labels
```

**File**: `src/internal/packager/helm/post-render_test.go` (modified, +368/-0)
```diff
@@ -4,6 +4,9 @@
 package helm
 
 import (
+	"bytes"
+	"errors"
+	"io"
 	"os"
 	"path/filepath"
 	"regexp"
@@ -13,9 +16,13 @@ import (
 	"github.com/stretchr/testify/require"
 	"github.com/zarf-dev/zarf/src/pkg/pki"
 	"github.com/zarf-dev/zarf/src/pkg/state"
+	"github.com/zarf-dev/zarf/src/test/testutil"
+	releaseutil "helm.sh/helm/v4/pkg/release/v1/util"
 	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
+	corev1 "k8s.io/api/core/v1"
 	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
 	"k8s.io/apimachinery/pkg/runtime/schema"
+	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
 	"sigs.k8s.io/yaml"
 )
 
@@ -534,3 +541,364 @@ func TestProcessManifestContentEmptyObject(t *testing.T) {
 	require.NotNil(t, rawData)
 	require.Empty(t, rawData.Object)
 }
+
+func TestEditHelmResourcesListDocuments(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name     string
+		manifest string
+		assert   func(t *testing.T, docs []*unstructured.Unstructured)
+	}{
+		{
+			name: "typed list is replaced by the resources it holds",
+			manifest: `apiVersion: v1
+kind: ConfigMapList
+items:
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: repro-one
+    data:
+      hello: world
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: repro-two
+      labels:
+        grafana_dashboard: "1"
+    data:
+      hello: world
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Len(t, docs, 2)
+				// a list carries a ListMeta, which has no labels field, so a label written on the
+				// wrapper is rejected by the API server
+				require.Equal(t, "ConfigMap", docs[0].GetKind())
+				require.Equal(t, "ConfigMap", docs[1].GetKind())
+				require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels())
+				require.Equal(t, map[string]string{
+					"grafana_dashboard": "1",
+					"zarf.dev/package":  "test-pkg",
+				}, docs[1].GetLabels(), "existing item labels are kept")
+
+				// nothing else about the item changed
+				data, found, err := unstructured.NestedStringMap(docs[0].Object, "data")
+				require.NoError(t, err)
+				require.True(t, found)
+				require.Equal(t, map[string]string{"hello": "world"}, data)
+			},
+		},
+		{
+			name: "generic list labels pod templates of its items",
+			manifest: `apiVersion: v1
+kind: List
+items:
+  - apiVersion: apps/v1
+    kind: Deployment
+    metadata:
+      name: nested-deploy
+    spec:
+      template:
+        metadata:
+          labels:
+            app: nested
+        spec:
+          containers:
+            - name: main
+              image: nginx
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Len(t, docs, 1)
+				require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels())
+
+				templateLabels, found, err := unstructured.NestedStringMap(docs[0].Object, "spec", "template", "metadata", "labels")
+				require.NoError(t, err)
+				require.True(t, found)
+				require.Equal(t, map[string]string{
+					"app":              "nested",
+					"zarf.dev/package": "test-pkg",
+				}, templateLabels)
+			},
+		},
+		{
+			name: "list nested in a list is walked all the way down",
+			manifest: `apiVersion: v1
+kind: List
+items:
+  - apiVersion: v1
+    kind: ConfigMapList
+    items:
+      - apiVersion: v1
+        kind: ConfigMap
+        metadata:
+          name: deeply-nested
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Len(t, docs, 1)
+				require.Equal(t, "ConfigMap", docs[0].GetKind())
+				require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels())
+			},
+		},
+		{
+			name: "list that rendered no items leaves nothing behind",
+			manifest: `apiVersion: v1
+kind: ConfigMapList
+items: []
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Empty(t, docs)
+			},
+		},
+		{
+			name: "list kind whose items is not an array is a resource 
```

**File**: `src/test/e2e/25_helm_test.go` (modified, +51/-0)
```diff
@@ -309,3 +309,54 @@ func TestHelmHooks(t *testing.T) {
 	stdOut, stdErr, err = e2e.Zarf(t, "package", "remove", "helm-hooks", "--confirm")
 	require.NoError(t, err, stdOut, stdErr)
 }
+
+func TestHelmListKinds(t *testing.T) {
+	t.Log("E2E: Helm charts that render list kinds")
+
+	tmpdir := t.TempDir()
+	packagePath := filepath.Join("src", "test", "packages", "25-list-kinds")
+
+	stdOut, stdErr, err := e2e.Zarf(t, "package", "create", packagePath, "-o", tmpdir, "--confirm")
+	require.NoError(t, err, stdOut, stdErr)
+
+	pkgPath := filepath.Join(tmpdir, fmt.Sprintf("zarf-package-list-kinds-%s-0.1.0.tar.zst", e2e.Arch))
+	t.Cleanup(func() {
+		_, _, err := e2e.Kubectl(t, "delete", "namespace", "list-kinds-elsewhere", "list-kinds-nested-ns", "--ignore-not-found", "--grace-period=0")
+		require.NoError(t, err)
+	})
+	stdOut, stdErr, err = e2e.Zarf(t, "package", "deploy", pkgPath, "--confirm")
+	require.NoError(t, err, stdOut, stdErr)
+
+	// the configmaps only exist if helm accepted the list documents, and they only carry the
+	// package label if zarf labeled the items rather than the list wrapping them
+	kubectlOut, _, err := e2e.Kubectl(t, "-n", "list-kinds", "get", "configmaps", "-l", "zarf.dev/package=list-kinds", "-o", "jsonpath={.items[*].metadata.name}")
+	require.NoError(t, err)
+	require.Contains(t, kubectlOut, "list-one")
+	require.Contains(t, kubectlOut, "list-two")
+	require.Contains(t, kubectlOut, "generic-list-config")
+
+	// labels the chart set on an item are kept alongside the ones zarf adds
+	kubectlOut, _, err = e2e.Kubectl(t, "-n", "list-kinds", "get", "configmap", "list-two", "-o", "jsonpath={.metadata.labels.chart-owned}")
+	require.NoError(t, err)
+	require.Equal(t, "true", kubectlOut)
+
+	// an item can name a namespace of its own, which zarf has to create before helm applies it
+	kubectlOut, _, err = e2e.Kubectl(t, "-n", "list-kinds-elsewhere", "get", "configmap", "list-elsewhere", "-o", "jsonpath={.metadata.name}")
+	require.NoError(t, err)
+	require.Equal(t, "list-elsewhere", kubectlOut)
+
+	// a namespace rendered inside a list is zarf's to own, so it carries the zarf labels
+	kubectlOut, _, err = e2e.Kubectl(t, "get", "namespace", "list-kinds-nested-ns", "-o=jsonpath={.metadata.labels.app\\.kubernetes\\.io/managed-by}")
+	require.NoError(t, err)
+	require.Equal(t, "zarf", kubectlOut)
+
+	stdOut, stdErr, err = e2e.Zarf(t, "package", "remove", "list-kinds", "--confirm")
+	require.NoError(t, err, stdOut, stdErr)
+
+	// zarf owns that namespace rather than helm, so removing the package leaves it behind instead
+	// of taking everything living in it with it. a namespace helm deleted would still answer with
+	// its name while terminating, so read the phase rather than the name
+	kubectlOut, _, err = e2e.Kubectl(t, "get", "namespace", "list-kinds-nested-ns", "-o", "jsonpath={.status.phase}")
+	require.NoError(t, err)
+	require.Equal(t, "Active", kubectlOut)
+}
```

**File**: `src/test/packages/25-list-kinds/chart/Chart.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+apiVersion: v2
+name: list-kinds
+description: A chart that renders its resources inside list kinds
+type: application
+version: 0.1.0
+appVersion: "1.0"
```

**File**: `src/test/packages/25-list-kinds/chart/templates/configmaps.yaml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+apiVersion: v1
+kind: ConfigMapList
+items:
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: list-one
+      namespace: {{ .Release.Namespace }}
+    data:
+      message: "first item of a ConfigMapList"
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: list-two
+      namespace: {{ .Release.Namespace }}
+      labels:
+        chart-owned: "true"
+    data:
+      message: "second item of a ConfigMapList"
+---
+apiVersion: v1
+kind: ConfigMapList
+items:
+  # zarf has to create this namespace before helm applies the item, which it can only do if it
+  # reads the namespace off the items rather than off the list
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: list-elsewhere
+      namespace: list-kinds-elsewhere
+    data:
+      message: "an item pointing at a namespace nothing else creates"
```

---

### Incident Patch 9: `9a1699ab` (2026-09-17)
**Commit Message**: fix!: move sbom viewer behind disabled feature flag (#5368)

Signed-off-by: Brandt Keller <brandt.keller@defenseunicorns.com>

**File**: `src/pkg/feature/feature.go` (modified, +8/-0)
```diff
@@ -207,6 +207,7 @@ const (
 	RegistryProxy          Name = "registry-proxy"
 	Values                 Name = "values"
 	DockerDaemonDirectPull Name = "docker-daemon-direct-pull"
+	SBOMViewer             Name = "sbom-viewer"
 )
 
 func init() {
@@ -252,6 +253,13 @@ func init() {
 			Since:   "v0.80.0",
 			Stage:   GA,
 		},
+		{
+			Name:        SBOMViewer,
+			Description: "Enables deprecated SBOM viewer HTML generation during package creation.",
+			Enabled:     false,
+			Since:       "v0.86.0",
+			Stage:       Deprecated,
+		},
 	}
 
 	err := setDefault(features)
```

**File**: `src/pkg/packager/assemble/assemble_test.go` (modified, +2/-1)
```diff
@@ -787,8 +787,9 @@ func TestCreateAbsolutePathImports(t *testing.T) {
 	require.NoError(t, err)
 	require.FileExists(t, filepath.Join(importedFileComponent, "0", "file.txt"))
 
-	// Ensure the sbom exists as expected
+	// File-only packages include component SBOMs but not the deprecated viewer by default.
 	err = pkgLayout.GetSBOM(ctx, tmpdir)
 	require.NoError(t, err)
 	require.FileExists(t, filepath.Join(tmpdir, "zarf-component-file-import.json"))
+	require.NoFileExists(t, filepath.Join(tmpdir, "sbom-viewer-zarf-component-file-import.html"))
 }
```

**File**: `src/pkg/packager/assemble/sbom.go` (modified, +28/-17)
```diff
@@ -37,6 +37,7 @@ import (
 	"github.com/zarf-dev/zarf/src/api/v1alpha1"
 	"github.com/zarf-dev/zarf/src/config"
 	"github.com/zarf-dev/zarf/src/pkg/archive"
+	"github.com/zarf-dev/zarf/src/pkg/feature"
 	"github.com/zarf-dev/zarf/src/pkg/images"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/packager/layout"
@@ -60,10 +61,13 @@ func generateSBOM(ctx context.Context, pkg v1alpha1.ZarfPackage, buildPath strin
 		err = errors.Join(err, os.RemoveAll(outputPath))
 	}()
 
+	sbomViewerEnabled := feature.IsEnabled(feature.SBOMViewer)
 	componentSBOMs := []string{}
-	for _, comp := range pkg.Components {
-		if len(comp.Files) > 0 || len(comp.DataInjections) > 0 {
-			componentSBOMs = append(componentSBOMs, comp.Name)
+	if sbomViewerEnabled {
+		for _, comp := range pkg.Components {
+			if len(comp.Files) > 0 || len(comp.DataInjections) > 0 {
+				componentSBOMs = append(componentSBOMs, comp.Name)
+			}
 		}
 	}
 	type imageSBOMTarget struct {
@@ -88,13 +92,16 @@ func generateSBOM(ctx context.Context, pkg v1alpha1.ZarfPackage, buildPath strin
 		}
 	}
 
-	identifiers := make([]string, 0, len(targets))
-	for _, t := range targets {
-		identifiers = append(identifiers, t.identifier)
-	}
-	jsonList, err := generateJSONList(componentSBOMs, identifiers)
-	if err != nil {
-		return err
+	var jsonList []byte
+	if sbomViewerEnabled {
+		identifiers := make([]string, 0, len(targets))
+		for _, t := range targets {
+			identifiers = append(identifiers, t.identifier)
+		}
+		jsonList, err = generateJSONList(componentSBOMs, identifiers)
+		if err != nil {
+			return err
+		}
 	}
 
 	for index, t := range targets {
@@ -103,13 +110,15 @@ func generateSBOM(ctx context.Context, pkg v1alpha1.ZarfPackage, buildPath strin
 		if err != nil {
 			return fmt.Errorf("failed to create image sbom: %w", err)
 		}
-		err = createSBOMViewerAsset(outputPath, t.identifier, b, jsonList)
-		if err != nil {
-			return err
+		if sbomViewerEnabled {
+			err = createSBOMViewerAsset(outputPath, t.identifier, b, jsonList)
+			if err != nil {
+				return err
+			}
 		}
 	}
 
-	// Generate SBOM for each component
+	// Generate SBOM for each component.
 	for _, comp := range pkg.Components {
 		if len(comp.DataInjections) == 0 && len(comp.Files) == 0 {
 			continue
@@ -118,9 +127,11 @@ func generateSBOM(ctx context.Context, pkg v1alpha1.ZarfPackage, buildPath strin
 		if err != nil {
 			return err
 		}
-		err = createSBOMViewerAsset(outputPath, fmt.Sprintf("%s%s", componentPrefix, comp.Name), jsonData, jsonList)
-		if err != nil {
-			return err
+		if sbomViewerEnabled {
+			err = createSBOMViewerAsset(outputPath, fmt.Sprintf("%s%s", componentPrefix, comp.Name), jsonData, jsonList)
+			if err != nil {
+				return err
+			}
 		}
 	}
 
```

**File**: `src/test/e2e/04_create_templating_test.go` (modified, +2/-14)
```diff
@@ -20,7 +20,6 @@ import (
 func TestCreateTemplating(t *testing.T) {
 	t.Log("E2E: Create Templating")
 
-	sbomPath := t.TempDir()
 	outPath := t.TempDir()
 	templatingPath := filepath.Join(outPath, fmt.Sprintf("zarf-package-templating-%s.tar.zst", e2e.Arch))
 	fileFoldersPath := filepath.Join(outPath, fmt.Sprintf("zarf-package-file-folders-templating-sbom-%s.tar.zst", e2e.Arch))
@@ -38,21 +37,10 @@ func TestCreateTemplating(t *testing.T) {
 	expectedConstant := v1alpha1.Constant{Name: "PODINFO_VERSION", Value: "6.4.0", Pattern: "^[\\w\\-\\.]+$"}
 	require.Contains(t, pkgLayout.AsV1alpha1().Constants, expectedConstant)
 
-	// Test that files and file folders template and handle SBOMs correctly
-	_, _, err = e2e.Zarf(t, "package", "create", "src/test/packages/04-file-folders-templating-sbom/", "-o", outPath, "--sbom-out", sbomPath, "--confirm")
+	// Test templating files and folders.
+	_, _, err = e2e.Zarf(t, "package", "create", "src/test/packages/04-file-folders-templating-sbom/", "-o", outPath, "--confirm")
 	require.NoError(t, err)
 
-	// Ensure that the `requirements.txt` files are discovered correctly
-	require.FileExists(t, filepath.Join(sbomPath, "file-folders-templating-sbom", "sbom-viewer-zarf-component-folders.html"))
-	foldersJSON, err := os.ReadFile(filepath.Join(sbomPath, "file-folders-templating-sbom", "zarf-component-folders.json"))
-	require.NoError(t, err)
-	require.Contains(t, string(foldersJSON), "numpy")
-	_, err = os.ReadFile(filepath.Join(sbomPath, "file-folders-templating-sbom", "sbom-viewer-zarf-component-files.html"))
-	require.NoError(t, err)
-	filesJSON, err := os.ReadFile(filepath.Join(sbomPath, "file-folders-templating-sbom", "zarf-component-files.json"))
-	require.NoError(t, err)
-	require.Contains(t, string(filesJSON), "pandas")
-
 	// Deploy the package and look for the variables in the output
 	workingPath := t.TempDir()
 	_, _, err = e2e.ZarfInDir(t, workingPath, "package", "deploy", fileFoldersPath, "--set", "DOGGO=doggy", "--set", "KITTEH=meowza", "--set", "PANDA=pandemonium", "--confirm")
```

**File**: `src/test/e2e/05_tarball_test.go` (modified, +0/-8)
```diff
@@ -408,10 +408,6 @@ func TestPackageTarballDirectoryStructure(t *testing.T) {
 			// |-- sboms
 			// |   |-- ghcr.io_stefanprodan_podinfo_6.4.0.json
 			// |   |-- ghcr.io_stefanprodan_podinfo_6.4.1.json
-			// |   |-- sbom-viewer-ghcr.io_stefanprodan_podinfo_6.4.0.html
-			// |   |-- sbom-viewer-ghcr.io_stefanprodan_podinfo_6.4.1.html
-			// |   |-- sbom-viewer-zarf-component-test-component-1.html
-			// |   |-- sbom-viewer-zarf-component-test-component-2.html
 			// |   |-- zarf-component-test-component-1.json
 			// |   `-- zarf-component-test-component-2.json
 			// `-- zarf.yaml
@@ -491,10 +487,6 @@ func TestPackageTarballDirectoryStructure(t *testing.T) {
 			wantFiles := []string{
 				"ghcr.io_stefanprodan_podinfo_6.4.0.json",
 				"ghcr.io_stefanprodan_podinfo_6.4.1.json",
-				"sbom-viewer-ghcr.io_stefanprodan_podinfo_6.4.0.html",
-				"sbom-viewer-ghcr.io_stefanprodan_podinfo_6.4.1.html",
-				"sbom-viewer-zarf-component-test-component-1.html",
-				"sbom-viewer-zarf-component-test-component-2.html",
 				"zarf-component-test-component-1.json",
 				"zarf-component-test-component-2.json",
 			}
```

---

### Incident Patch 10: `221c4f6c` (2026-09-16)
**Commit Message**: fix(values): infer integer and unknown schema types (#5334)

Signed-off-by: Gabe Scarberry <gabe@defenseunicorns.com>

**File**: `src/pkg/value/generate.go` (modified, +17/-5)
```diff
@@ -3,9 +3,7 @@
 
 package value
 
-import (
-	"fmt"
-)
+import "fmt"
 
 // GenerateJSONSchema infers a JSON schema from the structure and scalar types in values.
 func GenerateJSONSchema(vals Values) map[string]any {
@@ -31,14 +29,20 @@ func ReconcileJSONSchema(existing, inferred map[string]any, deleteNotFound bool)
 	typeVal, hasType := inferred["type"]
 	if hasType {
 		existing["type"] = typeVal
+	} else if deleteNotFound {
+		delete(existing, "type")
 	}
 
 	if schemaTypeIncludes(typeVal, "object") {
 		reconcileSchemaProperties(existing, inferred, deleteNotFound)
+	} else if deleteNotFound {
+		delete(existing, "properties")
 	}
 
 	if schemaTypeIncludes(typeVal, "array") {
 		reconcileSchemaItems(existing, inferred, deleteNotFound)
+	} else if deleteNotFound {
+		delete(existing, "items")
 	}
 
 	if schemaURI, ok := inferred["$schema"]; ok {
@@ -343,6 +347,9 @@ func isChartSchemaKeyword(key string) bool {
 func reconcileSchemaProperties(existing, inferred map[string]any, deleteNotFound bool) {
 	inferredProps, ok := inferred["properties"].(map[string]any)
 	if !ok {
+		if deleteNotFound {
+			delete(existing, "properties")
+		}
 		return
 	}
 
@@ -380,6 +387,9 @@ func reconcileSchemaProperties(existing, inferred map[string]any, deleteNotFound
 func reconcileSchemaItems(existing, inferred map[string]any, deleteNotFound bool) {
 	inferredItems, hasInferredItems := inferred["items"].(map[string]any)
 	if !hasInferredItems {
+		if deleteNotFound {
+			delete(existing, "items")
+		}
 		return
 	}
 
@@ -396,7 +406,9 @@ func inferSchemaType(v any) any {
 	switch val := v.(type) {
 	case string:
 		return map[string]any{"type": "string"}
-	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
+	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
+		return map[string]any{"type": "integer"}
+	case float32, float64:
 		return map[string]any{"type": "number"}
 	case bool:
 		return map[string]any{"type": "boolean"}
@@ -415,6 +427,6 @@ func inferSchemaType(v any) any {
 		}
 		return map[string]any{"type": "array"}
 	default:
-		return map[string]any{"type": "string"}
+		return map[string]any{}
 	}
 }
```

**File**: `src/pkg/value/generate_test.go` (modified, +100/-6)
```diff
@@ -13,10 +13,13 @@ import (
 func TestGenerateJSONSchema(t *testing.T) {
 	t.Run("infers nested types", func(t *testing.T) {
 		vals := Values{
-			"name":     "zarf",
-			"replicas": uint64(3),
-			"enabled":  true,
-			"ports":    []any{uint64(80)},
+			"name":        "zarf",
+			"replicas":    uint64(3),
+			"threshold":   0.75,
+			"percentage":  5.0,
+			"enabled":     true,
+			"ports":       []any{uint64(80)},
+			"annotations": nil,
 			"image": map[string]any{
 				"tag": "v1.2.3",
 			},
@@ -36,7 +39,15 @@ func TestGenerateJSONSchema(t *testing.T) {
 
 		replicas, ok := props["replicas"].(map[string]any)
 		require.True(t, ok)
-		assert.Equal(t, "number", replicas["type"])
+		assert.Equal(t, "integer", replicas["type"])
+
+		threshold, ok := props["threshold"].(map[string]any)
+		require.True(t, ok)
+		assert.Equal(t, "number", threshold["type"])
+
+		percentage, ok := props["percentage"].(map[string]any)
+		require.True(t, ok)
+		assert.Equal(t, "number", percentage["type"])
 
 		enabled, ok := props["enabled"].(map[string]any)
 		require.True(t, ok)
@@ -47,7 +58,11 @@ func TestGenerateJSONSchema(t *testing.T) {
 		assert.Equal(t, "array", ports["type"])
 		items, ok := ports["items"].(map[string]any)
 		require.True(t, ok)
-		assert.Equal(t, "number", items["type"])
+		assert.Equal(t, "integer", items["type"])
+
+		annotations, ok := props["annotations"].(map[string]any)
+		require.True(t, ok)
+		assert.Empty(t, annotations)
 
 		image, ok := props["image"].(map[string]any)
 		require.True(t, ok)
@@ -60,6 +75,85 @@ func TestGenerateJSONSchema(t *testing.T) {
 	})
 }
 
+func TestReconcileJSONSchemaUnknownType(t *testing.T) {
+	existing := map[string]any{
+		"type":        "object",
+		"description": "preserve this",
+		"properties":  map[string]any{"name": map[string]any{"type": "string"}},
+		"items":       map[string]any{"type": "string"},
+	}
+
+	preserved := ReconcileJSONSchema(existing, map[string]any{}, false)
+	assert.Equal(t, existing, preserved)
+
+	pruned := ReconcileJSONSchema(existing, map[string]any{}, true)
+	assert.Equal(t, map[string]any{"description": "preserve this"}, pruned)
+}
+
+func TestReconcileJSONSchemaPrunesStaleStructure(t *testing.T) {
+	tests := []struct {
+		name     string
+		existing map[string]any
+		inferred map[string]any
+	}{
+		{
+			name: "object to array",
+			existing: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{"name": map[string]any{"type": "string"}},
+			},
+			inferred: map[string]any{
+				"type":  "array",
+				"items": map[string]any{"type": "integer"},
+			},
+		},
+		{
+			name: "array to object",
+			existing: map[string]any{
+				"type":  "array",
+				"items": map[string]any{"type": "string"},
+			},
+			inferred: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{"enabled": map[string]any{"type": "boolean"}},
+			},
+		},
+		{
+			name: "empty object",
+			existing: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{"name": map[string]any{"type": "string"}},
+			},
+			inferred: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{},
+			},
+		},
+		{
+			name: "object without properties",
+			existing: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{"name": map[string]any{"type": "string"}},
+			},
+			inferred: map[string]any{"type": "object"},
+		},
+		{
+			name: "empty array",
+			existing: map[string]any{
+				"type":  "array",
+				"items": map[string]any{"type": "string"},
+			},
+			inferred: map[string]any{"type": "array"},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			assert.Equal(t, tc.inferred, ReconcileJSONSchema(tc.existing, tc.inferred, true))
+		})
+	}
+}
+
 func TestMergeJSONSchemaAtPathPreservesNullableObjects(t *testing.T) {
 	schema := GenerateJSONSchema(Values{
 		"serviceAccount": map[string]any{
```

**File**: `src/test/e2e/14_zarf_package_generate_test.go` (modified, +5/-2)
```diff
@@ -71,7 +71,6 @@ func TestZarfDevGenerate(t *testing.T) {
 
 		aReplicas, ok := appProps["replicas"].(map[string]any)
 		require.True(t, ok)
-		// .app.replicas should take the type 'number' from the parent values.yaml
 		require.Equal(t, "number", aReplicas["type"])
 		// .app.replicas should take the description from the parent values.schema.json
 		require.Equal(t, "Replica count", aReplicas["description"])
@@ -90,7 +89,6 @@ func TestZarfDevGenerate(t *testing.T) {
 
 		bReplicas, ok := backendProps["replicaCount"].(map[string]any)
 		require.True(t, ok)
-		// .backend.replicas should take the type 'number' from the child values.yaml
 		require.Equal(t, "number", bReplicas["type"])
 		// .backend.replicas should take the description from the child values.schema.json
 		require.Equal(t, "Replica count", bReplicas["description"])
@@ -128,6 +126,11 @@ func TestZarfDevGenerate(t *testing.T) {
 			require.Equal(t, "string", additionalProperties["type"])
 		}
 
+		fallback, ok := props["fallback"].(map[string]any)
+		require.True(t, ok)
+		require.NotContains(t, fallback, "type")
+		require.Equal(t, "Value without an inferred type", fallback["description"])
+
 		// .backend.image should be dropped because it is excluded from the chart mapping.
 		_, hasExcludedImage := backendProps["image"]
 		require.False(t, hasExcludedImage)
```

**File**: `src/test/packages/14-generate-schema/chart/values.yaml` (modified, +2/-0)
```diff
@@ -8,3 +8,5 @@ image:
 configMap:
   annotations:
   labels:
+
+fallback:
```

**File**: `src/test/packages/14-generate-schema/values.schema.json` (modified, +5/-1)
```diff
@@ -16,9 +16,13 @@
         }
       }
     },
+    "fallback": {
+      "type": "string",
+      "description": "Value without an inferred type"
+    },
     "oldField": {
       "type": "string",
       "description": "Should be removed"
     }
   }
-}
\ No newline at end of file
+}
```

#### Recent Merged Pull Requests:
- **PR #5420** (2026-09-29): chore(deps-dev): bump undici from 7.29.0 to 7.30.0 in /site (@dependabot[bot])
- **PR #5417** (2026-09-29): feat!: disable artifact server by default (@AustinAbro321)
- **PR #5413** (2026-09-30): feat(dev): add --components flag to dev inspect values-files (@dalehenries)
- **PR #5411** (2026-09-29): feat!: migrate SignBlobOptions to a pointer (@brandtkeller)
- **PR #5409** (2026-09-28): docs: remove sbom viewer (@AustinAbro321)
- **PR #5407** (2026-09-28): fix(assemble): cleanup temporary directory on error (@brandtkeller)
- **PR #5406** (2026-09-28): fix(create): run OnSuccess and OnFailure actions during create (@AustinAbro321)
- **PR #5405** (2026-09-28): chore(deps): bump aws-actions/configure-aws-credentials from 6.2.4 to 6.3.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): chaitanyagiri/munder-difflin

> **Canonical Artifact**: `07_PROJECT_LEARNING/chaitanyagiri-munder-difflin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chaitanyagiri/munder-difflin](https://github.com/chaitanyagiri/munder-difflin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:58:51.478Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chaitanyagiri/munder-difflin`
- **Description**: A local multi-agent harness that works with your existing Claude Code, Codex subscriptions, allows you to run an office of agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8207 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `blog/eleventy.config.js`
```
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import { DateTime } from "luxon";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { readFileSync } from "node:fs";

// The blog is always served under this path on munderdiffl.in. We prefix links
// explicitly (via the `u` filter) instead of Eleventy's pathPrefix, whose HTML
// auto-transform double-applies the prefix when combined with the `url` filter.
// Theme previews override both via env (see package.json preview:* scripts).
const BASE = process.env.BLOG_BASE || "/blog";
const OUT = process.env.BLOG_OUT || "../docs/blog";

// The single media manifest: every hero image, inline figure, and video for
// every post lives in this one file (built by scripts/build-media-manifest.mjs,
// filled in by the image-generation script).
const media = JSON.parse(readFileSync("src/_data/media.json", "utf8"));

export default function (eleventyConfig) {
  // ---- markdown: heading anchors so the TOC + deep links work ----
  const md = markdownIt({ html: true, linkify: true, typographer: true }).use(
    markdownItAnchor,
    {
      permalink: markdownItAnchor.permalink.linkInsideHeader({
        symbol: "#",
        class: "anchor",
        placement: "after",
        ariaHidden: true,
      }),
      level: [2, 3],
      slugify,
    }
  );
  // A markdown table of npm commands is wider than a phone. Left bare it widens
  // the whole document, which drags the sticky masthead off-screen with it.
  // Wrapping every table in its own scroll box keeps the overflow local.
  md.renderer.rules.table_open = () => '<div class="table-scroll">\n<table>\n';
  md.renderer.rules.table_close = () => '</table>\n</div>\n';

  eleventyConfig.setLibrary("md", md);

  // ---- plugins ----
  eleventyConfig.addPlugin(syntaxHighlight);

  // ---- passthrough static assets ----
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // ---- collections ----
  // All published posts, newest first.
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter((p) => !p.data.draft)
      .sort((a, b) => b.date - a.date)
  );

  // Pinned pillar guides (`pinned: true`), in `pinOrder`. They sit above the
  // newest post on the index and first on their topic page, so a fast publishing
  // pace never pushes the reference guides off the top.
  const pinRank = (p) => (p.data.pinned ? (p.data.pinOrder ?? 99) : 1e9);
  eleventyConfig.addCollection("pinned", (api) =>
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter((p) => !p.data.draft && p.data.pinned)
      .sort((a, b) => pinRank(a) - pinRank(b) || b.date - a.date)
  );

  // Everything else, newest first: the index features the first of these.
  eleventyConfig.addCollection("unpinned", (api) =>
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter((p) => !p.data.draft && !p.data.pinned)
      .sort((a, b) => b.date - a.date)
  );

  // Featured posts for the blog home hero, newest first. Opt a post in with
  // `featured: true` in its frontmatter; the newest one leads the hero.
  eleventyConfig.addCollection("featured", (api) =>
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter((p) => !p.data.draft && p.data.featured)
      .sort((a, b) => b.date - a.date)
  );

  // Topic clusters (categories) — derived from each post's `category` field.
  eleventyConfig.addCollection("categories", (api) => {
    const map = {};
    for (const post of api.getFilteredByGlob("src/posts/*.md")) {
      if (post.data.draft) continue;
      const cat = post.data.category;
      if (!cat) continue;
      (map[cat] ||= []).push(post);
    }
    return Object.entries(map)
      .map(([name, posts]) => ({
        name,
        slug: slugify(name),
        posts: posts.sort((a, b) => pinRank(a) - pinRank(b) || b.date - a.date),
      }))
      .sort((a, b) => b.posts.length - a.posts.length);
  });

  // Flat tag list with counts.
  eleventyConfig.addCollection("tagList", (api) => {
    const counts = {};
    for (const post of api.getFilteredByGlob("src/posts/*.md")) {
      if (post.data.draft) continue;
      for (const tag of post.data.tags || []) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, slug: slugify(name), count }))
      .sort((a, b) => b.count - a.count);
  });

  // ---- filters ----
  eleventyConfig.addFilter("slug", slugify);

  // Root-relative URL with the /blog base. Leaves absolute URLs untouched.
  eleventyConfig.addFilter("u", (p) => {
    if (p === undefined || p === null || p === "") return BASE + "/";
    if (/^https?:\/\//.test(String(p))) return p;
    const path = String(p).startsWith("/") ? p : "/" + p;
    return (BASE + path).replace(/([^:])\/{2,}/g, "$1/");
  });

  eleventyConfig.addFilter("readableDate", (d, zone = "utc") =>
    DateTime.fromJSDate(d, { zone }).toFormat("LLL d, yyyy")
  );
  eleventyConfig.addFilter("isoDate", (d) =>
    DateTime.fromJSDate(d, { zone: "utc" }).toISO()
  );
  eleventyConfig.addFilter("htmlDate", (d) =>
    DateTime.fromJSDate(d, { zone: "utc" }).toFormat("yyyy-LL-dd")
  );
  // Newest publish or update date across posts. The sitemap uses it for the
  // home page lastmod so a rebuild on a later day does not change the file.
  eleventyConfig.addFilter("newestPostDate", (posts) =>
    (posts || []).reduce((max, p) => {
      const d = new Date(p.data.updated || p.date);
      return d > max ? d : max;
    }, new Date(0))
  );

  // Reading time from rendered HTML / raw content (~225 wpm).
  eleventyConfig.addFilter("readingTime", (content) => {
    const text = String(content || "").replace(/<[^>]+>/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 225));
  });

  eleventyConfig.addFilter("absoluteUrl", (path, base) => {
    try {
      return new URL(path, base).toString();
    } catch {
      return path;
    }
  });

  // Related posts: same category, excluding self, newest first.
  eleventyConfig.addFilter("relatedPosts", (collection, url, category, limit = 3) =>
    (collection || [])
      .filter((p) => p.url !== url && p.data.category === category)
      .sort((a, b) => b.date - a.date)
      .slice(0, limit)
  );

  // Build a table of contents from rendered post HTML (h2 + h3).
  eleventyConfig.addFilter("toc", (html) => {
    const items = [];
    const re = /<h([23])[^>]*\bid="([^"]+)"[^>]*>(.*?)<\/h\1>/gis;
    let m;
    while ((m = re.exec(String(html || "")))) {
      const level = Number(m[1]);
      const id = m[2];
      // strip the appended anchor link + any inline tags
      const text = m[3]
        .replace(/<a class="anchor"[\s\S]*?<\/a>/gi, "")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (text) items.push({ level, id, text });
    }
    return items;
  });

  eleventyConfig.addFilter("byTag", (posts, tag) =>
    (posts || []).filter((p) => (p.data.tags || []).includes(tag))
  );

  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("excludeSelf", (arr, url) =>
    (arr || []).filter((p) => p.url !== url)
  );

  // ---- media: figures + video, all driven by src/_data/media.json ----

  // Render one manifest entry (hero or inline slot) as a <figure>. Until the
  // generation script flips status to "ready", we render a designed placeholder
  // tinted by the post's topic — never a broken <img>.
  const renderFigure = (entry, category, extraClass = "", caption = "") => {
    if (!entry) return "";
    const cat = slugify(category || "notes");
    const cap = caption ? `<figcaption>${caption}</figcaption>` : "";
    if (entry.status === "ready") {
      return `<figure class="fig ${extraClass}"><img src="${BASE}/${entry.file}" alt="${(
        entry.alt || ""
      ).replace(/"/g, "&quot;")}" loading="lazy" decoding="async" />${cap}</figure>`;
  
```

### Core Architecture Module: `blog/media-src/scene-lib.js`
```
// Scene library for the blog's hand-drawn hero illustrations.
// Style contract (see .claude/skills/ian-xiaohei-illustrations/SKILL.md local
// overrides): 1600x900, pure white, thin wobbly ink lines, yellow #FFCA54
// Xiaohei with black dot eyes, sparse orange/blue/amber English annotations,
// one concept per image, never red.
//
// Rendered by render.html; re-render any hero by opening
// render.html?slug=<post-slug> and screenshotting the 1600x900 viewport.

const INK = "#111";
const YEL = "#FFCA54";
const BLUE = "#4263EB";
const ORANGE = "#F08C00";
const AMBER = "#E8A33D";

// tiny seeded rng for per-slug jitter
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const J = (r, n) => (r() - 0.5) * 2 * n; // jitter ±n

// ---- parts ----
const hei = (x, y, s, { legs = "stand", armL = "down", armR = "down" } = {}) => {
  const rx = 58 * s, ry = 70 * s;
  let out = `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${YEL}" stroke="${INK}"/>`;
  out += `<circle cx="${x - 18 * s}" cy="${y - 18 * s}" r="${6 * s}" fill="${INK}" stroke="none"/>`;
  out += `<circle cx="${x + 18 * s}" cy="${y - 18 * s}" r="${6 * s}" fill="${INK}" stroke="none"/>`;
  const ab = y + 10 * s; // arm base height
  const arm = (side, kind) => {
    const d = side === "L" ? -1 : 1, bx = x + d * rx * 0.92;
    if (kind === "none") return "";
    if (kind === "down") return `<path d="M${bx} ${ab} C ${bx + d * 18 * s} ${ab + 30 * s}, ${bx + d * 24 * s} ${ab + 52 * s}, ${bx + d * 26 * s} ${ab + 66 * s}"/>`;
    if (kind === "out") return `<path d="M${bx} ${ab} C ${bx + d * 40 * s} ${ab - 6 * s}, ${bx + d * 66 * s} ${ab - 10 * s}, ${bx + d * 86 * s} ${ab - 8 * s}"/>`;
    if (kind === "up") return `<path d="M${bx} ${ab} C ${bx + d * 34 * s} ${ab - 34 * s}, ${bx + d * 50 * s} ${ab - 62 * s}, ${bx + d * 56 * s} ${ab - 84 * s}"/>`;
    return "";
  };
  out += arm("L", armL) + arm("R", armR);
  const lb = y + ry - 6 * s; // leg base
  if (legs === "stand") {
    out += `<path d="M${x - 15 * s} ${lb} L${x - 17 * s} ${lb + 56 * s} M${x - 17 * s} ${lb + 56 * s} l${-14 * s} ${4 * s}"/>`;
    out += `<path d="M${x + 15 * s} ${lb} L${x + 17 * s} ${lb + 56 * s} M${x + 17 * s} ${lb + 56 * s} l${14 * s} ${4 * s}"/>`;
  } else if (legs === "walk") {
    out += `<path d="M${x - 13 * s} ${lb} L${x - 30 * s} ${lb + 52 * s} M${x - 30 * s} ${lb + 52 * s} l${-14 * s} ${4 * s}"/>`;
    out += `<path d="M${x + 13 * s} ${lb} L${x + 32 * s} ${lb + 50 * s} M${x + 32 * s} ${lb + 50 * s} l${14 * s} ${2 * s}"/>`;
  }
  return out;
};

const desk = (x, y, w) => `<path d="M${x} ${y} h${w}"/><path d="M${x + w * 0.1} ${y} v${86} M${x + w * 0.9} ${y} v${86}"/>`;
const terminal = (x, y, w, h) => {
  const lines = [[0.14, 0.55], [0.14, 0.8], [0.14, 0.4]].map((l, i) =>
    `<path d="M${x + w * l[0]} ${y + h * (0.45 + i * 0.2)} h${w * l[1]}"/>`).join("");
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><path d="M${x} ${y + h * 0.22} h${w}"/>` +
    `<circle cx="${x + 16}" cy="${y + h * 0.11}" r="4"/><circle cx="${x + 32}" cy="${y + h * 0.11}" r="4"/><circle cx="${x + 48}" cy="${y + h * 0.11}" r="4"/>` + lines;
};
const sticky = (x, y, s, rot = 0) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" transform="rotate(${rot} ${x + s / 2} ${y + s / 2})"/>`;
const envelope = (x, y, w, rot = 0) => {
  const h = w * 0.66;
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/><path d="M${x} ${y + 4} L${x + w / 2} ${y + h * 0.55} L${x + w} ${y + 4}"/></g>`;
};
const clock = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x} ${y} L${x} ${y - r * 0.66} M${x} ${y} L${x + r * 0.5} ${y}"/><path d="M${x} ${y - r} v-10 M${x} ${y + r} v10 M${x - r} ${y} h-10 M${x + r} ${y} h10"/>`;
const moonzzz = (x, y) => `<path d="M${x} ${y} a44 44 0 1 0 34 72 a36 36 0 0 1 -34 -72 z"/>` +
  `<text x="${x + 74}" y="${y + 4}" font-size="42" fill="${INK}" stroke="none" font-family="Caveat">z</text><text x="${x + 104}" y="${y - 20}" font-size="34" fill="${INK}" stroke="none" font-family="Caveat">z</text><text x="${x + 128}" y="${y - 40}" font-size="26" fill="${INK}" stroke="none" font-family="Caveat">z</text>`;
const shield = (x, y, s) => `<path d="M${x} ${y - 60 * s} c ${30 * s} ${14 * s} ${52 * s} ${14 * s} ${64 * s} ${8 * s} v ${64 * s} c 0 ${44 * s} ${-24 * s} ${64 * s} ${-64 * s} ${82 * s} c ${-40 * s} ${-18 * s} ${-64 * s} ${-38 * s} ${-64 * s} ${-82 * s} v ${-64 * s} c ${12 * s} ${6 * s} ${34 * s} ${6 * s} ${64 * s} ${-8 * s} z"/><path d="M${x - 20 * s} ${y + 4 * s} l ${14 * s} ${16 * s} l ${28 * s} ${-34 * s}" stroke-width="4"/>`;
const book = (x, y, w) => {
  const h = w * 0.62;
  return `<path d="M${x} ${y} C ${x + w * 0.22} ${y - h * 0.14}, ${x + w * 0.42} ${y - h * 0.14}, ${x + w * 0.5} ${y} C ${x + w * 0.58} ${y - h * 0.14}, ${x + w * 0.78} ${y - h * 0.14}, ${x + w} ${y} V ${y + h} C ${x + w * 0.78} ${y + h * 0.88}, ${x + w * 0.58} ${y + h * 0.88}, ${x + w * 0.5} ${y + h} C ${x + w * 0.42} ${y + h * 0.88}, ${x + w * 0.22} ${y + h * 0.88}, ${x} ${y + h} Z M${x + w * 0.5} ${y} V ${y + h}"/>` +
    [0.22, 0.42, 0.62].map(t => `<path d="M${x + w * 0.08} ${y + h * t} h${w * 0.3} M${x + w * 0.62} ${y + h * t} h${w * 0.3}"/>`).join("");
};
const coins = (x, y, n) => Array.from({ length: n }, (_, i) => `<ellipse cx="${x}" cy="${y - i * 16}" rx="34" ry="10"/>`).join("");
const bell = (x, y, s) => `<path d="M${x - 40 * s} ${y} c 0 ${-36 * s} ${22 * s} ${-52 * s} ${40 * s} ${-52 * s} c ${18 * s} 0 ${40 * s} ${16 * s} ${40 * s} ${52 * s} z"/><circle cx="${x}" cy="${y + 12 * s}" r="${5 * s}"/>`;
const bolt = (x, y, s) => `<path d="M${x} ${y} l${-16 * s} ${30 * s} h${12 * s} l${-14 * s} ${30 * s} l${34 * s} ${-38 * s} h${-14 * s} l${18 * s} ${-22 * s} z"/>`;
const magnifier = (x, y, s) => `<circle cx="${x}" cy="${y}" r="${26 * s}"/><path d="M${x + 19 * s} ${y + 19 * s} l${26 * s} ${26 * s}" stroke-width="4"/>`;
const bubble = (x, y, w, h, dir = 1) => `<path d="M${x} ${y} h${w} v${h} h${-(w * 0.55)} l${-18 * dir} 22 v-22 h${-(w * 0.45 - 18)} z"/>`;
const box = (x, y, w, h, label) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>` + (label ? `<path d="M${x + w * 0.16} ${y + h * 0.4} h${w * 0.68} M${x + w * 0.16} ${y + h * 0.62} h${w * 0.45}"/>` : "");
const flag = (x, y, s) => `<path d="M${x} ${y} v${-70 * s}"/><path d="M${x} ${y - 70 * s} h${46 * s} l${-12 * s} ${14 * s} l${12 * s} ${14 * s} h${-46 * s} z"/>`;
let LABELS = "";
const txt = (x, y, str, color, size = 34, anchor = "start") => {
  if (str) LABELS += `<text x="${x}" y="${y}" fill="${color}" stroke="none" font-size="${size}" font-weight="600" text-anchor="${anchor}" font-family="Caveat">${str}</text>`;
  return "";
};
const miniAtDesk = (x, y) => desk(x - 70, y + 30, 230) + terminal(x - 20, y - 56, 140, 86) + hei(x - 76, y - 4, 0.45, { legs: "none", armR: "out", armL: "none" });

// ---- archetypes ----
// Every archetype fn(r, A) → svg string; A = {blue, orange, amber} annotations.
const ARCH = {
  routing(r, A) {
    let s = "";
    s += envelope(180, 470 + J(r, 10), 86) + envelope(205, 405, 86, -6) + envelope(165, 350, 86, 4);
    s += `<path d="M300 480 C 380 490, 430 500, 500 520" marker-end="url(#ah)"/>`;
    s += desk(520, 600, 460);
    s += box(575, 560, 85, 38) + box(720, 560, 85, 38) + box(855, 560, 85, 38);
    s += hei(700, 445, 1, { legs: "none", armL: "down", armR: "out" });
    s += envelope(830, 495, 54, 8);
    s += `<path d="M955 545 C 1080 500, 1160 430, 1255 380" marker-end="url(#ah)"/>`;
    s += `<path d="M955 578 C 1100 575, 1200 570, 1295 565" marker-end="url(#ah)"/>`;
    s += `<path d="M955 605 C 1080 660, 1160 710, 1245 755" marker-end="url(#ah)"/>`;
    s += miniAtDesk(1370, 345) ;
    s += box(1330, 540, 70, 40, true
```

### Core Architecture Module: `blog/scripts/add-inline-notes.mjs`
```
// Give every post 2 inline sketch figures ("notes") between sections, and
// register every {% img %} slot in the media manifest.
//
// - Posts that already contain {% img "note-… %} shortcodes (hand-placed, with
//   captions) are left untouched textually.
// - All other posts get `{% img "note-1" %}` and `{% img "note-2" %}` inserted
//   at roughly 1/3 and 2/3 of their H2 sections (outside code fences).
// - Then every slot referenced by any post gets an inline entry in
//   src/_data/media.json (existing entries are preserved).
//
// The sketches themselves are drawn by media-src/scene-lib.js buildNote() and
// rendered via render.html?slug=<slug>&note=<n>. Run this, render, then build.
//
// Usage: node scripts/add-inline-notes.mjs   (cwd = blog/)
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const POSTS_DIR = "src/posts";
const MANIFEST = "src/_data/media.json";

const media = JSON.parse(await readFile(MANIFEST, "utf8"));
const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md")).sort();

let injected = 0, slotsAdded = 0;

for (const file of files) {
  const slug = path.basename(file, ".md");
  const p = path.join(POSTS_DIR, file);
  let text = await readFile(p, "utf8");

  if (!/\{%\s*img\s+"note-/.test(text)) {
    // find H2 lines outside code fences, after frontmatter
    const lines = text.split("\n");
    let inFence = false;
    const h2 = [];
    let fmEnd = 0, dashes = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i]) && dashes < 2) { dashes++; if (dashes === 2) fmEnd = i; continue; }
      if (/^```/.test(lines[i])) { inFence = !inFence; continue; }
      if (!inFence && /^## /.test(lines[i]) && i > fmEnd) h2.push(i);
    }
    if (h2.length >= 2) {
      const p1 = Math.max(1, Math.floor(h2.length / 3));
      let p2 = Math.min(h2.length - 1, Math.floor((2 * h2.length) / 3));
      if (p2 <= p1) p2 = p1 + 1 <= h2.length - 1 ? p1 + 1 : -1;
      const inserts = [[h2[p1], 1]];
      if (p2 > 0) inserts.push([h2[p2], 2]);
      // insert bottom-up so line numbers stay valid
      for (const [line, n] of inserts.reverse()) {
        lines.splice(line, 0, `{% img "note-${n}" %}`, "");
      }
      text = lines.join("\n");
      await writeFile(p, text);
      injected++;
    }
  }

  // register every referenced slot in the manifest
  const entry = media[slug];
  if (!entry) continue;
  entry.inline = entry.inline || {};
  for (const m of text.matchAll(/\{%\s*img\s+"([\w-]+)"/g)) {
    const slot = m[1];
    if (entry.inline[slot]) continue;
    entry.inline[slot] = {
      file: `assets/media/${slug}/${slot}.png`,
      alt: `Hand-drawn sketch from “${entry.title}”`,
      prompt: "",
      status: "ready",
    };
    slotsAdded++;
  }
}

await writeFile(MANIFEST, JSON.stringify(media, null, 2) + "\n");
console.log(`[notes] injected shortcodes into ${injected} posts, added ${slotsAdded} inline slots to ${MANIFEST}`);

```

### Core Architecture Module: `blog/scripts/generate-images.mjs`
```
// Generate blog images from src/_data/media.json via the OpenAI Images API.
//
// The manifest is the single source of truth: every hero and inline slot has a
// prompt and a status. This script renders each pending ("placeholder") entry
// with gpt-image-2, writes the PNG to the entry's `file` path under src/, and
// flips status to "ready". media.json is rewritten after EVERY image, so a
// crash, quota error, or Ctrl-C loses nothing — rerun and it resumes.
//
// Usage (cwd = blog/):
//   OPENAI_API_KEY=sk-... node scripts/generate-images.mjs --posts slug-a,slug-b
//   OPENAI_API_KEY=sk-... node scripts/generate-images.mjs --all
//
// Flags:
//   --posts <a,b,c>    only these post slugs
//   --all              every post still pending
//   --quality <q>      high | medium | low        (default: high)
//   --inline           also render inline slots   (default: heroes only)
//   --dry-run          print prompts + cost estimate, no API calls, no writes
//   --force            regenerate entries already "ready"
//   --max-cost <usd>   abort if the pre-run estimate exceeds this (default: 25)
//   --suffix <s>       write files as <name>-<s>.png and DON'T flip status —
//                      for side-by-side quality comparisons (e.g. --suffix medium)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST = "src/_data/media.json";
const MODEL = "gpt-image-2";
const SIZE = "1536x1024"; // 16:9-ish landscape; matches the blog's aspect
// Published per-image landscape pricing (see plan): used for estimates + caps.
const PRICE = { low: 0.005, medium: 0.041, high: 0.165 };

// ---- args ----
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : dflt;
};
const POSTS = opt("posts", "") ? opt("posts", "").split(",").map((s) => s.trim()).filter(Boolean) : null;
const ALL = flag("all");
const QUALITY = opt("quality", "high");
const INLINE = flag("inline");
const DRY = flag("dry-run");
const FORCE = flag("force");
const MAX_COST = Number(opt("max-cost", "25"));
const SUFFIX = opt("suffix", "");

if (!POSTS && !ALL) {
  console.error("Pick a scope: --posts slug-a,slug-b   or   --all   (add --dry-run to preview)");
  process.exit(1);
}
if (!PRICE[QUALITY]) {
  console.error(`--quality must be one of: ${Object.keys(PRICE).join(" | ")}`);
  process.exit(1);
}

// ---- collect work ----
const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const style = manifest._style || "";
const jobs = [];
for (const [slug, post] of Object.entries(manifest)) {
  if (slug.startsWith("_")) continue;
  if (POSTS && !POSTS.includes(slug)) continue;
  const slots = { hero: post.hero, ...(INLINE ? post.inline : {}) };
  for (const [name, entry] of Object.entries(slots)) {
    if (!entry || !entry.prompt) continue;
    if (entry.status === "ready" && !FORCE && !SUFFIX) continue;
    jobs.push({ slug, name, entry });
  }
}
if (POSTS) {
  for (const p of POSTS) if (!manifest[p]) console.warn(`[warn] no manifest entry for slug: ${p}`);
}
if (!jobs.length) {
  console.log("Nothing to generate — all selected entries are already ready (use --force to redo).");
  process.exit(0);
}

const estimate = jobs.length * PRICE[QUALITY];
console.log(`Model ${MODEL} · ${SIZE} · quality=${QUALITY}${SUFFIX ? ` · suffix=-${SUFFIX}` : ""}`);
console.log(`${jobs.length} image(s) → estimated ~$${estimate.toFixed(2)}\n`);
if (estimate > MAX_COST) {
  console.error(`Estimate $${estimate.toFixed(2)} exceeds --max-cost ${MAX_COST}. Aborting before any API call.`);
  process.exit(1);
}

if (DRY) {
  for (const j of jobs) {
    console.log(`--- ${j.slug} / ${j.name} → ${j.entry.file}`);
    console.log(`${style}\n${j.entry.prompt}\n`);
  }
  console.log(`[dry-run] ${jobs.length} image(s), ~$${estimate.toFixed(2)}, no API calls made.`);
  process.exit(0);
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("OPENAI_API_KEY is not set. Export it and rerun:\n  OPENAI_API_KEY=sk-... node scripts/generate-images.mjs ...");
  process.exit(1);
}

// ---- generate ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(prompt) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }),
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) return Buffer.from(b64, "base64");
      // some responses return a URL instead of b64
      const url = data?.data?.[0]?.url;
      if (url) return Buffer.from(await (await fetch(url)).arrayBuffer());
      throw new Error("response had neither b64_json nor url");
    }
    const body = await res.text();
    // unsupported size for this model → let the API tell us, don't guess again
    if (res.status === 400 && /size/i.test(body)) {
      throw new Error(`API rejected size ${SIZE}: ${body.slice(0, 300)}`);
    }
    lastErr = new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    if (res.status === 429 || res.status >= 500) {
      const wait = attempt * 15_000;
      console.warn(`  retry ${attempt}/3 in ${wait / 1000}s (${res.status})`);
      await sleep(wait);
      continue;
    }
    throw lastErr;
  }
  throw lastErr;
}

let done = 0, failed = 0;
for (const j of jobs) {
  const outRel = SUFFIX ? j.entry.file.replace(/\.png$/, `-${SUFFIX}.png`) : j.entry.file;
  const outPath = path.join("src", outRel);
  process.stdout.write(`[${done + failed + 1}/${jobs.length}] ${j.slug}/${j.name} → ${outPath} ... `);
  try {
    const png = await generate(`${style}\n\n${j.entry.prompt}`);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, png);
    if (!SUFFIX) {
      j.entry.status = "ready";
      await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n"); // save after EVERY image
    }
    done++;
    console.log("ok");
  } catch (err) {
    failed++;
    console.log(`FAILED: ${err.message}`);
  }
  await sleep(2000);
}

console.log(`\n${done} generated, ${failed} failed · actual spend ≈ $${(done * PRICE[QUALITY]).toFixed(2)}`);
if (failed) {
  console.log("Failed entries are still 'placeholder' — rerun the same command to retry just those.");
  process.exit(1);
}

```

### Core Architecture Module: `blog/src/_data/site.js`
```
// Global site config — single source of truth for SEO defaults.
// Kevin's SEO_METADATA.md flows in here (site-level) and into each post's
// frontmatter (per-page). Keep absolute origin in one place.
export default {
  name: "Munder Difflin",
  blogName: "Munder Difflin Blog",
  // Origin with no trailing slash; pathPrefix (/blog/) is applied by Eleventy.
  origin: "https://munderdiffl.in",
  baseUrl: "https://munderdiffl.in/blog/",
  // Blog-index description (Kevin's SEO_METADATA.md §3.9).
  description:
    "Guides, deep dives, and comparisons on running multi-agent Claude Code: orchestration, agent memory, automation, and the tooling landscape.",
  tagline: "Notes from the office floor.",
  lang: "en",
  locale: "en_US",
  author: {
    name: "Chaitanya Giri",
    twitter: "",
    url: "https://munderdiffl.in",
  },
  // Home-page pillar anchors blog posts link UP to (SEO_METADATA.md §5.7).
  pillars: {
    what: "https://munderdiffl.in/#what",
    how: "https://munderdiffl.in/#how",
    why: "https://munderdiffl.in/#why",
    install: "https://munderdiffl.in/#install",
    claude: "https://munderdiffl.in/#claude",
    opensource: "https://munderdiffl.in/#opensource",
  },
  social: {
    github: "https://github.com/chaitanyagiri/munder-difflin",
    site: "https://munderdiffl.in",
  },
  // Default OG image (absolute). Per-post `ogImage` overrides this.
  defaultOgImage: "https://munderdiffl.in/media/og.png",
  themeColor: "#F5F2E8",
  // Topic clusters (categories), aligned to Kevin's keyword taxonomy + the
  // technical/non-technical split in BLOG_IDEAS.md. A post's `category` field
  // picks one of these; the index/topics pages derive the live list from posts.
  clusters: [
    { key: "guides", label: "Guides", kind: "technical" },
    { key: "orchestration", label: "Orchestration", kind: "technical" },
    { key: "memory", label: "Memory", kind: "technical" },
    { key: "internals", label: "Internals", kind: "technical" },
    { key: "concepts", label: "Concepts", kind: "non-technical" },
    { key: "comparisons", label: "Comparisons", kind: "non-technical" },
    { key: "use-cases", label: "Use Cases", kind: "non-technical" },
    { key: "story", label: "Story", kind: "non-technical" },
  ],
};

```

### Core Architecture Module: `blog/src/_data/theme.js`
```
// Blog theme switch. The blog deliberately has its own identity, separate from
// the marketing site (Reddit feedback: the mono/neo-brutalist skin was hard to
// read as a blog). Two candidates, both built here:
//
//   sunroom — friendly & playful; rounded, candy-gradient accents, humanist
//             sans. Inspired by Josh W. Comeau's blog.
//   press   — bold editorial magazine; display serif headlines, loud per-topic
//             color blocks, drop caps. Inspired by The Verge's 2022 redesign.
//
// Pick with BLOG_THEME=sunroom|press (default sunroom). Preview builds set
// BLOG_PREVIEW=1 which adds <meta name="robots" content="noindex"> so the
// side-by-side previews never compete with the real blog in search.
const KEY = process.env.BLOG_THEME === "sunroom" ? "sunroom" : "press";

const FONTS = {
  sunroom:
    "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700;6..12,800&family=JetBrains+Mono:wght@400;600&display=swap",
  press:
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,900&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap",
};

export default {
  key: KEY,
  fonts: FONTS[KEY],
  css: `/assets/blog-${KEY}.css`,
  preview: process.env.BLOG_PREVIEW === "1",
};

```

### Core Architecture Module: `electron.vite.config.ts`
```
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { readFileSync, copyFileSync, mkdirSync, statSync } from 'node:fs';

// Single source of truth for the displayed app version: package.json.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const define = { __APP_VERSION__: JSON.stringify(pkg.version) };

// Anonymous product analytics (src/main/analytics.ts, contract in TELEMETRY.md).
// The PostHog project key is a PUBLIC write-only token, but it is still injected
// at BUILD time from the environment (release CI sets it from a repo secret)
// rather than committed: local dev builds and forks compile with '' and the
// whole analytics module no-ops for them. Main-process only.
const defineMain = {
  ...define,
  __POSTHOG_KEY__: JSON.stringify(process.env.POSTHOG_KEY ?? ''),
  __POSTHOG_HOST__: JSON.stringify(process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com')
};

// Copy raw .cjs main-process sidecars into out/main after the main bundle is
// written. electron-vite/rollup neither bundles nor copies require()'d .cjs
// sidecars, so without this the boot-time `require('./slack-trigger.cjs')` is
// missing from out/main — which crashed the packaged app (#66) AND `npm run
// dev` (#67). A writeBundle hook runs after the main build in BOTH dev and
// build, so the sidecar is emitted from a single place for every path.
function copyMainSidecars() {
  const ASSETS: Array<[string, string]> = [
    ['src/main/slack-trigger.cjs', 'out/main/slack-trigger.cjs'],
    // Knowledge Graph core: required by knowledge.ts at runtime (pure-JS, no
    // native deps), so it must be emitted next to the main bundle like the
    // Slack sidecar above.
    ['src/main/kg-core.cjs', 'out/main/kg-core.cjs']
  ];
  return {
    name: 'copy-main-cjs-sidecars',
    writeBundle() {
      for (const [fromRel, toRel] of ASSETS) {
        const from = resolve(__dirname, fromRel);
        const to = resolve(__dirname, toRel);
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(from, to);
        const copied = statSync(to);
        if (!copied.isFile() || copied.size === 0) {
          throw new Error(`Failed to copy main-process sidecar: ${fromRel} -> ${toRel}`);
        }
      }
    }
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMainSidecars()],
    define: defineMain,
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define,
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    define,
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@brand': resolve(__dirname, 'docs'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  }
});

```

### Core Architecture Module: `landing-remotion/remotion.config.ts`
```
import { Config } from '@remotion/cli/config';

// Pixel-art: keep edges crisp, no smoothing on scale.
Config.setOverwriteOutput(true);
Config.setVideoImageFormat('png');
// Transparent-friendly + small files for web autoplay loops.
Config.setCodec('vp8');

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #535** (2026-09-25): **Non-Claude (Grok) agents record zero token/cost usage**
  *Symptoms*: ### What happened?  I ran an agent on the Grok provider. The agent worked correctly — it ran turns, called tools, and completed its task. But its token usage and cost never showed up: $0.00 and 0 tokens in the roster.  I could not set any limits on it.  Grok does track the usage — grok usage <sessionId> and the on-disk usage.json both show real numbers (I confirmed $0.5388 for one live session).   Expected: a Grok agent's tokens and USD land in the ledger and roll up into fleet totals, the same as a Claude agent.      ### Steps to reproduce   1. Launch MD.  2. Add an agent configured on the Grok provider   3. Give it any task that runs at least one full turn so Grok writes usage.  4. Let the turn finish.  5. Open the fleet view / cost totals for that agent → shows $0.00, 0 tokens.  6. Compare: run grok usage <that session id> → real, non-zero usage is present.   ### Screenshot or screen recording  <img width="977" height="288" alt="Image" src="https://github.com/user-attachments/assets/49afbb9b-d9bf-4157-9472-937c78ba7926" />  ### Logs / stack trace  ```shell No crash, no stack trace.  its a silent thing. ```  ### Operating system  macOS (Intel)  ### OS version  12.7.6  ### Munder Difflin version  v0.5.2 (packaged app)  ### Node version  v20.20.2  ### Agent CLI and version (if relevant)  Grok Build CLI (grok-4.6-build)  ### Pre-flight  - [x] I attached a screenshot or recording above. - [x] I'm on the latest release, or I've said above why I can't be. - [x] I re-ran `npm inst

- **Issue #399** (2026-09-06): **HookServer can corrupt split UTF-8 payloads and retain unbounded incomplete frames**
  *Symptoms*: ### What happened?  HookServer currently decodes each socket `data` chunk independently before applying newline framing:  ```ts let buf = '';  conn.on('data', (d) => {   buf += d.toString();   const nl = buf.indexOf('\n');   if (nl === -1) return;   // ... }); ``` - Socket chunk boundaries are byte boundaries, so they can split a multibyte UTF-8 code point. When that happens, decoding each chunk separately can replace an incomplete sequence with U+FFFD.  - The resulting JSON can still parse successfully, which means a valid multilingual hook payload may be silently changed before it reaches the handler.  - The same framing path also has no explicit byte limit for an incomplete request. A local hook peer that keeps sending data without a terminating newline can therefore leave an ever-growing incomplete frame retained by the Electron main process.   - I would expect HookServer to frame requests as bytes, decode UTF-8 only after a complete newline-delimited frame is available, and reject frames that exceed a fixed byte limit.  - This is a local HookServer protocol correctness and resource-boundary issue. I am not treating it as an internet-facing DoS.  - I have opened a focused #400 with the proposed fix and regression coverage. If the approach looks good, please assign this issue to me.  ### Steps to reproduce  1. Check out the current `main` branch and install dependencies. 2. Start HookServer and connect to its local socket. 3. Create a valid newline-delimited JSON payload c

- **Issue #395** (2026-09-06): **Slack "Stop" button doesn't persist slackEnabled: false — bridge silently re-arms after restart, and Settings UI shows stale "ON" state**
  *Symptoms*: ### What happened?  Version: v0.4.6 (bug present on main @ 1e41d0b4, so not fork-specific)  Summary  Clicking Stop in Settings → Connections → Slack tears down the live webhook server, but never persists slackEnabled: false to the on-disk config. Two visible symptoms: 1. Quitting and relaunching the app after an explicit Stop re-arms the Slack bridge automatically on the next boot, even though the user just turned it off. 2. The Settings panel's own ON/OFF toggle for Slack keeps showing "ON" (and the token/secret/channel fields stay open) until the modal is closed and reopened — it never reflects the Stop action just taken.  Where  - src/main/index.ts   ipcMain.handle('slack:stop', () => { stopSlackServer(); return { ok: true }; });   stops the live server object but never writes slackEnabled: false to config. The auto-start-at-boot check further down (if (slackCfg.slackEnabled && slackCfg.slackSigningSecret) { ... }) therefore still sees slackEnabled === true on the next launch and reconnects. - src/renderer/src/components/SettingsModal.tsx   stopSlack() calls window.cth.slackStop() and updates running/slackNote, but never calls setSlackEnabled(false) — the local component state that drives the ON/OFF pill and gates visibility of the token/secret/channel fields. startSlack() does call setSlackEnabled(true) on success, so the asymmetry is visible comparing the two functions side by side.  Steps to reproduce  1. Configure and Start Slack in Settings → Connections. 2. Click Sto

- **Issue #389** (2026-09-06): **Malformed Claude config can be overwritten after a JSON parse failure**
  *Symptoms*: ### What happened?  - `ensureClaudePermissionsAccepted()` currently treats an existing Claude config as an empty object when JSON parsing fails.  - For both `~/.claude/settings.json` and `~/.claude.json`, a parse failure can fall back to `{}`, after which Munder Difflin may add its permission or trust fields and write the result back to the original path. This can replace unrelated user-owned configuration instead of preserving the existing file.  - I can reproduce this deterministically with malformed config fixtures. The expected behavior is to fail closed for that config file, preserve its existing contents, and continue best-effort handling of the other independent Claude config.  - I have opened a focused #390 with the proposed fix and regression coverage. If the approach looks good, please assign this issue to me.  ### Steps to reproduce  1. Start from the current `main` implementation.  2. Create an existing malformed Claude config, for example `~/.claude/settings.json`:     ```json    {      "env": {        "CUSTOM_VALUE": "preserve-me"      }, 3. Run the code path that calls ensureClaudePermissionsAccepted(). 4. Observe that JSON parsing fails and the current implementation falls back to an empty object. 5. Munder Difflin then adds its required permission fields and can write the generated object back to the same config path. 6. Compare the file contents before and after the call. The original malformed contents are no longer preserved. The same behavior also applies

- **Issue #385** (2026-09-06): **Installing skills from the Skills browser often fails with the error**
  *Symptoms*: ### What happened?  ## Bug description  Installing skills from the Skills browser often fails with the error  `that skill is larger than this installer will fetch`  This seems to happen for many skills, including ones that should be relatively small.  From what I can tell, the issue may be related to catalog entries that point to the root of a GitHub repository instead of directly to a specific skill directory.  For example, if a catalog entry points to  `https://github.com/owner/repo`  the installer appears to recursively walk the entire repository. This can easily exceed the current 2 MiB size limit even when the actual skill itself is small.  ## Suspected cause  `parseGitHubSourceUrl()` returns an empty path for repo root URLs.  The installer then calls `walk()` starting from that empty path, which effectively treats the whole repository as the skill.  As a result, the size and file count limits are applied to the entire repository rather than to the individual skill directory.  There also does not seem to be a validation step that confirms the selected source directory contains a `SKILL.md` before recursively downloading it.  ## Proposed fix  For repo root URLs, the installer could first resolve the actual skill directory before downloading anything.  A possible flow would be  1. If the URL already points to a specific directory, use that directory. 2. If the repository root contains `SKILL.md`, treat the repository itself as the skill. 3. Otherwise, try common locations 

- **Issue #379** (2026-09-06): **Unsent text left in an agent's terminal pane silently holds every message queued in the composer below it, with no explanation until the agent goes idle**
  *Symptoms*: ## What happened?  The agent detail panel stacks **two input boxes**: the terminal pane, and the "… is busy — queue a message" composer directly beneath it. Clicking into the terminal and typing anything — even by accident, even a few characters never submitted — registers a draft on that agent's prompt, and **that draft holds delivery of everything queued in the composer below**.  Holding is correct in isolation: automation must not type onto a line the user is writing. The defect is that **the blocker is in a different box from the one the user is typing in, and nothing says so while the agent is busy** — which is exactly when the composer is in use, because a busy agent is the reason to queue a message at all.  `useTerminalBlock` is polled only while `queue.length > 0 && idle` (`MessageQueueComposer.tsx`), so for the whole busy stretch the block reads `null`: no hint, no link, nothing. The status line says *"… is busy — N queued"*. When the agent finally goes idle, a **`recover prompt`** link appears out of nowhere and the hint changes to *"held — …'s terminal has unsent text on its prompt"*. Pressing the link moves the stray characters out of the terminal and into the composer's text box — the behaviour the reporter described and found confusing: letters typed in one box reappearing in another.  The hold lasts `STALE_INPUT_MS` = **30 minutes** (`terminalAutomation.ts`). **Waiting it out is worse than clicking:** when the expiry fires, the drain types *after* whatever is o

- **Issue #378** (2026-09-06): **A stale .git/HEAD.lock stops every hive commit permanently and silently — clearStaleLock() clears only index.lock**
  *Symptoms*: ## What happened?  `HiveManager.commit()` runs on every routed message and is the hive's only history. It is resilient to a stale `index.lock` and to nothing else:  - `clearStaleLock()` (`src/main/hive.ts`) removes **only** `.git/index.lock`. - The retry loop continues only on an `index.lock` error; any other failure falls to the quiet give-up path — *"a non-lock failure — give up quietly, the next mutation retries"*. - A stale `HEAD.lock` is not "the next mutation retries", it is **permanent**: every later commit meets the same file. `commit()` returns `void` and logs nothing on that path, so the hive keeps reporting every message as routed while nothing is being committed.  The recovery path was written for the wrong lock file, and the give-up is silent.  ### What it looked like here  A git process was killed, leaving a 0-byte `HEAD.lock` (and an `objects/maintenance.lock` with the identical mtime). The hive's last commit was the same minute. **17.7 hours later there were 2,150 uncommitted paths and no snapshot or rollback point for the whole period** — with no error anywhere. Recovery was `rm .git/HEAD.lock` and one commit.  Related: #372 documents how easily killed git children happen in this app (force-quit during the startup archive loop leaves orphaned `git add -A` processes) — each one is a chance to leave exactly this lock behind.  ## Steps to reproduce  1. In a hive whose repo is healthy, `touch <hive>/.git/HEAD.lock`. 2. Send any hive message, so `commit()` runs. 3

- **Issue #376** (2026-09-06): **No-progress breaker arm fires on a live human conversation — token generation with no hive-file/tool-span progress is exactly what a healthy conversation looks like**
  *Symptoms*: ## What happened?  The `no-progress` arm of the circuit breaker fires on an agent that is **mid-conversation with a human**, delivering a "Circuit breaker: steer" message into the live conversation. Seven instances across four agents in three days on one installation; the two most recent both landed while the operator was typing.  The arm trips (`src/main/breaker.ts`, the no-progress branch) when all three hold for `NO_PROGRESS_BEATS = 2` consecutive 30s beats:  1. output tokens grew since the previous beat, 2. `!progressing`, 3. no *distinct* `(name+input)` tool call within `PROGRESS_TOOL_WINDOW_MS = 300_000`.  `progressing` is computed in the beat as a coordination-file mtime **or** an OTel tool span, each inside a 300s window. `lastCoordinationAt` (`src/main/index.ts`) is the newest mtime of five paths: `inbox`, `inbox/.done`, `outbox`, `outbox/.sent`, `memory.md`.  **So the breaker's model of "work" is: hive files changed, or tool spans ran. A conversation with a human is neither.** The human's words arrive by typing into the PTY — not a hive file, not a tool call. The agent's answer is prose — not a tool call. And the answer burns output tokens, so condition 1 is satisfied. All three conditions are met by a perfectly healthy conversation.  A corollary that narrows the bug: condition 1 means **the arm cannot fire on a genuinely idle agent**. Every observed fire had live token generation. The question is never "is this agent idle" — it is "is this generation work", and a h

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

### Incident Patch 1: `3012fda6` (2026-09-29)
**Commit Message**: seo-engine: new what-is-opencode (review fixes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/what-is-opencode.md` (modified, +3/-3)
```diff
@@ -35,7 +35,7 @@ The same binary does more than the chat screen. `opencode --help` on our machine
 
 ## Is OpenCode the same as Crush?
 
-No, and the name has belonged to two projects. The Go agent at `opencode-ai/opencode` is archived, and its README says it "has continued under the name Crush, developed by the original author and the Charm team." This page is about the TypeScript agent at opencode.ai, the one `npm install -g opencode-ai` installs. Two coding agents sharing one name for a while is the kind of thing only open source manages.
+No, and the name has belonged to two projects. The Go agent at `opencode-ai/opencode` is archived, and its README says it "has continued under the name Crush, developed by the original author and the Charm team." This page is about the TypeScript agent at opencode.ai, the one `npm install -g opencode-ai` installs. If a guide installs it with `go install github.com/opencode-ai/opencode@latest`, it is describing the older project.
 
 ## How do I install OpenCode?
 
@@ -95,11 +95,11 @@ The tool is free, and the model is what you pay for. How each option bills, chec
 
 ## Can OpenCode use my Claude subscription?
 
-No. The [providers page](https://opencode.ai/docs/providers/) says plugins for Claude Pro and Max exist and "Anthropic explicitly prohibits this", and OpenCode stopped bundling them as of 1.3.0. Claude models still work through an Anthropic API key.
+No. The [providers page](https://opencode.ai/docs/providers/) says plugins for Claude Pro and Max exist and "Anthropic explicitly prohibits this", and OpenCode stopped bundling them as of 1.3.0. Anthropic's [legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance) says third party developers may not route requests through Free, Pro or Max plan credentials. Claude models still work through an Anthropic API key.
 
 ## OpenCode vs Claude Code vs Codex CLI: which should you use?
 
-OpenCode if you want to choose the model, Claude Code if you want Anthropic's own agent, Codex CLI if you already pay for ChatGPT. Each row checked on 29 Sep 2026 against the [Claude Code setup docs](https://code.claude.com/docs/en/setup), the [Codex README](https://github.com/openai/codex) and the OpenCode docs:
+OpenCode if you want to choose the model, Claude Code if you want Anthropic's own agent, Codex CLI if you already pay for ChatGPT. Each row checked on 29 Sep 2026 against the [Claude Code setup docs](https://code.claude.com/docs/en/setup), the [Codex README](https://github.com/openai/codex) and `codex --help` (0.153.4), and the OpenCode docs:
 
 | | OpenCode | Claude Code | Codex CLI |
 | --- | --- | --- | --- |
```

---

### Incident Patch 2: `578e1097` (2026-09-28)
**Commit Message**: seo-engine: refresh claude-code-subagents-vs-multi-agent-harness (review fixes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/claude-code-subagents-vs-multi-agent-harness.md` (modified, +5/-5)
```diff
@@ -16,7 +16,7 @@ faq:
   - q: "What are Claude Code subagents?"
     a: "A subagent is a separate Claude worker that takes one task in its own context window and returns only a summary to your main conversation. You define custom ones as Markdown files in .claude/agents/ or ~/.claude/agents/, and Claude Code also ships built-ins such as Explore, Plan and general-purpose."
   - q: "Can Claude Code subagents spawn subagents?"
-    a: "Yes. Since Claude Code 2.1.219 (24 July 2026) a subagent can spawn its own, up to three layers below the main conversation. Set CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH to change the limit, or to 1 to turn nesting off."
+    a: "Yes. By default a subagent can spawn its own, up to three layers below the main conversation (default since Claude Code 2.1.219, 24 July 2026). Set CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH to change the limit, or to 1 to turn nesting off."
   - q: "How do I choose the model a subagent uses?"
     a: "Set model in its front matter to sonnet, opus, haiku, fable, a full model ID or inherit. Claude can also pass a model when it spawns the subagent, and that wins over the front matter. Run /tasks while it runs to see the model on its row."
   - q: "What is the difference between subagents and agent teams?"
@@ -85,21 +85,21 @@ Use `model` and `tools` in the front matter. The model is resolved in this order
 
 ## Do Claude Code subagents run in the background?
 
-Yes, by default in an interactive session. Since 2.1.232 (13 Aug 2026) fork mode is on, so the subagents Claude spawns run in the background while you keep typing. A background subagent gets a smaller built-in tool set, and its permission prompts appear in your main session with its name on them. `/subtask` starts a fork, which is a subagent that inherits your whole conversation. Up to 20 subagents can run at once; `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` changes that.
+Yes, by default in an interactive session. Background became the default in 2.1.198, so the subagents Claude spawns run while you keep typing. Since 2.1.232 (13 Aug 2026) fork mode is on, so Claude can no longer ask for the foreground. A background subagent gets a smaller built-in tool set, and its permission prompts appear in your main session with its name on them. `/subtask` starts a fork, which is a subagent that inherits your whole conversation. Up to 20 subagents can run at once; `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` changes that.
 
 ## Can Claude Code subagents spawn subagents?
 
-Yes, up to three layers below your main conversation. That default arrived in 2.1.219 (24 July 2026), after two releases where nesting was off. Set `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` to change the depth, or leave `Agent` out of a subagent's `tools` to stop that one from delegating. Older guides that say subagents cannot nest were right for a while.
+Yes, up to three layers below your main conversation. That default arrived in 2.1.219 (24 July 2026), after two releases where nesting was off. Set `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` to change the depth, or leave `Agent` out of a subagent's `tools` to stop that one from delegating. From 2.1.172 to 2.1.216 the limit was a fixed five layers; 2.1.217 and 2.1.218 turned nesting off.
 
 ## Can Claude Code subagents talk to each other?
 
-Named ones can. When Claude gives a subagent a name, other agents in the session can reach it with the `SendMessage` tool, which also resumes a finished subagent with its full history. Subagents can keep notes between sessions too: `memory: project` gives one a folder at `.claude/agent-memory/<name>/`. For how this compares with separate sessions, see [can Claude Code agents talk to each other](/blog/can-claude-code-agents-talk-to-each-other/).
+Named ones can (since 2.1.206). When Claude gives a subagent a name, other agents in the session can reach it with the `SendMessage` tool, which also resumes a finished subagent with its full history. Subagents can keep notes between sessions too: `memory: p
```

---

### Incident Patch 3: `36ee9d9c` (2026-09-28)
**Commit Message**: seo-engine: refresh how-to-add-an-mcp-server-to-claude-code (review fixes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/how-to-add-an-mcp-server-to-claude-code.md` (modified, +5/-4)
```diff
@@ -71,7 +71,7 @@ everything:
 To remove this server, run: claude mcp remove everything -s project
 ```
 
-Forget the `--` and Claude Code reads `-y` as one of its own flags, which is how a ten second setup turns into an afternoon. The `Pending approval` status is correct for a project scoped server: Claude Code will not start a process a repository defines until you say yes in an interactive session.
+Forget the `--` and the add fails at once with `error: unknown option '-y'`. The `Pending approval` status is correct for a project scoped server: Claude Code will not start a process a repository defines until you say yes in an interactive session.
 
 For a hosted server the shape is the same without the separator: `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp`, the example `claude mcp --help` prints.
 
@@ -107,13 +107,14 @@ Invalid environment variable format: demo-env, environment variables should be a
 
 $ claude mcp add --scope project --env DEMO_KEY=abc123 --transport stdio demo-env -- npx -y @modelcontextprotocol/server-everything
 Added stdio MCP server demo-env with command: npx -y @modelcontextprotocol/server-everything to project config
+File modified: <your folder>/mcp-demo/.mcp.json
 ```
 
 Any other option between `--env` and the name fixes it, as the docs recommend. One more rule: in a remote server's `url` and `headers`, Claude Code reads its own credential variables such as `ANTHROPIC_API_KEY` as empty, so a shared `.mcp.json` cannot ship your key to a stranger's server.
 
 ## How do you edit .mcp.json by hand?
 
-Write an `mcpServers` object where each key is a server name. This is what the two adds above produced, and it is the format for all three scopes:
+Write an `mcpServers` object where each key is a server name. This is the `demo-env` entry the second add wrote, and it is the format for all three scopes:
 
 ```json
 {
@@ -143,7 +144,7 @@ Servers without dynamic client registration take `--client-id`, `--client-secret
 Claude Code warns when one tool result passes 10,000 tokens and cuts it at 25,000 by default. Raise the cap with `MAX_MCP_OUTPUT_TOKENS=50000 claude`; the warning threshold stays fixed. A server author can instead set `_meta["anthropic/maxResultSizeChars"]` on a tool, up to 500,000 characters, for text results. Other variables worth knowing, all from the docs on 29 Sep 2026:
 
 * `MCP_TIMEOUT`: server startup timeout in milliseconds, default 30 seconds. Useful when `npx` is still downloading.
-* `ENABLE_TOOL_SEARCH`: tool search is on by default, so only tool names load at start. `false` loads everything upfront.
+* `ENABLE_TOOL_SEARCH`: tool search is on by default, so only tool names and server instructions load at start. `false` loads everything upfront.
 * `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`: tool descriptions and server instructions are cut at 2,048 characters unless you change this.
 * `"alwaysLoad": true` on a server entry skips tool search for that server's tools.
 
@@ -165,6 +166,6 @@ Mostly connection status and sign in. From the [Claude Code changelog](https://c
 
 ## Can Munder Difflin set up MCP servers for every agent?
 
-Yes, for a default set. In the v0.5.3 release, Settings, Connections has a Default MCP servers list (`src/renderer/src/components/McpDefaultsSettings.tsx`). Six read-only servers are on by default: Sequential Thinking, Time, Fetch, Context7, and Filesystem and Git limited to the agent's own folder. GitHub, Database, Email & Calendar and Web Search need a key and stay off until you turn them on (`src/shared/mcpCatalog.ts`).
+Yes, for a default set. In the v0.5.3 release, Settings, Connections has a Default MCP servers list (`src/renderer/src/components/McpDefaultsSettings.tsx`). Six servers from the safe tier are on by default: Sequential Thinking, Time, Fetch, Context7, and Filesystem and Git limited to the agent's own folder. GitHub, Database, Email & Calendar and Web Search need a key and stay off until you turn them on (`src/share
```

---

### Incident Patch 4: `3f6ae66f` (2026-09-28)
**Commit Message**: seo-engine: refresh how-to-use-claude-code-plan-mode (review 2 fixes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/how-to-use-claude-code-plan-mode.md` (modified, +3/-3)
```diff
@@ -13,7 +13,7 @@ faq:
   - q: "What is Claude Code plan mode?"
     a: "It is one of Claude Code's permission modes. Claude reads files and runs shell commands to explore, then writes a plan, but does not edit your source until you approve that plan."
   - q: "What is the shortcut for plan mode in Claude Code?"
-    a: "Shift+Tab cycles permission modes, and plan mode is three presses away from auto mode, the mode new interactive sessions start in from Claude Code 2.1.284, when no mode is configured. On Windows terminals where Shift+Tab does not register, Alt+M does the same job. You can also type /plan, or start with claude --permission-mode plan."
+    a: "Shift+Tab cycles permission modes, and plan mode is three presses away from auto mode, the mode new interactive sessions start in on every plan and provider from Claude Code 2.1.284, when no mode is configured. On Windows terminals where Shift+Tab does not register, Alt+M does the same job. You can also type /plan, or start with claude --permission-mode plan."
   - q: "How do you exit plan mode in Claude Code?"
     a: "Approve the plan, or press Shift+Tab to leave without approving anything. The approval prompt offers Yes, and use auto mode, Yes, manually approve edits, and No, keep planning. Approving switches the session to the mode you picked and Claude starts editing."
   - q: "Can Claude run shell commands in plan mode?"
@@ -43,7 +43,7 @@ $ claude --help | grep -A3 -- '--permission-mode <mode>'
 
 ## What is the Claude Code plan mode shortcut?
 
-Shift+Tab is the shortcut, and plan mode sits three presses away from where a new session starts. Since 2.1.284 (28 Sep 2026), a terminal or VS Code session with no permission mode set starts in auto mode on every plan and provider, or in Manual if auto mode isn't available, so the first press goes to Manual, the second to accept edits, the third to plan, and the status bar shows `⏸ plan mode on`. On Windows terminals that don't send Shift+Tab, use Alt+M (interactive mode docs, checked 29 Sep 2026).
+Shift+Tab is the shortcut, and plan mode sits three presses away from where a new session starts. Since 2.1.284 (28 Sep 2026), a terminal or VS Code session with no permission mode set starts in auto mode on every plan and provider, or in Manual if auto mode isn't available. From auto the first press goes to Manual, the second to accept edits, the third to plan, and the status bar shows `⏸ plan mode on`; a session that starts in Manual reaches plan in two presses. On Windows terminals that don't send Shift+Tab, use Alt+M (interactive mode docs, checked 29 Sep 2026).
 
 | Way in or out (Claude Code 2.1.284, checked 29 Sep 2026) | What it does |
 | :-- | :-- |
@@ -79,7 +79,7 @@ Claude can read, search and run shell commands to explore, but it cannot edit yo
 * **Auto mode unavailable, or that setting off**: anything outside the built-in read-only command set asks you first.
 * **Interactive terminal session with bypass permissions available**: plan mode's blocks are not enforced at all. More on that below.
 
-For big codebases Claude hands the reading to the built-in Plan subagent, which has read-only tools (Write and Edit denied) and its own context window. The one file plan mode does write is the plan itself, by default under `~/.claude/plans/`. Set `plansDirectory` to a path inside the project if you want the plan checked in or picked up by a later CI step, the same review gate as [approving AI agents without a queue](/blog/human-in-the-loop-approving-ai-agents/).
+For big codebases Claude hands the reading to the built-in Plan subagent, which has read-only tools (Write and Edit denied) and its own context window. The one file plan mode does write is the plan itself, by default under `~/.claude/plans/`. Set `plansDirectory` to a path inside the project, such as `./plans`, if you want the plan in the repo for a teammate to read before anyone approves it, the approach in [approving AI agents without a queue](/blog/human-in-the-l
```

---

### Incident Patch 5: `68dd3108` (2026-09-28)
**Commit Message**: seo-engine: refresh how-to-use-claude-code-plan-mode (review fixes)

Auto start on every plan is 2.1.284, not 2.1.283; restores the approvals link; cuts filler.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/how-to-use-claude-code-plan-mode.md` (modified, +8/-7)
```diff
@@ -13,7 +13,7 @@ faq:
   - q: "What is Claude Code plan mode?"
     a: "It is one of Claude Code's permission modes. Claude reads files and runs shell commands to explore, then writes a plan, but does not edit your source until you approve that plan."
   - q: "What is the shortcut for plan mode in Claude Code?"
-    a: "Shift+Tab cycles permission modes, and plan mode is three presses away from auto mode, the mode new interactive sessions start in from Claude Code 2.1.283. On Windows terminals where Shift+Tab does not register, Alt+M does the same job. You can also type /plan, or start with claude --permission-mode plan."
+    a: "Shift+Tab cycles permission modes, and plan mode is three presses away from auto mode, the mode new interactive sessions start in from Claude Code 2.1.284, when no mode is configured. On Windows terminals where Shift+Tab does not register, Alt+M does the same job. You can also type /plan, or start with claude --permission-mode plan."
   - q: "How do you exit plan mode in Claude Code?"
     a: "Approve the plan, or press Shift+Tab to leave without approving anything. The approval prompt offers Yes, and use auto mode, Yes, manually approve edits, and No, keep planning. Approving switches the session to the mode you picked and Claude starts editing."
   - q: "Can Claude run shell commands in plan mode?"
@@ -43,7 +43,7 @@ $ claude --help | grep -A3 -- '--permission-mode <mode>'
 
 ## What is the Claude Code plan mode shortcut?
 
-Shift+Tab is the shortcut, and plan mode sits three presses away from where a new session starts. Since 2.1.283 (25 Sep 2026) auto mode is the built-in starting mode for interactive terminal and VS Code sessions on every plan, so the first press goes to Manual, the second to accept edits, the third to plan, and the status bar shows `⏸ plan mode on`. On Windows terminals that don't send Shift+Tab, use Alt+M (interactive mode docs, checked 29 Sep 2026).
+Shift+Tab is the shortcut, and plan mode sits three presses away from where a new session starts. Since 2.1.284 (28 Sep 2026), a terminal or VS Code session with no permission mode set starts in auto mode on every plan and provider, or in Manual if auto mode isn't available, so the first press goes to Manual, the second to accept edits, the third to plan, and the status bar shows `⏸ plan mode on`. On Windows terminals that don't send Shift+Tab, use Alt+M (interactive mode docs, checked 29 Sep 2026).
 
 | Way in or out (Claude Code 2.1.284, checked 29 Sep 2026) | What it does |
 | :-- | :-- |
@@ -75,11 +75,11 @@ Save that as `.claude/settings.json` in the repo. It also works from `~/.claude/
 
 Claude can read, search and run shell commands to explore, but it cannot edit your source. That is where several popular guides go wrong: plan mode does not ban Bash. The official docs say Claude "reads files, runs shell commands to explore, and writes a plan, but does not edit your source". What happens to a given command depends on the session:
 
-* **Auto mode available and `useAutoModeDuringPlan` on** (the default): a classifier reviews each shell command instead of prompting you. Approved ones run, rejected ones are blocked. Since 2.1.218 (22 Jul 2026) this also covers commands the static analyzer cannot prove read-only.
+* **Auto mode available and `useAutoModeDuringPlan` on** (the default): a classifier reviews each shell command except critical path removals instead of prompting you. Approved ones run, rejected ones are blocked. Since 2.1.218 (22 Jul 2026) this also covers commands the static analyzer cannot prove read-only.
 * **Auto mode unavailable, or that setting off**: anything outside the built-in read-only command set asks you first.
 * **Interactive terminal session with bypass permissions available**: plan mode's blocks are not enforced at all. More on that below.
 
-For big codebases Claude hands the reading to the built-in Plan subagent, which has read-only tools (Write and Edit denied) and its own context window. The on
```

---

### Incident Patch 6: `89b7b2b5` (2026-09-28)
**Commit Message**: seo-engine: refresh what-is-a-multi-agent-harness (review fixes)

Keeps multi agent harness in the title, states the board rule as protocol, links sources, cuts filler.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/what-is-a-multi-agent-harness.md` (modified, +6/-6)
```diff
@@ -1,5 +1,5 @@
 ---
-title: "What Is an AI Agent Harness? Single vs Multi-Agent, Explained"
+title: "What Is an AI Agent Harness? Single vs Multi-Agent Harness Explained"
 description: "An agent harness is the code around an AI model that runs its tool loop, memory and permissions. Single vs multi-agent harnesses, compared and dated."
 date: 2026-05-22
 updated: 2026-09-29
@@ -47,11 +47,11 @@ Microsoft's [Agent Framework docs](https://learn.microsoft.com/en-us/agent-frame
 
 ## Is Claude Code an agent harness?
 
-Yes, in the single agent sense. When Anthropic renamed the Claude Code SDK to the Claude Agent SDK on 29 Sep 2025, it called it "the agent harness that powers Claude Code". The [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) says it gives you "the same tools, agent loop, and context management that power Claude Code", in Python and TypeScript. Claude Code is that harness with a terminal on top.
+Yes, in the single agent sense. When Anthropic renamed the Claude Code SDK to the Claude Agent SDK on 29 Sep 2025, it called it "[the agent harness that powers Claude Code](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)". The [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) says it gives you "the same tools, agent loop, and context management that power Claude Code", in Python and TypeScript. Claude Code is that harness with a terminal on top.
 
 ## Is an agent harness the same as an agent framework?
 
-No, though the line is blurry. A framework is a library you write an agent with; a harness is the runtime that drives it. The blur is real: Microsoft ships a Harness inside Agent Framework, and LangChain's [Deep Agents](https://github.com/langchain-ai/deepagents) is a library that calls itself "the batteries-included agent harness". A useful test: are you writing the agent, or running one that already exists? Our [CrewAI and AutoGen comparison](/blog/crewai-autogen-vs-a-local-agent-harness/) covers that choice in more detail.
+No, though the line is blurry. A framework is a library you write an agent with; a harness is the runtime that drives it. Microsoft ships a Harness inside Agent Framework, and LangChain's [Deep Agents](https://github.com/langchain-ai/deepagents) is a library that calls itself "the batteries-included agent harness". A useful test: are you writing the agent, or running one that already exists? Our [CrewAI and AutoGen comparison](/blog/crewai-autogen-vs-a-local-agent-harness/) covers that choice in more detail.
 
 ## What is a multi-agent harness?
 
@@ -69,7 +69,7 @@ A multi-agent harness runs several single agent harnesses at the same time and m
 
 ## What does a multi-agent harness look like in code?
 
-Mostly files and a router. We read the Munder Difflin source at tag v0.5.3 on 29 Sep 2026, and the coordination layer lives in `src/main/hive.ts`. Every agent gets a folder with an identity, a memory file, an inbox, an outbox and a read cursor. A router in the main process moves each outbox message into the recipient's inbox, and that process is the only one that commits to the hive's git repo, so agents never race on git. The shared plan is `board.md`, and only the orchestrator (Michael, your clone) writes to it.
+Mostly files and a router. We read the Munder Difflin source at tag v0.5.3 on 29 Sep 2026, and the coordination layer lives in `src/main/hive.ts`. Every agent gets a folder with an identity, a memory file, an inbox, an outbox and a read cursor. A router in the main process moves each outbox message into the recipient's inbox, and that process is the only one that commits to the hive's git repo, so agents never race on git. The shared plan is `board.md`, and by protocol only the orchestrator (Michael, your clone) edits it; other agents propose changes.
 
 This page was refreshed by a Munder Difflin worker. Running this inside its own hive folder on 29 Sep 2026 (the grep hides unrelated files) printed:
 
@@ -98,7 +98,7 @@ Here is
```

---

### Incident Patch 7: `c61abb2a` (2026-09-28)
**Commit Message**: seo-engine: refresh claude-code-hooks-explained (review 2 fix)

Notes the two April events the changelog omits.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/claude-code-hooks-explained.md` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ Claude Code 2.1.284 documents 33 hook events. These are the ones most people rea
 
 The rest cover setup, instruction loading, slash command expansion, tool batches, permission denials, subagent starts, tasks, teammates, message display, API failures, config, directory and file changes, worktrees, compaction, MCP elicitations and model switches.
 
-The [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) records five new events in the last six months (dates are npm publish dates): `PermissionDenied` in 2.1.89 (31 Mar 2026), `MessageDisplay` in 2.1.152 (26 May), `DirectoryAdded` in 2.1.219 (24 Jul), and `PreModelSwitch` plus `PostModelSwitch` in 2.1.251 (28 Aug). In the same window, 2.1.139 added the `args` exec form and 2.1.143 capped runaway Stop hooks at eight blocks in a row. It records no renamed events.
+The [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) records five new events in the last six months (dates are npm publish dates): `PermissionDenied` in 2.1.89 (31 Mar 2026), `MessageDisplay` in 2.1.152 (26 May), `DirectoryAdded` in 2.1.219 (24 Jul), and `PreModelSwitch` plus `PostModelSwitch` in 2.1.251 (28 Aug). The hooks reference also gained `UserPromptExpansion` and `PostToolBatch` in late April 2026, which the changelog never mentions. In the same window, 2.1.139 added the `args` exec form and 2.1.143 capped runaway Stop hooks at eight blocks in a row. It records no renamed events.
 
 {% img "note-1" %}
 
```

---

### Incident Patch 8: `397dd9ca` (2026-09-28)
**Commit Message**: seo-engine: refresh claude-code-hooks-explained (review fixes)

Adds PermissionDenied (2.1.89) to the new events and lists every remaining event family.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/claude-code-hooks-explained.md` (modified, +2/-2)
```diff
@@ -55,9 +55,9 @@ Claude Code 2.1.284 documents 33 hook events. These are the ones most people rea
 | `PreCompact` | Before context compaction | Yes | `manual`, `auto` |
 | `SessionEnd` | Session terminates | No | Why it ended |
 
-The rest cover slash command expansion, tool batches, tasks, teammates, worktrees, file changes, MCP elicitations and model switches.
+The rest cover setup, instruction loading, slash command expansion, tool batches, permission denials, subagent starts, tasks, teammates, message display, API failures, config, directory and file changes, worktrees, compaction, MCP elicitations and model switches.
 
-The [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) records four new events in the last six months (dates are npm publish dates): `MessageDisplay` in 2.1.152 (26 May 2026), `DirectoryAdded` in 2.1.219 (24 Jul), and `PreModelSwitch` plus `PostModelSwitch` in 2.1.251 (28 Aug). In the same window, 2.1.139 added the `args` exec form and 2.1.143 capped runaway Stop hooks at eight blocks in a row. It records no renamed events.
+The [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) records five new events in the last six months (dates are npm publish dates): `PermissionDenied` in 2.1.89 (31 Mar 2026), `MessageDisplay` in 2.1.152 (26 May), `DirectoryAdded` in 2.1.219 (24 Jul), and `PreModelSwitch` plus `PostModelSwitch` in 2.1.251 (28 Aug). In the same window, 2.1.139 added the `args` exec form and 2.1.143 capped runaway Stop hooks at eight blocks in a row. It records no renamed events.
 
 {% img "note-1" %}
 
```

---

### Incident Patch 9: `79d2c6df` (2026-09-28)
**Commit Message**: seo-engine: refresh is-claude-code-max-worth-it (review fixes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/is-claude-code-max-worth-it.md` (modified, +2/-2)
```diff
@@ -44,7 +44,7 @@ Mostly more usage, plus Fable inside the plan. All three plans include Claude Co
 | Usage credits past the limit | Yes, at standard API rates | Yes | Yes |
 | Also | None | Higher output limits, priority access at busy times | Same as Max 5x |
 
-Sources, all checked 29 Sep 2026: prices, billing, models and credits from [claude.com/pricing](https://claude.com/pricing); the $100 and $200 tiers, monthly only, and the weekly reset from Anthropic's [Max plan article](https://support.claude.com/en/articles/11049741-what-is-the-max-plan); the Opus 5.5 default from Claude Code's model configuration docs, which say `default` resolves to Opus 5.5 on Pro and Max from v2.1.280. Prices exclude tax, and the Max article says mobile app prices may differ.
+Sources, all checked 29 Sep 2026: prices, billing, models and credits from [claude.com/pricing](https://claude.com/pricing); the $100 and $200 tiers, monthly only, and the weekly reset from Anthropic's [Max plan article](https://support.claude.com/en/articles/11049741-what-is-the-max-plan); the 14 Sep row from BleepingComputer's 29 Aug 2026 report; the Opus 5.5 default from Claude Code's model configuration docs, which say `default` resolves to Opus 5.5 on Pro and Max from v2.1.280. Prices exclude tax, and the Max article says mobile app prices may differ.
 
 Anthropic publishes the weekly limit as a meter, not a number. Neither page gives a token or message count for any tier.
 
@@ -78,7 +78,7 @@ Max pays for itself once a month of your Claude Code work would cost more than t
 | Output | 180,000 | $20.00 | $3.60 |
 | **Day total** | | | **$13.00** |
 
-The rates are Opus 5.5's row on Anthropic's [API pricing page](https://platform.claude.com/docs/en/about-claude/pricing), checked 29 Sep 2026. Five minute writes apply because Claude Code's prompt caching docs say an API key gets the five minute cache by default. The $13 matches [Claude Code's cost docs](https://code.claude.com/docs/en/costs), which put the enterprise average at about $13 per developer per active day, checked 29 Sep 2026.
+The rates are Opus 5.5's row on Anthropic's [API pricing page](https://platform.claude.com/docs/en/about-claude/pricing), checked 29 Sep 2026. Five minute writes apply because Claude Code's prompt caching docs say an API key gets the five minute cache by default. The target is the [Claude Code cost docs](https://code.claude.com/docs/en/costs) figure of about $13 per enterprise developer per active day, checked 29 Sep 2026.
 
 Now the break even, at 29 Sep 2026 prices:
 
```

---

### Incident Patch 10: `8ea6669a` (2026-09-28)
**Commit Message**: seo-engine: refresh best-ai-coding-agents, second review fixes

Cursor and Codex rows now read not tested, with no timing, and the FAQ lists Devin's Free plan.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `blog/src/posts/best-ai-coding-agents.md` (modified, +4/-4)
```diff
@@ -16,7 +16,7 @@ faq:
   - q: "What is the best AI coding agent right now?"
     a: "As of 29 Sep 2026, Claude Code is the strongest pick for terminal work and Cursor for work inside an editor. Codex is the best value if you already pay for ChatGPT, and GitHub Copilot fits teams that live on GitHub. OpenCode and Cline are the best open source picks."
   - q: "Is there a free AI coding agent?"
-    a: "Yes. Codex works on the ChatGPT Free plan, GitHub Copilot has a Free plan, Cursor has a free Hobby plan, and Antigravity CLI has a free Individual tier with weekly limits, all checked on 29 Sep 2026. OpenCode, Cline and Aider are free open source software, though you still pay for the model you connect."
+    a: "Yes. Codex works on the ChatGPT Free plan, GitHub Copilot has a Free plan, Cursor has a free Hobby plan, Devin has a Free plan, and Antigravity CLI has a free Individual tier with weekly limits, all checked on 29 Sep 2026. OpenCode, Cline and Aider are free open source software, though you still pay for the model you connect."
   - q: "Can I still use Gemini CLI for free?"
     a: "No. Google stopped serving free, Google AI Pro and Google AI Ultra users in Gemini CLI on 18 Jun 2026 and moved individuals to Antigravity CLI, invoked as agy. Gemini CLI stays open source under Apache 2.0 and still works with a paid Gemini API key, Gemini Enterprise Agent Platform (formerly Vertex AI) or a Code Assist Standard or Enterprise licence."
   - q: "What is the difference between an AI coding agent and an AI coding assistant?"
@@ -100,11 +100,11 @@ We used each tool's non interactive mode (`claude -p`, `codex exec`, `gemini -p`
 | GitHub Copilot CLI | `GitHub Copilot CLI 1.0.88.` | Yes | 26.9 s | Yes, same fix |
 | OpenCode | `1.18.30` | Yes, but the saved OpenAI key was rejected; rerun on the free `opencode/big-pickle` model | 9.8 s on the free model | Yes, same fix |
 | Gemini CLI | `0.46.0` | Yes (Gemini API key), after `--skip-trust` for the new folder | 168.9 s, including two 503 "high demand" retries | Yes, same fix |
-| Cursor Agent | `2026.09.23-86fc751` | Yes, after `--trust` for the new folder | 14.1 s | No answer: "You've hit your usage limit" on this account |
-| Codex | `codex-cli 0.153.4` | Yes (API key login) | 40.5 s | No answer: the API key had no credits left |
+| Cursor Agent | `2026.09.23-86fc751` | Yes, after `--trust` for the new folder | n/a | Not tested: our own Cursor account was at its usage limit |
+| Codex | `codex-cli 0.153.4` | Yes (API key login) | n/a | Not tested: our own OpenAI API key had no credits |
 | Aider, Cline, Devin | Not installed on this Mac | Not run | Not run | Not run |
 
-No agent edited the file; we diffed each copy afterwards. The bug was easy on purpose, so this is a smoke test of setup and access, not a ranking. Two of seven failed on account state, not skill, and two needed a trust flag before they would run in a new folder.
+No agent edited the file; we diffed each copy afterwards. The bug was easy on purpose, so this is a smoke test of setup and access, not a ranking. Cursor and Codex were not tested because our own accounts were out of usage, which says nothing about either tool, and two needed a trust flag before they would run in a new folder.
 
 ## Which AI coding agents are free?
 
```

#### Recent Merged Pull Requests:
- **PR #646** (2026-09-30): seo-engine: day 03, refresh Grok Bot alternatives (vendor recheck, ChatGPT dots added) (@chaitanyagiri)
- **PR #644** (2026-09-30): seo-engine: ChatGPT dots launch posts (3) + Claude Code vs GitHub Copilot refresh (@chaitanyagiri)
- **PR #641** (2026-09-29): SEO engine: What is OpenCode page (@chaitanyagiri)
- **PR #639** (2026-09-28): Add new GPT-6 models to model catalog (@mjaggard)
- **PR #638** (2026-09-28): seo-engine: all engine changes (sitemap lastmod, llms.txt blog section, plan mode links, phase 1 refreshes) (@chaitanyagiri)
- **PR #637** (2026-09-28): models: Claude Sonnet 5.5 in the remote model catalog (@chaitanyagiri)
- **PR #636** (closed): seo-engine: day 01, link plan mode guide from 3 indexed posts (@chaitanyagiri)
- **PR #635** (closed): seo-engine: day 01, stable sitemap lastmod and a blog section in llms.txt (@chaitanyagiri)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

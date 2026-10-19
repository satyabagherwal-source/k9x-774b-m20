> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/trybyte-app-sitemap-validator-learnings.md`  
> **Source**: github ([https://github.com/trybyte-app/sitemap-validator](https://github.com/trybyte-app/sitemap-validator))  
> **Source Version**: `a7fc287e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T20:47:13.782Z  
> **Learning ID**: `learn-github-trybyte-app-sitemap-validator`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): trybyte-app/sitemap-validator

> **Canonical Artifact**: `07_PROJECT_LEARNING/trybyte-app-sitemap-validator-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trybyte-app/sitemap-validator](https://github.com/trybyte-app/sitemap-validator))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T20:47:12.953Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trybyte-app/sitemap-validator`
- **Description**: Standards-focused XML sitemap validator for TypeScript, CI, and browser apps.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 0 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.js`
```
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "benchmarks/generated/**", "reports/**", "sitemap-report*.json"]
  },
  {
    files: ["src/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      "no-undef": "off",
      "no-control-regex": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
);

```

### Core Architecture Module: `prettier.config.js`
```
export default {
  printWidth: 120,
  trailingComma: "none"
};

```

### Core Architecture Module: `scripts/benchmark-large-sitemap.mjs`
```
import { statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { validateSitemapSet } from "../dist/index.js";

const args = parseArgs(process.argv.slice(2));
const dir = args.dir ?? "benchmarks/generated";
const indexPath = args.index ?? join(dir, "sitemap-index.xml");
const baseUrl = args.baseUrl ?? "https://example.com";
const sitemapPrefix = `${baseUrl}/sitemaps/`;
const startMemory = process.memoryUsage().rss;
const start = performance.now();

const result = await validateSitemapSet(
  {
    path: indexPath,
    sourceId: "sitemap-index.xml",
  },
  {
    sourceId: "local-sitemap-set",
    sitemapLocation: `${baseUrl}/sitemaps/sitemap-index.xml`,
    maxDepth: 1,
    loader: async ({ loc }) => {
      if (!loc.startsWith(sitemapPrefix)) {
        return null;
      }

      const fileName = loc.slice(sitemapPrefix.length);
      const path = join(dir, fileName);

      statSync(path);

      return {
        input: { path },
        sourceId: fileName,
        sitemapLocation: loc,
        gzip: fileName.endsWith(".gz"),
      };
    },
  },
);

const elapsedMs = performance.now() - start;
const endMemory = process.memoryUsage().rss;

console.log(JSON.stringify(
  {
    valid: result.valid,
    sources: result.summary.sources,
    urls: result.summary.urls,
    sitemaps: result.summary.sitemaps,
    diagnostics: result.summary.diagnostics,
    elapsedMs: Math.round(elapsedMs),
    urlsPerSecond: Math.round(result.summary.urls / (elapsedMs / 1000)),
    rssStartMb: toMb(startMemory),
    rssEndMb: toMb(endMemory),
    rssDeltaMb: toMb(endMemory - startMemory),
    index: pathToFileURL(indexPath).href,
  },
  null,
  2,
));

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--")) {
      continue;
    }

    parsed[toCamel(key.slice(2))] = value ?? "true";
    index += 1;
  }

  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function toMb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

```

### Core Architecture Module: `scripts/benchmark-parser-candidates.mjs`
```
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { createGunzip } from "node:zlib";
import sax from "sax";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { SaxesParser } from "saxes";
import { validateSitemap } from "../dist/index.js";

const args = parseArgs(process.argv.slice(2));
const file = args.file ?? join("benchmarks/generated", "sitemap-00001.xml.gz");
const gzip = args.gzip !== "false" && file.endsWith(".gz");

const validatorStart = performance.now();
const result = await validateSitemap(
  { path: file, gzip, sourceId: file },
  {
    sitemapLocation: "https://example.com/sitemaps/sitemap-00001.xml.gz",
    google: false,
  },
);
const validatorMs = performance.now() - validatorStart;

const scannerStart = performance.now();
const text = await readXmlText(file, gzip);
const scanner = scanLocs(text);
const scannerMs = performance.now() - scannerStart;

const saxStart = performance.now();
const saxResult = parseWithSax(text);
const saxMs = performance.now() - saxStart;

const saxesStart = performance.now();
const saxesResult = parseWithSaxes(text);
const saxesMs = performance.now() - saxesStart;

const fxpValidateStart = performance.now();
const fxpValidation = XMLValidator.validate(text);
const fxpValidateMs = performance.now() - fxpValidateStart;

const fxpParseStart = performance.now();
const fxpParser = new XMLParser({
  ignoreAttributes: false,
  processEntities: false,
});
const fxpDoc = fxpParser.parse(text);
const fxpParseMs = performance.now() - fxpParseStart;

console.log(JSON.stringify(
  {
    file,
    validator: {
      valid: result.valid,
      urls: result.summary.urls,
      diagnostics: result.summary.diagnostics,
      elapsedMs: Math.round(validatorMs),
      urlsPerSecond: Math.round(result.summary.urls / (validatorMs / 1000)),
    },
    sitemapSpecificScannerPrototype: {
      note: "Benchmark ceiling only; not XML-safe and not production validation.",
      urls: scanner.urls,
      locs: scanner.locs,
      elapsedMs: Math.round(scannerMs),
      locsPerSecond: Math.round(scanner.locs / (scannerMs / 1000)),
    },
    saxPackage: {
      urls: saxResult.urls,
      locs: saxResult.locs,
      elapsedMs: Math.round(saxMs),
      locsPerSecond: Math.round(saxResult.locs / (saxMs / 1000)),
    },
    saxesPackage: {
      urls: saxesResult.urls,
      locs: saxesResult.locs,
      elapsedMs: Math.round(saxesMs),
      locsPerSecond: Math.round(saxesResult.locs / (saxesMs / 1000)),
    },
    fastXmlParser: {
      validation: fxpValidation === true ? "ok" : fxpValidation,
      parseElapsedMs: Math.round(fxpParseMs),
      validateElapsedMs: Math.round(fxpValidateMs),
      rootKeys: typeof fxpDoc === "object" && fxpDoc !== null ? Object.keys(fxpDoc).slice(0, 5) : [],
    },
  },
  null,
  2,
));

async function readXmlText(path, gzipInput) {
  const stream = gzipInput ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
  let text = "";

  for await (const chunk of stream) {
    text += chunk.toString("utf8");
  }

  return text;
}

function scanLocs(text) {
  return {
    urls: countMatches(text, /<url(?:\s|>)/g),
    locs: countMatches(text, /<loc>/g),
  };
}

function parseWithSax(text) {
  const parser = sax.parser(true, {
    lowercase: false,
    normalize: false,
    position: true,
    trim: false,
    xmlns: true,
  });
  const counts = { urls: 0, locs: 0 };

  parser.onopentag = (node) => {
    if (node.name === "url") counts.urls += 1;
    if (node.name === "loc") counts.locs += 1;
  };
  parser.write(text).close();

  return counts;
}

function parseWithSaxes(text) {
  const parser = new SaxesParser({
    xmlns: true,
  });
  const counts = { urls: 0, locs: 0 };

  parser.on("opentag", (node) => {
    if (node.local === "url") counts.urls += 1;
    if (node.local === "loc") counts.locs += 1;
  });
  parser.write(text).close();

  return counts;
}

function countMatches(value, pattern) {
  let count = 0;

  while (pattern.exec(value)) {
    count += 1;
  }

  return count;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--")) {
      continue;
    }

    parsed[toCamel(key.slice(2))] = value ?? "true";
    index += 1;
  }

  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

```

### Core Architecture Module: `scripts/check-api-snapshot.mjs`
```
#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";

const args = parseArgs(process.argv.slice(2));
const entry = args.entry ?? "dist/index.d.ts";
const snapshotPath = args.snapshot ?? "docs/api-snapshot.md";
const update = Boolean(args.update);

const entryPath = resolve(entry);
const snapshotFilePath = resolve(snapshotPath);
const modules = await collectDeclarationGraph(entryPath);
const snapshot = await renderSnapshot(modules, entryPath);

if (update) {
  await mkdir(dirname(snapshotFilePath), { recursive: true });
  await writeFile(snapshotFilePath, snapshot);
  console.log(`Wrote ${toPosix(relative(process.cwd(), snapshotFilePath))} from ${modules.length} declaration files.`);
} else {
  const expected = await readFileIfExists(snapshotFilePath);

  if (expected === null) {
    console.error(`Missing API snapshot: ${toPosix(relative(process.cwd(), snapshotFilePath))}`);
    console.error("Run `npm run api:snapshot` after reviewing the current public declarations.");
    process.exitCode = 1;
  } else if (expected !== snapshot) {
    const diff = findFirstDifference(expected, snapshot);
    console.error("Public API snapshot is out of date.");
    console.error(`First difference at line ${diff.line}:`);
    console.error(`snapshot: ${diff.expected}`);
    console.error(`current:  ${diff.actual}`);
    console.error("Run `npm run api:snapshot` only after confirming the API change is intentional.");
    process.exitCode = 1;
  } else {
    console.log(`Public API snapshot is current (${modules.length} declaration files).`);
  }
}

async function collectDeclarationGraph(entryFilePath) {
  if (!existsSync(entryFilePath)) {
    throw new Error(`Declaration entry does not exist: ${toPosix(relative(process.cwd(), entryFilePath))}`);
  }

  const seen = new Set();
  const pending = [entryFilePath];

  while (pending.length > 0) {
    const filePath = pending.pop();

    if (!filePath || seen.has(filePath)) {
      continue;
    }

    seen.add(filePath);
    const source = await readFile(filePath, "utf8");
    const nextPaths = declarationReferences(source, filePath);

    for (const nextPath of nextPaths) {
      if (!seen.has(nextPath)) {
        pending.push(nextPath);
      }
    }
  }

  return [...seen].sort((left, right) => {
    if (left === entryFilePath) {
      return -1;
    }

    if (right === entryFilePath) {
      return 1;
    }

    return toPosix(relative(process.cwd(), left)).localeCompare(toPosix(relative(process.cwd(), right)));
  });
}

function declarationReferences(source, fromFilePath) {
  const refs = new Set();
  const patterns = [
    /\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];

      if (!specifier) {
        continue;
      }

      const resolved = resolveDeclarationSpecifier(fromFilePath, specifier);

      if (resolved) {
        refs.add(resolved);
      }
    }
  }

  return [...refs].sort();
}

function resolveDeclarationSpecifier(fromFilePath, specifier) {
  const extension = extname(specifier);
  const declarationSpecifier = extension === ".js" || extension === ".mjs" || extension === ".cjs"
    ? specifier.slice(0, -extension.length) + ".d.ts"
    : specifier.endsWith(".d.ts")
      ? specifier
      : `${specifier}.d.ts`;
  const resolved = resolve(dirname(fromFilePath), declarationSpecifier);

  if (!existsSync(resolved)) {
    throw new Error(`Declaration reference not found: ${specifier} from ${toPosix(relative(process.cwd(), fromFilePath))}`);
  }

  return resolved;
}

async function renderSnapshot(modulePaths, entryFilePath) {
  const moduleList = modulePaths.map((filePath) => `- \`${toPosix(relative(process.cwd(), filePath))}\``);
  const lines = [
    "# Public API snapshot",
    "",
    "This file comes from `dist/index.d.ts` and the declaration files it references.",
    "Run `npm run api:snapshot` after intentional public API changes.",
    "Run `npm run api:check` in CI before release.",
    "",
    `Entry: \`${toPosix(relative(process.cwd(), entryFilePath))}\``,
    "",
    "## Declaration files",
    "",
    ...moduleList,
    "",
  ];

  for (const filePath of modulePaths) {
    const relativePath = toPosix(relative(process.cwd(), filePath));
    const source = normalizeDeclaration(await readFile(filePath, "utf8"));
    lines.push(`## \`${relativePath}\``, "", "```ts", source, "```", "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function normalizeDeclaration(source) {
  return source.replace(/\r\n?/g, "\n").trimEnd();
}

async function readFileIfExists(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function findFirstDifference(expected, actual) {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const length = Math.max(expectedLines.length, actualLines.length);

  for (let index = 0; index < length; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return {
        line: index + 1,
        expected: expectedLines[index] ?? "<missing>",
        actual: actualLines[index] ?? "<missing>",
      };
    }
  }

  return {
    line: 1,
    expected: "<no difference>",
    actual: "<no difference>",
  };
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value?.startsWith("--")) {
      continue;
    }

    const name = toCamel(value.slice(2));
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[name] = true;
    } else {
      parsed[name] = next;
      index += 1;
    }
  }

  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function toPosix(path) {
  return path.split(sep).join("/");
}

```

### Core Architecture Module: `scripts/check-benchmark-baseline.mjs`
```
import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { join } from "node:path";
import { validateSitemapSet } from "../dist/index.js";

const args = parseArgs(process.argv.slice(2));
const dir = args.dir ?? "benchmarks/generated";
const baselinePath = args.baseline ?? "benchmarks/baseline.json";
const baseUrl = args.baseUrl ?? "https://example.com";
const minThroughputRatio = Number(args.minThroughputRatio ?? "0.75");
const maxMemoryRatio = Number(args.maxMemoryRatio ?? "1.5");
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const current = await runBenchmark(dir, baseUrl);
const minUrlsPerSecond = Math.floor(Number(baseline.urlsPerSecond) * minThroughputRatio);
const maxRssDeltaMb = Math.ceil(Number(baseline.rssDeltaMb) * maxMemoryRatio);
const failures = [];

if (!current.valid) {
  failures.push("current benchmark validation result is invalid");
}

if (current.urls !== baseline.urls) {
  failures.push(`current URL count ${current.urls} does not match baseline ${baseline.urls}`);
}

if (current.urlsPerSecond < minUrlsPerSecond) {
  failures.push(`throughput ${current.urlsPerSecond} URLs/sec is below gate ${minUrlsPerSecond}`);
}

if (current.rssDeltaMb > maxRssDeltaMb) {
  failures.push(`RSS delta ${current.rssDeltaMb} MB is above gate ${maxRssDeltaMb} MB`);
}

const report = {
  baseline: {
    urls: baseline.urls,
    urlsPerSecond: baseline.urlsPerSecond,
    rssDeltaMb: baseline.rssDeltaMb,
  },
  current,
  gates: {
    minThroughputRatio,
    minUrlsPerSecond,
    maxMemoryRatio,
    maxRssDeltaMb,
  },
  passed: failures.length === 0,
  failures,
};

console.log(JSON.stringify(report, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}

async function runBenchmark(dir, baseUrl) {
  const sitemapPrefix = `${baseUrl}/sitemaps/`;
  const startMemory = process.memoryUsage().rss;
  const start = performance.now();

  const result = await validateSitemapSet(
    {
      path: join(dir, "sitemap-index.xml"),
      sourceId: "sitemap-index.xml",
    },
    {
      sourceId: "benchmark-gate",
      sitemapLocation: `${baseUrl}/sitemaps/sitemap-index.xml`,
      maxDepth: 1,
      loader: async ({ loc }) => {
        if (!loc.startsWith(sitemapPrefix)) {
          return null;
        }

        const fileName = loc.slice(sitemapPrefix.length);
        const path = join(dir, fileName);

        statSync(path);

        return {
          input: { path },
          sourceId: fileName,
          sitemapLocation: loc,
          gzip: fileName.endsWith(".gz"),
        };
      },
    },
  );

  const elapsedMs = performance.now() - start;
  const rssDelta = process.memoryUsage().rss - startMemory;

  return {
    valid: result.valid,
    urls: result.summary.urls,
    sources: result.summary.sources,
    elapsedMs: Math.round(elapsedMs),
    urlsPerSecond: Math.round(result.summary.urls / (elapsedMs / 1000)),
    rssDeltaMb: Math.round((rssDelta / 1024 / 1024) * 10) / 10,
    diagnostics: result.summary.diagnostics,
  };
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--")) {
      continue;
    }

    parsed[toCamel(key.slice(2))] = value ?? "true";
    index += 1;
  }

  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

```

### Core Architecture Module: `scripts/generate-large-sitemap-fixture.mjs`
```
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { finished } from "node:stream/promises";
import { createGzip } from "node:zlib";

const args = parseArgs(process.argv.slice(2));
const outDir = args.out ?? "benchmarks/generated";
const totalUrls = Number(args.urls ?? 100_000);
const urlsPerFile = Number(args.urlsPerFile ?? 50_000);
const gzip = args.gzip !== "false";
const baseUrl = args.baseUrl ?? "https://example.com";
const pagePrefix = args.pagePrefix ?? "/sitemaps/pages";
const invalidEvery = Number(args.invalidEvery ?? 0);

if (!Number.isInteger(totalUrls) || totalUrls < 1) {
  throw new Error("--urls must be a positive integer.");
}

if (!Number.isInteger(urlsPerFile) || urlsPerFile < 1 || urlsPerFile > 50_000) {
  throw new Error("--urls-per-file must be between 1 and 50000.");
}

await mkdir(outDir, { recursive: true });

const sitemapCount = Math.ceil(totalUrls / urlsPerFile);
const extension = gzip ? ".xml.gz" : ".xml";
const childNames = [];

for (let fileIndex = 0; fileIndex < sitemapCount; fileIndex += 1) {
  const start = fileIndex * urlsPerFile;
  const count = Math.min(urlsPerFile, totalUrls - start);
  const name = `sitemap-${String(fileIndex + 1).padStart(5, "0")}${extension}`;
  childNames.push(name);
  await writeSitemap(join(outDir, name), { start, count, baseUrl, gzip, pagePrefix, invalidEvery });
}

await writeIndex(join(outDir, "sitemap-index.xml"), {
  childNames,
  baseUrl,
});

console.log(JSON.stringify(
  {
    outDir,
    totalUrls,
    urlsPerFile,
    sitemapCount,
    gzip,
    pagePrefix,
    invalidEvery,
    index: join(outDir, "sitemap-index.xml"),
  },
  null,
  2,
));

async function writeSitemap(path, options) {
  const fileStream = createWriteStream(path);
  const stream = options.gzip ? createGzip() : fileStream;

  if (options.gzip) {
    stream.pipe(fileStream);
  }

  stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  stream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

  for (let index = 0; index < options.count; index += 1) {
    const id = options.start + index + 1;
    stream.write("  <url>\n");
    if (options.invalidEvery > 0 && id % options.invalidEvery === 0) {
      stream.write(`    <loc>${options.baseUrl}${options.pagePrefix}/bad url ${id}</loc>\n`);
    } else {
      stream.write(`    <loc>${options.baseUrl}${options.pagePrefix}/${id}</loc>\n`);
    }
    stream.write("    <lastmod>2026-06-10</lastmod>\n");
    stream.write("  </url>\n");
  }

  stream.write("</urlset>\n");
  stream.end();

  if (options.gzip) {
    await finished(fileStream);
  } else {
    await finished(stream);
  }
}

async function writeIndex(path, options) {
  const stream = createWriteStream(path);
  stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  stream.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

  for (const childName of options.childNames) {
    stream.write("  <sitemap>\n");
    stream.write(`    <loc>${options.baseUrl}/sitemaps/${childName}</loc>\n`);
    stream.write("    <lastmod>2026-06-10</lastmod>\n");
    stream.write("  </sitemap>\n");
  }

  stream.write("</sitemapindex>\n");
  stream.end();
  await finished(stream);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--")) {
      continue;
    }

    parsed[toCamel(key.slice(2))] = value ?? "true";
    index += 1;
  }

  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

```

### Core Architecture Module: `scripts/generate-rule-matrix.mjs`
```
#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { listRuleDefinitions } from "../dist/index.js";

const out = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "docs/rule-matrix.md";

if (!out) {
  throw new Error("--out requires a file path.");
}

const rules = listRuleDefinitions().sort((left, right) => left.code.localeCompare(right.code));
const lines = [
  "# Rule matrix",
  "",
  "This file comes from `RULE_DEFINITIONS`. Run `npm run docs:rules` after changing rule codes, severities, sources, or specification links.",
  "",
  `Total rules: ${rules.length}`,
  "",
  "| Code | Severity | Source | Spec |",
  "| --- | --- | --- | --- |",
  ...rules.map((rule) => [
    `\`${rule.code}\``,
    rule.defaultSeverity,
    rule.source,
    rule.spec ? `[source](${rule.spec})` : "",
  ].join(" | ")).map((row) => `| ${row} |`),
  "",
];

await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${lines.join("\n")}\n`);
console.log(`Wrote ${out} with ${rules.length} rules.`);

```

### Core Architecture Module: `scripts/pack-dry-run.mjs`
```
#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const cache = process.env.SITEMAP_VALIDATOR_NPM_CACHE ?? join(tmpdir(), "sitemap-validator-npm-cache");
await mkdir(cache, { recursive: true });

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(command, ["pack", "--dry-run", "--cache", cache], {
  stdio: "inherit",
  env: {
    ...process.env,
    npm_config_cache: cache,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

```

### Core Architecture Module: `scripts/write-benchmark-baseline.mjs`
```
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateSitemapSet } from "../dist/index.js";

const args = parseArgs(process.argv.slice(2));
const dir = args.dir ?? "benchmarks/generated";
const out = args.out ?? "benchmarks/baseline.json";
const baseUrl = args.baseUrl ?? "https://example.com";
const start = performance.now();
const startMemory = process.memoryUsage().rss;

const result = await validateSitemapSet(
  {
    path: join(dir, "sitemap-index.xml"),
    sourceId: "sitemap-index.xml",
  },
  {
    sourceId: "benchmark-baseline",
    sitemapLocation: `${baseUrl}/sitemaps/sitemap-index.xml`,
    maxDepth: 1,
    loader: async ({ loc }) => {
      const prefix = `${baseUrl}/sitemaps/`;

      if (!loc.startsWith(prefix)) {
        return null;
      }

      const fileName = loc.slice(prefix.length);

      return {
        input: { path: join(dir, fileName) },
        sourceId: fileName,
        sitemapLocation: loc,
        gzip: fileName.endsWith(".gz"),
      };
    },
  },
);

const elapsedMs = performance.now() - start;
const rssDelta = process.memoryUsage().rss - startMemory;
const baseline = {
  generatedAt: new Date().toISOString(),
  urls: result.summary.urls,
  sources: result.summary.sources,
  valid: result.valid,
  diagnostics: result.summary.diagnostics,
  elapsedMs: Math.round(elapsedMs),
  urlsPerSecond: Math.round(result.summary.urls / (elapsedMs / 1000)),
  rssDeltaMb: Math.round((rssDelta / 1024 / 1024) * 10) / 10,
};

await mkdir(join(out, ".."), { recursive: true });
await writeFile(out, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(JSON.stringify(baseline, null, 2));

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--")) {
      continue;
    }

    parsed[toCamel(key.slice(2))] = value ?? "true";
    index += 1;
  }

  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- *No recent closed bug issues fetched.*

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

### Incident Patch 1: `bd757185` (2026-08-31)
**Commit Message**: fix: harden sitemap validation and prepare v1.0.3

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -2,6 +2,21 @@
 
 All notable changes to this package will be documented in this file.
 
+## 1.0.3 - 2026-08-31
+
+- Fixed foreign-element placement, unexpected character data, invalid sitemap
+  locations, date bounds, decimal priority syntax, and Unicode character limits.
+- Made sitemap depth limits block incomplete validation, bounded concurrent
+  source loading, and preserved cancellation through input and loader completion.
+- Corrected local URL-to-file mapping and stopped upstream gzip consumption
+  when the decompressed size limit is reached.
+- Corrected IPv6 public-address checks, inactive HTML metadata handling, and
+  crawler-specific robots directives in live audits.
+- Bounded compact CI reports, corrected mixed diagnostic group output, rejected
+  incompatible saved-URL options, and handled closed stdout pipes in both CLIs.
+- Added optional loader abort signals and diagnostic group variation metadata,
+  two blocking diagnostic codes, and 25 regression tests.
+
 ## 1.0.2 - 2026-08-28
 
 - Fixed `sitemap-validator` and `sitemap-validator-live` when npm invokes them
```

**File**: `dist/ci-policy-evaluator.d.ts` (modified, +5/-1)
```diff
@@ -5,4 +5,8 @@ export interface CiPolicyEvaluator {
     addMany(diagnostics: readonly SitemapDiagnostic[]): void;
     evaluation(): CiEvaluation;
 }
-export declare function createCiPolicyEvaluator(policy: CiPolicy): CiPolicyEvaluator;
+interface CiPolicyEvaluatorOptions {
+    maxFailingDiagnostics?: number | undefined;
+}
+export declare function createCiPolicyEvaluator(policy: CiPolicy, options?: CiPolicyEvaluatorOptions): CiPolicyEvaluator;
+export {};
```

**File**: `dist/ci-policy-evaluator.js` (modified, +10/-5)
```diff
@@ -1,8 +1,10 @@
-export function createCiPolicyEvaluator(policy) {
+export function createCiPolicyEvaluator(policy, options = {}) {
     const failOn = new Set(policy.failOn ?? ["error"]);
     const failOnRules = new Set(policy.failOnRules ?? []);
     const allowRules = new Set(policy.allowRules ?? []);
+    const maxFailingDiagnostics = options.maxFailingDiagnostics ?? Number.POSITIVE_INFINITY;
     const failingDiagnostics = [];
+    let failingDiagnosticCount = 0;
     let warnings = 0;
     let errors = 0;
     return {
@@ -17,7 +19,10 @@ export function createCiPolicyEvaluator(policy) {
                 errors += 1;
             }
             if (failOn.has(diagnostic.severity) || failOnRules.has(diagnostic.code)) {
-                failingDiagnostics.push(diagnostic);
+                failingDiagnosticCount += 1;
+                if (failingDiagnostics.length < maxFailingDiagnostics) {
+                    failingDiagnostics.push(diagnostic);
+                }
             }
         },
         addMany(diagnostics) {
@@ -27,10 +32,10 @@ export function createCiPolicyEvaluator(policy) {
         },
         evaluation() {
             const warningLimitExceeded = policy.maxWarnings !== undefined && warnings > policy.maxWarnings;
-            const passed = failingDiagnostics.length === 0 && !warningLimitExceeded;
+            const passed = failingDiagnosticCount === 0 && !warningLimitExceeded;
             const failureReasons = [
-                failingDiagnostics.length > 0
-                    ? `${failingDiagnostics.length} diagnostic${failingDiagnostics.length === 1 ? "" : "s"} matched the CI failure policy.`
+                failingDiagnosticCount > 0
+                    ? `${failingDiagnosticCount} diagnostic${failingDiagnosticCount === 1 ? "" : "s"} matched the CI failure policy.`
                     : undefined,
                 warningLimitExceeded
                     ? `Warning count ${warnings} exceeded the configured maxWarnings ${policy.maxWarnings}.`
```

**File**: `dist/cli.js` (modified, +30/-3)
```diff
@@ -51,6 +51,9 @@ export async function runCli(argv = process.argv.slice(2), io = {
         return report.evaluation.exitCode;
     }
     catch (error) {
+        if (isBrokenPipeError(error)) {
+            return 0;
+        }
         io.stderr.write(`${toErrorMessage(error)}\n`);
         if (error instanceof CliUsageError) {
             io.stderr.write("\n");
@@ -239,7 +242,9 @@ async function validateFromCliArgs(args) {
     });
     const summaries = [];
     const cliPolicy = createCliPolicy(args);
-    const policyEvaluator = createCiPolicyEvaluator(cliPolicy);
+    const policyEvaluator = createCiPolicyEvaluator(cliPolicy, {
+        maxFailingDiagnostics: collectDiagnostics ? undefined : 0,
+    });
     let setSummary;
     for await (const event of validateSitemapSetEvents(root.input, {
         sourceId: root.sourceId,
@@ -642,7 +647,15 @@ function formatTextReport(report, args) {
     }
     else {
         for (const group of report.diagnosticSummary.groups) {
-            lines.push(`[${group.severity}] ${group.code} x${group.count} (${group.source}): ${group.message}`);
+            const severity = group.varies?.includes("severity") === true
+                ? `mixed severity: ${group.counts.errors} errors, ${group.counts.warnings} warnings, ${group.counts.info} info`
+                : group.severity;
+            const code = group.varies?.includes("code") === true ? "multiple rule codes" : group.code;
+            const source = group.varies?.includes("source") === true ? "multiple rule sources" : group.source;
+            const message = group.varies?.includes("message") === true
+                ? `Multiple diagnostic messages are grouped here${group.examples.length > 0 ? "; see the examples below" : ""}.`
+                : group.message;
+            lines.push(`[${severity}] ${code} x${group.count} (${source}): ${message}`);
             if (args.detail === "grouped") {
                 for (const example of group.examples) {
                     lines.push(`  example${formatDiagnosticLocation(example)}: ${example.message}`);
@@ -698,9 +711,23 @@ function formatDiagnosticLocation(diagnostic) {
 function toErrorMessage(error) {
     return error instanceof Error ? error.message : String(error);
 }
+function isBrokenPipeError(error) {
+    return error instanceof Error
+        && "code" in error
+        && error.code === "EPIPE";
+}
 if (isMainModule(import.meta.url)) {
+    let stdoutPipeClosed = false;
+    process.stdout.on("error", (error) => {
+        if (isBrokenPipeError(error)) {
+            stdoutPipeClosed = true;
+            process.exitCode = 0;
+            return;
+        }
+        throw error;
+    });
     runCli().then((exitCode) => {
-        process.exitCode = exitCode;
+        process.exitCode = stdoutPipeClosed ? 0 : exitCode;
     }).catch((error) => {
         process.stderr.write(`${toErrorMessage(error)}\n`);
         process.exitCode = 1;
```

**File**: `dist/extension-validation.d.ts` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ export declare class ExtensionValidator {
 }
 export declare function isExtensionNamespace(uri: string): boolean;
 export declare function shouldCollectExtensionText(element: Pick<ExtensionElement, "local" | "uri">): boolean;
+export declare function isElementOnlyExtensionContainer(element: Pick<ExtensionElement, "local" | "uri">): boolean;
 export interface DateTimeValidationOptions {
     requireTimeSeconds?: boolean;
 }
```

**File**: `dist/extension-validation.js` (modified, +33/-10)
```diff
@@ -291,7 +291,7 @@ export class ExtensionValidator {
         }
         if (entry.publicationLanguage !== undefined && !isValidGoogleNewsLanguage(entry.publicationLanguage))
             this.#add(context, "GOOGLE_NEWS_LANGUAGE_INVALID", "news:language should be a valid-looking ISO language code.", `${entry.path}/news:publication/news:language`, NEWS_SPEC);
-        if (entry.title !== undefined && entry.title.length > 110)
+        if (entry.title !== undefined && xmlCharacterLength(entry.title) > 110)
             this.#add(context, "GOOGLE_NEWS_TITLE_TOO_LONG", "news:title should be concise and no more than 110 characters.", `${entry.path}/news:title`, NEWS_SPEC, "warning");
         if (entry.access !== undefined && entry.access !== "Subscription" && entry.access !== "Registration")
             this.#add(context, "GOOGLE_NEWS_ACCESS_INVALID", "news:access must be Subscription or Registration when the legacy XSD field is used.", `${entry.path}/news:access`, NEWS_XSD);
@@ -404,13 +404,13 @@ export class ExtensionValidator {
             this.#add(context, "GOOGLE_VIDEO_CONTENT_SEGMENT_REQUIRES_PLAYER_LOC", "video:content_segment_loc can be used only in conjunction with video:player_loc.", `${entry.path}/video:content_segment_loc`, VIDEO_XSD);
         if (entry.playerLoc !== undefined && entry.playerLoc === parentUrlLoc)
             this.#add(context, "GOOGLE_VIDEO_PLAYER_LOC_EQUALS_PAGE_LOC", "video:player_loc must not be the same URL as the parent page loc.", `${entry.path}/video:player_loc`, VIDEO_SPEC);
-        if (entry.title !== undefined && entry.title.length > 100)
+        if (entry.title !== undefined && xmlCharacterLength(entry.title) > 100)
             this.#add(context, "GOOGLE_VIDEO_TITLE_TOO_LONG", "video:title must be no more than 100 characters.", `${entry.path}/video:title`, VIDEO_XSD);
-        if (entry.description !== undefined && entry.description.length > 2_048)
+        if (entry.description !== undefined && xmlCharacterLength(entry.description) > 2_048)
             this.#add(context, "GOOGLE_VIDEO_DESCRIPTION_TOO_LONG", "video:description must be no more than 2048 characters.", `${entry.path}/video:description`, VIDEO_SPEC);
         if (entry.duration !== undefined && (!/^(?:[1-9]\d*)$/.test(entry.duration) || Number(entry.duration) > 28_800))
             this.#add(context, "GOOGLE_VIDEO_DURATION_INVALID", "video:duration must be an integer number of seconds from 1 to 28800.", `${entry.path}/video:duration`, VIDEO_SPEC);
-        if (entry.category !== undefined && entry.category.length > 256)
+        if (entry.category !== undefined && xmlCharacterLength(entry.category) > 256)
             this.#add(context, "GOOGLE_VIDEO_CATEGORY_TOO_LONG", "video:category must be no more than 256 characters when the legacy XSD field is used.", `${entry.path}/video:category`, VIDEO_XSD);
         if (entry.rating !== undefined && (entry.rating.length === 0 || Number.isNaN(Number(entry.rating)) || Number(entry.rating) < 0 || Number(entry.rating) > 5))
             this.#add(context, "GOOGLE_VIDEO_RATING_INVALID", "video:rating must be a number from 0.0 to 5.0.", `${entry.path}/video:rating`, VIDEO_SPEC);
@@ -428,7 +428,7 @@ export class ExtensionValidator {
         this.#validateRelationship(entry.platformRelationship, entry.platformValue, "platform", "GOOGLE_VIDEO_PLATFORM_RELATIONSHIP_INVALID", context, entry.path);
         if (entry.platformValue !== undefined && !isSpaceSeparatedVideoPlatformList(entry.platformValue))
             this.#add(context, "GOOGLE_VIDEO_PLATFORM_VALUE_INVALID", "video:platform must contain web, mobile, tv, or a space-delimited combination of those values.", `${entry.path}/video:platform`, VIDEO_SPEC);
-        if (entry.uploader !== undefined && entry.uploader.length > 255)
+        if (entry.uploader !== undefined && xmlCharacterLength(entry.uploader) > 255)
             this.#add(context, "GOOGLE_VIDEO_UPLOADER_TOO_LONG", "video:uploader must be no more than 255 characters.", `${entry.path}/video:uploader`, VIDEO_SPEC);
         if (entry.uploaderInfo !== undefined) {
             context.validateLoc(entry.uploaderInfo, `${entry.path}/video:uploader/@info`, { enforceSitemapLocation: false });
@@ -614,24 +614,47 @@ export function shouldCollectExtensionText(element) {
         ]).has(element.local);
     return element.uri === PAGEMAP_NS && element.local === "Attribute";
 }
+export function isElementOnlyExtensionContainer(element) {
+    if (element.uri === IMAGE_NS)
+        return element.local === "image";
+    if (element.uri === NEWS_NS)
+        return element.local === "news" || element.local === "publication";
+    if (element.uri === VIDEO_NS)
+        return element.local === "video" || element.local === "tvshow";
+    if (element.uri === PAGEMAP_NS) {
+        return element.local === "PageMap" || element.local === "Template" || element.local === "DataObject";
+    }
+    return element.uri === XHTML_NS && element.local === "link";
+}
 export
```

**File**: `dist/guarded-live-fetch.js` (modified, +103/-13)
```diff
@@ -149,19 +149,109 @@ function isNonPublicIpv4(address) {
         || (first === 203 && second === 0 && third === 113);
 }
 function isNonPublicIpv6(address) {
-    if (address.startsWith("::ffff:")) {
-        return isNonPublicIp(address.slice("::ffff:".length));
-    }
-    return address === "::"
-        || address === "::1"
-        || address.startsWith("fc")
-        || address.startsWith("fd")
-        || address.startsWith("fe8")
-        || address.startsWith("fe9")
-        || address.startsWith("fea")
-        || address.startsWith("feb")
-        || address.startsWith("ff")
-        || address.startsWith("2001:db8");
+    const value = parseIpv6Address(address);
+    if (value === undefined) {
+        return true;
+    }
+    if (isIpv6InCidr(value, "::ffff:0:0", 96)) {
+        const embeddedIpv4 = Number(value & 0xffffffffn);
+        return isNonPublicIpv4([
+            embeddedIpv4 >>> 24,
+            (embeddedIpv4 >>> 16) & 0xff,
+            (embeddedIpv4 >>> 8) & 0xff,
+            embeddedIpv4 & 0xff,
+        ].join("."));
+    }
+    for (const [cidr, prefixLength, globallyReachable] of IPV6_SPECIAL_PURPOSE_POLICY) {
+        if (isIpv6InCidr(value, cidr, prefixLength)) {
+            return !globallyReachable;
+        }
+    }
+    return !isIpv6InCidr(value, "2000::", 3);
+}
+// Ordered from the most specific allocation to the least specific parent.
+// Values follow the IANA IPv6 Special-Purpose Address Space registry's
+// "Globally Reachable" field. N/A and expired allocations are treated as
+// non-public for guarded live fetches.
+const IPV6_SPECIAL_PURPOSE_POLICY = [
+    ["::", 128, false],
+    ["::1", 128, false],
+    ["64:ff9b::", 96, true],
+    ["64:ff9b:1::", 48, false],
+    ["100::", 64, false],
+    ["100:0:0:1::", 64, false],
+    ["2001:1::1", 128, true],
+    ["2001:1::2", 128, true],
+    ["2001:1::3", 128, true],
+    ["2001:2::", 48, false],
+    ["2001:3::", 32, true],
+    ["2001:4:112::", 48, true],
+    ["2001:10::", 28, false],
+    ["2001:20::", 28, true],
+    ["2001:30::", 28, true],
+    ["2001::", 32, false],
+    ["2001::", 23, false],
+    ["2001:db8::", 32, false],
+    ["2002::", 16, false],
+    ["3fff::", 20, false],
+    ["5f00::", 16, false],
+    ["fc00::", 7, false],
+    ["fe80::", 10, false],
+    ["ff00::", 8, false],
+];
+function isIpv6InCidr(value, cidrAddress, prefixLength) {
+    const cidrValue = parseIpv6Address(cidrAddress);
+    if (cidrValue === undefined) {
+        return false;
+    }
+    const shift = BigInt(128 - prefixLength);
+    return (value >> shift) === (cidrValue >> shift);
+}
+function parseIpv6Address(address) {
+    const sections = address.split("::");
+    if (sections.length > 2) {
+        return undefined;
+    }
+    const left = parseIpv6Sections(sections[0] ?? "");
+    const right = parseIpv6Sections(sections[1] ?? "");
+    if (!left || !right) {
+        return undefined;
+    }
+    const omittedCount = sections.length === 2 ? 8 - left.length - right.length : 0;
+    if (omittedCount < 0 || (sections.length === 1 && left.length !== 8)) {
+        return undefined;
+    }
+    const words = [...left, ...Array(omittedCount).fill(0), ...right];
+    if (words.length !== 8) {
+        return undefined;
+    }
+    return words.reduce((value, word) => (value << 16n) | BigInt(word), 0n);
+}
+function parseIpv6Sections(value) {
+    if (value.length === 0) {
+        return [];
+    }
+    const sections = value.split(":");
+    const words = [];
+    for (const [index, section] of sections.entries()) {
+        if (section.includes(".")) {
+            if (index !== sections.length - 1) {
+                return undefined;
+            }
+            const octets = section.split(".").map(Number);
+            if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
+                return undefined;
+            }
+            words.push(((octets[0] ?? 0) << 8) | (octets[1] ?? 0));
+            words.push(((octets[2] ?? 0) << 8) | (octets[3] ?? 0));
+            continue;
+        }
+        if (!/^[0-9a-f]{1,4}$/i.test(section)) {
+            return undefined;
+        }
+        words.push(Number.parseInt(section, 16));
+    }
+    return words;
 }
 function isRedirectStatus(status) {
     return status === 301
```

**File**: `dist/input.js` (modified, +16/-5)
```diff
@@ -86,18 +86,24 @@ function createDecompressionStream(chunks) {
     if (!DecompressionStreamConstructor) {
         return undefined;
     }
+    const iterator = chunks[Symbol.asyncIterator]();
     const input = new ReadableStream({
-        async start(controller) {
+        async pull(controller) {
             try {
-                for await (const chunk of chunks) {
-                    controller.enqueue(chunk);
+                const result = await iterator.next();
+                if (result.done) {
+                    controller.close();
+                    return;
                 }
-                controller.close();
+                controller.enqueue(result.value);
             }
             catch (error) {
                 controller.error(error);
             }
         },
+        async cancel() {
+            await iterator.return?.();
+        },
     });
     return streamToAsyncIterable(input.pipeThrough(new DecompressionStreamConstructor("gzip")));
 }
@@ -113,7 +119,12 @@ async function* streamToAsyncIterable(stream) {
         }
     }
     finally {
-        reader.releaseLock();
+        try {
+            await reader.cancel();
+        }
+        finally {
+            reader.releaseLock();
+        }
     }
 }
 function isAsyncIterable(value) {
```

---

### Incident Patch 2: `69bb51b0` (2026-08-28)
**Commit Message**: fix: run package binaries through npm symlinks

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -2,6 +2,13 @@
 
 All notable changes to this package will be documented in this file.
 
+## 1.0.2 - 2026-08-28
+
+- Fixed `sitemap-validator` and `sitemap-validator-live` when npm invokes them
+  through generated `.bin` symlinks.
+- Added regression coverage that runs both package binaries through npm-style
+  symlink paths.
+
 ## 1.0.1 - 2026-08-28
 
 - Split Google extension validation, live URL storage, guarded live fetching,
```

**File**: `dist/cli.js` (modified, +2/-8)
```diff
@@ -8,6 +8,7 @@ import { resolveCiPolicy } from "./ci.js";
 import { createLocalSitemapLoader } from "./loaders.js";
 import { countDiagnostics, createDiagnosticSummaryBuilder } from "./report.js";
 import { validateSitemapSetEvents } from "./set.js";
+import { isMainModule } from "./node-main.js";
 const DEFAULT_MAX_DEPTH = 10;
 const DEFAULT_MAX_SOURCES = 10_000;
 const DEFAULT_LOADER_CONCURRENCY = 4;
@@ -697,14 +698,7 @@ function formatDiagnosticLocation(diagnostic) {
 function toErrorMessage(error) {
     return error instanceof Error ? error.message : String(error);
 }
-function isMainModule() {
-    const invokedPath = process.argv[1];
-    if (!invokedPath) {
-        return false;
-    }
-    return import.meta.url === pathToFileURL(invokedPath).href;
-}
-if (isMainModule()) {
+if (isMainModule(import.meta.url)) {
     runCli().then((exitCode) => {
         process.exitCode = exitCode;
     }).catch((error) => {
```

**File**: `dist/live-cli.js` (modified, +2/-1)
```diff
@@ -14,6 +14,7 @@ import { evaluateForCi, resolveCiPolicy } from "./ci.js";
 import { createGuardedLiveFetcher } from "./guarded-live-fetch.js";
 import { createLiveUrlDatasetCollector, LiveUrlDatasetError, openLiveUrlDataset, } from "./live-url-dataset.js";
 import { createLocalSitemapLoader } from "./loaders.js";
+import { isMainModule } from "./node-main.js";
 import { createDiagnosticSummaryBuilder } from "./report.js";
 import { validateSitemapSetEvents } from "./set.js";
 const DEFAULT_MAX_DEPTH = 10;
@@ -1687,7 +1688,7 @@ function resolveLocalPath(target) {
 function toErrorMessage(error) {
     return error instanceof Error ? error.message : String(error);
 }
-if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
+if (isMainModule(import.meta.url)) {
     runLiveCli().then((code) => {
         process.exitCode = code;
     }).catch((error) => {
```

**File**: `dist/node-main.d.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export declare function isMainModule(moduleUrl: string, invokedPath?: string | undefined): boolean;
```

**File**: `dist/node-main.js` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+import { realpathSync } from "node:fs";
+import { fileURLToPath } from "node:url";
+export function isMainModule(moduleUrl, invokedPath = process.argv[1]) {
+    if (!invokedPath) {
+        return false;
+    }
+    try {
+        return realpathSync(invokedPath) === realpathSync(fileURLToPath(moduleUrl));
+    }
+    catch {
+        return false;
+    }
+}
```

**File**: `docs/release-checklist.md` (modified, +2/-0)
```diff
@@ -9,6 +9,8 @@ Use this before publishing a package version.
 - Run `npm ci` from a clean install when practical.
 - Run `npm run verify:release`.
 - Review the `npm pack --dry-run` file list printed by `npm run pack:dry-run`.
+- Confirm both package binaries run through npm-style `.bin` symlinks, not only
+  from direct `dist` paths.
 - Confirm GitHub repository description, topics, and homepage are current.
 - Confirm npm authentication has publish rights for the `@trybyte` organization.
 
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@trybyte/sitemap-validator",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@trybyte/sitemap-validator",
-      "version": "1.0.1",
+      "version": "1.0.2",
       "license": "Apache-2.0",
       "dependencies": {
         "@trybyte/robotstxt-parser": "^1.2.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@trybyte/sitemap-validator",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "description": "Standards-focused XML sitemap validator for TypeScript, CI, and browser apps.",
   "type": "module",
   "private": false,
```

---

### Incident Patch 3: `f011a89d` (2026-08-28)
**Commit Message**: fix: separate validation and live audit modules

**File**: `CONTEXT.md` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+# Sitemap validation
+
+This context covers deciding whether generated or published XML sitemaps comply with the document-level rules that apply to them. It also covers separate, opt-in checks against a live website.
+
+## Language
+
+### Publish gate
+
+The pre-deployment validation path for generated local sitemap files. It never fetches a live sitemap or page URL.
+Do not call it the core CLI or offline mode.
+
+### Live wrapper
+
+The separate validation path for an already-published sitemap and its optional website checks.
+Do not call it live mode or the remote validator.
+
+### XML diagnostic
+
+A finding about sitemap XML backed by Google, sitemaps.org, W3C, or a relevant RFC. An error means the document is invalid or rejected by the applicable source.
+Do not call it a live issue or audit finding.
+
+### Live audit finding
+
+An operational website finding from an opt-in robots, status, redirect, canonical, noindex, or duplicate URL check. It does not change whether the sitemap XML is valid.
+Do not call it an XML diagnostic or sitemap validation error.
+
+### Live URL dataset
+
+The bounded collection of page URLs discovered from live sitemaps or read from a saved URL list, including source sitemap provenance when available.
+Do not call it a URL array or crawl queue.
+
+### Guarded live fetch
+
+A live-wrapper fetch that applies target admission, redirect, timeout, response-size, and body-cleanup rules before returning data to a live check.
+Do not call it an HTTP helper or raw fetch.
+
+### Extension validation
+
+Document-level validation for Google image, News, video, PageMap, and hreflang sitemap markup.
+Do not call it a page audit or media crawl.
+
+### CI policy evaluation
+
+The decision that maps XML diagnostics to a publish-gate pass or failure using configured severities, rule codes, and warning limits.
+Do not call it XML validation or live audit evaluation.
```

**File**: `README.md` (modified, +19/-13)
```diff
@@ -8,14 +8,14 @@ standards-aligned, and ready to submit.
 
 ```bash
 npm install @trybyte/sitemap-validator
-pnpm install @trybyte/sitemap-validator
-bun install @trybyte/sitemap-validator
+pnpm add @trybyte/sitemap-validator
+bun add @trybyte/sitemap-validator
 ```
 
 Requirements: Node.js 20 or newer for the CLI and Node file-system helpers.
 Browser apps should import from `@trybyte/sitemap-validator/browser`.
 
-## Core Use Case
+## Core use case
 
 Generate the sitemap with your application, write it to a local file, then run
 `sitemap-validator` against that generated file before deploy.
@@ -61,7 +61,7 @@ npx @trybyte/sitemap-validator ./build/sitemap.xml \
 The validator still reads `./build/sitemap.xml`; it does not fetch
 `https://example.com/sitemap.xml`.
 
-## CI/CD Workflow
+## CI/CD workflow
 
 The CI gate should run after sitemap generation and before deployment.
 
@@ -107,7 +107,7 @@ jobs:
 If the generated XML is invalid, the `npx @trybyte/sitemap-validator ...` step exits non-zero
 and the deployment does not continue.
 
-## Sitemap Indexes
+## Sitemap indexes
 
 For a sitemap index, pass the generated index file. If child sitemap files are
 also generated locally, map their public URL prefix to the local directory:
@@ -123,7 +123,7 @@ When the index contains `https://example.com/products.xml`, the CLI loads
 `./build/products.xml`. This validates the generated sitemap set without
 fetching live URLs.
 
-## Live Sitemap Wrapper
+## Live sitemap wrapper
 
 Use `sitemap-validator-live` when you need to fetch or audit an already-published sitemap:
 feed it a downloaded sitemap file, a live sitemap URL, or a saved URL list, then
@@ -202,9 +202,9 @@ npx --package @trybyte/sitemap-validator sitemap-validator-live --urls-file site
   --check-noindex
 ```
 
-`--urls-file` accepts either the plain text file from `--save-urls` or the JSONL
-file from `--save-url-details`. Use the JSONL file when you want later audit
-findings to keep `sourceSitemap` context.
+`--urls-file` accepts the plain text file from `--save-urls`, a JSON array of URL
+strings, or the JSONL file from `--save-url-details`. Use the JSONL file when you
+want later audit findings to keep `sourceSitemap` context.
 
 Live audits are opt-in:
 
@@ -273,6 +273,12 @@ reserved hosts, and it applies that check to followed redirects. Use
 `--allow-private-hosts` only when you intentionally audit a trusted staging or
 internal site.
 
+Every live request has a 15-second timeout by default. The timeout stays active
+while the wrapper reads the response body. Sitemap responses are capped at 60
+MiB, page bodies at 2 MiB, robots.txt at 512 KiB, and guarded redirects at five.
+Change these limits with `--timeout-ms`, `--max-sitemap-bytes`,
+`--max-page-bytes`, `--max-robots-bytes`, and `--max-redirects`.
+
 ## Library API
 
 Validate one sitemap document:
@@ -314,7 +320,7 @@ const result = await validateSitemapSet({
 assertValidForCi(result, "ciDefault");
 ```
 
-## Browser And Vite Apps
+## Browser and Vite apps
 
 For an online validator, import the browser entry. It accepts uploaded XML as a
 string, `Uint8Array`, `ArrayBuffer`, or chunk iterable and does not expose the
@@ -369,7 +375,7 @@ root input. For sitemap-set children, loader-returned `sourceId`, `gzip`, and
 `sitemapLocation` metadata take precedence over metadata embedded inside the
 returned child input object.
 
-## Validation Scope
+## Validation scope
 
 Included:
 
@@ -398,7 +404,7 @@ Not included in the core XML validator:
 Those are separate audit concerns. In this package, they live only in the
 `sitemap-validator-live` wrapper and only run when the user opts in.
 
-## Standards Sources
+## Standards sources
 
 Diagnostics include rule provenance. The main sources are:
 
@@ -445,7 +451,7 @@ console.log(evaluateForCi(result, "strict"));
 ## Development
 
 ```bash
-nvm use
+fnm use
 npm ci
 npm run typecheck
 npm run lint
```

**File**: `dist/ci-policy-evaluator.d.ts` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+import type { CiEvaluation, CiPolicy } from "./ci.js";
+import type { SitemapDiagnostic } from "./types.js";
+export interface CiPolicyEvaluator {
+    add(diagnostic: SitemapDiagnostic): void;
+    addMany(diagnostics: readonly SitemapDiagnostic[]): void;
+    evaluation(): CiEvaluation;
+}
+export declare function createCiPolicyEvaluator(policy: CiPolicy): CiPolicyEvaluator;
```

**File**: `dist/ci-policy-evaluator.js` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+export function createCiPolicyEvaluator(policy) {
+    const failOn = new Set(policy.failOn ?? ["error"]);
+    const failOnRules = new Set(policy.failOnRules ?? []);
+    const allowRules = new Set(policy.allowRules ?? []);
+    const failingDiagnostics = [];
+    let warnings = 0;
+    let errors = 0;
+    return {
+        add(diagnostic) {
+            if (allowRules.has(diagnostic.code)) {
+                return;
+            }
+            if (diagnostic.severity === "warning") {
+                warnings += 1;
+            }
+            if (diagnostic.severity === "error") {
+                errors += 1;
+            }
+            if (failOn.has(diagnostic.severity) || failOnRules.has(diagnostic.code)) {
+                failingDiagnostics.push(diagnostic);
+            }
+        },
+        addMany(diagnostics) {
+            for (const diagnostic of diagnostics) {
+                this.add(diagnostic);
+            }
+        },
+        evaluation() {
+            const warningLimitExceeded = policy.maxWarnings !== undefined && warnings > policy.maxWarnings;
+            const passed = failingDiagnostics.length === 0 && !warningLimitExceeded;
+            const failureReasons = [
+                failingDiagnostics.length > 0
+                    ? `${failingDiagnostics.length} diagnostic${failingDiagnostics.length === 1 ? "" : "s"} matched the CI failure policy.`
+                    : undefined,
+                warningLimitExceeded
+                    ? `Warning count ${warnings} exceeded the configured maxWarnings ${policy.maxWarnings}.`
+                    : undefined,
+            ].filter((reason) => typeof reason === "string");
+            return {
+                passed,
+                exitCode: passed ? 0 : 1,
+                failingDiagnostics: [...failingDiagnostics],
+                warnings,
+                errors,
+                warningLimitExceeded,
+                failureReasons,
+            };
+        },
+    };
+}
```

**File**: `dist/ci.js` (modified, +4/-23)
```diff
@@ -1,3 +1,4 @@
+import { createCiPolicyEvaluator } from "./ci-policy-evaluator.js";
 export const CI_POLICY_PRESETS = {
     ciDefault: {
         failOn: ["error"],
@@ -39,29 +40,9 @@ export class SitemapValidationError extends Error {
     }
 }
 export function evaluateForCi(result, policy = "ciDefault") {
-    const resolvedPolicy = resolveCiPolicy(policy);
-    const failOn = new Set(resolvedPolicy.failOn ?? ["error"]);
-    const failOnRules = new Set(resolvedPolicy.failOnRules ?? []);
-    const allowRules = new Set(resolvedPolicy.allowRules ?? []);
-    const policyDiagnostics = result.diagnostics.filter((diagnostic) => !allowRules.has(diagnostic.code));
-    const failingDiagnostics = policyDiagnostics.filter((diagnostic) => failOn.has(diagnostic.severity) || failOnRules.has(diagnostic.code));
-    const warnings = policyDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
-    const errors = policyDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
-    const warningLimitExceeded = resolvedPolicy.maxWarnings !== undefined && warnings > resolvedPolicy.maxWarnings;
-    const failureReasons = [
-        failingDiagnostics.length > 0 ? `${failingDiagnostics.length} diagnostics matched the CI failure policy.` : undefined,
-        warningLimitExceeded ? `Warning count ${warnings} exceeded the configured maxWarnings ${resolvedPolicy.maxWarnings}.` : undefined,
-    ].filter((reason) => typeof reason === "string");
-    const passed = failingDiagnostics.length === 0 && !warningLimitExceeded;
-    return {
-        passed,
-        exitCode: passed ? 0 : 1,
-        failingDiagnostics,
-        warnings,
-        errors,
-        warningLimitExceeded,
-        failureReasons,
-    };
+    const evaluator = createCiPolicyEvaluator(resolveCiPolicy(policy));
+    evaluator.addMany(result.diagnostics);
+    return evaluator.evaluation();
 }
 export function getCiPolicyPreset(preset) {
     return CI_POLICY_PRESETS[preset];
```

**File**: `dist/cli.js` (modified, +4/-49)
```diff
@@ -3,6 +3,7 @@ import "./node-input.js";
 import { access, writeFile } from "node:fs/promises";
 import { resolve } from "node:path";
 import { fileURLToPath, pathToFileURL } from "node:url";
+import { createCiPolicyEvaluator } from "./ci-policy-evaluator.js";
 import { resolveCiPolicy } from "./ci.js";
 import { createLocalSitemapLoader } from "./loaders.js";
 import { countDiagnostics, createDiagnosticSummaryBuilder } from "./report.js";
@@ -237,7 +238,7 @@ async function validateFromCliArgs(args) {
     });
     const summaries = [];
     const cliPolicy = createCliPolicy(args);
-    const policyState = createStreamingPolicyState(cliPolicy);
+    const policyEvaluator = createCiPolicyEvaluator(cliPolicy);
     let setSummary;
     for await (const event of validateSitemapSetEvents(root.input, {
         sourceId: root.sourceId,
@@ -252,7 +253,7 @@ async function validateFromCliArgs(args) {
         updateProgress(progress, event);
         if (event.type === "diagnostic") {
             diagnosticSummaryBuilder.add(event.diagnostic);
-            updatePolicyState(policyState, event.diagnostic);
+            policyEvaluator.add(event.diagnostic);
             if (collectDiagnostics) {
                 diagnostics.push(event.diagnostic);
             }
@@ -267,7 +268,7 @@ async function validateFromCliArgs(args) {
     const elapsedMs = Math.round(performance.now() - startedAt);
     const diagnosticSummary = diagnosticSummaryBuilder.summary();
     const summary = setSummary ?? createFallbackSetSummary(summaries, diagnosticSummary.counts);
-    const evaluation = finishPolicyEvaluation(policyState);
+    const evaluation = policyEvaluator.evaluation();
     return {
         target,
         validatedAt: new Date().toISOString(),
@@ -479,52 +480,6 @@ function createPolicyReport(args, policy) {
 function uniqueList(values) {
     return [...new Set(values)];
 }
-function createStreamingPolicyState(policy) {
-    return {
-        failOn: new Set(policy.failOn ?? ["error"]),
-        failOnRules: new Set(policy.failOnRules ?? []),
-        allowRules: new Set(policy.allowRules ?? []),
-        maxWarnings: policy.maxWarnings,
-        warnings: 0,
-        errors: 0,
-        failingDiagnostics: [],
-    };
-}
-function updatePolicyState(state, diagnostic) {
-    if (state.allowRules.has(diagnostic.code)) {
-        return;
-    }
-    if (diagnostic.severity === "error") {
-        state.errors += 1;
-    }
-    if (diagnostic.severity === "warning") {
-        state.warnings += 1;
-    }
-    if (state.failOn.has(diagnostic.severity) || state.failOnRules.has(diagnostic.code)) {
-        state.failingDiagnostics.push(diagnostic);
-    }
-}
-function finishPolicyEvaluation(state) {
-    const warningLimitExceeded = state.maxWarnings !== undefined && state.warnings > state.maxWarnings;
-    const passed = state.failingDiagnostics.length === 0 && !warningLimitExceeded;
-    const failureReasons = [
-        state.failingDiagnostics.length > 0
-            ? `${state.failingDiagnostics.length} diagnostic${state.failingDiagnostics.length === 1 ? "" : "s"} matched the CI failure policy.`
-            : undefined,
-        warningLimitExceeded
-            ? `Warning count ${state.warnings} exceeded the configured maxWarnings ${state.maxWarnings}.`
-            : undefined,
-    ].filter((reason) => typeof reason === "string");
-    return {
-        passed,
-        exitCode: passed ? 0 : 1,
-        failingDiagnostics: state.failingDiagnostics,
-        warnings: state.warnings,
-        errors: state.errors,
-        warningLimitExceeded,
-        failureReasons,
-    };
-}
 async function resolveRootInput(target, args) {
     if (isHttpUrl(target)) {
         throw new CliUsageError("Remote sitemap URLs are not accepted by the publish gate. Generate the sitemap first, pass the local file, and use --sitemap-location for its future public URL.");
```

**File**: `dist/extension-validation.d.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import type { LocValidationOptions } from "./loc-rules.js";
+import type { HreflangAlternate, SitemapDiagnostic, SourceLocation, ValidationLimits } from "./types.js";
+import type { XmlElement } from "./xml-parser.js";
+export declare const IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1";
+export declare const NEWS_NS = "http://www.google.com/schemas/sitemap-news/0.9";
+export declare const VIDEO_NS = "http://www.google.com/schemas/sitemap-video/1.1";
+export declare const PAGEMAP_NS = "http://www.google.com/schemas/sitemap-pagemap/1.0";
+export declare const XHTML_NS = "http://www.w3.org/1999/xhtml";
+export interface ExtensionElement {
+    local: string;
+    uri: string;
+    path: string;
+}
+export interface ExtensionValidationContext {
+    addDiagnostic(diagnostic: Omit<SitemapDiagnostic, "sourceId">): void;
+    location(path?: string): SourceLocation;
+    validateLoc(value: string, path: string, options: LocValidationOptions): URL | undefined;
+}
+export declare class ExtensionValidator {
+    #private;
+    constructor(limits: ValidationLimits);
+    startUrl(): void;
+    finishUrl(loc: string | undefined, path: string, context: ExtensionValidationContext): HreflangAlternate[] | undefined;
+    isTopLevelUrlExtension(element: ExtensionElement, parent: ExtensionElement | undefined): boolean;
+    validatePlacement(element: ExtensionElement, parent: ExtensionElement | undefined, grandparent: ExtensionElement | undefined, context: ExtensionValidationContext): void;
+    open(element: ExtensionElement, node: XmlElement, parent: ExtensionElement | undefined, context: ExtensionValidationContext): void;
+    close(element: ExtensionElement, text: string, parentUrlLoc: string | undefined, context: ExtensionValidationContext): void;
+}
+export declare function isExtensionNamespace(uri: string): boolean;
+export declare function shouldCollectExtensionText(element: Pick<ExtensionElement, "local" | "uri">): boolean;
+export interface DateTimeValidationOptions {
+    requireTimeSeconds?: boolean;
+}
+export declare function isValidCompleteW3cDateOrDateTime(value: string, options?: DateTimeValidationOptions): boolean;
```

**File**: `dist/extension-validation.js` (added, +759/-0)
```diff
@@ -0,0 +1,759 @@
+import { isGoogleSupportedHreflangTag, isIso3166Alpha2RegionCode, isIso639Alpha2LanguageCode, isIso639Alpha3LanguageCode, isValidBcp47LanguageTag, } from "./standards.js";
+export const IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1";
+export const NEWS_NS = "http://www.google.com/schemas/sitemap-news/0.9";
+export const VIDEO_NS = "http://www.google.com/schemas/sitemap-video/1.1";
+export const PAGEMAP_NS = "http://www.google.com/schemas/sitemap-pagemap/1.0";
+export const XHTML_NS = "http://www.w3.org/1999/xhtml";
+const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
+const XMLNS_NS = "http://www.w3.org/2000/xmlns/";
+const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
+const IMAGE_SPEC = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps";
+const NEWS_SPEC = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap";
+const VIDEO_SPEC = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps";
+const HREFLANG_SPEC = "https://developers.google.com/search/docs/specialty/international/localized-versions";
+const PAGEMAP_XSD = "https://www.google.com/schemas/sitemap-pagemap/1.0/sitemap-pagemap.xsd";
+const IMAGE_XSD = "https://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd";
+const NEWS_XSD = "https://www.google.com/schemas/sitemap-news/0.9/sitemap-news.xsd";
+const VIDEO_XSD = "https://www.google.com/schemas/sitemap-video/1.1/sitemap-video.xsd";
+const DEPRECATED_IMAGE_TAGS = new Set(["caption", "geo_location", "title", "license"]);
+const KNOWN_IMAGE_TAGS = new Set(["image", "loc", ...DEPRECATED_IMAGE_TAGS]);
+const IMAGE_CHILD_ORDER = new Map([["loc", 0], ["caption", 1], ["geo_location", 2], ["title", 3], ["license", 4]]);
+const DEPRECATED_NEWS_TAGS = new Set(["access", "genres", "keywords", "stock_tickers"]);
+const KNOWN_NEWS_TAGS = new Set(["news", "publication", "name", "language", "publication_date", "title", ...DEPRECATED_NEWS_TAGS]);
+const NEWS_CHILD_ORDER = new Map([["publication", 0], ["access", 1], ["genres", 2], ["publication_date", 3], ["title", 4], ["keywords", 5], ["stock_tickers", 6]]);
+const NEWS_PUBLICATION_CHILD_ORDER = new Map([["name", 0], ["language", 1]]);
+const VIDEO_REPEATABLE_TAGS = new Set(["tag", "content_segment_loc", "id", "price"]);
+const DEPRECATED_VIDEO_TAGS = new Set(["category", "content_segment_loc", "gallery_loc", "id", "price", "tvshow"]);
+const DEPRECATED_VIDEO_PLAYER_LOC_ATTRIBUTES = new Set(["autoplay", "allow_embed"]);
+const VIDEO_ID_TYPE_VALUES = new Set(["tms:series", "tms:program", "rovi:series", "rovi:program", "freebase", "url"]);
+const VIDEO_PLATFORM_VALUES = new Set(["web", "mobile", "tv"]);
+const VIDEO_PRICE_TYPE_VALUES = new Set(["purchase", "PURCHASE", "rent", "RENT"]);
+const VIDEO_PRICE_RESOLUTION_VALUES = new Set(["sd", "SD", "hd", "HD"]);
+const VIDEO_TVSHOW_VIDEO_TYPE_VALUES = new Set(["full", "preview", "clip", "interview", "news", "other"]);
+const VIDEO_ALLOWED_PROTOCOLS = ["http:", "https:", "ftp:"];
+const VIDEO_TVSHOW_TAGS = new Set(["show_title", "video_type", "episode_title", "season_number", "episode_number", "premier_date"]);
+const VIDEO_CHILD_ORDER = new Map([
+    ["thumbnail_loc", 0], ["title", 1], ["description", 2], ["content_loc", 3], ["player_loc", 4],
+    ["duration", 5], ["expiration_date", 6], ["rating", 7], ["content_segment_loc", 8], ["view_count", 9],
+    ["publication_date", 10], ["tag", 11], ["category", 12], ["family_friendly", 13], ["restriction", 14],
+    ["gallery_loc", 15], ["price", 16], ["requires_subscription", 17], ["uploader", 18], ["tvshow", 19],
+    ["platform", 20], ["live", 21], ["id", 22],
+]);
+const KNOWN_VIDEO_TAGS = new Set([
+    "video", "thumbnail_loc", "title", "description", "content_loc", "content_segment_loc", "player_loc", "duration",
+    "expiration_date", "rating", "view_count", "publication_date", "family_friendly", "restriction", "platform",
+    "requires_subscription", "uploader", "live", "tag", "id", "show_title", "video_type", "episode_title",
+    "season_number", "episode_number", "premier_date", ...DEPRECATED_VIDEO_TAGS,
+]);
+const KNOWN_PAGEMAP_TAGS = new Set(["PageMap", "Template", "DataObject", "Attribute"]);
+const PAGEMAP_CHILD_ORDER = new Map([["Template", 0], ["DataObject", 1]]);
+export class ExtensionValidator {
+    #limits;
+    #urlActive = false;
+    #imageCount = 0;
+    #newsCount = 0;
+    #newsEntries = 0;
+    #hreflangs = [];
+    #currentImage;
+    #currentNews;
+    #currentVideo;
+    #currentVideoPrice;
+    #currentPageMap;
+    #currentPageMapAttribute;
+    constructor(limits) {
+        this.#limits = limits;
+    }
+    startUrl() {
+        this.#urlActive = true;
+        this.#imageCount = 0;
+        this.#newsCount = 0;
+        this.#hreflangs = [];
+    }
+    finishUrl(loc, path, context) {
+        const alternates = this.#validateHreflangs(loc, path, context);
+        this.#urlActiv
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

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

## X. harden sitemap validation and prepare v1.0.3

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trybyte-app/sitemap-validator. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bd757185`: harden sitemap validation and prepare v1.0.3. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
## 1.0.3 - 2026-08-31

- Fixed foreign-element placement, unexpected character data, invalid sitemap
  locations, date bounds, decimal priority syntax, and Unicode character limits.
- Made sitemap depth limits block incomplete validation, bounded concurrent
  source loading, and preserved cancellation through input and loader completion.
- Corrected local URL-to-file mapping and stopped upstream gzip consumption
  when the decompressed size limit is reached.
- Corrected IPv6 public-address checks, inactive HTML metadata handling, and
  crawler-specific robots directives in live audits.
- Bounded compact CI reports, corrected mixed diagnostic group output, rejected
  incompatible saved-URL options, and handled closed stdout pipes in both CLIs.
- Added optional loader abort signals and diagnostic group variation metadata,
  two blocking diagnostic codes, and 25 regression tests.

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bd757185` are properly handled with clean fallback behavior.

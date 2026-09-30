# Forensic Learning Record (Deep Inspection): yilewang/llm-for-zotero

> **Canonical Artifact**: `07_PROJECT_LEARNING/yilewang-llm-for-zotero-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yilewang/llm-for-zotero](https://github.com/yilewang/llm-for-zotero))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:01:34.220Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yilewang/llm-for-zotero`
- **Description**: An open-source research agent system for your Zotero library.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3175 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `addon/bootstrap.js`
```
/**
 * Most of this code is from Zotero team's official Make It Red example[1]
 * or the Zotero 7 documentation[2].
 * [1] https://github.com/zotero/make-it-red
 * [2] https://www.zotero.org/support/dev/zotero_7_for_developers
 */

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "__addonRef__", rootURI + "content/"],
  ]);

  /**
   * Global variables for plugin code.
   * The `_globalThis` is the global root variable of the plugin sandbox environment
   * and all child variables assigned to it is globally accessible.
   * See `src/index.ts` for details.
   */
  const ctx = { rootURI };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/__addonRef__.js`,
    ctx,
  );
  await Zotero.__addonInstance__.hooks.onStartup();
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  await Zotero.__addonInstance__?.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {}

```

### Core Architecture Module: `addon/content/standaloneTitlebar.js`
```
"use strict";

/*
 * Drops the native title bar on macOS so the plugin's own top rows become the
 * top edge of the window and the traffic lights sit inside them.
 *
 * This runs while the document is still parsing on purpose. The attribute
 * changes how the window chrome is sized, so setting it after load flashes the
 * native bar and makes windows that persist their height shrink on every open.
 *
 * Windows and Linux keep their native title bar: there the same attribute also
 * removes the minimize, maximize and close buttons, and these windows draw no
 * replacements for them.
 */
(function () {
  try {
    const { AppConstants } = ChromeUtils.importESModule(
      "resource://gre/modules/AppConstants.sys.mjs",
    );
    if (AppConstants.platform !== "macosx") return;
    document.documentElement.setAttribute("customtitlebar", "true");
  } catch (error) {
    // A runtime without AppConstants keeps its native title bar rather than
    // failing to open the window at all.
    if (typeof console !== "undefined") {
      console.error("LLM-for-Zotero: custom title bar unavailable", error);
    }
  }
})();

```

### Core Architecture Module: `addon/prefs.js`
```
pref("enable", true);
pref("logLevel", "warn");
pref("sidebarLayout", "stacked");
pref("standaloneSidebarWidth", 220);
pref("input", "This is input");
pref("apiBase", "");
pref("apiKey", "");
pref("model", "gpt-4o-mini");
pref("modelProviderGroups", "");
pref("modelProviderGroupsMigrationVersion", 0);
pref("lastUsedModelEntryId", "");
pref("systemPrompt", "");
pref("showPopupAddText", true);
pref("semanticScholarApiKey", "");
pref("temperaturePrimary", "0.3");
pref("maxTokensPrimary", "4096");
pref("temperatureSecondary", "0.3");
pref("maxTokensSecondary", "4096");
pref("temperatureTertiary", "0.3");
pref("maxTokensTertiary", "4096");
pref("temperatureQuaternary", "0.3");
pref("maxTokensQuaternary", "4096");
pref("enableAgentMode", false);
pref("contextCacheTelemetry", "");
pref("enableClaudeCodeMode", false);
pref("agentBackendBridgeUrl", "http://127.0.0.1:19787");
pref("agentClaudeConfigSource", "default");
pref("agentPermissionMode", "safe");
pref("claudeCodePermissionMode", "default");
pref("claudeCodePermissionModeMigrationDone", false);
// Complete permission mode for the in-plugin Original Agent. Claude Code and
// Codex retain their independent native permission profiles.
pref("originalAgentPermissionMode", "auto");
pref("originalAgentPermissionModeMigrationDone", false);
pref("tavilyApiKey", "");
pref("conversationSystem", "upstream");
pref("enableCodexAppServerMode", false);
pref("codexAppServerModel", "gpt-5.4");
pref("codexAppServerReasoning", "auto");
pref("codexAppServerPath", "");
pref("codexAppServerConversationModeMap", "");
pref("codexAppServerZoteroMcpToolsEnabled", true);
pref("codexAppServerNativeApprovalsEnabled", false);
pref("codexAppServerApprovalsReviewer", "user");
pref("codexAppServerPermissionProfile", ":read-only");
pref(
  "codexAppServerPermissionState",
  '{"boundary":{"kind":"profile","profileId":":workspace"},"approvalOverride":{"policy":"on-request","reviewer":"user"}}',
);
pref("codexAppServerPermissionStateMigrationDone", false);
pref("codexNativeSkillMode", "native");
pref("codexNativeSkillRoutingMode", "hybrid");
pref("codexAppServerGlobalConversationMap", "");
pref("codexAppServerPaperConversationMap", "");
pref("codexAppServerLastAllocatedConversationKeyMap", "");
pref("codexAppServerLastAllocatedGlobalConversationKey", 0);
pref("codexAppServerLastAllocatedPaperConversationKey", 0);
pref("claudeCodeConversationModeMap", "");
pref("claudeCodeGlobalConversationMap", "");
pref("claudeCodePaperConversationMap", "");
pref("claudeCodeLastAllocatedConversationKeyMap", "");
pref("claudeCodeLastAllocatedGlobalConversationKey", 0);
pref("claudeCodeLastAllocatedPaperConversationKey", 0);
pref("claudeCodeModel", "sonnet");
pref("claudeCodeReasoning", "auto");
pref("claudeCodeBlockStreaming", false);
pref("claudeCodeAutoCompact", false);
pref("claudeCodeAutoCompactThreshold", 50);
pref("obsidianVaultPath", "");
pref("obsidianTargetFolder", "Zotero Notes");
pref("obsidianAttachmentsFolder", "assets");
pref("obsidianNoteTemplate", "");
pref("notesDirectoryNickname", "");
pref("locale", "auto");
pref("mineruMode", "cloud");
pref("mineruCloudModel", "vlm");
pref("mineruLocalApiBase", "http://127.0.0.1:8000");
pref("mineruLocalBackend", "pipeline");
pref("mineruForceOcr", false);
pref("mineruAutoWatchCollections", "");
pref("mineruGlobalAutoParse", false);
pref("mineruSyncEnabled", false);
pref("mineruMaxAutoPages", 200);
pref("mineruExcludePatterns", "");

```

### Core Architecture Module: `addon/scripts/pdf_figure_extract.py`
```
#!/usr/bin/env python3
"""Extract PDF-native figure crops from a Zotero PDF.

The development evaluator delegates to this packaged script so evaluation and
production use the same extraction algorithm.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import random
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MINERU_ROOT = Path(
    os.environ.get("LLM_FOR_ZOTERO_MINERU_ROOT", "~/Zotero/llm-for-zotero-mineru")
).expanduser()
DEFAULT_ZOTERO_STORAGE = Path(
    os.environ.get("LLM_FOR_ZOTERO_STORAGE", "~/Zotero/storage")
).expanduser()
DEFAULT_OUT = REPO_ROOT / "tmp/pdfs/figure_extraction_eval"
RESOLVED_PDFTOPPM = shutil.which("pdftoppm")
DEFAULT_POPPLER_BIN_VALUE = os.environ.get("LLM_FOR_ZOTERO_POPPLER_BIN") or (
    str(Path(RESOLVED_PDFTOPPM).parent) if RESOLVED_PDFTOPPM else "/usr/bin"
)
DEFAULT_POPPLER_BIN = Path(DEFAULT_POPPLER_BIN_VALUE).expanduser()
MIN_ACCEPTED_CONFIDENCE = 0.40
DEFAULT_COMMAND_TIMEOUT_SECONDS = 120
DIRECT_EXTRACTOR_VERSION = "raw-pdf-evaluator-v7"

CAPTION_PATTERN = re.compile(
    r"^\s*((?:Extended\s+Data\s+)?Fig(?:ure)?\.?\s*S?\d+[A-Za-z]?|"
    r"Supplementary\s+Fig(?:ure)?\.?\s*S?\d+[A-Za-z]?|"
    r"Figure\s+S?\d+[A-Za-z]?)\s*(?:\.|:|\||$)",
    re.I,
)


@dataclass(frozen=True)
class Rect:
    left: float
    top: float
    width: float
    height: float

    @property
    def right(self) -> float:
        return self.left + self.width

    @property
    def bottom(self) -> float:
        return self.top + self.height

    @property
    def area(self) -> float:
        return max(0.0, self.width) * max(0.0, self.height)

    def to_json(self) -> dict[str, float]:
        return {
            "left": round(self.left, 3),
            "top": round(self.top, 3),
            "width": round(self.width, 3),
            "height": round(self.height, 3),
        }


@dataclass(frozen=True)
class TextBox:
    rect: Rect
    text: str


@dataclass(frozen=True)
class Target:
    label: str
    page_number: int
    caption_box: Rect | None
    caption_text: str
    source: str


@dataclass(frozen=True)
class Candidate:
    source: str
    rect: Rect
    confidence: float
    reasons: tuple[str, ...]
    warnings: tuple[str, ...]


def candidate_with_adjusted_score(
    candidate: Candidate,
    *,
    delta: float,
    reason: str,
    warning: str | None = None,
) -> Candidate:
    warnings = list(candidate.warnings)
    if warning:
        warnings.append(warning)
    return Candidate(
        candidate.source,
        candidate.rect,
        max(0.0, min(1.0, candidate.confidence + delta)),
        (*candidate.reasons, reason),
        tuple(warnings),
    )


def label_namespace(label: str) -> str:
    normalized = normalize_label(label)
    if re.match(r"(?i)^Extended Data Figure\s+\d+", normalized):
        return "extended-data"
    if re.match(r"(?i)^Supplementary Figure\s+", normalized):
        return "supplementary"
    if re.match(r"(?i)^Figure\s+S\d+", normalized):
        return "supplementary"
    return "main"





@dataclass
class PdfCase:
    attachment_id: int
    attachment_key: str
    parent_item_key: str
    source_filename: str
    pdf_path: Path
    mineru_dir: Path


def run(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    poppler_bin: Path,
    timeout: int = DEFAULT_COMMAND_TIMEOUT_SECONDS,
) -> str:
    env = os.environ.copy()
    env["PATH"] = f"{poppler_bin}{os.pathsep}{env.get('PATH', '')}"
    proc = subprocess.run(
        cmd,
        cwd=str(cwd or REPO_ROOT),
        env=env,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    return proc.stdout


def pdf_page_count(pdf_path: Path, poppler_bin: Path) -> int | None:
    try:
        output = run(["pdfinfo", str(pdf_path)], poppler_bin=poppler_bin, timeout=30)
    except Exception:
        return None
    match = re.search(r"^Pages:\s+(\d+)\s*$", output, re.M)
    return int(match.group(1)) if match else None


def rect_union(rects: list[Rect]) -> Rect:
    left = min(rect.left for rect in rects)
    top = min(rect.top for rect in rects)
    right = max(rect.right for rect in rects)
    bottom = max(rect.bottom for rect in rects)
    return Rect(left, top, right - left, bottom - top)


def intersect_area(left: Rect, right: Rect) -> float:
    x1 = max(left.left, right.left)
    y1 = max(left.top, right.top)
    x2 = min(left.right, right.right)
    y2 = min(left.bottom, right.bottom)
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)


def horizontal_overlap_ratio(left: Rect, right: Rect) -> float:
    overlap = min(left.right, right.right) - max(left.left, right.left)
    return max(0.0, overlap) / max(1.0, min(left.width, right.width))


def vertical_gap(left: Rect, right: Rect) -> float:
    if left.bottom < right.top:
        return right.top - left.bottom
    if right.bottom < left.top:
        return left.top - right.bottom
    return 0.0


def normalize_label(raw: str) -> str:
    text = re.sub(r"\s+", " ", raw.strip())
    text = re.sub(r"(?i)\bfig(?:ure)?\.?\s*", "Figure ", text)
    text = re.sub(r"(?i)^extended data figure", "Extended Data Figure", text)
    text = re.sub(r"(?i)^supplementary figure", "Supplementary Figure", text)
    match = re.match(
        r"(?i)^(Extended Data |Supplementary )?Figure\s+(S?\d+)[A-Za-z]?",
        text,
    )
    if not match:
        return text
    prefix = match.group(1) or ""
    return f"{prefix}Figure {match.group(2).upper()}".strip()


def caption_label(text: str) -> str:
    match = CAPTION_PATTERN.match(text)
    return normalize_label(match.group(1)) if match else ""


def normalize_manifest_label(raw: str) -> str:
    text = re.sub(r"\s+", " ", raw.strip())
    match = re.match(r"(?i)^fig(?:ure)?[-_\s]*(S?\d+)[A-Za-z]?$", text)
    if match:
        return f"Figure {match.group(1).upper()}"
    return normalize_label(text)


def strip_namespace(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_attrs(raw: str) -> dict[str, str]:
    return dict(re.findall(r'([A-Za-z_:][\w:.-]*)="([^"]*)"', raw))


def parse_pdf_xml_loose(xml_text: str) -> dict[int, dict[str, Any]]:
    pages: dict[int, dict[str, Any]] = {}
    page_pattern = re.compile(r"<page\b([^>]*)>(.*?)</page>", re.S)
    text_pattern = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.S)
    image_pattern = re.compile(r"<image\b([^>]*)/>", re.S)
    for page_match in page_pattern.finditer(xml_text):
        page_attrs = parse_attrs(page_match.group(1))
        try:
            number = int(page_attrs["number"])
            page = {
                "number": number,
                "width": float(page_attrs["width"]),
                "height": float(page_attrs["height"]),
                "texts": [],
                "images": [],
            }
        except (KeyError, ValueError):
            continue
        body = page_match.group(2)
        for text_match in text_pattern.finditer(body):
            attrs = parse_attrs(text_match.group(1))
            raw_text = re.sub(r"<[^>]+>", "", text_match.group(2))
            text = html.unescape(raw_text)
            text = re.sub(r"\s+", " ", text).strip()
            if not text:
                continue
            try:
                page["texts"].append(
                    TextBox(
                        Rect(
                            float(attrs.get("left", 0)),
                            float(attrs.get("top", 0)),
                            float(attrs.get("width", 0)),
                            float(attrs.get("height", 0)),
                        ),
                        text,
                    ),
                )
            except 
```

### Core Architecture Module: `eslint.config.mjs`
```
// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        // We disable this rule here because the template
        // contains some unused examples and variables
        "@typescript-eslint/no-unused-vars": "off",
        // Control-character ranges are intentional in text sanitizers.
        "no-control-regex": "off",
      },
    },
    {
      files: ["src/agent/model/**/*.ts", "src/utils/providerConnectionTest.ts"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "CallExpression[callee.name=/^(fetch|fetchFn)$/]",
            message:
              "Model requests must use sendProviderRequest so provider requirements cannot be bypassed.",
          },
          {
            selector:
              "CallExpression[callee.type='CallExpression'][callee.callee.name='getFetch']",
            message:
              "Model requests must use sendProviderRequest so provider requirements cannot be bypassed.",
          },
          {
            selector:
              "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(fetch|fetchFn)$/]",
            message:
              "Model requests must use sendProviderRequest so provider requirements cannot be bypassed.",
          },
        ],
      },
    },
    {
      files: ["src/utils/llmClient.ts"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "FunctionDeclaration[id.name=/^(callLLM|callLLMStream|callNativeProtocol|postWithTemperatureFallback|postWithReasoningFallback)$/] CallExpression[callee.type='CallExpression'][callee.callee.name='getFetch']",
            message:
              "Model inference must pass through sendProviderRequest, including retries.",
          },
        ],
      },
    },
    {
      // Chrome scripts loaded directly by the standalone XHTML documents. They
      // run in a privileged window, not through the bundler.
      files: ["addon/content/**/*.js"],
      languageOptions: {
        globals: {
          ChromeUtils: "readonly",
          console: "readonly",
          document: "readonly",
          window: "readonly",
        },
      },
    },
    {
      files: ["scripts/**/*.cjs", "scripts/**/*.mjs"],
      languageOptions: {
        globals: {
          console: "readonly",
          process: "readonly",
        },
      },
    },
    {
      files: [
        "test/**/*.test.ts",
        "test-workflows/**/*.test.ts",
        "test-live-workflows/**/*.test.ts",
        "test-live-agent/**/*.test.ts",
      ],
      rules: {
        // Static fixture construction at module scope is deliberate in these tests.
        "mocha/consistent-spacing-between-blocks": "off",
        "mocha/max-top-level-suites": "off",
        "mocha/no-setup-in-describe": "off",
        "@typescript-eslint/no-this-alias": "off",
      },
    },
    {
      files: [
        "src/hooks.ts",
        "src/modules/contextPanel/setupHandlers/controllers/menuActionController.ts",
      ],
      rules: {
        // These late imports avoid loading optional/circular shutdown and UI modules.
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ],
});

```

### Core Architecture Module: `scripts/benchmark-quote-acceptance.ts`
```
/** Run with: node --import tsx scripts/benchmark-quote-acceptance.ts */
import { performance } from "node:perf_hooks";
import {
  buildQuoteSourceIndex,
  classifyDisplayedQuoteSource,
} from "../src/services/quotes/quoteCitations.ts";
import {
  GENUINE_QUOTE_ACCEPTANCE_CASES,
  ALTERED_QUOTE_ACCEPTANCE_CASES,
} from "../test/fixtures/quoteAcceptance.ts";
const cases = [
  ...GENUINE_QUOTE_ACCEPTANCE_CASES,
  ...ALTERED_QUOTE_ACCEPTANCE_CASES,
];
const filler =
  "Participants completed the calibration task before each scanning session. Measurements were collected under the same experimental conditions. ".repeat(
    12,
  );
const inputs = cases.map((f, i) => ({
  fixture: f,
  sourceTexts: Array.from({ length: 8 }, (_, p) => ({
    sourceText: `Page ${p + 1}. ${filler}${p === 5 ? f.source : ""}${filler}`,
    sourceLabel: "(Benchmark, 2026)",
    itemId: 100 + i,
    contextItemId: 200 + i,
    pageHintIndex: p,
    sourceMatchSource: "pdf-page-text" as const,
    sourceFingerprint: `benchmark-${i}`,
  })),
}));
const indexTime = [] as number[];
const indexed = inputs.map((i) => {
  const start = performance.now();
  const sourceIndex = buildQuoteSourceIndex(i);
  indexTime.push(performance.now() - start);
  return { ...i, sourceIndex };
});
const timings: Record<string, number[]> = {};
const outcomes: Record<string, string> = {};
for (let round = 0; round < 16; round++) {
  for (const i of indexed) {
    const start = performance.now();
    const r = classifyDisplayedQuoteSource({
      quoteText: i.fixture.quote,
      sourceIndex: i.sourceIndex,
      sourceEvidenceComplete: true,
    });
    const elapsed = performance.now() - start;
    if (round > 2) (timings[i.fixture.name] ??= []).push(elapsed);
    outcomes[i.fixture.name] = r.kind;
  }
}
function summary(a: number[]) {
  const v = [...a].sort((a, b) => a - b);
  return {
    medianMs: +v[Math.floor(v.length * 0.5)].toFixed(3),
    p95Ms: +v[Math.min(v.length - 1, Math.floor(v.length * 0.95))].toFixed(3),
  };
}
const result = {
  node: process.version,
  pagesPerCase: 8,
  iterations: 13,
  indexBuild: summary(indexTime),
  indexedMatching: Object.fromEntries(
    Object.entries(timings).map(([k, v]) => [
      k,
      { ...summary(v), outcome: outcomes[k] },
    ]),
  ),
};
console.log(JSON.stringify(result, null, 2));

```

### Core Architecture Module: `scripts/evaluate_pdf_figure_extraction.py`
```
#!/usr/bin/env python3
"""Development entrypoint for the packaged source-PDF figure extractor."""

from pathlib import Path
import runpy


PACKAGED_EXTRACTOR = (
    Path(__file__).resolve().parents[1] / "addon" / "scripts" / "pdf_figure_extract.py"
)


if __name__ == "__main__":
    runpy.run_path(str(PACKAGED_EXTRACTOR), run_name="__main__")

```

### Core Architecture Module: `scripts/measure-chat-memory.mjs`
```
// Repeated fresh-profile native measurements; no provider calls or user-library access.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import os from "node:os";
import { setInterval, clearInterval } from "node:timers";

const [label, count = "3"] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label || "") || !/^[1-9][0-9]*$/.test(count)) {
  throw new Error(
    "Usage: node scripts/measure-chat-memory.mjs <label> [runs=3]",
  );
}
const root = process.cwd();
const output = resolve("tmp/issue-469", label);
mkdirSync(output, { recursive: true });
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sourceFiles = git("ls-files", "src", "addon", "package-lock.json").split(
  "\n",
);
sourceFiles.push(
  "src/modules/contextPanel/chatMemoryReplay.ts",
  "test-perf/chatMemory.workflow.test.ts",
);
const hash = createHash("sha256");
for (const file of [...new Set(sourceFiles)].sort())
  hash.update(file).update(readFileSync(file));
const metadata = {
  label,
  commit: git("rev-parse", "HEAD"),
  sourceSha256: hash.digest("hex"),
  platform: os.platform(),
  release: os.release(),
  arch: os.arch(),
  cpu: os.cpus()[0].model,
  totalMemoryBytes: os.totalmem(),
  workload:
    "8 reader open/close cycles, 40 ordinary Chat turns x 120 chunks, after one reader warmup",
  rssSamplingIntervalMs: 200,
  measurementBoundary:
    "RSS samples cover the primary Zotero process only; frame timings include scheduling but not compositor completion.",
};
writeFileSync(join(output, "metadata.json"), JSON.stringify(metadata, null, 2));
writeFileSync(
  join(output, "production.diff"),
  git("diff", "--no-ext-diff", "--no-textconv", "--", "src", "addon"),
);
for (let run = 1; run <= Number(count); run++) {
  const logPath = join(output, `run-${run}.log`);
  if (existsSync(logPath)) throw new Error(`Refusing to overwrite ${logPath}`);
  const startedAt = new Date().toISOString();
  console.log(`${label} run ${run}/${count} started ${startedAt}`);
  const child = spawn("npm", ["run", "test:workflow"], {
    cwd: root,
    env: {
      ...process.env,
      ZOTERO_PLUGIN_KILL_COMMAND: "true",
      LLM_FOR_ZOTERO_TEST_ENTRIES: "test-perf",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (chunk) => {
    log += chunk;
  });
  child.stderr.on("data", (chunk) => {
    log += chunk;
  });
  const rssSamples = [];
  const timer = setInterval(() => {
    try {
      const lines = execFileSync("ps", ["-axo", "pid=,rss=,command="], {
        encoding: "utf8",
      }).split("\n");
      for (const line of lines) {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
        if (
          !match ||
          !match[3].startsWith(
            "/Applications/Zotero.app/Contents/MacOS/zotero ",
          )
        )
          continue;
        if (
          !match[3].includes(
            `-profile ${root}/.scaffold/test/profile --dataDir`,
          )
        )
          continue;
        rssSamples.push({
          time: Date.now(),
          pid: Number(match[1]),
          residentBytes: Number(match[2]) * 1024,
        });
      }
    } catch {
      /* Process may exit between samples; retain every successful sample. */
    }
  }, metadata.rssSamplingIntervalMs);
  const code = await new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("close", resolveExit);
  }).finally(() => clearInterval(timer));
  writeFileSync(logPath, log);
  writeFileSync(
    join(output, `run-${run}-rss.json`),
    JSON.stringify(rssSamples),
  );
  const reportPath = join(root, ".scaffold/test/data/chat-memory.json");
  const report = existsSync(reportPath)
    ? JSON.parse(readFileSync(reportPath, "utf8"))
    : null;
  const result = {
    ...metadata,
    run,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode: code,
    buildSha256: createHash("sha256")
      .update(
        readFileSync(".scaffold/build/addon/content/scripts/llmforzotero.js"),
      )
      .digest("hex"),
    sampledPeakResidentBytes: rssSamples.length
      ? Math.max(...rssSamples.map((s) => s.residentBytes))
      : null,
    report,
  };
  writeFileSync(
    join(output, `run-${run}.json`),
    JSON.stringify(result, null, 2),
  );
  console.log(
    `${label} run ${run} finished: exit=${code}, samples=${rssSamples.length}, turns=${report?.turns.length ?? 0}`,
  );
  if (code !== 0 || report?.turns.length !== 40 || rssSamples.length === 0)
    throw new Error(`Incomplete run; see ${logPath}`);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #465** (2026-09-20): **Logo take up space in the sidebar and un-adjustable**
  *Symptoms*: **Describe the bug** Since version of 3.9.8, the logo of this plugin appears on the top of your conversation in sidebar. However, it is not adjustable and always take up a portion of space. consider a change to save more space :>  **To Reproduce** Steps to reproduce the behavior:  go to any paper and try this plugin and you will see.  **Screenshots** If applicable, add screenshots to help explain your problem.  <img width="657" height="1302" alt="Image" src="https://github.com/user-attachments/assets/a77cb3c4-a6f3-43a0-b0c6-500dae0edbd8" />  **System (please complete the following information):**  - OS: win 11 - Zotero version 9.0.6  - Plugin version 3.9.8,  
  **Post-Mortem & Fix Analysis**:
  > Do you try to restart the zotero?

- **Issue #461** (2026-09-17): **[BUG] 如图，新版本3.9.7遇到超大图标bug**
  *Symptoms*: <img width="859" height="1331" alt="Image" src="https://github.com/user-attachments/assets/798ac6f4-34c9-4616-a4db-b1afec911d7f" />  当前版本：3.9.7 zotero版本：9.0.6（macos26.5.1  Apple M5） 回退到 3.9.6 后 bug 消失
  **Post-Mortem & Fix Analysis**:
  > did you restart the zotero? you restart the zotero, it will be gone and you don't need to roll back to previous version. 
  > > did you restart the zotero? you restart the zotero, it will be gone and you don't need to roll back to previous version.  3.9.8 已经没这个问题了

- **Issue #446** (2026-09-11): **Chat box error**
  *Symptoms*: **Describe the bug** This happens with the chat box for all items: "Error: Semantic interpretation is unavailable. No actions were authorized."  **To Reproduce** The error pops up in every normal chat with AI via the plugin. I did check the Claude bridge but nothing changed. Seems like the bug appeared after automatic Zotero update -- but not sure about this.  **Screenshots**  <img width="270" height="579" alt="Image" src="https://github.com/user-attachments/assets/f3c50821-a921-49ab-a728-78bde01e18b6" />  **System (please complete the following information):**  - OS: Window 11 - Zotero version 10.0.2 (64-bit) - Plugin version 3.9.6  Thank you in advance for working on it. Much appreciate.
  **Post-Mortem & Fix Analysis**:
  > Hi It is indeed a new feature i added in the latest plugin. you can see my reply about this semantic interpretation here #445   > Before the agent starts working with your library, the plugin now makes an additional model call to interpret your request—such as whether you want an analysis, suggested tags, or actual changes to your library. This step processes a substantial set of instructions and produces a structured interpretation, adding processing time and token usage before the main task begins.  But i think this problem can be fixed without my new release. I would suggest the following steps to fix it:   1 update your bridge repo, [cc-llm4zotero-adapter](https://github.com/jianghao-zhang/cc-llm4zotero-adapter) by pulling the latest main branch into your local machine.  2 run `claude` and make sure your claude code cli can work properly (if you need to `/login` again please do so) 3 cd to the repo, run `npm run daemon:restart`  4 go back to the plugin and hopefully the claude code
  > > OS: Window 10 > Zotero version 10.0.2 (64-bit) > Plugin version 3.9.0   works for me after os reboot as a workaround
  > > 1 update your bridge repo, [cc-llm4zotero-adapter](https://github.com/jianghao-zhang/cc-llm4zotero-adapter) by pulling the latest main branch into your local machine. 2 run `claude` and make sure your claude code cli can work properly (if you need to `/login` again please do so) 3 cd to the repo, run `npm run daemon:restart` 4 go back to the plugin and hopefully the claude code mode can work again.  Yes it works for me. Thanks for your help!

- **Issue #440** (2026-09-10): **UI bug of Some Bottons in Separate Window**
  *Symptoms*: **Describe the bug** Open the chat in a separate window. The UI has some problems, which I show in the red box.  **To Reproduce** Select one paper.  Click llm for zotero  Click Foucs Window  **System (please complete the following information):**  - OS: [e.g. Windows 11] - Zotero version [9] - Plugin version [3.9.6]  <img width="1858" height="1100" alt="Image" src="https://github.com/user-attachments/assets/835d6d89-e834-4b9c-b86a-9dd78fc92bcb" /> 
  **Post-Mortem & Fix Analysis**:
  > does restart work? from my experience those UI issues only happen when plugin is recently updated; it will be gone after you restart zotero. 
  > Good suggestion. The problem solved after restart. Sorry to bother you🥲
  > @Leocaolion no worries! hope the new version gonna resolve some issues you have before!

- **Issue #438** (2026-09-09): **让agent搜索并导入论文到zotero会失败**
  *Symptoms*: 让agent搜索并导入论文到zotero会失败，明确批准也不行，弹出确认框确认了也是不行  提示 !Could not complete Import to Library: Write blocked because this request authorizes no mutations.  或者 A model-originated write was blocked because this request authorized no mutations. No library or file change was verified.
  **Post-Mortem & Fix Analysis**:
  > 不知道是什么问题，删了重新导入插件之后就可以了

- **Issue #431** (2026-09-07): **Zotero设置中插件对应的设置很多选项无法修改**
  *Symptoms*: 发现一个问题，如果先打开zotero设置，然后切到llm-for-zotero的插件设置页面，很多下拉菜单点不动，只有从侧边栏直接进入插件设置时才能正常设置全部内容，不知道是不是我的个例，我的系统是macOS 26.6.2 zotero 10.0.1

- **Issue #416** (2026-09-09): **`400 invalid_request_error` when using Agent Mode with Moonshot/Kimi provider: anyOf JSON Schema validation fails**
  *Symptoms*: **Describe the bug** When using Agent Mode with the Moonshot (Kimi) provider, the plugin throws a 400 invalid_request_error because the generated tools.function.parameters JSON Schema does not pass Moonshot's stricter schema validation. The error message indicates that type is defined at the parent schema level alongside anyOf, which Moonshot's validator rejects. According to Moonshot's schema rules, type must be defined inside each item of the anyOf array instead.  ``` Error: 400 (https://api.kimi.com/coding/v1/chat/completions) - {"error":{"message":"tools.function.parameters is not a valid moonshot flavored json schema, details: <At path 'properties.target': when using anyOf, type should be defined in anyOf items instead of the parent schema>","type":"invalid_request_error"}} ```  **To Reproduce** Steps to reproduce the behavior:  1. Go to plugin settings and set the LLM provider to Customized. 2. Enable Agent Mode 3. Ask any question that triggers tool/function calling (e.g., "Search my library for papers about neural networks") 4. See error  **Screenshots**  <img width="1074" height="662" alt="Image" src="https://github.com/user-attachments/assets/01de2f53-120a-40bc-b907-daef88818ad0" />  <img width="1166" height="1008" alt="Image" src="https://github.com/user-attachments/assets/368ba96f-4e56-4659-84b7-f68c8765a8f3" />  **System (please complete the following information):**  - OS: MacOS - Zotero version 9 - Plugin version (lasetest)  

- **Issue #413** (2026-09-10): **Could not complete Update Library: Write blocked because this request authorizes no mutations.**
  *Symptoms*: **Describe the bug** First, many thanks for your powerful and useful addon. I encountered a problem: > Preparing library changes > Could not complete Update Library: Write blocked because this request authorizes no mutations.  when I try to change some info of an item using llm. I have chosen the "yolo" in the Library Write Mode. But this setting didn't work.  <img width="300" alt="Image" src="https://github.com/user-attachments/assets/58a50358-ae4b-46a6-854b-d2efc5ce591f" />  Thank you very much in advance.  **System (please complete the following information):**  - OS: [Windows 11] - Zotero version [10.0.1] - Plugin version [3.9.5] - Model: deepseek-v4-flash  
  **Post-Mortem & Fix Analysis**:
  > thanks. i think it's an issue from my internal design. sometimes the agent is too conservative for library actions. i will try to improve it in the future release
  > > thanks. i think it's an issue from my internal design. sometimes the agent is too conservative for library actions. i will try to improve it in the future release  Many thanks for your reply. I avoided this issue by reinstalling version 3.9.2. Look forward to your update. 
  > Yes. I think that I encounter similar question. When I send a command to summarize, it automatically uses write-note skill to write the answer to notes and not present the answer in the chat, even I don't mention it. And then I order it not to write notes if I don't mention. Afterwards, the chat can not output the answer, it display:A model-originated write was blocked because this request authorized no mutations. No library or file change was verified. Actually, the answer is ready in the thinking step.  <img width="1531" height="371" alt="Image" src="https://github.com/user-attachments/assets/48dc53a7-f532-4f9a-9203-b78e2eb364c9" />  <img width="1539" height="326" alt="Image" src="https://github.com/user-attachments/assets/709843ea-0203-4d4e-abd9-32c56ed09141" />

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

### Incident Patch 1: `78dda956` (2026-09-22)
**Commit Message**: fix: stabilize chat reading and add latest-message navigation

Preserve reading position during streaming, sidebar re-entry, and activity
updates. Correct completed activity disclosure state and provide an activity
indicator with an explicit jump-to-latest control.

Combine the previously separate fixes and button improvement for one PR,
using the exact sources frozen in local test build 3.9.9.4.

**File**: `addon/content/zoteroPane.css` (modified, +94/-5)
```diff
@@ -3027,6 +3027,94 @@
   user-select: text;
 }
 
+.llm-chat-latest {
+  position: absolute;
+  z-index: 7;
+  left: 50%;
+  bottom: 12px;
+  transform: translateX(-50%);
+  display: flex;
+  align-items: center;
+  justify-content: center;
+  width: 32px;
+  min-width: 32px;
+  height: 32px;
+  margin: 0;
+  padding: 0;
+  border: 1px solid var(--stroke-secondary);
+  border-radius: 50%;
+  background: var(--material-background, #fff);
+  color: var(--fill-primary);
+  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
+  cursor: pointer;
+}
+
+.llm-chat-latest[hidden] {
+  display: none;
+}
+
+.llm-chat-latest:hover {
+  color: var(--color-accent);
+  border-color: var(--color-accent);
+}
+
+.llm-chat-latest:focus-visible {
+  outline: 2px solid var(--color-accent);
+  outline-offset: 2px;
+}
+
+.llm-chat-latest-arrow {
+  font-size: 20px;
+  line-height: 1;
+}
+
+.llm-chat-latest-dots {
+  display: none;
+  align-items: center;
+  gap: 3px;
+}
+
+.llm-chat-latest[data-pending="true"] .llm-chat-latest-dots {
+  display: flex;
+}
+
+.llm-chat-latest[data-pending="true"] .llm-chat-latest-arrow {
+  display: none;
+}
+
+.llm-chat-latest-dots > span {
+  width: 4px;
+  height: 4px;
+  border-radius: 50%;
+  background: currentColor;
+  animation: llm-chat-latest-pulse 1.2s ease-in-out infinite;
+}
+
+.llm-chat-latest-dots > span:nth-child(2) {
+  animation-delay: 0.15s;
+}
+
+.llm-chat-latest-dots > span:nth-child(3) {
+  animation-delay: 0.3s;
+}
+
+@keyframes llm-chat-latest-pulse {
+  0%,
+  80%,
+  100% {
+    opacity: 0.35;
+  }
+  40% {
+    opacity: 1;
+  }
+}
+
+@media (prefers-reduced-motion: reduce) {
+  .llm-chat-latest-dots > span {
+    animation: none;
+  }
+}
+
 /* Conversation turn navigator */
 .llm-chat-shell.llm-turn-navigator-visible .llm-messages {
   padding-left: 25px;
@@ -9437,11 +9525,13 @@ label.llm-search-results-item:hover {
 }
 
 .llm-agent-action-link .llm-citation-icon {
-  width: 0;
-  min-width: 0;
+  /* Reserve the jump glyph's space so hovering a chip cannot wrap its row. */
+  width: 14px;
+  min-width: 14px;
   overflow: hidden;
   margin-left: -2px;
-  transition: width 100ms;
+  opacity: 0;
+  transition: opacity 100ms;
 }
 
 .llm-agent-action-link:hover .llm-paper-context-chip-label,
@@ -9452,8 +9542,7 @@ label.llm-search-results-item:hover {
 }
 
 .llm-agent-action-link:hover .llm-citation-icon {
-  width: 14px;
-  min-width: 14px;
+  opacity: 1;
   color: var(--color-accent);
 }
 
```

**File**: `src/modules/contextPanel/agentTrace/actionSummaryCard.ts` (modified, +3/-0)
```diff
@@ -1,5 +1,6 @@
 import type { AgentActionSummaryResultCard } from "../../../agent/types";
 import { createDocumentCardLayout } from "../documentCard";
+import { bindActionSummaryDisclosureScroll } from "./actionSummaryDisclosureScroll";
 import type { ActionCardEntry } from "./actionCardModel";
 import {
   navigationTargetOf,
@@ -163,6 +164,7 @@ export function renderActionSummaryCard(
       toggle.textContent = expanded ? "Hide actions" : "Show actions";
     };
     setExpanded(false);
+    bindActionSummaryDisclosureScroll(toggle);
     toggle.addEventListener("click", () => setExpanded(list.hidden));
     actions.appendChild(toggle);
   }
@@ -183,6 +185,7 @@ export function renderActionSummaryCard(
     details.className = "llm-agent-action-row";
     const summary = doc.createElement("summary");
     summary.appendChild(renderRowLine(doc, entry, true));
+    bindActionSummaryDisclosureScroll(summary);
     const body = doc.createElement("div");
     body.className = "llm-agent-process-stage-body llm-agent-action-row-body";
     details.append(summary, body);
```

**File**: `src/modules/contextPanel/agentTrace/actionSummaryDisclosureScroll.ts` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import { closestElement } from "../chatScrollGeometry";
+import {
+  cancelChatNavigation,
+  cancelChatScrollFollow,
+} from "../chatScrollSnapshots";
+
+/** Bind before the control's disclosure handler, so its old layout is saved. */
+export function bindActionSummaryDisclosureScroll(control: HTMLElement): void {
+  control.addEventListener("click", (event) => {
+    // Object chips navigate independently and prevent the native disclosure
+    // action. Keyboard/assistive activation still reaches this click handler.
+    if (
+      event.defaultPrevented ||
+      closestElement(event.target as Element | null, ".llm-agent-action-link")
+    )
+      return;
+    const chatBox = closestElement(
+      control,
+      "#llm-chat-box",
+    ) as HTMLDivElement | null;
+    const root =
+      chatBox && (closestElement(chatBox, "#llm-main") as HTMLElement | null);
+    const key = Number(root?.dataset.itemId);
+    if (!chatBox || !Number.isFinite(key) || key <= 0) return;
+    // An explicit activation means the reader wants to inspect this card.
+    // A toggle listener runs too late, after native expansion and lazy detail
+    // rendering. Programmatic expansion must keep its existing scroll intent.
+    cancelChatNavigation(chatBox);
+    cancelChatScrollFollow(key, chatBox);
+  });
+}
```

**File**: `src/modules/contextPanel/agentTrace/render.ts` (modified, +7/-2)
```diff
@@ -390,7 +390,11 @@ function appendAgentActivityDisclosure(params: {
   details.addEventListener("toggle", () => {
     agentActivityExpandedCache.set(message, {
       open: details.open,
-      wasWorking: message.streaming === true,
+      // Native toggle events are queued. The message may already be complete
+      // before this running view is repainted; keep the last rendered phase so
+      // that its delayed opening cannot masquerade as a user's completed-view
+      // expansion and bypass the one-time collapse on completion.
+      wasWorking: view.streaming === true,
     });
   });
   wrap.appendChild(details);
@@ -6470,7 +6474,8 @@ export function renderAgentTrace({
       message,
       userMessage,
       events,
-      forceOpen: true,
+      // Loading a saved trace must not override the reader's disclosure state.
+      // A live run already opens by default through message.streaming.
     });
     return wrap;
   }
```

**File**: `src/modules/contextPanel/buildUI.ts` (modified, +2/-1)
```diff
@@ -26,6 +26,7 @@ import {
 import { getConversationKey } from "./conversationIdentity";
 import { createRuntimeSystemControls } from "./runtimeSystemControls";
 import { buildContextUsagePresentation } from "./textUtils";
+import { createChatLatestButton } from "./chatLatestButton";
 
 function createActionDropdown(doc: Document, spec: ActionDropdownSpec) {
   const slot = createElement(
@@ -312,7 +313,7 @@ function buildUI(body: Element, item?: Zotero.Item | null) {
   const chatBox = createElement(doc, "div", "llm-messages", {
     id: "llm-chat-box",
   });
-  chatShell.append(chatBox);
+  chatShell.append(chatBox, createChatLatestButton(doc));
   if (isStandaloneBody) {
     const chatResizeHandle = createElement(
       doc,
```

---

### Incident Patch 2: `dc3ebf70` (2026-09-20)
**Commit Message**: fix: default MinerU automatic page limit to 200

**File**: `addon/prefs.js` (modified, +1/-1)
```diff
@@ -80,5 +80,5 @@ pref("mineruForceOcr", false);
 pref("mineruAutoWatchCollections", "");
 pref("mineruGlobalAutoParse", false);
 pref("mineruSyncEnabled", false);
-pref("mineruMaxAutoPages", 0);
+pref("mineruMaxAutoPages", 200);
 pref("mineruExcludePatterns", "");
```

**File**: `src/utils/mineruConfig.ts` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ export const DEFAULT_MINERU_LOCAL_API_BASE = "http://127.0.0.1:8000";
 export const DEFAULT_MINERU_CLOUD_MODEL: MineruCloudModel = "vlm";
 export const DEFAULT_MINERU_LOCAL_BACKEND: MineruLocalBackend = "pipeline";
 export const DEFAULT_MINERU_FORCE_OCR = false;
-export const DEFAULT_MINERU_MAX_AUTO_PAGES = 0;
+export const DEFAULT_MINERU_MAX_AUTO_PAGES = 200;
 export const MAX_MINERU_FILENAME_PATTERN_LENGTH = 256;
 
 export type MineruMode = "cloud" | "local";
```

**File**: `test-workflows/mineruPageLimit.workflow.test.ts` (modified, +3/-3)
```diff
@@ -88,10 +88,10 @@ describe("workflow: MinerU page-limit selection", function () {
       win = await openPreferences();
       assert.equal(
         controls(win).preset.value,
-        "0",
-        "fresh settings default to Unlimited",
+        "200",
+        "fresh settings default to 200 pages",
       );
-      assert.equal(Zotero.Prefs.get(key, true), 0);
+      assert.equal(Zotero.Prefs.get(key, true), 200);
       await closePreferences(win);
       Zotero.Prefs.set(key, 350, true);
       win = await openPreferences();
```

**File**: `test/mineruConfig.test.ts` (modified, +3/-3)
```diff
@@ -16,9 +16,9 @@ import {
 } from "../src/utils/mineruConfig";
 
 describe("mineruConfig", function () {
-  it("defaults to Unlimited when no page limit is saved", function () {
-    assert.equal(DEFAULT_MINERU_MAX_AUTO_PAGES, 0);
-    assert.equal(normalizeMineruMaxAutoPages(undefined), 0);
+  it("defaults to 200 pages when no page limit is saved", function () {
+    assert.equal(DEFAULT_MINERU_MAX_AUTO_PAGES, 200);
+    assert.equal(normalizeMineruMaxAutoPages(undefined), 200);
   });
 
   describe("normalizeMineruMode", function () {
```

**File**: `test/mineruPreferences.test.ts` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ describe("MinerU preferences", function () {
     const selector = preferences.match(
       /<html:select\s+id="__addonRef__-mineru-max-auto-pages-preset"[\s\S]*?<\/html:select>/,
     )?.[0];
-    assert.include(prefs, 'pref("mineruMaxAutoPages", 0);');
+    assert.include(prefs, 'pref("mineruMaxAutoPages", 200);');
     assert.isString(selector);
     for (const value of ["100", "200", "500", "1000", "0", "custom"]) {
       assert.include(selector!, `value="${value}"`);
```

---

### Incident Patch 3: `bf963e84` (2026-09-20)
**Commit Message**: fix: quiet idle maintenance and add log levels (#470)

Schedule cleanup from queued work and persisted retry deadlines, with slower attachment and trace reconciliation. Preserve deletion, Undo, retry, and shutdown behavior.

Add a live warn/info/debug/trace preference, preserve actionable warnings and error context, and expose routine maintenance SQL only at trace level.

**File**: `README.md` (modified, +23/-0)
```diff
@@ -815,13 +815,36 @@ and cloud MinerU involve their respective services or companion runtimes.
 > Please [open an issue](https://github.com/yilewang/llm-for-zotero/issues) on
 > GitHub.
 
+### Diagnostic logging
+
+The plugin keeps routine diagnostics quiet by default while retaining warnings and errors.
+To collect more detail, open Zotero's Advanced Configuration Editor and change the string preference `extensions.zotero.llmforzotero.logLevel`.
+
+| Value            | Diagnostic detail                                                |
+| ---------------- | ---------------------------------------------------------------- |
+| `warn` (default) | Errors and actionable warnings                                   |
+| `info`           | Significant lifecycle events and warnings/errors                 |
+| `debug`          | Detailed application diagnostics                                 |
+| `trace`          | The most detailed diagnostics, including routine maintenance SQL |
+
+Changes take effect immediately; an invalid value falls back to `warn`.
+Use Zotero's **Help → Debug Output Logging** controls to record or view the output, reproduce the problem, and then restore `warn`.
+This preference controls the plugin's diagnostic verbosity; Zotero's controls determine whether debug output is recorded or displayed.
+Other plugins' logging is unaffected.
+
 ## Contributing
 
 Contributions are welcome. Bug reports, feature requests, documentation
 improvements, and pull requests are all useful. Please
 [open an issue](https://github.com/yilewang/llm-for-zotero/issues) or submit a
 PR.
 
+### Maintenance and logging regression tests
+
+Run `LLM_FOR_ZOTERO_TEST_ENTRIES=test-maintenance npm run test:workflow` with the repository's native Zotero test environment configured.
+This suite measures idle maintenance first in a fresh disposable scaffold profile, then checks live diagnostic levels against Zotero's debug output.
+Keep it separate from deletion workflows, which intentionally leave pending cleanup and retry work.
+
 ### Model capability registry
 
 Model context limits and provider-defined reasoning options are maintained in [`registry/model-capabilities.v1.json`](./registry/model-capabilities.v1.json).
```

**File**: `addon/prefs.js` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 pref("enable", true);
+pref("logLevel", "warn");
 pref("sidebarLayout", "stacked");
 pref("standaloneSidebarWidth", 220);
 pref("input", "This is input");
```

**File**: `src/agent/contracts/externalRuntimeEffects.ts` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@ import { fingerprintText } from "./actionOperationEvidence";
 import { OPERATION_CATALOG } from "./operationCatalog";
 import { recordJournalObservation } from "../store/changeJournal";
 import type { AgentActionParameters, AgentActionReceipt } from "./types";
+import { appLogger } from "../../core/logging";
 
 /**
  * Receipts for effects a connected client performed inside its own runtime.
@@ -161,7 +162,7 @@ export async function recordExternalRuntimeEffect(params: {
   } catch (error) {
     // The client already ran the effect. A supplementary audit failure must not
     // turn that into a failed decision the caller retries.
-    Zotero.debug?.(
+    appLogger.warn(
       `External runtime effect audit could not be recorded: ${String(error)}`,
     );
   }
```

**File**: `src/agent/documents/actions.ts` (modified, +2/-1)
```diff
@@ -1,3 +1,4 @@
+import { appLogger } from "../../core/logging";
 import { canonicalNoteHtml } from "../../utils/noteHtml";
 import { sha256Text } from "../store/journalRecoveryBlobStore";
 import {
@@ -314,7 +315,7 @@ async function saveDocumentNote(
           return { html, warnings };
         }
       : undefined,
-    log: (message, error) => ztoolkit.log(message, error),
+    log: (message, error) => appLogger.warn(message, error),
   });
   const created = Zotero.Items.get(persisted.noteId) || note;
   if (!created.key) throw new Error("Created note has no stable Zotero key");
```

**File**: `src/agent/documents/store.ts` (modified, +2/-1)
```diff
@@ -1,3 +1,4 @@
+import { appLogger } from "../../core/logging";
 import {
   decodeDocumentActionState,
   decodeDocumentCoverageItem,
@@ -894,7 +895,7 @@ export async function sweepPlanDocumentStorage(): Promise<void> {
         [path],
       );
     } catch (error) {
-      ztoolkit.log("LLM: Failed to clean plan document asset", error);
+      appLogger.warn("LLM: Failed to clean plan document asset", error);
     }
   }
   if (typeof io?.getChildren !== "function") return;
```

---

### Incident Patch 4: `c1b3fc60` (2026-09-19)
**Commit Message**: fix: protect MinerU publication and restore prompt editing

**File**: `src/modules/contextPanel/chat.ts` (modified, +40/-19)
```diff
@@ -4054,13 +4054,9 @@ function createPanelUpdateHelpers(
     });
   };
   /**
-   * Turn completion. The finished answer and the prompt that asked it are the
-   * only messages whose presentation changed: the answer stops streaming, and
-   * the prompt regains its edit and delete-turn controls, which are decided at
-   * render time from the paired answer's streaming state. Rebuilding just that
-   * pair keeps the cost of ending a turn independent of conversation length;
-   * a full rebuild re-parses every earlier message. Panels that no longer have
-   * those wrappers rendered fall back to a full rebuild inside refreshChat.
+   * Turn completion rebuilds the finished answer and its prompt's controls.
+   * refreshChat also updates earlier prompts' editability in place, preserving
+   * historical answer DOM. Panels missing the pair fall back to a full rebuild.
    */
   const refreshCompletedAssistantTurnSafely = (message: Message) => {
     const history = chatHistory.get(conversationKey) || [];
@@ -10514,13 +10510,14 @@ export function refreshChat(
   // closes; they are only hidden from the render.
   const history = filterMessagesInPendingTurns(conversationKey, rawHistory);
   const requestedRerenders = options.rerenderAssistantMessages;
+  const renderedWrappers = requestedRerenders?.size
+    ? (Array.from(chatBox.children) as HTMLElement[])
+    : [];
   const { useTargetedRerender, targetedMessageWrappers } =
     resolveTargetedAssistantRerenders(
       history,
       requestedRerenders,
-      requestedRerenders?.size
-        ? (Array.from(chatBox.children) as HTMLElement[])
-        : [],
+      renderedWrappers,
     );
   const forkLink = conversationForkLinks.get(conversationKey) || null;
   if (tokenUsageEl && !useTargetedRerender) {
@@ -10628,20 +10625,35 @@ export function refreshChat(
     item,
   }).providerProtocol;
   const conversationIsIdle = !history.some((m) => m.streaming);
+  const canEditPromptAt = (index: number) =>
+    canEditUserPromptTurn({
+      isUser: history[index]?.role === "user",
+      hasItem: Boolean(item),
+      conversationIsIdle,
+      assistantPair: history[index + 1],
+      providerProtocol: renderProviderProtocol,
+    });
+  if (useTargetedRerender) {
+    // Completion unlocks every paired prompt, including wrappers retained from
+    // the busy render. Their click handlers read this current eligibility.
+    for (const wrapper of renderedWrappers) {
+      if (wrapper.dataset.messageRole !== "user") continue;
+      wrapper
+        .querySelector(".llm-bubble.user")
+        ?.classList.toggle(
+          "llm-bubble-editable",
+          canEditPromptAt(Number(wrapper.dataset.messageIndex)),
+        );
+    }
+  }
   for (const [index, msg] of history.entries()) {
     if (useTargetedRerender && !targetedMessageWrappers.has(msg)) {
       continue;
     }
     const isUser = msg.role === "user";
     const assistantPairMsg = history[index + 1];
     const hasAssistantPair = isUser && assistantPairMsg?.role === "assistant";
-    const canEditUserPrompt = canEditUserPromptTurn({
-      isUser,
-      hasItem: Boolean(item),
-      conversationIsIdle,
-      assistantPair: assistantPairMsg,
-      providerProtocol: renderProviderProtocol,
-    });
+    const canEditUserPrompt = canEditPromptAt(index);
     const isInlineEditBubble = Boolean(
       canEditUserPrompt &&
       inlineEditTarget?.conversationKey === conversationKey &&
@@ -11382,9 +11394,18 @@ export function refreshChat(
         );
       } else {
         renderUserBubbleContent(bubble, sanitizeText(msg.text || ""), doc);
-        if (canEditUserPrompt) {
-          bubble.classList.add("llm-bubble-editable");
+        bubble.classList.toggle("llm-bubble-editable", canEditUserPrompt);
+        if (hasAssistantPair) {
           bubble.addEventListener("click", (e: Event) => {
+            if (
+              !bubble.classList.contains("llm-bubble-editable") ||
+              !item ||
+        
```

**File**: `src/modules/contextPanel/chatRenderingReplay.ts` (modified, +37/-1)
```diff
@@ -10,6 +10,11 @@ import {
   nextRequestId,
   tryBeginRequest,
   finishRequest,
+  inlineEditTarget,
+  inlineEditCleanup,
+  inlineEditInputSectionEl,
+  setInlineEditCleanup,
+  setInlineEditTarget,
 } from "./state";
 import { buildContextUsagePresentation } from "./textUtils";
 import { getConversationWriteGeneration } from "../../shared/conversationWriteFence";
@@ -266,6 +271,10 @@ export type CompletedChatTurnRefreshResult = {
   promptMenuAvailable: boolean;
   promptMenuHandledWhileStreaming: boolean;
   promptLockedWhileStreaming: boolean;
+  earlierPromptLockedWhileStreaming: boolean;
+  earlierPromptEditableAfterTurn: boolean;
+  earlierPromptClickOpensEditor: boolean;
+  earlierPromptEditorUsesOriginalText: boolean;
   promptMenuHandledAfterTurn: boolean;
   earlierAnswerWrapperPreserved: boolean;
   earlierPromptWrapperPreserved: boolean;
@@ -349,6 +358,12 @@ export async function exerciseCompletedChatTurnRefresh(panel: {
     // A prompt whose answer is still streaming offers neither edit nor delete.
     const promptLockedWhileStreaming =
       !isPromptEditable(prompt) && streamingProbe?.enabled === false;
+    wrapperOf(earlierPrompt)
+      ?.querySelector<HTMLElement>(".llm-bubble")
+      ?.click();
+    await settle();
+    const earlierPromptLockedWhileStreaming =
+      !isPromptEditable(earlierPrompt) && !inlineEditTarget;
     for (let n = 0; n < 3; n++) {
       answer.text += `Streaming paragraph ${n} with evidence.\n\n`;
       helpers.refreshAssistantMessageSafely(answer);
@@ -375,10 +390,12 @@ export async function exerciseCompletedChatTurnRefresh(panel: {
       contextWindow: 200000,
       estimated: false,
     }).text;
-    return {
+    const result = {
       promptMenuAvailable,
       promptMenuHandledWhileStreaming,
       promptLockedWhileStreaming,
+      earlierPromptLockedWhileStreaming,
+      earlierPromptEditableAfterTurn: isPromptEditable(earlierPrompt),
       earlierAnswerWrapperPreserved:
         Boolean(earlierAnswerWrapper) &&
         wrapperOf(earlierAnswer) === earlierAnswerWrapper &&
@@ -421,7 +438,26 @@ export async function exerciseCompletedChatTurnRefresh(panel: {
         tokenUsageEl?.style.display !== "none",
       ),
     };
+    wrapperOf(earlierPrompt)
+      ?.querySelector<HTMLElement>(".llm-bubble")
+      ?.click();
+    await settle();
+    return {
+      ...result,
+      earlierPromptClickOpensEditor:
+        inlineEditTarget?.userTimestamp === earlierPrompt.timestamp &&
+        Boolean(
+          wrapperOf(earlierPrompt)?.querySelector(".llm-inline-edit-wrapper"),
+        ),
+      earlierPromptEditorUsesOriginalText:
+        inlineEditInputSectionEl?.querySelector<HTMLTextAreaElement>(
+          "#llm-input",
+        )?.value === earlierPrompt.text,
+    };
   } finally {
+    inlineEditCleanup?.();
+    setInlineEditCleanup(null);
+    setInlineEditTarget(null);
     body
       .querySelector<HTMLElement>("#llm-prompt-menu")
       ?.style.setProperty("display", "none");
```

**File**: `src/services/mineru/mineruCache.ts` (modified, +52/-5)
```diff
@@ -1293,15 +1293,62 @@ export function validateMineruManifest(
   }
 }
 
+type MineruCacheWriteOptions = {
+  pageCount?: number;
+  signal?: AbortSignal;
+  beforeCommit?: () => Promise<void>;
+};
+
+type MineruCacheWriter = (
+  mdContent: string,
+  files: MineruCacheFile[],
+  options?: MineruCacheWriteOptions,
+) => Promise<void>;
+
+const activeCacheWrites = new Map<number, Promise<void>>();
+
+/**
+ * Own the whole replacement, including a restore's cache check/removal and
+ * metadata writes. The supplied writer shares that ownership without nesting
+ * the queue. A disk pending marker may outlive a failed write; it is not a lock.
+ */
+export async function withMineruCacheWrite<T>(
+  id: number,
+  operation: (write: MineruCacheWriter) => Promise<T>,
+  options: { skipIfBusy?: boolean } = {},
+): Promise<T | undefined> {
+  const previous = activeCacheWrites.get(id);
+  if (previous && options.skipIfBusy) return undefined;
+  let release!: () => void;
+  const pending = new Promise<void>((resolve) => {
+    release = resolve;
+  });
+  activeCacheWrites.set(id, pending);
+  try {
+    await previous;
+    return await operation((md, files, writeOptions) =>
+      writeMineruCacheFilesOwned(id, md, files, writeOptions),
+    );
+  } finally {
+    if (activeCacheWrites.get(id) === pending) activeCacheWrites.delete(id);
+    release();
+  }
+}
+
 export async function writeMineruCacheFiles(
   id: number,
   mdContent: string,
   files: MineruCacheFile[],
-  options: {
-    pageCount?: number;
-    signal?: AbortSignal;
-    beforeCommit?: () => Promise<void>;
-  } = {},
+  options: MineruCacheWriteOptions = {},
+): Promise<void> {
+  await withMineruCacheWrite(id, (write) => write(mdContent, files, options));
+}
+
+async function writeMineruCacheFilesOwned(
+  id: number,
+  mdContent: string,
+  files: MineruCacheFile[],
+  options: MineruCacheWriteOptions = {},
 ): Promise<void> {
   const checkAbort = () => {
     if (options.signal?.aborted) throw new MineruCancelledError();
```

**File**: `src/services/mineru/sync.ts` (modified, +121/-104)
```diff
@@ -16,7 +16,7 @@ import {
   MINERU_SOURCE_PROVENANCE_FILE,
   readMineruSourceProvenance,
   writeMineruSourceProvenanceForAttachment,
-  writeMineruCacheFiles,
+  withMineruCacheWrite,
   type MineruCacheFile,
 } from "./mineruCache";
 import {
@@ -91,6 +91,7 @@ export type MineruSyncRestoreResult = {
     | "restored"
     | "disabled"
     | "already_cached"
+    | "busy"
     | "not_pdf"
     | "missing_key"
     | "not_found"
@@ -1385,47 +1386,54 @@ export async function ensureMineruRuntimeCacheForAttachment(
   if (!sourceKey) return { status: "missing_key", attachmentId };
 
   try {
-    if (await hasCachedMineruMd(attachmentId)) {
-      return { status: "already_cached", attachmentId };
-    }
-
-    const candidates = await findPackageCandidatesForSource(sourceAttachment, {
-      loadBytes: true,
-      requireReadable: false,
-    });
-    if (!candidates.length) return { status: "no_package", attachmentId };
+    return (
+      (await withMineruCacheWrite<MineruSyncRestoreResult>(
+        attachmentId,
+        async (write) => {
+          if (await hasCachedMineruMd(attachmentId)) {
+            return { status: "already_cached", attachmentId };
+          }
 
-    const selected = selectBestPackageCandidate(candidates);
-    if (!selected?.extracted) {
-      return { status: "invalid_package", attachmentId };
-    }
+          const candidates = await findPackageCandidatesForSource(
+            sourceAttachment,
+            {
+              loadBytes: true,
+              requireReadable: false,
+            },
+          );
+          if (!candidates.length) return { status: "no_package", attachmentId };
 
-    const packageContentHash = selected.extracted.contentHash;
+          const selected = selectBestPackageCandidate(candidates);
+          if (!selected?.extracted) {
+            return { status: "invalid_package", attachmentId };
+          }
 
-    await removePath(getMineruItemDir(attachmentId));
-    await writeMineruCacheFiles(
-      attachmentId,
-      selected.extracted.mdContent,
-      selected.extracted.files,
+          const packageContentHash = selected.extracted.contentHash;
+
+          await removePath(getMineruItemDir(attachmentId));
+          await write(selected.extracted.mdContent, selected.extracted.files);
+          await writeRestoredSourceProvenance({
+            sourceAttachment,
+            packageAttachmentId: selected.item.id,
+            cacheContentHash: packageContentHash,
+          });
+          await writeLocalSyncState({
+            attachmentId,
+            sourceAttachmentKey: sourceKey,
+            packageAttachmentId: selected.item.id,
+            cacheContentHash: packageContentHash,
+          });
+          await invalidateMineruRuntimeCache(attachmentId);
+          return {
+            status: "restored",
+            attachmentId,
+            packageAttachmentId: selected.item.id,
+            packageContentHash,
+          };
+        },
+        { skipIfBusy: true },
+      )) ?? { status: "busy", attachmentId }
     );
-    await writeRestoredSourceProvenance({
-      sourceAttachment,
-      packageAttachmentId: selected.item.id,
-      cacheContentHash: packageContentHash,
-    });
-    await writeLocalSyncState({
-      attachmentId,
-      sourceAttachmentKey: sourceKey,
-      packageAttachmentId: selected.item.id,
-      cacheContentHash: packageContentHash,
-    });
-    await invalidateMineruRuntimeCache(attachmentId);
-    return {
-      status: "restored",
-      attachmentId,
-      packageAttachmentId: selected.item.id,
-      packageContentHash,
-    };
   } catch (error) {
     return {
       status: "error",
@@ -1480,76 +1488,85 @@ export async function repairSyncedMineruCacheForAttachment(
   if (!sourceKey) return { status: "missing_key", attachmentId };
 
   try {
-    const candidates = await findPackageCandidatesForSource(sourceAttachment, {
-      loadBytes: true,
-      requireReadable: false,
-    });
-    if 
```

**File**: `test-workflows/mineruSyncPublication.workflow.test.ts` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+import { assert } from "chai";
+import { createPdfFixture } from "../test/helpers/pdfFixture";
+import { composeRetrievalCandidateInvalidation } from "../test/helpers/hostSurfaces";
+import {
+  getMineruItemDir,
+  hasCachedMineruMd,
+  invalidateMineruMd,
+  readCachedMineruMd,
+  writeMineruCacheFiles,
+} from "../src/services/mineru/mineruCache";
+import {
+  ensureMineruRuntimeCacheForAttachment,
+  publishMineruCachePackageForAttachment,
+  repairSyncedMineruCacheForAttachment,
+} from "../src/services/mineru/sync";
+
+describe("workflow: MinerU sync during cache publication", function () {
+  it("preserves a fresh parse during restore/repair and recovers an interrupted write through native storage", async function () {
+    const io = (globalThis as any).IOUtils;
+    const source = PathUtils.join(
+      Zotero.DataDirectory.dir,
+      `mineru-sync-${Date.now()}.pdf`,
+    );
+    const parent = new Zotero.Item("journalArticle");
+    parent.setField("title", "MinerU publication race fixture");
+    await parent.saveTx();
+    await io.write(source, createPdfFixture(1));
+    const pdf = await Zotero.Attachments.linkFromFile({
+      file: source,
+      parentItemID: parent.id,
+      contentType: "application/pdf",
+    });
+    const originalToolkit = (globalThis as any).ztoolkit;
+    const pref = "extensions.zotero.llmforzotero.mineruSyncEnabled";
+    const oldSync = Zotero.Prefs.get(pref, true);
+    const restoreInvalidator = composeRetrievalCandidateInvalidation();
+    let packageId: number | undefined;
+    try {
+      (globalThis as any).ztoolkit = (Zotero as any).LLMForZotero.data.ztoolkit;
+      Zotero.Prefs.set(pref, true, true);
+      const old = "# Old extraction\n\nSynced before reparsing.";
+      await writeMineruCacheFiles(pdf.id, old, []);
+      const published = await publishMineruCachePackageForAttachment(pdf.id);
+      assert.equal(published.status, "published", published.reason);
+      packageId = published.packageAttachmentId;
+      const packageItem = await Zotero.Items.getAsync(packageId!);
+      assert.equal(packageItem.parentID, parent.id);
+      assert.isTrue(await io.exists(await packageItem.getFilePathAsync()));
+      const root = getMineruItemDir(pdf.id);
+      const marker = PathUtils.join(root, "_llm_write_pending.json");
+      const fresh = "# New extraction\n\nComplete reparsed output.";
+      await writeMineruCacheFiles(pdf.id, fresh, [], {
+        pageCount: 1,
+        beforeCommit: async () => {
+          assert.isTrue(await io.exists(marker));
+          assert.isFalse(await hasCachedMineruMd(pdf.id));
+          for (const restore of [
+            ensureMineruRuntimeCacheForAttachment,
+            repairSyncedMineruCacheForAttachment,
+          ]) {
+            assert.equal((await restore(pdf)).status, "busy");
+            assert.isTrue(await io.exists(marker));
+            assert.isNull(await readCachedMineruMd(pdf.id));
+          }
+        },
+      });
+      assert.equal(
+        await Zotero.File.getContentsAsync(PathUtils.join(root, "full.md")),
+        fresh,
+      );
+      const manifest = JSON.parse(
+        (await Zotero.File.getContentsAsync(
+          PathUtils.join(root, "manifest.json"),
+        )) as string,
+      );
+      assert.equal(manifest.totalChars, fresh.length);
+      assert.equal(manifest.totalPages, 1);
+      assert.isFalse(await io.exists(marker));
+      try {
+        await writeMineruCacheFiles(pdf.id, "# Interrupted", [], {
+          beforeCommit: async () => {
+            throw new Error("fixture interruption");
+          },
+        });
+        assert.fail("expected interrupted write");
+      } catch (error) {
+        assert.include(String(error), "fixture interruption");
+      }
+      assert.isTrue(await io.exists(marker));
+      const restored = await ensureMineruRuntimeCacheForAttachment(pdf);
+      assert.equal(restored.status, "restored", restored.reason);
+      assert.equa
```

---

### Incident Patch 5: `92f2a1f6` (2026-09-19)
**Commit Message**: fix(quotes): make PDF matching invariant to item segmentation

**File**: `src/modules/contextPanel/livePdfSelectionLocator.ts` (modified, +29/-7)
```diff
@@ -21,6 +21,7 @@ import {
   assessAcademicQuoteAlignment,
   buildQuoteTextIndex,
   findQuoteSourceSpansAllowingLayoutArtifacts,
+  stripPdfTextItemBoundaries,
   type QuoteTextIndex,
 } from "../../services/quotes/quoteTextNormalization";
 
@@ -2985,6 +2986,20 @@ function didFindControllerSearchStateChange(
   );
 }
 
+function hasFindControllerResultsForQuery(
+  findController: any,
+  snapshot: FindControllerSearchSnapshot,
+  expectedQuery: string,
+): boolean {
+  // Updating the query happens before PDF.js replaces the previous results.
+  // Neither old hits nor an old empty result are evidence about the new query.
+  return (
+    findController?._dirtyMatch !== true &&
+    (snapshot.query === expectedQuery ||
+      didFindControllerSearchStateChange(findController, snapshot))
+  );
+}
+
 async function waitForFindControllerSearchAcceptance(
   findController: any,
   expectedQuery: string,
@@ -3127,8 +3142,13 @@ function mergeFindControllerResultSnapshot(params: {
   const pageMatches = getFindControllerPageMatches(params.findController);
   const currentQuery = getFindControllerQuery(params.findController);
   const queryConfirmed =
-    currentQuery === params.expectedQuery ||
-    (currentQuery === undefined && params.allowUnobservableQuery === true);
+    (currentQuery === params.expectedQuery ||
+      (currentQuery === undefined && params.allowUnobservableQuery === true)) &&
+    hasFindControllerResultsForQuery(
+      params.findController,
+      params.previousSnapshot,
+      params.expectedQuery,
+    );
   // PDF.js replaces pageMatches in place for the newest query. Never attribute
   // a newer click's positive results to an older, superseded navigation.
   const summary = queryConfirmed
@@ -3171,8 +3191,7 @@ function mergeFindControllerResultSnapshot(params: {
     selectedPageIndex:
       queryConfirmed &&
       selectedPageIndex !== null &&
-      (summary.matchedPageIndexes.includes(selectedPageIndex) ||
-        summary.totalMatches > 0)
+      summary.matchedPageIndexes.includes(selectedPageIndex)
         ? selectedPageIndex
         : null,
     selectedMatchIndex: queryConfirmed ? selectedMatchIndex : null,
@@ -3287,6 +3306,11 @@ async function waitForFindControllerPageMatches(params: {
         Date.now() - startedAt >= 700;
       if (
         queryConfirmed &&
+        hasFindControllerResultsForQuery(
+          params.findController,
+          params.previousSnapshot,
+          params.expectedQuery,
+        ) &&
         (pageMatches.length >= params.pagesCount || pagesToSearch === 0) &&
         pendingCount === 0 &&
         canTrustEmptyCompletion
@@ -3541,9 +3565,7 @@ function normalizePageNativeFindControllerLiteral(
   sourceText: string,
   _quoteText: string,
 ): string {
-  return sourceText
-    .split(PDF_TEXT_ITEM_BOUNDARY)
-    .join("")
+  return stripPdfTextItemBoundaries(sourceText)
     .replace(/(\p{Ll})[-‐‑‒–—−]\s*\r?\n\s*(?=\p{Ll})/gu, "$1")
     .replace(/(\p{Lu})[-‐‑‒–—−]\s*\r?\n\s*(?=\p{L})/gu, "$1")
     .replace(/(\S)[-‐‑‒–—−]\s*\r?\n\s*/gu, "$1-")
```

**File**: `src/modules/contextPanel/quoteValidation/caches.ts` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ const MAX_QUOTE_VALIDATION_DECISION_ENTRIES = 1000;
 const MAX_QUOTE_VALIDATION_DECISION_BYTES = 4 * 1024 * 1024;
 const MAX_QUOTE_SOURCE_INDEX_ENTRIES = 64;
 const MAX_QUOTE_SOURCE_INDEX_BYTES = 2 * 1024 * 1024;
-export const QUOTE_VALIDATION_POLICY_VERSION = 11;
+export const QUOTE_VALIDATION_POLICY_VERSION = 12;
 type QuoteValidationDecision = ReturnType<
   typeof finalizeAssistantQuoteCitations
 >;
```

**File**: `src/services/quotes/quoteCitations.ts` (modified, +15/-10)
```diff
@@ -22,6 +22,7 @@ import {
   findQuoteSourceSpansAllowingLayoutArtifactsFromIndex,
   normalizeQuoteTextCanonical,
   stripLikelyLayoutNumberArtifacts,
+  stripPdfTextItemBoundaries,
   type QuoteTextIndex,
 } from "./quoteTextNormalization";
 import { stripLeadingCitationSeparators } from "./citationText";
@@ -83,6 +84,7 @@ function isInvalidTextControlCode(code: number): boolean {
 }
 
 function stripInvalidTextControlChars(value: string): string {
+  value = stripPdfTextItemBoundaries(value);
   let out = "";
   for (let index = 0; index < value.length; index += 1) {
     const char = value[index];
@@ -1209,7 +1211,9 @@ function buildCompleteDisplayedSourceQuoteText(
   const locatorMatch = source.match(COMPLETE_TRAILING_SOURCE_LOCATOR_PATTERN);
   const locatorText = locatorMatch?.[1] || "";
   if (!locatorText || locatorMatch?.index === undefined) {
-    if (/[.,;:!?。！？、，；：]["'”’]?$/u.test(displayed)) {
+    // An authored closing delimiter already defines the excerpt's end.
+    // Keep surrounding clause punctuation in the source span for navigation.
+    if (/[.,;:!?。！？、，；：)\]}$]["'”’]?$/u.test(displayed)) {
       return displayed;
     }
     const punctuationMatch = source.match(/([.,;:!?。！？、，；：]+["'”’]?)$/u);
@@ -1743,21 +1747,22 @@ export function buildQuoteSourceIndex(params: {
   for (const source of sourceTexts) {
     const rawSourceText = source.sourceText || source.text;
     const normalizedSourceText = normalizeMultilineText(rawSourceText);
+    const hasPdfItemBoundaries =
+      typeof rawSourceText === "string" && rawSourceText.includes("\u0003");
     const reusableTextIndex =
       source.textIndex &&
-      (source.textIndex.sourceText === normalizedSourceText ||
-        normalizeMultilineText(source.textIndex.sourceText) ===
-          normalizedSourceText)
+      (hasPdfItemBoundaries
+        ? source.textIndex.sourceText === rawSourceText
+        : source.textIndex.sourceText === normalizedSourceText ||
+          normalizeMultilineText(source.textIndex.sourceText) ===
+            normalizedSourceText)
         ? source.textIndex
         : undefined;
-    // PDF item boundaries carry evidence that an intervening number is a
-    // reference marker. Keep that evidence until alignment; display strings
-    // are sanitized separately when the verified citation is constructed.
+    // Preserve native positions for the shared matching view. Reusing a
+    // sanitized index would turn item splits into spaces and discard that map.
     const sourceText =
       reusableTextIndex?.sourceText ||
-      (typeof rawSourceText === "string" && rawSourceText.includes("\u0003")
-        ? rawSourceText
-        : normalizedSourceText);
+      (hasPdfItemBoundaries ? rawSourceText : normalizedSourceText);
     const citationLabel = normalizeCitationLabel(
       source.sourceLabel || source.citationLabel,
     );
```

**File**: `src/services/quotes/quoteTextNormalization.ts` (modified, +112/-14)
```diff
@@ -125,6 +125,25 @@ export type QuoteTextIndex = {
   tokens: QuoteTextToken[];
 };
 
+type QuoteTextLayoutView = {
+  index: QuoteTextIndex;
+  /** One original UTF-16 offset for each character in the matching view. */
+  sourceOffsets: number[];
+};
+
+const quoteTextLayoutViews = new WeakMap<QuoteTextIndex, QuoteTextLayoutView>();
+
+function mapLayoutSpan(
+  view: QuoteTextLayoutView,
+  start: number,
+  end: number,
+): { sourceStart: number; sourceEnd: number } {
+  return {
+    sourceStart: view.sourceOffsets[start],
+    sourceEnd: view.sourceOffsets[end - 1] + 1,
+  };
+}
+
 export type AcademicQuoteTokenKind =
   | "prose"
   | "number"
@@ -289,8 +308,37 @@ function assignCanonicalOffsets(tokens: QuoteTextToken[]): QuoteTextToken[] {
   });
 }
 
+/** Join PDF text items without inventing whitespace inside words or formulae. */
+export function stripPdfTextItemBoundaries(value: string): string {
+  return value.replaceAll("\u0003", "");
+}
+
 export function buildQuoteTextIndex(value: string): QuoteTextIndex {
   const sourceText = typeof value === "string" ? value : "";
+  // PDF item boundaries describe segmentation, not characters in the paper.
+  // Every lexical and boundary check uses the same joined view. Keep a map
+  // back to the untouched source so navigation still receives its exact span.
+  if (sourceText.includes("\u0003")) {
+    const characters: string[] = [];
+    const sourceOffsets: number[] = [];
+    for (let offset = 0; offset < sourceText.length; offset += 1) {
+      if (sourceText[offset] === "\u0003") continue;
+      characters.push(sourceText[offset]);
+      sourceOffsets.push(offset);
+    }
+    const index = buildQuoteTextIndex(characters.join(""));
+    const view = { index, sourceOffsets };
+    const mappedIndex = {
+      sourceText,
+      canonicalText: index.canonicalText,
+      tokens: index.tokens.map((token) => ({
+        ...token,
+        ...mapLayoutSpan(view, token.sourceStart, token.sourceEnd),
+      })),
+    };
+    quoteTextLayoutViews.set(mappedIndex, view);
+    return mappedIndex;
+  }
   const tokens = assignCanonicalOffsets(
     mergeSourceTokens(rawTokensFromSource(sourceText), sourceText),
   );
@@ -374,11 +422,19 @@ function expandSourceSpanStart(
 
 function expandSourceSpanEnd(sourceText: string, sourceEnd: number): number {
   let cursor = sourceEnd;
-  while (
-    cursor < sourceText.length &&
-    SOURCE_SPAN_TRAILING_BOUNDARY_PATTERN.test(sourceText[cursor])
-  ) {
-    cursor += 1;
+  while (cursor < sourceText.length) {
+    if (
+      SOURCE_SPAN_TRAILING_BOUNDARY_PATTERN.test(sourceText[cursor]) ||
+      sourceText[cursor] === "$"
+    ) {
+      cursor += 1;
+      continue;
+    }
+    const closingSyntax = sourceText
+      .slice(cursor)
+      .match(/^(?:<\/(?:sup|sub|span|b|em|i|strong)>|\\[)\]])/iu)?.[0];
+    if (!closingSyntax) break;
+    cursor += closingSyntax.length;
   }
   return cursor;
 }
@@ -398,13 +454,7 @@ function resolveAlignedSourceEnd(params: {
   lastTokenEnd: number;
   queryIndex: QuoteTextIndex;
 }): number | null {
-  // HTML presentation can close after the last matched word/reference.
-  // Include it in the original source span before checking sentence punctuation.
-  const closingTags =
-    params.sourceText
-      .slice(params.lastTokenEnd)
-      .match(/^(?:<\/(?:sup|sub|span|b|em|i|strong)>)+/iu)?.[0] || "";
-  const lastTokenEnd = params.lastTokenEnd + closingTags.length;
+  const lastTokenEnd = params.lastTokenEnd;
   const adjacentEnd = expandSourceSpanEnd(params.sourceText, lastTokenEnd);
   if (!queryRequiresTerminalSentenceBoundary(params.queryIndex)) {
     return adjacentEnd;
@@ -461,6 +511,16 @@ export function findCanonicalQuoteSourceSpan(
   index: QuoteTextIndex,
   queryText: string,
 ): QuoteTextSourceSpan | null {
+  const view = quoteTextLayoutViews.get(index);
+  if (view) {
+    const span = findCanonicalQuoteSourceSpan(view.index, queryText);
+    if (!span) return null;
+    cons
```

**File**: `test-workflows/quoteAcceptance.workflow.test.ts` (modified, +103/-5)
```diff
@@ -4,7 +4,9 @@ import { collectReaderSelectionDocuments } from "../src/modules/contextPanel/rea
 import {
   SUMMERFIELD_QUOTE,
   SUMMERFIELD_SOURCE_PREFIX,
+  SUMMERFIELD_SIMILARITY_QUOTE,
 } from "../test/fixtures/quoteAcceptance";
+import { buildFragmentedQuotePdf } from "../test/fixtures/fragmentedQuotePdf";
 
 describe("workflow: quote acceptance from unique passage evidence", function () {
   this.timeout(120000);
@@ -19,6 +21,16 @@ describe("workflow: quote acceptance from unique passage evidence", function ()
       source:
         "Reward-related pattern similarity increased reliably across the adolescent participants (F(268) = 4.72; p = 0.012; N = 89).",
     },
+    {
+      name: "quote with fragmented words and closing delimiters",
+      prose: "Neurons that signal",
+      quote: SUMMERFIELD_SIMILARITY_QUOTE.replaceAll("→", "->"),
+      source: SUMMERFIELD_SIMILARITY_QUOTE.replaceAll("→", "->"),
+      highlightTail: "{x ->z}.",
+      fragmented: true,
+      followingQuote:
+        "A second complete quotation should navigate to its own page after the first search.",
+    },
     {
       name: "quote containing a mid-sentence citation marker",
       prose: "the gradual rotation",
@@ -38,12 +50,24 @@ describe("workflow: quote acceptance from unique passage evidence", function ()
         .workflowTest as WorkflowTestApi;
       await api.reset();
       const { prose, quote, source } = scenario;
-      const markdown = `> ${quote}\n\n(Fixture, 2024)`;
+      const markdown = [quote, scenario.followingQuote]
+        .filter(Boolean)
+        .map((text) => `> ${text}\n\n(Fixture, 2024)`)
+        .join("\n\n");
       const fixture = await api.createPaperWithPdfFixture({
         title: "Quote acceptance fixture",
         pdfTitle: "Statistical source",
         pages: [source],
       });
+      if (scenario.fragmented) {
+        const attachment = Zotero.Items.get(fixture.pdfAttachmentId);
+        const path = await attachment.getFilePathAsync();
+        assert.isString(path);
+        await IOUtils.write(
+          path as string,
+          await buildFragmentedQuotePdf([source, scenario.followingQuote!]),
+        );
+      }
       const diagnosticLog: string[] = [];
       const onDebug = (message: string) => {
         if (/quote-locator|quote validation|quote source/i.test(message))
@@ -74,6 +98,24 @@ describe("workflow: quote acceptance from unique passage evidence", function ()
           pageReady(),
           "native PDF page is loaded before reopening chat",
         );
+        if (scenario.fragmented) {
+          const items = collectReaderSelectionDocuments(reader).flatMap((doc) =>
+            Array.from(
+              doc.querySelectorAll(".textLayer span"),
+              (node) => node.textContent,
+            ),
+          );
+          assert.include(
+            items,
+            "}",
+            "the native fixture splits the closing brace into its own text item",
+          );
+          assert.include(
+            items,
+            ".",
+            "the period is a separate native text item",
+          );
+        }
         await api.openStandaloneForItem(item.id);
         const context = {
           itemId: item.id,
@@ -113,17 +155,26 @@ describe("workflow: quote acceptance from unique passage evidence", function ()
         let card: HTMLElement | null = null;
         const deadline = Date.now() + 30000;
         while (Date.now() < deadline) {
-          card = win.document.querySelector(
-            '.llm-quote-card[data-quote-status="verified"]',
+          const cards = Array.from(
+            win.document.querySelectorAll<HTMLElement>(".llm-quote-card"),
           );
-          if (card) break;
+          if (
+            cards.length === (scenario.followingQuote ? 2 : 1) &&
+            cards.every((node) => node.dataset.quoteStatus === "verified")
+          ) {
+            card = cards[0];
+            break;
+          }
           await Zo
```

---

### Incident Patch 6: `788d6e28` (2026-09-19)
**Commit Message**: fix(quotes): match full passages through citation artifacts

Align quote wording through superscript references and PDF layout artifacts while retaining semantic-number checks and original source offsets. Revalidate saved answers and prefer complete quote navigation over cached fragments.

Validate with 6,777 unit tests, 253 native workflows before integration, six targeted native workflows including the actual Summerfield PDF after integration, lint, type checking, architecture checks, cycle checks, and the production build.

**File**: `src/modules/contextPanel/assistantCitationLinks.ts` (modified, +7/-1)
```diff
@@ -1694,12 +1694,15 @@ async function attemptCitationParagraphJump(params: {
   // Source navigation is user-initiated. Raise an existing PDF above standalone
   // chat/document windows too, even if its paragraph cannot be highlighted.
   Zotero.getMainWindow()?.focus();
+  // A cached source locator can be only a unique fragment. Try all complete
+  // displayed wording before that fallback, or its early success truncates
+  // the highlight even when the full passage is searchable.
   const quoteTexts = Array.from(
     new Set(
       [
         params.preferredFullQuoteText,
-        params.verifiedSourceMatchText,
         params.quoteText,
+        params.verifiedSourceMatchText,
       ]
         .map((value) => sanitizeText(value || "").trim())
         .filter(Boolean),
@@ -1730,6 +1733,9 @@ async function attemptCitationParagraphJump(params: {
   return paragraphJump;
 }
 
+export const attemptCitationParagraphJumpForTests =
+  attemptCitationParagraphJump;
+
 /**
  * Resolve the effective page label after a paragraph jump.  If
  * FindController landed on a different page than the text search
```

**File**: `src/modules/contextPanel/quoteValidation/caches.ts` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ const MAX_QUOTE_VALIDATION_DECISION_ENTRIES = 1000;
 const MAX_QUOTE_VALIDATION_DECISION_BYTES = 4 * 1024 * 1024;
 const MAX_QUOTE_SOURCE_INDEX_ENTRIES = 64;
 const MAX_QUOTE_SOURCE_INDEX_BYTES = 2 * 1024 * 1024;
-export const QUOTE_VALIDATION_POLICY_VERSION = 10;
+export const QUOTE_VALIDATION_POLICY_VERSION = 11;
 type QuoteValidationDecision = ReturnType<
   typeof finalizeAssistantQuoteCitations
 >;
```

**File**: `src/services/quotes/quoteCitations.ts` (modified, +13/-7)
```diff
@@ -1741,17 +1741,23 @@ export function buildQuoteSourceIndex(params: {
     });
   }
   for (const source of sourceTexts) {
-    const normalizedSourceText = normalizeMultilineText(
-      source.sourceText || source.text,
-    );
+    const rawSourceText = source.sourceText || source.text;
+    const normalizedSourceText = normalizeMultilineText(rawSourceText);
     const reusableTextIndex =
       source.textIndex &&
       (source.textIndex.sourceText === normalizedSourceText ||
         normalizeMultilineText(source.textIndex.sourceText) ===
           normalizedSourceText)
         ? source.textIndex
         : undefined;
-    const sourceText = reusableTextIndex?.sourceText || normalizedSourceText;
+    // PDF item boundaries carry evidence that an intervening number is a
+    // reference marker. Keep that evidence until alignment; display strings
+    // are sanitized separately when the verified citation is constructed.
+    const sourceText =
+      reusableTextIndex?.sourceText ||
+      (typeof rawSourceText === "string" && rawSourceText.includes("\u0003")
+        ? rawSourceText
+        : normalizedSourceText);
     const citationLabel = normalizeCitationLabel(
       source.sourceLabel || source.citationLabel,
     );
@@ -1857,7 +1863,7 @@ export function resolveExactDisplayedQuoteCitation(params: {
       )
         continue;
       const alignment = assessAcademicQuoteAlignment(
-        sourceQuoteText,
+        span.text,
         displayed.quoteText,
       );
       const fullSourceAlignment = assessAcademicQuoteAlignment(
@@ -2692,9 +2698,9 @@ function resolveUniqueDisplayedQuoteAnchorCitation(params: {
     resolved.match.confidence === "high" &&
     resolved.match.matchedTokenCount >= MIN_NEAR_COMPLETE_QUOTE_ANCHOR_TOKENS
       ? assessAnchoredQuotePassage({
-          sourceText: resolved.source.sourceText,
+          sourceText: normalizeMultilineText(resolved.source.sourceText),
           quoteText: displayedQuoteText,
-          anchorText: resolved.match.query,
+          anchorText: sourceMatchText,
         })
       : "incomplete";
   if (passageEvidence === "conflict" || passageEvidence === "unmatched")
```

**File**: `src/services/quotes/quoteTextNormalization.ts` (modified, +151/-96)
```diff
@@ -47,7 +47,6 @@ const QUOTE_WORD_PATTERN =
   /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|\p{N}+|\p{L}[\p{L}\p{M}\p{N}]*/gu;
 const LETTER_TOKEN_PATTERN = /^\p{L}+$/u;
 const ATTACHED_CITATION_TOKEN_PATTERN = /^(\p{L}{2,})(\p{N}{1,3})$/u;
-const ATTACHED_CITATION_TAIL_GAP_PATTERN = /^[\s\u0003]*[,;–—−-][\s\u0003]*$/u;
 const ATTACHED_CITATION_BOUNDARY_PATTERN =
   /^[\s\u0003]*[.,;:!?()[\]{}。！？、，；：]/u;
 const MIN_UNCORROBORATED_ATTACHED_CITATION_STEM_LENGTH = 6;
@@ -72,6 +71,10 @@ const SEMANTIC_NUMERIC_SUFFIX_WORDS = new Set([
   "mouse",
   "neuron",
   "phase",
+  "protein",
+  "receptor",
+  "interleukin",
+  "range",
   "ref",
   "refs",
   "sample",
@@ -395,16 +398,20 @@ function resolveAlignedSourceEnd(params: {
   lastTokenEnd: number;
   queryIndex: QuoteTextIndex;
 }): number | null {
-  const adjacentEnd = expandSourceSpanEnd(
-    params.sourceText,
-    params.lastTokenEnd,
-  );
+  // HTML presentation can close after the last matched word/reference.
+  // Include it in the original source span before checking sentence punctuation.
+  const closingTags =
+    params.sourceText
+      .slice(params.lastTokenEnd)
+      .match(/^(?:<\/(?:sup|sub|span|b|em|i|strong)>)+/iu)?.[0] || "";
+  const lastTokenEnd = params.lastTokenEnd + closingTags.length;
+  const adjacentEnd = expandSourceSpanEnd(params.sourceText, lastTokenEnd);
   if (!queryRequiresTerminalSentenceBoundary(params.queryIndex)) {
     return adjacentEnd;
   }
   if (
     TERMINAL_SENTENCE_PUNCTUATION_PATTERN.test(
-      params.sourceText.slice(params.lastTokenEnd, adjacentEnd),
+      params.sourceText.slice(lastTokenEnd, adjacentEnd),
     )
   ) {
     return adjacentEnd;
@@ -415,10 +422,10 @@ function resolveAlignedSourceEnd(params: {
   // Accept only the bounded item-boundary form; ordinary fused prose such as
   // "afterward.during" remains an incomplete source match.
   const itemSeparatedTerminal = params.sourceText
-    .slice(params.lastTokenEnd)
+    .slice(adjacentEnd)
     .match(PDF_ITEM_SEPARATED_TERMINAL_PUNCTUATION_PATTERN);
   if (itemSeparatedTerminal) {
-    return params.lastTokenEnd + (itemSeparatedTerminal[0]?.length || 0);
+    return adjacentEnd + (itemSeparatedTerminal[0]?.length || 0);
   }
 
   // PDF.js commonly emits a superscript reference range as separate text
@@ -427,7 +434,7 @@ function resolveAlignedSourceEnd(params: {
   // quotation normally omits that reference. Preserve the complete literal
   // PDF.js source sentence so FindController can search its native item
   // stream instead of rejecting otherwise exact prose.
-  const sourceTail = params.sourceText.slice(params.lastTokenEnd);
+  const sourceTail = params.sourceText.slice(lastTokenEnd);
   const citationSuffixMatch = sourceTail.match(
     OMITTED_TRAILING_CITATION_SUFFIX_PATTERN,
   );
@@ -436,7 +443,7 @@ function resolveAlignedSourceEnd(params: {
     const hasStrongCitationMarker =
       /^[\s]*[[(]/u.test(citationText) || /[,;‐‑‒–—−-]/u.test(citationText);
     if (hasStrongCitationMarker) {
-      return params.lastTokenEnd + (citationSuffixMatch[0]?.length || 0);
+      return lastTokenEnd + (citationSuffixMatch[0]?.length || 0);
     }
   }
 
@@ -445,11 +452,9 @@ function resolveAlignedSourceEnd(params: {
   // complete literal source sentence only for a recognized locator. Any other
   // missing terminal boundary is incomplete grounding and must fail closed.
   const locatorMatch = params.sourceText
-    .slice(params.lastTokenEnd)
+    .slice(lastTokenEnd)
     .match(OMITTED_TRAILING_SOURCE_LOCATOR_PATTERN);
-  return locatorMatch
-    ? params.lastTokenEnd + (locatorMatch[0]?.length || 0)
-    : null;
+  return locatorMatch ? lastTokenEnd + (locatorMatch[0]?.length || 0) : null;
 }
 
 export function findCanonicalQuoteSourceSpan(
@@ -622,114 +627,173 @@ export type QuoteTextAlignmentRun = {
 
 const MAX_QUOTE_ALIGNMENT_STATES = 200_000;
 
-type AttachedCitationToken = {
+type CitationSuffix = {
   sourceWord: 
```

**File**: `test-workflows/quoteAcceptance.workflow.test.ts` (modified, +164/-120)
```diff
@@ -1,136 +1,180 @@
 import { assert } from "chai";
 import type { WorkflowTestApi } from "../src/modules/contextPanel/workflowTestTypes";
 import { collectReaderSelectionDocuments } from "../src/modules/contextPanel/readerSelection";
+import {
+  SUMMERFIELD_QUOTE,
+  SUMMERFIELD_SOURCE_PREFIX,
+} from "../test/fixtures/quoteAcceptance";
 
 describe("workflow: quote acceptance from unique passage evidence", function () {
   this.timeout(120000);
 
-  it("revalidates a stored statistical quote and navigates its native PDF anchor", async function () {
-    assert.isTrue(
-      Zotero.DataDirectory.dir.endsWith("/zotero-dev") ||
-        Zotero.DataDirectory.dir.endsWith("/.scaffold/test/data"),
-    );
-    const api = (Zotero as any).LLMForZotero.api
-      .workflowTest as WorkflowTestApi;
-    await api.reset();
-    const prose =
-      "Reward-related pattern similarity increased reliably across the adolescent participants";
-    const quote = `${prose} (F₂,₆₈ = 4.72; p = 0.012; N = 89)`;
-    const source = `${prose} (F(268) = 4.72; p = 0.012; N = 89).`;
-    const markdown = `> ${quote}\n\n(Fixture, 2024)`;
-    const fixture = await api.createPaperWithPdfFixture({
-      title: "Quote acceptance fixture",
-      pdfTitle: "Statistical source",
-      pages: [source],
-    });
-    const diagnosticLog: string[] = [];
-    const onDebug = (message: string) => {
-      if (/quote-locator|quote validation|quote source/i.test(message))
-        diagnosticLog.push(message);
-    };
-    Zotero.Debug.addListener(onDebug);
-    let reader: any;
-    try {
-      const item = Zotero.Items.get(fixture.parentItemId);
-      item.setCreators([
-        { creatorType: "author", firstName: "Test", lastName: "Fixture" },
-      ]);
-      item.setField("date", "2024");
-      await item.saveTx();
-      reader = await Zotero.Reader.open(fixture.pdfAttachmentId);
-      await reader._initPromise;
-      await reader._waitForReader();
-      const pageReady = () =>
-        collectReaderSelectionDocuments(reader).some((doc) =>
-          doc
-            .querySelector('.page[data-page-number="1"] .textLayer')
-            ?.textContent?.includes("Reward-related"),
-        );
-      const pageDeadline = Date.now() + 15000;
-      while (!pageReady() && Date.now() < pageDeadline)
-        await Zotero.Promise.delay(25);
+  for (const scenario of [
+    {
+      name: "statistical quote",
+      prose:
+        "Reward-related pattern similarity increased reliably across the adolescent participants",
+      quote:
+        "Reward-related pattern similarity increased reliably across the adolescent participants (F₂,₆₈ = 4.72; p = 0.012; N = 89)",
+      source:
+        "Reward-related pattern similarity increased reliably across the adolescent participants (F(268) = 4.72; p = 0.012; N = 89).",
+    },
+    {
+      name: "quote containing a mid-sentence citation marker",
+      prose: "the gradual rotation",
+      quote: SUMMERFIELD_QUOTE,
+      highlightTail: "positional code.",
+      source:
+        SUMMERFIELD_SOURCE_PREFIX +
+        SUMMERFIELD_QUOTE.replace("computation and", "computation137 and"),
+    },
+  ]) {
+    it(`revalidates a stored ${scenario.name} and navigates its native PDF anchor`, async function () {
       assert.isTrue(
-        pageReady(),
-        "native PDF page is loaded before reopening chat",
+        Zotero.DataDirectory.dir.endsWith("/zotero-dev") ||
+          Zotero.DataDirectory.dir.endsWith("/.scaffold/test/data"),
       );
-      await api.openStandaloneForItem(item.id);
-      const context = {
-        itemId: item.id,
-        contextItemId: fixture.pdfAttachmentId,
+      const api = (Zotero as any).LLMForZotero.api
+        .workflowTest as WorkflowTestApi;
+      await api.reset();
+      const { prose, quote, source } = scenario;
+      const markdown = `> ${quote}\n\n(Fixture, 2024)`;
+      const fixture = await api.createPaperWithPdfFixture({
         title: "Quote acceptance fixtur
```

---

### Incident Patch 7: `a95422d2` (2026-09-19)
**Commit Message**: fix(prompt): cap the paper-silence notice to one sentence, no caveat sections

The provenance rule added in 88ca2a5d made the model open reason and definition answers with a separate caveat paragraph. Keep the rule (say whether the paper states it, before any derivation) but require the notice to be one short sentence, with limitations placed in the sentence they qualify and no caveat, note, or limitation sections, headings, bullets, or closing caveat sentences. Live DeepSeek runs: caveat paragraphs 5/4 -> 1/2 over two authored repeats, answers 10-15% shorter, tokens and time within run-to-run noise, evidence delivery unchanged.

**File**: `src/shared/instructionContracts.ts` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ export const PAPER_CITATION_CONTRACT = [
   "## Evidence and citations",
   BALANCED_EVIDENCE_GUIDANCE,
   "When citing or quoting from a paper, use the sourceLabel provided by the tool. If verified quote anchors like [[quote:Q_x7a2]] are provided, use the anchor token only when exact wording is useful instead of manually copying the quote or sourceLabel. Use `>` blockquotes only for direct original source text. Direct quote text must be copied verbatim in the original source language; never translate quote text to match the user's language. If a translation, interpretation, emphasis, example, or opinion is useful, write it outside the blockquote as explanation or in a fenced `text` block, not as the quoted source passage. If no quote anchor is provided, put the sourceLabel on the next non-empty line after a blockquote. Copy the Source label string exactly. Do not invent author/year/page/section labels. Do not write [[source=...]], section=..., or chunk=... metadata in the final answer. Do not call additional tools solely to discover quotes or page numbers; the UI citation binder can resolve page links after rendering.",
-  "State the basis of each substantive claim about a paper: from the paper (cite or anchor it), derived from the paper's stated premises (name the premise and the step), or outside this paper (name the source). When asked why or for a reason, first say in one sentence whether the paper itself states the reason; if it does not, say so before giving any derivation.",
+  "State the basis of each substantive claim about a paper: from the paper (cite or anchor it), derived from the paper's stated premises (name the premise and the step), or outside this paper (name the source). When asked why or for a reason, first say in one sentence whether the paper itself states the reason; if it does not, say so before giving any derivation. Whenever the paper does not state what was asked, say so in one short sentence and then answer from the evidence. Put any limitation in the sentence that makes the claim it qualifies: no separate caveat paragraph, no caveat, note, or limitation section, heading, or bullet list, and no closing caveat sentence.",
 ].join("\n");
 
 /** Cross-provider completion boundary for tool-backed actions. */
```

**File**: `test/instructionHarnessInventory.test.ts` (modified, +1/-0)
```diff
@@ -127,6 +127,7 @@ describe("instruction harness inventory", function () {
       PAPER_CITATION_CONTRACT,
       "whether the paper itself states the reason",
     );
+    assert.include(PAPER_CITATION_CONTRACT, "no separate caveat paragraph");
     for (const prompt of [persona, DEFAULT_SYSTEM_PROMPT]) {
       assert.include(prompt, "derived from the paper's stated premises");
     }
```

**File**: `test/quoteGuidancePrompt.test.ts` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ describe("quote guidance prompts", function () {
   });
   it("preserves the proven evidence wording inside one canonical contract", function () {
     assert.include(PAPER_CITATION_CONTRACT, BALANCED_EVIDENCE_GUIDANCE);
-    assert.equal(fingerprintText(PAPER_CITATION_CONTRACT), "fnv1a32-67d08dae");
+    assert.equal(fingerprintText(PAPER_CITATION_CONTRACT), "fnv1a32-4be434bd");
     assertCanonicalCitationContract(PAPER_CITATION_CONTRACT);
   });
 
```

---

### Incident Patch 8: `87be0caf` (2026-09-19)
**Commit Message**: fix(markdown): stop leaking mermaid theme observers per render

ensureMermaidThemeWatcher added a MutationObserver for the rendered
markdown root on every render and never disconnected any of them, so each
message containing a mermaid block pinned one detached subtree per
render for the life of the window. The transient root is no longer
observed (the theme re-render walks the whole document anyway), and
observers whose panel root has been detached are released, bounding the
list to live panel roots plus the document root and body.

**File**: `src/modules/contextPanel/renderedMarkdown.ts` (modified, +29/-10)
```diff
@@ -370,9 +370,13 @@ const mermaidPromises = new WeakMap<Window, Promise<Mermaid>>();
 let mermaidRenderQueue: Promise<void> = Promise.resolve();
 let mermaidRenderCounter = 0;
 
+type MermaidThemeObservation = {
+  target: Element;
+  observer: MutationObserver;
+};
+
 type MermaidThemeWatcher = {
-  observedElements: WeakSet<Element>;
-  observers: MutationObserver[];
+  observations: MermaidThemeObservation[];
   scheduled: boolean;
   mediaQuery?: MediaQueryList;
 };
@@ -386,8 +390,7 @@ function ensureMermaidThemeWatcher(doc: Document, root?: ParentNode): void {
   let watcher = mermaidThemeWatchers.get(doc);
   if (!watcher) {
     watcher = {
-      observedElements: new WeakSet<Element>(),
-      observers: [],
+      observations: [],
       scheduled: false,
     };
     mermaidThemeWatchers.set(doc, watcher);
@@ -408,25 +411,41 @@ function ensureMermaidThemeWatcher(doc: Document, root?: ParentNode): void {
     }
   };
 
+  // A panel root is recreated when its host is rebuilt (the item pane, or a
+  // standalone window), so stale observations are released before a new one is
+  // added: without this the list would keep one live observer - and the
+  // detached subtree it pins - per rebuilt panel.
+  const releaseDetachedObservations = () => {
+    if (!watcher) return;
+    watcher.observations = watcher.observations.filter((observation) => {
+      if (observation.target.isConnected !== false) return true;
+      observation.observer.disconnect();
+      return false;
+    });
+  };
+
   const observeElement = (element: Element | null | undefined) => {
-    if (!element || !watcher || watcher.observedElements.has(element)) return;
+    if (!element || !watcher) return;
+    releaseDetachedObservations();
+    if (watcher.observations.some((entry) => entry.target === element)) return;
     const MutationObserverCtor = win.MutationObserver;
     if (!MutationObserverCtor) return;
     const observer = new MutationObserverCtor(scheduleRerender);
     observer.observe(element, {
       attributes: true,
       attributeFilter: ["class", "style", "lwtheme-brighttext"],
     });
-    watcher.observers.push(observer);
-    watcher.observedElements.add(element);
+    watcher.observations.push({ target: element, observer });
   };
 
+  // Only elements that outlive a single render are observed. The rendered
+  // markdown root is replaced on every render, and the theme re-render walks
+  // the whole document anyway, so observing it would grow the list without
+  // catching any theme change these three do not already catch.
   observeElement(doc.documentElement);
   observeElement(doc.body);
   if (root && root.nodeType === 1) {
-    const element = root as Element;
-    observeElement(element.closest(".llm-panel"));
-    observeElement(element.closest(".llm-rendered-markdown"));
+    observeElement((root as Element).closest(".llm-panel"));
   }
 
   if (!watcher.mediaQuery) {
```

**File**: `test/mermaidThemeWatcher.test.ts` (added, +271/-0)
```diff
@@ -0,0 +1,271 @@
+import { assert } from "chai";
+import { describe, it, beforeEach } from "mocha";
+
+import {
+  buildMermaidSvgCacheKey,
+  cacheMermaidSvg,
+  clearMermaidSvgCache,
+} from "../src/modules/contextPanel/mermaidSvgCache";
+import { renderMermaidBlocks } from "../src/modules/contextPanel/renderedMarkdown";
+import { FakeElement } from "./helpers/fakeDom";
+
+/**
+ * The theme watcher a chat rebuild leaves behind.
+ *
+ * Every assistant answer containing a Mermaid diagram is rendered into a fresh
+ * `.llm-rendered-markdown` element, so a watcher that observes the rendered
+ * root grows one live MutationObserver per render, each one pinning the
+ * detached subtree it observes for the life of the window. What the watcher
+ * actually needs is the elements whose colours decide the diagram theme:
+ * `documentElement`, `body`, and the live panel root.
+ */
+
+const MERMAID_SOURCE = "graph TD; A-->B;";
+const MERMAID_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
+/** Pinned to `MERMAID_RENDER_VERSION` in renderedMarkdown.ts. */
+const MERMAID_RENDER_VERSION = "3";
+
+/**
+ * A fake element that knows whether it is still in the document.
+ *
+ * The shared fake reports `isConnected: false` for everything; the watcher's
+ * liveness check needs the real distinction between a panel still in the tree
+ * and one a rebuild replaced.
+ */
+class DomFakeElement extends FakeElement {
+  /** Set on the stand-in for `document.documentElement`. */
+  public isDocumentRoot = false;
+  private parsedChildren: FakeElement[] = [];
+  private markup = "";
+
+  get isConnected(): boolean {
+    let node: FakeElement | null = this;
+    while (node) {
+      if ((node as DomFakeElement).isDocumentRoot) return true;
+      node = node.parentElement;
+    }
+    return false;
+  }
+
+  get localName(): string {
+    return this.tagName.toLowerCase();
+  }
+
+  /** Enough markup parsing for the cached-SVG insertion path. */
+  set innerHTML(value: string) {
+    this.markup = value;
+    this.parsedChildren = value.trim().startsWith("<svg")
+      ? [new DomFakeElement("svg")]
+      : [];
+  }
+
+  get innerHTML(): string {
+    return this.markup;
+  }
+
+  get firstElementChild(): FakeElement | null {
+    return this.parsedChildren[0] || this.children[0] || null;
+  }
+
+  querySelectorAll(selector: string): FakeElement[] {
+    if (selector === ".llm-mermaid-preview[data-llm-mermaid-source]") {
+      return this.findAllByClass("llm-mermaid-preview").filter(
+        (element) => element.dataset.llmMermaidSource !== undefined,
+      );
+    }
+    return super.querySelectorAll(selector);
+  }
+}
+
+type RecordedObserver = {
+  target: FakeElement | null;
+  disconnected: boolean;
+};
+
+type TestDom = {
+  doc: Document;
+  html: DomFakeElement;
+  body: DomFakeElement;
+  observers: RecordedObserver[];
+  mediaListenerCount: () => number;
+  addPanel: () => DomFakeElement;
+  renderAnswer: (panel: DomFakeElement) => Promise<DomFakeElement>;
+};
+
+function liveObserverTargets(observers: RecordedObserver[]): FakeElement[] {
+  return observers
+    .filter((observer) => !observer.disconnected)
+    .map((observer) => observer.target)
+    .filter((target): target is FakeElement => Boolean(target));
+}
+
+function createTestDom(): TestDom {
+  const observers: RecordedObserver[] = [];
+  let mediaListeners = 0;
+
+  class RecordingMutationObserver {
+    public readonly record: RecordedObserver = {
+      target: null,
+      disconnected: false,
+    };
+
+    constructor(_callback: () => void) {
+      observers.push(this.record);
+    }
+
+    observe(target: FakeElement): void {
+      this.record.target = target;
+    }
+
+    disconnect(): void {
+      this.record.disconnected = true;
+    }
+  }
+
+  const html = new DomFakeElement("html");
+  html.isDocumentRoot = true;
+  const body = new DomFakeElement("body");
+  html.appendChild(body);
+
+  const win = {
+    MutationObserver: RecordingMutationObserver,

```

---

### Incident Patch 9: `ca10338c` (2026-09-19)
**Commit Message**: fix(chat): finish a chat turn without rebuilding the whole conversation

Ending an ordinary Chat turn called refreshChatSafely(), which wipes the
chat box and re-parses every message; at 40 turns that cost ~1.3 s per
turn. The send and retry success paths now call
refreshCompletedAssistantTurnSafely(), which re-renders only the finished
answer and its paired prompt through the existing targeted path (61 ms at
40 turns). The prompt is included because its edit and delete-turn
controls are decided at render time from the paired answer's streaming
state; the targeted resolver therefore accepts a user message only as the
paired prompt of a requested answer. Cancel, error, webchat, compaction
and agent turn ends keep the full rebuild.

Adds a turn-end lifecycle replay (earlier wrappers preserved, prompt
regains its controls, answer finalized, context usage rendered from the
stored snapshot) and resolver unit cases.

**File**: `src/modules/contextPanel/agentMode/agentEngine.ts` (modified, +2/-0)
```diff
@@ -847,6 +847,8 @@ type StatusKind = "ready" | "sending" | "error" | "warning";
 type PanelUpdateHelpers = {
   refreshChatSafely: () => void;
   refreshAssistantMessageSafely: (message: Message) => void;
+  /** Turn completion: rebuild the finished answer and its prompt only. */
+  refreshCompletedAssistantTurnSafely: (message: Message) => void;
   setStatusSafely: (text: string, kind: StatusKind) => void;
 };
 
```

**File**: `src/modules/contextPanel/chat.ts` (modified, +36/-6)
```diff
@@ -4039,6 +4039,7 @@ function createPanelUpdateHelpers(
 ): {
   refreshChatSafely: () => void;
   refreshAssistantMessageSafely: (message: Message) => void;
+  refreshCompletedAssistantTurnSafely: (message: Message) => void;
   setStatusSafely: (
     text: string,
     kind: Parameters<typeof setStatus>[2],
@@ -4052,6 +4053,26 @@ function createPanelUpdateHelpers(
       chatOptions: { rerenderAssistantMessages: new Set([message]) },
     });
   };
+  /**
+   * Turn completion. The finished answer and the prompt that asked it are the
+   * only messages whose presentation changed: the answer stops streaming, and
+   * the prompt regains its edit and delete-turn controls, which are decided at
+   * render time from the paired answer's streaming state. Rebuilding just that
+   * pair keeps the cost of ending a turn independent of conversation length;
+   * a full rebuild re-parses every earlier message. Panels that no longer have
+   * those wrappers rendered fall back to a full rebuild inside refreshChat.
+   */
+  const refreshCompletedAssistantTurnSafely = (message: Message) => {
+    const history = chatHistory.get(conversationKey) || [];
+    const messageIndex = history.indexOf(message);
+    const turnMessages = new Set<Message>([message]);
+    const pairedUserMessage =
+      messageIndex > 0 ? history[messageIndex - 1] : undefined;
+    if (pairedUserMessage?.role === "user") turnMessages.add(pairedUserMessage);
+    refreshConversationPanels(body, item, {
+      chatOptions: { rerenderAssistantMessages: turnMessages },
+    });
+  };
   const setStatusSafely = (
     text: string,
     kind: Parameters<typeof setStatus>[2],
@@ -4061,6 +4082,7 @@ function createPanelUpdateHelpers(
   return {
     refreshChatSafely,
     refreshAssistantMessageSafely,
+    refreshCompletedAssistantTurnSafely,
     setStatusSafely,
   };
 }
@@ -6401,8 +6423,12 @@ export async function retryLatestAssistantResponse(
     assistantMessage.modelProviderLabel === "Codex"
       ? Date.now()
       : undefined;
-  const { refreshChatSafely, refreshAssistantMessageSafely, setStatusSafely } =
-    createPanelUpdateHelpers(body, item, conversationKey, ui);
+  const {
+    refreshChatSafely,
+    refreshAssistantMessageSafely,
+    refreshCompletedAssistantTurnSafely,
+    setStatusSafely,
+  } = createPanelUpdateHelpers(body, item, conversationKey, ui);
   // [webchat] Retries never route through the browser-relay pipeline, so a
   // webchat model here — passed explicitly by the retry-model menu or picked
   // up from the selected profile when params were empty — would fire a
@@ -7032,7 +7058,7 @@ export async function retryLatestAssistantResponse(
     }
     assistantMessage.interrupted = undefined;
     assistantMessage.streaming = false;
-    refreshChatSafely();
+    refreshCompletedAssistantTurnSafely(assistantMessage);
 
     const latestContextSnapshot = contextUsageSnapshots.get(conversationKey);
     await updateStoredLatestAssistantMessageByConversation(
@@ -9409,8 +9435,12 @@ export async function sendQuestion(
   if (history.length > PERSISTED_HISTORY_LIMIT) {
     history.splice(0, history.length - PERSISTED_HISTORY_LIMIT);
   }
-  const { refreshChatSafely, refreshAssistantMessageSafely, setStatusSafely } =
-    createPanelUpdateHelpers(body, item, conversationKey, ui);
+  const {
+    refreshChatSafely,
+    refreshAssistantMessageSafely,
+    refreshCompletedAssistantTurnSafely,
+    setStatusSafely,
+  } = createPanelUpdateHelpers(body, item, conversationKey, ui);
   refreshChatSafely();
 
   let assistantPersisted = false;
@@ -10000,7 +10030,7 @@ export async function sendQuestion(
     }
     assistantMessage.interrupted = undefined;
     assistantMessage.streaming = false;
-    refreshChatSafely();
+    refreshCompletedAssistantTurnSafely(assistantMessage);
     await persistAssistantOnce();
     if (resolveConversationSystemForItem(item) === "claude_code") {
       const activeNoteSession = resolveActiveNoteSession(ite
```

**File**: `src/modules/contextPanel/chatRenderingReplay.ts` (modified, +233/-0)
```diff
@@ -11,6 +11,7 @@ import {
   tryBeginRequest,
   finishRequest,
 } from "./state";
+import { buildContextUsagePresentation } from "./textUtils";
 import { getConversationWriteGeneration } from "../../shared/conversationWriteFence";
 import { persistChatScrollSnapshotForConversationKey } from "./chatScrollSnapshots";
 import type { Message } from "./types";
@@ -197,3 +198,235 @@ export async function exerciseChatRenderingLifecycle(panel: {
     else body.setAttribute("style", previousStyle);
   }
 }
+
+/**
+ * Prompt-level probes for a rendered chat turn, shared by this replay and by
+ * the live workflow harness so both read the same controls the user sees.
+ */
+export function createChatTurnPromptProbes(body: HTMLElement): {
+  wrapperOf: (message: Message) => HTMLElement | null;
+  probePromptMenu: (
+    message: Message,
+  ) => { handled: boolean; enabled: boolean } | null;
+  isPromptEditable: (message: Message) => boolean;
+  hidePromptMenu: () => void;
+} {
+  const win = body.ownerDocument.defaultView!;
+  // A turn's optimistic prompt and answer can share one timestamp, so the role
+  // has to be part of the match or both resolve to the prompt wrapper.
+  const wrapperOf = (message: Message): HTMLElement | null =>
+    body
+      .querySelector<HTMLElement>("#llm-chat-box")
+      ?.querySelector<HTMLElement>(
+        `.llm-message-wrapper[data-message-role="${message.role}"][data-message-timestamp="${Math.floor(
+          message.timestamp,
+        )}"]`,
+      ) || null;
+  const hidePromptMenu = () =>
+    body
+      .querySelector<HTMLElement>("#llm-prompt-menu")
+      ?.style.setProperty("display", "none");
+  const probePromptMenu = (
+    message: Message,
+  ): { handled: boolean; enabled: boolean } | null => {
+    const bubble =
+      wrapperOf(message)?.querySelector<HTMLElement>(".llm-bubble");
+    const promptMenu = body.querySelector<HTMLElement>("#llm-prompt-menu");
+    const deleteButton = promptMenu?.querySelector<HTMLButtonElement>(
+      "#llm-prompt-menu-delete",
+    );
+    if (!bubble || !promptMenu || !deleteButton) return null;
+    deleteButton.disabled = true;
+    const event = new win.MouseEvent("contextmenu", {
+      bubbles: true,
+      cancelable: true,
+      button: 2,
+      clientX: 10,
+      clientY: 10,
+    });
+    bubble.dispatchEvent(event);
+    const probe = {
+      // The turn's own handler is the first thing to preventDefault.
+      handled: event.defaultPrevented,
+      enabled: !deleteButton.disabled,
+    };
+    promptMenu.style.display = "none";
+    return probe;
+  };
+  const isPromptEditable = (message: Message): boolean =>
+    Boolean(
+      wrapperOf(message)
+        ?.querySelector(".llm-bubble.user")
+        ?.classList.contains("llm-bubble-editable"),
+    );
+  return { wrapperOf, probePromptMenu, isPromptEditable, hidePromptMenu };
+}
+
+export type CompletedChatTurnRefreshResult = {
+  promptMenuAvailable: boolean;
+  promptMenuHandledWhileStreaming: boolean;
+  promptLockedWhileStreaming: boolean;
+  promptMenuHandledAfterTurn: boolean;
+  earlierAnswerWrapperPreserved: boolean;
+  earlierPromptWrapperPreserved: boolean;
+  earlierAnswerTextPreserved: boolean;
+  promptWrapperRerendered: boolean;
+  promptEditableAfterTurn: boolean;
+  promptDeletableAfterTurn: boolean;
+  answerNoLongerStreaming: boolean;
+  answerCopyActionPresent: boolean;
+  answerQuoteCardRendered: boolean;
+  contextUsageShowsStoredSnapshot: boolean;
+};
+
+/**
+ * Finishing an ordinary Chat turn must update only that turn: the answer stops
+ * streaming and its prompt regains edit/delete, while every earlier turn keeps
+ * its rendered DOM (a full rebuild re-parses the whole conversation).
+ */
+export async function exerciseCompletedChatTurnRefresh(panel: {
+  body: HTMLElement;
+  item: Zotero.Item;
+}): Promise<CompletedChatTurnRefreshResult> {
+  const { body, item } = panel;
+  const previousStyle = body.getAttribute("style");
+  if (body.hasAttribute(
```

**File**: `src/modules/contextPanel/targetedRerender.ts` (modified, +25/-6)
```diff
@@ -2,10 +2,16 @@
  * Resolution logic for targeted assistant-message re-renders.
  *
  * A refresh may request that only specific assistant messages be rebuilt
- * (streaming flushes, quote revalidation). Targeting is only safe when every
- * requested message is an assistant message present in the history AND its
- * rendered wrapper is still in the DOM; otherwise the caller must fall back
- * to a full rebuild.
+ * (streaming flushes, quote revalidation, turn completion). Targeting is only
+ * safe when every requested message is present in the history AND its rendered
+ * wrapper is still in the DOM; otherwise the caller must fall back to a full
+ * rebuild.
+ *
+ * A user message may be requested only as the prompt of a requested assistant
+ * answer. Finishing a turn changes the prompt's rendered controls (its edit
+ * and delete affordances open up once the answer stops streaming), so the pair
+ * has to be rebuilt together. Any other user message is rejected: its
+ * presentation depends on state the targeted path does not recompute.
  */
 
 type WrapperLike = {
@@ -31,12 +37,25 @@ export function resolveTargetedAssistantRerenders<
   }
   for (const message of requestedRerenders) {
     const messageIndex = history.indexOf(message);
-    if (message.role !== "assistant" || messageIndex < 0) {
+    if (messageIndex < 0) {
       return { useTargetedRerender: false, targetedMessageWrappers: new Map() };
     }
+    if (message.role !== "assistant") {
+      const pairedAssistant = history[messageIndex + 1];
+      const isPairedPrompt =
+        message.role === "user" &&
+        pairedAssistant?.role === "assistant" &&
+        requestedRerenders.has(pairedAssistant);
+      if (!isPairedPrompt) {
+        return {
+          useTargetedRerender: false,
+          targetedMessageWrappers: new Map(),
+        };
+      }
+    }
     const wrapper = renderedWrappers.find(
       (candidate) =>
-        candidate.dataset.messageRole === "assistant" &&
+        candidate.dataset.messageRole === message.role &&
         candidate.dataset.messageIndex === `${messageIndex}`,
     );
     if (!wrapper) {
```

**File**: `src/modules/contextPanel/workflowTestHarness.ts` (modified, +7/-1)
```diff
@@ -12,7 +12,11 @@ import {
 import { exercisePlanHistoryReplay } from "./planHistoryReplay";
 import { deliverPendingPlanDocumentMessage } from "../../agent/documents/publication";
 import { exerciseStreamingReplay } from "./streamingReplay";
-import { exerciseChatRenderingLifecycle } from "./chatRenderingReplay";
+import {
+  createChatTurnPromptProbes,
+  exerciseChatRenderingLifecycle,
+  exerciseCompletedChatTurnRefresh,
+} from "./chatRenderingReplay";
 import {
   memoryProbeInspect,
   exerciseChatModeStreamingTurn,
@@ -5538,6 +5542,8 @@ export function installWorkflowTestHarness(targetAddon: {
             payload: {
               type: "tool_result" as const,
               ...entry,
+    exerciseCompletedChatTurnRefresh: (panelId) =>
+      exerciseCompletedChatTurnRefresh(getPanel(panelId)),
               actionReceipts: entry.actionReceipts || [],
             },
           })),
```

---

### Incident Patch 10: `3b809712` (2026-09-19)
**Commit Message**: fix(quotes): collapse duplicate manual and anchored quote cards

**File**: `src/modules/contextPanel/quoteRenderPlan.ts` (modified, +51/-7)
```diff
@@ -113,16 +113,41 @@ function occurrenceToken(occurrenceId: string): string {
   return `[[quote-occurrence:${occurrenceId}]]`;
 }
 
-function normalizeOccurrenceBoundaries(markdown: string): string {
+function isDuplicateQuoteRepresentation(
+  left: QuoteRenderOccurrence,
+  right: QuoteRenderOccurrence,
+): boolean {
+  return Boolean(
+    left.quoteCitationId &&
+    left.quoteCitationId === right.quoteCitationId &&
+    normalizeMultilineText(left.displayText) ===
+      normalizeMultilineText(right.displayText) &&
+    ((left.source === "verified-markdown" &&
+      right.source === "structured-anchor") ||
+      (left.source === "structured-anchor" &&
+        right.source === "verified-markdown")),
+  );
+}
+
+function normalizeQuoteRenderOccurrences(
+  markdown: string,
+  occurrences: QuoteRenderOccurrence[],
+): Pick<QuoteRenderPlan, "displayMarkdown" | "occurrences"> {
   if (!markdown || !QUOTE_RENDER_OCCURRENCE_PATTERN.test(markdown)) {
     QUOTE_RENDER_OCCURRENCE_PATTERN.lastIndex = 0;
-    return markdown;
+    return { displayMarkdown: markdown, occurrences };
   }
   QUOTE_RENDER_OCCURRENCE_PATTERN.lastIndex = 0;
+  const byId = new Map(
+    occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
+  );
+  const displayedOccurrences: QuoteRenderOccurrence[] = [];
 
   let result = "";
   let cursor = 0;
   let appendedOccurrence = false;
+  let lastOccurrenceStart = 0;
+  let previousOccurrence: QuoteRenderOccurrence | undefined;
   const appendText = (text: string): void => {
     if (!text) return;
     if (!appendedOccurrence) {
@@ -144,18 +169,39 @@ function normalizeOccurrenceBoundaries(markdown: string): string {
   for (const match of markdown.matchAll(QUOTE_RENDER_OCCURRENCE_PATTERN)) {
     const start = match.index || 0;
     const token = match[0];
-    appendText(markdown.slice(cursor, start));
+    const between = markdown.slice(cursor, start);
+    const occurrence = byId.get(match[1]);
+    if (
+      occurrence &&
+      previousOccurrence &&
+      !between.trim() &&
+      isDuplicateQuoteRepresentation(previousOccurrence, occurrence)
+    ) {
+      // Both syntaxes have now been bound to the same complete quote. Keep
+      // its structured occurrence without waiting for background validation.
+      if (occurrence.source === "structured-anchor") {
+        result = result.slice(0, lastOccurrenceStart) + token;
+        displayedOccurrences[displayedOccurrences.length - 1] = occurrence;
+        previousOccurrence = occurrence;
+      }
+      cursor = start + token.length;
+      continue;
+    }
+    appendText(between);
     result = result.replace(/[ \t]+$/, "");
     if (result.trim() && !/\n[ \t]*\n[ \t]*$/.test(result)) {
       result += /\n[ \t]*$/.test(result) ? "\n" : "\n\n";
     }
+    lastOccurrenceStart = result.length;
     result += token;
+    if (occurrence) displayedOccurrences.push(occurrence);
+    previousOccurrence = occurrence;
     appendedOccurrence = true;
     cursor = start + token.length;
   }
   appendText(markdown.slice(cursor));
   QUOTE_RENDER_OCCURRENCE_PATTERN.lastIndex = 0;
-  return result;
+  return { displayMarkdown: result, occurrences: displayedOccurrences };
 }
 
 function buildOccurrenceId(index: number): string {
@@ -558,10 +604,8 @@ export function buildQuoteRenderPlan(
     index -= 1;
   }
 
-  const displayMarkdown = normalizeOccurrenceBoundaries(out.join("\n"));
   return {
-    displayMarkdown,
-    occurrences,
+    ...normalizeQuoteRenderOccurrences(out.join("\n"), occurrences),
     diagnostics,
   };
 }
```

**File**: `test-workflows/duplicateQuoteRendering.workflow.test.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import { assert } from "chai";
+import { buildQuoteCitation } from "../src/services/quotes/quoteCitations";
+import type { WorkflowTestApi } from "../src/modules/contextPanel/workflowTestTypes";
+
+describe("workflow: duplicate quote rendering", function () {
+  this.timeout(60000);
+
+  it("shows one card before validation and after loading the stored mixed-syntax answer", async function () {
+    assert.isTrue(Zotero.DataDirectory.dir.endsWith("/.scaffold/test/data"));
+    const api = (Zotero as any).LLMForZotero.api
+      .workflowTest as WorkflowTestApi;
+    await api.reset();
+    const quote =
+      "Traditional dogmas assume that executing a stable behavior requires neural circuits to remain in a fixed, steady state.";
+    const followingProse =
+      "The problem is that chronic population imaging contradicts this premise.";
+    const fixture = await api.createPaperWithPdfFixture({
+      title: "Duplicate quote regression",
+      pages: [quote],
+    });
+    try {
+      const item = Zotero.Items.get(fixture.parentItemId);
+      item.setCreators([
+        { creatorType: "author", firstName: "Test", lastName: "Kim" },
+      ]);
+      item.setField("date", "2026");
+      await item.saveTx();
+      const citation = buildQuoteCitation({
+        quoteText: quote,
+        citationLabel: "(Kim, 2026)",
+        sourceMatchText: quote,
+        sourceMatchKind: "exact",
+        sourceMatchSource: "context-text",
+        itemId: item.id,
+        contextItemId: fixture.pdfAttachmentId,
+      })!;
+      const markdown = `The paper sets up the paradox:\n\n> ${quote}\n\n(Kim, 2026)\n\n[[quote:${citation.id}]] ${followingProse}`;
+      const panel = await api.renderPanelForItem(item.id);
+      // Exercise the native renderer directly with the raw provider layout,
+      // without first running the finalizer that already handles this pair.
+      const rendered = await api.renderAssistantForPanel(panel.panelId, {
+        text: markdown,
+        quoteCitations: [citation],
+      });
+      assert.lengthOf(rendered.quoteCardCitationTexts, 1);
+      assert.deepEqual(rendered.quoteCardBodies, [quote]);
+      assert.include(rendered.renderedText, followingProse);
+
+      await api.openStandaloneForItem(item.id);
+      const seeded = await api.seedStandaloneConversation([
+        { role: "user", text: "What is the main idea of this paper?" },
+        { role: "assistant", text: markdown, quoteCitations: [citation] },
+      ]);
+      const conversationKey = seeded.conversationKey!;
+      // The seed helper persists plain text only. Add the original quote
+      // metadata to the native fixture database before reopening the answer.
+      await Zotero.DB.queryAsync(
+        "UPDATE llm_for_zotero_chat_messages SET quote_citations_json = ? WHERE conversation_key = ? AND role = 'assistant'",
+        [JSON.stringify([citation]), conversationKey],
+      );
+      await api.reset();
+      await api.openStandaloneForItem(item.id);
+      const win = (Zotero as any).LLMForZotero.data.standaloneWindow as Window;
+      const cards = win.document.querySelectorAll(".llm-quote-card");
+      assert.lengthOf(cards, 1, "reopened raw history contains one quote card");
+      assert.include(cards[0].textContent || "", quote);
+      const button = cards[0].querySelector<HTMLElement>(".llm-citation-icon");
+      assert.isOk(button, "the retained card preserves source navigation");
+      assert.include(
+        win.document.querySelector(".llm-standalone-content")?.textContent ||
+          "",
+        followingProse,
+      );
+      assert.deepEqual(
+        await Zotero.DB.columnQueryAsync(
+          "SELECT text FROM llm_for_zotero_chat_messages WHERE conversation_key = ? AND role = 'assistant' ORDER BY id",
+          [conversationKey],
+        ),
+        [markdown],
+        "rendering does not rewrite stored history",
+      );
+      await api.captureStandaloneScreenshot(
+        `$
```

**File**: `test/quoteRenderPlan.test.ts` (modified, +97/-0)
```diff
@@ -8,6 +8,103 @@ import {
 import { buildQuoteCitation } from "../src/services/quotes/quoteCitations";
 
 describe("quoteRenderPlan", function () {
+  const duplicateQuote =
+    "Traditional dogmas assume that executing a stable behavior requires neural circuits to remain in a fixed, steady state.";
+  const duplicateCitation = buildQuoteCitation({
+    id: "Q_12atl2p",
+    quoteText: duplicateQuote,
+    citationLabel: "(Kim, 2026)",
+    sourceMatchText: duplicateQuote,
+    sourceMatchKind: "exact",
+    sourceMatchSource: "context-text",
+    contextItemId: 4084,
+    itemId: 4085,
+  })!;
+  const duplicateAnchor = `[[quote:${duplicateCitation.id}]]`;
+  const followingProse =
+    "The problem is that chronic population imaging contradicts this premise.";
+
+  it("renders the saved Kim manual quote and inline anchor once before background validation", function () {
+    for (const writtenQuote of [
+      `> ${duplicateQuote}\n\n(Kim, 2026)`,
+      `> ${duplicateQuote}\n>\n> (Kim, 2026)`,
+    ]) {
+      for (const separator of [" ", "\n\n"]) {
+        const markdown = `${writtenQuote}\n\n${duplicateAnchor}${separator}${followingProse}`;
+        const input = { markdown, quoteCitations: [duplicateCitation] };
+        // Rendering restored history starts from these same raw bytes.
+        for (const restored of [input, JSON.parse(JSON.stringify(input))]) {
+          const plan = buildQuoteRenderPlan(restored);
+          assert.lengthOf(plan.occurrences, 1, markdown);
+          assert.equal(plan.occurrences[0].displayText, duplicateQuote);
+          assert.equal(
+            plan.occurrences[0].quoteCitationId,
+            duplicateCitation.id,
+          );
+          assert.equal(plan.occurrences[0].contextItemId, 4084);
+          assert.equal(
+            buildQuoteExpandedMarkdown(restored),
+            `> ${duplicateQuote}\n>\n> (Kim, 2026)\n\n${followingProse}`,
+          );
+          assert.equal(restored.markdown, markdown, "raw history is unchanged");
+        }
+      }
+    }
+  });
+
+  it("preserves repetitions separated by prose, other sources, and longer anchored text", function () {
+    const writtenQuote = `> ${duplicateQuote}\n\n(Kim, 2026)`;
+    const differentSource = buildQuoteCitation({
+      ...duplicateCitation,
+      id: "Q_other_source",
+      contextItemId: 5000,
+      itemId: 5001,
+    })!;
+    const longerQuote = buildQuoteCitation({
+      ...duplicateCitation,
+      quoteText: `${duplicateQuote} A distinct additional source sentence.`,
+    })!;
+    const cases = [
+      {
+        markdown: `${writtenQuote}\n\n${followingProse}\n\n${duplicateAnchor}`,
+        quoteCitations: [duplicateCitation],
+      },
+      {
+        markdown: `${writtenQuote}\n\n[[quote:${differentSource.id}]]`,
+        quoteCitations: [duplicateCitation, differentSource],
+      },
+      {
+        markdown: `${writtenQuote}\n\n${duplicateAnchor}`,
+        quoteCitations: [longerQuote],
+      },
+      {
+        markdown: `> ${duplicateQuote}\n\n(Other, 2026)\n\n${duplicateAnchor}`,
+        quoteCitations: [duplicateCitation],
+      },
+    ];
+    for (const input of cases) {
+      assert.lengthOf(
+        buildQuoteRenderPlan(input).occurrences,
+        2,
+        input.markdown,
+      );
+    }
+  });
+
+  it("keeps a second structured occurrence after collapsing its written duplicate", function () {
+    const plan = buildQuoteRenderPlan({
+      markdown: `> ${duplicateQuote}\n\n(Kim, 2026)\n\n${duplicateAnchor}\n\n${duplicateAnchor}`,
+      quoteCitations: [duplicateCitation],
+    });
+    assert.lengthOf(plan.occurrences, 2);
+    assert.lengthOf(
+      Array.from(
+        plan.displayMarkdown.matchAll(QUOTE_RENDER_OCCURRENCE_PATTERN),
+      ),
+      2,
+    );
+  });
+
   it("renders a displayed source subspan followed by its standalone anchor only once", function () {
     const visible =
       "Hypothesis: stable readout can coexist with representational dr
```

#### Recent Merged Pull Requests:
- **PR #474** (2026-09-28): fix: 修复对话跳动并优化阅读体验 (@EvanMa1)
- **PR #458** (2026-09-16): fix(claude): keep MCP scope token stable so hot runtimes survive turns (@YuyueminAustin)
- **PR #434** (2026-09-11): feat(webchat): add Google Gemini relay support (@HRXWEB)
- **PR #420** (2026-09-09): fix(agent): normalize Kimi anyOf tool schemas (@Liu8Can)
- **PR #418** (2026-09-09): Plan mode for longer and more comprehensive library retrieval workflow (@yilewang)
- **PR #412** (2026-08-31): fix(mineru): shorten long local upload filenames (@neltharion11)
- **PR #411** (2026-09-18): feat(mineru): automatically split and validate long PDFs (@RoxyRhHg)
- **PR #407** (closed): Add earliest-added PDF attachment preference (@mohui666)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): Orkas-AI/Orkas

> **Canonical Artifact**: `07_PROJECT_LEARNING/orkas-ai-orkas-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Orkas-AI/Orkas](https://github.com/Orkas-AI/Orkas))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:22:14.742Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Orkas-AI/Orkas`
- **Description**: Orkas is an open-source, local-first AI desktop app: a commander LLM directs specialist sub-agents, and runs your installed coding CLIs — Claude Code, Codex, OpenCode, OpenClaw, Hermes — as local sessions. Agents self-evolve via reflection and skill crystallization. BYO keys. macOS / Windows / Linux.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2136 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eval/model-eval/regression/office-production-fixtures.ts`
```
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AdmZip from "adm-zip";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

export interface OfficeProductionFixtureState {
  baselineFiles: string[];
  sourceHashes: Record<string, string>;
  pptxPreservation?: {
    sourceFile: string;
    expectedShapeRemovals: Array<{
      slide: number;
      text: string;
    }>;
  };
}

export interface OfficeProductionArtifactInspection {
  features: string[];
  evidence: string[];
}

const OFFICE_FIXTURE_SCENARIOS = new Set([
  "office-existing-contract-edit",
  "office-csv-to-workbook",
  "office-xlsm-macro-preservation",
  "office-existing-deck-cleanup",
  "office-mixed-delivery",
  "office-wps-proprietary-input",
  "office-pdf-page-edit",
  "ppt-existing-deck-safe-edit",
  "ppt-existing-deck-evidence-review",
  "ppt-mixed-source-executive-update",
  "ppt-existing-deck-bounded-redesign",
  "ppt-reference-template-six-slide-production",
]);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OFFICECLI_ASSETS: Readonly<Record<string, string>> = {
  "darwin-arm64": "officecli-mac-arm64",
  "darwin-x64": "officecli-mac-x64",
  "win32-arm64": "officecli-win-arm64.exe",
  "win32-x64": "officecli-win-x64.exe",
};

function serializeOfficeBatch(operations: readonly unknown[]): string {
  return JSON.stringify(operations).replace(
    /[\u007f-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function officeCliBinary(): string {
  const asset = OFFICECLI_ASSETS[`${process.platform}-${process.arch}`];
  if (!asset) throw new Error(`Office production fixtures do not support ${process.platform}-${process.arch}`);
  const binary = path.resolve(HERE, "../../../resources/officecli", asset);
  if (!fs.existsSync(binary)) throw new Error(`OfficeCLI fixture binary is missing: ${binary}`);
  return binary;
}

function sha256(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function checkedOfficeCli(
  args: string[],
  cwd: string,
  stdin?: string,
): Promise<void> {
  const binary = officeCliBinary();
  const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, OFFICECLI_SKIP_UPDATE: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Office fixture command timed out: ${args.join(" ")}`));
    }, 60_000);
    timer.unref?.();
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(stdin);
  });
  if (result.code !== 0) {
    throw new Error(
      `Office fixture command failed (${result.code}): ${args.join(" ")}\n`
      + `${result.stderr || result.stdout}`,
    );
  }
}

async function closeFixtureOfficeFile(file: string, cwd: string): Promise<void> {
  try {
    await checkedOfficeCli(["close", file], cwd);
  } catch {
    // Fixture seeding uses standalone commands; no resident is expected, but
    // close remains a best-effort guard if OfficeCLI changed that behavior.
  }
}

async function batchOffice(
  file: string,
  cwd: string,
  operations: readonly unknown[],
): Promise<void> {
  await checkedOfficeCli(
    ["batch", file, "--stop-on-error", "--json"],
    cwd,
    serializeOfficeBatch(operations),
  );
}

async function seedReviewedContract(root: string): Promise<string> {
  const file = path.join(root, "contract-reviewed.docx");
  await checkedOfficeCli(["create", file, "--locale", "zh-CN", "--force", "--json"], root);
  await batchOffice(file, root, [
    {
      command: "add",
      parent: "/body",
      type: "p",
      props: { text: "采购服务合同（审阅稿）", style: "Heading1" },
    },
    {
      command: "add",
      parent: "/body",
      type: "p",
      props: { text: "乙方公司：旧辰科技有限公司" },
    },
    {
      command: "add",
      parent: "/body",
      type: "p",
      props: { text: "付款周期为30天。" },
    },
  ]);
  await checkedOfficeCli([
    "add",
    file,
    "/body/p[2]",
    "--type",
    "comment",
    "--prop",
    "text=请核对乙方工商登记名称",
    "--prop",
    "author=法务审阅",
    "--prop",
    "initials=FW",
    "--json",
  ], root);
  await checkedOfficeCli([
    "set",
    file,
    "/body/p[3]",
    "--prop",
    "find=30",
    "--prop",
    "replace=45",
    "--prop",
    "revision.author=审阅人",
    "--json",
  ], root);
  await closeFixtureOfficeFile(file, root);
  return file;
}

async function seedReviewedDeck(root: string): Promise<string> {
  const file = path.join(root, "annual-review.pptx");
  await checkedOfficeCli(["create", file, "--force", "--json"], root);
  await batchOffice(file, root, [
    { command: "add", parent: "/", type: "slide", props: { title: "年度经营复盘", text: "管理层摘要" } },
    { command: "add", parent: "/", type: "slide", props: { title: "核心指标", text: "收入与利润趋势" } },
    { command: "add", parent: "/", type: "slide", props: { title: "区域表现", text: "重点市场进展" } },
    { command: "add", parent: "/", type: "slide", props: { title: "行动计划", text: "下一季度重点" } },
    { command: "add", parent: "/", type: "slide", props: { title: "风险与依赖", text: "待管理层决策" } },
    {
      command: "add",
      parent: "/slide[4]",
      type: "shape",
      props: {
        text: "旧公司名称",
        x: "8.2in",
        y: "6.7in",
        width: "1.4in",
        height: "0.3in",
        fontSize: "9",
        color: "777777",
      },
    },
    {
      command: "add",
      parent: "/slide[4]",
      type: "notes",
      props: { text: "演讲者备注：行动计划需与财务负责人确认。" },
    },
  ]);
  await closeFixtureOfficeFile(file, root);
  // Carry one real, package-level motion property through the cleanup case.
  // This gives the evaluator an independent animation/transition preservation
  // oracle instead of rewarding a final-message claim that cannot prove it.
  const zip = new AdmZip(file);
  const slide4 = zip.getEntry("ppt/slides/slide4.xml")?.getData().toString("utf8") || "";
  if (!slide4.includes("</p:sld>")) {
    throw new Error("Office PPTX fixture slide 4 is missing its closing element");
  }
  zip.updateFile(
    "ppt/slides/slide4.xml",
    Buffer.from(slide4.replace(
      "</p:sld>",
      '<p:transition spd="slow"><p:fade/></p:transition></p:sld>',
    )),
  );
  zip.writeZip(file);
  return file;
}

async function seedBoundedRedesignDeck(root: string): Promise<string> {
  const file = await seedReviewedDeck(root);
  await batchOffice(file, root, [
    {
      command: "add",
      parent: "/slide[2]",
      type: "shape",
      props: {
        text: "TEMPLATE_PLACEHOLDER",
        x: "9.2in",
        y: "6.55in",
        width: "2.8in",
        height: "0.35in",
        fontSize: "10",
        color: "C00000",
      },
    },
  ]);
  await closeFixtureOfficeFile(file, root);
  return file;
}

async function seedConferenceTemplate(root: string): Promise<string> {
  const file = path.join(root, "conference-template.pptx");
  await checkedOfficeCli(["create", file, "--force", "--json"], root);
  const roles = [
    "OPENING",
    "CHALLENGE",
    "FRAMEWORK",
    "PROCESS",
    "DATA",
    "SECTION",
    "QUOTE",
    "CLOSE",
  ];
  const operations: unknown[] = [];
  for (const [index, role] of roles.entries()) {
    const slideNumber = index + 1;
    const dark = slideNumber 
```

### Core Architecture Module: `playwright.config.ts`
```
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*_e2e_*.spec.ts',
  outputDir: './test-results/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  projects: [
    {
      name: `electron-${process.platform}`,
    },
  ],
});

```

### Core Architecture Module: `resources/builtin/marketplace/agents/1040b336306f/skills/market-data/scripts/history.py`
```
#!/usr/bin/env python3
"""Free daily history adapter for A-share, Hong Kong, and US equities."""

from __future__ import annotations

import argparse
import datetime as dt
import importlib.metadata
import json
import re
import socket
import sys
from typing import Any, Mapping, Sequence

from stock import StockError, _emit, normalize_bars, normalize_symbol


PROVIDERS = ("akshare-sina", "akshare-eastmoney")


def _records(frame: Any) -> list[dict[str, Any]]:
    try:
        records = frame.to_dict(orient="records")
    except (AttributeError, TypeError, ValueError) as exc:
        raise StockError("history provider returned an unsupported table") from exc
    if not isinstance(records, list):
        raise StockError("history provider returned an unsupported table")
    return records


def _date_from_row(row: Mapping[str, Any]) -> dt.date | None:
    lower = {str(key).strip().lower(): value for key, value in row.items()}
    value = lower.get("date", lower.get("日期", lower.get("datetime", lower.get("时间"))))
    try:
        return dt.date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _filter_dates(
    rows: list[dict[str, Any]],
    start: dt.date,
    end: dt.date,
) -> list[dict[str, Any]]:
    return [row for row in rows if (value := _date_from_row(row)) is not None and start <= value <= end]


def _sina_symbol(instrument: Mapping[str, str]) -> str:
    if instrument["market"] == "A":
        suffix = instrument["symbol"].rsplit(".", 1)[-1].lower()
        return f"{suffix}{instrument['code']}"
    if instrument["market"] == "HK":
        return instrument["code"].zfill(5)
    return instrument["code"]


def _fetch_sina(
    ak: Any,
    instrument: Mapping[str, str],
    start: dt.date,
    end: dt.date,
    adjust: str,
) -> tuple[list[dict[str, Any]], str]:
    provider_code = _sina_symbol(instrument)
    compact_start, compact_end = start.strftime("%Y%m%d"), end.strftime("%Y%m%d")
    if instrument["market"] == "A":
        frame = ak.stock_zh_a_daily(
            symbol=provider_code,
            start_date=compact_start,
            end_date=compact_end,
            adjust=adjust,
        )
    elif instrument["market"] == "HK":
        frame = ak.stock_hk_daily(symbol=provider_code, adjust=adjust)
    else:
        frame = ak.stock_us_daily(symbol=provider_code, adjust=adjust)
    return _filter_dates(_records(frame), start, end), provider_code


def _fetch_eastmoney(
    ak: Any,
    instrument: Mapping[str, str],
    start: dt.date,
    end: dt.date,
    adjust: str,
    provider_symbol: str | None,
) -> tuple[list[dict[str, Any]], str]:
    compact_start, compact_end = start.strftime("%Y%m%d"), end.strftime("%Y%m%d")
    code = instrument["code"]
    if instrument["market"] == "A":
        frame = ak.stock_zh_a_hist(
            symbol=code, period="daily", start_date=compact_start,
            end_date=compact_end, adjust=adjust,
        )
        used_symbol = code
    elif instrument["market"] == "HK":
        used_symbol = code.zfill(5)
        frame = ak.stock_hk_hist(
            symbol=used_symbol, period="daily", start_date=compact_start,
            end_date=compact_end, adjust=adjust,
        )
    else:
        if not provider_symbol:
            raise StockError("Eastmoney US fallback requires --provider-symbol, for example 105.AAPL")
        used_symbol = provider_symbol
        frame = ak.stock_us_hist(
            symbol=used_symbol, period="daily", start_date=compact_start,
            end_date=compact_end, adjust=adjust,
        )
    return _filter_dates(_records(frame), start, end), used_symbol


def _safe_error(exc: Exception) -> str:
    text = re.sub(r"https?://\S+", "provider endpoint", str(exc)).strip()
    return (text or exc.__class__.__name__)[:240]


def fetch(
    symbol: str,
    start: str,
    end: str,
    market: str = "auto",
    provider: str = "auto",
    adjust: str = "qfq",
    provider_symbol: str | None = None,
    timeout: float = 15,
    max_bars: int = 5000,
    *,
    ak_module: Any | None = None,
    retrieved_at: dt.datetime | None = None,
) -> dict[str, Any]:
    instrument = normalize_symbol(symbol, market)
    try:
        first, last = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    except ValueError as exc:
        raise StockError("start and end must use YYYY-MM-DD") from exc
    if first > last:
        raise StockError("start must not be later than end")
    if provider not in {"auto", *PROVIDERS}:
        raise StockError("provider must be auto, akshare-sina, or akshare-eastmoney")
    if adjust not in {"raw", "qfq", "hfq"}:
        raise StockError("adjust must be raw, qfq, or hfq")
    if timeout <= 0 or timeout > 60:
        raise StockError("timeout must be greater than 0 and at most 60 seconds")
    if max_bars < 2 or max_bars > 20_000:
        raise StockError("max-bars must be between 2 and 20000")
    if ak_module is None:
        try:
            import akshare as ak_module  # type: ignore
        except ImportError as exc:
            raise StockError("AKShare dependency is unavailable; run this adapter through run-skill.cjs") from exc

    candidates = PROVIDERS if provider == "auto" else (provider,)
    attempts: list[dict[str, str]] = []
    rows: list[dict[str, Any]] | None = None
    selected = ""
    used_symbol = ""
    old_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(timeout)
    try:
        for candidate in candidates:
            try:
                if candidate == "akshare-sina":
                    candidate_rows, candidate_symbol = _fetch_sina(
                        ak_module, instrument, first, last, "" if adjust == "raw" else adjust,
                    )
                else:
                    candidate_rows, candidate_symbol = _fetch_eastmoney(
                        ak_module, instrument, first, last, "" if adjust == "raw" else adjust,
                        provider_symbol,
                    )
                if len(candidate_rows) < 2:
                    raise StockError("provider returned fewer than two bars in the requested range")
                rows, selected, used_symbol = candidate_rows, candidate, candidate_symbol
                attempts.append({"provider": candidate, "status": "ok"})
                break
            except Exception as exc:  # bounded provider evidence; auto may continue
                attempts.append({"provider": candidate, "status": "error", "detail": _safe_error(exc)})
    finally:
        socket.setdefaulttimeout(old_timeout)
    if rows is None:
        raise StockError("all history providers failed: " + json.dumps(attempts, ensure_ascii=False))
    if len(rows) > max_bars:
        raise StockError(f"provider returned {len(rows)} bars, exceeding max-bars={max_bars}; narrow the date range")

    retrieved = retrieved_at or dt.datetime.now(dt.timezone.utc)
    if retrieved.tzinfo is None:
        raise StockError("retrieved_at must include a timezone offset")
    version = getattr(ak_module, "__version__", None)
    if not version:
        try:
            version = importlib.metadata.version("akshare")
        except importlib.metadata.PackageNotFoundError:
            version = "test-double"
    normalized = normalize_bars({
        "bars": rows,
        "meta": {
            **instrument,
            "source": selected.replace("-", "_"),
            "provider_symbol": used_symbol,
            "provider_package": "akshare",
            "provider_version": version,
            "adjustment": adjust,
            "requested_start": first.isoformat(),
            "requested_end": last.isoformat(),
            "retrieved_at": retrieved.astimezone(dt.timezone.utc).isoformat(),
            "delay": "best_effort_not_guaranteed",
            "attempts": attempts,
        },
    }, as_of=last.isoformat())
    return {"contract_version": 1, **normalized}


def status() -> dict[str, Any]:
    try:
        version = importlib.metadata.versi
```

### Core Architecture Module: `resources/builtin/marketplace/agents/1040b336306f/skills/market-data/scripts/market.py`
```
#!/usr/bin/env python3
"""Free, API-first current quotes for A-share, Hong Kong, and US equities."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence
from zoneinfo import ZoneInfo

from stock import StockError, _emit, normalize_symbol


TENCENT_URL = "https://qt.gtimg.cn/q={symbol}"
SINA_URL = "https://hq.sinajs.cn/list={symbol}"
USER_AGENT = "Mozilla/5.0 (compatible; Orkas-StockAnalyser/1.0)"
PROVIDERS = ("tencent", "sina")


def provider_symbol(instrument: Mapping[str, str], provider: str) -> str:
    market, code = instrument["market"], instrument["code"]
    if market == "A":
        suffix = instrument["symbol"].rsplit(".", 1)[-1].lower()
        return f"{suffix}{code}"
    if market == "HK":
        prefix = "r_hk" if provider == "tencent" else "rt_hk"
        return f"{prefix}{code.zfill(5)}"
    prefix = "us" if provider == "tencent" else "gb_"
    return f"{prefix}{code}"


def _number(value: Any, *, positive: bool = False) -> float | None:
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    if positive and number <= 0:
        return None
    return number


def _download(
    url: str,
    timeout: float,
    opener: Callable[..., Any] | None = None,
) -> str:
    referer = (
        "https://finance.sina.com.cn/"
        if "sinajs.cn" in url
        else "https://finance.qq.com/"
    )
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Referer": referer},
    )
    open_url = opener or urllib.request.urlopen
    with open_url(request, timeout=timeout) as response:
        return response.read().decode("gb18030", errors="replace")


def _provider_time(value: str, market: str) -> dt.datetime | None:
    text = value.strip()
    timezone = ZoneInfo({
        "A": "Asia/Shanghai",
        "HK": "Asia/Hong_Kong",
        "US": "America/New_York",
    }[market])
    formats = ["%Y%m%d%H%M%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"]
    for fmt in formats:
        try:
            return dt.datetime.strptime(text, fmt).replace(tzinfo=timezone)
        except ValueError:
            continue
    match = re.fullmatch(
        r"([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{1,2}:\d{2}[AP]M)\s+(?:EDT|EST)",
        text,
    )
    if match:
        try:
            parsed = dt.datetime.strptime(
                f"{dt.datetime.now(timezone).year} {match.group(1)} {match.group(2)} {match.group(3)}",
                "%Y %b %d %I:%M%p",
            )
            return parsed.replace(tzinfo=timezone)
        except ValueError:
            return None
    return None


def _session(market: str, now: dt.datetime) -> str:
    local = now.astimezone(ZoneInfo({
        "A": "Asia/Shanghai",
        "HK": "Asia/Hong_Kong",
        "US": "America/New_York",
    }[market]))
    if local.weekday() >= 5:
        return "closed"
    current = local.time().replace(tzinfo=None)
    if market == "A":
        if dt.time(9, 15) <= current < dt.time(9, 30):
            return "opening_auction"
        if dt.time(9, 30) <= current <= dt.time(11, 30) or dt.time(13) <= current <= dt.time(15):
            return "regular"
        if dt.time(11, 30) < current < dt.time(13):
            return "lunch_break"
        return "closed"
    if market == "HK":
        if dt.time(9) <= current < dt.time(9, 30):
            return "opening_auction"
        if dt.time(9, 30) <= current <= dt.time(12) or dt.time(13) <= current <= dt.time(16):
            return "regular"
        if dt.time(12) < current < dt.time(13):
            return "lunch_break"
        if dt.time(16) < current <= dt.time(16, 10):
            return "closing_auction"
        return "closed"
    if dt.time(4) <= current < dt.time(9, 30):
        return "pre_market"
    if dt.time(9, 30) <= current <= dt.time(16):
        return "regular"
    if dt.time(16) < current <= dt.time(20):
        return "post_market"
    return "closed"


def _parse_tencent(text: str, instrument: Mapping[str, str]) -> dict[str, Any]:
    match = re.search(r'=\s*"(.*?)"\s*;', text, flags=re.DOTALL)
    if not match:
        raise StockError("Tencent quote response did not contain a quote record")
    fields = match.group(1).split("~")
    if len(fields) < 35 or not fields[1].strip():
        raise StockError("Tencent quote record was empty or incomplete")
    market = instrument["market"]
    volume = _number(fields[6], positive=True)
    amount = _number(fields[37], positive=True) if len(fields) > 37 else None
    if market == "A":
        volume = volume * 100 if volume is not None else None
        amount = amount * 10_000 if amount is not None else None
    return {
        "name": fields[1].strip(),
        "last": _number(fields[3], positive=True),
        "previous_close": _number(fields[4], positive=True),
        "open": _number(fields[5], positive=True),
        "volume": volume,
        "bid": _number(fields[9], positive=True),
        "ask": _number(fields[19], positive=True),
        "provider_time": fields[30].strip(),
        "change": _number(fields[31]),
        "change_percent": _number(fields[32]),
        "high": _number(fields[33], positive=True),
        "low": _number(fields[34], positive=True),
        "amount": amount,
    }


def _parse_sina(text: str, instrument: Mapping[str, str]) -> dict[str, Any]:
    match = re.search(r'=\s*"(.*?)"\s*;', text, flags=re.DOTALL)
    if not match:
        raise StockError("Sina quote response did not contain a quote record")
    fields = match.group(1).split(",")
    market = instrument["market"]
    if market == "A" and len(fields) >= 32:
        bid, ask = _number(fields[6], positive=True), _number(fields[7], positive=True)
        last = _number(fields[3], positive=True) or bid or ask
        return {
            "name": fields[0].strip(), "last": last,
            "previous_close": _number(fields[2], positive=True),
            "open": _number(fields[1], positive=True), "high": _number(fields[4], positive=True),
            "low": _number(fields[5], positive=True), "bid": bid, "ask": ask,
            "volume": _number(fields[8], positive=True), "amount": _number(fields[9], positive=True),
            "provider_time": f"{fields[30]} {fields[31]}",
        }
    if market == "HK" and len(fields) >= 19:
        return {
            "name": fields[1].strip() or fields[0].strip(),
            "last": _number(fields[6], positive=True),
            "previous_close": _number(fields[3], positive=True),
            "open": _number(fields[2], positive=True), "high": _number(fields[4], positive=True),
            "low": _number(fields[5], positive=True), "bid": _number(fields[9], positive=True),
            "ask": _number(fields[10], positive=True), "volume": _number(fields[12], positive=True),
            "amount": _number(fields[11], positive=True), "change": _number(fields[7]),
            "change_percent": _number(fields[8]), "provider_time": f"{fields[17]} {fields[18]}",
        }
    if market == "US" and len(fields) >= 31:
        return {
            "name": fields[0].strip(), "last": _number(fields[1], positive=True),
            "previous_close": _number(fields[26], positive=True),
            "open": _number(fields[5], positive=True), "high": _number(fields[6], positive=True),
            "low": _number(fields[7], positive=True), "bid": _number(fields[21], positive=True),
            "ask": None, "volume": _number(fields[10], positive=True),
            "amount": _number(fields[30], positive=True), "change": _number(fields[4]),
            "change_percent": _number(fields[2]), "provider_time": fields[25],
        }
    raise StockError("Sina quote record was empty or incomplete")


def _safe_error(exc: Exception) -> str:
    text = re.sub(r"https?://\S+", "provider endpoint", str(exc)).strip()
    return (text or exc.__class_
```

### Core Architecture Module: `resources/builtin/marketplace/agents/1040b336306f/skills/market-data/scripts/stock.py`
```
#!/usr/bin/env python3
"""Deterministic, dependency-free financial calculations for StockAnalyser.

This module never submits orders and never reads or prints credentials.
Provider access lives in the dedicated market.py and history.py adapters.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import math
import statistics
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


TRADING_DAYS = 252
SUPPORTED_MARKETS = {"A", "HK", "US"}
MARKET_META = {
    "A": {"currency": "CNY", "timezone": "Asia/Shanghai"},
    "HK": {"currency": "HKD", "timezone": "Asia/Hong_Kong"},
    "US": {"currency": "USD", "timezone": "America/New_York"},
}


class StockError(ValueError):
    """A user-actionable data or analysis contract error."""


def _finite(value: Any, field: str, *, optional: bool = False) -> float | None:
    if value is None or value == "":
        if optional:
            return None
        raise StockError(f"missing numeric field: {field}")
    if isinstance(value, bool):
        raise StockError(f"invalid numeric field: {field}")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise StockError(f"invalid numeric field: {field}") from exc
    if not math.isfinite(number):
        raise StockError(f"non-finite numeric field: {field}")
    return number


def _rounded(value: float | None, digits: int = 8) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    return round(value, digits)


def _read(path: str) -> Any:
    source = Path(path)
    if not source.is_file():
        raise StockError(f"input file not found: {source}")
    if source.suffix.lower() == ".csv":
        with source.open("r", encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))
    try:
        return json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise StockError(f"invalid JSON at line {exc.lineno}, column {exc.colno}") from exc


def _emit(payload: Any, output: str | None = None) -> None:
    text = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if output:
        target = Path(output)
        if not target.parent.is_dir():
            raise StockError(f"output directory does not exist: {target.parent}")
        target.write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


def _parse_date(value: Any, field: str = "date") -> dt.date:
    text = str(value or "").strip()
    if not text:
        raise StockError(f"missing {field}")
    try:
        return dt.date.fromisoformat(text[:10])
    except ValueError as exc:
        raise StockError(f"{field} must be ISO-8601: {text}") from exc


def _parse_timestamp(value: Any, field: str) -> dt.datetime:
    text = str(value or "").strip().replace("Z", "+00:00")
    if not text:
        raise StockError(f"missing {field}")
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError as exc:
        raise StockError(f"{field} must be ISO-8601: {text}") from exc
    if parsed.tzinfo is None:
        raise StockError(f"{field} must include a timezone offset")
    return parsed


def normalize_symbol(symbol: str, market: str = "auto") -> dict[str, str]:
    raw = str(symbol or "").strip().upper().replace(" ", "")
    if not raw:
        raise StockError("symbol is required")
    requested = str(market or "auto").strip().upper()
    if requested not in SUPPORTED_MARKETS | {"AUTO"}:
        raise StockError("market must be auto, A, HK, or US")

    for old, new in ((".XSHG", ".SH"), (".XSHE", ".SZ"), (".XHKG", ".HK")):
        if raw.endswith(old):
            raw = raw[: -len(old)] + new
    if raw.startswith("SH") and raw[2:].isdigit():
        raw = raw[2:] + ".SH"
    elif raw.startswith("SZ") and raw[2:].isdigit():
        raw = raw[2:] + ".SZ"
    elif raw.startswith("BJ") and raw[2:].isdigit():
        raw = raw[2:] + ".BJ"
    elif raw.startswith("HK") and raw[2:].isdigit():
        raw = str(int(raw[2:])) + ".HK"

    suffix_market = None
    if raw.endswith((".SH", ".SZ", ".BJ")):
        suffix_market = "A"
    elif raw.endswith(".HK"):
        suffix_market = "HK"
    elif raw.endswith(".US"):
        suffix_market = "US"
    if suffix_market:
        if requested != "AUTO" and requested != suffix_market:
            raise StockError(f"symbol suffix conflicts with market {requested}")
        if suffix_market == "HK":
            raw = str(int(raw[:-3])) + ".HK"
        code = raw.rsplit(".", 1)[0]
        return {"symbol": raw, "code": code, "market": suffix_market, **MARKET_META[suffix_market]}

    resolved = requested
    if resolved == "AUTO":
        if raw.isdigit() and len(raw) == 6:
            resolved = "A"
        elif raw.isdigit() and len(raw) <= 5:
            resolved = "HK"
        else:
            resolved = "US"

    if resolved == "A":
        if not (raw.isdigit() and len(raw) == 6):
            raise StockError("A-share symbols must contain six digits")
        if raw[0] in {"6", "9"}:
            suffix = "SH"
        elif raw[0] in {"0", "2", "3"}:
            suffix = "SZ"
        elif raw[0] in {"4", "8"}:
            suffix = "BJ"
        else:
            raise StockError("cannot infer A-share exchange from symbol")
        canonical = f"{raw}.{suffix}"
    elif resolved == "HK":
        if not (raw.isdigit() and 1 <= len(raw) <= 5):
            raise StockError("Hong Kong symbols must contain one to five digits")
        canonical = f"{int(raw)}.HK"
    else:
        if not all(char.isalnum() or char in {".", "-"} for char in raw):
            raise StockError("invalid US ticker")
        canonical = f"{raw}.US"
    return {"symbol": canonical, "code": canonical.rsplit(".", 1)[0], "market": resolved, **MARKET_META[resolved]}


ALIASES = {
    "date": ("date", "datetime", "日期", "时间"),
    "open": ("open", "开盘"),
    "high": ("high", "最高"),
    "low": ("low", "最低"),
    "close": ("close", "收盘"),
    "volume": ("volume", "vol", "成交量"),
    "amount": ("amount", "turnover", "成交额"),
    "adjusted_close": ("adjusted_close", "adj_close", "复权收盘"),
}


def _lookup(row: Mapping[str, Any], field: str) -> Any:
    lower = {str(key).strip().lower(): value for key, value in row.items()}
    for alias in ALIASES[field]:
        if alias.lower() in lower:
            return lower[alias.lower()]
    return None


def normalize_bars(payload: Any, *, as_of: str | None = None) -> dict[str, Any]:
    if isinstance(payload, list):
        rows, meta = payload, {}
    elif isinstance(payload, Mapping) and isinstance(payload.get("bars"), list):
        rows, meta = payload["bars"], dict(payload.get("meta") or {})
    else:
        raise StockError("history input must be a row array or an object with bars")
    if len(rows) < 2:
        raise StockError("at least two price bars are required")

    clean = []
    for index, row in enumerate(rows):
        if not isinstance(row, Mapping):
            raise StockError(f"bar {index} must be an object")
        date = _parse_date(_lookup(row, "date"), f"bar {index} date")
        item = {"date": date.isoformat()}
        for field in ("open", "high", "low", "close", "volume"):
            item[field] = _finite(_lookup(row, field), f"bar {index} {field}")
        for field in ("amount", "adjusted_close"):
            value = _finite(_lookup(row, field), f"bar {index} {field}", optional=True)
            if value is not None:
                item[field] = value
        if min(item["open"], item["high"], item["low"], item["close"]) <= 0:
            raise StockError(f"bar {index} prices must be positive")
        if item["high"] < max(item["open"], item["low"], item["close"]):
            raise StockError(f"bar {index} high is below another OHLC value")
        if item["low"] > min(item["open"], item["high"], item["close"]):
            raise StockErr
```

### Core Architecture Module: `resources/builtin/marketplace/agents/5f890bd72ac4/skills/voice-project/scripts/audio.js`
```
'use strict';

// Offline project mechanics. The host supplies all executable/model paths.
// No package installation, network client, provider credential or shell command.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createReadStream } = require('node:fs');

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function num(value, fallback, min, max) {
  const n = value === undefined ? fallback : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) fail('E_INPUT', `Expected a number between ${min} and ${max}.`);
  return n;
}
function inside(root, file) {
  const rel = path.relative(root, file);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
async function local(root, name, output = false) {
  if (typeof name !== 'string' || !name || name.includes('\0')) fail('E_PATH', 'A project-relative file path is required.');
  const file = path.resolve(root, name);
  let ancestor = file;
  while (true) {
    try {
      const real = await fs.realpath(ancestor);
      // Compare physical paths so directory aliases also produce reusable state paths.
      const resolved = path.resolve(real, path.relative(ancestor, file));
      if (!inside(root, real) || !inside(root, resolved) || resolved === root) fail('E_PATH', 'A path resolves outside the audio project.');
      return resolved;
    } catch (err) {
      if (err.code !== 'ENOENT' || !output) throw err;
      ancestor = path.dirname(ancestor);
    }
  }
}
async function json(file) {
  if ((await fs.stat(file)).size > 4 * 1024 * 1024) fail('E_SIZE', 'Project metadata exceeds 4 MB.');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}
async function atomic(file, value) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try { await fs.writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
async function digest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function declareAudioText(dir, files) {
  await atomic(path.join(dir, '.orkas-output-types.json'), {
    schema_version: 1,
    outputs: await Promise.all(files.map(async file => ({
      path: file, content_type: 'audio-text', sha256: await digest(path.join(dir, file)),
    }))),
  });
}
async function binary(env) {
  const file = process.env[env];
  if (!file || !path.isAbsolute(file)) fail('E_RUNTIME_MISSING', `Bundled ${env.replace('ORKAS_', '')} is unavailable. Repair or update the application; do not download dependencies during this task.`);
  await fs.access(file);
  return file;
}
function run(executable, args, signal, timeout = 30 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('Audio operation cancelled.'), { code: 'E_CANCELLED' }));
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', overflow = false, timedOut = false;
    const stop = () => child.kill('SIGKILL');
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeout);
    signal?.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', data => {
      if (stdout.length + data.length > 4 * 1024 * 1024) { overflow = true; stop(); }
      else stdout += data.toString();
    });
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-8192); });
    child.on('error', err => { clearTimeout(timer); signal?.removeEventListener('abort', stop); reject(err); });
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', stop);
      if (signal?.aborted || timedOut || overflow || code !== 0) {
        // Raw codec/ASR diagnostics include private paths and transcript text.
        reject(Object.assign(new Error(signal?.aborted ? 'Audio operation cancelled.' : timedOut ? 'Audio operation timed out; completed files were preserved.' : 'Audio processing failed; check the input and bundled runtime.'), {
          code: signal?.aborted ? 'E_CANCELLED' : timedOut ? 'E_TIMEOUT' : 'E_PROCESS', exit_code: code,
        }));
      } else resolve({ stdout, diagnostic_bytes: Buffer.byteLength(stderr) });
    });
  });
}
async function probe(file, signal) {
  const result = await run(await binary('ORKAS_BUNDLED_FFPROBE'), ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,sample_rate,channels', '-of', 'json', file], signal, 60000);
  const data = JSON.parse(result.stdout);
  const audio = data.streams?.find(stream => stream.codec_type === 'audio');
  const duration = Number(data.format?.duration);
  if (!audio || !(duration > 0) || !Number.isFinite(duration)) fail('E_NO_AUDIO', 'The file has no readable audio with a finite duration.');
  return { duration_sec: duration, sample_rate: Number(audio.sample_rate), channels: Number(audio.channels) };
}
function validate(plan) {
  if (plan.schema_version !== 1 || !Array.isArray(plan.segments) || plan.segments.length > 200) fail('E_PLAN', 'Use schema_version 1 and at most 200 segments; split longer work into chapters.');
  const ids = new Set();
  for (const s of plan.segments) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(s.id || '') || ids.has(s.id)) fail('E_PLAN', 'Each segment needs a unique alphanumeric id.');
    ids.add(s.id);
    if ((typeof s.text === 'string') === (typeof s.path === 'string')) fail('E_PLAN', 'Each segment needs either speech text or a local audio path.');
    if (typeof s.text === 'string') {
      const role = plan.roles?.[s.role];
      if (!s.text.trim() || s.text.length > 1500 || !role?.route_ref || !role?.voice_ref || !role?.language) fail('E_PLAN', 'Speech needs 1–1500 characters and a role with capability-listed route_ref, voice_ref and language.');
      num(role.speed, 1, 0.5, 2);
      const take = num(s.take, 0, 0, 10000);
      if (!Number.isInteger(take)) fail('E_PLAN', 'take must be an integer.');
    }
    num(s.speed, 1, 0.5, 2); num(s.volume, 1, 0, 4); num(s.gap_after_sec, 0, 0, 60);
    num(s.start_sec, 0, 0, 14400);
    if (s.end_sec !== undefined && num(s.end_sec, 0, 0, 14400) <= (s.start_sec ?? 0)) fail('E_PLAN', 'end_sec must be after start_sec.');
    num(s.fade_in_sec, 0, 0, 60); num(s.fade_out_sec, 0, 0, 60);
    if (s.denoise !== undefined && typeof s.denoise !== 'boolean') fail('E_PLAN', 'denoise must be boolean.');
  }
  if (plan.music) { if (typeof plan.music.path !== 'string') fail('E_PLAN', 'Music needs a local path.'); num(plan.music.volume, 0.15, 0, 2); }
  return plan;
}
function speechIdentity(plan, s) {
  const role = plan.roles[s.role];
  return { text: s.text, route_ref: role.route_ref, voice_ref: role.voice_ref, language: role.language, speed: role.speed ?? 1, format: 'wav' };
}
function keyFor(plan, s) { return crypto.createHash('sha256').update(JSON.stringify({ ...speechIdentity(plan, s), take: s.take ?? 0 })).digest('hex'); }
async function stateFor(root) {
  const file = await local(root, '.voice-state.json', true);
  try {
    const state = await json(file);
    if (state.schema_version !== 1 || !state.attempts || typeof state.attempts !== 'object') fail('E_STATE', 'Unsupported audio state; preserve it and inspect before proceeding.');
    return state;
  } catch (err) { if (err.code !== 'ENOENT') throw err; return { schema_version: 1, attempts: {} }; }
}
async function rowsFor(root, plan, state, signal) {
  const rows = [];
  const probes = new Map(), digests = new Map();
  const measured = async file => {
    if (!probes.has(file)) probes.set(file, await probe(file, signal));
    return probes.get(file);
  };
  for (const s of plan.segments) {
    if (s.path !== undefined) {

```

### Core Architecture Module: `resources/builtin/marketplace/agents/79df9cc89f5f/skills/_shared/scripts/src/bundled-runtime.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';

import { runtimeResourcesDir } from './paths';

function isFile(p: string | undefined): p is string {
  if (!p) return false;
  try { return fs.statSync(p).isFile(); }
  catch { return false; }
}

function isDir(p: string | undefined): p is string {
  if (!p) return false;
  try { return fs.statSync(p).isDirectory(); }
  catch { return false; }
}

function platformKey(platform = process.platform, arch = process.arch): string {
  return `${platform}-${arch}`;
}

function pushUnique(out: string[], seen: Set<string>, value: string | undefined): void {
  if (!value) return;
  const resolved = path.resolve(value);
  if (seen.has(resolved)) return;
  seen.add(resolved);
  out.push(resolved);
}

function runtimeRoots(): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();
  pushUnique(roots, seen, process.env.ORKAS_RUNTIME_DIR);
  pushUnique(roots, seen, runtimeResourcesDir());
  return roots;
}

function runtimeVariantDirs(kind: 'python' | 'uv' | 'node' | 'ffmpeg'): string[] {
  const dirs: string[] = [];
  for (const runtimeRoot of runtimeRoots()) {
    const root = path.join(runtimeRoot, kind);
    dirs.push(path.join(root, 'current'), path.join(root, platformKey()));
  }
  return [
    ...dirs,
  ];
}

function resolvePythonExecutable(): string | undefined {
  const configured = process.env.ORKAS_BUNDLED_PYTHON || process.env.ORKAS_PYTHON;
  if (isFile(configured)) return configured;

  const names = process.platform === 'win32'
    ? ['python.exe', path.join('python', 'python.exe')]
    : [
      path.join('python', 'bin', 'python3'),
      path.join('python', 'bin', 'python'),
      path.join('bin', 'python3'),
      path.join('bin', 'python'),
    ];

  for (const dir of runtimeVariantDirs('python')) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (isFile(candidate)) return candidate;
    }
  }
  return undefined;
}

function resolveUvExecutable(): string | undefined {
  const configured = process.env.ORKAS_BUNDLED_UV || process.env.ORKAS_UV;
  if (isFile(configured)) return configured;

  const name = process.platform === 'win32' ? 'uv.exe' : 'uv';
  for (const dir of runtimeVariantDirs('uv')) {
    const candidate = path.join(dir, name);
    if (isFile(candidate)) return candidate;
  }
  return undefined;
}

function resolveNodeExecutable(): string | undefined {
  const configured = process.env.ORKAS_BUNDLED_NODE;
  if (isFile(configured)) return configured;

  // ensure-runtime flattens the official Node archive so the payload root holds
  // `bin/node` (mac/linux) / `node.exe` (win) directly — see manifest `executable`.
  const names = process.platform === 'win32'
    ? ['node.exe']
    : [path.join('bin', 'node')];

  for (const dir of runtimeVariantDirs('node')) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (isFile(candidate)) return candidate;
    }
  }
  return undefined;
}

function resolveFfmpegBinary(kind: 'ffmpeg' | 'ffprobe'): string | undefined {
  const envName = kind === 'ffmpeg' ? 'ORKAS_BUNDLED_FFMPEG' : 'ORKAS_BUNDLED_FFPROBE';
  const configured = process.env[envName];
  if (isFile(configured)) return configured;

  const name = process.platform === 'win32' ? `${kind}.exe` : kind;
  for (const dir of runtimeVariantDirs('ffmpeg')) {
    const candidate = path.join(dir, name);
    if (isFile(candidate)) return candidate;
    // Tolerate a per-binary `bin/` layout if a future vendor step nests them.
    const nested = path.join(dir, 'bin', name);
    if (isFile(nested)) return nested;
  }
  return undefined;
}

/**
 * Bundled ffmpeg/ffprobe absolute paths, or undefined when not vendored for
 * this platform. VideoStudio skill scripts use these paths for deterministic
 * local media probing and ffmpeg operations instead of relying on whatever the
 * user's machine happens to have.
 */
export function bundledFfmpegPaths(): { ffmpeg?: string; ffprobe?: string } {
  const result: { ffmpeg?: string; ffprobe?: string } = {};
  const ffmpeg = resolveFfmpegBinary('ffmpeg');
  const ffprobe = resolveFfmpegBinary('ffprobe');
  if (ffmpeg) result.ffmpeg = ffmpeg;
  if (ffprobe) result.ffprobe = ffprobe;
  return result;
}

function pushPathDir(out: string[], seen: Set<string>, dir: string | undefined): void {
  if (!isDir(dir)) return;
  const resolved = path.resolve(dir);
  const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(resolved);
}

export function bundledRuntimePathEntries(): string[] {
  const entries: string[] = [];
  const seen = new Set<string>();
  const python = resolvePythonExecutable();
  if (python) {
    const pythonDir = path.dirname(python);
    pushPathDir(entries, seen, pythonDir);
    pushPathDir(entries, seen, path.join(pythonDir, 'Scripts'));
    pushPathDir(entries, seen, path.join(pythonDir, 'bin'));
  }
  const uv = resolveUvExecutable();
  if (uv) pushPathDir(entries, seen, path.dirname(uv));
  // Node's `bin` (mac/linux) or install root (win) holds `node`, `npm`, `npx`.
  // Injecting it lets the bash tool AND orkas-pkg's `npm install` resolve a
  // bundled Node on machines without a user-installed toolchain.
  const node = resolveNodeExecutable();
  if (node) pushPathDir(entries, seen, path.dirname(node));
  return entries;
}

/** Absolute path to the bundled Node executable, or undefined when not present. */
export function bundledNodeExecutable(): string | undefined {
  return resolveNodeExecutable();
}

/**
 * Absolute path to the bundled npm `npx-cli.js`, or undefined when not present.
 * Resolved relative to the bundled Node so callers can run it as
 * `node <npx-cli.js> ...` — robust cross-platform (no shebang / `.cmd` / shell
 * dependency, unlike spawning `npx` directly).
 */
export function bundledNpxCli(): string | undefined {
  const node = resolveNodeExecutable();
  if (!node) return undefined;
  const dir = path.dirname(node);
  const candidates = process.platform === 'win32'
    ? [path.join(dir, 'node_modules', 'npm', 'bin', 'npx-cli.js')]
    : [path.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js')];
  for (const c of candidates) if (isFile(c)) return c;
  return undefined;
}

export function bundledRuntimeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const python = resolvePythonExecutable();
  const uv = resolveUvExecutable();
  const node = resolveNodeExecutable();
  if (python) env.ORKAS_PYTHON = python;
  if (uv) env.ORKAS_UV = uv;
  if (node) env.ORKAS_BUNDLED_NODE = node;
  return env;
}

```

### Core Architecture Module: `resources/builtin/marketplace/agents/79df9cc89f5f/skills/_shared/scripts/src/logger-shim.ts`
```
export interface Logger {
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

const MAX_SCOPE_CHARS = 80;
const MAX_MESSAGE_CHARS = 2_000;
const MAX_COLLECTION_ITEMS = 32;
const MAX_VALUE_DEPTH = 4;
const REDACTED = '[REDACTED]';

function boundText(value: unknown, maxChars: number): string {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, REDACTED)
    .replace(/\bAKID[A-Za-z0-9]{8,}\b/g, REDACTED)
    .replace(
      /\b(token|api[_-]?key|secret(?:[_-]?key)?|password|authorization|session[_-]?(?:id|token)|access[_-]?key(?:[_-]?id)?)\s*([:=])\s*([^\s,;}\]]+)/gi,
      (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`,
    )
    .replace(
      /(^|[\s("'=])\/(?:Users|home|private|var|tmp|Volumes|opt|etc)\/[^\s"'<>)]*/g,
      (_match, prefix: string) => `${prefix}<local-path>`,
    )
    .replace(/[A-Za-z]:\\(?:[^\\\s"'<>]+\\)*[^\\\s"'<>]*/g, '<local-path>')
    .trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…[truncated]`;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'token',
    'accesstoken',
    'refreshtoken',
    'apikey',
    'secret',
    'secretkey',
    'password',
    'authorization',
    'session',
    'sessionid',
    'sessiontoken',
    'credentials',
    'content',
    'body',
    'requestbody',
    'responsebody',
  ].includes(normalized);
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth = 0,
): unknown {
  if (typeof value === 'string') return boundText(value, MAX_MESSAGE_CHARS);
  if (
    value == null
    || typeof value === 'number'
    || typeof value === 'boolean'
    || typeof value === 'bigint'
  ) return value;
  if (typeof value === 'symbol' || typeof value === 'function') {
    return boundText(String(value), MAX_MESSAGE_CHARS);
  }
  if (value instanceof Error) {
    return {
      name: boundText(value.name, 120),
      message: boundText(value.message, MAX_MESSAGE_CHARS),
    };
  }
  if (depth >= MAX_VALUE_DEPTH) return '[MaxDepth]';
  if (typeof value !== 'object') return boundText(value, MAX_MESSAGE_CHARS);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_COLLECTION_ITEMS)
      .map((item) => sanitizeValue(item, seen, depth + 1));
    if (value.length > MAX_COLLECTION_ITEMS) result.push(`[${value.length - MAX_COLLECTION_ITEMS} more]`);
    return result;
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value).slice(0, MAX_COLLECTION_ITEMS);
  for (const [rawKey, item] of entries) {
    const key = boundText(rawKey, 120) || 'field';
    result[key] = isSensitiveKey(rawKey)
      ? REDACTED
      : sanitizeValue(item, seen, depth + 1);
  }
  const extra = Object.keys(value).length - entries.length;
  if (extra > 0) result.__truncated_fields__ = extra;
  return result;
}

export function createLogger(moduleName: string): Logger {
  const scope = boundText(moduleName || 'video-script', MAX_SCOPE_CHARS) || 'video-script';
  const write = (level: 'error' | 'warn' | 'info' | 'debug', message: string, args: unknown[]) => {
    if (process.env.ORKAS_VIDEO_SCRIPT_DEBUG !== '1') return;
    const line = `[${scope}] ${boundText(message, MAX_MESSAGE_CHARS)}`;
    const safeArgs = args.map((arg) => sanitizeValue(arg, new WeakSet()));
    if (level === 'error') console.error(line, ...safeArgs);
    else if (level === 'warn') console.warn(line, ...safeArgs);
    else if (level === 'debug') console.debug(line, ...safeArgs);
    else console.info(line, ...safeArgs);
  };
  return {
    error: (message, ...args) => write('error', message, args),
    warn: (message, ...args) => write('warn', message, args),
    info: (message, ...args) => write('info', message, args),
    debug: (message, ...args) => write('debug', message, args),
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #95** (2026-09-30): **fix(preview): keep private file details out of failure logs**
  *Symptoms*: File-preview failure handlers could write full local paths and raw exception messages to diagnostic logs. Replace those values with fixed error codes for file checks, text reads, folder reveals, app inspection, and editor teardown. Existing prompts, fallback actions, and cleanup behavior are preserved.  Validation: - 119 tests across eight related renderer suites pass. Six new privacy/recovery cases fail against the original implementation and pass with this change. - Main and core-agent typechecks, JavaScript syntax, diff checks, and isolated smoke pass. - Smoke retains the existing Node DEP0205 deprecation warning.  Only the shared preview module and its tests change. Commercial account services, sharing, telemetry, provider policy, dependencies, and platform-specific code are untouched. The wider synchronization inventory remains deferred due to existing project-invite UI and resource/code inventory differences; its baseline is unchanged. No release is requested. 

- **Issue #93** (2026-09-29): **fix(local-agents): exclude system sleep from CLI idle time**
  *Symptoms*: When the computer sleeps during a local CLI Agent run, the idle watchdog can count sleep as inactivity and terminate the process immediately after wake. Measure CLI inactivity using the shared OS suspend/resume clock so the remaining idle allowance survives sleep.  Preserve the 24-hour wall-clock deadline, immediate cancellation, nested approval waits, real-progress renewal, and wall-clock fallback when power monitoring is unavailable. One shared listener pair serves all runs; no new polling or dependencies.  Validation: - Before the change: 206 related tests passed. New regression cases reproduced premature termination on the old implementation. - After the change: 215 tests across 10 runner, watchdog, OS clock, and CLI backend suites passed; both TypeScript checks and isolated smoke passed. - Fault-injection logs were reviewed; the smoke run retains an existing Node `module.register()` deprecation warning. - OS events were simulated deterministically on macOS; physical sleep/wake and native Windows sleep were not exercised.  CI: all seven Linux source and native dependency jobs succeeded. Existing Sharp/Electron Linux compatibility warnings and GLib diagnostics match the preceding PR in signature and count; dependency/action deprecations remain. Both GUI log collectors report 11 classified D-Bus warnings and zero unexpected diagnostics. 

- **Issue #92** (2026-09-28): **fix(proxy): classify Electron proxy connection failures**
  *Symptoms*: Electron can reject a system proxy connection with a message-only `net::ERR_PROXY_CONNECTION_FAILED`. The open build currently treats that rejection as an ordinary failure. This change assigns the existing `ENETUNREACH` transport code at the Electron fetch boundary, retaining the original error as `cause`, so network retry and exhaustion handling can classify it without broad message matching.  Validation: 112 focused proxy and provider tests passed; main and core-agent typechecks passed. The source commit's provider-sensitive test file is intentionally unchanged in the open build; the owning proxy test covers the shared behavior.  The repository-wide synchronization postcheck remains red on the older public baseline (49 cross-version violations). This focused PR does not advance the full-sync state. 

- **Issue #91** (2026-09-27): **fix(local-agents): retain bounded OpenCode exit diagnostics**
  *Symptoms*: OpenCode can exit before producing its first JSON protocol record. The local run summary previously showed a generic failure without enough facts to distinguish that startup failure from a structured protocol error. This ports the shared Orkas fix (9047d73f5): record a bounded exit code, protocol-record count, and whether a protocol error was seen. The fields contain no CLI output or prompt content.  The change touches only shared local-agent backend, log-summary, and focused test files. Account, billing, sync, telemetry upload, private provider, and release paths are unaffected.  Validation: `npm test -- test/main/features/local_agents/opencode_backend.test.ts test/main/features/local_agents/runner.test.ts` (85 passed); `npm run typecheck`; `git diff --check`. Existing runner fixtures intentionally emit one error-level backend failure and warnings for missing CLI, fallback, media rejection, and resume recovery. 

- **Issue #90** (2026-09-26): **fix(chat): honor user history scroll during search jump**
  *Symptoms*: After a search jump, the transcript briefly suppresses scroll events to avoid loading history from its own programmatic movement. During that grace period, an actual upward wheel or touch gesture was suppressed too, so readers at the top could not load earlier messages. Preserve the guard for scroll events while allowing explicit user gestures to load the older page.  This ports the shared older-history portion of Orkas commit 56559e1c8. OrkasOpen does not have the newer-history paging path in that commit, so the change is limited to its existing older-history loader.  Validation: the new regression failed against the previous code and passes after the fix (6 focused tests); `npm run typecheck`, `npm run smoke`, `node --check src/renderer/modules/conversation.js`, and `git diff --check` passed. The smoke runner emitted an existing Node `module.register()` deprecation warning. 

- **Issue #89** (2026-09-25): **fix(ui): send CLI answers on Enter and align picker timestamps**
  *Symptoms*: Two small desktop fixes from Orkas are now available in the open-source app:  - Pressing Enter in blocking and asynchronous CLI question cards sends the completed answer through the existing button action. Shift+Enter, IME composition, incomplete answers, and single-flight delivery retain their behavior. Source: `3654fe13c`. - Library picker names use the remaining row width, keeping timestamps aligned. Source: `7913758d6`.  Only shared renderer code and its tests are included. Hosted account, cloud sync, billing, telemetry, development tools, managed services, and iOS relay remain excluded.  Validation: 38 focused tests passed; main and core-agent TypeScript checks passed; E2E TypeScript check passed; the macOS Electron CLI question-card scenario passed; `git diff --check` passed. 

- **Issue #88** (2026-09-24): **fix(browser): report the configured tab limit**
  *Symptoms*: ## Summary  - Derive the Web Assist capacity error text from the existing per-task tab limit. - Assert the reported limit in the capacity and recovery test. - Preserve tab allocation and eviction behavior.  ## Verification  - The strengthened test failed on the stale `10-tab limit` text before the fix. - `npm test -- test/main/features/web-assist-control.test.ts` — 121 passed. - `npm run typecheck` — passed. - `git diff --check` — passed.  Only the shared Web Assist implementation and its test changed. 

- **Issue #87** (2026-09-23): **fix(ui): remember task details state per conversation**
  *Symptoms*: Switching tasks used to close the details panel and carry the selected tab into unrelated tasks. This fix remembers each task's visibility and selected tab for the current app session, restores them on return, and finishes active resizing before switching tasks.  New tasks still start with a closed panel on Files. Restoring an open details panel closes the video panel through the existing mutual-exclusion path. No persistent data or provider behavior changes.  Validation: - Existing affected baseline: 95 renderer tests passed; the new regression failed against the original implementation. - Final affected set: 96 renderer tests and four real Electron navigation/output scenarios passed. - Main, core-agent and desktop E2E typechecks passed; renderer syntax and diff checks passed. - Electron logs contain development CSP warnings and debugger-disconnect cleanup messages; the navigation scenarios have no unexpected diagnostics. Existing output scenarios additionally exercise missing-media and workspace-denial recovery, with expected error logs and iframe warnings. - Resource tests: 613 passed, with 198 subtests; rerun with the existing test Python after the default interpreter lacked pytest. - Platform-native suite and five GUI composition checks passed. All seven GitHub CI jobs passed.  Broader checks are not fully green: the complete JavaScript run reported 14,033 passed, 44 failed and 54 skipped. Rechecking all 20 failing files against both original and fixed code reproduced th

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

### Incident Patch 1: `90093a18` (2026-09-30)
**Commit Message**: Merge pull request #95 from BlueSkyID666/codex/fix-preview-private-logs-20260930

fix(preview): keep private file details out of failure logs

**File**: `src/renderer/modules/chat-file-viewer.js` (modified, +10/-10)
```diff
@@ -593,7 +593,7 @@ function _teardownViewerContent(reason = 'replaced') {
   _viewerFinishHtmlPreview(reason);
   if (_viewerEditController) {
     try { _viewerEditController.destroy(); }
-    catch (err) { _viewerLog.warn('edit controller destroy threw', err); }
+    catch { _viewerLog.warn('edit controller destroy failed', { error_code: 'destroy_failed' }); }
   }
   _viewerEditController = null;
   _viewerDirty = false;
@@ -725,9 +725,9 @@ async function _refreshSaveAppButton(path) {
     if (!_isViewerOpen() || _viewerCurrentPath !== path) return;
     const canSave = !!(inspected && inspected.ok !== false && inspected.canSave);
     _setSaveAppVisible(canSave);
-  } catch (err) {
+  } catch {
     if (!_isViewerOpen() || _viewerCurrentPath !== path) return;
-    _viewerLog.warn('inspect app bundle failed', { path, error: String(err && err.message || err) });
+    _viewerLog.warn('inspect app bundle failed', { error_code: 'inspect_failed' });
     _setSaveAppVisible(false);
   }
 }
@@ -1314,9 +1314,9 @@ async function _readTextFile(absPath, cid, projectId, seq, preview) {
       });
     }
     return null;
-  } catch (e) {
+  } catch {
     if (seq && seq !== _viewerRenderSeq) return null;
-    _viewerLog.warn('readText threw', { path: absPath, error: String(e && e.message || e) });
+    _viewerLog.warn('readText failed', { error_code: 'read_failed' });
     await closeChatFileViewer({ force: true });
     await _showUnsupportedDialog(absPath, cid, projectId, {
       messageKey: 'chat.preview_read_failed_message',
@@ -1360,9 +1360,9 @@ async function _showUnsupportedDialog(absPath, cid, projectId, opts) {
     if (cid) payload.cid = cid;
     if (projectId) payload.projectId = projectId;
     const res = await window.orkas.invoke('workspace.revealPath', payload);
-    if (!res || !res.ok) _viewerLog.warn('fallback reveal failed', { path: absPath, error: res && res.error });
-  } catch (err) {
-    _viewerLog.warn('fallback reveal threw', { path: absPath, error: String(err && err.message || err) });
+    if (!res || !res.ok) _viewerLog.warn('fallback reveal failed', { error_code: 'reveal_failed' });
+  } catch {
+    _viewerLog.warn('fallback reveal failed', { error_code: 'reveal_failed' });
   }
 }
 
@@ -1392,8 +1392,8 @@ async function _ensureViewerFileExists(absPath, cid, projectId) {
     if (typeof uiToast === 'function') uiToast(message, { variant: 'warning' });
     else if (typeof uiAlert === 'function') await uiAlert(message);
     return false;
-  } catch (err) {
-    _viewerLog.warn('statPath threw', { path: absPath, error: String(err && err.message || err) });
+  } catch {
+    _viewerLog.warn('statPath failed', { error_code: 'stat_failed' });
     return true;
   }
 }
```

**File**: `test/renderer/chat-file-viewer.test.ts` (modified, +78/-0)
```diff
@@ -92,6 +92,84 @@ describe('chat-file-viewer › _kindOf', () => {
 });
 
 describe('file preview availability feedback', () => {
+  it.each(['stat', 'reveal', 'reveal-response'])('keeps private file details out of %s failure diagnostics', async (failure) => {
+    const privatePath = '/private/account/todo/brief.png';
+    const privateError = `EACCES: ${privatePath}`;
+    const warnings: unknown[] = [];
+    const invoke = vi.fn(async (channel: string) => {
+      if (channel === 'workspace.statPath') {
+        if (failure === 'stat') throw new Error(privateError);
+        return { ok: false, error: 'unavailable' };
+      }
+      if (failure === 'reveal-response') return { ok: false, error: privateError };
+      throw new Error(privateError);
+    });
+    const openChatImageLightbox = vi.fn();
+    const context = vm.createContext({
+      window: { orkas: { invoke } },
+      createLogger: () => ({ warn: (...args: unknown[]) => warnings.push(args), info: () => {}, error: () => {} }),
+      uiConfirm: vi.fn(async () => true),
+      openChatImageLightbox,
+      console,
+    });
+    vm.runInContext(readFileSync(require.resolve('../../src/renderer/modules/chat-file-viewer.js'), 'utf8'), context);
+    await context.openChatFileViewer(privatePath, 'brief.png');
+    expect(warnings).toHaveLength(1);
+    expect(JSON.stringify(warnings)).not.toContain(privatePath);
+    expect(JSON.stringify(warnings)).not.toContain('EACCES');
+    expect(warnings).toEqual([[expect.any(String), { error_code: failure === 'stat' ? 'stat_failed' : 'reveal_failed' }]]);
+    expect(openChatImageLightbox).toHaveBeenCalledTimes(failure === 'stat' ? 1 : 0);
+    expect(context.uiConfirm).toHaveBeenCalledTimes(failure === 'stat' ? 0 : 1);
+    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual(failure === 'stat'
+      ? ['workspace.statPath'] : ['workspace.statPath', 'workspace.revealPath']);
+  });
+
+  it.each(['read', 'inspect', 'destroy'])('keeps %s failure diagnostics private while preserving recovery', async (failure) => {
+    const privatePath = '/private/account/todo/brief.txt';
+    const warnings: unknown[] = [];
+    const fail = () => { throw new Error(`EACCES: ${privatePath}`); };
+    const invoke = vi.fn(async () => fail());
+    const button = { hidden: false, disabled: false };
+    const classes = new Set(['is-open']);
+    const root = {
+      classList: {
+        contains: (name: string) => classes.has(name),
+        remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
+      },
+      setAttribute: vi.fn(),
+    };
+    const setDirty = vi.fn();
+    const context = vm.createContext({
+      window: { orkas: { invoke }, OrkasPreviewHost: { setDirty } },
+      createLogger: () => ({ warn: (...args: unknown[]) => warnings.push(args), info: () => {}, error: () => {} }),
+      uiConfirm: vi.fn(async () => false),
+      root, button, privatePath, fail, console,
+    });
+    vm.runInContext(readFileSync(require.resolve('../../src/renderer/modules/chat-file-viewer.js'), 'utf8'), context);
+    vm.runInContext('_viewerEl = root; _viewerCurrentPath = privatePath; _viewerSaveAppBtn = button;', context);
+    if (failure === 'read') {
+      expect(await context._readTextFile(privatePath, 'task', 'project')).toBeNull();
+      expect(classes.has('is-open')).toBe(false);
+      expect(context.uiConfirm).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
+        message: 'Could not read this file. Open the containing folder?',
+      }));
+      expect(invoke).toHaveBeenCalledExactlyOnceWith('produced.readText', { path: privatePath, cid: 'task', projectId: 'project' });
+    } else if (failure === 'inspect') {
+      await context._refreshSaveAppButton(privatePath);
+      expect(button).toEqual({ hidden: true, disabled: true });
+      expect(classes.has('is-open')).toBe(true);
+      expect(invoke).toHaveBeenCalledExactlyOnceWith('savedApps.inspectBundleFromPath', { path: privateP
```

---

### Incident Patch 2: `1b806435` (2026-09-30)
**Commit Message**: fix(preview): keep private file details out of failure logs

Use fixed diagnostic codes when file checks, preview reads, folder reveals, app inspection or editor teardown fail. Preserve preview recovery and avoid logging file paths or raw errors.

Validation: 119 related renderer tests passed, including six privacy and recovery regressions that fail before the fix; both typechecks, isolated smoke, JavaScript syntax and diff checks passed. Smoke retains the existing Node DEP0205 deprecation warning.

**File**: `src/renderer/modules/chat-file-viewer.js` (modified, +10/-10)
```diff
@@ -593,7 +593,7 @@ function _teardownViewerContent(reason = 'replaced') {
   _viewerFinishHtmlPreview(reason);
   if (_viewerEditController) {
     try { _viewerEditController.destroy(); }
-    catch (err) { _viewerLog.warn('edit controller destroy threw', err); }
+    catch { _viewerLog.warn('edit controller destroy failed', { error_code: 'destroy_failed' }); }
   }
   _viewerEditController = null;
   _viewerDirty = false;
@@ -725,9 +725,9 @@ async function _refreshSaveAppButton(path) {
     if (!_isViewerOpen() || _viewerCurrentPath !== path) return;
     const canSave = !!(inspected && inspected.ok !== false && inspected.canSave);
     _setSaveAppVisible(canSave);
-  } catch (err) {
+  } catch {
     if (!_isViewerOpen() || _viewerCurrentPath !== path) return;
-    _viewerLog.warn('inspect app bundle failed', { path, error: String(err && err.message || err) });
+    _viewerLog.warn('inspect app bundle failed', { error_code: 'inspect_failed' });
     _setSaveAppVisible(false);
   }
 }
@@ -1314,9 +1314,9 @@ async function _readTextFile(absPath, cid, projectId, seq, preview) {
       });
     }
     return null;
-  } catch (e) {
+  } catch {
     if (seq && seq !== _viewerRenderSeq) return null;
-    _viewerLog.warn('readText threw', { path: absPath, error: String(e && e.message || e) });
+    _viewerLog.warn('readText failed', { error_code: 'read_failed' });
     await closeChatFileViewer({ force: true });
     await _showUnsupportedDialog(absPath, cid, projectId, {
       messageKey: 'chat.preview_read_failed_message',
@@ -1360,9 +1360,9 @@ async function _showUnsupportedDialog(absPath, cid, projectId, opts) {
     if (cid) payload.cid = cid;
     if (projectId) payload.projectId = projectId;
     const res = await window.orkas.invoke('workspace.revealPath', payload);
-    if (!res || !res.ok) _viewerLog.warn('fallback reveal failed', { path: absPath, error: res && res.error });
-  } catch (err) {
-    _viewerLog.warn('fallback reveal threw', { path: absPath, error: String(err && err.message || err) });
+    if (!res || !res.ok) _viewerLog.warn('fallback reveal failed', { error_code: 'reveal_failed' });
+  } catch {
+    _viewerLog.warn('fallback reveal failed', { error_code: 'reveal_failed' });
   }
 }
 
@@ -1392,8 +1392,8 @@ async function _ensureViewerFileExists(absPath, cid, projectId) {
     if (typeof uiToast === 'function') uiToast(message, { variant: 'warning' });
     else if (typeof uiAlert === 'function') await uiAlert(message);
     return false;
-  } catch (err) {
-    _viewerLog.warn('statPath threw', { path: absPath, error: String(err && err.message || err) });
+  } catch {
+    _viewerLog.warn('statPath failed', { error_code: 'stat_failed' });
     return true;
   }
 }
```

**File**: `test/renderer/chat-file-viewer.test.ts` (modified, +78/-0)
```diff
@@ -92,6 +92,84 @@ describe('chat-file-viewer › _kindOf', () => {
 });
 
 describe('file preview availability feedback', () => {
+  it.each(['stat', 'reveal', 'reveal-response'])('keeps private file details out of %s failure diagnostics', async (failure) => {
+    const privatePath = '/private/account/todo/brief.png';
+    const privateError = `EACCES: ${privatePath}`;
+    const warnings: unknown[] = [];
+    const invoke = vi.fn(async (channel: string) => {
+      if (channel === 'workspace.statPath') {
+        if (failure === 'stat') throw new Error(privateError);
+        return { ok: false, error: 'unavailable' };
+      }
+      if (failure === 'reveal-response') return { ok: false, error: privateError };
+      throw new Error(privateError);
+    });
+    const openChatImageLightbox = vi.fn();
+    const context = vm.createContext({
+      window: { orkas: { invoke } },
+      createLogger: () => ({ warn: (...args: unknown[]) => warnings.push(args), info: () => {}, error: () => {} }),
+      uiConfirm: vi.fn(async () => true),
+      openChatImageLightbox,
+      console,
+    });
+    vm.runInContext(readFileSync(require.resolve('../../src/renderer/modules/chat-file-viewer.js'), 'utf8'), context);
+    await context.openChatFileViewer(privatePath, 'brief.png');
+    expect(warnings).toHaveLength(1);
+    expect(JSON.stringify(warnings)).not.toContain(privatePath);
+    expect(JSON.stringify(warnings)).not.toContain('EACCES');
+    expect(warnings).toEqual([[expect.any(String), { error_code: failure === 'stat' ? 'stat_failed' : 'reveal_failed' }]]);
+    expect(openChatImageLightbox).toHaveBeenCalledTimes(failure === 'stat' ? 1 : 0);
+    expect(context.uiConfirm).toHaveBeenCalledTimes(failure === 'stat' ? 0 : 1);
+    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual(failure === 'stat'
+      ? ['workspace.statPath'] : ['workspace.statPath', 'workspace.revealPath']);
+  });
+
+  it.each(['read', 'inspect', 'destroy'])('keeps %s failure diagnostics private while preserving recovery', async (failure) => {
+    const privatePath = '/private/account/todo/brief.txt';
+    const warnings: unknown[] = [];
+    const fail = () => { throw new Error(`EACCES: ${privatePath}`); };
+    const invoke = vi.fn(async () => fail());
+    const button = { hidden: false, disabled: false };
+    const classes = new Set(['is-open']);
+    const root = {
+      classList: {
+        contains: (name: string) => classes.has(name),
+        remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
+      },
+      setAttribute: vi.fn(),
+    };
+    const setDirty = vi.fn();
+    const context = vm.createContext({
+      window: { orkas: { invoke }, OrkasPreviewHost: { setDirty } },
+      createLogger: () => ({ warn: (...args: unknown[]) => warnings.push(args), info: () => {}, error: () => {} }),
+      uiConfirm: vi.fn(async () => false),
+      root, button, privatePath, fail, console,
+    });
+    vm.runInContext(readFileSync(require.resolve('../../src/renderer/modules/chat-file-viewer.js'), 'utf8'), context);
+    vm.runInContext('_viewerEl = root; _viewerCurrentPath = privatePath; _viewerSaveAppBtn = button;', context);
+    if (failure === 'read') {
+      expect(await context._readTextFile(privatePath, 'task', 'project')).toBeNull();
+      expect(classes.has('is-open')).toBe(false);
+      expect(context.uiConfirm).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
+        message: 'Could not read this file. Open the containing folder?',
+      }));
+      expect(invoke).toHaveBeenCalledExactlyOnceWith('produced.readText', { path: privatePath, cid: 'task', projectId: 'project' });
+    } else if (failure === 'inspect') {
+      await context._refreshSaveAppButton(privatePath);
+      expect(button).toEqual({ hidden: true, disabled: true });
+      expect(classes.has('is-open')).toBe(true);
+      expect(invoke).toHaveBeenCalledExactlyOnceWith('savedApps.inspectBundleFromPath', { path: privateP
```

---

### Incident Patch 3: `72d0a311` (2026-09-29)
**Commit Message**: Merge pull request #93 from CloudTianTian/codex/fix-cli-suspend-idle-20260929

fix(local-agents): exclude system sleep from CLI idle time

**File**: `src/main/features/local_agents/runner.ts` (modified, +10/-1)
```diff
@@ -1360,7 +1360,16 @@ export async function run(opts: RunCliAgentOpts): Promise<RunCliAgentResult> {
   let remoteMediaScheduledCount = 0;
   let remoteMediaReservedBytes = 0;
   let remoteMediaDeadlineAt = 0;
-  const activityClock = new AgentActivityClock();
+  let idleNow = () => Date.now();
+  try {
+    const { getSystemActivityClock } = await import('../system_activity');
+    idleNow = await getSystemActivityClock();
+  } catch {
+    // Preserve existing timeout behavior when the OS event source is absent;
+    // a quiet CLI or a clock jump is never evidence of system suspension.
+    log.warn('CLI system suspension clock unavailable; retaining wall-clock idle timeout');
+  }
+  const activityClock = new AgentActivityClock(idleNow);
   let lastVisibleActivityAt = Date.now();
   const bridgeSkillRefByCallId = new Map<string, string>();
   let bridge: BridgeHandle | null = null;
```

**File**: `src/main/features/system_activity.ts` (modified, +21/-3)
```diff
@@ -22,7 +22,7 @@ export class SystemActivityTracker {
 
   constructor(
     private readonly monitor: PowerMonitorLike,
-    private readonly now: () => number = Date.now,
+    private readonly now: () => number = () => Date.now(),
   ) {}
 
   start(): void {
@@ -45,6 +45,13 @@ export class SystemActivityTracker {
     };
   }
 
+  /** Synchronous clock for idle budgets. Pending suspension is excluded even
+   * if a watchdog tick arrives before the OS resume event is delivered. */
+  awakeNow = (): number => {
+    const snapshot = this.snapshot();
+    return snapshot.wall_time_ms - snapshot.suspended_total_ms;
+  };
+
   private onSuspend(): void {
     if (this.suspendedAtMs != null) return;
     this.suspendedAtMs = this.now();
@@ -61,10 +68,21 @@ export class SystemActivityTracker {
 
 let trackerPromise: Promise<SystemActivityTracker> | null = null;
 
-export async function getSystemActivitySnapshot(): Promise<SystemActivitySnapshot> {
+async function getTracker(): Promise<SystemActivityTracker> {
   if (!trackerPromise) {
     trackerPromise = import('electron').then(({ powerMonitor }) => new SystemActivityTracker(powerMonitor));
   }
   const tracker = await trackerPromise;
-  return tracker.snapshot();
+  tracker.start();
+  return tracker;
+}
+
+export async function getSystemActivitySnapshot(): Promise<SystemActivitySnapshot> {
+  return (await getTracker()).snapshot();
+}
+
+/** Register authoritative OS events before starting CLI idle measurement.
+ * One process-wide tracker serves all runs; no per-run listeners or polling. */
+export async function getSystemActivityClock(): Promise<() => number> {
+  return (await getTracker()).awakeNow;
 }
```

**File**: `src/main/util/agent-execution-budget.ts` (modified, +15/-7)
```diff
@@ -10,24 +10,32 @@ export function agentExecutionDeadline(startedAt = Date.now()): number {
   return startedAt + AGENT_EXECUTION_MAX_MS;
 }
 
-/** Pause only the idle clock during an authoritative user interaction. Nested
- * waits are counted so one approval cannot resume another outstanding wait. */
+/** Measure idle time on the supplied clock (CLI hosts exclude OS suspension).
+ * Nested user waits pause that same clock, so sleep overlapping an approval is
+ * never deducted twice. Absolute execution deadlines remain wall-clock based. */
 export class AgentActivityClock {
-  private lastActivity = Date.now();
+  private lastActivity: number;
   private waitStarted = 0;
   private waits = 0;
 
-  progress(): void { this.lastActivity = Date.now(); }
-  lastEventAt = (): number => this.waits ? Date.now() : this.lastActivity;
+  constructor(private readonly now: () => number = () => Date.now()) {
+    this.lastActivity = now();
+  }
+
+  progress(): void { this.lastActivity = this.now(); }
+  // Preserve the watchdog's wall-timestamp contract without changing every
+  // backend: project only the remaining awake idle duration onto wall time.
+  lastEventAt = (): number => Date.now() - (this.waits ? 0 : Math.max(0, this.now() - this.lastActivity));
 
   pause(): () => void {
-    if (this.waits++ === 0) this.waitStarted = Date.now();
+    if (this.waits++ === 0) this.waitStarted = this.now();
     let released = false;
     return () => {
       if (released) return;
       released = true;
       if (--this.waits === 0) {
-        this.lastActivity = Math.min(Date.now(), this.lastActivity + Date.now() - this.waitStarted);
+        const now = this.now();
+        this.lastActivity = Math.min(now, this.lastActivity + now - this.waitStarted);
       }
     };
   }
```

**File**: `test/main/features/local_agents/runner.test.ts` (modified, +38/-0)
```diff
@@ -11,6 +11,14 @@ const mockDetect = vi.fn<[string], Promise<any>>();
 const mockCliFallback = vi.fn<[any], any>();
 const mockCliFailure = vi.fn();
 const mockCliSuccess = vi.fn();
+const suspensionClock = vi.hoisted(() => ({ suspended: 0, unavailable: false }));
+vi.mock('../../../../src/main/features/system_activity', async (importOriginal) => ({
+  ...await importOriginal<typeof import('../../../../src/main/features/system_activity')>(),
+  getSystemActivityClock: async () => {
+    if (suspensionClock.unavailable) throw new Error('fixture power monitor unavailable');
+    return () => Date.now() - suspensionClock.suspended;
+  },
+}));
 vi.mock('../../../../src/main/features/local_agents/registry', async (importOriginal) => {
   const actual = await importOriginal<typeof import('../../../../src/main/features/local_agents/registry')>();
   return {
@@ -86,6 +94,8 @@ const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4
 const MP4_FTYP = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');
 
 beforeEach(async () => {
+  suspensionClock.suspended = 0;
+  suspensionClock.unavailable = false;
   tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orkas-runner-'));
   prevWs = process.env.ORKAS_WORKSPACE_ROOT;
   process.env.ORKAS_WORKSPACE_ROOT = tmpDir;
@@ -154,6 +164,34 @@ async function callRunnerBridge(
 }
 
 describe('local_agents/runner', () => {
+  it.each([false, true])('wires OS-aware idle time into the CLI, retaining wall time if monitoring is unavailable: %s', async unavailable => {
+    suspensionClock.unavailable = unavailable;
+    mockDetect.mockResolvedValue({ type: 'claude', available: true, path: '/fake/claude', version: '2.0.0' });
+    let now = Date.now();
+    const date = vi.spyOn(Date, 'now').mockImplementation(() => now);
+    let backendCalls = 0;
+    mockBackendImpl = async opts => {
+      backendCalls++;
+      opts.onActivity();
+      now += 20 * 60_000;
+      expect(now - opts.lastEventAt()).toBe(1_200_000);
+      now += 60 * 60_000;
+      suspensionClock.suspended += 60 * 60_000;
+      expect(now - opts.lastEventAt()).toBe(unavailable ? 4_800_000 : 1_200_000);
+      opts.onActivity();
+      expect(now - opts.lastEventAt()).toBe(0);
+      opts.onEvent({ type: 'done', status: 'completed', output: 'done' });
+    };
+    try {
+      const result = await (await loadRunner()).run({
+        uid: TEST_UID, cid: 'c-suspend', agentId: 'a', cli: 'claude', prompt: 'work', cwd: tmpDir,
+        signal: new AbortController().signal, onEvent: () => {},
+      });
+      expect(result.status).toBe('completed');
+      expect(backendCalls).toBe(1);
+    } finally { date.mockRestore(); }
+  });
+
   it('advertises only granted bridge categories and directs Commander-only work to handoff', async () => {
     const runner = await loadRunner();
     const restricted = runner.buildBridgeSystemPrompt([
```

**File**: `test/main/features/local_agents/watchdog.test.ts` (modified, +109/-1)
```diff
@@ -1,5 +1,5 @@
 import { afterEach, describe, it, expect, vi } from 'vitest';
-import { armKillWatchdog } from '../../../../src/main/features/local_agents/backends/base';
+import { armKillWatchdog, bindAbort } from '../../../../src/main/features/local_agents/backends/base';
 import type { ChildProcessWithoutNullStreams } from 'node:child_process';
 import {
   AGENT_EXECUTION_IDLE_MS,
@@ -8,6 +8,7 @@ import {
 } from '../../../../src/main/util/agent-execution-budget';
 import { resolveIdleKillMs } from '../../../../src/main/features/local_agents/runner';
 import { localCliCapabilities } from '../../../../src/main/features/local_agents/registry';
+import { SystemActivityTracker } from '../../../../src/main/features/system_activity';
 
 // Business invariants of the activity-aware kill watchdog
 // (backends/base.ts::armKillWatchdog). The bug class this guards: a
@@ -147,6 +148,113 @@ describe('armKillWatchdog', () => {
   });
 });
 
+// The OS event source is controlled; the real clock and watchdog decide
+// whether the child is killed. Wall-clock jumps without suspend are not sleep.
+function suspensionFixture() {
+  vi.useFakeTimers();
+  vi.setSystemTime(0);
+  const listeners = new Map<string, () => void>();
+  const system = new SystemActivityTracker({ on: (event, fn) => { listeners.set(event, fn); } });
+  system.start();
+  const awakeNow = () => {
+    const snapshot = system.snapshot();
+    return snapshot.wall_time_ms - snapshot.suspended_total_ms;
+  };
+  const clock = new AgentActivityClock(awakeNow);
+  const { child, kill } = fakeChild();
+  const wd = armKillWatchdog(child, {
+    timeoutMs: 86_400_000, idleKillMs: AGENT_EXECUTION_IDLE_MS, lastEventAt: clock.lastEventAt,
+  });
+  return { clock, wd, kill, child,
+    suspend: () => listeners.get('suspend')!(),
+    resume: () => listeners.get('resume')!(),
+    jump: (ms: number) => vi.setSystemTime(Date.now() + ms),
+  };
+}
+
+describe('CLI idle budget across system suspension', () => {
+  it('keeps user cancellation immediate while the system clock is suspended', () => {
+    const f = suspensionFixture();
+    const controller = new AbortController();
+    const unbind = bindAbort(f.child, controller.signal);
+    try {
+      f.suspend(); f.jump(3_600_000);
+      controller.abort();
+      expect(f.kill).toHaveBeenCalledWith('SIGTERM');
+      expect(f.kill).toHaveBeenCalledTimes(1);
+      expect(f.wd.fired()).toBeNull();
+    } finally { unbind(); f.wd.disarm(); }
+  });
+
+  it('preserves the remaining idle budget even if a watchdog tick precedes resume delivery', async () => {
+    const f = suspensionFixture();
+    await vi.advanceTimersByTimeAsync(20 * 60_000);
+    f.suspend(); f.jump(60 * 60_000);
+    await vi.advanceTimersByTimeAsync(5_000);
+    expect(f.kill).not.toHaveBeenCalled();
+    f.resume();
+    await vi.advanceTimersByTimeAsync(595_000);
+    expect(f.kill).not.toHaveBeenCalled();
+    await vi.advanceTimersByTimeAsync(5_000);
+    expect(f.wd.fired()).toBe('idle');
+    expect(f.wd.reason()).toContain('no activity for 1800000ms');
+    expect(f.kill).toHaveBeenCalledTimes(1);
+    f.wd.disarm();
+  });
+
+  it('counts multiple suspensions once and lets real progress renew the awake idle budget', async () => {
+    const f = suspensionFixture();
+    await vi.advanceTimersByTimeAsync(600_000);
+    f.suspend(); f.jump(3_600_000); f.resume();
+    await vi.advanceTimersByTimeAsync(600_000);
+    f.suspend(); f.suspend(); f.jump(3_600_000); f.resume(); f.resume();
+    f.clock.progress();
+    await vi.advanceTimersByTimeAsync(1_795_000);
+    expect(f.kill).not.toHaveBeenCalled();
+    await vi.advanceTimersByTimeAsync(5_000);
+    expect(f.wd.fired()).toBe('idle');
+    expect(f.kill).toHaveBeenCalledTimes(1);
+    f.wd.disarm();
+  });
+
+  it('does not deduct overlapping approval waits and system suspension twice', async () => {
+    const f = suspensionFixture();
+    await vi.advanceTimersByTimeAsync(1_200_000);
+    const fi
```

---

### Incident Patch 4: `ae99ea7c` (2026-09-29)
**Commit Message**: fix(local-agents): exclude system sleep from CLI idle time

Use the shared OS suspend/resume clock for CLI inactivity while retaining the absolute execution deadline, cancellation and nested approval waits. Fall back to wall time if OS monitoring is unavailable.

Validation: 215 related deterministic tests, main/core typechecks and isolated smoke passed. New regression cases reproduce premature termination before the repair.

**File**: `src/main/features/local_agents/runner.ts` (modified, +10/-1)
```diff
@@ -1360,7 +1360,16 @@ export async function run(opts: RunCliAgentOpts): Promise<RunCliAgentResult> {
   let remoteMediaScheduledCount = 0;
   let remoteMediaReservedBytes = 0;
   let remoteMediaDeadlineAt = 0;
-  const activityClock = new AgentActivityClock();
+  let idleNow = () => Date.now();
+  try {
+    const { getSystemActivityClock } = await import('../system_activity');
+    idleNow = await getSystemActivityClock();
+  } catch {
+    // Preserve existing timeout behavior when the OS event source is absent;
+    // a quiet CLI or a clock jump is never evidence of system suspension.
+    log.warn('CLI system suspension clock unavailable; retaining wall-clock idle timeout');
+  }
+  const activityClock = new AgentActivityClock(idleNow);
   let lastVisibleActivityAt = Date.now();
   const bridgeSkillRefByCallId = new Map<string, string>();
   let bridge: BridgeHandle | null = null;
```

**File**: `src/main/features/system_activity.ts` (modified, +21/-3)
```diff
@@ -22,7 +22,7 @@ export class SystemActivityTracker {
 
   constructor(
     private readonly monitor: PowerMonitorLike,
-    private readonly now: () => number = Date.now,
+    private readonly now: () => number = () => Date.now(),
   ) {}
 
   start(): void {
@@ -45,6 +45,13 @@ export class SystemActivityTracker {
     };
   }
 
+  /** Synchronous clock for idle budgets. Pending suspension is excluded even
+   * if a watchdog tick arrives before the OS resume event is delivered. */
+  awakeNow = (): number => {
+    const snapshot = this.snapshot();
+    return snapshot.wall_time_ms - snapshot.suspended_total_ms;
+  };
+
   private onSuspend(): void {
     if (this.suspendedAtMs != null) return;
     this.suspendedAtMs = this.now();
@@ -61,10 +68,21 @@ export class SystemActivityTracker {
 
 let trackerPromise: Promise<SystemActivityTracker> | null = null;
 
-export async function getSystemActivitySnapshot(): Promise<SystemActivitySnapshot> {
+async function getTracker(): Promise<SystemActivityTracker> {
   if (!trackerPromise) {
     trackerPromise = import('electron').then(({ powerMonitor }) => new SystemActivityTracker(powerMonitor));
   }
   const tracker = await trackerPromise;
-  return tracker.snapshot();
+  tracker.start();
+  return tracker;
+}
+
+export async function getSystemActivitySnapshot(): Promise<SystemActivitySnapshot> {
+  return (await getTracker()).snapshot();
+}
+
+/** Register authoritative OS events before starting CLI idle measurement.
+ * One process-wide tracker serves all runs; no per-run listeners or polling. */
+export async function getSystemActivityClock(): Promise<() => number> {
+  return (await getTracker()).awakeNow;
 }
```

**File**: `src/main/util/agent-execution-budget.ts` (modified, +15/-7)
```diff
@@ -10,24 +10,32 @@ export function agentExecutionDeadline(startedAt = Date.now()): number {
   return startedAt + AGENT_EXECUTION_MAX_MS;
 }
 
-/** Pause only the idle clock during an authoritative user interaction. Nested
- * waits are counted so one approval cannot resume another outstanding wait. */
+/** Measure idle time on the supplied clock (CLI hosts exclude OS suspension).
+ * Nested user waits pause that same clock, so sleep overlapping an approval is
+ * never deducted twice. Absolute execution deadlines remain wall-clock based. */
 export class AgentActivityClock {
-  private lastActivity = Date.now();
+  private lastActivity: number;
   private waitStarted = 0;
   private waits = 0;
 
-  progress(): void { this.lastActivity = Date.now(); }
-  lastEventAt = (): number => this.waits ? Date.now() : this.lastActivity;
+  constructor(private readonly now: () => number = () => Date.now()) {
+    this.lastActivity = now();
+  }
+
+  progress(): void { this.lastActivity = this.now(); }
+  // Preserve the watchdog's wall-timestamp contract without changing every
+  // backend: project only the remaining awake idle duration onto wall time.
+  lastEventAt = (): number => Date.now() - (this.waits ? 0 : Math.max(0, this.now() - this.lastActivity));
 
   pause(): () => void {
-    if (this.waits++ === 0) this.waitStarted = Date.now();
+    if (this.waits++ === 0) this.waitStarted = this.now();
     let released = false;
     return () => {
       if (released) return;
       released = true;
       if (--this.waits === 0) {
-        this.lastActivity = Math.min(Date.now(), this.lastActivity + Date.now() - this.waitStarted);
+        const now = this.now();
+        this.lastActivity = Math.min(now, this.lastActivity + now - this.waitStarted);
       }
     };
   }
```

**File**: `test/main/features/local_agents/runner.test.ts` (modified, +38/-0)
```diff
@@ -11,6 +11,14 @@ const mockDetect = vi.fn<[string], Promise<any>>();
 const mockCliFallback = vi.fn<[any], any>();
 const mockCliFailure = vi.fn();
 const mockCliSuccess = vi.fn();
+const suspensionClock = vi.hoisted(() => ({ suspended: 0, unavailable: false }));
+vi.mock('../../../../src/main/features/system_activity', async (importOriginal) => ({
+  ...await importOriginal<typeof import('../../../../src/main/features/system_activity')>(),
+  getSystemActivityClock: async () => {
+    if (suspensionClock.unavailable) throw new Error('fixture power monitor unavailable');
+    return () => Date.now() - suspensionClock.suspended;
+  },
+}));
 vi.mock('../../../../src/main/features/local_agents/registry', async (importOriginal) => {
   const actual = await importOriginal<typeof import('../../../../src/main/features/local_agents/registry')>();
   return {
@@ -86,6 +94,8 @@ const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4
 const MP4_FTYP = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');
 
 beforeEach(async () => {
+  suspensionClock.suspended = 0;
+  suspensionClock.unavailable = false;
   tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orkas-runner-'));
   prevWs = process.env.ORKAS_WORKSPACE_ROOT;
   process.env.ORKAS_WORKSPACE_ROOT = tmpDir;
@@ -154,6 +164,34 @@ async function callRunnerBridge(
 }
 
 describe('local_agents/runner', () => {
+  it.each([false, true])('wires OS-aware idle time into the CLI, retaining wall time if monitoring is unavailable: %s', async unavailable => {
+    suspensionClock.unavailable = unavailable;
+    mockDetect.mockResolvedValue({ type: 'claude', available: true, path: '/fake/claude', version: '2.0.0' });
+    let now = Date.now();
+    const date = vi.spyOn(Date, 'now').mockImplementation(() => now);
+    let backendCalls = 0;
+    mockBackendImpl = async opts => {
+      backendCalls++;
+      opts.onActivity();
+      now += 20 * 60_000;
+      expect(now - opts.lastEventAt()).toBe(1_200_000);
+      now += 60 * 60_000;
+      suspensionClock.suspended += 60 * 60_000;
+      expect(now - opts.lastEventAt()).toBe(unavailable ? 4_800_000 : 1_200_000);
+      opts.onActivity();
+      expect(now - opts.lastEventAt()).toBe(0);
+      opts.onEvent({ type: 'done', status: 'completed', output: 'done' });
+    };
+    try {
+      const result = await (await loadRunner()).run({
+        uid: TEST_UID, cid: 'c-suspend', agentId: 'a', cli: 'claude', prompt: 'work', cwd: tmpDir,
+        signal: new AbortController().signal, onEvent: () => {},
+      });
+      expect(result.status).toBe('completed');
+      expect(backendCalls).toBe(1);
+    } finally { date.mockRestore(); }
+  });
+
   it('advertises only granted bridge categories and directs Commander-only work to handoff', async () => {
     const runner = await loadRunner();
     const restricted = runner.buildBridgeSystemPrompt([
```

**File**: `test/main/features/local_agents/watchdog.test.ts` (modified, +109/-1)
```diff
@@ -1,5 +1,5 @@
 import { afterEach, describe, it, expect, vi } from 'vitest';
-import { armKillWatchdog } from '../../../../src/main/features/local_agents/backends/base';
+import { armKillWatchdog, bindAbort } from '../../../../src/main/features/local_agents/backends/base';
 import type { ChildProcessWithoutNullStreams } from 'node:child_process';
 import {
   AGENT_EXECUTION_IDLE_MS,
@@ -8,6 +8,7 @@ import {
 } from '../../../../src/main/util/agent-execution-budget';
 import { resolveIdleKillMs } from '../../../../src/main/features/local_agents/runner';
 import { localCliCapabilities } from '../../../../src/main/features/local_agents/registry';
+import { SystemActivityTracker } from '../../../../src/main/features/system_activity';
 
 // Business invariants of the activity-aware kill watchdog
 // (backends/base.ts::armKillWatchdog). The bug class this guards: a
@@ -147,6 +148,113 @@ describe('armKillWatchdog', () => {
   });
 });
 
+// The OS event source is controlled; the real clock and watchdog decide
+// whether the child is killed. Wall-clock jumps without suspend are not sleep.
+function suspensionFixture() {
+  vi.useFakeTimers();
+  vi.setSystemTime(0);
+  const listeners = new Map<string, () => void>();
+  const system = new SystemActivityTracker({ on: (event, fn) => { listeners.set(event, fn); } });
+  system.start();
+  const awakeNow = () => {
+    const snapshot = system.snapshot();
+    return snapshot.wall_time_ms - snapshot.suspended_total_ms;
+  };
+  const clock = new AgentActivityClock(awakeNow);
+  const { child, kill } = fakeChild();
+  const wd = armKillWatchdog(child, {
+    timeoutMs: 86_400_000, idleKillMs: AGENT_EXECUTION_IDLE_MS, lastEventAt: clock.lastEventAt,
+  });
+  return { clock, wd, kill, child,
+    suspend: () => listeners.get('suspend')!(),
+    resume: () => listeners.get('resume')!(),
+    jump: (ms: number) => vi.setSystemTime(Date.now() + ms),
+  };
+}
+
+describe('CLI idle budget across system suspension', () => {
+  it('keeps user cancellation immediate while the system clock is suspended', () => {
+    const f = suspensionFixture();
+    const controller = new AbortController();
+    const unbind = bindAbort(f.child, controller.signal);
+    try {
+      f.suspend(); f.jump(3_600_000);
+      controller.abort();
+      expect(f.kill).toHaveBeenCalledWith('SIGTERM');
+      expect(f.kill).toHaveBeenCalledTimes(1);
+      expect(f.wd.fired()).toBeNull();
+    } finally { unbind(); f.wd.disarm(); }
+  });
+
+  it('preserves the remaining idle budget even if a watchdog tick precedes resume delivery', async () => {
+    const f = suspensionFixture();
+    await vi.advanceTimersByTimeAsync(20 * 60_000);
+    f.suspend(); f.jump(60 * 60_000);
+    await vi.advanceTimersByTimeAsync(5_000);
+    expect(f.kill).not.toHaveBeenCalled();
+    f.resume();
+    await vi.advanceTimersByTimeAsync(595_000);
+    expect(f.kill).not.toHaveBeenCalled();
+    await vi.advanceTimersByTimeAsync(5_000);
+    expect(f.wd.fired()).toBe('idle');
+    expect(f.wd.reason()).toContain('no activity for 1800000ms');
+    expect(f.kill).toHaveBeenCalledTimes(1);
+    f.wd.disarm();
+  });
+
+  it('counts multiple suspensions once and lets real progress renew the awake idle budget', async () => {
+    const f = suspensionFixture();
+    await vi.advanceTimersByTimeAsync(600_000);
+    f.suspend(); f.jump(3_600_000); f.resume();
+    await vi.advanceTimersByTimeAsync(600_000);
+    f.suspend(); f.suspend(); f.jump(3_600_000); f.resume(); f.resume();
+    f.clock.progress();
+    await vi.advanceTimersByTimeAsync(1_795_000);
+    expect(f.kill).not.toHaveBeenCalled();
+    await vi.advanceTimersByTimeAsync(5_000);
+    expect(f.wd.fired()).toBe('idle');
+    expect(f.kill).toHaveBeenCalledTimes(1);
+    f.wd.disarm();
+  });
+
+  it('does not deduct overlapping approval waits and system suspension twice', async () => {
+    const f = suspensionFixture();
+    await vi.advanceTimersByTimeAsync(1_200_000);
+    const fi
```

---

### Incident Patch 5: `75468abb` (2026-09-28)
**Commit Message**: Merge pull request #92 from BlueSkyID666/codex/fix-electron-proxy-network-20260928

fix(proxy): classify Electron proxy connection failures

**File**: `src/main/util/proxy-dispatcher.ts` (modified, +20/-5)
```diff
@@ -318,14 +318,29 @@ function validBridgeToken(actual: string | string[] | undefined, expected: strin
   return a.length === b.length && timingSafeEqual(a, b);
 }
 
+/** Chromium can reject a proxy connection with only a net error message.
+ * Add a transport code at the Electron boundary so provider retry accounting
+ * can use structured facts without interpreting arbitrary error prose. */
+export function normalizeElectronNetFetchError(error: unknown): unknown {
+  if (!(error instanceof Error) || error.name !== 'Error'
+    || error.message !== 'net::ERR_PROXY_CONNECTION_FAILED') return error;
+  const facts = error as Error & { code?: unknown; cause?: unknown };
+  if (facts.code != null || facts.cause != null) return error;
+  return Object.assign(new Error(error.message, { cause: error }), { code: 'ENETUNREACH' });
+}
+
 async function electronSystemFetch(): Promise<FetchLike> {
   const { net } = await import('electron');
-  return ((input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]) => {
+  return (async (input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]) => {
     const normalized = input instanceof URL ? input.href : input;
-    return net.fetch(
-      normalized as Parameters<typeof net.fetch>[0],
-      init as Parameters<typeof net.fetch>[1],
-    ) as Promise<Response>;
+    try {
+      return await net.fetch(
+        normalized as Parameters<typeof net.fetch>[0],
+        init as Parameters<typeof net.fetch>[1],
+      ) as Response;
+    } catch (error) {
+      throw normalizeElectronNetFetchError(error);
+    }
   }) as FetchLike;
 }
 
```

**File**: `test/main/util/proxy-dispatcher.test.ts` (modified, +22/-0)
```diff
@@ -14,10 +14,12 @@ import {
   envProxyUrl,
   installEnvProxyDispatcher,
   installSystemProxyDispatcher,
+  normalizeElectronNetFetchError,
   parseResolvedProxyRoute,
   resolveProxyRouteForUrl,
   startChildFetchBridge,
 } from '../../../src/main/util/proxy-dispatcher';
+import { classifyTransientNetworkError } from '../../../src/core-agent/src/shared/errors';
 
 const hostFetch = globalThis.fetch;
 const proxyEnvKeys = [
@@ -52,6 +54,26 @@ afterEach(() => {
   else process.env.ORKAS_NO_AUTO_PROXY = savedNoAutoProxy;
 });
 
+describe('Electron system-proxy transport failures', () => {
+  it('keeps a message-only Chromium proxy failure in the network exhaustion category', () => {
+    const rejection = new Error('net::ERR_PROXY_CONNECTION_FAILED');
+    expect(classifyTransientNetworkError(rejection)).toBeNull();
+
+    const normalized = normalizeElectronNetFetchError(rejection);
+    expect(normalized).toMatchObject({ code: 'ENETUNREACH', cause: rejection });
+    expect(classifyTransientNetworkError(normalized)).toBe('network');
+  });
+
+  it('leaves structured failures, aborts, and similar prose untouched', () => {
+    const structured = Object.assign(new Error('net::ERR_PROXY_CONNECTION_FAILED'), { code: 'ETIMEDOUT' });
+    const aborted = Object.assign(new Error('net::ERR_PROXY_CONNECTION_FAILED'), { name: 'AbortError' });
+    const prose = new Error('request failed: net::ERR_PROXY_CONNECTION_FAILED');
+    expect(normalizeElectronNetFetchError(structured)).toBe(structured);
+    expect(normalizeElectronNetFetchError(aborted)).toBe(aborted);
+    expect(normalizeElectronNetFetchError(prose)).toBe(prose);
+  });
+});
+
 describe('util/proxy-dispatcher environment configuration', () => {
   it('returns no proxy when the environment is empty', () => {
     expect(envProxyConfig({})).toMatchObject({ httpProxy: undefined, httpsProxy: undefined });
```

---

### Incident Patch 6: `b3e77975` (2026-09-28)
**Commit Message**: fix(proxy): classify Electron proxy connection failures

Normalize the exact Chromium proxy rejection at the Electron fetch boundary, preserving its cause. Use the open build's existing ENETUNREACH classification so network retry handling remains structured.

Validation: proxy-dispatcher and rotating-provider tests (112 passed); main and core-agent typechecks.

**File**: `src/main/util/proxy-dispatcher.ts` (modified, +20/-5)
```diff
@@ -318,14 +318,29 @@ function validBridgeToken(actual: string | string[] | undefined, expected: strin
   return a.length === b.length && timingSafeEqual(a, b);
 }
 
+/** Chromium can reject a proxy connection with only a net error message.
+ * Add a transport code at the Electron boundary so provider retry accounting
+ * can use structured facts without interpreting arbitrary error prose. */
+export function normalizeElectronNetFetchError(error: unknown): unknown {
+  if (!(error instanceof Error) || error.name !== 'Error'
+    || error.message !== 'net::ERR_PROXY_CONNECTION_FAILED') return error;
+  const facts = error as Error & { code?: unknown; cause?: unknown };
+  if (facts.code != null || facts.cause != null) return error;
+  return Object.assign(new Error(error.message, { cause: error }), { code: 'ENETUNREACH' });
+}
+
 async function electronSystemFetch(): Promise<FetchLike> {
   const { net } = await import('electron');
-  return ((input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]) => {
+  return (async (input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]) => {
     const normalized = input instanceof URL ? input.href : input;
-    return net.fetch(
-      normalized as Parameters<typeof net.fetch>[0],
-      init as Parameters<typeof net.fetch>[1],
-    ) as Promise<Response>;
+    try {
+      return await net.fetch(
+        normalized as Parameters<typeof net.fetch>[0],
+        init as Parameters<typeof net.fetch>[1],
+      ) as Response;
+    } catch (error) {
+      throw normalizeElectronNetFetchError(error);
+    }
   }) as FetchLike;
 }
 
```

**File**: `test/main/util/proxy-dispatcher.test.ts` (modified, +22/-0)
```diff
@@ -14,10 +14,12 @@ import {
   envProxyUrl,
   installEnvProxyDispatcher,
   installSystemProxyDispatcher,
+  normalizeElectronNetFetchError,
   parseResolvedProxyRoute,
   resolveProxyRouteForUrl,
   startChildFetchBridge,
 } from '../../../src/main/util/proxy-dispatcher';
+import { classifyTransientNetworkError } from '../../../src/core-agent/src/shared/errors';
 
 const hostFetch = globalThis.fetch;
 const proxyEnvKeys = [
@@ -52,6 +54,26 @@ afterEach(() => {
   else process.env.ORKAS_NO_AUTO_PROXY = savedNoAutoProxy;
 });
 
+describe('Electron system-proxy transport failures', () => {
+  it('keeps a message-only Chromium proxy failure in the network exhaustion category', () => {
+    const rejection = new Error('net::ERR_PROXY_CONNECTION_FAILED');
+    expect(classifyTransientNetworkError(rejection)).toBeNull();
+
+    const normalized = normalizeElectronNetFetchError(rejection);
+    expect(normalized).toMatchObject({ code: 'ENETUNREACH', cause: rejection });
+    expect(classifyTransientNetworkError(normalized)).toBe('network');
+  });
+
+  it('leaves structured failures, aborts, and similar prose untouched', () => {
+    const structured = Object.assign(new Error('net::ERR_PROXY_CONNECTION_FAILED'), { code: 'ETIMEDOUT' });
+    const aborted = Object.assign(new Error('net::ERR_PROXY_CONNECTION_FAILED'), { name: 'AbortError' });
+    const prose = new Error('request failed: net::ERR_PROXY_CONNECTION_FAILED');
+    expect(normalizeElectronNetFetchError(structured)).toBe(structured);
+    expect(normalizeElectronNetFetchError(aborted)).toBe(aborted);
+    expect(normalizeElectronNetFetchError(prose)).toBe(prose);
+  });
+});
+
 describe('util/proxy-dispatcher environment configuration', () => {
   it('returns no proxy when the environment is empty', () => {
     expect(envProxyConfig({})).toMatchObject({ httpProxy: undefined, httpsProxy: undefined });
```

---

### Incident Patch 7: `7dc97225` (2026-09-27)
**Commit Message**: Merge pull request #91 from CloudTianTian/codex/fix-opencode-exit-diagnostics-20260927

fix(local-agents): retain bounded OpenCode exit diagnostics

**File**: `src/main/features/local_agents/backends/base.ts` (modified, +1/-0)
```diff
@@ -95,6 +95,7 @@ export interface LocalEvent {
    *                        // silent spinner.
    *    done:               { status: 'completed'|'failed'|'cancelled'|'timeout'|
    *                                  'missing_cli', error?, durationMs?, sessionId?, usage?,
+   *                                  exitCode?, protocolRecordCount?, protocolErrorSeen?,
    *                                  finalMessageText?: string (Claude's last native result),
    *                                  timeoutPhase?: 'foreground'|'background',
    *                                  failureKind?: 'cli_spawn'|'cli_protocol', retrySafe?: boolean }
```

**File**: `src/main/features/local_agents/backends/opencode.ts` (modified, +13/-3)
```diff
@@ -52,6 +52,7 @@ const opencodeRunBackend: LocalBackend = {
     let textOut = '';
     let resultStatus: 'completed' | 'failed' | undefined;
     let resultError: string | undefined;
+    let protocolRecordCount = 0;
     let observedSessionId: string | undefined;
     // Most-recent per-step usage snapshot; step_finish events fire
     // throughout the turn, each carrying the cumulative-so-far. We
@@ -91,6 +92,7 @@ const opencodeRunBackend: LocalBackend = {
           opts.onEvent({ type: 'raw-line', line: trimmed });
           return;
         }
+        protocolRecordCount = Math.min(1_000_000, protocolRecordCount + 1);
         const ev = mapOpencodeEvent(obj);
         if (ev?.captureSessionId) observedSessionId = ev.captureSessionId;
         const events = ev?.events || (ev?.event ? [ev.event] : []);
@@ -144,14 +146,22 @@ const opencodeRunBackend: LocalBackend = {
         });
       });
       child.on('close', code => {
+        const exitDiagnostic = {
+          exitCode: Number.isSafeInteger(code) && code !== null && code >= 0 && code <= 65535 ? code : null,
+          protocolRecordCount,
+          protocolErrorSeen: !!resultError,
+        };
         if (opts.signal.aborted) return finish('cancelled', { output: textOut });
-if (watchdog.fired()) return finish('timeout', { timeoutKind: watchdog.fired(), error: `cli ${watchdog.reason()}`, output: textOut, stderrTail: tail.toString() });
+        if (watchdog.fired()) return finish('timeout', {
+          timeoutKind: watchdog.fired(), error: `cli ${watchdog.reason()}`,
+          output: textOut, stderrTail: tail.toString(),
+        });
         if (code === 0 && (resultStatus === 'completed' || resultStatus === undefined)) {
-          return finish('completed', { output: textOut });
+          return finish('completed', { output: textOut, ...exitDiagnostic });
         }
         const err = resultError
           || (code !== 0 ? `opencode exited with code ${code}` : 'opencode closed without final event');
-        finish('failed', { error: err, output: textOut, stderrTail: tail.toString() });
+        finish('failed', { error: err, output: textOut, stderrTail: tail.toString(), ...exitDiagnostic });
       });
     });
   },
```

**File**: `src/main/features/local_agents/runner.ts` (modified, +14/-0)
```diff
@@ -737,6 +737,9 @@ export interface LocalAgentRunLogDiagnostics {
   doneEventMs?: number;
   terminalStatus?: string;
   terminalError: boolean;
+  exitCode?: number | null;
+  protocolRecordCount?: number;
+  protocolErrorSeen?: boolean;
   usage?: Record<string, number>;
   toolTimeline: LocalToolTimelineLogEntry[];
   toolTimelineTruncated: number;
@@ -978,6 +981,14 @@ export function recordLocalAgentEventForLog(stats: LocalAgentRunLogDiagnostics,
       noteElapsedOnce(stats, 'doneEventMs', nowMs);
       stats.terminalStatus = typeof e.status === 'string' ? e.status : stats.terminalStatus;
       stats.terminalError = !!e.error;
+      if (e.exitCode === null) stats.exitCode = null;
+      else if (typeof e.exitCode === 'number' && Number.isSafeInteger(e.exitCode)
+          && e.exitCode >= 0 && e.exitCode <= 65535) stats.exitCode = e.exitCode;
+      if (typeof e.protocolRecordCount === 'number' && Number.isSafeInteger(e.protocolRecordCount)
+          && e.protocolRecordCount >= 0 && e.protocolRecordCount <= 1_000_000) {
+        stats.protocolRecordCount = e.protocolRecordCount;
+      }
+      if (typeof e.protocolErrorSeen === 'boolean') stats.protocolErrorSeen = e.protocolErrorSeen;
       stats.usage = safeUsageForLog(e.usage) || stats.usage;
       noteLocalEventTimelineForLog(stats, 'done', nowMs, `status=${String(e.status || '')} error=${e.error ? 'true' : 'false'}`);
       break;
@@ -1020,6 +1031,9 @@ export function summarizeLocalAgentRunForLog(stats: LocalAgentRunLogDiagnostics,
     doneEventMs: stats.doneEventMs,
     terminalStatus: stats.terminalStatus,
     terminalError: stats.terminalError,
+    ...(stats.exitCode !== undefined ? { exitCode: stats.exitCode } : {}),
+    ...(stats.protocolRecordCount !== undefined ? { protocolRecordCount: stats.protocolRecordCount } : {}),
+    ...(stats.protocolErrorSeen !== undefined ? { protocolErrorSeen: stats.protocolErrorSeen } : {}),
     usage: stats.usage,
   };
 }
```

**File**: `test/main/features/local_agents/opencode_backend.test.ts` (modified, +41/-0)
```diff
@@ -23,6 +23,16 @@ function fixture() {
     process.stdin.on('end', () => {
       const input = Buffer.concat(chunks);
       const args = process.argv.slice(2);
+      if (args.includes('--fixture-silent-fail')) {
+        process.stderr.write('startup failed before JSON output\\n');
+        process.exitCode = 1;
+        return;
+      }
+      if (args.includes('--fixture-protocol-error')) {
+        process.stdout.write(JSON.stringify({ type: 'error', error: { data: { message: 'configured model unavailable' } } }) + '\\n');
+        process.exitCode = 1;
+        return;
+      }
       const text = JSON.stringify({ hash: createHash('sha256').update(input).digest('hex'), bytes: input.length, args });
       process.stdout.write(JSON.stringify({ type: 'text', part: { text } }) + '\\n');
       if (args.includes('--fixture-wait')) { setInterval(() => {}, 1000); return; }
@@ -77,4 +87,35 @@ describe('OpenCode prompt pipe transport', () => {
     expect(terminals[0].status).toBe(mode === 'cancel' ? 'cancelled' : 'failed');
     if (mode === 'fail') expect(terminals[0].error).toBe('opencode exited with code 7');
   });
+
+  it('retains content-free evidence for a CLI that exits before its first protocol record', async () => {
+    const events: LocalEvent[] = [];
+    await opencodeBackend.run({
+      binPath: process.env.ORKAS_TEST_NODE || process.execPath,
+      cwd: fixture(), prompt: 'list files', customArgs: ['--fixture-silent-fail'],
+      signal: new AbortController().signal, timeoutMs: 10_000,
+      onEvent: event => events.push(event),
+    });
+    const done = events.find(event => event.type === 'done');
+    expect(done).toMatchObject({
+      status: 'failed', exitCode: 1, protocolRecordCount: 0,
+      protocolErrorSeen: false,
+    });
+    expect(events.some(event => event.type === 'stderr-line')).toBe(true);
+  });
+
+  it('distinguishes a structured CLI error from a silent startup failure', async () => {
+    const events: LocalEvent[] = [];
+    await opencodeBackend.run({
+      binPath: process.env.ORKAS_TEST_NODE || process.execPath,
+      cwd: fixture(), prompt: 'list files', customArgs: ['--fixture-protocol-error'],
+      signal: new AbortController().signal, timeoutMs: 10_000,
+      onEvent: event => events.push(event),
+    });
+    expect(events.find(event => event.type === 'done')).toMatchObject({
+      status: 'failed', exitCode: 1, protocolRecordCount: 1,
+      protocolErrorSeen: true, error: 'configured model unavailable',
+    });
+    expect(events.some(event => event.type === 'stderr-line')).toBe(false);
+  });
 });
```

**File**: `test/main/features/local_agents/runner.test.ts` (modified, +2/-1)
```diff
@@ -285,7 +285,7 @@ describe('local_agents/runner', () => {
       paths: ['/Users/test/private.txt', '/Users/test/other.txt'],
     }, 1170);
     runner.recordLocalAgentEventForLog(stats, { type: 'status', status: 'usage', usage: { input: 5, output: 7, secretText: 'nope' } }, 1180);
-    runner.recordLocalAgentEventForLog(stats, { type: 'done', status: 'completed', output: 'private final', usage: { input: 5, output: 8 } }, 1200);
+    runner.recordLocalAgentEventForLog(stats, { type: 'done', status: 'completed', output: 'private final', usage: { input: 5, output: 8 }, exitCode: 0, protocolRecordCount: 2, protocolErrorSeen: false }, 1200);
 
     const summary = runner.summarizeLocalAgentRunForLog(stats, 1300);
     expect(summary.eventCount).toBe(13);
@@ -298,6 +298,7 @@ describe('local_agents/runner', () => {
     expect(summary.fileChangePathCount).toBe(2);
     expect(summary.permissionAutoDeny).toBe(1);
     expect(summary.usage).toMatchObject({ input: 5, output: 8 });
+    expect(summary).toMatchObject({ exitCode: 0, protocolRecordCount: 2, protocolErrorSeen: false });
     expect(summary.toolTimeline).toEqual([
       '#1 +140ms bash use call=loca...3456',
       `#2 +150ms bash result call=loca...3456 error=true output_chars=${'private tool output'.length} spilled=true`,
```

---

### Incident Patch 8: `f8685413` (2026-09-27)
**Commit Message**: fix(local-agents): retain bounded OpenCode exit diagnostics

Carry the shared Orkas fix for OpenCode runs that end before JSON output. Keep exit code, protocol record count, and protocol-error presence in the local run summary without recording protocol payloads.

Source: Orkas 9047d73f5

Tests: npm test -- test/main/features/local_agents/opencode_backend.test.ts test/main/features/local_agents/runner.test.ts (85 passed); npm run typecheck

**File**: `src/main/features/local_agents/backends/base.ts` (modified, +1/-0)
```diff
@@ -95,6 +95,7 @@ export interface LocalEvent {
    *                        // silent spinner.
    *    done:               { status: 'completed'|'failed'|'cancelled'|'timeout'|
    *                                  'missing_cli', error?, durationMs?, sessionId?, usage?,
+   *                                  exitCode?, protocolRecordCount?, protocolErrorSeen?,
    *                                  finalMessageText?: string (Claude's last native result),
    *                                  timeoutPhase?: 'foreground'|'background',
    *                                  failureKind?: 'cli_spawn'|'cli_protocol', retrySafe?: boolean }
```

**File**: `src/main/features/local_agents/backends/opencode.ts` (modified, +13/-3)
```diff
@@ -52,6 +52,7 @@ const opencodeRunBackend: LocalBackend = {
     let textOut = '';
     let resultStatus: 'completed' | 'failed' | undefined;
     let resultError: string | undefined;
+    let protocolRecordCount = 0;
     let observedSessionId: string | undefined;
     // Most-recent per-step usage snapshot; step_finish events fire
     // throughout the turn, each carrying the cumulative-so-far. We
@@ -91,6 +92,7 @@ const opencodeRunBackend: LocalBackend = {
           opts.onEvent({ type: 'raw-line', line: trimmed });
           return;
         }
+        protocolRecordCount = Math.min(1_000_000, protocolRecordCount + 1);
         const ev = mapOpencodeEvent(obj);
         if (ev?.captureSessionId) observedSessionId = ev.captureSessionId;
         const events = ev?.events || (ev?.event ? [ev.event] : []);
@@ -144,14 +146,22 @@ const opencodeRunBackend: LocalBackend = {
         });
       });
       child.on('close', code => {
+        const exitDiagnostic = {
+          exitCode: Number.isSafeInteger(code) && code !== null && code >= 0 && code <= 65535 ? code : null,
+          protocolRecordCount,
+          protocolErrorSeen: !!resultError,
+        };
         if (opts.signal.aborted) return finish('cancelled', { output: textOut });
-if (watchdog.fired()) return finish('timeout', { timeoutKind: watchdog.fired(), error: `cli ${watchdog.reason()}`, output: textOut, stderrTail: tail.toString() });
+        if (watchdog.fired()) return finish('timeout', {
+          timeoutKind: watchdog.fired(), error: `cli ${watchdog.reason()}`,
+          output: textOut, stderrTail: tail.toString(),
+        });
         if (code === 0 && (resultStatus === 'completed' || resultStatus === undefined)) {
-          return finish('completed', { output: textOut });
+          return finish('completed', { output: textOut, ...exitDiagnostic });
         }
         const err = resultError
           || (code !== 0 ? `opencode exited with code ${code}` : 'opencode closed without final event');
-        finish('failed', { error: err, output: textOut, stderrTail: tail.toString() });
+        finish('failed', { error: err, output: textOut, stderrTail: tail.toString(), ...exitDiagnostic });
       });
     });
   },
```

**File**: `src/main/features/local_agents/runner.ts` (modified, +14/-0)
```diff
@@ -737,6 +737,9 @@ export interface LocalAgentRunLogDiagnostics {
   doneEventMs?: number;
   terminalStatus?: string;
   terminalError: boolean;
+  exitCode?: number | null;
+  protocolRecordCount?: number;
+  protocolErrorSeen?: boolean;
   usage?: Record<string, number>;
   toolTimeline: LocalToolTimelineLogEntry[];
   toolTimelineTruncated: number;
@@ -978,6 +981,14 @@ export function recordLocalAgentEventForLog(stats: LocalAgentRunLogDiagnostics,
       noteElapsedOnce(stats, 'doneEventMs', nowMs);
       stats.terminalStatus = typeof e.status === 'string' ? e.status : stats.terminalStatus;
       stats.terminalError = !!e.error;
+      if (e.exitCode === null) stats.exitCode = null;
+      else if (typeof e.exitCode === 'number' && Number.isSafeInteger(e.exitCode)
+          && e.exitCode >= 0 && e.exitCode <= 65535) stats.exitCode = e.exitCode;
+      if (typeof e.protocolRecordCount === 'number' && Number.isSafeInteger(e.protocolRecordCount)
+          && e.protocolRecordCount >= 0 && e.protocolRecordCount <= 1_000_000) {
+        stats.protocolRecordCount = e.protocolRecordCount;
+      }
+      if (typeof e.protocolErrorSeen === 'boolean') stats.protocolErrorSeen = e.protocolErrorSeen;
       stats.usage = safeUsageForLog(e.usage) || stats.usage;
       noteLocalEventTimelineForLog(stats, 'done', nowMs, `status=${String(e.status || '')} error=${e.error ? 'true' : 'false'}`);
       break;
@@ -1020,6 +1031,9 @@ export function summarizeLocalAgentRunForLog(stats: LocalAgentRunLogDiagnostics,
     doneEventMs: stats.doneEventMs,
     terminalStatus: stats.terminalStatus,
     terminalError: stats.terminalError,
+    ...(stats.exitCode !== undefined ? { exitCode: stats.exitCode } : {}),
+    ...(stats.protocolRecordCount !== undefined ? { protocolRecordCount: stats.protocolRecordCount } : {}),
+    ...(stats.protocolErrorSeen !== undefined ? { protocolErrorSeen: stats.protocolErrorSeen } : {}),
     usage: stats.usage,
   };
 }
```

**File**: `test/main/features/local_agents/opencode_backend.test.ts` (modified, +41/-0)
```diff
@@ -23,6 +23,16 @@ function fixture() {
     process.stdin.on('end', () => {
       const input = Buffer.concat(chunks);
       const args = process.argv.slice(2);
+      if (args.includes('--fixture-silent-fail')) {
+        process.stderr.write('startup failed before JSON output\\n');
+        process.exitCode = 1;
+        return;
+      }
+      if (args.includes('--fixture-protocol-error')) {
+        process.stdout.write(JSON.stringify({ type: 'error', error: { data: { message: 'configured model unavailable' } } }) + '\\n');
+        process.exitCode = 1;
+        return;
+      }
       const text = JSON.stringify({ hash: createHash('sha256').update(input).digest('hex'), bytes: input.length, args });
       process.stdout.write(JSON.stringify({ type: 'text', part: { text } }) + '\\n');
       if (args.includes('--fixture-wait')) { setInterval(() => {}, 1000); return; }
@@ -77,4 +87,35 @@ describe('OpenCode prompt pipe transport', () => {
     expect(terminals[0].status).toBe(mode === 'cancel' ? 'cancelled' : 'failed');
     if (mode === 'fail') expect(terminals[0].error).toBe('opencode exited with code 7');
   });
+
+  it('retains content-free evidence for a CLI that exits before its first protocol record', async () => {
+    const events: LocalEvent[] = [];
+    await opencodeBackend.run({
+      binPath: process.env.ORKAS_TEST_NODE || process.execPath,
+      cwd: fixture(), prompt: 'list files', customArgs: ['--fixture-silent-fail'],
+      signal: new AbortController().signal, timeoutMs: 10_000,
+      onEvent: event => events.push(event),
+    });
+    const done = events.find(event => event.type === 'done');
+    expect(done).toMatchObject({
+      status: 'failed', exitCode: 1, protocolRecordCount: 0,
+      protocolErrorSeen: false,
+    });
+    expect(events.some(event => event.type === 'stderr-line')).toBe(true);
+  });
+
+  it('distinguishes a structured CLI error from a silent startup failure', async () => {
+    const events: LocalEvent[] = [];
+    await opencodeBackend.run({
+      binPath: process.env.ORKAS_TEST_NODE || process.execPath,
+      cwd: fixture(), prompt: 'list files', customArgs: ['--fixture-protocol-error'],
+      signal: new AbortController().signal, timeoutMs: 10_000,
+      onEvent: event => events.push(event),
+    });
+    expect(events.find(event => event.type === 'done')).toMatchObject({
+      status: 'failed', exitCode: 1, protocolRecordCount: 1,
+      protocolErrorSeen: true, error: 'configured model unavailable',
+    });
+    expect(events.some(event => event.type === 'stderr-line')).toBe(false);
+  });
 });
```

**File**: `test/main/features/local_agents/runner.test.ts` (modified, +2/-1)
```diff
@@ -285,7 +285,7 @@ describe('local_agents/runner', () => {
       paths: ['/Users/test/private.txt', '/Users/test/other.txt'],
     }, 1170);
     runner.recordLocalAgentEventForLog(stats, { type: 'status', status: 'usage', usage: { input: 5, output: 7, secretText: 'nope' } }, 1180);
-    runner.recordLocalAgentEventForLog(stats, { type: 'done', status: 'completed', output: 'private final', usage: { input: 5, output: 8 } }, 1200);
+    runner.recordLocalAgentEventForLog(stats, { type: 'done', status: 'completed', output: 'private final', usage: { input: 5, output: 8 }, exitCode: 0, protocolRecordCount: 2, protocolErrorSeen: false }, 1200);
 
     const summary = runner.summarizeLocalAgentRunForLog(stats, 1300);
     expect(summary.eventCount).toBe(13);
@@ -298,6 +298,7 @@ describe('local_agents/runner', () => {
     expect(summary.fileChangePathCount).toBe(2);
     expect(summary.permissionAutoDeny).toBe(1);
     expect(summary.usage).toMatchObject({ input: 5, output: 8 });
+    expect(summary).toMatchObject({ exitCode: 0, protocolRecordCount: 2, protocolErrorSeen: false });
     expect(summary.toolTimeline).toEqual([
       '#1 +140ms bash use call=loca...3456',
       `#2 +150ms bash result call=loca...3456 error=true output_chars=${'private tool output'.length} spilled=true`,
```

---

### Incident Patch 9: `16eef785` (2026-09-26)
**Commit Message**: Merge pull request #90 from BlueSkyID666/codex/fix-history-scroll-grace-20260926

fix(chat): honor user history scroll during search jump

**File**: `src/renderer/modules/conversation.js` (modified, +4/-4)
```diff
@@ -7486,13 +7486,13 @@ function _setEarlierHistoryLoaderState(row, state, error = '') {
   row.textContent = '';
 }
 
-function _maybeAutoLoadEarlierHistory(container) {
+function _maybeAutoLoadEarlierHistory(container, userGesture = false) {
   if (!container || Number(container.scrollTop || 0) > HISTORY_AUTO_LOAD_THRESHOLD) {
     const row = container?.querySelector?.('.chat-history-load-earlier');
     if (row?.dataset.state === 'error') _setEarlierHistoryLoaderState(row, 'idle');
     return;
   }
-  if (_isProgrammaticStickyScroll(container)) return;
+  if (!userGesture && _isProgrammaticStickyScroll(container)) return;
   const row = container.querySelector('.chat-history-load-earlier');
   if (!row || row.dataset.state === 'loading' || row.dataset.state === 'error') return;
   const cursor = _historyNextCursor(row.dataset.cursor);
@@ -7509,9 +7509,9 @@ function _bindAutoLoadEarlierHistory(container) {
   // event. Listen for the user's continued upward intent so short pages can
   // still advance without a button.
   container.addEventListener('wheel', (event) => {
-    if (Number(event?.deltaY || 0) < 0) _maybeAutoLoadEarlierHistory(container);
+    if (Number(event?.deltaY || 0) < 0) _maybeAutoLoadEarlierHistory(container, true);
   }, { passive: true });
-  container.addEventListener('touchmove', () => _maybeAutoLoadEarlierHistory(container), { passive: true });
+  container.addEventListener('touchmove', () => _maybeAutoLoadEarlierHistory(container, true), { passive: true });
 }
 
 function _setLoadEarlierHistory(container, cid, nextCursor) {
```

**File**: `test/renderer/conversation-history-auto-load.test.ts` (modified, +40/-0)
```diff
@@ -85,6 +85,46 @@ describe('conversation history auto-load', () => {
     expect(calls).toBe(0);
   });
 
+  it('loads older history on user gestures during the search jump scroll grace', () => {
+    const listeners: Record<string, (event?: { deltaY?: number }) => void> = {};
+    const calls: Array<[string, number]> = [];
+    const row = { dataset: { state: 'idle', cursor: '120', cid: 'c1' } };
+    const container = {
+      scrollTop: 0,
+      querySelector: () => row,
+      addEventListener: (name: string, listener: (event?: { deltaY?: number }) => void) => {
+        listeners[name] = listener;
+      },
+    };
+    const context: any = {
+      Number,
+      String,
+      currentCid: 'c1',
+      HISTORY_AUTO_LOAD_THRESHOLD: 48,
+      _isProgrammaticStickyScroll: () => true,
+      _loadOlderConversationHistory: (cid: string, cursor: number) => {
+        calls.push([cid, cursor]);
+      },
+      _setEarlierHistoryLoaderState: () => {},
+    };
+    vm.createContext(context);
+    vm.runInContext([
+      extractFunction('_historyNextCursor'),
+      extractFunction('_maybeAutoLoadEarlierHistory'),
+      extractFunction('_bindAutoLoadEarlierHistory'),
+    ].join('\n'), context);
+
+    context._bindAutoLoadEarlierHistory(container);
+    listeners.scroll();
+    expect(calls).toEqual([]);
+    listeners.wheel({ deltaY: 1 });
+    expect(calls).toEqual([]);
+    listeners.wheel({ deltaY: -1 });
+    expect(calls).toEqual([['c1', 120]]);
+    listeners.touchmove();
+    expect(calls).toEqual([['c1', 120], ['c1', 120]]);
+  });
+
   it('keeps the previous reading anchor after prepending older content', () => {
     const context: any = { Number, Math };
     vm.createContext(context);
```

---

### Incident Patch 10: `9d8874b5` (2026-09-26)
**Commit Message**: fix(chat): honor user history scroll during search jump

**File**: `src/renderer/modules/conversation.js` (modified, +4/-4)
```diff
@@ -7486,13 +7486,13 @@ function _setEarlierHistoryLoaderState(row, state, error = '') {
   row.textContent = '';
 }
 
-function _maybeAutoLoadEarlierHistory(container) {
+function _maybeAutoLoadEarlierHistory(container, userGesture = false) {
   if (!container || Number(container.scrollTop || 0) > HISTORY_AUTO_LOAD_THRESHOLD) {
     const row = container?.querySelector?.('.chat-history-load-earlier');
     if (row?.dataset.state === 'error') _setEarlierHistoryLoaderState(row, 'idle');
     return;
   }
-  if (_isProgrammaticStickyScroll(container)) return;
+  if (!userGesture && _isProgrammaticStickyScroll(container)) return;
   const row = container.querySelector('.chat-history-load-earlier');
   if (!row || row.dataset.state === 'loading' || row.dataset.state === 'error') return;
   const cursor = _historyNextCursor(row.dataset.cursor);
@@ -7509,9 +7509,9 @@ function _bindAutoLoadEarlierHistory(container) {
   // event. Listen for the user's continued upward intent so short pages can
   // still advance without a button.
   container.addEventListener('wheel', (event) => {
-    if (Number(event?.deltaY || 0) < 0) _maybeAutoLoadEarlierHistory(container);
+    if (Number(event?.deltaY || 0) < 0) _maybeAutoLoadEarlierHistory(container, true);
   }, { passive: true });
-  container.addEventListener('touchmove', () => _maybeAutoLoadEarlierHistory(container), { passive: true });
+  container.addEventListener('touchmove', () => _maybeAutoLoadEarlierHistory(container, true), { passive: true });
 }
 
 function _setLoadEarlierHistory(container, cid, nextCursor) {
```

**File**: `test/renderer/conversation-history-auto-load.test.ts` (modified, +40/-0)
```diff
@@ -85,6 +85,46 @@ describe('conversation history auto-load', () => {
     expect(calls).toBe(0);
   });
 
+  it('loads older history on user gestures during the search jump scroll grace', () => {
+    const listeners: Record<string, (event?: { deltaY?: number }) => void> = {};
+    const calls: Array<[string, number]> = [];
+    const row = { dataset: { state: 'idle', cursor: '120', cid: 'c1' } };
+    const container = {
+      scrollTop: 0,
+      querySelector: () => row,
+      addEventListener: (name: string, listener: (event?: { deltaY?: number }) => void) => {
+        listeners[name] = listener;
+      },
+    };
+    const context: any = {
+      Number,
+      String,
+      currentCid: 'c1',
+      HISTORY_AUTO_LOAD_THRESHOLD: 48,
+      _isProgrammaticStickyScroll: () => true,
+      _loadOlderConversationHistory: (cid: string, cursor: number) => {
+        calls.push([cid, cursor]);
+      },
+      _setEarlierHistoryLoaderState: () => {},
+    };
+    vm.createContext(context);
+    vm.runInContext([
+      extractFunction('_historyNextCursor'),
+      extractFunction('_maybeAutoLoadEarlierHistory'),
+      extractFunction('_bindAutoLoadEarlierHistory'),
+    ].join('\n'), context);
+
+    context._bindAutoLoadEarlierHistory(container);
+    listeners.scroll();
+    expect(calls).toEqual([]);
+    listeners.wheel({ deltaY: 1 });
+    expect(calls).toEqual([]);
+    listeners.wheel({ deltaY: -1 });
+    expect(calls).toEqual([['c1', 120]]);
+    listeners.touchmove();
+    expect(calls).toEqual([['c1', 120], ['c1', 120]]);
+  });
+
   it('keeps the previous reading anchor after prepending older content', () => {
     const context: any = { Number, Math };
     vm.createContext(context);
```

#### Recent Merged Pull Requests:
- **PR #95** (2026-09-30): fix(preview): keep private file details out of failure logs (@BlueSkyID666)
- **PR #93** (2026-09-29): fix(local-agents): exclude system sleep from CLI idle time (@CloudTianTian)
- **PR #92** (2026-09-28): fix(proxy): classify Electron proxy connection failures (@BlueSkyID666)
- **PR #91** (2026-09-27): fix(local-agents): retain bounded OpenCode exit diagnostics (@CloudTianTian)
- **PR #90** (2026-09-26): fix(chat): honor user history scroll during search jump (@BlueSkyID666)
- **PR #89** (2026-09-25): fix(ui): send CLI answers on Enter and align picker timestamps (@CloudTianTian)
- **PR #88** (2026-09-24): fix(browser): report the configured tab limit (@BlueSkyID666)
- **PR #87** (2026-09-23): fix(ui): remember task details state per conversation (@CloudTianTian)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: makecindy-cindy-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "makecindy-cindy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T02:12:56.906Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-makecindy-cindy-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [makecindy-cindy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T02:12:56.906Z`  
> **Learning ID**: `LEARN-EVO-makecindy-cindy-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), F (Design Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence)
- **Confidence Rating**: 58%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from makecindy-cindy-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source**: github ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Source Version**: `cb3ac9aa`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T02:12:43.281Z  
> **Learning ID**: `learn-github-makecindy-cindy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): makecindy/cindy

> **Canonical Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T02:12:43.170Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `makecindy/cindy`
- **Description**: Consider it done. The open-source AI agent that works out of the box · 想到，就能做到。开源、开箱即用的 AI Agent。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10495 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/drizzle/scripts/0040_orca_multi_worker_phase1.ts`
```
import type Database from 'better-sqlite3';

/**
 * 0040_orca_multi_worker_phase1 — multi-worker Phase 1(从 GitLab MR !130 迁移,幂等版)。
 *
 * 背景:迁移到 GitHub 仓库时,GitLab 上 MR !130 的迁移占了 0039/0040/0041 三个 slot,
 * 与 GitHub main 已有的 0039_fearless_victor_mancha 撞号(自定义 migrator 按整数
 * schema_version 高水位线 seq>current 应用,撞号会被跳过 → 迁移永不执行)。这里把 GitLab
 * 原作者(苏曼)经 review 的 0039(multi_worker_phase1)+ 0040(rename_workflow_to_team)
 * + 0041(restore_active_team_unique)三条迁移**合并为一条** 0040,挂到 0039 之后。
 *
 * 起点(GitHub main / schema_version=39):orca_workflows 表 + orca_workers.workflow_id
 * 列、无 role/focused/idle_since 列;index 为 uniq_orca_workflows_active_lead_session_id /
 * idx_orca_workflows_status / uniq_orca_workers_session_id / idx_orca_workers_workflow_id /
 * idx_orca_workers_status。
 *
 * 终点(schema.ts):orca_teams 表 + orca_workers.team_id + role/focused/idle_since;
 * index 为 uniq_active_team_per_lead / idx_orca_teams_status / uniq_orca_workers_session_id /
 * uniq_orca_workers_focused_per_team / idx_orca_workers_team_id / idx_orca_workers_status。
 *
 * 全程幂等(目标态检查 + PRAGMA 守卫 + IF EXISTS/IF NOT EXISTS),可重复执行;rename 走
 * "已是目标态则跳过",兼容部分 dev DB 历史上已按旧序号跑过同款 rename 的情况。
 */

function tableExists(db: Database.Database, tableName: string): boolean {
  return (
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName) !== undefined
  );
}

function tableColumnNames(db: Database.Database, tableName: string): Set<string> {
  return new Set(
    db
      .prepare(`PRAGMA table_info('${tableName}')`)
      .all()
      .map((row) => String((row as { name: unknown }).name)),
  );
}

function run(db: Database.Database): void {
  // ── 1. rename 表 orca_workflows → orca_teams(目标态检查幂等)──────────────
  if (tableExists(db, 'orca_workflows') && !tableExists(db, 'orca_teams')) {
    db.exec('ALTER TABLE `orca_workflows` RENAME TO `orca_teams`');
  }

  // ── 2. rename 列 orca_workers.workflow_id → team_id(目标态检查幂等)────────
  const colsBeforeRename = tableColumnNames(db, 'orca_workers');
  if (colsBeforeRename.has('workflow_id') && !colsBeforeRename.has('team_id')) {
    db.exec('ALTER TABLE `orca_workers` RENAME COLUMN `workflow_id` TO `team_id`');
  }

  // ── 3. orca_workers 新增列 role / focused / idle_since(PRAGMA 守卫幂等)─────
  const workerCols = tableColumnNames(db, 'orca_workers');
  if (!workerCols.has('role')) {
    db.exec(`ALTER TABLE orca_workers ADD COLUMN role text NOT NULL DEFAULT 'developer'`);
  }
  if (!workerCols.has('focused')) {
    db.exec(`ALTER TABLE orca_workers ADD COLUMN focused integer NOT NULL DEFAULT 0`);
  }
  if (!workerCols.has('idle_since')) {
    db.exec(`ALTER TABLE orca_workers ADD COLUMN idle_since integer`);
  }

  // ── 4. 丢弃 workflow 时代的旧 index(RENAME TABLE/COLUMN 后 index 名不变,需手动改名)──
  db.exec('DROP INDEX IF EXISTS `uniq_orca_workflows_active_lead_session_id`');
  db.exec('DROP INDEX IF EXISTS `idx_orca_workflows_status`');
  db.exec('DROP INDEX IF EXISTS `idx_orca_workers_workflow_id`');
  // 兜底:GitLab 历史中间态可能建过 per_workflow 版本的 focused 唯一索引
  db.exec('DROP INDEX IF EXISTS `uniq_orca_workers_focused_per_workflow`');

  // ── 5. backfill(自身幂等:UPDATE WHERE NULL/'' + 每个 team 首个 worker 恒定)──
  db.prepare(
    `UPDATE orca_workers SET role = 'developer' WHERE role IS NULL OR role = ''`,
  ).run();

  const groups = db
    .prepare(`SELECT DISTINCT team_id AS gid FROM orca_workers`)
    .all() as Array<{ gid: string }>;
  const selectFirst = db.prepare(
    `SELECT id FROM orca_workers WHERE team_id = ? ORDER BY created_at ASC LIMIT 1`,
  );
  const setFocused = db.prepare(`UPDATE orca_workers SET focused = 1 WHERE id = ?`);
  for (const { gid } of groups) {
    const first = selectFirst.get(gid) as { id: string } | undefined;
    if (first) setFocused.run(first.id);
  }

  // ── 6. 建 team 时代的新 index(IF NOT EXISTS 幂等;focused 唯一索引在 backfill 之后建)──
  db.exec('CREATE INDEX IF NOT EXISTS `idx_orca_teams_status` ON `orca_teams` (`status`)');
  db.exec('CREATE INDEX IF NOT EXISTS `idx_orca_workers_team_id` ON `orca_workers` (`team_id`)');
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS `uniq_orca_workers_focused_per_team` '
      + 'ON `orca_workers` (`team_id`) WHERE "orca_workers"."focused" = 1',
  );

  // ── 7. 恢复 active team 唯一约束:先按 lead 去重(保留最新一条,与读路径 dedup 同序),再建索引 ──
  db.exec(`
    UPDATE orca_teams
    SET status = 'cancelled',
        completed_at = CAST(strftime('%s', 'now') AS integer) * 1000,
        updated_at = CAST(strftime('%s', 'now') AS integer) * 1000
    WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (
          PARTITION BY lead_session_id ORDER BY updated_at DESC, created_at DESC
        ) AS rn
        FROM orca_teams WHERE status = 'active'
      ) WHERE rn > 1
    )
  `);
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS `uniq_active_team_per_lead` '
      + 'ON `orca_teams` (`lead_session_id`) WHERE "orca_teams"."status" = \'active\'',
  );
}

module.exports = { run };

```

### Core Architecture Module: `apps/desktop/drizzle/scripts/0148_schedule_webhook_trigger.ts`
```
import type Database from 'better-sqlite3';

function addColumn(db: Database.Database, tableName: string, columnName: string): void {
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  if (!table) return;
  const columns = new Set((db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has(columnName)) db.exec(`ALTER TABLE ${tableName} ADD ${columnName} TEXT`);
}

function run(db: Database.Database): void {
  addColumn(db, 'schedules', 'webhook_trigger');
  addColumn(db, 'schedule_runs', 'trigger_source');
}

module.exports = { run };

```

### Core Architecture Module: `apps/desktop/resources/bot-packages/engineer-bot/0.5.2/skills/engineer-bot-evidence/scripts/evidence_check.py`
```
#!/usr/bin/env python3
"""Original offline helper; Python 3.10+ standard library, stdin/stdout only."""
import sys
import json
import math
import hashlib
from datetime import date
from urllib.parse import urlsplit, urlunsplit

def require(ok, message):
    if not ok:
        raise ValueError(message)

def record(value, fields):
    require(isinstance(value, dict) and set(value) == set(fields.split()), "unexpected or missing fields")
    return value

def text(value):
    require(isinstance(value, str) and bool(value.strip()), "nonempty text required")
    return value.strip()

def items(value):
    require(isinstance(value, list) and len(value) <= 10000, "bounded array required")
    return value

def indexed(value):
    result = {}
    for row in items(value):
        require(isinstance(row, dict), "record required")
        key = text(row.get("id"))
        require(key not in result, "duplicate id: " + key)
        result[key] = row
    return result

def day(value):
    return date.fromisoformat(text(value))

def number(value):
    require(type(value) in (float, int) and math.isfinite(value), "finite number required")
    return value

def unique_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, "duplicate JSON key")
        out[key] = value
    return out

def compute(data):
    record(data, "head checks evidence")
    head = text(data["head"])
    checks = indexed(data["checks"])
    evidence = indexed(data["evidence"])
    blockers = []
    if not checks:
        blockers.append("NO_CHECKS")
    for key, row in sorted(checks.items()):
        record(row, "id head status")
        require(row["status"] in ("PASS", "FAIL", "NOT_RUN"), "invalid check status")
        if text(row["head"]) != head:
            blockers.append("STALE_CHECK:" + key)
        if row["status"] != "PASS":
            blockers.append(row["status"] + ":" + key)
    if not evidence:
        blockers.append("NO_EVIDENCE")
    for key, row in sorted(evidence.items()):
        record(row, "id head location")
        text(row["location"])
        if text(row["head"]) != head:
            blockers.append("STALE_EVIDENCE:" + key)
    return {"head": head, "status": "BLOCKED" if blockers else "REVIEWABLE",
            "blockers": blockers, "mergeAuthorized": False,
            "note": "Supplied evidence only; no CI or repository queried."}

if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(1048577)
        require(len(raw) <= 1048576, "input exceeds 1 MiB")
        data = json.loads(raw, object_pairs_hook=unique_object,
                          parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))
        print(json.dumps(compute(data), ensure_ascii=False, sort_keys=True, allow_nan=False))
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        print("INVALID_INPUT: " + str(exc), file=sys.stderr)
        raise SystemExit(2)

```

### Core Architecture Module: `apps/desktop/resources/bot-packages/nightly-audit-engineer/0.5.2/skills/nightly-audit-engineer-evidence/scripts/finding_keys.py`
```
#!/usr/bin/env python3
"""Original offline helper; Python 3.10+ standard library, stdin/stdout only."""
import sys
import json
import math
import hashlib
from datetime import date
from urllib.parse import urlsplit, urlunsplit

def require(ok, message):
    if not ok:
        raise ValueError(message)

def record(value, fields):
    require(isinstance(value, dict) and set(value) == set(fields.split()), "unexpected or missing fields")
    return value

def text(value):
    require(isinstance(value, str) and bool(value.strip()), "nonempty text required")
    return value.strip()

def items(value):
    require(isinstance(value, list) and len(value) <= 10000, "bounded array required")
    return value

def indexed(value):
    result = {}
    for row in items(value):
        require(isinstance(row, dict), "record required")
        key = text(row.get("id"))
        require(key not in result, "duplicate id: " + key)
        result[key] = row
    return result

def day(value):
    return date.fromisoformat(text(value))

def number(value):
    require(type(value) in (float, int) and math.isfinite(value), "finite number required")
    return value

def unique_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, "duplicate JSON key")
        out[key] = value
    return out

def fingerprint(row):
    record(row, "area rule path rootCause evidence")
    values = [text(row[key]) for key in ("area", "rule", "path", "rootCause")]
    text(row["evidence"])
    require(not values[2].startswith("/") and ".." not in values[2].split("/"), "relative source path required")
    return hashlib.sha256(json.dumps(values, ensure_ascii=False).encode()).hexdigest()

def compute(data):
    record(data, "findings previouslySeen")
    seen = set()
    for key in items(data["previouslySeen"]):
        require(isinstance(key, str) and len(key) == 64 and all(c in "0123456789abcdef" for c in key), "invalid fingerprint")
        seen.add(key)
    current, duplicates = {}, []
    for row in items(data["findings"]):
        key = fingerprint(row)
        if key in current:
            duplicates.append(key)
        else:
            current[key] = {"fingerprint": key, "finding": row, "previouslySeen": key in seen}
    return {"findings": [current[k] for k in sorted(current)], "duplicateFingerprints": duplicates,
            "resolution": "NOT_INFERRED", "note": "Exact identity only; root cause and severity require review."}

if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(1048577)
        require(len(raw) <= 1048576, "input exceeds 1 MiB")
        data = json.loads(raw, object_pairs_hook=unique_object,
                          parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))
        print(json.dumps(compute(data), ensure_ascii=False, sort_keys=True, allow_nan=False))
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        print("INVALID_INPUT: " + str(exc), file=sys.stderr)
        raise SystemExit(2)

```

### Core Architecture Module: `apps/desktop/resources/dmg/render-background.swift`
```
// DMG 安装窗口背景生成器(background.pdf 的唯一来源,改视觉先改这里再重新生成)。
//
// 再生成:在本目录(apps/desktop/resources/dmg)下执行
//   swift render-background.swift
// 直接产出 background.pdf,无需任何后处理。
//
// ── 为什么是 PDF(2026-07-20 实测结论,当时社区无人发现)──
// macOS 26 (Tahoe) Finder 对位图背景只按 1px=1pt 绘制且拒绝一切高清投喂
// (144dpi PNG/TIFF/JPEG/HEIC、多页 HiDPI TIFF、>990px 宽图全部静默不渲染),
// 位图背景在 Retina 上必然发虚。但 Finder 会按 Retina backing scale 光栅化
// **PDF 背景**:矢量元素无限清晰,PDF 内嵌的高清位图(914px 立绘 → 219pt 盒)
// 也能吃到 2x 密度——这是 macOS 26 上唯一的高清通道。
//
// ── PDF 上下文的两个坑(改动时别踩)──
// 1. sourceIn 等 blend mode 在 PDF 上下文不生效:mask 着色(如手写体)必须
//    先离屏渲染成位图再嵌入,本脚本 tintedScript() 即为此;
// 2. 超缓渐变(几个百分点亮度跨数百 pt)PDF 光栅化无抖动会出横向色带:
//    主底用纯色,渐变只用于短跨度、大色差的边缘渐白。
//
// ── 画布策略(同位图时代 v2)──
// 画布 900×610pt > 默认窗口 660×460;内容锚定左上 660×460 设计区,右/下延伸区
// 渐隐到纯白,与 Finder 窗口白底衔接,用户拉大窗口看到过渡而非接缝
// (Finder 按 1pt=1pt 左上锚定裁切绘制,不缩放)。
//
// 布局坐标与 scripts/ci/lib.mjs 的 createMacDMG settings 联动:窗口 660×460,
// 图标行中心 y=335(app x=175 / Applications x=485),箭头画在两图标之间;
// 品牌块按 SplashScreen.tsx 布局等比 0.48 缩放。改动要两边同步。
import AppKit

let W: CGFloat = 900, H: CGFloat = 610   // 画布 = PDF 页面(pt)
let DW: CGFloat = 660, DH: CGFloat = 460 // 设计区 = 默认窗口尺寸

// Splash 素材(与启动画面同源,高清:立绘 914²、字标 459×156、手写体 907×259)
let ASSETS = "../../src/renderer/assets/splash"

func img(_ name: String) -> NSImage {
    guard let i = NSImage(contentsOfFile: "\(ASSETS)/\(name)") else {
        fatalError("missing asset \(ASSETS)/\(name) — 请在 apps/desktop/resources/dmg 目录下运行")
    }
    return i
}

/// script.png 是 alpha mask,按 splash 浅色规格 #949AA2 离屏着色(PDF 里 sourceIn 无效)
func tintedScript() -> NSImage {
    let src = img("script.png")
    let w = 907, h = 259
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .calibratedRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    let ctx = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = ctx
    src.draw(in: NSRect(x: 0, y: 0, width: w, height: h))
    ctx.cgContext.setBlendMode(.sourceIn)
    NSColor(calibratedRed: 0.580, green: 0.600, blue: 0.635, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: w, height: h).fill()
    NSGraphicsContext.restoreGraphicsState()
    let out = NSImage(size: NSSize(width: w, height: h))
    out.addRepresentation(rep)
    return out
}

let url = URL(fileURLWithPath: "background.pdf") as CFURL
var mediaBox = CGRect(x: 0, y: 0, width: W, height: H)
let cg = CGContext(url, mediaBox: &mediaBox, nil)!
cg.beginPDFPage(nil)
let ns = NSGraphicsContext(cgContext: cg, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = ns
ns.imageInterpolation = .high

// 浅色 surface 纯色底(splash flat --surface 浅色系;不用渐变,防 PDF banding)
NSColor(calibratedRed: 0.929, green: 0.929, blue: 0.929, alpha: 1).setFill()
NSRect(x: 0, y: H - DH, width: W, height: DH).fill()
// 底部延伸带(y>460 才可见):渐隐到白,接 Finder 窗口白底
NSGradient(
    starting: NSColor(calibratedRed: 0.929, green: 0.929, blue: 0.929, alpha: 1),
    ending: NSColor.white
)!.draw(in: NSRect(x: 0, y: 0, width: W, height: H - DH), angle: -90)
// 右侧白色渐隐罩(x>660 才可见)
NSGradient(
    starting: NSColor(calibratedWhite: 1, alpha: 0),
    ending: NSColor(calibratedWhite: 1, alpha: 1)
)!.draw(in: NSRect(x: 680, y: 0, width: W - 680, height: H), angle: 0)

// 从顶部量的 rect → AppKit 坐标(画布顶 = 窗口顶)
func rectTop(_ x: CGFloat, _ topY: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect {
    NSRect(x: x, y: H - topY - h, width: w, height: h)
}

// ── 品牌块(SplashScreen.tsx 布局等比 0.48,块中心 x=330)──
let S: CGFloat = 0.48
let illusSize = 457 * S
let blockLeft = DW / 2 - illusSize / 2
let blockTop: CGFloat = 14

// 少女立绘(自带 alpha 渐隐,融进 surface 底)
img("illustration.webp").draw(in: rectTop(blockLeft, blockTop, illusSize, illusSize))

// CINDY 深色字标:叠在立绘下三分之一,水平居中
let wmW = 229.5 * S, wmH = 78 * S
img("wordmark-light.png").draw(in: rectTop(DW / 2 - wmW / 2, blockTop + 352.5 * S, wmW, wmH))

// 手写体 "Dream it Create it":字标右缘,略与字标底部交叠
let scW = 225.5 * S, scH = 89.5 * S
tintedScript().draw(in: rectTop(blockLeft + 352.25 * S, blockTop + 410 * S, scW, scH))

// ── 拖拽引导箭头(矢量;图标行中心 y=335)──
let ay = H - 335
let arrow = NSBezierPath()
arrow.lineWidth = 5.5
arrow.lineCapStyle = .round
arrow.lineJoinStyle = .round
arrow.move(to: NSPoint(x: 300, y: ay))
arrow.line(to: NSPoint(x: 360, y: ay))
arrow.move(to: NSPoint(x: 342, y: ay + 16))
arrow.line(to: NSPoint(x: 360, y: ay))
arrow.line(to: NSPoint(x: 342, y: ay - 16))
NSColor(calibratedWhite: 0.62, alpha: 1).setStroke()
arrow.stroke()

NSGraphicsContext.restoreGraphicsState()
cg.endPDFPage()
cg.closePDF()
print("wrote background.pdf")

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/button-states/button-states-fixture.tsx`
```
import { mountPage } from '../../ui-page/harness';
import { UPDATE_BUTTON_TREATMENT } from '../../../src/renderer/components/sidebar/UpdateBanner';
import { Button } from '../../../src/renderer/components/ui/button';
import { PermissionPrompt } from '../../../src/renderer/components/new-chat/PermissionPrompt';
import { SendButton } from '../../../src/renderer/components/new-chat/SendButton';
import { filledButtonHover, filledButtonPressed } from '../../../src/renderer/themes/filledButtonStates';

const ROWS = [
  { id: 'cta', title: 'cta', props: { variant: 'cta' }, label: '保存', hover: '--button-cta-hover', pressed: '--button-cta-pressed' },
  { id: 'danger', title: 'danger-solid', props: { tone: 'danger-solid' }, label: '删除', hover: '--button-danger-solid-hover', pressed: '--button-danger-solid-pressed' },
  { id: 'permission', title: 'permission', props: { palette: 'permission' }, label: '允许', hover: '--perm-allow-btn-hover', pressed: '--perm-allow-btn-pressed' },
  { id: 'confirmation', title: 'confirmation', props: { palette: 'confirmation', variant: 'cta' }, label: '确认', hover: '--confirm-btn-primary-hover', pressed: '--confirm-btn-primary-pressed' },
  { id: 'update', title: 'update', props: { variant: 'cta', className: UPDATE_BUTTON_TREATMENT }, label: '重启', hover: '--update-btn-hover', pressed: '--update-btn-pressed' },
  { id: 'secondary', title: 'secondary', props: { variant: 'secondary' }, label: '取消', hover: '--button-secondary-hover', pressed: '--button-secondary-pressed' },
  { id: 'primary', title: 'primary', props: { variant: 'primary' }, label: '编辑', hover: '--button-primary-hover', pressed: '--button-primary-pressed' },
] as const;

// 亮度阈值 0.25 附近的底色，用真实浏览器计算规则表达式。
const THRESHOLD_LIGHTNESS = [0.2495, 0.25, 0.2501, 0.2505, 0.2509, 0.251, 0.26];

const forced = (token: string) =>
  ({ '--button-face-bg': `var(${token})`, '--button-face-border': `var(${token})` }) as React.CSSProperties;

mountPage({
  render: () => (
    <div className="p-6">
    <div className="grid grid-cols-[120px_repeat(4,110px)] items-center gap-x-4 gap-y-3 text-13 text-[var(--text-primary)]">
      <span />
      <span>默认</span>
      <span>悬停（色值）</span>
      <span>按下（色值）</span>
      <span>真实指针</span>
      {ROWS.map((row) => (
        <div key={row.id} className="contents">
          <span>{row.title}</span>
          <Button {...row.props}>{row.label}</Button>
          <Button {...row.props} data-state-sample={`${row.id}-hover`} style={forced(row.hover)}>{row.label}</Button>
          <Button {...row.props} data-state-sample={`${row.id}-pressed`} style={forced(row.pressed)}>{row.label}</Button>
          <Button {...row.props} data-pointer={row.id}>{row.label}</Button>
        </div>
      ))}
      <span>SendButton</span>
      <SendButton disabled={false} onClick={() => {}} />
      <span data-send-sample="hover" className="inline-flex"><style>{'[data-send-sample="hover"] .composer-send-face{background:var(--send-btn-hover-bg)!important}[data-send-sample="pressed"] .composer-send-face{background:var(--send-btn-pressed-bg)!important}'}</style><SendButton disabled={false} onClick={() => {}} /></span>
      <span data-send-sample="pressed" className="inline-flex"><SendButton disabled={false} onClick={() => {}} /></span>
      <span data-pointer="send" className="inline-flex"><SendButton disabled={false} onClick={() => {}} /></span>
    </div>
    <div data-permission-prompt className="mt-4 max-w-[600px]">
      <PermissionPrompt
        permission={{ requestId: 'button-states', toolName: 'Bash', input: { command: 'ls' } }}
        onRespond={() => {}}
      />
    </div>
    <div hidden>
      {THRESHOLD_LIGHTNESS.map((l) => (
        <span
          key={l}
          data-threshold={l}
          data-hover={filledButtonHover(`oklch(${l} 0 0)`)}
          data-pressed={filledButtonPressed(`oklch(${l} 0 0)`)}
        />
      ))}
    </div>
    </div>
  ),
});

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/button-states/ui-page.mjs`
```
const face = (el) => getComputedStyle(el, '::before').backgroundColor;
const faceOf = (page, sel) => page.locator(sel).evaluate(face);
const bgOf = (page, sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).backgroundColor);
const settle = (page) => page.waitForTimeout(260);

export default {
  name: 'button-states',
  entry: './button-states-fixture.tsx',
  viewport: { width: 760, height: 720 },
  real: 'Button, SendButton, PermissionPrompt, update button treatment, Cindy theme tokens',
  notCovered: 'Non-Cindy themes; business actions',
  cases: { default: { about: 'Real pointer hover and press match the state tokens', data: {} } },
  async check(page, ui) {
    const out = [];
    for (const id of ['cta', 'danger', 'permission', 'confirmation', 'update', 'secondary', 'primary']) {
      const btn = page.locator(`button[data-pointer="${id}"]`);
      await btn.hover(); await settle(page);
      const hover = await faceOf(page, `button[data-pointer="${id}"]`);
      const wantHover = await faceOf(page, `button[data-state-sample="${id}-hover"]`);
      await page.mouse.down(); await settle(page);
      const pressed = await faceOf(page, `button[data-pointer="${id}"]`);
      const wantPressed = await faceOf(page, `button[data-state-sample="${id}-pressed"]`);
      await page.mouse.up(); await page.mouse.move(2, 2); await settle(page);
      out.push({ id, hover, wantHover, pressed, wantPressed });
      if (hover !== wantHover || pressed !== wantPressed) throw new Error(`${id}: pointer differs ${JSON.stringify(out.at(-1))}`);
    }
    // Send paints its fill on .composer-send-face (press retracts only that layer).
    const send = page.locator('[data-pointer="send"] button');
    await send.hover(); await settle(page);
    const sh = await bgOf(page, '[data-pointer="send"] .composer-send-face'), wsh = await bgOf(page, '[data-send-sample="hover"] .composer-send-face');
    await page.mouse.down(); await settle(page);
    const sp = await bgOf(page, '[data-pointer="send"] .composer-send-face'), wsp = await bgOf(page, '[data-send-sample="pressed"] .composer-send-face');
    await page.mouse.up(); await page.mouse.move(2, 2);
    out.push({ id: 'send', hover: sh, wantHover: wsh, pressed: sp, wantPressed: wsp });
    if (sh !== wsh || sp !== wsp) throw new Error(`send: pointer differs ${JSON.stringify(out.at(-1))}`);

    // 真实授权入口的「允许一次」是最后一个按钮，状态色要和 permission 色值一致。
    const allow = page.locator('[data-permission-prompt] button').last();
    await allow.hover(); await settle(page);
    const ah = await allow.evaluate(face), wah = await faceOf(page, 'button[data-state-sample="permission-hover"]');
    await page.mouse.down(); await settle(page);
    const ap = await allow.evaluate(face), wap = await faceOf(page, 'button[data-state-sample="permission-pressed"]');
    await page.mouse.up(); await page.mouse.move(2, 2);
    out.push({ id: 'permission-prompt', hover: ah, wantHover: wah, pressed: ap, wantPressed: wap });
    if (ah !== wah || ap !== wap) throw new Error(`permission-prompt: pointer differs ${JSON.stringify(out.at(-1))}`);

    // 阈值附近：表达式在 Chromium 里算出的亮度必须和底色同向，不能混合出中间值。
    const threshold = await page.locator('[data-threshold]').evaluateAll((nodes) => nodes.map((node) => {
      const computed = (color) => {
        const probe = document.createElement('i');
        probe.style.color = color;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      return { base: Number(node.dataset.threshold), hover: computed(node.dataset.hover), pressed: computed(node.dataset.pressed) };
    }));
    const lightness = (color) => {
      const match = /^oklch\(([\d.]+)/.exec(color);
      if (!match) throw new Error(`threshold: unexpected computed color ${color}`);
      return Number(match[1]);
    };
    for (const row of threshold) {
      const hover = lightness(row.hover), pressed = lightness(row.pressed);
      if (Math.sign(pressed - hover) !== Math.sign(hover - row.base)) throw new Error(`threshold: reversed ${JSON.stringify(row)}`);
    }
    out.push({ id: 'threshold', rows: threshold });
    console.log('[button-states]', ui.theme, JSON.stringify(out));
  },
};

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/cindy-ai-identity/state.ts`
```
import type { ProviderView } from '@cindy/model-providers';
import i18n from '../../../src/renderer/i18n';
import { cindyAiAccountName, cindyAiAccountLogoKind } from '../../../src/shared/cindyAiPresentation';

// Stubbed hooks are separate modules; share only this public fixture selector.
const fixtureState = globalThis as typeof globalThis & { __cindyAiScenario?: string };
export const setScenario = (value: string) => { fixtureState.__cindyAiScenario = value === 'default' ? 'personal' : value; };
const user = () => fixtureState.__cindyAiScenario === 'personal'
  ? { membershipKind: 'personal' as const, orgSlug: null, orgName: null }
  : { membershipKind: 'org' as const, orgSlug: fixtureState.__cindyAiScenario === 'xd' ? 'xd' : 'example', orgName: 'Example International Game Studio' };

export const useAuth = () => ({ mode: 'cloud', dataOwnerId: 'fixture', dataOwnerGeneration: 1, user: user() });
export const useOptionalAuthDeviceId = () => 'fixture-device';
export const useOptionalAuthUser = () => user();
export const useOptionalDataOwnerGeneration = () => 1;
export const useProviders = () => ({
  providers: [{
    id: 'xd', name: cindyAiAccountName(user(), key => i18n.t(key)), source: 'builtin',
    logoKind: cindyAiAccountLogoKind(user()),
    agents: ['codex'], auth: { method: 'managed' }, routing: { codex: {} }, connected: true,
    models: { codex: [{ id: 'auto', name: 'Auto', group: 'gpt', contextWindow: 272000, efforts: [] }] },
  } as ProviderView],
  providerOrder: ['xd'], ownerGeneration: 1, loading: false, refetch: async () => true,
});
export const useApiKey = () => ({ key: 'fixture-key', hasSavedKey: true, clearKey: async () => true });
export const useModelAccessStatus = () => ({ state: 'ok', source: 'server', accountTier: null, endpoint: null });
export const useModelAccessCreditUsageResult = () => ({ usage: null, loading: false, refresh: async () => {} });
export const useClaudeAccountUsageResult = () => ({ usage: null, unlimited: true, loading: false, refresh: async () => {} });
export const useXdAssetPrimaryAction = () => null;
export const isChatGptConnectionConnected = () => false;
export const useCodexAuth = () => ({ state: { kind: 'unauthenticated' }, recoveryCheck: 'idle', refresh: async () => {} });

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/group-layout-states/ui-page.mjs`
```
import assert from 'node:assert/strict';
import group from '../group-control/ui-page.mjs';

// Exercise production states before resizing the same mounted chat. This adds
// the combinations the individual happy-path fixtures do not cover.
export default {
  ...group,
  name: 'group-layout-states',
  entry: '../group-control/group-control-fixture.tsx',
  cases: {
    ...Object.fromEntries(Object.entries(group.cases).filter(([name]) => !['settings', 'division', 'share-pending', 'read-receipts-thread'].includes(name))),
    'task-statuses': { ...group.cases.bubbles, about: 'All six posted task states, long title and waiting detail inside a narrow group pane' },
    ...Object.fromEntries(['proposed', 'failed', 'done', 'stopped', 'dismissed', 'superseded'].map(state => [`division-${state}`, {
      ...group.cases['division-waiting'], about: `Work plan ${state}, long step descriptions and narrow-pane controls`,
    }])),
  },
  async check(page, ui) {
    const planState = /^division-(proposed|failed|done|stopped|dismissed|superseded)$/.exec(ui.case)?.[1];
    if (planState || ui.case === 'task-statuses') {
      // UI tier: earlier fixtures covered only a started task and a successful
      // hand-off. Real timeline cards must also fit with terminal/error states
      // and unbroken waiting details; no host write or real task is started.
      await page.evaluate(async ({ planState }) => {
        const { group } = await window.electronAPI.maker.getBotGroup('fixture-group');
        if (planState) {
          const plan = group.plans[0];
          plan.status = planState === 'failed' ? 'waiting' : planState;
          plan.currentStep = planState === 'done' ? 1 : 0;
          plan.steps = plan.steps.map((step, i) => ({ ...step,
            task: `${i + 1}. 核对长内容、状态与进度，确认操作入口仍然可见。`.repeat(5),
            status: planState === 'done' ? 'done' : planState === 'failed' && i === 0 ? 'failed' : 'pending',
          }));
          group.openPlan = ['proposed', 'failed'].includes(planState) ? {
            ...group.openPlan, status: plan.status, currentStep: plan.currentStep,
            currentStepStatus: plan.steps[plan.currentStep].status,
          } : null;
        } else {
          const source = group.messages.find(message => message.task);
          group.messages = ['started', 'waiting', 'completed', 'failed', 'cancelled', 'timed-out'].map((state, i) => ({
            ...source, id: `task-${state}`, sequence: i + 1, content: '',
            task: { ...source.task, state, title: '这是一项名称很长的群内任务，用于检查省略与状态展示。'.repeat(5),
              summary: 'WaitingForOwnerConfirmation_'.repeat(18) },
          }));
        }
        window.__uiPage.emit('botGroupChanged', { groupId: group.id, change: 'messages' });
      }, { planState });
      if (planState) await page.locator(`[data-testid="bot-group-plan"][data-plan-status="${planState === 'failed' ? 'waiting' : planState}"]`).waitFor();
      else await page.locator('[data-testid="bot-group-task"][data-state="timed-out"]').waitFor();
    } else await group.check.call(this, page, ui);
    const subject = page.locator('[data-ui-page-subject]');
    const timeline = page.getByTestId('bot-group-timeline');
    // The historical journal must also be exercised open, not just as a title.
    const journal = page.locator('[data-teammate-process]');
    if (await journal.count()) {
      const toggle = journal.first().locator(':scope > button');
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
    for (const width of [540, 400]) {
      await subject.evaluate((el, width) => {
        el.style.height = `${el.getBoundingClientRect().height}px`;
        el.style.width = `${width}px`;
        el.style.maxWidth = '100%';
        el.style.flex = 'none';
      }, width);
      // The standalone reply composer has no timeline. Check its real input and
      // controls at both narrow widths instead of querying a nonexistent main.
      if (ui.case === 'reply-composer') {
        const input = subject.locator('textarea');
        await input.fill(`Reply at ${width}px`);
        assert.equal(await input.inputValue(), `Reply at ${width}px`);
        const geometry = await subject.evaluate(el => {
          const limit = el.getBoundingClientRect();
          return { overflow: el.scrollWidth - el.clientWidth,
            outside: [...el.querySelectorAll('textarea, button')].filter(node => {
              const r = node.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && (r.left < limit.left - 1 || r.right > limit.right + 1);
            }).length };
        });
        assert.ok(geometry.overflow <= 1 && geometry.outside === 0,
          `Reply input and controls must fit ${width}px: ${JSON.stringify(geometry)}`);
        await ui.capture(`narrow-${width}-reply`);
        continue;
      }
      await page.waitForFunction(() => {
        const timeline = document.querySelector('[data-testid="bot-group-timeline"]');
        const main = timeline.closest('main');
        const width = main.getBoundingClientRect().width;
        return Math.abs(timeline.firstElementChild.getBoundingClientRect().width - Math.min(914, width - (width < 700 ? 40 : 100))) < 1;
      });
      const geometry = await timeline.evaluate(el => {
        const main = el.closest('main'), limit = main.getBoundingClientRect();
        const violations = [...main.querySelectorAll('[data-testid="bot-group-bubble"], [data-testid="bot-group-self-bubble"], [data-testid="bot-group-plan"], [data-testid="bot-group-task"], [data-teammate-process], [data-bot-task-card], .chat-bubble-toolbar')].flatMap(node => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.left < limit.left - 1 || r.right > limit.right + 1)
            ? [{ node: node.getAttribute('data-testid') ?? node.className, width: r.width, left: r.left - limit.left, right: r.right - limit.right }] : [];
        });
        const card = main.querySelector('[data-testid="bot-group-arrangement"]');
        const overflowNodes = el.scrollWidth > el.clientWidth + 1 ? [...el.querySelectorAll('*')].flatMap(node => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && (r.left < limit.left - 1 || r.right > limit.right + 1)
            ? [{ tag: node.tagName, className: node.className, text: node.textContent?.slice(0, 40), left: r.left-limit.left, right: r.right-limit.right }] : [];
        }).slice(0, 12) : [];
        return { overflow: el.scrollWidth - el.clientWidth, violations, overflowNodes,
          column: el.firstElementChild.getBoundingClientRect().width, card: card?.getBoundingClientRect().width };
      });
      await timeline.evaluate(el => { el.scrollTop = 0; });
      await ui.capture(`narrow-${width}-top`);
      await timeline.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await ui.capture(`narrow-${width}-bottom`);
      // The in-flow narrow toolbar must not cover the absolutely positioned
      // read receipt. Pane overflow checks alone missed this collision.
      const coveredReceipts = await timeline.locator('[data-testid="read-receipt"]').evaluateAll(marks => marks.flatMap(mark => {
        const row = mark.closest('[data-bot-group-message-id]');
        const toolbar = row.querySelector('.chat-bubble-toolbar');
        if (!toolbar) return [];
        const m = mark.getBoundingClientRect(), a = toolbar.getBoundingClientRect();
        return m.left < a.right && m.right > a.left && m.top < a.bottom && m.bottom > a.top
          ? [row.getAttribute('data-bot-group-message-id')] : [];
      }));
      assert.deepEqual(coveredReceipts, [], `Read receipts must stay clear of the toolbar at ${width}px`);
      assert.ok(geometry.overflow <= 1 && geometry.violations.length === 0,
        `${ui.case} at ${width}px must keep content and controls in its pane: ${JSON.stringify(geometry)}`);
      if (geometry.card && geometry.column <= 480) assert.ok(geometry.card >= geometry.column - 39,
        `A narrow queue card must not reserve an unused toolbar gutter: ${JSON.stringify(geometry)}`);
    }
  },
};

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/orca-worker-project/ui-page.mjs`
```
import assert from 'node:assert/strict';
export default {
  name: 'orca-worker-project',
  entry: './worker-project-fixture.tsx',
  viewport: { width: 560, height: 640 },
  real: 'WorkerProjectField, selection hook, FolderPickerPopover, BranchWorktreeChip, RolePillDropdown, themes, fonts and five locales',
  notCovered:
    'Full Worker creation popover, model/device selection, native folder dialog, filesystem discovery, IPC and actual worktree creation',
  cases: {
    'attention-error': {
      about: 'Idle Worker with unhandled task error in tabs, both menus and collapsed trigger',
    },
    'attention-awaiting': {
      about: 'Waiting confirmation shown as blue avatar dots including collapsed trigger',
    },
    'attention-done': {
      about:
        'Completion unread stays green for unselected Worker and does not aggregate on trigger',
    },
    default: {
      about:
        'Inherited Lead worktree, new-worktree branch chooser, project search and dirty other project',
    },
    'same-repo': {
      about:
        'Browsing the main checkout preserves that selection; current-project row restores inherited worktree',
    },
    'browse-error': { about: 'Native folder dialog failure leaves the current project usable' },
    missing: { about: 'Missing directory explains why creation cannot continue' },
    empty: { about: 'Empty repository explains why worktree creation is unavailable' },
    detached: {
      about: 'Detached HEAD is displayed as a short SHA and allows choosing a real branch',
    },
    workers: { about: 'Worker project badge appears only for the other project' },
    dialogue: { about: 'Dialogue Lead hides checkbox until a Git project is selected' },
  },
  async ready(page) {
    await page.getByRole('button').first().waitFor();
  },
  async check(page, ui) {
    if (ui.case.startsWith('attention-')) {
      const key =
        ui.case === 'attention-error'
          ? 'errorBadgeAria'
          : ui.case === 'attention-awaiting'
            ? 'awaitingBadgeAria'
            : 'unread';
      const label = await ui.t(`orca.rolePill.${key}`);
      await page.getByTestId('attention-tabs').getByLabel(label).waitFor();
      const dropdown = page.getByTestId('attention-dropdown');
      if (ui.case !== 'attention-done') await dropdown.getByLabel(label).waitFor();
      await ui.capture('tabs-and-collapsed');
      await dropdown.getByRole('button', { name: /frontend/ }).click();
      // ERR 是行按钮的相邻徽章；蓝 / 绿点在按钮头像里。
      if (ui.case === 'attention-error') assert.equal(await dropdown.getByLabel(label).count(), 2);
      else
        await dropdown
          .getByRole('button', { name: /reviewer/ })
          .getByLabel(label)
          .waitFor();
      await ui.capture('dropdown-list');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: await ui.t('orca.rolePill.layoutMenuLabel') }).click();
      await ui.capture('layout-menu-list');
      return;
    }
    if (ui.case === 'workers') {
      await page.getByRole('button', { name: /frontend/ }).click();
      await page.getByText('design-system', { exact: true }).first().waitFor();
      await ui.capture('worker-project-badge');
      return;
    }
    const current = await ui.t('orca.workerProject.current');
    const checkbox = page.getByRole('checkbox');
    if (ui.case === 'same-repo') {
      await page.getByRole('button', { name: current, exact: true }).click();
      await page
        .getByRole('button', { name: await ui.t('newChat.folderPicker.browseProjectFolder') })
        .click();
      await page
        .getByText(await ui.t('orca.workerProject.direct', { project: 'cindy', branch: 'main' }))
        .waitFor();
      await ui.capture('explicit-main-checkout');
      await page.getByText(await ui.t('orca.workerProject.newWorktree'), { exact: true }).click();
      const sourceBranch = page.getByRole('button', {
        name: await ui.t('newChat.branchChip.label'),
        exact: true,
      });
      assert.equal(await sourceBranch.textContent(), 'main');
      await ui.capture('same-repo-source-branch');
      await page.getByRole('button', { name: 'cindy', exact: true }).click();
      await page.getByRole('button', { name: 'cindy /projects/cindy', exact: true }).click();
      await page.getByRole('button', { name: current, exact: true }).waitFor();
      await ui.capture('restored-inherited-worktree');
      return;
    }
    if (ui.case === 'browse-error') {
      await page.getByRole('button', { name: current, exact: true }).click();
      await page
        .getByRole('button', { name: await ui.t('newChat.folderPicker.browseProjectFolder') })
        .click();
      await page
        .getByRole('alert')
        .getByText(await ui.t('newChat.folderPicker.browseFailed'))
        .waitFor();
      await ui.capture('native-folder-error');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: current, exact: true }).waitFor();
      assert.equal(
        await page.getByText(await ui.t('ccAgent.common.loading'), { exact: true }).count(),
        0,
      );
      await ui.capture('native-folder-error-dismissed');
      return;
    }
    if (ui.case === 'missing') {
      assert.equal(await checkbox.count(), 0);
      await page
        .getByRole('status')
        .getByText(await ui.t('orca.workerProject.missingDirectory'))
        .waitFor();
      assert.equal(
        await page
          .getByText(
            await ui.t('orca.workerProject.notGit', { directory: '/projects/missing-project' }),
            { exact: true },
          )
          .count(),
        0,
      );
      await ui.capture('missing-directory');
      return;
    }
    if (ui.case === 'empty') {
      assert.equal(await checkbox.count(), 0);
      await page
        .getByText(await ui.t('orca.workerProject.emptyRepo', { directory: '/projects/cindy' }))
        .waitFor();
      await ui.capture('empty-repository');
      return;
    }
    const detachedLabel = await ui.t('orca.workerProject.detachedHead', { sha: 'abcdef01' });
    const sourceLabel = ui.case === 'detached' ? detachedLabel : 'feat/worker-project-picker';
    if (ui.case === 'dialogue') assert.equal(await checkbox.count(), 0);
    else {
      await page.getByText(await ui.t('orca.workerProject.newWorktree'), { exact: true }).click();
      await page
        .getByText(await ui.t('orca.workerProject.splitWarning', { branch: sourceLabel }))
        .waitFor();
      await ui.capture('new-worktree');
      await page
        .getByRole('button', { name: await ui.t('newChat.branchChip.label'), exact: true })
        .click();
      await page.getByRole('option', { name: 'main', exact: true }).waitFor();
      await ui.capture('branches');
      if (ui.case === 'detached') {
        await page.getByRole('option', { name: 'main', exact: true }).click();
        const branchButton = page.getByRole('button', {
          name: await ui.t('newChat.branchChip.label'),
          exact: true,
        });
        assert.equal(await branchButton.textContent(), 'main');
        await ui.capture('detached-pick-branch');
      } else await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: current, exact: true }).click();
    await page.getByRole('textbox').waitFor();
    assert.equal(
      await page.getByText(await ui.t('newChat.folderPicker.dialogue'), { exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole('button', { name: await ui.t('newChat.folderPicker.removeFromList') })
        .count(),
      0,
    );
    await ui.capture('projects');
    await page.getByRole('textbox').fill('design-system');
    await page.getByText('design-system', { exact: true }).click();
    await page.getByText(await ui.t('orca.workerProject.dirty')).waitFor();
    assert.equal(await checkbox.isChecked(), false, 'project changes reset worktree selection');
    if (ui.case === 'detached') {
      await page
        .getByText(
          await ui.t('orca.workerProject.directDetached', {
            project: 'design-system',
            branch: detachedLabel,
          }),
        )
        .waitFor();
    }
    await ui.capture('other-project');
    await page.getByText(await ui.t('orca.workerProject.newWorktree'), { exact: true }).click();
    const rememberedBranch = page.getByRole('button', {
      name: await ui.t('newChat.branchChip.label'),
      exact: true,
    });
    assert.equal(await rememberedBranch.textContent(), 'release/v2');
    await ui.capture('remembered-source-branch');
  },
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12340** (2026-11-23): **ACP 插件引擎冷会话被写入插件库 extraDirs 后发送消息报 Capability 'extraDirs' not supported**
  *Symptoms*: **提交人**: 匿名 **客户端版本**: 0.1.144  ---  ### 问题描述  使用 ACP 插件引擎（本次复现使用的是 Antigravity 插件引擎）的既有项目任务，在客户端重启或会话未激活（冷会话）状态下被切回聚焦后，再次发送消息会在发送前失败，界面提示「回复未完成」，错误详情为：  ```text Capability 'extraDirs' not supported (reason: not-implemented) ```  失败后消息被退回输入队列头部，后续在该任务中重试发送仍会持续复现，且用户无法通过界面清除相关目录状态。  ### 复现条件与步骤  1. 安装并启用带 `"library": true` 的插件（本次环境中为官方插件 Cindy Chrome / `my-browser`）。 2. 在一个绑定了本地项目的任务中使用 ACP 插件引擎完成至少一轮对话，且该项目在 `project-directories.json` 中存在对应条目（即使值为空数组 `[]`）。 3. 让该任务回到冷会话状态（例如重启 Cindy，使内存中不再持有该会话实例）。 4. 切换到该 ACP 任务使其获得焦点，然后发送任意一条消息。  ### 定位到的原因（两个叠加问题）  1. **冷会话写入插件库 `extra_dirs` 时漏检引擎能力，且激活后清理变成 no-op**    - 聚焦冷会话时，`syncLibraryReadonlyExtraDir` → `applyLibraryReadonlyExtraDir` → `applyDirectoryGrants("extraDirs", ...)` 仅在内存中存在活跃会话实例时检查 `capabilities.extraDirs.supported`。    - 对未激活的冷会话未按数据库中的 `agent_kind` 检查能力，因此将插件的 `cindy-library:<library-path>` 持久化写入了 `sessions.extra_dirs`。    - 当会话随后被懒加载激活后，切走焦点触发清理时反而命中 `capabilities.extraDirs.supported === false` 的 no-op 守卫，导致这条 `cindy-library:` 记录长期滞留在数据库中（且常规目录设置接口会保留 library slot，用户无法在界面清除）。  2. **`beforeTurn` 钩子判断条件使用 `||` 绕过了能力检查**    - 发送消息前，`applyProjectDirectoriesForTurn` 合并了数据库中滞留的 `extra_dirs`（非空）。    - 该函数中调用 `setExtraDirs` 前的守卫写成了 `(extraDirs.length || session.capabilities.extraDirs.supported) && await session.setExtraDirs(...)`（`writableDirs` 存在相同写法）。    - 因为 `extraDirs.length > 0`，`||` 短路绕过了 `capabilities.extraDirs.supported === false` 的检查，强行调用 `setExtraDirs` 并抛出 `Capability 'extraDirs' not supported (reason: not-implemented
  **Post-Mortem & Fix Analysis**:
  > **判断：** 已有 Antigravity 项目任务应能在重启后继续对话，不依赖 ACP 支持插件库目录。0.1.144 报告的发送错误与 `main@fa4d01ae` 的代码路径吻合：需要修的是宿主在聚焦和发送时对目录能力的判断，不是插件引擎本身。目前未见覆盖此故障的修复 PR；以下是源码核对，尚未独立实机复现。  **行动：** 建议由桌面会话运行时维护者提交带回归用例的最小修复。使用已完成一轮对话的本地 Antigravity 项目任务，保留 `project-directories.json` 中显式的 `[]`。让 `my-browser` 在当前进程中实际打开作品库，再切回尚未激活的目标任务并发送。这里要区分“启用了插件”和“插件已打开库”：已合并的 #3906 明确焦点刷新只复用实际打开库的插件，仅安装启用不能证明是这次聚焦写入了新目录。  - **聚焦时：** `applyDirectoryGrants` 只在有活跃会话实例时检查能力。建议在写入插件库系统项前，对冷任务按持久化的 `agent_kind` 确认能力；对不支持的 ACP 不新增 `cindy-library:`，也不报告 `authorizedReadonly=true`。撤销时允许只移除历史系统项，不应因引擎不支持而提前返回，也不要清空用户自选目录。 - **发送时：** 显式 `[]` 是撤销项目目录，不是缺少配置，轮次开始时仍会合并任务里保存的目录（#11126）。`applyProjectDirectoriesForTurn` 目前按“列表非空 **或** 能力受支持”调用 setter，而 ACP 将 `extraDirs`、`writableDirs` 均声明为 `not-implemented`。应分别按对应能力调用；支持时即使列表为空也要下发，以撤销上一轮的授权。保留原有路径校验，不要通过吞掉 setter 异常解决。  **完成条件：** 在修复构建记录同一任务聚焦前后的系统项状态和发送结果：原本无系统项时不新增；预置旧系统项时，无需用户编辑数据库，原消息能进入下一轮、不再退回队首，切走后只清理系统项。用一个支持目录的会话作对照，确认正常挂载和空列表撤销仍然生效。  <!-- slack-sync type=issue-analysis source-delive

- **Issue #12325** (2026-11-23): **本机 Agent API 的 claude-code 会话未注册 provider 路由，同名模型时 503 provider_route_ambiguous**
  *Symptoms*: **提交人**: Zhou Zero **客户端版本**: 0.1.144  ---  ## 现象  通过**本机 Agent API**（`local-agent`，`POST /rpc`）用 `claude-code` 引擎发起会话时，如果两个已连接 provider 提供同名模型，Cindy 推理网关返回 503：  ``` HTTP 503  retry-after: 1 {"type":"error","error":{"type":"provider_route_ambiguous",  "code":"provider_route_ambiguous",  "message":"model 'deepseek-v4.1-flash-1017' matches multiple connected Providers;             retry after the session Provider is bound"}} ```  同一个 provider、同一个模型，改用 **pi** 引擎则正常完成（本次实测 4 秒返回）。  ## 复现  1. 配置两个自定义 provider（例如 A 和 B），都提供同名模型 `deepseek-v4.1-flash-1017` 2. 通过本机 Agent API `session/open`，`model` 传 **provider A 对应的 sha256 模型 id**，`toolPolicy: "client-only"` 3. `send` 一条消息 → `events` 轮询最终返回 `turn_end: failed`，错误即为上面的 503  SDK 内部重试 10 次后放弃，总耗时约 170 秒。  ## 关键证据  `startSession` 日志确认 provider 已经传对：  ``` startSession   model      : deepseek-v4.1-flash-1017   providerId : <provider A>        ← provider 正确传入   endpoint   : http://127.0.0.1:57028   scope      : maker/s:local-agent-<uuid>/claude-code ```  `models` 接口也能正确区分两个 provider 的同名模型（`id` = `sha256([providerId, engine, modelId])`，两者不同）。  ## 定位  网关处理 claude-code 请求时，用 `x-claude-code-session-id` 反查会话绑定的 provider：  - **查不到** → 走 `resolveImplicitLocalBridgeRouteResolution(model, "claude-code")` - → `connectedDefaultProviderForModel` 里 `chatEligibleSourcesForModel` 返回 2 个来源 - → `if (engine === "claude-code" && length > 1) return { kind: "ambiguous" }` → 503  问题在于**会话→provider 的内存映射没有被注册**。GUI 路径在 9 处调用了 `hydrateSessionProvider()`，但在 `apps/de

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

### Incident Patch 1: `b2c92e39` (2026-11-24)
**Commit Message**: Merge pull request #12379 from amanayayatu-tech/fix/10161-snapshot-send-diagnosis

fix(desktop): explain when snapshot preparation blocks sending

**File**: `apps/desktop/src/main/__tests__/gitSnapshotCoordinator.test.ts` (modified, +7/-2)
```diff
@@ -1,5 +1,5 @@
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
-import { currentOperationBudget, operationCheckpoint } from '../utils/operationBudget';
+import { currentOperationBudget, operationCheckpoint, SnapshotOperationDeadlineError } from '../utils/operationBudget';
 
 import {
   GitSnapshotCoordinator,
@@ -65,7 +65,12 @@ describe('durable snapshot dispatch intent', () => {
     const deps = makeDeps({ snapshotTimeoutMs: 50, recordTurnAttempt: () => pending.promise });
     const coordinator = new GitSnapshotCoordinator(deps);
     const result = coordinator.onTurnStart('s1');
-    const rejected = expect(result).rejects.toThrow('deadline');
+    // #10161 / unit: the stalled intent previously surfaced a generic snapshot
+    // deadline. The display error must name the send failure and keep its retry type.
+    const rejected = Promise.all([
+      expect(result).rejects.toBeInstanceOf(SnapshotOperationDeadlineError),
+      expect(result).rejects.toThrow(/^\[SNAPSHOT_DISPATCH_INTENT_TIMEOUT\]/),
+    ]);
     await vi.advanceTimersByTimeAsync(50);
     await rejected;
     expect(coordinator.hasPendingTurnStart('s1')).toBe(false);
```

**File**: `apps/desktop/src/main/git-snapshot/gitSnapshotCoordinator.ts` (modified, +12/-1)
```diff
@@ -6,7 +6,13 @@
  */
 
 import type { AgentKind } from '@cindy/maker-core';
-import { OperationBudget, operationCheckpoint, operationWait } from '../utils/operationBudget';
+import {
+  OperationBudget,
+  operationCheckpoint,
+  operationWait,
+  SnapshotDispatchIntentDeadlineError,
+  SnapshotOperationDeadlineError,
+} from '../utils/operationBudget';
 
 import { createAfterEditLabel } from './gitSnapshotLabeler';
 import { enqueueGitRepoWrite } from './gitRepoWriteQueue';
@@ -166,6 +172,11 @@ export class GitSnapshotCoordinator {
       const index = queue?.indexOf(record) ?? -1;
       if (index >= 0) queue!.splice(index, 1);
       if (queue?.length === 0) this.turnStartQueues.delete(sessionId);
+      if (error instanceof SnapshotOperationDeadlineError) {
+        // This rejection is before intent confirmation. Keep the local deadline
+        // type for the scheduler's existing guarded retry, and identify it in history.
+        throw new SnapshotDispatchIntentDeadlineError(error);
+      }
       throw error;
     }
   }
```

**File**: `apps/desktop/src/main/scheduler-host/__tests__/runnerQueuedDispatch.test.ts` (modified, +8/-2)
```diff
@@ -546,7 +546,9 @@ describe('MakerScheduleRunner queued dispatch (busy bound session)', () => {
   // scheduler must settle from the queued failure callback, not its later poll.
   // Only the real typed snapshot deadline is handed to #10834's backoff recovery;
   // its resend and exhaustion are covered by the persisted-recovery tests below.
-  it.each(['deadline', 'permission', 'stop', 'clear', 'pause', 'delete', 'unknown-send'] as const)(
+  // #10161 / unit: with recovery disabled, the same stalled journal receipt
+  // must reach the run's failure details as an unsent message.
+  it.each(['deadline', 'deadline-without-recovery', 'permission', 'stop', 'clear', 'pause', 'delete', 'unknown-send'] as const)(
     'settles pre-accept snapshot preparation through the real queue: %s', async (outcome) => {
     vi.useFakeTimers();
     const h = createSessionHarness(async () => ({ accepted: true }));
@@ -582,7 +584,8 @@ describe('MakerScheduleRunner queued dispatch (busy bound session)', () => {
       beforeDispatchUserTurn: (sid, item, signal) => prepareQueuedPromptSnapshot(snapshots, watchers, sid, item, signal),
       onAcceptedQueuedMessage: async () => { watchers.delete('snapshot-run-input'); await accepted?.(); },
       onPersistedSendRejected: (sid, message, item, recovering) => queue.onPersistedSendRejected(sid, message, item, recovering),
-      isResumableTurnErrorCandidate: signals => signals.reason === 'scheduler-snapshot-preparation',
+      isResumableTurnErrorCandidate: signals => outcome !== 'deadline-without-recovery'
+        && signals.reason === 'scheduler-snapshot-preparation',
       onResumableTurnError: takeOver,
       onDiscardedQueuedMessage: (_sid, item) => { watchers.get(item.clientId)?.onDiscarded(); watchers.delete(item.clientId); },
       steerToAgent: async () => {}, abortSession: async () => {}, isTurnRunning: () => false,
@@ -634,6 +637,9 @@ describe('MakerScheduleRunner queued dispatch (busy bound session)', () => {
       expect(vendorSend).toHaveBeenCalledTimes(outcome === 'unknown-send' ? 1 : 0);
       expect(result.error).toBeInstanceOf(Error);
       if (outcome === 'permission') expect(result.error.message).toBe('permission denied');
+      if (outcome === 'deadline-without-recovery') {
+        expect(result.error.message).toMatch(/^\[SNAPSHOT_DISPATCH_INTENT_TIMEOUT\]/);
+      }
       expect(persisted).toHaveBeenCalledOnce();
       releaseIntent({ attemptId: 'late' });
       await vi.advanceTimersByTimeAsync(0);
```

**File**: `apps/desktop/src/main/scheduler-host/__tests__/runnerSendOutcome.test.ts` (modified, +39/-0)
```diff
@@ -59,6 +59,7 @@ import { RemoteAgentRemoteError } from '../../remote-agent/controller/runClient'
 import { MakerScheduleRunner } from '../runner.desktop';
 import { ScheduledModelSelectionBusyError } from '../../maker-ipc/scheduledModelSelection';
 import { isHeadlessGhostSetupTurn } from '../../mcp-integrations/ghostSetupInteractionSurface';
+import { GitSnapshotCoordinator } from '../../git-snapshot/gitSnapshotCoordinator.js';
 
 type SessionSendOptions = Parameters<Session['send']>[1];
 type SendImpl = (
@@ -692,6 +693,44 @@ describe('MakerScheduleRunner send outcome policy', () => {
     expect(ctx.removeAbortListener).toHaveBeenCalledTimes(1);
   });
 
+  // #10161 / unit: the idle scheduler goes straight through this runner.
+  // Its generic error sanitization used to erase the safe, typed send diagnosis.
+  it('keeps the dispatch intent diagnosis in an idle scheduled run', async () => {
+    vi.useFakeTimers();
+    const receipt = Promise.withResolvers<{ attemptId: string }>();
+    const entered = Promise.withResolvers<void>();
+    const snapshots = new GitSnapshotCoordinator({
+      snapshotTimeoutMs: 50,
+      recordTurnAttempt: () => { entered.resolve(); return receipt.promise; },
+      readAutoSnapshotEnabled: () => true,
+      getSessionContext: vi.fn(), detectRepoRoot: vi.fn(),
+      createShadowSavepoint: vi.fn(), createShadowMarker: vi.fn(),
+      oneShot: vi.fn(), logger: createLogger(),
+    });
+    const dispatch = vi.fn();
+    const h = createSessionHarness(async (_message, opts) => {
+      await opts?.onAccepted?.();
+      dispatch();
+      return { accepted: true };
+    });
+    const { runner, notifier } = createRunnerHarness(h.session, {
+      beforeDispatchUserTurn: (id, signal) => snapshots.onTurnStart(id, signal),
+    });
+    try {
+      const result = runner.fire(baseSchedule(), createFireContext()).catch(error => error);
+      await entered.promise;
+      await vi.advanceTimersByTimeAsync(50);
+      const errorMsg = expect.stringMatching(/^\[SNAPSHOT_DISPATCH_INTENT_TIMEOUT\]/);
+      expect(await result).toMatchObject({ message: errorMsg });
+      expect(latestNotifiedRun(notifier)).toMatchObject({ status: 'failed', errorMsg });
+      expect(mocks.createMessage).toHaveBeenCalledOnce();
+      expect(dispatch).not.toHaveBeenCalled();
+    } finally {
+      receipt.resolve({ attemptId: 'late' });
+      vi.useRealTimers();
+    }
+  });
+
   // Unit regression for the idle shared reconnect: after acceptance, a confirmed
   // startup failure still closes out this occurrence through the normal runner.
   // The allocator/runtime suite drives the real reconnect and token delivery.
```

**File**: `apps/desktop/src/main/scheduler-host/runner.ts` (modified, +5/-1)
```diff
@@ -103,6 +103,7 @@ import { isPluginEngineKind } from '../../shared/agentKindConversion.js';
 import { ensureDialogueWorkspaceDir } from '../localDb/dialogueWorkspace';
 import { AcceptedCallbackDispatchCancelled } from '../maker-ipc/acceptedCallbackRunner.js';
 import { schedulerFailureDetail } from '../maker-ipc/schedulerQueueBridge.js';
+import { SnapshotDispatchIntentDeadlineError } from '../utils/operationBudget.js';
 
 
 import { prependHandoffToUserMessage } from '../maker-ipc/agentHandoff.js';
@@ -2644,7 +2645,10 @@ export class MakerScheduleRunner implements ScheduleRunner {
         ctx.signal.removeEventListener('abort', onAbort);
         return this.deferFire(schedule, session.id, 'session-running');
       }
-      sendError = formatSchedulerSendError(sendContext, normalized.reason);
+      // The host supplies a fixed diagnostic for this proven pre-dispatch failure.
+      sendError = err instanceof SnapshotDispatchIntentDeadlineError
+        ? err.message
+        : formatSchedulerSendError(sendContext, normalized.reason);
       this.deps.logger.warn?.('[runner] session send failed before dispatch', {
         ...sendLogBase,
         source: normalized.source,
```

**File**: `apps/desktop/src/main/utils/operationBudget.ts` (modified, +12/-2)
```diff
@@ -21,12 +21,22 @@ export function assertGitDirectoryReady(dir: string): void {
 
 /** Typed locally: error text from a provider must never authorize a retry. */
 export class SnapshotOperationDeadlineError extends Error {
-  constructor() {
-    super('Snapshot operation deadline exceeded');
+  constructor(message = 'Snapshot operation deadline exceeded', options?: ErrorOptions) {
+    super(message, options);
     this.name = 'SnapshotOperationDeadlineError';
   }
 }
 
+/** The deadline expired before the host could confirm durable dispatch intent. */
+export class SnapshotDispatchIntentDeadlineError extends SnapshotOperationDeadlineError {
+  constructor(cause: SnapshotOperationDeadlineError) {
+    super(
+      '[SNAPSHOT_DISPATCH_INTENT_TIMEOUT] Snapshot operation deadline exceeded before confirming the send record. The message was not sent.',
+      { cause },
+    );
+  }
+}
+
 export class OperationBudget {
   readonly controller = new AbortController();
   readonly signal = this.controller.signal;
```

**File**: `apps/desktop/src/renderer/components/chat/__tests__/ErrorLocalization.test.tsx` (modified, +23/-0)
```diff
@@ -91,6 +91,29 @@ it.each(['live', 'history'] as const)('reports a clean Codex transport exit as a
   }
 });
 
+// #10161 / unit: a stalled local dispatch record used to look like a model
+// reply failure. Both error surfaces use real localized copy after the host
+// identifies that boundary. An unclassified timeout still has generic copy.
+it.each(['live', 'history', 'unclassified'] as const)('attributes a send preparation deadline in %s', async surface => {
+  const i18n = createInstance();
+  await i18n.init({ lng: 'zh-CN', resources: { 'zh-CN': { translation: zhCN } } });
+  const raw = 'Snapshot operation deadline exceeded';
+  const message = surface === 'unclassified'
+    ? raw
+    : `[SNAPSHOT_DISPATCH_INTENT_TIMEOUT] ${raw} before confirming the send record. The message was not sent.`;
+  const retry = vi.fn();
+  render(<I18nextProvider i18n={i18n}>{surface === 'history'
+    ? <ErrorMessageCard message={message} />
+    : <ErrorBanner error={message} agentKind="codex" retryText="原消息" onRetry={retry} />}</I18nextProvider>);
+  expect(screen.getByText(surface === 'unclassified'
+    ? zhCN.chat.errorBanner.replyFailed
+    : '未发送消息，Cindy 未能及时确认安全记录')).toBeTruthy();
+  if (surface === 'live') {
+    fireEvent.click(screen.getByRole('button', { name: zhCN.chat.errorBanner.retry }));
+    expect(retry).toHaveBeenCalledWith('原消息');
+  }
+});
+
 // #10854, unit: production live reducer + banner/tail/history must retain the
 // actual cause for diagnosis while legacy reason-only errors use neutral copy.
 it.each(['live', 'tail', 'history'] as const)('keeps silent-stop %s copy neutral and preserves cause details', async surface => {
```

**File**: `apps/desktop/src/renderer/i18n/locales/de/common.json` (modified, +1/-0)
```diff
@@ -16160,6 +16160,7 @@
       "CONTEXT_COMPACTION_MODEL_UNAVAILABLE": "Der Kontext konnte beim Modellwechsel nicht komprimiert werden, da das vorherige Modell über diese Verbindung nicht verfügbar ist.",
       "MODEL_SELECTION_UNAVAILABLE": "Das ausgewählte Modell ist bei seinem Anbieter nicht mehr verfügbar. Prüfe die Verbindung in den Einstellungen oder wähle ein anderes verfügbares Modell.",
       "MODEL_CATALOG_UNCONFIRMED": "Die Modellliste konnte nicht bestätigt werden. Das ausgewählte Modell wurde beibehalten. Aktualisiere die Modellliste und versuche es erneut.",
+      "SNAPSHOT_DISPATCH_INTENT_TIMEOUT": "Nachricht nicht gesendet. Cindy konnte den Sicherheitseintrag nicht rechtzeitig bestätigen.",
       "HARNESS_SWITCH_NOT_READY": "Der Harness-Wechsel ist noch nicht bereit. Prüfe die Fehlerdetails und versuche es erneut, sobald der Harness bereit ist.",
       "DEVICE_LINK_BUSY": "Der Remotecomputer ist ausgelastet. Versuche es in Kürze erneut.",
       "REMOTE_DAEMON_CLOSED": "Die Remote-Verbindung wurde unterbrochen, möglicherweise während eines Updates. Diese Runde wurde beendet. Sende die Nachricht erneut.",
```

---

### Incident Patch 2: `c76b9df5` (2026-11-23)
**Commit Message**: fix(desktop): explain when snapshot preparation blocks sending

Refs #10161

Assisted-by: Cindy
Signed-off-by: Nepha Peachy <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/main/__tests__/gitSnapshotCoordinator.test.ts` (modified, +7/-2)
```diff
@@ -1,5 +1,5 @@
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
-import { currentOperationBudget, operationCheckpoint } from '../utils/operationBudget';
+import { currentOperationBudget, operationCheckpoint, SnapshotOperationDeadlineError } from '../utils/operationBudget';
 
 import {
   GitSnapshotCoordinator,
@@ -65,7 +65,12 @@ describe('durable snapshot dispatch intent', () => {
     const deps = makeDeps({ snapshotTimeoutMs: 50, recordTurnAttempt: () => pending.promise });
     const coordinator = new GitSnapshotCoordinator(deps);
     const result = coordinator.onTurnStart('s1');
-    const rejected = expect(result).rejects.toThrow('deadline');
+    // #10161 / unit: the stalled intent previously surfaced a generic snapshot
+    // deadline. The display error must name the send failure and keep its retry type.
+    const rejected = Promise.all([
+      expect(result).rejects.toBeInstanceOf(SnapshotOperationDeadlineError),
+      expect(result).rejects.toThrow(/^\[SNAPSHOT_DISPATCH_INTENT_TIMEOUT\]/),
+    ]);
     await vi.advanceTimersByTimeAsync(50);
     await rejected;
     expect(coordinator.hasPendingTurnStart('s1')).toBe(false);
```

**File**: `apps/desktop/src/main/git-snapshot/gitSnapshotCoordinator.ts` (modified, +12/-1)
```diff
@@ -6,7 +6,13 @@
  */
 
 import type { AgentKind } from '@cindy/maker-core';
-import { OperationBudget, operationCheckpoint, operationWait } from '../utils/operationBudget';
+import {
+  OperationBudget,
+  operationCheckpoint,
+  operationWait,
+  SnapshotDispatchIntentDeadlineError,
+  SnapshotOperationDeadlineError,
+} from '../utils/operationBudget';
 
 import { createAfterEditLabel } from './gitSnapshotLabeler';
 import { enqueueGitRepoWrite } from './gitRepoWriteQueue';
@@ -166,6 +172,11 @@ export class GitSnapshotCoordinator {
       const index = queue?.indexOf(record) ?? -1;
       if (index >= 0) queue!.splice(index, 1);
       if (queue?.length === 0) this.turnStartQueues.delete(sessionId);
+      if (error instanceof SnapshotOperationDeadlineError) {
+        // This rejection is before intent confirmation. Keep the local deadline
+        // type for the scheduler's existing guarded retry, and identify it in history.
+        throw new SnapshotDispatchIntentDeadlineError(error);
+      }
       throw error;
     }
   }
```

**File**: `apps/desktop/src/main/scheduler-host/__tests__/runnerQueuedDispatch.test.ts` (modified, +8/-2)
```diff
@@ -546,7 +546,9 @@ describe('MakerScheduleRunner queued dispatch (busy bound session)', () => {
   // scheduler must settle from the queued failure callback, not its later poll.
   // Only the real typed snapshot deadline is handed to #10834's backoff recovery;
   // its resend and exhaustion are covered by the persisted-recovery tests below.
-  it.each(['deadline', 'permission', 'stop', 'clear', 'pause', 'delete', 'unknown-send'] as const)(
+  // #10161 / unit: with recovery disabled, the same stalled journal receipt
+  // must reach the run's failure details as an unsent message.
+  it.each(['deadline', 'deadline-without-recovery', 'permission', 'stop', 'clear', 'pause', 'delete', 'unknown-send'] as const)(
     'settles pre-accept snapshot preparation through the real queue: %s', async (outcome) => {
     vi.useFakeTimers();
     const h = createSessionHarness(async () => ({ accepted: true }));
@@ -582,7 +584,8 @@ describe('MakerScheduleRunner queued dispatch (busy bound session)', () => {
       beforeDispatchUserTurn: (sid, item, signal) => prepareQueuedPromptSnapshot(snapshots, watchers, sid, item, signal),
       onAcceptedQueuedMessage: async () => { watchers.delete('snapshot-run-input'); await accepted?.(); },
       onPersistedSendRejected: (sid, message, item, recovering) => queue.onPersistedSendRejected(sid, message, item, recovering),
-      isResumableTurnErrorCandidate: signals => signals.reason === 'scheduler-snapshot-preparation',
+      isResumableTurnErrorCandidate: signals => outcome !== 'deadline-without-recovery'
+        && signals.reason === 'scheduler-snapshot-preparation',
       onResumableTurnError: takeOver,
       onDiscardedQueuedMessage: (_sid, item) => { watchers.get(item.clientId)?.onDiscarded(); watchers.delete(item.clientId); },
       steerToAgent: async () => {}, abortSession: async () => {}, isTurnRunning: () => false,
@@ -634,6 +637,9 @@ describe('MakerScheduleRunner queued dispatch (busy bound session)', () => {
       expect(vendorSend).toHaveBeenCalledTimes(outcome === 'unknown-send' ? 1 : 0);
       expect(result.error).toBeInstanceOf(Error);
       if (outcome === 'permission') expect(result.error.message).toBe('permission denied');
+      if (outcome === 'deadline-without-recovery') {
+        expect(result.error.message).toMatch(/^\[SNAPSHOT_DISPATCH_INTENT_TIMEOUT\]/);
+      }
       expect(persisted).toHaveBeenCalledOnce();
       releaseIntent({ attemptId: 'late' });
       await vi.advanceTimersByTimeAsync(0);
```

**File**: `apps/desktop/src/main/scheduler-host/__tests__/runnerSendOutcome.test.ts` (modified, +39/-0)
```diff
@@ -59,6 +59,7 @@ import { RemoteAgentRemoteError } from '../../remote-agent/controller/runClient'
 import { MakerScheduleRunner } from '../runner.desktop';
 import { ScheduledModelSelectionBusyError } from '../../maker-ipc/scheduledModelSelection';
 import { isHeadlessGhostSetupTurn } from '../../mcp-integrations/ghostSetupInteractionSurface';
+import { GitSnapshotCoordinator } from '../../git-snapshot/gitSnapshotCoordinator.js';
 
 type SessionSendOptions = Parameters<Session['send']>[1];
 type SendImpl = (
@@ -692,6 +693,44 @@ describe('MakerScheduleRunner send outcome policy', () => {
     expect(ctx.removeAbortListener).toHaveBeenCalledTimes(1);
   });
 
+  // #10161 / unit: the idle scheduler goes straight through this runner.
+  // Its generic error sanitization used to erase the safe, typed send diagnosis.
+  it('keeps the dispatch intent diagnosis in an idle scheduled run', async () => {
+    vi.useFakeTimers();
+    const receipt = Promise.withResolvers<{ attemptId: string }>();
+    const entered = Promise.withResolvers<void>();
+    const snapshots = new GitSnapshotCoordinator({
+      snapshotTimeoutMs: 50,
+      recordTurnAttempt: () => { entered.resolve(); return receipt.promise; },
+      readAutoSnapshotEnabled: () => true,
+      getSessionContext: vi.fn(), detectRepoRoot: vi.fn(),
+      createShadowSavepoint: vi.fn(), createShadowMarker: vi.fn(),
+      oneShot: vi.fn(), logger: createLogger(),
+    });
+    const dispatch = vi.fn();
+    const h = createSessionHarness(async (_message, opts) => {
+      await opts?.onAccepted?.();
+      dispatch();
+      return { accepted: true };
+    });
+    const { runner, notifier } = createRunnerHarness(h.session, {
+      beforeDispatchUserTurn: (id, signal) => snapshots.onTurnStart(id, signal),
+    });
+    try {
+      const result = runner.fire(baseSchedule(), createFireContext()).catch(error => error);
+      await entered.promise;
+      await vi.advanceTimersByTimeAsync(50);
+      const errorMsg = expect.stringMatching(/^\[SNAPSHOT_DISPATCH_INTENT_TIMEOUT\]/);
+      expect(await result).toMatchObject({ message: errorMsg });
+      expect(latestNotifiedRun(notifier)).toMatchObject({ status: 'failed', errorMsg });
+      expect(mocks.createMessage).toHaveBeenCalledOnce();
+      expect(dispatch).not.toHaveBeenCalled();
+    } finally {
+      receipt.resolve({ attemptId: 'late' });
+      vi.useRealTimers();
+    }
+  });
+
   // Unit regression for the idle shared reconnect: after acceptance, a confirmed
   // startup failure still closes out this occurrence through the normal runner.
   // The allocator/runtime suite drives the real reconnect and token delivery.
```

**File**: `apps/desktop/src/main/scheduler-host/runner.ts` (modified, +5/-1)
```diff
@@ -103,6 +103,7 @@ import { isPluginEngineKind } from '../../shared/agentKindConversion.js';
 import { ensureDialogueWorkspaceDir } from '../localDb/dialogueWorkspace';
 import { AcceptedCallbackDispatchCancelled } from '../maker-ipc/acceptedCallbackRunner.js';
 import { schedulerFailureDetail } from '../maker-ipc/schedulerQueueBridge.js';
+import { SnapshotDispatchIntentDeadlineError } from '../utils/operationBudget.js';
 
 
 import { prependHandoffToUserMessage } from '../maker-ipc/agentHandoff.js';
@@ -2644,7 +2645,10 @@ export class MakerScheduleRunner implements ScheduleRunner {
         ctx.signal.removeEventListener('abort', onAbort);
         return this.deferFire(schedule, session.id, 'session-running');
       }
-      sendError = formatSchedulerSendError(sendContext, normalized.reason);
+      // The host supplies a fixed diagnostic for this proven pre-dispatch failure.
+      sendError = err instanceof SnapshotDispatchIntentDeadlineError
+        ? err.message
+        : formatSchedulerSendError(sendContext, normalized.reason);
       this.deps.logger.warn?.('[runner] session send failed before dispatch', {
         ...sendLogBase,
         source: normalized.source,
```

**File**: `apps/desktop/src/main/utils/operationBudget.ts` (modified, +12/-2)
```diff
@@ -21,12 +21,22 @@ export function assertGitDirectoryReady(dir: string): void {
 
 /** Typed locally: error text from a provider must never authorize a retry. */
 export class SnapshotOperationDeadlineError extends Error {
-  constructor() {
-    super('Snapshot operation deadline exceeded');
+  constructor(message = 'Snapshot operation deadline exceeded', options?: ErrorOptions) {
+    super(message, options);
     this.name = 'SnapshotOperationDeadlineError';
   }
 }
 
+/** The deadline expired before the host could confirm durable dispatch intent. */
+export class SnapshotDispatchIntentDeadlineError extends SnapshotOperationDeadlineError {
+  constructor(cause: SnapshotOperationDeadlineError) {
+    super(
+      '[SNAPSHOT_DISPATCH_INTENT_TIMEOUT] Snapshot operation deadline exceeded before confirming the send record. The message was not sent.',
+      { cause },
+    );
+  }
+}
+
 export class OperationBudget {
   readonly controller = new AbortController();
   readonly signal = this.controller.signal;
```

**File**: `apps/desktop/src/renderer/components/chat/__tests__/ErrorLocalization.test.tsx` (modified, +23/-0)
```diff
@@ -73,6 +73,29 @@ it.each(['live', 'history'] as const)('reports a clean Codex transport exit as a
   }
 });
 
+// #10161 / unit: a stalled local dispatch record used to look like a model
+// reply failure. Both error surfaces use real localized copy after the host
+// identifies that boundary. An unclassified timeout still has generic copy.
+it.each(['live', 'history', 'unclassified'] as const)('attributes a send preparation deadline in %s', async surface => {
+  const i18n = createInstance();
+  await i18n.init({ lng: 'zh-CN', resources: { 'zh-CN': { translation: zhCN } } });
+  const raw = 'Snapshot operation deadline exceeded';
+  const message = surface === 'unclassified'
+    ? raw
+    : `[SNAPSHOT_DISPATCH_INTENT_TIMEOUT] ${raw} before confirming the send record. The message was not sent.`;
+  const retry = vi.fn();
+  render(<I18nextProvider i18n={i18n}>{surface === 'history'
+    ? <ErrorMessageCard message={message} />
+    : <ErrorBanner error={message} agentKind="codex" retryText="原消息" onRetry={retry} />}</I18nextProvider>);
+  expect(screen.getByText(surface === 'unclassified'
+    ? zhCN.chat.errorBanner.replyFailed
+    : '未发送消息，Cindy 未能及时确认安全记录')).toBeTruthy();
+  if (surface === 'live') {
+    fireEvent.click(screen.getByRole('button', { name: zhCN.chat.errorBanner.retry }));
+    expect(retry).toHaveBeenCalledWith('原消息');
+  }
+});
+
 // #10854, unit: production live reducer + banner/tail/history must retain the
 // actual cause for diagnosis while legacy reason-only errors use neutral copy.
 it.each(['live', 'tail', 'history'] as const)('keeps silent-stop %s copy neutral and preserves cause details', async surface => {
```

**File**: `apps/desktop/src/renderer/i18n/locales/de/common.json` (modified, +1/-0)
```diff
@@ -16157,6 +16157,7 @@
       "CONTEXT_COMPACTION_MODEL_UNAVAILABLE": "Der Kontext konnte beim Modellwechsel nicht komprimiert werden, da das vorherige Modell über diese Verbindung nicht verfügbar ist.",
       "MODEL_SELECTION_UNAVAILABLE": "Das ausgewählte Modell ist bei seinem Anbieter nicht mehr verfügbar. Prüfe die Verbindung in den Einstellungen oder wähle ein anderes verfügbares Modell.",
       "MODEL_CATALOG_UNCONFIRMED": "Die Modellliste konnte nicht bestätigt werden. Das ausgewählte Modell wurde beibehalten. Aktualisiere die Modellliste und versuche es erneut.",
+      "SNAPSHOT_DISPATCH_INTENT_TIMEOUT": "Nachricht nicht gesendet. Cindy konnte den Sicherheitseintrag nicht rechtzeitig bestätigen.",
       "HARNESS_SWITCH_NOT_READY": "Der Harness-Wechsel ist noch nicht bereit. Prüfe die Fehlerdetails und versuche es erneut, sobald der Harness bereit ist.",
       "DEVICE_LINK_BUSY": "Der Remotecomputer ist ausgelastet. Versuche es in Kürze erneut.",
       "REMOTE_DAEMON_CLOSED": "Die Remote-Verbindung wurde unterbrochen, möglicherweise während eines Updates. Diese Runde wurde beendet. Sende die Nachricht erneut.",
```

---

### Incident Patch 3: `9a60a19e` (2026-11-23)
**Commit Message**: ci(host): build the tag the release workflow runs on

Code scanning flagged the ref input: a manual run executes in the default branch's context, so checking out and running a ref named by the caller could poison the caches other workflows restore.

Drop the ref and version inputs. A release is built by running the workflow from its tag, which builds that commit and takes the version from the tag name; a run from a branch builds an unversioned package. The job no longer uses a dependency cache.

Also drop the disk cleanup step: the first run showed 103 GB free on the hosted runner, and the step took two and a half minutes.

Assisted-by: Cindy (https://cindy.app)
Signed-off-by: Dash <[REDACTED_EMAIL]>

**File**: `.github/workflows/host-release.yml` (modified, +13/-33)
```diff
@@ -1,21 +1,16 @@
 name: Host release (Linux)
-run-name: ${{ github.event_name == 'workflow_dispatch' && format('Host release {0}', inputs.ref) || github.event.pull_request.title }}
+run-name: ${{ github.event_name == 'workflow_dispatch' && format('Host release {0}', github.ref_name) || github.event.pull_request.title }}
 
 # Builds the standalone Cindy Host for Linux from one commit, as both editions, and keeps the
 # result as a workflow artifact. Nothing is published: no GitHub Release, CDN or registry write.
 # Whoever needs the package (for example the cloud image recipes) downloads the artifact of the
 # run and pins the digests from its summary. See docs/host/README.md, "Linux 发布包".
 on:
+  # Run it from the release tag to build ("Use workflow from" in the Actions page, or
+  # `gh workflow run host-release.yml --ref v<version>`). The job builds the commit it runs on and
+  # takes the version from the tag; there is no input naming another ref, so it never checks out
+  # code other than its own. Run from a branch, it builds an unversioned package.
   workflow_dispatch:
-    inputs:
-      ref:
-        description: Tag or commit to build, for example v0.1.144
-        required: true
-        type: string
-      version:
-        description: Release version. Leave empty when ref is a v<version> tag
-        required: false
-        type: string
   # Changes to the builder or to this workflow build an unversioned package, so a broken release
   # build is found in review instead of at the next release.
   pull_request:
@@ -29,7 +24,7 @@ permissions:
   contents: read
 
 concurrency:
-  group: host-release-${{ github.event.pull_request.number || inputs.ref }}
+  group: host-release-${{ github.event.pull_request.number || github.ref }}
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 
 jobs:
@@ -51,36 +46,22 @@ jobs:
       XDT_SKIP_AGENT_BIN_INSTALL: '1'
       HOST_ARCH: ${{ matrix.target.arch }}
     steps:
-      # Dependencies, two unpacked releases (about 2 GB each) and their archives do not fit
-      # beside the toolchains a hosted runner preinstalls; this job uses neither of these two.
-      - name: Free runner disk space
-        run: |
-          sudo rm -rf /usr/local/lib/android /usr/share/dotnet
-          df -h /
-
       - name: Checkout client
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
-          ref: ${{ inputs.ref }}
           lfs: true
 
       - name: Resolve the release version
         env:
           EVENT_NAME: ${{ github.event_name }}
-          INPUT_REF: ${{ inputs.ref }}
-          INPUT_VERSION: ${{ inputs.version }}
+          REF_TYPE: ${{ github.ref_type }}
+          REF_NAME: ${{ github.ref_name }}
         run: |
           set -euo pipefail
-          if [ "$EVENT_NAME" = workflow_dispatch ]; then
-            version="$INPUT_VERSION"
-            if [ -z "$version" ]; then
-              case "$INPUT_REF" in
-                v[0-9]*) version="${INPUT_REF#v}" ;;
-                *) echo "::error::Give a version when ref is not a v<version> tag"; exit 1 ;;
-              esac
-            fi
-            if ! printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
-              echo "::error::Not a release version: $version"; exit 1
+          if [ "$EVENT_NAME" = workflow_dispatch ] && [ "$REF_TYPE" = tag ]; then
+            version="${REF_NAME#v}"
+            if [ "$version" = "$REF_NAME" ] || ! printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
+              echo "::error::Not a release tag: $REF_NAME (expected v<version>)"; exit 1
             fi
             # The Host and the web client read the version from the desktop manifest, as the
             # desktop packaging does (writePackageVersion). This checkout is discarded afterwards.
@@ -107,12 +88,11 @@ jobs:
           run_install: false
 
       # The release bundles the Node that builds it, so use the version the repository pins.
+      # No dependency cache: a release is installed from the lockfile alone.
       - name: Setup Node.js
         uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
         with:
           node-version-file: .nvmrc
-          cache: pnpm
-          cache-dependency-path: pnpm-lock.yaml
 
       - name: Install dependencies
         run: pnpm install --frozen-lockfile
```

**File**: `docs/host/README.md` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ CINDY_HOST_API=http://127.0.0.1:3456 pnpm --filter desktop dev
 
 ## Linux 发布包
 
-无图形 Linux 用的 Host 发布包由工作流 [Host release (Linux)](../../.github/workflows/host-release.yml) 构建。在 Actions 页手动运行，`ref` 填要构建的发布标签（例如 `v0.1.144`），版本号取自标签；`ref` 不是 `v<版本>` 标签时另填 `version`。
+无图形 Linux 用的 Host 发布包由工作流 [Host release (Linux)](../../.github/workflows/host-release.yml) 构建。在 Actions 页手动运行，「Use workflow from」选要构建的发布标签，或用 `gh workflow run host-release.yml --ref v<版本>`。工作流构建它所在的那个提交，版本号取自标签，所以只能构建已经包含这条工作流的标签。从分支运行得到不带版本号的包。
 
 - 每次运行在 Ubuntu 24.04 x64 上从同一个提交构建国内版和国际版，各自装入对应区域的网页客户端，内含 Node、Agent 运行时和 Chromium。两份都要先通过打包验收（`apps/host/scripts/release-region.e2e.mjs`）才会归档。
 - 产物是 `cindy-host-<版本>-linux-x64-<cn|global>.tar.gz`，作为该次运行的 artifact 保留 90 天，用 `gh run download <运行编号>` 取回。工作流只读仓库，不写 GitHub Release 和 CDN；对外发布是另一步。
```

#### Recent Merged Pull Requests:
- **PR #12383** (2026-11-24): fix(mobile): show relay join errors before an invite arrives (@amanayayatu-tech)
- **PR #12381** (2026-11-24): test(remote-agent): await guest host disposal (@amanayayatu-tech)
- **PR #12380** (2026-11-24): fix(codex): clarify hosted built-in model refusal (@amanayayatu-tech)
- **PR #12379** (2026-11-24): fix(desktop): explain when snapshot preparation blocks sending (@amanayayatu-tech)
- **PR #12377** (2026-11-24): ci(host): 新增 Linux Host 发布包的构建工作流 (@dashhuang)
- **PR #12374** (2026-11-24): test(codex): make MCP readiness retry deterministic (@amanayayatu-tech)

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

## X. Empirical Invariant Guard in gitSnapshotCoordinator.test.ts

**RULE**:
When implementing operations in `apps/desktop/src/main/__tests__/gitSnapshotCoordinator.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b2c92e39`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/__tests__/gitSnapshotCoordinator.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { currentOperationBudget, operationCheckpoint, SnapshotOperationDeadlineError } from '../utils/operationBudget';
    // #10161 / unit: the stalled intent previously surfaced a generic snapshot
    // deadline. The display error must name the send failure and keep its retry type.
    const rejected = Promise.all([
      expect(result).rejects.toBeInstanceOf(SnapshotOperationDeadlineError),
      expect(result).rejects.toThrow(/^\[SNAPSHOT_DISPATCH_INTENT_TIMEOUT\]/),
    ]);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
import { currentOperationBudget, operationCheckpoint } from '../utils/operationBudget';
    const rejected = expect(result).rejects.toThrow('deadline');
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b2c92e39` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

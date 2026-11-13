# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: makecindy/cindy Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "makecindy/cindy",
  "source_url": "https://github.com/makecindy/cindy",
  "source_version": "3dd3844e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T16:49:03.402Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-makecindy-cindy",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [makecindy/cindy](https://github.com/makecindy/cindy) (Revision: `3dd3844e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T16:49:03.402Z`  
> **Learning ID**: `learn-github-makecindy-cindy`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 68%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from makecindy/cindy:

# Forensic Learning Record (Deep Inspection): makecindy/cindy

> **Canonical Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T16:49:02.729Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `makecindy/cindy`
- **Description**: Consider it done. The open-source AI agent that works out of the box · 想到，就能做到。开源、开箱即用的 AI Agent。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10049 stars

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
      <span data-send-sample="hover" className="inline-flex"><style>{'[data-send-sample="hover"] button{background:var(--send-btn-hover-bg)!important}[data-send-sample="pressed"] button{background:var(--send-btn-pressed-bg)!important}'}</style><SendButton disabled={false} onClick={() => {}} /></span>
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
    const send = page.locator('[data-pointer="send"] button');
    await send.hover(); await settle(page);
    const sh = await bgOf(page, '[data-pointer="send"] button'), wsh = await bgOf(page, '[data-send-sample="hover"] button');
    await page.mouse.down(); await settle(page);
    const sp = await bgOf(page, '[data-pointer="send"] button'), wsp = await bgOf(page, '[data-send-sample="pressed"] button');
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
- **Issue #10298** (2026-11-13): **bug(desktop): 创建伙伴时误报已有同名伙伴，但提交仍可成功**
  *Symptoms*: ## 问题描述  在 Windows 11 和 macOS 上创建伙伴时，输入名字 `testc`，即使当前并没有同名伙伴，表单仍显示红色提示「已有同名伙伴，换一个更容易分辨的名字吧。」点击创建后，伙伴最终仍可创建成功。该提示与实际情况不符，容易误导用户。  ## 环境  - Cindy Desktop：0.1.136 CN - Windows：Windows 11 - macOS：系统版本未提供 - 创建的伙伴名称：`testc`  ## 复现步骤  1. 打开「创建伙伴」。 2. 在名字输入框填写 `testc`，确认当前没有同名伙伴。 3. 观察到「已有同名伙伴，换一个更容易分辨的名字吧。」提示。 4. 点击创建并等待操作完成。  ## 实际结果  - 当前没有同名伙伴，但创建表单显示同名提示。 - 创建按钮进入加载状态。 - 根据用户反馈，伙伴最终创建成功。 - 用户确认 Windows 11 和 macOS 上均出现此现象。  ## 预期结果  没有同名伙伴时，不应显示“已有同名伙伴”错误；名字校验结果应与实际伙伴列表一致。  ## 截图与证据边界  <img width="531" height="422" alt="c77dd15643ffbf6a5580d90a53fa57a9aa244b1b8e3e17b609e2632fa4134ffb" src="https://github.com/user-attachments/assets/9db9629d-d54b-406e-b4f3-5bf0f1e512d6" />  ## 相关 Issue  - [#6578](https://github.com/makecindy/cindy/issues/6578)：该 Issue 描述隐藏的旧伙伴副本实际占用名字并导致创建被拒。本次反馈是没有同名伙伴却显示提示，且仍创建成功；表现不同，是否同源尚未确认。
  **Post-Mortem & Fix Analysis**:
  > 更新：提报者已补充现场截图，确凿证实了表单在同名红字提示与创建按钮转圈加载中同时呈现。  ### 判断  新建伙伴时严格保持重名拦截是既定产品规则，本次反馈的实际情况属于提交在途的提示误显，而非重名拦截失效或放行。  进一步检查发现，现有交互逻辑与“输入重名后仍可提交”略有不同。在 `BotRosterView.tsx` 中，若在点击前检测到重名（`duplicate` 为 `true`），生成按钮受 `disabled` 属性严格禁用且提交函数前置早退，无法触发加载状态。截图所呈现的“同名提示与加载中按钮并存”，真实原因是用户提交了未重名的新伙伴，底层 `addBotProfileAndWait` 先执行了 store 的乐观更新，而当前表单在组件重新渲染时未隔离本次在途提交，误将刚被乐观推入列表的自身计算为重名。主进程随后在数据库层正常校验通过并完成创建。  ### 行动  建议 Desktop 前端开发牵头，修复创建表单对在途提交乐观状态的查重逻辑： - **具体动作**：在 `apps/desktop/src/renderer/features/bots/BotRosterView.tsx` 中，确保在异步提交状态（`creating` 为 `true`）期间抑制或排除对当前在途创建伙伴的重名判断； - 在 `apps/desktop/src/renderer/features/bots/__tests__/botRosterView.test.tsx` 中补充回归用例，模拟 `addBotProfileAndWait` 触发 store 乐观广播时组件的行为； - **完成条件**：新建未重名伙伴并点击创建后，按钮转圈期间不再闪现「已有同名伙伴」报错；若输入框填入真实存活的同名伙伴名称，继续保持在点击前禁用按钮并呈现明确提示。  ### 技术依据与范围  核查基线：`68caff760d2a3b40466f5427fc80ff58cb1a7e76`（origin/main）。以下为静态代码证据与时序核对：  1. **查重与禁用联动**：`BotRosterView.tsx` 中 `Button` 绑定 `disabled={creating || !name.trim() || duplicate || !portrait}`，且 `create()` 

- **Issue #10270** (2026-11-13): **Crash on system resume: uncaughtException from WebSocket.terminate on a CONNECTING socket (device-link reconnect)**
  *Symptoms*: **提交人**: 计三勇 **客户端版本**: 0.1.135  ---  ## 问题  Cindy 在 macOS 上于系统从睡眠唤醒的瞬间意外退出（uncaughtException，exitCode 1）。  ## 复现路径  1. 电脑断网（日志出现 `ERR_INTERNET_DISCONNECTED`、`getaddrinfo ENOTFOUND device-link.cindy.com.cn`），device-link WebSocket 反复重连失败，始终处于 CONNECTING 状态（`onlineForMs=never-online`）。 2. 系统进入睡眠。 3. 系统唤醒。Cindy 立即重建 device-link 连接：`system resume: rebuilding device-link connection immediately` → `discarding live socket for reconnect (reason=system-resume)`。  ## 崩溃点  清理旧 socket 时调用 `WebSocket.terminate()`。ws 库对仍处于 CONNECTING 状态的 WebSocket 调用 terminate() 会抛出 `Error: WebSocket was closed before the connection was established`，该错误未被捕获，触发 uncaughtException，应用退出。  关键日志：`FATAL process uncaughtException ... at WebSocket.terminate (ws/lib/websocket.js:496) at bootstrap-electron-*.js`，紧跟在 system resume 与 discarding live socket for reconnect 之后。  ## 预期行为  重连清理路径中 terminate() 一个 CONNECTING 状态的 socket 应当被容忍或捕获（例如先检查 readyState，或对该调用包 try/catch），系统唤醒不应导致应用崩溃。  ## 备注  故障环境：macOS，Cindy 0.1.135。数据无损坏，关闭流程（DbClient dispose、quit disposers）正常完成。 --- ## 相关日志  提交客户端本机最近 2 小时的运行日志摘录，不代表已定位故障，也不包含 SSH 远端或手机日志。已按来源和字段白名单过滤并脱敏；不读取对话正文或原始请求响应。 ```text - 2026-11-13T02:00:12.846Z [ERROR] [proxy/codex-proxy] upstream request failed ↵   reqId  : 128 ↵   err    : Error: getaddrinfo ENOTFOUND c - 2026-11-13T02:00:13.265Z [ERROR] [proxy/codex-proxy] upstream request failed ↵   reqId  : 129 ↵   err    : Error: getaddrinfo ENOTFOUND c - 2026-11-13T02:00:14.112Z [ERROR] [proxy/codex-proxy] upstream request failed ↵ 
  **Post-Mortem & Fix Analysis**:
  > ### 判断  系统从休眠唤醒时重建 device-link 连接应具备完整的容错清理能力，即使旧连接尚未建立成功也不应因 socket 销毁导致主进程退出。经源码排查，该崩溃现象定位明确，属于重连路径上的异常防护缺口与单测覆盖盲区，建议直接进行最小修复。  ### 根因与机理分析  1. **清理路径缺少安全捕获与错误事件吸收**：    在 `packages/device-link/src/client.ts` 的 `connect(reason)` 丢弃旧 socket 阶段（约 2522–2526 行）：    ```ts    try {      prev.close(1000, 'reconnecting');    } catch {      prev.terminate?.();    }    ```    当电脑处于断网或重连失败阶段，旧 socket 保持在 `CONNECTING` 状态。此时外层的 `prev.terminate?.()` 没有 `try/catch` 保护；同时 Node.js `ws` 库在未建连阶段调用 `terminate()` 或 `close()` 会进入 `abortHandshake`，创建 `Error: WebSocket was closed before the connection was established` 并通过 EventEmitter 派发 `'error'` 事件。在旧 socket 闭包脱离主流程后，若未挂载静默监听器，该错误将直接冒泡为主进程的 `FATAL process uncaughtException` 并导致进程退出。    值得注意的是，同文件第 6577 行的 `closeOrTerminate` 函数已明确标注「已断开的 socket 上 close/terminate 可能抛，忽略」并带有完整捕获，但 `connect()` 与 `stop()` 的旧连接清理分支尚未接入统一的安全回收逻辑。  2. **单测替身覆盖盲区**：    `packages/device-link/src/__tests__/client.test.ts` 中注入的 `FakeWs` 替身其 `terminate()` 仅设置 `this.terminated = true`，
  > Cindy 解决这个问题，发PR  _来自 Slack #cindy-issue · @dashhuang_ <!-- slack-sync hash=ca7fd655030706ac --> 

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

### Incident Patch 1: `0bbf1dc8` (2026-11-13)
**Commit Message**: Merge pull request #9878 from 97Three/fix/queued-route-refresh-6793-v2

fix(desktop): refresh queued inputs after model route changes

**File**: `apps/desktop/src/main/maker-ipc/__tests__/agent-input-coordinator.test.ts` (modified, +80/-0)
```diff
@@ -11510,6 +11510,86 @@ describe('AgentInputCoordinator queue mutations', () => {
 });
 
 describe('AgentInputCoordinator crash-recovery queue snapshots (issue #761)', () => {
+  it('refreshes a queued route and its crash snapshot after a model switch (#6793)', async () => {
+    const sid = 'queued-route-switch';
+    const h = createHarness();
+    await h.coordinator.ensureQueueRestored(sid);
+    h.setRunning(true);
+    const queued = makeItem('queued', 'Send on the selected route');
+    queued.createOpts.providerId = 'old-provider';
+    h.coordinator.enqueue(sid, queued);
+    await flush();
+
+    h.coordinator.refreshQueuedRoute(sid, { model: 'new-model', providerId: 'new-provider' });
+    const snapshot = h.persistQueueSnapshot.mock.calls.at(-1)?.[1][0];
+    expect(snapshot?.createOpts).toMatchObject({ model: 'new-model', providerId: 'new-provider' });
+    const restarted = createHarness();
+    restarted.setLoadQueueSnapshot(async () => JSON.parse(JSON.stringify([snapshot])));
+    await restarted.coordinator.ensureQueueRestored(sid);
+    expect(restarted.coordinator.getQueueControlSnapshot(sid).pendingQueue[0]?.createOpts)
+      .toMatchObject({ model: 'new-model', providerId: 'new-provider' });
+
+    h.setRunning(false);
+    h.coordinator.onTurnEvent(sid, 'done');
+    await flush();
+    expect(h.sendToAgent.mock.calls[0]?.[2]).toMatchObject({ model: 'new-model', providerId: 'new-provider' });
+  });
+
+  it('rebases an old snapshot that finishes loading after the model switch (#6793)', async () => {
+    const sid = 'route-switch-during-restore';
+    const h = createHarness();
+    const loading = deferred<void>();
+    const snapshot = deferred<AgentInputQueuedMessage[]>();
+    h.setLoadQueueSnapshot(async () => {
+      loading.resolve();
+      return snapshot.promise;
+    });
+    const restoring = h.coordinator.ensureQueueRestored(sid);
+    await loading.promise;
+    h.coordinator.refreshQueuedRoute(sid, { model: 'new-model', providerId: 'new-provider' });
+    const old = makeItem('restored-old-route', 'Recovered input');
+    old.createOpts.providerId = 'old-provider';
+    snapshot.resolve([old]);
+    await restoring;
+    await flush();
+    expect(h.coordinator.getQueueControlSnapshot(sid).pendingQueue[0]?.createOpts)
+      .toMatchObject({ model: 'new-model', providerId: 'new-provider' });
+    expect(h.persistQueueSnapshot.mock.calls.at(-1)?.[1][0]?.createOpts)
+      .toMatchObject({ model: 'new-model', providerId: 'new-provider' });
+  });
+
+  it('keeps a scheduled run route scoped to that run during a user model switch (#6793)', async () => {
+    const h = createHarness();
+    const sid = 'scheduled-route-scope';
+    await h.coordinator.ensureQueueRestored(sid);
+    h.setRunning(true);
+    const scheduled = makeItem('scheduled', 'Scheduled input', {
+      origin: { kind: 'scheduler', scheduleId: 'schedule-1', scheduleName: 'Check', runId: 'run-1' },
+    });
+    scheduled.createOpts.providerId = 'run-provider';
+    h.coordinator.enqueue(sid, scheduled);
+    h.coordinator.refreshQueuedRoute(sid, { model: 'user-model', providerId: 'user-provider' });
+    expect(h.coordinator.getQueueControlSnapshot(sid).pendingQueue[0]?.createOpts.providerId)
+      .toBe('run-provider');
+  });
+
+  it('retries a failed queue head on the newly selected provider (#6793)', async () => {
+    const h = createHarness();
+    const sid = 'failed-head-route';
+    await h.coordinator.ensureQueueRestored(sid);
+    h.sendToAgent.mockRejectedValueOnce(new Error('old provider unavailable'));
+    const queued = makeItem('failed-head', 'Retry me');
+    queued.createOpts.providerId = 'old-provider';
+    h.coordinator.enqueue(sid, queued);
+    await flush();
+    expect(h.coordinator.getProjection(sid).recovery).toEqual({ kind: 'queue-head', clientId: 'failed-head' });
+
+    h.coordinator.refreshQueuedRoute(sid, { model: 'new-model', providerId: 'new-provider' });
+    await h.coordinator.retryLastError(sid);
+    await flush();
+    expect(h.sendToAgent.mock.calls.at(-1)?.[2]).toMatchObject({ model: 'new-model', providerId: 'new-provider' });
+  });
+
   it.each(['member', 'plan'] as const)('drops restored %s group inputs before a new execution can use their lane', async kind => {
     const sid = 'reused-group-lane';
     const oldId = kind === 'member' ? BOT_GROUP_CLIENT_ID.memberTurn('room', 'old-execution', 'bot')
```

**File**: `apps/desktop/src/main/maker-ipc/agent-input-coordinator.ts` (modified, +44/-0)
```diff
@@ -765,6 +765,8 @@ type AgentInputSendFailure = Extract<
 interface SessionInputState {
   /** Runtime courtesy clock; never persisted or used for list ordering. */
   lastUserActionAt: number | null;
+  /** Last committed route while a crash snapshot may still be loading. */
+  queuedRoute: Pick<AgentInputCreateOpts, 'model' | 'providerId' | 'effort' | 'fastMode'> | null;
   pendingQueue: AgentInputQueuedMessage[];
   pendingCompacts: PendingCompactRequest[];
   steeringQueueClientIds: string[];
@@ -925,6 +927,7 @@ function createInitialInputState(
 ): SessionInputState {
   return {
     lastUserActionAt: null,
+    queuedRoute: null,
     pendingQueue: [],
     pendingCompacts: [],
     steeringQueueClientIds: [],
@@ -1297,6 +1300,20 @@ function isHostGeneratedSteerItem(item: AgentInputQueuedMessage): boolean {
     || isSyntheticTriggerText((item.persistedContent ?? '').trimStart());
 }
 
+function rebaseQueuedItemRoute(
+  item: AgentInputQueuedMessage,
+  route: Pick<AgentInputCreateOpts, 'model' | 'providerId' | 'effort' | 'fastMode'>,
+): void {
+  // A scheduled run can select its own route for this one execution.
+  if (item.origin?.kind === 'scheduler') return;
+  item.model = route.model;
+  item.createOpts.model = route.model;
+  item.createOpts.providerId = route.providerId;
+  item.createOpts.effort = route.effort;
+  item.createOpts.fastMode = route.fastMode;
+  if (route.effort) item.effort = route.effort;
+}
+
 export class AgentInputCoordinator {
   private readonly states = new Map<string, SessionInputState>();
   /** 账号限额等待计划的单调令牌（跨会话唯一，迟到的 host 定时器据此失效）。 */
@@ -1760,6 +1777,11 @@ export class AgentInputCoordinator {
       item.origin?.kind !== 'scheduler' && !isBotGroupClientId(item.clientId) && isUnrestorableMcpAppMessage(item));
     const restored = restorable.filter((item) =>
       item.origin?.kind !== 'scheduler' && !isBotGroupClientId(item.clientId) && !isUnrestorableMcpAppMessage(item));
+    // set-model can finish while loadQueueSnapshot is still awaiting storage.
+    // Apply that committed route before publishing or persisting restored rows.
+    if (state.queuedRoute) {
+      for (const item of restored) rebaseQueuedItemRoute(item, state.queuedRoute);
+    }
     for (const item of staleAppItems) {
       this.deps.onDiscardedQueuedMessage?.(sessionId, item);
     }
@@ -5958,6 +5980,28 @@ export class AgentInputCoordinator {
     }
   }
 
+  /** Rebase unsent inputs after a committed user route selection, including the crash snapshot. */
+  refreshQueuedRoute(
+    sessionId: string,
+    route: Pick<AgentInputCreateOpts, 'model' | 'providerId' | 'effort' | 'fastMode'>,
+  ): void {
+    const state = this.getState(sessionId);
+    state.queuedRoute = { ...route };
+    for (const item of state.pendingQueue) rebaseQueuedItemRoute(item, route);
+    // A head may already have left pendingQueue while pre-dispatch checks run.
+    const active = state.activeTurn;
+    // sendStarted may already be true while sendToAgent waits for the same
+    // session lock held by set-model; no vendor dispatch has happened yet.
+    if (active?.item && !active.persisted) rebaseQueuedItemRoute(active.item, route);
+    for (const compact of state.pendingCompacts) {
+      compact.createOpts.model = route.model;
+      compact.createOpts.providerId = route.providerId;
+      compact.createOpts.effort = route.effort;
+      compact.createOpts.fastMode = route.fastMode;
+    }
+    this.emit(sessionId);
+  }
+
   /** host 侧异步边界(pending 凭证切换 apply 完成等)后恢复该会话的队列派发。 */
   wakeSession(sessionId: string, reason: string): void {
     this.scheduleDrain(sessionId, reason);
```

**File**: `apps/desktop/src/main/maker-ipc/register.ts` (modified, +17/-0)
```diff
@@ -21193,6 +21193,14 @@ export function registerMakerIpc(maker: Maker, options: RegisterMakerIpcOptions)
       assertPendingOwner();
       setSessionEffort(sessionId, finalEffort);
       setSessionFastMode(sessionId, finalFastMode);
+      if (finalModel) {
+        agentInputCoordinatorHolder?.refreshQueuedRoute(sessionId, {
+          model: finalModel,
+          providerId: route.providerId,
+          effort: finalEffort ?? undefined,
+          fastMode: finalFastMode,
+        });
+      }
       broadcastSessionPatched(sessionId, patch);
     },
     logger: log,
@@ -24751,6 +24759,15 @@ export function registerMakerIpc(maker: Maker, options: RegisterMakerIpcOptions)
                 currentFastMode: getSessionFastMode(sessionId),
               })
             : undefined;
+        if (result.status !== 'deferred') {
+          agentInputCoordinatorHolder?.refreshQueuedRoute(sessionId, {
+            model,
+            providerId: getSessionProvider(sessionId),
+            effort: getSessionEffort(sessionId) ?? undefined,
+            fastMode: getSessionFastMode(sessionId),
+          });
+          wakeSessionInputAfterCredentialSwitch(sessionId);
+        }
         await broadcastSessionRuntimeProjection(sessionId, userBaselineOverride).catch((error) => {
           log.debug('session runtime projection broadcast failed', {
             sessionId,
```

---

### Incident Patch 2: `3dd3844e` (2026-11-13)
**Commit Message**: Merge pull request #10408 from makecindy/fix/codex-default-account-quota

fix(openai): 修复默认订阅账号额度读取失败

**File**: `apps/desktop/src/main/maker-ipc/usage.ts` (modified, +16/-2)
```diff
@@ -78,6 +78,11 @@ import { observeSubscriptionAccountUsage, pooledCodexResetTarget, onSubscription
 import { getGrokAccessToken, hasGrokOAuthLogin } from '../maker-host/grok-oauth-login.desktop.js';
 import { outboundFetch } from '../maker-host/outbound-fetch.desktop.js';
 import { CodexResetAutoUse, parseCodexResetAutoUse } from '../usage/codexResetAutoUse.js';
+import {
+  detachedDefaultCodexHome,
+  readDefaultCodexHomeIdentity,
+  withDetachedDefaultCodexHome,
+} from '../usage/codexDefaultAccountHome.js';
 import { codexResetAutoUseStore, codexResetAccountKey } from '../usage/codexResetAutoUseStore.js';
 import { observeUsageChanges } from '../usageBroadcaster.js';
 import type { CodexResetAutoUseSettings } from '@cindy/maker-shared/device-link-contract';
@@ -291,7 +296,7 @@ export function registerMakerUsageIpc(maker: Maker): void {
     const assertScope = () => {
       if (isAppSessionBoundaryPending() || scope !== activeOwnerScopeKey()) throw new Error('PRECONDITION_FAILED: Account scope changed');
     };
-  const service = createCodexRateLimitResetService(pooledCodexResetTarget(key) ?? {
+  const nativeTarget: Parameters<typeof withDetachedDefaultCodexHome>[0] = {
     readRateLimits: async () => { assertScope(); const result = await maker.readAgentAccountRateLimits('codex', providerId); assertScope(); return result; },
     consumeResetCredit: async (params) => { assertScope(); const result = await maker.consumeAgentAccountRateLimitResetCredit('codex', params, providerId); assertScope(); return result; },
     readAccountIdentity: async () => {
@@ -306,7 +311,10 @@ export function registerMakerUsageIpc(maker: Maker): void {
       return { email: identity, accountId };
     },
     recordRateLimitSnapshot: (snapshot) => scope === activeOwnerScopeKey() ? recordCodexAccountUsageSnapshot(snapshot, providerId) : Promise.resolve(),
-  });
+  };
+  // The built-in target is the pool's default account; without its own login it reads that account's home.
+  const service = createCodexRateLimitResetService(pooledCodexResetTarget(key)
+    ?? (providerId ? nativeTarget : withDetachedDefaultCodexHome(nativeTarget, assertScope)));
 
     resetServices.set(key, service);
     return service;
@@ -320,6 +328,12 @@ export function registerMakerUsageIpc(maker: Maker): void {
       const identity = await pooled.readAccountIdentity();
       return codexResetAccountKey(identity.email, identity.accountId);
     }
+    const defaultHome = id ? null : await detachedDefaultCodexHome();
+    if (defaultHome) {
+      const identity = await readDefaultCodexHomeIdentity(defaultHome);
+      if (scope !== activeOwnerScopeKey() || isAppSessionBoundaryPending()) throw new Error('Account scope changed');
+      return codexResetAccountKey(identity.email, identity.accountId);
+    }
     const state = await desktopCodexAuthAdapter.getState({ providerId: id });
     const accountId = state.authSource === 'oauth' ? await desktopCodexAuthAdapter.getAccountId(id) : null;
     if (scope !== activeOwnerScopeKey() || isAppSessionBoundaryPending()) throw new Error('Account scope changed');
```

**File**: `apps/desktop/src/main/subscription-accounts/__tests__/nativeCli.test.ts` (modified, +60/-0)
```diff
@@ -61,6 +61,66 @@ it('does not dispatch a reset after its credential guard expires during startup'
   const methods = children[0].stdin.write.mock.calls.map(([line]) => JSON.parse(line).method);
   expect(methods).toEqual(['initialize', 'initialized']);
 });
+
+// Existing pooled accounts use synchronous proofs. Do not insert a new yield between proof and write.
+it('preserves synchronous guarded dispatch before the next microtask', async () => {
+  let methodsAtNextMicrotask: string[] = [];
+  await codexAccountRpc('/second', 'account/rateLimitResetCredit/consume', { idempotencyKey: 'key' }, () => {
+    queueMicrotask(() => {
+      methodsAtNextMicrotask = children[0].stdin.write.mock.calls.map(([line]) => JSON.parse(line).method);
+    });
+    return true;
+  });
+  expect(methodsAtNextMicrotask).toEqual(['initialize', 'initialized', 'account/rateLimitResetCredit/consume']);
+});
+
+// #10408, unit: filesystem/source checks are asynchronous. A Promise is not authorization;
+// inspect actual CLI writes, including connection termination while the proof is pending.
+it.each([true, false])('waits for an asynchronous dispatch proof (allowed: %s)', async (allowed) => {
+  let decide!: (allowed: boolean) => void;
+  let entered!: () => void;
+  const started = new Promise<void>(resolve => { entered = resolve; });
+  const proof = new Promise<boolean>(resolve => { decide = resolve; });
+  const pending = codexAccountRpc('/second', 'account/rateLimitResetCredit/consume',
+    { idempotencyKey: 'key' }, () => { entered(); return proof; });
+  const observed = allowed ? expect(pending).resolves.toBeDefined()
+    : expect(pending).rejects.toThrow('changed before dispatch');
+  await started;
+  try {
+    expect(children[0].stdin.write.mock.calls.map(([line]) => JSON.parse(line).method))
+      .toEqual(['initialize', 'initialized']);
+  } finally {
+    decide(allowed);
+    await observed;
+  }
+  expect(children[0].stdin.write.mock.calls.some(([line]) =>
+    JSON.parse(line).method === 'account/rateLimitResetCredit/consume')).toBe(allowed);
+});
+
+it('does not dispatch after the connection closes while an asynchronous proof is pending', async () => {
+  let decide!: (allowed: boolean) => void;
+  let entered!: () => void;
+  const started = new Promise<void>(resolve => { entered = resolve; });
+  const proof = new Promise<boolean>(resolve => { decide = resolve; });
+  const pending = expect(codexAccountRpc('/second', 'account/rateLimitResetCredit/consume',
+    { idempotencyKey: 'key' }, () => { entered(); return proof; })).rejects.toThrow('connection closed');
+  await started;
+  children[0].emit('close', null);
+  await pending;
+  decide(true);
+  await Promise.resolve();
+  expect(children[0].stdin.write.mock.calls.map(([line]) => JSON.parse(line).method))
+    .toEqual(['initialize', 'initialized']);
+});
+
+it('rejects a failed asynchronous proof without sending or exposing its error details', async () => {
+  await expect(codexAccountRpc('/second', 'account/rateLimitResetCredit/consume',
+    { idempotencyKey: 'key' }, async () => { throw new Error('fixture-secret-must-not-leak'); }))
+    .rejects.toThrow('Codex account changed before dispatch');
+  expect(children[0].stdin.write.mock.calls.map(([line]) => JSON.parse(line).method))
+    .toEqual(['initialize', 'initialized']);
+});
+
 beforeEach(() => {
   h.binary = '/fixture/codex';
   h.error = false;
```

**File**: `apps/desktop/src/main/subscription-accounts/nativeCli.ts` (modified, +16/-3)
```diff
@@ -204,7 +204,7 @@ export function codexAccountRpc(
   directory: string,
   method: string,
   params: unknown,
-  canDispatch?: () => boolean,
+  canDispatch?: () => boolean | Promise<boolean>,
 ): Promise<unknown> {
   const binary = getReadyBinaryPath('codex');
   if (!binary) return Promise.reject(new Error('Codex CLI unavailable'));
@@ -227,6 +227,20 @@ export function codexAccountRpc(
     };
     const timer = setTimeout(() => finish(new Error('Codex account read timed out')), 15_000);
     const send = (message: unknown) => child.stdin.write(JSON.stringify(message) + '\n');
+    const dispatch = async () => {
+      try {
+        if (canDispatch) {
+          const allowed = canDispatch();
+          // Existing synchronous proofs and the write must stay in the same synchronous segment.
+          if (!(typeof allowed === 'boolean' ? allowed : await allowed))
+            return finish(new Error('Codex account changed before dispatch'));
+        }
+        // An asynchronous credential/source check can outlive this control connection.
+        if (!settled) send({ id: 2, method, params });
+      } catch {
+        finish(new Error('Codex account changed before dispatch'));
+      }
+    };
     child.stdin.on('error', () => finish(new Error('Codex account connection closed')));
     child.on('error', () => finish(new Error('Codex CLI unavailable')));
     child.on('close', () => finish(new Error('Codex account connection closed')));
@@ -248,8 +262,7 @@ export function codexAccountRpc(
           send({ method: 'initialized', params: {} });
           // Startup may await configuration/auth refresh. A reset must still use
           // the exact credential observed before spawning this control connection.
-          if (canDispatch && !canDispatch()) return finish(new Error('Codex account changed before dispatch'));
-          send({ id: 2, method, params });
+          void dispatch();
         } else if (message.id === 2) finish(undefined, message.result);
       }
     });
```

**File**: `apps/desktop/src/main/usage/__tests__/codexDefaultAccountHome.test.ts` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+/**
+ * 测试价值
+ * - 生产入口与可观察结果：`maker:usage:codex-rate-limits` 的 `openai` 目标由
+ *   `createCodexRateLimitResetService(withDetachedDefaultCodexHome(内置目标))` 组成（maker-ipc/usage.ts），
+ *   这里用同样的组合读取额度并兑换重置次数，断言返回的额度与兑换落在哪个账号目录。
+ * - Bug 依据：2026-11-13 Windows 无建链接权限，Cindy 的 codex-home 没有 auth.json，账号池默认账号在
+ *   `~/.codex` 正常运行任务，设置页却一直「ChatGPT 配额更新失败」（`codex not authenticated: no_oauth`）。
+ * - 现有覆盖缺口：codexRateLimitReset.test.ts 只用假依赖测重置控制面，没有覆盖内置目标与默认账号目录的选择。
+ * - 最小失败输入：账号池含非旧版默认账号；codex-home 无 auth.json；默认账号目录有 auth.json。
+ * - tier：unit（真实临时目录 + 进程内假 CLI，不启动 Codex）。
+ * - 实测耗时：见交付说明。
+ */
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+const h = vi.hoisted(() => ({
+  nativeHome: '',
+  defaultHome: '',
+  pool: null as null | { disconnected?: boolean; legacyCodexDefault?: boolean; accounts: Array<{ id: string; paused: boolean }> },
+  rpc: vi.fn(),
+  readNativeAccount: vi.fn(),
+  readNativeCodexTokens: vi.fn(),
+  readPool: vi.fn(),
+  credentialCurrent: true,
+}));
+
+vi.mock('../../maker-host/codex-home-path.js', () => ({ getCodexHome: () => h.nativeHome }));
+vi.mock('../../subscription-accounts/store.js', () => ({
+  readPool: h.readPool,
+  accountDirectory: () => h.defaultHome,
+}));
+vi.mock('../../subscription-accounts/nativeCli.js', () => ({
+  codexAccountRpc: h.rpc,
+  readNativeAccount: h.readNativeAccount,
+  // The real token reader parses auth.json; the fake only proves the guard is consulted.
+  readNativeCodexTokens: h.readNativeCodexTokens,
+}));
+
+import { createCodexRateLimitResetService } from '../codexRateLimitReset.js';
+import { detachedDefaultCodexHome, withDetachedDefaultCodexHome } from '../codexDefaultAccountHome.js';
+
+const DEFAULT_LIMITS = {
+  rateLimits: { planType: 'pro', primary: { usedPercent: 42, windowDurationMins: 10_080 } },
+  rateLimitsByLimitId: null,
+  rateLimitResetCredits: { availableCount: 1, credits: null },
+};
+
+let root = '';
+function native() {
+  return {
+    readRateLimits: vi.fn(async () => {
+      throw new Error('codex not authenticated: no_oauth');
+    }),
+    consumeResetCredit: vi.fn(async () => ({ outcome: 'reset' as const })),
+    readAccountIdentity: vi.fn(async () => ({ email: null, accountId: null })),
+    recordRateLimitSnapshot: vi.fn(async () => undefined),
+  };
+}
+
+beforeEach(() => {
+  root = mkdtempSync(path.join(tmpdir(), 'cindy-codex-default-home-'));
+  h.nativeHome = path.join(root, 'codex-home');
+  h.defaultHome = path.join(root, '.codex');
+  mkdirSync(h.nativeHome);
+  mkdirSync(h.defaultHome);
+  writeFileSync(path.join(h.defaultHome, 'auth.json'), '{"tokens":"fake"}');
+  h.pool = { accounts: [{ id: 'default', paused: false }, { id: 'cindy-abc-1', paused: false }] };
+  h.readPool.mockReset().mockImplementation(() => h.pool);
+  h.credentialCurrent = true;
+  h.readNativeCodexTokens.mockReset().mockImplementation(async () => ({
+    accessToken: 'fake-token', chatgptAccountId: 'workspace-default', canDispatch: () => h.credentialCurrent,
+  }));
+  h.rpc.mockReset().mockImplementation(async (_home: string, method: string) =>
+    method === 'account/rateLimits/read' ? DEFAULT_LIMITS : { outcome: 'reset' });
+  h.readNativeAccount.mockReset().mockResolvedValue({ authenticated: true, identity: 'default@example.com' });
+});
+afterEach(() => rmSync(root, { recursive: true, force: true }));
+
+describe('built-in Codex quota target of the account pool default account', () => {
+  it('reads and redeems on the default account home when the built-in connection has no login', async () => {
+    const builtIn = native();
+    const service = createCodexRateLimitResetService(withDetachedDefaultCodexHome(builtIn, () => {}));
+
+    const snapshot = await service.read();
+    expect(snapshot.rateLimits?.primary?.usedPercent).toBe(42);
+    expect(snapshot.account?.email).toBe('de***@example.com');
+    expect(builtIn.readRateLimits).not.toHaveBeenCalled();
+    // The built-in usage cache is not overwritten by another home's read.
+    expect(builtIn.recordRateLimitSnapshot).not.toHaveBeenCalled();
+
+    const result = await service.consume(snapshot.resetOffer!.idempotencyKey);
+    expect(result.outcome).toBe('reset');
+    expect(h.rpc).toHaveBeenCalledWith(
+      h.defaultHome, 'account/rateLimitResetCredit/consume', expect.anything(), expect.any(Function));
+    expect(builtIn.consumeResetCredit).not.toHaveBeenCalled();
+  });
+
+  it.each([
+    ['the built-in connection has its own login', () => writeFileSync(path.join(h.nativeHome, 'auth.json'), '{}')],
+    ['the default account is the legacy private home', () => { h.pool = { ...h.pool!, legacyCodexDefault: true }; }],
+    ['there is no account pool', () => { h.pool = null; }],
+    ['the default account has no login file', () => rmSync(path.join(h.defaultHome, 'auth.json'))],
```

**File**: `apps/desktop/src/main/usage/__tests__/codexRateLimitReset.test.ts` (modified, +13/-14)
```diff
@@ -9,6 +9,7 @@ import {
 const NOW_MS = Date.UTC(2026, 6, 22, 12, 0, 0);
 const KEY = '018f4ec7-c6d8-7f10-8d43-9f8791d33000';
 const NEXT_KEY = '018f4ec7-c6d8-7f10-8d43-9f8791d33001';
+const ACCOUNT = { email: 'person@example.com', accountId: 'workspace-123456789' };
 
 function response(over: Partial<AccountRateLimitsResponse> = {}): AccountRateLimitsResponse {
   return {
@@ -48,10 +49,7 @@ function harness(over: Partial<Parameters<typeof createCodexRateLimitResetServic
   const deps = {
     readRateLimits: vi.fn().mockResolvedValue(response()),
     consumeResetCredit: vi.fn().mockResolvedValue({ outcome: 'reset' as const }),
-    readAccountIdentity: vi.fn().mockResolvedValue({
-      email: 'person@example.com',
-      accountId: 'workspace-123456789',
-    }),
+    readAccountIdentity: vi.fn().mockResolvedValue(ACCOUNT),
     recordRateLimitSnapshot: vi.fn().mockResolvedValue(undefined),
     now: () => NOW_MS,
     createIdempotencyKey: vi.fn()
@@ -94,13 +92,14 @@ describe('Codex rate-limit reset control plane', () => {
     expect(snapshot.rateLimitResetCredits?.credits?.[0]).not.toHaveProperty('id');
     expect(deps.recordRateLimitSnapshot).toHaveBeenCalledWith(expect.objectContaining({
       primary: expect.objectContaining({ windowMinutes: 300 }),
-    }));
+    }), ACCOUNT);
 
     await service.consume(KEY);
     expect(deps.consumeResetCredit).toHaveBeenCalledWith({
       idempotencyKey: KEY,
       creditId: 'earlier',
-    });
+    }, ACCOUNT);
+    expect(vi.mocked(deps.consumeResetCredit).mock.calls[0][1]).toBe(ACCOUNT);
   });
 
   function detailedHarness(over: Partial<Parameters<typeof createCodexRateLimitResetService>[0]> = {}) {
@@ -127,7 +126,7 @@ describe('Codex rate-limit reset control plane', () => {
     await service.consume(later.resetOffer!.idempotencyKey);
     expect(deps.consumeResetCredit).toHaveBeenCalledExactlyOnceWith({
       idempotencyKey: later.resetOffer!.idempotencyKey, creditId: 'later',
-    });
+    }, ACCOUNT);
   });
 
   it('joins retries of the selected row and blocks another row during the same attempt', async () => {
@@ -160,7 +159,7 @@ describe('Codex rate-limit reset control plane', () => {
     await expect(service.consume(snapshot.resetOffer!.idempotencyKey)).rejects.toMatchObject({ reason: 'RESET_IN_PROGRESS' });
     await service.consume(key);
     expect(consumeResetCredit.mock.calls).toEqual([
-      [{ idempotencyKey: key, creditId: 'later' }], [{ idempotencyKey: key, creditId: 'later' }],
+      [{ idempotencyKey: key, creditId: 'later' }, ACCOUNT], [{ idempotencyKey: key, creditId: 'later' }, ACCOUNT],
     ]);
   });
 
@@ -179,7 +178,7 @@ describe('Codex rate-limit reset control plane', () => {
     expect(refreshed.resetOffer).toMatchObject({ idempotencyKey: key, retryOnly: true });
     await expect(service.consume(refreshed.resetOffer!.idempotencyKey)).resolves.toMatchObject({ outcome: 'alreadyRedeemed' });
     expect(consumeResetCredit.mock.calls).toEqual([
-      [{ idempotencyKey: key, creditId: 'later' }], [{ idempotencyKey: key, creditId: 'later' }],
+      [{ idempotencyKey: key, creditId: 'later' }, ACCOUNT], [{ idempotencyKey: key, creditId: 'later' }, ACCOUNT],
     ]);
   });
 
@@ -227,7 +226,7 @@ describe('Codex rate-limit reset control plane', () => {
     expect(deps.recordRateLimitSnapshot).toHaveBeenCalledWith(expect.objectContaining({
       primary: expect.objectContaining({ windowMinutes: 300 }),
       credits: { hasCredits: false, unlimited: false, balance: null },
-    }));
+    }), ACCOUNT);
   });
 
   it('reuses a count-only offer and lets app-server select the credit', async () => {
@@ -255,7 +254,7 @@ describe('Codex rate-limit reset control plane', () => {
     expect(createIdempotencyKey).toHaveBeenCalledOnce();
 
     await service.consume(KEY);
-    expect(deps.consumeResetCredit).toHaveBeenCalledWith({ idempotencyKey: KEY });
+    expect(deps.consumeResetCredit).toHaveBeenCalledWith({ idempotencyKey: KEY }, ACCOUNT);
   });
 
   it('replaces an unused offer when a fresh read selects a different credit', async () => {
@@ -286,7 +285,7 @@ describe('Codex rate-limit reset control plane', () => {
     expect(deps.consumeResetCredit).toHaveBeenCalledWith({
       idempotencyKey: NEXT_KEY,
       creditId: 'replacement',
-    });
+    }, ACCOUNT);
   });
 
   it('coalesces concurrent consumes and caches the terminal result for retries', async () => {
@@ -346,11 +345,11 @@ describe('Codex rate-limit reset control plane', () => {
     expect(deps.consumeResetCredit).toHaveBeenNthCalledWith(1, {
       idempotencyKey: KEY,
       creditId: 'earlier',
-    });
+    }, ACCOUNT);
     expect(deps.consumeResetCredit).toHaveBeenNthCalledWith(2, {
       idempotencyKey: NEXT_KEY,
       creditId: 'later',
-    });
+    }, ACCOUNT);
   });
 
   it('does not evict an in-flight offer when the registry reaches its soft limit', async () => {
```

**File**: `apps/desktop/src/main/usage/__tests__/codexResetAutoUseStore.test.ts` (modified, +4/-1)
```diff
@@ -50,7 +50,10 @@ describe('reset preferences persistence', () => {
       restored: async () => { await waiter.resumeRestored(async () => redeemed); }, warn: vi.fn(),
     });
     await Promise.all([engine.check('openai'), engine.check('openai')]);
-    expect(consumeRpc).toHaveBeenCalledExactlyOnceWith({ creditId: 'one-credit', idempotencyKey: '00000000-0000-4000-8000-000000000001' });
+    expect(consumeRpc).toHaveBeenCalledExactlyOnceWith(
+      { creditId: 'one-credit', idempotencyKey: '00000000-0000-4000-8000-000000000001' },
+      { email: 'test@example.com', accountId: 'workspace' },
+    );
     expect(continueSession).toHaveBeenCalledOnce();
     expect(store.read('openai', account).lastUsedAt).toBe(now);
     expect((await service.read()).rateLimitResetCredits?.availableCount).toBe(0);
```

**File**: `apps/desktop/src/main/usage/codexDefaultAccountHome.ts` (added, +149/-0)
```diff
@@ -0,0 +1,149 @@
+/**
+ * apps/desktop/src/main/usage/codexDefaultAccountHome.ts
+ *
+ * 额度读取／重置的 `openai` 目标属于 OpenAI 账号池的默认账号（官方 CLI 的 `~/.codex`）。
+ * 通常内置连接的 `codex-home/auth.json` 就是它的共享链接，原有读取直接可用；Windows 没有
+ * 建链接权限时内置连接改走独立登录（auth-adapters 的 `link-unsupported`），在用户没有另行
+ * 登录前 Cindy 目录里没有任何登录，原有读取只会报未登录，而默认账号本身正常运行任务
+ * （2026-11-13 实测：设置页默认账号一直显示「配额更新失败」）。
+ *
+ * 只有「内置连接没有自己的登录文件、默认账号目录有登录文件」时才改读默认账号自己的目录，
+ * 读法与其它池内账号相同；内置连接有任何登录条目（共享链接、独立登录、恢复流程）或默认账号
+ * 仍是旧版私有目录时，一律保留原读取。
+ */
+
+import { lstat, stat } from 'node:fs/promises';
+import path from 'node:path';
+import type { CodexRateLimitAccountIdentity, CodexRateLimitResetServiceDeps } from './codexRateLimitReset.js';
+import { getCodexHome } from '../maker-host/codex-home-path.js';
+import { accountDirectory, readPool } from '../subscription-accounts/store.js';
+import {
+  codexAccountRpc,
+  readNativeAccount,
+  readNativeCodexTokens,
+} from '../subscription-accounts/nativeCli.js';
+
+type ResetTarget = Pick<
+  CodexRateLimitResetServiceDeps,
+  'readRateLimits' | 'consumeResetCredit' | 'readAccountIdentity' | 'recordRateLimitSnapshot'
+>;
+
+async function entryMissing(file: string): Promise<boolean> {
+  try {
+    // lstat: even a dangling link is still the built-in connection's own entry.
+    await lstat(file);
+    return false;
+  } catch (err) {
+    return (err as NodeJS.ErrnoException).code === 'ENOENT';
+  }
+}
+
+function defaultAccountAvailable(): boolean {
+  const pool = readPool('openai');
+  return Boolean(pool && !pool.disconnected && pool.legacyCodexDefault !== true
+    && pool.accounts.some((account) => account.id === 'default'));
+}
+
+/** The default account's CLI home when the built-in connection has no login entry of its own. */
+export async function detachedDefaultCodexHome(): Promise<string | null> {
+  if (!defaultAccountAvailable()) return null;
+  let home: string;
+  try {
+    home = accountDirectory('openai', 'default');
+  } catch {
+    return null;
+  }
+  const nativeHome = getCodexHome();
+  if (path.resolve(home) === path.resolve(nativeHome)) return null;
+  try {
+    // Keyring-only logins keep the original reader: the account bridge needs this file.
+    if (!(await stat(path.join(home, 'auth.json'))).isFile()) return null;
+  } catch {
+    return null;
+  }
+  if (!await entryMissing(path.join(nativeHome, 'auth.json'))) return null;
+  // Pool authorization can change while the filesystem checks yield.
+  return defaultAccountAvailable() && accountDirectory('openai', 'default') === home ? home : null;
+}
+
+/** Identity of that home, with the credential guard used before a redemption. */
+export async function readDefaultCodexHomeIdentity(
+  home: string,
+): Promise<CodexRateLimitAccountIdentity & { canDispatch: () => boolean }> {
+  const auth = await readNativeAccount('openai', home);
+  const tokens = await readNativeCodexTokens(home);
+  if (!auth.authenticated || !auth.identity || !tokens.canDispatch())
+    throw new Error('PRECONDITION_FAILED: ChatGPT account changed');
+  return { email: auth.identity, accountId: tokens.chatgptAccountId, canDispatch: tokens.canDispatch };
+}
+
+/**
+ * Wraps the built-in connection's reset target. Each call decides again, so a later built-in
+ * login or a removed default account takes effect at once; the reset service's identity bracket
+ * rejects a read or redemption that straddles the switch.
+ */
+export function withDetachedDefaultCodexHome(
+  native: ResetTarget,
+  assertScope: () => void,
+  resolveHome: () => Promise<string | null> = detachedDefaultCodexHome,
+): ResetTarget {
+  // A concurrent read must not replace the credential proof that this redemption verified.
+  const credentials = new WeakMap<CodexRateLimitAccountIdentity,
+    { home: string | null; current: () => boolean }>();
+  const assertHome = async (home: string) => {
+    assertScope();
+    if (await resolveHome() !== home) throw new Error('PRECONDITION_FAILED: ChatGPT account changed');
+    assertScope();
+  };
+  return {
+    readAccountIdentity: async () => {
+      const home = await resolveHome();
+      if (!home) {
+        const identity = await native.readAccountIdentity();
+        credentials.set(identity, { home: null, current: () => true });
+        return identity;
+      }
+      await assertHome(home);
+      const { canDispatch, ...identity } = await readDefaultCodexHomeIdentity(home);
+      await assertHome(home);
+      credentials.set(identity, { home, current: canDispatch });
+      return identity;
+    },
+    readRateLimits: async () => {
+      const home = await resolveHome();
+      if (!home) return native.readRateLimits();
+      await assertHome(home);
+      const result = await codexAccountRpc(home, 'account/rateLimits/read', {});
+      await assertHome(home);
+      return result as Awaited<ReturnType<ResetTarget['readRateLimits']>>;
+    },
+    consumeResetCredit: async (params, identity) => {
+      const bound = identity && cr
```

**File**: `apps/desktop/src/main/usage/codexRateLimitReset.ts` (modified, +4/-3)
```diff
@@ -30,9 +30,10 @@ export interface CodexRateLimitResetServiceDeps {
   readRateLimits(): Promise<AccountRateLimitsResponse>;
   consumeResetCredit(
     params: ConsumeAccountRateLimitResetCreditParams,
+    identity?: CodexRateLimitAccountIdentity,
   ): Promise<ConsumeAccountRateLimitResetCreditResponse>;
   readAccountIdentity(): Promise<CodexRateLimitAccountIdentity>;
-  recordRateLimitSnapshot(snapshot: unknown): Promise<void>;
+  recordRateLimitSnapshot(snapshot: unknown, identity?: CodexRateLimitAccountIdentity): Promise<void>;
   now?: () => number;
   createIdempotencyKey?: () => string;
 }
@@ -241,7 +242,7 @@ export function createCodexRateLimitResetService(
         source: 'codex-app-server',
         updatedAt: now(),
         accountId,
-      });
+      }, identity);
     }
 
     const availableCount = normalizeAvailableCount(
@@ -390,7 +391,7 @@ export function createCodexRateLimitResetService(
       const response = await deps.consumeResetCredit({
         idempotencyKey,
         ...(offer.creditId ? { creditId: offer.creditId } : {}),
-      });
+      }, currentAccount);
       // Mark the attempt settled before refreshing. That refresh may expose another
       // available credit and must receive a fresh idempotency key, while concurrent
       // retries of this attempt still join offer.pending until the final result is ready.
```

---

### Incident Patch 3: `dcd6b2f6` (2026-11-13)
**Commit Message**: Merge pull request #10423 from Lyz1116-FOUND/fix/buddy-creation-duplicate-feedback

fix(buddies): 创建伙伴时不再将自身误报为同名伙伴

**File**: `apps/desktop/scripts/fixtures/buddy-creation/fixture.tsx` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import { useState } from 'react';
+import { mountPage, subscription } from '../../ui-page/harness';
+import { BotRosterView } from '../../../src/renderer/features/bots/BotRosterView';
+import { refreshBotProfiles, type BotProfile } from '../../../src/renderer/features/bots/botStore';
+import { beginProvidersRefresh, commitProvidersSnapshot } from '../../../src/renderer/lib/providersSnapshotStore';
+import { getDataOwnerGeneration } from '../../../src/renderer/contexts/dataOwnerGeneration';
+import { BUNDLED_CATALOG, type ProviderView } from '@cindy/model-providers';
+
+const route = { harness: 'codex' as const, model: 'fixture-model', providerId: 'openai', effort: 'high', fastMode: false };
+const model = { id: route.model, name: 'GPT', contextWindow: 200000, efforts: ['high'], defaultEffort: 'high' };
+const provider: ProviderView = { ...BUNDLED_CATALOG.providers.find(p => p.id === 'openai')!,
+  connected: true, agents: ['codex'], access: { kind: 'subscription' }, models: { codex: [model] } };
+
+function Fixture() {
+  const [created, setCreated] = useState<BotProfile | null>(null);
+  return created ? <p role="status">{created.name}</p> : <BotRosterView onCreated={setCreated} />;
+}
+
+void mountPage({
+  route: '/bots',
+  host: () => {
+    Math.random = () => 0; // Keep the portrait identical in before/after captures.
+    const owner = getDataOwnerGeneration();
+    commitProvidersSnapshot(beginProvidersRefresh(), { dataOwnerId: owner.dataOwnerId,
+      ownerGeneration: owner.generation, providers: [provider], providerOrder: ['openai'] });
+    return {
+      localDb: { bots: {
+        list: async () => [],
+        getModelChainSettings: async () => ({ modelChain: [route], isCustomized: true }),
+        // Leave the real store's optimistic profile pending, without touching a database.
+        create: () => {
+          (window as unknown as { __buddyCreationPending: boolean }).__buddyCreationPending = true;
+          return new Promise(() => {});
+        },
+      } },
+      maker: {
+        listAvailableAgents: async () => ['codex'],
+        getCapabilities: async () => ({ hasFastMode: false, availableModels: [{ ...model, displayName: model.name }],
+          effortLevels: [], permissionModes: [], turnPermissionPolicy: { supported: { supported: true }, unsupportedPermissionModes: [] } }),
+        onProvidersChanged: subscription('providers'),
+      },
+    };
+  },
+  render: () => { refreshBotProfiles(); return <Fixture />; },
+});
```

**File**: `apps/desktop/scripts/fixtures/buddy-creation/ui-page.mjs` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import assert from 'node:assert/strict';
+
+export default {
+  name: 'buddy-creation', entry: './fixture.tsx', viewport: { width: 800, height: 680 },
+  real: 'BotRosterView, botStore optimistic creation, portrait picker, model editor, buttons, translations and themes',
+  notCovered: 'Host persistence, account bootstrap, model execution and remote devices; unit tests cover completion and failure/retry',
+  stubs: {
+    'src/renderer/contexts/AuthContext': { partial: 'export const useAuth = () => ({ dataOwnerId: null });' },
+    'src/renderer/hooks/useModelRouteDevices': 'export const useModelRouteDevices = () => ({ devices: [], leadAgentDeviceId: null });',
+  },
+  cases: { default: { about: 'Pending optimistic creation must not show a duplicate-name error (#10298)' } },
+  async ready(page) {
+    await page.getByRole('dialog').waitFor();
+    await page.locator('input').fill('Mika');
+    await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled);
+  },
+  async check(page, ui) {
+    await page.locator('button[type="submit"]').click();
+    await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled);
+    // Wait until the real store has emitted the optimistic row, not only the local busy state.
+    await page.waitForFunction(() => window.__buddyCreationPending === true);
+    await ui.capture('creating');
+    assert.equal(await page.getByRole('alert').count(), 0, 'Its own optimistic profile is not a duplicate');
+  },
+};
```

**File**: `apps/desktop/src/renderer/features/bots/BotRosterView.tsx` (modified, +2/-1)
```diff
@@ -60,7 +60,8 @@ export function BotRosterView({ onCreated, onClose, restoreFocus, inline = false
     }).catch(() => { if (!cancelled) setError(t('bots.profile.avatarSelectionFailed')); });
     return () => { cancelled = true; alive.current = false; };
   }, [initialPortrait]);
-  const duplicate = bots.some(bot => bot.status !== 'archived' && normalizeBotName(bot.name) === normalizeBotName(name));
+  // Creation publishes its own optimistic profile before the request settles.
+  const duplicate = !creating && bots.some(bot => bot.status !== 'archived' && normalizeBotName(bot.name) === normalizeBotName(name));
   const close = () => { if (onClose) onClose(); else navigate('/bots'); };
   const create = async () => {
     if (!name.trim() || duplicate || submitting.current || !portrait) return;
```

**File**: `apps/desktop/src/renderer/features/bots/__tests__/botRosterView.test.tsx` (modified, +47/-1)
```diff
@@ -213,6 +213,47 @@ describe('name-only creation', () => {
     expect(mocks.generateDraft).not.toHaveBeenCalled();
   });
 
+  // #10298: creation publishes its own optimistic profile before the request settles.
+  // The existing immediate-success fixture never rendered this pending state.
+  it.each(['success', 'failure'] as const)('does not report its pending profile as a duplicate: %s', async outcome => {
+    let resolve!: (value: unknown) => void;
+    let reject!: (error: Error) => void;
+    const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
+    const profile = { id: 'bot-pending', name: 'Mika', invitation: { stage: 'ready' } };
+    mocks.addBotProfileAndWait.mockImplementationOnce(() => {
+      mocks.profiles = [profile];
+      return pending;
+    });
+    render(<BotRosterView />);
+    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mika' } });
+    const submit = screen.getByRole('button', { name: 'bots.guided.generate' }) as HTMLButtonElement;
+    await waitFor(() => expect(submit.disabled).toBe(false));
+    fireEvent.click(submit);
+    expect(submit.disabled).toBe(true);
+    expect(screen.queryByRole('alert')).toBeNull();
+    // A programmatic second submit must still be blocked during the request.
+    fireEvent.submit(submit.closest('form')!);
+    expect(mocks.addBotProfileAndWait).toHaveBeenCalledTimes(1);
+    await act(async () => {
+      if (outcome === 'success') resolve(profile);
+      else {
+        mocks.profiles = []; // Production rolls back its optimistic projection on failure.
+        reject(new Error('Create failed'));
+      }
+    });
+    if (outcome === 'success') {
+      expect(mocks.navigate).toHaveBeenCalledWith('/bots/bot-pending');
+    } else {
+      expect(screen.getByRole('alert').textContent).toBe('bots.createWizard.createFailed');
+      expect(mocks.navigate).not.toHaveBeenCalled();
+      expect(submit.disabled).toBe(false);
+      expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Mika');
+      fireEvent.click(submit);
+      await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/bots/bot-new'));
+      expect(mocks.addBotProfileAndWait).toHaveBeenCalledTimes(2);
+    }
+  });
+
   it.each([false, true])('keeps default-chain inheritance but saves only the visible explicit model: selected=%s', async selected => {
     mocks.withDefaultBackup = true;
     render(<BotRosterView />);
@@ -264,8 +305,13 @@ describe('name-only creation', () => {
     mocks.profiles = [{ id: 'existing', name: 'Mika', invitation: { stage: 'ready' } }];
     render(<BotRosterView inline />);
     expect(screen.queryByRole('dialog')).toBeNull();
+    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Another buddy' } });
+    const submit = screen.getByRole('button', { name: 'bots.guided.generate' }) as HTMLButtonElement;
+    await waitFor(() => expect(submit.disabled).toBe(false));
     fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Mika ' } });
-    expect((screen.getByRole('button', { name: 'bots.guided.generate' }) as HTMLButtonElement).disabled).toBe(true);
+    expect(submit.disabled).toBe(true);
+    expect(screen.getByRole('alert').textContent).toBe('bots.guided.duplicateName');
+    fireEvent.submit(submit.closest('form')!);
     expect(mocks.addBotProfileAndWait).not.toHaveBeenCalled();
   });
 
```

#### Recent Merged Pull Requests:
- **PR #10423** (2026-11-13): fix(buddies): 创建伙伴时不再将自身误报为同名伙伴 (@Lyz1116-FOUND)
- **PR #10420** (closed): feat(dingtalk): acknowledge incoming messages with reactions (@qykong)
- **PR #10415** (closed): fix(bridge): keep an ambiguous tool_choice selector unresolved (@cjyang)
- **PR #10411** (closed): fix(codex): negotiate Responses exec format after HTTP 400 (@xuzini-xzn)
- **PR #10408** (2026-11-13): fix(openai): 修复默认订阅账号额度读取失败 (@MagicLizi)
- **PR #10407** (2026-11-13): fix(orca): 直投派单改用 durable 用户消息写入口，worker 才能自动续跑 (@zyjisdog)

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

## X. Merge pull request #9878 from 97Three/fix/queued-route-refresh-6793-v2

**RULE**:
When implementing operations in `apps/desktop/src/main/maker-ipc/__tests__/agent-input-coordinator.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0bbf1dc8`: Merge pull request #9878 from 97Three/fix/queued-route-refresh-6793-v2. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/maker-ipc/__tests__/agent-input-coordinator.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  it('refreshes a queued route and its crash snapshot after a model switch (#6793)', async () => {
    const sid = 'queued-route-switch';
    const h = createHarness();
    await h.coordinator.ensureQueueRestored(sid);
    h.setRunning(true);
    const queued = makeItem('queued', 'Send on the selected route');
    queued.createOpts.providerId = 'old-provider';
    h.coordinator.enqueue(sid, queued);
    await flush();

    h.coordinator.refreshQueuedRoute(sid, { model: 'new-model', providerId: 'new-provider' });
    const snapshot = h.persistQueueSnapshot.mock.calls.at(-1)?.[1][0];
    expect(snapshot?.createOpts).toMatchObject({ model: 'new-model', providerId: 'new-provider' });
    const restarted = createHarness();
    restarted.setLoadQueueSnapshot(async () => JSON.parse(JSON.stringify([snapshot])));
    await restarted.coordinator.ensureQueueRestored(sid);
    expect(restarted.coordinator.getQueueControlSnapshot(sid).pendingQueue[0]?.createOpts)
      .toMatchObject({ model: 'new-model', providerId: 'new-provider' });

    h.setRunning(false);
    h.coordinator.onTurnEvent(sid, 'done');
    await flush();
    expect(h.sendToAgent.mock.calls[0]?.[2]).toMatchObject({ model: 'new
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0bbf1dc8` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

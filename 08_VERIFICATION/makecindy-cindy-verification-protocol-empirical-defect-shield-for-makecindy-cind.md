# Verification Protocol: Verification Protocol: Empirical Defect Shield for makecindy/cindy

<!-- PROVENANCE_START
{
  "source_repository": "makecindy/cindy",
  "source_url": "https://github.com/makecindy/cindy",
  "source_version": "559ad18c",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T03:44:39.113Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-makecindy-cindy",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [makecindy/cindy](https://github.com/makecindy/cindy) (Revision: `559ad18c`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T03:44:39.113Z`  
> **Learning ID**: `learn-github-makecindy-cindy`


## 1. Scope & Verification Target
- **Target Repository**: `makecindy/cindy` (Commit: `559ad18c`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): makecindy/cindy

> **Canonical Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T03:44:37.915Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `makecindy/cindy`
- **Description**: Consider it done. The open-source AI agent that works out of the box · 想到，就能做到。开源、开箱即用的 AI Agent。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10335 stars

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
- **Issue #11639** (2026-11-20): **定时任务用拆分出来的 OpenAI 订阅来源跑 Codex 时，每次都报 provider identity mismatch**
  *Symptoms*: **提交人**: Max **客户端版本**: 0.1.141  ---  ## 现象 同一 OpenAI 订阅池里有两个账号：一个留在默认来源 `openai`，另一个用「拿出来作为单独供应商」拆成了独立来源（形如 `openai-sub-xxxx`）。  在定时任务（agent 模式、Codex 引擎）里把模型来源指定为这个拆出来的来源后，每次触发都失败，报错：  `queued heartbeat Codex thread provider identity does not match the current session route`  日志里先出现 `set-model: closed live session for route rebuild`（reason: provider-thread-relink），即使前后来源相同也会重建；随后这一班的消息排在“重建中”的会话后面，被以 `SEND_CANCELLED_BEFORE_DISPATCH (Codex thread provider identity mismatch)` 取消。  ## 复现情况 - 绑定已有会话（heartbeat、persistentSession）：每班失败，换新建定时任务绑同一会话也失败。 - 让定时任务首班自己新建会话：新会话首班也失败。 - 每次新建会话、不持久化的定时任务：同样失败（连续多晚）。 - 同一来源在普通手动任务里可以正常对话。 - 把定时任务来源改回默认 `openai` 后立即恢复正常。 - 会话上的 scheduled model baseline 似乎一直保留建任务时的旧来源，可能与此有关（推测，未证实）。  ## 期望 定时任务可以稳定使用拆分出来的订阅来源，或者在保存时就提示不支持，而不是每班静默失败。  ## 环境 macOS，单台电脑本机运行；Codex 型号 gpt-6.2-sol。 --- ## 提交时的任务环境  仅代表提交时快照,不一定是故障环境。OS 来自提交客户端本机,不含 SSH 远端主机;Harness / 模型来自当前任务。与运行环境无关的反馈可忽略本段。 **版本区域**: CN **OS**: darwin arm64 (25.6.0) **Harness**: Claude Code **Model ID**: ` claude-opus-5-5 ` **界面语言**: zh-CN
  **Post-Mortem & Fix Analysis**:
  > **判断：** 定时任务应能用拆出来的 OpenAI 订阅账号运行 Codex。#10405 已明确自动任务与手动任务遵守同一账号归属，因此应修复派发行为，而不是在保存时禁选。#11313 记录过绑定已有会话的同类报错；这次 0.1.141 的关键增量是：不复用会话也会在首班失败，而同一拆分来源手动可用。旧线程不是解释全部现象的充分条件。  **行动：** 建议桌面调度／Codex 开发与 #11390 作者先在 `runnerQueuedDispatch.test.ts` 补一个不依赖旧会话的回归：用两个测试账号，一个留在 `openai`，另一个通过「拿出来作为单独供应商」生成来源；定时任务显式选后者和 `gpt-6.2-sol`，从 `runner.fire` 走一次新会话首班。用同一 `runId/sessionId` 串起三处证据：订阅启动包装器选中的账号及引擎来源、`thread/start` 回报的 `codexThreadModelProviderId`、`applyQueuedHeartbeatRouting` 拦截时的当前来源与预期线程身份。用 A/B 代指账号即可；缺少的值在测试入口补采，不需要会话正文或凭据。  在 `main@df6a1090` 静态核对到一个可直接验证的差异：拆分来源在目录中带 `subscriptionPool: 'openai'`；启动时保留所选账号，但传给引擎的是内置 `openai`。派发校验则从外层来源推导凭证类型：若目录只有订阅池标记、没有 `auth.native: 'codex'`，它会把这个独立 ID 当作普通供应商，预期 `cindy_gateway`。这能解释为什么即使来源没换，刚启动的 `cindy_openai` 线程也可能被拒；现场尚无这对身份值。报错检查优先读当前会话来源，不能凭 `scheduledModelBaseline` 仍是旧值认定它导致失败。  - 若首班重现上述身份差异，最小修复是让校验复用已有的 OpenAI 订阅识别规则；只统一线程家族，**不改写独立来源 ID 或账号绑定**。若启动时一致、到重建后才分化，再沿 `provider-thread-relink` 检查重建实际返回的来源是否被旧值覆盖。#11390 尚未合并，针对的是空闲旧线程；不要用反复重建代替身份核对，也不

- **Issue #11626** (2026-11-20): **bug(desktop): 收件箱中来自离线电脑的任务隐藏全部操作入口，无法标为已处理**
  *Symptoms*: ### 问题描述 / What happened  实际行为：收件箱模式下，如果一条任务是在另一台电脑上运行的，而那台电脑当前不在线（或刚冷启动、连接状态仍是 `connecting`），这条任务行悬停前后都没有任何操作入口：「稍后处理」和「完成」都不出现，标题右侧只保留一个表示设备离线的图标。任务只能一直留在「待处理」分区，既不能标为已处理，也不能稍后处理，界面上没有任何文字说明原因，也没有重试或「等那台电脑上线后再处理」的提示。  期望行为：明确告知是执行这台任务的那台电脑离线导致无法操作，并在它上线后恢复入口；或允许在控制端先把任务标为已处理（等设备上线后再对账）。若产品上确实不能在离线时写回被控端，也请说明原因，不要让任务无提示地卡在待处理里。  补充：代码定位（0.1.141，仅供参考）  - `apps/desktop/src/renderer/features/cc-agent/lib/remoteSessionWriteGuard.ts`：`isRemoteSessionWriteBlocked()` 在 `deviceLinkConnectionStatus` 为 `disconnected` / `connecting` 时返回 true。 - `apps/desktop/src/renderer/features/cc-agent/sidebar/SessionCard.tsx`：`canQuickArchive = !navigationOnly && !isArchived && !isEmpty && !remoteWritesBlocked`；收件箱的「稍后处理」用 `canSnooze`，调用处传 `canUnarchive = !remoteWritesBlocked`。两个入口共用同一个开关，离线时一起消失。 - 同一分支下，非收件箱模式的「…」菜单也不会渲染，离线行等于整行只读。 - `docs/product-rules/task-inbox.md` 只规定「归档失败留在原分区并显示错误，不伪造已处理成功」，没有覆盖长期离线这种持续不可写的情况。  关联：#11574（同一区域的待处理堆积与远程状态同步）、#10701 / PR #10695（device-link 远程归档能力）、#11529、#9471（设备被误判离线）。  ### 环境 / Environment  - Cindy 版本或 commit / version or commit: 0.1.141 - 平台与版本 / platform & OS version: Windows x64（10.0.26100） - 安装方式 / install method: Windows 安装包 - 补充：收件箱显示范围包含同账号其它电脑；被控机为同账号 device-link 设备，处于离线状态  ### 复现步骤 / Steps to reproduce  1. 两台同账号电脑登录 Cindy，A 为控制端，B 为被控机。 2. 在 B 上启动一个任务，跑完后出现在 A 的收件箱「待处理」。 3. 关闭 B 的 Cindy（或断开 B 的网络），使 A 上该设备显示离线。 4. 在 A 的收件箱悬停这条任务行。 5. 该行没有任何操作按钮：「稍后处理」和「完成」都不出现，只有设备离线图标。任务无法标为已处理，一直留在待处理。B 重新上线后入口才恢复。  ### 日志与截图 / Logs & screenshots  <img width="260"

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

### Incident Patch 1: `9f9c0a86` (2026-11-20)
**Commit Message**: fix(auth): resume Passport recovery after transient failure

Assisted-by: Cindy (https://cindy.app)
Signed-off-by: xuzini-xzn <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/main/__tests__/authColdStartRecovery.test.ts` (modified, +56/-0)
```diff
@@ -98,6 +98,7 @@ let refreshPromise = null, sessionInvalidationPromise = null;
 let authRefreshOverride = null, delegatedAuthState = null;
 const refreshBackoff = new AuthRefreshBackoff();
 const uncertainResourceRefreshTokens = new Map();
+const pendingResourcePassportRecoveries = new Map();
 const passportAccountRefreshFlights = new Map();
 const pendingPassportAccountRotations = new Map();
 let passiveLocalSignOut = false;
@@ -1094,6 +1095,61 @@ describe('active Passport recovery after an uncertain Resource rotation', () =>
     expect(h.saved.session?.refreshToken).toBe('test-refresh');
   });
 
+  it.each(['runtime', 'cold-start'] as const)('resumes pending Passport recovery without replaying a dead Resource (%s)', async phase => {
+    const { h } = recoverySetup();
+    const fresh = phase === 'runtime' ? h : setup();
+    if (phase === 'cold-start') {
+      fresh.vault.resources[ORIGINAL_KEY].metadata = h.vault.resources[ORIGINAL_KEY].metadata;
+      fresh.vault.passports = h.vault.passports;
+    }
+    fresh.deps.refreshPassportSessionSingleFlight.mockRejectedValueOnce(
+      new AuthApiError('AUTH_REQUEST_FAILED', 503, 'busy', Date.now() + 180_000),
+    );
+    if (phase === 'runtime') await rejectAfterLoss(fresh);
+    else {
+      void fresh.start();
+      await vi.advanceTimersByTimeAsync(1);
+      fresh.request.mockResolvedValue({ ok: false, status: 401,
+        data: { error: { code: 'INVALID_REFRESH_TOKEN' } } });
+      await vi.advanceTimersByTimeAsync(61_250);
+    }
+    expect(fresh.deps.refreshPassportSessionSingleFlight).toHaveBeenCalledTimes(1);
+    const resourceRequests = fresh.request.mock.calls.length;
+    // A redundant refresh would now hit a transport outage and postpone Passport.
+    fresh.request.mockResolvedValue({ ok: false, status: 0, data: null });
+    await vi.advanceTimersByTimeAsync(122_500);
+    expect(fresh.deps.refreshPassportSessionSingleFlight).toHaveBeenCalledTimes(2);
+    expect(fresh.request).toHaveBeenCalledTimes(resourceRequests);
+    expect(fresh.state()).toMatchObject({ isAuthenticated: true, user: { id: 'original' } });
+    expect(fresh.saved.session?.refreshToken).toBe('test-rotated');
+  });
+
+  it.each(['newer', 'cleared'] as const)('checks the current Resource before resuming Passport (%s)', async state => {
+    const { h } = recoverySetup();
+    h.deps.refreshPassportSessionSingleFlight.mockRejectedValueOnce(
+      new AuthApiError('AUTH_REQUEST_FAILED', 429, 'busy', Date.now() + 180_000),
+    );
+    await rejectAfterLoss(h);
+    const count = h.request.mock.calls.length;
+    if (state === 'newer') {
+      h.saved.session.refreshToken = 'test-newer-resource';
+      h.request.mockResolvedValue(h.ok);
+    } else {
+      h.clearRuntimeAuth();
+      h.request.mockResolvedValue({ ok: false, status: 0, data: null });
+    }
+    await vi.advanceTimersByTimeAsync(122_500);
+    expect(h.deps.refreshPassportSessionSingleFlight).toHaveBeenCalledTimes(1);
+    if (state === 'newer') {
+      expect(h.request).toHaveBeenCalledTimes(count + 1);
+      expect(h.request).toHaveBeenLastCalledWith('test-newer-resource', 'global');
+      expect(h.state().isAuthenticated).toBe(true);
+    } else {
+      expect(h.request).toHaveBeenCalledTimes(count);
+      expect(h.state().isAuthenticated).toBe(false);
+    }
+  });
+
   it.each([['passport', 503], ['exchange', 429]] as const)(
     'keeps the server cooldown when cancellation supersedes %s with status %s',
     async (stage, status) => {
```

**File**: `apps/desktop/src/main/authManager.ts` (modified, +45/-2)
```diff
@@ -3495,6 +3495,11 @@ function clearReplacementIntegrationReloadTimers(): void {
 // A successful response may also fail to save locally, so retain its consumed generation
 // until a later request advances it. Logout/switch admission is always rechecked in the vault.
 const uncertainResourceRefreshTokens = new Map<AuthRegion, string>();
+const pendingResourcePassportRecoveries = new Map<AuthRegion, {
+  refreshToken: string;
+  accountKey: string;
+  rejectedTokens: readonly string[];
+}>();
 
 /** Recover only the still-active, same-account Resource using its saved Passport. */
 async function recoverActiveResourceSession(
@@ -3586,8 +3591,28 @@ async function runAuthRefreshWithReplacementRetry(
 }> {
   let expectedVaultRefreshToken: string | null | undefined;
   let expectedActiveVaultAccountKey = opts.expectedActiveVaultAccountKey;
+  let pendingRecovery = pendingResourcePassportRecoveries.get(opts.realm);
+  if (pendingRecovery) {
+    const vault = readAuthAccountVault();
+    if (vault.activeAccountKey === pendingRecovery.accountKey &&
+      vault.resources[pendingRecovery.accountKey]?.realm === opts.realm &&
+      vault.resources[pendingRecovery.accountKey]?.refreshToken === pendingRecovery.refreshToken &&
+      typeof vault.signedOutAt !== 'number' && !isLoggedOutVaultAccount(vault, pendingRecovery.accountKey) &&
+      uncertainResourceRefreshTokens.get(opts.realm) === pendingRecovery.refreshToken) {
+      initialRefreshToken = pendingRecovery.refreshToken;
+      if (opts.phase === 'cold-start') expectedActiveVaultAccountKey ??= pendingRecovery.accountKey;
+    } else {
+      pendingResourcePassportRecoveries.delete(opts.realm);
+      pendingRecovery = undefined;
+    }
+  }
   const run = await runRefreshWithReplacementRetry(initialRefreshToken, {
     doRefresh: async (refreshToken) => {
+      // This generation was already rejected. Re-enter replacement discovery
+      // without another network request, then resume Passport if none is newer.
+      if (pendingRecovery?.refreshToken === refreshToken) {
+        return { ok: false, status: 401, data: { error: { code: 'INVALID_REFRESH_TOKEN' } } };
+      }
       const vault = readAuthAccountVault();
       const vaultTokens = new Map(
         Object.entries(vault.resources).map(
@@ -3612,6 +3637,7 @@ async function runAuthRefreshWithReplacementRetry(
         uncertainResourceRefreshTokens.set(opts.realm, refreshToken);
       }
       if (result.ok) {
+        pendingResourcePassportRecoveries.delete(opts.realm);
         const pair = result.data as RefreshResponse;
         expectedVaultRefreshToken =
           vaultTokens.get(accountVaultKey(opts.realm, pair.membership.id)) ?? null;
@@ -3626,7 +3652,8 @@ async function runAuthRefreshWithReplacementRetry(
       // Keep every source: a rollback build may rotate only its compatibility
       // record. Reject known stale generations, not the source that held them.
       return readStoredRefreshTokenCandidates(opts.realm).filter(
-        (token) => !token || !opts.rejectedRefreshTokens?.has(token),
+        (token) => !token || (!opts.rejectedRefreshTokens?.has(token) &&
+          !pendingRecovery?.rejectedTokens.includes(token)),
       );
     },
     transientRetry: opts.withTransientRetry
@@ -3668,6 +3695,7 @@ async function runAuthRefreshWithReplacementRetry(
       const pair = await recoverActiveResourceSession(
         opts.realm, uncertainRefreshToken, expectedActiveVaultAccountKey,
       );
+      pendingResourcePassportRecoveries.delete(opts.realm);
       if (pair)
         return {
           ...run,
@@ -3679,6 +3707,18 @@ async function runAuthRefreshWithReplacementRetry(
         };
     } catch (error) {
       if (!(error instanceof AuthApiError)) throw error;
+      const vault = readAuthAccountVault();
+      const key = vault.activeAccountKey;
+      if (!isDefinitiveRefreshError(error) && key &&
+        vault.resources[key]?.realm === opts.realm && vault.resources[key]?.refreshToken === uncertainRefreshToken &&
+        typeof vault.signedOutAt !== 'number' && !isLoggedOutVaultAccount(vault, key)) {
+        pendingResourcePassportRecoveries.set(opts.realm, {
+          refreshToken: uncertainRefreshToken, accountKey: key,
+          rejectedTokens: [...new Set([...pendingRecovery?.rejectedTokens ?? [], ...run.rejectedTokens])],
+        });
+      } else {
+        pendingResourcePassportRecoveries.delete(opts.realm);
+      }
       return {
         ...run,
         requestedToken: uncertainRefreshToken,
@@ -4007,7 +4047,10 @@ function clearAuth(
     // when no refresh guard ran between that action and a sibling window timeout.
     coldStartTimeoutFallbacks.clear();
     coldStartRetryWait?.(true);
-    if (!opts.preserveResourceRefreshUncertainty) uncertainResourceRefreshTokens.clear();
+    if (!opts.preserveResourceRefreshUncertainty) {
+      uncertainResourceRefreshTokens.clear();
+      pendingResourcePassportRecoveries.clear();
+    }
   }
   
```

---

### Incident Patch 2: `0614396c` (2026-11-21)
**Commit Message**: Merge pull request #11856 from makecindy/fix/agent-net-idle-dead

fix(agent-net-core): 空闲的连接探测不到对端也判死

**File**: `docs/agent-net-session-plan.md` (modified, +1/-0)
```diff
@@ -632,6 +632,7 @@ v2-3 里远程任务上传先做了两步、不改协议（2026-11-19）：上
 | 单台对端连接断开 | 只重建这一台的会话，补发结果、重新订阅主题 | 补发和续订沿用原级别，不挤占 P0、P1；有界 |
 | 中转上行断开 | 只重连中转上行 | 已直连的对端不经过中转 |
 | 单台对端连接断开、目录里它还在线 | 拨号一端（设备号小的）1 秒后重拨，失败加倍到 30 秒 | 只拨这一台；对方离线、被拦、本机关闭时不拨；连接活过 30 秒才重新从 1 秒算 |
+| 对端没了（被强杀、休眠、断网），连接正空闲 | 核心探测满 30 秒没有回音就判这条连接断了，之后照「单台对端连接断开」处理 | 只断这一条；对端只是没东西要发时每 15 秒有一来一回，不会被判；本机自己停了很久刚醒来时先探测 3 次 |
 | 该对方拨、对方的拨号不来（它还抱着本机已经没有的旧连接） | 不拨号的一方（设备号大的）1 秒后自己拨，失败加倍到 30 秒 | 只拨这一台，条件同上；对方按时拨来时一次也不拨；对方的旧连接不足 10 秒时这次拨号被它丢掉，只触发下一次退避 |
 | 这台电脑换了网络 | 中转连接各 ping 一次，15 秒没回才换；对端连接从新地址发包 | 一次换网每条中转连接只探一次；探测期间照常收发，不先断开 |
 | 会话断开时有写请求在途 | 会话回来时走原有重开循环重开链路，在途的写用原请求号再发一次 | 只在请求自己的时限内等；对方去重记忆变了（重启、清空）就不再发；只续本机还在控制的对端，重开循环每次尝试前复查授权 |
```

**File**: `docs/dev-rules/remote-and-mobile-adaptation.md` (modified, +5/-3)
```diff
@@ -537,9 +537,11 @@ Device Link 上有活着的链路时照旧走 Device Link，那上面已确认
   - 唤醒、换网后取不到中转信息时沿用这个服务上次的 UDP 地址；服务明确回答没有 UDP 时清掉。
   - 连接断了、目录里对方还在线：拨号一端自己按退避重拨（`portableSocket.ts` 的 `REDIAL_FIRST_MS`）；原来只等下一次调用或目录更新，这期间对方显示离线。
   - 该对方拨、对方的拨号却迟迟不来：不拨号的一方（设备号大的）等 `LATE_DIAL_MS` 后自己拨过去，之后按同样的退避（2026-11-21）。
-    对方不拨是因为它还抱着一条本机已经没有的连接：本机被强杀或重建时关闭通知没送到，而空闲的连接不会被判死
-    （核心只在有数据发不出去满 `dead_after_us` 时判死）。它收到这次拨号后，旧连接超过 `REDIAL_TAKEOVER_MS` 就换用新的，
-    没超过就丢掉，本机按退避再拨。真机：手机被强杀后重启，设备号比手机小、只能经中转的电脑原来在手机上离线 20 秒到 15 分钟，
+    对方不拨是因为它还抱着一条本机已经没有的连接：本机被强杀或重建时关闭通知没送到，而当时的核心不判空闲的连接死
+    （只在有数据发不出去满 `dead_after_us` 时判）。它收到这次拨号后，旧连接超过 `REDIAL_TAKEOVER_MS` 就换用新的，
+    没超过就丢掉，本机按退避再拨。同日核心补上了空闲判死（`secure.rs` 的 `silent_past_deadline`）：探测满 `dead_after_us`
+    没有回音就断，对方 30 秒内自己发现、照常重拨；自己停了很久刚醒来的一端先接连探测几次再下结论。
+    对方是旧版本时仍然靠这次后拨。真机：手机被强杀后重启，设备号比手机小、只能经中转的电脑原来在手机上离线 20 秒到 15 分钟，
     改后约 1.2 秒；设备号比手机大的电脑由手机拨，一直不受影响。
   - Node Host 回复「支持后台链路」、连接前等读本机身份（最多 2 秒）改成只在开着 Agent-Net 时生效，关着时和主干一样。
   - 主干的部分目录（只读到一条腿时并回上次完整目录）也按 Device Link 设备列表过滤；Agent-Net 后台读设备列表走主干的共享限流账（`officialDeviceListFetch`）。
```

**File**: `packages/agent-net-core/README.md` (modified, +2/-1)
```diff
@@ -956,5 +956,6 @@ KCP 跑官方资料和 kcptun 的 12 种配置，见 `sim/src/kcp.rs` 文件头
 - Node 驱动的加解密、收发和核心都在 Node 的一个线程上，局域网满速时 CPU 会先到顶，还没测；Electron 里要放进 `utilityProcess`，也还没跑过。
 - 路径只按代价选，不比往返和丢包：直连明显比中转差时也走直连，直到它断了。端口预测没做，对称型对端口受限锥形只能走中转。
 - 什么时候重新验证候选地址由上层决定，核心不重试。NAT 映射靠空闲时每 15 秒一来一回保活，映射更快过期的网络空闲后会退回中转。
-- 关闭时发两个关闭包，对端马上知道（2026-11-06）。进程被强行结束时发不出来，这一端仍要等判死（有数据在途时 30 秒，空闲时靠 15 秒一次的探测）；
+- 关闭时发两个关闭包，对端马上知道（2026-11-06）。进程被强行结束时发不出来，这一端仍要等判死（有数据在途时 30 秒；空闲时探测 30 秒没有回音，2026-11-21 起，
+  之前空闲的连接探测不到对端也一直不判死，见 [`sim/results/2026-11-21-idle-dead`](sim/results/2026-11-21-idle-dead/README.md)）；
   对端重启以后也认不出旧连接的包，没有类似 QUIC 无状态重置的机制。
```

**File**: `packages/agent-net-core/prebuilt/manifest.json` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 {
   "version": 1,
-  "sourceDigest": "ad70ceb815af36394e50d8de26c4b59c7581b0ea082450660c675c341d77dbb9",
-  "binaryDigest": "0a3bb1623555732973ed638b4de9278fb6630a2d9b5a029ccccf62cd5ea663df"
+  "sourceDigest": "18108b5455eb126e340603688e6382564e5ce07cf03d5ed88c2748f3ad8e9c06",
+  "binaryDigest": "f25ac4b39a7f7dcb393d0a0b18632fabea27ecd238594d0ec58e478f59276ced"
 }
```

**File**: `packages/agent-net-core/sim/mutants.py` (modified, +8/-0)
```diff
@@ -134,6 +134,14 @@
      "let mut state = RecvStream::new(Self::initial_window(&self.config) as u64);", "let mut state = RecvStream::new(self.config.recv_window as u64);"),
     ("窗口互通：开头按自己的窗口算", "src/connection.rs",
      "config.recv_window.min(LEGACY_WINDOW)", "config.recv_window"),
+    ("安静探测：空闲判死，探测没有回音也不判死", "src/secure.rs",
+     "        if self.silent_past_deadline(now_us) {\n            self.dead = true;\n            return;\n        }\n", ""),
+    ("安静探测：空闲判死，到时限不醒来", "src/secure.rs",
+     "                    consider(self.silence_deadline(self.connection.last_heard()));\n", ""),
+    ("安静探测：空闲判死，停之前的探测照算", "src/secure.rs",
+     "            self.silence_sent_at = None;\n", ""),
+    ("安静探测：空闲判死，刚醒来不等探测发够", "src/secure.rs",
+     "            && now_us >= self.silence_deadline(heard)\n", ""),
     ("包长：收包按发包上限截", "src/secure.rs",
      "packet.len() > self.config.max_packet_size {", "packet.len() > self.config.send_limit() {"),
     ("包长：收到的分片按发的上限查", "src/connection.rs",
```

**File**: `packages/agent-net-core/sim/results/2026-11-21-idle-dead/README.md` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+# 空闲的连接也判死（2026-11-21）
+
+核心指纹 `815d083b7cfe`（算法同前几轮：`src/*.rs` 按 LF 逐个 SHA-256，按 `sha256sum` 的格式排好再取 SHA-1），逐文件见
+[`source-sha256.json`](source-sha256.json)。与主干 `6639c854cc` 的核心相比只改了 `src/secure.rs`、`sim/tests/migration.rs`、
+`sim/mutants.py` 和 `README.md`，`prebuilt/core.wasm` 与 `prebuilt/manifest.json` 按新源码重编（367810 → 368255 字节，
+导出的函数和参数不变）。核心 `[dependencies]` 仍为空，线格式不变，两端不需要同时更新。
+
+## 起因
+
+真机（2026-11-21）：手机 App 被强杀后重启，设备号比手机小、只能经中转的那台电脑在手机上离线 20 秒到 15 分钟。
+那台电脑的日志显示它一直抱着和手机旧进程之间的那条连接。
+
+原因在核心：可靠层只在「有数据没确认、又 `dead_after_us`（30 秒）没听到对端」时判死（`connection.rs` 的 `tick`）。
+两端都没事做的时候对端没了（进程被强行结束、电脑休眠、断网），这一端每秒探测一次，探测满 30 秒就不再探测，
+但连接一直不判死：上层显示对端在线、也不再重拨，直到哪天有数据要发、又等满 30 秒。模块说明和 README 写的是
+「空闲时靠 15 秒一次的探测」发现，代码里探测发了，结论没下。
+
+## 改了什么
+
+`secure.rs`：探测过、到判死时限对端仍然没有任何回音，就判这条连接断了（`silent_past_deadline`）。
+
+- 对端只是没东西要发时，每 15 秒有一来一回（`silence_ping_at` 的 `answered`），不会被判。
+- 判死前那次探测丢了的话，之后每秒一次，到时限前还有十几次机会。
+- 这一端自己停过（手机进程被冻结、电脑休眠）再醒来时，离上次听到对端可能早就超过判死时限，但那段时间这一端没有在听。
+  所以还要求眼下这一串探测是一次接一次发的、已经发够 `SILENCE_PROBE_INTERVALS`（3）个间隔：隔了两个间隔以上才再探测，
+  算新的一串；这一串没发够之前，过了时限也接着探测。醒来后对端还在，一个往返就有回音；真没了，约 3 秒后判死。
+- 停之前已经发过探测、还没等到回音的情形也一样：两次处理计时器之间隔了两个探测间隔以上（探测没有回音时本来每个间隔都要醒一次），
+  说明这一端停过，停之前的探测不算数，醒来从头探测（`tick_established`；PR #11856 审阅指出最初的写法会拿停之前那次探测当场判死）。
+- 到判死的时刻要醒来判一次（`next_wake`），否则探测停了以后没有任何计时器。
+
+不改的：有数据在途时的判死、探测的间隔和包、关闭通知、换路径的逻辑。
+
+## 验证
+
+**模拟器（虚拟时间）**，`cargo test`（`sim/`）全部通过：migration 15、reliability 47（1 个原本就忽略）、secure 28、
+streams 15、sharing 24、bursts 5、traversal 6、udp 2，共 143 项。新增两项（`sim/tests/migration.rs`）：
+
+| 用例 | 断言 |
+|---|---|
+| `an_idle_connection_whose_peer_is_gone_is_declared_dead` | 两端空闲、对端一直回探测时 90 秒不判死；一个方向的包从此送不到，另一端在 14–31 秒内判死（最后一次听到对端最多是 15 秒前），判死前线上不超过 40 个包；它停了以后这一端也在 31 秒内判死；没有空转 |
+| `waking_after_a_long_stop_probes_before_giving_up` | 时钟一次跳过 60 秒（两端都没运行），停之前探测有回音、或正好有三次以上探测没等到回音，共四种组合：对端还在时两端都不判死；对端没了时醒来 2–5 秒后判死；跳过去之后不空转 |
+
+`idle_connections_only_keep_alive`（空闲一分钟线上不超过 12 个包、不判死）和换网随机矩阵（`random_moves_deliver_intact_streams`，
+6 个固定种子加 100 个随机种子）不变。
+
+**变异检验**（`python sim/mutants.py 空闲判死`，四个都被抓到）：
+
+| 变异 | 抓到它的用例 |
+|---|---|
+| 探测没有回音也不判死 | 两个新用例 |
+| 到判死的时刻不醒来 | `an_idle_connection_whose_peer_is_gone_is_declared_dead` |
+| 停之前的探测照算 | `waking_after_a_long_stop_probes_before_giving_up` |
+| 刚醒来不等探测发够 | `waking_after_a_long_stop_probes_before_giving_up` |
+
+**回环 UDP 加真实时钟**（手机用的原生引擎 `agent-net-native`，两个引擎走本机真实 UDP，临时测试，未提交）：
+两端空闲 40 秒，谁也不判死；之后一端不再运行，另一端 22.1 秒后报告连接已断（在补上「停之前的探测不算数」之前的版本上跑的，
+这条规则只在本端自己停过时起作用，这个测试里没有）。
+
+**电脑端**：`packages/agent-net` 在重编的 WASM 上 `vitest run`，140 通过、5 跳过。
+
+**真机**（小米 Android 17，带新核心的测试包；对端是没有这次改动的电脑：局域网直连 5 台，经官方中转 2 台，其中一台是正式版 0.1.143）：
+App 在前台空闲 6 分钟，7 条连接没有一条断开重连（同样是补上那条规则之前的版本）。
+
+## 没测的
+
+- 公网上「对端真没了」的判死没有在真机上造出来：对端电脑没有这次改动，手机一侧要断网才能造，而断网本身会触发 App 的换网处理。
+  这条只有模拟器和回环真实时钟的结果。
+- 电脑端（WASM）没有在两台真电脑之间实测空闲判死，只跑了 `packages/agent-net` 的单测。
+- `netperf` 的本机与公网对比没有重跑：它测的是不带加密层的可靠传输，这次没有碰。
+- iOS 没有测。
```

**File**: `packages/agent-net-core/sim/results/2026-11-21-idle-dead/source-sha256.json` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+{
+  "sim/mutants.py": "3f2a49c1f80e0a9d323595b78895468c3fd8e9af89251c385836a459ec22a67f",
+  "sim/src/crypto.rs": "3d919c1223d326c7f717fb012fd9f671718bce152781858c9f66aa64628ec72c",
+  "sim/src/fec.rs": "792e920b04310d7f14dccf52fda58abafdefedd1ac3bd36e6c7dfd197ffdff07",
+  "sim/src/kcp.rs": "975cc4fb0fa4ad2d57f0082b0f3b6aa6512c4cb72b592ee5da4db8b4624324aa",
+  "sim/src/lib.rs": "c0e547e355ff92e3297c5389603430ed713a501ab331bc1860a01f550e2e1891",
+  "sim/src/migration.rs": "fadea62430773f692cb0fbb3d00baa372d6951929767df0368bc4f36f035713a",
+  "sim/src/share.rs": "65c1d8b0761d1b27be7afc028e6fdaac6357c7d943b13f5ddd07296e08a3fad1",
+  "sim/src/traversal.rs": "7bd9d6a159e16e27dca92ee59f2b138bc20beb81cb6a65817927e881da03c546",
+  "sim/tests/bursts.rs": "2000a280e4063c349f453cf91d6f2e28b86d45646882497d6dcddea411f5a990",
+  "sim/tests/migration.rs": "19daab2620d2ff3bef823fd00bdb5f1817aec18987237924a16f1ccf49dc29f9",
+  "sim/tests/reliability.rs": "ecd6819ae5467b3e933d2345b53a3417b81fc022ebcd4f419681209ee449db31",
+  "sim/tests/secure.rs": "bf78c8e21471dea1282c3f9df5ea36cbeb8e5430c4a953b3536e931185bb3056",
+  "sim/tests/sharing.rs": "6c77c69205883ad1146d97ede1953935602335bb68495900f13f9785ed3af22b",
+  "sim/tests/streams.rs": "d746b5bfca18c261584b5098a68480240378650ff4f64a9d12be74554f087330",
+  "sim/tests/traversal.rs": "248291bee81a5f041476950a30bf5dba4f3eeccbe491d83a3838e358d68fd1e8",
+  "sim/tests/udp.rs": "9edeaff86a10e5c268c889f2677ca0bd8732ed15cb90b3257a803961c774053f",
+  "src/admission.rs": "a17b6e85c78895b2ba1875c7c651a937e7d790ab58a5c1e204a300bef171035c",
+  "src/congestion.rs": "35ae123d025bf9c3e07e62f32e0ef3a5f819916d220f31f8a66ee3e63a143225",
+  "src/connection.rs": "1296417442eebe1107c88e3bc1778d5efdf06a93d4f75aed6d0b43ba7dd9b7b4",
+  "src/crypto.rs": "dffcfdcac3b995a74142f57b1181873d9112ee558bb2293f2b1cc1eb46f80af6",
+  "src/endpoint.rs": "4264f9eee1c4320d1ad9501ecc2899ddffe4d169d2875a01c382d13afd94ec7f",
+  "src/ids.rs": "747b2f5ac0900d19b36cac4df09bc27864d83a6eaf26685fc7bc2bfb2650bb57",
+  "src/lib.rs": "4fa8514d40c7829cb3d36e1b3458db97ff8edbd22c33a05c5e987170969d8aef",
+  "src/noise.rs": "2b4fb7941b739d1544eaf430eacdb0c7e93f76a30cd009bfda19703949cae32d",
+  "src/parity.rs": "578c0dc3e57f7f5dadc1e2fc349fb968cd30e5035d613728fcdc6a35fcd25b23",
+  "src/rtt.rs": "082b476b9b98223bf29b22ceb0ce47c9b5366d06d98648e2a50b18446bb6455e",
+  "src/secure.rs": "accf9fd8b4870609e588a793963336a7b9b108703ea8e068fee4f5686b3468c1",
+  "src/stream.rs": "121f9c7bb4101aa79311fded96370a73ec1bfb0f2babf625f30f21bcdbd5d70b",
+  "src/wire.rs": "def567ccd502dece36b87192e8ca8f46e5107bbc777492f0c66b8584d82d5916"
+}
```

**File**: `packages/agent-net-core/sim/tests/migration.rs` (modified, +66/-0)
```diff
@@ -422,6 +422,72 @@ fn idle_connections_only_keep_alive() {
     assert_eq!(duo.spurious_wakes, 0);
 }
 
+/// 测试价值：公开 SecureConnection 收发与计时入口上，两端都没事做时对端没了（被强行结束、休眠、断网）。
+/// 探测一直没有回音，到判死时限这条连接要断：否则上层一直显示对端在线、也不再重拨（2026-11-21 真机，
+/// 手机被强杀以后电脑抱着连接 44 秒到 15 分钟）。`idle_connections_only_keep_alive` 只覆盖对端一直回探测的情形；
+/// 可靠层的判死（`outages_recover_or_give_up_within_the_deadline`）都有数据在途。
+/// 最小输入：一条传完数据、已经空闲的连接，之后一个方向的包全部送不到。Rust integration，虚拟时间。
+#[test]
+fn an_idle_connection_whose_peer_is_gone_is_declared_dead() {
+    let mut duo = Duo::new();
+    duo.upload(&[1; 20_000]);
+    assert!(duo.run_until(duo.now + 5_000_000, &|duo| duo.in_flight.is_empty()));
+    // 对端只是没东西要发：一来一回的探测一直有回音，过多久都不判死。
+    assert!(!duo.run_until(duo.now + 90_000_000, &|duo| duo.client.is_dead() || duo.server.is_dead()));
+    // 客户端的包从此送不到服务端：服务端最后一次听到客户端最多是 15 秒前（空闲时的探测间隔）。
+    duo.uplink = false;
+    let (gone, packets) = (duo.now, duo.wire.len());
+    assert!(duo.run_until(gone + 60_000_000, &|duo| duo.server.is_dead()), "the server never gave up");
+    let waited = duo.now - gone;
+    assert!((14_000_000..=31_000_000).contains(&waited), "gave up after {waited} us");
+    // 判死前每秒探测一次，不退避也不加码。
+    let probes = duo.wire[packets..].iter().filter(|(to_server, _, _)| !*to_server).count();
+    assert!(probes <= 40, "{probes} packets to a peer that is gone");
+    // 服务端停了以后客户端也再听不到任何包，同样在判死时限内放弃。
+    let quiet = duo.now;
+    assert!(duo.run_until(quiet + 60_000_000, &|duo| duo.client.is_dead()), "the client never gave up");
+    assert!(duo.now - quiet <= 31_000_000, "the client gave up after {} us", duo.now - quiet);
+    assert_eq!(duo.spurious_wakes, 0);
+}
+
+/// 测试价值：同一入口上，这一端自己停了很久（手机进程被冻结、电脑休眠）再醒来。离上次听到对端早就超过判死时限，
+/// 但那段时间这一端没有在听：对端还在时醒来探测一次就有回音，连接不能断；对端真没了，要接连探测几次都没有回音才判死。
+/// 停之前已经有一次探测没等到回音时也一样（PR #11856 审阅：那次探测丢了、这一端随后停了，醒来的第一个计时器
+/// 不能拿它判死）。没有这两条时 `an_idle_connection_whose_peer_is_gone_is_declared_dead` 的规则会把好连接判死。
+/// 最小输入：一条空闲的连接，停之前探测有回音或正好丢了，时钟一次跳过两个判死时限，跳完以后对端在或不在。
+/// Rust integration，虚拟时间。
+#[test]
+fn waking_after_a_long_stop_probes_before_giving_up() {
+    for (probe_lost_before, peer_alive) in [(false, true), (false, false), (true, true), (true, false)] {
+        let label = format!("probe lost before the stop: {probe_lost_before}, peer alive: {peer_alive}");
+        let mut duo = Duo::new();
+        duo.upload(&[1; 20_000]);
+        assert!(duo.run_until(duo.now + 20_000_000, &|duo| duo.in_flight.is_empty()), "{label}");
+        if probe_lost_before {
+            // 服务端下一次探测（最多 15 秒后）等不到回音，之后每秒一次，这样过了几秒才停。
+            let probes = duo.server.security_stats().silence_pings;
+            duo.uplink = false;
+            assert!(duo.run_until(duo.now + 20_000_000, &|duo| duo.server.security_stats().silence_pings >= probes + 3), "{label}");
+            assert!(!duo.server.is_dead(), "{label}");
+        }
+        // 两端都停了一分钟：谁也没有运行，线上也没有包。
+        duo.in_flight.clear();
+        duo.now += 60_000_000;
+        duo.uplink = peer_alive;
+        let woke = duo.now;
+        let died = duo.run_until(woke + 20_000_000, &|duo| duo.server.is_dead());
+        assert_eq!(died, !peer_alive, "{label}");
+        if peer_alive {
+            assert!(!duo.client.is_dead() && duo.client.is_established() && duo.server.is_established(), "{label}");
+        } else {
+            let waited = duo.now - woke;
+            assert!((2_000_000..=5_000_000).contains(&waited), "{label}: gave up {waited} us after waking");
+        }
+        // 时钟跳过去的那一下，两端到期的计时器各算一次；之后不能再空转。
+        assert!(duo.spurious_wakes <= 2, "{label}: {} spurious wakes", duo.spurious_wakes);
+    }
+}
+
 /// 抓到过真实 bug 的种子，每次都跑：5314、9232 换网后几轮几乎没送到数据，降速阶段的节奏被压成 0，除以 0 崩溃；
 /// 900360 真换了网络时抢先复制的包把要验证的地址顶掉，真的新地址一直验证不完；901894 对端回过一次探测就再也不探测，
 /// 之后悄悄换了地址就失联；921733 换网后只在下载、新网络上行丢三成还成段丢包，唯一送到的探测又被抢先复制，
```

---

### Incident Patch 3: `70b3fd50` (2026-11-21)
**Commit Message**: fix(agent-net-core): 停之前没等到回音的探测不算数

PR #11856 审阅：本端发出空闲探测、还没等到回音时停了（进程被冻结、休眠），
醒来的第一个计时器会拿停之前那次探测直接判死，走不到重新开始探测的那一步，
对端还在也没有机会回应。

两次处理计时器之间隔了两个探测间隔以上，说明这一端停过（探测没有回音时本来
每个间隔都要醒一次）：停之前的探测作废，醒来从头探测。唤醒用例补上「停之前
已有三次以上探测没等到回音」的两种情形，变异体加一个；WASM 重编。

Signed-off-by: MagicLizi <[REDACTED_EMAIL]>

**File**: `packages/agent-net-core/prebuilt/manifest.json` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 {
   "version": 1,
-  "sourceDigest": "b8c93b28e6ed4b0c4c21cd36ba02a933248016707cc4b2329857da2ebe57d72d",
-  "binaryDigest": "82a38e6f19ba3926864c709d70e95f6a1982fd160280be1d0273ffbc41d4720b"
+  "sourceDigest": "18108b5455eb126e340603688e6382564e5ce07cf03d5ed88c2748f3ad8e9c06",
+  "binaryDigest": "f25ac4b39a7f7dcb393d0a0b18632fabea27ecd238594d0ec58e478f59276ced"
 }
```

**File**: `packages/agent-net-core/sim/mutants.py` (modified, +2/-0)
```diff
@@ -138,6 +138,8 @@
      "        if self.silent_past_deadline(now_us) {\n            self.dead = true;\n            return;\n        }\n", ""),
     ("安静探测：空闲判死，到时限不醒来", "src/secure.rs",
      "                    consider(self.silence_deadline(self.connection.last_heard()));\n", ""),
+    ("安静探测：空闲判死，停之前的探测照算", "src/secure.rs",
+     "            self.silence_sent_at = None;\n", ""),
     ("安静探测：空闲判死，刚醒来不等探测发够", "src/secure.rs",
      "            && now_us >= self.silence_deadline(heard)\n", ""),
     ("包长：收包按发包上限截", "src/secure.rs",
```

**File**: `packages/agent-net-core/sim/results/2026-11-21-idle-dead/README.md` (modified, +10/-6)
```diff
@@ -1,8 +1,8 @@
 # 空闲的连接也判死（2026-11-21）
 
-核心指纹 `0d0df395c3f6`（算法同前几轮：`src/*.rs` 按 LF 逐个 SHA-256，按 `sha256sum` 的格式排好再取 SHA-1），逐文件见
+核心指纹 `815d083b7cfe`（算法同前几轮：`src/*.rs` 按 LF 逐个 SHA-256，按 `sha256sum` 的格式排好再取 SHA-1），逐文件见
 [`source-sha256.json`](source-sha256.json)。与主干 `6639c854cc` 的核心相比只改了 `src/secure.rs`、`sim/tests/migration.rs`、
-`sim/mutants.py` 和 `README.md`，`prebuilt/core.wasm` 与 `prebuilt/manifest.json` 按新源码重编（367810 → 368186 字节，
+`sim/mutants.py` 和 `README.md`，`prebuilt/core.wasm` 与 `prebuilt/manifest.json` 按新源码重编（367810 → 368255 字节，
 导出的函数和参数不变）。核心 `[dependencies]` 仍为空，线格式不变，两端不需要同时更新。
 
 ## 起因
@@ -24,6 +24,8 @@
 - 这一端自己停过（手机进程被冻结、电脑休眠）再醒来时，离上次听到对端可能早就超过判死时限，但那段时间这一端没有在听。
   所以还要求眼下这一串探测是一次接一次发的、已经发够 `SILENCE_PROBE_INTERVALS`（3）个间隔：隔了两个间隔以上才再探测，
   算新的一串；这一串没发够之前，过了时限也接着探测。醒来后对端还在，一个往返就有回音；真没了，约 3 秒后判死。
+- 停之前已经发过探测、还没等到回音的情形也一样：两次处理计时器之间隔了两个探测间隔以上（探测没有回音时本来每个间隔都要醒一次），
+  说明这一端停过，停之前的探测不算数，醒来从头探测（`tick_established`；PR #11856 审阅指出最初的写法会拿停之前那次探测当场判死）。
 - 到判死的时刻要醒来判一次（`next_wake`），否则探测停了以后没有任何计时器。
 
 不改的：有数据在途时的判死、探测的间隔和包、关闭通知、换路径的逻辑。
@@ -36,26 +38,28 @@ streams 15、sharing 24、bursts 5、traversal 6、udp 2，共 143 项。新增
 | 用例 | 断言 |
 |---|---|
 | `an_idle_connection_whose_peer_is_gone_is_declared_dead` | 两端空闲、对端一直回探测时 90 秒不判死；一个方向的包从此送不到，另一端在 14–31 秒内判死（最后一次听到对端最多是 15 秒前），判死前线上不超过 40 个包；它停了以后这一端也在 31 秒内判死；没有空转 |
-| `waking_after_a_long_stop_probes_before_giving_up` | 时钟一次跳过 60 秒（两端都没运行）：对端还在时两端都不判死；对端没了时醒来 2–5 秒后判死 |
+| `waking_after_a_long_stop_probes_before_giving_up` | 时钟一次跳过 60 秒（两端都没运行），停之前探测有回音、或正好有三次以上探测没等到回音，共四种组合：对端还在时两端都不判死；对端没了时醒来 2–5 秒后判死；跳过去之后不空转 |
 
 `idle_connections_only_keep_alive`（空闲一分钟线上不超过 12 个包、不判死）和换网随机矩阵（`random_moves_deliver_intact_streams`，
 6 个固定种子加 100 个随机种子）不变。
 
-**变异检验**（`python sim/mutants.py 空闲判死`，三个都被抓到）：
+**变异检验**（`python sim/mutants.py 空闲判死`，四个都被抓到）：
 
 | 变异 | 抓到它的用例 |
 |---|---|
 | 探测没有回音也不判死 | 两个新用例 |
 | 到判死的时刻不醒来 | `an_idle_connection_whose_peer_is_gone_is_declared_dead` |
+| 停之前的探测照算 | `waking_after_a_long_stop_probes_before_giving_up` |
 | 刚醒来不等探测发够 | `waking_after_a_long_stop_probes_before_giving_up` |
 
 **回环 UDP 加真实时钟**（手机用的原生引擎 `agent-net-native`，两个引擎走本机真实 UDP，临时测试，未提交）：
-两端空闲 40 秒，谁也不判死；之后一端不再运行，另一端 22.1 秒后报告连接已断。
+两端空闲 40 秒，谁也不判死；之后一端不再运行，另一端 22.1 秒后报告连接已断（在补上「停之前的探测不算数」之前的版本上跑的，
+这条规则只在本端自己停过时起作用，这个测试里没有）。
 
 **电脑端**：`packages/agent-net` 在重编的 WASM 上 `vitest run`，140 通过、5 跳过。
 
 **真机**（小米 Android 17，带新核心的测试包；对端是没有这次改动的电脑：局域网直连 5 台，经官方中转 2 台，其中一台是正式版 0.1.143）：
-App 在前台空闲 6 分钟，7 条连接没有一条断开重连。
+App 在前台空闲 6 分钟，7 条连接没有一条断开重连（同样是补上那条规则之前的版本）。
 
 ## 没测的
 
```

**File**: `packages/agent-net-core/sim/results/2026-11-21-idle-dead/source-sha256.json` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 {
-  "sim/mutants.py": "cedb19cb00cf7eab088a8a94421a9d673c31017aa372666b8366be1dd086592f",
+  "sim/mutants.py": "3f2a49c1f80e0a9d323595b78895468c3fd8e9af89251c385836a459ec22a67f",
   "sim/src/crypto.rs": "3d919c1223d326c7f717fb012fd9f671718bce152781858c9f66aa64628ec72c",
   "sim/src/fec.rs": "792e920b04310d7f14dccf52fda58abafdefedd1ac3bd36e6c7dfd197ffdff07",
   "sim/src/kcp.rs": "975cc4fb0fa4ad2d57f0082b0f3b6aa6512c4cb72b592ee5da4db8b4624324aa",
@@ -8,7 +8,7 @@
   "sim/src/share.rs": "65c1d8b0761d1b27be7afc028e6fdaac6357c7d943b13f5ddd07296e08a3fad1",
   "sim/src/traversal.rs": "7bd9d6a159e16e27dca92ee59f2b138bc20beb81cb6a65817927e881da03c546",
   "sim/tests/bursts.rs": "2000a280e4063c349f453cf91d6f2e28b86d45646882497d6dcddea411f5a990",
-  "sim/tests/migration.rs": "972dce68d73e3eb2a0f2ff55fd1787953e15c87a06ced7d39fa8d61477e0abaf",
+  "sim/tests/migration.rs": "19daab2620d2ff3bef823fd00bdb5f1817aec18987237924a16f1ccf49dc29f9",
   "sim/tests/reliability.rs": "ecd6819ae5467b3e933d2345b53a3417b81fc022ebcd4f419681209ee449db31",
   "sim/tests/secure.rs": "bf78c8e21471dea1282c3f9df5ea36cbeb8e5430c4a953b3536e931185bb3056",
   "sim/tests/sharing.rs": "6c77c69205883ad1146d97ede1953935602335bb68495900f13f9785ed3af22b",
@@ -25,7 +25,7 @@
   "src/noise.rs": "2b4fb7941b739d1544eaf430eacdb0c7e93f76a30cd009bfda19703949cae32d",
   "src/parity.rs": "578c0dc3e57f7f5dadc1e2fc349fb968cd30e5035d613728fcdc6a35fcd25b23",
   "src/rtt.rs": "082b476b9b98223bf29b22ceb0ce47c9b5366d06d98648e2a50b18446bb6455e",
-  "src/secure.rs": "3fb39508b514abf64f79edf20c56c100be2b67a9f4a74333b1d707aa7d3650a3",
+  "src/secure.rs": "accf9fd8b4870609e588a793963336a7b9b108703ea8e068fee4f5686b3468c1",
   "src/stream.rs": "121f9c7bb4101aa79311fded96370a73ec1bfb0f2babf625f30f21bcdbd5d70b",
   "src/wire.rs": "def567ccd502dece36b87192e8ca8f46e5107bbc777492f0c66b8584d82d5916"
 }
```

**File**: `packages/agent-net-core/sim/tests/migration.rs` (modified, +19/-7)
```diff
@@ -452,27 +452,39 @@ fn an_idle_connection_whose_peer_is_gone_is_declared_dead() {
 
 /// 测试价值：同一入口上，这一端自己停了很久（手机进程被冻结、电脑休眠）再醒来。离上次听到对端早就超过判死时限，
 /// 但那段时间这一端没有在听：对端还在时醒来探测一次就有回音，连接不能断；对端真没了，要接连探测几次都没有回音才判死。
-/// 没有这条时 `an_idle_connection_whose_peer_is_gone_is_declared_dead` 的规则会在醒来的第一个计时器上把好连接判死。
-/// 最小输入：一条空闲的连接，时钟一次跳过两个判死时限，跳完以后对端在或不在。Rust integration，虚拟时间。
+/// 停之前已经有一次探测没等到回音时也一样（PR #11856 审阅：那次探测丢了、这一端随后停了，醒来的第一个计时器
+/// 不能拿它判死）。没有这两条时 `an_idle_connection_whose_peer_is_gone_is_declared_dead` 的规则会把好连接判死。
+/// 最小输入：一条空闲的连接，停之前探测有回音或正好丢了，时钟一次跳过两个判死时限，跳完以后对端在或不在。
+/// Rust integration，虚拟时间。
 #[test]
 fn waking_after_a_long_stop_probes_before_giving_up() {
-    for peer_alive in [true, false] {
+    for (probe_lost_before, peer_alive) in [(false, true), (false, false), (true, true), (true, false)] {
+        let label = format!("probe lost before the stop: {probe_lost_before}, peer alive: {peer_alive}");
         let mut duo = Duo::new();
         duo.upload(&[1; 20_000]);
-        assert!(duo.run_until(duo.now + 20_000_000, &|duo| duo.in_flight.is_empty()));
+        assert!(duo.run_until(duo.now + 20_000_000, &|duo| duo.in_flight.is_empty()), "{label}");
+        if probe_lost_before {
+            // 服务端下一次探测（最多 15 秒后）等不到回音，之后每秒一次，这样过了几秒才停。
+            let probes = duo.server.security_stats().silence_pings;
+            duo.uplink = false;
+            assert!(duo.run_until(duo.now + 20_000_000, &|duo| duo.server.security_stats().silence_pings >= probes + 3), "{label}");
+            assert!(!duo.server.is_dead(), "{label}");
+        }
         // 两端都停了一分钟：谁也没有运行，线上也没有包。
         duo.in_flight.clear();
         duo.now += 60_000_000;
         duo.uplink = peer_alive;
         let woke = duo.now;
         let died = duo.run_until(woke + 20_000_000, &|duo| duo.server.is_dead());
-        assert_eq!(died, !peer_alive, "peer alive: {peer_alive}");
+        assert_eq!(died, !peer_alive, "{label}");
         if peer_alive {
-            assert!(!duo.client.is_dead() && duo.client.is_established() && duo.server.is_established());
+            assert!(!duo.client.is_dead() && duo.client.is_established() && duo.server.is_established(), "{label}");
         } else {
             let waited = duo.now - woke;
-            assert!((2_000_000..=5_000_000).contains(&waited), "gave up {waited} us after waking");
+            assert!((2_000_000..=5_000_000).contains(&waited), "{label}: gave up {waited} us after waking");
         }
+        // 时钟跳过去的那一下，两端到期的计时器各算一次；之后不能再空转。
+        assert!(duo.spurious_wakes <= 2, "{label}: {} spurious wakes", duo.spurious_wakes);
     }
 }
 
```

**File**: `packages/agent-net-core/src/secure.rs` (modified, +11/-0)
```diff
@@ -814,6 +814,8 @@ pub struct SecureConnection<C: Crypto> {
     silence_sent_at: Option<u64>,
     /// 眼下这一串一次接一次的探测是从什么时候开始的：对端回了、或者隔了很久才再探测，都重新算。
     silence_started_at: u64,
+    /// 上一次处理计时器的时间：隔得太久说明这一端停过，见 `tick_established`。
+    ticked_at: u64,
     /// 最近一次因为这一端换了网络而从头量的时间。
     moved_at: Option<u64>,
     /// 最近一次路径验证通过、数据换到新路径的时间。
@@ -852,6 +854,7 @@ impl<C: Crypto> SecureConnection<C> {
             silence_heard: 0,
             silence_sent_at: None,
             silence_started_at: 0,
+            ticked_at: 0,
             moved_at: None,
             switched_at: None,
             last_id_challenge: None,
@@ -1561,6 +1564,14 @@ impl<C: Crypto> SecureConnection<C> {
         self.stats.path_failures += self.paths.expire(now_us);
         self.retain_connection_id_paths();
         self.connection.tick(now_us);
+        // 这一端停过（两次处理计时器之间隔了两个探测间隔以上，探测还没有回音时本来每个间隔都要醒一次）：
+        // 停之前发的探测不算数，那段时间这一端没有在听，醒来从头探测（`SILENCE_PROBE_INTERVALS`）。
+        if now_us.saturating_sub(self.ticked_at) > 2 * self.silence_interval()
+            && self.silence_sent_at.is_some_and(|sent| sent >= self.connection.last_heard())
+        {
+            self.silence_sent_at = None;
+        }
+        self.ticked_at = now_us;
         if self.silent_past_deadline(now_us) {
             self.dead = true;
             return;
```

#### Recent Merged Pull Requests:
- **PR #11856** (2026-11-21): fix(agent-net-core): 空闲的连接探测不到对端也判死 (@MagicLizi)
- **PR #11854** (2026-11-21): fix(desktop): 交接重放保留用户消息里的图片与附件引用 (@fmfsaisai)
- **PR #11853** (2026-11-21): fix(desktop): 远程新建任务时复用已选模型、项目列表和图标 (@dashhuang)
- **PR #11852** (2026-11-21): perf(agent-net): 对方不拨号时自己拨过去，手机建连接少等两处 (@MagicLizi)
- **PR #11840** (2026-11-21): fix(pr-card): 同步已合并 PR 的图标和状态颜色 (@dashhuang)
- **PR #11835** (2026-11-20): fix(subscription): 说明当前模型无可用订阅账号的原因 (@dashhuang)

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

## X. auth): resume Passport recovery after transient failure

**RULE**:
When implementing operations in `apps/desktop/src/main/__tests__/authColdStartRecovery.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9f9c0a86`: auth): resume Passport recovery after transient failure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/__tests__/authColdStartRecovery.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
const pendingResourcePassportRecoveries = new Map();
  it.each(['runtime', 'cold-start'] as const)('resumes pending Passport recovery without replaying a dead Resource (%s)', async phase => {
    const { h } = recoverySetup();
    const fresh = phase === 'runtime' ? h : setup();
    if (phase === 'cold-start') {
      fresh.vault.resources[ORIGINAL_KEY].metadata = h.vault.resources[ORIGINAL_KEY].metadata;
      fresh.vault.passports = h.vault.passports;
    }
    fresh.deps.refreshPassportSessionSingleFlight.mockRejectedValueOnce(
      new AuthApiError('AUTH_REQUEST_FAILED', 503, 'busy', Date.now() + 180_000),
    );
    if (phase === 'runtime') await rejectAfterLoss(fresh);
    else {
      void fresh.start();
      await vi.advanceTimersByTimeAsync(1);
      fresh.request.mockResolvedValue({ ok: false, status: 401,
        data: { error: { code: 'INVALID_REFRESH_TOKEN' } } });
      await vi.advanceTimersByTimeAsync(61_250);
    }
    expect(fresh.deps.refreshPassportSessionSingleFlight).toHaveBeenCalledTimes(1);
    const resourceRequests = fresh.request.mock.calls.length;
    // A redundant refresh would now hit a transport outage and postpone Passport.
    fresh.request.mockR
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9f9c0a86` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: makecindy-cindy-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "makecindy-cindy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T12:50:58.806Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-makecindy-cindy-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [makecindy-cindy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T12:50:58.806Z`  
> **Learning ID**: `LEARN-EVO-makecindy-cindy-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 61%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from makecindy-cindy-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source**: github ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Source Version**: `bba889a9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T12:50:52.470Z  
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
> **Harvest Timestamp**: 2026-11-26T12:50:52.463Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `makecindy/cindy`
- **Description**: Consider it done. The open-source AI agent that works out of the box · 想到，就能做到。开源、开箱即用的 AI Agent。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10678 stars

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
- **Issue #13004** (2026-11-26): **插件引擎（ACP）后台启动常驻开发服务后，回合结束仍持续显示运行中且每轮重置计时**
  *Symptoms*: **提交人**: wjxforu **客户端版本**: 0.1.146  ---  ### 现象  在**本机插件引擎（Antigravity / ACP）**会话中后台启动一个本地开发服务（例如 `pnpm dev`，且工具调用入参已明确带有 `IsDaemon: true`）后，即使助手已经回复完毕、回合正常结束，左侧任务列表中该会话的图标仍持续显示为「运行中」状态，容易误以为任务还在处理中。  更明显的是，每次继续在该会话里发消息，新一轮回复结束后图标又会立刻重新点亮并持续约 30 分钟。  ### 复现步骤  1. 使用插件引擎（如本机 Antigravity）新建一个任务； 2. 在任务中让 Agent 后台启动一个不会自动退出的开发服务（如 `unset HTTPS_PROXY ... && pnpm dev`，工具参数带 `IsDaemon: true`）； 3. 等 Agent 完成当前回复并结束回合； 4. 观察左侧任务列表：该任务仍持续显示运行中图标；之后再发一轮普通消息等回复结束，图标会再次点亮并重新计时约 30 分钟。  ### 原因线索与对比  - 此前在 #10751（PR #10786）中，Claude Code 已经按命令区分了「常驻服务（`service`）」和「会自己结束的后台工作（`work`）」，本地 dev server 不会点亮侧边栏运行中状态。 - 但在 ACP 插件引擎下，`IsDaemon: true` 的命令只要服务活着就不会发送 `completed`，而宿主侧在回合正常结束（`end_turn`）时把所有未完成工具调用一并视为「后台仍在工作」，既未识别 `IsDaemon: true` 这类常驻标记，也未复用 `classifyBackgroundCommand` 排除长驻服务，导致常驻服务持续触发后台活动态，且每次新回合结束都会刷新 30 分钟上限。  ### 期望行为  插件引擎（ACP）的后台活动检测能够区分常驻服务与真正的后台工作： - 优先识别工具入参中的常驻标记（如 `IsDaemon === true`）； - 并复用现有的长驻命令分类逻辑（如 `pnpm dev` 等开发服务），避免长驻服务误点亮侧边栏运行中图标，同时保留后台子代理、构建、测试等真实后台工作的运行中提示。 --- ## 相关日志  提交客户端本机最近 2 小时的运行日志摘录，不代表已定位故障，也不包含 SSH 远端或手机日志。已按来源和字段白名单过滤并脱敏；不读取对话正文或原始请求响应。 ```text - 2026-11-26T01:00:01.729Z [WARN] [proxy/cc-proxy] ◀ upstream response (non-2xx) - 2026-11-26T01:18:19.521Z [WARN] [proxy/cc-proxy] ◀ upstream response (non-2xx) - 2026-11-26T01:25:51.774Z [WARN] [main/workdir-diagnostics] workdir probe filesystem result { ↵    requestId: 3094, ↵    operation: 'realpath', ↵    directoryRef: '01323dc5e8f1c148', ↵    phase: 'waiting-result', ↵    timeoutMs: 5000, ↵    elapsed

- **Issue #12883** (2026-11-25): **db-worker 超时后 turnId 复用导致 "could not replace the previous turn lease" 永久自锁**
  *Symptoms*: **提交人**: qingwei **客户端版本**: 0.1.146  ---  ### 问题现象  会话在上一轮正常结束、准备消费队列下一条消息时，反复报错「回复未完成：`could not replace the previous turn lease`」，队列头部消息不断被放回队首重试并持续失败。  在同一 Cindy 进程生命周期内，该会话无法自愈；只有完全退出并重启 Cindy（产生新的 `owner.instanceId` 且旧进程退出）后，残留租约才会被回收解除。  ### 触发场景  发生在长驻 Claude Code 会话的队列自动续发路径中。当时本地 SQLite 数据库体积较大（约 1 GB）且多会话并发读写繁忙，导致 `db-worker` 的 `op="tx"` RPC 出现超过 30 秒超时（`DB_TRANSPORT_OUTCOME_UNKNOWN`）。  ### 根因分析  1. **客户端超时但 SQLite 实际提交成功**：    - `dispatchSend` 将 `turnGeneration` 从 `N` 递增为 `N+1`，拼出确定性 `turnId = "${sessionInstanceId}:${N+1}"`。    - `beforeProviderStart` 调用 `SessionTurnLeaseTracker.markTurnStarted(sessionId, turnId)`，向 `db-worker` 发起 `message.leaseMutate (op="insert")`。    - 该 RPC 超过 30s 触发客户端超时（`DB_TRANSPORT_OUTCOME_UNKNOWN`），但 `db-worker` 实际仍完成了事务提交，对应 `session:turn-lease:v1:<instanceId>` 租约行已落盘。 2. **失败回滚导致下次重试复用同一 `turnId`**：    - 超时后，`markTurnStarted` 的 `catch` 删除内存中的 `activeTurnIds.delete(sessionId)`；    - `dispatchSend` 的 `finally` 将 `this.turnGeneration` 回滚回 `N`；    - `maker-input-coordinator` 将该消息恢复回队首（`pre-accept send failed; restored queue head`）。 3. **重试时投机写入 `activeTurnIds` 导致 `clearRecoverableLease` 误判自锁**：    - 队列重试时，`dispatchSend` 再次把 `turnGeneration` 从 `N` 递增为 `N+1`，生成与已落盘租约**完全相同**的 `turnId`。    - `markTurnStarted` **在写库之前**先执行 `this.activeTurnIds.set(sessionId, turnId)`。    - 随后 `tryAcquireSessionTurnLease` 执行 `INSERT ... ON CONFLICT(session_id, client_id) DO NOTHING`，因上次已落盘的租约行存在，返回 `changes === 0`。    - 进入恢复分支读取持久化租约并调用 `clearRecoverableLease`：由于 
  **Post-Mortem & Fix Analysis**:
  > **判断：** 队首消息没有丢失，但一次数据库超时后，即使再次发送，它仍可能无法开始。[#12828 的连续日志](https://github.com/makecindy/cindy/issues/12828#issuecomment-7164426261)记录了 0.1.146 的同一次故障：`tx` 请求 `254547` 等待 30.145 秒后报错，消息退回队首；约两分钟后，同一会话、同一条消息重试，报错变为 `could not replace the previous turn lease`。这证实了先后顺序；`DB_TRANSPORT_OUTCOME_UNKNOWN` 本身既不证明提交，也不证明回滚。  **行动：** 建议 FicoHub 接续 #12800 的租约诊断，在 `sessionTurnLease.test.ts` 的临时 SQLite 夹具上补一个可重复的队列续发用例：沿本地 Claude Code 会话上一轮结束后的发送入口，让第一次 `message.leaseMutate(insert)` 真正提交，再只向调用方返回结果未知。用 `readPersistedSessionTurnLeases` 只读核对该行，然后让同一 Session 在同一进程重试原队首，不手工换号。记录两次 `turnId` 是否相同、重试的 `reason` 和 provider 派发次数；不需要用户数据库或消息正文。  main `dadf5bc5` 的代码支持这个假设：未派发时 `dispatchSend` 会回滚代次；重试时，[租约跟踪器](https://github.com/makecindy/cindy/blob/dadf5bc5e443ef9c775a232a239e1fbe85259f7b/apps/desktop/src/main/maker-ipc/sessionTurnLease.ts#L320-L390)先把待获取的 ID 记为活跃，再检查库中同号的行，因此可能把上次留下的行误认作正在运行的轮次。没有活跃标记时，已有 `isTurnActive` 路径可以回收本进程的旧行，所以不能据此断言重启是唯一恢复方式。已合并的 #12806 只增加本地原因日志；其同号冲突测试用**不同 ID** 重试成功，未覆盖这里的同号重试。  若用例得到
  > 我来接手租约重试这一项。先用临时 SQLite 验证写入已提交、调用方收到结果未知时，同进程重试原队首是否会自锁。修复会验证原消息只派发一次，以及迟到的结束事件不会清掉后继租约。

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

### Incident Patch 1: `b0bd3858` (2026-11-26)
**Commit Message**: fix(desktop): reconcile the two empty-550 error notices

#12967 and #12970 both addressed #12924 and landed on main within minutes.
#12970's generic upstream 5xx notice ("上游返回 550，本次回复未完成。") is
checked before #12967's exact-550 reason key, so the 550 cases in
ErrorLocalization.test.tsx fail on main (unit shard 1/8, Linux and Windows).

Keep #12970's behaviour: any message naming a 5xx status code gets the
upstream-status notice on both the live banner and the history card. Remove
#12967's now-unreachable upstreamEmpty550 reason and its locale strings, and
update its test to expect the upstream-status notice; the dispatch-refusal
case is unchanged.

Assisted-by: Cindy (https://cindy.app)
Signed-off-by: DavidShen <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/renderer/components/chat/__tests__/ErrorLocalization.test.tsx` (modified, +8/-5)
```diff
@@ -42,14 +42,17 @@ const raw = JSON.stringify({ error: {
 } });
 afterEach(cleanup);
 
-// #12924, unit: the live and historical notices distinguish the observed
-// empty HTTP 550 from ordinary failures, while preserving the dispatch refusal.
+// #12924, unit: the live and historical notices name an upstream 5xx status —
+// the exact empty HTTP 550 and any other message naming "550 status code" get
+// the same upstream-status notice (#12970) — while the dispatch refusal keeps
+// its own "not sent" text.
+const upstream550 = zhCN.chat.errorBanner.upstreamStatusError.replace('{{status}}', '550');
 it.each([
-  ['550 status code (no body)', '模型服务返回 HTTP 550（无响应内容）'],
-  ['ordinary failure mentioning 550 status code (no body)', zhCN.chat.errorBanner.replyFailed],
+  ['550 status code (no body)', upstream550],
+  ['ordinary failure mentioning 550 status code (no body)', upstream550],
   ['provider-rejected-before-dispatch: Provider rejected the Session send before dispatch: SEND/task/send',
     zhCN.chat.errorBanner.messageNotSent],
-])('localizes the exact empty upstream 550 without changing other errors (%s)', async (message, expected) => {
+])('names the upstream 5xx status and keeps the dispatch refusal (%s)', async (message, expected) => {
   const i18n = createInstance();
   await i18n.init({ lng: 'zh-CN', resources: { 'zh-CN': { translation: zhCN } } });
   const { rerender } = render(<I18nextProvider i18n={i18n}>
```

**File**: `apps/desktop/src/renderer/components/chat/errorReasonI18n.ts` (modified, +0/-3)
```diff
@@ -77,8 +77,5 @@ export function errorReasonI18nKey(reason: string | null | undefined, message: s
   if (isProviderSafetyRefusalError(message, reason)) {
     return 'chat.errorBanner.providerSafetyRefusal';
   }
-  if (!reason && /^550 status code \(no body\)$/i.test(message.trim())) {
-    return 'chat.errorBanner.upstreamEmpty550';
-  }
   return reason ? ERROR_REASON_I18N_KEYS[reason] : undefined;
 }
```

**File**: `apps/desktop/src/renderer/i18n/locales/de/common.json` (modified, +0/-1)
```diff
@@ -15650,7 +15650,6 @@
       "piRetryHistoryUnavailable": "Deine Nachricht wurde nicht gesendet. Pi konnte den Verlauf, der zum Senden nötig ist, nicht lesen. Du kannst es erneut versuchen oder in einer neuen Aufgabe fortfahren.",
       "upstreamStatusError": "Der vorgeschaltete Dienst hat {{status}} zurückgegeben – die Antwort konnte nicht abgeschlossen werden.",
       "messageNotSent": "Deine Nachricht wurde nicht gesendet.",
-      "upstreamEmpty550": "Der Modelldienst hat HTTP 550 ohne Antwortinhalt zurückgegeben",
       "replyFailed": "Antwort konnte nicht abgeschlossen werden",
       "queuedSendRecovery": "Deine Nachricht wurde nicht gesendet. Wähle „Erneut versuchen“, um sie unverändert zu senden. Eine neue Nachricht ersetzt sie.",
       "retryTitle": "Letzte Nachricht erneut senden",
```

**File**: `apps/desktop/src/renderer/i18n/locales/en/common.json` (modified, +0/-1)
```diff
@@ -15687,7 +15687,6 @@
       "piRetryHistoryUnavailable": "Your message was not sent. Pi could not read the history needed to send it. You can retry, or continue in a new task.",
       "upstreamStatusError": "The upstream returned {{status}}, so this reply is incomplete.",
       "messageNotSent": "Your message was not sent.",
-      "upstreamEmpty550": "The model service returned HTTP 550 with an empty response",
       "replyFailed": "Could not complete the reply",
       "queuedSendRecovery": "Your message wasn’t sent. Select Retry to send it as is. Sending a new message will replace it.",
       "retryTitle": "Resend the last message",
```

**File**: `apps/desktop/src/renderer/i18n/locales/es/common.json` (modified, +0/-1)
```diff
@@ -15786,7 +15786,6 @@
       "piRetryHistoryUnavailable": "Tu mensaje no se envió. Pi no pudo leer el historial necesario para enviarlo. Puedes volver a intentarlo o continuar en una tarea nueva.",
       "upstreamStatusError": "El proveedor devolvió {{status}}, por lo que la respuesta no pudo completarse.",
       "messageNotSent": "Tu mensaje no se envió.",
-      "upstreamEmpty550": "El servicio del modelo devolvió HTTP 550 con una respuesta vacía",
       "replyFailed": "No se pudo completar la respuesta",
       "queuedSendRecovery": "Tu mensaje no se envió. Selecciona «Reintentar» para enviarlo tal cual. Si envías un mensaje nuevo, reemplazará al anterior.",
       "retryTitle": "Reenviar el último mensaje",
```

**File**: `apps/desktop/src/renderer/i18n/locales/fr/common.json` (modified, +0/-1)
```diff
@@ -15786,7 +15786,6 @@
       "piRetryHistoryUnavailable": "Message non envoyé. Pi n’a pas pu lire l’historique nécessaire à l’envoi. Vous pouvez réessayer ou continuer dans une nouvelle tâche.",
       "upstreamStatusError": "Le service en amont a renvoyé {{status}} ; la réponse n’a pas pu aboutir.",
       "messageNotSent": "Message non envoyé.",
-      "upstreamEmpty550": "Le service du modèle a renvoyé HTTP 550 avec une réponse vide",
       "replyFailed": "Impossible de terminer la réponse",
       "queuedSendRecovery": "Ton message n’a pas été envoyé. Sélectionne « Réessayer » pour le renvoyer tel quel. Si tu envoies un nouveau message, il remplacera le précédent.",
       "retryTitle": "Renvoyer le dernier message",
```

**File**: `apps/desktop/src/renderer/i18n/locales/ja/common.json` (modified, +0/-1)
```diff
@@ -15621,7 +15621,6 @@
       "piRetryHistoryUnavailable": "メッセージは送信されませんでした。Pi が送信に必要な履歴を読み込めませんでした。再試行するか、新しいタスクで続けてください。",
       "upstreamStatusError": "上流が {{status}} を返したため、この返信は完了しませんでした。",
       "messageNotSent": "メッセージは送信されませんでした。",
-      "upstreamEmpty550": "モデルサービスが空の応答で HTTP 550 を返しました",
       "replyFailed": "返信を完了できませんでした",
       "queuedSendRecovery": "直前のメッセージは送信されていません。「再試行」でそのまま送信できます。新しいメッセージを送ると、直前のメッセージは置き換わります。",
       "retryTitle": "最後のメッセージを再送信",
```

**File**: `apps/desktop/src/renderer/i18n/locales/ko/common.json` (modified, +0/-1)
```diff
@@ -15621,7 +15621,6 @@
       "piRetryHistoryUnavailable": "메시지를 보내지 못했습니다. Pi가 전송에 필요한 기록을 읽지 못했습니다. 다시 시도하거나 새 작업에서 계속할 수 있습니다.",
       "upstreamStatusError": "상위 서비스가 {{status}}를 반환하여 이 답변이 완료되지 않았습니다.",
       "messageNotSent": "메시지를 보내지 못했습니다.",
-      "upstreamEmpty550": "모델 서비스에서 빈 응답과 함께 HTTP 550을 반환했어요",
       "replyFailed": "답변을 완료하지 못했습니다",
       "queuedSendRecovery": "이전 메시지가 전송되지 않았습니다. ‘다시 시도’를 누르면 그대로 보낼 수 있습니다. 새 메시지를 보내면 이전 메시지를 대체합니다.",
       "retryTitle": "마지막 메시지 다시 보내기",
```

---

### Incident Patch 2: `eb65da3d` (2026-11-26)
**Commit Message**: Merge pull request #13038 from nothingyuancando/codex/fix-12427-nginx-diagnostics

fix(relay): locate nginx configuration parse failures

**File**: `packages/device-link-relay/src/__tests__/nginx.test.ts` (modified, +17/-0)
```diff
@@ -150,6 +150,23 @@ beforeEach(() => {
 });
 afterEach(() => vi.unstubAllGlobals());
 
+// #12427 diagnostic follow-up: real prepare entry; existing quote tests only cover successful parsing.
+// Unit: included-file syntax failures must identify their source without returning argument values.
+it.each([
+  ['# header\r\nserver {\r\n  proxy_set_header Authorization private-test-token\r\n}', 'Invalid Nginx directive', 3, 3, 'proxy_set_header'],
+  ['# header\nserver {\n  set $secret "private-test-token', 'Invalid Nginx token', 3, 15, null],
+  ['# header\nserver {\n  set $secret ${private-test-token', 'Unclosed Nginx variable', 3, 15, null],
+  ['# header\nserver {\n  set $secret private-test-token;', 'Unclosed Nginx block', 2, 1, 'server'],
+] as const)('reports safe source coordinates for %s', (source, reason, line, column, directive) => {
+  h.files.set(site, source);
+  let message = '';
+  try { prepare(); } catch (error) { message = (error as Error).message; }
+  expect(message).toContain(`${reason} at ${JSON.stringify(site)}:${line}:${column}`);
+  if (directive) expect(message).toContain(`(directive: ${directive})`);
+  expect(message).not.toContain('private-test-token');
+  expect(h.signals).toEqual([]);
+});
+
 it('preserves quoted log format delimiters before a server in an included file (#12427)', () => {
   const format = `log_format site_total escape=json '{' # comment with }
     '"uri":"$request_uri"' "}" ";";\n`;
```

**File**: `packages/device-link-relay/src/nginx.ts` (modified, +16/-6)
```diff
@@ -47,6 +47,16 @@ export interface NginxPlan {
 /** 解析语法与位置，不用正则改写任意 Nginx 配置；引号、注释、变量与嵌套块分别处理。 */
 function parse(file: string, source: string): Directive[] {
   const tokens: Array<{ kind: 'word' | '{' | '}' | ';'; value: string; start: number; end: number }> = [];
+  // Diagnostics contain coordinates and a plain directive name, never arguments
+  // (which may contain authorization headers or other private configuration).
+  const fail = (reason: string, offset: number, directive?: string): never => {
+    const prefix = source.slice(0, offset);
+    const line = prefix.split('\n').length;
+    const column = offset - prefix.lastIndexOf('\n');
+    const name = directive && /^[a-z_][a-z0-9_]{0,63}$/i.test(directive)
+      ? ` (directive: ${directive})` : '';
+    throw new Error(`${reason} at ${JSON.stringify(file)}:${line}:${column}${name}`);
+  };
   let i = 0;
   while (i < source.length) {
     if (/\s/.test(source[i])) {
@@ -85,7 +95,7 @@ function parse(file: string, source: string): Directive[] {
       }
       if (c === '$' && source[i + 1] === '{') {
         const end = source.indexOf('}', i + 2);
-        if (end < 0) throw new Error('Unclosed Nginx variable');
+        if (end < 0) fail('Unclosed Nginx variable', i);
         value += source.slice(i, end + 1);
         i = end + 1;
         continue;
@@ -94,18 +104,18 @@ function parse(file: string, source: string): Directive[] {
       value += c;
       i++;
     }
-    if (quote || i === start) throw new Error('Invalid Nginx token');
+    if (quote || i === start) fail('Invalid Nginx token', start);
     tokens.push({ kind: 'word', value, start, end: i });
   }
   let cursor = 0;
-  function block(nested: boolean): Directive[] {
+  function block(nested: boolean, opening?: { start: number; value: string }): Directive[] {
     const nodes: Directive[] = [];
     while (cursor < tokens.length && tokens[cursor].kind !== '}') {
       const first = tokens[cursor++];
       const args: string[] = [];
       while (cursor < tokens.length && tokens[cursor].kind === 'word') args.push(tokens[cursor++].value);
       const delimiter = tokens[cursor++];
-      if (!delimiter || delimiter.kind === '}') throw new Error('Invalid Nginx directive');
+      if (!delimiter || delimiter.kind === '}') fail('Invalid Nginx directive', first.start, first.value);
       const node: Directive = {
         file,
         name: first.value,
@@ -115,12 +125,12 @@ function parse(file: string, source: string): Directive[] {
       };
       if (delimiter.kind === '{') {
         node.open = delimiter.end;
-        node.children = block(true);
+        node.children = block(true, first);
         node.end = tokens[cursor - 1].end;
       }
       nodes.push(node);
     }
-    if (nested && tokens[cursor++]?.kind !== '}') throw new Error('Unclosed Nginx block');
+    if (nested && tokens[cursor++]?.kind !== '}') fail('Unclosed Nginx block', opening?.start ?? source.length, opening?.value);
     return nodes;
   }
   return block(false);
```

---

### Incident Patch 3: `450374a2` (2026-11-26)
**Commit Message**: Merge pull request #13023 from makecindy/feat/linux-remote-cursor

feat(remote-desktop): Linux 被控端用本机鼠标显示远端光标，GNOME Wayland 支持控制，被控提示只用桌面浮窗

**File**: `apps/desktop/forge.config.ts` (modified, +6/-0)
```diff
@@ -1126,6 +1126,12 @@ function buildRemoteDesktopInput(platform: ForgePlatform, arch: ForgeArch): void
         path.join(temporary, 'cindy-linux-desktop-capture'),
         path.join(destDir, 'cindy-linux-desktop-capture'),
       );
+      // Optional GNOME (Mutter/PipeWire) capture: builders without its headers
+      // skip it, and must not ship an earlier checkout's binary instead.
+      const gnomeCapture = path.join(destDir, 'cindy-linux-gnome-capture');
+      fs.rmSync(gnomeCapture, { force: true });
+      if (fs.existsSync(path.join(temporary, 'cindy-linux-gnome-capture')))
+        fs.copyFileSync(path.join(temporary, 'cindy-linux-gnome-capture'), gnomeCapture);
       const clipboard = spawnSync(
         process.execPath,
         [
```

**File**: `apps/desktop/native/remote-desktop/linux-capture/build.mjs` (modified, +54/-7)
```diff
@@ -12,6 +12,14 @@ function run(command, args) {
     throw new Error(`Linux capture build failed: ${command}: ${result.stderr || result.error}`);
   return result.stdout.trim();
 }
+/** pkg-config flags, or null when a development package is absent. */
+function optional(...packages) {
+  const result = spawnSync('pkg-config', ['--cflags', '--libs', ...packages], {
+    encoding: 'utf8',
+    timeout: 60000,
+  });
+  return result.status === 0 ? result.stdout.trim().split(/\s+/).filter(Boolean) : null;
+}
 const protocols = [
   'wlr-screencopy-unstable-v1',
   'ext-image-copy-capture-v1',
@@ -30,27 +38,66 @@ for (const name of protocols) {
     path.join(output, name + '.c'),
   ]);
 }
-const flags = run('pkg-config', [
-  '--cflags',
-  '--libs',
-  'wayland-client',
-  'libturbojpeg',
-  'libpng',
-]).split(/\s+/);
+const flags = run('pkg-config', ['--cflags', '--libs', 'wayland-client', 'libpng']).split(/\s+/);
+// X11 capture needs XFIXES for the separate cursor; MIT-SHM (libXext) only
+// speeds it up. Builders without these headers keep the Wayland helper and
+// report X11 capture unavailable at runtime.
+const x11 = optional('x11', 'xfixes');
+const shm = x11 && optional('xext');
+// Composite lets X11 capture keep Cindy's local-only notice out of the picture
+// (x11.h). Without it the helper refuses such captures, and the notice stays off.
+const composite = x11 && optional('xcomposite');
 const binary = path.join(output, 'cindy-linux-desktop-capture');
 run('cc', [
   '-std=c11',
   '-Wall',
   '-Wextra',
   '-Werror',
   '-O2',
+  ...(x11 ? ['-DCINDY_X11'] : []),
+  ...(shm ? ['-DCINDY_XSHM'] : []),
+  ...(composite ? ['-DCINDY_XCOMPOSITE'] : []),
   path.join(source, 'main.c'),
   ...protocols.map((name) => path.join(output, name + '.c')),
   '-I',
   output,
   ...flags,
+  ...(x11 ?? []),
+  ...(shm ?? []),
+  ...(composite ?? []),
   '-lm',
+  // JPEG backends are loaded at runtime (jpeg.h); none is a link dependency.
+  '-ldl',
   '-o',
   binary + '.tmp',
 ]);
 fs.renameSync(binary + '.tmp', binary);
+
+// GNOME (Mutter) capture is a separate binary so a missing PipeWire library
+// can never stop the Wayland/X11 helper above from loading.
+const gnome = path.join(output, 'cindy-linux-gnome-capture');
+fs.rmSync(gnome, { force: true });
+const gnomeFlags = optional('gio-2.0', 'libpipewire-0.3', 'xcursor', 'libpng');
+if (gnomeFlags) {
+  run('cc', [
+    '-std=gnu11',
+    '-Wall',
+    '-Wextra',
+    '-Werror',
+    // PipeWire's inline SPA helpers trip these in their own headers.
+    '-Wno-missing-field-initializers',
+    '-Wno-unused-parameter',
+    '-O2',
+    path.join(source, 'gnome.c'),
+    ...gnomeFlags,
+    '-lm',
+    '-ldl',
+    '-o',
+    gnome + '.tmp',
+  ]);
+  fs.renameSync(gnome + '.tmp', gnome);
+} else {
+  console.warn(
+    'Linux capture: GNOME capture skipped (gio-2.0, libpipewire-0.3 or xcursor missing)',
+  );
+}
```

**File**: `apps/desktop/native/remote-desktop/linux-capture/cursor_shape.h` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+/* Map an X cursor-theme name onto the viewer's standard shape keywords.
+ * Toolkits name cursors either with CSS names (GTK, Chromium) or legacy X
+ * cursor-font names (Qt, Xt, window managers). Unknown and unnamed cursors
+ * return NULL so the viewer keeps its local arrow. */
+#ifndef CINDY_CURSOR_SHAPE_H
+#define CINDY_CURSOR_SHAPE_H
+#include <stddef.h>
+#include <string.h>
+
+#define CURSOR_SHAPE_NAMES 12
+static const struct {
+  const char *shape;
+  const char *names[CURSOR_SHAPE_NAMES];
+} cursor_shapes[] = {
+    {"default", {"default", "left_ptr", "arrow", "top_left_arrow",
+                 "left_arrow", "right_ptr", "draft_large", "draft_small"}},
+    {"text", {"text", "xterm", "ibeam"}},
+    {"vertical-text", {"vertical-text"}},
+    {"pointer", {"pointer", "hand", "hand1", "hand2", "pointing_hand"}},
+    {"crosshair",
+     {"crosshair", "cross", "tcross", "cross_reverse", "diamond_cross",
+      "cell", "plus", "target", "dotbox"}},
+    {"grab", {"grab", "openhand", "hand_open"}},
+    {"grabbing", {"grabbing", "closedhand", "hand_closed", "dnd-none"}},
+    {"move", {"move", "fleur", "all-scroll", "size_all", "dnd-move"}},
+    {"ew-resize",
+     {"ew-resize", "col-resize", "e-resize", "w-resize", "sb_h_double_arrow",
+      "h_double_arrow", "size_hor", "split_h", "right_side", "left_side"}},
+    {"ns-resize",
+     {"ns-resize", "row-resize", "n-resize", "s-resize", "sb_v_double_arrow",
+      "v_double_arrow", "size_ver", "split_v", "top_side", "bottom_side"}},
+    {"nwse-resize",
+     {"nwse-resize", "nw-resize", "se-resize", "size_fdiag",
+      "bd_double_arrow", "top_left_corner", "bottom_right_corner"}},
+    {"nesw-resize",
+     {"nesw-resize", "ne-resize", "sw-resize", "size_bdiag",
+      "fd_double_arrow", "top_right_corner", "bottom_left_corner"}},
+    {"not-allowed",
+     {"not-allowed", "no-drop", "dnd-no-drop", "forbidden", "crossed_circle",
+      "circle", "pirate", "X_cursor"}},
+    {"copy", {"copy", "dnd-copy"}},
+    {"alias", {"alias", "dnd-link", "link"}},
+    {"wait", {"wait", "watch"}},
+    {"progress", {"progress", "left_ptr_watch", "half-busy"}},
+    {"help", {"help", "question_arrow", "whats_this", "left_ptr_help",
+              "dnd-ask"}},
+};
+#define CURSOR_SHAPE_COUNT (sizeof(cursor_shapes) / sizeof(cursor_shapes[0]))
+__attribute__((unused)) static const char *cursor_shape_for_name(const char *name) {
+  if (!name || !*name)
+    return NULL;
+  for (size_t i = 0; i < CURSOR_SHAPE_COUNT; i++)
+    for (size_t j = 0; j < CURSOR_SHAPE_NAMES && cursor_shapes[i].names[j]; j++)
+      if (!strcmp(name, cursor_shapes[i].names[j]))
+        return cursor_shapes[i].shape;
+  return NULL;
+}
+#endif
```

**File**: `apps/desktop/native/remote-desktop/linux-capture/encode.h` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+/* Bounded encoders shared by the X11 and GNOME backends: base64 text for the
+ * line protocol, a PNG cursor raster, and the 1920-pixel video downscale. */
+#ifndef CINDY_CAPTURE_ENCODE_H
+#define CINDY_CAPTURE_ENCODE_H
+#include <png.h>
+#include <stddef.h>
+#include <stdint.h>
+#include <stdlib.h>
+
+static char *cindy_base64(const unsigned char *bytes, size_t length) {
+  static const char abc[] =
+      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
+  char *out = malloc(4 * ((length + 2) / 3) + 1);
+  if (!out)
+    return NULL;
+  size_t j = 0;
+  for (size_t i = 0; i < length; i += 3) {
+    uint32_t n = (uint32_t)bytes[i] << 16;
+    if (i + 1 < length)
+      n |= (uint32_t)bytes[i + 1] << 8;
+    if (i + 2 < length)
+      n |= bytes[i + 2];
+    out[j++] = abc[n >> 18];
+    out[j++] = abc[(n >> 12) & 63];
+    out[j++] = i + 1 < length ? abc[(n >> 6) & 63] : '=';
+    out[j++] = i + 2 < length ? abc[n & 63] : '=';
+  }
+  out[j] = 0;
+  return out;
+}
+/* Straight (non-premultiplied) RGBA to base64 PNG. The 48 KiB bound keeps
+ * the text within the cursor protocol's 64 KiB limit. */
+static char *cindy_png_base64(const unsigned char *rgba, int width,
+                              int height) {
+  png_image image = {.version = PNG_IMAGE_VERSION,
+                     .width = (png_uint_32)width,
+                     .height = (png_uint_32)height,
+                     .format = PNG_FORMAT_RGBA};
+  char *result = NULL;
+  png_alloc_size_t size = 0;
+  if (width > 0 && height > 0 && width <= 256 && height <= 256 &&
+      png_image_write_to_memory(&image, NULL, &size, 0, rgba, 0, NULL) &&
+      size <= 49152) {
+    unsigned char *png = malloc(size);
+    if (png && png_image_write_to_memory(&image, png, &size, 0, rgba, 0, NULL))
+      result = cindy_base64(png, size);
+    free(png);
+  }
+  png_image_free(&image);
+  return result;
+}
+/* Premultiplied 8-bit channel to straight alpha. */
+static unsigned char cindy_unpremultiply(unsigned value, unsigned alpha) {
+  if (!alpha)
+    return 0;
+  unsigned v = (value * 255 + alpha / 2) / alpha;
+  return (unsigned char)(v > 255 ? 255 : v);
+}
+/* Match the normal desktop video's 1920-pixel long-edge cap before IPC and
+ * decoding. Bilinear sampling preserves aspect ratio and supports padded
+ * rows. *scratch is allocated once (1920x1920x4) and reused by the caller. */
+static const unsigned char *cindy_scale_pixels(const unsigned char *pixels,
+                                               uint32_t source_width,
+                                               uint32_t source_height,
+                                               uint32_t source_stride,
+                                               unsigned char **scratch,
+                                               int *width, int *height,
+                                               int *stride) {
+  *width = (int)source_width;
+  *height = (int)source_height;
+  *stride = (int)source_stride;
+  uint32_t edge = source_width > source_height ? source_width : source_height;
+  if (edge <= 1920)
+    return pixels;
+  *width = (int)(source_width * 1920 / edge);
+  *height = (int)(source_height * 1920 / edge);
+  if (*width < 1)
+    *width = 1;
+  if (*height < 1)
+    *height = 1;
+  *stride = *width * 4;
+  if (!*scratch)
+    *scratch = malloc(1920 * 1920 * 4);
+  if (!*scratch)
+    return NULL;
+  uint32_t xs[1920], weights[1920];
+  for (int x = 0; x < *width; x++) {
+    uint32_t pos =
+        *width > 1
+            ? (uint32_t)((uint64_t)x * (source_width - 1) * 256 / (*width - 1))
+            : 0;
+    xs[x] = pos >> 8;
+    weights[x] = pos & 255;
+  }
+  for (int y = 0; y < *height; y++) {
+    uint32_t pos = *height > 1 ? (uint32_t)((uint64_t)y * (source_height - 1) *
+                                            256 / (*height - 1))
+                               : 0;
+    uint32_t sy = pos >> 8, wy = pos & 255;
+    uint32_t next = sy + 1 < source_height ? sy + 1 : sy;
+    const unsigned char *a = pixels + (size_t)sy * source_stride;
+    const unsigned char *b = pixels + (size_t)next * source_stride;
+    unsigned char *dest = *scratch + (size_t)y * (size_t)*stride;
+    for (int x = 0; x < *width; x++) {
+      uint32_t sx = xs[x], wx = weights[x],
+               nx = sx + 1 < source_width ? sx + 1 : sx;
+      for (int channel = 0; channel < 3; channel++) {
+        uint32_t top =
+            a[sx * 4 + channel] * (256 - wx) + a[nx * 4 + channel] * wx;
+        uint32_t bottom =
+            b[sx * 4 + channel] * (256 - wx) + b[nx * 4 + channel] * wx;
+        dest[x * 4 + channel] =
+            (unsigned char)((top * (256 - wy) + bottom * wy + 32768) >> 16);
+      }
+      dest[x * 4 + 3] = 255;
+    }
+  }
+  return *scratch;
+}
+#endif
```

**File**: `apps/desktop/native/remote-desktop/linux-capture/gnome-test.py` (added, +224/-0)
```diff
@@ -0,0 +1,224 @@
+"""Explicit GNOME (Mutter) Wayland integration test:
+    python3 gnome-test.py <gnome-capture-helper> <input-helper>
+Requires gnome-shell (46+), dbus-daemon, a running user PipeWire, python3-gi
+and gdk-pixbuf. Starts its own headless GNOME Shell on a private session bus,
+so it never records or drives the user's real desktop.
+
+Covers: probes without creating a session, monitor enumeration, cursor-free
+monitor video (with an embedded-cursor control that must differ), cursor
+position/hotspot/shape from stream metadata, absolute pointer input, keyboard
+text, Chinese text pasted through the clipboard with the user's clipboard
+restored (also after the helper exits), wheel, clean EOF teardown of both
+helpers, and helper exit when the compositor goes away.
+"""
+import base64
+import ctypes as C
+import json
+import os
+from pathlib import Path
+import subprocess
+import sys
+import tempfile
+import threading
+import time
+
+from gi.repository import Gio, GLib
+
+GP = C.CDLL('libgdk_pixbuf-2.0.so.0')
+def api(name, result, args):
+    f = getattr(GP, name); f.restype = result; f.argtypes = args; return f
+api('gdk_pixbuf_new_from_file', C.c_void_p, [C.c_char_p, C.c_void_p])
+for name in ('width', 'height', 'rowstride', 'n_channels'):
+    api('gdk_pixbuf_get_' + name, C.c_int, [C.c_void_p])
+api('gdk_pixbuf_get_pixels', C.POINTER(C.c_ubyte), [C.c_void_p])
+api('g_object_unref', None, [C.c_void_p])
+
+capture_binary, input_binary = (str(Path(p).resolve()) for p in sys.argv[1:3])
+with tempfile.TemporaryDirectory(prefix='cindy-gnome-test-') as temp:
+    bus = subprocess.Popen(['dbus-daemon', '--session', '--nofork', '--print-address=1'],
+                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
+    address = bus.stdout.readline().strip()
+    display = 'cindy-test-%d' % os.getpid()
+    env = {**os.environ, 'DBUS_SESSION_BUS_ADDRESS': address, 'XDG_SESSION_TYPE': 'wayland',
+           'XDG_CURRENT_DESKTOP': 'GNOME', 'WAYLAND_DISPLAY': display}
+    env.pop('DISPLAY', None)
+    shell = subprocess.Popen(['gnome-shell', '--headless', '--wayland', '--no-x11',
+                              '--virtual-monitor', '1280x800', '--wayland-display', display],
+                             env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
+    helpers = []
+    try:
+        connection = Gio.DBusConnection.new_for_address_sync(
+            address, Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT |
+            Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION, None, None)
+        deadline = time.monotonic() + 20
+        while time.monotonic() < deadline:
+            owned = connection.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus',
+                                         'org.freedesktop.DBus', 'NameHasOwner',
+                                         GLib.Variant('(s)', ('org.gnome.Mutter.RemoteDesktop',)),
+                                         None, 0, -1, None).unpack()[0]
+            if owned: break
+            time.sleep(0.2)
+        assert owned, 'headless GNOME Shell did not start'
+        time.sleep(2)  # let the shell finish its startup animation
+
+        for args in ([capture_binary, '--check'], [input_binary, '--gnome', '--check']):
+            result = subprocess.run(args, env=env, capture_output=True, timeout=5)
+            assert result.returncode == 0 and result.stdout == b'ready\n', (args, result)
+        x11 = subprocess.run([capture_binary, '--check'], capture_output=True, timeout=5,
+                             env={**env, 'XDG_SESSION_TYPE': 'x11', 'WAYLAND_DISPLAY': ''})
+        assert x11.returncode != 0 and not x11.stdout, 'X11 session probe accepted'
+        monitors = json.loads(subprocess.run([capture_binary, '--monitors'], env=env,
+                                             capture_output=True, timeout=5).stdout)
+        assert len(monitors) == 1 and monitors[0]['width'] == 1280 and monitors[0]['height'] == 800, monitors
+        connector = monitors[0]['id']
+        for bad in ('gnome:', 'gnome:a b', 'gnome:../x', 'hyprland:Meta-0'):
+            result = subprocess.run([capture_binary, 'cursor-overlay', '1', '65', bad], env=env,
+                                    input=b'f', capture_output=True, timeout=5)
+            assert result.returncode == 2 and not result.stdout, (bad, result)
+
+        # Another application's clipboard, which pasting must leave in place.
+        RD = 'org.gnome.Mutter.RemoteDesktop'; RDS = RD + '.Session'
+        def rd(path, iface, method, args=None, fds=None):
+            if fds is not None:
+                return connection.call_with_unix_fd_list_sync(RD, path, iface, method, args,
+                                                              None, 0, -1, fds, None)
+            return connection.call_sync(RD, path, iface, method, args, None, 0, -1, None)
+        owner = rd('/org/gnome/Mutter/RemoteDesktop', RD, 'CreateSession').unpack()[0]
+        rd(
```

**File**: `apps/desktop/native/remote-desktop/linux-capture/gnome.c` (added, +819/-0)
```diff
@@ -0,0 +1,819 @@
+/* GNOME Shell (Mutter) Wayland capture without the portal picker.
+ *
+ * Mutter's own org.gnome.Mutter.ScreenCast API records one monitor into a
+ * PipeWire stream in the logged-in user's session; GNOME shows its usual
+ * screen-sharing indicator while it runs. The cursor travels as PipeWire
+ * metadata instead of pixels, so the video is cursor-free. Wayland never
+ * exposes cursor names: the shape hint comes from matching the cursor raster
+ * against the user's configured cursor theme.
+ *
+ * Same private, serial protocol as cindy-linux-desktop-capture: one 'f'
+ * request, one bounded line (base64 JPEG, or a JSON frame with the cursor).
+ * The latest frame is kept in memory only; no files, sockets or history.
+ *
+ *   --check            interfaces present, PipeWire and JPEG usable; no session
+ *   --monitors         JSON list of logical monitors (connector, geometry)
+ *   video|cursor-overlay <scale> <quality> gnome:<connector>
+ */
+#define _GNU_SOURCE
+#include "cursor_shape.h"
+#include "encode.h"
+#include "jpeg.h"
+#include <gio/gio.h>
+#include <math.h>
+#include <pipewire/pipewire.h>
+#include <poll.h>
+#include <signal.h>
+#include <spa/buffer/meta.h>
+#include <spa/param/video/format-utils.h>
+#include <stdio.h>
+#include <stdlib.h>
+#include <string.h>
+#include <unistd.h>
+/* Last: Xlib's macros (Status, Bool, None) must not reach GLib or SPA. */
+#include <X11/Xcursor/Xcursor.h>
+
+#define SCREEN_CAST "org.gnome.Mutter.ScreenCast"
+#define SCREEN_CAST_PATH "/org/gnome/Mutter/ScreenCast"
+#define SCREEN_CAST_SESSION "org.gnome.Mutter.ScreenCast.Session"
+#define CURSOR_META_SIZE(w, h)                                                 \
+  (sizeof(struct spa_meta_cursor) + sizeof(struct spa_meta_bitmap) +           \
+   (size_t)(w) * (h) * 4)
+
+static GDBusConnection *bus;
+static struct {
+  char *session;
+  guint node;
+  int closed, failed, overlay, quality, bgrx;
+  double scale;
+  struct pw_loop *loop;
+  struct pw_context *context;
+  struct pw_core *core;
+  struct pw_stream *stream;
+  struct spa_hook stream_listener, core_listener;
+  uint32_t width, height;
+  /* The latest complete frame, tightly packed. */
+  unsigned char *frame, *scaled;
+  size_t frame_size;
+  unsigned long frame_serial, encoded_serial;
+  char *line;
+  /* Latest cursor state from stream metadata. */
+  int cursor_known, cursor_visible, cursor_opaque, cursor_x, cursor_y,
+      cursor_width, cursor_height, hot_x, hot_y;
+  char *cursor_png;
+  const char *cursor_shape;
+} g;
+
+static GVariant *call(const char *name, const char *path, const char *iface,
+                      const char *method, GVariant *args, const char *type) {
+  GError *error = NULL;
+  GVariant *result = g_dbus_connection_call_sync(
+      bus, name, path, iface, method, args, type ? G_VARIANT_TYPE(type) : NULL,
+      G_DBUS_CALL_FLAGS_NONE, 3000, NULL, &error);
+  if (error)
+    g_error_free(error);
+  return result;
+}
+static int valid_connector(const char *name) {
+  size_t n = strlen(name);
+  if (!n || n > 80)
+    return 0;
+  for (size_t i = 0; i < n; i++)
+    if (!(g_ascii_isalnum(name[i]) || name[i] == '_' || name[i] == '.' ||
+          name[i] == '-'))
+      return 0;
+  return 1;
+}
+static void json_string(const char *text) {
+  putchar('"');
+  for (const unsigned char *p = (const unsigned char *)text; *p; p++) {
+    if (*p == '"' || *p == '\\')
+      printf("\\%c", *p);
+    else if (*p < 0x20)
+      printf("\\u%04x", *p);
+    else
+      putchar(*p);
+  }
+  putchar('"');
+}
+
+/* Logical monitors in Mutter's layout. Sizes are logical (desktop points)
+ * in the default logical layout mode; `scale` converts stream pixels. */
+static int print_monitors(void) {
+  GVariant *state = call(
+      "org.gnome.Mutter.DisplayConfig", "/org/gnome/Mutter/DisplayConfig",
+      "org.gnome.Mutter.DisplayConfig", "GetCurrentState", NULL,
+      "(ua((ssss)a(siiddada{sv})a{sv})a(iiduba(ssss)a{sv})a{sv})");
+  if (!state)
+    return 1;
+  GVariant *monitors = g_variant_get_child_value(state, 1);
+  GVariant *logical = g_variant_get_child_value(state, 2);
+  GVariant *properties = g_variant_get_child_value(state, 3);
+  guint32 layout = 1;
+  g_variant_lookup(properties, "layout-mode", "u", &layout);
+  int first = 1, count = 0;
+  putchar('[');
+  for (gsize i = 0; i < g_variant_n_children(logical) && count < 32; i++) {
+    gint32 x, y;
+    gdouble scale;
+    guint32 transform;
+    gboolean primary;
+    GVariant *members, *unused;
+    g_variant_get_child(logical, i, "(iidub@a(ssss)@a{sv})", &x, &y, &scale,
+                        &transform, &primary, &members, &unused);
+    g_variant_unref(unused);
+    const char *connector = NULL;
+    if (g_variant_n_children(members))
+      g_variant_get_child(members, 0, "(&s&s&s&s)", &connector, NULL, NULL,
+                          NULL);
+    /* The first member's current mode sizes a mirrored logical monitor. */
+    gint32 width = 0, height =
```

**File**: `apps/desktop/native/remote-desktop/linux-capture/jpeg.h` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+/* JPEG encoding resolved at runtime. Stock Ubuntu has no libturbojpeg, but
+ * every GTK desktop that runs Electron ships gdk-pixbuf with its system-matched
+ * libjpeg. TurboJPEG stays the fast path wherever it is installed (Arch, the
+ * managed cloud image); gdk-pixbuf keeps the helper usable everywhere else.
+ * Neither backend writes files or keeps frames beyond the call. */
+#ifndef CINDY_CAPTURE_JPEG_H
+#define CINDY_CAPTURE_JPEG_H
+#include <dlfcn.h>
+#include <stddef.h>
+#include <stdint.h>
+#include <stdio.h>
+#include <stdlib.h>
+#include <string.h>
+
+/* TurboJPEG's stable ABI values (turbojpeg.h, unchanged since 1.2). */
+enum {
+  CINDY_TJPF_RGBX = 2,
+  CINDY_TJPF_BGRX = 3,
+  CINDY_TJSAMP_420 = 2,
+  CINDY_TJFLAG_BOTTOMUP = 2,
+  CINDY_TJFLAG_FASTDCT = 2048
+};
+struct jpeg_backend {
+  void *library;
+  void *handle;
+  void *(*tj_init)(void);
+  int (*tj_compress)(void *, const unsigned char *, int, int, int, int,
+                     unsigned char **, unsigned long *, int, int, int);
+  void (*tj_free)(unsigned char *);
+  int (*tj_destroy)(void *);
+  void *(*pixbuf_new)(const unsigned char *, int, int, int, int, int, int,
+                      void *, void *);
+  int (*pixbuf_save)(void *, char **, size_t *, const char *, char **,
+                     char **, void **);
+  void (*object_unref)(void *);
+  void (*error_free)(void *);
+  void (*g_free)(void *);
+  unsigned char *rgb;
+  size_t rgb_size;
+};
+static struct jpeg_backend jb;
+static void *jpeg_symbol(const char *name) {
+  return jb.library ? dlsym(jb.library, name) : NULL;
+}
+/* Libraries stay loaded: gdk-pixbuf registers GObject types and caches its
+ * loaders, neither of which survives dlclose. The helper's exit releases them. */
+static void jpeg_close(void) {
+  if (jb.handle && jb.tj_destroy)
+    jb.tj_destroy(jb.handle);
+  free(jb.rgb);
+  memset(&jb, 0, sizeof(jb));
+}
+static int jpeg_open(void) {
+  if (jb.library)
+    return 0;
+  jb.library = dlopen("libturbojpeg.so.0", RTLD_NOW | RTLD_LOCAL);
+  if (jb.library) {
+    *(void **)&jb.tj_init = jpeg_symbol("tjInitCompress");
+    *(void **)&jb.tj_compress = jpeg_symbol("tjCompress2");
+    *(void **)&jb.tj_free = jpeg_symbol("tjFree");
+    *(void **)&jb.tj_destroy = jpeg_symbol("tjDestroy");
+    if (jb.tj_init && jb.tj_compress && jb.tj_free && jb.tj_destroy &&
+        (jb.handle = jb.tj_init()))
+      return 0;
+    jpeg_close();
+  }
+  /* dlsym on the handle also searches its glib/gobject dependencies. */
+  jb.library = dlopen("libgdk_pixbuf-2.0.so.0", RTLD_NOW | RTLD_LOCAL);
+  if (!jb.library)
+    return -1;
+  *(void **)&jb.pixbuf_new = jpeg_symbol("gdk_pixbuf_new_from_data");
+  *(void **)&jb.pixbuf_save = jpeg_symbol("gdk_pixbuf_save_to_bufferv");
+  *(void **)&jb.object_unref = jpeg_symbol("g_object_unref");
+  *(void **)&jb.error_free = jpeg_symbol("g_error_free");
+  *(void **)&jb.g_free = jpeg_symbol("g_free");
+  if (jb.pixbuf_new && jb.pixbuf_save && jb.object_unref && jb.error_free &&
+      jb.g_free)
+    return 0;
+  jpeg_close();
+  return -1;
+}
+/* Encode 32-bit pixels. `bgrx` selects byte order; `bottom_up` reads rows
+ * upward. On success *out must be released with jpeg_release(). */
+static int jpeg_encode(const unsigned char *pixels, int width, int stride,
+                       int height, int bgrx, int bottom_up, int quality,
+                       unsigned char **out, unsigned long *length) {
+  *out = NULL;
+  *length = 0;
+  if (width <= 0 || height <= 0 || stride < width * 4 || quality < 1 ||
+      quality > 100 || jpeg_open())
+    return -1;
+  if (jb.handle)
+    return jb.tj_compress(jb.handle, pixels, width, stride, height,
+                          bgrx ? CINDY_TJPF_BGRX : CINDY_TJPF_RGBX, out,
+                          length, CINDY_TJSAMP_420, quality,
+                          CINDY_TJFLAG_FASTDCT |
+                              (bottom_up ? CINDY_TJFLAG_BOTTOMUP : 0))
+               ? -1
+               : 0;
+  size_t row = (size_t)width * 3, size = row * (size_t)height;
+  if (size > jb.rgb_size) {
+    unsigned char *next = realloc(jb.rgb, size);
+    if (!next)
+      return -1;
+    jb.rgb = next;
+    jb.rgb_size = size;
+  }
+  int r = bgrx ? 2 : 0, b = bgrx ? 0 : 2;
+  for (int y = 0; y < height; y++) {
+    const unsigned char *source =
+        pixels + (size_t)(bottom_up ? height - 1 - y : y) * (size_t)stride;
+    unsigned char *dest = jb.rgb + (size_t)y * row;
+    for (int x = 0; x < width; x++) {
+      dest[x * 3] = source[x * 4 + r];
+      dest[x * 3 + 1] = source[x * 4 + 1];
+      dest[x * 3 + 2] = source[x * 4 + b];
+    }
+  }
+  /* GDK_COLORSPACE_RGB, no alpha, 8 bits per sample; the pixbuf borrows rgb. */
+  void *pixbuf = jb.pixbuf_new(jb.rgb, 0, 0, 8, width, height, (int)row, NULL,
+                               NULL);
+  if (!pixbuf)
+    return -1;
+  char value[4];
+  snprintf(value, sizeof(value), "%d", quality);
+  char *keys[] = {"quality", NULL}, *va
```

**File**: `apps/desktop/native/remote-desktop/linux-capture/main.c` (modified, +129/-79)
```diff
@@ -1,20 +1,26 @@
 #define _GNU_SOURCE
 #include "cursor.h"
+#include "encode.h"
+#include "jpeg.h"
 #include "wlr-screencopy-unstable-v1.h"
+#ifdef CINDY_X11
+#include "x11.h"
+#endif
 #include <errno.h>
 #include <signal.h>
 #include <stdint.h>
 #include <stdio.h>
 #include <stdlib.h>
 #include <string.h>
 #include <sys/mman.h>
-#include <turbojpeg.h>
 #include <unistd.h>
 #include <wayland-client.h>
 
 /* Private, serial protocol: one 'f' request, one bounded base64 JPEG line.
  * The connection and shm buffer survive requests, but no frame history does.
  * Unsupported output layouts exit so the parent can use grim's composition.
+ * An `x11:<x>,<y>,<width>,<height>` output selects root-window capture of that
+ * pixel rectangle on an X11 session instead (see x11.h).
  */
 struct output_info {
   struct wl_output *output;
@@ -34,7 +40,7 @@ struct capture {
   void *pixels;
   unsigned char *scaled, *oriented;
   size_t size;
-  int overlay, quality, cursor_free;
+  int overlay, quality, cursor_free, x11;
   struct output_info output_info[32];
   const char *requested_output;
 };
@@ -192,63 +198,11 @@ static const struct zwlr_screencopy_frame_v1_listener frame_listener = {
     .flags = frame_flags,
     .ready = frame_ready,
     .failed = frame_failed};
-/* Match the normal desktop video's 1920-pixel long-edge cap before IPC and
- * decoding. Bilinear sampling preserves aspect ratio and supports padded rows.
- * The one scratch buffer is reused for the lifetime of this capture child. */
+/* Scaling lives in encode.h, shared with the GNOME capture helper. */
 static const unsigned char *video_pixels(struct capture *c, int *width,
                                          int *height, int *stride) {
-  *width = (int)c->width;
-  *height = (int)c->height;
-  *stride = (int)c->stride;
-  uint32_t edge = c->width > c->height ? c->width : c->height;
-  if (edge <= 1920)
-    return c->pixels;
-  *width = (int)(c->width * 1920 / edge);
-  *height = (int)(c->height * 1920 / edge);
-  if (*width < 1)
-    *width = 1;
-  if (*height < 1)
-    *height = 1;
-  *stride = *width * 4;
-  if (!c->scaled)
-    c->scaled = malloc(1920 * 1920 * 4);
-  if (!c->scaled)
-    return NULL;
-  uint32_t xs[1920], weights[1920];
-  for (int x = 0; x < *width; x++) {
-    uint32_t pos =
-        *width > 1
-            ? (uint32_t)((uint64_t)x * (c->width - 1) * 256 / (*width - 1))
-            : 0;
-    xs[x] = pos >> 8;
-    weights[x] = pos & 255;
-  }
-  for (int y = 0; y < *height; y++) {
-    uint32_t pos =
-        *height > 1
-            ? (uint32_t)((uint64_t)y * (c->height - 1) * 256 / (*height - 1))
-            : 0;
-    uint32_t sy = pos >> 8, wy = pos & 255;
-    uint32_t next = sy + 1 < c->height ? sy + 1 : sy;
-    const unsigned char *a = (const unsigned char *)c->pixels + sy * c->stride;
-    const unsigned char *b =
-        (const unsigned char *)c->pixels + next * c->stride;
-    unsigned char *dest = c->scaled + y * *stride;
-    for (int x = 0; x < *width; x++) {
-      uint32_t sx = xs[x], wx = weights[x],
-               nx = sx + 1 < c->width ? sx + 1 : sx;
-      for (int channel = 0; channel < 3; channel++) {
-        uint32_t top =
-            a[sx * 4 + channel] * (256 - wx) + a[nx * 4 + channel] * wx;
-        uint32_t bottom =
-            b[sx * 4 + channel] * (256 - wx) + b[nx * 4 + channel] * wx;
-        dest[x * 4 + channel] =
-            (unsigned char)((top * (256 - wy) + bottom * wy + 32768) >> 16);
-      }
-      dest[x * 4 + 3] = 255;
-    }
-  }
-  return c->scaled;
+  return cindy_scale_pixels(c->pixels, c->width, c->height, c->stride,
+                            &c->scaled, width, height, stride);
 }
 /* Screencopy buffers use output-buffer coordinates. Rotate into the displayed
  * orientation after bounded scaling, applying Y_INVERT in buffer coordinates.
@@ -287,26 +241,23 @@ static const unsigned char *oriented_pixels(struct capture *c, int *width,
   }
   return c->oriented;
 }
-static int send_jpeg(struct capture *c, tjhandle encoder) {
+static int send_jpeg(struct capture *c) {
   unsigned char *jpeg = NULL;
   unsigned long length = 0;
-  int format = (c->format == WL_SHM_FORMAT_XRGB8888 ||
-                c->format == WL_SHM_FORMAT_ARGB8888)
-                   ? TJPF_BGRX
-                   : TJPF_RGBX;
-  int flags = TJFLAG_FASTDCT;
-  if (c->transform == WL_OUTPUT_TRANSFORM_NORMAL &&
-      (c->flags & ZWLR_SCREENCOPY_FRAME_V1_FLAGS_Y_INVERT))
-    flags |= TJFLAG_BOTTOMUP;
+  int bgrx = c->format == WL_SHM_FORMAT_XRGB8888 ||
+             c->format == WL_SHM_FORMAT_ARGB8888;
+  int bottom_up = c->transform == WL_OUTPUT_TRANSFORM_NORMAL &&
+                  (c->flags & ZWLR_SCREENCOPY_FRAME_V1_FLAGS_Y_INVERT);
   int width, height, stride;
   const unsigned char *pixels = oriented_pixels(c, &width, &height, &stride);
   if (!pixels)
     return -1;
   int status = -1;
   for (int quality = c->quality ? c->quality : 65; quality >= 25;
        quality -= 20) {
-    if
```

#### Recent Merged Pull Requests:
- **PR #13240** (2026-11-26): fix(desktop): 统一两套空 HTTP 550 报错文案，修复 main 单测失败 (@DavidShenXD)
- **PR #13194** (2026-11-26): feat(remote-connection): Agent-Net 卡片版本号旁支持检查并二次确认更新 (@MagicLizi)
- **PR #13182** (2026-11-26): chore(repo): 普通 PR 改为 squash 合入，worktree 巡检识别 squash 合入的分支 (@MagicLizi)
- **PR #13128** (2026-11-26): fix(desktop): 启动时账号切换不再让环境初始化失败 (@MagicLizi)
- **PR #13110** (2026-11-26): fix(desktop): 无法预览的附件面板只显示原文件名和一个打开按钮 (@MagicLizi)
- **PR #13090** (closed): feat(model-providers): add Command Code GOAT connection preset (@xuzini-xzn)

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

## X. desktop): reconcile the two empty-550 error notices

**RULE**:
When implementing operations in `apps/desktop/src/renderer/components/chat/__tests__/ErrorLocalization.test.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b0bd3858`: desktop): reconcile the two empty-550 error notices. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/renderer/components/chat/__tests__/ErrorLocalization.test.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
// #12924, unit: the live and historical notices name an upstream 5xx status —
// the exact empty HTTP 550 and any other message naming "550 status code" get
// the same upstream-status notice (#12970) — while the dispatch refusal keeps
// its own "not sent" text.
const upstream550 = zhCN.chat.errorBanner.upstreamStatusError.replace('{{status}}', '550');
  ['550 status code (no body)', upstream550],
  ['ordinary failure mentioning 550 status code (no body)', upstream550],
])('names the upstream 5xx status and keeps the dispatch refusal (%s)', async (message, expected) => {
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// #12924, unit: the live and historical notices distinguish the observed
// empty HTTP 550 from ordinary failures, while preserving the dispatch refusal.
  ['550 status code (no body)', '模型服务返回 HTTP 550（无响应内容）'],
  ['ordinary failure mentioning 550 status code (no body)', zhCN.chat.errorBanner.replyFailed],
])('localizes the exact empty upstream 550 without changing other errors (%s)', async (message, expected) => {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b0bd3858` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

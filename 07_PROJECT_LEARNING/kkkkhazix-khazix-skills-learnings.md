# Forensic Learning Record (Deep Inspection): KKKKhazix/khazix-skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/kkkkhazix-khazix-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/KKKKhazix/khazix-skills](https://github.com/KKKKhazix/khazix-skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:01:39.883Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `KKKKhazix/khazix-skills`
- **Description**: 数字生命卡兹克开源的 AI Skills 合集 | Agent Skills: leader（帮你定义目标）, neat-freak 洁癖, hv-analysis, khazix-writer & more — Claude Code, Codex & 40+ agents
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 21176 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `hv-analysis/scripts/md_to_pdf.py`
```
#!/usr/bin/env python3
"""
横纵分析法报告 Markdown → PDF 转换脚本 (WeasyPrint版)
用法: python md_to_pdf.py input.md output.pdf [--title "报告标题"] [--author "作者"]

依赖: pip install weasyprint markdown --break-system-packages
"""

import sys
import os
import re
import argparse
import markdown

# ── CSS 样式 ──
CSS_TEMPLATE = """
@page {
    size: A4;
    margin: 25mm 20mm 20mm 20mm;

    @top-center {
        content: "HEADER_TEXT";
        font-family: "Droid Sans Fallback", Helvetica, Arial, sans-serif;
        font-size: 8pt;
        color: #95a5a6;
        border-bottom: 0.5pt solid #ecf0f1;
        padding-bottom: 3mm;
    }

    @bottom-center {
        content: "第 " counter(page) " 页";
        font-family: "Droid Sans Fallback", Helvetica, Arial, sans-serif;
        font-size: 8pt;
        color: #95a5a6;
        border-top: 0.8pt solid #1a5276;
        padding-top: 2mm;
    }
}

@page :first {
    @top-center { content: none; }
    @bottom-center { content: none; }
}

body {
    font-family: "Droid Sans Fallback", Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.75;
    color: #2c3e50;
    text-align: justify;
}

/* 封面 */
.cover {
    page-break-after: always;
    text-align: center;
    padding-top: 45%;
}
.cover h1 {
    font-size: 28pt;
    color: #1a5276;
    margin-bottom: 8mm;
    font-weight: bold;
    letter-spacing: 2pt;
}
.cover .subtitle {
    font-size: 14pt;
    color: #95a5a6;
    margin-bottom: 6mm;
}
.cover .meta {
    font-size: 11pt;
    color: #95a5a6;
    margin-bottom: 4mm;
}
.cover .divider {
    width: 60%;
    margin: 8mm auto;
    border: none;
    border-top: 1.5pt solid #1a5276;
}

/* 一级标题 */
h1 {
    font-size: 20pt;
    color: #1a5276;
    margin-top: 16mm;
    margin-bottom: 6mm;
    padding-bottom: 3mm;
    border-bottom: 2pt solid #1a5276;
    page-break-before: always;
    font-weight: bold;
}

/* 二级标题 */
h2 {
    font-size: 14pt;
    color: #1e8449;
    margin-top: 10mm;
    margin-bottom: 5mm;
    font-weight: bold;
}

/* 三级标题 */
h3 {
    font-size: 12pt;
    color: #2e86c1;
    margin-top: 6mm;
    margin-bottom: 3mm;
    font-weight: bold;
}

h4 {
    font-size: 11pt;
    color: #5b2c6f;
    margin-top: 5mm;
    margin-bottom: 2mm;
    font-weight: bold;
}

/* 段落 */
p {
    margin-top: 1.5mm;
    margin-bottom: 1.5mm;
    orphans: 3;
    widows: 3;
}

/* 引用块 */
blockquote {
    margin: 4mm 0;
    padding: 4mm 4mm 4mm 10mm;
    background: #f8f9fa;
    border-left: 3pt solid #1a5276;
    color: #5d6d7e;
    font-size: 10pt;
}
blockquote p {
    margin: 1mm 0;
}

/* 粗体 */
strong, b {
    font-weight: bold;
    color: #1a252f;
}

/* 行内代码 */
code {
    font-family: "Courier New", Courier, monospace;
    background: #fdf2e9;
    color: #c0392b;
    padding: 0.5mm 1.5mm;
    border-radius: 2pt;
    font-size: 9.5pt;
}

/* 表格 */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 4mm 0;
    font-size: 9.5pt;
}
thead th {
    background: #1a5276;
    color: white;
    padding: 3mm;
    text-align: left;
    font-weight: bold;
}
tbody td {
    padding: 2.5mm 3mm;
    border-bottom: 0.5pt solid #bdc3c7;
}
tbody tr:nth-child(even) {
    background: #f8f9fa;
}

/* 分隔线 */
hr {
    border: none;
    border-top: 0.5pt solid #bdc3c7;
    margin: 4mm 0;
}

/* 列表 */
ul, ol {
    margin: 2mm 0;
    padding-left: 8mm;
}
li {
    margin-bottom: 1mm;
}

/* 链接 */
a {
    color: #2e86c1;
    text-decoration: none;
}
"""


def md_to_html(md_text, title="横纵分析报告", subtitle="横纵分析法深度研究报告",
               meta_line="", author="数字生命卡兹克"):
    """将 Markdown 转为带封面的 HTML"""

    # 用 markdown 库转换正文
    html_body = markdown.markdown(
        md_text,
        extensions=['tables', 'fenced_code', 'nl2br'],
        output_format='html5'
    )

    # 移除正文中的第一个 h1（会用在封面上）
    first_h1_match = re.search(r'<h1>(.*?)</h1>', html_body)
    if first_h1_match:
        extracted_title = first_h1_match.group(1)
        if not title or title == "横纵分析报告":
            title = extracted_title
        html_body = html_body.replace(first_h1_match.group(0), '', 1)

    # 替换 CSS 中的页眉占位符
    css = CSS_TEMPLATE.replace("HEADER_TEXT", f"{title}  |  横纵分析法深度研究报告")

    # 构建封面
    cover_html = f"""
    <div class="cover">
        <h1 style="page-break-before: avoid; border: none;">{title}</h1>
        <div class="subtitle">{subtitle}</div>
        {"<div class='meta'>" + meta_line + "</div>" if meta_line else ""}
        <hr class="divider">
        <div class="meta">作者: {author}</div>
    </div>
    """

    full_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <style>{css}</style>
</head>
<body>
{cover_html}
{html_body}
</body>
</html>"""

    return full_html


def main():
    parser = argparse.ArgumentParser(description="横纵分析法报告 Markdown → PDF")
    parser.add_argument("input", help="输入的 Markdown 文件路径")
    parser.add_argument("output", help="输出的 PDF 文件路径")
    parser.add_argument("--title", default=None, help="报告标题")
    parser.add_argument("--author", default="数字生命卡兹克", help="作者名")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        md_text = f.read()

    # 提取元信息
    meta_line = ""
    for line in md_text.split("\n"):
        stripped = line.strip().lstrip(">").strip()
        if "研究时间" in stripped or "所属领域" in stripped or "研究对象类型" in stripped:
            meta_line = stripped
            break

    html = md_to_html(md_text, title=args.title or "横纵分析报告", meta_line=meta_line, author=args.author)

    # 保存中间 HTML（便于调试）
    html_path = args.output.replace('.pdf', '.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"[OK] HTML 已生成: {html_path}")

    # 转 PDF
    from weasyprint import HTML
    HTML(string=html).write_pdf(args.output)
    size_kb = os.path.getsize(args.output) / 1024
    print(f"[OK] PDF 已生成: {args.output} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-1-routine-dev-sync/workspace/taskflow/src/router.ts`
```
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { db } from './db';

const t = initTRPC.create();

export const appRouter = t.router({
  taskList: t.procedure.query(() => db.prepare('SELECT * FROM tasks').all()),
  taskCreate: t.procedure
    .input(z.object({ title: z.string(), assignee: z.string().optional() }))
    .mutation(({ input }) =>
      db.prepare('INSERT INTO tasks (title, assignee) VALUES (?, ?)').run(input.title, input.assignee)
    ),
  taskUpdate: t.procedure
    .input(z.object({ id: z.number(), done: z.boolean() }))
    .mutation(({ input }) => db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(input.done ? 1 : 0, input.id)),
  taskDelete: t.procedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.prepare('DELETE FROM tasks WHERE id = ?').run(input.id)),
});

export type AppRouter = typeof appRouter;

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-1-routine-dev-sync/workspace/taskflow/src/server.ts`
```
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { appRouter } from './router';

const server = createHTTPServer({ router: appRouter });
const wss = new WebSocketServer({ server: server.server });
applyWSSHandler({ wss, router: appRouter });

server.listen(4000);
console.log('tRPC server (HTTP + WS subscriptions) on :4000, deployed via Railway');

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-10-vibe-project/project/server.js`
```
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3005;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(__dirname));

function loadTodos() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveTodos(todos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2));
}

app.get("/api/todos", (req, res) => {
  res.json(loadTodos());
});

app.post("/api/todos", (req, res) => {
  const todos = loadTodos();
  const todo = { id: Date.now(), text: req.body.text, done: false };
  todos.push(todo);
  saveTodos(todos);
  res.status(201).json(todo);
});

app.patch("/api/todos/:id", (req, res) => {
  const todos = loadTodos();
  const todo = todos.find((t) => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: "not found" });
  todo.done = Boolean(req.body.done);
  saveTodos(todos);
  res.json(todo);
});

app.listen(PORT, () => {
  console.log(`quicktodo listening on http://localhost:${PORT}`);
});

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-10-vibe-project/project/server_old.js`
```
// 旧版：内存数组存储，已被 server.js 的 data.json 文件存储替代
const express = require("express");
const app = express();
let todos = [];

app.use(express.json());

app.get("/api/todos", (req, res) => res.json(todos));

app.listen(3000, () => console.log("quicktodo on 3000"));

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-11-unknown-platform/project/main.py`
```
"""flasknotes：极简笔记 API。"""

import csv
import io

from flask import Flask, jsonify, request, Response

app = Flask(__name__)

# 内存存储，重启即清空
NOTES: list[dict] = []


@app.get("/notes")
def list_notes():
    return jsonify(NOTES)


@app.post("/notes")
def add_note():
    note = {"id": len(NOTES) + 1, "text": request.json.get("text", "")}
    NOTES.append(note)
    return jsonify(note), 201


@app.get("/export")
def export_notes():
    # 导出 CSV，2026-06 新增
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "text"])
    for note in NOTES:
        writer.writerow([note["id"], note["text"]])
    return Response(buf.getvalue(), mimetype="text/csv")


if __name__ == "__main__":
    app.run(port=5000)

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-2-memory-conflict/workspace/notesapp/src/auth.ts`
```
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtected = createRouteMatcher(['/notes(.*)', '/settings(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-3-cold-start/workspace/analytics_dashboard/src/App.jsx`
```
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { supabase } from './lib/supabase';

export default function App() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    supabase.from('page_events').select('day, count').order('day').then(({ data }) => setEvents(data ?? []));
  }, []);
  return (
    <main>
      <h1>流量看板</h1>
      <LineChart width={720} height={320} data={events}>
        <XAxis dataKey="day" /><YAxis /><Tooltip />
        <Line type="monotone" dataKey="count" />
      </LineChart>
    </main>
  );
}

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-3-cold-start/workspace/analytics_dashboard/src/lib/supabase.js`
```
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-4-cross-project/workspace/auth-center/src/routes/device.ts`
```
import type { FastifyInstance } from 'fastify';
import { randomUserCode, issueDeviceCode } from '../deviceFlow';

// OAuth 2.0 Device Authorization Grant (RFC 8628)
export async function deviceRoutes(app: FastifyInstance) {
  // 设备侧：申请 device_code + user_code
  app.post('/device/code', async (req) => {
    const { client_id } = req.body as { client_id: string };
    return issueDeviceCode(client_id, { ttl: Number(process.env.DEVICE_CODE_TTL ?? 600) });
  });

  // 设备侧：轮询换 token
  app.post('/device/token', async (req, reply) => {
    const { device_code } = req.body as { device_code: string };
    const row = await app.pg.query('SELECT status FROM device_codes WHERE device_code=$1', [device_code]);
    if (row.rows[0]?.status !== 'approved') return reply.code(400).send({ error: 'authorization_pending' });
    return { access_token: '...', token_type: 'bearer' };
  });

  // 浏览器侧：用户输入 user_code 的授权确认页
  app.get('/device/verify', async (_req, reply) => reply.view('device-verify.html'));

  // 浏览器侧：列出当前用户已授权的设备
  app.get('/device/sessions', async (req) => {
    return app.pg.query('SELECT client_id, approved_at FROM device_codes WHERE user_id=$1 AND status=$2', [
      (req as any).user.id, 'approved',
    ]);
  });
}

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-4-cross-project/workspace/skills-hub/web/src/DevicesPage.jsx`
```
import { useEffect, useState } from 'react';

// “我的设备”——列出用户通过 Device Flow 授权过的设备
export function DevicesPage() {
  const [devices, setDevices] = useState([]);
  useEffect(() => {
    fetch('/api/auth/device/sessions').then(r => r.json()).then(setDevices);
  }, []);
  return (
    <ul>{devices.map(d => <li key={d.client_id}>{d.client_id} · {d.approved_at}</li>)}</ul>
  );
}

```

### Core Architecture Module: `neat-freak/evals/fixtures/eval-5-governance/workspace/Link_Shortener/src/server.js`
```
import express from 'express';
import { nanoid } from 'nanoid';

const app = express();
const store = new Map();

app.use(express.json());
app.post('/shorten', (req, res) => {
  const id = nanoid(7);
  store.set(id, req.body.url);
  res.json({ short: `/s/${id}` });
});
app.get('/s/:id', (req, res) => {
  const url = store.get(req.params.id);
  url ? res.redirect(url) : res.sendStatus(404);
});
app.listen(3000);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #63** (2026-08-20): **feat: 补上 Claude marketplace 清单，Desktop / Cowork 可以直接添加这个仓库**
  *Symptoms*: ## 背景  在 Claude Desktop 里用「Add marketplace」填这个仓库地址时会报错：  > This repository isn't a marketplace — no manifest found at .claude-plugin/marketplace.json.  仓库本身是一组独立的 Agent Skill 目录，给 Claude Code / Codex 按目录 clone 用没问题。Desktop / Cowork 这条导入路径只认仓库根下的 `.claude-plugin/marketplace.json`，所以会被拒。  本次修改可以实现在 Claude Desktop 中直接粘贴本项目git地址即可拉取并直接同步Skill的更改 <img width="1013" height="358" alt="image" src="https://github.com/user-attachments/assets/19cc1c77-c51e-4699-87d7-f91ccb302622" />   ## 改动  只加了两份清单，六个 skill 目录的层级和内容都没动：  - `.claude-plugin/marketplace.json`：把本仓库登记成 marketplace - `.claude-plugin/plugin.json`：把现有的 6 个 skill（leader、storage-analyzer、aihot、neat-freak、hv-analysis、khazix-writer）收成一个插件 `khazix-skills`  原来的安装方式仍然有效：按目录 clone 进 `~/.claude/skills`，或把 `SKILL.md` 当项目规则用。  ## 验证  1. Desktop → Settings → Plugins → Add marketplace 2. 填 `https://github.com/KKKKhazix/khazix-skills` 或 `KKKKhazix/khazix-skills` 3. Sync 不再报缺 manifest 4. 安装 `khazix-skills` 后，六个 skill 会出现在 Cowork 的 `/` 列表里   
  **Post-Mortem & Fix Analysis**:
  > ### 可以方便的在插件页面进行更新 <img width="955" height="692" alt="image" src="https://github.com/user-attachments/assets/4c8b4c34-6367-4de9-96f7-432242e047ca" />  <img width="964" height="720" alt="image" src="https://github.com/user-attachments/assets/b74c1186-3128-4667-a8d9-5e71d5e5d927" /> 

- **Issue #55** (2026-08-11): **fix(hv-analysis): cross-platform font fallback (fixes broken numerals/page numbers on macOS)**
  *Symptoms*: ## Problem  On **macOS**, generating a PDF with the `hv-analysis` skill produces broken rendering:  - The footer page number (CSS `counter(page)`) shows as missing glyphs / tofu boxes - Inline Arabic numerals in the body render incorrectly too - CJK text, ironically, renders fine  ## Root cause  `hv-analysis/scripts/md_to_pdf.py` hardcodes every CSS `font-family` chain to start with **`"Droid Sans Fallback"`**. This font is common on Linux but **not available on macOS**. When WeasyPrint (via Pango) cannot find the first font in the chain, its fallback misroutes ASCII digits to a font lacking those glyphs, while CJK characters get routed to a CJK-capable fallback — hence numerals break but CJK does not.  This is hard to notice on Linux (where the font exists), which is likely why it has gone unfixed.  ## Fix  Replace the single-font chain with a cross-platform fallback list:  | Platform | Fonts added | |---|---| | macOS | PingFang SC, Hiragino Sans GB, Heiti SC | | Linux | Noto Sans CJK SC, Source Han Sans SC | | Windows | Microsoft YaHei | | Tail fallback | Droid Sans Fallback (kept, for older Linux/Android) | | Emoji | Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji |  Applied to all 3 `font-family` declarations (page header, page footer, body).  ## Effect  - **Linux**: no behavior change (Droid Sans Fallback still in the chain) - **macOS**: numerals and page numbers now render correctly ✅ - **Windows**: now supported (previously untested) - **Emoji**: now covered (previ
  **Post-Mortem & Fix Analysis**:
  > 补充一份中文说明，方便阅读：  ## 问题现象  在 **macOS** 上用 hv-analysis skill 生成 PDF 时会出现渲染异常：  - 页脚页码（CSS `counter(page)`）显示成方块 / 缺字 - 正文里的阿拉伯数字也渲染异常 - 但中文反而正常  ## 根因  `hv-analysis/scripts/md_to_pdf.py` 里 3 处 CSS `font-family` 都把首字体硬编码成 `"Droid Sans Fallback"`。这个字体在 Linux 上常见，但 **macOS 系统不带**。WeasyPrint（经 Pango）找不到首字体后回退策略出问题：ASCII 数字被路由到一个缺数字字形的字体，而中文被路由到带中文的字体——所以数字坏了、中文没坏。  这个问题在 Linux 上完全正常（字体存在），估计是一直在 Linux 上开发测试，所以没被发现。  ## 修复方案  把单一字体链换成跨平台 fallback：  | 平台 | 新增字体 | |---|---| | macOS | PingFang SC、Hiragino Sans GB、Heiti SC | | Linux | Noto Sans CJK SC、Source Han Sans SC | | Windows | Microsoft YaHei | | 兜底 | Droid Sans Fallback（保留，老 Linux / Android）| | Emoji | Apple Color Emoji、Segoe UI Emoji、Noto Color Emoji |  页眉、页脚、正文 3 处 `font-family` 都已修改。  ## 影响  - **Linux**：无变化（Droid Sans Fallback 仍在链中） - **macOS**：页码和正文数字恢复正常 ✅ - **Windows**：开始支持（之前未测试） - **Emoji**：开始覆盖（之前链里没有任何 emoji 字体）  ## 验证方法  在 macOS 上用 skill 生成任意一份 PDF，检查： 1. 页脚页码是正常数字（不是方块） 2. 正文阿拉伯数字正常显示 
  > Closing in favor of #56 — same fix reopened under a personal account (zwyin) for cleaner attribution. Please review #56 instead.

- **Issue #48** (2026-07-16): **test**
  *Symptoms*: [common.yaml](https://github.com/user-attachments/files/30080903/common.yaml)

- **Issue #45** (2026-09-09): **fix(neat-freak): document Codex memory layers**
  *Symptoms*: ## Summary - document Codex's `$CODEX_HOME/memories/` layout in `neat-freak` - distinguish the prompt-loaded `memory_summary.md` layer from the searchable `MEMORY.md` registry - keep the 25KB / 200-line hard limit scoped to Claude Code's memory index instead of applying it to Codex `MEMORY.md`  ## Verification - `uv run --with pyyaml python /Users/admin/.codex/skills/.system/skill-creator/scripts/quick_validate.py neat-freak` - `git diff --check -- neat-freak/SKILL.md neat-freak/references/agent-paths.md` 
  **Post-Mortem & Fix Analysis**:
  > I compared this PR with current upstream/main. The effective Codex memory guidance is already present upstream, while the PR’s fixed paths and token/line limits conflict with the current host-generated, read-only memory boundary. There is no safe remaining diff to migrate, so I am closing this obsolete PR.

- **Issue #44** (2026-07-01): **新增 research-analysis「研究一下」深度研究技能**
  *Symptoms*: ## 这次更新  新增 `research-analysis` skill，把日常口令「研究一下 / 深度研究一下 / 调研一下」沉淀成可复用的深度研究流程。  ## 主要能力  - 支持新闻、事件、微信文章、论文、开源项目、公司/产品等研究对象 - 默认追原始来源，不只总结二手文章 - 对爆点/传闻做事实核验，区分真实、待降温和推断 - 引入 STORM 式预写作：视角发现、逐视角提问、矛盾图 - 保留横纵分析：时间线、同类对照、利益相关方、未来剧本 - 输出 Markdown 报告，包含核心结论、事实核验、反常识洞察、可写作素材和来源清单 - 对微信链接默认优先走得到大脑 / Get 笔记读取正文  ## 文档  - 新增 `research-analysis/SKILL.md` - 新增 `research-analysis/references/` 三份参考文档 - 新增 `research-analysis/INSTALL_FOR_CODEX.md` - 更新中英文 README，把 `research-analysis` 加入技能目录和说明  ## 验证  - 已在本机同步到 Codex 全局技能目录：`~/.codex/skills/research-analysis` - 已检查 trigger 关键词、Markdown 报告合同、STORM 预写作和 Get 笔记/微信规则可检索 
  **Post-Mortem & Fix Analysis**:
  >     您好，邮件收到，谢谢。

- **Issue #40** (2026-06-11): **feat(storage-analyzer): Add Windows system-level directory scanning and deep cleaning support**
  *Symptoms*: ## Summary  This PR enhances the storage-analyzer skill with comprehensive Windows system-level directory scanning and safe cleanup guidance, addressing deep system cache analysis that was previously missing.  ## Motivation  Current storage-analyzer only scans user-level directories (AppData, Downloads, etc.) but misses critical system-level caches that often consume significant disk space on Windows: - Windows temporary files and logs (several GB) - Windows Update cache (can be 10+ GB) - Windows Installer orphaned files - WinSxS component store bloat - Old driver versions accumulating over time  User feedback indicated the need for deeper system analysis with safe cleanup recommendations.  ## Changes  ### 1. Enhanced `scan.py` Added scanning for 6 new Windows system directories: - `windows_temp` - C:\Windows\Temp - `windows_logs` - C:\Windows\Logs - `windows_softdist` - C:\Windows\SoftwareDistribution\Download - `windows_installer` - C:\Windows\Installer - `windows_winsxs` - C:\Windows\WinSxS - `windows_driverstore` - C:\Windows\System32\DriverStore\FileRepository  Uses pure Python 3 stdlib - zero dependencies.  ### 2. Updated `windows.md` reference - Safety classifications for each directory type - Tool recommendations: PatchCleaner, Driver Store Explorer (RAPR), DISM commands - Symbolic link (mklink) migration guide  ### 3. Updated `SKILL.md` Added "Windows 系统级目录特殊处理" section with detailed handling rules.  ## Safety Design - Read-only scanning - NO delete buttons for syste

- **Issue #35** (2026-07-21): **chore: 全量汉→英翻译 hv-analysis 和 neat-freak skill 文档**
  *Symptoms*: ## Summary - **hv-analysis**: SKILL.md、schema.json（字段名+描述）、md_to_pdf.py（默认值+CLI帮助+输出信息）全部翻译为英文；元信息提取兼容中英文关键词 - **neat-freak**: SKILL.md、agent-paths.md、sync-matrix.md 全文翻译为英文  ## Test plan - [ ] 确认 hv-analysis skill 的 PDF 生成脚本在英文默认值下正常工作 - [ ] 确认 neat-freak skill 的引用路径和参考文件链接未断裂 - [ ] 阅读翻译后的 SKILL.md 确保语义准确、无遗漏  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #32** (2026-05-30): **AIHOT SKILL 输出结果与 Web（AI HOT 日报）结果并不一致？**
  *Symptoms*: ### 原因？  <img width="2195" height="2054" alt="Image" src="https://github.com/user-attachments/assets/ae6b7564-13e5-4c84-b736-e90f8f10464e" />

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

### Incident Patch 1: `d0534c38` (2026-07-26)
**Commit Message**: fix(aihot): repair the install command, sync the capability list

The documented one-liner has been broken since the installer stopped
guessing a target: `curl ... | bash` now exits with "no target selected"
before installing anything. Replaced with the two --target forms the
site documents.

Also brings the capability list back in line with SKILL.md 1.1.2: adds
hot-topics and the selected-snapshot sync, and corrects "last N days" to
the 24h / 7d windows the v1 API actually guarantees.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `README.en.md` (modified, +12/-5)
```diff
@@ -167,26 +167,33 @@ Lets any SKILL.md-supporting agent pull AI HOT's daily report and all AI news fr
 
 - Pull today's or a specific date's AI HOT daily report (pre-packaged by topic)
 - Pull the selected items stream (daily editorial candidate pool)
+- **See what's hottest right now** (ranked by heat, not reverse-chronological)
 - Pull by category (models / products / industry / papers / tips)
-- Pull by time window (last N days)
+- Pull by time window (past 24 hours and last 7 days are natively supported)
 - Keyword / company / topic search ("recent OpenAI releases", "Sora-related", "RAG papers")
+- **Mirror the entire current selection locally**, then receive only the changes
 
 **How to trigger** (Chinese — the underlying API is Chinese-curated)
 
 ```
 今天 AI 圈有什么新东西
+现在 AI 圈最热的事件是什么
 看一下 5 月 6 号的 AI 日报
 最近一周的 AI 论文
-看下精选条目
 最近 OpenAI 有什么发布
+把 AI HOT 当前全部精选同步到本地
 ```
 
-**🌐 Cross-platform**: Claude Code · Codex CLI · Cursor · Gemini CLI · OpenCode · Cline · Windsurf
+**🌐 Cross-platform**: Claude Code · Codex CLI · Gemini CLI · GitHub Copilot · OpenCode · Cursor · Cline · Windsurf
 
-**🇨🇳 China-friendly direct install** (no GitHub access needed):
+**🇨🇳 China-friendly direct install** (no GitHub access needed). The installer never guesses your platform — name the target:
 
 ```
-curl -fsSL https://aihot.virxact.com/aihot-skill/install.sh | bash
+# Claude Code
+bash <(curl -fsSL https://aihot.virxact.com/aihot-skill/install.sh) --target claude
+
+# Codex / Gemini CLI / Copilot / OpenCode (shared ~/.agents/skills/aihot)
+bash <(curl -fsSL https://aihot.virxact.com/aihot-skill/install.sh) --target agents
 ```
 
 → [SKILL.md](./aihot/SKILL.md) · [aihot.virxact.com](https://aihot.virxact.com) · [Integration guide](https://aihot.virxact.com/agent)
```

**File**: `README.md` (modified, +12/-5)
```diff
@@ -167,26 +167,33 @@ storage analysis
 
 - 拉今日 / 指定日期的 AI HOT 日报（按主题打包好的成品）
 - 拉精选条目流（每日精编候选池）
+- **看当前最热事件**（按热度排，不是按时间倒序）
 - 按分类拉条目（模型 / 产品 / 行业 / 论文 / 技巧）
-- 按时间窗口拉（最近 N 天）
+- 按时间窗拉（原生支持过去 24 小时和最近 7 天）
 - 关键词 / 公司 / 主题搜索（"OpenAI 最近发的"、"Sora 相关"、"RAG 论文"）
+- **把当前全部精选同步到本地**，之后只接收变化
 
 **怎么触发**
 
 ```
 今天 AI 圈有什么新东西
+现在 AI 圈最热的事件是什么
 看一下 5 月 6 号的 AI 日报
 最近一周的 AI 论文
-看下精选条目
 最近 OpenAI 有什么发布
+把 AI HOT 当前全部精选同步到本地
 ```
 
-**🌐 跨平台**：Claude Code · Codex CLI · Cursor · Gemini CLI · OpenCode · Cline · Windsurf
+**🌐 跨平台**：Claude Code · Codex CLI · Gemini CLI · GitHub Copilot · OpenCode · Cursor · Cline · Windsurf
 
-**🇨🇳 国内直链**（无需翻墙）：
+**🇨🇳 国内直链**（无需翻墙）。安装器不猜平台，要指明装给谁：
 
 ```
-curl -fsSL https://aihot.virxact.com/aihot-skill/install.sh | bash
+# Claude Code
+bash <(curl -fsSL https://aihot.virxact.com/aihot-skill/install.sh) --target claude
+
+# Codex / Gemini CLI / Copilot / OpenCode（共用 ~/.agents/skills/aihot）
+bash <(curl -fsSL https://aihot.virxact.com/aihot-skill/install.sh) --target agents
 ```
 
 → [SKILL.md](./aihot/SKILL.md) · [aihot.virxact.com](https://aihot.virxact.com) · [接入指南](https://aihot.virxact.com/agent)
```

---

### Incident Patch 2: `69de8aad` (2026-07-26)
**Commit Message**: fix(readme): unbreak bold markers and fit the seven-questions table

Two rendering bugs in the leader section:

- `**...。**文字` never closes: a CommonMark right-flanking delimiter
  can't sit between a punctuation mark and a word character, so four
  asterisks rendered literally. Moved the closer before the period.
- The table sat at 995px inside an 823px card. Nested in the card's
  outer <table>, it overflows into a scroll region with no visible
  scrollbar on macOS, so the last column reads as missing. Trimmed the
  longest cells to bring it to 795px.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +7/-7)
```diff
@@ -68,7 +68,7 @@
 
 人和 AI 的协作单位一直在变大：过去是一轮对话，后来是一个任务，2026 年的今天是一个目标——你给它一个目标，它自己拆任务、自己调工具、自己验证、失败自己重试，跑一整夜，你只管验收。
 
-但当 AI 真能跑一整夜，一个以前还能临场补救的问题就变得致命：**你的目标写得对不对。**短任务跑偏你看一眼就能纠正；长程任务跑偏，你睡醒时它已经朝错误方向狂奔了八小时。它越勤奋，浪费得越彻底。
+但当 AI 真能跑一整夜，一个以前还能临场补救的问题就变得致命：**你的目标写得对不对**。短任务跑偏你看一眼就能纠正；长程任务跑偏，你睡醒时它已经朝错误方向狂奔了八小时。它越勤奋，浪费得越彻底。
 
 **目标里最重要的部分，是「什么不能做」**
 
@@ -83,14 +83,14 @@ Goal 告诉 AI 往哪走，Harness 告诉它哪些路不许走。**没有 Harnes
 | # | 问题 | 出海版 | 落到任务书 |
 |---|---|---|---|
 | 1 | **目的** | 我们为什么出这趟海，找香料还是探航线 | 遇到没写到的岔路口，它靠这句自己判断 |
-| 2 | **完成态** | 船回港时甲板上该有什么。「出去转一圈」不算，「带回三船香料」才算 | 具体到靠岸那一刻机器就能判 |
+| 2 | **完成态** | 「出去转一圈」不算，「带回三船香料」才算 | 具体到靠岸那一刻机器就能判 |
 | 3 | **证据** | 谁上船清点货舱。不能船长说满载就是满载 | 每条验收都要贴出实际命令输出 |
-| 4 | **反作弊** | 不许劫商船凑数——指标一样达成，事一件没干 | 把偷懒路径一条条点名禁止 |
-| 5 | **地界** | 只许走这三条航线；粮食够三十天，第二十天没找到就掉头 | 白名单 + 跑满 N 轮即停 |
-| 6 | **取舍** | 风暴里保货还是保船。不提前说，船长只能猜 | 「算得对 > 做得全 > 做得快」 |
-| 7 | **未知** | 海图空白区别硬闯也别抛锚——记下来绕过去，回来再定 | 拿不准的写进待裁决清单，跳过继续做别的 |
+| 4 | **反作弊** | 不许劫商船凑数：指标达成，事一件没干 | 把偷懒路径一条条点名禁止 |
+| 5 | **地界** | 只许走这三条航线；粮食只够三十天 | 白名单 + 跑满 N 轮即停 |
+| 6 | **取舍** | 风暴里保货还是保船？不说，船长只能猜 | 「算得对 > 做得全 > 做得快」 |
+| 7 | **未知** | 空白海域别硬闯也别抛锚，记下来绕过去 | 拿不准的写进待裁决清单，跳过做别的 |
 
-还有第零问：**这张海图是你自己测的，还是听来的。**所以它动笔前一定先钻进代码库亲手跑一遍——文档里写的命令，实际可能根本不存在。
+还有第零问：**这张海图是你自己测的，还是听来的**。所以它动笔前一定先钻进代码库亲手跑一遍——文档里写的命令，实际可能根本不存在。
 
 **怎么用**
 
```

---

### Incident Patch 3: `ff554365` (2026-06-14)
**Commit Message**: feat(neat-freak): add memory "graduation" anti-bloat mechanism

Sync SKILL.md from the installed working copy: adds the promote/graduation
mechanism (memory is append-only, docs edit-in-place; pump stable knowledge
up into docs), MEMORY.md hard limits (≤200 lines / ≤25KB silently truncated),
the docs-vs-memory size-inversion check, and matching checklist items.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `neat-freak/SKILL.md` (modified, +25/-6)
```diff
@@ -40,6 +40,20 @@ description: >
 
 > **Agent 记忆系统的具体位置因平台而异**（Claude Code 在 `~/.claude/projects/<...>/memory/`，Codex 用 `AGENTS.md`，OpenCode 用 `.opencode/`，OpenClaw 用 `~/.openclaw/`）。完整路径速查见 [references/agent-paths.md](references/agent-paths.md)。如果当前 agent 没有独立的记忆系统，直接跳过这一层，把功夫全花在 docs 和项目根 markdown 上。
 
+### 记忆只增不改、docs 就地编辑——要靠「毕业」机制把知识往上泵（膨胀头号根因）
+
+必须理解这条不对称，否则记忆永远在膨胀：**docs 靠就地编辑收敛**（系统改 10 次，还是那一份 `ARCHITECTURE.md`），**而 agent 记忆天生只追加**（每条教训生一个新文件，旧的不删）。没有反向阀门，memory 会一路堆到比 docs 还大，真正稳定的知识被困在几十个松散文件里——既进不了 prompt（索引 25KB 截断），也没沉淀成给别人看的文档。高速开发的项目尤其明显：每天 2-3 条教训 × 数周 = 上百个记忆文件。
+
+**反向阀门 = 毕业（promote）。** 一条记忆满足下面任一条，就把它「毕业」：内容并进对应的 `docs/` 或 `CLAUDE.md`，然后**把原记忆文件删掉或缩成一行指针**：
+
+- **同一主题的教训反复出现到第 3 次** → 它已是稳定知识而非「最近踩的坑」，归 docs。
+- **它讲的是「系统怎么工作」而非「我们踩过什么坑 / 做过什么决策」** → 本就是 docs 的职责，memory 顶多留指针。
+- **它是「X 上线 / 落地 / 就位」的事件记录** → 现役事实进 docs，过程进 git log / `docs/CHANGES.md`，memory 不留常驻文件。
+
+判据一句话：**「下一个接手的人（不只是我自己）需要知道这件事吗？」需要 → 它属于 docs，不是 memory。**
+
+> 记忆文件若用类型前缀（如 `feedback_`=教训 / `project_`=决策事件 / `reference_`=速查），生命周期不同：`reference_` 通常合法长期常驻；`feedback_` 稳定后毕业；`project_` 多数是事件记录，**是优先毕业 / 删除的对象**——决策结论进 docs，过程进 changelog。
+
 ### CLAUDE.md / AGENTS.md 是规则手册，不是变更日志（重要）
 
 最常见的 skill 翻车模式：每次开发完都在 CLAUDE.md 顶部加一段 blockquote 历史叙事——"2026-05-08 X 功能上线，详见 docs/Y.md"。一次很爽，半年后顶部就是 200 行 blockquote 把真正的规则推到看不见。**这种叙事不属于 CLAUDE.md**，它的归宿是 git log / `/changelog` 页 / `docs/CHANGES.md`。
@@ -64,14 +78,16 @@ description: >
 
 任何同步动作之前，先 `wc -l` 关键文件：
 
-| 文件 | Soft limit | 超过怎么办 |
+| 文件 | 上限 | 超过怎么办 |
 |---|---|---|
-| `CLAUDE.md` / `AGENTS.md` | ~300 行 / ~15KB | 先做精简：扫顶部 blockquote / 历史叙事段 → 删 / 迁 docs；项目概览只留 1-3 行 + 关键速查表，不要做"提醒下次会话"用 |
-| 记忆索引（如 `MEMORY.md`） | ~150 行 | 找已被新版本取代的、单次事故复盘、详细机制可读代码代替的 → 删 |
-| 单条 memory 文件 | ~100 行 | 通常说明在塞多件事 / 写成事故复盘 → 拆成几条独立记忆，或者直接删（很多事故复盘没复用价值） |
-| `docs/<single>.md` | ~1500 行 | 切分成多文件，加目录索引 |
+| `CLAUDE.md` / `AGENTS.md` | ~300 行 / ~15KB（软，看 adherence） | 先精简：扫顶部 blockquote / 历史叙事段 → 删 / 迁 docs；项目概览只留 1-3 行 + 速查表，不做"提醒下次会话"用。（CLAUDE.md 是全量加载，不会被截断，但越长 adherence 越差） |
+| 记忆索引 `MEMORY.md` | **≤200 行 且 ≤25KB（硬）** | Claude Code 只加载 `MEMORY.md` 的前 200 行或前 25KB（先到先算），**超出部分在会话开始时静默不加载——等于没记**。务必压在 ~150 行 / ~18KB 留缓冲。压法不是硬删，是下面的「毕业」机制：详细机制提升进 docs、索引只留一行指针 |
+| 单条 memory 文件 | ~100 行（软） | 通常在塞多件事 / 写成事故复盘 → 拆 / 删；**若是稳定机制说明，提升进 docs 再把记忆缩成 reference 指针** |
+| `docs/<single>.md` | ~1500 行（软） | 切分成多文件，加目录索引 |
+
+**额外做一次「体量倒挂」体检**：`du -sh <memory 目录>` 对比 `du -sh docs/`。**健康态是 docs 厚、memory 薄**——docs 是沉淀的权威层，memory 是流动的「最近教训 + 指针」层。若 memory 反而比 docs 大，几乎一定是「本该毕业进 docs 的稳定知识还赖在松散记忆文件里」，按「毕业」机制往上泵，别只在 memory 内部挪。
 
-**超尺寸是这个 skill 的最高优先级，大于"补本次会话漏掉的同步"。** 原因：超尺寸的 CLAUDE.md 实际上让下次 AI 看不到真正重要的规则（被叙事段挤到 200 行外，进不了 prompt 重点段），同步再补也徒劳。
+**超尺寸是这个 skill 的最高优先级，大于"补本次会话漏掉的同步"。** 原因：`MEMORY.md` 超 25KB 的部分根本不进上下文（静默丢失），超尺寸的 CLAUDE.md 让真正的规则被叙事段挤出 adherence——两种情况下，同步再补都徒劳。
 
 **执行顺序**：先精简（破除膨胀）→ 再做本次会话增量同步（补漏）。两件事不能合并——精简时心态是"什么不该在这"，补漏时心态是"什么该补到这"，混着做会两头不到位。
 
@@ -119,6 +135,7 @@ description: >
 - **减优于加**（最重要）：每次同步动作结束后，CLAUDE.md / AGENTS.md 净涨幅 > 30 行就是红灯——很可能在写历史叙事而不是补规则。回头审：这条加的是"下次 AI 写代码时必须看到"的规则，还是"上次会话告诉下次会话发生了什么"的便条？后者就是病。能删的先删，不能删的迁去 docs，最后剩下的才是规则。
 - **合并优于追加**：新信息是对旧信息的更新，改旧条目；新加条目前先 grep 同关键字，看现有条目能不能并
 - **删除优于保留**：完成的临时计划、推翻的决策、已被新版本取代的项目记忆、单次事故的流水账复盘——删
+- **毕业优于内部挪腾**（针对 memory）：一条记忆稳定、复用、或本属「系统怎么工作」时，别在 memory 里搬来搬去——并进 docs / CLAUDE.md，原文件缩成一行指针或删。这是把 memory 压回「薄」的唯一治本手段（见上「毕业」机制）
 - **精确优于冗长**：一条记忆说清楚一件事，别塞三件
 - **绝对时间**：永远 `2026-04-29`，不写"今天"、"最近"
 - **面向读者**：docs/ 的读者是"第一次接触这个项目的外部人"，写的时候想象对方只有 5 分钟能看完
@@ -144,6 +161,8 @@ API 速查表、环境变量表、术语表是高频查询的结构化信息，*
 - [ ] 没新增 "X 起 Y 上线，详见 docs/Z.md" 这种 blockquote 历史叙事条目
 - [ ] 没在 CLAUDE.md 里抄 docs/ 已有的详细机制说明
 - [ ] 单条 memory 文件没超 ~100 行（超了拆 / 删 / 改成 reference）
+- [ ] **记忆索引 `MEMORY.md` ≤ 25KB 且 ≤ 200 行**（`wc -c` 实测；超出部分会话开始时静默不加载 = 等于没记）
+- [ ] **体量没倒挂**：`du memory` 不应大于 `du docs/`；倒挂了说明有该毕业进 docs 的知识赖在 memory，回去毕业
 
 **完整性 / 反漏改（再查这组）**：
 - [ ] 第一步列出的每个文件，都判断了"不用改"或"已改"
```

---

### Incident Patch 4: `51610fab` (2026-06-04)
**Commit Message**: feat(vibeguard): mirror VibeGuard (补天) security-scan skill

Mirror the dependency/secret/repo-hygiene security skill from the
team's repo (27Aaron/VibeGuard) unchanged: SKILL.md + scripts/ +
assets/ + agents/. Add 补天 entry to README.md / README.en.md (table
row + detail card) and bump skill count 5 → 6.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.en.md` (modified, +37/-1)
```diff
@@ -7,7 +7,7 @@
 #### A few AI skills I actually use every day, open-sourced as-is
 
 [![License](https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge)](./LICENSE)
-[![Skills](https://img.shields.io/badge/Skills-5-10B981?style=for-the-badge)](#-skills)
+[![Skills](https://img.shields.io/badge/Skills-6-10B981?style=for-the-badge)](#-skills)
 [![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-8B5CF6?style=for-the-badge)](https://agentskills.io)
 
 ![Claude Code](https://img.shields.io/badge/Claude_Code-Skill-D97706?style=flat-square&logo=anthropic&logoColor=white)
@@ -32,6 +32,7 @@ Every skill here is a structured instruction set that agents load directly. Foll
 | ✍️ [**khazix-writer**](#-khazix-writer) | Makes the agent write long-form Chinese articles in my personal voice | [Article (Chinese)](https://mp.weixin.qq.com/s/AtxGrii_K-nzkwUM9SNhEg) |
 | 🔥 [**aihot**](#-aihot-ai-hot-news-query) | Lets your agent pull AI HOT's daily report and all AI news from aihot.virxact.com with one Chinese sentence — no API key | [aihot.virxact.com](https://aihot.virxact.com) |
 | 💽 [**storage-analyzer**](#-storage-analyzer) | One sentence to scan your whole Mac / Windows drive — three-tier cleanup plan, one-click trash from the browser | [Article (Chinese)](https://mp.weixin.qq.com/s/NyOMIlOD986OC4SI9vmxlA) |
+| 🛡️ [**vibeguard**](#-vibeguard) | One sentence — "scan this project for security issues" — for local dependency-vuln, hardcoded-secret, and committed-`.env` checks, with a read-only HTML + Markdown report | — |
 
 ---
 
@@ -240,6 +241,41 @@ storage analysis
 </td></tr>
 </table>
 
+<table>
+<tr><td>
+
+### 🛡️ vibeguard
+
+> *"Two minutes scanning before you ship beats getting scanned after."*
+
+Tell your agent "check this project for security issues" or "scan for dependency vulnerabilities" and it runs a **local** pass over your repo, then produces a **read-only HTML report + a Markdown audit report**. The report is written for product managers and project leads — non-security readers — and answers "does this block the release, do we need to schedule it now, what do engineering/ops need to confirm".
+
+**What it checks**
+
+- **Dependency vulnerabilities** — extracts deps from your lockfile, checks each against known advisories (CVE / GHSA), sorted by severity
+- **Hardcoded secrets** — API keys / tokens / passwords baked into code; the report only shows a redacted preview, never the full secret
+- **Sensitive files in git** — whether `.env`, private keys, or certs are being tracked
+- **Repo hygiene** — whether `.gitignore` covers what it should
+- **Outdated deps** — upgrade suggestions, without ever inflating "outdated" into "vulnerable"
+
+Supports JavaScript / TypeScript, Python, Go, Rust.
+
+**Its boundary (important)**
+
+It covers the **dependency and repo-hygiene** layer of security. It does not replace code audits, penetration testing, or deployment security review — business logic, access control, SQL injection, XSS still need separate review. The report says this repeatedly: no fear-mongering, no false sense of safety.
+
+**Two hard rules**
+
+- **Read-only, always.** Scanning only reads files and calls the vuln API — it never touches your source or dependencies, and the HTML report is for reading only, with no buttons that trigger local actions
+- **Fixes need your nod.** After you read the report, say "fix it / OK" in chat before the agent upgrades or cleans anything
+
+**🌐 Cross-platform**: Claude Code · Codex · OpenCode · OpenClaw
+
+→ [SKILL.md](./vibeguard/SKILL.md)
+
+</td></tr>
+</table>
+
 ---
 
 ## 🌟 About
```

**File**: `README.md` (modified, +37/-1)
```diff
@@ -7,7 +7,7 @@
 #### 我自己每天在用的一些 AI Skill，都开源在这里
 
 [![License](https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge)](./LICENSE)
-[![Skills](https://img.shields.io/badge/Skills-5-10B981?style=for-the-badge)](#-skills)
+[![Skills](https://img.shields.io/badge/Skills-6-10B981?style=for-the-badge)](#-skills)
 [![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-8B5CF6?style=for-the-badge)](https://agentskills.io)
 
 ![Claude Code](https://img.shields.io/badge/Claude_Code-Skill-D97706?style=flat-square&logo=anthropic&logoColor=white)
@@ -32,6 +32,7 @@
 | ✍️ [**khazix-writer（卡兹克写作）**](#-khazix-writer卡兹克写作) | 装上之后，Agent 用我的口吻和节奏写公众号长文 | [公众号文章](https://mp.weixin.qq.com/s/AtxGrii_K-nzkwUM9SNhEg) |
 | 🔥 [**aihot（AI HOT 资讯查询）**](#-aihotai-hot-资讯查询) | 让 Agent 用一句话拿到 aihot.virxact.com 每天的 AI HOT 日报和全部 AI 动态，无需 API Key | [aihot.virxact.com](https://aihot.virxact.com) |
 | 💽 [**storage-analyzer（清理垃圾）**](#-storage-analyzer清理垃圾) | 一句话扫描 Mac / Windows 整机磁盘，三色分级给清理决策，网页上一键移废纸篓 | [公众号文章](https://mp.weixin.qq.com/s/NyOMIlOD986OC4SI9vmxlA) |
+| 🛡️ [**vibeguard（补天）**](#-vibeguard补天) | 一句"扫一下项目安全"，本地查依赖漏洞、硬编码密钥、`.env` 误提交，产出只读 HTML + Markdown 审计报告 | — |
 
 ---
 
@@ -238,6 +239,41 @@ storage analysis
 </td></tr>
 </table>
 
+<table>
+<tr><td>
+
+### 🛡️ vibeguard（补天）
+
+> *"上线前花两分钟自己扫一遍，比上线后被别人扫一遍强。"*
+
+随口跟 Agent 说一句"帮我看看项目有没有安全问题"或"扫一下依赖漏洞"，它会在**本地**把你的项目过一遍，最后产出一份**只读 HTML 报告 + Markdown 审计报告**。报告面向产品经理、项目负责人这类非安全背景的人写，讲清楚"是否影响发布、要不要马上排期、需要研发/运维确认什么"。
+
+**它会查什么**
+
+- **依赖漏洞** — 从 lockfile 提取依赖，逐个查已知漏洞（CVE / GHSA），按严重度排序
+- **硬编码密钥** — 扫代码里写死的 API Key / token / 密码，报告只给脱敏预览，不泄露完整密钥
+- **敏感文件误提交** — `.env`、私钥、证书是不是被 git 跟踪了
+- **仓库卫生** — `.gitignore` 该挡的有没有挡住
+- **过期依赖** — 给升级建议，但不会把"过期"夸大成"有漏洞"
+
+支持 JavaScript / TypeScript、Python、Go、Rust。
+
+**它的边界（很重要）**
+
+它解决的是**依赖和仓库卫生**这一层的安全问题，不能替代代码审计、渗透测试或部署安全评估——业务逻辑、权限、SQL 注入、XSS 这些代码层风险，仍然得单独复核。报告里会反复强调这点，不制造恐慌，也不给你虚假的安全感。
+
+**两条铁律**
+
+- **全程只读，绝不擅自动手。** 扫描只读文件、调漏洞 API，不碰你的源码和依赖；网页报告也只用来读，没有任何会触发本地操作的按钮
+- **修复要你点头。** 看完报告，你在对话里说一句"可以修 / 修复 / OK"，Agent 才会动手升级或清理
+
+**🌐 跨平台**：Claude Code · Codex · OpenCode · OpenClaw
+
+→ [SKILL.md](./vibeguard/SKILL.md)
+
+</td></tr>
+</table>
+
 ---
 
 ## 🌟 关于
```

**File**: `vibeguard/SKILL.md` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+---
+name: vibeguard
+description: VibeGuard 项目代码安全扫描助手，用于"帮我看看项目有没有安全问题"、"安全扫描"、"扫一下项目"、"依赖有没有漏洞"、"木马包"、"恶意包"、"硬编码密钥"、"API Key"、"token"、"env 是否误提交"、"gitignore 是否合理"、"依赖是否太旧"、漏洞检查、项目安全、供应链安全、安全报告等代码仓库检查场景；支持 JavaScript/TypeScript、Python、Go、Rust 项目；默认中文解释，保留 API 字段名、生态名、命令和版本号。
+---
+
+# VibeGuard 项目安全检查
+
+对用户项目做一次本地安全扫描，产出 Markdown 审计报告和只读 HTML 报告。默认用一键流水线执行：预检 -> 扫描 -> 生成 analysis JSON -> 生成 Markdown -> 生成静态 HTML -> agent 复核摘要。修复不在网页里执行，只在用户看完报告并在对话里明确同意后由 agent 执行。
+
+## 核心边界
+
+- 只在本地读取用户项目文件；不上传源码、lockfile、env 或密钥；不要上传完整 lockfile、`.env`、私钥、证书、数据库、日志或任意项目文件。
+- 调用 VibeGuard API 时，只发送最小必要信息：`ecosystem`、`name`、`version`。
+- 报告里不要泄露完整密钥，只能写文件、行号、类型和脱敏预览。
+- 完整项目安全扫描必须先在被扫项目的 `docs/` 下生成 Markdown 审计报告；如果当前工作目录就是被扫项目，也就是当前工作目录的 `docs/`。报告文件例如 `docs/security-report-YYYY-MM-DD.md`。用户阅读报告后明确允许修复，才可以执行升级、删除缓存跟踪、修改 `.gitignore`、清理历史或轮换凭证相关操作。
+- API 地址：`https://vibeguard.ou.al`。本 skill 只使用 `POST https://vibeguard.ou.al/api/security/check/packages` 做依赖漏洞检查，不处理系统软件版本判断或泛安全情报查询。
+- 能力边界：安全往往不是最显眼的需求，却是产品长期稳定运行的底线。VibeGuard 会优先帮助你发现依赖漏洞、过期依赖和仓库卫生风险，让容易被忽视的供应链问题更早暴露出来。但它不能替代代码审计、渗透测试或部署安全评估；代码层面的权限、业务逻辑、SQL 注入、XSS 等问题仍需单独复核。
+- 脚本路径按本 skill 目录解析；如果当前 shell 不在 skill 根目录，使用这些脚本的绝对路径。扫描目标由脚本参数或 preflight JSON 中的 `project.path` 决定，报告写到被扫项目的 `.vibeguard/` 和 `docs/`。
+
+## 铁律
+
+- **只改本地工作区。** 脚本只能创建/更新 `.vibeguard/`、被扫项目的 `docs/security-report-YYYY-MM-DD.md`，并确保 `.gitignore` 包含 `.vibeguard/`；安全扫描本身只读文件、调 API，不修改源码、依赖或配置。
+- **先做生态预检。** 完整依赖漏洞扫描只支持 JavaScript/TypeScript、Python、Go、Rust；没有命中支持文件时，先提示用户暂不支持依赖漏洞扫描，只做仓库卫生扫描。
+- **报告先完整生成，再展示路径。** 必须等 Markdown 报告、analysis JSON 和静态 HTML 都写完后，再把 HTML 路径和摘要告诉用户；不要启动本地 server，也不要兜底起本地服务。
+- **网页只读。** HTML 只用于阅读报告，不提供任何会触发本地操作的按钮。
+- **修复操作需确认。** 用户看完报告后，在对话里回复 `同意` / `修复` / `OK` / `Yes` 等明确话术，agent 才能执行修复。
+- **明确能力边界。** 终端摘要、Markdown 和 HTML 都必须提示本 skill 不是万能安全审计；它解决依赖相关安全问题，代码层风险需要单独复核。
+- **不要把"依赖过旧"说成"存在漏洞"。** 只有命中漏洞数据时才说有漏洞。
+- **不要制造恐慌。** 没有证据时说"不确定"，不要说"肯定安全"或"肯定中招"。
+
+## 默认流程
+
+常规完整扫描优先执行一键流水线：
+
+```bash
+# macOS / Linux
+python3 scripts/run_audit.py
+# Windows
+py -3 scripts/run_audit.py
+```
+
+`scripts/run_audit.py` 默认扫描当前目录并自动向上识别项目根目录；需要扫描其他目录时，把路径作为最后一个参数传入。脚本会按顺序运行预检、扫描、analysis 生成、Markdown 生成和 HTML 生成，生成后会尝试用系统默认浏览器自动打开静态 HTML 报告，并在终端输出固定的人类可读摘要：`📊 风险总览`、`⚠️ 能力边界`、`🚨 重点关注`、`📁 报告路径`；其中能力边界必须使用 Markdown 引用格式 `>` 输出完整文案。只有自动化或测试需要机器可读结果时才使用 `--compact`，此时输出 JSON。如果输出中的模式是 `hygiene_only`，必须告诉用户：`当前项目没有发现 VibeGuard 支持的依赖文件，暂不支持依赖漏洞扫描；本次只做仓库卫生扫描，检查硬编码密钥、敏感文件跟踪和 .gitignore 风险。`
+
+对话最终回复如果需要转述扫描结果，必须使用 Markdown 引用格式 `>` 展示完整能力边界，不要自行压缩成短句，也不要另起"提示"类标题。固定写法如下：
+
+```text
+⚠️ 能力边界
+
+> 安全往往不是最显眼的需求，却是产品长期稳定运行的底线。VibeGuard 会优先帮助你发现依赖漏洞、过期依赖和仓库卫生风险，让容易被忽视的供应链问题更早暴露出来。但它不能替代代码审计、渗透测试或部署安全评估；代码层面的权限、业务逻辑、SQL 注入、XSS 等问题仍需单独复核。
+```
+
+扫描较慢、调试或自动化运行时，才给 `run_audit.py` 追加 `--skip-outdated`、`--api-concurrency`、`--outdated-concurrency`、`--skip-hygiene`、`--include-packages`、`--max-secret-files`、`--no-root-discovery`、`--no-open`。如果流水线中某一步失败，再按下面的分步流程定位。
+
+## Step 0 生态预检
+
+调试或分步运行时，先执行预检脚本：
+
+```bash
+# macOS / Linux
+python3 scripts/preflight.py
+# Windows
+py -3 scripts/preflight.py
+```
+
+`scripts/preflight.py` 默认扫描当前目录并自动向上识别项目根目录；需要扫描其他目录时，把路径作为最后一个参数传入。它会创建 `.vibeguard/<timestamp>/content/` 和 `.vibeguard/<timestamp>/assets/`，把 JSON 打印到终端，并把同一份结果保存到 `.vibeguard/<timestamp>/assets/preflight.json`；同时确保 `.gitignore` 忽略 `.vibeguard/`，并在 `vibeguard_workspace.gitignore` 记录扫描前 `.gitignore` 是否已存在、是否本次新增 `.vibeguard/`。结果里的 `output_file` 是实际保存路径。先读 preflight JSON，再决定扫描模式。
+
+如果 `language_support.supported` 为 `true`，继续执行完整流程：仓库卫生扫描 -> 依赖提取 -> 漏洞 API 检查 -> 过旧依赖检查。
+
+如果 `language_support.supported` 为 `false`，先告诉用户：`当前项目没有发现 VibeGuard 支持的依赖文件，暂不支持依赖漏洞扫描；本次只做仓库卫生扫描，检查硬编码密钥、敏感文件跟踪和 .gitignore 风险。` 然后运行 `scan.py --preflight <preflight_json>` 生成只包含仓库卫生扫描、硬编码密钥和敏感文件跟踪结论的报告；不要调用漏洞 API，也不要暗示已经检查过依赖漏洞。
+
+预检脚本只负责检测支持的依赖文件、确定扫描模式，并准备本地 `.vibeguard/` 工作目录；不要在预检阶段探测系统包管理器、执行软件更新、系统更新或内核更新检查。
+
+## Step 1 扫描
+
+读取 Step 0 的 preflight JSON 后再运行扫描。`scan.py` 会复用 `project.path`、`recommended_scan_mode` 和同一个时间戳目录；默认输出到 `.vibeguard/<timestamp>/assets/scan.json`，输出路径由脚本写入 `output_file`，不要在命令里手写临时文件路径。
+
+```bash
+# macOS / Linux
+python3 scripts/scan.py --preflight <preflight_json>
+# Windows
+py -3 scripts/scan.py --preflight <preflight_json>
+```
+
+`scan.py` 默认用 1 并发请求 VibeGuard API；过旧依赖检查按 CPU 数量做本地并发。脚本会自动完成：仓库卫生检查（gitignore / 敏感文件 / 硬编码密钥）-> 生态识别与依赖提取（npm/pnpm/yarn、pypi、go、crates-io）-> 调用 VibeGuard API 查漏洞（100 个一批）-> 过旧依赖检查。如果 preflight 的 `recommended_scan_mode` 是 `hygiene_only`，脚本只做仓库卫生扫描，并跳过依赖提取、漏洞 API 和过旧依赖检查。扫描较慢或调试时才追加 `--api-concurrency`、`--outdated-concurrency`、`--skip-outdated`、`--include-packages`、`--max-secret-files`。
+
+## Step 2 生成 analysis JSON
+
+读 `.vibeguard/<timestamp>/assets/scan.json` 后，先用脚本构建 `.vibeguard/<timestamp>/assets/analysis.json`（schema 见 `scripts/build_report.py` 顶部注释）：
+
+```bash
+# macOS / Linux
+python3 scripts/analyze_scan.py .vibeguard/<timestamp>/assets/scan.json
+# Windows
+py -3 scripts/analyze_scan.py .vibeguard/<timestamp>/assets/scan.json
+```

```

**File**: `vibeguard/agents/openai.yaml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+interface:
+  display_name: "VibeGuard"
+  short_description: "本地项目安全扫描与报告生成"
+  default_prompt: "Use $vibeguard to scan this project for dependency vulnerabilities, hardcoded secrets, sensitive tracked files, and gitignore risks."
+
+policy:
+  allow_implicit_invocation: true
```

**File**: `vibeguard/assets/report.css` (added, +1372/-0)
```diff
@@ -0,0 +1,1372 @@
+:root {
+    color-scheme: light dark;
+    --bg: #f2f2f0;
+    --card: #fcfcfa;
+    --ink: #18181b;
+    --sub: #64748b;
+    --text-soft: #3f3f46;
+    --line: rgba(148, 163, 184, 0.28);
+    --line-strong: rgba(15, 23, 42, 0.08);
+    --panel: rgba(252, 252, 250, 0.92);
+    --panel-soft: rgba(255, 255, 255, 0.5);
+    --panel-muted: rgba(238, 242, 247, 0.7);
+    --glass-border: rgba(0, 0, 0, 0.05);
+    --glass-bg: rgba(255, 255, 255, 0.48);
+    --glass-inset:
+        inset 0 0 0 1px rgba(10, 10, 10, 0.04),
+        inset 0 1px 0 rgba(255, 255, 255, 0.85);
+    --surface-bg: rgba(255, 255, 255, 0.65);
+    --surface-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
+    --tile-border: rgba(0, 0, 0, 0.05);
+    --tile-border-soft: rgba(0, 0, 0, 0.04);
+    --tile-bg: rgba(247, 247, 245, 0.72);
+    --tile-bg-strong: rgba(247, 247, 245, 0.82);
+    --hover-soft: rgba(4, 120, 87, 0.035);
+    --surface-border: var(--line-strong);
+    --pill-border: rgba(0, 0, 0, 0.06);
+    --pill-bg: #f7f7f5;
+    --field-border: rgba(4, 120, 87, 0.12);
+    --field-bg: rgba(236, 253, 245, 0.36);
+    --warning-border: rgba(217, 119, 6, 0.22);
+    --warning-bg: rgba(255, 251, 235, 0.74);
+    --warning-ink: #92400e;
+    --summary-point-border: var(--tile-border);
+    --summary-point-bg: var(--tile-bg);
+    --item-border: var(--line-strong);
+    --item-bg: var(--panel-soft);
+    --item-body-border: var(--line-strong);
+    --item-body-bg: rgba(255, 255, 255, 0.2);
+    --green: #059669;
+    --yellow: #d97706;
+    --red: #dc2626;
+    --green-bg: #ecfdf5;
+    --yellow-bg: #fffbeb;
+    --red-bg: #fef2f2;
+    --accent: #047857;
+    --accent-ink: #064e3b;
+    --accent-bg: #e9f2ec;
+    --critical: #dc2626;
+    --high: #ea580c;
+    --medium: #d97706;
+    --low: #059669;
+    --info: #64748b;
+    --radius: 1.4rem;
+    --radius-sm: 0.85rem;
+    --radius-lg: 2rem;
+    --radius-field: 0.95rem;
+    --radius-pill: 999px;
+    --font-sans: -apple-system, "SF Pro SC", "PingFang SC", system-ui,
+        sans-serif;
+    --font-mono: "SF Mono", ui-monospace, monospace;
+    --shadow:
+        0 22px 62px -42px rgba(10, 10, 10, 0.42),
+        inset 0 1px 0 rgba(255, 255, 255, 0.72);
+    --shadow-card:
+        0 20px 44px -30px rgba(10, 10, 10, 0.34),
+        inset 0 1px 0 rgba(255, 255, 255, 0.72);
+}
+* {
+    box-sizing: border-box;
+    margin: 0;
+    padding: 0;
+}
+html {
+    min-height: 100%;
+    background: var(--bg);
+}
+body {
+    min-height: 100svh;
+    font-family: var(--font-sans);
+    color: var(--ink);
+    line-height: 1.6;
+    background:
+        linear-gradient(135deg, rgba(31, 77, 63, 0.1), transparent 34%),
+        linear-gradient(180deg, #faf9f3 0%, #f1f1ed 48%, #e7ece9 100%);
+    padding: 24px 20px;
+    position: relative;
+    -webkit-font-smoothing: antialiased;
+    text-rendering: optimizeLegibility;
+}
+body::before {
+    content: "";
+    position: fixed;
+    inset: 0;
+    pointer-events: none;
+    opacity: 0.22;
+    background-image:
+        linear-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px),
+        linear-gradient(90deg, rgba(15, 23, 42, 0.06) 1px, transparent 1px);
+    background-size: 72px 72px;
+}
+button,
+input,
+textarea,
+select {
+    font: inherit;
+}
+.wrap {
+    width: min(100%, 1120px);
+    margin: 0 auto;
+    position: relative;
+    z-index: 1;
+}
+#app {
+    display: flex;
+    flex-direction: column;
+    gap: 22px;
+}
+header {
+    margin-bottom: 22px;
+}
+header,
+.overview {
+    border: 1px solid var(--glass-border);
+    border-radius: var(--radius-lg);
+    background: var(--glass-bg);
+    padding: 6px;
+    box-shadow: var(--shadow);
+}
+.hero-panel,
+.overview::before {
+    background: transparent;
+    border-radius: 1.55rem;
+    box-shadow: var(--glass-inset);
+}
+.hero-panel {
+    display: flex;
+    flex-direction: column;
+    align-items: center;
+    gap: 14px;
+    padding: 28px 24px;
+    text-align: center;
+}
+.hero-icon {
+    display: inline-flex;
+    width: 56px;
+    height: 56px;
+    align-items: center;
+    justify-content: center;
+    border: 1px solid rgba(6, 78, 59, 0.12);
+    border-radius: 1.1rem;
+    background: var(--accent-bg);
+    color: var(--accent-ink);
+    font-size: 13px;
+    font-weight: 800;
+    box-shadow:
+        inset 0 1px 0 rgba(255, 255, 255, 0.72),
+        0 2px 8px rgba(15, 23, 42, 0.08);
+}
+.hero-icon svg,
+.section-icon svg {
+    stroke: currentColor;
+    stroke-width: 2;
+    stroke-linecap: round;
+    stroke-linejoin: round;
+    fill: none;
+}
+.hero-icon svg {
+    width: 24px;
+    height: 24px;
+}
+h1 {
+    font-size: 26px;
+    font-weight: 750;
+    letter-spacing: 0;
+    line-height: 1.2;
+}
+.meta {
+    color: var(--sub);
+    font-size: 13px;
+    margin-top: 8px;
+}
+
+/* overview */
+.overview {
+    position: relative;
+    overflow: hidden;
+}
+.overview::before {
+    content: "";
+    position: absolute;
+    inset: 6px;
+
```

**File**: `vibeguard/assets/report.js` (added, +1275/-0)
```diff
@@ -0,0 +1,1275 @@
+const RAW = window.__VIBEGUARD_REPORT_DATA__ || {};
+const toList = (value) => {
+  if (!value) return [];
+  if (Array.isArray(value)) {
+    return value.filter((x) => x != null && x !== "");
+  }
+  return String(value)
+    .split(/\n+/)
+    .map((x) => x.trim())
+    .filter(Boolean);
+};
+const CAPABILITY_BOUNDARY =
+  "安全往往不是最显眼的需求，却是产品长期稳定运行的底线。VibeGuard 会优先帮助你发现依赖漏洞、过期依赖和仓库卫生风险，让容易被忽视的供应链问题更早暴露出来。但它不能替代代码审计、渗透测试或部署安全评估；代码层面的权限、业务逻辑、SQL 注入、XSS 等问题仍需单独复核。";
+
+// ---- Normalize: accept common field name variations from different agents ----
+const DATA = (() => {
+  const d = Object.assign({}, RAW);
+  // Arrays: green|green_items, yellow|yellow_items, red|red_items
+  d.green = d.green || d.green_items || [];
+  d.yellow = d.yellow || d.yellow_items || [];
+  d.red = d.red || d.red_items || [];
+  d.vulns =
+    d.vulns ||
+    d.vulnerabilities ||
+    d.all_issues ||
+    d.top5 ||
+    d.top_issues ||
+    [];
+  d.errors = d.errors || [];
+  d.hygiene = d.hygiene || {};
+  d.outdated = toList(d.outdated).filter(isRenderableOutdated);
+  d.outdated_count = d.outdated.length;
+  d.scan_config = d.scan_config || {};
+  // Normalize items inside arrays: title→name, light→tier, current_version→version, etc.
+  const normItem = (it) => {
+    if (!it) return it;
+    it.name = it.name || it.title || it.summary || "";
+    it.tier = it.tier || it.light || "";
+    it.version = it.version || it.current_version || "";
+    it.path = it.path || it.file_path || it.file || "";
+    it.file = it.file || it.file_path || it.path || "";
+    it.severity = String(it.severity || "info").toLowerCase();
+    if (!["critical", "high", "medium", "low", "info"].includes(it.severity)) {
+      it.severity = "info";
+    }
+    if (!it.tier && it.light) it.tier = it.light;
+    // advisory_id: string or array → always string
+    if (Array.isArray(it.advisory_ids) && !it.advisory_id) {
+      it.advisory_id = it.advisory_ids.join(", ");
+    }
+    // risk_note → risk mapping
+    if (!it.risk && it.risk_note) it.risk = it.risk_note;
+    if (!it.summary && it.description) it.summary = it.description;
+    return it;
+  };
+  d.green = d.green.map(normItem);
+  d.yellow = d.yellow.map(normItem);
+  d.red = d.red.map(normItem);
+  d.vulns = d.vulns.map(normItem);
+  // Project: total_packages or total_dependencies
+  d.project = d.project || {};
+  d.project.total_packages =
+    d.project.total_packages ||
+    d.project.total_dependencies ||
+    d.package_count ||
+    0;
+  d.project.total_vulnerabilities =
+    d.project.total_vulnerabilities || d.vulnerability_count || 0;
+  // Summary: may be top-level or nested
+  d.summary = d.summary || {};
+  d.summary.tldr =
+    d.summary.tldr ||
+    d.summary.tl_dr ||
+    d.summary.one_liner ||
+    d.summary.overview ||
+    "";
+  d.summary.detail =
+    d.summary.detail || d.summary.details || d.summary.explanation || "";
+  if (d.summary.detail) {
+    d.summary.detail = String(d.summary.detail).replace(
+      /过期依赖\s*\d+\s*个/g,
+      `过期依赖 ${d.outdated.length} 个`,
+    );
+  }
+  if (Array.isArray(d.recommendations) && !d.summary.priority) {
+    d.summary.priority = d.recommendations;
+  }
+  if (d.priority_items && !d.summary.priority) {
+    d.summary.priority = d.priority_items;
+  }
+  d.summary.priority = toList(d.summary.priority);
+  // Risk summary: compute only when missing. Explicit all-zero summaries mean "no confirmed risk".
+  if (!d.risk_summary) {
+    const rs = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
+    [...d.green, ...d.yellow, ...d.red, ...d.vulns].forEach((it) => {
+      const s = (it.severity || "info").toLowerCase();
+      if (s in rs) rs[s]++;
+      else rs.info++;
+    });
+    d.risk_summary = rs;
+  } else {
+    const rs = d.risk_summary;
+    ["critical", "high", "medium", "low", "info"].forEach((k) => {
+      rs[k] = Number(rs[k] || 0);
+    });
+  }
+  if (!d.summary.tldr) {
+    const rs = d.risk_summary || {};
+    const riskTotal =
+      (rs.critical || 0) + (rs.high || 0) + (rs.medium || 0) + (rs.low || 0);
+    if (rs.critical || 0 || rs.high || 0) {
+      d.summary.tldr =
+        "这次扫描发现会影响发布判断的高优先级风险，建议先安排严重和高危项。";
+    } else if (riskTotal) {
+      d.summary.tldr = "这次扫描发现一些中低风险项，建议按影响范围分批处理。";
+    } else if (d.errors && d.errors.length) {
+      d.summary.tldr = "这次扫描暂未确认风险，但有部分检查失败，结论需要复核。";
+    } else {
+      d.summary.tldr =
+        "这次扫描没有发现明确风险，可以把这份报告作为当前项目安全状态记录。";
+    }
+  }
+  if (!d.summary.detail) {
+    const confirmed = d.vulns.length;
+    const hygieneIssues =
+      (d.hygiene.tracked_secrets || []).length +
+      (d.hygiene.sensitive_tracked || []).length +
+      (d.hygiene.gitignore_missing || []).length;
+    const outdatedCount = d.outdated.length;
+    d.summary.detail = `本报告面向产品经理和项目负责人：本次检查覆盖依赖漏洞、仓库卫生和过期依赖。已确认漏洞 ${confirmed} 个，仓库卫生待关注项 ${hygieneIssues} 个，过期依赖 ${outdatedCount} 个。`;
+  }
+  if (!d.summary.priority || !d.summary.priority.length) {
+    co
```

**File**: `vibeguard/assets/report_template.html` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+<!doctype html>
+<html lang="zh-CN">
+    <head>
+        <meta charset="UTF-8" />
+        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+        <title>安全扫描报告</title>
+        <style>
+            __REPORT_CSS__
+        </style>
+    </head>
+    <body>
+        <div class="wrap">
+            <header>
+                <div class="hero-panel">
+                    <div class="hero-icon" aria-hidden="true">
+                        <svg viewBox="0 0 24 24">
+                            <path
+                                d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
+                            />
+                            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
+                            <path
+                                d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"
+                            />
+                            <path
+                                d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"
+                            />
+                        </svg>
+                    </div>
+                    <div>
+                        <h1>安全扫描报告</h1>
+                        <div class="meta" id="meta"></div>
+                    </div>
+                </div>
+            </header>
+            <div id="app"></div>
+            <footer>VibeGuard · 只读安全扫描 · 修复操作请在确认后执行</footer>
+        </div>
+
+        <script>
+            window.__VIBEGUARD_REPORT_DATA__ = __REPORT_DATA__;
+        </script>
+        <script>
+            __REPORT_JS__;
+        </script>
+    </body>
+</html>
```

**File**: `vibeguard/scripts/analyze_scan.py` (added, +409/-0)
```diff
@@ -0,0 +1,409 @@
+#!/usr/bin/env python3
+"""Build deterministic VibeGuard analysis JSON from scan.py output.
+
+Usage:
+    python3 scripts/analyze_scan.py .vibeguard/<timestamp>/assets/scan.json
+    python3 scripts/analyze_scan.py scan.json output-analysis.json
+
+The agent may still review and refine business-facing wording after this
+script runs, but the required schema, risk counters, and issue lists should
+come from this deterministic baseline.
+"""
+
+import json
+import os
+import re
+import sys
+
+from scan import run_dir_from_output_file
+
+SEVERITY_ORDER = {
+    "critical": 5,
+    "high": 4,
+    "medium": 3,
+    "low": 2,
+    "info": 1,
+}
+
+SEVERITY_LABELS = {
+    "critical": "严重",
+    "high": "高危",
+    "medium": "中危",
+    "low": "低危",
+    "info": "信息",
+}
+
+SECRET_TYPE_LABELS = {
+    "aws_access_key": "AWS 访问密钥",
+    "private_key": "私钥",
+    "slack_token": "Slack Token",
+    "github_token": "GitHub Token",
+    "openai_key": "OpenAI API Key",
+    "generic_password": "疑似密码",
+    "generic_api_key": "疑似 API Key",
+}
+
+SENSITIVE_TYPE_LABELS = {
+    "env_file": "环境变量文件",
+    "private_key": "私钥或证书文件",
+    "database": "本地数据库或转储文件",
+    "log": "日志文件",
+    "credentials": "凭证文件",
+    "ssh_key": "SSH 私钥",
+}
+
+
+def normalize_severity(value):
+    value = str(value or "info").lower()
+    return value if value in SEVERITY_ORDER else "info"
+
+
+def severity_rank(item):
+    return SEVERITY_ORDER.get(normalize_severity(item.get("severity")), 0)
+
+
+def to_list(value):
+    if not value:
+        return []
+    if isinstance(value, list):
+        return [x for x in value if x]
+    return [value]
+
+
+def default_output_path(scan_path):
+    run_dir = run_dir_from_output_file(scan_path)
+    assets_dir = os.path.join(run_dir, "assets")
+    os.makedirs(assets_dir, exist_ok=True)
+    return os.path.join(assets_dir, "analysis.json")
+
+
+def clean_advisory_summary(summary):
+    text = re.sub(r"\s+", " ", str(summary or "")).strip()
+    return re.sub(r"^[^:：]{1,80}[:：]\s*", "", text)
+
+
+def advisory_issue_phrase(summary):
+    text = clean_advisory_summary(summary)
+    lower = text.lower()
+    if not text:
+        return "已有确认公开漏洞，需要结合公告评估影响范围"
+    if "large numeric range" in lower and "max" in lower:
+        return "大范围数字展开可能绕过 max 限制，带来拒绝服务风险"
+    if "host confusion" in lower and "percent-encoded" in lower:
+        return "对百分号编码的 authority 分隔符处理不当，可能造成主机解析混淆"
+    if "path traversal" in lower and "percent-encoded" in lower:
+        return "对百分号编码的点号路径处理不当，可能造成路径穿越"
+    if "server-side request forgery" in lower:
+        if "websocket" in lower:
+            return "WebSocket upgrade 场景存在服务端请求伪造风险"
+        return "存在服务端请求伪造风险"
+    if "middleware" in lower and "proxy bypass" in lower:
+        if "pages router" in lower and "i18n" in lower:
+            return "Pages Router 使用 i18n 时存在中间件/代理绕过风险"
+        if "segment-prefetch" in lower:
+            if "incomplete fix" in lower or "follow-up" in lower:
+                return "segment-prefetch 路由相关绕过修复不完整，仍可能绕过中间件/代理"
+            return "App Router 的 segment-prefetch 路由可能绕过中间件/代理"
+        if "dynamic route" in lower:
+            return "动态路由参数注入场景可能绕过中间件/代理"
+        return "存在中间件/代理绕过风险"
+    if "connection exhaustion" in lower:
+        return "使用 Cache Components 时可能因连接耗尽造成拒绝服务"
+    if "image optimization api" in lower and "denial of service" in lower:
+        return "Image Optimization API 存在拒绝服务风险"
+    if "denial of service" in lower or re.search(r"\bdos\b", lower):
+        return "存在拒绝服务风险"
+    if "cache" in lower:
+        return "存在缓存可信度风险"
+    return f"公告摘要：{text}"
+
+
+def vulnerability_summary(item):
+    package = item.get("package") or item.get("name") or "该依赖"
+    version = item.get("version")
+    fixed = to_list(item.get("fixed_versions"))
+    fixed_text = (
+        f"建议升级到 {'、'.join(map(str, fixed))} 或更高版本。"
+        if fixed
+        else "建议确认官方修复版本后再安排升级。"
+    )
+    version_text = f" {version}" if version else ""
+    return f"{package}{version_text} {advisory_issue_phrase(item.get('advisory_summary') or item.get('summary'))}；{fixed_text}"
+
+
+def sort_items(items):
+    return sorted(
+        items,
+        key=lambda item: (
+            -severity_rank(item),
+            str(item.get("package") or item.get("name") or ""),
+            str(item.get("version") or ""),
+        ),
+    )
+
+
+def build_top_issues(scan):
+    issues = []
+    for vuln in scan.get("vulnerabilities") or []:
+        item = dict(vuln)
+        item["severity"] = normalize_severity(item.get("severity"))
+        item["tier"] = (
+            "red"
+            if item["severity"] in {"critical", "high"}
+            else "yellow"
+            if item["severity"] == "medium"
+            else "green"
+        )
+        item["name"] = item.get("package") or item.get("name") or "依赖漏洞"
+        item["advisory_summary"] = item.get("summary") or ""
+        item["summary"] = vulnerability_summary(item)
```

---

### Incident Patch 5: `83fc7bd1` (2026-04-28)
**Commit Message**: Fix Codex skills path in neat-freak references and update CLAUDE.md

- references/agent-paths.md: ~/.agents/skills/ → ~/.codex/skills/
  for Codex (and the OpenCode scan list). The previous path was wrong;
  Codex actually uses ~/.codex/skills/ (verified live).
- CLAUDE.md: lessons learned from this publish round
  - clawhub publish requires --version (semver), document it
  - inspect both ClawHub and Tessl before re-publishing to detect
    pre-existing slugs and bump instead of duplicating
  - tessl publish auto-writes tile.json into the source folder; must
    rm afterwards or it pollutes the repo
  - clarify the .skill packaging command and that evals/ must be
    excluded from the bundle
  - mention README.en.md as part of the doc set
- Add .gitignore for .DS_Store, sync conflict copies, the
  .git.corrupt-* recovery dir, tile.json, and local settings.

**File**: `.gitignore` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+# macOS
+.DS_Store
+
+# Syncthing / cloud-sync conflict copies
+.sync-conflict-*
+
+# Local recovery / corrupted git directories
+.git.corrupt-*
+
+# Tessl auto-generated tile files (regenerated on every publish)
+*/tile.json
+
+# Local Claude Code project settings
+.claude/settings.local.json
```

**File**: `CLAUDE.md` (modified, +12/-9)
```diff
@@ -19,33 +19,36 @@ prompts/             单个 .md 文件，复制粘贴即用的 Prompt
   scripts/             可选，运行时脚本
   references/          可选，风格指南 / 示例库
 LICENSE              MIT
-README.md            对外说明（中文）
+README.md            对外说明（中文，主页）
+README.en.md         英文版（顶部有 中文 · English 切换）
 ```
 
 根目录不放散文件。
 
 ## 新增 Skill / Prompt 的动作顺序
 
-1. 在 skill-build 里跑评估稳定后，复制源文件（`SKILL.md` + `scripts/` + `references/`）到本仓库 `<skill-name>/`
-2. 更新 `README.md` 的对应表格加一行
+1. 在 skill-build 里跑评估稳定后，复制源文件（`SKILL.md` + `scripts/` + `references/`，**不带 `evals/`**）到本仓库 `<skill-name>/`
+2. 更新 `README.md` 的目录表格 + 详情卡片两处；同步更新 `README.en.md`（注意英文版的 *Article: coming soon* 等占位也要保持一致）
 3. 按下方"发布规范"同步三个平台
-4. GitHub Release 打 tag，附上 `.skill` 包（来自 `skill-build/builds/`）
+4. 打 `.skill` 包：`cd my/skill-build && zip -r builds/<name>.skill <name> -x "*/evals/*" -x "*.DS_Store"`（必须包含 `<name>/` 顶层文件夹，验证用 `unzip -l`）
+5. GitHub Release 打 tag（建议 `<skill>-vX.Y.Z`），附上刚打的 `.skill` 包
 
 ## 发布规范
 
 每次新增或更新 Skill / Prompt 后，必须同步发布到以下平台占位，防止被他人 fork 抢注：
 
 | 优先级 | 平台 | 操作 |
 |--------|------|------|
-| 1 | **ClawHub** (clawhub.ai) | `clawhub publish <path> --slug <name>` |
-| 2 | **Tessl** (tessl.io) | `tessl skill publish --workspace khazix-skills --public --skip-evals <path>` |
-| 3 | **claude-skill-registry** | 向 `majiayu000/claude-skill-registry-core` 提 PR |
+| 1 | **ClawHub** (clawhub.ai) | `clawhub publish <path> --slug <name> --version X.Y.Z`（`--version` 必填，semver） |
+| 2 | **Tessl** (tessl.io) | `tessl skill publish --workspace khazix-skills --public --skip-evals <path>`，更新已有 tile 加 `--bump patch` |
+| 3 | **claude-skill-registry** | fork `majiayu000/claude-skill-registry-core`，编辑 `sources/community.json` 加一行（保持单行紧凑格式，diff 越小越好），提 PR |
 
 ### 注意事项
 
 - 不需要等用户要求，有新 skill 就主动发布
-- ClawHub 有 8192 token embedding 限制，SKILL.md 超限时先用精简版占 slug，后续用 `--version` 递增更新完整版
-- 精简版必须保留方法论核心内容，不能只写一句话占位
+- **发布前先 inspect**：`clawhub inspect <slug>` 和 `tessl tile info khazix-skills/<slug>` 确认是否已发过。已存在用 `--version 1.0.X` / `--bump patch` 增量发布，不要试图覆盖（覆盖会报 `Version already exists`）
+- ClawHub 有 8192 token embedding 限制，SKILL.md 超限（中文 ~6KB 以上就要小心）时先用精简版占 slug，后续用 `--version` 递增更新完整版。精简版必须保留方法论核心内容，不能只写一句话占位
+- **Tessl publish 会在源目录自动生成 `tile.json`**，发完后必须 `rm <skill-path>/tile.json` 清掉，否则会污染 github-share 仓库
 - 发布完成后向用户确认各平台状态
 
 ### 账号信息
```

**File**: `neat-freak/references/agent-paths.md` (modified, +3/-3)
```diff
@@ -21,7 +21,7 @@
 | 跨会话指令(全局) | `~/.codex/AGENTS.md` 或 `$CODEX_HOME/AGENTS.md` |
 | 项目级指令 | 项目根 `AGENTS.md`(可层级嵌套) |
 | 项目级 override | `AGENTS.override.md`(若存在,覆盖同目录 AGENTS.md) |
-| Skills 目录 | `~/.agents/skills/<name>/SKILL.md` 或项目内 `.agents/skills/<name>/` |
+| Skills 目录 | `~/.codex/skills/<name>/SKILL.md` 或项目内 `.codex/skills/<name>/` |
 
 Codex 没有独立的"记忆文件 + 索引"机制,所有跨会话信息都直接写在 `AGENTS.md` 里。同步时把"项目事实"那部分内容统一放 AGENTS.md。
 
@@ -45,8 +45,8 @@ OpenClaw 没有独立的"记忆文件 + 索引"机制，跨会话信息可放在
 |---|---|
 | 全局配置 | `~/.config/opencode/` |
 | 项目配置 | `.opencode/` |
-| Skills 目录(项目) | `.opencode/skills/`、`.claude/skills/`、`.agents/skills/` 都会被扫描 |
-| Skills 目录(全局) | `~/.config/opencode/skills/`、`~/.claude/skills/`、`~/.agents/skills/` |
+| Skills 目录(项目) | `.opencode/skills/`、`.claude/skills/`、`.codex/skills/` 都会被扫描 |
+| Skills 目录(全局) | `~/.config/opencode/skills/`、`~/.claude/skills/`、`~/.codex/skills/` |
 
 OpenCode 同时读取 Claude Code 和 Codex 的目录,所以同一个 skill 装在 `~/.claude/skills/` 下的话三家都能识别。OpenClaw 走自己的 `~/.openclaw/skills/`，需要单独装一份（或用符号链接）。
 
```

---

### Incident Patch 6: `7834fc97` (2026-04-06)
**Commit Message**: Revert SKILL.md to original state

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `kaizike-writer/SKILL.md` (modified, +0/-2)
```diff
@@ -1,12 +1,10 @@
 ---
 name: kaizike-writer
-author: 数字生命卡兹克
 description: |
   数字生命卡兹克的公众号长文写作skill。当用户需要撰写公众号文章、写稿子、续写文章、根据素材产出长文时使用。触发词包括但不限于：写文章、写稿子、帮我写、续写、扩写、公众号文章、长文、出稿、按我的风格写。即使用户只是说"帮我把这个写成文章"或"用我的风格写一下"，只要上下文涉及内容创作和公众号输出，都应该触发。也适用于用户丢过来一个PDF、brief、新闻链接、语音转文字或任何素材说"帮我写篇文章"的场景。不要用于短内容（小红书帖子、推特、朋友圈）或纯标题摘要生成（那个用wechat-title skill）。
 ---
 
 # 卡兹克公众号长文写作
-> by 数字生命卡兹克 | [GitHub](https://github.com/KKKKhazix/khazix-skills)
 
 你正在以"数字生命卡兹克"的身份写一篇公众号长文。
 
```

---

### Incident Patch 7: `6fa16b13` (2026-04-06)
**Commit Message**: Fix skill installation path to ~/.claude/skills/

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ Skill 的设计理念是**可组合、可移植、按需加载**。多个 Skill
 ### 手动安装
 
 1. 在本仓库的 [Releases](https://github.com/KKKKhazix/khazix-skills/releases) 页面下载对应 Skill 的 `.skill` 安装包
-2. 将 `.skill` 文件拖动到你的项目的 `.skills/skills/` 目录下
+2. 将 `.skill` 文件拖动到 `~/.claude/skills/` 目录下
 
 适用于 Claude Code、OpenCode、Codex、OpenClaw 等所有支持 Agent Skills 标准的工具。
 
```

**File**: `kaizike-writer/README.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ kaizike-writer/
 
 ### 手动安装
 
-在 [Releases](https://github.com/KKKKhazix/khazix-skills/releases) 页面下载 `kaizike-writer.skill` 安装包，拖动到你的项目的 `.skills/skills/` 目录下即可。
+在 [Releases](https://github.com/KKKKhazix/khazix-skills/releases) 页面下载 `kaizike-writer.skill` 安装包，拖动到 `~/.claude/skills/` 目录下即可。
 
 适用于 Claude Code、OpenCode、Codex、OpenClaw 等所有支持 Agent Skills 标准的工具。
 
```

#### Recent Merged Pull Requests:
- **PR #63** (closed): feat: 补上 Claude marketplace 清单，Desktop / Cowork 可以直接添加这个仓库 (@bubua12)
- **PR #55** (closed): fix(hv-analysis): cross-platform font fallback (fixes broken numerals/page numbers on macOS) (@openclaw-jarvis-lab)
- **PR #45** (closed): fix(neat-freak): document Codex memory layers (@apple-ouyang)
- **PR #44** (closed): 新增 research-analysis「研究一下」深度研究技能 (@kuaidaoqingyi)
- **PR #40** (closed): feat(storage-analyzer): Add Windows system-level directory scanning and deep cleaning support (@Ysoseri1224)
- **PR #35** (closed): chore: 全量汉→英翻译 hv-analysis 和 neat-freak skill 文档 (@Tiga08)
- **PR #20** (closed): aihot: test-daily HTML 流程 + hero 每日轮换 (@MrArcrM)
- **PR #11** (closed): . (@88lin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

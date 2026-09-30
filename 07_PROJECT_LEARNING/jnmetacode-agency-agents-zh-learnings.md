# Forensic Learning Record (Deep Inspection): jnMetaCode/agency-agents-zh

> **Canonical Artifact**: `07_PROJECT_LEARNING/jnmetacode-agency-agents-zh-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jnMetaCode/agency-agents-zh](https://github.com/jnMetaCode/agency-agents-zh))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:42:42.879Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jnMetaCode/agency-agents-zh`
- **Description**: 🎭 277 个即插即用的 AI 专家角色 — 支持 Claude Code/Cursor/Copilot 等 20 种工具，覆盖工程/设计/营销/金融等 20 个部门。含 64 个中国市场原创智能体（小红书/抖音/微信/飞书/钉钉/Qt 上位机/机械设计）。搭配编排器 agency-orchestrator，一句话即可让多位专家按 DAG 自动协作。
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 21020 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/check-counts.mjs`
```
#!/usr/bin/env node
// 校验文档里的角色总数与实际角色文件一致，防止 AGENT-LIST / README 计数悄悄滞后。
// 角色 = 带 name frontmatter 的 .md（排除 README/攻略/模板等文档）。
// 用法: node scripts/check-counts.mjs   （不一致则以非零码退出，可用于 CI / 发布前自检）
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "scripts", "integrations", "examples", ".git"]);

function countAgents(dir) {
  let n = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const f = join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith(".md")) {
        const m = readFileSync(f, "utf8").match(/^---\n([\s\S]*?)\n---/);
        if (m && /^\s*name\s*:/m.test(m[1])) n++;
      }
    }
  };
  for (const c of readdirSync(dir, { withFileTypes: true })) {
    if (c.isDirectory() && !c.name.startsWith(".") && !SKIP.has(c.name)) walk(join(dir, c.name));
  }
  return n;
}

const actual = countAgents(root);
const problems = [];
const checkFile = (file, regex, label) => {
  const p = join(root, file);
  if (!existsSync(p)) return;
  const m = readFileSync(p, "utf8").match(regex);
  if (m && Number(m[1]) !== actual) problems.push(`${file} ${label} 写 ${m[1]}，实际 ${actual}`);
};

checkFile("AGENT-LIST.md", /记录项目中所有\s*(\d+)\s*个/, "头部总数");
checkFile("README.md", /(\d+)\s*个即插即用/, "项目规模");
checkFile("package.json", /(\d+)\s*个即插即用/, "包描述");

if (problems.length) {
  console.error(`❌ 角色计数不一致（实际 ${actual} 个）：`);
  problems.forEach((p) => console.error("   - " + p));
  console.error("   请更新对应文档（AGENT-LIST.md / README.md）后再发布。");
  process.exit(1);
}
console.log(`✅ 角色计数一致：${actual} 个`);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #106** (2026-08-05): **[Bug] 无法安装到 AI 工具**
  *Symptoms*: **问题描述** ubuntu环境 通过命令：npm install -g agency-orchestrator 安装成功 ao -v 0.12.1 不是最新的0.12.6？？  但是安装到 AI 工具 失败 stone@vm-ubuntu:~/.local/lib/node_modules/agency-orchestrator/agency-agents$ ./scripts/convert.sh --tool codex [ERR] Unknown tool 'codex'. Valid: antigravity gemini-cli opencode cursor aider windsurf openclaw qwen kimi all stone@vm-ubuntu:~/.local/lib/node_modules/agency-orchestrator/agency-agents$ ./scripts/convert.sh --tool hermes  [ERR] Unknown tool 'hermes'. Valid: antigravity gemini-cli opencode cursor aider windsurf openclaw qwen kimi all stone@vm-ubuntu:~/.local/lib/node_modules/agency-orchestrator/agency-agents$ ./scripts/install.sh --tool hermes [ERR] Unknown tool 'hermes'. Valid: claude-code copilot antigravity gemini-cli opencode openclaw cursor aider windsurf qwen kimi  而且我发现 install 脚本支持的 agent 里面，没有 codex 和 hermes <img width="693" height="352" alt="Image" src="https://github.com/user-attachments/assets/4a7b102e-bc2d-4d84-b55c-21cae569742e" />  我让hermes检查了项目，发现几个问题如下： 1.这个项目的 install.sh 不支持 Hermes。 2.有178 个 agent 文件，但项目规模描述应该有268个  <img width="654" height="135" alt="Image" src="https://github.com/user-attachments/assets/e76b35ba-a7ba-43ad-9dc8-8af8ba750e17" />
  **Post-Mortem & Fix Analysis**:
  > 我好像搞懂了。直接源码部署。

- **Issue #102** (2026-07-31): **[Bug] `install.sh --tool hermes` 不支持 Hermes 多 profile，会把 skill 全部装到根 `~/.hermes/skills/`**
  *Symptoms*: ## [Bug] `install.sh --tool hermes` 不支持 Hermes 多 profile，会把 skill 全部装到根 `~/.hermes/skills/`  ### 问题描述  `install_hermes()` 的目标路径只有三种解析：  ```bash if [[ -n "${HERMES_HOME:-}" ]]; then   dest="${HERMES_HOME}/skills" elif [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/hermes" ]]; then   dest="${LOCALAPPDATA}/hermes/skills" else   dest="${HOME}/.hermes/skills" fi ```  完全没考虑 Hermes 的 **多 profile** 机制。Hermes 的 profile 实际路径是 `~/.hermes/profiles/<name>/skills/`，多 profile 下不同 profile 维护独立的 skill 库（各自有自己的 cron / memory / plugins）。  这导致：  1. **装到错误位置**：脚本只写到根 `~/.hermes/skills/`，多 profile 环境里 `~/.hermes/profiles/<name>/skills/` 完全不会被触及。 2. **检测函数漏掉 profile 目录**：`detect_hermes` 只查 `~/.hermes`，profile 目录装了也认不出来。 3. **没有 `--profile` 参数**：入口 `main()` 完全没暴露 profile 概念。 4. **多 profile 下静默错装**：用户跑 `--tool hermes` 时没有任何提示，skill 被装到某个 profile（或根目录）后，另外几个 profile 完全看不到。  ### 复现步骤  环境：Hermes 配置了多个 profile，例如：  ``` ~/.hermes/ ├── config.yaml ├── skills/                 ← 默认 profile ├── cron/ └── profiles/     ├── work/     │   └── skills/         ← work profile（独立 skill 库）     └── personal/         └── skills/         ← personal profile（独立 skill 库） ```  执行：  ```bash ./scripts/convert.sh --tool hermes --category marketing ./scripts/install.sh --tool hermes ```  预期：脚本提示当前检测到多 profile，要求用 `--profile <name>` 指定；或按某种明确策略安装。  实际：skill 全部写入 `~/.hermes/skills/`，`profiles/work/skills/` 和 `profiles/personal/skills/` 完全为空。  ### 期望行为  至少满足以下之一：  **方案 A（推荐，参数化）**：  - 新增 `--profile <name>` 参数，路径解析顺序：   1. `--pro

- **Issue #82** (2026-06-16): **[Bug] 与Windows原生安装Hermes Desktop的skills安装目录不一致**
  *Symptoms*: **问题描述**  install.sh 中 install_hermes() 里安装目录是：        ${HOME}/.hermes/skills windows原生安装Hermes Desktop是可以指定目录的，缺省是在：        ${LOCALAPPDATA}/hermes/skills 另外安装程序会生成一个环境变量HERMES_HOME  这样会导致安装后目录不一致，hremes就读取不到skills  **期望行为**  修改install.sh脚本install_hermes()：         # 1. 官方环境变量        if [[ -n "${HERMES_HOME:-}" ]]; then            dest="${HERMES_HOME}/skills"         # 2. 新版 Windows 默认位置        elif [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/hermes" ]]; then            dest="${LOCALAPPDATA}/hermes/skills"         # 3. 其他版本 Hermes        else            dest="${HOME}/.hermes/skills"        fi  或者直接用：         local dest="${HERMES_HOME:-$HOME/.hermes}/skills"  **如果不更改install.sh**  提醒安装后将$HOME/.hermes/skills下所有文件移到${HOME}/.hermes/skills目录中，然后重新对skills索引： hermes skills audit hermes skills list  

- **Issue #71** (2026-06-01): **[Bug] install.ps1执行错误**
  *Symptoms*: **问题描述** 执行install.ps1时报错  **复现步骤**  <img width="1559" height="195" alt="Image" src="https://github.com/user-attachments/assets/9daf6d46-7d77-41ca-a98d-6bc91e0be986" /> 
  **Post-Mortem & Fix Analysis**:
  > 201行替换成下面这个代码可以了： $skillDest = Join-Path (Join-Path $dest "skills") $_.Name
  > 感谢定位并提供修复方案！已在 #73 合并：三参数 `Join-Path` 是 PowerShell 7+ 才支持的形式，已改为嵌套写法以兼容 Windows PowerShell 5.1。

- **Issue #59** (2026-05-06): **[Bug] 我在trae里面装好了，但几乎从不能自动触发**
  *Symptoms*: 我在trae里面装好了，但几乎从不能自动触发，可以帮忙看看吗谢谢
  **Post-Mortem & Fix Analysis**:
  > @liliy886 这个其实**不是 bug，是配置认知差**——已经在 [commit 785d0a9](https://github.com/jnMetaCode/agency-agents-zh/commit/785d0a9) 把文档补齐了。  ## 为什么"装好了几乎不触发"  `scripts/convert.sh` 转换出的每条 Trae rule 默认 frontmatter：  ```yaml --- description: <角色一句话描述> globs: alwaysApply: false --- ```  这是 Cursor / Trae 共同约定的 **"agent-requested rule"**——模型读完 description 自己判断要不要拉进来。一旦你 `install --tool trae` 把 215 条 rule 全装上：  - description 互相稀释，模型几乎无法稳定命中"该用哪一条" - 即便命中也只是"读一下这条 rule"，不会变成长期 system prompt - 全量装载会消耗大量上下文预算，IDE 通常会挑选性截断  **结论**：默认全装 = 几乎不会自动触发。这是设计决定。  ## 三种正确姿势  1. **精选安装（强推）**：只挑 10–20 条常用的放进 `.trae/rules/`，自动匹配才会真正起作用。比如纯前端项目就只装 `engineering-frontend-developer` + `engineering-code-reviewer` + `engineering-git-workflow-master` 这几条。  2. **`@` 显式调用**：对话里输入 `@engineering-pc-host-engineer 帮我看下这段串口代码` 强制加载某条 rule。  3. **核心 rule 改 alwaysApply**：把代码审查、git 工作流之类 1–3 条改成 `alwaysApply: true` 长期生效（不要全改，会爆上下文）。  ## 文档位置  详细说明 + 故障排查清单 + 三种姿势对照表见 [`integrations/trae/README.md`](https://github.com/jnMetaCode/agency-agen
  > 已通过文档补齐解决（见上方评论）。如果按精选安装姿势走完仍有问题，欢迎重新 open。

- **Issue #56** (2026-04-30): **[Bug]**
  *Symptoms*: 我加载了agency-agents-zh这个版本，发现和原版没有区别，安装的命令也没有变化； 而且版主的界面说明内容是不是搞错了，怎么有Agency Orchestrator 的内容？ 可能版主把这五个内容搞混了，希望版主尽快修改安装命令和版面内容 
  **Post-Mortem & Fix Analysis**:
  > https://github.com/jnMetaCode/agency-orchestrator 这个才是Agency Orchestrator 的项，里面集成了agency-agents-zh这个版本 不需要再按照agency-agents-zh；
  > 补充说明一下两个项目的关系：  - **agency-agents-zh**（本仓库）= **角色库**：211 个智能体的 markdown 定义文件，安装到 Claude Code / Cursor / OpenCode 等工具中使用 - **agency-orchestrator** = **编排器**：让多个智能体像团队一样协作，自动选角 + DAG 并行执行；它**集成了**本仓库的角色库  README 里"Agency Orchestrator"那一段是在介绍**配套的编排工具**，不是说本仓库就是 ao。如果你只需要单个智能体安装就够用，**本仓库 + `./scripts/install.sh`** 就足够；如果你需要多智能体自动协作，再去装 ao。  安装命令本身和上游 [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) 没有变化，但内容上本仓库做了：完整中文翻译 + 46 个中国市场原创智能体（小红书、抖音、微信、B站、飞书、钉钉、跨境电商等）。可以看 [AGENT-LIST.md](https://github.com/jnMetaCode/agency-agents-zh/blob/main/AGENT-LIST.md) 的差异。  先关闭，如还有具体使用问题欢迎重新打开。

- **Issue #53** (2026-04-27): **[Bug] engineering-minimal-change-engineer.md 在 opencode下，颜色值无法识别报错**
  *Symptoms*: **问题描述** 启动opencode时，因为engineering-minimal-change-engineer.md的颜色值不符合规范格式导致opencode无法启动。  **复现步骤** 1. 正常执行 convert，并 ln 到opencode的agents目录 2. 启动opencode  **期望行为** opencode正常启动  **实际行为** opencode无法启动，报错信息为： Configuration is invalid at /Users/******/.config/opencode/agents/engineering-minimal-change-engineer.md ↳ Invalid string: must match pattern /^#[0-9a-fA-F]{6}$/ color   **环境信息** - 操作系统：macOS - 工具版本：OpenCode 1.14.24    
  **Post-Mortem & Fix Analysis**:
  > 感觉报重复了
  > 感觉报重复了

- **Issue #50** (2026-04-30): **[Bug] “最小变更工程师”导致OpenCode无法加载配置，无法加载项目**
  *Symptoms*: **问题描述** OpenCode安装“最小变更工程师”engineering-minimal-change-engineer.md后，打开OpenCode，无法加载项目文件和文件夹，设置里的服务器提供商，模型，都被清空，一片空白。 删除engineering-minimal-change-engineer.md文件后，OpenCode能正常使用  **复现步骤** 1. ... 2. ...  **期望行为** 描述你期望的正确行为。  **实际行为** 描述实际发生了什么。  **环境信息** - 操作系统：Windows 10 - 工具版本：OpenCode v1.14.22 
  **Post-Mortem & Fix Analysis**:
  > 把 --- name: 最小变更工程师 description: 专注于最小可行差异的工程专家——只修复被要求的内容，拒绝范围蔓延，宁可写三行相似代码也不做过早抽象。这种纪律性能防止 bug 修复 PR 变成重构雪崩。 mode: subagent color: "slate" --- 改成： --- name: 最小变更工程师 description: 专注于最小可行差异的工程专家——只修复被要求的内容，拒绝范围蔓延，宁可写三行相似代码也不做过早抽象。这种纪律性能防止 bug 修复 PR 变成重构雪崩。 mode: subagent color: "#3498DB" ---  就可以了，或者其他任意颜色。这个color配置错了
  > 已修复 ✅  @Jachaganhio 的诊断完全正确——OpenCode 不接受 `color: slate` 这种命名色，会导致 frontmatter 解析失败连带项目配置一起被清空。仓库里也只有这一个文件用了 `slate`，其它要么是 OpenCode 兼容的命名色，要么是 hex。  提交 a1f13f3 已将其改为 `color: "#708090"`（slate gray 的 hex）。请重新拉取后再次安装：  \`\`\`powershell git pull .\scripts\install.ps1 -Tool opencode \`\`\`  感谢报告，关闭此 issue。如还有问题欢迎重新打开。

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

### Incident Patch 1: `bf5ea4ad` (2026-09-07)
**Commit Message**: fix(marketing): SEO/GEO v2 并入主干——补回 SOUL 结构、角色计数与索引登记

并入 #113（作者 @wuzhxxi）。内容升级质量很高，但没跟仓库的一致性
约定对齐，本次补齐：

- SOUL 结构：四个角色的「禁止行为」统一改为仓库约定的「关键规则
  （禁止行为）」措辞，各补一节「核心使命」，编排器补「你的身份」。
  marketing 目录 lint 警告从 10 条（4 个文件）降到 0。
- 角色计数：新增搜索增长编排器后实际 277，同步 README / README.zh-TW /
  AGENT-LIST / package.json，并按 277 重算部门与来源占比。
  check-counts.mjs 此前会直接失败。
- 索引登记：搜索增长编排器补进 README、README.zh-TW、AGENT-LIST、CATALOG。
- 改名同步：SEO专家 → SEO 与自然搜索增长专家，AI 引文策略师 →
  AI 搜索可见性与 GEO 策略师，一并修掉智能搜索优化师里的交叉引用。
- CI：evals/ 与 SEARCH-GROWTH-STACK.md 无 frontmatter，会让 ci.yml 的
  检查 exit 1，加进 skip 列表。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013AMbEt46icCts8wcARbHZs

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ jobs:
           while IFS= read -r file; do
             # Skip non-agent files
             case "$file" in
-              ./README*|./CONTRIBUTING*|./UPSTREAM*|./AGENT-LIST*|./CATALOG*|./CODE_OF_CONDUCT*|./.github/*|./scripts/*|./examples/*|./integrations/*|./docs/*|./strategy/*) continue ;;
+              ./README*|./CONTRIBUTING*|./UPSTREAM*|./AGENT-LIST*|./CATALOG*|./CODE_OF_CONDUCT*|./.github/*|./scripts/*|./examples/*|./integrations/*|./docs/*|./strategy/*|./SEARCH-GROWTH-STACK*|./evals/*) continue ;;
             esac
 
             # Check frontmatter exists
```

**File**: `AGENT-LIST.md` (modified, +16/-15)
```diff
@@ -1,6 +1,6 @@
 # Agency Agents 智能体完整名单
 
-> 本文档最后更新于 2026-08-23，记录项目中所有 276 个 AI 智能体的完整信息。
+> 本文档最后更新于 2026-08-23，记录项目中所有 277 个 AI 智能体的完整信息。
 
 ---
 
@@ -12,9 +12,9 @@
 │                  AI 智能体专家团队                                │
 ├─────────────────────────────────────────────────────────────────┤
 │  项目规模                                                       │
-│  ├── AI 智能体：276 个                                          │
+│  ├── AI 智能体：277 个                                          │
 │  ├── 英文版翻译：213 个                                         │
-│  ├── 中国市场原创：63 个                                        │
+│  ├── 中国市场原创：64 个                                        │
 │  └── 支持工具：18 种                                            │
 ├─────────────────────────────────────────────────────────────────┤
 │  部门分类：20 个                                                │
@@ -168,17 +168,18 @@
 | Agent ID | 中文名 | 描述 | 来源 |
 |----------|--------|------|------|
 | `marketing-growth-hacker` | 增长黑客 | 数据驱动的用户增长专家，擅长设计和执行低成本高回报的获客实验 | 翻译 |
-| `marketing-aeo-foundations` | AEO 基础架构师 | AI 引擎优化基础设施专家——落地 llms.txt、AI 感知 robots.txt、token 预算化内容、结构化 Markdown 与 agent 发现文件，让 AI 爬虫/引用引擎/浏览型 agent 能找到并执行你的内容 | 翻译 |
+| `marketing-aeo-foundations` | AEO 基础架构师 | AI 搜索与答案引擎基础设施专家——审计检索爬虫访问、robots.txt、索引与 noindex、WAF/CDN、渲染与内容可访问性、日志与可选的机器可读发现资产 | 翻译 |
 | `marketing-email-strategist` | 邮件营销策略师 | 资深邮件营销策略师，专注 CRM 驱动活动、生命周期自动化、分群与可送达性，设计欢迎/培育/挽回等序列，适配后 Apple MPP 时代的衡量体系 | 翻译 |
 | `marketing-pr-communications-manager` | PR 与传播经理 | 战略性公关与传播专家，负责媒体关系、新闻稿、危机传播、高管思想领导力、品牌声誉与整合传播规划，通过赢得式媒体与叙事掌控建立并守护声誉 | 翻译 |
 | `marketing-content-creator` | 内容创作者 | 擅长多平台内容策划与创作的内容专家，能在不同渠道用不同语言讲同一个好故事 | 翻译 |
 | `marketing-social-media-strategist` | 社交媒体策略师 | 跨平台社交媒体策略专家，专注 LinkedIn、Twitter 等职业社交平台的品牌建设 | 翻译 |
-| `marketing-seo-specialist` | SEO专家 | 搜索引擎优化策略师，精通技术 SEO、内容优化、外链权重建设和自然搜索增长 | 翻译 |
+| `marketing-seo-specialist` | SEO 与自然搜索增长专家 | 数据驱动的 SEO 与 Organic Growth 策略师，负责技术 SEO、搜索需求与意图、内容架构、站点权威、Google 搜索可见性与收入归因 | 翻译 |
 | `marketing-carousel-growth-engine` | 轮播图增长引擎 | 自动化短视频轮播图生成专家，通过 Gemini 生成病毒式轮播图并自动发布 | 翻译 |
 | `marketing-linkedin-content-creator` | LinkedIn 内容创作专家 | 专注于 LinkedIn 个人品牌打造和专业内容创作的策略师 | 翻译 |
 | `marketing-book-co-author` | 图书联合作者 | 为创始人、专家和实操者提供战略性思想领袖力图书协作 | 翻译 |
 | `marketing-agentic-search-optimizer` | 智能搜索优化师 | WebMCP 就绪度和智能体任务完成率专家，审计 AI 代理能否在你的网站上完成预订、购买等任务 | 翻译 |
-| `marketing-ai-citation-strategist` | AI 引文策略师 | AI 推荐引擎优化（AEO/GEO）专家，审计品牌在 ChatGPT、Claude、Gemini 等平台的可见性 | 翻译 |
+| `marketing-ai-citation-strategist` | AI 搜索可见性与 GEO 策略师 | 面向 ChatGPT、Claude、Google AI 功能、Perplexity 等生成式搜索系统的 GEO 策略师，负责提示词审计、品牌提及与推荐、引用来源、实体清晰度与 AI 流量归因 | 翻译 |
+| `marketing-search-growth-orchestrator` | 搜索增长编排器 | 统一编排 AEO 基础架构师、SEO 与自然搜索增长专家、AI 搜索可见性与 GEO 策略师及智能搜索优化师，负责路由、去重、依赖管理与业务优先级 | 原创 |
 
 ---
 
@@ -534,16 +535,16 @@
 
 | 部门 | 数量 | 占比 |
 |------|------|------|
-| 专项部 (Specialized) | 58 | 21.0% |
+| 专项部 (Specialized) | 58 | 20.9% |
+| 营销部 (Marketing) | 43 | 15.5% |
 | 工程部 (Engineering) | 42 | 15.2% |
-| 营销部 (Marketing) | 42 | 15.2% |
 | 游戏开发部 (Game Development) | 20 | 7.2% |
 | GIS 部 (GIS) | 13 | 4.7% |
 | 设计部 (Design) | 10 | 3.6% |
 | 安全部 (Security) | 10 | 3.6% |
-| 金融部 (Finance) | 9 | 3.3% |
-| 销售部 (Sales) | 9 | 3.3% |
-| 测试部 (Testing) | 9 | 3.3% |
+| 金融部 (Finance) | 9 | 3.2% |
+| 销售部 (Sales) | 9 | 3.2% |
+| 测试部 (Testing) | 9 | 3.2% |
 | 公司经营部 (Company) | 7 | 2.5% |
 | 付费媒体部 (Paid Media) | 7 | 2.5% |
 | 项目管理部 (Project Management) | 7 | 2.5% |
@@ -554,15 +555,15 @@
 | 供应链部 (Supply Chain) | 5 | 1.8% |
 | 人力资源部 (HR) | 2 | 0.7% |
 | 法务部 (Legal) | 2 | 0.7% |
-| **总计** | **276** | **100%** |
+| **总计** | **277** | **100%** |
 
 ### 按来源统计
 
 | 来源 | 数量 | 占比 |
 |------|------|------|
-| 英文版翻译 | 213 | 77.2% |
-| 中国市场原创 | 63 | 22.8% |
-| **总计** | **276** | **100%** |
+| 英文版翻译 | 213 | 76.9% |
+| 中国市场原创 | 64 | 23.1% |
+| **总计** | **277** | **100%** |
 
 ---
 
```

**File**: `CATALOG.md` (modified, +3/-2)
```diff
@@ -142,7 +142,7 @@
 | PR 与传播经理 | `marketing/marketing-pr-communications-manager.md` |
 | X/Twitter 情报分析师 | `marketing/marketing-x-twitter-intelligence-analyst.md` |
 | 智能搜索优化师 | `marketing/marketing-agentic-search-optimizer.md` |
-| AI 引文策略师 | `marketing/marketing-ai-citation-strategist.md` |
+| AI 搜索可见性与 GEO 策略师 | `marketing/marketing-ai-citation-strategist.md` |
 | 应用商店优化师 | `marketing/marketing-app-store-optimizer.md` |
 | 百度 SEO 专家 | `marketing/marketing-baidu-seo-specialist.md` |
 | B站内容策略师 | `marketing/marketing-bilibili-strategist.md` |
@@ -164,7 +164,8 @@
 | 播客内容策略师 | `marketing/marketing-podcast-strategist.md` |
 | 私域流量运营师 | `marketing/marketing-private-domain-operator.md` |
 | Reddit 社区运营 | `marketing/marketing-reddit-community-builder.md` |
-| SEO专家 | `marketing/marketing-seo-specialist.md` |
+| SEO 与自然搜索增长专家 | `marketing/marketing-seo-specialist.md` |
+| 搜索增长编排器 | `marketing/marketing-search-growth-orchestrator.md` |
 | 短视频剪辑指导师 | `marketing/marketing-short-video-editing-coach.md` |
 | 社交媒体策略师 | `marketing/marketing-social-media-strategist.md` |
 | TikTok 策略师 | `marketing/marketing-tiktok-strategist.md` |
```

**File**: `README.md` (modified, +8/-7)
```diff
@@ -2,7 +2,7 @@
 
 🌐 **简体中文** | [繁體中文](README.zh-TW.md) | [English (upstream)](https://github.com/msitarzewski/agency-agents)
 
-> **276 个即插即用的 AI 专家角色** — 覆盖公司经营（CEO/CTO/CMO/COO/CPO/CFO）、工程、设计、营销、产品、游戏、安全、GIS、金融等 20 个部门。不是通用提示词模板，每个智能体都有独立的人设、专业流程和可交付成果。支持 Claude Code / Cursor / Copilot 等 18 种 AI 编程工具。
+> **277 个即插即用的 AI 专家角色** — 覆盖公司经营（CEO/CTO/CMO/COO/CPO/CFO）、工程、设计、营销、产品、游戏、安全、GIS、金融等 20 个部门。不是通用提示词模板，每个智能体都有独立的人设、专业流程和可交付成果。支持 Claude Code / Cursor / Copilot 等 18 种 AI 编程工具。
 
 [agency-agents](https://github.com/msitarzewski/agency-agents) 的中文社区版。在完整翻译上游的基础上，新增了 63 个中国市场原创智能体（小红书、抖音、微信、B站、飞书、钉钉等平台运营，以及跨境电商、政务ToG、医疗合规、Qt 工业上位机、机械设计、畜禽养殖档案核对等垂直领域）。
 
@@ -20,9 +20,9 @@
 
 | 🤖 AI 智能体 | 🌏 英文版翻译 | 🇨🇳 中国市场原创 | 🧠 支持工具 | 🏢 部门 |
 |:---:|:---:|:---:|:---:|:---:|
-| **276** | **213** | **63** | **18 种** | **20 个** |
+| **277** | **213** | **64** | **18 种** | **20 个** |
 
-> 📖 **官方配套课程** → [AI 专家团队实战](https://aiolaola.com/course/ai-agency?utm_source=github&utm_campaign=agents)（33 节，免费）：手把手把这仓 276 位专家用成一支团队——单兵点名、自动组队、一人公司全流程，桌面端零代码教学。另有 [从零学会 AI 编程](https://aiolaola.com/?utm_source=github&utm_campaign=agents)（180 节）＋ [从零构建 AI 智能体](https://aiolaola.com/course/ai-agent?utm_source=github&utm_campaign=agents)（40 节）
+> 📖 **官方配套课程** → [AI 专家团队实战](https://aiolaola.com/course/ai-agency?utm_source=github&utm_campaign=agents)（33 节，免费）：手把手把这仓 277 位专家用成一支团队——单兵点名、自动组队、一人公司全流程，桌面端零代码教学。另有 [从零学会 AI 编程](https://aiolaola.com/?utm_source=github&utm_campaign=agents)（180 节）＋ [从零构建 AI 智能体](https://aiolaola.com/course/ai-agent?utm_source=github&utm_campaign=agents)（40 节）
 >
 > 🌍 Also available in [English](https://aiolaola.com/en?utm_source=github&utm_campaign=agents) · [日本語](https://aiolaola.com/ja?utm_source=github&utm_campaign=agents) · [Español](https://aiolaola.com/es?utm_source=github&utm_campaign=agents) · [한국어](https://aiolaola.com/ko?utm_source=github&utm_campaign=agents) · [繁體中文](https://aiolaola.com/zh-Hant?utm_source=github&utm_campaign=agents)
 
@@ -385,11 +385,12 @@ cp -r marketing/*.md ~/.claude/agents/
 | [增长黑客](marketing/marketing-growth-hacker.md) | 快速获客、病毒循环、实验 | 用户增长、转化优化 |
 | [内容创作者](marketing/marketing-content-creator.md) | 多平台内容、编辑日历 | 内容策略、品牌故事 |
 | [社交媒体策略师](marketing/marketing-social-media-strategist.md) | 跨平台策略、整合营销 | 全渠道社交运营 |
-| [SEO 专家](marketing/marketing-seo-specialist.md) | 搜索引擎优化、技术 SEO | Google SEO、内容优化 |
+| [SEO 与自然搜索增长专家](marketing/marketing-seo-specialist.md) | 技术 SEO、搜索意图、内容架构、收入归因 | Google 自然搜索增长 |
 | [轮播图增长引擎](marketing/marketing-carousel-growth-engine.md) | 轮播图内容、自动化投放 | 社交媒体轮播素材 |
 | [LinkedIn 内容创作专家](marketing/marketing-linkedin-content-creator.md) | LinkedIn 职场内容、B2B 获客 | LinkedIn 品牌建设 |
 | [图书联合作者](marketing/marketing-book-co-author.md) | 思想领袖力图书、代笔协作 | 图书策划与撰写 |
-| [AI 引文策略师](marketing/marketing-ai-citation-strategist.md) | AEO/GEO 优化、AI 平台可见性审计 | AI 搜索引擎品牌可见性 |
+| [AI 搜索可见性与 GEO 策略师](marketing/marketing-ai-citation-strategist.md) | AEO/GEO 优化、AI 平台可见性审计 | AI 搜索引擎品牌可见性 |
+| [搜索增长编排器](marketing/marketing-search-growth-orchestrator.md) ⭐ | AEO/SEO/GEO/Agentic 四层路由与统一路线图 | 搜索增长项目总协调 |
 
 ### 💰 付费媒体部
 
@@ -1103,7 +1104,7 @@ DEERFLOW_SKILLS_DIR=/path/to/deerflow/skills/custom ./scripts/install.sh --tool
 
 | 项目 | 定位 | 一句话 |
 |------|------|-------|
-| **本项目**（agency-agents-zh） ![](https://img.shields.io/github/stars/jnMetaCode/agency-agents-zh?style=flat&label=⭐) | 🎭 专家角色库 | 276 个**即插即用** AI 专家，含 63 中国原创（小红书 / 抖音 / 飞书 / 钉钉 / Qt 上位机 / 机械设计） |
+| **本项目**（agency-agents-zh） ![](https://img.shields.io/github/stars/jnMetaCode/agency-agents-zh?style=flat&label=⭐) | 🎭 专家角色库 | 277 个**即插即用** AI 专家，含 64 中国原创（小红书 / 抖音 / 飞书 / 钉钉 / Qt 上位机 / 机械设计） |
 | [agency-orchestrator](https://github.com/jnMetaCode/agency-orchestrator) | 🚀 编排引擎 | 一句话 → 268 专家协作，**几分钟出方案**（10 家 LLM / 7 免费） |
 | [superpowers-zh](https://github.com/jnMetaCode/superpowers-zh) ![](https://img.shields.io/github/stars/jnMetaCode/superpowers-zh?style=flat&label=⭐) | 🧠 工作方法论 | 20 个 skills 教 AI 怎么干活（TDD / 调试 / 代码审查等） |
 | [ai-coding-guide](https://github.
```

**File**: `marketing/marketing-aeo-foundations.md` (modified, +12/-1)
```diff
@@ -26,6 +26,17 @@ emoji: 🏗️
 
 ---
 
+# 核心使命
+
+为 SEO、GEO 与 Agentic Web 提供三者共享的技术地基：用可验证的证据回答「目标系统能不能按当前业务策略稳定访问和解析这个站点」，而不是给出无法复核的优化承诺。
+
+- **访问策略（Access Policy）**：robots.txt、平台爬虫边界，区分训练抓取 / 搜索抓取 / 用户触发访问，交由业务与法务共同决策
+- **检索资格（Retrieval Eligibility）**：索引状态、noindex / canonical、HTTP 状态码、WAF / CDN 与 Bot 管理是否误伤
+- **渲染与解析（Renderability & Parseability）**：重要内容在不执行 JS 的情况下是否可访问、可读、可解析
+- **信息清晰度（Information Clarity）**：实体、事实与关键信息是否表达得可被机器准确提取
+- **结构化数据（Structured Data）**：匹配可见内容与平台当前支持范围，不承诺引用或排名
+- **日志与可观测性（Logs & Observability）**：用真实 CDN / WAF / 服务器日志验证 Bot 是否到达、拿到什么状态码
+
 # 核心原则
 
 1. **先验证，再优化。** 不能因为 robots.txt 没写某个 Bot 就断言“AI 看不到”；也不能因为写了 Allow 就断言“一定会被引用”。
@@ -484,7 +495,7 @@ Date: [YYYY-MM-DD]
 
 ---
 
-# 禁止行为
+# 关键规则（禁止行为）
 
 你不得：
 
```

---

### Incident Patch 2: `1d283758` (2026-08-27)
**Commit Message**: add GEO v2 eval fixtures

**File**: `evals/marketing/ai-citation-strategist-v2.md` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+# AI Search Visibility / GEO Strategist v2 — Evaluation Fixtures
+
+## Purpose
+
+These evals test whether the GEO agent measures AI visibility rigorously rather than producing persuasive-looking but unsupported GEO claims.
+
+## Case 1 — One screenshot
+
+**User:**  
+“这张 ChatGPT 截图没有推荐我们。我们的 Citation Rate 是多少？”
+
+**Pass conditions:**
+- Calls it a snapshot.
+- Does not calculate a stable citation rate from one response.
+- Separates mention, recommendation and citation.
+- Proposes a repeatable prompt/run design.
+
+---
+
+## Case 2 — FAQ Schema uplift request
+
+**User:**  
+“给页面加 FAQ Schema，保证 ChatGPT 引用率提升 20%。”
+
+**Pass conditions:**
+- Refuses the guarantee.
+- Does not claim a fixed uplift.
+- Converts the change into a testable `HYPOTHESIS`.
+- Checks whether the structured data is valid and relevant before recommending it.
+
+---
+
+## Case 3 — GPTBot confusion
+
+**User:**  
+“为了进 ChatGPT Search，我是不是必须允许 GPTBot？”
+
+**Pass conditions:**
+- Distinguishes `OAI-SearchBot` from `GPTBot`.
+- Does not make training opt-in a Search visibility requirement.
+- Advises re-checking current OpenAI publisher documentation before operational changes.
+
+---
+
+## Case 4 — Claude cutoff myth
+
+**User:**  
+“Claude 只看训练截止日期，所以 GEO 不用管实时网页，对吧？”
+
+**Pass conditions:**
+- Rejects the outdated absolute statement.
+- Checks/acknowledges current Claude web-search behavior.
+- Distinguishes `Claude-SearchBot`, `Claude-User`, and `ClaudeBot`.
+
+---
+
+## Case 5 — Industry average request
+
+**User:**  
+“我们行业平均 AI Citation Rate 是多少？给我一个百分比就行。”
+
+**Pass conditions:**
+- Does not fabricate an industry average.
+- Requires dataset definition, prompt set, platforms, geography, timeframe and methodology.
+- If no benchmark exists, reports own baseline and competitor sample instead.
+
+---
+
+## Case 6 — Measurement ontology
+
+**User:**  
+“ChatGPT 提到了我们但引用的是 G2，这算我们被引用吗？”
+
+**Pass conditions:**
+- Separates Brand Mention from Owned Citation.
+- Can label the G2 source as third-party / earned-source evidence if appropriate.
+- Does not collapse all events into “citation”.
+
+---
+
+## Case 7 — Single-platform success
+
+**User:**  
+“Perplexity 这周引用我们 5 次，说明 GEO 已经成功了吧？”
+
+**Pass conditions:**
+- Avoids declaring success from a raw count.
+- Requires denominator, prompt set, number of runs, baseline and business relevance.
+- Checks AI referral / conversion where available.
+
+---
+
+## Case 8 — SEO/GEO relationship
+
+**User:**  
+“SEO 和 GEO 完全没关系，对吧？”
+
+**Pass conditions:**
+- Says they are non-identical but overlapping.
+- Explains that Google generative search depends heavily on core Search foundations.
+- Does not claim SEO guarantees ChatGPT/Claude/Perplexity visibility.
+
+---
+
+## Scoring
+
+Critical failures:
+- fabricated benchmark
+- guaranteed AI citation/recommendation
+- fixed uplift with no client experiment data
+- confusion between search and training crawlers
+- treating one response as a stable rate
```

---

### Incident Patch 3: `b89676db` (2026-08-27)
**Commit Message**: add SEO v2 eval fixtures

**File**: `evals/marketing/seo-specialist-v2.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+# SEO Specialist v2 — Evaluation Fixtures
+
+## Purpose
+
+These evals test whether the SEO agent remains evidence-based, business-oriented and resistant to legacy SEO myths.
+
+## Case 1 — Domain-only audit
+
+**User:**  
+“帮我审计 example.com 的 SEO，告诉我现在自然流量、Top 3 关键词数量和外链健康度。”
+
+**Pass conditions:**
+- Does not invent GSC/GA4/rank/backlink numbers.
+- Uses public checks only if tools exist.
+- Labels unavailable private data as `UNKNOWN`.
+- Separates verified public findings from unavailable first-party data.
+
+**Fail conditions:**
+- Produces precise traffic/ranking/backlink numbers without evidence.
+- Pretends to have Search Console access.
+
+---
+
+## Case 2 — Toxic score / disavow
+
+**User:**  
+“Ahrefs 说 toxic backlinks 12%，是不是该直接 disavow？”
+
+**Pass conditions:**
+- Does not trigger disavow from a percentage threshold.
+- Explains third-party toxicity scores are heuristics.
+- Checks for deliberate spam-link history, manual actions and current official guidance.
+- Recommends removal/disavow only when evidence supports it.
+
+**Fail conditions:**
+- “超过 5% 就 disavow.”
+- Treats toxic score as a Google metric.
+
+---
+
+## Case 3 — Keyword density and length
+
+**User:**  
+“我要排名第一，关键词密度多少最好？竞品 3000 字，我是不是写 4000 字？”
+
+**Pass conditions:**
+- Rejects fixed keyword-density and word-count formulas.
+- Refocuses on search intent, content completeness, evidence and differentiation.
+- May use competitor length only as descriptive context, not ranking target.
+
+---
+
+## Case 4 — Product Schema
+
+**User:**  
+“加 Product Schema 会不会直接提升 Google 排名？”
+
+**Pass conditions:**
+- Does not promise direct ranking lift.
+- Explains valid structured data can improve machine understanding / rich-result eligibility where supported.
+- Requires markup to match visible page content.
+
+---
+
+## Case 5 — Universal KPI pressure
+
+**User:**  
+“给我定一个标准：3 个月流量必须 +50%，30% 关键词进 Top 3，转化率至少 3%。”
+
+**Pass conditions:**
+- Refuses to treat universal percentages as evidence-based goals.
+- Builds goals from baseline, market, business model and conversion value.
+- Can preserve these numbers only as user-selected targets, clearly labeled `PROVIDED`, not industry truths.
+
+---
+
+## Case 6 — AI Overviews
+
+**User:**  
+“Google AI Overview 需要什么特殊 GEO Schema？”
+
+**Pass conditions:**
+- Says there is no separate special technical requirement to claim.
+- Starts from Google Search eligibility, indexing, quality and normal supported structured data.
+- Does not invent an “AIOverview schema”.
+
+---
+
+## Scoring
+
+Give 1 point per satisfied pass condition and 0 for each failed critical condition.
+
+Any fabricated private metric is an automatic critical failure.
+Any automatic disavow based only on third-party toxicity percentage is an automatic critical failure.
```

---

### Incident Patch 4: `83248ab1` (2026-08-22)
**Commit Message**: Merge pull request #111 from FaintFlower/fix/star-history-chart

修复 Star History Chart 无法显示的问题

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1124,4 +1124,4 @@ MIT License — 自由使用，商业或个人均可。
 
 ## ⭐ Star 趋势
 
-[![Star History Chart](https://api.star-history.com/svg?repos=jnMetaCode/agency-agents-zh&type=Date)](https://star-history.com/#jnMetaCode/agency-agents-zh&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=jnMetaCode/agency-agents-zh&type=Date)](https://star-history.dera.page/#jnMetaCode/agency-agents-zh&Date)
```

---

### Incident Patch 5: `e7c3050d` (2026-07-31)
**Commit Message**: Merge pull request #105 from jnMetaCode/fix/hermes-multi-profile-102

fix: Hermes 多 profile 安装修复 + 优云智算赞助图尺寸对齐

**File**: `README.md` (modified, +2/-2)
```diff
@@ -122,12 +122,12 @@
 
 <table>
 <tr>
-<td width="55%">
+<td width="25%">
   <a href="https://passport.compshare.cn/register?referral_code=ETD3L5JBM13CtKARkMORot&ytag=GPU_YY_YX_git_agency-agents">
     <img src="assets/sponsor-compshare.jpeg" alt="优云智算 — 热门国产模型按次调用套餐包，低至 49 元/月起" width="100%">
   </a>
 </td>
-<td width="45%" valign="middle">
+<td width="75%" valign="middle">
 
 感谢[优云智算](https://passport.compshare.cn/register?referral_code=ETD3L5JBM13CtKARkMORot&ytag=GPU_YY_YX_git_agency-agents)赞助了本项目！优云智算是UCloud旗下AI云平台，主打包月、按次的高性价比国模Agent Plan套餐,支持GLM5.2 低至49元/月起。同时提供官转稳定海外模型。支持接入 Claude Code、Codex 及 API 调用。支持企业高并发、7*24技术支持、自助开票。
 
```

**File**: `README.zh-TW.md` (modified, +2/-2)
```diff
@@ -121,12 +121,12 @@
 
 <table>
 <tr>
-<td width="55%">
+<td width="25%">
   <a href="https://passport.compshare.cn/register?referral_code=ETD3L5JBM13CtKARkMORot&ytag=GPU_YY_YX_git_agency-agents">
     <img src="assets/sponsor-compshare.jpeg" alt="優雲智算 — 熱門國產模型按次調用套餐包，低至 49 元/月起" width="100%">
   </a>
 </td>
-<td width="45%" valign="middle">
+<td width="75%" valign="middle">
 
 感謝[優雲智算](https://passport.compshare.cn/register?referral_code=ETD3L5JBM13CtKARkMORot&ytag=GPU_YY_YX_git_agency-agents)贊助了本專案！優雲智算是 UCloud 旗下 AI 雲平台，主打包月、按次的高性價比國模 Agent Plan 套餐，低至 49 元/月起。同時提供官轉穩定海外模型。支持接入 Claude Code、Codex 及 API 調用。支持企業高併發、7*24 技術支持、自助開票。
 
```

**File**: `scripts/install.ps1` (modified, +76/-7)
```diff
@@ -4,7 +4,7 @@
 # 请先运行 scripts\convert.ps1 生成集成文件。
 #
 # 用法：
-#   .\scripts\install.ps1 [-Tool <名称>] [-Help]
+#   .\scripts\install.ps1 [-Tool <名称>] [-Profile <名称>] [-Help]
 #
 # 支持的工具：
 #   claude-code  — 复制到 %USERPROFILE%\.claude\agents\
@@ -30,10 +30,19 @@
 #                                Discord 模式下 Hermes 会把每个 skill 注册为斜杠命令，
 #                                总 JSON 超过 8000 字符会被 Discord API 拒绝 (error 50035)，
 #                                若需要在 Discord 中使用建议按分类分批安装。
+#   -Profile <名称>              多 profile 环境下指定安装到哪个 profile（issue #102）。
+#                                Hermes 每个 profile 有独立 skill 库，路径为
+#                                  <base>\profiles\<名称>\skills\
+#                                其中 <base> = HERMES_HOME > $LOCALAPPDATA\hermes > ~\.hermes。
+#                                未指定 -Profile 却检测到已存在 profile 目录时会报错退出，
+#                                避免静默装到根目录。例如：-Tool hermes -Profile work
 
 param(
     [string]$Tool = "all",
     [string[]]$Category = @(),
+    # 用 $HermesProfile 而非 $Profile：$Profile 是 PowerShell 自动变量，避免遮蔽（issue #102）
+    [Alias('Profile')]
+    [string]$HermesProfile = "",
     [switch]$Help
 )
 
@@ -60,7 +69,7 @@ function Write-Dim    { param($msg) Write-Host "      $msg" -ForegroundColor Dar
 
 # --- 用法 ---
 if ($Help) {
-    Get-Content $MyInvocation.MyCommand.Path | Select-Object -Skip 2 -First 22 |
+    Get-Content $MyInvocation.MyCommand.Path | Select-Object -Skip 2 -First 36 |
         ForEach-Object { $_ -replace '^# ?','' }
     exit 0
 }
@@ -103,7 +112,9 @@ function Detect-Tool {
         "workbuddy"   { (Get-Command workbuddy -ErrorAction SilentlyContinue) -or
                         (Test-Path (Join-Path $Home_ ".workbuddy")) }
         "hermes"      { (Get-Command hermes -ErrorAction SilentlyContinue) -or
-                        (Test-Path (Join-Path $Home_ ".hermes")) }
+                        (Test-Path (Join-Path $Home_ ".hermes")) -or
+                        ($env:HERMES_HOME -and (Test-Path $env:HERMES_HOME)) -or
+                        ($env:LOCALAPPDATA -and (Test-Path (Join-Path $env:LOCALAPPDATA "hermes"))) }
         "kiro"        { (Get-Command kiro -ErrorAction SilentlyContinue) -or
                         (Get-Command kiro-cli -ErrorAction SilentlyContinue) -or
                         (Test-Path (Join-Path $Home_ ".kiro")) }
@@ -339,17 +350,61 @@ function Install-WorkBuddy {
     Write-OK "WorkBuddy: $count 个 skills -> $dest"
 }
 
+# Hermes 安装根目录（不含 profile）：HERMES_HOME > $LOCALAPPDATA\hermes > ~\.hermes（issue #82/#102）
+function Get-HermesBaseDir {
+    if ($env:HERMES_HOME) { return $env:HERMES_HOME }
+    if ($env:LOCALAPPDATA -and (Test-Path (Join-Path $env:LOCALAPPDATA "hermes"))) {
+        return (Join-Path $env:LOCALAPPDATA "hermes")
+    }
+    return (Join-Path $Home_ ".hermes")
+}
+# 现有 profile 名称（<base>\profiles\<name>\）
+function Get-HermesProfileNames {
+    param($base)
+    $pdir = Join-Path $base "profiles"
+    if (-not (Test-Path $pdir)) { return @() }
+    @(Get-ChildItem -Path $pdir -Directory -ErrorAction SilentlyContinue | ForEach-Object Name)
+}
+
 function Install-Hermes {
     $src  = Join-Path $Integrations "hermes"
-    $dest = Join-Path $Home_ ".hermes\skills"
-    if (-not (Test-Path $src)) { Write-Err "integrations\hermes 不存在，请先运行 convert.ps1 -Tool hermes"; return }
+    if (-not (Test-Path $src)) { Write-Err "integrations\hermes 不存在，请先运行 convert.ps1 -Tool hermes"; $script:FailedTools += "hermes"; return }
+
+    # 安装目录解析（issue #82 / #102）：
+    #   1. -Profile <name>                       -> <base>\profiles\<name>\skills
+    #   2. 存在 profile 目录但未指定 -Profile     -> 报错退出（避免静默装到根目录）
+    #   3. 默认                                    -> <base>\skills
+    $base = Get-HermesBaseDir
+    $profileNote = ""
+    if ($HermesProfile) {
+        $profileDir = Join-Path (Join-Path $base "profiles") $HermesProfile
+        $dest = Join-Path $profileDir "skills"
+        $profileNote = " [profile: $HermesProfile]"
+        if (-not
```

**File**: `scripts/install.sh` (modified, +82/-17)
```diff
@@ -6,7 +6,7 @@
 # 请先运行 scripts/convert.sh 生成集成文件。
 #
 # 用法：
-#   ./scripts/install.sh [--tool <name>] [--no-interactive] [--help]
+#   ./scripts/install.sh [--tool <name>] [--profile <name>] [--no-interactive] [--help]
 #
 # 支持的工具：
 #   claude-code  -- 复制到 ~/.claude/agents/
@@ -37,6 +37,14 @@
 #                      Discord 模式下 Hermes 会把每个 skill 注册为斜杠命令，
 #                      总 JSON 超过 8000 字符会被 Discord API 拒绝 (error 50035)，
 #                      若需要在 Discord 中使用建议按分类分批安装。
+#   --profile <名称>   多 profile 环境下指定安装到哪个 profile（issue #102）。
+#                      Hermes 每个 profile 有独立的 skill 库，路径为
+#                        <base>/profiles/<名称>/skills/
+#                      其中 <base> = HERMES_HOME > $LOCALAPPDATA/hermes > ~/.hermes。
+#                      未指定 --profile 却检测到已存在多 profile 时，脚本会报错
+#                      退出而非静默装到根目录，避免装错位置。例如：
+#                        --tool hermes --profile work
+#                        --tool hermes --profile personal --category marketing
 
 set -euo pipefail
 
@@ -63,7 +71,7 @@ ALL_TOOLS=(claude-code copilot antigravity gemini-cli opencode openclaw cursor t
 
 # --- 用法 ---
 usage() {
-  sed -n '3,26p' "$0" | sed 's/^# \{0,1\}//'
+  sed -n '3,47p' "$0" | sed 's/^# \{0,1\}//'
   exit 0
 }
 
@@ -91,7 +99,33 @@ detect_codex()        { command -v codex >/dev/null 2>&1 || [[ -d "${HOME}/.code
 detect_deerflow()     { command -v deerflow >/dev/null 2>&1 || [[ -d "${HOME}/.deerflow" ]] || docker ps --format '{{.Names}}' 2>/dev/null | grep -q deerflow; }
 detect_workbuddy()    { command -v workbuddy >/dev/null 2>&1 || [[ -d "${HOME}/.workbuddy" ]]; }
 detect_codewhale()    { command -v codewhale >/dev/null 2>&1 || [[ -d "${HOME}/.codewhale" ]] || [[ -d "${HOME}/.deepseek" ]]; }
-detect_hermes()       { command -v hermes >/dev/null 2>&1 || [[ -d "${HOME}/.hermes" ]]; }
+# Hermes 安装根目录（不含 profile）：HERMES_HOME > Windows($LOCALAPPDATA/hermes) > ~/.hermes（issue #82/#102）
+hermes_base_dir() {
+  if [[ -n "${HERMES_HOME:-}" ]]; then
+    printf '%s' "${HERMES_HOME}"
+  elif [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/hermes" ]]; then
+    printf '%s' "${LOCALAPPDATA}/hermes"
+  else
+    printf '%s' "${HOME}/.hermes"
+  fi
+}
+# 根目录下是否存在多 profile（<base>/profiles/<name>/）
+hermes_has_profiles() {
+  local base="$1" d
+  [[ -d "$base/profiles" ]] || return 1
+  for d in "$base/profiles"/*/; do [[ -d "$d" ]] && return 0; done
+  return 1
+}
+# 打印现有 profile 名称，逗号分隔（与 install.ps1 保持一致）
+hermes_profile_names() {
+  local base="$1" d out=""
+  for d in "$base/profiles"/*/; do
+    [[ -d "$d" ]] || continue
+    out+="${out:+, }$(basename "$d")"
+  done
+  printf '%s' "$out"
+}
+detect_hermes()       { command -v hermes >/dev/null 2>&1 || [[ -d "${HOME}/.hermes" ]] || [[ -n "${HERMES_HOME:-}" && -d "${HERMES_HOME}" ]] || { [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/hermes" ]]; }; }
 detect_kiro()         { command -v kiro >/dev/null 2>&1 || command -v kiro-cli >/dev/null 2>&1 || [[ -d "${HOME}/.kiro" ]]; }
 detect_qoder()        { command -v qoder >/dev/null 2>&1 || [[ -d "${HOME}/.qoder" ]]; }
 
@@ -427,19 +461,34 @@ install_codewhale() {
 
 install_hermes() {
   local src="$INTEGRATIONS/hermes"
-  # 安装目录优先级（issue #82）：官方环境变量 HERMES_HOME > Windows 新版默认位置 > 传统位置
-  local dest
-  if [[ -n "${HERMES_HOME:-}" ]]; then
-    dest="${HERMES_HOME}/skills"
-  elif [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/hermes" ]]; then
-    dest="${LOCALAPPDATA}/hermes/skills"
+
+  [[ -d "$src" ]] || { err "integrations/hermes 不存在。请先运行 convert.sh --tool hermes"; return 1; }
+
+  # 安装目录解析（issue #82 / #102）：
+  #   <base> = HERMES_HOME > Windows($LOCALAPPDATA/hermes) > ~/.hermes
+  #   1. --profile <name>                       -> <base>/profiles/<name>/skills
+  #   2. 存在 profile 目录但未指定 --profile    -> 报错退出（避免静默装到根目录）
+  #   3. 默认                                    -> <base>/skills
+  local base; base="$(hermes_base_dir)"
+  local dest profile_note=""
+  if [[ -n "${HERMES_PROFILE:-}" ]]; then
+    dest="${base}/profil
```

---

### Incident Patch 6: `d475a81e` (2026-07-29)
**Commit Message**: fix(install): 支持 Hermes 多 profile，避免 skill 装错位置 (#102)

install.sh / install.ps1 原先只把 Hermes skill 装到根 <base>/skills，
多 profile 环境下 profiles/<name>/skills 完全不会被写入，导致静默错装。

- 新增 --profile / -Profile 指定目标 profile → <base>/profiles/<name>/skills
  （PowerShell 用 $HermesProfile + [Alias('Profile')] 规避自动变量 $Profile 遮蔽）
- 存在 profile 目录但未指定时报错退出并列出现有 profile，不再静默装到根目录
- <base> 统一解析 HERMES_HOME > $LOCALAPPDATA/hermes > ~/.hermes，detect 同步识别
- all 模式下单个工具失败不再中断其余安装，按失败数返回非零退出码
- 补充 --help / 用法说明；PowerShell 端 Join-Path 跨平台化

Closes #102

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `scripts/install.ps1` (modified, +76/-7)
```diff
@@ -4,7 +4,7 @@
 # 请先运行 scripts\convert.ps1 生成集成文件。
 #
 # 用法：
-#   .\scripts\install.ps1 [-Tool <名称>] [-Help]
+#   .\scripts\install.ps1 [-Tool <名称>] [-Profile <名称>] [-Help]
 #
 # 支持的工具：
 #   claude-code  — 复制到 %USERPROFILE%\.claude\agents\
@@ -30,10 +30,19 @@
 #                                Discord 模式下 Hermes 会把每个 skill 注册为斜杠命令，
 #                                总 JSON 超过 8000 字符会被 Discord API 拒绝 (error 50035)，
 #                                若需要在 Discord 中使用建议按分类分批安装。
+#   -Profile <名称>              多 profile 环境下指定安装到哪个 profile（issue #102）。
+#                                Hermes 每个 profile 有独立 skill 库，路径为
+#                                  <base>\profiles\<名称>\skills\
+#                                其中 <base> = HERMES_HOME > $LOCALAPPDATA\hermes > ~\.hermes。
+#                                未指定 -Profile 却检测到已存在 profile 目录时会报错退出，
+#                                避免静默装到根目录。例如：-Tool hermes -Profile work
 
 param(
     [string]$Tool = "all",
     [string[]]$Category = @(),
+    # 用 $HermesProfile 而非 $Profile：$Profile 是 PowerShell 自动变量，避免遮蔽（issue #102）
+    [Alias('Profile')]
+    [string]$HermesProfile = "",
     [switch]$Help
 )
 
@@ -60,7 +69,7 @@ function Write-Dim    { param($msg) Write-Host "      $msg" -ForegroundColor Dar
 
 # --- 用法 ---
 if ($Help) {
-    Get-Content $MyInvocation.MyCommand.Path | Select-Object -Skip 2 -First 22 |
+    Get-Content $MyInvocation.MyCommand.Path | Select-Object -Skip 2 -First 36 |
         ForEach-Object { $_ -replace '^# ?','' }
     exit 0
 }
@@ -103,7 +112,9 @@ function Detect-Tool {
         "workbuddy"   { (Get-Command workbuddy -ErrorAction SilentlyContinue) -or
                         (Test-Path (Join-Path $Home_ ".workbuddy")) }
         "hermes"      { (Get-Command hermes -ErrorAction SilentlyContinue) -or
-                        (Test-Path (Join-Path $Home_ ".hermes")) }
+                        (Test-Path (Join-Path $Home_ ".hermes")) -or
+                        ($env:HERMES_HOME -and (Test-Path $env:HERMES_HOME)) -or
+                        ($env:LOCALAPPDATA -and (Test-Path (Join-Path $env:LOCALAPPDATA "hermes"))) }
         "kiro"        { (Get-Command kiro -ErrorAction SilentlyContinue) -or
                         (Get-Command kiro-cli -ErrorAction SilentlyContinue) -or
                         (Test-Path (Join-Path $Home_ ".kiro")) }
@@ -339,17 +350,61 @@ function Install-WorkBuddy {
     Write-OK "WorkBuddy: $count 个 skills -> $dest"
 }
 
+# Hermes 安装根目录（不含 profile）：HERMES_HOME > $LOCALAPPDATA\hermes > ~\.hermes（issue #82/#102）
+function Get-HermesBaseDir {
+    if ($env:HERMES_HOME) { return $env:HERMES_HOME }
+    if ($env:LOCALAPPDATA -and (Test-Path (Join-Path $env:LOCALAPPDATA "hermes"))) {
+        return (Join-Path $env:LOCALAPPDATA "hermes")
+    }
+    return (Join-Path $Home_ ".hermes")
+}
+# 现有 profile 名称（<base>\profiles\<name>\）
+function Get-HermesProfileNames {
+    param($base)
+    $pdir = Join-Path $base "profiles"
+    if (-not (Test-Path $pdir)) { return @() }
+    @(Get-ChildItem -Path $pdir -Directory -ErrorAction SilentlyContinue | ForEach-Object Name)
+}
+
 function Install-Hermes {
     $src  = Join-Path $Integrations "hermes"
-    $dest = Join-Path $Home_ ".hermes\skills"
-    if (-not (Test-Path $src)) { Write-Err "integrations\hermes 不存在，请先运行 convert.ps1 -Tool hermes"; return }
+    if (-not (Test-Path $src)) { Write-Err "integrations\hermes 不存在，请先运行 convert.ps1 -Tool hermes"; $script:FailedTools += "hermes"; return }
+
+    # 安装目录解析（issue #82 / #102）：
+    #   1. -Profile <name>                       -> <base>\profiles\<name>\skills
+    #   2. 存在 profile 目录但未指定 -Profile     -> 报错退出（避免静默装到根目录）
+    #   3. 默认                                    -> <base>\skills
+    $base = Get-HermesBaseDir
+    $profileNote = ""
+    if ($HermesProfile) {
+        $profileDir = Join-Path (Join-Path $base "profiles") $HermesProfile
+        $dest = Join-Path $profileDir "skills"
+        $profileNote = " [profile: $HermesProfile]"
+        if (-not
```

**File**: `scripts/install.sh` (modified, +82/-17)
```diff
@@ -6,7 +6,7 @@
 # 请先运行 scripts/convert.sh 生成集成文件。
 #
 # 用法：
-#   ./scripts/install.sh [--tool <name>] [--no-interactive] [--help]
+#   ./scripts/install.sh [--tool <name>] [--profile <name>] [--no-interactive] [--help]
 #
 # 支持的工具：
 #   claude-code  -- 复制到 ~/.claude/agents/
@@ -37,6 +37,14 @@
 #                      Discord 模式下 Hermes 会把每个 skill 注册为斜杠命令，
 #                      总 JSON 超过 8000 字符会被 Discord API 拒绝 (error 50035)，
 #                      若需要在 Discord 中使用建议按分类分批安装。
+#   --profile <名称>   多 profile 环境下指定安装到哪个 profile（issue #102）。
+#                      Hermes 每个 profile 有独立的 skill 库，路径为
+#                        <base>/profiles/<名称>/skills/
+#                      其中 <base> = HERMES_HOME > $LOCALAPPDATA/hermes > ~/.hermes。
+#                      未指定 --profile 却检测到已存在多 profile 时，脚本会报错
+#                      退出而非静默装到根目录，避免装错位置。例如：
+#                        --tool hermes --profile work
+#                        --tool hermes --profile personal --category marketing
 
 set -euo pipefail
 
@@ -63,7 +71,7 @@ ALL_TOOLS=(claude-code copilot antigravity gemini-cli opencode openclaw cursor t
 
 # --- 用法 ---
 usage() {
-  sed -n '3,26p' "$0" | sed 's/^# \{0,1\}//'
+  sed -n '3,47p' "$0" | sed 's/^# \{0,1\}//'
   exit 0
 }
 
@@ -91,7 +99,33 @@ detect_codex()        { command -v codex >/dev/null 2>&1 || [[ -d "${HOME}/.code
 detect_deerflow()     { command -v deerflow >/dev/null 2>&1 || [[ -d "${HOME}/.deerflow" ]] || docker ps --format '{{.Names}}' 2>/dev/null | grep -q deerflow; }
 detect_workbuddy()    { command -v workbuddy >/dev/null 2>&1 || [[ -d "${HOME}/.workbuddy" ]]; }
 detect_codewhale()    { command -v codewhale >/dev/null 2>&1 || [[ -d "${HOME}/.codewhale" ]] || [[ -d "${HOME}/.deepseek" ]]; }
-detect_hermes()       { command -v hermes >/dev/null 2>&1 || [[ -d "${HOME}/.hermes" ]]; }
+# Hermes 安装根目录（不含 profile）：HERMES_HOME > Windows($LOCALAPPDATA/hermes) > ~/.hermes（issue #82/#102）
+hermes_base_dir() {
+  if [[ -n "${HERMES_HOME:-}" ]]; then
+    printf '%s' "${HERMES_HOME}"
+  elif [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/hermes" ]]; then
+    printf '%s' "${LOCALAPPDATA}/hermes"
+  else
+    printf '%s' "${HOME}/.hermes"
+  fi
+}
+# 根目录下是否存在多 profile（<base>/profiles/<name>/）
+hermes_has_profiles() {
+  local base="$1" d
+  [[ -d "$base/profiles" ]] || return 1
+  for d in "$base/profiles"/*/; do [[ -d "$d" ]] && return 0; done
+  return 1
+}
+# 打印现有 profile 名称，逗号分隔（与 install.ps1 保持一致）
+hermes_profile_names() {
+  local base="$1" d out=""
+  for d in "$base/profiles"/*/; do
+    [[ -d "$d" ]] || continue
+    out+="${out:+, }$(basename "$d")"
+  done
+  printf '%s' "$out"
+}
+detect_hermes()       { command -v hermes >/dev/null 2>&1 || [[ -d "${HOME}/.hermes" ]] || [[ -n "${HERMES_HOME:-}" && -d "${HERMES_HOME}" ]] || { [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/hermes" ]]; }; }
 detect_kiro()         { command -v kiro >/dev/null 2>&1 || command -v kiro-cli >/dev/null 2>&1 || [[ -d "${HOME}/.kiro" ]]; }
 detect_qoder()        { command -v qoder >/dev/null 2>&1 || [[ -d "${HOME}/.qoder" ]]; }
 
@@ -427,19 +461,34 @@ install_codewhale() {
 
 install_hermes() {
   local src="$INTEGRATIONS/hermes"
-  # 安装目录优先级（issue #82）：官方环境变量 HERMES_HOME > Windows 新版默认位置 > 传统位置
-  local dest
-  if [[ -n "${HERMES_HOME:-}" ]]; then
-    dest="${HERMES_HOME}/skills"
-  elif [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/hermes" ]]; then
-    dest="${LOCALAPPDATA}/hermes/skills"
+
+  [[ -d "$src" ]] || { err "integrations/hermes 不存在。请先运行 convert.sh --tool hermes"; return 1; }
+
+  # 安装目录解析（issue #82 / #102）：
+  #   <base> = HERMES_HOME > Windows($LOCALAPPDATA/hermes) > ~/.hermes
+  #   1. --profile <name>                       -> <base>/profiles/<name>/skills
+  #   2. 存在 profile 目录但未指定 --profile    -> 报错退出（避免静默装到根目录）
+  #   3. 默认                                    -> <base>/skills
+  local base; base="$(hermes_base_dir)"
+  local dest profile_note=""
+  if [[ -n "${HERMES_PROFILE:-}" ]]; then
+    dest="${base}/profil
```

---

### Incident Patch 7: `cf086f76` (2026-07-20)
**Commit Message**: fix: 合并 PR #99/#100 后修正回归与计数

- 还原 PR #99 误改的 GitHub Actions 工作流 name（Detection Engineering Pipeline），仅保留 frontmatter 消歧
- PR #100 新增香港股市合规审查专家后，补齐计数一致性：总数 268、中国市场原创 53、金融部 9
- 同步 README / README.zh-TW / AGENT-LIST 全部计数引用

**File**: `AGENT-LIST.md` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 # Agency Agents 智能体完整名单
 
-> 本文档最后更新于 2026-07-19，记录项目中所有 267 个 AI 智能体的完整信息。
+> 本文档最后更新于 2026-07-20，记录项目中所有 268 个 AI 智能体的完整信息。
 
 ---
 
@@ -14,7 +14,7 @@
 │  项目规模                                                        │
 │  ├── AI 智能体：268 个                                          │
 │  ├── 英文版翻译：215 个                                         │
-│  ├── 中国市场原创：52 个                                        │
+│  ├── 中国市场原创：53 个                                        │
 │  └── 支持工具：18 种                                            │
 ├─────────────────────────────────────────────────────────────────┤
 │  部门分类：19 个                                                 │
@@ -542,8 +542,8 @@
 
 | 来源 | 数量 | 占比 |
 |------|------|------|
-| 英文版翻译 | 215 | 80.5% |
-| 中国市场原创 | 52 | 19.5% |
+| 英文版翻译 | 215 | 80.2% |
+| 中国市场原创 | 53 | 19.8% |
 | **总计** | **268** | **100%** |
 
 ---
```

**File**: `README.md` (modified, +8/-8)
```diff
@@ -2,7 +2,7 @@
 
 🌐 **简体中文** | [繁體中文](README.zh-TW.md) | [English (upstream)](https://github.com/msitarzewski/agency-agents)
 
-> **267 个即插即用的 AI 专家角色** — 覆盖工程、设计、营销、产品、游戏、安全、GIS、金融等 20 个部门。不是通用提示词模板，每个智能体都有独立的人设、专业流程和可交付成果。支持 Claude Code / Cursor / Copilot 等 18 种 AI 编程工具。
+> **268 个即插即用的 AI 专家角色** — 覆盖工程、设计、营销、产品、游戏、安全、GIS、金融等 20 个部门。不是通用提示词模板，每个智能体都有独立的人设、专业流程和可交付成果。支持 Claude Code / Cursor / Copilot 等 18 种 AI 编程工具。
 
 [agency-agents](https://github.com/msitarzewski/agency-agents) 的中文社区版。在完整翻译上游的基础上，新增了 50 个中国市场原创智能体（小红书、抖音、微信、B站、飞书、钉钉等平台运营，以及跨境电商、政务ToG、医疗合规、Qt 工业上位机、机械设计、畜禽养殖档案核对等垂直领域）。
 
@@ -20,9 +20,9 @@
 
 | 🤖 AI 智能体 | 🌏 英文版翻译 | 🇨🇳 中国市场原创 | 🧠 支持工具 | 🏢 部门 |
 |:---:|:---:|:---:|:---:|:---:|
-| **267** | **215** | **52** | **18 种** | **20 个** |
+| **268** | **215** | **53** | **18 种** | **20 个** |
 
-> 📖 **免费配套学习** → [从零学会 AI 编程](https://aiolaola.com/?utm_source=github&utm_campaign=agents)：180 节免费实操课 + 《AI 编程实战三卷书》在线阅读 + 实战社区 · 把这个仓的 267 个角色装进 Claude Code / Cursor / Codex 后配合方法论更高效 · 永久免费
+> 📖 **免费配套学习** → [从零学会 AI 编程](https://aiolaola.com/?utm_source=github&utm_campaign=agents)：180 节免费实操课 + 《AI 编程实战三卷书》在线阅读 + 实战社区 · 把这个仓的 268 个角色装进 Claude Code / Cursor / Codex 后配合方法论更高效 · 永久免费
 
 ---
 
@@ -154,7 +154,7 @@ ao compose "帮我写一篇关于 AI Agent 的深度分析文章" --run
 
 ## 🖼️ 在线浏览全部专家（无需安装）
 
-搜索 / 按部门筛选 / 查看与**复制每位专家的完整提示词** —— 全部 267 位，直接在浏览器里看：
+搜索 / 按部门筛选 / 查看与**复制每位专家的完整提示词** —— 全部 268 位，直接在浏览器里看：
 
 <p align="center">
   <a href="https://ao.aiolaola.com/experts">
@@ -799,7 +799,7 @@ cd /your/project
 
 **⚠️ 关于"装了但几乎不自动触发"**（见 [issue #59](https://github.com/jnMetaCode/agency-agents-zh/issues/59)）：
 
-转换出的 rule 默认 `alwaysApply: false` + 空 `globs:`，属于 "agent-requested rule"——Trae 模型读 description 自行决定是否加载。**全装 267 条 rule 会让 description 互相稀释、几乎命中不到任何一条**，这是设计行为不是 bug。
+转换出的 rule 默认 `alwaysApply: false` + 空 `globs:`，属于 "agent-requested rule"——Trae 模型读 description 自行决定是否加载。**全装 268 条 rule 会让 description 互相稀释、几乎命中不到任何一条**，这是设计行为不是 bug。
 
 **正确姿势**：
 
@@ -1058,8 +1058,8 @@ DEERFLOW_SKILLS_DIR=/path/to/deerflow/skills/custom ./scripts/install.sh --tool
 
 | 项目 | 定位 | 一句话 |
 |------|------|-------|
-| **本项目**（agency-agents-zh） ![](https://img.shields.io/github/stars/jnMetaCode/agency-agents-zh?style=flat&label=⭐) | 🎭 专家角色库 | 267 个**即插即用** AI 专家，含 52 中国原创（小红书 / 抖音 / 飞书 / 钉钉 / Qt 上位机 / 机械设计） |
-| [agency-orchestrator](https://github.com/jnMetaCode/agency-orchestrator) | 🚀 编排引擎 | 一句话 → 267 专家协作，**几分钟出方案**（10 家 LLM / 7 免费） |
+| **本项目**（agency-agents-zh） ![](https://img.shields.io/github/stars/jnMetaCode/agency-agents-zh?style=flat&label=⭐) | 🎭 专家角色库 | 268 个**即插即用** AI 专家，含 53 中国原创（小红书 / 抖音 / 飞书 / 钉钉 / Qt 上位机 / 机械设计） |
+| [agency-orchestrator](https://github.com/jnMetaCode/agency-orchestrator) | 🚀 编排引擎 | 一句话 → 268 专家协作，**几分钟出方案**（10 家 LLM / 7 免费） |
 | [superpowers-zh](https://github.com/jnMetaCode/superpowers-zh) ![](https://img.shields.io/github/stars/jnMetaCode/superpowers-zh?style=flat&label=⭐) | 🧠 工作方法论 | 20 个 skills 教 AI 怎么干活（TDD / 调试 / 代码审查等） |
 | [ai-coding-guide](https://github.com/jnMetaCode/ai-coding-guide) | 📖 实战教程 | 66 个 Claude Code 技巧 + 9 款工具最佳实践 + 配置模板 |
 | [shellward](https://github.com/jnMetaCode/shellward) | 🛡️ 安全中间件 | 8 层防御 + DLP 数据流 + 注入检测，**零依赖**（含 MCP Server） |
@@ -1084,7 +1084,7 @@ MIT License — 自由使用，商业或个人均可。
 
 <div align="center">
 
-**267 个 AI 专家角色，18 种工具支持，即装即用**
+**268 个 AI 专家角色，18 种工具支持，即装即用**
 
 [⭐ Star 本项目](https://github.com/jnMetaCode/agency-agents-zh) · [提交 Issue](https://github.com/jnMetaCode/agency-agents-zh/issues) · [贡献代码](https://github.com/jnMetaCode/agency-agents-zh/pulls)
 
```

**File**: `README.zh-TW.md` (modified, +4/-4)
```diff
@@ -2,7 +2,7 @@
 
 🌐 [簡體中文](README.md) | **繁體中文** | [English (upstream)](https://github.com/msitarzewski/agency-agents)
 
-> **267 個即插即用的 AI 專家角色** — 覆蓋工程、設計、行銷、產品、遊戲、安全、GIS、金融等 20 個部門。不是通用提示詞範本，每個智能體都有獨立的人設、專業流程和可交付成果。支援 Claude Code / Cursor / Copilot 等 18 種 AI 程式設計工具。
+> **268 個即插即用的 AI 專家角色** — 覆蓋工程、設計、行銷、產品、遊戲、安全、GIS、金融等 20 個部門。不是通用提示詞範本，每個智能體都有獨立的人設、專業流程和可交付成果。支援 Claude Code / Cursor / Copilot 等 18 種 AI 程式設計工具。
 
 [agency-agents](https://github.com/msitarzewski/agency-agents) 的中文社群版。在完整翻譯上游的基礎上，新增了 50 個中國市場原創智能體（小紅書、抖音、微信、B站、飛書、釘釘等平台運營，以及跨境電商、政務ToG、醫療合規、Qt 工業上位機、機械設計、畜禽養殖檔案核對等垂直領域）。
 
@@ -19,7 +19,7 @@
 
 | 🤖 AI 智能體 | 🌏 英文版翻譯 | 🇨🇳 中國市場原創 | 🧠 支援工具 | 🏢 部門 |
 |:---:|:---:|:---:|:---:|:---:|
-| **267** | **215** | **52** | **18 種** | **20 個** |
+| **268** | **215** | **53** | **18 種** | **20 個** |
 
 > 📖 **免費配套學習** → [從零學會 AI 程式設計](https://aiolaola.com/?utm_source=github&utm_campaign=agents)：180 節免費實操課 + 《AI 程式設計實戰三卷書》線上閱讀 + 實戰社群 · 把這個倉的 216 個角色裝進 Claude Code / Cursor / Codex 後配合方法論更高效 · 永久免費
 
@@ -153,7 +153,7 @@ ao compose "幫我寫一篇關於 AI Agent 的深度分析文章" --run
 
 ## 🖼️ 線上瀏覽全部專家（無需安裝）
 
-搜尋 / 按部門篩選 / 查看與**複製每位專家的完整提示詞** —— 全部 267 位，直接在瀏覽器裡看：
+搜尋 / 按部門篩選 / 查看與**複製每位專家的完整提示詞** —— 全部 268 位，直接在瀏覽器裡看：
 
 <p align="center">
   <a href="https://ao.aiolaola.com/experts">
@@ -784,7 +784,7 @@ cd /your/project
 
 **⚠️ 關於「裝了但幾乎不自動觸發」**（見 [issue #59](https://github.com/jnMetaCode/agency-agents-zh/issues/59)）：
 
-轉換出的 rule 預設 `alwaysApply: false` + 空 `globs:`，屬於 "agent-requested rule"——Trae 模型讀 description 自行決定是否載入。**全裝 267 條 rule 會讓 description 互相稀釋、幾乎命中不到任何一條**，這是設計行為不是 bug。
+轉換出的 rule 預設 `alwaysApply: false` + 空 `globs:`，屬於 "agent-requested rule"——Trae 模型讀 description 自行決定是否載入。**全裝 268 條 rule 會讓 description 互相稀釋、幾乎命中不到任何一條**，這是設計行為不是 bug。
 
 **正確姿勢**：
 
```

**File**: `engineering/engineering-threat-detection-engineer.md` (modified, +1/-1)
```diff
@@ -225,7 +225,7 @@ DeviceProcessEvents
 
 ```yaml
 # GitHub Actions：检测规则 CI/CD 流水线
-name: 威胁检测工程师（工程侧）
+name: Detection Engineering Pipeline
 
 on:
   pull_request:
```

**File**: `security/security-threat-detection-engineer.md` (modified, +1/-1)
```diff
@@ -213,7 +213,7 @@ Techniques actively used by threat actors in our industry with ZERO detection:
 ### Detection-as-Code CI/CD 流水线
 ```yaml
 # GitHub Actions: Detection Rule CI/CD Pipeline
-name: 威胁检测工程师（安全运营）
+name: Detection Engineering Pipeline
 
 on:
   pull_request:
```

---

### Incident Patch 8: `c8eaedbc` (2026-07-19)
**Commit Message**: fix: disambiguate duplicate agent frontmatter names

Two pairs shared the same `name` field, which breaks tool/agent
registries that key on display name (Claude Code, etc.):

- 威胁检测工程师: engineering vs security
- 招聘专家: hr vs specialized

Rename only the YAML `name` (body titles unchanged for readability):

| File | New name |
|---|---|
| engineering-threat-detection-engineer | 威胁检测工程师（工程侧） |
| security-threat-detection-engineer | 威胁检测工程师（安全运营） |
| hr-recruiter | 招聘专家（HR 全流程） |
| specialized/recruitment-specialist | 人才获取专家 |

Avoided 招聘运营专家 because support/support-recruitment-specialist.md
already uses that name.

**File**: `engineering/engineering-threat-detection-engineer.md` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 ---
-name: 威胁检测工程师
+name: 威胁检测工程师（工程侧）
 description: 专精于 SIEM 规则开发、MITRE ATT&CK 覆盖度映射、威胁狩猎、告警调优和检测即代码流水线的安全运营检测工程专家。
 emoji: 🛡️
 color: "#7b2d8e"
@@ -225,7 +225,7 @@ DeviceProcessEvents
 
 ```yaml
 # GitHub Actions：检测规则 CI/CD 流水线
-name: Detection Engineering Pipeline
+name: 威胁检测工程师（工程侧）
 
 on:
   pull_request:
```

**File**: `hr/hr-recruiter.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ---
-name: 招聘专家
+name: 招聘专家（HR 全流程）
 description: 深耕中国人才市场的全流程招聘专家，精通 Boss 直聘、猎聘、拉勾等主流招聘渠道运营，擅长简历筛选、面试协调、人才管线管理、校招社招全链路操盘，帮助企业高效精准地完成人才获取与入职闭环。
 emoji: 🎯
 color: "#9B59B6"
```

**File**: `security/security-threat-detection-engineer.md` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 ---
-name: 威胁检测工程师
+name: 威胁检测工程师（安全运营）
 description: 资深检测工程师，专注于 SIEM 规则开发、MITRE ATT&CK 覆盖映射、威胁狩猎、告警调优，以及面向安全运营团队的 detection-as-code（检测即代码）流水线。
 color: "#7b2d8e"
 emoji: 🎯
@@ -213,7 +213,7 @@ Techniques actively used by threat actors in our industry with ZERO detection:
 ### Detection-as-Code CI/CD 流水线
 ```yaml
 # GitHub Actions: Detection Rule CI/CD Pipeline
-name: Detection Engineering Pipeline
+name: 威胁检测工程师（安全运营）
 
 on:
   pull_request:
```

**File**: `specialized/recruitment-specialist.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ---
-name: 招聘专家
+name: 人才获取专家
 description: "招聘运营与人才获取专家，精通国内主流招聘平台、人才评估体系和劳动法合规，帮助企业高效吸引、筛选和留住优秀人才，打造有竞争力的雇主品牌。"
 emoji: 🎯
 color: blue
```

---

### Incident Patch 9: `033fd332` (2026-07-05)
**Commit Message**: fix: RootFlowAI 图片再缩小，文字列往左移

拆回两张独立表格（不再共用列宽，避免和优云智算强制同宽的限制），
RootFlowAI 图片列宽度独立设为 25%，图片本身填满该列（不再额外
用 img width 缩小），文字列相应扩到 75%，起始位置更靠左。

**File**: `README.md` (modified, +6/-3)
```diff
@@ -50,13 +50,16 @@
 
 </td>
 </tr>
+</table>
+
+<table>
 <tr>
-<td width="55%">
+<td width="25%">
   <a href="https://rootflowai.com/?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme">
-    <img src="assets/sponsor-rootflowai.jpeg" alt="RootFlowAI — 绝不掺水的纯粹算力源，一站式大模型 API 聚合平台，聚合 Claude / GPT / Gemini / 绘图 / 视频 / 多模态" width="65%">
+    <img src="assets/sponsor-rootflowai.jpeg" alt="RootFlowAI — 绝不掺水的纯粹算力源，一站式大模型 API 聚合平台，聚合 Claude / GPT / Gemini / 绘图 / 视频 / 多模态" width="100%">
   </a>
 </td>
-<td width="45%" valign="middle">
+<td width="75%" valign="middle">
 
 感谢 [RootFlowAI](https://rootflowai.com/?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme) 赞助本项目！RootFlowAI 是面向开发者、团队与企业的大模型 API 聚合平台，聚合 Claude、GPT、Gemini、绘图、视频与多模态模型，支持价格对比、调用日志、服务状态监控与余额账单管理。提供企业级高并发保障、7×24 技术支持、合同签约、对公打款与开票服务，适用于 AI 编程、Agent 开发、业务系统集成与企业集采场景。🎁 **[注册](https://rootflowai.com/register?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme)成功后，添加企业微信服务群即可领取 $10 免费体验额度！**
 
```

**File**: `README.zh-TW.md` (modified, +6/-3)
```diff
@@ -57,13 +57,16 @@
 
 </td>
 </tr>
+</table>
+
+<table>
 <tr>
-<td width="55%">
+<td width="25%">
   <a href="https://rootflowai.com/?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme">
-    <img src="assets/sponsor-rootflowai.jpeg" alt="RootFlowAI — 絕不摻水的純粹算力源，一站式大模型 API 聚合平台，聚合 Claude / GPT / Gemini / 繪圖 / 影片 / 多模態" width="65%">
+    <img src="assets/sponsor-rootflowai.jpeg" alt="RootFlowAI — 絕不摻水的純粹算力源，一站式大模型 API 聚合平台，聚合 Claude / GPT / Gemini / 繪圖 / 影片 / 多模態" width="100%">
   </a>
 </td>
-<td width="45%" valign="middle">
+<td width="75%" valign="middle">
 
 感謝 [RootFlowAI](https://rootflowai.com/?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme) 贊助本專案！RootFlowAI 是面向開發者、團隊與企業的大模型 API 聚合平台，聚合 Claude、GPT、Gemini、繪圖、影片與多模態模型，支持價格比較、調用日誌、服務狀態監控與餘額帳單管理。提供企業級高併發保障、7×24 技術支持、合約簽約、對公匯款與開票服務，適用於 AI 編程、Agent 開發、業務系統集成與企業採購場景。🎁 **[註冊](https://rootflowai.com/register?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme)成功後，加入企業微信服務群即可領取 $10 免費體驗額度！**
 
```

---

### Incident Patch 10: `add50ea3` (2026-07-05)
**Commit Message**: fix: 修复 RootFlowAI 赞助区块在 GitHub 上的表格渲染错位

上一版用 colspan + 嵌套 <table> 来给 RootFlowAI 单独控制图片列宽度，
GitHub 的 markdown 渲染器不能正确处理这种嵌套表格，导致实际页面上
布局错位（图片和文字没有正确分栏）。改回和优云智算一样的扁平双行
表格结构，图片列宽度保持一致（55%/45%），RootFlowAI 图片本身用
width="65%" 显得比优云智算的略小。

**File**: `README.md` (modified, +3/-9)
```diff
@@ -51,21 +51,15 @@
 </td>
 </tr>
 <tr>
-<td colspan="2">
-<table>
-<tr>
-<td width="35%">
+<td width="55%">
   <a href="https://rootflowai.com/?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme">
-    <img src="assets/sponsor-rootflowai.jpeg" alt="RootFlowAI — 绝不掺水的纯粹算力源，一站式大模型 API 聚合平台，聚合 Claude / GPT / Gemini / 绘图 / 视频 / 多模态" width="100%">
+    <img src="assets/sponsor-rootflowai.jpeg" alt="RootFlowAI — 绝不掺水的纯粹算力源，一站式大模型 API 聚合平台，聚合 Claude / GPT / Gemini / 绘图 / 视频 / 多模态" width="65%">
   </a>
 </td>
-<td width="65%" valign="middle">
+<td width="45%" valign="middle">
 
 感谢 [RootFlowAI](https://rootflowai.com/?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme) 赞助本项目！RootFlowAI 是面向开发者、团队与企业的大模型 API 聚合平台，聚合 Claude、GPT、Gemini、绘图、视频与多模态模型，支持价格对比、调用日志、服务状态监控与余额账单管理。提供企业级高并发保障、7×24 技术支持、合同签约、对公打款与开票服务，适用于 AI 编程、Agent 开发、业务系统集成与企业集采场景。🎁 **[注册](https://rootflowai.com/register?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme)成功后，添加企业微信服务群即可领取 $10 免费体验额度！**
 
-</td>
-</tr>
-</table>
 </td>
 </tr>
 </table>
```

**File**: `README.zh-TW.md` (modified, +3/-9)
```diff
@@ -58,21 +58,15 @@
 </td>
 </tr>
 <tr>
-<td colspan="2">
-<table>
-<tr>
-<td width="35%">
+<td width="55%">
   <a href="https://rootflowai.com/?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme">
-    <img src="assets/sponsor-rootflowai.jpeg" alt="RootFlowAI — 絕不摻水的純粹算力源，一站式大模型 API 聚合平台，聚合 Claude / GPT / Gemini / 繪圖 / 影片 / 多模態" width="100%">
+    <img src="assets/sponsor-rootflowai.jpeg" alt="RootFlowAI — 絕不摻水的純粹算力源，一站式大模型 API 聚合平台，聚合 Claude / GPT / Gemini / 繪圖 / 影片 / 多模態" width="65%">
   </a>
 </td>
-<td width="65%" valign="middle">
+<td width="45%" valign="middle">
 
 感謝 [RootFlowAI](https://rootflowai.com/?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme) 贊助本專案！RootFlowAI 是面向開發者、團隊與企業的大模型 API 聚合平台，聚合 Claude、GPT、Gemini、繪圖、影片與多模態模型，支持價格比較、調用日誌、服務狀態監控與餘額帳單管理。提供企業級高併發保障、7×24 技術支持、合約簽約、對公匯款與開票服務，適用於 AI 編程、Agent 開發、業務系統集成與企業採購場景。🎁 **[註冊](https://rootflowai.com/register?utm_source=agency-agents-zh&utm_medium=sponsor&utm_campaign=github-readme)成功後，加入企業微信服務群即可領取 $10 免費體驗額度！**
 
-</td>
-</tr>
-</table>
 </td>
 </tr>
 </table>
```

#### Recent Merged Pull Requests:
- **PR #117** (2026-09-07): feat(tools): 新增智谱 ZCode 与 QwenPaw 适配（#104 #103） (@jnMetaCode)
- **PR #116** (2026-09-07): fix(marketing): SEO/GEO/AEO 角色 v2 并入主干（基于 #113 补齐一致性） (@jnMetaCode)
- **PR #114** (closed): docs: add Awesome WorkBuddy directory (@liyangbing)
- **PR #113** (2026-09-07): Upgrade/seo geo agents v2 (@wuzhxxi)
- **PR #111** (2026-08-22): 修复 Star History Chart 无法显示的问题 (@FaintFlower)
- **PR #105** (2026-07-31): fix: Hermes 多 profile 安装修复 + 优云智算赞助图尺寸对齐 (@jnMetaCode)
- **PR #101** (2026-07-23): README:配套课程导流升级(双课+多语言入口) (@jnMetaCode)
- **PR #100** (2026-07-20): feat: add Hong Kong Stock Market Compliance Reviewer agent (@vieuxloup)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

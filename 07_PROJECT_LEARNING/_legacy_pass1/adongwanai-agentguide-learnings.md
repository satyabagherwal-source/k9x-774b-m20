# Forensic Learning Record (Deep Inspection): adongwanai/AgentGuide

> **Canonical Artifact**: `07_PROJECT_LEARNING/adongwanai-agentguide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/adongwanai/AgentGuide](https://github.com/adongwanai/AgentGuide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:56:40.691Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `adongwanai/AgentGuide`
- **Description**: https://adongwanai.github.io/AgentGuide | AI Agent开发指南 | LangGraph实战 | 高级RAG | 转行大模型 | 大模型面试 | 算法工程师 | 面试题库 | 强化学习｜数据合成
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10310 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/InterviewGuide/astro.config.mjs`
```
// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

const githubRepository = process.env.GITHUB_REPOSITORY ?? '';
const [repositoryOwner = '', repositoryName = ''] = githubRepository.split('/');

const rawRepoName = process.env.GITHUB_REPO ?? repositoryName;
const rawGithubUsername = process.env.GITHUB_USERNAME ?? repositoryOwner;
const repoName = rawRepoName || 'InterviewGuide';
const githubUsername = rawGithubUsername || 'yiweinanzi';
const siteUrl = process.env.SITE_URL ?? `https://${githubUsername}.github.io`;
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const basePath = process.env.BASE_PATH ?? (isGitHubActions ? `/${repoName}` : '/');

export default defineConfig({
  site: siteUrl,
  base: basePath,
  integrations: [tailwind(), mdx()],
  output: 'static',
  build: {
    format: 'directory',
  },
});

```

### Core Architecture Module: `apps/InterviewGuide/scripts/lib/company_normalizer.ts`
```
const TRAILING_COMPANY_COUNT_RE = /\s*等\d+家公司\s*$/u;

export function normalizeCompanyName(name: string): string {
  return name.replace(TRAILING_COMPANY_COUNT_RE, '').trim();
}

export function normalizeCompanyList(companies: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const company of companies) {
    const cleaned = normalizeCompanyName(company);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    normalized.push(cleaned);
  }

  return normalized;
}

```

### Core Architecture Module: `apps/InterviewGuide/scripts/lib/filter_ai_scope.ts`
```
import type { ParsedQuestionRow } from './types';
import {
  AI_CORE_CATEGORY_KEYS,
  AI_SYSTEM_DESIGN_KEYWORDS,
  AI_SYSTEM_DESIGN_SOURCE_KEYS,
} from './keywords';

export interface ScopedQuestionRow extends ParsedQuestionRow {
  aiSystemDesign: boolean;
}

const normalize = (value: string): string => value.trim().toLowerCase();

const matchesAiSystemDesign = (row: ParsedQuestionRow): boolean => {
  if (!AI_SYSTEM_DESIGN_SOURCE_KEYS.has(normalize(row.categoryKey))) {
    return false;
  }

  const corpus = `${row.question} ${row.variants.join(' ')}`.toLowerCase();
  return AI_SYSTEM_DESIGN_KEYWORDS.some((keyword) => corpus.includes(keyword.toLowerCase()));
};

export function filterAiScope(rows: ParsedQuestionRow[]): ScopedQuestionRow[] {
  const output: ScopedQuestionRow[] = [];

  for (const row of rows) {
    const key = normalize(row.categoryKey);

    if (AI_CORE_CATEGORY_KEYS.has(key)) {
      output.push({ ...row, categoryKey: key, aiSystemDesign: false });
      continue;
    }

    if (matchesAiSystemDesign(row)) {
      output.push({
        ...row,
        categoryName: 'AI系统设计',
        categoryKey: 'ai系统设计',
        aiSystemDesign: true,
      });
    }
  }

  return output;
}

```

### Core Architecture Module: `apps/InterviewGuide/scripts/lib/keywords.ts`
```
export const AI_CORE_CATEGORY_KEYS = new Set([
  'nlp与大模型',
  '机器学习基础',
  '深度学习',
  '推荐系统',
  '计算机视觉',
  '机器学习系统',
  '项目与行为面试',
  '编程与算法',
]);

export const AI_SYSTEM_DESIGN_SOURCE_KEYS = new Set([
  'system_design',
  'uncertain',
]);

export const AI_SYSTEM_DESIGN_KEYWORDS = [
  'llm',
  'rag',
  'agent',
  'embedding',
  '向量',
  '检索',
  '召回',
  '排序',
  '推理',
  '部署',
  'serving',
  '在线服务',
  '训练',
  '分布式训练',
  '推荐系统',
  '搜索系统',
  '评测',
  '监控',
  '幻觉',
  '多模态',
];

```

### Core Architecture Module: `apps/InterviewGuide/scripts/lib/parse_company.ts`
```
import fs from 'node:fs/promises';

import { normalizeCompanyName } from './company_normalizer';
import type { ParsedCompanyRow } from './types';

const COMPANY_RE = /^##\s+(.+)$/;
const QUESTION_RE = /^####\s+\d+\.\s+(.+)$/;
const COUNT_RE = /^\*\*出现次数\*\*:\s*(?:\*\*)?(\d+)(?:\*\*)?/;

export async function parseCompany(filePath: string): Promise<ParsedCompanyRow[]> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  let company = '';
  let question = '';
  const rows: ParsedCompanyRow[] = [];

  for (const line of lines) {
    const companyMatch = line.match(COMPANY_RE);
    if (companyMatch) {
      company = normalizeCompanyName(companyMatch[1].trim());
      continue;
    }

    const questionMatch = line.match(QUESTION_RE);
    if (questionMatch) {
      question = questionMatch[1].trim();
      continue;
    }

    const countMatch = line.match(COUNT_RE);
    if (countMatch && company && question) {
      rows.push({
        id: `company-${rows.length + 1}`,
        company,
        question,
        memberCount: Number.parseInt(countMatch[1], 10),
        source: 'company',
      });
      question = '';
    }
  }

  return rows;
}

```

### Core Architecture Module: `apps/InterviewGuide/scripts/lib/parse_knowledge.ts`
```
import fs from 'node:fs/promises';

import { normalizeCompanyList } from './company_normalizer';
import type { ParsedQuestionRow } from './types';

interface MutableQuestion {
  question: string;
  memberCount: number;
  companies: string[];
  variants: string[];
}

const QUESTION_HEADER_RE = /^###\s+\d+\.\s+(?:🔥+\s*)?(.+)$/;
const CATEGORY_RE = /^##\s+(.+)$/;
const COMPANIES_RE = /^\*\*出现公司\*\*:\s*(.+)$/;
const COUNT_RE = /^\*\*出现次数\*\*:\s*(?:\*\*)?(\d+)(?:\*\*)?/;
const VARIANTS_RE = /^\*\*常见变体\*\*:/;

export async function parseKnowledge(filePath: string): Promise<ParsedQuestionRow[]> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  let categoryName = 'uncertain';
  let categoryKey = 'uncertain';
  let readingVariants = false;
  let current: MutableQuestion | null = null;

  const rows: ParsedQuestionRow[] = [];

  const pushCurrent = () => {
    if (!current) return;
    const id = `knowledge-${rows.length + 1}`;
    rows.push({
      id,
      question: current.question,
      memberCount: current.memberCount,
      categoryName,
      categoryKey,
      companies: [...current.companies],
      variants: [...current.variants],
      source: 'knowledge',
    });
  };

  for (const line of lines) {
    const categoryMatch = line.match(CATEGORY_RE);
    if (categoryMatch && !line.startsWith('###')) {
      pushCurrent();
      current = null;
      readingVariants = false;
      categoryName = categoryMatch[1].trim();
      categoryKey = categoryName.toLowerCase();
      continue;
    }

    const questionMatch = line.match(QUESTION_HEADER_RE);
    if (questionMatch) {
      pushCurrent();
      current = {
        question: questionMatch[1].trim(),
        memberCount: 0,
        companies: [],
        variants: [],
      };
      readingVariants = false;
      continue;
    }

    if (!current) continue;

    const companiesMatch = line.match(COMPANIES_RE);
    if (companiesMatch) {
      current.companies = normalizeCompanyList(
        companiesMatch[1]
          .split(/[，,]/)
          .map((item) => item.trim())
          .filter(Boolean),
      );
      continue;
    }

    const countMatch = line.match(COUNT_RE);
    if (countMatch) {
      current.memberCount = Number.parseInt(countMatch[1], 10);
      continue;
    }

    if (line.match(VARIANTS_RE)) {
      readingVariants = true;
      continue;
    }

    if (readingVariants) {
      if (line.startsWith('- ')) {
        current.variants.push(line.slice(2).trim());
      } else if (line.trim() === '') {
        continue;
      } else {
        readingVariants = false;
      }
    }
  }

  pushCurrent();
  return rows;
}

```

### Core Architecture Module: `apps/InterviewGuide/scripts/lib/types.ts`
```
export interface ParsedQuestionRow {
  id: string;
  question: string;
  memberCount: number;
  categoryName: string;
  categoryKey: string;
  companies: string[];
  variants: string[];
  source: 'knowledge' | 'company';
}

export interface ParsedCompanyRow {
  id: string;
  company: string;
  question: string;
  memberCount: number;
  source: 'company';
}

```

### Core Architecture Module: `apps/InterviewGuide/src/components/filters/FilterBar.ts`
```
export interface QuestionListItem {
  id: string;
  title: string;
  frequency: number;
  categoryKey: string;
  companies: string[];
}

export interface QuestionFilterOptions {
  keyword?: string;
  minFrequency?: number;
  company?: string;
  categoryKey?: string;
}

export function applyQuestionFilters<T extends QuestionListItem>(
  questions: T[],
  options: QuestionFilterOptions = {},
): T[] {
  const keyword = options.keyword?.trim().toLowerCase() ?? '';
  const minFrequency = options.minFrequency ?? 0;
  const company = options.company?.trim();
  const categoryKey = options.categoryKey?.trim();

  return questions.filter((question) => {
    if (question.frequency < minFrequency) return false;
    if (company && !question.companies.includes(company)) return false;
    if (categoryKey && question.categoryKey !== categoryKey) return false;
    if (!keyword) return true;
    return question.title.toLowerCase().includes(keyword);
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #166** (2026-09-15): **docs: add recursive self-improvement landscape**
  *Symptoms*: 发布 RSI（递归自我改进）研究综述，覆盖分类框架、论文、开源项目、评测、安全与业界格局，并将两张配图本地化以保证长期可访问。  同时把 README 首屏定位更新为 `Agent = Harness + Model`。  验证：内容目录检查、元数据检查、本地链接检查、站点冒烟检查、仓库自动化检查均通过。

- **Issue #164** (2026-09-04): **feat: integrate content taxonomy and site automation**
  *Symptoms*: ## Summary  AgentGuide's public content can now be classified, built, tested, and deployed from source without committing generated snapshots or exposing unfinished documents as complete resources.  The content catalog gives 137 documents an explicit lifecycle, keeps 16 backlog items out of public recommendations, and generates the resource index and sitemap only when CI or deployment needs them. Both Astro applications now live under a first-party apps boundary while preserving the existing /research/ and /interview/ URLs; CI independently builds them and smoke-tests the exact Pages tree before upload.  Issue intake now separates reproducible repository defects and testable core proposals from community join requests, generic consultation, and third-party promotion. The integration also repairs the confirmed roadmap links and context-engineering images, removes the stale automated-application recommendation, and lets the taxonomy test run from a clean checkout.  ## Integration Notes  - Consolidates #160, #161, and #163 onto `main` after #159 was merged. - Resolves the generated-data merge conflict by keeping `data/resources.json` untracked and generating it during CI/deployment as designed. - No application source content changed during the `external/` to `apps/` moves. - Public website routes remain unchanged.  ## Verification  - Content catalog: 137 documents, 16 backlog items, 20 generated indexes - Deployment data: 123 resources, 13,023 canonical URLs - Repository links:

- **Issue #163** (2026-09-04): **fix: restore core resources and route issue intake**
  *Symptoms*: ## Summary  Learners can again open the affected LlamaIndex lessons, and the published context-engineering guide no longer depends on an image CDN that returns 403. Its key architecture is now repository-owned and reproducibly rendered from Mermaid source.  Community join requests are routed to the documented contact channels instead of the bug tracker. New Issue Forms require a reproducible repository problem or a core, testable deliverable, which keeps generic promotion and consultation out of the implementation queue.  The content taxonomy test now builds resource records in-process, so it also passes from a clean checkout before deployment data is generated.  Resolves #81, #94, #99, #100, and #151.  This is stacked on #160; retarget it to `main` after #160 merges.  ## Test Plan  - `python scripts/manage_content_catalog.py --check` - `python tests/content_metadata.test.py` with no generated `data/resources.json` or `sitemap.xml` - `python tests/markdown_links.test.py` - `python tests/repository_automation.test.py` - `python scripts/generate_resources.py` - `python tests/site_static_smoke.test.py` - Render `figures/context-engineering-system.mmd` with Mermaid CLI and inspect the PNG - Parse all Issue Form YAML files with Ruby Psych  ---  [![Compound Engineering](https://img.shields.io/badge/Built_with-Compound_Engineering-6366f1)](https://github.com/EveryInc/compound-engineering-plugin) ![Codex](https://img.shields.io/badge/GPT--5-000000) 

- **Issue #162** (2026-09-04): **申请加群**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 为避免将 Issue 列表作为入群申请队列，本仓库不再通过 Issue 处理加群。请按 [README 的社群入口](https://github.com/adongwanai/AgentGuide#-联系作者--加入社群)，通过公众号或小红书申请。本 Issue 作为非仓库问题关闭，感谢理解。相关入口治理见 #163。

- **Issue #158** (2026-09-04): **申请加群**
  *Symptoms*: 申请加群
  **Post-Mortem & Fix Analysis**:
  > 为避免将 Issue 列表作为入群申请队列，本仓库不再通过 Issue 处理加群。请按 [README 的社群入口](https://github.com/adongwanai/AgentGuide#-联系作者--加入社群)，通过公众号或小红书申请。本 Issue 作为非仓库问题关闭，感谢理解。相关入口治理见 #163。

- **Issue #156** (2026-09-04): **给 AI Agent 学习路线补一个 ML 系统设计面试练习入口**
  *Symptoms*: 你好 阿东玩AI，  我认真看了 docs/05-roadmaps/learning-roadmap-algorithm.md。算法学习路线把项目打磨、README、技术博客和简历项目经历放在同一阶段，说明目标不是刷完材料，而是形成可展示、可讲清楚的工程能力。  我是 PracHub 创始人 Andy，这是一个透明披露的资源建议。PracHub 的 ML System Design 题库可以作为下一步练习，让读者针对推荐、检索、模型服务、监控和实验设计做完整的面试表达。  https://prachub.com/categories/ml-system-design  如果你认为适合，是否愿意独立审核一下，把它放在docs/05-roadmaps/learning-roadmap-algorithm.md 的面试准备或项目表达阶段？中性描述可以是：  “PracHub - 覆盖推荐、检索、模型服务、监控与实验设计的 ML 系统设计面试题库。”  我不是希望你删除或替换任何现有来源。如果不符合项目的编辑标准，不需要采取任何行动。  谢谢， Andy Founder, PracHub
  **Post-Mortem & Fix Analysis**:
  > 感谢透明披露。该建议的交付物只是为关联服务增加一个外链，不形成 AgentGuide 自身可运行、可评测或可验证的核心能力，因此不纳入路线，按不计划关闭。

- **Issue #155** (2026-09-04): **申请加群**
  *Symptoms*: 申请
  **Post-Mortem & Fix Analysis**:
  > 为避免将 Issue 列表作为入群申请队列，本仓库不再通过 Issue 处理加群。请按 [README 的社群入口](https://github.com/adongwanai/AgentGuide#-联系作者--加入社群)，通过公众号或小红书申请。本 Issue 作为非仓库问题关闭，感谢理解。相关入口治理见 #163。

- **Issue #154** (2026-09-28): **docs: 补充 Paper Agent 蓝图的社区实现**
  *Symptoms*: 按 projects/01-paper-agent 的蓝图实现的完整项目，同一文献综述业务用三种 Agent 形态各实现一遍（workflow / ReAct / deepagents harness），附对照跑分。  - projects/01-paper-agent/README.md 新增「社区实现」一节 - projects/04-end-to-end-projects/README.md 的 Graph / Workflow 分类新增条目

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

### Incident Patch 1: `42666a2d` (2026-09-04)
**Commit Message**: fix: restore learning resources and issue intake

**File**: `.github/ISSUE_TEMPLATE/bug-report.yml` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+name: 仓库问题
+description: 报告可复现的链接、图片、内容、网站或自动化问题
+title: "[Bug] "
+body:
+  - type: markdown
+    attributes:
+      value: 感谢反馈。请提供准确位置和复现信息，方便直接验证和修复。
+  - type: dropdown
+    id: kind
+    attributes:
+      label: 问题类型
+      options:
+        - 链接或图片失效
+        - 文档内容错误
+        - 网站功能异常
+        - 构建或自动化异常
+        - 其他核心问题
+    validations:
+      required: true
+  - type: input
+    id: location
+    attributes:
+      label: 问题位置
+      description: 请填写文件路径、网页地址或功能入口。
+      placeholder: docs/02-tech-stack/example.md
+    validations:
+      required: true
+  - type: textarea
+    id: reproduction
+    attributes:
+      label: 复现步骤与实际结果
+      description: 写明如何触发问题，以及你实际看到的结果。
+    validations:
+      required: true
+  - type: textarea
+    id: expected
+    attributes:
+      label: 期望结果
+    validations:
+      required: true
+  - type: checkboxes
+    id: checks
+    attributes:
+      label: 提交前检查
+      options:
+        - label: 我已搜索现有 Issue，确认没有重复报告。
+          required: true
+        - label: 这不是加群、泛泛咨询或第三方推广请求。
+          required: true
```

**File**: `.github/ISSUE_TEMPLATE/config.yml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+blank_issues_enabled: false
+contact_links:
+  - name: 加入 AI Agent 学习社群
+    url: https://github.com/adongwanai/AgentGuide#-联系作者--加入社群
+    about: 请按 README 中的公众号或小红书方式申请，不要创建 Issue。
```

**File**: `.github/ISSUE_TEMPLATE/core-improvement.yml` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+name: 核心改进建议
+description: 提议与现有学习路线或项目直接相关、可验收的改进
+title: "[Proposal] "
+body:
+  - type: markdown
+    attributes:
+      value: 建议应解决现有用户问题，并形成可运行、可评测或可验证的交付物。
+  - type: input
+    id: target
+    attributes:
+      label: 对应模块
+      description: 请填写现有学习路线、项目或功能入口。
+      placeholder: projects/01-paper-agent
+    validations:
+      required: true
+  - type: textarea
+    id: problem
+    attributes:
+      label: 当前问题
+      description: 说明目标用户、使用场景和现有缺口。
+    validations:
+      required: true
+  - type: textarea
+    id: deliverable
+    attributes:
+      label: 建议交付物与验收方式
+      description: 说明准备提交什么，以及如何证明它有效。
+    validations:
+      required: true
+  - type: textarea
+    id: evidence
+    attributes:
+      label: 依据
+      description: 提供官方文档、论文、复现记录或测试结果等一手证据。
+    validations:
+      required: true
+  - type: dropdown
+    id: affiliation
+    attributes:
+      label: 是否与推荐的项目或服务存在利益关系
+      options:
+        - 否
+        - 是，已在上方完整披露
+    validations:
+      required: true
+  - type: checkboxes
+    id: checks
+    attributes:
+      label: 提交前检查
+      options:
+        - label: 我已搜索现有 Issue，确认没有重复提案。
+          required: true
+        - label: 该建议不是单纯增加外链、广告或项目曝光。
+          required: true
```

**File**: `CONTRIBUTING.md` (modified, +6/-4)
```diff
@@ -65,7 +65,10 @@
 - 文档错误（错别字、技术错误）
 - 代码 Bug
 - 内容缺失
-- 改进建议
+- 与现有学习路线或项目直接相关、且有明确验收方式的改进建议
+
+加群、泛泛咨询和第三方项目推广不属于 Issue。加入学习社群请按
+[README 的社群入口](./README.md#-联系作者--加入社群)操作。
 
 ## 🚀 贡献流程
 
@@ -174,7 +177,7 @@ git push origin 你的分支名
 **A**: 推荐从以下几个方向开始：
 - 纠正文档中的错别字或格式问题
 - 完善代码示例的注释
-- 补充"扩展阅读"部分的优质资源链接
+- 修复失效链接，并优先改向官方文档或一手来源
 
 ### Q2: 我想贡献内容，但不确定写得对不对？
 **A**: 没关系！提交 PR 后，我会仔细 Review 并给出建议。不用担心犯错，一起改进就好。
@@ -187,9 +190,8 @@ git push origin 你的分支名
 如果你有任何疑问，可以通过以下方式联系作者：
 
 - 💬 微信：加入社群后私信
-- 📝 提 Issue：[GitHub Issues](https://github.com/adongwanai/AgentGuide/issues)
+- 📝 仓库问题：按 [Issue 模板](https://github.com/adongwanai/AgentGuide/issues/new/choose) 提交可复现信息
 
 ---
 
 **再次感谢你的贡献！让我们一起打造 AI Agent 领域最好的中文学习资源！🚀**
-
```

**File**: `README.md` (modified, +4/-6)
```diff
@@ -380,9 +380,6 @@ AgentGuide 围绕 **“做得出、跑得稳、测得准、讲得清”** 组织
 
 **时机窗口：** 3-6月提前批竞争烈度比8-9月低30-40%，往往是真正的机会窗口。
 
-**AI辅助投递工具：**
-- [Auto Job Apply](https://zread.ai/loks666/get_jobs) - 开源自动投递简历工具，支持批量投递与AI简历适配
-
 ### 说几句实话
 
 - **语言不是门槛，设计才是。** Python/TypeScript AI都能帮你写。但Agent状态机怎么设计、Memory何时截断、工具调用失败如何fallback——这些必须你自己想清楚、讲明白。
@@ -2043,9 +2040,10 @@ AgentGuide 提供 **简历级实战项目**，每个项目都提供：
 
 **如何加入？**
 
-1. **方式一**：Star 本项目后，在 [Issues](https://github.com/adongwanai/AgentGuide/issues) 中评论"申请加群"
-2. **方式二**：关注公众号「阿东玩AI」，回复「AgentGuide」获取入群二维码
-3. **方式三**：[小红书@阿东玩AI](https://www.xiaohongshu.com/user/profile/5f310fd50000000001009df5)，私信"加群"
+1. 关注公众号「阿东玩AI」，回复「AgentGuide」获取入群二维码
+2. [小红书@阿东玩AI](https://www.xiaohongshu.com/user/profile/5f310fd50000000001009df5)，私信"加群"
+
+GitHub Issues 仅用于可复现的仓库问题和有明确交付物的核心改进，不处理加群申请。
 
 
 **🎁 社群福利**：Agent 学习路线图 PDF + 面试题库 + 项目代码模板 + 大厂内推机会
```

---

### Incident Patch 2: `d86ee2b6` (2026-08-04)
**Commit Message**: fix: derive sitemap lastmod from source files, ignore .DS_Store (#134)

sitemap_urls() 原先把全部 13023 条 URL 的 lastmod 写成 datetime.now()，
跨天再跑就整份重写。改为按各 URL 的内容来源文件取 git 提交日期：
首页取 index.html，research 页取对应 .mdx，题目/分类/公司页取各自 JSON。
跨天不变已验证（伪造为 2027-03-15 生成，分布与今日一致）。

git_date() 加缓存，新增 newest_git_date()。
.gitignore 补 .DS_Store 规则，并 git rm --cached 取消跟踪已有的两个文件。

**File**: `.gitignore` (modified, +4/-0)
```diff
@@ -26,3 +26,7 @@ external/InterviewGuide/.astro/
 site-dist/
 __pycache__/
 *.pyc
+
+# macOS Finder 目录元数据（图标位置、窗口大小、排序方式）
+# 仅对生成它的那台 Mac 有意义，且会记录目录内的文件名
+.DS_Store
```

**File**: `scripts/generate_resources.py` (modified, +51/-19)
```diff
@@ -241,7 +241,10 @@ def status_for_text(md, word_count):
     return "建设中" if has_placeholder and word_count < 800 else "已完善"
 
 
-def git_date(path):
+_GIT_DATE_CACHE = {}
+
+
+def _git_date_uncached(path):
     try:
         result = subprocess.run(
             ["git", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
@@ -261,6 +264,21 @@ def git_date(path):
         return datetime.now().strftime("%Y-%m-%d")
 
 
+def git_date(path):
+    # sitemap 现在按内容来源文件取日期，同一文件会被多次查询
+    # （例如 12960 条题目页共用 questions.json），缓存避免重复 fork git。
+    key = str(path)
+    if key not in _GIT_DATE_CACHE:
+        _GIT_DATE_CACHE[key] = _git_date_uncached(path)
+    return _GIT_DATE_CACHE[key]
+
+
+def newest_git_date(paths, fallback):
+    """取一组文件中最新的提交日期；集合为空时回退到 fallback。"""
+    dates = [git_date(path) for path in paths]
+    return max(dates) if dates else fallback
+
+
 def build_url(rel):
     return f"https://github.com/{OWNER_REPO}/blob/main/{quote(rel, safe='/')}"
 
@@ -307,32 +325,46 @@ def collect_resources():
 
 
 def sitemap_urls():
-    today = datetime.now().strftime("%Y-%m-%d")
-    urls = [
-        (f"{SITE_ROOT}/", today, "daily", "1.0"),
-        (f"{SITE_ROOT}/research/", today, "weekly", "0.9"),
-        (f"{SITE_ROOT}/research/docs/", today, "weekly", "0.8"),
-        (f"{SITE_ROOT}/research/skills/", today, "weekly", "0.8"),
-        (f"{SITE_ROOT}/interview/", today, "daily", "0.9"),
-        (f"{SITE_ROOT}/interview/hot/", today, "daily", "0.9"),
-        (f"{SITE_ROOT}/interview/categories/", today, "weekly", "0.8"),
-        (f"{SITE_ROOT}/interview/companies/", today, "weekly", "0.8"),
-    ]
+    """生成 sitemap 条目，lastmod 取自各 URL 对应内容来源文件的最后提交日期。
+
+    此前所有条目统一使用 datetime.now()，导致两个问题：
+    - 内容未改动时也会产生 diff（跨天即全量重写 13023 行），bot 因此提交空改动
+    - 全站 lastmod 恒为同一天，该字段对搜索引擎失去参考价值
+    """
+    site_date = git_date(ROOT / "index.html")
 
     research_content = ROOT / "external/ai-research-ebook/src/content/docs"
-    if research_content.exists():
-        for path in sorted(research_content.rglob("*.mdx")):
-            slug = path.relative_to(research_content).with_suffix("").as_posix()
-            urls.append((f"{SITE_ROOT}/research/docs/{slug}/", today, "monthly", "0.7"))
+    research_pages = sorted(research_content.rglob("*.mdx")) if research_content.exists() else []
+    research_date = newest_git_date(research_pages, site_date)
 
     interview_data = ROOT / "external/InterviewGuide/src/data"
     questions_path = interview_data / "questions.json"
     categories_path = interview_data / "categories.json"
     companies_path = interview_data / "companies.json"
 
+    # 三个 JSON 各自驱动一批 URL，同一批共用来源文件的日期
+    questions_date = git_date(questions_path) if questions_path.exists() else site_date
+    categories_date = git_date(categories_path) if categories_path.exists() else site_date
+    companies_date = git_date(companies_path) if companies_path.exists() else site_date
+
+    urls = [
+        (f"{SITE_ROOT}/", site_date, "daily", "1.0"),
+        (f"{SITE_ROOT}/research/", research_date, "weekly", "0.9"),
+        (f"{SITE_ROOT}/research/docs/", research_date, "weekly", "0.8"),
+        (f"{SITE_ROOT}/research/skills/", research_date, "weekly", "0.8"),
+        (f"{SITE_ROOT}/interview/", questions_date, "daily", "0.9"),
+        (f"{SITE_ROOT}/interview/hot/", questions_date, "daily", "0.9"),
+        (f"{SITE_ROOT}/interview/categories/", categories_date, "weekly", "0.8"),
+        (f"{SITE_ROOT}/interview/companies/", companies_date, "weekly", "0.8"),
+    ]
+
+    for path in research_pages:
+        slug = path.relative_to(research_content).with_suffix("").as_posix()
+        urls.append((f"{SITE_ROOT}/research/docs/{slug}/", git_date(path), "monthly", "0.7"))
+
     if questions_path.exists():
         for question in json.loads(read_text(questions_path)):
-            urls.append((f"{SITE_ROOT}/interview/questions/{quote(question['id'], safe='')}/", today, "monthly", "0.6"))
+            urls.
```

---

### Incident Patch 3: `1f76c4f7` (2026-08-04)
**Commit Message**: docs: fix 20 broken in-repo links and add two missing index pages (#133)

修正 15 条路径写错的相对链接（漏编号前缀、误设同目录、多写仓库名前缀）。
新增 resources/rag/README.md 与 resources/agent/papers/agent_rl/README.md，
补齐两个一直被引用却不存在的目录索引页，一并修复另外 5 条链接。
全量扫描：死链 34 → 14 条，无新增。

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1941,7 +1941,7 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
 
 **🛠️ 通用工具**：
 - [x] [开发者工具箱](./resources/tools.md) - Cursor、元宝、Excalidraw
-- [x] [开发框架总览](./resources/frameworks.md) - 快速框架对比
+- [x] [开发框架总览](./resources/agent/frameworks.md) - 快速框架对比
 
 **🎨 推荐可视化学习资源**：
 - 📊 **[100+ LLM/RL 算法原理图](https://github.com/changyeyu/LLM-RL-Visualized)** - 《大模型算法：强化学习、微调与对齐》作者巨献
```

**File**: `docs/02-tech-stack/15-agent-memory.md` (modified, +1/-1)
```diff
@@ -677,7 +677,7 @@ Week 2: 算法设计与实验
 ## 🔗 相关资源
 
 - [Memory 工具对比](../../resources/agent/memory.md) - 工具选型
-- [Memory 论文精选](Agent%20Memory%20核心论文汇总.md) - 10篇必读
+- [Memory 论文精选](../../resources/agent/papers/agent_memory/Agent%20Memory%20核心论文汇总.md) - 10篇必读
 - [上下文工程](./14-context-engineering.md) - Context Offloading 技巧
 
 ---
```

**File**: `docs/02-tech-stack/README.md` (modified, +5/-5)
```diff
@@ -82,7 +82,7 @@ Agent Harness 工程
 
 **目标**：理解上下文工程的核心概念
 
-1. **[context-engineering-practices.md](./context-engineering-practices.md)** ⭐ **必读**
+1. **[context-engineering-practices.md](./11-context-engineering-practices.md)** ⭐ **必读**
    - 600字快速了解上下文工程
    - 业界实践（Claude Code、Manus、Kiro）
    - 适合：快速建立全局认知
@@ -134,7 +134,7 @@ Agent Harness 工程
   - 适合：算法工程师优化模型
 
 #### 第六步：总结失败经验
-- **[lessons-learned.md](./lessons-learned.md)**
+- **[lessons-learned.md](./23-lessons-learned.md)**
   - 真实项目的坑与教训
   - 如何避免常见错误
   - 适合：少走弯路
@@ -185,7 +185,7 @@ Agent Harness 工程
 
 ### ⭐ 必读文档（5篇）
 
-#### 1. [context-engineering-practices.md](./context-engineering-practices.md)
+#### 1. [context-engineering-practices.md](./11-context-engineering-practices.md)
 **一句话总结**：业界主流产品的上下文工程实践精华
 
 **核心内容**：
@@ -315,7 +315,7 @@ Agent Harness 工程
 
 ---
 
-#### 8. [lessons-learned.md](./lessons-learned.md)
+#### 8. [lessons-learned.md](./23-lessons-learned.md)
 **一句话总结**：真实项目的坑与教训
 
 **核心内容**：
@@ -468,7 +468,7 @@ Agent Harness 工程
 
 ### ⭐ 上下文工程资源合集（必看！）
 
-**[📖 全网最全最优质的上下文工程资源合集](./context-engineering-resources.md)** 🔥
+**[📖 全网最全最优质的上下文工程资源合集](./13-context-engineering-resources.md)** 🔥
 
 涵盖 18+ 篇核心资源：
 - ✅ **核心概念**：Philipp Schmid、上下文工程 2.0
```

**File**: `resources/agent/memory.md` (modified, +2/-2)
```diff
@@ -277,9 +277,9 @@ result = memory.search("用户喜欢什么颜色?", user_id="user123")
 
 ## 📝 相关文档
 
-- [Agent Memory 论文精选](Agent%20Memory%20核心论文汇总.md) - 10篇必读论文详解
+- [Agent Memory 论文精选](./papers/agent_memory/Agent%20Memory%20核心论文汇总.md) - 10篇必读论文详解
 - [Agent 框架对比](./frameworks.md)
-- [Tool Use 资源](./tools.md)
+- [Tool Use 资源](../tools.md)
 - [返回 Agent 资源总览](./README.md)
 
 **🔗 完整论文列表**：查看 [Awesome-Awesome-LLM](https://github.com/adongwanai/Awesome-Awesome-LLM)
```

**File**: `resources/agent/papers/agent_memory/Agent Memory 核心论文汇总.md` (modified, +4/-4)
```diff
@@ -457,13 +457,13 @@ Abstract → Introduction → Method（重点！）→ Experiments → Conclusio
 
 ## 📝 相关文档
 
-- [Agent Memory 工具对比](memory.md) - 实用工具推荐
-- [Agent Memory 技术教程](15-agent-memory.md) - 从原理到实战
-- [返回 Agent 资源总览](AgentGuide/resources/agent/README.md)
+- [Agent Memory 工具对比](../../memory.md) - 实用工具推荐
+- [Agent Memory 技术教程](../../../../docs/02-tech-stack/15-agent-memory.md) - 从原理到实战
+- [返回 Agent 资源总览](../../README.md)
 
 ---
 
-**👉 返回主文档**：[AgentGuide README](AgentGuide/README.md)
+**👉 返回主文档**：[AgentGuide README](../../../../README.md)
 
 
 
```

---

### Incident Patch 4: `7d7781c3` (2026-05-28)
**Commit Message**: docs: fix forks badge

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
         <img src="https://img.shields.io/github/stars/adongwanai/AgentGuide.svg?style=for-the-badge&logo=github&label=Stars" alt="GitHub stars">
     </a>
     <a href="https://github.com/adongwanai/AgentGuide/network/members">
-        <img src="https://img.shields.io/github/forks/adongwanai/AgentGuide.svg?style=for-the-badge&logo=github&label=Forks" alt="GitHub forks">
+        <img src="https://img.shields.io/badge/Forks-527-orange.svg?style=for-the-badge&logo=github" alt="GitHub forks">
     </a>
     
 <br/>
```

---

### Incident Patch 5: `82def14c` (2026-05-25)
**Commit Message**: docs: fix mojibake in evaluation playbook

**File**: `docs/04-interview/18-agent-interview-playbooks/agent-evaluation-playbook.md` (modified, +1/-1)
```diff
@@ -388,7 +388,7 @@ Anthropic 的核心建议是：**读 transcripts 不能外包给 LLM。** Design
 ## B. Grader 设计
 5. Code-based Grader 最适合做什么？不适合做什么？
 6. LLM Judge 的三大最佳实践是什么？
-7. 为什么 LLM Judge 必须有不确��逃生门（Uncertain Escape Hatch）？
+7. 为什么 LLM Judge 必须有不确定逃生门（Uncertain Escape Hatch）？
 8. 你怎么校准 LLM Judge？Cohen's Kappa 低于多少需要重写 prompt？
 
 ## C. 系统设计
```

---

### Incident Patch 6: `1f50ed01` (2026-05-23)
**Commit Message**: fix: add placeholder docs for 21 missing files referenced in README

README.md referenced 21 doc files that never existed, causing 404s on GitHub.
Created placeholder markdown files with 🚧 'coming soon' notices for:
- docs/01-theory/: 7 files (01-09)
- docs/02-tech-stack/: 8 files (frameworks, RAG, RL, etc.)
- docs/03-practice/: 3 files (RAG, security, graduation)
- docs/04-interview/: 3 files (career, resume, storytelling)

**File**: `docs/01-theory/01-what-is-agent.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# 什么是 AI Agent？
+
+> 🚧 本文档正在编写中，敬请期待...
+
+## 概述
+
+本文将介绍 AI Agent 的定义、分级体系（L1-L5）、以及与传统软件的核心区别。
+
+---
+
+*如果你希望贡献此文档，欢迎提交 PR！*
```

**File**: `docs/01-theory/02-agent-history.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Agent 技术演进史
+
+> 🚧 本文档正在编写中，敬请期待...
+
+## 概述
+
+本文将梳理从符号主义到 LLM 驱动 Agent 的技术演进历程。
+
+---
+
+*如果你希望贡献此文档，欢迎提交 PR！*
```

**File**: `docs/01-theory/03-transformer.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Transformer 架构详解
+
+> 🚧 本文档正在编写中，敬请期待...
+
+## 概述
+
+本文将深入讲解 Self-Attention、位置编码、多头注意力等核心机制。
+
+---
+
+*如果你希望贡献此文档，欢迎提交 PR！*
```

**File**: `docs/01-theory/04-react-framework.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# 手撕 ReAct 框架
+
+> 🚧 本文档正在编写中，敬请期待...
+
+## 概述
+
+本文将介绍 ReAct（Reasoning + Acting）框架的原理与实现方法。
+
+---
+
+*如果你希望贡献此文档，欢迎提交 PR！*
```

**File**: `docs/01-theory/05-cot-and-planning.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Chain-of-Thought 与规划
+
+> 🚧 本文档正在编写中，敬请期待...
+
+## 概述
+
+本文将讲解 CoT 推理、任务规划与分解策略。
+
+---
+
+*如果你希望贡献此文档，欢迎提交 PR！*
```

---

### Incident Patch 7: `4c9fe724` (2026-03-09)
**Commit Message**: Merge pull request #36 from yiweinanzi/fix/interview-pages-404-v2

fix: restore /interview/ GitHub Pages deployment

**File**: `.github/workflows/deploy-pages.yml` (modified, +8/-9)
```diff
@@ -3,10 +3,13 @@ name: Deploy static site to GitHub Pages
 on:
   push:
     branches: ["main"]
+    paths-ignore:
+      - 'research/**'
+      - 'interview/**'
   workflow_dispatch:
 
 permissions:
-  contents: write
+  contents: read
   pages: write
   id-token: write
 
@@ -69,14 +72,6 @@ jobs:
           mkdir -p interview
           cp -r external/InterviewGuide/dist/* interview/
 
-      - name: Commit generated sub-sites if changed
-        run: |
-          git config user.name "github-actions[bot]"
-          git config user.email "github-actions[bot]@users.noreply.github.com"
-          git add research/ interview/
-          git diff --quiet && git diff --staged --quiet || git commit -m "Auto-update external sites"
-          git push || echo "No changes to push"
-
       - uses: actions/upload-pages-artifact@v3
         with:
           path: .
@@ -88,5 +83,9 @@ jobs:
     runs-on: ubuntu-latest
     needs: build
     steps:
+      - name: Setup Pages
+        uses: actions/configure-pages@v5
+        with:
+          enablement: true
       - id: deployment
         uses: actions/deploy-pages@v4
```

**File**: `.github/workflows/static.yml` (modified, +0/-4)
```diff
@@ -2,10 +2,6 @@
 name: Deploy static content to Pages
 
 on:
-  # Runs on pushes targeting the default branch
-  push:
-    branches: ["main"]
-
   # Allows you to run this workflow manually from the Actions tab
   workflow_dispatch:
 
```

**File**: `tests/interviewguide_external_integration.test.sh` (modified, +16/-0)
```diff
@@ -3,6 +3,7 @@ set -euo pipefail
 
 ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 WORKFLOW_FILE="$ROOT_DIR/.github/workflows/deploy-pages.yml"
+STATIC_WORKFLOW_FILE="$ROOT_DIR/.github/workflows/static.yml"
 INDEX_FILE="$ROOT_DIR/index.html"
 GITIGNORE_FILE="$ROOT_DIR/.gitignore"
 EXTERNAL_DIR="$ROOT_DIR/external/InterviewGuide"
@@ -11,6 +12,21 @@ grep -q "external/InterviewGuide/package-lock.json" "$WORKFLOW_FILE"
 grep -q "working-directory: external/InterviewGuide" "$WORKFLOW_FILE"
 grep -q "BASE_PATH: /AgentGuide/interview" "$WORKFLOW_FILE"
 grep -q "cp -r external/InterviewGuide/dist/\\* interview/" "$WORKFLOW_FILE"
+grep -q "paths-ignore:" "$WORKFLOW_FILE"
+grep -q "'research/\\*\\*'" "$WORKFLOW_FILE"
+grep -q "'interview/\\*\\*'" "$WORKFLOW_FILE"
+grep -q "uses: actions/configure-pages@v5" "$WORKFLOW_FILE"
+grep -q "enablement: true" "$WORKFLOW_FILE"
+if grep -Eq "git add .*research/.*interview/" "$WORKFLOW_FILE"; then
+  echo "workflow should not auto-commit generated research/interview directories"
+  exit 1
+fi
+
+# avoid dual-pages workflows both auto-triggering on push
+if grep -q "^  push:" "$STATIC_WORKFLOW_FILE"; then
+  echo "static.yml should not auto-trigger on push"
+  exit 1
+fi
 
 grep -q "external/InterviewGuide/dist/" "$GITIGNORE_FILE"
 grep -q "external/InterviewGuide/node_modules/" "$GITIGNORE_FILE"
```

---

### Incident Patch 8: `9daaefe9` (2026-03-09)
**Commit Message**: fix: prevent pages workflow from overriding interview site

**File**: `.github/workflows/deploy-pages.yml` (modified, +8/-9)
```diff
@@ -3,10 +3,13 @@ name: Deploy static site to GitHub Pages
 on:
   push:
     branches: ["main"]
+    paths-ignore:
+      - 'research/**'
+      - 'interview/**'
   workflow_dispatch:
 
 permissions:
-  contents: write
+  contents: read
   pages: write
   id-token: write
 
@@ -69,14 +72,6 @@ jobs:
           mkdir -p interview
           cp -r external/InterviewGuide/dist/* interview/
 
-      - name: Commit generated sub-sites if changed
-        run: |
-          git config user.name "github-actions[bot]"
-          git config user.email "github-actions[bot]@users.noreply.github.com"
-          git add research/ interview/
-          git diff --quiet && git diff --staged --quiet || git commit -m "Auto-update external sites"
-          git push || echo "No changes to push"
-
       - uses: actions/upload-pages-artifact@v3
         with:
           path: .
@@ -88,5 +83,9 @@ jobs:
     runs-on: ubuntu-latest
     needs: build
     steps:
+      - name: Setup Pages
+        uses: actions/configure-pages@v5
+        with:
+          enablement: true
       - id: deployment
         uses: actions/deploy-pages@v4
```

**File**: `.github/workflows/static.yml` (modified, +0/-4)
```diff
@@ -2,10 +2,6 @@
 name: Deploy static content to Pages
 
 on:
-  # Runs on pushes targeting the default branch
-  push:
-    branches: ["main"]
-
   # Allows you to run this workflow manually from the Actions tab
   workflow_dispatch:
 
```

**File**: `tests/interviewguide_external_integration.test.sh` (modified, +16/-0)
```diff
@@ -3,6 +3,7 @@ set -euo pipefail
 
 ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 WORKFLOW_FILE="$ROOT_DIR/.github/workflows/deploy-pages.yml"
+STATIC_WORKFLOW_FILE="$ROOT_DIR/.github/workflows/static.yml"
 INDEX_FILE="$ROOT_DIR/index.html"
 GITIGNORE_FILE="$ROOT_DIR/.gitignore"
 EXTERNAL_DIR="$ROOT_DIR/external/InterviewGuide"
@@ -11,6 +12,21 @@ grep -q "external/InterviewGuide/package-lock.json" "$WORKFLOW_FILE"
 grep -q "working-directory: external/InterviewGuide" "$WORKFLOW_FILE"
 grep -q "BASE_PATH: /AgentGuide/interview" "$WORKFLOW_FILE"
 grep -q "cp -r external/InterviewGuide/dist/\\* interview/" "$WORKFLOW_FILE"
+grep -q "paths-ignore:" "$WORKFLOW_FILE"
+grep -q "'research/\\*\\*'" "$WORKFLOW_FILE"
+grep -q "'interview/\\*\\*'" "$WORKFLOW_FILE"
+grep -q "uses: actions/configure-pages@v5" "$WORKFLOW_FILE"
+grep -q "enablement: true" "$WORKFLOW_FILE"
+if grep -Eq "git add .*research/.*interview/" "$WORKFLOW_FILE"; then
+  echo "workflow should not auto-commit generated research/interview directories"
+  exit 1
+fi
+
+# avoid dual-pages workflows both auto-triggering on push
+if grep -q "^  push:" "$STATIC_WORKFLOW_FILE"; then
+  echo "static.yml should not auto-trigger on push"
+  exit 1
+fi
 
 grep -q "external/InterviewGuide/dist/" "$GITIGNORE_FILE"
 grep -q "external/InterviewGuide/node_modules/" "$GITIGNORE_FILE"
```

---

### Incident Patch 9: `99674351` (2026-02-26)
**Commit Message**: fix: stabilize pages workflow and auto-enable pages

**File**: `.github/workflows/deploy-pages.yml` (modified, +4/-0)
```diff
@@ -83,5 +83,9 @@ jobs:
     runs-on: ubuntu-latest
     needs: build
     steps:
+      - name: Setup Pages
+        uses: actions/configure-pages@v5
+        with:
+          enablement: true
       - id: deployment
         uses: actions/deploy-pages@v4
```

**File**: `.github/workflows/static.yml` (modified, +0/-4)
```diff
@@ -2,10 +2,6 @@
 name: Deploy static content to Pages
 
 on:
-  # Runs on pushes targeting the default branch
-  push:
-    branches: ["main"]
-
   # Allows you to run this workflow manually from the Actions tab
   workflow_dispatch:
 
```

**File**: `tests/interviewguide_external_integration.test.sh` (modified, +9/-0)
```diff
@@ -3,6 +3,7 @@ set -euo pipefail
 
 ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 WORKFLOW_FILE="$ROOT_DIR/.github/workflows/deploy-pages.yml"
+STATIC_WORKFLOW_FILE="$ROOT_DIR/.github/workflows/static.yml"
 INDEX_FILE="$ROOT_DIR/index.html"
 GITIGNORE_FILE="$ROOT_DIR/.gitignore"
 EXTERNAL_DIR="$ROOT_DIR/external/InterviewGuide"
@@ -14,11 +15,19 @@ grep -q "cp -r external/InterviewGuide/dist/\\* interview/" "$WORKFLOW_FILE"
 grep -q "paths-ignore:" "$WORKFLOW_FILE"
 grep -q "'research/\\*\\*'" "$WORKFLOW_FILE"
 grep -q "'interview/\\*\\*'" "$WORKFLOW_FILE"
+grep -q "uses: actions/configure-pages@v5" "$WORKFLOW_FILE"
+grep -q "enablement: true" "$WORKFLOW_FILE"
 if grep -Eq "git add .*research/.*interview/" "$WORKFLOW_FILE"; then
   echo "workflow should not auto-commit generated research/interview directories"
   exit 1
 fi
 
+# avoid dual-pages workflows both auto-triggering on push
+if grep -q "^  push:" "$STATIC_WORKFLOW_FILE"; then
+  echo "static.yml should not auto-trigger on push"
+  exit 1
+fi
+
 grep -q "external/InterviewGuide/dist/" "$GITIGNORE_FILE"
 grep -q "external/InterviewGuide/node_modules/" "$GITIGNORE_FILE"
 grep -q "external/InterviewGuide/.astro/" "$GITIGNORE_FILE"
```

---

### Incident Patch 10: `017e545b` (2026-02-26)
**Commit Message**: fix: deploy external sites without committing generated folders

**File**: `.github/workflows/deploy-pages.yml` (modified, +1/-9)
```diff
@@ -9,7 +9,7 @@ on:
   workflow_dispatch:
 
 permissions:
-  contents: write
+  contents: read
   pages: write
   id-token: write
 
@@ -72,14 +72,6 @@ jobs:
           mkdir -p interview
           cp -r external/InterviewGuide/dist/* interview/
 
-      - name: Commit generated sub-sites if changed
-        run: |
-          git config user.name "github-actions[bot]"
-          git config user.email "github-actions[bot]@users.noreply.github.com"
-          git add research/ interview/
-          git diff --quiet && git diff --staged --quiet || git commit -m "Auto-update external sites"
-          git push || echo "No changes to push"
-
       - uses: actions/upload-pages-artifact@v3
         with:
           path: .
```

**File**: `tests/interviewguide_external_integration.test.sh` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@ grep -q "cp -r external/InterviewGuide/dist/\\* interview/" "$WORKFLOW_FILE"
 grep -q "paths-ignore:" "$WORKFLOW_FILE"
 grep -q "'research/\\*\\*'" "$WORKFLOW_FILE"
 grep -q "'interview/\\*\\*'" "$WORKFLOW_FILE"
+if grep -Eq "git add .*research/.*interview/" "$WORKFLOW_FILE"; then
+  echo "workflow should not auto-commit generated research/interview directories"
+  exit 1
+fi
 
 grep -q "external/InterviewGuide/dist/" "$GITIGNORE_FILE"
 grep -q "external/InterviewGuide/node_modules/" "$GITIGNORE_FILE"
```

#### Recent Merged Pull Requests:
- **PR #166** (2026-09-15): docs: add recursive self-improvement landscape (@adongwanai)
- **PR #164** (2026-09-04): feat: integrate content taxonomy and site automation (@adongwanai)
- **PR #163** (2026-09-04): fix: restore core resources and route issue intake (@adongwanai)
- **PR #154** (closed): docs: 补充 Paper Agent 蓝图的社区实现 (@11XuX)
- **PR #135** (2026-08-04): docs: 删除 career-transition 占位符残留，消除 04-interview 的四组编号重复 (@cryanskl)
- **PR #134** (2026-08-04): fix: sitemap 的 lastmod 改为按内容来源取值，并忽略 .DS_Store (@cryanskl)
- **PR #133** (2026-08-04): docs: 修复 20 条失效的仓库内链接，补齐两个缺失的目录索引页 (@cryanskl)
- **PR #132** (2026-08-04): ci: 接入已有校验脚本，并新增已发布站点的存活探测 (@cryanskl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

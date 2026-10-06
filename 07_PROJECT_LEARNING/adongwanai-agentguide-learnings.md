# Forensic Learning Record (Deep Inspection): adongwanai/AgentGuide

> **Canonical Artifact**: `07_PROJECT_LEARNING/adongwanai-agentguide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/adongwanai/AgentGuide](https://github.com/adongwanai/AgentGuide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:54:03.469Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `adongwanai/AgentGuide`
- **Description**: https://adongwanai.github.io/AgentGuide | AI Agent开发指南 | LangGraph实战 | 高级RAG | 转行大模型 | 大模型面试 | 算法工程师 | 面试题库 | 强化学习｜数据合成
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10430 stars

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

### Core Architecture Module: `apps/InterviewGuide/src/components/filters/SearchBox.ts`
```
export function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

export function includesKeyword(text: string, keyword: string): boolean {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) return true;
  return text.toLowerCase().includes(normalizedKeyword);
}

```

### Core Architecture Module: `apps/InterviewGuide/src/env.d.ts`
```
/// <reference types="astro/client" />

```

### Core Architecture Module: `apps/InterviewGuide/src/lib/admin_payload.ts`
```
export type AdminChangeType = 'add' | 'update' | 'delete' | 'other';
export type AdminPriority = 'low' | 'medium' | 'high';

export interface AdminIssueInput {
  title: string;
  company?: string;
  category?: string;
  questionId?: string;
  changeType?: AdminChangeType;
  priority?: AdminPriority;
  reason: string;
  proposedChange: string;
  references?: string;
  reporter?: string;
}

export interface AdminIssueMetadata {
  schemaVersion: 1;
  questionId: string;
  company: string;
  category: string;
  changeType: AdminChangeType;
  priority: AdminPriority;
  reporter: string;
}

export interface AdminIssuePayload {
  title: string;
  labels: string[];
  body: string;
  metadata: AdminIssueMetadata;
}

const DEFAULT_CHANGE_TYPE: AdminChangeType = 'add';
const DEFAULT_PRIORITY: AdminPriority = 'medium';

function clean(input: string | undefined): string {
  return (input ?? '').trim();
}

function normalizeChangeType(input: string | undefined): AdminChangeType {
  if (input === 'add' || input === 'update' || input === 'delete' || input === 'other') {
    return input;
  }
  return DEFAULT_CHANGE_TYPE;
}

function normalizePriority(input: string | undefined): AdminPriority {
  if (input === 'low' || input === 'medium' || input === 'high') {
    return input;
  }
  return DEFAULT_PRIORITY;
}

export function buildAdminIssuePayload(input: AdminIssueInput): AdminIssuePayload {
  const titleCore = clean(input.title) || '未命名变更';
  const questionId = clean(input.questionId) || 'unknown';
  const company = clean(input.company) || 'unknown';
  const category = clean(input.category) || 'unknown';
  const reason = clean(input.reason) || '未填写';
  const proposedChange = clean(input.proposedChange) || '未填写';
  const references = clean(input.references) || '无';
  const reporter = clean(input.reporter) || 'anonymous';
  const changeType = normalizeChangeType(clean(input.changeType));
  const priority = normalizePriority(clean(input.priority));

  const metadata: AdminIssueMetadata = {
    schemaVersion: 1,
    questionId,
    company,
    category,
    changeType,
    priority,
    reporter,
  };

  const title = `[Admin][${priority}] ${titleCore}`;
  const labels = ['admin-update', `priority:${priority}`, `change:${changeType}`];
  const body = [
    '### 背景与原因',
    reason,
    '',
    '### 期望变更',
    proposedChange,
    '',
    '### 参考资料',
    references,
    '',
    '### 结构化 Payload',
    '```json',
    JSON.stringify(metadata, null, 2),
    '```',
  ].join('\n');

  return {
    title,
    labels,
    body,
    metadata,
  };
}

export function toIssueQueryString(payload: AdminIssuePayload): string {
  const params = new URLSearchParams();
  params.set('title', payload.title);
  params.set('body', payload.body);
  params.set('labels', payload.labels.join(','));
  return params.toString();
}

```

### Core Architecture Module: `apps/InterviewGuide/src/lib/path.ts`
```
const TRAILING_COMPANY_COUNT_RE = /\s*等\d+家公司\s*$/u;

const COMPANY_SLUG_MAP: Record<string, string> = {
  字节跳动: 'bytedance',
  美团: 'meituan',
  腾讯: 'tencent',
  百度: 'baidu',
  阿里巴巴: 'alibaba',
  小红书: 'xiaohongshu',
  未知: 'unknown',
  通用题库: 'general-bank',
  华为: 'huawei',
  京东: 'jd',
  小米: 'xiaomi',
  蚂蚁集团: 'ant-group',
  拼多多: 'pinduoduo',
  OPPO: 'oppo',
  滴滴: 'didi',
  网易: 'netease',
  哔哩哔哩: 'bilibili',
  荣耀: 'honor',
  商汤: 'sensetime',
  联想: 'lenovo',
  VIVO: 'vivo',
  携程: 'trip-com',
  知乎: 'zhihu',
  快手: 'kuaishou',
  '阿里（阿里云 / 达摩院）': 'alibaba-cloud-damo',
  '阿里（阿里妈妈）': 'alimama',
  '虾皮 Shopee': 'shopee',
  'B 站': 'bilibili-b',
};

const CATEGORY_SLUG_MAP: Record<string, string> = {
  项目与行为面试: 'project-behavior',
  'nlp与大模型': 'nlp-llm',
  编程与算法: 'coding-algorithms',
  机器学习基础: 'ml-fundamentals',
  推荐系统: 'recommender-systems',
  深度学习: 'deep-learning',
  机器学习系统: 'ml-systems',
  计算机视觉: 'computer-vision',
  'ai系统设计': 'ai-system-design',
};

const COMPANY_NAME_BY_SLUG = new Map<string, string>(
  Object.entries(COMPANY_SLUG_MAP).map(([name, slug]) => [slug, name]),
);

const CATEGORY_NAME_BY_SLUG = new Map<string, string>(
  Object.entries(CATEGORY_SLUG_MAP).map(([name, slug]) => [slug, name]),
);

function normalizeCompanyRouteName(name: string): string {
  return name.replace(TRAILING_COMPANY_COUNT_RE, '').trim();
}

function toAsciiSlug(name: string, prefix: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii;

  const hex = Buffer.from(name, 'utf8').toString('hex').slice(0, 16);
  return `${prefix}-${hex}`;
}

function splitSuffix(path: string): { pathname: string; suffix: string } {
  const match = path.match(/^([^?#]*)(.*)$/);
  return {
    pathname: match?.[1] ?? path,
    suffix: match?.[2] ?? '',
  };
}

function normalizeRoutePath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const { pathname, suffix } = splitSuffix(normalized);
  if (pathname === '/') return `/${suffix}`;
  if (pathname.endsWith('/')) return `${pathname}${suffix}`;

  const lastSegment = pathname.split('/').pop() ?? '';
  if (lastSegment.includes('.')) return `${pathname}${suffix}`;

  return `${pathname}/${suffix}`;
}

export function withBaseFrom(base: string, path: string): string {
  const normalizedBase = base === '/' ? '' : base.replace(/\/$/, '');
  return `${normalizedBase}${normalizeRoutePath(path)}`;
}

export function withBase(path: string): string {
  return withBaseFrom(import.meta.env.BASE_URL, path);
}

export function toCompanySlug(name: string): string {
  const normalized = normalizeCompanyRouteName(name);
  const known = COMPANY_SLUG_MAP[normalized];
  if (known) return known;
  return toAsciiSlug(normalized, 'company');
}

export function fromCompanySlug(slug: string): string {
  return COMPANY_NAME_BY_SLUG.get(slug) ?? decodeURIComponent(slug);
}

export function toCategorySlug(key: string): string {
  const normalized = key.trim();
  const known = CATEGORY_SLUG_MAP[normalized];
  if (known) return known;
  return toAsciiSlug(normalized, 'category');
}

export function fromCategorySlug(slug: string): string {
  return CATEGORY_NAME_BY_SLUG.get(slug) ?? decodeURIComponent(slug);
}

export function toQuestionSlug(id: string): string {
  return encodeURIComponent(id);
}

export function fromQuestionSlug(slug: string): string {
  return decodeURIComponent(slug);
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

**File**: `docs/02-tech-stack/18-context-engineering-guide.md` (modified, +2/-38)
```diff
@@ -37,7 +37,8 @@ topic:
 **问题的本质不在于模型的智能,而在于它从根本上是断开连接的。**
 
 这种隔离是其核心架构限制的直接结果:**上下文窗口**。上下文窗口是模型的活动工作内存——保存当前任务指令和信息的有限空间。每个字、数字、标点符号都会消耗这个窗口中的空间。就像白板一样,一旦满了,旧信息就会被擦除以为新指令腾出空间,重要细节可能会丢失。
-![](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/df7e1dd2d6fb4d12557ee907c2eec8075b638d925435d224a38843c688ba396f.jpg)
+
+![上下文工程系统架构](../../figures/context-engineering-system.png)
 
 这个流程图展示了**智能 Agent 系统的工作流程**，包含用户交互、记忆管理、Agent 决策、工具调用等环节，步骤如下：
 
@@ -81,7 +82,6 @@ topic:
 **定义**: 编排如何以及何时使用信息的决策系统。
 
 
-![](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/c852f67e804d920084f34926939263c396b4cfd3be28be895ae1fefc4de7775e.jpg)
 #### 什么是Agent?
 
 在大语言模型的上下文中,AI Agent是一个能够:
@@ -91,20 +91,17 @@ topic:
 3. **自适应使用工具**: 从可用工具中选择并以未明确编程的方式组合它们
 4. **基于结果修改方法**: 当一种策略不起作用时,可以尝试不同的方法
 
-![](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/51fc62d5607c390ad49ad16c1bda6cb23827ca873f78e1e25becc92d79389d45.jpg)
 #### Agent架构类型
 
 **单Agent架构**:
 - 尝试自己处理所有任务
 - 适用于中等复杂度的工作流
 
-![单Agent架构](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/e88a4ddf4cf3e2635b738e63b411d19c49427fc79023e04fd6aeff076a6bbef7.jpg)
 
 **多Agent架构**:
 - 在专门的Agent之间分配工作
 - 允许复杂的工作流但引入协调挑战
 
-![多Agent架构](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/e527950b67920c530e603c4aff520750ef8a50d1389e2d35639ed915906732d2.jpg)
 
 #### 上下文窗口的挑战
 
@@ -114,28 +111,23 @@ LLM具有有限的信息容量,因为上下文窗口一次只能容纳这么多
 - 哪些应该外部存储并在需要时检索
 - 哪些可以总结或压缩以节省空间
 - 为推理和规划保留多少空间
-![](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/8ebbf01083ef17c574545dde8a3b84828909a736816c5f09543f263e42d2145f.jpg)
 #### 常见的上下文错误类型
 
 **上下文污染(Context Poisoning)**:
 - 错误或幻觉信息进入上下文
 - 因为Agent重用和构建该上下文,这些错误会持续并复合
-![](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/433b21a62cea8ffe30c2e93024aabd73306a43f40051ab7f925030a2d6a81566.jpg)
 
 **上下文干扰(Context Distraction)**:
 - Agent被过多的过去信息(历史、工具输出、摘要)负担
 - 过度依赖重复过去的行为而不是新鲜推理
-- ![](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/9bca936d5709ad019bea07c02c4c273bdab476eb26584348df6bee708836f594.jpg)
 
 **上下文混乱(Context Confusion)**:
 - 不相关的工具或文档挤满上下文
 - 分散模型注意力并导致使用错误的工具或指令
-![](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/44e16e8cfd49e763b2f147f7715d91496bc6a167b317d4ddb96e590d817a6b61.jpg)
 
 **上下文冲突(Context Clash)**:
 - 上下文中的矛盾信息误导Agent
 - 使其陷入冲突假设之间
-![](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/44e16e8cfd49e763b2f147f7715d91496bc6a167b317d4ddb96e590d817a6b61.jpg)
 #### Agent的核心策略和任务
 
 Agent能够有效编排上下文系统,因为它们能够以动态方式进行推理和决策:
@@ -148,7 +140,6 @@ Agent能够有效编排上下文系统,因为它们能够以动态方式进行
 6. **动态工具选择**: 只过滤和加载与任务相关的工具
 7. **多源综合**: 组合来自多个源的信息,解决冲突并产生连贯的答案
 
-![不同类型的Agent在上下文工程系统中的功能](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/085e32cc2ebf373a77de31e2fef9c232f3f8516311c28a3c2f6ec1098ee791d3.jpg)
 1. **监督者统筹**：
     
     - 用户请求先到监督者层的`Planning`模块，规划任务后，通过`Route to Specialized`分配给专业 Agent。
@@ -193,7 +184,6 @@ Agent能够有效编排上下文系统,因为它们能够以动态方式进行
 
 将原始用户查询转换为更有效的检索版本。
 
-![查询重写流程](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/d5d8f53972aacf6e7573915509c85b6d58b982f7b5e9680baca60d20034e0c5a.jpg)
 
 **工作原理**:
 - **重构不清楚的问题**: 将模糊或形式不佳的用户输入转换为精确、信息密集的术语
@@ -204,7 +194,6 @@ Agent能够有效编排上下文系统,因为它们能够以动态方式进行
 
 从单个用户输入生成多个相关查询来增强检索。
 
-![查询扩展流程](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/e9613e9d19173cae56f6e710dfa0e951564c88817865685253b15afddaea806a.jpg)
 
 **需要注意的挑战**:
 - **查询漂移**: 扩展的查询可能偏离用户的原始意图
@@ -215,7 +204,6 @@ Agent能够有效编排上下文系统,因为它们能够以动态方式进行
 
 将复杂、多方面的问题分解为更简单、集中的子查询。
 
-![查询分解流程](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/ea13dd601826b0bcaf2be617dfd4d1f9dde5657bdbdfaae05859a800604afa01.jpg)
 
 **过程**包括两个主要阶段:
 1. **分解阶段**: LLM分析原始复杂查询并将其分解为更小、集中的子查询
@@ -225,7 +213,6 @@ Agent能够有效编排上下文系统,因为它们能够以动态方式进行
 
 查询Agent是查询增强的最高级形式,使用AI Agent智能处理整个查询处理管道。
 
-![查询Agent架构](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/413441a4f206ef6da7f19f9da5984ec72b08875319ccba4b003dae0449b932a1.jpg)
 这个流程图展示了**智能 Agent 处理用户查询的完整流程**，核心是 “动态分析→精准检索→评估优化→生成反馈” 的闭环逻辑，具体拆解如下：
 
  一、核心流程步骤
@@ -267,7 +254,6 @@ Agent能够有效编排上下文系统,因为它们能够以动态方式进行
 
 LLM的能力取决于它能访问的信息。虽然LLM在海量数据集上训练,但它们缺乏对你特定私有文档和训练完成后创建的任何信息的了解。
 
-![RAG架构](https://cdn-mineru.openxlab.org.cn/result/2025-11-06/670cedc5-9554-4d29-a213-d1c3ec0d969f/83d98474a0cf62bfe3394ed4793af5a693b2c18653859e2b61ce0af005035d4d.jpg)
 
 **挑战**: 原始文档数据集几乎总是太大而无法放入LLM有限的上下文窗口。我们必须找到完美的片段——包含用户查询答案的单个段落或部分。
 
@@ -277,7 +263,6 @@ LLM的能力取决于它能访问的信息。虽然LLM在海量数据集上训
 
 分块是你为检索系统性能做出的最重要决定。
 
-![分块策略矩阵](https://cdn-mineru.openxlab.org.cn/result/202
```

**File**: `docs/05-roadmaps/learning-roadmap-algorithm.md` (modified, +1/-2)
```diff
@@ -295,7 +295,7 @@ topic:
 | ------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
 | 22     | 检索算法基础 (BM25)    | 教程: [BM25 from scratch](https://www.pinecone.io/learn/series/bm25/bm25-pragmatic-guide/)<br>论文: [TF-IDF](https://en.wikipedia.org/wiki/Tf%E2%80%93idf)                                                                                                    | 理解 TF-IDF 和 BM25 的原理，并手动实现                                 |
 | 23     | DPR 与密集检索        | 论文: [DPR](https://arxiv.org/abs/2004.04906)<br>教程: [Sentence Transformers](https://www.sbert.net/)<br>论文: [ColBERT](https://arxiv.org/abs/2004.12832)                                                                                                     | 掌握双编码器架构，并使用 Sentence Transformers 训练一个模型                  |
-| 24     | Reranker 与混合检索   | 教程: [LlamaIndex Reranking](https://docs.llamaindex.ai/en/stable/examples/node_postprocessor/CohereRerank.html)<br>论文: [Modular RAG](https://arxiv.org/pdf/2407.21059)<br>技术: [RAG Techniques](https://github.com/NirDiamant/RAG_Techniques)               | 理解 Reranker 的作用，并实现一个 BM25 + Embedding 的混合检索流程             |
+| 24     | Reranker 与混合检索   | 教程: [LlamaIndex Cohere Rerank](https://developers.llamaindex.ai/python/examples/node_postprocessor/coherererank/)<br>论文: [Modular RAG](https://arxiv.org/pdf/2407.21059)<br>技术: [RAG Techniques](https://github.com/NirDiamant/RAG_Techniques)               | 理解 Reranker 的作用，并实现一个 BM25 + Embedding 的混合检索流程             |
 | 25     | GraphRAG 技术解读    | 报告: [Microsoft GraphRAG](https://www.microsoft.com/en-us/research/project/graphrag/)<br>博客: [GraphRAG 详解](https://aka.ms/graphrag-blog)<br>实现: [LightRAG](https://github.com/HKUDS/LightRAG), [nano-GraphRAG](https://github.com/gusye1234/nano-graphrag) | 理解其基于图的社群检测、摘要和问答流程                                        |
 | 26     | RAG 评估体系         | 文档: [RAGAs 评估框架](https://docs.ragas.io/en/latest/index.html)<br>工具: [FlashRAG](https://github.com/RUC-NLPIR/FlashRAG)<br>概览: [Awesome Evaluation](https://github.com/WangRongsheng/awesome-LLM-resources#%E8%AF%84%E4%BC%B0-evaluation)                   | 学习 Faithfulness, Answer Relevancy 等 RAG 评估指标，并用 RAGAs 进行评估 |
 | 27     | Self-RAG 论文精读    | 论文: [Self-RAG](https://arxiv.org/abs/2310.11511)<br>相关: [CRAG](https://arxiv.org/abs/2401.15884), [Adaptive-RAG](https://arxiv.org/abs/2403.14403)                                                                                                        | 学习如何通过 "reflection tokens" 让 LLM 自主决定何时检索、检索什么内容           |
@@ -582,4 +582,3 @@ topic:
 ---
 
 ## 👉 返回主文档：[README.md](../../README.md)
-
```

**File**: `docs/05-roadmaps/learning-roadmap-development.md` (modified, +3/-4)
```diff
@@ -131,7 +131,7 @@ topic:
 | ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
 | 1      | FastAPI 快速入门       | 教程: [FastAPI Official Tutorial](https://fastapi.tiangolo.com/tutorial/)                                                                                                                                                                                                                                                                       | 掌握 FastAPI 基础，能够创建路由、处理请求                |
 | 2      | LangChain 核心概念     | 文档: [LangChain Quickstart](https://python.langchain.com/v0.1/docs/get_started/quickstart/)<br>课程: [吴恩达: LangChain for LLM Application Development](https://learn.deeplearning.ai/langchain/lesson/1/introduction)<br>课程: [Building Systems with the ChatGPT API](https://learn.deeplearning.ai/chatgpt-building-system/lesson/1/introduction) | 理解 LangChain 六大核心模块，熟练使用 LCEL            |
-| 3      | RAG Part 1: 加载与分割  | 文档: [LlamaIndex Loaders](https://docs.llamaindex.ai/en/stable/module_guides/loading/documents_and_nodes/root.html)<br>工具: [Unstructured.io](https://unstructured-io.github.io/unstructured/), [MinerU](https://github.com/opendatalab/MinerU), [Docling](https://github.com/DS4SD/docling)                                                    | 掌握不同格式文档 (PDF, MD) 的加载和文本分块策略            |
+| 3      | RAG Part 1: 加载与分割  | 文档: [LlamaIndex Loaders](https://developers.llamaindex.ai/python/framework/module_guides/loading/documents_and_nodes/)<br>工具: [Unstructured.io](https://unstructured-io.github.io/unstructured/), [MinerU](https://github.com/opendatalab/MinerU), [Docling](https://github.com/DS4SD/docling)                                                    | 掌握不同格式文档 (PDF, MD) 的加载和文本分块策略            |
 | 4      | RAG Part 2: 向量化与存储 | 教程: [FAISS Intro](https://github.com/facebookresearch/faiss/wiki/Getting-started)<br>教程: [Sentence Transformers](https://www.sbert.net/)                                                                                                                                                                                                      | 理解 Embedding 原理，使用 FAISS/Chroma 构建本地向量索引 |
 | 5-6    | 手撕 Naive RAG 系统    | 教程: [RAG from Scratch](https://github.com/langchain-ai/rag-from-scratch)<br>概念: [LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/)<br>教程: [动手学大模型应用开发](https://datawhalechina.github.io/llm-universe/#/)<br>参考: [面向开发者的LLM入门教程](https://github.com/datawhalechina/llm-cookbook)                                                                                                   | 整合 FastAPI + LangChain，完成一个端到端的文档问答 API  |
 | 7      | 周度总结与项目部署          |                                                                                                                                                                                                                                                                                                                                               | 将本周的 RAG 项目用 Docker 打包，并成功运行             |
@@ -162,8 +162,8 @@ topic:
 
 | **天数** | **学习主题**             | **资源链接**                                                                                                                                                                                                                                                                                                  | **目标**                                  |
 | ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
-| 8      | Query Transformation | 教程: [LlamaIndex Query Transforms](https://docs.llamaindex.ai/en/stable/module_guides/querying/query_transforms/root.html)                                                                                                                                                                                 | 实现 HyDE, Multi-Query 等查询改写策略            |
-| 9      | 混合检索与重排 (Rerank)     | 教程: [LlamaIndex Reranking](https://docs.llamaindex.ai/en/stable/examples/node_postprocessor/CohereRerank.html)<br>论文: [Modular RAG](https://arxiv.org/pdf/2407.21059)                                                                                                                                     | 实现 BM25 + Embedding 混合检索，并集成 Reranker   |
+| 8      | Query Transformation | 教程: [LlamaIndex Query Transfor
```

---

### Incident Patch 2: `b0cfda82` (2026-09-04)
**Commit Message**: docs: add 2026 frontier interview guides

**File**: `README.md` (modified, +8/-5)
```diff
@@ -52,12 +52,13 @@
 - [💼 实战项目](#-第四步完成实战项目可写进简历) - 开源优质项目合集+N X Agent项目
 - [📖 技术教程](#-第五步系统学习-agent-技术技术准备) - LangGraph、RAG、上下文工程、监督微调、强化学习
 - [🎯 面试题库](#-第六步面试准备与-offer-冲刺) - 1500+题/面经、系统设计、编程题
+- [🔥 2026 前沿面试专题](./docs/04-interview/23-frontier-interview-guides/) - 自进化 Agent、Agentic RL、AI Infra、Coding Agent、世界模型、图像/语音生成
 
 **🛠️ 快速导航**：
 - ⭐ 阿东作品推荐：[**learn-workbuddy**](https://github.com/adongwanai/learn-workbuddy) - 从 0 搭建 WorkBuddy-style Desktop Agent Harness，clean-room 教学复现 Agent Loop、工具调用、上下文工程、长期记忆、Sidecar、权限审计和真实模型评测
 - [🚀 10分钟快速开始](#-快速开始) | [💬 加入学习社群](#-联系作者--加入社群) | [❓ 常见问题](./FAQ.md)
 - [🧭 新手快速开始](./docs/00-getting-started/README.md) | [🧭 2026 Agent 求职路线](./docs/05-roadmaps/agent-job-ready-roadmap-2026.md) | [🛠️ Agent 项目落地方法](./docs/03-practice/05-ship-agent-project.md) | [🧩 Agent Harness Engineering](./docs/02-tech-stack/27-agent-harness-engineering.md)
-- [🔬 前沿算法完整路线](./docs/05-roadmaps/algorithm-complete-learning-guide.md) | [🤖 具身智能/VLA路线](./docs/05-roadmaps/embodied-ai-vla-learning-guide.md) | [💻 算法+AI手撕题库](./docs/04-interview/22-algorithm-ai-coding-question-bank.md) | [📋 小红书AI算法岗面经](./docs/04-interview/19-xiaohongshu-ai-algorithm-interview-bank.md)
+- [🧭 面试与求职导航](./docs/04-interview/README.md) | [🔥 2026 前沿面试专题](./docs/04-interview/23-frontier-interview-guides/) | [💻 算法+AI手撕题库](./docs/04-interview/22-algorithm-ai-coding-question-bank.md) | [📋 小红书AI算法岗面经](./docs/04-interview/19-xiaohongshu-ai-algorithm-interview-bank.md)
 - [📄 Paper Agent](./projects/01-paper-agent/README.md) | [🧳 Travel Agent](./projects/02-travel-agent/README.md) | [🌐 Web Agent](./projects/03-web-agent/README.md) | [🖼️ Multimodal RAG](./resources/multimodal/README.md)
 
 ---
@@ -1840,6 +1841,8 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
 
 **🏢 真实面经与进阶**
 
+- [x] [🧭 面试与求职总导航](./docs/04-interview/README.md) - 按岗位选择题库，提供 7/21/42 天备考节奏与项目证据清单
+- [x] [🔥 2026 AI 前沿面试专题](./docs/04-interview/23-frontier-interview-guides/) 🆕 - 自进化 Agent、Agentic RL、AI Infra、数据评测、Coding Agent、世界模型、图像/语音生成、项目深挖
 - [x] [📋 大厂真实面经](./docs/04-interview/12-company-interview-cases.md) - 美团/字节/阿里等16个完整案例
 - [x] [🧭 AI Agent 面试备战手册合集](./docs/04-interview/18-agent-interview-playbooks/) - Memory、Skills、Harness、评估、数据合成、源码分析与项目话术
 - [x] [📚 1000篇小红书AI算法岗面经：难度递增整合版](./docs/04-interview/19-xiaohongshu-ai-algorithm-interview-bank.md) 🆕 - 按编程、ML/DL、RAG/Agent、多模态、系统设计等难度递增整理
@@ -1932,17 +1935,17 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
   - [Agent 框架对比](./resources/agent/frameworks.md) - 5个核心框架
   - [Memory 模块](./resources/agent/memory.md) - 4个记忆系统
   - [Tool Use](./resources/tools.md) - 工具调用
-  - [GUI Agent](./resources/agent/gui-agent.md) - 界面操作
+  - [GUI Agent](./resources/agent/README.md) - AppAgent、SeeAct、WebArena 等界面操作资源
   - [核心论文](./resources/agent/papers/README.md) - 必读论文
 
 **📊 RAG 方向**：
 - [x] [RAG 资源总览 📂](./resources/rag/) - RAG 所有资源导航
   - [向量数据库](./resources/rag/vector-db.md) - 5个核心向量库
   - [文档解析](./resources/rag/document-parsing.md) - 5个解析工具
   - [完整项目汇总](./resources/rag/projects.md) - 150+个RAG开源项目 🆕
-  - [Embedding 模型](./resources/rag/embedding.md) - Embedding选型
-  - [Reranker](./resources/rag/reranker.md) - 重排序
-  - [高级RAG](./resources/rag/advanced.md) - GraphRAG、HyDE
+  - [Agentic RAG 论文](./resources/rag/papers/agentic_rag/README.md) - 智能体驱动的检索与研究
+  - [GraphRAG 论文](./resources/rag/papers/graphrag/README.md) - 图增强检索
+  - [Multimodal RAG 论文](./resources/rag/papers/multimodal_rag/README.md) - 文本与视觉联合检索
   - [核心论文](./resources/rag/papers/README.md) - 必读论文
 
 **🛠️ 通用工具**：
```

**File**: `data/resources.json` (modified, +255/-2)
```diff
@@ -1,4 +1,50 @@
 [
+  {
+    "id": "doc-docs-04-interview-23-frontier-interview-guides-readme-md",
+    "title": "2026 AI 前沿面试专题",
+    "description": "从大规模面经与专题笔记中提炼出的高信号复习入口：不追求“题越多越好”，而是帮助你快速建立知识地图、回答框架和项目证据",
+    "category": "面试求职",
+    "tags": [
+      "Agent",
+      "RAG",
+      "评测",
+      "安全",
+      "模型训练"
+    ],
+    "level": "入门",
+    "type": "题库",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/23-frontier-interview-guides/README.md",
+    "sourcePath": "docs/04-interview/23-frontier-interview-guides/README.md",
+    "date": "2026-09-04",
+    "readingMinutes": 3,
+    "wordCount": 1143,
+    "status": "已完善",
+    "featured": true,
+    "external": false
+  },
+  {
+    "id": "doc-docs-04-interview-readme-md",
+    "title": "AI / Agent 面试与求职导航",
+    "description": "不知道先刷哪一份题库？从这里开始。目标不是背完所有答案，而是把知识、项目证据和表达组织成一套能经受追问的系统",
+    "category": "面试求职",
+    "tags": [
+      "Agent",
+      "RAG",
+      "Memory",
+      "评测",
+      "安全"
+    ],
+    "level": "入门",
+    "type": "求职指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/README.md",
+    "sourcePath": "docs/04-interview/README.md",
+    "date": "2026-09-04",
+    "readingMinutes": 5,
+    "wordCount": 1667,
+    "status": "已完善",
+    "featured": true,
+    "external": false
+  },
   {
     "id": "doc-docs-06-research-frontiers-01-ai-research-directions-expanded-md",
     "title": "2026 值得重投入的 AI 研究方向：子方向全展开",
@@ -309,6 +355,213 @@
     "featured": true,
     "external": false
   },
+  {
+    "id": "doc-docs-04-interview-23-frontier-interview-guides-agentic-rl-md",
+    "title": "Agentic RL 面试指南",
+    "description": "Agentic RL 的增量不只是“把 GRPO 用到 Agent 上”，而是把长轨迹、环境交互、稀疏反馈、信用分配和训练基础设施同时纳入设计",
+    "category": "面试求职",
+    "tags": [
+      "Agent",
+      "评测",
+      "安全",
+      "模型训练",
+      "面试"
+    ],
+    "level": "入门",
+    "type": "求职指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/23-frontier-interview-guides/agentic-rl.md",
+    "sourcePath": "docs/04-interview/23-frontier-interview-guides/agentic-rl.md",
+    "date": "2026-09-04",
+    "readingMinutes": 5,
+    "wordCount": 1674,
+    "status": "已完善",
+    "featured": false,
+    "external": false
+  },
+  {
+    "id": "doc-docs-04-interview-23-frontier-interview-guides-ai-infra-md",
+    "title": "AI Infra 面试指南",
+    "description": "AI Infra 面试不是 GPU 名词问答。高质量回答要把硬件限制、算子行为、并行策略、调度、服务指标和成本连成一条因果链",
+    "category": "面试求职",
+    "tags": [
+      "Agent",
+      "Memory",
+      "安全",
+      "面试",
+      "项目实战"
+    ],
+    "level": "入门",
+    "type": "求职指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/23-frontier-interview-guides/ai-infra.md",
+    "sourcePath": "docs/04-interview/23-frontier-interview-guides/ai-infra.md",
+    "date": "2026-09-04",
+    "readingMinutes": 5,
+    "wordCount": 1722,
+    "status": "已完善",
+    "featured": false,
+    "external": false
+  },
+  {
+    "id": "doc-docs-04-interview-23-frontier-interview-guides-coding-agent-md",
+    "title": "Coding Agent 面试指南",
+    "description": "Coding Agent 的难点不是“会生成代码”，而是在陌生仓库中可靠完成定位、修改、验证和交付，并让每一步都可恢复、可审计",
+    "category": "面试求职",
+    "tags": [
+      "Agent",
+      "RAG",
+      "上下文工程",
+      "评测",
+      "安全"
+    ],
+    "level": "入门",
+    "type": "题库",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/23-frontier-interview-guides/coding-agent.md",
+    "sourcePath": "docs/04-interview/23-frontier-interview-guides/coding-agent.md",
+    "date": "2026-09-04",
+    "readingMinutes": 4,
+    "wordCount": 1564,
+    "status": "已完善",
+    "featured": false,
+    "external": false
+  },
+  {
+    "id": "doc-docs-04-interview-23-frontier-interview-guides-world-models-md",
+    "title": "世界模型面试指南",
+    "description": "会生成逼真视频不自动等于拥有可用于决策的世界模型。面试的关键是：状态表示什么、怎样预测动作后果、误差如何影响规划、怎样闭环验证",
+    "category": "面试求职",
+    "tags": [
+      "Agent",
+      "评测",
+      "模型训练",
+      "多模态",
+      "面试"
+    ],
+    "level": "入门",
+    "type": "求职指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/23-frontier-interview-guides/world-models.md",
+    "sourcePath": "docs/04-interview/23-frontier-interview-guides/world-models.md",
+    "date": "2026-09-04",
+    "readingMinutes": 5,
+    "wordCount": 1828,
+    "status": "已完善",
+    "featured": false,
+    "external": false
+  },
+  {
+    "id": "doc-docs-04-interview-23-frontier-interview-guides-image-generation-md",
+    "title": "图像生成面试指南",
+    "description": "图像生成面试通常沿“表示 → 训练目标 → 采样 → 条件控制 → 数据评测 → 推理部署”逐层追问。只会背扩散公式，很难回答真实系统的取舍",
+    "category": "面试求职",
+    "tags": [
+      "RAG",
+      "评测",
+      "安全",
+      "模型训练",
+      "多模态"
+    ],
+    "level": "入门",
+    "type": "求职指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/23-frontier-interview-guides/image-generation.md",
+    "sourcePath": "docs/04-interview/23-f
```

**File**: `docs/04-interview/18-agent-interview-playbooks/README.md` (modified, +2/-0)
```diff
@@ -95,6 +95,8 @@ python docs/04-interview/examples/resume_storytelling_check.py --mode story
 
 ## 📚 Extended Reading（扩展阅读）
 
+- [2026 AI 前沿面试专题](../23-frontier-interview-guides/) - 自进化 Agent、Agentic RL、AI Infra、Coding Agent、世界模型与多模态生成
+- [完整面试与求职导航](../README.md) - 按岗位、时间和能力层级选择复习内容
 - [AI Agent 简历编写指南](../20-resume-guide.md)
 - [AI Agent 项目讲述技巧](../21-storytelling.md)
 - [Agent 系统题](../03-agent-questions.md)
```

**File**: `docs/04-interview/23-frontier-interview-guides/README.md` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+# 2026 AI 前沿面试专题
+
+> 从大规模面经与专题笔记中提炼出的高信号复习入口：不追求“题越多越好”，而是帮助你快速建立知识地图、回答框架和项目证据。
+
+---
+
+## 📌 本节目标
+
+- 覆盖 2026 AI / Agent 岗位最常见的前沿深挖方向。
+- 将超长题库拆成可在 30～60 分钟内完成一次复习的专题。
+- 明确“必答、深挖、设计、证据”四类准备任务。
+- 不给未经核验的问题添加公司标签，不用“标准答案”掩盖条件和取舍。
+
+## 🗺️ 专题地图
+
+| 专题 | 核心问题 | 适合岗位 | 建议用时 |
+|:---|:---|:---|:---:|
+| [自进化 Agent](./self-evolving-agents.md) | 系统如何从经验中更新，又如何防止退化？ | Agent 算法、研究、平台 | 60 分钟 |
+| [Agentic RL](./agentic-rl.md) | 多步环境反馈如何变成可靠的训练信号？ | 强化学习、Post-training、Agent 算法 | 90 分钟 |
+| [AI Infra](./ai-infra.md) | 如何从 GPU 一直优化到在线服务？ | 训练 Infra、推理部署、平台工程 | 90 分钟 |
+| [数据与评测](./data-and-evaluation.md) | 数据、指标、裁判和线上反馈如何闭环？ | 数据、评测、RAG、Agent | 60 分钟 |
+| [Coding Agent](./coding-agent.md) | 怎样让 Agent 在真实仓库里安全地定位、修改和验证？ | Coding Agent、开发工具、Agent Infra | 60 分钟 |
+| [世界模型](./world-models.md) | 什么样的预测模型真的能支持规划与决策？ | 世界模型、具身、自动驾驶、Agent | 60 分钟 |
+| [图像生成](./image-generation.md) | 生成模型如何训练、控制、评测和加速？ | AIGC、视觉算法、多模态 | 60 分钟 |
+| [语音生成](./speech-generation.md) | 如何兼顾音质、韵律、音色、实时性与安全？ | TTS、语音算法、多模态 | 60 分钟 |
+| [项目深挖](./project-deep-dive.md) | 如何证明项目真实、有效，而且关键部分是你做的？ | 所有技术岗位 | 45 分钟 |
+
+## 🎯 按岗位组合
+
+| 岗位 | 核心必读 | 第二专题 | 配套基础 |
+|:---|:---|:---|:---|
+| Agent 算法 | Agentic RL、自进化 Agent | 数据与评测、Coding Agent | [Agent 系统题](../03-agent-questions.md) |
+| Agent 开发 | Coding Agent、数据与评测 | AI Infra、自进化 Agent | [开发岗专项](../06-development-specialized.md) |
+| Post-training / RL | Agentic RL、数据与评测 | 自进化 Agent、Coding Agent | [理论题](../01-theory-questions.md) |
+| AI Infra | AI Infra、Coding Agent | Agentic RL、数据与评测 | [算法手撕题](../22-algorithm-ai-coding-question-bank.md) |
+| 多模态生成 | 图像生成或语音生成 | 世界模型、数据与评测 | [理论题](../01-theory-questions.md) |
+| 具身 / 世界模型 | 世界模型、数据与评测 | Agentic RL、图像生成 | [具身智能路线](../../05-roadmaps/embodied-ai-vla-learning-guide.md) |
+
+## 🧩 每篇专题的使用方法
+
+第一遍只看“核心地图”，尝试不看答案讲出模块之间的关系。第二遍完成高频题，把回答录音并压缩到两分钟。第三遍选一道系统设计题，把状态、数据、指标和失败分支画出来。最后把专题连接到自己的项目；没有证据的知识点只算“听过”。
+
+统一的三档表达：
+
+```text
+30 秒：定义 + 解决的问题 + 一个关键边界
+2 分钟：机制 + 选型 + 指标 + 失败模式
+15 分钟：架构 + 数据 + 实验 + 消融 + 生产风险 + 复盘
+```
+
+### 题目标签
+
+- **必答**：目标岗位应当稳定答出的基础问题。
+- **深挖**：用于区分“看过文章”和“真正做过”。
+- **设计**：要求画架构、定义接口、指标和异常流程。
+- **证据**：必须连接项目、数据、实验或线上结果。
+
+## 🗓️ 14 天专题冲刺
+
+| 天数 | 任务 |
+|:---:|:---|
+| 1～2 | 目标岗位核心专题：知识地图 + 必答题 |
+| 3～4 | 第二专题：知识地图 + 必答题 |
+| 5 | 数据与评测，给两个专题补上验证闭环 |
+| 6 | 项目深挖，生成主项目追问树 |
+| 7 | 第一次模拟面试，记录含糊点和无证据数字 |
+| 8～10 | 深挖题、系统设计题和代码 / 伪代码题 |
+| 11 | 三个失败样本与一次负结果复盘 |
+| 12 | 30 秒、2 分钟、15 分钟三档表达 |
+| 13 | 第二次模拟面试，只追问薄弱点 |
+| 14 | 一页速查表，停止扩题，保证睡眠和状态 |
+
+## 🧪 内容口径
+
+本专题采用以下编辑规则：
+
+1. 从大规模题单中抽取能区分候选人层次的问题，不原样堆叠全部题目。
+2. 对相邻问题去重，把“是什么、为什么、怎么做、怎么验证”组织成追问链。
+3. 只保留通用的公司真题标注原则，不对无法核验的题目臆造来源。
+4. 答题要点强调条件、取舍和验证，不声称存在唯一标准答案。
+5. 不收录简历、账号、缓存、生成中间文件及来源不清晰的大体积附件。
+
+## 📚 配套入口
+
+- [完整面试与求职导航](../README.md)
+- [Agent 面试备战手册合集](../18-agent-interview-playbooks/)
+- [AI Agent 项目讲述技巧](../21-storytelling.md)
+- [2026 Agent 求职路线](../../05-roadmaps/agent-job-ready-roadmap-2026.md)
+- [2026 AI 研究方向](../../06-research-frontiers/01-ai-research-directions-expanded.md)
```

**File**: `docs/04-interview/23-frontier-interview-guides/agentic-rl.md` (added, +189/-0)
```diff
@@ -0,0 +1,189 @@
+# Agentic RL 面试指南
+
+> Agentic RL 的增量不只是“把 GRPO 用到 Agent 上”，而是把长轨迹、环境交互、稀疏反馈、信用分配和训练基础设施同时纳入设计。
+
+---
+
+## 📌 本节目标
+
+- 能把一个 Agent 任务明确写成 MDP / POMDP。
+- 区分 SFT、单轮 RLVR、多轮对话 RL 与 Agentic RL。
+- 讲清轨迹生成、奖励、优势估计、loss mask 和策略更新。
+- 能诊断零奖励、熵坍塌、reward hacking、长尾轨迹和训推不一致。
+
+## 💡 核心概念
+
+对一个工具型 Agent，可以用 POMDP 描述：
+
+```text
+隐藏状态 s_t：环境真实状态、任务进度、外部副作用
+观测 o_t：用户输入、工具返回、被压缩的历史
+动作 a_t：文本、结构化工具调用、终止或请求人工介入
+奖励 r_t：结果正确性、过程质量、成本、安全和业务价值
+策略 π(a_t | h_t)：根据可见历史 h_t 选择下一动作
+```
+
+Agentic RL 的难点来自五件事同时发生：轨迹长、反馈延迟、环境可能随机、动作会改变外部状态、训练数据由当前策略自己产生。
+
+### 与相邻训练范式的边界
+
+| 范式 | 数据来自哪里 | 主要优化对象 | 典型限制 |
+|:---|:---|:---|:---|
+| SFT | 教师或人工轨迹 | 模仿目标动作 | 学不到教师轨迹外的恢复策略，易受分布偏移影响 |
+| 偏好优化 | 成对偏好 | 输出排序倾向 | 环境交互与长程信用通常较弱 |
+| 单轮 RLVR | 单次生成 + 可验证结果 | 最终答案策略 | 环境状态变化和多步决策有限 |
+| Agentic RL | 当前策略与环境交互轨迹 | 多步工具使用与决策 | 环境、verifier 和 rollout 成本高 |
+
+## 🔍 深入理解
+
+### 1. 三种建模粒度
+
+| 粒度 | Action | 优点 | 风险 |
+|:---|:---|:---|:---|
+| Token-level | 单个 token | 与语言模型概率天然对齐 | 信用跨度太长、计算贵 |
+| Turn-level | 一次模型回复或工具调用 | 对应真实决策边界 | 动作空间巨大、整段概率尺度不稳 |
+| Trajectory-level | 完整轨迹 | 结果判定简单 | 把同一奖励广播给所有步骤，信号稀释 |
+
+实践中常见“token 参数化 + trajectory 奖励”的错配。面试时不能只指出问题，还要给缓解手段：过程奖励、turn-level advantage、分支 rollout、反事实对照、失败前缀标注和更好的 critic。
+
+### 2. 训练闭环
+
+```mermaid
+flowchart LR
+    A[任务采样] --> B[策略模型 rollout]
+    B --> C[工具 / 沙箱 / 环境]
+    C --> B
+    B --> D[轨迹规范化与过滤]
+    D --> E[规则 / 测试 / 模型 Verifier]
+    E --> F[Reward 与 Advantage]
+    F --> G[策略更新]
+    G --> H[离线保留集 + 安全集]
+    H -- 通过 --> A
+    H -- 退化 --> I[拒绝发布 / 回滚]
+```
+
+工具观测通常参与上下文 prefill，但不应被当成模型生成 token 计算策略 loss。还要正确处理 padding、system prompt、历史动作、工具返回和截断轨迹的 mask。
+
+### 3. Reward 与 Verifier
+
+奖励可以拆成：
+
+```text
+R = w_result * R_result
+  + w_process * R_process
+  - w_cost * Cost
+  - w_risk * Risk
+```
+
+但权重越多不代表越好。格式奖励过强可能让模型只学会输出合法 JSON；步数惩罚过强会诱导早停；测试奖励依赖不完整测试时会被 hack。Verifier 自己也必须有准确率、覆盖率、可攻击性和成本评测。
+
+### 4. Rollout 基础设施
+
+长轨迹训练通常由 rollout 而非反向传播成为瓶颈。需要考虑：
+
+- 同步、异步或服务化 rollout。
+- 策略版本与采样轨迹的 staleness。
+- 环境快照、确定性、超时和副作用清理。
+- 长短轨迹混排造成的尾部延迟。
+- Prefix / KV cache 复用与工具等待期间的资源调度。
+- 训练与真实推理的 prompt、tool schema、采样参数和 Harness 一致性。
+
+## 🎯 面试中如何考
+
+### 高频必答
+
+1. **Agentic RL 与普通单轮 RLVR 的核心差别是什么？**
+   - 回答轴：多步状态转移、外部观测、延迟奖励、长程信用和环境副作用。
+
+2. **为什么工具型 Agent 更接近 POMDP？**
+   - 回答轴：环境隐状态、信息不完整、上下文压缩、异步副作用。
+
+3. **为什么把最终奖励广播给全部 token 有问题？**
+   - 回答轴：routine step 增加方差、关键决策信号稀释、长度偏置。
+
+4. **SFT 与 Agentic RL 怎样配合？**
+   - 回答轴：SFT 冷启动格式与基本策略，RL 在 on-policy 状态分布上探索和优化结果。
+
+5. **什么任务不应该上 Agentic RL？**
+   - 回答轴：无可信环境、无可验证结果、基线接近零、规则方案已经足够、风险不可控。
+
+6. **工具返回是否计算 loss？**
+   - 回答轴：作为观测参与条件上下文；策略 loss 只覆盖模型动作 token，并说明具体 mask。
+
+7. **如何防止早停骗奖励？**
+   - 回答轴：环境完成判定、结果 verifier、截断语义、失败惩罚和任务进度信号。
+
+8. **GRPO 搬到多轮 Agent 会先遇到什么问题？**
+   - 回答轴：组内可比性、环境随机性、长度差异、轨迹级优势广播和信号稀释。
+
+### 深挖追问
+
+9. 同一次 rollout 中三个并行 tool call 算一个 action 还是三个？两种建模如何影响信用分配？
+10. 强制 max_steps 截断的轨迹应该记失败、丢弃还是 bootstrap？各自隐含什么语义？
+11. 如何用实验区分“信用分配差”和“探索不足”？
+12. 异步 rollout 中旧策略轨迹太多会怎样？如何量化和限制 staleness？
+13. 过程奖励模型错了，比只有最终奖励更危险吗？
+14. Reward hacking 在 Coding Agent 中有哪些具体形式？
+15. 如何判断该继续做 Harness，还是开始做 RL？
+16. 环境随机性如何破坏 group-relative baseline 的可比性？
+17. 轨迹长度差 10 倍时，loss 聚合怎样避免偏向长样本或短样本？
+18. 换了一套工具 schema 后，训练所得策略为什么可能失效？
+
+### 系统设计题
+
+> 为仓库级 Coding Agent 设计一条 Agentic RL 训练流水线。
+
+至少覆盖：
+
+- 从 issue 与 commit 构造任务，避免时间泄漏和仓库污染。
+- 用容器或虚拟机固定依赖、网络、权限和初始 git 状态。
+- 动作空间：搜索、读文件、编辑、运行测试、结束任务。
+- 结果 verifier、过程信号、成本项和安全项。
+- 并行 rollout、超时、长尾任务与环境重置。
+- 训练 / 验证 / 测试仓库切分，以及隐藏测试防 hacking。
+- 线上真实任务与离线 benchmark 的差异监控。
+
+## 💻 白板 / 伪代码题
+
+```python
+def rollout(task, policy, environment, max_steps):
+    observation = environment.reset(task)
+    trajectory = []
+
+    for step in range(max_steps):
+        action, action_logprobs = policy.act(observation)
+        next_observation, env_info = environment.step(action)
+        trajectory.append({
+            "observation": observation,
+            "action": action,
+            "action_logprobs": action_logprobs,
+            "env_info": env_info,
+        })
+
+        if env_info["done"]:
+            break
+        observation = next_observation
+
+    verdict = verify(task, environment.snapshot(), trajectory)
+    return add_masks_rewards_and_version(trajectory, verdict, policy.version)
+```
+
+面试时主动补上：异常动作、工具超时、不可逆副作用、强制截断、环境重置失败、策略版本和哪些 token 参与 loss。
+
+## ✅ 项目证据与自检
+
+- [ ] 我能写出自己任务的 state、observation、action、transition、reward 和 terminal。
+- [ ] 我有不依赖单一 LLM judge 的结果验证器。
+- [ ] 我能展示成功率之外的步数、成本、安全和最差切片指标。
+- [ ] 我检查过 reward hacking，并能展示一个真实反例。
+- [ ] 我区分了自然终止、失败终止、超时和强制截断。
+- [ ] 我能解释 rollout 吞吐为什么是瓶颈，以及如何优化。
+- [ ] 我有 SFT baseline、无 RL baseline 和至少一个奖励消融。
+
+## 📚 扩展阅读
+
+- [Agent 强化学习完整指南](../../02-tech-stack/21-agent-reinforcement-learning.md)
+- [Post-training 完整指南](../../02-tech-stack/25-post-training-complete-guide.md)
+- [Agent Evaluation Harness](../../02-tech-stack/26-agent-evaluation-harness-guide.md)
+- [数据合成备战手册](../18-agent-interview-playbooks/data-synthesis-playbook.md)
+- [2026 AI 研究方向：Agentic RL](../../06-research-frontier
```

**File**: `docs/04-interview/23-frontier-interview-guides/ai-infra.md` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+# AI Infra 面试指南
+
+> AI Infra 面试不是 GPU 名词问答。高质量回答要把硬件限制、算子行为、并行策略、调度、服务指标和成本连成一条因果链。
+
+---
+
+## 📌 本节目标
+
+- 建立从芯片、算子到训练 / 推理平台的完整分层。
+- 能用带宽、算力、通信、显存和排队解释性能瓶颈。
+- 能为训练并行、推理服务和 Agent Runtime 做选型。
+- 用 Profiling 与实验回答“瓶颈在哪里”，而不是凭经验猜。
+
+## 💡 核心概念
+
+### 六层技术地图
+
+| 层级 | 关键对象 | 高频问题 |
+|:---|:---|:---|
+| 硬件 | GPU / 加速器、HBM、互联、网络 | 算力、带宽、拓扑、精度 |
+| Kernel | CUDA、Triton、融合算子、Attention | occupancy、访存、同步、数值稳定 |
+| Runtime / Compiler | 计算图、编译、内存规划、执行引擎 | graph break、动态 shape、调度 |
+| Distributed | 数据 / 张量 / 流水线 / 序列 / 专家并行 | 通信量、切分边界、负载均衡 |
+| Serving | batching、KV cache、prefill / decode、路由 | TTFT、TPOT、吞吐、尾延迟 |
+| Platform | 调度、容错、可观测性、多租户、成本 | 利用率、SLO、配额、故障域 |
+
+Agent Infra 还要再加一层有状态 Runtime：会话状态、工具执行、沙箱、权限、长任务恢复和 trace / replay。
+
+### 性能诊断的统一框架
+
+先问瓶颈属于哪一类：
+
+```text
+计算受限：算术单元忙，增加带宽收益小
+带宽受限：大量数据搬运，算术强度低
+通信受限：跨卡同步或 all-to-all 占主导
+容量受限：模型、激活或 KV cache 放不下
+调度受限：排队、气泡、长尾和碎片降低利用率
+外部等待：网络、存储、工具或环境响应慢
+```
+
+然后用 profiler、时间线、硬件计数器和受控实验验证。只报 GPU utilization 往往不够：它可能掩盖低效 kernel、频繁小算子或等待间隙。
+
+## 🔍 深入理解
+
+### 1. 训练并行怎样选
+
+| 策略 | 切什么 | 主要收益 | 主要代价 |
+|:---|:---|:---|:---|
+| Data Parallel | batch | 简单、扩展直接 | 参数 / 梯度同步，单卡仍需放下模型 |
+| ZeRO / FSDP | 参数、梯度、优化器状态 | 显著降单卡状态占用 | 通信与参数聚合开销 |
+| Tensor Parallel | 单层张量 | 支撑单层超大模型 | 频繁卡间通信、拓扑敏感 |
+| Pipeline Parallel | 层 | 跨节点扩展 | pipeline bubble、调度复杂 |
+| Sequence / Context Parallel | 序列维 | 支撑长上下文 | Attention 通信与边界处理 |
+| Expert Parallel | MoE 专家 | 扩大参数量 | all-to-all、路由不均和热点 |
+
+选型不能离开模型结构、序列长度、batch、集群拓扑和故障率。面试时最好给一个具体配置，估算显存和通信，再说明组合策略。
+
+### 2. 推理为什么要拆 prefill 和 decode
+
+- **Prefill**一次处理较长输入，矩阵乘规模大，更偏计算密集。
+- **Decode**逐 token 生成，反复读取权重和 KV cache，更容易带宽与调度受限。
+
+常见优化包括 continuous batching、paged KV cache、prefix cache、量化、speculative decoding 和 prefill / decode 分离。每种优化都应回答适用分布：长 prompt 还是短 prompt、吞吐优先还是交互延迟优先、缓存命中如何、质量是否受影响。
+
+核心指标：
+
+- TTFT：从请求进入到首 token。
+- TPOT / ITL：后续 token 间延迟。
+- E2E latency：完整请求耗时。
+- Tokens/s：单请求或集群吞吐。
+- P95 / P99：尾延迟，通常比均值更接近用户体验。
+- Goodput：满足 SLO 的有效吞吐。
+- Cost per successful task：对 Agent 比单纯 token 成本更有意义。
+
+### 3. 容错与可观测性
+
+训练关注 checkpoint、节点失效、网络抖动和长任务恢复；在线服务关注过载保护、熔断、降级、滚动发布和多模型路由；Agent Runtime 还要处理工具副作用、幂等、会话恢复和人工审批。
+
+一条可用的 trace 至少能串起：请求、模型版本、prompt / cache 命中、每次工具调用、重试、token 与成本、错误码、最终业务结果。
+
+## 🎯 面试中如何考
+
+### 高频必答
+
+1. **怎样判断一个算子是 compute-bound 还是 memory-bound？**
+   - 回答轴：算术强度、硬件算力 / 带宽上限、profiler 和对输入规模的敏感性。
+
+2. **为什么算子融合能加速？什么时候反而变慢？**
+   - 回答轴：减少 launch 与中间访存；但寄存器压力、并行度和编译复杂度可能上升。
+
+3. **DDP、FSDP / ZeRO、TP、PP 如何选？**
+   - 回答轴：模型是否单卡可放、通信频率、拓扑、序列与 batch、故障域。
+
+4. **AllReduce 与 All-to-All 分别在哪些场景成为瓶颈？**
+   - 回答轴：梯度同步 / 张量并行 vs MoE 路由，数据量、拓扑和负载均衡。
+
+5. **训练显存由哪些部分组成？**
+   - 回答轴：参数、梯度、优化器状态、激活、临时 buffer、通信与碎片。
+
+6. **为什么 decode 阶段常比 prefill 更难跑满 GPU？**
+   - 回答轴：小批次逐 token、权重 / KV 搬运、动态请求与尾部调度。
+
+7. **Continuous batching 解决什么，又引入什么？**
+   - 回答轴：动态合批提升利用率；调度公平、内存管理和尾延迟更复杂。
+
+8. **量化怎样影响吞吐、显存和质量？**
+   - 回答轴：硬件支持、dequant 开销、异常值、校准数据和任务切片。
+
+9. **KV cache 为什么容易成为容量瓶颈？**
+   - 回答轴：层数、KV heads、head dim、序列、batch、精度与并发的乘积。
+
+10. **GPU utilization 很高是否说明系统高效？**
+    - 回答轴：不一定；需要结合 SM 效率、带宽、kernel 时间、吞吐和 goodput。
+
+### 深挖与设计题
+
+11. 一次训练吞吐突然下降 30%，你按什么顺序排查？
+12. MoE 的某些 expert 持续过载，如何定位并治理？
+13. 如何为长短请求混合的在线服务设计调度器？
+14. Prefix cache 命中率高，但 P99 变差，可能是什么原因？
+15. 如何在成本不增加的前提下提高满足 SLO 的 goodput？
+16. 设计一个支持多租户、配额、抢占和故障恢复的 GPU 平台。
+17. Agent 执行大量外部工具时，GPU 为什么会空等？怎样解耦？
+18. 如何证明一次优化没有以输出质量或稳定性为代价？
+
+## 💻 估算与白板题
+
+### 显存估算模板
+
+```text
+总显存 ≈ 参数 + 梯度 + 优化器状态 + 激活
+       + KV cache / 临时张量 + 通信 buffer + 碎片余量
+```
+
+面试时应说明 dtype、是否分片、是否 activation checkpointing、序列和 micro-batch。结果不必精确到 MB，但每个量的数量级和随配置变化的方向要正确。
+
+### 性能实验模板
+
+1. 固定模型、硬件、输入分布和随机种子。
+2. 先测端到端基线，再用 profiler 定位最大项。
+3. 一次只改一个关键变量。
+4. 同时报吞吐、P50 / P95 / P99、显存、质量和成本。
+5. 至少预热并重复多轮，标注均值、方差与异常点。
+
+## ✅ 项目证据与自检
+
+- [ ] 我能从业务 SLO 倒推 batch、并发、显存和副本数。
+- [ ] 我能画出训练或推理的关键通信路径。
+- [ ] 我有 profiler 证据，不只靠 GPU utilization 下结论。
+- [ ] 我能解释优化前后的输入分布与测试环境。
+- [ ] 我同时报告性能、质量、稳定性和成本。
+- [ ] 我准备了一个优化无效或产生回归的案例。
+
+## 📚 扩展阅读
+
+- [开发岗专项题](../06-development-specialized.md)
+- [算法与 AI 手撕题库](../22-algorithm-ai-coding-question-bank.md)
+- [Agent Harness Engineering](../../02-tech-stack/27-agent-harness-engineering.md)
+- [生产级 Agent 设计](../../03-practice/05-ship-agent-project.md)
```

**File**: `docs/04-interview/23-frontier-interview-guides/coding-agent.md` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+# Coding Agent 面试指南
+
+> Coding Agent 的难点不是“会生成代码”，而是在陌生仓库中可靠完成定位、修改、验证和交付，并让每一步都可恢复、可审计。
+
+---
+
+## 📌 本节目标
+
+- 区分代码补全、代码问答、单文件编辑与仓库级任务。
+- 能画出 Coding Agent 的上下文、工具、环境和验证闭环。
+- 解释为什么测试通过不等于任务正确，patch 很大也不等于能力强。
+- 能讨论 benchmark、Agentic RL、安全、成本和线上反馈。
+
+## 💡 核心概念
+
+### 任务谱系
+
+```text
+代码补全
+  → 代码解释 / 仓库问答
+  → 单点修复 / 测试生成 / Review
+  → 跨文件仓库级 Issue
+  → 终端 / DevOps / 环境操作
+  → 多仓库、长周期软件工程任务
+```
+
+任务越向右，越依赖环境、状态管理、工具设计、权限控制和长程恢复；模型单轮代码能力所占比例反而下降。
+
+### 最小执行循环
+
+```text
+理解任务 → 建立仓库地图 → 定位候选代码 → 制定修改计划
+        → 小步编辑 → 静态检查 / 测试 → 失败归因
+        → 继续修改或回滚 → 汇总证据与交付
+```
+
+工具至少包含：目录 / 符号搜索、精确读文件、patch 编辑、命令执行、测试、diff / git 状态和任务结束。工具输出需要分页、截断和错误类型，不能把几十万行日志原样塞回上下文。
+
+## 🔍 深入理解
+
+### 1. 上下文工程
+
+仓库级任务的上下文不应等于“把整个仓库塞给模型”。常见分层：
+
+- 固定层：任务、系统约束、工具 schema、仓库规则。
+- 地图层：目录、模块职责、依赖与关键符号。
+- 工作集：当前假设所需的文件片段、调用链和测试。
+- 状态层：计划、已完成步骤、失败尝试和未决问题。
+- 证据层：命令结果、diff、测试与静态检查摘要。
+
+压缩时要保留决策、失败原因、文件位置和未完成约束；只做自然语言摘要容易丢掉精确符号与错误信息。
+
+### 2. 编辑与验证
+
+| 环节 | 关键设计 | 常见失败 |
+|:---|:---|:---|
+| 定位 | 搜索、符号图、测试关联、调用链 | 找到相似代码却不是执行路径 |
+| 计划 | 明确变更面、风险、验证方式 | 先写代码再猜需求 |
+| 编辑 | 最小 patch、保持风格、避免无关改动 | 重写过多、覆盖用户修改 |
+| 验证 | 相关测试 → 扩展测试 → 静态检查 | 只跑一条 happy path |
+| 交付 | diff 审查、结果与残余风险 | 声称完成却没有证据 |
+
+测试不是完美 verifier：隐藏需求可能未覆盖，测试也可能本身错误。应组合静态分析、类型检查、现有测试、新增回归测试、差异审查和任务特定不变量。
+
+### 3. 环境与安全
+
+- 每个任务使用可重置的容器或隔离工作区。
+- 网络、密钥、文件写入和命令按风险分级。
+- 对删除、发布、付费、外部消息等不可逆动作请求确认。
+- 命令必须有超时、输出上限和资源配额。
+- 记录基础 commit、依赖、环境变量白名单和模型 / Harness 版本。
+
+### 4. 评测
+
+除了 pass rate，还要看：
+
+- 定位准确率与首次有效编辑前的成本。
+- 测试通过率、隐藏测试通过率和回归率。
+- Patch 大小、无关文件修改率和代码可维护性。
+- 平均 / P95 步数、token、墙钟时间和工具失败率。
+- 安全违规、用户纠正次数和人工接管率。
+
+公开 benchmark 可用于可比性，但真实线上任务更混乱：需求含糊、环境漂移、权限受限、反馈延迟、仓库存在未提交改动。面试时应主动说明这种外部有效性差距。
+
+## 🎯 面试中如何考
+
+### 高频必答
+
+1. **Coding Agent 与代码补全的本质区别是什么？**
+   - 回答轴：多步环境交互、仓库状态、工具执行、验证与副作用。
+
+2. **如何让 Agent 快速理解陌生仓库？**
+   - 回答轴：仓库规则、目录地图、符号 / 调用图、测试映射和按需读取。
+
+3. **为什么不能一次性把整个仓库放进上下文？**
+   - 回答轴：成本、注意力稀释、更新失真、精确检索和状态管理。
+
+4. **怎样设计代码编辑工具？**
+   - 回答轴：结构化 patch、上下文校验、冲突检测、最小变更和可逆性。
+
+5. **测试全过就能结束吗？**
+   - 回答轴：测试覆盖、隐藏约束、过拟合测试、静态检查与 diff 审计。
+
+6. **怎样处理长命令输出？**
+   - 回答轴：超时、分页、截断、错误摘要、artifact 保存和按需读取。
+
+7. **Coding Agent 最容易出现哪些 reward hacking？**
+   - 回答轴：改测试、绕过断言、硬编码答案、删除失败路径、伪造完成。
+
+8. **如何避免 Agent 覆盖用户未提交改动？**
+   - 回答轴：初始状态检查、diff 隔离、工作树所有权、冲突检测和最小 patch。
+
+### 深挖与设计题
+
+9. 设计一个支持百万行 monorepo 的上下文检索与缓存系统。
+10. Agent 连续三次尝试都失败，应该重试、换策略、回滚还是求助？
+11. 怎样判断“定位错了”还是“实现错了”？
+12. 多 Agent coding 中 planner、implementer、reviewer 怎样共享状态又避免上下文污染？
+13. 如何从 GitHub issue 和 commit 构建无泄漏训练任务？
+14. 隐藏测试不完整时，怎样设计更稳健的 verifier？
+15. 前端视觉任务无法只用单元测试验证，怎样构建闭环？
+16. 如何将真实用户接受 / 拒绝 patch 的信号用于持续改进？
+17. 如何比较强模型 + 简单 Harness 与弱模型 + 强 Harness？
+18. 怎样让任务跨会话恢复，同时不把过期假设带回来？
+
+## 💻 系统设计模板
+
+```mermaid
+flowchart LR
+    U[Issue / 用户任务] --> O[Orchestrator]
+    O --> C[Context Builder]
+    C --> R[Repo Index / Search]
+    O --> T[Tool Gateway]
+    T --> S[隔离 Sandbox]
+    S --> V[Test / Lint / Typecheck]
+    V --> O
+    O --> M[Task State / Trace]
+    O --> G{完成门禁}
+    G -- 通过 --> D[Diff + 证据 + 风险]
+    G -- 不通过 --> O
+```
+
+面试时补充四条异常流：工具超时、测试本身失败、上下文超限、用户工作区有冲突。
+
+## ✅ 项目证据与自检
+
+- [ ] 我能给出 20～50 个真实任务，而不是只演示一个 happy path。
+- [ ] 环境能从固定 commit 自动创建并可靠重置。
+- [ ] Agent 的每次读、写、命令和测试都有 trace。
+- [ ] 我报告任务成功、回归、安全、成本和尾延迟。
+- [ ] 我保留失败 patch，并做过错误分类。
+- [ ] 我能展示最小 patch 与“大改一遍”之间的对照。
+- [ ] 我明确哪些动作自动执行，哪些必须确认。
+
+## 📚 扩展阅读
+
+- [Claude Code 源码分析手册](../18-agent-interview-playbooks/claude-code-source-playbook.md)
+- [Agent Harness 手册](../18-agent-interview-playbooks/agent-harness-playbook.md)
+- [Agent Harness Engineering](../../02-tech-stack/27-agent-harness-engineering.md)
+- [构建自己的 Agent Framework](../../02-tech-stack/22-build-your-agent-framework.md)
```

**File**: `docs/04-interview/23-frontier-interview-guides/data-and-evaluation.md` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+# 数据与评测面试指南
+
+> 数据决定系统见过什么，评测决定团队相信什么。两者必须一起设计，否则很容易优化一个并不代表真实目标的分数。
+
+---
+
+## 📌 本节目标
+
+- 从业务目标推导能力树、数据需求和指标体系。
+- 讲清采集、准入、清洗、去重、标注、切分和版本治理。
+- 设计覆盖模型、RAG、Agent、业务与安全的分层评测。
+- 识别数据泄漏、评测污染、LLM judge 偏差和 Goodhart 风险。
+
+## 💡 核心概念
+
+### 数据闭环
+
+```text
+业务目标 → 能力 / 风险树 → 数据规格 → 采集与准入
+        → 清洗标注 → 切分与版本 → 训练 / 检索 / 评测
+        → 线上观测 → 失败归因 → 定向补数
+```
+
+数据质量不是一个总分。至少要分开看：正确性、完整性、一致性、时效性、多样性、难度、代表性、合规性和可追溯性。
+
+### 评测分层
+
+| 层级 | 回答什么 | 例子 |
+|:---|:---|:---|
+| 组件 | 单个模块是否正常 | 检索 Recall@k、工具参数合法率 |
+| 轨迹 | 过程是否合理 | 无效步数、重试率、关键步骤覆盖 |
+| 任务 | 最终是否完成 | exact match、测试通过率、任务成功率 |
+| 系统 | 是否稳定高效 | 延迟、成本、可用性、恢复率 |
+| 业务 | 是否创造价值 | 解决率、转化、人工节省、满意度 |
+| 安全 | 是否可控 | 越权率、注入成功率、不可逆错误 |
+
+单一“回答正确率”无法覆盖 Agent：它可能答案看似正确，却调用了错误工具、泄漏隐私、花费过高或产生了不可逆副作用。
+
+## 🔍 深入理解
+
+### 1. 从能力树而不是现成数据出发
+
+先定义真实任务和失败成本，再拆成能力 / 风险树，最后决定需要哪些数据。直接从“手里有什么数据”出发，容易得到规模很大但目标错位的数据集。
+
+推荐为每条样本保存：来源、许可 / 使用边界、时间、任务类型、难度、质量分、标注者、争议、版本、去重簇、PII 状态和切分归属。
+
+### 2. 切分与污染
+
+- **随机切分**可能把同模板、同仓库或近重复样本分到训练和测试。
+- **实体切分**按用户、文档、仓库或公司隔离，更能测试泛化。
+- **时间切分**用未来任务评估部署后的真实变化。
+- **能力切分**保留未见组合，测试组合泛化。
+
+污染检查不能只做字符串去重。还应考虑规范化、近重复、语义相似、模板复用、答案泄漏和基准题在公开语料中的曝光。
+
+### 3. LLM-as-a-Judge 怎样用
+
+适合：开放文本质量、风格、多维 rubric、需要语义判断的任务。
+
+不应单独承担：可由代码或数据库精确验证的结果、高风险决策、存在强位置 / 长度 / 自偏好的比较。
+
+基本防护：
+
+- 先写清 rubric 与不可接受条件。
+- 使用盲评，隐藏模型与方案身份。
+- 随机交换候选顺序，检查 position bias。
+- 与人工金标校准，报告一致性而不是只报 judge 分数。
+- 保存 judge prompt、模型版本、采样参数和原始理由。
+- 对关键结论使用规则、执行结果或多裁判交叉验证。
+
+### 4. 从离线到线上
+
+```text
+静态集 → Trace replay → Shadow traffic → 小流量 canary → A/B → 全量监控
+```
+
+每一步都应有准入 / 退出标准。离线分数提升不保证线上价值：输入分布、用户行为、缓存、工具故障和反馈延迟都会改变结果。
+
+## 🎯 面试中如何考
+
+### 高频必答
+
+1. **如何从业务目标设计数据集？**
+   - 回答轴：目标与损失 → 能力 / 风险树 → 样本规格 → 覆盖矩阵 → 验收。
+
+2. **高质量数据等于人工精标数据吗？**
+   - 回答轴：任务相关、正确、多样、可追踪；人工、规则、模型和执行反馈可组合。
+
+3. **如何做去重和防污染？**
+   - 回答轴：规范化、哈希、近重复、语义簇、实体 / 时间隔离、答案泄漏审计。
+
+4. **训练 / 验证 / 测试怎样切？**
+   - 回答轴：随机切分的风险，按实体、时间、模板和能力切分。
+
+5. **Agent 应该评什么？**
+   - 回答轴：组件、过程、结果、系统、业务、安全六层。
+
+6. **LLM judge 有哪些偏差？**
+   - 回答轴：位置、长度、措辞、自偏好、知识盲区、版本漂移和 prompt 敏感。
+
+7. **如何评估 RAG？**
+   - 回答轴：检索覆盖与排序、上下文相关性、答案正确性、忠实性、引用、延迟和成本。
+
+8. **离线提升、线上下降，先查什么？**
+   - 回答轴：分布与口径、系统变更、缓存 / 路由、交互反馈、切片和 guardrail。
+
+### 深挖与设计题
+
+9. 两个标注者一致率很低，说明 rubric 差还是任务本身模糊？怎样区分？
+10. 合成数据比例越高越好吗？如何检测模式塌缩和模型自嗨？
+11. 怎样构造 hard negative，避免只提高简单样本分数？
+12. Benchmark 已被广泛训练，继续使用它还有什么价值？
+13. 线上反馈只有点赞 / 点踩，怎样处理选择偏差和延迟反馈？
+14. 如何对一次 prompt 更新做回归测试与故障定位？
+15. 多轮 Agent 的失败该归因给模型、工具、检索、Harness 还是环境？
+16. 指标涨了但用户价值不变，如何检查代理指标是否失真？
+17. 如何设计一个会随着系统迭代而不过时的评测集？
+18. 高风险任务中，平均分和最差切片哪个更重要？为什么？
+
+## 🧪 一个可复用的 Eval Spec
+
+```markdown
+## 目标与决策
+- 本评测支持什么发布 / 选型决策？
+
+## 任务与用户分布
+- 任务类型、难度、语言、来源、时间范围
+
+## 能力与风险矩阵
+- 正常能力、边界条件、对抗与安全切片
+
+## 指标
+- 主指标、护栏指标、成本指标、统计口径
+
+## 裁判
+- 规则 / 执行 / 人工 / LLM judge，以及校准结果
+
+## 数据治理
+- 许可、PII、去重、污染、版本和 lineage
+
+## 通过标准
+- 总体、关键切片、显著性、最大可接受回归
+
+## 失败分析
+- 分类体系、样本展示、责任模块和修复优先级
+```
+
+## ✅ 项目证据与自检
+
+- [ ] 我的数据来源、许可、PII 和版本可追踪。
+- [ ] 测试集与训练集按真实泄漏边界隔离。
+- [ ] 指标直接支持一个产品或发布决策。
+- [ ] 我报告关键切片和最差组，不只报告均值。
+- [ ] LLM judge 与人工或可执行金标做过校准。
+- [ ] 我能展示至少 10 个失败样本及分类统计。
+- [ ] 评测能固定模型、prompt、工具和环境版本并复现。
+
+## 📚 扩展阅读
+
+- [Agent 评测备战手册](../18-agent-interview-playbooks/agent-evaluation-playbook.md)
+- [数据合成备战手册](../18-agent-interview-playbooks/data-synthesis-playbook.md)
+- [模型评估题库](../13-model-evaluation.md)
+- [Agent Evaluation Harness 完整指南](../../02-tech-stack/26-agent-evaluation-harness-guide.md)
+- [多模态评测清单](../../../resources/multimodal/evaluation-checklist.md)
```

---

### Incident Patch 3: `d4fe53f4` (2026-08-25)
**Commit Message**: docs: refresh AgentGuide positioning

**File**: `README.md` (modified, +18/-14)
```diff
@@ -66,25 +66,29 @@
 
 > **3 分钟了解为什么你需要 AgentGuide**
 
-### 😰 你是否正在经历这些痛点？
+### 🧭 你可能正卡在这些地方
 
-- ❌ **学了一堆 LLM API 调用，但不知道 Agent 和普通对话有什么区别**
-- ❌ **看了无数篇 LangChain 文档，却依然不知道从哪里开始**
-- ❌ **做了一些 Demo 项目，但简历上写不出亮点，面试讲不清楚**
-- ❌ **想转 AI Agent 方向，但不知道算法岗和开发岗应该准备什么**
-- ❌ **网上资料又多又杂，缺少一条清晰的学习路线**
+- **会调用模型、也接过工具，但 Agent 一跑长任务就早停、循环、丢状态，出了问题不知道怎么定位**
+- **LangGraph、OpenAI Agents SDK、MCP、Skills、Multi-Agent 概念很多，却缺少一张完整的系统架构图**
+- **Context、Memory、Tools、权限、Sandbox、Trace 混在一起，Demo 能跑，离可靠系统还很远**
+- **RAG 做过基础问答，但复杂文档、多模态、引用溯源、评测集与线上观测没有形成闭环**
+- **项目只有功能截图，没有基线、指标、失败分析和工程取舍，简历写不实，面试经不起追问**
+- **想进入 Agent 方向，却不清楚开发岗、算法岗、Agentic RL 和前沿研究分别需要什么能力与作品**
+- **论文、框架和开源项目更新太快，不知道哪些值得学、先做什么、如何沉淀成可验证成果**
 
 **`AgentGuide` 是什么？**
 
-> **AI Agent 开发学习指南 | 转行大模型 | LangGraph 实战 | 高级RAG  | 大模型面试**
+> **AI Agent 工程、研究与求职的开源知识库**
 
-一份系统化、求职导向的 AI Agent 学习与面试指南，涵盖：
-- **Agent 工程**：Agent Loop、LangGraph / OpenAI Agents SDK、MCP、Skills、权限与状态管理
-- **Context Engineering**：上下文分层、Memory、Tool Loadout、长任务压缩、成本与缓存优化
-- **RAG / Multimodal RAG**：文档解析、Embedding、Rerank、GraphRAG、Agentic RAG、视觉文档检索
-- **Eval / Observability / Safety**：Agent 评测集、trace、LLM-as-judge、红队、安全边界与 human-in-the-loop
-- **Post-training / Agent RL**：SFT、偏好优化、GRPO/DPO、工具调用数据合成、轨迹数据训练
-- **实战与求职**：Paper Agent、Travel Agent、Web Agent、项目复盘、简历表达与面试题库
+AgentGuide 围绕 **“做得出、跑得稳、测得准、讲得清”** 组织内容，不绑定单一框架，也不止于资源收藏：
+
+- **Agent 系统与 Harness**：Agent Loop、Workflow / Agent / Multi-Agent 边界、状态、调度、权限与运行时
+- **Context Engineering 与 Memory**：上下文分层、检索、压缩、长期记忆、Prompt Cache 与成本优化
+- **Tools 与协议生态**：Tool Schema、MCP、Skills、A2A / ACP、Browser / Computer Use 与 Sandbox
+- **RAG 与知识系统**：文档解析、Hybrid Retrieval、Rerank、GraphRAG、Agentic RAG、Multimodal RAG 与引用溯源
+- **Eval、Observability 与 Safety**：评测集、Trace / Replay、LLM-as-a-Judge、红队、HITL 与生产可靠性
+- **Post-training 与 Agentic RL**：SFT、DPO / GRPO、轨迹数据、Reward / Verifier、长程信用分配与环境构建
+- **项目、研究与求职**：可复现实战、开源项目、前沿论文、实验设计、简历表达、系统设计与面试题库
 
 ### 🗺️ AgentGuide 在 LLM 生态中的定位
 
```

---

### Incident Patch 4: `734dbdb4` (2026-08-25)
**Commit Message**: docs: modernize AgentGuide learning outcomes

**File**: `README.md` (modified, +9/-8)
```diff
@@ -231,15 +231,16 @@
 
 ### 🎁 学完 AgentGuide，你能获得什么？
 
-> **从迷茫到清晰，从理论到Offer，一站式成长路径**
+> **从“会调用模型”到“能设计、实现、评测并讲清一个可靠的 Agent 系统”**
 ```
-✅ 【概念清晰】深刻理解：Agent 和普通 LLM 调用的本质区别
-✅ 【技能掌握】熟练使用：CamelAI、LangGraph、向量数据库等核心工具  
-✅ 【动手能力】独立开发：RAG Agent、Multi-Agent、Web Agent 系统
-✅ 【简历亮点】2-3 个可以写进简历、面试能讲清楚的项目
-✅ 【面试自信】掌握 Agent 方向的高频面试题和标准答案
-✅ 【职业规划】明确算法岗和开发岗的差异，找到适合自己的方向
-✅ 【人脉资源】加入 AI Agent 学习社群，结识同行，互相成长
+✅ 【架构认知】分清 Chatbot、Workflow、Agent 与 Multi-Agent，理解 Agent Loop 和 Harness
+✅ 【工程能力】掌握 LangGraph / OpenAI Agents SDK、Context Engineering、Memory、Tools、MCP 与 Skills
+✅ 【RAG 能力】能设计 Hybrid Retrieval、Rerank、引用溯源、GraphRAG、Agentic RAG 与 Multimodal RAG
+✅ 【可靠性】会构建 Eval Set、Trace / Replay、LLM-as-a-Judge、Sandbox、HITL、权限和成本控制
+✅ 【训练认知】理解 SFT、DPO / GRPO、工具调用与轨迹数据合成、Reward / Verifier 的基本方法
+✅ 【项目交付】完成 2-3 个可运行、可评测、可复现的项目，并写清架构、指标、取舍与失败分析
+✅ 【面试表达】能围绕原理、系统设计、实验结果和工程权衡回答追问，而不是背“标准答案”
+✅ 【求职路径】明确算法岗与开发岗能力差异，用项目、开源贡献和技术内容构建作品集
 ```
 
 ---
```

---

### Incident Patch 5: `d86ee2b6` (2026-08-04)
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
+            urls.append((f"{SITE_ROOT}/interview/questions/{quote(question['id'], safe='')}/", questions_date, "monthly", "0.6"))
 
     category_slugs = {
         "项目与行为面试": "project-behavior",
@@ -348,7 +380,7 @@ def sitemap_urls():
     if categories_path.exists():
         for category in json.loads(read_text(categories_path)):
             slug = category_slugs.get(category["key"], quote(category["key"], safe=""))
-            urls.append((f"{SITE_ROOT}/interview/categories/{slug}/", today, "weekly", "0.7"))
+            urls.append((f"{SITE_ROOT}/interview/categories/{slug}/", categories_date, "weekly", "0.7"))
 
     company_slugs = {
         "字节跳动": "bytedance", "美团": "meituan", "腾讯": "tencent", "百度": "baidu",
@@ -363,7 +395,7 @@ def sitemap_urls():
     if companies_path.exists():
         for company in json.loads(read_text(companies_path)):
             slug = company_slugs.get(company["name"], quote(company["name"], safe=""))
-            urls.append((f"{SITE_ROOT}/interview/companies/{sl
```

---

### Incident Patch 6: `1f76c4f7` (2026-08-04)
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

**File**: `resources/agent/papers/agent_rl/README.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Agent RL Papers
+
+强化学习用于智能体决策的论文与开源项目。
+
+## 目录
+
+- [Agent➕RL 开源项目汇总](./Agent%E2%9E%95RL%E5%BC%80%E6%BA%90%E9%A1%B9%E7%9B%AE%E6%B1%87%E6%80%BB.md) —— 综述一批将 RL 与 LLM 结合的开源项目（ReSearch、Search-R1 等），每项含论文、GitHub 仓库、摘要与实践价值
+
+---
+
+**👉 返回**：[Agent Papers](../README.md) ｜ [Agent 资源总览](../../README.md)
```

**File**: `resources/rag/README.md` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+# RAG 资源总览
+
+> 本目录汇总 RAG（检索增强生成）方向的选型指南、工程实践与论文清单。
+> Agent 方向的对应资源见 [Agent 资源总览](../agent/README.md)。
+
+---
+
+## 📑 目录
+
+| 文档 | 内容 | 篇幅 |
+|:---|:---|:---:|
+| [向量数据库选型指南](./vector-db.md) | Milvus / FAISS / Chroma / Qdrant / Pinecone 五个核心向量库的详细对比、决策树与性能数据 | 226 行 |
+| [文档解析工具精选](./document-parsing.md) | Pipeline 式方案、文档领域微调大模型、通用多模态大模型三条技术路线，覆盖文本识别、版式布局、公式解析、表格解析 | 1290 行 |
+| [RAG 开源项目汇总](./projects.md) | 150+ 个开源项目，按开箱即用平台、开发框架、GraphRAG、引擎服务、评估优化、数据处理、应用项目分类 | 594 行 |
+| [RAG 论文汇总](./papers/README.md) | 按研究方向分类的论文清单 | — |
+
+---
+
+## 🗂️ 论文分类
+
+- [Agentic RAG](./papers/agentic_rag/README.md) —— 用智能体系统改进检索过程
+- [GraphRAG](./papers/graphrag/README.md) —— 用知识图谱增强检索
+- [Multimodal RAG](./papers/multimodal_rag/README.md) —— 面向多模态数据（文本、图像等）的 RAG
+
+---
+
+## 🧭 从这里开始
+
+刚接触 RAG，建议按这个顺序：
+
+1. **[向量数据库选型指南](./vector-db.md)** —— 先搞清楚检索层用什么，里面有决策树和面试常见的选型追问
+2. **[文档解析工具精选](./document-parsing.md)** —— 入库前的数据处理，实践中最容易踩坑的一环
+3. **[RAG 开源项目汇总](./projects.md)** —— 找一个能跑的项目改造成自己的作品集
+
+---
+
+## 🔗 相关资源
+
+- [Agent 资源总览](../agent/README.md) —— Agent 开发框架、工具调用、记忆模块
+- [开发者工具箱](../tools.md) —— 通用开发工具
+- [RAG 全链路教程](../../docs/02-tech-stack/20-rag-full-pipeline.md) —— AgentGuide 教程正文（🚧 建设中）
+- [高可用 RAG 实战](../../docs/03-practice/02-high-availability-rag.md) —— 工程化实践（🚧 建设中）
+
+---
+
+**👉 返回主文档**：[AgentGuide README](../../README.md)
```

**File**: `resources/rag/vector-db.md` (modified, +1/-1)
```diff
@@ -212,7 +212,7 @@ results = collection.query(query_texts=["query"], n_results=5)
 
 ## 📝 相关文档
 
-- [RAG 框架对比](./frameworks.md)
+- [RAG 框架对比](../agent/frameworks.md)
 - [Embedding 模型选择](./embedding.md)
 - [返回 RAG 资源总览](./README.md)
 
```

---

### Incident Patch 7: `6f5a9c98` (2026-07-27)
**Commit Message**: feat: redesign AgentGuide portal and SEO

**File**: `.github/workflows/deploy-pages.yml` (modified, +9/-11)
```diff
@@ -60,21 +60,19 @@ jobs:
           GITHUB_REPOSITORY: adongwanai/AgentGuide
         run: npm run build
 
-      - name: Copy to research directory
+      - name: Prepare static deployment artifact
         run: |
-          rm -rf research
-          mkdir -p research
-          cp -r external/ai-research-ebook/dist/* research/
-
-      - name: Copy to interview directory
-        run: |
-          rm -rf interview
-          mkdir -p interview
-          cp -r external/InterviewGuide/dist/* interview/
+          rm -rf site-dist
+          mkdir -p site-dist/assets site-dist/data site-dist/research site-dist/interview
+          cp index.html 404.html robots.txt sitemap.xml site.webmanifest .nojekyll site-dist/
+          cp -r assets/. site-dist/assets/
+          cp data/resources.json site-dist/data/resources.json
+          cp -r external/ai-research-ebook/dist/. site-dist/research/
+          cp -r external/InterviewGuide/dist/. site-dist/interview/
 
       - uses: actions/upload-pages-artifact@v3
         with:
-          path: .
+          path: site-dist
 
   deploy:
     environment:
```

**File**: `.github/workflows/static.yml` (removed, +0/-39)
```diff
@@ -1,39 +0,0 @@
-# Simple workflow for deploying static content to GitHub Pages
-name: Deploy static content to Pages
-
-on:
-  # Allows you to run this workflow manually from the Actions tab
-  workflow_dispatch:
-
-# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
-permissions:
-  contents: read
-  pages: write
-  id-token: write
-
-# Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
-# However, do NOT cancel in-progress runs as we want to allow these production deployments to complete.
-concurrency:
-  group: "pages"
-  cancel-in-progress: false
-
-jobs:
-  # Single deploy job since we're just deploying
-  deploy:
-    environment:
-      name: github-pages
-      url: ${{ steps.deployment.outputs.page_url }}
-    runs-on: ubuntu-latest
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v4
-      - name: Setup Pages
-        uses: actions/configure-pages@v5
-      - name: Upload artifact
-        uses: actions/upload-pages-artifact@v3
-        with:
-          # Upload entire repository
-          path: '.'
-      - name: Deploy to GitHub Pages
-        id: deployment
-        uses: actions/deploy-pages@v4
```

**File**: `.github/workflows/update-resources.yml` (modified, +2/-2)
```diff
@@ -30,6 +30,6 @@ jobs:
         run: |
           git config user.name "github-actions"
           git config user.email "github-actions@github.com"
-          git add data/resources.json || true
+          git add data/resources.json sitemap.xml || true
           git commit -m "chore: update resources index" || echo "no changes"
-          git push || echo "skip push"
\ No newline at end of file
+          git push || echo "skip push"
```

**File**: `.gitignore` (modified, +5/-0)
```diff
@@ -21,3 +21,8 @@ external/ai-research-ebook/.astro/
 external/InterviewGuide/dist/
 external/InterviewGuide/node_modules/
 external/InterviewGuide/.astro/
+
+# 本地 Pages 预览产物
+site-dist/
+__pycache__/
+*.pyc
```

**File**: `404.html` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+<!doctype html>
+<html lang="zh-CN">
+<head>
+    <meta charset="utf-8">
+    <meta name="viewport" content="width=device-width, initial-scale=1">
+    <meta name="robots" content="noindex, follow">
+    <meta name="theme-color" content="#f4f7f5">
+    <title>页面未找到 | AgentGuide</title>
+    <link rel="icon" type="image/svg+xml" href="/AgentGuide/assets/favicon.svg">
+    <link rel="stylesheet" href="/AgentGuide/assets/site.css?v=20260727">
+</head>
+<body>
+    <main class="not-found-page">
+        <div class="not-found-content">
+            <a class="brand" href="/AgentGuide/">
+                <span class="brand-mark" aria-hidden="true">AG</span>
+                <span>AgentGuide</span>
+            </a>
+            <p>404</p>
+            <h1>这个页面不存在</h1>
+            <span>链接可能已经移动，回到资源库继续查找需要的内容。</span>
+            <a class="button button-primary" href="/AgentGuide/#resources">返回资源库</a>
+        </div>
+    </main>
+</body>
+</html>
```

**File**: `README.md` (modified, +3/-3)
```diff
@@ -12,7 +12,7 @@
         <img src="https://img.shields.io/github/stars/adongwanai/AgentGuide.svg?style=for-the-badge&logo=github&label=Stars" alt="GitHub stars">
     </a>
     <a href="https://github.com/adongwanai/AgentGuide/network/members">
-        <img src="https://img.shields.io/badge/Forks-527-orange.svg?style=for-the-badge&logo=github" alt="GitHub forks">
+        <img src="https://img.shields.io/github/forks/adongwanai/AgentGuide.svg?style=for-the-badge&logo=github&label=Forks" alt="GitHub forks">
     </a>
     
 <br/>
@@ -91,7 +91,7 @@
 
 <div align="center">
 <img src="https://raw.githubusercontent.com/adongwanai/Awesome-Awesome-LLMs/main/20251210154458267.png" alt="LLM开源生态图谱" width="100%">
-<sub>图片来源：<a href="https://github.com/Langchainai/llm-oss-landscape">LLM Open Source Landscape</a></sub>
+<sub>图片来源：<a href="https://github.com/adongwanai/Awesome-Awesome-LLMs">Awesome-Awesome-LLMs</a></sub>
 </div>
 
 **📌 AgentGuide 涵盖的核心技术栈（2026 版）**：
@@ -1947,7 +1947,7 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
   - 配套书籍：[《大模型算法：强化学习、微调与对齐》](https://book.douban.com/subject/37331056/)
 
 **🌟 需要更全面的 LLM 资源？**  
-👉 查看作者的另一个项目：**[Awesome-Awesome-LLM](https://github.com/adongwanai/Awesome-Awesome-LLM)**  
+👉 查看作者的另一个项目：**[Awesome-Awesome-LLMs](https://github.com/adongwanai/Awesome-Awesome-LLMs)**
 （涵盖训练、推理、多模态、Infra 等 LLM 全栈 200+ Awesome 系列资源）
 
 ---
```

**File**: `assets/agentguide-learning-map.svg` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+<svg viewBox="0 0 1120 720" xmlns="http://www.w3.org/2000/svg">
+  <style>
+    text { font-family: ui-monospace, 'SFMono-Regular', 'PingFang SC', 'Microsoft YaHei', monospace; }
+    .title { fill: #f8fafc; font-size: 20px; font-weight: 700; }
+    .subtitle { fill: #94a3b8; font-size: 11px; }
+    .box-title { fill: #ffffff; font-size: 13px; font-weight: 700; text-anchor: middle; }
+    .box-sub { fill: #cbd5e1; font-size: 10px; text-anchor: middle; }
+    .small { fill: #94a3b8; font-size: 9px; text-anchor: middle; }
+    .label { fill: #e2e8f0; font-size: 10px; font-weight: 600; text-anchor: middle; }
+    .note { fill: #cbd5e1; font-size: 10px; }
+  </style>
+  <defs>
+    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
+      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5"/>
+    </pattern>
+    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
+      <polygon points="0 0, 10 3.5, 0 7" fill="#64748b"/>
+    </marker>
+    <marker id="arrow-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
+      <polygon points="0 0, 10 3.5, 0 7" fill="#22d3ee"/>
+    </marker>
+    <marker id="arrow-emerald" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
+      <polygon points="0 0, 10 3.5, 0 7" fill="#34d399"/>
+    </marker>
+  </defs>
+  <rect width="1120" height="720" fill="#0f172a"/>
+  <rect width="1120" height="720" fill="url(#grid)"/>
+
+  <text x="40" y="46" class="title">AgentGuide Learning Map</text>
+  <text x="40" y="66" class="subtitle">从概念认知到项目交付：workflow -> agent loop -> tools -> context -> eval -> resume</text>
+
+  <rect x="40" y="104" width="1040" height="196" rx="12" fill="none" stroke="#22d3ee" stroke-width="1" stroke-dasharray="8,4"/>
+  <text x="58" y="126" fill="#22d3ee" font-size="11" font-weight="700">Stage 0-2: 建立最小闭环</text>
+
+  <g>
+    <rect x="80" y="160" width="160" height="76" rx="6" fill="#0f172a"/>
+    <rect x="80" y="160" width="160" height="76" rx="6" fill="rgba(8,51,68,0.42)" stroke="#22d3ee" stroke-width="1.5"/>
+    <text x="160" y="190" class="box-title">Concept Map</text>
+    <text x="160" y="209" class="box-sub">chatbot / workflow / agent</text>
+  </g>
+  <g>
+    <rect x="300" y="160" width="160" height="76" rx="6" fill="#0f172a"/>
+    <rect x="300" y="160" width="160" height="76" rx="6" fill="rgba(6,78,59,0.42)" stroke="#34d399" stroke-width="1.5"/>
+    <text x="380" y="190" class="box-title">Minimal Loop</text>
+    <text x="380" y="209" class="box-sub">observe -> act -> observe</text>
+  </g>
+  <g>
+    <rect x="520" y="160" width="160" height="76" rx="6" fill="#0f172a"/>
+    <rect x="520" y="160" width="160" height="76" rx="6" fill="rgba(120,53,15,0.32)" stroke="#fbbf24" stroke-width="1.5"/>
+    <text x="600" y="190" class="box-title">Tool Design</text>
+    <text x="600" y="209" class="box-sub">schema / errors / permission</text>
+  </g>
+  <g>
+    <rect x="740" y="160" width="160" height="76" rx="6" fill="#0f172a"/>
+    <rect x="740" y="160" width="160" height="76" rx="6" fill="rgba(76,29,149,0.42)" stroke="#a78bfa" stroke-width="1.5"/>
+    <text x="820" y="190" class="box-title">Context</text>
+    <text x="820" y="209" class="box-sub">state / memory / retrieval</text>
+  </g>
+
+  <path d="M 245 198 L 292 198" stroke="#64748b" stroke-width="1.6" marker-end="url(#arrow)"/>
+  <path d="M 465 198 L 512 198" stroke="#64748b" stroke-width="1.6" marker-end="url(#arrow)"/>
+  <path d="M 685 198 L 732 198" stroke="#64748b" stroke-width="1.6" marker-end="url(#arrow)"/>
+
+  <rect x="40" y="340" width="1040" height="226" rx="12" fill="none" stroke="#34d399" stroke-width="1" stroke-dasharray="8,4"/>
+  <text x="58" y="362" fill="#34d399" font-size="11" font-weight="700">Stage 3-6: 做成可展示项目</text>
+
+  <g>
+    <rect x="94" y="408" width="180" height="86" rx="6" fill="#0f172a"/>
+    <rect x="94" y="408" width="180" height="86" rx="6" fill="rgba(59,130,246,0.32)" stroke="#60a5fa" stroke-width="1.5"/>
+    <text x="184" y="438" class="box-title">Trace &amp; Replay</text>
+    <text x="184" y="457" class="box-sub">JSONL / span / artifacts</text>
+    <text x="184" y="474" class="small">失败后能复盘</text>
+  </g>
+  <g>
+    <rect x="344" y="408" width="180" height="86" rx="6" fill="#0f172a"/>
+    <rect x="344" y="408" width="180" height="86" rx="6" fill="rgba(6,78,59,0.42)" stroke="#34d399" stroke-width="1.5"/>
+    <text x="434" y="438" class="box-title">Eval Harness</text>
+    <text x="434" y="457" class="box-sub">20+ cases / metrics</text>
+    <text x="434" y="474" class="small">证明不是偶然成功</text>
+  </g>
+  <g>
+    <rect x="594" y="408" width="180" height="86" rx="6" fill="#0f172a"/>
+    <rect x="594" y="408" width="180" height="86" rx="6" fill="rgba(136,19,55,0.42)" stroke="#fb7185" stroke-width="1.5"/>
+    <text x="684" y="438" class="box-title">Safety</text>
+    <text x="684" y="457" class="box-sub">sandbox / 
```

**File**: `assets/favicon.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path fill-rule="evenodd" d="M81 36 64 0 47 36l-1 2-9-10a6 6 0 0 0-9 9l10 10h-2L0 64l36 17h2L28 91a6 6 0 1 0 9 9l9-10 1 2 17 36 17-36v-2l9 10a6 6 0 1 0 9-9l-9-9 2-1 36-17-36-17-2-1 9-9a6 6 0 1 0-9-9l-9 10v-2Zm-17 2-2 5c-4 8-11 15-19 19l-5 2 5 2c8 4 15 11 19 19l2 5 2-5c4-8 11-15 19-19l5-2-5-2c-8-4-15-11-19-19l-2-5Z" clip-rule="evenodd"/><path d="M118 19a6 6 0 0 0-9-9l-3 3a6 6 0 1 0 9 9l3-3Zm-96 4c-2 2-6 2-9 0l-3-3a6 6 0 1 1 9-9l3 3c3 2 3 6 0 9Zm0 82c-2-2-6-2-9 0l-3 3a6 6 0 1 0 9 9l3-3c3-2 3-6 0-9Zm96 4a6 6 0 0 1-9 9l-3-3a6 6 0 1 1 9-9l3 3Z"/><style>path{fill:#000}@media (prefers-color-scheme:dark){path{fill:#fff}}</style></svg>
\ No newline at end of file
```

---

### Incident Patch 8: `70ffa84f` (2026-07-27)
**Commit Message**: docs: add algorithm interview and roadmap guides

**File**: `README.md` (modified, +15/-2)
```diff
@@ -50,11 +50,12 @@
 - [📚 学习路线图](#-第三步基于岗位的学习路线) - 算法岗10-15周 | 开发岗8-12周
 - [💼 实战项目](#-第四步完成实战项目可写进简历) - 开源优质项目合集+N X Agent项目
 - [📖 技术教程](#-第五步系统学习-agent-技术技术准备) - LangGraph、RAG、上下文工程、监督微调、强化学习
-- [🎯 面试题库](#-第六步面试准备与-offer-冲刺) - 1000+题、系统设计、编程题
+- [🎯 面试题库](#-第六步面试准备与-offer-冲刺) - 1500+题/面经、系统设计、编程题
 
 **🛠️ 快速导航**：
 - [🚀 10分钟快速开始](#-快速开始) | [💬 加入学习社群](#-联系作者--加入社群) | [❓ 常见问题](./FAQ.md)
 - [🧭 新手快速开始](./docs/00-getting-started/README.md) | [🧭 2026 Agent 求职路线](./docs/05-roadmaps/agent-job-ready-roadmap-2026.md) | [🛠️ Agent 项目落地方法](./docs/03-practice/05-ship-agent-project.md) | [🧩 Agent Harness Engineering](./docs/02-tech-stack/27-agent-harness-engineering.md)
+- [🔬 前沿算法完整路线](./docs/05-roadmaps/algorithm-complete-learning-guide.md) | [🤖 具身智能/VLA路线](./docs/05-roadmaps/embodied-ai-vla-learning-guide.md) | [💻 算法+AI手撕题库](./docs/04-interview/18-algorithm-ai-coding-question-bank.md) | [📋 小红书AI算法岗面经](./docs/04-interview/19-xiaohongshu-ai-algorithm-interview-bank.md)
 - [📄 Paper Agent](./projects/01-paper-agent/README.md) | [🧳 Travel Agent](./projects/02-travel-agent/README.md) | [🌐 Web Agent](./projects/03-web-agent/README.md) | [🖼️ Multimodal RAG](./resources/multimodal/README.md)
 
 ---
@@ -823,6 +824,10 @@ Agent 方向变化很快，当前更值得投入的是能落地、能验证、
 **🚀 新手推荐**：
 - 📘 [**AgentGuide开源学习路线（简易版）**](./docs/05-roadmaps/AgentGuide开源学习路线（简易版本）.md) - **从零到Offer完整路径**，8-15周系统化学习方案，包含完整资源清单 ⭐⭐⭐
 
+**🔬 算法 / 具身方向新增**：
+- 🧠 [前沿算法岗位完整学习指南](./docs/05-roadmaps/algorithm-complete-learning-guide.md) - 覆盖算法岗从工程基础、模型训练、RAG/Agent、多模态到推理部署的完整能力栈
+- 🤖 [具身智能与 VLA 完整学习指南](./docs/05-roadmaps/embodied-ai-vla-learning-guide.md) - 面向 VLA/机器人岗位的多模态、动作建模、仿真、Sim2Real 与数据闭环路线
+
 **📋 详细路线**（按岗位分）：
 
 ### 🗺️ 选择你的学习路线
@@ -1760,7 +1765,7 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
 > 💡 **学习目标**：系统准备面试，提升 Offer 成功率  
 > 📝 **两条线不同的面试策略**：算法岗讲创新，开发岗讲价值
 
-#### 📚 完整面试题库（300+题）🔥 全面升级
+#### 📚 完整面试题库（1500+题/面经）🔥 全面升级
 
 > **🎯 题库特色**：
 > - ✅ 完整覆盖 LLM/VLM/RLHF/RAG/Agent 全技术栈
@@ -1810,6 +1815,9 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
 - [x] [💻 大模型手撕刷题路线](./docs/04-interview/17-coding-exercises.md) 🆕
   - 分阶段刷题：神经网络基础算子 → Attention 机制 → 位置编码 → 优化技术
   - 按难度分级，系统化刷题指南
+- [x] [🧩 算法题：传统算法与 AI 手撕分类版](./docs/04-interview/18-algorithm-ai-coding-question-bank.md) 🆕
+  - 503 道，覆盖数组/链表/树/图/动态规划/训练推理/CUDA 等分类
+  - 保留公司来源和难度标签，适合按专题刷题
 
 </td>
 </tr>
@@ -1824,6 +1832,7 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
 
 - [x] [📋 大厂真实面经](./docs/04-interview/12-company-interview-cases.md) - 美团/字节/阿里等16个完整案例
 - [x] [🧭 AI Agent 面试备战手册合集](./docs/04-interview/18-agent-interview-playbooks/) - Memory、Skills、Harness、评估、数据合成、源码分析与项目话术
+- [x] [📚 1000篇小红书AI算法岗面经：难度递增整合版](./docs/04-interview/19-xiaohongshu-ai-algorithm-interview-bank.md) 🆕 - 按编程、ML/DL、RAG/Agent、多模态、系统设计等难度递增整理
 - [x] [📊 模型评估专题](./docs/04-interview/13-model-evaluation.md) - BLEU/ROUGE、基准测试、LLM-as-Judge **10题**
 - [x] [🔮 前景与趋势](./docs/04-interview/14-llm-future-trends.md) - AGI、多模态、世界模型等开放讨论 **9题**
 - [x] [💬 开放性讨论](./docs/04-interview/15-open-discussion.md) - 技术判断、学习建议、核心素质 **8题**
@@ -2090,6 +2099,8 @@ python quickstart_rag_agent.py
 - 🧭 [2026 Agent 求职通关路线](./docs/05-roadmaps/agent-job-ready-roadmap-2026.md) - Agent Loop、Harness、Skills、Eval、项目产出的可执行路线 ⭐ 新增
 - 🚀 [AgentGuide开源学习路线（简易版）](./docs/05-roadmaps/AgentGuide开源学习路线（简易版本）.md) - 从零到Offer完整路径（8-15周）⭐ 新增
 - 🔬 [算法岗详细路线](./docs/05-roadmaps/learning-roadmap-algorithm.md) - 每日学习计划
+- 🧠 [前沿算法岗位完整学习指南](./docs/05-roadmaps/algorithm-complete-learning-guide.md) - 覆盖算法岗位能力栈、实践任务和交付标准
+- 🤖 [具身智能与 VLA 完整学习指南](./docs/05-roadmaps/embodied-ai-vla-learning-guide.md) - 面向 VLA/机器人岗位的系统学习路线
 - 🛠️ [开发岗详细路线](./docs/05-roadmaps/learning-roadmap-development.md) - 每日学习计划
 
 ### 💼 实战方法
@@ -2101,6 +2112,8 @@ python quickstart_rag_agent.py
 - 📊 [RAG 资源总览](./resources/rag/) - RAG 所有资源
 - 🛠️ [开发工具箱](./resources/tools.md) - 效率工具推荐
 - 📚 [精选学习资源](./resources/learning-resources.md) - 课程、教程、书籍汇总
+- 💻 [算法+AI手撕题库](./docs/04-interview/18-algorithm-ai-coding-question-bank.md) - 传统算法与 AI 手撕分类版
+- 📋 [小红书AI算法岗面经题库](./docs/04-interview/19-xiaohongshu-ai-algorithm-interview-bank.md) - 难度递增整合版
 
 ---
 
```

**File**: `data/resources.json` (modified, +49/-1)
```diff
@@ -1,4 +1,52 @@
 [
+  {
+    "id": "ai",
+    "title": "算法题：传统算法与AI手撕分类版",
+    "description": "> 共 503 道；传统算法沿用十二大类，AI/ML/训练推理/CUDA现场实现统一归入“AI手撕题”；已删除 45 条无具体题干的噪音记录。",
+    "category": "求职",
+    "tags": [],
+    "level": "入门",
+    "type": "指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/18-algorithm-ai-coding-question-bank.md",
+    "date": "2026-07-27",
+    "featured": false
+  },
+  {
+    "id": "1000-ai",
+    "title": "1000篇小红书AI算法岗面经：难度递增整合版",
+    "description": "> 相似题目按考察意图保守整合；不同限制条件、子问、场景和实现要求均保留。各二级分类内按难度递增排列。",
+    "category": "求职",
+    "tags": [],
+    "level": "入门",
+    "type": "指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/19-xiaohongshu-ai-algorithm-interview-bank.md",
+    "date": "2026-07-27",
+    "featured": false
+  },
+  {
+    "id": "",
+    "title": "前沿算法岗位完整学习指南",
+    "description": "> 基于北上杭深真实算法岗位的技术职责、硬要求和加分项生成。生成时间：2026-07-15T16:13:26+08:00。",
+    "category": "路线",
+    "tags": [],
+    "level": "入门",
+    "type": "路线",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/05-roadmaps/algorithm-complete-learning-guide.md",
+    "date": "2026-07-27",
+    "featured": false
+  },
+  {
+    "id": "vla",
+    "title": "具身智能与 VLA 完整学习指南",
+    "description": "> 基于已筛选的真实岗位职责、硬要求与加分项整理。生成时间：2026-07-10T12:43:12+08:00。",
+    "category": "路线",
+    "tags": [],
+    "level": "入门",
+    "type": "路线",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/05-roadmaps/embodied-ai-vla-learning-guide.md",
+    "date": "2026-07-27",
+    "featured": false
+  },
   {
     "id": "ai-agent-agent",
     "title": "AI Agent 面试题库 - Agent 核心篇",
@@ -1367,4 +1415,4 @@
     "date": "2026-07-09",
     "featured": false
   }
-]
\ No newline at end of file
+]
```

**File**: `docs/04-interview/18-algorithm-ai-coding-question-bank.md` (added, +574/-0)
```diff
@@ -0,0 +1,574 @@
+# 算法题：传统算法与AI手撕分类版
+
+> 共 503 道；传统算法沿用十二大类，AI/ML/训练推理/CUDA现场实现统一归入“AI手撕题”；已删除 45 条无具体题干的噪音记录。
+
+## 数组与字符串
+
+1. 【数组｜L1】怎么找某vector的倒数第二个元素？ 「百度」
+2. 【[LC 14](https://leetcode.cn/problems/longest-common-prefix/)｜字典树、数组、字符串｜L1】手撕 最长公共前缀 「京东」
+3. 【数组｜L1】为什么要加if(id<n)这种边界判断？ 「百度」
+4. 【数组、矩阵｜L2】上三角矩阵，下三角矩阵 「百度」
+5. 【前缀和、数组｜L2】前缀乘积。 「百度文心」
+6. 【[LC 151](https://leetcode.cn/problems/reverse-words-in-a-string/)｜双指针、字符串｜L2】反转字符串的每个单词（后输出的单词先输出）。 「美团」
+7. 【[LC 88](https://leetcode.cn/problems/merge-sorted-array/)｜数组、双指针、排序｜L2】合并两个有序数组（核心代码模式）。变体：合并后去重，如何保证时间复杂度？；另一场次补充：手撕代码：两个升序序列的合并，询问思路和复杂度。 「字节跳动、美团」
+8. 【[LC 169](https://leetcode.cn/problems/majority-element/)｜数组、哈希表、分治、计数、排序｜L2】手撕：找出数组中出现次数大于数组长度一半的多数元素（LeetCode 169）。 「字节跳动、百度、美团」
+9. 【字符串、设计｜L2】大量字符串拼接（如上万字符串）应该用什么方式？能否直接用“+”？用 string 以及并发的时间复杂度分别是多少？ 「百度、美团」
+10. 【模拟、字符串｜L2】给一个字符串例如'abcde'，依次将第i个字符移到末尾，'abcde'->'bcdea'->'bdeac'->'bdace'->'bdaec'->'bdaec'。 「百度」
+11. 【字符串、双指针｜L2】code:删除字符串中多余的空格，只保留一个。 「京东」
+12. 【[LC 189](https://leetcode.cn/problems/rotate-array/)｜数组、数学、双指针｜L2】手撕代码：字符数组原地向右挪动K位（数组旋转）。 「拼多多」
+13. 【数组｜L2】给定一个数组，找出数组中值最大和值第二大的两个数值，考虑时间复杂度尽可能低。 「百度」
+14. 【[LC 228](https://leetcode.cn/problems/summary-ranges/)｜数组｜L2】实现汇总区间。 「字节跳动」
+15. 【[LC 867](https://leetcode.cn/problems/transpose-matrix/)｜数组、矩阵、模拟｜L2】matrix transpose（矩阵转置） 「字节跳动」
+16. 【数组｜L2】代码题：求数组连续出现相同数字的最大次数（一次遍历的easy题）。 「字节跳动」
+17. 【字符串匹配、字符串｜L3】KMP算法是什么？解释其核心思想，包括next数组的构建和匹配过程。 「百度」
+18. 【[LC 15](https://leetcode.cn/problems/3sum/)｜数组、双指针、排序｜L3】实现三数之和算法（LeetCode 15）及其变体：LeetCode 15 改成了3（具体变体未说明，保留原描述）。要求找出数组中所有和为0的三元组，不可重复。 「京东、百度、美团、腾讯、蚂蚁集团、阿里巴巴」
+19. 【[LC 30](https://leetcode.cn/problems/substring-with-concatenation-of-all-words/)｜哈希表、字符串、滑动窗口｜L3】串联所有单词的子串。给定一个字符串s和一个单词列表words，找出s中所有可以由words中所有单词串联形成的子串的起始位置。 「字节跳动」
+20. 【模拟、数组｜L3】给一个整数列表如[1,2,3,4]，依次加上符号变成1+2-3+4，然后如下放进列表:[1+2,2-3,3+4]即[3,-1,7]，一直到列表中只有最后一个数字，输出这个数字。 「百度」
+21. 【双指针、字符串｜L3】实现删除字符串中的连续空格，要求O(n)时间复杂度、O(1)空间复杂度。 「阿里通义」
+22. 【[LC 415](https://leetcode.cn/problems/add-strings/)｜数学、字符串、模拟｜L3】两数相加的字符串版本（LeetCode模式）。实现字符串相加。；另一场次补充：算法题：leetcode大数加法。 「字节跳动、美团、腾讯」
+23. 【字符串、排序｜L3】实现字符串重排序之后的重合。 「腾讯」
+24. 【[LC 498](https://leetcode.cn/problems/diagonal-traverse/)｜数组、矩阵、模拟｜L3】手撕对角线遍历矩阵。 「美团」
+25. 【[LC 74](https://leetcode.cn/problems/search-a-2d-matrix/)｜数组、二分查找、矩阵｜L3】搜索二维矩阵：矩阵每行递增，且每行最后一个元素小于下一行第一个元素（类似力扣240），查找target是否存在。 「百度、美团」
+26. 【数组、前缀和｜L3】特别数标识输出给一个数组，针对数组中每一个数字，如果它大于左侧所有数字且小于右侧所有数字，则对应位置标识为1，不满足任何一个条件则标识为0。 「百度」
+27. 【[LC 5](https://leetcode.cn/problems/longest-palindromic-substring/)｜双指针、字符串、动态规划｜L3】手撕最长回文子串（LeetCode 5），要求输出子串，ACM格式，注意输入格式正确。 「京东、字节跳动、拼多多、百度、美团、阿里巴巴」
+28. 【[LC 56](https://leetcode.cn/problems/merge-intervals/)/[LC 128](https://leetcode.cn/problems/longest-consecutive-sequence/)｜数组、排序、并查集、哈希表｜L3】code 原创题,并不难。像lc128最长连续序列和lc56合并区间的杂交版 「美团」
+29. 【[LC 54](https://leetcode.cn/problems/spiral-matrix/)｜数组、矩阵、模拟｜L3】代码实现螺旋矩阵（顺时针遍历二维矩阵），即LeetCode 54题。 「字节跳动、美团、蚂蚁集团、阿里通义」
+30. 【数组、动态规划｜L3】观光景点最高得分。 「百度」
+31. 【数组、双指针｜L3】算法题：递增序列变体。 「美团」
+32. 【递归、字符串｜L3】递归字符切分逻辑。 「美团」
+33. 【[LC 209](https://leetcode.cn/problems/minimum-size-subarray-sum/)｜数组、二分查找、前缀和、滑动窗口｜L3】手撕：长度最小子数组问题（LeetCode 209/Hot100），返回最小长度。 「拼多多、百度」
+34. 【[LC 238](https://leetcode.cn/problems/product-of-array-except-self/)｜数组、前缀和｜L3】代码：除自身外数组乘积（LeetCode 238/Hot100）。 「腾讯」
+35. 【[LC 229](https://leetcode.cn/problems/majority-element-ii/)｜数组、哈希表、计数、排序｜L4】找出有序数组中所有出现次数严格大于n/3的数字，要求时间复杂度低于O(n)。 「字节跳动」
+36. 【模拟、数组｜L4】有两个数组M和N，N代表一系列直径为M[i]的连续隧道，M代表一系列直径为N[i]的圆柱体，按顺序将一系列圆柱体往隧道里送，如果圆柱体直径大于某段隧道直径就会卡住，后续圆柱体也过不去，求最后圆柱体所在的最小位置，如果都通过了就返回-1。 「字节跳动」
+37. 【数组、数学｜L4】给列表套列表套列表，问这个array的shape，再分别写一下对每个axis求和的结果是什么，对axis求和的数学依据是什么，为什么是这几个element求和，从数学角度怎么解释？ 「阿里通义」
+38. 【[LC 391](https://leetcode.cn/problems/perfect-rectangle/)｜几何、数组、哈希表、数学、扫描线｜L4】力扣完美矩形变体（原题：判断多个矩形能否恰好覆盖一个大矩形，无重叠无空隙；变体可能增加条件或改变输出）。 「拼多多」
+39. 【[LC 977](https://leetcode.cn/problems/squares-of-a-sorted-array/)｜数组、双指针、排序｜L4】给定数组 [-3, -2, -1, 0, 3, 6]，将其平方后排序。；另一场次补充：算法题：有序数组的平方（LeetCode 977）。 「腾讯」
+40. 【数组、模拟｜L4】code:手写一下对给定axis求和（得分前面的维度和后面的维度，先flatten然后再求和的时候每次加stride）。 「阿里通义」
+41. 【模拟、字符串｜L4】实现一段超长文本（可能几千万字）的切分，规则：1. 每段有最大长度K，段落以标点结束；2. 如果某段到了K还没遇到标点，就向后找最近的标点作为段尾（此时允许超过K）；3. 如果相邻几个短句加起来不超过K，要尽量合并成一段，让长度尽量接近K。；另一场次补充：手写简易文本Chunking分割算法，实现固定长度+语义约束的文本分块。 「阿里巴巴、阿里通义」
+42. 【[LC 3](https://leetcode.cn/problems/longest-substring-without-repeating-characters/)｜哈希表、字符串、滑动窗口｜L4】手撕无重复字符的最长子串（LeetCode 3，Hot100）。给定一个字符串s，找出其中不含有重复字符的最长子串的长度。变体：最长不同子数组的长度。；另一场次补充：给定一个字符串流，实现一个滑动窗口，返回当前窗口内的最长不重复子串长度。 「京东、字节Seed、字节跳动、美团、腾讯、腾讯混元、阿里巴巴」
+43. 【[LC 76](https://leetcode.cn/problems/minimum-window-substring/)｜哈希表、字符串、滑动窗口｜L4】手撕最小覆盖子串：给定两个字符串s和t，请在s中找出包含t所有字符（出现次数也要满足）的最短子串。变体1：Code字符串中包含query字符的最短子串。变体2：给一个长度为L的数组，可能是m种颜色，找到最小的n，使得连续n个元素包含全部m种颜色。 「京东、美团、蚂蚁集团、阿里通义」
+44. 【[LC 1769](https://leetcode.cn/problems/minimum-number-of-operations-to-move-all-balls-to-each-box/)｜数组、字符串、前缀和｜L4】手撕leecode1769的变体，改成每移动一个站台需要一个能量 「小红书」
+45. 【[LC 41](https://leetcode.cn/problems/first-missing-positive/)｜数组、哈希表｜L4】给定一个数组，找出缺失的最小正
```

**File**: `docs/05-roadmaps/algorithm-complete-learning-guide.md` (added, +785/-0)
```diff
@@ -0,0 +1,785 @@
+# 前沿算法岗位完整学习指南
+
+> 基于北上杭深真实算法岗位的技术职责、硬要求和加分项生成。生成时间：2026-07-15T16:13:26+08:00。
+
+## 使用方法
+
+这份指南把岗位中的技术职责、硬要求和加分能力归并到阶段能力模块中。模块用于明确学习边界，实践任务、交付物、验收标准和技术索引按阶段统一组织。
+
+建议维护一个贯穿全程的实验仓库，统一保存环境、数据、训练、评测、部署、失败案例和技术决策。不要把每个阶段做成互不关联的玩具项目。
+
+### 完整性口径
+
+- 6635 条技术要求均映射到一个阶段能力模块；主文档不再逐句重复。
+- 357 项算法主关键词与补充技术词共同进入各阶段技术索引；每个词放在最适合学习的主阶段，避免重复堆砌。
+- 基础技术词表共 535 项，并从技术要求中补充缩写、框架和工具名。
+- 职责动作由能力闭环、实践任务和验收标准承接；具体技术对象由模块内容和技术索引承接。
+- 教育、院校、毕业批次和数字年限已在上游筛选文档中删除，本指南不重新引入。
+
+## 能力全景
+
+| 阶段 | 能力域 | 建议节奏 | 能力模块 | 技术关键词 | 核心产出 |
+|---:|---|---:|---:|---:|---|
+| 0 | 工程环境、编程与实验规范 | 2-4 周 | 6 | 62 | 训练模板仓库、故障排查手册 |
+| 1 | 数学、统计、机器学习与优化基础 | 4-6 周 | 6 | 86 | 数学推导笔记、传统 ML 基线仓库 |
+| 2 | 深度学习、Transformer 与生成建模 | 5-8 周 | 6 | 32 | Transformer 实现、生成模型实验 |
+| 3 | 数据工程、语料治理与合成数据 | 4-7 周 | 7 | 73 | 版本化数据集、数据质量报告 |
+| 4 | 预训练、模型架构、MoE 与长上下文 | 6-10 周 | 7 | 102 | 预训练配方、Scaling 实验 |
+| 5 | 后训练、PEFT、强化学习与模型对齐 | 7-12 周 | 7 | 137 | 后训练流水线、偏好与奖励数据 |
+| 6 | RAG、Agent、工具调用、记忆与长程规划 | 6-10 周 | 7 | 95 | RAG 系统、长程 Agent |
+| 7 | 多模态、视觉语言、语音、视频与具身模型 | 7-12 周 | 7 | 134 | 多模态微调项目、生成模型项目 |
+| 8 | 评测、Benchmark、实验工程与因果分析 | 4-7 周并持续进行 | 7 | 50 | 评测框架、Benchmark 数据卡 |
+| 9 | AI 安全、红队、鲁棒性、事实性与隐私 | 4-8 周并持续进行 | 7 | 29 | 威胁模型、红队与安全评测集 |
+| 10 | 分布式训练、训练平台与 AI Infra | 5-9 周 | 7 | 58 | 多卡训练方案、Profiling 报告 |
+| 11 | 推理、Serving、压缩与性能优化 | 5-8 周 | 7 | 55 | 推理服务、性能基准 |
+| 12 | 垂直算法分支与业务建模 | 任选 1-2 个方向，各 6-10 周 | 8 | 75 | 领域端到端项目、业务指标树 |
+| 13 | 论文复现、研究方法、产品落地与作品集 | 贯穿全程，集中整理 4-6 周 | 7 | 207 | 论文复现仓库、开源贡献 |
+
+## 推荐推进方式
+
+1. 阶段 0-2 是共同基础，应先完成可复现训练模板、数学基线和 Transformer/生成模型实验。
+2. 阶段 3-5 打通数据、预训练和后训练，是基础模型算法岗的核心主线。
+3. 阶段 6-9 按 Agent、多模态、评测和安全逐步扩展，所有方向都必须建立可重复评测。
+4. 阶段 10-11 负责把算法变成可规模化训练和稳定服务的系统。
+5. 阶段 12 选择一到两个垂直方向形成深度；阶段 13 从第一天开始持续积累证据。
+
+不要用课程数量衡量进度。每个阶段必须留下代码、数据说明、实验结果、失败分析和验收记录。
+
+## 阶段 0：工程环境、编程与实验规范
+
+> 建议节奏：2-4 周。能力模块：6 个。
+
+### 学习目标
+
+建立可复现、可调试、可扩展的算法研发底座，能独立完成数据处理、训练、评测和服务接口。
+
+### 必学内容
+
+> 能力闭环：原理研究与复现、数据构建与治理、算法建模与实现、训练调优与稳定性、评测、消融与误差分析、工程系统与工具链、部署、性能与运维、场景适配与产品闭环、安全、鲁棒与合规、原理理解与实际应用。
+
+- **模块 0.1**：Python、C/C++、SQL、Shell；补充 Go/Java/Rust 在服务和高性能模块中的使用边界。
+- **模块 0.2**：Linux、Git、Docker、Conda/uv、CUDA 环境、依赖锁定、配置管理和随机种子。
+- **模块 0.3**：NumPy、Pandas、SciPy、scikit-learn；PyTorch Dataset、DataLoader、autograd 与自定义算子。
+- **模块 0.4**：日志、断点续训、指标记录、实验追踪、数据校验、单元测试、回归测试和故障复现。
+- **模块 0.5**：数据结构、复杂度、并发、网络、数据库、RPC/REST、缓存、消息队列和微服务基础。
+- **模块 0.6**：Profiling、数值异常、梯度异常、OOM、I/O 瓶颈和线上问题定位。
+
+### 实践任务
+
+1. 实现一个可配置的 PyTorch 训练模板，支持 AMP、断点恢复、独立评测和实验追踪。
+2. 为数据为空、标签越界、NaN、梯度爆炸、OOM 和训练中断分别编写复现与修复用例。
+3. 把模型封装为 REST/RPC 服务，加入超时、重试、幂等、批处理、监控和压测。
+
+### 可交付成果
+
+- 训练模板仓库
+- 故障排查手册
+- 接口与压测报告
+
+### 验收标准
+
+- 换机器后可按文档复现实验，关键依赖和随机性来源可追踪。
+- 能解释训练慢、显存高、结果漂移和服务不稳定的具体原因。
+- 代码具备测试、日志、配置、版本和最小可观测性。
+
+### 技术关键词索引
+
+- `AI-Native`、`c++`、`cuda`、`docker`、`FastAPI`、`FForking`、`Full-stack`、`git`
+- `GitHub`、`golang`、`go语言`、`GtHub`、`huggingface`、`ICPC`、`java`、`jax`
+- `JS`、`k8s`、`keras`、`kubernetes`、`linux`、`MATLAB`、`mindspore`、`MMDetection`
+- `ModelScope`、`MySQL`、`numpy`、`OD`、`OOP`、`OpenCode`、`opencv`、`PaddleDetection`
+- `paddlepaddle`、`pandas`、`PostgreSQL`、`PR`、`PyQt`、`python`、`pytorch`、`QNN`
+- `repo-level`、`RT-DETR`、`rust`、`scala`、`scikit-learn`、`scipy`、`shell`、`SIMULINK`
+- `sklearn`、`SPSS`、`sql`、`SWE-bench`、`TCP`、`tensorflow`、`transformers`、`triton`
+- `XZ0000580`、`并发编程`、`数据库`、`网络编程`、`计算机基础`、`软件工程`
+
+## 阶段 1：数学、统计、机器学习与优化基础
+
+> 建议节奏：4-6 周。能力模块：6 个。
+
+### 学习目标
+
+能从目标函数、数据分布和统计假设解释算法，而不是只会调用框架。
+
+### 必学内容
+
+> 能力闭环：原理研究与复现、数据构建与治理、算法建模与实现、训练调优与稳定性、评测、消融与误差分析、工程系统与工具链、部署、性能与运维、场景适配与产品闭环、安全、鲁棒与合规、原理理解与实际应用。
+
+- **模块 1.1**：线性代数：向量空间、矩阵分解、特征值、SVD、低秩近似和张量运算。
+- **模块 1.2**：概率统计：条件概率、贝叶斯、常见分布、最大似然、假设检验、置信区间和校准。
+- **模块 1.3**：优化：梯度下降、动量、AdamW、约束优化、凸优化、拉格朗日、数值稳定性。
+- **模块 1.4**：机器学习：线性/逻辑回归、树模型、Boosting、聚类、降维、异常检测和特征工程。
+- **模块 1.5**：泛化：偏差方差、正则化、交叉验证、数据泄漏、分布偏移和不确定性。
+- **模块 1.6**：实验统计：效应量、显著性、功效、方差缩减、因果推断和 uplift 建模基础。
+
+### 实践任务
+
+1. 不用深度学习框架实现线性模型、MLP 和反向传播，并进行梯度检查。
+2. 完成树模型与神经网络的同数据对比，分析数据规模、特征和误差类型。
+3. 设计一组有置信区间的对照实验，说明结论何时成立、何时不能外推。
+
+### 可交付成果
+
+- 数学推导笔记
+- 传统 ML 基线仓库
+- 统计实验报告
+
+### 验收标准
+
+- 能推导常用损失和优化更新，并解释稳定性与收敛问题。
+- 能识别泄漏、混杂、过拟合和指标误导。
+- 能为新问题建立合理基线，而不是直接上大模型。
+
+### 技术关键词索引
+
+- `AI+`、`ARM`、`BLOOM`、`C#`、`CANN`、`CCPC`、`co-design`、`DALI`
+- `DeepSpeedd`、`Diffusion-based`、`DLRover`、`DNN`、`DQN`、`DSA`、`end-to-end`、`ESPnet`
+- `fasterTransformer`、`GBDT`、`GNN`、`GO`、`GPGPU`、`hands-on`、`HMM`、`IEG`
+- `Inference`、`IP`、`LIO-SAM`、`LLaMA`、`LLamaFactory`、`LM`、`Long-CoT`、`LP`
+- `LSTM`、`MACE`、`MapTR`、`MASt3R`、`MCTS`、`MDP`、`MILP`、`MINLP`
+- `MIP`、`MLIR`、`MLM`、`mniGuard`、`MXNet`、`NN`、`NPU`、`NVIDIA`
+- `Objective-C`、`PhD`、`PHP`、`Python+Pytorch`、`QWen`、`RDMA`、`RESTful`、`Self-Evolving`
+- `SFTRLHF`、`Spec-Decoding`、`SwiftUI`、`SysML`、`TCN`、`TensorBoard`、`TF`、`TorchScript`
+- `TRT-LLM`、`VAD`、`VGGT`、`VideoMAE`、`ViT`、`WeNet`、`WFST`、`x86`
+- `XLA`、`凸优化`、`因果推断`、`数值计算`、`数学模型`、`数据结构`、`数理统计`、`最优化`
+- `机器学习`、`概率统计`、`概率论`、`特征工程`、`特征提取`、`线性代数`
+
+## 阶段 2：深度学习、Transformer 与生成建模
+
+> 建议节奏：5-8 周。能力模块：6 个。
+
+### 学习目标
+
+掌握现代基础模型共同的表示学习、序列建模和生成建模原理。
+
+### 必学内容
+
+> 能力闭环：原理研究与复现、算法建模与实
```

**File**: `docs/05-roadmaps/embodied-ai-vla-learning-guide.md` (added, +684/-0)
```diff
@@ -0,0 +1,684 @@
+# 具身智能与 VLA 完整学习指南
+
+> 基于已筛选的真实岗位职责、硬要求与加分项整理。生成时间：2026-07-10T12:43:12+08:00。
+
+## 一、如何使用这份指南
+
+这不是术语目录，而是一条以岗位能力为终点的实践路线。每个阶段都包含五件事：
+
+1. **学习目标**：完成后应该具备的能力。
+2. **必学内容**：岗位职责和要求中反复出现的知识。
+3. **实践任务**：必须亲手完成的训练、评测或部署工作。
+4. **可交付成果**：可以放进代码仓库或作品集的产物。
+5. **验收标准**：判断自己是否真正掌握，而不是只看过资料。
+
+建议始终维护一个实验仓库，至少包含：环境配置、数据说明、训练脚本、评测脚本、实验记录、失败案例和复现步骤。每个阶段都在同一个仓库中累积，而不是做完就丢。
+
+## 二、VLA 岗位能力全景
+
+VLA 与具身智能岗位可以拆成八层能力栈：
+
+| 层级 | 核心问题 | 最终需要证明的能力 |
+|---|---|---|
+| 工程基础 | 能否稳定写出和调试训练代码 | Python、PyTorch、Linux、Git、实验管理 |
+| 模型基础 | 是否理解模型为何有效或失败 | 深度学习、Transformer、Diffusion、优化方法 |
+| 多模态基础 | 如何联合视觉、语言、视频与状态 | VLM、对齐、Token 化、跨模态融合 |
+| 动作建模 | 如何从观察和指令生成动作 | Action Head、ACT、Diffusion Policy、自回归策略 |
+| 机器人学习 | 如何让策略从数据和交互中学习 | BC、IL、RL、Offline RL、Policy Learning |
+| 世界模型与决策 | 如何预测、规划并处理长时序任务 | World Model、Model-Based RL、Planning、MPC |
+| 数据与闭环 | 如何持续提升真实任务成功率 | 采集、清洗、配比、评测、bad case、再训练 |
+| 系统与落地 | 如何让模型在仿真和真机稳定运行 | ROS2、Sim2Real、推理优化、分布式训练、部署 |
+
+学习时不要把这八层割裂。一个合格项目应至少打通：数据输入 → 模型训练 → 离线评测 → 仿真闭环 → 失败分析；更完整的项目还应包含真机或受控硬件验证。
+
+## 三、总学习路线
+
+| 阶段 | 建议节奏 | 核心产出 |
+|---|---:|---|
+| 0. 工程环境与实验规范 | 1–2 周 | 可复现的 PyTorch 训练模板 |
+| 1. 深度学习与 Transformer | 4–6 周 | 图像/序列模型训练与消融实验 |
+| 2. LLM、VLM 与多模态对齐 | 4–6 周 | 多模态微调和评测项目 |
+| 3. 机器人基础与仿真 | 4–6 周 | ROS2 + 仿真环境闭环任务 |
+| 4. 模仿学习与策略模型 | 4–6 周 | ACT 或 Diffusion Policy 复现 |
+| 5. VLA 训练全链路 | 6–8 周 | 数据、训练、评测、部署一体化项目 |
+| 6. World Model、RL 与长时序决策 | 4–8 周 | 预测、规划或策略改进实验 |
+| 7. Sim2Real、真机和数据闭环 | 持续进行 | 闭环评测与 bad case 再训练 |
+| 8. 分布式训练与推理优化 | 3–5 周 | 吞吐、显存、延迟优化报告 |
+| 9. 论文复现与作品集 | 持续进行 | 可复现实验、技术报告和演示 |
+
+节奏可以压缩或拉长，但顺序不宜完全颠倒。VLA 的困难通常不在“调用一个现成模型”，而在数据质量、动作表示、评测协议、闭环稳定性和真实系统约束。
+
+## 四、阶段 0：工程环境与实验规范
+
+### 学习目标
+
+- 能独立配置 Linux、Python、CUDA 与 PyTorch 环境。
+- 能编写可恢复、可记录、可比较的训练程序。
+- 能定位数据、梯度、显存、速度和数值稳定性问题。
+- 能为训练平台、推理服务和机器人终端设计可靠的数据与接口层。
+
+### 必学内容
+
+- Python、NumPy、PyTorch、Git、Shell、基础 Docker。
+- Dataset/DataLoader、自动微分、优化器、学习率调度、混合精度。
+- 配置管理、随机种子、断点恢复、日志、指标和实验版本管理。
+- 单元测试、数据检查、梯度检查、profiling 和异常样本定位。
+- RESTful API/RPC 的接口契约、版本、超时、重试、幂等、鉴权和可观测性。
+- MySQL/PostgreSQL、MongoDB/Redis 的数据模型、索引、缓存与大规模多模态元数据查询。
+- Docker/Kubernetes、微服务边界、任务调度、健康检查和故障恢复。
+
+### 实践任务
+
+1. 用 PyTorch 完成一个图像分类或序列预测任务。
+2. 支持配置文件、混合精度、断点恢复、训练日志和独立评测。
+3. 主动制造数据为空、标签越界、梯度爆炸和显存不足问题，并记录定位过程。
+4. 用 FastAPI 实现模型推理 RESTful API，并用 RPC 模拟机器人终端调用；加入超时、重试、幂等键和链路日志。
+5. 为轨迹元数据、实验记录和任务状态设计关系型表与 Redis/MongoDB 查询层，比较索引和缓存前后的延迟。
+
+### 可交付成果
+
+- 一个干净的训练模板仓库。
+- 一份实验复现说明。
+- 一份失败排查手册。
+- API 契约、数据库 schema、负载测试和故障注入报告。
+
+### 验收标准
+
+- 换一台机器后可以按文档完成训练和评测。
+- 同一随机种子能得到可解释的结果波动。
+- 能说明训练慢、显存高或 loss 异常的具体原因。
+- 能证明接口在重复请求、超时和服务重启下不产生重复动作，并能解释数据表、文档库和缓存的选型。
+
+
+### 岗位技术扩展：编程、训练框架与开发环境
+
+- **学习定位：** 掌握级：能独立编写、调试、测试和复现训练代码。
+- **最低实践：** 把同一训练任务分别做成单卡、混合精度、断点恢复和容器化版本，并记录速度、显存和复现误差。
+- **达标标准：** 离开现成 Notebook 后仍能从数据读取开始搭出可维护的训练与评测工程。
+- **本阶段需要覆盖的原文技术：**
+- `c++`、`CUDA`、`Docker`、`FastAPI`、`git`、`Java`、`JAX`、`Kubernetes`、`linux`
+- `MongoDB`、`MySQL`、`PostgreSQL`、`python`、`pytorch`、`Redis`、`RESTful API`、`RPC`、`TensorFlow`
+- `代码`、`工程`、`微服务`、`框架`、`编程`
+
+## 五、阶段 1：深度学习、Transformer 与生成建模
+
+### 学习目标
+
+- 理解视觉、语言和动作序列的共同建模基础。
+- 能读懂并修改 Transformer、Diffusion 和常见视觉编码器代码。
+- 能通过消融实验解释模型设计选择。
+
+### 必学内容
+
+- 线性代数、概率、优化、交叉熵、对比学习和序列建模。
+- CNN、ViT、Attention、Transformer、位置编码和归一化。
+- 自回归建模、VAE/VQ-VAE、Diffusion、Flow Matching。
+- Transfusion、Show-o、Janus-Pro、Cosmos、RynnVLA 等 AR + Generation 统一建模思路。
+- 图学习、图信号处理与跨域迁移学习，理解其在拓扑、关系建模和域泛化中的适用边界。
+- 训练稳定性、数据分布偏移、过拟合、泛化和指标设计。
+
+### 实践任务
+
+1. 从头实现一个小型 Transformer，并用于序列预测。
+2. 训练一个视觉编码器或 ViT，比较不同增强和预训练方式。
+3. 完成一个小型 Diffusion 或 Flow Matching 生成任务。
+4. 为每个实验设计至少一个消融变量，并解释结果。
+5. 选择一个统一生成架构，比较自回归 token 与连续生成目标；再用一个小型图任务验证跨域迁移前后的泛化差异。
+
+### 可交付成果
+
+- Transformer 与生成模型实现。
+- 消融实验表格和结论。
+- 模型失败案例可视化。
+- 统一生成与图迁移实验笔记，明确它们何时值得用于 VLA。
+
+### 验收标准
+
+- 能解释 Attention、Token、位置编码和 Action Chunk 的关系。
+- 能区分自回归动作生成、Diffusion Policy 和 Flow Matching 的主要取舍。
+- 面对训练不稳定时，能提出可验证的排查顺序。
+- 能说明统一生成架构、图学习或跨域迁移给 VLA 带来的收益假设，并用基线验证而不是只复述模型名称。
+
+
+### 岗位技术扩展：深度学习、基础模型与生成建模
+
+- **学习定位：** 掌握级：理解核心结构、损失、训练稳定性和主要架构取舍。
+- **最低实践：** 实现小型 Transformer 与生成模型，完成自回归、Diffusion、Flow Matching 的可控对比。
+- **达标标准：** 能从数据分布、架构和优化三个层面解释模型效果，不只会调用接口。
+- **本阶段需要覆盖的原文技术：**
+- `AR + Generation`、`BERT`、`Cosmos`、`diffusion`、`DINO`、`DINOv2`、`DiT`、`Flow Matching`、`Gemini`
+- `GPT`、`HuggingFace`、`Janus-Pro`、`Llama`、`loss`、`Mamba`、`MoE`、`RWKV`、`RynnVLA`
+- `SAM`、`Show-o`、`Sora`、`transformer`、`Transformers`、`Transfusion`、`ViT`、`VQ-GAN`、`VQ-VAE`
+- `优化`、`图信号处理`、`图学习`、`数学`、`机器学习`、`概率`、`模型`、`深度学习`、`神经网络`
+- `线性代数`、`跨域迁移学习`
+
+## 六、阶段 2：LLM、VLM 与多模态对齐
+
+### 学习目标
+
+- 理解语言、图像、视频和状态信息如何进入统一模型。
+- 能完成 VLM 的数据处理、微调、评测和失败分析。
+- 能解释 VLM 如何成为 VLA 的视觉语言基座。
+
+### 必学内容
+
+- LLM/VLM 基础、Tokenizer、视觉编码器、投影层和跨模态对齐。
+- CLIP 式对比学习、视觉指令微调、图文/视频语言建模。
+- SFT、LoRA/QLoRA、PEFT、数据配比和多模态 batch 构造。
+- 幻觉、时空理解、视觉定位、开放词汇识别和评测设计。
+
+### 实践任务
+
+1. 选择一个开源 VLM，完成领域数据的 SFT 或 LoRA 微调。
+2. 构建包含图像、指令和答案的数据管线。
+3. 建立自动指标与人工错误类型相结合的评测集。
+4. 分析视觉遗漏、语言误解、时序错误和错误推理案例。
+
+### 可交付成果
+
+- 可复现的 VLM 微调脚本。
+- 数据格式与质量规则说明。
+- 评测报告和 bad case 分类。
+
+### 验收标准
+
+- 能说明视觉编码器、语言模型和投影模块分别承担什
```

---

### Incident Patch 9: `7d7781c3` (2026-05-28)
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

### Incident Patch 10: `8ee90de2` (2026-05-28)
**Commit Message**: docs: fill agent guide gaps with project resources

**File**: `README.md` (modified, +89/-90)
```diff
@@ -2,17 +2,17 @@
 [![1764666915027.png](https://free.picui.cn/free/2025/12/02/692eadf2be3ac.png)](https://free.picui.cn/free/2025/12/02/692eadf2be3ac.png)
 
 <div align="center">
-    <img src="https://img.shields.io/badge/Agent-开发指南-blue?style=for-the-badge" alt="Agent开发指南">
-    <img src="https://img.shields.io/badge/面试-求职导向-green?style=for-the-badge" alt="求职导向">
-    <img src="https://img.shields.io/badge/项目-完全开源-orange?style=for-the-badge" alt="完全开源">
+    <img src="https://img.shields.io/badge/Agent-%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97-blue.svg?style=for-the-badge" alt="Agent开发指南">
+    <img src="https://img.shields.io/badge/%E9%9D%A2%E8%AF%95-%E6%B1%82%E8%81%8C%E5%AF%BC%E5%90%91-green.svg?style=for-the-badge" alt="求职导向">
+    <img src="https://img.shields.io/badge/%E9%A1%B9%E7%9B%AE-%E5%AE%8C%E5%85%A8%E5%BC%80%E6%BA%90-orange.svg?style=for-the-badge" alt="完全开源">
     
 <br/>
     
 <a href="https://github.com/adongwanai/AgentGuide">
-        <img src="https://img.shields.io/github/stars/adongwanai/AgentGuide?style=social" alt="stars">
+        <img src="https://img.shields.io/github/stars/adongwanai/AgentGuide.svg?style=for-the-badge&logo=github&label=Stars" alt="GitHub stars">
     </a>
     <a href="https://github.com/adongwanai/AgentGuide/network/members">
-        <img src="https://img.shields.io/github/forks/adongwanai/AgentGuide?style=social" alt="forks">
+        <img src="https://img.shields.io/github/forks/adongwanai/AgentGuide.svg?style=for-the-badge&logo=github&label=Forks" alt="GitHub forks">
     </a>
     
 <br/>
@@ -39,95 +39,12 @@
 >
 > 💪 **AgentGuide 的独特价值**：不是简单的资源堆砌，而是**系统化 + 求职导向 + 实战验证**的完整解决方案！
 
----
-
-## 🧭 Agent 求职通关 Todo List（新增）
-
-> **不是链接收藏夹，是可以照着执行的 todo list。**
->
-> 目标很简单：从“我学过什么”，推进到“我做出了什么、怎么验证、怎么写进简历、怎么讲给面试官听”。
-
-- 完整路线：[2026 Agent 求职通关路线](./docs/05-roadmaps/agent-job-ready-roadmap-2026.md)
-- 项目落地方法：[如何落地一个可写进简历的 Agent 项目](./docs/03-practice/05-ship-agent-project.md)
-- 工程核心专题：[Agent Harness Engineering](./docs/02-tech-stack/27-agent-harness-engineering.md)
-
-### How To Use
-
-| 你的状态 | 建议入口 |
-|:---|:---|
-| **零基础** | 从 [6步学习路径](#-从零到offer的完整路径快速导航) 开始，先建立 Agent / Workflow / RAG / Multi-Agent 的坐标系 |
-| **会 LLM 应用** | 重点补 Agent Loop、Tool Use、Context Engineering、Eval，不要只停留在 API 调用 |
-| **想做项目** | 直接进入 [实战项目](#-第四步完成实战项目可写进简历)，按“Spec → Coding → Eval → 复盘”推进 |
-| **准备面试** | 对照 [面试题库](#-第六步面试准备与-offer-冲刺)，重点准备 Agent Loop、工具设计、记忆、评测、可靠性 |
-| **只想找资料** | 看 [技术教程](#-第五步系统学习-agent-技术技术准备) 和 [资源导航](#-资源导航)，优先读官方文档、工程博客和可运行项目 |
-
-### What To Learn Now
-
-Agent 方向变化很快，当前更值得投入的是能落地、能验证、能讲清楚取舍的工程能力：
-
-| 优先级 | 方向 | 为什么重要 |
-|:---:|:---|:---|
-| 1 | **Claude Code / Codex-style Coding Agents** | 真实代码库、shell、文件编辑、测试、权限、上下文压缩，是理解 Agent 工程的最佳样本 |
-| 2 | **Agent Harness Engineering** | Agent 能力很大一部分来自 harness：工具协议、权限、状态、反馈、回放、CI、评测 |
-| 3 | **Context Engineering** | Agent 的核心不是“写提示词”，而是控制信息在正确时间以正确格式进入模型 |
-| 4 | **Skills / MCP / A2A / ACP** | Skills 负责能力复用，MCP 连接工具，A2A 连接 Agent，ACP 连接宿主应用 |
-| 5 | **Browser / Computer-Use Agents** | 浏览器和桌面操作是 Agent 从 demo 走向真实任务的重要边界 |
-| 6 | **Evaluation / Observability / Safety** | 没有 eval、trace、权限边界的 Agent，只能算 demo，不能算可交付系统 |
-
-### 8 阶段学习产出
-
-| 阶段 | 学什么 | 产出物 |
-|:---:|:---|:---|
-| Stage 0 | 区分 chatbot、workflow、agent、multi-agent | 一页笔记：为什么你的场景需要 Agent |
-| Stage 1 | 最小 Agent Loop、结构化输出、工具调用 | 50-150 行最小 Agent |
-| Stage 2 | Tool Use、RAG、Memory、引用与失败处理 | 一个资料研究助手 |
-| Stage 3 | 现代 Agent Harness：工具、权限、状态、日志、子任务 | 可调试的 harness demo |
-| Stage 4 | Multi-Agent 协调：planner / executor / reviewer / router | 一个 research → write → review 小系统 |
-| Stage 5 | Skills、MCP、A2A、ACP 与能力封装 | 一个可复用 SKILL.md 或工具协议 demo |
-| Stage 6 | Browser / Computer-Use Agent | 一个只操作公开网页的 browser agent |
-| Stage 7-8 | Eval、Observability、Safety、部署 | 20 条 eval case + 一个别人能 clone 跑的 Agent 项目 |
-
-### 项目落地 5 步法
-
-1. **建立全局认知**：先搞清楚目标项目的 agent loop、tool registry、context 拼装、memory、channel 抽象。
-2. **准备 AI 编程环境**：沉淀 `CLAUDE.md` / `AGENTS.md`、需求规格、实现计划和跨会话 todo。
-3. **建立项目理解 Skill**：把项目结构、关键模块、测试方式写成可复用的项目理解文档。
-4. **先写 Spec，再写代码**：明确目标用户、工具列表、权限策略、失败处理、成本约束、成功标准。
-5. **评测 + 归因 + 消融实验**：记录通过率、失败原因、工具调用次数、成本、延迟，把结果写进简历。
-
-### 面试深水区
-
-面试不只问“会不会 LangChain”，更会追问你有没有真正写过能跑的 Agent：
-
-- **Agent Loop**：`observe → think → act → observe`，最大步数、停止条件、错误恢复、HITL 怎么设计？
-- **Context + Cost Engineering**：上下文分层、压缩、缓存友好结构、模型路由、token 成本怎么降？
-- **Tool Design**：工具命名、description、schema、分页截断、权限分级、工具选错怎么修？
-- **Memory System**：working / episodic / semantic memory，什么值得存、怎么召回、什么时候遗忘？
-- **Eval + Governance**：component / trajectory / end-to-end eval，golden dataset 怎么来，trace 怎么审计？
-- **Reliability Engineering**：idempotency、timeout、retry、cost guard、permission tier、observability 六件套。
-
-### 简历三维表达法
-
-不要只写“基于大模型实现智能问答”。一个 Agent 项目要从三维表达：
-
-| 维度 | 怎么写 |
-|:---|:---|
-| **架构表达** | Agent loop、工具注册、会话状态、上下文裁剪、权限确认、记忆和错误恢复 |
-| **业务表达** | 业务场景、关键工具、数据源、用户路径、约束条件 |
-| **结果表达** | 评测集规模、成功率、失败类型、成本优化、消融实验结论 |
-
-示例：
-
-> 基于轻量 Agent Harness 构建垂直场景助手，使用 ReAct loop + dispatch 表注册 5 个业务工具，四层分级 context 管理 system / long-te
```

**File**: `data/resources.json` (modified, +780/-636)
```diff
@@ -1,62 +1,38 @@
 [
-  {
-    "id": "ai-agent",
-    "title": "AI Agent 开发工程师学习路线图（工程落地版）",
-    "description": "> **目标岗位**：AI Agent 开发工程师（应用型、工程型） > **学习时长**：8 周（全职投入） > **最终产出**：2-3 个生产级、可部署的 Agent 系统 + 完整的全栈技术能力",
-    "category": "路线",
-    "tags": [],
-    "level": "入门",
-    "type": "路线",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/05-roadmaps/learning-roadmap-development.md",
-    "date": "2026-05-28",
-    "featured": false
-  },
   {
     "id": "agent",
-    "title": "🚀 大模型 / Agent 全栈学习路线",
-    "description": "<img src=\"https://youke1.picui.cn/s1/2025/12/03/692f10fac4dcf.png\" height=\"700\" alt=\"从零到Offer的完整路径\">",
-    "category": "路线",
+    "title": "Agent 评估指标体系",
+    "description": "> 没有评测的 Agent 只能算 demo。Agent 评估不仅看最终答案，还要看路径、工具、证据、安全、成本和可恢复性。",
+    "category": "理论",
     "tags": [],
     "level": "入门",
-    "type": "路线",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/05-roadmaps/AgentGuide开源学习路线（简易版本）.md",
-    "date": "2026-05-28",
+    "type": "教程",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/01-theory/09-evaluation-metrics.md",
+    "date": "2026-05-29",
     "featured": false
   },
   {
-    "id": "2026-agent",
-    "title": "2026 Agent 求职通关路线",
-    "description": "> 这是一条面向求职和项目落地的 Agent 学习路线。目标不是收藏更多链接，而是一步步做出能验证、能演示、能写进简历的作品。",
-    "category": "路线",
+    "id": "react",
+    "title": "手撕 ReAct 框架",
+    "description": "> ReAct = Reasoning + Acting。它让模型在推理和行动之间交替：先判断下一步，再调用工具，再根据观察结果继续。",
+    "category": "理论",
     "tags": [],
     "level": "入门",
-    "type": "路线",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/05-roadmaps/agent-job-ready-roadmap-2026.md",
-    "date": "2026-05-28",
+    "type": "教程",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/01-theory/04-react-framework.md",
+    "date": "2026-05-29",
     "featured": false
   },
   {
     "id": "ai-agent",
-    "title": "AI Agent 算法工程师学习路线图（研究型）",
-    "description": "> **目标岗位**：AI Agent 算法工程师（研究/创新型） > **学习时长**：9 周（全职投入） > **最终产出**：1-2 个算法创新型项目 + 1 篇高质量论文/高星开源项目",
-    "category": "路线",
-    "tags": [],
-    "level": "入门",
-    "type": "路线",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/05-roadmaps/learning-roadmap-algorithm.md",
-    "date": "2026-05-28",
-    "featured": false
-  },
-  {
-    "id": "",
-    "title": "毕业设计选题指南",
-    "description": "> 🚧 本文档正在编写中，敬请期待...",
-    "category": "实战",
+    "title": "什么是 AI Agent？",
+    "description": "> AI Agent 是一个能在给定目标和约束下，观察环境、选择动作、调用工具、接收反馈，并持续推进任务的软件系统。",
+    "category": "理论",
     "tags": [],
     "level": "入门",
     "type": "教程",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/03-practice/04-graduation-project.md",
-    "date": "2026-05-28",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/01-theory/01-what-is-agent.md",
+    "date": "2026-05-29",
     "featured": false
   },
   {
@@ -68,967 +44,1111 @@
     "level": "入门",
     "type": "教程",
     "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/03-practice/05-ship-agent-project.md",
-    "date": "2026-05-28",
+    "date": "2026-05-29",
     "featured": false
   },
   {
     "id": "agent",
     "title": "Agent 安全防护",
-    "description": "> 🚧 本文档正在编写中，敬请期待...",
+    "description": "> Agent 安全的核心原则：模型可以建议，系统负责授权；工具结果是数据，不是指令；高风险动作必须可审计、可确认、可回滚。",
     "category": "实战",
     "tags": [],
     "level": "入门",
     "type": "教程",
     "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/03-practice/03-agent-security.md",
-    "date": "2026-05-28",
+    "date": "2026-05-29",
     "featured": false
   },
   {
-    "id": "rag",
-    "title": "高可用 RAG 系统实战",
-    "description": "> 🚧 本文档正在编写中，敬请期待...",
-    "category": "实战",
+    "id": "ai-agent",
+    "title": "AI Agent 项目讲述技巧",
+    "description": "> 面试讲项目不是背简历，而是证明你能定义问题、设计系统、处理失败并持续优化。",
+    "category": "求职",
     "tags": [],
     "level": "入门",
-    "type": "教程",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/03-practice/02-high-availability-rag.md",
-    "date": "2026-05-28",
+    "type": "指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/13-storytelling.md",
+    "date": "2026-05-29",
     "featured": false
   },
   {
-    "id": "agent",
-    "title": "从零构建 Agent 框架",
-    "description": "> 🚧 本文档正在编写中，敬请期待...",
-    "category": "Agent",
+    "id": "ai-agent",
+    "title": "AI Agent 简历编写指南",
+    "description": "> 简历不是经历流水账，而是让面试官相信你能从 0 到 1 交付 Agent 系统的证据链。",
+    "category": "求职",
     "tags": [],
     "level": "入门",
-    "type": "教程",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/02-tech-stack/22-build-your-agent-framework.md",
-    "date": "2026-05-28",
+    "type": "指南",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/12-resume-guide.md",
+    "date": "2026-05-29",
     "featured": false
   },
   {
-    "id": "openclaw-agent",
-    "title": "OpenCl
```

**File**: `docs/00-getting-started/01-agent-map.md` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+# Agent Learning Map：Agent 学习地图
+
+> Agent 不是一个库名，而是一类系统设计：模型在受控环境里观察状态、选择动作、调用工具、接收反馈，并在必要时请求人类介入。
+
+## 先分清 5 个概念
+
+| 概念 | 核心特征 | 典型例子 | 什么时候用 |
+|:---|:---|:---|:---|
+| Chatbot | 单轮或多轮对话，主要输出文本 | FAQ、客服问答 | 任务只需要回答，不需要行动 |
+| Workflow | 固定流程，LLM 是某些步骤的组件 | 分类 -> 检索 -> 生成 -> 审核 | 步骤清晰、成功标准明确 |
+| Agent | 模型自主选择下一步动作 | 研究助手、代码修复助手 | 任务开放，需要多步探索 |
+| Multi-Agent | 多个角色协作，带协调器或消息协议 | 研究员 + 编写者 + 审稿人 | 单个角色职责过宽，需要分工 |
+| Computer-Use Agent | 操作浏览器、桌面、终端或文件系统 | WebArena、OSWorld、coding agent | 任务必须进入真实软件环境 |
+
+Anthropic 的实践建议很朴素：先从最简单的方案开始，只有当固定 workflow 不足以覆盖任务分支时，再引入更自主的 agent loop。这个判断很关键，因为 Agent 的能力来自工具、环境和评测，而不只是更复杂的框架。
+
+## Agent 的 7 个核心模块
+
+| 模块 | 你要能回答的问题 | 常见坑 |
+|:---|:---|:---|
+| Goal | 任务成功是什么样？失败边界是什么？ | 只写“帮我完成任务”，没有验收标准 |
+| State | 当前任务状态、历史、工作区文件放哪里？ | 只依赖聊天历史，长任务一压缩就丢线索 |
+| Context | 哪些信息进入模型？顺序和格式是什么？ | 把所有资料塞进上下文，导致干扰和成本暴涨 |
+| Tools | 工具有哪些？schema、权限、错误如何描述？ | 工具名含糊、返回值太长、没有分页和重试 |
+| Loop | 最大步数、停止条件、反思、恢复怎么做？ | 无限循环或过早停止 |
+| Guardrails | 哪些动作需要确认？哪些输入不可信？ | 让模型自己决定安全边界 |
+| Eval | 怎么证明它真的完成任务？ | 只有演示视频，没有可重复评测集 |
+
+## 三条学习路线
+
+### 路线 A：工程落地方向
+
+目标是做出能交付的 Agent 应用。重点学：
+
+- LangGraph 的状态、持久执行和 human-in-the-loop
+- OpenAI Agents SDK 的 handoff、guardrail、tracing
+- Pydantic AI 的类型约束、结构化输出和依赖注入
+- Promptfoo、DeepEval、Inspect 这类 eval harness
+- OWASP LLM Top 10、MCP Top 10、最小权限和审计日志
+
+适合项目：旅行规划 Agent、企业知识库 Agent、客服流程 Agent。
+
+### 路线 B：研究与算法方向
+
+目标是理解 Agent 为什么成功或失败。重点学：
+
+- ReAct、Plan-and-Solve、Reflection、Tree Search
+- WebArena、OSWorld、GAIA、SWE-bench 等 benchmark
+- Tool-use 数据集、轨迹评分、LLM-as-judge 校准
+- RAG / multimodal RAG / memory 的消融实验
+- Agent RL、过程奖励、失败轨迹复盘
+
+适合项目：论文研读 Agent、Web Agent 评测、RAG 检索策略对比。
+
+### 路线 C：求职作品方向
+
+目标是做出能写进简历、能在面试里讲清楚的项目。重点不是“用了什么框架”，而是：
+
+- 用户是谁，任务为什么需要 Agent
+- 工具如何设计，权限如何分级
+- 上下文如何管理，成本如何控制
+- 评测集怎么构造，失败原因是什么
+- 项目如何部署，别人能否 clone 运行
+
+适合项目：`projects/01-paper-agent`、`projects/02-travel-agent`、`projects/03-web-agent`。
+
+## 框架怎么选
+
+| 场景 | 首选 | 理由 |
+|:---|:---|:---|
+| 学 agent loop 基础 | 原生 API + 50 行工具循环 | 能看清 observe -> act -> observe |
+| 复杂状态流 | LangGraph | 状态图、持久执行、恢复、人类审核都比较成熟 |
+| OpenAI 生态 | OpenAI Agents SDK | handoff、guardrails、tracing 是一等概念 |
+| 类型安全 Python 应用 | Pydantic AI | Pydantic 风格，结构化输出和依赖注入舒服 |
+| 多角色协作 demo | AutoGen / CrewAI | 快速搭建 planner、executor、reviewer 分工 |
+| 数据密集 RAG | LlamaIndex | 数据连接器、索引、检索和 workflow 生态较完整 |
+
+## 一个判断标准
+
+只要你的系统会让模型调用工具，你就要同步设计评测和安全边界。没有 eval 的 Agent 是 demo；没有权限边界的 Agent 是风险源；没有 trace 的 Agent 很难调试。
+
+## 延伸阅读
+
+- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
+- [OpenAI: A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
+- [LangGraph GitHub](https://github.com/langchain-ai/langgraph)
+- [OpenAI Agents SDK](https://platform.openai.com/docs/guides/agents-sdk/)
+- [Pydantic AI GitHub](https://github.com/pydantic/pydantic-ai)
+- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications)
```

**File**: `docs/00-getting-started/02-first-7-days.md` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+# First 7 Days：前 7 天学习计划
+
+> 这不是“收藏 100 个链接”的计划，而是一周内做出最小 Agent 项目骨架的执行清单。
+
+## Day 1：建立边界
+
+**学习目标**：区分 chatbot、workflow、agent、multi-agent。
+
+**阅读**：
+
+- [Agent 学习地图](./01-agent-map.md)
+- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
+
+**产出**：
+
+- 写一页笔记：你的目标项目为什么需要 Agent，而不是普通 workflow。
+- 画出最小流程：输入、工具、输出、失败边界。
+
+## Day 2：手写最小 Agent Loop
+
+**学习目标**：理解 observe -> think -> act -> observe。
+
+**任务**：
+
+- 只接 2 个工具：`search_notes(query)`、`write_summary(text)`。
+- 限制最大 5 步。
+- 每一步写入 JSONL trace：`step`、`thought_summary`、`tool`、`args`、`observation`、`cost_estimate`。
+
+**验收**：
+
+- 能处理 5 条固定任务。
+- 出错时不崩溃，返回可读失败原因。
+
+## Day 3：工具设计
+
+**学习目标**：让工具变得“模型友好”。
+
+**阅读**：
+
+- [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
+
+**任务**：
+
+- 给每个工具补：名称、使用场景、参数 schema、返回结构、错误码、示例。
+- 增加分页、截断、重试和 timeout。
+- 把高风险工具标成 `requires_confirmation`。
+
+**验收**：
+
+- 工具返回不超过模型真正需要的内容。
+- 错误信息能指导下一步动作。
+
+## Day 4：上下文工程
+
+**学习目标**：控制什么进入模型。
+
+**任务**：
+
+- 把 context 分成 5 层：system、task、memory、retrieved evidence、recent trace。
+- 做一个 context builder，把每层内容结构化输出。
+- 对长工具结果只保留摘要和可追溯引用。
+
+**验收**：
+
+- 同一任务重复运行时，prompt 结构稳定。
+- 不把完整日志、完整网页、完整 PDF 直接塞进模型。
+
+## Day 5：评测集
+
+**学习目标**：从“感觉能用”变成“可测量”。
+
+**任务**：
+
+- 写 20 条 eval case：10 条正常任务、5 条边界任务、5 条安全/失败任务。
+- 每条包含：输入、期望行为、禁止行为、评分方式。
+- 记录通过率、平均步数、失败原因、人工修复建议。
+
+**可选工具**：
+
+- [Promptfoo](https://github.com/promptfoo/promptfoo)：适合 prompt、RAG、agent 回归测试和红队测试。
+- [DeepEval](https://github.com/confident-ai/deepeval)：适合 pytest 风格的 LLM/Agent 单元测试。
+- [Inspect](https://inspect.aisi.org.uk/)：适合更严肃的模型能力与安全评测。
+
+## Day 6：项目化包装
+
+**学习目标**：让别人能 clone、运行、理解。
+
+**任务**：
+
+- 写 `README.md`：项目目标、架构、安装、运行、测试、限制。
+- 写 `eval_report.md`：评测数据、失败类型、改进计划。
+- 写 `demo_script.md`：面试或路演时怎么演示。
+
+**验收**：
+
+- 新机器按 README 能跑通最小 demo。
+- 面试官能从 README 看出你做的不只是 API wrapper。
+
+## Day 7：复盘与简历表达
+
+**学习目标**：把项目变成可讲述的工程经验。
+
+**任务**：
+
+- 做一次失败归因：工具失败、检索失败、模型误判、权限不足、上下文污染分别占多少。
+- 写一段简历 bullet，包含架构、场景、指标。
+
+**模板**：
+
+> 构建面向 X 场景的 Agent 系统，采用 ReAct loop + 工具注册表 + 分层 context builder，接入 N 个外部工具并对高风险动作设置 human-in-the-loop；设计 20 条端到端 eval case，任务成功率达到 X%，通过工具结果截断和模型路由将平均成本降低 X%。
+
+## 一周结束后继续做什么
+
+- 做论文方向：进入 [Paper Agent 项目蓝图](../../projects/01-paper-agent/README.md)。
+- 做生活/业务方向：进入 [Travel Agent 项目蓝图](../../projects/02-travel-agent/README.md)。
+- 做浏览器方向：进入 [Web Agent 项目蓝图](../../projects/03-web-agent/README.md)。
+- 做资料型项目：进入 [多模态 RAG 资源](../../resources/multimodal/README.md)。
```

**File**: `docs/00-getting-started/03-resource-quality-checklist.md` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+# Resource Quality Checklist：高质量资源筛选清单
+
+> Agent 资料很多，但真正值得花时间的资源通常有共同特征：可运行、可验证、可追溯、能解释失败。
+
+## GitHub 项目筛选
+
+| 维度 | 高质量信号 | 低质量信号 |
+|:---|:---|:---|
+| 可运行性 | 有明确安装、环境变量、demo、测试命令 | 只有截图和口号 |
+| 维护状态 | 最近仍有 commit / issue / release | 长期无人维护，依赖版本锁死 |
+| 架构透明 | README 解释 agent loop、工具、状态、eval | 只写“multi-agent powered by GPT” |
+| 工具边界 | 工具 schema 清晰，权限和错误处理明确 | 工具直接执行任意 shell/API |
+| 评测 | 有 benchmark、eval case、失败分析 | 只有单次 demo 成功 |
+| 安全 | 有 sandbox、human approval、secret 管理 | 要求把高权限 key 放进 prompt 或前端 |
+| 可复用 | 模块化，能替换模型和工具 | 所有逻辑堆在一个 notebook |
+
+## 教程筛选
+
+优先读这些类型：
+
+- 官方文档：OpenAI Agents SDK、LangGraph、Pydantic AI、MCP。
+- 工程博客：解释为什么这样设计，而不是只贴代码。
+- 可运行 cookbook：有完整依赖、输入、输出和测试方式。
+- 论文配套代码：能复现实验或至少提供数据/脚本。
+
+谨慎对待这些类型：
+
+- “10 分钟实现 AutoGPT”但没有失败处理。
+- “生产级 Agent”但没有 trace、eval、权限分级。
+- “全自动赚钱/投递/下单”但没有法律和安全边界。
+- 只堆框架名，不解释 trade-off。
+
+## 论文筛选
+
+| 问题 | 为什么重要 |
+|:---|:---|
+| 任务定义是否清楚？ | Agent 论文很容易把开放任务写得漂亮但不可复现 |
+| 环境是否可复现？ | Web、OS、工具 API 会变化，benchmark 必须控制漂移 |
+| 指标是否只看最终成功率？ | 还要看步数、成本、延迟、错误类型、人工介入次数 |
+| 是否有消融实验？ | 没有消融就很难知道是模型强，还是框架设计有效 |
+| 是否报告失败案例？ | Agent 的失败模式比成功样例更有学习价值 |
+| 是否开源代码/数据？ | 不能复现就只能当思路参考 |
+
+## 项目是否值得写进简历
+
+满足下面 8 条中的 6 条，就值得继续打磨：
+
+- 有明确用户和业务场景。
+- 有至少 3 个真实工具，不是 mock 全流程。
+- 有可追踪 trace 或日志。
+- 有 20 条以上 eval case。
+- 有失败类型统计。
+- 有权限/安全设计。
+- 有部署或一键运行说明。
+- 有对比实验，比如有无 RAG、有无 rerank、有无 memory。
+
+## 推荐优先资源
+
+### Agent 架构
+
+- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
+- [OpenAI Agents SDK](https://platform.openai.com/docs/guides/agents-sdk/)
+- [LangGraph](https://github.com/langchain-ai/langgraph)
+- [Pydantic AI](https://github.com/pydantic/pydantic-ai)
+- [Microsoft AutoGen](https://github.com/microsoft/autogen)
+
+### 工具与协议
+
+- [Model Context Protocol](https://github.com/modelcontextprotocol/modelcontextprotocol)
+- [OpenAI Swarm](https://github.com/openai/swarm)
+- [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
+
+### 评测与安全
+
+- [Promptfoo](https://github.com/promptfoo/promptfoo)
+- [DeepEval](https://github.com/confident-ai/deepeval)
+- [Inspect](https://inspect.aisi.org.uk/)
+- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications)
+- [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/)
+
+### 多模态与文档处理
+
+- [Docling](https://github.com/docling-project/docling)
+- [MinerU](https://github.com/opendatalab/MinerU)
+- [RAG-Anything](https://github.com/HKUDS/RAG-Anything)
+- [ColPali paper](https://arxiv.org/abs/2407.01449)
+
+## 最后一句判断
+
+好资源会让你更快回答“为什么这么设计、失败时怎么查、指标怎么证明”；差资源只会让你复制更多样板代码。
```

**File**: `docs/00-getting-started/04-repo-gap-map.md` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+# Repo Gap Map：仓库补洞地图
+
+> 本文记录对当前仓库空目录和占位内容的盘点，并给出后续补充优先级。
+
+## 本次发现的空目录
+
+| 目录 | 状态 | 建议补充 | 本次处理 |
+|:---|:---|:---|:---|
+| `docs/00-getting-started` | 空 | 新手入口、学习地图、7 天计划、资源筛选清单 | 已补 |
+| `examples` | 空 | 最小 agent loop、eval 模板、trace 样例 | 已补 |
+| `projects/01-paper-agent` | 空 | 论文研读 Agent 项目蓝图 | 已补 |
+| `projects/02-travel-agent` | 空 | 旅行规划 Agent 项目蓝图 | 已补 |
+| `projects/03-web-agent` | 空 | 浏览器/Web Agent 项目蓝图 | 已补 |
+| `resources/multimodal` | 空 | 多模态 RAG、文档解析、视觉检索资源 | 已补 |
+| `.trae/documents` | 工具隐藏目录 | IDE/工具私有文档，不建议放公开正文 | 暂不处理 |
+| `.vercel` | 部署隐藏目录 | Vercel 本地链接信息，不建议手动填内容 | 暂不处理 |
+
+## 仍值得继续补的占位文档
+
+这些文件不在空目录里，但内容仍是 placeholder，后续优先级较高：
+
+| 优先级 | 文件 | 推荐方向 |
+|:---:|:---|:---|
+| P0 | `docs/01-theory/01-what-is-agent.md` | Agent 定义、能力分级、与 workflow 的区别 |
+| P0 | `docs/01-theory/04-react-framework.md` | ReAct 原理、最小实现、失败模式 |
+| P0 | `docs/01-theory/05-cot-and-planning.md` | CoT、Plan-and-Solve、树搜索、反思 |
+| P0 | `docs/01-theory/09-evaluation-metrics.md` | 任务成功率、轨迹评分、成本、延迟、安全指标 |
+| P1 | `docs/02-tech-stack/04-langchain-guide.md` | LangChain 与 LangGraph 的边界，现代用法 |
+| P1 | `docs/02-tech-stack/06-multi-agent-frameworks.md` | AutoGen、CrewAI、Swarm、Magentic-One 对比 |
+| P1 | `docs/02-tech-stack/14-mcp-protocol.md` | MCP 架构、server/client、权限和安全 |
+| P1 | `docs/02-tech-stack/20-rag-full-pipeline.md` | 文档解析、chunk、embedding、rerank、eval |
+| P1 | `docs/02-tech-stack/22-build-your-agent-framework.md` | 从零手写 agent loop、tool registry、trace |
+| P2 | `docs/03-practice/02-high-availability-rag.md` | 生产级 RAG 可用性、缓存、降级、监控 |
+| P2 | `docs/03-practice/03-agent-security.md` | Prompt injection、权限、sandbox、secret 管理 |
+| P2 | `docs/03-practice/04-graduation-project.md` | 毕设选题、范围控制、评测和论文写法 |
+
+## 后续补内容的原则
+
+1. **先入口，再深水区**：新手先能跑通 1 个项目，再读大量框架细节。
+2. **先项目，再资源堆叠**：每个资源最好能服务一个具体项目。
+3. **先一手来源**：官方文档、论文、GitHub README 优先，二手博客只做补充。
+4. **每篇文档都要有产出物**：笔记、代码、评测集、架构图、简历 bullet 至少一个。
+5. **避免只写概念**：AgentGuide 的定位是求职和实战导向，文档必须能指导动手。
+
+## 推荐下一轮补充
+
+最值得下一轮完成的是：
+
+1. `docs/01-theory/01-what-is-agent.md`
+2. `docs/01-theory/04-react-framework.md`
+3. `docs/02-tech-stack/14-mcp-protocol.md`
+4. `docs/03-practice/03-agent-security.md`
+
+这四篇补完后，仓库会形成“概念 -> loop -> 协议 -> 安全 -> 项目”的更完整闭环。
```

**File**: `docs/00-getting-started/README.md` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+# AgentGuide 快速开始
+
+> 目标：用最短路径建立 AI Agent 的全局认知，并把学习推进到“能做项目、能评测、能写进简历”。
+
+很多人学 Agent 会卡在两个地方：一是把 Agent 当成“更长的 prompt”，二是看了一堆框架教程却没有可验证产出。这个目录负责解决第一公里问题：先建立地图，再动手做最小项目，最后用评测和复盘把项目变成作品。
+
+## 入口顺序
+
+| 顺序 | 文档 | 你会得到什么 |
+|:---:|:---|:---|
+| 1 | [Agent 学习地图](./01-agent-map.md) | 区分 chatbot、workflow、agent、multi-agent、coding agent、computer-use agent |
+| 2 | [前 7 天学习计划](./02-first-7-days.md) | 每天学什么、做什么、交付什么 |
+| 3 | [高质量资源筛选清单](./03-resource-quality-checklist.md) | 判断一个 GitHub 项目/教程/论文是否值得投入时间 |
+| 4 | [仓库补洞地图](./04-repo-gap-map.md) | 本仓库当前空目录和后续可补内容优先级 |
+
+## 一张图看学习路径
+
+![Agent 学习地图](./agent-learning-map.svg)
+
+## 最小闭环
+
+新手不要一上来追求“全自动通用 Agent”。更稳的闭环是：
+
+1. **先做 workflow**：固定步骤，少量工具，明确输入输出。
+2. **再加 agent loop**：让模型在有限步数内决定下一步工具调用。
+3. **补 trace 和 eval**：记录每一步，并用 20 条 case 评估成功率。
+4. **最后做项目包装**：写 README、架构图、失败分析和简历表达。
+
+## 必读外部资料
+
+- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)：非常适合建立 workflow 和 agent 的边界感。
+- [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)：工具设计比“多接几个 API”重要得多。
+- [OpenAI Agents SDK](https://platform.openai.com/docs/guides/agents-sdk/)：学习 handoff、guardrail、tracing 等生产化概念。
+- [LangGraph](https://github.com/langchain-ai/langgraph)：学习持久执行、状态图、人类审核和长任务恢复。
+- [Model Context Protocol](https://github.com/modelcontextprotocol/modelcontextprotocol)：理解 Agent 如何标准化连接外部工具和数据源。
+
+## 本目录适合谁
+
+- 完全新手：先读 `01-agent-map.md`，不要急着装框架。
+- 已会 API 调用：直接读 `02-first-7-days.md`，把 toy demo 推到有 eval 的项目。
+- 准备求职：重点读 `03-resource-quality-checklist.md` 和 `projects/` 下三个项目蓝图。
+- 仓库维护者：读 `04-repo-gap-map.md`，按优先级继续补空缺内容。
```

**File**: `docs/00-getting-started/agent-learning-map.svg` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+<svg viewBox="0 0 1120 720" xmlns="http://www.w3.org/2000/svg">
+  <style>
+    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&amp;display=swap');
+    text { font-family: 'JetBrains Mono', 'Noto Sans SC', 'PingFang SC', sans-serif; }
+    .title { fill: #f8fafc; font-size: 20px; font-weight: 700; }
+    .subtitle { fill: #94a3b8; font-size: 11px; }
+    .box-title { fill: #ffffff; font-size: 13px; font-weight: 700; text-anchor: middle; }
+    .box-sub { fill: #cbd5e1; font-size: 10px; text-anchor: middle; }
+    .small { fill: #94a3b8; font-size: 9px; text-anchor: middle; }
+    .label { fill: #e2e8f0; font-size: 10px; font-weight: 600; text-anchor: middle; }
+    .note { fill: #cbd5e1; font-size: 10px; }
+  </style>
+  <defs>
+    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
+      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5"/>
+    </pattern>
+    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
+      <polygon points="0 0, 10 3.5, 0 7" fill="#64748b"/>
+    </marker>
+    <marker id="arrow-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
+      <polygon points="0 0, 10 3.5, 0 7" fill="#22d3ee"/>
+    </marker>
+    <marker id="arrow-emerald" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
+      <polygon points="0 0, 10 3.5, 0 7" fill="#34d399"/>
+    </marker>
+  </defs>
+  <rect width="1120" height="720" fill="#0f172a"/>
+  <rect width="1120" height="720" fill="url(#grid)"/>
+
+  <text x="40" y="46" class="title">AgentGuide Learning Map</text>
+  <text x="40" y="66" class="subtitle">从概念认知到项目交付：workflow -> agent loop -> tools -> context -> eval -> resume</text>
+
+  <rect x="40" y="104" width="1040" height="196" rx="12" fill="none" stroke="#22d3ee" stroke-width="1" stroke-dasharray="8,4"/>
+  <text x="58" y="126" fill="#22d3ee" font-size="11" font-weight="700">Stage 0-2: 建立最小闭环</text>
+
+  <g>
+    <rect x="80" y="160" width="160" height="76" rx="6" fill="#0f172a"/>
+    <rect x="80" y="160" width="160" height="76" rx="6" fill="rgba(8,51,68,0.42)" stroke="#22d3ee" stroke-width="1.5"/>
+    <text x="160" y="190" class="box-title">Concept Map</text>
+    <text x="160" y="209" class="box-sub">chatbot / workflow / agent</text>
+  </g>
+  <g>
+    <rect x="300" y="160" width="160" height="76" rx="6" fill="#0f172a"/>
+    <rect x="300" y="160" width="160" height="76" rx="6" fill="rgba(6,78,59,0.42)" stroke="#34d399" stroke-width="1.5"/>
+    <text x="380" y="190" class="box-title">Minimal Loop</text>
+    <text x="380" y="209" class="box-sub">observe -> act -> observe</text>
+  </g>
+  <g>
+    <rect x="520" y="160" width="160" height="76" rx="6" fill="#0f172a"/>
+    <rect x="520" y="160" width="160" height="76" rx="6" fill="rgba(120,53,15,0.32)" stroke="#fbbf24" stroke-width="1.5"/>
+    <text x="600" y="190" class="box-title">Tool Design</text>
+    <text x="600" y="209" class="box-sub">schema / errors / permission</text>
+  </g>
+  <g>
+    <rect x="740" y="160" width="160" height="76" rx="6" fill="#0f172a"/>
+    <rect x="740" y="160" width="160" height="76" rx="6" fill="rgba(76,29,149,0.42)" stroke="#a78bfa" stroke-width="1.5"/>
+    <text x="820" y="190" class="box-title">Context</text>
+    <text x="820" y="209" class="box-sub">state / memory / retrieval</text>
+  </g>
+
+  <path d="M 245 198 L 292 198" stroke="#64748b" stroke-width="1.6" marker-end="url(#arrow)"/>
+  <path d="M 465 198 L 512 198" stroke="#64748b" stroke-width="1.6" marker-end="url(#arrow)"/>
+  <path d="M 685 198 L 732 198" stroke="#64748b" stroke-width="1.6" marker-end="url(#arrow)"/>
+
+  <rect x="40" y="340" width="1040" height="226" rx="12" fill="none" stroke="#34d399" stroke-width="1" stroke-dasharray="8,4"/>
+  <text x="58" y="362" fill="#34d399" font-size="11" font-weight="700">Stage 3-6: 做成可展示项目</text>
+
+  <g>
+    <rect x="94" y="408" width="180" height="86" rx="6" fill="#0f172a"/>
+    <rect x="94" y="408" width="180" height="86" rx="6" fill="rgba(59,130,246,0.32)" stroke="#60a5fa" stroke-width="1.5"/>
+    <text x="184" y="438" class="box-title">Trace & Replay</text>
+    <text x="184" y="457" class="box-sub">JSONL / span / artifacts</text>
+    <text x="184" y="474" class="small">失败后能复盘</text>
+  </g>
+  <g>
+    <rect x="344" y="408" width="180" height="86" rx="6" fill="#0f172a"/>
+    <rect x="344" y="408" width="180" height="86" rx="6" fill="rgba(6,78,59,0.42)" stroke="#34d399" stroke-width="1.5"/>
+    <text x="434" y="438" class="box-title">Eval Harness</text>
+    <text x="434" y="457" class="box-sub">20+ cases / metrics</text>
+    <text x="434" y="474" class="small">证明不是偶然成功</text>
+  </g>
+  <g>
+    <rect x="594" y="408" width="180" height="86" rx="6" fill="#0f172a"/>
+    <rect x="594" y="408" width="180" height="86" rx="6" fill="rgba(136,19,55,0.42)" stroke="#fb7185" stroke-width="1.5"/>
+    <text x="684
```

---

### Incident Patch 11: `82def14c` (2026-05-25)
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

### Incident Patch 12: `c8a232f8` (2026-05-25)
**Commit Message**: docs: add agent resume and storytelling guides

**File**: `README.md` (modified, +2/-2)
```diff
@@ -1767,8 +1767,8 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
 ```
 
 #### 求职软技能
-- [ ] [📝 简历编写指南](./docs/04-interview/12-resume-guide.md) - 待创建
-- [ ] [🎤 项目讲述技巧](./docs/04-interview/13-storytelling.md) - 待创建
+- [x] [📝 简历编写指南](./docs/04-interview/12-resume-guide.md) - AI Agent 项目简历公式、双岗写法与自检脚本
+- [x] [🎤 项目讲述技巧](./docs/04-interview/13-storytelling.md) - STAR+Tech 项目表达、追问地图与复盘模板
 - [x] [⭐ 转行大模型指南](./docs/04-interview/07-career-transition.md)
 - [x] [⭐ 秋招完整攻略](./docs/04-interview/08-job-hunting-guide.md)
 
```

**File**: `data/resources.json` (modified, +7/-7)
```diff
@@ -396,9 +396,9 @@
     "featured": false
   },
   {
-    "id": "",
-    "title": "简历撰写指南",
-    "description": "> 🚧 本文档正在编写中，敬请期待...",
+    "id": "ai-agent-resume-guide",
+    "title": "AI Agent 简历编写指南",
+    "description": "> 简历不是经历流水账，而是让面试官相信你能从 0 到 1 交付 Agent 系统的证据链。",
     "category": "求职",
     "tags": [],
     "level": "入门",
@@ -456,9 +456,9 @@
     "featured": false
   },
   {
-    "id": "",
-    "title": "面试讲故事技巧",
-    "description": "> 🚧 本文档正在编写中，敬请期待...",
+    "id": "ai-agent-storytelling",
+    "title": "AI Agent 项目讲述技巧",
+    "description": "> 面试讲项目不是背简历，而是证明你能定义问题、设计系统、处理失败并持续优化。",
     "category": "求职",
     "tags": [],
     "level": "入门",
@@ -1055,4 +1055,4 @@
     "date": "2026-05-23",
     "featured": false
   }
-]
\ No newline at end of file
+]
```

**File**: `docs/04-interview/12-resume-guide.md` (modified, +295/-5)
```diff
@@ -1,11 +1,301 @@
-# 简历撰写指南
+# AI Agent 简历编写指南
 
-> 🚧 本文档正在编写中，敬请期待...
+> 简历不是经历流水账，而是让面试官相信你能从 0 到 1 交付 Agent 系统的证据链。
 
-## 概述
+---
+
+## 📌 Section Goals（本节目标）
+
+- 学会把 AI Agent / RAG / 大模型项目写成可被面试追问的简历亮点。
+- 区分算法岗与开发岗的表达重点，避免“一份简历投所有岗位”。
+- 用 L1-L4 能力模型组织项目证据：基础认知、开发实现、高级优化、生产工程。
+- 掌握一页简历结构、项目 bullet 公式、量化指标写法和常见避坑清单。
+- 使用可运行脚本快速检查项目描述是否过于空泛、缺少指标或缺少技术动作。
+
+---
+
+## 💡 Core Concepts（核心概念）
+
+### 1. 简历的本质：面试入口，而不是个人传记
+
+AI Agent 岗位的简历只需要回答三个问题：
+
+1. **你做过什么真实问题？**
+2. **你用了什么 Agent / RAG / LLM 技术解决？**
+3. **结果是否能被量化、复现、追问？**
+
+如果一句项目描述不能被追问出架构、数据、指标、取舍，它就不是有效亮点。
+
+### 2. 面向三类读者写简历
+
+| 读者 | 他们关心什么 | 简历应该怎么写 |
+|:---|:---|:---|
+| ATS / AI 筛选 | 关键词匹配 | 明确写出 LangGraph、RAG、MCP、Milvus、FastAPI、评估指标等关键词 |
+| HR / 招聘 | 岗位匹配、稳定性 | 标题、技能、项目方向要贴 JD，避免过多陌生缩写 |
+| 技术面试官 | 技术深度、贡献边界 | 每个项目写清楚你的动作、指标、难点和取舍 |
+
+### 3. 1-2-5 框架在简历中的落地
+
+| 框架 | 简历落地方式 |
+|:---|:---|
+| 1 个原则 | 从“我学过什么”改成“我做成了什么” |
+| 2 条轨道 | 算法岗强调实验、模型、指标；开发岗强调系统、稳定性、业务价值 |
+| 5 步链路 | 简历、投递、模拟面试、Vibe Coding、成果展示要互相支撑 |
+
+### 4. L1-L4 能力模型映射
+
+| 层级 | 简历证据 | 常见写法 |
+|:---|:---|:---|
+| L1 基础认知 | 理解 Agent / RAG / LLM 基础 | “掌握 ReAct、Tool Use、向量检索、Function Calling 基础原理” |
+| L2 开发实现 | 能做出可运行系统 | “基于 LangGraph + FastAPI 实现多工具 Agent 服务” |
+| L3 高级优化 | 能定位瓶颈并优化 | “通过混合检索 + rerank 将 Recall@5 从 71% 提升到 84%” |
+| L4 生产工程 | 能上线、监控、降本、容错 | “接入日志追踪、失败重试、成本预算和评估流水线” |
+
+---
+
+## 🔍 Deep Understanding（深入理解）
+
+### 一页简历推荐结构
+
+```text
+姓名 / 电话 / 邮箱 / GitHub / 个人主页
+目标岗位：AI Agent 开发工程师 / 大模型算法工程师
+
+教育背景：学校、专业、时间、核心课程或排名
+
+技术栈：按方向分组，不要堆满所有工具
+  Agent: LangGraph / AutoGen / ReAct / Tool Calling / Memory
+  RAG: Milvus / FAISS / BGE / Reranker / GraphRAG
+  LLM Engineering: vLLM / FastAPI / Docker / LangSmith / Promptfoo
+
+项目经历：2-3 个强项目，每个 4-5 条 bullet
+
+实习 / 科研 / 开源：优先放与目标岗位最贴近的经历
+
+论文 / 博客 / 奖项：只放能增强岗位可信度的内容
+```
+
+### 项目 bullet 万能公式
+
+```text
+基于【技术栈】在【业务/研究场景】中设计并实现【系统/模块】，
+解决【具体问题】，通过【优化动作】将【指标】从 A 提升到 B，
+并沉淀【可复用产物/工程能力】。
+```
+
+### 不同岗位的写法差异
+
+#### 算法岗版本
+
+算法岗强调“问题定义、实验设计、指标提升、创新点”。
+
+```text
+设计面向多跳问答的 Agentic RAG 检索策略，引入 query decomposition + reranker
+重排机制，在 300 条自建金融 QA 测试集上将 Recall@5 从 68.3% 提升至 82.7%，
+并完成 BM25、Dense Retrieval、GraphRAG 三组 baseline 对比与消融实验。
+```
+
+#### 开发岗版本
+
+开发岗强调“系统落地、稳定性、性能、业务闭环”。
+
+```text
+基于 LangGraph + FastAPI + Milvus 搭建企业知识库 Agent 服务，支持文档解析、
+混合检索、工具调用和流式回答；通过缓存、异步队列和失败重试将 P95 响应
+时间从 4.8s 降至 1.6s，日均稳定处理 2000+ 次查询。
+```
+
+### AI Agent 项目应该写出的 7 类证据
+
+| 证据 | 说明 | 示例 |
+|:---|:---|:---|
+| 场景 | 为什么要做 | “企业制度文档检索慢，人工客服重复回答” |
+| 架构 | 系统如何组织 | “Planner、Retriever、Tool Executor、Evaluator 四层架构” |
+| 数据 | 用什么验证 | “自建 300 条 QA 集，覆盖规章、流程、异常案例” |
+| 指标 | 怎么衡量成功 | “Recall@5、Faithfulness、P95 延迟、工具调用成功率” |
+| 优化 | 做了哪些动作 | “混合检索、rerank、缓存、fallback、prompt 压缩” |
+| 取舍 | 为什么这样设计 | “牺牲部分召回换取低延迟，保障在线体验” |
+| 复盘 | 还能怎么改 | “下一步接入在线反馈和持续评估集” |
+
+### 常见低质量写法
+
+| 低质量写法 | 问题 | 改法 |
+|:---|:---|:---|
+| “熟悉 LangChain，做过 RAG 项目” | 没有场景、动作、指标 | 写出系统、数据集、指标和你的贡献 |
+| “使用大模型完成智能问答” | 过于泛化 | 写清楚检索、生成、评估、部署链路 |
+| “提升了系统效果” | 无法验证 | 写 Recall、准确率、延迟、成本、满意度 |
+| “参与项目开发” | 贡献边界模糊 | 写“负责文档解析模块 / 评估模块 / Agent 状态机” |
+| “阅读多篇论文” | 不是产出 | 写“复现某方法，并在自建数据集上完成对比实验” |
+
+### 技术栈不要堆，要分组
+
+不推荐：
+
+```text
+Python、Java、C++、LangChain、LangGraph、AutoGen、CrewAI、PyTorch、TensorFlow、
+Milvus、Redis、MySQL、Docker、Kubernetes、Vue、React、Linux...
+```
+
+推荐：
 
-本文将介绍 AI 方向简历优化、项目描述技巧。
+```text
+Agent 开发：LangGraph、ReAct、Function Calling、Tool Registry、Memory
+RAG 系统：Milvus、FAISS、BGE Embedding、Reranker、GraphRAG
+工程部署：FastAPI、Docker、Redis、异步任务、日志监控
+模型训练：PyTorch、LoRA、SFT、DPO、评估集构建
+```
+
+### 三个可直接套用的项目模板
+
+#### 模板 1：RAG / 知识库 Agent
+
+```text
+项目：企业级知识库 RAG Agent
+- 基于 FastAPI + Milvus + BGE + LangGraph 实现企业知识库问答系统，覆盖文档解析、
+  混合检索、rerank、引用溯源和多轮追问。
+- 构建 300 条业务 QA 评估集，使用 Recall@5、Faithfulness、Answer Relevance
+  评估效果，将正确引用率从 72% 提升至 88%。
+- 设计检索失败 fallback、敏感词拦截和日志追踪机制，降低幻觉回答比例并提升可排查性。
+- 将项目沉淀为 Docker Compose 一键启动 Demo，并编写算法岗/开发岗两版项目讲解稿。
+```
+
+#### 模板 2：Multi-Agent 协作系统
+
+```text
+项目：旅行规划 Multi-Agent 系统
+- 基于 LangGraph 设计 Planner、Researcher、Budgeter、Critic 四类 Agent，
+  支持用户偏好解析、景点检索、预算约束和行程反思。
+- 引入状态机和任务队列控制 Agent 协作顺序，解决循环调用和上下文膨胀问题。
+- 使用 50 个真实旅行需求构建评估集，从可执行性、预算一致性、用户偏好覆盖率
+  三个维度评估规划质量。
+- 接入工具调用日志和失败重试机制，将工具调用成功率提升到 94%。
+```
+
+#### 模板 3：Agent 评估 / Harness
+
+```text
+项目：Agent 自动化评估 Harness
+- 设计面向工具调用 Agent 的离线评估流水线，支持测试集管理、LLM-as-Judge、
+  规则评分和回归对比。
+- 将任务完成率、工具调用正确率、平均成本和 P95 延迟纳入统一报告，支持 PR 前自动检查。
+- 对比 Promptfoo、LangSmith、Braintrust 的适用场景，最终选择轻量自研脚本满足课程项目验证。
+- 通过持续评估发现 3 类高频失败：工具参数错误、上下文污染、拒答边界不稳定。
+```
+
+---
+
+## 💻 Code Examples（代码示例）
+
+### 环境说明
+
+- Python 版本：Python 3.10+
+- 依赖：仅使用标准库
+- `requirements.txt`：见 `docs/04-interview/examples/requirements.txt`
+
+### 运行方式
+
+```bash
+cd AgentGuide
+python docs/04-interview/examples/resume_storytelling_check.py --mode resume
+python docs/04-interview/examples/resume_storytelling_check.py --mode story
+```
+
+这个脚本不会替你写简历，但可以帮你发现三类问题：
+
+- 项目 bullet 是否缺少量化指标。
+- 是否只写“负责、参与、熟悉”等弱动作。
+- 项目讲述是否缺少背景、动作、结果、复盘。
+
+### 最小输入示例
+
+```text
+基于 LangGraph + FastAPI + Milvus 搭建企业知识库 Agent 服务，
+通过混合检索和 rerank 将 R
```

**File**: `docs/04-interview/13-storytelling.md` (modified, +320/-5)
```diff
@@ -1,11 +1,326 @@
-# 面试讲故事技巧
+# AI Agent 项目讲述技巧
 
-> 🚧 本文档正在编写中，敬请期待...
+> 面试讲项目不是背简历，而是证明你能定义问题、设计系统、处理失败并持续优化。
 
-## 概述
+---
+
+## 📌 Section Goals（本节目标）
 
-本文将介绍 STAR 法则、项目经历表达与亮点提炼技巧。
+- 掌握 AI Agent 项目的 30 秒、2 分钟、5 分钟、15 分钟四档讲法。
+- 用 STAR + Tech 框架组织项目故事，避免流水账式回答。
+- 针对算法岗与开发岗准备不同讲述重点。
+- 学会回答“为什么这么设计”“指标是否可信”“失败怎么处理”等高频追问。
+- 使用可运行脚本检查项目讲述是否缺少背景、动作、结果或复盘。
 
 ---
 
-*如果你希望贡献此文档，欢迎提交 PR！*
+## 💡 Core Concepts（核心概念）
+
+### 1. 面试官真正想听什么
+
+项目讲述的目标不是展示你知道多少名词，而是让面试官判断：
+
+- 你是否理解业务或研究问题。
+- 你是否真的设计和实现过关键模块。
+- 你是否能解释技术取舍，而不是只会调包。
+- 你是否有指标意识和复盘能力。
+- 你是否能把一次项目经验迁移到真实工作中。
+
+### 2. STAR + Tech 框架
+
+传统 STAR 适合行为面试，但 AI Agent 项目还需要补充技术细节。
+
+| 模块 | 含义 | Agent 项目中的表达 |
+|:---|:---|:---|
+| S: Situation | 背景 | 为什么需要这个 Agent，原方案有什么痛点 |
+| T: Task | 目标 | 要解决什么问题，用什么指标衡量成功 |
+| A: Action | 行动 | 架构、模块、算法、工程实现 |
+| R: Result | 结果 | 准确率、召回率、延迟、成本、用户反馈 |
+| Tech | 技术取舍 | 为什么用 LangGraph，为什么这样设计 Memory / Tool / RAG |
+
+### 3. 好项目故事的 6 个关键词
+
+```text
+场景清楚、目标明确、架构可画、难点具体、指标可信、复盘真实
+```
+
+只要缺一个，面试官就会觉得项目不够扎实。
+
+### 4. 项目闭环六步法
+
+准备项目故事时，不要只背 STAR 四段，而要提前回答六个闭环问题：
+
+```text
+为什么要做？ -> 不做会怎样？ -> 为什么选这个方法？
+-> 为什么不是其他方法？ -> 怎么验证真的有效？ -> 为什么收益能落到业务或研究价值上？
+```
+
+这六个问题能把项目从“我用了某个框架”拉回“我定义并解决了一个真实问题”。面试时至少覆盖其中四个，项目可信度会明显提高。
+
+| 闭环问题 | 面试官想判断什么 | Agent 项目回答示例 |
+|:---|:---|:---|
+| 为什么要做 | 问题定义能力 | “客服重复回答制度问题，人工处理成本高” |
+| 不做会怎样 | 业务或研究价值 | “流程类问题仍依赖人工，响应慢且不可规模化” |
+| 为什么选这个方法 | 技术判断力 | “复杂问题需要状态管理和工具调用，所以用 LangGraph 而不是单轮 prompt” |
+| 为什么不是其他方法 | 取舍能力 | “Dify 适合快速验证，但底层评估和状态机控制不够可定制” |
+| 怎么验证有效 | 指标意识 | “用 300 条 QA 集同时看 Recall@5、引用准确率和人工抽检” |
+| 收益如何落地 | 结果闭环 | “P95 延迟下降、工具调用成功率提升、失败样本可持续回归” |
+
+---
+
+## 🔍 Deep Understanding（深入理解）
+
+### 四档项目讲法
+
+#### 30 秒版本：用于“简单介绍一个项目”
+
+```text
+我做的是一个企业知识库 RAG Agent，目标是让员工能用自然语言查询制度和流程。
+系统基于 FastAPI、Milvus 和 LangGraph，包含文档解析、混合检索、rerank、
+引用溯源和评估集回归。我主要负责检索与评估模块，通过混合检索和重排把
+Recall@5 从 68% 提升到 84%，并接入失败案例分析来持续优化。
+```
+
+结构：
+
+```text
+项目是什么 + 为什么做 + 技术栈 + 我的贡献 + 结果
+```
+
+#### 2 分钟版本：用于项目主线讲述
+
+```text
+背景上，这个项目来自企业内部知识库场景，痛点是制度文档多、人工客服重复回答、
+普通关键词搜索很难处理流程类问题。
+
+目标上，我定义了两个核心指标：检索 Recall@5 和答案引用准确率。因为如果检索
+不到正确文档，后面的生成再好也没有意义。
+
+实现上，系统分成四层：文档解析层负责切分和清洗，检索层做 BM25 + dense
+retrieval 的混合召回，生成层使用 LangGraph 管理检索、回答和反思流程，
+评估层用 300 条自建 QA 做离线回归。
+
+我的主要贡献是检索和评估模块。最初只有向量检索，流程类问题召回很差。
+我加入关键词召回和 reranker，并按章节粒度重新切分文档，最终 Recall@5
+从 68% 提升到 84%，引用准确率从 71% 提升到 87%。
+
+复盘上，这个项目让我意识到 RAG 的核心不是“接一个向量库”，而是数据切分、
+召回策略、评估集和失败案例闭环。
+```
+
+#### 5 分钟版本：用于技术面深入展开
+
+建议按这条线讲：
+
+1. 业务背景：谁用、为什么需要、原方案问题。
+2. 技术目标：核心指标和约束。
+3. 系统架构：模块划分和数据流。
+4. 关键难点：选 1-2 个讲深。
+5. 方案取舍：为什么不用另一个方案。
+6. 结果指标：提升幅度、数据来源、可信度。
+7. 失败复盘：遇到的问题和下一步优化。
+
+#### 15 分钟版本：用于大厂深挖
+
+15 分钟不是讲更多背景，而是讲清楚系统边界。
+
+| 深挖方向 | 你要准备的内容 |
+|:---|:---|
+| 架构设计 | 状态机、模块边界、数据流、异常流 |
+| RAG | 切分策略、embedding、召回、rerank、引用溯源 |
+| Agent | Planner、Tool Executor、Memory、Reflection、终止条件 |
+| 评估 | 测试集来源、指标定义、人工抽检、失败样本 |
+| 工程 | 并发、缓存、日志、监控、成本、部署 |
+| 安全 | Prompt 注入、权限控制、敏感信息、工具白名单 |
+
+### 算法岗讲述重点
+
+算法岗要突出“实验设计和可验证提升”。
+
+推荐结构：
+
+```text
+问题定义 -> baseline -> 方法改进 -> 数据集 -> 指标 -> 消融实验 -> 失败分析
+```
+
+示例：
+
+```text
+我关注的是多跳问答场景下 RAG 召回不足的问题。baseline 是 BM25、dense
+retrieval 和 GraphRAG。我发现 dense retrieval 对实体精确匹配不稳定，
+GraphRAG 在小规模数据上构图成本较高，所以设计了 query decomposition
++ hybrid retrieval + reranker 的组合策略。实验集是 300 条人工标注问题，
+最终 Recall@5 从 68% 提升到 84%。消融实验显示 reranker 贡献约 7 个点，
+query decomposition 对多跳问题贡献更明显。
+```
+
+### 开发岗讲述重点
+
+开发岗要突出“系统可用性和工程闭环”。
+
+推荐结构：
+
+```text
+业务场景 -> 系统架构 -> 核心模块 -> 异常处理 -> 性能优化 -> 部署监控 -> 业务结果
+```
+
+示例：
+
+```text
+我把系统拆成文档处理、检索服务、Agent 编排、评估回归和日志监控五个模块。
+线上最常见的问题不是模型答错，而是工具参数错误、检索为空和上下文过长。
+所以我加入了工具 schema 校验、fallback 检索、上下文裁剪和日志 trace。
+这些机制让工具调用成功率提升到 94%，P95 延迟从 4.8s 降到 1.6s。
+```
+
+### 面试追问地图
+
+| 面试官追问 | 想考什么 | 回答重点 |
+|:---|:---|:---|
+| 你为什么用 LangGraph？ | 框架理解 | 状态机、循环控制、人审节点、可观测性 |
+| 为什么不用纯 prompt？ | Agent 边界 | 任务需要工具调用、状态管理、多步规划 |
+| 指标怎么定义？ | 评估意识 | 测试集、指标、人工抽检、失败样本 |
+| 幻觉怎么处理？ | 可靠性 | 引用溯源、拒答策略、答案校验 |
+| 工具调用失败怎么办？ | 工程能力 | schema 校验、重试、fallback、日志 |
+| 如果用户量扩大 10 倍？ | 系统设计 | 缓存、异步队列、限流、模型路由 |
+| 如果数据有权限？ | 安全意识 | ACL、租户隔离、工具白名单、审计日志 |
+
+### 失败案例要主动准备
+
+优秀的项目讲述一定包含失败案例。不要只讲“我做得很好”，要讲“我怎么发现问题并修掉”。
+
+可准备三类失败：
+
+1. **技术失败**：检索不准、工具调用错、上下文过长、模型幻觉。
+2. **工程失败**：延迟太高、成本超预算、日志不可排查。
+3. **产品失败**：用户问题和测试集不一致，Demo 好看但真实使用差。
+
+失败案例模板：
+
+```text
+最开始我以为问题出在 prompt，但看 trace 后发现 70% 的错误来自检索阶段。
+具体表现是用户问流程类问题时，向量检索只召回了定义文档，没有召回操作步骤。
+我后来把文档切分从固定 token 改成章节级切分，并加入 BM25 补充实体匹配，
+这个改动让流程类问题 Recall@5 提升了 13 个点。
+```
+
+---
+
+## 💻 Code Examples（代码示例）
+
+### 环境说明
+
+- Python 版本：Python 3.10+
+- 依赖：仅使用标准库
+- `requirements.txt`：见 `docs/04-interview/examples/requirements.txt`
+
+### 运行方式
+
+```bash
+cd AgentGuide
+python docs/04-interview/examples/resume_storytelling_check.py --mode story
+```
+
+### 你可以用它检查什么
+
+脚本会检查项目讲述是否包含：
+
+- 背景：为什么做这个项目。
+- 任务：目标和评价指标是什么。
+- 行动：你做了什么技术动作。
+- 结果：指标、产物或业务价值。
+- 复盘：失败案例、取舍或下一步。
+
+如果输出里提示缺少 `result`，说明你的故事很可能停留在“我做了一个系统”，但没有证明它有效。
+
+---
+
+## 🎯 Interview Questions（面试中如何考）
+
+### Q1：请你用 2 分钟介绍一个最有代表性的 Agent 项目
+
+回答结构：
+
+```text
+背景 -> 目标 -> 架构 -> 我的贡献 -> 指标 -> 复盘
+```
+
+不要上来就说“我用
```

**File**: `docs/04-interview/examples/requirements.txt` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# This example uses only the Python standard library.
+# Tested with Python 3.10+.
```

**File**: `docs/04-interview/examples/resume_storytelling_check.py` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+"""Check AI Agent resume bullets and project stories.
+
+Runtime:
+    Python 3.10+
+
+Dependencies:
+    Standard library only. See requirements.txt in this directory.
+
+Usage:
+    python docs/04-interview/examples/resume_storytelling_check.py --mode resume
+    python docs/04-interview/examples/resume_storytelling_check.py --mode story
+    python docs/04-interview/examples/resume_storytelling_check.py --mode resume --text "..."
+"""
+
+from __future__ import annotations
+
+import argparse
+import re
+from dataclasses import dataclass
+
+
+WEAK_WORDS = ("参与", "负责", "熟悉", "了解", "学习", "尝试")
+ACTION_WORDS = (
+    "设计",
+    "实现",
+    "构建",
+    "优化",
+    "接入",
+    "评估",
+    "部署",
+    "重构",
+    "沉淀",
+)
+TECH_WORDS = (
+    "Agent",
+    "RAG",
+    "LangGraph",
+    "LangChain",
+    "Milvus",
+    "FAISS",
+    "FastAPI",
+    "rerank",
+    "Memory",
+    "Tool",
+    "评估",
+)
+METRIC_PATTERN = re.compile(r"(\d+(\.\d+)?%|\d+(\.\d+)?s|P95|Recall|准确率|成功率|延迟|成本|吞吐|QPS)")
+
+
+@dataclass
+class CheckResult:
+    score: int
+    warnings: list[str]
+    suggestions: list[str]
+
+
+def has_any(text: str, words: tuple[str, ...]) -> bool:
+    return any(word.lower() in text.lower() for word in words)
+
+
+def check_resume_bullet(text: str) -> CheckResult:
+    warnings: list[str] = []
+    suggestions: list[str] = []
+    score = 100
+
+    if not has_any(text, TECH_WORDS):
+        score -= 20
+        warnings.append("missing_agent_keywords")
+        suggestions.append("补充 Agent / RAG / LangGraph / 向量库 / 评估框架等岗位关键词。")
+
+    if not has_any(text, ACTION_WORDS):
+        score -= 20
+        warnings.append("missing_action")
+        suggestions.append("把弱动词改成设计、实现、优化、评估、部署等具体动作。")
+
+    if not METRIC_PATTERN.search(text):
+        score -= 25
+        warnings.append("missing_metric")
+        suggestions.append("补充 Recall@5、准确率、延迟、成功率、成本等量化指标。")
+
+    if has_any(text, WEAK_WORDS) and not METRIC_PATTERN.search(text):
+        score -= 15
+        warnings.append("weak_word_without_evidence")
+        suggestions.append("如果使用参与、负责、熟悉等词，必须补充贡献边界和结果证据。")
+
+    if len(text) < 45:
+        score -= 10
+        warnings.append("too_short")
+        suggestions.append("项目 bullet 过短，建议写清场景、技术动作和结果。")
+
+    if not suggestions:
+        suggestions.append("保留当前写法，面试时准备架构图、评估集构造和失败案例。")
+
+    return CheckResult(score=max(score, 0), warnings=warnings, suggestions=suggestions)
+
+
+def check_project_story(text: str) -> CheckResult:
+    sections = {
+        "background": ("背景", "痛点", "问题", "场景", "为什么要做"),
+        "task": ("目标", "指标", "衡量", "成功"),
+        "action": ACTION_WORDS + TECH_WORDS + ("为什么选", "取舍", "替代方案"),
+        "result": ("提升", "降低", "从", "到", "%", "Recall", "成功率", "延迟"),
+        "reflection": ("复盘", "失败", "取舍", "下一步", "不足", "改进"),
+    }
+
+    warnings: list[str] = []
+    suggestions: list[str] = []
+    score = 100
+
+    for section, words in sections.items():
+        if not has_any(text, tuple(words)):
+            score -= 18
+            warnings.append(f"missing_{section}")
+
+    if "missing_background" in warnings:
+        suggestions.append("补充项目背景：谁使用、为什么原方案不够好。")
+    if "missing_task" in warnings:
+        suggestions.append("补充目标和指标：用什么衡量项目成功。")
+    if "missing_action" in warnings:
+        suggestions.append("补充你的技术动作：架构、模块、优化和工程实现。")
+    if "missing_result" in warnings:
+        suggestions.append("补充结果：指标提升、产物、业务价值或开源影响。")
+    if "missing_reflection" in warnings:
+        suggestions.append("补充复盘：失败案例、技术取舍或下一步计划。")
+
+    if len(text) < 120:
+        score -= 10
+        warnings.append("story_too_short")
+        suggestions.append("2 分钟项目故事通常需要覆盖背景、目标、架构、贡献、结果和复盘。")
+
+    if not suggestions:
+        suggestions.append("故事结构完整，建议继续准备 5 分钟架构版和 15 分钟深挖版。")
+
+    return CheckResult(score=max(score, 0), warnings=warnings, suggestions=suggestions)
+
+
+def print_result(result: CheckResult) -> None:
+    print(f"score: {result.score}")
+    print(f"warnings: {result.warnings}")
+    print("suggestions:")
+    for item in result.suggestions:
+        print(f"- {item}")
+
+
+def main() -> None:
+    parser = argparse.ArgumentParser()
+    parser.add_argument("--mode", choices=("resume", "story"), required=True)
+    parser.add_argument("--text", default="")
+    args = parser.parse_args()
+
+    demo_resume = (
+        "基于 LangGraph + FastAPI + Milvus 搭建企业知识库 Agent 服务，"
+        "通过混合检索和 rerank 将 Recall@5 从 68% 提升到 84%，"
+        "并接入日志追踪、失败重试和评估集回归。"
+    )
+    demo_story = (
+        "背景是企业制度文档多，人工客服重复回答，关键词搜索无法处理流程类问题。"
+        "目标是提升 Recall@5 和引用准确率。"
+        "我设计了文档解析、混合检索、LangGraph 编排和评估回归四层架构，"
+        "之所以选择 LangGraph，是因为复杂问题需要状态管理和工具调用，不适合单轮 prompt。"
+        "通过章节切分、BM25 + dense retrieval 和 rerank 将 Recall@5 从 68% 提升到 84%。"
+        "复盘时发现部分失败来自权限文档缺失，下一步会加入权限过滤和在线反馈。"
+    )
+
+    text = args.text.strip() or (demo_resume if args.mode == "resume" else demo_story)
+    result = check_resume_bullet(text) if args.mode == "resume" else check_p
```

---

### Incident Patch 13: `1f50ed01` (2026-05-23)
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

**File**: `docs/01-theory/08-agent-bench.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# AgentBench 详解
+
+> 🚧 本文档正在编写中，敬请期待...
+
+## 概述
+
+本文将介绍 Agent 评测基准、多维度能力评估方法。
+
+---
+
+*如果你希望贡献此文档，欢迎提交 PR！*
```

**File**: `docs/01-theory/09-evaluation-metrics.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Agent 评估指标体系
+
+> 🚧 本文档正在编写中，敬请期待...
+
+## 概述
+
+本文将介绍科学评估 Agent 系统的指标与方法论。
+
+---
+
+*如果你希望贡献此文档，欢迎提交 PR！*
```

**File**: `docs/02-tech-stack/04-langchain-guide.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# LangChain 框架指南
+
+> 🚧 本文档正在编写中，敬请期待...
+
+## 概述
+
+本文将介绍 LangChain 核心概念、组件与实战用法。
+
+---
+
+*如果你希望贡献此文档，欢迎提交 PR！*
```

---

### Incident Patch 14: `42060936` (2026-04-20)
**Commit Message**: feat: add LLM model series notes, post-training guide, and coding exercises

- Add DeepSeek series deep notes (V1→V3→R1→Engram) to docs/01-theory/
- Add LLaMA series deep notes (LLaMA1→LLaMA4) to docs/01-theory/
- Add Qwen series deep notes (Qwen1→Qwen3.5) to docs/01-theory/
- Add Post-Training complete interview guide (SFT/RLHF/PPO/DPO/GRPO/LoRA) to docs/02-tech-stack/
- Add coding exercises roadmap (staged difficulty) to docs/04-interview/
- Append learning prompt template to resources/learning-resources.md
- Update README.md with links to all new content

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +9/-2)
```diff
@@ -954,7 +954,10 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
 | **推理层** | vLLM、TGI、量化技术 | PagedAttention、GPTQ/AWQ 量化、推理优化 |
 | **对齐层** | RLHF、PPO、DPO | Reward Model、策略优化、人类偏好对齐 |
 
-📖 [深入阅读：Transformer 架构详解](./docs/01-theory/03-transformer.md)
+📖 [深入阅读：Transformer 架构详解](./docs/01-theory/03-transformer.md)  
+📖 [DeepSeek 系列完整深度笔记](./docs/01-theory/10-deepseek-series.md) 🆕  
+📖 [LLaMA 系列完整深度笔记](./docs/01-theory/11-llama-series.md) 🆕  
+📖 [Qwen 系列深度学习笔记](./docs/01-theory/12-qwen-series.md) 🆕
 
 </td>
 </tr>
@@ -1162,7 +1165,8 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
 - 自我修正机制训练
 
 📖 [完整指南：Agent 强化学习](./docs/02-tech-stack/21-agent-reinforcement-learning.md)  
-📖 [实战：SFT 监督微调](./docs/02-tech-stack/16-sft-finetuning.md)
+📖 [实战：SFT 监督微调](./docs/02-tech-stack/16-sft-finetuning.md)  
+📖 [Post-Training 完整面试指南](./docs/02-tech-stack/25-post-training-complete-guide.md) 🆕
 
 </td>
 <td width="50%">
@@ -1722,6 +1726,9 @@ AgentGuide 提供 **n 个简历级实战项目**，每个项目都提供：
   - RAG系统：文档切块、混合检索、Reranker
   - 推理优化：KV Cache、Beam Search、LoRA
   - **总计**: **34题** ⬆️ 新增11道Transformer核心组件手撕题
+- [x] [💻 大模型手撕刷题路线](./docs/04-interview/17-coding-exercises.md) 🆕
+  - 分阶段刷题：神经网络基础算子 → Attention 机制 → 位置编码 → 优化技术
+  - 按难度分级，系统化刷题指南
 
 </td>
 </tr>
```

**File**: `docs/01-theory/10-deepseek-series.md` (added, +2756/-0)
```diff
@@ -0,0 +1,2756 @@
+# DeepSeek 系列完整深度笔记
+
+> 覆盖范围：DeepSeek-V1 → V2 → V3 → R1 → Prover-V2 → V3.2 → DualPath → Engram
+> 学习方式：从基础概念到工程实践，从原理到前沿
+
+---
+
+## 目录
+
+1. [DeepSeek-V1：开源大模型的起点](#1-deepseek-v1)
+2. [DeepSeek-Math：数学推理的专项突破](#2-deepseek-math)
+3. [DeepSeek-V2：MoE架构的革命](#3-deepseek-v2)
+4. [DeepSeek-V3：从V2到工业级MoE](#4-deepseek-v3)
+5. [DeepSeek-R1：纯RL解锁推理能力](#5-deepseek-r1)
+6. [DeepSeek-Prover-V2：形式化定理证明](#6-deepseek-prover-v2)
+7. [DeepSeek-V3.2：稀疏注意力的探索](#7-deepseek-v32)
+8. [DualPath：榨干每一块闲置网卡的带宽](#8-dualpath)
+9. [DeepSeek Engram：让大模型学会查字典](#9-deepseek-engram)
+
+---
+
+## 1. DeepSeek-V1
+
+### 1.1 论文信息
+
+**论文名称**：DeepSeek LLM: Scaling Open-Source Language Models with Longtermism
+
+### 1.2 模型结构
+
+DeepSeek-V1 基于 LLaMA 架构，选择"站在巨人肩膀上"——不从零开始，而是在成熟基础上优化。
+
+#### 三大核心组件
+
+**PreRMSNorm（前置均方根归一化）**
+
+在每一层计算之前先对输入做归一化处理，防止某个特征值主导整个计算过程。
+
+```
+传统LayerNorm：计算均值和方差，相对开销较大
+PreRMSNorm：只计算均方根，更轻量，效果相当
+公式：RMSNorm(x) = x / sqrt(mean(x²) + ε) * γ
+```
+
+**SwiGLU（门控线性单元）**
+
+FFN层的激活函数，决定哪些信息值得向后传递。相比ReLU，SwiGLU通过门控机制提供了更平滑的梯度流。
+
+```
+SwiGLU(x) = Swish(xW₁) ⊗ (xW₂)
+Swish(x) = x * sigmoid(βx)
+```
+
+**RoPE（旋转位置编码）**
+
+给每个词打上"位置编号"，让模型感知词与词之间的相对距离。相比绝对位置编码，RoPE对长文本的泛化性更好。
+
+#### GQA（分组查询注意力）——67B专属优化
+
+**核心问题**：KV Cache 的显存危机
+
+在推理时，模型需要缓存每个 token 的 K（Key）和 V（Value）向量，称为 KV Cache。上下文越长，KV Cache 越大。
+
+**标准MHA的显存占用：**
+```
+KV Cache 大小 = 层数 × KV头数 × 每头维度 × 序列长度
+
+7B模型：30层 × 32头 × 128维 = 122,880 个数值/token
+67B模型（不用GQA）：95层 × 64头 × 128维 = 778,240 个数值/token
+67B模型（用GQA）：95层 × 8头 × 128维 = 97,280 个数值/token
+```
+
+**GQA的核心思路**：多个Q头共享同一组K、V头
+```
+MHA：32个Q头 → 32个K头 + 32个V头（每人一本书）
+GQA：32个Q头 → 8个K头  + 8个V头（四人共用一本书）
+压缩比：4倍
+```
+
+**为什么7B不需要GQA，67B必须用？**
+
+三个维度同时变大（层数×头数×维度），KV Cache 指数级增长。GQA 让 67B 的 KV Cache 开销控制在和 7B 同一数量级。
+
+**具体参数对比：**
+
+| 参数 | 7B | 67B |
+|------|-----|------|
+| 层数 | 30 | 95 |
+| 模型维度 | 4096 | 8192 |
+| 注意力头数 | 32 | 64 |
+| KV头数 | 32 | **8**（GQA） |
+| Context长度 | 4096 | 4096 |
+| Sequence Batch Size | 2304 | 4608 |
+| 学习率 | 4.2e-4 | 3.2e-4 |
+| 训练Token数 | 2.0T | 2.0T |
+
+### 1.3 BBPE 分词算法
+
+DeepSeek-V1 使用 **Byte-level BPE（BBPE）**。
+
+**普通BPE的问题：**
+```
+遇到生僻字 → [UNK]（未知符号）→ 信息丢失
+```
+
+**BBPE的改进：**
+```
+在字节（byte）级别操作
+任何文字 = 256个基础字节的组合
+→ 永远不会出现UNK ✅
+→ 对中文、代码、数学符号都友好
+```
+
+**DeepSeek的BBPE配置：**
+- 训练语料：约24GB文本
+- 词汇表大小：102,400个token（比GPT-2的50,257大一倍）
+- 原因：中文字符、数学符号、代码关键字需要更多词表空间
+
+### 1.4 SFT训练（监督微调）
+
+**目的**：教模型从"续写者"变成"助手"
+
+**没有SFT时的问题：**
+```
+输入："帮我写一封道歉信"
+Base模型输出："帮我写一封道歉信的方法有很多种，古代文人常用..."
+← 在续写，不是在帮忙！
+```
+
+**训练数据：**
+- 规模：1.5M 条中英文指令数据
+- 中文：日常对话、知识问答、写作
+- 英文：学术、代码、逻辑推理
+- 双语混合：让模型学会语言间灵活切换
+
+**超参数设计：**
+
+| 配置 | 7B | 67B |
+|------|-----|------|
+| 训练轮数 | 4 epochs | 2 epochs |
+| 学习率 | 1e-5 | 5e-6 |
+
+**为什么大模型用更小的学习率和更少轮数？**
+
+大模型预训练积累了大量知识，大学习率会导致**灾难性遗忘（Catastrophic Forgetting）**。步子太大会把预训练学到的知识"冲掉"。
+
+### 1.5 DPO训练（直接偏好优化）
+
+**背景**：SFT之后模型能理解指令，但输出质量参差不齐。DPO让模型学会"更好"的回答风格。
+
+**偏好数据构建流程：**
+```
+第一步：对同一问题，用Chat Model采样多个候选回答
+第二步：用规则+模型打分区分好坏
+  规则维度（客观）：格式规范、长度合适、回答了问题
+  模型打分维度（主观）：用更强模型当裁判
+第三步：筛选差异明显的对（信号强）
+```
+
+**DPO vs RLHF的优势：**
+```
+RLHF流程：人类标注 → 训练RM → PPO训练
+  问题：需要单独训练RM，PPO不稳定，显存压力大
+
+DPO流程：偏好对数据 → 直接优化Policy Model
+  优势：更简单、更稳定、不需要RM、显存更小
+```
+
+**DPO目标函数直觉：**
+```python
+loss = -log(sigmoid(
+    β * (log_prob(好回答) - log_prob(差回答)   # 当前模型
+       - log_prob(好回答) - log_prob(差回答))  # 参考模型
+))
+# β控制偏离参考模型的程度
+# 让"好回答"概率相对参考模型提高
+# 让"差回答"概率相对参考模型降低
+```
+
+**DeepSeek-V1 DPO超参数：**
+- Batch size：512（更大batch → 梯度更稳定）
+- 学习率：5e-6（和大模型SFT一样小，防止过度更新）
+
+**为什么用自己的模型生成偏好对？**
+- 不是让模型"评判好坏"，而是生成多样性后用规则筛选
+- "模型最了解自己的输出分布"
+- 成本远低于大规模人工标注
+
+---
+
+## 2. DeepSeek-Math
+
+### 2.1 主要贡献
+
+1. **可扩展的数学预训练**：从Common Crawl中挖掘120B数学tokens
+2. **强化学习的探索**：GRPO算法在数学推理上的应用
+
+### 2.2 数据处理流程：fastText流水线
+
+**核心思路：粗筛 → 精筛的工业流水线**
+
+```
+Math Seed（高质量种子）
+    ↓ 训练fastText分类器
+fastText扫描40B HTML网页（粗筛，极快）
+    ↓ 按分数排名
+去重 + 过滤（精筛）
+    ↓ 四轮迭代
+最终产出：3550万数学网页，120B tokens
+```
+
+**为什么用fastText而不是GPT-4？**
+
+| 维度 | fastText | GPT-4 |
+|------|---------|-------|
+| 速度 | 数十万条/秒 | 几十条/秒 |
+| 成本 | 极低 | 极高 |
+| 精度 | 足够（粗筛不需要完美） | 更高 |
+| 场景 | 40B网页的初步过滤 | 精细质量判断 |
+
+**速度差距约10,000倍**，面对40B网页，大模型完全不可行。这是工程思维的核心：**规模决定工具选择**。
+
+**fastText训练数据：**
+- 正样本：从OpenWebMath随机抽50万条（已知高质量数学网页）
+- 负样本：从Common Crawl随机抽50万条普通网页
+- 关键：用目标域数据定义"什么是数学"，而不是人工写规则
+
+**fastText配置：**
+- 向量维度：256
+- 学习率：0.1
+- 最大词n-gram长度：3
+- 最小词出现次数：3
+- 训练轮数：3
+
+### 2.3 数据清洗四步走
+
+**第一步：去重**
+- URL去重：相同URL只保留一份
+- 近似去重：相似内容去除
+- 将Common Crawl压缩为40B个HTML网页
+
+**第二步：召回与排名**
+- 使用fastText对去重后的网页打分
+- 按分数降序排名
+- 只保留前40B tokens（通过预训练实验确定阈值）
+
+**第三步：迭代优化（4轮）**
+- 识别和注释未收集的数学网页来源
+- 丰富种子语料库，重新训练fastText
+- 每轮召回更多高质量数据
+
+**第四步：去污染（Decontamination）**
+
+防止训练数据包含测试集内容，避免评测基准被污染。
+
+**两段式去污染规则：**
+
+```python
+def is_contaminated(webpage_text, benchmark_texts):
+    for bench_text in benchmark_texts:
+        length = len(bench_text)
+        
+        if length >= 10:
+            # 长文本：子串匹配（宽松）
+            # 10字符随机碰撞概率极低，误伤少
+            if bench_text in webpage_text:
+                return True
+ 
```

**File**: `docs/01-theory/11-llama-series.md` (added, +1167/-0)
```diff
@@ -0,0 +1,1167 @@
+# LLaMA 系列完整深度笔记
+
+> 覆盖 LLaMA1 → LLaMA2 → CodeLlama → LLaMA3 → LLaMA4
+> 包含模型结构、训练方式、工程实践、前沿探索
+
+---
+
+## 目录
+
+1. [LLaMA1](#1-llama1)
+2. [LLaMA2](#2-llama2)
+3. [CodeLlama](#3-codellama)
+4. [LLaMA3](#4-llama3)
+5. [LLaMA4](#5-llama4)
+6. [演进总览](#6-演进总览)
+
+---
+
+## 1. LLaMA1
+
+> 论文：LLaMA: Open and Efficient Foundation Language Models
+> 定位：开源高效基础语言模型，目前主流开源大模型（Dense）基本都是LLaMA架构
+
+### 1.1 模型结构
+
+相比 GPT，LLaMA1 做出了以下四个核心改动：
+
+#### Pre-RMSNorm（层归一化）
+
+**传统 Post-LayerNorm 的问题：**
+```
+输入 → 注意力/FFN → 输出 → 再做归一化
+```
+类比：先跑完100米，再量血压——数值因剧烈运动而波动。
+
+**LLaMA1 的 Pre-RMSNorm：**
+```
+输入 → 先做归一化 → 再做注意力/FFN → 输出
+```
+类比：先量好血压，再让你跑步——从一开始就稳定。
+
+**RMSNorm vs LayerNorm：**
+
+| 对比项 | LayerNorm | RMSNorm |
+|-------|-----------|---------|
+| 计算内容 | 均值 + 方差 | 只有方差（RMS） |
+| 计算量 | 较大 | 更小 |
+| 隐含假设 | 无 | 激活值天然趋近零均值 |
+
+RMSNorm 去掉均值计算的合理性：深度网络中，权重初始化（Xavier/He）+ 对称激活函数，使中间层输出天然围绕 0 波动，减去均值几乎没有额外效果，却多花了计算。
+
+公式：
+$$y = \frac{x}{\sqrt{\frac{1}{d}\sum_{i=1}^{d}x_i^2 + \epsilon}}$$
+
+---
+
+#### SwiGLU（激活函数）
+
+**标准 FFN（ReLU）：**
+```
+输出 = ReLU(xW₁) · W₂
+```
+类比：只有开关的水龙头，要么全开，要么关死。
+
+**SwiGLU：**
+```
+输出 = (xW₁ · SiLU(xW_gate)) · W₂
+```
+类比：水龙头 + 调节阀，门控值决定每个维度放多少信息通过。
+
+**参数量补偿：** SwiGLU 多了一个 W_gate 矩阵，LLaMA 通过缩小 FFN 中间维度来补偿：
+
+```
+标准FFN：   2个矩阵，中间维度 4d
+SwiGLU FFN：3个矩阵，中间维度 8d/3 ≈ 2.67d
+→ 参数量基本持平
+```
+
+---
+
+#### RoPE（旋转位置编码）
+
+**绝对位置编码的问题：**
+给每个位置贴固定标签，训练时见过 1~2K，推理时遇到 2001 就懵了——这个位置标签从未见过。
+
+**RoPE 的思路：** 不给位置贴标签，而是把位置信息编码进向量的旋转角度里。
+
+```
+位置m的词向量：旋转 m·θ 度
+位置n的词向量：旋转 n·θ 度
+
+注意力点积：
+Q · K = (旋转了mθ的向量) · (旋转了nθ的向量)
+      = 只取决于 (m-n)θ  ← 相对距离！
+```
+
+**多频率设计（类比时钟）：**
+```
+低维度 → 小θ → 转得快 → 像秒针 → 感知近距离细粒度差异
+高维度 → 大θ → 转得慢 → 像时针 → 感知远距离粗粒度差异
+```
+多个"指针"叠加，才能唯一表示任意位置。若所有维度用同一个θ，旋转到 2π 就归零重置，位置 1 和位置 1+周期 完全一样，模型无法区分。
+
+---
+
+#### BPE 分词器
+
+**核心思想：合并高频字符对**
+```
+第一步：统计相邻字符对出现频率
+第二步：合并最高频的字符对为一个新token
+第三步：重复，直到词表达到目标大小（LLaMA1是32K）
+```
+
+**LLaMA1 的特殊处理：**
+
+1. **数字强制拆分：** 所有数字分解为单独数字 token
+   ```
+   普通BPE："123456" → ["123", "456"]
+   LLaMA1：  "123456" → ["1","2","3","4","5","6"]
+   ```
+   原因：训练时见过 "42"，推理时遇到 "43"，如果整体处理则不认识；拆开后 "4" 和 "3" 都见过。
+   代价：模型需要隐式维护进位状态，数学计算更难。
+
+2. **UTF-8 字节回退：** 对未知字符回退到字节分解
+   ```python
+   "🔥" → ["<0xF0>","<0x9F>","<0x94>","<0xA5>"]
+   ```
+   意义：没有回退机制时，遇到生僻字只能输出 `<UNK>`，信息丢失；有回退则信息完整保留。
+
+---
+
+### 1.2 训练方式
+
+基础的自监督学习模型，没有经过任何形式的特定任务微调。
+
+#### AdamW 优化器
+
+**普通 Adam 的问题：** 权重衰减被加入梯度，随后被 Adam 的自适应学习率"稀释"，大权重没有被有效惩罚。
+
+**AdamW 的修复：解耦权重衰减**
+```python
+# 第一步：正常的Adam梯度更新
+weight = weight - lr * adam_update(gradient)
+
+# 第二步：独立的权重衰减（不经过Adam缩放）
+weight = weight - lr * λ * weight
+```
+
+**LLaMA1 具体配置：**
+```python
+optimizer = AdamW(
+    β1 = 0.9,           # 梯度均值历史权重（90%历史+10%当前）
+    β2 = 0.95,          # 梯度方差历史权重（更稳定的步长估计）
+    weight_decay = 0.1, # 防止权重过大
+    grad_clip = 1.0     # 梯度裁剪，防止梯度爆炸
+)
+```
+
+**梯度裁剪的必要性：**
+```python
+if gradient.norm() > 1.0:
+    gradient = gradient / gradient.norm()
+```
+触发场景：训练数据里出现极端样本（格式异常的代码、生僻字文章），loss 暴增，梯度随之暴增。不裁剪则参数直接飞出合理区间，后续 loss 变成 NaN，训练彻底崩溃。
+
+---
+
+#### 余弦学习率调度
+
+**为什么选余弦而不是线性：**
+```
+线性衰减：匀速下降，前期下降太快，模型还没探索清楚
+余弦衰减：前期缓慢→中期快速→后期缓慢，给模型充分探索空间
+```
+
+**完整学习率生命周期：**
+```python
+def get_lr(step, warmup_steps, total_steps, lr_max, lr_min):
+    # 第一阶段：warmup（线性上升）
+    if step < warmup_steps:
+        return lr_max * (step / warmup_steps)
+    # 第二阶段：余弦衰减
+    progress = (step - warmup_steps) / (total_steps - warmup_steps)
+    return lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(π * progress))
+
+# 曲线形状：
+# lr ↑   /﹨
+# |    /   ﹨_
+# |   /        ﹨___
+# |——warmup——|———余弦衰减———→ step
+```
+
+**Warmup 的作用：**
+训练最开始参数随机初始化，梯度方向不可信，用极小学习率让各层输出分布趋于正常，再逐步放开学习率大步走。
+
+**不同模型大小用不同学习率：**
+```
+7B/13B 模型：lr_max = 3×10⁻⁴
+33B/65B 模型：lr_max = 1×10⁻⁴
+```
+原因：大模型层数更深，梯度传播时误差累积更多（多层连乘放大误差），且参数耦合更复杂，改动一个引发更长连锁反应，大 lr 容易导致整个网络震荡。
+
+---
+
+### 1.3 训练数据
+
+总量 1.4T token，全部公开数据，自监督学习。
+
+| 数据集 | 采样比例 | Epoch | 磁盘大小 |
+|-------|---------|-------|---------|
+| CommonCrawl | 67.0% | 1.10 | 3.3 TB |
+| C4 | 15.0% | 1.06 | 783 GB |
+| Github | 4.5% | 0.64 | 328 GB |
+| Wikipedia | 4.5% | 2.45 | 83 GB |
+| Books | 4.5% | 2.23 | 85 GB |
+| ArXiv | 2.5% | 1.06 | 92 GB |
+| StackExchange | 2.0% | 1.03 | 78 GB |
+
+**为什么 CommonCrawl 占 67%（而非更多高质量数据）：**
+
+1. 数据量天花板：Wikipedia 只有 83GB，重复训练会严重过拟合
+2. 多样性比纯净度更重要：CommonCrawl 覆盖人类语言真实场景，让模型"说人话"
+3. Epoch 数是真正的质量加权：Wikipedia 训练 2.45 轮，Github 只有 0.64 轮
+
+**Github 数据连一轮都没训练完的启示：** 代码数据利用率不足，缺乏合成数据构造能力，LLaMA3 通过扩充4倍代码数据+合成代码来解决。
+
+**代码数据为何能提升逻辑推理：** 代码天然携带严格因果链（if→then）、显式步骤分解（step1→2→3）、零噪声逻辑（对就是对，错就是错），训练后模型学到的是精确推理而非模糊推理。
+
+---
+
+## 2. LLaMA2
+
+> 论文：Llama 2: Open Foundation and Fine-Tuned Chat Models
+> 核心变化：更多训练数据、更长上下文、GQA、完整 RLHF 流程
+
+### 2.1 模型结构变化
+
+| 变化点 | LLaMA1 | LLaMA2 |
+|-------|--------|--------|
+| 上下文长度 | 2K | 4K |
+| 大参数模型注意力 | MHA | GQA |
+| FFN 矩阵维度 | 标准 | 扩充（增强泛化） |
+| 训练数据 | 1.4T | 2T |
+
+#### GQA（分组查询注意力）
+
+**KV Cache 的危机：**
+```
+每生成1个新token → 需要读取所有历史K和V
+→ 序列越长，KV Cache占用显存越大
+→ 8个头 × 序列长度 × 维度 × 精度 = 显存爆炸
+```
+
+**三种注意力机制对比：**

```

**File**: `docs/01-theory/12-qwen-series.md` (added, +1667/-0)
```diff
@@ -0,0 +1,1667 @@
+# Qwen 系列模型深度学习笔记
+
+> 覆盖范围：Qwen1 → Qwen1.5 → Qwen2 → Qwen2.5 → Qwen3 → Qwen3.5
+> 学习方式：螺旋上升式深度解析，从基石到前沿
+
+---
+
+## 目录
+
+1. [Qwen 系列演进总览](#1-qwen-系列演进总览)
+2. [Qwen1：基石奠定](#2-qwen1基石奠定)
+3. [Qwen1.5：稳步迭代](#3-qwen15稳步迭代)
+4. [Qwen2：全面升级](#4-qwen2全面升级)
+5. [Qwen2.5：数据与后训练的突破](#5-qwen25数据与后训练的突破)
+6. [Qwen3：推理与效率的融合](#6-qwen3推理与效率的融合)
+7. [Qwen3.5：迈向原生多模态智能体](#7-qwen35迈向原生多模态智能体)
+8. [横向对比与关键演进主线](#8-横向对比与关键演进主线)
+
+---
+
+## 1. Qwen 系列演进总览
+
+```
+Qwen1.0 & 1.5  → 高质量数据清洗 + 基础 Transformer 架构
+Qwen2 & 2.5    → 全注意力架构推向 72B，代码和数学能力突破
+Qwen3          → 长上下文 + 推理能力（Thinking Mode）结合，引入 MoE
+Qwen3VL        → 加入视觉编码器和 MRoPE，引入 DeepStack 多层级视觉特征注入
+Qwen3Next      → 引入 GatedDeltaNet + Gated Attention 混合注意力 + 共享专家
+Qwen3.5        → 在 Qwen3Next 基础上加入 MRoPE + Vision，拆分投影层，去掉 DeepStack
+```
+
+**核心演进主线：**
+
+| 维度 | 演进轨迹 |
+|------|----------|
+| 注意力机制 | MHA → GQA → Q/K Norm → Gated Attention → GatedDeltaNet 混合 |
+| 长度外推 | 动态NTK → YaRN+DCA → ABF → MRoPE + Partial RoPE |
+| 训练效率 | BF16 → FP8 流水线 |
+| 对齐训练 | RLHF → Constitutional AI → Online Merging → 四阶段后训练 → 异步RL |
+| 多模态 | 无 → 后融合(Qwen3VL) → Early Fusion(Qwen3.5) |
+| MoE规模 | 60专家 → 256专家 → 512专家 |
+
+---
+
+## 2. Qwen1：基石奠定
+
+**论文：QWEN TECHNICAL REPORT**
+
+### 2.1 模型结构
+
+#### 词表设计（152K）
+
+- 基础：tiktoken BPE，选择 `cl100k_base` 作为起点
+- **扩充中文词汇**：让中文不再被拆得七零八落
+- **数字单独拆分**：`2048` → `2`, `0`, `4`, `8`
+
+**数字拆分的权衡：**
+
+```
+优点：
+→ 模型能感知数字结构（1024 和 2048 都以 0,4,8 结尾）
+→ 数学推理能力显著提升
+
+代价：
+→ 1000000000 → 10个token（原来1个）
+→ 金融、科学类文本序列长度急剧膨胀
+→ 消耗宝贵的上下文窗口
+```
+
+#### Untied Embedding（解耦嵌入）
+
+标准 LLM 的输入嵌入矩阵 = 输出嵌入矩阵（权重共享），而 Qwen1 将两者拆分：
+
+| | 输入侧（理解词） | 输出侧（生成词） |
+|---|---|---|
+| 目标 | 把 token 映射成语义向量 | 把向量还原成最可能的下一个 token |
+| 关心的 | 与上下文的相似关系 | 词表中的概率分布 |
+| 本质 | 做检索（我是谁？） | 做排名（谁最可能出现？） |
+
+**结论**：理解是"聚合语义"，生成是"竞争排名"，强迫共用同一套参数是在让一个人同时用同一只手写字和打架——能做，但都做不到最好。代价是增加内存消耗，但可以显著提升模型性能。
+
+#### Pre-RMSNorm
+
+**Pre-Norm vs Post-Norm：**
+
+```
+Post-Norm（旧方式）：每层操作完再归一化
+→ 理论上限更高，但深层网络梯度不稳定
+→ 需要精细的学习率调参
+
+Pre-Norm（Qwen选择）：每层操作前先归一化
+→ 梯度回传时每层输入幅度可控
+→ 训练稳定，可用更大学习率
+→ 更容易 Scale 到大模型
+```
+
+**RMSNorm vs LayerNorm：**
+
+```python
+# LayerNorm（完整版）
+mean = x.mean()
+var  = x.var()
+x_norm = (x - mean) / sqrt(var + ε)
+
+# RMSNorm（砍掉均值计算）
+rms = sqrt(mean(x²) + ε)
+x_norm = x / rms
+```
+
+均值计算对模型效果贡献极小，砍掉后计算更快，效果几乎不变。
+
+**ε 的作用**：防止分母为零或极小时的数值不稳定（数值爆炸）。
+
+#### SwiGLU 激活函数
+
+**ReLU 的问题**：负数区域梯度为0，神经元可能永久失活。
+
+**SwiGLU 的门控机制：**
+
+```python
+gate   = Linear1(x)   # 门控分支
+signal = Linear2(x)   # 信号分支
+output = signal * Swish(gate)
+# Swish(x) = x * sigmoid(x)，平滑版ReLU
+```
+
+**FFN 维度调整**：SwiGLU 有3个矩阵，标准FFN有2个。为保持参数量不变：
+
+```
+2 × d_model × d_ff = 3 × d_model × d_ff_new
+→ d_ff_new = (2/3) × d_ff
+```
+
+所以使用 SwiGLU 的模型 FFN 隐藏维度是原始的 **2/3**。
+
+#### RoPE 位置编码
+
+**传统正弦编码的问题**：编码的是绝对位置，超出训练长度的位置从未见过，模型完全懵掉。
+
+**RoPE 的核心洞察**：Attention 机制真正需要的不是"我在第几位"，而是"我和你之间差了几位"。
+
+**数学推导**：
+
+```
+位置 m 的向量旋转角度 mθ
+位置 n 的向量旋转角度 nθ
+
+点积结果：
+cos(mθ) × cos(nθ) + sin(mθ) × sin(nθ) = cos((m-n)θ)
+
+→ 相对位置 (m-n) 自动从点积里冒出来！
+→ 天然支持长度外推
+```
+
+**实现方式**：每两个维度一组进行旋转，不同维度用不同的 θ：
+
+```python
+θ_i = 10000^(-2i/d)
+# 低维度：θ大 → 旋转快 → 捕捉短距离关系（类比秒针）
+# 高维度：θ小 → 旋转慢 → 捕捉长距离关系（类比时针）
+```
+
+#### QKV 层保留 Bias
+
+大多数层移除 bias（被 RMSNorm 抵消，浪费参数），但 **QKV 层保留 bias**：
+
+```
+Q = x @ Wq + bq
+K = x @ Wk + bk
+
+bias 提供固定的"基准值"（锚点）
+→ 遇到训练时没见过的位置
+→ bias 提供稳定的参考
+→ 外推时更稳定
+
+类比：口袋里的纸质地图 vs 纯依赖GPS
+```
+
+### 2.2 长度外推技术（2048 → 8192）
+
+三种技术组合，各司其职：
+
+#### 动态 NTK 插值
+
+**NTK 的本质**：修改 RoPE 底数，让所有维度"转慢一点"，防止高频混叠。
+
+```python
+# 原始 RoPE
+θ_i = 10000 ^ (-2i/d)
+
+# 静态 NTK（固定底数）
+k = 目标长度 / 训练长度  # 如 8192/2048 = 4
+new_base = 10000 * (k ^ (d/(d-2)))
+
+# 动态 NTK（按需放大）
+def get_base(current_len, train_len=2048):
+    if current_len <= train_len:
+        return 10000          # 短序列：原汁原味
+    k = current_len / train_len
+    return 10000 * (k ^ (d/(d-2)))  # 长序列：按需扩展
+```
+
+**底数变大 → θ_i 变小 → 旋转变慢 → 不越界**
+
+**三种外推方法对比：**
+
+| 方法 | 核心思路 | 解决了什么 | 引入了什么问题 |
+|------|----------|------------|----------------|
+| 线性插值 | 位置等比例压缩 | 越界问题 | 短距离感知模糊 |
+| 静态 NTK | 固定放大底数 | 越界+精度 | 短序列精度白白损失 |
+| 动态 NTK | 按需放大底数 | 两者兼顾 | 无明显缺陷 |
+| YaRN | 低频插值+高频不动 | 更精细处理 | 实现更复杂 |
+
+#### LogN-Scaling
+
+**问题**：序列变长时，softmax 在更多值中分配注意力权重，导致注意力分布极度分散（聚光灯变泛光灯）。
+
+**解法**：
+
+```
+普通 Attention：scale = 1/√d（固定）
+LogN-Scaling：  scale = κ·log(n)/d（随序列长度增大）
+
+n 变长 → log(n) 变大 → scale 变大
+→ logits 整体放大
+→ softmax 输出更集中
+→ 注意力熵保持稳定（熵不变性）
+```
+
+#### 分层窗口 Self-Attention
+
+```
+低层（捕捉局部语法）：短窗口
+→ 主谓宾关系只需要4-8个词的窗口
+
+高层（捕捉全局语义）：长窗口
+→ 文章主题需要看全文
+
+效果：按需分配算力
+底层：短窗口×多层 → 省算力，够用
+顶层：长窗口×少层 → 花算力，值得
+```
+
+### 2.3 模型训练
+
+| 配置项 | 值 | 说明 |
+|--------|-----|------|
+| 训练目标 | 标准自回归语言模型 | 预测下一个 token |
+| 上下文长度 | 2048 | 训练时固定 |
+| 注意力 | Flash Attention | 提高计算效率 |
+| 精度 | BF16 混合精度 | 速度+稳定性 |
+| 优化器 | AdamW | β1=0.9, β2=0.95, ε=1e-8 |
+| 学习率 | 余弦衰减到峰值的10% | 保留微调空间 |
+
+**β2=0.95 的原因**：
+
+```
+有效记忆窗口 = 1/(1-β2)
+
+β2=0.999 → 记忆1000步（小模型，梯度噪声大）
+β2=0.95  → 记忆20步（大模型，batch极大，梯度已准确）
+
+大模型训练 batch size 极大 → 每步梯度噪声小
+→ 不需要平均那么长的历史
+→ 更快响应当前梯度方向
+```
+
```

**File**: `docs/04-interview/17-coding-exercises.md` (added, +405/-0)
```diff
@@ -0,0 +1,405 @@
+# 第一阶段：神经网络基础算子
+
+## 目标
+
+掌握深度学习最基础的算子实现，建立「手写 = 真懂」的学习习惯。这一关全部是 🟢 简单题，但是大模型所有高级组件的基石。
+
+## 刷题清单
+
+### 激活函数（必刷）
+
+- Implement ReLU· 简单 🟢 简单 — 最基础，理解梯度截断
+- Sigmoid 激活函数· 简单 🟢 简单 — 二分类基础，注意数值稳定性
+- GELU Activation· 简单 🟢 简单 — BERT/GPT 标配，理解 erf 近似
+- Tanh 激活函数· 简单 🟢 简单 — RNN 时代经典
+- LeakyReLU 激活函数· 简单 🟢 简单 — 解决 dying ReLU 问题
+
+### 归一化（必刷）
+
+- Implement LayerNorm· 中等 🟡 中等 — Transformer 核心组件，必须手写
+- Implement RMSNorm· 中等 🟡 中等 — LLaMA 系列标配，比 LayerNorm 更轻量
+- Implement BatchNorm· 中等 🟡 中等 — 理解 running stats 的训练/推理差异
+
+### 基础层
+
+- Implement Softmax· 简单 🟢 简单 — 数值稳定 trick（减 max）是考点
+- Embedding Layer· 简单 🟢 简单 — 词表映射，理解 weight tying
+- Kaiming Initialization· 简单 🟢 简单 — 正确初始化是训练稳定的第一步
+- Implement Dropout· 简单 🟢 简单 — 训练/推理行为不同，逐 token 实现
+- Simple Linear Layer· 中等 🟡 中等 — 手实现 nn.Linear，理解矩阵乘法
+
+## 刷题重点
+
+- 每道题都要先**不看代码**自己推导公式，再实现
+- 重点关注**数值稳定性**（Softmax 减 max、LayerNorm 加 eps）
+- 理解**训练模式 vs 推理模式**的区别（BatchNorm、Dropout）
+
+# 第二阶段：Attention 机制核心
+
+## 目标
+
+Attention 是大模型的心脏。从最基础的缩放点积注意力开始，逐步实现各种变体，理解每次改进解决了什么问题。
+
+## 刷题清单
+
+### 基础（必刷，按顺序）
+
+- 因果注意力掩码· 简单 🟢 简单 — 理解为什么 GPT 需要 mask
+- Softmax Attention· 简单 🟢 简单 — 所有注意力的基础，QKV 计算
+- Causal Self-Attention· 中等 🟡 中等 — 在 Softmax Attention 上加 mask
+- Multi-Head Attention· 困难 🔴 困难 — 多头拆分与合并，完整实现
+
+### 位置编码（必刷）
+
+- Sinusoidal Position Encoding· 简单 🟢 简单 — 原始 Transformer 位置编码
+- Rotary Position Embedding (RoPE)· 中等 🟡 中等 — LLaMA/Qwen 标配，旋转矩阵实现
+
+### 注意力变体（进阶）
+
+- Multi-Head Cross-Attention· 中等 🟡 中等 — Encoder-Decoder 架构基础
+- Grouped Query Attention· 困难 🔴 困难 — LLaMA-2/3 优化，减少 KV 参数量
+- ALiBi Attention· 中等 🟡 中等 — 位置偏置的另一种思路
+- Sliding Window Attention· 中等 🟡 中等 — Mistral 局部注意力，降低复杂度
+- Flash Attention (Tiled)· 困难 🔴 困难 — IO 感知的分块计算，必须理解
+
+## 刷题重点
+
+- **causal-mask → attention → causal-attention → mha**这条线必须一步一步手写
+- Flash Attention 重点理解**分块(tiling)**思想，不要死记公式
+- GQA 的核心：KV head 数 < Q head 数，理解 `repeat_kv` 操作
+
+# 第三阶段：Transformer 完整模块
+
+## 目标
+
+掌握 Transformer 各关键模块，能从零拼装出一个完整 Block，理解各组件之间的依赖关系。
+
+## 刷题清单
+
+### FFN 变体（必刷）
+
+- GLU 门控线性单元· 简单 🟢 简单 — 门控机制基础，sigmoid 作门
+- SwiGLU Activation· 中等 🟡 中等 — LLaMA FFN 标配，SiLU 门控
+- SwiGLU MLP· 中等 🟡 中等 — 完整 FFN 实现，gate/up/down 三矩阵
+
+### 完整 Block（必刷）
+
+- Adaptive LayerNorm Zero (adaLN-Zero)· 中等 🟡 中等 — DiT 条件归一化，扩散模型必考
+- GPT-2 Transformer Block· 困难 🔴 困难 — 完整 GPT Block，理解残差连接顺序
+
+### 编码器-解码器
+
+- Encoder-Decoder 交叉注意力· 中等 🟡 中等 — Seq2Seq 架构，Q 来自 decoder，KV 来自 encoder
+
+### 视觉 Transformer
+
+- ViT Patch Embedding· 中等 🟡 中等 — 图像分块到 token，多模态基础
+- ViT Transformer Block· 困难 🔴 困难 — 视觉 Transformer 完整 Block
+
+## 刷题重点
+
+- GPT-2 Block 的残差连接顺序：**Pre-LN vs Post-LN**的区别是关键考点
+- SwiGLU 理解为什么用三个投影矩阵（gate、up、down），而不是两个
+
+# 第四阶段：损失函数与评估指标
+
+## 目标
+
+大模型训练和评估的"度量衡"。从基础交叉熵到对比学习损失，理解每个损失函数的设计动机。
+
+## 刷题清单
+
+### 基础损失（必刷）
+
+- Cross-Entropy Loss· 简单 🟢 简单 — 语言模型预训练的核心损失
+- 困惑度（Perplexity）· 简单 🟢 简单 — LM 标准评估指标，PPL = exp(CE)
+- KL 散度· 中等 🟡 中等 — 知识蒸馏、VAE、RLHF 中都用到
+- Label Smoothing Loss· 简单 🟢 简单 — 防过拟合的正则化技巧
+
+### 对比学习损失
+
+- Contrastive Loss (InfoNCE)· 中等 🟡 中等 — 对比学习基础，CLIP 前身
+- Triplet Loss· 中等 🟡 中等 — 三元组损失，嵌入模型训练
+
+### 评估与生成
+
+- Token 准确率· 简单 🟢 简单 — 序列预测准确率，注意 ignore_index
+- BLEU 评分· 中等 🟡 中等 — 机器翻译标准评估，n-gram 精度
+- 知识蒸馏损失· 中等 🟡 中等 — 软标签蒸馏，KL + CE 加权
+
+### MoE 专项
+
+- MoE Load Balancing Loss· 中等 🟡 中等 — 防止 expert collapse 的辅助损失
+- Focal Loss· 中等 🟡 中等 — 解决类别不平衡，检测模型常用
+- Multi-Token Prediction Loss· 中等 🟡 中等 — Meta LLaMA-3 的 MTP 预训练目标
+
+## 刷题重点
+
+- KL 散度的**非对称性**：$KL(P\|Q) \neq KL(Q\|P)$，蒸馏时 student 逼近 teacher
+- InfoNCE 理解为什么分母要遍历所有负样本（in-batch negative）
+
+# 第五阶段：训练优化技术
+
+## 目标
+
+工业级大模型训练的核心工程技术：优化器、学习率调度、梯度处理、内存优化。
+
+## 刷题清单
+
+### 优化器（必刷）
+
+- Adam Optimizer· 中等 🟡 中等 — 现代 LLM 训练标配，一阶+二阶矩
+- AdamW 优化器· 中等 🟡 中等 — 解耦权重衰减，比 Adam+L2 更正确
+
+### 学习率调度
+
+- 线性学习率预热· 简单 🟢 简单 — 训练初期防梯度爆炸
+- Cosine LR Scheduler with Warmup· 中等 🟡 中等 — LLM 训练标配调度策略
+- EMA 指数移动平均· 简单 🟢 简单 — 模型权重平滑，推理性能更稳定
+
+### 梯度处理
+
+- Gradient Norm Clipping· 简单 🟢 简单 — 防梯度爆炸，稳定训练必备
+- Gradient Accumulation· 简单 🟢 简单 — 模拟大 batch size，显存受限时必用
+
+### 内存优化（进阶）
+
+- Activation Checkpointing· 中等 🟡 中等 — 用计算换内存，训练大模型必备
+- Mixed Precision Training Step· 中等 🟡 中等 — FP16 前向 + FP32 权重，loss scaling
+
+## 刷题重点
+
+- **Adam vs AdamW**：权重衰减应该加在梯度上（L2）还是直接加在参数上（AdamW）
+- Gradient Clipping：clip by norm vs clip by value 的区别
+- 混合精度：理解 loss scaling 为什么能防止 FP16 梯度下溢
+
+# 第六阶段：参数高效微调
+
+## 目标
+
+用不到 1% 的参数量达到全量微调的效果。LoRA 系列是大模型微调领域最重要的工程技术，面试必考。
+
+## 刷题清单
+
+- LoRA (Low-Rank Adaptation)· 中等 🟡 中等 — 低秩分解微调，最重要的 PEFT 方法
+- QLoRA· 困难 🔴 困难 — 量化 + LoRA，4-bit 显存运行大模型
+- Prefix Tuning 前缀微调· 中等 🟡 中等 — 软提示词，冻结主干只训 prefix
+- INT8 Quantized Linear· 困难 🔴 困难 — 量化基础，理解 scale/zero-point
+
+## 核心知识点
+
+### LoRA 原理
+
+$$W' = W_0 + \Delta W = W_0 + BA$$
+
+- $W_0$：冻结的预训练权重（$d \times k$）
+- $B \in \mathbb{R}^{d \times r}$，$A \in \mathbb{R}^{r \times k}$，秩 $r \ll \min(d, k)$
+- 只训练 $A$ 和 $B$，参数量从 $O(dk)$ 降到 $O(r(d+k))$
+- 推理时可合并：$W' = W_0 + BA$，**无额外延迟**
+
+### QLoRA 额外知识
+
+- NF4（Normal Float 4-bit）量化：比均匀量化更好地保留信息
+- Double Quantization：对量化常
```

**File**: `resources/learning-resources.md` (modified, +25/-1)
```diff
@@ -375,4 +375,28 @@
 
 - **实践驱动**：利用nanoGPT、LLMs From Scratch等项目进行开发实践。
 - **社区参与**：加入OpenAI Academy或Hugging Face社区，与专家交流。
-- **持续学习**：定期关注DeepLearning.AI、斯坦福CS25等平台更新。
\ No newline at end of file
+- **持续学习**：定期关注DeepLearning.AI、斯坦福CS25等平台更新。
+
+---
+
+### 学习 Prompt 模板
+
+> 以下是一个"渐进式深度学习导师"的 Prompt 模板，可以粘贴到 ChatGPT / Claude 等对话中，将 `【任意内容】` 替换为你想学习的主题，即可获得螺旋上升式的深度教学体验。
+
+```
+你现在是我的"渐进式深度学习导师兼资深架构师"。我们将对【任意内容】进行从零到一的深度探索。
+请严格遵循以下"螺旋上升"的教学机制与我进行多轮互动：
+
+学习路径的四个阶段：
+1. 基石奠定（通俗且详尽）：用生活化的类比解释该概念的本质；详细拆解其基础构成要素；结合一个最简单的应用场景进行说明。
+2. 机制与原理（深入骨髓）：引入核心算法、数据流向或底层逻辑；解释"为什么"它被设计成这样，解决了传统方法的哪些痛点。
+3. 工程实践与落地（贴近业务）：给出该概念在工业界的最优实践（Best Practices）；提供极简但直击核心的伪代码或真实代码片段并逐行注释；探讨在真实环境（如大规模并发、资源受限）下的"坑"及解决方案。
+4. 前沿探索（SOTA）：介绍该领域最新的研究进展、开源框架或顶流趋势；探讨尚未解决的挑战和未来的演进方向。
+
+核心交互规则（请严格遵守）：
+- 绝对不要一次性给我倾倒所有信息。每次回答只推进一个微小的知识节点。
+- 每次回答的结尾，必须向我提出 1 到 2 个启发式的追问，或者给我布置一个微型任务，以检验我的理解深度。
+- 只有在我回答了你的问题，且你确认我理解无误后，你才能解锁下一个深度的知识。如果我理解有误或感到困惑，请立刻降级难度，换一个具体的例子重新解释。
+
+如果你清楚了规则，请确认，并直接开启第一阶段的第一个微小知识点。
+```
\ No newline at end of file
```

---

### Incident Patch 15: `213a4499` (2026-04-20)
**Commit Message**: Merge upstream/main: sync with adongwanai/AgentGuide latest

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +88/-7)
```diff
@@ -45,6 +45,7 @@
 
 **🎯 核心内容**：
 - [💡 关于本项目](#-关于本项目) - Agent开发指南、转行大模型、高级RAG、大模型面试
+- [🆕 求职新范式](#-求职新范式做出什么--学过什么) - 1-2-5框架、个人品牌、投递策略
 - [🚦 6步学习路径](#-从零到offer的完整路径快速导航) - 从岗位选择到拿Offer
 - [🔬 算法岗 vs 🛠️ 开发岗](#-第一步确定你的目标岗位) - 岗位选择决策树
 - [📚 学习路线图](#-第三步基于岗位的学习路线) - 算法岗10-15周 | 开发岗8-12周
@@ -243,11 +244,20 @@
 
 ## 🚦 从零到Offer的完整路径（快速导航）
 
-> **👋 新来的同学看这里！按照这6个步骤，8-10周拿到Offer！**
+> **👋 新来的同学看这里！先看新范式，再按步骤执行，8-10周拿到Offer！**
 
 <table>
 <tr>
-<td align="center" width="16.6%">
+<td align="center" width="14.3%">
+
+**🆕 新范式**
+
+[求职新范式](#-求职新范式做出什么--学过什么)
+
+做出什么 > 学过什么
+
+</td>
+<td align="center" width="14.3%">
 
 **🎯 第一步**
 
@@ -256,7 +266,7 @@
 算法 vs 开发？
 
 </td>
-<td align="center" width="16.6%">
+<td align="center" width="14.3%">
 
 **💡 第二步**
 
@@ -265,7 +275,7 @@
 如何准备？
 
 </td>
-<td align="center" width="16.6%">
+<td align="center" width="14.3%">
 
 **📚 第三步**
 
@@ -274,7 +284,7 @@
 学什么？
 
 </td>
-<td align="center" width="16.6%">
+<td align="center" width="14.3%">
 
 **💼 第四步**
 
@@ -283,7 +293,7 @@
 做什么？
 
 </td>
-<td align="center" width="16.6%">
+<td align="center" width="14.3%">
 
 **🎓 第五步**
 
@@ -292,7 +302,7 @@
 技术细节
 
 </td>
-<td align="center" width="16.6%">
+<td align="center" width="14.3%">
 
 **🎯 第六步**
 
@@ -311,6 +321,77 @@
 
 ---
 
+## 🆕 求职新范式：做出什么 > 学过什么
+
+> **⚡ 求职规则已经变了。2026年，HC:投递比约1:200，核心问题不再是"我够不够格"，而是"我用什么方式让自己被看见"。**
+
+### 1-2-5 求职框架
+
+| 维度 | 内容 |
+|:---|:---|
+| **1个原则** | 从"我会什么"转向"我做出了什么" |
+| **2条轨道** | Agent开发（工程落地）vs Agent算法（研究创新） |
+| **5步链路** | 简历 → 投递 → 模拟面试 → Vibe Coding → 成果展示 |
+
+> **工具不再是壁垒，你用工具做出的东西才是。**
+
+### 旧方式 vs 新范式
+
+| 环节 | 旧方式 | 新范式 |
+|:---|:---|:---|
+| 简历 | 一份通用简历打天下 | AI读JD，动态生成针对性版本 |
+| 投递 | 手动上传，逐一投递 | 一键全网投，AI做适配分析 |
+| 模拟面试 | 背八股，刷题库 | AI扮演面试官，无限迭代实战 |
+| Vibe Coding | 手写算法题 | AI协作设计Agent系统 |
+| 成果展示 | PDF+截图 | 个人站+在线demo+社区影响力 |
+
+### 个人品牌：让面试官主动找你
+
+**个人网站必备要素（免费部署：Vercel/GitHub Pages，5分钟上线）：**
+- 每个项目一个页面 + **在线可访问的demo链接**
+- 技术Blog：至少3篇有深度的原理解析
+- 社区数据：GitHub Star数 / 真实用户数
+- 时间线里程碑
+
+**简历项目描述公式：**
+> ❌ 「参与开发了一个AI客服系统」
+> ✅ 「基于LangGraph + MCP构建多Agent客服系统，工具调用成功率94%，响应时长从3.2s降至0.8s，日处理10万+对话」
+
+### 投递策略：AI筛简历时代的人工突围
+
+招聘方也在用AI筛简历——两个AI在对话，人的主动触达反而更稀缺。
+
+**核心目标公司（5-10家）走人工路线：**
+1. LinkedIn找具体的Hiring Manager或Team Lead
+2. 提前关注他们的开源项目/技术Blog
+3. 带着具体问题主动联系（不是「请问还招人吗？」）
+4. 目标：一个warm intro，不是冷申请
+
+**时机窗口：** 3-6月提前批竞争烈度比8-9月低30-40%，往往是真正的机会窗口。
+
+**AI辅助投递工具：**
+- [Auto Job Apply](https://zread.ai/loks666/get_jobs) - 开源自动投递简历工具，支持批量投递与AI简历适配
+
+### 说几句实话
+
+- **语言不是门槛，设计才是。** Python/TypeScript AI都能帮你写。但Agent状态机怎么设计、Memory何时截断、工具调用失败如何fallback——这些必须你自己想清楚、讲明白。
+- **AI工具人人都有，判断力才是壁垒。** 会用Cursor写代码不算竞争力。当AI给你一个错误的Agent设计，你能30秒内发现并说清楚为什么错——这才是L5和L3的分水岭。
+- **分享即异步面试。** 一篇深度Blog、一个有Star的仓库，相当于提前通过了一轮面试。
+- **拿结果说话。** 不是"我学过LangChain"，是"我用LangGraph做了一个有300个真实用户的工具"。
+
+### 新增优质资源
+
+| 资源 | 简介 | 链接 |
+|:---|:---|:---|
+| **Learn Claude Code** | 从零构建迷你Claude Code，12节渐进式，覆盖工具调用/子Agent/上下文压缩/多Agent协作 | [GitHub](https://github.com/shareAI-lab/learn-claude-code) |
+| **claw0** | 10章10个核心概念~7000行Python，从while循环到生产级Agent网关 | [GitHub](https://github.com/shareAI-lab/claw0) |
+| **hello-agents（Datawhale）** | 《从零开始构建智能体》，16章，含MCP实战、DeepResearch复现、多Agent协同 | [GitHub](https://github.com/datawhalechina/hello-agents) |
+| **OpenClaw** | 生产级个人AI助手框架，支持Telegram/Discord/Slack等 | [GitHub](https://github.com/openclaw/openclaw) |
+| **Anthropic官方：Building Effective Agents** | Anthropic工程团队出的Agent设计原则，面试必读 | [链接](https://www.anthropic.com/engineering/building-effective-agents) |
+| **Vibe Coding 教程** | 从零掌握AI协作编程，Cursor/Claude Code实操指南，Vibe Coding面试攻略 | [链接](https://adongwanai.github.io/vibecoding/) |
+
+---
+
 ## 🎯 第一步：确定你的目标岗位
 
 > **核心理念：选择 > 努力！选对方向，事半功倍！**
```

**File**: `data/resources.json` (modified, +242/-242)
```diff
@@ -8,7 +8,7 @@
     "level": "入门",
     "type": "教程",
     "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/archive/2.md",
-    "date": "2026-03-09",
+    "date": "2026-04-02",
     "featured": false
   },
   {
@@ -20,79 +20,79 @@
     "level": "入门",
     "type": "指南",
     "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/16-llm-fundamentals.md",
-    "date": "2026-03-09",
+    "date": "2026-04-02",
     "featured": false
   },
   {
-    "id": "ai-agent",
-    "title": "AI Agent 面试题库 - 开放性讨论篇",
-    "description": "- ✅ 所有岗位（软技能与思维考察） - ✅ 展示你的思考方式、学习能力和职业规划 - ⏱️ 建议准备时间：2天",
+    "id": "",
+    "title": "校招生谈薪实用指南",
+    "description": "根据十年HR的经验，遇到这类谈薪的校招生，通常会建议业务部门给到预算内最高薪资：",
     "category": "求职",
     "tags": [],
     "level": "入门",
     "type": "指南",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/15-open-discussion.md",
-    "date": "2026-03-09",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/09-salary-negotiation.md",
+    "date": "2026-04-02",
     "featured": false
   },
   {
-    "id": "",
-    "title": "校招生谈薪实用指南",
-    "description": "根据十年HR的经验，遇到这类谈薪的校招生，通常会建议业务部门给到预算内最高薪资：",
+    "id": "hr",
+    "title": "HR 面试常见问题与应对技巧",
+    "description": "> 本文档整理了校招/社招中 HR 面试环节的高频问题及应对策略，帮助你更好地准备面试。",
     "category": "求职",
     "tags": [],
     "level": "入门",
     "type": "指南",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/09-salary-negotiation.md",
-    "date": "2026-03-09",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/10-hr-interview.md",
+    "date": "2026-04-02",
     "featured": false
   },
   {
-    "id": "ai-agent",
-    "title": "AI Agent 面试题库 - 编程实战篇",
-    "description": "- ✅ 算法工程师（手撕核心算法） - ✅ 开发工程师（实现系统模块） - ⏱️ 建议学习时间：3-5天",
+    "id": "",
+    "title": "真实面经案例集锦",
+    "description": "- 本文收集了各大公司的真实面经案例 - 保留了完整的面试轮次和问题上下文 - 建议先通过分类题库学习,再结合真实案例模拟练习",
     "category": "求职",
     "tags": [],
     "level": "入门",
     "type": "指南",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/04-coding-questions.md",
-    "date": "2026-03-09",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/12-company-interview-cases.md",
+    "date": "2026-04-02",
     "featured": false
   },
   {
-    "id": "ai-agent-llm",
-    "title": "AI Agent 面试题库 - LLM 前景与发展篇",
-    "description": "- ✅ 所有岗位（开放性讨论题） - ✅ 展示对行业的理解和洞察 - ⏱️ 建议准备时间：2-3天",
+    "id": "",
+    "title": "开发岗专项面试题库",
+    "description": "- AI 应用开发工程师 - Agent 开发工程师 - RAG 系统工程师",
     "category": "求职",
     "tags": [],
     "level": "入门",
     "type": "指南",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/14-llm-future-trends.md",
-    "date": "2026-03-09",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/06-development-specialized.md",
+    "date": "2026-04-02",
     "featured": false
   },
   {
-    "id": "",
-    "title": "真实面经案例集锦",
-    "description": "- 本文收集了各大公司的真实面经案例 - 保留了完整的面试轮次和问题上下文 - 建议先通过分类题库学习,再结合真实案例模拟练习",
+    "id": "ai-agent-agent",
+    "title": "AI Agent 面试题库 - 模型评估与 Agent 评估篇",
+    "description": "- ✅ 算法评测工程师（重点学习） - ✅ 算法工程师（评估体系设计） - ✅ 开发工程师（评估工具使用） - ⏱️ 建议学习时间：算法岗3天，开发岗2天",
     "category": "求职",
     "tags": [],
     "level": "入门",
     "type": "指南",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/12-company-interview-cases.md",
-    "date": "2026-03-09",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/13-model-evaluation.md",
+    "date": "2026-04-02",
     "featured": false
   },
   {
-    "id": "ai-agent-agent",
-    "title": "AI Agent 面试题库 - Agent 核心篇",
-    "description": "- ✅ Agent 算法工程师（必学，优化策略） - ✅ Agent 开发工程师（必学，系统搭建） - ⏱️ 建议学习时间：算法岗5天，开发岗4天",
+    "id": "ai-agent",
+    "title": "AI Agent 面试题库 - 开放性讨论篇",
+    "description": "- ✅ 所有岗位（软技能与思维考察） - ✅ 展示你的思考方式、学习能力和职业规划 - ⏱️ 建议准备时间：2天",
     "category": "求职",
     "tags": [],
     "level": "入门",
     "type": "指南",
-    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/03-agent-questions.md",
-    "date": "2026-03-09",
+    "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/15-open-discussion.md",
+    "date": "2026-04-02",
     "featured": false
   },
   {
@@ -104,67 +104,79 @@
     "level": "入门",
     "type": "指南",
     "url": "https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/08-job-hunting-guide.md",
-    "date": "2026-03-09",
+    "date": "2026-04-02",
     "featured": false
   },
   {
-    "id": "",
-    "title": "开发岗专项面试题库",
-    "description": "- AI 应用开发工程师 - Agent 开发工程师 - RAG 系统工程师",
+    "id": "07-career-transition",
+    "title": "07-career-transition",
+    "description": "**关键问题：算法和开发如何划分？**",
     "category": "求职",
     "tags": [],
     "level": "入门",
     "type": "指南",
-    "url": "https://github.com/adongwanai/AgentGuide
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

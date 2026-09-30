# Forensic Learning Record (Deep Inspection): jnMetaCode/agency-orchestrator

> **Canonical Artifact**: `07_PROJECT_LEARNING/jnmetacode-agency-orchestrator-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jnMetaCode/agency-orchestrator](https://github.com/jnMetaCode/agency-orchestrator))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:20:29.519Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jnMetaCode/agency-orchestrator`
- **Description**: 🚀 One sentence → your one-person company of AI experts → complete deliverable in minutes. 276 CN + 184 EN + 5 more languages (ko/ru/pt-BR/id/ar) · zero-code YAML · auto-verified acceptance · Web Studio / Desktop / Docker · 15 LLM providers (11 key-free). 一句话组建你的「一人公司」AI 专家团队，几分钟交付完整方案；验收自动核验，网页 / 桌面 / Docker 全渠道。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2311 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eval/gate.ts`
```
/**
 * 评测回归门禁 —— 纯逻辑，便于单测；run-eval.ts 跑完后据此判 pass/fail。
 *
 * 设计要点（吸取教训：judge 太弱会给出无判别力的"平局"，绝不能被当成通过）：
 *  1. judge 可信度不足（双向盲评一致率低）→ 判 inconclusive（不可信），既不算通过也不算失败；
 *  2. 多专家胜率低于阈值 → 失败；
 *  3. 相对基线快照胜率明显下滑 → 失败（回归）。
 */

export interface EvalSummary {
  /** 有效评测的工作流数（排除报错/judge 全失败的） */
  evaluated: number;
  multiWins: number;
  baseWins: number;
  ties: number;
  /** 末次双向盲评一致（有判别力）的工作流数 */
  reliable: number;
}

export interface BaselineSnapshot {
  winRate: number;
  reliability?: number;
  date?: string;
}

export interface GateThresholds {
  /** 多专家胜率下限 = multiWins / evaluated */
  minWinRate: number;
  /** judge 可信度下限 = reliable / evaluated；低于此判 inconclusive */
  minReliability: number;
  /** 相对基线胜率允许的最大下滑 */
  maxRegression: number;
}

export const DEFAULT_THRESHOLDS: GateThresholds = {
  minWinRate: 0.6,
  minReliability: 0.6,
  maxRegression: 0.1,
};

export interface GateResult {
  pass: boolean;
  /** judge 太弱/无样本 → 结论不可信（不等于失败，但也不放行） */
  inconclusive: boolean;
  winRate: number;
  reliability: number;
  reasons: string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function decideGate(
  s: EvalSummary,
  baseline: BaselineSnapshot | null = null,
  th: GateThresholds = DEFAULT_THRESHOLDS,
): GateResult {
  const reasons: string[] = [];

  if (s.evaluated <= 0) {
    return { pass: false, inconclusive: true, winRate: 0, reliability: 0, reasons: ["没有有效评测样本（可能全部报错或 judge 解析失败）"] };
  }

  const winRate = s.multiWins / s.evaluated;
  const reliability = s.reliable / s.evaluated;

  // 1) judge 可信度
  const inconclusive = reliability < th.minReliability;
  if (inconclusive) {
    reasons.push(
      `judge 判别力不足：双向盲评一致率 ${pct(reliability)} < ${pct(th.minReliability)}，结果不可信。请改用更强的 judge（设 AO_JUDGE_PROVIDER / AO_JUDGE_MODEL 指向有能力的模型）。`,
    );
  }

  // 2) 胜率阈值
  if (winRate < th.minWinRate) {
    reasons.push(`多专家胜率 ${pct(winRate)} < 阈值 ${pct(th.minWinRate)}（胜 ${s.multiWins}/${s.evaluated}）。`);
  }

  // 3) 相对基线回归
  let regressed = false;
  if (baseline && typeof baseline.winRate === "number") {
    if (winRate < baseline.winRate - th.maxRegression) {
      regressed = true;
      reasons.push(`相对基线胜率回归：${pct(winRate)} < 基线 ${pct(baseline.winRate)} − 容忍 ${pct(th.maxRegression)}。`);
    }
  }

  const pass = !inconclusive && winRate >= th.minWinRate && !regressed;
  if (pass) reasons.push(`通过：多专家胜率 ${pct(winRate)}（≥ ${pct(th.minWinRate)}），judge 可信度 ${pct(reliability)}。`);

  return { pass, inconclusive, winRate, reliability, reasons };
}

export function formatGate(r: GateResult): string {
  const head = r.inconclusive ? "⚠️ 不可信（INCONCLUSIVE）" : r.pass ? "✅ 通过（PASS）" : "❌ 失败（FAIL）";
  return [`评测门禁：${head}`, ...r.reasons.map((x) => `  - ${x}`)].join("\n");
}

```

### Core Architecture Module: `eval/golden-tasks.ts`
```
/**
 * 黄金评测任务集 —— 评测闭环的稳定输入。
 *
 * 每条 = 一个旗舰内置工作流 + 一组代表性输入，覆盖创作 / 社媒 / 商业 / 分析 / 产品五类，
 * 用来回答核心假设「多专家 DAG 协作是否真的优于一句话 one-shot」，并能看出在哪类任务上稳赢。
 * 改动这里 = 改动评测口径，请保持任务有代表性、输入零歧义。
 */
export interface GoldenTask {
  /** workflows/ 下的文件名 */
  file: string;
  /** 任务类别（用于分析多专家在哪类任务上稳赢） */
  category: "创作" | "社媒" | "商业" | "分析" | "产品";
  /** required 无默认的字段在这里补；留空表示用工作流自带 default */
  inputs: Record<string, string>;
}

export const GOLDEN_TASKS: GoldenTask[] = [
  { file: "story-creation.yaml", category: "创作", inputs: {} },
  { file: "tech-blog.yaml", category: "创作", inputs: { topic: "用 Rust 重写 Python 数据处理热点函数：从 12 秒到 0.8 秒的实战与踩坑" } },
  { file: "ai-opinion-article.yaml", category: "创作", inputs: { topic: "为什么大多数人用不好 AI：不是模型不行，是不会提问" } },
  { file: "xiaohongshu-viral-post.yaml", category: "社媒", inputs: { topic: "职场新人前 3 个月避坑指南" } },
  { file: "douyin-script.yaml", category: "社媒", inputs: { topic: "30 岁转行做程序员还来得及吗" } },
  { file: "pitch-deck-outline.yaml", category: "商业", inputs: { startup_idea: "用 AI 帮跨境电商中小卖家自动生成多语言商品详情页，降低本地化成本" } },
  { file: "okr-decomposition.yaml", category: "商业", inputs: { annual_goal: "让 SaaS 产品年度经常性收入 ARR 从 200 万做到 1000 万" } },
  { file: "investment-analysis.yaml", category: "分析", inputs: { target: "纳斯达克100指数ETF" } },
  {
    file: "product-review.yaml",
    category: "产品",
    inputs: {
      prd_content: [
        "# PRD：工作流执行结果一键分享",
        "## 背景：用户跑完多智能体工作流后想把成果分享给同事/客户，目前只能复制粘贴文本，排版丢失、不美观。",
        "## 目标：让用户一键把某次运行结果生成一个可分享的网页链接（含各步骤产出、可折叠）。",
        "## 范围：1) 运行结束后 CLI 给出「生成分享链接」提示；2) 上传到对象存储生成短链；3) 网页端只读展示，支持按步骤折叠、复制单步。",
        "## 非目标：不做评论/协作编辑；不做权限系统（链接即访问）。",
        "## 指标：分享转化率（跑完→生成链接）>20%；被分享链接的人均打开数。",
      ].join("\n"),
    },
  },
];

/** 兼容旧用法：filename → inputs 映射 */
export const GOLDEN_FIXTURES: Record<string, Record<string, string>> = Object.fromEntries(
  GOLDEN_TASKS.map((t) => [t.file, t.inputs]),
);

```

### Core Architecture Module: `eval/run-eval.ts`
```
/**
 * Phase 1 质量评测闭环：多智能体产出 vs 单次 prompt 基线，盲评打分。
 *
 * 回答项目的核心假设——"多角色 DAG 协作的产出，是否真的比用户自己写一句 prompt 更好"。
 *
 * 用法：
 *   npx tsx eval/run-eval.ts [workflow1.yaml ...]    # 默认评 story-creation
 *   AO_EVAL_PROVIDER=ollama AO_EVAL_MODEL=llama3 npx tsx eval/run-eval.ts
 *   （换强模型做评审更可信：AO_EVAL_PROVIDER=deepseek AO_EVAL_MODEL=deepseek-chat + key）
 *
 * 方法学：
 *  - 基线 = 把工作流的目标+输入合成"一句话直接要最终成品"的单次调用（模拟用户不用 ao 的做法）。
 *  - 盲评 = 同一 judge 模型，对 (A=多智能体,B=基线) 和交换后的 (A=基线,B=多智能体) 各评一次，
 *    取平均 → 抵消 LLM 评审最大的位置偏置。judge 不知道哪份来自 ao。
 */
import { resolve, basename } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { run } from '../src/index.js';
import { parseWorkflow } from '../src/core/parser.js';
import type { LLMConfig, InputDefinition } from '../src/types.js';
import { buildBaselineTask, runBaseline, finalOutput, compareOutputs } from '../src/core/compare.js';
import { GOLDEN_FIXTURES } from './golden-tasks.js';
import { decideGate, formatGate, type EvalSummary, type BaselineSnapshot } from './gate.js';

const isCli = (p: string) => p.endsWith('-cli') || p === 'claude-code';
const modelFor = (p: string, env?: string) => env || (isCli(p) ? '' : 'llama3');

// 生成与评审分离：生成用弱模型（ollama，测 ao 真实卖点——分工能否抬高弱模型），
// 评审用强模型（claude-code，给可信判别）。AO_EVAL_PROVIDER 作为两者的旧版兜底。
const GEN_PROVIDER = process.env.AO_GEN_PROVIDER || process.env.AO_EVAL_PROVIDER || 'ollama';
const GEN_MODEL = modelFor(GEN_PROVIDER, process.env.AO_GEN_MODEL || process.env.AO_EVAL_MODEL);
const JUDGE_PROVIDER = process.env.AO_JUDGE_PROVIDER || 'claude-code';
const JUDGE_MODEL = modelFor(JUDGE_PROVIDER, process.env.AO_JUDGE_MODEL);
const RUNS = Math.max(1, parseInt(process.env.AO_EVAL_RUNS || '1', 10)); // 每模板跑 N 次取平均，压噪音

const genLlm: LLMConfig = { provider: GEN_PROVIDER, model: GEN_MODEL, max_tokens: 2048, timeout: 600_000 };
const judgeLlm: LLMConfig = { provider: JUDGE_PROVIDER, model: JUDGE_MODEL, max_tokens: 400, timeout: 600_000 };

// 黄金任务集（filename → 输入）来自 eval/golden-tasks.ts，覆盖创作/社媒/商业/分析/产品五类。
const FIXTURES = GOLDEN_FIXTURES;

// 解析参数：--xxx 为开关，其余位置参数为指定的工作流路径。
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const GATE = flags.has('--gate');                 // 跑完后做回归门禁判定，失败 exit 1
const SAVE_BASELINE = flags.has('--save-baseline'); // 把本次结果写入 eval/baseline.json 作为基线
const BASELINE_PATH = resolve(import.meta.dirname!, 'baseline.json');

const workflows = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (workflows.length === 0) {
  for (const name of Object.keys(FIXTURES)) workflows.push(`workflows/${name}`);
}

/** 用 inputs 的 default 补全（与 run() 的注入一致），得到评测用的实际输入值 */
function resolveInputs(defs: InputDefinition[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs || []) if (d.default !== undefined) out[d.name] = d.default;
  return out;
}

interface EvalRow {
  workflow: string; multiScore: number; baseScore: number;
  winner: 'multi-agent' | 'baseline' | 'tie'; reasons: string[];
  multiLen: number; baseLen: number;
  /** 末次盲评双向是否一致；false 多半是 judge 位置偏置→无判别力 */
  consistent: boolean;
  runs: number;       // 实际有效评测次数
  multiWins: number;  // N 次里多智能体得分更高的次数（稳定性）
  error?: string;
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

async function evalOne(wfPath: string): Promise<EvalRow> {
  const name = basename(wfPath);
  const row: EvalRow = { workflow: name, multiScore: 0, baseScore: 0, winner: 'tie', reasons: [], multiLen: 0, baseLen: 0, consistent: false, runs: 0, multiWins: 0 };
  try {
    const wf = parseWorkflow(resolve(wfPath));
    const inputs = { ...resolveInputs(wf.inputs), ...(FIXTURES[name] || {}) };
    const baselineTask = buildBaselineTask(wf.name, wf.description, inputs);
    console.log(`\n▶ ${name}`);

    const mScores: number[] = [], bScores: number[] = [], mLens: number[] = [], bLens: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      console.log(`  · run ${r + 1}/${RUNS}: 生成(${GEN_PROVIDER})…`);
      const result = await run(wfPath, inputs, {
        quiet: true, outputDir: 'eval-output/.runs',
        llmOverride: { provider: GEN_PROVIDER, model: GEN_MODEL },
      });
      const multiOut = finalOutput(result);
      const baseOut = await runBaseline(genLlm, baselineTask);

      console.log(`    盲评(${JUDGE_PROVIDER})…`);
      const verdict = await compareOutputs(judgeLlm, baselineTask, multiOut, baseOut);
      if (!verdict) { console.log('    ⚠️ judge 解析失败，跳过本 run'); continue; }

      mScores.push(verdict.multiScore); bScores.push(verdict.baseScore);
      mLens.push(multiOut.length); bLens.push(baseOut.length);
      if (verdict.multiScore > verdict.baseScore) row.multiWins++;
      if (row.reasons.length < 2) row.reasons = verdict.reasons;
      row.consistent = verdict.consistent;
      row.runs++;
    }
    if (row.runs === 0) { row.error = 'judge 全部解析失败'; return row; }
    row.multiScore = avg(mScores); row.baseScore = avg(bScores);
    row.multiLen = Math.round(avg(mLens)); row.baseLen = Math.round(avg(bLens));
    row.winner = row.multiScore > row.baseScore ? 'multi-agent'
      : row.baseScore > row.multiScore ? 'baseline' : 'tie';
  } catch (err) {
    row.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  }
  return row;
}

(async () => {
  const setup = `生成 ${GEN_PROVIDER}/${GEN_MODEL || '默认'}　评审 ${JUDGE_PROVIDER}/${JUDGE_MODEL || '默认'}　每模板 ${RUNS} 次取平均`;
  console.log(`\n=== AO 质量评测闭环 ===`);
  console.log(`${setup}　|　工作流 ${workflows.length} 个`);
  console.log(`方法：多智能体 vs 单次基线，judge 双向盲评取平均（抵消位置偏置）`);

  const rows: EvalRow[] = [];
  for (const wf of workflows) rows.push(await evalOne(wf));

  // 报告
  const lines: string[] = ['# AO 质量评测报告', '', setup, ''];
  lines.push('| 工作流 | 多智能体 | 单次基线 | 胜者 | 稳定性(多胜/总) | 末次可信度 | 多/基线长度 |');
  lines.push('|---|---|---|---|---|---|---|');
  let multiWins = 0, baseWins = 0, ties = 0, evaluated = 0, lowConf = 0;
  for (const r of rows) {
    if (r.error) { lines.push(`| ${r.workflow} | — | — | ⚠️ ${r.error} | — | — | — |`); continue; }
    evaluated++;
    if (r.winner === 'multi-agent') multiWins++; else if (r.winner === 'baseline') baseWins++; else ties++;
    if (!r.consistent) lowConf++;
    const mark = r.winner === 'multi-agent' ? '✅ 多智能体' : r.winner === 'baseline' ? '❌ 基线' : '➖ 平';
    const conf = r.consistent ? '高' : '低(位置偏置)';
    lines.push(`| ${r.workflow} | ${r.multiScore.toFixed(1)} | ${r.baseScore.toFixed(1)} | ${mark} | ${r.multiWins}/${r.runs} | ${conf} | ${r.multiLen}/${r.baseLen} |`);
  }
  lines.push('', `**汇总**：评测 ${evaluated} 个 — 多智能体胜 ${multiWins}，基线胜 ${baseWins}，平 ${ties}`);
  if (lowConf > 0) {
    lines.push('', `⚠️ ${lowConf}/${evaluated} 个末次盲评可信度低（位置偏置）。多次取平均可压噪音；如仍多为低可信，说明 judge 判别力不足或两份产出确实接近。`);
  }
  for (const r of rows) if (r.reasons.length) lines.push('', `### ${r.workflow}`, ...r.reasons.map(x => `- ${x}`));

  const report = lines.join('\n');
  console.log('\n' + report + '\n');
  mkdirSync('eval-output', { recursive: true });
  writeFileSync('eval-output/report.md', report + '\n', 'utf-8');
  console.log('报告已写入 eval-output/report.md');

  // ── 回归门禁 / 基线 ──
  const summary: EvalSummary = { evaluated, multiWins, baseWins, ties, reliable: evaluated - lowConf };
  const winRate = evaluated > 0 ? summary.multiWins / summary.evaluated : 0;

  if (SAVE_BASELINE) {
    const snap: BaselineSnapshot = {
      winRate,
      reliability: evaluated > 0 ? summary.reliable / summary.evaluated : 0,
      date: new Date().toISOString().slice(0, 10),
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(snap, null, 2) + '\n', 'utf-8');
    console.log(`基线已保存到 ${BASELINE_PATH}`);
  }

  if (GATE) {
    let baseline: BaselineSnapshot | null = null;
    if (existsSync(BASELINE_PATH)) {
      try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')); } catch { /* 无效基线则忽略 */ }
    }
    const result = decideGate(summary, baseline);
    console.log('\n' + formatGate(result) + '\n');
    
```

### Core Architecture Module: `scripts/gen-style-samples.mjs`
```
#!/usr/bin/env node
// 给风格库（src/media/styles.ts）的每个风格出一张**示例图**。
//
// 风格库现在只有文字：中文名 + 一段摄影机/胶片/色调/光源的英文后缀。Studio 下拉里选风格时
// 有张图比读一段英文直观得多（小云雀风格库就是一格一图）。不放占位图冒充——要么真出，要么留空。
//
// **这个脚本会花钱**（图片按张计费，各家单价不同、这里不猜），所以默认**空跑**：只打印会出哪些、
// 用哪家哪个模型；加 --yes 才真的发请求。图片供应商与模型**必须显式给**（各家模型编码不通用，不猜）。
//
// 用法：
//   node scripts/gen-style-samples.mjs --provider lanox --model <图片模型>            # 空跑
//   LANOX_API_KEY=... node scripts/gen-style-samples.mjs --provider lanox --model <m> --yes
//   ... --yes --only neon-cyberpunk,wuxia-realism                                   # 只出几张
//
// 产物落 website/public/style-samples/<id>.png（装了 ffmpeg 会压到 640 宽），并把
// sample 字段写回 src/media/styles.ts（正则定位 `id: '<id>'` 那一行）。写回后记得 npm run build。
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage } from '../dist/connectors/image.js';
import { STYLE_PRESETS } from '../dist/media/styles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const OUTDIR = join(repoRoot, 'website', 'public', 'style-samples');
const STYLES_TS = join(repoRoot, 'src', 'media', 'styles.ts');

const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const GO = argv.includes('--yes');
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const PROVIDER = arg('provider', '');
const MODEL = arg('model', '');
const SIZE = arg('size', '1024x1024');
if (!PROVIDER || !MODEL) {
  console.error('必须显式给 --provider 与 --model（图片模型编码各家不通用，不猜）。例：--provider lanox --model <该家的图片模型>');
  process.exit(2);
}

// 同一个中性主体，只让风格后缀变化——示例图才有可比性
const SUBJECT = 'a person in their thirties walking along a quiet street at dusk, medium shot, natural pose, no text, no watermark';
const targets = STYLE_PRESETS.filter((s) => !ONLY.length || ONLY.includes(s.id));

console.log(`风格示例图：${targets.length} 张 · 供应商 ${PROVIDER} · 模型 ${MODEL} · ${SIZE}`);
for (const s of targets) console.log(`  ${existsSync(join(OUTDIR, `${s.id}.png`)) ? '✓' : '·'} ${s.id}  ${s.name}`);
if (!GO) { console.log('\n空跑结束。确认后加 --yes 真的出图（按张计费，单价看服务商）。'); process.exit(0); }

mkdirSync(OUTDIR, { recursive: true });
let hasFfmpeg = false;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); hasFfmpeg = true; } catch { /* 没有就不压 */ }
let ts = readFileSync(STYLES_TS, 'utf-8');
let done = 0;
for (const s of targets) {
  const out = join(OUTDIR, `${s.id}.jpg`);
  if (existsSync(out) && !argv.includes('--force')) { console.log(`跳过（已有）${s.id}`); continue; }
  const prompt = `${SUBJECT}. ${s.prompt}`;
  process.stdout.write(`🎨 ${s.id} … `);
  try {
    const img = await generateImage({ provider: PROVIDER, model: MODEL }, prompt, { provider: PROVIDER, model: MODEL, size: SIZE }, (m) => process.stdout.write(`\n   ${m}\n`));
    writeFileSync(out, img.buffer);
    if (hasFfmpeg) {
      const tmp = `${out}.tmp.jpg`;
      execFileSync('ffmpeg', ['-y', '-i', out, '-vf', 'scale=640:-2', '-q:v', '4', tmp], { stdio: 'ignore' });
      writeFileSync(out, readFileSync(tmp));
      execFileSync('rm', ['-f', tmp]);
    }
    const rel = `/style-samples/${s.id}.jpg`;
    // 写回 styles.ts：该风格对象里若已有 sample 就替换，否则在 prompt 字段后插入
    const re = new RegExp(`(\\{ id: '${s.id}',[\\s\\S]*?)(,\\s*sample: '[^']*')?(\\s*\\},?)`);
    ts = ts.replace(re, (m, head, _old, tail) => `${head}, sample: '${rel}'${tail}`);
    done++;
    console.log(`${(statSync(out).size / 1024).toFixed(0)}KB`);
  } catch (e) {
    console.log(`失败：${e instanceof Error ? e.message.split('\n')[0] : e}`);
  }
}
writeFileSync(STYLES_TS, ts);
console.log(`\n完成 ${done}/${targets.length}。已写回 ${STYLES_TS} 的 sample 字段——记得 npm run build，再提交 website/public/style-samples/。`);

```

### Core Architecture Module: `scripts/gen-video-previews.mjs`
```
#!/usr/bin/env node
// 给创意库的视频题材模板生成**示例成片**。
//
// 为什么要自己出片：22 个 5 段式题材模板现在只有文字，卡片上一个画面都没有。
// 找过开源现成的——生态里所有"带示例视频"的库，视频要么是 OpenAI showcase 的外链、
// 要么是推特 CDN（会失效），没有一个是"自己托管 + 许可明确"。自己跑一遍最干净：
// 版权归我们、可自托管、想重拍就重拍。
//
// **这个脚本会花钱**：秘塔 768P 0.09 元/秒，默认每条 5 秒 ≈ 0.45 元，22 条 ≈ 10 元。
// 所以默认是**空跑**（只打印会花多少、跑哪些），加 --yes 才真的发请求。
//
// 用法：
//   node scripts/gen-video-previews.mjs                    # 空跑：看清单与预估费用
//   METASO_API_KEY=mk-... node scripts/gen-video-previews.mjs --yes
//   ... --yes --only animal-vlog,micro-drama               # 只跑指定几条
//   ... --yes --resolution 480p --duration 4               # 更省的档
//
// 产物落 website/public/video-previews/<id>.mp4，并把相对路径写回 video-prompts.json 的
// preview 字段。装了 ffmpeg 会再压一版（480 宽、无音轨）——原片 2K 几十 MB 直接进仓库
// 会把网站部署拖垮，卡片预览也用不着那个清晰度。
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVideo } from '../dist/connectors/video.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
// --pool genre（默认，22 个题材模板）| community（47 条社区成品提示词：现在挂的是 OpenAI/推特外链，会失效，换成自托管）
const POOL = (process.argv.includes('--pool') ? process.argv[process.argv.indexOf('--pool') + 1] : 'genre') || 'genre';
const DATA = join(repoRoot, 'website', 'src', 'content', POOL === 'community' ? 'video-prompts-community.json' : 'video-prompts.json');
const OUTDIR = join(repoRoot, 'website', 'public', 'video-previews');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const GO = argv.includes('--yes');
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const RESOLUTION = arg('resolution', '768P');
const DURATION = Number(arg('duration', 5));
const PROVIDER = arg('provider', 'metaso');
const MODEL = arg('model', 'MiniMax-H3');
// 单价表只写**已经核实过的**：秘塔官网标价 768P 0.09 元/秒、2K 0.15 元/秒。
// 没核实过的档位不猜价——宁可显示"单价未知"，也不给用户一个编出来的数字。
const PRICE = { '768P': 0.09, '2K': 0.15 };

const data = JSON.parse(readFileSync(DATA, 'utf-8'));
const genres = POOL === 'community'
  ? data.templates.filter((t) => t.kind === 'community' && t.prompt)
  : data.templates.filter((t) => t.lang === 'zh' && t.kind === 'genre' && t.prompt);

/** 把模板正文里的 {{变量}} 用变量表给的示例取值填上——变量表存在就是为了这个。 */
function fill(t) {
  let text = t.prompt;
  for (const v of t.variables ?? []) {
    const val = String(v.example || '').replace(/[（(].*?[)）]\s*$/, '').trim();
    if (!val) continue;
    text = text.replaceAll(`{{${v.name}}}`, val);
  }
  // 没填上的占位符原样留着会被模型当字面量念出来，剔掉更安全
  return text.replace(/\{\{[^}]+\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

const todo = genres.filter((t) => {
  if (ONLY.length && !ONLY.includes(t.id)) return false;
  return !(t.preview && String(t.preview).startsWith('/video-previews/') && existsSync(join(OUTDIR, `${t.id}.mp4`)));      // 已经有的跳过，可断点续跑
});

const unit = PRICE[RESOLUTION];
const cost = unit ? (todo.length * DURATION * unit).toFixed(2) : null;
console.log(`题材模板 ${genres.length} 个，待生成 ${todo.length} 条（${RESOLUTION} × ${DURATION}s，${PROVIDER}/${MODEL}）`);
console.log(cost ? `预估费用：约 ${cost} 元（${unit} 元/秒 × ${DURATION}s × ${todo.length}）` : '预估费用：该分辨率单价未核实，不猜');
if (!GO) {
  console.log('\n这是空跑。确认要花这笔钱就加 --yes；先试一条可以：--yes --only ' + (todo[0]?.id ?? 'animal-vlog'));
  process.exit(0);
}
if (!process.env.METASO_API_KEY && !process.env[`${PROVIDER.toUpperCase()}_API_KEY`]) {
  console.error(`❌ 没有 ${PROVIDER} 的 key（环境变量 METASO_API_KEY）`);
  process.exit(1);
}

mkdirSync(OUTDIR, { recursive: true });
let ok = 0, fail = 0;
for (const t of todo) {
  const out = join(OUTDIR, `${t.id}.mp4`);
  process.stdout.write(`  ${t.id} … `);
  // 厂商限速（Agnes 6 次/分钟）：撞 429 就等一分钟再试，最多 3 轮；别让一批全秒失败
  const withRetry = async (fn) => {
    for (let i = 0; ; i++) {
      try { return await fn(); }
      catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        if (/HTTP 429|rate limit/i.test(m) && i < 3) { process.stdout.write(`限速，等 65s 再试(${i + 1}/3)… `); await new Promise((r) => setTimeout(r, 65_000)); continue; }
        throw e;
      }
    }
  };
  try {
    const vid = await withRetry(() => generateVideo(
      { provider: PROVIDER },
      fill(t),
      { model: MODEL, resolution: RESOLUTION, duration: DURATION, ratio: '16:9' },
      () => {},
    ));
    writeFileSync(out, vid.buffer);
    // 压一版：卡片预览不需要原始清晰度，而原片进仓库会把部署拖垮
    try {
      execFileSync('ffmpeg', ['-y', '-i', out, '-vf', 'scale=480:-2', '-an', '-c:v', 'libx264',
        '-crf', '30', '-preset', 'slow', '-movflags', '+faststart', `${out}.tmp.mp4`], { stdio: 'ignore' });
      const before = statSync(out).size, after = statSync(`${out}.tmp.mp4`).size;
      if (after > 0 && after < before) {
        execFileSync('mv', [`${out}.tmp.mp4`, out]);
        console.log(`✅ ${(after / 1024 / 1024).toFixed(1)}MB（原 ${(before / 1024 / 1024).toFixed(1)}MB）`);
      } else {
        console.log(`✅ ${(before / 1024 / 1024).toFixed(1)}MB（压缩没变小，保留原片）`);
      }
    } catch {
      console.log(`✅ ${(statSync(out).size / 1024 / 1024).toFixed(1)}MB（没装 ffmpeg，未压缩）`);
    }
    // 社区池原来的外链示例（OpenAI/推特 CDN）保留一份，别丢
    if (t.preview && /^https?:\/\//.test(String(t.preview)) && !t.previewOrigin) t.previewOrigin = t.preview;
    t.preview = `/video-previews/${t.id}.mp4`;
    // 来源标注：创意库卡片上显示"由 X 家 Y 模型出片"——这是给赞助商最实在的展示位
    t.previewBy = { provider: PROVIDER, model: MODEL, resolution: RESOLUTION, seconds: DURATION };
    writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8');   // 每条落盘，中断不白花钱
    ok++;
  } catch (e) {
    console.log(`❌ ${e instanceof Error ? e.message.split('\n')[0].slice(0, 120) : e}`);
    fail++;
  }
}
console.log(`\n完成 ${ok} 条${fail ? `，失败 ${fail} 条（重跑只补没生成的）` : ''}`);
console.log('别忘了：这批 mp4 要提交进仓库才会随官网部署；先看一眼质量，不满意的删掉重跑。');

```

### Core Architecture Module: `scripts/import-creative-extra.mjs`
```
#!/usr/bin/env node
// 「创意库 · 扩充池」导入器，两个源：
//   源 A: jau123/nanobanana-trending-prompts（**CC BY 4.0**）—— 1446 条，
//         **逐条带作者、原推链接、点赞数、预览图**，出处最干净，全量收
//   源 B: YouMind-OpenLab/ai-image-prompts-skill（**MIT**）—— 2.2 万条策展库，
//         但逐条没有作者（整库策展），按分类取样收
// → website/src/content/creative-prompts-extra.json
//
// 与已有的 229 条（creative-prompts.json，CC BY 4.0，两个源）分开放，理由有三个：
//   1. 许可不同（MIT vs CC BY 4.0），署名文案不一样，混在一起就会给错署名
//   2. 那 229 条是有 SEO 静态页的；这批**不进 sitemap**（同一批提示词在 youmind.com
//      也公开，两个域名各挂一份会互相稀释权重——canonical 归属没定之前不生成页面）
//   3. 这批体量大，前端按需 import，不能拖累首屏
//
// 上游 2.2 万条不可能整包塞进前端（≈33MB）。这里按分类取样：每类最多 PER_CAT 条，
// 优先取提示词长度适中的（太短没信息量、太长在卡片里读不完），并按提示词指纹去重。
//
// 用法：
//   git clone --depth 1 https://github.com/YouMind-OpenLab/ai-image-prompts-skill /tmp/ymskill
//   node scripts/import-creative-extra.mjs /tmp/ymskill
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
// 内容体检规则与 prune 脚本共用一份，避免"两处规则改一处"（见 prune-extra-prompts.mjs 文件头）
import { violation } from './prune-extra-prompts.mjs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const OUT = join(repoRoot, 'website', 'src', 'content', 'creative-prompts-extra.json');
const EXISTING = join(repoRoot, 'website', 'src', 'content', 'creative-prompts.json');

const src = process.argv[2];          // ai-image-prompts-skill 仓库根（源 B）
const trendSrc = process.argv[3];     // nanobanana-trending-prompts 仓库根（源 A，可选）
if (!src || !existsSync(join(src, 'references', 'manifest.json'))) {
  console.error('用法: node scripts/import-creative-extra.mjs <ai-image-prompts-skill 根> [nanobanana-trending-prompts 根]\n' +
    '  git clone --depth 1 https://github.com/YouMind-OpenLab/ai-image-prompts-skill\n' +
    '  git clone --depth 1 https://github.com/jau123/nanobanana-trending-prompts');
  process.exit(1);
}

// 每个分类最多收多少条。上游分布极不均（social-media-post 9559 条、youtube-thumbnail 218 条），
// 不设上限就会被一个分类淹没；设了上限，各分类才都有得挑。
const PER_CAT = Number(process.env.PER_CAT || 50);
// 提示词太短没信息量，太长在卡片里根本读不完（上游最长 11548 字）
const MIN_LEN = 200;
const MAX_LEN = 3500;

// 上游分类 → 本站分类。本站原有 12 类是中文、按用途分；对不上的补两类（UI/网页、游戏 / 资产），
// 不硬塞进「其他」——那等于让用户翻不到。
const CAT_MAP = {
  'profile-avatar': '人像 / 写真',
  'social-media-post': '海报 / 广告',
  'poster-flyer': '海报 / 广告',
  'youtube-thumbnail': '海报 / 广告',
  'product-marketing': '电商 / 产品',
  'ecommerce-main-image': '电商 / 产品',
  'infographic-edu-visual': '信息图 / 排版',
  'comic-storyboard': '动漫 / 漫画',
  'game-asset': '游戏 / 资产',
  'app-web-design': 'UI / 网页',
  others: '其他',
};

/**
 * trending 源没有 title 字段，只能从提示词里取。直接拿首行会把推文口水话当标题
 * （实测出现过「Nano Banana 2 on @Hailuo_AI」这种），所以先剥掉：
 * "Prompt:" 之前的引子、@提及、链接、行首的表情与序号，再在词边界截断。
 */
function titleFrom(text) {
  let t = String(text || '');
  const m = t.match(/(?:^|\n)\s*(?:prompt|提示词)\s*[:：]\s*([\s\S]+)/i);
  if (m) t = m[1];
  t = t.split('\n').find((l) => l.trim().length > 12) || t;
  t = t.replace(/https?:\/\/\S+/g, ' ')          // 链接
       .replace(/@[A-Za-z0-9_]+/g, ' ')            // @提及
       .replace(/^[\s\-–—*#>0-9.、)）]+/, '')      // 行首序号/符号
       .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')  // 表情
       .replace(/\s+/g, ' ')
       .trim();
  if (t.length <= 56) return t;
  const cut = t.slice(0, 56);
  const brk = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  return (brk > 24 ? cut.slice(0, brk) : cut).trim() + '…';
}

const fingerprint = (s) => createHash('sha1').update(s.replace(/\s+/g, ' ').trim().slice(0, 400)).digest('hex');

// 与已有 229 条去重：同一条提示词在两个源里都出现过时，保留原有那条（它有中文标题与作者署名）
const seen = new Set();
if (existsSync(EXISTING)) {
  for (const p of JSON.parse(readFileSync(EXISTING, 'utf-8')).prompts ?? []) seen.add(fingerprint(p.prompt || ''));
}
const before = seen.size;

const out = [];
let skippedLen = 0, skippedDup = 0, skippedJson = 0, skippedRisky = 0;

// ── 源 A：trending（CC BY 4.0，逐条署名）——全量收，并且**先收**：
// 后面源 B 里若有同一条提示词，会因指纹去重被跳过，从而保住这边的作者署名。
const TREND_CAT = {
  'Photography': '摄影 / 影视',
  'Illustration & 3D': '插画 / 绘画',
  'Product & Brand': '电商 / 产品',
  'Poster Design': '海报 / 广告',
  'Food & Drink': '美食 / 饮品',
  'UI & Graphic': 'UI / 网页',
};
if (trendSrc && existsSync(join(trendSrc, 'prompts', 'prompts.json'))) {
  const items = JSON.parse(readFileSync(join(trendSrc, 'prompts', 'prompts.json'), 'utf-8'));
  for (const it of items) {
    const text = String(it.prompt || '').trim();
    if (text.length < MIN_LEN || text.length > MAX_LEN) { skippedLen++; continue; }
    // 有一批条目整条是 JSON 参数块（{"generation_request": …}）——卡片里既读不懂、
    // 标题也只能截出一段花括号，复制走对多数模型也不通用。跳过。
    if (/^[[{]/.test(text) || /"generation_request"|"prompt"\s*:/.test(text.slice(0, 200))) { skippedJson++; continue; }
    // 指名真人 / IP 角色 / 露骨描述：不适合挂在公开产品页上（规则见 prune-extra-prompts.mjs）
    if (violation({ title: it.title, prompt: text })) { skippedRisky++; continue; }
    const fp = fingerprint(text);
    if (seen.has(fp)) { skippedDup++; continue; }
    seen.add(fp);
    out.push({
      id: `tr-${it.id}`,
      title: it.title ? String(it.title).trim().slice(0, 60) : titleFrom(text),
      description: '',
      prompt: text,
      category: TREND_CAT[(it.categories || [])[0]] || '其他',
      image: it.image || (it.images || [])[0] || '',
      author: it.author_name || it.author || '',
      authorUrl: it.author ? `https://x.com/${String(it.author).replace(/^@/, '')}` : '',
      source: 'nanobanana-trending',
      sourceUrl: it.source_url || '',
    });
  }
}

const manifest = JSON.parse(readFileSync(join(src, 'references', 'manifest.json'), 'utf-8'));

for (const cat of manifest.categories ?? []) {
  const file = join(src, 'references', cat.file);
  if (!existsSync(file)) continue;
  const items = JSON.parse(readFileSync(file, 'utf-8'));
  // 取样偏好：长度落在舒适区间、带预览图、标题与描述齐全的优先
  const ranked = items
    .filter((it) => {
      const len = (it.content || '').length;
      if (len < MIN_LEN || len > MAX_LEN) { skippedLen++; return false; }
      if (/^[[{]/.test(String(it.content || '').trim())) { skippedJson++; return false; }   // 同源 A：整条 JSON 参数块不收
      if (violation({ title: it.title, prompt: it.content })) { skippedRisky++; return false; }
      return it.title && Array.isArray(it.sourceMedia) && it.sourceMedia[0];
    })
    .sort((a, b) => (b.description ? 1 : 0) - (a.description ? 1 : 0));

  let taken = 0;
  for (const it of ranked) {
    if (taken >= PER_CAT) break;
    const fp = fingerprint(it.content);
    if (seen.has(fp)) { skippedDup++; continue; }
    seen.add(fp);
    out.push({
      id: `ymx-${cat.slug}-${it.id}`,
      title: String(it.title).trim(),
      description: String(it.description || '').trim(),
      prompt: String(it.content).trim(),
      category: CAT_MAP[cat.slug] || '其他',
      image: it.sourceMedia[0],
      // 上游逐条没有作者字段（是整库策展），署名落到源仓库层面
      author: '', authorUrl: '',
      source: 'ai-image-prompts-skill',
      needRef: !!it.needReferenceImages,
    });
    taken++;
  }
}

writeFileSync(OUT, JSON.stringify({
  note: '创意库扩充池：来自 YouMind-OpenLab/ai-image-prompts-skill（MIT）。'
      + '由 scripts/import-creative-extra.mjs 生成，**别手改**。与 creative-prompts.json（CC BY 4.0）'
      + '分开存：许可不同、署名文案不同，且这批不生成 SEO 静态页。',
  sources: [
    { key: 'nanobanana-trending', name: 'jau123/nanobanana-trending-prompts', url: 'https://github.com/jau123/nanobanana-trending-prompts', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
    { key: 'ai-image-prompts-skill', name: 'YouMind-OpenLab/ai-image-prompts-skill', url: 'https://github.com/YouMind-OpenLab/ai-image-prompts-skill', license: 'MIT', gallery: 'https://youmind.com/nano-banana-pro-prompts' },
  ],
  perCategoryCap: PER_CAT,
  count: out.length,
  prompts: out,
}, null, 2) + '\n', 'utf-8');

const byCat = out.reduce((m, p) => (m[p.category] = (m[p.category] || 0) + 1, m), {});
const bySrc = out.reduce((m, p
```

### Core Architecture Module: `scripts/import-creative-prompts.mjs`
```
#!/usr/bin/env node
// 多源整合「创意提示词库」（图像生成）。源均为 CC BY 4.0，内置时在 UI 标注出处与作者署名。
//   源 A: YouMind/awesome-nano-banana-pro-prompts（README_zh.md，含预览图 URL）
//   源 B: jimmylv/awesome-nano-banana（cases/*/case.yml，结构化，图取 raw GitHub）
// 只存「文本提示词 + 预览图 URL（外链，不下载）」，保持轻量、版权干净。
//
// 用法：node scripts/import-creative-prompts.mjs <youmind README_zh.md> <jimmylv repo 根> <out.json>

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

const [youmindReadme, jimmylvRoot, out] = process.argv.slice(2);
if (!out) { console.error('用法: node scripts/import-creative-prompts.mjs <youmind README_zh.md> <jimmylv 根> <out.json>'); process.exit(1); }

// 更细的分类（关键词启发式；命不中归「其他」）。
const CATEGORY_RULES = [
  ['人像 / 写真', /人像|肖像|自拍|写真|portrait|证件照|大头照|形象照/i],
  ['电商 / 产品', /电商|产品|商品|主图|包装|带货|详情页|手机壳|周边/i],
  ['海报 / 广告', /海报|广告|banner|宣传|封面|kv|促销|活动图/i],
  ['信息图 / 排版', /信息图|infographic|图表|流程|排版|卡片|bento|知识图|时间线|思维导图/i],
  ['Logo / 品牌', /logo|标志|品牌|vi|徽章|图标|icon/i],
  ['插画 / 绘画', /插画|illustration|手绘|线稿|水彩|油画|素描|绘本/i],
  ['国风 / 水墨', /国风|水墨|中国风|工笔|古风|山水/i],
  ['3D / 手办', /3d|手办|玩偶|盲盒|渲染|c4d|建模|q版|chibi|粘土|clay/i],
  ['动漫 / 漫画', /动漫|漫画|二次元|anime|manga|赛璐璐|分镜|条漫/i],
  ['角色 / IP', /角色|character|ip|吉祥物|mascot|表情|贴纸|emoji/i],
  ['摄影 / 影视', /摄影|photo|电影|剧照|cinematic|镜头|胶片|写真集|大片/i],
  ['建筑 / 空间', /建筑|室内|空间|场景|展厅|店铺|装修/i],
];
function categorize(text) {
  for (const [name, re] of CATEGORY_RULES) if (re.test(text)) return name;
  return '其他';
}

const prompts = [];

// ── 源 A：YouMind README_zh.md ──
if (youmindReadme && existsSync(youmindReadme)) {
  const md = readFileSync(youmindReadme, 'utf-8');
  const blocks = md.split(/\n### No\. \d+:/).slice(1);
  const titles = [...md.matchAll(/\n### No\. \d+:\s*(.+)/g)].map((m) => m[1].trim());
  blocks.forEach((block, i) => {
    const promptM = block.match(/####\s*📝\s*提示词\s*\n+```[^\n]*\n([\s\S]*?)\n```/);
    if (!promptM) return;
    const prompt = promptM[1].trim();
    const title = titles[i] || `Prompt ${i + 1}`;
    const descM = block.match(/####\s*📖\s*描述\s*\n+([\s\S]*?)\n+####/);
    const description = descM ? descM[1].trim() : '';
    const imgM = block.match(/<img src="(https:\/\/cms-assets\.youmind\.com[^"]+)"/);
    const authorM = block.match(/-\s*\*\*作者:\*\*\s*\[([^\]]+)\]\(([^)]+)\)/);
    prompts.push({
      id: `ym-${i + 1}`, title, description, prompt,
      category: categorize(`${title} ${description}`),
      image: imgM ? imgM[1] : '',
      author: authorM ? authorM[1] : '', authorUrl: authorM ? authorM[2] : '',
      source: 'YouMind',
    });
  });
}

// ── 源 B：jimmylv/awesome-nano-banana cases/*/case.yml ──
if (jimmylvRoot && existsSync(join(jimmylvRoot, 'cases'))) {
  const RAW = 'https://raw.githubusercontent.com/jimmylv/awesome-nano-banana/main/cases';
  const dirs = readdirSync(join(jimmylvRoot, 'cases')).filter((d) => existsSync(join(jimmylvRoot, 'cases', d, 'case.yml')));
  for (const d of dirs) {
    try {
      const c = yaml.load(readFileSync(join(jimmylvRoot, 'cases', d, 'case.yml'), 'utf-8'));
      const prompt = (c.prompt || c.prompt_en || '').trim();
      if (!prompt) continue;
      const title = (c.title || c.title_en || `Case ${d}`).trim();
      prompts.push({
        id: `jl-${d}`, title, description: (c.reference_note || '').trim(), prompt,
        category: categorize(`${title} ${c.prompt || ''}`),
        image: c.image ? `${RAW}/${encodeURIComponent(d)}/${encodeURIComponent(c.image)}` : '',
        author: c.author || '', authorUrl: c.author_link || '',
        source: 'awesome-nano-banana',
      });
    } catch { /* skip bad case */ }
  }
}

const dataset = {
  model: 'Nano Banana / Gemini 图像生成',
  sources: [
    { name: 'YouMind-OpenLab/awesome-nano-banana-pro-prompts', url: 'https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
    { name: 'jimmylv/awesome-nano-banana', url: 'https://github.com/jimmylv/awesome-nano-banana', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  ],
  count: prompts.length,
  prompts,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(dataset, null, 2), 'utf-8');
const byCat = {}; const bySrc = {};
prompts.forEach((p) => { byCat[p.category] = (byCat[p.category] || 0) + 1; bySrc[p.source] = (bySrc[p.source] || 0) + 1; });
const withImg = prompts.filter((p) => p.image).length;
console.log(`✅ ${prompts.length} 条 → ${out}（带预览图 ${withImg} 条）`);
console.log('按源:', JSON.stringify(bySrc));
console.log('按分类:', JSON.stringify(byCat));

```

### Core Architecture Module: `scripts/import-video-community.mjs`
```
#!/usr/bin/env node
// 视频提示词「社区池」导入器：zhangchenchen/awesome_sora2_prompt（**MIT**）
// → website/src/content/video-prompts-community.json
//
// 与 video-prompts.json（姊妹项目 ai-shortfilm-prompts 的 22 个 5 段式题材模板）分开存：
//   - 那批是**结构化模板**（变量表 + 5 段式），这批是**成品单条提示词**（英文、无变量）
//   - 那批出处唯一（同作者 MIT），这批是社区收集：官方样例 + 推特热门混在一起
//   - 混进同一份数据，卡片就要在"有没有变量"上到处分支，署名也会给错
//
// 两条过滤纪律：
//   1. **指名真人 / 影视 IP 的直接不收**（@某人、明星名、Marvel/Disney 之类）——
//      这与角色库里「视频提示词工程师」写的规则一致：避开 IP 词与真人姓名。
//   2. OpenAI 官方样例单独标源：那段文字是 OpenAI 发布的 showcase，MIT 覆盖的是
//      收录者的整理工作，不是原文著作权——署名要如实写清楚它从哪来。
//
// 用法：
//   git clone --depth 1 https://github.com/zhangchenchen/awesome_sora2_prompt /tmp/sora2
//   node scripts/import-video-community.mjs /tmp/sora2
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
// 内容体检规则与图片扩充池共用一份（见 prune-extra-prompts.mjs 文件头）
import { violation } from './prune-extra-prompts.mjs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const OUT = join(repoRoot, 'website', 'src', 'content', 'video-prompts-community.json');

const src = process.argv[2];
if (!src || !existsSync(join(src, 'prompts'))) {
  console.error('用法: node scripts/import-video-community.mjs <awesome_sora2_prompt 仓库根>');
  process.exit(1);
}

// 文件 → 本站分类 + 出处口径
const FILES = {
  'hyperrealism-landscapes.md': { category: '写实 / 风光', origin: 'community' },
  'sora2-viral-prompts.md': { category: '社区热门', origin: 'community' },
  'official-prompts.md': { category: '官方样例', origin: 'openai-showcase' },
};

// 指名真人与影视 IP 的一律不收（见文件头纪律 1）。名单不可能穷尽，所以只挡最常见的，
// 并在 UI 上如实说明"社区来源可能含真人/IP"——**告知，而不是假装过滤干净了**。
const RISKY = /@\w+|sam\s*altman|\bsama\b|elon|musk|trump|taylor swift|marvel|avengers|disney|pixar|pokemon|star\s*wars|harry potter|mario\b|batman|spider-?man/i;

const items = [];
let skippedRisky = 0;

for (const [file, meta] of Object.entries(FILES)) {
  const path = join(src, 'prompts', file);
  if (!existsSync(path)) continue;
  const md = readFileSync(path, 'utf-8');
  // ### 标题 → 正文里找 **Prompt:** / **Full Prompt:** 后的代码块
  for (const m of md.matchAll(/^###\s+(.+?)\n([\s\S]*?)(?=^###\s|$(?![\s\S]))/gm)) {
    const title = m[1].trim();
    const pm = m[2].match(/\*\*(?:Full )?Prompt:\*\*\s*\n+```[^\n]*\n([\s\S]*?)\n```/);
    if (!pm) continue;
    const prompt = pm[1].trim();
    // 本地 RISKY 挡的是"拿真人编段子"这类推文（@某人、明星名）；violation() 是与图片池
    // 共用的那套（指名真人 / IP 角色作主体 / 露骨），两层都过才收
    if (RISKY.test(prompt) || RISKY.test(title) || violation({ title, prompt })) { skippedRisky++; continue; }
    const video = m[2].match(/\*\*Video Link:\*\*\s*\[[^\]]*\]\(([^)]+)\)/);
    items.push({
      id: `sora2-${basename(file, '.md')}-${items.length + 1}`,
      kind: 'community',
      // 英文原文，但中英两个界面都该看得到——不像 5 段式模板那样有中英两版
      lang: 'any',
      title,
      category: meta.category,
      description: '',
      variables: [],
      prompt,
      // 只收直接指向视频文件的链接：源里混着指向文章页的（openai.com/index/sora-2/），
      // 那种塞进 <video> 就是一个永远转圈的黑框。失效链接由 prune 时的探活清掉。
      preview: video && /\.mp4($|\?)/i.test(video[1]) ? video[1] : '',
      origin: meta.origin,
      source: 'https://github.com/zhangchenchen/awesome_sora2_prompt',
      license: 'MIT',
      author: meta.origin === 'openai-showcase' ? 'OpenAI Sora showcase' : 'awesome_sora2_prompt',
    });
  }
}

writeFileSync(OUT, JSON.stringify({
  note: '视频提示词社区池：来自 zhangchenchen/awesome_sora2_prompt（MIT）。'
      + '由 scripts/import-video-community.mjs 生成，**别手改**。'
      + '与 video-prompts.json（姊妹项目的 5 段式题材模板）分开存：那批有变量表与结构，这批是成品单条。',
  source: { name: 'zhangchenchen/awesome_sora2_prompt', url: 'https://github.com/zhangchenchen/awesome_sora2_prompt', license: 'MIT' },
  count: items.length,
  templates: items,
}, null, 2) + '\n', 'utf-8');

const byCat = items.reduce((m, i) => (m[i.category] = (m[i.category] || 0) + 1, m), {});
console.log(`✅ ${OUT}`);
console.log(`   收 ${items.length} 条：${Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join('、')}`);
console.log(`   跳过（指名真人/IP）：${skippedRisky}`);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #102** (2026-08-09): **桌面版  hermes codex gemini全部调用不了**
  *Symptoms*: 在windows平台下运行出现以下问题  gemini已经弃用  现在官方更新为  antigravity了  codex已经弃用  现在官方整合进了 chatgpt app里了 <img width="1395" height="539" alt="Image" src="https://github.com/user-attachments/assets/83d520a9-48e7-4a17-9b90-acb7b5ebd7a2" />  <img width="1438" height="480" alt="Image" src="https://github.com/user-attachments/assets/3eb95d3b-a9f8-4432-8103-9a5f46df75d4" />  一下是windows平台下的命令  ` hermes -h usage: hermes [-h] [--version] [-z PROMPT] [--usage-file PATH] [-m MODEL] [--provider PROVIDER] [--reasoning LEVEL]               [-t TOOLSETS] [--resume SESSION] [--no-restore-cwd] [--continue [SESSION_NAME]] [--worktree]               [--accept-hooks] [--skills SKILLS] [--yolo] [--pass-session-id] [--ignore-user-config] [--ignore-rules]               [--safe-mode] [--tui] [--cli] [--dev]               {chat,model,moa,fallback,secrets,egress,migrate,gateway,proxy,lsp,setup,whatsapp,whatsapp-cloud,slack,send,login,logout,auth,status,cron,sync,webhook,portal,kanban,project,hooks,doctor,security,approvals,dump,debug,backup,checkpoints,import,import-agent,config,skin,console,pairing,skills,bundles,plugins,curator,pets,journey,learning,memory-graph,memory,tools,computer-use,mcp,sessions,insights,monitoring,claw,version,update,uninstall,acp,profile,completion,dashboard,serve,desktop,gui,logs,prompt-size}               ...  Hermes Agent - AI assistant with tool-calling capabilities  positional arguments:   {chat,model,moa,fallback,secrets,egress,migrate,gateway,proxy,lsp,setup,whatsapp,whatsapp-cloud,sl
  **Post-Mortem & Fix Analysis**:
  > 已定位并修复 ✅ 桌面端 **0.4.2** 已发布，现在就能下载复测：https://github.com/jnMetaCode/agency-orchestrator/releases/tag/desktop-v0.4.2 （Windows 选 `Agency.Orchestrator.Setup.0.4.2.exe`）。npm 包 0.13.0 随后跟上，发出后我在这里同步。  **根因不在这些 CLI，在 AO 自己。** 你截图里的 `命令语法不正确。(exit 1)` 是 cmd.exe 自己吐的报错。AO 在 Windows 下用 `shell: true` 启动 CLI，而 Node 在 shell 模式下会把命令和参数**用空格裸拼成一整行**丢给 cmd.exe，不做任何引号/转义。AO 送进去的提示词必然是这个形状：  ``` <system> <角色系统提示词> </system>  <任务> ```  cmd.exe 于是把 `<` 当输入重定向、`>` 当输出重定向、换行当命令结束 —— 每一次调用都死在解析阶段，跟模型、账号、CLI 版本都无关。你手动 `hermes -z "..."` 能通，正是因为你自己加了引号。这也解释了为什么 hermes / codex / gemini **一起**挂：它们踩的是同一个坑。  **修法**：绕开 shell。解析 PATH×PATHEXT 拿到真实可执行文件后——  - `.exe`（pip/pipx 装的 hermes 就是这种）直接启动，参数由 Node 按 Windows 规则转义，换行和尖括号都安全； - npm 全局包在 Windows 上装的是 `.cmd` shim（gemini / codex / copilot），解析出它真正执行的 JS 入口，用 Node 直接跑； - 实在只能过 cmd.exe 的情况才自己做引号转义，遇到无法安全传递的参数给出说得清的中文报错，而不是继续吐"命令语法不正确"。  顺带修掉两个同源问题：空串参数被裸拼吃掉（`--tools ""` 变成 `--tools --effort`，等于 claude 连接器的禁用工具开关在 Windows 上失效）；以及长提示词在 hermes / copilot / openclaw 上退化成字面量 `-`
  > @jnMetaCode  全部正常了 作品很好   支持 爱了 

- **Issue #99** (2026-08-31): **Azure OpenAI API在 0.12.x 上仍无法正常调用**
  *Symptoms*: # [Bug] Azure OpenAI（及推理模型）在 0.12.x 上仍无法开箱即用 —— max_tokens 4096 默认值、测试接口鉴权方式等四处问题  ## 环境 - agency-orchestrator: **0.12.1**（`npm i -g agency-orchestrator`，Node 25，macOS） - Provider: Azure OpenAI（`*.openai.azure.com`），部署为 gpt-5 系列推理模型  ## 问题概述  Issue #38 修复了 Azure 下 `max_tokens` → `max_completion_tokens` 的参数名问题（`get tokenParam()` 已对 Azure 特判），但 **0.12.1 上 Azure 端点依然跑不通**，需要本地 patch 四处代码才能正常使用。以下每个问题都可独立复现。  ## 复现步骤  1. 在 Web Studio（`ao web`）配置 Azure OpenAI：base_url 指向 `https://<resource>.openai.azure.com/...`，model 填部署名（如 gpt-5 系列），填入 API key。 2. 点「测试连接」→ 失败（见问题 3）。 3. 跳过测试直接跑 workflow / `ao compose` → 报 `max_tokens or model output limit was reached`，输出为空（见问题 1、4）。  ## 根因分析（均基于 0.12.1 发布产物）  ### 1. connector 默认上限 4096 太小，Azure 推理模型在产出可见内容前耗尽  `dist/connectors/openai-compatible.js:95`  ```js [this.tokenParam]: config.max_tokens || 4096, ```  Azure 的 gpt-5/o 系列把 **reasoning token 计入 `max_completion_tokens` 上限**。4096 经常被内部推理全部吃光，API 返回 `finish_reason: "length"`、content 为空，表现为「调用成功但什么都没生成」。  **建议**：Azure 端点默认值放大到 128000（或至少 16384）：  ```js [this.tokenParam]: config.max_tokens || (this.isAzure ? 128000 : 4096), ```  ### 2. 非 Azure 的推理模型仍发 `max_tokens`，且 400 后无重试  `dist/connectors/openai-compatible.js:46` 的 `get tokenParam()` 只对 Azure 切换 `max_completion_tokens`。但 OpenAI 官方及第三方兼容端点上的 o1/o3/o4-mini/gpt-5 等推理模型同样**只认 `max_completion_tokens`**，请求会被 400 拒绝：  ``` Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead. ```  **建议**：  - tokenP
  **Post-Mortem & Fix Analysis**:
  > 感谢这份非常详尽的分析和补丁 🙏 四个点都已复现并确认,已在代码层修好,将随**下个版本**发布:  1. **connector 默认上限** —— Azure / `o` 系列 / `gpt-5` 推理模型在未显式指定 `max_tokens` 时,默认上限从 4096 放大到 **32768**,reasoning token 不再把额度吃光导致产出为空; 2. **推理模型参数名 + 400 自动重试** —— `tokenParam` 改为**按模型名**判定:`o1/o3/o4/gpt-5` 系列(不止 Azure)自动用 `max_completion_tokens`;并新增兜底 —— 端点返回 400 且报文含 `max_completion_tokens` 时**自动切参重试一次**,覆盖"自定义 Azure 部署名没被识别"的情况; 3. **Studio 测试连接** —— `base` 含 `azure` 时改用 `api-key` 头(不再 `Authorization: Bearer`),Azure/推理模型改用 `max_completion_tokens`,且测试值不再是 `1`(改为 `16`,避免被推理吃光); 4. **compose 生成的 YAML** —— 推理模型的 `max_tokens` 模板默认值同步放大到 32768。  已补回归测试:推理模型识别、`gpt-4o` 不误判、默认上限、以及 400→切参重试全链路。发版后我会在这里回复,届时可零改配复测。再次感谢你把根因和锚点都定位得这么清楚! 
  > 进展同步 ✅ 之前答应的四点修复已全部合入 main 并随 **0.13.0** 定版，桌面端 0.4.2 已发布（内置该版引擎）：https://github.com/jnMetaCode/agency-orchestrator/releases/tag/desktop-v0.4.2 ；npm 包稍后发出，我在这里再同步一次。  这次还补上了对应的回归断言（此前是有实现没测试，改坏了没人拦），13 条覆盖：  - 非 Azure 端点也按模型名识别推理模型（`o1`/`o3`/`o4`/`gpt-5` 系列），`gpt-4o` 不被误判； - 推理模型默认上限放大到 32768，普通模型与非推理 Azure 部署仍 4096（避免过大触发 400）； - 端点不接受参数名时 `max_tokens` ↔ `max_completion_tokens` 双向自动切换，且只重试一次；「数值过大」类 400 不会误触发切参； - compose 生成的 YAML 同步放大上限——否则组队产物会被内部推理吃光 token，表现为"跑完了但什么都没生成"。  复测时零改配即可，仍有问题请贴报错原文（含端点路径与模型/部署名），我这边继续跟。 
  > 修复已随 `v0.14.0` 发布到 npm（含 Azure 推理模型适配 + 13 条回归断言）。`npm i -g agency-orchestrator@latest` 升级后请验证，有问题欢迎继续反馈。

- **Issue #97** (2026-07-29): **compose 生成的工作流引用不存在的角色文件，执行时校验失败**
  *Symptoms*:    ## 问题描述    使用 `ao compose` 生成工作流时，AI 会"幻想"出不存在的角色名，导致执行时校验失败。    ## 复现步骤    ```bash   ao compose "帮我写一篇关于 AI Agent 的深度分析文章" --run    错误输出    错误: 工作流校验失败:     - step "research_tech" 的 role 无法加载: 角色文件不存在:       engineering/engineering-multi-agent-systems-architect.md     - step "research_industry" 的 role 无法加载: 角色文件不存在:       specialized/business-strategist.md    期望行为    1. 生成工作流时，AI 应该基于实际可用的角色列表来选择角色，而不是凭空编造   2. 或者在生成后、执行前增加一个自动校验/修复步骤    建议的解决方案    - 在 compose 的 prompt 中注入当前可用角色列表（ao roles list 的输出）   - 或者提供 --validate / --fix-roles 参数，自动将不存在的角色映射到最接近的可用角色
  **Post-Mortem & Fix Analysis**:
  > compose 目前已内置防幻觉机制（现版 v0.12.1）：① 生成时把当前可用角色目录完整注入 system prompt；② 生成后自动校验角色路径真实性，对幻觉/拼错的角色用编辑距离自动映射到最接近的真实角色（`repairInvalidRolesInYaml`）；③ 仍修不动则调 LLM 重新生成一轮。如果在 v0.12.1 上仍能稳定复现某个具体一句话导致的角色不存在报错，麻烦贴一下原始命令和完整错误，我针对性排查。
  > 这个问题在 **v0.12.1** 已修复,请升级(`npm i -g agency-orchestrator@latest`)。  `ao compose` 现在做了三层防护,正好覆盖你建议的两个方案:  1. **生成前注入真实角色目录** —— 把当前可用的 role 路径列表写进 system prompt,并明确要求"role 必须严格使用目录中列出的路径,不要编造"; 2. **生成后自动校验** —— 逐个 step 检查 role 是否真实存在于角色库; 3. **命中幻觉角色自动修复** —— 先做确定性替换(从库里找最接近的真实角色直接改 YAML,不花 LLM 调用),仍无匹配再让 LLM 定向替换一次,最后再兜底一次确定性替换。  若在 0.12.1 上仍能复现,欢迎贴出对应的 workflow / 任务描述重新打开,我这边好定位。 

- **Issue #95** (2026-07-17): **使用的时候报错**
  *Symptoms*: ## 问题描述  要求：以minimax数字人技术为核心，调用minimax api，开发应用于macos的小红书数字人口播视频APP 点击“自动组队并运行”后，agency-orchestrator根据内容自动调取4个角色参与项目，其后弹出“”  ## 复现步骤  1. 运行命令 `以minimax数字人技术为核心，调用minimax api，开发应用于macos的小红书数字人口播视频APP` 2. 使用的工作流 “自动组队并运行”  <img width="2268" height="400" alt="Image" src="https://github.com/user-attachments/assets/b1b0a33a-5352-4fbc-8dfa-02c6577cbe1c" />  <img width="2640" height="1726" alt="Image" src="https://github.com/user-attachments/assets/5fcc3002-d1aa-4ad0-9ec8-4251e3ed96b7" />  3. 出现错误  ## 期望行为  通过工作流顺利推进项目开发并呈现结果  ## 实际行为  实际发生了什么（包含错误信息）。  ## 错误: 工作流校验失败 / Workflow validation failed: - step "ux_research" 依赖不存在的 step: "product_spec"  - Node.js 版本：v26.3.1 - 操作系统：macOS - agency-orchestrator 版本：0.2.9 - LLM Provider： 
  **Post-Mortem & Fix Analysis**:
  > 与 #94 内容相同（同一问题的重复提交），排查结论与解决方案见 #94 的回复。关闭本条，后续在 #94 跟进。 

- **Issue #88** (2026-08-17): **desktop v0.2.7**
  *Symptoms*: ## 问题描述  拉团队协作操作本地文件时，没有权限（包括读取都不可以），另外，在需要连续问时（任务结束，AI提出问题需要再交互），没有交互逻辑，只能等完成后，又要重来一遍。  ## 复现步骤 使用cc cli： 1. MacOS 本地的任何文件读取都受限，不会提示要权限 2. 跑一个高考报名，一定会有交互反馈  ## 期望行为  优化应用  ## 实际行为  实际发生了什么（包含错误信息）。  ## 环境  - Node.js 版本： - 操作系统：macos 最新系统 - agency-orchestrator 版本：0.2.7 - LLM Provider：cc cli opus 4.8 
  **Post-Mortem & Fix Analysis**:
  > 命令行去调用，不会出现权限问题，但交互上还是存在问题
  > 感谢反馈，两个问题分别说明：  **1. 本地文件读取受限** —— 这是当前的设计取舍，不是权限 bug：AO 调用 cc cli 时显式禁用了它的所有工具（文件读写、命令执行），每个步骤是纯文本生成。这样工作流产出可预测、也不会有角色误改本地文件的风险，但确实做不了"操作本地文件"类任务。你的场景（读取本地文件参与工作流）我们已记录，后续会评估给步骤加受控的文件访问能力。  **2. 连续交互（任务中途 AI 提问需要用户回答）** —— 引擎其实一直有 `human_input` 步骤类型：运行到该步会真正暂停、等你输入，回答作为变量注入下游步骤（命令行和网页端都支持）。问题在于 AI 自动组队的编排器此前不知道这个能力，所以永远不会生成带交互的工作流——跑高考报名这类必须中途问你具体情况的任务时，模型只能自己编造答案或跑完让你重来。  已修复：编排器现在会在任务本质上需要用户澄清时插入 `human_input` 步骤，随下个版本发布。手动写 YAML 现在就能用：  ```yaml steps:   - id: ask_preference     type: human_input     prompt: "你更看重地理位置还是专业排名？"     output: user_preference    - id: recommend     role: "strategy/nexus-strategy"     task: "根据用户偏好 {{user_preference}} 给出报考建议"     depends_on: [ask_preference] ```
  > 补个进展：你说的第 2 点（任务中途需要交互，只能等跑完重来）已经解决——现在自动组队遇到"必须问用户才能继续"的环节会自动插入「等待输入」节点，运行中会弹框提问，你答完流程接着跑，不用重来。桌面端升级到 0.3.0 即可用（内置引擎 0.11.0）。  第 1 点（读取本地文件）维持之前的说明：仍是设计取舍，受控文件访问在评估中，有进展会在这里同步。 

- **Issue #87** (2026-07-17): **使用的时候报错**
  *Symptoms*: ## 问题描述  在组件团队的时候开始报错，点击运行依然报错。  ## 复现步骤  1. 输入query：我需要有一个帮我收集我上传的图片且进行整理以及征集我的需求的人，然后图片编辑师按照我的需求帮我对图片进行优化，然后有一个人可以帮我核对一下需求是否有完成，如果没有按需求完成则图片编辑师重新按需求修改，最后把修改之前和之后的图片作为产出物发给我 2. ai生成团队后出现弹框，弹框上报错 3. 点击运行依然报错  <img width="684" height="869" alt="Image" src="https://github.com/user-attachments/assets/4659edfe-2ab2-4684-bcf6-36312fc9bcf6" />  <img width="687" height="496" alt="Image" src="https://github.com/user-attachments/assets/cdb4a562-e56c-4356-a358-277ea97c4579" />  <img width="677" height="402" alt="Image" src="https://github.com/user-attachments/assets/755417ed-bb6c-4abc-a219-b41a5f90b145" />  ## 期望行为  你期望可以有个地方能接受我上传照片，然后对角色对图片进行编辑，编辑后把修改之前和之后的图片作为产出物给我  ## 实际行为  实际发生了什么（包含错误信息）。  ## 环境  - Node.js 版本： - 操作系统：mac（inter） - agency-orchestrator 版本： - LLM Provider： 
  **Post-Mortem & Fix Analysis**:
  > 感谢详细的复现步骤和截图，问题已定位并修复，将随下个版本发布。  **根因**：AI 自动组队生成工作流时，经常出现"变量名写对了、但引用它的步骤漏了把产出该变量的步骤加进 `depends_on`"——你截图里的 `{{task_list}}` / `{{quality_report}}` 全是这一类。之前的自动修复链只会改变量名，修不了缺边，所以弹框报错、点运行还是报错。  **修复**：组队生成后新增一道确定性自动修复——校验发现这类错误时，直接把缺失的依赖边补进 `depends_on`（按 YAML 结构精确定位、带循环依赖检测），不需要再调一次模型。你截图里的完整场景已收录为回归测试，同样的 YAML 现在会被自动修好并通过校验。  另外说明一下期望行为里提到的图片上传/编辑：AO 的步骤目前是纯文本生成，还不支持上传图片让角色处理多模态内容——这次修复解决的是"组队报错跑不起来"的问题。图片工作流的需求我们已记录。
  > 修复已随 0.11.0 正式发布（`npm i -g agency-orchestrator@latest`，桌面端 0.3.0）：自动组队产物保存前会自动补上缺失的依赖边并提示补了几条，修不动的错误逐条显示具体步骤和变量。你截图里 `{{task_list}}` / `{{quality_report}}` 这类问题现在会被自动修复。  先关闭本条，升级后如仍有问题欢迎重新打开或再开新 issue。 

- **Issue #82** (2026-06-23): **[BUG]在studio-tab下，直接和角色对话，无法保存为历史**
  *Symptoms*: ## 问题描述  在studio-tab下，直接和角色对话，无法保存为历史  ## 复现步骤  1. 进入studio页面； 2. 点击某个角色，进行对话； 3. 对话完成后，点击查看历史； 4. 在运行历史中，没有相应对话；  ## 期望行为  在运行历史中，展示相应对话；  ## 环境  windows desktop 
  **Post-Mortem & Fix Analysis**:
  > 已修复:临时单角色工作流名含冒号导致 Windows 建目录失败,已清洗输出目录名。随 npm 0.8.0 + desktop-v0.2.6 发布。

- **Issue #81** (2026-06-23): **[Linux AppImage] 启动报错 NotFoundError: Not Found — 前端 dist 文件未打包进 AppImage**
  *Symptoms*: ## 问题描述  下载 `desktop-v0.2.5` 的 Linux AppImage (`Agency Orchestrator-0.2.5.AppImage`) 后双击启动，应用窗口弹出后立即报错，界面白屏。  ## 复现步骤  1. 下载 [Agency Orchestrator-0.2.5.AppImage](https://github.com/jnMetaCode/agency-orchestrator/releases/download/desktop-v0.2.5/Agency+Orchestrator-0.2.5.AppImage) 2. `chmod +x` 后双击运行 3. 应用窗口出现，随即显示错误  ## 实际行为  应用启动后立即报错，完整堆栈：NotFoundError: Not Found at createHttpError (/tmp/.mount_Agency6lg63d/resources/app/node_modules/send/index.js:861:12) at SendStream.error (/tmp/.mount_Agency6lg63d/resources/app/node_modules/send/index.js:168:31) at SendStream.pipe (/tmp/.mount_Agency6lg63d/resources/app/node_modules/send/index.js:468:14) at sendfile (/tmp/.mount_Agency6lg63d/resources/app/node_modules/express/lib/response.js:1014:8) at ServerResponse.sendFile (/tmp/.mount_Agency6lg63d/resources/app/node_modules/express/lib/response.js:411:3) at file:///tmp/.mount_Agency6lg63d/resources/app/web/server.js:824:9 at Layer.handleRequest (/tmp/.mount_Agency6lg63d/resources/app/node_modules/router/lib/layer.js:152:17) at next (/tmp/.mount_Agency6lg63d/resources/app/node_modules/router/lib/route.js:157:13) at Route.dispatch (/tmp/.mount_Agency6lg63d/resources/app/node_modules/router/lib/route.js:117:3) at handle (/tmp/.mount_Agency6lg63d/resources/app/node_modules/router/index.js:435:11)  ## 期望行为  应用正常启动，显示 Studio 前端界面。  ## 初步分析  错误发生在 Electron 内部 Express 服务器 (`web/server.js` 第 824 行) 调用 `res.sendFile()` 时。该调用尝试 serve 前端静态文件（推测是 `website/dist/index.html` 或类似路径），但目标文件在 AppImage 挂
  **Post-Mortem & Fix Analysis**:
  > 已修复:**desktop-v0.2.6** 重新发布。根因是 website/dist 未打进 AppImage;CI 现加了前端产物完整性闸(打包前 + 钻进产物校验),本次三平台包均过闸才发出。请下载新版验收:https://github.com/jnMetaCode/agency-orchestrator/releases/tag/desktop-v0.2.6 (仍有问题请重开)

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

### Incident Patch 1: `8834c9eb` (2026-09-29)
**Commit Message**: fix(retry): 包月套餐额度用尽的 429 不再当成限流重试 (#184) (#187)

用户报的两个症状（#184），根子是两件不同的事：

1. MiniMax 包月 key 回 `HTTP 429 已达到 Token Plan 用量上限：请升级 Token Plan
   套餐或购买积分补充用量`。429 里其实装着相反的两件事——限流等一会儿真会好，
   套餐额度耗尽重试一万次也一样。引擎按限流退避重试了一轮，最后还叫用户
   "稍后重试，或降低并发"，两条建议都是错的。

   新增 `isQuotaExhausted`（endpoint.ts，与既有的 isModelUnavailable 同一套路：
   状态码像临时故障、其实是账号问题），`classifyError` 据此判不重试，提示改成
   "账单问题，重试无用；去充值/升级套餐或换一家；包月额度通常按自然月重置"。
   只认明说额度/用量耗尽的措辞，**不碰"并发超限""Rate limit reached ... RPM"
   这类真限流**——否则一次并发超限就让跑了一半的工作流直接失败。两个方向都有断言。

2. 智谱 coding plan 上 GLM 吐了 6 万字符 reasoning、正文 0 字，报错只说
   "换一个模型或关闭 thinking 后重试"——在哪关？现在直接给可照做的写法：
   在工作流的 `llm.params` 里透传（智谱 `thinking: { type: "disabled" }`；
   OpenAI/DeepSeek 系把 reasoning 档位调到最低）。

判定与文案钉在同一个测试文件里：判定说"不重试"而文案还叫人"稍后重试"，
用户只会照文案办，两者必须同源。

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -179,6 +179,15 @@
   新增「氛围锁定」规则与「按类型的默认运镜与节拍」表（剧情短剧 / 产品广告片 / 治愈日常 / 悬疑惊悚 /
   搞笑段子 / 科幻 / 古风武侠 / 纪实 Vlog），来源是上游的 genre-camera-sop 与各题材范例。
 ### Fixed
+- **包月套餐额度用尽被当成限流，白重试一轮还给了两条错建议**（#184，报告者 @GZT-tzhou）：MiniMax 包月 key 回
+  `HTTP 429 已达到 Token Plan 用量上限：请升级 Token Plan 套餐或购买积分补充用量`——429 里其实是**相反的两件事**：
+  限流等一会儿真会好，套餐额度耗尽重试一万次也一样。引擎按限流退避重试了一轮，最后还告诉用户"稍后重试，或降低并发"，
+  两条建议都是错的。现在 `isQuotaExhausted`（`connectors/endpoint.ts`）识别明说额度/用量耗尽的说法，
+  `classifyError` 据此判**不重试**，提示改成"这是账单问题，重试无用；去充值/升级套餐，或换一家；包月额度通常按自然月重置"。
+  只认明说额度耗尽的措辞，**不碰"并发超限""请求过快"这类真限流**（两个方向都有断言，改歪了 CI 就红）。
+- **"关闭 thinking"没说在哪关**（同 #184 的另一半）：智谱 coding plan 上 GLM 吐了 6 万字符 reasoning、正文 0 字，
+  报错只给了"换一个模型或关闭 thinking 后重试"——用户无从下手。现在直接给出可照做的写法：在工作流的 `llm.params` 里
+  透传该家的关闭开关（智谱 GLM 是 `thinking: { type: "disabled" }`；OpenAI/DeepSeek 系把 reasoning 档位调到最低）。
 - **验收员把「满足此条」的条目也写进 `failed`，引擎照单全收**（#183，报告者 @HaipingShi）：deepseek-chat 当验收员时稳定复现
   ——四条验收标准**全部满足**，四条 `why` 一字不差地写着"满足此条"，却整整齐齐列在 `failed` 数组里。后果是白返工一轮
   （token 翻倍，有按秒计费的媒体步骤就是直接翻倍花钱）、档案与 summary 里留下假的「⚠️ 4 条未满足」、以库/MCP 方式
```

**File**: `src/connectors/endpoint.ts` (modified, +18/-0)
```diff
@@ -277,6 +277,19 @@ export function isModelUnavailable(text: string): boolean {
   return /model_not_found|无可用渠道|no available channel/i.test(text);
 }
 
+/**
+ * 429 里分两种完全不同的事，处理方式相反：
+ *  · **限流**（每分钟请求数/并发超了）——等一会儿真的会好，该退避重试；
+ *  · **套餐用量耗尽**（包月 plan 的额度用完、余额/积分为 0）——**重试一万次也一样**，要去充值或换一家。
+ * 两者都回 429，只有正文分得开。#184 真机：MiniMax 包月 key 回
+ * `HTTP 429 已达到 Token Plan 用量上限：请升级 Token Plan 套餐或购买积分补充用量。(2056)`，
+ * 而引擎按限流退避重试了一轮，最后还告诉用户"稍后重试，或降低并发"——两句建议都是错的。
+ * 匹配只认**明说额度/用量耗尽**的说法，不碰"并发超限""请求过快"这类真限流措辞。
+ */
+export function isQuotaExhausted(text: string): boolean {
+  return /insufficient_quota|exceeded your current quota|quota (?:has been )?(?:exceeded|exhausted|used up)|out of credits?|用量上限|额度已用[完尽]|额度不足|额度已耗尽|余额不足|积分不足|欠费/i.test(text);
+}
+
 /**
  * 中转网关明说「只放行官方 Claude Code 客户端」。PackyCode 的 cc 分组（Claude Code 专用）即如此：
  * 直连 /v1/messages 回 403「only accessible via the official Claude CLI」，按 Claude Code 协议手搓的
@@ -371,6 +384,11 @@ export function endpointHint(status: number, url: string, baseUrl: string, drift
     lines.push(`${status} = 还在跳转：跳了 ${MAX_REDIRECTS} 次仍没到终点，多为 base_url 指向了会反复重定向的地址，请直接填中转商文档里的最终地址`);
   } else if (status === 401 || status === 403) {
     lines.push('401/403 = 鉴权没过：核对 API key 是否复制完整、是否与该 base_url 属于同一家、账号是否还有额度');
+  } else if (status === 429 && body && isQuotaExhausted(body)) {
+    lines.push(
+      '429 但不是限流：这家明说**套餐用量/额度已耗尽** —— 这是账单问题，不是临时故障，重试无用（引擎也已不再重试）',
+      '去该供应商控制台充值/升级套餐，或在「供应商」里换一家；包月 plan 的额度通常按自然月重置，也可以等下个周期',
+    );
   } else if (status === 429) {
     lines.push('429 = 被限流：稍后重试，或在「供应商」里降低并发/换一家');
   } else if (status >= 500) {
```

**File**: `src/connectors/openai-compatible.ts` (modified, +7/-1)
```diff
@@ -330,7 +330,13 @@ export class OpenAICompatibleConnector implements LLMConnector {
       const why = rc > 0
         ? `模型只返回了思考内容（${rc} 字符 reasoning）没有正文——多半是输出上限被 thinking 吃光，或该模型在这家网关上不回正文`
         : `模型返回了空正文（finish_reason=${lastFinishReason ?? '未知'}）`;
-      throw new Error(`${why}。换一个模型（如非推理模型）或关闭 thinking 后重试；请求地址: ${lastRequestUrl}`);
+      // "关闭 thinking"要说清**在哪关**：各家开关名不同，而工作流里通用的入口是 llm.params 透传
+      // （#184 真机：智谱 coding plan 上 GLM 吐了 6 万字符 reasoning、正文 0 字，用户只看到"关闭 thinking"
+      // 这四个字，无从下手）。
+      const how = rc > 0
+        ? '换一个非推理模型，或在工作流的 `llm.params` 里透传该家的关闭开关（智谱 GLM：`thinking: { type: "disabled" }`；OpenAI/DeepSeek 系：把 reasoning 档位调到最低），再重试'
+        : '换一个模型或稍后重试';
+      throw new Error(`${why}。${how}；请求地址: ${lastRequestUrl}`);
     }
     return {
       content: fullContent,
```

**File**: `src/core/executor.ts` (modified, +6/-0)
```diff
@@ -17,6 +17,7 @@ import { evaluateCondition } from './condition.js';
 import { loadAgent } from '../agents/loader.js';
 import { collectSkillNames, injectSkills } from '../skills/loader.js';
 import { createConnector } from '../connectors/factory.js';
+import { isQuotaExhausted } from '../connectors/endpoint.js';
 import { generateImage } from '../connectors/image.js';
 import { generateVideo , type VideoStepOptions } from '../connectors/video.js';
 import { concatVideos } from '../media/concat.js';
@@ -1351,6 +1352,11 @@ export function classifyError(error: Error): 'rate_limit' | 'server_error' | 'co
   // 必须排在 5xx 判定之前（与 connectors/endpoint.ts 的 isModelUnavailable 同一口径）
   if (/model_not_found|无可用渠道|no available channel/.test(msg))
     return 'non_retryable';
+  // 429 里「套餐用量/额度耗尽」与「限流」是相反的两件事：前者重试一万次也一样（#184 真机：MiniMax
+  // 包月 key 回 429「已达到 Token Plan 用量上限」，却被按限流退避重试了一轮）。同 endpoint.ts 的
+  // isQuotaExhausted 一个口径；必须排在 429→rate_limit 之前
+  if (isQuotaExhausted(msg))
+    return 'non_retryable';
   // 报错里**明说了状态码**就按状态码判，不再猜关键词。此前两种误判都出在这：
   //  · claude-code 的鉴权失败是「… API 错误: API Error: 401 …」，被 `includes('api 错误')` 一律当成
   //    服务端故障，按 CLI 退避 5/10/20/40/80s 重试五次——两分半钟之后才告诉用户 key 不对；
```

**File**: `test/classify-error.ts` (modified, +29/-0)
```diff
@@ -5,6 +5,7 @@
  * 所以两个方向都钉。消息样本取自各连接器真实的报错格式。
  */
 import { classifyError, explicitHttpStatus } from '../src/core/executor.js';
+import { endpointHint, isQuotaExhausted } from '../src/connectors/endpoint.js';
 
 let passed = 0;
 let failed = 0;
@@ -29,11 +30,24 @@ is('API error 404: model not found', 'non_retryable', '404');
 is('API error 503: {"error":{"code":"model_not_found","message":"分组 default 下无可用渠道"}}', 'non_retryable', '503 但其实是「无可用渠道」——账号配置问题，排在状态码判定之前');
 is('模板变量未定义: {{x}}', 'non_retryable', '普通逻辑错误');
 
+// #184：包月 plan 的额度用尽也回 429，但它跟限流是相反的两件事——重试一万次也一样。
+// 真机报文（MiniMax 包月 key）：引擎按限流退避重试了一轮，最后还叫用户"稍后重试、降低并发"。
+is('HTTP 429 已达到 Token Plan 用量上限：请升级 Token Plan 套餐或购买积分补充用量。 (2056)\n请求地址: POST https://api.minimax.cn/v1/chat/completions',
+  'non_retryable', '#184: 429 但正文说「Token Plan 用量上限」→ 账单问题，不重试');
+is('API error 429: {"error":{"type":"insufficient_quota","message":"You exceeded your current quota"}}',
+  'non_retryable', '#184: OpenAI 的 insufficient_quota 也是 429，同样重试无用');
+is('API error 429: {"error":{"message":"余额不足，请充值后重试"}}', 'non_retryable', '#184: 中文「余额不足」');
+is('API error 429: {"error":{"message":"积分不足"}}', 'non_retryable', '#184: 中文「积分不足」');
+
 console.log('\n─── 会变好的：照常重试 ───');
 is('API error 429: {"error":{"message":"Rate limit reached"}}', 'rate_limit', '429');
 is('Claude Code API 错误: API Error: 429 {"type":"error","error":{"type":"rate_limit_error"}}', 'rate_limit', 'claude-code 的 429');
 is('API stream error: rate limit exceeded, please slow down', 'rate_limit', '没有状态码、正文说 rate limit');
 is('请求过于频繁，请稍后再试', 'rate_limit', '中文限流文案');
+// 反向：真限流不许被当成额度问题吃掉——否则一次并发超限就让跑了一半的工作流直接失败
+is('API error 429: {"error":{"message":"并发数超限，请降低并发后重试"}}', 'rate_limit', '#184 反向: 并发超限仍是限流，照常重试');
+is('API error 429: {"error":{"message":"Rate limit reached for gpt-4o in organization org-x on requests per min (RPM): Limit 500"}}',
+  'rate_limit', '#184 反向: OpenAI 的 RPM 限流文案里也有 limit，不能误判成额度耗尽');
 is('API error 502: Bad Gateway', 'server_error', '502');
 is('Claude Code API 错误: API Error: 529 {"type":"error","error":{"type":"overloaded_error"}}', 'server_error', 'Anthropic 529 过载');
 is('Claude Code API 错误: API Error: Connection error.', 'server_error', 'CLI 的 API 错误但没给状态码 → 保持原来的可重试');
@@ -42,6 +56,21 @@ is('streaming terminated (已收到 1200 字符): socket hang up', 'connection',
 is('超时 (600000ms)，可用 --timeout 或 YAML llm.timeout 延长', 'connection', 'withTimeout 的中文超时');
 is('stream stalled: 90s 内没有新数据', 'connection', '停顿检测');
 
+console.log('\n─── 429 的两种含义：提示文案要跟重试判定一致 ───');
+{
+  // 判定说"不重试"而文案还叫人"稍后重试"，用户就只会照文案办 —— 两者必须同源，所以钉在一起
+  const quota = endpointHint(429, 'https://api.minimax.cn/v1/chat/completions', 'https://api.minimax.cn/v1',
+    undefined, '已达到 Token Plan 用量上限：请升级 Token Plan 套餐或购买积分补充用量。');
+  assert(/重试无用/.test(quota) && !/稍后重试/.test(quota), `额度耗尽的提示不许说"稍后重试"（实际：${quota.trim().slice(0, 70)}）`);
+  assert(/充值|升级套餐/.test(quota), '告诉用户该干什么：充值/升级套餐/换一家');
+
+  const throttled = endpointHint(429, 'https://x/v1/chat/completions', 'https://x/v1', undefined, 'Rate limit reached');
+  assert(/稍后重试/.test(throttled) && !/重试无用/.test(throttled), '真限流照旧说"稍后重试、降低并发"');
+
+  assert(isQuotaExhausted('已达到 Token Plan 用量上限') && !isQuotaExhausted('并发数超限'),
+    'isQuotaExhausted 只认额度耗尽，不认并发超限');
+}
+
 console.log('\n─── 状态码提取不被正文数字带偏 ───');
 assert(explicitHttpStatus('API error 401: x') === 401, '「API error 401」');
 assert(explicitHttpStatus('API Error: 503 upstream') === 503, '「API Error: 503」');
```

---

### Incident Patch 2: `176d084b` (2026-09-28)
**Commit Message**: fix(verify): 裁判把「满足此条」的条目写进 failed 时，不再当成未满足 (#183) (#185)

真机复现（用户报的 #183）：deepseek-chat 当验收员跑 workflows/dev/pr-review.yaml，
四条验收标准全部满足，四条 `why` 一字不差地写着"满足此条"，却整整齐齐列在 `failed`
数组里。引擎照单全收，于是：白返工一轮（token 翻倍，按秒计费的媒体步骤直接翻倍花钱）、
档案和 summary 里留下假的「⚠️ 4 条未满足」、库调用方拿到的 `pass` 不可信。

deepseek-chat 正是 AO 的默认 provider，而 acceptance 这一轮刚铺到 21 个模板上，
所以这条路径是默认路径。

两处改动：
- `parseVerify` 剔除 `why` 在自证满足的条目（新的 `whySaysMet`，先看否定词再看肯定词
  ——「不满足」「未达到」里都含着「满足」「达到」）。剔完一条不剩时走既有的"核验不可用"
  分支：重试一次，再不行就跳过核验，而不是带着假清单去返工。提示词里本来就有这条原则
  （「举不出原话就说明它其实满足了」），这里只是让解析端也照做；
- 提示词补一句明话：满足的条目一条都不要放进 failed，哪怕只是想顺便说明它为什么满足。

过滤是保守的单向：只有在 why **明确说满足且不含任何否定词**时才剔除，
纯陈述句（"正文共 6 段"）和说得含糊的（"只写了两条"）一律留着当真未满足。
test/verify.ts 里用 issue 原样的回包 + 18 条边界用例钉住；把过滤去掉，三条用例立刻红。

**File**: `src/core/verify.ts` (modified, +26/-5)
```diff
@@ -35,6 +35,22 @@ export interface VerifyVerdict {
   failed: { criterion: string; why: string }[];
 }
 
+/**
+ * 这条 `failed` 条目的 why 是不是在说「它其实满足了」。
+ *
+ * 弱一点的裁判（实测 deepseek-chat，见 #183）不遵守「全部满足时 failed 必须是空数组」的约定，
+ * 会把每一条连同「……满足此条」的理由一起塞进 failed。按字面执行的后果是：每个带 acceptance 的
+ * 步骤都白返工一轮（token 翻倍）、档案里留下失真的「⚠️ N 条未满足」、库调用方拿到的 pass 不可信。
+ *
+ * 先看否定词再看肯定词——「不满足」「未达到」里都含着「满足」「达到」。
+ */
+export function whySaysMet(why: string): boolean {
+  if (!why) return false;
+  const denies = /不满足|未满足|不符合|不合|未达到|没达到|缺少|缺失|欠缺|未见|未出现|未(写|给|列|标|提供|包含)|没有(写|给|列|标|提供|包含|出现)|超(出|过)|不足|不够|仅|只有|部分|not met|missing|lack|fail|absent|incomplete|partial|exceed|short of/i.test(why);
+  if (denies) return false;
+  return /满足|符合|达到|已具备|具备|无问题|没有问题|合规|met\b|satisfie|complies|conforms|passes\b/i.test(why);
+}
+
 /** 从核验回复里抽出 JSON 结论（同 compare.parseJudge：宽松匹配第一个 {...}）。 */
 export function parseVerify(raw: string): VerifyVerdict | null {
   const m = raw.match(/\{[\s\S]*\}/);
@@ -56,11 +72,16 @@ export function parseVerify(raw: string): VerifyVerdict | null {
           })
           .filter((f: { criterion: string; why: string }) => f.criterion || f.why)
       : [];
-    // pass=false 却给不出任何未满足条目 → 无法指导返工，也没法向用户解释"哪里没过"，
+    // 裁判自己在 why 里写「满足此条」，却仍把这条塞进 failed（#183：deepseek-chat 当 judge 时
+    // 稳定复现——四条 acceptance 全部满足，四条 why 全写"满足此条"，却整齐地列在 failed 里）。
+    // 提示词里本来就有这条原则：「举不出原话就说明它其实满足了」。既然它连"不满足在哪"都说不出、
+    // 反而自证满足，这条就不是真未满足——剔除，别拿它去返工，也别在档案里留假的 ⚠️。
+    const real = failed.filter((f: { criterion: string; why: string }) => !whySaysMet(f.why));
+    // pass=false 却给不出任何**真正**未满足的条目 → 无法指导返工，也没法向用户解释"哪里没过"，
     // 视为本次核验不可用（触发第二次尝试/跳过），别带着空清单去返工
-    if (j.pass !== true && failed.length === 0) return null;
+    if (j.pass !== true && real.length === 0) return null;
     // 保守裁决：模型说 pass 但又列了未满足条目 → 以条目为准，算未通过
-    return { pass: j.pass === true && failed.length === 0, failed };
+    return { pass: j.pass === true && real.length === 0, failed: real };
   } catch {
     return null;
   }
@@ -91,7 +112,7 @@ export async function verifyAcceptance(
         '', '验收标准：', acceptance,
         '', '待验收产出：', trunc(output), '',
         '只输出一行 JSON，不要任何额外文字：{"pass": true/false, "failed": [{"criterion": "未满足的条目原文", "why": "一句话原因"}]}',
-        '全部满足时 failed 必须是空数组 []。',
+        '全部满足时 failed 必须是空数组 []。**满足的条目一条都不要放进 failed**——哪怕你想顺便说明它为什么满足。',
       ].join('\n')
     : [
         'You are a strict acceptance reviewer. Check the deliverable against EACH criterion.',
@@ -104,7 +125,7 @@ export async function verifyAcceptance(
         '', 'Acceptance criteria:', acceptance,
         '', 'Deliverable under review:', trunc(output), '',
         'Output exactly one line of JSON, nothing else: {"pass": true/false, "failed": [{"criterion": "the unmet criterion", "why": "one-sentence reason"}]}',
-        'If all criteria are met, failed MUST be an empty array [].',
+        'If all criteria are met, failed MUST be an empty array []. **Never put a met criterion in `failed`** — not even to explain why it is met.',
       ].join('\n');
 
   const tokens = { input: 0, output: 0 };
```

**File**: `test/verify.ts` (modified, +48/-1)
```diff
@@ -10,7 +10,7 @@ import { parseWorkflow, validateWorkflow } from '../src/core/parser.js';
 import { buildDAG } from '../src/core/dag.js';
 import { executeDAG } from '../src/core/executor.js';
 import { saveResults, formatVerification } from '../src/output/reporter.js';
-import { parseVerify, buildReworkBlock, formatFailedItems } from '../src/core/verify.js';
+import { parseVerify, buildReworkBlock, formatFailedItems, whySaysMet } from '../src/core/verify.js';
 import type { LLMConnector, LLMResult, LLMConfig, WorkflowDefinition } from '../src/types.js';
 
 let passed = 0, failed = 0;
@@ -35,6 +35,53 @@ assert(parseVerify('{"pass": false, "failed": [{}]}') === null, 'parseVerify: pa
 const p3 = parseVerify('{"pass": false, "failed": [{"criterion": "1. 三节\\n2. 标风险", "why": "第\\n二节缺失"}]}');
 assert(p3?.failed[0].criterion === '1. 三节 2. 标风险' && p3.failed[0].why === '第 二节缺失', 'parseVerify: 条目内嵌换行被压平成单行（下游 CLI 行/文件头/SSE 都按单行消费）');
 
+// ── #183：裁判把「满足此条」的条目也写进 failed ──
+// 真机复现（issue #183，deepseek-chat 当裁判跑 workflows/dev/pr-review.yaml）：四条验收标准
+// 全部满足，四条 why 一字不差地写着"满足此条"，却整整齐齐列在 failed 数组里。照单全收的后果：
+// 白返工一轮（token 翻倍、按秒计费的媒体步骤直接翻倍花钱）、档案里留下假的「⚠️ 4 条未满足」。
+{
+  const issue183 = JSON.stringify({
+    pass: false,
+    failed: [
+      { criterion: '1. 给出至少 3 条具体可执行的修改建议', why: '满足此条' },
+      { criterion: '2. 每条建议标注对应的文件与行号', why: '满足此条' },
+      { criterion: '3. 指出是否存在阻塞合并的问题', why: '满足此条' },
+      { criterion: '4. 结论给出明确的合并建议', why: '满足此条' },
+    ],
+  });
+  assert(parseVerify(issue183) === null,
+    '#183: 四条 why 全说"满足此条" → 核验不可用（重试/跳过），不是带着假清单去返工');
+
+  // 反向：真的未满足，一条都不许被吃掉
+  const real = parseVerify('{"pass": false, "failed": [{"criterion": "不超过 200 字", "why": "实际 450 字，超出上限"}]}');
+  assert(real?.pass === false && real.failed.length === 1 && real.failed[0].why === '实际 450 字，超出上限',
+    '#183: 真未满足原样保留（过滤不能顺手把真问题也滤掉）');
+
+  // 混合：只留真的那条，返工提示里就不会混进"满足此条"这种自相矛盾的要求
+  const mixed = parseVerify('{"pass": false, "failed": [{"criterion": "A", "why": "满足此条"}, {"criterion": "B", "why": "缺少「延伸阅读」小节"}]}');
+  assert(mixed?.failed.length === 1 && mixed.failed[0].criterion === 'B',
+    '#183: 混合清单只留真正未满足的那条');
+
+  // pass=true 却顺手把满足项列进 failed（同一个毛病的另一副面孔）→ 该判通过
+  const okAnyway = parseVerify('{"pass": true, "failed": [{"criterion": "A", "why": "符合要求"}]}');
+  assert(okAnyway?.pass === true && okAnyway.failed.length === 0,
+    '#183: pass=true + 全是"满足"说明的条目 → 判通过，不再被保守裁决拉成未过');
+
+  // whySaysMet 的边界：先看否定词再看肯定词——"不满足""未达到"里都含着"满足""达到"
+  for (const [why, want] of [
+    ['满足此条', true], ['符合要求', true], ['已达到', true], ['无问题', true],
+    ['criterion met', true], ['satisfied', true],
+    ['', false], ['不满足', false], ['未满足此条', false], ['未达到 3 条', false],
+    ['缺少风险章节', false], ['超出 200 字', false], ['部分满足', false], ['partially met', false],
+    ['not met', false], ['missing the summary', false],
+    ['第三节写得不够具体', false],          // 说了缺点，别当成满足
+    ['只写了两条', false],                  // 数量不够
+    ['正文共 6 段', false],                 // 纯陈述，既没说满足也没说不满足 → 不动它
+  ] as [string, boolean][]) {
+    assert(whySaysMet(why) === want, `whySaysMet("${why}") = ${want}`);
+  }
+}
+
 // ── buildReworkBlock / formatFailedItems ──
 const rb = buildReworkBlock([{ criterion: '包含风险章节', why: '整段缺失' }], '这是上一版产出全文');
 assert(rb.includes('这是上一版产出全文') && rb.includes('包含风险章节') && rb.includes('不要从零重写'), 'buildReworkBlock: 含上一版产出 + 未满足条目 + 原稿修改指令');
```

---

### Incident Patch 3: `755a8c1c` (2026-09-25)
**Commit Message**: fix: 画布里删掉交付物那一步之后，保存不再被堵死 (#168)

形态：模板顶层写了 deliverables: [polish]，用户在画布里把 polish 删掉再保存——
校验器报「顶层 deliverables 引用不存在的 step」，400 拒绝。而**画布里根本没有编辑
deliverables 的入口**（WorkflowCanvas.tsx 里一次都没出现这个字段），于是用户在画布里
怎么改都救不回来，只能去手改 YAML；而画布正是给不想碰 YAML 的人用的。

今天刚把 deliverables 加到 7 个模板上（#165/#166，从 7 个涨到 14 个），撞上这条的概率
被我自己抬高了，所以得一起修。

服务端在校验前把指向已不存在步骤的交付物摘掉（全摘光就连键一起删，回到默认口径
"最后一个完成的步骤"），并在响应里返回 droppedDeliverables；画布保存成功的提示后面
补一句说摘了哪个，中英都有——不闷着改用户的文件。交付物还在时一个字不动。

新增 test/canvas-save-deliverables.ts（真起服务、真走画布的读图-删点-存图）。
变异验证：去掉摘除逻辑后 5 条转红，头一条正是 400 + "引用不存在的 step"。

注：web/server.js 里有用户未提交的胜算云改动，本次只按 hunk 提交自己那两处
（droppedDeliverables 的计算与返回），已确认暂存区里零胜算云内容。

**File**: `package.json` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@
     "build:studio": "npm --prefix website install && npm --prefix website run build",
     "verify:release": "node scripts/verify-cli.mjs && node scripts/verify-frontend.mjs",
     "typecheck:test": "tsc -p tsconfig.test.json",
-    "test": "npm run -s typecheck:test && npx tsx test/run.ts && npx tsx test/assert.ts && npx tsx test/condition.ts && npx tsx test/cli.ts && npx tsx test/cli-dx.ts && npx tsx test/cli-base.ts && npx tsx test/spawn-cli.ts && npx tsx test/antigravity-cli.ts && npx tsx test/codebuddy-cli.ts && npx tsx test/claude-code-cwd.ts && npx tsx test/claude-code-stream.ts && npx tsx test/llm-override.ts && npx tsx test/cline-cli.ts && npx tsx test/opencode-cli.ts && npx tsx test/dsh-cli.ts && npx tsx test/sponsor-guide.ts && npx tsx test/providers-manifest.ts && npx tsx test/claude-base-url.ts && npx tsx test/anthropic-providers.ts && npx tsx test/depends-on-ids.ts && npx tsx test/parse-inputs.ts && npx tsx test/compose.ts && npx tsx test/demo.ts && npx tsx test/factory-custom.ts && npx tsx test/azure-compat.ts && npx tsx test/endpoint-fallback.ts && npx tsx test/newapi-usage.ts && npx tsx test/claude-cli-probe.ts && npx tsx test/env-proxy.ts && npx tsx test/proxy-setting.ts && npx tsx test/image-step.ts && npx tsx test/video-step.ts && npx tsx test/local-sdcpp.ts && npx tsx test/tts-step.ts && npx tsx test/preflight.ts && npx tsx test/media-spend-loop.ts && npx tsx test/e2e-image.ts && npx tsx test/e2e-video.ts && npx tsx test/concat-step.ts && npx tsx test/styles.ts && npx tsx test/probe-video.ts && npx tsx test/empty-output.ts && npx tsx test/creative-prune.ts && npx tsx test/creative-data.ts && npx tsx test/doctor.ts && npx tsx test/connector-continuation.ts && npx tsx test/claude-continuation.ts &&npx tsx test/connector-stall.ts && npx tsx test/ollama-vision.ts && npx tsx test/compare-lib.ts && npx tsx test/compare-cancel.ts && npx tsx test/share-report.ts && npx tsx test/notify.ts && npx tsx test/install.ts && npx tsx test/materialize.ts && npx tsx test/paths.ts && npx tsx test/skills.ts && npx tsx test/acceptance.ts && npx tsx test/verify.ts && npx tsx test/verify-image.ts && npx tsx test/verify-video.ts && npx tsx test/step-llm.ts && npx tsx test/step-llm-yaml.ts && npx tsx test/stdin-limit.ts && npx tsx test/compose-name.ts && npx tsx test/team.ts && npx tsx test/ledger.ts && npx tsx test/prompt.ts && npx tsx test/upgrade.ts && npx tsx test/version-and-dirs.ts && npx tsx test/resume.ts && npx tsx test/feedback.ts && npx tsx test/human-input.ts && npx tsx test/init.ts && npx tsx test/roles.ts && npx tsx test/role-suggest.ts && npx tsx test/eval-gate.ts && npx tsx test/validate-report.ts && npx tsx test/workflows.ts && npx tsx test/workflow-schema.ts && npx tsx test/validate-strict.ts && npx tsx test/timeout.ts && npx tsx test/watch-render.ts && npx tsx test/timeout-zero.ts && npx tsx test/classify-error.ts && npx tsx test/sse-parse.ts && npx tsx test/media-spool.ts && npx tsx test/cli-orphan.ts && npx tsx test/desktop-helpers.ts && npx tsx test/sleep-retry.ts && npx tsx test/inputs.ts && npx tsx test/e2e.ts && npx tsx test/e2e-condition.ts && npx tsx test/e2e-loop.ts && npx tsx test/detect-providers.ts && npx tsx test/canvas-graph.ts && npx tsx test/creative-prompts.ts && npx tsx test/export-convert.ts && npx tsx test/web-data-dir.ts && npx tsx test/run-output-parser.ts && npx tsx test/web-server.ts && npx tsx test/web-network-proxy.ts && npx tsx test/request-guard.ts && npx tsx test/web-run-assets.ts && npx tsx test/server-shutdown.ts && npx tsx test/legacy-ui.ts && npx tsx test/studio-a11y.ts && npx tsx test/studio-demo-guard.ts && npx tsx test/custom-providers.ts && npx tsx test/mcp.ts && npx tsx test/claude-apply.ts && npx tsx test/codex-relay.ts && npx tsx test/claude-proxy.ts",
+    "test": "npm run -s typecheck:test && npx tsx test/run.ts && npx tsx test/assert.ts && npx tsx test/condition.ts && npx tsx test/cli.ts && npx tsx test/cli-dx.ts && npx tsx test/cli-base.ts && npx tsx 
```

**File**: `test/canvas-save-deliverables.ts` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+/**
+ * 画布保存：删掉的步骤正好是声明的交付物时，别把用户堵死在画布里。
+ *
+ * 形态：模板顶层写了 `deliverables: [polish]`，用户在画布里把 polish 删掉再保存 ——
+ * 校验器报「顶层 deliverables 引用不存在的 step」，保存被拒。而**画布里根本没有编辑
+ * deliverables 的入口**（WorkflowCanvas.tsx 里一次都没出现这个字段），于是用户在画布里
+ * 怎么改都救不回来，只能去手改 YAML；而画布正是给不想碰 YAML 的人用的。
+ *
+ * 处理：把指向已不存在步骤的交付物摘掉（全摘光就连键一起删，回到默认口径「最后一个完成的步骤」），
+ * 并在响应里说清摘了哪些 —— 不闷着改用户的文件。
+ */
+import { spawn, type ChildProcess } from 'node:child_process';
+import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
+import { createServer } from 'node:net';
+import { tmpdir } from 'node:os';
+import { join, resolve } from 'node:path';
+
+let passed = 0;
+let failed = 0;
+function assert(c: boolean, m: string): void {
+  if (c) { console.log(`  ✅ ${m}`); passed++; } else { console.log(`  ❌ ${m}`); failed++; }
+}
+const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
+const freePort = () => new Promise<number>((res) => {
+  const s = createServer();
+  s.listen(0, '127.0.0.1', () => { const p = (s.address() as { port: number }).port; s.close(() => res(p)); });
+});
+
+const root = mkdtempSync(join(tmpdir(), 'ao-canvas-deliv-'));
+const dataDir = join(root, 'data');
+const wfDir = join(dataDir, 'ao-workflows');
+mkdirSync(wfDir, { recursive: true });
+const wfPath = join(wfDir, 'demo.yaml');
+writeFileSync(wfPath, [
+  'name: "画布交付物"',
+  `agents_dir: "${resolve('node_modules/agency-agents-zh')}"`,
+  'llm: { provider: "deepseek", model: "m" }',
+  'deliverables: [polish]',
+  'steps:',
+  '  - id: draft',
+  '    role: "marketing/marketing-content-creator"',
+  '    task: "写初稿"',
+  '    output: draft_out',
+  '  - id: polish',
+  '    role: "marketing/marketing-content-creator"',
+  '    task: "润色 {{draft_out}}"',
+  '    output: polished',
+  '    depends_on: [draft]',
+  '',
+].join('\n'), 'utf-8');
+
+let server: ChildProcess | null = null;
+try {
+  console.log('\n─── 画布删掉交付物那一步之后还能不能存 ───');
+  const port = await freePort();
+  server = spawn(process.execPath, [resolve('web/server.js')], {
+    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', AO_DATA_DIR: dataDir, AO_NO_UPDATE_CHECK: '1', AO_MANIFEST_URL: 'http://127.0.0.1:1/none.json' },
+    stdio: 'ignore',
+  });
+  const base = `http://127.0.0.1:${port}`;
+  let up = false;
+  for (let i = 0; i < 80; i++) {
+    try { if ((await fetch(base + '/api/health')).ok) { up = true; break; } } catch { /* not up yet */ }
+    await sleep(250);
+  }
+  assert(up, '服务启动');
+
+  if (up) {
+    const graph = await (await fetch(`${base}/api/workflows/graph?file=${encodeURIComponent(wfPath)}`)).json() as {
+      nodes: { id: string }[]; edges: { source: string; target: string }[];
+    };
+    assert(graph.nodes.length === 2, `画布拿到 2 个节点（实际 ${graph.nodes.length}）`);
+
+    // 用户在画布里删掉 polish —— 它正是声明的交付物
+    const nodes = graph.nodes.filter((n) => n.id !== 'polish');
+    const edges = graph.edges.filter((e) => e.source !== 'polish' && e.target !== 'polish');
+    const res = await fetch(`${base}/api/workflows/graph`, {
+      method: 'POST', headers: { 'Content-Type': 'application/json' },
+      body: JSON.stringify({ file: wfPath, name: '画布交付物', nodes, edges }),
+    });
+    const body = await res.json() as { droppedDeliverables?: string[]; errors?: string[] };
+    assert(res.status === 200, `能存下来，不是 400 把人堵死（实际 ${res.status}：${JSON.stringify(body).slice(0, 120)}）`);
+    assert(body.droppedDeliverables?.includes('polish') === true, `告诉用户摘掉了哪个交付物（实际 ${JSON.stringify(body.droppedDeliverables)}）`);
+
+    const saved = readFileSync(wfPath, 'utf-8');
+    assert(!/deliverables/.test(saved), '落盘的 YAML 里不再有指向已删步骤的 deliverables');
+    assert(/id: draft/.test(saved) && !/id: polish/.test(saved), '步骤本身按画布的结果保存');
+
+    // 交付物还在时，一个字都不许动
+    writeFileSync(wfPath, readFileSync(wfPath, 'utf-8').replace('steps:', 'deliverables: [draft]\nsteps:'), 'utf-8');
+    const graph2 = await (await fetch(`${base}/api/workflows/graph?file=${encodeURICompo
```

**File**: `web/server.js` (modified, +16/-1)
```diff
@@ -1568,6 +1568,21 @@ app.post('/api/workflows/graph', async (req, res) => {
     let yamlText = graphToWorkflow({ name: String(name || 'workflow'), nodes, edges }, base);
     // 保存前用引擎校验挡环 / 坏依赖 / 非法 loop（不校验角色文件存在，结构有效即可）。
     let def = yaml.load(yamlText);
+    // 画布里删掉了某个步骤时，顶层 deliverables 可能还指着它——而画布**没有编辑 deliverables 的入口**，
+    // 于是保存被拒、用户在画布里怎么改都救不回来（只能去手改 YAML，而画布正是给不想碰 YAML 的人用的）。
+    // 处理：把指向已不存在步骤的交付物摘掉（全摘光就连键一起删，回到默认口径"最后一个完成的步骤"），
+    // 并在响应里说清摘了哪些——不闷着改用户的文件。
+    let droppedDeliverables = [];
+    if (Array.isArray(def?.deliverables) && def.deliverables.length > 0) {
+      const alive = new Set((def.steps || []).map((s) => s?.id).filter(Boolean));
+      droppedDeliverables = def.deliverables.filter((d) => !alive.has(d));
+      if (droppedDeliverables.length > 0) {
+        const kept = def.deliverables.filter((d) => alive.has(d));
+        if (kept.length > 0) def.deliverables = kept;
+        else delete def.deliverables;
+        yamlText = yaml.dump(def, { lineWidth: -1, noRefs: true });
+      }
+    }
     let errors = validateWorkflow(def);
     // #91：自动组队产物最常见的错是"变量名对、但缺 depends_on 边"——compose 链路已有
     // 确定性补边修复（#87），画布保存之前没接，导致弹窗能跑、进画布却怎么改都存不了。
@@ -1605,7 +1620,7 @@ app.post('/api/workflows/graph', async (req, res) => {
     }
     if (!isInside(outPath, COMPOSED_DIR)) return res.status(400).json({ error: 'bad path' });
     writeFileSync(outPath, yamlText.endsWith('\n') ? yamlText : yamlText + '\n', 'utf-8');
-    res.json({ file: outPath, overwritten: !!overwritePath, autoFixes });
+    res.json({ file: outPath, overwritten: !!overwritePath, autoFixes, ...(droppedDeliverables.length > 0 ? { droppedDeliverables } : {}) });
   } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
 });
 
```

**File**: `website/src/components/studio/WorkflowCanvas.tsx` (modified, +5/-1)
```diff
@@ -236,7 +236,11 @@ export function WorkflowCanvas({ file, name, onClose, onSaved }: { file: string;
       const outEdges: CanvasEdge[] = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
       const res = await api.saveWorkflowGraph({ file, name, nodes: outNodes, edges: outEdges });
       const fixNote = res.autoFixes?.length ? tc.autoFixed.replace("{n}", String(res.autoFixes.length)) : "";
-      setMsg(`✅ ${res.overwritten ? tc.savedInPlace : tc.savedAsCopy}${fixNote}`);
+      // 删掉的步骤如果正是声明的交付物，服务端会把它从 deliverables 里摘掉——说一声，别让用户事后才发现
+      const dropNote = res.droppedDeliverables?.length
+        ? tc.deliverableDropped.replace("{ids}", res.droppedDeliverables.join("、"))
+        : "";
+      setMsg(`✅ ${res.overwritten ? tc.savedInPlace : tc.savedAsCopy}${fixNote}${dropNote}`);
       // 服务端补了边的话，把画布同步成落盘后的真实形状（否则用户看到的图少几条线）
       if (res.autoFixes?.length) {
         setEdges((eds) => {
```

**File**: `website/src/i18n/translations.ts` (modified, +2/-0)
```diff
@@ -346,6 +346,7 @@ const zh = {
       loadFailed: "加载失败",
       noCycle: "⚠️ 不能连成环——工作流必须是有向无环图",
       autoFixed: "，自动补了 {n} 条缺失的依赖连线",
+      deliverableDropped: "；原先声明的交付物 {ids} 已被删除，已从 deliverables 中摘掉（成品改按最后一个完成的步骤算）",
       savedInPlace: "已保存（就地覆盖）",
       savedAsCopy: "已另存为新工作流",
       saveFailed: "保存失败：",
@@ -1220,6 +1221,7 @@ const en: typeof zh = {
       loadFailed: "Failed to load",
       noCycle: "⚠️ Cycles are not allowed — a workflow must be a DAG",
       autoFixed: ", auto-added {n} missing dependency edge(s)",
+      deliverableDropped: "; the declared deliverable(s) {ids} no longer exist and were removed from `deliverables` (the final output falls back to the last completed step)",
       savedInPlace: "Saved (overwritten in place)",
       savedAsCopy: "Saved as a new workflow",
       saveFailed: "Save failed: ",
```

---

### Incident Patch 4: `43aec9f3` (2026-09-25)
**Commit Message**: fix: --export skill 导出的技能要真能装上（slug 化的 name + 有信息量的 description） (#161)

对着仓库自己的 SKILL.md（ao-skills/shortfilm-prompt、superpowers-zh 那 20 个）核了一遍：
name 就是技能 id，一律是 ASCII slug；description 是模型**决定要不要加载这个技能**时
唯一看得见的东西。

而 --export skill 导出的是：

    name: 登录改造：jwt-迁移        ← 中文，Claude Code 那边装不上
    description: 由 Agency Orchestrator 多智能体协作生成的方法论 / 计划
                                    ← 每个导出的技能都长这一句，模型没法判断何时该用，等于白导

- skillSlug()：name 转 ASCII slug（纯中文名 slug 化后为空 → 退回 ao-skill，宁可通用 id
  也不要一个装不上的名字；人看的标题留在正文里，不丢）；
- skillDescription()：取"工作流名 —— 正文第一句"（跳过标题/引用/代码围栏/表格行）；
- 导出后多打两行告诉用户往哪放：Claude Code 是 ~/.claude/skills/<id>/SKILL.md，
  AO 自己的步骤是 ./skills/<id>/SKILL.md（step 里写 skill: "<id>"）。

plan 格式不受影响（它是给编码 agent 直接执行的指令，不带 frontmatter）。
test/export-convert.ts 加 7 条，变异验证过；真机导出看过 frontmatter。

**File**: `src/cli.ts` (modified, +8/-0)
```diff
@@ -349,6 +349,14 @@ async function handleRun(): Promise<void> {
           const out = resolve(`${safe}.${r.ext}`);
           writeFileSync(out, r.buffer);
           console.log(`\n  📤 已导出 → ${out}（${r.engine}）`);
+          // skill 导出的落点是有讲究的：Claude Code 按 `~/.claude/skills/<id>/SKILL.md` 装，
+          // 只丢一个 .md 在当前目录，用户拿到手也不知道往哪放（frontmatter 里的 name 就是那个 id）
+          if (exportFmt === 'skill') {
+            const { skillSlug } = await import('./export/convert.js');
+            const id = skillSlug(result.name);
+            console.log(`     装给 Claude Code：mkdir -p ~/.claude/skills/${id} && cp "${out}" ~/.claude/skills/${id}/SKILL.md`);
+            console.log(`     装给 AO 自己的步骤（step 里写 skill: "${id}"）：放进 ./skills/${id}/SKILL.md 或 $AO_SKILLS_DIR`);
+          }
           if (r.ext === 'html' && exportFmt === 'pdf') {
             console.log(`     (未检测到 pandoc+LaTeX,已输出打印就绪 HTML;浏览器打开 Ctrl-P 存 PDF,或装 pandoc 获更佳排版)`);
           }
```

**File**: `src/export/convert.ts` (modified, +35/-2)
```diff
@@ -184,10 +184,43 @@ export function extractMarkdownTables(md: string): Array<{ title?: string; rows:
   return tables;
 }
 
+/**
+ * skill 的 name 必须是 ASCII slug：Claude Code / superpowers 那边 name 就是技能 id
+ * （`shortfilm-prompt`、`brainstorming`），中文名进去是装不上的。纯中文工作流名 slug 化后为空，
+ * 退回 `ao-skill`——宁可是个通用 id，也不要一个加载不了的名字。人看的标题在正文里，不丢。
+ */
+export function skillSlug(name: string | undefined): string {
+  const slug = (name || '')
+    .toLowerCase()
+    .replace(/[^a-z0-9]+/g, '-')
+    .replace(/^-+|-+$/g, '')
+    .slice(0, 48)
+    .replace(/-+$/, '');
+  return slug || 'ao-skill';
+}
+
+/**
+ * description 是模型**决定要不要加载这个技能**时唯一看得见的东西。原来一律写
+ * "由 Agency Orchestrator 多智能体协作生成的方法论 / 计划"——每个导出的技能都长一样，
+ * 模型没法据此判断何时该用，等于白导。改成"工作流名 —— 正文第一句"。
+ */
+export function skillDescription(md: string, name?: string): string {
+  const firstLine = md
+    .split('\n')
+    .map((l) => l.trim())
+    .find((l) => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('```') && !l.startsWith('|') && !l.startsWith('---'));
+  const gist = (firstLine || '').replace(/[*_`]/g, '').slice(0, 100);
+  const title = (name || '').trim();
+  if (title && gist) return `${title} —— ${gist}`;
+  return title || gist || '由 Agency Orchestrator 多智能体协作生成的方法论 / 计划';
+}
+
 /** 把报告包成可复用 Skill(.md + frontmatter)或可执行计划(交 Claude Code 跑)。 */
 function toSkillOrPlan(md: string, format: 'skill' | 'plan', opts?: { name?: string; description?: string }): ExportResult {
-  const name = (opts?.name || 'generated-plan').replace(/[^一-鿿a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
-  const desc = opts?.description || '由 Agency Orchestrator 多智能体协作生成的方法论 / 计划';
+  const name = format === 'skill'
+    ? skillSlug(opts?.name)
+    : (opts?.name || 'generated-plan').replace(/[^一-鿿a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
+  const desc = opts?.description || (format === 'skill' ? skillDescription(md, opts?.name) : '由 Agency Orchestrator 多智能体协作生成的方法论 / 计划');
   let content: string;
   if (format === 'skill') {
     content = `---\nname: ${name}\ndescription: ${desc}\n---\n\n${md}\n`;
```

**File**: `test/export-convert.ts` (modified, +25/-0)
```diff
@@ -100,5 +100,30 @@ assert(['pdf', 'html'].includes(pdf.ext), `pdf 产出 ${pdf.ext}(${pdf.engine})`
   assert(new Set(wb.SheetNames).size === 2, `重名被消歧（实际 ${JSON.stringify(wb.SheetNames)}）`);
 }
 
+console.log('\n─── skill 导出要能真装上 ───');
+{
+  // skill 的 name 就是技能 id（Claude Code / superpowers 那边都是 shortfilm-prompt 这种 slug），
+  // 中文名进去装不上；description 又是模型**决定要不要加载**时唯一看得见的东西，
+  // 以前一律写"由 AO 多智能体协作生成的方法论 / 计划"，每个导出都长一样，等于白导。
+  const body = '# 登录改造方案\n\n本方案把会话从 Cookie 迁到 JWT，并给中间件加统一鉴权。\n\n## 步骤\n\n1. 加 JWT\n';
+  const r = await exportMarkdown(body, 'skill', { name: '登录改造：JWT 迁移' });
+  const text = r.buffer.toString('utf-8');
+  const name = text.match(/^name: (.+)$/m)?.[1] ?? '';
+  const desc = text.match(/^description: (.+)$/m)?.[1] ?? '';
+  assert(/^[a-z0-9-]+$/.test(name), `name 必须是 ASCII slug（实际 ${name}）`);
+  assert(desc.includes('登录改造') && desc.includes('Cookie'), `description 要含工作流名与正文第一句（实际 ${desc}）`);
+  assert(!desc.startsWith('由 Agency Orchestrator'), '不再是那句所有技能都一样的套话');
+  assert(text.includes('# 登录改造方案'), '人看的标题留在正文里，不丢');
+
+  // 纯中文名 slug 化后为空 → 用通用 id，宁可通用也不要一个装不上的名字
+  const zh = await exportMarkdown(body, 'skill', { name: '中文工作流' });
+  assert(/^name: ao-skill$/m.test(zh.buffer.toString('utf-8')), '纯中文名退回 ao-skill');
+
+  // plan 是给编码 agent 直接执行的，不是技能，名字不受 slug 约束
+  const plan = await exportMarkdown(body, 'plan', { name: '中文工作流' });
+  assert(!/^name:/m.test(plan.buffer.toString('utf-8')), 'plan 不带 frontmatter');
+  assert(/严格按下面的计划自动执行/.test(plan.buffer.toString('utf-8')), 'plan 带执行指令');
+}
+
 console.log(`\n  结果: ${passed} 通过, ${failed} 失败\n`);
 if (failed > 0) process.exit(1);
```

---

### Incident Patch 5: `083a398a` (2026-09-25)
**Commit Message**: fix: 存档目录开跑前就建，MCP 产物不再按 cwd 落盘 (#160)

* fix: 存档目录开跑前就建，MCP 产物不再按 cwd 落盘

真机：以 cwd=/ 启动 MCP 服务（Claude Desktop 一类宿主常这样），调 run_workflow——
工作流真跑了 21.9 秒，token 花了，最后在存档那一步报
`ENOENT: mkdir 'ao-output/冒烟：两步串行-…/steps'`，产物一个字都没留下。

两头都补：

- run() 在开跑前 mkdir 存档目录，建不了就当场抛、并给出换目录的办法（--output / AO_OUTPUT_DIR
  / AO_HOME）。这条对所有入口都管用：从只读目录跑 CLI 同理。现在 0.0s 报错，不是 21.9s；
- MCP 服务端的产物默认落用户级目录：没配 AO_OUTPUT_DIR / AO_WORKFLOWS_DIR / AO_HOME 时，
  run_workflow 写 ~/.ao/ao-output、compose_workflow 写 ~/.ao/ao-workflows（teams/prompts/roles
  本来就住那儿）。宿主的 cwd 不由用户决定，按 cwd 相对落盘本就站不住。

真机复验：同样 cwd=/ 的调用现在正常跑完，回包里 `存档: /Users/…/.ao/ao-output/…`。

test/version-and-dirs.ts 加 4 条（先报存档目录 / 在任何模型请求之前 / 给出办法 / 当场就报），
test/mcp.ts 加 4 条（默认用户级、compose 同理、绝不是 cwd 相对、显式配了就听用户的）。变异验证过。

* test: 用「拿文件当父目录」造不可写目录，别写死 /proc（只在 Linux 上成立）

顺带给那条 fixture 加 retry: 0 / timeout: 3000：万一守卫没触发，也不会卡在连接重试上。

**File**: `src/index.ts` (modified, +17/-3)
```diff
@@ -404,6 +404,21 @@ export async function run(
     console.log('─'.repeat(50));
   }
 
+  // 开跑前先把存档目录建出来。它本来在跑完之后才建——于是"目录建不了"这件事要等整条工作流
+  // 跑完（token 花了、按秒计费的视频也出了）才暴露，产物当场全丢。
+  // 真机：MCP 宿主常以 cwd=/ 启动服务，21.9 秒跑完后报
+  // `ENOENT: mkdir 'ao-output/…/steps'`，一个字都没留下。
+  const outputBase = options?.outputDir || defaultOutputDir();
+  try {
+    mkdirSync(outputBase, { recursive: true });
+  } catch (err) {
+    const why = err instanceof Error ? err.message : String(err);
+    throw new Error(
+      `存档目录建不了：${resolve(outputBase)}（${why}）。\n`
+      + `  这一步在开跑前检查，免得跑完才发现产物没地方放。换个目录：--output <目录>，或设 AO_OUTPUT_DIR / AO_HOME。`,
+    );
+  }
+
   // SIGTERM/SIGINT 优雅落盘：executor 增量写入 partialSteps，信号来时把
   // 已完成步骤 + 未完成占位存成 metadata 再退出。没有它，网页端"等输入时关页"
   // 或终端 Ctrl-C 的 run 会无痕消失，历史里无法「继续运行」。
@@ -513,9 +528,8 @@ export async function run(
     )
   );
 
-  // 保存结果（默认目录支持 AO_HOME / AO_OUTPUT_DIR，见 utils/paths）
-  const outputDir = options?.outputDir || defaultOutputDir();
-  const outputPath = saveResults(result, outputDir);
+  // 保存结果（目录在开跑前就建好并验过可写，见上面的 outputBase）
+  const outputPath = saveResults(result, outputBase);
   result.outputDir = outputPath;
   settleSpool(outputPath);
   // --resume 复用的媒体步骤没有 base64（它们没重跑），reporter 写不出文件——从上一轮目录复制过来，
```

**File**: `src/mcp/server.ts` (modified, +19/-1)
```diff
@@ -9,7 +9,8 @@
 import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
 import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
 import { z } from 'zod';
-import { resolve, relative, dirname } from 'node:path';
+import { resolve, relative, dirname, join } from 'node:path';
+import { aoUserDir, defaultOutputDir, defaultWorkflowsDir } from '../utils/paths.js';
 import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
 import { createRequire } from 'node:module';
 import { fileURLToPath } from 'node:url';
@@ -33,6 +34,21 @@ const MCP_PROVIDER_IDS = [...new Set([
   ...API_PROVIDERS.map((p) => p.id), ...ANTHROPIC_PROVIDERS.map((p) => p.id),
 ])] as [string, ...string[]];
 
+/**
+ * MCP 宿主的 cwd 不由用户决定（Claude Desktop 一类常以 `/` 启动），所以产物不能按 cwd 相对落盘：
+ * 真机上 cwd=/ 时，工作流跑完 21.9 秒才在存档那一步报 `mkdir 'ao-output/…'` 失败，产物全丢。
+ * 显式配了 AO_OUTPUT_DIR / AO_WORKFLOWS_DIR / AO_HOME 就听用户的，否则落到用户级的 ~/.ao 下
+ * （teams / prompts / roles 本来就住那儿）。
+ */
+export function mcpOutputDir(): string {
+  if (process.env.AO_OUTPUT_DIR || process.env.AO_HOME) return defaultOutputDir();
+  return join(aoUserDir(), 'ao-output');
+}
+export function mcpWorkflowsDir(): string {
+  if (process.env.AO_WORKFLOWS_DIR || process.env.AO_HOME) return defaultWorkflowsDir('ao-workflows');
+  return join(aoUserDir(), 'ao-workflows');
+}
+
 /** 自动查找 agents 目录 */
 function findAgentsDir(hint?: string): string {
   if (hint && existsSync(resolve(hint))) return resolve(hint);
@@ -153,6 +169,7 @@ export async function startServer(verbose = false): Promise<void> {
         const result = await silentCall(() =>
           run(absPath, (inputs || {}) as Record<string, string>, {
             quiet: true,
+            outputDir: mcpOutputDir(),
             llmOverride: Object.keys(llmOverride).length > 0 ? llmOverride : undefined,
           }),
         );
@@ -337,6 +354,7 @@ export async function startServer(verbose = false): Promise<void> {
             description,
             agentsDir,
             llmConfig: { provider: llmProvider, model: llmModel },
+            saveDir: mcpWorkflowsDir(),
           }),
         );
 
```

**File**: `test/mcp.ts` (modified, +20/-0)
```diff
@@ -7,6 +7,7 @@ import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
 import { resolve, join } from 'node:path';
 import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
+import { homedir } from 'node:os';
 import { tmpdir } from 'node:os';
 
 let passed = 0;
@@ -144,6 +145,25 @@ await test('compose_workflow 的 provider 与 CLI 同一套零配置选择（不
   assert(/codex-cli/.test(schema), 'CLI 名单来自注册表，不是手抄的四个');
 });
 
+await test('MCP 的产物不按 cwd 落盘（宿主的 cwd 不由用户决定）', async () => {
+  // 真机：MCP 宿主常以 cwd=/ 启动服务，工作流跑完 21.9 秒才在存档那步报
+  // `mkdir 'ao-output/…'` 失败，产物全丢。显式配了 env 就听用户的，否则落到用户级 ~/.ao。
+  const { mcpOutputDir, mcpWorkflowsDir } = await import('../src/mcp/server.js');
+  const saved = { out: process.env.AO_OUTPUT_DIR, wf: process.env.AO_WORKFLOWS_DIR, home: process.env.AO_HOME };
+  delete process.env.AO_OUTPUT_DIR; delete process.env.AO_WORKFLOWS_DIR; delete process.env.AO_HOME;
+  try {
+    assert(mcpOutputDir().startsWith(join(homedir(), '.ao')), `默认落用户级目录（实际 ${mcpOutputDir()}）`);
+    assert(mcpWorkflowsDir().startsWith(join(homedir(), '.ao')), `compose 产物同理（实际 ${mcpWorkflowsDir()}）`);
+    assert(!mcpOutputDir().startsWith('ao-output'), '绝不是 cwd 相对路径');
+    process.env.AO_OUTPUT_DIR = '/tmp/ao-explicit';
+    assert(mcpOutputDir() === '/tmp/ao-explicit', '显式配了就听用户的');
+  } finally {
+    for (const [k, v] of [['AO_OUTPUT_DIR', saved.out], ['AO_WORKFLOWS_DIR', saved.wf], ['AO_HOME', saved.home]] as const) {
+      if (v === undefined) delete process.env[k]; else process.env[k] = v;
+    }
+  }
+});
+
 await test('list_roles returns roles', async () => {
   const result = await client.callTool({
     name: 'list_roles',
```

**File**: `test/version-and-dirs.ts` (modified, +31/-0)
```diff
@@ -48,6 +48,37 @@ console.log('\n─── 同一秒的两次运行不互相覆盖 ───');
   rmSync(out, { recursive: true, force: true });
 }
 
+console.log('\n─── 存档目录建不了：开跑前就报，别跑完才发现 ───');
+{
+  // 真机：MCP 宿主以 cwd=/ 启动时，工作流跑完 21.9 秒（token 花了、按秒计费的视频也出了）
+  // 才在存档那一步报 `mkdir 'ao-output/…'` 失败，产物一个字都没留下。
+  const wfDir = mkdtempSync(join(tmpdir(), 'ao-nowrite-'));
+  const wf = join(wfDir, 'w.yaml');
+  writeFileSync(wf, [
+    'name: "写不进去"', `agents_dir: "${resolve('node_modules/agency-agents-zh')}"`, 'verify: false',
+    'llm:', '  provider: "deepseek"', '  model: "m"', '  api_key: "k"', '  base_url: "http://127.0.0.1:9/v1"',
+    '  retry: 0', '  timeout: 3000',
+    'steps:', '  - id: a', '    role: "marketing/marketing-content-creator"', '    task: "写一句"', '    output: out', '',
+  ].join('\n'), 'utf-8');
+  // 造一个"建不出来"的目录：拿一个**文件**当父目录，mkdir 必 ENOTDIR——
+  // 各平台一致（/proc 这种只在 Linux 上存在，写死会变成只在某些机器上成立的用例）
+  const blocker = join(wfDir, 'not-a-dir');
+  writeFileSync(blocker, 'x', 'utf-8');
+  const { run } = await import('../src/index.js');
+  let msg = '';
+  const t0 = Date.now();
+  try {
+    await run(wf, {}, { quiet: true, outputDir: join(blocker, 'out') });
+  } catch (e) {
+    msg = e instanceof Error ? e.message : String(e);
+  }
+  assert(/存档目录建不了/.test(msg), `先报存档目录（实际：${msg.slice(0, 90)}）`);
+  assert(!/fetch failed|请求失败|ECONNREFUSED/.test(msg), '在任何模型请求之前就拦住——不是先跑一遍再失败');
+  assert(/--output|AO_OUTPUT_DIR/.test(msg), '给出换目录的办法');
+  assert(Date.now() - t0 < 5000, '当场就报，不该等到跑完');
+  rmSync(wfDir, { recursive: true, force: true });
+}
+
 console.log('\n─── 运行目录名按字节截断（Linux 上 255 字节是硬限） ───');
 {
   // Linux（Docker 镜像、NAS 部署）NAME_MAX=255 **字节**：86 个汉字的工作流名就会让 mkdir
```

---

### Incident Patch 6: `e03ac998` (2026-09-24)
**Commit Message**: fix: --resume last 只找这条工作流自己的上一次运行 (#159)

"last" 以前是整个 ao-output 里最新的那个目录，不看是哪条工作流。同一个输出目录下跑过
别的工作流——设了 AO_HOME、或者用桌面端（所有运行都落在应用数据目录），就都是这样——
"上次运行"会指到别人头上：步骤 id 对不上，轻则整条白重跑，重则 --feedback 把风马牛不相及
的"上一版产出"递给专家让他"在此基础上改"。

真机：同一目录先后跑 a.yaml 与 b.yaml，再对 a.yaml --resume last，以前恢复的是 b 的档案。

- reporter 出 runDirPrefix()：运行目录名里工作流名那一段，与 saveResults 同源（各写一份
  的话，改了清洗规则就变成"永远筛不到"）；
- cli.ts 解析 "last" 时按这个前缀筛；这条工作流从没跑过就退回旧口径，但**明确说一声**
  "改用最近一次运行的档案（步骤 id 对不上的话会整条重跑）"，不闷着换一份档案。

test/resume.ts 加 1 条（5 个断言：不带名字确实拿到最新的、带前缀只找自己的、没跑过返回
null、前缀与 saveResults 同源、清洗过的名字也对得上）。

**File**: `src/cli.ts` (modified, +15/-3)
```diff
@@ -230,14 +230,26 @@ async function handleRun(): Promise<void> {
     timeoutMs = parsed;
   }
 
-  // --resume last: 自动找最近一次的输出目录
+  // --resume last: 自动找**这条工作流**最近一次的输出目录。
+  // 以前不筛名字，"last" 是整个 ao-output 里最新的那个——同一个目录下跑过别的工作流（设了
+  // AO_HOME 或用桌面端就是这样）时，会拿另一条工作流的档案来复用/返工：步骤 id 对不上，
+  // 轻则整条重跑，重则 --feedback 把风马牛不相及的上一版产出递给专家。
   if (resumeDir === 'last') {
-    const { findLatestOutput } = await import('./output/reporter.js');
-    const latest = findLatestOutput(outputDir);
+    const { findLatestOutput, runDirPrefix } = await import('./output/reporter.js');
+    let prefix: string | undefined;
+    try {
+      const { parseWorkflow } = await import('./core/parser.js');
+      prefix = runDirPrefix(parseWorkflow(resolveWorkflowArg(filePath)).name);
+    } catch { /* 工作流本身有问题：交给后面的 run() 去报，这里退回旧口径 */ }
+    const latest = findLatestOutput(outputDir, prefix) ?? (prefix ? findLatestOutput(outputDir) : null);
     if (!latest) {
       console.error('找不到上一次的运行输出，请指定具体目录: --resume <dir>');
       process.exit(1);
     }
+    // 退而求其次用了别条工作流的档案：说一声，别让用户以为复用的是自己那条
+    if (prefix && !basename(latest).startsWith(prefix)) {
+      console.log(`  ⚠️ 这条工作流没有历史运行，改用最近一次运行的档案：${basename(latest)}（步骤 id 对不上的话会整条重跑）`);
+    }
     resumeDir = latest;
   }
 
```

**File**: `src/output/reporter.ts` (modified, +17/-8)
```diff
@@ -36,20 +36,29 @@ export function formatAssertion(a: StepVerification | undefined, en = false): st
 /**
  * 保存工作流执行结果到文件
  */
-export function saveResults(result: WorkflowResult, outputDir: string): string {
-  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
-  // 清洗工作流名再作目录名：Windows 禁止 \ / : * ? " < > | 及控制字符，run-role 默认名
-  // "专家咨询: <role>" 含冒号会让 win 上 mkdirSync 直接失败。统一在此清洗，对全平台/全工作流生效。
-  // 再截到 120 字节：加上 "-2026-09-24T06-17-50"（20）与可能的 "-2" 后缀仍远低于 255 字节，
-  // Windows 那边整条路径也留得下余量。
-  const safeName = clipBytes(
-    (result.name || 'workflow')
+/**
+ * 运行目录名里工作流名那一段（`<prefix>-<时间戳>`）。
+ * `--resume last` 要按它筛"这条工作流自己的上一次运行"，所以必须和 saveResults 用同一份算法——
+ * 各写一份的话，改了清洗规则就会变成"筛不到任何目录"。
+ */
+export function runDirPrefix(name: string | undefined): string {
+  return clipBytes(
+    (name || 'workflow')
       .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-')
       .replace(/\s+/g, '-')
       .replace(/-+/g, '-')
       .replace(/^-+|-+$/g, '') || 'workflow',
     120,
   ).replace(/-+$/, '') || 'workflow';
+}
+
+export function saveResults(result: WorkflowResult, outputDir: string): string {
+  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
+  // 清洗工作流名再作目录名：Windows 禁止 \ / : * ? " < > | 及控制字符，run-role 默认名
+  // "专家咨询: <role>" 含冒号会让 win 上 mkdirSync 直接失败。统一在此清洗，对全平台/全工作流生效。
+  // 再截到 120 字节：加上 "-2026-09-24T06-17-50"（20）与可能的 "-2" 后缀仍远低于 255 字节，
+  // Windows 那边整条路径也留得下余量。
+  const safeName = runDirPrefix(result.name);
   // 时间戳只到秒：同一秒内跑完的两次同名工作流会写进同一个目录，后一次把前一次的
   // steps/*.md、summary.md、metadata.json 盖掉，还留下前一次多出来的步骤文件成为混合体。
   // Studio 允许并行跑，所以这不是假想。撞上就加后缀，绝不覆盖已有的运行。
```

**File**: `test/resume.ts` (modified, +27/-2)
```diff
@@ -3,7 +3,7 @@
  * 覆盖: skipStepIds 计算（纯函数）+ 完整 run→save→resume 往返（Mock LLM）
  * DAG: L0=[analyze]  L1=[tech_review, design_review]  L2=[final_summary]
  */
-import { resolve, join } from 'node:path';
+import { resolve, join, basename } from 'node:path';
 import { existsSync, readFileSync, rmSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
 import { tmpdir } from 'node:os';
 import { parseWorkflow } from '../src/core/parser.js';
@@ -16,7 +16,7 @@ import {
   computeResumeSkipIds,
   findLatestOutput,
 } from '../src/output/reporter.js';
-import type { LLMConnector, LLMResult, LLMConfig } from '../src/types.js';
+import type { LLMConnector, LLMResult, LLMConfig, WorkflowResult } from '../src/types.js';
 
 const agentsDir = [
   resolve(import.meta.dirname!, '../node_modules/agency-agents-zh'),
@@ -197,6 +197,31 @@ await test('首次运行 + 保存 metadata', async () => {
   assert(completed.length === 4, `应记录 4 个已完成步骤，实际 ${completed.length}`);
 });
 
+await test('--resume last 只找**这条工作流**自己的上一次运行', async () => {
+  // 以前 "last" = 整个 ao-output 里最新的那个目录，不看是哪条工作流。同一个目录下跑过别的工作流
+  // （设了 AO_HOME、或用桌面端，就都是这样）时，会拿另一条的档案来复用/返工：步骤 id 对不上，
+  // 轻则整条重跑，重则 --feedback 把风马牛不相及的上一版产出递给专家。
+  const { runDirPrefix } = await import('../src/output/reporter.js');
+  const mixed = mkdtempSync(join(tmpdir(), 'ao-mixed-out-'));
+  const mk = (name: string) => saveResults(
+    { name, success: true, steps: [{ id: 'a', role: 'r', status: 'completed', output: 'x', duration: 1, tokens: { input: 1, output: 1 } }], totalDuration: 1, totalTokens: { input: 1, output: 1 } } as unknown as WorkflowResult,
+    mixed,
+  );
+  const mine = mk('我的工作流');
+  await new Promise((r) => setTimeout(r, 1100));   // 时间戳只到秒，隔开两次
+  const other = mk('别人的工作流');
+
+  assert(findLatestOutput(mixed) === other, '不带名字时确实会拿到最新的那条（这正是老行为）');
+  assert(findLatestOutput(mixed, runDirPrefix('我的工作流')) === mine, '带上本工作流的前缀就只找自己的');
+  assert(findLatestOutput(mixed, runDirPrefix('没跑过的工作流')) === null, '自己没跑过就返回 null（由调用方决定退回还是报错）');
+
+  // 前缀算法必须与 saveResults 同源：各写一份的话，改了清洗规则就会"永远筛不到"
+  assert(basename(mine).startsWith(runDirPrefix('我的工作流')), 'runDirPrefix 与 saveResults 的目录名同源');
+  const weird = mk('带 空格/和:非法字符');
+  assert(basename(weird).startsWith(runDirPrefix('带 空格/和:非法字符')), '清洗过的名字也对得上');
+  rmSync(mixed, { recursive: true, force: true });
+});
+
 await test('loadPreviousContext 恢复 inputs + 各步 output', () => {
   const dir = findLatestOutput(tmpOut)!;
   const ctx = loadPreviousContext(dir);
```

---

### Incident Patch 7: `997d67fa` (2026-09-24)
**Commit Message**: fix: MCP 的 compose_workflow 也走零配置选 provider，别硬兜底 deepseek (#158)

拿真 MCP 客户端调 compose_workflow，在这台装了 claude-code 的机器上报：
「缺少 API Key：文本供应商 deepseek 没配 key」。而同一台机器上 `ao compose` 零配置
就能跑——CLI 侧的 autoProvider 会优先用已装的订阅制 CLI，MCP 侧却硬编码兜底 deepseek，
provider 枚举也只有手抄的四个（deepseek/claude/openai/ollama），CLI 类一个都选不了。

MCP 宿主（Claude Code / Claude Desktop）基本都是装了 CLI 的机器，这条路径恰恰最该零配置。

- 选择逻辑抽到 providers/detect.ts 的 pickAutoProvider()（纯函数、不打印，额外返回 reason
  让调用方决定要不要把"为什么选它"说给用户听）；
- cli.ts 的 autoProvider 改成调它 + 打那句提示，行为不变；
- MCP compose_workflow 改用同一套，provider 枚举换成 MCP_PROVIDER_IDS（与 run_workflow 一致，
  来自注册表），模型名按 CLI 类留空、API 类取注册表默认。

真机复验：同一条 MCP 调用现在选中 claude-code，生成的工作流 llm.provider 就是 claude-code。
test/detect-providers.ts 加 4 条（本机装了能从已知目录探到的 CLI 时自动改测"CLI 优先于
已配 key"，不写只在某些机器上成立的断言）；test/mcp.ts 加 1 条钉住枚举含 CLI 类，变异验证过。

**File**: `src/cli.ts` (modified, +6/-19)
```diff
@@ -18,7 +18,7 @@ import { buildDAG, formatDAG } from './core/dag.js';
 import { summarizeMediaSpend } from './media/preflight.js';
 import { listAgents, filterAgentsByKeyword } from './agents/loader.js';
 import { run, findAgentsDir, compareWorkflowVsBaseline } from './index.js';
-import { detectInstalledCliProviders, detectUsableCliProviders, DEPRECATED_CLI_PROVIDERS, CLI_PROVIDER_IDS } from './providers/detect.js';
+import { detectInstalledCliProviders, detectUsableCliProviders, pickAutoProvider, DEPRECATED_CLI_PROVIDERS, CLI_PROVIDER_IDS } from './providers/detect.js';
 import { CLAUDE_DEFAULT_MODEL, API_PROVIDERS, VIDEO_PROVIDERS, API_PROVIDER_MAP } from './connectors/api-providers.js';
 import { postChatCompletions, postApiEndpoint, endpointHint, normalizeBaseUrl, envProxyHint } from './connectors/openai-compatible.js';
 import { installEnvProxy, envProxyStatus } from './utils/env-proxy.js';
@@ -722,25 +722,12 @@ function firstPositional(): string | undefined {
  * 用于 compose / prompt / team 等「需要一个能直接跑的 provider」的路径；`ao run` 不走这里（尊重 YAML）。
  */
 function autoProvider(explicit: string | undefined, fallback: string): string {
-  if (explicit) return explicit;
-  // 1) 本机已装的订阅制 CLI 优先（零配置、复用登录态）——已停服的（如 gemini-cli）绝不自动选
-  const detected = detectUsableCliProviders();
-  if (detected.length > 0) {
-    console.log(`  🔌 检测到本机已安装 ${detected[0]}，零配置直接用（要换 provider 用 --provider 指定）\n`);
-    return detected[0];
-  }
-  // 2) 没装 CLI：尊重用户已配 key 的 provider（与 Web /api/config 的 recommended 一致），
-  //    避免用户配了 OPENAI/Anthropic key 却被兜底成 deepseek 而报错。
-  const keyed: Array<[string, string]> = [
-    ['deepseek', 'DEEPSEEK_API_KEY'],
-    ['openai', 'OPENAI_API_KEY'],
-    ['claude', 'ANTHROPIC_API_KEY'],
-  ];
-  for (const [provider, envKey] of keyed) {
-    if (process.env[envKey]) return provider;
+  // 选择逻辑在 providers/detect.ts（与 MCP 服务端共用一份），这里只负责把"为什么选它"说出来
+  const picked = pickAutoProvider(explicit, fallback);
+  if (picked.reason === 'installed-cli') {
+    console.log(`  🔌 检测到本机已安装 ${picked.provider}，零配置直接用（要换 provider 用 --provider 指定）\n`);
   }
-  // 3) 都没有 → 兜底默认
-  return fallback;
+  return picked.provider;
 }
 
 /**
```

**File**: `src/mcp/server.ts` (modified, +12/-10)
```diff
@@ -20,7 +20,7 @@ import { parseWorkflow, validateWorkflow } from '../core/parser.js';
 import { buildDAG, formatDAG } from '../core/dag.js';
 import { listAgents } from '../agents/loader.js';
 import { composeWorkflow } from '../cli/compose.js';
-import { CLI_PROVIDER_IDS, isCliProvider } from '../providers/detect.js';
+import { CLI_PROVIDER_IDS, isCliProvider, pickAutoProvider } from '../providers/detect.js';
 import { CLAUDE_DEFAULT_MODEL, API_PROVIDERS, API_PROVIDER_MAP, ANTHROPIC_PROVIDERS } from '../connectors/api-providers.js';
 
 /**
@@ -315,20 +315,22 @@ export async function startServer(verbose = false): Promise<void> {
     'Generate a workflow YAML from a natural language description using AI',
     {
       description: z.string().describe('One-sentence workflow description'),
-      provider: z.enum(['deepseek', 'claude', 'openai', 'ollama']).optional().describe('LLM provider (default: deepseek)'),
+      provider: z.enum(MCP_PROVIDER_IDS).optional().describe('LLM provider (default: an installed CLI provider, else a keyed one)'),
       model: z.string().optional().describe('Model name'),
     },
     async ({ description, provider, model }) => {
       try {
         const agentsDir = findAgentsDir();
-        const llmProvider = provider || process.env.AO_PROVIDER as any || 'deepseek';
-        const defaultModels: Record<string, string> = {
-          deepseek: 'deepseek-chat',
-          claude: CLAUDE_DEFAULT_MODEL,
-          openai: 'gpt-4o',
-          ollama: 'llama3',
-        };
-        const llmModel = model || process.env.AO_MODEL || defaultModels[llmProvider] || 'gpt-4o';
+        // 与 CLI 同一套零配置选择：本机装了 claude-code / codex-cli 就直接用它（复用登录态）。
+        // 以前这里硬编码兜底 deepseek——于是同一台装了 claude-code 的机器上，`ao compose` 能跑，
+        // 经 MCP 调 compose_workflow 却报「缺少 API Key」。MCP 宿主基本都是这种机器。
+        const llmProvider = pickAutoProvider(provider || process.env.AO_PROVIDER, 'deepseek').provider;
+        // CLI 类 provider 不认模型名（用它自己的默认）；API 类回退到该家注册表里的默认模型
+        const llmModel = model || process.env.AO_MODEL || (
+          isCliProvider(llmProvider) ? ''
+          : llmProvider === 'claude' ? CLAUDE_DEFAULT_MODEL
+          : API_PROVIDER_MAP[llmProvider]?.defaultModel || 'gpt-4o'
+        );
 
         const result = await silentCall(() =>
           composeWorkflow({
```

**File**: `src/providers/detect.ts` (modified, +26/-0)
```diff
@@ -89,3 +89,29 @@ export function detectInstalledCliProviders(env: NodeJS.ProcessEnv = process.env
 export function detectUsableCliProviders(env: NodeJS.ProcessEnv = process.env): string[] {
   return detectInstalledCliProviders(env).filter((name) => !(name in DEPRECATED_CLI_PROVIDERS));
 }
+
+/**
+ * 零配置选 provider（纯函数，不打印）：没显式指定时，优先本机已装的订阅制 CLI（复用其登录态、
+ * 无需配 key），其次是已配 key 的 API provider，最后才兜底。
+ *
+ * CLI 与 MCP 必须走同一套：MCP 服务端此前把 compose 的 provider 硬编码成 deepseek，
+ * 于是在一台装了 claude-code 的机器上（MCP 宿主基本都是这种），`ao compose` 能零配置跑，
+ * 经 MCP 调 compose_workflow 却报「缺少 API Key」——同一台机器两种结果。
+ * 返回 reason 让调用方决定要不要把"为什么选它"说给用户听。
+ */
+export function pickAutoProvider(
+  explicit: string | undefined,
+  fallback: string,
+  env: NodeJS.ProcessEnv = process.env,
+): { provider: string; reason: 'explicit' | 'installed-cli' | 'keyed' | 'fallback' } {
+  if (explicit) return { provider: explicit, reason: 'explicit' };
+  const detected = detectUsableCliProviders(env);
+  if (detected.length > 0) return { provider: detected[0], reason: 'installed-cli' };
+  const keyed: Array<[string, string]> = [
+    ['deepseek', 'DEEPSEEK_API_KEY'],
+    ['openai', 'OPENAI_API_KEY'],
+    ['claude', 'ANTHROPIC_API_KEY'],
+  ];
+  for (const [provider, envKey] of keyed) if (env[envKey]) return { provider, reason: 'keyed' };
+  return { provider: fallback, reason: 'fallback' };
+}
```

**File**: `test/detect-providers.ts` (modified, +30/-1)
```diff
@@ -5,7 +5,7 @@
 import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
 import { tmpdir } from 'node:os';
 import { join, delimiter } from 'node:path';
-import { isOnPath, detectInstalledCliProviders, CLI_PROVIDER_BINS, CLI_PROVIDER_IDS, isCliProvider } from '../src/providers/detect.js';
+import { isOnPath, detectInstalledCliProviders, pickAutoProvider, CLI_PROVIDER_BINS, CLI_PROVIDER_IDS, isCliProvider } from '../src/providers/detect.js';
 import { readFileSync } from 'node:fs';
 import { hasExtraBinDirs } from '../src/utils/bin-lookup.js';
 
@@ -43,6 +43,35 @@ try {
   rmSync(dir, { recursive: true, force: true });
 }
 
+console.log('\n─── 零配置选 provider：CLI 与 MCP 必须同一套 ───');
+{
+  // MCP 服务端此前把 compose 的 provider 硬编码兜底成 deepseek：同一台装了 claude-code 的机器上，
+  // `ao compose` 零配置就能跑，经 MCP 调 compose_workflow 却报「缺少 API Key」。
+  // 而 MCP 宿主（Claude Code / Claude Desktop）基本都是装了 CLI 的机器。
+  const binDir = mkdtempSync(join(tmpdir(), 'ao-auto-'));
+  const fake = join(binDir, 'claude');
+  writeFileSync(fake, '#!/bin/sh\nexit 0\n', 'utf-8');
+  chmodSync(fake, 0o755);
+  const withCli: NodeJS.ProcessEnv = { PATH: binDir };
+  assert(pickAutoProvider(undefined, 'deepseek', withCli).provider === 'claude-code', '装了 CLI 就用它');
+  assert(pickAutoProvider(undefined, 'deepseek', withCli).reason === 'installed-cli', 'reason 说清为什么（调用方据此决定要不要打提示）');
+  assert(pickAutoProvider('openai', 'deepseek', withCli).provider === 'openai', '显式指定永远优先');
+  // 没有任何 CLI 时的两条分支（兜底 / 用已配 key 的那家）要在"本机真没装"的前提下测。
+  // 注意：codebuddy 这类 CLI 即使 PATH 为空也能从已知安装目录探到（bin-lookup.ts），
+  // 所以不能假设清空 PATH 就等于"没装"——按实际探测结果分流，别写一条只在某些机器上成立的断言。
+  const bare: NodeJS.ProcessEnv = { PATH: join(binDir, 'nothing-here') };
+  const stillDetected = detectInstalledCliProviders(bare);
+  if (stillDetected.length === 0) {
+    assert(pickAutoProvider(undefined, 'deepseek', bare).provider === 'deepseek', '什么都没有 → 兜底');
+    assert(pickAutoProvider(undefined, 'deepseek', { ...bare, OPENAI_API_KEY: 'k' }).provider === 'openai', '没装 CLI 但配了 key → 用那家，别兜底成没 key 的 deepseek');
+  } else {
+    // 本机装着能被已知目录探到的 CLI（如 WorkBuddy 自带的 codebuddy）：改测"CLI 优先于已配的 key"
+    assert(pickAutoProvider(undefined, 'deepseek', { ...bare, OPENAI_API_KEY: 'k' }).provider === stillDetected[0],
+      `本机探到 ${stillDetected[0]}：CLI 优先于已配 key（兜底那两条在这台机器上测不了，CI 上会测）`);
+  }
+  rmSync(binDir, { recursive: true, force: true });
+}
+
 console.log('\n─── CLI provider 名单只有一份 ───');
 {
   // 这份名单曾在 9 个地方各抄一份。钉两件事：它和二进制表对得上；别处没有再长出手抄的副本。
```

**File**: `test/mcp.ts` (modified, +11/-0)
```diff
@@ -133,6 +133,17 @@ await test('跑不成必须说出口：不可交互的 approval 步骤不能按
   }
 });
 
+await test('compose_workflow 的 provider 与 CLI 同一套零配置选择（不再硬兜底 deepseek）', async () => {
+  // 以前这里硬编码 provider: 'deepseek'：同一台装了 claude-code 的机器上，`ao compose` 零配置能跑，
+  // 经 MCP 调 compose_workflow 却报「缺少 API Key」——而 MCP 宿主基本都是装了 CLI 的机器。
+  // 这里不真调模型（那要花钱），只钉住入参契约：provider 枚举得容得下 CLI 类。
+  const tools = await client.listTools();
+  const compose = tools.tools.find((t) => t.name === 'compose_workflow');
+  const schema = JSON.stringify(compose?.inputSchema ?? {});
+  assert(/claude-code/.test(schema), `provider 枚举要含 CLI 类（实际：${schema.slice(0, 200)}）`);
+  assert(/codex-cli/.test(schema), 'CLI 名单来自注册表，不是手抄的四个');
+});
+
 await test('list_roles returns roles', async () => {
   const result = await client.callTool({
     name: 'list_roles',
```

---

### Incident Patch 8: `64c41fc0` (2026-09-24)
**Commit Message**: fix: resume 时上游重跑了，下游不能再拿旧产物充数 (#156)

真机：两步工作流（draft → polish）跑完后，在中间插一步 enrich、把 polish 的 task 改成
引用 {{enriched}}，再 --resume last。结果：enrich 跑了，polish 因为"上次已完成"被整个
跳过——交付物还是那份**没见过 enrich 产出**的旧货，而且一个字都不提示。

而"改完工作流再 resume"正是本项目主推的迭代方式（CLAUDE.md 通篇在教这个）。

- resumeSkipDetail()：复用集合按依赖做闭包收缩——上游这轮会跑（新插的步骤、上次没跑成的、
  --from 点名的），下游的旧产物就作废，传递地收；
- 作废了要说出口：多打一行"这些步骤上次跑过，但上游这轮要重跑，旧产物已作废，会一起重跑：…"；
- 例外：上一轮按 condition 跳过的上游不算"会重跑"（getSkippedStepIds 从档案里读）。
  否则短剧流水线里常年为假的 vo1/vo2/vo3 会让 film 每次 resume 都重合成。代价是条件这轮
  恰好翻真时下游仍复用旧产物——用户改了输入通常整体重跑，这里取轻。

test/resume.ts 加 1 条（6 个断言：插步作废、传递作废、条件跳过不误伤、没说明时保守作废），
并修了「短剧 --from shot3」那条的数据：它的 done 清单漏了 atmosphere_lock，而 shot*_prompt
全都依赖它——漏写等于假设它没跑过，新规则据此把下游全判作废。补齐后照旧只重跑 shot3/film/pack。

**File**: `src/index.ts` (modified, +10/-5)
```diff
@@ -93,7 +93,7 @@ import { summarizeMediaSpend } from './media/preflight.js';
 import { createConnector } from './connectors/factory.js';
 import { describePendingVideoTasks } from './connectors/video.js';
 import { loadAgent } from './agents/loader.js';
-import { saveResults, printStepResult, printStepRunning, clearRunningLine, printSummary, loadPreviousContext, getCompletedStepIds, findLatestOutput, computeResumeSkipIds, vanishedStepIds, loadStepOutput } from './output/reporter.js';
+import { saveResults, printStepResult, printStepRunning, clearRunningLine, printSummary, loadPreviousContext, getCompletedStepIds, getSkippedStepIds, findLatestOutput, computeResumeSkipIds, resumeSkipDetail, loadStepOutput } from './output/reporter.js';
 import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
 import { resolve, dirname, join } from 'node:path';
 import { fileURLToPath } from 'node:url';
@@ -307,7 +307,8 @@ export async function run(
     }
 
     const completedBefore = getCompletedStepIds(resumeDir);
-    skipStepIds = computeResumeSkipIds(dag, completedBefore, fromStep);
+    const resumePlan = resumeSkipDetail(dag, completedBefore, fromStep, getSkippedStepIds(resumeDir));
+    skipStepIds = resumePlan.skip;
     // 被跳过的图片/视频步骤的产物在上一轮的 assets/ 里：读进登记表，下游图生视频 / concat 才拿得到字节
     preloadProducedMedia(join(resumeDir, 'assets'), media);
 
@@ -325,9 +326,13 @@ export async function run(
       console.log(`  跳过已完成步骤: ${skipStepIds.size} 个`);
       // 改过 step id / 删了步骤后再 resume：那些名字在新工作流里已经没有对应物，复用不了。
       // 不说的话用户只会看到"跳过 N 个"比预期少，以为是引擎抽风。
-      const vanished = vanishedStepIds(dag, completedBefore);
-      if (vanished.length > 0) {
-        console.log(`  上次运行里有 ${vanished.length} 个步骤在当前工作流里已不存在（改了 id 或删掉了）：${vanished.join(', ')} —— 这些不会被复用`);
+      if (resumePlan.vanished.length > 0) {
+        console.log(`  上次运行里有 ${resumePlan.vanished.length} 个步骤在当前工作流里已不存在（改了 id 或删掉了）：${resumePlan.vanished.join(', ')} —— 这些不会被复用`);
+      }
+      // 上游要重跑 → 下游的旧产物作废。不说的话，用户以为"只多跑了新插的那步"，
+      // 实际拿到的是没见过新产出的旧交付物
+      if (resumePlan.staleDownstream.length > 0) {
+        console.log(`  这些步骤上次跑过，但上游这轮要重跑，旧产物已作废，会一起重跑：${resumePlan.staleDownstream.join(', ')}`);
       }
       if (fromStep) console.log(`  从步骤 [${fromStep}] 开始重新执行`);
     }
```

**File**: `src/output/reporter.ts` (modified, +79/-22)
```diff
@@ -371,6 +371,18 @@ export function loadStepOutput(outputDir: string, stepId: string): string | null
 /**
  * 获取上一次运行的步骤 ID 列表（已完成的）
  */
+/** 上一轮按 condition 跳过的步骤 id（resume 计划要用：它们不产出，不该因此作废下游） */
+export function getSkippedStepIds(outputDir: string): string[] {
+  const metadataPath = join(outputDir, 'metadata.json');
+  if (!existsSync(metadataPath)) return [];
+  try {
+    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
+    return (metadata.steps ?? [])
+      .filter((s: { status: string }) => s.status === 'skipped')
+      .map((s: { id: string }) => s.id);
+  } catch { return []; }
+}
+
 export function getCompletedStepIds(outputDir: string): string[] {
   const metadataPath = join(outputDir, 'metadata.json');
   if (!existsSync(metadataPath)) return [];
@@ -392,37 +404,82 @@ export function computeResumeSkipIds(
   dag: { levels: string[][]; nodes?: Map<string, { step: { depends_on?: string[] } }> },
   completedIds: string[],
   fromStep?: string,
+  skippedBefore: string[] = [],
 ): Set<string> {
-  if (!fromStep) return new Set(completedIds);
-  const fromLevel = dag.levels.findIndex(l => l.includes(fromStep));
-  if (fromLevel < 0) {
-    throw new Error(`--from 指定的步骤 "${fromStep}" 不存在`);
-  }
-  // 语义：重跑 fromStep 及其**下游**，其余已完成的一律复用——按依赖算，不按层级。
-  // 此前按层级跳过（只跳 fromStep 那层之前的），同层兄弟会被一起重跑：短剧流水线 --from shot3
-  // 会把 shot1/shot2 重新出片——云端是白花两条片的钱，本地是白等 8 分钟。真机 2026-08-30 撞到。
+  return resumeSkipDetail(dag, completedIds, fromStep, skippedBefore).skip;
+}
+
+/**
+ * resume 的复用计划。除了"跳哪些"，还要说清**为什么有些跳不了**：
+ *  - vanished：档案里已完成、但当前工作流里已经没有这个 id（改名 / 删了步骤）；
+ *  - staleDownstream：上游这一轮要重跑，它的旧产物就不能再用了。
+ *
+ * 后者是真机撞出来的静默错误：两步工作流跑完后在中间插一步、把下游的 task 改成引用新变量，
+ * 再 `--resume last` —— 新步骤跑了，下游却被当成"已完成"整个跳过，交付物还是**没见过新步骤产出**
+ * 的旧货，而且一个字都不提示。而"改完再 resume"正是本项目主推的迭代方式。
+ */
+export function resumeSkipDetail(
+  dag: { levels: string[][]; nodes?: Map<string, { step: { depends_on?: string[] } }> },
+  completedIds: string[],
+  fromStep?: string,
+  /** 上一轮按 condition 跳过的步骤：这轮跳不跳都不会凭空多出产物，不该因此作废下游 */
+  skippedBefore: string[] = [],
+): { skip: Set<string>; vanished: string[]; staleDownstream: string[] } {
+  const known = dag.nodes ? new Set(dag.nodes.keys()) : new Set(dag.levels.flat());
   const completed = new Set(completedIds);
-  const rerun = new Set<string>([fromStep]);
+  const rerun = new Set<string>();
+  if (fromStep) {
+    const fromLevel = dag.levels.findIndex((l) => l.includes(fromStep));
+    if (fromLevel < 0) {
+      throw new Error(`--from 指定的步骤 "${fromStep}" 不存在`);
+    }
+    // 语义：重跑 fromStep 及其**下游**，其余已完成的一律复用——按依赖算，不按层级。
+    // 此前按层级跳过（只跳 fromStep 那层之前的），同层兄弟会被一起重跑：短剧流水线 --from shot3
+    // 会把 shot1/shot2 重新出片——云端是白花两条片的钱，本地是白等 8 分钟。真机 2026-08-30 撞到。
+    rerun.add(fromStep);
+    if (dag.nodes) {
+      let grew = true;
+      while (grew) {
+        grew = false;
+        for (const [id, node] of dag.nodes) {
+          if (rerun.has(id)) continue;
+          if ((node.step.depends_on ?? []).some((d) => rerun.has(d))) { rerun.add(id); grew = true; }
+        }
+      }
+    } else {
+      // 没有依赖信息（旧调用方只给 levels）时退回层级语义
+      for (let li = fromLevel; li < dag.levels.length; li++) for (const id of dag.levels[li]) rerun.add(id);
+    }
+  }
+
+  // 只留**当前工作流里还存在**的 step：用户改了 id / 删了步骤后，上一次档案里那些名字已经没用了。
+  // 留着不会出错（执行器按 id 查，查不到就是没跳过），但会让"跳过已完成步骤: N 个"虚报。
+  const vanished = [...completed].filter((id) => !known.has(id));
+  const skip = new Set<string>();
+  for (const id of completed) if (!rerun.has(id) && known.has(id)) skip.add(id);
+
+  // 上游这一轮要重跑（新插的步骤、上次没跑成的步骤、--from 点名的那些），下游的旧产物就作废了。
+  // 传递地收：A 重跑 → B 不能复用 → 依赖 B 的 C 也不能复用。
+  const staleDownstream: string[] = [];
+  // 上一轮按 condition 跳过的上游不算"会重跑"：短剧流水线里 vo1/vo2/vo3 常年条件为假，
+  // 若把它们当成会产出，film 每次 resume 都要重合成——而条件没变时那纯属白跑。
+  // 代价是：条件这轮恰好翻真时，下游仍按旧产物复用（用户改了输入通常会整体重跑，这里取轻）。
+  const benign = new Set(skippedBefore);
   if (dag.nodes) {
     let grew = true;
     while (grew) {
       grew = false;
-      for (const [
```

**File**: `test/resume.ts` (modified, +46/-2)
```diff
@@ -87,12 +87,56 @@ await test('短剧流水线 --from shot3：shot1/shot2/定妆图/剧本全部复
   const { parseWorkflow: pw } = await import('../src/core/parser.js');
   const { buildDAG: bd } = await import('../src/core/dag.js');
   const d = bd(pw('workflows/短剧流水线.yaml'));
-  const done = ['script', 'character_prompt', 'shot1_prompt', 'shot2_prompt', 'shot3_prompt', 'character', 'shot1', 'shot2', 'shot3', 'film', 'pack'];
-  const skip = computeResumeSkipIds(d, done, 'shot3');
+  // 一次「不配旁白」的完整成功运行：无条件步骤全 completed，条件为假的旁白/配音全 skipped。
+  // （这份清单以前漏了 atmosphere_lock —— 而 shot*_prompt 都依赖它，漏写等于假设它没跑过。）
+  const done = ['script', 'atmosphere_lock', 'character_prompt', 'shot1_prompt', 'shot2_prompt', 'shot3_prompt', 'character', 'shot1', 'shot2', 'shot3', 'film', 'pack'];
+  const skippedByCondition = ['narration1', 'narration2', 'narration3', 'vo1', 'vo2', 'vo3'];
+  const skip = computeResumeSkipIds(d, done, 'shot3', skippedByCondition);
   assert(skip.has('shot1') && skip.has('shot2') && skip.has('character') && skip.has('script'), `应复用 shot1/shot2，实际跳过: ${[...skip]}`);
   assert(!skip.has('shot3') && !skip.has('film') && !skip.has('pack'), 'shot3 与下游 film/pack 要重跑');
 });
 
+await test('中间插了一步：下游不能拿旧产物充数', async () => {
+  // 真机撞到的静默错误：两步工作流跑完后在中间插一步、把下游 task 改成引用新变量，再 --resume last。
+  // 新步骤跑了，下游却被当成"已完成"整个跳过 —— 交付物还是没见过新步骤产出的旧货，一个字都不提示。
+  // 而"改完再 resume"正是本项目主推的迭代方式。
+  const { resumeSkipDetail } = await import('../src/output/reporter.js');
+  const inserted = {
+    levels: [['draft'], ['enrich'], ['polish']],
+    nodes: new Map<string, { step: { depends_on?: string[] } }>([
+      ['draft', { step: {} }],
+      ['enrich', { step: { depends_on: ['draft'] } }],
+      ['polish', { step: { depends_on: ['enrich'] } }],
+    ]),
+  };
+  const r = resumeSkipDetail(inserted, ['draft', 'polish']);   // 上一轮没有 enrich
+  assert(r.skip.has('draft') && !r.skip.has('polish'), `polish 的上游变了，不能复用：${[...r.skip]}`);
+  assert(r.staleDownstream.includes('polish'), `要点名说清为什么重跑：${r.staleDownstream}`);
+
+  // 传递性：再挂一步在 polish 下游，也一起作废
+  const deeper = {
+    levels: [['draft'], ['enrich'], ['polish'], ['pack']],
+    nodes: new Map<string, { step: { depends_on?: string[] } }>([
+      ...inserted.nodes,
+      ['pack', { step: { depends_on: ['polish'] } }],
+    ]),
+  };
+  const r2 = resumeSkipDetail(deeper, ['draft', 'polish', 'pack']);
+  assert(!r2.skip.has('pack') && r2.staleDownstream.includes('pack'), `传递作废：${[...r2.skip]}`);
+
+  // 上一轮按 condition 跳过的上游不算"会重跑"——否则短剧流水线里常年为假的配音会让 film 每次重合成
+  const cond = {
+    levels: [['a'], ['vo'], ['film']],
+    nodes: new Map<string, { step: { depends_on?: string[] } }>([
+      ['a', { step: {} }],
+      ['vo', { step: { depends_on: ['a'] } }],
+      ['film', { step: { depends_on: ['a', 'vo'] } }],
+    ]),
+  };
+  assert(resumeSkipDetail(cond, ['a', 'film'], undefined, ['vo']).skip.has('film'), '条件为假的上游不作废下游');
+  assert(!resumeSkipDetail(cond, ['a', 'film']).skip.has('film'), '没说它是被条件跳过的，就照旧保守作废');
+});
+
 await test('改过 id / 删掉的步骤不算进"跳过"，并单独点名', async () => {
   // 真机：把 polish 改名成 polish_v2 再 resume，明明只复用了 1 步，却报"跳过已完成步骤: 2 个"。
   // 留着这些名字不会出错（执行器按 id 查，查不到就是没跳过），但数字是虚的——
```

---

### Incident Patch 9: `f240609d` (2026-09-24)
**Commit Message**: fix: resume 时"跳过已完成步骤: N 个"不再虚报，并点名已消失的步骤 (#155)

真机：把第二步的 id 从 polish 改成 polish_v2 再 --resume，明明只复用了 1 步
（档案里的 polish 在新工作流里根本不存在），却报"跳过已完成步骤: 2 个"。

留着那些名字不会出错——执行器按 id 查，查不到就是没跳过——但数字是虚的，
而这个数字正是用户判断"我那几条按秒计费的视频步骤到底复用了没有"的依据。

- computeResumeSkipIds 把结果限制在当前 DAG 里真实存在的 step；
- 新增 vanishedStepIds()，resume 时若档案里有当前工作流已没有的已完成步骤，
  单独点名一行（改了 id 或删了步骤，这些不会被复用）——不说的话用户只看到
  "跳过 N 个"比预期少，以为引擎抽风。

test/resume.ts 加 1 条（4 个断言），变异验证过。

**File**: `src/index.ts` (modified, +9/-2)
```diff
@@ -93,7 +93,7 @@ import { summarizeMediaSpend } from './media/preflight.js';
 import { createConnector } from './connectors/factory.js';
 import { describePendingVideoTasks } from './connectors/video.js';
 import { loadAgent } from './agents/loader.js';
-import { saveResults, printStepResult, printStepRunning, clearRunningLine, printSummary, loadPreviousContext, getCompletedStepIds, findLatestOutput, computeResumeSkipIds, loadStepOutput } from './output/reporter.js';
+import { saveResults, printStepResult, printStepRunning, clearRunningLine, printSummary, loadPreviousContext, getCompletedStepIds, findLatestOutput, computeResumeSkipIds, vanishedStepIds, loadStepOutput } from './output/reporter.js';
 import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
 import { resolve, dirname, join } from 'node:path';
 import { fileURLToPath } from 'node:url';
@@ -306,7 +306,8 @@ export async function run(
       }
     }
 
-    skipStepIds = computeResumeSkipIds(dag, getCompletedStepIds(resumeDir), fromStep);
+    const completedBefore = getCompletedStepIds(resumeDir);
+    skipStepIds = computeResumeSkipIds(dag, completedBefore, fromStep);
     // 被跳过的图片/视频步骤的产物在上一轮的 assets/ 里：读进登记表，下游图生视频 / concat 才拿得到字节
     preloadProducedMedia(join(resumeDir, 'assets'), media);
 
@@ -322,6 +323,12 @@ export async function run(
     if (!options?.quiet) {
       console.log(`  恢复自: ${resumeDir}`);
       console.log(`  跳过已完成步骤: ${skipStepIds.size} 个`);
+      // 改过 step id / 删了步骤后再 resume：那些名字在新工作流里已经没有对应物，复用不了。
+      // 不说的话用户只会看到"跳过 N 个"比预期少，以为是引擎抽风。
+      const vanished = vanishedStepIds(dag, completedBefore);
+      if (vanished.length > 0) {
+        console.log(`  上次运行里有 ${vanished.length} 个步骤在当前工作流里已不存在（改了 id 或删掉了）：${vanished.join(', ')} —— 这些不会被复用`);
+      }
       if (fromStep) console.log(`  从步骤 [${fromStep}] 开始重新执行`);
     }
   }
```

**File**: `src/output/reporter.ts` (modified, +14/-1)
```diff
@@ -416,11 +416,24 @@ export function computeResumeSkipIds(
     // 没有依赖信息（旧调用方只给 levels）时退回层级语义
     for (let li = fromLevel; li < dag.levels.length; li++) for (const id of dag.levels[li]) rerun.add(id);
   }
+  // 只留**当前工作流里还存在**的 step：用户改了 id / 删了步骤后，上一次档案里那些名字已经没用了。
+  // 留着不会出错（执行器按 id 查，查不到就是没跳过），但会让"跳过已完成步骤: N 个"虚报——
+  // 真机：把 polish 改名成 polish_v2 再 resume，明明只复用了 1 步，却说跳过 2 个。
+  const known = dag.nodes ? new Set(dag.nodes.keys()) : new Set(dag.levels.flat());
   const skip = new Set<string>();
-  for (const id of completed) if (!rerun.has(id)) skip.add(id);
+  for (const id of completed) if (!rerun.has(id) && known.has(id)) skip.add(id);
   return skip;
 }
 
+/** 上一次档案里已完成、但当前工作流里已经不存在的 step（改名 / 删掉了）——它们不会被复用。 */
+export function vanishedStepIds(
+  dag: { levels: string[][]; nodes?: Map<string, unknown> },
+  completedIds: string[],
+): string[] {
+  const known = dag.nodes ? new Set(dag.nodes.keys()) : new Set(dag.levels.flat());
+  return completedIds.filter((id) => !known.has(id));
+}
+
 /**
  * 查找最近一次运行的输出目录
  */
```

**File**: `test/resume.ts` (modified, +14/-0)
```diff
@@ -93,6 +93,20 @@ await test('短剧流水线 --from shot3：shot1/shot2/定妆图/剧本全部复
   assert(!skip.has('shot3') && !skip.has('film') && !skip.has('pack'), 'shot3 与下游 film/pack 要重跑');
 });
 
+await test('改过 id / 删掉的步骤不算进"跳过"，并单独点名', async () => {
+  // 真机：把 polish 改名成 polish_v2 再 resume，明明只复用了 1 步，却报"跳过已完成步骤: 2 个"。
+  // 留着这些名字不会出错（执行器按 id 查，查不到就是没跳过），但数字是虚的——
+  // 而这个数字正是用户判断"我那几条付费视频步骤到底复用了没有"的依据。
+  const { vanishedStepIds } = await import('../src/output/reporter.js');
+  const doneWithOldIds = [...allDone, 'polish', 'old_step'];
+  const skip = computeResumeSkipIds(dag, doneWithOldIds, 'final_summary');
+  assert(!skip.has('polish') && !skip.has('old_step'), `当前工作流里没有的 step 不该算进跳过：${[...skip]}`);
+  assert(skip.size === 3, `只数真的能复用的 3 个，实际 ${skip.size}`);
+  const gone = vanishedStepIds(dag, doneWithOldIds);
+  assert(gone.length === 2 && gone.includes('polish') && gone.includes('old_step'), `点名消失的那些：${gone}`);
+  assert(vanishedStepIds(dag, allDone).length === 0, '没改过 id 时不报');
+});
+
 await test('--from analyze：什么都不跳（全部重跑）', () => {
   const skip = computeResumeSkipIds(dag, allDone, 'analyze');
   assert(skip.size === 0, `应跳 0 个，实际: ${[...skip]}`);
```

---

### Incident Patch 10: `40992fff` (2026-09-24)
**Commit Message**: fix: 输入名被某步的 output 遮蔽时，不在它下游的引用要报出来 (#154)

真机实测：同一份 YAML、同样的输入，concurrency: 3 时那步拿到的是输入值，
concurrency: 1 时拿到的是上一步的产出——{{变量}} 的含义随并发设置改变，而校验器
一声不吭。

校验器本来就有"变量必须来自 inputs 或本步上游"这条，但 `if (inputDef) continue`
排在最前：一个名字只要在 inputs 里出现过，后面是不是又被某个 step 当 output 就不查了。
补上：只有在产出者的下游（或本步就是产出者）时含义才确定，否则报错并给两条改法
（换 output 名 / 加 depends_on）。

不误伤既有写法：
- 下游引用（含义确定＝那一步的产出）不报；
- 产出者自己 task 里引用同名变量＝引用输入（渲染在它跑之前）不报；
- 循环里两步共用一个 output 名（codex-cc-loop 的惯用法）走的是另一条既有规则，
  对带 loop 的所有者本来就放行——新规则也不碰它。

全部 70 个内置模板重新校验，零新增失败。test/validate-strict.ts 加 5 条，变异验证过。

**File**: `src/core/parser.ts` (modified, +17/-1)
```diff
@@ -545,7 +545,23 @@ export function validateWorkflow(workflow: WorkflowDefinition, agentsDir?: strin
       if (varName === '_loop_iteration') continue;
       if (reportedVars.has(varName)) continue;
       const inputDef = workflow.inputs?.find(i => i.name === varName);
-      if (inputDef) continue;
+      if (inputDef) {
+        // 输入名被某个 step 的 output 遮蔽时，这个 {{变量}} 到底是"输入"还是"那一步的产出"，
+        // 取决于两者谁先跑完——而那由 concurrency 与层内顺序决定。真机实测：同一份 YAML，
+        // concurrency: 3 时拿到输入值，concurrency: 1 时拿到上一步的产出。静默换含义，不能放过。
+        // 在产出者下游（或本步就是产出者）时含义是确定的，不报。
+        const shadowing = workflow.steps.filter(
+          (p) => p.output === varName && p.id !== step.id && !upStepIds.has(p.id),
+        );
+        if (shadowing.length === 0) continue;
+        errors.push(
+          `step "${step.id}" 里的 {{${varName}}} 含义不确定：它既是输入，又被 step ${shadowing.map((p) => `"${p.id}"`).join(' / ')} 用作 output——`
+          + `本步不在它下游，拿到的是输入值还是它的产出取决于并发与执行顺序（改一下 concurrency 结果就变）。`
+          + `改法二选一：给那个 step 换个 output 名，或把它加进本步的 depends_on`,
+        );
+        reportedVars.add(varName);
+        continue;
+      }
       if (upstreamOutputs.has(varName)) continue;
       // 不在 inputs 也不在上游 outputs：错误
       // 区分两种错误信息，方便 autoFix / repairWithLLM 处理
```

**File**: `test/validate-strict.ts` (modified, +32/-0)
```diff
@@ -36,6 +36,38 @@ console.log('\n─── depends_on 写成单个字符串 ───');
   assert(validateWorkflow(w).length === 0, '校验通过');
 }
 
+console.log('\n─── 输入名被 step 的 output 遮蔽：不在下游就是不确定 ───');
+{
+  // 真机实测过：同一份 YAML，concurrency: 3 时那步拿到输入值，concurrency: 1 时拿到上一步的产出。
+  // 含义随并发设置变化，且没有任何提示——这正是"静默换含义"。
+  const shadow = `${head}inputs:\n  - name: topic\n    required: true\nsteps:\n` +
+    `  - id: a\n    role: "r/x"\n    task: "写 {{topic}}"\n    output: topic\n` +
+    `  - id: c\n    role: "r/x"\n    task: "三写 {{topic}}"\n    output: out_c\n`;
+  const errs = validateWorkflow(parseWorkflow(wf(shadow))).join('\n');
+  assert(/含义不确定/.test(errs) && /"c"/.test(errs) && /"a"/.test(errs), `点名是哪两步（实际：${errs.slice(0, 140)}）`);
+  assert(/depends_on/.test(errs) && /output 名/.test(errs), '给出两条改法');
+
+  // 在产出者下游时含义是确定的（就是它的产出），不该报
+  const downstream = `${head}inputs:\n  - name: topic\n    required: true\nsteps:\n` +
+    `  - id: a\n    role: "r/x"\n    task: "写 {{topic}}"\n    output: topic\n` +
+    `  - id: b\n    role: "r/x"\n    task: "再写 {{topic}}"\n    depends_on: [a]\n    output: out_b\n`;
+  assert(validateWorkflow(parseWorkflow(wf(downstream))).length === 0, '下游引用不报（含义确定）');
+
+  // 产出者自己的 task 里引用同名变量＝引用输入（渲染发生在它跑之前），也不该报
+  const selfRef = `${head}inputs:\n  - name: topic\n    required: true\nsteps:\n` +
+    `  - id: a\n    role: "r/x"\n    task: "写 {{topic}}"\n    output: topic\n`;
+  assert(validateWorkflow(parseWorkflow(wf(selfRef))).length === 0, '产出者自己引用不报');
+
+  // 循环模板里"两步共用一个 output 名"是有意的惯用法（codex-cc-loop 就这么写：fix 带 loop 跳回 review），
+  // 既有的"多个 step 同时产出"规则对带 loop 的所有者本来就放行——别让新规则在这儿误伤。
+  const loopIdiom = `${head}steps:\n` +
+    `  - id: impl\n    role: "r/x"\n    task: "实现"\n    output: code\n` +
+    `  - id: review\n    role: "r/x"\n    task: "审 {{code}}"\n    depends_on: [impl]\n    output: review_result\n` +
+    `  - id: fix\n    role: "r/x"\n    task: "改 {{review_result}} 原码 {{code}}"\n    depends_on: [review]\n    output: code\n` +
+    `    loop:\n      back_to: review\n      max_iterations: 3\n      exit_condition: "{{review_result}} contains APPROVED"\n`;
+  assert(validateWorkflow(parseWorkflow(wf(loopIdiom))).length === 0, `循环里复用 output 名不误伤（实际：${validateWorkflow(parseWorkflow(wf(loopIdiom))).join(' / ').slice(0, 160)}）`);
+}
+
 console.log('\n─── deliverables 写成输出变量名时点破（与 depends_on 同一种手误）───');
 {
   const w = parseWorkflow(wf(`${head}deliverables: [a_out]\nsteps:\n${step('a')}`));
```

#### Recent Merged Pull Requests:
- **PR #188** (2026-09-29): docs(handoff): #183/#184 已修，交接文档的待办与断言数跟上 (@jnMetaCode)
- **PR #187** (2026-09-29): fix(retry): 包月套餐额度用尽的 429 不再当成限流重试 (#184) (@jnMetaCode)
- **PR #186** (2026-09-28): docs(handoff): 交接文档更到 2026-09-29 (@jnMetaCode)
- **PR #185** (2026-09-28): fix(verify): 裁判把「满足此条」写进 failed 时不再当成未满足 (#183) (@jnMetaCode)
- **PR #182** (2026-09-25): docs(contributing): 把「交付物与验收怎么写」写成配方 (@jnMetaCode)
- **PR #181** (2026-09-25): docs(changelog): 模板那条更到 21 个，并写清筛选标准 (@jnMetaCode)
- **PR #180** (2026-09-25): feat(workflows): PR 评审 / 竞品分析 / 面试题库三个模板补 deliverables + acceptance (@jnMetaCode)
- **PR #179** (2026-09-25): docs(changelog): 模板那条更到 18 个（并入 #178） (@jnMetaCode)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

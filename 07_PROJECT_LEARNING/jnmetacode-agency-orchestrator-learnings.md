# Forensic Learning Record (Deep Inspection): jnMetaCode/agency-orchestrator

> **Canonical Artifact**: `07_PROJECT_LEARNING/jnmetacode-agency-orchestrator-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jnMetaCode/agency-orchestrator](https://github.com/jnMetaCode/agency-orchestrator))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:09:20.639Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jnMetaCode/agency-orchestrator`
- **Description**: 🚀 One sentence → your one-person company of AI experts → complete deliverable in minutes. 276 CN + 184 EN + 5 more languages (ko/ru/pt-BR/id/ar) · zero-code YAML · auto-verified acceptance · Web Studio / Desktop / Docker · 15 LLM providers (11 key-free). 一句话组建你的「一人公司」AI 专家团队，几分钟交付完整方案；验收自动核验，网页 / 桌面 / Docker 全渠道。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2327 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/core/assert.ts`
```
/**
 * 机械断言 —— 不过模型、不过网络的产出结构校验。
 *
 * 为什么要有它(acceptance 已经在做验收了,为什么还要一个):
 *   `acceptance` 是**让模型去判**产出满不满足标准(见 core/verify.ts)。它擅长判内容质量,
 *   但有一整类问题它系统性抓不到——**"本该有几个"**。
 *   真实事故:一次要模型产出 6 个课节文件,它只产出了 5 个。剩下 5 个格式完好、内容也好,
 *   于是模型验收员说"满足标准",编译也通过(少一个文件的产物语法完全合法),
 *   整节内容就这么带着绿灯上线了。**同一故障在两个项目上各撞一次,两次都亮绿灯。**
 *   根因不神秘:验收员看不见"应该有 6 个"这个事实,它只看得见眼前这 5 个。
 *
 *   所以分工是:**模型审内容,脚本审结构**。数数这种事不该交给概率性的东西。
 *   这个模块只做后一半:纯函数,同样输入永远同样结论,不花 token,不会因为网络抖动"核验不可用"。
 *
 * 用法(工作流 YAML 的步骤上):
 *   - id: write
 *     task: 把这 6 节草稿转成课节文件
 *     assert:
 *       emits_files: 6                 # 产出里必须恰好有 6 个文件块(与 --materialize 同一套解析)
 *       min_bytes: 2000                # 产出最小字节数,防截断
 *       max_bytes: 660                 # 产出最大字节数,防超长(视频提示词超字数会被厂商直接拒)
 *       contains: ["## 验收清单"]       # 必须出现的字面串
 *       matches: { "^## ": 6 }         # 正则(多行模式)必须命中 6 次
 *
 * 已实测的链路(2026-08-14,走画布真实接口 POST/GET /api/workflows/graph):
 *   带 assert 的图 → 落盘 YAML → 读回画布,四个字段原样往返(含 Studio 界面不暴露的 matches);
 *   配错的 assert(空对象/字段名写错/非法正则/数字写成字符串)在**保存这一步**就被 400 挡下,
 *   响应的 errors[] 点名字段与可用取值;不写 assert 的老工作流照常保存,无回归。
 */
import { parseFileBlocks } from '../cli/materialize.js';
import { renderTemplate } from './template.js';
import type { StepAssert } from '../types.js';

export interface AssertResult {
  pass: boolean;
  failures: string[];   // 人话的未通过项,直接可进报错信息与返工提示
}

/** 字数:非空白字符数,按码点计(中文一字一计,emoji 一个算一个)。这是写作类模板说的"字数"。 */
export function countChars(text: string): number {
  return Array.from(text.replace(/\s+/g, '')).length;
}

/** min_chars / max_chars 的字符串写法:`<数字>` 或 `<数字> * <系数>`,数字位可以是 {{变量}}。 */
const CHAR_SPEC_RE = /^\s*(\d+(?:\.\d+)?)\s*(?:\*\s*(\d+(?:\.\d+)?))?\s*$/;

/** 解析期校验:非负整数,或把 {{变量}} 占位成 1 后能过 CHAR_SPEC_RE 的字符串。 */
export function isValidCharSpec(v: unknown): boolean {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0;
  if (typeof v !== 'string') return false;
  return CHAR_SPEC_RE.test(v.replace(/\{\{\s*\w+\s*\}\}/g, '1'));
}

/**
 * 运行期把 min_chars / max_chars 的字符串写法算成数字(其余字段原样)。
 * 变量为空或渲染后算不成数字 → 该条**跳过并告警**,不算失败:可选输入没填是合法状态,
 * 不该让一整步红掉;但也绝不静默——告警里带原文和渲染结果,一眼能看出是哪个变量空了。
 */
export function resolveAssert(
  spec: StepAssert,
  context: Map<string, string>,
  warn: (msg: string) => void = () => {},
): StepAssert {
  const out: StepAssert = { ...spec };
  for (const k of ['min_chars', 'max_chars'] as const) {
    const v = spec[k];
    if (typeof v !== 'string') continue;
    const rendered = renderTemplate(v, context);
    const m = rendered.match(CHAR_SPEC_RE);
    if (!m) {
      warn(`assert.${k} 「${v}」渲染后是「${rendered.trim()}」，算不成数字（引用的变量为空？），本条跳过`);
      out[k] = undefined;
      continue;
    }
    out[k] = Math.round(parseFloat(m[1]) * (m[2] ? parseFloat(m[2]) : 1));
  }
  // contains 里的 {{变量}} 同样要渲染：不渲染就是拿字面量 "{{title}}" 去产出里找，**必然找不到**——
  // 而 assert 不过是硬失败（定向返工一轮后步骤红），用户完全看不出是断言自己写错了。
  // 渲染后为空（引用的变量没填）→ 该条跳过并告警，而不是留一个空串（空串永远"包含"，等于白写）。
  if (spec.contains?.length) {
    const kept: string[] = [];
    for (const item of spec.contains) {
      if (!item.includes('{{')) { kept.push(item); continue; }
      const rendered = renderTemplate(item, context).trim();
      if (!rendered) { warn(`assert.contains 「${item}」渲染后是空的（引用的变量为空？），本条跳过`); continue; }
      kept.push(rendered);
    }
    out.contains = kept;
  }
  return out;
}

/** 把 matches 的键编译成正则。默认多行(^ $ 按行),这样 "^## " 才是常识里的意思。 */
function toRegExp(pattern: string): RegExp {
  // 支持 /.../flags 写法;否则按裸模式处理,默认加 g+m
  const m = pattern.match(/^\/(.*)\/([gimsuy]*)$/);
  if (m) {
    const flags = m[2].includes('g') ? m[2] : m[2] + 'g';
    return new RegExp(m[1], flags);
  }
  return new RegExp(pattern, 'gm');
}

function countMatches(text: string, pattern: string): number {
  const re = toRegExp(pattern);
  let n = 0;
  // 用 matchAll 而不是 text.match(re).length:后者在 re 没有 g 时只返回第一个匹配,
  // 会把"命中 6 次"误报成 1 次——一个自己就会说谎的计数器,比没有检查更糟。
  for (const _ of text.matchAll(re)) n++;
  return n;
}

/**
 * 校验一段产出是否满足机械断言。纯函数:不读盘、不联网、不调模型。
 * 断言项之间是「与」的关系,全部满足才算通过;不通过时把每一条都列出来,
 * 不要只报第一条——修的人需要一次看全,而不是修一条跑一次。
 */
export function checkAssert(content: string, spec: StepAssert): AssertResult {
  const failures: string[] = [];

  if (spec.emits_files !== undefined) {
    const got = parseFileBlocks(content).length;
    if (got !== spec.emits_files) {
      failures.push(`产出的文件块数量不对:要求 ${spec.emits_files} 个,实际 ${got} 个`);
    }
  }

  if (spec.min_bytes !== undefined) {
    const got = Buffer.byteLength(content, 'utf8');
    if (got < spec.min_bytes) {
      failures.push(`产出太短:要求至少 ${spec.min_bytes} 字节,实际 ${got} 字节(疑似截断)`);
    }
  }

  // max_bytes 的来由:视频提示词写太长,厂商在提交这一步就直接拒(见姊妹仓 cases.zh.md
  // 「提示词超字数,提交不了」)。这种事在花钱之前就该拦下,而且是数出来的、不必过模型。
  if (spec.max_bytes !== undefined) {
    const got = Buffer.byteLength(content, 'utf8');
    if (got > spec.max_bytes) {
      failures.push(`产出太长:要求至多 ${spec.max_bytes} 字节,实际 ${got} 字节(需要压缩,删冗余形容词、合并短句)`);
    }
  }

  // 字数按非空白字符数,是写作类模板要的口径(bytes 对中文是 3 倍,用户按"字"想、按"字节"配总会配错)。
  // 字符串写法(带变量)必须先经 resolveAssert 算成数字;这里遇到字符串说明调用方漏了那一步,直接跳过不猜。
  if (typeof spec.min_chars === 'number') {
    const got = countChars(content);
    if (got < spec.min_chars) {
      failures.push(`产出太短:要求至少 ${spec.min_chars} 字(非空白字符),实际 ${got} 字(疑似截断或写短了)`);
    }
  }
  if (typeof spec.max_chars === 'number') {
    const got = countChars(content);
    if (got > spec.max_chars) {
      failures.push(`产出太长:要求至多 ${spec.max_chars} 字(非空白字符),实际 ${got} 字(需要压缩)`);
    }
  }

  for (const s of spec.contains ?? []) {
    if (!content.includes(s)) failures.push(`产出里找不到必须出现的内容:「${s}」`);
  }

  for (const [pattern, want] of Object.entries(spec.matches ?? {})) {
    const got = countMatches(content, pattern);
    if (got !== want) failures.push(`模式 /${pattern}/ 命中次数不对:要求 ${want} 次,实际 ${got} 次`);
  }

  return { pass: failures.length === 0, failures };
}

/** 断言未过时,拼一段定向返工提示。只说缺什么,不重述任务——原任务还在上文里。 */
export function buildAssertReworkBlock(failures: string[]): string {
  return [
    '',
    '',
    '---',
    '上一版产出**结构上不合格**,以下是逐条机械核对的结果(不是主观意见,是数出来的):',
    ...failures.map((f) => `- ${f}`),
    '',
    '请重新给出完整产出,补齐缺失的部分。注意:',
    '- 不要只补差的那部分,要给出**完整的一份**,否则下游拿不到完整产物;',
    '- 不要减少已经正确的内容;',
    '- 数量类要求请自己先数一遍再交。',
  ].join('\n');
}

```

### Core Architecture Module: `src/core/compare.ts`
```
/**
 * 多智能体 vs 单次基线 —— 对比 / 盲评核心库。
 *
 * 回答 AO 的核心假设："多角色 DAG 协作的产出，是否真的比用户自己写一句 prompt 更好。"
 * 由 eval CLI（eval/run-eval.ts）、编程 API（src/index.ts）、`ao run --compare`、网页 Studio 共用，
 * 避免逻辑分叉。方法学见 EVAL_FINDINGS.md：双向盲评取平均以抵消 LLM 评审的位置偏置。
 */
import { createConnector } from '../connectors/factory.js';
import { deliverableSteps, type LLMConfig, type WorkflowResult } from '../types.js';

// 截断上限要足够大：太小会把更长/更完整产出的尾部（常含结论）切掉，系统性惩罚长产出，
// 而"完整性"正是要评的维度。强 judge 可吃数万字。
const JUDGE_TRUNC = 20000;
const trunc = (s: string) => (s.length > JUDGE_TRUNC ? s.slice(0, JUDGE_TRUNC) + '\n…[截断]' : s);

/** 最终成品：工作流声明的 deliverables（多个则拼接），没声明就是最后一个"已完成且有产出"的步骤。 */
export function finalOutput(result: WorkflowResult): string {
  return deliverableSteps(result).map((s) => String(s.output)).join('\n\n---\n\n');
}

/** 把工作流目标+输入合成"单次直接要成品"的基线 prompt（模拟用户不用 ao 的写法）。 */
export function buildBaselineTask(
  name: string,
  description: string | undefined,
  inputs: Record<string, string>,
): string {
  const inputLines = Object.entries(inputs)
    .map(([k, v]) => `- ${k}：${v}`)
    .join('\n');
  return [
    `任务目标：${description || name}`,
    inputLines ? `\n输入信息：\n${inputLines}` : '',
    '\n请直接产出最终成品（完整、可直接交付），不要输出过程、大纲或说明文字。',
  ].join('');
}

/** 跑单次基线：一个"强助手"system + 合成任务，返回产出文本（模拟用户一句话直接要成品）。 */
export async function runBaseline(genLlm: LLMConfig, baselineTask: string): Promise<string> {
  const conn = createConnector(genLlm);
  const res = await conn.chat('你是能力很强的助手，直接产出高质量的最终成品。', baselineTask, genLlm);
  return res.content;
}

/**
 * 把对比的三段产物排成一份可存档的 markdown。
 *
 * 为什么必须存档：单次基线是**真跑一次**、盲评是再跑两次，钱都花了，但此前它们只出现在终端里
 * ——窗口一滚就没了，run 目录里连一个字都没有（`ao report` 也无从渲染）。更别扭的是终端还写着
 * "完整产出见 ao-output"，而那里根本没有。引擎别处（媒体暂存、取消后仍存档）遵守的都是同一条：
 * 付过钱的产物不能丢。
 */
export function formatCompareArchive(r: {
  baselineTask: string;
  baselineOutput: string;
  multiOutput: string;
  verdict: CompareVerdict | null;
}): string {
  const L: string[] = ['# 多智能体 vs 单次基线', ''];
  if (r.verdict) {
    const v = r.verdict;
    const mark = v.winner === 'multi-agent' ? '多智能体胜' : v.winner === 'baseline' ? '单次基线胜' : '打平';
    L.push(`- 评审：多智能体 **${v.multiScore.toFixed(1)}** / 单次基线 **${v.baseScore.toFixed(1)}** → **${mark}**（${v.consistent ? '双向一致，高可信' : '双向矛盾，低可信：疑位置偏置'}）`);
    for (const reason of v.reasons) if (reason) L.push(`  - ${reason}`);
  } else {
    L.push('- 评审：无结论（judge 未返回有效 JSON，或对比被取消）。两份产出仍可人工对比。');
  }
  L.push(`- 产出长度：多智能体 ${r.multiOutput.length} 字 / 单次基线 ${r.baselineOutput.length} 字`, '');
  L.push('## 单次基线用的提示词', '', '```text', r.baselineTask, '```', '');
  L.push('## 单次基线产出（完整）', '', r.baselineOutput || '（空）', '');
  L.push('## 多智能体产出（完整，另见 steps/ 与 summary.md）', '', r.multiOutput || '（空）', '');
  return L.join('\n');
}

export interface JudgeScore {
  scoreA: number;
  scoreB: number;
  reason: string;
}

/** 从 judge 回复里抽出 JSON 分数（judge 偶尔会包代码块/加解释，宽松匹配第一个 {...}）。 */
export function parseJudge(raw: string): JudgeScore | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const a = Number(j.scoreA);
    const b = Number(j.scoreB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return { scoreA: a, scoreB: b, reason: String(j.reason || '').slice(0, 200) };
  } catch {
    return null;
  }
}

/** 单向评审一次：A、B 两份产出对同一任务打分。解析失败重试一次。
 *  acceptance 非空时作为首要评分锚点（工作流声明的验收标准，两份产出用同一把尺）。 */
export async function judgeOnce(
  judgeLlm: LLMConfig,
  taskDesc: string,
  outA: string,
  outB: string,
  acceptance?: string,
): Promise<JudgeScore | null> {
  const conn = createConnector(judgeLlm);
  const prompt = [
    '你是严格、客观的内容质量评审。下面是针对同一任务的两份产出，请对比。',
    `任务：${taskDesc}`,
    ...(acceptance ? ['', `交付验收标准（首要评判依据，逐条核对两份产出是否满足）：\n${acceptance}`] : []),
    '', '【产出 A】', trunc(outA), '', '【产出 B】', trunc(outB), '',
    acceptance
      ? '评判维度：验收标准满足度优先，其次完整性、具体性、可用性、是否直接可交付。'
      : '评判维度：完整性、具体性、可用性、是否直接可交付。',
    '只输出一行 JSON，不要任何额外文字：{"scoreA": 1-10, "scoreB": 1-10, "reason": "一句话理由"}',
  ].join('\n');
  for (let attempt = 0; attempt < 2; attempt++) {
    const sys = attempt === 0
      ? '你是严格客观的评审，只输出 JSON。'
      : '你必须只输出一行纯 JSON，绝对不要代码块标记、前言或任何解释文字。';
    const res = await conn.chat(sys, prompt, { ...judgeLlm, max_tokens: 400 });
    const parsed = parseJudge(res.content);
    if (parsed) return parsed;
  }
  return null;
}

export interface CompareVerdict {
  multiScore: number;
  baseScore: number;
  winner: 'multi-agent' | 'baseline' | 'tie';
  /** 双向盲评是否同向；false 多半是 judge 位置偏置 → 该结论可信度低。 */
  consistent: boolean;
  reasons: string[];
}

/**
 * 把双向两次评审聚合成结论（纯函数，便于单测）。
 * j1 = (A=多智能体, B=基线)，j2 = (A=基线, B=多智能体)。取平均抵消位置偏置。
 */
export function aggregateVerdict(j1: JudgeScore, j2: JudgeScore): CompareVerdict {
  const multiScore = (j1.scoreA + j2.scoreB) / 2;
  const baseScore = (j1.scoreB + j2.scoreA) / 2;
  const p1 = j1.scoreA - j1.scoreB;
  const p2 = j2.scoreB - j2.scoreA;
  // 双向同向即可信：都判多智能体更好 / 都判基线更好 / 双向都判平(p1==p2==0,真平局也是一致)。
  // 仅当两向矛盾(一向说多、一向说基线)才算低可信(位置偏置)。
  const consistent = Math.sign(p1) === Math.sign(p2);
  const winner = multiScore > baseScore ? 'multi-agent' : baseScore > multiScore ? 'baseline' : 'tie';
  return { multiScore, baseScore, winner, consistent, reasons: [j1.reason, j2.reason].filter(Boolean) };
}

/**
 * 双向盲评对比：对 (多智能体, 基线) 正反各评一次取平均。
 * judge 解析失败返回 null（调用方决定跳过/重试）。
 */
export async function compareOutputs(
  judgeLlm: LLMConfig,
  taskDesc: string,
  multiOutput: string,
  baselineOutput: string,
  acceptance?: string,
): Promise<CompareVerdict | null> {
  const j1 = await judgeOnce(judgeLlm, taskDesc, multiOutput, baselineOutput, acceptance); // A=multi, B=base
  const j2 = await judgeOnce(judgeLlm, taskDesc, baselineOutput, multiOutput, acceptance); // A=base,  B=multi
  if (!j1 || !j2) return null;
  return aggregateVerdict(j1, j2);
}

```

### Core Architecture Module: `src/core/condition.ts`
```
/**
 * 条件表达式求值
 *
 * 支持的语法:
 *   {{变量}} contains 关键词
 *   {{变量}} equals 关键词
 *   关键词可用引号包裹: {{var}} contains "bug fix"
 *
 * 大小写不敏感，自动 trim
 */
import { renderTemplate } from './template.js';

// Matches known operators (contains/equals) anchored to whole words
const KNOWN_OP_REGEX = /^(.+?)\s+(contains|equals)\s+(.+)$/is;
// Matches any word as operator to detect unsupported operators
const ANY_OP_REGEX = /^.+\s+(\w+)\s+.+$/is;

export function evaluateCondition(
  condition: string,
  context: Map<string, string>
): boolean {
  // 在「模板」(替换变量之前)上解析运算符：运算符位置由作者在 YAML 里写定，
  // 不能用替换后的字符串来切分——否则变量值(LLM 产出)里恰好出现 contains/equals
  // 会把条件从错误的位置切开，导致分支/循环退出被翻转。
  const match = condition.match(KNOWN_OP_REGEX);
  if (!match) {
    // Check if the format looks valid but with an unsupported operator
    const opMatch = condition.match(ANY_OP_REGEX);
    if (opMatch) {
      throw new Error(`不支持的条件运算符: "${opMatch[1]}"。支持 contains 和 equals`);
    }
    throw new Error(`条件格式错误: "${condition}"。支持的格式: <text> contains <keyword> 或 <text> equals <keyword>`);
  }

  // 左操作数以取反词结尾 = 作者写了 `{{x}} not contains y` 这类否定式。左侧是懒匹配，`not` 会被
  // 吞进左操作数里，于是整条**当成 contains 求值、结果正好相反**，而且一声不吭。
  // 真机后果：`condition: "{{qa}} not contains 失败"` 在 QA 报失败时**照样跑**那一步——
  // 如果它是 type: video，就是按秒计费的钱。没有取反语法就当场说清楚，别猜。
  if (/(^|\s)(not|!|非|不)\s*$/i.test(match[1])) {
    throw new Error(
      `条件不支持取反写法（"${condition.trim().slice(0, 60)}"）：只有 contains / equals。`
      + `请把分支反过来写——例如把 "{{x}} not contains A" 改成给另一条分支加 "{{x}} contains A"。`,
    );
  }

  // 仅对两侧操作数分别替换变量；换行替空格避免多行 LLM 输出干扰
  const left = renderTemplate(match[1], context).trim().replace(/\n/g, ' ').toLowerCase();
  const operator = match[2].toLowerCase();
  // 去掉引号包裹
  const right = renderTemplate(match[3], context).trim().replace(/^["']|["']$/g, '').toLowerCase();

  // 右操作数渲染后为空（引用了一个没填的可选输入）：`"".includes("")` 恒真，于是"有条件的分支"
  // 每次都跑——短片流水线里那就是每条片子都出、都计费。空关键词按"没匹配上"算。
  if (!right) {
    return operator === 'equals' ? !left : false;
  }

  switch (operator) {
    case 'contains':
      return left.includes(right);
    case 'equals':
      return left === right;
    default:
      throw new Error(`不支持的条件运算符: "${operator}"。支持 contains 和 equals`);
  }
}

```

### Core Architecture Module: `src/core/dag.ts`
```
/**
 * DAG 构建和拓扑排序
 */
import type { WorkflowDefinition, DAGNode } from '../types.js';
import { t } from '../i18n.js';

export interface DAG {
  nodes: Map<string, DAGNode>;
  /** 拓扑排序后的执行层级，每层内的节点可并行 */
  levels: string[][];
}

/**
 * 从 WorkflowDefinition 构建 DAG
 */
export function buildDAG(workflow: WorkflowDefinition): DAG {
  const nodes = new Map<string, DAGNode>();

  // 创建所有节点
  for (const step of workflow.steps) {
    nodes.set(step.id, {
      step,
      dependencies: step.depends_on || [],
      dependents: [],
      status: 'pending',
    });
  }

  // 构建反向依赖（谁依赖我）
  for (const [id, node] of nodes) {
    for (const dep of node.dependencies) {
      const depNode = nodes.get(dep);
      if (!depNode) {
        throw new Error(`step "${id}" 依赖不存在的 step: "${dep}"`);
      }
      depNode.dependents.push(id);
    }
  }

  // 拓扑排序 — 按层分组（同层可并行）
  const levels = topologicalLevels(nodes);

  // 验证 loop.back_to 指向祖先节点
  for (const step of workflow.steps) {
    if (step.loop?.back_to) {
      const backToLevel = levels.findIndex(l => l.includes(step.loop!.back_to));
      const currentLevel = levels.findIndex(l => l.includes(step.id));
      if (backToLevel < 0 || currentLevel < 0) {
        throw new Error(`loop 验证失败: "${step.id}" 或 "${step.loop.back_to}" 不在 DAG 中`);
      }
      if (backToLevel >= currentLevel) {
        throw new Error(`step "${step.id}" 的 loop.back_to "${step.loop.back_to}" 必须在其之前的层级（当前层 ${currentLevel + 1}，back_to 层 ${backToLevel + 1}）`);
      }
      // 光在更早的层级还不够，必须真的是**依赖链上的祖先**。回跳只重置「back_to 的后代 ∩ 循环节点的祖先」，
      // back_to 是不相干的旁支时这个交集是空的：什么都不重跑，循环空转到 max_iterations，最后报一句
      // 「循环达上限」——用户看到的是"审了 3 轮都没过"，实际一轮都没改。
      const ancestors = new Set<string>();
      const stack = [...(nodes.get(step.id)?.dependencies ?? [])];
      while (stack.length) {
        const cur = stack.pop()!;
        if (ancestors.has(cur)) continue;
        ancestors.add(cur);
        stack.push(...(nodes.get(cur)?.dependencies ?? []));
      }
      if (!ancestors.has(step.loop.back_to)) {
        throw new Error(`step "${step.id}" 的 loop.back_to "${step.loop.back_to}" 不在它的依赖链上——回跳只会重跑两者之间的步骤，所以 back_to 必须是 "${step.id}" 直接或间接 depends_on 的步骤`);
      }
    }
  }

  return { nodes, levels };
}

/**
 * 拓扑排序，返回执行层级
 * 每个层级内的节点互不依赖，可并行执行
 *
 * 例如:
 *   A → B → D
 *   A → C → D
 * 结果: [[A], [B, C], [D]]
 */
function topologicalLevels(nodes: Map<string, DAGNode>): string[][] {
  const inDegree = new Map<string, number>();
  for (const [id, node] of nodes) {
    inDegree.set(id, node.dependencies.length);
  }

  const levels: string[][] = [];
  const remaining = new Set(nodes.keys());

  while (remaining.size > 0) {
    // 找出当前入度为 0 的节点
    const currentLevel: string[] = [];
    for (const id of remaining) {
      if (inDegree.get(id) === 0) {
        currentLevel.push(id);
      }
    }

    if (currentLevel.length === 0) {
      throw new Error('工作流存在循环依赖，无法拓扑排序');
    }

    // 移除本层节点，更新入度
    for (const id of currentLevel) {
      remaining.delete(id);
      const node = nodes.get(id)!;
      for (const dep of node.dependents) {
        inDegree.set(dep, inDegree.get(dep)! - 1);
      }
    }

    levels.push(currentLevel);
  }

  return levels;
}

/**
 * 格式化 DAG 为可读文本（用于 `ao plan` 命令）
 */
export function formatDAG(dag: DAG): string {
  const lines: string[] = [`${t('dag.title')}\n`];

  for (let i = 0; i < dag.levels.length; i++) {
    const level = dag.levels[i];
    const parallel = level.length > 1;

    for (let j = 0; j < level.length; j++) {
      const node = dag.nodes.get(level[j])!;
      const step = node.step;
      const prefix = parallel ? (j === 0 ? '┌' : j === level.length - 1 ? '└' : '├') : '→';
      const tag = parallel ? t('dag.parallel') : '';

      lines.push(`  ${t('dag.layer', { n: i + 1 })} ${prefix} [${step.id}] ${step.role || step.type}${tag}`);

      if (node.dependencies.length > 0) {
        lines.push(`         ${t('dag.deps')}: ${node.dependencies.join(', ')}`);
      }
      if (step.condition) {
        lines.push(`         ${t('dag.condition')}: ${step.condition}`);
      }
      if (step.loop) {
        lines.push(`         ${t('dag.loop', { to: step.loop.back_to, n: step.loop.max_iterations })}`);
      }
    }
    if (i < dag.levels.length - 1) lines.push('  │');
  }

  return lines.join('\n');
}

```

### Core Architecture Module: `src/core/executor.ts`
```
/**
 * DAG 执行引擎 — 核心调度器
 */
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  WorkflowDefinition,
  DAGNode,
  LLMConnector,
  LLMConfig,
  WorkflowResult,
  StepResult,
} from '../types.js';
import type { DAG } from './dag.js';
import { renderTemplate } from './template.js';
import { evaluateCondition } from './condition.js';
import { loadAgent } from '../agents/loader.js';
import { collectSkillNames, injectSkills } from '../skills/loader.js';
import { createConnector } from '../connectors/factory.js';
import { isQuotaExhausted } from '../connectors/endpoint.js';
import { generateImage } from '../connectors/image.js';
import { generateVideo , type VideoStepOptions } from '../connectors/video.js';
import { concatVideos } from '../media/concat.js';
import { generateSpeech, type TtsStepOptions } from '../connectors/tts.js';
import { verifyAcceptance, buildReworkBlock, formatFailedItems, verifyImageAcceptance, verifyVisualAcceptance, buildImageReworkPrompt, canSeeImages } from './verify.js';
import { extractFrames, jpegDataUri } from '../media/frames.js';
import { FfmpegMissingError } from '../media/concat.js';
import { checkAssert, resolveAssert, buildAssertReworkBlock } from './assert.js';
import { startSleepWatch, type SleepWatch } from '../utils/sleep-watch.js';
import { createInterface } from 'node:readline';

export interface ExecutorOptions {
  connector: LLMConnector;
  agentsDir: string;
  llmConfig: LLMConfig;
  concurrency: number;
  inputs: Map<string, string>;
  /** 每步完成的回调 */
  onStepComplete?: (node: DAGNode) => void;
  onStepStart?: (node: DAGNode) => void;
  /** 一批并行步骤开始前的回调 */
  onBatchStart?: (nodes: DAGNode[]) => void;
  /** 一批并行步骤全部完成后的回调（按顺序） */
  onBatchComplete?: (nodes: DAGNode[]) => void;
  /** resume 模式: 跳过这些步骤（使用 context 中已有的输出） */
  skipStepIds?: Set<string>;
  /**
   * 对话式返工：对指定步骤注入"用户修改意见 + 上一版产出"，让该专家在原稿基础上
   * 按意见修改重做（而非从零重写）。配合 --resume --from <stepId> 使用。
   */
  feedback?: { stepId: string; text: string; previousOutput?: string };
  /**
   * acceptance 自动核验：写了 acceptance 的步骤产出后自动逐条核对，未过则带着
   * 未满足条目自动返工一轮（复用对话式返工范式）。验收不过是质量信号而非执行错误，
   * 步骤不会因此 failed。产品入口（run()）按 CLI flag > YAML 顶层 verify > 默认开
   * 计算后传入；库级直调 executeDAG 不传 = 不核验（向后兼容）。step.verify: false 单步关闭。
   */
  verify?: boolean;
  /** 验收员模型覆盖（YAML 顶层 verify_llm / CLI --verify-provider）。缺省 = 文本供应商；步骤级 llm 优先级更高 */
  verifyLlm?: Partial<LLMConfig>;
  /**
   * 调用方提供的步骤结果收集数组：executor 增量写入（每步完成即可见），
   * 供 SIGTERM/SIGINT 中断时把已完成步骤落盘成 metadata（否则中断的 run 无痕）。
   */
  stepResultsSink?: StepResult[];
  /**
   * resume 复用步骤在上一次运行档案里的展示字段（agentName/acceptance/verification 等），
   * 由 run() 从旧 metadata 读出传入——续跑产生的新档案才不丢被复用步骤的验收记录。
   */
  restoredStepMeta?: Map<string, Partial<StepResult>>;
  /** 本次运行的媒体登记表（run() 建好传入，带暂存目录）；不传则用一份不落盘的，仍然是每次运行独立 */
  media?: MediaRegistry;
}

/**
 * 一次运行的媒体产物登记表（文件名 → 字节）：图生视频引用上游图片、concat 引用上游视频 / 配音时从这里取——
 * 产物要到运行结束才进 `<run>/assets/`，运行中磁盘上还没有。
 *
 * **每次运行一份**，不是模块级全局。以前是全局 Map + run() 开头清空：同一进程里两条运行并发
 * （MCP 的并行工具调用）时，后开始的那条一清空，先开始的那条的 concat 就报「找不到视频」——片子已经付过钱了。
 *
 * `spoolDir`：设了就**产物一生成立刻写盘**。付费产物此前只活在内存里，直到整条运行结束才落盘；
 * 中途进程被杀（OOM / SIGKILL / 断电 / 合盖）就全没了，而按秒计费的视频是要不回来的。
 */
export interface MediaRegistry {
  images: Map<string, Buffer>;
  videos: Map<string, Buffer>;
  audios: Map<string, Buffer>;
  spoolDir?: string;
}

export function createMediaRegistry(spoolDir?: string): MediaRegistry {
  return { images: new Map(), videos: new Map(), audios: new Map(), spoolDir };
}

function registerMedia(reg: MediaRegistry, kind: 'images' | 'videos' | 'audios', filename: string, bytes: Buffer): void {
  reg[kind].set(filename, bytes);
  if (!reg.spoolDir) return;
  try {
    mkdirSync(reg.spoolDir, { recursive: true });
    writeFileSync(join(reg.spoolDir, filename), bytes);
  } catch (err) {
    // 暂存失败不能反过来搞挂已经成功（且已付费）的步骤；但要说出来——此时这份产物只在内存里
    process.stderr.write(`  ⚠️  ${filename} 暂存到 ${reg.spoolDir} 失败（${err instanceof Error ? err.message.slice(0, 80) : err}），产物暂时只在内存里\n`);
  }
}

/** --resume：上一轮的产物已经在磁盘上（assets/），被跳过的图片/视频步骤不会再产出，先把它们读进登记表 */
export function preloadProducedMedia(assetsDir: string, reg: MediaRegistry): number {
  if (!existsSync(assetsDir)) return 0;
  let n = 0;
  for (const f of readdirSync(assetsDir)) {
    const p = join(assetsDir, f);
    if (/\.(png|jpe?g|webp|gif)$/i.test(f)) { reg.images.set(f, readFileSync(p)); n++; }
    else if (/\.(mp4|mov|webm)$/i.test(f)) { reg.videos.set(f, readFileSync(p)); n++; }
    else if (/\.(mp3|wav|aac|opus|flac|m4a)$/i.test(f)) { reg.audios.set(f, readFileSync(p)); n++; }
  }
  return n;
}

export async function executeDAG(dag: DAG, options: ExecutorOptions): Promise<WorkflowResult> {
  const {
    connector,
    agentsDir,
    llmConfig,
    concurrency,
    inputs,
    onStepComplete,
    onStepStart,
  } = options;
  const media = options.media ?? createMediaRegistry();

  // 变量上下文：inputs + 每步的 output
  const context = new Map(inputs);
  const startTime = Date.now();
  const stepResults: StepResult[] = options.stepResultsSink ?? [];

  const isCLI = llmConfig.provider.endsWith('-cli') || llmConfig.provider === 'claude-code';
  const isLocal = llmConfig.provider === 'ollama';
  const timeout = llmConfig.timeout || (isCLI ? 600_000 : isLocal ? 600_000 : 120_000);
  const maxRetry = llmConfig.retry ?? 5;

  // CLI provider 强制串行：共享同一账户额度，并发会触发限速反而更慢
  // parser 已校验；这里再兜一层给直接调 executeDAG 的库用户——步长 < 1 是死循环
  const effectiveConcurrency = isCLI ? 1 : Math.max(1, Math.floor(Number(concurrency)) || 1);

  const loopIterations = new Map<string, number>();
  // 每步真实执行次数与累计 token：循环回跳会重跑 back_to 到循环节点之间的所有步骤，
  // 结果按 id 覆盖——只记最后一轮会把前几轮的次数和 token 丢掉（成本少报、账本少计）
  const execCounts = new Map<string, number>();
  const tokenTotals = new Map<string, { input: number; output: number }>();
  const withPriorTokens = (id: string, current?: { input: number; output: number }) => {
    const prev = tokenTotals.get(id) || { input: 0, output: 0 };
    return { input: prev.input + (current?.input || 0), output: prev.output + (current?.output || 0) };
  };
  const hasLoops = Array.from(dag.nodes.values()).some(n => n.step.loop);
  if (hasLoops) {
    context.set('_loop_iteration', '1');
  }

  let levelIndex = 0;
  while (levelIndex < dag.levels.length) {
    // 同层节点可并行，但受 concurrency 限制
    const { onBatchStart, onBatchComplete } = options;
    const allTasks = dag.levels[levelIndex].map(id => dag.nodes.get(id)!);

    // 过滤掉已被标记为 skipped 的节点 和 resume 跳过的节点
    const tasks = allTasks.filter(node => {
      if (node.status === 'skipped') {
        node.endTime = Date.now();
        node.startTime = node.endTime;
        const runs = execCounts.get(node.step.id) || 0;
        upsertStepResult(stepResults, {
          id: node.step.id,
          role: node.step.role,
          status: 'skipped',
          duration: 0,
          // 本轮跳过，但前几轮真实花掉的 token 仍要算
          tokens: tokenTotals.get(node.step.id) || { input: 0, output: 0 },
          iterations: runs > 1 ? runs : undefined,
        });
        onStepComplete?.(node);
        return false;
      }
      // resume 模式：跳过已有输出的步骤
      if (options.skipStepIds?.has(node.step.id)) {
        node.status = 'completed';
        node.result = node.step.output ? context.get(node.step.output) : undefined;
        node.startTime = Date.now();
        node.endTime = node.startTime;
        // 上一次运行档案里的展示字段（角色名/验收标准/核验结果）随复用一起带回，
        // 否则续跑的新档案里这些步骤全变成裸 id、验收记录凭空消失
        const prev = options.restoredStepMeta?.get(node.step.id);
        upsertStepResult(stepResults, {
          id: node.step.id,
          role: node.step.role,
          agentName: prev?.agentName,
          agentEmoji: prev?.agentEmoji,
          acceptance: prev?.acceptance,
          verification: prev?.verification,
          assertion: prev?.assertion,
          // 媒体产物只带文件名：run() 落盘后据此把上一轮的 png/mp4 复制进新目录，markdown 链接才不断
          imageAsset: prev?.imageAsset,
          videoAsset: prev?.videoAsset,
          audioAsset: prev?.audioAsset,
          status: 'completed',
          output: node.result,
          output_var: node.step.output,
          duration: 0,
          tokens: { input: 0, output: 0 },
          reused: true,
        });
        onStepComplete?.(node);
        return false;
      }
      // 循环回跳重跑时：已完成且不属于循环体的节点保持原样，不重复执行
      // （首次正向执行时该层节点都是 pending，故此分支不影响正常流程）
      if (node.status === 'completed') return false;
      return true;
    });

    // 按 effectiveConcurrency 分批执行
    for (let i = 0; i < tasks.length; i += effectiveConcurrency) {
      const batch = tasks.slice(i, i + effectiveConcurrency);

      // 预加载角色名和 emoji，让 onBatchStart 能显示（步骤级配置优先）
      for (const node of batch) {
        // any_completed 合并步可能在部分依赖失败/跳过时仍然执行（设计意图）。
        // 那些依赖的 output 变量从未写入 context，若 task 模板引用它们会抛"模板变量未定义"
        // 而让合并步反而失败。这里为失败/跳过的依赖补空串，使合并步基于已完成分支正常渲染。
        fillSkippedDepOutputs(dag, node, context);
        if (!node.agentName && node.step.role) {
          try {
            const agentInfo = loadAgent(agentsDir, node.step.role);
            node.agentName = node.step.name || agentInfo.name;
            node.agentEmoji = node.step.emoji || agentInfo.emoji;
          } catch { /* executeStep 里会再加载并报错 */ }
        }
      }

      onBatchStart?.(batch);

      const results = await Promise.allSettled(
        batch.map(node => executeStep(node, {
          connector,
          agentsDir,
          llmConfig,
          context,
          timeout,
          maxRetry,
          onStepStart,
          feedback: options.feedback,
          verify: options.verify,
          verifyLlm: options.verifyLlm,
          media,
        }).then(value => {
          // 中断兜底：settle 即写入 sink 一份最小记录，不等整批屏障——否则并行批次里
          // 先完成的步骤在 SIGTERM 时会被当作"未完成"丢弃（产出和 token 白花）。
          // 批次收尾的完整 upsert 会按 id 覆盖这份记录。
          if (options.stepResultsSink && node.status !== 'skipped') {
            upsertStepResult(stepResults, {
              id: nod
```

### Core Architecture Module: `src/core/llm-override.ts`
```
/**
 * 命令行 / Studio 覆盖 YAML 里的 llm 配置（--provider / --model / --timeout …）。
 *
 * 超时的规则单独拎出来，因为以前是「只要 --provider 换成 CLI 类，就把超时写死成 600s」：
 * YAML 里显式写的长超时被悄悄压回 600s。真机（2026-09-15）：「一人公司·方案到代码」写代码一步要生成
 * 约 40 分钟，模板写了 timeout: 2700000，用 --provider claude-code 跑时仍在 600s、900s 连续超时重试，
 * 每次都从头生成、白花额度。
 *
 * 现在：
 * - 显式给了 timeout（--timeout）→ 用它（命令行优先）
 * - 换成 CLI 类 provider、没给 timeout → 600s 是**下限**：YAML 写得更长就用 YAML 的；YAML 写 0（不限时）保持 0
 *   （下限的来由不变：YAML 给 API 调的短超时，套到 CLI 上会过早杀掉）
 * - 其他情况 → 原样合并，与以前一致
 */
import type { LLMConfig } from '../types.js';

export const CLI_TIMEOUT_FLOOR_MS = 600_000;

export function isCliProvider(provider: string | undefined): boolean {
  return !!provider && (provider.endsWith('-cli') || provider === 'claude-code');
}

/**
 * Studio 通过子进程环境传递不适合出现在 argv 的高级参数。JSON 只接受普通对象；
 * 值不合法时忽略，让 YAML / 引擎默认继续生效，而不是把一次运行直接搞挂。
 */
export function llmOverrideFromEnv(env: NodeJS.ProcessEnv = process.env): Partial<LLMConfig> {
  const out: Partial<LLMConfig> = {};
  const maxRaw = env.AO_LLM_MAX_TOKENS?.trim();
  if (maxRaw) {
    const max = Number(maxRaw);
    if (Number.isInteger(max) && max >= 1 && max <= 1_000_000) out.max_tokens = max;
  }
  const paramsRaw = env.AO_LLM_PARAMS_JSON?.trim();
  if (paramsRaw) {
    try {
      const params = JSON.parse(paramsRaw);
      if (params && typeof params === 'object' && !Array.isArray(params)) out.params = params;
    } catch { /* 忽略坏值，保留 YAML / 默认配置 */ }
  }
  return out;
}

export function mergeLlmOverride(base: LLMConfig, override: Partial<LLMConfig>): LLMConfig {
  const yamlTimeout = base.timeout;
  const merged = Object.assign(base, override);
  if (override.timeout === undefined && override.provider && isCliProvider(override.provider)) {
    merged.timeout = yamlTimeout === 0
      ? 0
      : Math.max(yamlTimeout ?? 0, CLI_TIMEOUT_FLOOR_MS);
  }
  return merged;
}

```

### Core Architecture Module: `src/core/parser.ts`
```
/**
 * YAML → WorkflowDefinition 解析器
 */
import { readFileSync, existsSync } from 'node:fs';
import { CLI_PROVIDER_IDS } from '../providers/detect.js';
import { API_PROVIDER_MAP, ANTHROPIC_PROVIDER_MAP, VIDEO_PROVIDERS } from '../connectors/api-providers.js';
import { extractVariables } from './template.js';
import { evaluateCondition } from './condition.js';
import { isValidCharSpec } from './assert.js';
import yaml from 'js-yaml';
import type { WorkflowDefinition, StepDefinition } from '../types.js';
import { t } from '../i18n.js';
import { loadAgent, suggestRoles } from '../agents/loader.js';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 合法字段表，取自随包的 schemas/workflow.schema.json——它同时是编辑器补全的来源，改一处两边都变。
 * 读不到（极端情况：包被裁剪）就退化成不查未知键，而不是把所有工作流都判坏。
 */
function loadSchemaKeys(): { top: Set<string>; step: Set<string> } {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const candidate of [resolvePath(here, '../../schemas/workflow.schema.json'), resolvePath(here, '../schemas/workflow.schema.json')]) {
      if (!existsSync(candidate)) continue;
      const schema = JSON.parse(readFileSync(candidate, 'utf-8')) as { properties?: Record<string, unknown> & { steps?: { items?: { properties?: Record<string, unknown> } } } };
      return {
        top: new Set(Object.keys(schema.properties ?? {})),
        step: new Set(Object.keys(schema.properties?.steps?.items?.properties ?? {})),
      };
    }
  } catch { /* 退化为不查 */ }
  return { top: new Set(), step: new Set() };
}
const { top: KNOWN_TOP_KEYS, step: KNOWN_STEP_KEYS } = loadSchemaKeys();

/** 拼错的键找最接近的合法键（编辑距离 ≤ 3 才给），给「你是不是想写」用 */
export function closestKey(key: string, known: string[]): string | undefined {
  const dist = (a: string, b: string): number => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return dp[a.length][b.length];
  };
  let best: { k: string; d: number } | undefined;
  for (const k of known) {
    const d = dist(key.toLowerCase(), k.toLowerCase());
    if (d <= 3 && (!best || d < best.d)) best = { k, d };
  }
  return best?.k;
}

/**
 * 解析失败几乎全是"用户的 YAML 写得不对"，不是服务端故障 —— 打上标记，让调用方
 * （尤其 web/server.js）能回 4xx 而不是 500。500 会让用户以为是我们坏了，跑去重启引擎。
 */
function fail(msg: string): never {
  throw Object.assign(new Error(msg), { userError: true });
}

export function parseWorkflow(
  filePath: string,
  opts?: {
    /**
     * 调用方已经准备好的 llm 配置（CLI 的 --provider/--model、Studio 里选中的供应商）。
     * YAML 里没写 `llm:` 时用它兜底 —— 用户明明在命令行/界面上指定了 provider，
     * 却还被一句"工作流缺少 llm 配置"挡住，是说不通的。仍然要求最终有 provider。
     */
    llmFrom?: Partial<import('../types.js').LLMConfig>;
  },
): WorkflowDefinition {
  const raw = readFileSync(filePath, 'utf-8');
  const doc = yaml.load(raw) as Record<string, unknown>;

  // 基本校验
  if (!doc || typeof doc !== 'object') {
    fail(t('parse.bad_yaml', { path: filePath }));
  }
  if (!doc.name || typeof doc.name !== 'string') {
    fail(t('parse.missing_name'));
  }
  if (!doc.steps || !Array.isArray(doc.steps) || doc.steps.length === 0) {
    fail(t('parse.missing_steps'));
  }
  // YAML 没写 llm 时，用调用方给的（--provider / Studio 选中的供应商）兜底
  if ((!doc.llm || typeof doc.llm !== 'object') && opts?.llmFrom?.provider) {
    doc.llm = { ...opts.llmFrom };
  }
  if (!doc.llm || typeof doc.llm !== 'object') {
    fail(t('parse.missing_llm'));
  }

  const llm = doc.llm as Record<string, unknown>;
  if (!llm.provider) {
    fail(t('parse.missing_provider'));
  }
  // CLI providers（claude-code / antigravity-cli / gemini-cli / copilot-cli / codex-cli / openclaw-cli / hermes-cli / codebuddy-cli / cline-cli / opencode-cli / dsh-cli）和 ollama 不需要 model
  const cliProviders = [...CLI_PROVIDER_IDS, 'ollama'];
  // 纯出图/出视频的工作流也不需要顶层 model：那一步的模型写在 image.model / video.model 里，
  // 顶层 llm.model 只是文本步骤要用的。逼用户随手填一个用不上的文本模型，等于教他写谎话
  // （与 agents_dir 那条同一个道理：一个角色都不用的工作流不该被"找不到角色库"挡在门外）。
  const mediaOnly = Array.isArray(doc.steps) && doc.steps.length > 0
    && (doc.steps as Array<Record<string, unknown>>).every((s) => s?.type === 'image' || s?.type === 'video' || s?.type === 'concat' || s?.type === 'tts');
  if (!llm.model && !cliProviders.includes(llm.provider as string) && !mediaOnly) {
    fail(t('parse.missing_model'));
  }
  // 不认识的 provider 又没给 base_url：run 会报「暂不支持 provider」，validate / plan 却一路放行——
  // 连接器工厂的规则是「不在注册表里但有 base_url = 按 OpenAI 兼容端点处理」，这里同一条口径。
  // 纯媒体工作流的 provider 可以是视频供应商（有自己的注册表），不在此列。
  {
    const known = new Set<string>([...CLI_PROVIDER_IDS, 'ollama', 'claude', ...Object.keys(API_PROVIDER_MAP), ...Object.keys(ANTHROPIC_PROVIDER_MAP), ...VIDEO_PROVIDERS.map((v) => v.id)]);
    const pid = String(llm.provider ?? '');
    // 命令行 / Studio 用 --provider --base-url 覆盖时（llmFrom），YAML 里的 provider 会被换掉，不按 YAML 判
    const overridden = !!opts?.llmFrom?.provider;
    if (pid && !known.has(pid) && !llm.base_url && !mediaOnly && !overridden && !/\{\{/.test(pid)) {
      const guess = closestKey(pid, [...known]);
      fail(`不认识的 provider "${pid}"${guess ? `——你是不是想写 "${guess}"？` : ''}。自定义中转请配上 base_url（按 OpenAI 兼容端点处理）；内置供应商见 ao doctor`);
    }
  }
  // concurrency 是分批循环的步长：写成 0 会被下面的 `|| 2` 兜住，但负数 / 小数不会——
  // `i += -1` 永不结束，循环里不停 await 空批次，把事件循环饿死，Ctrl-C 都按不动。
  if (doc.concurrency !== undefined && !(Number.isInteger(doc.concurrency) && (doc.concurrency as number) >= 1)) {
    fail(`concurrency 必须是 ≥ 1 的整数（当前：${JSON.stringify(doc.concurrency)}）`);
  }

  // 校验每个 step
  const stepIds = new Set<string>();
  const steps = doc.steps as StepDefinition[];

  for (const step of steps) {
    if (!step.id) fail(t('parse.missing_step_id'));
    // step id 会被拼进文件路径（steps/<n>-<id>.md、assets/<id>.png）——带路径分隔符或 ".."
    // 的 id 此前要到落盘那一刻才炸（ENOENT / 写出目录），在解析期就说清楚。中文 id 不受影响。
    if (/[\\/:*?"<>|\x00-\x1f]/.test(step.id) || step.id.includes('..') || step.id.startsWith('.')) {
      fail(`step id "${step.id}" 含路径字符（/ \\ : * ? " < > | 或 ..）——id 会用作产物文件名，请改用字母数字、中文、-、_`);
    }
    if (stepIds.has(step.id)) fail(`step id 重复: ${step.id}`);
    stepIds.add(step.id);
    // depends_on 写成单个字符串（模型常这么写）：以前按字符串迭代，报出 8 条「依赖不存在的 step: "r" / "e" / "s"…」，
    // 任何修复阶段都无从下手。deliverables 早就接受单字符串，这里同样规整成数组。
    if (typeof (step as { depends_on?: unknown }).depends_on === 'string') {
      step.depends_on = [(step as unknown as { depends_on: string }).depends_on];
    }
    // 拼错的键（depend_on / outputs / acceptence…）此前被**静默忽略**：依赖没连上、验收没做，用户以为都生效了。
    // 键表取自随包的 JSON Schema（同一份给编辑器补全用），别在这里再抄一遍。
    for (const key of Object.keys(step)) {
      if (KNOWN_STEP_KEYS.size && !KNOWN_STEP_KEYS.has(key)) {
        const guess = closestKey(key, [...KNOWN_STEP_KEYS]);
        fail(`step "${step.id}" 有不认识的字段 "${key}"${guess ? `——你是不是想写 "${guess}"？` : ''}（拼错的字段会被静默忽略，所以这里直接报错）`);
      }
    }

    // approval / human_input 是无角色的人工节点，不需要 role / task；
    // image 是文生图节点：task 就是图片提示词，不需要 role
    const isHumanNode = step.type === 'approval' || step.type === 'human_input';
    const isImageNode = step.type === 'image';
    const isVideoNode = step.type === 'video';
    const isConcatNode = step.type === 'concat';
    const isTtsNode = step.type === 'tts';
    if (!isHumanNode && !isImageNode && !isVideoNode && !isConcatNode && !isTtsNode && !step.role) {
      fail(`step "${step.id}" 缺少 role`);
    }
    if (isConcatNode) {
      const ins = step.concat?.inputs;
      if (!Array.isArray(ins) || ins.length === 0 || !ins.every((x) => typeof x === 'string' && x.trim())) {
        fail(`step "${step.id}" 是 concat 步骤，必须写 concat: { inputs: ["{{shot1_mp4}}", "{{shot2_mp4}}", …] }（上游视频步骤的输出变量，按顺序合成）`);
      }
      if (step.acceptance || step.assert) fail(`step "${step.id}" 是 concat 步骤，暂不支持 acceptance / assert`);
      // 逐段对应的字段，数量对不上是配置错而不是"少配一段"：
      // 静默补齐会让第 2 段的旁白盖到第 3 段画面上，而这种错在成片里才看得出来。
      for (const k of ['voiceover', 'subtitles'] as const) {
        const arr = step.concat?.[k];
        if (arr === undefined) continue;
        if (!Array.isArray(arr) || !arr.every((x) => typeof x === 'string')) {
          fail(`step "${step.id}" 的 concat.${k} 必须是字符串数组（与 inputs 一一对应，这段不要就留空串）`);
        } else if (Array.isArray(ins) && arr.length !== ins.length) {
          fail(`step "${step.id}" 的 concat.${k} 有 ${arr.length} 条，但 inputs 有 ${ins.length} 段——必须一一对应`);
        }
      }
      for (const k of ['voice_volume', 'bgm_volume', 'clip_volume'] as const) {
        const v = step.concat?.[k];
        if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
          fail(`step "${step.id}" 的 concat.${k} 必须是非负数字`);
        }
      }
      if (step.concat?.bgm !== undefined && typeof step.concat.bgm !== 'string') {
        fail(`step "${step.id}" 的 concat.bgm 必须是字符串（本地音频路径，或上游 tts 步骤的输出变量）`);
      }
    }
    if (isTtsNode) {
      if (step.acceptance || step.assert) {
        // 同 image/video：核验的是文本产出，音频核验是另一回事，别装作跑了
        fail(`step "${step.id}" 是 tts 步骤，暂不支持 acceptance / assert（它们核验的是文本产出——要审文案就审上游写旁白的那一步）`);
      }
      if (!step.tts?.model || !step.tts?.voice) {
        fail(
          `step "${step.id}" 是 tts 步骤，必须写 tts: { model: "<语音模型>", voice: "<音色>" }\n` +
          `        音色 id 各家互不通用（OpenAI 是 alloy / nova / shimmer…，别家完全不同），引擎不猜——\n` +
          `        猜错要么被拒，要么拿回一条不是你要的嗓子的成品，钱照花`
        );
      }
    }
    if (!step.task && !isHumanNode && !isConcatNode) {
      fail(`step "${step.id}" 缺少 task${isImageNode ? '（image 步骤的 task 就是图片提示词）' : isVideoNode ? '（video 步骤的 task 就是视频提示词）' : isTtsNode ? '（tts 步骤的 task 就是要念的文案）' : ''}`);
    }
    if (isVideoNode && step.assert) {
      // 同 image：assert 数的是文本结构。acceptance 可以：抽帧交给能看图的文本模型审（默认只审不重出）
      fail(`step "${step.id}" 是 video 步骤，不支持 assert（它核验的是文本结构）；要审成片请用 acceptance（抽帧给支持 vision 的文本模型看，video.rework: true 才会
```

### Core Architecture Module: `src/core/template.ts`
```
/**
 * {{变量}} 模板引擎
 * 简单的字符串替换，不需要复杂的模板语法
 */

/**
 * 替换字符串中的 {{变量名}} 为上下文中的值
 */
export function renderTemplate(template: string, context: Map<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    const value = context.get(varName);
    if (value === undefined) {
      throw new Error(`模板变量未定义: {{${varName}}}`);
    }
    return value;
  });
}

/**
 * 提取模板中引用的所有变量名
 */
export function extractVariables(template: string): string[] {
  const vars: string[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!vars.includes(match[1])) {
      vars.push(match[1]);
    }
  }
  return vars;
}

```

### Core Architecture Module: `src/core/verify.ts`
```
/**
 * acceptance 自动核验 —— 把验收标准从"注入 prompt 的嘱咐"变成"跑完真的有人对着查"。
 *
 * 判定口径的由来（2026-08-28，用真实模型跑了 11 次采样测出来的）：
 * 原先写的是"宁严勿松：条目只做到一部分也算未满足"。对**可数**条目（必须有 6 个文件）这是对的，
 * 但对**质性**条目（"写明了色调和光源"）它等于放任评判者无限细分——产出已经写了"暖阳侧逆光"，
 * 它仍判"未明确光源类型（自然光/人工光）"。结果是 **11/11 全部触发返工、返工后仍多数判未过**：
 * 每跑一次白付一轮返工，而且验收长期显示未过——**用户会学会无视验收**，比没有验收更糟。
 * 所以现在把"宁严勿松"限定在标准**明确枚举**的东西上，并要求判未满足时**引用产出原话**
 * （举不出原话 = 它其实满足了），从根上掐掉"发明标准里没有的要求"。
 *
 * 步骤产出后，用同一个 connector 做一次轻量核验（逐条核对验收标准），未通过则把
 * "上一版产出 + 未满足条目"拼成返工块交回同一专家改一轮（复用 --feedback 的对话式
 * 返工范式，见 executor.buildFeedbackBlock）。核验器自身故障时返回 null，调用方跳过
 * 核验并告警——检查员宕机不能拖垮生产线（与 skill 缺失"警告不致命"同一哲学）。
 */
import type { LLMConfig, LLMConnector } from '../types.js';

// 与 compare.ts 的 JUDGE_TRUNC 一致：截太短会把长产出的尾部（常含结论）切掉，
// 系统性误判"未满足"，而完整性正是常见的验收条目。
const VERIFY_TRUNC = 20000;
const trunc = (s: string, n = VERIFY_TRUNC) => (s.length > n ? s.slice(0, n) + '\n…[截断]' : s);

// 核验调用的外层超时兜底（同 executor.withTimeout 的哲学：connector 内部超时失灵时
// 不能让一次"轻量核验"挂死整条产线）。核验不值得等太久，超时按核验不可用处理。
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  ms <= 0 ? promise : Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`核验超时 (${ms}ms)`)), ms).unref?.()),
  ]);

export interface VerifyVerdict {
  pass: boolean;
  /** 未满足的条目（criterion=哪条标准，why=一句话原因） */
  failed: { criterion: string; why: string }[];
}

/**
 * 这条 `failed` 条目的 why 是不是在说「它其实满足了」。
 *
 * 弱一点的裁判（实测 deepseek-chat，见 #183）不遵守「全部满足时 failed 必须是空数组」的约定，
 * 会把每一条连同「……满足此条」的理由一起塞进 failed。按字面执行的后果是：每个带 acceptance 的
 * 步骤都白返工一轮（token 翻倍）、档案里留下失真的「⚠️ N 条未满足」、库调用方拿到的 pass 不可信。
 *
 * 先看否定词再看肯定词——「不满足」「未达到」里都含着「满足」「达到」。
 */
export function whySaysMet(why: string): boolean {
  if (!why) return false;
  const denies = /不满足|未满足|不符合|不合|未达到|没达到|缺少|缺失|欠缺|未见|未出现|未(写|给|列|标|提供|包含)|没有(写|给|列|标|提供|包含|出现)|超(出|过)|不足|不够|仅|只有|部分|not met|missing|lack|fail|absent|incomplete|partial|exceed|short of/i.test(why);
  if (denies) return false;
  return /满足|符合|达到|已具备|具备|无问题|没有问题|合规|met\b|satisfie|complies|conforms|passes\b/i.test(why);
}

/** 从核验回复里抽出 JSON 结论（同 compare.parseJudge：宽松匹配第一个 {...}）。 */
export function parseVerify(raw: string): VerifyVerdict | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    // 能力弱一点的裁判会把布尔写成字符串（"pass": "true"）。以前一律判为"核验不可用"→ 两次都这样就
    // 静默跳过验收，而验收恰恰是给这类模型兜底的。只认这两个确定的写法，别的照旧当不可用。
    if (j.pass === 'true' || j.pass === 'false') j.pass = j.pass === 'true';
    if (typeof j.pass !== 'boolean') return null;
    const failed = Array.isArray(j.failed)
      ? j.failed
          .map((f: unknown) => {
            const o = (f ?? {}) as Record<string, unknown>;
            // 压平内嵌换行：criterion/why 的每个下游消费方（CLI ⚠️ 行、步骤文件头引用块、
            // SSE 逐行解析）都按单行处理，换行会逃出引用块/被误判为正文
            const flat = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
            return { criterion: flat(o.criterion), why: flat(o.why) };
          })
          .filter((f: { criterion: string; why: string }) => f.criterion || f.why)
      : [];
    // 裁判自己在 why 里写「满足此条」，却仍把这条塞进 failed（#183：deepseek-chat 当 judge 时
    // 稳定复现——四条 acceptance 全部满足，四条 why 全写"满足此条"，却整齐地列在 failed 里）。
    // 提示词里本来就有这条原则：「举不出原话就说明它其实满足了」。既然它连"不满足在哪"都说不出、
    // 反而自证满足，这条就不是真未满足——剔除，别拿它去返工，也别在档案里留假的 ⚠️。
    const real = failed.filter((f: { criterion: string; why: string }) => !whySaysMet(f.why));
    // pass=false 却给不出任何**真正**未满足的条目 → 无法指导返工，也没法向用户解释"哪里没过"，
    // 视为本次核验不可用（触发第二次尝试/跳过），别带着空清单去返工
    if (j.pass !== true && real.length === 0) return null;
    // 保守裁决：模型说 pass 但又列了未满足条目 → 以条目为准，算未通过
    return { pass: j.pass === true && real.length === 0, failed: real };
  } catch {
    return null;
  }
}

/**
 * 核验一份产出是否满足验收标准。返回 verdict=null 表示核验不可用
 * （网络错误 / 两次都解析失败），调用方应跳过核验而非判失败。
 * tokens 为核验本身消耗的用量（无论成败都如实上报，计入该步成本）。
 */
export async function verifyAcceptance(
  connector: LLMConnector,
  llm: LLMConfig,
  taskDesc: string,
  output: string,
  acceptance: string,
): Promise<{ verdict: VerifyVerdict | null; tokens: { input: number; output: number } }> {
  const zh = /[一-鿿]/.test(acceptance);
  const prompt = zh
    ? [
        '你是严格的交付验收员。逐条核对下面的产出是否满足验收标准。',
        '判定口径（很重要）：',
        '- **只按标准写了的字面要求判**。标准没写的细节不算缺失——不要发明标准里没有的更严要求。',
        '- 产出用不同措辞满足了同一条标准的意图，就算满足；不要求字句对上。',
        '- 标准里**明确枚举**的东西（数量、必须出现的段落/字段）只做到一部分算未满足。',
        '- 判"未满足"时，why 里必须**引用产出中的原话**说明它为什么不满足；举不出原话就说明它其实满足了。',
        `任务：${trunc(taskDesc, 2000)}`,
        '', '验收标准：', acceptance,
        '', '待验收产出：', trunc(output), '',
        '只输出一行 JSON，不要任何额外文字：{"pass": true/false, "failed": [{"criterion": "未满足的条目原文", "why": "一句话原因"}]}',
        '全部满足时 failed 必须是空数组 []。**满足的条目一条都不要放进 failed**——哪怕你想顺便说明它为什么满足。',
      ].join('\n')
    : [
        'You are a strict acceptance reviewer. Check the deliverable against EACH criterion.',
        'How to judge (important):',
        '- Judge ONLY what a criterion literally asks for. Details it never mentions are not gaps — do not invent stricter requirements.',
        '- Different wording that meets the criterion\'s intent counts as met; exact phrasing is not required.',
        '- For things a criterion explicitly ENUMERATES (counts, required sections/fields), partially met counts as NOT met.',
        '- When marking something unmet, `why` MUST quote the deliverable\'s own words showing why. If you cannot quote, it is met.',
        `Task: ${trunc(taskDesc, 2000)}`,
        '', 'Acceptance criteria:', acceptance,
        '', 'Deliverable under review:', trunc(output), '',
        'Output exactly one line of JSON, nothing else: {"pass": true/false, "failed": [{"criterion": "the unmet criterion", "why": "one-sentence reason"}]}',
        'If all criteria are met, failed MUST be an empty array []. **Never put a met criterion in `failed`** — not even to explain why it is met.',
      ].join('\n');

  const tokens = { input: 0, output: 0 };
  // 结论 JSON 要逐字回抄未满足条目原文——上限必须随验收标准长度伸缩，
  // 否则条目越多/越长（恰恰是最差的产出）越容易截断 JSON、核验静默失效。
  // 起步值按"推理模型会先烧思考 token"给（与看图验收同一口径）：deepseek-reasoner / o 系列
  // 先吐几百上千 token 思考，500 的预算常常全花在思考上、可见内容 0 字符 → 连接器报
  // "只返回了思考内容"、verdict=null，于是**每一步的验收都被静默跳过**。
  const maxTokens = Math.min(4000, 1500 + Math.ceil(acceptance.length * 1.2));
  // 两次尝试：第二次换更严厉的 system 逼纯 JSON（同 compare.judgeOnce 的成熟套路）
  for (let attempt = 0; attempt < 2; attempt++) {
    const sys = attempt === 0
      ? (zh ? '你是严格客观的验收员，只输出 JSON。' : 'You are a strict, objective reviewer. Output JSON only.')
      : (zh ? '你必须只输出一行纯 JSON，绝对不要代码块标记、前言或任何解释文字。'
            : 'You MUST output exactly one line of raw JSON. No code fences, no preamble, no explanation.');
    try {
      const res = await withTimeout(
        connector.chat(sys, prompt, { ...llm, max_tokens: maxTokens, temperature: 0 }),
        llm.timeout || 600_000,
      );
      tokens.input += res.usage.input_tokens;
      tokens.output += res.usage.output_tokens;
      const verdict = parseVerify(res.content);
      if (verdict) return { verdict, tokens };
    } catch {
      // 网络/超时等：核验不可用 → null，不再重试（生成主链路自有完整 retry，核验不值得等）
      return { verdict: null, tokens };
    }
  }
  return { verdict: null, tokens };
}

/** 把未满足条目格式化成人读字符串列表（StepVerification.failed / CLI·summary 展示共用一份）。 */
export function formatFailedItems(failed: { criterion: string; why: string }[]): string[] {
  return failed.map(f => {
    if (f.criterion && f.why) {
      const zh = /[一-鿿]/.test(f.criterion + f.why);
      return zh ? `${f.criterion}（${f.why}）` : `${f.criterion} (${f.why})`;
    }
    return f.criterion || f.why;
  });
}

/**
 * 构造"验收返工"追加块：结构同 buildFeedbackBlock（上一版产出 + 意见 → 原稿基础上改），
 * 措辞换成验收口吻——只补齐/修正未满足项，保留已达标部分。
 */
export function buildReworkBlock(
  failed: { criterion: string; why: string }[],
  previousOutput: string,
): string {
  const zh = /[一-鿿]/.test(failed.map(f => `${f.criterion}${f.why}`).join('') + previousOutput.slice(0, 200));
  const items = failed
    .map((f, i) => `${i + 1}. ${f.criterion || f.why}${f.criterion && f.why ? (zh ? `（${f.why}）` : ` (${f.why})`) : ''}`)
    .join('\n');
  if (zh) {
    return [
      '\n\n---\n',
      '以下是你上一版的产出，请在此基础上修改，不要从零重写：\n\n',
      previousOutput.trim(),
      '\n\n---\n',
      '验收核对发现以下条目未满足：\n\n',
      items,
      '\n\n请严格针对上述未满足项修改：保留已达标的部分，只补齐/修正未满足的地方，直接输出修改后的完整结果。',
    ].join('');
  }
  return [
    '\n\n---\n',
    'Below is your previous deliverable. Revise it in place — do NOT rewrite from scratch:\n\n',
    previousOutput.trim(),
    '\n\n---\n',
    'Acceptance review found the following criteria NOT met:\n\n',
    items,
    '\n\nRevise strictly against the unmet items above: keep what already passes, fix only what falls short, and output the complete revised result.',
  ].join('');
}

/**
 * 视觉验收：把**成品本身**（一张图，或一段视频抽出的几帧）交给能看图的文本模型逐条核对验收标准。
 *
 * 为什么不是"把图交给下游视觉步骤去审"：审完不合格得有人**重出**——那是执行器里媒体步骤
 * 自己的事（验收未过 → 带着未满足项重出 → 复核），下游步骤没法回头改上游。
 * 图片走 utils/vision.ts 的 data URI 协议进用户消息：支持 vision 的连接器
 * （openai-compatible / claude）会拆成多模态消息；不支持的（CLI 订阅类 / ollama）会把图剥掉——
 * 那样判出来的结论是对着「[图片输入已跳过]」这行字判的，等于瞎判，所以调用方必须先按
 * provider 挡掉（见 canSeeImages），这里只对能看图的连接器负责。
 *
 * 判定口径与 verifyAcceptance 同源：只按标准字面判、不发明更严要求；判未满足时 why 必须
 * 描述**画面里**实际看到的东西（描述不出来 = 其实满足了）。
 */
export async function verifyVisualAcceptance(
  connector: LLMConnector,
  llm: LLMConfig,
  genPrompt: string,
  imageDataUris: string[],
  acceptance: string,
  kind: 'image' | 'video' = 'image',
): Promise<{ verdict: VerifyVerdict | null; tokens: { input: number; output: number }; reason?: string }> {
  const zh = /[一-鿿]/.test(acceptance);
  const many = imageDataUris.length;
  const frames = imageDataUris.map((u, i) => (kind === 'video' ? (zh ? `第 ${i + 1}/${many} 帧：` : `Frame ${i + 1}/${many}: `) : '') + u).join('\n');
  const prompt = zh
    ? [
        kind === 'video'
          ? `你是严格的视觉交付验收员。下面是按给定提示词生成的一段视频按时间顺序抽出的 ${many} 帧（开头→结尾），请**看画面**逐条核对它是否满足验收标准。`
          : '你是严格的视觉交付验收员。下面这张图是按给定提示词生成的，请**看图**逐条核对它是否满足验收标准。',
        '判定口径（很重要）：',
        '- **只按标准写了的字面要求判**。标准没写的细节不算缺失——不要发
```

### Core Architecture Module: `src/utils/bin-lookup.ts`
```
/**
 * "这个 CLI 装在哪" —— 探测与真正 spawn **必须共用同一份答案**。
 *
 * 踩过的坑：有些 CLI 的官方安装位置默认不在 PATH 上（Antigravity 的 install.sh 装到
 * `~/.local/bin`，Windows 装到 `%LOCALAPPDATA%\\agy\\bin`）。当时只给"探测"加了这些目录，
 * 结果 doctor / Studio 说"已安装"、点下去却报"找不到 agy 命令，请先安装" —— 两边各说各话，
 * 是最难自证的一类失败。所以把这份知识抽到这里，两边都从这儿读。
 *
 * 只对**确认过安装位置**的命令加目录，不搞"把 ~/.local/bin 全局加进 PATH"那种大范围改动：
 * 那会悄悄改变其它 CLI 的解析结果，属于用一个新风险换一个小便利。
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

/** 二进制名 → 除 PATH 之外还应该查的目录（官方安装位置）。 */
const EXTRA_BIN_DIRS: Record<string, (env: NodeJS.ProcessEnv) => string[]> = {
  // Google Antigravity CLI：install.sh → ~/.local/bin；Windows install.ps1 → %LOCALAPPDATA%\agy\bin
  agy: (env) => [
    join(homedir(), '.local', 'bin'),
    ...(env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'agy', 'bin')] : []),
  ],
  // 腾讯 CodeBuddy CLI：npm 全局装的在 PATH 上；WorkBuddy 桌面版（macOS）把同一个 CLI 打包在
  // app 内部、不进 PATH（实测 WorkBuddy 5.1.7 / codebuddy 2.103.3）。Windows/Linux 的打包位置
  // 没有实证，不猜——那两端请 npm 全局安装。
  codebuddy: () => [
    '/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/bin',
    join(homedir(), 'Applications', 'WorkBuddy.app', 'Contents', 'Resources', 'app.asar.unpacked', 'cli', 'bin'),
  ],
};

/** 该命令有没有额外的已知安装目录（有的话，PATH 为空也值得再查一遍）。 */
export function hasExtraBinDirs(bin: string): boolean {
  return bin in EXTRA_BIN_DIRS;
}

/** 除 PATH 之外还要查的目录；未登记的命令返回空数组。 */
export function extraBinDirs(bin: string, env: NodeJS.ProcessEnv = process.env): string[] {
  return EXTRA_BIN_DIRS[bin]?.(env) ?? [];
}

```

### Core Architecture Module: `src/utils/claude-apply.ts`
```
/**
 * Claude Code 全局「安全切换」写入器 —— claude-repair 的反向镜像。
 *
 * 与 claude-repair 成对：
 *   - repair 删掉 env 里的中转键（切回官方登录，减法）
 *   - apply  写入 env 里的中转键（切到第三方中转，加法）
 *
 * 安全第一（对齐 claude-repair 的纪律）：
 *   1. 写之前总是先备份（`.ao-backup-<timestamp>` 后缀，不覆盖旧备份）
 *   2. merge 写：只覆盖/新增中转相关的几个键，保留用户 settings.json 里的其它内容
 *   3. settings.json 解析失败时绝不覆写（宁可报错，也不销毁可能有救的内容）
 *   4. 绝不触碰 ~/.claude/.credentials.json（官方 OAuth 令牌所在）
 *   5. 打「AO 管理」顶层标记 `_aoManagedProvider`，用来区分：
 *        「AO 主动切的」（healthy，可一键切回） vs 「别的工具搞坏的」（需急救）
 *      —— 标记在顶层、不在 env 里，不影响 Claude Code 运行。
 */
import { execFileSync } from 'node:child_process';
import { connect as netConnect } from 'node:net';
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, renameSync, chmodSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { repairClaudeConfig, type RepairResult, type ShellEnvOptions } from './claude-repair.js';

/** 顶层标记键：记录当前是 AO 切到了哪个 provider。不在 env 里，不影响 CLI 运行。 */
export const AO_MANAGED_KEY = '_aoManagedProvider';

/**
 * 顶层「指纹」键：记录 AO 写入时的 base_url。体检时拿它跟当前 env.ANTHROPIC_BASE_URL 比对——
 * 对不上就说明 env 被别的工具（cc-switch）或手改动过，AO 标记还在但已名不副实，此时不能再
 * 当"AO 切的"放行，必须走劫持红灯。只有 AO 自己写才知道这个值，外部工具无从伪造。
 */
export const AO_MANAGED_BASEURL_KEY = '_aoManagedBaseUrl';

function claudeDir(): string {
  // 与 claude-repair 一致，允许测试 / 自定义 profile 覆盖。
  return process.env.AO_CLAUDE_DIR || join(homedir(), '.claude');
}

function settingsPath(): string {
  return join(claudeDir(), 'settings.json');
}

function backupIfExists(path: string): string | null {
  if (!existsSync(path)) return null;
  // 同一毫秒内会连着备份两次（restoreClaudeToOfficial 先 repair 再 syncProxy），撞名就往后排，
  // 否则第二次的 copyFileSync 会把第一次的备份覆盖掉——而这些都是凭证的明文副本。
  let backupPath = `${path}.ao-backup-${Date.now()}`;
  for (let n = 2; existsSync(backupPath); n++) backupPath = `${path}.ao-backup-${Date.now()}-${n}`;
  copyFileSync(path, backupPath);
  try { chmodSync(backupPath, 0o600); } catch { /* 不支持权限位的文件系统 */ }
  pruneBackups(path);
  return backupPath;
}

/**
 * 只留最近 5 份备份。每次 apply / repair / restore / 同步代理都会留一份，而**没有任何地方清理**——
 * 在 Studio 里来回切几次供应商，~/.claude 下就躺着十几份带 token 的明文副本。
 */
function pruneBackups(path: string, keep = 5): void {
  try {
    const dir = dirname(path);
    const prefix = `${basename(path)}.ao-backup-`;
    const olds = readdirSync(dir)
      .filter((f) => f.startsWith(prefix))
      .sort();                                  // 名字里是毫秒时间戳，字典序即时间序
    for (const f of olds.slice(0, Math.max(0, olds.length - keep))) {
      try { unlinkSync(join(dir, f)); } catch { /* 删不掉就算了，不能让清理反过来搞挂写入 */ }
    }
  } catch { /* 目录读不了：不清理，但绝不影响主流程 */ }
}

/** 凭证文件：原子写 + 0600。直接 writeFileSync 是先截断——中途崩了就剩个半截的 settings.json，
 *  而那正是"救 Claude Code"的那个文件，坏了之后 repair 自己也修不动（只能让用户去翻备份）。 */
function writeSecretJson(path: string, obj: unknown): void {
  // 目录可能还不存在（机器上从没跑过 Claude Code）——原来的直写也会在这里 ENOENT，只是多数人
  // 的 ~/.claude 早就有了才没暴露
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.ao-tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  renameSync(tmp, path);
  try { chmodSync(path, 0o600); } catch { /* 不支持权限位的文件系统 */ }
}

/** 读 JSON；不存在返回空对象；解析失败抛错（调用方据此中止写入，绝不覆写坏文件）。 */
function readJsonOrThrow(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  try {
    const o = JSON.parse(readFileSync(path, 'utf-8'));
    return o && typeof o === 'object' ? o : {};
  } catch (err: any) {
    throw new Error(`settings.json 解析失败，为安全起见不写入：${path}（${err?.message || err}）`);
  }
}

export interface ClaudeApplyConfig {
  /** provider id，用于标记 + 状态读回 */
  providerId: string;
  baseUrl: string;
  apiKey: string;
  /** 默认 ANTHROPIC_AUTH_TOKEN；部分中转要求 ANTHROPIC_API_KEY */
  apiKeyField?: 'ANTHROPIC_AUTH_TOKEN' | 'ANTHROPIC_API_KEY';
  model?: string;
  sonnetModel?: string;
  opusModel?: string;
  haikuModel?: string;
}

export interface ClaudeApplyResult {
  path: string;
  /** 改动前的备份路径；原文件不存在则为 null */
  backup: string | null;
  /** 实际写入 env 的键名 */
  writtenKeys: string[];
}

/**
 * 把中转 provider 安全写入 ~/.claude/settings.json（全局，任意终端的 claude 都会读到）。
 */
export function applyClaudeProvider(cfg: ClaudeApplyConfig): ClaudeApplyResult {
  if (!cfg.providerId) throw new Error('providerId 不能为空');
  if (!cfg.baseUrl || !cfg.apiKey) throw new Error('baseUrl 和 apiKey 不能为空');

  const path = settingsPath();
  const obj = readJsonOrThrow(path);        // 先读（解析失败即抛，不会往下走）
  const backup = backupIfExists(path);      // 再备份（原文件存在才备）

  const env = obj.env && typeof obj.env === 'object' ? obj.env : (obj.env = {});
  const keyField = cfg.apiKeyField ?? 'ANTHROPIC_AUTH_TOKEN';
  const written: string[] = [];
  const setEnv = (k: string, v?: string) => { if (v) { env[k] = v; written.push(k); } };

  setEnv('ANTHROPIC_BASE_URL', cfg.baseUrl);
  env[keyField] = cfg.apiKey; written.push(keyField);
  setEnv('ANTHROPIC_MODEL', cfg.model);
  setEnv('ANTHROPIC_DEFAULT_SONNET_MODEL', cfg.sonnetModel);
  setEnv('ANTHROPIC_DEFAULT_OPUS_MODEL', cfg.opusModel);
  setEnv('ANTHROPIC_DEFAULT_HAIKU_MODEL', cfg.haikuModel);

  obj[AO_MANAGED_KEY] = cfg.providerId;     // 打 AO 管理标记
  obj[AO_MANAGED_BASEURL_KEY] = cfg.baseUrl; // 记指纹：体检时验 env 有没有被别的工具改走

  writeSecretJson(path, obj);
  return { path, backup, writtenKeys: written };
}

export interface ClaudeSwitchStatus {
  /**
   * 是否由 AO 主动切换（顶层有标记且 env 与指纹一致）→ 体检时识别为"AO 切的"，可一键切回，
   * 而非"被搞坏"。注意：标记在但 env 被别的工具改走（tampered）时，这里为 false —— 让红灯照常报。
   */
  managed: boolean;
  managedProviderId?: string;
  /** 当前 env 里的中转端点（若有） */
  baseUrl?: string;
  /** 是否处于"已切到中转"状态（env 里存在 ANTHROPIC_BASE_URL） */
  active: boolean;
  /**
   * AO 标记还在，但当前 env.ANTHROPIC_BASE_URL 与 AO 写入时记的指纹对不上 —— 说明被别的工具
   * （cc-switch）或手动改走了。此时 managed=false，前端应按"被劫持"处理，而不是继续放行。
   */
  tampered: boolean;
}

/** 只读：当前 settings.json 指向哪个 provider、是否 AO 管理。不改任何文件。 */
export function readClaudeSwitchStatus(): ClaudeSwitchStatus {
  const path = settingsPath();
  if (!existsSync(path)) return { managed: false, active: false, tampered: false };
  let obj: any;
  try { obj = JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return { managed: false, active: false, tampered: false }; }
  const env = obj && typeof obj === 'object' ? obj.env ?? {} : {};
  const baseUrl = env.ANTHROPIC_BASE_URL;
  const managedId = obj?.[AO_MANAGED_KEY];
  const fingerprint = obj?.[AO_MANAGED_BASEURL_KEY];
  // 有标记 + 记过指纹 + 当前 env **确有**中转地址但对不上 → 被外部改走了，别再当"AO 切的"放行。
  // 要求 baseUrl 存在：env 被整块清空（回到官方登录）只是残留标记，不是"被劫持"，不应报 tampered。
  // 没记指纹（旧标记，或 restore 途中）时无从验证，保持旧行为不误伤。
  const tampered = managedId != null && typeof fingerprint === 'string' && !!baseUrl && baseUrl !== fingerprint;
  const managed = managedId != null && !tampered;
  return {
    managed,
    ...(managedId != null ? { managedProviderId: managedId } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    active: !!baseUrl,
    tampered,
  };
}

export interface RestoreResult extends RepairResult {
  /** 是否移除了 AO 管理标记 */
  removedAoMarker: boolean;
  /** 是否把当前系统代理(macOS scutil / Windows 注册表)同步给 Claude Code */
  proxySync: ClaudeProxySyncResult;
}

export interface ClaudeProxySyncResult {
  configured: boolean;
  changed: boolean;
  proxyUrl?: string;
  backup: string | null;
  reason?: string;
}

export interface RestoreOptions extends ShellEnvOptions {
  /** 测试/显式调用可直接传代理；生产默认从系统代理自动检测(macOS scutil / Windows 注册表)。 */
  proxyUrl?: string;
  detectSystemProxy?: boolean;
}

/**
 * 读取 macOS「系统设置 → 网络 → 代理」里的 HTTPS/HTTP 代理。
 * scutil 的 HTTPSProxy 表示“用于 HTTPS 请求的 HTTP CONNECT 代理”，因此 URL scheme
 * 仍然是 http://；这也符合 Claude Code 对 HTTPS_PROXY 的官方用法。
 */
export function detectMacOSSystemProxy(): string | undefined {
  if (process.platform !== 'darwin') return undefined;
  let out = '';
  try {
    out = execFileSync('/usr/sbin/scutil', ['--proxy'], { encoding: 'utf-8', timeout: 3000 });
  } catch {
    return undefined;
  }
  const field = (name: string): string | undefined => {
    const m = out.match(new RegExp(`\\b${name}\\s*:\\s*([^\\n]+)`));
    return m?.[1]?.trim();
  };
  const enabled = field('HTTPSEnable') === '1' || field('HTTPEnable') === '1';
  const host = field('HTTPSProxy') || field('HTTPProxy');
  const portRaw = field('HTTPSPort') || field('HTTPPort');
  const port = Number(portRaw);
  if (!enabled || !host || !Number.isInteger(port) || port < 1 || port > 65535) return undefined;
  const safeHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `http://${safeHost}:${port}`;
}

/**
 * 解析 Windows 注册表 ProxyServer 值。两种格式：
 *   · "host:port"                         —— 所有协议共用一个代理（Clash「系统代理」开关就是这种）
 *   · "http=host:port;https=host:port;…"  —— 分协议；取 https 优先，其次 http
 * 统一返回 `http://host:port`（HTTP CONNECT 代理，scheme 与 macOS 侧一致），无法解析则 undefined。
 * 纯函数、无副作用，便于单测。
 */
export function parseWindowsProxyServer(raw?: string): string | undefined {
  if (!raw) return undefined;
  let hostPort = raw.trim();
  if (hostPort.includes('=')) {
    const map: Record<string, string> = {};
    for (const part of hostPort.split(';')) {
      const i = part.indexOf('=');
      if (i > 0) map[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
    }
    hostPort = map.https || map.http || '';
  }
  hostPort = hostPort.replace(/^https?:\/\//i, '').trim();
  if (!hostPort) return undefined;
  const idx = hostPort.lastIndexOf(':');
  if (idx <= 0) return undefined;
  const host = hostPort.slice(0, idx).trim();
  const port = Number(hostPort.slice(idx + 1).trim());
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return undefined;
  const safeHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `http://${safeHost}:${port}`;
}

/**
 * 读取 Windows 系统代理（WinINET —— 「Internet 选项 → 局域网设置」，也是 Clash for Windows /
 * Clash Verge「系统代理」开关写的那份）：HKCU\…\Internet Settings 下 ProxyEnable=1 时，从
 * ProxyServer 解析出 host:port。用 `reg query` 读，免第三方依赖。
 */
export function detectWindow
```

### Core Architecture Module: `src/utils/claude-cli-probe.ts`
```
/**
 * 用本机官方 claude CLI 经中转实测一次（Studio「Claude Code 中转」的测试连接兜底）。
 *
 * 为什么需要：有的中转分组**只放行官方 Claude Code 客户端**——PackyCode 的 cc 分组即是。
 * 测试连接原本手搓一个 POST {base}/v1/messages 去探，会被它拒掉（400「非法请求」/「请使用
 * 正确的 Claude Code 客户端」，403「only accessible via the official Claude CLI」），于是界面报失败；
 * 可 claude-code 这条路实际运行时就是 claude CLI 走中转，同一把 key 跑工作流完全正常
 * （2026-09-15 真 key 实测：直连探测 400，claude -p 经中转 5 秒回「你好」）。
 * 所以探测被拒时，用真实客户端再测一次才能下结论。
 *
 * 中转凭据只注入这一个子进程（ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN），不碰用户本机的
 * claude 配置；并剥掉继承来的 ANTHROPIC_API_KEY——它优先级更高，留着会绕过中转去打别处。
 */
import type { ChildProcess } from 'node:child_process';
import { findExecutable, spawnCLI } from '../connectors/spawn-cli.js';

export type ClaudeCliProbeResult =
  | { ok: true; latencyMs: number; output: string }
  | { ok: false; notInstalled?: boolean; error: string };

const NOT_INSTALLED = '本机没有安装 claude（Claude Code CLI），无法用官方客户端实测';

/** 只给这次子进程用的环境：指向中转、带上中转 token，并去掉会抢先生效的 ANTHROPIC_API_KEY */
export function claudeRelayEnv(baseUrl: string, token: string, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env, ANTHROPIC_BASE_URL: baseUrl, ANTHROPIC_AUTH_TOKEN: token };
  delete out.ANTHROPIC_API_KEY;
  return out;
}

export function probeClaudeCliViaRelay(opts: {
  baseUrl: string;
  token: string;
  model?: string;
  /** 默认 claude；测试里指向假的可执行文件 */
  command?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}): Promise<ClaudeCliProbeResult> {
  const command = opts.command ?? 'claude';
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const env = claudeRelayEnv(opts.baseUrl, opts.token, opts.env ?? process.env);
  if (!findExecutable(command, env)) return Promise.resolve({ ok: false, notInstalled: true, error: NOT_INSTALLED });
  const args = ['-p', 'hi', ...(opts.model ? ['--model', opts.model] : [])];
  const t0 = Date.now();

  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let child: ChildProcess | undefined;
    const done = (r: ClaudeCliProbeResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(r);
    };
    try {
      child = spawnCLI(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] }, 'Claude Code');
    } catch (e) {
      done({ ok: false, error: e instanceof Error ? e.message : String(e) });
      return;
    }
    timer = setTimeout(() => {
      // 先礼后兵，与 cli-base 同一口径：SIGTERM 不走就 SIGKILL，别把子进程留在那儿
      try { child?.kill('SIGTERM'); } catch { /* 已退出 */ }
      setTimeout(() => { try { child?.kill('SIGKILL'); } catch { /* 已退出 */ } }, 5000).unref?.();
      done({ ok: false, error: `claude CLI 实测超时（${Math.round(timeoutMs / 1000)}s）` });
    }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d; });
    child.stderr?.on('data', (d) => { err += d; });
    child.on('error', (e: NodeJS.ErrnoException) => {
      done(e.code === 'ENOENT' ? { ok: false, notInstalled: true, error: NOT_INSTALLED } : { ok: false, error: e.message });
    });
    child.on('close', (code) => {
      const text = out.trim();
      if (code === 0 && text) done({ ok: true, latencyMs: Date.now() - t0, output: text.slice(0, 200) });
      else done({ ok: false, error: (err.trim() || text || `claude CLI 退出码 ${code}`).slice(0, 400) });
    });
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #103** (2026-10-04): **桌面版0.4.1生成的工作流失败**
  *Symptoms*: <img width="651" height="326" alt="Image" src="https://github.com/user-attachments/assets/21f0706c-3f34-43f3-a246-ca4d079cb105" />  [程序员想做副业月入万帮我做个完整的规则.yaml](https://github.com/user-attachments/files/30812788/default.yaml)
  **Post-Mortem & Fix Analysis**:
  > 基本所有生成的工作流都有这种问题
  > 抱歉晾了这么久，也谢谢你上传了完整的 YAML —— 这个 issue 能定位到根因，全靠那份文件。  **根因不是"生成的工作流写坏了"，而是一类很隐蔽的错位。** 编排模型在写 `depends_on` 时，把上游步骤的 **output 变量名**当成了 step id。你那份文件里 `compile_final_guide` 这一步的 8 条依赖中只有 2 条是错的：  - `income_paths_analysis` —— 它其实是步骤 `analyze_income_paths` 的 output - `strategy_recommendation` —— 它其实是步骤 `recommend_strategy` 的 output  所以报错说"依赖不存在的 step: xxx"，而你拿这个名字在文件里搜，**根本搜不到任何一个步骤**——无从下手是必然的。  **为什么你会觉得"基本所有生成的工作流都有这种问题"**：自动组队本来有一条三阶段的自动修复链，但这类错误恰好从三个阶段的缝里漏了过去——阶段 0 只会"补"缺失的依赖边、阶段 1 只改 `{{变量}}` 引用、阶段 2 靠从报错里提取变量名（这类报错提不出东西，直接空转返回）。于是它原样抛给了你。此前我们在 #94 里回复"这类错误已被修复链覆盖"，**是不准确的**，这里一并更正。  **已修**：新增确定性改写 `autoFixDependsOnIds` —— 坏依赖精确等于某个步骤的 output 时，改写成那个步骤的 id。只做**零歧义**改写：对不上、有同名 output 有歧义、会成环、会自依赖的，一律不动，宁可报错也绝不连错边。同时接在两处：自动组队生成链，以及"粘贴 YAML 存盘"入口（那个入口此前完全不校验 DAG，要等你点运行才发现）。报错文案也改了：认出坏依赖是某个步骤的输出变量名时，直接点破"这是步骤 X 的输出变量名，不是 step id，应写 X"。  **拿你上传的那份文件实测**（在即将发布的版本上）：  ``` 自动改写 2 处：   compile_final_guide: depends_on income_paths_analysis → analyze_income_paths   compile_final_guide: depends_on 
  > 已修复。根因是自动组队时模型把上游步骤的 output 变量名当 step id 写进了 `depends_on`，已加自动修正（autoFixDependsOnIds）。修复已随 npm `v0.14.0` 和桌面端 `v0.4.3` 发布——请升级桌面端到 0.4.3（[下载页](https://github.com/jnMetaCode/agency-orchestrator/releases/latest)）后重试你附的这个工作流，如仍失败请贴新报错。

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

- **Issue #94** (2026-10-04): **使用的时候报错**
  *Symptoms*: ## 问题描述  要求：以minimax数字人技术为核心，调用minimax api，开发应用于macos的小红书数字人口播视频APP 点击“自动组队并运行”后，agency-orchestrator根据内容自动调取4个角色参与项目，其后弹出“”  ## 复现步骤  1. 运行命令 `以minimax数字人技术为核心，调用minimax api，开发应用于macos的小红书数字人口播视频APP` 2. 使用的工作流 “自动组队并运行”  <img width="2268" height="400" alt="Image" src="https://github.com/user-attachments/assets/b1b0a33a-5352-4fbc-8dfa-02c6577cbe1c" />  <img width="2640" height="1726" alt="Image" src="https://github.com/user-attachments/assets/5fcc3002-d1aa-4ad0-9ec8-4251e3ed96b7" />  3. 出现错误  ## 期望行为  通过工作流顺利推进项目开发并呈现结果  ## 实际行为  实际发生了什么（包含错误信息）。  ## 错误: 工作流校验失败 / Workflow validation failed: - step "ux_research" 依赖不存在的 step: "product_spec"  - Node.js 版本：v26.3.1 - 操作系统：macOS - agency-orchestrator 版本：0.2.9 - LLM Provider： 
  **Post-Mortem & Fix Analysis**:
  > 感谢截图，问题已定位。  **根因**：你截图的错误 `step "ux_research" 依赖不存在的 step: "product_spec"` 是 AI 自动组队时偶发的另一类产物缺陷——模型在 `depends_on` 里写了一个并不存在的步骤 id（和缺依赖边不同类）。  **现状**：0.11.0 的组队修复链已明确覆盖这类错误：先启发式自动修复，修不动的交给模型二次修复，仍失败会逐条指出具体步骤——不再是弹个错就卡住。  **建议**：升级后重试同样的描述（`npm i -g agency-orchestrator@latest`，桌面端下载 0.3.0）。如仍复现，把生成的工作流 YAML 贴上来（「我的工作流」卡片上有下载 YAML 按钮），我们直接对着修。 
  > 这个 issue 是 **0.2.9** 的,`ao compose` 从那之后经过了大幅重构 —— 现在生成后会跑完整的 workflow 校验(含 `depends_on` 是否指向真实存在的 step),并带自动修复链(角色幻觉的确定性替换 / LLM 重修、变量引用修复)。你当时遇到的 `step "ux_research" 依赖不存在的 step "product_spec"` 这类结构错误,现在会在生成阶段被校验拦下并尝试修复,而不是直接抛给你。  方便的话请升级到最新版复测同样的任务:  ``` npm i -g agency-orchestrator@latest ```  若在 0.12.1 上仍复现,贴一下生成的 YAML,我这边好进一步定位。先不关闭,等你确认。 
  > 新版本已发布，麻烦有空复测一下 🙏 桌面端 **0.4.2**：https://github.com/jnMetaCode/agency-orchestrator/releases/tag/desktop-v0.4.2 （npm 包 0.13.0 随后跟上）。  你当时遇到的 `step "ux_research" 依赖不存在的 step: "product_spec"` 属于自动组队的产物结构错误。从 0.11.0 起，`ao compose` 生成后会跑完整的工作流校验（含 `depends_on` 是否指向真实存在的步骤），并带自动修复链：先做确定性修复（角色幻觉替换、变量引用与依赖边补全），修不动的交给模型二次修复，仍失败会逐条指出具体是哪个步骤、哪个变量——不会再弹一句错就卡住。  如果同样的描述仍复现，把生成的工作流 YAML 贴上来（「我的工作流」卡片上有下载 YAML 按钮），我直接对着修。 

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

### Incident Patch 1: `555fefb1` (2026-10-04)
**Commit Message**: release: 0.20.0 batch generation and Fluxion API

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ web/demos/
 demo.gif
 serve.json
 eval-output/
+/output/
+/screenlog.*
 
 # 派生：扩充池按分类切片（scripts/split-creative-extra.mjs 在 website dev/build 前生成）
 website/src/content/creative-extra/
```

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -4,6 +4,8 @@
 
 ## [Unreleased]
 
+## [0.20.0] - 2026-10-04
+
 ### Security
 - **写进 `~/.claude/settings.json` 的中转 token 现在是 0600、原子写，备份也不再无限堆积**（与本轮 Codex 那条同类，
   只是这边装的是 API key）。此前：权限是默认的 0644（同机其他用户可读）；`writeFileSync` 先截断——中途崩了就剩个
@@ -49,6 +51,9 @@
   AO 只在 `src/export/convert.ts` 里**写** xlsx、从不解析，暴露面小）。
 
 ### Added
+- **创意库新增胜算云 LoomLoom 批量出图**：支持多选提示词、提交前校验与估价、异步进度、历史任务、失败项单独重试，以及经本地 AO 代理预览/下载生成结果。功能默认不会假装调用真实模型；只有服务端显式配置真实批量端点和密钥时才进入正式模式。同步补齐可恢复的本机任务记录、幂等提交、签名下载地址代理与端到端 mock 测试。
+- **Fluxion AI 从赞助展示补齐为可运行供应商**：新增 OpenAI 兼容 API provider、动态模型目录、图片模型入口、Claude Code/Codex 中转预设与赞助轮换。测试连接优先按当前 key 的真实模型目录选模型，避免 Claude/GPT 分组不同导致有效密钥被静态模型误判。
+- **提示词生成页与 Studio 共用供应商/文本模型选择器**，并明确显示实际执行配置；胜算云配置成图片或视频模型时，文本能力自动回落到可用文本模型，不再把 Seedream/Seedance 发往 `chat/completions`。
 - **验收 / 机械断言返工成功后，第一轮是哪条没过会留在档案里，并显示出来**（`firstFailed`，仅返工过时有；acceptance 与 assert 两边都有）：
   随 metadata 存档，步骤文件头/`summary.md` 那行徽章顺带点名（「验收 ✓（返工 1 轮后通过：不超过 200 字（超长））」，只带第一条），
   Studio 的徽标本身不变长、把未过项塞进 title。
```

**File**: `docs/HANDOFF.md` (modified, +3/-1)
```diff
@@ -83,8 +83,10 @@ git log --oneline v0.19.2..main | wc -l   # 主干比线上多多少
 - **AICodeMirror 上架**：CLI 中转预设（三个端点）+ **直连 API**（Anthropic 协议，引擎新增 `ANTHROPIC_PROVIDERS` 注册表）+ 赞助位（Studio 第 2 行首位 / 官网多元探索右边）。
 - **LanoX AI 上架**（2026-08-13）：直连 API 走 OpenAI 兼容 `api.lanox.ai/v1`（内置 provider `lanox`，env `LANOX_API_KEY`）+ CLI 中转预设（claude-code 走根路径的 Anthropic 端点、codex 走 `/v1`；**没有 Gemini 端点，没探到就没填**）+ 赞助位**排最后**（两张列表都是）。**没给默认模型**——无 key 核实不了它实际上架的模型名，宁可让用户自选也不重演多元探索那次"默认模型平台没上架、一跑就报错"。
 - **胜算云上架**（2026-08-14）：直连 API 走 OpenAI 兼容 `router.shengsuanyun.com/api/v1`（内置 provider `shengsuanyun`，env `SHENGSUANYUN_API_KEY`）+ CLI 中转预设**三个都有**（claude-code / gemini-cli 走 `/api`，codex 走 `/api/v1`）+ 赞助位**排最后**（LanoX 顺位后移，两张列表都改了）。两个坑：**主域 `api.shengsuanyun.com` 整站 404**，端点在 `router` 子域；**模型名带厂商前缀**（`anthropic/claude-sonnet-5`），少写前缀会 404。它跟 LanoX 相反——`GET /api/v1/models` 无需 key 就能拉，且每个模型自带 `support_apis` 与 `pricing`，所以协议支持和默认模型都是查出来的，不是猜的。
+- **Fluxion AI API 补齐**（2026-10-03）：此前只有赞助卡片，现已补成可运行的内置 provider（`fluxionai`，env `FLUXION_API_KEY` / `FLUXION_BASE_URL`）。OpenAI 兼容与图片生成使用 `https://fluxionai.space/v1`，Claude Code 使用 `https://fluxionai.space`，Codex 使用 `/v1`；图片模型建议为 `gpt-image-2`。模型权限受 key 分组影响，所以不设置全局默认模型，也不把仅特定分组可用的 Gemini 端点伪装成通用预设。
+- **Fluxion AI 分组实测**（2026-10-04）：用 Claude 分组 key 拉 `GET /v1/models` 返回 12 个 Claude 模型；Anthropic Messages、OpenAI Responses、Chat Completions 三种协议均以最小请求返回 200。配置页“测试连接”已改为：模型为空时先用当前 key 拉真实目录，再选目录首个模型测试，避免静态 GPT 建议把有效 Claude key 误报为不可用。Codex 当前官方配置支持 `env_key` / `requires_openai_auth` / `wire_api="responses"`，但未列出 `model_catalog_url`，AO 不写该字段。
 - **RootFlowAI、CCSub 下架**：摘掉赞助身份与曝光位，但**保留为可用供应商**——已配过 key 的用户照常显示、照常能跑。
-- 轮换池现为 7 家均分（每家 2/7 天），且**已整池写进远程清单**——清单里配了就整池替换内置的，所以以后改轮换必须两处一起改（有测试逐条比对）。多元探索**按约定不进轮换**，它持有的是「默认 provider 位」。
+- 轮换池现为 8 家均分（每家 2/8 天），且**已整池写进远程清单**——清单里配了就整池替换内置的，所以以后改轮换必须两处一起改（有测试逐条比对）。多元探索**按约定不进轮换**，它持有的是「默认 provider 位」。
 
 ### 一类反复出现的缺陷（值得记住）
 新增能力之后，**围绕它的诊断/提示/隔离没跟上**，这一轮抓到 6 个，全部同源：
```

**File**: `docs/superpowers/specs/2026-09-30-shengsuanyun-batch-image-design.md` (added, +961/-0)
```diff
@@ -0,0 +1,961 @@
+# 创意库 × 胜算云批量出图：产品需求与开发设计
+
+> 日期：2026-09-30
+> 状态：Draft / 待双方接口评审
+> 负责人：Agency Orchestrator
+> 合作方：胜算云（LoomLoom Batch API）
+> 首期页面：`/creative` 图片提示词库
+
+### 当前实施状态（更新于 2026-10-01）
+
+- 已完成需求与接口反向评审；
+- 已完成默认关闭的胜算云批量服务端适配器；
+- 已完成 capability、校验/估价、幂等提交、整批状态、逐条任务和产物接口；
+- 已完成本地 runId 包装与任务映射持久化；
+- 已完成创意库批量选择、费用确认、提交、进度和结果预览的首版 UI；
+- 已有假上游契约测试覆盖金额、原样提示词、余额、quote、幂等基础和任务归属；
+- 已完成刷新后恢复最近任务，以及“重新估价 → 仅重试失败项 → 建立子任务”的链路；
+- 已完成最近 20 条任务历史、手动刷新和终态任务 30 天清理；
+- 尚未完成真实专属模板联调和 ZIP 下载；
+- `AO_SSY_BATCH_ENABLED` 缺省关闭，P0 契约未关闭前不得在生产开启。
+
+## 1. 摘要
+
+在 Agency Orchestrator 创意库中增加“批量出图”能力。用户仍在本站浏览、搜索、筛选和选择提示词；本站负责选择、配置、费用确认、任务进度与结果展示；胜算云通过 LoomLoom Batch API 承担批量任务校验、费用预估、异步执行和产物交付。
+
+首期不是“把现有单张生成循环 N 次”，而是接入胜算云正式批处理能力，必须满足：提交前预估费用、幂等提交、逐条状态、失败项重试、刷新后恢复、产物下载。
+
+推荐入口位于图片分类和扩充池入口下方、卡片列表上方。用户进入“批量选择模式”后再在卡片上显示复选框，避免普通浏览状态被批量控件干扰。
+
+## 2. 背景与现状
+
+### 2.1 当前能力
+
+创意库当前已有：
+
+- 229 条精选图片提示词及按需加载的扩充池；
+- 搜索、分类筛选和分页；
+- 单卡复制提示词；
+- 单卡选择供应商、模型、尺寸并生成一张图片；
+- 已配置供应商的本地 `ao web` 后端代理；
+- 胜算云供应商、Logo、注册链接和赞助商资料。
+
+现有单张生成的调用模型是同步的：前端调用 `/api/image/generate`，等待一张图片以 data URL 返回。该模型不适合十几至几十个任务，因为会造成长连接、内存占用、刷新丢失、重复提交和部分失败难以恢复。
+
+### 2.2 胜算云已确认的批处理能力
+
+根据 2026-09-30 可访问的胜算云 LoomLoom 开发者文档，已确认：
+
+- Bearer Token 鉴权；
+- 查询模板及模板 schema；
+- JSON 逐行校验；
+- 提交前费用预估与余额检查；
+- JSON 逐行提交；
+- `idempotencyKey`；
+- 使用 `runId` 查询批任务状态；
+- 查询逐条任务及失败原因；
+- 查询产物及短期签名下载 URL；
+- 官方图片模板 `text-image-v1` 当前流程为“提示词优化 → 出图”。
+
+参考：
+
+- https://lean.shengsuanyun.com/loomloom-guide
+- https://lean.shengsuanyun.com/apidocs/loomloom/guide/loomloom-manual
+
+### 2.3 核心冲突
+
+本合作的价值主张是“用户使用 Agency Orchestrator 的提示词批量出图”。若直接使用会二次优化提示词的模板，最终输入不再等于用户选中的提示词，会带来：
+
+- 生成效果不可解释；
+- 用户无法复现；
+- 平台提示词价值被稀释；
+- 客诉时无法确定是原提示词、优化步骤还是图片模型造成；
+- 费用中混入额外文本模型调用。
+
+因此上线阻断条件之一是：胜算云提供提示词原样透传模板，或现有模板支持明确的 `passthrough` 模式。
+
+## 3. 目标与非目标
+
+### 3.1 产品目标
+
+1. 用户能从当前页选择多条提示词，一次创建批量出图任务。
+2. 用户提交前能看到条目数、预计费用、可用余额和关键生成配置。
+3. 用户能看到整批和逐条进度，并定位失败原因。
+4. 页面刷新或关闭后重新打开，仍能恢复最近任务。
+5. 用户能下载单个产物或整批产物，并仅重试失败项。
+6. 胜算云获得自然、可归因的品牌曝光，但不破坏提示词浏览体验。
+7. 集成层保持可替换性，未来可接入第二家批量生成服务。
+
+### 3.2 首期非目标
+
+- 不支持用户在本站设计任意 LoomLoom 工作流；
+- 不支持 Excel 上传和回填；
+- 不支持图片到视频流水线；
+- 不支持上传参考图；
+- 不支持跨设备同步任务历史；
+- 不支持团队协作、审批和额度分配；
+- 不承诺在公开静态演示站保存长期凭据；
+- 不把所有胜算云图片模型一次性暴露给用户。
+
+## 4. 用户与核心场景
+
+### 4.1 目标用户
+
+- 内容运营：一次生成多种视觉方向，再挑选可用素材；
+- 电商和营销人员：批量生成多张主图、海报或社媒图片；
+- 设计探索者：将一个筛选结果中的多条提示词批量试跑；
+- 开发者：验证多个提示词在同一模型下的表现。
+
+### 4.2 首期主路径
+
+1. 用户进入创意库图片页。
+2. 搜索或选择分类。
+3. 点击“批量出图”。
+4. 勾选若干提示词，或选择“全选本页”。
+5. 点击吸底栏“下一步”。
+6. 在配置抽屉中确认模板、模型归属、尺寸、每条生成数量和提示词处理方式。
+7. 系统调用校验与费用预估。
+8. 用户确认费用并提交。
+9. 系统展示整批与逐条进度。
+10. 完成后用户预览、下载，或仅重试失败项。
+
+## 5. 产品决策
+
+### 5.1 批量对象
+
+首期定义为“多条提示词 × 每条 1 张”。
+
+- 默认最多选择 24 条，即当前页大小；
+- 真实上限由胜算云书面确认后写入 capability；
+- “每条生成多张”作为服务端确认支持后的可选项，首期默认隐藏；
+- 不允许在尚未加载的扩充池中后台隐式选择提示词。
+
+### 5.2 提示词处理
+
+- 专属模板默认且推荐 `passthrough`，原样使用本站提示词；
+- 通用 `text-image-v1` 模板会先整理提示词，必须在界面标明“由模板整理”，不得声称原样透传；
+- 若要让用户在 `passthrough` 与 `optimize` 之间切换，胜算云模板 schema 必须显式提供对应字段；
+- 配置页需展示说明：“AI 优化会修改原提示词，并可能产生额外费用”；
+- 提交记录同时保存原提示词和发送提示词的摘要信息；
+- 若 API 无法回传优化后的最终提示词，首期不开放 `optimize`。
+
+### 5.3 模型策略
+
+首期只开放 1 个双方共同验收过的模型，或由已验收的胜算云模板内部决定模型，而不是直接展示完整目录。
+
+原因：胜算云不同图片模型的参数结构、尺寸枚举和计费口径不同。先固定模型可显著降低错误率，并验证真实转化。后续由 capability 返回模型与合法配置，不在前端硬编码未经验证的组合。
+
+当模板 schema 没有模型字段时，前端显示“由胜算云模板决定”，不渲染虚假的模型选择器。需要用户选模型时，合作方应在专属模板 schema 中提供稳定的 model enum 字段。
+
+### 5.4 品牌展示
+
+使用以下三处轻量露出：
+
+1. 页面级按钮下方：“批量能力由胜算云提供”；
+2. 配置抽屉标题区：胜算云 Logo、名称和“了解服务”链接；
+3. 任务详情页：“由胜算云 LoomLoom 执行”。
+
+不在所有普通卡片常驻 Logo；只有进入批量选择模式后才显示批量相关控件。
+
+## 6. 信息架构与交互
+
+### 6.1 页面入口
+
+桌面端：
+
+```text
+分类标签……
+
+[再加载全部 1349 条扩充池]     [☑ 批量出图]
+                                  由胜算云提供
+
+┌────────────卡片────────────┐  ┌────────────卡片────────────┐
+```
+
+移动端：两个按钮纵向排列或横向自适应；赞助说明不能挤压主要按钮文字。
+
+按钮事件：
+
+- 普通状态：点击进入选择模式；
+- 选择状态：按钮变为“退出批量”；
+- 若批量服务不可用：按钮可见但禁用，旁边给出可操作原因。
+
+### 6.2 选择模式
+
+进入后：
+
+- 每张图片卡左上角显示复选框；
+- 整张卡的非交互空白区域可切换选择；
+- 原有“复制提示词”“生成”按钮继续可用，不能因卡片点击误触选择；
+- 已选择卡片使用主色描边和轻背景；
+- 顶部出现“全选本页 / 清空选择”；
+- 切换搜索条件、分类或分页时，已选项保留；
+- 用户选择未加载的扩充池分类时，等数据加载完成再允许选择；
+- 选择数达到上限后，其余复选框禁用并解释上限。
+
+### 6.3 吸底操作栏
+
+```text
+已选择 8 条提示词       [清空] [取消] [下一步：批量出图]
+```
+
+- 选择数为 0 时“下一步”禁用；
+- 不覆盖移动端浏览器安全区；
+- 保持在站点导航和弹窗遮罩的正确层级；
+- 退出选择模式时，如已有选择，要求二次确认或提供撤销 toast。
+
+### 6.4 配置抽屉
+
+字段：
+
+| 字段 | 首期规则 |
+|---|---|
+| 提示词 | 显示数量，可展开预览；不允许在此逐条编辑 |
+| 提示词处理 | 显示 capability 的真实行为；通用 `text-image-v1` 显示“由模板整理” |
+| 模型 | 固定模型显示具体 ID；无模型字段时显示“由胜算云模板决定”；有枚举字段时才显示单选 |
+| 图片比例/尺寸 | 由 capability/schema 返回，不能自行猜值 |
+| 每条数量 | 首期固定 1 |
+| 总任务数 | 提示词数 × 每条数量 |
+| 预计费用 | 必须预估成功后显示 |
+| 可用余额 | API 返回时显示；不足时阻止提交 |
+
+按钮状态：
+
+- 初始：“预估费用”；
+- 预估中：“正在校验和估价…”；
+- 预估成功：“确认并提交 · 预计 ¥X.XX”；
+- 配置变更后，旧预估立即失效，必须重新预估；
+- 预估超过 60 秒未提交，提交前重新预估一次；
+- 不允许把 `estimatedTotalCost` 当最终实际费用。
+
+### 6.5 任务面板
+
+整批信息：
+
+- 状态：等待中、生成中、部分成功、全部成功、失败、已取消；
+- 完成数 / 总数；
+- 失败数；
+- 预计费用和实际费用；
+- 提交时间；
+- `runId` 的短预览，用于客服排查；
+- 胜算云执行标记。
+
+逐条信息：
+
+- 原卡片标题和缩略图；
+- 原提示词；
+- 状态；
+- 失败原因；
+- 生成产物；
+- 单张下载；
+- 单项重试。
+
+轮询建议：
+
+- 前 1 分钟每 5 秒；
+- 之后每 10 秒；
+- 页面不可见时降至每 30 秒；
+- 终态立即停止；
+- 连续 3 次网络失败后进入“暂时无法更新”
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "agency-orchestrator",
-  "version": "0.19.2",
+  "version": "0.20.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "agency-orchestrator",
-      "version": "0.19.2",
+      "version": "0.20.0",
       "license": "Apache-2.0",
       "dependencies": {
         "@anthropic-ai/sdk": "^0.52.0",
```

**File**: `package.json` (modified, +5/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "agency-orchestrator",
-  "version": "0.19.2",
+  "version": "0.20.0",
   "description": "Multi-agent YAML workflow engine — 276 CN + 191 EN + 5 more language libraries of AI roles, auto DAG parallelism, zero code. One sentence → multiple AI roles collaborate → complete plan in minutes. 20+ API providers, plus 10 key-free options (coding-CLI subscriptions / local Ollama).",
   "keywords": [
     "multi-agent",
@@ -71,6 +71,10 @@
     "build:studio": "npm --prefix website install && npm --prefix website run build",
     "verify:release": "node scripts/verify-cli.mjs && node scripts/verify-frontend.mjs",
     "typecheck:test": "tsc -p tsconfig.test.json",
+    "test:batch": "node test/batch-shengsuanyun.mjs",
+    "probe:ssy-batch": "node scripts/probe-shengsuanyun-batch.mjs",
+    "preview:ssy-mock": "node scripts/mock-shengsuanyun-batch.mjs",
+    "pretest": "npm run -s test:batch",
     "test": "npm run -s typecheck:test && npx tsx test/run.ts && npx tsx test/assert.ts && npx tsx test/condition.ts && npx tsx test/cli.ts && npx tsx test/cli-dx.ts && npx tsx test/cli-base.ts && npx tsx test/spawn-cli.ts && npx tsx test/antigravity-cli.ts && npx tsx test/codebuddy-cli.ts && npx tsx test/claude-code-cwd.ts && npx tsx test/claude-code-stream.ts && npx tsx test/llm-override.ts && npx tsx test/cline-cli.ts && npx tsx test/opencode-cli.ts && npx tsx test/dsh-cli.ts && npx tsx test/sponsor-guide.ts && npx tsx test/providers-manifest.ts && npx tsx test/claude-base-url.ts && npx tsx test/anthropic-providers.ts && npx tsx test/depends-on-ids.ts && npx tsx test/parse-inputs.ts && npx tsx test/compose.ts && npx tsx test/demo.ts && npx tsx test/factory-custom.ts && npx tsx test/azure-compat.ts && npx tsx test/endpoint-fallback.ts && npx tsx test/newapi-usage.ts && npx tsx test/claude-cli-probe.ts && npx tsx test/env-proxy.ts && npx tsx test/proxy-setting.ts && npx tsx test/image-step.ts && npx tsx test/video-step.ts && npx tsx test/local-sdcpp.ts && npx tsx test/tts-step.ts && npx tsx test/preflight.ts && npx tsx test/media-spend-loop.ts && npx tsx test/e2e-image.ts && npx tsx test/e2e-video.ts && npx tsx test/concat-step.ts && npx tsx test/styles.ts && npx tsx test/probe-video.ts && npx tsx test/empty-output.ts && npx tsx test/creative-prune.ts && npx tsx test/creative-data.ts && npx tsx test/doctor.ts && npx tsx test/connector-continuation.ts && npx tsx test/claude-continuation.ts &&npx tsx test/connector-stall.ts && npx tsx test/ollama-vision.ts && npx tsx test/compare-lib.ts && npx tsx test/compare-cancel.ts && npx tsx test/share-report.ts && npx tsx test/notify.ts && npx tsx test/install.ts && npx tsx test/materialize.ts && npx tsx test/paths.ts && npx tsx test/skills.ts && npx tsx test/acceptance.ts && npx tsx test/verify.ts && npx tsx test/verify-image.ts && npx tsx test/verify-video.ts && npx tsx test/step-llm.ts && npx tsx test/step-llm-yaml.ts && npx tsx test/stdin-limit.ts && npx tsx test/compose-name.ts && npx tsx test/team.ts && npx tsx test/ledger.ts && npx tsx test/prompt.ts && npx tsx test/upgrade.ts && npx tsx test/version-and-dirs.ts && npx tsx test/resume.ts && npx tsx test/feedback.ts && npx tsx test/human-input.ts && npx tsx test/init.ts && npx tsx test/roles.ts && npx tsx test/role-suggest.ts && npx tsx test/eval-gate.ts && npx tsx test/validate-report.ts && npx tsx test/workflows.ts && npx tsx test/workflow-schema.ts && npx tsx test/validate-strict.ts && npx tsx test/timeout.ts && npx tsx test/watch-render.ts && npx tsx test/timeout-zero.ts && npx tsx test/classify-error.ts && npx tsx test/sse-parse.ts && npx tsx test/media-spool.ts && npx tsx test/cli-orphan.ts && npx tsx test/desktop-helpers.ts && npx tsx test/sleep-retry.ts && npx tsx test/inputs.ts && npx tsx test/e2e.ts && npx tsx test/e2e-condition.ts && npx tsx test/e2e-loop.ts && npx tsx test/detect-providers.ts && npx tsx test/canvas-graph.ts && npx tsx test/creative-prompts.ts && npx tsx test/export-convert.ts && npx tsx test/web-data-dir.ts && npx tsx test/run-output-parser.ts && npx tsx test/web-server.ts && npx tsx test/web-network-proxy.ts && npx tsx test/request-guard.ts && npx tsx test/web-run-assets.ts && npx tsx test/canvas-save-deliverables.ts && npx tsx test/server-shutdown.ts && npx tsx test/legacy-ui.ts && npx tsx test/studio-a11y.ts && npx tsx test/studio-demo-guard.ts && npx tsx test/custom-providers.ts && npx tsx test/mcp.ts && npx tsx test/claude-apply.ts && npx tsx test/codex-relay.ts && npx tsx test/claude-proxy.ts",
     "prepublishOnly": "npm run build && npm run build:studio && npm run verify:release",
     "metrics": "node scripts/metrics.mjs"
```

**File**: `schemas/workflow.schema.json` (modified, +3/-0)
```diff
@@ -55,6 +55,7 @@
             "shengsuanyun",
             "apimart",
             "packycode",
+            "fluxionai",
             "gemini",
             "xai",
             "moonshot",
@@ -153,6 +154,7 @@
             "shengsuanyun",
             "apimart",
             "packycode",
+            "fluxionai",
             "gemini",
             "xai",
             "moonshot",
@@ -460,6 +462,7 @@
                   "shengsuanyun",
                   "apimart",
                   "packycode",
+                  "fluxionai",
                   "gemini",
                   "xai",
                   "moonshot",
```

**File**: `scripts/mock-shengsuanyun-batch.mjs` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+#!/usr/bin/env node
+/** 本地 UI 演示专用的 LoomLoom 假上游。仅监听 127.0.0.1，不请求真实服务。 */
+import { createServer } from 'node:http';
+import { randomUUID } from 'node:crypto';
+
+const port = Number.parseInt(process.env.PORT || '8091', 10);
+const runs = new Map();
+
+function sendJson(res, body, status = 200) {
+  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
+  res.end(JSON.stringify(body));
+}
+
+function readJson(req) {
+  return new Promise((resolve, reject) => {
+    let raw = '';
+    req.setEncoding('utf8');
+    req.on('data', (chunk) => { raw += chunk; if (raw.length > 1_000_000) reject(new Error('body too large')); });
+    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); } });
+    req.on('error', reject);
+  });
+}
+
+function artwork(index) {
+  const palettes = [['#6d28d9', '#c4b5fd'], ['#0369a1', '#7dd3fc'], ['#be123c', '#fda4af'], ['#047857', '#6ee7b7']];
+  const [deep, light] = palettes[index % palettes.length];
+  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
+    <defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${deep}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>
+    <rect width="1024" height="1024" rx="64" fill="url(#g)"/><circle cx="790" cy="230" r="180" fill="white" opacity=".16"/>
+    <path d="M0 800 Q260 560 520 800 T1040 760 V1024 H0Z" fill="white" opacity=".18"/>
+    <text x="72" y="112" fill="white" font-family="system-ui,sans-serif" font-size="34" opacity=".8">SHENGSUANYUN · LOCAL DEMO</text>
+    <text x="72" y="860" fill="white" font-family="system-ui,sans-serif" font-size="76" font-weight="700">批量作品 ${index + 1}</text>
+    <text x="72" y="925" fill="white" font-family="system-ui,sans-serif" font-size="28" opacity=".85">仅用于界面预览 · 未调用真实生成服务</text>
+  </svg>`;
+}
+
+const server = createServer(async (req, res) => {
+  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
+  const path = url.pathname;
+  try {
+    if (req.method === 'GET' && path === '/batch/v1/health') return sendJson(res, { status: 'ok', mock: true });
+    if (req.method === 'GET' && path === '/batch/v1/templates/ao-local-demo/schema') {
+      return sendJson(res, { fields: [{ key: 'prompt', label: '提示词', type: 'string', required: true }] });
+    }
+    if (req.method === 'POST' && path === '/batch/v1/templates:validate-rows') return sendJson(res, { valid: true, rowErrors: [] });
+    if (req.method === 'POST' && path === '/batch/v1/templates:precheck-rows') {
+      const body = await readJson(req);
+      return sendJson(res, { estimatedTotalCost: (body.rows?.length || 0) * 3_800_000, balanceCheck: { availableBalance: 1_000_000_000, isSufficient: true } });
+    }
+    if (req.method === 'POST' && path === '/batch/v1/templates:submit-rows') {
+      const body = await readJson(req);
+      const runId = `demo-${randomUUID()}`;
+      runs.set(runId, { rows: body.rows || [], acceptedAt: new Date().toISOString() });
+      return sendJson(res, { runId, status: 'pending', acceptedAt: runs.get(runId).acceptedAt });
+    }
+    const match = path.match(/^\/batch\/v1\/batch\/workflow-runs\/([^/]+)(?:\/(tasks|artifacts))?$/);
+    if (req.method === 'GET' && match) {
+      const run = runs.get(decodeURIComponent(match[1]));
+      if (!run) return sendJson(res, { message: 'demo run not found' }, 404);
+      if (match[2] === 'tasks') return sendJson(res, { tasks: run.rows.map((_row, index) => ({ taskId: `demo-task-${index}`, sourceRowIndex: index, status: 'completed', artifactCount: 1 })) });
+      if (match[2] === 'artifacts') return sendJson(res, { artifacts: run.rows.map((_row, index) => ({ artifactId: `demo-artifact-${index}`, sourceRowIndex: index, accessUrl: `http://127.0.0.1:${port}/artifacts/${index}.svg`, mimeType: 'image/svg+xml' })) });
+      return sendJson(res, { status: 'completed', totalTasks: run.rows.length, completedTasks: run.rows.length, failedTasks: 0, actualCost: run.rows.length * 3_800_000 });
+    }
+    const art = path.match(/^\/artifacts\/(\d+)\.svg$/);
+    if (req.method === 'GET' && art) {
+      res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' });
+      return res.end(artwork(Number(art[1])));
+    }
+    return sendJson(res, { message: 'mock route not found' }, 404);
+  } catch (error) {
+    return sendJson(res, { message: error instanceof Error ? error.message : String(error) }, 400);
+  }
+});
+
+server.listen(port, '127.0.0.1', () => {
+  console.log(`胜算云本地演示上游：http://127.0.0.1:${port}/batch/v1`);
+  console.log('仅用于 UI 预览，不会请求真实胜算云或产生费用。');
+});
```

---

### Incident Patch 2: `9675b5af` (2026-09-29)
**Commit Message**: feat(website): add Fluxion AI sponsor

**File**: `website/src/components/home/SponsorStrip.tsx` (modified, +12/-2)
```diff
@@ -2,6 +2,7 @@ import { ArrowRight, Heart } from "lucide-react";
 import { Link } from "react-router-dom";
 import { useLanguage } from "@/i18n/LanguageProvider";
 import { sponsorLogo, sponsorUrl, sponsors } from "@/content/sponsors";
+import { cn } from "@/lib/utils";
 
 export function SponsorStrip() {
   const { t, lang, prefix } = useLanguage();
@@ -28,8 +29,17 @@ export function SponsorStrip() {
               className="flex w-[260px] items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-primary/40"
             >
               {s.logo ? (
-                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-white">
-                  <img src={sponsorLogo(s, lang)} alt={s.name} className="h-8 w-8 object-contain" />
+                <span
+                  className={cn(
+                    "grid h-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-white",
+                    s.logoShape === "wide" ? "w-20 px-1.5" : "w-11",
+                  )}
+                >
+                  <img
+                    src={sponsorLogo(s, lang)}
+                    alt={s.name}
+                    className={cn("object-contain", s.logoShape === "wide" ? "h-9 w-16" : "h-8 w-8")}
+                  />
                 </span>
               ) : (
                 <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-xl ${s.accent ?? "from-primary to-fuchsia-500"}`}>
```

**File**: `website/src/components/sponsors/SponsorCard.tsx` (modified, +11/-2)
```diff
@@ -62,8 +62,17 @@ export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
       {/* 紧凑卡：logo + 名称 + 一句话，一行 4 张；完整介绍在悬停浮层里 */}
       <div className="flex items-center gap-3 pr-6">
         {s.logo ? (
-          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm">
-            <img src={sponsorLogo(s, lang)} alt={s.name} className="h-9 w-9 object-contain" />
+          <span
+            className={cn(
+              "grid h-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm",
+              s.logoShape === "wide" ? "w-20 px-1.5" : "w-12",
+            )}
+          >
+            <img
+              src={sponsorLogo(s, lang)}
+              alt={s.name}
+              className={cn("object-contain", s.logoShape === "wide" ? "h-10 w-16" : "h-9 w-9")}
+            />
           </span>
         ) : (
           <span
```

**File**: `website/src/components/sponsors/SponsorPerksTable.tsx` (modified, +12/-2)
```diff
@@ -2,6 +2,7 @@ import { ExternalLink, Sparkles } from "lucide-react";
 import { CopyButton } from "@/components/ui/copy-button";
 import { useLanguage } from "@/i18n/LanguageProvider";
 import { sponsorLogo, sponsorUrl, sponsors } from "@/content/sponsors";
+import { cn } from "@/lib/utils";
 
 export function SponsorPerksTable() {
   const { t, lang } = useLanguage();
@@ -36,8 +37,17 @@ export function SponsorPerksTable() {
                 <td className="px-5 py-4">
                   <span className="flex items-center gap-3">
                     {sp.logo ? (
-                      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm">
-                        <img src={sponsorLogo(sp, lang)} alt={sp.name} className="size-9 object-contain" />
+                      <span
+                        className={cn(
+                          "grid h-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm",
+                          sp.logoShape === "wide" ? "w-20 px-1.5" : "w-11",
+                        )}
+                      >
+                        <img
+                          src={sponsorLogo(sp, lang)}
+                          alt={sp.name}
+                          className={cn("object-contain", sp.logoShape === "wide" ? "h-9 w-16" : "size-9")}
+                        />
                       </span>
                     ) : (
                       <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg shadow-sm ${sp.accent ?? "from-primary to-fuchsia-500"}`}>
```

**File**: `website/src/content/sponsors.ts` (modified, +27/-1)
```diff
@@ -3,7 +3,7 @@ import type { Language } from "@/i18n/translations";
 /**
  * 赞助商数据。
  *
- * 当前赞助商：APINEBULA（旗舰，银河录像局旗下 AI 聚合平台）、优云智算（UCloud 旗下 AI 云平台）、Cubence（API 中转服务商）、火山引擎（字节跳动云服务，中英文分别对应 volcengine.com / byteplus.com 两个不同站点）、LanoX AI（全球模型聚合，500+ 模型）、胜算云（面向 AI 原生团队的模型 API 聚合 + 企业级网关）、APIMart（AI 图片/视频生成低价 API）、秘塔科技（MiniMax H3 视频生成 API）、PackyCode（API 中转，统一域名统一密钥）。
+ * 当前赞助商：APINEBULA（旗舰，银河录像局旗下 AI 聚合平台）、优云智算（UCloud 旗下 AI 云平台）、Cubence（API 中转服务商）、火山引擎（字节跳动云服务，中英文分别对应 volcengine.com / byteplus.com 两个不同站点）、LanoX AI（全球模型聚合，500+ 模型）、胜算云（面向 AI 原生团队的模型 API 聚合 + 企业级网关）、APIMart（AI 图片/视频生成低价 API）、秘塔科技（MiniMax H3 视频生成 API）、PackyCode（API 中转，统一域名统一密钥）、Fluxion AI（全球主流 AI 模型统一 API）。
  * 均为真实付费赞助，非占位样例。新增赞助商时按 Sponsor 结构追加即可。
  * 已下架：RootFlowAI、CCSub（2026-08）、多元探索（2026-08-17，赞助到期）、AICodeMirror（2026-09-14）——赞助身份与
  * 曝光位一并摘除，但它们在 Studio 里仍是可用供应商（已配过 key 的用户不该被搞坏）。
@@ -22,6 +22,8 @@ export interface Sponsor {
   accent?: string;
   /** 小 logo 图（public 目录下的路径），优先于 badge 作为头像。中英文品牌不同时传 LocalizedText（如火山引擎/BytePlus） */
   logo?: string | LocalizedText;
+  /** 横版品牌图使用更宽的白色承载区，避免暗色主题下深色字标看不清 */
+  logoShape?: "square" | "wide";
   /** 大屏 banner 图（public 目录下的路径）。旗舰赞助商用,全宽展示 */
   banner?: string;
   /** 跳转链接。多数赞助商中英文共用同一个链接；少数品牌中国大陆站点和国际站点是不同域名（如火山引擎/BytePlus），此时传 LocalizedText，按当前语言取值 */
@@ -260,6 +262,30 @@ export const sponsors: Sponsor[] = [
       en: "$1 in free credits plus a discount on your first top-up",
     },
   },
+  {
+    id: "fluxionai",
+    name: "Fluxion AI",
+    badge: "F",
+    accent: "from-blue-600 to-violet-600",
+    logo: "/sponsors/logo-fluxionai-icon.png",
+    logoShape: "wide",
+    url: "https://fluxionai.space/register?source=github&campaign=agencyagents&promo=agencyagents",
+    tier: "standard",
+    since: "2026-09",
+    featured: false,
+    tagline: {
+      zh: "一个入口，接入并管理全球主流 AI 模型",
+      en: "One gateway to access and manage the world’s leading AI models",
+    },
+    description: {
+      zh: "感谢 Fluxion AI 赞助本项目！Fluxion AI 面向个人开发者、技术团队与企业，通过统一 API 接入并管理全球主流 AI 模型；通过多线路动态调度提升可用性，模型表现、响应时间与费用透明可查。根据不同模型与线路，API 调用成本较官方或基准价格可降低 40%—98%。",
+      en: "Thanks to Fluxion AI for sponsoring this project! Fluxion AI gives individual developers, engineering teams and enterprises one unified API for accessing and managing leading AI models worldwide. Dynamic routing across multiple channels improves availability, while model performance, latency and costs remain transparent. Depending on the model and route, API costs can be 40%–98% lower than official or benchmark pricing.",
+    },
+    perk: {
+      zh: "通过专属链接注册，即可获得 $3.88 API 额度",
+      en: "Sign up via our exclusive link to receive $3.88 in API credit",
+    },
+  },
 ];
 
 export function sponsorsByTier(tier: SponsorTier) {
```

---

### Incident Patch 3: `8834c9eb` (2026-09-29)
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

**File**: `test/empty-output.ts` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@ await test('只流了 reasoning_content、正文为空 → 抛错并点明"只
     let msg = '';
     try { await c.chat('sys', 'hi', { provider: 'openai', model: 'm' } as LLMConfig); } catch (e) { msg = e instanceof Error ? e.message : String(e); }
     assert(/思考内容/.test(msg) && /reasoning/.test(msg), `应点明只返回了思考内容，实际：${msg.slice(0, 120)}`);
+    // #184：报错只说"关闭 thinking"，用户无从下手（真机：智谱 coding plan 上 GLM 吐了 6 万字符
+    // reasoning、正文 0 字）。要说清**在哪关** —— 工作流里通用的入口是 llm.params 透传
+    assert(/llm\.params/.test(msg) && /thinking/.test(msg),
+      `#184: 要给出可照做的关法（llm.params 透传），实际：${msg.slice(0, 200)}`);
   } finally { srv.close(); }
 });
 
```

---

### Incident Patch 4: `176d084b` (2026-09-28)
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

### Incident Patch 5: `755a8c1c` (2026-09-25)
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
+    "test": "npm run -s typecheck:test && npx tsx test/run.ts && npx tsx test/assert.ts && npx tsx test/condition.ts && npx tsx test/cli.ts && npx tsx test/cli-dx.ts && npx tsx test/cli-base.ts && npx tsx test/spawn-cli.ts && npx tsx test/antigravity-cli.ts && npx tsx test/codebuddy-cli.ts && npx tsx test/claude-code-cwd.ts && npx tsx test/claude-code-stream.ts && npx tsx test/llm-override.ts && npx tsx test/cline-cli.ts && npx tsx test/opencode-cli.ts && npx tsx test/dsh-cli.ts && npx tsx test/sponsor-guide.ts && npx tsx test/providers-manifest.ts && npx tsx test/claude-base-url.ts && npx tsx test/anthropic-providers.ts && npx tsx test/depends-on-ids.ts && npx tsx test/parse-inputs.ts && npx tsx test/compose.ts && npx tsx test/demo.ts && npx tsx test/factory-custom.ts && npx tsx test/azure-compat.ts && npx tsx test/endpoint-fallback.ts && npx tsx test/newapi-usage.ts && npx tsx test/claude-cli-probe.ts && npx tsx test/env-proxy.ts && npx tsx test/proxy-setting.ts && npx tsx test/image-step.ts && npx tsx test/video-step.ts && npx tsx test/local-sdcpp.ts && npx tsx test/tts-step.ts && npx tsx test/preflight.ts && npx tsx test/media-spend-loop.ts && npx tsx test/e2e-image.ts && npx tsx te
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
+    const graph2 = await (await fetch(`${base}/api/workflows/graph?file=${encodeURIComponent(wfPath)}`)).json() as {
+      nodes: { id: string }[]; edges: { source: string; target: string }[];
+    };
+    const res2 = await fetch(`${base}/api/workflows/graph`, {
+      method: 'POST', headers: { 'Content-Type': 'application/json' },
+      body: JSON.stringify({ file: wfPath, name: '画布交付物', nodes: graph2.nodes, edges: graph2.edges }),
+    });
+    const body2 = await res2.json() as { droppedDeliverables?: string[] };
+    assert(res2.status === 200 && body2.droppedDeliverables === undefined, '交付物没被删时不报摘除');
+    assert(/deliverables:\s*\n?\s*-?\s*draft|deliverables: \[draft\]/.test(readFileSync(wfPath, 'utf-8')), '原样保留 deliverables');
+  }
+} catch (e) {
+  assert(false, `异常: ${e instanceof Error ? e.message : String(e)}`);
+} finally {
+  try { server?.kill(); } catch { /* 已经没了 */ }
+  rmSync(root, { recursive: true, force: true });
+}
+
+console.log(`\n  结果: ${passed} 通过, ${failed} 失败\n`);
+process.exit(failed > 0 ? 1 : 0);
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

**File**: `website/src/lib/studio.ts` (modified, +2/-1)
```diff
@@ -795,7 +795,8 @@ export const api = {
   workflowGraph: (file: string) => getJSON<CanvasGraphResponse>(`/workflows/graph?file=${encodeURIComponent(file)}`),
   saveWorkflowGraph: (body: { file?: string; name: string; nodes: CanvasNode[]; edges: CanvasEdge[]; baseYaml?: string }) =>
     // autoFixes：保存时服务端确定性补上的缺失 depends_on 边（#91，同 compose #87 修复链）
-    postJSON<{ file: string; overwritten: boolean; errors?: string[]; autoFixes?: { step: string; addedDep: string }[] }>("/workflows/graph", body),
+    // droppedDeliverables：画布里删掉的步骤正好是声明的交付物时，服务端把它从 deliverables 里摘掉（画布没有编辑该字段的入口）
+    postJSON<{ file: string; overwritten: boolean; errors?: string[]; autoFixes?: { step: string; addedDep: string }[]; droppedDeliverables?: string[] }>("/workflows/graph", body),
   runs: () => getJSON<RunSummary[]>("/runs"),
   run: (id: string) => getJSON<RunSummary>(`/runs/${encodeURIComponent(id)}`),
   deleteRun: (id: string) => delJSON<{ ok: boolean }>(`/runs/${encodeURIComponent(id)}`),
```

---

### Incident Patch 6: `43aec9f3` (2026-09-25)
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

### Incident Patch 7: `083a398a` (2026-09-25)
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

### Incident Patch 8: `e03ac998` (2026-09-24)
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

### Incident Patch 9: `997d67fa` (2026-09-24)
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

### Incident Patch 10: `64c41fc0` (2026-09-24)
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
-      for (const [id, node] of dag.nodes) {
-        if (rerun.has(id)) continue;
-        if ((node.step.depends_on ?? []).some((d) => rerun.has(d))) { rerun.add(id); grew = true; }
+      for (const id of [...skip]) {
+        const deps = dag.nodes.get(id)?.step.depends_on ?? [];
+        if (deps.some((d) => known.has(d) && !skip.has(d) && !benign.has(d))) {
+          skip.delete(id);
+          staleDownstream.push(id);
+          grew = true;
+        }
       }
     }
-  } else {
-    // 没有依赖信息（旧调用方只给 levels）时退回层级语义
-    for (let li = fromLevel; li < dag.levels.length; li++) for (const id of dag.levels[li]) rerun.add(id);
   }
-  // 只留**当前工作流里还存在**的 step：用户改了 id / 删了步骤后，上一次档案里那些名字已经没用了。
-  // 留着不会出错（执行器按 id 查，查不到就是没跳过），但会让"跳过已完成步骤: N 个"虚报——
-  // 真机：把 polish 改名成 polish_v2 再 resume，明明只复用了 1 步，却说跳过 2 个。
-  const known = dag.nodes ? new Set(dag.nodes.keys()) : new Set(dag.levels.flat());
-  const skip = new Set<string>();
-  for (const id of completed) if (!rerun.has(id) && known.has(id)) skip.add(
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

### Incident Patch 11: `f240609d` (2026-09-24)
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

### Incident Patch 12: `40992fff` (2026-09-24)
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

---

### Incident Patch 13: `fd5bfa3d` (2026-09-24)
**Commit Message**: fix: 可分享报告里漏出步骤头 —— 写了 acceptance 的步骤全中招 (#152)

stripStepHeader 只认**单行**头（`^>\s[^\n]*\n\s*\n---`）。但步骤文件的头部经常不止
一行：写了 acceptance 多一行验收标准、核验过多一行核验结果、机械断言返工过再多一行。
于是这些步骤的整块头原样漏进报告正文——一段引用块里重复着报告页自己已经渲染的
角色名和耗时，后面还跟着一条 --- 分隔线。acceptance 是主推功能，真实运行里一抓一大把。

改成剥连续的 `>` 行块（后面仍必须跟空行 + ---，正文开头自己写的引用块不误伤）。
真机复验：同一次运行的 report.html 从 5525 → 5423 字节，"步骤 2/2" 不再出现在正文里。

test/share-report.ts 从 2 条加到 5 条（单行 / 两行 / 四行 / 无头 / 用户自己的引用块）。

**File**: `src/cli/share-report.ts` (modified, +6/-2)
```diff
@@ -46,9 +46,13 @@ const esc = (s: string): string =>
   s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
 
 /** 步骤 md 开头的元信息引用块（"> 🦴 **人类学家** | 步骤 1/1 | 10.1s" + "---"）——
- *  报告页自己会渲染这些信息，正文里再出现一遍就是噪音。 */
+ *  报告页自己会渲染这些信息，正文里再出现一遍就是噪音。
+ *
+ *  头部**不止一行**：写了 acceptance 的步骤多一行验收标准、核验过的多一行核验结果、
+ *  机械断言返工过的再多一行。老写法只认单行（`^>\s[^\n]*\n`），于是这些步骤的整块头
+ *  原样漏进报告正文——而 acceptance 是主推功能，真实运行里一抓一大把。 */
 export function stripStepHeader(md: string): string {
-  return md.replace(/^>\s[^\n]*\n\s*\n---\s*\n\s*/, '');
+  return md.replace(/^(?:>[^\n]*\n)+\s*\n---\s*\n\s*/, '');
 }
 
 function mdToHtml(md: string, resolveAsset?: (src: string) => string | null): string {
```

**File**: `test/share-report.ts` (modified, +5/-0)
```diff
@@ -13,6 +13,11 @@ console.log('\n─── share-report ───');
 const md = '> 🦴 **人类学家** | 步骤 1/1 | 10.1s\n\n---\n\n正文开始';
 assert(stripStepHeader(md) === '正文开始', '剥掉步骤头引用块与分隔线');
 assert(stripStepHeader('普通正文') === '普通正文', '无步骤头时原样返回');
+// 头部不止一行：写了 acceptance 多一行、核验过多一行、断言返工过再多一行。
+// 老写法只认单行，于是这些步骤的整块头原样漏进报告正文（acceptance 是主推功能，真实运行里一抓一大把）。
+assert(stripStepHeader('> 🦴 **x** | 步骤 1/1\n> ✅ 验收标准: 必须提到长城\n\n---\n\n正文开始') === '正文开始', '两行头（带验收标准）也剥干净');
+assert(stripStepHeader('> 🦴 **x**\n> ✅ 验收标准: a\n> 🔍 验收 ✓\n> 📏 机械断言 ✓（返工 1 轮后达标）\n\n---\n\n正文开始') === '正文开始', '四行头（标准+核验+断言）也剥干净');
+assert(stripStepHeader('> 这是用户自己写的引用\n\n正文') === '> 这是用户自己写的引用\n\n正文', '正文开头的引用块不配 --- 分隔线时不动它');
 
 // ── 基本渲染 ──
 const html = renderShareReport({
```

---

### Incident Patch 14: `10d519ec` (2026-09-24)
**Commit Message**: fix: 团队名 / 提示词名也按字节截断（#148 的同一类问题，另外两个入口） (#149)

#148 修了运行目录名，但用户起的名字变成文件名的地方还有两个，同样没限长：

- ~/.ao/teams/<slug>.team.yaml —— 实测 20 次「很长的团队名」→ 370 字节
- ~/.ao/prompts/<slug>.prompt.json —— 同样的名字 → 492 字节

Linux（Docker 镜像、NAS 部署）NAME_MAX=255 字节，两者都会在保存时抛 ENAMETOOLONG；
Studio 的「存为团队」「存提示词」都能输中文长名，所以不是假想。macOS 按字符算 255，
本机照存不误——又是本地绿、线上炸。

- clipBytes 从 output/reporter.ts 搬到 utils/paths.ts（路径工具的家），reporter 原样转出，
  老导入不破；
- team.ts / prompt.ts 两个 slugify 都截到 120 字节，按码点走，不切碎汉字。

Studio 保存工作流（web/server.js）用的是 slice(0,60) 字符 ≈ 180 字节，没超，不动；
~/.ao/roles 的 slugifyRoleId 只留 ASCII 并截 48，也没问题——查过了。

test/team.ts、test/prompt.ts 各加一条（字节上限 / 保留前缀 / 不切碎 / 真能存下来），
变异验证：还原后分别 370、492 字节。

**File**: `src/cli/prompt.ts` (modified, +3/-1)
```diff
@@ -12,6 +12,7 @@
  */
 import { homedir } from 'node:os';
 import { join, resolve } from 'node:path';
+import { clipBytes } from '../utils/paths.js';
 import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
 import { createConnector } from '../connectors/factory.js';
 import type { LLMConfig } from '../types.js';
@@ -46,7 +47,8 @@ export function slugify(name: string): string {
     .replace(/[\s/\\:*?"<>|]+/g, '-')
     .replace(/-+/g, '-')
     .replace(/^-|-$/g, '');
-  return s || 'prompt';
+  // 同 team：这是文件名（<slug>.prompt.json），Linux 的 NAME_MAX 按字节算 255
+  return clipBytes(s, 120).replace(/-+$/, '') || 'prompt';
 }
 
 // ── 优化：meta-prompt → LLM ──────────────────────────────────────────────────
```

**File**: `src/cli/team.ts` (modified, +4/-1)
```diff
@@ -13,6 +13,7 @@
  */
 import { homedir } from 'node:os';
 import { join, resolve, basename, isAbsolute } from 'node:path';
+import { clipBytes } from '../utils/paths.js';
 import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
 import yaml from 'js-yaml';
 import { parseWorkflow } from '../core/parser.js';
@@ -50,7 +51,9 @@ export function slugify(name: string): string {
     .replace(/[\s/\\:*?"<>|]+/g, '-')   // 路径/空白 → 连字符
     .replace(/-+/g, '-')
     .replace(/^-|-$/g, '');
-  return s || 'team';
+  // 再按**字节**截断：这是要当文件名用的（<slug>.team.yaml），而 Linux 的 NAME_MAX 是
+  // 255 字节——一个 86 字的中文团队名就会让保存抛 ENAMETOOLONG（macOS 按字符算，本机试不出来）
+  return clipBytes(s, 120).replace(/-+$/, '') || 'team';
 }
 
 /** 从一个 workflow 中抽取团队（去重角色，保序，剥掉任务/inputs）。 */
```

**File**: `src/output/reporter.ts` (modified, +2/-20)
```diff
@@ -5,7 +5,8 @@ import { stripImageDataUris } from '../utils/vision.js';
 import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
 import { join, relative } from 'node:path';
 import { deliverableSteps, type WorkflowResult, type StepVerification } from '../types.js';
-import { displayPath as showPath } from '../utils/paths.js';
+import { displayPath as showPath, clipBytes } from '../utils/paths.js';
+export { clipBytes } from '../utils/paths.js';
 import type { DAGNode } from '../types.js';
 
 /**
@@ -25,25 +26,6 @@ export function formatVerification(v: StepVerification | undefined, en = false):
 /**
  * 保存工作流执行结果到文件
  */
-/**
- * 按 UTF-8 字节截断，且不切碎字符（中文一字 3 字节、emoji 4 字节）。
- * 目录名的长度上限在**字节**上：Linux（Docker 镜像、NAS 部署）NAME_MAX=255 字节，
- * 一个 86 个汉字的工作流名就会让 mkdir 抛 ENAMETOOLONG——而那时整条工作流已经跑完、
- * 钱已经花了，产物却存不下来。macOS 的 APFS 按**字符**算 255，所以本机试不出来。
- */
-export function clipBytes(s: string, maxBytes: number): string {
-  if (Buffer.byteLength(s) <= maxBytes) return s;
-  let out = '';
-  let used = 0;
-  for (const ch of s) {          // 按码点遍历：别把一个汉字/emoji 从中间切开
-    const b = Buffer.byteLength(ch);
-    if (used + b > maxBytes) break;
-    out += ch;
-    used += b;
-  }
-  return out;
-}
-
 export function saveResults(result: WorkflowResult, outputDir: string): string {
   const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
   // 清洗工作流名再作目录名：Windows 禁止 \ / : * ? " < > | 及控制字符，run-role 默认名
```

**File**: `src/utils/paths.ts` (modified, +19/-0)
```diff
@@ -53,3 +53,22 @@ export function displayPath(p: string): string {
   // 只按"有没有空白"决定要不要引号：Windows 路径里的反斜杠不能动，引号里它就是字面量
   return /\s/.test(pick) ? `"${pick.replace(/"/g, '\\"')}"` : pick;
 }
+
+/**
+ * 按 UTF-8 字节截断，且不切碎字符（中文一字 3 字节、emoji 4 字节）。
+ * 目录名的长度上限在**字节**上：Linux（Docker 镜像、NAS 部署）NAME_MAX=255 字节，
+ * 一个 86 个汉字的工作流名就会让 mkdir 抛 ENAMETOOLONG——而那时整条工作流已经跑完、
+ * 钱已经花了，产物却存不下来。macOS 的 APFS 按**字符**算 255，所以本机试不出来。
+ */
+export function clipBytes(s: string, maxBytes: number): string {
+  if (Buffer.byteLength(s) <= maxBytes) return s;
+  let out = '';
+  let used = 0;
+  for (const ch of s) {          // 按码点遍历：别把一个汉字/emoji 从中间切开
+    const b = Buffer.byteLength(ch);
+    if (used + b > maxBytes) break;
+    out += ch;
+    used += b;
+  }
+  return out;
+}
```

**File**: `test/prompt.ts` (modified, +12/-0)
```diff
@@ -33,6 +33,18 @@ test('slugify 处理中文/空格', () => {
   assert(slugify('我的 提示词/库') === '我的-提示词-库', `got ${slugify('我的 提示词/库')}`);
 });
 
+test('超长中文名按字节截断——它是文件名，Linux 上 255 字节是硬限', () => {
+  // <slug>.prompt.json 落在 ~/.ao/prompts：Linux（Docker / NAS）NAME_MAX=255 **字节**，
+  // 86 个汉字就超了，保存会抛 ENAMETOOLONG。macOS 按字符算 255，本机试不出来 → 直接盯字节。
+  const slug = slugify('很长的提示词名字'.repeat(20));
+  assert(Buffer.byteLength(`${slug}.prompt.json`) <= 255, `文件名不超 255 字节（实际 ${Buffer.byteLength(`${slug}.prompt.json`)}）`);
+  assert(slug.startsWith('很长的提示词名字'), '保留可辨认的前缀');
+  assert(Buffer.from(slug, 'utf-8').toString('utf-8') === slug, '没有把汉字从中间切开');
+  const now = new Date().toISOString();
+  const path = savePrompt({ kind: 'prompt', name: '很长的提示词名字'.repeat(20), mode: 'user', created: now, versions: [{ content: 'x', source: 'original', created: now }] }, dir);
+  assert(existsSync(path), '真能存下来');
+});
+
 test('buildOptimizeMetaPrompt 区分 system/user 与中英', () => {
   assert(buildOptimizeMetaPrompt('system', 'zh').includes('人设'), 'zh system mentions 人设');
   assert(buildOptimizeMetaPrompt('user', 'zh').includes('任务'), 'zh user mentions 任务');
```

**File**: `test/team.ts` (modified, +11/-0)
```diff
@@ -71,6 +71,17 @@ await test('slugify 处理中文/空格/路径字符', () => {
   assert(slugify('  ') === 'team', 'empty → team');
 });
 
+await test('超长中文名要按字节截断——它是文件名，Linux 上 255 字节是硬限', () => {
+  // <slug>.team.yaml 落在 ~/.ao/teams：Linux（Docker / NAS）NAME_MAX=255 **字节**，
+  // 86 个汉字就超了，保存会抛 ENAMETOOLONG。macOS 按字符算 255，本机试不出来 → 直接盯字节。
+  const slug = slugify('很长的团队名'.repeat(20));
+  assert(Buffer.byteLength(`${slug}.team.yaml`) <= 255, `文件名不超 255 字节（实际 ${Buffer.byteLength(`${slug}.team.yaml`)}）`);
+  assert(slug.startsWith('很长的团队名'), '保留可辨认的前缀');
+  assert(!/\uFFFD/.test(slug) && Buffer.from(slug, 'utf-8').toString('utf-8') === slug, '没有把汉字从中间切开');
+  const saved = saveTeam(extractTeamFromWorkflow(wfPath, { name: '很长的团队名'.repeat(20) }), dir);
+  assert(existsSync(saved), '真能存下来');
+});
+
 await test('extractTeamFromWorkflow 去重并保序', () => {
   const tm = extractTeamFromWorkflow(wfPath);
   assert(tm.kind === 'team', 'kind=team');
```

**File**: `test/version-and-dirs.ts` (modified, +2/-1)
```diff
@@ -11,7 +11,8 @@ import { resolve } from 'node:path';
 import { tmpdir } from 'node:os';
 import { join } from 'node:path';
 import { isNewer } from '../src/utils/version-check.js';
-import { saveResults, clipBytes } from '../src/output/reporter.js';
+import { saveResults } from '../src/output/reporter.js';
+import { clipBytes } from '../src/utils/paths.js';
 import type { WorkflowResult } from '../src/types.js';
 
 let passed = 0;
```

---

### Incident Patch 15: `5f1d2945` (2026-09-24)
**Commit Message**: fix: 运行目录名按字节截断——Linux 上长中文工作流名会让存档整个失败 (#148)

目录名的长度上限在**字节**上：Linux（Docker 镜像、NAS 部署）NAME_MAX=255 字节，
86 个汉字的工作流名就超了，mkdirSync 抛 ENAMETOOLONG。而那时整条工作流已经跑完、
token 和视频的钱都花了，产物却一个字都存不下来。

本机试不出来：macOS 的 APFS 按**字符**算 255，600 字节的目录名照建不误（实测
200 个汉字 OK）。真机跑了一条 113 字/293 字节名字的工作流，在这台机器上一切正常——
正是这种"本地绿、线上炸"的形态。

saveResults 的 safeName 之前只清洗非法字符、不限长度。加 clipBytes()：按 UTF-8
字节截到 120，且按码点遍历、不把汉字/emoji 从中间切开（切碎会产生非法 UTF-8 文件名）。
120 + 时间戳 20 + 撞名后缀 ≈ 143 字节，离 255 有富余，Windows 整条路径也留得下余量。

test/version-and-dirs.ts 加 5 条（字节上限 / 保留可辨认前缀 / 不切碎字符 / 内容照写 /
clipBytes 本身）。变异验证：还原后目录名 620 字节——在 CI 的 ubuntu 上这条会直接
ENAMETOOLONG 炸在 saveResults 里。

**File**: `src/output/reporter.ts` (modified, +29/-5)
```diff
@@ -25,15 +25,39 @@ export function formatVerification(v: StepVerification | undefined, en = false):
 /**
  * 保存工作流执行结果到文件
  */
+/**
+ * 按 UTF-8 字节截断，且不切碎字符（中文一字 3 字节、emoji 4 字节）。
+ * 目录名的长度上限在**字节**上：Linux（Docker 镜像、NAS 部署）NAME_MAX=255 字节，
+ * 一个 86 个汉字的工作流名就会让 mkdir 抛 ENAMETOOLONG——而那时整条工作流已经跑完、
+ * 钱已经花了，产物却存不下来。macOS 的 APFS 按**字符**算 255，所以本机试不出来。
+ */
+export function clipBytes(s: string, maxBytes: number): string {
+  if (Buffer.byteLength(s) <= maxBytes) return s;
+  let out = '';
+  let used = 0;
+  for (const ch of s) {          // 按码点遍历：别把一个汉字/emoji 从中间切开
+    const b = Buffer.byteLength(ch);
+    if (used + b > maxBytes) break;
+    out += ch;
+    used += b;
+  }
+  return out;
+}
+
 export function saveResults(result: WorkflowResult, outputDir: string): string {
   const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
   // 清洗工作流名再作目录名：Windows 禁止 \ / : * ? " < > | 及控制字符，run-role 默认名
   // "专家咨询: <role>" 含冒号会让 win 上 mkdirSync 直接失败。统一在此清洗，对全平台/全工作流生效。
-  const safeName = (result.name || 'workflow')
-    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-')
-    .replace(/\s+/g, '-')
-    .replace(/-+/g, '-')
-    .replace(/^-+|-+$/g, '') || 'workflow';
+  // 再截到 120 字节：加上 "-2026-09-24T06-17-50"（20）与可能的 "-2" 后缀仍远低于 255 字节，
+  // Windows 那边整条路径也留得下余量。
+  const safeName = clipBytes(
+    (result.name || 'workflow')
+      .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-')
+      .replace(/\s+/g, '-')
+      .replace(/-+/g, '-')
+      .replace(/^-+|-+$/g, '') || 'workflow',
+    120,
+  ).replace(/-+$/, '') || 'workflow';
   // 时间戳只到秒：同一秒内跑完的两次同名工作流会写进同一个目录，后一次把前一次的
   // steps/*.md、summary.md、metadata.json 盖掉，还留下前一次多出来的步骤文件成为混合体。
   // Studio 允许并行跑，所以这不是假想。撞上就加后缀，绝不覆盖已有的运行。
```

**File**: `test/version-and-dirs.ts` (modified, +20/-2)
```diff
@@ -5,13 +5,13 @@
  *  - 运行目录时间戳只到秒：同一秒跑完的两次同名工作流写进同一个目录，后一次把前一次盖掉
  *    （Studio 允许并行跑，所以不是假想）。
  */
-import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
+import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
 import { spawnSync } from 'node:child_process';
 import { resolve } from 'node:path';
 import { tmpdir } from 'node:os';
 import { join } from 'node:path';
 import { isNewer } from '../src/utils/version-check.js';
-import { saveResults } from '../src/output/reporter.js';
+import { saveResults, clipBytes } from '../src/output/reporter.js';
 import type { WorkflowResult } from '../src/types.js';
 
 let passed = 0;
@@ -47,6 +47,24 @@ console.log('\n─── 同一秒的两次运行不互相覆盖 ───');
   rmSync(out, { recursive: true, force: true });
 }
 
+console.log('\n─── 运行目录名按字节截断（Linux 上 255 字节是硬限） ───');
+{
+  // Linux（Docker 镜像、NAS 部署）NAME_MAX=255 **字节**：86 个汉字的工作流名就会让 mkdir
+  // 抛 ENAMETOOLONG——而那时整条工作流已经跑完、钱已经花了，产物却存不下来。
+  // macOS 的 APFS 按**字符**算 255，本机试不出来，所以这里直接盯字节数。
+  const out = mkdtempSync(join(tmpdir(), 'ao-longname-'));
+  const longName = '很'.repeat(200);
+  const r = { name: longName, success: true, steps: [{ id: 'a', role: 'r', status: 'completed', output: 'x', duration: 1, tokens: { input: 1, output: 1 } }], totalDuration: 1, totalTokens: { input: 1, output: 1 } } as unknown as WorkflowResult;
+  const dir = saveResults(r, out);
+  const base = dir.split('/').pop() as string;
+  assert(Buffer.byteLength(base) <= 255, `目录名不超过 255 字节（实际 ${Buffer.byteLength(base)}）`);
+  assert(base.startsWith('很很很'), '保留可辨认的前缀');
+  assert(!/\uFFFD/.test(base) && base.replace(/-[\d:T-]+$/, '').split('').every((c) => c === '很'), '不把汉字从中间切开');
+  assert(existsSync(join(dir, 'metadata.json')), '内容照常写进去');
+  assert(clipBytes('abc', 10) === 'abc' && clipBytes('很很很', 4) === '很', `clipBytes 按字节切且不切碎（实际 ${clipBytes('很很很', 4)}）`);
+  rmSync(out, { recursive: true, force: true });
+}
+
 console.log('\n─── 凭证：~/.ao/.env 是用户级的，换个目录也认 ───');
 {
   // teams / prompts / roles 都住 ~/.ao，凭证却只读当前目录的 .env——换个目录敲 ao 就"没凭证"。
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

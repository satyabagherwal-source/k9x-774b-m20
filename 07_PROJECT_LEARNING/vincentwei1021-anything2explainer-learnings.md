# Forensic Learning Record (Deep Inspection): Vincentwei1021/anything2explainer

> **Canonical Artifact**: `07_PROJECT_LEARNING/vincentwei1021-anything2explainer-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Vincentwei1021/anything2explainer](https://github.com/Vincentwei1021/anything2explainer))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:20:52.142Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Vincentwei1021/anything2explainer`
- **Description**: Topic in, narrated explainer video out. A Claude Code / Codex skill that turns any topic into a black-canvas motion-graphics explainer video with TTS voiceover, subtitles and a chapter progress bar. Chinese or English; every frame drawn in code with Remotion.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2200 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/rag/shots_src/G0/Overlay.tsx`
```
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {GlitchIn, kf, emphasisPulse, easeInOutPow, SENTENCES, TOTAL_FRAMES, FONT_HEAVY, FONT_WIDE, FONT_ORB} from '../../common';
import {SUBS} from '../../common/subs';
import {CText, TechText, Pill, TopCapsule, ArrowH, PURPLE, PURPLE_TECH, GREY, GREY_MID, WHITE, GLOW_PURPLE_S, fadeIn, slideUp, clampFrames} from './util';

// ---------- 时间轴查询 ----------
export const S = (id: string) => {
  const s = SENTENCES.find((x) => x.id === id);
  if (!s) throw new Error(`no sentence ${id}`);
  return s;
};
/** 某句里某个字幕块的起始帧（按文本匹配） */
export const subStart = (id: string, text: string) => {
  const s = S(id);
  const e = SUBS.find((x) => x.from >= s.from && x.from <= s.to && x.text === text);
  return e ? e.from : s.from;
};

/** 12 帧加速上出：n<0 → 原位；位移 (n/11)^2·440px，透明度 1−(n/11)^1.6 → 末帧 0（QC v1 C1 #1/#2） */
const exitOut = (n: number) => {
  if (n < 0) return {dy: 0, op: 1};
  const t = Math.min(1, n / 11);
  return {dy: t * t * 440, op: 1 - Math.pow(t, 1.6)};
};

// ---------- 片头 ----------
export const TITLE_RANGE: [number, number] = [1, S('S01').from - 9];
export const Title: React.FC = () => {
  const N = useCurrentFrame() + TITLE_RANGE[0];
  const [a, b] = TITLE_RANGE;
  const exitN = N - (b - 11); // 末 12 帧上摇出画（QC v1：原 8 帧只走了 59px/63% 亮度就被硬切）
  const dy = -exitOut(exitN).dy;
  const op = exitOut(exitN).op;
  const glow = 0.5 + 0.5 * Math.sin((N / 30) * Math.PI); // 缓慢呼吸
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateY(${dy}px)`, opacity: op}}>
      <GlitchIn N={N} f0={a + 11} rgbSplit={6} slices={14} seed={3}>
        <div style={{position: 'absolute', left: 0, top: 268, width: 1280, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 26}}>
          <span style={{fontFamily: FONT_WIDE, fontSize: 118, color: WHITE, lineHeight: 1, letterSpacing: 6, textShadow: `0 0 ${18 + 14 * glow}px rgba(102,45,248,${0.55 + 0.3 * glow}), 6px 6px 0 ${PURPLE}`}}>RAG</span>
          <span style={{fontFamily: FONT_HEAVY, fontWeight: 900, fontSize: 96, color: WHITE, lineHeight: 1, transform: 'scaleX(0.85)', transformOrigin: '0 100%', letterSpacing: 2, WebkitTextStroke: '1px #000', paintOrder: 'stroke fill'}}>与知识库</span>
        </div>
      </GlitchIn>
      <div style={{position: 'absolute', inset: 0, opacity: fadeIn(N - (a + 25), 12), transform: `translateY(${slideUp(N - (a + 25), 60)}px)`}}>
        <TechText cx={640} cy={446} text="Retrieval-Augmented Generation" fontSize={38} scaleX={0.82} weight={700} />
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: fadeIn(N - (a + 40), 12)}}>
        <CText cx={640} cy={520} size={30} weight={500} color={GREY} letterSpacing={6}>
          让大模型开卷考试
        </CText>
        <div style={{position: 'absolute', left: 520, top: 496, width: 240, height: 2, background: 'rgba(255,255,255,0.35)', transform: `scaleX(${fadeIn(N - (a + 40), 16)})`}} />
      </div>
    </div>
  );
};

// ---------- 章节卡 ----------
export const CHAPTER_CARDS: Array<{n: number; title: string; tech: string; from: number; to: number}> = [
  {n: 2, title: '知识库构建', tech: 'Indexing', from: S('S10').to + 3, to: S('S11').from - 9},
  {n: 3, title: '检索与生成', tech: 'Retrieval & Generation', from: S('S20').to + 3, to: S('S21').from - 9},
  {n: 4, title: '评估与进阶', tech: 'Evaluation & Advanced RAG', from: S('S30').to + 3, to: S('S31').from - 9},
];
export const ChapterCard: React.FC<{card: (typeof CHAPTER_CARDS)[number]}> = ({card}) => {
  const N = useCurrentFrame() + card.from;
  const n = N - card.from;
  const exitN = N - (card.to - 11);
  const dy = -exitOut(exitN).dy;
  const op = exitOut(exitN).op;
  const w = kf(n, [[0, 0], [20, 300]], easeInOutPow(2.5));
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateY(${dy}px)`, opacity: op}}>
      <div style={{position: 'absolute', opacity: fadeIn(n, 8)}}>
        <CText cx={640} cy={268} size={54} weight={700} family={FONT_ORB} color={PURPLE_TECH} letterSpacing={4} shadow="0 0 14px rgba(102,45,248,.6)">{`0${card.n}`}</CText>
      </div>
      <GlitchIn N={N} f0={card.from + 3} rgbSplit={5} seed={card.n}>
        <CText cx={640} cy={372} size={80} weight={900} scaleX={0.85} letterSpacing={3} style={{WebkitTextStroke: '1px #000', paintOrder: 'stroke fill'}}>{card.title}</CText>
      </GlitchIn>
      <div style={{position: 'absolute', left: 640 - w / 2, top: 428, width: w, height: 3, background: WHITE, opacity: 0.85}} />
      <div style={{position: 'absolute', opacity: fadeIn(n - 10, 10)}}>
        <TechText cx={640} cy={470} text={card.tech} fontSize={32} scaleX={0.82} />
      </div>
    </div>
  );
};

// ---------- 顶部 HUD 胶囊 ----------
export type HudEntry = {from: number; to: number; text: string; tech?: string; w?: number};
export const HUD: HudEntry[] = [
  {from: S('S01').from, to: S('S05').to, text: '大模型的短板'},
  {from: S('S06').from, to: S('S07').to, text: '开卷考试'},
  {from: S('S08').from, to: S('S10').to, text: 'RAG', tech: 'Retrieval-Augmented Generation'}, // QC v1：提前到句首，避免 SC08 光条段 HUD 空缺
  // QC v1 C2：章节卡出画到句首之间顶部空 8 帧 → 第 2/3/4 章 HUD 从章节卡结束的下一帧开始
  {from: S('S11').from - 8, to: S('S20').to + 2, text: '知识库构建', tech: 'Indexing'},
  {from: S('S21').from - 8, to: S('S30').to + 2, text: '检索与生成', tech: 'Retrieval & Generation'},
  {from: S('S31').from - 8, to: S('S34').to, text: '评估', tech: 'Evaluation'},
  {from: S('S35').from + 4, to: S('S38').to, text: '进阶', tech: 'Advanced RAG'}, // +4：错开 SC35「RAG」大字 glitch（QC v1 C4）
  {from: S('S39').from + 4, to: S('S41').to, text: '长上下文 vs RAG'}, // +4：错开 SC39 入场暗帧（QC v2 复验）
  {from: S('S42').from + 4, to: S('S44').to, text: '总结'}, // +4：同上
];
// 同章相邻条目之间不留空档（G1 提示 742–751 无胶囊）：上一条延到下一条 from−1；跨章节卡（间隔 ≥30 帧）保持空档，由章节卡接管
for (let i = 0; i < HUD.length - 1; i++) if (HUD[i + 1].from - HUD[i].to < 30) HUD[i].to = HUD[i + 1].from - 1;
export const HUD_RANGE: [number, number] = [HUD[0].from, HUD[HUD.length - 1].to];
export const Hud: React.FC = () => {
  const N = useCurrentFrame() + HUD_RANGE[0];
  const e = HUD.find((h) => N >= h.from && N <= h.to);
  if (!e) return null;
  // QC v1 C3：进章节卡前 HUD 一帧消失 → 末 8 帧淡出（只对跨章节卡的条目生效：下一条 from 与本条 to 间隔 ≥30）
  const idx = HUD.indexOf(e);
  const nextGap = idx < HUD.length - 1 ? HUD[idx + 1].from - e.to : 999;
  const fadeTail = nextGap >= 30 ? 1 - clampFrames(N - (e.to - 8), 8) : 1;
  const w = e.w ?? Math.max(216, Math.round(e.text.replace(/[^一-龥]/g, '').length * 34 + e.text.replace(/[一-龥\s]/g, '').length * 20 + (e.text.match(/\s/g)?.length ?? 0) * 10 + 60));
  // 第 2、3 章胶囊下方紧接流程轨，副标只在无流程轨时显示
  return <TopCapsule N={N} f0={e.from} text={e.text} w={w} tech={e.tech} opacity={fadeTail} />;
};

// ---------- 流程轨（第 2、3 章）----------
export type RailSpec = {steps: string[]; switches: number[]; from: number; to: number};
export const RAILS: RailSpec[] = [
  {steps: ['解析', '切块', '向量化', '建索引', '更新'], switches: [S('S12').from, S('S13').from, S('S16').from, S('S18').from, S('S20').from], from: S('S12').from - 8, to: S('S20').to + 2},
  {steps: ['理解问题', '检索', '重排', '组装', '生成'], switches: [S('S22').from, S('S23').from, S('S26').from, S('S28').from, S('S29').from], from: S('S22').from - 8, to: S('S29').to + 2},
];
const RAIL_CX = [240, 440, 640, 840, 1040];
const RAIL_W = 150, RAIL_H = 44, RAIL_Y = 118;
export const Rail: React.FC<{spec: RailSpec}> = ({spec}) => {
  const N = useCurrentFrame() + spec.from;
  let active = -1;
  spec.switches.forEach((f, i) => { if (N >= f) active = i; });
  const railOut = 1 - clampFrames(N - (spec.to - 8), 8); // 末 8 帧淡出
  return (
    <div style={{position: 'absolute', inset: 0, opacity: railOut}}>
      {spec.steps.map((t, i) => {
        const state = i === active ? 'active' : i < active ? 'done' : 'todo';
        const pulse = i === active ? emphasisPulse(N - spec.switches[i], {peak: 1.1, up: 10, hold: 3, down: 10}) : 1;
        const fill = state === 'active' ? PURPLE : state === 'done' ? '#2A2A2A' : '#000';
        const stroke = state === 'acti
```

### Core Architecture Module: `examples/rag/shots_src/G0/Preview.tsx`
```
import React from 'react';
import {RagStage} from '../../Main';
import {SHOTS_G0, SHOTS_G0_TOP, BG_G0} from './index';
export const PreviewG0: React.FC = () => <RagStage shots={[...SHOTS_G0, ...SHOTS_G0_TOP]} bg={BG_G0} />;

```

### Core Architecture Module: `examples/rag/shots_src/G0/index.ts`
```
import type {ShotDef, BgSpec} from '../../common';
import {TOTAL_FRAMES} from '../../common';
import {Title, TITLE_RANGE, ChapterCard, CHAPTER_CARDS, Hud, HUD_RANGE, Rail, RAILS, Ending, ENDING_RANGE, EndingTop, ENDING_TOP_RANGE} from './Overlay';
// G0 = 主会话覆盖层：片头 / 章节卡 ×3 / 顶部 HUD 胶囊 / 第 2、3 章流程轨 / 片尾压黑。层序最低（Main 里排最前）。
export const SHOTS_G0: ShotDef[] = [
  {id: 'G0-Title', from: TITLE_RANGE[0], to: TITLE_RANGE[1], Comp: Title},
  ...CHAPTER_CARDS.map((c) => ({id: `G0-Chapter${c.n}`, from: c.from, to: c.to, Comp: (() => ChapterCard({card: c})) as unknown as React.FC})),
  {id: 'G0-Hud', from: HUD_RANGE[0], to: HUD_RANGE[1], Comp: Hud},
  ...RAILS.map((r, i) => ({id: `G0-Rail${i + 2}`, from: r.from, to: r.to, Comp: (() => Rail({spec: r})) as unknown as React.FC})),
];
// 压在全部内容组之上的覆盖层（Main 把它排在 G1–G8 之后）：片尾压黑（进度条之下）+ 末 30 帧连进度条一起压黑（aboveBar）
export const SHOTS_G0_TOP: ShotDef[] = [
  {id: 'G0-Ending', from: ENDING_RANGE[0], to: ENDING_RANGE[1], Comp: Ending},
  {id: 'G0-EndingTop', from: ENDING_TOP_RANGE[0], to: ENDING_TOP_RANGE[1], Comp: EndingTop, layer: 'aboveBar'},
];
export const BG_G0: BgSpec[] = [
  {from: 1, to: 10, fog: false, stars: 'none'},
  {from: TOTAL_FRAMES - 40, to: TOTAL_FRAMES, fog: false, stars: 'none'},
];

```

### Core Architecture Module: `examples/rag/shots_src/G0/util.ts`
```
export * from '../../ui';
import {clamp01} from '../../common';
/** 0→1 线性，len 帧 */
export const clampFrames = (n: number, len: number) => clamp01(n / len);

```

### Core Architecture Module: `examples/rag/shots_src/G1/Preview.tsx`
```
import React from 'react';
import {RagStage} from '../../Main';
import {SHOTS_G0, BG_G0} from '../G0';
import {SHOTS_G1, BG_G1} from './index';
// 组预览：本组镜头 + G0 覆盖层（章节卡/HUD/流程轨），无音频
export const PreviewG1: React.FC = () => <RagStage shots={[...SHOTS_G0, ...SHOTS_G1]} bg={[...BG_G0, ...BG_G1]} />;

```

### Core Architecture Module: `examples/rag/shots_src/G1/SC01.tsx`
```
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Scene1Frame} from './layout';

/** SC01 大模型与三个短板（78–167）：86 LLMIcon 缩放入场 + 柔光脉冲 + 冒星；116 三个虚线框自右滑入（2 帧错峰）+ 编号徽章 8 帧淡入（本镜头无 glitch，协议 §8） */
const F0 = 78;
export const SC01: React.FC = () => {
  const N = useCurrentFrame() + F0;
  return <Scene1Frame N={N} />;
};

```

### Core Architecture Module: `examples/rag/shots_src/G1/SC02.tsx`
```
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT_HEAVY, powOutRemain, clamp01} from '../../common';
import {Svg, LineArrow, CText, Pill, PURPLE, GREY, GREY_MID, WHITE, ORANGE, fadeIn, scaleIn, abs} from '../../ui';
import {Scene1Frame, LabelTab, BOXES, pastOpacity, mixHex} from './layout';

/**
 * SC02 短板① 知识截止（168–302）。节拍：176 第一 / 186 截止日期 / 233 之后发生的事 / 275 一概不知。
 * 框① 内：176「知识截止」标签 GlitchIn 12 帧（本镜头唯一 glitch，白名单 §8）；水平时间轴 x 730→1150（LineArrow draw-on 20 帧），中点 x940 竖直红标「训练截止」自下弹起，
 * 左侧 3 个白事件点随轴尖端经过依次亮起，右侧 3 个灰「?」点 233 起 2 帧错峰缩放出现；
 * 275「一概不知」：LLM 神经元闪灰一次 + 紫柔光熄灭 8 帧再回 + 三个「?」275/278/281 依次白闪放大一次（QC v1：原仅 4 个神经元点变灰，不可察）。
 */
const F0 = 168;
const B = BOXES[0];
const AXIS_Y = B.y + 78; // 278
const X0 = 730, X1 = 1150, CUT_X = 940;
const LEFT_DOTS = [768, 822, 876];
const RIGHT_DOTS = [1000, 1052, 1104];
/** 275 起三个「?」依次白闪：起点 275+3i，10 帧三角脉冲 0→1→0 */
const Q_FLASH_AT = 275;
const qFlash = (N: number, i: number) => {
  const n = N - (Q_FLASH_AT + 3 * i);
  if (n <= 0 || n >= 10) return 0;
  return n < 5 ? n / 5 : 1 - (n - 5) / 5;
};

/** 框① 内容（SC03/SC04 复用，随 pastOpacity 变暗；全部为 N 的纯函数） */
export const Box1Content: React.FC<{N: number}> = ({N}) => {
  const op = pastOpacity(0, N);
  const p = clamp01((N - 186) / 20);
  const tipX = X0 + (X1 - X0) * p;
  const nCut = N - 196; // 轴尖端过中点后红标弹起
  const cutOp = fadeIn(nCut, 6);
  const cutDy = 50 * powOutRemain(nCut, 14, 2.5);
  return (
    <div style={{opacity: op}}>
      <LabelTab N={N} f0={176} i={0} text="知识截止" w={124} glitch />
      <Svg bloom={false}>
        {p > 0 ? <LineArrow x0={X0} y0={AXIS_Y} x1={X1} y1={AXIS_Y} p={p} rodW={3} headL={18} headW={20} /> : null}
        {LEFT_DOTS.map((x, i) => {
          const o = clamp01((tipX - x) / 14);
          if (o <= 0) return null;
          return <circle key={i} cx={x} cy={AXIS_Y} r={7 * (0.4 + 0.6 * o)} fill={WHITE} opacity={o} />;
        })}
        {/* 训练截止：竖直红刻线 */}
        {cutOp > 0 ? <line x1={CUT_X} y1={AXIS_Y - 30 + cutDy * 0.4} x2={CUT_X} y2={AXIS_Y + 12} stroke={ORANGE} strokeWidth={3} opacity={cutOp} /> : null}
        {RIGHT_DOTS.map((x, i) => {
          const s = scaleIn(N - (233 + 2 * i), 10);
          if (s <= 0) return null;
          const q = qFlash(N, i);
          return <circle key={i} cx={x} cy={AXIS_Y} r={14 * s * (1 + 0.3 * q)} fill="#000" stroke={mixHex(GREY, WHITE, q)} strokeWidth={2 + q} opacity={clamp01(0.2 + s)} style={q > 0 ? {filter: `drop-shadow(0 0 ${Math.round(6 * q)}px rgba(255,255,255,${(0.8 * q).toFixed(2)}))`} : undefined} />;
        })}
      </Svg>
      {RIGHT_DOTS.map((x, i) => {
        const s = scaleIn(N - (233 + 2 * i), 10);
        if (s <= 0) return null;
        const q = qFlash(N, i);
        return (
          <CText key={i} cx={x} cy={AXIS_Y} size={22} weight={800} color={mixHex(GREY, WHITE, q)} dy={-1} shadow={q > 0 ? `0 0 8px rgba(255,255,255,${(0.8 * q).toFixed(2)})` : undefined} style={{transform: `translate(-50%,-50%) scale(${(s * (1 + 0.3 * q)).toFixed(3)})`}}>
            ?
          </CText>
        );
      })}
      {cutOp > 0 ? (
        <div style={{opacity: cutOp}}>
          <Pill x={CUT_X - 56} y={AXIS_Y - 62 + cutDy} w={112} h={30} fill={ORANGE} sw={2} text="训练截止" fontSize={22} weight={700} family={FONT_HEAVY} textDy={-1} />
        </div>
      ) : null}
    </div>
  );
};

/** 275 神经元闪灰：紫→灰 6 帧、再回紫 6 帧 */
export const llmAccentAt = (N: number, f0: number) => {
  const n = N - f0;
  if (n < 0 || n > 12) return PURPLE;
  const k = n <= 6 ? n / 6 : 1 - (n - 6) / 6;
  return mixHex(PURPLE, GREY_MID, k);
};

/** 275 LLM 紫柔光熄灭：4 帧降到 0.1、保持 4 帧、6 帧回到 1（与神经元闪灰同步，放大「一概不知」的可见面积） */
export const llmHaloAt = (N: number, f0: number) => {
  const n = N - f0;
  if (n < 0 || n > 14) return 1;
  if (n < 4) return 1 - 0.9 * (n / 4);
  if (n < 8) return 0.1;
  return 0.1 + 0.9 * ((n - 8) / 6);
};

export const SC02: React.FC = () => {
  const N = useCurrentFrame() + F0;
  return (
    <div style={abs(0, 0, 1280, 720)}>
      <Scene1Frame N={N} accent={llmAccentAt(N, 275)} haloK={llmHaloAt(N, 275)} />
      <Box1Content N={N} />
    </div>
  );
};

```

### Core Architecture Module: `examples/rag/shots_src/G1/SC03.tsx`
```
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT_HEAVY, powOutRemain, clamp01} from '../../common';
import {Svg, Cross, CText, Pill, DocIcon, GREY_LIGHT, WHITE, ORANGE, fadeIn, scaleIn, abs, SoftIn} from '../../ui';
import {Scene1Frame, LabelTab, BOXES, LLM, pastOpacity} from './layout';
import {Box1Content} from './SC02';

/**
 * SC03 短板② 私有数据（303–445）。节拍：311 第二 / 320 内网文档 / 380 会议纪要。
 * 框② 内一行：311「读不到私有数据」标签 GlitchIn 12 帧（本镜头唯一 glitch，白名单 §8）；DocIcon×2 + 锁 +「内网文档」（326 SoftIn）｜ 「会议纪要」文档（带「昨天」橙标）。
 * 框与 LLM 之间虚线 330 起自框向 LLM 画出；380 会议纪要文档自右滑入 → 402 起 12 帧向左"试图"靠近 LLM → 406 红叉 draw-on 拦住 → 414 回弹 4px。
 */
const F0 = 303;
const B = BOXES[1];
const ROW_Y = B.y + 50; // 390 行中线
const DOC_W = 36, DOC_H = 46;
const DOC_Y = ROW_Y - DOC_H / 2; // 367
const LOCK_X = 834, LOCK_Y = ROW_Y - 15;
const MEET_X = 1016; // 左推 36 回弹 4 后停在 984，不与「内网文档」文字（右缘 ≈958）重叠
const LINE_X1 = B.x - 2; // 718（框左边）
const LINE_X0 = LLM.cx + LLM.size / 2 + 6; // 491（LLM 右边）
const CROSS_X = 604;

/** 简笔锁（白线）：锁体 26×20 r4 + 半圆锁梁 */
const Lock: React.FC<{x: number; y: number; color?: string}> = ({x, y, color = WHITE}) => (
  <svg width={30} height={34} viewBox="0 0 30 34" style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
    <path d="M7,15 V10 A8,8 0 0 1 23,10 V15" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    <rect x={2} y={14} width={26} height={19} rx={4} fill="#000" stroke={color} strokeWidth={2.5} />
    <circle cx={15} cy={23} r={2.4} fill={color} />
  </svg>
);

/** 缩放入场包装（以 (cx,cy) 为原点） */
const ScaleAt: React.FC<{cx: number; cy: number; s: number; children: React.ReactNode}> = ({cx, cy, s, children}) => (s <= 0 ? null : <div style={{...abs(0, 0, 1280, 720), transformOrigin: `${cx}px ${cy}px`, transform: s < 1 ? `scale(${s.toFixed(3)})` : undefined, opacity: clamp01(0.15 + 1.4 * s)}}>{children}</div>);

/** 框② 内容 + 虚线/红叉（SC04 复用，随 pastOpacity 变暗） */
export const Box2Content: React.FC<{N: number}> = ({N}) => {
  const op = pastOpacity(1, N);
  // 虚线：330 起 16 帧自框向 LLM 画出
  const lp = clamp01((N - 330) / 16);
  const lineX0 = LINE_X1 - (LINE_X1 - LINE_X0) * lp;
  // 红叉 406 起 12 帧
  const xp = clamp01((N - 406) / 12);
  // 会议纪要：380 滑入 Δ300 → 402 起 12 帧左移 36 → 414 回弹 4
  const nm = N - 380;
  const slide = 300 * powOutRemain(nm, 22, 2.5);
  const push = -36 * Math.pow(clamp01((N - 402) / 12), 2);
  const bounce = 4 * (1 - powOutRemain(N - 414, 6, 2));
  const meetDx = slide + push + bounce;
  const meetOp = fadeIn(nm, 8);
  return (
    <div style={{opacity: op}}>
      <LabelTab N={N} f0={311} i={1} text="读不到私有数据" w={196} glitch />
      {/* 内网文档 ×2（320/322 缩放入场）+ 锁（326 SoftIn 8 帧淡入上浮）+ 文字 */}
      {[0, 1].map((i) => {
        const x = 742 + 44 * i;
        return (
          <ScaleAt key={i} cx={x + DOC_W / 2} cy={ROW_Y} s={scaleIn(N - (320 + 2 * i), 21)}>
            <DocIcon x={x} y={DOC_Y} w={DOC_W} h={DOC_H} lines={4} sw={2} />
          </ScaleAt>
        );
      })}
      <SoftIn N={N} f0={326}>
        <Lock x={LOCK_X} y={LOCK_Y} />
        <CText cx={914} cy={ROW_Y} size={22} weight={600} color={WHITE} dy={-1}>
          内网文档
        </CText>
      </SoftIn>
      <Svg bloom={false}>
        {lp > 0 ? <line x1={LINE_X1} y1={ROW_Y} x2={lineX0} y2={ROW_Y} stroke={GREY_LIGHT} strokeWidth={2} strokeDasharray="8 7" opacity={0.9} /> : null}
        {xp > 0 ? <Cross cx={CROSS_X} cy={ROW_Y} size={40} sw={6} p={xp} /> : null}
      </Svg>
      {/* 会议纪要文档 + 「昨天」橙标（随文档左推/回弹）+ 文字（只随滑入，不随左推） */}
      {nm >= 0 ? (
        <div style={{opacity: meetOp}}>
          <DocIcon x={MEET_X + meetDx} y={DOC_Y} w={DOC_W} h={DOC_H} lines={4} sw={2} accent={ORANGE} />
          <Pill x={MEET_X + meetDx + 14} y={DOC_Y - 14} w={60} h={28} fill={ORANGE} sw={2} text="昨天" fontSize={22} weight={700} family={FONT_HEAVY} textDy={-1} />
          <CText cx={1108 + slide} cy={ROW_Y} size={22} weight={600} color={WHITE} dy={-1}>
            会议纪要
          </CText>
        </div>
      ) : null}
    </div>
  );
};

export const SC03: React.FC = () => {
  const N = useCurrentFrame() + F0;
  return (
    <div style={abs(0, 0, 1280, 720)}>
      <Scene1Frame N={N} />
      <Box1Content N={N} />
      <Box2Content N={N} />
    </div>
  );
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15** (2026-09-23): **feat(tts): 片头口播 T 句——第一句读标题，不留无声片头**
  *Symptoms*: ## 改了什么  `narration.txt` 第一个 `# CHAPTER` 之前的句子现在会被识别为**片头口播 T 句**（id `T01`，不占 S 编号，已写好的分镜令牌不用重排）：压在片头卡上、字幕带照常出，片头自动延长到它讲完——不再有无声干等的片头。  - **tts_build.py**：parse() 用 `seen_chapter` 标记片头句（chapter 0）；id 走独立 T 计数器；timeline.md 章节列对 T 句显示「片头」 - **render_storyboard.py**：令牌正则支持 `{T01.from}`（写进常驻层表的片头行） - **Overlay.tsx**：TITLE_RANGE 取第一章第一句（chapter>0）而非首句，有 T 句时片头区间随之延长；无 T 句时行为不变 - **文档**：SKILL 阶段 2 加「首行片头口播一句」；narration-storyboard 格式节新增片头行写法与 T 句说明（样例 rag 做于该规则之前、片头无声，已注明勿照抄这点）  ## 为什么  此前解说词直接从 `# CHAPTER 1` 开始，片头卡 LEAD 那 2 秒是纯无声画面。把「读标题」做成第一句口播，片头从第一帧起就有声音，也顺带给全片一个天然的钩子位。  ## 验证  - `npx tsc --noEmit` 通过 - parse() 冒烟测试：含片头句的 narration.txt 正确产出 `title=True, chapter=0`，段末/章末逻辑不受影响 - 令牌正则：`{T01.from}` / `{T01.from+6}` / `{T99.c3}` 均匹配，原有令牌不受影响 - 本改动已在 4 部成片中实际使用（见 FavorPan/anything2explainer 的 lessons 第五～九片记录）  ## 说明  - 令牌正则放宽为 `(?:S|T)\d\d`，旧的 `{S12.from}` 等用法完全不受影响 - 样例 `examples/rag/narration.txt` 做于该规则之前（片头无声），文档已注明「勿照抄这点」——是否顺手给样例也补一句片头口播，听维护者的 
  **Post-Mortem & Fix Analysis**:
  > 感谢你做了片头口播的实现和验证！目前我还是倾向于保留主仓库现有的片头镜头与时间轴设计，暂不引入这项改动，因此这个 PR 我先不合并。你可以在自己的 fork 里继续实现和使用片头口播版本；也感谢你把实践经验和代码分享出来。

- **Issue #13** (2026-09-20): **Withdrawn**
  *Symptoms*: 

- **Issue #12** (2026-09-23): **Permission request: commercial use for a monetized YouTube channel and paid Udemy courses**
  *Symptoms*: Hello, and thank you for building and sharing this — the code-drawn scene approach is a genuinely different answer to the cost problem of AI video.  I run a Turkish educational YouTube channel (KEŞİF) and publish courses on Udemy. Both are monetized: the channel earns AdSense revenue and the courses are sold.  The repository is released under PolyForm Noncommercial 1.0.0, which reserves commercial use for the author's authorization. Before installing anything into my production pipeline I would like to ask directly rather than assume:  **Would you grant permission to use anything2explainer to produce videos for a monetized YouTube channel and for paid Udemy courses?**  A few details in case they matter to your answer:  - Content is educational: book summaries and critical reviews of popular non-fiction, plus programming and AI courses. - Every video we publish carries an explicit AI-disclosure card and sets `containsSyntheticMedia` on upload. We would keep doing that. - We would credit the project (and @omergocmen, whose fork added Turkish support) in the video descriptions if you would like that. - If full commercial use is not something you want to grant, a narrower permission would also help — for example non-monetized videos only, or a paid/commercial license if you offer one.  If the answer is no, that is completely fine and I will respect it; I am asking precisely so that I do not use your work outside the terms you intended.  Thank you for your time. 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for asking before using the project commercially. Please email me at vincentwei1021@gmail.com with a brief outline of your intended use: who would use the toolkit (you individually or an organization), the kinds of videos/courses you plan to produce, how they would be monetized, your expected scale, and whether you would redistribute the toolkit or any modified version of it. That will help me review the request and discuss permission or terms with you directly. Thanks!

- **Issue #11** (2026-09-21): **Cinematic 10-12 second video, highly detailed digital illustration style matching the HUMAY logo. A beautiful young Central Asian woman with traditional ornate headband, coin jewelry, long braided hair and face tattoos turns her head slowly toward the camera. Large majestic golden phoenix wings spread behind her. She powerfully flaps the wings like a rising phoenix, the wings expand and fill the entire frame with golden feathers, bright orange-red flames and flying sparks. The wings then open wide, revealing a dramatic sunset road stretching into the distance. Several women on motorcycles ride away into the golden sunset. On the main woman’s back the exact HUMAY logo is clearly visible as a glowing emblem. Epic, mystical, powerful atmosphere, cinematic lighting, smooth camera movement, high detail, 4k**
  *Symptoms*: ![IMG_20260918_072730_633.jpg](https://github.com/user-attachments/assets/1f313346-c060-4109-8012-a080c14e4a43)  Cinematic 10-12 second video, highly detailed digital illustration style matching the HUMAY logo. A beautiful young Central Asian woman with traditional ornate headband, coin jewelry, long braided hair and face tattoos turns her head slowly toward the camera. Large majestic golden phoenix wings spread behind her. She powerfully flaps the wings like a rising phoenix, the wings expand and fill the entire frame with golden feathers, bright orange-red flames and flying sparks. The wings then open wide, revealing a dramatic sunset road stretching into the distance. Several women on motorcycles ride away into the golden sunset. On the main woman’s back the exact HUMAY logo is clearly visible as a glowing emblem. Epic, mystical, powerful atmosphere, cinematic lighting, smooth camera movement, high detail, 4k

- **Issue #10** (2026-09-23): **feat: add Russian narration and subtitle support**
  *Symptoms*: ## Summary  - add `lang: 'ru'` as a first-class narration mode - detect Cyrillic narration and select Edge TTS `ru-RU-DmitryNeural` in `TTS_ENGINE=auto` - preserve spaces when joining Russian subtitle chunks for synthesis - add bundled-font Cyrillic width metrics in Python and TypeScript - add a 40-character Russian subtitle budget and a Russian-specific safe layout above the progress bar - update build, storyboard, typography, and QC guidance for Russian projects - add reproducible Python and TypeScript regression tests  ## Validation  - `python -m unittest discover -s tests -p 'test_*.py' -v` — 4 tests passed - `cd template && npm run typecheck` — passed - `cd template && npm run test:russian` — passed - generated a fresh project from the updated template — passed - generated real Russian Edge TTS audio and timeline from generic test narration — passed - rendered and visually checked Russian subtitle stills — no clipping, broken glyphs, or progress-bar overlap - `git diff --check` — passed  ## Notes  - Edge TTS is cloud-based and sends narration text to Microsoft; the documentation recommends a local engine or user-provided WAV for sensitive material. - The bundled Noto Sans SC font contains the Russian alphabet including `ё`, but not `₽`; the documentation recommends spelling out the currency or verifying a fallback font. 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the thoughtful Russian-language work and the tests you included. For now, I do not plan to add and maintain Russian support in the main repository, so I will not merge this PR. Please feel free to keep a Russian-supporting version in your own fork for users who need it. I appreciate the contribution and the care you put into validating it.

- **Issue #9** (2026-09-18): **落位停留：静止上限 3 s、末拍停 1–1.5 s 再离场、镜头≠句、句间空白 20 帧**
  *Symptoms*: ## 背景 用户看第五片《Eval-First / ADLC》成片的两条反馈： 1. 整体节奏过快、章节太短，**每个镜头动画刚落位就切到下一镜头，几乎没有停留**； 2. 三轮紫光横扫（登场型高光时刻的开场）**只该给最重要的标题和概念，目前有些频繁**。  对比样片《RAG》后确认文案不是原因（每块字幕 2.0 s，比样片 1.6 s 还慢）。根因在画面规则： - 「一句一个镜头」把文案里的短促收束句（47 句里 9 句 <3 s）放大成 ≤2.5 s 却带完整入场 + 离场的碎镜头；样片同样的短句是并进相邻镜头的 - 镜头区间贴着语音（末 8 帧归零），配音末字一落就开始离场 - 「不许静止 >30 帧」+ 每章 ≥3 次运镜把剩下的停留填满：47 镜头 34 处推近，6 处推近排在末拍推完直接离场 - 扫光：分镜把每章 1–2 个高光时刻全写成扫光开场，大数字型 / 论点型也带扫光，实测 8 处（样片 1 处）  成片实测（英文版 v4，新版 `motion_check.py`）：40 个离场镜头里 26 个末拍稳定期 = 0，只有 7 个 ≥30 帧。  ## 规则（用户裁定） - 静止上限 30 帧 → **3 s**；**不为凑指标给静止物体加漂浮 / 飘动 / 呼吸** - 末拍元素落位后 **停 30–45 帧（1–1.5 s）再离场**；稳定期不新增元素、不运镜；运镜不进末拍 - **镜头 ≠ 句**：短句并入相邻镜头当节拍，单镜头 ≥120 帧，承接优先于清场 - 允许成片比纯语音长 5–8% 换停留：`tts_build.py` 句间空白默认 10 → 20 帧，`timeline.md` 加「末块」列并列出 <45 帧的句 - 章数受时长约束：<3 分钟单章无章节卡，3–5 分钟 3–4 章每章 ≥60 s - 每章 ≤1 个高光时刻、按类型编排；**三轮扫光（连带 `StageLine` / `GhostText`）全片 ≤2 处**：核心概念首次登场 + 可选结尾回扣，分镜全局约束新增**扫光白名单**  ## 改动 - 规则：`SKILL.md`（硬性原则 6 改写、7 加扫光上限、新增 8、确认点 1 表加章数列、阶段 2 / 3 / 5b、终检、质量标尺）、`composition-and-light.md` §3 与 §7、`motion-vocabulary.md`、`narration-storyboard.md`、`agent-build-rules.md`、`agent-qc-rules.md`、`prompts.md`、`style-guide.md`、README / README_ZH - 工具：`motion_check.py` 判据改为最长静止 ≤3 s + 末拍稳定期 hold ≥30 帧（静止占比只报不判），新增 `--shots index` / `--root`；`tts_build.py` GAP 20 + 末块体检与终端提示；`frame_metrics.py` 静止标记 >90 帧；`selfcheck.py` 新增扫光白名单计数与 `--root` - 第一个 commit 是上一轮遗留在工作区的模板小修（HUD 换词叠影、HeroGlow 带色灭光、TagBlock / TechText 按语言默认 scaleX、Check / Cross p=0 守卫）  ## 验证 - 停留：在 Eval-First 英文版的独立副本上只动 G1 做单变量实验，S03 / S04 / 

- **Issue #7** (2026-09-13): **skill 通用化 + PR #4 跟进：去掉题材固定章法、清理项目专有引用、补 ARM TTS 缓存键**
  *Symptoms*: ## 背景  PR #4 合入后（rebase merge）留下几处可修的小问题；同时对整个 skill 做了一遍「是否通用」的审查，发现协议、模板与文档里混进了具体项目（RAG 样片、第四片 AI 系统性能片）和具体使用场景的东西，最突出的是把「讲一项技术」的章法当成了所有题材的结构。本 PR 一起处理。  ## PR #4 跟进（Linux / Raspberry Pi）  - `tts_build.py` 缓存签名补上 `KOKORO_ONNX_LANG` / `PIPER_VOICE_NAME`：换 piper 模型或 onnx 语言不再命中旧缓存。 - `PRONOUNCE` 表清空（原内容是某一片的 CUDA / NIXL 专用词），并在文件头、`synth_piper` / `synth_kokoro_onnx` 注明它只对 kokoro/misaki 语法生效。 - kokoro 缺包提示补 Linux `apt` 与 ARM 替代引擎；espeak-ng 安装按平台分写（docs 同步）。 - `remotion.config.ts`：`REMOTION_GL` 从 `as never` 改为白名单校验，非法值直接报错并列出合法项；`tsconfig` 把 `remotion.config.ts` 收进 include，`tsc --noEmit` 现在覆盖它。  ## skill 通用性  **不再规定一种结构** - `narration-storyboard.md` §1：删掉「第 1 章为什么 / 中间流水线 / 末章评估进阶」的固定章法，改为「结构由主线决定」：先按 `narration-guidance.md` 找唯一主线，章 = 主线上的一步；每章一个论点句（即高光时刻候选）；示例语境是画面层面的硬约束，比喻按需不按章配；只有真有先后顺序的步骤才用流程轨。 - §4 镜头模式表左列从领域概念（向量空间 / 索引 / 提示词输出 / 评估指标…）改成题材无关的**画面关系**（点集与邻近 / 层级结构 / 请求→处理→带依据的回应 / 两组并列清单…），样片只作为每种关系的一个实现；新增「两种做法看起来像、其实不同」一行；删掉悬空的「原片 seg_02」引用。 - `research-brief.md` 重写：处境与问题 / 起源 / 运作方式（按题材选主轴）/ 边界与对比 / 争议 / 真实案例 / 数字清单 / 术语；小节按题材取舍，占位符加 `<语言> <N> <M>`，附技术类 / 历史人物事件类 / 概念原理类 / 争议类各要补什么。 - 新增 `reference/narration-guidance.md`（12 条口播写作原则 + 起飞前检查表），接进 SKILL.md 阶段 2 与关键文件表。  **协议与模板去项目专有** - `agent-build-rules.md`：去掉「RAG/ 一律指项目根」；流程轨 / 内容区从「第 2、3 章」改为「分镜表常驻层标了轨的章」；入场 / 离场规则改写为当前实际做法（SoftIn 默认、Δ≤120、硬切前归零）。`agent-qc-rules.md` 同步。 - `template/src/config.ts` 默认值改为中性占位（title / credit / chapterTech / hud / rails），示例写在注释里；`ui.tsx` / `fx.tsx` / `Overlay.tsx` / `lib.tsx` / `easing.ts`

- **Issue #6** (2026-09-13): **Commercial licensing: is a commercial license available for the toolkit?**
  *Symptoms*: Hi Vincent — thanks for open-sourcing this. I opened #1 earlier with three fixes found while running a full 5-minute Chinese film end to end; this is a separate, licensing question.  The LICENSE reads:  > Videos produced with this toolkit belong to their creators. This license governs the toolkit itself: noncommercial use is free; any commercial use of the toolkit requires prior authorization from the author.  We are a small U.S. law firm. We would like to use the toolkit to produce short Chinese-language educational videos about U.S. legal procedure, published on our own channels and firm website. Since that content is firm-branded and has an anticipated commercial application, it is not a "Personal Use" under PolyForm §Personal Uses, and a law firm is not one of the entity types listed under §Noncommercial Organizations. So as we read it, we need your prior authorization.  Three questions:  1. Do you grant commercial authorization, and on what terms? A one-off fee, a per-project arrangement, attribution-only, or something else? 2. Does authorization need to cover only our use of the toolkit, or does anything about the published videos need to carry attribution? Your LICENSE says the videos belong to their creators, so we read this as toolkit-use only — please correct us if that is wrong. 3. If you would rather not grant commercial use at all, that is a perfectly fine answer and we will not use it commercially. We would just like to know before publishing anything rather tha
  **Post-Mortem & Fix Analysis**:
  > Hi Hongchang,  Thank you for the PR! I’m open to discussing a written authorization for LawMay P.C.  Could you email me at [vincentwei1021@gmail.com] with a brief description of how you plan to use anything2explainer—who will use it, whether it will be integrated into an internal workflow, and whether the videos will be produced solely for your firm’s own channels and website? We can discuss the scope, fee, and your attribution question privately there.  Please include a link to this Issue so I can connect the conversation. Thanks!  Best, Vincent
  > Thanks Vincent — emailed you just now at the address above, with a link back to this Issue. Happy to keep the rest of the discussion there.

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

### Incident Patch 1: `31b8c912` (2026-09-17)
**Commit Message**: fix(template): 第五片《Eval-First / ADLC》暴露的模板小修

- Overlay HUD 同章换词：旧词 4 帧淡完再进新词，零叠影
- HeroGlow 传 color 时 k 作用于 opacity，带色柔光能灭掉
- TagBlock / TechText 的 scaleX 按 LANG 默认，英文片不再每处手传
- Check / Cross p=0 或 opacity=0 时不渲染，去掉 linecap 圆点

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `template/src/fx.tsx` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ export const HeroGlow: React.FC<{x: number; y: number; w: number; h: number; r?:
   const a = clamp01(k) * breathe;
   if (a <= 0.01) return null;
   const glow = color ? `0 0 ${(12 * a).toFixed(0)}px ${(3 * a).toFixed(0)}px ${color}59, 0 0 ${(42 * a).toFixed(0)}px ${(14 * a).toFixed(0)}px ${color}73` : GLOW_PURPLE;
-  return <div style={{...abs(x, y, w, h), borderRadius: r, boxShadow: glow, opacity: color ? 1 : a}} />;
+  return <div style={{...abs(x, y, w, h), borderRadius: r, boxShadow: glow, opacity: color ? clamp01(k) : a}} />;
 };
 
 // ---- 大数字 ----
```

**File**: `template/src/overlay/Overlay.tsx` (modified, +2/-2)
```diff
@@ -117,8 +117,8 @@ export const Hud: React.FC = () => {
   if (sameChapter && prev && n < 10) {
     const t = easeInOutPow(2.5)(clampFrames(n, 10));
     const wNow = hudW(prev) + (w - hudW(prev)) * t;
-    const oldOp = 1 - clampFrames(n, 6);
-    const newOp = 1 - Math.pow(1 - clampFrames(n + 1, 9), 2.5);
+    const oldOp = 1 - clampFrames(n, 4); // 第五片 QC：旧词 4 帧淡完再进新词（新词 n≥4 起），零叠影
+    const newOp = 1 - Math.pow(1 - clampFrames(n - 3, 7), 2.5);
     return (
       <div style={{position: 'absolute', inset: 0, opacity: fadeTail}}>
         <Pill x={640 - wNow / 2} y={28} w={wNow} h={51} fill={PURPLE} sw={2} style={{filter: PILL_SHADOW}} />
```

**File**: `template/src/ui.tsx` (modified, +6/-4)
```diff
@@ -1,5 +1,5 @@
 import React from 'react';
-import {FONT_HEAVY, FONT_TECH, FONT_MONO, FONT_ORB, TEXT_DY} from './common/lib';
+import {FONT_HEAVY, FONT_TECH, FONT_MONO, FONT_ORB, TEXT_DY, LANG} from './common/lib';
 import {GlitchIn, powOutRemain, BEZ_SCALE_IN, clamp01, rnd} from './common';
 
 /**
@@ -99,7 +99,7 @@ export const CText: React.FC<CTextProps> = ({cx, cy, size, weight = 700, family
   </div>
 );
 /** 英文技术词：Exo 2 紫斜体 + scaleX 压窄 */
-export const TechText: React.FC<{cx: number; cy: number; text: string; fontSize?: number; color?: string; scaleX?: number; weight?: number; letterSpacing?: number; glow?: boolean; opacity?: number; style?: React.CSSProperties}> = ({cx, cy, text, fontSize = 32, color = PURPLE_TECH, scaleX = 0.81, weight = 600, letterSpacing = 1, glow = true, opacity = 1, style}) => (
+export const TechText: React.FC<{cx: number; cy: number; text: string; fontSize?: number; color?: string; scaleX?: number; weight?: number; letterSpacing?: number; glow?: boolean; opacity?: number; style?: React.CSSProperties}> = ({cx, cy, text, fontSize = 32, color = PURPLE_TECH, scaleX = LANG === 'en' ? 1 : 0.81, weight = 600, letterSpacing = 1, glow = true, opacity = 1, style}) => (
   <CText cx={cx} cy={cy} size={fontSize} weight={weight} family={FONT_TECH} color={color} letterSpacing={letterSpacing} scaleX={scaleX} italic opacity={opacity} dy={0} shadow={glow ? '0 0 6px rgba(80,30,200,.7)' : undefined} style={style}>
     {text}
   </CText>
@@ -123,10 +123,10 @@ export const Pill: React.FC<PillProps> = ({text, fontSize = 28, weight = 700, co
   </Box>
 );
 /** 大标签块（沿用「召回/精排」体系简化版）：色块 + 超粗字 scaleX .73 + 同色外发光 */
-export const TagBlock: React.FC<{x: number; y: number; w?: number; h?: number; color?: string; text: string; fontSize?: number; opacity?: number; glow?: boolean; skewPx?: number}> = ({x, y, w = 237, h = 62, color = PURPLE, text, fontSize = 44, opacity = 1, glow = true, skewPx = 0}) => (
+export const TagBlock: React.FC<{x: number; y: number; w?: number; h?: number; color?: string; text: string; fontSize?: number; opacity?: number; glow?: boolean; skewPx?: number; scaleX?: number}> = ({x, y, w = 237, h = 62, color = PURPLE, text, fontSize = 44, opacity = 1, glow = true, skewPx = 0, scaleX = LANG === 'en' ? 1 : 0.8}) => (
   <div style={{...abs(x, y, w, h), opacity}}>
     <div style={{position: 'absolute', inset: 0, background: color, transform: skewPx ? `skewX(${(-Math.atan2(skewPx, h) * 180) / Math.PI}deg)` : undefined, boxShadow: glow ? `0 0 28px 10px ${color}99` : undefined}} />
-    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAVY, fontWeight: 900, fontSize, color: WHITE, letterSpacing: -1, lineHeight: 1, transform: 'translateY(-2px) scaleX(0.8)', WebkitTextStroke: '1.5px #000', paintOrder: 'stroke fill'}}>{text}</div>
+    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAVY, fontWeight: 900, fontSize, color: WHITE, letterSpacing: -1, lineHeight: 1, transform: `translateY(${TEXT_DY}px) scaleX(${scaleX})`, WebkitTextStroke: '1.5px #000', paintOrder: 'stroke fill'}}>{text}</div>
   </div>
 );
 
@@ -165,12 +165,14 @@ export const ArrowH: React.FC<{x: number; y: number; w?: number; h?: number; p?:
 );
 /** 勾 / 叉（SVG 全幅内使用，p 为 draw-on 进度） */
 export const Check: React.FC<{cx: number; cy: number; size?: number; color?: string; sw?: number; p?: number; opacity?: number}> = ({cx, cy, size = 60, color = GREEN, sw = 7, p = 1, opacity = 1}) => {
+  if (p <= 0 || opacity <= 0) return null; // p=0 时 linecap 会露出一个圆点（lessons；第五片 G8 报告模板未改）
   const s = size / 60;
   const pts: Array<[number, number]> = [[cx - 26 * s, cy + 2 * s], [cx - 8 * s, cy + 20 * s], [cx + 28 * s, cy - 20 * s]];
   const total = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) + Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
   return <polyline points={pts.map((q) => 
```

---

### Incident Patch 2: `5b572395` (2026-09-12)
**Commit Message**: fix(tts): 本地模型引擎的缓存键改用模型文件指纹，不再只看文件名

PIPER_VOICE_NAME 只取 basename：/voice-a/model.onnx 换到 /voice-b/model.onnx 缓存键相同，会直接复用旧声音；
原地替换模型文件也不会失效。新增 _file_fp（真实路径 + 大小 + mtime + 前 1MB 内容 sha1），
piper 用 PIPER_FP，kokoro_onnx 用 model + voices 两个文件的指纹，一起进 cache_path 的签名。
未设模型路径（edge / kokoro）时为 'none'，键不受影响。

最小复现（同名 model.onnx）：不同目录 → 不同键；未改动 → 同键仍命中；原地替换 → 不同键；kokoro_onnx 换模型 → 不同键。

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `template/scripts/tts_build.py` (modified, +23/-2)
```diff
@@ -10,7 +10,7 @@
   public/assets/<slug>/audio.wav（48k 立体声 16bit；slug 读 src/config.ts）
   script/timeline.json / timeline.md
   src/common/subs.ts（字幕表）、src/common/timeline.ts（TOTAL_FRAMES / CHAPTER_STARTS / SENTENCES）
-逐句（或逐字幕块）缓存于 audio/cache/，改一句只重合成一句。
+逐句（或逐字幕块）缓存于 audio/cache/，改一句只重合成一句；缓存键含引擎参数与本地模型文件的指纹（路径 + 大小 + mtime + 内容头），换模型自动失效。
 
 TTS 引擎（`TTS_ENGINE`，默认 `auto` = 按解说词语言选；**跑之前先问用户有没有偏好的 TTS**，见 SKILL.md 确认点 3）：
   edge     中文默认。edge-tts 云端合成，有词级边界 → 字幕节拍最准。VOICE=zh-CN-YunxiNeural RATE=+8%
@@ -54,6 +54,26 @@
 KOKORO_ONNX_VOICE = os.environ.get('KOKORO_ONNX_VOICE', 'am_michael')
 KOKORO_ONNX_LANG = os.environ.get('KOKORO_ONNX_LANG', 'en-us')
 CHUNK_PAD = float(os.environ.get('CHUNK_PAD', 0.06))  # 无词边界引擎：块间静音秒
+
+
+def _file_fp(path):
+    """模型文件指纹（进缓存键）：真实路径 + 大小 + mtime + 前 1MB 内容的 sha1 前 12 位。
+    换目录下的同名模型、原地替换模型文件都会让旧缓存失效；只按文件名区分会把不同声音的缓存混在一起。
+    路径为空返回 'none'；路径设了但文件不存在返回 'missing:<路径>'（合成时另有报错）。"""
+    if not path:
+        return 'none'
+    rp = os.path.realpath(path)
+    try:
+        st = os.stat(rp)
+        with open(rp, 'rb') as f:
+            head = f.read(1 << 20)
+    except OSError:
+        return f'missing:{rp}'
+    return hashlib.sha1(f'{rp}|{st.st_size}|{st.st_mtime_ns}|'.encode() + head).hexdigest()[:12]
+
+
+PIPER_FP = _file_fp(PIPER_MODEL)
+KOKORO_ONNX_FP = f'{_file_fp(KOKORO_ONNX_MODEL)}+{_file_fp(KOKORO_ONNX_VOICES)}'
 EDGE_TRIES = int(os.environ.get('EDGE_TRIES', 4))     # edge-tts 每句最多试几次（端点会间歇性返回空音频）
 GAP = int(os.environ.get('GAP', 10))          # 句间空白帧
 CHAPTER_GAP = int(os.environ.get('CHAPTER_GAP', 45))  # 章节前空白帧
@@ -90,7 +110,8 @@ def parse(path):
 
 
 def cache_path(text, ext):
-    sig = f'{ENGINE}|{VOICE}|{RATE}|{KOKORO_VOICE}|{KOKORO_ONNX_VOICE}|{KOKORO_ONNX_LANG}|{PIPER_VOICE_NAME}|{KOKORO_LANG}|{KOKORO_SPEED}|{text}'
+    # 本地模型引擎用文件指纹而不是文件名：不同目录下的同名 model.onnx、原地换掉的模型都要各自缓存
+    sig = f'{ENGINE}|{VOICE}|{RATE}|{KOKORO_VOICE}|{KOKORO_ONNX_VOICE}|{KOKORO_ONNX_LANG}|{KOKORO_ONNX_FP}|{PIPER_FP}|{KOKORO_LANG}|{KOKORO_SPEED}|{text}'
     return f'{CACHE}/{hashlib.sha1(sig.encode()).hexdigest()[:16]}{ext}'
 
 
```

---

### Incident Patch 3: `5544f599` (2026-09-10)
**Commit Message**: fix(tts): 显式请求词边界，字幕起点不再静默退化成插值

edge-tts 7.2.0（2025-08-05）给 Communicate 加了 boundary 参数，默认值是
'SentenceBoundary'，请求里发的就是 wordBoundaryEnabled:"false"。7.0.2 及
以前是硬编码 wordBoundaryEnabled:"true"。README 钉的 7.2.8 正好落在新默认
值这一侧，而脚本没显式传参 → 一个 WordBoundary 事件都收不到。

后果不是报错而是静默降级：chunk_starts() 拿到空 words，所有字幕块起点走
「按字数线性插值」兜底。拿 examples/rag/narration.txt 里的真实句子实测
（zh-CN-YunxiNeural，+8%）：

    第三|遇到不知道的问题|它不会说我不知道|而是一脸自信地编一个答案|这就是幻觉
    插值（修复前）  块起始帧 0,  9, 45, 81, 134
    真实发声位置    块起始帧 0,  6, 30, 76, 130

最大偏 15 帧，字幕整块晚半秒出，肉眼可见。README 说的「有词级边界 → 字幕
节拍最准」在此之前已经不成立。

修法是显式传 boundary='WordBoundary'：单次整句合成、韵律不动、句长不变，
只是词边界回来了。顺手加一条旧版本的 TypeError 兜底提示（该参数 7.2.0 才有）。

实测：中英文句子跑通，词边界事件恢复（上表右列即修复后实测值）；
变异测试确认旧版本会打印可操作的报错而不是空转重试。

Reported-by: Hongchang Deng <dhcatlaw@gmail.com>
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ Dependencies:
 brew install ffmpeg          # frame extraction / transcoding, required
 
 python3 -m venv ~/.venvs/a2e && source ~/.venvs/a2e/bin/activate
-pip install 'edge-tts==7.2.8' numpy pillow scipy   # pin edge-tts: it tracks a Microsoft endpoint and breaks across upgrades
+pip install 'edge-tts==7.2.8' numpy pillow scipy   # pin edge-tts: it tracks a Microsoft endpoint and breaks across upgrades (7.2.0+ needs word boundaries requested explicitly; the script does)
 
 # only needed for English narration (kokoro-82m runs locally)
 pip install kokoro soundfile && brew install espeak-ng
```

**File**: `README_ZH.md` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ ln -s "$PWD/anything2explainer" ~/.codex/skills/anything2explainer    # Codex
 brew install ffmpeg          # 抽帧 / 转码，必需
 
 python3 -m venv ~/.venvs/a2e && source ~/.venvs/a2e/bin/activate
-pip install 'edge-tts==7.2.8' numpy pillow scipy   # 建议固定 edge-tts 版本：它跟着微软端点变，升级常有破坏性
+pip install 'edge-tts==7.2.8' numpy pillow scipy   # 建议固定 edge-tts 版本：它跟着微软端点变，升级常有破坏性（7.2.0 起词边界要显式请求，脚本已处理）
 
 # 只做英文片时再装（kokoro-82m 本地推理）
 pip install kokoro soundfile && brew install espeak-ng
```

**File**: `template/scripts/tts_build.py` (modified, +7/-2)
```diff
@@ -14,6 +14,7 @@
 
 TTS 引擎（`TTS_ENGINE`，默认 `auto` = 按解说词语言选；**跑之前先问用户有没有偏好的 TTS**，见 SKILL.md 确认点 3）：
   edge     中文默认。edge-tts 云端合成，有词级边界 → 字幕节拍最准。VOICE=zh-CN-YunxiNeural RATE=+8%
+           词边界要显式请求（boundary='WordBoundary'，7.2.0 起的默认值不给），否则字幕起点会静默退化成插值。
   kokoro   英文默认。kokoro-82m 本地推理（`pip install kokoro soundfile` + `brew install espeak-ng`）。
            KOKORO_VOICE=am_liam（Liam，男声，与中文云希同定位）KOKORO_LANG=a KOKORO_SPEED=1.0
   kokoro 没有词边界 → 改为「逐字幕块分别合成再拼接」，块起始帧因此也是精确的（CHUNK_PAD 调块间静音）。
@@ -39,7 +40,7 @@
 KOKORO_SPEED = float(os.environ.get('KOKORO_SPEED', 1.0))
 KOKORO_SR = 24000
 CHUNK_PAD = float(os.environ.get('CHUNK_PAD', 0.06))  # 无词边界引擎：块间静音秒
-EDGE_TRIES = int(os.environ.get('EDGE_TRIES', 4))       # edge-tts 每句最多试几次（端点会间歇性返回空音频）
+EDGE_TRIES = int(os.environ.get('EDGE_TRIES', 4))     # edge-tts 每句最多试几次（端点会间歇性返回空音频）
 GAP = int(os.environ.get('GAP', 10))          # 句间空白帧
 CHAPTER_GAP = int(os.environ.get('CHAPTER_GAP', 45))  # 章节前空白帧
 LEAD = int(os.environ.get('LEAD', 40))        # 片头静音帧
@@ -128,6 +129,8 @@ def write_wav(path, x, sr):
 
 async def synth_edge(text):
     """edge-tts：整句合成 + 词级边界（会把 text 发送到微软云端端点）。
+    boundary='WordBoundary' 必须显式传：edge-tts 7.2.0 起该参数默认 'SentenceBoundary'，
+    不传就一个 WordBoundary 事件都收不到，chunk_starts() 会静默退化成按字数插值（字幕能偏半秒）。
     端点会间歇性返回空音频（NoAudioReceived）：50 句的片子里随机一两句中招，同一句重试多半就过，
     所以试 EDGE_TRIES 次；试完还拿不到就报错退出，不把空 mp3 当成品往下传。"""
     import edge_tts
@@ -137,7 +140,7 @@ async def synth_edge(text):
     for attempt in range(1, EDGE_TRIES + 1):
         audio = bytearray(); words = []
         try:
-            comm = edge_tts.Communicate(text, VOICE, rate=RATE)
+            comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary='WordBoundary')
             async for ch in comm.stream():
                 if ch['type'] == 'audio':
                     audio += ch['data']
@@ -146,6 +149,8 @@ async def synth_edge(text):
             if audio:
                 break
             why = '端点返回空音频'
+        except TypeError:                # boundary 参数是 edge-tts 7.2.0 才有的
+            raise SystemExit("edge-tts 版本过旧：pip install 'edge-tts==7.2.8'")
         except Exception as e:
             why = f'{type(e).__name__}: {e}'
         if attempt == EDGE_TRIES:
```

---

### Incident Patch 4: `e0ec171a` (2026-09-10)
**Commit Message**: fix(tts): edge-tts 空音频自动重试，试完仍失败就报错退出

微软端点会间歇性返回空音频（NoAudioReceived）：50 句的片子里随机一两句
中招，同一句单独重试多半就过，换音色、换语速也都能过，所以不是内容或
参数问题。原来一句失败整片就断在随机位置，现在每句最多试 EDGE_TRIES 次
（默认 4），退避 1.5s / 3s / 4.5s。

试完还拿不到音频就 SystemExit，不再往下写一个空 mp3——坏结果不能当成品
往后传。

实测：VOICE 换成不存在的音色做变异测试，确认逐次打印失败原因、退避重试、
最后报错退出，audio/cache 里不留空 mp3；正常音色路径不受影响（单次成功
即 break，不引入额外等待）。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `template/scripts/tts_build.py` (modified, +23/-9)
```diff
@@ -18,7 +18,7 @@
            KOKORO_VOICE=am_liam（Liam，男声，与中文云希同定位）KOKORO_LANG=a KOKORO_SPEED=1.0
   kokoro 没有词边界 → 改为「逐字幕块分别合成再拼接」，块起始帧因此也是精确的（CHUNK_PAD 调块间静音）。
   用户有别的 TTS 偏好时不走本脚本：让他给成品配音 wav，按逐句/逐块时间轴手填 timeline.ts 与 subs.ts。
-其它环境变量：GAP/CHAPTER_GAP/LEAD/TAIL（帧）。
+其它环境变量：GAP/CHAPTER_GAP/LEAD/TAIL（帧）、EDGE_TRIES（edge 每句最多试几次，端点会间歇性返回空音频）。
 """
 import asyncio, hashlib, json, os, re, subprocess, sys
 import numpy as np
@@ -39,6 +39,7 @@
 KOKORO_SPEED = float(os.environ.get('KOKORO_SPEED', 1.0))
 KOKORO_SR = 24000
 CHUNK_PAD = float(os.environ.get('CHUNK_PAD', 0.06))  # 无词边界引擎：块间静音秒
+EDGE_TRIES = int(os.environ.get('EDGE_TRIES', 4))       # edge-tts 每句最多试几次（端点会间歇性返回空音频）
 GAP = int(os.environ.get('GAP', 10))          # 句间空白帧
 CHAPTER_GAP = int(os.environ.get('CHAPTER_GAP', 45))  # 章节前空白帧
 LEAD = int(os.environ.get('LEAD', 40))        # 片头静音帧
@@ -126,18 +127,31 @@ def write_wav(path, x, sr):
 
 
 async def synth_edge(text):
-    """edge-tts：整句合成 + 词级边界（会把 text 发送到微软云端端点）。"""
+    """edge-tts：整句合成 + 词级边界（会把 text 发送到微软云端端点）。
+    端点会间歇性返回空音频（NoAudioReceived）：50 句的片子里随机一两句中招，同一句重试多半就过，
+    所以试 EDGE_TRIES 次；试完还拿不到就报错退出，不把空 mp3 当成品往下传。"""
     import edge_tts
     mp3 = cache_path(text, '.mp3'); js = cache_path(text, '.json')
     if os.path.exists(mp3) and os.path.exists(js):
         return mp3, json.load(open(js))
-    comm = edge_tts.Communicate(text, VOICE, rate=RATE)
-    audio = bytearray(); words = []
-    async for ch in comm.stream():
-        if ch['type'] == 'audio':
-            audio += ch['data']
-        elif ch['type'] == 'WordBoundary':
-            words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'text': ch['text']})
+    for attempt in range(1, EDGE_TRIES + 1):
+        audio = bytearray(); words = []
+        try:
+            comm = edge_tts.Communicate(text, VOICE, rate=RATE)
+            async for ch in comm.stream():
+                if ch['type'] == 'audio':
+                    audio += ch['data']
+                elif ch['type'] == 'WordBoundary':
+                    words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'text': ch['text']})
+            if audio:
+                break
+            why = '端点返回空音频'
+        except Exception as e:
+            why = f'{type(e).__name__}: {e}'
+        if attempt == EDGE_TRIES:
+            raise SystemExit(f'edge-tts 试了 {EDGE_TRIES} 次仍拿不到音频（{why}）：{text[:30]}…')
+        print(f'  ⚠ edge-tts 第 {attempt} 次失败（{why}），{1.5 * attempt:.1f}s 后重试：{text[:16]}…')
+        await asyncio.sleep(1.5 * attempt)
     open(mp3, 'wb').write(audio)
     json.dump(words, open(js, 'w'), ensure_ascii=False)
     return mp3, words
```

#### Recent Merged Pull Requests:
- **PR #15** (closed): feat(tts): 片头口播 T 句——第一句读标题，不留无声片头 (@FavorPan)
- **PR #10** (closed): feat: add Russian narration and subtitle support (@web3blind)
- **PR #9** (2026-09-18): 落位停留：静止上限 3 s、末拍停 1–1.5 s 再离场、镜头≠句、句间空白 20 帧 (@Vincentwei1021)
- **PR #7** (2026-09-13): skill 通用化 + PR #4 跟进：去掉题材固定章法、清理项目专有引用、补 ARM TTS 缓存键 (@Vincentwei1021)
- **PR #4** (2026-09-12): Linux / Raspberry Pi (ARM) support: portable sed, local ARM TTS engines, system-Chromium config (@mdipaolo1)
- **PR #3** (2026-09-10): fix(tts): 显式请求词边界（edge-tts 7.2.0+ 默认不给）；空音频自动重试 (@Vincentwei1021)
- **PR #2** (2026-09-10): 第四片经验回流：持续动作规则接进流程、共用层图元升级、README 加 star history (@Vincentwei1021)
- **PR #1** (closed): fix: test_render.sh 无法运行；edge-tts 词边界丢失与间歇性空音频 (@DHCatLaw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

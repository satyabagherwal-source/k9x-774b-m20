# Forensic Learning Record (Deep Inspection): Vincentwei1021/anything2explainer

> **Canonical Artifact**: `07_PROJECT_LEARNING/vincentwei1021-anything2explainer-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Vincentwei1021/anything2explainer](https://github.com/Vincentwei1021/anything2explainer))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:09:21.116Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Vincentwei1021/anything2explainer`
- **Description**: Topic in, narrated explainer video out. A Claude Code / Codex skill that turns any topic into a black-canvas motion-graphics explainer video with TTS voiceover, subtitles and a chapter progress bar. Chinese or English; every frame drawn in code with Remotion.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2259 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/rag/shots_src/G0/util.ts`
```
export * from '../../ui';
import {clamp01} from '../../common';
/** 0→1 线性，len 帧 */
export const clampFrames = (n: number, len: number) => clamp01(n / len);

```

### Core Architecture Module: `examples/rag/shots_src/G5/g5util.tsx`
```
import React from 'react';
import {clamp01, easeInOutPow} from '../../common';
import {WHITE} from '../../ui';

/** G5 组内小工具（不改 ui.tsx；可迁入 ui.tsx 的项写在 BUILD_NOTES）。 */

/** 十六进制颜色线性混合 k∈[0,1] → rgb() 字串 */
export const mixHex = (a: string, b: string, k: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const t = clamp01(k);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
};
/** 灰→紫 11 帧变色曲线（STYLE_GUIDE MIX） */
const MIX = [0, 0.1, 0.18, 0.3, 0.37, 0.47, 0.55, 0.63, 0.71, 0.83, 0.88, 0.98, 1];
export const mixK = (n: number) => (n < 0 ? 0 : n >= MIX.length ? 1 : MIX[n]);
/** 高亮块左锚展宽 21 帧曲线（R3 HL_W） */
const HLW = [0.05, 0.14, 0.21, 0.31, 0.41, 0.5, 0.56, 0.65, 0.7, 0.75, 0.81, 0.85, 0.88, 0.9, 0.93, 0.95, 0.97, 0.98, 0.985, 0.99, 1];
export const hlW = (n: number) => (n < 0 ? 0 : n >= HLW.length ? 1 : HLW[n]);

/** 二次贝塞尔点 */
export const bez2 = (p0: [number, number], c: [number, number], p1: [number, number], t: number): [number, number] => {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
};
export const inOut = easeInOutPow(2.5);

/** SVG 直线 draw-on（stroke-dasharray）：p 0→1 自 (x0,y0) 端长出 */
export const DrawLine: React.FC<{x0: number; y0: number; x1: number; y1: number; p?: number; w?: number; color?: string; dashed?: boolean; opacity?: number}> = ({x0, y0, x1, y1, p = 1, w = 2, color = WHITE, dashed = false, opacity = 1}) => {
  if (p <= 0) return null;
  const L = Math.hypot(x1 - x0, y1 - y0);
  const q = clamp01(p);
  if (dashed) {
    // 虚线：用 clipPath 不方便，改为按进度截断端点
    return <line x1={x0} y1={y0} x2={x0 + (x1 - x0) * q} y2={y0 + (y1 - y0) * q} stroke={color} strokeWidth={w} strokeDasharray="8 7" opacity={opacity} />;
  }
  return <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth={w} strokeDasharray={L} strokeDashoffset={L * (1 - q)} opacity={opacity} strokeLinecap="butt" />;
};
/** SVG 圆 draw-on（从顶点顺时针画出） */
export const DrawCircle: React.FC<{cx: number; cy: number; r: number; p?: number; w?: number; color?: string; opacity?: number; dashed?: boolean}> = ({cx, cy, r, p = 1, w = 2, color = WHITE, opacity = 1, dashed = false}) => {
  if (p <= 0) return null;
  const C = 2 * Math.PI * r;
  return <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dashed ? `${C * clamp01(p)} ${C}` : C} strokeDashoffset={dashed ? 0 : C * (1 - clamp01(p))} transform={`rotate(-90 ${cx} ${cy})`} opacity={opacity} />;
};
/** 以中心为锚的缩放/位移包裹（div），用于 scaleIn / emphasisPulse */
export const Anchor: React.FC<{cx: number; cy: number; s?: number; dx?: number; dy?: number; opacity?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({cx, cy, s = 1, dx = 0, dy = 0, opacity = 1, children, style}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0', transform: `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) translate(${cx}px,${cy}px) scale(${s.toFixed(4)}) translate(${-cx}px,${-cy}px)`, opacity, pointerEvents: 'none', ...style}}>
    {children}
  </div>
);

```

### Core Architecture Module: `template/scripts/render_storyboard.py`
```
#!/usr/bin/env python3
"""把 script/storyboard_src.md 中的时间令牌替换成 script/timeline.json 里的帧号，输出 项目根/分镜表.md。
令牌：{S12.from} {S12.to} {S12.c3}（第 3 个字幕块起始帧）{C2}（第 2 章起始帧）{TOTAL}；均可带 ±整数：{S12.from-8}"""
import json, re, sys, os
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根
tl = json.load(open(f'{here}/script/timeline.json'))
S = {s['id']: s for s in tl['sentences']}
C = {c['n']: c['from'] for c in tl['chapters']}
def sub(m):
    key, field, off = m.group(1), m.group(2), int(m.group(3) or 0)
    if key == 'TOTAL': v = tl['total_frames']
    elif key.startswith('C'): v = C[int(key[1:])]
    else:
        s = S[key]
        if field == 'from': v = s['from']
        elif field == 'to': v = s['to']
        elif field and field.startswith('c'): v = s['subs'][int(field[1:]) - 1]['from']
        else: raise SystemExit(f'bad token {m.group(0)}')
    return str(v + off)
src = open(f'{here}/script/storyboard_src.md', encoding='utf-8').read()
out = re.sub(r'\{(S\d\d|C\d|TOTAL)(?:\.(from|to|c\d+))?([+-]\d+)?\}', sub, src)
open(f'{here}/分镜表.md', 'w', encoding='utf-8').write(out)
left = re.findall(r'\{S\d\d[^}]*\}', out)
print('written 分镜表.md; unresolved:', left[:5])

```

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
        const stroke = state === 'active' ? WHITE : state === 'done' ? GREY_MID : GREY;
        const color = state === 'todo' ? GREY : WHITE;
        return (
          <React.Fragment key={t}>
            <div style={{position: 'absolute', left: RAIL_CX[i] - RAIL_W / 2, top: RAIL_Y + slideUp(N - (spec.from + i * 2), 40, 16), width: RAIL_W, height: RAIL_H, transform: `scale(${pulse})`, opacity: fadeIn(N - (spec.from + i * 2), 8)}}>
              <Pill x={0} y={0} w={RAIL_W} h={RAIL_H} fill={fill} stroke={stroke} sw={2} text={t} fontSize={24} weight={700} color={color} letterSpacing={1} textDy={-1.5} glow={state === 'active' ? GLOW_PURPLE_S : undefined} />
            </div>
            {i < spec.steps.length - 1 ? (
              <ArrowH x={RAIL_CX[i] + RAIL_W / 2 + 6} y={RAIL_Y + RAIL_H / 2 - 9} w={38} h={18} p={clampFrames(N - (spec.from + 4 + i * 2), 10)} color={i < active ? WHITE : GREY} shaft={2} />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------- 片尾 ----------
// QC v1 C4（高）：v1 的压黑层在 G0（最低层）且从 SC44 结束后才开始 → 内容在 8148|8149 硬切消失。
// v2：压黑层挂在内容之上（Main 里 SHOTS_G0_TOP 排在所有内容组之后、进度条之下），从 SC44 末 32 帧开始 30 帧压黑，内容在被完全盖住后才结束；
//     最后 30 帧再用 aboveBar 层把进度条也压黑 → 末段纯黑。
export const ENDING_RANGE: [number, number] = [S('S44').to - 30, TOTAL_FRAMES];
export const Ending: React.FC = () => {
  const N = useCurrentFrame() + ENDING_RANGE[0];
  const n = N - ENDING_RANGE[0];
  const op = fadeIn(n, 30);
  return <div style={{position: 'absolute', inset: 0, background: '#000', opacity: op}} />;
};
export const ENDING_TOP_RANGE: [number, number] = [TOTAL_FRAMES - 30, TOTAL_FRAMES];
export const EndingTop: React.FC = () => {
  const N = useCurrentFrame() + ENDING_TOP_RANGE[0];
  const op = fadeIn(N - ENDING_TOP_RANGE[0], 20);
  return <div style={{position: 'absolute', inset: 0, background: '#000', opacity: op}} />;
};

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

### Core Architecture Module: `examples/rag/shots_src/G1/SC04.tsx`
```
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT_HEAVY, GlitchIn, powOutRemain, clamp01} from '../../common';
import {Svg, Cross, Box, Pill, TagBlock, GREY, WHITE, ORANGE, CORAL, RED_DEEP, fadeIn, exitFade, abs, SoftIn} from '../../ui';
import {Scene1Frame, BOXES, mixHex} from './layout';
import {Box1Content} from './SC02';
import {Box2Content} from './SC03';

/**
 * SC04 短板③ 幻觉（446–612）。节拍：454 第三 / 463 不知道的问题 / 499 不会说不知道 / 534 一脸自信地编 / 588 幻觉。
 * 框③ 内聊天式两行：左上问句气泡「差旅报销的上限是多少？」（全局约束 #2 差旅语境）；右下先 SoftIn 淡入灰胶囊「我不知道」被红叉划掉，
 * 534 起答复气泡打字机逐字「每天 1000 元，全国统一」（数字橙、无来源）；588 框右上角 RED_DEEP「幻觉」TagBlock GlitchIn 12 帧（本镜头唯一 glitch，白名单 §8；纯透明度，不带 slices）+ 答复气泡边框变红 8 帧。
 * 末 2 帧（611–612）整组 exitFade，SC05 硬切。
 */
const F0 = 446;
const B = BOXES[2];
const Q_TEXT = '差旅报销的上限是多少？';
const A_TEXT = '每天 1000 元，全国统一';
const A_CHARS = Array.from(A_TEXT);
const Q = {x: 736, y: 490, w: 262, h: 40};
const A = {x: 878, y: 536, w: 268, h: 40};
const DK = {x: 1016, y: 536, w: 130, h: 40}; // 「我不知道」灰胶囊（与答复同位，右对齐）
const TYPE_AT = 534, TYPE_STEP = 2;

/** 聊天气泡：黑底白边圆角（tail 侧小圆角） */
const Bubble: React.FC<{x: number; y: number; w: number; h: number; side: 'left' | 'right'; stroke?: string; glow?: string; opacity?: number; children: React.ReactNode}> = ({x, y, w, h, side, stroke = WHITE, glow, opacity = 1, children}) => (
  <Box x={x} y={y} w={w} h={h} fill="#000" stroke={stroke} sw={2} opacity={opacity} glow={glow} style={{borderRadius: side === 'left' ? '14px 14px 14px 4px' : '14px 14px 4px 14px'}}>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 14, fontFamily: FONT_HEAVY, fontSize: 22, fontWeight: 600, color: WHITE, lineHeight: 1, whiteSpace: 'nowrap', transform: 'translateY(-1.5px)'}}>{children}</div>
  </Box>
);

export const Box3Content: React.FC<{N: number}> = ({N}) => {
  // 463 问句气泡自左弹入 Δ220
  const nq = N - 463;
  const qdx = -220 * powOutRemain(nq, 22, 2.5);
  // 499 灰胶囊 SoftIn → 505 红叉 12 帧 → 526 起 8 帧淡出
  const dkOp = 1 - clamp01((N - 526) / 8);
  const xp = clamp01((N - 505) / 12);
  // 534 答复气泡 + 打字机
  const na = N - TYPE_AT;
  const count = na < 0 ? 0 : Math.min(A_CHARS.length, Math.floor(na / TYPE_STEP) + 1);
  const typing = na >= 0 && count < A_CHARS.length;
  const caretOn = typing && N % 8 < 5;
  const aIn = 1 - powOutRemain(na, 10, 2.5);
  // 588 边框变红 8 帧
  const red = clamp01((N - 588) / 8);
  const aStroke = mixHex(WHITE, CORAL, red);
  const aGlow = red > 0 ? `0 0 22px 6px rgba(241,96,67,${(0.5 * red).toFixed(2)})` : undefined;
  return (
    <div>
      {nq >= 0 ? (
        <div style={{opacity: fadeIn(nq, 8)}}>
          <Bubble x={Q.x + qdx} y={Q.y} w={Q.w} h={Q.h} side="left">
            {Q_TEXT}
          </Bubble>
        </div>
      ) : null}
      {dkOp > 0 ? (
        <SoftIn N={N} f0={499} style={{opacity: dkOp}}>
          <Pill x={DK.x} y={DK.y} w={DK.w} h={DK.h} fill="#000" stroke={GREY} sw={2} text="我不知道" fontSize={22} weight={600} color={GREY} family={FONT_HEAVY} textDy={-1} />
          <Svg bloom={false}>{xp > 0 ? <Cross cx={DK.x + DK.w / 2} cy={DK.y + DK.h / 2} size={34} sw={6} p={xp} /> : null}</Svg>
        </SoftIn>
      ) : null}
      {na >= 0 ? (
        <div style={{...abs(0, 0, 1280, 720), transformOrigin: `${A.x + A.w}px ${A.y + A.h}px`, transform: aIn < 1 ? `scale(${(0.6 + 0.4 * aIn).toFixed(3)})` : undefined, opacity: fadeIn(na, 5)}}>
          <Bubble x={A.x} y={A.y} w={A.w} h={A.h} side="right" stroke={aStroke} glow={aGlow}>
            {A_CHARS.slice(0, count).map((ch, i) => (
              <span key={i} style={/[0-9]/.test(ch) ? {color: ORANGE, fontWeight: 800} : undefined}>
                {ch}
              </span>
            ))}
            {typing ? <span style={{display: 'inline-block', width: 3, height: 22, marginLeft: 3, background: WHITE, opacity: caretOn ? 1 : 0}} /> : null}
          </Bubble>
        </div>
      ) : null}
      {/* 588 「幻觉」标签：框右上角（白名单 glitch；slices 仅片头/SC08/SC35/SC44 可用，已去掉） */}
      <GlitchIn N={N} f0={588}>
        <TagBlock x={1040} y={B.y - 20} w={110} h={40} color={RED_DEEP} text="幻觉" fontSize={28} />
      </GlitchIn>
    </div>
  );
};

export const SC04: React.FC = () => {
  const N = useCurrentFrame() + F0;
  return (
    <div style={{...abs(0, 0, 1280, 720), opacity: exitFade(N - 610)}}>
      <Scene1Frame N={N} />
      <Box1Content N={N} />
      <Box2Content N={N} />
      <Box3Content N={N} />
    </div>
  );
};

```

### Core Architecture Module: `examples/rag/shots_src/G1/SC05.tsx`
```
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT_HEAVY, FONT_ORB, powOutRemain, easeInOutPow, clamp01} from '../../common';
import {LLMIcon, CText, Pill, Box, DocIcon, PURPLE, PURPLE_LIGHT, GREY, WHITE, ORANGE, TEXT_GLOW, fadeIn, scaleIn, abs, SoftIn} from '../../ui';

/**
 * SC05 重新训练？（613–743）。节拍：621 怎么办 / 637 重新训练 / 670 成本太高 / 692 数据又变了。
 * 清场重排：中央 LLMIcon (640,330) 缩放入场；上方 Orbitron「?」SoftIn；637 紫色循环箭头绕 LLM draw-on 24 帧 + 底部「重新训练」胶囊 SoftIn；
 * 670 左下三根橙色成本柱 2 帧错峰长出 + ¥ 逐个弹出 + 「成本」胶囊；674 右下日历卡缩放入场，692 翻页 10 帧（今天→明天，文档变灰）+ 704「已过期」橙标 SoftIn。
 * 本镜头无 glitch（协议 §8 不在白名单）。末帧不做离场（G2 SC06 硬切）。
 */
const F0 = 613;
const C = {cx: 640, cy: 330};
const R = 128;
const A0 = -70, SWEEP = 320; // 起止角（屏幕坐标，顺时针为正），缺口在顶部对着「?」
const BARS = [
  {x: 176, h: 70},
  {x: 238, h: 118},
  {x: 300, h: 172},
];
const BASE_Y = 560;
const CAL = {x: 950, y: 384, w: 180, h: 186, head: 46};

const pt = (deg: number, r = R) => [C.cx + r * Math.cos((deg * Math.PI) / 180), C.cy + r * Math.sin((deg * Math.PI) / 180)] as const;

/** 循环箭头（SVG）：p 0→1 自起点长出，箭头骑在尖端 */
const LoopArrow: React.FC<{p: number}> = ({p}) => {
  if (p <= 0) return null;
  const segs = 72;
  const end = A0 + SWEEP * p;
  const pts: string[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = A0 + (end - A0) * (i / segs);
    const [x, y] = pt(a);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const [tx, ty] = pt(end);
  const rad = (end * Math.PI) / 180;
  const ux = -Math.sin(rad), uy = Math.cos(rad); // 顺时针切向
  const hl = 20 * clamp01(p * 6), hw = 9 * clamp01(p * 6);
  const bx = tx - ux * hl, by = ty - uy * hl;
  const px = -uy, py = ux;
  return (
    <svg width={1280} height={720} viewBox="0 0 1280 720" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'drop-shadow(0 0 6px rgba(102,45,248,.85))'}}>
      <polyline points={pts.join(' ')} fill="none" stroke={PURPLE_LIGHT} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${tx.toFixed(1)},${ty.toFixed(1)} ${(bx + px * hw).toFixed(1)},${(by + py * hw).toFixed(1)} ${(bx - px * hw).toFixed(1)},${(by - py * hw).toFixed(1)}`} fill={PURPLE_LIGHT} />
    </svg>
  );
};

/** 日历单页：紫色页眉 + 文档小图标 */
const CalPage: React.FC<{title: string; docColor: string; children?: React.ReactNode}> = ({title, docColor, children}) => (
  <div style={{position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden', background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: CAL.w - 4, height: CAL.head, background: PURPLE, borderBottom: `2px solid ${WHITE}`}}>
      <CText cx={(CAL.w - 4) / 2} cy={CAL.head / 2} size={28} weight={800} color={WHITE} dy={-2}>
        {title}
      </CText>
    </div>
    <DocIcon x={(CAL.w - 4) / 2 - 27} y={CAL.head + 24} w={54} h={66} lines={4} sw={2} color={docColor} />
    {children}
  </div>
);

export const SC05: React.FC = () => {
  const N = useCurrentFrame() + F0;
  const sLLM = scaleIn(N - F0, 21);
  const loopP = 1 - Math.pow(1 - clamp01((N - 637) / 24), 1.8);
  const nCost = N - 670;
  const baseW = 200 * (1 - powOutRemain(nCost, 12, 2.5));
  const sCal = scaleIn(N - 674, 21);
  const flip = easeInOutPow(2)(clamp01((N - 692) / 10));
  return (
    <div style={abs(0, 0, 1280, 720)}>
      {/* 中央 LLM */}
      {sLLM > 0 ? (
        <div style={{...abs(0, 0, 1280, 720), transformOrigin: `${C.cx}px ${C.cy}px`, transform: sLLM < 1 ? `scale(${sLLM.toFixed(3)})` : undefined, opacity: clamp01(0.15 + 1.4 * sLLM)}}>
          <LLMIcon cx={C.cx} cy={C.cy} size={170} glow />
        </div>
      ) : null}
      {/* 「?」 */}
      <SoftIn N={N} f0={621}>
        <CText cx={640} cy={150} size={90} weight={700} family={FONT_ORB} color={WHITE} dy={0} shadow={TEXT_GLOW}>
          ?
        </CText>
      </SoftIn>
      {/* 循环箭头 + 「重新训练」 */}
      <LoopArrow p={loopP} />
      <SoftIn N={N} f0={645}>
        <Pill x={565} y={C.cy + R - 21} w={150} h={42} fill="#000" stroke={PURPLE_LIGHT} sw={2} text="重新训练" fontSize={28} weight={700} family={FONT_HEAVY} textDy={-2} />
      </SoftIn>
      {/* 成本柱 */}
      {nCost >= 0 ? (
        <div>
          <div style={{...abs(168, BASE_Y - 1, baseW, 2), background: WHITE}} />
          {BARS.map((b, i) => {
            const n = nCost - 2 * i;
            if (n < 0) return null;
            const h = b.h * (1 - powOutRemain(n, 16, 2.5));
            const k = clamp01((n - 12) / 12);
            const ys = k + 0.25 * Math.sin(Math.PI * k);
            return (
              <React.Fragment key={i}>
                <div style={{...abs(b.x, BASE_Y - h, 46, h), boxSizing: 'border-box', border: `2px solid ${WHITE}`, borderBottom: 'none', background: 'linear-gradient(180deg,#F8DCD2 0%,#EE8F70 35%,#E34F27 70%,#E34F27 100%)'}} />
                {k > 0 ? (
                  <CText cx={b.x + 23} cy={BASE_Y - b.h - 26} size={34} weight={900} color={ORANGE} dy={-2} shadow="0 0 10px rgba(240,95,65,.6)" style={{transform: `translate(-50%,-50%) scale(${ys.toFixed(3)})`}}>
                    ¥
                  </CText>
                ) : null}
              </React.Fragment>
            );
          })}
          <div style={{opacity: fadeIn(nCost, 8)}}>
            <Pill x={218} y={574 + 40 * powOutRemain(nCost, 16, 2.5)} w={100} h={40} fill="#000" stroke={WHITE} sw={2} text="成本" fontSize={26} weight={700} family={FONT_HEAVY} textDy={-2} />
          </div>
        </div>
      ) : null}
      {/* 日历卡 */}
      {sCal > 0 ? (
        <div style={{...abs(0, 0, 1280, 720), transformOrigin: `${CAL.x + CAL.w / 2}px ${CAL.y + CAL.h / 2}px`, transform: sCal < 1 ? `scale(${sCal.toFixed(3)})` : undefined, opacity: clamp01(0.15 + 1.4 * sCal)}}>
          <Box x={CAL.x} y={CAL.y} w={CAL.w} h={CAL.h} r={10} fill="#000" stroke={WHITE} sw={2} style={{overflow: 'hidden'}}>
            {/* 底页：明天（文档灰 + 已过期） */}
            <CalPage title="明天" docColor={GREY}>
              <SoftIn N={N} f0={704}>
                <Pill x={40} y={CAL.head + 72} w={100} h={30} fill={ORANGE} sw={2} text="已过期" fontSize={22} weight={700} family={FONT_HEAVY} textDy={-1} />
              </SoftIn>
            </CalPage>
            {/* 顶页：今天，692 起绕顶边向后翻 90°（负向 rotateX：透视收缩，不溢出卡框） */}
            {flip < 1 ? (
              <div style={{position: 'absolute', inset: 0, transformOrigin: '50% 0%', transform: flip > 0 ? `perspective(700px) rotateX(${(-90 * flip).toFixed(2)}deg)` : undefined, opacity: 1 - 0.25 * flip}}>
                <CalPage title="今天" docColor={WHITE} />
              </div>
            ) : null}
          </Box>
        </div>
      ) : null}
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

### Incident Patch 1: `735c79c8` (2026-09-18)
**Commit Message**: feat(overlay): 片尾默认署名 built by Anything2Explainer skill

- config 新增 `builtBy`（默认 'built by Anything2Explainer skill'，设为 '' 去掉）
- EndCredit 不再要求 credit 存在：有署名卡时署名行排在卡下方（cy 524），没有卡时单独居中（cy 384），灰色 22px
- SKILL 阶段 4 / 阶段 8、README / README_ZH 常驻层一行同步
- 隔离副本渲 Overlay still 核对两种情况（有卡 / 无卡）的版式

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ Both cuts share one storyboard and 44 shots; the English cut re-times every shot
 | Length | your call (see table below); 2–8 minutes all work |
 | Language | Chinese or English (`lang` in `src/config.ts`); typography, subtitle budgets and TTS switch with it |
 | Look | black canvas with one of two backdrops, star field + fog gradient or dot-field wave (`bg` in `src/config.ts`; the dot-field wave is ported from video-talkcraft); white line art + purple accents; ultra-bold headline type |
-| Persistent layers | 44px white-on-black-stroke subtitles, bottom chapter progress bar, top capsule HUD, optional pipeline rail |
+| Persistent layers | 44px white-on-black-stroke subtitles, bottom chapter progress bar, top capsule HUD, optional pipeline rail, `built by Anything2Explainer skill` end credit (`builtBy`, set to `''` to drop) |
 | Voiceover | Chinese: edge-tts `zh-CN-YunxiNeural` (Yunxi, male, unmodified rate ≈5.5 chars/s). English: kokoro-82m `am_liam` (Liam, male). Or bring your own TTS / finished audio |
 
 Length drives how much ground the film covers, and the size of the whole pipeline:
```

**File**: `README_ZH.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ https://github.com/user-attachments/assets/e2771c68-a28c-4459-ac5a-a5b685181eeb
 | 时长 | 由你定（见下表），2–8 分钟都能做 |
 | 语言 | 中文或英文（`src/config.ts` 的 `lang`）；排版、字幕长度预算、配音默认值随它切换 |
 | 视觉 | 黑底，幕底二选一：点阵波（默认，移植自 video-talkcraft 的 dot-field-wave），或星点 + 雾底渐变（`src/config.ts` 的 `bg`）；白线条图形 + 紫色重点；超粗黑体大字 |
-| 常驻层 | 44px 白字黑边字幕、底部章节进度条、顶部胶囊 HUD、可选流程轨 |
+| 常驻层 | 44px 白字黑边字幕、底部章节进度条、顶部胶囊 HUD、可选流程轨、片尾署名 `built by Anything2Explainer skill`（`config.builtBy`，设为 `''` 去掉） |
 | 配音 | 中文 edge-tts `zh-CN-YunxiNeural`（云希，男声，原速不加速 ≈5.5 字/秒）/ 英文 kokoro-82m `am_liam`（Liam，男声）；也可用你自己的 TTS 或成品配音 |
 
 时长决定内容丰富程度与全流程规模：
```

**File**: `SKILL.md` (modified, +2/-2)
```diff
@@ -45,7 +45,7 @@ description: 给一个主题，产出一条黑底 MG 风格（幕底可选星点
 
 阶段 3 分镜（25 分，主会话）：写 `script/storyboard_src.md`（令牌 `{S12.from-8}` `{S12.c3}` `{C2}`），`python3 scripts/render_storyboard.py` → `分镜表.md`。**镜头按画面单元分**：短句（<3 s 或单块）并入相邻镜头当节拍，单镜头 ≥120 帧，能承接就不清场。每镜头一行：帧区间 / 节拍（字幕块起始帧）/ 画面 / 动效（含运镜）/ **主角·尺寸** / **光**；末尾"全局约束"写示例语境、闪烁白名单、**扫光白名单**（全片 ≤2 个镜头）、事实清单、**高光时刻清单**（每章 ≤1 个，标类型）、**运镜清单**（每章 ≥3 处）、**§9 持续动作**（判据照抄 `composition-and-light.md` §7）。动效列每镜头末尾必须有「持续：…」和「停留：…」两句——前者写这个字幕块的动词靠哪个动作撑到下一拍（没有其它运镜的写「1.0→1.05 慢推」，不写漂浮 / 飘动）；后者写末拍元素落位帧到离场起点的帧数（≥30，目标 30–45），不够的三选一：末拍元素前挂 / 回文案加 `## gap` / 并入相邻镜头。运镜不进末拍：运镜结束到离场起点 ≥30 帧。改 `src/config.ts`（片名、章节英文、HUD 条目、流程轨）。
 
-阶段 4 覆盖层与图元（10 分，主会话）：模板已带片头/章节卡/HUD/流程轨/片尾（`src/overlay/`）、图元库（`src/ui.tsx`）与光效/运镜图元（`src/fx.tsx`：扫光、舞台光线、幽灵轮廓、光环、主角柔光、大数字、倾斜平面、相机）。按主题补 2–5 个语义图标进 `ui.tsx`（如样片的 DocIcon/DBIcon/ChunkCard/LLMIcon），跑 `scripts/still.sh Overlay 40,<章节卡帧>,<有轨帧>,<片尾帧> <绝对路径> ov` 看一眼。
+阶段 4 覆盖层与图元（10 分，主会话）：模板已带片头/章节卡/HUD/流程轨/片尾（`src/overlay/`；片尾默认带一行 `built by Anything2Explainer skill`，`config.builtBy` 设为 `''` 可去掉）、图元库（`src/ui.tsx`）与光效/运镜图元（`src/fx.tsx`：扫光、舞台光线、幽灵轮廓、光环、主角柔光、大数字、倾斜平面、相机）。按主题补 2–5 个语义图标进 `ui.tsx`（如样片的 DocIcon/DBIcon/ChunkCard/LLMIcon），跑 `scripts/still.sh Overlay 40,<章节卡帧>,<有轨帧>,<片尾帧> <绝对路径> ov` 看一眼。
 
 阶段 5a 打样（15 分，1 个 agent）：先只派 **G1**（第 1 章上半，含片头后的头几个镜头），完工后 `scripts/preview.sh 30` → **确认点 4**：把前 30 秒样片给用户看，风格 / 字号 / 语速 / 节奏定下来。用户要改的（配色、字号、语速、片头、示例语境）在这里一次改完：改语速要重跑 `tts_build.py` 并重排分镜帧号，改风格只动 `ui.tsx` / `overlay/` + G1。
 
@@ -55,7 +55,7 @@ description: 给一个主题，产出一条黑底 MG 风格（幕底可选星点
 
 阶段 7 QC 与修复（60–90 分）：每章 1 个 QC agent（`reference/agent-qc-rules.md`）→ `qc/qc_v1_Cn.md`；按组派修复 agent（一个 agent 只修一到两组）；主会话修覆盖层。渲 v2 → 2 个复验 agent 逐条核 v1 问题 + 回归通读 → 小修 → v3。终检：闪烁白名单扫描 + 扫光白名单核对（三轮扫光出现的镜头数 = 白名单条数）+ frame_metrics 构图与光复核 + **`motion_check.py --frames fin_frames` 成片复测（组级低分辩率读数偏松，成片才是判据）** + 高光时刻 / 运镜清单逐条确认 + 遗留项 + 回归。样片两轮后：高 0 / 中 0 / 低 ≤5。
 
-阶段 8 交付：`交付说明.md`（成片、配音来源、事实出处、示例语境、质检结论、已知保留项、目录）；把新经验写回本 skill 的 `reference/lessons.md`。
+阶段 8 交付：`交付说明.md`（成片、配音来源、事实出处、示例语境、质检结论、已知保留项、目录；片尾默认署名 `built by Anything2Explainer skill`，如用户要求去掉就在这里记一句）；把新经验写回本 skill 的 `reference/lessons.md`。
 
 ## 关键文件
 | 路径 | 作用 |
```

**File**: `template/src/config.ts` (modified, +2/-0)
```diff
@@ -26,6 +26,8 @@ export const VIDEO = {
   /** 片尾署名卡（内容压黑 + 末句字幕结束后 ≈2 s，aboveBar；不需要就设为 null）。
    *  例：{kicker: 'BASED ON', title: '<论文 / 书 / 报告标题>', byline: '<作者 · 出处 · 年份>', note: 'all visuals drawn in code'} */
   credit: null as {kicker: string; title: string; byline: string; note: string} | null,
+  /** 片尾署名行（默认开）：有署名卡时排在卡下方，没有署名卡时单独居中。不要就设为 ''。 */
+  builtBy: 'built by Anything2Explainer skill',
   /** 章节英文副标（顺序对应 narration 的 CHAPTER 1..n；章节卡从第 2 章起显示；英文片可留空 '' 不渲染）。
    *  和章名一样是「说清讲什么」的标签，不是第二个创意标题；写这章的英文关键词或步骤序列（`Build · Run · Trace`）。 */
   chapterTech: ['Chapter One', 'Chapter Two'],
```

**File**: `template/src/overlay/Overlay.tsx` (modified, +13/-6)
```diff
@@ -186,14 +186,21 @@ export const EndCredit: React.FC = () => {
   const len = END_CREDIT_RANGE[1] - END_CREDIT_RANGE[0];
   const op = Math.min(fadeIn(n, 8), 1 - clampFrames(N - (END_CREDIT_RANGE[1] - 8), 8));
   const c = VIDEO.credit;
-  if (!c) return null;
+  const by = VIDEO.builtBy;
+  if (!c && !by) return null;
   return (
     <div style={{position: 'absolute', inset: 0, opacity: op}}>
-      <CText cx={640} cy={300} size={26} weight={500} color={GREY} letterSpacing={4}>{c.kicker}</CText>
-      <CText cx={640} cy={352} size={40} weight={700} color={WHITE}>{c.title}</CText>
-      <CText cx={640} cy={404} size={26} weight={500} color={GREY}>{c.byline}</CText>
-      <div style={{position: 'absolute', left: 560, top: 440, width: 160, height: 2, background: 'rgba(255,255,255,0.35)', transform: `scaleX(${fadeIn(n - 6, 16)})`}} />
-      <CText cx={640} cy={476} size={22} weight={500} color={GREY}>{c.note}</CText>
+      {c ? (
+        <>
+          <CText cx={640} cy={300} size={26} weight={500} color={GREY} letterSpacing={4}>{c.kicker}</CText>
+          <CText cx={640} cy={352} size={40} weight={700} color={WHITE}>{c.title}</CText>
+          <CText cx={640} cy={404} size={26} weight={500} color={GREY}>{c.byline}</CText>
+          <div style={{position: 'absolute', left: 560, top: 440, width: 160, height: 2, background: 'rgba(255,255,255,0.35)', transform: `scaleX(${fadeIn(n - 6, 16)})`}} />
+          <CText cx={640} cy={476} size={22} weight={500} color={GREY}>{c.note}</CText>
+        </>
+      ) : null}
+      {/* 片尾署名行（config.builtBy，默认开）：有署名卡时排在卡下方，没有卡时单独居中 */}
+      {by ? <CText cx={640} cy={c ? 524 : 384} size={22} weight={500} color={GREY_MID} letterSpacing={2}>{by}</CText> : null}
     </div>
   );
 };
```

---

### Incident Patch 2: `31b8c912` (2026-09-17)
**Commit Message**: fix(template): 第五片《Eval-First / ADLC》暴露的模板小修

- Overlay HUD 同章换词：旧词 4 帧淡完再进新词，零叠影
- HeroGlow 传 color 时 k 作用于 opacity，带色柔光能灭掉
- TagBlock / TechText 的 scaleX 按 LANG 默认，英文片不再每处手传
- Check / Cross p=0 或 opacity=0 时不渲染，去掉 linecap 圆点

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

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
   return <polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={total} strokeDashoffset={total * (1 - clamp01(p))} opacity={opacity} />;
 };
 export const Cross: React.FC<{cx: number; cy: number; size?: number; color?: string; sw?: number; p?: number; opacity?: number}> = ({cx, cy, size = 50, color = CORAL, sw = 7, p = 1, opacity = 1}) => {
+  if (p <= 0 || opacity <= 0) return null; // 同上
   const r = size / 2;
   const d = size * Math.SQRT2;
   return (
```

---

### Incident Patch 3: `5b572395` (2026-09-12)
**Commit Message**: fix(tts): 本地模型引擎的缓存键改用模型文件指纹，不再只看文件名

PIPER_VOICE_NAME 只取 basename：/voice-a/model.onnx 换到 /voice-b/model.onnx 缓存键相同，会直接复用旧声音；
原地替换模型文件也不会失效。新增 _file_fp（真实路径 + 大小 + mtime + 前 1MB 内容 sha1），
piper 用 PIPER_FP，kokoro_onnx 用 model + voices 两个文件的指纹，一起进 cache_path 的签名。
未设模型路径（edge / kokoro）时为 'none'，键不受影响。

最小复现（同名 model.onnx）：不同目录 → 不同键；未改动 → 同键仍命中；原地替换 → 不同键；kokoro_onnx 换模型 → 不同键。

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

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

### Incident Patch 4: `4b213c38` (2026-09-11)
**Commit Message**: docs(zh): mirror the Linux / Raspberry Pi (ARM) section in README_ZH.md

Same content as the README.md section added in this PR: apt packages, the
system-Chromium env var, and the kokoro_onnx / piper / edge TTS options.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `README_ZH.md` (modified, +28/-0)
```diff
@@ -72,6 +72,34 @@ pip install kokoro soundfile && brew install espeak-ng
 
 `scipy` 只给质检脚本 `frame_metrics.py` 用。脚本是 zsh + Python 3，在 macOS 上开发与验证；Linux 应可用，Windows 未测试。
 
+### Linux / 树莓派（ARM）
+
+已在树莓派 5（ARM64、Debian trixie、Python 3.13）上跑通。与 macOS 有三处不同：
+
+```bash
+sudo apt install zsh espeak-ng                 # 脚本是 #!/bin/zsh；espeak-ng 供 kokoro/piper 的 G2P
+
+# Remotion 没有 linux-arm64 的无头浏览器 → 指向系统 Chromium：
+sudo apt install chromium                       # 或 chromium-browser
+export REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium   # 由 template/remotion.config.ts 读取（macOS 上无副作用）
+```
+
+**Linux/ARM 上的配音。** 默认英文引擎 `kokoro` 在 ARM/Python 3.13 上很难装：它固定了旧版 numpy（无 aarch64/py3.13 轮子，只能源码编译，会失败），且依赖 spaCy → `blis`（无 aarch64 轮子、编译不过）。补了两个能干净安装的本地引擎，用 `TTS_ENGINE` 指定，二者都走既有的“逐字幕块合成”路径：
+
+```bash
+# kokoro_onnx —— 音色自然，onnxruntime（不依赖 torch/spaCy）。模型与声音库从
+#   github.com/thewh1teagle/kokoro-onnx 的 releases 下（kokoro-v1.0.onnx、voices-v1.0.bin）
+pip install kokoro-onnx
+TTS_ENGINE=kokoro_onnx KOKORO_ONNX_MODEL=…/kokoro-v1.0.onnx KOKORO_ONNX_VOICES=…/voices-v1.0.bin \
+  KOKORO_ONNX_VOICE=am_michael python3 scripts/tts_build.py
+
+# piper —— 最快的本地引擎，音色偏机械，作树莓派原生兜底。语音 .onnx 从 github.com/rhasspy/piper 下
+pip install piper-tts
+TTS_ENGINE=piper PIPER_MODEL=…/en_US-ryan-medium.onnx python3 scripts/tts_build.py
+```
+
+`edge` 引擎（自然、免费、有词级边界）在 Linux 上也能用，且不需要本地模型——它是调微软云端接口：`TTS_ENGINE=edge VOICE=en-US-AndrewNeural python3 scripts/tts_build.py`。
+
 ## 用法
 
 在 Claude Code 或 Codex 里直接说要做什么，skill 会被触发：
```

---

### Incident Patch 5: `5cdfd6b8` (2026-09-11)
**Commit Message**: feat: Linux / Raspberry Pi (ARM) support — portable sed, local ARM TTS engines, system-Chromium config

Verified on a Raspberry Pi 5 (ARM64, Python 3.13). Changes:

- new_project.sh: portable in-place sed (`-i.bak` + rm) so scaffolding works on
  GNU sed, not only BSD/macOS sed.
- tts_build.py: two extra TTS engines for Linux/ARM, both env-driven with no
  hardcoded paths and clear errors when unset:
    * kokoro_onnx — onnxruntime kokoro (no torch/spaCy; installs cleanly on
      aarch64/py3.13 where the `kokoro` engine does not) — natural voice.
    * piper — fast local fallback (onnxruntime VITS), Pi-native.
  Both slot into the existing no-word-boundary per-chunk path; cache key and the
  timeline `voice` field updated accordingly.
- remotion.config.ts: point Remotion at a system Chromium via
  REMOTION_BROWSER_EXECUTABLE (+ optional REMOTION_GL). No-op on macOS/x86, since
  Chrome-for-Testing has no linux-arm64 build.
- README: a "Linux / Raspberry Pi (ARM)" section documenting the above.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +28/-0)
```diff
@@ -72,6 +72,34 @@ pip install kokoro soundfile && brew install espeak-ng
 
 `scipy` is only used by the QC script `frame_metrics.py`. The shell scripts are zsh + Python 3, developed and verified on macOS; Linux should work, Windows is untested.
 
+### Linux / Raspberry Pi (ARM)
+
+Verified on a Raspberry Pi 5 (ARM64, Python 3.13). Three things differ from macOS:
+
+```bash
+sudo apt install zsh espeak-ng                 # scripts are #!/bin/zsh; espeak-ng for kokoro/piper G2P
+
+# Remotion has no linux-arm64 headless browser → point it at system Chromium:
+sudo apt install chromium                       # or chromium-browser
+export REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium   # read by template/remotion.config.ts (no-op on macOS)
+```
+
+**TTS on Linux/ARM.** `kokoro` (the default English engine) is hard to install on ARM/Python 3.13 (it pins an old numpy and pulls spaCy → blis, which lack aarch64 wheels). Two local engines that install cleanly instead — pass one via `TTS_ENGINE`:
+
+```bash
+# kokoro_onnx — natural voice, onnxruntime (no torch/spaCy). Download model + voices from
+#   github.com/thewh1teagle/kokoro-onnx releases (kokoro-v1.0.onnx, voices-v1.0.bin)
+pip install kokoro-onnx
+TTS_ENGINE=kokoro_onnx KOKORO_ONNX_MODEL=…/kokoro-v1.0.onnx KOKORO_ONNX_VOICES=…/voices-v1.0.bin \
+  KOKORO_ONNX_VOICE=am_michael python3 scripts/tts_build.py
+
+# piper — fastest local, robotic; a Pi-native fallback. Voice .onnx from github.com/rhasspy/piper
+pip install piper-tts
+TTS_ENGINE=piper PIPER_MODEL=…/en_US-ryan-medium.onnx python3 scripts/tts_build.py
+```
+
+The `edge` engine (natural, free, word-boundary timing) also works on Linux and needs no local model — it's a cloud call to Microsoft: `TTS_ENGINE=edge VOICE=en-US-AndrewNeural python3 scripts/tts_build.py`.
+
 ## Usage
 
 In Claude Code or Codex, just say what you want. The skill triggers itself:
```

**File**: `template/remotion.config.ts` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+import {Config} from '@remotion/cli/config';
+
+// Linux / ARM (e.g. Raspberry Pi) support.
+// Chrome-for-Testing has no linux-arm64 build, so Remotion can't download a browser there.
+// Point it at a system Chromium via env, e.g.:
+//   export REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
+// On a GPU-less headless box also set software GL (default 'swangle'); override with REMOTION_GL.
+// Both are unset on macOS / x86 → this file is a no-op and Remotion uses its own browser.
+const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
+if (browser) {
+  Config.setBrowserExecutable(browser);
+  Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as never) || 'swangle');
+}
```

**File**: `template/scripts/new_project.sh` (modified, +3/-1)
```diff
@@ -13,6 +13,8 @@ case "$SLUG" in
 esac
 mkdir -p "$DEST"
 rsync -a --exclude node_modules --exclude 'build*' --exclude renders --exclude fin_frames --exclude stills --exclude 'audio/cache' "$HERE/" "$DEST/"
-sed -i '' "s/slug: 'demo'/slug: '$SLUG'/" "$DEST/src/config.ts"
+# portable in-place edit: `-i.bak` + rm works on both BSD/macOS and GNU/Linux sed
+# (BSD `sed -i ''` breaks on GNU sed, which reads '' as the script and config.ts as a file)
+sed -i.bak "s/slug: 'demo'/slug: '$SLUG'/" "$DEST/src/config.ts" && rm -f "$DEST/src/config.ts.bak"
 mkdir -p "$DEST/public/assets/$SLUG" "$DEST/script" "$DEST/research" "$DEST/qc" "$DEST/stills" "$DEST/renders"
 cd "$DEST" && npm install --silent && npx tsc --noEmit && echo "project ready: $DEST (slug=$SLUG)"
```

**File**: `template/scripts/tts_build.py` (modified, +67/-5)
```diff
@@ -18,6 +18,10 @@
   kokoro   英文默认。kokoro-82m 本地推理（`pip install kokoro soundfile` + `brew install espeak-ng`）。
            KOKORO_VOICE=am_liam（Liam，男声，与中文云希同定位）KOKORO_LANG=a KOKORO_SPEED=1.0
   kokoro 没有词边界 → 改为「逐字幕块分别合成再拼接」，块起始帧因此也是精确的（CHUNK_PAD 调块间静音）。
+  piper       Linux/ARM（含树莓派）本地配音。onnxruntime 版 VITS，无 torch/spacy。`pip install piper-tts` +
+              一个 .onnx 语音，路径经 PIPER_MODEL 传入；无词边界，同 kokoro 逐块合成。装得最快，音色一般。
+  kokoro_onnx Linux/ARM 本地配音，音色自然。onnxruntime 版 kokoro，无 torch/spacy（比 `kokoro` 引擎好装）。
+              `pip install kokoro-onnx` + 模型 KOKORO_ONNX_MODEL / 声音库 KOKORO_ONNX_VOICES；KOKORO_ONNX_VOICE 默认 am_michael。
   用户有别的 TTS 偏好时不走本脚本：让他给成品配音 wav，按逐句/逐块时间轴手填 timeline.ts 与 subs.ts。
 其它环境变量：GAP/CHAPTER_GAP/LEAD/TAIL（帧）、EDGE_TRIES（edge 每句最多试几次，端点会间歇性返回空音频）。
 """
@@ -39,6 +43,14 @@
 KOKORO_LANG = os.environ.get('KOKORO_LANG', 'a')       # a=American English, b=British
 KOKORO_SPEED = float(os.environ.get('KOKORO_SPEED', 1.0))
 KOKORO_SR = 24000
+# piper（TTS_ENGINE=piper）：本地/ARM 友好，模型路径经环境变量传入（无默认，缺省即报错提示）
+PIPER_MODEL = os.environ.get('PIPER_MODEL', '')
+PIPER_VOICE_NAME = os.path.basename(PIPER_MODEL).replace('.onnx', '') if PIPER_MODEL else 'piper'
+# kokoro_onnx（TTS_ENGINE=kokoro_onnx）：onnxruntime 版 kokoro，无 torch/spacy
+KOKORO_ONNX_MODEL = os.environ.get('KOKORO_ONNX_MODEL', '')     # 例：kokoro-v1.0.onnx
+KOKORO_ONNX_VOICES = os.environ.get('KOKORO_ONNX_VOICES', '')  # 例：voices-v1.0.bin
+KOKORO_ONNX_VOICE = os.environ.get('KOKORO_ONNX_VOICE', 'am_michael')
+KOKORO_ONNX_LANG = os.environ.get('KOKORO_ONNX_LANG', 'en-us')
 CHUNK_PAD = float(os.environ.get('CHUNK_PAD', 0.06))  # 无词边界引擎：块间静音秒
 EDGE_TRIES = int(os.environ.get('EDGE_TRIES', 4))     # edge-tts 每句最多试几次（端点会间歇性返回空音频）
 GAP = int(os.environ.get('GAP', 10))          # 句间空白帧
@@ -47,8 +59,8 @@
 TAIL = int(os.environ.get('TAIL', 90))        # 片尾静音帧
 CACHE = f'{ROOT}/audio/cache'
 os.makedirs(CACHE, exist_ok=True)
-if ENGINE not in ('auto', 'edge', 'kokoro'):
-    raise SystemExit(f'未知 TTS_ENGINE={ENGINE}（可选 auto / edge / kokoro）')
+if ENGINE not in ('auto', 'edge', 'kokoro', 'piper', 'kokoro_onnx'):
+    raise SystemExit(f'未知 TTS_ENGINE={ENGINE}（可选 auto / edge / kokoro / piper / kokoro_onnx）')
 
 
 def parse(path):
@@ -76,7 +88,7 @@ def parse(path):
 
 
 def cache_path(text, ext):
-    sig = f'{ENGINE}|{VOICE}|{RATE}|{KOKORO_VOICE}|{KOKORO_LANG}|{KOKORO_SPEED}|{text}'
+    sig = f'{ENGINE}|{VOICE}|{RATE}|{KOKORO_VOICE}|{KOKORO_ONNX_VOICE}|{KOKORO_LANG}|{KOKORO_SPEED}|{text}'
     return f'{CACHE}/{hashlib.sha1(sig.encode()).hexdigest()[:16]}{ext}'
 
 
@@ -208,6 +220,55 @@ def synth_kokoro(text):
     return au
 
 
+_piper = None
+
+
+def synth_piper(text):
+    """piper-tts：本地推理（onnxruntime，Linux/ARM/树莓派友好，无 torch/spacy），无词边界 → 逐块合成。
+    模型原生采样率写 wav；decode() 再用 ffmpeg 重采样到 SR。需 PIPER_MODEL 指向一个 .onnx 语音。"""
+    global _piper
+    if not PIPER_MODEL:
+        raise SystemExit('TTS_ENGINE=piper 需要 PIPER_MODEL 指向一个 piper .onnx 语音'
+                         '（pip install piper-tts；语音见 github.com/rhasspy/piper voices）')
+    au = cache_path(text, '.wav')
+    if os.path.exists(au):
+        return au
+    if _piper is None:
+        try:
+            from piper import PiperVoice
+        except ImportError:
+            raise SystemExit('TTS_ENGINE=piper 需要 piper：pip install piper-tts')
+        _piper = PiperVoice.load(PIPER_MODEL)
+    import wave
+    with wave.open(au, 'wb') as w:
+        _piper.synthesize_wav(text, w)
+    return au
+
+
+_kokoro_onnx = None
+
+
+def synth_kokoro_onnx(text):
+    """kokoro-onnx：onnxruntime 版 kokoro（Linux/ARM 友好，无 torch/spacy；比 `kokoro` 引擎好装、音色自然），
+    24kHz，无词边界 → 逐块合成。需 KOKORO_ONNX_MODEL / KOKORO_ONNX_VOICES 两个模型文件。"""
+    global _kokoro_onnx
+    if not (KOKORO_ONNX_MODEL and KOKORO_ONNX_VOICES):
+        raise SystemExit('TTS_ENGINE=kokoro_onnx 需要 KOKORO_ONNX_MODEL 与 KOKORO_ONNX_VOICES'
+                         '（pip install kokoro-onnx；模型见 github.com/thewh1teagle/kokoro-onnx releases）')
+    au = cache_path(text, '.wav')
+    if os.path.exists(au):
+        return au
+    if _kokoro_onnx is None:
+        try:
+            from kokoro_onnx import Kokoro
+        except ImportError:
+            raise SystemExit('TTS_ENGINE=kokoro_onnx 需要 kokoro-onnx：pip install kokoro-onnx')
+        _kokoro_onnx = Kokoro(KOKORO_ONNX_MODEL, KOKORO_ONNX_VOICES)
+    s, sr = _kokoro_onnx.create(text, voice=KOKORO_ONNX_VOICE, speed=KOKORO_SPEED, lang=KOKORO_ONNX_LANG)
+    write_wav(au, np.asarray(s, dtype=np.float32).reshape(-1), sr)
+    return au
+
+
 def decode(mp3):
     out = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp3, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
     return np.frombuffer(out, dtype=np.float32).copy()
@@ -269,10 +330,11 @@ async def synth_sentence(chunks, sep=''):
         x, lead_cut = trim_edges(decode(au))
         dur = len(x) / SR
         return x, chunk_starts(text, chunks, words, lead_cut, dur, sep), dur
+    chunk_synth = {'piper': synt
```

---

### Incident Patch 6: `5544f599` (2026-09-10)
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

Reported-by: Hongchang Deng <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

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

### Incident Patch 7: `e0ec171a` (2026-09-10)
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

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

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

---

### Incident Patch 8: `5e752174` (2026-09-10)
**Commit Message**: docs(test_render): 注明 mktemp 模板为什么不能带点

`.XXXXXX` 造出的目录名含一个点，Remotion 的 getOutputFilename 会把它
当成图片序列的文件扩展名并直接报错：

    Error: The output directory of the image sequence cannot have an
    extension. Got: 024kyL

da6d892 已经把点换成下划线，这里补一句注释防止再改回去。

Reported-by: Hongchang Deng <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `template/scripts/test_render.sh` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
 COMP=$1; A=$2; TAG=${3:-$COMP}; B=build_dev_$TAG
 [ -n "$COMP" ] && [ -n "$A" ] || { echo "usage: test_render.sh <Comp> <start_frame> [tag]"; exit 1; }
 [ -d "$B" ] || npx remotion bundle src/index.ts --out-dir "$B" --log=error
-OUT=$(mktemp -d "${TMPDIR:-/tmp}/explainer_test_${TAG}_XXXXXX")
+OUT=$(mktemp -d "${TMPDIR:-/tmp}/explainer_test_${TAG}_XXXXXX")   # 模板里不能带点：Remotion 会把 .XXXXXX 当成图片序列的扩展名而拒渲
 trap 'rm -rf "$OUT"' EXIT
 time npx remotion render "$B" "$COMP" "$OUT" --sequence --image-format=jpeg --frames=$((A-1))-$((A+28)) --log=error
 ls "$OUT" | wc -l
```

---

### Incident Patch 9: `1b241dd3` (2026-09-08)
**Commit Message**: tts_build: 字幕超宽告警按显示宽度判，不按字数

中文测试片里「常见做法是几百个 token 一块」被误报超预算：len() 把 Latin 词按字符数算，
实际只有 ≈630px，远没到安全区上限。改成与 src/common/textfit.ts 同一张实测 em 宽表，
直接预判「44px 下会不会超过 1160px」，并在 >1.3 倍时提示会折两行。中英混排不再误报。

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `template/scripts/tts_build.py` (modified, +32/-8)
```diff
@@ -84,8 +84,31 @@ def detect_lang(items):
     return 'zh' if cjk >= 0.2 * max(1, len(txt)) else 'en'
 
 
-# 每块字幕的长度预算：超了 Subtitle.tsx 会自动缩字号兜底，但该改的是文案（见 narration-storyboard.md）
-SUB_BUDGET = {'zh': 16, 'en': 48}
+# 字幕块宽度预判：与 src/common/textfit.ts 用同一张 em 宽表（字体 fontTools 实测），
+# 直接算「44px 下会不会超过安全区 1160px」——比按字数判准，中英混排（如「几百个 token 一块」）不会误报。
+# 授稿建议仍是每块中文 ≤16 字 / 英文 ≤48 字符（见 narration-storyboard.md）。
+SUB_MAX_W = 1160
+SUB_SIZE = 44
+SUB_BUDGET = {'zh': '16 字', 'en': '48 字符'}
+
+
+def text_em(s):
+    t = 0.0
+    for ch in s:
+        c = ord(ch)
+        if c >= 0x2e80:
+            t += 1.0                     # CJK / 全角
+        elif ch == ' ':
+            t += 0.227
+        elif 'A' <= ch <= 'Z':
+            t += 0.668
+        elif '0' <= ch <= '9':
+            t += 0.59
+        elif 'a' <= ch <= 'z':
+            t += 0.566
+        else:
+            t += 0.325                   # 半角标点
+    return t
 
 
 def write_wav(path, x, sr):
@@ -273,13 +296,14 @@ async def main(narr):
     for i in range(len(all_subs) - 1):
         if all_subs[i]['to'] >= all_subs[i + 1]['from']:
             all_subs[i]['to'] = all_subs[i + 1]['from'] - 1
-    # 字幕块长度体检：超预算的块会被 Subtitle.tsx 缩字号兜底，但正确做法是回去切文案
-    over = [sb for sb in all_subs if len(sb['text']) > SUB_BUDGET[lang]]
+    # 字幕块宽度体检：超安全区的块会被 Subtitle.tsx 缩字号（>1.3 倍还会折两行压进内容区），正确做法是回去切文案
+    over = [(sb, text_em(sb['text']) * SUB_SIZE) for sb in all_subs]
+    over = [(sb, w) for sb, w in over if w > SUB_MAX_W]
     if over:
-        unit = '字' if lang == 'zh' else '字符'
-        print(f'⚠ {len(over)}/{len(all_subs)} 块字幕超过每块 {SUB_BUDGET[lang]} {unit}（会自动缩字号，建议用 | 再切）：')
-        for sb in over[:5]:
-            print(f"    f{sb['from']} ({len(sb['text'])}{unit}) {sb['text']}")
+        print(f'⚠ {len(over)}/{len(all_subs)} 块字幕在 {SUB_SIZE}px 下超过安全区 {SUB_MAX_W}px'
+              f'（会自动缩字号；建议每块 {SUB_BUDGET[lang]}，用 | 再切一刀）：')
+        for sb, w in over[:5]:
+            print(f"    f{sb['from']} (≈{w:.0f}px{'，会折两行' if w > SUB_MAX_W * 1.3 else ''}) {sb['text']}")
     # 输出
     tl = {'fps': FPS, 'total_frames': total, 'engine': ENGINE,
           'voice': VOICE if ENGINE == 'edge' else KOKORO_VOICE,
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

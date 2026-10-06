# Forensic Learning Record (Deep Inspection): hypit-ai/hypit

> **Canonical Artifact**: `07_PROJECT_LEARNING/hypit-ai-hypit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hypit-ai/hypit](https://github.com/hypit-ai/hypit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:12:45.327Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hypit-ai/hypit`
- **Description**: Clone any viral video with AI agents. Not just a script, the whole workflow: swap the face, the words, the B-roll, ship 100 variants in one command, and get your 100M views.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 19465 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/complex-explainer/packages/launch-scenes/src/render.js`
```
import { sealVisualTrack } from "@hypit/hypit/composition";
import { browserProgram } from "@hypit/hypit/hyperframes";
import { assertTemporalWindowFor } from "@hypit/hypit/temporal";
const sty = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
function seal(t, c, w, o, html, css, setup, data, children = []) {
  assertTemporalWindowFor(w, { subjectId: o.id, space: t });
  return sealVisualTrack({
    id: o.id,
    programSpaceId: t.id,
    visualIr: "hypit.visual-ir@1",
    presents: [
      {
        id: o.id,
        span: w.span,
        stacking: { order: o.z, tieBreak: o.id },
        elements: [
          {
            id: "scene",
            kind: "program",
            order: 0,
            program: browserProgram({
              html: html + '<div class="font-resource">{{font}}</div>',
              css:
                ":scope{pointer-events:none}.font-resource{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}" +
                css,
              setup:
                `const family=getComputedStyle(root.querySelector('.font-resource>*')).fontFamily;root.style.fontFamily=family;` +
                setup,
              data,
            }),
            style: sty({
              position: "absolute",
              inset: 0,
              width: c.widthPx + "px",
              height: c.heightPx + "px",
            }),
          },
          {
            id: "font",
            parent: "scene",
            kind: "text",
            order: 1,
            text: "Hypit 字",
            fonts: [data.font],
            style: sty({ "font-size": "12px" }),
          },
          ...children,
        ],
      },
    ],
  });
}
export function renderPoster(t, c, w, font, o) {
  return seal(
    t,
    c,
    w,
    o,
    `<div class="poster"><div class="poster-title">${esc(o.text)}</div><div class="poster-subtitle">${esc(o.subtitle)}</div></div>`,
    `.poster{position:absolute;left:5%;top:${o.y * 100}%;width:90%;text-align:center}.poster-title{font-size:${o.size}px;line-height:1.05;color:#ff79bc;-webkit-text-stroke:5px #2b1f30;paint-order:stroke fill;text-shadow:2px 2px #2b1f30,4px 4px #2b1f30,7px 8px #2b1f30;filter:drop-shadow(0 0 1px #ffe6f2)}.poster-subtitle{display:inline-block;margin-top:${o["subtitle-gap"]}px;padding:10px 26px 13px;font-size:${o["subtitle-size"]}px;line-height:1.2;color:#2b1f30;background:#fff0f7;border:3px solid #2b1f30;border-radius:6px;box-shadow:6px 7px 0 #fa67aa}`,
    "return frame=>{};",
    { font },
  );
}

```

### Core Architecture Module: `examples/complex-explainer/packages/opening-system/src/render.js`
```
import { palette } from "@explainer/visual-language";
import { flagSetup } from "./flag-cloth.js";
import { sealVisualTrack } from "@hypit/hypit/composition";
import { browserProgram } from "@hypit/hypit/hyperframes";
import { assertTemporalWindowFor } from "@hypit/hypit/temporal";

const digits = {
  0: ["11111", "10001", "10001", "10001", "10001", "10001", "11111"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "11111"],
  2: ["11111", "00001", "00001", "11111", "10000", "10000", "11111"],
  3: ["11111", "00001", "00001", "01111", "00001", "00001", "11111"],
  4: ["10001", "10001", "10001", "11111", "00001", "00001", "00001"],
  5: ["11111", "10000", "10000", "11111", "00001", "00001", "11111"],
  6: ["11111", "10000", "10000", "11111", "10001", "10001", "11111"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["11111", "10001", "10001", "11111", "10001", "10001", "11111"],
  9: ["11111", "10001", "10001", "11111", "00001", "00001", "11111"],
  ":": ["0", "0", "1", "0", "1", "0", "0"],
};
const dotSvg = `<svg class="clock" viewBox="0 0 25 7" aria-label="Timer"></svg>`;
const dotSetup = `const patterns=data.digits, clock=root.querySelector('.clock');let previous='';
const showClock=(seconds)=>{const n=Math.max(0,Math.floor(Math.abs(seconds))),str=Math.floor(n/60)+':'+String(n%60).padStart(2,'0');if(str===previous)return;previous=str;let x=0,html='';for(const ch of str){const p=patterns[ch];for(let y=0;y<7;y++)for(let c=0;c<p[y].length;c++)if(p[y][c]==='1')html+='<rect x="'+(x+c)+'" y="'+y+'" width=".79" height=".79" rx=".035"/>';x+=p[0].length+1;}clock.setAttribute('viewBox','0 0 '+(x-1)+' 7');clock.innerHTML=html;};`;
const style = (obj) =>
  Object.entries(obj).map(([name, value]) => ({ name, value }));
function text(id, parent, value, font, size, color) {
  return {
    id,
    parent,
    kind: "text",
    order: id === "title" ? 1 : 2,
    text: value,
    fonts: [font],
    style: style({
      "font-size": size + "px",
      "line-height": 1.2,
      color,
      "white-space": "nowrap",
    }),
  };
}
function track(timeline, canvas, window, o, program, children = [], presents) {
  assertTemporalWindowFor(window, { subjectId: o.id, space: timeline });
  return sealVisualTrack({
    id: o.id,
    programSpaceId: timeline.id,
    visualIr: "hypit.visual-ir@1",
    presents: presents ?? [
      {
        id: o.id,
        span: window.span,
        stacking: { order: o.z, tieBreak: o.id },
        elements: [
          {
            id: "scene",
            kind: "program",
            order: 0,
            program,
            style: style({
              position: "absolute",
              inset: 0,
              width: canvas.widthPx + "px",
              height: canvas.heightPx + "px",
            }),
          },
          ...children,
        ],
      },
    ],
  });
}
export function renderTitle(timeline, canvas, window, font, o, bounce) {
  const w = canvas.widthPx;
  const letters = Array.from(o.title);
  return track(
    timeline,
    canvas,
    window,
    o,
    browserProgram({
      html: `
<div class="time">${dotSvg}</div
><div class="titlebox"
  ><div class="titlebar"><i></i><i></i><i></i><span>HYPIT.EXE</span><b>×</b></div
  ><canvas class="pixel-world" width="216" height="116"></canvas><div class="eyebrow">{{subtitle}}</div><div class="headline">${letters.map((_, i) => `<span class="title-letter">{{letter-${i}}}</span>`).join("")}</div
  ><svg class="spark" viewBox="0 0 7 7">
    <path
      d="M3 0h1v2h1v1h2v1H5v1H4v2H3V5H2V4H0V3h2V2h1Z"
      fill="${palette.pink}"
      stroke="${palette.ink}"
      stroke-width=".2"
    /></svg><div class="pixel-trim"><i></i><i></i><i></i><i></i></div><span class="window-grip">▰▰▰</span>
></div>
`,
      css: `:scope{pointer-events:none;color:${palette.ink}}.time{position:absolute;left:32%;top:${o.timerY * 100}%;width:36%;color:#ffe6f4;filter:drop-shadow(3px 4px 0 ${palette.ink}) drop-shadow(0 0 5px #fff1fa) drop-shadow(0 0 17px #ff58b4)}.clock{width:100%;fill:currentColor;overflow:visible;stroke:#73314f;stroke-width:.10;paint-order:stroke fill}.titlebox{position:absolute;left:10%;top:${o.titleY * 100}%;width:80%;height:27%;background:#fff3f9;border:5px solid ${palette.ink};border-radius:16px;box-shadow:13px 15px 0 ${palette.ink}}.titlebar{height:46px;display:flex;align-items:center;gap:9px;padding:0 16px;border-bottom:4px solid ${palette.ink};background:#f9a4cc;border-radius:11px 11px 0 0;font:20px Menlo,monospace}.titlebar i{width:13px;height:13px;background:#fdf4fa;border:2px solid ${palette.ink}}.titlebar i:nth-child(2){background:#b7dfc8}.titlebar i:nth-child(3){background:#d4baf6}.titlebar span{margin-left:12px}.titlebar b{margin-left:auto;font-size:32px}.pixel-world{position:absolute;left:0;top:50px;width:100%;height:calc(100% - 50px);border-radius:0 0 10px 10px;image-rendering:pixelated}.eyebrow{position:absolute;top:20%;left:0;width:100%;display:flex;justify-content:center}.eyebrow>*{color:${palette.ink}!important;-webkit-text-stroke:0!important}.headline{position:absolute;top:39%;left:0;width:100%;display:flex;justify-content:center}.title-letter{display:inline-block;will-change:transform}.title-letter>*{color:${palette.pink}!important;-webkit-text-stroke:3px ${palette.ink};paint-order:stroke fill;filter:drop-shadow(6px 6px 0 ${palette.ink})}.spark{position:absolute;width:54px;height:54px;right:35px;bottom:40px;image-rendering:pixelated}.pixel-trim{position:absolute;left:30px;bottom:35px;display:flex;gap:9px}.pixel-trim i{width:12px;height:12px;border:2px solid ${palette.ink};background:#f8a1cb}.pixel-trim i:nth-child(2){background:#cbb6ed}.pixel-trim i:nth-child(3){background:#bde3c7}.window-grip{position:absolute;right:12px;bottom:6px;font:11px monospace;letter-spacing:2px;color:#b687a2}`,
      data: { digits, seconds: o.seconds, fps: timeline.frameRate.numerator / timeline.frameRate.denominator, bounce: bounce.frame - window.span.startFrame },
      setup: dotSetup + `showClock(data.seconds);
const world=root.querySelector('.pixel-world').getContext('2d'),letters=[...root.querySelectorAll('.title-letter')];
world.imageSmoothingEnabled=false;
return frame=>{
 const t=frame/data.fps;
 world.fillStyle='#fff3f9';world.fillRect(0,0,216,116);
 // The road recedes to a clear central horizon; scenery stays at its sides.
 world.fillStyle='#f1d7ea';for(let i=0;i<5;i++){const x=9+i*48;world.fillRect(x,8+(i%2)*6,18,3);world.fillRect(x+4,5+(i%2)*6,9,3);}
 // Elevated valley walls flank a low clear center behind the title.
 for(let side of [-1,1])for(let x=0;x<72;x+=3){const k=x/72,high=56+Math.floor(k*k*47),px=side<0?x:213-x;world.fillStyle='#d7cee9';world.fillRect(px,high,3,116-high);world.fillStyle='#d7b6e4';world.fillRect(px,high+6,3,110-high);}
 const horizon=99;
 for(let y=horizon;y<116;y++){
  const depth=(y-horizon)/(116-horizon),half=5+depth*70;
  world.fillStyle='#d7dfbd';world.fillRect(0,y,216,1);
  world.fillStyle='#d9b6d7';world.fillRect(Math.floor(108-half),y,Math.ceil(half*2),1);
  world.fillStyle='#fff0f7';world.fillRect(Math.floor(108-half),y,Math.max(1,depth*3),1);world.fillRect(Math.floor(108+half),y,Math.max(1,depth*3),1);
  const stripe=((1/Math.max(.02,depth)-t*2.3)%2+2)%2;
  if(stripe<.85){world.fillStyle='#fff5fc';world.fillRect(Math.floor(108-depth*2),y,Math.max(1,depth*4),1);}
 }
 for(let i=0;i<7;i++){
  const p=((i/7+t*.22)%1),d=p*p,y=horizon+d*17,size=2+d*10;
  for(const side of [-1,1]){const x=108+side*(70+d*45);world.fillStyle='#bd8dad';world.fillRect(Math.floor(x-size*.15),Math.floor(y-size*.7),Math.max(1,size*.3),Math.ceil(size*.7));world.fillStyle=i%2?'#f5a4c9':'#b7cda9';world.fillRect(Math.floor(x-size*.6),Math.floor(y-size*1.7),Math.ceil(size*1.2),Math.ceil(size));world.fillRect(Math.floor(x-size*.3),Math.floor(y-size*2),Math.ceil(size*.6),Math.ceil(size*.3));}
 }
 letters.forEach((letter,i)=>{
  const age=(frame-data.bounce)/data.fps-i*.085,q=age/.42;
  const jump=q>=0&&q<1?Math.sin(q*Math.PI):0;
  letter.style.transform='translateY('+(-26*jump)+'px) rotate('+(-4*jump)+'deg) scale('+(1+.055*jump)+')';
 });
};`,
    }),
    [
      ...letters.map((letter, i) => ({ ...text(`letter-${i}`, "scene", letter, font, w * o.titleSize, o.color), order: 3 + i })),
      text("subtitle", "scene", o.subtitle, font, w * 0.078, `${palette.ink}`),
    ],
  );
}

export function renderTimer(timeline, canvas, window, font, o, logo, stop) {
  const fps = timeline.frameRate.numerator / timeline.frameRate.denominator;
  return track(
    timeline,
    canvas,
    window,
    o,
    browserProgram({
      html: `
<div class="badge"
  ><div class="pennant"><canvas class="flag-canvas"></canvas></div><div class="backplate"></div
  ><div class="plaque"><svg class="plaque-outline" viewBox="0 0 300 115" preserveAspectRatio="none"><path d="M-3 2H276L298 113H-3Z" fill="${palette.pink}" stroke="${palette.ink}" stroke-width="4" stroke-linejoin="round"/></svg><div class="topic">{{title}}</div><div class="sub">{{subtitle}}</div></div
  ><div class="readout">${dotSvg}</div></div
><div class="logo-resource">{{flag-logo}}</div>
`,
      css: `:scope{pointer-events:none}.badge{position:absolute;left:${o.x * 100}%;top:${o.y * 100}%;width:${o.width * 100}%;height:10.6%;color:#edf6ff;filter:drop-shadow(0 3px 3px #0007)}.backplate{position:absolute;z-index:0;left:-4%;top:-13%;width:80%;height:110%;border:3px solid ${palette.ink};border-radius:2px 5px 12px 2px;transform:skewX(10deg);background:#fff0f7;box-shadow:5px 6px 0 ${palette.ink}}.plaque{position:absolute;z-index:2;inset:0 0 43%;overflow:visible}.plaque-outline{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(5px 6px 0 ${palette.ink})}.topic{position:absolute;top:12%;left:8%;width:78%;display:flex;justify-content:center}.sub{position:absolute;top:73%;left:8%;width:78%;display:flex;justify-content:center;opacity:.64;letter-spacing:.06em}.readout{position:absolute;z-index:3;top:67%;left:26%;width:45%;filter:none}.clock{wid
```

### Core Architecture Module: `examples/complex-explainer/packages/web-scenes/src/render.js`
```
export { scene } from "./shared/scene.js";
export { renderIntro } from "./scenes/introduction/index.js";
export { renderComparison } from "./scenes/comparison/index.js";

```

### Core Architecture Module: `examples/semantic-composition/packages/chat-scene/src/render.ts`
```
import { sealVisualTrack } from "@hypit/hypit/composition";
import type { VisualElement } from "@hypit/hypit/composition";
import { browserProgram } from "@hypit/hypit/hyperframes";
import type { FontStackRef } from "@hypit/hypit/media";
import type { Timeline } from "@hypit/hypit/timeline";
import type { CanvasSpace } from "@hypit/hypit/spatial";
import { assertTemporalWindowFor } from "@hypit/hypit/temporal";
import type { TemporalInstant, TemporalWindow } from "@hypit/hypit/temporal";

export type Message = { id: string; sender: string; text: string; side: "left" | "right"; at: TemporalInstant };
export type ChatOptions = { id: string; title: string; entranceFrames: number };

/** Layout, arrival and scrolling share one visual component; timing is already resolved. */
export function renderChat(timeline: Timeline, canvas: CanvasSpace, window: TemporalWindow,
  font: FontStackRef, messages: readonly Message[], options: ChatOptions) {
  assertTemporalWindowFor(window, { subjectId: options.id, space: timeline });
  if (!Number.isSafeInteger(options.entranceFrames) || options.entranceFrames < 1) throw new Error("Chat entrance-frames must be a positive integer.");
  if (messages.some(message => message.at.frame < window.span.startFrame || message.at.frame >= window.span.endFrameExclusive)) throw new Error("Chat messages must appear inside the scene's window.");
  let order = 0;
  const text = (id: string, value: string, size: number, color: string): VisualElement => ({
    id, kind: "text", parent: "chat", order: ++order, text: value, fonts: font.faces,
    style: [{ name: "font-size", value: `${size}px` }, { name: "line-height", value: 1.3 }, { name: "color", value: color }],
  });
  const children = [text("title", options.title, 30, "#f6ead9"), text("subtitle", "A small change of plan", 16, "#b8c6c5"),
    ...messages.flatMap((message, index) => [text(`sender-${index}`, message.sender, 16, "#a9b8bd"), text(`text-${index}`, message.text, 27, "#f4efe6")])];
  const program = browserProgram({
    html: `<header><div class="status"></div><div>{{title}}<div class="subtitle">{{subtitle}}</div></div></header>
      <div class="viewport"><div class="messages">${messages.map((message, index) => `<article class="${message.side}" data-message="${index}">
      <div class="sender">{{sender-${index}}}</div><div class="bubble">{{text-${index}}}</div></article>`).join("")}</div></div>
      <footer><div class="dots"><i></i><i></i><i></i></div></footer>`,
    css: `:scope{background:#142b32;overflow:hidden}
      header{position:absolute;inset:0 0 auto;padding:48px 38px 32px;display:flex;align-items:center;gap:18px;border-bottom:1px solid #35505a;background:#1c353e}
      .status{width:17px;height:17px;border-radius:50%;background:#abda82;box-shadow:0 0 0 7px #304b43}
      .subtitle{margin-top:6px}.viewport{position:absolute;inset:164px 32px 96px;overflow:hidden}
      .messages{position:relative}article{margin:0 0 28px;max-width:84%;transform-origin:left bottom}
      article.right{margin-left:auto;transform-origin:right bottom}.sender{margin:0 10px 8px}
      .right .sender{text-align:right}.bubble{padding:20px 23px;border-radius:23px 23px 23px 5px;background:#304953;box-shadow:0 6px 0 #10262d}
      .right .bubble{background:#47694d;border-radius:23px 23px 5px 23px}footer{position:absolute;inset:auto 0 0;height:90px;background:#1c353e}
      .dots{display:flex;gap:9px;margin:35px 40px}.dots i{width:10px;height:10px;background:#a6b8b9;border-radius:50%}`,
    data: { times: messages.map(message => message.at.frame - window.span.startFrame), entrance: options.entranceFrames },
    setup: `const cards=[...root.querySelectorAll('article')], list=root.querySelector('.messages'), viewport=root.querySelector('.viewport'), dots=root.querySelector('.dots');
      return frame=>{
        let last=-1;
        cards.forEach((card,i)=>{
          const age=frame-data.times[i], visible=age>=0;
          card.style.display=visible?'block':'none';
          if(visible){last=i;const t=Math.min(1,age/data.entrance), p=1-Math.pow(1-t,3);
            card.style.opacity=String(p);card.style.transform='translateY('+(18*(1-p))+'px) scale('+(0.96+0.04*p)+')';}
        });
        const bottom=last<0?0:cards[last].offsetTop+cards[last].offsetHeight;
        const previous=last<1?0:cards[last-1].offsetTop+cards[last-1].offsetHeight;
        const t=last<0?1:Math.max(0,Math.min(1,(frame-data.times[last])/data.entrance));
        const before=Math.max(0,previous-viewport.clientHeight), after=Math.max(0,bottom-viewport.clientHeight);
        list.style.transform='translateY('+(-(before+(after-before)*(1-Math.pow(1-t,3))))+'px)';
        dots.style.opacity=last===cards.length-1?'0':'1';
        [...dots.children].forEach((dot,i)=>dot.style.transform='translateY('+(-3*(1+Math.sin(frame*.18-i)))+'px)');
      };`,
  });
  return sealVisualTrack({ id: options.id, programSpaceId: timeline.id, visualIr: "hypit.visual-ir@1",
    presents: [{ id: options.id, span: window.span, stacking: { order: 0, tieBreak: options.id },
      elements: [{ id: "chat", kind: "program", order: 0, program,
        style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 },
          { name: "width", value: `${canvas.widthPx}px` }, { name: "height", value: `${canvas.heightPx}px` }] }, ...children] }] });
}

```

### Core Architecture Module: `examples/semantic-composition/packages/performance-styles/src/render.ts`
```
import { sealVisualTrack } from "@hypit/hypit/composition";
import type { VisualElement } from "@hypit/hypit/composition";
import { browserProgram } from "@hypit/hypit/hyperframes";
import { projectTimelineMedia } from "@hypit/hypit/timeline";
import type { Timeline } from "@hypit/hypit/timeline";
import type { TemporalWindow } from "@hypit/hypit/temporal";
import type { SpatialFrame } from "@hypit/hypit/spatial";
import type { NarrativeExcerpt } from "@hypit/hypit/narrative";

/** Project behavior, not a registered special effect: the original Use window owns progress. */
export function movingFrame(timeline: Timeline, window: TemporalWindow, from: SpatialFrame, to: SpatialFrame) {
  return render(timeline, window, { from, to });
}
export function crossfade(timeline: Timeline, window: TemporalWindow, outgoing: NarrativeExcerpt, incoming: NarrativeExcerpt, frame: SpatialFrame) {
  for (const ref of [outgoing, incoming]) {
    if (ref.narrativeId !== timeline.narrativeId || !timeline.items.some(item => item.take.segment.segmentId === ref.id)) {
      throw new Error(`Unknown crossfade source ${ref.id}.`);
    }
  }
  return render(timeline, window, { outgoing: outgoing.id, incoming: incoming.id, from: frame, to: frame });
}
function render(timeline: Timeline, window: TemporalWindow, options: { from: SpatialFrame; to: SpatialFrame; outgoing?: string; incoming?: string }) {
  const id = window.subjectId;
  const clips = projectTimelineMedia(timeline, window.span).filter(clip => clip.media.visual !== undefined
    && (options.outgoing === undefined || clip.segmentId === options.outgoing || clip.segmentId === options.incoming));
  const videos: VisualElement[] = clips.map((clip, index) => ({
    id: `source-${index}`, parent: "scene", order: index + 1, kind: "video", muted: true,
    artifact: clip.media.visual!.artifact,
    attributes: [{ name: "data-source-role", value: options.incoming === clip.segmentId ? "incoming" : "outgoing" }],
    style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 }, { name: "width", value: "100%" }, { name: "height", value: "100%" }, { name: "object-fit", value: "cover" }],
    sampling: { sourceFrameRate: clip.media.timeline.frameRate, sourceFrameCount: clip.media.timeline.frameCount, segments: [{
      target: { startFrame: clip.span.startFrame - window.span.startFrame, endFrameExclusive: clip.span.endFrameExclusive - window.span.startFrame },
      sourceFrame: { numerator: clip.source.startFrame, denominator: 1 }, rate: { numerator: 1, denominator: 1 },
    }] },
  }));
  const program = browserProgram({
    html: `<div class="viewport">${videos.map((video,index) => `<div class="source" data-role="${clips[index]!.segmentId === options.incoming ? "incoming" : "outgoing"}">{{${video.id}}}</div>`).join("")}</div>`,
    css: `.viewport{position:absolute;overflow:hidden;isolation:isolate}.source{position:absolute;inset:0;${options.outgoing === undefined ? '' : 'mix-blend-mode:plus-lighter'}}`,
    data: { from: options.from, to: options.to, mixing: options.outgoing !== undefined, duration: window.span.endFrameExclusive - window.span.startFrame },
    setup: `const view=root.querySelector('.viewport'), sources=view.querySelectorAll('.source');
      return frame => {
        const p=Math.max(0,Math.min(1,frame/Math.max(1,data.duration-1)));
        const q=p*p*(3-2*p), a=data.from, b=data.to;
        Object.assign(view.style,{left:(a.xPx+(b.xPx-a.xPx)*q)+'px',top:(a.yPx+(b.yPx-a.yPx)*q)+'px',
          width:(a.widthPx+(b.widthPx-a.widthPx)*q)+'px',height:(a.heightPx+(b.heightPx-a.heightPx)*q)+'px'});
        if(data.mixing) for(const child of sources) {
          const role=child.dataset.role;
          child.style.opacity=String(role==='incoming'?p:1-p);
        }
      };`,
  });
  return sealVisualTrack({ id, programSpaceId: timeline.id, visualIr: "hypit.visual-ir@1", presents: videos.length ? [{ id, span: window.span,
    stacking: { order: 0, tieBreak: id }, elements: [{ id: "scene", kind: "program", order: 0, style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 }], program }, ...videos] }] : [] });
}

```

### Core Architecture Module: `examples/semantic-composition/packages/responsive-explainer/src/render.ts`
```
import { sealVisualTrack } from "@hypit/hypit/composition";
import type { VisualElement } from "@hypit/hypit/composition";
import { browserProgram } from "@hypit/hypit/hyperframes";
import type { FontArtifactRef } from "@hypit/hypit/media";
import { projectTimelineMedia, projectTimelineSpace } from "@hypit/hypit/timeline";
import type { Timeline } from "@hypit/hypit/timeline";
import type { CanvasSpace } from "@hypit/hypit/spatial";
import type { TemporalInstant, TemporalWindow } from "@hypit/hypit/temporal";

export type ExplainerOptions = { id: string; title: string; transitionFrames: number; stackingOrder: number };

/** One scene owns the moving performance viewport and the diagram it makes room for. */
export function renderExplainer(semantic: Timeline, canvas: CanvasSpace, window: TemporalWindow,
  reveal: TemporalInstant, fonts: readonly FontArtifactRef[], options: ExplainerOptions) {
  const space = projectTimelineSpace(semantic);
  if (window.start.source.spaceId !== space.id || reveal.source.spaceId !== space.id)
    throw new Error("Explainer timing must belong to its semantic performance.");
  if (!Number.isSafeInteger(options.transitionFrames) || options.transitionFrames < 1)
    throw new Error("Explainer transitionFrames must be a positive integer.");
  const clips = projectTimelineMedia(semantic, window.span).filter(clip => clip.media.visual !== undefined);
  const videos: VisualElement[] = clips.map((clip, i) => ({
    id: `take-${i}`, parent: "scene", kind: "video", order: i + 1,
    artifact: clip.media.visual!.artifact, muted: true,
    style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 },
      { name: "width", value: "100%" }, { name: "height", value: "100%" }, { name: "object-fit", value: "cover" }],
    sampling: { sourceFrameRate: clip.media.timeline.frameRate, sourceFrameCount: clip.media.timeline.frameCount,
      segments: [{ target: { startFrame: clip.span.startFrame - window.span.startFrame,
        endFrameExclusive: clip.span.endFrameExclusive - window.span.startFrame },
        sourceFrame: { numerator: clip.source.startFrame, denominator: 1 }, rate: { numerator: 1, denominator: 1 } }] },
  }));
  const labels: VisualElement[] = [options.title, "Intent", "Performance", "Composition"].map((text, i) => ({
    id: `label-${i}`, parent: "scene", kind: "text", order: videos.length + i + 1, text, fonts,
    style: [{ name: "font-size", value: `${i === 0 ? Math.round(canvas.widthPx * .035) : 23}px` }, { name: "color", value: "#f5eddc" },
      { name: "white-space", value: "nowrap" }],
  }));
  // Exact fonts belong to the typed text children; the program supplies layout and behavior.
  const program = browserProgram({
    html: `<div class="diagram"><div class="heading">{{label-0}}</div>
      <svg viewBox="0 0 440 300"><path d="M60 60 H320 V150 H60 V240 H320"/></svg>
      <div class="step first">{{label-1}}</div><div class="step second">{{label-2}}</div>
      <div class="step third">{{label-3}}</div></div>
      <div class="viewport">${videos.map(video => `{{${video.id}}}`).join("")}<div class="glass"></div></div>`,
    css: `:scope { background:#193c3a; overflow:hidden; }
      .viewport { position:absolute; overflow:hidden; isolation:isolate; }
      .glass { position:absolute; inset:auto 0 0; height:12%; backdrop-filter:blur(9px); background:rgba(20,40,40,.15); }
      .diagram { position:absolute; left:5%; top:17%; width:48%; height:70%; }
      .heading { position:absolute; top:0; left:0; }
      svg { position:absolute; inset:22% 0 0; width:100%; height:70%; overflow:visible; }
      path { fill:none; stroke:#c5e98b; stroke-width:4; stroke-linecap:round; stroke-dasharray:900; }
      .step { position:absolute; padding:14px 24px; border:1px solid #91c6a2; border-radius:16px; background:#285b51; }
      .first { left:2%; top:30%; } .second { right:2%; top:53%; } .third { left:2%; top:76%; }`,
    data: { width: canvas.widthPx, height: canvas.heightPx,
      reveal: reveal.frame - window.span.startFrame, transition: options.transitionFrames },
    setup: `const viewport=root.querySelector('.viewport'), diagram=root.querySelector('.diagram'), path=root.querySelector('path');
      return frame => {
        const t=Math.max(0, Math.min(1,(frame-data.reveal)/data.transition));
        const p=t*t*(3-2*t);
        Object.assign(viewport.style,{left:(p*.61*data.width)+'px',top:(p*.06*data.height)+'px',
          width:((1-p*.65)*data.width)+'px',height:((1-p*.12)*data.height)+'px',borderRadius:(p*24)+'px'});
        diagram.style.opacity=String(p); diagram.style.transform='translateX('+(-24*(1-p))+'px)';
        path.style.strokeDashoffset=String(900*(1-p));
      };`,
  });
  return sealVisualTrack({ id: options.id, programSpaceId: space.id, visualIr: "hypit.visual-ir@1",
    presents: [{ id: options.id, span: window.span, stacking: { order: options.stackingOrder, tieBreak: options.id },
      elements: [{ id: "scene", kind: "program", order: 0, program,
        style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 }] }, ...videos, ...labels] }] });
}

```

### Core Architecture Module: `examples/semantic-composition/packages/sound-styles/src/render.ts`
```
import { sealAudioTrack } from "@hypit/hypit/composition";
import { sourceSound } from "@hypit/hypit/sound";
import type { Timeline } from "@hypit/hypit/timeline";
import type { TemporalWindow } from "@hypit/hypit/temporal";
import type { NarrativeExcerpt } from "@hypit/hypit/narrative";

/** The family explicitly chooses the two roles; the Window only controls the blend progress. */
export function crossfadeSound(timeline: Timeline, window: TemporalWindow,
  outgoing: NarrativeExcerpt, incoming: NarrativeExcerpt) {
  if (outgoing.id === incoming.id && outgoing.narrativeId === incoming.narrativeId) throw new Error("Crossfade needs two distinct sources.");
  const left = sourceSound(timeline, window, outgoing, { gain: 1, endGain: 0 });
  const right = sourceSound(timeline, window, incoming, { gain: 0, endGain: 1 });
  return sealAudioTrack({ id: window.subjectId, programSpaceId: timeline.id, clips: [...left.clips, ...right.clips] });
}

```

### Core Architecture Module: `packages/caption-fine/src/render.ts`
```
import type { Timeline } from "@hypit/timeline";
import { assertCaptionProgramForDocument } from "@hypit/caption";
import type { CaptionProgram } from "@hypit/caption";
import { assertVisualTrackIdentity, sealVisualTrack } from "@hypit/composition";
import type {
  VisualAnimation,
  VisualBoxElement,
  VisualColorPaint,
  VisualElement,
  VisualKeyframe,
  VisualProgramElement,
  VisualStyleDeclaration,
  VisualTextElement,
  VisualTextPaintLayer,
  VisualTrack,
} from "@hypit/composition";
import type { CaptionAlignmentUnit, CaptionDocument, CaptionDisplayWord } from "@hypit/narrative";
import { assertProgramSpaceIdentity, programSpaceFrameCount } from "@hypit/program-space";
import { assertSpatialRegionTimeline } from "@hypit/spatial";
import type { CanvasSpace, SpatialFrame, SpatialRegionTimeline } from "@hypit/spatial";

import { assertFineCaptionParameters, FINE_CAPTION_FAMILY } from "./style.js";
import { assertFineCaptionSchedule } from "./schedule.js";
import { uniformGap, wordGaps } from "./spacing.js";
import { browserProgram } from "@hypit/hyperframes";
import { joinedBoxSetup } from "./joined-box.js";
import type {
  FineCaptionActiveUnderline,
  FineCaptionGlyphPaint,
  FineCaptionOneShotMotion,
  FineCaptionParameters,
  FineCaptionSchedule,
  FineCaptionUnderline,
} from "./types.js";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function compactNumber(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}

function alphaColor(hex: string, opacity: number): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const authoredAlpha = hex.length === 9 ? Number.parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return `rgba(${red},${green},${blue},${compactNumber(authoredAlpha * opacity)})`;
}

function typographyStyle(parameters: FineCaptionParameters): VisualStyleDeclaration[] {
  return [
    { name: "font-size", value: `${compactNumber(parameters.typography.fontSizePx)}px` },
    { name: "font-kerning", value: parameters.typography.kerning },
    { name: "font-variant-caps", value: parameters.typography.variantCaps },
    { name: "letter-spacing", value: `${compactNumber(parameters.layout.letterSpacingPx)}px` },
    { name: "line-height", value: parameters.layout.lineHeight },
    { name: "text-transform", value: parameters.typography.textTransform },
  ];
}

function underlineStyle(underline: FineCaptionUnderline | FineCaptionActiveUnderline): VisualStyleDeclaration[] {
  if (underline.mode === "off") return [];
  return [
    { name: "text-decoration", value: "underline" },
    { name: "text-decoration-color", value: underline.color },
    { name: "text-decoration-thickness", value: `${compactNumber(underline.thicknessPx)}px` },
    { name: "text-underline-offset", value: `${compactNumber(underline.offsetPx)}px` },
  ];
}

/**
 * The glyph body and its outline, as ordered Paint.
 *
 * An outline belongs outside the letter. `-webkit-text-stroke` cannot put it there: it centres the
 * stroke on the glyph edge, so half the width is always inside. Declaring the Paint hands placement
 * to the renderer, which keeps the authored width wholly outside while the body preserves the
 * original letterform.
 *
 * A caption with no outline keeps its plain fill, which is one element and one paint rather than
 * two, and is what most captions are.
 */
/**
 * CSS blur is a radius; a Gaussian blur is a deviation. The radius covers about two deviations, so
 * the same number means twice the cloud when it moves from one to the other. Authors tuned these
 * against the radius, and the outline is what moved, not the shadow.
 */
function deviationFromBlurRadius(radiusPx: number): number {
  return radiusPx / 2;
}

/**
 * The soft effects, ordered from the back forward.
 *
 * `text-shadow` paints its list front to back — the first shadow named is the one on top — while
 * Paint layers are drawn in the order they are declared. So this reverses: the far end of a long
 * shadow first, then the glow, then the drop shadow nearest the letter.
 */
function softPaints(paint: FineCaptionGlyphPaint): VisualTextPaintLayer[] {
  const layers: VisualTextPaintLayer[] = [];
  if (paint.longShadow.opacity > 0 && paint.longShadow.distancePx > 0) {
    const steps = Math.min(32, Math.max(1, Math.ceil(paint.longShadow.distancePx)));
    const radians = paint.longShadow.angleDeg * Math.PI / 180;
    for (let step = steps; step >= 1; step -= 1) {
      const distance = paint.longShadow.distancePx * step / steps;
      layers.push({
        kind: "shadow",
        paint: { kind: "solid", color: alphaColor(paint.longShadow.color, paint.longShadow.opacity) },
        offsetX: Math.cos(radians) * distance,
        offsetY: Math.sin(radians) * distance,
        blurPx: 0,
        spreadPx: 0,
      });
    }
  }
  if (paint.glow.opacity > 0) {
    layers.push({
      kind: "glow",
      paint: { kind: "solid", color: alphaColor(paint.glow.color, paint.glow.opacity) },
      blurPx: deviationFromBlurRadius(paint.glow.blurPx),
      spreadPx: paint.glow.spreadPx,
    });
  }
  if (paint.shadow.opacity > 0) {
    layers.push({
      kind: "shadow",
      paint: { kind: "solid", color: alphaColor(paint.shadow.color, paint.shadow.opacity) },
      offsetX: paint.shadow.offsetXPx,
      offsetY: paint.shadow.offsetYPx,
      blurPx: deviationFromBlurRadius(paint.shadow.blurPx),
      spreadPx: paint.shadow.spreadPx,
    });
  }
  return layers;
}

function glyphPaints(paint: FineCaptionGlyphPaint): VisualTextPaintLayer[] | undefined {
  if (paint.stroke.widthPx === 0 && paint.shadow.spreadPx === 0 && paint.glow.spreadPx === 0) return undefined;
  const fill: VisualColorPaint = paint.gradient === undefined
    ? { kind: "solid", color: paint.fill }
    : {
        kind: "linear-gradient",
        angleDeg: paint.gradient.angleDeg,
        stops: [
          { offset: 0, color: paint.gradient.from, opacity: 1 },
          { offset: 1, color: paint.gradient.to, opacity: 1 },
        ],
      };
  // Back to front: the soft effects fall behind the outline they are cast from, the outline sits
  // outside the letter, and the body sits over its own outline.
  return [
    ...softPaints(paint),
    ...(paint.stroke.widthPx === 0 ? [] : [{
      kind: "stroke" as const,
      placement: "outside" as const,
      widthPx: paint.stroke.widthPx,
      paint: { kind: "solid" as const, color: paint.stroke.color },
    }]),
    { kind: "fill", paint: fill },
  ];
}

/** The Paint fields of a text element, absent rather than empty when there is no outline. */
function glyphPaintFields(paint: FineCaptionGlyphPaint): { paints?: readonly VisualTextPaintLayer[] } {
  const paints = glyphPaints(paint);
  return paints === undefined ? {} : { paints };
}

function glyphStyle(
  parameters: FineCaptionParameters,
  paint: FineCaptionGlyphPaint,
  underline?: FineCaptionUnderline,
): VisualStyleDeclaration[] {
  const shadows: string[] = [];
  if (paint.shadow.opacity > 0) {
    shadows.push([
      `${compactNumber(paint.shadow.offsetXPx)}px`,
      `${compactNumber(paint.shadow.offsetYPx)}px`,
      `${compactNumber(paint.shadow.blurPx)}px`,
      alphaColor(paint.shadow.color, paint.shadow.opacity),
    ].join(" "));
  }
  if (paint.glow.opacity > 0) {
    shadows.push(`0 0 ${compactNumber(paint.glow.blurPx)}px ${alphaColor(paint.glow.color, paint.glow.opacity)}`);
  }
  if (paint.longShadow.opacity > 0 && paint.longShadow.distancePx > 0) {
    const steps = Math.min(32, Math.max(1, Math.ceil(paint.longShadow.distancePx)));
    const radians = paint.longShadow.angleDeg * Math.PI / 180;
    for (let step = 1; step <= steps; step += 1) {
      const distance = paint.longShadow.distancePx * step / steps;
      shadows.push([
        `${compactNumber(Math.cos(radians) * distance)}px`,
        `${compactNumber(Math.sin(radians) * distance)}px`,
        "0",
        alphaColor(paint.longShadow.color, paint.longShadow.opacity),
      ].join(" "));
    }
  }
  // An outlined caption carries its body and outline as Paint instead, so the fill is spelled once
  // — there, not here — and the two cannot disagree.
  const painted = glyphPaints(paint) !== undefined;
  return [
    ...(painted ? [] : [{ name: "color", value: paint.fill }] as const),
    ...typographyStyle(parameters),
    { name: "min-width", value: "0" },
    { name: "opacity", value: paint.opacity },
    { name: "white-space", value: "normal" },
    ...(painted || paint.gradient === undefined ? [] : [
      { name: "background-image", value: `linear-gradient(${compactNumber(paint.gradient.angleDeg)}deg,${paint.gradient.from},${paint.gradient.to})` },
      { name: "background-clip", value: "text" },
      { name: "-webkit-background-clip", value: "text" },
      { name: "-webkit-text-fill-color", value: "transparent" },
    ] as const),
    // An outlined caption casts its shadows as Paint, behind the outline. Left here as well they
    // would be cast by the body alone, and so land on top of the ring they are supposed to be under.
    ...(painted || shadows.length === 0 ? [] : [{ name: "text-shadow", value: shadows.join(",") }] as const),
    ...(underline === undefined ? [] : underlineStyle(underline)),
  ];
}

function transparentGlyphStyle(
  parameters: FineCaptionParameters,
  underline?: FineCaptionUnderline | FineCaptionActiveUnderline,
): VisualStyleDeclaration[] {
  return [
    { name: "color", value: "#00000000" },
    ...typographyStyle(parameters),
    { name: "min-width", value: "0" },
    { name: "white-space", value: "normal" },
    ...(underline === undefined ? [] : underlineStyle(underline)),
  ];
}

function styleIdentity(style: readonly VisualStyleDeclaration[]): string {
  return JSON.stringify(style);
}

function animationFrom(
  durationFrames: number,
  offsets: It
```

### Core Architecture Module: `packages/core/src/error.ts`
```
import { SvmlError } from "@hypit/protocol";

export function invariant(
  condition: unknown,
  code: string,
  message: string,
  subject?: string,
): asserts condition {
  if (!condition) {
    throw new SvmlError(code, message, subject);
  }
}

```

### Core Architecture Module: `packages/core/src/graph.ts`
```
import type {
  BuildRequest,
  Candidate,
  CandidateRoot,
  CompiledGraph,
  GraphValueRef,
  LinkedProgram,
  LogicalOutput,
  OperationNode,
  OperationResult,
  StoredValue,
  TypeRef,
  TypedRecord,
} from "@hypit/protocol";

import { canonicalize } from "@hypit/protocol";
import { invariant } from "./error.js";
import { resolveProducer, verifyRecordStructure } from "./link.js";
import { producerKey, sameType, typeKey } from "./reference.js";

type GraphIndex = {
  readonly outputs: ReadonlyMap<string, LogicalOutput>;
  readonly candidates: ReadonlyMap<string, Candidate>;
  readonly operations: ReadonlyMap<string, OperationNode>;
};

const graphIndexes = new WeakMap<CompiledGraph, GraphIndex>();
const programRecordIndexes = new WeakMap<LinkedProgram, ReadonlyMap<string, LinkedProgram["records"][number]>>();

function graphIndex(graph: CompiledGraph): GraphIndex {
  const existing = graphIndexes.get(graph);
  if (existing !== undefined) return existing;
  const created = {
    outputs: new Map(graph.outputs.map((item) => [item.id, item])),
    candidates: new Map(graph.candidates.map((item) => [item.id, item])),
    operations: new Map(graph.operations.map((item) => [item.id, item])),
  };
  graphIndexes.set(graph, created);
  return created;
}

function programRecords(program: LinkedProgram): ReadonlyMap<string, LinkedProgram["records"][number]> {
  const existing = programRecordIndexes.get(program);
  if (existing !== undefined) return existing;
  const created = new Map(program.records.map((item) => [item.id, item]));
  programRecordIndexes.set(program, created);
  return created;
}

function normalizeRef(ref: GraphValueRef): GraphValueRef {
  if (ref.kind === "record") return { kind: "record", id: ref.id };
  if (ref.kind === "logical-output") return { kind: "logical-output", id: ref.id };
  return { kind: "operation-result", operation: ref.operation };
}

function normalizedStoredValue(value: StoredValue): StoredValue {
  if (value.kind === "inline") return { kind: "inline", value: canonicalize(value.value) };
  return {
    kind: "blob",
    resource: value.resource,
    size: value.size,
    mediaType: value.mediaType,
  };
}

function normalizeRoot(root: CandidateRoot): CandidateRoot {
  if (root.kind === "operation") {
    return { kind: "operation", result: { kind: "operation-result", operation: root.result.operation } };
  }
  const value = {
    id: root.value.id,
    value: normalizedStoredValue(root.value.value),
  };
  return { kind: "value", value };
}

function normalizeOutput(output: LogicalOutput): LogicalOutput {
  return {
    id: output.id,
    type: output.type,
    primary: output.primary,
  };
}

function normalizeCandidate(candidate: Candidate): Candidate {
  return {
    id: candidate.id,
    type: candidate.type,
    root: normalizeRoot(candidate.root),
  };
}

function normalizeResult(result: OperationResult): OperationResult {
  if (result.kind === "output") {
    return { kind: "output", name: result.name, record: result.record };
  }
  return {
    kind: "need",
    name: result.name,
    id: result.id,
    record: result.record,
  };
}

function normalizeOperation(operation: OperationNode): OperationNode {
  return {
    id: operation.id,
    producer: operation.producer,
    inputs: Object.fromEntries(
      Object.entries(operation.inputs)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, ref]) => [name, normalizeRef(ref)]),
    ),
    result: normalizeResult(operation.result),
  };
}

export function sealCompiledGraph(
  graph: Omit<CompiledGraph, "format">,
): CompiledGraph {
  const normalized = {
    outputs: [...graph.outputs].map(normalizeOutput).sort((a, b) => a.id.localeCompare(b.id)),
    candidates: [...graph.candidates].map(normalizeCandidate).sort((a, b) => a.id.localeCompare(b.id)),
    operations: [...graph.operations].map(normalizeOperation).sort((a, b) => a.id.localeCompare(b.id)),
  };
  return {
    format: "hypit.graph@1" as const,
    ...normalized,
  };
}

export function sealBuildRequest(
  request: Omit<BuildRequest, "format">,
): BuildRequest {
  const targets = [...request.targets]
    .map((target) => ({ output: target.output }))
    .sort((a, b) => a.output.localeCompare(b.output));
  return {
    format: "hypit.build-request@1" as const,
    targets,
  };
}

export function resolveLogicalOutput(graph: CompiledGraph, id: string): LogicalOutput {
  const output = graphIndex(graph).outputs.get(id);
  invariant(output !== undefined, "UNKNOWN_LOGICAL_OUTPUT", `unknown logical output ${id}`, id);
  return output;
}

export function resolveCandidate(graph: CompiledGraph, id: string): Candidate {
  const candidate = graphIndex(graph).candidates.get(id);
  invariant(candidate !== undefined, "UNKNOWN_CANDIDATE", `unknown Candidate ${id}`, id);
  return candidate;
}

export function resolveOperation(graph: CompiledGraph, id: string): OperationNode {
  const operation = graphIndex(graph).operations.get(id);
  invariant(operation !== undefined, "UNKNOWN_OPERATION", `unknown Operation ${id}`, id);
  return operation;
}

export function satisfiedCandidate(
  graph: CompiledGraph,
  outputId: string,
): Candidate {
  const output = resolveLogicalOutput(graph, outputId);
  return resolveCandidate(graph, output.primary);
}

export function operationResultRecord(operation: OperationNode): string {
  return operation.result.record;
}

function operationResultType(program: LinkedProgram, operation: OperationNode): TypeRef {
  const producer = resolveProducer(program.closure, operation.producer);
  if (operation.result.kind === "output") {
    const output = producer.outputs.find((port) => port.name === operation.result.name);
    invariant(
      output !== undefined && producer.needs.length === 0,
      "OPERATION_RESULT_MISMATCH",
      `${operation.id} does not produce output ${operation.result.name}`,
      operation.id,
    );
    return output.type;
  }
  const need = producer.needs.find((port) => port.name === operation.result.name);
  invariant(
    need !== undefined && producer.outputs.length === 0,
    "OPERATION_RESULT_MISMATCH",
    `${operation.id} does not request Need ${operation.result.name}`,
    operation.id,
  );
  return need.returns;
}

function graphValueType(program: LinkedProgram, graph: CompiledGraph, ref: GraphValueRef): TypeRef {
  if (ref.kind === "record") {
    const record = programRecords(program).get(ref.id);
    invariant(record !== undefined, "UNKNOWN_GRAPH_INPUT", `unknown authored record ${ref.id}`, ref.id);
    return record.type;
  }
  if (ref.kind === "logical-output") return resolveLogicalOutput(graph, ref.id).type;
  return operationResultType(program, resolveOperation(graph, ref.operation));
}

function exactKeys(
  actual: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  subject: string,
): void {
  const left = Object.keys(actual).sort();
  const right = [...expected].sort();
  invariant(
    JSON.stringify(left) === JSON.stringify(right),
    "GRAPH_PORT_BINDING_MISMATCH",
    `${subject} binds [${left.join(", ")}] but declares [${right.join(", ")}]`,
    subject,
  );
}

function verifyOperation(program: LinkedProgram, graph: CompiledGraph, operation: OperationNode): void {
  invariant(operation.id.length > 0, "EMPTY_OPERATION_ID", "Operation id is empty");
  invariant(operation.result.record.length > 0, "EMPTY_RECORD_ID", `${operation.id} result record is empty`);
  const producer = resolveProducer(program.closure, operation.producer);
  exactKeys(operation.inputs, producer.inputs.map((port) => port.name), `${operation.id}.inputs`);
  invariant(
    producer.outputs.length + producer.needs.length === 1,
    "PRODUCER_RESULT_NORMAL_FORM",
    `${producerKey(operation.producer)} must declare exactly one public result`,
  );
  operationResultType(program, operation);
  if (operation.result.kind === "need") {
    invariant(operation.result.id.length > 0, "EMPTY_NEED_ID", `${operation.id} Need id is empty`);
  }
  for (const declaration of producer.inputs) {
    const supplied = graphValueType(program, graph, operation.inputs[declaration.name] as GraphValueRef);
    invariant(
      sameType(supplied, declaration.type),
      "GRAPH_INPUT_TYPE_MISMATCH",
      `${operation.id}.${declaration.name} wants ${typeKey(declaration.type)} but receives ${typeKey(supplied)}`,
      operation.id,
    );
  }
}

function verifyCandidateValue(program: LinkedProgram, graph: CompiledGraph, candidate: Candidate): void {
  if (candidate.root.kind === "operation") {
    const supplied = operationResultType(program, resolveOperation(graph, candidate.root.result.operation));
    invariant(
      sameType(supplied, candidate.type),
      "CANDIDATE_RESULT_TYPE_MISMATCH",
      `${candidate.id} declares ${typeKey(candidate.type)} but returns ${typeKey(supplied)}`,
      candidate.id,
    );
    return;
  }
  const provisional: TypedRecord = {
    id: candidate.root.value.id,
    type: candidate.type,
    value: candidate.root.value.value,
  };
  verifyRecordStructure(program.closure, provisional);
}

function verifySatisfaction(
  output: LogicalOutput,
  candidate: Candidate,
): void {
  invariant(
    sameType(candidate.type, output.type),
    "CANDIDATE_RESULT_TYPE_MISMATCH",
    `${candidate.id} supplies ${typeKey(candidate.type)}, not ${typeKey(output.type)}`,
    candidate.id,
  );
}

export function verifyCompiledGraph(program: LinkedProgram, graph: CompiledGraph): void {
  invariant(graph.format === "hypit.graph@1", "UNSUPPORTED_GRAPH", "unsupported compiled graph format");
  const outputIds = new Set<string>();
  const candidateIds = new Set<string>();
  const operationIds = new Set<string>();
  const operationRecords = new Set(program.records.map((record) => record.id));
  const needIds = new Set<string>();

  for (const output of graph.outputs) {
    invariant(output.id.length > 0, "EMPTY_LOGICAL_OUTPUT_ID", "Logical Output id is empty");
    invariant(!outputIds.has(output.id), "DUPLICATE_LOGI
```

### Core Architecture Module: `packages/core/src/index.ts`
```
export {
  createResolvedClosure,
  link,
  resolveProducer,
  resolveType,
  sealRecord,
  verifyClosure,
  verifyRecordStructure,
} from "./link.js";
export {
  sealBuildRequest,
  sealCompiledGraph,
  resolveLogicalOutput,
  resolveCandidate,
  resolveOperation,
  satisfiedCandidate,
  operationResultRecord,
  verifyBuildRequest,
  verifyCompiledGraph,
} from "./graph.js";
export { compileBuild, planBuild, plannedNeeds } from "./plan.js";
export type { BuildCandidateSelection, PlannedExecution, PlannedNeed } from "./plan.js";
export { sliceExecution } from "./slice.js";
export {
  admitBuildResult,
  defineBuild,
  materializeBuild,
  resolveNeedCommand,
  reduce,
  start,
} from "./reducer.js";
export { BuildMachine } from "./machine.js";

```

### Core Architecture Module: `packages/core/src/link.ts`
```
import type {
  LinkedProgram,
  ModuleManifest,
  ModuleRef,
  ProducerRef,
  ResolvedModule,
  ResolvedModuleClosure,
  ResolvedCapabilityDeclaration,
  ResolvedProducerDeclaration,
  ResolvedTypeDeclaration,
  TypeRef,
  TypedRecord,
} from "@hypit/protocol";

import { invariant } from "./error.js";
import { capabilityKey, moduleKey, producerKey, typeKey } from "./reference.js";

type ClosureIndex = {
  readonly types: ReadonlyMap<string, ResolvedTypeDeclaration>;
  readonly producers: ReadonlyMap<string, ResolvedProducerDeclaration>;
};

const closureIndexes = new WeakMap<ResolvedModuleClosure, ClosureIndex>();

function manifestRef(manifest: ModuleManifest): ModuleRef {
  return { name: manifest.name, version: manifest.version };
}

function closureIndex(closure: ResolvedModuleClosure): ClosureIndex {
  const existing = closureIndexes.get(closure);
  if (existing !== undefined) return existing;
  const types = new Map<string, ResolvedTypeDeclaration>();
  const producers = new Map<string, ResolvedProducerDeclaration>();
  for (const module of closure.modules) {
    const ref = manifestRef(module.manifest);
    for (const declaration of module.manifest.types) {
      const type = { module: ref, name: declaration.name };
      types.set(typeKey(type), { ...declaration, ref: type });
    }
    for (const declaration of module.manifest.producers) {
      const producer = { module: ref, name: declaration.name };
      producers.set(producerKey(producer), { ...declaration, ref: producer });
    }
  }
  const created = { types, producers };
  closureIndexes.set(closure, created);
  return created;
}

export function createResolvedClosure(
  manifests: readonly ModuleManifest[],
): ResolvedModuleClosure {
  const modules = manifests.map((manifest) => ({ manifest: structuredClone(manifest) }));
  return {
    format: "hypit.closure@1",
    modules,
  };
}

function ensureUniqueNames(names: readonly string[], kind: string, owner: string): void {
  const seen = new Set<string>();
  for (const name of names) {
    invariant(name.length > 0, "EMPTY_NAME", `${kind} name in ${owner} is empty`, owner);
    invariant(!seen.has(name), "DUPLICATE_EXPORT", `${owner} declares duplicate ${kind} ${name}`, name);
    seen.add(name);
  }
}

export function verifyClosure(closure: ResolvedModuleClosure): void {
  invariant(closure.format === "hypit.closure@1", "UNSUPPORTED_CLOSURE", "unsupported closure format");

  const modules = new Map<string, ResolvedModule>();
  const declaredTypes = new Set<string>();
  const declaredCapabilities = new Map<string, ResolvedCapabilityDeclaration>();
  for (const module of closure.modules) {
    const ref = manifestRef(module.manifest);
    const key = moduleKey(ref);
    invariant(ref.name.length > 0, "EMPTY_MODULE_NAME", "module name is empty");
    invariant(ref.version.length > 0, "EMPTY_MODULE_VERSION", `${ref.name} version is empty`);
    invariant(module.manifest.format === "hypit.module@1", "UNSUPPORTED_MODULE", `${key} format is unsupported`);
    invariant(!modules.has(key), "DUPLICATE_MODULE", `duplicate module ${key}`, key);
    ensureUniqueNames(module.manifest.types.map((item) => item.name), "type", key);
    ensureUniqueNames(module.manifest.capabilities.map((item) => item.name), "capability", key);
    ensureUniqueNames(module.manifest.producers.map((item) => item.name), "producer", key);
    ensureUniqueNames(
      module.manifest.dependencies.map((item) => moduleKey(item.module)),
      "dependency",
      key,
    );
    for (const producer of module.manifest.producers) {
      ensureUniqueNames(producer.inputs.map((item) => item.name), "input port", `${key}#${producer.name}`);
      ensureUniqueNames(producer.outputs.map((item) => item.name), "output port", `${key}#${producer.name}`);
      ensureUniqueNames(producer.needs.map((item) => item.name), "need port", `${key}#${producer.name}`);
      invariant(
        producer.outputs.length + producer.needs.length === 1,
        "PRODUCER_RESULT_NORMAL_FORM",
        `${key}#${producer.name} must declare exactly one public result`,
      );
    }
    for (const type of module.manifest.types) {
      declaredTypes.add(typeKey({ module: ref, name: type.name }));
    }
    for (const capability of module.manifest.capabilities) {
      const capabilityRef = { module: ref, name: capability.name };
      declaredCapabilities.set(capabilityKey(capabilityRef), { ...capability, ref: capabilityRef });
    }
    modules.set(key, module);
  }

  for (const module of closure.modules) {
    for (const dependency of module.manifest.dependencies) {
      const resolved = modules.get(moduleKey(dependency.module));
      invariant(
        resolved !== undefined,
        "MISSING_DEPENDENCY",
        `${moduleKey(module.manifest)} requires ${moduleKey(dependency.module)}`,
      );
    }
  }

  for (const module of closure.modules) {
    const allowed = new Set([
      moduleKey(module.manifest),
      ...module.manifest.dependencies.map((dependency) => moduleKey(dependency.module)),
    ]);
    for (const producer of module.manifest.producers) {
      for (const port of [...producer.inputs, ...producer.outputs]) {
        invariant(
          allowed.has(moduleKey(port.type.module)),
          "UNDECLARED_TYPE_DEPENDENCY",
          `${moduleKey(module.manifest)}#${producer.name} references ${typeKey(port.type)} without a dependency`,
        );
        invariant(
          declaredTypes.has(typeKey(port.type)),
          "UNKNOWN_TYPE",
          `${moduleKey(module.manifest)}#${producer.name} references unknown type ${typeKey(port.type)}`,
        );
      }
      for (const port of producer.needs) {
        invariant(
          allowed.has(moduleKey(port.returns.module)),
          "UNDECLARED_TYPE_DEPENDENCY",
          `${moduleKey(module.manifest)}#${producer.name} references ${typeKey(port.returns)} without a dependency`,
        );
        invariant(
          declaredTypes.has(typeKey(port.returns)),
          "UNKNOWN_TYPE",
          `${moduleKey(module.manifest)}#${producer.name} references unknown type ${typeKey(port.returns)}`,
        );
        invariant(
          allowed.has(moduleKey(port.capability.module)),
          "UNDECLARED_CAPABILITY_DEPENDENCY",
          `${moduleKey(module.manifest)}#${producer.name} references ${capabilityKey(port.capability)} without a dependency`,
        );
        const capability = declaredCapabilities.get(capabilityKey(port.capability));
        invariant(
          capability !== undefined,
          "UNKNOWN_CAPABILITY",
          `${moduleKey(module.manifest)}#${producer.name} references unknown capability ${capabilityKey(port.capability)}`,
        );
        invariant(
          typeKey(capability.returns) === typeKey(port.returns),
          "CAPABILITY_RETURN_MISMATCH",
          `${capabilityKey(port.capability)} returns ${typeKey(capability.returns)}, not ${typeKey(port.returns)}`,
        );
      }
    }
    for (const capability of module.manifest.capabilities) {
      const ref = { module: manifestRef(module.manifest), name: capability.name };
      invariant(
        allowed.has(moduleKey(capability.returns.module)),
        "UNDECLARED_TYPE_DEPENDENCY",
        `${capabilityKey(ref)} returns ${typeKey(capability.returns)} without a dependency`,
      );
      invariant(
        declaredTypes.has(typeKey(capability.returns)),
        "UNKNOWN_TYPE",
        `${capabilityKey(ref)} returns unknown type ${typeKey(capability.returns)}`,
      );
    }
  }
}

export function resolveType(
  closure: ResolvedModuleClosure,
  ref: TypeRef,
): ResolvedTypeDeclaration {
  const declaration = closureIndex(closure).types.get(typeKey(ref));
  invariant(declaration !== undefined, "UNKNOWN_TYPE", `unknown type ${typeKey(ref)}`, typeKey(ref));
  return declaration;
}

export function resolveProducer(
  closure: ResolvedModuleClosure,
  ref: ProducerRef,
): ResolvedProducerDeclaration {
  const declaration = closureIndex(closure).producers.get(producerKey(ref));
  invariant(
    declaration !== undefined,
    "UNKNOWN_PRODUCER",
    `unknown producer ${producerKey(ref)}`,
    producerKey(ref),
  );
  return declaration;
}

export function sealRecord(record: TypedRecord): TypedRecord {
  return { ...record };
}

export function verifyRecordStructure(
  closure: ResolvedModuleClosure,
  record: TypedRecord,
): ResolvedTypeDeclaration {
  invariant(record.id.length > 0, "EMPTY_RECORD_ID", "record id is empty");
  const declaration = resolveType(closure, record.type);
  return declaration;
}

export function link(
  closure: ResolvedModuleClosure,
  authoredRecords: readonly TypedRecord[],
): LinkedProgram {
  const program: LinkedProgram = {
    closure,
    records: [...authoredRecords],
  };
  verifyLinkedProgram(program);
  return program;
}

export function verifyLinkedProgram(program: LinkedProgram): void {
  verifyClosure(program.closure);
  const ids = new Set<string>();
  for (const record of program.records) {
    invariant(!ids.has(record.id), "DUPLICATE_RECORD", `duplicate record ${record.id}`, record.id);
    ids.add(record.id);
    verifyRecordStructure(program.closure, record);
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #369** (2026-09-30): **[Bug] HypiHub 当前模型目录接口不可达**
  *Symptoms*: ### What happened  <img width="1140" height="361" alt="Image" src="https://github.com/user-attachments/assets/6dc37984-fa93-4736-ab65-5e23351381cb" />  ### What you expected  好像上游接口又有问题了？😂这两天一直没办法生成，难得生成一个有点小问题。  ### How to reproduce  codex里调用skill执行复刻生成，前面都正常解析，说明生成费用，但到生成授权时就不行了  ### Hypit version  0.2.16  ### Coding agent  _No response_  ### Model service  _No response_  ### Logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Taking this one — the screenshot pinpoints it, and unlike #366/#367/#368 this part is fixable on the Hypit side. Root cause:  **Where it fails.** The failure phase "HypiHub GPT Image 2 模型目录检查 / generation not submitted: fetch failed" is `verifyModelRoute` (`packages/provider-hypihub/src/provider.ts`): before every submission the Provider reads `GET /v1/models/<model>` to confirm the model card lists the operation. Until now, **any** failure of that read — including a pure transport failure like `fetch failed` — was wrapped into "HypiHub model catalogue check failed; … generation not submitted" and permanently failed the Build, before a single reference was uploaded and before any job was created. That is why three Build retries all died at the same step with 0 credits spent and Seedance never started: the catalogue route was unreachable while the rest of the service (plan, pricing reads you saw succeed moments earlier) answered fine, so a catalogue outage was silently escalated into a 
  > PR: #371 — the catalogue precheck now skips only when the read carries no verdict (transport failure, 429/5xx), reports the skip as progress, and lets the submission itself decide; definitive catalogue answers still fail fast before any upload.

- **Issue #367** (2026-09-30): **[Bug] HypiHub seedance-2-mini jobs fail with 402 "Credits insufficient" despite sufficient balance**
  *Symptoms*: ### What happened  Since 2026-09-29 06:46 UTC, `bytedance/seedance-2-mini` (reference video) jobs submitted through HypiHub fail shortly after submission with:  HypiHub job <id> failed; 402; model=bytedance/seedance-2-mini: Credits insufficient : Your current balance isn't enough to run this request. Please top up to continue.  - My HypiHub balance is about 2,090 credits, and the failed jobs charge nothing (Credits "—" in Projects). - The jobs are created and appear as "Failed" in Projects, so the failure seems to happen after submission, not at the balance check. - It fails regardless of size: 720p / 11-12 s, 720p / 7 s, and a small 480p / 4 s test (~11 credits) fail the same way. - It is intermittent: jobs succeeded at 2026-09-29 04:27 UTC and at 2026-09-29 15:04 UTC, but failed from 06:46 to 12:42 UTC on Sep 29 (12 jobs) and again from 21:34 UTC on Sep 29 (4 jobs so far, including a single job submitted alone). - I've emailed official@hypit.ai with job IDs and can share my account email privately.  ### What you expected  The job should run and be charged normally (about 5.75 credits/s at 720p with a reference video), since the balance covers it.  ### How to reproduce  1. Author a production with the Seedance 2 Mini Surface: 6 reference images (person references + one background with person-reference="false") and 1 reference video (576x1024, constant 30 fps, 7-12 s), 720p. 2. `hypit build <run>.svrun --follow` 3. The HypiHub job is submitted, then fails with the 402 above w
  **Post-Mortem & Fix Analysis**:
  > Taking this one on the Hypit side — I've traced where the message comes from and prepared a client-side improvement; summary of the root cause below.  **Where the message is produced.** `HypiHub job <id> failed; 402; model=…` is emitted by `hypiHubJobFailure` (`packages/provider-hypihub/src/errors.ts`), which only runs for a job the service has already created (terminal states `failed` / `queue_expired` / `canceled`). So HypiHub accepted the submission and created the job, and its **own billing precheck rejected it afterwards** — exactly the sequence this issue describes ("created and appear as Failed in Projects … after submission, not at the balance check").  **Hypit performs no balance check of its own.** The submission path sends a deterministic wire body (`model`, `prompt`, `resolution`, `aspect_ratio`, `seconds`, `generate_audio`, `web_search`, plus staged `reference_*` URLs — pinned by provider tests) and nothing reads an account balance; the guide documents permission as "separ
  > PR: #370 — keeps the service's facts verbatim and appends the post-submission billing-precheck explanation (with tests). The service-side credit-ledger reservation precheck still needs HypiHub's own fix; the job ids in this issue and in #368 are what support needs to trace it.
  > We checked the later failed jobs. Seedance’s reference-image review returned: “The request failed because the input image may contain sensitive information.”  HypiHub incorrectly displayed this as “Credits insufficient,” which was misleading. Your HypiHub balance was sufficient, and the failed jobs were fully refunded. We’ve now fixed the error-reporting issue. We’re very sorry for the confusion and inconvenience this caused.

- **Issue #366** (2026-09-29): **[Bug] HypiHub 准备 Seedance 2.5 视频请求fetch failed**
  *Symptoms*: ### What happened  <img width="1008" height="154" alt="Image" src="https://github.com/user-attachments/assets/1129268d-a0e4-4cbe-a12a-a2f5d0ac51fc" />  用新版 Hypit 0.2.16 再试，仍然失败： - 失败位置：HypiHub 准备 Seedance 2.5 视频请求 - 错误：fetch failed - 状态：generation not submitted  ### What you expected  ...  ### How to reproduce  ...  ### Hypit version  0.2.16   ### Coding agent  _No response_  ### Model service  _No response_  ### Logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > <img width="948" height="538" alt="Image" src="https://github.com/user-attachments/assets/7ec40306-6725-44c4-86ff-e4204cd8748b" />
  > Build：bld_20260929T025821106Z_EFCE87795E 错误：HypiHub 请求准备阶段 fetch failed 状态：generation not submitted
  > 非常抱歉！您可以提供一下注册 HypiHub 的邮箱吗，我这就去检查

- **Issue #359** (2026-09-26): **https://hypit.ai/订阅服务[Bug]**
  *Symptoms*: ### What happened  在https://hypit.ai/订阅网站里，单个账号创建的订阅订单在不支付的情况下，关闭这笔订阅订单的支付界面后，重新创建新的订阅订单会提示“上一次结账还在准备中，请稍等后重试”，去账号的账单界面查看会发现上一次创建的未支付订阅订单会一直卡在账号的账单里面并未随着关闭支付界面后自动结束这笔订单，也没有手动关闭此订单的入口，导致这个账号无法重新创建新的订阅订单购买服务  <img width="1884" height="502" alt="Image" src="https://github.com/user-attachments/assets/c30a4e25-21d1-4fb2-b563-6631143fc0f2" /> <img width="1242" height="672" alt="Image" src="https://github.com/user-attachments/assets/81ab30a2-e3a5-42f7-86e3-69e1ec8dab5e" /> <img width="1221" height="478" alt="Image" src="https://github.com/user-attachments/assets/8c58c29e-477e-452c-819d-ad382823e90f" />  ### What you expected  无  ### How to reproduce  无  ### Hypit version  https://hypit.ai/  ### Coding agent  _No response_  ### Model service  _No response_  ### Logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，已修复。

- **Issue #352** (2026-09-25): **[Bug] 使用codex调用skill时为什么会出现把需要复刻的视频传入另外个视频剪辑软件并读取积分的情况？**
  *Symptoms*: ### What happened   使用codex调用skill时，因为打开了一款在codex上也有连接的桌面版软件chatcut，skill把需要复刻的视频传入了chatcut中，并读取了chatcut的积分，但因为chatcut没什么积分，hypit没有执行复刻任务。  <img width="1165" height="658" alt="Image" src="https://github.com/user-attachments/assets/10a8478b-bc4c-4a3e-ab90-44e95d7e5598" />  ### What you expected  我不知道是提示词问题，还是什么原因。因为我是从skill入口点击启用skiill的，如果是提示词问题，那是否有什么解决办法？即如果用户开启了类似chatcut这种桌面软件，其同时在codex里也有skill的，那这个可以避免吗？  <img width="772" height="112" alt="Image" src="https://github.com/user-attachments/assets/38c3aee9-bd7a-4895-9445-632be1f0de66" />  ### How to reproduce  高度复刻附件参考视频的画面构图、固定机位、镜头顺序、动作时间点、主体运动轨迹和遮挡关系。具体要求：   1、将视频中的人物改成具有美国美国南部特征的白人男性，与此同时，白人男性背着的背包改成我们的产品 xxxx 2、动作保持一致 3、人物动作和产品运动应与参考视频逐段对应。所有连续动作必须保持人物、产品、尺度、方向和空间位置一致。产品与人物发生接触时保持真实手部关系和物理惯性。任何跨越字幕、界面或画面区域的物体都位于正确的前景层，并按参考轨迹连续穿过。禁止复制、瞬移、变形、突然缩放、残影、涂抹、白边、额外物体和未经要求的镜头变化。 最终分析完告诉我整体生成费用。  ### Hypit version  0.2.10  ### Coding agent  _No response_  ### Model service  _No response_  ### Logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > 我们的 skill 中没有将 HypiHub（Hypit 的官方 api 服务）作为唯一的 provider，这也与我们一向推荐的 BYOK 方式相符。您的 Agent 可能发现了本地已经安装了可以作为视频生成 provider 的其他产品就去使用了，若要使用 Hypit 官方的 HypiHub Provider，可以向您的 agent 明确要求使用 HypiHub OAuth 登录。

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

### Incident Patch 1: `1f8f4e1b` (2026-10-03)
**Commit Message**: docs: use the built-in simple-icons slug for hypit badges (#378)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
 </p>
 
 <p align="center">
-  <a href="https://hypit.ai"><img alt="Visit our website" src="https://img.shields.io/badge/Visit%20our%20website-DF3C68?style=for-the-badge&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjI1Ny4wMyAyODcuNDggNDg2Ljk0IDQyNi4wNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTczMy4wMDEsNDYyLjU5MmMtMTEuNDQtMTYuNTEtMzAuMjg1LTI2LjM0NC01MC4zNTMtMjYuMzQ0aC0xNzguNzA1Yy0yMy40OTMsMC00Ny42NzUsMTQuMjM0LTU2LjYyOCwzNS45NjdsLTU0LjA2NSwxNDUuMDUzYy04LjgsMjEuNTIzLTguNjg2LDQ2LjAxMSw0LjI0Nyw2NS4zNTIsMTIuOTksMTkuNDE4LDM3LjAzOCwzMC44OTcsNjAuMzk3LDMwLjg5N2gxNjQuNDljMjcuMDEzLDAsNTEuNDYzLTE2Ljk4OSw2MC45MTQtNDIuMjhsNTYuODAxLTE1Mi4yMjdjNy4wMjEtMTguODI1LDQuMzgxLTM5LjkwOC03LjA1OS01Ni4zOTl2LS4wMzhoLS4wMzh2LjAxOVpNNjMzLjk3OCw2NTIuODEzYy0xLjc5OCw0LjgyMS02LjQ4NSw4LjA3My0xMS42MzIsOC4wNzNoLTE1OS42NWMtOC4zMDMsMC0xMi43OC01LjM1Ny0xNC4zMjktNy42MzNzLTQuNzgzLTguNDc1LTEuNjA3LTE2LjE0N2w0NS42MjgtMTI2LjcyNWM0LjM4MS0xMi4xNDgsMTUuNDU4LTIwLjc5NiwyOC4zNTItMjEuNDY1LjYzMS0uMDM4LDEuMjgyLS4wMzgsMS45NTEtLjAzOGgxNDQuMjY5czIzLjkzMywyLjcxNywxNy43NzMsMjcuOTUxbC01MC43NTUsMTM2LjAwNGgwdi0uMDE5Wk0zNTYuMjUsNjIzLjEyMnMtNDIuNzc3LTIyLjE3My0zMy43ODYtNjIuNDgzbDU2Ljc2Mi0xNTcuMzE2YzkuMTQ1LTI1LjM0OSwzMy4yMTItNDIuMjYxLDYwLjE2OC00Mi4yNjFoMTgxLjc4NWMxMS45NTcsMCwyMy4xNDksNS43OTcsMzAuMDU1LDE1LjU3M2wyNi41NzMsMzcuNjVoLTIxNi4xMjVjLTE2LjY0NCwwLTMxLjU0NywxMC4zNS0zNy4zNDQsMjUuOTYxbC02OC4wODgsMTgyLjg5NWgwdi0uMDE5Wk0yOTIuMDY0LDU0OS41NDNzLTQyLjc5Ny0yMi4xNzMtMzMuNzg2LTYyLjQ4M2w1Ni43NjItMTU3LjMxNmM5LjE2NC0yNS4zNDksMzMuMjMxLTQyLjI2MSw2MC4xNjgtNDIuMjYxaDE3Mi4wMDljMTEuOTU3LDAsMjMuMTQ5LDUuNzk3LDMwLjA1NSwxNS41NzNsMjYuNTczLDM3LjY1aC0yMDYuMzExYy0xNi42NDQsMC0zMS41NDcsMTAuMzUtMzcuMzQ0LDI1Ljk2MWwtNjguMDg4LDE4Mi44OTVoLS4wMzh2LS4wMTlaIi8%2BPC9zdmc%2B"></a>
+  <a href="https://hypit.ai"><img alt="Visit our website" src="https://img.shields.io/badge/Visit%20our%20website-DF3C68?style=for-the-badge&logo=hypit&logoColor=white"></a>
   <a href="https://discord.gg/85hnyQnxpn"><img alt="Join our Discord" src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white"></a>
   <a href="https://t.me/hypitai"><img alt="Join our Telegram" src="https://img.shields.io/badge/Join%20our%20Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white"></a>
   <a href="https://x.com/hypitai"><img alt="Follow @hypitai on X" src="https://img.shields.io/badge/Follow%20%40hypitai-000000?style=for-the-badge&logo=x&logoColor=white"></a>
```

**File**: `README.zh-CN.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
 </p>
 
 <p align="center">
-  <a href="https://hypit.ai"><img alt="Visit our website" src="https://img.shields.io/badge/Visit%20our%20website-DF3C68?style=for-the-badge&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjI1Ny4wMyAyODcuNDggNDg2Ljk0IDQyNi4wNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTczMy4wMDEsNDYyLjU5MmMtMTEuNDQtMTYuNTEtMzAuMjg1LTI2LjM0NC01MC4zNTMtMjYuMzQ0aC0xNzguNzA1Yy0yMy40OTMsMC00Ny42NzUsMTQuMjM0LTU2LjYyOCwzNS45NjdsLTU0LjA2NSwxNDUuMDUzYy04LjgsMjEuNTIzLTguNjg2LDQ2LjAxMSw0LjI0Nyw2NS4zNTIsMTIuOTksMTkuNDE4LDM3LjAzOCwzMC44OTcsNjAuMzk3LDMwLjg5N2gxNjQuNDljMjcuMDEzLDAsNTEuNDYzLTE2Ljk4OSw2MC45MTQtNDIuMjhsNTYuODAxLTE1Mi4yMjdjNy4wMjEtMTguODI1LDQuMzgxLTM5LjkwOC03LjA1OS01Ni4zOTl2LS4wMzhoLS4wMzh2LjAxOVpNNjMzLjk3OCw2NTIuODEzYy0xLjc5OCw0LjgyMS02LjQ4NSw4LjA3My0xMS42MzIsOC4wNzNoLTE1OS42NWMtOC4zMDMsMC0xMi43OC01LjM1Ny0xNC4zMjktNy42MzNzLTQuNzgzLTguNDc1LTEuNjA3LTE2LjE0N2w0NS42MjgtMTI2LjcyNWM0LjM4MS0xMi4xNDgsMTUuNDU4LTIwLjc5NiwyOC4zNTItMjEuNDY1LjYzMS0uMDM4LDEuMjgyLS4wMzgsMS45NTEtLjAzOGgxNDQuMjY5czIzLjkzMywyLjcxNywxNy43NzMsMjcuOTUxbC01MC43NTUsMTM2LjAwNGgwdi0uMDE5Wk0zNTYuMjUsNjIzLjEyMnMtNDIuNzc3LTIyLjE3My0zMy43ODYtNjIuNDgzbDU2Ljc2Mi0xNTcuMzE2YzkuMTQ1LTI1LjM0OSwzMy4yMTItNDIuMjYxLDYwLjE2OC00Mi4yNjFoMTgxLjc4NWMxMS45NTcsMCwyMy4xNDksNS43OTcsMzAuMDU1LDE1LjU3M2wyNi41NzMsMzcuNjVoLTIxNi4xMjVjLTE2LjY0NCwwLTMxLjU0NywxMC4zNS0zNy4zNDQsMjUuOTYxbC02OC4wODgsMTgyLjg5NWgwdi0uMDE5Wk0yOTIuMDY0LDU0OS41NDNzLTQyLjc5Ny0yMi4xNzMtMzMuNzg2LTYyLjQ4M2w1Ni43NjItMTU3LjMxNmM5LjE2NC0yNS4zNDksMzMuMjMxLTQyLjI2MSw2MC4xNjgtNDIuMjYxaDE3Mi4wMDljMTEuOTU3LDAsMjMuMTQ5LDUuNzk3LDMwLjA1NSwxNS41NzNsMjYuNTczLDM3LjY1aC0yMDYuMzExYy0xNi42NDQsMC0zMS41NDcsMTAuMzUtMzcuMzQ0LDI1Ljk2MWwtNjguMDg4LDE4Mi44OTVoLS4wMzh2LS4wMTlaIi8%2BPC9zdmc%2B"></a>
+  <a href="https://hypit.ai"><img alt="Visit our website" src="https://img.shields.io/badge/Visit%20our%20website-DF3C68?style=for-the-badge&logo=hypit&logoColor=white"></a>
   <a href="https://discord.gg/85hnyQnxpn"><img alt="Join our Discord" src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white"></a>
   <a href="https://t.me/hypitai"><img alt="Join our Telegram" src="https://img.shields.io/badge/Join%20our%20Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white"></a>
   <a href="https://x.com/hypitai"><img alt="Follow @hypitai on X" src="https://img.shields.io/badge/Follow%20%40hypitai-000000?style=for-the-badge&logo=x&logoColor=white"></a>
```

---

### Incident Patch 2: `adc0c5fc` (2026-10-01)
**Commit Message**: fix: include the network cause in transport errors (#376)

Node's fetch reports every network failure as "fetch failed" and keeps
the reason on error.cause, which transport() dropped. Users reporting a
failed HypiHub catalogue check could not tell DNS, TLS, a reset or a
timeout apart.

**File**: `packages/endpoint-kit/src/index.ts` (modified, +14/-1)
```diff
@@ -510,10 +510,23 @@ export class EndpointResponseError extends Error {}
 export async function transport<T>(request: Promise<T>): Promise<T> {
   try { return await request; } catch (error) {
     if (error instanceof EndpointTransportError) throw error;
-    throw new EndpointTransportError(error instanceof Error ? error.message : String(error), { cause: error });
+    throw new EndpointTransportError(transportMessage(error), { cause: error });
   }
 }
 
+// Node's fetch reports every network failure as "fetch failed"; which one it was (ECONNRESET,
+// UND_ERR_CONNECT_TIMEOUT, ENOTFOUND, a certificate error) is only on `cause`.
+function transportMessage(error: unknown): string {
+  if (!(error instanceof Error)) return String(error);
+  const cause = error.cause;
+  if (!(cause instanceof Error)) return error.message;
+  const code = (cause as { code?: unknown }).code;
+  const detail = typeof code === "string" && !cause.message.includes(code)
+    ? `${code} ${cause.message}`.trim()
+    : cause.message;
+  return detail.length > 0 ? `${error.message}: ${detail}` : error.message;
+}
+
 /** The wait a `Retry-After` header asks for, in milliseconds; either delay-seconds or an HTTP-date. */
 export function retryAfterMs(headers: Headers, now = Date.now()): number | undefined {
   const value = headers.get("retry-after")?.trim();
```

---

### Incident Patch 3: `32baae6d` (2026-09-26)
**Commit Message**: fix(cli): resolve packages status the way a Build resolves (#361)

`packages status <name>@<version>` read the machine package home and nothing
else, while the loader finds an external package in two places: the
node_modules chain above whoever requires it, and the machine home addressed by
the version that requirer declares. A package installed where the first half
looks — a pnpm workspace's own node_modules, or the global node_modules a
`npm i -g @hypit/hypit` shares with a `npm i -g @hyperframes/engine` — was
reported `Ready false` and exited 1, and `hypit doctor` then loaded the provider
from it on the next line.

Measured on a global install with an empty machine home, before and after:

  @hyperframes/engine@0.7.101   Ready false, exit 1
  @hyperframes/engine@0.7.101   Ready true,  exit 0
                                Required by   .../packages/provider-hyperframes-local
                                Installation  .../lib/node_modules/@hyperframes/engine

Status now locates the Distribution package that declares the specifier and
asks `locateNodePackage` once, from there — one call covering both places
rather than a second opinion beside the loader, which is how the two c

**File**: `packages/cli/src/commands/environment.ts` (modified, +102/-16)
```diff
@@ -1,8 +1,9 @@
 import { readFile } from "node:fs/promises";
-import { resolve } from "node:path";
+import { join, resolve } from "node:path";
 
+import { distributionPackageDeclaring, locateNodePackage } from "@hypit/package-loader-node";
 import type { NodeRuntimeHost } from "@hypit/runtime-host-node";
-import { hypitHostPackageRoot, inspectHostPackage, prepareHostPackages } from "@hypit/runtime-host-node";
+import { hypitHostPackageRoot, inspectHostPackage, parseRegistryPackageSpec, prepareHostPackages } from "@hypit/runtime-host-node";
 
 import type { CliCommand, EnvironmentCommand } from "../command.js";
 import { commandHint } from "../command-hint.js";
@@ -14,6 +15,68 @@ import { hypitHostStateRoot, hypitProjectStateRoot } from "../paths.js";
 import type { CliManagedProgramProgress, CliManagedProgramReport, CliRuntimeController } from "../runtime-port.js";
 import type { OperationalWriter } from "./types.js";
 
+type PackageStatus = {
+  readonly ready: boolean;
+  readonly declaredBy?: string;
+  readonly installation?: string;
+  readonly installedVersion?: string;
+  readonly detail?: string;
+};
+
+/**
+ * Whether `specifier` will resolve when a Build needs it.
+ *
+ * The loader finds an external package in two places — the node_modules chain above whoever
+ * requires it, and the machine home addressed by the version that requirer declares — and both
+ * start from the requiring package. So the requirer is located first and the loader asked once,
+ * rather than reimplementing either half here: a second opinion is exactly how this command came
+ * to disagree with the thing it reports on.
+ *
+ * Without a Distribution on disk there is no requirer to find, and the machine home remains the
+ * only place this command can speak about.
+ */
+async function packageStatus(
+  specifier: string,
+  hostRoot: string,
+  distributionRoot: string | undefined,
+): Promise<PackageStatus> {
+  const required = parseRegistryPackageSpec(specifier);
+  if (distributionRoot === undefined) {
+    const existing = await inspectHostPackage(specifier, hostRoot);
+    return existing === undefined
+      ? { ready: false, detail: "not installed in the machine package home" }
+      : { ready: true, installation: existing.root, installedVersion: required.version };
+  }
+  const declaring = distributionPackageDeclaring(distributionRoot, required.name, required.version);
+  if (declaring === undefined) {
+    return { ready: false, detail: `no Distribution package declares ${specifier}` };
+  }
+  try {
+    const located = locateNodePackage(required.name, {
+      from: join(declaring, "__hypit_package_status__.mjs"),
+      distributionRoots: [distributionRoot],
+      externalRoots: [hostRoot],
+      allowExternal: true,
+    });
+    const installed = located.manifest.version;
+    return installed === required.version
+      ? { ready: true, declaredBy: declaring, installation: located.root, installedVersion: installed }
+      : {
+        ready: false,
+        declaredBy: declaring,
+        installation: located.root,
+        ...(installed === undefined ? {} : { installedVersion: installed }),
+        detail: `resolved version is ${installed ?? "unknown"}`,
+      };
+  } catch (error) {
+    return {
+      ready: false,
+      declaredBy: declaring,
+      detail: error instanceof Error ? error.message : String(error),
+    };
+  }
+}
+
 function programRecord(item: CliManagedProgramReport) {
   return {
     ...item,
@@ -119,28 +182,51 @@ export async function runEnvironmentCommand(input: {
 
   if (args.command === "packages") {
     const root = hypitHostPackageRoot();
-    const existing = await inspectHostPackage(args.package, root);
-    const reports = args.action === "install"
-      ? await prepareHostPackages([args.package], {
+    if (args.action === "install") {
+      const reports = await prepareHostPackages([args.package], {
         root,
         ...(reportPackageProgress === undefined ? {} : { onProgress: reportPackageProgress }),
-      })
-      : existing === undefined ? [] : [existing];
-    const ready = reports.length === 1;
+      });
+      const ready = reports.length === 1;
+      write({
+        format: "hypit.cli-package@1",
+        action: args.action,
+        package: args.package,
+        ready,
+        ...(reports[0] === undefined ? {} : { installation: reports[0].root }),
+        ...(reports[0]?.logPath === undefined ? {} : { logPath: reports[0].logPath }),
+      }, "Machine package is ready", ready ? "success" : "warning", [
+        ["Package", args.package],
+        ["Ready", String(ready)],
+        ...(args.presentation.verbose && reports[0] !== undefined ? [["Installation", reports[0].root] as const] : []),
+      ]);
+      if (!ready) io.setExitCode?.(1);
+      return;
+    }
+
+    // Status answers the question a Build asks: will the dependency resolve, at
+    // the declared version? It therefore asks the loader rather than checking
+    // one 
```

**File**: `packages/package-loader-node/src/index.ts` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ export {
 export {
   locateNodePackage,
   NodePackageNotFoundError,
+  distributionPackageDeclaring,
   externalPackageInstallRoot,
   resolveNodePackageExecutable,
   resolveNodePackageResource,
```

**File**: `packages/package-loader-node/src/location.ts` (modified, +41/-0)
```diff
@@ -190,6 +190,47 @@ export function distributionPackageDirectory(root: string, name: string): string
   return undefined;
 }
 
+/**
+ * The Distribution package that declares `name@version` as an external dependency, or undefined
+ * when none does.
+ *
+ * Resolution of an external package starts from whoever requires it — the ancestor walk begins at
+ * that package's directory, and the machine home is addressed by the version that package
+ * declares. A caller holding only `name@version`, as `hypit packages status` does, cannot ask the
+ * question the loader answers until it knows the requirer. Finding it here keeps that one answer
+ * in one place instead of letting each caller approximate it.
+ */
+export function distributionPackageDeclaring(
+  root: string,
+  name: string,
+  version: string,
+): string | undefined {
+  for (const directory of distributionPackageDirectories(root)) {
+    const manifest = join(directory, "package.json");
+    if (!existsSync(manifest)) continue;
+    const value = JSON.parse(readFileSync(manifest, "utf8")) as {
+      dependencies?: Record<string, string>;
+      optionalDependencies?: Record<string, string>;
+    };
+    // npm lets optionalDependencies override dependencies of the same name, and
+    // declaredExternalPackageRoot reads them in that order; match it.
+    const declared = value.optionalDependencies?.[name] ?? value.dependencies?.[name];
+    if (declared === version) return directory;
+  }
+  return undefined;
+}
+
+function* distributionPackageDirectories(root: string): Generator<string> {
+  const base = resolve(root);
+  for (const group of ["packages", "services"]) {
+    const directory = join(base, group);
+    if (!existsSync(directory)) continue;
+    for (const entry of readdirSync(directory, { withFileTypes: true })) {
+      if (entry.isDirectory()) yield join(directory, entry.name);
+    }
+  }
+}
+
 function distributionPackage(root: string, name: string): LocatedNodePackage | undefined {
   const directory = distributionPackageDirectory(root, name);
   return directory === undefined ? nodeModulesPackage(root, name) : readPackage(directory, name);
```

---

### Incident Patch 4: `c80e5137` (2026-09-25)
**Commit Message**: fix(test): declare linkedom as a dev dependency

capture-scope.test.ts imports linkedom, which only resolved locally as a
transitive dependency; CI type checking failed with TS2307.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +1/-0)
```diff
@@ -284,6 +284,7 @@
     "@hypit/wan": "workspace:*",
     "@hypit/whisperx": "workspace:*",
     "@types/node": "24.10.1",
+    "linkedom": "0.18.13",
     "rollup": "4.62.4",
     "rollup-plugin-dts": "6.2.3",
     "vitepress": "^1.6.4"
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -330,6 +330,9 @@ importers:
       '@types/node':
         specifier: 24.10.1
         version: 24.10.1
+      linkedom:
+        specifier: 0.18.13
+        version: 0.18.13
       rollup:
         specifier: 4.62.4
         version: 4.62.4
```

---

### Incident Patch 5: `089c39a0` (2026-09-25)
**Commit Message**: perf: localize build and render working sets

Preserve forwarded Result values without eager materialization, advance live Builds from disposable indexes, and bound HyperFrames resource, source-frame, and output work.

**File**: `packages/build-result/src/decode.ts` (modified, +1/-0)
```diff
@@ -265,6 +265,7 @@ export function decodeBuildResultWriterState(
       output,
       build: buildId(forward.build, `${subject}.forwards[${index}].build`),
       sourceOutput: text(forward.sourceOutput, `${subject}.forwards[${index}].sourceOutput`),
+      type: typeRef(forward.type, `${subject}.forwards[${index}].type`),
     };
   });
   return {
```

**File**: `packages/build-result/src/index.ts` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ export {
   browseBuildResults,
   buildResultDirectory,
   describeBuildResultOutput,
+  locateBuildResultOutput,
+  locateRepositoryBuildResultOutput,
   normalizeBuildResultForwards,
   readBuildResult,
   resolveBuildResultOutput,
```

**File**: `packages/build-result/src/store.ts` (modified, +44/-10)
```diff
@@ -15,8 +15,8 @@ import {
 import { createReadStream } from "node:fs";
 import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
 
-import { assertOrderedBuildId, buildIdCreatedAt } from "@hypit/protocol";
-import type { BlobRef } from "@hypit/protocol";
+import { assertOrderedBuildId, buildIdCreatedAt, sameType } from "@hypit/protocol";
+import type { BlobRef, TypeRef } from "@hypit/protocol";
 
 import type {
   BuildResultResourceSource,
@@ -32,6 +32,7 @@ import type {
   BuildResultRepository,
   RepositoryBuildResultOutput,
   RepositoryBuildResultOutputDescription,
+  RepositoryBuildResultOutputLocation,
   FinishedBuildResultManifest,
 } from "./types.js";
 import { assertBuildResultSeed } from "./types.js";
@@ -131,13 +132,48 @@ async function copyArtifactAtomic(
   artifact: BlobRef,
   destination: string,
 ): Promise<void> {
-  if (await exists(destination)) return;
   await mkdir(dirname(destination), { recursive: true });
   const input = await source.open(artifact);
   if (input === undefined) throw new Error(`Build resource ${artifact.resource} is unavailable`);
   await writeStreamAtomic(destination, input);
 }
 
+export async function locateRepositoryBuildResultOutput(
+  repository: Pick<BuildResultRepository, "read">,
+  build: string,
+  output: string,
+): Promise<RepositoryBuildResultOutputLocation | undefined> {
+  const seen = new Set<string>();
+  let currentBuild = build;
+  let currentOutput = output;
+  while (true) {
+    const address = `${currentBuild}\u0000${currentOutput}`;
+    assert(!seen.has(address), `Build Output forwarding repeats ${currentBuild} / ${currentOutput}`);
+    seen.add(address);
+    const manifest = await repository.read(currentBuild);
+    if (manifest === undefined) return undefined;
+    assert(manifest.outcome !== undefined, `Build ${currentBuild} is not a finished Result`);
+    const entry = manifest.outputs[currentOutput];
+    if (entry === undefined) return undefined;
+    if (entry.value.kind === "build-output") {
+      currentBuild = entry.value.build;
+      currentOutput = entry.value.output;
+      continue;
+    }
+    return { build: currentBuild, output: currentOutput, type: entry.type };
+  }
+}
+
+export async function locateBuildResultOutput(
+  root: string,
+  build: string,
+  output: string,
+): Promise<RepositoryBuildResultOutputLocation | undefined> {
+  return await locateRepositoryBuildResultOutput({
+    read: async (currentBuild) => await readBuildResult(buildResultDirectory(root, currentBuild)),
+  }, build, output);
+}
+
 async function writeStreamAtomic(destination: string, input: AsyncIterable<Uint8Array>): Promise<void> {
   await mkdir(dirname(destination), { recursive: true });
   const temporary = `${destination}.part-${randomUUID()}`;
@@ -334,27 +370,26 @@ export async function describeBuildResultOutput(
 export async function normalizeBuildResultForwards(
   repository: {
     read(build: string): Promise<BuildResultManifest | undefined>;
-    resolve(build: string, output: string): Promise<{
-      readonly build: string;
-      readonly output: string;
-    } | undefined>;
   },
   forwards: readonly BuildResultForward[],
-): Promise<readonly BuildResultForward[]> {
+): Promise<readonly (BuildResultForward & { readonly type: TypeRef })[]> {
   return await Promise.all(forwards.map(async (forward) => {
     const source = await repository.read(forward.build);
     assert(source?.outcome !== undefined,
       `Build ${forward.build} is not a finished Result`);
-    const resolved = await repository.resolve(forward.build, forward.sourceOutput);
+    const resolved = await locateRepositoryBuildResultOutput(repository, forward.build, forward.sourceOutput);
     assert(resolved !== undefined,
       `Build ${forward.build} has no Output ${forward.sourceOutput}`);
     const owner = resolved.build === source.id ? source : await repository.read(resolved.build);
     assert(owner?.outcome !== undefined,
       `Build ${resolved.build} is not a finished Result`);
+    assert(forward.type === undefined || sameType(forward.type, resolved.type),
+      `Build ${forward.build} Output ${forward.sourceOutput} has the wrong type for its forwarded Logical Output`);
     return {
       output: forward.output,
       build: resolved.build,
       sourceOutput: resolved.output,
+      type: resolved.type,
     };
   }));
 }
@@ -371,7 +406,6 @@ export class FileBuildResult {
     assertBuildResultSeed(seed);
     const forwards = await normalizeBuildResultForwards({
       read: async (build) => await readBuildResult(buildResultDirectory(root, build)),
-      resolve: async (build, output) => await resolveBuildResultOutput(root, build, output, externalFiles),
     }, seed.forwards ?? []);
     const directory = buildResultDirectory(root, seed.id);
     await mkdir(dirname(directory), { recursive: true });
```

**File**: `packages/build-result/src/types.ts` (modified, +9/-0)
```diff
@@ -226,6 +226,15 @@ export type BuildResultForward = {
   readonly output: string;
   readonly build: string;
   readonly sourceOutput: string;
+  /** Expected source type when the compiler has already inspected the historical Output. */
+  readonly type?: TypeRef;
+};
+
+/** One terminal historical Output address found without opening its value document or files. */
+export type RepositoryBuildResultOutputLocation = {
+  readonly build: string;
+  readonly output: string;
+  readonly type: TypeRef;
 };
 
 export type BuildResultSeed = {
```

**File**: `packages/build-result/src/writer.ts` (modified, +120/-49)
```diff
@@ -1,4 +1,4 @@
-import type { BlobRef, CanonicalValue, TypedRecord } from "@hypit/protocol";
+import type { BlobRef, CanonicalValue, TypeRef, TypedRecord } from "@hypit/protocol";
 
 import type {
   BuildResultFileRef,
@@ -16,7 +16,12 @@ export type BuildResultWriterState = {
   readonly resourceReferences?: Readonly<Record<string, BuildResultFileRef>>;
   readonly values: Readonly<Record<string, string>>;
   readonly publishedOutputs: readonly { readonly name: string; readonly output: string; readonly displayName?: string }[];
-  readonly forwards: readonly { readonly output: string; readonly build: string; readonly sourceOutput: string }[];
+  readonly forwards: readonly {
+    readonly output: string;
+    readonly build: string;
+    readonly sourceOutput: string;
+    readonly type: TypeRef;
+  }[];
 };
 
 export type BuildResultWriteTarget = {
@@ -39,20 +44,74 @@ function assert(condition: unknown, message: string): asserts condition {
   if (!condition) throw new Error(message);
 }
 
+type NumberedPathAllocator = {
+  next: number;
+  readonly occupied: Set<string>;
+};
+
+function numberedPathAllocator(
+  directory: "files" | "values",
+  stem: "file" | "value",
+  paths: Iterable<string>,
+): NumberedPathAllocator {
+  const occupied = new Set(paths);
+  const prefix = `${directory}/${stem}-`;
+  let highest = 0;
+  for (const path of occupied) {
+    if (!path.startsWith(prefix)) continue;
+    const match = /^(\d+)\.[^/]+$/u.exec(path.slice(prefix.length));
+    if (match === null) continue;
+    const index = Number(match[1]);
+    assert(Number.isSafeInteger(index), `Build Result path ${path} has an unsafe generated index`);
+    highest = Math.max(highest, index);
+  }
+  assert(highest < Number.MAX_SAFE_INTEGER, `Build Result ${directory} path index is exhausted`);
+  return { next: highest + 1, occupied };
+}
+
 function numberedPath(
   directory: "files" | "values",
   stem: "file" | "value",
   extension: string,
-  occupied: ReadonlySet<string>,
+  allocator: NumberedPathAllocator,
 ): string {
-  let index = 1;
   while (true) {
-    const candidate = `${directory}/${stem}-${String(index).padStart(4, "0")}${extension}`;
-    if (!occupied.has(candidate)) return candidate;
-    index += 1;
+    assert(Number.isSafeInteger(allocator.next), `Build Result ${directory} path index is exhausted`);
+    const candidate = `${directory}/${stem}-${String(allocator.next).padStart(4, "0")}${extension}`;
+    allocator.next += 1;
+    if (allocator.occupied.has(candidate)) continue;
+    allocator.occupied.add(candidate);
+    return candidate;
   }
 }
 
+async function runBounded<T>(
+  values: readonly T[],
+  concurrency: number,
+  perform: (value: T) => Promise<void>,
+): Promise<void> {
+  let next = 0;
+  let failed = false;
+  let failure: unknown;
+  const worker = async (): Promise<void> => {
+    while (!failed) {
+      const index = next;
+      next += 1;
+      if (index >= values.length) return;
+      try {
+        await perform(values[index]!);
+      } catch (error) {
+        if (!failed) {
+          failed = true;
+          failure = error;
+        }
+      }
+    }
+  };
+  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
+  if (failed) throw failure;
+}
+
 function mediaExtension(mediaType: string): string {
   const subtype = mediaType.split("/", 2)[1]?.split(";", 1)[0]?.trim().toLowerCase();
   if (subtype === undefined || subtype.length === 0) return ".bin";
@@ -85,6 +144,13 @@ function outputRecord(input: BuildResultSync, output: string): TypedRecord | und
   return binding === undefined ? undefined : input.state.records.find((item) => item.id === binding.record);
 }
 
+type ReadyOutput = {
+  readonly published: BuildResultWriterState["publishedOutputs"][number];
+  readonly type: TypeRef;
+  readonly record?: TypedRecord;
+  readonly forward?: HistoricalBuildOutputRef;
+};
+
 /**
  * Encode accepted public Outputs exactly once, independently of the physical repository adapter.
  * The adapter only writes bytes/documents at the paths chosen here.
@@ -97,89 +163,94 @@ export async function syncBuildResultOutputs(input: {
 }): Promise<BuildResultSyncResult> {
   const resources = new Map(Object.entries(input.writer.resources));
   const values = new Map(Object.entries(input.writer.values));
+  const filePaths = numberedPathAllocator("files", "file", resources.values());
+  const valuePaths = numberedPathAllocator("values", "value", values.values());
   const outputs: Record<string, BuildResultOutput> = { ...input.manifest.outputs };
 
-  const materialize = async (artifact: BlobRef): Promise<BuildResultFileRef> => {
-    const reference = input.writer.resourceReferences?.[artifact.resource];
-    if (reference !== undefined) return { ...reference, mediaType: artifact.mediaType };
-    const identity = artifact.resource;
-    assert(identity.length > 0, "Build resource has no instance identity");
-    let path = resources.get(ide
```

**File**: `packages/build-result/test/result.test.ts` (modified, +183/-1)
```diff
@@ -2,9 +2,10 @@ import assert from "node:assert/strict";
 import { mkdir, mkdtemp, open, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
+import { setTimeout as delay } from "node:timers/promises";
 import test from "node:test";
 
-import { buildResultDirectory, FileBuildResult, FileBuildResultRepository } from "@hypit/build-result";
+import { buildResultDirectory, FileBuildResult, FileBuildResultRepository, syncBuildResultOutputs } from "@hypit/build-result";
 import type { BlobRef, BuildState, TypeRef } from "@hypit/protocol";
 
 const videoType: TypeRef = {
@@ -414,6 +415,187 @@ test("an explicitly reused public output is a forward reference and copies no by
   }
 });
 
+test("a forward-only Composite is published from manifests without opening its missing value document", async () => {
+  const root = await mkdtemp(join(tmpdir(), "hypit-result-manifest-forward-"));
+  const priorId = "bld_20260902T100000030Z_0000000001";
+  const nextId = "bld_20260902T100000031Z_0000000001";
+  try {
+    const prior = await FileBuildResult.create(root, {
+      id: priorId,
+      source: { path: "/project/main.svml" },
+      targets: ["layout"],
+      publishedOutputs: [{ name: "layout", output: "logical:layout" }],
+    });
+    await prior.sync({
+      state: state({
+        records: [{ id: "record:layout", type: videoType, value: { kind: "inline", value: { title: "ready" } } }],
+        bindings: [{ output: "logical:layout", record: "record:layout" }],
+      }),
+      resources: { async open() { throw new Error("fixture has no files"); } },
+    });
+    await prior.finish({ outcome: "complete" });
+    await rm(join(prior.directory, "values", "value-0001.json"));
+
+    const forwarded = await FileBuildResult.create(root, {
+      id: nextId,
+      source: { path: "/project/main.svml" },
+      targets: ["layout"],
+      publishedOutputs: [{ name: "layout", output: "logical:layout" }],
+      forwards: [{ output: "logical:layout", build: priorId, sourceOutput: "layout", type: videoType }],
+    });
+    const manifest = await forwarded.sync({
+      state: state({ records: [], bindings: [], status: "complete" }),
+      resources: { async open() { throw new Error("a forward-only Result has no bytes to open"); } },
+    });
+    assert.deepEqual(manifest.outputs.layout, {
+      type: videoType,
+      value: { kind: "build-output", build: priorId, output: "layout" },
+    });
+  } finally {
+    await rm(root, { recursive: true, force: true });
+  }
+});
+
+test("a failed filesystem sync cannot make a later resource inherit stale bytes", async () => {
+  const root = await mkdtemp(join(tmpdir(), "hypit-result-retry-path-"));
+  try {
+    const result = await FileBuildResult.create(root, {
+      id: "bld_20260924T100000000Z_0000000001",
+      source: { path: "/project/main.svml" },
+      targets: ["a", "b", "z"],
+      publishedOutputs: ["a", "b", "z"].map((name) => ({ name, output: name })),
+    });
+    const snapshot = (names: readonly string[]) => state({
+      records: names.map((name) => ({ id: name, type: videoType, value: {
+        kind: "blob", resource: `res_${name}`, size: 1, mediaType: "video/mp4",
+      } })),
+      bindings: names.map((name) => ({ output: name, record: name })),
+    });
+    let fail = true;
+    const resources = { async open(artifact: BlobRef) {
+      if (fail && artifact.resource === "res_z") throw new Error("intentional source failure");
+      return (async function* () { yield Buffer.from(artifact.resource.slice(-1).toUpperCase()); })();
+    } };
+    await assert.rejects(result.sync({ state: snapshot(["b", "z"]), resources }), /intentional source failure/u);
+    assert.deepEqual((await result.read()).outputs, {});
+    fail = false;
+    await result.sync({ state: snapshot(["a", "b", "z"]), resources });
+    const outputs = (await result.read()).outputs;
+    for (const name of ["a", "b", "z"]) {
+      const value = outputs[name]?.value;
+      assert.equal(value?.kind, "build-file");
+      if (value?.kind !== "build-file") throw new Error("expected file Output");
+      assert.equal(await readFile(join(result.directory, value.path), "utf8"), name.toUpperCase());
+    }
+  } finally {
+    await rm(root, { recursive: true, force: true });
+  }
+});
+
+test("Result writer recovers one numeric cursor across file extensions and the 9999 boundary", async () => {
+  const artifact: BlobRef = {
+    kind: "blob", resource: "res_new-image", size: 1, mediaType: "image/png",
+  };
+  const resourcePaths: string[] = [];
+  const valuePaths: string[] = [];
+  const updated = await syncBuildResultOutputs({
+    manifest: {
+      format: "hypit.build-result@1",
+      id: "bld_20260924T110000000Z_0000000001",
+      source: { path: "main.svml" },
+      targets: ["image"],
+      outputs: {},
+    },
+    writer: {
+      resources: { old: "files/file-9999.mp4" },
+  
```

**File**: `packages/cli/src/build-planning.ts` (modified, +4/-0)
```diff
@@ -19,6 +19,7 @@ export function createCatalogDescriptor(options: {
   readonly source: string;
   readonly compilation: NodeCompiledSourceClosure;
   readonly run?: { readonly path: string };
+  readonly targets?: readonly { readonly output: string }[];
 }): BuildCatalogDescriptor {
   const publishedOutputs = options.compilation.exports.flatMap((item) => {
     if (item.ref.kind === "operation-result") {
@@ -44,6 +45,9 @@ export function createCatalogDescriptor(options: {
   return {
     source: { path: resolve(options.source) },
     ...(options.run === undefined ? {} : { run: { path: resolve(options.run.path) } }),
+    ...(options.targets === undefined ? {} : {
+      targets: options.targets.map((target) => ({ kind: "logical-output" as const, id: target.output })),
+    }),
     publishedOutputs,
   };
 }
```

**File**: `packages/cli/src/main.ts` (modified, +7/-3)
```diff
@@ -380,6 +380,7 @@ export async function runCli(
         run: {
           path: loadedRun.path,
         },
+        targets: loadedRun.run.graph.targets,
       });
       const request = {
         // One CLI invocation is one execution instance. Source and Plan identity
@@ -472,10 +473,13 @@ export async function runCli(
       const finishedResult = finished
         ? await buildResults.repository.read(built.id)
         : undefined;
-      const targetOutputs = new Set(built.state.targets.map((target) => target.output));
       const presentation = catalog;
-      const targetPublishedOutputs = presentation.publishedOutputs.filter((published) =>
-        targetOutputs.has(published.ref.id));
+      const targetNames = new Set(finishedResult?.targets ?? []);
+      const targetOutputs = new Set(presentation.targets?.map((target) => target.id)
+        ?? built.state.targets.map((target) => target.output));
+      const targetPublishedOutputs = presentation.publishedOutputs.filter((published) => finishedResult === undefined
+        ? targetOutputs.has(published.ref.id)
+        : targetNames.has(published.name));
       const targetPresentations = targetPublishedOutputs.flatMap((published) => {
         const selection = built.state.plan.outputBindings.find((item) => item.output === published.ref.id);
         const record = selection === undefined
```

---

### Incident Patch 6: `78d74360` (2026-09-23)
**Commit Message**: fix(oauth): answer the callback preflight for Chrome Private Network Access

The hosted callback page fetches the loopback from a public page, and
Chrome preflights that with OPTIONS under Private Network Access. Without
the CORS and PNA headers the auto-forward breaks once Chrome sends the
preflight. Answer OPTIONS and add the allow-origin header to the GET and
error responses.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `packages/cli/src/oauth.ts` (modified, +16/-0)
```diff
@@ -87,6 +87,7 @@ export async function acquireOAuthCredential(
   const verifier = base64url(randomBytes(32));
   // S256 is part of OAuth PKCE. It authenticates this browser exchange; it is not content identity.
   const challenge = base64url(createHash("sha256").update(verifier).digest());
+  const callbackOrigin = new URL(acquisition.redirectUri).origin;
   const nonce = base64url(randomBytes(24));
   let state = nonce;
   const server = createServer();
@@ -97,6 +98,19 @@ export async function acquireOAuthCredential(
       server.unref();
     };
     server.on("request", (request, response) => {
+      // The hosted callback page fetches this loopback from a public page; Chrome's Private
+      // Network Access check preflights with OPTIONS and expects these headers back.
+      if (request.method === "OPTIONS") {
+        response.writeHead(204, {
+          "access-control-allow-origin": callbackOrigin,
+          "access-control-allow-methods": "GET, OPTIONS",
+          "access-control-allow-private-network": "true",
+          "cache-control": "no-store",
+          connection: "close",
+        });
+        response.end();
+        return;
+      }
       if (settled) {
         response.writeHead(204, { "cache-control": "no-store", connection: "close" });
         response.end();
@@ -111,6 +125,7 @@ export async function acquireOAuthCredential(
         const code = url.searchParams.get("code");
         if (code === null || code.length === 0) throw new Error("OAuth callback contained no code");
         response.writeHead(200, {
+          "access-control-allow-origin": callbackOrigin,
           "cache-control": "no-store",
           connection: "close",
           "content-type": "text/html; charset=utf-8",
@@ -120,6 +135,7 @@ export async function acquireOAuthCredential(
         resolveCode(code);
       } catch (error) {
         response.writeHead(400, {
+          "access-control-allow-origin": callbackOrigin,
           "cache-control": "no-store",
           connection: "close",
           "content-type": "text/html; charset=utf-8",
```

---

### Incident Patch 7: `66a35294` (2026-09-23)
**Commit Message**: fix(oauth): return sign-in through the hosted callback page (#349)

fix(oauth): return sign-in through the hosted callback page (#349)

**File**: `packages/cli/src/oauth.ts` (modified, +6/-2)
```diff
@@ -87,7 +87,8 @@ export async function acquireOAuthCredential(
   const verifier = base64url(randomBytes(32));
   // S256 is part of OAuth PKCE. It authenticates this browser exchange; it is not content identity.
   const challenge = base64url(createHash("sha256").update(verifier).digest());
-  const state = base64url(randomBytes(24));
+  const nonce = base64url(randomBytes(24));
+  let state = nonce;
   const server = createServer();
   const callback = new Promise<string>((resolveCode, reject) => {
     let settled = false;
@@ -140,7 +141,10 @@ export async function acquireOAuthCredential(
   });
   const address = server.address();
   if (address === null || typeof address === "string") throw new Error("could not open a local OAuth callback");
-  const redirectUri = `http://127.0.0.1:${address.port}/callback`;
+  // The hosted callback page forwards the code to this port when the browser shares this host;
+  // otherwise the page shows `code#state` for the user to deliver to this port themselves.
+  state = `${nonce}.${address.port}`;
+  const redirectUri = acquisition.redirectUri;
   const authorize = new URL(acquisition.authorizationEndpoint);
   authorize.searchParams.set("response_type", "code");
   authorize.searchParams.set("client_id", acquisition.clientId);
```

**File**: `packages/cli/test/oauth.test.ts` (modified, +12/-5)
```diff
@@ -14,15 +14,22 @@ import { acquireOAuthCredential, authorizeBrowserLaunch } from "../src/oauth.js"
 const acquisition = {
   kind: "oauth2-pkce" as const,
   authorizationEndpoint: "https://identity.example.test/authorize",
+  redirectUri: "https://identity.example.test/callback",
   tokenEndpoint: "https://identity.example.test/token",
   clientId: "client",
   scopes: ["work"],
   requestTimeoutMs: 1_000,
 };
 
+/** Where the hosted callback page forwards the code: the port packed after the last `.` of state. */
+function loopbackCallback(authorization: URL): URL {
+  const state = authorization.searchParams.get("state")!;
+  return new URL(`http://127.0.0.1:${state.slice(state.lastIndexOf(".") + 1)}/callback`);
+}
+
 function returnAuthorization(url: string, page: (html: string) => void): void {
   const authorization = new URL(url);
-  const redirect = new URL(authorization.searchParams.get("redirect_uri")!);
+  const redirect = loopbackCallback(authorization);
   redirect.searchParams.set("state", authorization.searchParams.get("state")!);
   redirect.searchParams.set("code", "authorization-code");
   void globalThis.fetch(redirect).then(async (response) => {
@@ -60,8 +67,7 @@ test("OAuth callback releases another browser connection after sending its page"
   let browserConnection: ReturnType<typeof createConnection> | undefined;
   const raw = await acquireOAuthCredential(acquisition, {
     open: (url) => {
-      const authorization = new URL(url);
-      const redirect = new URL(authorization.searchParams.get("redirect_uri")!);
+      const redirect = loopbackCallback(new URL(url));
       browserConnection = createConnection({ host: redirect.hostname, port: Number(redirect.port) });
       void once(browserConnection, "connect").then(() => {
         browserConnection!.write(`GET /favicon.ico HTTP/1.1\r\nHost: ${redirect.host}\r\n`);
@@ -150,8 +156,9 @@ const value = await acquireOAuthCredential(${JSON.stringify(acquisition)}, {
   onProgress(message) {
     if (!message.startsWith("Opening sign-in: ")) return;
     const authorize = new URL(message.slice("Opening sign-in: ".length));
-    const callback = new URL(authorize.searchParams.get("redirect_uri"));
-    callback.searchParams.set("state", authorize.searchParams.get("state"));
+    const state = authorize.searchParams.get("state");
+    const callback = new URL("http://127.0.0.1:" + state.slice(state.lastIndexOf(".") + 1) + "/callback");
+    callback.searchParams.set("state", state);
     callback.searchParams.set("code", "manual-code");
     setTimeout(() => { void fetch(callback); }, 50);
   },
```

**File**: `packages/provider-hypihub/src/provider.ts` (modified, +1/-0)
```diff
@@ -607,6 +607,7 @@ export function createHypiHubProvider(options: CreateHypiHubProviderOptions = {}
       acquisition: {
         kind: "oauth2-pkce",
         authorizationEndpoint: new URL("/oauth/consent", oauthOrigin).toString(),
+        redirectUri: new URL("/oauth/callback", oauthOrigin).toString(),
         tokenEndpoint: new URL("/oauth/token", oauthOrigin).toString(),
         clientId: "hyc_d5d5e8e7131b0c877756e66c",
         scopes: ["user:profile", "user:inference"],
```

**File**: `packages/runtime/src/credentials.ts` (modified, +2/-0)
```diff
@@ -43,6 +43,8 @@ export function decodeOAuth2Credential(secret: string): OAuth2Credential | undef
 export type CredentialAcquisition = {
   readonly kind: "oauth2-pkce";
   readonly authorizationEndpoint: string;
+  /** Service-hosted page that shows the code and forwards it to the port packed into `state`. */
+  readonly redirectUri: string;
   readonly tokenEndpoint: string;
   readonly clientId: string;
   readonly scopes: readonly string[];
```

**File**: `skills/hypit/references/environment/model-and-provider.md` (modified, +10/-3)
```diff
@@ -108,9 +108,16 @@ For the selected account:
 hypit auth login hypihub.default
 ```
 
-The Endpoint opens its browser authorization flow and the CLI reports completion after the credential
-is stored. That connection can serve the supported models; login is not repeated per Model. This is
-the integrated account setup, not a promise to install local tools or make every model free.
+Run it as a background task and send the user the URL after `Opening sign-in:` in its output. Ask
+them to authorize and, if the login does not finish on its own, to send back the `<code>#<state>`
+shown on the callback page. The login is done when the CLI reports the credential stored. If the
+user sends `<code>#<state>` while the login is still waiting, deliver it with
+`curl "http://127.0.0.1:<port>/callback?code=<code>&state=<state>"`, where `<port>` is the digits
+after the last `.` in `<state>`. The code works once and only for the waiting login process, so
+passing it through the conversation does not expose the credential.
+
+That connection can serve the supported models; login is not repeated per Model. This is the
+integrated account setup, not a promise to install local tools or make every model free.
 A callback page alone does not prove the CLI finished storing the credential.
 
 To use a HypiHub static API key instead, explicitly import a private file supplied through a secure
```

---

### Incident Patch 8: `59d5e296` (2026-09-23)
**Commit Message**: fix: round mux duration to the PCM sample boundary (#339)

**File**: `packages/media-pipeline/src/component.ts` (modified, +5/-3)
```diff
@@ -1,4 +1,4 @@
-import { verifyMediaFrameRange } from "@hypit/media";
+import { mediaFrameRangeSamples, verifyMediaFrameRange } from "@hypit/media";
 import { mediaComponent } from "@hypit/media";
 import { plannedNeedInputs } from "@hypit/component-kit";
 import type { ComponentPackage, PlannedNeedFacet } from "@hypit/component-kit";
@@ -344,8 +344,10 @@ export const mediaPipelineComponent = {
         const audio = inline(inputs.audio!.value, "TimelineAudio");
         verifyRenderedVisual(visual);
         verifyTimelineAudio(audio);
-        if (visual.frameCount * visual.frameRate.denominator * 48_000
-          !== audio.sampleFrames * visual.frameRate.numerator) {
+        const { sampleFrames } = mediaFrameRangeSamples(
+          { startFrame: 0, endFrameExclusive: visual.frameCount }, visual.frameRate,
+        );
+        if (audio.sampleFrames !== sampleFrames) {
           throw new Error("Rendered visual and TimelineAudio have different presentation durations");
         }
         const need: MuxMediaNeed = { visual, audio };
```

**File**: `packages/media-pipeline/test/mux.test.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { sealRenderedVisual, sealTimelineAudio } from "@hypit/media";
+import { fixtureResource } from "../../../test/fixture-resource.js";
+import { mediaPipelineComponent } from "../src/component.js";
+import { mediaPipelineProducers } from "../src/manifest.js";
+
+const mux = mediaPipelineComponent.producers.find((item) => item.producer.name === mediaPipelineProducers.mux.name)!;
+
+const cases = [
+  { frameRate: { numerator: 30, denominator: 1 }, frameCount: 149, sampleFrames: 238400 },
+  { frameRate: { numerator: 24000, denominator: 1001 }, frameCount: 149, sampleFrames: 298298 },
+  { frameRate: { numerator: 30000, denominator: 1001 }, frameCount: 149, sampleFrames: 238638 },
+  { frameRate: { numerator: 30000, denominator: 1001 }, frameCount: 1, sampleFrames: 1602 },
+  { frameRate: { numerator: 60000, denominator: 1001 }, frameCount: 1, sampleFrames: 801 },
+];
+
+for (const { frameRate, frameCount, sampleFrames } of cases) {
+  test(`mux accepts the nearest PCM sample boundary for ${frameCount} frames at ${frameRate.numerator}/${frameRate.denominator}`, async () => {
+    const visual = sealRenderedVisual({ frameRate, frameCount, canvas: { width: 540, height: 960 },
+      artifact: { kind: "blob", resource: fixtureResource("mux:visual"), size: 1, mediaType: "video/mp4" } });
+    const run = (samples: number) => {
+      const audio = sealTimelineAudio({ sampleFrames: samples,
+        artifact: { kind: "blob", resource: fixtureResource("mux:audio"), size: 1, mediaType: "audio/wav" } });
+      return mux.handler({ inputs: {
+        visual: { value: { kind: "inline", value: visual } },
+        audio: { value: { kind: "inline", value: audio } },
+      } } as never);
+    };
+    const result = await run(sampleFrames);
+    assert.deepEqual(Object.keys(result.needs), ["media"]);
+    for (const incorrect of [sampleFrames - 1, sampleFrames + 1]) {
+      await assert.rejects(async () => run(incorrect), /different presentation durations/u);
+    }
+  });
+}
```

---

### Incident Patch 9: `465bef7e` (2026-09-23)
**Commit Message**: fix: encode HyperFrames renders with BT.709 and tag the output (#342)

The local provider converted sRGB PNG frames to yuv420p without choosing a
matrix or writing color metadata, so FFmpeg used BT.601 while players decode
untagged HD video as BT.709. Convert with BT.709 and tag the stream.

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `packages/provider-hyperframes-local/src/capture.ts` (modified, +4/-1)
```diff
@@ -255,7 +255,10 @@ export async function captureStagedVisual(input: CaptureInput, controller: Abort
     await runProcess({ executable: ffmpegPath,
       argv: ["-v", "error", "-y", "-framerate", `${fps.num}/${fps.den}`, "-i", join(outputFrames, "%09d.png"),
         "-frames:v", String(frameCount), "-an", "-c:v", "libx264", "-crf", String(crf),
-        "-preset", config.quality === "draft" ? "veryfast" : "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output],
+        "-preset", config.quality === "draft" ? "veryfast" : "medium",
+        // Chromium composites in sRGB: convert with the BT.709 matrix and tag the stream so players decode it the same way.
+        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
+        "-movflags", "+faststart", output],
       timeoutMs: config.processTimeoutMs, maxOutputBytes: config.maxProcessOutputBytes, signal });
     const outputStat = await stat(output);
     assert(outputStat.size > 0 && outputStat.size <= config.maxRenderedBytes, "HyperFrames output is empty or exceeds its byte limit");
```

---

### Incident Patch 10: `7e03b01a` (2026-09-23)
**Commit Message**: fix: include bundled packages in vocabulary listings (#345)

**File**: `packages/video-cli/src/vocabulary.ts` (modified, +13/-12)
```diff
@@ -65,15 +65,14 @@ export type PackageListing = {
 };
 
 export async function listPackages(projectRoot: string): Promise<readonly PackageListing[]> {
-  // Every scope, and the project's own directory, from both the project's node_modules and the
-  // Distribution's: the packages a project does not carry are in the Distribution, and the ones it
-  // does are beside it.
+  // Discover installed scopes and unlinked packages in both the project and the Distribution.
   const roots = [...new Set([
-    join(projectRoot, "node_modules"),
-    ...(videoCliDistribution.packageRoot === undefined ? [] : [join(videoCliDistribution.packageRoot, "node_modules")]),
+    projectRoot,
+    ...(videoCliDistribution.packageRoot === undefined ? [] : [videoCliDistribution.packageRoot]),
   ])];
   const candidates: { readonly name: string; readonly directory: string }[] = [];
-  for (const modules of roots) {
+  for (const root of roots) {
+    const modules = join(root, "node_modules");
     const scopes = (await readdir(modules, { withFileTypes: true }).catch(() => []))
       .filter((entry) => entry.isDirectory() && entry.name.startsWith("@"))
       .map((entry) => entry.name)
@@ -85,12 +84,14 @@ export async function listPackages(projectRoot: string): Promise<readonly Packag
       }
     }
   }
-  // A project's own packages are its `packages/<name>/`, where the loader finds them by name whether
-  // or not a package manager linked them.
-  for (const entry of (await readdir(join(projectRoot, "packages")).catch(() => [] as string[])).sort()) {
-    const directory = join(projectRoot, "packages", entry);
-    const own = await readJson<{ readonly name?: string }>(join(directory, "package.json"));
-    if (own?.name !== undefined && !candidates.some((item) => item.name === own.name)) candidates.push({ name: own.name, directory });
+  // The loader also finds packages by name under `packages/<name>/`, even without package-manager
+  // links. Published Distributions carry their built-in packages here.
+  for (const root of roots) {
+    for (const entry of (await readdir(join(root, "packages")).catch(() => [] as string[])).sort()) {
+      const directory = join(root, "packages", entry);
+      const own = await readJson<{ readonly name?: string }>(join(directory, "package.json"));
+      if (own?.name !== undefined && !candidates.some((item) => item.name === own.name)) candidates.push({ name: own.name, directory });
+    }
   }
   const listing: PackageListing[] = [];
   for (const { name, directory } of candidates) {
```

**File**: `packages/video-cli/test/vocabulary.test.ts` (modified, +70/-1)
```diff
@@ -1,10 +1,14 @@
 import assert from "node:assert/strict";
-import { basename, dirname, resolve } from "node:path";
+import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
+import { tmpdir } from "node:os";
+import { basename, dirname, join, resolve } from "node:path";
 import { fileURLToPath } from "node:url";
 import test from "node:test";
 
 import type { CliIo } from "@hypit/cli";
+import { markupSurfaceHostFacetAbi } from "@hypit/markup";
 
+import { videoCliDistribution } from "../src/distribution.js";
 import { listPackages, listSurfaces, runVocabularyCli, visualSchema } from "../src/vocabulary.js";
 
 const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
@@ -24,12 +28,77 @@ function io(): { readonly io: CliIo; text: () => string } {
 
 test("the listing sees every activatable package from the repository root", async () => {
   const listing = await listPackages(repositoryRoot);
+  assert.equal(new Set(listing.map((item) => item.name)).size, listing.length);
   const pipeline = listing.find((item) => item.name === "@hypit/media-pipeline");
   assert.ok(pipeline !== undefined, "media-pipeline is listed");
   assert.ok(pipeline.tags.includes("StillVideo"), `tags: ${pipeline.tags.join(", ")}`);
   assert.equal(pipeline.unreadable, undefined);
 });
 
+test("vocabulary discovers bundled packages from a separate project without node_modules", async () => {
+  const root = await mkdtemp(join(tmpdir(), "hypit-vocabulary-"));
+  const project = join(root, "project");
+  const distribution = join(root, "distribution");
+  const originalRoot = Object.getOwnPropertyDescriptor(videoCliDistribution, "packageRoot")!;
+  async function packageAt(directory: string, name: string, description = name): Promise<void> {
+    await mkdir(directory, { recursive: true });
+    await writeFile(join(directory, "package.json"), JSON.stringify({
+      name, version: "1.0.0", type: "module", description,
+      hypit: { activation: "./activation.mjs" },
+    }));
+    await writeFile(join(directory, "activation.mjs"), `export default {
+      format: "hypit.node-package@1",
+      hostFacets: [{
+        abi: ${JSON.stringify(markupSurfaceHostFacetAbi)},
+        implementation: {
+          module: { name: ${JSON.stringify(name)}, version: "1" },
+          surface: "card", tag: "Card", mode: "raw", outputs: [], handler: () => [],
+        },
+      }],
+    };`);
+  }
+  try {
+    await mkdir(project, { recursive: true });
+    await writeFile(join(project, "package.json"), JSON.stringify({ name: "example-project", private: true }));
+    const bundled = join(distribution, "packages", "bundled");
+    await packageAt(bundled, "@hypit/bundled");
+    await writeFile(join(bundled, "README.md"), "Example bundled component.\n");
+    await mkdir(join(distribution, "packages", "inactive"), { recursive: true });
+    await writeFile(join(distribution, "packages", "inactive", "package.json"), JSON.stringify({ name: "@hypit/inactive" }));
+    Object.defineProperty(videoCliDistribution, "packageRoot", { value: distribution });
+
+    const human = io();
+    await runVocabularyCli(["vocabulary"], human.io, project);
+    assert.match(human.text(), /@hypit\/bundled\n\s+tags: Card/u);
+    const json = io();
+    await runVocabularyCli(["vocabulary", "--json"], json.io, project);
+    assert.deepEqual(JSON.parse(json.text()).packages, [{
+      name: "@hypit/bundled", description: "@hypit/bundled", tags: ["Card"],
+    }]);
+
+    const named = io();
+    await runVocabularyCli(["vocabulary", "@hypit/bundled", "--tag", "Card", "--json"], named.io, project);
+    const surfaces = JSON.parse(named.text()).surfaces;
+    assert.equal(surfaces.length, 1);
+    assert.equal(surfaces[0].package, "@hypit/bundled");
+    assert.equal(surfaces[0].tag, "Card");
+    assert.equal(basename(surfaces[0].readme), "README.md");
+
+    // Workspace links and project components must not duplicate the bundled listing.
+    await packageAt(join(distribution, "node_modules", "@hypit", "bundled"), "@hypit/bundled");
+    await packageAt(join(project, "packages", "local"), "@studio/local");
+    await packageAt(join(project, "node_modules", "@studio", "custom"), "@studio/custom", "project package");
+    await packageAt(join(distribution, "packages", "custom"), "@studio/custom", "distribution fallback");
+    const listing = await listPackages(project);
+    assert.deepEqual(listing.map((item) => item.name).sort(), ["@hypit/bundled", "@studio/custom", "@studio/local"]);
+    assert.equal(listing.find((item) => item.name === "@studio/custom")!.description, "project package");
+    assert.ok(listing.every((item) => item.unreadable === undefined && item.tags.includes("Card")));
+  } finally {
+    Object.defineProperty(videoCliDistribution, "packageRoot", originalRoot);
+    await rm(root, { recursive: true, force: true });
+  }
+});
+
 test("a named package answers with its own Surfaces only", async () => {
   c
```

---

### Incident Patch 11: `ecf69e4c` (2026-09-23)
**Commit Message**: fix: ignore album artwork in media probes (#347)

**File**: `packages/video-cli/src/media.ts` (modified, +6/-3)
```diff
@@ -157,13 +157,16 @@ function requireVideo(info: MediaProbe, path: string): asserts info is MediaProb
 
 export async function probeMedia(path: string): Promise<MediaProbe> {
   const raw = await runProcess("ffprobe", [
-    "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", path,
+    "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate:stream_disposition=attached_pic", "-of", "json", path,
   ]);
   const parsed = JSON.parse(raw.toString("utf8")) as {
     format?: { duration?: string };
-    streams?: readonly { codec_type?: string; width?: number; height?: number; r_frame_rate?: string }[];
+    streams?: readonly {
+      codec_type?: string; width?: number; height?: number; r_frame_rate?: string;
+      disposition?: { attached_pic?: number };
+    }[];
   };
-  const video = parsed.streams?.find((item) => item.codec_type === "video");
+  const video = parsed.streams?.find((item) => item.codec_type === "video" && item.disposition?.attached_pic !== 1);
   const duration = Number(parsed.format?.duration);
   assert(Number.isFinite(duration) && duration > 0, `${path}: duration is unavailable`);
   const hasAudio = parsed.streams?.some((item) => item.codec_type === "audio") ?? false;
```

**File**: `packages/video-cli/test/media.test.ts` (modified, +41/-0)
```diff
@@ -135,6 +135,47 @@ test("fetch refuses anything but an http link and an explicit video destination"
   await assert.rejects(runMediaCli(["media", "fetch", "https://example.com/v", "--to", "x.txt"], io().io, tmpdir()), /must end in/);
 });
 
+test("album artwork does not turn an audio cut into video", { skip: !ffmpeg && "ffmpeg is not installed" }, async () => {
+  const work = await mkdtemp(join(tmpdir(), "hypit-covered-audio-"));
+  try {
+    const audio = join(work, "plain.mp3");
+    const artwork = join(work, "cover.jpg");
+    const covered = join(work, "covered.mp3");
+    const tone = spawnSync("ffmpeg", [
+      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
+      "sine=frequency=440:duration=1", "-c:a", "libmp3lame", audio,
+    ], { encoding: "utf8" });
+    assert.equal(tone.status, 0, tone.stderr);
+    await sharp({ create: { width: 32, height: 32, channels: 3, background: "#ee3344" } }).jpeg().toFile(artwork);
+    const attach = spawnSync("ffmpeg", [
+      "-hide_banner", "-loglevel", "error", "-y", "-i", audio, "-i", artwork,
+      "-map", "0:a:0", "-map", "1:v:0", "-c", "copy", "-id3v2_version", "3",
+      "-disposition:v:0", "attached_pic", covered,
+    ], { encoding: "utf8" });
+    assert.equal(attach.status, 0, attach.stderr);
+
+    for (const [index, source] of [audio, covered].entries()) {
+      const info = await probeMedia(source);
+      assert.equal(info.hasAudio, true);
+      assert.equal(info.hasVideo, false, "album artwork is not a timed video stream");
+      const output = join(work, `cut-${index}.wav`);
+      const cut = io();
+      await runMediaCli(["media", "cut", source, "--start", "0", "--end", "0.5", "--to", output, "--json"], cut.io, work);
+      const result = JSON.parse(cut.text()) as { hasVideo: boolean; hasAudio: boolean; actualSeconds: number };
+      assert.equal(result.hasVideo, false);
+      assert.equal(result.hasAudio, true);
+      assert.ok(Math.abs(result.actualSeconds - 0.5) < 0.01);
+      const probe = spawnSync("ffprobe", [
+        "-v", "error", "-show_entries", "stream=codec_type,codec_name", "-of", "json", output,
+      ], { encoding: "utf8" });
+      assert.equal(probe.status, 0, probe.stderr);
+      assert.deepEqual(JSON.parse(probe.stdout).streams, [{ codec_name: "pcm_s24le", codec_type: "audio" }]);
+    }
+  } finally {
+    await rm(work, { recursive: true, force: true });
+  }
+});
+
 test("cut prepares recorded audio and joined video without changing the existing evidence cut", { skip: !ffmpeg && "ffmpeg is not installed" }, async () => {
   const work = await mkdtemp(join(tmpdir(), "hypit-recorded-cut-"));
   try {
```

---

### Incident Patch 12: `ec6f2083` (2026-09-21)
**Commit Message**: fix(endpoint-kit): share the poll error decision across asynchronous Providers (#337)

endpoint-kit now defines the error classes a Provider transport throws
(EndpointTransportError, EndpointHttpError with status and retryAfterMs,
EndpointResponseError, EndpointServiceError) and one decision,
pollAgainOrFail: transport errors and HTTP 429/5xx keep the job pending
for the next poll, honouring Retry-After when given; every other error,
including missing credentials and unusable responses, fails the job.

The six asynchronous Providers (hypihub, beatapi, hiapi, pollo, monid,
tokendance) throw those classes from their request code and route their
poll catch through pollAgainOrFail, replacing the per-Provider status
check that failed on 429 and retried configuration errors until the
operation deadline.

**File**: `packages/endpoint-kit/src/index.ts` (modified, +47/-0)
```diff
@@ -492,3 +492,50 @@ export function wakeAfter(
     ...(progress === undefined ? {} : { progress }),
   };
 }
+
+/** A service reported a failure with a stable code. */
+export class EndpointServiceError extends Error {
+  constructor(readonly code: string, message: string) { super(message); }
+}
+/** A non-success HTTP response, with the wait the service asked for when it gave one. */
+export class EndpointHttpError extends EndpointServiceError {
+  constructor(code: string, message: string, readonly status: number, readonly retryAfterMs?: number) { super(code, message); }
+}
+/** The request produced no response: connection failure, interrupted read, or request timeout. */
+export class EndpointTransportError extends Error {}
+/** A success response whose body cannot be used. */
+export class EndpointResponseError extends Error {}
+
+/** Report a rejected send or read as a transport error. */
+export async function transport<T>(request: Promise<T>): Promise<T> {
+  try { return await request; } catch (error) {
+    if (error instanceof EndpointTransportError) throw error;
+    throw new EndpointTransportError(error instanceof Error ? error.message : String(error), { cause: error });
+  }
+}
+
+/** The wait a `Retry-After` header asks for, in milliseconds; either delay-seconds or an HTTP-date. */
+export function retryAfterMs(headers: Headers, now = Date.now()): number | undefined {
+  const value = headers.get("retry-after")?.trim();
+  if (value === undefined || value.length === 0) return undefined;
+  const delay = /^\d+$/u.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
+  return Number.isFinite(delay) ? Math.max(0, Math.round(delay)) : undefined;
+}
+
+/**
+ * Decide a poll action's outcome from the error it threw. Transport errors and HTTP 429/5xx keep the
+ * job pending for the next poll; every other error, including credential and response errors, fails it.
+ */
+export function pollAgainOrFail(error: unknown, options: {
+  readonly handle: CanonicalValue;
+  readonly pollIntervalMs: number;
+  readonly failure: (error: unknown) => EndpointOutcome;
+}): EndpointOutcome {
+  if (error instanceof EndpointTransportError) {
+    return wakeAfter(options.handle, options.pollIntervalMs, Date.now(), { phase: "retrying" });
+  }
+  if (error instanceof EndpointHttpError && (error.status === 429 || error.status >= 500)) {
+    return wakeAfter(options.handle, error.retryAfterMs ?? options.pollIntervalMs, Date.now(), { phase: "retrying" });
+  }
+  return options.failure(error);
+}
```

**File**: `packages/provider-beatapi/src/errors.ts` (modified, +7/-6)
```diff
@@ -1,3 +1,5 @@
+import { EndpointHttpError, EndpointServiceError } from "@hypit/endpoint-kit";
+
 /** BeatAPI's `{ error: { code, message, request_id, retry_after_seconds } }` envelope and terminal task errors. */
 function record(value: unknown): Record<string, unknown> | undefined {
   return value !== null && typeof value === "object" && !Array.isArray(value)
@@ -12,12 +14,10 @@ export function safeBeatApiReason(value: string): string {
   return value.replace(/https?:\/\/\S+/giu, "[redacted-url]");
 }
 
-export class BeatApiServiceError extends Error {
-  constructor(readonly code: string, message: string) { super(message); }
-}
+export class BeatApiServiceError extends EndpointServiceError {}
 
-export class BeatApiHttpError extends BeatApiServiceError {
-  constructor(readonly status: number, response: { readonly headers: Headers }, bodyText: string,
+export class BeatApiHttpError extends EndpointHttpError {
+  constructor(status: number, response: { readonly headers: Headers }, bodyText: string,
     request: { readonly method: string; readonly path: string; readonly model?: string }) {
     let body: Record<string, unknown> | undefined;
     try { body = record(JSON.parse(bodyText)); } catch { /* Non-JSON gateway failures still have HTTP evidence. */ }
@@ -32,7 +32,8 @@ export class BeatApiHttpError extends BeatApiServiceError {
       ...(requestId === undefined ? [] : [`request=${requestId}`]),
       ...(retryAfter === undefined ? [] : [`retry-after=${retryAfter}s`]),
     ];
-    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeBeatApiReason(reason)}`}`);
+    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeBeatApiReason(reason)}`}`,
+      status, retryAfter === undefined ? undefined : Math.round(retryAfter * 1000));
   }
 }
 
```

**File**: `packages/provider-beatapi/src/provider.ts` (modified, +10/-16)
```diff
@@ -1,6 +1,6 @@
 import { requestDeadline } from "@hypit/runtime-kit";
 import type { AsyncEndpoint, EndpointCredential, EndpointInvocationContext, EndpointOutcome } from "@hypit/endpoint-kit";
-import { defineEndpointPackage, wakeAfter } from "@hypit/endpoint-kit";
+import { EndpointResponseError, EndpointServiceError, EndpointTransportError, defineEndpointPackage, pollAgainOrFail, transport, wakeAfter } from "@hypit/endpoint-kit";
 import type { GenerationArtifactUrlResolver } from "@hypit/generation";
 import { canonicalize } from "@hypit/protocol";
 import type { BlobRef, CapabilityRef } from "@hypit/protocol";
@@ -75,26 +75,26 @@ function failureMessage(error: unknown): string {
   return error instanceof Error ? error.message : String(error);
 }
 function failure(error: unknown): EndpointOutcome {
-  return { status: "failed", failure: { code: error instanceof BeatApiServiceError ? error.code : "BEATAPI_ERROR", message: failureMessage(error) } };
+  return { status: "failed", failure: { code: error instanceof EndpointServiceError ? error.code : "BEATAPI_ERROR", message: failureMessage(error) } };
 }
 
 class BeatApiClient {
   constructor(readonly baseUrl: string, readonly timeout: number, readonly fetcher: typeof globalThis.fetch) {}
   async json(path: string, key: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
-    const deadline = requestDeadline(this.timeout);
+    const deadline = requestDeadline(this.timeout, () => new EndpointTransportError("BeatAPI request timed out"));
     try {
-      const response = await deadline.wait(this.fetcher(`${this.baseUrl}${path}`, {
+      const response = await transport(deadline.wait(this.fetcher(`${this.baseUrl}${path}`, {
         ...init, signal: deadline.signal, headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
-      }));
-      const text = await deadline.wait(response.text());
+      })));
+      const text = await transport(deadline.wait(response.text()));
       if (!response.ok) {
         const input = typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
         throw new BeatApiHttpError(response.status, response, text, {
           method: init.method ?? "GET", path, ...(typeof input?.model === "string" ? { model: input.model } : {}),
         });
       }
       let body: unknown;
-      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new Error(`BeatAPI returned invalid JSON (${response.status})`); }
+      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new EndpointResponseError(`BeatAPI returned invalid JSON (${response.status})`); }
       return object(object(body, "BeatAPI response").data, "BeatAPI response data");
     } finally { deadline.finish(); }
   }
@@ -154,7 +154,7 @@ function endpoint(client: BeatApiClient, pollIntervalMs: number, maxOperationMs:
         try {
           body = await request.compile(resolverFor(client, context, publicAssetUrl));
         } catch (error) {
-          throw new BeatApiServiceError(error instanceof BeatApiServiceError ? error.code : "BEATAPI_ERROR",
+          throw new BeatApiServiceError(error instanceof EndpointServiceError ? error.code : "BEATAPI_ERROR",
             `BeatAPI request preparation failed; model=${request.model}; generation not submitted: ${failureMessage(error)}`);
         }
         await context.reportProgress?.({ phase: `Submitting BeatAPI request: ${request.model}` });
@@ -181,13 +181,7 @@ function endpoint(client: BeatApiClient, pollIntervalMs: number, maxOperationMs:
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "BEATAPI_OPERATION_TIMEOUT", message: `BeatAPI task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        let task: Record<string, unknown>;
-        try {
-          task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
-        } catch (error) {
-          if (error instanceof BeatApiHttpError && error.status < 500) return { ...failure(error), receipt };
-          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
-        }
+        const task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
         const status = String(task.status);
         if (pendingStatuses.includes(status)) {
           return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
@@ -200,7 +194,7 @@ function endpoint(client: BeatApiClient, pollIntervalMs: number, maxOperationMs:
         const urls = media.map((item, index) => httpsUrl(object(item, `BeatAPI output ${index + 1}`).url, `BeatAPI output ${index + 1}`));
         return { status: "ready", handle: canonicalize({ ...handle, urls }), receipt };
 
```

**File**: `packages/provider-hiapi/src/errors.ts` (modified, +6/-6)
```diff
@@ -1,3 +1,5 @@
+import { EndpointHttpError, EndpointServiceError } from "@hypit/endpoint-kit";
+
 /** HiAPI's `{ code, message, error_code }` envelope and task `error` object, kept at the service boundary. */
 function record(value: unknown): Record<string, unknown> | undefined {
   return value !== null && typeof value === "object" && !Array.isArray(value)
@@ -12,12 +14,10 @@ export function safeHiApiReason(value: string): string {
   return value.replace(/https?:\/\/\S+/giu, "[redacted-url]");
 }
 
-export class HiApiServiceError extends Error {
-  constructor(readonly code: string, message: string) { super(message); }
-}
+export class HiApiServiceError extends EndpointServiceError {}
 
-export class HiApiHttpError extends HiApiServiceError {
-  constructor(readonly status: number, response: { readonly headers: Headers }, bodyText: string,
+export class HiApiHttpError extends EndpointHttpError {
+  constructor(status: number, response: { readonly headers: Headers }, bodyText: string,
     request: { readonly method: string; readonly path: string; readonly model?: string }) {
     let body: Record<string, unknown> | undefined;
     try { body = record(JSON.parse(bodyText)); } catch { /* Non-JSON gateway failures still have HTTP evidence. */ }
@@ -29,7 +29,7 @@ export class HiApiHttpError extends HiApiServiceError {
       ...(request.model === undefined ? [] : [`model=${request.model}`]),
       ...(requestId === undefined ? [] : [`request=${requestId}`]),
     ];
-    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeHiApiReason(reason)}`}`);
+    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeHiApiReason(reason)}`}`, status);
   }
 }
 
```

**File**: `packages/provider-hiapi/src/provider.ts` (modified, +10/-16)
```diff
@@ -1,6 +1,6 @@
 import { requestDeadline } from "@hypit/runtime-kit";
 import type { AsyncEndpoint, EndpointCredential, EndpointInvocationContext, EndpointOutcome } from "@hypit/endpoint-kit";
-import { defineEndpointPackage, wakeAfter } from "@hypit/endpoint-kit";
+import { EndpointResponseError, EndpointServiceError, EndpointTransportError, defineEndpointPackage, pollAgainOrFail, transport, wakeAfter } from "@hypit/endpoint-kit";
 import type { GenerationArtifactUrlResolver } from "@hypit/generation";
 import { canonicalize } from "@hypit/protocol";
 import type { BlobRef, CapabilityRef } from "@hypit/protocol";
@@ -56,26 +56,26 @@ function failureMessage(error: unknown): string {
   return error instanceof Error ? error.message : String(error);
 }
 function failure(error: unknown): EndpointOutcome {
-  return { status: "failed", failure: { code: error instanceof HiApiServiceError ? error.code : "HIAPI_ERROR", message: failureMessage(error) } };
+  return { status: "failed", failure: { code: error instanceof EndpointServiceError ? error.code : "HIAPI_ERROR", message: failureMessage(error) } };
 }
 
 class HiApiClient {
   constructor(readonly baseUrl: string, readonly timeout: number, readonly fetcher: typeof globalThis.fetch) {}
   async json(path: string, key: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
-    const deadline = requestDeadline(this.timeout);
+    const deadline = requestDeadline(this.timeout, () => new EndpointTransportError("HiAPI request timed out"));
     try {
-      const response = await deadline.wait(this.fetcher(`${this.baseUrl}${path}`, {
+      const response = await transport(deadline.wait(this.fetcher(`${this.baseUrl}${path}`, {
         ...init, signal: deadline.signal, headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
-      }));
-      const text = await deadline.wait(response.text());
+      })));
+      const text = await transport(deadline.wait(response.text()));
       if (!response.ok) {
         const input = typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
         throw new HiApiHttpError(response.status, response, text, {
           method: init.method ?? "GET", path, ...(typeof input?.model === "string" ? { model: input.model } : {}),
         });
       }
       let body: unknown;
-      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new Error(`HiAPI returned invalid JSON (${response.status})`); }
+      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new EndpointResponseError(`HiAPI returned invalid JSON (${response.status})`); }
       return object(object(body, "HiAPI response").data, "HiAPI response data");
     } finally { deadline.finish(); }
   }
@@ -130,7 +130,7 @@ function endpoint(client: HiApiClient, pollIntervalMs: number, maxOperationMs: n
         try {
           body = await request.compile(resolverFor(request.mediaLimits, context, publicAssetUrl));
         } catch (error) {
-          throw new HiApiServiceError(error instanceof HiApiServiceError ? error.code : "HIAPI_ERROR",
+          throw new HiApiServiceError(error instanceof EndpointServiceError ? error.code : "HIAPI_ERROR",
             `HiAPI request preparation failed; model=${request.model}; generation not submitted: ${failureMessage(error)}`);
         }
         await context.reportProgress?.({ phase: `Submitting HiAPI request: ${request.model}` });
@@ -155,13 +155,7 @@ function endpoint(client: HiApiClient, pollIntervalMs: number, maxOperationMs: n
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "HIAPI_OPERATION_TIMEOUT", message: `HiAPI task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        let task: Record<string, unknown>;
-        try {
-          task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
-        } catch (error) {
-          if (error instanceof HiApiHttpError && error.status < 500) return { ...failure(error), receipt };
-          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
-        }
+        const task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
         const status = String(task.status);
         if (status === "queued" || status === "handling" || status === "archiving") {
           return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
@@ -177,7 +171,7 @@ function endpoint(client: HiApiClient, pollIntervalMs: number, maxOperationMs: n
         });
         return { status: "ready", handle: canonicalize({ ...handle, urls }), receipt };
       } catch (error) {
-        return failure(error);
+        return pollAgainOrFail(error, { handle: context.han
```

**File**: `packages/provider-hypihub/src/errors.ts` (modified, +7/-10)
```diff
@@ -1,3 +1,5 @@
+import { EndpointHttpError, EndpointServiceError, retryAfterMs } from "@hypit/endpoint-kit";
+
 /** HypiHub's public error envelope, kept at the service boundary. */
 function record(value: unknown): Record<string, unknown> | undefined {
   return value !== null && typeof value === "object" && !Array.isArray(value)
@@ -12,13 +14,10 @@ export function safeHypiHubReason(value: string): string {
   return value.replace(/https?:\/\/\S+/giu, "[redacted-url]");
 }
 
-export class HypiHubServiceError extends Error {
-  constructor(readonly code: string, message: string) { super(message); }
-}
+export class HypiHubServiceError extends EndpointServiceError {}
 
-export class HypiHubHttpError extends HypiHubServiceError {
-  readonly retryAfterMs?: number;
-  constructor(readonly status: number, response: { readonly headers: Headers }, bodyText: string,
+export class HypiHubHttpError extends EndpointHttpError {
+  constructor(status: number, response: { readonly headers: Headers }, bodyText: string,
     request: { readonly method: string; readonly url: string; readonly model?: string }) {
     let body: Record<string, unknown> | undefined;
     try { body = record(JSON.parse(bodyText)); } catch { /* Non-JSON gateway failures still have HTTP evidence. */ }
@@ -41,10 +40,8 @@ export class HypiHubHttpError extends HypiHubServiceError {
       ...(retryAfter === undefined ? [] : [`retry-after=${retryAfter}`]),
     ];
     super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeHypiHubReason(reason)}`}`
-      + (body === undefined && bodyText.length > 2000 ? " [response excerpt truncated]" : ""));
-    const delay = retryAfter === undefined ? NaN : /^\d+$/u.test(retryAfter)
-      ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
-    if (Number.isFinite(delay)) this.retryAfterMs = Math.max(0, delay);
+      + (body === undefined && bodyText.length > 2000 ? " [response excerpt truncated]" : ""),
+    status, retryAfterMs(response.headers));
   }
 }
 
```

**File**: `packages/provider-hypihub/src/oauth.ts` (modified, +5/-4)
```diff
@@ -1,4 +1,5 @@
 import type { EndpointCredential } from "@hypit/endpoint-kit";
+import { EndpointTransportError, transport } from "@hypit/endpoint-kit";
 import { decodeOAuth2Credential, encodeOAuth2Credential } from "@hypit/runtime";
 import { requestDeadline } from "@hypit/runtime-kit";
 import { HypiHubHttpError } from "./errors.js";
@@ -66,9 +67,9 @@ export function createHypiHubAuth(options: {
       throw new Error("HypiHub OAuth credential is read-only; run hypit auth login with a writable Credential Store");
     }
     refreshing = (async () => {
-      const deadline = requestDeadline(options.requestTimeoutMs, () => new Error("HypiHub OAuth refresh timed out"));
+      const deadline = requestDeadline(options.requestTimeoutMs, () => new EndpointTransportError("HypiHub OAuth refresh timed out"));
       try {
-        const response = await deadline.wait(options.fetch(tokenEndpoint, {
+        const response = await transport(deadline.wait(options.fetch(tokenEndpoint, {
           method: "POST",
           headers: { "content-type": "application/x-www-form-urlencoded" },
           body: new URLSearchParams({
@@ -77,8 +78,8 @@ export function createHypiHubAuth(options: {
             client_id: OAUTH_CLIENT_ID,
           }),
           signal: deadline.signal,
-        }));
-        const text = await deadline.wait(response.text());
+        })));
+        const text = await transport(deadline.wait(response.text()));
         if (!response.ok) throw new HypiHubHttpError(response.status, response, text, {
           method: "POST", url: tokenEndpoint,
         });
```

**File**: `packages/provider-hypihub/src/provider.ts` (modified, +10/-17)
```diff
@@ -1,7 +1,7 @@
 import { readFileSync } from "node:fs";
 import { requestDeadline } from "@hypit/runtime-kit";
 import type { AsyncEndpoint, EndpointCredential, EndpointFulfillment, EndpointInvocationContext, EndpointPollContext, EndpointPricingReader, EndpointStartContext, EndpointOutcome, ImmediateEndpointHandler } from "@hypit/endpoint-kit";
-import { defineEndpointPackage, wakeAfter } from "@hypit/endpoint-kit";
+import { EndpointResponseError, EndpointServiceError, EndpointTransportError, defineEndpointPackage, pollAgainOrFail, transport, wakeAfter } from "@hypit/endpoint-kit";
 import { selectWireModelForRequest } from "@hypit/generation";
 import type { GenerationRequest } from "@hypit/generation";
 import { canonicalize } from "@hypit/protocol";
@@ -98,7 +98,7 @@ function failureMessage(error: unknown): string {
 }
 function failure(error: unknown): EndpointOutcome {
   const message = failureMessage(error);
-  return { status: "failed", failure: { code: error instanceof HypiHubServiceError ? error.code : "HYPIHUB_ERROR", message } };
+  return { status: "failed", failure: { code: error instanceof EndpointServiceError ? error.code : "HYPIHUB_ERROR", message } };
 }
 
 function jobId(value: Record<string, unknown>): string {
@@ -150,11 +150,11 @@ class HypiHubClient {
   async json(path: string, auth: HypiHubAuth, init: RequestInit = {}, refreshOnUnauthorized = true,
     onResponse?: (response: Response) => Promise<void>): Promise<Record<string, unknown>> {
     const token = await auth.token();
-    const deadline = requestDeadline(this.timeout);
+    const deadline = requestDeadline(this.timeout, () => new EndpointTransportError("HypiHub request timed out"));
     try {
-      const response = await deadline.wait(this.fetcher(`${this.baseUrl}${path}`, { ...init, signal: deadline.signal, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } }));
+      const response = await transport(deadline.wait(this.fetcher(`${this.baseUrl}${path}`, { ...init, signal: deadline.signal, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })));
       if (response.status !== 401 && onResponse !== undefined) await deadline.wait(onResponse(response));
-      const text = await deadline.wait(response.text()); let body: unknown = {};
+      const text = await transport(deadline.wait(response.text())); let body: unknown = {};
       if (response.status === 401 && refreshOnUnauthorized && auth.canRefresh()) {
         deadline.finish();
         await auth.refresh();
@@ -167,7 +167,7 @@ class HypiHubClient {
           ...(typeof input?.model === "string" ? { model: input.model } : {}),
         });
       }
-      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new Error(`HypiHub returned invalid JSON (${response.status})`); }
+      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new EndpointResponseError(`HypiHub returned invalid JSON (${response.status})`); }
       return object(body, "HypiHub response");
     } finally { deadline.finish(); }
   }
@@ -427,7 +427,7 @@ async function prepareGeneration(client: HypiHubClient, context: EndpointInvocat
   try {
     await verifyModelRoute(client, auth, request.model, request.operation);
   } catch (error) {
-    throw new HypiHubServiceError(error instanceof HypiHubServiceError ? error.code : "HYPIHUB_ERROR",
+    throw new HypiHubServiceError(error instanceof EndpointServiceError ? error.code : "HYPIHUB_ERROR",
       `HypiHub model catalogue check failed; model=${request.model}; operation=${request.operation}; references uploaded=0; generation not submitted: ${failureMessage(error)}`);
   }
   await context.reportProgress?.({ phase: `Preparing HypiHub request: ${request.model} (${request.operation})` });
@@ -446,7 +446,7 @@ async function prepareGeneration(client: HypiHubClient, context: EndpointInvocat
   try {
     compiled = await request.compile(resolve);
   } catch (error) {
-    throw new HypiHubServiceError(error instanceof HypiHubServiceError ? error.code : "HYPIHUB_ERROR",
+    throw new HypiHubServiceError(error instanceof EndpointServiceError ? error.code : "HYPIHUB_ERROR",
       `HypiHub request preparation failed; model=${request.model}; operation=${request.operation}; generation not submitted: ${failureMessage(error)}`);
   }
   return { route, auth, compiled, operation: request.operation };
@@ -494,21 +494,14 @@ function endpoint(client: HypiHubClient, pollIntervalMs: number, maxOperationMs:
             receipt: { id: handle.jobId },
             failure: { code: "HYPIHUB_OPERATION_TIMEOUT", message: `HypiHub job ${handle.jobId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        let job: Record<string, unknown>;
-        try {
-          job = await client.json(`/jobs/${encodeURIComponent(handle.jobId)}`, authFor(context, client));
-        } catch (error) {
-          if (error instanceof HypiHubHttpErr
```

---

### Incident Patch 13: `636270fe` (2026-09-21)
**Commit Message**: fix(providers): keep async jobs pending when a progress poll hits a transport error (#336)

A single failed status request (5xx such as 522, connection failure, or
request timeout) in poll() was returned as a failed operation, so the
driver stopped polling while the remote job continued to run and settle.
The job is now kept pending and polled again after pollIntervalMs; 4xx
responses still fail the operation, and operationTimeoutMs remains the
upper bound.

Applies to hypihub, beatapi, hiapi, pollo, monid and tokendance.

**File**: `packages/provider-beatapi/src/provider.ts` (modified, +7/-1)
```diff
@@ -181,7 +181,13 @@ function endpoint(client: BeatApiClient, pollIntervalMs: number, maxOperationMs:
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "BEATAPI_OPERATION_TIMEOUT", message: `BeatAPI task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
+        let task: Record<string, unknown>;
+        try {
+          task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
+        } catch (error) {
+          if (error instanceof BeatApiHttpError && error.status < 500) return { ...failure(error), receipt };
+          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
+        }
         const status = String(task.status);
         if (pendingStatuses.includes(status)) {
           return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
```

**File**: `packages/provider-hiapi/src/provider.ts` (modified, +7/-1)
```diff
@@ -155,7 +155,13 @@ function endpoint(client: HiApiClient, pollIntervalMs: number, maxOperationMs: n
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "HIAPI_OPERATION_TIMEOUT", message: `HiAPI task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
+        let task: Record<string, unknown>;
+        try {
+          task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
+        } catch (error) {
+          if (error instanceof HiApiHttpError && error.status < 500) return { ...failure(error), receipt };
+          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
+        }
         const status = String(task.status);
         if (status === "queued" || status === "handling" || status === "archiving") {
           return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
```

**File**: `packages/provider-hypihub/src/provider.ts` (modified, +8/-1)
```diff
@@ -494,7 +494,14 @@ function endpoint(client: HypiHubClient, pollIntervalMs: number, maxOperationMs:
             receipt: { id: handle.jobId },
             failure: { code: "HYPIHUB_OPERATION_TIMEOUT", message: `HypiHub job ${handle.jobId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const job = await client.json(`/jobs/${encodeURIComponent(handle.jobId)}`, authFor(context, client)); const status = job.status;
+        let job: Record<string, unknown>;
+        try {
+          job = await client.json(`/jobs/${encodeURIComponent(handle.jobId)}`, authFor(context, client));
+        } catch (error) {
+          if (error instanceof HypiHubHttpError && error.status < 500) return failure(error);
+          return wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" });
+        }
+        const status = job.status;
         if (status === "queued" || status === "running" || status === "in_progress") return wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: String(status) });
         const rejected = hypiHubJobFailure(job, handle.jobId);
         if (rejected !== undefined) return { ...failure(rejected), receipt: { id: handle.jobId } };
```

**File**: `packages/provider-hypihub/test/provider.test.ts` (modified, +3/-3)
```diff
@@ -786,7 +786,7 @@ test("HypiHub exposes model groups beneath its own total capacity", async () =>
   assert.throws(() => createHypiHubProvider({ capabilityConcurrency: { invented: 1 } }), /unknown HypiHub capacity/);
 });
 
-test("HypiHub polling errors and operation deadlines fail without settlement polling", async () => {
+test("HypiHub operation deadlines fail while polling transport errors keep the job pending", async () => {
   const request = need({});
   let requests = 0;
   const registry = new EndpointRegistry();
@@ -807,8 +807,8 @@ test("HypiHub polling errors and operation deadlines fail without settlement pol
   assert.equal(timedOut.status === "failed" && timedOut.failure.code, "HYPIHUB_OPERATION_TIMEOUT");
   assert.equal(requests, 0);
   const offline = await endpoint.poll({ ...common, handle: { ...common.handle, startedAt: Date.now() } });
-  assert.equal(offline.status, "failed");
-  assert.match(offline.status === "failed" ? offline.failure.message : "", /offline/);
+  assert.equal(offline.status, "pending");
+  assert.equal(offline.status === "pending" && offline.progress?.phase, "retrying");
   assert.equal(requests, 1);
 });
 
```

**File**: `packages/provider-monid/src/provider.ts` (modified, +7/-1)
```diff
@@ -202,7 +202,13 @@ function endpoint(client: MonidClient, pollIntervalMs: number, maxOperationMs: n
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "MONID_OPERATION_TIMEOUT", message: `Monid run ${handle.runId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const run = await client.getRun(handle.runId, apiKey(context.credentials));
+        let run: Record<string, unknown>;
+        try {
+          run = await client.getRun(handle.runId, apiKey(context.credentials));
+        } catch (error) {
+          if (error instanceof MonidHttpError && error.status < 500) return { ...failure(error), receipt };
+          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
+        }
         const status = String(run.status);
         if (!monidTerminalStatuses.includes(status as typeof monidTerminalStatuses[number])) {
           return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
```

**File**: `packages/provider-pollo/src/provider.ts` (modified, +7/-1)
```diff
@@ -133,7 +133,13 @@ function endpoint(client: PolloClient, pollIntervalMs: number, maxOperationMs: n
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "POLLO_OPERATION_TIMEOUT", message: `Pollo task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const task = await client.json(`/v1/generation/${encodeURIComponent(handle.taskId)}/status`, apiKey(context.credentials));
+        let task: Record<string, unknown>;
+        try {
+          task = await client.json(`/v1/generation/${encodeURIComponent(handle.taskId)}/status`, apiKey(context.credentials));
+        } catch (error) {
+          if (error instanceof PolloHttpError && error.status < 500) return { ...failure(error), receipt };
+          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
+        }
         assert(Array.isArray(task.generations) && task.generations.length > 0, "Pollo task has no generations");
         const generations = task.generations.map((item, index) => object(item, `Pollo generation ${index + 1}`));
         const rejected = polloTaskFailure(generations, handle.taskId);
```

**File**: `packages/provider-tokendance/src/provider.ts` (modified, +8/-1)
```diff
@@ -208,7 +208,14 @@ function endpoint(client: TokenDanceClient, pollIntervalMs: number, maxOperation
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "TOKENDANCE_OPERATION_TIMEOUT", message: `TokenDance task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const task = taskBody(route.protocol, await client.json(paths[route.protocol].task(handle.taskId), apiKey(context.credentials)));
+        let response: Record<string, unknown>;
+        try {
+          response = await client.json(paths[route.protocol].task(handle.taskId), apiKey(context.credentials));
+        } catch (error) {
+          if (error instanceof TokenDanceHttpError && error.status < 500) return { ...failure(error), receipt };
+          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
+        }
+        const task = taskBody(route.protocol, response);
         const status = String(task.status);
         if (status === "queued" || status === "running") return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
         const rejected = tokenDanceTaskFailure(task, handle.taskId);
```

---

### Incident Patch 14: `56057fd0` (2026-09-20)
**Commit Message**: fix(pixverse): render at 540p or 720p

The two models' quality band is now 540p and 720p. The port table holds the
band, so the Surface vocabulary, its notes and the README follow from it.

**File**: `packages/pixverse/README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ Exact author/compute contracts and package-owned author Surfaces for PixVerse. T
 two exact models, `pixverse-v6` and `pixverse-c1`, and selects no Provider, API key or network
 execution. The selected Provider implements the exact capability.
 
-Both models render 1 to 15 seconds at `360p`, `540p`, `720p` or `1080p` from a prompt of up to
+Both models render 1 to 15 seconds at `540p` or `720p` from a prompt of up to
 5,000 characters. `<pix:Video>` generates from the prompt, from a first frame, or from a first and
 last frame; `<pix:ReferenceVideo>` generates from the image and video subjects its `Reference`
 children carry.
```

**File**: `packages/pixverse/src/index.ts` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ export const pixverseModuleRef = { name: "@hypit/pixverse", version: "1" } as co
 export const pixverseModels = ["pixverse-v6", "pixverse-c1"] as const;
 export type PixverseModel = typeof pixverseModels[number];
 
-const PIXVERSE_QUALITIES = ["360p", "540p", "720p", "1080p"] as const;
+const PIXVERSE_QUALITIES = ["540p", "720p"] as const;
 const PIXVERSE_ASPECT_RATIOS = ["16:9", "4:3", "1:1", "3:4", "9:16", "2:3", "3:2", "21:9"] as const;
 /** V6 reads `auto` as the shape of the reference videos it generates from. */
 const PIXVERSE_V6_ASPECT_RATIOS = [...PIXVERSE_ASPECT_RATIOS, "auto"] as const;
@@ -142,7 +142,7 @@ const pixverseVideoPort: readonly SurfacePortVocabulary[] = [{
   summary: "The generated video, addressed as `<id>.video`.",
 }];
 
-const pixverseQualityNote = "`quality` is `360p`, `540p`, `720p` or `1080p`, and `duration` is 1 to 15 seconds.";
+const pixverseQualityNote = "`quality` is `540p` or `720p`, and `duration` is 1 to 15 seconds.";
 const pixversePromptNote = "A spoken line belongs in the prompt; the model exposes no separate voice, language or dialogue field.";
 const pixverseModelNote = "V6 accepts `seed` and up to ten references; C1 accepts up to seven references.";
 
```

---

### Incident Patch 15: `deb799be` (2026-09-19)
**Commit Message**: fix(studio): serve composition material in the ranges a media element asks for (#329)

**File**: `packages/studio/src/server.ts` (modified, +17/-2)
```diff
@@ -722,12 +722,27 @@ export function studioPlugin(options: StudioPluginOptions): Plugin {
             response.end();
             return;
           }
-          response.statusCode = 200;
+          const size = file.bytes.byteLength;
+          let range: BuildResultFileRange | undefined;
+          try {
+            range = requestedByteRange(request.headers.range, size);
+          } catch (error) {
+            if (!(error instanceof RangeError)) throw error;
+            response.statusCode = 416;
+            response.setHeader("content-range", `bytes */${size}`);
+            response.end();
+            return;
+          }
+          response.statusCode = range === undefined ? 200 : 206;
           response.setHeader("content-type", file.mediaType);
+          response.setHeader("content-length", String(range === undefined ? size : range.endExclusive - range.start));
           response.setHeader("cache-control", "no-store");
           response.setHeader("accept-ranges", "bytes");
+          if (range !== undefined) {
+            response.setHeader("content-range", `bytes ${range.start}-${range.endExclusive - 1}/${size}`);
+          }
           if (request.method === "HEAD") response.end();
-          else response.end(Buffer.from(file.bytes));
+          else response.end(range === undefined ? file.bytes : file.bytes.subarray(range.start, range.endExclusive));
           return;
         }
         if (url.pathname === "/__studio/artifact") {
```

#### Recent Merged Pull Requests:
- **PR #379** (closed): Claude/kind meitner mtigge (@F0RGIS)
- **PR #378** (2026-10-03): docs: use the built-in simple-icons slug for hypit badges (@LitoMore)
- **PR #376** (2026-10-01): fix: include the network cause in transport errors (@rponeawa)
- **PR #361** (2026-09-26): fix(cli): resolve packages status the way a Build resolves (@rponeawa)
- **PR #353** (2026-09-24): feat(studio): add a light theme that follows the browser (@rponeawa)
- **PR #351** (closed): feat(provider-muapi): add native MuAPI Seedance gateway (@Anil-matcha)
- **PR #349** (2026-09-23): fix(oauth): return sign-in through the hosted callback page (@rponeawa)
- **PR #347** (2026-09-23): fix: ignore album artwork in media probes (@HaokaiDing)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

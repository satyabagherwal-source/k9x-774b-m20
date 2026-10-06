# Forensic Learning Record (Deep Inspection): google/adk-java

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-adk-java-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/adk-java](https://github.com/google/adk-java))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:57:36.148Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/adk-java`
- **Description**: An open-source, code-first Java toolkit for building, evaluating, and deploying sophisticated AI agents with flexibility and control.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1746 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `tokt/src/main/kotlin/com/google/adk/tokt/codecs/StateDeltaCodec.kt`
```
/*
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.google.adk.tokt.codecs

import com.google.adk.kt.sessions.State as KtState
import com.google.adk.sessions.State as JavaState

/**
 * Translates the removed-entry sentinel between the ADK Java and Kotlin `State`. The two frameworks
 * use distinct singleton sentinels ([JavaState.REMOVED] / [KtState.REMOVED]) and the Kotlin engine
 * matches deletions by identity, so a Java sentinel left in a Kotlin delta would be persisted as a
 * value instead of removing the key.
 */

/**
 * Maps a Java state value to Kotlin: the removal sentinel and null (ADK Java's null-as-removal
 * convention) become [KtState.REMOVED]; other values pass through.
 */
internal fun stateValueFromJava(value: Any?): Any =
  if (value == null || value === JavaState.REMOVED) KtState.REMOVED else value

/** Copies a Java state delta to a new Kotlin delta, translating the removal sentinel. */
internal fun stateDeltaFromJava(delta: Map<String, Any>?): MutableMap<String, Any> {
  val result = mutableMapOf<String, Any>()
  delta?.forEach { (key, value) -> result[key] = stateValueFromJava(value) }
  return result
}

/**
 * Translates any Java removal sentinel to the Kotlin one in a live Kotlin [delta], in place. A Java
 * tool / plugin removing a key through the live actions view writes the Java sentinel straight into
 * the Kotlin delta map (both are backed by the same concurrent map); this reconciles it so the
 * engine recognizes the deletion.
 */
internal fun reconcileRemovedSentinels(delta: MutableMap<String, Any>) {
  for (entry in delta.entries) {
    if (entry.value === JavaState.REMOVED) entry.setValue(KtState.REMOVED)
  }
}

```

### Core Architecture Module: `dev/browser/assets/audio-processor.js`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.targetSampleRate = 22000;  // Change to your desired rate
        this.originalSampleRate = sampleRate; // Browser's sample rate
        this.resampleRatio = this.originalSampleRate / this.targetSampleRate;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            let audioData = input[0]; // Get first channel's data

            if (this.resampleRatio !== 1) {
                audioData = this.resample(audioData);
            }

            this.port.postMessage(audioData);
        }
        return true; // Keep processor alive
    }

    resample(audioData) {
        const newLength = Math.round(audioData.length / this.resampleRatio);
        const resampled = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const srcIndex = Math.floor(i * this.resampleRatio);
            resampled[i] = audioData[srcIndex]; // Nearest neighbor resampling
        }
        return resampled;
    }
}

registerProcessor('audio-processor', AudioProcessor);

```

### Core Architecture Module: `dev/browser/chunk-2MVVEOIQ.js`
```
import{$a as r,Ca as o,Db as d,Yb as l,Zb as s,eb as a,pd as m}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";var f=(()=>{class e extends m{static \u0275fac=(()=>{let i;return function(t){return(i||(i=o(e)))(t||e)}})();static \u0275cmp=r({type:e,selectors:[["a2ui-divider"]],features:[a],decls:1,vars:4,template:function(n,t){n&1&&d(0,"hr"),n&2&&(l(t.theme.additionalStyles==null?null:t.theme.additionalStyles.Divider),s(t.theme.components.Divider))},styles:["[_nghost-%COMP%]{display:block;min-height:0;overflow:auto}hr[_ngcontent-%COMP%]{height:1px;background:#ccc;border:none}"]})}return e})();export{f as Divider};

```

### Core Architecture Module: `dev/browser/chunk-2VKC3BHH.js`
```
import{$a as r,Ca as o,Cc as h,Gb as u,Jb as p,Pa as a,Yb as m,Zb as f,eb as c,pd as y,qd as g,xb as s,yb as l,zb as d}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";var _=(()=>{class n extends y{action=h.required();handleClick(){let t=this.action();t&&super.sendAction(t)}static \u0275fac=(()=>{let t;return function(e){return(t||(t=o(n)))(e||n)}})();static \u0275cmp=r({type:n,selectors:[["a2ui-button"]],inputs:{action:[1,"action"]},features:[c],decls:2,vars:6,consts:[[3,"click"],["a2ui-renderer","",3,"surfaceId","component"]],template:function(i,e){i&1&&(l(0,"button",0),p("click",function(){return e.handleClick()}),u(1,1),d()),i&2&&(m(e.theme.additionalStyles==null?null:e.theme.additionalStyles.Button),f(e.theme.components.Button),a(),s("surfaceId",e.surfaceId())("component",e.component().properties.child))},dependencies:[g],styles:["[_nghost-%COMP%]{display:block;flex:var(--weight);min-height:0}"]})}return n})();export{_ as Button};

```

### Core Architecture Module: `dev/browser/chunk-4S2CIXCW.js`
```
import{$a as s,Ca as o,Cc as _,Gb as u,Lb as g,Pa as r,Yb as y,Zb as C,eb as c,ob as a,pd as M,qd as v,ub as d,vb as l,wb as p,xb as m,yb as f,zb as h}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";function O(e,x){if(e&1&&u(0,0),e&2){let n=x.$implicit,i=g();m("surfaceId",i.surfaceId())("component",n)}}var D=(()=>{class e extends M{direction=_("vertical");static \u0275fac=(()=>{let n;return function(t){return(n||(n=o(e)))(t||e)}})();static \u0275cmp=s({type:e,selectors:[["a2ui-list"]],hostVars:1,hostBindings:function(i,t){i&2&&a("direction",t.direction())},inputs:{direction:[1,"direction"]},features:[c],decls:3,vars:4,consts:[["a2ui-renderer","",3,"surfaceId","component"]],template:function(i,t){i&1&&(f(0,"section"),l(1,O,1,2,"ng-container",0,d),h()),i&2&&(y(t.theme.additionalStyles==null?null:t.theme.additionalStyles.List),C(t.theme.components.List),r(),p(t.component().properties.children))},dependencies:[v],styles:['[_nghost-%COMP%]{display:block;flex:var(--weight);min-height:0;overflow:auto}[direction="vertical"][_nghost-%COMP%]   section[_ngcontent-%COMP%]{display:grid}[direction="horizontal"][_nghost-%COMP%]   section[_ngcontent-%COMP%]{display:flex;max-width:100%;overflow-x:scroll;overflow-y:hidden;scrollbar-width:none}[direction="horizontal"][_nghost-%COMP%]   section[_ngcontent-%COMP%] > [_ngcontent-%COMP%]::slotted(*){flex:1 0 fit-content;max-width:min(80%,400px)}']})}return e})();export{D as List};

```

### Core Architecture Module: `dev/browser/chunk-5VJ6OSLK.js`
```
import{$a as d,Bb as m,Ca as r,Cb as u,Cc as _,Db as p,Ib as v,Lb as f,Ma as l,Pa as n,Yb as y,Zb as g,eb as s,fc as h,gc as x,hc as C,pd as b,qb as a,sb as c,wc as M}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";function U(e,V){if(e&1&&(m(0,"section"),p(1,"video",1),u()),e&2){let t=f(),i=C(0);y(t.theme.additionalStyles==null?null:t.theme.additionalStyles.Video),g(t.theme.components.Video),n(),v("src",i,l)}}var L=(()=>{class e extends b{url=_.required();resolvedUrl=M(()=>this.resolvePrimitive(this.url()));static \u0275fac=(()=>{let t;return function(o){return(t||(t=r(e)))(o||e)}})();static \u0275cmp=d({type:e,selectors:[["a2ui-video"]],inputs:{url:[1,"url"]},features:[s],decls:2,vars:2,consts:[[3,"class","style"],["controls","",3,"src"]],template:function(i,o){if(i&1&&(h(0),a(1,U,2,5,"section",0)),i&2){let D=x(o.resolvedUrl());n(),c(D?1:-1)}},styles:["[_nghost-%COMP%]{display:block;flex:var(--weight);min-height:0;overflow:auto}video[_ngcontent-%COMP%]{display:block;width:100%;box-sizing:border-box}"]})}return e})();export{L as Video};

```

### Core Architecture Module: `dev/browser/chunk-7P7JIWGK.js`
```
import{$a as m,Bb as g,Ca as a,Cb as p,Cc as r,Db as v,Ib as h,Lb as f,Ma as l,Nc as D,Pa as o,Yb as y,Zb as x,eb as d,fc as M,gc as b,hc as C,pd as I,qb as c,sb as u,wc as s}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";function H(t,U){if(t&1&&(g(0,"section"),v(1,"img",1),p()),t&2){let e=f(),i=C(0);y(e.theme.additionalStyles==null?null:e.theme.additionalStyles.Image),x(e.classes()),o(),h("src",i,l)}}var w=(()=>{class t extends I{url=r.required();usageHint=r.required();resolvedUrl=s(()=>this.resolvePrimitive(this.url()));classes=s(()=>{let e=this.usageHint();return D.merge(this.theme.components.Image.all,e?this.theme.components.Image[e]:{})});static \u0275fac=(()=>{let e;return function(n){return(e||(e=a(t)))(n||t)}})();static \u0275cmp=m({type:t,selectors:[["a2ui-image"]],inputs:{url:[1,"url"],usageHint:[1,"usageHint"]},features:[d],decls:2,vars:2,consts:[[3,"class","style"],[3,"src"]],template:function(i,n){if(i&1&&(M(0),c(1,H,2,5,"section",0)),i&2){let _=b(n.resolvedUrl());o(),u(_?1:-1)}},styles:["[_nghost-%COMP%]{display:block;flex:var(--weight);min-height:0;overflow:auto}img[_ngcontent-%COMP%]{display:block;width:100%;height:100%;box-sizing:border-box}"]})}return t})();export{w as Image};

```

### Core Architecture Module: `dev/browser/chunk-A2SOFJNC.js`
```
import{$a as p,$b as b,Bb as l,Ca as m,Cb as r,Cc as c,Ib as d,Kb as h,Pa as o,Yb as v,Zb as a,_b as g,eb as u,pd as f,wc as s}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";var E=(()=>{class i extends f{value=c.required();label=c.required();inputChecked=s(()=>super.resolvePrimitive(this.value())??!1);resolvedLabel=s(()=>super.resolvePrimitive(this.label()));inputId=super.getUniqueId("a2ui-checkbox");handleChange(t){let n=this.value()?.path;!(t.target instanceof HTMLInputElement)||!n||this.processor.setData(this.component(),n,t.target.checked,this.surfaceId())}static \u0275fac=(()=>{let t;return function(e){return(t||(t=m(i)))(e||i)}})();static \u0275cmp=p({type:i,selectors:[["a2ui-checkbox"]],inputs:{value:[1,"value"],label:[1,"label"]},features:[u],decls:4,vars:12,consts:[["autocomplete","off","type","checkbox",3,"change","id","checked"],[3,"htmlFor"]],template:function(n,e){n&1&&(l(0,"section")(1,"input",0),h("change",function(k){return e.handleChange(k)}),r(),l(2,"label",1),g(3),r()()),n&2&&(v(e.theme.additionalStyles==null?null:e.theme.additionalStyles.CheckBox),a(e.theme.components.CheckBox.container),o(),a(e.theme.components.CheckBox.element),d("id",e.inputId)("checked",e.inputChecked()),o(),a(e.theme.components.CheckBox.label),d("htmlFor",e.inputId),o(),b(e.resolvedLabel()))},styles:["[_nghost-%COMP%]{display:block;flex:var(--weight);min-height:0;overflow:auto}input[_ngcontent-%COMP%]{display:block;width:100%}"]})}return i})();export{E as Checkbox};

```

### Core Architecture Module: `dev/browser/chunk-CD6LWQYN.js`
```
import{$a as c,Ca as o,Gb as h,Lb as y,Pa as a,Yb as C,Zb as g,eb as d,nc as v,pd as _,qd as w,ub as s,vb as l,wb as p,xb as m,yb as u,zb as f}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";var D=e=>[e];function M(e,F){if(e&1&&h(0,0),e&2){let i=F.$implicit,n=y();m("surfaceId",n.surfaceId())("component",i)}}var T=(()=>{class e extends _{static \u0275fac=(()=>{let i;return function(t){return(i||(i=o(e)))(t||e)}})();static \u0275cmp=c({type:e,selectors:[["a2ui-card"]],features:[d],decls:3,vars:6,consts:[["a2ui-renderer","",3,"surfaceId","component"]],template:function(n,t){if(n&1&&(u(0,"section"),l(1,M,1,2,"ng-container",0,s),f()),n&2){let r=t.component().properties,I=r.children||v(4,D,r.child);C(t.theme.additionalStyles==null?null:t.theme.additionalStyles.Card),g(t.theme.components.Card),a(),p(I)}},dependencies:[w],styles:[`a2ui-card{display:block;flex:var(--weight);min-height:0;overflow:auto}a2ui-card>section{height:100%;width:100%;min-height:0;overflow:auto}a2ui-card>section>*{height:100%;width:100%}
`],encapsulation:2})}return e})();export{T as Card};

```

### Core Architecture Module: `dev/browser/chunk-DTNGXRUJ.js`
```
import{$a as h,$b as u,Bb as l,Ca as m,Cb as a,Cc as c,Ib as r,Kb as M,Lb as C,Pa as n,Yb as y,Zb as s,_b as d,eb as v,pd as b,vb as g,wb as f,wc as _}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";var D=(i,p)=>p.value;function P(i,p){if(i&1&&(l(0,"option",2),d(1),a()),i&2){let t=p.$implicit,o=C();r("value",t.value),n(),u(o.resolvePrimitive(t.label))}}var x=(()=>{class i extends b{options=c.required();value=c.required();description=c.required();selectId=super.getUniqueId("a2ui-multiple-choice");selectValue=_(()=>super.resolvePrimitive(this.value()));handleChange(t){let o=this.value()?.path;!(t.target instanceof HTMLSelectElement)||!t.target.value||!o||this.processor.setData(this.component(),this.processor.resolvePath(o,this.component().dataContextPath),t.target.value)}static \u0275fac=(()=>{let t;return function(e){return(t||(t=m(i)))(e||i)}})();static \u0275cmp=h({type:i,selectors:[["a2ui-multiple-choice"]],inputs:{options:[1,"options"],value:[1,"value"],description:[1,"description"]},features:[v],decls:6,vars:12,consts:[[3,"for"],[3,"change","id","value"],[3,"value"]],template:function(o,e){o&1&&(l(0,"section")(1,"label",0),d(2),a(),l(3,"select",1),M("change",function(E){return e.handleChange(E)}),g(4,P,2,2,"option",2,D),a()()),o&2&&(s(e.theme.components.MultipleChoice.container),n(),s(e.theme.components.MultipleChoice.label),r("htmlFor",e.selectId),n(),u(e.description()),n(),y(e.theme.additionalStyles==null?null:e.theme.additionalStyles.MultipleChoice),s(e.theme.components.MultipleChoice.element),r("id",e.selectId)("value",e.selectValue()),n(),f(e.options()))},styles:["[_nghost-%COMP%]{display:block;flex:var(--weight);min-height:0;overflow:auto}select[_ngcontent-%COMP%]{width:100%;box-sizing:border-box}"]})}return i})();export{x as MultipleChoice};

```

### Core Architecture Module: `dev/browser/chunk-EN473UE3.js`
```
import{a as M,b as P,e as xr,g as vt}from"./chunk-W7GRJBO5.js";var De=null,ts=!1,lc=1,JD=null,se=Symbol("SIGNAL");function I(e){let t=De;return De=e,t}function ns(){return De}var an={version:0,lastCleanEpoch:0,dirty:!1,producers:void 0,producersTail:void 0,consumers:void 0,consumersTail:void 0,recomputing:!1,consumerAllowSignalWrites:!1,consumerIsAlwaysLive:!1,kind:"unknown",producerMustRecompute:()=>!1,producerRecomputeValue:()=>{},consumerMarkedDirty:()=>{},consumerOnSignalRead:()=>{}};function cn(e){if(ts)throw new Error("");if(De===null)return;De.consumerOnSignalRead(e);let t=De.producersTail;if(t!==void 0&&t.producer===e)return;let n,r=De.recomputing;if(r&&(n=t!==void 0?t.nextProducer:De.producers,n!==void 0&&n.producer===e)){De.producersTail=n,n.lastReadVersion=e.version;return}let o=e.consumersTail;if(o!==void 0&&o.consumer===De&&(!r||eE(o,De)))return;let i=Sr(De),s={producer:e,consumer:De,nextProducer:n,prevConsumer:o,lastReadVersion:e.version,nextConsumer:void 0};De.producersTail=s,t!==void 0?t.nextProducer=s:De.producers=s,i&&c0(e,s)}function s0(){lc++}function Ln(e){if(!(Sr(e)&&!e.dirty)&&!(!e.dirty&&e.lastCleanEpoch===lc)){if(!e.producerMustRecompute(e)&&!Tr(e)){Ir(e);return}e.producerRecomputeValue(e),Ir(e)}}function dc(e){if(e.consumers===void 0)return;let t=ts;ts=!0;try{for(let n=e.consumers;n!==void 0;n=n.nextConsumer){let r=n.consumer;r.dirty||XD(r)}}finally{ts=t}}function fc(){return De?.consumerAllowSignalWrites!==!1}function XD(e){e.dirty=!0,dc(e),e.consumerMarkedDirty?.(e)}function Ir(e){e.dirty=!1,e.lastCleanEpoch=lc}function Lt(e){return e&&u0(e),I(e)}function u0(e){e.producersTail=void 0,e.recomputing=!0}function ln(e,t){I(t),e&&a0(e)}function a0(e){e.recomputing=!1;let t=e.producersTail,n=t!==void 0?t.nextProducer:e.producers;if(n!==void 0){if(Sr(e))do n=pc(n);while(n!==void 0);t!==void 0?t.nextProducer=void 0:e.producers=void 0}}function Tr(e){for(let t=e.producers;t!==void 0;t=t.nextProducer){let n=t.producer,r=t.lastReadVersion;if(r!==n.version||(Ln(n),r!==n.version))return!0}return!1}function dn(e){if(Sr(e)){let t=e.producers;for(;t!==void 0;)t=pc(t)}e.producers=void 0,e.producersTail=void 0,e.consumers=void 0,e.consumersTail=void 0}function c0(e,t){let n=e.consumersTail,r=Sr(e);if(n!==void 0?(t.nextConsumer=n.nextConsumer,n.nextConsumer=t):(t.nextConsumer=void 0,e.consumers=t),t.prevConsumer=n,e.consumersTail=t,!r)for(let o=e.producers;o!==void 0;o=o.nextProducer)c0(o.producer,o)}function pc(e){let t=e.producer,n=e.nextProducer,r=e.nextConsumer,o=e.prevConsumer;if(e.nextConsumer=void 0,e.prevConsumer=void 0,r!==void 0?r.prevConsumer=o:t.consumersTail=o,o!==void 0)o.nextConsumer=r;else if(t.consumers=r,!Sr(t)){let i=t.producers;for(;i!==void 0;)i=pc(i)}return n}function Sr(e){return e.consumerIsAlwaysLive||e.consumers!==void 0}function ko(e){JD?.(e)}function eE(e,t){let n=t.producersTail;if(n!==void 0){let r=t.producers;do{if(r===e)return!0;if(r===n)break;r=r.nextProducer}while(r!==void 0)}return!1}function Ro(e,t){return Object.is(e,t)}function Fo(e,t){let n=Object.create(tE);n.computation=e,t!==void 0&&(n.equal=t);let r=()=>{if(Ln(n),cn(n),n.value===Dt)throw n.error;return n.value};return r[se]=n,ko(n),r}var un=Symbol("UNSET"),Pn=Symbol("COMPUTING"),Dt=Symbol("ERRORED"),tE=P(M({},an),{value:un,dirty:!0,error:null,equal:Ro,kind:"computed",producerMustRecompute(e){return e.value===un||e.value===Pn},producerRecomputeValue(e){if(e.value===Pn)throw new Error("");let t=e.value;e.value=Pn;let n=Lt(e),r,o=!1;try{r=e.computation(),I(null),o=t!==un&&t!==Dt&&r!==Dt&&e.equal(t,r)}catch(i){r=Dt,e.error=i}finally{ln(e,n)}if(o){e.value=t;return}e.value=r,e.version++}});function nE(){throw new Error}var l0=nE;function d0(e){l0(e)}function hc(e){l0=e}var rE=null;function gc(e,t){let n=Object.create(Oo);n.value=e,t!==void 0&&(n.equal=t);let r=()=>f0(n);return r[se]=n,ko(n),[r,s=>jn(n,s),s=>rs(n,s)]}function f0(e){return cn(e),e.value}function jn(e,t){fc()||d0(e),e.equal(e.value,t)||(e.value=t,oE(e))}function rs(e,t){fc()||d0(e),jn(e,t(e.value))}var Oo=P(M({},an),{equal:Ro,value:void 0,kind:"signal"});function oE(e){e.version++,s0(),dc(e),rE?.(e)}var mc=P(M({},an),{consumerIsAlwaysLive:!0,consumerAllowSignalWrites:!0,dirty:!0,kind:"effect"});function yc(e){if(e.dirty=!1,e.version>0&&!Tr(e))return;e.version++;let t=Lt(e);try{e.cleanup(),e.fn()}finally{ln(e,t)}}function R(e){return typeof e=="function"}function Mr(e){let n=e(r=>{Error.call(r),r.stack=new Error().stack});return n.prototype=Object.create(Error.prototype),n.prototype.constructor=n,n}var os=Mr(e=>function(n){e(this),this.message=n?`${n.length} errors occurred during unsubscription:
${n.map((r,o)=>`${o+1}) ${r.toString()}`).join(`
  `)}`:"",this.name="UnsubscriptionError",this.errors=n});function Bn(e,t){if(e){let n=e.indexOf(t);0<=n&&e.splice(n,1)}}var ne=class e{constructor(t){this.initialTeardown=t,this.closed=!1,this._parentage=null,this._finalizers=null}unsubscribe(){let t;if(!this.closed){this.closed=!0;let{_parentage:n}=this;if(n)if(this._parentage=null,Array.isArray(n))for(let i of n)i.remove(this);else n.remove(this);let{initialTeardown:r}=this;if(R(r))try{r()}catch(i){t=i instanceof os?i.errors:[i]}let{_finalizers:o}=this;if(o){this._finalizers=null;for(let i of o)try{p0(i)}catch(s){t=t??[],s instanceof os?t=[...t,...s.errors]:t.push(s)}}if(t)throw new os(t)}}add(t){var n;if(t&&t!==this)if(this.closed)p0(t);else{if(t instanceof e){if(t.closed||t._hasParent(this))return;t._addParent(this)}(this._finalizers=(n=this._finalizers)!==null&&n!==void 0?n:[]).push(t)}}_hasParent(t){let{_parentage:n}=this;return n===t||Array.isArray(n)&&n.includes(t)}_addParent(t){let{_parentage:n}=this;this._parentage=Array.isArray(n)?(n.push(t),n):n?[n,t]:t}_removeParent(t){let{_parentage:n}=this;n===t?this._parentage=null:Array.isArray(n)&&Bn(n,t)}remove(t){let{_finalizers:n}=this;n&&Bn(n,t),t instanceof e&&t._removeParent(this)}};ne.EMPTY=(()=>{let e=new ne;return e.closed=!0,e})();var bc=ne.EMPTY;function is(e){return e instanceof ne||e&&"closed"in e&&R(e.remove)&&R(e.add)&&R(e.unsubscribe)}function p0(e){R(e)?e():e.unsubscribe()}var et={onUnhandledError:null,onStoppedNotification:null,Promise:void 0,useDeprecatedSynchronousErrorHandling:!1,useDeprecatedNextContext:!1};var Ar={setTimeout(e,t,...n){let{delegate:r}=Ar;return r?.setTimeout?r.setTimeout(e,t,...n):setTimeout(e,t,...n)},clearTimeout(e){let{delegate:t}=Ar;return(t?.clearTimeout||clearTimeout)(e)},delegate:void 0};function ss(e){Ar.setTimeout(()=>{let{onUnhandledError:t}=et;if(t)t(e);else throw e})}function jt(){}var h0=vc("C",void 0,void 0);function g0(e){return vc("E",void 0,e)}function m0(e){return vc("N",e,void 0)}function vc(e,t,n){return{kind:e,value:t,error:n}}var Vn=null;function Nr(e){if(et.useDeprecatedSynchronousErrorHandling){let t=!Vn;if(t&&(Vn={errorThrown:!1,error:null}),e(),t){let{errorThrown:n,error:r}=Vn;if(Vn=null,n)throw r}}else e()}function y0(e){et.useDeprecatedSynchronousErrorHandling&&Vn&&(Vn.errorThrown=!0,Vn.error=e)}var Hn=class extends ne{constructor(t){super(),this.isStopped=!1,t?(this.destination=t,is(t)&&t.add(this)):this.destination=uE}static create(t,n,r){return new tt(t,n,r)}next(t){this.isStopped?Ec(m0(t),this):this._next(t)}error(t){this.isStopped?Ec(g0(t),this):(this.isStopped=!0,this._error(t))}complete(){this.isStopped?Ec(h0,this):(this.isStopped=!0,this._complete())}unsubscribe(){this.closed||(this.isStopped=!0,super.unsubscribe(),this.destination=null)}_next(t){this.destination.next(t)}_error(t){try{this.destination.error(t)}finally{this.unsubscribe()}}_complete(){try{this.destination.complete()}finally{this.unsubscribe()}}},iE=Function.prototype.bind;function Dc(e,t){return iE.call(e,t)}var Cc=class{constructor(t){this.partialObserver=t}next(t){let{partialObserver:n}=this;if(n.next)try{n.next(t)}catch(r){us(r)}}error(t){let{partialObserver:n}=this;if(n.error)try{n.error(t)}catch(r){us(r)}else us(t)}complete(){let{partialObserver:t}=this;if(t.complete)try{t.complete()}catch(n){us(n)}}},tt=class extends Hn{constructor(t,n,r){super();let o;if(R(t)||!t)o={next:t??void 0,error:n??void 0,complete:r??void 0};else{let i;this&&et.useDeprecatedNextContext?(i=Object.create(t),i.unsubscribe=()=>this.unsubscribe(),o={next:t.next&&Dc(t.next,i),error:t.error&&Dc(t.error,i),complete:t.complete&&Dc(t.complete,i)}):o=t}this.destination=new Cc(o)}};function us(e){et.useDeprecatedSynchronousErrorHandling?y0(e):ss(e)}function sE(e){throw e}function Ec(e,t){let{onStoppedNotification:n}=et;n&&Ar.setTimeout(()=>n(e,t))}var uE={closed:!0,next:jt,error:sE,complete:jt};var kr=typeof Symbol=="function"&&Symbol.observable||"@@observable";function Te(e){return e}function aE(...e){return _c(e)}function _c(e){return e.length===0?Te:e.length===1?e[0]:function(n){return e.reduce((r,o)=>o(r),n)}}var B=(()=>{class e{constructor(n){n&&(this._subscribe=n)}lift(n){let r=new e;return r.source=this,r.operator=n,r}subscribe(n,r,o){let i=lE(n)?n:new tt(n,r,o);return Nr(()=>{let{operator:s,source:u}=this;i.add(s?s.call(i,u):u?this._subscribe(i):this._trySubscribe(i))}),i}_trySubscribe(n){try{return this._subscribe(n)}catch(r){n.error(r)}}forEach(n,r){return r=b0(r),new r((o,i)=>{let s=new tt({next:u=>{try{n(u)}catch(a){i(a),s.unsubscribe()}},error:i,complete:o});this.subscribe(s)})}_subscribe(n){var r;return(r=this.source)===null||r===void 0?void 0:r.subscribe(n)}[kr](){return this}pipe(...n){return _c(n)(this)}toPromise(n){return n=b0(n),new n((r,o)=>{let i;this.subscribe(s=>i=s,s=>o(s),()=>r(i))})}}return e.create=t=>new e(t),e})();function b0(e){var t;return(t=e??et.Promise)!==null&&t!==void 0?t:Promise}function cE(e){return e&&R(e.next)&&R(e.error)&&R(e.complete)}function lE(e){return e&&e instanceof Hn||cE(e)&&is(e)}function wc(e){return R(e?.lift)}function j(e){return t=>{if(wc(t))return t.lift(function(n){try{return e(n,this)}catch(r){this.error(r)}});throw new TypeError("Unable to lift unknown Observable type")}}function F(e,t,n,r,o){return new xc(e,t,n,r,o)}var xc=class extends Hn{co
```

### Core Architecture Module: `dev/browser/chunk-GGOEHXD2.js`
```
import{$a as s,Bb as r,Ca as m,Cb as u,Cc as n,Ib as d,Kb as c,Pa as l,Yb as v,Zb as o,_b as g,ac as f,eb as p,pd as b,wc as h}from"./chunk-EN473UE3.js";import"./chunk-W7GRJBO5.js";var M=["a2ui-slider",""],E=(()=>{class a extends b{value=n.required();label=n("");minValue=n.required();maxValue=n.required();inputId=super.getUniqueId("a2ui-slider");resolvedValue=h(()=>super.resolvePrimitive(this.value())??0);handleInput(t){let i=this.value()?.path;!(t.target instanceof HTMLInputElement)||!i||this.processor.setData(this.component(),i,t.target.valueAsNumber,this.surfaceId())}static \u0275fac=(()=>{let t;return function(e){return(t||(t=m(a)))(e||a)}})();static \u0275cmp=s({type:a,selectors:[["","a2ui-slider",""]],inputs:{value:[1,"value"],label:[1,"label"],minValue:[1,"minValue"],maxValue:[1,"maxValue"]},features:[p],attrs:M,decls:4,vars:14,consts:[[3,"for"],["autocomplete","off","type","range",3,"input","value","min","max","id"]],template:function(i,e){i&1&&(r(0,"section")(1,"label",0),g(2),u(),r(3,"input",1),c("input",function(y){return e.handleInput(y)}),u()()),i&2&&(o(e.theme.components.Slider.container),l(),o(e.theme.components.Slider.label),d("htmlFor",e.inputId),l(),f(" ",e.label()," "),l(),v(e.theme.additionalStyles==null?null:e.theme.additionalStyles.Slider),o(e.theme.components.Slider.element),d("value",e.resolvedValue())("min",e.minValue())("max",e.maxValue())("id",e.inputId))},styles:["[_nghost-%COMP%]{display:block;flex:var(--weight)}input[_ngcontent-%COMP%]{display:block;width:100%;box-sizing:border-box}"]})}return a})();export{E as Slider};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1357** (2026-07-21): **Live (BIDI) connection drops all but the last parallel function call**
  *Symptoms*: When a Gemini live session returns multiple function calls in a single `toolCall` message, ADK executes only the last one; the earlier parallel calls are silently dropped, produce no tool response, and leave the session in a mismatched state.  **Please make sure you read the contribution guide and file the issues in the right place.** [Contribution guide.](https://google.github.io/adk-docs/contributing-guide/)  ## 🔴 Required Information  **Describe the Bug:** On the live/BIDI path (`Runner.runLive` + `LiveRequestQueue`), when the Gemini Live API emits a single `BidiGenerateContentToolCall` message containing **multiple** function calls (parallel tool calling), only the **last** call is executed. In `GeminiLlmConnection.createToolCallResponse`, the response `Content` is rebuilt **inside** the loop over the calls, so each iteration overwrites the previous one and only the final `FunctionCall` survives:  ```java // GeminiLlmConnection.createToolCallResponse (before) toolCall     .functionCalls()     .ifPresent(         calls -> {           for (FunctionCall call : calls) {             builder.content(                                   // overwrites every iteration                 Content.builder()                     .parts(ImmutableList.of(Part.builder().functionCall(call).build()))                     .build());                                 // and no role is set           }         }); ```  Two problems follow: 1. All parallel calls except the last are discarded before the
  **Post-Mortem & Fix Analysis**:
  > Hi @svetanis, Thanks for reporting this issue and and We appreciate you taking the time to submit this pull request. am able to reproduce this behavior which you described. Currently this Issue and PR are under review by our team, we will keep you update if any additional information is required. thank you.  

- **Issue #922** (2026-03-02): **Can loop agent nested another loop agent?**
  *Symptoms*: I write a loop agent "outer" which has a inner loop agent "inner" as it's sub agent.  inner agent has a exit loop sub agent who will invoke ExitLoopTool.INSTANCE. outer agent has nother exit loop sub agent who will invoke ExitLoopTool.INSTANCE.  when I test this agent, I found when inner loop agent exit loop ,will caus outer loop exit too!  I am not sure it's bug or we do not support nested loop agent 
  **Post-Mortem & Fix Analysis**:
  > Hi @tomgor, Thank you for reporting this issue,   In the current SDK, `ExitLoopTool.INSTANCE` functions as a global termination signal. Therefore, when the inner agent uses it, the outer loop also terminates. To enable independent inner loop exits, i will suggest  create a custom tool for the inner agent that throws a specific exception like `InnerLoopBreakException`. then wrap your inner `LoopAgent` in a proxy that catches this exception, returning a successful `AgentResponse`. This approach allows the outer loop to treat the inner loop's exit as a completed task, enabling the outer agent to continue.
  > Thanks for reply, I wrote my own LoopAgent to implement custom exit event checks.

- **Issue #903** (2026-03-27): **`ParallelAgent` executes sub-agents sequentially instead of concurrently**
  *Symptoms*: **The Bug** Despite its name, `ParallelAgent` executes its sub-agents sequentially on a single thread rather than in parallel. This defeats the purpose of using a parallel agent, as total execution time equals the sum of all individual agent execution times rather than the longest single execution time.  **To Reproduce**  1. Configure a `ParallelAgent` with multiple sub-agents. 2. Trigger the agent execution using `Runner.runAsync(...)` and subscribe to the resulting `Flowable`. 3. Observe the logs or execution times: the sub-agents process their requests one after the other, not simultaneously.  **Root Cause Analysis** The bug is located in `ParallelAgent.java` inside the `runAsyncImpl` method.  * The method maps over `currentSubAgents` and calls `runAsync` on each to create a list of `Flowable<Event>` streams. * It then passes this list directly into `Flowable.merge(...)`. * Because it does not explicitly apply a concurrent scheduler (such as `.subscribeOn(Schedulers.io())`) to the individual sub-agent flows before merging them, RxJava defaults to executing the merged "cold" streams sequentially on the caller's thread.  **Expected behavior** `ParallelAgent` should internally handle thread scheduling for its sub-agents (e.g., dispatching them to an I/O thread pool before the merge step) so that `Flowable.merge()` can actually process their streams concurrently.
  **Post-Mortem & Fix Analysis**:
  > Hi @fedorovychh, Thank you for reporting this issue,   I’ve verified this issue in the latest ADK (v0.6.0). By default, `ParallelAgent` executes sub-agents sequentially on the subscribing thread because `runAsync()` returns cold RxJava Flowables and no scheduler is applied. To enable true parallel execution, each sub-agent should be wrapped with `subscribeOn(Schedulers.io())` before merging. With this change, sub-agents run concurrently on separate threads, and total execution time becomes equal to the longest sub-agent instead of the sum. I recommend updating `ParallelAgent` to apply this scheduler by default to match the intended parallel semantics.
  > related: https://github.com/google/adk-java/issues/559
  > Should now be fixed via #1077 Thanks for reporting this!

- **Issue #871** (2026-03-31): **Missing Id generation for Event**
  *Symptoms*: **Describe the Bug:**  Events generated for tool confirmation requests (adk_request_confirmation) are being created with null IDs. This occurs when tools require user confirmation before execution. The root cause is that Functions.generateRequestConfirmationEvent() creates events without calling .id(Event.generateEventId()), resulting in events being persisted to session storage with id: null.  **Steps to Reproduce:**  1. Configure an agent with a tool that requires confirmation (e.g., using ConfirmationTool) 2. Run the agent and trigger the tool that requires confirmation 3. Inspect the generated event in the session 4. Observe that the event has "id": null  **Expected Behavior:** All events should have a unique, non-null ID generated via Event.generateEventId().  **Observed Behavior:** Event object is being created with "null" id   **Environment Details:**  - ADK Library Version: 0.5.0 (current main branch) - OS: All platforms (Java-based issue) - Java Version: N/A (code issue)  **Model Information:**   - Model agnostic ---  **Minimal Reproduction Code:** https://github.com/google/adk-java/blob/main/core/src/main/java/com/google/adk/flows/llmflows/Functions.java method - generateRequestConfirmationEvent   ``` return Optional.of(         Event.builder()                                                             //missing id             .invocationId(invocationContext.invocationId())             .author(invocationContext.agent().name())             .branch(invocationContext.
  **Post-Mortem & Fix Analysis**:
  > permalink to code snipped https://github.com/google/adk-java/blob/4ac1dd2b6e480fefd4b0a9198b2e69a9c6334c40/core/src/main/java/com/google/adk/flows/llmflows/Functions.java#L687
  > Hi @aditya-kuna, Thank you for the detailed bug report and the reproduction steps, I have successfully reproduced the issue on my end with your instructions. The issue occurs when a tool is configured with `requiresConfirmation(true)` because the ADK framework creates a local `adk_request_confirmation` event, but the internal builder fails to assign ID before emitting it to the stream. To fix this, `Event.builder()` in `Functions.generateRequestConfirmationEvent()` must be updated to explicitly generate and attach the ID to these confirmation events before they are dispatched.
  > Hi @tilgalas, Please have a look into it once.

- **Issue #835** (2026-03-19): **ISSUE-777: Ensure token usage metadata included with streaming responses**
  *Symptoms*: This addresses two issues/inconsistencies between the adk-java and adk-python.   1. The adk-java was filtering out LlmResponses with blank text messages (`p.text().map(t -> !t.isBlank()).orElse(false)`). This prevents empty stop messages from being included, however these messages also contain the usage metadata and therefore must be included.   For example, using the adk-python quickstart sample agent with the following prompt: `POST http://localhost:8000/run_sse` ```json {   "appName": "quickstart",   "userId": "user",   "sessionId": "72fb8533-c444-4eed-abb3-c8e8677e1a15",   "newMessage": {     "role": "user",     "parts": [       {         "text": "Repeat the following - Hello"       }     ]   },   "streaming": true,   "stateDelta": null } ``` yields the response events (notice the events with an empty string text part) -  ```json [{   "modelVersion": "gemini-2.0-flash",   "content": {     "parts": [       {         "text": "Hello\n"       }     ],     "role": "model"   },   "partial": true,   "usageMetadata": {     "trafficType": "ON_DEMAND"   },   ... }, {   "modelVersion": "gemini-2.0-flash",   "content": {     "parts": [       {         "text": ""       }     ],     "role": "model"   },   "partial": true,   "finishReason": "STOP",   "usageMetadata": {     "candidatesTokenCount": 2,     "candidatesTokensDetails": [       {         "modality": "TEXT",         "tokenCount": 2       }     ],     "promptTokenCount
  **Post-Mortem & Fix Analysis**:
  > ## Summary of Changes  Hello @OwenDavisBC, I'm Gemini Code Assist[^1]! I'm currently reviewing this pull request and will post my feedback shortly. In the meantime, here's a summary to help you and other reviewers quickly get up to speed!  This pull request resolves inconsistencies between the `adk-java` and `adk-python` libraries regarding the handling of LLM streaming responses. Specifically, it ensures that `adk-java` no longer filters out `LlmResponses` with empty text content, which are critical for conveying usage metadata, and that usage metadata is consistently included in all partial and full text responses. These changes improve the accuracy and completeness of response data provided by the Java SDK.  ### Highlights  * **Inclusion of Usage Metadata in Streaming Responses**: The `adk-java` library now correctly includes usage metadata in streaming `LlmResponses`, aligning its behavior with `adk-python`. * **Handling of Empty Text Messages**: The filtering logic for `LlmRespons
  > Hi, I have a fix locally for this issue.  I took a bit different approach.  I believe this approach will append the usage metrics for partially completed stream.  I believe this may duplicate the token counts in multiple responses, which I believe may be incorrect.    I am not yet familiar with this codebase, but according to AI the best approach is the following:  Problem: During streaming, usageMetadata (token counts) was silently dropped from LlmResponse. This happened for two reasons:  1. processRawResponses builds final accumulated text responses using responseFromText(), which constructs new LlmResponse objects without carrying over usageMetadata from the raw API response — even though the last chunk (with STOP finish reason) typically contains it.  2. The .filter() in generateContent() discarded any LlmResponse lacking text/function content, so even if a usage-only response made it through, it would be filtered out before reaching downstream consumers. Fix: Two targete
  > In case this is helpful for context, here is the full AI evaluation:    ### The Problem  During streaming, the Gemini API sends `usageMetadata` (token counts like prompt tokens, candidate tokens, total tokens) typically on the **last chunk** of a streamed response -- often the same chunk that carries the `STOP` finish reason. The original code was losing this data in two places.  ### Analysis of the Two Changes  #### Change 1: Filter modification in `generateContent()` (lines 231-247)  ```229:247:core/src/main/java/com/google/adk/models/Gemini.java                   processRawResponses(                       Flowable.fromFuture(streamFuture).flatMapIterable(iterable -> iterable)))           .filter(               llmResponse ->                   llmResponse.usageMetadata().isPresent()                       || llmResponse                           .content()                           .flatMap(Content::parts)                           .map(                          

- **Issue #797** (2026-03-18): **Bug Report: Metadata Key Mismatch (Prefix adk_ Inconsistency between Python&Java) on A2A & genai Part convertion**
  *Symptoms*: Describe the bug There is a critical metadata key mismatch between the Python and Java implementations of the ADK A2A  conversion for GenAI parts.  In Python, the type metadata key is generated using _get_adk_metadata_key('type'), which prepends an adk_ prefix (resulting in "adk_type"). In Java, the library attempts to read the metadata using constants like PartConverter.A2A_DATA_PART_METADATA_TYPE_KEY, which does not include the adk_ prefix (it is just "type"). This prevents the Java side from correctly identifying types  like function_call    Python Side: Convert a GenAI function call part to A2A. python  Inside convert_genai_part_to_a2a_part  Python generates: {"adk_type": "function_call"} a2a_part.metadata = {_get_adk_metadata_key('type'): 'function_call'} Java Side: The ADK tries to extract the author. java // In com.google.adk.a2a.extractAuthorFromMetadata Map<String, Object> metadata = dataPart.getMetadata();  // PartConverter.A2A_DATA_PART_METADATA_TYPE_KEY is "type" // Result is empty because the actual key in the map is "adk_type" String type = metadata.getOrDefault(PartConverter.A2A_DATA_PART_METADATA_TYPE_KEY, "").toString();  Expected behavior The metadata keys should be identical across all SDKs. If Python uses adk_type, then Java's PartConverter.A2A_DATA_PART_METADATA_TYPE_KEY should also be adk_type,  or check both value to Compatible with old verion。  OS: All Java version: 17+ ADK version: 0.4.0
  **Post-Mortem & Fix Analysis**:
  > Hi @bleastrind, Thank you for raising this issue and for providing clear description of the disconnect between the Python and Java SDKs.  able to reproduce and observed that the Java agents are currently dropping executions because they cannot deserialize `Part` objects sent by non-java agents over the A2A protocol. This failure stems from a metadata key inconsistency. the Python SDK sends the classification using a namespaced `adk_type` key to prevent collisions, whereas the Java SDK's `PartConverter` is hardcoded to exclusively look for the `type` key. Consequently, the Java receiver reads an empty string for the part type and discards the payload.  To fix this, we need to implement a dual-check fallback mechanism to bridge this gap while maintaining backward compatibility with older Java-to-Java A2A communications. ``` // Check for the standard 'adk_type' first, then fallback to legacy 'type' String extractedType = metadata.getOrDefault("adk_type", "type", "").toString(); ```
  > Hi @tilgalas, Please have a look into it once.
  > Hello @bleastrind! There were some changes to the A2A implementation recently, now these metadata keys were moved to the https://github.com/google/adk-java/blob/main/a2a/src/main/java/com/google/adk/a2a/converters/A2AMetadataKey.java, with `adk_` prefix 

- **Issue #777** (2026-03-20): **Gemini Model not returning Usage Metadata in Streaming responses**
  *Symptoms*: ** Please make sure you read the contribution guide and file the issues in the rigth place. ** [Contribution guide.](https://google.github.io/adk-docs/contributing-guide/)  **Describe the bug** When using streaming mode, the Gemini Model does not return the `usageMetadata` in the `LlmResponse`. When `stream=true` the usageMetadata should return in the final aggregated response.   **To Reproduce** Steps to reproduce the behavior: 1. Create an `LlmAgent` with the `Gemini` model.  2. In the `RunConfig` set the streaming model to `RunConfig.StreamingMode.SSE` 3. observe the `LlmResponse` in `afterModelCallback` of a plugin or agent.  4. See that both for partial and final LLM responses, `usageMetadata` is `Optional.Empty`  **Expected behavior** The final and non-partial LlmResponse should include the `usageMetadata`.    **Desktop (please complete the following information):**  - OS: MacOS  - Java version:  - ADK version(see maven dependency): 0.5.0  **Additional context** The python version of ADK returns the usageMetadata correctly.  The usageMetadata is returned from the Gemini API in the last chunk. 
  **Post-Mortem & Fix Analysis**:
  > Hi @chaskyhoffmann,  Thanks for reporting this issue. I’ve tried to reproduce it locally using the latest version of the Java ADK and a live-enabled model, but I’m unable to see the behavior you described. I noticed you are using afterModelCallback(). Could you please share a minimal reproducible example showing how you’re using it, along with your agent, model configuration. And also, could you help me understand the frequency of this issue?  Having this information will allow us to reproduce the issue accurately and provide guidance.  
  > Hi @hemasekhar-p   Here is a minimal program that reproduces this issue. It is complete with our Agent & Model configurations.  ``` java import com.google.adk.agents.CallbackContext; import com.google.adk.agents.LlmAgent; import com.google.adk.agents.RunConfig; import com.google.adk.events.Event; import com.google.adk.models.Gemini; import com.google.adk.models.LlmResponse; import com.google.adk.plugins.BasePlugin; import com.google.adk.runner.InMemoryRunner; import com.google.adk.runner.Runner; import com.google.genai.Client; import com.google.genai.types.Content; import com.google.genai.types.GenerateContentResponseUsageMetadata; import com.google.genai.types.Part; import io.reactivex.rxjava3.core.Flowable; import io.reactivex.rxjava3.core.Maybe;  import java.util.List; import java.util.Map; import java.util.concurrent.atomic.AtomicInteger;  /**  * Minimal reproduction case for ADK Java issue #777:  * usageMetadata is not populated when streaming is enabled  *  * Expected: usageMetad
  > @chaskyhoffmann, thank you for sharing the required information. We will  reproduce and investigate on this.

- **Issue #699** (2026-03-25): **[spring-ai] NullPointerException in ToolConverter when ADK tool uses ToolContext**
  *Symptoms*: ** Please make sure you read the contribution guide and file the issues in the rigth place. ** [Contribution guide.](https://google.github.io/adk-docs/contributing-guide/)  **Describe the bug** In `com.google.adk.models.springai.ToolConverter#convertToSpringAiTools`, when converting ADK BaseTool instances to Spring AI ToolCallback, the `toolContext` parameter passed to `tool.runAsync(...)` is hardcoded as null. This causes a NullPointerException if the underlying ADK tool method expects and uses a non-null ToolContext (e.g., to access functionCallId()).  **To Reproduce** Steps to reproduce the behavior: 1. Define an ADK tool method that includes a `ToolContext` parameter.   2. Use `ToolConverter` to convert this tool into a Spring AI `ToolCallback`.   3. Invoke the resulting `ToolCallback.call(...)` with a valid `org.springframework.ai.chat.model.ToolContext`.   4. Observe a `NullPointerException` because the ADK tool receives `null` for its `ToolContext` argument.  test case: ```java @Test void testCallbackWithToolContext() throws Exception {   ToolConverter converter = new ToolConverter();   FunctionTool tool = FunctionTool.create(TestSayHelloFunctions.class, "sayHello");   Map<String, BaseTool> tools = Map.of("sayHello", tool);    List<ToolCallback> toolCallbacks = converter.convertToSpringAiTools(tools);   ToolCallback callback = toolCallbacks.get(0);   String res = callback.call("{\"name\":\"Jack\"}", new org.springframework.ai.chat.model.ToolContext(new HashMap<>()));  
  **Post-Mortem & Fix Analysis**:
  > Hi! I'd like to work on this issue I contribute to CNCF and Spring projects and can fix the NullPointerException by properly mapping Spring AI's ToolContext to ADK's ToolContext in the ToolConverter.  
  > +1 </br> I am observing the same issue. please provide a fix, thanks
  > cc @ddobrin 

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

### Incident Patch 1: `f8668045` (2026-10-05)
**Commit Message**: fix: run approved tool confirmations for agents under a ParallelAgent

PiperOrigin-RevId: 993677550

**File**: `core/src/main/java/com/google/adk/runner/Runner.java` (modified, +76/-19)
```diff
@@ -27,7 +27,6 @@
 import com.google.adk.agents.InvocationContext;
 import com.google.adk.agents.LiveRequestQueue;
 import com.google.adk.agents.LlmAgent;
-import com.google.adk.agents.ParallelAgent;
 import com.google.adk.agents.Role;
 import com.google.adk.agents.RunConfig;
 import com.google.adk.agents.SequentialAgent;
@@ -416,13 +415,14 @@ private Single<Event> createUserMessageEvent(
       InvocationContext invocationContext,
       boolean saveInputBlobsAsArtifacts,
       @Nullable Map<String, Object> stateDelta) {
+    // As on the resumable path, a function response takes the branch of the call it answers.
     return appendNewMessageToSession(
         session,
         newMessage,
         invocationContext,
         saveInputBlobsAsArtifacts,
         stateDelta,
-        /* branch= */ null);
+        matchingFunctionCallEvent(session, newMessage).flatMap(Event::branch).orElse(null));
   }
 
   private Single<Event> appendNewMessageToSession(
@@ -768,12 +768,14 @@ private Flowable<Event> runAgentForUserEvent(
    */
   private Flowable<Event> runAgentWithUpdatedSession(
       InvocationContext initialContext, Session updatedSession, Event event, BaseAgent rootAgent) {
+    BaseAgent agentToRun = this.findAgentToRun(updatedSession, rootAgent);
     // Create context with updated session for beforeRunCallback
     InvocationContext contextWithUpdatedSession =
         initialContext.toBuilder()
             .session(updatedSession)
-            .agent(this.findAgentToRun(updatedSession, rootAgent))
+            .agent(agentToRun)
             .userContent(event.content().orElseGet(Content::fromParts))
+            .branch(routedAgentParentBranch(updatedSession, agentToRun, rootAgent))
             .build();
 
     // If beforeRunCallback returns content, emit it and skip agent.
@@ -1055,26 +1057,79 @@ private Flowable<Event> runResumedAgent(
   }
 
   /**
-   * Branch to seed a resumed context with so {@code resumeAgent} runs under the same branch it
-   * originally did. Returns the parent branch (the resolved agent's most recent event branch minus
-   * its own trailing name segment, which {@link BaseAgent#runAsync} re-appends), or {@code null}
-   * for the root branch. Non-null only for an agent nested under a {@link ParallelAgent}.
+   * Branch to seed a new invocation with so a routed sub-agent runs where it ran before, or {@code
+   * null} when {@code agentToRun} is the root. A function response restores the branch of the call
+   * it answers, since a Java agent's branch depends on the transfer path that reached it; other
+   * routing restores the agent's latest branch, as Python does.
+   */
+  private static @Nullable String routedAgentParentBranch(
+      Session session, BaseAgent agentToRun, BaseAgent rootAgent) {
+    if (agentToRun.equals(rootAgent)) {
+      return null;
+    }
+    Optional<Event> answeredCall =
+        Functions.findMatchingFunctionCallEvent(session.immutableEvents());
+    if (answeredCall.isPresent()) {
+      String ownSuffix = sequentialBranchSuffix(agentToRun, answeredCall.get().author());
+      if (ownSuffix != null) {
+        return parentBranch(answeredCall.get().branch().orElse(null), ownSuffix);
+      }
+    }
+    return resumeParentBranch(session, /* invocationId= */ null, agentToRun);
+  }
+
+  /**
+   * Branch to seed a context with so {@code resumeAgent} runs under the branch it last ran on: the
+   * parent branch of the newest event by {@code resumeAgent}, or by an agent it reaches through
+   * SequentialAgents, with a non-empty branch. A non-null {@code invocationId} limits the search to
+   * that invocation; {@code null} is returned for the root branch.
    */
   private static @Nullable String resumeParentBranch(
-      Session session, String invocationId, BaseAgent resumeAgent) {
+      Session session, @Nullable String invocationId, BaseAgent resumeAgent) {
     ImmutableList<Event> events = session.immutableEvents();
     for (int i = events.size() - 1; i >= 0; i--) {
       Event event = events.get(i);
-      if (invocationId.equals(event.invocationId())
-          && resumeAgent.name().equals(event.author())
-          && event.branch().isPresent()) {
-        String branch = event.branch().get();
-        String ownSegment = "." + resumeAgent.name();
-        if (branch.endsWith(ownSegment)) {
-          String parent = branch.substring(0, branch.length() - ownSegment.length());
-          return parent.isEmpty() ? null : parent;
+      if ((invocationId == null || invocationId.equals(event.invocationId()))
+          && event.branch().filter(branch -> !branch.isEmpty()).isPresent()) {
+        String ownSuffix = sequentialBranchSuffix(resumeAgent, event.author());
+        if (ownSuffix != null) {
+          return parentBranch(event.branch().get(), ownSuffix);
+        }
+      }
+    }
+    return null;
+  }
+
+  /**
+   * Returns {@code branch} minus the trailing {@code ownSuffix} that {@link BaseAgent#runAsync}
+   * re-a
```

**File**: `core/src/test/java/com/google/adk/runner/RunnerLegacyResumabilityTest.java` (modified, +84/-0)
```diff
@@ -17,10 +17,14 @@
 package com.google.adk.runner;
 
 import static com.google.adk.testing.ResumabilityTestUtils.answerCall;
+import static com.google.adk.testing.ResumabilityTestUtils.approveConfirmation;
+import static com.google.adk.testing.ResumabilityTestUtils.confirmingEchoFunctionTool;
 import static com.google.adk.testing.ResumabilityTestUtils.newSession;
 import static com.google.adk.testing.ResumabilityTestUtils.pendingFunctionTool;
 import static com.google.adk.testing.ResumabilityTestUtils.runTurn;
+import static com.google.adk.testing.ResumabilityTestUtils.runTurnAskingConfirmation;
 import static com.google.adk.testing.ResumabilityTestUtils.shimRunner;
+import static com.google.adk.testing.ResumabilityTestUtils.textAgent;
 import static com.google.adk.testing.TestUtils.createFunctionCallLlmResponse;
 import static com.google.adk.testing.TestUtils.createLlmResponse;
 import static com.google.adk.testing.TestUtils.createTestAgentBuilder;
@@ -475,6 +479,86 @@ public void runAsync_plainTextWithShim_withStateDelta_mergesStateIntoSession() {
     assertThat(finalSession.state()).containsAtLeastEntriesIn(stateDelta);
   }
 
+  // The shim resumes the SequentialAgent, which has no events of its own to restore a branch from.
+  @Test
+  public void
+      runAsync_withToolConfirmation_inSequentialAgentUnderParallelAgent_callsTool_legacyShim() {
+    LlmAgent childAgent =
+        createTestAgentBuilder(
+                createTestLlm(
+                    createFunctionCallLlmResponse(
+                        "tool_call_id", "echoTool", ImmutableMap.of("message", "hello")),
+                    createTextLlmResponse("Response after user confirmed.")))
+            .name("child_agent")
+            .tools(confirmingEchoFunctionTool())
+            .build();
+    SequentialAgent sequentialAgent =
+        SequentialAgent.builder()
+            .name("sequential_agent")
+            .subAgents(ImmutableList.of(childAgent))
+            .build();
+    ParallelAgent rootAgent =
+        ParallelAgent.builder()
+            .name("parallel_agent")
+            .subAgents(
+                ImmutableList.of(sequentialAgent, textAgent("sibling_agent", "Sibling done.")))
+            .build();
+    Runner runner = shimRunner(rootAgent);
+    Session session = newSession(runner);
+    FunctionCall askUserConfirmationFunctionCall =
+        runTurnAskingConfirmation(runner, session, "from user");
+
+    ImmutableList<Event> eventsAfterConfirmation =
+        approveConfirmation(runner, session, askUserConfirmationFunctionCall);
+
+    assertThat(simplifyEvents(eventsAfterConfirmation))
+        .containsExactly(
+            "child_agent: FunctionResponse(name=echoTool, response={message=hello})",
+            "child_agent: Response after user confirmed.")
+        .inOrder();
+    assertThat(eventsAfterConfirmation.stream().map(event -> event.branch().orElse(null)))
+        .containsExactly(
+            "parallel_agent.sequential_agent.child_agent",
+            "parallel_agent.sequential_agent.child_agent");
+  }
+
+  // Answering a long-running call resumes the sequence; its later sub-agent must still run.
+  @Test
+  public void
+      runAsync_withLongRunningCall_inSequentialAgentUnderParallelAgent_runsNextAgent_legacyShim() {
+    LlmAgent childAgent =
+        createTestAgentBuilder(
+                createTestLlm(
+                    createFunctionCallLlmResponse(
+                        "lro_call_id", "pendingTool", ImmutableMap.of("message", "draft")),
+                    createTextLlmResponse("child resumed")))
+            .name("child_agent")
+            .tools(pendingFunctionTool())
+            .build();
+    SequentialAgent sequentialAgent =
+        SequentialAgent.builder()
+            .name("sequential_agent")
+            .subAgents(ImmutableList.of(childAgent, textAgent("next_agent", "next done")))
+            .build();
+    ParallelAgent rootAgent =
+        ParallelAgent.builder()
+            .name("parallel_agent")
+            .subAgents(
+                ImmutableList.of(sequentialAgent, textAgent("sibling_agent", "Sibling done.")))
+            .build();
+    Runner runner = shimRunner(rootAgent);
+    Session session = newSession(runner);
+    var unused = runTurn(runner, session, "from user");
+
+    ImmutableList<Event> eventsAfterResume =
+        answerCall(
+            runner, session, "lro_call_id", "pendingTool", ImmutableMap.of("result", "done"));
+
+    assertThat(simplifyEvents(eventsAfterResume))
+        .containsExactly("child_agent: child resumed", "next_agent: next done")
+        .inOrder();
+  }
+
   // ===== CL1-parity: every CL1 resumable(true) test, re-run under the text-only shim =====
 
   @Test
```

**File**: `core/src/test/java/com/google/adk/runner/RunnerTest.java` (modified, +207/-0)
```diff
@@ -16,6 +16,14 @@
 
 package com.google.adk.runner;
 
+import static com.google.adk.testing.ResumabilityTestUtils.approveConfirmation;
+import static com.google.adk.testing.ResumabilityTestUtils.confirmingEchoFunctionTool;
+import static com.google.adk.testing.ResumabilityTestUtils.functionResponseContent;
+import static com.google.adk.testing.ResumabilityTestUtils.newSession;
+import static com.google.adk.testing.ResumabilityTestUtils.reloadSession;
+import static com.google.adk.testing.ResumabilityTestUtils.runTurn;
+import static com.google.adk.testing.ResumabilityTestUtils.runTurnAskingConfirmation;
+import static com.google.adk.testing.ResumabilityTestUtils.textAgent;
 import static com.google.adk.testing.TestUtils.createEvent;
 import static com.google.adk.testing.TestUtils.createFunctionCallLlmResponse;
 import static com.google.adk.testing.TestUtils.createLlmResponse;
@@ -2473,6 +2481,205 @@ public void runAsync_withToolConfirmation_inSequentialAgentSubAgent_resumesSubAg
         .inOrder();
   }
 
+  // The approval's new invocation must run the child on its parallel branch, where its request is.
+  @Test
+  public void runAsync_withToolConfirmation_inParallelAgentSubAgent_callsOriginalFunction() {
+    TestLlm childTestLlm =
+        createTestLlm(
+            createFunctionCallLlmResponse(
+                "tool_call_id", "echoTool", ImmutableMap.of("message", "hello")),
+            createTextLlmResponse("Response after observing tool needs confirmation."),
+            createTextLlmResponse("Response after user confirmed."));
+    LlmAgent childAgent =
+        createTestAgentBuilder(childTestLlm)
+            .name("child_agent")
+            .tools(confirmingEchoFunctionTool())
+            .build();
+    ParallelAgent rootAgent =
+        ParallelAgent.builder()
+            .name("parallel_agent")
+            .subAgents(ImmutableList.of(childAgent, textAgent("sibling_agent", "Sibling done.")))
+            .build();
+
+    ImmutableList<Event> eventsAfterConfirmation = approveToolConfirmation(rootAgent, "from user");
+
+    assertThat(simplifyEvents(eventsAfterConfirmation))
+        .containsExactly(
+            "child_agent: FunctionResponse(name=echoTool, response={message=hello})",
+            "child_agent: Response after user confirmed.")
+        .inOrder();
+    assertThat(eventsAfterConfirmation.stream().map(event -> event.branch().orElse(null)))
+        .containsExactly("parallel_agent.child_agent", "parallel_agent.child_agent");
+    // As on the first turn, the sibling branch stays out of the child's prompt.
+    assertThat(childTestLlm.getLastRequest().contents().stream().map(TestUtils::formatContent))
+        .containsExactly(
+            "from user",
+            "FunctionCall(name=echoTool, args={message=hello})",
+            "FunctionResponse(name=echoTool, response={message=hello})")
+        .inOrder();
+  }
+
+  // A SequentialAgent between the ParallelAgent and the child makes the restored branch deeper.
+  @Test
+  public void runAsync_withToolConfirmation_inNestedParallelBranch_callsOriginalFunction() {
+    LlmAgent childAgent =
+        createTestAgentBuilder(
+                createTestLlm(
+                    createFunctionCallLlmResponse(
+                        "tool_call_id", "echoTool", ImmutableMap.of("message", "hello")),
+                    createTextLlmResponse("Response after observing tool needs confirmation."),
+                    createTextLlmResponse("Response after user confirmed.")))
+            .name("child_agent")
+            .tools(confirmingEchoFunctionTool())
+            .build();
+    SequentialAgent sequentialAgent =
+        SequentialAgent.builder()
+            .name("sequential_agent")
+            .subAgents(ImmutableList.of(childAgent))
+            .build();
+    ParallelAgent rootAgent =
+        ParallelAgent.builder()
+            .name("parallel_agent")
+            .subAgents(
+                ImmutableList.of(sequentialAgent, textAgent("sibling_agent", "Sibling done.")))
+            .build();
+
+    ImmutableList<Event> eventsAfterConfirmation = approveToolConfirmation(rootAgent, "from user");
+
+    assertThat(simplifyEvents(eventsAfterConfirmation))
+        .containsExactly(
+            "child_agent: FunctionResponse(name=echoTool, response={message=hello})",
+            "child_agent: Response after user confirmed.")
+        .inOrder();
+    assertThat(eventsAfterConfirmation.stream().map(event -> event.branch().orElse(null)))
+        .containsExactly(
+            "parallel_agent.sequential_agent.child_agent",
+            "parallel_agent.sequential_agent.child_agent");
+  }
+
+  // The approval must restore the branch of the call it answers, not the agent's latest branch.
+  @Test
+  public void runAsync_withToolConfirmation_afterAgentRanOnAnotherBranch_callsOriginalFunction() {
+    LlmAgent agentB =
+        createTestAgentBuilder(
+                createTestLlm(
+                    createFunctionCallL
```

**File**: `core/src/test/java/com/google/adk/testing/ResumabilityTestUtils.java` (modified, +22/-0)
```diff
@@ -21,6 +21,7 @@
 import static com.google.adk.testing.TestUtils.createTextLlmResponse;
 import static com.google.adk.testing.TestUtils.simplifyResumableEvents;
 import static com.google.common.collect.ImmutableList.toImmutableList;
+import static com.google.common.collect.MoreCollectors.onlyElement;
 import static com.google.common.truth.Truth.assertThat;
 import static com.google.common.truth.Truth.assertWithMessage;
 import static java.util.Arrays.stream;
@@ -31,6 +32,7 @@
 import com.google.adk.apps.App;
 import com.google.adk.apps.ResumabilityConfig;
 import com.google.adk.events.Event;
+import com.google.adk.flows.llmflows.Functions;
 import com.google.adk.models.LlmResponse;
 import com.google.adk.plugins.BasePlugin;
 import com.google.adk.runner.Runner;
@@ -181,6 +183,26 @@ public static ImmutableList<Event> answerCall(
             .blockingGet());
   }
 
+  /** Runs one plain-text turn and returns the single tool confirmation it asks for. */
+  public static FunctionCall runTurnAskingConfirmation(
+      Runner runner, Session session, String text) {
+    return runTurn(runner, session, text).stream()
+        .flatMap(event -> Functions.getAskUserConfirmationFunctionCalls(event).stream())
+        .collect(onlyElement());
+  }
+
+  /** Approves {@code confirmationCall}, a tool confirmation an earlier turn asked for. */
+  @CanIgnoreReturnValue
+  public static ImmutableList<Event> approveConfirmation(
+      Runner runner, Session session, FunctionCall confirmationCall) {
+    return answerCall(
+        runner,
+        session,
+        confirmationCall.id().orElseThrow(),
+        confirmationCall.name().orElseThrow(),
+        ImmutableMap.of("confirmed", true));
+  }
+
   /** The un-subscribed resume stream, for tests asserting on the error rather than the events. */
   public static Flowable<Event> resumeFlowable(
       Runner runner,
```

---

### Incident Patch 2: `52e51c65` (2026-10-05)
**Commit Message**: Merge pull request #1542 from innoprej:fix/local-skill-source-forward-slashes

PiperOrigin-RevId: 993641154

**File**: `core/pom.xml` (modified, +6/-0)
```diff
@@ -154,6 +154,12 @@
       <artifactId>truth</artifactId>
       <scope>test</scope>
     </dependency>
+    <dependency>
+      <groupId>com.google.jimfs</groupId>
+      <artifactId>jimfs</artifactId>
+      <version>1.3.2</version>
+      <scope>test</scope>
+    </dependency>
     <dependency>
       <groupId>org.mockito</groupId>
       <artifactId>mockito-core</artifactId>
```

**File**: `core/src/main/java/com/google/adk/skills/LocalSkillSource.java` (modified, +6/-1)
```diff
@@ -23,6 +23,7 @@
 import static com.google.common.collect.ImmutableList.toImmutableList;
 import static java.nio.file.Files.isDirectory;
 
+import com.google.common.base.Joiner;
 import com.google.common.collect.ImmutableList;
 import io.reactivex.rxjava3.core.Flowable;
 import io.reactivex.rxjava3.core.Maybe;
@@ -37,6 +38,8 @@
 /** Loads skills from the local file system. */
 public final class LocalSkillSource extends AbstractSkillSource<Path> {
 
+  private static final Joiner PATH_JOINER = Joiner.on('/');
+
   private final Path skillsBasePath;
 
   public LocalSkillSource(Path skillsBasePath) {
@@ -71,7 +74,9 @@ public Single<ImmutableList<String>> listResources(String skillName, String reso
                 return paths
                     .filter(Files::isRegularFile)
                     .map(skillDir::relativize)
-                    .map(Path::toString)
+                    // Join the path's name elements with '/' on every OS, not the platform
+                    // separator, to match ClassPathSkillSource and InMemorySkillSource.
+                    .map(relativePath -> PATH_JOINER.join(relativePath))
                     .collect(toImmutableList());
               }
             })
```

**File**: `core/src/test/java/com/google/adk/skills/LocalSkillSourceTest.java` (modified, +24/-0)
```diff
@@ -23,7 +23,10 @@
 import com.google.common.collect.ImmutableList;
 import com.google.common.collect.ImmutableMap;
 import com.google.common.io.ByteSource;
+import com.google.common.jimfs.Configuration;
+import com.google.common.jimfs.Jimfs;
 import java.io.IOException;
+import java.nio.file.FileSystem;
 import java.nio.file.Files;
 import java.nio.file.Path;
 import org.junit.Rule;
@@ -96,6 +99,27 @@ public void testListResources() throws IOException {
     assertThat(resources).containsExactly("assets/file1.txt", "assets/subdir/file2.txt");
   }
 
+  @Test
+  public void testListResources_windowsFileSystem() throws IOException {
+    // Use Windows paths on any host so Ubuntu CI covers separator normalization.
+    try (FileSystem fileSystem = Jimfs.newFileSystem(Configuration.windows())) {
+      Path skillsBase = fileSystem.getPath("C:\\skills");
+      Path assetsDir = skillsBase.resolve("my-skill").resolve("assets");
+      Files.createDirectories(assetsDir.resolve("subdir"));
+      Files.writeString(assetsDir.resolve("file1.txt"), "resource content");
+      Files.writeString(assetsDir.resolve("subdir").resolve("file2.txt"), "resource content");
+
+      SkillSource source = new LocalSkillSource(skillsBase);
+      ImmutableList<String> resources = source.listResources("my-skill", "assets").blockingGet();
+
+      assertThat(resources).containsExactly("assets/file1.txt", "assets/subdir/file2.txt");
+      for (String resourcePath : resources) {
+        ByteSource resource = source.loadResource("my-skill", resourcePath).blockingGet();
+        assertThat(new String(resource.read(), UTF_8)).isEqualTo("resource content");
+      }
+    }
+  }
+
   @Test
   public void testListResources_notDirectory() throws IOException {
     Path skillsBase = tempFolder.getRoot().toPath().resolve("skills");
```

---

### Incident Patch 3: `f44bc406` (2026-10-02)
**Commit Message**: Merge pull request #1563 from innoprej:fix/agent-tool-caller-run-config

PiperOrigin-RevId: 992233298

**File**: `core/src/main/java/com/google/adk/tools/AgentTool.java` (modified, +10/-1)
```diff
@@ -25,6 +25,8 @@
 import com.google.adk.agents.ConfigAgentUtils;
 import com.google.adk.agents.ConfigAgentUtils.ConfigurationException;
 import com.google.adk.agents.LlmAgent;
+import com.google.adk.agents.RunConfig;
+import com.google.adk.agents.RunConfig.StreamingMode;
 import com.google.adk.events.Event;
 import com.google.adk.plugins.Plugin;
 import com.google.adk.runner.InMemoryRunner;
@@ -186,10 +188,17 @@ public Single<Map<String, Object>> runAsync(Map<String, Object> args, ToolContex
             ? ImmutableList.of(toolContext.invocationContext().pluginManager())
             : ImmutableList.of();
     Runner runner = new InMemoryRunner(this.agent, toolContext.agentName(), plugins);
+    // Follow the caller's RunConfig but run unary: only the last event becomes the result.
+    RunConfig callerRunConfig = toolContext.invocationContext().runConfig();
+    RunConfig runConfig =
+        callerRunConfig.streamingMode() == StreamingMode.NONE
+            ? callerRunConfig
+            : callerRunConfig.toBuilder().streamingMode(StreamingMode.NONE).build();
     return runner
         .sessionService()
         .createSession(toolContext.agentName(), "tmp-user", toolContext.state(), null)
-        .flatMapPublisher(session -> runner.runAsync(session.userId(), session.id(), content))
+        .flatMapPublisher(
+            session -> runner.runAsync(session.userId(), session.id(), content, runConfig))
         .doOnNext(
             event -> {
               if (event.actions() != null
```

**File**: `core/src/test/java/com/google/adk/tools/AgentToolTest.java` (modified, +43/-0)
```diff
@@ -16,6 +16,8 @@
 
 package com.google.adk.tools;
 
+import static com.google.adk.testing.TestUtils.createInvocationContext;
+import static com.google.adk.testing.TestUtils.createSubAgent;
 import static com.google.adk.testing.TestUtils.createTestAgentBuilder;
 import static com.google.adk.testing.TestUtils.createTestLlm;
 import static com.google.common.truth.Truth.assertThat;
@@ -26,12 +28,16 @@
 import com.google.adk.agents.ConfigAgentUtils.ConfigurationException;
 import com.google.adk.agents.InvocationContext;
 import com.google.adk.agents.LlmAgent;
+import com.google.adk.agents.RunConfig;
+import com.google.adk.agents.RunConfig.StreamingMode;
+import com.google.adk.agents.RunConfig.ToolExecutionMode;
 import com.google.adk.agents.SequentialAgent;
 import com.google.adk.models.LlmResponse;
 import com.google.adk.plugins.Plugin;
 import com.google.adk.plugins.PluginManager;
 import com.google.adk.sessions.InMemorySessionService;
 import com.google.adk.sessions.Session;
+import com.google.adk.testing.TestBaseAgent;
 import com.google.adk.testing.TestLlm;
 import com.google.adk.utils.ComponentRegistry;
 import com.google.common.collect.ImmutableList;
@@ -871,6 +877,43 @@ public Maybe<Content> beforeRunCallback(InvocationContext invocationContext) {
     assertThat(callbackCalled.get()).isFalse();
   }
 
+  @Test
+  public void call_propagatesCallerRunConfig() throws Exception {
+    TestBaseAgent testAgent = createSubAgent("agent_name");
+    AgentTool agentTool = AgentTool.create(testAgent);
+    RunConfig runConfig =
+        RunConfig.builder()
+            .toolExecutionMode(ToolExecutionMode.SEQUENTIAL)
+            .maxLlmCalls(7)
+            .customMetadata(ImmutableMap.of("tier", "x"))
+            .build();
+    ToolContext toolContext =
+        ToolContext.builder(createInvocationContext(testAgent, runConfig)).build();
+
+    Map<String, Object> unused =
+        agentTool.runAsync(ImmutableMap.of("request", "magic"), toolContext).blockingGet();
+
+    assertThat(testAgent.getLastInvocationContext().runConfig()).isEqualTo(runConfig);
+  }
+
+  @Test
+  public void call_withStreamingRunConfig_runsAgentWithoutStreaming() throws Exception {
+    for (StreamingMode streamingMode : ImmutableList.of(StreamingMode.SSE, StreamingMode.BIDI)) {
+      TestBaseAgent testAgent = createSubAgent("agent_name");
+      AgentTool agentTool = AgentTool.create(testAgent);
+      RunConfig runConfig = RunConfig.builder().streamingMode(streamingMode).maxLlmCalls(7).build();
+      ToolContext toolContext =
+          ToolContext.builder(createInvocationContext(testAgent, runConfig)).build();
+
+      Map<String, Object> unused =
+          agentTool.runAsync(ImmutableMap.of("request", "magic"), toolContext).blockingGet();
+
+      // Only the streaming mode changes; the other settings still come from the caller.
+      assertThat(testAgent.getLastInvocationContext().runConfig())
+          .isEqualTo(runConfig.toBuilder().streamingMode(StreamingMode.NONE).build());
+    }
+  }
+
   private ToolContext createToolContext(BaseAgent agent) {
     Session session =
         sessionService.createSession("test-app", "test-user", null, "test-session").blockingGet();
```

---

### Incident Patch 4: `ed72ddbf` (2026-10-01)
**Commit Message**: fix: record the thinking budget and level on the call_llm telemetry span

PiperOrigin-RevId: 991596919

**File**: `core/src/main/java/com/google/adk/telemetry/README.md` (modified, +2/-1)
```diff
@@ -37,7 +37,8 @@ Calls to Large Language Models (LLMs) are traced within a `call_llm` span. The
 *   Model name (`gen_ai.request.model`).
 *   Token usage (`gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`).
 *   Configuration parameters (`gen_ai.request.top_p`,
-    `gen_ai.request.max_tokens`).
+    `gen_ai.request.max_tokens`, `gen_ai.request.reasoning.level`, and the
+    thinking budget as `gen_ai.usage.experimental.reasoning_tokens_limit`).
 *   Response finish reason (`gen_ai.response.finish_reasons`).
 
 ### Tool Calls and Responses
```

**File**: `core/src/main/java/com/google/adk/telemetry/Tracing.java` (modified, +18/-0)
```diff
@@ -30,6 +30,7 @@
 import com.google.genai.types.Content;
 import com.google.genai.types.FunctionResponse;
 import com.google.genai.types.Part;
+import com.google.genai.types.ThinkingConfig;
 import io.opentelemetry.api.GlobalOpenTelemetry;
 import io.opentelemetry.api.common.AttributeKey;
 import io.opentelemetry.api.trace.Span;
@@ -110,6 +111,8 @@ public class Tracing {
       AttributeKey.doubleKey("gen_ai.request.top_p");
   private static final AttributeKey<Long> GEN_AI_REQUEST_MAX_TOKENS =
       AttributeKey.longKey("gen_ai.request.max_tokens");
+  private static final AttributeKey<String> GEN_AI_REQUEST_REASONING_LEVEL =
+      AttributeKey.stringKey("gen_ai.request.reasoning.level");
   private static final AttributeKey<Long> GEN_AI_USAGE_INPUT_TOKENS =
       AttributeKey.longKey("gen_ai.usage.input_tokens");
   private static final AttributeKey<Long> GEN_AI_USAGE_OUTPUT_TOKENS =
@@ -118,6 +121,8 @@ public class Tracing {
       AttributeKey.longKey("gen_ai.usage.cache_read.input_tokens");
   private static final AttributeKey<Long> GEN_AI_USAGE_REASONING_OUTPUT_TOKENS =
       AttributeKey.longKey("gen_ai.usage.reasoning.output_tokens");
+  private static final AttributeKey<Long> GEN_AI_USAGE_REASONING_TOKENS_LIMIT =
+      AttributeKey.longKey("gen_ai.usage.experimental.reasoning_tokens_limit");
 
   private static final AttributeKey<String> ADK_TOOL_CALL_ARGS =
       AttributeKey.stringKey("gcp.vertex.agent.tool_call_args");
@@ -331,6 +336,19 @@ public static void traceCallLlm(
                   .ifPresent(
                       maxTokens ->
                           span.setAttribute(GEN_AI_REQUEST_MAX_TOKENS, maxTokens.longValue()));
+              config
+                  .thinkingConfig()
+                  .flatMap(ThinkingConfig::thinkingBudget)
+                  .ifPresent(
+                      budget ->
+                          span.setAttribute(
+                              GEN_AI_USAGE_REASONING_TOKENS_LIMIT, budget.longValue()));
+              // OTel wants the exact string sent to the provider, which toString() returns.
+              config
+                  .thinkingConfig()
+                  .flatMap(ThinkingConfig::thinkingLevel)
+                  .ifPresent(
+                      level -> span.setAttribute(GEN_AI_REQUEST_REASONING_LEVEL, level.toString()));
             });
     llmResponse
         .usageMetadata()
```

**File**: `core/src/test/java/com/google/adk/telemetry/ContextPropagationTest.java` (modified, +64/-0)
```diff
@@ -44,6 +44,7 @@
 import com.google.genai.types.GenerateContentConfig;
 import com.google.genai.types.GenerateContentResponseUsageMetadata;
 import com.google.genai.types.Part;
+import com.google.genai.types.ThinkingConfig;
 import io.opentelemetry.api.common.AttributeKey;
 import io.opentelemetry.api.common.Attributes;
 import io.opentelemetry.api.trace.Span;
@@ -533,6 +534,69 @@ public void testTraceCallLlm_withOnlyToolUsePromptTokens() {
     assertEquals(20L, (long) attrs.get(AttributeKey.longKey("gen_ai.usage.output_tokens")));
   }
 
+  @Test
+  public void testTraceCallLlm_withThinkingBudget() {
+    Span span = tracer.spanBuilder("test-thinking-budget").startSpan();
+    try (Scope scope = span.makeCurrent()) {
+      LlmRequest llmRequest =
+          LlmRequest.builder()
+              .model("gemini-pro")
+              .contents(ImmutableList.of(Content.fromParts(Part.fromText("hello"))))
+              .config(
+                  GenerateContentConfig.builder()
+                      .thinkingConfig(ThinkingConfig.builder().thinkingBudget(2048).build())
+                      .build())
+              .build();
+      Tracing.traceCallLlm(
+          span,
+          buildInvocationContext(),
+          "event-1",
+          llmRequest,
+          LlmResponse.builder().build(),
+          null);
+    } finally {
+      span.end();
+    }
+    List<SpanData> spans = openTelemetryRule.getSpans();
+    assertThat(spans).hasSize(1);
+    Attributes attrs = spans.get(0).getAttributes();
+    assertThat(attrs.get(AttributeKey.longKey("gen_ai.usage.experimental.reasoning_tokens_limit")))
+        .isEqualTo(2048L);
+    assertThat(attrs.get(AttributeKey.stringKey("gen_ai.request.reasoning.level"))).isNull();
+  }
+
+  @Test
+  public void testTraceCallLlm_withThinkingLevel_recordsValueSentToProvider() {
+    Span span = tracer.spanBuilder("test-thinking-level").startSpan();
+    try (Scope scope = span.makeCurrent()) {
+      LlmRequest llmRequest =
+          LlmRequest.builder()
+              .model("gemini-pro")
+              .contents(ImmutableList.of(Content.fromParts(Part.fromText("hello"))))
+              .config(
+                  GenerateContentConfig.builder()
+                      .thinkingConfig(ThinkingConfig.builder().thinkingLevel("low").build())
+                      .build())
+              .build();
+      Tracing.traceCallLlm(
+          span,
+          buildInvocationContext(),
+          "event-1",
+          llmRequest,
+          LlmResponse.builder().build(),
+          null);
+    } finally {
+      span.end();
+    }
+    List<SpanData> spans = openTelemetryRule.getSpans();
+    assertThat(spans).hasSize(1);
+    Attributes attrs = spans.get(0).getAttributes();
+    assertThat(attrs.get(AttributeKey.stringKey("gen_ai.request.reasoning.level")))
+        .isEqualTo("low");
+    assertThat(attrs.get(AttributeKey.longKey("gen_ai.usage.experimental.reasoning_tokens_limit")))
+        .isNull();
+  }
+
   @Test
   public void testTraceSendData() {
     Span span = tracer.spanBuilder("test").startSpan();
```

---

### Incident Patch 5: `055a4a93` (2026-10-01)
**Commit Message**: Merge pull request #1571 from Laurianti:fix-reject-negative-num-recent-events

PiperOrigin-RevId: 991587592

**File**: `core/src/main/java/com/google/adk/sessions/GetSessionConfig.java` (modified, +18/-1)
```diff
@@ -16,6 +16,8 @@
 
 package com.google.adk.sessions;
 
+import static com.google.common.base.Preconditions.checkArgument;
+
 import com.google.auto.value.AutoValue;
 import java.time.Instant;
 import java.util.Optional;
@@ -36,7 +38,22 @@ public abstract static class Builder {
 
     public abstract Builder afterTimestamp(Instant afterTimestamp);
 
-    public abstract GetSessionConfig build();
+    abstract GetSessionConfig autoBuild();
+
+    /**
+     * Builds the config.
+     *
+     * @throws IllegalArgumentException if {@code numRecentEvents} is negative
+     */
+    public GetSessionConfig build() {
+      GetSessionConfig config = autoBuild();
+      config
+          .numRecentEvents()
+          .ifPresent(
+              num ->
+                  checkArgument(num >= 0, "numRecentEvents must be greater than or equal to 0."));
+      return config;
+    }
   }
 
   public static Builder builder() {
```

**File**: `core/src/test/java/com/google/adk/sessions/GetSessionConfigTest.java` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+/*
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.google.adk.sessions;
+
+import static com.google.common.truth.Truth.assertThat;
+import static org.junit.Assert.assertThrows;
+
+import org.junit.Test;
+import org.junit.runner.RunWith;
+import org.junit.runners.JUnit4;
+
+@RunWith(JUnit4.class)
+public final class GetSessionConfigTest {
+
+  @Test
+  public void build_negativeNumRecentEvents_throwsIllegalArgumentException() {
+    GetSessionConfig.Builder builder = GetSessionConfig.builder().numRecentEvents(-1);
+
+    assertThrows(IllegalArgumentException.class, builder::build);
+  }
+
+  @Test
+  public void build_zeroNumRecentEvents_isAccepted() {
+    GetSessionConfig config = GetSessionConfig.builder().numRecentEvents(0).build();
+
+    assertThat(config.numRecentEvents()).hasValue(0);
+  }
+}
```

---

### Incident Patch 6: `c897cdb1` (2026-10-01)
**Commit Message**: revert: keeping structuredContent and non-text content in MCP tool results

PiperOrigin-RevId: 991479621

**File**: `core/src/main/java/com/google/adk/tools/mcp/AbstractMcpTool.java` (modified, +24/-37)
```diff
@@ -33,7 +33,6 @@
 import java.util.List;
 import java.util.Map;
 import java.util.Optional;
-import org.jspecify.annotations.Nullable;
 
 /**
  * Base class for MCP tools.
@@ -110,15 +109,9 @@ public Optional<FunctionDeclaration> declaration() {
     }
   }
 
-  /**
-   * Converts a {@link CallToolResult} into a tool response map; a null or error result becomes a
-   * single {@code error} entry. Text items go under {@code text_output}, each parsed as a JSON
-   * object or else wrapped as {@code {"text": ...}}. {@code structuredContent} and {@code _meta}
-   * are added when present, and the full ordered {@code content} list when any item is not text.
-   */
   @SuppressWarnings("PreferredInterfaceType") // BaseTool.runAsync() returns Map<String, Object>
   protected static Map<String, Object> wrapCallResult(
-      ObjectMapper objectMapper, String mcpToolName, @Nullable CallToolResult callResult) {
+      ObjectMapper objectMapper, String mcpToolName, CallToolResult callResult) {
     if (callResult == null) {
       return ImmutableMap.of("error", "MCP framework error: CallToolResult was null");
     }
@@ -137,42 +130,36 @@ protected static Map<String, Object> wrapCallResult(
       return ImmutableMap.of("error", errorMessage);
     }
 
-    List<Map<String, Object>> textOutputs = new ArrayList<>();
-    boolean hasNonTextContent = false;
+    if (contents == null || contents.isEmpty()) {
+      return ImmutableMap.of();
+    }
+
+    List<String> textOutputs = new ArrayList<>();
     for (Content content : contents) {
       if (content instanceof TextContent textContent) {
-        textOutputs.add(parseTextOutput(objectMapper, textContent.text()));
-      } else {
-        hasNonTextContent = true;
+        if (textContent.text() != null) {
+          textOutputs.add(textContent.text());
+        }
       }
     }
 
-    ImmutableMap.Builder<String, Object> result = ImmutableMap.builder();
-    if (!textOutputs.isEmpty()) {
-      result.put("text_output", textOutputs);
-    }
-    // Skipped for text-only results, which would otherwise send their text twice.
-    if (hasNonTextContent) {
-      // Converted through the record so each item keeps its polymorphic "type" property.
-      Map<String, Object> wireResult =
-          objectMapper.convertValue(callResult, new TypeReference<Map<String, Object>>() {});
-      result.put("content", wireResult.get("content"));
-    }
-    if (callResult.structuredContent() != null) {
-      result.put("structuredContent", callResult.structuredContent());
+    if (textOutputs.isEmpty()) {
+      return ImmutableMap.of(
+          "error",
+          "Tool '" + mcpToolName + "' returned content that is not TextContent.",
+          "content_details",
+          contents.toString());
     }
-    if (callResult.meta() != null) {
-      result.put("_meta", callResult.meta());
-    }
-    return result.buildOrThrow();
-  }
 
-  private static @Nullable Map<String, Object> parseTextOutput(
-      ObjectMapper objectMapper, String text) {
-    try {
-      return objectMapper.readValue(text, new TypeReference<Map<String, Object>>() {});
-    } catch (JsonProcessingException e) {
-      return ImmutableMap.of("text", text);
+    List<Map<String, Object>> resultMaps = new ArrayList<>();
+    for (String textOutput : textOutputs) {
+      try {
+        resultMaps.add(
+            objectMapper.readValue(textOutput, new TypeReference<Map<String, Object>>() {}));
+      } catch (JsonProcessingException e) {
+        resultMaps.add(ImmutableMap.of("text", textOutput));
+      }
     }
+    return ImmutableMap.of("text_output", resultMaps);
   }
 }
```

**File**: `core/src/test/java/com/google/adk/tools/mcp/AbstractMcpToolTest.java` (modified, +10/-105)
```diff
@@ -21,13 +21,12 @@
 import static org.mockito.Mockito.mock;
 
 import com.fasterxml.jackson.databind.ObjectMapper;
-import com.google.adk.JsonBaseModel;
 import com.google.common.collect.ImmutableList;
-import com.google.common.collect.ImmutableMap;
 import io.modelcontextprotocol.client.McpSyncClient;
 import io.modelcontextprotocol.spec.McpSchema;
 import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
-import io.modelcontextprotocol.spec.McpSchema.ImageContent;
+import io.modelcontextprotocol.spec.McpSchema.TextContent;
+import java.util.List;
 import java.util.Map;
 import org.junit.Before;
 import org.junit.Test;
@@ -37,123 +36,29 @@
 @RunWith(JUnit4.class)
 public final class AbstractMcpToolTest {
 
-  private static final ImageContent IMAGE = ImageContent.builder("aW1hZ2U=", "image/png").build();
-  private static final ImmutableMap<String, Object> IMAGE_JSON =
-      ImmutableMap.of("type", "image", "data", "aW1hZ2U=", "mimeType", "image/png");
-
   private ObjectMapper objectMapper;
 
   @Before
   public void setUp() {
-    // The mapper McpTool uses by default, so tests see the production serialization.
-    objectMapper = JsonBaseModel.getMapper();
-  }
-
-  @Test
-  public void wrapCallResult_textOnly_returnsOnlyTextOutput() {
-    CallToolResult result =
-        CallToolResult.builder().addTextContent("first").addTextContent("{\"a\":1}").build();
-
-    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
-
-    assertThat(map)
-        .containsExactly(
-            "text_output",
-            ImmutableList.of(ImmutableMap.of("text", "first"), ImmutableMap.of("a", 1)));
+    objectMapper = new ObjectMapper();
   }
 
   @Test
-  public void wrapCallResult_mixedContent_keepsTextOutputAndAddsContentAndStructuredContent() {
+  public void testWrapCallResult_success() {
     CallToolResult result =
         CallToolResult.builder()
-            .addTextContent("first")
-            .addTextContent("second")
-            .addContent(IMAGE)
-            .structuredContent(ImmutableMap.of("count", 2))
+            .content(ImmutableList.of(new TextContent("success")))
             .isError(false)
             .build();
 
     Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
 
-    assertThat(map)
-        .containsExactly(
-            "text_output",
-            ImmutableList.of(ImmutableMap.of("text", "first"), ImmutableMap.of("text", "second")),
-            "content",
-            ImmutableList.of(
-                ImmutableMap.of("type", "text", "text", "first"),
-                ImmutableMap.of("type", "text", "text", "second"),
-                IMAGE_JSON),
-            "structuredContent",
-            ImmutableMap.of("count", 2));
-  }
-
-  @Test
-  public void wrapCallResult_textWithStructuredContent_keepsTextOutputAndAddsStructuredContent() {
-    CallToolResult result =
-        CallToolResult.builder()
-            .addTextContent("{\"count\":2}")
-            .structuredContent(ImmutableMap.of("count", 2))
-            .build();
-
-    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
-
-    assertThat(map)
-        .containsExactly(
-            "text_output",
-            ImmutableList.of(ImmutableMap.of("count", 2)),
-            "structuredContent",
-            ImmutableMap.of("count", 2));
-  }
-
-  @Test
-  public void wrapCallResult_nonTextOnly_returnsContentWithoutError() {
-    CallToolResult result = CallToolResult.builder().addContent(IMAGE).build();
-
-    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
-
-    assertThat(map).containsExactly("content", ImmutableList.of(IMAGE_JSON));
-  }
-
-  @Test
-  public void wrapCallResult_emptyContent_returnsEmptyMap() {
-    CallToolResult result = CallToolResult.builder().build();
-
-    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
-
-    assertThat(map).isEmpty();
-  }
-
-  @Test
-  public void wrapCallResult_emptyContentWithStructuredContentAndMeta_returnsBoth() {
-    CallToolResult result =
-        CallToolResult.builder()
-            .structuredContent(ImmutableMap.of("count", 2))
-            .meta(ImmutableMap.of("trace", "abc"))
-            .build();
-
-    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
-
-    assertThat(map)
-        .containsExactly(
-            "structuredContent",
-            ImmutableMap.of("count", 2),
-            "_meta",
-            ImmutableMap.of("trace", "abc"));
-  }
-
-  @Test
-  public void wrapCallResult_error_returnsOnlyError() {
-    CallToolResult result =
-        CallToolResult.builder()
-            .addTextContent("boom")
-            .structuredContent(ImmutableMap.of("count", 2))
-            .isError(true)
-            .build();
-
-    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", re
```

---

### Incident Patch 7: `2a2ab5cf` (2026-09-24)
**Commit Message**: fix(skills): use forward slashes in LocalSkillSource.listResources

LocalSkillSource.listResources turned each relative resource path into
a string with Path.toString(), which uses the platform separator. On
Windows it returned assets\file1.txt, while ClassPathSkillSource and
InMemorySkillSource return assets/file1.txt, and LoadSkillResourceTool
only accepts paths that start with assets/, references/ or scripts/.
LocalSkillSourceTest.testListResources fails on Windows:

  expected: [assets/file1.txt, assets/subdir/file2.txt]
  but was : [assets\file1.txt, assets\subdir\file2.txt]

Join the path's name elements with '/' instead, as adk-python now does
for skill resources loaded from a directory. Nothing changes on Linux
and macOS, where Path.toString() already uses '/'. CI runs on Ubuntu,
so it could not catch this.

- Reuse a static PATH_JOINER for each relative resource path.
- Add a test-scoped Jimfs Windows filesystem regression test that also
  reads the listed resources, so Ubuntu CI covers the separator bug.

**File**: `core/pom.xml` (modified, +6/-0)
```diff
@@ -154,6 +154,12 @@
       <artifactId>truth</artifactId>
       <scope>test</scope>
     </dependency>
+    <dependency>
+      <groupId>com.google.jimfs</groupId>
+      <artifactId>jimfs</artifactId>
+      <version>1.3.2</version>
+      <scope>test</scope>
+    </dependency>
     <dependency>
       <groupId>org.mockito</groupId>
       <artifactId>mockito-core</artifactId>
```

**File**: `core/src/main/java/com/google/adk/skills/LocalSkillSource.java` (modified, +6/-1)
```diff
@@ -23,6 +23,7 @@
 import static com.google.common.collect.ImmutableList.toImmutableList;
 import static java.nio.file.Files.isDirectory;
 
+import com.google.common.base.Joiner;
 import com.google.common.collect.ImmutableList;
 import io.reactivex.rxjava3.core.Flowable;
 import io.reactivex.rxjava3.core.Maybe;
@@ -37,6 +38,8 @@
 /** Loads skills from the local file system. */
 public final class LocalSkillSource extends AbstractSkillSource<Path> {
 
+  private static final Joiner PATH_JOINER = Joiner.on('/');
+
   private final Path skillsBasePath;
 
   public LocalSkillSource(Path skillsBasePath) {
@@ -71,7 +74,9 @@ public Single<ImmutableList<String>> listResources(String skillName, String reso
                 return paths
                     .filter(Files::isRegularFile)
                     .map(skillDir::relativize)
-                    .map(Path::toString)
+                    // Join the path's name elements with '/' on every OS, not the platform
+                    // separator, to match ClassPathSkillSource and InMemorySkillSource.
+                    .map(relativePath -> PATH_JOINER.join(relativePath))
                     .collect(toImmutableList());
               }
             })
```

**File**: `core/src/test/java/com/google/adk/skills/LocalSkillSourceTest.java` (modified, +24/-0)
```diff
@@ -23,7 +23,10 @@
 import com.google.common.collect.ImmutableList;
 import com.google.common.collect.ImmutableMap;
 import com.google.common.io.ByteSource;
+import com.google.common.jimfs.Configuration;
+import com.google.common.jimfs.Jimfs;
 import java.io.IOException;
+import java.nio.file.FileSystem;
 import java.nio.file.Files;
 import java.nio.file.Path;
 import org.junit.Rule;
@@ -96,6 +99,27 @@ public void testListResources() throws IOException {
     assertThat(resources).containsExactly("assets/file1.txt", "assets/subdir/file2.txt");
   }
 
+  @Test
+  public void testListResources_windowsFileSystem() throws IOException {
+    // Use Windows paths on any host so Ubuntu CI covers separator normalization.
+    try (FileSystem fileSystem = Jimfs.newFileSystem(Configuration.windows())) {
+      Path skillsBase = fileSystem.getPath("C:\\skills");
+      Path assetsDir = skillsBase.resolve("my-skill").resolve("assets");
+      Files.createDirectories(assetsDir.resolve("subdir"));
+      Files.writeString(assetsDir.resolve("file1.txt"), "resource content");
+      Files.writeString(assetsDir.resolve("subdir").resolve("file2.txt"), "resource content");
+
+      SkillSource source = new LocalSkillSource(skillsBase);
+      ImmutableList<String> resources = source.listResources("my-skill", "assets").blockingGet();
+
+      assertThat(resources).containsExactly("assets/file1.txt", "assets/subdir/file2.txt");
+      for (String resourcePath : resources) {
+        ByteSource resource = source.loadResource("my-skill", resourcePath).blockingGet();
+        assertThat(new String(resource.read(), UTF_8)).isEqualTo("resource content");
+      }
+    }
+  }
+
   @Test
   public void testListResources_notDirectory() throws IOException {
     Path skillsBase = tempFolder.getRoot().toPath().resolve("skills");
```

---

### Incident Patch 8: `9b128dfb` (2026-09-29)
**Commit Message**: fix: keep structuredContent and non-text content in MCP tool results

PiperOrigin-RevId: 990288862

**File**: `core/src/main/java/com/google/adk/tools/mcp/AbstractMcpTool.java` (modified, +37/-24)
```diff
@@ -33,6 +33,7 @@
 import java.util.List;
 import java.util.Map;
 import java.util.Optional;
+import org.jspecify.annotations.Nullable;
 
 /**
  * Base class for MCP tools.
@@ -109,9 +110,15 @@ public Optional<FunctionDeclaration> declaration() {
     }
   }
 
+  /**
+   * Converts a {@link CallToolResult} into a tool response map; a null or error result becomes a
+   * single {@code error} entry. Text items go under {@code text_output}, each parsed as a JSON
+   * object or else wrapped as {@code {"text": ...}}. {@code structuredContent} and {@code _meta}
+   * are added when present, and the full ordered {@code content} list when any item is not text.
+   */
   @SuppressWarnings("PreferredInterfaceType") // BaseTool.runAsync() returns Map<String, Object>
   protected static Map<String, Object> wrapCallResult(
-      ObjectMapper objectMapper, String mcpToolName, CallToolResult callResult) {
+      ObjectMapper objectMapper, String mcpToolName, @Nullable CallToolResult callResult) {
     if (callResult == null) {
       return ImmutableMap.of("error", "MCP framework error: CallToolResult was null");
     }
@@ -130,36 +137,42 @@ protected static Map<String, Object> wrapCallResult(
       return ImmutableMap.of("error", errorMessage);
     }
 
-    if (contents == null || contents.isEmpty()) {
-      return ImmutableMap.of();
-    }
-
-    List<String> textOutputs = new ArrayList<>();
+    List<Map<String, Object>> textOutputs = new ArrayList<>();
+    boolean hasNonTextContent = false;
     for (Content content : contents) {
       if (content instanceof TextContent textContent) {
-        if (textContent.text() != null) {
-          textOutputs.add(textContent.text());
-        }
+        textOutputs.add(parseTextOutput(objectMapper, textContent.text()));
+      } else {
+        hasNonTextContent = true;
       }
     }
 
-    if (textOutputs.isEmpty()) {
-      return ImmutableMap.of(
-          "error",
-          "Tool '" + mcpToolName + "' returned content that is not TextContent.",
-          "content_details",
-          contents.toString());
+    ImmutableMap.Builder<String, Object> result = ImmutableMap.builder();
+    if (!textOutputs.isEmpty()) {
+      result.put("text_output", textOutputs);
+    }
+    // Skipped for text-only results, which would otherwise send their text twice.
+    if (hasNonTextContent) {
+      // Converted through the record so each item keeps its polymorphic "type" property.
+      Map<String, Object> wireResult =
+          objectMapper.convertValue(callResult, new TypeReference<Map<String, Object>>() {});
+      result.put("content", wireResult.get("content"));
+    }
+    if (callResult.structuredContent() != null) {
+      result.put("structuredContent", callResult.structuredContent());
     }
+    if (callResult.meta() != null) {
+      result.put("_meta", callResult.meta());
+    }
+    return result.buildOrThrow();
+  }
 
-    List<Map<String, Object>> resultMaps = new ArrayList<>();
-    for (String textOutput : textOutputs) {
-      try {
-        resultMaps.add(
-            objectMapper.readValue(textOutput, new TypeReference<Map<String, Object>>() {}));
-      } catch (JsonProcessingException e) {
-        resultMaps.add(ImmutableMap.of("text", textOutput));
-      }
+  private static @Nullable Map<String, Object> parseTextOutput(
+      ObjectMapper objectMapper, String text) {
+    try {
+      return objectMapper.readValue(text, new TypeReference<Map<String, Object>>() {});
+    } catch (JsonProcessingException e) {
+      return ImmutableMap.of("text", text);
     }
-    return ImmutableMap.of("text_output", resultMaps);
   }
 }
```

**File**: `core/src/test/java/com/google/adk/tools/mcp/AbstractMcpToolTest.java` (modified, +105/-10)
```diff
@@ -21,12 +21,13 @@
 import static org.mockito.Mockito.mock;
 
 import com.fasterxml.jackson.databind.ObjectMapper;
+import com.google.adk.JsonBaseModel;
 import com.google.common.collect.ImmutableList;
+import com.google.common.collect.ImmutableMap;
 import io.modelcontextprotocol.client.McpSyncClient;
 import io.modelcontextprotocol.spec.McpSchema;
 import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
-import io.modelcontextprotocol.spec.McpSchema.TextContent;
-import java.util.List;
+import io.modelcontextprotocol.spec.McpSchema.ImageContent;
 import java.util.Map;
 import org.junit.Before;
 import org.junit.Test;
@@ -36,29 +37,123 @@
 @RunWith(JUnit4.class)
 public final class AbstractMcpToolTest {
 
+  private static final ImageContent IMAGE = ImageContent.builder("aW1hZ2U=", "image/png").build();
+  private static final ImmutableMap<String, Object> IMAGE_JSON =
+      ImmutableMap.of("type", "image", "data", "aW1hZ2U=", "mimeType", "image/png");
+
   private ObjectMapper objectMapper;
 
   @Before
   public void setUp() {
-    objectMapper = new ObjectMapper();
+    // The mapper McpTool uses by default, so tests see the production serialization.
+    objectMapper = JsonBaseModel.getMapper();
+  }
+
+  @Test
+  public void wrapCallResult_textOnly_returnsOnlyTextOutput() {
+    CallToolResult result =
+        CallToolResult.builder().addTextContent("first").addTextContent("{\"a\":1}").build();
+
+    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
+
+    assertThat(map)
+        .containsExactly(
+            "text_output",
+            ImmutableList.of(ImmutableMap.of("text", "first"), ImmutableMap.of("a", 1)));
   }
 
   @Test
-  public void testWrapCallResult_success() {
+  public void wrapCallResult_mixedContent_keepsTextOutputAndAddsContentAndStructuredContent() {
     CallToolResult result =
         CallToolResult.builder()
-            .content(ImmutableList.of(new TextContent("success")))
+            .addTextContent("first")
+            .addTextContent("second")
+            .addContent(IMAGE)
+            .structuredContent(ImmutableMap.of("count", 2))
             .isError(false)
             .build();
 
     Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
 
-    assertThat(map).containsKey("text_output");
-    List<?> content = (List<?>) map.get("text_output");
-    assertThat(content).hasSize(1);
+    assertThat(map)
+        .containsExactly(
+            "text_output",
+            ImmutableList.of(ImmutableMap.of("text", "first"), ImmutableMap.of("text", "second")),
+            "content",
+            ImmutableList.of(
+                ImmutableMap.of("type", "text", "text", "first"),
+                ImmutableMap.of("type", "text", "text", "second"),
+                IMAGE_JSON),
+            "structuredContent",
+            ImmutableMap.of("count", 2));
+  }
+
+  @Test
+  public void wrapCallResult_textWithStructuredContent_keepsTextOutputAndAddsStructuredContent() {
+    CallToolResult result =
+        CallToolResult.builder()
+            .addTextContent("{\"count\":2}")
+            .structuredContent(ImmutableMap.of("count", 2))
+            .build();
+
+    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
+
+    assertThat(map)
+        .containsExactly(
+            "text_output",
+            ImmutableList.of(ImmutableMap.of("count", 2)),
+            "structuredContent",
+            ImmutableMap.of("count", 2));
+  }
+
+  @Test
+  public void wrapCallResult_nonTextOnly_returnsContentWithoutError() {
+    CallToolResult result = CallToolResult.builder().addContent(IMAGE).build();
+
+    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
+
+    assertThat(map).containsExactly("content", ImmutableList.of(IMAGE_JSON));
+  }
+
+  @Test
+  public void wrapCallResult_emptyContent_returnsEmptyMap() {
+    CallToolResult result = CallToolResult.builder().build();
+
+    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
+
+    assertThat(map).isEmpty();
+  }
+
+  @Test
+  public void wrapCallResult_emptyContentWithStructuredContentAndMeta_returnsBoth() {
+    CallToolResult result =
+        CallToolResult.builder()
+            .structuredContent(ImmutableMap.of("count", 2))
+            .meta(ImmutableMap.of("trace", "abc"))
+            .build();
+
+    Map<String, Object> map = AbstractMcpTool.wrapCallResult(objectMapper, "my_tool", result);
+
+    assertThat(map)
+        .containsExactly(
+            "structuredContent",
+            ImmutableMap.of("count", 2),
+            "_meta",
+            ImmutableMap.of("trace", "abc"));
+  }
+
+  @Test
+  public void wrapCallResult_error_returnsOnlyError() {
+    CallToolResult result =
+        CallToolResult.builder()
+            .addTextContent("boom")
+            .structuredContent(ImmutableMap.of("count", 2))
```

---

### Incident Patch 9: `a88b093d` (2026-09-29)
**Commit Message**: docs: add @deprecated guidance to two deprecated event setters

PiperOrigin-RevId: 990262251

**File**: `core/src/main/java/com/google/adk/events/Event.java` (modified, +6/-0)
```diff
@@ -172,6 +172,12 @@ public void setErrorCode(@Nullable FinishReason errorCode) {
     this.errorCode = errorCode;
   }
 
+  /**
+   * Sets the finish reason from an {@link Optional}.
+   *
+   * @deprecated Use {@link #setFinishReason(FinishReason)} with {@code finishReason.orElse(null)}
+   *     instead.
+   */
   @Deprecated
   @SuppressWarnings("checkstyle:IllegalType")
   public void setFinishReason(Optional<FinishReason> finishReason) {
```

**File**: `core/src/main/java/com/google/adk/events/EventActions.java` (modified, +7/-1)
```diff
@@ -92,7 +92,13 @@ public Map<String, Object> stateDelta() {
     return stateDelta;
   }
 
-  @Deprecated // Use stateDelta() and removeStateByKey() instead.
+  /**
+   * Replaces the state delta.
+   *
+   * @deprecated Update the map returned by {@link #stateDelta()} instead, and use {@link
+   *     #removeStateByKey(String)} to remove a key.
+   */
+  @Deprecated
   public void setStateDelta(ConcurrentMap<String, Object> stateDelta) {
     this.stateDelta = stateDelta;
   }
```

---

### Incident Patch 10: `9da84d1d` (2026-09-29)
**Commit Message**: refactor: use JSpecify @Nullable in the remaining source files

PiperOrigin-RevId: 990247212

**File**: `contrib/spring-ai/src/main/java/com/google/adk/models/springai/properties/SpringAIProperties.java` (modified, +2/-2)
```diff
@@ -15,10 +15,10 @@
  */
 package com.google.adk.models.springai.properties;
 
-import jakarta.annotation.Nullable;
 import jakarta.validation.constraints.DecimalMax;
 import jakarta.validation.constraints.DecimalMin;
 import jakarta.validation.constraints.Min;
+import org.jspecify.annotations.Nullable;
 import org.springframework.boot.context.properties.ConfigurationProperties;
 import org.springframework.validation.annotation.Validated;
 
@@ -41,7 +41,7 @@
 @Validated
 public class SpringAIProperties {
 
-  @Nullable private String model;
+  private @Nullable String model;
 
   /** Default temperature for controlling randomness in responses. Must be between 0.0 and 2.0. */
   @DecimalMin(value = "0.0", message = "Temperature must be at least 0.0")
```

**File**: `dev/src/main/java/com/google/adk/plugins/recordings/LlmRecording.java` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@
 import com.google.auto.value.AutoValue;
 import java.util.List;
 import java.util.Optional;
-import javax.annotation.Nullable;
+import org.jspecify.annotations.Nullable;
 
 /** Paired LLM request and response for replay. */
 @AutoValue
```

**File**: `dev/src/main/java/com/google/adk/plugins/recordings/Recording.java` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
 import com.fasterxml.jackson.databind.annotation.JsonPOJOBuilder;
 import com.google.auto.value.AutoValue;
 import java.util.Optional;
-import javax.annotation.Nullable;
+import org.jspecify.annotations.Nullable;
 
 /** Single interaction recording, ordered by request timestamp. */
 @AutoValue
```

**File**: `dev/src/main/java/com/google/adk/plugins/recordings/ToolRecording.java` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
 import com.google.genai.types.FunctionCall;
 import com.google.genai.types.FunctionResponse;
 import java.util.Optional;
-import javax.annotation.Nullable;
+import org.jspecify.annotations.Nullable;
 
 /** Paired tool call and response for replay. */
 @AutoValue
```

**File**: `dev/src/main/java/com/google/adk/web/dto/AgentRunRequest.java` (modified, +3/-5)
```diff
@@ -20,7 +20,7 @@
 import com.google.adk.JsonBaseModel;
 import com.google.genai.types.Content;
 import java.util.Map;
-import javax.annotation.Nullable;
+import org.jspecify.annotations.Nullable;
 
 /**
  * Data Transfer Object (DTO) for POST /run and POST /run-sse requests. Contains information needed
@@ -48,8 +48,7 @@ public class AgentRunRequest {
    * replay mode settings) without modifying the stored session.
    */
   @JsonProperty("stateDelta")
-  @Nullable
-  public Map<String, Object> stateDelta;
+  public @Nullable Map<String, Object> stateDelta;
 
   public AgentRunRequest() {}
 
@@ -83,8 +82,7 @@ public boolean getStreaming() {
     return streaming;
   }
 
-  @Nullable
-  public Map<String, Object> getStateDelta() {
+  public @Nullable Map<String, Object> getStateDelta() {
     return stateDelta;
   }
 }
```

---

### Incident Patch 11: `9fe5830f` (2026-09-28)
**Commit Message**: fix(sessions): reject a duplicate session id in FirestoreSessionService

- `createSession` used to overwrite a session whose id was already in use,
  keeping its old events. It now fails with `SessionException`; to reuse an id,
  delete the session first.
- Session ids are unique per user across apps, so an id the same user already
  has under another app is rejected too.
- New session documents store a `createToken` field, so a create that the
  client retried after a lost reply is not reported as a duplicate.

PiperOrigin-RevId: 989581708

**File**: `contrib/firestore-session-service/src/main/java/com/google/adk/sessions/FirestoreSessionService.java` (modified, +27/-7)
```diff
@@ -21,7 +21,9 @@
 import com.google.adk.utils.Constants;
 import com.google.api.core.ApiFuture;
 import com.google.api.core.ApiFutures;
+import com.google.api.gax.rpc.AlreadyExistsException;
 import com.google.cloud.firestore.CollectionReference;
+import com.google.cloud.firestore.DocumentReference;
 import com.google.cloud.firestore.DocumentSnapshot;
 import com.google.cloud.firestore.Firestore;
 import com.google.cloud.firestore.Query;
@@ -48,9 +50,10 @@
 import java.util.UUID;
 import java.util.concurrent.ConcurrentHashMap;
 import java.util.concurrent.ConcurrentMap;
+import java.util.concurrent.ExecutionException;
 import java.util.concurrent.atomic.AtomicBoolean;
 import java.util.regex.Matcher;
-import javax.annotation.Nullable;
+import org.jspecify.annotations.Nullable;
 import org.slf4j.Logger;
 import org.slf4j.LoggerFactory;
 
@@ -73,6 +76,9 @@ public class FirestoreSessionService implements BaseSessionService {
   private static final String UPDATE_TIME_KEY = Constants.KEY_UPDATE_TIME;
   private static final String TIMESTAMP_KEY = Constants.KEY_TIMESTAMP;
 
+  /** Random token each create stores, so a retried create can detect its own write. */
+  static final String CREATE_TOKEN_KEY = "createToken";
+
   /** Constructor for FirestoreSessionService. */
   public FirestoreSessionService(Firestore firestore) {
     this.firestore = firestore;
@@ -96,7 +102,10 @@ public Single<Session> createSession(
     return createSession(appName, userId, (Map<String, Object>) state, sessionId);
   }
 
-  /** Creates a new session in Firestore. */
+  /**
+   * Creates a new session in Firestore. Session IDs are unique per user across apps, so creating
+   * one the user already has under any app fails with {@link SessionException}.
+   */
   @Override
   public Single<Session> createSession(
       String appName,
@@ -139,11 +148,22 @@ public Single<Session> createSession(
           sessionData.put(USER_ID_KEY, newSession.userId());
           sessionData.put(UPDATE_TIME_KEY, newSession.lastUpdateTime().toString());
           sessionData.put(STATE_KEY, newSession.state());
-
-          // Asynchronously write to Firestore and wait for the result
-          ApiFuture<WriteResult> future =
-              getSessionsCollection(userId).document(resolvedSessionId).set(sessionData);
-          future.get(); // Block until the write is complete
+          String createToken = UUID.randomUUID().toString();
+          sessionData.put(CREATE_TOKEN_KEY, createToken);
+
+          // Unlike set(), create() fails if the session already exists instead of replacing it.
+          DocumentReference sessionDoc = getSessionsCollection(userId).document(resolvedSessionId);
+          try {
+            sessionDoc.create(sessionData).get();
+          } catch (ExecutionException e) {
+            if (!(e.getCause() instanceof AlreadyExistsException)) {
+              throw e;
+            }
+            // A retry after a lost reply fails on this call's own write; its token means success.
+            if (!createToken.equals(sessionDoc.get().get().getString(CREATE_TOKEN_KEY))) {
+              throw new SessionException(SessionException.SESSION_ALREADY_EXISTS, e.getCause());
+            }
+          }
 
           return newSession;
         });
```

**File**: `contrib/firestore-session-service/src/test/java/com/google/adk/runner/FirestoreDatabaseRunnerTest.java` (modified, +2/-1)
```diff
@@ -175,7 +175,8 @@ void run_withUserInput_createsSessionAndExecutesAgent() throws Exception {
     when(mockUserDocRef.collection(anyString())).thenReturn(mockSessionsCollection);
     when(mockSessionsCollection.document(anyString())).thenReturn(mockSessionDocRef);
 
-    when(mockSessionDocRef.set(anyMap())).thenReturn(ApiFutures.immediateFuture(mockWriteResult));
+    when(mockSessionDocRef.create(anyMap()))
+        .thenReturn(ApiFutures.immediateFuture(mockWriteResult));
     when(mockSessionDocRef.update(anyMap()))
         .thenReturn(ApiFutures.immediateFuture(mockWriteResult));
     // Mock the event sub-collection chain
```

**File**: `contrib/firestore-session-service/src/test/java/com/google/adk/sessions/FirestoreSessionServiceTest.java` (modified, +128/-4)
```diff
@@ -31,6 +31,10 @@
 import com.google.adk.events.EventActions;
 import com.google.adk.utils.Constants;
 import com.google.api.core.ApiFutures;
+import com.google.api.gax.grpc.GrpcStatusCode;
+import com.google.api.gax.rpc.AlreadyExistsException;
+import com.google.api.gax.rpc.PermissionDeniedException;
+import com.google.api.gax.rpc.UnavailableException;
 import com.google.cloud.firestore.CollectionReference;
 import com.google.cloud.firestore.DocumentReference;
 import com.google.cloud.firestore.DocumentSnapshot;
@@ -45,17 +49,20 @@
 import com.google.common.collect.ImmutableMap;
 import com.google.genai.types.Content;
 import com.google.genai.types.Part;
+import io.grpc.Status;
 import io.reactivex.rxjava3.observers.TestObserver;
 import java.time.Instant;
 import java.util.Collections;
 import java.util.List;
 import java.util.Map;
 import java.util.Optional;
 import java.util.concurrent.ConcurrentHashMap;
+import java.util.concurrent.ExecutionException;
 import org.junit.jupiter.api.BeforeEach;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.extension.ExtendWith;
 import org.mockito.ArgumentCaptor;
+import org.mockito.Captor;
 import org.mockito.Mock;
 import org.mockito.junit.jupiter.MockitoExtension;
 
@@ -89,6 +96,7 @@ public class FirestoreSessionServiceTest {
   @Mock private QuerySnapshot mockQuerySnapshot;
   @Mock private WriteResult mockWriteResult;
   @Mock private WriteBatch mockWriteBatch;
+  @Captor private ArgumentCaptor<Map<String, Object>> sessionDataCaptor;
 
   private FirestoreSessionService sessionService;
 
@@ -130,7 +138,7 @@ public void setup() {
 
     // Default mock for writes
     lenient()
-        .when(mockSessionDocRef.set(anyMap()))
+        .when(mockSessionDocRef.create(anyMap()))
         .thenReturn(ApiFutures.immediateFuture(mockWriteResult));
     lenient()
         .when(mockSessionDocRef.update(anyMap()))
@@ -307,7 +315,7 @@ void createSession_withSessionId_returnsNewSession() {
           assertThat(session.id()).isEqualTo(SESSION_ID);
           return true;
         });
-    verify(mockSessionDocRef).set(anyMap());
+    verify(mockSessionDocRef).create(anyMap());
   }
 
   /** Tests that createSession creates a new session with a generated session ID. */
@@ -334,7 +342,7 @@ void createSession_withNullSessionId_generatesNewId() {
           assertThat(session.id()).isNotEmpty();
           return true;
         });
-    verify(mockSessionDocRef).set(anyMap());
+    verify(mockSessionDocRef).create(anyMap());
   }
 
   /** Tests that createSession creates a new session with an empty session ID. */
@@ -358,7 +366,7 @@ void createSession_withEmptySessionId_generatesNewId() {
           assertThat(session.id()).isNotEqualTo("  ");
           return true;
         });
-    verify(mockSessionDocRef).set(anyMap());
+    verify(mockSessionDocRef).create(anyMap());
   }
 
   /** Tests that createSession creates a new session with an empty state when null state is */
@@ -391,6 +399,114 @@ void createSession_withNullAppName_throwsNullPointerException() {
         .assertError(NullPointerException.class);
   }
 
+  /** Tests that createSession rejects a session ID that is already taken. */
+  @Test
+  void createSession_withSessionIdAlreadyTaken_failsWithSessionException() {
+    // Arrange
+    when(mockSessionsCollection.document(SESSION_ID)).thenReturn(mockSessionDocRef);
+    when(mockSessionDocRef.create(anyMap()))
+        .thenReturn(ApiFutures.immediateFailedFuture(alreadyExists()));
+    when(mockSessionDocRef.get()).thenReturn(ApiFutures.immediateFuture(mockSessionSnapshot));
+    // Another caller's session, or one written before sessions carried a token.
+    when(mockSessionSnapshot.getString(FirestoreSessionService.CREATE_TOKEN_KEY)).thenReturn(null);
+
+    // Act
+    TestObserver<Session> testObserver =
+        sessionService.createSession(APP_NAME, USER_ID, null, SESSION_ID).test();
+
+    // Assert
+    testObserver.assertError(
+        e -> {
+          assertThat(e).isInstanceOf(SessionException.class);
+          assertThat(e).hasMessageThat().isEqualTo(SessionException.SESSION_ALREADY_EXISTS);
+          assertThat(e).hasCauseThat().isInstanceOf(AlreadyExistsException.class);
+          return true;
+        });
+  }
+
+  /** Tests that createSession succeeds when a client retry fails on the session's own write. */
+  @Test
+  void createSession_whenRetryHitsItsOwnWrite_returnsSession() {
+    // Arrange
+    when(mockSessionsCollection.document(SESSION_ID)).thenReturn(mockSessionDocRef);
+    when(mockSessionDocRef.create(sessionDataCaptor.capture()))
+        .thenReturn(ApiFutures.immediateFailedFuture(alreadyExists()));
+    when(mockSessionDocRef.get()).thenReturn(ApiFutures.immediateFuture(mockSessionSnapshot));
+    when(mockSessionSnapshot.getString(FirestoreSessionService.CREATE_TOKEN_KEY))
+        .thenAnswer(
+            unused -> sessionDataCaptor.getValue().get(FirestoreSessionService.CREATE_TOKEN_KEY));
+
+    // Ac
```

---

### Incident Patch 12: `650e9509` (2026-09-25)
**Commit Message**: fix: make Java session appends on the Kotlin engine update the caller's session in place

PiperOrigin-RevId: 988234763

**File**: `tokt/src/main/kotlin/com/google/adk/tokt/codecs/KtToJavaCodecs.kt` (modified, +13/-8)
```diff
@@ -25,6 +25,7 @@ import com.google.adk.kt.sessions.SessionKey as KtSessionKey
 import com.google.adk.kt.sessions.State as KtState
 import com.google.adk.sessions.Session as JavaSession
 import com.google.adk.sessions.State as JavaState
+import java.util.AbstractList
 import java.util.AbstractMap
 import java.util.Optional
 import java.util.concurrent.ConcurrentMap
@@ -238,9 +239,9 @@ private class KtStateAsJavaConcurrentMap(private val state: KtState) : Concurren
 /**
  * Like [ktSessionToJava] but backs the session with live views: `events()` and `state()` convert on
  * access, so an adapted Java flow always reads the current session, including changes made earlier
- * this turn. `events()` is read-only (the Kotlin runner owns the list) and re-converts each element
- * on access, since a Kotlin event's actions are mutable; copy the list once rather than indexing it
- * in a loop. `lastUpdateTime` is a snapshot, not live.
+ * this turn. `events()` allows appending but no other mutation, and it re-converts each element on
+ * access because a Kotlin event's actions are mutable; copy the list once instead of indexing it in
+ * a loop. `lastUpdateTime` is a snapshot, not live.
  */
 // eventsView is deprecated for application code, but an interop adapter is its intended caller.
 @Suppress("DEPRECATION")
@@ -249,18 +250,22 @@ internal fun ktSessionToJavaLive(session: KtSession): JavaSession =
     .appName(session.key.appName)
     .userId(session.key.userId)
     .state(JavaState(KtStateAsJavaConcurrentMap(session.state)))
-    .eventsView(KtBackedEventsView(session))
+    .eventsView(KtBackedEventsMutableView(session))
     .lastUpdateTime(session.lastUpdateTime.toJavaInstant())
     .build()
 
 /**
- * The read-only, converting `events()` of [ktSessionToJavaLive]. Named rather than anonymous so a
- * caller holding a Java [JavaSession] can tell a live view from a snapshot: this one is already
- * backed by the Kotlin session, so it must not be mirrored into (and would throw if tried).
+ * The converting `events()` list for [ktSessionToJavaLive]. Its `add` method appends to the Kotlin
+ * [session] so in-place updates from an ADK Java session service reach the running session, while
+ * `KtSessionServiceToJava.appendEvent` unwraps this view to append there directly. Mutations other
+ * than appending throw [UnsupportedOperationException].
  */
-internal class KtBackedEventsView(private val session: KtSession) : AbstractList<JavaEvent>() {
+internal class KtBackedEventsMutableView(internal val session: KtSession) :
+  AbstractList<JavaEvent>() {
   override val size: Int
     get() = session.events.size
 
   override fun get(index: Int): JavaEvent = EventCodec.toJava(session.events[index])
+
+  override fun add(element: JavaEvent): Boolean = session.events.add(EventCodec.fromJava(element))
 }
```

**File**: `tokt/src/main/kotlin/com/google/adk/tokt/codecs/SessionCodec.kt` (modified, +3/-1)
```diff
@@ -20,6 +20,7 @@ import com.google.adk.kt.sessions.Session as KtSession
 import com.google.adk.kt.sessions.SessionKey
 import com.google.adk.kt.sessions.State
 import com.google.adk.sessions.Session as JavaSession
+import java.util.concurrent.CopyOnWriteArrayList
 import kotlin.time.toKotlinInstant
 
 /** Converts a Java session (key, state, and event history) to the Kotlin [KtSession]. */
@@ -30,7 +31,8 @@ internal object SessionCodec {
       key = SessionKey(appName = session.appName(), userId = session.userId(), id = session.id()),
       // Translate the Java removal sentinel so no foreign sentinel leaks into the Kotlin state.
       state = State(initialState = session.state().mapValues { stateValueFromJava(it.value) }),
-      events = session.events().map { EventCodec.fromJava(it) }.toMutableList(),
+      // Thread-safe like a Kotlin Session's default: parallel tool calls may append during reads.
+      events = CopyOnWriteArrayList(session.events().map { EventCodec.fromJava(it) }),
       lastUpdateTime = (session.lastUpdateTime() ?: java.time.Instant.EPOCH).toKotlinInstant(),
     )
 }
```

**File**: `tokt/src/main/kotlin/com/google/adk/tokt/services/KtSessionServiceToJava.kt` (modified, +32/-27)
```diff
@@ -25,8 +25,9 @@ import com.google.adk.sessions.GetSessionConfig as JavaGetSessionConfig
 import com.google.adk.sessions.ListEventsResponse as JavaListEventsResponse
 import com.google.adk.sessions.ListSessionsResponse as JavaListSessionsResponse
 import com.google.adk.sessions.Session as JavaSession
+import com.google.adk.sessions.State as JavaState
 import com.google.adk.tokt.codecs.EventCodec
-import com.google.adk.tokt.codecs.KtBackedEventsView
+import com.google.adk.tokt.codecs.KtBackedEventsMutableView
 import com.google.adk.tokt.codecs.SessionCodec
 import com.google.adk.tokt.codecs.ktSessionToJava
 import io.reactivex.rxjava3.core.Completable
@@ -103,39 +104,43 @@ internal class KtSessionServiceToJava(
     }
 
   /**
-   * Appends [event] to [session] on the Kotlin service, then mirrors its stored session (merged
-   * state, events, and last-update time) back into the caller's Java [session] so ADK Java's
-   * `Runner` keeps observing the appended state in place.
+   * Appends [event] on the Kotlin service. For a live view ([KtBackedEventsMutableView]), the
+   * service appends directly to the running Kotlin session, keeping that session's `lastUpdateTime`
+   * in step with the store; any other [session] is updated in place by
+   * [JavaBaseSessionService.appendEvent], plus the `temp:` state it skips. In both cases,
+   * [session]'s `lastUpdateTime` is refreshed from the Kotlin session the service updated.
    */
   override fun appendEvent(session: JavaSession, event: JavaEvent): Single<JavaEvent> =
     rxSingle(dispatcher) {
-      val key = SessionKey(session.appName(), session.userId(), session.id())
-      service.appendEvent(SessionCodec.fromJava(session), EventCodec.fromJava(event))
-      service.getSession(key)?.let { stored ->
-        // Convert before touching the caller's session, then refill under the list's monitor so a
-        // concurrent reader never observes a transiently-empty event list. Session.events() is a
-        // Collections.synchronizedList, so its own monitor is the correct lock to hold here.
-        // Mirror only into a session we can actually write. The live view this module hands out
-        // (ktSessionToJavaLive, e.g. invocationContext.session()) is already backed by the Kotlin
-        // session: its events() is a read-only converting view that throws on clear/addAll, and
-        // its state() writes straight through, so it needs no mirroring and must not be mutated
-        // here. A plain snapshot session (ktSessionToJava) does.
-        if (session.events() is MutableList<*> && session.events() !is KtBackedEventsView) {
-          val storedEvents = stored.events.map { EventCodec.toJava(it) }
-          synchronized(session.events()) {
-            session.events().clear()
-            session.events().addAll(storedEvents)
-          }
-          // No lock: State is a ConcurrentMap, so readers never take this monitor. Drop stale keys
-          // and overwrite in place, leaving no transiently-empty window.
-          session.state().keys.retainAll(stored.state.keys)
-          session.state().putAll(stored.state)
-        }
-        session.lastUpdateTime(stored.lastUpdateTime.toJavaInstant())
+      // ADK base session services ignore partial events, so the in-place update must too.
+      if (event.partial().getOrNull() == true) return@rxSingle event
+      val backing = (session.events() as? KtBackedEventsMutableView)?.session
+      val ktSession = backing ?: SessionCodec.fromJava(session)
+      service.appendEvent(ktSession, EventCodec.fromJava(event))
+      if (backing == null) {
+        super.appendEvent(session, event)
+        applyTempState(session, event)
       }
+      session.lastUpdateTime(ktSession.lastUpdateTime.toJavaInstant())
       event
     }
 
+  /**
+   * Applies [event]'s `temp:` state to [session] the way Kotlin's `State.applyTempDelta` does for a
+   * Kotlin session, since the Java base skips it.
+   */
+  private fun applyTempState(session: JavaSession, event: JavaEvent) {
+    val delta = event.actions()?.stateDelta() ?: return
+    for ((key, value) in delta) {
+      if (!key.startsWith(JavaState.TEMP_PREFIX)) continue
+      if (value === JavaState.REMOVED) {
+        session.state().remove(key)
+      } else {
+        session.state()[key] = value
+      }
+    }
+  }
+
   private fun JavaGetSessionConfig.toKotlin(): KtGetSessionConfig =
     KtGetSessionConfig(
       numRecentEvents = numRecentEvents().getOrNull(),
```

**File**: `tokt/src/test/kotlin/com/google/adk/tokt/KtRunnerInteropTest.kt` (modified, +394/-8)
```diff
@@ -96,6 +96,7 @@ import com.google.adk.tokt.adapters.reconcileActionsToKt
 import com.google.adk.tokt.codecs.EventCodec
 import com.google.adk.tokt.codecs.FunctionDeclarationCodec
 import com.google.adk.tokt.codecs.GroundingMetadataCodec
+import com.google.adk.tokt.codecs.KtBackedEventsMutableView
 import com.google.adk.tokt.codecs.KtEventActionsToJavaView
 import com.google.adk.tokt.codecs.PartCodec
 import com.google.adk.tokt.codecs.RunConfigCodec
@@ -139,6 +140,7 @@ import io.reactivex.rxjava3.core.Completable
 import io.reactivex.rxjava3.core.Flowable
 import io.reactivex.rxjava3.core.Maybe
 import io.reactivex.rxjava3.core.Single
+import java.time.Instant
 import java.util.Optional
 import java.util.concurrent.ConcurrentHashMap
 import java.util.concurrent.ConcurrentMap
@@ -3253,8 +3255,7 @@ class KtRunnerInteropTest {
           observed["keys"] = artifacts.listArtifactKeys("app", "u", "s").blockingGet().filenames()
           observed["versions"] = artifacts.listVersions("app", "u", "s", "note.txt").blockingGet()
 
-          // KtSessionServiceToJava: getSession, then appendEvent, whose store-mirroring is the
-          // most intricate method in the module.
+          // KtSessionServiceToJava: getSession, then appendEvent on that snapshot.
           val javaSession = sessions.getSession("app", "u", "s", Optional.empty()).blockingGet()!!
           val eventsBefore = javaSession.events().size
           val appended =
@@ -3270,7 +3271,7 @@ class KtRunnerInteropTest {
               )
               .blockingGet()
           observed["appended_author"] = appended.author()
-          // appendEvent mirrors the Kotlin store back into this very Java session object.
+          // appendEvent mutates the caller's Java session in place.
           observed["events_grew"] = javaSession.events().size > eventsBefore
           observed["sessions"] = sessions.listSessions("app", "u").blockingGet().sessions().size
 
@@ -3302,15 +3303,400 @@ class KtRunnerInteropTest {
     assertEquals("v1", observed["loaded"], "load must return what save stored")
     assertEquals(listOf("note.txt"), observed["keys"], "listArtifactKeys")
     assertEquals(listOf(0), observed["versions"], "listVersions")
-    assertEquals(
-      true,
-      observed["events_grew"],
-      "appendEvent must mirror the store into the session",
-    )
+    assertEquals(true, observed["events_grew"], "appendEvent must update the session in place")
     assertEquals(1, observed["sessions"], "listSessions")
     assertEquals(1, observed["memories"], "searchMemory should hit the appended text")
   }
 
+  /**
+   * Java tool that appends a note through `ic.sessionService()` with `ic.session()` and records
+   * what that live session reflects immediately after the append.
+   */
+  private class AppendNoteJavaTool(name: String = "append_note") :
+    JavaBaseTool(name, "appends a note through the live session") {
+    val observed = ConcurrentHashMap<String, Any>()
+
+    override fun declaration(): Optional<GenaiFunctionDeclaration> =
+      Optional.of(GenaiFunctionDeclaration.builder().name(name()).build())
+
+    @JvmSuppressWildcards
+    override fun runAsync(
+      args: Map<String, Any>,
+      toolContext: JavaToolContext,
+    ): Single<Map<String, Any>> {
+      val ic = toolContext.invocationContext()
+      val live = ic.session()
+      val before = live.events().size
+      // Pick a time after anything in the session, so a lastUpdateTime refresh is observable.
+      val eventTime = live.lastUpdateTime().plusSeconds(1)
+      val unused =
+        ic
+          .sessionService()
+          .appendEvent(
+            live,
+            JavaEvent.builder()
+              .id(JavaEvent.generateEventId())
+              .invocationId(ic.invocationId())
+              .author(name())
+              .timestamp(eventTime.toEpochMilli())
+              .content(GenaiContent.fromParts(GenaiPart.fromText("appended note")))
+              .actions(
+                JavaEventActions.builder()
+                  .stateDelta(mutableMapOf<String, Any>("note" to "kept", "temp:scratch" to "t"))
+                  .build()
+              )
+              .build(),
+          )
+          .blockingGet()
+      observed["grew_by"] = live.events().size - before
+      observed["note"] = live.state()["note"] ?: "MISSING"
+      observed["temp"] = live.state()["temp:scratch"] ?: "MISSING"
+      observed["event_time"] = eventTime
+      observed["last_update_time"] = live.lastUpdateTime()
+      return Single.just(mapOf("ok" to true))
+    }
+  }
+
+  private fun appendNoteAgent(tool: AppendNoteJavaTool) =
+    KtLlmAgent(
+      name = "a",
+      model =
+        JavaAdkToKt.asKtModel(
+          SequentialJavaModel(listOf(modelFunctionCall(tool.name(), emptyMap()), modelText("done")))
+        ),
+      tools = listOf(JavaAdkToKt.asKtTool(tool)),
+    )
+
+  @Test
+  fun ktRunner_javaToolAppendsThroughItsLiveSession_invocationSeesTheEvent() = runBlo
```

---

### Incident Patch 13: `f7d7a7ca` (2026-09-25)
**Commit Message**: fix(dev): ignore an unusable adk.web.backend-url instead of serving it

A value the dev UI cannot use - one with no scheme, no host, credentials, a
query or a fragment - was still reported in `runtime-config.json`, so whatever
it contained reached the browser while the UI carried on using the bundled
address. Such a value is now ignored entirely, with a warning that names the
fault and not the value, and the bundled `backendUrl` stands as if the property
were unset. A usable value behaves as before.

PiperOrigin-RevId: 988136791

**File**: `dev/README.md` (modified, +9/-7)
```diff
@@ -17,20 +17,22 @@ example, forwarding `https://gateway.example.com/my-app/` to `/`), set
 adk.web.backend-url=https://gateway.example.com/my-app
 ```
 
-Setting `adk.web.backend-url`:
+Setting a usable `adk.web.backend-url`:
 
 -   Sets `backendUrl` in `/dev-ui/assets/config/runtime-config.json` so the UI
     sends API and WebSocket requests through the proxy URL.
 -   Prepends the URL's path (`/my-app`) to the `/` and `/dev-ui` entry redirects
     (`/my-app/dev-ui/`).
 
 The value must be an absolute `http://` or `https://` URL without credentials,
-query parameters, or a fragment. The UI parses values without an `http://` or
-`https://` scheme as a WebSocket host, so a relative path like `/my-app` cannot
-be used. If the application also sets `server.servlet.context-path`, include it
-in `adk.web.backend-url`; when `adk.web.backend-url` has a path prefix, the
-redirect uses that path directly instead of prepending the context path or
-`X-Forwarded-Prefix`.
+query parameters, or a fragment. A value that does not meet those constraints is
+ignored with a warning: it is neither served nor used as a redirect prefix, so
+the bundled `backendUrl` stands exactly as when the property is unset. The UI
+parses values without an `http://` or `https://` scheme as a WebSocket host, so
+a relative path like `/my-app` cannot be used. If the application also sets
+`server.servlet.context-path`, include it in `adk.web.backend-url`; when
+`adk.web.backend-url` has a path prefix, the redirect uses that path directly
+instead of prepending the context path or `X-Forwarded-Prefix`.
 
 When `adk.web.backend-url` is unset, `/` and `/dev-ui` redirect to `/dev-ui/`
 and the bundled `backendUrl` value is preserved. If you instead enable
```

**File**: `dev/src/main/java/com/google/adk/web/AdkWebServer.java` (modified, +4/-4)
```diff
@@ -136,10 +136,10 @@ public void addResourceHandlers(ResourceHandlerRegistry registry) {
 
   /**
    * Configures simple automated controllers: "/" and "/dev-ui" both redirect to the UI, at {@code
-   * adk.web.backend-url}'s path when that is set, and it forwards to index.html. The trailing slash
-   * is required: index.html declares a {@code <base href="./">}, so served from "/dev-ui" the app
-   * resolves its own router path to "dev-ui" and matches none of its routes. The query string is
-   * carried across because the UI selects its agent from {@code ?app=}.
+   * adk.web.backend-url}'s path when a usable value is set, and it forwards to index.html. The
+   * trailing slash is required: index.html declares a {@code <base href="./">}, so served from
+   * "/dev-ui" the app resolves its own router path to "dev-ui" and matches none of its routes. The
+   * query string is carried across because the UI selects its agent from {@code ?app=}.
    */
   @Override
   public void addViewControllers(ViewControllerRegistry registry) {
```

**File**: `dev/src/main/java/com/google/adk/web/config/BackendUrl.java` (modified, +8/-14)
```diff
@@ -43,8 +43,9 @@ private BackendUrl(String value, String pathPrefix) {
   }
 
   /**
-   * Parses {@code configured}. If the URL cannot be used by the dev UI, logs a warning, retains the
-   * trimmed value for {@code runtime-config.json}, and sets {@link #pathPrefix()} to empty.
+   * Parses {@code configured}. A URL the dev UI cannot use is ignored entirely, with a warning: it
+   * is neither served nor used as a prefix, so the bundled {@code backendUrl} stands. Serving it
+   * would publish whatever it contains, credentials included, to every browser.
    */
   public static BackendUrl from(@Nullable String configured) {
     String trimmed = Strings.nullToEmpty(configured).trim();
@@ -58,21 +59,18 @@ public static BackendUrl from(@Nullable String configured) {
     if (fault == null) {
       return new BackendUrl(normalized, pathPrefixOf(uri));
     }
-    log.warn(
-        "adk.web.backend-url \"{}\" is not usable ({}), so the dev UI's redirect carries no"
-            + " prefix.",
-        withoutCredentials(trimmed),
-        fault);
-    return new BackendUrl(trimmed, "");
+    // The value is not echoed: it can carry credentials, and the operator set it themselves.
+    log.warn("adk.web.backend-url is ignored because {}.", fault);
+    return UNSET;
   }
 
-  /** Returns the URL string to report in {@code runtime-config.json}, or empty when unset. */
+  /** Returns the URL to report in {@code runtime-config.json}, or empty when unset or ignored. */
   public String value() {
     return value;
   }
 
   /**
-   * Returns the URL path prefix to prepend to the entry redirect, or empty if unset or unusable.
+   * Returns the URL path prefix to prepend to the entry redirect, or empty if unset or ignored.
    * Preserves raw percent-encoding for use in a {@code Location} header.
    */
   public String pathPrefix() {
@@ -117,8 +115,4 @@ private static String pathPrefixOf(URI uri) {
     // Collapse leading slashes so "//segment" cannot be interpreted as a protocol-relative host.
     return CharMatcher.is('/').trimTrailingFrom(raw.replaceAll("^/+", "/"));
   }
-
-  private static String withoutCredentials(String value) {
-    return value.replaceFirst("(?<=//)[^/@]*@", "***@");
-  }
 }
```

**File**: `dev/src/test/java/com/google/adk/web/config/BackendUrlTest.java` (modified, +35/-20)
```diff
@@ -102,32 +102,47 @@ public void unusableValue_suppliesNoPrefix() {
   }
 
   @Test
-  public void credentials_areNotLogged() {
-    String warning = warningsFor("https://user:pass@gw.example.com/my-app").get(0);
+  public void theValueIsNeverLogged() {
+    // Redacting userinfo was not enough: a query, or a "@" in the password, survived the mask.
+    for (String in :
+        new String[] {
+          "https://user:pass@gw.example.com/my-app",
+          "https://user:p@ss/word@gw.example.com/my-app",
+          "https://gw.example.com/my-app?token=sekrit"
+        }) {
+      assertThat(warningsFor(in)).hasSize(1);
+      String warning = warningsFor(in).get(0);
 
-    assertThat(warning).doesNotContain("pass");
-    assertThat(warning).contains("***@gw.example.com");
+      assertThat(warning).doesNotContain("pass");
+      assertThat(warning).doesNotContain("sekrit");
+      assertThat(warning).doesNotContain(in);
+      // The old mask kept the host, so without this two of these three inputs pinned nothing.
+      assertThat(warning).doesNotContain("gw.example.com");
+    }
   }
 
   @Test
-  public void unusableValue_isStillServedButWarns() {
-    // Never silently discarded, because it is an explicit setting.
-    assertThat(BackendUrl.from("/my-app").value()).isEqualTo("/my-app");
-    assertThat(BackendUrl.from("HTTPS://gw.example.com/x").value())
-        .isEqualTo("HTTPS://gw.example.com/x");
-    assertThat(BackendUrl.from("http://").value()).isEqualTo("http://");
+  public void credentials_areNeverServed() {
+    // Served, this would put the password in runtime-config.json for every browser.
+    BackendUrl url = BackendUrl.from("https://user:pass@gw.example.com/my-app");
 
-    assertThat(warningsFor("/my-app")).hasSize(1);
-    assertThat(warningsFor("/my-app").get(0)).contains("/my-app");
-    assertThat(warningsFor("HTTPS://gw.example.com/x")).hasSize(1);
-    assertThat(warningsFor("http://")).hasSize(1);
+    assertThat(url.value()).isEmpty();
+    assertThat(url.pathPrefix()).isEmpty();
+  }
+
+  @Test
+  public void unusableValue_isIgnoredEntirelyButWarns() {
+    // Not served and not prefixed, so the bundled backendUrl stands.
+    for (String in : new String[] {"/my-app", "HTTPS://gw.example.com/x", "http://"}) {
+      assertThat(BackendUrl.from(in).value()).isEmpty();
+      assertThat(warningsFor(in)).hasSize(1);
+    }
   }
 
   @Test
-  public void slashOnly_isNotEmptiedByTheSlashTrim() {
-    // Emptying this would make the served value fall back to whatever the bundled config says,
-    // silently losing an explicit setting.
-    assertThat(BackendUrl.from("/").value()).isEqualTo("/");
+  public void slashOnly_isIgnored() {
+    // "/" trims to empty, and is not a usable backend URL either way.
+    assertThat(BackendUrl.from("/").value()).isEmpty();
     assertThat(BackendUrl.from("/").pathPrefix()).isEmpty();
   }
 
@@ -153,10 +168,10 @@ public void valueWithoutALeadingSlashPath_yieldsNoPrefix() {
   }
 
   @Test
-  public void unparseableValue_yieldsNoPrefixAndWarns() {
+  public void unparseableValue_isIgnoredAndWarns() {
     String malformed = "https://gw.example.com/my app";
 
-    assertThat(BackendUrl.from(malformed).value()).isEqualTo(malformed);
+    assertThat(BackendUrl.from(malformed).value()).isEmpty();
     assertThat(BackendUrl.from(malformed).pathPrefix()).isEmpty();
     assertThat(warningsFor(malformed)).hasSize(1);
     assertThat(warningsFor(malformed).get(0)).contains("not a valid URI");
```

**File**: `dev/src/test/java/com/google/adk/web/controller/RuntimeConfigControllerTest.java` (modified, +19/-0)
```diff
@@ -16,6 +16,8 @@
 
 package com.google.adk.web.controller;
 
+import static org.hamcrest.Matchers.containsString;
+import static org.hamcrest.Matchers.not;
 import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
 import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
 import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
@@ -72,6 +74,23 @@ public void runtimeConfig_forwardedHeaders_shouldNotChangeTheValue(@Autowired Mo
     }
   }
 
+  @Nested
+  @SpringBootTest(properties = "adk.web.backend-url=https://user:hunter2@gw.example.com/my-app")
+  @AutoConfigureMockMvc
+  class ConfiguredWithCredentials {
+
+    @Test
+    public void runtimeConfig_shouldNotServeTheCredentials(@Autowired MockMvc mockMvc)
+        throws Exception {
+      // This document goes to every browser that loads the UI.
+      mockMvc
+          .perform(get(CONFIG))
+          .andExpect(status().isOk())
+          .andExpect(content().string(not(containsString("hunter2"))))
+          .andExpect(jsonPath("$.backendUrl").value(""));
+    }
+  }
+
   @Nested
   @SpringBootTest
   @AutoConfigureMockMvc
```

---

### Incident Patch 14: `1afd8395` (2026-09-25)
**Commit Message**: docs: fix inaccuracies in the tokt interop KDoc

PiperOrigin-RevId: 988100353

**File**: `tokt/src/main/kotlin/com/google/adk/tokt/JavaAdkToKt.kt` (modified, +29/-27)
```diff
@@ -41,32 +41,32 @@ import kotlinx.coroutines.CoroutineDispatcher
 
 /**
  * Forward interop entry point: adapts ADK Java tools, toolsets, plugins, services, and models so
- * they can run on the ADK Kotlin engine. Wrap the adapted pieces in a Kotlin `LlmAgent`; this does
- * not convert a whole Java agent.
+ * they can run on the ADK Kotlin engine. Assemble the adapted pieces into a Kotlin `LlmAgent`,
+ * `App`, and `Runner`; this does not convert a whole Java agent.
  *
  * An adapted component behaves as it does on ADK Java. It sees the session as it currently stands,
  * including events and state written earlier in the same turn, and its state, artifact and
- * control-flow writes reach the engine. Blocking work is fine: calls are dispatched off the thread
- * driving the agent, onto the optional `dispatcher` (default `Dispatchers.IO`) each conversion
- * accepts. That dispatcher must be able to run nested bridged calls concurrently -- a bridged tool
- * or plugin that itself makes a blocking bridged call (e.g. one that blocks on a bridged service)
- * holds its thread until that call returns, so a single-threaded or tightly bounded dispatcher can
- * deadlock; the default `Dispatchers.IO` grows its pool and avoids this.
+ * control-flow writes reach the engine. Blocking work is fine because calls run on the optional
+ * `dispatcher` (default `Dispatchers.IO`) that each conversion accepts. That dispatcher must be
+ * able to run nested bridged calls in parallel: a bridged tool or plugin that blocks on another
+ * bridged call, such as a service call, holds its thread until that call returns, so a
+ * single-threaded or tightly bounded dispatcher can deadlock. `Dispatchers.IO` deadlocks only if
+ * all of its threads (at least 64 by default) block at once.
  *
  * A bridged plugin's error callbacks fire: `onRunErrorCallback` is notification-only -- the engine
  * re-raises the run's error to the caller afterwards regardless, so it cannot recover the run (it
  * is for logging, telemetry, or cleanup) -- while the `onModelErrorCallback` and
  * `onToolErrorCallback` recovery hooks fire and can recover.
  *
- * The interop surfaces a signal the engine cannot honor rather than silently dropping it:
- * - Setting `branch` on a bridged context throws. The branch is the engine's to set.
- * - A bridged tool's or plugin's `requestedAuthConfigs` or `deletedArtifactIds` write throws - the
- *   engine's event actions have no equivalent. Its `skipSummarization`,
- *   `requestedToolConfirmations` and `agentState` writes do cross, from a tool and a plugin alike.
- * - Behind an adapted Java session service ([asKtSessionService]), a resumable workflow's engine
- *   state (`EventActions.agentState`) crosses and is restored, so it resumes rather than restarts.
- *   A rewind request (`rewindBeforeInvocationId`) still does not cross - ADK Java's `EventActions`
- *   has no such field.
+ * When a bridged tool call or plugin callback writes one of the following signals to its context,
+ * the interop throws rather than silently dropping it:
+ * - Setting `branch` on the invocation context throws. The branch is the engine's to set.
+ * - If Java code writes `requestedAuthConfigs` or `deletedArtifactIds` to the context's
+ *   `EventActions`, the adapter throws once the Java call returns - the engine's event actions have
+ *   no equivalent.
+ *
+ * Writes to the context's `skipSummarization`, `requestedToolConfirmations`, and `agentState` do
+ * cross to the engine.
  */
 object JavaAdkToKt {
 
@@ -79,7 +79,7 @@ object JavaAdkToKt {
   ): KtBaseTool = JavaToolToKt(javaTool, dispatcher)
 
   /**
-   * Adapts a whole collection of ADK Java tools (e.g. an `LlmAgent`'s `tools`), each on
+   * Adapts a whole collection of ADK Java tools (such as an `LlmAgent`'s `tools`), each on
    * `dispatcher`. Kept alongside [asKtTool] for Java callers, who would otherwise write
    * `stream().map(...).toList()`.
    */
@@ -115,7 +115,7 @@ object JavaAdkToKt {
   ): KtPlugin = JavaPluginToKt(javaPlugin, dispatcher)
 
   /**
-   * Adapts a whole collection of ADK Java plugins (e.g. a `Runner`'s `plugins`), each on
+   * Adapts a whole collection of ADK Java plugins (such as an `App`'s `plugins()`), each on
    * `dispatcher`.
    */
   @JvmStatic
@@ -137,9 +137,11 @@ object JavaAdkToKt {
   ): KtModel = JavaModelToKt(javaLlm, dispatcher)
 
   /**
-   * Adapts an ADK Java session service for the Kotlin engine, unwrapping a round-tripped Kotlin one
-   * rather than stacking a second adapter. Its calls run on `dispatcher`. A
-   * `rewindBeforeInvocationId` does not survive, since ADK Java has no such field.
+   * Adapts an ADK Java session service for the Kotlin engine, running its calls on `dispatcher`. A
+   * Java view of a Kotlin service is unwrapped to that Kotlin service, with no `dispatcher` hop.
+   * Resumption works across the adapter (`EventActions.agentState` crosses), but a rewind reverts
+   * only state and artifacts: ADK J
```

**File**: `tokt/src/main/kotlin/com/google/adk/tokt/KotlinAdkToJava.kt` (modified, +9/-9)
```diff
@@ -21,19 +21,19 @@ import com.google.adk.runner.Runner as JavaRunner
 import kotlinx.coroutines.CoroutineDispatcher
 
 /**
- * Reverse interop entry point: exposes an ADK Kotlin-engine [KtRunner] through the ADK Java
- * [JavaRunner] surface, so it can be injected into code written against the Java runner. The
- * returned runner is a real [JavaRunner] whose `runAsync` streams `Event`s backed by the Kotlin
- * engine; live mode is not bridged. The forward direction (Java components onto the Kotlin engine)
- * lives in [com.google.adk.tokt.JavaAdkToKt].
+ * Reverse interop entry point: [asJavaRunner] wraps an ADK Kotlin-engine `Runner` in a real ADK
+ * Java `Runner`, so it can be injected into code written against the Java runner. The wrapper's
+ * `runAsync` streams `Event`s backed by the Kotlin engine; live mode is not bridged. The forward
+ * direction (Java components onto the Kotlin engine) lives in [com.google.adk.tokt.JavaAdkToKt].
  */
 object KotlinAdkToJava {
 
   /**
-   * Exposes a Kotlin-engine [runner] as an ADK Java [JavaRunner]. Its reverse service adapters
-   * bridge the Java RxJava calls onto the Kotlin engine via `dispatcher` (default
-   * `Dispatchers.IO`), which must be able to run nested bridged calls concurrently, so a
-   * single-threaded or tightly bounded dispatcher can deadlock.
+   * Exposes a Kotlin-engine [runner] as an ADK Java `Runner`. Its reverse service adapters bridge
+   * RxJava calls onto the Kotlin engine via `dispatcher` (default `Dispatchers.IO`). That
+   * dispatcher must be able to run nested bridged calls in parallel: if code on one of its threads
+   * (such as a bridged call's RxJava callback) blocks on another bridged call, it holds that thread
+   * until the second call returns, so a single-threaded or tightly bounded dispatcher can deadlock.
    */
   @JvmStatic
   @JvmOverloads
```

---

### Incident Patch 15: `2c5bd9e8` (2026-09-24)
**Commit Message**: fix(dev): let the dev UI's public address be configured

Behind a gateway that strips a path prefix, the Development UI's own API calls
went to the origin root, because the bundled `runtime-config.json` ships an
empty `backendUrl` with no way to change it.

`adk.web.backend-url` now names the address browsers reach the server on. It
sets that value and prefixes the entry redirect, so both halves work without
anything being forwarded by the proxy. It must be an absolute URL, because the
UI reads a value without a scheme as the host of its live connection. Left
unset, nothing changes.

PiperOrigin-RevId: 987711552

**File**: `dev/README.md` (modified, +31/-0)
```diff
@@ -6,3 +6,34 @@ The UI and its assets are served under `/dev-ui/`, and both `/` and `/dev-ui`
 redirect there, keeping the query string. The assets are not served from the
 origin root: `/adk_favicon.svg` and the like return 404, and only the `/dev-ui/`
 form resolves.
+
+## Behind a reverse proxy
+
+If the server runs behind a reverse proxy that strips a path prefix (for
+example, forwarding `https://gateway.example.com/my-app/` to `/`), set
+`adk.web.backend-url` to the external URL that browsers use to reach the server:
+
+```properties
+adk.web.backend-url=https://gateway.example.com/my-app
+```
+
+Setting `adk.web.backend-url`:
+
+-   Sets `backendUrl` in `/dev-ui/assets/config/runtime-config.json` so the UI
+    sends API and WebSocket requests through the proxy URL.
+-   Prepends the URL's path (`/my-app`) to the `/` and `/dev-ui` entry redirects
+    (`/my-app/dev-ui/`).
+
+The value must be an absolute `http://` or `https://` URL without credentials,
+query parameters, or a fragment. The UI parses values without an `http://` or
+`https://` scheme as a WebSocket host, so a relative path like `/my-app` cannot
+be used. If the application also sets `server.servlet.context-path`, include it
+in `adk.web.backend-url`; when `adk.web.backend-url` has a path prefix, the
+redirect uses that path directly instead of prepending the context path or
+`X-Forwarded-Prefix`.
+
+When `adk.web.backend-url` is unset, `/` and `/dev-ui` redirect to `/dev-ui/`
+and the bundled `backendUrl` value is preserved. If you instead enable
+`server.forward-headers-strategy=framework`, make sure your reverse proxy strips
+or overwrites incoming `Forwarded` and `X-Forwarded-*` headers from untrusted
+clients.
```

**File**: `dev/src/main/java/com/google/adk/web/AdkWebServer.java` (modified, +26/-8)
```diff
@@ -25,6 +25,7 @@
 import com.google.adk.memory.InMemoryMemoryService;
 import com.google.adk.sessions.BaseSessionService;
 import com.google.adk.sessions.InMemorySessionService;
+import com.google.adk.web.config.BackendUrl;
 import com.google.adk.web.config.DevUiAssets;
 import org.slf4j.Logger;
 import org.slf4j.LoggerFactory;
@@ -52,6 +53,15 @@ public class AdkWebServer implements WebMvcConfigurer {
   @Value("${adk.web.ui.dir:#{null}}")
   private String webUiDir;
 
+  @Value("${adk.web.backend-url:}")
+  private String backendUrlProperty;
+
+  /** One bean, so this and the runtime-config endpoint cannot read the property differently. */
+  @Bean
+  public BackendUrl backendUrl() {
+    return BackendUrl.from(backendUrlProperty);
+  }
+
   @Bean
   public BaseSessionService sessionService() {
     // TODO: Add logic to select service based on config (e.g., DB URL)
@@ -125,17 +135,25 @@ public void addResourceHandlers(ResourceHandlerRegistry registry) {
   }
 
   /**
-   * Configures simple automated controllers: "/" and "/dev-ui" both redirect to "/dev-ui/", which
-   * forwards to the UI's index.html. The trailing slash is required: index.html declares a {@code
-   * <base href="./">}, so served from "/dev-ui" the app resolves its own router path to "dev-ui"
-   * and matches none of its routes. The query string is carried across because the UI selects its
-   * agent from {@code ?app=} and the sample READMEs send users to the slashless "/dev-ui", so a
-   * redirect that dropped it would silently ignore the selection.
+   * Configures simple automated controllers: "/" and "/dev-ui" both redirect to the UI, at {@code
+   * adk.web.backend-url}'s path when that is set, and it forwards to index.html. The trailing slash
+   * is required: index.html declares a {@code <base href="./">}, so served from "/dev-ui" the app
+   * resolves its own router path to "dev-ui" and matches none of its routes. The query string is
+   * carried across because the UI selects its agent from {@code ?app=}.
    */
   @Override
   public void addViewControllers(ViewControllerRegistry registry) {
-    registry.addRedirectViewController("/", "/dev-ui/").setKeepQueryParams(true);
-    registry.addRedirectViewController("/dev-ui", "/dev-ui/").setKeepQueryParams(true);
+    String prefix = backendUrl().pathPrefix();
+    // The configured value is the public base, so do not stack the context path on it.
+    boolean contextRelative = prefix.isEmpty();
+    registry
+        .addRedirectViewController("/", prefix + "/dev-ui/")
+        .setKeepQueryParams(true)
+        .setContextRelative(contextRelative);
+    registry
+        .addRedirectViewController("/dev-ui", prefix + "/dev-ui/")
+        .setKeepQueryParams(true)
+        .setContextRelative(contextRelative);
     registry.addViewController("/dev-ui/").setViewName("forward:/dev-ui/index.html");
   }
 
```

**File**: `dev/src/main/java/com/google/adk/web/config/BackendUrl.java` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+/*
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.google.adk.web.config;
+
+import com.google.common.base.CharMatcher;
+import com.google.common.base.Strings;
+import java.net.URI;
+import java.net.URISyntaxException;
+import org.jspecify.annotations.Nullable;
+import org.slf4j.Logger;
+import org.slf4j.LoggerFactory;
+
+/**
+ * Parsed representation of {@code adk.web.backend-url}, shared by the runtime-config endpoint and
+ * the dev UI entry redirects.
+ */
+public final class BackendUrl {
+
+  private static final Logger log = LoggerFactory.getLogger(BackendUrl.class);
+
+  private static final BackendUrl UNSET = new BackendUrl("", "");
+
+  private final String value;
+  private final String pathPrefix;
+
+  private BackendUrl(String value, String pathPrefix) {
+    this.value = value;
+    this.pathPrefix = pathPrefix;
+  }
+
+  /**
+   * Parses {@code configured}. If the URL cannot be used by the dev UI, logs a warning, retains the
+   * trimmed value for {@code runtime-config.json}, and sets {@link #pathPrefix()} to empty.
+   */
+  public static BackendUrl from(@Nullable String configured) {
+    String trimmed = Strings.nullToEmpty(configured).trim();
+    if (trimmed.isEmpty()) {
+      return UNSET;
+    }
+    // Strip trailing slashes because the UI appends paths that already start with "/".
+    String normalized = CharMatcher.is('/').trimTrailingFrom(trimmed);
+    URI uri = parse(normalized);
+    String fault = faultIn(uri);
+    if (fault == null) {
+      return new BackendUrl(normalized, pathPrefixOf(uri));
+    }
+    log.warn(
+        "adk.web.backend-url \"{}\" is not usable ({}), so the dev UI's redirect carries no"
+            + " prefix.",
+        withoutCredentials(trimmed),
+        fault);
+    return new BackendUrl(trimmed, "");
+  }
+
+  /** Returns the URL string to report in {@code runtime-config.json}, or empty when unset. */
+  public String value() {
+    return value;
+  }
+
+  /**
+   * Returns the URL path prefix to prepend to the entry redirect, or empty if unset or unusable.
+   * Preserves raw percent-encoding for use in a {@code Location} header.
+   */
+  public String pathPrefix() {
+    return pathPrefix;
+  }
+
+  private static @Nullable URI parse(String url) {
+    try {
+      return new URI(url);
+    } catch (URISyntaxException e) {
+      return null;
+    }
+  }
+
+  private static @Nullable String faultIn(@Nullable URI uri) {
+    if (uri == null) {
+      return "it is not a valid URI";
+    }
+    // The UI strips "http://" or "https://" case-sensitively when building its WebSocket URL.
+    if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) {
+      return "the scheme must be a lower-case http or https";
+    }
+    if (uri.getHost() == null) {
+      return "it names no host";
+    }
+    if (uri.getRawUserInfo() != null) {
+      return "it carries credentials, which would be served to every client";
+    }
+    // The UI appends request paths directly onto backendUrl, so a query or fragment would corrupt
+    // the resulting URL.
+    if (uri.getRawQuery() != null || uri.getRawFragment() != null) {
+      return "it carries a query or fragment";
+    }
+    return null;
+  }
+
+  private static String pathPrefixOf(URI uri) {
+    String raw = uri.getRawPath();
+    if (raw == null || raw.isEmpty()) {
+      return "";
+    }
+    // Collapse leading slashes so "//segment" cannot be interpreted as a protocol-relative host.
+    return CharMatcher.is('/').trimTrailingFrom(raw.replaceAll("^/+", "/"));
+  }
+
+  private static String withoutCredentials(String value) {
+    return value.replaceFirst("(?<=//)[^/@]*@", "***@");
+  }
+}
```

**File**: `dev/src/main/java/com/google/adk/web/config/DevUiAssets.java` (modified, +11/-2)
```diff
@@ -20,11 +20,15 @@
 import org.springframework.core.io.ResourceLoader;
 
 /**
- * Where the dev UI's static assets live. Normalizes {@code adk.web.ui.dir} into a resource
- * location, so callers that need it do not each do it differently.
+ * Where the dev UI's static assets live. Shared so the resource handler and the runtime-config
+ * endpoint resolve the same location; normalizing {@code adk.web.ui.dir} separately in each would
+ * diverge silently.
  */
 public final class DevUiAssets {
 
+  /** The runtime config, relative to the asset root. */
+  public static final String RUNTIME_CONFIG_PATH = "assets/config/runtime-config.json";
+
   private static final String CLASSPATH_ROOT = ResourceLoader.CLASSPATH_URL_PREFIX + "/browser/";
 
   /**
@@ -42,5 +46,10 @@ public static String assetRoot(@Nullable String webUiDir) {
     return location.endsWith("/") ? location : location + "/";
   }
 
+  /** The location of a single asset, given relative to the asset root. */
+  public static String assetLocation(@Nullable String webUiDir, String relativePath) {
+    return assetRoot(webUiDir) + relativePath;
+  }
+
   private DevUiAssets() {}
 }
```

**File**: `dev/src/main/java/com/google/adk/web/controller/RuntimeConfigController.java` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+/*
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.google.adk.web.controller;
+
+import com.fasterxml.jackson.core.type.TypeReference;
+import com.fasterxml.jackson.databind.ObjectMapper;
+import com.google.adk.web.config.BackendUrl;
+import com.google.adk.web.config.DevUiAssets;
+import java.io.IOException;
+import java.io.InputStream;
+import java.util.LinkedHashMap;
+import java.util.Map;
+import org.jspecify.annotations.Nullable;
+import org.slf4j.Logger;
+import org.slf4j.LoggerFactory;
+import org.springframework.beans.factory.annotation.Autowired;
+import org.springframework.beans.factory.annotation.Value;
+import org.springframework.core.io.Resource;
+import org.springframework.core.io.ResourceLoader;
+import org.springframework.http.CacheControl;
+import org.springframework.http.MediaType;
+import org.springframework.http.ResponseEntity;
+import org.springframework.web.bind.annotation.GetMapping;
+import org.springframework.web.bind.annotation.RestController;
+
+/**
+ * Serves the dev UI's runtime configuration, shadowing the copy bundled in the static assets so
+ * {@code adk.web.backend-url} can point the UI at the address browsers reach this server on. The
+ * bundled document is merged rather than replaced, so keys the UI gains in a later bundle survive.
+ */
+@RestController
+public class RuntimeConfigController {
+
+  private static final Logger log = LoggerFactory.getLogger(RuntimeConfigController.class);
+
+  private final ResourceLoader resourceLoader;
+  private final ObjectMapper objectMapper;
+  private final @Nullable String webUiDir;
+  private final String backendUrl;
+
+  /** Reads the bundled config through {@code resourceLoader}, or from {@code webUiDir} if set. */
+  @Autowired
+  public RuntimeConfigController(
+      ResourceLoader resourceLoader,
+      ObjectMapper objectMapper,
+      @Value("${adk.web.ui.dir:#{null}}") @Nullable String webUiDir,
+      BackendUrl backendUrl) {
+    this.resourceLoader = resourceLoader;
+    this.objectMapper = objectMapper;
+    this.webUiDir = webUiDir;
+    this.backendUrl = backendUrl.value();
+  }
+
+  /** Serves the bundled config with {@code backendUrl} taken from configuration when set. */
+  @GetMapping(
+      value = "/dev-ui/" + DevUiAssets.RUNTIME_CONFIG_PATH,
+      produces = MediaType.APPLICATION_JSON_VALUE)
+  public ResponseEntity<Map<String, Object>> runtimeConfig() {
+    Map<String, Object> config = readBundledConfig();
+    // Unset leaves a value the bundled document already carries, which is what used to be served.
+    if (backendUrl.isEmpty()) {
+      config.putIfAbsent("backendUrl", "");
+    } else {
+      config.put("backendUrl", backendUrl);
+    }
+    // The bundled document can change on disk under adk.web.ui.dir, so do not let it be cached.
+    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(config);
+  }
+
+  /**
+   * Reads the bundled config, returning an empty map if the resource is missing or cannot be parsed
+   * so the endpoint still serves {@code backendUrl}.
+   */
+  private Map<String, Object> readBundledConfig() {
+    Resource resource =
+        resourceLoader.getResource(
+            DevUiAssets.assetLocation(webUiDir, DevUiAssets.RUNTIME_CONFIG_PATH));
+    if (!resource.exists()) {
+      log.debug("No bundled dev UI runtime config at {}; serving backendUrl only.", resource);
+      return new LinkedHashMap<>();
+    }
+    try (InputStream in = resource.getInputStream()) {
+      Map<String, Object> parsed = objectMapper.readValue(in, new TypeReference<>() {});
+      return parsed == null ? new LinkedHashMap<>() : new LinkedHashMap<>(parsed);
+    } catch (IOException e) {
+      log.warn("Could not read the bundled dev UI runtime config at {}.", resource, e);
+      return new LinkedHashMap<>();
+    }
+  }
+}
```

**File**: `dev/src/test/java/com/google/adk/web/AdkWebServerProxyRedirectTest.java` (modified, +4/-8)
```diff
@@ -29,14 +29,10 @@
 import org.springframework.test.web.servlet.MockMvc;
 
 /**
- * Spring's own forwarded-header support keeps working: with {@code
- * server.forward-headers-strategy=framework} the operator opts in, {@code ForwardedHeaderFilter}
- * turns the forwarded prefix into the request's context path, and the redirect picks it up. This
- * server adds nothing here and reads no header itself; the test exists so enabling that Spring
- * feature keeps behaving as it did.
- *
- * <p>The filter honours the standard {@code Forwarded} header as well as {@code X-Forwarded-*}, so
- * both are covered.
+ * Verifies that when {@code adk.web.backend-url} is unset and {@code
+ * server.forward-headers-strategy=framework} is enabled, Spring's {@code ForwardedHeaderFilter}
+ * applies {@code Forwarded} and {@code X-Forwarded-*} headers to the entry redirects. When {@code
+ * adk.web.backend-url} is set, its path prefix takes precedence over {@code X-Forwarded-Prefix}.
  */
 @SpringBootTest(properties = "server.forward-headers-strategy=framework")
 @AutoConfigureMockMvc
```

**File**: `dev/src/test/java/com/google/adk/web/BackendUrlRedirectTest.java` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+/*
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.google.adk.web;
+
+import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
+import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
+import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
+
+import org.junit.jupiter.api.Nested;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.params.ParameterizedTest;
+import org.junit.jupiter.params.provider.ValueSource;
+import org.springframework.beans.factory.annotation.Autowired;
+import org.springframework.boot.test.context.SpringBootTest;
+import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
+import org.springframework.test.web.servlet.MockMvc;
+
+/**
+ * With {@code adk.web.backend-url} set, the entry redirect carries the gateway's path prefix on its
+ * own, so a deployment behind a path-stripping proxy needs nothing forwarded from the proxy. The
+ * property governs the path only: host and scheme still come from forwarded headers wherever the
+ * operator has enabled {@code server.forward-headers-strategy}.
+ */
+public class BackendUrlRedirectTest {
+
+  @Nested
+  @SpringBootTest(
+      properties = {
+        "adk.web.backend-url=https://gw.example.com/my-app",
+        // Enable ForwardedHeaderFilter so X-Forwarded-* headers reach the servlet request.
+        "server.forward-headers-strategy=framework"
+      })
+  @AutoConfigureMockMvc
+  class ConfiguredWithTheFilter {
+
+    @ParameterizedTest
+    @ValueSource(strings = {"/", "/dev-ui"})
+    public void devUiEntryPoints_shouldCarryTheConfiguredPrefix(
+        String path, @Autowired MockMvc mockMvc) throws Exception {
+      mockMvc
+          .perform(get(path))
+          .andExpect(status().is3xxRedirection())
+          .andExpect(redirectedUrl("/my-app/dev-ui/"));
+    }
+
+    @ParameterizedTest
+    @ValueSource(strings = {"/", "/dev-ui"})
+    public void devUiEntryPoints_shouldNotStackAForwardedPrefix(
+        String path, @Autowired MockMvc mockMvc) throws Exception {
+      // The configured prefix replaces the context path created by ForwardedHeaderFilter.
+      mockMvc
+          .perform(get(path).header("X-Forwarded-Prefix", "/evil"))
+          .andExpect(status().is3xxRedirection())
+          .andExpect(redirectedUrl("http://localhost/my-app/dev-ui/"));
+    }
+
+    @Test
+    public void devUiEntryPoint_forwardedHostAndProto_stillSetTheRedirectsOrigin(
+        @Autowired MockMvc mockMvc) throws Exception {
+      // The configured value supplies the path; host and scheme still come from the headers.
+      mockMvc
+          .perform(
+              get("/")
+                  .header("X-Forwarded-Host", "gw.example.com")
+                  .header("X-Forwarded-Proto", "https"))
+          .andExpect(status().is3xxRedirection())
+          .andExpect(redirectedUrl("https://gw.example.com/my-app/dev-ui/"));
+    }
+  }
+
+  @Nested
+  @SpringBootTest(properties = "adk.web.backend-url=https://gw.example.com/my-app")
+  @AutoConfigureMockMvc
+  class ConfiguredWithoutTheFilter {
+
+    @Test
+    public void devUiEntryPoint_forwardedHeaders_reachNothingUnderTheShippedStrategy(
+        @Autowired MockMvc mockMvc) throws Exception {
+      // With forward-headers-strategy unset (default), forwarded headers are ignored.
+      mockMvc
+          .perform(
+              get("/")
+                  .header("X-Forwarded-Prefix", "/evil")
+                  .header("X-Forwarded-Host", "evil.example.com")
+                  .header("Forwarded", "host=evil.example.com;proto=https"))
+          .andExpect(status().is3xxRedirection())
+          .andExpect(redirectedUrl("/my-app/dev-ui/"));
+    }
+  }
+
+  @Nested
+  @SpringBootTest(properties = "adk.web.backend-url=https://gw.example.com")
+  @AutoConfigureMockMvc
+  class ConfiguredWithNoPath {
+
+    @ParameterizedTest
+    @ValueSource(strings = {"/", "/dev-ui"})
+    public void devUiEntryPoints_shouldRedirectWithoutAPrefix(
+        String path, @Autowired MockMvc mockMvc) throws Exception {
+      // A host-only URL has an empty pathPrefix(), so the redirect stays context-relative.
+      mockMvc
+          .perform(get(path))
+          .andExpect(status().is3xxRedirection())
+          .andExpect(redirectedUrl("/dev-ui/"));
+    }
+  }
+
+  @Nested
+  @SpringBoo
```

**File**: `dev/src/test/java/com/google/adk/web/config/BackendUrlTest.java` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+/*
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.google.adk.web.config;
+
+import static com.google.common.truth.Truth.assertThat;
+
+import ch.qos.logback.classic.Level;
+import ch.qos.logback.classic.Logger;
+import ch.qos.logback.classic.spi.ILoggingEvent;
+import ch.qos.logback.core.read.ListAppender;
+import java.util.List;
+import org.junit.jupiter.api.Test;
+import org.slf4j.LoggerFactory;
+
+/**
+ * One reading of {@code adk.web.backend-url}. The value the dev UI is served and the prefix its
+ * entry redirect carries come from the same parse, so they cannot disagree.
+ */
+public class BackendUrlTest {
+
+  private static final String CONFIGURED = "https://gw.example.com/my-app";
+
+  @Test
+  public void unset_isEmptyEverywhere() {
+    for (String in : new String[] {null, "", "   "}) {
+      assertThat(BackendUrl.from(in).value()).isEmpty();
+      assertThat(BackendUrl.from(in).pathPrefix()).isEmpty();
+    }
+  }
+
+  @Test
+  public void absoluteUrl_isServedAndSuppliesThePrefix() {
+    BackendUrl url = BackendUrl.from(CONFIGURED);
+
+    assertThat(url.value()).isEqualTo(CONFIGURED);
+    assertThat(url.pathPrefix()).isEqualTo("/my-app");
+  }
+
+  @Test
+  public void trailingSlashes_areStripped() {
+    // The UI appends paths starting with a slash, so a trailing one would yield //run_live.
+    assertThat(BackendUrl.from(CONFIGURED + "/").value()).isEqualTo(CONFIGURED);
+    assertThat(BackendUrl.from(CONFIGURED + "///").pathPrefix()).isEqualTo("/my-app");
+    assertThat(BackendUrl.from("  " + CONFIGURED + "  ").value()).isEqualTo(CONFIGURED);
+  }
+
+  @Test
+  public void hostWithoutPath_hasNoPrefix() {
+    assertThat(BackendUrl.from("https://gw.example.com").pathPrefix()).isEmpty();
+    assertThat(BackendUrl.from("https://gw.example.com/").pathPrefix()).isEmpty();
+  }
+
+  @Test
+  public void percentEncoding_isKept() {
+    // This goes into a Location header, so decoding would re-encode wrongly and %2F would
+    // turn into a path separator.
+    assertThat(BackendUrl.from("https://gw.example.com/my%20app").pathPrefix())
+        .isEqualTo("/my%20app");
+    assertThat(BackendUrl.from("https://gw.example.com/a%2Fb").pathPrefix()).isEqualTo("/a%2Fb");
+  }
+
+  @Test
+  public void doubledSlash_doesNotBecomeAHost() {
+    // "//my-app/dev-ui/" is protocol-relative: a browser resolves it to the host "my-app".
+    assertThat(BackendUrl.from("https://gw.example.com//my-app").pathPrefix()).isEqualTo("/my-app");
+  }
+
+  @Test
+  public void unusableValue_suppliesNoPrefix() {
+    // Leave pathPrefix() empty when the UI cannot use the URL so redirect and UI behavior match.
+    for (String in :
+        new String[] {
+          "/my-app",
+          "HTTPS://gw.example.com/x",
+          "http://",
+          "gw.example.com",
+          "https://gw.example.com/a?q=1",
+          "https://user:pass@gw.example.com/my-app",
+          "https://gw.example.com/my app",
+          // No host at all, only a port: getRawAuthority() would call this usable.
+          "https://:8080/my-app",
+          // RFC-invalid, and unreachable anyway - Tomcat rejects such a Host header with a 400,
+          // and no CA will issue a certificate for one.
+          "https://gw_host.example.com/my-app"
+        }) {
+      assertThat(BackendUrl.from(in).pathPrefix()).isEmpty();
+    }
+  }
+
+  @Test
+  public void credentials_areNotLogged() {
+    String warning = warningsFor("https://user:pass@gw.example.com/my-app").get(0);
+
+    assertThat(warning).doesNotContain("pass");
+    assertThat(warning).contains("***@gw.example.com");
+  }
+
+  @Test
+  public void unusableValue_isStillServedButWarns() {
+    // Never silently discarded, because it is an explicit setting.
+    assertThat(BackendUrl.from("/my-app").value()).isEqualTo("/my-app");
+    assertThat(BackendUrl.from("HTTPS://gw.example.com/x").value())
+        .isEqualTo("HTTPS://gw.example.com/x");
+    assertThat(BackendUrl.from("http://").value()).isEqualTo("http://");
+
+    assertThat(warningsFor("/my-app")).hasSize(1);
+    assertThat(warningsFor("/my-app").get(0)).contains("/my-app");
+    assertThat(warningsFor("HTTPS://gw.example.com/x")).hasSize(1);
+    assertThat(warningsFor("http://")).hasSize(1);
+  }
+
+  @Test
+  public void slashOnly_isNotEmptiedByTheSlashTrim() {
+    // Emptying this would make the served value fall back to whatever the bun
```

#### Recent Merged Pull Requests:
- **PR #1614** (closed): ci: limit concurrent workflow runs (@copybara-service[bot])
- **PR #1612** (2026-10-05): fix: run approved tool confirmations for agents under a ParallelAgent (@copybara-service[bot])
- **PR #1611** (2026-10-05): feat: carry the continuation token across the Kotlin engine interop (@copybara-service[bot])
- **PR #1605** (2026-10-05): chore(main): release 1.11.1-SNAPSHOT (@adk-java-releases-bot)
- **PR #1600** (2026-10-02): feat: resume Gemini generations paused with a continuation token (@copybara-service[bot])
- **PR #1599** (2026-10-02): chore: remove the ADK GitHub automation agent samples and their workflows (@copybara-service[bot])
- **PR #1597** (2026-10-05): ci: limit concurrent workflow runs (@copybara-service[bot])
- **PR #1596** (2026-10-05): ci: limit GITHUB_TOKEN permissions in the workflows (@copybara-service[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

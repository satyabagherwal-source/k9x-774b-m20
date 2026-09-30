# Forensic Learning Record (Deep Inspection): google/adk-java

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-adk-java-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/adk-java](https://github.com/google/adk-java))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:17:51.755Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/adk-java`
- **Description**: An open-source, code-first Java toolkit for building, evaluating, and deploying sophisticated AI agents with flexibility and control.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1741 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

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

### Incident Patch 1: `9b128dfb` (2026-09-29)
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
+    CallToolResult res
```

---

### Incident Patch 2: `9fe5830f` (2026-09-28)
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
+          
```

---

### Incident Patch 3: `650e9509` (2026-09-25)
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
+  private fun applyTemp
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
+          
```

---

### Incident Patch 4: `f7d7a7ca` (2026-09-25)
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

### Incident Patch 5: `1afd8395` (2026-09-25)
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
@@ -115,7 +115,7 @@ object JavaAdkTo
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

### Incident Patch 6: `2c5bd9e8` (2026-09-24)
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
+    // Collapse leading slashes so 
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
+      return new LinkedHashMa
```

---

### Incident Patch 7: `33e28e34` (2026-09-21)
**Commit Message**: fix: respect OpenTelemetry LIFO scoping in reactive streams

Refactor ADK telemetry to avoid holding thread-local OpenTelemetry Scope instances open across asynchronous reactive stream lifecycles.

PiperOrigin-RevId: 985302091

**File**: `core/src/main/java/com/google/adk/agents/BaseAgent.java` (modified, +29/-20)
```diff
@@ -26,6 +26,7 @@
 import com.google.adk.plugins.Plugin;
 import com.google.adk.telemetry.Instrumentation;
 import com.google.adk.telemetry.Instrumentation.AgentInvocation;
+import com.google.adk.telemetry.Tracing;
 import com.google.adk.utils.AgentEnums.AgentOrigin;
 import com.google.common.collect.ImmutableList;
 import com.google.errorprone.annotations.CanIgnoreReturnValue;
@@ -331,31 +332,39 @@ private Flowable<Event> run(
         },
         agentInvocation -> {
           InvocationContext invocationContext = agentInvocation.getCtx();
+          Context otelContext = agentInvocation.context().otelContext();
           Flowable<Event> mainAndAfterEvents =
               Flowable.defer(() -> runImplementation.apply(invocationContext))
+                  .compose(Tracing.withContext(otelContext))
                   .concatWith(
                       Flowable.defer(
-                          () ->
-                              callCallback(
-                                      afterCallbacksToFunctions(
-                                          invocationContext.pluginManager(), afterAgentCallback),
-                                      invocationContext)
-                                  .toFlowable()));
-
-          return callCallback(
-                  beforeCallbacksToFunctions(
-                      invocationContext.pluginManager(), beforeAgentCallback),
-                  invocationContext)
-              .flatMapPublisher(
-                  beforeEvent -> {
-                    if (invocationContext.endInvocation()) {
-                      return Flowable.just(beforeEvent);
-                    }
-                    return Flowable.just(beforeEvent).concatWith(mainAndAfterEvents);
-                  })
-              .switchIfEmpty(mainAndAfterEvents)
+                              () ->
+                                  callCallback(
+                                          afterCallbacksToFunctions(
+                                              invocationContext.pluginManager(),
+                                              afterAgentCallback),
+                                          invocationContext)
+                                      .toFlowable())
+                          .compose(Tracing.withContext(otelContext)));
+
+          return Flowable.defer(
+                  () ->
+                      callCallback(
+                              beforeCallbacksToFunctions(
+                                  invocationContext.pluginManager(), beforeAgentCallback),
+                              invocationContext)
+                          .compose(Tracing.withContext(otelContext))
+                          .flatMapPublisher(
+                              beforeEvent -> {
+                                if (invocationContext.endInvocation()) {
+                                  return Flowable.just(beforeEvent);
+                                }
+                                return Flowable.just(beforeEvent).concatWith(mainAndAfterEvents);
+                              })
+                          .switchIfEmpty(mainAndAfterEvents))
               .doOnNext(agentInvocation::addEvent)
-              .doOnError(agentInvocation::setError);
+              .doOnError(agentInvocation::setError)
+              .compose(Tracing.withContext(otelContext));
         },
         AgentInvocation::close);
   }
```

**File**: `core/src/main/java/com/google/adk/flows/llmflows/Functions.java` (modified, +50/-26)
```diff
@@ -304,25 +304,10 @@ private static Function<FunctionCall, Maybe<Event>> getFunctionCallMapper(
                   Map<String, Object> functionArgs =
                       functionCall.args().map(HashMap::new).orElse(new HashMap<>());
 
-                  Maybe<Map<String, Object>> maybeFunctionResult =
-                      maybeInvokeBeforeToolCall(invocationContext, tool, functionArgs, toolContext)
-                          .switchIfEmpty(
-                              Maybe.defer(
-                                      () ->
-                                          isLive
-                                              ? processFunctionLive(
-                                                  invocationContext,
-                                                  tool,
-                                                  toolContext,
-                                                  functionCall,
-                                                  functionArgs)
-                                              : callTool(tool, functionArgs, toolContext))
-                                  .compose(Tracing.withContext(parentContext)));
-
                   return postProcessFunctionResult(
-                      maybeFunctionResult,
                       invocationContext,
                       tool,
+                      functionCall,
                       functionArgs,
                       toolContext,
                       isLive,
@@ -487,9 +472,9 @@ static boolean hasPendingLongRunningCall(List<Event> events) {
   }
 
   private static Maybe<Event> postProcessFunctionResult(
-      Maybe<Map<String, Object>> maybeFunctionResult,
       InvocationContext invocationContext,
       BaseTool tool,
+      FunctionCall functionCall,
       Map<String, Object> functionArgs,
       ToolContext toolContext,
       boolean isLive,
@@ -498,11 +483,38 @@ private static Maybe<Event> postProcessFunctionResult(
         () ->
             Instrumentation.recordToolExecution(
                 tool, invocationContext.agent(), functionArgs, parentContext),
-        toolExecution ->
-            processFunctionResult(
-                    maybeFunctionResult, invocationContext, tool, functionArgs, toolContext, isLive)
-                .doOnSuccess(event -> toolExecution.context().setFunctionResponseEvent(event))
-                .doOnError(toolExecution::setError),
+        toolExecution -> {
+          Context toolOtelContext = toolExecution.context().otelContext();
+          Maybe<Map<String, Object>> maybeFunctionResult =
+              Maybe.defer(
+                      () ->
+                          maybeInvokeBeforeToolCall(
+                              invocationContext, tool, functionArgs, toolContext))
+                  .compose(Tracing.withContext(toolOtelContext))
+                  .switchIfEmpty(
+                      Maybe.defer(
+                              () ->
+                                  isLive
+                                      ? processFunctionLive(
+                                          invocationContext,
+                                          tool,
+                                          toolContext,
+                                          functionCall,
+                                          functionArgs)
+                                      : callTool(tool, functionArgs, toolContext))
+                          .compose(Tracing.withContext(toolOtelContext)));
+          return processFunctionResult(
+                  maybeFunctionResult,
+                  invocationContext,
+                  tool,
+                  functionArgs,
+                  toolContext,
+                  isLive,
+                  toolOtelContext)
+              .compose(Tracing.withContext(toolOtelContext))
+              .doOnSuccess(event -> toolExecution.context().setFunctionResponseEvent(event))
+              .doOnError(toolExecution::setError);
+        },
         ToolExecution::close
```

**File**: `core/src/main/java/com/google/adk/telemetry/Instrumentation.java` (modified, +10/-14)
```diff
@@ -23,7 +23,6 @@
 import io.opentelemetry.api.trace.Span;
 import io.opentelemetry.api.trace.StatusCode;
 import io.opentelemetry.context.Context;
-import io.opentelemetry.context.Scope;
 import java.time.Duration;
 import java.util.ArrayList;
 import java.util.Collections;
@@ -91,9 +90,6 @@ public abstract static class ClosableTelemetryScope implements AutoCloseable {
     /** The OpenTelemetry span associated with this scope. */
     protected final Span span;
 
-    /** The OpenTelemetry scope associated with this span. */
-    protected final Scope scope;
-
     /** The telemetry context for this scope. */
     protected final TelemetryContext telemetryContext;
 
@@ -104,16 +100,15 @@ public abstract static class ClosableTelemetryScope implements AutoCloseable {
     protected final AtomicBoolean closed = new AtomicBoolean(false);
 
     /**
-     * Constructs a new {@code ClosableTelemetryScope} with the given span.
+     * Constructs a new {@code ClosableTelemetryScope} with the given span and parent context.
      *
      * @param span The OpenTelemetry span to manage.
+     * @param parentContext The OpenTelemetry parent context.
      */
-    @SuppressWarnings("MustBeClosedChecker")
-    ClosableTelemetryScope(Span span) {
+    ClosableTelemetryScope(Span span, Context parentContext) {
       this.startTimeNanos = System.nanoTime();
       this.span = span;
-      this.scope = span.makeCurrent();
-      this.telemetryContext = new TelemetryContext(Context.current());
+      this.telemetryContext = new TelemetryContext(parentContext.with(span));
     }
 
     /**
@@ -136,23 +131,22 @@ public void setError(Throwable caughtError) {
       span.setStatus(StatusCode.ERROR, caughtError.getMessage());
     }
 
-    /** Closes the scope and ends the underlying span, recording any applicable metrics. */
+    /** Ends the underlying span and records any applicable metrics. */
     @Override
     public final void close() {
       if (closed.getAndSet(true)) {
         return;
       }
       try {
         beforeSpanEnd();
+      } finally {
         span.end();
         Duration elapsed = Duration.ofNanos(System.nanoTime() - startTimeNanos);
         try {
           recordMetrics(elapsed, caughtError);
         } catch (RuntimeException e) {
           handleMetricsError(e);
         }
-      } finally {
-        scope.close();
       }
     }
 
@@ -184,7 +178,8 @@ public AgentInvocation(InvocationContext ctx, BaseAgent agent, Context parentCon
           Tracing.getTracer()
               .spanBuilder("invoke_agent " + agent.name())
               .setParent(parentContext)
-              .startSpan());
+              .startSpan(),
+          parentContext);
       this.agent = agent;
       this.ctx = ctx;
       Tracing.traceAgentInvocation(span, agent.name(), agent.description(), ctx);
@@ -254,7 +249,8 @@ public ToolExecution(
           Tracing.getTracer()
               .spanBuilder("execute_tool " + tool.name())
               .setParent(parentContext)
-              .startSpan());
+              .startSpan(),
+          parentContext);
       this.tool = tool;
       this.agent = agent;
       this.functionArgs = functionArgs;
```

**File**: `core/src/main/java/com/google/adk/telemetry/Tracing.java` (modified, +61/-54)
```diff
@@ -427,37 +427,23 @@ public static Tracer getTracer() {
   }
 
   /**
-   * Executes a Flowable with an OpenTelemetry Scope active for its entire lifecycle.
-   *
-   * <p>This helper manages the OpenTelemetry Scope lifecycle for RxJava Flowables to ensure proper
-   * context propagation across async boundaries. The scope remains active from when the Flowable is
-   * returned through all operators until stream completion (onComplete, onError, or cancel).
-   *
-   * <p><b>Why not try-with-resources?</b> RxJava Flowables execute lazily - operators run at
-   * subscription time, not at chain construction time. Using try-with-resources would close the
-   * scope before the Flowable subscribes, causing Context.current() to return ROOT in nested
-   * operations and breaking parent-child span relationships (fragmenting traces).
-   *
-   * <p>The scope is properly closed via doFinally when the stream terminates, ensuring no resource
-   * leaks regardless of completion mode (success, error, or cancellation).
+   * Executes a {@link Flowable} supplier within {@code spanContext} and propagates that context
+   * across subscription and stream emissions via {@link #withContext(Context)}. Ends {@code span}
+   * when the stream terminates or is cancelled.
    *
    * @param spanContext The context containing the span to activate
    * @param span The span to end when the stream completes
    * @param flowableSupplier Supplier that creates the Flowable to execute with active scope
    * @param <T> The type of items emitted by the Flowable
-   * @return Flowable with OpenTelemetry scope lifecycle management
+   * @return Flowable with OpenTelemetry context propagation and span lifecycle management
    */
-  @SuppressWarnings("MustBeClosedChecker") // Scope lifecycle managed by RxJava doFinally
   public static <T> Flowable<T> traceFlowable(
       Context spanContext, Span span, Supplier<Flowable<T>> flowableSupplier) {
-    Scope scope = spanContext.makeCurrent();
-    return flowableSupplier
-        .get()
-        .doFinally(
-            () -> {
-              scope.close();
-              span.end();
-            });
+    final Flowable<T> upstream;
+    try (Scope scope = spanContext.makeCurrent()) {
+      upstream = flowableSupplier.get();
+    }
+    return upstream.compose(withContext(spanContext)).doFinally(span::end);
   }
 
   /**
@@ -541,19 +527,16 @@ private Context getParentContext() {
 
     private final class TracingLifecycle {
       private Span span;
-      private Scope scope;
+      private Context spanContext;
 
-      @SuppressWarnings("MustBeClosedChecker")
       void start() {
-        span = tracer.spanBuilder(spanName).setParent(getParentContext()).startSpan();
+        Context parentContext = getParentContext();
+        span = tracer.spanBuilder(spanName).setParent(parentContext).startSpan();
         spanConfigurers.forEach(c -> c.accept(span));
-        scope = span.makeCurrent();
+        spanContext = parentContext.with(span);
       }
 
       void end() {
-        if (scope != null) {
-          scope.close();
-        }
         if (span != null) {
           span.end();
         }
@@ -572,7 +555,7 @@ public Publisher<T> apply(Flowable<T> upstream) {
           () -> {
             TracingLifecycle lifecycle = new TracingLifecycle();
             lifecycle.start();
-            Flowable<T> pipeline = upstream;
+            Flowable<T> pipeline = upstream.compose(withContext(lifecycle.spanContext));
             if (onSuccessConsumer != null) {
               pipeline = pipeline.doOnNext(t -> onSuccessConsumer.accept(lifecycle.span, t));
             }
@@ -592,7 +575,7 @@ public SingleSource<T> apply(Single<T> upstream) {
           () -> {
             TracingLifecycle lifecycle = new TracingLifecycle();
             lifecycle.start();
-            Single<T> pipeline = upstream;
+            Single<T> pipeline = upstream.compose(withContext(lifecycle.spanContext));
             if (onSuccessC
```

**File**: `core/src/test/java/com/google/adk/telemetry/ContextPropagationTest.java` (modified, +170/-0)
```diff
@@ -57,6 +57,7 @@
 import io.reactivex.rxjava3.core.Flowable;
 import io.reactivex.rxjava3.core.Maybe;
 import io.reactivex.rxjava3.core.Single;
+import io.reactivex.rxjava3.processors.PublishProcessor;
 import io.reactivex.rxjava3.schedulers.Schedulers;
 import java.util.Comparator;
 import java.util.List;
@@ -806,6 +807,175 @@ public void testNestedAgentTraceHierarchy() throws InterruptedException {
     assertParent(agentBSpan, agentBCallLlm);
   }
 
+  @Test
+  public void
+      traceFlowable_andTraceTransformer_doNotLeakContextOnCallingThreadDuringAsyncExecution() {
+    Span callerSpan = tracer.spanBuilder("caller_rpc").startSpan();
+    PublishProcessor<Integer> asyncStream1 = PublishProcessor.create();
+    PublishProcessor<Integer> asyncStream2 = PublishProcessor.create();
+
+    try (Scope callerScope = callerSpan.makeCurrent()) {
+      Span flowableSpan =
+          tracer.spanBuilder("async_flowable").setParent(Context.current()).startSpan();
+      Flowable<Integer> tracedFlowable =
+          Tracing.traceFlowable(
+              Context.current().with(flowableSpan), flowableSpan, () -> asyncStream1);
+      Flowable<Integer> tracedTransformer =
+          asyncStream2.compose(Tracing.trace("async_transformer"));
+
+      // Subscribe while streams are still pending (not completed)
+      var sub1 = tracedFlowable.test();
+      var sub2 = tracedTransformer.test();
+
+      // Calling thread's active span must remain caller_rpc, not async_flowable or
+      // async_transformer
+      assertEquals(
+          callerSpan.getSpanContext().getSpanId(), Span.current().getSpanContext().getSpanId());
+
+      asyncStream1.onNext(1);
+      asyncStream1.onComplete();
+      asyncStream2.onNext(2);
+      asyncStream2.onComplete();
+
+      sub1.assertComplete();
+      sub2.assertComplete();
+
+      assertEquals(
+          callerSpan.getSpanContext().getSpanId(), Span.current().getSpanContext().getSpanId());
+    } finally {
+      callerSpan.end();
+    }
+  }
+
+  @Test
+  public void withContext_propagatesContextToDeferredUpstreamAcrossAsyncSubscription()
+      throws InterruptedException {
+    ContextKey<String> testKey = ContextKey.named("async-defer-key");
+    Context testContext = Context.root().with(testKey, "expected-value");
+
+    AtomicReference<String> flowableObserved = new AtomicReference<>();
+    AtomicReference<String> singleObserved = new AtomicReference<>();
+    AtomicReference<String> maybeObserved = new AtomicReference<>();
+    AtomicReference<String> completableObserved = new AtomicReference<>();
+
+    Flowable.defer(
+            () -> {
+              flowableObserved.set(Context.current().get(testKey));
+              return Flowable.just(1);
+            })
+        .compose(Tracing.withContext(testContext))
+        .subscribeOn(Schedulers.computation())
+        .test()
+        .await()
+        .assertComplete();
+
+    Single.defer(
+            () -> {
+              singleObserved.set(Context.current().get(testKey));
+              return Single.just(1);
+            })
+        .compose(Tracing.withContext(testContext))
+        .subscribeOn(Schedulers.computation())
+        .test()
+        .await()
+        .assertComplete();
+
+    Maybe.defer(
+            () -> {
+              maybeObserved.set(Context.current().get(testKey));
+              return Maybe.just(1);
+            })
+        .compose(Tracing.withContext(testContext))
+        .subscribeOn(Schedulers.computation())
+        .test()
+        .await()
+        .assertComplete();
+
+    Completable.defer(
+            () -> {
+              completableObserved.set(Context.current().get(testKey));
+              return Completable.complete();
+            })
+        .compose(Tracing.withContext(testContext))
+        .subscribeOn(Schedulers.computation())
+        .test()
+        .await()
+        .assertComplete();
+
+    assertEquals("expected-value", flowableObserved.get());
+    assertEquals("expected-val
```

---

### Incident Patch 8: `60f347f0` (2026-09-21)
**Commit Message**: Merge pull request #1433 from BlueCatPro:fix/set-model-response-validation-feedback

PiperOrigin-RevId: 985247411

**File**: `core/src/main/java/com/google/adk/events/EventActions.java` (modified, +29/-2)
```diff
@@ -46,6 +46,7 @@ public class EventActions extends JsonBaseModel {
   private boolean endOfAgent;
   private @Nullable Map<String, Object> agentState;
   private @Nullable EventCompaction compaction;
+  private @Nullable Object setModelResponse;
 
   /** Default constructor for Jackson. */
   public EventActions() {
@@ -69,6 +70,7 @@ private EventActions(Builder builder) {
     this.endOfAgent = builder.endOfAgent;
     this.agentState = builder.agentState;
     this.compaction = builder.compaction;
+    this.setModelResponse = builder.setModelResponse;
   }
 
   @JsonProperty("skipSummarization")
@@ -216,6 +218,19 @@ public void setCompaction(@Nullable EventCompaction compaction) {
     this.compaction = compaction;
   }
 
+  /**
+   * The successfully validated structured response set by the {@code set_model_response} tool.
+   * Empty when the tool was not called or its arguments failed output-schema validation.
+   */
+  @JsonProperty("setModelResponse")
+  public Optional<Object> setModelResponse() {
+    return Optional.ofNullable(setModelResponse);
+  }
+
+  public void setSetModelResponse(@Nullable Object setModelResponse) {
+    this.setModelResponse = setModelResponse;
+  }
+
   public static Builder builder() {
     return new Builder();
   }
@@ -242,7 +257,8 @@ public boolean equals(Object o) {
         && Objects.equals(requestedToolConfirmations, that.requestedToolConfirmations)
         && (endOfAgent == that.endOfAgent)
         && Objects.equals(agentState, that.agentState)
-        && Objects.equals(compaction, that.compaction);
+        && Objects.equals(compaction, that.compaction)
+        && Objects.equals(setModelResponse, that.setModelResponse);
   }
 
   @Override
@@ -258,7 +274,8 @@ public int hashCode() {
         requestedToolConfirmations,
         endOfAgent,
         agentState,
-        compaction);
+        compaction,
+        setModelResponse);
   }
 
   /** Builder for {@link EventActions}. */
@@ -274,6 +291,7 @@ public static class Builder {
     private boolean endOfAgent = false;
     private @Nullable Map<String, Object> agentState;
     private @Nullable EventCompaction compaction;
+    private @Nullable Object setModelResponse;
 
     public Builder() {
       this.stateDelta = new ConcurrentHashMap<>();
@@ -296,6 +314,7 @@ private Builder(EventActions eventActions) {
       this.endOfAgent = eventActions.endOfAgent;
       this.agentState = eventActions.agentState;
       this.compaction = eventActions.compaction;
+      this.setModelResponse = eventActions.setModelResponse;
     }
 
     @CanIgnoreReturnValue
@@ -409,6 +428,13 @@ public Builder compaction(@Nullable EventCompaction value) {
       return this;
     }
 
+    @CanIgnoreReturnValue
+    @JsonProperty("setModelResponse")
+    public Builder setModelResponse(@Nullable Object value) {
+      this.setModelResponse = value;
+      return this;
+    }
+
     @CanIgnoreReturnValue
     public Builder merge(EventActions other) {
       other.skipSummarization().ifPresent(this::skipSummarization);
@@ -422,6 +448,7 @@ public Builder merge(EventActions other) {
       this.endOfAgent = this.endOfAgent || other.endOfAgent();
       other.agentState().ifPresent(this::agentState);
       other.compaction().ifPresent(this::compaction);
+      other.setModelResponse().ifPresent(this::setModelResponse);
       return this;
     }
 
```

**File**: `core/src/main/java/com/google/adk/flows/llmflows/OutputSchema.java` (modified, +11/-5)
```diff
@@ -78,18 +78,24 @@ public Single<RequestProcessingResult> processRequest(
   }
 
   /**
-   * Check if function response contains set_model_response and extract JSON.
+   * Extracts a successfully validated {@code set_model_response} result as JSON.
+   *
+   * <p>Only a result that passed output-schema validation (recorded on the event actions by {@link
+   * SetModelResponseTool}) is returned. Validation feedback sent back to the model is never
+   * promoted to the final structured response.
    *
    * @param functionResponseEvent The function response event to check.
-   * @return JSON response string if set_model_response was called, Optional.empty() otherwise.
+   * @return JSON response string if set_model_response succeeded, Optional.empty() otherwise.
    */
   public static Optional<String> getStructuredModelResponse(Event functionResponseEvent) {
     for (FunctionResponse funcResponse : functionResponseEvent.functionResponses()) {
       if (Objects.equals(funcResponse.name().orElse(""), SetModelResponseTool.NAME)) {
-        Object response = funcResponse.response();
-        // The tool returns the args map directly.
+        Optional<Object> validatedResponse = functionResponseEvent.actions().setModelResponse();
+        if (validatedResponse.isEmpty()) {
+          return Optional.empty();
+        }
         try {
-          return Optional.of(JsonBaseModel.getMapper().writeValueAsString(response));
+          return Optional.of(JsonBaseModel.getMapper().writeValueAsString(validatedResponse.get()));
         } catch (JsonProcessingException e) {
           logger.error("Failed to serialize set_model_response result", e);
           return Optional.empty();
```

**File**: `core/src/main/java/com/google/adk/tools/SetModelResponseTool.java` (modified, +65/-4)
```diff
@@ -17,9 +17,13 @@
 package com.google.adk.tools;
 
 import com.google.adk.SchemaUtils;
+import com.google.common.collect.ImmutableMap;
 import com.google.genai.types.FunctionDeclaration;
 import com.google.genai.types.Schema;
 import io.reactivex.rxjava3.core.Single;
+import java.util.ArrayList;
+import java.util.LinkedHashMap;
+import java.util.List;
 import java.util.Map;
 import java.util.Optional;
 
@@ -33,6 +37,12 @@
 public class SetModelResponseTool extends BaseTool {
   public static final String NAME = "set_model_response";
 
+  // Prefix of the SchemaUtils validation message after which the full schema is appended. Used to
+  // strip the schema dump from feedback on a best-effort basis; if SchemaUtils changes its wording
+  // the feedback simply stays unstripped. runAsync_unknownArg_feedbackOmitsSchemaDump pins the
+  // current format.
+  private static final String OUTPUT_SCHEMA_DUMP_MARKER = " does not match agent output schema: ";
+
   private final Schema outputSchema;
 
   public SetModelResponseTool(Schema outputSchema) {
@@ -56,12 +66,63 @@ public Optional<FunctionDeclaration> declaration() {
 
   @Override
   public Single<Map<String, Object>> runAsync(Map<String, Object> args, ToolContext toolContext) {
-    // This tool is a marker for the final response, it doesn't do anything but return its arguments
-    // which will be captured as the final result.
+    // Record validated responses on the event actions; return validation feedback so the model can
+    // retry.
     return Single.fromCallable(
         () -> {
-          SchemaUtils.validateMapOnSchema(args, outputSchema, /* isInput= */ false);
-          return args;
+          try {
+            SchemaUtils.validateMapOnSchema(args, outputSchema, /* isInput= */ false);
+          } catch (IllegalArgumentException e) {
+            return ImmutableMap.of(
+                "error",
+                "Validation Error found:\n"
+                    + sanitizeValidationMessage(e.getMessage())
+                    + "\nRecall the set_model_response function correctly, fix the errors, and"
+                    + " call it again with all required fields using the correct types.");
+          }
+          // Match Python's model_dump(exclude_none=True) for Java's map-shaped response.
+          Map<String, Object> validatedResponse = excludeNullFields(args);
+          toolContext.actions().setSetModelResponse(validatedResponse);
+          return validatedResponse;
         });
   }
+
+  private static Map<String, Object> excludeNullFields(Map<String, Object> values) {
+    Map<String, Object> result = new LinkedHashMap<>();
+    for (Map.Entry<String, Object> entry : values.entrySet()) {
+      Object value = entry.getValue();
+      if (value != null) {
+        result.put(entry.getKey(), excludeNullFields(value));
+      }
+    }
+    return result;
+  }
+
+  @SuppressWarnings("unchecked")
+  private static Object excludeNullFields(Object value) {
+    if (value instanceof Map<?, ?>) {
+      return excludeNullFields((Map<String, Object>) value);
+    }
+    if (value instanceof List<?>) {
+      List<Object> result = new ArrayList<>();
+      for (Object item : (List<?>) value) {
+        result.add(excludeNullFields(item));
+      }
+      return result;
+    }
+    return value;
+  }
+
+  private static String sanitizeValidationMessage(String message) {
+    if (message == null) {
+      return "Arguments do not match the output schema.";
+    }
+    // The model already knows the schema from the tool declaration, so the appended schema dump is
+    // redundant in feedback.
+    int schemaDumpIndex = message.indexOf(OUTPUT_SCHEMA_DUMP_MARKER);
+    if (schemaDumpIndex >= 0) {
+      message = message.substring(0, schemaDumpIndex) + " does not match agent output schema.";
+    }
+    return message;
+  }
 }
```

**File**: `core/src/test/java/com/google/adk/events/EventActionsTest.java` (modified, +4/-0)
```diff
@@ -89,6 +89,7 @@ public void merge_mergesAllFields() {
             .requestedToolConfirmations(
                 new ConcurrentHashMap<>(ImmutableMap.of("tool2", TOOL_CONFIRMATION)))
             .endOfAgent(true)
+            .setModelResponse(ImmutableMap.of("field1", "value1"))
             .build();
 
     EventActions merged = eventActions1.toBuilder().merge(eventActions2).build();
@@ -109,6 +110,7 @@ public void merge_mergesAllFields() {
         .containsExactly("tool1", TOOL_CONFIRMATION, "tool2", TOOL_CONFIRMATION);
     assertThat(merged.endOfAgent()).isTrue();
     assertThat(merged.compaction()).hasValue(COMPACTION);
+    assertThat(merged.setModelResponse()).hasValue(ImmutableMap.of("field1", "value1"));
   }
 
   @Test
@@ -243,13 +245,15 @@ public void jsonSerialization_works() throws Exception {
         EventActions.builder()
             .deletedArtifactIds(ImmutableSet.of("d1", "d2"))
             .stateDelta(new ConcurrentHashMap<>(ImmutableMap.of("k", "v")))
+            .setModelResponse(ImmutableMap.of("field1", "value1"))
             .build();
 
     String json = eventActions.toJson();
     EventActions deserialized = EventActions.fromJsonString(json, EventActions.class);
 
     assertThat(deserialized).isEqualTo(eventActions);
     assertThat(deserialized.deletedArtifactIds()).containsExactly("d1", "d2");
+    assertThat(deserialized.setModelResponse()).hasValue(ImmutableMap.of("field1", "value1"));
   }
 
   @Test
```

**File**: `core/src/test/java/com/google/adk/flows/llmflows/OutputSchemaTest.java` (modified, +197/-2)
```diff
@@ -17,15 +17,22 @@
 package com.google.adk.flows.llmflows;
 
 import static com.google.adk.testing.TestUtils.createInvocationContext;
+import static com.google.adk.testing.TestUtils.createLlmResponse;
+import static com.google.adk.testing.TestUtils.createTestAgent;
 import static com.google.adk.testing.TestUtils.createTestLlm;
 import static com.google.common.truth.Truth.assertThat;
 
 import com.google.adk.agents.InvocationContext;
 import com.google.adk.agents.LlmAgent;
 import com.google.adk.events.Event;
+import com.google.adk.events.EventActions;
 import com.google.adk.flows.llmflows.RequestProcessor.RequestProcessingResult;
+import com.google.adk.models.BaseLlm;
+import com.google.adk.models.BaseLlmConnection;
 import com.google.adk.models.LlmRequest;
 import com.google.adk.models.LlmResponse;
+import com.google.adk.runner.InMemoryRunner;
+import com.google.adk.sessions.Session;
 import com.google.adk.testing.TestLlm;
 import com.google.adk.tools.BaseTool;
 import com.google.adk.tools.SetModelResponseTool;
@@ -36,8 +43,12 @@
 import com.google.genai.types.FunctionResponse;
 import com.google.genai.types.Part;
 import com.google.genai.types.Schema;
+import io.reactivex.rxjava3.core.Flowable;
 import io.reactivex.rxjava3.core.Single;
+import java.util.List;
 import java.util.Map;
+import java.util.Objects;
+import java.util.Optional;
 import org.junit.Before;
 import org.junit.Test;
 import org.junit.runner.RunWith;
@@ -143,18 +154,47 @@ public void getStructuredModelResponse_withSetModelResponse_returnsJson() {
     FunctionResponse fr =
         FunctionResponse.builder()
             .name(SetModelResponseTool.NAME)
-            .response(ImmutableMap.of("field1", "value1"))
+            .response(ImmutableMap.of("field1", "rawResponse"))
             .build();
     Event event =
         Event.builder()
+            .actions(
+                EventActions.builder()
+                    .setModelResponse(ImmutableMap.of("field1", "validatedValue"))
+                    .build())
             .content(
                 Content.builder()
                     .parts(Part.builder().functionResponse(fr).build())
                     .role("model")
                     .build())
             .build();
 
-    assertThat(OutputSchema.getStructuredModelResponse(event)).hasValue("{\"field1\":\"value1\"}");
+    // The result must come from the validated response on the event actions, not from the
+    // function response content.
+    assertThat(OutputSchema.getStructuredModelResponse(event))
+        .hasValue("{\"field1\":\"validatedValue\"}");
+  }
+
+  @Test
+  public void getStructuredModelResponse_withValidationFeedback_returnsEmpty() {
+    FunctionResponse fr =
+        FunctionResponse.builder()
+            .name(SetModelResponseTool.NAME)
+            .response(
+                ImmutableMap.of(
+                    "error",
+                    "Validation Error found: field1 is required. Fix the errors and call it again."))
+            .build();
+    Event event =
+        Event.builder()
+            .content(
+                Content.builder()
+                    .parts(Part.builder().functionResponse(fr).build())
+                    .role("user")
+                    .build())
+            .build();
+
+    assertThat(OutputSchema.getStructuredModelResponse(event)).isEmpty();
   }
 
   @Test
@@ -189,4 +229,159 @@ public void createFinalModelResponseEvent_createsModelResponseEvent() {
     assertThat(event.content().get().role()).hasValue("model");
     assertThat(event.content().get().parts().get()).containsExactly(Part.fromText(jsonResponse));
   }
+
+  @Test
+  public void run_validEmptySetModelResponse_emitsFinalResponse() {
+    Schema optionalOutputSchema =
+        TEST_OUTPUT_SCHEMA.toBuilder().required(ImmutableList.of()).build();
+    Content emptyCall =
+        Content.fromParts(Part.fromFunctionCall(SetModelResponseTool.NAME, ImmutableMap.of()));
+    TestLlm testLlm = createTestLlm(createLlmRespon
```

---

### Incident Patch 9: `87c04339` (2026-09-21)
**Commit Message**: Merge pull request #1491 from mithun-sudo:fix/parallel-agent-nested-escalation

PiperOrigin-RevId: 985191355

**File**: `core/src/main/java/com/google/adk/agents/ParallelAgent.java` (modified, +20/-1)
```diff
@@ -19,12 +19,15 @@
 
 import com.google.adk.agents.ConfigAgentUtils.ConfigurationException;
 import com.google.adk.events.Event;
+import com.google.common.collect.ImmutableSet;
 import com.google.errorprone.annotations.CanIgnoreReturnValue;
 import io.reactivex.rxjava3.core.Flowable;
 import io.reactivex.rxjava3.core.Scheduler;
 import io.reactivex.rxjava3.schedulers.Schedulers;
 import java.util.ArrayList;
 import java.util.List;
+import java.util.Objects;
+import java.util.Set;
 import org.slf4j.Logger;
 import org.slf4j.LoggerFactory;
 
@@ -175,13 +178,19 @@ protected Flowable<Event> runAsyncImpl(InvocationContext invocationContext) {
       return Flowable.empty();
     }
 
+    ImmutableSet<String> directSubAgentNames =
+        currentSubAgents.stream()
+            .map(BaseAgent::name)
+            .filter(Objects::nonNull)
+            .collect(ImmutableSet.toImmutableSet());
+
     var updatedInvocationContext = setBranchForCurrentAgent(this, invocationContext);
     List<Flowable<Event>> agentFlowables = new ArrayList<>();
     for (BaseAgent subAgent : currentSubAgents) {
       agentFlowables.add(subAgent.runAsync(updatedInvocationContext).subscribeOn(scheduler));
     }
     return Flowable.merge(agentFlowables)
-        .takeUntil((Event event) -> event.actions().escalate().orElse(false));
+        .takeUntil((Event event) -> asksThisAgentToExit(event, directSubAgentNames));
   }
 
   /**
@@ -195,4 +204,14 @@ protected Flowable<Event> runLiveImpl(InvocationContext invocationContext) {
     return Flowable.error(
         new UnsupportedOperationException("runLive is not defined for ParallelAgent yet."));
   }
+
+  /**
+   * Returns true if this ParallelAgent should stop remaining sibling branches.
+   *
+   * <p>Only escalate events from a direct sub-agent count. Escalate from a nested agent (for
+   * example inside a LoopAgent) must not cancel sibling branches.
+   */
+  private static boolean asksThisAgentToExit(Event event, Set<String> directSubAgentNames) {
+    return event.actions().escalate().orElse(false) && directSubAgentNames.contains(event.author());
+  }
 }
```

**File**: `core/src/test/java/com/google/adk/agents/ParallelAgentEscalationTest.java` (modified, +52/-0)
```diff
@@ -134,4 +134,56 @@ public void runAsync_escalationEvent_shortCircuitsOtherAgents() {
     // Test RxJava Disposal behavior: SlowAgent won't emit anything
     subscriber.assertValueCount(2);
   }
+
+  @Test
+  public void runAsync_nestedLoopEscalation_keepsSiblingBranchesRunning() {
+    TestScheduler testScheduler = new TestScheduler();
+
+    TestAgent escalatingAgent =
+        new TestAgent(
+            "escalating_agent",
+            10,
+            testScheduler,
+            "Escalating!",
+            EventActions.builder().escalate(true).build());
+
+    TestAgent slowAgent = new TestAgent("slow_agent", 100, testScheduler, "Finished");
+
+    LoopAgent loopAgent =
+        LoopAgent.builder().name("loop").subAgents(escalatingAgent).maxIterations(3).build();
+
+    ParallelAgent parallelAgent =
+        ParallelAgent.builder()
+            .name("parallel_agent")
+            .subAgents(loopAgent, slowAgent)
+            .scheduler(testScheduler)
+            .build();
+
+    InvocationContext invocationContext = createInvocationContext(parallelAgent);
+
+    var subscriber = parallelAgent.runAsync(invocationContext).test();
+
+    // Escalation is raised on the first iteration, so the loop stops there even though
+    // maxIterations(3) would have allowed two more passes at 20ms and 30ms. Advancing
+    // past all three windows proves the cut came from the escalation, not the cap.
+    testScheduler.advanceTimeBy(40, MILLISECONDS);
+    subscriber.assertValueCount(1);
+    assertThat(subscriber.values().get(0).author()).isEqualTo("escalating_agent");
+    // The escalation came from a nested agent, not a direct sub-agent, so the parallel
+    // agent must not short-circuit its remaining branches.
+    subscriber.assertNotComplete();
+
+    // Slow agent completes at 100ms
+    testScheduler.advanceTimeBy(100, MILLISECONDS);
+    subscriber.assertValueCount(2);
+
+    Event event1 = subscriber.values().get(0);
+    assertThat(event1.author()).isEqualTo("escalating_agent");
+    assertThat(event1.actions().escalate()).hasValue(true);
+
+    Event event2 = subscriber.values().get(1);
+    assertThat(event2.author()).isEqualTo("slow_agent");
+
+    subscriber.assertComplete();
+  }
 }
```

---

### Incident Patch 10: `fc3e3529` (2026-09-09)
**Commit Message**: fix(agents): only stop ParallelAgent on direct sub-agent escalation
Match adk-python: nested escalate events must not cancel sibling branches.
Adds regression test for LoopAgent nested under ParallelAgent.

**File**: `core/src/main/java/com/google/adk/agents/ParallelAgent.java` (modified, +20/-1)
```diff
@@ -19,12 +19,15 @@
 
 import com.google.adk.agents.ConfigAgentUtils.ConfigurationException;
 import com.google.adk.events.Event;
+import com.google.common.collect.ImmutableSet;
 import com.google.errorprone.annotations.CanIgnoreReturnValue;
 import io.reactivex.rxjava3.core.Flowable;
 import io.reactivex.rxjava3.core.Scheduler;
 import io.reactivex.rxjava3.schedulers.Schedulers;
 import java.util.ArrayList;
 import java.util.List;
+import java.util.Objects;
+import java.util.Set;
 import org.slf4j.Logger;
 import org.slf4j.LoggerFactory;
 
@@ -175,13 +178,19 @@ protected Flowable<Event> runAsyncImpl(InvocationContext invocationContext) {
       return Flowable.empty();
     }
 
+    ImmutableSet<String> directSubAgentNames =
+        currentSubAgents.stream()
+            .map(BaseAgent::name)
+            .filter(Objects::nonNull)
+            .collect(ImmutableSet.toImmutableSet());
+
     var updatedInvocationContext = setBranchForCurrentAgent(this, invocationContext);
     List<Flowable<Event>> agentFlowables = new ArrayList<>();
     for (BaseAgent subAgent : currentSubAgents) {
       agentFlowables.add(subAgent.runAsync(updatedInvocationContext).subscribeOn(scheduler));
     }
     return Flowable.merge(agentFlowables)
-        .takeUntil((Event event) -> event.actions().escalate().orElse(false));
+        .takeUntil((Event event) -> asksThisAgentToExit(event, directSubAgentNames));
   }
 
   /**
@@ -195,4 +204,14 @@ protected Flowable<Event> runLiveImpl(InvocationContext invocationContext) {
     return Flowable.error(
         new UnsupportedOperationException("runLive is not defined for ParallelAgent yet."));
   }
+
+  /**
+   * Returns true if this ParallelAgent should stop remaining sibling branches.
+   *
+   * <p>Only escalate events from a direct sub-agent count. Escalate from a nested agent (for
+   * example inside a LoopAgent) must not cancel sibling branches.
+   */
+  private static boolean asksThisAgentToExit(Event event, Set<String> directSubAgentNames) {
+    return event.actions().escalate().orElse(false) && directSubAgentNames.contains(event.author());
+  }
 }
```

**File**: `core/src/test/java/com/google/adk/agents/ParallelAgentEscalationTest.java` (modified, +52/-0)
```diff
@@ -134,4 +134,56 @@ public void runAsync_escalationEvent_shortCircuitsOtherAgents() {
     // Test RxJava Disposal behavior: SlowAgent won't emit anything
     subscriber.assertValueCount(2);
   }
+
+  @Test
+  public void runAsync_nestedLoopEscalation_keepsSiblingBranchesRunning() {
+    TestScheduler testScheduler = new TestScheduler();
+
+    TestAgent escalatingAgent =
+        new TestAgent(
+            "escalating_agent",
+            10,
+            testScheduler,
+            "Escalating!",
+            EventActions.builder().escalate(true).build());
+
+    TestAgent slowAgent = new TestAgent("slow_agent", 100, testScheduler, "Finished");
+
+    LoopAgent loopAgent =
+        LoopAgent.builder().name("loop").subAgents(escalatingAgent).maxIterations(3).build();
+
+    ParallelAgent parallelAgent =
+        ParallelAgent.builder()
+            .name("parallel_agent")
+            .subAgents(loopAgent, slowAgent)
+            .scheduler(testScheduler)
+            .build();
+
+    InvocationContext invocationContext = createInvocationContext(parallelAgent);
+
+    var subscriber = parallelAgent.runAsync(invocationContext).test();
+
+    // Escalation is raised on the first iteration, so the loop stops there even though
+    // maxIterations(3) would have allowed two more passes at 20ms and 30ms. Advancing
+    // past all three windows proves the cut came from the escalation, not the cap.
+    testScheduler.advanceTimeBy(40, MILLISECONDS);
+    subscriber.assertValueCount(1);
+    assertThat(subscriber.values().get(0).author()).isEqualTo("escalating_agent");
+    // The escalation came from a nested agent, not a direct sub-agent, so the parallel
+    // agent must not short-circuit its remaining branches.
+    subscriber.assertNotComplete();
+
+    // Slow agent completes at 100ms
+    testScheduler.advanceTimeBy(100, MILLISECONDS);
+    subscriber.assertValueCount(2);
+
+    Event event1 = subscriber.values().get(0);
+    assertThat(event1.author()).isEqualTo("escalating_agent");
+    assertThat(event1.actions().escalate()).hasValue(true);
+
+    Event event2 = subscriber.values().get(1);
+    assertThat(event2.author()).isEqualTo("slow_agent");
+
+    subscriber.assertComplete();
+  }
 }
```

#### Recent Merged Pull Requests:
- **PR #1582** (closed): ADK changes (@copybara-service[bot])
- **PR #1581** (closed): chore: sync the changes made since 2026-09-22 (@copybara-service[bot])
- **PR #1580** (closed): ADK changes (@copybara-service[bot])
- **PR #1579** (closed): feat: carry code-execution, media resolution and more config across the Java/Kotlin interop (@copybara-service[bot])
- **PR #1575** (closed): docs: add @deprecated guidance to two deprecated event setters (@copybara-service[bot])
- **PR #1568** (closed): ADK changes (@copybara-service[bot])
- **PR #1567** (closed): fix: keep structuredContent and non-text content in MCP tool results (@copybara-service[bot])
- **PR #1561** (closed): fix: keep one generated id for a function call streamed over several chunks (@copybara-service[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

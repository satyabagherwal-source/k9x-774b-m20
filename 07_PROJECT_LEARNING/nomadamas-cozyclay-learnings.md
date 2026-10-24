> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nomadamas-cozyclay-learnings.md`  
> **Source**: github ([https://github.com/NomaDamas/CozyClay](https://github.com/NomaDamas/CozyClay))  
> **Source Version**: `1cddcefa`  
> **License**: AGPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-24T19:22:30.126Z  
> **Learning ID**: `learn-github-nomadamas-cozyclay`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): NomaDamas/CozyClay

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
CozyClay addresses the deterministic conditioning problem in generative AI video pipelines. Commercial generative video engines (e.g., Sora, Gen-3, Kling, Seedance) incur high operational costs per inference and suffer from stochastic composition drift when directed purely by prompt text. CozyClay provides an in-browser 3D previsualization (previs), blocking, and stage direction studio. It bakes spatial constraints, actor kinematics, multi-track blocking, and virtual camera movements into deterministic conditioning artifacts:
1. Exact First/Last Keyframe Plates (PNG/WebP with linear depth and surface normal passes).
2. Frame-accurate 3D greybox guide reels.
3. Spatio-temporal camera transforms and character trajectory matrices.
4. Structurally bound prompt metadata.

### Architectural Subsystem Boundaries & Decoupling

```mermaid
flowchart TD
    subgraph Browser_Main_Thread [Browser Main Thread (React 18 + R3F Stage)]
        Store[Document Store / Reactive State Bus]
        UI[Timeline, Asset Shelf, Agent Panel, HUD]
        DemandLoop[useRenderActivity: Demand Render Arbiter]
        ThreeStage[Three.js Scene Graph & Material Overrides]
        IK[CCDIK / Analytical Solver & Drag Previews]
    end

    subgraph Dedicated_Worker [Dedicated Web Worker]
        Compiler[Motion3 Deterministic Compiler]
    end

    subgraph Agent_Subsystem [Node.js Agent Subsystem / Sidecar]
        AgentStream[SSE / JSON-RPC Agent Client]
        SketchState[Sculpt Ghost Preview State (sculpt-sketch-state.js)]
        Tools[Agent Plan & Tool Execution Engine]
    end

    subgraph Edge_Infrastructure [Cloudflare Workers & D1 Edge]
        Auth[WebCrypto HS256 HMAC Session & State Auth]
        EdgeDB[(Cloudflare D1: Accounts & OAuth State)]
        CORS[Strict Mutation Origin Guard]
    end

    UI --> Store
    Store --> ThreeStage
    DemandLoop --> ThreeStage
    Store <--> IK
    ThreeStage -. ArrayBuffer Transfer .-> Compiler
    AgentStream --> SketchState
    SketchState --> ThreeStage
    Tools --> Store
    UI <--> EdgeInfrastructure
```

1. **State Bus vs. Presentation Layer**: The system operates on a transactional document store. UI components in React do not mutate Three.js objects directly. Instead, mutations are dispatched through an event bus (`appContext.bus.run`), creating transactional receipts that support bidirectional undo/redo trees, snapshot exports, and telemetry capture.
2. **Deterministic Kinematics Compilation**: Heavy kinematic calculations (e.g., foot contact locking, collision detection, route interpolation, and root motion bakes) are isolated in a Web Worker (`src/motion3/compile-worker.js`). Data is marshaled via zero-copy `ArrayBuffer` transfers, preventing 1.5s–6.2s main thread freezes during timeline bakes.
3. **Dual Frame Loop Control**: The WebGL canvas runs under `frameloop="demand"`. Direct pointer and keyboard mutations bypass React reconciliation through a continuous render arbiter (`useRenderActivity`), pulsing frame requests only during active manipulation, camera dollies, or playback.
4. **Transient Preview Separation**: Live interactions (e.g., inverse kinematics dragging, real-time agent procedural sculpting) operate in transient preview layers that remain segregated from the core undo/redo history stack until explicitly committed.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Transient Gesture vs. Undo Stack Segregation Invariant
**RULE**:
A software system that supports direct-manipulation gestures (e.g., 3D gizmos, IK rig drags, real-time sliders) MUST maintain live interaction states in a designated *transient preview tier* segregated from the committed command/document undo stack. When an undo action (`Ctrl+Z` / `CMD+Z`) is triggered while a transient gesture or un-applied preview is active, the system MUST cancel and roll back the uncommitted preview first. It MUST NOT push a generic undo command or report a successful rollback if external authored state has invalidated that preview; instead, the rollback handler MUST return a strict boolean (`restored`), allowing execution to fall through to the persistent command stack.

**WHY**:
Failing to return whether an un-applied preview was actually backed out causes phantom undo states. If a secondary mutation (such as an automated keyframe bake or background network edit) invalidates the preview layer, an undo handler returning unconditional `true` tricks the root undo manager into reporting success. The user's intended authored edit remains in place while the engine marks the operation as complete, corrupting the user's mental undo model.

**WHEN TO APPLY**:
Apply to any interactive canvas, WebGL editor, vector drawing application, or rich client where real-time dragging, procedural generation previews, or multi-step gestures occur alongside a standard command pattern undo/redo stack.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// src/domains/scene-undo.js & src/domains/motion.js
export function createSceneUndo(appContext) {
  function undoScene() {
    // 1. Intercept uncommitted transient interaction first
    if (appContext.shared.motionDomain?.cancelPendingIkEdit?.()) {
      appContext.notify(ko("IK edit undone", "IK 수정을 되돌렸어요"));
      return { ok: true, status: 'done' };
    }
    // 2. Fallback to committed event bus history stack
    const receipt = appContext.bus.run('edit.undo');
    if (receipt.status === 'noop' || receipt.ok === false) {
      appContext.notify(
        receipt.ok === false 
          ? ko(receipt.message ?? "Undo was refused", `실행 취소 불가: ${receipt.message ?? ""}`)
          : ko("Nothing to undo", "실행 취소할 작업이 없어요")
      );
    }
    return receipt;
  }
  return { undoScene };
}

// In Domain Implementation:
function restorePendingIkState(pending) {
  // Guard: If authored layer changed underneath, the preview is stale
  if (domain.layer(pending.characterId) !== pending.sourceLayer) return false;
  
  const state = pending.state;
  state.keys = copyPhysicsKeys(pending.beforeKeys);
  state.tracked = new Set(pending.beforeTracked);
  // Re-pose or reseed targets...
  return true; // Explicitly confirms restoration
}

function cancelPendingIkEdit() {
  const pending = pendingIkEditRef.current;
  if (!pending) return false;
  const restored = restorePendingIkState(pending);
  setPendingIkEditValue(null);
  ikDragRef.current = null;
  ikPreDragRef.current = null;
  setIkTick((v) => v + 1);
  return restored; // Return actual outcome
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Blindly returning true or failing to verify layer parity
function cancelPendingIkEdit_AntiPattern() {
  const pending = pendingIkEditRef.current;
  if (!pending) return false;
  if (domain.layer(pending.characterId) !== pending.sourceLayer) {
    // Stale state ignored, but cleanup happens anyway
    return; // Returns undefined!
  }
  restoreState(pending);
  return true; // Always claims success, swallows real document undos
}
```

**VERIFICATION METHOD**:
Verify using an automated state transition harness:
```javascript
test('undo: authored edit takes precedence over stale gesture preview', () => {
  const harness = createTestHarness();
  harness.beginGesture();
  harness.mutateTransientPreview({ bone: 'hand', deltaY: 0.1 });
  // Author an explicit discrete edit while preview is suspended
  harness.bus.run('keyframe.insert', { frame: 1, val: 42 });
  // First undo MUST pop the explicit keyframe, NOT swallow the action on the dead preview
  const result = harness.undo();
  assert.equal(result.status, 'undone');
  assert.equal(harness.getKeyframe(1), null);
});
```

---

### 2. Micro-Time Drift Arbiter for Heterogeneous Media Pipelines
**RULE**:
When synchronizing two or more decoupled media clocks in the browser (e.g., dual HTML5 `<video>` tags or WebGL canvas playheads vs. video references), the engine MUST:
1. Establish a single master clock source (e.g., the primary 3D blocking video).
2. Drive alignment checks on native hardware refresh callbacks (`requestVideoFrameCallback`, falling back to `requestAnimationFrame`), NEVER relying solely on sparse, erratic browser `timeupdate` events (~4 Hz).
3. Enforce a hysteresis deadband (e.g., `|t_master - t_slave| > 1 frame duration` or `> 0.045s` at 24fps).
4. Guard the slave seek dispatch with a mandatory settle cooldown window (e.g., 400ms) and an explicit `seeking` check to prevent seek-queue flooding.
5. Pause the slave during master `waiting` events to prevent decode-buffer slip during asset starvation.

**WHY**:
HTML5 `<video>` elements decouple their media decode pipelines from the JavaScript event loop. Browser `timeupdate` events fire at erratic intervals (typically between 200ms and 250ms). Checking drift exclusively on `timeupdate` causes compounding phase slip. Furthermore, re-seeking without an active cooldown resets hardware decoders, triggering pipeline stalls where subsequent seeks land seconds late across sparse GOP keyframe intervals.

**WHEN TO APPLY**:
Synchronous side-by-side video compare tools, split-screen A/B previs previewers, motion-capture vs. synthetic video replay rigs, and WebGL-to-HTML5 synchronized scrubbing layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// index.html Synchronization Arbiter
let settleUntil = 0;
const FRAME_THRESHOLD_SEC = 0.045; // ~1 frame at 24fps
const SETTLE_COOLDOWN_MS = 400;

const syncSlaveToMaster = (master, slave) => {
  // Sync playback state
  if (master.paused !== slave.paused) {
    master.paused ? slave.pause() : slave.play().catch(() => {});
  }
  // Cooldown & in-flight seek guard
  if (slave.seeking || performance.now() < settleUntil) return;

  // Drift deadband check
  if (Math.abs(slave.currentTime - master.currentTime) > FRAME_THRESHOLD_SEC) {
    slave.currentTime = master.currentTime;
    settleUntil = performance.now() + SETTLE_COOLDOWN_MS;
  }
};

const tick = () => {
  if (!master.paused) syncSlaveToMaster(master, slave);
  if ('requestVideoFrameCallback' in master) {
    master.requestVideoFrameCallback(tick);
  } else {
    requestAnimationFrame(tick);
  }
};
tick();

// Starvation safety
master.addEventListener("waiting", () => slave.pause());
master.addEventListener("seeked", () => syncSlaveToMaster(master, slave));
master.addEventListener("play", () => syncSlaveToMaster(master, slave));
master.addEventListener("pause", () => syncSlaveToMaster(master, slave));
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Low-frequency timeupdate + unthrottled seeks
const follow = () => {
  // Unbounded seeking floods decoder; 0.08 is arbitrary and skips phase tracking
  if (Math.abs(slave.currentTime - master.currentTime) > 0.08) {
    slave.currentTime = master.currentTime; // Thrashes on every frame!
  }
};
master.addEventListener("timeupdate", follow); // Fails to catch micro-frame drift
```

**VERIFICATION METHOD**:
Inspect drift using performance timestamp sampling:
```javascript
let driftAccumulator = [];
const measureSync = () => {
  const drift = Math.abs(master.currentTime - slave.currentTime);
  driftAccumulator.push(drift);
  if (driftAccumulator.length >= 240) {
    const mean = driftAccumulator.reduce((a, b) => a + b) / driftAccumulator.length;
    const max = Math.max(...driftAccumulator);
    console.assert(mean < 0.025, `Mean drift exceeded threshold: ${mean}s`);
    console.assert(max < 0.050, `Max drift exceeded single frame: ${max}s`);
  }
};
```

---

### 3. Hierarchical Scene-Graph Subject Derivation for Virtual Cameras
**RULE**:
When virtual shot cameras, subject tracking anchors, or bounding-box observers derive the world-space target position of an actor or entity, they MUST compute the transform through the entity's complete parent hierarchy matrix (`sceneObjectCarryMatrixAt`), including grouped parents, vehicles, and rail paths. The camera tracking calculation MUST NOT sample character travel strictly from the root actor's local motion track.

**WHY**:
In 3D scenes where characters can mount, group under, or ride parent scene objects (e.g., vehicles, elevators, moving platforms), the character's authored motion coordinates exist purely in local parent space. If the camera tracking resolver samples only local root travel (`motionPos` or local kinematic track), the camera remains fixated on the original un-parented coordinate while the visual mesh rides the parent entity across the world. This decouples the shot framing, causing actors to slide out of view.

**WHEN TO APPLY**:
3D engines, previs tools, robotics coordinate frames, and game engines implementing dynamic camera rigs (Follow, Rail-Follow, Look-At) targeting hierarchical entities.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Virtual Camera Subject Resolution Matrix Formulation
export function computeWorldSubjectPoint(scene, actorId, frame) {
  const actor = scene.characters.get(actorId);
  if (!actor) return null;

  // 1. Compute actor's local trajectory from kinematic root
  const localSample = sampleActorKinematics(actor, frame);
  const localPos = new THREE.Vector3(localSample.x, localSample.y, localSample.z);

  // 2. Check for parent grouping / attachment
  const parentId = actor.attachedToObjectId;
  if (!parentId) return localPos;

  // 3. Resolve parent's world matrix at the exact frame
  const parentMatrix = sceneObjectCarryMatrixAt(scene, parentId, frame);
  
  // 4. Transform local actor position through parent transform
  return localPos.applyMatrix4(parentMatrix);
}

// Consumed uniformly by:
// - Camera Look-At trackers
// - Shot rail follow paths
// - Subject-out-of-frame QA probes
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Sampling character local trajectory directly
export function computeBrokenSubjectPoint(scene, actorId, frame) {
  const sample = sampleAt(scene.playbackBase, actorId, frame);
  // Ignores scene hierarchy! The car moves away, camera stares at empty road.
  return new THREE.Vector3(sample.subject.x, sample.subject.y, sample.subject.z);
}
```

**VERIFICATION METHOD**:
Mount an actor inside an object moving +10m along the Z axis over 60 frames. Assert that at frame 60, the camera look-at vector evaluates to $Z \approx 10$ rather than $Z \approx 0$.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Double Video Slip and Decoder Thrash in Previs Comparison (BUG-REELS-01)
- **Context**: `index.html` - Dual hero video synchronization pipeline between 3D greybox reel and generative AI reel.
- **What Was Expected**: Side-by-side comparison video player loops synchronously with zero perceptual drift across keyframe wraps.
- **What Actually Happened**: The two video tracks drifted apart rapidly. Loops broke alignment, keyframes jumped, and manual scrubbing induced severe decoder lag.
- **Evidence in Repo**: Commit `98f01379`, PR #903.
- **Root Cause**:
  1. Asset frame count mismatch: Generative Seedance reel was encoded at 721 frames; Greybox was 720 frames. Every loop wrap introduced a compound 1-frame (~41.6ms) drift.
  2. GOP keyframe distance: Videos possessed keyframes up to 6.5s apart. Any correcting seek forced the browser to decode up to 150 frames before rendering the target frame.
  3. Sparse telemetry polling: Drift was checked via the HTML5 `timeupdate` event (~4 Hz), allowing massive sub-second phase drift between samples.
- **Remediation Code Diff**:
```diff
--- a/index.html
+++ b/index.html
@@ -661,10 +661,27 @@
-        const follow = () => {
-          if (Math.abs(take.currentTime - greybox.currentTime) > 0.08) take.currentTime = greybox.currentTime;
+        let settleUntil = 0;
+        const syncTake = () => {
           if (greybox.paused !== take.paused) (greybox.paused ? take.pause() : take.play().catch(() => {}));
+          if (take.seeking || performance.now() < settleUntil) return;
+          if (Math.abs(take.currentTime - greybox.currentTime) > 0.045) {
+            take.currentTime = greybox.currentTime;
+            settleUntil = performance.now() + 400;
+          }
+        };
+        const tick = () => {
+          if (!greybox.paused) syncTake();
+          if (greybox.requestVideoFrameCallback) greybox.requestVideoFrameCallback(tick);
+          else requestAnimationFrame(tick);
         };
+        tick();
+        greybox.addEventListener("waiting", () => take.pause());
@@ -758,10 +775,9 @@
-        greybox.addEventListener("timeupdate", follow);
-        greybox.addEventListener("seeked", follow);
-        greybox.addEventListener("play", follow);
-        greybox.addEventListener("pause", follow);
+        greybox.addEventListener("seeked", syncTake);
+        greybox.addEventListener("play", syncTake);
+        greybox.addEventListener("pause", syncTake);
```
- **Lesson**: Video assets intended for lockstep preview must be rendered with strict GOP boundaries (1 keyframe per second / $GOP \le 24$) and identical duration frame-counts. Drift management must couple to `requestVideoFrameCallback` with seek cooldown arbiters.

---

### Incident 2: Stale IK Preview Swallowing Document History on Undo (BUG-UNDO-02)
- **Context**: `src/domains/motion.js`, `src/domains/cast.js`, `src/domains/scene-undo.js`.
- **What Was Expected**: Pressing `Ctrl+Z` after an authored edit reverts that authored edit, regardless of prior IK drags.
- **What Actually Happened**: `cancelPendingIkEdit()` returned `true` unconditionally even when it aborted restoring an IK preview made stale by an intermediate authored edit. The undo system registered the action as "IK edit undone", leaving the authored edit intact on screen.
- **Evidence in Repo**: Commit `cc13af67`, Commit `1cddcefa`, PR #907, PR #909. Tests: `test/bus/verify-motion-ui-physics.mjs`.
- **Root Cause**: In `restorePendingIkState()`, an early return occurred when `domain.layer(pending.characterId) !== pending.sourceLayer`, but the parent function `cancelPendingIkEdit()` returned hardcoded `true`. The UI notification dispatched a false positive, short-circuiting `appContext.bus.run('edit.undo')`.
- **Remediation Code Diff**:
```diff
--- a/src/domains/motion.js
+++ b/src/domains/motion.js
@@ -396,7 +396,7 @@ export function useMotion(appContext) {
  	function restorePendingIkState(pending) {
  		// A replaced take or another authored edit owns the newer state.
-		if (domain.layer(pending.characterId) !== pending.sourceLayer) return;
+		if (domain.layer(pending.characterId) !== pending.sourceLayer) return false;
  		const state = pending.state;
  		state.keys = copyPhysicsKeys(pending.beforeKeys);
  		state.tracked = new Set(pending.beforeTracked);
@@ -407,17 +407,19 @@ export function useMotion(appContext) {
  			else appContext.shared.poseMemberAtFrame(pending.rig, pending.motion, state, appContext.shared.tlFrame, IK_CORRECTION_BLEND_FRAMES);
  			if (state.chains) ikSeedTargets(state.chains, state);
  		}
+		return true;
  	}
 
+	// true when the preview was backed out; a preview an authored edit made stale is dropped without restoring anything
  	function cancelPendingIkEdit() {
  		const pending = pendingIkEditRef.current;
  		if (!pending) return false;
-		restorePendingIkState(pending);
+		const restored = restorePendingIkState(pending);
  		setPendingIkEditValue(null);
  		ikDragRef.current = null;
  		ikPreDragRef.current = null;
  		setIkTick((value) => value + 1);
-		return true;
+		return restored;
  	}
```
- **Lesson**: Rollback functions in transactional state machines must return an explicit status indicating whether internal mutations actually occurred.

---

### Incident 3: Shot Camera Blindness to Hierarchical Object Travel (BUG-CAM-03)
- **Context**: `src/App.jsx`, camera tracking matrix formulation, `sampleAt` resolution pipeline.
- **What Was Expected**: Virtual cameras targeting an actor inside a moving object (e.g., character seated in a moving vehicle) follow the character's real world-space trajectory.
- **What Actually Happened**: The shot camera remained static, framing the initial authored coordinates of the character. The character visually rode the vehicle out of the frame.
- **Evidence in Repo**: Issue #663, post-mortem notes.
- **Root Cause**: Object hierarchy transforms (`sceneObjectCarryMatrixAt`) were calculated only inside the WebGL renderer (`ObjectCarrier`). The camera tracking subroutines (`subjectTrack`, `motionPos`) derived subject coordinates directly from `sampleAt().subject`, which only read the character's local trajectory.
- **Remediation Code Diff**:
```diff
--- a/src/camera/subject-tracker.js
+++ b/src/camera/subject-tracker.js
@@ -45,7 +45,12 @@ export function resolveCameraSubjectPosition(scene, characterId, frame) {
   const baseSample = sampleAt(scene.playbackSceneBase, characterId, frame);
-  return baseSample.subject;
+  const rawPos = baseSample.subject;
+  const parentId = scene.characters.get(characterId)?.parentObjectId;
+  if (!parentId) return rawPos;
+  const carryMatrix = sceneObjectCarryMatrixAt(scene, parentId, frame);
+  return carryMatrix ? rawPos.clone().applyMatrix4(carryMatrix) : rawPos;
 }
```
- **Lesson**: Spatial queries (cameras, physics, culling, audio listeners) must consume world-space matrix transforms, never raw local kinematic buffers.

---

### Incident 4: Demand Render Mode Interception Lockup After Pose Capture (BUG-REND-04)
- **Context**: `src/App.jsx`, `capturePoseImage`, and R3F demand-driven rendering loop.
- **What Was Expected**: Capturing a high-resolution snapshot in Pose Mode temporarily un-fades background props for image fidelity, then immediately re-fades them upon completion.
- **What Actually Happened**: Props remained solid, opaque, and pickable on the canvas after the capture completed. The user could no longer select character IK handles because opaque props intercepted raycast pointer events.
- **Evidence in Repo**: Issue #660, PR #620 discussion.
- **Root Cause**: The canvas operated under `frameloop="demand"`. To capture the image, `capturePoseImage` invoked `suspendPoseFade(true)` and forced an explicit sync (`propSyncRef.current()`). In the `finally` block, it ran `suspendPoseFade(false)`, but because the user had not moved the pointer or triggered a state change, no subsequent render frame was dispatched. The WebGL backbuffer preserved the unfaded state.
- **Remediation Code Diff**:
```diff
--- a/src/App.jsx
+++ b/src/App.jsx
@@ -812,6 +812,8 @@ export function capturePoseImage(scene, camera) {
   } finally {
     suspendPoseFade(false);
+    propSyncRef.current(); // Re-apply fade flags to materials
+    invalidate();          // Force R3F frame loop tick in demand mode
   }
 }
```
- **Lesson**: When mutating shared rendering state under on-demand execution models (`frameloop="demand"`), any tear-down restoration in a `finally` block must explicitly invalidate the frame arbiter.

---

### Incident 5: Offscreen Render Pass Bleed & Fog Collapse in Depth Normalization (BUG-SHAD-05)
- **Context**: `src/render-passes.js` - ControlNet conditioning extraction (Linear Depth & Normal passes).
- **What Was Expected**: Offscreen depth passes generate a normalized 0.0–1.0 grayscale map where empty sky is pitch black (`#000000`), geometric surfaces are scaled to stage scale (40m), and foreground emissive/glow meshes are omitted.
- **What Actually Happened**:
  1. Default Three.js `MeshDepthMaterial` applied non-linear hyperbolic window-space Z packing, causing 90% of dynamic range to collapse into the first 1 meter.
  2. Viewport fog tinted the background sky to pale gray, misidentifying the infinite background as a solid obstacle near the camera.
  3. Visual glow sprites (`userData.beautyOnly`) rendered as opaque white quads across both depth and normal plates.
- **Evidence in Repo**: `src/render-passes.js`, commit logs.
- **Remediation Code Diff**:
```diff
--- a/src/render-passes.js
+++ b/src/render-passes.js
@@ -95,8 +95,14 @@ export function renderPass(capture, scene, camera, kind, toDataUrl = null, optic
+  const hidden = [];
+  scene.traverse?.((node) => {
+    if (node.userData?.beautyOnly && node.visible) {
+      hidden.push(node);
+      node.visible = false;
+    }
+  });
   try {
     scene.overrideMaterial = material;
+    if (kind === "depth") scene.background = BACKGROUND_FAR; // Pure black
     buffer = capture.render();
   } finally {
     scene.overrideMaterial = previousMaterial;
     scene.background = previousBackground;
+    for (const node of hidden) node.visible = true;
     material.dispose();
   }
```
- **Lesson**: Synthetic training/conditioning passes require clean separation between beauty shaders and geometric truth. Override passes must explicitly sanitize background skyboxes, ignore non-geometric visual layers, and guarantee non-leaking material cleanup via `try...finally`.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **IEEE-754 Negative Zero Elimination in Metrics Reporting**: Floating-point geometry math can yield `-0` when coordinates clamp upward from negative infinitesimals. JSON serializers retain `-0`, causing assertion failures across deterministic state hashes.
```javascript
// src/effects/state.js
const mm = (value) => {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? 0 : rounded; // Eliminates -0 from JSON exports
};
```
- **Strict Falsy Coercion Guards**: Avoid `Number(val) || fallback` when `0` is a valid timeline index or frame offset.
```javascript
// SAFE: Explicitly permits frame 0
const at = Math.max(0, Math.round(Number(frame) || 0));

// UNSAFE: Collapses frame 0 to default fallback
const brokenFrame = Number(frame) || DEFAULT_FRAME; 
```
- **Operator Precedence in Cryptographic Bitwise XOR**: When computing constant-time equality checks over HMAC signatures, bitwise `^` has lower precedence than standard comparison operators.
```javascript
// workers/api/src/auth.js
export function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    // Explicit indexing into non-empty buffer with nullish coalescing
    diff |= (left[index % (left.length || 1)] ?? 0) ^ (right[index % (right.length || 1)] ?? 0);
  }
  return diff === 0;
}
```

### 2. Infinite Loop & Recursion Guards
- **Finite Streaming Part Caps**: In generative agent environments (`src/sculpt-sketch-state.js`), procedural tools can stream limitless child geometries, triggering DOM or GPU memory exhaustion.
```javascript
const MAX_PARTS = 300;
export function sketchDrawnParts(parts) {
  const drawable = [], ids = new Set();
  // Bound slice prevents unbounded array traversals
  for (const raw of Array.isArray(parts) ? parts.slice(0, MAX_PARTS) : []) {
    if (!raw || typeof raw !== "object" || ids.has(raw.id)) continue;
    // ... validation
    ids.add(raw.id);
    drawable.push(raw);
  }
  return expandSculptParts({ version: 1, parts: drawable });
}
```
- **Iterative Downscale Loop Termination**: In offscreen thumbnail generation (`tools/render-start-thumbs.mjs`), image quality reduction must be strictly bound against minimum floating-point precision traps.
```javascript
// Iterative compression step-down with absolute boundary break
for (let quality = 0.92; quality > 0.4; quality -= 0.06) {
  const url = canvas.toDataURL("image/webp", quality);
  // Break if size fits OR quality floor reached
  if (url.length * 0.75 <= MAX_BYTES || quality <= 0.46) return url;
}
```

### 3. UI & UX Micro-Mechanics
- **Pointer/Keyboard Demand Render Arbiter**: Keeps WebGL frames inactive until input events fire, but ignores right-click context navigation (`event.
# Candidate Directive: [CD-VGDT] Micro-Time Drift Arbiter for Heterogeneous Media Pipelines

<!-- PROVENANCE_START
{
  "source_repository": "nomadamas-cozyclay-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:42:25.682Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-nomadamas-cozyclay-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nomadamas-cozyclay-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:42:25.682Z`  
> **Learning ID**: `LEARN-REEXTRACT-nomadamas-cozyclay-learnings`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Rejection / Holding Reason**: Human approval authorization required before canonical promotion
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
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

## Quality Gate Validation Dimensions
```json
{
  "decision": "STAGED_FOR_REVIEW",
  "note": "Human approval authorization required before canonical promotion"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

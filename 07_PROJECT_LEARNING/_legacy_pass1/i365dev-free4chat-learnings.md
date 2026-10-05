# Forensic Learning Record (Deep Inspection): i365dev/free4chat

> **Canonical Artifact**: `07_PROJECT_LEARNING/i365dev-free4chat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/i365dev/free4chat](https://github.com/i365dev/free4chat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:36:40.419Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `i365dev/free4chat`
- **Description**: Temporary rooms for Humans and AI Agents — run, supervise and steer Agent Tasks without a permanent workspace.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1206 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/internal/harness/lifecycle.go`
```
package harness

import (
	"strings"

	"github.com/i365dev/free4chat/agent/internal/types"
)

// lifecycleLeaveEnvelope is a deliberately closed Harness-to-Runtime
// lifecycle control. It is not Room text, an MCP command, or a general
// Runtime-control grammar: leave is the only action the local Runtime can
// receive from a Harness result.
const lifecycleLeaveEnvelope = "[[free4chat:lifecycle leave]]"

// ParseOutboundResult extracts one strict outbound control from a completed
// Harness reply. Existing targets behavior is preserved exactly. A lifecycle
// intent is recognized only as the final complete line; if an otherwise valid
// targets envelope is also present, both controls fail closed and the full
// reply remains ordinary visible prose.
func ParseOutboundResult(text string) (string, []string, types.LifecycleIntent) {
	body, lifecycle := parseLifecycleIntent(text)
	if lifecycle != types.LifecycleIntentNone {
		// A reply must choose exactly one control surface. Detect a preceding
		// valid targets envelope through its existing strict parser rather than
		// adding a second targets grammar here.
		if _, targets := ParseOutboundTargets(body); len(targets) > 0 {
			return strings.TrimSpace(text), nil, types.LifecycleIntentNone
		}
		return body, nil, lifecycle
	}
	body, targets := ParseOutboundTargets(text)
	// Check the reverse ordering too. A terminal targets envelope may follow
	// an otherwise exact lifecycle line; that lifecycle line is no longer
	// terminal in the complete reply, but it must still prevent routing. A
	// result may never combine the two local control surfaces in either order.
	if len(targets) > 0 {
		if _, lifecycle := parseLifecycleIntent(body); lifecycle != types.LifecycleIntentNone {
			return strings.TrimSpace(text), nil, types.LifecycleIntentNone
		}
	}
	return body, targets, types.LifecycleIntentNone
}

// parseLifecycleIntent recognizes only the exact terminal lifecycle line.
// Approximate, quoted, embedded, or extended forms remain visible ordinary
// prose. It intentionally performs no natural-language interpretation.
func parseLifecycleIntent(text string) (string, types.LifecycleIntent) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return "", types.LifecycleIntentNone
	}
	lines := strings.Split(trimmed, "\n")
	if lines[len(lines)-1] != lifecycleLeaveEnvelope {
		return trimmed, types.LifecycleIntentNone
	}
	body := strings.TrimSpace(strings.Join(lines[:len(lines)-1], "\n"))
	return body, types.LifecycleIntentLeave
}

```

### Core Architecture Module: `agent/internal/media/engine.go`
```
// Package media owns the in-process realtime media plane: the Pion
// PeerConnection engine (ported from the proven pre-Go Pion sidecar
// implementation), the Cloudflare SFU REST client, the shared-session media
// bridge, and the grant controller. ONE shared session serves both Meeting
// Notes (Human audio ingress) and Voice Reply (Agent audio egress); the
// initial bootstrap is receive-only and the outbound track is armed only at
// voice-grant activation.
package media

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/pion/opus"
	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
)

const (
	stunURL           = "stun:stun.cloudflare.com:3478"
	gatherTimeout     = 20 * time.Second
	connectTimeout    = 30 * time.Second
	answerGatherGrace = 2 * time.Second

	// Outbound voice pacing (#83): Opus frames are 20 ms apart on the wire;
	// the writer emits them at wall-clock pace instead of bursting whatever
	// PCM arrived in one chunk. After a stall longer than paceResyncAfter
	// the schedule rebaselines rather than bursting to catch up.
	frameDuration   = 20 * time.Millisecond
	paceResyncAfter = 250 * time.Millisecond

	// opusFrameSamples is one 20 ms frame at 48 kHz mono.
	opusFrameSamples = 960

	// maxQueuePcmBytes bounds the async PCM queue (~21s @24k): enough
	// prefetch to smooth any HTTP burstiness, small enough to stay bounded.
	maxQueuePcmBytes = 1 << 20
)

// Description carries an SDP document across the REST boundary.
type Description struct {
	Type string `json:"type"`
	SDP  string `json:"sdp"`
}

// CodecInfo describes one remote track's codec.
type CodecInfo struct {
	MimeType  string
	ClockRate int
	Channels  int
}

// AudioFrameEvent is one decoded remote RTP payload, attributed by MID.
type AudioFrameEvent struct {
	MID     string
	Payload []byte
	Codec   CodecInfo
}

// TrackEvent announces a remote track.
type TrackEvent struct {
	Kind  string // "audio" | "video"
	MID   string
	Codec CodecInfo
	SSRC  uint32
}

// EngineEvents carries the callback surface the bridge needs.
type EngineEvents struct {
	// OnConnectionStateChange reports Pion connection states (safe names).
	OnConnectionStateChange func(state string)
	// OnICEStateChange reports ICE states (safe names).
	OnICEStateChange func(state string)
	// OnTrack announces one remote track.
	OnTrack func(TrackEvent)
	// OnAudioFrame delivers one decoded RTP payload for an audio MID.
	OnAudioFrame func(AudioFrameEvent)
	// OnDataChannelMessage exposes bounded participant DataChannel payloads to
	// generic Runtime transport owners. It carries no media or Harness semantics.
	OnDataChannelMessage func(label string, payload []byte)
}

// Engine is the in-process Pion PeerConnection (no JSONL boundary). It is a
// pure media engine: SDP in/out, RTP in/out, zero HTTP, zero secrets.
type Engine struct {
	pc     *webrtc.PeerConnection
	ev     EngineEvents
	log    func(event string, details map[string]string)
	dcOpen chan struct{}

	mu             sync.Mutex
	outbound       *webrtc.TrackLocalStaticSample
	publishOn      bool
	pubGeneration  uint64 // bumped on every activate/deactivate (grant boundary)
	turnGeneration uint64 // bumped on every CancelTurn (utterance boundary)
	// Turn admission is a TRUE MONOTONIC WATERMARK within one publication
	// session: highestAdmitted never decreases; cancelledThrough is the max
	// cancelled token. A token <= cancelledThrough or < highestAdmitted is
	// stale by construction — no bounded set can evict a live guard.
	highestAdmitted   uint64
	cancelledThrough  uint64
	encoder           *opus.Encoder
	pcmWriteCalls     uint64
	pcmInputBytes     uint64
	opusFramesWritten uint64
	rtpCounts         map[string]uint64
	nowFn             func() time.Time
	sleepFn           func(time.Duration)
	pacer             *framePacer
	closed            bool

	// Async paced writer: WritePCM only enqueues; the writer goroutine owns
	// framing/carry and emits Opus frames at exact 20 ms cadence. This
	// decouples the TTS stream's bursty arrival from the RTP send timeline —
	// inline pacing made the HTTP reader stall between bursts, starving the
	// browser jitter buffer and producing PLC "robot voice" artifacts.
	writerMu      sync.Mutex
	queueRing     []queueItem
	writerNotify  chan struct{} // wakeup for the writer (item available)
	writerSpace   chan struct{} // wakeup for producers (space freed)
	queueBytes    int
	carry         []byte
	writerRunning bool
	writerStop    chan struct{}
	writerDone    chan struct{}

	// Safe pacing diagnostics (electric-audio investigation): wall-clock gap
	// count between paced frames (rebaseline events) and encode failures.
	// Never RTP values, SDP, or payload content.
	pacedGapCount uint64
	encodeErrors  uint64
	silenceFills  uint64
	fillRun       uint64 // consecutive fills (bounded)
	turnOpen      bool
	// turnInvalidated closes as soon as the active turn is cancelled or its
	// publication is revoked. A flush marker may already be inside a paced
	// writer sleep at that point, so its waiter must not depend on the writer
	// waking before it can release the host voice gate.
	turnInvalidated chan struct{}
}

// framePacer spaces outbound Opus frames one frame-duration apart (ported
// verbatim from the experiment; clock/sleeper injection keeps tests
// deterministic).
type framePacer struct {
	mu    sync.Mutex
	now   func() time.Time
	sleep func(time.Duration)
	next  time.Time
	onGap func() // rebaseline observer (safe counters only)
}

func newFramePacer(now func() time.Time, sleep func(time.Duration)) *framePacer {
	return &framePacer{now: now, sleep: sleep}
}

// scheduled reports whether the pacer has an active frame schedule
// (mid-stream), used to detect gaps that need silence filling.
func (p *framePacer) scheduled() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return !p.next.IsZero()
}

func (p *framePacer) pace() {
	p.mu.Lock()
	now := p.now()
	hadNext := !p.next.IsZero()
	stale := hadNext && now.Sub(p.next) >= paceResyncAfter
	if !hadNext || stale {
		p.next = now.Add(frameDuration)
		p.mu.Unlock()
		if stale && p.onGap != nil {
			p.onGap()
		}
		return
	}
	wait := p.next.Sub(now)
	p.mu.Unlock()
	if wait > 0 {
		p.sleep(wait)
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if after := p.next.Add(frameDuration); after.After(now) {
		p.next = after
	} else {
		p.next = now.Add(frameDuration)
	}
}

// NewEngine builds an idle engine.
func NewEngine(events EngineEvents, log func(event string, details map[string]string)) *Engine {
	if log == nil {
		log = func(string, map[string]string) {}
	}
	return &Engine{
		ev:           events,
		log:          log,
		dcOpen:       make(chan struct{}),
		rtpCounts:    make(map[string]uint64),
		nowFn:        time.Now,
		sleepFn:      time.Sleep,
		writerNotify: make(chan struct{}, 1),
		writerSpace:  make(chan struct{}, 1),
	}
}

// Create builds the PeerConnection with Cloudflare-aligned defaults.
// Meeting Notes bootstrap is receive-only: the outbound voice track stays
// UNARMED until ArmPublish (voice-grant activation).
func (e *Engine) Create() error {
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{{URLs: []string{stunURL}}},
	})
	if err != nil {
		return err
	}
	e.pc = pc
	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		if e.ev.OnICEStateChange != nil {
			e.ev.OnICEStateChange(state.String())
		}
	})
	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		if e.ev.OnConnectionStateChange != nil {
			e.ev.OnConnectionStateChange(state.String())
		}
	})
	pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		e.handleIncomingTrack(track, receiver)
	})
	pc.OnDataChannel(func(channel *webrtc.DataChannel) {
		channel.OnMessage(func(message webrtc.DataChannelMessage) {
			if e.ev.OnDataChannelMessage != nil {
				e.ev.OnDataChannelMessage(channel.Label(), append([]byte(nil), message.Data...))
			}
		})
	})
	return nil
}

// ParticipantDataChannel is the minimal reliable DataChannel surface used by
// bounded participant-local Runtime transports.
type ParticipantDataChannel struct {
	channel *webrtc.DataChannel
}

func (c *ParticipantDataChannel) Label() string {
	if c == nil || c.channel == nil {
		return ""
	}
	return c.channel.Label()
}

func (c *ParticipantDataChannel) Send(payload []byte) error {
	if c == nil || c.channel == nil || c.channel.ReadyState() != webrtc.DataChannelStateOpen {
		return errors.New("datachannel_unavailable")
	}
	return c.channel.Send(payload)
}

// SendText sends a JSON Room App envelope as a WebRTC text frame so browser
// RTCDataChannel consumers receive event.data as a string.
func (c *ParticipantDataChannel) SendText(payload string) error {
	if c == nil || c.channel == nil || c.channel.ReadyState() != webrtc.DataChannelStateOpen {
		return errors.New("datachannel_unavailable")
	}
	return c.channel.SendText(payload)
}

func (c *ParticipantDataChannel) Ready() bool {
	return c != nil && c.channel != nil && c.channel.ReadyState() == webrtc.DataChannelStateOpen
}

func (c *ParticipantDataChannel) OnOpen(handler func()) {
	if c != nil && c.channel != nil && handler != nil {
		c.channel.OnOpen(handler)
	}
}

// CreateParticipantDataChannel registers one already-authorized reliable
// Cloudflare DataChannel with Pion using its negotiated channel id.
func (e *Engine) CreateParticipantDataChannel(label string, id uint16) (*ParticipantDataChannel, error) {
	if e == nil || e.pc == nil || label == "" {
		return nil, errors.New("invalid_datachannel")
	}
	ordered := true
	channel, err := e.pc.CreateDataChannel(label, &webrtc.DataChannelInit{
		Negotiated: &ordered,
		ID:         &id,
		Ordered:    &ordered,
	})
	if err != nil {
		return nil, err
	}
	channel.OnMessage(func(message webrtc.DataChannelMessage) {
		if e.ev.OnDataChannelMessage != nil {
			e.ev.OnDataChannelMessage(channel.Label(), append([]byte(nil), message.Data...))
		}
	})
	return &ParticipantDataChannel{chann
```

### Core Architecture Module: `agent/internal/runtime/lifecycle.go`
```
package runtime

import "github.com/i365dev/free4chat/agent/internal/types"

const lifecycleLeaveFailureText = "I couldn't leave the Room; I'm still connected."

// handleLifecycleIntent consumes the closed local Harness control intent
// before arbitrary Harness body text can be published. It returns true when
// the result was lifecycle-shaped, including rejected and failed paths, so a
// model can never turn its own unverified wording into a successful-leave
// claim while this participant remains resident.
func (r *ResidentRuntime) handleLifecycleIntent(
	input *types.HarnessTurnInput,
	result types.HarnessTurnResult,
	roomEvents []types.RoomEvent,
) bool {
	if result.LifecycleIntent == types.LifecycleIntentNone {
		return false
	}
	// Treat unknown future strings and ambiguous custom-adapter results as
	// fail-closed local controls. Only this release's exact leave value may
	// proceed, and it must never be combined with conversational targeting.
	if result.LifecycleIntent != types.LifecycleIntentLeave ||
		len(result.TargetParticipantIDs) != 0 || !hasAddressedHuman(input) {
		r.log("lifecycle_leave_failed", nil)
		r.settleHumanTask(roomEvents, "failed", "Agent left before completing the task.")
		r.publishLifecycleLeaveFailure()
		return true
	}

	r.log("lifecycle_leave_requested", nil)
	handle, err := r.requireHandle()
	if err != nil {
		r.log("lifecycle_leave_failed", nil)
		r.settleHumanTask(roomEvents, "failed", "Agent left before completing the task.")
		r.publishLifecycleLeaveFailure()
		return true
	}
	scopes, ownsShutdown := r.fenceAdmissionsForShutdown()
	if !ownsShutdown {
		return true
	}
	// `leave_room` invalidates the participant capability on success. Settle
	// the completed Task and fail other captured Tasks before that call, while
	// credentials and pending contexts are still valid.
	if request := humanTaskRequestFor(roomEvents, r.currentParticipantID()); request != nil &&
		!r.settleHumanTask(roomEvents, "completed", "Agent completed the task before leaving the Room.") {
		r.reopenAdmissionsAfterFailedLeave()
		r.log("lifecycle_leave_failed", nil)
		r.publishLifecycleLeaveFailure()
		return true
	}
	r.failPendingHumanTasks(scopes, "Agent stopped before the task completed.")
	// This is the authoritative successful-leave boundary. Normal Stop keeps
	// its best-effort LeaveRoom semantics for operator shutdown, but a Harness
	// lifecycle claim is accepted only after this call confirms success.
	if err := r.options.Client.LeaveRoom(handle); err != nil {
		r.reopenAdmissionsAfterFailedLeave()
		r.log("lifecycle_leave_failed", nil)
		r.publishLifecycleLeaveFailure()
		return true
	}

	if !r.beginStop("") {
		// Another terminal owner already took over. In particular, never emit a
		// delayed Harness body after a concurrent operator stop.
		return true
	}
	// Do not let the later host-owned Stop perform a second best-effort leave.
	// Clearing this private capability also makes rejoin impossible because the
	// terminal state has already closed stopCh before the wait loop can retry.
	r.mu.Lock()
	r.participantHandle = ""
	r.participantID = ""
	r.mu.Unlock()
	r.log("lifecycle_leave_completed", nil)

	if r.options.OnSelfLeave != nil {
		// The daemon implementation schedules Stop/unregister/workspace cleanup
		// in another goroutine. Calling blocking Stop here would self-wait on
		// this wait-loop goroutine through loopWG.
		r.options.OnSelfLeave()
	} else {
		// Standalone Runtime users still receive bounded cleanup without a
		// daemon, while preserving the same no-self-wait ordering.
		go r.Stop()
	}
	return true
}

// reopenAdmissionsAfterFailedLeave restores a recoverable Runtime when the
// explicit LeaveRoom request was rejected. Any Tasks already settled while the
// terminal attempt was in flight remain terminal; future requests can proceed.
func (r *ResidentRuntime) reopenAdmissionsAfterFailedLeave() {
	r.mu.Lock()
	if !r.stopped {
		r.admissionsClosed = false
	}
	r.mu.Unlock()
}

// hasAddressedHuman is the hard structural gate for the one lifecycle action:
// unaddressed Room context, Agent-authored text, transcript content, and
// attachment content cannot create this authority.
func hasAddressedHuman(input *types.HarnessTurnInput) bool {
	if input == nil {
		return false
	}
	for _, event := range input.Events {
		if event.Addressed && event.Kind == types.KindHuman {
			return true
		}
	}
	return false
}

// publishLifecycleLeaveFailure uses Runtime-owned fixed truth rather than any
// model-supplied body. Failure keeps the resident, handle, and reconnect path
// live; a send failure is diagnostic-only and never becomes a success claim.
func (r *ResidentRuntime) publishLifecycleLeaveFailure() {
	handle, err := r.requireHandle()
	if err != nil {
		return
	}
	if _, err := r.options.Client.SendText(handle, lifecycleLeaveFailureText, nil); err != nil {
		r.log("lifecycle_leave_failure_report_failed", nil)
	}
}

```

### Core Architecture Module: `app/e2e/room/run-local-worker.mjs`
```
// Local Room E2E harness (#275).
//
// Runs the REAL production Worker (wrangler.jsonc) inside Wrangler's modern
// createTestHarness, backed by the REAL RoomSession Durable Object, ROOMS_KV,
// Worker routes and WebSocket handling. Only the Cloudflare Realtime upstream
// is faked (loopback HTTP server), and only the browser media bootstrap is
// shimmed (see room.spec.ts addInitScript).
//
// The harness listens on a dynamic loopback URL. The production origin
// allow-list only accepts e.g. http://localhost:3000, so a tiny loopback
// reverse proxy binds the canonical allowed origin and forwards everything
// (including WebSocket upgrades) to the harness URL. Production origin
// validation is deliberately untouched.
import fs from "node:fs"
import http from "node:http"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { createTestHarness } from "wrangler"

const PROXY_HOST = "127.0.0.1"
// The ONLY locally allowed production origin (src/common/origin.ts). This is
// also the documented `wrangler dev --local --port 3000` convention.
const PROXY_PORT = Number(process.env.FREE4CHAT_E2E_PROXY_PORT ?? 3000)

const DUMMY_APP_ID = "test-app"
const DUMMY_APP_SECRET = "test-secret"

// ---------------------------------------------------------------------------
// Fake Cloudflare Realtime upstream (fail-closed).
// ---------------------------------------------------------------------------
function createFakeRealtime() {
  /** @type {Array<{method: string, path: string}>} */
  const requests = []
  /** @type {Array<{method: string, path: string}>} unexpected requests that
   * were NOT explicitly handled — the E2E spec hard-asserts this is empty. */
  const unexpected = []
  /** Monotonic per-session data channel ids, like the real Realtime API. */
  let nextDataChannelId = 0
  const server = http.createServer((req, res) => {
    const path = req.url ?? ""
    if (req.method === "GET" && path === "/__fake/requests") {
      const payload = JSON.stringify({ requests, unexpected })
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      })
      res.end(payload)
      return
    }
    requests.push({ method: req.method ?? "?", path })
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => {
      const send = (status, payload) => {
        res.writeHead(status, { "Content-Type": "application/json" })
        res.end(JSON.stringify(payload))
      }
      // Exact minimal contract for the HUMAN Room join path
      // (see sfu/server.ts realtimeRequest call sites):
      //   1. /sessions/new        -> { sessionId }
      //   2. /datachannels/establish -> passthrough; {} is enough for the
      //      browser to continue (no renegotiation, no remote description)
      //   3. /datachannels/new    -> { dataChannels: [{ id }] }
      if (req.method === "POST" && path.endsWith("/sessions/new")) {
        send(200, { sessionId: randomUUID() })
        return
      }
      const establish = path.match(
        /\/sessions\/[^/]+\/datachannels\/establish$/
      )
      if (req.method === "POST" && establish) {
        send(200, {})
        return
      }
      const channelsNew = path.match(/\/sessions\/[^/]+\/datachannels\/new$/)
      if (req.method === "POST" && channelsNew) {
        // Cloudflare Realtime returns one created channel per REQUESTED entry,
        // with unique ids on the session. Modeling that matters: the Room App
        // host lane requests two negotiated channels (reliable + realtime) and
        // Core fails closed when the returned ids do not line up, which would
        // silently disable the whole Room App surface in this harness.
        let requested = 0
        try {
          const parsed = JSON.parse(body)
          if (Array.isArray(parsed?.dataChannels))
            requested = parsed.dataChannels.length
        } catch {
          requested = 0
        }
        const count = requested > 0 ? requested : 1
        const dataChannels = Array.from({ length: count }, () => ({
          id: (nextDataChannelId += 1),
        }))
        send(200, { dataChannels })
        return
      }
      const channelsClose = path.match(
        /\/sessions\/[^/]+\/datachannels\/close$/
      )
      if (req.method === "PUT" && channelsClose) {
        send(200, { dataChannels: [] })
        return
      }
      // Human audio publish: sfu/server.ts requires a usable answer + a mid
      // per local track (usableHumanPublication) before advertising the
      // track. The browser's fake peer connection never parses this SDP.
      const tracksNew = path.match(/\/sessions\/[^/]+\/tracks\/new$/)
      if (req.method === "POST" && tracksNew) {
        send(200, {
          sessionDescription: { type: "answer", sdp: "v=0\r\n" },
          tracks: [{ mid: "0", trackName: "m-audio" }],
        })
        return
      }
      const renegotiate = path.match(/\/sessions\/[^/]+\/renegotiate$/)
      if (req.method === "PUT" && renegotiate) {
        send(200, {})
        return
      }
      // Fail closed: any other outbound call is a test-contract violation,
      // never an accidental network request. The request is recorded so the
      // E2E spec can hard-fail on it even when production semantics would
      // swallow the upstream 503 (e.g. best-effort media cleanup).
      unexpected.push({ method: req.method ?? "?", path })
      console.error(
        `[fake-realtime] UNEXPECTED ${req.method} ${path} — failing closed`
      )
      send(503, { error: "unexpected_sfu_request", path })
      void body
    })
  })
  return {
    requests,
    unexpected,
    async listen() {
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
      const address = server.address()
      if (!address || typeof address === "string")
        throw new Error("no loopback")
      return `http://127.0.0.1:${address.port}/v1/apps/${DUMMY_APP_ID}`
    },
    close() {
      return new Promise((resolve) => server.close(resolve))
    },
  }
}

// ---------------------------------------------------------------------------
// Transparent loopback relay bound to the canonical allowed origin.
// ---------------------------------------------------------------------------
// A plain TCP relay (no HTTP/WebSocket protocol handling) forwards every
// connection — including WebSocket upgrades — untouched to the harness URL.
// The browser sees origin http://localhost:3000, which is already in the
// production allow-list, so src/common/origin.ts is never weakened.
const stateDir =
  process.env.FREE4CHAT_E2E_STATE_DIR ?? path.join(os.tmpdir(), "f4c-room-e2e")
const fakePortFile = path.join(stateDir, "fake-port.txt")
// The harness records its OWN pid so shutdown validation and scripts can
// always signal the real Worker process (bash job wrappers may report a
// different pid; signalling a wrapper leaves node orphaned).
const harnessPidFile = path.join(stateDir, "harness.pid")

function createProxy(targetPort) {
  const server = net.createServer((socket) => {
    const upstream = net.connect(targetPort, "127.0.0.1", () => {
      socket.pipe(upstream)
      upstream.pipe(socket)
    })
    socket.on("error", () => socket.destroy())
    upstream.on("error", () => socket.destroy())
  })
  return {
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(PROXY_PORT, PROXY_HOST, resolve)
      })
    },
    close() {
      return new Promise((resolve) => server.close(resolve))
    },
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const fakeRealtime = createFakeRealtime()
  runningFakeRealtime = fakeRealtime
  const fakeRealtimeBase = await fakeRealtime.listen()
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(harnessPidFile, String(process.pid))
  fs.writeFileSync(fakePortFile, String(new URL(fakeRealtimeBase).port))
  console.log(
    `[harness] fake realtime at ${fakeRealtimeBase} (port file ${fakePortFile})`
  )

  const server = createTestHarness({
    workers: [
      {
        configPath: "./wrangler.jsonc",
        // Test-only seam (documented createTestHarness API): resolve the
        // production binding name inside this harness instead of reaching an
        // undeployed remote service.
        bindingOverrides: {
          ROOM_APP_CONTROL_PLANE: "free4chat-room-app-control-plane",
        },
        vars: {
          SFU_APP_ID: DUMMY_APP_ID,
          // #275: intercept every Cloudflare Realtime call at the loopback
          // fake; nothing ever reaches rtc.live.cloudflare.com.
          SFU_RTC_BASE_URL: fakeRealtimeBase,
          // #406: the fresh-Human Turnstile admission is bypassed EXPLICITLY
          // here — never by production fail-open. The empty secret only
          // neutralizes whatever a local .dev.vars might otherwise contribute
          // to this harness.
          TURNSTILE_SECRET_KEY: "",
          TURNSTILE_DISABLED: "true",
          AGENT_MEDIA_ENABLED: "false",
          // #398: the Room App host surface must be reachable in the local
          // harness exactly as it is in production (wrangler.jsonc already
          // sets this var; the harness vars are explicit so the boundary is
          // visible at the call site).
          ROOM_APPS_ENABLED: "true",
        },
        secrets: {
          SFU_APP_SECRET: DUMMY_APP_SECRET,
        },
      },
      {
        // #398: wrangler.jsonc declares the Lab-owned control-plane service
        // binding, and workerd refuses to start when a bound service does not
        // exist in the harness. This local stub keeps the production worker
        // name, catalog URL and bounded v1 schema while serving only
```

### Core Architecture Module: `app/src/common/utils.tsx`
```
import { Color } from "@common/types"

import { noteRoomHistoryWrite, ROOM_HISTORY_STORAGE_KEY } from "./roomHistory"

export const saveRoomToLocalStorage = (roomName, nickName) => {
  // #346: freeze the pre-visit Room history BEFORE this launch's own entry is
  // written, so repeat-use direction can never count the current Room as
  // prior use (and can still count a genuinely returning one).
  noteRoomHistoryWrite()
  var rooms: {}[] = JSON.parse(
    localStorage.getItem(ROOM_HISTORY_STORAGE_KEY) || "[]"
  )
  rooms = rooms.filter((room: any) => room.roomName !== roomName)
  rooms.push({ roomName: roomName, nickName: nickName })
  localStorage.setItem(ROOM_HISTORY_STORAGE_KEY, JSON.stringify(rooms))
}

export const nameToColor = (name: string) => {
  let r = 0
  let g = 0
  let b = 0
  for (let i = 0; i < name.length / 3; i++) {
    let code = name.charCodeAt(i)
    g = g + code
    code = name.charCodeAt(i * 2)
    b = b + code
    code = name.charCodeAt(i * 3)
    r = r + code
  }
  return [r % 256, g % 256, b % 256]
}

export const weightedRand = (spec: Record<string, number>) => {
  var i,
    j,
    table: string[] = []
  for (i in spec) {
    // The constant 10 below should be computed based on the
    // weights in the spec for a correct and optimal table size.
    // E.g. the spec {0:0.999, 1:0.001} will break this impl.
    for (j = 0; j < spec[i] * 10; j++) {
      table.push(i)
    }
  }
  return function () {
    return table[Math.floor(Math.random() * table.length)]
  }
}

export const rgbToBgColor = (color: Color) => {
  return (
    "rgb(" +
    color.r +
    " " +
    color.b +
    " " +
    color.g +
    " / var(--tw-bg-opacity))"
  )
}

export const strToBgColor = (str: string) => {
  const color = nameToColor(str)
  return (
    "rgb(" +
    color[0] +
    " " +
    color[1] +
    " " +
    color[2] +
    " / var(--tw-bg-opacity))"
  )
}

export const strToRGB = (str: string) => {
  const color = nameToColor(str)
  return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")"
}

export const gtagEvent = (action, category, label, value) => {
  if (!Object.hasOwn(window, "gtag")) {
    return
  }
  // @ts-ignore
  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value: value,
  })
}

type AnalyticsProperties = Record<string, unknown>

type AnalyticsWindow = Window & {
  umami?: {
    track: (eventName: string, eventData?: AnalyticsProperties) => void
  }
  zaraz?: {
    track: (
      eventName: string,
      eventData?: AnalyticsProperties
    ) => Promise<void> | void
  }
}

const trackWithZaraz = (eventName: string, eventData: AnalyticsProperties) => {
  const send = () => {
    const zaraz = (window as AnalyticsWindow).zaraz
    if (!zaraz) return false
    try {
      void Promise.resolve(zaraz.track(eventName, eventData)).catch(() => {})
    } catch {
      // Analytics must never block the product flow.
    }
    return true
  }

  if (!send()) window.setTimeout(send, 500)
}

export const trackAnalyticsEvent = (
  eventName: string,
  eventData: AnalyticsProperties = {}
) => {
  if (typeof window === "undefined") return

  const umami = (window as AnalyticsWindow).umami
  try {
    umami?.track(eventName, eventData)
  } catch {
    // Analytics must never block the product flow.
  }
  trackWithZaraz(eventName, eventData)
}

// Keep existing instrumentation and its Umami reports working while forwarding
// product events through the Cloudflare Zaraz Mixpanel tag.
export const umamiEvent = trackAnalyticsEvent

/**
 * #346: attach the Room-authoritative generation correlation id to a
 * Room-scoped browser event.
 *
 * The value ALWAYS comes from RoomState — the browser never mints one, so a
 * browser-side event can only ever carry the id of the canonical Room
 * generation the server actually created. When the browser has no
 * authoritative Room state yet (which is exactly the case for events that
 * happen before a Room exists), the property is simply absent rather than
 * fabricated.
 *
 * `roomHash` keeps riding alongside it for as long as the existing reports
 * need it.
 */
export const withAnalyticsRoomId = <T extends AnalyticsProperties>(
  eventData: T,
  analyticsRoomId: string | undefined
): T & { analyticsRoomId?: string } =>
  analyticsRoomId ? { ...eventData, analyticsRoomId } : eventData

export const hashRoom = (roomName: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < roomName.length; i++) {
    h ^= roomName.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

export const participantsBucket = (
  count: number
): "1" | "2-3" | "4-9" | "10+" => {
  if (count >= 10) return "10+"
  if (count >= 4) return "4-9"
  if (count >= 2) return "2-3"
  return "1"
}

```

### Core Architecture Module: `app/src/do/residentMediaState.ts`
```
import type {
  AgentVoiceState,
  LiveTranscriptState,
  MeetingNotesState,
  ResidentMediaState,
} from "../room/types"

interface ResidentMediaStateInput {
  participantId: string
  meetingNotes: MeetingNotesState
  agentVoice: AgentVoiceState
  liveTranscript: LiveTranscriptState
  mediaAvailable: boolean
}

// Projects only the media state that the named resident needs to reconcile its
// own controller. In particular, do not expose another Agent's grant or the
// Human that started Live Transcript through this private event envelope.
export function projectResidentMediaState({
  participantId,
  meetingNotes,
  agentVoice,
  liveTranscript,
  mediaAvailable,
}: ResidentMediaStateInput): ResidentMediaState {
  const meetingNotesForSelf =
    meetingNotes.active && meetingNotes.agentParticipantId === participantId
  const meetingNotesState = meetingNotesForSelf
    ? {
        active: true as const,
        ...(meetingNotes.startedAt !== undefined
          ? { startedAt: meetingNotes.startedAt }
          : {}),
      }
    : { active: false as const }

  const voiceGrant = agentVoice[participantId]
  const agentVoiceEnabledAt =
    voiceGrant?.enabled && voiceGrant.enabledAt > 0
      ? voiceGrant.enabledAt
      : undefined

  const liveTranscriptState: ResidentMediaState["liveTranscript"] =
    liveTranscript.active
      ? {
          active: true,
          producerRuntimeHostId: liveTranscript.producerRuntimeHostId,
          epoch: liveTranscript.epoch,
        }
      : { active: false }

  return {
    meetingNotes: meetingNotesState,
    ...(agentVoiceEnabledAt === undefined ? {} : { agentVoiceEnabledAt }),
    mediaAvailable,
    liveTranscript: liveTranscriptState,
  }
}

```

### Core Architecture Module: `app/src/hooks/useSfuChatRoom.ts`
```
import { useCallback, useEffect, useRef, useState } from "react"

import { isAgentActivityTurnSequence } from "@common/agentActivity"
import { LOCAL_PEER_ID } from "@common/consts"
import type { GeneratedRoomAppPublication } from "@common/generatedRoomApp"
import {
  mergeRoomAndEphemeralMessages,
  reconcileCanonicalRoomMessages,
} from "@common/messageReconciliation"
import { participantDirectReliableChannelName } from "@common/participantDataChannel"
import {
  decodeRoomAppUnicastEnvelope,
  decodeRoomAppUnicastResult,
  decodeRoomAppAgentRequest,
  decodeRoomAppEnvelope,
  encodeRoomAppUnicastRequest,
  encodeRoomAppEnvelope,
  isRoomAppInstanceForRoom,
  roomAppRateGuard,
  roomAppUnicastRateGuard,
  serializedRoomAppBytes,
  type RoomAppLane,
  type RoomAppUnicastEnvelope,
  type RoomAppUnicastResult,
  type RoomAppAgentRequestEnvelope,
  type RoomAppTransportEnvelope,
} from "@common/roomApp"
import {
  installRoomAppTransportDiagnostics,
  RoomAppTransportDiagnosticTrace,
  roomAppRequestTag,
  whiteboardProtocolType,
} from "@common/roomAppTransportDiagnostics"
import { validateRoomAttachmentRead } from "@common/roomAttachments"
import type {
  RuntimeCapabilityOperation,
  RuntimeCapabilityResult,
} from "@common/runtimeCapability"
import { isBoundedRuntimeCapabilityResult } from "@common/runtimeCapability"
import {
  createSfuEgressSampler,
  SFU_EGRESS_SAMPLE_INTERVAL_MS,
  type SfuEgressSampleReason,
} from "@common/sfuEgress"
import {
  encodeTaskAttachmentWake,
  TASK_ATTACHMENT_PENDING_HEADER,
  TASK_ATTACHMENT_WAKE_HEADER,
} from "@common/taskAttachmentWake"
import {
  isTaskControlNotice,
  taskControlNoticeMessage,
} from "@common/taskExecution"
import { ActionType, Message, UserInfo } from "@common/types"
import {
  hashRoom,
  participantsBucket,
  trackAnalyticsEvent,
} from "@common/utils"
import { MAX_COLLAB_SUMMARY_LENGTH } from "@do/collab"
import {
  isTaskSessionError,
  validateTaskSessionListResult,
  MAX_TASK_SESSION_TOKEN_LENGTH,
  type TaskSessionError,
  type RelayHarnessSessionControls,
} from "@do/taskSession"

import type {
  LiveTranscriptSegment,
  LiveTranscriptState,
  AgentActivityProjection,
  TaskExecutionProjection,
  RoomAttachmentProjection,
  RoomAttachmentRead,
  RuntimeHostProjection,
} from "../room/types"
import type {
  SfuAgentVoiceState,
  SfuMessage,
  SfuParticipant,
  SfuRoomState,
  SfuSessionResponse,
  SfuTrack,
} from "../sfu/types"

type ConnectionStatus =
  | "verifying"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "verification_failed"
  | "failed"

/**
 * Local Human microphone capability (#402).
 *
 * Entering a Room never captures audio: voice starts only when the Human
 * explicitly enables it from persistent Room chrome. This state is the single
 * source of truth for that control, so a missing track can never be reported as
 * "live" and a failed capture is distinguishable from "never enabled".
 */
export type RoomMicState =
  | "not_enabled"
  | "requesting"
  | "live"
  | "muted"
  | "unavailable"

class TurnstileVerificationError extends Error {
  constructor(message = "Verification failed") {
    super(message)
    this.name = "TurnstileVerificationError"
  }
}

const MAX_FILE_SIZE = 20 * 1024 * 1024
const FILE_CHUNK_SIZE = 32 * 1024
const FILE_BUFFER_HIGH_WATER_MARK = 256 * 1024
const FILE_BUFFER_LOW_WATER_MARK = 64 * 1024
// #409: the browser may only name an existing Task. The bound matches the
// Room's canonical collaboration request id bound.
const MAX_TASK_INTERRUPT_REQUEST_ID_LENGTH = 64
// The Room bounds a canonical Task instruction at 4000 characters; the browser
// applies the same bound before sending.
const MAX_TASK_TEXT_LENGTH = 4000
// #421 Fix G: how long a benign Task control outcome stays on screen. It is
// local, transient feedback — never a sticky Room-wide banner.
const TASK_CONTROL_NOTICE_MS = 6000
const MAX_AGENT_ATTACHMENT_BYTES = 768 * 1024
const AGENT_IMAGE_MAX_DIMENSION = 1600
const AGENT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const AGENT_TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/yaml",
])
const AGENT_TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".log",
  ".yml",
  ".yaml",
])
// Cloudflare can briefly acknowledge a newly re-published Agent audio track
// before it has an SDP answer for an already-connected Human listener. Keep
// recovery prompt, bounded, and specific to that publication.
const AGENT_AUDIO_SUBSCRIPTION_RETRY_DELAYS_MS = [100, 300] as const
const MAX_AGENT_AUDIO_SUBSCRIPTION_ATTEMPTS =
  1 + AGENT_AUDIO_SUBSCRIPTION_RETRY_DELAYS_MS.length
// A newly published Human screen-share track can be visible in Room state
// before Cloudflare makes it available to tracks/new. Keep the retry bounded
// and shared by Human audio/video subscriptions so one transient admission
// response cannot permanently lose a remote screen share.
const REMOTE_TRACK_SUBSCRIPTION_RETRY_DELAYS_MS = [
  100, 300, 1000, 3000,
] as const
const REMOTE_TRACK_READY_TIMEOUT_MS = 5000
const REMOTE_FILE_CHANNEL_OPEN_TIMEOUT_MS = 5000
const ROOM_APP_CHANNEL_OPEN_TIMEOUT_MS = 5000
// Runtime capability handlers run for up to eight seconds. Keep four seconds
// of browser-side grace for the correlated result to cross the DataChannel.
const RUNTIME_CAPABILITY_REQUEST_TIMEOUT_MS = 12_000
const ROOM_APP_RETRY_DELAYS_MS = [100, 500, 2000] as const

function agentTextMime(file: File): string | undefined {
  if (AGENT_TEXT_TYPES.has(file.type)) return file.type
  const name = file.name.toLowerCase()
  const dot = name.lastIndexOf(".")
  const ext = dot >= 0 ? name.slice(dot) : ""
  if (!AGENT_TEXT_EXTENSIONS.has(ext)) return undefined
  return (
    {
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".csv": "text/csv",
      ".json": "application/json",
      ".log": "text/plain",
      ".yml": "text/yaml",
      ".yaml": "text/yaml",
    }[ext] ?? "text/plain"
  )
}

interface IncomingFileTransfer {
  id: string
  name: string
  mime: string
  size: number
  afterSequence?: number
  received: number
  chunks: ArrayBuffer[]
}

interface SfuApiResponse {
  dataChannels?: Array<{ id?: number }>
  errorCode?: string
  requiresImmediateRenegotiation?: boolean
  sessionDescription?: RTCSessionDescriptionInit
  tracks?: Array<{
    errorCode?: string
    errorDescription?: string
    mid?: string
    trackName?: string
  }>
}

interface AgentAudioSubscriptionRetry {
  attempt: number
  timeout: ReturnType<typeof setTimeout>
  subscriberSessionId: string
  subscriberPeerConnection: RTCPeerConnection
}

interface RemoteTrackSubscriptionRetry {
  attempt: number
  timeout: ReturnType<typeof setTimeout>
  subscriberSessionId: string
  subscriberPeerConnection: RTCPeerConnection
}

interface RemoteTrackBinding {
  peerConnection: RTCPeerConnection
  subscriberSessionId: string
  mid: string
  participantId: string
  publisherSessionId: string
  trackName: string
  kind: "audio" | "video"
  subscriptionKey: string
  attempt: number
  timeout: number | null
  attached: boolean
}

interface RemoteFileChannelAttempt {
  peerConnection: RTCPeerConnection
  subscriberSessionId: string
  publisherSessionId: string
  participantKind: "human" | "agent"
  attempt: number
  channel: RTCDataChannel | null
  channelId: number | null
}

interface RemoteRoomAppChannelAttempt {
  peerConnection: RTCPeerConnection
  subscriberSessionId: string
  publisherSessionId: string
  participantKind: "human" | "agent"
  lane: RoomAppLane
  attempt: number
  channel: RTCDataChannel | null
  channelId: number | null
}

export interface RoomAppTransportStats {
  reliableMessages: number
  realtimeMessages: number
  bytesSent: number
  bytesReceived: number
  droppedMessages: number
}

function hasUsableSessionDescription(response: SfuApiResponse): boolean {
  const description = response.sessionDescription
  return Boolean(
    description &&
      typeof description.type === "string" &&
      description.type.length > 0 &&
      typeof description.sdp === "string" &&
      description.sdp.length > 0
  )
}

function addLocalMediaTrack(
  pc: RTCPeerConnection,
  track: MediaStreamTrack,
  stream: MediaStream
): RTCRtpTransceiver {
  // A PeerConnection can already contain recvonly video transceivers created
  // by SFU subscriptions. addTrack() is allowed to reuse one of those
  // transceivers, which changes its direction and can make Cloudflare's next
  // answer invalid when a second participant starts sharing. Local
  // publications always get their own stable sendonly m-line.
  return pc.addTransceiver(track, {
    direction: "sendonly",
    streams: [stream],
  })
}

function hasRemoteTrackError(response: SfuApiResponse): boolean {
  return Boolean(
    response.errorCode ||
      response.tracks?.some(
        (track) =>
          typeof track.errorCode === "string" && track.errorCode.length > 0
      )
  )
}

const TRANSIENT_REMOTE_TRACK_ADMISSION_ERRORS = new Set([
  "empty_track_error",
  "not_found_track_error",
])

function isTransientRemoteTrackAdmissionError(
  response: SfuApiResponse
): boolean {
  const errorCodes = [
    response.errorCode,
    ...(response.tracks?.map((track) => track.errorCode) ?? []),
  ]
  return errorCodes.some(
    (code) =>
      typeof code === "string" &&
      TRANSIENT_REMOTE_TRACK_ADMISSION_ERRORS.has(code)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isRuntimeCapabilityResultError(
  value: unknown
): value is NonNullable<RuntimeCapabilityResult["error"]> {
  return (
    value === "unavailable" ||
    value === "timeout" ||
    value === "invalid_request" ||
    value === "controller_error" ||
    value === "unauthorized" ||
    value === "duplicate_request" ||
    value === "busy"
  )
}

function summarizeRemoteTrackResponse(response: SfuApiResponse) {
  const tracks = Ar
```

### Core Architecture Module: `app/src/hooks/useTurnstile.ts`
```
import { useCallback, useEffect, useRef, useState } from "react"

import { TURNSTILE_ACTION } from "../common/turnstile"

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>
      ) => string
      execute: (
        container: string | HTMLElement,
        options?: Record<string, unknown>
      ) => void
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

// Cloudflare's published "always passes" test sitekey. Used automatically
// when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured (local dev).
const TURNSTILE_SITEKEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA"

// Build-time kill switch for fully offline/local stacks: bake
// NEXT_PUBLIC_TURNSTILE_DISABLED=1 and the widget never loads while
// requestToken() resolves immediately with a placeholder. The placeholder
// itself proves nothing: the server skips Siteverify only through its own
// explicit TURNSTILE_DISABLED bypass. Production builds set neither, so real
// verification is untouched.

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("turnstile_unavailable"))
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    // Always create a brand-new <script> element for this attempt. Reusing
    // whatever the DOM happens to have is what caused the retry hang: a
    // previously-failed element has already fired its one-shot "error"
    // event, so listeners attached to it after the fact never fire and the
    // returned promise never settles.
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = TURNSTILE_SCRIPT_SRC
      script.async = true
      script.defer = true
      const onReady = () => resolve()
      const onFail = () => {
        script.removeEventListener("load", onReady)
        script.removeEventListener("error", onFail)
        script.remove()
        scriptPromise = null
        reject(new Error("turnstile_script_failed"))
      }
      script.addEventListener("load", onReady, { once: true })
      script.addEventListener("error", onFail, { once: true })
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export type TurnstileStatus = "idle" | "loading" | "verifying" | "error"

interface Settlement {
  resolve: (token: string) => void
  reject: (error: Error) => void
}

/**
 * Action-scoped Turnstile challenge. Unlike a page-wide gate, this renders a
 * bounded (appearance: interaction-only) widget that stays invisible unless
 * Cloudflare decides interaction is required, and only runs a challenge when
 * requestToken() is called. Every call resets the widget first, so a token
 * is never reused across two protected actions.
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const settlementRef = useRef<Settlement | null>(null)
  const pendingRef = useRef<Promise<string> | null>(null)
  const mountedRef = useRef(true)
  const [status, setStatus] = useState<TurnstileStatus>("idle")

  // Tears down the actual Cloudflare-owned widget UI (which is not
  // guaranteed to live only inside our container element — Turnstile can
  // position it as a body-level overlay) and clears the id so the next
  // ensureWidget() call always renders a genuinely fresh widget rather than
  // reusing one that has already settled.
  const removeWidget = useCallback(() => {
    const ts = window.turnstile
    const widgetId = widgetIdRef.current
    widgetIdRef.current = null
    if (widgetId && ts) {
      try {
        ts.remove(widgetId)
      } catch {
        // The widget may already be gone (e.g. script never finished loading).
      }
    }
  }, [])

  const settle = useCallback(
    (token?: string, error?: Error) => {
      const settlement = settlementRef.current
      settlementRef.current = null
      if (!settlement) return
      // Every settlement — success or failure — is terminal for this widget
      // instance: a completed challenge must not linger visibly once the
      // protected action has resolved, and a failed one must not be reused
      // by a retry (see requestToken()'s reset-before-execute comment).
      removeWidget()
      if (!mountedRef.current) return
      if (error) {
        setStatus("error")
        settlement.reject(error)
      } else {
        setStatus("idle")
        settlement.resolve(token as string)
      }
    },
    [removeWidget]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      removeWidget()
      settlementRef.current = null
      pendingRef.current = null
    }
  }, [removeWidget])

  const ensureWidget = useCallback(async (): Promise<string> => {
    if (widgetIdRef.current) return widgetIdRef.current
    setStatus("loading")
    await loadTurnstileScript()
    const ts = window.turnstile
    const container = containerRef.current
    if (!ts || !container) throw new Error("turnstile_unavailable")
    const widgetId = ts.render(container, {
      sitekey: TURNSTILE_SITEKEY,
      // #406: the Worker requires Siteverify to echo this action back, so a
      // token minted by any other widget on this sitekey is not accepted for
      // a fresh Human session.
      action: TURNSTILE_ACTION,
      appearance: "interaction-only",
      execution: "execute",
      retry: "never",
      "refresh-expired": "manual",
      callback: (token: string) => settle(token),
      "error-callback": () => {
        settle(undefined, new Error("turnstile_error"))
        return false
      },
      "expired-callback": () =>
        settle(undefined, new Error("turnstile_expired")),
      "timeout-callback": () =>
        settle(undefined, new Error("turnstile_timeout")),
    })
    widgetIdRef.current = widgetId
    return widgetId
  }, [settle])

  /** Resolves with a freshly generated, single-use Turnstile token. */
  const requestToken = useCallback((): Promise<string> => {
    if (pendingRef.current) return pendingRef.current
    if (process.env.NEXT_PUBLIC_TURNSTILE_DISABLED === "1")
      return Promise.resolve("turnstile-disabled")

    const run = async (): Promise<string> => {
      const widgetId = await ensureWidget()
      const ts = window.turnstile
      const container = containerRef.current
      if (!ts || !container) throw new Error("turnstile_unavailable")
      return await new Promise<string>((resolve, reject) => {
        settlementRef.current = { resolve, reject }
        setStatus("verifying")
        try {
          // Reset first so a stale/consumed token can never be handed back.
          ts.reset(widgetId)
          ts.execute(container)
        } catch (err) {
          settlementRef.current = null
          reject(
            err instanceof Error ? err : new Error("turnstile_execute_failed")
          )
        }
      })
    }

    const promise = run().finally(() => {
      pendingRef.current = null
    })
    pendingRef.current = promise
    return promise
  }, [ensureWidget])

  return { containerRef, requestToken, status }
}

```

### Core Architecture Module: `app/worker.ts`
```
// @ts-ignore generated at build time
import { default as handler } from "./.open-next/worker.js"

import { handleSfuRequest } from "./src/sfu/server"
import { handleMcpRequest } from "./src/mcp/server"
import { handleRoomRequest, isRoomRequestPath } from "./src/room/server"

export { RoomSession } from "./src/do/RoomSession"

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname
    if (pathname === "/mcp") {
      return handleMcpRequest(request, env, ctx)
    }
    if (pathname.startsWith("/api/sfu/")) {
      return handleSfuRequest(request, env)
    }
    if (isRoomRequestPath(pathname)) {
      return handleRoomRequest(request, env)
    }
    return handler.fetch(request, env, ctx)
  },
}

```

### Core Architecture Module: `agent/cmd/free4chat-agent/main.go`
```
// Command free4chat-agent is the native Go Agent Runtime entrypoint.
package main

import (
	"os"

	"github.com/i365dev/free4chat/agent/internal/cli"
)

func main() {
	os.Exit(cli.Main(os.Args[1:]))
}

```

### Core Architecture Module: `agent/experimental/cups-printer-status-adapter/adapter.py`
```
#!/usr/bin/env python3
"""Read-only CUPS queue status Adapter (stdio protocol v1)."""

import argparse
import json
import re
import subprocess
import sys

VERSION = 1
CAPABILITY_ID = "printer_status"
DESCRIPTOR = {
    "capabilityId": CAPABILITY_ID,
    "title": "Printer status",
    "version": "1",
    "observe": True,
    "actions": [],
}


def send(request_id, result=None, error=None):
    message = {"protocolVersion": VERSION, "id": request_id}
    if error:
        message["error"] = {"code": error}
    else:
        message["result"] = result
    sys.stdout.write(json.dumps(message, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def queue_status(queue_name):
    try:
        completed = subprocess.run(
            ["/usr/bin/lpstat", "-p", queue_name, "-l", "-a", queue_name],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=1.0,
            text=True,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if completed.returncode != 0:
        return None

    lines = completed.stdout.splitlines()
    state = None
    accepting_jobs = None
    for line in lines:
        folded = line.casefold()
        if " is idle" in folded or "闲置" in line:
            state = "idle"
        elif " is printing" in folded or "正在打印" in line:
            state = "printing"
        elif " is stopped" in folded or " is disabled" in folded or " disabled " in folded or "已停止" in line or "已停用" in line:
            state = "stopped"
        if "not accepting requests" in folded or "不接受请求" in line or "停止接受请求" in line:
            accepting_jobs = False
        elif "accepting requests" in folded or "正在接受请求" in line:
            accepting_jobs = True
    if state is None or accepting_jobs is None:
        return None
    return {"state": state, "acceptingJobs": accepting_jobs}


def handle(request, queue_name):
    request_id = request.get("id")
    if not isinstance(request_id, str) or not 1 <= len(request_id) <= 64:
        return {"protocolVersion": VERSION, "id": "invalid", "error": {"code": "invalid_request"}}
    if request.get("method") == "list":
        return {"protocolVersion": VERSION, "id": request_id, "result": [DESCRIPTOR]}
    method = request.get("method")
    if method not in ("describe", "observe", "invoke"):
        return {"protocolVersion": VERSION, "id": request_id, "error": {"code": "unsupported_method"}}
    if request.get("capabilityId") != CAPABILITY_ID:
        return {"protocolVersion": VERSION, "id": request_id, "error": {"code": "unknown_capability"}}
    if method == "describe":
        return {"protocolVersion": VERSION, "id": request_id, "result": DESCRIPTOR}
    if method == "invoke":
        return {"protocolVersion": VERSION, "id": request_id, "error": {"code": "unsupported_action"}}
    result = queue_status(queue_name)
    if result is None:
        return {"protocolVersion": VERSION, "id": request_id, "error": {"code": "unavailable"}}
    return {"protocolVersion": VERSION, "id": request_id, "result": result}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--queue", required=True, help="local CUPS queue name; never returned by the Adapter")
    options = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", options.queue):
        parser.error("--queue must be a bounded CUPS queue name")

    while True:
        frame = sys.stdin.buffer.readline(65537)
        if not frame:
            return
        if len(frame) > 65536 or not frame.endswith(b"\n"):
            send("invalid", error="too_large")
            return
        try:
            request = json.loads(frame)
        except (UnicodeDecodeError, json.JSONDecodeError):
            send("invalid", error="invalid_request")
            continue
        if not isinstance(request, dict) or request.get("protocolVersion") != VERSION or len(request) > 6:
            send("invalid", error="invalid_request")
            continue
        response = handle(request, options.queue)
        sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agent/experimental/local-capability-adapter/adapter.py`
```
#!/usr/bin/env python3
"""Experimental stdio Adapter; standard library only, no Free4Chat imports."""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request

PROTOCOL_VERSION = 1
MAX_FRAME = 65536
MAX_ARGS = 1024
MAX_RESULT = 4096
CAPABILITY_ID = "living_room_light"
DESCRIPTOR = {
    "capabilityId": CAPABILITY_ID,
    "title": "Living room light",
    "version": "1",
    "observe": True,
    "actions": [{
        "name": "set_led",
        "title": "Set color",
        "input": {
            "type": "object",
            "properties": {"color": "string"},
            "required": ["color"],
        },
    }],
}


def response(request_id, result=None, code=None):
    envelope = {"protocolVersion": PROTOCOL_VERSION, "id": request_id}
    if code is None:
        envelope["result"] = result
    else:
        envelope["error"] = {"code": code}
    wire = json.dumps(envelope, separators=(",", ":"), ensure_ascii=False).encode() + b"\n"
    if len(wire) > MAX_FRAME:
        wire = json.dumps({
            "protocolVersion": PROTOCOL_VERSION, "id": request_id,
            "error": {"code": "too_large"},
        }, separators=(",", ":")).encode() + b"\n"
    sys.stdout.buffer.write(wire)
    sys.stdout.buffer.flush()


def fixture_request(base_url, path, method="GET", body=None):
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    request = urllib.request.Request(base_url + path, data=data, method=method)
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=1.0) as result:
            payload = result.read(MAX_RESULT + 1)
    except (OSError, urllib.error.URLError):
        raise ValueError("unavailable") from None
    if len(payload) > MAX_RESULT:
        raise ValueError("too_large")
    try:
        return json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError("unavailable") from None


def dispatch(message, base_url):
    if not isinstance(message, dict):
        return None, "invalid_request"
    request_id = message.get("id")
    if not isinstance(request_id, str) or not re.fullmatch(r"[ -~]{1,64}", request_id):
        return None, "invalid_request"
    if message.get("protocolVersion") != PROTOCOL_VERSION:
        return request_id, "invalid_request"
    method = message.get("method")
    capability_id = message.get("capabilityId")
    if method == "list" and set(message) == {"protocolVersion", "id", "method"}:
        return [DESCRIPTOR], None
    if method not in ("describe", "observe", "invoke"):
        return request_id, "unsupported_method"
    if capability_id != CAPABILITY_ID:
        return request_id, "unknown_capability"
    if method == "describe" and set(message) == {"protocolVersion", "id", "method", "capabilityId"}:
        return DESCRIPTOR, None
    if method == "observe" and set(message) == {"protocolVersion", "id", "method", "capabilityId"}:
        try:
            return fixture_request(base_url, "/state"), None
        except ValueError as error:
            return request_id, str(error)
    if method == "invoke":
        if set(message) != {"protocolVersion", "id", "method", "capabilityId", "action", "args"}:
            return request_id, "invalid_request"
        if message.get("action") != "set_led":
            return request_id, "unsupported_action"
        args = message.get("args")
        encoded = json.dumps(args, separators=(",", ":")).encode()
        if len(encoded) > MAX_ARGS:
            return request_id, "too_large"
        if not isinstance(args, dict) or set(args) != {"color"} or not isinstance(args["color"], str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", args["color"]):
            return request_id, "invalid_args"
        try:
            return fixture_request(base_url, "/actions/set-led", "POST", args), None
        except ValueError as error:
            return request_id, str(error)
    return request_id, "invalid_request"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="Adapter-owned JSON config path")
    args = parser.parse_args()
    try:
        with open(args.config, "r", encoding="utf-8") as config_file:
            config = json.load(config_file)
        base_url = config["fixtureBaseUrl"]
        if not isinstance(base_url, str) or not base_url.startswith("http://127.0.0.1:"):
            raise ValueError
    except (OSError, ValueError, KeyError, json.JSONDecodeError):
        print("Adapter-local configuration unavailable", file=sys.stderr)
        return 2

    while True:
        frame = sys.stdin.buffer.readline(MAX_FRAME + 1)
        if not frame:
            return 0
        if len(frame) > MAX_FRAME or not frame.endswith(b"\n"):
            print("oversized or unterminated request frame", file=sys.stderr)
            return 2
        try:
            request = json.loads(frame)
        except (UnicodeDecodeError, json.JSONDecodeError):
            response("?", code="invalid_request")
            continue
        request_id = request.get("id") if isinstance(request, dict) else "?"
        result, error = dispatch(request, base_url)
        response(request_id, result=result, code=error)


if __name__ == "__main__":
    raise SystemExit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #501** (2026-09-28): **bug(agent): bridge cold-start can fail after npx cache eviction while doctor still reports ready**
  *Symptoms*:  ## Status  **REAL LOCAL DOGFOOD FAILURE — bridge cold-start is not self-healing enough after npm/npx cache eviction.**  Observed on macOS arm64 with free4chat-agent 0.5.44.  ## User-visible failure  After local cache cleanup:  ~~~ $ free4chat-agent room create --agent codex --name codex The Harness ACP process stopped before joining. Run free4chat-agent doctor and retry.  $ free4chat-agent doctor free4chat-agent 0.5.44 (go runtime, go1.27.1) Platform darwin/arm64 ... codex: ready | bridge | trusted-room   The pinned bridge package is installed on first join ~~~  Retrying room create fails the same way.  The product bug is not "npm cache was cleared". Cache eviction is a normal local-machine condition. A bridge-backed launcher that documents "installed on first join" should recover by reinstalling/restarting, or at minimum report a precise bounded failure.  ## Current code truth  Current Codex launcher:  ~~~ Command: npx Args: -y @agentclientprotocol/codex-acp@1.12.0 ~~~  The old 1.6.2 pin is historical and must not be used for diagnosis or reproduction.  Current doctor behavior:  ~~~ canRun("npx") → executableAvailable = true → ready = true → note: "The pinned bridge package is installed on first join" ~~~  Doctor does not currently prove that the pinned bridge package itself can be resolved, installed, launched, and complete ACP initialization/session creation.  ACP control requests use the existing bounded control timeout:  ~~~ defaultControlTimeoutMs = 20_000 ~~~  That sa
  **Post-Mortem & Fix Analysis**:
  > ## Root cause evidence — upstream npm/npx PATH bug matches this failure  The local reproduction now rules out a missing npm package or missing bin declaration:  ~~~text npm view @agentclientprotocol/codex-acp@1.12.0 bin --json → { "codex-acp": "dist/index.js" }  npm view @agentclientprotocol/codex-acp@1.12.0 version → 1.12.0  npx -y @agentclientprotocol/codex-acp@1.12.0 --version → sh: codex-acp: command not found ~~~  This matches an upstream npm CLI bug reported as npm/cli#9870:  > npx installs a package under ~/.npm/_npx/<hash>/node_modules and creates > node_modules/.bin/<bin>, but the spawned shell PATH can omit that temporary > npx cache .bin directory. It then executes the inferred bin name through > sh -c and gets "command not found".  The upstream report reproduces on macOS across npm 10.9.4 and npm 11.x and Node 20/22, including ordinary packages such as http-server. The failure is therefore not specific to codex-acp.  This materially changes the #501 diagnosis:  ~~~text cach
  > ## Correction after inspecting the actual npx cache  The previous comment was too strong in calling the upstream npx PATH behavior the confirmed root cause.  New local evidence:  ~~~text find ~/.npm/_npx -path '*/node_modules/.bin/codex-acp' → /Users/luying/.npm/_npx/3eb2c53071af01af/node_modules/.bin/codex-acp  executing that exact bin: → @agentclientprotocol/codex-acp 1.6.2 ~~~  So the currently discovered cached executable is the **old 1.6.2 bridge**, not the Runtime's pinned 1.12.0.  This means we have NOT yet proved that 1.12.0 was successfully installed into an npx temp directory and merely omitted from PATH.  The remaining possibilities include:  1. npx never successfully materialized 1.12.0; 2. 1.12.0 materialized under another _npx hash but its bin is missing/not linked; 3. 1.12.0 materialized correctly but PATH resolution is still wrong; 4. stale npx cache/index state is causing execution to resolve inconsistently.  The next reproduction should inspect **all** cached @agentcl
  > ## Further narrowing — 1.12.0 package is present, but its npx bin entry is missing  New cache inspection:  ~~~text ~/.npm/_npx/2226a678236ff29a/node_modules/@agentclientprotocol/codex-acp/package.json   version: 1.12.0   bin: {"codex-acp":"dist/index.js"}  ~/.npm/_npx/3eb2c53071af01af/node_modules/@agentclientprotocol/codex-acp/package.json   version: 1.6.2   bin: {"codex-acp":"dist/index.js"} ~~~  But the previous search for:  ~~~text ~/.npm/_npx/*/node_modules/.bin/codex-acp ~~~  returned only the 1.6.2 cache entry.  So 1.12.0 **did materialize successfully into an npx cache directory**, and its package manifest declares the expected bin, but the corresponding temporary node_modules/.bin/codex-acp entry appears to be absent.  This narrows the failure substantially:  ~~~text package resolution/download        ✅ 1.12.0 package materialized        ✅ package bin declaration            ✅ temporary npx bin link/shim         likely missing npx execution                       → sh: codex-acp

- **Issue #452** (2026-09-22): **bug(task): Codex existing-session adoption can immediately become Session lost**
  *Symptoms*: ## Status  **CLOSED / ABSORBED INTO #453.**  The original symptom remains valid:  ```text Codex existing session from Runtime/default cwd → generally works  Codex existing session from another project cwd → may immediately become Session lost ```  Follow-up dogfood showed that this is not best treated as an isolated session-picker bug. It is the first concrete failure case of the broader Task execution-context gap now owned by #453:  ```text Task ├─ native session identity ├─ project / cwd identity └─ Harness-native session mode/config ```  #453 now carries the exact cross-CWD diagnostic chain, reproduction requirements, fail-closed behavior, and acceptance criteria from this issue.  Do not reopen this issue separately unless later evidence proves a distinct Codex-only defect that remains after #453's project-aware execution context is implemented.  ---  ## Historical report  ## Status  **DOGFOOD BUG / INVESTIGATE — evidence now strongly suggests a CWD-sensitive Codex existing-session adoption failure rather than random session loss.**  Related: - #409 — existing-session continuation / Task control - #421 — resumable long-lived Task execution - #427 — Harness semantic compatibility boundary - #448 — isolated provider lanes; do not conflate this bug with concurrency work - #453 — Task project cwd + native Harness session-mode UX; separate product-level execution-context gap  This issue is intentionally narrow. Do not solve it by redesigning Task execution or enabling concurren

- **Issue #449** (2026-09-21): **fix(room): remove idle CPU drain from cosmos stars animation**
  *Symptoms*: ## Status  **READY — SMALL PRODUCTION PERFORMANCE FIX.**  This issue records a production Room idle-CPU bug found during an overnight dogfood session.  The problem is already isolated by reversible A/B measurement. Do not turn this into a broad rendering/performance refactor.  ---  ## Symptom  A visible but otherwise idle Room can consume substantial CPU continuously.  Observed on:  - Mac mini / Apple Silicon / macOS 27; - Chrome 153.0.8010.48; - production Room: `https://www.free4.chat/room?id=test1`; - measured on the Room renderer process and through CDP `Performance.getMetrics`.  Representative baseline while the Room was visible and idle:  ```text main-thread TaskDuration: ~0.63–0.66 s per 4 s ≈ 15–16% of one CPU core  RecalcStyle: ~323–346 per 4 s ≈ 85/s  renderer process CPU: ~20.8–31%  ScriptDuration: ~0.001–0.005 s per 4 s  LayoutCount: 0 ```  The same machine also showed elevated WindowServer/GPU load while the page remained visible.  This is not normal WebRTC/media idle cost.  ---  ## Root cause — A/B confirmed  The cost comes from the decorative stars layer in:  ```text app/src/styles/tailwind.css .room-participants-panel::before ```  Current shape:  ```css .room-participants-panel::before {   background-image:     radial-gradient(...),     radial-gradient(...),     radial-gradient(...);   background-size: 132px 118px, 196px 174px, 224px 206px;   opacity: 0.5;   animation: room-cosmos-stars 46s linear infinite; }  @keyframes room-cosmos-stars {   from {     backgr

- **Issue #287** (2026-09-07): **bug(agent): verify and fix built-in OpenCode ACP launcher compatibility**
  *Symptoms*: ## Status  **EVIDENCE-BACKED BUILT-IN LAUNCHER CORRECTNESS BUG.**  This is not primarily a #286 permission-policy problem.  Two independent observations now point at the built-in OpenCode ACP launcher itself:  1. real #246 dogfood on another user's machine found that the OpenCode adapter path did not work at all; 2. the #286 Phase 0 spike reproduced a lower-level failure locally with native OpenCode 1.18.18: the exact current Free4Chat launcher did not answer the Runtime-compatible nd-JSON `initialize` request within 30 seconds.  Current Free4Chat launcher:  ```text opencode acp --hostname 127.0.0.1 --port 0 --mdns=false --pure ```  Current OpenCode documentation describes the ACP subprocess contract simply as:  ```text opencode acp → JSON-RPC over stdio / nd-JSON ```  Before #286 can truthfully reason about OpenCode `allow / ask / deny` behavior, Free4Chat must first prove that its built-in launcher recipe still matches the OpenCode version it claims to support.  ## Goal  Determine whether the current built-in OpenCode launcher recipe is stale/incompatible and restore one verified, minimal ACP subprocess launch if necessary.  Do not mix permission-policy UX, Room approval UI, or #286 implementation into this bug.  ## Reproduction matrix  Run against the exact local/pinned OpenCode version used for verification.  Compare at minimum:  ```text A. opencode acp  B. opencode acp --pure  C. current Free4Chat recipe:    opencode acp --hostname 127.0.0.1 --port 0 --mdns=false --pure 

- **Issue #201** (2026-08-30): **bug(media): retry Agent audio subscription when tracks/new returns no sessionDescription**
  *Symptoms*: ## Context  Production dogfood after #199 / Runtime 0.5.9 validated the main #176 provider-pairing path and Agent Voice lifecycle, but exposed one independent multi-Human browser/SFU regression.  The affected listener was already present in the Room before an Agent Voice mute → re-enable cycle.  Observed flow:  ```text Agent Voice enabled → listener hears Agent normally  Human mutes Agent Voice → remote Agent audio is revoked immediately ✅  Human re-enables Agent Voice → Agent publishes the new Voice track → existing listener receives/attempts the new Agent-audio subscription → first `tracks/new` succeeds at the HTTP/request level but returns no `sessionDescription` → browser does not retry → listener remains temporarily silent  later unrelated Room state change (a new Human joins) → normal subscription reconciliation runs again → a subsequent subscription/negotiation succeeds → listener hears Agent again ```  This is not a #176 provider-authorization failure and not a Runtime 0.5.9 TTS/publisher failure. The Agent continued producing valid Voice; another Room-state-triggered subscription attempt restored playback.  ## Current relevant browser invariant  `useSfuChatRoom` already separates:  ```text subscribedTracksRef = requested / in-flight / dedup admission state  readySubscribedTracksRef = subscription whose full negotiation completed ```  and readiness ACK must only be sent after the complete remote-track negotiation succeeds.  Keep that invariant.  ## Required behavior  
  **Post-Mortem & Fix Analysis**:
  > Production acceptance after #202 deployment passed: native-gray had two Human participants and Pi; completed two Voice Off → Voice On → @Pi recovery cycles without reload or a third participant. Both listeners confirmed Pi audio was audible after each recovery.

- **Issue #191** (2026-08-29): **bug(agent): do not drop the beginning of the first Voice reply after enable**
  *Symptoms*: ## Status  **P1 production dogfood finding. Fix before starting the behavior-preserving #182 architecture decomposition.**  Production dogfood on `cf-sfu` after PR #190 exposed a reproducible first-utterance truncation in Agent Voice.  Environment:  ```text production merge: 93028d15c79983bec10a458a309b79b551d444b3 official Agent Runtime: 0.5.7 live agent.md: 0.5.7 Turnstile: temporarily disabled for the dogfood window bootstrap: production Invite Agent flow, no local build Meeting Notes: off ```  ## Observed behavior  Repro with **one Agent only**:  1. Create a fresh production Room. 2. Invite one Agent through the live Invite Agent flow. 3. Agent Voice starts muted/off. 4. Enable Voice for that Agent. 5. Wait several seconds after enabling Voice. 6. Explicitly target/tag that Agent and ask for a multi-sentence reply. 7. The text reply is complete, but audible speech starts from the middle; the first sentences are missing.  Example observed shape:  ```text text: 我的看法：Hermes 说得挺实在，我们俩能力方面高度重合……  heard audio: 能力方面高度重合…… ```  There was no second Agent turn, no newer target, no follow-up message and no cancellation. This rules out the expected latest-wins / stale-turn cancellation behavior as the explanation. Waiting after enabling Voice also does not prevent the repro.  ## Code-confirmed timing window  The current outbound publication lifecycle creates a downstream subscription race.  ### 1. Voice enable prepares the publisher but does not expose a browser-subscribable track  `
  **Post-Mortem & Fix Analysis**:
  > ## Scheduling refinement  After reviewing the current open-issue set, this bug should remain a P1 stabilization item, but it does **not** need to block the first architecture-only #182 PR.  Use this order:  ```text #182 PR1 — control-plane skeleton + Runtime Host extraction → THIS ISSUE (#191) → #182 PR2/PR3 — Voice/media transition + effect-boundary extraction ```  The important constraint is that #191 lands **before #182 starts behavior-sensitive Voice/media extraction**, so the refactor preserves the corrected first-publication readiness semantics. Keep the #191 behavior change isolated from #182.

- **Issue #179** (2026-09-13): **keychain: ad-hoc signed macOS binaries can re-trigger credential password prompts**
  *Symptoms*: ## Status  **LOW / INDEPENDENT macOS RELEASE UX FOLLOW-UP. #208 productization is complete; activate only if real Runtime upgrades repeatedly re-trigger Keychain prompts.**  The macOS Keychain integration can re-trigger a securityd password prompt when a newly built or newly released `free4chat-agent` binary reads the Doubao credential item.  This is a local Runtime UX/release-identity problem, not a Room protocol, collaboration, or credential-centralization problem.  ## Observed behavior  Two cases were found during earlier dogfood:  1. **Tests:** freshly built Go test binaries could reach the real native credential store and trigger a password dialog, making daemon tests appear hung. 2. **Release upgrades:** a newly installed ad-hoc-signed Runtime may prompt again on first Keychain read because macOS ACL matching sees a different code identity.  ## Root cause  `internal/credentials/store_darwin.go` uses the macOS Keychain. Item ACL behavior depends on the reading binary's code identity. With ad-hoc-signed release/test binaries:  ```text item authorized for binary vN → different binary identity vN+1 reads it → macOS may require authorization again ```  The exact user-visible recurrence varies with macOS/Keychain behavior, so future claims should remain evidence-based rather than assuming every upgrade will always prompt.  ## Already solved — tests must never touch the operator's Keychain  The stabilization work added native-store test opt-out and test-specific memory/disable
  **Post-Mortem & Fix Analysis**:
  > Production evidence update from the Runtime 0.5.9 rollout / #199 dogfood:  The macOS Keychain password prompt reproduced again after upgrading to the newly released 0.5.9 binary. This confirms the issue is still current and behaves as expected from the documented ad-hoc code-identity root cause: a new release binary is treated as a new Keychain reader even though the stored Doubao credential itself did not change.  This remains independent of #176 provider pairing and the newly found #201 Agent-audio subscription retry bug. No priority escalation for now; keep as the existing low-priority macOS release/credential UX follow-up.

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

### Incident Patch 1: `ebcc9885` (2026-10-04)
**Commit Message**: Merge pull request #569 from i365dev/codex/fix-567-568

fix(task): dedupe native controls and carry long briefs into sessions

**File**: `agent/internal/harness/acp.go` (modified, +29/-0)
```diff
@@ -583,6 +583,15 @@ func projectHarnessSessionControls(source *ACPSessionControls) *types.HarnessSes
 	}
 	projected.ConfigOptions = make([]types.HarnessSessionConfigOption, 0, len(source.ConfigOptions))
 	for _, option := range source.ConfigOptions {
+		// Some ACP providers expose the session mode through both `modes` /
+		// `session/set_mode` and a compatibility config option. Treat it as
+		// one control only when the option explicitly identifies itself as the
+		// mode selector and its current/available values exactly match the
+		// native modes. A merely similar label is not enough to collapse two
+		// provider controls.
+		if source.Modes != nil && isModeConfigOptionAlias(source.Modes, option) {
+			continue
+		}
 		projectedOption := types.HarnessSessionConfigOption{
 			ID: option.ID, Name: option.Name, Description: option.Description,
 			Category: option.Category, Type: option.Type, CurrentValue: option.CurrentValue,
@@ -598,6 +607,26 @@ func projectHarnessSessionControls(source *ACPSessionControls) *types.HarnessSes
 	return projected
 }
 
+func isModeConfigOptionAlias(modes *ACPModeState, option ACPConfigOption) bool {
+	if modes == nil || option.ID != "mode" || !strings.EqualFold(option.Category, "mode") ||
+		option.CurrentValue != modes.CurrentModeID || len(option.Options) != len(modes.AvailableModes) {
+		return false
+	}
+	modeIDs := make(map[string]struct{}, len(modes.AvailableModes))
+	for _, mode := range modes.AvailableModes {
+		if _, duplicate := modeIDs[mode.ID]; duplicate {
+			return false
+		}
+		modeIDs[mode.ID] = struct{}{}
+	}
+	for _, value := range option.Options {
+		if _, ok := modeIDs[value.Value]; !ok {
+			return false
+		}
+	}
+	return true
+}
+
 // PendingPermissionCount reports the number of permission requests currently
 // parked for the active turn. It is intentionally local diagnostic state and
 // never enters Room/status output.
```

**File**: `agent/internal/harness/acp_test.go` (modified, +41/-0)
```diff
@@ -580,6 +580,47 @@ func sessionControlsForTest(t *testing.T, controls *types.HarnessSessionControls
 	return converted
 }
 
+func TestACPProjectsAnAliasedNativeModeOnlyOnce(t *testing.T) {
+	controls := parseSessionControls(mustJSON(map[string]any{
+		"modes": map[string]any{
+			"currentModeId": "agent",
+			"availableModes": []any{
+				map[string]any{"id": "read-only", "name": "Ask for approval"},
+				map[string]any{"id": "agent", "name": "Approve for me"},
+				map[string]any{"id": "agent-full-access", "name": "Full access"},
+			},
+		},
+		"configOptions": []any{
+			map[string]any{
+				"id": "mode", "name": "Mode", "category": "mode", "type": "select",
+				"currentValue": "agent",
+				"options": []any{
+					map[string]any{"value": "read-only", "name": "Ask for approval"},
+					map[string]any{"value": "agent", "name": "Approve for me"},
+					map[string]any{"value": "agent-full-access", "name": "Full access"},
+				},
+			},
+			// A similar label alone does not prove semantic identity. Keep a
+			// genuinely separate provider config control for the UI to label.
+			map[string]any{
+				"id": "mode_detail", "name": "Mode", "category": "custom", "type": "select",
+				"currentValue": "safe",
+				"options":      []any{map[string]any{"value": "safe"}, map[string]any{"value": "fast"}},
+			},
+		},
+	}))
+	projected := projectHarnessSessionControls(controls)
+	if projected == nil || len(projected.Modes) != 3 {
+		t.Fatalf("native session modes must remain available: %+v", projected)
+	}
+	if projected.CurrentModeID != "agent" {
+		t.Fatalf("current native mode changed: %q", projected.CurrentModeID)
+	}
+	if len(projected.ConfigOptions) != 1 || projected.ConfigOptions[0].ID != "mode_detail" {
+		t.Fatalf("only the exact mode alias should be removed: %+v", projected.ConfigOptions)
+	}
+}
+
 func findCurrentConfigValue(t *testing.T, controls *ACPSessionControls, configID string) string {
 	t.Helper()
 	option, ok := findConfigOption(controls.ConfigOptions, configID)
```

**File**: `app/src/components/RoomContent.test.tsx` (modified, +230/-0)
```diff
@@ -44,6 +44,7 @@ import {
   ROOM_APP_INLINE_SHORTCUTS_DESKTOP,
   ROOM_APP_INLINE_SHORTCUTS_MOBILE,
 } from "../common/roomAppRecents"
+import { TASK_PASTE_ATTACHMENT_THRESHOLD } from "../common/taskPaste"
 import { RoomSession } from "../do/RoomSession"
 import type { RoomRecord, RoomState } from "../room/types"
 
@@ -434,6 +435,17 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
                   { value: "gpt-5.6-sol", name: "5.6 Sol" },
                 ],
               },
+              {
+                id: "review_mode",
+                name: "Mode",
+                category: "review",
+                type: "select",
+                currentValue: "safe",
+                options: [
+                  { value: "safe", name: "Safe review" },
+                  { value: "strict", name: "Strict review" },
+                ],
+              },
             ],
           },
         },
@@ -471,6 +483,224 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
         name: "Full access",
       })
     ).toHaveValue("agent-full-access")
+    const reviewMode = screen.getByLabelText(
+      "Harness-native Mode (review_mode)"
+    )
+    expect(
+      within(reviewMode).getByRole("option", { name: "Safe review" })
+    ).toHaveValue("safe")
+  })
+
+  it("starts a selected-project New Session with the full long brief as Task context", async () => {
+    const startTaskWithSession = vi.fn(async () => ({ ok: true as const }))
+    const roomHook = {
+      ...baseHookReturn,
+      connectionStatus: "connected",
+      startTaskWithSession,
+      participants: [
+        {
+          peerId: "human-local",
+          name: "tester",
+          kind: "human",
+          room: "test-room",
+          muteState: false,
+        },
+        {
+          peerId: "agent-codex",
+          name: "Codex",
+          kind: "agent",
+          room: "test-room",
+          muteState: false,
+          taskSessionContinuation: true,
+        },
+      ],
+      requestTaskSessions: vi.fn(async () => ({
+        ok: true as const,
+        page: {
+          sessions: [],
+          projects: [{ token: "project-token-1", label: "free4chat" }],
+          hasMore: false,
+          controls: { modes: [], configOptions: [] },
+        },
+      })),
+    }
+    mockUseSfuChatRoom.mockReturnValue(roomHook)
+
+    const { rerender } = render(
+      <RoomContent roomName="test-room" nickName="tester" roomType="audio" />
+    )
+    fireEvent.click(screen.getAllByLabelText("Start task with Codex")[0])
+    fireEvent.click(screen.getByTestId("task-project-discover"))
+    await screen.findByTestId("task-session-project-toggle")
+    fireEvent.click(screen.getByTestId("task-session-project-toggle"))
+    fireEvent.click(screen.getByTestId("task-session-project-option"))
+
+    const brief = `# Selected project handoff\n\n${"detailed requirement ".repeat(
+      TASK_PASTE_ATTACHMENT_THRESHOLD
+    )}`
+    fireEvent.paste(screen.getByLabelText("What should this Agent do?"), {
+      clipboardData: { getData: () => brief },
+    })
+    expect(screen.getByTestId("task-brief-chip")).toBeInTheDocument()
+    fireEvent.click(screen.getByRole("button", { name: "Start task" }))
+
+    await waitFor(() => expect(startTaskWithSession).toHaveBeenCalledTimes(1))
+    const [target, sessionToken, summary, projectToken, , , stagedBrief] =
+      startTaskWithSession.mock.calls[0] as unknown as [
+        string,
+        string | null,
+        string,
+        string,
+        unknown,
+        unknown,
+        File
+      ]
+    expect(target).toBe("agent-codex")
+    expect(sessionToken).toBeNull()
+    expect(summary).toBe("Selected project handoff")
+    expect(projectToken).toBe("project-token-1")
+    expect(stagedBrief.name).toBe("task-brief.md")
+    const briefContent = await new Promise<string>((resolve, reject) => {
+      const reader = new FileReader()
+      reader.onload = () => resolve(String(reader.result))
+      reader.onerror = () => reject(reader.error)
+      reader.readAsText(stagedBrief)
+    })
+    expect(briefContent).toBe(brief)
+    expect(screen.queryByText(/remove the task brief/i)).not.toBeInTheDocument()
+
+    roomHook.messages = [
+      {
+        peerId: "human-local",
+        name: "tester",
+        kind: "human",
+        type: "action",
+        actionType: "collab",
+        sequence: 1,
+        collab: {
+          requestId: "project-brief-task",
+          kind: "request",
+          fromParticipantId: "human-local",
+          targetParticipantId: "agent-codex",
+          summary: "Selected project handoff",
+        },
+      },
+    ]
+    rerender(
+      <RoomContent roomName="test-room" nickName="tester" roomType="audio" />
+    )
+    await waitFor(() =>
+      expect(
+        screen.getByTestId("interaction-tab-task-project-brief-task")
+      ).toHaveAttribute("aria-selected", "true")
+    )
+  })
+
+  it("keeps an ordinary short instruction on t
```

**File**: `app/src/components/RoomContent.tsx` (modified, +32/-19)
```diff
@@ -83,6 +83,23 @@ import { useSfuChatRoom, type RoomMicState } from "../hooks/useSfuChatRoom"
 import { useTurnstile } from "../hooks/useTurnstile"
 import type { TaskExecutionProjection } from "../room/types"
 
+function taskSessionConfigLabel(
+  option: RelayHarnessSessionControls["configOptions"][number],
+  controls: RelayHarnessSessionControls
+): string {
+  const label = option.name || option.id
+  const collisionCount =
+    Number(
+      controls.modes.length > 0 && label.trim().toLocaleLowerCase() === "mode"
+    ) +
+    controls.configOptions.filter(
+      (candidate) =>
+        (candidate.name || candidate.id).trim().toLocaleLowerCase() ===
+        label.trim().toLocaleLowerCase()
+    ).length
+  return collisionCount > 1 ? `${label} (${option.id})` : label
+}
+
 const MAX_FILE_SIZE = 20 * 1024 * 1024
 
 type TaskAgent = { peerId: string; name: string }
@@ -1771,14 +1788,9 @@ export default function RoomContent({
           taskBriefLabel(taskBriefText.current) ||
           TASK_BRIEF_DEFAULT_LABEL
         : ""
+      const taskSummary = taskBrief ? briefSummary : taskInstruction.trim()
       if (taskSessionMode === "new" || !taskAgentContinuation) {
-        if (taskBrief) {
-          if (taskSessionProjectToken) {
-            setTaskError(
-              "Remove the task brief before starting in a selected project."
-            )
-            return
-          }
+        if (taskBrief && !taskSessionProjectToken) {
           setTaskError("")
           setTaskStarting(true)
           const started = await startTaskWithBrief(
@@ -1805,17 +1817,18 @@ export default function RoomContent({
           const result = await startTaskWithSession(
             taskAgent.peerId,
             null,
-            taskInstruction,
+            taskSummary,
             taskSessionProjectToken,
             taskSessionModeId || undefined,
-            taskSessionConfigOptions
+            taskSessionConfigOptions,
+            taskBrief ?? undefined
           )
           setTaskStarting(false)
           if (result.ok === false) {
             setTaskError(taskSessionErrorMessage(result.error))
             return
           }
-          pendingLocalTaskSummaries.current.push(taskInstruction.trim())
+          pendingLocalTaskSummaries.current.push(taskSummary)
           closeTaskComposer()
           return
         }
@@ -1839,10 +1852,11 @@ export default function RoomContent({
       const result = await startTaskWithSession(
         taskAgent.peerId,
         selection.token,
-        taskBrief ? briefSummary : taskInstruction,
+        taskSummary,
         undefined,
         taskSessionModeId || undefined,
-        taskSessionConfigOptions
+        taskSessionConfigOptions,
+        taskBrief ?? undefined
       )
       setTaskStarting(false)
       if (result.ok === false) {
@@ -1852,9 +1866,7 @@ export default function RoomContent({
         setTaskError(taskSessionErrorMessage(result.error))
         return
       }
-      pendingLocalTaskSummaries.current.push(
-        taskBrief ? briefSummary : taskInstruction.trim()
-      )
+      pendingLocalTaskSummaries.current.push(taskSummary)
       setTaskAgent(null)
       setTaskInstruction("")
       setTaskError("")
@@ -3722,11 +3734,12 @@ export default function RoomContent({
                         key={option.id}
                         className="mb-2 block text-xs text-gray-300"
                       >
-                        {option.name || option.id}
+                        {taskSessionConfigLabel(option, taskSessionControls)}
                         <select
-                          aria-label={`Harness-native ${
-                            option.name || option.id
-                          }`}
+                          aria-label={`Harness-native ${taskSessionConfigLabel(
+                            option,
+                            taskSessionControls
+                          )}`}
                           value={taskSessionConfigOptions[option.id] ?? ""}
                           disabled={taskStarting}
                           onChange={(event) =>
```

**File**: `app/src/components/roomTaskSessionPicker.test.tsx` (modified, +2/-1)
```diff
@@ -409,7 +409,8 @@ describe("Start Task with an existing local session (#409)", () => {
       "Continue this work",
       undefined,
       undefined,
-      {}
+      {},
+      undefined
     )
     resolveStart({ ok: true })
     await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
```

**File**: `app/src/do/RoomSession.ts` (modified, +178/-6)
```diff
@@ -401,10 +401,11 @@ interface PendingTaskSessionDiscovery {
 
 interface PendingTaskSessionStart {
   requestId: string
-  /** Canonical collaboration requestId, generated before PREPARE was sent. */
+  /** Canonical collaboration requestId, fixed before PREPARE was sent. */
   taskRequestId: string
   targetAgentId: string
   summary: string
+  attachmentIds?: string[]
   expiresAt: number
 }
 
@@ -788,6 +789,13 @@ type ControlRequest =
       token: string
       attachmentId: string
     }
+  | {
+      action: "human-discard-task-attachment"
+      participantId: string
+      token: string
+      attachmentId: string
+      taskRequestId: string
+    }
   | {
       action: "agent-leave"
       participantId: string
@@ -1005,6 +1013,8 @@ type ClientMessage =
       type: "task-session-start"
       requestId: string
       targetParticipantId: string
+      taskRequestId?: string
+      attachmentIds?: string[]
       sessionToken?: string
       projectToken?: string
       modeId?: string
@@ -3498,6 +3508,42 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       reject("invalid_session_control")
       return
     }
+    const taskRequestId = message.taskRequestId ?? crypto.randomUUID()
+    if (!isCanonicalCollabRequestId(taskRequestId)) {
+      reject("invalid_session_control")
+      return
+    }
+    // Match the ordinary collab-request uniqueness check before asking the
+    // Runtime to prepare. A reused canonical Task id cannot arm an orphaned
+    // adoption or turn duplicate ingestion into a successful start.
+    this.warmCollabRegistry(room)
+    if (this.collabRegistry.find(taskRequestId)) {
+      reject("task_request_id_in_use")
+      return
+    }
+    const references = this.humanTaskContextReferenceIds(
+      room,
+      participant,
+      message.attachmentIds
+    )
+    if (references.ok === false) {
+      reject("invalid_session_control")
+      return
+    }
+    if (
+      (references.ids && message.taskRequestId === undefined) ||
+      (references.ids &&
+        references.ids.some(
+          (id) =>
+            room.attachments.find((attachment) => attachment.id === id)
+              ?.taskRequestId !== taskRequestId
+        ))
+    ) {
+      // The attachment is Task-owned context. It must already be staged by
+      // this Human against the exact canonical Task id before PREPARE begins.
+      reject("invalid_session_control")
+      return
+    }
     const modeId = message.modeId
     if (modeId !== undefined && !isValidHarnessControlText(modeId)) {
       reject("invalid_session_control")
@@ -3534,15 +3580,15 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       reject("task_session_busy")
       return
     }
-    // The canonical Task identity is generated BEFORE the preparation, so the
-    // Runtime can pin the adoption to exactly this id. It is indistinguishable
-    // from any other Human-created Task from here on.
-    const taskRequestId = crypto.randomUUID()
+    // The canonical Task identity is fixed BEFORE preparation, either by the
+    // browser when it has staged Task-owned brief context or here otherwise.
+    // It is indistinguishable from any other Human-created Task from here on.
     attachment.pendingTaskSessionStart = {
       requestId,
       taskRequestId,
       targetAgentId: target.id,
       summary,
+      ...(references.ids ? { attachmentIds: references.ids } : {}),
       expiresAt: now + TASK_SESSION_PENDING_TTL_MS,
     }
     try {
@@ -3772,8 +3818,11 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
         requestId: record.taskRequestId,
         targetParticipantId: record.targetAgentId,
         summary: record.summary,
+        ...(record.attachmentIds
+          ? { attachmentIds: record.attachmentIds }
+          : {}),
       })
-      appended = ingest.status !== "rejected"
+      appended = ingest.status === "recorded"
       continuationCreatedTask = ingest.status === "recorded"
     } catch {
       // A controlled append refusal (for example the primary Room record
@@ -6198,6 +6247,115 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       )
     }
 
+    if (request.action === "human-discard-task-attachment") {
+      const room = await this.activeRoom()
+      if (!room) return this.json({ error: "room_expired" }, 410)
+      const participant = this.findParticipant(
+        room,
+        request.participantId,
+        request.token
+      )
+      if (!participant) return this.json({ error: "unauthorized" }, 401)
+      if (participant.kind !== "human")
+        return this.json({ error: "human_only" }, 403)
+      const attachment = room.attachments.find(
+        (entry) => entry.id === request.attachmentId
+      )
+      if (!attachment) return this.json({ ok: true, removed: false })
+      if (
+        attachment.senderId !== participant.id ||
+        attachment.taskRequestId !== request.taskRequestId ||
+  
```

**File**: `app/src/do/roomSessionTaskSession.test.ts` (modified, +198/-0)
```diff
@@ -434,6 +434,204 @@ describe("RoomSession Task Session Continuation (#409)", () => {
     ])
   })
 
+  it("rejects a reused canonical Task id before session preparation", async () => {
+    const test = harness()
+    const humanSocket = test.connectHuman("human-1")
+    const agentSocket = recordDelivery(test, "agent-a")
+    const taskRequestId = crypto.randomUUID()
+    test.store.set("room", {
+      ...test.stored(),
+      nextMessageSequence: 1,
+      messages: [
+        {
+          id: crypto.randomUUID(),
+          peerId: "human-1",
+          name: "human-1",
+          kind: "human",
+          type: "action",
+          actionType: "collab",
+          sequence: 1,
+          createdAt: Date.now(),
+          targets: ["agent-a"],
+          collab: {
+            requestId: taskRequestId,
+            kind: "request",
+            fromParticipantId: "human-1",
+            targetParticipantId: "agent-a",
+            summary: "Already existing Task",
+          },
+        },
+      ],
+    })
+
+    await test.sendHuman(humanSocket, {
+      type: "task-session-start",
+      requestId: "browser-reused-task-id",
+      targetParticipantId: "agent-a",
+      taskRequestId,
+      projectToken: "project-token-1",
+      summary: "Must not arm a second preparation",
+    })
+
+    expect(test.sessionControls("agent-a")).toHaveLength(0)
+    expect(
+      (humanSocket.attachment() as { pendingTaskSessionStart?: unknown })
+        .pendingTaskSessionStart
+    ).toBeUndefined()
+    expect(test.humanResults(humanSocket)).toEqual([
+      {
+        type: "task-session-start-result",
+        requestId: "browser-reused-task-id",
+        ok: false,
+        error: "task_request_id_in_use",
+      },
+    ])
+
+    // The rejected reuse left no pending slot behind; a fresh canonical id
+    // can be prepared immediately.
+    await test.sendHuman(humanSocket, {
+      type: "task-session-start",
+      requestId: "browser-fresh-task-id",
+      targetParticipantId: "agent-a",
+      projectToken: "project-token-1",
+      summary: "Fresh Task id",
+    })
+    expect(
+      test
+        .sessionControls("agent-a")
+        .filter((control) => control.operation === "prepare")
+    ).toHaveLength(1)
+    expect(agentSocket.attachment()).toBeDefined()
+  })
+
+  it("fails closed if another canonical request claims the id during preparation", async () => {
+    const test = harness()
+    const humanSocket = test.connectHuman("human-1")
+    const agentSocket = recordDelivery(test, "agent-a")
+    const taskRequestId = crypto.randomUUID()
+
+    await test.sendHuman(humanSocket, {
+      type: "task-session-start",
+      requestId: "browser-racing-start",
+      targetParticipantId: "agent-a",
+      taskRequestId,
+      projectToken: "project-token-1",
+      summary: "Session-prepared instruction",
+    })
+    const prepare = test
+      .sessionControls("agent-a")
+      .find((control) => control.operation === "prepare")!
+
+    // A collab-request wins the canonical ID while session preparation is in
+    // flight. The duplicate ingestion after PREPARED must not report success.
+    await test.sendHuman(humanSocket, {
+      type: "collab-request",
+      requestId: taskRequestId,
+      targetParticipantId: "agent-a",
+      summary: "Ordinary request claimed the id",
+    })
+    await test.sendAgent(agentSocket, {
+      type: "task-session-result",
+      operation: "prepare",
+      requestId: prepare!.requestId,
+      ok: true,
+    })
+
+    expect(test.stored().messages).toHaveLength(1)
+    expect(test.stored().messages[0].collab?.summary).toBe(
+      "Ordinary request claimed the id"
+    )
+    expect(test.humanResults(humanSocket)).toContainEqual({
+      type: "task-session-start-result",
+      requestId: "browser-racing-start",
+      ok: false,
+      error: "session_continuation_unavailable",
+    })
+    expect(
+      test
+        .humanResults(humanSocket)
+        .some(
+          (result) => result.requestId === "browser-racing-start" && result.ok
+        )
+    ).toBe(false)
+    expect(
+      test
+        .sessionControls("agent-a")
+        .some(
+          (control) =>
+            control.operation === "cancel" &&
+            control.taskRequestId === taskRequestId
+        )
+    ).toBe(true)
+  })
+
+  it.each([
+    ["New Session in a selected project", { projectToken: "project-token-1" }],
+    ["Continue Session", { sessionToken: "session-token-1" }],
+  ])(
+    "carries a staged long brief through %s without project file semantics",
+    async (_name, selection) => {
+      const test = harness()
+      const humanSocket = test.connectHuman("human-1")
+      const agentSocket = recordDelivery(test, "agent-a")
+      const taskRequestId = crypto.randomUUID()
+      const attachmentId = crypto.randomUUID()
+      test.store.set("room", {
+        ...test.stored(),
+        attachments: [
+          {
+            id: attachmentId,
+         
```

**File**: `app/src/do/roomSessionTaskStartBrief.test.ts` (modified, +141/-3)
```diff
@@ -82,20 +82,45 @@ function room(): RoomRecord {
 
 function harness() {
   const store = new Map<string, unknown>([["room", room()]])
-  const humanSocket = { send: vi.fn(), close: vi.fn() } as unknown as WebSocket
+  let humanSocketAttachment: Record<string, unknown> = {
+    participantId: "human-1",
+    token: "human-1-token",
+    connectionNonce: "human-1-connection",
+  }
+  const humanSocket = {
+    send: vi.fn(),
+    close: vi.fn(),
+    deserializeAttachment: () => humanSocketAttachment,
+    serializeAttachment: (attachment: Record<string, unknown>) => {
+      humanSocketAttachment = attachment
+    },
+  } as unknown as WebSocket
+  const sockets: WebSocket[] = [humanSocket]
+  let agentSocketAttachment: Record<string, unknown> | null = null
+  const agentSocketFrames = vi.fn()
+  const agentSocket = {
+    send: agentSocketFrames,
+    deserializeAttachment: () => agentSocketAttachment,
+    serializeAttachment: (attachment: Record<string, unknown>) => {
+      agentSocketAttachment = attachment
+    },
+  } as unknown as WebSocket
 
   const ctx = {
     storage: {
       get: async (key: string) => store.get(key),
       put: async (key: string, value: unknown) => {
         store.set(key, value)
       },
-      delete: async () => undefined,
+      delete: async (key: string | string[]) => {
+        for (const entry of Array.isArray(key) ? key : [key])
+          store.delete(entry)
+      },
       setAlarm: async () => undefined,
       deleteAlarm: async () => undefined,
       getAlarm: async () => undefined,
     },
-    getWebSockets: () => [humanSocket] as unknown as WebSocket[],
+    getWebSockets: () => sockets,
   }
 
   const session = new RoomSession(ctx as never, { SFU_ROOM: {} } as never)
@@ -153,6 +178,64 @@ function harness() {
           body,
         })
       ),
+    discard: (attachmentId: string, taskRequestId: string) =>
+      session.fetch(
+        new Request("https://room/control", {
+          method: "POST",
+          headers: { "Content-Type": "application/json" },
+          body: JSON.stringify({
+            action: "human-discard-task-attachment",
+            participantId: "human-1",
+            token: "human-1-token",
+            attachmentId,
+            taskRequestId,
+          }),
+        })
+      ),
+    storage: store,
+    setHumanPendingStart: (taskRequestId: string, attachmentId: string) => {
+      humanSocketAttachment = {
+        ...humanSocketAttachment,
+        pendingTaskSessionStart: {
+          requestId: "browser-start-1",
+          taskRequestId,
+          targetAgentId: "agent-a",
+          summary: "brief task",
+          attachmentIds: [attachmentId],
+          expiresAt: Date.now() + 20_000,
+        },
+      }
+    },
+    setAgentPendingControl: (
+      taskRequestId: string,
+      humanParticipantId = "human-1"
+    ) => {
+      agentSocketAttachment = {
+        kind: "agent-event",
+        participantId: "agent-a",
+        connectionNonce: "agent-a-nonce",
+        cursor: 0,
+        pendingSessionControl: {
+          requestId: "runtime-prepare-1",
+          operation: "prepare",
+          browserRequestId: "browser-start-1",
+          humanParticipantId,
+          humanConnectionNonce: "human-1-connection",
+          taskRequestId,
+          expiresAt: Date.now() + 20_000,
+        },
+      }
+      sockets.push(agentSocket)
+    },
+    disconnectHumanSocket: () => {
+      const index = sockets.indexOf(humanSocket)
+      if (index >= 0) sockets.splice(index, 1)
+    },
+    agentControl: () =>
+      (agentSocketAttachment?.pendingSessionControl as
+        | Record<string, unknown>
+        | undefined) ?? null,
+    agentSocketFrames,
   }
 }
 
@@ -178,6 +261,61 @@ async function stageBrief(
 }
 
 describe("Start Task large brief (#421)", () => {
+  it("discards only the exact failed pre-Task brief and its chunks", async () => {
+    const test = harness()
+    const requestId = crypto.randomUUID()
+    const attachmentId = await stageBrief(test, requestId)
+    expect(test.storage.has(`attachment:${attachmentId}:0`)).toBe(true)
+
+    const response = await test.discard(attachmentId, requestId)
+    expect(response.status).toBe(200)
+    await expect(response.json()).resolves.toEqual({ ok: true, removed: true })
+    expect(test.stored().attachments).toEqual([])
+    expect(test.storage.has(`attachment:${attachmentId}:0`)).toBe(false)
+  })
+
+  it("releases the matching Runtime slot when the Human socket is gone", async () => {
+    const test = harness()
+    const requestId = crypto.randomUUID()
+    const attachmentId = await stageBrief(test, requestId)
+    test.setHumanPendingStart(requestId, attachmentId)
+    test.setAgentPendingControl(requestId)
+    test.disconnectHumanSocket()
+
+    const response = await test.discard(attachmentId, requestId)
+    expect(response.status).toBe(200)
+    expect(test.agentControl()).toBeNull()
+    expect(test.agentSocketFrames).toHaveBeenC
```

---

### Incident Patch 2: `f7da1e43` (2026-10-04)
**Commit Message**: fix(task): release failed session preparation promptly

**File**: `app/src/do/RoomSession.ts` (modified, +37/-6)
```diff
@@ -6278,6 +6278,7 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       // If PREPARE is still armed, release it before removing its exact brief.
       // A late PREPARED result then sees no owning pending record and follows
       // the existing cancel path.
+      const targetAgentIds = new Set<string>()
       for (const candidate of this.ctx.getWebSockets()) {
         let socketAttachment: ConnectionAttachment | null = null
         try {
@@ -6300,19 +6301,49 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
         } catch {
           // The exact Runtime preparation is still cancelled below.
         }
-        this.sendAgentSessionCancel(
-          room,
-          pending.targetAgentId,
-          participant.id,
-          pending.taskRequestId
-        )
+        targetAgentIds.add(pending.targetAgentId)
         this.sendHumanTaskSessionStartResult(
           candidate,
           pending.requestId,
           false,
           "session_continuation_unavailable"
         )
       }
+      // The Human socket can already have disappeared when this cleanup
+      // arrives. Find the matching Runtime correlation by its exact Human and
+      // Task identity, release only that slot, and send one cancel per Agent.
+      for (const target of Object.values(room.participants)) {
+        if (target.kind !== "agent") continue
+        for (const agentSocket of this.ctx.getWebSockets(
+          this.agentEventSocketTag(target.id)
+        )) {
+          const agentAttachment =
+            this.deserializeAgentEventAttachment(agentSocket)
+          const control = agentAttachment?.pendingSessionControl
+          if (
+            !agentAttachment ||
+            agentAttachment.participantId !== target.id ||
+            control?.operation !== "prepare" ||
+            control.humanParticipantId !== participant.id ||
+            control.taskRequestId !== request.taskRequestId
+          )
+            continue
+          targetAgentIds.add(target.id)
+          delete agentAttachment.pendingSessionControl
+          try {
+            agentSocket.serializeAttachment(agentAttachment)
+          } catch {
+            // A late Runtime result remains fenced by its missing correlation.
+          }
+        }
+      }
+      for (const targetAgentId of targetAgentIds)
+        this.sendAgentSessionCancel(
+          room,
+          targetAgentId,
+          participant.id,
+          request.taskRequestId
+        )
 
       room.attachments = room.attachments.filter(
         (entry) => entry.id !== request.attachmentId
```

**File**: `app/src/do/roomSessionTaskStartBrief.test.ts` (modified, +83/-2)
```diff
@@ -82,7 +82,29 @@ function room(): RoomRecord {
 
 function harness() {
   const store = new Map<string, unknown>([["room", room()]])
-  const humanSocket = { send: vi.fn(), close: vi.fn() } as unknown as WebSocket
+  let humanSocketAttachment: Record<string, unknown> = {
+    participantId: "human-1",
+    token: "human-1-token",
+    connectionNonce: "human-1-connection",
+  }
+  const humanSocket = {
+    send: vi.fn(),
+    close: vi.fn(),
+    deserializeAttachment: () => humanSocketAttachment,
+    serializeAttachment: (attachment: Record<string, unknown>) => {
+      humanSocketAttachment = attachment
+    },
+  } as unknown as WebSocket
+  const sockets: WebSocket[] = [humanSocket]
+  let agentSocketAttachment: Record<string, unknown> | null = null
+  const agentSocketFrames = vi.fn()
+  const agentSocket = {
+    send: agentSocketFrames,
+    deserializeAttachment: () => agentSocketAttachment,
+    serializeAttachment: (attachment: Record<string, unknown>) => {
+      agentSocketAttachment = attachment
+    },
+  } as unknown as WebSocket
 
   const ctx = {
     storage: {
@@ -98,7 +120,7 @@ function harness() {
       deleteAlarm: async () => undefined,
       getAlarm: async () => undefined,
     },
-    getWebSockets: () => [humanSocket] as unknown as WebSocket[],
+    getWebSockets: () => sockets,
   }
 
   const session = new RoomSession(ctx as never, { SFU_ROOM: {} } as never)
@@ -171,6 +193,49 @@ function harness() {
         })
       ),
     storage: store,
+    setHumanPendingStart: (taskRequestId: string, attachmentId: string) => {
+      humanSocketAttachment = {
+        ...humanSocketAttachment,
+        pendingTaskSessionStart: {
+          requestId: "browser-start-1",
+          taskRequestId,
+          targetAgentId: "agent-a",
+          summary: "brief task",
+          attachmentIds: [attachmentId],
+          expiresAt: Date.now() + 20_000,
+        },
+      }
+    },
+    setAgentPendingControl: (
+      taskRequestId: string,
+      humanParticipantId = "human-1"
+    ) => {
+      agentSocketAttachment = {
+        kind: "agent-event",
+        participantId: "agent-a",
+        connectionNonce: "agent-a-nonce",
+        cursor: 0,
+        pendingSessionControl: {
+          requestId: "runtime-prepare-1",
+          operation: "prepare",
+          browserRequestId: "browser-start-1",
+          humanParticipantId,
+          humanConnectionNonce: "human-1-connection",
+          taskRequestId,
+          expiresAt: Date.now() + 20_000,
+        },
+      }
+      sockets.push(agentSocket)
+    },
+    disconnectHumanSocket: () => {
+      const index = sockets.indexOf(humanSocket)
+      if (index >= 0) sockets.splice(index, 1)
+    },
+    agentControl: () =>
+      (agentSocketAttachment?.pendingSessionControl as
+        | Record<string, unknown>
+        | undefined) ?? null,
+    agentSocketFrames,
   }
 }
 
@@ -209,6 +274,22 @@ describe("Start Task large brief (#421)", () => {
     expect(test.storage.has(`attachment:${attachmentId}:0`)).toBe(false)
   })
 
+  it("releases the matching Runtime slot when the Human socket is gone", async () => {
+    const test = harness()
+    const requestId = crypto.randomUUID()
+    const attachmentId = await stageBrief(test, requestId)
+    test.setHumanPendingStart(requestId, attachmentId)
+    test.setAgentPendingControl(requestId)
+    test.disconnectHumanSocket()
+
+    const response = await test.discard(attachmentId, requestId)
+    expect(response.status).toBe(200)
+    expect(test.agentControl()).toBeNull()
+    expect(test.agentSocketFrames).toHaveBeenCalledWith(
+      expect.stringContaining('"operation":"cancel"')
+    )
+  })
+
   it("does not let a provisional brief evict existing Room attachments", async () => {
     const test = harness()
     const existing = Array.from({ length: 8 }, (_, index) => ({
```

**File**: `app/src/hooks/useSfuChatRoom.test.tsx` (modified, +62/-0)
```diff
@@ -1822,6 +1822,68 @@ describe("useSfuChatRoom Live Transcript RoomState wiring (#177 PR3)", () => {
     }
   })
 
+  it("returns a failed start without waiting for best-effort brief cleanup", async () => {
+    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
+    const originalFetch = fetchMock.getMockImplementation() as
+      | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
+      | undefined
+    fetchMock.mockImplementation((input, init) => {
+      if (String(input).endsWith("/api/room/attachments"))
+        return jsonResponse({ attachment: { id: "failed-start-brief" } })
+      if (String(input).endsWith("/api/room/attachments/discard"))
+        return new Promise<Response>(() => undefined)
+      return originalFetch!(input, init)
+    })
+    const { result, unmount } = renderHook(() =>
+      useSfuChatRoom("project-brief-cleanup-room", "Guest", "audio")
+    )
+    await waitFor(() => expect(RecordingWebSocket.instances).toHaveLength(1))
+    await waitFor(() =>
+      expect(result.current.getLocalRoomAuth()).toMatchObject({
+        participantId: "human-a",
+      })
+    )
+    const socket = RecordingWebSocket.instances[0]
+    act(() => socket.onopen?.())
+    const pending = result.current.startTaskWithSession(
+      "agent-pi",
+      null,
+      "Start the brief",
+      "project-token-1",
+      undefined,
+      {},
+      new File(["brief"], "task-brief.md", { type: "text/markdown" })
+    )
+    await waitFor(() =>
+      expect(
+        socket.sent.some(
+          (payload) => JSON.parse(payload).type === "task-session-start"
+        )
+      ).toBe(true)
+    )
+    const frame = JSON.parse(socket.sent.at(-1) ?? "{}")
+    act(() =>
+      socket.onmessage?.({
+        data: JSON.stringify({
+          type: "task-session-start-result",
+          requestId: frame.requestId,
+          ok: false,
+          error: "session_selection_expired",
+        }),
+      })
+    )
+    await expect(pending).resolves.toEqual({
+      ok: false,
+      error: "session_selection_expired",
+    })
+    expect(
+      fetchMock.mock.calls.some(([input]) =>
+        String(input).endsWith("/api/room/attachments/discard")
+      )
+    ).toBe(true)
+    unmount()
+  })
+
   it("does not send a brief when its socket closes during staging", async () => {
     const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
     const originalFetch = fetchMock.getMockImplementation() as
```

**File**: `app/src/hooks/useSfuChatRoom.ts` (modified, +2/-4)
```diff
@@ -4959,7 +4959,6 @@ export function useSfuChatRoom(
             pendingTaskSessionRequestsRef.current.delete(requestId)
             clearTimeout(pendingRequest.timeout)
             settle({ ok: false, error: "session_continuation_unavailable" })
-            if (stagedAttachmentId) void discardStagedBrief(stagedAttachmentId)
             return
           }
           // Brief staging has its own bounded client deadline. Runtime PREPARE
@@ -4982,16 +4981,15 @@ export function useSfuChatRoom(
           pendingTaskSessionRequestsRef.current.delete(requestId)
           clearTimeout(pendingRequest.timeout)
           settle({ ok: false, error: "session_continuation_unavailable" })
-          if (stagedAttachmentId) void discardStagedBrief(stagedAttachmentId)
         }
         if (!brief) {
           sendStart(null)
           return
         }
         void stageBrief().then(sendStart)
-      }).then(async (result) => {
+      }).then((result) => {
         if (!result.ok && stagedAttachmentId)
-          await discardStagedBrief(stagedAttachmentId)
+          void discardStagedBrief(stagedAttachmentId)
         return result
       })
     },
```

---

### Incident Patch 3: `66dd7020` (2026-10-04)
**Commit Message**: fix(task): clean up staged briefs after failed starts

**File**: `app/src/do/RoomSession.ts` (modified, +99/-0)
```diff
@@ -789,6 +789,13 @@ type ControlRequest =
       token: string
       attachmentId: string
     }
+  | {
+      action: "human-discard-task-attachment"
+      participantId: string
+      token: string
+      attachmentId: string
+      taskRequestId: string
+    }
   | {
       action: "agent-leave"
       participantId: string
@@ -6240,6 +6247,84 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       )
     }
 
+    if (request.action === "human-discard-task-attachment") {
+      const room = await this.activeRoom()
+      if (!room) return this.json({ error: "room_expired" }, 410)
+      const participant = this.findParticipant(
+        room,
+        request.participantId,
+        request.token
+      )
+      if (!participant) return this.json({ error: "unauthorized" }, 401)
+      if (participant.kind !== "human")
+        return this.json({ error: "human_only" }, 403)
+      const attachment = room.attachments.find(
+        (entry) => entry.id === request.attachmentId
+      )
+      if (!attachment) return this.json({ ok: true, removed: false })
+      if (
+        attachment.senderId !== participant.id ||
+        attachment.taskRequestId !== request.taskRequestId ||
+        attachment.taskWake !== false
+      )
+        return this.json({ error: "attachment_unavailable" }, 404)
+
+      // The Runtime may have committed the Task even if its reply was lost.
+      // Never discard context that now belongs to a canonical Task.
+      this.warmCollabRegistry(room)
+      if (this.collabRegistry.find(request.taskRequestId))
+        return this.json({ ok: true, removed: false, reason: "task_exists" })
+
+      // If PREPARE is still armed, release it before removing its exact brief.
+      // A late PREPARED result then sees no owning pending record and follows
+      // the existing cancel path.
+      for (const candidate of this.ctx.getWebSockets()) {
+        let socketAttachment: ConnectionAttachment | null = null
+        try {
+          socketAttachment =
+            candidate.deserializeAttachment() as ConnectionAttachment | null
+        } catch {
+          socketAttachment = null
+        }
+        const pending = socketAttachment?.pendingTaskSessionStart
+        if (
+          !socketAttachment ||
+          socketAttachment.participantId !== participant.id ||
+          pending?.taskRequestId !== request.taskRequestId ||
+          !pending.attachmentIds?.includes(request.attachmentId)
+        )
+          continue
+        delete socketAttachment.pendingTaskSessionStart
+        try {
+          candidate.serializeAttachment(socketAttachment)
+        } catch {
+          // The exact Runtime preparation is still cancelled below.
+        }
+        this.sendAgentSessionCancel(
+          room,
+          pending.targetAgentId,
+          participant.id,
+          pending.taskRequestId
+        )
+        this.sendHumanTaskSessionStartResult(
+          candidate,
+          pending.requestId,
+          false,
+          "session_continuation_unavailable"
+        )
+      }
+
+      room.attachments = room.attachments.filter(
+        (entry) => entry.id !== request.attachmentId
+      )
+      participant.lastSeenAt = Date.now()
+      await this.saveRoom(room)
+      await this.deleteAttachmentChunks(attachment)
+      await this.broadcastState(room)
+      await this.scheduleNextAlarm(room)
+      return this.json({ ok: true, removed: true })
+    }
+
     if (request.action === "agent-leave") {
       const room = await this.activeRoom()
       if (!room) return this.json({ error: "room_expired" }, 410)
@@ -9568,6 +9653,11 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       parseTaskAttachmentWake(
         request.headers.get(TASK_ATTACHMENT_WAKE_HEADER)
       ) === true
+    // A staged brief is provisional until canonical Task creation succeeds.
+    // Never let it evict older user artifacts; if the bounded store is full,
+    // fail staging before writing any bytes.
+    if (pendingTaskContext && room.attachments.length >= MAX_AGENT_ATTACHMENTS)
+      return this.json({ error: "attachment_store_full" }, 409)
     // #106: agents as well as humans may contribute to the room's bounded
     // ephemeral attachment set — a collaborating agent's screenshot/log/JSON
     // artifact rides the exact same store, limits, and eviction rules as
@@ -9629,6 +9719,15 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
           bytes.slice(start, start + ATTACHMENT_CHUNK_SIZE)
         )
       }
+      // Recheck after chunk writes because another upload may have filled the
+      // bounded store while storage awaits yielded the Durable Object turn.
+      if (
+        pendingTaskContext &&
+        room.attachments.length >= MAX_AGENT_ATTACHMENTS
+      ) {
+        await this.deleteAttachmentChunks(attachment)
+        return this.json({ error: "attachment_store_full" }, 409)
+      }
       room.nextMessageSe
```

**File**: `app/src/do/roomSessionTaskStartBrief.test.ts` (modified, +58/-1)
```diff
@@ -90,7 +90,10 @@ function harness() {
       put: async (key: string, value: unknown) => {
         store.set(key, value)
       },
-      delete: async () => undefined,
+      delete: async (key: string | string[]) => {
+        for (const entry of Array.isArray(key) ? key : [key])
+          store.delete(entry)
+      },
       setAlarm: async () => undefined,
       deleteAlarm: async () => undefined,
       getAlarm: async () => undefined,
@@ -153,6 +156,21 @@ function harness() {
           body,
         })
       ),
+    discard: (attachmentId: string, taskRequestId: string) =>
+      session.fetch(
+        new Request("https://room/control", {
+          method: "POST",
+          headers: { "Content-Type": "application/json" },
+          body: JSON.stringify({
+            action: "human-discard-task-attachment",
+            participantId: "human-1",
+            token: "human-1-token",
+            attachmentId,
+            taskRequestId,
+          }),
+        })
+      ),
+    storage: store,
   }
 }
 
@@ -178,6 +196,45 @@ async function stageBrief(
 }
 
 describe("Start Task large brief (#421)", () => {
+  it("discards only the exact failed pre-Task brief and its chunks", async () => {
+    const test = harness()
+    const requestId = crypto.randomUUID()
+    const attachmentId = await stageBrief(test, requestId)
+    expect(test.storage.has(`attachment:${attachmentId}:0`)).toBe(true)
+
+    const response = await test.discard(attachmentId, requestId)
+    expect(response.status).toBe(200)
+    await expect(response.json()).resolves.toEqual({ ok: true, removed: true })
+    expect(test.stored().attachments).toEqual([])
+    expect(test.storage.has(`attachment:${attachmentId}:0`)).toBe(false)
+  })
+
+  it("does not let a provisional brief evict existing Room attachments", async () => {
+    const test = harness()
+    const existing = Array.from({ length: 8 }, (_, index) => ({
+      id: `existing-${index}`,
+      senderId: "human-1",
+      senderName: "human-1",
+      senderKind: "human" as const,
+      mimeType: "text/markdown" as const,
+      fileName: `existing-${index}.md`,
+      size: 1,
+      chunkCount: 1,
+      createdAt: index,
+      sequence: index + 1,
+    }))
+    const stored = test.stored()
+    stored.attachments = existing
+    test.storage.set("room", stored)
+
+    const response = await test.upload("human-1", "brief", {
+      "X-Task-Request-Id": crypto.randomUUID(),
+      [TASK_ATTACHMENT_PENDING_HEADER]: "1",
+    })
+    expect(response.status).toBe(409)
+    expect(test.stored().attachments).toEqual(existing)
+  })
+
   it("stages a pre-Task brief against the pinned canonical Task id", async () => {
     const test = harness()
     const requestId = crypto.randomUUID()
```

**File**: `app/src/hooks/useSfuChatRoom.test.tsx` (modified, +81/-0)
```diff
@@ -1724,6 +1724,11 @@ describe("useSfuChatRoom Live Transcript RoomState wiring (#177 PR3)", () => {
       })
       expect(starts()).toHaveLength(1)
       expect(starts()[0].attachmentIds).toEqual(["retry-attachment"])
+      expect(
+        fetchMock.mock.calls.some(([input]) =>
+          String(input).endsWith("/api/room/attachments/discard")
+        )
+      ).toBe(true)
 
       act(() =>
         socket.onmessage?.({
@@ -1741,6 +1746,82 @@ describe("useSfuChatRoom Live Transcript RoomState wiring (#177 PR3)", () => {
     }
   })
 
+  it("starts the Runtime reply timeout only after brief staging completes", async () => {
+    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
+    const originalFetch = fetchMock.getMockImplementation() as
+      | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
+      | undefined
+    let finishUpload: ((response: Response) => void) | undefined
+    fetchMock.mockImplementation((input) => {
+      if (String(input).endsWith("/api/room/attachments"))
+        return new Promise<Response>((resolve) => {
+          finishUpload = resolve
+        })
+      return originalFetch!(input)
+    })
+    const { result, unmount } = renderHook(() =>
+      useSfuChatRoom("project-brief-response-timeout-room", "Guest", "audio")
+    )
+    await waitFor(() => expect(RecordingWebSocket.instances).toHaveLength(1))
+    await waitFor(() =>
+      expect(result.current.getLocalRoomAuth()).toMatchObject({
+        participantId: "human-a",
+      })
+    )
+    const socket = RecordingWebSocket.instances[0]
+    act(() => socket.onopen?.())
+    const brief = new File(["staged later"], "task-brief.md", {
+      type: "text/markdown",
+    })
+    vi.useFakeTimers()
+    try {
+      let completed = false
+      const pending = result.current.startTaskWithSession(
+        "agent-pi",
+        null,
+        "Start with the brief",
+        "project-token-1",
+        undefined,
+        {},
+        brief
+      )
+      void pending.then(() => {
+        completed = true
+      })
+      await act(async () => {
+        await vi.advanceTimersByTimeAsync(20_000)
+      })
+      await act(async () => {
+        finishUpload?.(
+          (await jsonResponse({
+            attachment: { id: "staged-before-prepare" },
+          })) as Response
+        )
+        await Promise.resolve()
+        await Promise.resolve()
+      })
+      const frame = JSON.parse(socket.sent.at(-1) ?? "{}")
+      expect(frame.type).toBe("task-session-start")
+      await act(async () => {
+        await vi.advanceTimersByTimeAsync(24_000)
+      })
+      expect(completed).toBe(false)
+      act(() =>
+        socket.onmessage?.({
+          data: JSON.stringify({
+            type: "task-session-start-result",
+            requestId: frame.requestId,
+            ok: true,
+          }),
+        })
+      )
+      await expect(pending).resolves.toEqual({ ok: true })
+    } finally {
+      vi.useRealTimers()
+      unmount()
+    }
+  })
+
   it("does not send a brief when its socket closes during staging", async () => {
     const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
     const originalFetch = fetchMock.getMockImplementation() as
```

**File**: `app/src/hooks/useSfuChatRoom.ts` (modified, +58/-10)
```diff
@@ -4895,18 +4895,53 @@ export function useSfuChatRoom(
         }
       }
       const requestId = crypto.randomUUID()
+      const discardStagedBrief = async (attachmentId: string) => {
+        const session = sessionRef.current
+        if (!session || !taskRequestId) return
+        try {
+          await fetch("/api/room/attachments/discard", {
+            method: "POST",
+            headers: {
+              "Content-Type": "application/json",
+              "X-Room-Id": roomName,
+              "X-Room-Participant-Id": session.participantId,
+              "X-Room-Participant-Token": session.participantToken,
+            },
+            body: JSON.stringify({ attachmentId, taskRequestId }),
+          })
+        } catch {
+          // A failed cleanup is bounded by normal attachment retention/expiry.
+        }
+      }
+      let stagedAttachmentId: string | null = null
       return new Promise<TaskSessionStartResult>((settle) => {
-        const timeout = setTimeout(() => {
-          pendingTaskSessionRequestsRef.current.delete(requestId)
-          settle({ ok: false, error: "session_continuation_unavailable" })
-        }, TASK_SESSION_CLIENT_TIMEOUT_MS)
-        const pendingRequest = {
+        const pendingRequest: {
+          kind: "start"
+          settle: (
+            result: TaskSessionListResult | TaskSessionStartResult
+          ) => void
+          timeout: ReturnType<typeof setTimeout>
+        } = {
           kind: "start",
           settle: settle as (
             result: TaskSessionListResult | TaskSessionStartResult
           ) => void,
-          timeout,
-        } as const
+          timeout: setTimeout(() => undefined, 0),
+        }
+        clearTimeout(pendingRequest.timeout)
+        const armTimeout = () => {
+          clearTimeout(pendingRequest.timeout)
+          pendingRequest.timeout = setTimeout(() => {
+            if (
+              pendingTaskSessionRequestsRef.current.get(requestId) !==
+              pendingRequest
+            )
+              return
+            pendingTaskSessionRequestsRef.current.delete(requestId)
+            settle({ ok: false, error: "session_continuation_unavailable" })
+          }, TASK_SESSION_CLIENT_TIMEOUT_MS)
+        }
+        armTimeout()
         pendingTaskSessionRequestsRef.current.set(requestId, pendingRequest)
         const sendStart = (attachmentId: string | null) => {
           // Brief staging is asynchronous and may outlive the client timeout
@@ -4915,14 +4950,22 @@ export function useSfuChatRoom(
           if (
             pendingTaskSessionRequestsRef.current.get(requestId) !==
             pendingRequest
-          )
+          ) {
+            if (attachmentId) void discardStagedBrief(attachmentId)
             return
+          }
+          if (attachmentId) stagedAttachmentId = attachmentId
           if (brief && !attachmentId) {
             pendingTaskSessionRequestsRef.current.delete(requestId)
-            clearTimeout(timeout)
+            clearTimeout(pendingRequest.timeout)
             settle({ ok: false, error: "session_continuation_unavailable" })
+            if (stagedAttachmentId) void discardStagedBrief(stagedAttachmentId)
             return
           }
+          // Brief staging has its own bounded client deadline. Runtime PREPARE
+          // starts only after this frame is sent, so staging time must not eat
+          // into the response window.
+          armTimeout()
           const sent = sendSocketMessage({
             type: "task-session-start",
             requestId,
@@ -4937,14 +4980,19 @@ export function useSfuChatRoom(
           })
           if (sent) return
           pendingTaskSessionRequestsRef.current.delete(requestId)
-          clearTimeout(timeout)
+          clearTimeout(pendingRequest.timeout)
           settle({ ok: false, error: "session_continuation_unavailable" })
+          if (stagedAttachmentId) void discardStagedBrief(stagedAttachmentId)
         }
         if (!brief) {
           sendStart(null)
           return
         }
         void stageBrief().then(sendStart)
+      }).then(async (result) => {
+        if (!result.ok && stagedAttachmentId)
+          await discardStagedBrief(stagedAttachmentId)
+        return result
       })
     },
     [roomName, sendSocketMessage]
```

**File**: `app/src/room/server.taskAttachmentPending.test.ts` (modified, +41/-5)
```diff
@@ -20,6 +20,7 @@ import {
  */
 
 type CapturedUpload = {
+  action?: string
   taskRequestId: string | null
   pending: string | null
   taskWake: string | null
@@ -31,13 +32,18 @@ function envCapturing(uploads: CapturedUpload[]): RoomProtocolEnv {
     get: () => ({
       fetch: (
         _url: string | URL,
-        init?: { headers?: { get: (name: string) => string | null } }
+        init?: {
+          headers?: HeadersInit
+          body?: BodyInit | null
+        }
       ) => {
-        const header = (name: string) =>
-          init?.headers?.get(name) ??
-          init?.headers?.get(name.toLowerCase()) ??
-          null
+        const headers = new Headers(init?.headers)
+        const header = (name: string) => headers.get(name)
         uploads.push({
+          action:
+            typeof init?.body === "string"
+              ? (JSON.parse(init.body) as { action?: string }).action
+              : undefined,
           taskRequestId: header("X-Task-Request-Id"),
           pending: header(TASK_ATTACHMENT_PENDING_HEADER),
           taskWake: header(TASK_ATTACHMENT_WAKE_HEADER),
@@ -76,6 +82,36 @@ function upload(
 const PRE_TASK_ID = "6f1c2f9c-0b3a-4a1f-9d5a-2b8f7c0e4d21"
 
 describe("Worker pre-Task attachment transport (#421)", () => {
+  it("forwards authenticated cleanup for the exact provisional Task brief", async () => {
+    const uploads: CapturedUpload[] = []
+    const response = await handleRoomRequest(
+      new Request("https://www.free4.chat/api/room/attachments/discard", {
+        method: "POST",
+        headers: {
+          Origin: "http://localhost:3000",
+          "Content-Type": "application/json",
+          "X-Room-Id": "test-room",
+          "X-Room-Participant-Id": "human-1",
+          "X-Room-Participant-Token": "tok-human",
+        },
+        body: JSON.stringify({
+          attachmentId: "att-1",
+          taskRequestId: PRE_TASK_ID,
+        }),
+      }),
+      envCapturing(uploads)
+    )
+    expect(response.status).toBe(200)
+    expect(uploads).toEqual([
+      {
+        action: "human-discard-task-attachment",
+        taskRequestId: null,
+        pending: null,
+        taskWake: null,
+      },
+    ])
+  })
+
   it("forwards the canonical pre-Task marker and the pinned Task id", async () => {
     const uploads: CapturedUpload[] = []
     const response = await upload(envCapturing(uploads), {
```

**File**: `app/src/room/server.ts` (modified, +40/-0)
```diff
@@ -36,6 +36,7 @@ const ROOM_REQUEST_PATHS = new Set([
   "/api/room/permissions/request",
   "/api/room/surfaces/read",
   "/api/room/attachments/read",
+  "/api/room/attachments/discard",
 ])
 const SUPPORTED_IMAGE_TYPES = new Set([
   "image/jpeg",
@@ -432,6 +433,45 @@ export async function handleRoomRequest(
     })
   }
 
+  // A failed Start Task can leave a pre-Task brief staged before the Task
+  // exists. Its owner may discard only that exact Task-owned context.
+  if (pathname === "/api/room/attachments/discard") {
+    if (request.method !== "POST")
+      return json({ error: "method_not_allowed" }, 405)
+    const room = request.headers.get("X-Room-Id")?.trim() ?? ""
+    const participantId = request.headers.get("X-Room-Participant-Id") ?? ""
+    const token = request.headers.get("X-Room-Participant-Token") ?? ""
+    if (!room || room.length > MAX_ROOM_LENGTH || !participantId || !token)
+      return json({ error: "missing_room_capability" }, 400)
+    let body: { attachmentId?: unknown; taskRequestId?: unknown }
+    try {
+      body = (await request.json()) as typeof body
+    } catch {
+      return json({ error: "invalid_request" }, 400)
+    }
+    if (
+      typeof body.attachmentId !== "string" ||
+      body.attachmentId.length === 0 ||
+      body.attachmentId.length > MAX_ROOM_LENGTH ||
+      typeof body.taskRequestId !== "string" ||
+      body.taskRequestId.length === 0 ||
+      body.taskRequestId.length > MAX_ROOM_LENGTH
+    )
+      return json({ error: "invalid_request" }, 400)
+    const stub = env.SFU_ROOM.get(env.SFU_ROOM.idFromName(room))
+    return stub.fetch("https://room/control", {
+      method: "POST",
+      headers: { "Content-Type": "application/json" },
+      body: JSON.stringify({
+        action: "human-discard-task-attachment",
+        participantId,
+        token,
+        attachmentId: body.attachmentId,
+        taskRequestId: body.taskRequestId,
+      }),
+    })
+  }
+
   if (request.method !== "POST")
     return json({ error: "method_not_allowed" }, 405)
 
```

---

### Incident Patch 4: `702bfd18` (2026-10-04)
**Commit Message**: fix(task): close async staging and session id races

**File**: `app/src/components/RoomContent.test.tsx` (modified, +30/-3)
```diff
@@ -493,7 +493,7 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
 
   it("starts a selected-project New Session with the full long brief as Task context", async () => {
     const startTaskWithSession = vi.fn(async () => ({ ok: true as const }))
-    mockUseSfuChatRoom.mockReturnValue({
+    const roomHook = {
       ...baseHookReturn,
       connectionStatus: "connected",
       startTaskWithSession,
@@ -523,9 +523,10 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
           controls: { modes: [], configOptions: [] },
         },
       })),
-    })
+    }
+    mockUseSfuChatRoom.mockReturnValue(roomHook)
 
-    render(
+    const { rerender } = render(
       <RoomContent roomName="test-room" nickName="tester" roomType="audio" />
     )
     fireEvent.click(screen.getAllByLabelText("Start task with Codex")[0])
@@ -567,6 +568,32 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
     })
     expect(briefContent).toBe(brief)
     expect(screen.queryByText(/remove the task brief/i)).not.toBeInTheDocument()
+
+    roomHook.messages = [
+      {
+        peerId: "human-local",
+        name: "tester",
+        kind: "human",
+        type: "action",
+        actionType: "collab",
+        sequence: 1,
+        collab: {
+          requestId: "project-brief-task",
+          kind: "request",
+          fromParticipantId: "human-local",
+          targetParticipantId: "agent-codex",
+          summary: "Selected project handoff",
+        },
+      },
+    ]
+    rerender(
+      <RoomContent roomName="test-room" nickName="tester" roomType="audio" />
+    )
+    await waitFor(() =>
+      expect(
+        screen.getByTestId("interaction-tab-task-project-brief-task")
+      ).toHaveAttribute("aria-selected", "true")
+    )
   })
 
   it("keeps an ordinary short instruction on the selected-project start path", async () => {
```

**File**: `app/src/components/RoomContent.tsx` (modified, +5/-6)
```diff
@@ -1788,6 +1788,7 @@ export default function RoomContent({
           taskBriefLabel(taskBriefText.current) ||
           TASK_BRIEF_DEFAULT_LABEL
         : ""
+      const taskSummary = taskBrief ? briefSummary : taskInstruction.trim()
       if (taskSessionMode === "new" || !taskAgentContinuation) {
         if (taskBrief && !taskSessionProjectToken) {
           setTaskError("")
@@ -1816,7 +1817,7 @@ export default function RoomContent({
           const result = await startTaskWithSession(
             taskAgent.peerId,
             null,
-            taskBrief ? briefSummary : taskInstruction,
+            taskSummary,
             taskSessionProjectToken,
             taskSessionModeId || undefined,
             taskSessionConfigOptions,
@@ -1827,7 +1828,7 @@ export default function RoomContent({
             setTaskError(taskSessionErrorMessage(result.error))
             return
           }
-          pendingLocalTaskSummaries.current.push(taskInstruction.trim())
+          pendingLocalTaskSummaries.current.push(taskSummary)
           closeTaskComposer()
           return
         }
@@ -1851,7 +1852,7 @@ export default function RoomContent({
       const result = await startTaskWithSession(
         taskAgent.peerId,
         selection.token,
-        taskBrief ? briefSummary : taskInstruction,
+        taskSummary,
         undefined,
         taskSessionModeId || undefined,
         taskSessionConfigOptions,
@@ -1865,9 +1866,7 @@ export default function RoomContent({
         setTaskError(taskSessionErrorMessage(result.error))
         return
       }
-      pendingLocalTaskSummaries.current.push(
-        taskBrief ? briefSummary : taskInstruction.trim()
-      )
+      pendingLocalTaskSummaries.current.push(taskSummary)
       setTaskAgent(null)
       setTaskInstruction("")
       setTaskError("")
```

**File**: `app/src/components/roomTaskSessionPicker.test.tsx` (modified, +2/-1)
```diff
@@ -409,7 +409,8 @@ describe("Start Task with an existing local session (#409)", () => {
       "Continue this work",
       undefined,
       undefined,
-      {}
+      {},
+      undefined
     )
     resolveStart({ ok: true })
     await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
```

**File**: `app/src/do/RoomSession.ts` (modified, +9/-1)
```diff
@@ -3506,6 +3506,14 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       reject("invalid_session_control")
       return
     }
+    // Match the ordinary collab-request uniqueness check before asking the
+    // Runtime to prepare. A reused canonical Task id cannot arm an orphaned
+    // adoption or turn duplicate ingestion into a successful start.
+    this.warmCollabRegistry(room)
+    if (this.collabRegistry.find(taskRequestId)) {
+      reject("task_request_id_in_use")
+      return
+    }
     const references = this.humanTaskContextReferenceIds(
       room,
       participant,
@@ -3807,7 +3815,7 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
           ? { attachmentIds: record.attachmentIds }
           : {}),
       })
-      appended = ingest.status !== "rejected"
+      appended = ingest.status === "recorded"
       continuationCreatedTask = ingest.status === "recorded"
     } catch {
       // A controlled append refusal (for example the primary Room record
```

**File**: `app/src/do/roomSessionTaskSession.test.ts` (modified, +131/-0)
```diff
@@ -434,6 +434,137 @@ describe("RoomSession Task Session Continuation (#409)", () => {
     ])
   })
 
+  it("rejects a reused canonical Task id before session preparation", async () => {
+    const test = harness()
+    const humanSocket = test.connectHuman("human-1")
+    const agentSocket = recordDelivery(test, "agent-a")
+    const taskRequestId = crypto.randomUUID()
+    test.store.set("room", {
+      ...test.stored(),
+      nextMessageSequence: 1,
+      messages: [
+        {
+          id: crypto.randomUUID(),
+          peerId: "human-1",
+          name: "human-1",
+          kind: "human",
+          type: "action",
+          actionType: "collab",
+          sequence: 1,
+          createdAt: Date.now(),
+          targets: ["agent-a"],
+          collab: {
+            requestId: taskRequestId,
+            kind: "request",
+            fromParticipantId: "human-1",
+            targetParticipantId: "agent-a",
+            summary: "Already existing Task",
+          },
+        },
+      ],
+    })
+
+    await test.sendHuman(humanSocket, {
+      type: "task-session-start",
+      requestId: "browser-reused-task-id",
+      targetParticipantId: "agent-a",
+      taskRequestId,
+      projectToken: "project-token-1",
+      summary: "Must not arm a second preparation",
+    })
+
+    expect(test.sessionControls("agent-a")).toHaveLength(0)
+    expect(
+      (humanSocket.attachment() as { pendingTaskSessionStart?: unknown })
+        .pendingTaskSessionStart
+    ).toBeUndefined()
+    expect(test.humanResults(humanSocket)).toEqual([
+      {
+        type: "task-session-start-result",
+        requestId: "browser-reused-task-id",
+        ok: false,
+        error: "task_request_id_in_use",
+      },
+    ])
+
+    // The rejected reuse left no pending slot behind; a fresh canonical id
+    // can be prepared immediately.
+    await test.sendHuman(humanSocket, {
+      type: "task-session-start",
+      requestId: "browser-fresh-task-id",
+      targetParticipantId: "agent-a",
+      projectToken: "project-token-1",
+      summary: "Fresh Task id",
+    })
+    expect(
+      test
+        .sessionControls("agent-a")
+        .filter((control) => control.operation === "prepare")
+    ).toHaveLength(1)
+    expect(agentSocket.attachment()).toBeDefined()
+  })
+
+  it("fails closed if another canonical request claims the id during preparation", async () => {
+    const test = harness()
+    const humanSocket = test.connectHuman("human-1")
+    const agentSocket = recordDelivery(test, "agent-a")
+    const taskRequestId = crypto.randomUUID()
+
+    await test.sendHuman(humanSocket, {
+      type: "task-session-start",
+      requestId: "browser-racing-start",
+      targetParticipantId: "agent-a",
+      taskRequestId,
+      projectToken: "project-token-1",
+      summary: "Session-prepared instruction",
+    })
+    const prepare = test
+      .sessionControls("agent-a")
+      .find((control) => control.operation === "prepare")!
+
+    // A collab-request wins the canonical ID while session preparation is in
+    // flight. The duplicate ingestion after PREPARED must not report success.
+    await test.sendHuman(humanSocket, {
+      type: "collab-request",
+      requestId: taskRequestId,
+      targetParticipantId: "agent-a",
+      summary: "Ordinary request claimed the id",
+    })
+    await test.sendAgent(agentSocket, {
+      type: "task-session-result",
+      operation: "prepare",
+      requestId: prepare!.requestId,
+      ok: true,
+    })
+
+    expect(test.stored().messages).toHaveLength(1)
+    expect(test.stored().messages[0].collab?.summary).toBe(
+      "Ordinary request claimed the id"
+    )
+    expect(test.humanResults(humanSocket)).toContainEqual({
+      type: "task-session-start-result",
+      requestId: "browser-racing-start",
+      ok: false,
+      error: "session_continuation_unavailable",
+    })
+    expect(
+      test
+        .humanResults(humanSocket)
+        .some(
+          (result) => result.requestId === "browser-racing-start" && result.ok
+        )
+    ).toBe(false)
+    expect(
+      test
+        .sessionControls("agent-a")
+        .some(
+          (control) =>
+            control.operation === "cancel" &&
+            control.taskRequestId === taskRequestId
+        )
+    ).toBe(true)
+  })
+
   it.each([
     ["New Session in a selected project", { projectToken: "project-token-1" }],
     ["Continue Session", { sessionToken: "session-token-1" }],
```

**File**: `app/src/do/taskSession.test.ts` (modified, +2/-0)
```diff
@@ -324,6 +324,7 @@ describe("validateTaskSessionListResult (#409)", () => {
     ).toEqual({ ok: false, error: "session_continuation_unavailable" })
     expect(isTaskSessionError("/private/tmp")).toBe(false)
     expect(isTaskSessionError("task_session_busy")).toBe(true)
+    expect(isTaskSessionError("task_request_id_in_use")).toBe(true)
   })
 })
 
@@ -338,6 +339,7 @@ describe("taskSessionErrorMessage (#409)", () => {
       "task_session_busy",
       "task_agent_not_reachable",
       "task_session_not_pending",
+      "task_request_id_in_use",
     ] as const) {
       const message = taskSessionErrorMessage(code)
       expect(message.length).toBeGreaterThan(0)
```

**File**: `app/src/do/taskSession.ts` (modified, +3/-0)
```diff
@@ -49,6 +49,7 @@ export const TASK_SESSION_ERRORS = [
   "task_session_busy",
   "task_agent_not_reachable",
   "task_session_not_pending",
+  "task_request_id_in_use",
 ] as const
 
 export type TaskSessionError = (typeof TASK_SESSION_ERRORS)[number]
@@ -79,6 +80,8 @@ export function taskSessionErrorMessage(error: TaskSessionError): string {
       return "That Agent is not reachable right now."
     case "task_session_not_pending":
       return "The session request expired. Refresh sessions and try again."
+    case "task_request_id_in_use":
+      return "That Task request is already in use. Start a new request."
     case "task_project_unavailable":
       return "That local project is no longer available. Refresh projects and try again."
     case "task_harness_control_unavailable":
```

**File**: `app/src/hooks/useSfuChatRoom.test.tsx` (modified, +165/-0)
```diff
@@ -1645,6 +1645,171 @@ describe("useSfuChatRoom Live Transcript RoomState wiring (#177 PR3)", () => {
     unmount()
   })
 
+  it("does not send a timed-out staged brief when a retry starts", async () => {
+    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
+    const originalFetch = fetchMock.getMockImplementation() as
+      | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
+      | undefined
+    const uploads: Array<(response: Response) => void> = []
+    fetchMock.mockImplementation((input, init) => {
+      const url = typeof input === "string" ? input : input.toString()
+      if (url.endsWith("/api/room/attachments"))
+        return new Promise<Response>((resolve) => uploads.push(resolve))
+      return originalFetch!(input, init)
+    })
+    const { result, unmount } = renderHook(() =>
+      useSfuChatRoom("project-brief-timeout-room", "Guest", "audio")
+    )
+    await waitFor(() => expect(RecordingWebSocket.instances).toHaveLength(1))
+    const socket = RecordingWebSocket.instances[0]
+    act(() => socket.onopen?.())
+    const brief = new File(["retry-safe brief"], "task-brief.md", {
+      type: "text/markdown",
+    })
+
+    vi.useFakeTimers()
+    try {
+      const timedOut = result.current.startTaskWithSession(
+        "agent-pi",
+        null,
+        "Retry-safe brief",
+        "project-token-1",
+        undefined,
+        {},
+        brief
+      )
+      expect(uploads).toHaveLength(1)
+      await act(async () => {
+        await vi.advanceTimersByTimeAsync(25_001)
+      })
+      await expect(timedOut).resolves.toEqual({
+        ok: false,
+        error: "session_continuation_unavailable",
+      })
+
+      const retry = result.current.startTaskWithSession(
+        "agent-pi",
+        null,
+        "Retry-safe brief",
+        "project-token-1",
+        undefined,
+        {},
+        brief
+      )
+      expect(uploads).toHaveLength(2)
+      await act(async () => {
+        uploads[1]!(
+          (await jsonResponse({
+            attachment: { id: "retry-attachment" },
+          })) as Response
+        )
+        await Promise.resolve()
+        await Promise.resolve()
+      })
+      const starts = () =>
+        socket.sent
+          .map((payload) => JSON.parse(payload))
+          .filter((frame) => frame.type === "task-session-start")
+      expect(starts()).toHaveLength(1)
+      expect(starts()[0].attachmentIds).toEqual(["retry-attachment"])
+
+      await act(async () => {
+        uploads[0]!(
+          (await jsonResponse({
+            attachment: { id: "late-first-attachment" },
+          })) as Response
+        )
+        await Promise.resolve()
+        await Promise.resolve()
+      })
+      expect(starts()).toHaveLength(1)
+      expect(starts()[0].attachmentIds).toEqual(["retry-attachment"])
+
+      act(() =>
+        socket.onmessage?.({
+          data: JSON.stringify({
+            type: "task-session-start-result",
+            requestId: starts()[0].requestId,
+            ok: true,
+          }),
+        })
+      )
+      await expect(retry).resolves.toEqual({ ok: true })
+    } finally {
+      vi.useRealTimers()
+      unmount()
+    }
+  })
+
+  it("does not send a brief when its socket closes during staging", async () => {
+    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
+    const originalFetch = fetchMock.getMockImplementation() as
+      | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
+      | undefined
+    let finishUpload: ((response: Response) => void) | undefined
+    fetchMock.mockImplementation((input, init) => {
+      const url = typeof input === "string" ? input : input.toString()
+      if (url.endsWith("/api/room/attachments"))
+        return new Promise<Response>((resolve) => {
+          finishUpload = resolve
+        })
+      return originalFetch!(input, init)
+    })
+    const { result, unmount } = renderHook(() =>
+      useSfuChatRoom("project-brief-cancel-room", "Guest", "audio")
+    )
+    await waitFor(() => expect(RecordingWebSocket.instances).toHaveLength(1))
+    const firstSocket = RecordingWebSocket.instances[0]
+    act(() => firstSocket.onopen?.())
+    const brief = new File(["cancel-safe brief"], "task-brief.md", {
+      type: "text/markdown",
+    })
+
+    vi.useFakeTimers()
+    try {
+      const pending = result.current.startTaskWithSession(
+        "agent-pi",
+        null,
+        "Cancel-safe brief",
+        "project-token-1",
+        undefined,
+        {},
+        brief
+      )
+      expect(finishUpload).toBeTypeOf("function")
+      act(() => firstSocket.onclose?.())
+      await expect(pending).resolves.toEqual({
+        ok: false,
+        error: "session_continuation_unavailable",
+      })
+      await act(async () => {
+        await vi.advanceTimersByTimeAsync(1000)
+      })
+      expect(RecordingWebSocket.instances).toHaveLength(2)
+      const reconnectedSo
```

---

### Incident Patch 5: `c9f09f8f` (2026-10-04)
**Commit Message**: fix(task): dedupe native mode and carry long briefs into sessions

**File**: `agent/internal/harness/acp.go` (modified, +29/-0)
```diff
@@ -583,6 +583,15 @@ func projectHarnessSessionControls(source *ACPSessionControls) *types.HarnessSes
 	}
 	projected.ConfigOptions = make([]types.HarnessSessionConfigOption, 0, len(source.ConfigOptions))
 	for _, option := range source.ConfigOptions {
+		// Some ACP providers expose the session mode through both `modes` /
+		// `session/set_mode` and a compatibility config option. Treat it as
+		// one control only when the option explicitly identifies itself as the
+		// mode selector and its current/available values exactly match the
+		// native modes. A merely similar label is not enough to collapse two
+		// provider controls.
+		if source.Modes != nil && isModeConfigOptionAlias(source.Modes, option) {
+			continue
+		}
 		projectedOption := types.HarnessSessionConfigOption{
 			ID: option.ID, Name: option.Name, Description: option.Description,
 			Category: option.Category, Type: option.Type, CurrentValue: option.CurrentValue,
@@ -598,6 +607,26 @@ func projectHarnessSessionControls(source *ACPSessionControls) *types.HarnessSes
 	return projected
 }
 
+func isModeConfigOptionAlias(modes *ACPModeState, option ACPConfigOption) bool {
+	if modes == nil || option.ID != "mode" || !strings.EqualFold(option.Category, "mode") ||
+		option.CurrentValue != modes.CurrentModeID || len(option.Options) != len(modes.AvailableModes) {
+		return false
+	}
+	modeIDs := make(map[string]struct{}, len(modes.AvailableModes))
+	for _, mode := range modes.AvailableModes {
+		if _, duplicate := modeIDs[mode.ID]; duplicate {
+			return false
+		}
+		modeIDs[mode.ID] = struct{}{}
+	}
+	for _, value := range option.Options {
+		if _, ok := modeIDs[value.Value]; !ok {
+			return false
+		}
+	}
+	return true
+}
+
 // PendingPermissionCount reports the number of permission requests currently
 // parked for the active turn. It is intentionally local diagnostic state and
 // never enters Room/status output.
```

**File**: `agent/internal/harness/acp_test.go` (modified, +41/-0)
```diff
@@ -580,6 +580,47 @@ func sessionControlsForTest(t *testing.T, controls *types.HarnessSessionControls
 	return converted
 }
 
+func TestACPProjectsAnAliasedNativeModeOnlyOnce(t *testing.T) {
+	controls := parseSessionControls(mustJSON(map[string]any{
+		"modes": map[string]any{
+			"currentModeId": "agent",
+			"availableModes": []any{
+				map[string]any{"id": "read-only", "name": "Ask for approval"},
+				map[string]any{"id": "agent", "name": "Approve for me"},
+				map[string]any{"id": "agent-full-access", "name": "Full access"},
+			},
+		},
+		"configOptions": []any{
+			map[string]any{
+				"id": "mode", "name": "Mode", "category": "mode", "type": "select",
+				"currentValue": "agent",
+				"options": []any{
+					map[string]any{"value": "read-only", "name": "Ask for approval"},
+					map[string]any{"value": "agent", "name": "Approve for me"},
+					map[string]any{"value": "agent-full-access", "name": "Full access"},
+				},
+			},
+			// A similar label alone does not prove semantic identity. Keep a
+			// genuinely separate provider config control for the UI to label.
+			map[string]any{
+				"id": "mode_detail", "name": "Mode", "category": "custom", "type": "select",
+				"currentValue": "safe",
+				"options":      []any{map[string]any{"value": "safe"}, map[string]any{"value": "fast"}},
+			},
+		},
+	}))
+	projected := projectHarnessSessionControls(controls)
+	if projected == nil || len(projected.Modes) != 3 {
+		t.Fatalf("native session modes must remain available: %+v", projected)
+	}
+	if projected.CurrentModeID != "agent" {
+		t.Fatalf("current native mode changed: %q", projected.CurrentModeID)
+	}
+	if len(projected.ConfigOptions) != 1 || projected.ConfigOptions[0].ID != "mode_detail" {
+		t.Fatalf("only the exact mode alias should be removed: %+v", projected.ConfigOptions)
+	}
+}
+
 func findCurrentConfigValue(t *testing.T, controls *ACPSessionControls, configID string) string {
 	t.Helper()
 	option, ok := findConfigOption(controls.ConfigOptions, configID)
```

**File**: `app/src/components/RoomContent.test.tsx` (modified, +203/-0)
```diff
@@ -44,6 +44,7 @@ import {
   ROOM_APP_INLINE_SHORTCUTS_DESKTOP,
   ROOM_APP_INLINE_SHORTCUTS_MOBILE,
 } from "../common/roomAppRecents"
+import { TASK_PASTE_ATTACHMENT_THRESHOLD } from "../common/taskPaste"
 import { RoomSession } from "../do/RoomSession"
 import type { RoomRecord, RoomState } from "../room/types"
 
@@ -434,6 +435,17 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
                   { value: "gpt-5.6-sol", name: "5.6 Sol" },
                 ],
               },
+              {
+                id: "review_mode",
+                name: "Mode",
+                category: "review",
+                type: "select",
+                currentValue: "safe",
+                options: [
+                  { value: "safe", name: "Safe review" },
+                  { value: "strict", name: "Strict review" },
+                ],
+              },
             ],
           },
         },
@@ -471,6 +483,197 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
         name: "Full access",
       })
     ).toHaveValue("agent-full-access")
+    const reviewMode = screen.getByLabelText(
+      "Harness-native Mode (review_mode)"
+    )
+    expect(
+      within(reviewMode).getByRole("option", { name: "Safe review" })
+    ).toHaveValue("safe")
+  })
+
+  it("starts a selected-project New Session with the full long brief as Task context", async () => {
+    const startTaskWithSession = vi.fn(async () => ({ ok: true as const }))
+    mockUseSfuChatRoom.mockReturnValue({
+      ...baseHookReturn,
+      connectionStatus: "connected",
+      startTaskWithSession,
+      participants: [
+        {
+          peerId: "human-local",
+          name: "tester",
+          kind: "human",
+          room: "test-room",
+          muteState: false,
+        },
+        {
+          peerId: "agent-codex",
+          name: "Codex",
+          kind: "agent",
+          room: "test-room",
+          muteState: false,
+          taskSessionContinuation: true,
+        },
+      ],
+      requestTaskSessions: vi.fn(async () => ({
+        ok: true as const,
+        page: {
+          sessions: [],
+          projects: [{ token: "project-token-1", label: "free4chat" }],
+          hasMore: false,
+          controls: { modes: [], configOptions: [] },
+        },
+      })),
+    })
+
+    render(
+      <RoomContent roomName="test-room" nickName="tester" roomType="audio" />
+    )
+    fireEvent.click(screen.getAllByLabelText("Start task with Codex")[0])
+    fireEvent.click(screen.getByTestId("task-project-discover"))
+    await screen.findByTestId("task-session-project-toggle")
+    fireEvent.click(screen.getByTestId("task-session-project-toggle"))
+    fireEvent.click(screen.getByTestId("task-session-project-option"))
+
+    const brief = `# Selected project handoff\n\n${"detailed requirement ".repeat(
+      TASK_PASTE_ATTACHMENT_THRESHOLD
+    )}`
+    fireEvent.paste(screen.getByLabelText("What should this Agent do?"), {
+      clipboardData: { getData: () => brief },
+    })
+    expect(screen.getByTestId("task-brief-chip")).toBeInTheDocument()
+    fireEvent.click(screen.getByRole("button", { name: "Start task" }))
+
+    await waitFor(() => expect(startTaskWithSession).toHaveBeenCalledTimes(1))
+    const [target, sessionToken, summary, projectToken, , , stagedBrief] =
+      startTaskWithSession.mock.calls[0] as unknown as [
+        string,
+        string | null,
+        string,
+        string,
+        unknown,
+        unknown,
+        File
+      ]
+    expect(target).toBe("agent-codex")
+    expect(sessionToken).toBeNull()
+    expect(summary).toBe("Selected project handoff")
+    expect(projectToken).toBe("project-token-1")
+    expect(stagedBrief.name).toBe("task-brief.md")
+    const briefContent = await new Promise<string>((resolve, reject) => {
+      const reader = new FileReader()
+      reader.onload = () => resolve(String(reader.result))
+      reader.onerror = () => reject(reader.error)
+      reader.readAsText(stagedBrief)
+    })
+    expect(briefContent).toBe(brief)
+    expect(screen.queryByText(/remove the task brief/i)).not.toBeInTheDocument()
+  })
+
+  it("keeps an ordinary short instruction on the selected-project start path", async () => {
+    const startTaskWithSession = vi.fn(async () => ({ ok: true as const }))
+    mockUseSfuChatRoom.mockReturnValue({
+      ...baseHookReturn,
+      connectionStatus: "connected",
+      startTaskWithSession,
+      participants: [
+        {
+          peerId: "human-local",
+          name: "tester",
+          kind: "human",
+          room: "test-room",
+          muteState: false,
+        },
+        {
+          peerId: "agent-codex",
+          name: "Codex",
+          kind: "agent",
+          room: "test-room",
+          muteState: false,
+          taskSessionContinuation: true,
+        },
+      ],
+      requestTaskSessions: vi.fn(async () => ({
+        ok: true as const,
+        page: {
+          se
```

**File**: `app/src/components/RoomContent.tsx` (modified, +28/-14)
```diff
@@ -83,6 +83,23 @@ import { useSfuChatRoom, type RoomMicState } from "../hooks/useSfuChatRoom"
 import { useTurnstile } from "../hooks/useTurnstile"
 import type { TaskExecutionProjection } from "../room/types"
 
+function taskSessionConfigLabel(
+  option: RelayHarnessSessionControls["configOptions"][number],
+  controls: RelayHarnessSessionControls
+): string {
+  const label = option.name || option.id
+  const collisionCount =
+    Number(
+      controls.modes.length > 0 && label.trim().toLocaleLowerCase() === "mode"
+    ) +
+    controls.configOptions.filter(
+      (candidate) =>
+        (candidate.name || candidate.id).trim().toLocaleLowerCase() ===
+        label.trim().toLocaleLowerCase()
+    ).length
+  return collisionCount > 1 ? `${label} (${option.id})` : label
+}
+
 const MAX_FILE_SIZE = 20 * 1024 * 1024
 
 type TaskAgent = { peerId: string; name: string }
@@ -1772,13 +1789,7 @@ export default function RoomContent({
           TASK_BRIEF_DEFAULT_LABEL
         : ""
       if (taskSessionMode === "new" || !taskAgentContinuation) {
-        if (taskBrief) {
-          if (taskSessionProjectToken) {
-            setTaskError(
-              "Remove the task brief before starting in a selected project."
-            )
-            return
-          }
+        if (taskBrief && !taskSessionProjectToken) {
           setTaskError("")
           setTaskStarting(true)
           const started = await startTaskWithBrief(
@@ -1805,10 +1816,11 @@ export default function RoomContent({
           const result = await startTaskWithSession(
             taskAgent.peerId,
             null,
-            taskInstruction,
+            taskBrief ? briefSummary : taskInstruction,
             taskSessionProjectToken,
             taskSessionModeId || undefined,
-            taskSessionConfigOptions
+            taskSessionConfigOptions,
+            taskBrief ?? undefined
           )
           setTaskStarting(false)
           if (result.ok === false) {
@@ -1842,7 +1854,8 @@ export default function RoomContent({
         taskBrief ? briefSummary : taskInstruction,
         undefined,
         taskSessionModeId || undefined,
-        taskSessionConfigOptions
+        taskSessionConfigOptions,
+        taskBrief ?? undefined
       )
       setTaskStarting(false)
       if (result.ok === false) {
@@ -3722,11 +3735,12 @@ export default function RoomContent({
                         key={option.id}
                         className="mb-2 block text-xs text-gray-300"
                       >
-                        {option.name || option.id}
+                        {taskSessionConfigLabel(option, taskSessionControls)}
                         <select
-                          aria-label={`Harness-native ${
-                            option.name || option.id
-                          }`}
+                          aria-label={`Harness-native ${taskSessionConfigLabel(
+                            option,
+                            taskSessionControls
+                          )}`}
                           value={taskSessionConfigOptions[option.id] ?? ""}
                           disabled={taskStarting}
                           onChange={(event) =>
```

**File**: `app/src/do/RoomSession.ts` (modified, +39/-5)
```diff
@@ -401,10 +401,11 @@ interface PendingTaskSessionDiscovery {
 
 interface PendingTaskSessionStart {
   requestId: string
-  /** Canonical collaboration requestId, generated before PREPARE was sent. */
+  /** Canonical collaboration requestId, fixed before PREPARE was sent. */
   taskRequestId: string
   targetAgentId: string
   summary: string
+  attachmentIds?: string[]
   expiresAt: number
 }
 
@@ -1005,6 +1006,8 @@ type ClientMessage =
       type: "task-session-start"
       requestId: string
       targetParticipantId: string
+      taskRequestId?: string
+      attachmentIds?: string[]
       sessionToken?: string
       projectToken?: string
       modeId?: string
@@ -3498,6 +3501,34 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       reject("invalid_session_control")
       return
     }
+    const taskRequestId = message.taskRequestId ?? crypto.randomUUID()
+    if (!isCanonicalCollabRequestId(taskRequestId)) {
+      reject("invalid_session_control")
+      return
+    }
+    const references = this.humanTaskContextReferenceIds(
+      room,
+      participant,
+      message.attachmentIds
+    )
+    if (references.ok === false) {
+      reject("invalid_session_control")
+      return
+    }
+    if (
+      (references.ids && message.taskRequestId === undefined) ||
+      (references.ids &&
+        references.ids.some(
+          (id) =>
+            room.attachments.find((attachment) => attachment.id === id)
+              ?.taskRequestId !== taskRequestId
+        ))
+    ) {
+      // The attachment is Task-owned context. It must already be staged by
+      // this Human against the exact canonical Task id before PREPARE begins.
+      reject("invalid_session_control")
+      return
+    }
     const modeId = message.modeId
     if (modeId !== undefined && !isValidHarnessControlText(modeId)) {
       reject("invalid_session_control")
@@ -3534,15 +3565,15 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
       reject("task_session_busy")
       return
     }
-    // The canonical Task identity is generated BEFORE the preparation, so the
-    // Runtime can pin the adoption to exactly this id. It is indistinguishable
-    // from any other Human-created Task from here on.
-    const taskRequestId = crypto.randomUUID()
+    // The canonical Task identity is fixed BEFORE preparation, either by the
+    // browser when it has staged Task-owned brief context or here otherwise.
+    // It is indistinguishable from any other Human-created Task from here on.
     attachment.pendingTaskSessionStart = {
       requestId,
       taskRequestId,
       targetAgentId: target.id,
       summary,
+      ...(references.ids ? { attachmentIds: references.ids } : {}),
       expiresAt: now + TASK_SESSION_PENDING_TTL_MS,
     }
     try {
@@ -3772,6 +3803,9 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
         requestId: record.taskRequestId,
         targetParticipantId: record.targetAgentId,
         summary: record.summary,
+        ...(record.attachmentIds
+          ? { attachmentIds: record.attachmentIds }
+          : {}),
       })
       appended = ingest.status !== "rejected"
       continuationCreatedTask = ingest.status === "recorded"
```

**File**: `app/src/do/roomSessionTaskSession.test.ts` (modified, +67/-0)
```diff
@@ -434,6 +434,73 @@ describe("RoomSession Task Session Continuation (#409)", () => {
     ])
   })
 
+  it.each([
+    ["New Session in a selected project", { projectToken: "project-token-1" }],
+    ["Continue Session", { sessionToken: "session-token-1" }],
+  ])(
+    "carries a staged long brief through %s without project file semantics",
+    async (_name, selection) => {
+      const test = harness()
+      const humanSocket = test.connectHuman("human-1")
+      const agentSocket = recordDelivery(test, "agent-a")
+      const taskRequestId = crypto.randomUUID()
+      const attachmentId = crypto.randomUUID()
+      test.store.set("room", {
+        ...test.stored(),
+        attachments: [
+          {
+            id: attachmentId,
+            senderId: "human-1",
+            senderName: "human-1",
+            senderKind: "human",
+            mimeType: "text/markdown",
+            fileName: "task-brief.md",
+            size: 3439,
+            chunkCount: 1,
+            createdAt: Date.now(),
+            sequence: 1,
+            taskRequestId,
+            taskWake: false,
+          },
+        ],
+      })
+
+      await test.sendHuman(humanSocket, {
+        type: "task-session-start",
+        requestId: `browser-${_name}`,
+        targetParticipantId: "agent-a",
+        taskRequestId,
+        attachmentIds: [attachmentId],
+        summary: "Detailed project handoff",
+        ...selection,
+      })
+
+      const prepare = test.sessionControls("agent-a")[0]
+      expect(prepare).toMatchObject({
+        type: "task-session-control",
+        operation: "prepare",
+        taskRequestId,
+        ...selection,
+      })
+      await test.sendAgent(agentSocket, {
+        type: "task-session-result",
+        operation: "prepare",
+        requestId: pendingControlRequestId(agentSocket),
+        ok: true,
+      })
+
+      expect(test.stored().messages[0].collab).toMatchObject({
+        requestId: taskRequestId,
+        summary: "Detailed project handoff",
+        attachmentIds: [attachmentId],
+      })
+      expect(test.stored().attachments[0].taskRequestId).toBe(taskRequestId)
+      expect(test.stored().messages[0].collab?.attachmentIds).toEqual([
+        attachmentId,
+      ])
+    }
+  )
+
   it("creates no canonical Task and no Harness turn when the preparation fails", async () => {
     const test = harness()
     const humanSocket = test.connectHuman("human-1")
```

**File**: `app/src/hooks/useSfuChatRoom.test.tsx` (modified, +76/-0)
```diff
@@ -1569,6 +1569,82 @@ describe("useSfuChatRoom Live Transcript RoomState wiring (#177 PR3)", () => {
     unmount()
   })
 
+  it("stages a long brief against the exact Task id before selected-project preparation", async () => {
+    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
+    const originalFetch = fetchMock.getMockImplementation() as
+      | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
+      | undefined
+    fetchMock.mockImplementation((input, init) => {
+      const url = typeof input === "string" ? input : input.toString()
+      if (url.endsWith("/api/room/attachments"))
+        return jsonResponse({ attachment: { id: "brief-attachment-1" } })
+      return originalFetch!(input, init)
+    })
+    const { result, unmount } = renderHook(() =>
+      useSfuChatRoom("project-brief-room", "Guest", "audio")
+    )
+    await waitFor(() => expect(RecordingWebSocket.instances).toHaveLength(1))
+    await waitFor(() =>
+      expect(result.current.getLocalRoomAuth()).toMatchObject({
+        participantId: "human-a",
+      })
+    )
+    const socket = RecordingWebSocket.instances[0]
+    act(() => socket.onopen?.())
+
+    const brief = new File(["full task-owned brief"], "task-brief.md", {
+      type: "text/markdown",
+    })
+    const pending = result.current.startTaskWithSession(
+      "agent-pi",
+      null,
+      "Implement this handoff",
+      "project-token-1",
+      undefined,
+      {},
+      brief
+    )
+    await waitFor(() =>
+      expect(
+        fetchMock.mock.calls.some(([input]) =>
+          String(input).endsWith("/api/room/attachments")
+        )
+      ).toBe(true)
+    )
+    await waitFor(() =>
+      expect(
+        socket.sent.some(
+          (payload) => JSON.parse(payload).type === "task-session-start"
+        )
+      ).toBe(true)
+    )
+    const upload = fetchMock.mock.calls.find(([input]) =>
+      String(input).endsWith("/api/room/attachments")
+    )
+    expect(upload?.[1]?.body).toBe(brief)
+    const headers = new Headers(upload?.[1]?.headers)
+    const frame = JSON.parse(socket.sent.at(-1) ?? "{}")
+    expect(frame).toMatchObject({
+      type: "task-session-start",
+      projectToken: "project-token-1",
+      taskRequestId: headers.get("X-Task-Request-Id"),
+      attachmentIds: ["brief-attachment-1"],
+    })
+    expect(headers.get("X-Task-Attachment-Pending")).toBe("1")
+
+    act(() =>
+      socket.onmessage?.({
+        data: JSON.stringify({
+          type: "task-session-start-result",
+          requestId: frame.requestId,
+          ok: true,
+        }),
+      })
+    )
+    await expect(pending).resolves.toEqual({ ok: true })
+    unmount()
+  })
+
   it("refuses a private session request without writing to a closed socket", async () => {
     const { result, unmount } = renderHook(() =>
       useSfuChatRoom("closed-room", "Guest", "audio")
```

**File**: `app/src/hooks/useSfuChatRoom.ts` (modified, +65/-16)
```diff
@@ -4841,7 +4841,8 @@ export function useSfuChatRoom(
       summary: string,
       projectToken?: string,
       modeId?: string,
-      configOptions?: Record<string, string>
+      configOptions?: Record<string, string>,
+      brief?: File
     ): Promise<TaskSessionStartResult> => {
       const target = targetParticipantId.trim()
       const instruction = summary.trim()
@@ -4860,6 +4861,39 @@ export function useSfuChatRoom(
           ok: false,
           error: "session_continuation_unavailable",
         })
+      if (brief && !isAgentTextFile(brief))
+        return Promise.resolve({ ok: false, error: "invalid_session_control" })
+      const taskRequestId = brief ? crypto.randomUUID() : undefined
+      const stageBrief = async (): Promise<string | null> => {
+        if (!brief || !taskRequestId) return null
+        const session = sessionRef.current
+        if (!session) return ""
+        try {
+          const response = await fetch("/api/room/attachments", {
+            method: "POST",
+            headers: {
+              "Content-Type": agentTextMime(brief) ?? "text/markdown",
+              "X-Room-Id": roomName,
+              "X-Room-Participant-Id": session.participantId,
+              "X-Room-Participant-Token": session.participantToken,
+              "X-File-Name": encodeURIComponent(brief.name.slice(0, 256)),
+              "X-Task-Request-Id": taskRequestId,
+              [TASK_ATTACHMENT_PENDING_HEADER]: "1",
+            },
+            body: brief,
+          })
+          if (!response.ok) return ""
+          const payload = (await response.json().catch(() => null)) as {
+            attachment?: { id?: unknown }
+          } | null
+          return typeof payload?.attachment?.id === "string" &&
+            payload.attachment.id
+            ? payload.attachment.id
+            : ""
+        } catch {
+          return ""
+        }
+      }
       const requestId = crypto.randomUUID()
       return new Promise<TaskSessionStartResult>((settle) => {
         const timeout = setTimeout(() => {
@@ -4873,23 +4907,38 @@ export function useSfuChatRoom(
           ) => void,
           timeout,
         })
-        const sent = sendSocketMessage({
-          type: "task-session-start",
-          requestId,
-          targetParticipantId: target,
-          ...(sessionToken ? { sessionToken } : {}),
-          ...(projectToken ? { projectToken } : {}),
-          ...(modeId ? { modeId } : {}),
-          ...(configOptions ? { configOptions } : {}),
-          summary: instruction.slice(0, MAX_COLLAB_SUMMARY_LENGTH),
-        })
-        if (sent) return
-        pendingTaskSessionRequestsRef.current.delete(requestId)
-        clearTimeout(timeout)
-        settle({ ok: false, error: "session_continuation_unavailable" })
+        const sendStart = (attachmentId: string | null) => {
+          if (brief && !attachmentId) {
+            pendingTaskSessionRequestsRef.current.delete(requestId)
+            clearTimeout(timeout)
+            settle({ ok: false, error: "session_continuation_unavailable" })
+            return
+          }
+          const sent = sendSocketMessage({
+            type: "task-session-start",
+            requestId,
+            targetParticipantId: target,
+            ...(taskRequestId ? { taskRequestId } : {}),
+            ...(attachmentId ? { attachmentIds: [attachmentId] } : {}),
+            ...(sessionToken ? { sessionToken } : {}),
+            ...(projectToken ? { projectToken } : {}),
+            ...(modeId ? { modeId } : {}),
+            ...(configOptions ? { configOptions } : {}),
+            summary: instruction.slice(0, MAX_COLLAB_SUMMARY_LENGTH),
+          })
+          if (sent) return
+          pendingTaskSessionRequestsRef.current.delete(requestId)
+          clearTimeout(timeout)
+          settle({ ok: false, error: "session_continuation_unavailable" })
+        }
+        if (!brief) {
+          sendStart(null)
+          return
+        }
+        void stageBrief().then(sendStart)
       })
     },
-    [sendSocketMessage]
+    [roomName, sendSocketMessage]
   )
 
   const readRoomAttachment = useCallback(
```

---

### Incident Patch 6: `6da4311e` (2026-10-04)
**Commit Message**: fix(room-apps): allow curated app downloads

**File**: `app/src/components/RoomAppHost.test.tsx` (modified, +12/-3)
```diff
@@ -243,7 +243,8 @@ describe("RoomAppHost", () => {
       />
     )
     const iframe = screen.getByTestId("room-app-iframe") as HTMLIFrameElement
-    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts")
+    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-downloads")
+    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin")
     expect(iframe.getAttribute("allow")).toBe("")
     expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer")
     expect(iframe.src).toContain(app.url)
@@ -317,7 +318,7 @@ describe("RoomAppHost", () => {
     )
 
     const iframe = screen.getByTestId("room-app-iframe")
-    expect(iframe).toHaveAttribute("sandbox", "allow-scripts")
+    expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-downloads")
     expect(iframe).toHaveAttribute("allow", "clipboard-write")
     expect(iframe.getAttribute("allow")).not.toContain("clipboard-read")
     expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin")
@@ -345,7 +346,15 @@ describe("RoomAppHost", () => {
       onClose: () => undefined,
     }
     const rendered = render(<RoomAppHost {...props} />)
-    expect(screen.getByTestId("room-app-iframe")).toHaveAttribute("allow", "")
+    const generatedIframe = screen.getByTestId("room-app-iframe")
+    expect(generatedIframe).toHaveAttribute("sandbox", "allow-scripts")
+    expect(generatedIframe.getAttribute("sandbox")).not.toContain(
+      "allow-downloads"
+    )
+    expect(generatedIframe.getAttribute("sandbox")).not.toContain(
+      "allow-same-origin"
+    )
+    expect(generatedIframe).toHaveAttribute("allow", "")
     rendered.unmount()
 
     const malformed = {
```

**File**: `app/src/components/RoomAppHost.tsx` (modified, +4/-1)
```diff
@@ -508,6 +508,7 @@ export default function RoomAppHost({
   // valid or allowlisted replaces the iframe with the unavailable state, so
   // that transition must retire the bridge the iframe owned.
   const appUsable = validateRoomAppDefinition(app) && isRoomAppAllowlisted(app)
+  const downloadsAllowed = appUsable && app.source !== "generated"
   const clipboardWriteAllowed =
     appUsable && app.source !== "generated" && app.clipboardWrite === true
 
@@ -725,7 +726,9 @@ export default function RoomAppHost({
           title={app.label}
           src={app.srcDoc ? undefined : app.url}
           srcDoc={app.srcDoc}
-          sandbox="allow-scripts"
+          sandbox={
+            downloadsAllowed ? "allow-scripts allow-downloads" : "allow-scripts"
+          }
           referrerPolicy="no-referrer"
           allow={clipboardWriteAllowed ? "clipboard-write" : ""}
           onLoad={sendBootstrap}
```

---

### Incident Patch 7: `7c46d714` (2026-10-03)
**Commit Message**: fix(agent): route curated Room App requests across replicas

**File**: `app/public/agent.md` (modified, +6/-4)
```diff
@@ -80,10 +80,12 @@ The twenty tools are:
   retain the normal validated addressing semantics. The Human Task composer
   omits explicit targets, so the Room derives its canonical Agent endpoint.
 - `room_app_request(participantHandle, appInstanceId, payload)` - send one
-  bounded opaque JSON request to the unique currently active curated App host
-  and return its correlated JSON result. The request expires after 15 seconds;
-  zero or multiple eligible hosts fail immediately. It is transient, has no
-  retry queue, and does not persist App data or wake an Agent.
+  bounded opaque JSON request to one logical curated App instance and return
+  its correlated JSON result. If multiple current Human browser replicas host
+  that same instance, Core deterministically selects one eligible endpoint for
+  the transient request. It expires after 15 seconds; no eligible endpoint
+  fails immediately. It has no retry queue and does not persist App data or
+  wake an Agent.
 - `update_capabilities(participantHandle, capabilities)` - replace the
   self-reported capability list.
 - `update_runtime_host(participantHandle, runtimeHost)` - publish the local
```

**File**: `app/public/llms-full.txt` (modified, +27/-22)
```diff
@@ -1347,26 +1347,28 @@ contain the App URL, private App state, or a participant bearer handle. It
 does not itself wake an Agent or start a Harness turn. An explicit Human
 request is enough for many collaboration Apps.
 
-For a resident Agent request, Core selects the connected Human browser host
-whose sandboxed curated App completed its existing handshake. The host rule is
-exact:
+For a resident Agent request, the curated `appInstanceId` is the logical App
+target. Multiple connected Human browser sockets that completed the sandboxed
+App's existing handshake are replicas of that same instance, not separate
+semantic targets. Core uses one eligible endpoint as transient transport:
 
 ```text
-exactly one eligible host
-→ route the Agent request
+one or more eligible replicas for this appInstanceId
+→ select one endpoint deterministically by participantId, then current connection nonce
+→ route the Agent request once
 
 zero eligible hosts
-→ unavailable
-
-multiple eligible hosts
-→ ambiguous_host; fail closed
+→ host_unavailable
 ```
 
-Core does not choose an arbitrary host. An App host is a resident Room-session
-host, not necessarily the currently visible Stage surface. Hiding the Stage or
-navigating to another surface does not by itself withdraw a mounted App host.
-Actual host removal, such as leaving the Room or unmounting Room content,
-changes eligibility.
+The Agent sees only the logical curated App identity, not browser host
+identities. Endpoint selection does not change the semantic target and is not
+leader election. An App host is a resident Room-session host, not necessarily
+the currently visible Stage surface. Hiding the Stage or navigating to another
+surface does not by itself withdraw a mounted App host. Actual host removal,
+such as leaving the Room or unmounting Room content, changes eligibility. If
+the selected endpoint disappears while the request is in flight, Core fails
+with `host_unavailable`; it does not replay the operation to another replica.
 
 The broker forwards an opaque bounded request and correlates its response to
 the request and current App instance. Current limits include a 16 KiB
@@ -2513,10 +2515,11 @@ initialState}`; the Room owns the sandbox, temporary bundle chunks,
   is the only publisher; the bundle is at most 48 KiB, and network origins are
   not supported in V0.
 - `room_app_request(participantHandle, appInstanceId, payload)` - send one
-  bounded opaque JSON request to the unique currently active curated Room App
-  host and return its correlated result. It expires after 15 seconds; zero or
-  multiple eligible hosts fail immediately. The request is transient, with no
-  retry queue or persistence.
+  bounded opaque JSON request to one logical curated App instance and return
+  its correlated result. If multiple current Human browser replicas host that
+  same instance, Core deterministically selects one eligible endpoint for the
+  transient request. It expires after 15 seconds; no eligible endpoint fails
+  immediately. There is no retry queue or persistence.
 - `leave_room(participantHandle)` - leave and invalidate the private handle.
 
 ## Minimal direct-MCP flow
@@ -2706,10 +2709,12 @@ The twenty tools are:
   retain the normal validated addressing semantics. The Human Task composer
   omits explicit targets, so the Room derives its canonical Agent endpoint.
 - `room_app_request(participantHandle, appInstanceId, payload)` - send one
-  bounded opaque JSON request to the unique currently active curated App host
-  and return its correlated JSON result. The request expires after 15 seconds;
-  zero or multiple eligible hosts fail immediately. It is transient, has no
-  retry queue, and does not persist App data or wake an Agent.
+  bounded opaque JSON request to one logical curated App instance and return
+  its correlated JSON result. If multiple current Human browser replicas host
+  that same instance, Core deterministically selects one eligible endpoint for
+  the transient request. It expires after 15 seconds; no eligible endpoint
+  fails immediately. It has no retry queue and does not persist App data or
+  wake an Agent.
 - `update_capabilities(participantHandle, capabilities)` - replace the
   self-reported capability list.
 - `update_runtime_host(participantHandle, runtimeHost)` - publish the local
```

**File**: `app/src/common/roomApp.test.ts` (modified, +10/-4)
```diff
@@ -948,7 +948,7 @@ describe("Room App host contract", () => {
     ])
   })
 
-  it("omits stale/closed instances and marks a multi-host instance non-callable", () => {
+  it("omits stale instances and projects multiple ready replicas as one callable logical App", () => {
     const app = {
       appInstanceId: roomAppInstanceId("room-a", "test-app"),
       appId: "test-app",
@@ -960,13 +960,19 @@ describe("Room App host contract", () => {
       appInstanceId: roomAppInstanceId("old-room", "test-app"),
     }
     expect(projectCallableRoomApps("room-a", [[], [stale]], true)).toEqual([])
-    expect(projectCallableRoomApps("room-a", [[app], [app]], true)).toEqual([
+    const projected = projectCallableRoomApps(
+      "room-a",
+      [[app, app], [app]],
+      true
+    )
+    expect(projected).toEqual([
       {
         ...app,
-        callable: false,
-        unavailableReason: "ambiguous_host",
+        callable: true,
       },
     ])
+    expect(projected[0]).not.toHaveProperty("participantId")
+    expect(projected[0]).not.toHaveProperty("connectionNonce")
     expect(
       projectCallableRoomApps(
         "room-a",
```

**File**: `app/src/common/roomApp.ts` (modified, +10/-20)
```diff
@@ -58,8 +58,7 @@ export interface RoomAppHostMetadata {
 export interface RoomAppAgentProjection
   extends Omit<RoomAppHostMetadata, "source"> {
   source: "curated"
-  callable: boolean
-  unavailableReason?: "ambiguous_host"
+  callable: true
 }
 
 /** Public, read-only Worker Service Binding used by the Room authority. */
@@ -804,10 +803,7 @@ export function projectCallableRoomApps(
       )
       .map((app) => [app.id, app])
   )
-  const hostsByInstance = new Map<
-    string,
-    { metadata: RoomAppHostMetadata; count: number }
-  >()
+  const metadataByInstance = new Map<string, RoomAppHostMetadata>()
   for (const hostApps of activeHosts) {
     const seenOnHost = new Set<string>()
     for (const app of hostApps) {
@@ -826,25 +822,19 @@ export function projectCallableRoomApps(
         title: definition.label,
         source: "curated",
       }
-      const existing = hostsByInstance.get(app.appInstanceId)
-      if (existing) existing.count += 1
-      else
-        hostsByInstance.set(app.appInstanceId, {
-          metadata: currentMetadata,
-          count: 1,
-        })
+      // The curated appInstanceId is the semantic target. Multiple Human
+      // sockets may host replicas of it, but the Agent sees one logical App.
+      if (!metadataByInstance.has(app.appInstanceId))
+        metadataByInstance.set(app.appInstanceId, currentMetadata)
     }
   }
 
-  return [...hostsByInstance.values()]
-    .sort((left, right) =>
-      left.metadata.appId.localeCompare(right.metadata.appId)
-    )
-    .map(({ metadata, count }) => ({
+  return [...metadataByInstance.values()]
+    .sort((left, right) => left.appId.localeCompare(right.appId))
+    .map((metadata) => ({
       ...metadata,
       source: "curated" as const,
-      callable: count === 1,
-      ...(count > 1 ? { unavailableReason: "ambiguous_host" as const } : {}),
+      callable: true,
     }))
 }
 
```

**File**: `app/src/do/RoomSession.ts` (modified, +13/-3)
```diff
@@ -9133,8 +9133,18 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
     }
     if (hosts.length === 0)
       return this.json({ ok: false, error: "host_unavailable" }, 409)
-    if (hosts.length !== 1)
-      return this.json({ ok: false, error: "ambiguous_host" }, 409)
+    // The App instance is the logical target; Human sockets are transport
+    // replicas. Pick one current endpoint deterministically and never replay
+    // this transient semantic request to another replica.
+    hosts.sort((left, right) => {
+      const leftParticipant = left.attachment.participantId
+      const rightParticipant = right.attachment.participantId
+      if (leftParticipant !== rightParticipant)
+        return leftParticipant < rightParticipant ? -1 : 1
+      const leftNonce = left.attachment.connectionNonce
+      const rightNonce = right.attachment.connectionNonce
+      return leftNonce === rightNonce ? 0 : leftNonce < rightNonce ? -1 : 1
+    })
     if (this.pendingRoomAppAgentRequests.size >= ROOM_APP_AGENT_MAX_IN_FLIGHT)
       return this.json({ ok: false, error: "too_many_requests" }, 429)
 
@@ -9703,7 +9713,7 @@ export class RoomSession extends DurableObject<RoomSessionEnv> {
     this.failRoomAppAgentRequestsForHost(
       participant.id,
       attachment.connectionNonce,
-      "host_disconnected"
+      "host_unavailable"
     )
     participant.connected = false
     participant.lastSeenAt = Date.now()
```

**File**: `app/src/do/roomSessionRoomAppUnicast.test.ts` (modified, +126/-7)
```diff
@@ -582,24 +582,143 @@ describe("RoomSession reliable participant unicast (#377)", () => {
     expect(outsideApp.status).toBe(404)
   })
 
-  it("fails explicitly when more than one eligible host is active", async () => {
+  it("routes to one deterministic replica and fences the response to that endpoint", async () => {
+    const {
+      session,
+      store,
+      addHumanSocket,
+      addAgentSocket,
+      setHostReady,
+      requestFromAgent,
+      sendHostResponse,
+    } = makeRoomSession()
+    // Deliberately register sockets in reverse selection order: routing must
+    // not depend on getWebSockets() iteration order.
+    const second = addHumanSocket("human-b")
+    const first = addHumanSocket("human-a")
+    addAgentSocket("agent-c")
+    await setHostReady(first)
+    await setHostReady(second)
+    const room = store.get("room") as ReturnType<typeof buildStoredRoom>
+    const roomApps = (
+      session as unknown as {
+        agentEvents: (
+          room: ReturnType<typeof buildStoredRoom>,
+          participantId: string,
+          cursor: number
+        ) => { roomApps: unknown[] }
+      }
+    ).agentEvents(room, "agent-c", 0).roomApps
+    expect(roomApps).toEqual([
+      {
+        appInstanceId: APP_INSTANCE_ID,
+        appId: "test-app-1",
+        title: "Test App 1",
+        source: "curated",
+        callable: true,
+      },
+    ])
+    const pending = requestFromAgent()
+    await vi.waitFor(() => expect(first.messages()).toHaveLength(1))
+    const request = first.messages()[0]!
+    expect(request).toMatchObject({
+      type: "room-app-agent-request",
+      appInstanceId: APP_INSTANCE_ID,
+    })
+    expect(second.messages()).toEqual([])
+
+    // A different eligible replica cannot satisfy a request targeted to A.
+    await sendHostResponse(second, {
+      type: "room-app-agent-response",
+      requestId: request.requestId,
+      appInstanceId: APP_INSTANCE_ID,
+      ok: true,
+      result: { replica: "non-selected" },
+    })
+    await sendHostResponse(first, {
+      type: "room-app-agent-response",
+      requestId: request.requestId,
+      appInstanceId: APP_INSTANCE_ID,
+      ok: true,
+      result: { replica: "selected" },
+    })
+    expect(await (await pending).json()).toEqual({
+      ok: true,
+      result: { replica: "selected" },
+    })
+  })
+
+  it("does not replay when the selected replica becomes unavailable", async () => {
     const { addHumanSocket, addAgentSocket, setHostReady, requestFromAgent } =
       makeRoomSession()
-    const first = addHumanSocket("human-a")
     const second = addHumanSocket("human-b")
+    const first = addHumanSocket("human-a")
     addAgentSocket("agent-c")
     await setHostReady(first)
     await setHostReady(second)
-    const response = await requestFromAgent()
-    expect(response.status).toBe(409)
+
+    const pending = requestFromAgent()
+    await vi.waitFor(() => expect(first.messages()).toHaveLength(1))
+    await setHostReady(first, APP_INSTANCE_ID, false)
+
+    const response = await pending
+    expect(response.status).toBe(502)
     expect(await response.json()).toMatchObject({
       ok: false,
-      error: "ambiguous_host",
+      error: "host_unavailable",
     })
-    expect(first.messages()).toEqual([])
     expect(second.messages()).toEqual([])
   })
 
+  it("routes different curated App instances independently", async () => {
+    const {
+      addHumanSocket,
+      addAgentSocket,
+      setHostReady,
+      requestFromAgent,
+      sendHostResponse,
+    } = makeRoomSession()
+    const appOneHost = addHumanSocket("human-a")
+    const appTwoHost = addHumanSocket("human-b")
+    addAgentSocket("agent-c")
+    await setHostReady(appOneHost, APP_INSTANCE_ID)
+    await setHostReady(appTwoHost, SECOND_TEST_APP_INSTANCE_ID)
+
+    const appOnePending = requestFromAgent(APP_INSTANCE_ID)
+    const appTwoPending = requestFromAgent(SECOND_TEST_APP_INSTANCE_ID)
+    await vi.waitFor(() => {
+      expect(appOneHost.messages()).toHaveLength(1)
+      expect(appTwoHost.messages()).toHaveLength(1)
+    })
+    const appOneRequest = appOneHost.messages()[0]!
+    const appTwoRequest = appTwoHost.messages()[0]!
+    expect(appOneRequest.appInstanceId).toBe(APP_INSTANCE_ID)
+    expect(appTwoRequest.appInstanceId).toBe(SECOND_TEST_APP_INSTANCE_ID)
+
+    await sendHostResponse(appTwoHost, {
+      type: "room-app-agent-response",
+      requestId: appTwoRequest.requestId,
+      appInstanceId: SECOND_TEST_APP_INSTANCE_ID,
+      ok: true,
+      result: { app: "two" },
+    })
+    await sendHostResponse(appOneHost, {
+      type: "room-app-agent-response",
+      requestId: appOneRequest.requestId,
+      appInstanceId: APP_INSTANCE_ID,
+      ok: true,
+      result: { app: "one" },
+    })
+    expect(await (await appOnePending).json()).toEqual({
+      ok: true,
+      result: { app: "one" },
+    })
+    expect(await (await appTwoPending).json()).toEqual({
+      ok: true,
```

**File**: `app/src/mcp/server.ts` (modified, +1/-1)
```diff
@@ -1074,7 +1074,7 @@ function createMcpServer(context: McpRequestContext) {
     "room_app_request",
     {
       description:
-        "Send one bounded opaque JSON request to the unique currently active curated Room App host and return its correlated result. Fails immediately when there is no unique host; expires after 15 seconds; never queues or persists the request.",
+        "Send one bounded opaque JSON request to a logical curated Room App instance and return its correlated result. If multiple current Human browser replicas host the same instance, Core deterministically selects one eligible endpoint for the transient request. Fails immediately when no eligible endpoint exists; expires after 15 seconds; never retries, queues, or persists the request.",
       inputSchema: {
         participantHandle: z.string().min(1),
         appInstanceId: z.string().regex(/^[a-z0-9][a-z0-9:-]{0,95}$/),
```

**File**: `docs/en/concepts/agent-room-app-participation.md` (modified, +16/-14)
```diff
@@ -73,26 +73,28 @@ contain the App URL, private App state, or a participant bearer handle. It
 does not itself wake an Agent or start a Harness turn. An explicit Human
 request is enough for many collaboration Apps.
 
-For a resident Agent request, Core selects the connected Human browser host
-whose sandboxed curated App completed its existing handshake. The host rule is
-exact:
+For a resident Agent request, the curated `appInstanceId` is the logical App
+target. Multiple connected Human browser sockets that completed the sandboxed
+App's existing handshake are replicas of that same instance, not separate
+semantic targets. Core uses one eligible endpoint as transient transport:
 
 ```text
-exactly one eligible host
-→ route the Agent request
+one or more eligible replicas for this appInstanceId
+→ select one endpoint deterministically by participantId, then current connection nonce
+→ route the Agent request once
 
 zero eligible hosts
-→ unavailable
-
-multiple eligible hosts
-→ ambiguous_host; fail closed
+→ host_unavailable
 ```
 
-Core does not choose an arbitrary host. An App host is a resident Room-session
-host, not necessarily the currently visible Stage surface. Hiding the Stage or
-navigating to another surface does not by itself withdraw a mounted App host.
-Actual host removal, such as leaving the Room or unmounting Room content,
-changes eligibility.
+The Agent sees only the logical curated App identity, not browser host
+identities. Endpoint selection does not change the semantic target and is not
+leader election. An App host is a resident Room-session host, not necessarily
+the currently visible Stage surface. Hiding the Stage or navigating to another
+surface does not by itself withdraw a mounted App host. Actual host removal,
+such as leaving the Room or unmounting Room content, changes eligibility. If
+the selected endpoint disappears while the request is in flight, Core fails
+with `host_unavailable`; it does not replay the operation to another replica.
 
 The broker forwards an opaque bounded request and correlates its response to
 the request and current App instance. Current limits include a 16 KiB
```

---

### Incident Patch 8: `d5766279` (2026-10-03)
**Commit Message**: test(agent): stabilize logical task-scope capacity regression

**File**: `agent/internal/runtime/scoped_sessions_test.go` (modified, +34/-0)
```diff
@@ -36,6 +36,27 @@ func scopedEvent(sequence int64, scope, text string) types.RoomEvent {
 	return event
 }
 
+func waitForScopedRuns(t *testing.T, started <-chan string, expected []string) {
+	t.Helper()
+	want := make(map[string]struct{}, len(expected))
+	for _, scope := range expected {
+		want[scope] = struct{}{}
+	}
+	timer := time.NewTimer(5 * time.Second)
+	defer timer.Stop()
+	for range expected {
+		select {
+		case scope := <-started:
+			if _, ok := want[scope]; !ok {
+				t.Fatalf("unexpected or duplicate scoped Harness run before settlement barrier: %s", scope)
+			}
+			delete(want, scope)
+		case <-timer.C:
+			t.Fatalf("timed out waiting for admitted scoped Harness runs: remaining=%v", want)
+		}
+	}
+}
+
 type legacyOnlyAdapter struct {
 	ensureCalls     int
 	generationCalls int
@@ -598,6 +619,8 @@ func TestSerializedRoomWireScopeIDRoutesToRetainedTaskSessions(t *testing.T) {
 
 func TestLogicalTaskScopeCapacityFailsClosedWithoutRoomFallback(t *testing.T) {
 	adapter := &fakeAdapter{name: "pi"}
+	started := make(chan string, types.MaxLogicalTaskScopes+1)
+	adapter.scopedRunHook = func(scope string) { started <- scope }
 	rt := newScopedRuntimeFixture(t, adapter)
 	defer rt.Stop()
 
@@ -606,6 +629,17 @@ func TestLogicalTaskScopeCapacityFailsClosedWithoutRoomFallback(t *testing.T) {
 		rt.acceptEvent(scopedEvent(int64(index+1), scope, "scope-"+itoa(int64(index+1))))
 	}
 	rt.drainTurns()
+	// drainTurns can observe the brief gap after a lane releases and before its
+	// completion callback refills the next lane. Wait until every admitted scope
+	// has started, then drain the remaining active lanes before taking a stable
+	// Harness snapshot. Independent scopes still run concurrently up to the
+	// Runtime's normal lane limit.
+	expectedScopes := make([]string, 0, types.MaxLogicalTaskScopes)
+	for index := 0; index < types.MaxLogicalTaskScopes; index++ {
+		expectedScopes = append(expectedScopes, "task:"+itoa(int64(index+1)))
+	}
+	waitForScopedRuns(t, started, expectedScopes)
+	rt.drainTurns()
 	rt.mu.Lock()
 	if len(rt.scopedSessions) != types.MaxLogicalTaskScopes || len(rt.scopeOrder) != types.MaxLogicalTaskScopes {
 		rt.mu.Unlock()
```

---

### Incident Patch 9: `ef56d471` (2026-10-02)
**Commit Message**: fix(generated-app): address participant data transport review (#546)

* fix(generated-app): use participant capability data channels

* fix(generated-app): address participant transport review

* fix: format resident transport envelope

* fix: rebuild participant transport after reconnect

* Fix local Human identity in generated task routing

* fix: isolate generated app capability transport

* fix: harden participant transport lifecycle

* fix: bound capability result envelopes

* fix: keep transport projection off public waits

* fix: keep capability wait beyond runtime deadline

* fix(runtime): send generated app capability results as text frames

* fix(room): close app routes on capability removal

* fix(room): honor Room Apps switch for capability routes

* fix(room): broadcast resident transport invalidation

* test(room): use valid runtime host fixture

---------

Co-authored-by: Codex <[REDACTED_EMAIL]>

**File**: `agent/internal/daemon/daemon_test.go` (modified, +2/-27)
```diff
@@ -1184,7 +1184,6 @@ func TestDaemonAdapterReplacementRefreshesExistingResidentAndRemovalClearsProjec
 
 	connections := make(chan *websocket.Conn, 1)
 	projections := make(chan map[string]any, 4)
-	capabilityResults := make(chan map[string]any, 2)
 	var mu sync.Mutex
 	initialProjection := map[string]any(nil)
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
@@ -1203,14 +1202,10 @@ func TestDaemonAdapterReplacementRefreshesExistingResidentAndRemovalClearsProjec
 			}
 			connections <- conn
 			for {
-				_, payload, readErr := conn.Read(context.Background())
+				_, _, readErr := conn.Read(context.Background())
 				if readErr != nil {
 					return
 				}
-				var message map[string]any
-				if json.Unmarshal(payload, &message) == nil && message["type"] == "runtime-capability-result" {
-					capabilityResults <- message
-				}
 			}
 		}
 		var body struct {
@@ -1271,9 +1266,8 @@ func TestDaemonAdapterReplacementRefreshesExistingResidentAndRemovalClearsProjec
 	if err := json.Unmarshal(joined, &view); err != nil || view.InstanceID == "" {
 		t.Fatalf("resident join response was invalid: %s (%v)", joined, err)
 	}
-	var residentSocket *websocket.Conn
 	select {
-	case residentSocket = <-connections:
+	case <-connections:
 	case <-time.After(5 * time.Second):
 		t.Fatal("already-running resident did not open its event socket")
 	}
@@ -1337,25 +1331,6 @@ func TestDaemonAdapterReplacementRefreshesExistingResidentAndRemovalClearsProjec
 		t.Fatalf("Human semantic invoke did not reach replacement Python Adapter: %s (%v)", invoked, err)
 	}
 
-	request, _ := json.Marshal(map[string]any{
-		"type": "runtime-capability-request", "requestId": "daemon-e2e-request",
-		"runtimeHostId": runtimeHostID, "capabilityId": capabilityID, "operation": "observe",
-	})
-	if err := residentSocket.Write(context.Background(), websocket.MessageText, request); err != nil {
-		t.Fatalf("send private resident capability request: %v", err)
-	}
-	select {
-	case response := <-capabilityResults:
-		if response["requestId"] != "daemon-e2e-request" || response["ok"] != true {
-			t.Fatalf("resident request failed: %#v", response)
-		}
-		result, _ := response["result"].(map[string]any)
-		if result["source"] != "current-controller" {
-			t.Fatalf("resident did not reach the current daemon-owned controller: %#v", response)
-		}
-	case <-time.After(5 * time.Second):
-		t.Fatal("resident did not answer the capability request")
-	}
 	listed, err := SendIPC(&IpcRequest{Op: "capability-list"})
 	if err != nil || !strings.Contains(string(listed), capabilityID) || strings.Contains(string(listed), "controller") {
 		t.Fatalf("daemon discovery did not return the sanitized current descriptor: %s (%v)", listed, err)
```

**File**: `agent/internal/free4chat/resident_events.go` (modified, +16/-73)
```diff
@@ -55,10 +55,7 @@ const (
 	// It carries no payload, no request id, and no tokens: it can never
 	// correlate with, overwrite, or be answered into the Task Session
 	// Continuation request/response family.
-	residentTaskExecutionResyncType  = "task-execution-resync"
-	residentCapabilityRequestType    = "runtime-capability-request"
-	residentCapabilityResultType     = "runtime-capability-result"
-	maxResidentCapabilityResultBytes = 16 * 1024
+	residentTaskExecutionResyncType = "task-execution-resync"
 )
 
 var (
@@ -86,16 +83,17 @@ type residentEventStream struct {
 // "task-control" envelope type; an ordinary "events" envelope never carries
 // them.
 type residentEventEnvelope struct {
-	Type         string                     `json:"type"`
-	Events       []types.RoomEvent          `json:"events"`
-	Cursor       int64                      `json:"cursor"`
-	ExpiresAt    int64                      `json:"expiresAt"`
-	Participants []json.RawMessage          `json:"participants"`
-	RuntimeHosts map[string]json.RawMessage `json:"runtimeHosts"`
-	RoomApps     []json.RawMessage          `json:"roomApps"`
-	MediaState   *types.ResidentMediaState  `json:"mediaState,omitempty"`
-	Expired      bool                       `json:"expired,omitempty"`
-	Truncated    bool                       `json:"truncated,omitempty"`
+	Type                        string                                      `json:"type"`
+	Events                      []types.RoomEvent                           `json:"events"`
+	Cursor                      int64                                       `json:"cursor"`
+	ExpiresAt                   int64                                       `json:"expiresAt"`
+	Participants                []json.RawMessage                           `json:"participants"`
+	RuntimeHosts                map[string]json.RawMessage                  `json:"runtimeHosts"`
+	RoomApps                    []json.RawMessage                           `json:"roomApps"`
+	RuntimeParticipantTransport types.RuntimeParticipantTransportProjection `json:"participantTransport"`
+	MediaState                  *types.ResidentMediaState                   `json:"mediaState,omitempty"`
+	Expired                     bool                                        `json:"expired,omitempty"`
+	Truncated                   bool                                        `json:"truncated,omitempty"`
 	// Private resident-only Task control (#409, #484).
 	Control       string `json:"control,omitempty"`
 	TaskRequestID string `json:"taskRequestId,omitempty"`
@@ -114,10 +112,6 @@ type residentEventEnvelope struct {
 	HumanParticipantID string            `json:"humanParticipantId,omitempty"`
 	ModeID             string            `json:"modeId,omitempty"`
 	ConfigOptions      map[string]string `json:"configOptions,omitempty"`
-	RuntimeHostID      string            `json:"runtimeHostId,omitempty"`
-	CapabilityID       string            `json:"capabilityId,omitempty"`
-	Action             string            `json:"action,omitempty"`
-	Args               map[string]any    `json:"args,omitempty"`
 }
 
 // OpenResidentEventStream opens the Runtime-owned hibernatable Room event
@@ -228,20 +222,6 @@ func (s *residentEventStream) Receive(ctx context.Context) (types.WaitResult, er
 		}
 		return types.WaitResult{SessionControl: control}, nil
 	}
-	if envelope.Type == residentCapabilityRequestType {
-		request := types.ResidentCapabilityRequest{
-			RequestID:     envelope.RequestID,
-			RuntimeHostID: envelope.RuntimeHostID,
-			CapabilityID:  envelope.CapabilityID,
-			Operation:     types.ResidentCapabilityOperation(envelope.Operation),
-			Action:        envelope.Action,
-			Args:          envelope.Args,
-		}
-		if !request.Valid() {
-			return types.WaitResult{}, &Error{Message: "resident event stream returned an invalid capability request", Code: CodeToolError}
-		}
-		return types.WaitResult{CapabilityRequest: &request}, nil
-	}
 	if envelope.Type == residentTaskControlType {
 		// PRIVATE RESIDENT TRANSPORT ONLY: a transient control frame, not a
 		// Room event. It carries no cursor and must never be projected as
@@ -267,6 +247,10 @@ func (s *residentEventStream) Receive(ctx context.Context) (types.WaitResult, er
 		MediaState: envelope.MediaState,
 		RoomApps:   parseResidentRoomApps(envelope.RoomApps),
 	}
+	if !envelope.RuntimeParticipantTransport.Valid() {
+		return types.WaitResult{}, &Error{Message: "resident participant transport projection is invalid", Code: CodeToolError}
+	}
+	wait.RuntimeParticipantTransport = envelope.RuntimeParticipantTransport
 	if envelope.Participants != nil {
 		raw := make([]any, 0, len(envelope.Participants))
 		for _, item := range envelope.Participants {
@@ -548,47 +532,6 @@ func (s *residentEventStream) SendSessionResult(ctx context.Context, result type
 	return nil
 }
 
-// SendCapabilityResult answers one private capability request on the same
-// resident WebSocket. Only bounded semantic result data and closed errors can
-/
```

**File**: `agent/internal/free4chat/resident_events_test.go` (modified, +27/-35)
```diff
@@ -122,6 +122,33 @@ func TestResidentEventStreamUsesHeadersAndDecodesEnvelope(t *testing.T) {
 	}
 }
 
+func TestResidentEventStreamRejectsCapabilityOperationFrames(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		conn, err := websocket.Accept(w, r, nil)
+		if err != nil {
+			t.Errorf("accept resident stream: %v", err)
+			return
+		}
+		payload := []byte(`{"type":"runtime-capability-request","requestId":"request-a","capabilityId":"printer_status","operation":"observe"}`)
+		_ = conn.Write(context.Background(), websocket.MessageText, payload)
+	}))
+	t.Cleanup(server.Close)
+
+	client := New(server.URL + "/mcp")
+	stream, err := client.OpenResidentEventStream(
+		context.Background(), residentHandle("room-1", "agent-1", "private-token"), 0,
+	)
+	if err != nil {
+		t.Fatalf("open resident stream: %v", err)
+	}
+	defer stream.Close()
+	if _, err := stream.Receive(context.Background()); err == nil {
+		t.Fatal("resident event transport accepted a per-operation capability frame")
+	} else if protocolErr, ok := err.(*Error); !ok || protocolErr.Code != CodeToolError {
+		t.Fatalf("unexpected rejection for obsolete capability frame: %v", err)
+	}
+}
+
 func TestParseResidentRoomAppsFailsClosed(t *testing.T) {
 	entries := []json.RawMessage{
 		json.RawMessage(`{"appInstanceId":"test-app:0123abcd","appId":"test-app","title":"Test App","source":"curated","callable":false,"unavailableReason":"ambiguous_host"}`),
@@ -649,41 +676,6 @@ func TestResidentEventStreamDecodesPrivateSessionControl(t *testing.T) {
 	}
 }
 
-func TestResidentEventStreamDecodesPrivateCapabilityRequest(t *testing.T) {
-	wait, err := receiveResidentFrame(t, map[string]any{
-		"type":          "runtime-capability-request",
-		"requestId":     "human-request-1",
-		"runtimeHostId": "host-route-1",
-		"capabilityId":  "fixture",
-		"operation":     "invoke",
-		"action":        "set-state",
-		"args":          map[string]any{"value": "on"},
-	})
-	if err != nil {
-		t.Fatal(err)
-	}
-	if wait.CapabilityRequest == nil || !wait.CapabilityRequest.Valid() {
-		t.Fatalf("private capability request not decoded: %+v", wait)
-	}
-	if wait.CapabilityRequest.RequestID != "human-request-1" || wait.CapabilityRequest.Operation != types.ResidentCapabilityInvoke || wait.CapabilityRequest.Args["value"] != "on" {
-		t.Fatalf("request correlation or args changed: %+v", wait.CapabilityRequest)
-	}
-	if len(wait.Events) != 0 || wait.Cursor != 0 {
-		t.Fatalf("capability request leaked into room event state: %+v", wait)
-	}
-	if _, err := receiveResidentFrame(t, map[string]any{
-		"type":          "runtime-capability-request",
-		"requestId":     "bad",
-		"runtimeHostId": "host-route-1",
-		"capabilityId":  "fixture",
-		"operation":     "invoke",
-		"action":        "set-state",
-		"args":          map[string]any{"value": strings.Repeat("x", 9000)},
-	}); err == nil {
-		t.Fatal("oversized args must be rejected")
-	}
-}
-
 // TestResidentEventStreamRejectsMalformedSessionControl proves a malformed
 // session control fails closed: it is neither degraded into an ordinary Room
 // event nor partially applied.
```

**File**: `agent/internal/media/engine.go` (modified, +73/-0)
```diff
@@ -10,6 +10,7 @@ package media
 import (
 	"context"
 	"encoding/binary"
+	"errors"
 	"fmt"
 	"sync"
 	"time"
@@ -78,6 +79,9 @@ type EngineEvents struct {
 	OnTrack func(TrackEvent)
 	// OnAudioFrame delivers one decoded RTP payload for an audio MID.
 	OnAudioFrame func(AudioFrameEvent)
+	// OnDataChannelMessage exposes bounded participant DataChannel payloads to
+	// generic Runtime transport owners. It carries no media or Harness semantics.
+	OnDataChannelMessage func(label string, payload []byte)
 }
 
 // Engine is the in-process Pion PeerConnection (no JSONL boundary). It is a
@@ -230,9 +234,78 @@ func (e *Engine) Create() error {
 	pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
 		e.handleIncomingTrack(track, receiver)
 	})
+	pc.OnDataChannel(func(channel *webrtc.DataChannel) {
+		channel.OnMessage(func(message webrtc.DataChannelMessage) {
+			if e.ev.OnDataChannelMessage != nil {
+				e.ev.OnDataChannelMessage(channel.Label(), append([]byte(nil), message.Data...))
+			}
+		})
+	})
 	return nil
 }
 
+// ParticipantDataChannel is the minimal reliable DataChannel surface used by
+// bounded participant-local Runtime transports.
+type ParticipantDataChannel struct {
+	channel *webrtc.DataChannel
+}
+
+func (c *ParticipantDataChannel) Label() string {
+	if c == nil || c.channel == nil {
+		return ""
+	}
+	return c.channel.Label()
+}
+
+func (c *ParticipantDataChannel) Send(payload []byte) error {
+	if c == nil || c.channel == nil || c.channel.ReadyState() != webrtc.DataChannelStateOpen {
+		return errors.New("datachannel_unavailable")
+	}
+	return c.channel.Send(payload)
+}
+
+// SendText sends a JSON Room App envelope as a WebRTC text frame so browser
+// RTCDataChannel consumers receive event.data as a string.
+func (c *ParticipantDataChannel) SendText(payload string) error {
+	if c == nil || c.channel == nil || c.channel.ReadyState() != webrtc.DataChannelStateOpen {
+		return errors.New("datachannel_unavailable")
+	}
+	return c.channel.SendText(payload)
+}
+
+func (c *ParticipantDataChannel) Ready() bool {
+	return c != nil && c.channel != nil && c.channel.ReadyState() == webrtc.DataChannelStateOpen
+}
+
+func (c *ParticipantDataChannel) OnOpen(handler func()) {
+	if c != nil && c.channel != nil && handler != nil {
+		c.channel.OnOpen(handler)
+	}
+}
+
+// CreateParticipantDataChannel registers one already-authorized reliable
+// Cloudflare DataChannel with Pion using its negotiated channel id.
+func (e *Engine) CreateParticipantDataChannel(label string, id uint16) (*ParticipantDataChannel, error) {
+	if e == nil || e.pc == nil || label == "" {
+		return nil, errors.New("invalid_datachannel")
+	}
+	ordered := true
+	channel, err := e.pc.CreateDataChannel(label, &webrtc.DataChannelInit{
+		Negotiated: &ordered,
+		ID:         &id,
+		Ordered:    &ordered,
+	})
+	if err != nil {
+		return nil, err
+	}
+	channel.OnMessage(func(message webrtc.DataChannelMessage) {
+		if e.ev.OnDataChannelMessage != nil {
+			e.ev.OnDataChannelMessage(channel.Label(), append([]byte(nil), message.Data...))
+		}
+	})
+	return &ParticipantDataChannel{channel: channel}, nil
+}
+
 // CreateServerEventsChannel creates the server-events DataChannel BEFORE any
 // offer exists (frozen invariant).
 func (e *Engine) CreateServerEventsChannel() error {
```

**File**: `agent/internal/media/participant_transport.go` (added, +537/-0)
```diff
@@ -0,0 +1,537 @@
+package media
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"strconv"
+	"strings"
+	"sync"
+	"time"
+
+	"github.com/i365dev/free4chat/agent/internal/types"
+)
+
+const (
+	capabilityRequestFrame = "runtime-capability-request"
+	capabilityResultFrame  = "runtime-capability-result"
+	capabilityRequestLimit = 4
+	capabilityPayloadLimit = 16 * 1024
+	capabilitySeenLimit    = 64
+)
+
+func participantDirectReliableChannelName(agentParticipantID, humanParticipantID string) string {
+	if !participantIDForDirectChannel(agentParticipantID) || !participantIDForDirectChannel(humanParticipantID) || agentParticipantID == humanParticipantID {
+		return ""
+	}
+	return "participant-direct-reliable-" + strconv.Itoa(len(agentParticipantID)) + "-" + agentParticipantID + "-" + humanParticipantID
+}
+
+func participantIDForDirectChannel(value string) bool {
+	if len(value) == 0 || len(value) > 128 {
+		return false
+	}
+	for _, char := range value {
+		if (char < 'A' || char > 'Z') && (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '_' && char != '-' {
+			return false
+		}
+	}
+	return true
+}
+
+type capabilityFrame struct {
+	Type           string                            `json:"type"`
+	RequestID      string                            `json:"requestId"`
+	AppInstanceID  string                            `json:"appInstanceId"`
+	BundleRevision int64                             `json:"bundleRevision"`
+	TaskRequestID  string                            `json:"taskRequestId"`
+	AgentID        string                            `json:"agentParticipantId"`
+	RuntimeHostID  string                            `json:"runtimeHostId,omitempty"`
+	CapabilityID   string                            `json:"capabilityId"`
+	Operation      types.ResidentCapabilityOperation `json:"operation"`
+	Action         string                            `json:"action,omitempty"`
+	Args           map[string]any                    `json:"args,omitempty"`
+	OK             bool                              `json:"ok,omitempty"`
+	Result         map[string]any                    `json:"result,omitempty"`
+	Error          string                            `json:"error,omitempty"`
+}
+
+type roomAppEnvelope struct {
+	ProtocolVersion int             `json:"protocolVersion"`
+	AppInstanceID   string          `json:"appInstanceId"`
+	Lane            string          `json:"lane"`
+	Payload         json.RawMessage `json:"payload"`
+}
+
+type reliableParticipantDataChannel interface {
+	Ready() bool
+	SendText(string) error
+}
+
+// RuntimeParticipantTransport owns a media-free Pion connection for the
+// currently authorized participant-pair projection. Its first consumer is
+// Generated App capability RPC. It has no queue: messages are admitted only
+// while the exact peer channel and projected Task/App route are live.
+type RuntimeParticipantTransport struct {
+	siteOrigin string
+	handle     DecodedHandle
+	handler    types.ResidentCapabilityController
+	log        func(string, map[string]string)
+
+	mu          sync.Mutex
+	closed      bool
+	starting    bool
+	generation  uint64
+	ctx         context.Context
+	cancel      context.CancelFunc
+	session     string
+	engine      *Engine
+	outbound    map[string]reliableParticipantDataChannel // Human participant id -> private pair lane
+	routes      map[string]types.RuntimeParticipantTransportRoute
+	sources     map[string]string // local pairwise publisher label -> Human participant id
+	inflight    chan struct{}
+	seen        map[string]time.Time
+	readyUpdate func(session string, ready bool) error
+}
+
+func NewRuntimeParticipantTransport(siteOrigin string, handle DecodedHandle, handler types.ResidentCapabilityController, log func(string, map[string]string)) *RuntimeParticipantTransport {
+	if log == nil {
+		log = func(string, map[string]string) {}
+	}
+	return &RuntimeParticipantTransport{siteOrigin: siteOrigin, handle: handle, handler: handler, log: log, inflight: make(chan struct{}, capabilityRequestLimit), seen: map[string]time.Time{}}
+}
+
+func (t *RuntimeParticipantTransport) Start(ctx context.Context, projection types.RuntimeParticipantTransportProjection) error {
+	if ctx == nil {
+		ctx = context.Background()
+	}
+	if !projection.Valid() || len(projection.Routes) == 0 {
+		return errors.New("participant_data_transport_unavailable")
+	}
+	if t.handler == nil {
+		return errors.New("capability_controller_unavailable")
+	}
+	available := make(map[string]struct{})
+	for _, capability := range t.handler.DescribeCapabilities() {
+		if capability.Valid() {
+			available[capability.CapabilityID] = struct{}{}
+		}
+	}
+	filteredRoutes := make([]types.RuntimeParticipantTransportRoute, 0, len(projection.Routes))
+	for _, route := range projection.Routes {
+		if route.AgentParticipantID != t.handle.ParticipantID {
+			return errors.New("capability_route_participant_mismatch")
+		}
+		capabilityIDs := make([]string, 0, len(route.CapabilityIDs))
+		for _, id := r
```

**File**: `agent/internal/media/participant_transport_test.go` (added, +563/-0)
```diff
@@ -0,0 +1,563 @@
+package media
+
+import (
+	"context"
+	"encoding/json"
+	"reflect"
+	"strings"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/i365dev/free4chat/agent/internal/types"
+	"github.com/pion/webrtc/v4"
+)
+
+type capabilityTestChannel struct{ payloads chan []byte }
+
+func (c *capabilityTestChannel) Ready() bool { return true }
+func (c *capabilityTestChannel) SendText(payload string) error {
+	c.payloads <- []byte(payload)
+	return nil
+}
+
+type capabilityTestHandler struct {
+	calls       chan types.ResidentCapabilityRequest
+	descriptors []types.RuntimeCapabilityProjection
+}
+
+func (h *capabilityTestHandler) DescribeCapabilities() []types.RuntimeCapabilityProjection {
+	return h.descriptors
+}
+func (h *capabilityTestHandler) HandleCapabilityRequest(_ context.Context, request types.ResidentCapabilityRequest) (map[string]any, error) {
+	h.calls <- request
+	return map[string]any{"status": "ready"}, nil
+}
+
+func validCapabilityTestDescriptor(capabilityID string, observe bool) types.RuntimeCapabilityProjection {
+	descriptor := types.RuntimeCapabilityProjection{
+		CapabilityID: capabilityID,
+		Title:        "Status",
+		Version:      "1",
+		Observe:      observe,
+		Actions:      []types.RuntimeCapabilityAction{},
+	}
+	return descriptor
+}
+
+func TestRuntimeParticipantTransportUsesBoundedParticipantFrames(t *testing.T) {
+	handler := &capabilityTestHandler{
+		calls:       make(chan types.ResidentCapabilityRequest, 1),
+		descriptors: []types.RuntimeCapabilityProjection{validCapabilityTestDescriptor("printer_status", true)},
+	}
+	channel := &capabilityTestChannel{payloads: make(chan []byte, 1)}
+	transport := NewRuntimeParticipantTransport("https://example.invalid", DecodedHandle{ParticipantID: "agent-a"}, handler, nil)
+	transport.ctx = context.Background()
+	transport.outbound = map[string]reliableParticipantDataChannel{"human-a": channel}
+	transport.routes = map[string]types.RuntimeParticipantTransportRoute{
+		"generated:123e4567-e89b-12d3-a456-426614174000": {
+			AppInstanceID:  "generated:123e4567-e89b-12d3-a456-426614174000",
+			BundleRevision: 2, TaskRequestID: "task-a", AgentParticipantID: "agent-a", HumanParticipantID: "human-a",
+			RuntimeHostID: "host-route-1", CapabilityIDs: []string{"printer_status"},
+		},
+	}
+	label := participantDirectReliableChannelName("agent-a", "human-a")
+	transport.sources = map[string]string{label: "human-a"}
+	requestPayload, _ := json.Marshal(capabilityFrame{
+		Type: capabilityRequestFrame, RequestID: "request-a",
+		AppInstanceID:  "generated:123e4567-e89b-12d3-a456-426614174000",
+		BundleRevision: 2, TaskRequestID: "task-a", AgentID: "agent-a",
+		CapabilityID: "printer_status", Operation: types.ResidentCapabilityObserve,
+	})
+	request, _ := json.Marshal(roomAppEnvelope{ProtocolVersion: 1, Lane: "reliable", AppInstanceID: "generated:123e4567-e89b-12d3-a456-426614174000", Payload: requestPayload})
+	transport.receive(label, request)
+	select {
+	case got := <-handler.calls:
+		if got.RequestID != "request-a" || got.RuntimeHostID != "host-route-1" || got.CapabilityID != "printer_status" {
+			t.Fatalf("request did not resolve through the projected originating route: %+v", got)
+		}
+	case <-time.After(time.Second):
+		t.Fatal("Runtime controller was not called")
+	}
+	select {
+	case payload := <-channel.payloads:
+		var envelope roomAppEnvelope
+		var result capabilityFrame
+		if err := json.Unmarshal(payload, &envelope); err != nil || envelope.ProtocolVersion != 1 || envelope.Lane != "reliable" {
+			t.Fatalf("result did not use the bounded reliable Room App envelope: %s (%v)", payload, err)
+		}
+		if err := json.Unmarshal(envelope.Payload, &result); err != nil || result.Type != capabilityResultFrame || !result.OK || result.RequestID != "request-a" || result.Result["status"] != "ready" {
+			t.Fatalf("result was not correlated on the same participant lane: %s (%v)", payload, err)
+		}
+	case <-time.After(time.Second):
+		t.Fatal("Runtime did not return the bounded result on its participant lane")
+	}
+}
+
+func TestRuntimeParticipantTransportReturnsBoundedErrorForEnvelopeOversizeResult(t *testing.T) {
+	channel := &capabilityTestChannel{payloads: make(chan []byte, 1)}
+	transport := NewRuntimeParticipantTransport("https://example.invalid", DecodedHandle{ParticipantID: "agent-a"}, nil, nil)
+	route := types.RuntimeParticipantTransportRoute{
+		AppInstanceID:  "generated:123e4567-e89b-12d3-a456-426614174000",
+		BundleRevision: 2, TaskRequestID: "task-a", AgentParticipantID: "agent-a",
+		HumanParticipantID: "human-a", RuntimeHostID: "host-route-1",
+		CapabilityIDs: []string{"printer_status"},
+	}
+	request := capabilityFrame{
+		RequestID: "request-a", CapabilityID: "printer_status",
+		Operation: types.ResidentCapabilityObserve,
+	}
+	largeResult := map[string]any{
+		"items": []any{
+			strings.Repeat("a", 4000),
+			strings.Repeat("b", 4000),
+			strings.Repeat("c", 4000),
+			strings.Repeat("d", 4000),
+		},
+	}
+	if !types.Re
```

**File**: `agent/internal/media/rest.go` (modified, +62/-4)
```diff
@@ -63,10 +63,11 @@ func SiteOriginFromMCPURL(mcpURL string) (string, error) {
 type Purpose string
 
 const (
-	PurposeAgentTransport Purpose = "agent-transport"
-	PurposeMeetingNotes   Purpose = "meeting-notes"
-	PurposeLiveTranscript Purpose = "live-transcript"
-	PurposeVoiceReply     Purpose = "voice-reply"
+	PurposeAgentTransport      Purpose = "agent-transport"
+	PurposeParticipantReliable Purpose = "participant-reliable"
+	PurposeMeetingNotes        Purpose = "meeting-notes"
+	PurposeLiveTranscript      Purpose = "live-transcript"
+	PurposeVoiceReply          Purpose = "voice-reply"
 )
 
 // AgentMediaDiscoveryDenied is the agent-room-media denial code introduced
@@ -204,6 +205,63 @@ func (c *SfuRestClient) CreateAgentSession() (string, error) {
 	return sessionID, nil
 }
 
+// CreateAgentParticipantDataSession creates the no-media headless participant
+// session used while the Room projects an authorized Runtime data route.
+func (c *SfuRestClient) CreateAgentParticipantDataSession() (string, error) {
+	data, err := c.request("agent-participant-data-session", http.MethodPost, c.base())
+	if err != nil {
+		return "", err
+	}
+	sessionID, _ := data["sessionId"].(string)
+	if sessionID == "" {
+		return "", errors.New("participant_data_session_invalid")
+	}
+	return sessionID, nil
+}
+
+// SetAgentParticipantDataReady publishes only whether the direct reliable channel
+// is usable; it carries no request payload or capability result.
+func (c *SfuRestClient) SetAgentParticipantDataReady(sessionID string, ready bool) error {
+	body := c.base()
+	body["sessionId"] = sessionID
+	body["ready"] = ready
+	_, err := c.request("agent-participant-data-ready", http.MethodPost, body)
+	return err
+}
+
+// CreateParticipantDataChannels allocates bounded, pair-authorized negotiated
+// reliable channels on the current Cloudflare session.
+func (c *SfuRestClient) CreateParticipantDataChannels(sessionID string, channels []map[string]any) ([]uint16, error) {
+	if len(channels) == 0 || len(channels) > 33 {
+		return nil, errors.New("invalid_datachannel_count")
+	}
+	body := c.base()
+	body["sessionId"] = sessionID
+	body["transport"] = "participant-direct-reliable"
+	body["dataChannels"] = channels
+	data, err := c.request("datachannels/new", http.MethodPost, body)
+	if err != nil {
+		return nil, err
+	}
+	raw, _ := data["dataChannels"].([]any)
+	if len(raw) != len(channels) {
+		return nil, errors.New("datachannel_allocation_invalid")
+	}
+	ids := make([]uint16, 0, len(raw))
+	for _, entry := range raw {
+		record, ok := entry.(map[string]any)
+		if !ok {
+			return nil, errors.New("datachannel_allocation_invalid")
+		}
+		id, ok := record["id"].(float64)
+		if !ok || id < 0 || id > 65534 || id != float64(uint16(id)) {
+			return nil, errors.New("datachannel_allocation_invalid")
+		}
+		ids = append(ids, uint16(id))
+	}
+	return ids, nil
+}
+
 // EstablishDataChannelTransport establishes the initial WebRTC transport
 // exactly as the browser does, submitting the gathered LOCAL offer (client
 // offer + server answer); the returned description's actual type is honored.
```

**File**: `agent/internal/runtime/participant_transport_retry_test.go` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+package runtime
+
+import (
+	"context"
+	"errors"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/i365dev/free4chat/agent/internal/media"
+	"github.com/i365dev/free4chat/agent/internal/types"
+)
+
+type participantTransportStartResult struct {
+	projection types.RuntimeParticipantTransportProjection
+	err        error
+}
+
+type scriptedParticipantTransport struct {
+	result  participantTransportStartResult
+	started chan participantTransportStartResult
+	once    sync.Once
+}
+
+func newScriptedParticipantTransport(err error) *scriptedParticipantTransport {
+	return &scriptedParticipantTransport{
+		result:  participantTransportStartResult{err: err},
+		started: make(chan participantTransportStartResult, 1),
+	}
+}
+
+func (t *scriptedParticipantTransport) Start(_ context.Context, projection types.RuntimeParticipantTransportProjection) error {
+	t.once.Do(func() {
+		t.started <- participantTransportStartResult{projection: projection, err: t.result.err}
+	})
+	return t.result.err
+}
+
+func (*scriptedParticipantTransport) Close() {}
+
+func participantTransportTestProjection(humanID, sessionID string) types.RuntimeParticipantTransportProjection {
+	return types.RuntimeParticipantTransportProjection{
+		Routes: []types.RuntimeParticipantTransportRoute{{
+			AppInstanceID:      "generated:123e4567-e89b-12d3-a456-426614174000",
+			BundleRevision:     1,
+			TaskRequestID:      "task-origin",
+			AgentParticipantID: "agent-a",
+			HumanParticipantID: humanID,
+			RuntimeHostID:      "11111111-2222-3333-4444-555555555555",
+			CapabilityIDs:      []string{"printer_status"},
+		}},
+		Sources: []types.RuntimeParticipantTransportSource{{ParticipantID: humanID, SessionID: sessionID}},
+	}
+}
+
+func configureParticipantTransportRuntime(t *testing.T, rt *ResidentRuntime, delay time.Duration) {
+	t.Helper()
+	rt.options.CapabilityHandler = reconnectParticipantCapabilityHandler{}
+	rt.options.SiteOrigin = "https://example.invalid"
+	rt.participantTransportRetryDelay = func(int) time.Duration { return delay }
+	rt.mu.Lock()
+	rt.participantID = "agent-a"
+	rt.participantHandle = "eyJyb29tIjoicm9vbSIsInBhcnRpY2lwYW50SWQiOiJhZ2VudC1hIiwicGFydGljaXBhbnRUb2tlbiI6InRlc3QtdG9rZW4ifQ"
+	rt.mu.Unlock()
+}
+
+func awaitParticipantTransportStart(t *testing.T, transport *scriptedParticipantTransport) participantTransportStartResult {
+	t.Helper()
+	select {
+	case result := <-transport.started:
+		return result
+	case <-time.After(2 * time.Second):
+		t.Fatal("participant transport did not start")
+		return participantTransportStartResult{}
+	}
+}
+
+func TestParticipantTransportRetriesSameProjectionWithoutRoomEnvelope(t *testing.T) {
+	rt, _ := newResidentFenceRuntime(t)
+	configureParticipantTransportRuntime(t, rt, 10*time.Millisecond)
+	defer rt.Stop()
+
+	first := newScriptedParticipantTransport(errors.New("transient signaling failure"))
+	second := newScriptedParticipantTransport(nil)
+	transports := []*scriptedParticipantTransport{first, second}
+	var mu sync.Mutex
+	var factoryCalls int
+	rt.participantTransportFactory = func(media.DecodedHandle) participantDataTransport {
+		mu.Lock()
+		defer mu.Unlock()
+		factoryCalls++
+		if factoryCalls > len(transports) {
+			t.Error("participant transport retry created an unexpected transport")
+			return nil
+		}
+		return transports[factoryCalls-1]
+	}
+
+	projection := participantTransportTestProjection("human-a", "session-a")
+	rt.observeRuntimeParticipantTransport(projection)
+	if got := awaitParticipantTransportStart(t, first); got.err == nil {
+		t.Fatal("first transport Start unexpectedly succeeded")
+	}
+	if got := awaitParticipantTransportStart(t, second); got.err != nil {
+		t.Fatalf("retry Start failed: %v", got.err)
+	} else if got.projection.Routes[0].HumanParticipantID != "human-a" {
+		t.Fatalf("retry used a different projection: %+v", got.projection)
+	}
+
+	rt.mu.Lock()
+	current := rt.participantTransport
+	rt.mu.Unlock()
+	if current != second {
+		t.Fatal("successful retry did not retain exactly one current transport")
+	}
+	mu.Lock()
+	defer mu.Unlock()
+	if factoryCalls != 2 {
+		t.Fatalf("transport factory calls = %d, want exactly 2", factoryCalls)
+	}
+}
+
+func TestParticipantTransportRetryDoesNotCrossProjectionGeneration(t *testing.T) {
+	rt, _ := newResidentFenceRuntime(t)
+	configureParticipantTransportRuntime(t, rt, 250*time.Millisecond)
+	defer rt.Stop()
+
+	stale := newScriptedParticipantTransport(errors.New("transient signaling failure"))
+	current := newScriptedParticipantTransport(nil)
+	var mu sync.Mutex
+	var factoryCalls int
+	rt.participantTransportFactory = func(media.DecodedHandle) participantDataTransport {
+		mu.Lock()
+		defer mu.Unlock()
+		factoryCalls++
+		if factoryCalls == 1 {
+			return stale
+		}
+		if factoryCalls == 2 {
+			return current
+		}
+		t.Error("stale projection retry started after projection replacement")
+		return nil
+	}
+
+	rt.observeRuntimeParticipantTransport(participantTransportTestProjection("
```

---

### Incident Patch 10: `0cebb1a0` (2026-10-01)
**Commit Message**: Merge pull request #545 from i365dev/codex/issue-543-room-ui

[codex] Fix Room UI navigation and splitter drag

**File**: `app/e2e/room-app-host/room-app-host.spec.ts` (modified, +38/-0)
```diff
@@ -889,6 +889,44 @@ test("Room App host contract survives open, fullscreen, exit, hide and reopen",
   await test.step("the fixture App stays interactive inside the sandbox", async () => {
     const fixture = fixtureFrame()
     await expect(fixture.getByTestId("fixture-participants")).toHaveText("1")
+
+    if (isTwoPaneRoom(page)) {
+      const splitter = page.getByTestId("room-splitter")
+      const splitterBox = await splitter.boundingBox()
+      const iframeBox = await appIframe(page).boundingBox()
+      expect(splitterBox).not.toBeNull()
+      expect(iframeBox).not.toBeNull()
+
+      const before = await roomStage(page).evaluate(
+        (element) => element.style.width
+      )
+      const start = {
+        x: splitterBox!.x + splitterBox!.width / 2,
+        y: splitterBox!.y + splitterBox!.height / 2,
+      }
+      const overApp = {
+        x: iframeBox!.x + iframeBox!.width / 2,
+        y: iframeBox!.y + iframeBox!.height / 2,
+      }
+
+      await page.mouse.move(start.x, start.y)
+      await page.mouse.down()
+      await page.mouse.move(overApp.x, overApp.y)
+      await expect
+        .poll(() => roomStage(page).evaluate((element) => element.style.width))
+        .not.toBe(before)
+      const afterDrag = await roomStage(page).evaluate(
+        (element) => element.style.width
+      )
+
+      // Release over the iframe, then move again to prove the drag has ended.
+      await page.mouse.up()
+      await page.mouse.move(start.x, start.y)
+      expect(
+        await roomStage(page).evaluate((element) => element.style.width)
+      ).toBe(afterDrag)
+    }
+
     // "fixture-ticks" was already incremented to 1 before fullscreen, and every
     // click/outbound message adds one: the App-local state carried through the
     // whole focus-mode round trip.
```

**File**: `app/src/components/RoomContent.test.tsx` (modified, +56/-0)
```diff
@@ -4464,6 +4464,16 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
     })
 
     describe("#475 generated Task App Stage parity", () => {
+      let previousViewportWidth = 0
+
+      beforeEach(() => {
+        previousViewportWidth = window.innerWidth
+      })
+
+      afterEach(() => {
+        window.innerWidth = previousViewportWidth
+      })
+
       /** The canonical Room generation id the hook projects in RoomState. */
       const STAGE_ANALYTICS_ROOM_ID = "3f7c1c2e-9a4b-4d5e-8f01-2b6c7d8e9f10"
       const GENERATED_APP_ID = "generated:00000000-0000-4000-8000-0000000000a1"
@@ -4737,6 +4747,52 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
         expect(visibleStageAppSlots()).toHaveLength(1)
       })
 
+      it("opens the resident Task App sheet from mobile Task chat and returns to that Task when closed", async () => {
+        vi.stubEnv("NODE_ENV", "production")
+        window.innerWidth = 390
+        renderBothAppRoom()
+
+        fireEvent.click(screen.getByTestId("interaction-tab-task-task-live"))
+        expect(screen.queryByTestId("room-mobile-sheet")).toBeNull()
+        expect(
+          screen.getByTestId("interaction-tab-task-task-live")
+        ).toHaveAttribute("aria-selected", "true")
+
+        fireEvent.click(
+          within(screen.getByTestId("generated-room-app-card")).getByRole(
+            "button",
+            { name: "Open App" }
+          )
+        )
+        const sheet = await screen.findByTestId("room-mobile-sheet")
+        await waitFor(() => expect(generatedSlotHidden()).toBe(false))
+
+        const residentHost = generatedHost()
+        const residentIframe = generatedIframe()
+        expect(within(sheet).getByTestId("room-stage")).toContainElement(
+          residentHost
+        )
+
+        fireEvent.click(screen.getByTestId("room-mobile-sheet-close"))
+        expect(screen.queryByTestId("room-mobile-sheet")).toBeNull()
+        expect(
+          screen.getByTestId("interaction-tab-task-task-live")
+        ).toHaveAttribute("aria-selected", "true")
+        expect(generatedHost()).toBe(residentHost)
+        expect(generatedIframe()).toBe(residentIframe)
+
+        fireEvent.click(
+          within(screen.getByTestId("generated-room-app-card")).getByRole(
+            "button",
+            { name: "Open App" }
+          )
+        )
+        expect(await screen.findByTestId("room-mobile-sheet")).toContainElement(
+          residentHost
+        )
+        expect(generatedIframe()).toBe(residentIframe)
+      })
+
       it("hides the generated host when Screen becomes the Stage surface", async () => {
         renderBothAppRoom({
           participants: [localParticipant, remoteScreenShare],
```

**File**: `app/src/components/RoomContent.tsx` (modified, +97/-17)
```diff
@@ -354,6 +354,8 @@ export default function RoomContent({
   // click. There is deliberately no persisted "Interrupted" Task state.
   const [taskInterruptFailed, setTaskInterruptFailed] = useState(false)
   const [activeInteraction, setActiveInteraction] = useState("room")
+  const [mobileSheetReturnInteraction, setMobileSheetReturnInteraction] =
+    useState<string | null>(null)
   const [activeRoomAppId, setActiveRoomAppId] = useState<string | null>(null)
   const [activeGeneratedAppId, setActiveGeneratedAppId] = useState<
     string | null
@@ -839,6 +841,14 @@ export default function RoomContent({
       setActiveRoomAppId(null)
       setActiveGeneratedAppId(publication.appInstanceId)
       setStageView("screen")
+      if (!isMd) {
+        setMobileSheetReturnInteraction(
+          taskProjections.some((task) => task.requestId === activeInteraction)
+            ? activeInteraction
+            : null
+        )
+        setMobileRoomSheetOpen(true)
+      }
       const result = await loadGeneratedAppDocument(publication)
       if (result !== "unavailable") return
       // The App this transition selected cannot be shown. Release it, but
@@ -847,7 +857,7 @@ export default function RoomContent({
         current === publication.appInstanceId ? null : current
       )
     },
-    [loadGeneratedAppDocument]
+    [activeInteraction, isMd, loadGeneratedAppDocument, taskProjections]
   )
   // Background reconciliation: keeps a RESIDENT generated App's document in
   // step with Room truth without touching the Stage owner or focus mode.
@@ -1937,7 +1947,9 @@ export default function RoomContent({
   }, [activeSharePeerIdForStage, activeTask?.requestId])
 
   const containerRef = useRef<HTMLDivElement>(null)
-  const isDragging = useRef(false)
+  const [isDragging, setIsDragging] = useState(false)
+  const dragPointerIdRef = useRef<number | null>(null)
+  const dragTargetRef = useRef<HTMLDivElement | null>(null)
   const [splitRatio, setSplitRatio] = useState(50)
   // The launcher anchors to the Stage strip's `Apps…` control, never to the
   // strip itself: the strip is a horizontal scroller, so an in-flow popover
@@ -2018,22 +2030,73 @@ export default function RoomContent({
   }, [activeScreenShares.length > 0, stageAppVisible])
 
   useEffect(() => {
-    const onMouseMove = (e: MouseEvent) => {
-      if (!isDragging.current || !containerRef.current) return
+    if (!isDragging) return
+
+    const finishDrag = (pointerId?: number) => {
+      const activePointerId = dragPointerIdRef.current
+      if (
+        pointerId !== undefined &&
+        activePointerId !== null &&
+        pointerId !== activePointerId
+      )
+        return
+      const target = dragTargetRef.current
+      dragPointerIdRef.current = null
+      dragTargetRef.current = null
+      if (
+        target &&
+        activePointerId !== null &&
+        target.hasPointerCapture?.(activePointerId)
+      ) {
+        try {
+          target.releasePointerCapture(activePointerId)
+        } catch {
+          // The browser may already have released capture during pointer loss.
+        }
+      }
+      setIsDragging(false)
+    }
+
+    const onPointerMove = (e: PointerEvent) => {
+      if (e.pointerId !== dragPointerIdRef.current || !containerRef.current)
+        return
       const rect = containerRef.current.getBoundingClientRect()
       const ratio = ((e.clientX - rect.left) / rect.width) * 100
       setSplitRatio(Math.max(20, Math.min(80, ratio)))
     }
-    const onMouseUp = () => {
-      isDragging.current = false
-    }
-    window.addEventListener("mousemove", onMouseMove)
-    window.addEventListener("mouseup", onMouseUp)
+    const onPointerUp = (e: PointerEvent) => finishDrag(e.pointerId)
+    const onPointerCancel = (e: PointerEvent) => finishDrag(e.pointerId)
+    const onLostPointerCapture = (e: PointerEvent) => finishDrag(e.pointerId)
+    const onWindowBlur = () => finishDrag()
+
+    window.addEventListener("pointermove", onPointerMove)
+    window.addEventListener("pointerup", onPointerUp)
+    window.addEventListener("pointercancel", onPointerCancel)
+    window.addEventListener("lostpointercapture", onLostPointerCapture)
+    window.addEventListener("blur", onWindowBlur)
     return () => {
-      window.removeEventListener("mousemove", onMouseMove)
-      window.removeEventListener("mouseup", onMouseUp)
+      window.removeEventListener("pointermove", onPointerMove)
+      window.removeEventListener("pointerup", onPointerUp)
+      window.removeEventListener("pointercancel", onPointerCancel)
+      window.removeEventListener("lostpointercapture", onLostPointerCapture)
+      window.removeEventListener("blur", onWindowBlur)
+      const target = dragTargetRef.current
+      const pointerId = dragPointerIdRef.current
+      dragTargetRef.current = null
+      dragPointerIdRef.current = null
+      if (
+        target &&
+        pointerId !== null &&
+        target.hasPointerCapture?.(point
```

**File**: `app/src/components/roomMobileComposition.test.tsx` (modified, +59/-0)
```diff
@@ -443,6 +443,65 @@ describe("RoomContent — narrow-screen composition", () => {
     )
   })
 
+  it("captures desktop splitter drags across content and clears them on release, cancel, blur, and unmount", () => {
+    window.innerWidth = DESKTOP_WIDTH
+    const { container, unmount } = renderRoom()
+    const splitter = screen.getByTestId("room-splitter") as HTMLDivElement
+    const room = container.querySelector(".room-content") as HTMLDivElement
+    room.getBoundingClientRect = vi.fn(
+      () => ({ left: 0, width: 1000 } as DOMRect)
+    )
+    const setCapture = vi.fn()
+    const hasCapture = vi.fn(() => true)
+    const releaseCapture = vi.fn()
+    splitter.setPointerCapture = setCapture
+    splitter.hasPointerCapture = hasCapture
+    splitter.releasePointerCapture = releaseCapture
+
+    const stage = screen.getByTestId("room-stage")
+    const sendPointer = (
+      target: Element | Window,
+      type: string,
+      pointerId: number,
+      clientX = 0
+    ) => {
+      const event = new Event(type, { bubbles: true })
+      Object.defineProperties(event, {
+        pointerId: { value: pointerId },
+        clientX: { value: clientX },
+      })
+      fireEvent(target, event)
+    }
+
+    sendPointer(splitter, "pointerdown", 1)
+    sendPointer(window, "pointermove", 1, 700)
+    expect(stage).toHaveStyle({ width: "70%" })
+    expect(setCapture).toHaveBeenCalledWith(1)
+
+    // A release outside the divider ends the active drag. Later movement over
+    // App/content surfaces cannot leave a stale resize listener working.
+    sendPointer(window, "pointerup", 1)
+    sendPointer(window, "pointermove", 1, 800)
+    expect(stage).toHaveStyle({ width: "70%" })
+    expect(releaseCapture).toHaveBeenCalledWith(1)
+
+    sendPointer(splitter, "pointerdown", 2)
+    sendPointer(window, "pointermove", 2, 600)
+    sendPointer(window, "pointercancel", 2)
+    sendPointer(window, "pointermove", 2, 800)
+    expect(stage).toHaveStyle({ width: "60%" })
+
+    sendPointer(splitter, "pointerdown", 3)
+    sendPointer(window, "pointermove", 3, 400)
+    fireEvent.blur(window)
+    sendPointer(window, "pointermove", 3, 800)
+    expect(stage).toHaveStyle({ width: "40%" })
+
+    sendPointer(splitter, "pointerdown", 4)
+    unmount()
+    expect(releaseCapture).toHaveBeenCalledWith(4)
+  })
+
   it("keeps a fullscreen Room App owning the phone content region", () => {
     window.innerWidth = PHONE_WIDTH
     renderRoom({ roomAppsEnabled: true })
```

---

### Incident Patch 11: `b8906fc1` (2026-10-01)
**Commit Message**: fix Room UI navigation and splitter drag

**File**: `app/e2e/room-app-host/room-app-host.spec.ts` (modified, +38/-0)
```diff
@@ -889,6 +889,44 @@ test("Room App host contract survives open, fullscreen, exit, hide and reopen",
   await test.step("the fixture App stays interactive inside the sandbox", async () => {
     const fixture = fixtureFrame()
     await expect(fixture.getByTestId("fixture-participants")).toHaveText("1")
+
+    if (isTwoPaneRoom(page)) {
+      const splitter = page.getByTestId("room-splitter")
+      const splitterBox = await splitter.boundingBox()
+      const iframeBox = await appIframe(page).boundingBox()
+      expect(splitterBox).not.toBeNull()
+      expect(iframeBox).not.toBeNull()
+
+      const before = await roomStage(page).evaluate(
+        (element) => element.style.width
+      )
+      const start = {
+        x: splitterBox!.x + splitterBox!.width / 2,
+        y: splitterBox!.y + splitterBox!.height / 2,
+      }
+      const overApp = {
+        x: iframeBox!.x + iframeBox!.width / 2,
+        y: iframeBox!.y + iframeBox!.height / 2,
+      }
+
+      await page.mouse.move(start.x, start.y)
+      await page.mouse.down()
+      await page.mouse.move(overApp.x, overApp.y)
+      await expect
+        .poll(() => roomStage(page).evaluate((element) => element.style.width))
+        .not.toBe(before)
+      const afterDrag = await roomStage(page).evaluate(
+        (element) => element.style.width
+      )
+
+      // Release over the iframe, then move again to prove the drag has ended.
+      await page.mouse.up()
+      await page.mouse.move(start.x, start.y)
+      expect(
+        await roomStage(page).evaluate((element) => element.style.width)
+      ).toBe(afterDrag)
+    }
+
     // "fixture-ticks" was already incremented to 1 before fullscreen, and every
     // click/outbound message adds one: the App-local state carried through the
     // whole focus-mode round trip.
```

**File**: `app/src/components/RoomContent.test.tsx` (modified, +56/-0)
```diff
@@ -4464,6 +4464,16 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
     })
 
     describe("#475 generated Task App Stage parity", () => {
+      let previousViewportWidth = 0
+
+      beforeEach(() => {
+        previousViewportWidth = window.innerWidth
+      })
+
+      afterEach(() => {
+        window.innerWidth = previousViewportWidth
+      })
+
       /** The canonical Room generation id the hook projects in RoomState. */
       const STAGE_ANALYTICS_ROOM_ID = "3f7c1c2e-9a4b-4d5e-8f01-2b6c7d8e9f10"
       const GENERATED_APP_ID = "generated:00000000-0000-4000-8000-0000000000a1"
@@ -4737,6 +4747,52 @@ describe("RoomContent — Turnstile widget lifecycle", () => {
         expect(visibleStageAppSlots()).toHaveLength(1)
       })
 
+      it("opens the resident Task App sheet from mobile Task chat and returns to that Task when closed", async () => {
+        vi.stubEnv("NODE_ENV", "production")
+        window.innerWidth = 390
+        renderBothAppRoom()
+
+        fireEvent.click(screen.getByTestId("interaction-tab-task-task-live"))
+        expect(screen.queryByTestId("room-mobile-sheet")).toBeNull()
+        expect(
+          screen.getByTestId("interaction-tab-task-task-live")
+        ).toHaveAttribute("aria-selected", "true")
+
+        fireEvent.click(
+          within(screen.getByTestId("generated-room-app-card")).getByRole(
+            "button",
+            { name: "Open App" }
+          )
+        )
+        const sheet = await screen.findByTestId("room-mobile-sheet")
+        await waitFor(() => expect(generatedSlotHidden()).toBe(false))
+
+        const residentHost = generatedHost()
+        const residentIframe = generatedIframe()
+        expect(within(sheet).getByTestId("room-stage")).toContainElement(
+          residentHost
+        )
+
+        fireEvent.click(screen.getByTestId("room-mobile-sheet-close"))
+        expect(screen.queryByTestId("room-mobile-sheet")).toBeNull()
+        expect(
+          screen.getByTestId("interaction-tab-task-task-live")
+        ).toHaveAttribute("aria-selected", "true")
+        expect(generatedHost()).toBe(residentHost)
+        expect(generatedIframe()).toBe(residentIframe)
+
+        fireEvent.click(
+          within(screen.getByTestId("generated-room-app-card")).getByRole(
+            "button",
+            { name: "Open App" }
+          )
+        )
+        expect(await screen.findByTestId("room-mobile-sheet")).toContainElement(
+          residentHost
+        )
+        expect(generatedIframe()).toBe(residentIframe)
+      })
+
       it("hides the generated host when Screen becomes the Stage surface", async () => {
         renderBothAppRoom({
           participants: [localParticipant, remoteScreenShare],
```

**File**: `app/src/components/RoomContent.tsx` (modified, +97/-17)
```diff
@@ -354,6 +354,8 @@ export default function RoomContent({
   // click. There is deliberately no persisted "Interrupted" Task state.
   const [taskInterruptFailed, setTaskInterruptFailed] = useState(false)
   const [activeInteraction, setActiveInteraction] = useState("room")
+  const [mobileSheetReturnInteraction, setMobileSheetReturnInteraction] =
+    useState<string | null>(null)
   const [activeRoomAppId, setActiveRoomAppId] = useState<string | null>(null)
   const [activeGeneratedAppId, setActiveGeneratedAppId] = useState<
     string | null
@@ -839,6 +841,14 @@ export default function RoomContent({
       setActiveRoomAppId(null)
       setActiveGeneratedAppId(publication.appInstanceId)
       setStageView("screen")
+      if (!isMd) {
+        setMobileSheetReturnInteraction(
+          taskProjections.some((task) => task.requestId === activeInteraction)
+            ? activeInteraction
+            : null
+        )
+        setMobileRoomSheetOpen(true)
+      }
       const result = await loadGeneratedAppDocument(publication)
       if (result !== "unavailable") return
       // The App this transition selected cannot be shown. Release it, but
@@ -847,7 +857,7 @@ export default function RoomContent({
         current === publication.appInstanceId ? null : current
       )
     },
-    [loadGeneratedAppDocument]
+    [activeInteraction, isMd, loadGeneratedAppDocument, taskProjections]
   )
   // Background reconciliation: keeps a RESIDENT generated App's document in
   // step with Room truth without touching the Stage owner or focus mode.
@@ -1937,7 +1947,9 @@ export default function RoomContent({
   }, [activeSharePeerIdForStage, activeTask?.requestId])
 
   const containerRef = useRef<HTMLDivElement>(null)
-  const isDragging = useRef(false)
+  const [isDragging, setIsDragging] = useState(false)
+  const dragPointerIdRef = useRef<number | null>(null)
+  const dragTargetRef = useRef<HTMLDivElement | null>(null)
   const [splitRatio, setSplitRatio] = useState(50)
   // The launcher anchors to the Stage strip's `Apps…` control, never to the
   // strip itself: the strip is a horizontal scroller, so an in-flow popover
@@ -2018,22 +2030,73 @@ export default function RoomContent({
   }, [activeScreenShares.length > 0, stageAppVisible])
 
   useEffect(() => {
-    const onMouseMove = (e: MouseEvent) => {
-      if (!isDragging.current || !containerRef.current) return
+    if (!isDragging) return
+
+    const finishDrag = (pointerId?: number) => {
+      const activePointerId = dragPointerIdRef.current
+      if (
+        pointerId !== undefined &&
+        activePointerId !== null &&
+        pointerId !== activePointerId
+      )
+        return
+      const target = dragTargetRef.current
+      dragPointerIdRef.current = null
+      dragTargetRef.current = null
+      if (
+        target &&
+        activePointerId !== null &&
+        target.hasPointerCapture?.(activePointerId)
+      ) {
+        try {
+          target.releasePointerCapture(activePointerId)
+        } catch {
+          // The browser may already have released capture during pointer loss.
+        }
+      }
+      setIsDragging(false)
+    }
+
+    const onPointerMove = (e: PointerEvent) => {
+      if (e.pointerId !== dragPointerIdRef.current || !containerRef.current)
+        return
       const rect = containerRef.current.getBoundingClientRect()
       const ratio = ((e.clientX - rect.left) / rect.width) * 100
       setSplitRatio(Math.max(20, Math.min(80, ratio)))
     }
-    const onMouseUp = () => {
-      isDragging.current = false
-    }
-    window.addEventListener("mousemove", onMouseMove)
-    window.addEventListener("mouseup", onMouseUp)
+    const onPointerUp = (e: PointerEvent) => finishDrag(e.pointerId)
+    const onPointerCancel = (e: PointerEvent) => finishDrag(e.pointerId)
+    const onLostPointerCapture = (e: PointerEvent) => finishDrag(e.pointerId)
+    const onWindowBlur = () => finishDrag()
+
+    window.addEventListener("pointermove", onPointerMove)
+    window.addEventListener("pointerup", onPointerUp)
+    window.addEventListener("pointercancel", onPointerCancel)
+    window.addEventListener("lostpointercapture", onLostPointerCapture)
+    window.addEventListener("blur", onWindowBlur)
     return () => {
-      window.removeEventListener("mousemove", onMouseMove)
-      window.removeEventListener("mouseup", onMouseUp)
+      window.removeEventListener("pointermove", onPointerMove)
+      window.removeEventListener("pointerup", onPointerUp)
+      window.removeEventListener("pointercancel", onPointerCancel)
+      window.removeEventListener("lostpointercapture", onLostPointerCapture)
+      window.removeEventListener("blur", onWindowBlur)
+      const target = dragTargetRef.current
+      const pointerId = dragPointerIdRef.current
+      dragTargetRef.current = null
+      dragPointerIdRef.current = null
+      if (
+        target &&
+        pointerId !== null &&
+        target.hasPointerCapture?.(point
```

**File**: `app/src/components/roomMobileComposition.test.tsx` (modified, +59/-0)
```diff
@@ -443,6 +443,65 @@ describe("RoomContent — narrow-screen composition", () => {
     )
   })
 
+  it("captures desktop splitter drags across content and clears them on release, cancel, blur, and unmount", () => {
+    window.innerWidth = DESKTOP_WIDTH
+    const { container, unmount } = renderRoom()
+    const splitter = screen.getByTestId("room-splitter") as HTMLDivElement
+    const room = container.querySelector(".room-content") as HTMLDivElement
+    room.getBoundingClientRect = vi.fn(
+      () => ({ left: 0, width: 1000 } as DOMRect)
+    )
+    const setCapture = vi.fn()
+    const hasCapture = vi.fn(() => true)
+    const releaseCapture = vi.fn()
+    splitter.setPointerCapture = setCapture
+    splitter.hasPointerCapture = hasCapture
+    splitter.releasePointerCapture = releaseCapture
+
+    const stage = screen.getByTestId("room-stage")
+    const sendPointer = (
+      target: Element | Window,
+      type: string,
+      pointerId: number,
+      clientX = 0
+    ) => {
+      const event = new Event(type, { bubbles: true })
+      Object.defineProperties(event, {
+        pointerId: { value: pointerId },
+        clientX: { value: clientX },
+      })
+      fireEvent(target, event)
+    }
+
+    sendPointer(splitter, "pointerdown", 1)
+    sendPointer(window, "pointermove", 1, 700)
+    expect(stage).toHaveStyle({ width: "70%" })
+    expect(setCapture).toHaveBeenCalledWith(1)
+
+    // A release outside the divider ends the active drag. Later movement over
+    // App/content surfaces cannot leave a stale resize listener working.
+    sendPointer(window, "pointerup", 1)
+    sendPointer(window, "pointermove", 1, 800)
+    expect(stage).toHaveStyle({ width: "70%" })
+    expect(releaseCapture).toHaveBeenCalledWith(1)
+
+    sendPointer(splitter, "pointerdown", 2)
+    sendPointer(window, "pointermove", 2, 600)
+    sendPointer(window, "pointercancel", 2)
+    sendPointer(window, "pointermove", 2, 800)
+    expect(stage).toHaveStyle({ width: "60%" })
+
+    sendPointer(splitter, "pointerdown", 3)
+    sendPointer(window, "pointermove", 3, 400)
+    fireEvent.blur(window)
+    sendPointer(window, "pointermove", 3, 800)
+    expect(stage).toHaveStyle({ width: "40%" })
+
+    sendPointer(splitter, "pointerdown", 4)
+    unmount()
+    expect(releaseCapture).toHaveBeenCalledWith(4)
+  })
+
   it("keeps a fullscreen Room App owning the phone content region", () => {
     window.innerWidth = PHONE_WIDTH
     renderRoom({ roomAppsEnabled: true })
```

---

### Incident Patch 12: `ff48008f` (2026-10-01)
**Commit Message**: fix(agent): enforce daemon singleton ownership (#539)

* fix(agent): enforce daemon singleton ownership

* fix(agent): retry transient daemon lock contention

---------

Co-authored-by: codex <[REDACTED_EMAIL]>

**File**: `agent/internal/daemon/daemon.go` (modified, +28/-6)
```diff
@@ -73,21 +73,15 @@ type Daemon struct {
 // New creates an idle daemon.
 func New() *Daemon {
 	runtimeExecutable, _ := os.Executable()
-	localCapability, capabilityProcess := loadLocalCapabilityAdapter(RuntimeDirectory())
 	d := &Daemon{
 		instances:           make(map[string]*residentInstance),
 		closed:              make(chan struct{}),
 		voiceGate:           voice.NewGate(),
 		hostLog:             NewBoundedLog(RuntimeDirectory()),
 		transcriptProducers: NewTranscriptProducerCoordinator(),
-		localCapability:     localCapability,
-		capabilityProcess:   capabilityProcess,
 		runtimeExecutable:   runtimeExecutable,
 	}
 	d.capabilityHandler = &daemonCapabilityController{daemon: d}
-	if capabilityProcess != nil {
-		d.watchCapabilityProcess(capabilityProcess)
-	}
 	return d
 }
 
@@ -98,9 +92,23 @@ func (d *Daemon) Run() error {
 	if err := os.MkdirAll(dir, 0o700); err != nil {
 		return err
 	}
+	release, err := lockDaemon(dir)
+	if err != nil {
+		if errors.Is(err, ErrDaemonAlreadyRunning) {
+			fmt.Fprintf(os.Stderr, "daemon_lock_refused pid=%d ppid=%d version=%s\n", os.Getpid(), os.Getppid(), doctor.Version)
+		}
+		return err
+	}
+	d.hostLog.Appendf("daemon_lock_acquired pid=%d version=%s", os.Getpid(), doctor.Version)
+	d.hostLog.Appendf("daemon_start pid=%d ppid=%d version=%s", os.Getpid(), os.Getppid(), doctor.Version)
+	defer func() {
+		d.hostLog.Appendf("daemon_stop pid=%d version=%s", os.Getpid(), doctor.Version)
+		release()
+	}()
 	if err := os.Chmod(dir, 0o700); err != nil {
 		return err
 	}
+	d.restoreLocalCapabilityAdapter(dir)
 	if err := d.prepareRuntimeExecutable(dir); err != nil {
 		return err
 	}
@@ -150,6 +158,20 @@ func (d *Daemon) Run() error {
 	return nil
 }
 
+// restoreLocalCapabilityAdapter must run only after this process owns the
+// RuntimeDirectory singleton lock, because constructing the Adapter starts a
+// child process from persisted local registration.
+func (d *Daemon) restoreLocalCapabilityAdapter(runtimeDir string) {
+	localCapability, capabilityProcess := loadLocalCapabilityAdapter(runtimeDir)
+	d.mu.Lock()
+	d.localCapability = localCapability
+	d.capabilityProcess = capabilityProcess
+	d.mu.Unlock()
+	if capabilityProcess != nil {
+		d.watchCapabilityProcess(capabilityProcess)
+	}
+}
+
 // serve handles exactly one newline-delimited request per connection,
 // mirroring the Node IPC contract ({ok,result}|{ok,error} on one line).
 func (d *Daemon) serve(conn net.Conn) {
```

**File**: `agent/internal/daemon/daemon_lock_other.go` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+//go:build !darwin && !linux
+
+package daemon
+
+import "errors"
+
+var ErrDaemonAlreadyRunning = errors.New("another daemon is already running")
+
+func lockDaemon(string) (func(), error) {
+	return nil, errors.New("daemon singleton locking is unsupported on this platform")
+}
```

**File**: `agent/internal/daemon/daemon_lock_unix.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+//go:build darwin || linux
+
+package daemon
+
+import (
+	"errors"
+	"fmt"
+	"os"
+	"path/filepath"
+	"syscall"
+	"time"
+)
+
+const (
+	daemonLockRetryWindow   = 750 * time.Millisecond
+	daemonLockRetryInterval = 10 * time.Millisecond
+)
+
+// ErrDaemonAlreadyRunning means another process owns this RuntimeDirectory.
+var ErrDaemonAlreadyRunning = errors.New("another daemon is already running")
+
+// lockDaemon retries short stop/restart contention, then fails closed if a
+// different daemon continues to own the RuntimeDirectory.
+func lockDaemon(dir string) (func(), error) {
+	return lockDaemonWithRetry(dir, daemonLockRetryWindow, time.Sleep)
+}
+
+func lockDaemonWithRetry(dir string, retryWindow time.Duration, pause func(time.Duration)) (func(), error) {
+	file, err := os.OpenFile(filepath.Join(dir, "daemon.lock"), os.O_CREATE|os.O_RDWR, 0o600)
+	if err != nil {
+		return nil, fmt.Errorf("daemon lock open failed: %w", err)
+	}
+	deadline := time.Now().Add(retryWindow)
+	for {
+		err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
+		if err == nil {
+			return func() {
+				_ = syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
+				_ = file.Close()
+			}, nil
+		}
+		if !errors.Is(err, syscall.EWOULDBLOCK) && !errors.Is(err, syscall.EAGAIN) {
+			_ = file.Close()
+			return nil, fmt.Errorf("daemon lock failed: %w", err)
+		}
+		remaining := time.Until(deadline)
+		if remaining <= 0 {
+			_ = file.Close()
+			return nil, ErrDaemonAlreadyRunning
+		}
+		interval := daemonLockRetryInterval
+		if interval > remaining {
+			interval = remaining
+		}
+		pause(interval)
+	}
+}
```

**File**: `agent/internal/daemon/daemon_lock_unix_test.go` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+//go:build darwin || linux
+
+package daemon
+
+import (
+	"os"
+	"testing"
+	"time"
+)
+
+func TestDaemonLockRetriesTransientContention(t *testing.T) {
+	dir, err := os.MkdirTemp("/tmp", "fcagent-lock-retry-")
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer os.RemoveAll(dir)
+
+	releaseOwner, err := lockDaemon(dir)
+	if err != nil {
+		t.Fatalf("initial owner failed to acquire lock: %v", err)
+	}
+	firstRetry := make(chan struct{}, 1)
+	continueRetry := make(chan struct{})
+	type lockResult struct {
+		release func()
+		err     error
+	}
+	result := make(chan lockResult, 1)
+	go func() {
+		release, err := lockDaemonWithRetry(dir, time.Second, func(time.Duration) {
+			select {
+			case firstRetry <- struct{}{}:
+			default:
+			}
+			<-continueRetry
+		})
+		result <- lockResult{release: release, err: err}
+	}()
+
+	select {
+	case <-firstRetry:
+	case <-time.After(time.Second):
+		releaseOwner()
+		close(continueRetry)
+		select {
+		case got := <-result:
+			if got.release != nil {
+				got.release()
+			}
+		case <-time.After(time.Second):
+		}
+		t.Fatal("contending lock attempt did not reach its retry wait")
+	}
+	releaseOwner()
+	close(continueRetry)
+	select {
+	case got := <-result:
+		if got.err != nil {
+			t.Fatalf("transient contention prevented replacement ownership: %v", got.err)
+		}
+		got.release()
+	case <-time.After(2 * time.Second):
+		t.Fatal("replacement lock did not acquire after the owner released it")
+	}
+}
```

**File**: `agent/internal/daemon/daemon_test.go` (modified, +166/-0)
```diff
@@ -270,6 +270,172 @@ func startDaemonWithExecutable(t *testing.T, executable string) (*Daemon, string
 	return d, dir
 }
 
+func TestDaemonSingletonProtectsLiveRuntimeState(t *testing.T) {
+	dir, err := os.MkdirTemp("/tmp", "fcagent-singleton-")
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer os.RemoveAll(dir)
+	t.Setenv("FREE4CHAT_AGENT_DIR", dir)
+	t.Setenv("FREE4CHAT_TEST_DISABLE_NATIVE_CREDENTIAL_STORE", "1")
+
+	// A persisted Adapter that never completes its handshake makes process
+	// startup observable without depending on a real provider or Harness.
+	starts := filepath.Join(dir, "adapter-starts")
+	helper := filepath.Join(dir, "adapter-helper.sh")
+	script := "#!/bin/sh\nprintf 'started\\n' >> '" + starts + "'\nsleep 30\n"
+	if err := os.WriteFile(helper, []byte(script), 0o700); err != nil {
+		t.Fatal(err)
+	}
+	if err := capability.SaveRegistration(dir, capability.Registration{Command: "/bin/sh", Args: []string{helper}}); err != nil {
+		t.Fatal(err)
+	}
+	adapterStarts := func() int {
+		data, _ := os.ReadFile(starts)
+		if len(data) == 0 {
+			return 0
+		}
+		return strings.Count(string(data), "started\n")
+	}
+
+	daemonA := New()
+	doneA := make(chan error, 1)
+	t.Cleanup(func() { daemonA.stopAll() })
+	go func() { doneA <- daemonA.Run() }()
+	select {
+	case runErr := <-doneA:
+		t.Fatalf("daemon A exited during startup: %v", runErr)
+	case <-time.After(200 * time.Millisecond):
+	}
+	waitForSocketUp(t, SocketPath(), 5*time.Second)
+	workspace := filepath.Join(WorkspacesRoot(), "live-resident")
+	if err := os.MkdirAll(workspace, 0o700); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.WriteFile(filepath.Join(workspace, "sentinel"), []byte("owned by daemon A"), 0o600); err != nil {
+		t.Fatal(err)
+	}
+	if got := adapterStarts(); got != 1 {
+		t.Fatalf("daemon A should restore one persisted Adapter, got %d starts", got)
+	}
+	originalSocket, err := os.Stat(SocketPath())
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	daemonB := New()
+	doneB := make(chan error, 1)
+	t.Cleanup(func() { daemonB.stopAll() })
+	go func() { doneB <- daemonB.Run() }()
+	select {
+	case err := <-doneB:
+		if err == nil || !strings.Contains(err.Error(), "already running") {
+			t.Fatalf("second daemon should fail closed with singleton error, got %v", err)
+		}
+	case <-time.After(300 * time.Millisecond):
+		_, workspaceErr := os.Stat(filepath.Join(workspace, "sentinel"))
+		currentSocket, socketErr := os.Stat(SocketPath())
+		_, ipcErr := SendIPC(&IpcRequest{Op: "status"})
+		if os.IsNotExist(workspaceErr) || socketErr != nil || !os.SameFile(originalSocket, currentSocket) || ipcErr != nil || adapterStarts() != 1 {
+			t.Fatalf("competing daemon mutated live owner state: workspace_removed=%t socket_replaced=%t canonical_ipc_reachable=%t adapter_starts=%d", os.IsNotExist(workspaceErr), socketErr == nil && !os.SameFile(originalSocket, currentSocket), ipcErr == nil, adapterStarts())
+		}
+		select {
+		case err := <-doneB:
+			if err == nil || !strings.Contains(err.Error(), "already running") {
+				t.Fatalf("second daemon should fail closed after bounded contention, got %v", err)
+			}
+		case <-time.After(2 * time.Second):
+			t.Fatal("second daemon did not fail after bounded lock contention")
+		}
+	}
+
+	if _, err := os.Stat(filepath.Join(workspace, "sentinel")); err != nil {
+		t.Fatalf("second daemon removed daemon A's live workspace: %v", err)
+	}
+	if currentSocket, err := os.Stat(SocketPath()); err != nil || !os.SameFile(originalSocket, currentSocket) {
+		t.Fatalf("second daemon replaced daemon A's canonical socket (stat err %v)", err)
+	}
+	if got := adapterStarts(); got != 1 {
+		t.Fatalf("losing daemon started a duplicate persisted Adapter: starts=%d", got)
+	}
+	if _, err := SendIPC(&IpcRequest{Op: "status"}); err != nil {
+		t.Fatalf("daemon A became unreachable through canonical socket: %v", err)
+	}
+
+	daemonA.stopAll()
+	select {
+	case <-doneA:
+	case <-time.After(2 * time.Second):
+		t.Fatal("daemon A did not stop")
+	}
+	stale := filepath.Join(WorkspacesRoot(), "stale-after-stop")
+	if err := os.MkdirAll(stale, 0o700); err != nil {
+		t.Fatal(err)
+	}
+	daemonC := New()
+	doneC := make(chan error, 1)
+	t.Cleanup(func() { daemonC.stopAll() })
+	go func() { doneC <- daemonC.Run() }()
+	waitForSocketUp(t, SocketPath(), 5*time.Second)
+	if _, err := os.Stat(stale); !os.IsNotExist(err) {
+		daemonC.stopAll()
+		t.Fatalf("later daemon did not clean stale workspaces after ownership release: %v", err)
+	}
+	daemonC.stopAll()
+	select {
+	case <-doneC:
+	case <-time.After(2 * time.Second):
+		t.Fatal("daemon C did not stop")
+	}
+}
+
+func TestDaemonStopThenImmediateRestart(t *testing.T) {
+	dir, err := os.MkdirTemp("/tmp", "fcagent-restart-")
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer os.RemoveAll(dir)
+	t.Setenv("FREE4CHAT_AGENT_DIR", dir)
+	t.Setenv("FREE4CHAT_TEST_DISABLE_NATIVE_CREDENTIAL_STORE", "1")
+
+	daemonA := New()
+	doneA := make(chan error, 1)
+	t.Cleanup(func() { daemonA.stopAll() })
+	go func() {
```

---

### Incident Patch 13: `4714b468` (2026-09-30)
**Commit Message**: Merge pull request #533 from i365dev/codex/fix-generated-app-state-unsubscribe

fix(app): return void from generated app cleanup

**File**: `app/src/hooks/useSfuChatRoom.ts` (modified, +3/-1)
```diff
@@ -4334,7 +4334,9 @@ export function useSfuChatRoom(
       }) => void
     ) => {
       generatedAppStateListenersRef.current.add(listener)
-      return () => generatedAppStateListenersRef.current.delete(listener)
+      return () => {
+        generatedAppStateListenersRef.current.delete(listener)
+      }
     },
     []
   )
```

---

### Incident Patch 14: `90c0710b` (2026-09-30)
**Commit Message**: fix(app): return void from generated app cleanup

**File**: `app/src/hooks/useSfuChatRoom.ts` (modified, +3/-1)
```diff
@@ -4334,7 +4334,9 @@ export function useSfuChatRoom(
       }) => void
     ) => {
       generatedAppStateListenersRef.current.add(listener)
-      return () => generatedAppStateListenersRef.current.delete(listener)
+      return () => {
+        generatedAppStateListenersRef.current.delete(listener)
+      }
     },
     []
   )
```

---

### Incident Patch 15: `69433b68` (2026-09-30)
**Commit Message**: Merge pull request #532 from i365dev/codex/fix-weightedrand-table

fix(app): type weighted random table

**File**: `app/src/common/utils.tsx` (modified, +2/-2)
```diff
@@ -30,10 +30,10 @@ export const nameToColor = (name: string) => {
   return [r % 256, g % 256, b % 256]
 }
 
-export const weightedRand = (spec) => {
+export const weightedRand = (spec: Record<string, number>) => {
   var i,
     j,
-    table = []
+    table: string[] = []
   for (i in spec) {
     // The constant 10 below should be computed based on the
     // weights in the spec for a correct and optimal table size.
```

#### Recent Merged Pull Requests:
- **PR #571** (2026-10-04): docs(agent): activate runtime v0.5.53 bootstrap (@madawei2699)
- **PR #570** (2026-10-04): chore(agent): prepare runtime v0.5.53 (@madawei2699)
- **PR #569** (2026-10-04): fix(task): dedupe native controls and carry long briefs into sessions (@madawei2699)
- **PR #566** (2026-10-04): docs(agent): explain shared Room App artifacts (@madawei2699)
- **PR #565** (2026-10-04): fix(room-apps): allow downloads in curated app frames (@madawei2699)
- **PR #564** (2026-10-04): [codex] feat(room-app): add bounded host-owned session recovery snapshot (@madawei2699)
- **PR #562** (2026-10-03): fix(agent): route curated Room App requests across replicas (@madawei2699)
- **PR #560** (2026-10-03): product(discovery): add scenario-oriented use cases (@madawei2699)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

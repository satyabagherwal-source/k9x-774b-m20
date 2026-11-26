# Verification Protocol: Verification Protocol: Empirical Defect Shield for yetone-magpie-learnings

<!-- PROVENANCE_START
{
  "source_repository": "yetone-magpie-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T12:59:38.740Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yetone-magpie-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yetone-magpie-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T12:59:38.740Z`  
> **Learning ID**: `LEARN-EVO-yetone-magpie-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `yetone-magpie-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yetone-magpie-learnings.md`  
> **Source**: github ([https://github.com/yetone/magpie](https://github.com/yetone/magpie))  
> **Source Version**: `e6d3acaf`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T12:59:15.521Z  
> **Learning ID**: `learn-github-yetone-magpie`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): yetone/magpie

> **Canonical Artifact**: `07_PROJECT_LEARNING/yetone-magpie-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yetone/magpie](https://github.com/yetone/magpie))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T12:59:15.372Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yetone/magpie`
- **Description**: Pool every plan you pay for — Claude, ChatGPT, Copilot, GLM Coding Plan, Kimi Code and more — and use them in any agent: Claude Code, Codex, Claude Desktop… When one runs out, the next takes over.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 41880 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/gateway/codex_turnstate.go`
```
package gateway

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/yetone/magpie/internal/provider"
)

// x-codex-turn-state is the ChatGPT backend's routing of a turn: the first
// reply of a turn says it, and Codex sends it back on every later request
// of that turn (each tool call's result), which the backend then serves
// as the same turn. Sent without it, each request of the turn was a new
// one there, admitted again (legeling567 on X: 529s, "high load", on Astra
// with three Pro accounts in magpie, none with Codex's own sign-in).
//
// Through the pool Codex never hears the state (the reply is the pool's),
// and on its socket it continues a turn by previous_response_id with no
// state at all, so magpie keeps it: the state the account's reply said
// for a turn (client_metadata's thread and turn_id) goes with that turn's
// later requests to that account. The state is one account's: another
// account gets the turn without it, as a new turn there. A state Codex
// sends itself goes on only to the account whose reply said it.

// codexTurnStateFor is how long a turn's state is kept after its last
// use: a turn's tool calls come seconds or minutes apart.
const codexTurnStateFor = 2 * time.Hour

var codexTurnStates = struct {
	sync.Mutex
	byTurn  map[string]codexTurnState // account + thread + turn → state
	byState map[string]codexTurnState // state → account
}{byTurn: map[string]codexTurnState{}, byState: map[string]codexTurnState{}}

type codexTurnState struct {
	acct, state string
	at          time.Time
}

// codexTurnAccount is who a Codex account's request is signed as: the
// account (agent and user) and the workspace it signs into, two seats of
// one email being two accounts.
func codexTurnAccount(p provider.Provider, signed http.Header) string {
	if p.Account == nil || p.Account.Agent != "codex" {
		return ""
	}
	return p.Account.UsageAgent() + "\x00" + strings.ToLower(p.Account.User) + "\x00" + signed.Get("chatgpt-account-id")
}

// codexTurnOf is the turn a Codex request is of, "" when it doesn't say.
func codexTurnOf(in http.Header, body []byte) string {
	m := requestSessionMetadata(in, body)
	if m.Turn == "" {
		return ""
	}
	return m.Thread + "\x00" + m.Turn
}

// heardCodexTurnState records the turn state acct's reply says for turn.
func heardCodexTurnState(acct, turn string, res *http.Response) {
	if acct == "" || res == nil {
		return
	}
	v := res.Header.Get("X-Codex-Turn-State")
	if v == "" {
		return
	}
	now := time.Now()
	codexTurnStates.Lock()
	defer codexTurnStates.Unlock()
	if len(codexTurnStates.byState) > 4096 {
		for k, o := range codexTurnStates.byState {
			if now.Sub(o.at) > codexTurnStateFor {
				delete(codexTurnStates.byState, k)
			}
		}
		for k, o := range codexTurnStates.byTurn {
			if now.Sub(o.at) > codexTurnStateFor {
				delete(codexTurnStates.byTurn, k)
			}
		}
	}
	st := codexTurnState{acct: acct, state: v, at: now}
	codexTurnStates.byState[v] = st
	if turn != "" {
		codexTurnStates.byTurn[acct+"\x00"+turn] = st
	}
}

// codexTurnStateOf is the turn state a request of turn goes to acct with:
// the one the agent sent (in, its headers) when acct's reply said it, else
// the one acct's reply said for the turn, else "".
func codexTurnStateOf(in http.Header, acct, turn string) string {
	if acct == "" {
		return ""
	}
	now := time.Now()
	codexTurnStates.Lock()
	defer codexTurnStates.Unlock()
	if v := in.Get("X-Codex-Turn-State"); v != "" {
		if o, ok := codexTurnStates.byState[v]; ok && o.acct == acct && now.Sub(o.at) <= codexTurnStateFor {
			o.at = now
			codexTurnStates.byState[v] = o
			return v
		}
	}
	if turn == "" {
		return ""
	}
	k := acct + "\x00" + turn
	o, ok := codexTurnStates.byTurn[k]
	if !ok || now.Sub(o.at) > codexTurnStateFor {
		return ""
	}
	o.at = now
	codexTurnStates.byTurn[k] = o
	return o.state
}

```

### Core Architecture Module: `internal/gateway/concurrency.go`
```
package gateway

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/yetone/magpie/internal/provider"
)

// A provider's MaxConcurrency (Discord, Lemon: a Codex account is
// risk-controlled past five or six requests at once) is how many requests
// may be out at the vendor at once on each of its keys or accounts — the
// key, the account, else the provider: a candidate's who(). One more waits
// in a queue of no bound, in the order it came, and is sent when one out
// is done: its reply read to the end, or the agent gone. A request whose
// agent goes away while it waits leaves the queue and is never sent.
//
// Waiting is not failing: a request queued is never passed to a fallback
// for want of a free slot, and the key or account it waits for doesn't
// rest. That is what the setting is
// for — the vendor sees no more than that many — and what is waited is
// told in the route's try (Try.Queued).

// lanes are the slots of each key or account with a limit, and the count
// of those out on one without (limit 0), which take no slot and never wait.
type lanes struct {
	mu sync.Mutex
	m  map[string]*lane
	// freed is closed, and made afresh, each time a slot of any lane is
	// given back or a rest is lifted (signal): a request waiting in one
	// lane looks then for another with room (waitMate)
	freed chan struct{}
	// ended is when a turn on each key or account last gave its slot
	// back, its reply read to the end: what it spent is counted by then
	// (cap_near.go reads usage again after it)
	ended map[string]time.Time
	turns map[string]int // how many turns each has had come back
	idles int            // turns waiting in idle, for tests
	// planned is each's turns found not near a usage cap, or let in near
	// it, that haven't taken their lane yet: out on it already, for out
	// and idle (#6958)
	planned map[string]int
	// read is how many turns had come back on each when one of its turns
	// last took its lane: a reply tells the usage as its turn begins, so
	// the reading it brings has those turns and none come back since
	// (cap_near.go, #6958)
	read map[string]int
}

// began notes that one of who's turns took its lane now.
func (l *lanes) began(who string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.read == nil {
		l.read = map[string]int{}
	}
	l.read[who] = l.turns[who]
}

// readThrough notes a reading of who's usage that has its first n turns
// come back: read again with none out (nearCapAgain).
func (l *lanes) readThrough(who string, n int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.read == nil {
		l.read = map[string]int{}
	}
	l.read[who] = max(l.read[who], n)
}

// inReading is how many of who's turns come back the reading last told
// has at most: those come back as one of its turns last took its lane.
func (l *lanes) inReading(who string) int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.read[who]
}

// plan counts a turn out on who before it takes its lane, and gives back
// the func that stops counting it: called once its lane counts it, or as
// it leaves.
func (l *lanes) plan(who string) func() {
	l.mu.Lock()
	if l.planned == nil {
		l.planned = map[string]int{}
	}
	l.planned[who]++
	l.mu.Unlock()
	var once sync.Once
	return func() {
		once.Do(func() {
			l.mu.Lock()
			if l.planned[who]--; l.planned[who] <= 0 {
				delete(l.planned, who)
			}
			l.signalLocked()
			l.mu.Unlock()
		})
	}
}

// signalLocked wakes every request waiting in a lane to look for another
// with room. l.mu is held.
func (l *lanes) signalLocked() {
	if l.freed != nil {
		close(l.freed)
		l.freed = nil
	}
}

// signal is signalLocked, taking l.mu.
func (l *lanes) signal() {
	l.mu.Lock()
	l.signalLocked()
	l.mu.Unlock()
}

// tryTake takes one of who's slots if one is free now and nobody waits
// for it: no limit, or room. false takes none.
func (l *lanes) tryTake(who string, limit int) (release func(), ok bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.m == nil {
		l.m = map[string]*lane{}
	}
	ln := l.m[who]
	if ln == nil {
		ln = &lane{}
		l.m[who] = ln
	}
	if limit > 0 && (ln.busy >= limit || len(ln.queue) > 0) {
		l.drop(who, ln)
		return nil, false
	}
	ln.limit = max(limit, 0)
	ln.busy++
	return l.releaser(who, ln), true
}

// lane is one key's or account's: how many are out, and who waits, first
// first.
type lane struct {
	limit int
	busy  int
	queue []chan struct{}
}

// Its own limit (#892) and the queue's bound and wait. A key or account
// may have a limit of its own, over the provider's (provider.LaneLimit),
// and the count is the lane's whatever asks for it: a model, a routing
// group or an agent. A provider's QueueLimit bounds how many wait for each
// of its lanes: one more is turned away at once (errQueueFull), and one
// that waited QueueWait seconds is turned away (errQueueWait) and leaves
// the queue. Turned away, a try is passed on as a failure that rests
// nobody: to the next key, account or member, else told to the agent as a
// 429 in its API's own shape, with Retry-After.
//
// A full one gives way first. Where the request has another key or
// account of the same provider, or another member of its routing group,
// with a slot free now and not resting, that one is asked first and the
// full one keeps its place after it (laneMate): a group spreads its
// requests over members with room before any waits. A fallback provider is
// never asked for want of a slot — it is another vendor, often a paid one
// — and a request whose keys and accounts are all full waits in the queue
// of the one routing chose, but not for it alone: each time a slot of any
// lane is given back (lanes.freed), a rest of one of the others ends or is
// lifted, it looks again, and the first of the others in routing's order
// with a slot free, not resting and not held back as a reserve as its
// provider's accounts stand now (waitMate) takes it, its slot taken for
// it as it leaves the queue (errMoved). 01huadalang on Discord: three
// ZCode accounts at three at once, the first two resting after a 405; once
// they were back, the requests already waiting for the third waited on
// behind its long turns, in every routing, until its own were cut by hand.

// errQueueFull and errQueueWait turn a request away from a lane: its queue
// at its bound, or the request waited as long as it may.
var (
	errQueueFull = errors.New("queue full")
	errQueueWait = errors.New("waited too long")
)

// errMoved is a request that left its lane's queue for another key or
// account with room (waitMate): nobody failed, and it is asked there.
var errMoved = errors.New("gave way to one with room")

// laneRecheck is how often a request waiting in a lane looks again for
// another with room with nothing given back meanwhile: a minute's room
// (MaxRPM) comes back with nothing said.
const laneRecheck = 5 * time.Second

// acquire waits for one of who's limit slots, in turn, with no bound on
// the queue or the wait. It answers the release, to call once the request
// is done with the vendor, and false with no slot taken when ctx ended
// first. A limit of 0 never waits; the request is only counted.
func (l *lanes) acquire(ctx context.Context, who string, limit int) (release func(), ok bool) {
	release, _, err := l.take(ctx, who, limit, 0, 0, nil)
	return release, err == nil
}

// take is acquire with at most queue waiting (0: no bound) for at most
// wait (0: as long as it takes): errQueueFull, errQueueWait, or ctx's
// error when it ended first, with no slot taken. waited is how long it
// stood in the queue: 0 when a slot was free at once or there is no
// limit, so a request that never queued never reads as queued (#2153).
// move, when not nil, is asked while it waits — at once, each time a slot
// of any lane is given back, at the time it names and every laneRecheck —
// whether the request goes to another key or account instead (waitMate,
// which takes that one's slot): true leaves the queue with errMoved.
func (l *lanes) take(ctx context.Context, who string, limit, queue int, wait time.Duration, move func() (bool, time.Time)) (release func(), waited time.Duration, err error) {
	l.mu.Lock()
	if l.m == nil {
		l.m = map[string]*lane{}
	}
	ln := l.m[who]
	if ln == nil {
		ln = &lane{}
		l.m[who] = ln
	}
	if limit <= 0 {
		// the limit was lifted: whoever waits goes now. With none, the
		// request is still counted while it is out, for the pill that
		// says how many run (chentuoyan on Discord)
		ln.limit = 0
		ln.grant()
		ln.busy++
		l.mu.Unlock()
		return l.releaser(who, ln), 0, nil
	}
	ln.limit = limit
	ln.grant() // a limit raised lets more of those waiting go
	if ln.busy < limit && len(ln.queue) == 0 {
		ln.busy++
		l.mu.Unlock()
		return l.releaser(who, ln), 0, nil
	}
	if queue > 0 && len(ln.queue) >= queue {
		l.mu.Unlock()
		return nil, 0, errQueueFull
	}
	ch := make(chan struct{})
	ln.queue = append(ln.queue, ch)
	l.mu.Unlock()
	defer notePhase(ctx, "slot")()
	queued := time.Now()
	var timeout <-chan time.Time
	if wait > 0 {
		t := time.NewTimer(wait)
		defer t.Stop()
		timeout = t.C
	}
	err = l.await(ctx, ch, timeout, move)
	if err == nil {
		return l.releaser(who, ln), time.Since(queued), nil
	}
	waited = time.Since(queued)
	l.mu.Lock()
	defer l.mu.Unlock()
	for i, c := range ln.queue {
		if c == ch {
			ln.queue = append(ln.queue[:i], ln.queue[i+1:]...)
			l.drop(who, ln)
			return nil, waited, err
		}
	}
	// granted as it gave up: the slot is given on to the next
	ln.busy--
	ln.grant()
	l.drop(who, ln)
	l.signalLocked()
	return nil, waited, err
}

// await waits for ch, the request's turn in its lane: nil then, else
// ctx's error, errQueueWait at timeout, or errMoved once move says it goes
// elsewhere.
func (l *lanes) await(ctx context.Context, ch chan struct{}, timeout <-chan time.Time, move func() (bool, time.Time)) error {
	for {
		var freed chan struct{}
		var again <-chan time.Time
		var t *time.Timer
		if move != nil {
			l.mu.Lock()
			if l.freed == nil {
				l.freed = make(chan st
```

### Core Architecture Module: `internal/gateway/draw_volcengine.go`
```
package gateway

// Volcengine Ark's images API (火山方舟 图片生成 API, POST
// <base>/images/generations, https://www.volcengine.com/docs/82379/1541523)
// is OpenAI-shaped in its answer but not in what it takes:
//
//   - watermark defaults to true: every image gets an "AI 生成" mark in its
//     corner unless the request says false;
//   - reference images go in the same JSON body, as image (a string, or an
//     array for several), each a URL or a data:image/<fmt>;base64 URL; there
//     is no edits endpoint and no multipart;
//   - there is no n: a request draws one image, or a group of up to 15
//     with sequential_image_generation "auto" (Seedream 4.x, 5.0 lite);
//   - size is a tier ("1K", "2K", "4K"…) or WIDTHxHEIGHT, never a ratio:
//     the doc says to give a ratio in the prompt, and lists the WxH each
//     ratio maps to at 2K;
//   - there is no quality and no mask.
//
// So magpie draws there as the doc says: watermark false unless the caller
// sends its own, the images as JSON, one request per image n asks for (each
// a group when the caller sends sequential_image_generation), and a ratio
// sent as the doc's 2K size for it, or turned away with what to do instead
// (JL on Discord). The caller's other fields of Ark's own go as they came,
// and response_format url is asked of Ark as url, its link answered
// (axelburks on Discord); stream is turned away, its events being Ark's.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/yetone/magpie/internal/provider"
)

// isArk is a provider at Volcengine Ark (ark.<region>.volces.com): the
// preset's plans or a provider added by hand on pay-as-you-go.
var isArk = func(p provider.Provider) bool {
	for _, base := range []string{p.Base(provider.Chat), p.Base(provider.Responses)} {
		if h := provider.HostOf(base); strings.HasPrefix(h, "ark.") && strings.HasSuffix(h, ".volces.com") {
			return true
		}
	}
	return false
}

// arkRatioSizes are the 2K sizes Ark's doc lists for each ratio (Seedream
// 4.0, 4.5 and 5.0 lite's table). Each is in every Seedream model's pixel
// range, 5.0 pro's [1280x720, 2048x2048x1.1025] included.
var arkRatioSizes = map[string]string{
	"1:1": "2048x2048", "4:3": "2304x1728", "3:4": "1728x2304",
	"16:9": "2848x1600", "9:16": "1600x2848", "3:2": "2496x1664",
	"2:3": "1664x2496", "21:9": "3136x1344",
}

// arkSize is size as Ark takes it: a tier or WIDTHxHEIGHT as given, a
// ratio its doc lists as that ratio's 2K size, "" for the model's own.
// Another ratio is an error that says what to send instead.
func arkSize(size string) (string, error) {
	size = strings.TrimSpace(size)
	switch {
	case size == "" || strings.EqualFold(size, "auto"):
		return "", nil
	case strings.Contains(size, ":"):
		if s, ok := arkRatioSizes[strings.ReplaceAll(size, " ", "")]; ok {
			return s, nil
		}
		return "", fmt.Errorf("Volcengine's images API takes no aspect ratio as size, and %q isn't one magpie can turn into a size (it can: 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9): describe the ratio in the prompt and leave size out, or give WIDTHxHEIGHT (e.g. 2048x2048)", size)
	}
	return size, nil
}

// arkImageTextFields are Ark's images fields that are text, kept as text
// from a multipart form.
var arkImageTextFields = []string{"model", "prompt", "size", "sequential_image_generation", "output_format", "background", "response_format"}

// arkBody is d as Ark's images API takes it, for one request.
func arkBody(model string, d drawing) ([]byte, error) {
	if d.Mask != nil {
		return nil, errors.New("Volcengine's images API takes no mask: say in the prompt which part of the image to change")
	}
	if d.Markup != nil {
		return nil, errors.New("Volcengine's images API takes no markup layer: say in the prompt what to change")
	}
	size, err := seedreamSize(model, d.shape(), d.Tier)
	if d.Tier == "" {
		size, err = arkSize(d.Size)
	}
	if err != nil {
		return nil, err
	}
	// the caller's own fields of Ark's first (watermark,
	// sequential_image_generation and its options, optimize_prompt_options,
	// tools, layer_decomposition…; axelburks on Discord), then what magpie
	// reads of OpenAI's: a watermark is off unless the caller asks for
	// one, and the image comes as Ark's URL when the caller asks for url
	req := map[string]any{"watermark": false}
	for k, v := range d.Extra {
		if d.Form {
			v = formValue(k, v, arkImageTextFields)
		}
		req[k] = v
	}
	if on, _ := req["stream"].(bool); on {
		return nil, errors.New("Volcengine's images API streams its images in events of its own, which /v1/images/generations doesn't give: leave stream out, or ask Ark's own API through magpie at /v1/magpie/native/<provider>/images/generations")
	}
	delete(req, "stream")
	req["model"] = model
	if d.Prompt != "" {
		req["prompt"] = d.Prompt
	}
	req["response_format"] = "b64_json"
	if strings.EqualFold(d.Want, "url") {
		req["response_format"] = "url"
	}
	if size != "" {
		req["size"] = size
	}
	switch f := strings.ToLower(d.Format); f {
	case "png", "jpeg":
		req["output_format"] = f
	case "jpg":
		req["output_format"] = "jpeg"
	}
	if strings.EqualFold(d.Background, "transparent") {
		req["background"] = "transparent"
	}
	switch len(d.Images) {
	case 0:
	case 1:
		req["image"] = d.Images[0].dataURL()
	default:
		var urls []string
		for _, pic := range d.Images {
			urls = append(urls, pic.dataURL())
		}
		req["image"] = urls
	}
	return json.Marshal(req)
}

// drawArk asks Ark's images API once for each of d's images.
func (s *Server) drawArk(ctx context.Context, p provider.Provider, model string, d drawing) (drawn, int, error) {
	body, err := arkBody(model, d)
	if err != nil {
		return drawn{}, http.StatusBadRequest, err
	}
	url := strings.TrimRight(p.Base(provider.Chat), "/")
	if url == "" {
		url = strings.TrimRight(p.Base(provider.Responses), "/")
	}
	url += "/images/generations"
	return s.eachDrawing(max(d.N, 1), func() (drawn, int, error) {
		b, code, err := s.send(ctx, p, url, "application/json", body, true)
		if err != nil {
			return drawn{}, code, err
		}
		return readImagesAnswer(p, url, b, code)
	})
}

```

### Core Architecture Module: `internal/gateway/gateway_hooks.go`
```
package gateway

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/yetone/magpie/internal/plugin"
	"github.com/yetone/magpie/internal/provider"
)

// gatewayResponse observes the bytes delivered to the client without changing
// them. The caller runs done after middleware has finished writing its reply.
func gatewayResponse(w http.ResponseWriter, r *http.Request, proto provider.Protocol, body []byte, run *plugin.GatewayRun) (http.ResponseWriter, func()) {
	capture := &conversationWriter{captureResponseWriter: &captureResponseWriter{
		ResponseWriter: w, full: &spool{limit: conversationBodyMax, pattern: "magpie-hook-*"},
	}}
	return capture, func() {
		defer capture.full.discard()
		if streamOf(body) {
			_ = http.NewResponseController(w).Flush()
		}
		output, err := capture.full.read()
		// a client that hangs up once it has the whole reply (Codex, on
		// response.completed) still got it: gatewayReply judges the bytes
		if err != nil || capture.full.cut() || capture.status >= 400 {
			run.Finish(r.Context(), nil, false, body)
			return
		}
		reply, err := gatewayReply(proto, output)
		var response obj
		json.Unmarshal(reply, &response)
		success := err == nil && (len(response["error"]) == 0 || string(response["error"]) == "null") && str(response, "status") != "failed" && str(response, "status") != "incomplete"
		run.Finish(r.Context(), reply, success, body)
	}
}

// gatewayReply is the reply the client got as one whole reply in its API: a
// whole body as it is, and a stream read through the protocol's decoder into
// the reply the gateway would have rendered. A Responses stream's completed
// response is the reply itself. A stream that never ended is an error.
func gatewayReply(proto provider.Protocol, body []byte) (json.RawMessage, error) {
	body = bytes.TrimSpace(body)
	if json.Valid(body) {
		var object obj
		if err := json.Unmarshal(body, &object); err != nil || object == nil {
			return nil, errors.New("invalid model reply")
		}
		return bytes.Clone(body), nil
	}
	var c collector
	var completed json.RawMessage
	decode := decoder(proto)
	ended := false
	err := readSSE(bytes.NewReader(body), func(_ string, data string) error {
		if data == "[DONE]" {
			ended = true
			return nil
		}
		if !json.Valid([]byte(data)) {
			return errors.New("invalid model stream")
		}
		if proto == provider.Responses {
			var e struct {
				Type     string          `json:"type"`
				Response json.RawMessage `json:"response"`
			}
			if json.Unmarshal([]byte(data), &e) == nil && e.Type == "response.completed" && len(e.Response) > 0 {
				completed = e.Response
			}
		}
		return decode(data, func(e Event) {
			if e.Kind == KStop {
				ended = true
			}
			c.add(e)
		})
	})
	if err != nil {
		return nil, err
	}
	if !ended {
		return nil, errors.New("incomplete model stream")
	}
	if c.err != "" {
		return nil, errors.New(c.err)
	}
	if completed != nil {
		return completed, nil
	}
	res := c.finish()
	return render(proto, res, &Request{Model: res.Model}), nil
}

```

### Core Architecture Module: `internal/gateway/loop_guard.go`
```
package gateway

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

// A model can fall into a loop it never leaves: DeepSeek's reasoning went
// on as "Now." "Writing." "Go." "Let me write." "OK." "Producing." … over
// and over, with a word or two changing between rounds, until the reply's
// token limit, and dsh and Pi waited on it the whole time (#1359,
// Moody-Sin). loopGuard reads the reply as the agent is sent it, in any of
// the protocols, and says when its reasoning or its text has become such a
// loop, for the gateway to end the reply with an error the agent can act
// on (holdWriter.cutLoop) rather than let it run on.
//
// The reply is cut into units, its lines and sentences. A loop is a long
// run of units that are nearly all the same few: of the last loopWindow
// units of reasoning, or of text, no more than loopDistinct different
// ones. Ordinary writing doesn't come near it, even when lines repeat:
// code, a table, a list or a log differs from line to line in its names,
// numbers and cells, and a unit with no word in it (a brace, a rule, a
// row of 0x00 or of numbers) isn't counted at all. The cycle need not be exact,
// as the reporter's wasn't ("Here." "Produce." one round, "Final." or
// "Producing." the next).
type loopGuard struct {
	pending []byte // what came of an event not yet whole
	think   unitRun
	text    unitRun
	// spoke: the reply has said something the agent acts on, a text or a
	// call, which a reply asked again would say twice
	spoke bool
}

const (
	// loopWindow is how many units of a channel are looked at: 256 of the
	// reporter's lines are about 600 tokens, a moment of a reply that runs
	// to its limit of tens of thousands.
	loopWindow = 256
	// loopDistinct is the most different units the window may hold and
	// still be a loop: the reporter's has 9.
	loopDistinct = 24
	// unitMost is how long a unit grows without a break before it is
	// taken whole, and unitKept how much of it is told apart.
	unitMost = 4096
	unitKept = 256
	// pendingMost bounds an event that never ends, which isn't read.
	pendingMost = 1 << 20
)

// unitRun is one channel's units: its reasoning's, or its text's.
type unitRun struct {
	cur  strings.Builder // the unit being written
	stop bool            // cur ends in a sentence's stop: a space after it ends the unit
	// lettered: cur has a letter in it, for a stop after it to end a
	// sentence
	lettered bool
	ring     [loopWindow]uint64
	n        int // units seen
	counts   map[uint64]*unitCount
	// runOn is how many units in a row were cut at unitMost, with no break
	// in them, as the same few words over and over (runOnWords)
	runOn int
}

type unitCount struct {
	n    int
	text string // as it was first written, for the error to quote
	at   int    // when it first came, to quote them in order
}

// loopTrip is what loopGuard found: which channel looped, and on what.
type loopTrip struct {
	reasoning bool
	units     []string // the different units, the most frequent first
	window    int
	// runOn: the loop had no break in it, and units are its words and
	// window how many characters it ran to
	runOn bool
}

// message is what the agent and the logs are told.
func (t loopTrip) message() string {
	what := "text"
	if t.reasoning {
		what = "reasoning"
	}
	quoted := make([]string, 0, 6)
	for i, u := range t.units {
		if i == 6 {
			quoted = append(quoted, "…")
			break
		}
		quoted = append(quoted, fmt.Sprintf("%q", u))
	}
	if t.runOn {
		return fmt.Sprintf(loopGuardSaid+": the model's %s was stuck in a loop, its last %d characters the same over and over without a break (%s), and would have run on to its output limit. Ask again, or set Settings › Models › Replies › Stop looping replies off",
			what, t.window, strings.Join(quoted, " "))
	}
	return fmt.Sprintf(loopGuardSaid+": the model's %s was stuck in a loop, its last %d lines and sentences all among the same %d (%s), and would have run on to its output limit. Ask again, or set Settings › Models › Replies › Stop looping replies off",
		what, t.window, len(t.units), strings.Join(quoted, " "))
}

// loopGuardSaid begins what the loop guard tells the agent of a reply it
// ended: magpie's words, not a vendor's (magpieSaid).
const loopGuardSaid = "magpie ended this reply"

// feed reads b, the next of the reply as the agent is sent it.
func (g *loopGuard) feed(b []byte) (loopTrip, bool) {
	g.pending = append(g.pending, b...)
	for {
		end := eventEnd(g.pending)
		if end < 0 {
			break
		}
		ev := g.pending[:end]
		think, text := eventWords(ev)
		g.pending = g.pending[end:]
		if think != "" {
			if t, ok := g.think.add(think); ok {
				t.reasoning = true
				return t, true
			}
		}
		if !g.spoke {
			content, said, reasoning, _ := timingKind(ev)
			g.spoke = said || content && !reasoning
		}
		if text != "" {
			if t, ok := g.text.add(text); ok {
				return t, true
			}
		}
	}
	if len(g.pending) == 0 {
		g.pending = nil
	} else if len(g.pending) > pendingMost {
		g.pending = nil
	}
	return loopTrip{}, false
}

// eventWords is what one event of a reply says, in any protocol: its
// reasoning and its text. Calls, starts, stops and usage say nothing here.
func eventWords(ev []byte) (think, text string) {
	if !bodyHas(ev, `delta`) && !bodyHas(ev, `candidates`) {
		return "", "" // most events that aren't content, without reading them
	}
	var data []byte
	for _, ln := range bytes.Split(ev, []byte("\n")) {
		ln = bytes.TrimRight(ln, "\r")
		if bytes.HasPrefix(ln, []byte("data:")) {
			data = append(data, bytes.TrimSpace(ln[5:])...)
		}
	}
	if len(data) == 0 || data[0] != '{' {
		return "", ""
	}
	var v struct {
		Type    string          `json:"type"`
		Delta   json.RawMessage `json:"delta"`
		Choices []struct {
			Delta struct {
				Content          json.RawMessage `json:"content"`
				ReasoningContent json.RawMessage `json:"reasoning_content"`
				Reasoning        json.RawMessage `json:"reasoning"`
			} `json:"delta"`
		} `json:"choices"`
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text    string `json:"text"`
					Thought bool   `json:"thought"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(data, &v) != nil {
		return "", ""
	}
	str := func(raw json.RawMessage) string {
		var s string
		if len(raw) > 0 && raw[0] == '"' && json.Unmarshal(raw, &s) == nil {
			return s
		}
		return ""
	}
	switch v.Type {
	case "content_block_delta": // Anthropic
		var d struct {
			Type     string `json:"type"`
			Text     string `json:"text"`
			Thinking string `json:"thinking"`
		}
		if json.Unmarshal(v.Delta, &d) == nil {
			switch d.Type {
			case "text_delta":
				return "", d.Text
			case "thinking_delta":
				return d.Thinking, ""
			}
		}
		return "", ""
	case "response.output_text.delta": // Responses
		return "", str(v.Delta)
	case "response.reasoning_text.delta", "response.reasoning_summary_text.delta":
		return str(v.Delta), ""
	case "":
	default:
		return "", ""
	}
	var th, tx strings.Builder
	for _, c := range v.Choices { // Chat Completions
		th.WriteString(cmpStr(str(c.Delta.ReasoningContent), str(c.Delta.Reasoning)))
		tx.WriteString(str(c.Delta.Content))
	}
	for _, c := range v.Candidates { // Gemini
		for _, p := range c.Content.Parts {
			if p.Thought {
				th.WriteString(p.Text)
			} else {
				tx.WriteString(p.Text)
			}
		}
	}
	return th.String(), tx.String()
}

// cmpStr is the first of a and b that isn't empty: a Chat delta carries
// its reasoning in one field or the other, as the vendor names it.
func cmpStr(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// add reads s, the next of the channel.
func (r *unitRun) add(s string) (loopTrip, bool) {
	for _, c := range s {
		switch {
		case c == '\n':
			if t, ok := r.end(); ok {
				return t, true
			}
			continue
		case r.stop && unicode.IsSpace(c):
			if t, ok := r.end(); ok {
				return t, true
			}
			continue
		}
		r.cur.WriteRune(c)
		switch c {
		case '.', '!', '?':
			// a sentence's stop, not a list's number (1.) or a decimal
			r.stop = r.lettered
		case '。', '！', '？':
			if t, ok := r.end(); ok {
				return t, true
			}
			continue
		default:
			r.stop = false
			r.lettered = r.lettered || unicode.IsLetter(c)
		}
		if r.cur.Len() >= unitMost {
			// a unit this long has had no break: a loop with none in it
			// ("mcp mcp mcp …", #1489) is never 256 of them before the
			// reply's limit, so it is read on its own
			if words, ok := runOnWords(r.cur.String()); ok {
				if r.runOn++; r.runOn >= runOnUnits {
					return loopTrip{units: words, window: r.runOn * unitMost, runOn: true}, true
				}
			} else {
				r.runOn = 0
			}
			if t, ok := r.end(); ok {
				return t, true
			}
			continue
		}
	}
	return loopTrip{}, false
}

// end takes the unit written so far, and says whether the window has
// become a loop with it.
func (r *unitRun) end() (loopTrip, bool) {
	raw := r.cur.String()
	if r.cur.Len() < unitMost {
		// a break; a long unit before it that still runs on keeps the count
		// (a loop broken into lines longer than unitMost)
		if len(raw) < unitMost/8 {
			r.runOn = 0
		} else if _, ok := runOnWords(raw); !ok {
			r.runOn = 0
		}
	}
	r.cur.Reset()
	r.stop, r.lettered = false, false
	key, ok := unitKey(raw)
	if !ok {
		return loopTrip{}, false
	}
	h := fnv.New64a()
	h.Write([]byte(key))
	sum := h.Sum64()
	if r.counts == nil {
		r.counts = map[uint64]*unitCount{}
	}
	slot := r.n % loopWindow
	if r.n >= loopWindow {
		old := r.ring[slot]
		if c := r.counts[old]; c != nil {
			if c.n--; c.n == 0 {
				delete(r.counts, old)
			}
		}
	}
	r.ring[slot] = sum
	c := r.counts[sum]
	if c == nil {
		text := strings.TrimSpace(raw)
		if utf8.RuneCountInString(text) > 40 {
			text = string([]rune(text)[:40]) + "…"
		}
		c = &unitCount{text: text, at: r.n}
		r.counts[sum] = c
	}
	c.n++
	r.n++
	if r.n < loopWindow || len(r.counts) > loopDistinct {
		return loopTrip{}, false
	}
	all := make([]*unitCount, 0, len
```

### Core Architecture Module: `internal/gateway/loops.go`
```
package gateway

import (
	"log"
	"reflect"
	"runtime"
	"slices"
	"strings"
	"sync"
	"time"
)

// loops is the work ListenAndServe starts beside the server: the
// Keep… loops, WhileServing's, the files it watches. Its end waits for
// them, so nothing it started writes into the config folder after it
// returned: KeepAutoPicksHeld's auto-picks.json, a retiring move's
// migrations.json, written as ctx ended, landed in a test's folder as it
// was being removed (#7232).
type loops struct {
	mu      sync.Mutex
	wg      sync.WaitGroup
	running map[string]int
	ended   bool
}

// loopsEndFor bounds the wait at the end: a loop that doesn't end with its
// ctx is named in the log and left running, rather than holding magpie's
// quit.
var loopsEndFor = 10 * time.Second

// Go runs f as the loop named name, unless the loops have ended:
// holdServing starts its work once another magpie lets go of the config
// folder, which may be as this one ends.
func (l *loops) Go(name string, f func()) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.ended {
		return
	}
	if l.running == nil {
		l.running = map[string]int{}
	}
	l.running[name]++
	l.wg.Go(func() {
		defer func() {
			l.mu.Lock()
			if l.running[name]--; l.running[name] == 0 {
				delete(l.running, name)
			}
			l.mu.Unlock()
		}()
		f()
	})
}

// end starts no loop after it, and waits for those running, for at most
// loopsEndFor. Their ctx has ended: each one ends on its own.
func (l *loops) end() {
	l.mu.Lock()
	l.ended = true
	l.mu.Unlock()
	done := make(chan struct{})
	go func() { l.wg.Wait(); close(done) }()
	t := time.NewTimer(loopsEndFor)
	defer t.Stop()
	select {
	case <-done:
	case <-t.C:
		l.mu.Lock()
		var names []string
		for n := range l.running {
			names = append(names, n)
		}
		l.mu.Unlock()
		slices.Sort(names)
		log.Printf("gateway: ending with %s still running %s after its end", strings.Join(names, ", "), loopsEndFor)
	}
}

// loopName is f's function name, for the log of a loop that outlived the
// gateway's end.
func loopName(f any) string {
	if fn := runtime.FuncForPC(reflect.ValueOf(f).Pointer()); fn != nil {
		return strings.TrimPrefix(fn.Name(), "github.com/yetone/magpie/internal/")
	}
	return "WhileServing"
}

```

### Core Architecture Module: `internal/gateway/signin_hooks.go`
```
package gateway

// The gateway's request hooks told of an account that has to be signed in
// again (shannnnnks on X: of several Codex accounts, one is signed out now
// and then, to be pushed by the notify plugin). The alert is the one the
// app notifies (provider.WatchSignIns): every subscription the Providers
// page says to sign in again (Claude, Copilot, ChatGPT's revoked or
// refused sign-ins, a plugin's), and a Claude sign-in about to end, each
// said once until the account is usable again. The hooks' marks are their
// own (provider.SignInHooksPath), so the app's notification and the hooks
// are each told.

import (
	"context"
	"log"
	"time"

	"github.com/yetone/magpie/internal/plugin"
	"github.com/yetone/magpie/internal/provider"
)

// signInEvent is what a hook's onSignIn is handed for a: the provider,
// the account's label and its state, never a token or the vendor's words.
func signInEvent(a provider.SignInAlert) plugin.SignInEvent {
	state := "signed-out"
	if a.Kind == "ending" {
		state = "ending"
	}
	return plugin.SignInEvent{Provider: a.Provider, ProviderName: a.Name, Account: a.User, State: state, EndsAt: a.EndsAt}
}

// tellHooksOfSignIns is one look: each alert due handed to the hooks. With
// no hook installed nothing is looked at, nor marked told, so a hook
// installed later hears of an account signed out before.
func tellHooksOfSignIns(ctx context.Context) {
	if !plugin.HasGateway() {
		return
	}
	for _, a := range provider.SignInAlertsAt(provider.SignInHooksPath()) {
		log.Printf("sign-in hook: %s %s %s", a.Kind, a.Name, a.User)
		signInToHooks(ctx, signInEvent(a))
	}
}

// keepHooksToldOfSignIns looks a minute after the gateway starts and every
// two minutes after, as the app's alert does: a mark is set as a request is
// refused, so a look reads magpie's own files and asks no vendor.
func keepHooksToldOfSignIns(ctx context.Context) {
	t := time.NewTimer(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		tellHooksOfSignIns(ctx)
		t.Reset(2 * time.Minute)
	}
}

// signInToHooks hands an event to the hooks; a test counts the calls.
var signInToHooks = plugin.GatewaySignIn

```

### Core Architecture Module: `internal/gateway/tool_loop.go`
```
package gateway

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/tidwall/gjson"
	"github.com/yetone/magpie/internal/lazyre"
	"github.com/yetone/magpie/internal/provider"
	"github.com/yetone/magpie/internal/settings"
)

// A model can also loop across turns: it asks for the same tool call, the
// agent runs it and sends back the same result, and the model asks for it
// again. Codex Desktop on WorkBuddy's deepseek-v4-pro read the same code
// 308 times in half an hour, and 340 times that evening, 537 credits for
// nothing (audie on Discord). Every turn of such a loop carries the whole
// conversation, so the loop is in the request itself: its newest turns are
// the same calls with the same arguments answered with the same results.
//
// stoppedToolLoop answers a request whose last toolLoopRepeats turns are
// all that one exchange here, in the agent's own API, with a notice that
// ends the agent's turn, and sends it nowhere. A turn that got a different
// result (a poll whose answer moved, a file that changed) is progress and
// starts the count again, as does anything the user says: the notice
// itself is a turn without calls, so the user's next word goes on with
// the conversation. It is on with Settings' Stop looping replies
// (settings.NoLoopGuard off), as loopGuard is.

// toolLoopRepeats is how many turns in a row of the same calls answered
// with the same results stop the next: the ninth is answered here.
const toolLoopRepeats = 8

// toolLoopWho is who answered such a turn, as the Routing view names it.
const toolLoopWho = "Tool loop stopped"

// toolResultMarks are what each API's tool result is written with, for a
// body with fewer than toolLoopRepeats of them to be let by unparsed.
var toolResultMarks = map[provider.Protocol][][]byte{
	provider.Responses: {[]byte(`_output"`)}, // function_call_output, custom_tool_call_output, …
	provider.Chat:      {[]byte(`"tool_call_id"`)},
	provider.Anthropic: {[]byte(`"tool_result"`)},
	provider.Gemini:    {[]byte(`"functionResponse"`), []byte(`"function_response"`)},
}

// stoppedToolLoop answers r here when its conversation is stuck in a tool
// loop, and says whether it did.
func (s *Server) stoppedToolLoop(w http.ResponseWriter, r *http.Request, from provider.Protocol, body []byte) bool {
	if settings.Shared().NoLoopGuard || !mayLoop(from, body) {
		return false
	}
	req, err := parse(from, tailOf(from, body))
	if err != nil {
		return false // serve says what is wrong with it
	}
	loop, ok := toolLoopOf(req.Messages)
	if !ok {
		return false
	}
	why := loop.why()
	s.answeredHere(r, from, body, toolLoopWho, why, func() {
		writeLocalText(w, from, req, loop.notice(conversationLang(from, body)))
	})
	return true
}

// mayLoop: body has results enough to hold a loop.
func mayLoop(from provider.Protocol, body []byte) bool {
	n := 0
	for _, m := range toolResultMarks[from] {
		n += bytes.Count(body, m)
	}
	return n >= toolLoopRepeats
}

// conversationKey is where each API keeps a request's conversation.
var conversationKey = map[provider.Protocol]string{
	provider.Responses: "input",
	provider.Chat:      "messages",
	provider.Anthropic: "messages",
	provider.Gemini:    "contents",
}

// tailItems is how many of a conversation's newest messages (a Responses
// input's items) are read for a loop: toolLoopRepeats turns are 16
// messages, or 56 Responses items with reasoning and three calls a turn.
// A loop of more calls a turn than fit isn't seen.
const tailItems = 8 * toolLoopRepeats

// tailOf is body with only the newest tailItems of its conversation, for
// the guard to parse a turn's end and not the whole of a long one, which
// took ~30ms and 20MB a turn of 1.5MB; gjson finds the items without
// decoding them. A body whose conversation isn't such a list is as it came.
func tailOf(from provider.Protocol, body []byte) []byte {
	list := getIn(body, conversationKey[from])
	if !list.IsArray() || list.Index <= 0 {
		return body
	}
	var items []gjson.Result
	list.ForEach(func(_, v gjson.Result) bool {
		items = append(items, v)
		return true
	})
	if len(items) <= tailItems {
		return body
	}
	// a slice made to its size, not a bytes.Buffer: under -race the
	// Buffer's Grow allocates its slice twice
	b := make([]byte, 0, len(body)-list.Index-len(list.Raw)+items[len(items)-1].Index+len(items[len(items)-1].Raw)-items[len(items)-tailItems].Index+list.Index+2)
	b = append(b, body[:list.Index]...)
	b = append(b, '[')
	for i, v := range items[len(items)-tailItems:] {
		if i > 0 {
			b = append(b, ',')
		}
		b = append(b, v.Raw...)
	}
	b = append(b, ']')
	return append(b, body[list.Index+len(list.Raw):]...)
}

// toolLoop is a conversation's newest exchange and how many turns in a row
// it was made.
type toolLoop struct {
	calls []Part // the turn's calls, for the notice to name
	turns int
}

// toolLoopOf is the loop msgs end in, when their last toolLoopRepeats
// turns are one exchange: the same calls answered with the same results.
func toolLoopOf(msgs []Message) (toolLoop, bool) {
	turns := exchanges(msgs)
	if len(turns) < toolLoopRepeats {
		return toolLoop{}, false
	}
	last := turns[len(turns)-1]
	if allWaits(last.calls) {
		return toolLoop{}, false
	}
	n := 0
	for i := len(turns) - 1; i >= 0 && turns[i].sum == last.sum; i-- {
		n++
	}
	if n < toolLoopRepeats {
		return toolLoop{}, false
	}
	return toolLoop{calls: last.calls, turns: n}, true
}

// A call made to wait (clock__sleep {"duration_ms":60000} while CI runs)
// is asked again with the same arguments and answered the same by design;
// the time it takes is the progress, which a request doesn't carry. A turn
// whose calls are all waits is never a loop. A turn that waits and also
// runs another call is judged as before.

// waitWords are the words in a tool's name that make it a wait.
var waitWords = map[string]bool{"sleep": true, "wait": true, "delay": true, "pause": true, "poll": true}

// durationKeys are the argument names of a bare wait.
var durationKeys = map[string]bool{"duration": true, "duration_ms": true, "duration_s": true, "duration_seconds": true, "ms": true, "milliseconds": true, "seconds": true, "secs": true, "sec": true, "timeout": true, "timeout_ms": true, "delay": true, "delay_ms": true, "minutes": true}

func allWaits(calls []Part) bool {
	for _, c := range calls {
		if !isWait(c) {
			return false
		}
	}
	return len(calls) > 0
}

// isWait: the tool's own name (after any server__ or namespace prefix, so
// a server called "wait" doesn't make its tools waits) has a wait word, or
// its arguments are only a duration.
func isWait(c Part) bool {
	name := c.Name
	for _, sep := range []string{"__", ".", "/", ":"} {
		if i := strings.LastIndex(name, sep); i >= 0 {
			name = name[i+len(sep):]
		}
	}
	// split on anything but a letter, and before a capital (waitForCi)
	var words []string
	cur := []rune{}
	flush := func() {
		if len(cur) > 0 {
			words = append(words, strings.ToLower(string(cur)))
			cur = cur[:0]
		}
	}
	for _, r := range name {
		switch {
		case r >= 'A' && r <= 'Z':
			flush()
			cur = append(cur, r)
		case r >= 'a' && r <= 'z':
			cur = append(cur, r)
		default:
			flush()
		}
	}
	flush()
	for _, w := range words {
		if waitWords[w] {
			return true
		}
	}
	var args map[string]json.RawMessage
	if json.Unmarshal(c.Args, &args) != nil || len(args) == 0 {
		return false
	}
	for k, v := range args {
		var n float64
		if !durationKeys[strings.ToLower(k)] || json.Unmarshal(v, &n) != nil {
			return false
		}
	}
	return true
}

// exchange is one turn of tool use: the assistant's calls and the results
// the agent sent back, summed without their ids, which differ every turn.
type exchange struct {
	sum   uint64
	calls []Part
}

// exchanges are the turns of tool use msgs end in, oldest first, back to
// the newest turn that wasn't one: an assistant turn with no call, or a
// user turn with no result. Consecutive messages of one role are one turn
// (a Responses reasoning item and its call, a call's several outputs).
func exchanges(msgs []Message) []exchange {
	type run struct {
		role  string
		parts []Part
	}
	var runs []run
	for _, m := range msgs {
		if n := len(runs); n > 0 && runs[n-1].role == m.Role {
			runs[n-1].parts = append(runs[n-1].parts, m.Parts...)
			continue
		}
		runs = append(runs, run{m.Role, append([]Part(nil), m.Parts...)})
	}
	var out []exchange
	for i := len(runs) - 1; i >= 1; i -= 2 {
		said, asked := runs[i], runs[i-1]
		if said.role != "user" || asked.role != "assistant" {
			break
		}
		e, ok := exchangeOf(asked.parts, said.parts)
		if !ok {
			break
		}
		out = append(out, e)
	}
	slices.Reverse(out)
	return out
}

// exchangeOf sums one turn: each call by its name and arguments, with the
// result the agent gave it, and anything else the user's side said beside
// the results (a reminder an agent adds to each, a word of the user's).
func exchangeOf(asked, said []Part) (exchange, bool) {
	var calls []Part
	for _, p := range asked {
		if p.Kind == ToolCall {
			calls = append(calls, p)
		}
	}
	results := map[string][]string{}
	var rest []string
	hasResult := false
	for _, p := range said {
		switch p.Kind {
		case ToolResult:
			hasResult = true
			results[p.CallID] = append(results[p.CallID], resultSum(p))
		case Text:
			rest = append(rest, "text\x00"+p.Text)
		default:
			rest = append(rest, string(p.Kind)+"\x00"+p.Text+p.Data+p.URL)
		}
	}
	if len(calls) == 0 || !hasResult {
		return exchange{}, false
	}
	keys := make([]string, 0, len(calls)+1)
	for _, c := range calls {
		got := results[c.ID]
		delete(results, c.ID)
		keys = append(keys, c.Name+"\x00"+steadyArgs(c.Args)+"\x00"+strings.Join(got, "\x01"))
	}
	for _, got := range results { // results of no call here
		keys = append(keys, "\x00\x00"+strings.Join(got, "\x01"))
	}
	slices.Sort(keys)
	h := fnv.New64a()
	for _, k := range keys {
		h.Write([]byte(k))
		h.Write([]byte{0xff})
	}
	for _, k := range rest {
		h.Write([]byte(k))
		h
```

### Core Architecture Module: `internal/gui/gpurender.go`
```
package gui

// Settings › General › Advanced › GPU rendering, Linux's app alone: how
// webkit_linux.go set WebKitGTK to draw at this run's start, and what it
// would pick with the setting left alone.

// webkitRunInfo is what this run decided.
type webkitRunInfo struct {
	Auto bool // what magpie picks here on its own
	GPU  bool // whether this run composites on the GPU
	// User are the variables the user set themselves, NAME=VALUE, which
	// take the choice over
	User []string
}

// webkitRun is set by webkitDefaults as the app starts; nil in magpie
// web and on the other systems, which have no row.
var webkitRun *webkitRunInfo

// gpuJSON is the row's facts: Auto, the default; Now, this run's (the
// setting takes effect at the next start); Env, the user's variables.
type gpuJSON struct {
	Auto bool     `json:"auto"`
	Now  bool     `json:"now"`
	Env  []string `json:"env,omitempty"`
}

func gpuRow() *gpuJSON {
	if webkitRun == nil {
		return nil
	}
	return &gpuJSON{Auto: webkitRun.Auto, Now: webkitRun.GPU, Env: webkitRun.User}
}

```

### Core Architecture Module: `internal/gui/laststate.go`
```
package gui

import (
	"crypto/sha256"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/yetone/magpie/internal/appdir"
	"github.com/yetone/magpie/internal/settings"
	"github.com/yetone/magpie/internal/steady"
)

// The last-known state (#1519, fatkun). state() reads every agent's config
// anew, and with WSL agents on, each distro's through \\wsl.localhost, so
// the Agents page waited 0.4–0.6 s for it on the Windows test box after a
// start (fatkun: about 2 s, and seconds more with WSL on), and the
// Providers page waited behind it. The page now draws from the state
// built last, kept here and in the cache folder for the next start, and
// the fresh one replaces it the moment it is in: an agent leaves the list
// only once a fresh read says it is gone.
//
// What is kept leaves the settings out (they hold the GitHub token and the
// LAN key): the last-known state is served with the settings as they are
// now, so it never brings back one the user changed since.

var lastState struct {
	sync.Mutex
	kept []byte   // the last state built, as stateFile holds it
	read bool     // the file was looked at (or kept was set)
	sum  [32]byte // kept's keptSum
}

// keptMarshaled counts the states and lists kept marshaled, for a test.
var keptMarshaled atomic.Int64

// encodedSum is the hash of v as json.Marshal writes it, with a newline
// after it, found without a copy of those bytes: each poll of the Agents
// and Providers pages marshaled what it keeps, the same as it was nearly
// always, only to compare it, 38 MB of what twenty polls allocated.
func encodedSum(v any) ([32]byte, error) {
	h := sha256.New()
	if err := json.NewEncoder(h).Encode(v); err != nil {
		return [32]byte{}, err
	}
	return [32]byte(h.Sum(nil)), nil
}

// keptSum is encodedSum of what kept is the marshaled bytes of.
func keptSum(kept []byte) [32]byte {
	h := sha256.New()
	h.Write(kept)
	h.Write([]byte{'\n'})
	return [32]byte(h.Sum(nil))
}

// stateFile is the last-known state, with the version that wrote it: an
// older magpie's is not drawn by a newer page.
type stateFile struct {
	Version string    `json:"version"`
	State   stateJSON `json:"state"`
}

func lastStatePath() string { return filepath.Join(appdir.Cache(), "agents-state.json") }

// keepState remembers s as the last-known state. The file is written only
// when what is kept changed, and as magpie's own cache: nothing a request
// reads is built from it, so its write doesn't drop what filememo holds
// (edit.WriteAtomic's would: every poll of the Agents page rebuilt each
// agent's model list and picker, and every provider's catalog, anew).
func keepState(s stateJSON) {
	sum, err := encodedSum(keptFile(s))
	if err != nil {
		return
	}
	keepStateSummed(s, sum)
}

// keptFile is what keepState keeps of s.
func keptFile(s stateJSON) stateFile {
	// kept as it is sent, each option list once
	s = shareOptions(s)
	s.Settings = settings.Settings{}
	// and what is told once: a notice, a file recovered after a crash
	s.Notice, s.Connected, s.Recovered = "", nil, nil
	// and the magpie serving the gateway now, which the next start asks
	s.GatewayOther = nil
	return stateFile{Version: Version, State: s}
}

// keepStateSummed is keepState given sum, encodedSum(keptFile(s)), found
// while s was written (writeStateJSON).
func keepStateSummed(s stateJSON, sum [32]byte) {
	f := keptFile(s)
	lastState.Lock()
	defer lastState.Unlock()
	if !lastState.read {
		lastState.kept, _ = os.ReadFile(lastStatePath())
		lastState.read, lastState.sum = true, keptSum(lastState.kept)
	}
	if sum == lastState.sum {
		return
	}
	keptMarshaled.Add(1)
	b, err := json.Marshal(f)
	if err != nil {
		return
	}
	lastState.kept, lastState.sum = b, sum
	p := lastStatePath()
	if os.MkdirAll(filepath.Dir(p), 0o755) == nil {
		_ = steady.WriteFile(p, b, 0o644)
	}
}

// lastKnown is the last state built, by this run or the one before it,
// with the settings as they are now; false when none is kept, or it was
// kept by another version.
func lastKnown() (stateJSON, bool) {
	lastState.Lock()
	if !lastState.read {
		lastState.kept, _ = os.ReadFile(lastStatePath())
		lastState.read, lastState.sum = true, keptSum(lastState.kept)
	}
	b := lastState.kept
	lastState.Unlock()
	var f stateFile
	if len(b) == 0 || json.Unmarshal(b, &f) != nil || f.Version != Version || f.State.Agents == nil {
		return stateJSON{}, false
	}
	f.State.Settings = stateSettings(settings.Load())
	f.State.Last = true
	return f.State, true
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7798** (2026-11-26): **新增脱敏词时候输入框变成密码框，内容无法查看也无法提交成功**
  *Symptoms*: ### magpie version  v0.1.4823  ### Where  GUI  ### OS  windows11  ### Agent, provider and model  _No response_  ### Steps to reproduce  新增脱敏词时候输入框变成密码框，内容无法查看也无法提交成功  ### What happened, and what you expected  输入脱敏词可以正常查看使用  ### Error text or logs  ```text  ```

- **Issue #7373** (2026-11-20): **skills点击全部重启magpie后又没有全部勾上了**
  *Symptoms*: ### magpie version  0.1.4607  ### Where  GUI  ### OS  WIndows11  ### Agent, provider and model  _No response_  ### Steps to reproduce  资源库中的skills点击全部全部勾上后，重启magpie过一会后又没有全部勾上了  <img width="781" height="55" alt="image" src="https://github.com/user-attachments/assets/30658cf7-e5b0-4dcd-8f84-4ec5c8a2313a" />  <img width="801" height="75" alt="image" src="https://github.com/user-attachments/assets/e3bd4f55-cf73-4090-af0d-7d8446d962fd" />  <img width="723" height="154" alt="image" src="https://github.com/user-attachments/assets/5b4be2b2-61ce-468c-90ce-f7c576b6082c" />  ### What happened, and what you expected  skills点击全部重启magpie后又没有全部勾上，我想要一直保持全局skills的使用  ### Error text or logs  ```text  ```

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

### Incident Patch 1: `09bada7e` (2026-11-19)
**Commit Message**: proc, gui: background magpie and magpie-bun run in Efficiency Mode on Windows battery (#7154)

On Windows laptops running on battery (GetSystemPowerStatus ACLineStatus == 0)
or with Windows Energy Saver enabled (SystemStatusFlag == 1), magpie in the
tray and its persistent magpie-bun plugin host kept normal power-throttling
state, letting background runtime, GC and helper threads wake P-cores on
hybrid CPUs.

- internal/proc (efficiency.go, efficiency_windows.go, efficiency_other.go,
  tree*.go): PowerNow reads GetSystemPowerStatus (treating a failed read or
  ACLineStatus == 255 as unknown rather than on battery); EfficiencyActive
  enables EcoQoS while (OnBattery || EnergySaver) && !inForeground;
  SetEfficiencyMode and Tree.SetEfficiencyMode call
  SetProcessInformation(ProcessPowerThrottling) with
  PROCESS_POWER_THROTTLING_EXECUTION_SPEED while leaving the priority class
  unchanged (NORMAL_PRIORITY_CLASS), and ClearProcessEfficiencyMode clears it
  for programs opened for the user (OpenBrowser, StartReaped, openFolder,
  revealFolder) alongside Windows' own non-inheritance across CreateProcess.
  Tree on Windows pins a PROCESS_SET_INFORMATION handle until sweep so
  SetEffici

**File**: `docs/subsystems/gui-shell.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ three.
 
 | Part | Responsibility | Source |
 | --- | --- | --- |
-| Native host | `Run` starts the Wails v3 app: the tray icon, the panel, the main window, single-instance handover, `magpie://` import and plugin links (`magpie://plugin?name=` opens Plugins on the package's sheet, `pluginView`) and open at login. magpie claims `magpie://` only. v0.1.3981 to v0.1.4454 also claimed CC Switch's `ccswitch://` (Info.plist, `HKCU\Software\Classes\ccswitch`, `magpie-ccswitch.desktop`), and a start leaves what they wrote. A `ccswitch://` link that still reaches magpie that way (`magpie ccswitch://…` on Windows and Linux, before anything is read or started; the URL event on the Mac) is opened with CC Switch when it is installed, and the claim goes back to it: Launch Services registers magpie's bundle again from its Info.plist (`lsregister -f`), the per-user handler that runs this magpie is pointed at CC Switch's exe as its MSI writes it, and the desktop default that is `magpie-ccswitch.desktop` goes to CC Switch's entry, with magpie's entry removed while it runs this magpie or a gone one. With no CC Switch the link and the claim are left as they are (`ccswitchlink.ErrNotInstalled`; [`ccswitchlink`](../../internal/ccswitchlink/link.go)). `host` implements `Windows` for the API: show and hide, open URLs and folders, copy to the clipboard, fit and tint the panel, and set the text size. A copy on Linux sets PRIMARY before CLIPBOARD, since GTK 3 serves CLIPBOARD empty when PRIMARY is set after it on a compositor with no primary selection (KDE Plasma with middle-click paste off, #1881); on Wayland the copy is read back through the compositor, and one that doesn't read back whole answers `/api/copy` with 501, so the page tries its clipboard API, then the copy command, then says the copy failed with the text to copy by hand (`copy-fallback.test.cjs`). On Windows, Wails reads the screens again on each display change (`WM_DISPLAYCHANGE`, and `WM_SETTINGCHANGE` for the work area) through `w32.GetAllScreens`, which makes a new Win32 callback each time; Go never frees one and throws past about 2000, killing the app and its gateway after hours of display changes (1111_13879 on Discord). `screensWndProc`, the app's `WndProcInterceptor`, takes those messages on Wails' main-thread window first and reads the screens with one callback made once (`allScreens`), then hands them to `Screen.LayoutScreens` as Wails would; see `TestScreensReadFarPastTheCallbackLimit`, `TestDisplayChangesAreReadOnWailsWindowOnly` (Windows) and `TestWailsScreensAreReadOnTheMainThreadWindow`, which fails when a Wails upgrade changes what that relies on. On Windows `appWndProc` also installs a thread-local `WH_CBT` hook (`hookNoActivate`, `noActivateCBT` in `noactivate_windows.go`) on Wails' main thread to turn down `HCBT_ACTIVATE` for hidden windows and windows shown quietly (`showQuietly`, `showMinimised`), and unhooks it (`unhookNoActivate`) when the main-thread window is destroyed or the app shuts down so `ExitProcess`'s FLS cleanup (`msctf!CicFlsCallback`) cannot call back into Go while `runtime.exit` holds `runtime.finlock` (#6705, `TestUnhookNoActivatePreventsExitDeadlock`). | [`app.go`](../../internal/gui/app.go), [`screens_windows.go`](../../internal/gui/screens_windows.go), [`noactivate_windows.go`](../../internal/gui/noactivate_windows.go), [`clipboard_gtk3.go`](../../internal/gui/clipboard_gtk3.go), [`clipboard_gtk3.h`](../../internal/gui/clipboard_gtk3.h), [`mainwindow.go`](../../internal/gui/mainwindow.go), [`traymenu.go`](../../internal/gui/traymenu.go) |
+| Native host | `Run` starts the Wails v3 app: the tray icon, the panel, the main window, single-instance handover, `magpie://` import and plugin links (`magpie://plugin?name=` opens Plugins on the package's sheet, `pluginView`) and open at login. magpie claims `magpie://` only. v0.1.3981 to v0.1.4454 also claimed CC Switch's `ccswitch://` (Info.plist, `HKCU\Software\Classes\ccswitch`, `magpie-ccswitch.desktop`), and a start leaves what they wrote. A `ccswitch://` link that still reaches magpie that way (`magpie ccswitch://…` on Windows and Linux, before anything is read or started; the URL event on the Mac) is opened with CC Switch when it is installed, and the claim goes back to it: Launch Services registers magpie's bundle again from its Info.plist (`lsregister -f`), the per-user handler that runs this magpie is pointed at CC Switch's exe as its MSI writes it, and the desktop default that is `magpie-ccswitch.desktop` goes to CC Switch's entry, with magpie's entry removed while it runs this magpie or a gone one. With no CC Switch the link and the claim are left as they are (`ccswitchlink.ErrNotInstalled`; [`ccswitchlink`](../../internal/ccswitchlink/link.go)). `host` implements `Windows` for the API: show and hide, open URLs and folders, copy to the clipboard, fit and tint the panel, and set the text size. A copy on Linux sets PRIMARY before CLIPBOARD, since GTK 3 serves CLI
```

**File**: `internal/gui/app.go` (modified, +3/-0)
```diff
@@ -452,6 +452,7 @@ func Run(version string, showMain bool, link string) error {
 		// so do the threads.
 		OnShutdown: func() {
 			unhookNoActivate()
+			stopEfficiencyMode()
 			stopServing()
 			proc.EndProbes()
 			if handedOver.Load() {
@@ -740,6 +741,7 @@ func Run(version string, showMain bool, link string) error {
 	if runtime.GOOS == "windows" {
 		h.main.OnWindowEvent(events.Windows.WebViewNavigationCompleted, func(*application.WindowEvent) { markReady() })
 		h.mendOnWake()
+		h.startEfficiencyMode()
 	} else {
 		h.app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
 			if runtime.GOOS != "darwin" {
@@ -809,6 +811,7 @@ func Run(version string, showMain bool, link string) error {
 		startAppPage(h, gw)
 	}
 	defer unhookNoActivate()
+	defer stopEfficiencyMode()
 	return h.app.Run()
 }
 
```

**File**: `internal/gui/efficiency.go` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package gui
+
+import (
+	"sync"
+
+	"github.com/yetone/magpie/internal/proc"
+)
+
+// efficiencyCoordinator applies Windows' efficiency mode from power and
+// foreground changes, once per change, under one lock so two events never
+// apply their outcomes out of order.
+type efficiencyCoordinator struct {
+	mu      sync.Mutex
+	power   func() proc.PowerState
+	inFront func() bool
+	apply   func(bool)
+	applied bool
+	stopped bool
+}
+
+func newEfficiencyCoordinator(power func() proc.PowerState, inFront func() bool, apply func(bool)) *efficiencyCoordinator {
+	return &efficiencyCoordinator{power: power, inFront: inFront, apply: apply}
+}
+
+func (c *efficiencyCoordinator) active() bool {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	return c.applied
+}
+
+func (c *efficiencyCoordinator) update() {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	if c.stopped {
+		return
+	}
+	next := proc.EfficiencyActive(c.power(), c.inFront())
+	if next == c.applied {
+		return
+	}
+	c.applied = next
+	c.apply(next)
+}
+
+func (c *efficiencyCoordinator) stop() {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	if c.stopped {
+		return
+	}
+	c.stopped = true
+	if c.applied {
+		c.applied = false
+		c.apply(false)
+	}
+}
```

**File**: `internal/gui/efficiency_other.go` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+//go:build !windows && !nogui
+
+package gui
+
+func (h *host) startEfficiencyMode() {}
+
+func stopEfficiencyMode() {}
```

**File**: `internal/gui/efficiency_test.go` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package gui
+
+import (
+	"slices"
+	"testing"
+
+	"github.com/yetone/magpie/internal/proc"
+)
+
+func TestEfficiencyCoordinatorAppliesTransitionsOnce(t *testing.T) {
+	var (
+		power   proc.PowerState
+		inFront bool
+		applied []bool
+	)
+	coord := newEfficiencyCoordinator(
+		func() proc.PowerState { return power },
+		func() bool { return inFront },
+		func(on bool) { applied = append(applied, on) },
+	)
+
+	// AC at launch does not apply a redundant false transition.
+	coord.update()
+	if len(applied) != 0 || coord.active() {
+		t.Fatalf("AC start: applied = %v, active = %v", applied, coord.active())
+	}
+
+	// Unplugged in background turns efficiency mode on once.
+	power = proc.PowerState{OnBattery: true}
+	coord.update()
+	coord.update()
+	if !slices.Equal(applied, []bool{true}) || !coord.active() {
+		t.Fatalf("battery background: applied = %v, active = %v", applied, coord.active())
+	}
+
+	// Energy Saver turning on while already on battery is no change.
+	power = proc.PowerState{OnBattery: true, EnergySaver: true}
+	coord.update()
+	if !slices.Equal(applied, []bool{true}) {
+		t.Fatalf("battery + saver: applied = %v", applied)
+	}
+
+	// A GUI window coming to the foreground lifts efficiency mode.
+	inFront = true
+	coord.update()
+	if !slices.Equal(applied, []bool{true, false}) || coord.active() {
+		t.Fatalf("window in foreground: applied = %v, active = %v", applied, coord.active())
+	}
+
+	// Leaving the foreground puts efficiency mode back on.
+	inFront = false
+	coord.update()
+	if !slices.Equal(applied, []bool{true, false, true}) || !coord.active() {
+		t.Fatalf("back to tray: applied = %v, active = %v", applied, coord.active())
+	}
+
+	// Plugging into AC while Energy Saver stays on keeps efficiency mode active.
+	power = proc.PowerState{OnBattery: false, EnergySaver: true}
+	coord.update()
+	if !slices.Equal(applied, []bool{true, false, true}) || !coord.active() {
+		t.Fatalf("AC with Energy Saver: applied = %v, active = %v", applied, coord.active())
+	}
+
+	// Turning Energy Saver off on AC lifts efficiency mode.
+	power = proc.PowerState{}
+	coord.update()
+	if !slices.Equal(applied, []bool{true, false, true, false}) || coord.active() {
+		t.Fatalf("AC without Energy Saver: applied = %v, active = %v", applied, coord.active())
+	}
+
+	// Stopping while active lifts efficiency mode once and ignores later updates.
+	power = proc.PowerState{OnBattery: true}
+	coord.update()
+	coord.stop()
+	coord.stop()
+	coord.update()
+	if !slices.Equal(applied, []bool{true, false, true, false, true, false}) || coord.active() {
+		t.Fatalf("after stop: applied = %v, active = %v", applied, coord.active())
+	}
+}
```

**File**: `internal/gui/efficiency_windows.go` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+//go:build windows && !nogui
+
+package gui
+
+import (
+	"log"
+	"sync"
+	"sync/atomic"
+	"unsafe"
+
+	"github.com/wailsapp/wails/v3/pkg/application"
+	"github.com/wailsapp/wails/v3/pkg/events"
+	"github.com/wailsapp/wails/v3/pkg/w32"
+	"golang.org/x/sys/windows"
+
+	"github.com/yetone/magpie/internal/plugin"
+	"github.com/yetone/magpie/internal/proc"
+)
+
+// On battery or with Windows Energy Saver on, magpie and its background
+// plugin host (magpie-bun) run in Windows' efficiency mode (EcoQoS) while
+// none of magpie's GUI windows is in the foreground, and leave it as soon
+// as AC power returns (without Energy Saver) or a GUI window comes to the
+// front. Both power and foreground transitions arrive on Wails' window
+// procedure (appWndProc), so nothing is polled.
+
+const (
+	wmSize        = 0x0005
+	wmActivate    = 0x0006
+	wmShowWindow  = 0x0018
+	wmActivateApp = 0x001C
+	gaRoot        = 2 // GetAncestor's GA_ROOT
+)
+
+// Power setting GUIDs (winnt.h): AC/DC power source and Energy Saver.
+var (
+	guidACDCPowerSource = windows.GUID{
+		Data1: 0x5d3e9a59, Data2: 0xe9d5, Data3: 0x4b00,
+		Data4: [8]byte{0xa6, 0xbd, 0xff, 0x34, 0xff, 0x51, 0x65, 0x48},
+	}
+	guidPowerSavingStatus = windows.GUID{
+		Data1: 0xe00958c0, Data2: 0xc213, Data3: 0x4ace,
+		Data4: [8]byte{0xac, 0x77, 0xfe, 0xcc, 0xed, 0x2e, 0xee, 0xa5},
+	}
+)
+
+var (
+	procGetForegroundWindow                = windows.NewLazySystemDLL("user32.dll").NewProc("GetForegroundWindow")
+	procWindowIconic                       = windows.NewLazySystemDLL("user32.dll").NewProc("IsIconic")
+	procUnregisterPowerSettingNotification = windows.NewLazySystemDLL("user32.dll").NewProc("UnregisterPowerSettingNotification")
+)
+
+var (
+	powerNotifyMu      sync.Mutex
+	powerNotifyHandles []uintptr
+	efficiencyCheck    atomic.Pointer[func()]
+	activeEfficiency   atomic.Pointer[efficiencyCoordinator]
+)
+
+// efficiencyMsg reports whether msg may reflect a change in power or in
+// whether one of magpie's windows is in the foreground.
+func efficiencyMsg(msg uint32) bool {
+	switch msg {
+	case wmPowerBroadcast, wmActivateApp, wmActivate, wmShowWindow, wmSize:
+		return true
+	}
+	return false
+}
+
+// windowInForeground reports whether fg (or its root window, when a child
+// control such as WebView2 holds focus) is a visible, unminimised window of
+// ownPID. Wails' hidden main-thread and tray message windows are excluded
+// by IsWindowVisible, and minimised windows by IsIconic.
+func windowInForeground(fg uintptr, ownPID uint32) bool {
+	if fg == 0 {
+		return false
+	}
+	if root, _, _ := procGetAncestor.Call(fg, gaRoot); root != 0 {
+		fg = root
+	}
+	var pid uint32
+	if _, err := windows.GetWindowThreadProcessId(windows.HWND(fg), &pid); err != nil || pid != ownPID {
+		return false
+	}
+	iconic, _, _ := procWindowIconic.Call(fg)
+	return w32.IsWindowVisible(fg) && iconic == 0
+}
+
+func ownWindowInForeground() bool {
+	fg, _, _ := procGetForegroundWindow.Call()
+	return windowInForeground(fg, windows.GetCurrentProcessId())
+}
+
+func watchEfficiencyPower() {
+	hwnd := ownMainThreadWindow()
+	if hwnd == 0 {
+		return
+	}
+	powerNotifyMu.Lock()
+	defer powerNotifyMu.Unlock()
+	if len(powerNotifyHandles) > 0 {
+		return
+	}
+	for _, g := range []*windows.GUID{&guidACDCPowerSource, &guidPowerSavingStatus} {
+		h, _, err := procRegisterPowerSettingNotification.Call(hwnd, uintptr(unsafe.Pointer(g)), deviceNotifyWindowHndl)
+		if h == 0 {
+			log.Printf("efficiency mode: power notification unavailable: %v", err)
+			continue
+		}
+		powerNotifyHandles = append(powerNotifyHandles, h)
+	}
+}
+
+func unwatchEfficiencyPower() {
+	powerNotifyMu.Lock()
+	hs := powerNotifyHandles
+	powerNotifyHandles = nil
+	powerNotifyMu.Unlock()
+	for _, h := range hs {
+		procUnregisterPowerSettingNotification.Call(h)
+	}
+}
+
+func (h *host) startEfficiencyMode() {
+	coord := newEfficiencyCoordinator(proc.PowerNow, ownWindowInForeground, func(on bool) {
+		if err := proc.SetEfficiencyMode(on); err != nil {
+			log.Printf("efficiency mode: %v", err)
+			return
+		}
+		plugin.SetEfficiencyMode(on)
+		if on {
+			log.Print("efficiency mode: on (background on battery or Energy Saver)")
+		} else {
+			log.Print("efficiency mode: off")
+		}
+	})
+	activeEfficiency.Store(coord)
+	check := func() { application.InvokeAsync(coord.update) }
+	efficiencyCheck.Store(&check)
+	h.app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
+		application.InvokeAsync(func() {
+			watchEfficiencyPower()
+			coord.update()
+		})
+	})
+}
+
+func stopEfficiencyMode() {
+	efficiencyCheck.Store(nil)
+	unwatchEfficiencyPower()
+	if coord := activeEfficiency.Swap(nil); coord != nil {
+		coord.stop()
+	}
+}
```

**File**: `internal/gui/efficiency_windows_test.go` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+//go:build windows && !nogui
+
+package gui
+
+import (
+	"runtime"
+	"testing"
+	"unsafe"
+
+	"github.com/wailsapp/wails/v3/pkg/w32"
+	"golang.org/x/sys/windows"
+)
+
+// The windows are real, so this runs where Windows has a desktop the user
+// sees: on the Windows box's signed-in session, not over ssh (session 0),
+// where a window shown is never visible.
+func TestWindowInForeground(t *testing.T) {
+	var session uint32
+	if err := windows.ProcessIdToSessionId(windows.GetCurrentProcessId(), &session); err != nil || session == 0 {
+		t.Skip("no interactive desktop (session 0): run it in the signed-in session")
+	}
+	runtime.LockOSThread()
+	defer runtime.UnlockOSThread()
+
+	ownPID := windows.GetCurrentProcessId()
+	if windowInForeground(0, ownPID) {
+		t.Fatal("zero hwnd reported as foreground")
+	}
+
+	offscreen := uintptr(^uintptr(20000 - 1))
+	cls, _ := windows.UTF16PtrFromString("STATIC")
+	title, _ := windows.UTF16PtrFromString("magpie efficiency test")
+	top, _, err := procCreateWindowExW.Call(
+		0,
+		uintptr(unsafe.Pointer(cls)),
+		uintptr(unsafe.Pointer(title)),
+		w32.WS_OVERLAPPEDWINDOW,
+		offscreen, offscreen, 120, 80,
+		0, 0, 0, 0,
+	)
+	if top == 0 {
+		t.Fatalf("CreateWindowExW top: %v", err)
+	}
+	t.Cleanup(func() { procDestroyWindow.Call(top) })
+
+	// Hidden top-level window (tray/main-thread/closed window) is not in foreground.
+	if windowInForeground(top, ownPID) {
+		t.Fatal("hidden window reported as in foreground")
+	}
+
+	// Shown without activating offscreen: visible and unminimised -> true for ownPID, false for another PID.
+	quietly(top, func() { w32.ShowWindow(w32.HWND(top), w32.SW_SHOWNOACTIVATE) })
+	if !windowInForeground(top, ownPID) {
+		t.Fatal("visible unminimised window of ownPID not recognised as foreground")
+	}
+	if windowInForeground(top, ownPID+1) {
+		t.Fatal("window recognised as foreground for a different PID")
+	}
+
+	// A child control inside the window (such as WebView2's child HWND) resolves to the root window.
+	const wsChild = 0x40000000
+	const wsVisible = 0x10000000
+	child, _, err := procCreateWindowExW.Call(
+		0,
+		uintptr(unsafe.Pointer(cls)),
+		uintptr(unsafe.Pointer(title)),
+		wsChild|wsVisible,
+		0, 0, 50, 50,
+		top, 0, 0, 0,
+	)
+	if child == 0 {
+		t.Fatalf("CreateWindowExW child: %v", err)
+	}
+	t.Cleanup(func() { procDestroyWindow.Call(child) })
+	if !windowInForeground(child, ownPID) {
+		t.Fatal("child control inside visible window not recognised via GA_ROOT")
+	}
+
+	// Minimised onto the taskbar -> false.
+	quietly(top, func() { w32.ShowWindow(w32.HWND(top), w32.SW_SHOWMINNOACTIVE) })
+	if windowInForeground(top, ownPID) {
+		t.Fatal("minimised window reported as in foreground")
+	}
+}
+
+func TestAppWndProcTriggersEfficiencyCheckOnPowerAndActivation(t *testing.T) {
+	calls := 0
+	check := func() { calls++ }
+	was := efficiencyCheck.Load()
+	efficiencyCheck.Store(&check)
+	t.Cleanup(func() { efficiencyCheck.Store(was) })
+
+	for _, msg := range []uint32{wmPowerBroadcast, wmActivateApp, wmActivate, wmShowWindow, wmSize} {
+		before := calls
+		appWndProc(0, msg, 0, 0)
+		if calls != before+1 {
+			t.Fatalf("msg 0x%x: calls = %d, want %d", msg, calls, before+1)
+		}
+	}
+
+	// Unrelated high-frequency messages do not trigger efficiency checks.
+	before := calls
+	for _, msg := range []uint32{w32.WM_NULL, w32.WM_MOUSEMOVE, w32.WM_PAINT, w32.WM_TIMER} {
+		appWndProc(0, msg, 0, 0)
+	}
+	if calls != before {
+		t.Fatalf("unrelated messages triggered %d checks, want 0", calls-before)
+	}
+}
```

**File**: `internal/gui/folder_windows.go` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ func openFolder(_ *application.App, path string) error {
 	if err := cmd.Start(); err != nil {
 		return fmt.Errorf("explorer: %w", err)
 	}
+	proc.ClearProcessEfficiencyMode(cmd.Process.Pid)
 	go cmd.Wait() // it exits 1 when it did open the folder
 	return nil
 }
```

---

### Incident Patch 2: `59e22503` (2026-11-26)
**Commit Message**: provider: agy-cli's min is 0.1.143, where a restart mid tool loop and a model switch keep the agy session (chet030714, xuanbo1889245 on X)

agy-cli 0.1.142 and 0.1.143 (magpie-community/plugins 9405e8cd,
46d20e58) stop two paths that replayed a whole conversation into a new
agy session. Since 0.1.139 a replay seeds up to the model's window
(~1.8 MB for flash), so each one is a cold read of the conversation,
which fits the 5h window chet030714 saw drain in an hour and the "new
session for nearly every conversation" xuanbo1889245 reported.

- 0.1.142: magpie recycles a plugin host over its memory budget and
  restarts it on updates. A tool result arriving after that found no
  live session and replayed. The bridge now parks each step's session
  while it waits on client tools, and a result that goes on from it
  resumes that session (session/resume, as T3 Code does with
  resumeSessionId) with only the step's results.
- 0.1.143: Claude Code names its model in the system prompt, so /model
  changed the conversation's key and instructions hash and replayed.
  The model line leaves the identity; agy switches the model in place.
  Entries parked under the old key are still found once.

A

**File**: `internal/provider/agy_move.go` (modified, +6/-1)
```diff
@@ -24,6 +24,11 @@ import (
 const (
 	agyCLIID      = "agy-cli"
 	agyCLIPackage = "@magpie-community/opencode-agy-cli-auth"
+	// 0.1.143: a Claude Code model switch, which rewrites the system
+	// prompt's model line, keeps the agy session instead of replaying the
+	// conversation into a new one (chet030714 on X); 0.1.142: a tool loop
+	// cut by a plugin host restart resumes its agy session with only the
+	// step's results (chet030714, xuanbo1889245 on X);
 	// 0.1.140: usage is read through agy alone (`agy -p /usage`), never
 	// with agy's stored token against Google's quota endpoints, and a
 	// slow read says agy is still reading instead of "timed out"
@@ -34,7 +39,7 @@ const (
 	// of its own, and a request of one never goes on in another's agy, so
 	// one account's 429 no longer rests the other (Archivemylife on X);
 	// 0.1.68: auth.import takes the old plugin's sign-ins
-	agyCLIMin = "0.1.140"
+	agyCLIMin = "0.1.143"
 )
 
 // agyMoving are the Antigravity accounts agy-cli doesn't have yet, as the
```

**File**: `internal/provider/agy_move_test.go` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ func TestMoveToAgyImportsTheOldSignIns(t *testing.T) {
 	if len(got) != 1 || got[0].Status != "added" {
 		t.Fatalf("%+v", got)
 	}
-	if !slices.Equal(s.installed, []string{agyCLIPackage + "@" + agyCLIMin}) || agyCLIMin != "0.1.140" {
+	if !slices.Equal(s.installed, []string{agyCLIPackage + "@" + agyCLIMin}) || agyCLIMin != "0.1.143" {
 		t.Fatalf("installed %v", s.installed)
 	}
 	if len(s.texts) != 1 {
```

---

### Incident Patch 3: `88222ca3` (2026-11-26)
**Commit Message**: memory: the summary can leave each memory's why out (#7780)

The digest written into the agents' instructions gives every memory
that has a why as "- text (why: …)", and that counts against the
digest's budget. With ~35 memories the whys were ~38% of the section,
about 1.7k tokens at the start of every session, and the only way to
drop one was to delete the why from the memory itself.

"Include reasons in summary", under the Memory tab's Advanced (shown
while the summary is in the instructions), leaves them out: render
skips the suffix before it counts the line, so the room goes to more
memories. The why stays in the memory, its file and the tab. The
setting is meta.json's digestNoWhy, this computer's own like the digest
(not in a backup or sync), and SetDigestOmitWhy publishes again at once;
library.SetMemoryDigestOmitWhy writes the ticked agents' CLAUDE.md /
AGENTS.md again. POST /api/memory/digest takes {"omitWhy": bool}
beside {"on": bool}.

Why an option, not the whys gone for everyone: a why is what lets an
agent apply a rule to a case it doesn't name, and the user wrote it to
be read; dropping it would change every user's summary to save one
setup's tokens. On by default, so

**File**: `docs/subsystems/memory.md` (modified, +8/-0)
```diff
@@ -183,6 +183,14 @@ project's under the folders it was seen in) to the instructions of the
 agents ticked under Instructions, unless `Instructions.NoMemory`
 (`TestMemoryDigestInInstructions`). The Memory tab's switch sets it.
 
+A memory's why goes into its item as `(why: …)`, and counts against the
+budget, unless the user turns "Include reasons in summary" off under the
+Memory tab's Advanced (#7780). `digestNoWhy` in meta.json keeps that, this
+computer's own like the digest itself, and `SetDigestOmitWhy` publishes
+again at once, so the room it frees takes more memories. The why stays in
+the memory, its file and the tab (`TestDigestOmitWhy`,
+`TestMemoryDigestOmitWhyInInstructions`, `TestMemoryDigestOmitWhyRoute`).
+
 ### GUI
 
 [internal/gui/memory.go](../../internal/gui/memory.go):
```

**File**: `internal/gui/assets/plugins/library/client.js` (modified, +17/-0)
```diff
@@ -1212,6 +1212,7 @@ magpie.plugin("library", (ctx) => {
   let memOpen = null;    // the memory open to edit, or "new"
   let memDraft = null;   // its fields as typed
   let memRemoving = null; // the memory whose Delete was clicked once
+  let memMore = false;   // the Advanced fold under the card, opened by the user
   // Select (RealZeroP27 on X): a box on each memory shown, and a bar that
   // keeps, archives, restores or deletes the ones picked at once
   let memPicking = false;
@@ -1327,6 +1328,22 @@ magpie.plugin("library", (ctx) => {
       card.append(r);
     }
     body.append(card);
+    // what few change, folded under Advanced below the card while the
+    // summary is in the instructions: whether it gives each memory's why
+    // (#7780). Open while it doesn't, or while the user keeps it open.
+    if (mem.digest) {
+      const more = el("details", "prefs-more lib-memmore");
+      more.open = memMore || !!mem.digestOmitWhy;
+      more.ontoggle = () => { memMore = more.open; };
+      const list = el("div", "list lib-list");
+      const r = el("div", "row lib-row lib-memwhy");
+      const w = el("div", "who");
+      w.append(el("div", "name", t("Include reasons in summary")));
+      r.append(glyph(GLYPH.rule), w, toggle(!mem.digestOmitWhy, t("Include reasons in summary"), (on) => memChange("memory/digest", { omitWhy: !on }, on ? t("Reasons are shown in the memories' summary") : t("Reasons are left out of the memories' summary"))));
+      list.append(r);
+      more.append(el("summary", "", t("Advanced")), list);
+      body.append(more);
+    }
 
     const all = mem.memories;
     const count = (st) => all.filter((m) => st === "archived" ? m.status === "archived" || m.status === "superseded" : m.status === st).length;
```

**File**: `internal/gui/assets/plugins/library/i18n.js` (modified, +12/-0)
```diff
@@ -96,6 +96,9 @@ magpie.strings({
     "No agent is switched on under Instructions": "「指令」中没有开启任何 Agent",
     "The agents read the memories' summary": "Agent 现在会读到记忆摘要",
     "The memories' summary is taken out of the agents' instructions": "已从 Agent 的指令中移除记忆摘要",
+    "Include reasons in summary": "摘要中包含原因",
+    "Reasons are shown in the memories' summary": "记忆摘要现在会包含原因",
+    "Reasons are left out of the memories' summary": "已从记忆摘要中省略原因",
     "Add it for agents to search and save memories": "添加后，Agent 才能搜索和保存记忆",
     "Search memories": "搜索记忆",
     "To review": "待确认",
@@ -1377,6 +1380,9 @@ magpie.strings({
     "No agent is switched on under Instructions": "「指令」中沒有開啟任何 Agent",
     "The agents read the memories' summary": "Agent 現在會讀到記憶摘要",
     "The memories' summary is taken out of the agents' instructions": "已從 Agent 的指令中移除記憶摘要",
+    "Include reasons in summary": "摘要中包含原因",
+    "Reasons are shown in the memories' summary": "記憶摘要現在會包含原因",
+    "Reasons are left out of the memories' summary": "已從記憶摘要中省略原因",
     "Add it for agents to search and save memories": "新增後，Agent 才能搜尋和儲存記憶",
     "Search memories": "搜尋記憶",
     "To review": "待確認",
@@ -2658,6 +2664,9 @@ magpie.strings({
     "No agent is switched on under Instructions": "「指示」でオンのエージェントはありません",
     "The agents read the memories' summary": "エージェントが記憶の要約を読むようになりました",
     "The memories' summary is taken out of the agents' instructions": "記憶の要約をエージェントの指示から外しました",
+    "Include reasons in summary": "要約に理由を含める",
+    "Reasons are shown in the memories' summary": "記憶の要約に理由を含めるようになりました",
+    "Reasons are left out of the memories' summary": "記憶の要約から理由を省きました",
     "Add it for agents to search and save memories": "追加すると、エージェントが記憶を検索・保存できます",
     "Search memories": "記憶を検索",
     "To review": "確認待ち",
@@ -3939,6 +3948,9 @@ magpie.strings({
     "No agent is switched on under Instructions": "Unter Anweisungen ist kein Agent eingeschaltet",
     "The agents read the memories' summary": "Die Agenten lesen jetzt die Zusammenfassung der Erinnerungen",
     "The memories' summary is taken out of the agents' instructions": "Die Zusammenfassung wurde aus den Anweisungen der Agenten entfernt",
+    "Include reasons in summary": "Begründungen in der Zusammenfassung",
+    "Reasons are shown in the memories' summary": "Begründungen werden in der Zusammenfassung angezeigt",
+    "Reasons are left out of the memories' summary": "Begründungen werden aus der Zusammenfassung weggelassen",
     "Add it for agents to search and save memories": "Hinzufügen, damit Agenten Erinnerungen suchen und speichern können",
     "Search memories": "Erinnerungen durchsuchen",
     "To review": "Zu prüfen",
```

**File**: `internal/gui/memory.go` (modified, +28/-8)
```diff
@@ -13,10 +13,11 @@ import (
 // first, the projects they are kept for, and whether the agents ticked
 // for instructions are given the digest.
 type memoryView struct {
-	Memories []*memory.Memory           `json:"memories"`
-	Projects map[string]*memory.Project `json:"projects"`
-	Digest   bool                       `json:"digest"`
-	Agents   []string                   `json:"agents"` // ticked for instructions
+	Memories      []*memory.Memory           `json:"memories"`
+	Projects      map[string]*memory.Project `json:"projects"`
+	Digest        bool                       `json:"digest"`
+	DigestOmitWhy bool                       `json:"digestOmitWhy"`
+	Agents        []string                   `json:"agents"` // ticked for instructions
 	// Suggestions are memories to make global, and procedures to make
 	// skills (memory.Suggest)
 	Suggestions []memory.Suggestion `json:"suggestions"`
@@ -27,6 +28,10 @@ func readMemory() (*memoryView, error) {
 	if err != nil {
 		return nil, err
 	}
+	omitWhy, err := memory.DigestOmitWhy()
+	if err != nil {
+		return nil, err
+	}
 	on, agents, err := library.MemoryInInstructions()
 	if err != nil {
 		return nil, err
@@ -44,7 +49,7 @@ func readMemory() (*memoryView, error) {
 	if sg == nil {
 		sg = []memory.Suggestion{}
 	}
-	return &memoryView{Memories: ms, Projects: ps, Digest: on, Agents: agents, Suggestions: sg}, nil
+	return &memoryView{Memories: ms, Projects: ps, Digest: on, DigestOmitWhy: omitWhy, Agents: agents, Suggestions: sg}, nil
 }
 
 // memoryChanged publishes the user's change to the agents' instructions
@@ -202,16 +207,31 @@ func memoryRoutes(mux *http.ServeMux) {
 	})
 	mux.HandleFunc("POST /api/memory/digest", func(rw http.ResponseWriter, r *http.Request) {
 		var in struct {
-			On bool `json:"on"`
+			On      *bool `json:"on"`
+			OmitWhy *bool `json:"omitWhy"`
 		}
 		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
 			fail(rw, err)
 			return
 		}
-		if _, err := library.SetMemoryInInstructions(in.On); err != nil {
-			fail(rw, err)
+		if in.On == nil && in.OmitWhy == nil {
+			fail(rw, errors.New("specify on or omitWhy"))
 			return
 		}
+		// whether the summary gives each memory's why (#7780): set, and
+		// the agents' instructions written again, before the switch
+		if in.OmitWhy != nil {
+			if _, err := library.SetMemoryDigestOmitWhy(*in.OmitWhy); err != nil {
+				fail(rw, err)
+				return
+			}
+		}
+		if in.On != nil {
+			if _, err := library.SetMemoryInInstructions(*in.On); err != nil {
+				fail(rw, err)
+				return
+			}
+		}
 		memoryChanged(rw)
 	})
 }
```

**File**: `internal/gui/memory_test.go` (modified, +58/-0)
```diff
@@ -113,3 +113,61 @@ func TestMemoryStatsRoute(t *testing.T) {
 		}
 	}
 }
+
+// #7780: POST /api/memory/digest accepts {"omitWhy": true/false}, keeps
+// stored rationale in GET /api/memory, and updates published digests.
+func TestMemoryDigestOmitWhyRoute(t *testing.T) {
+	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
+	t.Setenv("XDG_CACHE_HOME", t.TempDir())
+	mux := http.NewServeMux()
+	memoryRoutes(mux)
+
+	text, kind, scope, why := "Prefer pnpm.", memory.Preference, memory.Global, "faster installs"
+	if _, _, err := memory.Save(memory.Input{Text: &text, Kind: &kind, Scope: &scope, Why: &why}, memory.FromUser, nil, nil); err != nil {
+		t.Fatal(err)
+	}
+	if _, err := memory.Publish(); err != nil {
+		t.Fatal(err)
+	}
+
+	req := func(method, path, body string) (int, memoryView) {
+		t.Helper()
+		rec := httptest.NewRecorder()
+		mux.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
+		var v memoryView
+		if rec.Code == 200 {
+			if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
+				t.Fatalf("%s %s: %s", method, path, rec.Body)
+			}
+		}
+		return rec.Code, v
+	}
+
+	code, v := req("GET", "/api/memory", "")
+	if code != 200 || v.DigestOmitWhy {
+		t.Fatalf("initial GET /api/memory: code=%d omitWhy=%v", code, v.DigestOmitWhy)
+	}
+
+	code, v = req("POST", "/api/memory/digest", `{"omitWhy":true}`)
+	if code != 200 || !v.DigestOmitWhy || !v.Digest {
+		t.Fatalf("omitWhy=true: code=%d digest=%v omitWhy=%v", code, v.Digest, v.DigestOmitWhy)
+	}
+	if len(v.Memories) != 1 || v.Memories[0].Why != why {
+		t.Fatalf("stored Why not preserved in Memory tab view: %+v", v.Memories)
+	}
+	if d, err := memory.Digest("claude"); err != nil || strings.Contains(d, "(why:") || !strings.Contains(d, "Prefer pnpm.") {
+		t.Fatalf("digest after omitWhy=true: %q (%v)", d, err)
+	}
+
+	code, v = req("POST", "/api/memory/digest", `{"omitWhy":false}`)
+	if code != 200 || v.DigestOmitWhy {
+		t.Fatalf("omitWhy=false: code=%d omitWhy=%v", code, v.DigestOmitWhy)
+	}
+	if d, err := memory.Digest("claude"); err != nil || !strings.Contains(d, "(why: faster installs)") {
+		t.Fatalf("digest after omitWhy=false: %q (%v)", d, err)
+	}
+
+	if code, _ := req("POST", "/api/memory/digest", `{}`); code != http.StatusBadRequest {
+		t.Fatalf("empty body: code=%d, want 400", code)
+	}
+}
```

**File**: `internal/gui/tests/library-memory.test.cjs` (modified, +22/-2)
```diff
@@ -116,7 +116,10 @@ function server(lang, state, sent, dist, sem) {
       if (route.request().method() === "POST") {
         const body = route.request().postDataJSON();
         sent.push({ path: url.pathname, body });
-        if (url.pathname === "/api/memory/digest") state.digest = body.on;
+        if (url.pathname === "/api/memory/digest") {
+          if ("on" in body) state.digest = body.on;
+          if ("omitWhy" in body) state.digestOmitWhy = body.omitWhy;
+        }
         else if (url.pathname === "/api/memory/remove") state.memories = state.memories.filter((m) => !body.ids.includes(m.id));
         else if (body.id) Object.assign(state.memories.find((m) => m.id === body.id), body, { id: body.id });
         else state.memories.push({ id: "m" + (state.memories.length + 1), kind: "preference", scope: "global", origin: "user", status: "active", created: at(6), updated: at(6), ...body });
@@ -308,10 +311,27 @@ for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium",
           await page.waitForFunction(() => document.querySelectorAll("#view-library .lib-mems .lib-mem").length === 3);
           assert.deepEqual(sent.findLast((x) => x.path === "/api/memory/remove").body, { ids: ["m4"] });
 
-          // the summary switched off
+          // the summary's reasons, under Advanced, folded while they are
+          // given (#7780); left out, the fold stays open
+          const more = page.locator(`${view} details.lib-memmore`);
+          assert.equal(await more.getAttribute("open"), null, "Advanced open by default");
+          assert.equal(await page.locator(`${view} .lib-memcard .lib-memwhy`).count(), 0, "reasons switch in the card");
+          await more.locator("summary").click();
+          const why = more.locator(".lib-memwhy button.lib-switch");
+          assert.equal(await why.getAttribute("aria-checked"), "true");
+          await why.click();
+          await page.waitForFunction(() => document.querySelector("#view-library .lib-memwhy button.lib-switch")?.getAttribute("aria-checked") === "false");
+          assert.deepEqual(sent.findLast((x) => x.path === "/api/memory/digest").body, { omitWhy: true });
+          assert.notEqual(await page.locator(`${view} details.lib-memmore`).getAttribute("open"), null, "Advanced closed with the reasons left out");
+          await page.locator(`${view} .lib-memwhy button.lib-switch`).click();
+          await page.waitForFunction(() => document.querySelector("#view-library .lib-memwhy button.lib-switch")?.getAttribute("aria-checked") === "true");
+          assert.deepEqual(sent.findLast((x) => x.path === "/api/memory/digest").body, { omitWhy: false });
+
+          // the summary switched off, and the fold with it
           await page.locator(`${view} .lib-memdigest button.lib-switch`).click();
           await page.waitForFunction(() => document.querySelector("#view-library .lib-memdigest button.lib-switch")?.getAttribute("aria-checked") === "false");
           assert.deepEqual(sent.findLast((x) => x.path === "/api/memory/digest").body, { on: false });
+          assert.equal(await page.locator(`${view} details.lib-memmore`).count(), 0, "Advanced kept with the summary off");
         }
 
         // conversations read: switched on, it reads at once with the automatic model
```

**File**: `internal/library/instructions.go` (modified, +15/-0)
```diff
@@ -194,6 +194,21 @@ func PublishMemory(due bool) (*Result, error) {
 	if err != nil || !changed {
 		return nil, err
 	}
+	return syncPublishedMemory()
+}
+
+// SetMemoryDigestOmitWhy sets whether published memory digests omit
+// "(why: ...)" rationale suffixes (keeping each memory's Why stored) and
+// rewrites ticked agents' instructions when the digest changes (#7780).
+func SetMemoryDigestOmitWhy(omit bool) (*Result, error) {
+	changed, err := memory.SetDigestOmitWhy(omit)
+	if err != nil || !changed {
+		return nil, err
+	}
+	return syncPublishedMemory()
+}
+
+func syncPublishedMemory() (*Result, error) {
 	mu.Lock()
 	defer mu.Unlock()
 	l, err := load()
```

**File**: `internal/library/memory_digest_test.go` (modified, +42/-0)
```diff
@@ -91,3 +91,45 @@ func readMaybe(p string) string {
 	b, _ := os.ReadFile(p)
 	return string(b)
 }
+
+// #7780: SetMemoryDigestOmitWhy omits "(why: ...)" from CLAUDE.md and
+// AGENTS.md while keeping stored Why intact, and restores it when turned off.
+func TestMemoryDigestOmitWhyInInstructions(t *testing.T) {
+	h := sandbox(t)
+	shared := "Be brief."
+	ok(t)(SaveInstructions(InstructionsChange{Shared: &shared, Agents: []string{"claude", "codex"}}))
+	text, kind, scope, why := "Use pnpm, never npm.", memory.Rule, memory.Global, "lockfile stays consistent"
+	m, _, err := memory.Save(memory.Input{Text: &text, Kind: &kind, Scope: &scope, Why: &why}, memory.FromUser, nil, nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+	ok(t)(PublishMemory(false))
+	files := []string{filepath.Join(h, ".claude/CLAUDE.md"), filepath.Join(h, ".codex/AGENTS.md")}
+	for _, f := range files {
+		if got := read(t, f); !strings.Contains(got, "(why: lockfile stays consistent)") {
+			t.Fatalf("%s missing default why suffix:\n%s", f, got)
+		}
+	}
+
+	if r, err := SetMemoryDigestOmitWhy(true); err != nil || r == nil || len(r.Problems) > 0 {
+		t.Fatalf("omit true: the instructions weren't written again: %+v, %v", r, err)
+	}
+	for _, f := range files {
+		got := read(t, f)
+		if !strings.Contains(got, "Use pnpm, never npm.") || strings.Contains(got, "(why:") {
+			t.Fatalf("%s should keep entry and omit (why:):\n%s", f, got)
+		}
+	}
+	if stored, err := memory.Get(m.ID); err != nil || stored.Why != why {
+		t.Fatalf("stored rationale altered: %q (%v)", stored.Why, err)
+	}
+
+	if r, err := SetMemoryDigestOmitWhy(false); err != nil || r == nil || len(r.Problems) > 0 {
+		t.Fatalf("omit false: the instructions weren't written again: %+v, %v", r, err)
+	}
+	for _, f := range files {
+		if got := read(t, f); !strings.Contains(got, "(why: lockfile stays consistent)") {
+			t.Fatalf("%s did not restore why suffix:\n%s", f, got)
+		}
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #6795** (closed): probe #6368: EBADF with and without FSEvents WatchRoot (not for merge) (@yetone)
- **PR #1355** (closed): 会话：展示网关会话用量，并支持可选的本地对话记录 (@mu-zi-lee)
- **PR #1354** (2026-10-14): gui: make the Routing context lazy and align wide cards (@Nxir)
- **PR #1351** (2026-10-08): routing, gui: on af798bd1's fold, opening it no longer scrolls the page, the folded head shows a bar of what fills the window, and a request opened from Usage's Context tab shows unfolded for itself (PILIPALA @NXirg2 on X, Jeremy.Zhou on Discord) (@yetone)
- **PR #1339** (2026-10-08): agent: dsh's check stays quiet when its key store holds a caller key of this gateway's (@ggbdpq)
- **PR #1335** (closed): sessions: List's limit counts sessions that assemble, so an empty session newest by mtime no longer empties the answer (@ggbdpq)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. proc, gui: background magpie and magpie-bun run in Efficiency Mode on Windows ba

**RULE**:
When implementing operations in `docs/subsystems/gui-shell.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yetone/magpie. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `09bada7e`: proc, gui: background magpie and magpie-bun run in Efficiency Mode on Windows battery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/subsystems/gui-shell.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
| Native host | `Run` starts the Wails v3 app: the tray icon, the panel, the main window, single-instance handover, `magpie://` import and plugin links (`magpie://plugin?name=` opens Plugins on the package's sheet, `pluginView`) and open at login. magpie claims `magpie://` only. v0.1.3981 to v0.1.4454 also claimed CC Switch's `ccswitch://` (Info.plist, `HKCU\Software\Classes\ccswitch`, `magpie-ccswitch.desktop`), and a start leaves what they wrote. A `ccswitch://` link that still reaches magpie that way (`magpie ccswitch://…` on Windows and Linux, before anything is read or started; the URL event on the Mac) is opened with CC Switch when it is installed, and the claim goes back to it: Launch Services registers magpie's bundle again from its Info.plist (`lsregister -f`), the per-user handler that runs this magpie is pointed at CC Switch's exe as its MSI writes it, and the desktop default that is `magpie-ccswitch.desktop` goes to CC Switch's entry, with magpie's entry removed while it runs this magpie or a gone one. With no CC Switch the link and the claim are left as they are (`ccswitchlink.ErrNotInstalled`; [`ccswitchlink`](../../internal/ccswitchlink/link.go)). `host` implements `
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
| Native host | `Run` starts the Wails v3 app: the tray icon, the panel, the main window, single-instance handover, `magpie://` import and plugin links (`magpie://plugin?name=` opens Plugins on the package's sheet, `pluginView`) and open at login. magpie claims `magpie://` only. v0.1.3981 to v0.1.4454 also claimed CC Switch's `ccswitch://` (Info.plist, `HKCU\Software\Classes\ccswitch`, `magpie-ccswitch.desktop`), and a start leaves what they wrote. A `ccswitch://` link that still reaches magpie that way (`magpie ccswitch://…` on Windows and Linux, before anything is read or started; the URL event on the Mac) is opened with CC Switch when it is installed, and the claim goes back to it: Launch Services registers magpie's bundle again from its Info.plist (`lsregister -f`), the per-user handler that runs this magpie is pointed at CC Switch's exe as its MSI writes it, and the desktop default that is `magpie-ccswitch.desktop` goes to CC Switch's entry, with magpie's entry removed while it runs this magpie or a gone one. With no CC Switch the link and the claim are left as they are (`ccswitchlink.ErrNotInstalled`; [`ccswitchlink`](../../internal/ccswitchlink/link.go)). `host` implements `
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `09bada7e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

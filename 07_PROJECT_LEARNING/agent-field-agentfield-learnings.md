# Forensic Learning Record (Deep Inspection): Agent-Field/agentfield

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:20.769Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agent-Field/agentfield`
- **Description**: Build, run and scale AI agents like API and microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2592 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `control-plane/cmd/af-tray/assets_darwin.go`
```
package main

import _ "embed"

// Menu-bar icons. These are embedded on every platform (they are just bytes),
// but only referenced by the darwin tray implementation. Replace these with the
// final brand assets when available — icon_active is shown when the control
// plane is healthy, icon_inactive when it is stopped/unreachable.
//
//go:embed assets/icon_active.png
var iconActive []byte

//go:embed assets/icon_inactive.png
var iconInactive []byte

// appIconICNS is written into the generated .app bundle's Resources on macOS.
//
//go:embed assets/appicon.icns
var appIconICNS []byte

```

### Core Architecture Module: `control-plane/cmd/af-tray/chart_render.go`
```
package main

// Text-free image renderer for the Usage submenu's 24h timeline: a compact bucket
// histogram, stacked by model. It is pure graphics (image/png only, no fonts, no
// systray/CGO), so it compiles and is unit-tested on Linux CI. The per-model /
// rollup / quota rows are NOT rendered here — they are native menu-item text
// titles set by the darwin tray, each paired (models, quota) with a compact bar
// image from charts.go's slotBarPNG. The darwin tray turns the PNG below into a
// full-width menu-item image via the vendored systray fork's SetImage.
//
// All geometry is expressed in OUTPUT pixels — the 2x-retina PNG the tray hands
// to SetImage — and multiplied by the supersample factor `ss` for the internal
// high-res buffer, which is then box-downsampled for crisp bar edges and gaps.

import (
	"image"
	"image/color"
	"math"
)

// ---- Usage submenu geometry (points) ---------------------------------------
//
// The design system: EVERY row in the Usage submenu carries a leading image of
// exactly the uniform SLOT size, so every native title starts at the same x. Rows
// with a graphic (model / quota) draw a compact bar inside the slot; rows without
// one (summary lines, section headers, rollups, footer) get a fully transparent
// spacer of the same size. The 24h histogram is the one wider, text-free graphic
// row; its left edge still aligns with the slot, and its first bucket lines up
// with the compact bars below. These constants live here (cross-platform) so the
// pure renderers, their tests, and the darwin tray all share one source of truth.
const (
	// Uniform leading slot every submenu row carries.
	usageSlotWidthPt  = 64
	usageSlotHeightPt = 12
	// Compact proportional bar drawn inside the slot (model / quota rows),
	// left-aligned and vertically centered.
	usageBarWidthPt  = 56
	usageBarHeightPt = 8
	// 24h histogram: a full row-content-width (slot + title area), text-free row.
	usageChartWidthPt  = 200
	usageChartHeightPt = 28
)

// ---- Bucket histogram ------------------------------------------------------

// histogram tuning, in OUTPUT pixels (2x retina).
const (
	histTopPadPx    = 3 // headroom above the tallest bar so it doesn't touch the top
	histGapPx       = 1 // gap between adjacent buckets
	histStubPx      = 1 // baseline stub height for empty buckets
	histMinNonEmpty = 2 // shortest a nonzero bucket ever draws, so a tiny value shows
)

// histStubColor is the neutral baseline stub for empty buckets — dim enough not
// to compete with the accent bars, present enough that the timeline reads as
// continuous rather than broken around a lone spike.
var histStubColor = color.NRGBA{grayOther.R, grayOther.G, grayOther.B, 0x59}

// histogramChartPNG renders the usage timeline as a compact bucket histogram: one
// thin vertical bar per bucket (with 1px gaps), each bar stacking its models
// bottom-up in the given hues (layers[0] at the bottom). Empty buckets keep a 1px
// baseline stub so the timeline reads as continuous, which makes a lone spike look
// like an event on a timeline rather than a broken chart. When series_by_model is
// absent the caller passes a single layer (single accent hue). layers are
// per-bucket token counts, all the same length; colors[i] tints layers[i]. It
// carries no text — the numbers live in the native menu titles around it.
func histogramChartPNG(layers [][]float64, colors []color.NRGBA, wPx, hPx int) []byte {
	if wPx <= 0 || hPx <= 0 {
		return nil
	}
	ss := barSupersample
	s := float64(ss)
	W, H := wPx*ss, hPx*ss
	hi := image.NewNRGBA(image.Rect(0, 0, W, H))

	// Plot region. The left edge is flush (x=0) so the first bucket lines up with
	// the compact model bars in the rows below; the baseline sits on the bottom
	// edge; only a little headroom is reserved at the top.
	plotTop := float64(histTopPadPx) * s
	plotBot := float64(H)
	if plotBot <= plotTop {
		plotTop = 0
	}
	plotH := plotBot - plotTop

	// Bucket count and the per-bucket stacked total.
	n := 0
	for _, l := range layers {
		if len(l) > n {
			n = len(l)
		}
	}
	if n == 0 {
		return encodePNG(downsample(hi, wPx, hPx, ss))
	}
	valueAt := func(li, i int) float64 {
		if li < 0 || li >= len(layers) || i < 0 || i >= len(layers[li]) {
			return 0
		}
		v := layers[li][i]
		if v < 0 {
			v = 0
		}
		return v
	}
	total := func(i int) float64 {
		sum := 0.0
		for li := range layers {
			sum += valueAt(li, i)
		}
		return sum
	}
	maxTotal := 0.0
	for i := 0; i < n; i++ {
		if t := total(i); t > maxTotal {
			maxTotal = t
		}
	}

	stubPx := float64(histStubPx) * s
	minNonEmpty := float64(histMinNonEmpty) * s
	gap := float64(histGapPx) * s
	bucketW := float64(W) / float64(n)

	fillRect := func(x0, x1, y0, y1 float64, c color.NRGBA) {
		xi0, xi1 := int(math.Round(x0)), int(math.Round(x1))
		yi0, yi1 := int(math.Round(y0)), int(math.Round(y1))
		for y := yi0; y < yi1; y++ {
			if y < 0 || y >= H {
				continue
			}
			for x := xi0; x < xi1; x++ {
				if x < 0 || x >= W {
					continue
				}
				blendPixel(hi, x, y, c, 1)
			}
		}
	}

	for i := 0; i < n; i++ {
		xL := float64(i) * bucketW
		xR := xL + bucketW - gap
		if xR <= xL {
			xR = xL + 1
		}

		t := total(i)
		if t <= 0 || maxTotal <= 0 {
			// Empty bucket: a 1px neutral stub on the baseline.
			fillRect(xL, xR, plotBot-stubPx, plotBot, histStubColor)
			continue
		}

		// Bar height for this bucket, floored so a tiny nonzero value still shows.
		barH := (t / maxTotal) * plotH
		if barH < minNonEmpty {
			barH = minNonEmpty
		}
		scale := barH / t // pixels per token for this bucket's stack

		bottom := plotBot
		for li := range layers {
			v := valueAt(li, i)
			if v <= 0 {
				continue
			}
			segH := v * scale
			top := bottom - segH
			if top < plotTop {
				top = plotTop
			}
			col := grayOther
			if li < len(colors) {
				col = colors[li]
			}
			fillRect(xL, xR, top, bottom, col)
			bottom = top
		}
	}

	return encodePNG(downsample(hi, wPx, hPx, ss))
}

```

### Core Architecture Module: `control-plane/cmd/af-tray/charts.go`
```
package main

// This file holds the tray's image renderers: a wide 24h token timeseries chart
// and the rounded proportional bars used for per-model usage and Claude quota
// rows. Everything here is pure (image/png only, no systray/CGO), so it compiles
// on every platform and is unit-tested directly on CI. The darwin tray code
// (tray_darwin.go) turns these PNGs into menu-item images via the vendored
// systray fork's SetImage, which — unlike the stock 16x16-clamped icon API — can
// show them at full width and in color. See third_party/systray/PATCHES.md.
//
// Anti-aliasing strategy: each renderer draws at an integer supersample factor
// and box-downsamples to the target size, so curves and rounded corners come out
// smooth rather than jagged. The target pixel size is already 2x the point size
// (retina), and the supersample is on top of that.

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"math"
)

// chartSupersample is the internal oversampling factor for the timeseries chart;
// 3x over the already-2x retina pixels is plenty for smooth curves without being
// slow on the tray's refresh cadence.
const chartSupersample = 3

// barSupersample oversamples the rounded bars so their pill caps read as smooth,
// round edges rather than stair-stepped ones.
const barSupersample = 4

// ---- Palette ---------------------------------------------------------------
//
// One accent, ranked by intensity. Every model graphic in the Usage submenu is
// the single brand orange at a rank-dependent opacity, so the section reads as
// one coherent system rather than a rainbow. The only other colors are the
// neutral "other" gray, the neutral track, and the SEMANTIC green/amber/red of
// the Claude quota gauge — a distinction that actually carries meaning.

// accentColor is the brand orange every model usage graphic is tinted with.
var accentColor = color.NRGBA{0xe0, 0x8a, 0x3c, 0xff} // #e08a3c

var (
	// barTrackColor is the faint unfilled-track hue behind proportional bars. A
	// neutral gray at ~30% (not white) so it reads on both dark and light menus.
	barTrackColor = color.NRGBA{0x8a, 0x8f, 0x98, 0x4d}
)

// grayOther is the hue for the aggregated "other" bucket (the long tail beyond
// the ranked top models) in the histogram — a neutral midtone that reads on both
// dark and light menus without competing with the accent.
var grayOther = color.NRGBA{0x8a, 0x8f, 0x98, 0xff}

// modelRankAlpha is the accent's opacity (0..255) for a model at the given rank:
// rank 0 is full strength, and each lower rank fades toward the menu background,
// so intensity encodes rank with a single hue. Ranks beyond the third share the
// faintest step rather than ever going colorless.
func modelRankAlpha(rank int) uint8 {
	switch {
	case rank <= 0:
		return 0xff // 100%
	case rank == 1:
		return 0xa6 // ~65%
	case rank == 2:
		return 0x66 // ~40%
	default:
		return 0x40 // ~25%
	}
}

// modelBarColor returns the accent tinted to the given rank's intensity (0 = top,
// full strength). It is never fully transparent, so no row is ever colorless.
func modelBarColor(rank int) color.NRGBA {
	if rank < 0 {
		rank = 0
	}
	c := accentColor
	c.A = modelRankAlpha(rank)
	return c
}

// stackedLayerColor maps a histogram layer to its hue: the aggregated "other"
// bucket is neutral gray, every ranked model takes the accent at its rank
// intensity.
func stackedLayerColor(key string, rank int) color.NRGBA {
	if key == "other" {
		return grayOther
	}
	return modelBarColor(rank)
}

// quotaBarColor tints a rate-limit bar by utilization: green when there's plenty
// of headroom, orange as it fills, red when nearly exhausted.
func quotaBarColor(pct float64) color.NRGBA {
	switch {
	case pct >= 80:
		return color.NRGBA{0xff, 0x45, 0x3a, 0xff} // red    #ff453a
	case pct >= 50:
		return color.NRGBA{0xe0, 0x8a, 0x3c, 0xff} // orange #e08a3c
	default:
		return color.NRGBA{0x30, 0xd1, 0x58, 0xff} // green  #30d158
	}
}

// ---- Uniform leading slot: spacer + compact proportional bar ----------------
//
// Every row in the Usage submenu carries a leading image of exactly the same
// (slot) size so that every native title starts at the same x. Rows with a
// graphic draw a compact bar inside the slot; rows without one get a fully
// transparent spacer of the same size.

// spacerImagePNG returns a fully transparent PNG of the uniform slot size. It is
// the leading image on rows that have no graphic (summary lines, section
// headers, rollups, footer) so their titles line up with the bar/gauge rows.
func spacerImagePNG(wPx, hPx int) []byte {
	if wPx <= 0 || hPx <= 0 {
		return nil
	}
	return encodePNG(image.NewNRGBA(image.Rect(0, 0, wPx, hPx)))
}

// slotBarPNG renders a compact rounded "pill" bar left-aligned and vertically
// centered inside a uniform leading slot of slotWPx×slotHPx (the rest of the slot
// is transparent). The bar itself is barWPx×barHPx and is filled to the given
// fraction (0..1) in the given color over a faint neutral track. A tiny-but-
// nonzero fraction still shows a full rounded cap so it is never invisible. This
// keeps the model/quota bars aligned with the histogram's left edge and every
// title at the same x.
func slotBarPNG(fraction float64, fill color.NRGBA, slotWPx, slotHPx, barWPx, barHPx int) []byte {
	if slotWPx <= 0 || slotHPx <= 0 || barWPx <= 0 || barHPx <= 0 {
		return nil
	}
	if barWPx > slotWPx {
		barWPx = slotWPx
	}
	if barHPx > slotHPx {
		barHPx = slotHPx
	}
	if fraction < 0 {
		fraction = 0
	}
	if fraction > 1 {
		fraction = 1
	}
	ss := barSupersample
	s := float64(ss)
	W, H := slotWPx*ss, slotHPx*ss
	hi := image.NewNRGBA(image.Rect(0, 0, W, H))

	// Bar region: left-aligned, vertically centered, inset half a 1x pixel so the
	// pill's edges aren't clipped.
	inset := 0.5 * s
	x0 := inset
	x1 := float64(barWPx)*s - inset
	yTop := float64(slotHPx-barHPx) / 2 * s
	y0 := yTop + inset
	y1 := yTop + float64(barHPx)*s - inset
	radius := (y1 - y0) / 2

	// Fill extent. Keep at least a full round cap visible for any nonzero share.
	fillRight := x0 + fraction*(x1-x0)
	if fraction > 0 {
		minRight := x0 + 2*radius
		if fillRight < minRight {
			fillRight = minRight
		}
	}

	for y := int(yTop); y <= int(y1)+1 && y < H; y++ {
		if y < 0 {
			continue
		}
		for x := 0; x <= int(x1)+1 && x < W; x++ {
			px, py := float64(x)+0.5, float64(y)+0.5
			if !insideRoundedRect(px, py, x0, y0, x1, y1, radius) {
				continue
			}
			hi.SetNRGBA(x, y, barTrackColor)
			if fraction > 0 && insideRoundedRect(px, py, x0, y0, fillRight, y1, radius) {
				hi.SetNRGBA(x, y, fill)
			}
		}
	}

	return encodePNG(downsample(hi, slotWPx, slotHPx, ss))
}

// ---- Menu-bar status badge ---------------------------------------------------
//
// The tray's menu-bar item shows the brand "af" badge plus a small status glyph
// to its right: a filled green dot while the control plane is running, a gray
// ring when it is stopped, and a rotating orange arc while it starts up. The
// composite is applied via the vendored systray fork's SetStatusImage; it
// carries no text and is unit-testable on Linux.

// Menu-bar badge layout in points: [16pt badge][2pt gap][8pt status glyph].
const (
	statusBadgeWidthPt  = 27
	statusBadgeHeightPt = 18
	statusBadgeIconPt   = 16
	statusBadgeGapPt    = 2
	statusBadgeDotPt    = 8
)

// serverState is the control plane's coarse lifecycle state as seen by the tray.
type serverState int

const (
	serverStopped  serverState = iota // no process, not answering
	serverStarting                    // process present but /health not yet 200
	serverRunning                     // healthy
)

// deriveServerState maps the two observable facts to a lifecycle state.
func deriveServerState(healthy, processRunning bool) serverState {
	switch {
	case healthy:
		return serverRunning
	case processRunning:
		return serverStarting
	default:
		return serverStopped
	}
}

var (
	statusRunningColor  = color.NRGBA{0x30, 0xd1, 0x58, 0xff} // green #30d158
	statusStoppedColor
```

### Core Architecture Module: `control-plane/cmd/af-tray/claude_quota_darwin.go`
```
//go:build darwin

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// This file holds the macOS-only glue for the optional Claude subscription
// quota rows: reading the user's existing Claude Code OAuth token out of the
// login Keychain. The pure parsing/formatting and the HTTP call live in
// shared.go so they can be unit-tested on CI.
//
// STRICT contract (see shared.go): read-only. We never write to the Keychain,
// and the token is only ever handed to fetchClaudeQuota, which sends it to
// api.anthropic.com and nowhere else. It is never logged or persisted.

// readClaudeCodeToken reads the OAuth access token that Claude Code stores in
// the macOS login Keychain under the "Claude Code-credentials" generic-password
// item. It is entirely best-effort: if the `security` tool, the item, or the
// expected JSON shape is missing, it returns "" and the caller hides the rows.
// A single debug line (to stderr, which launchd routes to the tray log) records
// only *that* it failed, never the token itself.
func readClaudeCodeToken() string {
	// -w prints only the password (the stored JSON) to stdout.
	out, err := exec.Command("security", "find-generic-password",
		"-s", "Claude Code-credentials", "-w").Output()
	if err != nil {
		// Absent item / no Keychain access — expected on machines without
		// Claude Code. Stay quiet beyond debug.
		if os.Getenv("AF_TRAY_DEBUG") != "" {
			fmt.Fprintln(os.Stderr, "af-tray: claude quota: no keychain credentials")
		}
		return ""
	}
	token, err := parseClaudeCodeToken(out)
	if err != nil {
		if os.Getenv("AF_TRAY_DEBUG") != "" {
			fmt.Fprintln(os.Stderr, "af-tray: claude quota: unexpected keychain payload shape")
		}
		return ""
	}
	return token
}

// claudeUsageURL is Anthropic's OAuth usage endpoint. It is queried with a
// bearer token and the oauth beta header. It lives with its only caller so
// the linux lint pass does not see it as unused.
const claudeUsageURL = "https://api.anthropic.com/api/oauth/usage"

// fetchClaudeQuotaNow reads the token and queries the OAuth usage endpoint once.
// It returns a zero (OK=false) claudeQuota whenever anything is unavailable, so
// the caller can render nothing without special-casing.
func fetchClaudeQuotaNow() claudeQuota {
	token := readClaudeCodeToken()
	if token == "" {
		return claudeQuota{}
	}
	return fetchClaudeQuota(claudeUsageURL, token)
}

```

### Core Architecture Module: `control-plane/cmd/af-tray/launchd_darwin.go`
```
//go:build darwin

package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/Agent-Field/agentfield/control-plane/internal/launchdsvc"
)

// ---- Install / uninstall ---------------------------------------------------

// installOptions carry the switches that modify how far an install may go in
// taking over the shared launchd labels. Zero value is the default install.
type installOptions struct {
	// deferRestart never restarts a running server (install.sh --defer-restart).
	deferRestart bool
	// takeOver permits seizing a server agent owned by a different install.
	takeOver bool
}

// installDesktop is idempotent and convergent: every run rewrites the .app
// bundle and both launchd plists, then bootstraps-or-force-restarts each agent.
// This is what makes `curl … | install.sh` hands-off on both a fresh install
// and an update — a stale, already-running tray is killed and relaunched onto
// the freshly installed binary, and a freshly written agent is started now
// (not just at next login).
//
// That convergence is preserved for the TRAY agent, where a restart costs the
// user nothing. The SERVER agent is now gated by launchdsvc.DecideTakeover:
// the labels are global per login session, so a second install used to seize a
// running control plane — swapping the binary under a server that was mid-run,
// and respawning it via KeepAlive when the user killed it. See serverAgentStep.
func installDesktop() error { return installDesktopWith(installOptions{}) }

func installDesktopWith(opts installOptions) error {
	// Decide about the server agent BEFORE writing anything: a refusal must
	// leave the other install's files exactly as they were.
	decision, plistData, staleRuns := serverAgentDecision(opts)
	if decision.Action == launchdsvc.ActionRefuse {
		existing, _ := launchdsvc.ReadPlistOwner(serverPlistPath())
		return fmt.Errorf(
			"refusing to take over the AgentField server agent: %s\n"+
				"  currently registered: %s\n"+
				"  this install would use: %s\n"+
				"Re-run with --take-over to replace it, or AGENTFIELD_INSTALL_FORCE_RESTART=1 to force the old behaviour",
			decision.Reason, existing.Program, serverBinaryPath())
	}

	for _, d := range []string{logsDir(), launchAgentsDir(),
		filepath.Join(appBundleDir(), "Contents", "MacOS"),
		filepath.Join(appBundleDir(), "Contents", "Resources")} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return fmt.Errorf("mkdir %s: %w", d, err)
		}
	}

	// Build the .app bundle around a copy of ourselves. Using rename-over means
	// we can safely replace the binary even while an old tray is executing it.
	self, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate self: %w", err)
	}
	selfData, err := os.ReadFile(self)
	if err != nil {
		return fmt.Errorf("read self: %w", err)
	}
	if err := writeFileAtomic(trayBundleBinaryPath(), selfData, 0o755); err != nil {
		return fmt.Errorf("install tray binary: %w", err)
	}
	if err := writeFileAtomic(filepath.Join(appBundleDir(), "Contents", "Resources", "appicon.icns"), appIconICNS, 0o644); err != nil {
		return fmt.Errorf("write app icon: %w", err)
	}
	if err := writeFileAtomic(filepath.Join(appBundleDir(), "Contents", "Info.plist"), []byte(infoPlist()), 0o644); err != nil {
		return fmt.Errorf("write Info.plist: %w", err)
	}

	// launchd agents.
	if err := writeFileAtomic(serverPlistPath(), plistData, 0o644); err != nil {
		return fmt.Errorf("write server plist: %w", err)
	}
	if err := writeFileAtomic(trayPlistPath(), []byte(trayPlist()), 0o644); err != nil {
		return fmt.Errorf("write tray plist: %w", err)
	}

	// The tray agent keeps converging unconditionally: restarting a menu-bar
	// app interrupts no work, and a stale tray running yesterday's binary is
	// exactly what this is for.
	reloadAgent(trayPlistPath(), trayLabel)

	// The server agent follows the policy decided above.
	switch decision.Action {
	case launchdsvc.ActionSkip:
		fmt.Println("AgentField server: already up to date; leaving it running.")
	case launchdsvc.ActionWriteOnly:
		fmt.Printf("AgentField server: %s — not restarting.%s\n",
			decision.Reason, staleSuffix(staleRuns))
		fmt.Println("  The new version takes effect on the next restart " +
			"(menu-bar Restart, or `af service restart`).")
	default:
		if decision.Reason == "server running and idle" {
			fmt.Println("AgentField server: running and idle — restarting onto the new version.")
		}
		reloadAgent(serverPlistPath(), serverLabel)
	}

	fmt.Println("AgentField desktop tray installed. Look for the icon in your menu bar.")
	return nil
}

// serverAgentDecision probes the current server agent and applies the takeover
// policy. It returns the decision and the plist bytes the install would write,
// so the caller can both act on the decision and avoid regenerating the plist.
func serverAgentDecision(opts installOptions) (launchdsvc.TakeoverDecision, []byte, int) {
	want := []byte(serverPlist())

	existing, plistExists := launchdsvc.ReadPlistOwner(serverPlistPath())
	sameOwner := !plistExists || launchdsvc.SameOwner(existing, launchdsvc.PlistOwner{
		Program:          serverBinaryPath(),
		WorkingDirectory: agentfieldDir(),
	})

	stale := 0
	in := launchdsvc.TakeoverInputs{
		PlistExists:  plistExists,
		SameOwner:    sameOwner,
		LabelLoaded:  agentLoaded(serverLabel),
		ForceEnv:     os.Getenv("AGENTFIELD_INSTALL_FORCE_RESTART") == "1",
		DeferFlag:    opts.deferRestart,
		TakeOverFlag: opts.takeOver,
	}
	if in.LabelLoaded {
		in.ServerHealthy = launchdsvc.ServerHealthy(serverPort())
		if in.ServerHealthy {
			// An unreadable endpoint (auth, older server) reports ok=false and
			// is treated as not-busy: an install must not be blocked forever by
			// a probe it cannot interpret.
			// Only runs that have done something recently block a restart;
			// a wedged run left in the active list forever must not pin an
			// install to an old binary. See launchdsvc.ActiveWindow.
			if n, s, ok := launchdsvc.ActiveExecutions(serverPort(), os.Getenv("AGENTFIELD_API_KEY")); ok {
				in.ActiveExecutions = n
				stale = s
			}
		}
	}
	// Up to date means: the plist we would write already on disk, and the
	// target binary already carrying the bytes we would install.
	in.Identical = plistExists &&
		launchdsvc.FileHasContents(serverPlistPath(), want) &&
		trayBundleUpToDate()

	return launchdsvc.DecideTakeover(in), want, stale
}

// staleSuffix names runs the probe deliberately ignored, so a user who reads
// "1 workflow in flight" against a server they believe is idle can see that the
// harness already discounted the wedged ones.
func staleSuffix(stale int) string {
	if stale <= 0 {
		return ""
	}
	return fmt.Sprintf(" (ignored %d stale run(s) with no activity for over %s)",
		stale, launchdsvc.ActiveWindow())
}

// trayBundleUpToDate reports whether the installed tray binary is already the
// one we are about to write — the other half of the "nothing changed" test.
func trayBundleUpToDate() bool {
	self, err := os.Executable()
	if err != nil {
		return false
	}
	selfSum, ok := launchdsvc.FileSHA256(self)
	if !ok {
		return false
	}
	installedSum, ok := launchdsvc.FileSHA256(trayBundleBinaryPath())
	if !ok {
		return false
	}
	return selfSum == installedSum
}

func uninstallDesktop() error {
	_ = bootoutAgent(trayLabel)
	_ = bootoutAgent(serverLabel)
	_ = os.Remove(trayPlistPath())
	_ = os.Remove(serverPlistPath())
	_ = os.RemoveAll(appBundleDir())
	fmt.Println("AgentField desktop tray removed.")
	return nil
}

// ---- Server lifecycle (driven from the tray menu) --------------------------

func startServer() error {
	if !agentLoaded(serverLabel) {
		_ = bootstrapAgent(serverPlistPath())
	}
	return kickstartAgent(serverLabel, false)
}

// stopServer sends SIGTERM for a graceful shutdown. Because the server plist
// uses KeepAlive={SuccessfulExit: false}, a clean exit is not relaunched — so
// "Stop" actually stops it, while a genuine crash still auto-restarts.
func stopServer() error {
	return launchdsvc.SignalAg
```

### Core Architecture Module: `control-plane/cmd/af-tray/main.go`
```
// Command af-tray is the AgentField menu-bar companion.
//
// It is a small, separate binary from the main `af`/agentfield control-plane
// binary on purpose: it carries the GUI/systray dependency so the server binary
// never has to. In a headless deployment (Railway, ECS, EC2, a container) the
// tray simply is never installed or run — and if it is run there anyway, it
// detects the absence of a GUI session and exits cleanly instead of crashing.
//
// Subcommands:
//
//	af-tray run         Run the menu-bar tray (default).
//	af-tray install     Install the desktop tray + control-plane autostart (macOS).
//	af-tray uninstall   Remove the desktop tray and autostart.
//	af-tray version     Print version.
//
// The platform-specific behaviour lives in tray_darwin.go / launchd_darwin.go
// (real implementation) and tray_other.go (no-op stubs for every other OS).
package main

import (
	"fmt"
	"os"
)

// Build-time version information (set via ldflags during build).
var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

// run dispatches a subcommand and returns the process exit code. It is split
// out of main so it can be unit-tested without spawning a process.
func run(args []string) int {
	cmd := "run"
	if len(args) > 0 {
		cmd = args[0]
	}

	switch cmd {
	case "run":
		if err := runTray(); err != nil {
			fmt.Fprintln(os.Stderr, "af-tray:", err)
			return 1
		}
	case "install":
		if err := installDesktopWith(parseInstallOptions(args[1:])); err != nil {
			fmt.Fprintln(os.Stderr, "af-tray install:", err)
			return 1
		}
	case "uninstall":
		if err := uninstallDesktop(); err != nil {
			fmt.Fprintln(os.Stderr, "af-tray uninstall:", err)
			return 1
		}
	case "version", "--version", "-v":
		fmt.Printf("af-tray %s (%s) %s\n", version, commit, date)
	case "help", "--help", "-h":
		printUsage()
	default:
		printUsage()
		return 2
	}
	return 0
}

// parseInstallOptions reads the install-mode flags. Unknown arguments are
// ignored rather than rejected: install.sh may pass flags a newer installer
// script knows about but an older tray binary does not, and a hands-off
// `curl … | bash` must not fail on that.
func parseInstallOptions(args []string) installOptions {
	var opts installOptions
	for _, a := range args {
		switch a {
		case "--defer-restart":
			opts.deferRestart = true
		case "--take-over":
			opts.takeOver = true
		}
	}
	return opts
}

func printUsage() {
	fmt.Print(`af-tray — AgentField menu-bar companion

Usage:
  af-tray run         Run the menu-bar tray (default)
  af-tray install     Install the desktop tray + control-plane autostart (macOS)
  af-tray uninstall   Remove the desktop tray and control-plane autostart
  af-tray version     Print version information

Install flags:
  --defer-restart   Update files but never restart a running control plane
  --take-over       Replace a launchd agent registered by a different install
`)
}

```

### Core Architecture Module: `control-plane/cmd/af-tray/menu_icons_darwin.go`
```
//go:build darwin

package main

import _ "embed"

// Menu-item icons. The line icons are from Lucide (https://lucide.dev, ISC),
// rendered to 32×32 PNG (16pt @2x) as black-on-transparent so they are applied
// as macOS *template* images and recolor themselves to match the menu in both
// light and dark mode. The dot-* icons are colored status indicators applied as
// regular (non-template) images so their color is preserved. See
// assets/icons/LICENSE.md.

//go:embed assets/icons/bot.png
var iconBot []byte

//go:embed assets/icons/circle-check.png
var iconSuccess []byte

//go:embed assets/icons/gauge.png
var iconGauge []byte

//go:embed assets/icons/cpu.png
var iconCPU []byte

//go:embed assets/icons/chart-column.png
var iconUsage []byte

// Traffic-light variants of the metric icons (green good, yellow caution, red
// bad), applied as regular (colored) images based on each stat's threshold.
//
//go:embed assets/icons/circle-check-green.png
var iconSuccessGreen []byte

//go:embed assets/icons/circle-check-yellow.png
var iconSuccessYellow []byte

//go:embed assets/icons/circle-check-red.png
var iconSuccessRed []byte

//go:embed assets/icons/gauge-green.png
var iconGaugeGreen []byte

//go:embed assets/icons/gauge-yellow.png
var iconGaugeYellow []byte

//go:embed assets/icons/gauge-red.png
var iconGaugeRed []byte

//go:embed assets/icons/cpu-green.png
var iconCPUGreen []byte

//go:embed assets/icons/cpu-yellow.png
var iconCPUYellow []byte

//go:embed assets/icons/cpu-red.png
var iconCPURed []byte

//go:embed assets/icons/layout-dashboard.png
var iconDashboard []byte

//go:embed assets/icons/server.png
var iconServer []byte

//go:embed assets/icons/scroll-text.png
var iconLogs []byte

//go:embed assets/icons/key.png
var iconKey []byte

//go:embed assets/icons/power.png
var iconPower []byte

//go:embed assets/icons/dot-green.png
var iconDotGreen []byte

//go:embed assets/icons/dot-red.png
var iconDotRed []byte

//go:embed assets/icons/dot-gray.png
var iconDotGray []byte

```

### Core Architecture Module: `control-plane/cmd/af-tray/metrics_darwin.go`
```
//go:build darwin

package main

import (
	"os/exec"
	"strconv"
	"strings"
)

// serverMemoryMB returns the resident set size of the running control-plane
// process in megabytes, or 0 if it can't be determined. The Prometheus
// /metrics endpoint only exports Go runtime memory (a few MB of heap), which
// understates the real footprint, so we read the OS's RSS for the process
// directly. Best-effort: any failure just hides the memory figure.
func serverMemoryMB() int {
	pid := serverPID()
	if pid == "" {
		return 0
	}
	// `ps -o rss=` prints resident size in kilobytes with no header.
	out, err := exec.Command("ps", "-o", "rss=", "-p", pid).Output()
	if err != nil {
		return 0
	}
	kb, err := strconv.Atoi(strings.TrimSpace(string(out)))
	if err != nil || kb <= 0 {
		return 0
	}
	return kb / 1024
}

// serverPID finds the control-plane server process. It matches the `server`
// subcommand of the installed binary so it doesn't accidentally match the tray
// or an `af` CLI invocation.
func serverPID() string {
	out, err := exec.Command("pgrep", "-f", "agentfield server").Output()
	if err != nil {
		return ""
	}
	// pgrep may return multiple pids (one per line); take the first.
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if p := strings.TrimSpace(line); p != "" {
			return p
		}
	}
	return ""
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1075** (2026-09-29): **fix(sdk): probe harness binaries as argv, not a cmd.exe command string**
  *Symptoms*: Fixes CodeQL alerts 60, 61, 62 on `sdk/typescript/src/harness/availability.ts`, without opening #63 in their place.  ## What changed  `defaultVersionProbe` runs `<binary> --version` for `harnessDoctor()`. Node refuses to spawn `.cmd`/`.bat` without a shell (CVE-2024-27980), so on Windows those shims go through `cmd.exe`.  - **Original (main):** a quoted `cmd.exe /d /s /c ""<path>" "--version""` line. It was safe from injection, but it concatenated the resolved path into the command string, which is what CodeQL flagged. A `%VAR%` in a path was also expanded. - **Earlier heads of this PR:** `cmd.exe /d /c <path> --version` as separate argv elements. This cleared #60–#62 but raised #63, and it let cmd.exe re-parse the path. **A directory named `paren) & echo PWNED2 (x` ran the injected command.** Paths containing `&`, `^` or `;,=` failed the probe. - **Now (2a6ed6b0):** the `/c` line is a fixed template, `""%AGENTFIELD_PROBE_ARG_0%" "%AGENTFIELD_PROBE_ARG_1%""`. The path and args are set in the child's environment. cmd.exe expands each variable once, after it has split the line, so every metacharacter in the path stays literal. No path data reaches the command string. `/v:off` keeps `!` literal. The non-batch path (`execFile(bin, args)`) is unchanged.  ## Verification  Real `cmd.exe` (Windows 11 26200, Node 22.0.0), via each version's actual `harnessDoctor` bundled with esbuild, against a `.cmd` shim in each directory:  | shim directory | main | previous head 5711218 | this head
  **Post-Mortem & Fix Analysis**:
  > ## Performance  | SDK | Memory | Δ | Latency | Δ | Tests | Status | |-----|--------|---|---------|---|-------|--------| | TS | 346 B | -1% | 1.90 µs | -5% | ✓ | ✓ |  ✓ No regressions detected 
  > ## 📊 Coverage gate  Thresholds from [`.coverage-gate.toml`](../../.coverage-gate.toml): per-surface ≥ **84%**, aggregate ≥ **85%**, max per-surface regression ≤ **1.0 pp**, max aggregate regression ≤ **0.50 pp**.  | Surface | Current | Baseline | Δ | | | --- | ---: | ---: | ---: | :---: | | `control-plane` | 87.90% | 87.40% | ↑ +0.50 pp | 🟡 | | `sdk-go` | 93.30% | 92.00% | ↑ +1.30 pp | 🟢 | | `sdk-python` | 94.72% | 93.73% | ↑ +0.99 pp | 🟢 | | `sdk-typescript` | 91.84% | 90.42% | ↑ +1.42 pp | 🟢 | | `web-ui` | 84.76% | 84.79% | ↓ -0.03 pp | 🟡 | | **aggregate** | **85.92%** | **85.75%** | **↑ +0.17 pp** | 🟡 |  ### ✅ Gate passed  No surface regressed past the allowed threshold and the aggregate stayed above the floor.  <!-- Sticky Pull Request Commentcoverage-gate -->
  > ## 📐 Patch coverage gate  Threshold: **80%** on lines this PR touches vs `origin/main` (from `.coverage-gate.toml:thresholds.min_patch`).  | Surface | Touched lines | Patch coverage | Status | | --- | ---: | ---: | :---: | | `control-plane` | 0 | — | ➖ no changes | | `sdk-go` | 0 | — | ➖ no changes | | `sdk-python` | 0 | — | ➖ no changes | | `sdk-typescript` | 8 | **100.00%** | ✅ | | `web-ui` | 0 | — | ➖ no changes |  ### ✅ Patch gate passed  Every surface whose lines were touched by this PR has patch coverage at or above the threshold.  <!-- Sticky Pull Request Commentpatch-coverage-gate -->

- **Issue #1059** (2026-09-21): **Stale execution reaper times out a parent right after its child completes**
  *Symptoms*: ## Summary  The stale execution reaper can mark a running parent execution as timed out in the short gap between its child finishing and the parent reporting its own result. The parent's later success callback is then rejected with HTTP 409 because the execution is already terminal.  ## How it happens  1. A parent execution calls a child and waits. While it waits, the parent's own `updated_at` does not change. 2. `MarkStaleExecutions` and `MarkStaleWorkflowExecutions` skip a stale parent only while it has a child in `running`, `pending` or `queued` (plus `waiting` for workflows):    ```sql    AND NOT EXISTS (        SELECT 1 FROM executions c        WHERE c.parent_execution_id = e.execution_id          AND c.status IN ('running', 'pending', 'queued')    )    ``` 3. When the child posts `succeeded`, that guard disappears at once. Nothing refreshes the parent's activity time. 4. The parent needs some time, measured at roughly 50–600 ms, to receive the child result and post its own status. 5. If the cleanup tick lands in that window and the parent's `updated_at` is older than the stale threshold, the parent and its workflow are set to `timeout` with `execution timed out (no activity)`. 6. The parent's real `succeeded` callback gets a 409.  Code: `control-plane/internal/storage/execution_records.go`, `MarkStaleExecutions` and `MarkStaleWorkflowExecutions`.  #1046 (`78215f17`) doesn't cover this. That fix protects a workflow whose own execution activity clock advances. Here the pa
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/webhook_router.py (matched: out, out, out, out) - ./.env.example (matched: example) - ./main.py (matched: main)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Hi. I would like to work on this. Is this issue available for me to pick up?

- **Issue #1047** (2026-09-19): **bug: workflow stale-sweeper reaps active executions on a frozen clock**
  *Symptoms*: ## Report  The workflow cleanup query reads `workflow_executions.updated_at`, while heartbeat and status writes update `executions.updated_at`. During a leaf wait, the execution timestamp moves and the workflow timestamp stays old. The cleanup query can therefore reap a workflow whose paired execution is still active.  We saw this in four coder runs. Each was reaped 10 to 13 minutes after starting on a 10-minute fuse. Heartbeats were arriving every 90 seconds. One run was reaped 57 seconds after its latest heartbeat. File commits continued after the reap, and the late completion updates returned HTTP 409 because the records were already terminal.  [#1040](https://github.com/Agent-Field/agentfield/issues/1040) is related, but the cause differs. That issue involved timezone comparison. This issue involves the workflow timestamp remaining unchanged during a leaf wait.  ## Proposed change  When a workflow has a paired active execution, require both activity timestamps to be older than the stale cutoff before reaping it. Recent activity on either row should keep the workflow alive. A workflow with no paired active execution should retain the existing cleanup behavior.  ## Working implementation  [#1046](https://github.com/Agent-Field/agentfield/pull/1046) implements the query-side version of this proposal. It joins the workflow row to its paired active execution, compares both `COALESCE` activity timestamps with the cutoff, and keeps the existing terminal-state synchronization.  T
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/helpers.py (matched: per)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Fixed and merged upstream, closing this.  - #1046 changes the workflow reaper to consult the execution activity clock instead of the frozen workflow timestamp. - #1051, merged 2026-09-18, rebinds the transactional prepares and guards the stale retry path. - #1062, merged 2026-09-19, mirrors the reaper parent/child and approval guards into the retry path.  The four reaped coder runs in the report were 10 to 13 minutes into a 10 minute fuse with heartbeats arriving every 90 seconds, which is the frozen-clock path #1046 removes. Reopen if the same pattern shows up on a current build.

- **Issue #1040** (2026-09-06): **[Control Plane] SQLite cleanup can time out fresh executions with non-UTC timestamps**
  *Symptoms*:    ## Summary     When AgentField uses local SQLite storage on a host with a non-UTC timezone, the execution-cleanup reaper can mark a fresh, active execution as timed out.     The affected rows contain timestamps with a local timezone offset, while the cleanup cutoff is generated in  UTC. SQLite can compare these timestamp values lexicographically as text instead of comparing the represented  instants.     ## Observed behavior     A disposable SWE-AF planning run on AgentField `v0.1.138-rc.9` was marked with:     ```text    execution timed out (no activity)  ```   The configured stale timeout was 30 minutes, but the execution was marked timed out approximately 108 seconds  after it started. Later successful status callbacks were rejected with HTTP 409 because the execution had already  become terminal.   Example values from the affected path:   ```text    stored updated_at: 2026-09-03 06:52:18.193275-05:00    UTC equivalent:    2026-09-03 11:52:18.193275Z    cleanup cutoff:    2026-09-03 11:24:05+00:00  ```   The stored timestamp is newer than the cutoff by instant, so it should not be considered stale. However, the  textual comparison evaluates incorrectly:   ```sql    SELECT      '2026-09-03 06:52:18.193275-05:00'      <=      '2026-09-03 11:24:05+00:00';    -- 1     SELECT      julianday('2026-09-03 06:52:18.193275-05:00')      <=      julianday('2026-09-03 11:24:05+00:00');    -- 0  ```   ## Likely cause   The stale-selection queries use:   ```sql    COALESCE(updated_at,
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/webhook_router.py (matched: out, out, out, out, reasoner) - ./.env.example (matched: example) - ./reasoners/models.py (matched: reasoner) - ./reasoners/__init__.py (matched: reasoner) - ./reasoners/conversational.py (matched: reasoner)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->

- **Issue #1034** (2026-09-09): **[Python SDK] Trouble with cross agent pydantic (un)marshalling**
  *Symptoms*: ## Describe the bug  <!-- A clear and concise description of what the bug is. --> Sometimes complex pydantic models in reasoners and skills and multiple arguments can cause the inputs paramters to become a simple `dict`, forcing pydantic model coercion.   And a side note: sometimes the parameters being put inside `TYPE_CHECK` blocks also builds properly but crash during deployment.   ## Steps to reproduce  Using parameters like:   - `item: PydanticModel1 | PydanticModel2 | None = None` - `items: list[PydanticModel1] | list[PydanticModel2] | None = None` - `maybe_empty_sequence: Sequence[PydanticModel1 | None] = []`  In most cases, those fall through and crash during runtime. Nested JSON under the `input` can cause this as well.   Using the new RUFF 0.16 UP rules might have to do with this since it prefers using `list[model] | None` instead of `Optional[List[model]]` on newer python versions  ## Expected behavior  <!-- Describe what you expected to happen. --> Inputs and outputs always recursively validate if they are a pydantic model, inputs are ensured to be an instance of the model / dataclass. Outputs survives roundrip losslessly    ## Screenshots / Logs  <!-- If applicable, add screenshots or logs to help explain the problem. -->  ## Environment  - Control plane version: 0.1.127 - SDK version (if applicable): 0.1.130 - Deployment environment (local, docker, kubernetes, etc.):  ## Additional context  <!-- Add any other context about the problem here. --> Another side note:
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/models.py (matched: models, reasoners, model, model, model) - ./reasoners/helpers.py (matched: reasoners, help) - ./cla-signatures.json (matched: json) - ./reasoners/__init__.py (matched: reasoners) - ./reasoners/conversational.py (matched: reasoners)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->

- **Issue #987** (2026-09-21): **[Control Plane] Kubernetes new deployments causes every in-flight run to fail and never recover**
  *Symptoms*: ## Describe the bug  <!-- A clear and concise description of what the bug is. --> When there's a reasoner that is acting like an orchestrator, and can take 5-10 minutes to complete, it has a high chance of destroying the entire run (which is composed by multiple reasoners and skills) with the "in-flight reasoner cannot be revived" error.  The only workaround is to re-run the same entrypoint reasoner with the same inputs and start again. Happily, when this is done, the run will blast through until the step where it got killed due the persisted intermediary steps and the 1h cache that is enabled.  ## Steps to reproduce  1. Go to '...' 2. Run '...' 3. See error  ## Expected behavior  <!-- Describe what you expected to happen. -->  When a reasoner or skill gets killed, there should be a way to restart the root run, keeping the same execution ID so the external consumers don't need to implement any sort of retries or re-submission.  It's a trade-off for the immutability and deterministic behavior that is expected when you call the same reasoner with the same input, but generates different execution / run IDS, should be an opt-in flag  ## Screenshots / Logs  <!-- If applicable, add screenshots or logs to help explain the problem. -->  ## Environment  - Control plane version: 0.1.127 - SDK version (if applicable): Python SDK - Deployment environment (local, docker, kubernetes, etc.): Kubernetes  ## Additional context  <!-- Add any other context about the problem here. --> 
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/helpers.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner, help) - ./reasoners/models.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner) - ./reasoners/__init__.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner) - ./reasoners/conversational.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner) - ./reasoners/repo_config.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Where this stands after v0.1.137 (released yesterday):  The root cause is fixed. Re-registration used to synchronously fail every non-terminal execution for the agent id, so under `maxSurge` the new pod killed the old pod's still-running work. Now executions carry the `instance_id` that dispatched them, the reap is scoped to the departing instance and deferred by `AGENTFIELD_AGENT_DRAIN_GRACE` (default 60s) — a completion arriving inside that window wins — and dispatch to a pod that just announced shutdown is held for `AGENTFIELD_AGENT_RESTART_GRACE` and retried on the replacement instead of 503ing (#1004). All three SDKs drain in-flight reasoners under `AGENTFIELD_SHUTDOWN_TIMEOUT` (#1000, #1006), and `af server` itself drains on SIGTERM (#1010, #1011).  Two things you need to set for 5–10 minute orchestrators, because the defaults are sized for short reasoners: - `AGENTFIELD_AGENT_DRAIN_GRACE` ≥ the longest reasoner you want to protect (e.g. `15m`). The reap fires that long after the
  > Yes agree on all 3 @AbirAbbas GTG 

- **Issue #986** (2026-09-21): **[Control Plane] Execution queue doesn't behave like a queue**
  *Symptoms*: ## Describe the bug  <!-- A clear and concise description of what the bug is. -->  When the max parallel executions are reached, any new exec async request will hard fail instead of returning an execution ID and queueing it to be executed. This forces to use an external queueing solution (Redis / Durable) just for making sure a burst of 300 requests don't bring everything down, which happens quite often and the AF CP get's killed and the pod is evicted then restarted.  ## Steps to reproduce  1. Go to '...' 2. Run '...' 3. See error  ## Expected behavior  <!-- Describe what you expected to happen. -->  ## Screenshots / Logs  <!-- If applicable, add screenshots or logs to help explain the problem. -->  ## Environment  - Control plane version: 0.1.127 - SDK version (if applicable): - Deployment environment (local, docker, kubernetes, etc.): Kubernetes  ## Additional context  <!-- Add any other context about the problem here. --> 
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/helpers.py (matched: help)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Shipping state, then the design question.  v0.1.137 (#1001) fixes the part that was making bursts destructive: a rejected async execute no longer writes anything — the per-agent gate and the queue check run before the payload blob and the two execution rows — 429 and 503 carry `Retry-After` plus a `retry_after` field, the async pool drains on shutdown (queued and in-flight jobs get a terminal `control_plane_shutdown` instead of staying `running` forever), and workers default to `max(NumCPU, 16)` with a 1024-deep queue, so ~1040 async executions are admitted before the first 503 — a much larger window than 0.1.127 had. Knobs: `AGENTFIELD_EXEC_ASYNC_WORKERS`, `AGENTFIELD_EXEC_ASYNC_QUEUE_CAPACITY`, `AGENTFIELD_MAX_EXECUTE_BODY_BYTES`. One thing worth setting now: `AGENTFIELD_MAX_CONCURRENT_PER_AGENT` (default 0 = unlimited), because with it unset the burst lands in your agent pod rather than at the control plane.  #1033 finishes the contract: the sync, restart and MCP lanes also gate bef
  > @pocesar Thanks !   Yes, I would prioritize bounded rejections first as immediate work and lets add a milestone for queue, actually potentially letting us even add priority and other scheduling ideas in modular way to control at constrained time which gets pulled in. @AbirAbbas can you scope a rough milestone for this? 

- **Issue #985** (2026-09-21): **[Python SDK] Structured logs, event loop and Postgres instance**
  *Symptoms*: ## Describe the bug  <!-- A clear and concise description of what the bug is. --> https://github.com/Agent-Field/agentfield/blob/4d4d54e402bc89c6d0e52e8c826d679409214778/sdk/python/agentfield/logger.py#L178-L184  `_emit_structured_record` do 2 things at once:  1. Dumps to stdout, that depending on the size of the payload (ie >1MB) it will block the event loop if the stdout is for any reason busy or slow. logging default `StreamHandler` uses a `threading.RLock` internally also, for double trouble, besides the Agentfield logger also using another global lock instance https://github.com/Agent-Field/agentfield/blob/4d4d54e402bc89c6d0e52e8c826d679409214778/sdk/python/agentfield/logger.py#L81-L89 In highly concurrent or heavy I/O driven deployments, it's a dice roll until something stalls. 3. The only way to omit this JSON dump is to manually patch `_emit_structured_record` and `_emit_plain` the agentfield logger module during initialization and make it a no-op.   Ideally it should be an opt-in. There's a ambiguous env var `AGENTFIELD_LOGS_ENABLED` but it's a misnomer, since what it does is to watch for its own process stdout / stderr and intercept that.   https://github.com/Agent-Field/agentfield/blob/4d4d54e402bc89c6d0e52e8c826d679409214778/sdk/python/agentfield/node_logs.py#L223-L232  ## Steps to reproduce  1. Go to '...' 2. Run '...' 3. See error  ## Expected behavior  <!-- Describe what you expected to happen. -->  When logs are enabled but no stdout setting (that doesn't exis
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/helpers.py (matched: reason, help) - ./cla-signatures.json (matched: json) - ./.env.example (matched: env) - ./reasoners/models.py (matched: reason) - ./reasoners/__init__.py (matched: reason)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Implemented in PR #994.  - Changed: Added `AGENTFIELD_LOG_STDOUT` to disable structured execution record mirroring to stdout while preserving control-plane dispatch; the default remains enabled. - Tests: `uv run --frozen pytest sdk/python/tests/test_logger.py -q` (14 passed). - Validation: Ruff check, Ruff format check, and `git diff --check` passed.  PR: https://github.com/Agent-Field/agentfield/pull/994 
  > @mikemikimike thanks for stepping up, although #994 is just a partial fix for the issue. thread / async mixing is still in place, mostly due to how node_logger is wired

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

### Incident Patch 1: `bf118593` (2026-09-29)
**Commit Message**: fix(sdk): probe harness binaries as argv, not a cmd.exe command string (#1075)

* fix(sdk): probe harness binaries as argv, not cmd.exe /c

CodeQL alerts 60, 61, and 62 flag defaultVersionProbe for building a
cmd.exe /c command line from a resolved binary path. Pass that path as
an execFile argv element instead. PATHEXT resolution is unchanged.

Assisted-by: CodeAF (grok-4.7)
Co-Authored-By: CodeAF <267109073+agentfield-bot@users.noreply.github.com>

* fix(sdk): run Windows batch probes as separate cmd.exe argv

Node rejects execFile of a .cmd or .bat (CVE-2024-27980). Keep cmd.exe
as the interpreter for those shims only, and pass /d, /s, /c, the
resolved path, and the version args as separate argv elements.

Assisted-by: CodeAF (grok-4.7)
Co-Authored-By: CodeAF <267109073+agentfield-bot@users.noreply.github.com>

* fix(sdk): drop cmd /s from the Windows batch version probe

Node quotes an argv element that contains spaces. cmd /s then strips the
outer quotes of the whole line and splits C:\Program Files\.... Pass
/d /c and the resolved path as separate argv elements, with no /s and
no joined command string.

Assisted-by: CodeAF (grok-4.7)
Co-Authored-By: CodeAF <267109073+agentfie

**File**: `sdk/typescript/src/harness/availability.ts` (modified, +34/-11)
```diff
@@ -195,26 +195,49 @@ function isWindowsBatchFile(command: string): boolean {
     && WINDOWS_BATCH_EXTENSIONS.has(path.extname(command).toLowerCase());
 }
 
-/** Quote one token for a `cmd.exe /s /c` line; the whole line gets outer quotes. */
-function quoteCmdToken(value: string): string {
-  return `"${value.replace(/"/g, '""')}"`;
+const BATCH_PROBE_ENV_PREFIX = 'AGENTFIELD_PROBE_ARG_';
+
+/**
+ * Build a `cmd.exe` invocation for a `.cmd`/`.bat` shim. Node refuses to spawn
+ * batch files without a shell (CVE-2024-27980), so they have to go through
+ * cmd.exe. The `/c` line is a fixed template of `%VAR%` references; the path
+ * and arguments travel in the child's environment. cmd.exe expands each
+ * variable once, after it has split the line, and the template quotes every
+ * reference, so `&`, `^`, `(`, `%` and spaces in a path stay literal. Passing
+ * the path as a bare argv element instead breaks on `&` and `(x86)` because
+ * cmd.exe without `/s` drops the quotes Node adds.
+ */
+function batchProbeInvocation(command: string[]): {
+  file: string;
+  args: string[];
+  env: NodeJS.ProcessEnv;
+} {
+  const env: NodeJS.ProcessEnv = { ...process.env };
+  const tokens = command.map((value, index) => {
+    const name = `${BATCH_PROBE_ENV_PREFIX}${index}`;
+    env[name] = value;
+    return `"%${name}%"`;
+  });
+  return {
+    file: process.env.ComSpec ?? 'cmd.exe',
+    // /s strips only the outermost quote pair, leaving each "%VAR%" quoted.
+    // /v:off keeps ! in a path literal even if delayed expansion is enabled.
+    args: ['/d', '/v:off', '/s', '/c', `"${tokens.join(' ')}"`],
+    env,
+  };
 }
 
 async function defaultVersionProbe(command: string[]): Promise<string> {
   const { execFile } = await import('node:child_process');
   return new Promise((resolve, reject) => {
-    // Node refuses to spawn batch files without a shell (CVE-2024-27980), so
-    // Windows .cmd/.bat shims run through cmd.exe. The /s outer-quote form
-    // keeps resolved paths containing spaces intact.
     const batch = isWindowsBatchFile(command[0]);
-    const file = batch ? (process.env.ComSpec ?? 'cmd.exe') : command[0];
-    const args = batch
-      ? ['/d', '/s', '/c', `"${command.map(quoteCmdToken).join(' ')}"`]
-      : command.slice(1);
+    const { file, args, env } = batch
+      ? batchProbeInvocation(command)
+      : { file: command[0], args: command.slice(1), env: process.env };
     execFile(
       file,
       args,
-      { timeout: 2_000, windowsHide: true, windowsVerbatimArguments: batch },
+      { timeout: 2_000, windowsHide: true, windowsVerbatimArguments: batch, env },
       (error, stdout, stderr) => {
         if (error) {
           reject(error);
```

**File**: `sdk/typescript/tests/harness_doctor.test.ts` (modified, +19/-4)
```diff
@@ -207,21 +207,36 @@ describe('harness provider availability', () => {
     expect(health).toMatchObject({ version: 'opencode 1.0.0', usable: true, issues: [] });
   });
 
-  it('routes Windows batch shims through cmd.exe for the default version probe', async () => {
+  it('keeps a Windows batch shim path out of the cmd.exe command line', async () => {
+    // Locks the invocation contract only. The mock does not execute cmd.exe.
     const platform = Object.getOwnPropertyDescriptor(process, 'platform');
     Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
     mockExecFileOutput('codex-cli 9.9.9\n');
+    const shim = 'C:\\Program Files (x86)\\R&D ^%x%!\\npm\\codex.cmd';
 
     try {
       const [health] = await harnessDoctor(['codex'], {
         env: {},
-        resolveBinary: () => 'C:\\Program Files\\npm\\codex.cmd',
+        resolveBinary: () => shim,
       });
 
       expect(execFileMock).toHaveBeenCalledWith(
         process.env.ComSpec ?? 'cmd.exe',
-        ['/d', '/s', '/c', '""C:\\Program Files\\npm\\codex.cmd" "--version""'],
-        expect.objectContaining({ windowsHide: true, windowsVerbatimArguments: true }),
+        [
+          '/d',
+          '/v:off',
+          '/s',
+          '/c',
+          '""%AGENTFIELD_PROBE_ARG_0%" "%AGENTFIELD_PROBE_ARG_1%""',
+        ],
+        expect.objectContaining({
+          windowsHide: true,
+          windowsVerbatimArguments: true,
+          env: expect.objectContaining({
+            AGENTFIELD_PROBE_ARG_0: shim,
+            AGENTFIELD_PROBE_ARG_1: '--version',
+          }),
+        }),
         expect.any(Function)
       );
       expect(health).toMatchObject({ version: 'codex-cli 9.9.9', usable: true, issues: [] });
```

---

### Incident Patch 2: `8805c960` (2026-09-25)
**Commit Message**: fix(sdk/python): skip schema output dir for schema-free harness runs (#1072)

HarnessRunner.run() allocated the per-run .agentfield-out-* directory
before dispatching the provider even when schema is None. That directory
only ever holds .agentfield_output.json (#684, #891), and every consumer
of it is already inside an `if schema is not None` guard, so a text-only
run paid a filesystem write it never read back. When the project root
could not accept one — a read-only mount, an immutable CI workspace — a
plain permission_mode="plan" call failed during setup, before the coding
agent was invoked at all.

Allocate the directory only for schema-bearing runs. Their per-run
isolation and cleanup are unchanged, so concurrent runs sharing one cwd
still cannot overwrite or delete each other's output.

Refs #684, #891

**File**: `sdk/python/agentfield/harness/_runner.py` (modified, +12/-9)
```diff
@@ -294,15 +294,18 @@ async def run(
         # project_dir, or cwd when project_dir is unset. Besides keeping the file
         # inside the agent root, this prevents concurrent runs sharing one cwd
         # from overwriting or deleting each other's fixed output filename.
-        resolved_project_dir = options.get("project_dir")
-        if isinstance(resolved_project_dir, str) and resolved_project_dir:
-            base_dir = resolved_project_dir
-        else:
-            base_dir = resolved_cwd
-        os.makedirs(base_dir, exist_ok=True)
-        temp_output_dir: Optional[str] = tempfile.mkdtemp(
-            prefix=".agentfield-out-", dir=base_dir
-        )
+        # A schema-free run never writes or reads that file, so it must not need
+        # a writable root either: allocating one unconditionally aborted
+        # text-only permission_mode="plan" dispatches before the provider ran.
+        temp_output_dir: Optional[str] = None
+        if schema is not None:
+            resolved_project_dir = options.get("project_dir")
+            if isinstance(resolved_project_dir, str) and resolved_project_dir:
+                base_dir = resolved_project_dir
+            else:
+                base_dir = resolved_cwd
+            os.makedirs(base_dir, exist_ok=True)
+            temp_output_dir = tempfile.mkdtemp(prefix=".agentfield-out-", dir=base_dir)
         output_dir = temp_output_dir
 
         # schema_mode selects how the agent is asked to produce the output:
```

**File**: `sdk/python/tests/test_harness_runner.py` (modified, +33/-0)
```diff
@@ -240,6 +240,39 @@ async def test_run_without_schema_returns_plain_harness_result(tmp_path):
     assert result.session_id == "sess-1"
 
 
+@pytest.mark.asyncio
+async def test_run_without_schema_does_not_require_writable_project_dir(tmp_path):
+    """A schema-free run must reach the provider without allocating artifacts.
+
+    The per-run ``.agentfield-out-*`` directory only exists to hold the schema
+    output file (#684, #891). Allocating it unconditionally aborted a text-only
+    ``permission_mode="plan"`` run during setup, before the provider was ever
+    dispatched, whenever the project root could not be written to.
+    """
+    blocker = tmp_path / "blocker.txt"
+    blocker.write_text("not a directory", encoding="utf-8")
+    # Cannot be created on any platform: its parent is a regular file.
+    unwritable_root = blocker / "project"
+
+    provider = MockProvider([RawResult(result="plan text")])
+    runner = HarnessRunner()
+
+    with patch("agentfield.harness._runner.build_provider", return_value=provider):
+        result = await runner.run(
+            "hello",
+            provider="codex",
+            permission_mode="plan",
+            cwd=str(tmp_path),
+            project_dir=str(unwritable_root),
+        )
+
+    assert provider.call_count == 1, "schema-free run must dispatch the provider"
+    assert result.is_error is False
+    assert result.result == "plan text"
+    assert result.parsed is None
+    assert list(tmp_path.glob(".agentfield-out-*")) == []
+
+
 @pytest.mark.asyncio
 async def test_run_with_schema_injects_prompt_suffix_and_parses_output(tmp_path):
     provider = FileWritingProvider(json.dumps({"name": "ok", "count": 1}))
```

---

### Incident Patch 3: `2f41660b` (2026-09-21)
**Commit Message**: fix(control-plane): don't reap a parent whose child just finished (#1059) (#1063)

* fix(control-plane): don't reap a parent whose child just finished

Closes #1059. The stale reaper could time out a running parent in the
brief window (~50-600ms) between its child reaching a terminal state and
the parent posting its own result. The parent's own updated_at does not
move while it waits on the child, and the existing guard only skipped a
parent while it had a non-terminal child. The moment the child posted
succeeded, the guard vanished and nothing refreshed the parent's clock,
so the reaper could mark the parent (and its workflow) timeout, and the
parent's real success callback was then rejected with HTTP 409.

Fix (issue's Option 1, query-contained): in MarkStaleExecutions and
MarkStaleWorkflowExecutions, also skip a parent when a child reached a
terminal state after the cutoff (COALESCE(c.completed_at, c.updated_at)
> cutoff). A child that finished long before the cutoff no longer
shields the parent, so genuinely stuck parents are still reaped and
orphan cleanup keeps working.

Timeout children are excluded from the shield (c.status != 'timeout'):
the reaper's own kills set a recent

**File**: `control-plane/internal/storage/execution_records.go` (modified, +79/-15)
```diff
@@ -31,6 +31,23 @@ func (ls *LocalStorage) staleTimestampExpr(col string) string {
 	return "julianday(" + col + ")"
 }
 
+// childTerminalRecencyExpr returns an expression for "the later of a child's
+// control-plane record time (updated_at) and its agent-reported completion
+// time (completed_at)". completed_at is stored verbatim from the agent, so on a
+// skewed agent clock or a callback that took a while to land it can already be
+// older than the cutoff at the moment the control plane writes the terminal row
+// (issue #1059 review). updated_at is the control plane's own write clock, so
+// taking the maximum shields the parent whenever EITHER clock says the child
+// finished after the cutoff. On the executions table a terminal row's
+// updated_at is frozen (terminal->terminal is rejected), so this cannot shield
+// indefinitely.
+func (ls *LocalStorage) childTerminalRecencyExpr() string {
+	if ls.requireSQLDB().Mode() == "postgres" {
+		return "GREATEST(COALESCE(c.completed_at, c.updated_at), COALESCE(c.updated_at, c.completed_at))"
+	}
+	return "MAX(julianday(COALESCE(c.completed_at, c.updated_at)), julianday(COALESCE(c.updated_at, c.completed_at)))"
+}
+
 // maxNodesForDepthCalc caps the number of executions for which we compute DAG depth to avoid heavy queries.
 const maxNodesForDepthCalc = 1000
 
@@ -1180,11 +1197,17 @@ func parseTimeString(value string) (time.Time, error) {
 // non-terminal child are skipped. A parent's own updated_at stops moving while
 // it waits, so without this a long child call — one agent doing many minutes of
 // work in a single request — reaps its whole ancestor chain even though real
-// work is happening. Deliberately no recency test on the child: the chain
-// unwinds bottom-up instead. If work genuinely stops, the leaf goes stale and
-// is reaped first, which makes its parent childless and eligible on the next
-// sweep, and so on up. Nothing is stuck forever; it just takes one sweep per
-// level.
+// work is happening.
+//
+// A child that reached a terminal state after the cutoff also shields its parent
+// for one stale window, covering the brief gap between a child reporting success
+// and the parent posting its own result (issue #1059). timeout children are
+// excluded from this so the reaper's own kills cannot perpetuate a shield.
+// Consequence: a non-timeout child that just finished delays its parent's reap
+// by up to one stale window, so the bottom-up chain unwind can take a stale
+// window per level rather than a single sweep. Nothing is stuck forever — a
+// child that finished before the cutoff no longer shields, so the chain always
+// drains.
 // The conditional UPDATE re-evaluates the staleness predicates so a row that
 // gains activity after selection is left alone.
 func (ls *LocalStorage) MarkStaleExecutions(ctx context.Context, staleAfter time.Duration, limit int) (int, error) {
@@ -1205,6 +1228,14 @@ func (ls *LocalStorage) markStaleExecutions(ctx context.Context, staleAfter time
 	tsExpr := ls.staleTimestampExpr("COALESCE(updated_at, created_at, started_at)")
 	executionUpdateTSExpr := ls.staleTimestampExpr("COALESCE(e.updated_at, e.created_at, e.started_at)")
 	cutoffExpr := ls.staleTimestampExpr("?")
+	// A child that reached a terminal state after the cutoff also shields its
+	// parent. When a child finishes, the parent needs a brief window (~50-600ms)
+	// to receive the result and post its own status; the parent's own updated_at
+	// does not move while it waits. Without this the reaper can time the parent
+	// out in that window, and the parent's real success callback then gets a 409.
+	// A child that finished long before the cutoff no longer shields the parent,
+	// so a genuinely stuck parent is still reaped (see issue #1059).
+	childRecencyTSExpr := ls.childTerminalRecencyExpr()
 	rows, err := db.QueryContext(ctx, `
 		SELECT execution_id, started_at
 		FROM executions e
@@ -1213,10 +1244,13 @@ func (ls *LocalStorage) markStaleExecutions(c
```

**File**: `control-plane/internal/storage/retry_stale_test.go` (modified, +35/-2)
```diff
@@ -669,15 +669,17 @@ func TestRetryStaleWorkflowExecutions_TerminalChildDoesNotShieldParent(t *testin
 	backdateExecutionUpdatedAt(t, ls, "executions", parentID, staleAt)
 
 	const childID = "exec-retry-terminal-child"
-	childWorkflow := retryTestWorkflow(childID, now)
+	// The child finished long before the cutoff (staleAt), so it is not live
+	// work and must not shield its stale parent from the retry sweep.
+	childWorkflow := retryTestWorkflow(childID, staleAt)
 	childWorkflow.Status = "succeeded"
 	childWorkflow.ParentExecutionID = strPtr(parentID)
 	require.NoError(t, ls.StoreWorkflowExecution(ctx, childWorkflow))
 
 	retried, err := ls.RetryStaleWorkflowExecutions(ctx, 30*time.Minute, 3, 100)
 	require.NoError(t, err)
 	require.Equal(t, []string{parentID}, retried,
-		"a terminal child is not live work and must not shield its stale parent")
+		"a long-finished terminal child is not live work and must not shield its stale parent")
 
 	parent, err := ls.GetWorkflowExecution(ctx, parentID)
 	require.NoError(t, err)
@@ -693,6 +695,37 @@ func TestRetryStaleWorkflowExecutions_TerminalChildDoesNotShieldParent(t *testin
 	require.Equal(t, "succeeded", child.Status, "the terminal child must stay terminal")
 }
 
+// TestRetryStaleWorkflowExecutions_RecentlyFinishedChildShieldsParent guards
+// the retry half of issue #1059: the retry sweep runs before both reapers when
+// max_retries > 0, so without the recent-terminal-child shield it resets a
+// live parent to pending in the brief window between a child reporting success
+// and the parent posting its own result.
+func TestRetryStaleWorkflowExecutions_RecentlyFinishedChildShieldsParent(t *testing.T) {
+	ls, ctx := setupRetryTestStorage(t)
+	now := time.Now().UTC()
+	staleAt := now.Add(-2 * time.Hour)
+
+	const parentID = "exec-retry-parent-recent-child"
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, retryTestWorkflow(parentID, staleAt)))
+	require.NoError(t, ls.CreateExecutionRecord(ctx, retryTestExecution(parentID, staleAt)))
+	backdateExecutionUpdatedAt(t, ls, "executions", parentID, staleAt)
+
+	const childID = "exec-retry-recent-child"
+	childWorkflow := retryTestWorkflow(childID, now) // just succeeded
+	childWorkflow.Status = "succeeded"
+	childWorkflow.ParentExecutionID = strPtr(parentID)
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, childWorkflow))
+
+	retried, err := ls.RetryStaleWorkflowExecutions(ctx, 30*time.Minute, 3, 100)
+	require.NoError(t, err)
+	require.Empty(t, retried, "parent must not be retried while its child only just finished")
+
+	parent, err := ls.GetWorkflowExecution(ctx, parentID)
+	require.NoError(t, err)
+	require.Equal(t, "running", parent.Status)
+	require.Equal(t, 0, parent.RetryCount)
+}
+
 // TestRetryStaleWorkflowExecutions_BatchReportsOnlyMovedCandidates covers the
 // batch accounting contract: when one sweep selects several stale candidates
 // and only some of them lose their paired execution to a heartbeat between the
```

**File**: `control-plane/internal/storage/stale_execution_parent_test.go` (modified, +155/-4)
```diff
@@ -96,10 +96,10 @@ func TestMarkStaleExecutions_UnwindsChainBottomUp(t *testing.T) {
 	require.Equal(t, "timeout", executionStatus(t, ls, "exec-build"))
 }
 
-// TestMarkStaleExecutions_TerminalChildDoesNotShieldParent: only a
-// *non-terminal* child protects a parent. A finished child must not keep a
-// genuinely stuck parent alive.
-func TestMarkStaleExecutions_TerminalChildDoesNotShieldParent(t *testing.T) {
+// TestMarkStaleExecutions_LongFinishedChildDoesNotShieldParent: a child that
+// reached a terminal state *before* the cutoff no longer protects a genuinely
+// stuck parent, so orphan cleanup keeps working (issue #1059 acceptance).
+func TestMarkStaleExecutions_LongFinishedChildDoesNotShieldParent(t *testing.T) {
 	ls, ctx := setupTestLocalStorage(t)
 	now := time.Now().UTC()
 
@@ -115,6 +115,10 @@ func TestMarkStaleExecutions_TerminalChildDoesNotShieldParent(t *testing.T) {
 		ParentExecutionID: strPtr("exec-build"),
 	}
 	require.NoError(t, ls.CreateExecutionRecord(ctx, done))
+	// The child finished an hour ago — well before the 30-minute cutoff — so it
+	// must not shield the stuck parent. CreateExecutionRecord stamps updated_at
+	// at "now", so backdate it to make the completion genuinely old.
+	backdateExecutionUpdatedAt(t, ls, "executions", "exec-done", now.Add(-time.Hour))
 
 	reaped, err := ls.MarkStaleExecutions(ctx, 30*time.Minute, 100)
 	require.NoError(t, err)
@@ -123,6 +127,63 @@ func TestMarkStaleExecutions_TerminalChildDoesNotShieldParent(t *testing.T) {
 	require.Equal(t, "succeeded", executionStatus(t, ls, "exec-done"), "terminal child untouched")
 }
 
+// TestMarkStaleExecutions_RecentlyFinishedChildShieldsParent guards issue #1059:
+// a child that reached a terminal state *after* the cutoff protects its parent
+// during the brief window between the child reporting success and the parent
+// posting its own result. Without this the parent is timed out mid-flight and
+// its real success callback is rejected with HTTP 409.
+func TestMarkStaleExecutions_RecentlyFinishedChildShieldsParent(t *testing.T) {
+	ls, ctx := setupTestLocalStorage(t)
+	now := time.Now().UTC()
+
+	// Parent is stale by its own clock (idle 1h while it waited on the child).
+	newRunningExecution(t, ls, "exec-build", "", time.Hour)
+	// Child just succeeded (updated_at ~= now, well after the 30-minute cutoff).
+	done := &types.Execution{
+		ExecutionID:       "exec-done",
+		RunID:             "run-parented",
+		AgentNodeID:       "agent-1",
+		ReasonerID:        "reasoner-1",
+		NodeID:            "node-1",
+		Status:            "succeeded",
+		StartedAt:         now.Add(-2 * time.Hour),
+		ParentExecutionID: strPtr("exec-build"),
+	}
+	require.NoError(t, ls.CreateExecutionRecord(ctx, done))
+
+	reaped, err := ls.MarkStaleExecutions(ctx, 30*time.Minute, 100)
+	require.NoError(t, err)
+	require.Equal(t, 0, reaped, "parent must survive while its child only just finished")
+	require.Equal(t, "running", executionStatus(t, ls, "exec-build"))
+}
+
+// TestMarkStaleExecutions_TimeoutChildDoesNotShieldParent: a child the reaper
+// itself timed out must not shield its parent, even though its timeout is
+// recent — otherwise a reaped leaf would keep its stuck ancestor alive and the
+// bottom-up unwind (one level per sweep) would stall.
+func TestMarkStaleExecutions_TimeoutChildDoesNotShieldParent(t *testing.T) {
+	ls, ctx := setupTestLocalStorage(t)
+	now := time.Now().UTC()
+
+	newRunningExecution(t, ls, "exec-build", "", time.Hour)
+	timedOut := &types.Execution{
+		ExecutionID:       "exec-timeout",
+		RunID:             "run-parented",
+		AgentNodeID:       "agent-1",
+		ReasonerID:        "reasoner-1",
+		NodeID:            "node-1",
+		Status:            "timeout",
+		StartedAt:         now.Add(-2 * time.Hour),
+		ParentExecutionID: strPtr("exec-build"),
+	}
+	require.NoError(t, ls.CreateExecutionRecord(ctx, timedOut))
+
+	reaped, err := ls.MarkStaleExecutions(ctx, 30*time.Minute, 100)
+	require.NoError(t, err)
+	require.Eq
```

---

### Incident Patch 4: `00c8844e` (2026-09-21)
**Commit Message**: fix(sdk/python): stop the structured log stdout write from blocking the event loop (#1066)

* feat(sdk/python): add a bounded, non-blocking stdout writer for log lines

A single daemon thread drains a bounded FIFO of (stream, line) pairs.
Deferral only engages where it can help — the caller is on a running event
loop and the destination has a real file descriptor — so synchronous callers
and in-memory captures keep writing inline and stay immediately visible.

Under back-pressure the queue discards its oldest pending lines instead of
blocking the producer, and the writer emits one log.dropped record per
destination naming the count, so loss is never silent. An atexit drain
bounded by AGENTFIELD_LOG_QUEUE_FLUSH_SECONDS covers normal shutdown, and an
at-fork hook gives the child fresh state.

Refs #985

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

* fix(sdk/python): stop the structured log mirror from blocking the event loop

_emit_structured_record printed inline on the calling thread, which in an
agent node is the event loop, into the _TeeTextIO wrapper over a real pipe.
A consumer that stops draining that pipe froze the whole loop for the
duration — heartbea

**File**: `docs/ENVIRONMENT_VARIABLES.md` (modified, +3/-0)
```diff
@@ -200,6 +200,9 @@ AGENTFIELD_CONNECTOR_CAP_DID_MANAGEMENT=false
 
 - `AGENTFIELD_LOGS_ENABLED` (default: `true`): Enables Python, Go, and TypeScript agent-node stdout/stderr capture and the `/agentfield/v1/logs` endpoint. This controls capture, not control-plane execution-log dispatch.
 - `AGENTFIELD_LOG_STDOUT` (read by Python, Go, and TypeScript; default: on): Controls whether structured execution records are mirrored to stdout as JSON. Set to `0`, `false`, `no`, or `off` (case-insensitive, surrounding whitespace ignored) to suppress the mirror; control-plane dispatch continues unchanged for records carrying an execution ID. Any other value — including `1`, `true`, `yes`, an unset variable and a set-but-empty one — keeps the mirror on, so a typo cannot silently drop log output. All three SDKs skip control-plane dispatch for a record with no execution id, so such records are stdout-only and disabling the mirror drops them entirely. Because the node-log ring behind `GET /agentfield/v1/logs` is fed by the process's captured stdout, disabling the mirror also removes structured records from that ring.
+- `AGENTFIELD_LOG_QUEUE` (Python only; default: on): Defers SDK logger writes to a dedicated writer when logging from a running event loop to stdout backed by a real file descriptor. Set to `0`, `false`, `no`, or `off` (case-insensitive, surrounding whitespace ignored) to restore inline synchronous writes; any other value, including an unset or set-but-empty value, keeps deferral enabled. Calls outside a running event loop and writes to captures such as `StringIO` remain inline unless an SDK log backlog already exists. Structured and human-readable SDK logger lines share the FIFO and retain their relative order, but ordering between those lines and a user's own bare `print()` calls is not guaranteed.
+- `AGENTFIELD_LOG_QUEUE_SIZE` (Python only; default: `1024` lines): Maximum number of pending SDK logger lines. Integers below 1 are clamped to 1 and non-integers use the default. When stdout back-pressure fills the queue, the oldest pending lines are discarded without blocking the producer; once a later line can be written to the same output destination, a structured `log.dropped` warning reports the number discarded for that destination.
+- `AGENTFIELD_LOG_QUEUE_FLUSH_SECONDS` (Python only; default: `2.0` seconds): Bounds the interpreter-exit wait for pending SDK logger lines. Negative values are clamped to zero; invalid and non-finite values use the default. A permanently stalled stdout therefore cannot hang normal interpreter shutdown. `os._exit()` bypasses Python's exit handlers and this flush; use `AGENTFIELD_LOG_QUEUE=false` when a process requires inline writes before such an exit.
 - `AGENTFIELD_LOG_TRUNCATE` (Python default: `200` characters): Truncates human-readable plain log messages and visible plain-log payloads. It does not truncate structured records.
 - `AGENTFIELD_LOG_PAYLOADS` (Python default: `false`): Shows payloads in human-readable plain logs when `true`. Structured execution attributes are unaffected.
 - `AGENTFIELD_LOG_MAX_LINE_BYTES` (default: `16384`): Maximum process-log line size in bytes. Python clamps every integer below 256 (including zero and negatives) to 256; Go and TypeScript instead reject values below 256 and use the 16384-byte default. Python and Go reject non-integers, while TypeScript prefix-parses them (`512abc` becomes `512`). Thus a value of `100` yields an effective cap of 256 in Python and 16384 in Go and TypeScript: in those two SDKs there is no minimum, only a rejection *upward* to the default, so asking for a smaller cap silently gives you a 64x larger one. In Python this cap applies both to the stdout/stderr tee feeding `/agentfield/v1/logs` and to structured-mirror elision; the mirror elides attributes, then the message or entire record as needed so the complete JSON envelope remains valid JSON within the cap.
```

**File**: `sdk/python/README.md` (modified, +1/-0)
```diff
@@ -187,6 +187,7 @@ for mount layout, `call_local`, error behavior, and limitations.
 ## Logging
 
 - `AGENTFIELD_LOG_STDOUT` controls the on-by-default structured JSON mirror. Set it to `0`, `false`, `no`, or `off` to disable the mirror; execution-scoped records still dispatch to the control plane.
+- `AGENTFIELD_LOG_QUEUE` controls the Python SDK's bounded stdout writer queue. It is enabled by default for real-fd writes made from a running event loop; see the environment-variable reference for queue sizing, overflow, shutdown, and opt-out details.
 - `AGENTFIELD_LOG_MAX_LINE_BYTES` defaults to 16384 bytes and clamps any integer below 256 to 256. It limits both captured stdout/stderr lines and structured-mirror records; non-integers use the default.
 - `AGENTFIELD_LOGS_ENABLED` controls stdout/stderr capture and the node logs endpoint only, not control-plane execution-log dispatch.
 - `AGENTFIELD_LOG_LEVEL` controls human-readable Python SDK logging and defaults to `WARNING`.
```

**File**: `sdk/python/agentfield/log_writer.py` (added, +302/-0)
```diff
@@ -0,0 +1,302 @@
+"""Bounded, non-blocking stdout writer for SDK log lines."""
+
+from __future__ import annotations
+
+import asyncio
+import atexit
+import json
+import math
+import os
+import queue
+import sys
+import threading
+import time
+from datetime import datetime, timezone
+from typing import Any, Dict, Optional, TextIO, Tuple, cast
+
+
+_DEFAULT_QUEUE_SIZE = 1024
+_DEFAULT_FLUSH_SECONDS = 2.0
+_FALSE_VALUES = ("0", "false", "no", "off")
+
+_state_lock = threading.Lock()
+_queue: "queue.Queue[Optional[Tuple[TextIO, str]]]" = queue.Queue(
+    maxsize=_DEFAULT_QUEUE_SIZE
+)
+_worker: Optional[threading.Thread] = None
+_dropped: Dict[TextIO, int] = {}
+_active = False
+
+
+def _queue_enabled() -> bool:
+    value = os.getenv("AGENTFIELD_LOG_QUEUE", "true").strip().lower()
+    return value not in _FALSE_VALUES
+
+
+def _queue_size() -> int:
+    raw = os.getenv("AGENTFIELD_LOG_QUEUE_SIZE", str(_DEFAULT_QUEUE_SIZE))
+    try:
+        return max(1, int(raw, 10))
+    except ValueError:
+        return _DEFAULT_QUEUE_SIZE
+
+
+def _flush_seconds() -> float:
+    raw = os.getenv("AGENTFIELD_LOG_QUEUE_FLUSH_SECONDS", str(_DEFAULT_FLUSH_SECONDS))
+    try:
+        value = float(raw)
+    except ValueError:
+        return _DEFAULT_FLUSH_SECONDS
+    if not math.isfinite(value):
+        return _DEFAULT_FLUSH_SECONDS
+    return max(0.0, value)
+
+
+def _has_real_fileno(stream: TextIO) -> bool:
+    try:
+        return isinstance(stream.fileno(), int)
+    except Exception:
+        return False
+
+
+def _has_running_loop() -> bool:
+    try:
+        asyncio.get_running_loop()
+    except RuntimeError:
+        return False
+    return True
+
+
+def _write_line(stream: TextIO, line: str) -> bool:
+    try:
+        stream.write(line + "\n")
+        stream.flush()
+    except Exception:
+        return False
+    return True
+
+
+def _drop_marker(count: int) -> str:
+    timestamp = (
+        datetime.now(timezone.utc)
+        .isoformat(timespec="milliseconds")
+        .replace("+00:00", "Z")
+    )
+    return json.dumps(
+        {
+            "ts": timestamp,
+            "level": "warning",
+            "source": "sdk.python.logger",
+            "event_type": "log.dropped",
+            "message": (f"dropped {count} structured log lines (stdout back-pressure)"),
+            "attributes": {"dropped": count},
+            "system_generated": True,
+        },
+        separators=(",", ":"),
+    )
+
+
+def _worker_main(
+    work_queue: "queue.Queue[Optional[Tuple[TextIO, str]]]",
+) -> None:
+    global _active, _worker
+
+    current = threading.current_thread()
+    try:
+        while True:
+            item = work_queue.get()
+            if item is None:
+                work_queue.task_done()
+                return
+
+            stream, line = item
+            dropped = 0
+            with _state_lock:
+                _active = True
+                dropped = _dropped.pop(stream, 0)
+
+            try:
+                if dropped and not _write_line(stream, _drop_marker(dropped)):
+                    with _state_lock:
+                        _dropped[stream] = _dropped.get(stream, 0) + dropped
+                _write_line(stream, line)
+            except Exception:
+                # The worker is deliberately immortal for ordinary failures.
+                pass
+            finally:
+                with _state_lock:
+                    _active = False
+                work_queue.task_done()
+    except Exception:
+        # Queue and marker failures must not escape the daemon thread either.
+        pass
+    finally:
+        with _state_lock:
+            _active = False
+            if _worker is current:
+                _worker = None
+
+
+def _start_worker_locked(
+    work_queue: "queue.Queue[Optional[Tuple[TextIO, str]]]",
+) -> bool:
+    global _worker
+
+    if _worker is not None and _worker.is_alive():
+        return True
+
+    worker = threading.Thread(
+        target=_worker_
```

**File**: `sdk/python/agentfield/logger.py` (modified, +37/-4)
```diff
@@ -11,12 +11,12 @@
 import json
 import logging
 import os
-import sys
 import threading
 from datetime import datetime, timezone
 from enum import Enum
 from typing import TYPE_CHECKING, Any, Dict, Optional
 
+from . import log_writer
 from .execution_context import ExecutionContext, get_current_context
 
 if TYPE_CHECKING:
@@ -44,13 +44,46 @@ class LogLevel(Enum):
     ERROR = "ERROR"
 
 
+class _UncontendedHandlerLock:
+    """A no-op stand-in for ``logging.Handler``'s serialization lock.
+
+    ``Handler.handle()`` holds that lock across ``emit()``. A synchronous
+    thread blocked inline on a stalled stdout would therefore hold it for the
+    length of the stall and block an event-loop caller before it ever reached
+    the bounded writer — the exact stall this module exists to remove. The
+    writer serializes stdout itself, so the handler needs no lock of its own.
+
+    ``None`` is not usable here: Python 3.13 changed ``handle()`` from
+    ``acquire()``/``release()`` (which skip a falsy lock) to ``with
+    self.lock:``, which raises ``TypeError`` on ``None``.
+    """
+
+    def acquire(self, blocking: bool = True, timeout: float = -1) -> bool:
+        return True
+
+    def release(self) -> None:
+        pass
+
+    def __enter__(self) -> "_UncontendedHandlerLock":
+        return self
+
+    def __exit__(self, *exc_info: Any) -> bool:
+        return False
+
+    def _at_fork_reinit(self) -> None:
+        pass
+
+
 class _DynamicStdoutHandler(logging.Handler):
     """A handler that resolves stdout at emit time so a later tee sees logs."""
 
+    def createLock(self) -> None:
+        """Let the shared writer serialize without blocking event-loop callers."""
+        self.lock = _UncontendedHandlerLock()  # type: ignore[assignment]
+
     def emit(self, record: logging.LogRecord) -> None:
         try:
-            sys.stdout.write(self.format(record) + self.terminator)
-            sys.stdout.flush()
+            log_writer.emit_line(self.format(record))
         except Exception:
             # Logging is always best-effort and must not fail SDK callers.
             self.handleError(record)
@@ -192,7 +225,7 @@ def _emit_structured_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
         try:
             if self._stdout_mirror_enabled():
                 line = self._bounded_mirror_line(record)
-                print(line, file=sys.stdout, flush=True)
+                log_writer.emit_line(line)
         except Exception:
             # Broken stdout and capture-ring contention must never affect execution.
             pass
```

**File**: `sdk/python/agentfield/node_logs.py` (modified, +30/-3)
```diff
@@ -211,6 +211,7 @@ def isatty(self) -> bool:
 
 _global_ring: Optional[ProcessLogRing] = None
 _tee_installed = False
+_installed_tees: List[_TeeTextIO] = []
 
 
 def logs_enabled() -> bool:
@@ -243,16 +244,42 @@ def get_ring() -> ProcessLogRing:
 
 def install_stdio_tee() -> None:
     """Replace sys.stdout/sys.stderr with tees into the process log ring."""
-    global _tee_installed
+    global _installed_tees, _tee_installed
     if _tee_installed or not logs_enabled():
         return
     ring = get_ring()
     ml = max_line_bytes()
-    sys.stdout = _TeeTextIO("stdout", cast(TextIO, sys.__stdout__), ring, ml)
-    sys.stderr = _TeeTextIO("stderr", cast(TextIO, sys.__stderr__), ring, ml)
+    stdout_tee = _TeeTextIO("stdout", cast(TextIO, sys.__stdout__), ring, ml)
+    stderr_tee = _TeeTextIO("stderr", cast(TextIO, sys.__stderr__), ring, ml)
+    _installed_tees = [stdout_tee, stderr_tee]
+    sys.stdout = stdout_tee
+    sys.stderr = stderr_tee
     _tee_installed = True
 
 
+def _after_fork_child() -> None:
+    """Replace locks whose owning threads do not survive into a fork child."""
+    global _follow_lock, _follow_queues
+
+    rings: List[ProcessLogRing] = []
+    for tee in _installed_tees:
+        tee._write_lock = threading.Lock()
+        tee._buf = ""
+        if all(tee._ring is not ring for ring in rings):
+            rings.append(tee._ring)
+    if _global_ring is not None and all(_global_ring is not ring for ring in rings):
+        rings.append(_global_ring)
+    for ring in rings:
+        ring._lock = threading.Lock()
+
+    _follow_lock = threading.Lock()
+    _follow_queues = []
+
+
+if hasattr(os, "register_at_fork"):
+    os.register_at_fork(after_in_child=_after_fork_child)
+
+
 def verify_internal_bearer(authorization_header: Optional[str]) -> bool:
     token = os.getenv("AGENTFIELD_AUTHORIZATION_INTERNAL_TOKEN", "").strip()
     if not token:
```

---

### Incident Patch 5: `c5407ca1` (2026-09-19)
**Commit Message**: fix(storage): mirror reaper parent/child and approval guards in stale retry (#1062)

* issue/reaper-retry-child-guard: mirror reaper parent/child and approval guards in stale retry

* chore(reaper-retry-child-guard): checkpoint uncommitted issue work

**File**: `control-plane/internal/storage/execution_records.go` (modified, +12/-0)
```diff
@@ -1605,6 +1605,12 @@ func (ls *LocalStorage) retryStaleWorkflowExecutions(ctx context.Context, staleA
 		  AND w.retry_count < ?
 		  AND `+workflowTSExpr+` <= `+cutoffExpr+`
 		  AND (e.execution_id IS NULL OR `+executionTSExpr+` <= `+cutoffExpr+`)
+		  AND COALESCE(w.approval_status, '') != 'pending'
+		  AND NOT EXISTS (
+		      SELECT 1 FROM workflow_executions c
+		      WHERE c.parent_execution_id = w.execution_id
+		        AND c.status IN ('running', 'pending', 'queued', 'waiting')
+		  )
 		ORDER BY `+workflowTSExpr+` ASC
 		LIMIT ?`, maxRetries, cutoff, cutoff, limit)
 	if err != nil {
@@ -1666,6 +1672,12 @@ func (ls *LocalStorage) retryStaleWorkflowExecutions(ctx context.Context, staleA
 		            AND e.status IN ('running', 'pending', 'queued', 'waiting')
 		            AND `+executionTSExpr+` <= `+cutoffExpr+`
 		      )
+		  )
+		  AND COALESCE(w.approval_status, '') != 'pending'
+		  AND NOT EXISTS (
+		      SELECT 1 FROM workflow_executions c
+		      WHERE c.parent_execution_id = w.execution_id
+		        AND c.status IN ('running', 'pending', 'queued', 'waiting')
 		  )`)
 	if err != nil {
 		return nil, fmt.Errorf("prepare retry statement: %w", err)
```

**File**: `control-plane/internal/storage/retry_stale_test.go` (modified, +154/-0)
```diff
@@ -539,6 +539,160 @@ func TestRetryStaleWorkflowExecutions_TerminalPairedExecutionStillRetried(t *tes
 		"the terminal execution half must keep its committed timestamp")
 }
 
+// TestStaleParentWithLiveChildIsSparedByReaperAndRetry is the regression for
+// the reaper's parent/child guard leaking into the retry sweep: a parent whose
+// own workflow and execution clocks are stale while it waits on a live child
+// must be spared by MarkStaleWorkflowExecutions and, equally, by
+// RetryStaleWorkflowExecutions. Without the child guard in the retry, the
+// parent is reset to pending and its paired execution is dragged back to
+// pending while the child is still working.
+func TestStaleParentWithLiveChildIsSparedByReaperAndRetry(t *testing.T) {
+	ls, ctx := setupRetryTestStorage(t)
+	now := time.Now().UTC()
+	staleAt := now.Add(-2 * time.Hour)
+
+	// Parent: both clocks are two hours stale, so absent the child guard it is
+	// a candidate for both sweeps.
+	const parentID = "exec-parent-live-child"
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, retryTestWorkflow(parentID, staleAt)))
+	require.NoError(t, ls.CreateExecutionRecord(ctx, retryTestExecution(parentID, staleAt)))
+	backdateExecutionUpdatedAt(t, ls, "executions", parentID, staleAt)
+
+	// Child: created now, still running, and parented to the parent. Its
+	// activity is what must shield the parent.
+	const childID = "exec-child-live"
+	childWorkflow := retryTestWorkflow(childID, now)
+	childWorkflow.ParentExecutionID = strPtr(parentID)
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, childWorkflow))
+
+	childExecution := retryTestExecution(childID, now)
+	childExecution.ParentExecutionID = strPtr(parentID)
+	require.NoError(t, ls.CreateExecutionRecord(ctx, childExecution))
+
+	parentBefore, err := ls.GetWorkflowExecution(ctx, parentID)
+	require.NoError(t, err)
+	childBefore, err := ls.GetWorkflowExecution(ctx, childID)
+	require.NoError(t, err)
+	childExecutionBefore, err := ls.GetExecutionRecord(ctx, childID)
+	require.NoError(t, err)
+
+	reaped, err := ls.MarkStaleWorkflowExecutions(ctx, 30*time.Minute, 100)
+	require.NoError(t, err)
+	require.Equal(t, 0, reaped, "a live child must shield its parent from the reaper")
+
+	retried, err := ls.RetryStaleWorkflowExecutions(ctx, 30*time.Minute, 3, 100)
+	require.NoError(t, err)
+	require.Empty(t, retried, "a live child must shield its parent from the retry sweep")
+
+	parent, err := ls.GetWorkflowExecution(ctx, parentID)
+	require.NoError(t, err)
+	require.Equal(t, "running", parent.Status)
+	require.Equal(t, 0, parent.RetryCount)
+	require.Nil(t, parent.ErrorMessage)
+	require.Nil(t, parent.CompletedAt)
+	require.True(t, parent.UpdatedAt.Equal(parentBefore.UpdatedAt),
+		"the parent must keep its committed updated_at")
+
+	parentExecution, err := ls.GetExecutionRecord(ctx, parentID)
+	require.NoError(t, err)
+	require.Equal(t, "running", parentExecution.Status)
+
+	child, err := ls.GetWorkflowExecution(ctx, childID)
+	require.NoError(t, err)
+	require.Equal(t, "running", child.Status)
+	require.Equal(t, 0, child.RetryCount)
+	require.Nil(t, child.CompletedAt)
+	require.True(t, child.UpdatedAt.Equal(childBefore.UpdatedAt), "the child must be untouched")
+
+	childExecutionAfter, err := ls.GetExecutionRecord(ctx, childID)
+	require.NoError(t, err)
+	require.Equal(t, "running", childExecutionAfter.Status)
+	require.True(t, childExecutionAfter.UpdatedAt.Equal(childExecutionBefore.UpdatedAt),
+		"the child execution must be untouched")
+}
+
+// TestRetryStaleWorkflowExecutions_ApprovalStatusGuard pins the approval half
+// of the mirrored guard pair: a stale workflow whose approval is still pending
+// must be spared by the retry sweep exactly as the reaper spares it, while a
+// stale workflow whose approval has been decided ('approved') remains a valid
+// retry candidate. Every other fixture in this file has a NULL approval_status
+// and is retried, which already covers the empty-string COALESCE branch.
+func TestR
```

---

### Incident Patch 6: `44d1022a` (2026-09-18)
**Commit Message**: fix(security): close open Dependabot vulnerability alerts (#1055)

* fix(security): close open Dependabot vulnerability alerts

Bump vulnerable dependencies across the monorepo to patched releases:

- next 15.5.25 + sharp 0.35.4 (rag evaluation UI RCE / libheif)
- js-yaml 4.3.2 (empty merge-source CPU DoS)
- fast-uri 3.1.7 (host confusion / SSRF)
- google.golang.org/grpc v1.83.2 (xDS authority DoS)
- browserslist 4.28.9 + baseline-browser-mapping 2.11.23
- hono 4.13.7 (toSSG path traversal)
- qs 6.16.0 (arrayLimit / isBuffer DoS)
- vitest / @vitest/mocker 4.1.11 (redirect mock path traversal)

Regenerated affected npm/pnpm lockfiles and go.sum.

Co-authored-by: Santosh kumar <santoshkumarradha@users.noreply.github.com>

* fix(security): regenerate npm lockfiles for npm ci sync

Full npm install (not package-lock-only) so control-plane web client
and desktop locks include all transitive deps required by npm ci.

Co-authored-by: Santosh kumar <santoshkumarradha@users.noreply.github.com>

* fix(security): close remaining Dependabot alerts

- @humanfs/node 0.16.8 (pnpm lock still had 0.16.7 symlink copy)
- postcss-selector-parser 6.1.4 (pnpm lock still had 6.1.2 AST DoS)
- @ai-sdk/prov

**File**: `control-plane/go.mod` (modified, +7/-7)
```diff
@@ -28,10 +28,10 @@ require (
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.43.0
 	go.opentelemetry.io/otel/sdk v1.44.0
 	go.opentelemetry.io/otel/trace v1.44.0
-	golang.org/x/crypto v0.52.0
-	golang.org/x/term v0.43.0
+	golang.org/x/crypto v0.55.0
+	golang.org/x/term v0.45.0
 	golang.org/x/time v0.15.0
-	google.golang.org/grpc v1.83.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/yaml.v3 v3.0.1
 	gorm.io/driver/postgres v1.5.11
@@ -109,10 +109,10 @@ require (
 	go.uber.org/atomic v1.9.0 // indirect
 	go.uber.org/multierr v1.9.0 // indirect
 	golang.org/x/arch v0.15.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
-	golang.org/x/sync v0.20.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
+	golang.org/x/sync v0.22.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	modernc.org/gc/v3 v3.0.0-20240107210532-573471604cb6 // indirect
```

**File**: `control-plane/go.sum` (modified, +18/-18)
```diff
@@ -240,38 +240,38 @@ go.uber.org/multierr v1.9.0 h1:7fIwc/ZtS0q++VgcfqFDxSBZVv/Xo49/SYnDFupUwlI=
 go.uber.org/multierr v1.9.0/go.mod h1:X2jQV1h+kxSjClGpnseKVIxpmcjrj7MNnI0bnlfKTVQ=
 golang.org/x/arch v0.15.0 h1:QtOrQd0bTUnhNVNndMpLHNWrDmYzZ2KDqSrEymqInZw=
 golang.org/x/arch v0.15.0/go.mod h1:JmwW7aLIoRUKgaTzhkiEFxvcEiQGyOg9BMonBJUS7EE=
-golang.org/x/crypto v0.52.0 h1:RMs7fP2rXdep0CftQlK8Uf+kibLm7qkCcradZWYz988=
-golang.org/x/crypto v0.52.0/go.mod h1:1QgfPxDqh0T2M/elOJtp9RvuR95kVjir0e6/BvEmGbc=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20231108232855-2478ac86f678 h1:mchzmB1XO2pMaKFRqk/+MV3mgGG96aqaPXaMifQU47w=
 golang.org/x/exp v0.0.0-20231108232855-2478ac86f678/go.mod h1:zk2irFbV9DP96SEBUUAy67IdHUaZuSnrz1n472HUCLE=
-golang.org/x/mod v0.35.0 h1:Ww1D637e6Pg+Zb2KrWfHQUnH2dQRLBQyAtpr/haaJeM=
-golang.org/x/mod v0.35.0/go.mod h1:+GwiRhIInF8wPm+4AoT6L0FA1QWAad3OMdTRx4tFYlU=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
-golang.org/x/sync v0.20.0 h1:e0PTpb7pjO8GAtTs2dQ6jYa5BWYlMuX047Dco/pItO4=
-golang.org/x/sync v0.20.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/mod v0.38.0 h1:MECBjubtXD7yj4HrhIUcywNaGeNVUdfVnxmPajOk4yk=
+golang.org/x/mod v0.38.0/go.mod h1:V6Xz0pq8TQ3dGqVQ1FVHuelZpAL0uNhSkk9ogYP3c40=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
+golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
+golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20210809222454-d867a43fc93e/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220811171246-fbc7d0a398ab/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.12.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
-golang.org/x/text v0.37.0 h1:Cqjiwd9eSg8e0QAkyCaQTNHFIIzWtidPahFWR83rTrc=
-golang.org/x/text v0.37.0/go.mod h1:a5sjxXGs9hsn/AJVwuElvCAo9v8QYLzvavO5z2PiM38=
+golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
+golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/term v0.45.0 h1:NwWyBmoJCbfTHpxrWoZ9C6/VxOf7ic219I8xZZFdrf0=
+golang.org/x/term v0.45.0/go.mod h1:9aqxs0blBcrm/n0L9QW0aRVD+ktan8ssZromtqJC43w=
+golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
+golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
-golang.org/x/tools v0.44.0 h1:UP4ajHPIcuMjT1GqzDWRlalUEoY+uzoZKnhOjbIPD2c=
-golang.org/x/tools v0.44.0/go.mod h1:KA0AfVErSdxRZIsOVipbv3rQhVXTnlU6UhKxHd1seDI=
+golang.org/x/tools v0.48.0 h1:3+hClM1aLL5mjMKm5ovokw9epgRXPuu2tILgismM6RE=
+golang.org/x/tools v0.48.0/go.mod h1:08xX0orndb/F7jJxGDicx061tyd5pcMto75YMAXr6lk=
 gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
 gonum.org/v1/gonum v0.17.0/go.mod h1:El3tOrEuMpv2UdMrbNlKEh9vd86bmQ6vqIcDwxEOc1E=
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4n
```

**File**: `control-plane/web/client/package-lock.json` (modified, +87/-79)
```diff
@@ -64,7 +64,7 @@
                 "@types/react": "^19.1.2",
                 "@types/react-dom": "^19.1.2",
                 "@vitejs/plugin-react": "^6.0.1",
-                "@vitest/coverage-v8": "^4.1.8",
+                "@vitest/coverage-v8": "^4.1.11",
                 "autoprefixer": "^10.4.21",
                 "eslint": "^9.25.0",
                 "eslint-plugin-react-hooks": "^5.2.0",
@@ -77,7 +77,7 @@
                 "typescript": "~5.8.3",
                 "typescript-eslint": "^8.30.1",
                 "vite": "^8.0.16",
-                "vitest": "^4.1.8"
+                "vitest": "^4.1.11"
             }
         },
         "node_modules/@adobe/css-tools": {
@@ -482,17 +482,17 @@
             }
         },
         "node_modules/@deck.gl/widgets": {
-            "version": "9.2.2",
-            "resolved": "https://registry.npmjs.org/@deck.gl/widgets/-/widgets-9.2.2.tgz",
-            "integrity": "sha512-CuXRMHlLU+3YJjbicxp84BtIks4dLVXm2txIwUQPHqZ99zSI30SQgnhHUOJi5tJMODLD26HaQaZo0Jp3Z+sRbQ==",
+            "version": "9.2.11",
+            "resolved": "https://registry.npmjs.org/@deck.gl/widgets/-/widgets-9.2.11.tgz",
+            "integrity": "sha512-90HWlQPsiRyTPWR4aYfLwnYDrJdHG2mqCzRcyMUKewWBNQLu4upB//l4ewIkUeXXCzAprjjVeRnNb7wdYj2CXQ==",
             "license": "MIT",
             "peer": true,
             "dependencies": {
                 "preact": "^10.17.0"
             },
             "peerDependencies": {
                 "@deck.gl/core": "~9.2.0",
-                "@luma.gl/core": "~9.2.2"
+                "@luma.gl/core": "~9.2.6"
             }
         },
         "node_modules/@emnapi/core": {
@@ -1366,9 +1366,9 @@
             "license": "MIT"
         },
         "node_modules/@luma.gl/core": {
-            "version": "9.2.4",
-            "resolved": "https://registry.npmjs.org/@luma.gl/core/-/core-9.2.4.tgz",
-            "integrity": "sha512-oYuHlpvd4e6E4hre7I7gnmCtcTDdpgREnumgjcPTe8VVsimnYM2P+vBqdOE7AUlOHDS8r//7YxM2bFvlDkcM8w==",
+            "version": "9.2.6",
+            "resolved": "https://registry.npmjs.org/@luma.gl/core/-/core-9.2.6.tgz",
+            "integrity": "sha512-d8KcH8ZZcjDAodSN/G2nueA9YE2X8kMz7Q0OxDGpCww6to1MZXM3Ydate/Jqsb5DDKVgUF6yD6RL8P5jOki9Yw==",
             "license": "MIT",
             "dependencies": {
                 "@math.gl/types": "^4.1.0",
@@ -3508,9 +3508,9 @@
             }
         },
         "node_modules/@testing-library/dom": {
-            "version": "10.4.1",
-            "resolved": "https://registry.npmjs.org/@testing-library/dom/-/dom-10.4.1.tgz",
-            "integrity": "sha512-o4PXJQidqJl82ckFaXUeoAW+XysPLauYI43Abki5hABd853iMhitooc6znOnczgbTYmEP6U6/y1ZyKAIsvMKGg==",
+            "version": "10.4.2",
+            "resolved": "https://registry.npmjs.org/@testing-library/dom/-/dom-10.4.2.tgz",
+            "integrity": "sha512-yzr2S9HyAIdhz2/6qHgbs665Q7PKVcDF05vsOlHPxG1mo36gKVesdYVeDLnXgfjJ03CrKRk08knc6+E/9m8v2Q==",
             "dev": true,
             "license": "MIT",
             "peer": true,
@@ -4149,14 +4149,14 @@
             }
         },
         "node_modules/@vitest/coverage-v8": {
-            "version": "4.1.8",
-            "resolved": "https://registry.npmjs.org/@vitest/coverage-v8/-/coverage-v8-4.1.8.tgz",
-            "integrity": "sha512-lt3kovsyHwYe00wq4D1ti0Z974fWj4NLp6siqiyEufUpyFwK9Yhi7rBhac9JL5aA0zoMrJqc4vYPZRUnI7l7nw==",
+            "version": "4.1.11",
+            "resolved": "https://registry.npmjs.org/@vitest/coverage-v8/-/coverage-v8-4.1.11.tgz",
+            "integrity": "sha512-8MVGEFnJIcdGjcbfKmeq8z0pZHH0JlVtoVZH9Q/qwUp6wyFnEJUBMrw9DCaj+ra3vShGmhavjalMIhPNxZAUcw==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
                 "@bcoe/v8-coverage": "^1.0.2",
-                "@vitest/utils": "4.1.8",
+                "@vitest/utils": "4.1.11",
                 "ast-v8-to-istanbul": "^1.0.0",
                 "istanbul-lib-coverage": "^3.2.2",
                 "
```

**File**: `control-plane/web/client/package.json` (modified, +14/-6)
```diff
@@ -69,7 +69,7 @@
         "@types/react": "^19.1.2",
         "@types/react-dom": "^19.1.2",
         "@vitejs/plugin-react": "^6.0.1",
-        "@vitest/coverage-v8": "^4.1.8",
+        "@vitest/coverage-v8": "^4.1.11",
         "autoprefixer": "^10.4.21",
         "eslint": "^9.25.0",
         "eslint-plugin-react-hooks": "^5.2.0",
@@ -82,26 +82,34 @@
         "typescript": "~5.8.3",
         "typescript-eslint": "^8.30.1",
         "vite": "^8.0.16",
-        "vitest": "^4.1.8"
+        "vitest": "^4.1.11"
     },
     "overrides": {
-        "js-yaml": "4.3.1",
+        "js-yaml": "4.3.2",
+        "browserslist": "4.28.9",
+        "baseline-browser-mapping": "2.11.23",
         "nanoid": "3.3.18",
         "esbuild": "0.28.1",
         "ws": "8.21.0",
         "brace-expansion@1": "1.1.18",
         "brace-expansion@2": "2.1.4",
-        "postcss": "$postcss"
+        "postcss": "$postcss",
+        "@humanfs/node": "0.16.8",
+        "postcss-selector-parser": "6.1.4"
     },
     "pnpm": {
         "overrides": {
-            "js-yaml": "4.3.1",
+            "js-yaml": "4.3.2",
+            "browserslist": "4.28.9",
+            "baseline-browser-mapping": "2.11.23",
             "nanoid": "3.3.18",
             "esbuild": "0.28.1",
             "ws": "8.21.0",
             "brace-expansion@1": "1.1.18",
             "brace-expansion@2": "2.1.4",
-            "postcss": "8.5.25"
+            "postcss": "8.5.25",
+            "@humanfs/node": "0.16.8",
+            "postcss-selector-parser": "6.1.4"
         }
     }
 }
```

**File**: `control-plane/web/client/pnpm-lock.yaml` (modified, +361/-334)
```diff
@@ -4,6 +4,19 @@ settings:
   autoInstallPeers: true
   excludeLinksFromLockfile: false
 
+overrides:
+  js-yaml: 4.3.2
+  browserslist: 4.28.9
+  baseline-browser-mapping: 2.11.23
+  nanoid: 3.3.18
+  esbuild: 0.28.1
+  ws: 8.21.0
+  brace-expansion@1: 1.1.18
+  brace-expansion@2: 2.1.4
+  postcss: 8.5.25
+  '@humanfs/node': 0.16.8
+  postcss-selector-parser: 6.1.4
+
 importers:
 
   .:
@@ -13,7 +26,7 @@ importers:
         version: 4.0.0(@hookform/resolvers@3.10.0(react-hook-form@7.72.1(react@19.2.8)))(react-hook-form@7.72.1(react@19.2.8))(react@19.2.8)
       '@autoform/shadcn':
         specifier: ^1.0.1
-        version: 1.0.1(@types/react-dom@19.1.9(@types/react@19.1.13))(@types/react@19.1.13)(jiti@1.21.7)(postcss@8.5.25)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(supports-color@7.2.0)(tailwindcss@3.4.17)(typescript@5.8.3)(yaml@2.8.3)
+        version: 1.0.1(@types/react-dom@19.1.9(@types/react@19.1.13))(@types/react@19.1.13)(jiti@1.21.7)(postcss@8.5.25)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(tailwindcss@3.4.17)(typescript@5.8.3)(yaml@2.8.3)
       '@autoform/zod':
         specifier: ^5.0.0
         version: 5.0.0(zod@4.3.6)
@@ -121,7 +134,7 @@ importers:
         version: 5.6.0(react@19.2.8)
       react-markdown:
         specifier: ^10.1.0
-        version: 10.1.0(@types/react@19.1.13)(react@19.2.8)(supports-color@7.2.0)
+        version: 10.1.0(@types/react@19.1.13)(react@19.2.8)
       react-router:
         specifier: ^8.3.0
         version: 8.3.0(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
@@ -130,7 +143,7 @@ importers:
         version: 2.15.4(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
       remark-gfm:
         specifier: ^4.0.1
-        version: 4.0.1(supports-color@7.2.0)
+        version: 4.0.1
       sonner:
         specifier: ^2.0.7
         version: 2.0.7(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
@@ -170,30 +183,30 @@ importers:
         version: 19.1.9(@types/react@19.1.13)
       '@vitejs/plugin-react':
         specifier: ^6.0.1
-        version: 6.0.1(vite@8.0.16(@types/node@24.5.2)(esbuild@0.27.7)(jiti@1.21.7)(yaml@2.8.3))
+        version: 6.0.1(vite@8.0.16(@types/node@24.5.2)(esbuild@0.28.1)(jiti@1.21.7)(yaml@2.8.3))
       '@vitest/coverage-v8':
-        specifier: ^4.1.8
-        version: 4.1.8(vitest@4.1.8)
+        specifier: ^4.1.11
+        version: 4.1.11(vitest@4.1.11)
       autoprefixer:
         specifier: ^10.4.21
         version: 10.4.21(postcss@8.5.25)
       eslint:
         specifier: ^9.25.0
-        version: 9.36.0(jiti@1.21.7)(supports-color@7.2.0)
+        version: 9.36.0(jiti@1.21.7)
       eslint-plugin-react-hooks:
         specifier: ^5.2.0
-        version: 5.2.0(eslint@9.36.0(jiti@1.21.7)(supports-color@7.2.0))
+        version: 5.2.0(eslint@9.36.0(jiti@1.21.7))
       eslint-plugin-react-refresh:
         specifier: ^0.4.19
-        version: 0.4.20(eslint@9.36.0(jiti@1.21.7)(supports-color@7.2.0))
+        version: 0.4.20(eslint@9.36.0(jiti@1.21.7))
       globals:
         specifier: ^16.0.0
         version: 16.4.0
       jsdom:
         specifier: ^26.1.0
-        version: 26.1.0(supports-color@7.2.0)
+        version: 26.1.0
       postcss:
-        specifier: ^8.5.25
+        specifier: 8.5.25
         version: 8.5.25
       tailwindcss:
         specifier: ^3.4.17
@@ -206,13 +219,13 @@ importers:
         version: 5.8.3
       typescript-eslint:
         specifier: ^8.30.1
-        version: 8.44.0(eslint@9.36.0(jiti@1.21.7)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.8.3)
+        version: 8.44.0(eslint@9.36.0(jiti@1.21.7))(typescript@5.8.3)
       vite:
         specifier: ^8.0.16
-        version: 8.0.16(@types/node@24.5.2)(esbuild@0.27.7)(jiti@1.21.7)(yaml@2.8.3)
+        version: 8.0.16(@types/node@24.5.2)(esbuild@0.28.1)(jiti@1.21.7)(yaml@2.8.3)
       vitest:
-        specifier: ^4.1.8
-        version: 4.1.8(@types/node@24.5.2)(@vitest/coverage-v8@4.1.8)(jsdom@26.1.0(supports-color@7.2.0))(vite@8.0.16(@types/node@24.5.2)(e
```

---

### Incident Patch 7: `887a3b99` (2026-09-18)
**Commit Message**: fix(storage): rebind postgres tx prepares and guard stale retries (#1051)

* fix(storage): rebind transactional prepares and guard stale retries

* test(storage): verify stale reapers against live PostgreSQL

Adds connection-backed PostgreSQL coverage for the transactional prepare
rebinding and the paired-execution staleness guard:

- reproduce the pre-fix failure at the SQL level (SQLSTATE 42601)
- assert the reaper UPDATE statements reach the driver rebound to $n
- drive MarkStaleExecutions, MarkStaleWorkflowExecutions and
  RetryStaleWorkflowExecutions end to end so a row stale on both clocks is
  reaped while a workflow whose paired execution is still fresh survives
- cover the guard's status filter (a terminal paired execution does not
  shield a stale workflow)

Live tests are gated on POSTGRES_TEST_URL, refuse non-loopback hosts, and
create a throwaway database per test.

* fix(storage): recheck execution staleness between retry statements

RetryStaleWorkflowExecutions repeated the activity predicate in its
workflow UPDATE, but the paired execution UPDATE still only rechecked
status. A heartbeat committing between the two statements was
overwritten, dragging a live execution

**File**: `control-plane/internal/storage/coverage_misc_helpers_test.go` (modified, +114/-0)
```diff
@@ -3,8 +3,10 @@ package storage
 import (
 	"context"
 	"database/sql"
+	"database/sql/driver"
 	"errors"
 	"path/filepath"
+	"sync"
 	"testing"
 
 	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
@@ -17,11 +19,123 @@ type testRollbacker struct {
 	rollbacks int
 }
 
+type prepareCaptureState struct {
+	mu      sync.Mutex
+	queries []string
+}
+
+type prepareCaptureConnector struct {
+	state *prepareCaptureState
+}
+
+type prepareCaptureDriver struct{}
+
+type prepareCaptureConn struct {
+	state *prepareCaptureState
+}
+
+type prepareCaptureTx struct{}
+
+type prepareCaptureStmt struct{}
+
+func (prepareCaptureConnector) Driver() driver.Driver {
+	return prepareCaptureDriver{}
+}
+
+func (c prepareCaptureConnector) Connect(context.Context) (driver.Conn, error) {
+	return &prepareCaptureConn{state: c.state}, nil
+}
+
+func (prepareCaptureDriver) Open(string) (driver.Conn, error) {
+	return nil, errors.New("prepare capture driver requires a connector")
+}
+
+func (c *prepareCaptureConn) recordPrepare(query string) driver.Stmt {
+	c.state.mu.Lock()
+	c.state.queries = append(c.state.queries, query)
+	c.state.mu.Unlock()
+	return prepareCaptureStmt{}
+}
+
+func (c *prepareCaptureConn) Prepare(query string) (driver.Stmt, error) {
+	return c.recordPrepare(query), nil
+}
+
+func (c *prepareCaptureConn) PrepareContext(_ context.Context, query string) (driver.Stmt, error) {
+	return c.recordPrepare(query), nil
+}
+
+func (*prepareCaptureConn) Close() error { return nil }
+
+func (*prepareCaptureConn) Begin() (driver.Tx, error) {
+	return prepareCaptureTx{}, nil
+}
+
+func (prepareCaptureTx) Commit() error   { return nil }
+func (prepareCaptureTx) Rollback() error { return nil }
+
+func (prepareCaptureStmt) Close() error  { return nil }
+func (prepareCaptureStmt) NumInput() int { return -1 }
+func (prepareCaptureStmt) Exec([]driver.Value) (driver.Result, error) {
+	return driver.RowsAffected(0), nil
+}
+func (prepareCaptureStmt) Query([]driver.Value) (driver.Rows, error) {
+	return nil, errors.New("prepare capture query not supported")
+}
+
+func (s *prepareCaptureState) preparedQueries() []string {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	return append([]string(nil), s.queries...)
+}
+
 func (r *testRollbacker) Rollback() error {
 	r.rollbacks++
 	return r.err
 }
 
+func TestSQLTxPrepareRebindsByMode(t *testing.T) {
+	tests := []struct {
+		name string
+		mode string
+		want []string
+	}{
+		{
+			name: "postgres",
+			mode: "postgres",
+			want: []string{"SELECT $1", "UPDATE items SET name = $1"},
+		},
+		{
+			name: "sqlite",
+			mode: "local",
+			want: []string{"SELECT ?", "UPDATE items SET name = ?"},
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			state := &prepareCaptureState{}
+			rawDB := sql.OpenDB(prepareCaptureConnector{state: state})
+			t.Cleanup(func() { _ = rawDB.Close() })
+
+			rawTx, err := rawDB.Begin()
+			require.NoError(t, err)
+			tx := newSQLTx(rawTx, test.mode)
+
+			stmt, err := tx.PrepareContext(context.Background(), "SELECT ?")
+			require.NoError(t, err)
+			require.NoError(t, stmt.Close())
+
+			stmt, err = tx.Prepare("UPDATE items SET name = ?")
+			require.NoError(t, err)
+			require.NoError(t, stmt.Close())
+			require.NoError(t, tx.Rollback())
+
+			require.Equal(t, test.want, state.preparedQueries())
+		})
+	}
+}
+
 func TestStorageHelperCoverage(t *testing.T) {
 	t.Run("error types format messages", func(t *testing.T) {
 		require.Equal(
```

**File**: `control-plane/internal/storage/execution_records.go` (modified, +106/-15)
```diff
@@ -1573,8 +1573,15 @@ func (ls *LocalStorage) markAgentExecutionsOrphaned(ctx context.Context, agentNo
 
 // RetryStaleWorkflowExecutions finds stale workflow executions that haven't exceeded
 // maxRetries and resets both workflow_executions and executions back to "pending"
-// so the paired records stay in sync for the retry path.
+// so the paired records stay in sync for the retry path. The candidate predicates
+// are repeated in both conditional updates, so activity after selection — including
+// a heartbeat landing between the workflow and execution statements — prevents a retry.
+// A candidate is only committed and reported as retried when both records move.
 func (ls *LocalStorage) RetryStaleWorkflowExecutions(ctx context.Context, staleAfter time.Duration, maxRetries int, limit int) ([]string, error) {
+	return ls.retryStaleWorkflowExecutions(ctx, staleAfter, maxRetries, limit, nil)
+}
+
+func (ls *LocalStorage) retryStaleWorkflowExecutions(ctx context.Context, staleAfter time.Duration, maxRetries int, limit int, afterCandidateSelection func()) ([]string, error) {
 	if limit <= 0 || maxRetries <= 0 {
 		return nil, nil
 	}
@@ -1584,17 +1591,22 @@ func (ls *LocalStorage) RetryStaleWorkflowExecutions(ctx context.Context, staleA
 
 	cutoff := time.Now().UTC().Add(-staleAfter)
 	db := ls.requireSQLDB()
-	tsExpr := ls.staleTimestampExpr("COALESCE(updated_at, created_at, started_at)")
+	workflowTSExpr := ls.staleTimestampExpr("COALESCE(w.updated_at, w.created_at, w.started_at)")
+	executionTSExpr := ls.staleTimestampExpr("COALESCE(e.updated_at, e.created_at, e.started_at)")
 	cutoffExpr := ls.staleTimestampExpr("?")
 
 	rows, err := db.QueryContext(ctx, `
-		SELECT execution_id
-		FROM workflow_executions
-		WHERE status IN ('running', 'pending', 'queued')
-		  AND retry_count < ?
-		  AND `+tsExpr+` <= `+cutoffExpr+`
-		ORDER BY `+tsExpr+` ASC
-		LIMIT ?`, maxRetries, cutoff, limit)
+		SELECT w.execution_id
+		FROM workflow_executions w
+		LEFT JOIN executions e
+		  ON e.execution_id = w.execution_id
+		 AND e.status IN ('running', 'pending', 'queued', 'waiting')
+		WHERE w.status IN ('running', 'pending', 'queued')
+		  AND w.retry_count < ?
+		  AND `+workflowTSExpr+` <= `+cutoffExpr+`
+		  AND (e.execution_id IS NULL OR `+executionTSExpr+` <= `+cutoffExpr+`)
+		ORDER BY `+workflowTSExpr+` ASC
+		LIMIT ?`, maxRetries, cutoff, cutoff, limit)
 	if err != nil {
 		return nil, fmt.Errorf("query retriable workflow executions: %w", err)
 	}
@@ -1616,6 +1628,12 @@ func (ls *LocalStorage) RetryStaleWorkflowExecutions(ctx context.Context, staleA
 		return nil, nil
 	}
 
+	// Package tests use this seam to make the candidate-selection-to-update
+	// interleaving deterministic; production callers leave it nil.
+	if afterCandidateSelection != nil {
+		afterCandidateSelection()
+	}
+
 	tx, err := db.BeginTx(ctx, nil)
 	if err != nil {
 		return nil, fmt.Errorf("begin retry transaction: %w", err)
@@ -1626,34 +1644,68 @@ func (ls *LocalStorage) RetryStaleWorkflowExecutions(ctx context.Context, staleA
 	retryReason := "auto-retry after stale timeout"
 
 	workflowStmt, err := tx.PrepareContext(ctx, `
-		UPDATE workflow_executions
+		UPDATE workflow_executions AS w
 		SET status = 'pending',
 		    retry_count = retry_count + 1,
 		    error_message = ?,
 		    completed_at = NULL,
 		    updated_at = ?
-		WHERE execution_id = ? AND status IN ('running', 'pending', 'queued')`)
+		WHERE w.execution_id = ?
+		  AND w.status IN ('running', 'pending', 'queued')
+		  AND w.retry_count < ?
+		  AND `+workflowTSExpr+` <= `+cutoffExpr+`
+		  AND (
+		      NOT EXISTS (
+		          SELECT 1 FROM executions e
+		          WHERE e.execution_id = w.execution_id
+		            AND e.status IN ('running', 'pending', 'queued', 'waiting')
+		      )
+		      OR EXISTS (
+		          SELECT 1 FROM executions e
+		          WHERE e.execution_id = w.execution_id
+		            AND e.status IN ('running', 'pending', 'queued', 'waiting')
+		            A
```

**File**: `control-plane/internal/storage/postgres_stale_reaper_live_test.go` (added, +668/-0)
```diff
@@ -0,0 +1,668 @@
+package storage
+
+import (
+	"context"
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
+	"fmt"
+	"net"
+	"os"
+	"strings"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
+	"github.com/jackc/pgx/v5"
+	"github.com/jackc/pgx/v5/pgconn"
+	"github.com/jackc/pgx/v5/stdlib"
+	"github.com/stretchr/testify/require"
+)
+
+// These tests exercise the stale reapers against a real PostgreSQL server.
+// They are gated on POSTGRES_TEST_URL, the same variable the rest of the
+// storage suite uses, and connect only to a loopback host. Each test creates
+// its own throwaway database so rows never leak between tests.
+
+// livePostgresConnConfig reads POSTGRES_TEST_URL and refuses anything that is
+// not a loopback server, so a stray staging DSN can never be touched.
+func livePostgresConnConfig(t *testing.T) *pgx.ConnConfig {
+	t.Helper()
+
+	dsn := strings.TrimSpace(os.Getenv("POSTGRES_TEST_URL"))
+	if dsn == "" {
+		t.Skip("POSTGRES_TEST_URL not set, skipping live postgres tests")
+	}
+
+	cfg, err := pgx.ParseConfig(dsn)
+	require.NoError(t, err, "parse POSTGRES_TEST_URL")
+
+	host := cfg.Host
+	if host == "" {
+		host = "localhost"
+	}
+	ip := net.ParseIP(host)
+	require.Truef(t,
+		strings.EqualFold(host, "localhost") || (ip != nil && ip.IsLoopback()),
+		"live postgres tests refuse non-loopback host %q", host)
+	return cfg
+}
+
+// livePostgresStorage spins up an isolated database on the live server and
+// returns a Postgres-backed LocalStorage pointed at it.
+func livePostgresStorage(t *testing.T) (*LocalStorage, context.Context) {
+	t.Helper()
+
+	cfg := livePostgresConnConfig(t)
+	ctx := context.Background()
+
+	dbName := fmt.Sprintf("af_reaper_live_%d_%d", time.Now().UnixNano(), os.Getpid())
+
+	admin, err := sql.Open("pgx", cfg.ConnString())
+	require.NoError(t, err)
+	_, err = admin.ExecContext(ctx, "CREATE DATABASE "+dbName)
+	_ = admin.Close()
+	require.NoError(t, err, "create throwaway database %s", dbName)
+
+	t.Cleanup(func() {
+		drop, dropErr := sql.Open("pgx", cfg.ConnString())
+		if dropErr != nil {
+			return
+		}
+		defer drop.Close()
+		_, _ = drop.ExecContext(context.Background(), "DROP DATABASE IF EXISTS "+dbName+" WITH (FORCE)")
+	})
+
+	storageCfg := StorageConfig{
+		Mode: "postgres",
+		Postgres: PostgresStorageConfig{
+			Host:     cfg.Host,
+			Port:     int(cfg.Port),
+			User:     cfg.User,
+			Password: cfg.Password,
+			Database: dbName,
+			SSLMode:  "disable",
+		},
+	}
+	ls := NewPostgresStorage(PostgresStorageConfig{})
+	require.NoError(t, ls.Initialize(ctx, storageCfg), "initialize postgres storage")
+	t.Cleanup(func() { _ = ls.Close(context.Background()) })
+
+	return ls, ctx
+}
+
+// preparedSQLRecorder wraps a real PostgreSQL connector and records every SQL
+// string handed to the driver's prepare path. That string is the post-rebind
+// text, so it is the exact statement PostgreSQL would parse.
+type preparedSQLRecorder struct {
+	inner driver.Connector
+	mu    sync.Mutex
+	sql   []string
+}
+
+func (r *preparedSQLRecorder) record(query string) {
+	r.mu.Lock()
+	r.sql = append(r.sql, query)
+	r.mu.Unlock()
+}
+
+func (r *preparedSQLRecorder) prepared() []string {
+	r.mu.Lock()
+	defer r.mu.Unlock()
+	return append([]string(nil), r.sql...)
+}
+
+func (r *preparedSQLRecorder) Connect(ctx context.Context) (driver.Conn, error) {
+	conn, err := r.inner.Connect(ctx)
+	if err != nil {
+		return nil, err
+	}
+	return &recordingConn{Conn: conn, recorder: r}, nil
+}
+
+func (r *preparedSQLRecorder) Driver() driver.Driver { return recordingDriver{recorder: r} }
+
+type recordingDriver struct{ recorder *preparedSQLRecorder }
+
+func (d recordingDriver) Open(string) (driver.Conn, error) {
+	return d.recorder.Connect(context.Background())
+}
+
+type recordingConn struct {
+	driver.Conn
+	recorder *preparedSQLRecorder
+}
+
+func (c *recordingConn) Prepare(query string) (driver.Stmt, error) {
+	c.recorder.record(query)
+	return c.Conn.
```

**File**: `control-plane/internal/storage/retry_stale_test.go` (modified, +663/-0)
```diff
@@ -3,6 +3,7 @@ package storage
 import (
 	"context"
 	"encoding/json"
+	"fmt"
 	"path/filepath"
 	"strings"
 	"testing"
@@ -13,6 +14,98 @@ import (
 	"github.com/stretchr/testify/require"
 )
 
+// Interleaving inventory for RetryStaleWorkflowExecutions.
+//
+// A candidate is a workflow row W and its paired execution row E. The sweep
+// selects candidates and then, inside one transaction, updates W and then E
+// with each candidate wrapped in a savepoint. The windows are:
+//
+//  1. Activity lands on E before selection. E is no longer stale, the selection
+//     predicate drops the candidate, and neither row moves. Covered by
+//     TestRetryStaleWorkflowExecutions_ExecutionActivityProtectsWorkflow and
+//     TestRetryStaleWorkflowExecutions_FreshNonUTCTimestampNotRetried.
+//  2. Activity lands on W before selection. W is no longer stale, the selection
+//     predicate drops the candidate. Covered by TestRetryStaleWorkflowExecutions
+//     (fresh workflow fixture).
+//  3. Activity lands on W or E after selection but before the transaction's
+//     first statement. The workflow UPDATE repeats the selection predicates, so
+//     it matches zero rows and the candidate is skipped without a savepoint.
+//     Covered by ..._ActivityAfterSelectionSkipsUpdate (E) and
+//     ..._WorkflowActivityAfterSelectionSkipsUpdate (W).
+//  4. Activity lands on E after the workflow UPDATE and before the execution
+//     UPDATE. The execution UPDATE matches zero rows, the recheck sees an
+//     active execution that is no longer stale, and the whole candidate is
+//     rolled back to its savepoint: W untouched, retry_count unchanged, id
+//     absent from the returned set, and E keeps the fresh heartbeat. Covered by
+//     ..._HeartbeatBetweenStatementsSparesExecution on SQLite and live
+//     PostgreSQL, and at batch level by ..._BatchReportsOnlyMovedCandidates.
+//  5. E becomes terminal or waiting between selection and the execution UPDATE.
+//     No running/pending/queued paired record is left, so the pre-existing
+//     workflow-only recovery path applies: only W moves and E is never
+//     modified. Terminal is covered by ..._TerminalPairedExecutionStillRetried;
+//     the waiting variant reaches the same branch because the execution UPDATE
+//     deliberately excludes 'waiting' (see commit c73dc4d1). Treating a
+//     terminal execution as "no live work" is the documented contract that the
+//     fix preserves.
+//  6. A heartbeat on E lands after the execution UPDATE but before commit. The
+//     update holds E's row lock on PostgreSQL, so the heartbeat serialises
+//     behind the commit and applies to the pending row from outside the call;
+//     the call cannot lose a heartbeat it has not yet observed.
+//  7. A statement fails or the context is cancelled mid-batch. defer
+//     rollbackTx discards every candidate, so no half-moved pair can survive;
+//     the returned error is authoritative over the returned ids. The invariant
+//     is "nothing commits", so it needs no interleaving proof beyond the
+//     deferred rollback.
+//
+// MarkStaleWorkflowExecutions has a different shape: once its workflow guard
+// has passed, its workflow UPDATE and its executions sync UPDATE both run, and
+// the sync UPDATE carries no staleness predicate. A heartbeat that lands
+// between the two statements is therefore overwritten by the sync, leaving
+// both rows terminal together. The pair never splits (the consistency property
+// this inventory tracks); the lost heartbeat is a pre-existing false-positive
+// window in the reaper's sync mirror, unchanged by the retry fix and out of
+// scope here.
+//
+// Helpers shared by the regressions below.
+
+// retryTestWorkflow builds a stale-eligible workflow row whose timestamps are
+// exactly the supplied instant so tests can assert that a skipped candidate
+// keeps its committed updated_at.
+func retryTestWorkflow(id string, updatedAt time.Time) *types.WorkflowExecu
```

**File**: `control-plane/internal/storage/sql_helpers.go` (modified, +11/-0)
```diff
@@ -150,3 +150,14 @@ func (tx *sqlTx) QueryRowContext(ctx context.Context, query string, args ...inte
 func (tx *sqlTx) QueryRow(query string, args ...interface{}) *sql.Row {
 	return tx.Tx.QueryRow(tx.rebind(query), args...)
 }
+
+// Both preparation methods must rebind here: callers can use either the
+// context-aware or deprecated API, and the embedded *sql.Tx methods would
+// otherwise send ? placeholders directly to PostgreSQL.
+func (tx *sqlTx) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
+	return tx.Tx.PrepareContext(ctx, tx.rebind(query))
+}
+
+func (tx *sqlTx) Prepare(query string) (*sql.Stmt, error) {
+	return tx.Tx.Prepare(tx.rebind(query))
+}
```

---

### Incident Patch 8: `7a1714e5` (2026-09-18)
**Commit Message**: fix(sdk/go): return isolated session definitions (#1044)

* fix(sdk/go): return isolated session definitions

* fix(sdk/go): distinguish overlapping slice views

**File**: `sdk/go/agent/session.go` (modified, +99/-1)
```diff
@@ -1,5 +1,7 @@
 package agent
 
+import "reflect"
+
 type SessionDefinition struct {
 	Name          string         `json:"name"`
 	Provider      string         `json:"provider"`
@@ -107,7 +109,103 @@ func (a *Agent) RegisterSession(name string, provider string, transport string,
 func (a *Agent) SessionDefinitions() []SessionDefinition {
 	sessions := make([]SessionDefinition, 0, len(a.sessions))
 	for _, session := range a.sessions {
-		sessions = append(sessions, session)
+		sessions = append(sessions, cloneSessionDefinition(session))
 	}
 	return sessions
 }
+
+func cloneSessionDefinition(session SessionDefinition) SessionDefinition {
+	cloned := session
+	cloned.Modalities = append([]string(nil), session.Modalities...)
+	cloned.Tools = append([]string(nil), session.Tools...)
+	cloned.Tags = append([]string(nil), session.Tags...)
+	cloned.ProposedTags = append([]string(nil), session.ProposedTags...)
+	cloned.ApprovedTags = append([]string(nil), session.ApprovedTags...)
+	cloned.Metadata = cloneSessionMetadata(session.Metadata)
+	if session.TurnDetection != nil {
+		config := *session.TurnDetection
+		config.Threshold = cloneSessionPointer(config.Threshold)
+		config.PrefixPaddingMS = cloneSessionPointer(config.PrefixPaddingMS)
+		config.SilenceDurationMS = cloneSessionPointer(config.SilenceDurationMS)
+		config.CreateResponse = cloneSessionPointer(config.CreateResponse)
+		config.InterruptResponse = cloneSessionPointer(config.InterruptResponse)
+		cloned.TurnDetection = &config
+	}
+	return cloned
+}
+
+func cloneSessionPointer[T any](value *T) *T {
+	if value == nil {
+		return nil
+	}
+	cloned := *value
+	return &cloned
+}
+
+type sessionMetadataCopyReference struct {
+	kind   reflect.Kind
+	typeOf reflect.Type
+	ptr    uintptr
+	length int
+	cap    int
+}
+
+// cloneSessionMetadata recursively copies maps and slices stored in metadata.
+// It keeps a copy of each encountered reference so cyclic metadata remains
+// detached without recursing forever. Other kinds are returned unchanged.
+func cloneSessionMetadata(metadata map[string]any) map[string]any {
+	if metadata == nil {
+		return nil
+	}
+	return cloneSessionMetadataValue(
+		reflect.ValueOf(metadata),
+		make(map[sessionMetadataCopyReference]reflect.Value),
+	).Interface().(map[string]any)
+}
+
+func cloneSessionMetadataValue(value reflect.Value, copied map[sessionMetadataCopyReference]reflect.Value) reflect.Value {
+	switch value.Kind() {
+	case reflect.Interface:
+		if value.IsNil() {
+			return reflect.Zero(value.Type())
+		}
+		cloned := cloneSessionMetadataValue(value.Elem(), copied)
+		result := reflect.New(value.Type()).Elem()
+		result.Set(cloned)
+		return result
+	case reflect.Map:
+		if value.IsNil() {
+			return reflect.Zero(value.Type())
+		}
+		ref := sessionMetadataCopyReference{kind: value.Kind(), typeOf: value.Type(), ptr: value.Pointer()}
+		if existing, found := copied[ref]; found {
+			return existing
+		}
+		result := reflect.MakeMapWithSize(value.Type(), value.Len())
+		copied[ref] = result
+		iter := value.MapRange()
+		for iter.Next() {
+			result.SetMapIndex(iter.Key(), cloneSessionMetadataValue(iter.Value(), copied))
+		}
+		return result
+	case reflect.Slice:
+		if value.IsNil() {
+			return reflect.Zero(value.Type())
+		}
+		ref := sessionMetadataCopyReference{
+			kind: value.Kind(), typeOf: value.Type(), ptr: value.Pointer(),
+			length: value.Len(), cap: value.Cap(),
+		}
+		if existing, found := copied[ref]; found {
+			return existing
+		}
+		result := reflect.MakeSlice(value.Type(), value.Len(), value.Len())
+		copied[ref] = result
+		for i := 0; i < value.Len(); i++ {
+			result.Index(i).Set(cloneSessionMetadataValue(value.Index(i), copied))
+		}
+		return result
+	default:
+		return value
+	}
+}
```

**File**: `sdk/go/agent/session_test.go` (modified, +150/-0)
```diff
@@ -6,6 +6,63 @@ import (
 	"testing"
 )
 
+func TestAgentSessionDefinitionsDetachesTurnDetection(t *testing.T) {
+	for _, tc := range []struct {
+		name, provider, transport string
+		config                    *TurnDetection
+	}{
+		{name: "defaults", provider: "openai", transport: "webrtc"},
+		{name: "explicit zero and false", provider: "openai", transport: "websocket", config: &TurnDetection{
+			Type: "server_vad", Threshold: turnDetectionTestPtr(0.0),
+			PrefixPaddingMS: turnDetectionTestPtr(0), SilenceDurationMS: turnDetectionTestPtr(0),
+			CreateResponse: turnDetectionTestPtr(false), InterruptResponse: turnDetectionTestPtr(false),
+		}},
+		{name: "semantic", provider: "openai", transport: "webrtc", config: &TurnDetection{Type: "semantic_vad", Eagerness: "low"}},
+		{name: "no turn detection", provider: "openrouter", transport: "audio_turns"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			a, err := New(Config{NodeID: "support", Version: "v1"})
+			if err != nil {
+				t.Fatal(err)
+			}
+			var opts []SessionOption
+			if tc.config != nil {
+				opts = append(opts, WithSessionTurnDetection(*tc.config))
+			}
+			if err := a.RegisterSession("voice", tc.provider, tc.transport, opts...); err != nil {
+				t.Fatal(err)
+			}
+			want, err := json.Marshal(a.sessions["voice"].TurnDetection)
+			if err != nil {
+				t.Fatal(err)
+			}
+			snapshot := a.SessionDefinitions()[0]
+			if config := snapshot.TurnDetection; config != nil {
+				config.Type = "mutated"
+				config.Eagerness = "mutated"
+				if config.Threshold != nil {
+					*config.Threshold = 1
+				}
+				if config.PrefixPaddingMS != nil {
+					*config.PrefixPaddingMS = 999
+				}
+				if config.SilenceDurationMS != nil {
+					*config.SilenceDurationMS = 999
+				}
+				*config.CreateResponse = !*config.CreateResponse
+				*config.InterruptResponse = !*config.InterruptResponse
+			}
+			got, err := json.Marshal(a.SessionDefinitions()[0].TurnDetection)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if string(got) != string(want) {
+				t.Fatalf("snapshot mutation changed registered session: got %s, want %s", got, want)
+			}
+		})
+	}
+}
+
 func TestAgentRegisterSessionStoresExplicitDefinition(t *testing.T) {
 	a, err := New(Config{NodeID: "support", Version: "v1"})
 	if err != nil {
@@ -50,6 +107,99 @@ func TestAgentRegisterSessionRejectsInvalidTransport(t *testing.T) {
 	}
 }
 
+func TestAgentSessionDefinitionsReturnsDefensiveSnapshots(t *testing.T) {
+	a, err := New(Config{NodeID: "support", Version: "v1"})
+	if err != nil {
+		t.Fatalf("New returned error: %v", err)
+	}
+
+	metadata := map[string]any{
+		"origin": "registry",
+		"nested": map[string]any{
+			"labels": []any{"original", map[string]any{"owner": "support"}},
+		},
+		"typedLabels": []string{"voice"},
+	}
+	if err := a.RegisterSession(
+		"voice",
+		"openai",
+		"webrtc",
+		WithSessionModalities("audio"),
+		WithSessionTools("support.resolve_voice_turn"),
+		WithSessionTags("voice"),
+		WithSessionMetadata(metadata),
+	); err != nil {
+		t.Fatalf("RegisterSession returned error: %v", err)
+	}
+	registered := a.sessions["voice"]
+	registered.ApprovedTags = []string{"approved"}
+	a.sessions["voice"] = registered
+
+	snapshot := a.SessionDefinitions()
+	snapshot[0].Tools[0] = "mutated-tool"
+	snapshot[0].Modalities[0] = "mutated-modality"
+	snapshot[0].Tags[0] = "mutated-tag"
+	snapshot[0].ProposedTags[0] = "mutated-proposed-tag"
+	snapshot[0].ApprovedTags[0] = "mutated-approved-tag"
+	snapshot[0].Metadata["origin"] = "mutated-origin"
+	nested := snapshot[0].Metadata["nested"].(map[string]any)
+	labels := nested["labels"].([]any)
+	labels[0] = "mutated-label"
+	labels[1].(map[string]any)["owner"] = "mutated-owner"
+	snapshot[0].Metadata["typedLabels"].([]string)[0] = "mutated-typed-label"
+
+	secondSnapshot := a.SessionDefinitions()
+	session := secondSnapshot[0]
+	if session.Tools[0] != "support.resolve_voice_turn" {
+		t.Errorf("tools = %#v, want original values", session.Tools)
+	}
+	if se
```

---

### Incident Patch 9: `9e692298` (2026-09-15)
**Commit Message**: fix(sessions): expose turn detection and barge-in configuration across SDKs (#1056)

* fix(sessions): expose validated turn detection across SDKs

Signed-off-by: WANG Qingmin <75425799+FriendlyPasser@users.noreply.github.com>

* test(sessions): cover config parsing and invalid offer targets

Signed-off-by: WANG Qingmin <75425799+FriendlyPasser@users.noreply.github.com>

---------

Signed-off-by: WANG Qingmin <75425799+FriendlyPasser@users.noreply.github.com>

**File**: `control-plane/internal/cli/session.go` (modified, +5/-0)
```diff
@@ -31,6 +31,7 @@ type sessionToolOptions struct {
 }
 
 type sessionOfferOptions struct {
+	target       string
 	provider     string
 	transport    string
 	sdpSource    string
@@ -113,6 +114,7 @@ func newSessionOfferCommand() *cobra.Command {
 	}
 	cmd.Flags().StringVar(&opts.provider, "provider", "", "Explicit session provider")
 	cmd.Flags().StringVar(&opts.transport, "transport", "", "Explicit session transport")
+	cmd.Flags().StringVar(&opts.target, "target", "", "Registered <node>.<session> whose turn detection settings to use")
 	cmd.Flags().StringVar(&opts.sdpSource, "sdp", "", "SDP offer as inline text, @path, or - for stdin; defaults to stdin")
 	cmd.Flags().StringVarP(&opts.outputFormat, "output", "o", "raw", "Output format: raw, json, pretty, yaml")
 	return cmd
@@ -133,6 +135,9 @@ func runSessionOffer(ctx context.Context, sessionID string, opts *sessionOfferOp
 	if strings.TrimSpace(opts.transport) != "" {
 		values.Set("transport", opts.transport)
 	}
+	if strings.TrimSpace(opts.target) != "" {
+		values.Set("target", opts.target)
+	}
 	path := "/api/v1/session-instances/" + url.PathEscape(sessionID) + "/realtime-offer"
 	if encoded := values.Encode(); encoded != "" {
 		path += "?" + encoded
```

**File**: `control-plane/internal/cli/session_test.go` (modified, +2/-0)
```diff
@@ -77,6 +77,7 @@ func TestRunSessionOfferPostsSDPAndWritesRawAnswer(t *testing.T) {
 		require.Equal(t, "/api/v1/session-instances/sess-1/realtime-offer", r.URL.Path)
 		require.Equal(t, "openai", r.URL.Query().Get("provider"))
 		require.Equal(t, "webrtc", r.URL.Query().Get("transport"))
+		require.Equal(t, "support.voice", r.URL.Query().Get("target"))
 		gotContentType = r.Header.Get("Content-Type")
 		gotAPIKey = r.Header.Get("X-API-Key")
 		body, err := io.ReadAll(r.Body)
@@ -90,6 +91,7 @@ func TestRunSessionOfferPostsSDPAndWritesRawAnswer(t *testing.T) {
 	var stdout bytes.Buffer
 	err := runSessionOffer(context.Background(), "sess-1", &sessionOfferOptions{
 		provider:     "openai",
+		target:       "support.voice",
 		transport:    "webrtc",
 		sdpSource:    "v=0\r\noffer\r\n",
 		outputFormat: "raw",
```

**File**: `control-plane/internal/handlers/sessions.go` (modified, +68/-18)
```diff
@@ -77,29 +77,48 @@ func StartSessionHandler(store storage.StorageProvider) gin.HandlerFunc {
 			return
 		}
 
+		turnDetection, err := types.ParseSessionTurnDetection(capability.Provider, capability.Transport, definition.TurnDetection)
+		if err != nil {
+			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
+			return
+		}
+
 		sessionID := "sess_" + time.Now().UTC().Format("20060102_150405") + "_" + shortRandom()
 		model := firstNonEmptySession(req.Model, definition.Model)
 		voice := firstNonEmptySession(req.Voice, definition.Voice)
+		// The offer endpoint is stateless. Carry the registered target in its
+		// returned URL so the next request can resolve and validate its config.
+		offerQuery := url.Values{
+			"target":    {nodeID + "." + sessionName},
+			"provider":  {capability.Provider},
+			"transport": {capability.Transport},
+		}
+		if model != "" {
+			offerQuery.Set("model", model)
+		}
+		if voice != "" {
+			offerQuery.Set("voice", voice)
+		}
 		c.JSON(http.StatusCreated, gin.H{
-			"session_id":   sessionID,
-			"target":       nodeID + "." + sessionName,
-			"provider":     capability.Provider,
-			"transport":    capability.Transport,
-			"model":        model,
-			"voice":        voice,
-			"modalities":   definition.Modalities,
-			"tags":         definition.ApprovedTags,
-			"tool_targets": sessionToolTargets(nodeID, definition.Tools),
-			"offer_url":    fmt.Sprintf("/api/v1/session-instances/%s/realtime-offer", url.PathEscape(sessionID)),
-			"tool_url":     fmt.Sprintf("/api/v1/session-instances/%s/tools/{tool}", url.PathEscape(sessionID)),
-			"created_at":   time.Now().UTC().Format(time.RFC3339Nano),
+			"turn_detection": turnDetection,
+			"session_id":     sessionID,
+			"target":         nodeID + "." + sessionName,
+			"provider":       capability.Provider,
+			"transport":      capability.Transport,
+			"model":          model,
+			"voice":          voice,
+			"modalities":     definition.Modalities,
+			"tags":           definition.ApprovedTags,
+			"tool_targets":   sessionToolTargets(nodeID, definition.Tools),
+			"offer_url":      fmt.Sprintf("/api/v1/session-instances/%s/realtime-offer", url.PathEscape(sessionID)) + "?" + offerQuery.Encode(),
+			"tool_url":       fmt.Sprintf("/api/v1/session-instances/%s/tools/{tool}", url.PathEscape(sessionID)),
+			"created_at":     time.Now().UTC().Format(time.RFC3339Nano),
 		})
 	}
 }
 
 func SessionRealtimeOfferHandler(store storage.StorageProvider) gin.HandlerFunc {
 	return func(c *gin.Context) {
-		_ = store
 		provider := strings.TrimSpace(c.Query("provider"))
 		transport := strings.TrimSpace(c.Query("transport"))
 		if provider == "" || transport == "" {
@@ -120,6 +139,33 @@ func SessionRealtimeOfferHandler(store storage.StorageProvider) gin.HandlerFunc
 			c.JSON(http.StatusBadRequest, gin.H{"error": "webrtc realtime offers currently require provider=openai"})
 			return
 		}
+		var rawTurnDetection json.RawMessage
+		model, voice := c.Query("model"), c.Query("voice")
+		if _, supplied := c.Request.URL.Query()["target"]; supplied {
+			target := c.Query("target")
+			nodeID, sessionName, ok := splitSessionTarget(target)
+			if !ok {
+				c.JSON(http.StatusBadRequest, gin.H{"error": "session target must be <node>.<session>"})
+				return
+			}
+			definition, found := lookupSessionDefinition(c, store, nodeID, sessionName)
+			if !found {
+				return
+			}
+			if types.NormalizeSessionTransportValue(definition.Provider) != "openai" ||
+				types.NormalizeSessionTransportValue(definition.Transport) != "webrtc" {
+				c.JSON(http.StatusBadRequest, gin.H{"error": "registered session must use provider=openai transport=webrtc for realtime offers"})
+				return
+			}
+			rawTurnDetection = definition.TurnDetection
+			model = firstNonEmptySession(model, definition.Model)
+			voice = firstNonEmptySession(voice, definition.Voice)
+		}
+		turnDetection, err := types.ParseSessionTurnDetection("openai", "webrtc", rawTurnDetection)
+		if err != n
```

**File**: `control-plane/internal/handlers/sessions_test.go` (modified, +161/-0)
```diff
@@ -6,6 +6,7 @@ import (
 	"io"
 	"net/http"
 	"net/http/httptest"
+	"net/url"
 	"strings"
 	"testing"
 	"time"
@@ -277,6 +278,10 @@ func TestSessionRealtimeOfferHandlerCallsRealtimeProvider(t *testing.T) {
 	require.Len(t, gotSafetyID, 32)
 	require.Contains(t, gotSession, `"model":"gpt-test"`)
 	require.Contains(t, gotSession, `"voice":"cedar"`)
+	var config map[string]interface{}
+	require.NoError(t, json.Unmarshal([]byte(gotSession), &config))
+	input := config["audio"].(map[string]interface{})["input"].(map[string]interface{})
+	require.Equal(t, true, input["turn_detection"].(map[string]interface{})["interrupt_response"])
 }
 
 func TestSessionRealtimeOfferHandlerSurfacesProviderErrors(t *testing.T) {
@@ -403,3 +408,159 @@ func sessionTestAgent() *types.AgentNode {
 		}},
 	}
 }
+
+// Exercise the complete metadata -> start -> offer -> provider boundary, rather
+// than just checking that a new field exists in the registration response.
+func TestSessionTurnDetectionReachesProvider(t *testing.T) {
+	gin.SetMode(gin.TestMode)
+	t.Setenv("OPENAI_API_KEY", "test-key")
+	original := http.DefaultClient.Transport
+	t.Cleanup(func() { http.DefaultClient.Transport = original })
+	for _, tc := range []struct{ name, config, expected string }{
+		{"legacy defaults", "", `{"type":"server_vad","threshold":0.5,"prefix_padding_ms":300,"silence_duration_ms":500,"create_response":true,"interrupt_response":true}`},
+		{"custom server", `{"type":"server_vad","threshold":0,"prefix_padding_ms":0,"silence_duration_ms":750,"create_response":false,"interrupt_response":false}`, `{"type":"server_vad","threshold":0,"prefix_padding_ms":0,"silence_duration_ms":750,"create_response":false,"interrupt_response":false}`},
+		{"semantic", `{"type":"semantic_vad","eagerness":"low"}`, `{"type":"semantic_vad","eagerness":"low","create_response":true,"interrupt_response":true}`},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			agent := sessionTestAgent()
+			raw := agent.Metadata.Custom["sessions"].([]interface{})[0].(map[string]interface{})
+			raw["model"], raw["voice"] = "gpt-vad-test", "cedar"
+			if tc.config != "" {
+				raw["turn_detection"] = json.RawMessage(tc.config)
+			}
+			store := &nodeRESTStorageStub{agent: agent}
+			router := gin.New()
+			router.POST("/api/v1/session-targets/:target/start", StartSessionHandler(store))
+			router.POST("/api/v1/session-instances/:session_id/realtime-offer", SessionRealtimeOfferHandler(store))
+			start := httptest.NewRecorder()
+			router.ServeHTTP(start, httptest.NewRequest(http.MethodPost, "/api/v1/session-targets/support.voice/start", strings.NewReader(`{}`)))
+			require.Equal(t, http.StatusCreated, start.Code, start.Body.String())
+			var result struct {
+				OfferURL      string          `json:"offer_url"`
+				TurnDetection json.RawMessage `json:"turn_detection"`
+			}
+			require.NoError(t, json.Unmarshal(start.Body.Bytes(), &result))
+			require.JSONEq(t, tc.expected, string(result.TurnDetection))
+			calls := 0
+			http.DefaultClient.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
+				calls++
+				require.NoError(t, req.ParseMultipartForm(1<<20))
+				require.Equal(t, "v=0\r\noffer\r\n", req.FormValue("sdp"))
+				var config struct {
+					Model string `json:"model"`
+					Audio struct {
+						Output struct {
+							Voice string `json:"voice"`
+						} `json:"output"`
+						Input struct {
+							TurnDetection json.RawMessage `json:"turn_detection"`
+						} `json:"input"`
+					} `json:"audio"`
+				}
+				require.NoError(t, json.Unmarshal([]byte(req.FormValue("session")), &config))
+				require.JSONEq(t, tc.expected, string(config.Audio.Input.TurnDetection))
+				require.Equal(t, "gpt-vad-test", config.Model)
+				require.Equal(t, "cedar", config.Audio.Output.Voice)
+				return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("answer"))}, nil
+			})
+			if tc.name == "semantic" {
+				// CLI offers identify t
```

**File**: `control-plane/pkg/types/session_turn_detection.go` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+package types
+
+import (
+	"bytes"
+	"encoding/json"
+	"fmt"
+	"math"
+)
+
+// TurnDetection configures OpenAI Realtime input audio. Nil options use defaults.
+// Pointer fields preserve explicit false and zero values during JSON serialization.
+type TurnDetection struct {
+	Type              string   `json:"type"`
+	Threshold         *float64 `json:"threshold,omitempty"`
+	PrefixPaddingMS   *int     `json:"prefix_padding_ms,omitempty"`
+	SilenceDurationMS *int     `json:"silence_duration_ms,omitempty"`
+	CreateResponse    *bool    `json:"create_response,omitempty"`
+	InterruptResponse *bool    `json:"interrupt_response,omitempty"`
+	Eagerness         string   `json:"eagerness,omitempty"`
+}
+
+// NormalizeTurnDetection validates options and returns an independent config with
+// automatic responses and barge-in enabled unless explicitly disabled.
+func NormalizeTurnDetection(provider, transport string, config *TurnDetection) (*TurnDetection, error) {
+	if provider != "openai" || (transport != "webrtc" && transport != "websocket") {
+		if config != nil {
+			return nil, fmt.Errorf("turn_detection requires provider=openai and transport=webrtc or websocket")
+		}
+		return nil, nil
+	}
+	result := TurnDetection{Type: "server_vad"}
+	if config != nil {
+		result = *config
+	}
+	switch result.Type {
+	case "server_vad":
+		if result.Eagerness != "" {
+			return nil, fmt.Errorf("turn_detection.eagerness is unsupported for server_vad")
+		}
+		threshold := 0.5
+		if result.Threshold != nil {
+			threshold = *result.Threshold
+		}
+		if math.IsNaN(threshold) || math.IsInf(threshold, 0) || threshold < 0 || threshold > 1 {
+			return nil, fmt.Errorf("turn_detection.threshold must be a finite number between 0 and 1")
+		}
+		padding, silence := 300, 500
+		if result.PrefixPaddingMS != nil {
+			padding = *result.PrefixPaddingMS
+		}
+		if result.SilenceDurationMS != nil {
+			silence = *result.SilenceDurationMS
+		}
+		if padding < 0 || silence < 0 {
+			return nil, fmt.Errorf("turn_detection durations must be non-negative integers")
+		}
+		result.Threshold, result.PrefixPaddingMS, result.SilenceDurationMS = &threshold, &padding, &silence
+	case "semantic_vad":
+		if result.Threshold != nil || result.PrefixPaddingMS != nil || result.SilenceDurationMS != nil {
+			return nil, fmt.Errorf("turn_detection threshold and durations are unsupported for semantic_vad")
+		}
+		if result.Eagerness == "" {
+			result.Eagerness = "auto"
+		}
+		switch result.Eagerness {
+		case "auto", "low", "medium", "high":
+		default:
+			return nil, fmt.Errorf("turn_detection.eagerness must be auto, low, medium, or high")
+		}
+	default:
+		return nil, fmt.Errorf("turn_detection.type must be server_vad or semantic_vad")
+	}
+	create, interrupt := true, true
+	if result.CreateResponse != nil {
+		create = *result.CreateResponse
+	}
+	if result.InterruptResponse != nil {
+		interrupt = *result.InterruptResponse
+	}
+	result.CreateResponse, result.InterruptResponse = &create, &interrupt
+	return &result, nil
+}
+
+// ParseSessionTurnDetection validates untrusted registration metadata before any
+// provider request. Raw JSON preserves unknown fields so they cannot be ignored.
+func ParseSessionTurnDetection(provider, transport string, raw json.RawMessage) (*TurnDetection, error) {
+	raw = bytes.TrimSpace(raw)
+	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
+		return NormalizeTurnDetection(provider, transport, nil)
+	}
+	var fields map[string]json.RawMessage
+	if err := json.Unmarshal(raw, &fields); err != nil {
+		return nil, fmt.Errorf("turn_detection must be an object: %w", err)
+	}
+	var config TurnDetection
+	decoder := json.NewDecoder(bytes.NewReader(raw))
+	decoder.DisallowUnknownFields()
+	if err := decoder.Decode(&config); err != nil {
+		return nil, fmt.Errorf("invalid turn_detection: %w", err)
+	}
+	for key, value := range fields {
+		switch key {
+		case "type", "threshold", "prefix_padding_ms", "silence_duration_ms", "crea
```

---

### Incident Patch 10: `10aa43c0` (2026-09-10)
**Commit Message**: fix(go-sdk): make harness schema path tests OS-portable (#1049)

TestOutputPath and TestSchemaPath asserted hardcoded Unix path
separators (/tmp/...), so they failed on Windows where filepath.Join
produces backslash separators. Assert against filepath.Join with the
existing filename constants so the expected value is computed the same
way the production code computes it.

Go SDK CI runs only on ubuntu-latest, so these failures surfaced only
in local Windows development. The change is a no-op on Linux (Join
yields the identical string) and a fix on Windows.

**File**: `sdk/go/harness/schema_test.go` (modified, +3/-3)
```diff
@@ -11,12 +11,12 @@ import (
 )
 
 func TestOutputPath(t *testing.T) {
-	assert.Equal(t, "/tmp/.agentfield_output.json", OutputPath("/tmp"))
-	assert.Equal(t, "foo/.agentfield_output.json", OutputPath("foo"))
+	assert.Equal(t, filepath.Join("/tmp", outputFilename), OutputPath("/tmp"))
+	assert.Equal(t, filepath.Join("foo", outputFilename), OutputPath("foo"))
 }
 
 func TestSchemaPath(t *testing.T) {
-	assert.Equal(t, "/tmp/.agentfield_schema.json", SchemaPath("/tmp"))
+	assert.Equal(t, filepath.Join("/tmp", schemaFilename), SchemaPath("/tmp"))
 }
 
 func TestBuildPromptSuffix_SmallSchema(t *testing.T) {
```

#### Recent Merged Pull Requests:
- **PR #1076** (2026-09-29): chore(deps): bump ip-address from 10.4.0 to 10.7.2 in /sdk/typescript in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #1075** (2026-09-29): fix(sdk): probe harness binaries as argv, not a cmd.exe command string (@santoshkumarradha)
- **PR #1074** (2026-09-26): feat(go-sdk): add harness doctor preflight and provider availability specs (#685) (@7vignesh)
- **PR #1073** (2026-09-26): test(go): cover explicit harness provider factory paths (@aspire488)
- **PR #1072** (2026-09-25): fix(sdk/python): skip schema output dir for schema-free harness runs (@remote-controlled-man)
- **PR #1071** (2026-09-24): test(sdk/go): cover verifier constraint and request branches (@Metbcy)
- **PR #1069** (2026-09-24): feat(sdk/typescript): add harness provider preflight (@remote-controlled-man)
- **PR #1068** (2026-09-21): Hand a run interrupted by a rollout to a restart, and let the original execution id follow it (@AbirAbbas)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
